// COPIA ADATTATA per test/sync-sim (vedi prepara.mjs) di desktop/sincronizza.mjs dal ramo sincronizzazione-v1. Non modificare a mano.
// La sincronizzazione fra i computer dello studente, senza server di Lode (docs/SINCRONIZZAZIONE.md). Il trasporto è la
// cartella cloud che lo studente usa già: Lode scrive e legge file, il servizio cloud li porta di là. Qui i file: il file di
// questo computer (.lode/dispositivi/<id>.json, l'unico che scrive), quelli degli altri, la cifratura facoltativa, la
// migrazione da dati.json, le copie in conflitto, le cartelle cloud e lo spostamento del vault. L'unione è in unione.mjs.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, copyFileSync, cpSync, scriviSicuro, adesso, rimanda } from './fs-v1.mjs';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import * as U from './unione.mjs';

export const FORMATO = 'lode-dispositivo';
const LODE = v => join(v, '.lode'), DISP = v => join(v, '.lode', 'dispositivi');
export const fileSegno = v => join(v, '.lode', 'sincronizzazione.json');
export const fileCifratura = v => join(v, '.lode', 'cifratura.json');
// accesa se c'è il segno, ma anche se il segno manca e ci sono già i file dei computer (tolto a mano, non ancora scaricato, un
// segnaposto .icloud): tornare a dati.json, che dopo la migrazione non c'è più, vorrebbe dire ripartire vuoti
// I segnaposto di iCloud (.sincronizzazione.json.icloud, .<id>.json.icloud: il file c'è ma non è ancora sul disco) contano
// come il file: partire vuoti e poi veder tornare i file vorrebbe dire scrivere sopra con lo stato vuoto.
// Spenta: «Smetti di sincronizzare» ha scritto .lode/sincronizzazione-spenta.json e tolto il segno (finché non si riaccende)
const haDispositivi = v => { try { return readdirSync(DISP(v)).some(n => /^\.?[0-9a-f]{16}\.json(\.icloud)?$/.test(n)); } catch { return false; } };
const segnaposto = (v, nome) => existsSync(join(LODE(v), `.${nome}.icloud`));
export const fileSpenta = v => join(v, '.lode', 'sincronizzazione-spenta.json');
const conSegno = v => existsSync(fileSegno(v)) || segnaposto(v, 'sincronizzazione.json');
export function spenta(v) { if (!v || conSegno(v)) return null; try { const j = JSON.parse(readFileSync(fileSpenta(v), 'utf8')); return j?.v === 1 ? j : null; } catch { return null; } }
export const attiva = v => !!v && (conSegno(v) || (!existsSync(fileSpenta(v)) && haDispositivi(v)));
// lo stop è in corso (il segno dello stop c'è da poco, il segno della sincronizzazione c'è ancora): si aspetta. Un segno dello
// stop vecchio con la sincronizzazione accesa (rimesso dal cestino del servizio cloud) non ferma niente
export function spegnendo(v, ora = adesso()) { try { const j = JSON.parse(readFileSync(fileSpenta(v), 'utf8')); return conSegno(v) && Math.abs(ora - Date.parse(j.spenta)) < 15 * 60e3; } catch { return false; } }
// la copia locale del proprio file è legata al vault (l'id nel segno): cambiando vault, i dati di quello di prima non entrano nel nuovo
// (idSegno: l'id del segno quando il segno non c'è più, dopo «Smetti di sincronizzare»)
function idVault(v, idSegno = '') {
  let x = String(idSegno || ''); if (!x) try { const j = JSON.parse(readFileSync(fileSegno(v), 'utf8')); x = String(j.id || j.attivata || ''); } catch { }
  return createHash('sha256').update(x || 'percorso:' + vero(v)).digest('hex').slice(0, 12);
}
export const fileLocale = (locale, vault, dispositivo, idSegno = '') => join(locale, 'sincronizzazione', `${dispositivo}-${idVault(vault, idSegno)}.json`);
export const nuovoId = () => randomBytes(8).toString('hex');
// il D di una barra partita senza dati (bloccati): i suoi valori di partenza, base delle modifiche fatte intanto
export const vuotoBarra = () => U.normalizza({ v: 1 });
// una base uguale al D vuoto della barra: le modifiche fatte coi dati bloccati entrano solo come record nuovi e conteggi
// (U.applica, soloNuovi): un record rifatto da capo dalla barra non deve scrivere sopra quello vero
let FIRMA_VUOTA = null;
export const baseVuota = b => !!b && U.firma(b) === (FIRMA_VUOTA ||= U.firma(vuotoBarra()));
// la firma di un D (stesso contenuto, stessa firma): main.mjs riconosce i dati.json che ha scritto lui
export const firmaDati = d => { try { return U.firma(d); } catch { return ''; } };
// i numeri di versione della vista valgono per tutto il processo: una finestra con un numero di un motore di prima (prima
// della password, di un altro vault) non trova la sua base e si confronta con la vista attuale, mai con un'altra a caso
let REV = 0;
// le versioni mandate alle finestre, per tutto il processo (non per motore): una finestra rimasta con il numero di un motore di
// prima (la password appena accesa, un id conteso) trova ancora la sua base. Legate al vault: mai la base di un altro vault
const SNAP = new Map();
const errore = (codice, testo) => Object.assign(new Error(testo), { codice });

/* ---------- cifratura: AES-256-GCM, chiave da password con scrypt ---------- */
// N = 2^17, r = 8, p = 1 (circa 128 MB e mezzo secondo, una volta per avvio). Il sale è per vault, in cifratura.json, con un
// valore di controllo (una frase fissa cifrata): se non si apre, la password è sbagliata. La password non si salva mai
export const SCRYPT = { N: 2 ** 17, r: 8, p: 1 };
const CONTROLLO = 'lode:controllo:v1', AAD_CONTROLLO = 'lode-cifratura', AAD_SPENTA = 'lode-spenta';
const deriva = (password, sale, { N, r, p }) => scryptSync(String(password).normalize('NFC'), sale, 32, { N, r, p, maxmem: 256 * N * r + 2 ** 20 });
export function cifra(chiave, testo, aad) {
  const nonce = randomBytes(12), c = createCipheriv('aes-256-gcm', chiave, nonce);   // nonce nuovo a ogni scrittura
  c.setAAD(Buffer.from(aad));
  const dati = Buffer.concat([c.update(testo, 'utf8'), c.final(), c.getAuthTag()]);
  return { nonce: nonce.toString('base64'), dati: dati.toString('base64') };
}
export function decifra(chiave, x, aad) {
  const nonce = Buffer.from(String(x?.nonce || ''), 'base64'), b = Buffer.from(String(x?.dati || ''), 'base64');
  if (nonce.length !== 12 || b.length < 16) throw errore('rotto', 'file cifrato rovinato');
  try {
    const d = createDecipheriv('aes-256-gcm', chiave, nonce); d.setAAD(Buffer.from(aad)); d.setAuthTag(b.subarray(-16));
    return Buffer.concat([d.update(b.subarray(0, -16)), d.final()]).toString('utf8');
  } catch { throw errore('password', 'non si apre con questa password'); }
}
// parametri robusti e sale di 16 byte: un cifratura.json scritto da altri con parametri deboli o strani si rifiuta. Anche
// quelli troppo pesanti (N = 2^20, r = 16, p = 4 vuol dire 2 GB e una quindicina di secondi a derivazione, con Lode ferma):
// solo quelli che Lode scrive (2^17, r = 8, p = 1) e quelli leggeri delle prove
const parametriOk = j => [2 ** 15, 2 ** 16, 2 ** 17, 2 ** 18].includes(j.N) && j.r === 8 && j.p === 1 && Buffer.from(String(j.sale || ''), 'base64').length === 16;
// cifratura.json come segnaposto di iCloud (.cifratura.json.icloud: c'è, ma non è ancora sul disco): il vault è cifrato, e
// trattarlo come in chiaro vorrebbe dire scrivere nella cartella cloud i dati in chiaro (o accendere una seconda cifratura)
export const cifraturaInArrivo = v => !!v && !existsSync(fileCifratura(v)) && segnaposto(v, 'cifratura.json');
export function leggiCifratura(vault) {
  let j; try { j = JSON.parse(readFileSync(fileCifratura(vault), 'utf8')); } catch (x) {
    if (x.code === 'ENOENT') { if (segnaposto(vault, 'cifratura.json')) throw errore('in_arrivo', 'I dati di Lode sono cifrati, ma .lode/cifratura.json non è ancora arrivato dal servizio cloud: aspetta che si scarichi.'); return null; }
    throw errore('cifratura', 'cifratura.json illeggibile');
  }
  const ok = j && j.v === 1 && j.kdf === 'scrypt' && parametriOk(j) && j.controllo?.nonce && j.controllo?.dati;
  if (!ok) throw errore('cifratura', 'cifratura.json non valido');
  return j;
}
export function chiaveDa(info, password) {
  const k = deriva(password, Buffer.from(info.sale, 'base64'), info);
  if (!provaChiave(info, k)) throw errore('password', 'password sbagliata');
  return k;
}
export function provaChiave(info, k) {
  try { const t = decifra(k, info.controllo, AAD_CONTROLLO); return t.length === CONTROLLO.length && timingSafeEqual(Buffer.from(t), Buffer.from(CONTROLLO)); } catch { return false; }
}
// la prova usa parametri più leggeri (test/sincronizza.mjs); l'app sempre SCRYPT
export function creaCifratura(password, parametri = SCRYPT) {
  if (String(password || '').length < 8) throw errore('corta', 'almeno 8 caratteri');
  const sale = randomBytes(16), k = deriva(password, sale, parametri);
  return { info: { v: 1, kdf: 'scrypt', ...parametri, sale: sale.toString('base64'), controllo: cifra(k, CONTROLLO, AAD_CONTROLLO), creata: new Date().toISOString() }, chiave: k };
}

