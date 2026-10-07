// La voce Parakeet anche dove non c'è lode-voce (Windows, Linux, e un Mac senza il programma compilato): Parakeet TDT
// 0.6B v3 di NVIDIA in formato ONNX (int8), con sherpa-onnx (k2-fsa, Apache 2.0). Gira sul processore: un minuto di
// audio in pochi secondi, più preciso di Whisper e con la punteggiatura.
// • L'addon (sherpa-onnx-node, versione esatta in package.json) è Node-API: lo stesso binario va in Node e in Electron,
//   senza ricompilare. Si carica SOLO in un processo a parte (voce-onnx-motore.mjs, utilityProcess di Electron): se
//   l'addon manca o va in crash, cade quel processo e non Lode; e il main non si blocca mentre trascrive.
// • Il modello (~640 MB, 4 file) si scarica la prima volta che serve nella cartella dati dell'app (userData/voce-onnx),
//   da un commit preciso di Hugging Face. Ogni file si controlla con l'impronta SHA256 scritta qui sotto quando arriva,
//   e di nuovo prima di usarlo, una volta per ogni avvio di Lode (vedi SESSIONE). Il download riprende da dove era
//   rimasto (file .parziale + Range), controlla lo spazio sul disco, manda
//   l'avanzamento alla barra (voce:progresso) e non esegue niente: sono dati (pesi ONNX e l'elenco dei token).
// • Lo stesso contratto di lode-voce (voce.mjs): avvio pigro, una richiesta alla volta in fila (risposte nello stesso
//   ordine, con l'id), chiusura a riposo (voce:riposa) e all'uscita. L'audio passa in memoria (Float32Array nel
//   messaggio): niente file audio su disco.
// • Se qualcosa non va (addon che non si carica, crash, modello che non torna con l'impronta, spazio che manca) l'errore
//   ha un codice di RIPIEGO: la barra (js/voce.js) passa a Whisper e ritrascrive lo stesso audio.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync, statfsSync } from 'node:fs';
import { availableParallelism, totalmem } from 'node:os';
import { join, dirname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { t } from './lingua.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
export const MOTORE = join(QUI, 'voce-onnx-motore.mjs');
// la versione di sherpa-onnx-node e dei pacchetti con l'addon per sistema: la stessa, esatta, di package.json
// (dependencies e overrides; test/unita.mjs controlla che coincidano)
export const VERSIONE_SHERPA = '1.13.8';
// Il modello: sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8, pubblicato da csukuangfj (sherpa-onnx) su Hugging Face.
// URL con il commit, mai «main»: lo stesso indirizzo dà sempre gli stessi byte. Impronte calcolate il 2 ottobre 2026 sui
// file scaricati da qui (shasum -a 256), uguali a quelle che Hugging Face mostra per i file LFS.
const COMMIT = '2bda32ec70b097a55adaa07d9a7173915b43cc78';
export const MODELLO = {
  nome: 'parakeet-tdt-0.6b-v3-int8',
  base: `https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/${COMMIT}/`,
  file: [
    { nome: 'encoder.int8.onnx', byte: 652184281, sha256: 'acfc2b4456377e15d04f0243af540b7fe7c992f8d898d751cf134c3a55fd2247' },
    { nome: 'decoder.int8.onnx', byte: 11845275, sha256: '179e50c43d1a9de79c8a24149a2f9bac6eb5981823f2a2ed88d655b24248db4e' },
    { nome: 'joiner.int8.onnx', byte: 6355277, sha256: '3164c13fc2821009440d20fcb5fdc78bff28b4db2f8d0f0b329101719c0948b3' },
    { nome: 'tokens.txt', byte: 93939, sha256: 'd58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d' },
  ],
};
// 670 milioni di byte, in MB da 2^20: 640 MB come li mostra Esplora file (il Finder ne mostra 670). Tutti i MB detti
// allo studente (peso, spazio sul disco) sono di questo tipo
export const PESO_MB = 640;
const MB = 2 ** 20;
// La memoria del processo della voce (misure su M2, RSS di ps): 1,1 GB appena caricato, circa 1,5 GB mentre trascrive.
// Non scende dopo: onnxruntime tiene il picco più alto, per questo l'audio lungo passa a finestre di al massimo 30 s
// (voce-onnx-motore.mjs; un Ripeti di 90 s in un colpo solo lo portava a 2,1 GB per tutta la lezione). Sotto i 6 GB di
// memoria (con la barra, Obsidian e l'AI locale) resta Whisper base, più leggero. 5,5 GiB: un portatile «da 6 GB» ne
// mostra un po' meno (memoria della grafica)
export const MEMORIA_MINIMA = 5.5 * 2 ** 30;
// i codici di errore per cui la barra passa a Whisper (gli altri, come la rete che manca, si riprovano la volta dopo)
export const RIPIEGO = ['addon', 'crash', 'modello', 'impronta', 'spazio'];
// le frasi degli errori del motore (voce-onnx-motore.mjs, un processo a parte che non sa la lingua): qui, per codice
const FRASI_MOTORE = { addon: 'desktop.voce-addon', modello: 'desktop.voce-modello-rovinato' };
// testo: la frase per lo studente, in italiano · dettaglio: il testo tecnico (onnxruntime, percorsi), solo per la console
const errore = (testo, codice, dettaglio) => Object.assign(new Error(testo), { codice }, dettaglio ? { dettaglio } : {});

/* ---------- quale motore ---------- */
// il pacchetto con l'addon per questo sistema (i nomi di sherpa-onnx: «win», non «win32»), o null se non c'è
const SISTEMI = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'win32-x64', 'win32-ia32'];
export const pacchettoAddon = (piattaforma = process.platform, arch = process.arch) =>
  SISTEMI.includes(`${piattaforma}-${arch}`) ? `sherpa-onnx-${piattaforma === 'win32' ? 'win' : piattaforma}-${arch}` : null;
