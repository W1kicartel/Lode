// Il motore della sincronizzazione v2 (docs/SINCRONIZZAZIONE.md). Usa solo fs (le funzioni di node:fs/promises che servono),
// orologio() e casuale(): niente Date.now, Math.random, timer, Electron. Il main lo chiama come il simulatore
// (test/sync-sim/mondo.mjs): apri() all'avvio, arrivati() dal watcher e ogni tanto, modifica() per ogni gesto, chiudi().
//
// Sul computer, in <dati>/sync/:
//   macchina.json             { impronta }  (⊕1: se cambia, dev nuovo prima di pubblicare)
//   corrente.json             { gruppo, modo, vault, lasciati:[{g,dev}] }  il gruppo di adesso e le cartelle da togliere nei vecchi
//   <g>/stato.json            { dev, creatore, visto, seq, rig?, daFinire?, precedenti? }  (precedenti: i miei dev di prima in <g>)
//   <g>/pubblicati.json       { dev, voci: { n: { conta, firma } } }  i miei contenitori già controllati nel vault (§4)
//   <g>/gruppo.json           la copia di gruppo.json
//   <g>/miei/<n>.jsonl        il diario (autorità): gli eventi da pubblicare nel contenitore n di questo computer
//   <g>/altri/<dev>/<file>.jsonl  gli eventi letti dal vault (nessuna piega dipende dal vault); <gruppo vecchio>-<dev>/ per
//                             quelli letti nei gruppi antenati e nei fratelli perdenti (§10.6, 10.4.5)
//   copie/                    tutto quello che Lode mette da parte: mai cancellato da Lode
// I json di Lode hanno la forma { dati, sha }: se lo sha non torna il file va in copie/ e si ricostruisce.
// Nel vault: .lode/sync/<g>/gruppo.json, .lode/sync/<g>/<dev>/<n>.seg, .lode/sync/<g>/sostituito*.json, .lode/dati.json minimo.
import { randomBytes } from 'node:crypto';
import { piegatore, pieghevole, vista as vistaDi, meta as metaDi, conImpronta, confronta, canonico, sha, tMax, valida, TIPI } from './piega.mjs';
import { KDF, nuovaCifratura, provaPassword, chiudi as chiudiBlocco, apri as apriBlocco } from './cifra.mjs';
import { scriviContenitore, leggiContenitore } from './contenitore.mjs';
import { testoOrario, eventiDaOrario, sopra, idLezione, rimarca } from './orario.mjs';
import { LISTE, VUOTO } from './schema.mjs';

const SEG_MAX = 64 * 1024;
const SEGNAPOSTO = /^\..+\.icloud$/, SOSTITUITO = /^sostituito.*\.json$/, TMP = /\.tmp-/;
export const MINIMO = gruppo => ({ v: 1, lode2: { gruppo }, profilo: { nome: 'Aggiorna Lode: i dati ora sono nel diario di Lode 2' }, benvenuto: true });
const NOTA = `# Aggiorna Lode su tutti i computer

I dati di Lode ora stanno nel diario di Lode 2. Una versione vecchia di Lode, aperta su questo vault, mostra «Aggiorna Lode»
invece dei dati: aggiornala prima di usarla. Non si è perso niente.
`;

// la migrazione (8.2): dati.json → eventi importa deterministici. Due computer che migrano lo stesso file danno gli stessi eventi
export function importi(D, fonte) {
  const out = [], ev = x => conImpronta({ dev: 'migrazione', t: [0, 0], k: 0, tipo: 'importa', fonte, ...x });
  for (const lista of LISTE) (Array.isArray(D[lista]) ? D[lista] : []).forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    let { id, ...campi } = r;
    if (lista === 'orario') { campi = { corso: r.corso, giorni: [...(r.giorni || [])], inizio: r.inizio, fine: r.fine, aula: r.aula || '' }; id = idLezione(r); }
    if (typeof id !== 'string' || !id) id = `${lista}-${i}`;
    out.push(ev({ lista, id, campi }));
  });
  const reg = (percorso, valore) => out.push(ev({ percorso, valore }));
  for (const [k, v] of Object.entries(D)) {
    if (k === 'v' || k === 'lode2' || LISTE.includes(k)) continue;
    if (k === 'profilo' || k === 'imp') { for (const [c, x] of Object.entries(v || {})) if (!(k === 'imp' && (c === 'chiave' || c === 'ultimoSuggerimento'))) reg(`${k}/${c}`, x); continue; }
    if (k === 'memoria' && v && typeof v === 'object') { for (const [c, m] of Object.entries(v)) for (const [f, x] of Object.entries(m || {})) reg(`memoria/${c}/${f}`, x); continue; }
    if (k === 'codice' && v && typeof v === 'object') { for (const [c, x] of Object.entries(v)) { if (c === 'errori') for (const [e, n] of Object.entries(x || {})) reg(`codice/errori/${e}`, n); else reg(`codice/${c}`, x); } continue; }
    reg(k, v);
  }
  return out;
}

// attendi(ms): l'unica attesa, fra un tentativo e l'altro di un rename che Windows rifiuta (EPERM, EBUSY: antivirus, indicizzatore).
// La passa il main (con setTimeout); nel simulatore non serve e resta vuota, così il motore non ha timer suoi
// portachiavi: { leggi() → [[gruppo, chiave]…], scrivi(gruppo, chiave | null) } (facoltativo, anche asincrono). Il main lo fa con
// safeStorage (§10.2): all'avvio le chiavi ricordate rientrano tutte, anche quelle dei gruppi antenati (servono per verificare i
// sostituito*.json e per leggere i contenitori rimasti nei gruppi vecchi, §10.4.5, §10.6). Su Linux con basic_text non c'è
// §8.3: il dati.json l'ha scritto una Lode vecchia? Si guarda il contenuto, non la presenza di lode2: la Lode di prima (main
// 0.4.0, js/dati.js) conserva i campi che non conosce, e quindi riscrive dati.json con le modifiche dello studente E con lode2
// ancora dentro (prima l'avviso non arrivava mai). Vecchia = v1 senza lode2, oppure con qualcosa che il minimo non ha: un nome
// diverso da «Aggiorna Lode…», o un campo non vuoto oltre v, lode2, benvenuto e imp (le impostazioni, che la Lode di prima
// riempie da sola con i predefiniti; i numeri e i sì/no dei predefiniti non contano, le liste e i testi sì)
const vuotoV = x => x == null || x === '' || typeof x === 'number' || typeof x === 'boolean' || (Array.isArray(x) ? x.every(vuotoV) : typeof x === 'object' && Object.values(x).every(vuotoV));
export function scrittoDaVecchia(D, gruppo) {
  if (!D || typeof D !== 'object' || D.v !== 1) return false;
  if (!D.lode2) return true;
  const { v, lode2, benvenuto, imp, profilo, ...resto } = D, { nome, ...prof } = profilo || {};
  return (!!nome && nome !== MINIMO(gruppo).profilo.nome) || !vuotoV(prof) || !vuotoV(resto);
}
// §10.2: in un gruppo cifrato gruppo.json è autenticato. cifratura.firma è un blocco GCM con la chiave del gruppo e AAD la forma
// canonica di tutto gruppo.json senza la firma (fonte, precedente, creatore, creato, i parametri e il controllo). Prima il file
// non era autenticato: chi scrive nella cartella cloud metteva «cifratura:null» e un computer nuovo si univa in chiaro e
// pubblicava in chiaro nel gruppo cifrato (I5), o cambiava «fonte» e un computer nuovo, con la password giusta, mostrava una Lode
// senza i dati migrati (I4). La firma si verifica quando la chiave si impara (sblocca, unione, spostamento): un gruppo.json che
// la password apre ma la firma no è manomesso, e la chiave non si impara
const aadGruppo = gj => { const { firma, ...c } = gj.cifratura || {}; return `gruppo|${canonico({ ...gj, cifratura: c })}`; };
export const firmaGruppo = (k, gj) => (gj.cifratura ? { ...gj, cifratura: { ...gj.cifratura, firma: chiudiBlocco(k, gj.id, aadGruppo(gj)) } } : gj);
export const gruppoAutentico = (k, gj) => !gj?.cifratura || (!!k && typeof gj.cifratura.firma === 'string' && apriBlocco(k, gj.cifratura.firma, aadGruppo(gj)) === gj.id);