/* ---------- un file di dispositivo ---------- */
const aad = id => `${FORMATO}|${id}`;
// istanza: cambia a ogni apertura del motore. Il proprio file riscritto da un'altra istanza mentre questo è aperto vuol dire
// due computer con lo stesso id (main.mjs ne prende uno nuovo: i contatori di due computer con lo stesso id non si sommano)
export function serializza(S, { dispositivo, chiave = null, ora = adesso(), sistema = process.platform, istanza = '' }) {
  const dentro = { scritto: ora, sistema, stato: S, ...(istanza ? { istanza } : {}) };
  return JSON.stringify(chiave ? { formato: FORMATO, v: 1, dispositivo, cifrato: cifra(chiave, JSON.stringify(dentro), aad(dispositivo)) } : { formato: FORMATO, v: 1, dispositivo, ...dentro });
}
// legge un file di dispositivo: { dispositivo, scritto, sistema, S } oppure un errore con il codice: 'rotto' (JSON troncato o
// rovinato), 'formato', 'cifrato' (manca la password), 'password' (un'altra password o un file manomesso), 'in_chiaro'
// (un file non cifrato in un vault cifrato: chi può scrivere nella cartella non deve poter infilare dati)
// riferimento: l'ora da cui si misura il limite nel futuro (unione.mjs, valida); fidato: l'id di questo computer, i cui
// registri non si scartano mai (il proprio file e la copia locale: scartarli e poi riscrivere li perderebbe per sempre)
export function leggiDispositivo(testo, { chiave = null, cifrataObbligatoria = false, riferimento = adesso(), fidato = null } = {}) {
  let j; try { j = JSON.parse(String(testo).replace(/^\uFEFF/, '')); } catch { throw errore('rotto', 'file rovinato o troncato'); }
  if (!j || j.formato !== FORMATO || j.v !== 1 || !U.ID_DISPOSITIVO.test(j.dispositivo || '')) throw errore('formato', 'non è un file di Lode');
  let dentro = j;
  if (j.cifrato) {
    if (!chiave) throw errore('cifrato', 'serve la password');
    try { dentro = JSON.parse(decifra(chiave, j.cifrato, aad(j.dispositivo))); } catch (x) { throw x.codice ? x : errore('rotto', 'file rovinato'); }
  } else if (cifrataObbligatoria) throw errore('in_chiaro', 'file in chiaro in un vault cifrato');
  const S = U.valida(dentro?.stato, j.dispositivo === fidato ? Infinity : Math.max(riferimento, adesso()));
  if (!S) throw errore('formato', 'stato non valido');
  return { dispositivo: j.dispositivo, scritto: Number(dentro.scritto) || 0, sistema: String(dentro.sistema || ''), istanza: String(dentro.istanza || ''), scartati: S.scartati || 0, S };
}

/* ---------- copie in conflitto ---------- */
// i nomi che i servizi cloud danno alle copie: «x 2.json» (iCloud), «x (conflicted copy …).json» e «x (copia in conflitto …)»
// (Dropbox), «x-NOMEPC.json» (OneDrive), «x (1).json» (Google Drive), «x.sync-conflict-AAAAMMGG-hhmmss-XXXXXXX.json» (Syncthing)
const COPIA = /^(.+?)(?: [2-9]| \(\d+\)| \([^)]*(?:conflict|conflitto)[^)]*\)|-[A-Z0-9][A-Z0-9-]{1,30}|\.sync-conflict-\d{8}-\d{6}-[A-Z0-9]{7})(\.[a-z]+)$/i;
export function originaleDi(nome) { const m = String(nome).match(COPIA); return m ? m[1] + m[2] : null; }
// le note Markdown in conflitto: Lode le segnala e basta (l'originale deve esserci accanto, se no non è una copia)
export function copieNote(vault, max = 50) {
  const out = [];
  const giro = (dir, rel) => {
    let nomi; try { nomi = readdirSync(dir); } catch { return; }
    const set = new Set(nomi);
    for (const n of nomi) {
      if (n.startsWith('.') || out.length >= max) continue;
      const p = join(dir, n); let s; try { s = statSync(p); } catch { continue; }
      if (s.isDirectory()) { giro(p, rel ? `${rel}/${n}` : n); continue; }
      if (!n.endsWith('.md')) continue;
      const o = originaleDi(n), chiara = /conflict|conflitto|\.sync-conflict-/i.test(n);
      if (o && o !== n && (chiara || set.has(o))) out.push({ file: rel ? `${rel}/${n}` : n, originale: rel ? `${rel}/${o}` : o });
    }
  };
  giro(vault, '');
  return out;
}
const spostaDaParte = (vault, p, ora) => {
  const dove = join(LODE(vault), 'conflitti-risolti'); mkdirSync(dove, { recursive: true });
  const d = join(dove, `${new Date(ora).toISOString().replace(/[:.]/g, '-')} ${basename(p)}`);
  renameSync(p, d); return d;
};
// i dati.json di prima (e le loro copie in conflitto): dati.json si migra, le copie in conflitto si mettono da parte e si
// segnalano (non hanno timbri: unite, una copia vecchia farebbe tornare i record cancellati e i valori di prima).
// dati.prev.json, dati.recupero*.json, dati.illeggibile-*.json e dati.migrato-*.json no: copie di sicurezza, restano dove sono
const DATI_VECCHI = n => n === 'dati.json' || (originaleDi(n) === 'dati.json' && !/^dati\.(prev|recupero|illeggibile|migrato)/.test(n));
// i codici di lettura che vogliono dire «cifrato con una chiave che non ho»: il file non si tocca
const ALTRA_CHIAVE = new Set(['cifrato', 'password']), LOCALE_NOME = 'copia locale di questo computer';
// le copie di cifratura.json (sale e controllo, niente di segreto): «cifratura 2.json» nel vault, e quelle salvate su questo
// computer a ogni accensione. Servono a ritrovare la chiave di prima con la stessa password (cifratura accesa su due computer)
export function cifratureVecchie(vault, locale) {
  const out = [];
  // un sale già visto non si riprova (ogni prova è mezzo secondo di scrypt)
  const sali = new Set();
  const prova = p => { try { const j = JSON.parse(readFileSync(p, 'utf8')); if (j?.v === 1 && j.kdf === 'scrypt' && j.sale && j.controllo && parametriOk(j) && !sali.has(j.sale)) { sali.add(j.sale); out.push(j); } } catch { } };
  try { for (const n of readdirSync(LODE(vault))) if (n !== 'cifratura.json' && originaleDi(n) === 'cifratura.json') prova(join(LODE(vault), n)); } catch { }
  try { for (const n of readdirSync(join(locale, 'cifrature')).sort().reverse()) prova(join(locale, 'cifrature', n)); } catch { }
  return out.slice(0, 4);
}
// la stessa password con i sali di prima: le chiavi con cui questo computer può aver cifrato i suoi file
export function chiaviVecchie(vault, locale, password) {
  const out = [];
  for (const info of cifratureVecchie(vault, locale)) { try { leggiCifraturaInfo(info); out.push(chiaveDa(info, password)); } catch { } }
  return out;
}
function leggiCifraturaInfo(j) { if (!parametriOk(j)) throw errore('cifratura', 'non valido'); }