// c'è l'addon per questo sistema? Si guarda solo che il file ci sia: caricarlo qui vorrebbe dire caricarlo nel main.
// Solo nei node_modules di Lode (accanto a questo file, nel pacchetto dentro app.asar: l'addon è fuori dall'asar con
// asarUnpack e Electron lo trova lo stesso), mai più in alto: require.resolve risalirebbe le cartelle, e un pacchetto
// costruito dentro desktop/dist troverebbe l'addon di desktop/node_modules. Il pacchetto del Mac non lo include
export function sherpaPresente({ piattaforma = process.platform, arch = process.arch, moduli = join(QUI, 'node_modules') } = {}) {
  const p = pacchettoAddon(piattaforma, arch); if (!p) return false;
  return existsSync(join(moduli, 'sherpa-onnx-node', 'sherpa-onnx.js')) && existsSync(join(moduli, p, 'sherpa-onnx.node'));
}
// 'mac': Parakeet sul Neural Engine (lode-voce, come prima) · 'onnx': Parakeet sul processore · 'whisper': nella barra
export function scegliMotore({ piattaforma, arch, lodeVoce = false, sherpa = false, memoria = 0, guasta = null }) {
  if (piattaforma === 'darwin' && arch === 'arm64' && lodeVoce) return 'mac';
  if (sherpa && !guasta && memoria >= MEMORIA_MINIMA) return 'onnx';
  return 'whisper';
}
// i fili per onnxruntime: metà dei core, da 1 a 4 (in aula il computer fa anche altro: appunti, Obsidian, la barra)
export const fili = (core = availableParallelism()) => Math.max(1, Math.min(4, Math.floor(core / 2)));

