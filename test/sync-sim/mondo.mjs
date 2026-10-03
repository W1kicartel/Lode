// Il mondo: due o tre computer dello stesso studente, ognuno col suo disco (disco.mjs) e la sua istanza del motore, il servizio
// cloud dispettoso (cloud.mjs) in mezzo, il tempo e il modello (modello.mjs) che tiene il conto di cosa lo studente ha fatto.
// esegui(storia) recita una storia passo per passo, poi porta il mondo alla quiete (tutti accesi, in rete, niente in viaggio)
// e controlla le proprietà. Lo usano fuzz.mjs (storie a caso, ridotte quando falliscono) e scenari.mjs (storie scritte a mano).
//
// IL CONTRATTO DEL MOTORE (un modulo ES):
//   export function crea({ fs, vault, dati, orologio, casuale, registro }) → motore
//     fs        la maniglia di disco.mjs: readFile, writeFile, rename, unlink, rm, readdir, stat, mkdir, copyFile, access
//               (promesse, come node:fs/promises; percorsi relativi alla radice del computer), più fs.sync (le stesse,
//               sincrone, come node:fs: solo per l'adattatore del v1)
//     vault     'vault' (la cartella nel cloud: la vedono tutti i computer); dati: 'dati' (solo questo computer)
//     orologio  () → ms, l'ora di QUESTO computer (può essere sbagliata); casuale: () → [0,1) con seme; registro(...testi)
//   motore.apri()           all'accensione (anche dopo un crash). Mai timer: il mondo chiama arrivati() quando serve
//   motore.attiva({ modo })  'nuovo': accende la sincronizzazione sul vault che ha (migra dati.json); 'unisciti': «Uso già
//                            Lode su un altro computer» (il vault arriva dal cloud, magari a pezzi)        [facoltativa]
//   motore.modifica(op)     un'operazione dello studente (operazioni.mjs). Risolta = CONFERMATA allo studente: da quel
//                            momento deve sopravvivere a un crash. Lancia o restituisce { rifiutata: true } se non può
//   motore.vista()          il D unito che vede la barra, oppure { bloccato: true, motivo } (password, file illeggibili…)
//   motore.arrivati(x)      qualcosa è cambiato nel vault (watcher), o il controllo periodico. x è quasi sempre vuoto; dopo
//                            una modifica di Orario.md fatta in Obsidian su questo computer è { orario: 'studente' } (un aiuto
//                            che il watcher vero non ha: un motore vero non deve usarlo)
//   motore.chiudi()         chiusura normale (non dopo un crash)
//   facoltative: migra(), cifra(password), sblocca(password), smetti({ destinazione: 'fuori' }), toglila() («Toglila», §10.6: la
//                copia in chiaro di un computer che non torna, nei gruppi vecchi), conflitti() (i registri, nei nomi
//                del modello, dove la piega ha fatto perdere un valore a una modifica contemporanea: per --regola tempo-reale),
//                e l'export percorsi: { nome: ({ elenco, leggi }) → percorso | null } per gli scenari che nominano file del motore
//                («@propri», «@gruppo», «@descrittore», «@cifratura», «@datiMigrati»)
//   crea riceve anche macchina: l'impronta del computer (diversa per ognuno; storia.macchine la può cambiare), e portachiavi:
//   { leggi() → [[gruppo, chiave]…], scrivi(gruppo, chiave | null) }, il portachiavi del sistema (safeStorage) di QUEL computer:
//   sopravvive ai riavvii e ai crash, non alla storia. Il passo «dimentica» lo svuota («Dimentica la password qui», o Linux con
//   basic_text), e senza pc fa dimenticare allo studente anche tutte le password
//   facoltativa anche stato() → { avvisi: [...] }: se c'è, un dati.json scritto da una Lode vecchia (passo «vecchia») che resta
//   nel vault dopo la quiete deve far dire 'lode_vecchia' ad almeno un computer (§8.3: prima il dato spariva senza avviso)
// I GUASTI DEL DISCO (passi «guasto» e «ripara»): una lettura o una scrittura sotto una cartella fallisce con un errore che non
//   è «non c'è» (EIO, EACCES, EBUSY, ENOSPC). Con un guasto acceso apri() può lanciare (il main mette `fermo`: si riprova dopo
//   «ripara»), e modifica() può lanciare o rifiutare (non confermata). Un'operazione col segno «ritenta» la barra la rimanda
//   dopo «ripara», come fa il main con le modifiche in sospeso: se il motore aveva tenuto in memoria quella fallita, conta due volte
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { caso, semeDi, contieneMarcatore, Crash } from './comune.mjs';
import { creaDisco } from './disco.mjs';
import { creaCloud } from './cloud.mjs';
import { creaModello, proiezione, testoProiezione } from './modello.mjs';
import { applicaOp, risolvi, descrivi, datiIniziali, leggiOrario, orarioMd, chiaveLezione } from './operazioni.mjs';

export const INIZIO = Date.parse('2026-10-03T08:00:00Z');
// dove un motore può scrivere: i suoi dati, fuori/ (il vault fuori dal cloud dopo «Smetti»: il cloud non lo vede), .lode nel vault e le pagine che Lode scrive per Obsidian (con i loro temporanei)
export const permesso = p => p === 'fuori' || p.startsWith('fuori/') || p === 'dati' || p === 'vault' || p === 'vault/.lode' || p.startsWith('dati/') || p.startsWith('vault/.lode/') || /^vault\/\.?(Orario|Esami|Home|Glossario)\.md([.~-][^/]*)?$/.test(p) || p === 'vault/Corsi' || p.startsWith('vault/Corsi/') || p === 'vault/Lode' || p.startsWith('vault/Lode/');

// le promesse rifiutate di un motore morto (un crash a metà di qualcosa che non aspettava nessuno) non devono fermare il processo
let mondoAttuale = null;
process.on('unhandledRejection', x => { if (x?.crash) return; mondoAttuale?.violazione('eccezione', `promessa rifiutata e non gestita: ${x?.stack || x}`); });

const conLimite = (p, ms) => { let t; return Promise.race([Promise.resolve(p).finally(() => clearTimeout(t)), new Promise((_, no) => { t = setTimeout(() => no(Object.assign(new Error('il motore non risponde'), { limite: true })), ms); t.unref?.(); })]); };