/* ---------- il motore: lo stato di questo computer e quelli degli altri ---------- */
// apri() legge tutto e unisce: la copia locale del proprio file (in <locale>/sincronizzazione, che OneDrive e iCloud non
// tolgono dal disco), il proprio file nel vault, quelli degli altri, le copie in conflitto, i dati.json da migrare.
// Un file illeggibile si salta e si segnala: non si scrive mai al suo posto, e lo stato degli altri resta
// altreChiavi: le chiavi con cui questo computer può aver cifrato i suoi file prima (quella ricordata, quelle ritrovate con la
// stessa password e i sali di prima): i propri file si leggono anche con quelle e si riscrivono con la chiave del vault
// datiMiei(d): se un dati.json che ricompare dopo la migrazione l'ha scritto questo processo (le modifiche che aspettavano
// quando la sincronizzazione si è accesa altrove), { base }: il dati.json che questo processo aveva LETTO prima di scriverlo
// (null: non c'era, la barra è partita vuota). Solo allora si unisce, a tre vie da quella base. Gli altri si mettono da parte
export function apri({ vault, locale, dispositivo, chiave = null, altreChiavi = [], ritardo = 500, ora = () => adesso(), sistema = process.platform, log = () => { }, datiMiei = () => false }) {
  if (!U.ID_DISPOSITIVO.test(dispositivo)) throw new Error('id del dispositivo non valido');
  let cif;
  try { cif = leggiCifratura(vault); }
  catch (x) { if (x.codice === 'in_arrivo') return { bloccato: true, cifrato: true, codice: 'cifratura_in_arrivo', vault, errore: 'I dati di Lode in questo vault sono cifrati, ma .lode/cifratura.json non è ancora arrivato dal servizio cloud. Aspetta che si scarichi: intanto non scrivo niente nel vault.' }; throw x; }
  if (cif && (!chiave || !provaChiave(cif, chiave))) return { bloccato: true, cifrato: true, vault };
  // senza cifratura.json nessuna chiave: una chiave di un altro vault (o di prima) non cifra mai i file di questo
  if (!cif) chiave = null;
  const mio = join(DISP(vault), dispositivo + '.json'), specchio = fileLocale(locale, vault, dispositivo), istanza = nuovoId();
  let S = U.vuoto(), vistaAtt = null, rev = 0, firmaAtt = '', tScrivi = null, tentativi = 0, ultimoArrivo = 0, ultimoScritto = 0, sporco = false, conteso = false, chiuso = false;
  const visti = new Map(), altri = new Map(), problemi = new Map(), finestre = new Map(), daMigrare = [], vaultVero = vero(vault), daDisp = new Set();
  const leggiTesto = p => readFileSync(p, 'utf8');
  const unisciIn = x => { const prima = U.stabile(S); S = U.unisci(S, x); return U.stabile(S) !== prima; };
  // la vista per la barra, con __rev: la barra lo rimanda e le differenze si calcolano da lì (a tre vie)
  function rinnova() {
    const v = U.normalizza(U.vista(S)), f = U.firma(v);   // come la vede la barra (valori di partenza compresi)
    if (f === firmaAtt && vistaAtt) return false;
    vistaAtt = v; firmaAtt = f; rev = ++REV; SNAP.set(rev, { v, vault: vaultVero }); for (const k of SNAP.keys()) if (SNAP.size > 40 && k !== rev) SNAP.delete(k);
    return true;
  }
  // l'ultimo dati.migrato-<ms>.json: undefined se non c'è (prima migrazione), null se c'è ma non si legge
  function ultimaMigrazione() {
    let nomi = []; try { nomi = readdirSync(LODE(vault)); } catch { }
    const m = nomi.map(n => n.match(/^dati\.migrato-(\d+)\.json$/)).filter(Boolean).sort((a, b) => b[1] - a[1])[0];
    // c'è, ma come segnaposto di iCloud: non si legge, come se fosse illeggibile
    if (!m) return nomi.some(n => /^\.dati\.migrato-\d+\.json\.icloud$/.test(n)) ? null : undefined;
    try { const d = JSON.parse(readFileSync(join(LODE(vault), m[0]), 'utf8').replace(/^\uFEFF/, '')); if (d?.v !== 1) return null; if (d.imp) d.imp.chiave = ''; return d; } catch { return null; }
  }
  const copiaSuQuesto = (p, nome) => { mkdirSync(join(locale, 'copie'), { recursive: true }); copyFileSync(p, join(locale, 'copie', `${nome.replace(/\.json$/, '')}-prima-della-sincronizzazione-${ora()}.json`)); };
  function migra() {
    let n = 0;
    // «Smetti di sincronizzare» in corso (o fatta) su un altro computer: il dati.json che ricompare è il suo, con tutto
    if (existsSync(fileSpenta(vault)) && (spegnendo(vault, ora()) || !conSegno(vault))) return 0;
    let nomi = []; try { nomi = readdirSync(LODE(vault)); } catch { }
    // in un vault cifrato i dati.migrato-*.json (in chiaro) arrivati dopo la cifratura (segnaposti di iCloud, un computer
    // rimasto indietro) escono dal vault e vanno nella cartella di Lode su questo computer
    if (cif) for (const nome of nomi.filter(n => /^dati\.migrato-\d+\.json$/.test(n))) {
      try { const via = join(locale, 'copie', `in-chiaro-${ora()}`); mkdirSync(via, { recursive: true }); copyFileSync(join(LODE(vault), nome), join(via, nome)); rmSync(join(LODE(vault), nome)); log('Lode: vault cifrato: un dati.migrato in chiaro esce dal vault'); } catch { }
    }
    for (const nome of nomi.filter(DATI_VECCHI).sort()) {
      const p = join(LODE(vault), nome);
      if (daMigrare.some(x => x.p === p)) continue;   // già unito, aspetta solo che il proprio file sia scritto
      // in un vault cifrato un dati.json in chiaro non entra: chiunque scriva nella cartella potrebbe infilarci dati
      if (cif) { problemi.set(nome, 'in_chiaro'); continue; }
      try {
        // una copia in conflitto di dati.json: copia sul computer, poi in conflitti-risolti, e si dice. Non si unisce
        if (nome !== 'dati.json') { copiaSuQuesto(p, nome); spostaDaParte(vault, p, ora()); problemi.set(nome, 'dati_da_parte'); continue; }
        const st = statSync(p), testo = leggiTesto(p), d = JSON.parse(testo.replace(/^\uFEFF/, ''));
        if (!d || d.v !== 1) throw new Error('non è un dati.json di Lode');
        if (d.imp) d.imp.chiave = '';
        // copia di sicurezza sul computer, poi l'unione; il file esce di scena solo dopo che il proprio file è scritto
        copiaSuQuesto(p, nome);
        // un dati.json che ricompare dopo una migrazione (c'è un dati.migrato, o ci sono già i file dei computer). Se l'ha
        // scritto questo processo (le modifiche che aspettavano quando la sincronizzazione si è accesa altrove), si confronta
        // a tre vie con la versione da cui era partito (datiMiei). Se no l'ha scritto un computer con una versione di
        // Lode di prima, o rimasto spento con un dati.json vecchio, o partito vuoto (segnaposti di iCloud): non si sa da cosa
        // sia partito, e unito cancellerebbe o riporterebbe indietro quello che è cambiato dopo. Si mette da parte e si dice,
        // come le copie in conflitto: le modifiche fatte lì restano nella copia, niente si cancella
        // La base del confronto è la versione che questo processo ha letto davvero (non l'ultimo dati.migrato: un computer
        // rimasto spento è partito da un dati.json più vecchio, e unito da lì cancellerebbe quello che è cambiato dopo)
        const giaSincronizzato = ultimaMigrazione() !== undefined || haDispositivi(vault), mia = datiMiei(d);
        if (!giaSincronizzato) unisciIn(U.daDati(d, st.mtimeMs));
        else if (mia && typeof mia === 'object') {
          const b = mia.base && mia.base.v === 1 ? U.normalizza({ ...mia.base, imp: { ...mia.base.imp, chiave: '' } }) : vuotoBarra();
          U.applica(S, b, U.normalizza(d), dispositivo, ora());
        } else { spostaDaParte(vault, p, ora()); problemi.set(nome, 'dati_da_parte'); log('Lode: un dati.json ricomparso dopo la migrazione, messo da parte'); continue; }
        n++;
        daMigrare.push({ p, firma: `${st.mtimeMs}|${st.size}` });
      } catch (x) { problemi.set(nome, x.message); log(`Lode: ${nome} non migrato`, x.message); }
    }
    return n;
  }
  function fineMigrazione() {
    for (const { p, firma } of daMigrare.splice(0)) {
      try {
        // riscritto dall'altro computer dopo che l'ho letto: resta, e al prossimo giro entrano anche le modifiche nuove
        const st = statSync(p); if (`${st.mtimeMs}|${st.size}` !== firma) { log('Lode: dati.json cambiato intanto, lo riprendo'); continue; }
        renameSync(p, join(LODE(vault), `dati.migrato-${ora()}.json`)); problemi.delete(basename(p));
      } catch (x) { log('Lode: non sposto', basename(p), x.message); }
    }
  }
  // gli altri computer e le copie in conflitto. Restituisce true se lo stato è cambiato
  function leggiAltri({ tutti = false, avvio = false } = {}) {
    let cambiato = false, nomi = [];
    try { nomi = readdirSync(DISP(vault)); } catch { }
    // i file che non ci sono più (tolti dall'altro computer, rinominati): il loro problema non c'è più
    const ora0 = ora();
    for (const nome of [...daDisp]) if (!nomi.includes(nome)) { daDisp.delete(nome); problemi.delete(nome); visti.delete(nome); }
    for (const nome of nomi) {
      if (nome.startsWith('.') || !nome.endsWith('.json') || nome.includes('.tmp-')) continue;
      const p = join(DISP(vault), nome); let st; try { st = statSync(p); } catch { continue; }
      const firmaFile = `${st.mtimeMs}|${st.size}`;
      // il proprio file si rilegge solo se l'ha cambiato qualcun altro: un secondo computer con lo stesso id (una cartella
      // dei dati copiata), un backup del servizio cloud rimesso a posto. Unire è sempre sicuro: niente va perso
      if (nome === dispositivo + '.json' && (tutti || visti.get(nome) === firmaFile)) continue;
      if (!tutti && visti.get(nome) === firmaFile) continue;
      const proprio = /^[0-9a-f]{16}\.json$/.test(nome);
      try {
        const x = leggiDispositivo(leggiTesto(p), { chiave, cifrataObbligatoria: !!cif, riferimento: Math.max(ora(), S.o?.[0] || 0), fidato: dispositivo });
        if (proprio && x.dispositivo + '.json' !== nome) throw errore('formato', 'il nome non corrisponde');
        if (unisciIn(x.S)) { cambiato = true; if (x.dispositivo !== dispositivo) ultimoArrivo = avvio ? Math.max(ultimoArrivo, Math.min(x.scritto, ora())) : ora(); }
        visti.set(nome, firmaFile); problemi.delete(nome);
        if (x.scartati) { problemi.set(nome, 'timbri'); daDisp.add(nome); }
        // l'orologio di questo computer sembra indietro (un file scritto da un altro computer «nel futuro» di ore): le modifiche
        // fatte qui potrebbero perdere contro quelle fatte prima altrove. Lo si dice
        if (x.dispositivo !== dispositivo && x.scritto - ora0 > 2 * 3600e3) problemi.set('orologio', 'indietro');   // registri con l'ora troppo nel futuro: scartati, e si dice
        if (proprio && x.dispositivo !== dispositivo) altri.set(x.dispositivo, { scritto: x.scritto, sistema: x.sistema });
        else if (proprio) { if (x.istanza !== istanza) conteso = true; log('Lode: il file di questo computer l\'ha cambiato qualcun altro (stesso id?): unito'); }
        else { spostaDaParte(vault, p, ora()); visti.delete(nome); log('Lode: copia in conflitto unita e messa da parte:', nome); }
      } catch (x) { visti.set(nome, firmaFile); problemi.set(nome, x.codice || 'illeggibile'); daDisp.add(nome); log(`Lode: ${nome} saltato (${x.codice || x.message})`); }
    }
    if (migra()) cambiato = true;
    return cambiato;
  }
  // il proprio stato: copia locale ∪ file nel vault (uno dei due può mancare: iCloud che toglie i file, un computer nuovo).
  // Il file nel vault, in un vault cifrato, vale solo se è cifrato (chi scrive nella cartella non deve poter infilare dati col
  // nome di questo computer); lo stato in chiaro di prima si accetta solo dalla copia locale, che sta su questo computer.
  // Un proprio file che c'è ma non si legge non si riscrive mai senza averlo prima copiato in <locale>/copie/illeggibili-<ms>/;
  // e se è cifrato con una chiave che non ho (cifratura accesa su due computer con password diverse, cifratura.json tolto o non
  // ancora arrivato) non si scrive proprio niente: il motore resta bloccato e lo dice
  let nelVault = null, inChiaro = false, riscrivi = false, chiaveDiversa = false;
  const illeggibili = [];
  for (const p of [specchio, mio]) {
    const nomeP = p === specchio ? LOCALE_NOME : basename(p);
    let t; try { t = leggiTesto(p); } catch (x) { if (x.code !== 'ENOENT') { problemi.set(nomeP, 'illeggibile'); log('Lode: proprio file non letto', x.message); } continue; }
    let letto = null, err = null;
    // senza cifratura.json un proprio file cifrato non si apre con le chiavi di prima: si riscriverebbe in chiaro
    const prove = cif ? [chiave, ...altreChiavi.filter(k => Buffer.isBuffer(k) && !k.equals(chiave))] : [null];
    for (const [i, k] of prove.entries()) {
      try { letto = leggiDispositivo(t, { chiave: k, cifrataObbligatoria: p === mio && !!cif, fidato: dispositivo }); if (i > 0) riscrivi = true; break; }
      catch (x) { err = x; if (!ALTRA_CHIAVE.has(x.codice)) break; }
    }
    if (!letto) {
      illeggibili.push(p); problemi.set(nomeP, err?.codice || 'illeggibile'); log('Lode: proprio file non letto', err?.codice || err?.message);
      if (ALTRA_CHIAVE.has(err?.codice)) chiaveDiversa = true;
      continue;
    }
    unisciIn(letto.S);
    if (p === mio) { nelVault = U.stabile(letto.S); const st = statSync(p); visti.set(dispositivo + '.json', `${st.mtimeMs}|${st.size}`); }
    if (cif && !JSON.parse(t).cifrato) inChiaro = true;
  }
  if (illeggibili.length) {
    const via = join(locale, 'copie', `illeggibili-${ora()}`);
    try { mkdirSync(via, { recursive: true }); for (const p of illeggibili) copyFileSync(p, join(via, p === specchio ? 'copia-locale-' + basename(p) : basename(p))); }
    catch (x) { log('Lode: copia dei file illeggibili non riuscita', x.message); return { bloccato: true, cifrato: !!cif, codice: 'copia', errore: 'Un file di questo computer non si legge e non riesco a copiarlo da parte: non tocco niente.', vault }; }
  }
  if (chiaveDiversa) return { bloccato: true, cifrato: !!cif, codice: 'chiave_diversa', vault,
    errore: cif ? 'I dati di questo computer sono cifrati con un\'altra password (la cifratura è stata accesa anche su un altro computer, con una password diversa). Non li tocco: sono anche in una copia sul computer. Scrivi qui la password che usavi su questo computer, poi quella attuale degli altri computer.'
      : 'I dati di questo computer sono cifrati, ma nel vault manca .lode/cifratura.json (tolto, o non ancora arrivato dal servizio cloud). Non tocco niente: rimettilo (cestino del servizio cloud) o aspetta che arrivi.' };
  // due cifratura.json (il servizio cloud ne ha tenuto uno e ha fatto una copia dell'altro): lo si dice
  try { for (const n of readdirSync(LODE(vault))) if (n !== 'cifratura.json' && originaleDi(n) === 'cifratura.json') problemi.set(n, 'cifratura_doppia'); } catch { }
  leggiAltri({ tutti: true, avvio: true });
  rinnova();
  // scrittura: copia locale e file nel vault, a ritardo. Se il vault non risponde (offline, bloccato) si riprova; la copia locale c'è già
  function scriviOra({ soloLocale = false } = {}) {
    clearTimeout(tScrivi); tScrivi = null;
    if (!sporco) return true;
    const testo = serializza(S, { dispositivo, chiave, ora: ora(), sistema, istanza });
    try { mkdirSync(dirname(specchio), { recursive: true }); scriviSicuro(specchio, testo); problemi.delete(LOCALE_NOME); } catch (x) { log('Lode: copia locale non scritta', x.message); }
    if (soloLocale) return true;   // la cifratura è appena arrivata dall'altro computer: niente più file in chiaro nel vault
    try {
      mkdirSync(DISP(vault), { recursive: true }); scriviSicuro(mio, testo);
      sporco = false; tentativi = 0; ultimoScritto = ora(); problemi.delete('scrittura'); problemi.delete(basename(mio));   // riscritto: il problema del proprio file non c'è più
      try { const st = statSync(mio); visti.set(dispositivo + '.json', `${st.mtimeMs}|${st.size}`); } catch { }
      fineMigrazione();
      return true;
    } catch (x) {
      problemi.set('scrittura', x.code || x.message); log('Lode: file del computer non scritto, riprovo', x.message);
      tScrivi = rimanda(scriviOra, Math.min(60e3, 1000 * 2 ** Math.min(6, tentativi++)));
      return false;
    }
  }
  const programma = () => { if (chiuso) return; sporco = true; if (!tScrivi) tScrivi = rimanda(scriviOra, ritardo); };
  // il primo giro scrive subito se il proprio file nel vault manca o è indietro, o se c'era qualcosa da migrare (e solo dopo
  // sposta i dati.json: prima di quel momento la migrazione si può rifare, con gli stessi timbri)
  // (e se la cifratura è appena stata accesa, il file in chiaro si riscrive cifrato)
  if (nelVault !== U.stabile(S) || daMigrare.length || inChiaro || riscrivi || illeggibili.length) { sporco = true; scriviOra(); }

  const ricordaFinestra = (chi, r, d) => {
    if (chi == null) return;
    const m = finestre.get(chi) || new Map(); m.set(r, d); m.ultimo = r;
    for (const k of m.keys()) if (m.size > 6 && k !== r) m.delete(k);
    finestre.set(chi, m);
  };
  return {
    bloccato: false, cifrato: !!cif, vault, dispositivo,
    // la vista per una finestra (dati:leggi, dati:cambiati)
    per(chi) { ricordaFinestra(chi, rev, vistaAtt); return { ...structuredClone(vistaAtt), __rev: rev }; },
    vista: () => vistaAtt,
    // l'ultima versione che la finestra ha visto o mandato (la base delle sue prossime modifiche)
    baseDi(chi) { const m = finestre.get(chi); return structuredClone((m && m.get(m.ultimo)) || vistaAtt); },
    // la barra salva: differenze dalla versione da cui è partita, timbri nuovi, unione. perChi: la barra non ha qualcosa che
    // c'è (arrivato da un altro computer): le si rimanda la vista. perAltri: le altre finestre devono aggiornarsi
    // baseEsplicita: la versione che la finestra aveva quando il motore di prima si è chiuso (password arrivata dall'altro
    // computer: le modifiche fatte intanto entrano allo sblocco)
    // Una finestra con una versione che non si trova (di un altro vault, o senza numero): la base non è sicura, e quello che
    // le manca non vuol dire «cancellato». Entrano solo aggiunte e modifiche, e le si rimanda la vista
    salva(doc, chi, baseEsplicita = null) {
      const r = Number.isInteger(doc?.__rev) ? doc.__rev : null, m = finestre.get(chi);
      const chiaveBase = r ?? m?.ultimo, s = r != null ? SNAP.get(r) : null;
      const trovata = baseEsplicita || (chiaveBase != null && m?.get(chiaveBase)) || (s && s.vault === vaultVero ? s.v : null);
      const pulito = { ...doc }; delete pulito.__rev; delete pulito.__errore;
      ricordaFinestra(chi, chiaveBase ?? rev, pulito);
      const vuota = baseVuota(baseEsplicita);
      const n = U.applica(S, trovata || vistaAtt, pulito, dispositivo, ora(), { senzaCancellazioni: !trovata, soloNuovi: vuota });
      const cambiata = n ? rinnova() : false;
      if (n) programma();
      return { n, perAltri: cambiata, perChi: !trovata || U.firma(pulito) !== firmaAtt };
    },
    // un file è cambiato nella cartella (watcher o controllo periodico): true se la vista è cambiata
    ricarica() { const c = leggiAltri(); if (c) programma(); return c ? rinnova() : false; },
    scriviOra,
    // lo stato serializzato come il proprio file (cifrato se il vault lo è): «Smetti di sincronizzare» lo lascia nell'archivio
    testo: () => serializza(S, { dispositivo, chiave, ora: ora(), sistema, istanza }),
    // la prova che lo stop l'ha fatto chi ha la chiave (vault cifrato): gli altri computer la controllano prima di scrivere dati.json
    provaSpenta: (archivio, spenta) => chiave ? cifra(chiave, `lode:spenta|${archivio}|${spenta}`, AAD_SPENTA) : null,
    // una volta sola: chiuso con soloLocale (la cifratura è arrivata), un secondo chiudi() non deve scrivere in chiaro nel vault
    // niente: non scrive più (la sincronizzazione è stata spenta e i file dei computer sono già stati messi da parte)
    chiudi(opz = {}) { if (chiuso) return; if (!opz.niente) scriviOra(opz); clearTimeout(tScrivi); tScrivi = null; chiuso = true; },
    stato: () => ({ dispositivo, cifrato: !!cif, conteso, altri: [...altri].map(([id, x]) => ({ id, ...x })), ultimoArrivo, ultimoScritto, problemi: [...problemi].map(([file, codice]) => ({ file, codice })), daScrivere: sporco }),
    // per le prove: lo stato interno
    _stato: () => S,
  };
}