/* ---------- il modello sul disco ---------- */
// l'impronta di un file, a pezzi (anche 650 MB senza bloccare il main)
export async function impronta(file) {
  const h = createHash('sha256');
  for await (const pezzo of createReadStream(file, { highWaterMark: 1 << 20 })) h.update(pezzo);
  return h.digest('hex');
}
// I file già controllati in QUESTA sessione di Lode, solo in memoria: percorso → chi è il file (disco, inode, dimensione,
// data di modifica e di cambio) e l'impronta voluta. A ogni avvio di Lode il modello si rilegge tutto una volta prima
// di usarlo (0,3 s su un M2, qualche secondo su un portatile lento: di solito mentre la voce si prepara da sola, dopo
// l'avvio); i risvegli dal riposo, dopo, non lo rileggono. Niente segno sul disco: con la stessa dimensione e la stessa
// data un file cambiato sarebbe passato per buono. La data di cambio (ctime) non si rimette indietro a mano come quella
// di modifica (touch -r): un file riscritto durante la sessione si ricontrolla.
const SESSIONE = new Map();
const chi = (st, f) => [st.dev, st.ino, st.size, st.mtimeMs, st.ctimeMs, f.sha256].join(':');
const stat = file => { try { return statSync(file); } catch { return null; } };
// quali file sono già controllati in questa sessione (veloce: solo stat, niente letture)
export function statoModello(cartella, modello = MODELLO, verificati = SESSIONE) {
  let mancano = 0;
  for (const f of modello.file) { const dest = join(cartella, f.nome), st = stat(dest); if (!st || verificati.get(dest) !== chi(st, f)) mancano += f.byte; }
  return { pronto: !mancano, mancano };
}
// un modello che non si carica: i file si ricontrollano la volta dopo (e quello che non torna si riscarica)
export function dimentica(cartella, modello = MODELLO, verificati = SESSIONE) { for (const f of modello.file) verificati.delete(join(cartella, f.nome)); }
// i byte liberi sul disco della cartella (statfs: Node 18.15+, anche su Windows)
export const spazioLibero = cartella => { try { const s = statfsSync(cartella); return s.bavail * s.bsize; } catch { return Infinity; } };

// Scarica quello che manca, lo verifica e lo mette al suo posto. Ogni file passa da <nome>.parziale: se Lode si chiude a
// metà, la volta dopo si chiede a Hugging Face solo il resto (Range). L'impronta si calcola mentre arriva (con la parte
// già sul disco riletta all'inizio); se non torna, il file si cancella e l'errore è «impronta». Un file finale che c'è ma
// non è ancora controllato in questa sessione si rilegge: se l'impronta torna resta, altrimenti si cancella e si riscarica.
// avanza(p) con p da 0 a 1 su tutti i byte del modello. rete: net.fetch di Electron (proxy e certificati del sistema)
// verificati: i controlli della sessione (le prove ne passano una nuova per simulare un altro avvio di Lode)
export async function scaricaModello({ cartella, avanza = () => { }, rete = fetch, modello = MODELLO, libero = spazioLibero, margine = 100e6, verificati = SESSIONE }) {
  mkdirSync(cartella, { recursive: true });
  const totale = modello.file.reduce((s, f) => s + f.byte, 0), daFare = [];
  let fatto = 0;
  for (const f of modello.file) {
    const dest = join(cartella, f.nome), st = stat(dest);
    if (st && verificati.get(dest) === chi(st, f)) { fatto += f.byte; continue; }
    verificati.delete(dest);
    // Il file letto è quello di prima e di dopo la lettura (nessuno l'ha cambiato a metà): solo allora vale il controllo.
    // Un file che non si legge (su Windows l'antivirus a volte lo tiene aperto) non si cancella: si riprova la volta dopo
    let giusta = false;
    if (st && st.size === f.byte) {
      try { giusta = await impronta(dest) === f.sha256; }
      catch (e) { throw errore(t('desktop.voce-modello-illeggibile'), 'lettura', e.message); }
    }
    if (giusta && chi(stat(dest) || {}, f) === chi(st, f)) { verificati.set(dest, chi(st, f)); fatto += f.byte; continue; }
    if (st) rmSync(dest, { force: true });
    daFare.push(f);
  }
  if (!daFare.length) { avanza(1); return { scaricati: 0 }; }
  // lo spazio: quello che manca davvero (le parti già scaricate restano) più un margine
  const parte = f => { try { return Math.min(statSync(join(cartella, f.nome + '.parziale')).size, f.byte); } catch { return 0; } };
  const serve = daFare.reduce((s, f) => s + f.byte - parte(f), 0), c = libero(cartella);
  if (c < serve + margine) throw errore(t('desktop.voce-spazio', { serve: Math.ceil((serve + margine) / MB), liberi: Math.floor(c / MB) }), 'spazio');
  let ultimo = 0;
  const segnala = (forza) => { const t = Date.now(); if (forza || t - ultimo > 150) { ultimo = t; avanza(Math.min(1, fatto / totale)); } };
  for (const f of daFare) {
    const dest = join(cartella, f.nome), tmp = dest + '.parziale';
    let da = parte(f); if (da >= f.byte) { rmSync(tmp, { force: true }); da = 0; }   // una parte «finita» ma senza impronta giusta: da capo
    let r;
    try { r = await rete(modello.base + f.nome, { redirect: 'follow', headers: { 'User-Agent': 'Lode', ...(da ? { Range: `bytes=${da}-` } : {}) } }); }
    catch (e) { throw errore(t('desktop.voce-rete', { dettaglio: e.message }), 'rete'); }
    if (r.status === 200) da = 0;   // il server non riprende: si ricomincia il file
    else if (r.status !== 206 || !String(r.headers.get('content-range') || '').startsWith(`bytes ${da}-`)) {
      try { await r.body?.cancel(); } catch { }
      throw errore(t('desktop.voce-rete-stato', { stato: r.status }), 'rete');
    }
    const h = createHash('sha256');
    if (da) for await (const pezzo of createReadStream(tmp, { highWaterMark: 1 << 20 })) h.update(pezzo);
    fatto += da; segnala(true);
    let arrivati = da;
    const conta = new Transform({ transform(pezzo, _, fine) { arrivati += pezzo.length; if (arrivati > f.byte) return fine(errore(t('desktop.voce-file-troppo-grande'), 'impronta')); h.update(pezzo); fatto += pezzo.length; segnala(); fine(null, pezzo); } });
    try { await pipeline(Readable.fromWeb(r.body), conta, createWriteStream(tmp, { flags: da ? 'a' : 'w' })); }
    catch (e) {
      if (e.codice === 'impronta') { rmSync(tmp, { force: true }); throw e; }
      throw errore(t('desktop.voce-interrotto', { dettaglio: e.message }), 'rete');
    }
    if (arrivati !== f.byte || h.digest('hex') !== f.sha256) {
      rmSync(tmp, { force: true });
      throw errore(t('desktop.voce-impronta', { file: f.nome }), 'impronta');
    }
    renameSync(tmp, dest);
    verificati.set(dest, chi(statSync(dest), f));
  }
  segnala(true);
  return { scaricati: daFare.length };
}