export function creaMotore({ fs, vault: vaultDato, dati, orologio, casuale, registro = () => { }, macchina = null, parametri = KDF, attendi = async () => { }, portachiavi = null }) {
  const S = `${dati}/sync`, COPIE = `${S}/copie`, G = g => `${S}/${g}`;
  const hex = n => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(casuale() * 16)]).join('');
  const ora = () => Math.floor(orologio());
  let vaultDir = vaultDato;
  const vsync = () => `${vaultDir}/.lode/sync`;

  let cor = null, st = null, grp = null, chiave = null;
  const chiavi = new Map();   // gruppo → chiave: quelle del portachiavi più quelle scritte in questa sessione; mai tolte (servono agli antenati)
  async function impara(g, k) { chiavi.set(g, k); try { await portachiavi?.scrivi?.(g, k); } catch (x) { crash(x); } }
  async function dimenticaTutte() {
    for (const g of [...chiavi.keys()]) { try { await portachiavi?.scrivi?.(g, null); } catch (x) { crash(x); } }
    try { await portachiavi?.svuota?.(); } catch (x) { crash(x); }
    chiavi.clear(); chiave = null;
  }
  let miei = [];   // [{ n, eventi, byte, giorno }]
  const noti = new Map();   // h → evento: diario + altri
  const inGruppo = new Set();   // le h lette dai contenitori del gruppo di adesso
  const letti = new Map(), errati = new Set(), pubblicati = new Map(), gjCache = new Map(), modoAntenati = new Map();
  let pwNascita = null, cacheLocale = null, versioneLocale = 0;   // la password con cui deve nascere il gruppo della migrazione (solo in memoria, mai sul disco)
  let orarioVisto = null, pwUnione = null, esitoUnione = null, pubblicato = false;
  let pieg = null, piegFonte = null, mieiH = null, hlc = [0, 0], stato = 'spento', fermo = false, inArrivo = false, versione = false, piegato = null, Dmigrare = null;
  const avvisi = new Set();

  // ---- disco ----
  const crash = x => { if (x?.crash) throw x; return x; };
  const leggi = async p => { try { return await fs.readFile(p, 'utf8'); } catch (x) { crash(x); return null; } };
  const elenca = async p => { try { return await fs.readdir(p); } catch (x) { crash(x); return null; } };
  const info = async p => { try { return await fs.stat(p); } catch (x) { crash(x); return null; } };
  // Nel computer (<dati>/sync) un errore diverso da «non c'è» (EIO, EACCES, EBUSY di un antivirus o di un backup, EMFILE) non
  // vale «vuoto»: si lancia, e il main mette `fermo` (§5.2, ⊕9). Prima un segmento del diario che non si leggeva all'avvio si
  // saltava, e la prima modifica dopo ne riscriveva il numero con i soli eventi nuovi: gli eventi confermati sparivano (I1).
  // Nel vault invece un file che non si legge è «in arrivo» (il servizio lo sta scrivendo), e si riprova al giro dopo
  const assente = x => ['ENOENT', 'ENOTDIR'].includes(x?.code);
  const leggiQui = async p => { try { return await fs.readFile(p, 'utf8'); } catch (x) { crash(x); if (assente(x)) return null; throw x; } };
  const elencaQui = async p => { try { return await fs.readdir(p); } catch (x) { crash(x); if (assente(x)) return null; throw x; } };
  const infoQui = async p => { try { return await fs.stat(p); } catch (x) { crash(x); if (assente(x)) return null; throw x; } };
  const cartella = p => fs.mkdir(p, { recursive: true });
  async function riprova(f) { for (let i = 0; ; i++) { try { return await f(); } catch (x) { if (x?.crash || i >= 5 || !['EPERM', 'EBUSY'].includes(x?.code)) throw x; await attendi(50 * 2 ** i); } } }   // 50 ms, 100, 200…
  // temporaneo nella stessa cartella e rename: chi legge vede il file vecchio o quello nuovo, mai mezzo
  async function scriviAtomico(p, testo) {
    const i = p.lastIndexOf('/'), dir = p.slice(0, i), tmp = `${dir}/.${p.slice(i + 1)}.tmp-${hex(6)}`;
    await cartella(dir); await fs.writeFile(tmp, testo); await riprova(() => fs.rename(tmp, p));
  }
  const daParte = async (nome, testo) => { await cartella(COPIE); await fs.writeFile(`${COPIE}/${ora()}-${hex(6)}-${nome.replace(/[^\w.-]+/g, '_')}`, testo); };
  const salvaJson = (p, x) => scriviAtomico(p, JSON.stringify({ dati: x, sha: sha(canonico(x), 16) }));
  async function caricaJson(p) {
    const t = await leggiQui(p); if (t == null) return {};
    try { const j = JSON.parse(t); if (j && j.dati && sha(canonico(j.dati), 16) === j.sha) return { dati: j.dati }; } catch { }
    await daParte(p.split('/').slice(-2).join('-'), t); return { rotto: true };
  }
  // la cartella locale di adesso: il gruppo, oppure «attesa» prima di averne uno (Lode è già usabile: §12, benvenuto)
  const qui = () => cor?.gruppo || 'attesa';
  const salvaStato = () => salvaJson(`${G(qui())}/stato.json`, st);
  const salvaCorrente = () => salvaJson(`${S}/corrente.json`, cor);

  // ---- eventi, diario, orologio ibrido ----
  function aggiungiNoto(e) {
    if (noti.has(e.h)) return false;
    noti.set(e.h, e); piegato = null;
    // la piega resta aperta: un evento in coda all'ordine si piega da solo; uno nel passato la fa rifare da zero (§6.2)
    if (pieg && pieghevole(e)) { if (pieg.ultimo && confronta(e, pieg.ultimo) <= 0) pieg = null; else pieg.applica(e); }
    if (e.k === 1) hlc = tMax(hlc, e.t);   // ogni evento visto alza l'orologio (§6.2)
    // §6.2: un evento di un altro computer con un timbro più di un'ora oltre il mio orologio non si scarta, ma si segnala
    if (e.k === 1 && st && e.dev !== st.dev && Array.isArray(e.t) && e.t[0] > orologio() + 36e5) avvisi.add('orologio');
    // gli eventi arrivano qui già validati (righeEventi, leggiContenitore) o fatti dal motore: niente SHA di nuovo (§4, costo)
    if (!TIPI.has(e.tipo) || (e.alg !== undefined && e.alg !== 1)) versione = true;
    return true;
  }
  function prossimoT() { const o = ora(); hlc = o > hlc[0] ? [o, 0] : [hlc[0], hlc[1] + 1]; return hlc; }
  const giornoDi = ms => new Date(ms).toISOString().slice(0, 10);
  function righeEventi(t) {
    const eventi = [], righe = String(t).split('\n'), coda = righe.pop();
    let rotto = !!coda;   // un'ultima riga senza a capo: una scrittura a metà, non confermata (⊕9)
    for (const r of righe) { let e; try { e = JSON.parse(r); } catch { rotto = true; continue; } if (valida(e) === 'malformato') { rotto = true; continue; } eventi.push(e); }
    return { eventi, rotto };
  }
  // I segmenti toccati si preparano su una copia e sostituiscono quelli in memoria solo dopo che la scrittura è riuscita: un
  // evento non confermato (disco pieno, EACCES) non resta in memoria per finire sul disco con la scrittura dopo, mentre il main
  // rimanda la stessa operazione (un contatore contava due volte, e la vista non era la piega del diario: I4)
  async function aggiungiMiei(eventi) {
    if (!eventi.length) return;
    const oggi = giornoDi(ora()), dir = `${G(qui())}/miei`, copie = [];
    let seg = miei.at(-1) || null;
    for (const e of eventi) {
      const b = canonico(e).length + 1;
      // il contenitore si chiude a 64 KB o al cambio di giorno, e da chiuso non cambia più
      if (!seg || (seg.eventi.length && (seg.byte + b > SEG_MAX || seg.giorno !== oggi))) {
        const n = (seg?.n || 0) + 1;
        // un segmento con questo numero c'è già ma non è in memoria (non si leggeva, o è nato dopo il caricamento): mai sopra
        if (await infoQui(`${dir}/${n}.jsonl`)) throw Object.assign(new Error(`il diario ha già ${n}.jsonl ma non l'ho caricato: mi fermo`), { code: 'DIARIO' });
        seg = { n, eventi: [], byte: 0, giorno: oggi, nuovo: true }; copie.push(seg);
      } else if (!copie.includes(seg)) { seg = { ...seg, eventi: [...seg.eventi] }; copie.push(seg); }
      seg.eventi.push(e); seg.byte += b;
    }
    const scritti = [];
    try {
      for (const s of copie) { await scriviAtomico(`${dir}/${s.n}.jsonl`, s.eventi.map(canonico).join('\n') + '\n'); scritti.push(s); }
    } catch (x) {
      crash(x);
      // a metà: i segmenti già scritti tornano com'erano (un nuovo si toglie, uno vecchio si riscrive), così il numero resta libero
      for (const s of scritti) {
        const prima = miei.find(m => m.n === s.n);
        try { if (prima) await scriviAtomico(`${dir}/${s.n}.jsonl`, prima.eventi.map(canonico).join('\n') + '\n'); else await fs.rm(`${dir}/${s.n}.jsonl`, { force: true }); } catch (y) { crash(y); }
      }
      throw x;
    }
    for (const s of copie) { delete s.nuovo; const i = miei.findIndex(m => m.n === s.n); if (i >= 0) miei[i] = s; else miei.push(s); }
    for (const e of eventi) aggiungiNoto(e);
  }
  function piegaOra() {
    if (piegato) return piegato;
    const fonte = grp?.fonte ?? null;
    if (!pieg || piegFonte !== fonte) { pieg = piegatore({ fonte }); piegFonte = fonte; for (const e of [...noti.values()].filter(pieghevole).sort(confronta)) pieg.applica(e); }
    return (piegato = pieg.risultato(noti.size));
  }

  // ---- caricamento ----
  async function caricaGruppo(g) {
    miei = []; noti.clear(); inGruppo.clear(); letti.clear(); errati.clear(); pubblicati.clear(); piegato = null; pieg = null; hlc = [0, 0]; versione = false;
    const s = await caricaJson(`${G(g)}/stato.json`), gj = await caricaJson(`${G(g)}/gruppo.json`);
    grp = gj.dati || null;
    if (!grp) { const v = await gjVault(g); if (v && (!v.cifratura || gruppoAutentico(chiavi.get(g), v))) { grp = v; await salvaJson(`${G(g)}/gruppo.json`, v); } }
    st = s.dati || null;
    if (!st) { st = { dev: hex(16), creatore: false, visto: false, seq: 0 }; if (s.rotto) avvisi.add('clone'); await salvaJson(`${G(g)}/stato.json`, st); }
    chiave = chiavi.get(g) || null;
    await caricaMiei(g);
    // pubblicati: la firma (dimensione:data) e il conteggio dei miei contenitori già controllati nel vault. Si conserva, così
    // all'avvio non si rileggono e decifrano tutti (con anni di dati era il costo maggiore); un file rovinato vale vuoto
    const pj = (await caricaJson(`${G(g)}/pubblicati.json`)).dati;
    if (pj?.dev === st.dev) for (const [n, x] of Object.entries(pj.voci || {})) pubblicati.set(+n, x);
    for (const d of (await elencaQui(`${G(g)}/altri`)) || []) for (const f of (await elencaQui(`${G(g)}/altri/${d}`)) || []) {
      const t = await leggiQui(`${G(g)}/altri/${d}/${f}`); if (t == null) continue;
      const { eventi, rotto } = righeEventi(t);
      if (rotto) await daParte(`altri-${d}-${f}`, t);
      for (const e of eventi) aggiungiNoto(e);
    }
    for (const s2 of miei) for (const e of s2.eventi) aggiungiNoto(e);
    // stato.json rovinato: il dev di prima si è perso con lui, ma il diario è mio e i suoi eventi k=1 lo nominano. Le sue cartelle
    // nei gruppi in chiaro si toglieranno quando si lascia il gruppo (altrimenti restano in chiaro dopo la password)
    if (s.rotto) {
      const vecchi = new Set(miei.flatMap(x => x.eventi.filter(e => e.k === 1 && e.dev !== st.dev).map(e => e.dev)));
      if (vecchi.size) { st.precedenti = [...new Set([...(st.precedenti || []), ...vecchi])]; await salvaJson(`${G(g)}/stato.json`, st); }
    }
  }
  // il diario di g dal disco: ogni segmento deve leggersi (leggiQui lancia per EIO, EACCES…): mai un buco in silenzio
  async function caricaMiei(g) {
    miei = [];
    for (const nome of (await elencaQui(`${G(g)}/miei`)) || []) {
      const m = nome.match(/^(\d+)\.jsonl$/); if (!m) continue;
      const p = `${G(g)}/miei/${nome}`, t = await leggiQui(p); if (t == null) continue;
      const { eventi, rotto } = righeEventi(t);
      if (rotto) await daParte(`miei-${g}-${nome}`, t);   // la coda rotta si tronca al prossimo append: i byte restano qui
      const si = await infoQui(p);
      miei.push({ n: +m[1], eventi, byte: eventi.reduce((x, e) => x + canonico(e).length + 1, 0), giorno: si ? giornoDi(si.mtimeMs) : null });
    }
    miei.sort((a, b) => a.n - b.n);
  }
  async function gjVault(g) {
    if (gjCache.has(g)) return gjCache.get(g);
    const t = await leggi(`${vsync()}/${g}/gruppo.json`); if (t == null) return null;
    try { const j = JSON.parse(t); if (j?.v === 2 && j.id === g) { gjCache.set(g, j); return j; } if (Number(j?.v) > 2) versione = true; } catch { }
    return null;
  }

  // ---- il vault: catena dei gruppi, sparito, spostamenti ----
  // La testa della catena (8.5, 10.4.5). Le radici sono i gruppi con precedente null e quelli il cui precedente nel vault non
  // c'è più (cancellato dallo studente, dal servizio, o tolto con «Toglila»): la catena non dipende dalla cartella della radice.
  // Vince la radice con l'id minore, poi si scende per i sostituito*.json. Restituisce { g, forse } (forse: l'ultimo passo non
  // si può verificare e vuole la password del gruppo nuovo), oppure null se un gruppo che non si legge ancora potrebbe vincere
  async function testa() {
    miei_gruppi = await fidati();
    const nomi = ((await elenca(vsync())) || []).filter(n => !n.startsWith('.'));
    const radici = [], ignoti = [], presenti = new Set();
    for (const n of nomi) { const j = await gjVault(n); if (j) presenti.add(n); else if (!(await vuota(`${vsync()}/${n}`))) ignoti.push(n); }
    for (const n of presenti) { const p = (await gjVault(n)).precedente; if (p == null || (!presenti.has(p) && !ignoti.includes(p))) radici.push(n); }
    radici.sort();
    const g = radici[0] || null;
    if (!g || ignoti.some(n => n < g)) return null;
    return giu(g);
  }
  // da g in giù per i successori (sempre l'id minore fra quelli validi)
  async function giu(g) {
    for (const visti = new Set([g]); ;) {
      const s = await successore(g); if (!s) return { g, forse: false };
      if (s.manomesso) {
        // attraverso, mai dentro: se il gruppo manomesso non ha un successore la catena si ferma qui, e si aspetta che il suo
        // creatore rimetta gruppo.json (5.3). Intanto niente si pubblica (I3: c'è un sostituito.json)
        if (visti.has(s.g) || !(await successore(s.g))) { avvisi.add('manomesso'); return { g, forse: false }; }
        visti.add(s.g); g = s.g; continue;
      }
      if (!s.ok) return { g: s.g, forse: true, gara: s.gara };
      if (visti.has(s.g)) return { g, forse: false };
      visti.add(s.g); g = s.g;
    }
  }
  async function successore(g) {
    const cand = [];
    for (const f of (await elenca(`${vsync()}/${g}`)) || []) {
      if (!SOSTITUITO.test(f)) continue;
      let j; try { j = JSON.parse(await leggi(`${vsync()}/${g}/${f}`)); } catch { continue; }
      if (typeof j?.nuovo !== 'string') continue;
      const gn = await gjVault(j.nuovo); if (!gn || gn.precedente !== g) continue;
      const v = await verificato(g, j, gn);
      if (v !== 'no' && !cand.some(c => c.g === j.nuovo)) cand.push({ g: j.nuovo, ok: v === 'si', manomesso: v === 'manomesso' });
    }
    // gara: due successori validi dello stesso gruppo (due cambi di password nello stesso momento, 10.4.5). Un manomesso solo se
    // non ce ne sono di validi
    const validi = cand.filter(c => !c.manomesso);
    const s = (validi.length ? validi : cand).sort((a, b) => (a.g < b.g ? -1 : a.g > b.g ? 1 : 0))[0] || null;
    return s && { ...s, gara: validi.length > 1 };
  }
  // un reindirizzamento: 'si' se il gruppo vecchio era in chiaro, se la prova si apre con la chiave vecchia (#31 #47), o se lo
  // studente ha già scritto la password del gruppo nuovo. 'no' se la prova c'è, ho la chiave vecchia e non si apre (falso), o se
  // porterebbe dal cifrato al chiaro (10.4.6). 'forse' se non si può verificare: senza prova (password dimenticata, 10.5) o senza
  // la chiave vecchia (riavvio senza portachiavi). Un 'forse' che vince ferma la catena: stato `rigenerato`, e si segue solo
  // quando lo studente scrive la password del gruppo nuovo («Su un altro computer è stata scelta un'altra password…», 10.4.5)
  // fidati: il mio gruppo e quelli da cui vengo (lasciati e antenati). Un reindirizzamento verso uno di loro è già verificato:
  // ci sono passato io (fuzz --cambi, seme 93001212: senza la chiave del nonno la catena si fermava a mio padre, e io, nel
  // fratello perdente, mi credevo già avanti)
  async function fidati() {
    const out = new Set([cor?.gruppo, ...(cor?.lasciati || []).map(x => x.g)].filter(Boolean));
    for (let a = grp, n = 0; a?.precedente && n < 64; a = await gjVault(a.precedente), n++) out.add(a.precedente);
    return out;
  }
  let miei_gruppi = new Set();
  async function verificato(g, j, gn) {
    const gj = g === cor?.gruppo ? grp : await gjVault(g);
    // un successore nasce sempre cifrato (cifra(), 10.4): uno in chiaro ha la cifratura tolta da chi scrive nella cartella cloud
    // (gruppo.json non autenticato prima della chiave). Da un gruppo cifrato non si segue mai (10.4.6). Da uno in chiaro è
    // 'manomesso': non ci si entra mai (ci si univa in chiaro e si pubblicava in chiaro nel gruppo cifrato, I5), ma la catena
    // passa attraverso, verso i suoi successori (un antenato manomesso non deve fermare chi arriva dopo); se finisce lì si aspetta
    if (!gn?.cifratura) return gj?.cifratura ? 'no' : 'manomesso';
    if (!gj?.cifratura) return 'si';
    if (miei_gruppi.has(j.nuovo)) return 'si';
    if (chiavi.has(j.nuovo)) return gruppoAutentico(chiavi.get(j.nuovo), gn) ? 'si' : 'no';   // un gruppo.json manomesso non si segue
    const k = chiavi.get(g);
    if (!j.prova || !k) return 'forse';
    return apriBlocco(k, j.prova, `sostituito|${g}`) === j.nuovo ? 'si' : 'no';
  }
  // una cartella che non contiene nessun file (solo cartelle vuote) non c'è: è quello che resta di una cancellazione
  async function vuota(dir, prof = 0) {
    const l = await elenca(dir); if (l == null) return true;
    for (const n of l) { const s = await info(`${dir}/${n}`); if (!s) continue; if (!s.isDirectory() || prof > 2 || !(await vuota(`${dir}/${n}`, prof + 1))) return false; }
    return true;
  }
  async function percorri() {
    const nomi = await elenca(vsync());
    if (!nomi || !nomi.includes(cor.gruppo) || await vuota(`${vsync()}/${cor.gruppo}`)) {
      // la cartella del gruppo, o tutto .lode/sync, non c'è: se l'avevo già vista è sparita (⊕4, I10), se no deve arrivare
      if (st.visto) return 'sparito';
      if (!st.creatore) return 'in_arrivo';
    } else if (!st.visto) { st.visto = true; await salvaStato(); }
    // prima i miei successori (la catena dal mio gruppo, anche se la radice non c'è più), poi la testa di tutto il vault (8.5)
    miei_gruppi = await fidati();
    const mio = await giu(cor.gruppo);
    if (mio.g !== cor.gruppo) return sposta(mio.g, mio.forse, mio.gara);
    const t = await testa();
    if (!t) return 'in_arrivo';   // la testa non si trova (un gruppo che non si legge ancora): mai in_pari
    if (t.g === cor.gruppo) return 'ok';
    // sono già avanti (la testa è un mio antenato: per esempio la mia rigenerazione non ha ancora scritto sostituito.json)
    for (let a = grp, visti = new Set(); a?.precedente && !visti.has(a.precedente); a = await gjVault(a.precedente)) { if (a.precedente === t.g) return 'ok'; visti.add(a.precedente); }
    return sposta(t.g, t.forse, t.gara);
  }
  // le cartelle da togliere nel gruppo che lascio: la mia, e in un gruppo in chiaro anche quelle dei miei dev di prima (un
  // stato.json o un diario rovinati hanno fatto cambiare dev: nessun altro computer le userà, e resterebbero in chiaro, ⊕5)
  // (i dev di prima stanno in stato.precedenti e, per quando stato.json si rovina insieme al diario, anche in corrente.devs)
  const lasciare = () => [{ g: cor.gruppo, dev: st.dev }, ...(grp?.cifratura ? [] : [...new Set([...(st.precedenti || []), ...(cor.devs || [])])].filter(d => d !== st.dev).map(dev => ({ g: cor.gruppo, dev })))];
  // lasciando un gruppo: i computer che ci conosco adesso (le cartelle che ci sono e gli autori degli eventi che ho). Da un
  // gruppo cifrato si leggeranno solo le loro cartelle in quell'antenato (leggiAntenati). Anche lasciando un gruppo CIFRATO:
  // prima non si registrava niente, e dopo «Cambia password» chi conosceva la password vecchia (di solito si cambia proprio
  // perché è trapelata) poteva scrivere una cartella nuova nel gruppo vecchio con eventi autentici, che entravano nel diario e
  // si ripubblicavano cifrati con la chiave nuova, senza avvisi (giro 3)
  async function conosciutiAllaPartenza() {
    const g = cor.gruppo, out = { ...(cor.conosciuti || {}) };
    if (!g) return out;
    const devs = new Set([...noti.values()].filter(e => e.k === 1 && /^[0-9a-f]{16}$/.test(e.dev)).map(e => e.dev));
    for (const d of (await elenca(`${vsync()}/${g}`)) || []) if (!d.startsWith('.') && !d.endsWith('.json')) devs.add(d);
    out[g] = [...devs].sort();
    return out;
  }
  // passa al gruppo g2 (successore, o la radice vincente): ci pubblica gli eventi che mancano, poi toglierà la propria cartella
  const sposta = (...a) => inMemoria(() => spostaDentro(...a));
  async function spostaDentro(g2, forse = false, gara = false) {
    const gj2 = await gjVault(g2); if (!gj2) return 'ok';
    if (grp?.cifratura && !gj2.cifratura) { avvisi.add('gruppi_doppi'); return 'ok'; }   // mai dal cifrato al chiaro per caso (10.4.6)
    // «un'altra password nello stesso momento» solo se ci sono davvero due successori in gara (10.4.5): dopo un cambio normale
    // visto senza la chiave vecchia, o dopo «Ho dimenticato la password» altrove, è il testo normale di `rigenerato`. L'avviso
    // si ricalcola a ogni giro (prima restava acceso anche dopo che la chiave vecchia era arrivata)
    if (gj2.cifratura && !chiavi.has(g2)) { if (forse && gara) avvisi.add('altra_password'); return 'rigenerato'; }
    if (gj2.cifratura && !gruppoAutentico(chiavi.get(g2), gj2)) { avvisi.add('manomesso'); return 'ok'; }   // §10.2: non si segue
    registro('sposta', cor.gruppo, '→', g2);
    const vecchio = lasciare(), tutti = [...noti.values()];
    const st2 = (await caricaJson(`${G(g2)}/stato.json`)).dati || { dev: st.dev, creatore: false, visto: false, seq: (st.seq || 0) + 1 };
    await salvaJson(`${G(g2)}/stato.json`, st2); await salvaJson(`${G(g2)}/gruppo.json`, gj2);
    cor = { ...cor, gruppo: g2, lasciati: [...(cor.lasciati || []).filter(x => x.g !== g2), ...vecchio], conosciuti: await conosciutiAllaPartenza() };
    await caricaGruppo(g2);   // quello che c'era già (un tentativo interrotto)
    for (const e of tutti) aggiungiNoto(e);
    await leggiGruppo();
    const nelDiario = new Set(miei.flatMap(s => s.eventi.map(e => e.h)));
    await aggiungiMiei(tutti.filter(e => !inGruppo.has(e.h) && !nelDiario.has(e.h)).sort(confronta));
    await salvaCorrente();
    return 'ok';
  }

  // ---- lettura dei contenitori (§6.1) ----
  async function leggiGruppo() {
    inArrivo = false;
    const g = cor.gruppo, base = `${vsync()}/${g}`, nomi = (await elenca(base)) || [];
    if (!nomi.includes('gruppo.json') && !st.creatore) inArrivo = true;
    for (const d of nomi) {
      if (d.startsWith('.')) { if (SEGNAPOSTO.test(d)) inArrivo = true; continue; }
      if (d.endsWith('.json') || d === st.dev) continue;
      const files = await elenca(`${base}/${d}`); if (!files) continue;
      const numeri = new Set();
      for (const f of files) {
        if (SEGNAPOSTO.test(f)) { inArrivo = true; continue; }
        if (TMP.test(f) && f.startsWith('.')) continue;
        const p = `${base}/${d}/${f}`, s = await info(p); if (!s || !s.isFile()) continue;
        const firma = `${s.size}:${s.mtimeMs}`;
        if (letti.get(p)?.firma === firma) { if (errati.has(p)) { inArrivo = true; if (letti.get(p).rovinato) avvisi.add('rovinato_altro'); if (letti.get(p).cifratoQui) avvisi.add('gruppo_chiaro'); } else numeri.add(letti.get(p).n); continue; }
        const t = await leggi(p); if (t == null) continue;
        const r = leggiContenitore(t, { gruppo: g, dev: d, cifrato: !!grp?.cifratura, chiave });
        if (r.errore) {
          const rovinato = r.errore === 'rovinato' || r.errore === 'chiaro';
          // un contenitore cifrato in un gruppo che gruppo.json dice in chiaro: gruppo.json è stato manomesso (cifratura tolta).
          // Questo computer non pubblica niente lì (pubblica() guarda l'avviso): i suoi eventi non vanno in chiaro (I5)
          const cifratoQui = r.errore === 'password' && !grp?.cifratura;
          if (cifratoQui) avvisi.add('gruppo_chiaro');
          errati.add(p); letti.set(p, { firma, rovinato, cifratoQui }); inArrivo = true;
          // il file di un ALTRO computer: si salta finché non torna leggibile (non si ripara da qui: §12, due testi)
          if (rovinato) avvisi.add('rovinato_altro');
          if (r.errore === 'versione') versione = true;
          continue;
        }
        // «letto» solo dopo che i suoi eventi sono in altri/: se la scrittura fallisce (disco pieno, EACCES, EBUSY) il file si rilegge
        // al giro dopo. Prima la firma restava in `letti` e il file non si rileggeva più finché non cambiava: quel computer non
        // vedeva mai quegli eventi (fuzz --disco 93150054, --disco --cifratura 93110865: convergenza, scenari R08 e R09)
        if (r.eventi.some(e => !noti.has(e.h))) {
          await scriviAtomico(`${G(g)}/altri/${d}/${encodeURIComponent(f)}.jsonl`, r.eventi.map(canonico).join('\n') + '\n');
          for (const e of r.eventi) aggiungiNoto(e);
        }
        errati.delete(p); letti.set(p, { firma, n: r.n }); numeri.add(r.n);
        for (const e of r.eventi) inGruppo.add(e.h);
      }
      const max = Math.max(0, ...numeri); for (let i = 1; i <= max; i++) if (!numeri.has(i)) inArrivo = true;   // un buco: in arrivo
    }
    await leggiAntenati();
  }
  // §10.6: dopo uno spostamento le cartelle degli altri rimaste nei gruppi di prima (un computer morto, o che ha fatto «Smetti»,
  // o che non si è ancora spostato) si continuano a leggere, in sola lettura. Gli eventi nuovi entrano in altri/ e, se il gruppo
  // di adesso non li ha già, nel diario: così si ripubblicano qui. Un gruppo cifrato di cui non ho la chiave si salta (§16)
  async function antenati() {
    const out = new Set((cor.lasciati || []).map(x => x.g));
    for (let a = grp, n = 0; a?.precedente && n < 64; a = await gjVault(a.precedente), n++) out.add(a.precedente);
    out.delete(cor.gruppo);
    // i fratelli perdenti (10.4.5: due cambi di password insieme): figli degli stessi antenati. Si leggono solo se ne ho la chiave
    // (GCM: eventi autentici); in chiaro solo se anche il mio gruppo è in chiaro (mai eventi non autenticati in un gruppo cifrato)
    for (const n of (await elenca(vsync())) || []) {
      if (n.startsWith('.') || n === cor.gruppo || out.has(n)) continue;
      const j = await gjVault(n); if (!j || !out.has(j.precedente)) continue;
      if (j.cifratura ? chiavi.has(n) : !grp?.cifratura) out.add(n);
    }
    return [...out];
  }
  async function leggiAntenati() {
    const nuovi = [];
    for (const ga of await antenati()) {
      const base = `${vsync()}/${ga}`, nomi = await elenca(base); if (!nomi) continue;
      // il modo di un antenato: dalla copia locale di gruppo.json (verificata quando ci si era dentro). Il gruppo.json del vault
      // non è autenticato: in un gruppo cifrato non decide (chi scrive nella cartella lo riscriveva con cifratura null e faceva
      // leggere come autentici i suoi contenitori in chiaro). Se il modo non si conosce, l'antenato non si legge
      if (!modoAntenati.has(ga)) { const gj = (await caricaJson(`${G(ga)}/gruppo.json`)).dati || (grp?.cifratura ? null : await gjVault(ga)); if (gj) modoAntenati.set(ga, !!gj.cifratura); }
      const cifrato = modoAntenati.get(ga);
      if (cifrato == null) continue;   // non so com'era (nessuna copia di gruppo.json): non si legge
      const k = cifrato ? chiavi.get(ga) : null; if (cifrato && !k) continue;
      // in un gruppo cifrato, da un antenato (in chiaro O cifrato) si leggono solo le cartelle dei computer conosciuti quando
      // l'ho lasciato (cor.conosciuti): una cartella nata dopo può averla scritta chiunque possa scrivere nella cartella cloud (e,
      // in un antenato cifrato, conosca la password VECCHIA), e i suoi eventi entrerebbero nel gruppo cifrato come autentici (I5,
      // #31 #47, giro 3). Un computer non ancora informato porta comunque i suoi eventi quando si sposta, col suo diario. Per un
      // fratello perdente (10.4.5), dove non sono mai stato: i computer conosciuti nel gruppo da cui è nato
      let noti2 = null;
      if (grp?.cifratura) {
        noti2 = new Set(cor.conosciuti?.[ga] || []);
        if (!cor.conosciuti?.[ga]) { const j = await gjVault(ga); if (j?.precedente && gruppoAutentico(k, j)) for (const d of cor.conosciuti?.[j.precedente] || []) noti2.add(d); }
      }
      for (const d of nomi) {
        if (d.startsWith('.') || d.endsWith('.json') || d === st.dev) continue;
        if (noti2 && !noti2.has(d)) continue;
        for (const f of (await elenca(`${base}/${d}`)) || []) {
          if (SEGNAPOSTO.test(f) || TMP.test(f)) continue;
          const p = `${base}/${d}/${f}`, s = await info(p); if (!s || !s.isFile()) continue;
          const firma = `${s.size}:${s.mtimeMs}`;
          if (letti.get(p)?.firma === firma) continue;
          const t = await leggi(p); if (t == null) continue;
          const r = leggiContenitore(t, { gruppo: ga, dev: d, cifrato, chiave: k });
          if (r.errore) { letti.set(p, { firma }); continue; }
          const ignoti = r.eventi.filter(e => !noti.has(e.h));
          if (ignoti.length) {
            await scriviAtomico(`${G(cor.gruppo)}/altri/${ga}-${d}/${encodeURIComponent(f)}.jsonl`, r.eventi.map(canonico).join('\n') + '\n');
            for (const e of ignoti) { aggiungiNoto(e); if (!inGruppo.has(e.h)) nuovi.push(e); }
          }
          letti.set(p, { firma });   // dopo la scrittura in altri/ (come in leggiGruppo)
        }
      }
    }
    if (nuovi.length) await aggiungiMiei(nuovi.sort(confronta));
  }

  // ---- pubblicazione (§5.3-5.5) ----
  async function pubblica() {
    const g = cor.gruppo, base = `${vsync()}/${g}`;
    mieiH = null;   // l'insieme delle h del diario si costruisce al più una volta per pubblicazione (prima: una per contenitore)
    if (grp?.cifratura && !chiave) return false;
    const nomi = (await elenca(base)) || [];
    // c'è un successore (anche solo il suo segnaposto: I3, si aspetta che arrivi): prima ci si sposta
    if (nomi.some(f => SOSTITUITO.test(f) || /^\.sostituito.*\.json\.icloud$/.test(f))) return false;
    // in chiaro, anche un successore che si annuncia in un altro modo fa aspettare (I3, #48): un gruppo con precedente = il mio
    // (il suo sostituito.json non è ancora arrivato), o un gruppo che non si legge ancora ma ha già un sostituito*.json
    // (fuzz --cambi, seme 95001697: pubblicava in chiaro mentre la catena nuova arrivava a pezzi)
    if (!grp?.cifratura) for (const n of (await elenca(vsync())) || []) {
      if (n.startsWith('.') || n === g) continue;
      const j = await gjVault(n);
      if (j ? j.precedente === g : ((await elenca(`${vsync()}/${n}`)) || []).some(f => SOSTITUITO.test(f))) { inArrivo = true; return false; }
    }
    // gruppo.json non cambia mai dopo la nascita: chi l'ha già visto nel vault (st.visto) ne ha una copia verificata e lo può
    // rimettere, come il creatore (X4: il creatore morto per sempre e gruppo.json perso, gli altri restavano fermi)
    const custode = st.creatore || st.visto;
    let gjOk = false;
    if (nomi.includes('gruppo.json')) {
      const t = await leggi(`${base}/gruppo.json`);
      let j = null; try { j = JSON.parse(t); gjOk = j?.v === 2 && j.id === g && (!custode || !grp || canonico(j) === canonico(grp)); } catch { }
      // la mia copia è in chiaro e quella del vault è cifrata: la mia è quella sbagliata (mi sono unito a un gruppo.json manomesso).
      // Non la riscrivo sopra (prima il creatore e questo computer se la rubavano a ogni giro) e non pubblico.
      // Prendo quella del vault, che chiede la password (sblocca ne verifica la firma prima di imparare la chiave)
      if (!gjOk && j?.v === 2 && j.id === g && j.cifratura && !grp?.cifratura) {
        grp = j; await salvaJson(`${G(g)}/gruppo.json`, j); chiave = chiavi.get(g) || null; piegato = null;
        avvisi.add('gruppo_chiaro'); inArrivo = true; return false;
      }
      if (!gjOk && custode && grp && t != null) await daParte(`gruppo-${g}.json`, t);
    }
    if (!gjOk && (!custode || !grp)) { inArrivo = true; return false; }   // ⊕4: senza gruppo.json leggibile non si pubblica
    // contenitori cifrati in un gruppo che la mia copia dice in chiaro (leggiGruppo): mai pubblicare in chiaro lì (I5)
    if (!grp?.cifratura && avvisi.has('gruppo_chiaro')) { inArrivo = true; return false; }
    // il segnaposto di gruppo.json non è un gruppo.json sparito (I3): il creatore non lo riscrive alla cieca, aspetta che torni
    const segnaGj = !gjOk && !nomi.includes('gruppo.json') && nomi.includes('.gruppo.json.icloud');
    for (let giro = 0; giro < 3; giro++) {
      const dir = `${base}/${st.dev}`, presenti = (await elenca(dir)) || [];
      for (const f of presenti) if (TMP.test(f)) await fs.rm(`${dir}/${f}`, { force: true });
      let clone = false, cambiati = false;
      // le altre voci nella mia cartella (copie in conflitto, file di un gemello): eventi che il diario non ha?
      for (const f of presenti) {
        if (TMP.test(f) || SEGNAPOSTO.test(f) || miei.some(s => `${s.n}.seg` === f)) continue;
        if (await controllaProprio(`${dir}/${f}`, f) === 'clone') { clone = true; break; }
      }
      if (!clone) for (const seg of miei) {
        const p = `${dir}/${seg.n}.seg`, s = await info(p), pub = pubblicati.get(seg.n);
        if (pub && s && pub.conta === seg.eventi.length && pub.firma === `${s.size}:${s.mtimeMs}`) continue;
        if (s) {
          const esito = await controllaProprio(p, `${seg.n}.seg`, seg);
          if (esito === 'clone') { clone = true; break; }
          if (esito === 'uguale') { pubblicati.set(seg.n, { conta: seg.eventi.length, firma: `${s.size}:${s.mtimeMs}` }); cambiati = true; continue; }
        }
        await scriviAtomico(p, scriviContenitore({ gruppo: g, dev: st.dev, n: seg.n, eventi: seg.eventi, chiave: grp?.cifratura ? chiave : null }));
        const s2 = await info(p); pubblicati.set(seg.n, { conta: seg.eventi.length, firma: s2 ? `${s2.size}:${s2.mtimeMs}` : '' }); cambiati = true;
      }
      if (!clone) {
        if (cambiati) await salvaJson(`${G(g)}/pubblicati.json`, { dev: st.dev, voci: Object.fromEntries(pubblicati) });
        // gruppo.json lo scrive il creatore dopo il suo contenitore (8.2.3); se sparisce lo riscrive dalla copia locale chi l'ha
        // già visto nel vault (5.3), mai sopra il suo segnaposto
        if (!gjOk && !segnaGj) await scriviAtomico(`${base}/gruppo.json`, canonico(grp));
        if (st.creatore && !st.visto) { st.visto = true; await salvaStato(); }
        return true;
      }
    }
    return false;
  }
  // un file nella mia cartella del vault: non fa mai da sorgente. Se non si legge va in copie/ e si riscrive dal diario; se ha
  // eventi che il diario non ha (un gemello con lo stesso dev, ⊕1), quelli entrano come eventi di un altro computer e prendo
  // un dev nuovo
  async function controllaProprio(p, nome, seg = null) {
    const t = await leggi(p); if (t == null) return 'manca';
    const r = leggiContenitore(t, { gruppo: cor.gruppo, dev: st.dev, cifrato: !!grp?.cifratura, chiave });
    if (r.errore || r.malformati) { await daParte(`proprio-${cor.gruppo}-${nome}`, t); avvisi.add('rovinato_mio'); if (r.errore) return 'rovinato'; }
    mieiH ||= new Set(miei.flatMap(s => s.eventi.map(e => e.h)));
    const estranei = r.eventi.filter(e => !mieiH.has(e.h));
    if (!estranei.length) return seg && r.eventi.length === seg.eventi.length && !r.malformati ? 'uguale' : 'vecchio';
    await daParte(`gemello-${cor.gruppo}-${nome}`, t);
    await scriviAtomico(`${G(cor.gruppo)}/altri/${st.dev}/${encodeURIComponent(nome)}.jsonl`, r.eventi.map(canonico).join('\n') + '\n');
    for (const e of r.eventi) aggiungiNoto(e);
    st.clonatoDa = st.dev; st.precedenti = [...new Set([...(st.precedenti || []), st.dev])]; st.dev = hex(16); pubblicati.clear(); avvisi.add('clone'); mieiH = null;
    registro('clone: dev nuovo', st.dev);
    await salvaStato();
    return 'clone';
  }
  // toglie la propria cartella dai gruppi lasciati (⊕5: mai quelle degli altri), solo dopo aver pubblicato nel gruppo nuovo
  // via le mie cartelle nei gruppi lasciati (⊕5). Prima, ogni file che non si legge o che ha eventi che non conosco va in
  // copie/: è roba mia (anche di un mio dev di prima, dopo uno stato.json rovinato) e nessuno la deve perdere in silenzio
  // (fuzz --cifratura --corruzione, seme 78600010: un contenitore rovinato del dev di prima tolto senza copia; scenario F18)
  async function pulisci() {
    for (const { g, dev } of cor.lasciati || []) {
      if (g === cor.gruppo) continue;
      const dir = `${vsync()}/${g}/${dev}`, files = await elenca(dir);
      if (files == null) continue;
      const gj = await gjVault(g);
      for (const f of files) {
        if (TMP.test(f) || SEGNAPOSTO.test(f)) continue;
        const t = await leggi(`${dir}/${f}`); if (t == null) continue;
        const r = gj ? leggiContenitore(t, { gruppo: g, dev, cifrato: !!gj.cifratura, chiave: chiavi.get(g) || null }) : { errore: 'gruppo' };
        if (r.errore || r.malformati || r.eventi.some(e => !noti.has(e.h))) await daParte(`lasciato-${g}-${dev}-${f}`, t);
      }
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
  // la rigenerazione di chi l'ha cominciata (10.4): contenitori nel gruppo nuovo, gruppo.json, via la cartella dal vecchio,
  // poi sostituito.json (con la prova se il vecchio era cifrato). Ogni passo si può rifare
  async function finisciRigenerazione() {
    if (!st.rig) return true;
    if (!(await pubblica())) return false;
    await pulisci();
    const da = st.rig.da, dir = `${vsync()}/${da}`, nomi = (await elenca(dir)) || [];
    let gia = false;
    for (const f of nomi) if (SOSTITUITO.test(f)) { try { if (JSON.parse(await leggi(`${dir}/${f}`))?.nuovo === cor.gruppo) gia = true; } catch { } }
    if (!gia && nomi.length) {
      const k = chiavi.get(da), nome = nomi.includes('sostituito.json') ? `sostituito-${cor.gruppo}.json` : 'sostituito.json';
      await scriviAtomico(`${dir}/${nome}`, canonico({ nuovo: cor.gruppo, prova: k ? chiudiBlocco(k, cor.gruppo, `sostituito|${da}`) : null }));
    }
    st.rig = null; await salvaStato();
    return true;
  }
  // chi ha rigenerato tiene vivo il suo annuncio, come gruppo.json (5.3): se nel gruppo vecchio non c'è più un sostituito*.json
  // leggibile che punta al mio gruppo (rovinato, tagliato, cancellato), lo riscrive. Un file rovinato con quel nome va prima in
  // copie/ (fuzz --cifratura --corruzione, seme 93200061: gli altri restavano nel gruppo in chiaro per sempre)
  async function annuncia() {
    const da = grp?.precedente; if (!st.creatore || !da || st.rig) return;
    const dir = `${vsync()}/${da}`, nomi = await elenca(dir); if (!nomi || await vuota(dir)) return;
    if (nomi.some(f => /^\.sostituito.*\.json\.icloud$/.test(f))) return;   // il segnaposto non è un file sparito (I3)
    for (const f of nomi) if (SOSTITUITO.test(f)) { try { if (JSON.parse(await leggi(`${dir}/${f}`))?.nuovo === cor.gruppo) return; } catch { } }
    const nome = nomi.includes('sostituito.json') ? `sostituito-${cor.gruppo}.json` : 'sostituito.json';
    if (nomi.includes(nome)) { const t = await leggi(`${dir}/${nome}`); if (t != null) await daParte(`${da}-${nome}`, t); }
    const k = chiavi.get(da);
    await scriviAtomico(`${dir}/${nome}`, canonico({ nuovo: cor.gruppo, prova: k ? chiudiBlocco(k, cor.gruppo, `sostituito|${da}`) : null }));
  }
  // la migrazione non finita (8.2.3-5): dopo il primo contenitore e gruppo.json, il dati.json minimo e la nota
  async function finisciMigrazione() {
    if (!st.daFinire) return;
    if (!(await pubblica())) return;
    await scriviAtomico(`${vaultDir}/.lode/dati.json`, JSON.stringify(MINIMO(cor.gruppo), null, 1));
    await scriviAtomico(`${vaultDir}/Lode/Aggiorna Lode su tutti i computer.md`, NOTA);
    st.daFinire = false; await salvaStato();
  }

  // Un cambio di gruppo (nuovoGruppo, sposta) cambia molte cose in memoria prima dell'ultima scrittura (corrente.json). Se una
  // lettura o una scrittura in mezzo fallisce (EIO, EACCES, disco pieno: adesso il diario non si salta più, si lancia), la
  // memoria torna com'era: prima restava a metà, col gruppo nuovo in memoria e il diario vuoto, e si pubblicava niente
  // (fuzz --disco --cifratura, seme 91110097: gli eventi di A non arrivavano più agli altri)
  async function inMemoria(f) {
    const prima = { cor, grp, st, chiave, miei, vaultDir, noti: [...noti.values()] };
    try { return await f(); } catch (x) {
      if (x?.crash) throw x;
      ({ cor, grp, st, chiave, miei, vaultDir } = prima);
      noti.clear(); pieg = null; piegato = null; inGruppo.clear(); letti.clear(); errati.clear(); pubblicati.clear();
      for (const e of prima.noti) aggiungiNoto(e);
      throw x;
    }
  }
  // un gruppo nuovo sul computer: gruppo.json, stato e diario con questi eventi, poi corrente.json (l'ultimo passo)
  const nuovoGruppo = (...a) => inMemoria(() => nuovoGruppoDentro(...a));
  async function nuovoGruppoDentro(gj, st2, eventi, extra = {}) {
    await salvaJson(`${G(gj.id)}/gruppo.json`, gj); await salvaJson(`${G(gj.id)}/stato.json`, st2);
    cor = { ...(cor || {}), gruppo: gj.id, ...extra };
    grp = gj; st = st2; miei = []; inGruppo.clear(); letti.clear(); errati.clear(); pubblicati.clear(); piegato = null;
    chiave = chiavi.get(gj.id) || null;
    const prima = [...noti.values()]; noti.clear(); pieg = null;
    for (const e of prima) aggiungiNoto(e);
    // un diario che c'è già per questo gruppo (ci si riunisce a un gruppo in cui si era già stati) si carica e si continua:
    // riscriverne 1.jsonl da capo perderebbe i suoi eventi
    await caricaMiei(gj.id);
    const gia = new Set(miei.flatMap(s => s.eventi.map(e => e.h)));
    for (const s2 of miei) for (const e of s2.eventi) aggiungiNoto(e);
    await aggiungiMiei(eventi.filter(e => !gia.has(e.h)));
    await salvaCorrente();
  }

  async function migra() {
    // ⊕3: qualunque voce in .lode/sync (anche un segnaposto) vuol dire «il gruppo esiste»: ci si unisce. Le cartelle vuote no
    if (!(await vuota(vsync()))) { cor.modo = 'unisciti'; await salvaCorrente(); return unisciti(); }
    const pD = `${vaultDir}/.lode/dati.json`;
    // «non c'è» (ENOENT) è «Comincio da zero»; un dati.json che c'è ma non si legge (EBUSY o EPERM di un antivirus su Windows,
    // EACCES) NON lo è: si resta in da_migrare e si riprova. Prima il gruppo nasceva vuoto e si pubblicava, e il dati.json vero
    // restava abbandonato nel vault di prima
    let t = null, manca = false;
    try { t = await fs.readFile(pD, 'utf8'); } catch (x) { crash(x); manca = assente(x); }
    let D = null; try { D = JSON.parse(t); } catch { }
    const segnaposto = ((await elenca(`${vaultDir}/.lode`)) || []).some(n => /^\.dati\.json\.icloud$/.test(n));
    if (t == null && manca && !segnaposto) D = { v: 1 };   // niente dati.json: «Comincio da zero» (fonte null)
    else if (!D || D.v !== 1 || D.lode2) { Dmigrare = D?.v === 1 && !D.lode2 ? D : null; stato = 'da_migrare'; return; }   // 8.1: si riprova a ogni giro
    const fonte = t == null ? null : sha(canonico(D), 32);
    if (t != null) await daParte('dati.json', t);
    // dati.prev.json, dati.recupero*.json, dati.illeggibile-*.json: copie in chiaro del dati.json di prima. Vanno in copie/ (mai
    // cancellate da Lode) e fuori da .lode/, che con il vault nella cartella cloud è nel cloud (I5, #20)
    for (const n of (await elenca(`${vaultDir}/.lode`)) || []) {
      if (!/^dati\.(prev|recupero[^/]*|illeggibile-[^/]*)\.json$/.test(n)) continue;
      const x = await leggi(`${vaultDir}/.lode/${n}`); if (x == null) continue;
      await daParte(n, x); await fs.rm(`${vaultDir}/.lode/${n}`, { force: true });
    }
    const dev = st?.dev || hex(16), g = hex(16);
    // con la password il gruppo nasce già cifrato: nella cartella cloud non passa mai un gruppo in chiaro (§10.1, #20). Prima si
    // migrava in un gruppo in chiaro, lo si pubblicava, e solo dopo cifra()
    let cifratura = null, kN = null;
    if (pwNascita) { const r = await nuovaCifratura(pwNascita, g, parametri, () => randomBytes(16).toString('hex')); cifratura = r.cifratura; kN = r.chiave; await impara(g, r.chiave); pwNascita = null; }
    await nuovoGruppo(firmaGruppo(kN, { v: 2, id: g, creato: ora(), creatore: dev, fonte, precedente: null, cifratura }),
      { dev, creatore: true, visto: false, seq: 1, daFinire: t != null, vault: vaultDir }, [...importi(D, fonte), ...[...noti.values()].sort(confronta)]);
    await finisciMigrazione();
  }
  // pwUnione: la password scritta da chi si unisce («Uso già Lode», benvenuto). Con la password il gruppo deve essere cifrato: se
  // gruppo.json dice in chiaro ci si ferma (manomesso, o sull'altro computer è senza password) e non si pubblica niente.
  // esitoUnione: il motivo, per attiva() e il main
  async function unisciti() {
    const g = (await testa())?.g;
    if (!g) { stato = 'in_arrivo'; return; }
    const gj = await gjVault(g);
    if (pwUnione != null) {
      if (!gj.cifratura) { esitoUnione = 'chiaro'; stato = 'in_arrivo'; return; }
      if (!chiavi.has(g)) {
        const r = await provaPassword(pwUnione, g, gj.cifratura, parametri);
        if (r.codice === 'parametri') { esitoUnione = 'parametri'; avvisi.add('parametri'); }
        else if (!r.chiave) esitoUnione = 'chiave_sbagliata';
        else if (!gruppoAutentico(r.chiave, gj)) { esitoUnione = 'manomesso'; avvisi.add('manomesso'); }
        else await impara(g, r.chiave);
      }
    }
    if (gj.cifratura && !chiavi.has(g)) { stato = 'password'; return; }
    if (gj.cifratura && !gruppoAutentico(chiavi.get(g), gj)) { avvisi.add('manomesso'); esitoUnione = 'manomesso'; stato = 'in_arrivo'; return; }
    await nuovoGruppo(gj, { dev: st?.dev || hex(16), creatore: false, visto: true, seq: 1, vault: vaultDir }, [...noti.values()].sort(confronta));
  }

  // ---- un giro: lo stato si ricalcola da zero (#36) ----
  async function giro() {
    if (fermo || !cor) return;
    pubblicato = false;   // la pubblicazione di questo giro (smetti() la guarda)
    // i gruppo.json del vault si rileggono a ogni giro: uno rovinato e poi rimesso dal suo custode (5.3) non resta in memoria
    // (fuzz --cifratura --corruzione, seme 95201734: un controllo rovinato faceva rifiutare la password giusta per sempre)
    gjCache.clear();
    // si ricalcolano a ogni giro, come lo stato: un file tornato buono, una chiave arrivata, gruppo.json rimesso a posto dal suo
    // creatore non li tengono accesi
    for (const a of ['rovinato_altro', 'altra_password', 'gruppo_chiaro', 'manomesso']) avvisi.delete(a);
    if (!cor.gruppo) {
      if (!st) await caricaGruppo('attesa');
      if (cor.modo === 'nuovo') await migra(); else if (cor.modo === 'unisciti') await unisciti();
      if (!cor.gruppo) { await orario(); return; }
    }
    Dmigrare = null; inArrivo = false;

    if (!(cor.devs || []).includes(st.dev)) { cor.devs = [...(cor.devs || []), st.dev]; await salvaCorrente(); }   // i miei dev, per lasciare()
    if (st.rig && chiave) await finisciRigenerazione();
    const p = await percorri();
    if (p === 'sparito' || p === 'rigenerato') { stato = p; await orario(); return; }
    if (grp?.cifratura && !chiave) { stato = 'password'; await orario(); return; }
    await leggiGruppo();   // ricomincia da inArrivo = false: la cartella del gruppo che non c'è ancora si somma dopo
    pubblicato = false;
    if (st.rig) pubblicato = await finisciRigenerazione(); else if (st.daFinire) await finisciMigrazione(); else if (await pubblica()) { pubblicato = true; await pulisci(); await annuncia(); }
    stato = inArrivo || p === 'in_arrivo' || !grp ? 'in_arrivo' : versione ? 'versione' : 'in_pari';
    await lodeVecchia();
    await orario();
  }
  // §8.3: dopo la migrazione .lode/dati.json è il minimo (lode2). Un dati.json che ha scritto una Lode vecchia (scrittoDaVecchia)
  // non si legge come dati e non cambia niente da solo; si segnala (lode_vecchia) e, con un gruppo, se ne tiene una copia in copie/
  // (una per versione: una Lode vecchia può riscriverlo e non resterebbe niente). daVecchia() dice cosa c'è dentro: i record con
  // un id mai visto nel diario (aggiunte: «Importa le aggiunte» li crea) e i campi diversi da quelli di adesso (diversi: si
  // guardano, non cambiano niente da soli). Prima restavano solo in quel file nascosto, senza strada per il diario (giro 3)
  // Anche le copie in conflitto di dati.json che il servizio crea quando la Lode vecchia e il minimo si scrivono insieme
  // («dati 2.json» di iCloud, «dati (conflicted copy…).json» di Dropbox, «dati-PC.json» di OneDrive, «dati.sync-conflict-…»):
  // lì finisce proprio quello che la Lode vecchia ha scritto. Mai dati.prev.json, i recuperi e i file illeggibili (sono di Lode 2)
  let vecchie = [], cacheVecchia = null;
  const COPIA_DATI = /^dati(?!\.(prev|recupero|illeggibile))[ .\-(_].*\.json$/;
  async function lodeVecchia() {
    if (st?.daFinire || !st) return;
    const nomi = ['dati.json', ...((await elenca(`${vaultDir}/.lode`)) || []).filter(n => COPIA_DATI.test(n) && !n.includes('.tmp-')).sort()];
    const trovate = [];
    for (const n of nomi) {
      const t = await leggi(`${vaultDir}/.lode/${n}`); if (t == null) continue;
      let D = null; try { D = JSON.parse(t); } catch { }
      if (scrittoDaVecchia(D, cor?.gruppo)) trovate.push({ n, t, D });
    }
    // l'avviso, come prima, per dati.json (le copie in conflitto si mostrano con le aggiunte e i campi diversi)
    if (trovate.some(x => x.n === 'dati.json')) avvisi.add('lode_vecchia'); else avvisi.delete('lode_vecchia');
    if (!cor?.gruppo) { vecchie = []; return; }
    const prima = vecchie; vecchie = trovate.map(x => x.D);
    if (prima.length !== vecchie.length || prima.some((d, i) => d !== vecchie[i])) cacheVecchia = null;
    for (const { n, t } of trovate) {
      const f = sha(t, 16); if ((st.vecchie || []).includes(f)) continue;
      await daParte(`${n}-lode-vecchia.json`, t); st.vecchie = [...(st.vecchie || []), f].slice(-20); await salvaStato();
    }
  }
  function daVecchia() {
    if (!vecchie.length || !cor?.gruppo || !st) return { aggiunte: [], diversi: [] };
    const P = piegaOra();
    if (cacheVecchia?.P === P) return cacheVecchia.r;
    const V = vistaDi(P), aggiunte = [], diversi = [], visti = new Set(), uguale = (a, b) => canonico(a ?? null) === canonico(b ?? null);
    for (const vecchiaD of vecchie) {
    for (const lista of LISTE) (Array.isArray(vecchiaD[lista]) ? vecchiaD[lista] : []).forEach(r => {
      if (!r || typeof r !== 'object') return;
      let { id, ...campi } = r;
      if (lista === 'orario') { campi = { corso: r.corso, giorni: [...(r.giorni || [])], inizio: r.inizio, fine: r.fine, aula: r.aula || '' }; id = idLezione(r); }
      if (typeof id !== 'string' || !id) return;
      const k = `${lista}/${id}`;
      if (!P.recs.has(k)) { if (!visti.has(k)) { visti.add(k); aggiunte.push({ k, lista, id, campi }); } return; }
      const qui = (V[lista] || []).find(x => x?.id === id); if (!qui) return;
      for (const [c, v] of Object.entries(campi)) if (!uguale(v, qui[c])) diversi.push({ percorso: `${k}/${c}`, qui: qui[c] ?? null, vecchia: v ?? null });
    });
    for (const [c, v] of Object.entries(vecchiaD.profilo || {})) if (!(c === 'nome' && v === MINIMO(cor.gruppo).profilo.nome) && !uguale(v, V.profilo?.[c])) diversi.push({ percorso: `profilo/${c}`, qui: V.profilo?.[c] ?? null, vecchia: v ?? null });
    }
    cacheVecchia = { P, r: { aggiunte, diversi } };
    return cacheVecchia.r;
  }

  // ---- Orario.md (§9) ----
  // Le modifiche dello studente si assorbono in ogni stato in cui il diario si scrive. Poi: chi sa di più (e può scrivere
  // proiezioni) riscrive il file dalla vista; altrimenti, se il file l'ha cambiato lo studente, si rimette solo il marcatore
  // in fondo (stesso testo, righe = le righe di adesso, t = quello degli eventi appena ricavati): la modifica dopo si confronta
  // con questa versione, e il file non mostra mai una vista più povera di quella che lo studente aveva davanti
  async function orario() {
    if (fermo || !st) return;
    const nomi = ((await elenca(vaultDir)) || []).filter(n => /^Orario.*\.md$/.test(n)).sort((a, b) => (a === 'Orario.md' ? -1 : b === 'Orario.md' ? 1 : a < b ? -1 : 1));
    let principale = null;
    const nuovi = new Map();
    for (const f of nomi) {
      const t = await leggi(`${vaultDir}/${f}`); if (t == null) continue;
      const r = eventiDaOrario(t, piegaOra(), f === 'Orario.md' ? orarioVisto : null);
      for (const e of r.eventi) if (!noti.has(e.h)) nuovi.set(e.h, e);
      if (f === 'Orario.md') principale = r.parziale ? null : { testo: t, marcatore: r.marcatore, righe: r.righe, visto: !!r.marcatore && !!orarioVisto && orarioVisto.h === r.marcatore.h };
    }
    // un'aggiunta (o una rimozione) fatta in Obsidian che il diario non prende (disco pieno): il marcatore non si rimette, e le
    // righe viste restano in memoria (orarioVisto, orario.mjs) per riconoscere dopo una riga tolta anche se il file torna come
    // l'aveva scritto Lode. Prima la rimozione si perdeva e la lezione tornava viva da un altro computer (R05)
    if (nuovi.size) {
      try { await aggiungiMiei([...nuovi.values()]); }
      catch (x) {
        const m = principale?.marcatore;
        if (m && principale.righe) { const prima = principale.visto ? orarioVisto.righe : []; orarioVisto = { h: m.h, t: m.t, righe: [...new Set([...prima, ...principale.righe])] }; }
        throw x;
      }
    }
    if (!principale) return;   // mai «scrivi perché manca» (#40)
    if (principale.visto) orarioVisto = null;   // le righe viste sono entrate nel diario
    const m0 = principale.marcatore, studente = !m0 || sha(m0.sopra, 16) !== m0.h;
    const m = m0 && principale.visto ? { ...m0, t: [m0.t[0], m0.t[1] + 1] } : m0;   // gli eventi sono a t + 2: il marcatore rimesso li segue
    const proiezioni = !!cor?.gruppo && ['in_pari', 'in_arrivo', 'versione'].includes(stato);
    const { testo, n, x } = testoOrario(piegaOra());
    // Prima di riscrivere si rilegge il file: se Obsidian l'ha salvato dopo la lettura (il giro parte 1,5 s dopo un salvataggio,
    // mentre lo studente scrive ancora, e Obsidian salva ogni 2 s circa) non si scrive, e il giro dopo assorbe la versione nuova.
    // Prima il rename la copriva: non arrivava nel diario e non andava in copie/ (giro 3). Il controllo si rifà dopo aver
    // scritto il temporaneo (scriviSeUguale): la finestra resta il solo rename, pochi microsecondi invece delle scritture con fsync
    const OM = `${vaultDir}/Orario.md`;
    if (proiezioni && (!m || sopra({ n, x }, m))) {
      if (testo === principale.testo) return;
      if ((await leggi(OM)) !== principale.testo) return;
      if (studente) await daParte('Orario.md', principale.testo);   // un testo che non ha scritto Lode (quello sul disco adesso): una copia
      await scriviSeUguale(OM, testo, principale.testo);
    } else if (studente && m) await scriviSeUguale(OM, rimarca(m), principale.testo);
  }
  async function scriviSeUguale(p, testo, atteso) {
    const i = p.lastIndexOf('/'), dir = p.slice(0, i), tmp = `${dir}/.${p.slice(i + 1)}.tmp-${hex(6)}`;
    await cartella(dir); await fs.writeFile(tmp, testo);
    if ((await leggi(p)) !== atteso) { try { await fs.unlink(tmp); } catch (x) { crash(x); } return false; }
    await riprova(() => fs.rename(tmp, p)); return true;
  }

  // ---- il contratto ----
  return {
    async apri() {
      let nuovaMacchina = false;
      if (macchina) {
        const m = await caricaJson(`${S}/macchina.json`);
        if (m.dati?.impronta !== macchina) { nuovaMacchina = !!m.dati; await cartella(S); await salvaJson(`${S}/macchina.json`, { impronta: macchina }); }
      }
      try { for (const [g, k] of (await portachiavi?.leggi?.()) || []) if (g && k) chiavi.set(g, k); } catch (x) { crash(x); }
      const c = await caricaJson(`${S}/corrente.json`);
      cor = c.dati || null;
      if (c.rotto) cor = await ricostruisci();
      vaultDir = cor?.vault || vaultDato;
      if (cor && !cor.gruppo) await caricaGruppo('attesa');
      if (cor?.gruppo) {
        await caricaGruppo(cor.gruppo);
        // ⊕1: la cartella dei dati copiata da un altro computer: dev nuovo PRIMA di pubblicare
        // i dev elencati in corrente.json sono dell'altro computer, non miei: non si toglieranno mai le sue cartelle
        if (nuovaMacchina) { st.clonatoDa = st.dev; st.dev = hex(16); avvisi.add('clone'); cor.devs = []; await salvaStato(); }
      }
      stato = cor?.gruppo ? 'in_arrivo' : cor?.modo === 'nuovo' ? 'da_migrare' : 'spento';
      await giro();
    },
    // importa: il dati.json v1 del vault di questo computer, quando ci si unisce a un gruppo che c'è già («Uso già Lode su un altro
    // computer» su un computer che usava Lode da solo). I suoi record entrano nel diario di attesa/ come importa con la loro fonte:
    // nel gruppo sono secondari (6.7), quindi non cambiano niente da soli e compaiono in «Dati di un altro primo avvio: [importa le
    // aggiunte]». Prima sparivano dalla vista senza un avviso (restavano solo nel dati.json del vault di prima)
    async attiva({ modo = 'nuovo', password = null, importa = null } = {}) {
      if (fermo) return { rifiutata: true };
      if (!cor?.gruppo) { cor = { gruppo: null, modo, vault: vaultDir, lasciati: [] }; await cartella(S); await salvaCorrente(); if (!st) await caricaGruppo('attesa'); }
      // anche un dati.json con lode2 che una Lode vecchia ha riempito (scrittoDaVecchia): prima si scartava e quei dati restavano
      // solo nel file nascosto. Del minimo non entra niente (lode2, benvenuto, il nome «Aggiorna Lode…»)
      if (importa && typeof importa === 'object' && importa.v === 1 && (!importa.lode2 || scrittoDaVecchia(importa, null)) && !cor.gruppo && cor.modo === 'unisciti') {
        const { lode2, ...pulito } = importa;
        if (lode2) { delete pulito.benvenuto; if (pulito.profilo?.nome === MINIMO(null).profilo.nome) { const { nome, ...pr } = pulito.profilo; pulito.profilo = pr; } }
        const fonte = sha(canonico(pulito), 32);
        await aggiungiMiei(importi(pulito, fonte).filter(e => !noti.has(e.h)));
      }
      if (password && !cor.gruppo && cor.modo === 'nuovo') pwNascita = password;
      if (password && !cor.gruppo && cor.modo === 'unisciti') { pwUnione = password; esitoUnione = null; }
      try { await giro(); } finally { pwUnione = null; }
      // con la password: il gruppo nel vault non è cifrato, la password non lo apre, o gruppo.json è manomesso. Ci si ferma qui
      if (esitoUnione && !cor.gruppo) { const c = esitoUnione; esitoUnione = null; return { codice: c }; }
      esitoUnione = null;
      // il gruppo non è nato (dati.json a metà o illeggibile, o un gruppo che non si legge ancora): lo si dice, non «ok»
      if (!cor.gruppo && cor.modo === 'nuovo') return { ok: false, aspetta: stato };
      // un gruppo cifrato già nel vault (un altro computer l'ha acceso con la password): la password scritta qui lo sblocca.
      // Prima si ignorava, e la scheda diceva «Sincronizzato» con il computer fermo in `password`
      if (password && (stato === 'password' || (grp?.cifratura && !chiave))) { const r = await this.sblocca(password); return r.ok ? { ok: true } : { codice: r.codice || 'chiave_sbagliata' }; }
      if (password && cor.gruppo && !grp?.cifratura) return cor.modo === 'unisciti' ? { codice: 'chiaro' } : this.cifra(password);
      return { ok: true };
    },
    // «importa le aggiunte» (6.7): i record che esistono solo in importa secondari diventano record veri, con un crea per ognuno
    async importaAggiunte() {
      if (fermo || !cor?.gruppo) return { rifiutata: true };
      const P = piegaOra(), eventi = [], fatti = new Set();
      for (const { k, campi } of P.aggiunte || []) {
        const i = k.indexOf('/'), lista = k.slice(0, i), id = k.slice(i + 1);
        if (P.recs.get(k)?.nato) continue;
        fatti.add(k); eventi.push(conImpronta({ dev: st.dev, t: [...prossimoT()], k: 1, r: hex(16), tipo: 'crea', lista, id, campi }));
      }
      // e i record nuovi del dati.json scritto da una Lode vecchia (§8.3)
      for (const { k, lista, id, campi } of daVecchia().aggiunte) if (!fatti.has(k)) { fatti.add(k); eventi.push(conImpronta({ dev: st.dev, t: [...prossimoT()], k: 1, r: hex(16), tipo: 'crea', lista, id, campi })); }
      await aggiungiMiei(eventi);
      return { ok: true, importati: eventi.length };
    },
    async migra() { return this.attiva({ modo: 'nuovo' }); },
    async modifica(x) {
      if (fermo || !cor || !st || (!cor.gruppo && cor.modo !== 'unisciti')) return { rifiutata: true };   // da_migrare: sola lettura
      const P = piegaOra(), M = metaDi(P);
      // §3, §9: l'id di una lezione è o<k> calcolato dal contenuto. Un campo cambiato è un'altra lezione: cancella più crea
      const lez = x.tipo === 'campo' && typeof x.percorso === 'string' && x.percorso.match(/^orario\/([^/]+)\/([^/]+)$/);
      if (lez) {
        const r = P.recs.get(`orario/${lez[1]}`); if (!r?.vivo) return { rifiutata: true };
        const campi = { ...Object.fromEntries([...r.campi].map(([k, v]) => [k, v.v])), [lez[2]]: x.valore };
        const riga = { corso: campi.corso, giorni: [...(campi.giorni || [])], inizio: campi.inizio, fine: campi.fine, aula: campi.aula || '' }, id2 = idLezione(riga);
        if (id2 === lez[1]) return { ok: true };
        const e1 = conImpronta({ dev: st.dev, t: [...prossimoT()], k: 1, r: hex(16), tipo: 'cancella', lista: 'orario', id: lez[1], prev: r.ultimo ?? null });
        const e2 = conImpronta({ dev: st.dev, t: [...prossimoT()], k: 1, r: hex(16), tipo: 'crea', lista: 'orario', id: id2, campi: riga });
        await aggiungiMiei([e1, e2]); await orario();
        return { ok: true, h: e2.h, id: id2 };
      }
      let c;
      switch (x.tipo) {
        // prev: quello che la finestra vedeva (⊕10, la META della vista che le era arrivata) se il main lo passa; se no quello di adesso
        case 'campo': c = { tipo: 'campo', percorso: x.percorso, valore: x.valore, prev: x.prev !== undefined ? x.prev : M.get(x.percorso) ?? null }; break;
        case 'ripasso': c = { tipo: 'ripasso', carta: x.carta, ris: x.ris, prev: M.get(`carte/${x.carta}/ripasso`) ?? null, alg: 1, ...(x.q != null ? { q: x.q, giorno: x.giorno } : {}) }; break;
        case 'cancella': case 'ripristina': c = { tipo: x.tipo, lista: x.lista, id: x.id, prev: P.recs.get(`${x.lista}/${x.id}`)?.ultimo ?? null }; break;
        case 'crea': c = { tipo: 'crea', lista: x.lista, id: x.id, campi: x.campi }; break;
        case 'conta': c = { tipo: 'conta', percorso: x.percorso, delta: x.delta }; break;
        default: c = { ...x };
      }
      const e = conImpronta({ dev: st.dev, t: [...prossimoT()], k: 1, r: hex(16), ...c });
      await aggiungiMiei([e]);   // risponde solo dopo che l'evento è nel diario (I1)
      if (x.lista === 'orario') await orario();
      return { ok: true, h: e.h };
    },
    vista() {
      if (fermo) return { bloccato: true, motivo: 'fermo' };
      if (!cor?.gruppo) return stato === 'password' ? { bloccato: true, motivo: 'password' } : Dmigrare ? structuredClone(Dmigrare)
        : cor?.modo === 'nuovo' && stato === 'da_migrare' ? { bloccato: true, motivo: 'da_migrare' }   // dati.json non si legge: niente vista vuota
        : st ? vistaDi(piegaOra()) : VUOTO();
      if (stato === 'password' || stato === 'rigenerato') return { bloccato: true, motivo: 'password' };
      if (stato === 'sparito') return { bloccato: true, motivo: 'sparito' };
      return vistaDi(piegaOra());
    },
    async arrivati() { await giro(); },
    async chiudi() { await giro(); },
    // sblocca risponde ok solo se dopo il giro il gruppo di adesso (e la testa da raggiungere) ha la chiave. Prima bastava che la
    // password aprisse UN gruppo del vault (quello di prima di un cambio password), e la scheda diceva «Sbloccata» con lo stato
    // ancora `password` o `rigenerato`. Codici: 'vecchia' (ha aperto solo un gruppo di prima), 'parametri' (scrypt di una Lode più
    // nuova: avviso e testo propri), 'manomesso' (la password apre il controllo ma gruppo.json non è autentico), 'chiave_sbagliata'
    async sblocca(password) {
      gjCache.clear();
      // 10.2 sui controllo della CATENA: il gruppo di adesso, i suoi successori (fino alla testa) e i gruppi di prima (per dire
      // «la password di prima»). Prima si provavano tutte le cartelle di .lode/sync, anche quelle inventate da chi scrive nella
      // cartella cloud: ognuna uno scrypt da 128 MB (16-22 s su un Mac carico) dentro la fila del main (giro 3). Senza gruppo
      // (in attesa) restano tutte le cartelle. Lo stesso sale si deriva una volta sola per tentativo (derivate)
      const cartelle = ((await elenca(vsync())) || []).filter(g => g && !g.startsWith('.'));
      let gruppi = new Set(cartelle);
      // (la catena: il gruppo di adesso e i gruppi di prima, più tutti i loro discendenti: successori, testa e i fratelli in gara
      // di 10.4.5, cioè due cambi di password insieme)
      if (cor?.gruppo) {
        gruppi = new Set([cor.gruppo, ...(await antenati())]);
        for (let a = grp, n = 0; a?.precedente && n < 64; a = await gjVault(a.precedente), n++) gruppi.add(a.precedente);
        for (let n = 0, cresce = true; cresce && n < 64; n++) {
          cresce = false;
          for (const g of cartelle) { if (gruppi.has(g)) continue; const j = await gjVault(g); if (j?.precedente && gruppi.has(j.precedente)) { gruppi.add(g); cresce = true; } }
        }
      }
      const derivate = new Map();
      let imparate = 0, provati = 0, parametriDiversi = 0, manomessi = 0;
      for (const g of gruppi) {
        if (chiavi.has(g)) continue;
        const gj = g === cor?.gruppo ? grp : await gjVault(g);
        if (!gj?.cifratura) continue;
        provati++;
        const r = await provaPassword(password, g, gj.cifratura, parametri, derivate);
        if (r.codice === 'parametri') { parametriDiversi++; continue; }
        if (!r.chiave) continue;
        if (!gruppoAutentico(r.chiave, gj)) { manomessi++; continue; }
        await impara(g, r.chiave); imparate++;
      }
      if (cor?.gruppo) chiave = chiavi.get(cor.gruppo) || chiave;
      if (provati && parametriDiversi === provati) avvisi.add('parametri');
      await giro();
      if (manomessi) avvisi.add('manomesso');   // dopo il giro, che ricalcola gli avvisi
      const chiuso = ['password', 'rigenerato'].includes(stato) || (!!grp?.cifratura && !chiave);
      if (imparate && !chiuso) return { ok: true };
      if (imparate) return { codice: 'vecchia' };
      // i gruppi di cui la chiave c'è già: prima si saltavano, e la password GIUSTA su un gruppo già aperto («sblocca» scritto
      // nella barra), o quella di prima su un computer che ricorda la chiave vecchia, rispondeva «Password sbagliata» (giro 3).
      // Si deriva lo stesso: apre il gruppo di adesso → ok (se non resta chiuso); apre solo un gruppo di prima → 'vecchia'
      if (!manomessi) for (const g of [cor?.gruppo, ...gruppi].filter((x, i, a) => x && chiavi.has(x) && a.indexOf(x) === i)) {
        const gj = g === cor?.gruppo ? grp : await gjVault(g);
        if (!gj?.cifratura) continue;
        const r = await provaPassword(password, g, gj.cifratura, parametri, derivate);
        if (r.chiave) return g === cor?.gruppo && !chiuso ? { ok: true } : { codice: 'vecchia' };
      }
      if (manomessi) return { codice: 'manomesso' };
      if (provati && parametriDiversi === provati) return { codice: 'parametri' };
      return { codice: 'chiave_sbagliata' };
    },
    // proteggo dopo / cambio password (10.4): un gruppo nuovo, cifrato, con tutti gli eventi che conosco
    async cifra(password) {
      if (fermo || !cor?.gruppo) return { rifiutata: true };
      await giro();
      // anche negli stati password e rigenerato: «Ho dimenticato la password» (10.5). Si parte dal diario e da altri/, che sono in
      // chiaro sul computer; sostituito.json resta senza prova e gli altri lo seguono quando lo studente scrive la password nuova
      if (!['in_pari', 'in_arrivo', 'versione', 'password', 'rigenerato'].includes(stato)) return { rifiutata: true };
      const da = cor.gruppo, g2 = hex(16);
      const { cifratura, chiave: k2 } = await nuovaCifratura(password, g2, parametri, () => randomBytes(16).toString('hex'));
      await impara(g2, k2);
      const vecchio = lasciare();
      await nuovoGruppo(firmaGruppo(k2, { v: 2, id: g2, creato: ora(), creatore: st.dev, fonte: grp?.fonte ?? null, precedente: da, cifratura }),
        { dev: st.dev, creatore: true, visto: false, seq: (st.seq || 0) + 1, rig: { da }, vault: vaultDir },
        [...noti.values()].sort(confronta), { lasciati: [...(cor.lasciati || []).filter(x => x.g !== g2), ...vecchio], conosciuti: await conosciutiAllaPartenza() });
      await finisciRigenerazione();
      return { ok: true };
    },
    // «Smetti su questo computer» (§11): copia del vault fuori dal cloud, un gruppo locale in chiaro, ultima pubblicazione qui
    // controlla: solo i controlli, niente copia (il main poi copia le note FUORI dalla sua fila: con un vault vero, allegati
    // compresi, dura molto più dei 5 s che chiudi() aspetta, e i salvataggi in fila dietro si perdevano, giro 3). copiata: le
    // note sono già in destinazione; qui si ricopia solo quello che manca o è cambiato dopo (stessa dimensione e data: si salta)
    async smetti({ destinazione, controlla = false, copiata = false } = {}) {
      if (!destinazione || fermo || !cor?.gruppo) return { rifiutata: true };
      await giro();
      // §11 passo 4, l'ultima pubblicazione nel gruppo vecchio, vuole la chiave: senza, le modifiche fatte in pausa resterebbero
      // solo qui senza che nessuno lo dica. Prima la password (o «Ho dimenticato la password»)
      if (stato === 'password' || stato === 'rigenerato') return { rifiutata: true, motivo: 'password' };
      // §11 passo 4: l'ultima pubblicazione deve essere riuscita in questo giro. Se un successore si sta annunciando (il suo
      // gruppo.json è arrivato e il sostituito.json no: I3, si aspetta) la pubblicazione non parte, e smettere lascerebbe le
      // modifiche di questo computer solo qui (fuzz --extra 7200063, 61400093: le modifiche di C dopo la password di A non
      // arrivavano mai). Si rifiuta e si riprova tra poco: quando il successore arriva, lo stato diventa `password`
      // (in `sparito` non c'è un gruppo in cui pubblicare: i dati sono nel diario, I10, e si può smettere)
      if (!pubblicato && stato !== 'sparito') return { rifiutata: true, motivo: 'in_arrivo' };
      // il vault di adesso non c'è più (spostato o cancellato: stato `sparito`): copiarlo darebbe un vault vuoto, e Lode ci
      // passerebbe dicendo «il vault ora è fuori dalla cartella cloud». Prima si accettava
      if (!(await info(vaultDir))?.isDirectory?.()) return { rifiutata: true, motivo: 'sorgente' };
      // le note che il servizio ha tolto dal computer («Ottimizza spazio» di iCloud: .Nome.md.icloud) non si possono copiare: il
      // vault nuovo avrebbe dei buchi. Si resta nel cloud e si elencano (il main prima prova a farle scaricare)
      const mancano = await segnaposti(vaultDir);
      if (mancano.length) return { rifiutata: true, motivo: 'segnaposti', mancano };
      if (controlla) return { ok: true };
      await copiaVault(vaultDir, destinazione, copiata);
      // §11: le chiavi dei gruppi di prima non servono più (il gruppo nuovo è locale e in chiaro, senza antenati): via tutte, anche
      // quelle dei gruppi antenati e lasciati (prima si toglieva solo quella del gruppo di adesso)
      await dimenticaTutte();
      const g3 = hex(16);
      const vaultPrima = vaultDir; vaultDir = destinazione;
      await nuovoGruppo({ v: 2, id: g3, creato: ora(), creatore: st.dev, fonte: grp?.fonte ?? null, precedente: null, cifratura: null },
        { dev: st.dev, creatore: true, visto: false, seq: (st.seq || 0) + 1, vault: destinazione }, [...noti.values()].sort(confronta),
        { vault: destinazione, modo: 'nuovo', lasciati: [] }).catch(x => { vaultDir = vaultPrima; throw x; });
      await giro();
      return { ok: true };
    },
    // «Uso già Lode su un altro computer» dopo «Smetti» (§11): il gruppo locale (in chiaro, fuori dal cloud) si lascia e ci si
    // unisce al gruppo del vault v con tutti gli eventi che conosco. Prima vanno nel diario di attesa/ (un crash a metà non perde
    // niente: corrente.json senza gruppo fa caricare attesa/), poi corrente.json; l'unione la fa il giro (unisciti)
    async ricollega({ vault: v } = {}) {
      if (fermo || !cor?.gruppo || !v) return { rifiutata: true };
      const tutti = [...noti.values()].sort(confronta), dir = `${G('attesa')}/miei`;
      if (tutti.length) {
        const n = Math.max(0, ...((await elencaQui(dir)) || []).map(x => +(x.match(/^(\d+)\.jsonl$/)?.[1] || 0))) + 1;
        await scriviAtomico(`${dir}/${n}.jsonl`, tutti.map(canonico).join('\n') + '\n');
      }
      cor = { gruppo: null, modo: 'unisciti', vault: v, lasciati: [], devs: cor.devs || [] };
      vaultDir = v; await salvaCorrente();
      st = null; grp = null; chiave = null; await caricaGruppo('attesa');
      stato = 'in_arrivo'; await giro();
      return { ok: true };
    },
    // lo spostamento del vault nella cartella cloud (§10.1, «Sincronizza fra i tuoi computer»): il main ha già copiato le note
    // in destinazione (senza .lode/, tranne il dati.json minimo); qui nasce lì un gruppo nuovo, già cifrato se c'è la password,
    // con tutti gli eventi che conosco. Nella cartella cloud non arriva mai un evento in chiaro di un gruppo cifrato (#20).
    // Il gruppo di prima resta nel vault di prima, fuori dal cloud. corrente.json (vault compreso) è l'ultima scrittura di
    // nuovoGruppo: un crash prima lascia tutto com'era e lo spostamento si rifà da capo
    async trasloca({ destinazione, password = null } = {}) {
      if (!destinazione || fermo || !cor?.gruppo) return { rifiutata: true };
      await giro();
      const g3 = hex(16);
      let cifratura = null, k3 = null;
      if (password) { const r = await nuovaCifratura(password, g3, parametri, () => randomBytes(16).toString('hex')); cifratura = r.cifratura; k3 = r.chiave; await impara(g3, r.chiave); }
      const vaultPrima = vaultDir; vaultDir = destinazione;
      await nuovoGruppo(firmaGruppo(k3, { v: 2, id: g3, creato: ora(), creatore: st.dev, fonte: grp?.fonte ?? null, precedente: null, cifratura }),
        { dev: st.dev, creatore: true, visto: false, seq: (st.seq || 0) + 1, vault: destinazione }, [...noti.values()].sort(confronta),
        { vault: destinazione, modo: 'nuovo', lasciati: [] }).catch(x => { vaultDir = vaultPrima; throw x; });
      await giro();
      return { ok: true, gruppo: g3 };
    },
    // la vista sui dati del diario locale anche quando vista() dice «bloccato» (password, rigenerato, sparito): la barra lavora
    // sempre sui dati locali (§7, §12); meta: percorso → h dell'evento che ha scritto il valore (il prev delle modifiche, ⊕10)
    // In da_migrare (dati.json a metà, segnaposto o illeggibile) i dati sono quelli di dati.json, in sola lettura: prima era la
    // piega vuota di attesa/, la barra mostrava una Lode vuota e accettava modifiche che modifica() poi rifiutava.
    // La vista si calcola una volta per versione della piega (piegaOra la tiene finché non arriva un evento): con anni di dati
    // ricalcolarla a ogni chiamata costava secondi per ogni salvataggio. Chi la riceve non la cambia (il main la copia)
    locale() {
      if (fermo || !st) return null;
      if (!cor?.gruppo && cor?.modo === 'nuovo') return { D: Dmigrare ? structuredClone(Dmigrare) : null, meta: {}, solaLettura: true, versione: -1 };
      const P = piegaOra();
      if (cacheLocale?.P !== P) cacheLocale = { P, L: { D: vistaDi(P), meta: Object.fromEntries(metaDi(P)), versione: ++versioneLocale } };
      return cacheLocale.L;
    },
    // «Dimentica la password qui» (§10.2): via dal portachiavi e dalla memoria. Al prossimo giro il gruppo chiede la password
    // Il portachiavi si svuota TUTTO (svuota), anche le voci che safeStorage non ha decifrato all'avvio (permesso negato dopo un
    // aggiornamento): prima restavano nel file e, col permesso ridato, il gruppo si riapriva da solo con la chiave «dimenticata»
    async dimentica() {
      await dimenticaTutte(); await giro(); return { ok: true };
    },
    // «Toglila» (§10.6): il gesto dello studente sulla copia in chiaro che un computer che non torna (morto, o dopo «Smetti») ha
    // lasciato in un gruppo vecchio in chiaro. Si toglie una cartella solo se ogni suo file si legge e tutti i suoi eventi sono
    // già qui (in altri/ e nel diario, quindi ripubblicati). Quando offrirlo (30 giorni senza scritture) lo decide la scheda
    async toglila() {
      if (fermo || !cor?.gruppo) return { rifiutata: true };
      await giro();
      let tolte = 0;
      for (const ga of await antenati()) {
        if (modoAntenati.get(ga) !== false) continue;
        const base = `${vsync()}/${ga}`;
        for (const d of (await elenca(base)) || []) {
          if (d.startsWith('.') || d.endsWith('.json') || d === st.dev) continue;
          let tutto = true;
          for (const f of (await elenca(`${base}/${d}`)) || []) {
            if (TMP.test(f)) continue;
            const t = SEGNAPOSTO.test(f) ? null : await leggi(`${base}/${d}/${f}`);
            const r = t == null ? { errore: 'manca' } : leggiContenitore(t, { gruppo: ga, dev: d, cifrato: false, chiave: null });
            if (r.errore || r.eventi.some(e => !noti.has(e.h))) { tutto = false; break; }
          }
          if (tutto) { await fs.rm(`${base}/${d}`, { recursive: true, force: true }); tolte++; registro('toglila', ga, d); }
        }
      }
      return { ok: true, tolte };
    },
    conflitti: () => (cor?.gruppo && st ? piegaOra().conflitti.map(c => c.percorso) : []),
    elenchi: () => { const P = piegaOra(); return { conflitti: P.conflitti, mentreCancellato: P.mentreCancellato, secondari: P.secondari, vecchia: daVecchia() }; },
    stato: () => ({ stato, avvisi: [...avvisi], gruppo: cor?.gruppo || null, dev: st?.dev || null, vault: cor ? vaultDir : null, modo: cor?.modo || null,
      cifrato: !!grp?.cifratura, chiave: !!chiave, altri: [...new Set([...noti.values()].filter(e => e.k === 1 && e.dev !== st?.dev && /^[0-9a-f]{16}$/.test(e.dev)).map(e => e.dev))].length }),
  };

  async function segnaposti(da, rel = '', out = []) {
    for (const n of (await elenca(`${da}${rel}`)) || []) {
      const r = `${rel}/${n}`;
      if (r === '/.lode' || TMP.test(n)) continue;
      if (SEGNAPOSTO.test(n)) { out.push(`${rel}/${n.slice(1, -7)}`.slice(1)); continue; }
      const s = await info(`${da}${r}`); if (s?.isDirectory()) await segnaposti(da, r, out);
    }
    return out;
  }
  async function copiaVault(da, a, gia = false) {
    const copia = async rel => {
      for (const n of (await elenca(`${da}${rel}`)) || []) {
        const r = `${rel}/${n}`;
        if (r === '/.lode/sync' || SEGNAPOSTO.test(n) || TMP.test(n)) continue;
        const s = await info(`${da}${r}`); if (!s) continue;
        if (s.isDirectory()) { await cartella(`${a}${r}`); await copia(r); continue; }
        if (gia && !r.startsWith('/.lode/')) { const t = await info(`${a}${r}`); if (t && t.size === s.size && Math.abs(t.mtimeMs - s.mtimeMs) < 2000) continue; }
        { const t = await fs.readFile(`${da}${r}`); await cartella(`${a}${rel}`); await fs.writeFile(`${a}${r}`, t); }
      }
    };
    await cartella(a); await copia('');
  }
  // corrente.json rovinato: il gruppo con il seq più alto fra quelli sul computer
  async function ricostruisci() {
    let meglio = null;
    for (const g of (await elenca(S)) || []) {
      if (!/^[0-9a-f]{16}$/.test(g)) continue;
      const s = await caricaJson(`${G(g)}/stato.json`);
      if (s.dati && (!meglio || (s.dati.seq || 0) > meglio.seq)) meglio = { g, seq: s.dati.seq || 0, vault: s.dati.vault };
    }
    return meglio ? { gruppo: meglio.g, modo: 'unisciti', vault: meglio.vault || vaultDato, lasciati: [] } : null;
  }
}

// i selettori per gli scenari del simulatore (ritocco 13.2 g): dove stanno i file di questo motore
const leggiDati = (leggi, p) => { try { return JSON.parse(leggi(p)?.toString('utf8') || 'null')?.dati ?? null; } catch { return null; } };
const gruppoDi = leggi => leggiDati(leggi, 'dati/sync/corrente.json')?.gruppo || null;
export const percorsi = {
  descrittore: ({ elenco, leggi }) => { const g = gruppoDi(leggi); return g ? `vault/.lode/sync/${g}/gruppo.json` : elenco('vault/.lode/sync').find(p => /\/gruppo\.json$/.test(p)) || null; },
  cifratura: ({ elenco, leggi }) => percorsi.descrittore({ elenco, leggi }),
  propri: ({ leggi }) => { const g = gruppoDi(leggi), s = g && leggiDati(leggi, `dati/sync/${g}/stato.json`); return s ? `vault/.lode/sync/${g}/${s.dev}` : null; },
  gruppo: ({ leggi }) => { const g = gruppoDi(leggi); return g ? `vault/.lode/sync/${g}` : null; },
  datiMigrati: () => 'vault/.lode/dati.json',
  // il primo segmento del diario di questo computer (scenario «segmento illeggibile all'avvio»)
  segmento: ({ leggi }) => { const g = gruppoDi(leggi); return g ? `dati/sync/${g}/miei/1.jsonl` : null; },
  diario: ({ leggi }) => { const g = gruppoDi(leggi); return g ? `dati/sync/${g}/miei` : null; },
};