const caricati = new Map();
async function moduloMotore(percorso) {
  const u = pathToFileURL(resolve(percorso)).href;
  if (!caricati.has(u)) caricati.set(u, await import(u));
  return caricati.get(u);
}

// motore: il percorso del modulo, oppure il modulo stesso ({ crea }) per le prove del simulatore (autoprova.mjs).
// rilassa: con file rovinati (passo corrompi) i dati possono andare persi senza colpa del motore: si controllano solo le
// proprietà che valgono sempre (propri file illeggibili, fuori dalle cartelle, cifratura, eccezioni)
export async function esegui(storia, { motore: percorsoMotore, regola = 'libera', limite = 20000, dettagli = false, rilassa = false } = {}) {
  const mod = typeof percorsoMotore === 'string' ? await moduloMotore(percorsoMotore) : percorsoMotore;
  const nomi = storia.computer || ['A', 'B', 'C'];
  const mondo = { t: INIZIO, password: null, passwords: new Set(), cifrataDa: null, corrotti: [], sincronizzato: false, inChiaro: new Set(), vecchie: new Set() };
  const violazioni = [], racconto = [];
  const violazione = (proprieta, testo, extra = {}) => violazioni.push({ proprieta, testo, ...extra });
  mondoAttuale = { violazione };
  const cloud = creaCloud({ servizio: storia.servizio || 'icloud', orologio: () => mondo.t });
  const modello = creaModello({ regola });
  const pcs = new Map();
  for (const nome of nomi) {
    const pc = { nome, scarto: 0, acceso: false, unito: false, istanza: null, maniglia: null, avvii: 0, intreccio: null, informato: false, smesso: false, scritture: new Map(), chiavi: new Map(), daRitentare: [] };
    pc.disco = creaDisco(nome, { orologio: () => mondo.t + pc.scarto, permesso });
    cloud.aggiungi(nome, pc.disco);
    // ritocco (d): la cronologia della cifratura si conta per computer, da quando quel computer HA SUL DISCO un sostituito.json
    // (o ha acceso lui la cifratura). Conta un file in chiaro solo se il motore l'ha scritto dopo quel momento (quello che era
    // già in coda di caricamento prima è il residuo dichiarato #48)
    pc.disco.ascolta((p, chi) => {
      const d = pc.disco.crudo.leggi(p);
      if (d && /^vault\/\.lode\/sync\/[^/]+\/sostituito[^/]*\.json$/.test(p)) pc.informato = true;
      if (d && chi === pc.nome && pc.informato && p.startsWith('vault/.lode/') && contieneMarcatore(d)) mondo.inChiaro.add(`${pc.nome}|${d.toString('base64')}`);
      if (d && chi === pc.nome) pc.scritture.set(p, (pc.scritture.get(p) || 0) + 1);   // per gli scenari che contano le scritture (N12)
    });
    pcs.set(nome, pc);
  }
  // il primo computer ha già Lode, senza sincronizzazione: dati.json, Orario.md e qualche nota
  const D0 = storia.iniziale || datiIniziali(), A = pcs.get(nomi[0]);
  A.disco.crudo.scrivi('vault/.lode/dati.json', JSON.stringify(D0, null, 1), 'studente');
  A.disco.crudo.scrivi('vault/Orario.md', orarioMd(D0.orario || []), 'studente');
  A.disco.crudo.scrivi('vault/Appunti/Lezione 1.md', '# Lezione 1\nappunti dello studente\n', 'studente');
  modello.iniziale(D0);

  const dì = testo => racconto.push(testo);
  // ritocco (g): «@nome» è un percorso che dice il motore (export percorsi), così uno scenario non nomina i file di un motore solo
  const sel = (pc, x) => {
    if (typeof x !== 'string' || !x.startsWith('@')) return x;
    const f = mod.percorsi?.[x.slice(1)]; if (!f) return null;
    try { return f({ elenco: pc.disco.crudo.elenco, leggi: q => pc.disco.crudo.leggi(q) }) ?? null; } catch { return null; }
  };
  const relSel = (pc, x) => { const v = sel(pc, x); return typeof v === 'string' && v.startsWith('vault/') ? v.slice(6) : v; };
  const morte = pc => { if (pc.maniglia) pc.maniglia.morto = true; pc.acceso = false; pc.istanza = null; pc.disco.disarma(); };
  async function chiama(pc, nome, f) {
    try {
      const r = await conLimite(f(), limite);
      if (pc.maniglia?.morto) { dì(`  ✝ ${pc.nome}: il motore muore durante ${nome}`); morte(pc); return { crash: true }; }
      return { ok: true, r };
    } catch (x) {
      if (x?.crash || pc.maniglia?.morto) { dì(`  ✝ ${pc.nome}: il motore muore durante ${nome}`); morte(pc); return { crash: true }; }
      if (x?.limite) { violazione('non risponde', `${pc.nome}: ${nome} non torna dopo ${limite} ms`); morte(pc); return { errore: x }; }
      return { errore: x };
    }
  }
  // dentro un'operazione del motore, prima di ogni chiamata al disco: forse arriva qualcosa dal cloud (ordini arbitrari)
  async function intreccio(pc, o, p) {
    if (pc.trappola) await pc.trappola(o, p);   // passo «obsidianNelMezzo»: lo studente salva Orario.md a metà di un giro
    const z = pc.intreccio; if (!z || z.r() >= z.p) return;
    const arrivi = cloud.inArrivo(pc.nome);
    if (arrivi.length && z.r() < 0.7) cloud.consegna(pc.nome, z.r.scegli(arrivi), { modo: z.r() < z.meta ? 'meta' : 'intero', frazione: z.r() });
    else { const altri = nomi.filter(n => n !== pc.nome && cloud.sporchi(n).length); if (altri.length) { const n = z.r.scegli(altri); cloud.carica(n, z.r.scegli(cloud.sporchi(n)), { vince: z.r() < 0.5 ? 'server' : 'nuovo' }); } }
  }
  async function avvia(pc) {
    pc.maniglia = pc.disco.maniglia({ prima: (o, p) => intreccio(pc, o, p), nomeMotore: pc.nome });
    const m = pc.maniglia, portachiavi = { leggi: async () => [...pc.chiavi], scrivi: async (g, k) => { if (m.morto) return; if (k == null) pc.chiavi.delete(g); else pc.chiavi.set(g, k); } };
    pc.istanza = mod.crea({ fs: pc.maniglia, vault: 'vault', dati: 'dati', portachiavi, macchina: (storia.macchine || {})[pc.nome] || `macchina-${pc.nome}`, orologio: () => mondo.t + pc.scarto, casuale: caso(semeDi(`${storia.seme}|${pc.nome}|${pc.avvii++}`)), registro: (...a) => { if (dettagli) dì(`    · ${pc.nome}: ${a.join(' ')}`); } });
    pc.acceso = true;
    const r = await chiama(pc, 'apri', () => pc.istanza.apri());
    // con un guasto acceso del disco apri() può lanciare: è `fermo` (il main lo mostra e riprova), non un'eccezione
    if (r.errore && pc.disco.guasti.length) { dì(`  ${pc.nome}: fermo (${r.errore.code || r.errore.message}): niente si scrive finché il disco non torna a posto`); morte(pc); return { crash: true }; }
    if (r.errore) { violazione('eccezione', `${pc.nome}: apri() lancia: ${r.errore.message}`); morte(pc); }
    return r;
  }
  const vista = async pc => { const r = await chiama(pc, 'vista', async () => pc.istanza.vista()); if (r.errore) violazione('eccezione', `${pc.nome}: vista() lancia: ${r.errore.message}`); return r.ok ? r.r : null; };
  const sceglie = (l, q) => l.length ? l[Math.min(l.length - 1, Math.floor((q ?? 0) * l.length))] : null;

  async function passo(s, i) {
    const pc = pcs.get(s.pc);
    if (pc?.morto) return;   // un computer morto per sempre non fa più niente (non si riunisce, non si riaccende)
    switch (s.t) {
      case 'tempo': mondo.t += s.ms; dì(`${i}. passano ${durata(s.ms)}`); return;
      case 'orologio': pc.scarto = s.scarto; dì(`${i}. l'orologio di ${pc.nome} va ${s.scarto >= 0 ? 'avanti' : 'indietro'} di ${durata(Math.abs(s.scarto))}`); return;
      case 'rete': cloud.online(pc.nome, s.online); dì(`${i}. ${pc.nome} ${s.online ? 'torna in rete' : 'senza rete'}`); return;
      case 'attiva': {
        if (pc.unito && !s.forza) return;
        if (s.modo === 'unisciti' && !mondo.sincronizzato) return;   // non c'è ancora niente a cui unirsi
        dì(`${i}. ${pc.nome}: ${s.modo === 'nuovo' ? 'accende la sincronizzazione sul suo vault' : '«Uso già Lode su un altro computer»'}`);
        if (!pc.acceso && (await avvia(pc)).crash) return;
        if (!pc.istanza) return;
        // il dati.json che c'è adesso su questo computer (se si legge): la migrazione deve conservarlo tutto
        let Dprima = null; try { Dprima = JSON.parse(pc.disco.crudo.leggi('vault/.lode/dati.json')?.toString('utf8')); } catch { }
        const r = pc.istanza.attiva ? await chiama(pc, 'attiva', () => pc.istanza.attiva({ modo: s.modo })) : { ok: true };
        if (r.errore) { dì(`  ${pc.nome}: non riesce (${r.errore.message})`); return; }
        if (!r.ok) return;
        pc.unito = true;
        if (s.modo === 'nuovo') {
          mondo.sincronizzato = true;   // la migrazione da dati.json deve conservare tutto
          // il dati.json minimo lasciato da una migrazione (⊕7, lode2) non ha dati dello studente: non c'è niente da conservare
          const v = await vista(pc), P = proiezione(v), P0 = Dprima?.v === 1 && !Dprima.lode2 ? proiezione(Dprima) : null;
          if (v && !v.bloccato && P0) for (const [k, x] of P0) if (P.get(k) !== x) violazione('migrazione', `${pc.nome}: dopo la migrazione ${k} = ${P.get(k) ?? '(niente)'} invece di ${x}`);
        }
        return;
      }
      case 'op': {
        if (!pc.unito) return;
        if (!pc.acceso && (await avvia(pc)).crash) return;   // lo studente apre Lode per fare quella cosa
        if (!pc.acceso) return;
        if (s.op.da === 'obsidian') return obsidian(pc, s, i);
        // forza: la barra non sa che i dati sono bloccati (catalogo #10, #29, #43) e manda lo stesso la modifica
        let v = await vista(pc); if (!v || (v.bloccato && !s.forza)) return;
        if (v.bloccato) v = {};
        // il giorno di un ripasso è la data locale di QUESTO computer (il suo orologio, anche se sbagliato)
        const op = risolvi(s.op.tipo === 'ripassaCarta' ? { ...s.op, giorno: new Date(mondo.t + pc.scarto).toISOString().slice(0, 10) } : s.op, v); if (!op) return;
        dì(`${i}. ${pc.nome}: lo studente ${descrivi(op)}${pc.smesso ? ' (dopo «Smetti»: resta su questo computer)' : ''}`);
        // ritocco (c): dopo «Smetti» le operazioni di questo computer non si aspettano sugli altri (non entrano nel modello)
        const rec = pc.smesso ? { finta: true } : modello.registra(pc.nome, op, v, mondo.t);
        pc.intreccio = s.intreccio ? { r: caso(semeDi(`${storia.seme}|i${i}`)), p: s.intreccio, meta: s.meta ?? 0.3 } : null;
        const r = await chiama(pc, 'modifica', () => pc.istanza.modifica(op));
        pc.intreccio = null;
        if (r.ok && !r.r?.rifiutata) { if (!rec.finta) modello.conferma(rec); }
        else if (s.ritenta && !r.crash && !rec.finta) { pc.daRitentare.push(s.op); modello.annulla?.(rec); dì(`  ${pc.nome}: non riuscita (${r.errore?.message || 'rifiutata'}): la barra la rimanderà`); }
        else if (r.errore) dì(`  ${pc.nome}: rifiutata (${r.errore.message})`);
        else if (r.r?.rifiutata) dì(`  ${pc.nome}: rifiutata`);
        return;
      }
      case 'vecchia': {   // un computer con la versione di Lode di prima: legge dati.json (o parte vuoto), cambia, riscrive
        let D; try { D = JSON.parse(pc.disco.crudo.leggi('vault/.lode/dati.json')?.toString('utf8')); } catch { D = null; }
        // come unisci() di js/dati.js di main: i predefiniti sotto, e i campi che non conosce (lode2) restano dentro
        const base = { v: 1, esami: [], carte: [], orario: [], profilo: {}, imp: {}, memoria: {}, codice: { errori: {} } };
        D = D && typeof D === 'object' ? { ...base, ...D } : base;
        const op = risolvi(s.op, D); if (!op) return;
        dì(`${i}. ${pc.nome} (Lode di prima, scrive dati.json): lo studente ${descrivi(op)}`);
        const rec = modello.registra(pc.nome, op, D, mondo.t);
        applicaOp(D, op); const testo = JSON.stringify(D, null, 1); pc.disco.crudo.scrivi('vault/.lode/dati.json', testo, 'studente'); mondo.vecchie.add(testo);
        // per scelta (docs: «tutti i computer vanno aggiornati prima»), la modifica di una versione vecchia può restare da
        // parte (una copia segnalata): non è confermata. Quello che conta è che non cancelli niente. s.conferma: invece sì
        if (s.conferma) modello.conferma(rec); return;
      }
      case 'guasto': { const dove = sel(pc, s.dove); if (!dove) return; pc.disco.guasta(dove, s.codice || 'EIO', s.quale || 'leggi'); dì(`${i}. ${pc.nome}: ${s.quale === 'scrivi' ? 'le scritture' : 'le letture'} in ${dove} falliscono (${s.codice || 'EIO'})`); return; }
      case 'ripara': { dì(`${i}. ${pc.nome}: il disco torna a posto`); await ripara(pc); return; }
      case 'arrivati': if (pc.acceso) { dì(`${i}. ${pc.nome}: il watcher avvisa il motore`); const r = await chiama(pc, 'arrivati', () => pc.istanza.arrivati()); if (r.errore && pc.disco.guasti.length) dì(`  ${pc.nome}: il giro non riesce (${r.errore.code || r.errore.message}): il main lo riprova`); else if (r.errore) violazione('eccezione', `${pc.nome}: arrivati() lancia: ${r.errore.message}`); } return;
      case 'carica': { const f = relSel(pc, s.file), l = cloud.sporchi(pc.nome), rel = s.file ? f && l.find(r => r.startsWith(f)) : sceglie(l, s.quale); if (rel && cloud.carica(pc.nome, rel, { vince: s.vince })) dì(`${i}. cloud: ${cloud.descr.at(-1)}`); return; }
      case 'consegna': { const f = relSel(pc, s.file), l = cloud.inArrivo(pc.nome), rel = s.file ? f && l.find(r => r.startsWith(f)) : sceglie(l, s.quale); const r = rel && cloud.consegna(pc.nome, rel, { modo: s.modo, frazione: s.frazione ?? 0.5 }); if (r && !r.rimandato) dì(`${i}. cloud: ${cloud.descr.at(-1)}`); return; }
      case 'scarica': { const f = relSel(pc, s.file), l = cloud.segnaposti(pc.nome), rel = s.file ? f && l.find(r => r.startsWith(f)) : sceglie(l, s.quale); if (rel && cloud.scarica(pc.nome, rel)) dì(`${i}. cloud: ${cloud.descr.at(-1)}`); return; }
      case 'togli': { const f = relSel(pcs.get(s.di) || pc, s.file), l = pc.disco.crudo.elenco('vault').map(p => p.slice(6)).filter(r => !/\.icloud$/.test(r) && (!s.dove || r.startsWith(s.dove))); const rel = s.file ? f && l.find(r => r.startsWith(f)) : sceglie(l, s.quale); if (rel && cloud.togli(pc.nome, rel)) dì(`${i}. cloud: ${cloud.descr.at(-1)}`); return; }
      case 'spegni': if (pc.acceso) { dì(`${i}. ${pc.nome}: lo studente chiude Lode`); const r = await chiama(pc, 'chiudi', async () => pc.istanza.chiudi?.()); if (!r.crash) { pc.acceso = false; pc.istanza = null; } } return;
      case 'uccidi': if (pc.acceso) { dì(`${i}. ${pc.nome}: Lode viene ucciso (corrente, crash)`); morte(pc); } return;
      case 'crash': pc.disco.armaCrash(s.dopo, { meta: s.meta, frazione: s.frazione ?? 0.5 }); dì(`${i}. ${pc.nome}: il processo morirà alla ${s.dopo}ª scrittura${s.meta ? ' (a metà file)' : ''}`); return;
      case 'accendi': if (!pc.acceso && (pc.unito || s.forza)) { dì(`${i}. ${pc.nome}: lo studente apre Lode`); await avvia(pc); } return;
      case 'cifra': {
        if (!pc.acceso || !pc.unito || !pc.istanza.cifra) return;
        dì(`${i}. ${pc.nome}: lo studente accende la cifratura con una password`);
        mondo.passwords.add(s.password);   // la sa anche se Lode muore a metà: il vault può essere già cifrato
        const r = await chiama(pc, 'cifra', () => pc.istanza.cifra(s.password));
        // dopo «Smetti» il vault di questo computer è fuori dal cloud: la sua cifratura non riguarda la cartella cloud
        if (r.ok && !r.r?.rifiutata && !pc.smesso) { mondo.password = s.password; mondo.passwords.add(s.password); mondo.cifrataDa ??= cloud.cronologia.length; pc.informato = true; }
        else if (r.errore) dì(`  rifiutata: ${r.errore.message}`);
        return;
      }
      case 'sblocca': {
        if (!pc.acceso || !pc.istanza?.sblocca) return;
        // ritocco (b): lo studente le conosce tutte, e prova quelle che ha usato finché una va
        const tutte = s.password ? [s.password] : [...new Set([mondo.password, ...[...mondo.passwords].reverse()].filter(Boolean))];
        for (const pw of tutte) {
          const v = await vista(pc); if (!v?.bloccato || !pc.acceso) return;
          dì(`${i}. ${pc.nome}: lo studente scrive la password`);
          const r = await chiama(pc, 'sblocca', () => pc.istanza.sblocca(pw)); if (r.errore) dì(`  ${pc.nome}: ${r.errore.message}`);
        }
        return;
      }
      case 'smetti': if (pc.acceso && pc.istanza?.smetti) {
        dì(`${i}. ${pc.nome}: «Smetti di sincronizzare»`);
        // ritocco (c): si smette verso una cartella fuori dal cloud (fuori/). Gli altri continuano fra loro (cifrati se lo erano):
        // la proprietà sulla cifratura resta. Un rifiuto non cambia niente
        const r = await chiama(pc, 'smetti', () => pc.istanza.smetti({ destinazione: 'fuori' })); if (r.errore) dì(`  ${pc.nome}: ${r.errore.message}`);
        if (r.ok && !r.r?.rifiutata) pc.smesso = true;
      } return;
      case 'corrompi': {   // un file scritto dal motore si rovina (un bit, o tagliato)
        const dove = sel(pc, s.dove); if (s.dove && !dove) return;
        // non i temporanei, e non le copie messe da parte (copie/: Lode non le rilegge mai, rovinarle non prova niente e
        // cancellerebbe la prova che il motore aveva conservato i byte)
        const l = [...pc.disco.scrittiDalMotore.keys()].filter(p => pc.disco.crudo.esiste(p) && (!dove || p.startsWith(dove)) && !/\.tmp-/.test(p) && !/\/copie\//.test(p)).sort(), p = sceglie(l, s.quale);
        if (!p) return;
        const prima = Buffer.from(pc.disco.crudo.leggi(p)), b = Buffer.from(prima), k = Math.floor(b.length / 2);
        const nuovo = s.modo === 'tronca' ? b.subarray(0, k) : (b[k] ^= 0x04, b);
        pc.disco.crudo.scrivi(p, nuovo, 'studente');
        // un file già rovinato (e non ancora riscritto dal motore) che il disco rovina di nuovo: i byte di prima li ha tolti il
        // disco, non il motore
        for (const c of mondo.corrotti) if (c.pc === pc.nome && c.p === p && prima.equals(c.dati)) c.superato = true;
        // rovinato due volte nello stesso punto = tornato come l'aveva scritto il motore: non è più rovinato
        if (pc.disco.scrittiDalMotore.get(p)?.equals(nuovo)) { pc.disco.osservati.delete(p); dì(`${i}. ${pc.nome}: ${p} torna com'era`); return; }
        // l'osservazione è di QUESTI byte: se il file si rovina di nuovo prima che il motore lo legga, questa resta non letta
        const oss = { dati: Buffer.from(nuovo), letto: false };
        mondo.corrotti.push({ pc: pc.nome, p, dati: Buffer.from(nuovo), oss, tronca: s.modo === 'tronca' }); mondo.rovinati = true;
        pc.disco.osservati.set(p, oss);
        dì(`${i}. ${pc.nome}: ${p} si rovina (${s.modo === 'tronca' ? 'tagliato a metà' : 'un bit cambiato'})`); return;
      }
      case 'ricorda': {   // questi file (di questo computer) contengono dati che devono restare da qualche parte sul suo disco
        const dove = sel(pc, s.dove); if (!dove) return;
        for (const p of pc.disco.crudo.elenco(dove)) mondo.corrotti.push({ pc: pc.nome, p, dati: Buffer.from(pc.disco.crudo.leggi(p)), sempre: true });
        dì(`${i}. (si ricordano i byte di ${s.dove} su ${pc.nome})`); return;
      }
      case 'copiaDati': {   // la cartella dei dati di Lode copiata su un altro computer (Migrazione Assistita): stesso id
        const da = pcs.get(s.da);
        for (const p of da.disco.crudo.elenco('dati')) pc.disco.crudo.scrivi(p, da.disco.crudo.leggi(p), 'studente');
        dì(`${i}. la cartella dei dati di Lode di ${s.da} viene copiata su ${pc.nome}`); return;
      }
      case 'ricordaVersione': {   // per rimetterla dopo (cestino o cronologia del servizio, o chi scrive nella cartella)
        const dove = sel(pcs.get(s.di) || pc, s.dove); if (!dove) return;
        mondo.versioni ||= new Map(); mondo.versioni.set(s.nome, pc.disco.crudo.elenco(dove).map(p => [p, Buffer.from(pc.disco.crudo.leggi(p))]));
        return;
      }
      case 'rimettiVersione': {
        for (const [p, d] of mondo.versioni?.get(s.nome) || []) pc.disco.crudo.scrivi(p, d, 'studente');
        dì(`${i}. ${pc.nome}: qualcuno rimette nel vault la versione «${s.nome}» (${(mondo.versioni?.get(s.nome) || []).map(([p]) => p.slice(6)).join(', ')})`); return;
      }
      case 'caricaTutto': { let n = 0; for (const rel of cloud.sporchi(pc.nome)) if (cloud.carica(pc.nome, rel, { vince: s.vince || 'server' })) n++; if (n) dì(`${i}. cloud: carica tutto quello che ${pc.nome} ha cambiato (${n} file)`); return; }
      case 'consegnaTutto': {
        const chi = pcs.get(s.di) || pc;   // i selettori si risolvono sul computer che ha scritto quei file
        const tranne = (s.tranne || []).map(t => relSel(chi, t)).filter(Boolean), come = Object.entries(s.come || {}).map(([k, m]) => [relSel(chi, k), m]).filter(([k]) => k);
        const l = cloud.inArrivo(pc.nome).filter(r => !tranne.some(t => r.startsWith(t)));
        for (const rel of l) cloud.consegna(pc.nome, rel, { modo: come.find(([k]) => rel.startsWith(k))?.[1] || 'intero' });
        if (l.length) dì(`${i}. cloud: a ${pc.nome} arriva tutto${s.tranne ? ` tranne ${s.tranne.join(', ')}` : ''}${s.come ? ` (${Object.entries(s.come).map(([k, m]) => `${k}: ${m}`).join(', ')})` : ''}`); return;
      }
      case 'scrivi': pc.disco.crudo.scrivi(s.p, s.testo, 'studente'); dì(`${i}. ${pc.nome}: qualcuno scrive ${s.p}`); return;
      // chi può scrivere nella cartella cloud (e magari conosce una password di prima) scrive file fatti ad arte nel vault di pc:
      // s.file({ elenco, leggi }) → [[percorso nel vault, testo]…] (serve il formato del motore: lo scenario lo calcola)
      case 'inietta': for (const [rel, testo] of s.file({ elenco: () => pc.disco.crudo.elenco('vault').map(x => x.slice(6)), leggi: r => pc.disco.crudo.leggi(`vault/${r}`)?.toString('utf8') ?? null }) || []) {
        pc.disco.crudo.scrivi(`vault/${rel}`, testo, 'studente'); dì(`${i}. ${pc.nome}: qualcuno infila ${rel} (${s.come || 'a mano'})`);
      } return;
      // «Importa le aggiunte» (6.7, §8.3): i record di un altro primo avvio o di un dati.json scritto da una Lode vecchia
      case 'importa': if (pc.acceso && pc.istanza?.importaAggiunte) { dì(`${i}. ${pc.nome}: lo studente sceglie «Importa le aggiunte»`); await chiama(pc, 'importaAggiunte', () => pc.istanza.importaAggiunte()); } return;
      // lo studente salva Orario.md in Obsidian MENTRE il motore lo riscrive: fra la lettura del file e la sua scrittura (il giro
      // parte 1,5 s dopo un salvataggio, e Obsidian salva ogni 2 s circa). Il salvataggio di Obsidian è confermato da Obsidian
      case 'obsidianNelMezzo': {
        if (!pc.acceso) return;
        let armato = false;
        pc.trappola = async (o, p) => {
          if (o === 'readFile' && p === 'vault/Orario.md') { armato = true; return; }
          if (!armato || !['writeFile', 'rename'].includes(o)) return;
          pc.trappola = null;
          const t = pc.disco.crudo.leggi('vault/Orario.md'); if (!t) return;
          const Dfile = { orario: leggiOrario(t.toString('utf8')) }, op = risolvi(s.op, Dfile); if (!op) return;
          dì(`${i}. ${pc.nome}: lo studente ${descrivi(op)} in Obsidian mentre Lode scrive (${o} ${p})`);
          const rec = modello.registra(pc.nome, op, Dfile, mondo.t); applicaOp(Dfile, op);
          const coda = t.toString('utf8').match(/\n(<!--[^\n]*-->\s*)$/)?.[1] || '';
          pc.disco.crudo.scrivi('vault/Orario.md', orarioMd(Dfile.orario) + coda, 'studente');
          modello.conferma(rec);
        };
        dì(`${i}. ${pc.nome}: il watcher avvisa il motore (e Obsidian salva nel mezzo)`);
        await chiama(pc, 'arrivati', () => pc.istanza.arrivati()); pc.trappola = null; return;
      }
      // chi può scrivere nella cartella cloud cambia un file JSON del vault di pc (gruppo.json: la cifratura tolta, la fonte
      // cambiata). s.dove: un'espressione regolare sui percorsi; s.cambia(j) → il JSON nuovo, o null per lasciarlo com'è
      case 'manometti': for (const q of pc.disco.crudo.elenco('vault').filter(x => s.dove.test(x))) {
        let j; try { j = JSON.parse(pc.disco.crudo.leggi(q).toString('utf8')); } catch { continue; }
        const n = s.cambia(j); if (!n) continue;
        pc.disco.crudo.scrivi(q, JSON.stringify(n), 'studente'); dì(`${i}. ${pc.nome}: qualcuno cambia ${q} (${s.come || 'a mano'})`);
      } return;
      case 'cancella': { const q = sel(pcs.get(s.di) || pc, s.p); if (q) { for (const p of pc.disco.crudo.elenco(q)) pc.disco.crudo.togli(p, 'studente'); for (const d of [...pc.disco.dirs]) if (d === q || d.startsWith(q + '/')) pc.disco.dirs.delete(d); } }   // come rm -rf dì(`${i}. ${pc.nome}: qualcuno cancella ${s.p}`); return;
      case 'quiete': dì(`${i}. tutto si ferma e arriva dappertutto`); await quiete(); return;
      case 'toglila': if (pc.acceso && pc.istanza?.toglila) { dì(`${i}. ${pc.nome}: «Toglila» (la copia in chiaro di un computer che non torna)`); const r = await chiama(pc, 'toglila', () => pc.istanza.toglila()); if (r.errore) violazione('eccezione', `${pc.nome}: toglila() lancia: ${r.errore.message}`); } return;
      // «Dimentica la password qui» su pc (il portachiavi si svuota, la sessione aperta no), oppure, senza pc, lo studente
      // dimentica tutte le password e nessun portachiavi le ricorda più (10.5: la password dimenticata davvero)
      case 'dimentica':
        if (pc) { pc.chiavi.clear(); dì(`${i}. ${pc.nome}: «Dimentica la password qui»`); return; }
        mondo.passwords.clear(); mondo.password = null; for (const x of pcs.values()) x.chiavi.clear(); dì(`${i}. lo studente dimentica le password (e nessun portachiavi le ricorda)`); return;
      // la radice della catena dei gruppi (gruppo.json con precedente null) tolta dal disco di pc: cancellata con la sua cartella
      // (dallo studente, o «Toglila»), oppure solo gruppo.json come segnaposto (come: 'segnaposto')
      case 'radice': {
        const radici = pc.disco.crudo.elenco('vault/.lode/sync').filter(p => /^vault\/\.lode\/sync\/[^/]+\/gruppo\.json$/.test(p)).filter(p => { try { return JSON.parse(pc.disco.crudo.leggi(p).toString('utf8')).precedente == null; } catch { return false; } });
        for (const p of radici) {
          if (s.come === 'segnaposto') { if (cloud.togli(pc.nome, p.slice(6))) dì(`${i}. cloud: ${cloud.descr.at(-1)}`); }
          else { const q = p.slice(0, p.lastIndexOf('/')); for (const f of pc.disco.crudo.elenco(q)) pc.disco.crudo.togli(f, 'studente'); for (const d of [...pc.disco.dirs]) if (d === q || d.startsWith(q + '/')) pc.disco.dirs.delete(d); dì(`${i}. ${pc.nome}: qualcuno cancella ${q}`); }
        }
        return;
      }
      // il computer muore per sempre (rubato, disco rotto): non torna, non si controlla più; quello che aveva confermato deve
      // restare sugli altri
      case 'muori': if (s.quiete) { dì(`${i}. tutto si ferma e arriva dappertutto`); await quiete(); } dì(`${i}. ${pc.nome} muore per sempre`); morte(pc); pc.unito = false; pc.morto = true; cloud.online(pc.nome, false); return;
      default: throw new Error('passo sconosciuto: ' + s.t);
    }
  }
  // lo studente cambia Orario.md in Obsidian (sul disco di quel computer); il watcher avvisa subito Lode
  async function obsidian(pc, s, i) {
    if (!pc.disco.crudo.leggi('vault/Orario.md')) return;   // non c'è (o è un segnaposto): non si apre
    // quello che il cloud ha portato prima l'ha già visto il watcher (nella vita vera passano secondi, lo studente è più lento)
    await chiama(pc, 'arrivati', () => pc.istanza.arrivati());
    if (!pc.acceso) return;
    const t = pc.disco.crudo.leggi('vault/Orario.md'); if (!t) return;
    // un file arrivato a metà (l'ultima riga senza a capo) è ancora in download: lo studente non lo apre
    if (t.length && t[t.length - 1] !== 0x0a) return;
    const righe = leggiOrario(t.toString('utf8')), Dfile = { orario: righe };
    const op = risolvi(s.op, Dfile); if (!op) return;
    if (op.tipo === 'aggiungiLezione' && righe.some(o => chiaveLezione(o) === chiaveLezione(op.lezione))) return;
    dì(`${i}. ${pc.nome}: lo studente ${descrivi(op)}`);
    const rec = modello.registra(pc.nome, op, Dfile, mondo.t);
    applicaOp(Dfile, op);
    // Obsidian cambia la tabella e lascia stare il resto: un commento in fondo al file (il marcatore di Lode) resta com'era
    const coda = t.toString('utf8').match(/\n(<!--[^\n]*-->\s*)$/)?.[1] || '';
    pc.disco.crudo.scrivi('vault/Orario.md', orarioMd(Dfile.orario) + coda, 'studente');
    // ritocco (h): da un Orario.md senza il marcatore di Lode una riga tolta non si applica da sola (Lode la propone:
    // «Queste lezioni non sono più in Orario.md: [toglile] [lasciale]», #40): lo studente non l'ha ancora confermata
    if (op.tipo === 'togliLezione' && !coda) { await chiama(pc, 'arrivati', () => pc.istanza.arrivati({ orario: 'studente' })); return; }
    // { orario: 'studente' }: un aiuto che il watcher vero non ha (non sa chi ha scritto il file). I motori veri lo ignorano;
    // al motore banale serve per non scambiare un Orario.md arrivato dal cloud per una modifica fatta qui
    const r = await chiama(pc, 'arrivati', () => pc.istanza.arrivati({ orario: 'studente' }));
    if (r.ok) modello.conferma(rec);
  }
  // il guasto finisce; la barra rimanda le operazioni che non erano riuscite (col segno «ritenta»)
  async function ripara(pc) {
    pc.disco.ripara();
    if (!pc.daRitentare.length || pc.morto) return;
    if (!pc.acceso && pc.unito && (await avvia(pc)).crash) return;
    if (!pc.acceso) return;
    for (const o of pc.daRitentare.splice(0)) {
      const v = await vista(pc); if (!v || v.bloccato) continue;
      const op2 = risolvi(o, v); if (!op2) continue;
      const rec = modello.registra(pc.nome, op2, v, mondo.t);
      const r = await chiama(pc, 'modifica', () => pc.istanza.modifica(op2));
      if (r.ok && !r.r?.rifiutata) { modello.conferma(rec); dì(`  ${pc.nome}: la barra rimanda: ${descrivi(op2)}`); }
    }
  }
  // tutti accesi, in rete, password scritta, nessun guasto: si carica e si consegna tutto, finché niente si muove più
  async function quiete() {
    for (const pc of pcs.values()) { pc.disco.disarma(); if (pc.disco.guasti.length) await ripara(pc); if (!pc.morto) cloud.online(pc.nome, true); }
    for (const pc of pcs.values()) if (pc.unito && !pc.acceso) await avvia(pc);
    let fermo = false;
    const prove = new Map();
    for (let giro = 0; giro < 40 && !fermo; giro++) {
      let mosse = 0;
      mondo.t += 1000;
      // chi non si era ancora unito (il vault non era arrivato) ci riprova quando .lode è arrivato (al massimo 3 volte)
      if (mondo.sincronizzato) for (const pc of pcs.values()) if (!pc.unito && !pc.morto && (prove.get(pc) || 0) < 3 && pc.disco.crudo.elenco('vault/.lode').length) { prove.set(pc, (prove.get(pc) || 0) + 1); await passo({ t: 'attiva', pc: pc.nome, modo: 'unisciti' }, 'q'); mosse++; }
      for (const pc of pcs.values()) {
        // lo studente scrive la password (tutte quelle che ha usato, se una non va)
        for (const pw of [...mondo.passwords].reverse()) { if (!pc.acceso || !pc.istanza?.sblocca) break; const v = await vista(pc); if (!v?.bloccato) break; await chiama(pc, 'sblocca', () => pc.istanza.sblocca(pw)); }
      }
      for (const n of nomi) for (const rel of cloud.sporchi(n)) if (cloud.carica(n, rel, { vince: 'server' })) mosse++;
      for (const n of nomi) for (const rel of cloud.segnaposti(n)) if (cloud.scarica(n, rel)) mosse++;
      for (const n of nomi) for (const rel of cloud.inArrivo(n)) { const r = cloud.consegna(n, rel); if (r && !r.rimandato) mosse++; }
      for (const pc of pcs.values()) if (pc.acceso) { const r = await chiama(pc, 'arrivati', () => pc.istanza.arrivati()); if (r.errore) violazione('eccezione', `${pc.nome}: arrivati() lancia: ${r.errore.message}`); }
      fermo = !mosse && nomi.filter(n => !pcs.get(n).morto).every(n => !cloud.sporchi(n).length && !cloud.inArrivo(n).length && !cloud.segnaposti(n).length);
    }
    if (!fermo) violazione('quiete', 'dopo 40 giri il mondo non si ferma: i motori continuano a scrivere');
  }

  // ---- la storia ----
  for (const [i, s] of storia.passi.entries()) {
    mondo.t += 1000;   // ogni gesto dello studente o del cloud prende almeno un secondo (le date dei file non coincidono)
    try { await passo(s, i + 1); } catch (x) { if (!x?.crash) violazione('simulatore', `passo ${i + 1} (${s.t}): ${x.stack}`); }
  }
  dì('— quiete finale —');
  await quiete();

  // ---- le proprietà ----
  const viste = [];
  for (const pc of pcs.values()) {
    if (!pc.unito || pc.smesso) continue;   // dopo «Smetti» un computer va per conto suo (ritocco c)
    if (!pc.acceso) { violazione('quiete', `${pc.nome}: il motore non riparte`); continue; }
    const v = await vista(pc);
    if (!v || v.bloccato) { violazione('bloccato', `${pc.nome}: dopo la quiete i dati sono ancora bloccati${v?.motivo ? ` (${v.motivo})` : ''}`); continue; }
    let conflitti = null; try { conflitti = new Set(pc.istanza.conflitti?.() || []); } catch { }
    viste.push({ pc, P: proiezione(v), v, conflitti });
  }
  if (viste.length > 1 && !(rilassa && mondo.rovinati)) {
    const [a, ...resto] = viste;
    for (const b of resto) if (testoProiezione(a.P) !== testoProiezione(b.P)) {
      const diff = [...new Set([...a.P.keys(), ...b.P.keys()])].filter(k => a.P.get(k) !== b.P.get(k)).slice(0, 6).map(k => `${k}: ${a.pc.nome}=${a.P.get(k) ?? '(niente)'} ${b.pc.nome}=${b.P.get(k) ?? '(niente)'}`);
      violazione('convergenza', `${a.pc.nome} e ${b.pc.nome} vedono cose diverse: ${diff.join('; ')}`);
    }
  }
  const visti = new Set();
  if (rilassa && mondo.rovinati) { for (let k = violazioni.length - 1; k >= 0; k--) if (['convergenza', 'bloccato', 'quiete'].includes(violazioni[k].proprieta)) violazioni.splice(k, 1); viste.length = 0; }
  for (const { pc, P, conflitti } of viste) for (const x of modello.verifica(P, pc.nome, { conflitti })) { const k = x.proprieta + x.testo.slice(x.testo.indexOf(':')); if (!visti.has(k)) { visti.add(k); violazione(x.proprieta, x.testo); } }
  for (const pc of pcs.values()) for (const x of pc.disco.violazioni) violazione('fuori dalle cartelle', `${pc.nome}: ${x.op} ${x.percorso}`);
  // §8.3: il dati.json scritto da una Lode vecchia è ancora nel vault (nessuna migrazione l'ha preso): quello che lo studente ci ha
  // fatto non è nel diario, e almeno un computer deve dirlo («Dati da una Lode vecchia»). Solo per i motori che hanno stato()
  const dj = cloud.contenuto().find(f => f.rel === '.lode/dati.json');
  if (dj?.dati && mondo.vecchie.has(dj.dati.toString('utf8'))) {
    const conStato = viste.filter(x => typeof x.pc.istanza?.stato === 'function');
    if (conStato.length && !conStato.some(x => { try { return (x.pc.istanza.stato().avvisi || []).includes('lode_vecchia'); } catch { return false; } }))
      violazione('lode vecchia', 'nel vault c\'è il dati.json scritto da una Lode vecchia e nessun computer lo dice (avviso lode_vecchia)');
  }
  if (mondo.password || mondo.cifrataDa != null) {
    // il residuo dichiarato (§10.6, §11): la cartella in chiaro di un computer che non torna (morto per sempre, o dopo «Smetti»)
    // resta nel gruppo vecchio finché lo studente non fa «Toglila». Conta solo se l'autore è quel computer e la cartella è la sua
    const residuo = f => { const pc = pcs.get(f.autore); return !!pc && (pc.morto || pc.smesso) && /^\.lode\/sync\/[^/]+\/[^/]+\/[^/]+$/.test(f.rel) && !/\.json$/.test(f.rel); };
    if (mondo.password) for (const f of cloud.contenuto()) if (f.rel.startsWith('.lode/') && contieneMarcatore(f.dati) && !residuo(f)) violazione('cifratura', `nella cartella cloud, con la cifratura accesa, ${f.rel} (di ${f.autore}) ha dati in chiaro`);
    const dopo = new Set();
    for (const f of cloud.cronologia.slice(mondo.cifrataDa ?? 0, mondo.cifrataFino ?? Infinity)) if (f.dati && f.rel.startsWith('.lode/') && contieneMarcatore(f.dati) && !dopo.has(f.rel) && mondo.inChiaro.has(`${f.autore}|${f.dati.toString('base64')}`)) { dopo.add(f.rel); violazione('cifratura (cronologia)', `${f.rel} caricato in chiaro da ${f.autore} DOPO l'accensione della cifratura (resta nella cronologia del servizio)`); }
  }
  // un file rovinato conta solo se il motore l'ha letto così (e quindi sapeva di non capirlo): riscrivere alla cieca il proprio
  // file mentre si tiene tutto in memoria va bene. Quelli ricordati con «ricorda» devono restare comunque
  for (const c of mondo.corrotti) {
    // un file tagliato a metà che il motore ha letto e poi allungato (un diario in sola aggiunta) è ancora lì, come inizio
    const d = pcs.get(c.pc).disco, ancora = d.crudo.elenco().some(p => { const x = d.crudo.leggi(p); return x.equals(c.dati) || (c.tronca && x.length > c.dati.length && x.subarray(0, c.dati.length).equals(c.dati)); });
    if (!ancora && !c.superato && (c.sempre || (c.oss || d.osservati.get(c.p))?.letto)) violazione('propri file illeggibili', `${c.pc}: ${c.p} non si leggeva e il motore l'ha riscritto senza tenerne una copia (doveva bloccarsi o metterlo da parte)`);
  }
  mondoAttuale = null;
  return { violazioni, racconto, viste, modello, cloud, pcs };
}

export function durata(ms) {
  const a = Math.abs(ms);
  if (a >= 864e5) return `${Math.round(a / 864e5)} giorni`;
  if (a >= 36e5) return `${Math.round(a / 36e5)} ore`;
  if (a >= 6e4) return `${Math.round(a / 6e4)} minuti`;
  return `${Math.round(a / 1000)} secondi`;
}
export { Crash };