/* ---------- accendere la sincronizzazione o la cifratura su un vault ---------- */
// il segno si scrive una volta sola: mai riscritto (nessun conflitto possibile)
export function segna(vault, ora = adesso()) {
  if (existsSync(fileSegno(vault))) return false;
  mkdirSync(LODE(vault), { recursive: true });
  try { rmSync(fileSpenta(vault), { force: true }); } catch { }   // riaccesa dopo «Smetti di sincronizzare»
  scriviSicuro(fileSegno(vault), JSON.stringify({ v: 1, attivata: new Date(ora).toISOString(), id: nuovoId() }, null, 1));
  return true;
}
// la cifratura: cifratura.json nel vault, e i vecchi file in chiaro (dati.json di prima, copie di sicurezza) escono dal vault
// e vanno nella cartella di Lode su questo computer. Il chiamante poi riscrive il proprio file cifrato (apri con la chiave)
// Anche i file in chiaro dei computer (gli altri e le loro copie in conflitto, ognuno con TUTTO lo stato) escono dal vault: il
// chiamante prima rilegge e unisce (i loro dati sono già nel file di questo computer) e ogni computer ha la sua copia locale.
// Una copia di cifratura.json (sale e controllo: niente di segreto) resta su questo computer, per ritrovare la chiave se il
// servizio cloud tiene quella di un altro computer che l'ha accesa insieme (chiaviVecchie)
export function accendiCifratura(vault, locale, password, parametri) {
  if (existsSync(fileCifratura(vault)) || segnaposto(vault, 'cifratura.json')) throw errore('gia', 'la cifratura è già attiva');
  const { info, chiave } = creaCifratura(password, parametri);
  scriviSicuro(fileCifratura(vault), JSON.stringify(info, null, 1));
  try { mkdirSync(join(locale, 'cifrature'), { recursive: true }); scriviSicuro(join(locale, 'cifrature', `cifratura-${adesso()}.json`), JSON.stringify(info, null, 1)); } catch { }
  const via = join(locale, 'copie', `in-chiaro-${adesso()}`);
  const sposta = (da, a) => { mkdirSync(dirname(a), { recursive: true }); try { renameSync(da, a); } catch { try { cpSync(da, a, { recursive: true }); rmSync(da, { recursive: true, force: true }); } catch { } } };
  let nomi = []; try { nomi = readdirSync(LODE(vault)); } catch { }
  // anche gli archivi di uno stop di prima (sincronizzazione-spenta-<ms>/: dati.json, file dei computer e unione in chiaro)
  for (const n of nomi.filter(n => /^dati.*\.json$/.test(n) || /^sincronizzazione-(spenta|dimenticata)/.test(n))) sposta(join(LODE(vault), n), join(via, n));
  try { const cr = join(LODE(vault), 'conflitti-risolti'); if (existsSync(cr)) { mkdirSync(via, { recursive: true }); renameSync(cr, join(via, 'conflitti-risolti')); } } catch { }
  let disp = []; try { disp = readdirSync(DISP(vault)); } catch { }
  for (const n of disp) {
    if (!n.endsWith('.json') || n.includes('.tmp-')) continue;
    const p = join(DISP(vault), n);
    try { if (JSON.parse(readFileSync(p, 'utf8')).cifrato) continue; } catch { }   // rovinato o in chiaro: fuori anche lui
    sposta(p, join(via, 'dispositivi', n));
  }
  return chiave;
}