/* ---------- il processo che trascrive ---------- */
// Come si avvia il processo del motore: in Electron un utilityProcess (Node completo, con l'addon; i fusibili del
// pacchetto spengono runAsNode, quindi un «node» figlio con l'eseguibile di Electron non partirebbe), nelle prove un
// processo Node figlio. Tutti e due scambiano messaggi con il clone strutturato: il Float32Array passa così com'è.
export const processoElectron = utilityProcess => () => {
  const p = utilityProcess.fork(MOTORE, [], { serviceName: 'Lode voce', stdio: 'ignore' });
  return { manda: m => p.postMessage(m), su: (ev, fn) => p.on(ev === 'messaggio' ? 'message' : 'exit', fn), uccidi: () => p.kill(), pid: () => p.pid };
};
export const processoNode = (fork, { modulo = MOTORE } = {}) => () => {
  const p = fork(modulo, [], { serialization: 'advanced', stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  return { manda: m => p.send(m), su: (ev, fn) => p.on(ev === 'messaggio' ? 'message' : 'exit', fn), uccidi: () => p.kill(), pid: () => p.pid };
};

// Il motore visto dal main. avvia(): processo (e l'addon: se non si carica ci si ferma qui, prima di scaricare 640 MB),
// poi il modello (scaricato se manca, le impronte rilette una volta per avvio di Lode), poi il riconoscitore in memoria.
// trascrivi(audio) → testo, in fila. chiudi(): il processo esce subito; le richieste in attesa, e l'avvio se era a metà,
// finiscono con l'errore «chiusa» (mai «crash»: quello porta a Whisper per tutta la sessione); la prossima riparte da
// capo. occupato(): sta partendo o trascrivendo (main.mjs non lo manda a riposo per il timer di un'altra finestra)
export function crea({ cartella, avvia: nuovoProcesso, avanza, rete, pacchetto = 'sherpa-onnx-node', modello = MODELLO, nFili = fili() }) {
  let proc = null, pronto = null, n = 0, scaricando = null, ferma = null, avviando = false;
  const attese = new Map();   // id → { ok, ko }
  // un download alla volta, anche se un riposo arriva a metà e la frase dopo riavvia il motore: due scritture sullo
  // stesso .parziale lo rovinerebbero
  const scarica = () => scaricando ||= scaricaModello({ cartella, avanza, rete, modello }).finally(() => { scaricando = null; });
  const chiusa = (id, e, testo) => { const a = attese.get(id); if (!a) return; attese.delete(id); e ? a.ko(e) : a.ok(testo); };
  const chiudiTutte = e => { for (const id of [...attese.keys()]) chiusa(id, e); };
  function avvia() {
    if (pronto) return pronto;
    const p = proc = nuovoProcesso();
    let fase = null;   // { ok, ko } dell'attesa in corso: l'addon, poi il modello
    const aspetta = () => new Promise((ok, ko) => { fase = { ok, ko }; });
    ferma = e => fase?.ko(e); avviando = true;
    p.su('messaggio', m => {
      if (m?.evento === 'addon' || m?.evento === 'pronto') fase?.ok(m);
      else if (m?.evento === 'errore') fase?.ko(errore(FRASI_MOTORE[m.codice] ? t(FRASI_MOTORE[m.codice]) : m.errore, m.codice || 'modello', m.dettaglio));   // la frase nella lingua della barra
      else if (m?.id && attese.has(m.id)) chiusa(m.id, m.errore ? errore(t('desktop.voce-pezzo-non-trascritto'), 'modello', m.errore) : null, m.testo || '');
    });
    p.su('uscita', c => {
      // chi l'ha chiuso? Se è stato chiudi() (riposo, uscita, ripiego) proc non è più questo: è «chiusa», non un crash
      const e = proc === p ? errore(c != null ? t('desktop.voce-motore-chiuso-codice', { codice: c }) : t('desktop.voce-motore-chiuso'), 'crash') : errore('voce chiusa', 'chiusa');
      fase?.ko(e);
      if (proc !== p) return;   // chiuso a riposo: ne è già partito un altro
      chiudiTutte(e); proc = null; pronto = null; avviando = false;
    });
    pronto = (async () => {
      const addon = aspetta(); p.manda({ tipo: 'addon', pacchetto }); await addon;
      if (proc !== p) throw errore('voce chiusa', 'chiusa');
      await scarica();
      if (proc !== p) throw errore('voce chiusa', 'chiusa');
      const caricato = aspetta();
      p.manda({ tipo: 'carica', file: Object.fromEntries(modello.file.map(f => [f.nome.split('.')[0], join(cartella, f.nome)])), fili: nFili });
      // il modello non si carica, o il processo cade mentre lo carica: i file si ricontrollano al prossimo avvio (il
      // controllo di questa sessione si dimentica), e quello che non torna con l'impronta si cancella e si riscarica
      try { await caricato; } catch (e) { if (e.codice === 'modello' || e.codice === 'crash') dimentica(cartella, modello); throw e; }
      fase = null; if (proc === p) avviando = false;
      return true;
    })();
    pronto.catch(() => { if (proc === p) { proc = null; pronto = null; avviando = false; try { p.uccidi(); } catch { } } });
    return pronto;
  }
  async function trascrivi(audio) {
    await avvia();
    const id = ++n, f = audio instanceof Float32Array ? audio : new Float32Array(audio);
    return new Promise((ok, ko) => {
      attese.set(id, { ok, ko });
      if (!proc) return chiusa(id, errore('voce chiusa', 'chiusa'));
      try { proc.manda({ tipo: 'trascrivi', id, audio: f }); } catch (e) { chiusa(id, errore(t('desktop.voce-motore-non-risponde'), 'crash', e.message)); }
    });
  }
  const chiudi = () => {
    const p = proc, fermaAvvio = ferma, e = errore('voce chiusa', 'chiusa');
    proc = null; pronto = null; ferma = null; avviando = false;
    fermaAvvio?.(e); chiudiTutte(e); try { p?.uccidi(); } catch { }
  };
  return { avvia, trascrivi, chiudi, attivo: () => !!proc, occupato: () => avviando || attese.size > 0, pid: () => proc?.pid?.() };
}