// la cifratura è arrivata dall'altro computer e questo non ha ancora la password: il suo file in chiaro esce dal vault (la
// copia locale ha gli stessi dati) e torna, cifrato, appena lo studente la scrive
export function togliInChiaro(vault, locale, dispositivo) {
  const p = join(DISP(vault), dispositivo + '.json'), specchio = fileLocale(locale, vault, dispositivo);
  try {
    if (JSON.parse(readFileSync(p, 'utf8')).cifrato) return false;
    const via = join(locale, 'copie', `in-chiaro-${adesso()}`); mkdirSync(via, { recursive: true });
    copyFileSync(p, join(via, basename(p)));
    // senza copia locale (cartella dei dati nuova) il file diventa la copia locale: allo sblocco si unisce, non resta solo in copie/
    if (!existsSync(specchio)) { mkdirSync(dirname(specchio), { recursive: true }); copyFileSync(p, specchio); }
    rmSync(p); return true;
  } catch { return false; }
}

/* ---------- smettere di sincronizzare ---------- */
// «Smetti di sincronizzare» (il computer che lo chiede, con i dati aperti: se sono cifrati, dopo la password). In ordine, così
// chi legge a metà non perde niente: 1. copia di sicurezza di tutto .lode su questo computer (<locale>/copie/); 2. il segno
// .lode/sincronizzazione-spenta.json (da qui gli altri non migrano più un dati.json che ricompare); 3. .lode/dati.json con
// l'unione di tutti i computer, in chiaro; 4. segno, cifratura, file dei computer, dati.migrato e conflitti risolti vanno in
// .lode/sincronizzazione-spenta-<ms>/ (restano lì: gli altri computer ci leggono lo stato di questo, cifrato se lo era).
// Gli altri computer se ne accorgono (spenta()) e smettono anche loro con seguiSpenta()
const fileDatiDi = v => join(v, '.lode', 'dati.json');
const DA_ARCHIVIARE = n => n === 'sincronizzazione.json' || n === 'dispositivi' || n === 'conflitti-risolti' || n === 'dati.migrato' || /^dati\.migrato-\d+\.json$/.test(n) || originaleDi(n) === 'cifratura.json' || n === 'cifratura.json';
export function smetti({ vault, locale, motore, ora = adesso() }) {
  if (!motore || motore.bloccato) throw errore('bloccato', 'Prima scrivi la password: per smettere riscrivo i dati di Lode in chiaro in .lode/dati.json.');
  motore.ricarica(); motore.scriviOra();   // gli ultimi file degli altri computer entrano prima
  const D = U.normalizza(U.vista(motore._stato())), unione = motore.testo();
  let idSegno = ''; try { idSegno = String(JSON.parse(readFileSync(fileSegno(vault), 'utf8')).id || ''); } catch { }
  const nome = `sincronizzazione-spenta-${ora}`, archivio = join(LODE(vault), nome), copia = join(locale, 'copie', nome);
  mkdirSync(copia, { recursive: true });
  cpSync(LODE(vault), copia, { recursive: true, filter: src => !/sincronizzazione-spenta/.test(basename(src)) && !src.includes('.tmp-') });
  scriviSicuro(join(copia, 'dati-unione.json'), JSON.stringify(D, null, 1));
  const spostati = [];
  try {
    const quando = new Date(ora).toISOString(), prova = motore.provaSpenta?.(nome, quando) || null;
    scriviSicuro(fileSpenta(vault), JSON.stringify({ v: 1, spenta: quando, da: motore.dispositivo, archivio: nome, id: idSegno, ...(prova ? { prova } : {}) }, null, 1));
    if (existsSync(fileDatiDi(vault))) try { renameSync(fileDatiDi(vault), join(copia, 'dati.json-di-prima')); } catch { }
    scriviSicuro(fileDatiDi(vault), JSON.stringify(D, null, 1));
    mkdirSync(archivio, { recursive: true });
    // lo stato (con i timbri) da cui è fatto dati.json: chi lo segue capisce cosa è cambiato in dati.json dopo lo stop
    scriviSicuro(join(archivio, 'unione.json'), unione);
    let nomi = []; try { nomi = readdirSync(LODE(vault)); } catch { }
    // il segno per ultimo: finché c'è, gli altri computer aspettano
    for (const n of nomi.filter(DA_ARCHIVIARE).sort((a, b) => (a === 'sincronizzazione.json') - (b === 'sincronizzazione.json'))) { renameSync(join(LODE(vault), n), join(archivio, n)); spostati.push(n); }
  } catch (x) {
    // a metà (una cartella bloccata, il disco pieno): si torna com'era, la sincronizzazione resta accesa
    for (const n of spostati.reverse()) try { renameSync(join(archivio, n), join(LODE(vault), n)); } catch { }
    try { rmSync(fileDatiDi(vault), { force: true }); } catch { }
    try { rmSync(fileSpenta(vault), { force: true }); } catch { }
    throw errore('smetti', `non riesco a spegnerla (${x.code || x.message}): resta accesa, non ho cambiato niente`);
  }
  motore.chiudi({ niente: true });
  return { D, archivio: nome, copia };
}
// un altro computer: la sincronizzazione è stata spenta altrove. S: lo stato che questo computer conosce (il motore aperto, o la
// sua copia locale letta qui se Lode era chiusa); inAttesa: le modifiche fatte coi dati bloccati, con la loro base. Se questo
// computer sa qualcosa che non è nel dati.json scritto dall'altro (modifiche arrivate dopo), dati.json si riscrive con l'unione
// (lo stato dell'altro è nell'archivio, cifrato con la stessa chiave). Se non si può unire, i dati di questo computer restano
// in una copia (<locale>/copie/) e lo si dice: niente si perde
// Vault cifrato (lo sa questo computer: cifratoQui, la sua copia locale cifrata, o cifratura.json nell'archivio): lo stop vale
// solo se il segno ha la prova fatta con la chiave (smetti, provaSpenta) e la chiave apre la cifratura.json dell'archivio. Se
// no chiunque possa scrivere nella cartella cloud farebbe riscrivere qui tutti i dati in chiaro in dati.json: non si scrive
// niente ('non_autenticato' se la chiave c'è e la prova no; 'da_unire' se manca la password, che si chiede nella scheda)
export function cifraturaArchiviata(vault) {
  const sp = spenta(vault); if (!sp) return null;
  try { const j = JSON.parse(readFileSync(join(LODE(vault), String(sp.archivio || '').replace(/[\\/]/g, ''), 'cifratura.json'), 'utf8')); return j?.v === 1 && parametriOk(j) && j.controllo ? j : null; } catch { return null; }
}
const provaSpentaOk = (sp, k) => { try { return decifra(k, sp.prova, AAD_SPENTA) === `lode:spenta|${sp.archivio}|${sp.spenta}`; } catch { return false; } };
export function seguiSpenta({ vault, locale, dispositivo, S = null, chiavi = [], inAttesa = [], ora = adesso(), cifratoQui = false }) {
  const sp = spenta(vault); if (!sp) return null;
  const f = fileDatiDi(vault), archivio = join(LODE(vault), String(sp.archivio || '').replace(/[\\/]/g, ''));
  const specchio0 = fileLocale(locale, vault, dispositivo, sp.id);
  let specchioCifrato = false; try { specchioCifrato = !!JSON.parse(readFileSync(specchio0, 'utf8')).cifrato; } catch { }
  const archCif = cifraturaArchiviata(vault);
  const copiaCifrata = p => { try { const c = join(locale, 'copie'), a = join(c, `dati-cifrati-di-questo-computer-${String(sp.archivio || 'spenta').replace(/[\\/]/g, '')}.json`); if (existsSync(p) && !existsSync(a)) { mkdirSync(c, { recursive: true }); copyFileSync(p, a); } } catch { } };
  // anche una chiave passata dal chiamante vuol dire «vault cifrato» (i dati aperti qui erano cifrati)
  const cifrato = !!archCif || existsSync(join(archivio, 'cifratura.json')) || specchioCifrato || !!cifratoQui || chiavi.some(k => Buffer.isBuffer(k));
  if (cifrato) {
    const buone = chiavi.filter(k => Buffer.isBuffer(k) && archCif && provaChiave(archCif, k));
    const k = buone.find(k => provaSpentaOk(sp, k));
    if (!k) {
      // i dati che sapeva solo questo computer restano nella sua copia locale cifrata: una copia anche in copie/, e lo si dice
      copiaCifrata(specchio0);
      return { esito: buone.length || (!archCif && chiavi.length) ? 'non_autenticato' : 'da_unire', cifrato: true, spenta: sp };
    }
    chiavi = [k, ...chiavi.filter(x => x !== k)];
  }
  const leggi = (p, fid) => { let t; try { t = readFileSync(p, 'utf8'); } catch { return null; } for (const k of [null, ...chiavi]) { try { return leggiDispositivo(t, { chiave: k, fidato: fid }).S; } catch { } } return undefined; };
  let dA = null; try { dA = JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')); if (dA?.v !== 1) dA = null; } catch { }
  // senza lo stato di questo computer (Lode era chiusa): la sua copia locale
  let mioLetto = false, daUnire = false;
  if (!S) {
    const specchio = fileLocale(locale, vault, dispositivo, sp.id), x = leggi(specchio, dispositivo);
    if (x === undefined && !inAttesa.length) {   // non si apre: resta lì, una copia in copie/, si dice
      copiaCifrata(specchio);
      return { esito: 'da_unire', cifrato: specchioCifrato, spenta: sp };
    }
    if (x) { S = x; mioLetto = specchio; } else if (x === undefined) daUnire = true;
  }
  // l'archivio: lo stato da cui è fatto dati.json (unione.json) e quelli di tutti i computer
  const base = leggi(join(archivio, 'unione.json'), null);
  let Sa = base || null;
  let nomi = []; try { nomi = readdirSync(join(archivio, 'dispositivi')); } catch { }
  for (const n of nomi) { if (!n.endsWith('.json') || n.includes('.tmp-')) continue; const x = leggi(join(archivio, 'dispositivi', n), null); if (x) Sa = Sa ? U.unisci(Sa, x) : x; }
  let esito = 'uguale', D = dA, Sm = null;
  if (S) {
    if (base && dA) {
      // tutto quello che si sa, più quello che è cambiato in dati.json dopo lo stop (a tre vie dalla sua base)
      Sm = U.unisci(Sa, S);
      U.applica(Sm, U.normalizza(U.vista(base)), dA, dispositivo, ora);
      const v = U.normalizza(U.vista(Sm));
      if (U.firma(v) !== U.firma(U.normalizza(dA))) { esito = 'unito'; D = v; }
    } else if (!dA) { esito = 'unito'; Sm = Sa ? U.unisci(Sa, S) : S; D = U.normalizza(U.vista(Sm)); }
    else if (U.firma(U.normalizza(U.vista(S))) !== U.firma(U.normalizza(dA))) esito = 'non_unito';   // archivio illeggibile: resta dati.json, e una copia
  }
  // le modifiche fatte coi dati bloccati: sopra dati.json, dalla loro base
  if (inAttesa.length && D) {
    const S2 = Sm || U.daDati(D, 1), prima = U.firma(U.normalizza(U.vista(S2)));
    for (const x of inAttesa) { const b = x.base || vuotoBarra(); U.applica(S2, b, x.d, dispositivo, ora, { soloNuovi: baseVuota(b) }); }
    if (U.firma(U.normalizza(U.vista(S2))) !== prima) { D = U.normalizza(U.vista(S2)); Sm = S2; if (esito !== 'non_unito') esito = 'unito'; }
  }
  const copie = join(locale, 'copie'); mkdirSync(copie, { recursive: true });
  if (S) scriviSicuro(join(copie, `dati-di-questo-computer-alla-fine-${ora}.json`), JSON.stringify(U.normalizza(U.vista(S)), null, 1));
  if (esito === 'unito' && D) {
    if (dA) scriviSicuro(join(copie, `dati-prima-di-unire-${ora}.json`), JSON.stringify(dA, null, 1));
    // prima lo stato con i timbri, poi dati.json: chi viene dopo trova la base giusta
    if (Sm) try { mkdirSync(archivio, { recursive: true }); scriviSicuro(join(archivio, 'unione.json'), serializza(Sm, { dispositivo, chiave: cifrato ? chiavi[0] || null : null, ora })); } catch { }
    scriviSicuro(f, JSON.stringify(D, null, 1));
  }
  // il proprio file riscritto dopo lo stop (prima di accorgersene): nell'archivio anche lui
  try { const mio = join(DISP(vault), dispositivo + '.json'); if (existsSync(mio)) { mkdirSync(join(archivio, 'dispositivi'), { recursive: true }); renameSync(mio, join(archivio, 'dispositivi', `${dispositivo}-dopo-${ora}.json`)); } } catch { }
  try { rmdirSync(DISP(vault)); } catch { }   // la cartella vuota se ne va (se non è vuota resta)
  if (mioLetto) try { renameSync(mioLetto, mioLetto.replace(/\.json$/, '.spenta.json')); } catch { }
  return { esito: daUnire && esito !== 'non_unito' ? 'da_unire' : esito, spenta: sp };
}

// «Ho dimenticato la password: ricomincia senza i dati cifrati». Come smetti() ma senza unione (i dati cifrati non si aprono):
// segno, cifratura, file dei computer e segno dello stop vanno in .lode/sincronizzazione-dimenticata-<ms>/ (e una copia di
// tutto .lode su questo computer, in <locale>/copie/). Lode riparte da .lode/dati.json, vuoto
export function ricomincia({ vault, locale, ora = adesso() }) {
  const nome = `sincronizzazione-dimenticata-${ora}`, archivio = join(LODE(vault), nome), copia = join(locale, 'copie', nome);
  mkdirSync(copia, { recursive: true });
  try { cpSync(LODE(vault), copia, { recursive: true, filter: src => !src.includes('.tmp-') }); } catch { }
  mkdirSync(archivio, { recursive: true });
  let nomi = []; try { nomi = readdirSync(LODE(vault)); } catch { }
  for (const n of nomi.filter(n => DA_ARCHIVIARE(n) || n === 'sincronizzazione-spenta.json' || n === '.cifratura.json.icloud').sort((a, b) => (a === 'sincronizzazione.json') - (b === 'sincronizzazione.json'))) {
    try { renameSync(join(LODE(vault), n), join(archivio, n)); } catch { }
  }
  return { archivio: nome, copia };
}

/* ---------- le cartelle cloud del computer ---------- */
// solo quelle che ci sono davvero. Il servizio si riconosce dal percorso (per la riga «Sincronizzato con …»)
export function servizioDi(p) {
  const s = String(p || '');
  return /com~apple~CloudDocs|iCloudDrive|iCloud Drive/i.test(s) ? 'iCloud Drive' : /OneDrive/i.test(s) ? 'OneDrive' : /Dropbox/i.test(s) ? 'Dropbox'
    : /GoogleDrive|Google Drive|My Drive|Il mio Drive/i.test(s) ? 'Google Drive' : /Syncthing|[\\/]Sync([\\/]|$)/.test(s) ? 'Syncthing' : null;
}
export function cartelleCloud({ piattaforma = process.platform, casa = homedir(), env = process.env, esiste = existsSync, elenca = d => { try { return readdirSync(d); } catch { return []; } } } = {}) {
  const out = [], visto = new Set(), j = piattaforma === 'win32' ? (...x) => x.join('\\').replace(/\\+/g, '\\') : (...x) => x.join('/').replace(/\/+/g, '/');
  const metti = (servizio, p, nota = '') => { if (!p || !esiste(p)) return; const k = p.toLowerCase(); if (visto.has(k)) return; visto.add(k); out.push({ servizio, percorso: p, ...(nota ? { nota } : {}) }); };
  const drive = d => { const sotto = elenca(d).find(n => /^(My Drive|Il mio Drive|Mon Drive|Mi unidad)$/.test(n)); return sotto ? j(d, sotto) : d; };
  if (piattaforma === 'darwin') {
    metti('iCloud Drive', j(casa, 'Library', 'Mobile Documents', 'com~apple~CloudDocs'));
    const cs = j(casa, 'Library', 'CloudStorage');
    for (const n of elenca(cs).sort()) {
      if (/^OneDrive/i.test(n)) metti('OneDrive', j(cs, n), n.replace(/^OneDrive-?/i, ''));
      else if (/^Dropbox/i.test(n)) metti('Dropbox', j(cs, n));
      else if (/^GoogleDrive/i.test(n)) metti('Google Drive', drive(j(cs, n)), n.replace(/^GoogleDrive-?/i, ''));
    }
    metti('Dropbox', j(casa, 'Dropbox'));
  } else if (piattaforma === 'win32') {
    for (const k of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) metti('OneDrive', env[k]);
    for (const n of elenca(casa).sort()) if (/^OneDrive/i.test(n)) metti('OneDrive', j(casa, n));
    metti('Dropbox', j(casa, 'Dropbox'));
    metti('iCloud Drive', j(casa, 'iCloudDrive'));
    metti('Google Drive', drive(j(casa, 'Google Drive')));
    metti('Google Drive', drive('G:\\'), 'G:');
  } else {
    metti('Dropbox', j(casa, 'Dropbox'));
    metti('Syncthing', j(casa, 'Sync'));
  }
  return out;
}

/* ---------- spostare il vault nella cartella cloud ---------- */
// copia completa → verifica (numero di file e impronte) → rename → passaggio (configurazione e Obsidian) → la vecchia
// cartella diventa «Lode (copia prima della sincronizzazione)». Un registro di bordo (<locale>/spostamento.json) dice a che
// punto si è: interrotto a metà, riprendiSpostamento() finisce o torna indietro. La configurazione punta sempre a un vault completo
const SALTA = n => n.includes('.tmp-') || n === '.DS_Store' || n === 'Thumbs.db' || n === 'desktop.ini';
function elencaFile(radice) {
  const out = [];
  const giro = rel => {
    for (const n of readdirSync(join(radice, rel))) {
      if (SALTA(n)) continue;
      const r = rel ? join(rel, n) : n, s = statSync(join(radice, r));
      if (s.isDirectory()) giro(r); else if (s.isFile()) out.push(r);
    }
  };
  giro('');
  return out.sort();
}
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
// le differenze fra due cartelle: file mancanti, in più, o con un'impronta diversa
export function confrontaCartelle(a, b, { escludi = () => false } = {}) {
  const x = elencaFile(a).filter(f => !escludi(f)), y = elencaFile(b).filter(f => !escludi(f)), sy = new Set(y), diversi = [];
  for (const f of x) if (!sy.has(f) || hash(join(a, f)) !== hash(join(b, f))) diversi.push(f);
  const sx = new Set(x);
  for (const f of y) if (!sx.has(f)) diversi.push(f);
  return { n: x.length, diversi };
}
const registro = locale => join(locale, 'spostamento.json');
const scriviRegistro = (locale, x) => { mkdirSync(locale, { recursive: true }); scriviSicuro(registro(locale), JSON.stringify(x, null, 1)); };
const libero = (cartella, nome) => { let p = join(cartella, nome); for (let k = 2; existsSync(p); k++) p = join(cartella, `${nome} ${k}`); return p; };
const SEGNO_REL = join('.lode', 'sincronizzazione.json');
// il percorso vero: sul Mac con «Scrivania e Documenti» in iCloud, Documenti/Lode è già dentro iCloud Drive
export const vero = p => { try { return realpathSync.native(p); } catch { return resolve(p); } };
export const dentroA = (figlio, padre) => { const r = relative(vero(padre), vero(figlio)); return r === '' || (!r.startsWith('..') && !r.includes(':') && !r.startsWith(sep)); };
// lascia da parte la vecchia cartella (rinominata) quando si può: su Windows può essere aperta in Obsidian, e allora resta dov'è
function lasciaVecchia(da) {
  const copia = libero(dirname(da), 'Lode (copia prima della sincronizzazione)');
  try { renameSync(da, copia); return copia; } catch { return null; }
}
export async function spostaVault({ da, cartella, locale, passa, avanza = () => { }, ferma = null, ora = () => adesso() }) {
  da = resolve(da); cartella = resolve(cartella);
  if (!existsSync(da) || !statSync(da).isDirectory()) throw errore('manca', 'il vault non c\'è');
  if (!existsSync(cartella)) throw errore('cartella', 'la cartella scelta non c\'è');
  if (dentroA(cartella, da)) throw errore('dentro', 'la cartella scelta è dentro il vault');
  if (dentroA(da, cartella)) return { giaDentro: true, vault: da };   // il vault è già nella cartella cloud: niente da spostare
  const fermati = fase => { if (ferma === fase) throw errore('interrotto', `interrotto dopo «${fase}» (prova)`); };
  const a = libero(cartella, 'Lode'), tmp = join(cartella, `Lode.copia-in-corso-${ora()}`);
  scriviRegistro(locale, { fase: 'copia', da, a, tmp, inizio: new Date(ora()).toISOString() });
  try {
    const file = elencaFile(da);
    for (const [i, f] of file.entries()) {
      mkdirSync(dirname(join(tmp, f)), { recursive: true }); copyFileSync(join(da, f), join(tmp, f));
      if (i % 20 === 0) { avanza({ fase: 'copia', p: i / Math.max(1, file.length), testo: `Copio ${i} di ${file.length} file` }); await new Promise(r => setImmediate(r)); }
      if (i === Math.floor(file.length / 2)) fermati('meta-copia');
    }
    fermati('copia');
    // verifica: stesso elenco, stesse impronte. Un file cambiato durante la copia (Obsidian aperto) si ricopia, al massimo due volte
    avanza({ fase: 'verifica', p: 1, testo: `Controllo ${file.length} file` });
    let c = confrontaCartelle(da, tmp);
    for (let k = 0; c.diversi.length && k < 2; k++) {
      for (const f of c.diversi) { if (existsSync(join(da, f))) { mkdirSync(dirname(join(tmp, f)), { recursive: true }); copyFileSync(join(da, f), join(tmp, f)); } else rmSync(join(tmp, f), { force: true }); }
      c = confrontaCartelle(da, tmp);
    }
    if (c.diversi.length) throw errore('verifica', `la copia non è uguale (${c.diversi.slice(0, 3).join(', ')}): un file cambiava mentre copiavo. Chiudi Obsidian e riprova`);
    fermati('verifica');
    segna(tmp, ora());
    scriviRegistro(locale, { fase: 'copiato', da, a, tmp, n: c.n });
    renameSync(tmp, a);
    fermati('rename');
  } catch (x) {
    // prima del passaggio la configurazione punta ancora al vecchio vault, intatto: la copia temporanea si toglie
    if (x.codice !== 'interrotto') { try { rmSync(tmp, { recursive: true, force: true }); } catch { } try { rmSync(registro(locale), { force: true }); } catch { } }
    throw x;
  }
  passa(a);
  scriviRegistro(locale, { fase: 'passato', da, a });
  fermati('passaggio');
  const copia = lasciaVecchia(da);
  rmSync(registro(locale), { force: true });
  avanza({ fase: 'fatto', p: 1, testo: 'Fatto' });
  return { vault: a, copia, vecchia: copia ? null : da, n: elencaFile(a).length };
}
// all'avvio, prima di aprire il vault: uno spostamento interrotto si finisce o si annulla
export function riprendiSpostamento({ locale, vaultAttuale, passa }) {
  let j; try { j = JSON.parse(readFileSync(registro(locale), 'utf8')); } catch { return { esito: 'niente' }; }
  const fine = x => { try { rmSync(registro(locale), { force: true }); } catch { } return x; };
  const attuale = vaultAttuale && resolve(vaultAttuale);
  if (j.fase === 'copia' || (j.fase === 'copiato' && !existsSync(j.a) && attuale !== resolve(j.a))) {
    try { if (j.tmp && basename(j.tmp).startsWith('Lode.copia-in-corso-')) rmSync(j.tmp, { recursive: true, force: true }); } catch { }
    return fine({ esito: 'annullato', vault: j.da });
  }
  if (j.fase === 'copiato') {
    // la copia completa c'è: se la configurazione è già passata, o se la copia è ancora uguale al vecchio vault, si finisce
    if (attuale !== resolve(j.a)) {
      const c = existsSync(j.da) ? confrontaCartelle(j.da, j.a, { escludi: f => f === SEGNO_REL }) : { diversi: ['manca il vecchio vault'] };
      if (c.diversi.length) {
        // il vecchio vault è cambiato dopo (Obsidian usato intanto): resta lui, la copia si mette da parte (non si cancella)
        // fuori dalla cartella cloud (è un vault intero, anche in chiaro): in <locale>/copie, se no accanto (e lo si dice)
        let via = null, fuori = false;
        try { mkdirSync(join(locale, 'copie'), { recursive: true }); via = libero(join(locale, 'copie'), 'Lode (copia non finita)'); renameSync(j.a, via); fuori = true; }
        catch { try { via = libero(dirname(j.a), 'Lode (copia non finita)'); renameSync(j.a, via); } catch { via = null; } }
        return fine({ esito: 'annullato', vault: j.da, copia: via, nellaNuvola: !!via && !fuori });
      }
      passa(j.a);
    }
    j.fase = 'passato';
  }
  if (j.fase === 'passato') {
    if (attuale !== resolve(j.a)) passa(j.a);
    const copia = existsSync(j.da) ? lasciaVecchia(j.da) : null;
    return fine({ esito: 'finito', vault: j.a, copia });
  }
  return fine({ esito: 'niente' });
}
