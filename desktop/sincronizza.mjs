// Il collegamento fra l'app e il motore della sincronizzazione v2 (desktop/sync/motore.mjs, docs/SINCRONIZZAZIONE.md).
// Qui stanno le cose che il motore non fa perché non ha timer né Electron: il portachiavi (safeStorage), l'impronta della
// macchina, le cartelle cloud, lo spostamento del vault, i giri (watcher, ogni 30 s, al risveglio, 1,5 s dopo una modifica),
// e la traduzione fra il D della barra e gli eventi (desktop/sync/differenze.mjs, con una BASE per finestra e per versione).
// Con la sincronizzazione mai accesa (conf.sync assente) qui non succede niente: Lode usa .lode/dati.json come prima.
// conf.sync = { motore: true, cloud: <cartella cloud> | null }: motore vuol dire che i dati stanno nel diario (anche dopo
// «Smetti», con il vault fuori dal cloud: cloud null). <userData>/sync/spostamento.json: lo spostamento in corso.
import * as fsp from 'node:fs/promises';
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, utimesSync, rmSync, realpathSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname, basename, relative, isAbsolute, delimiter } from 'node:path';
import { creaMotore, MINIMO, scrittoDaVecchia } from './sync/motore.mjs';
import { LISTE } from './sync/schema.mjs';
import { differenze, normalizza } from './sync/differenze.mjs';
import { t } from './lingua.mjs';

const MAC = process.platform === 'darwin', WIN = process.platform === 'win32';
// p sta dentro cartella? Si confrontano i percorsi veri (realpath): un vault raggiunto da un collegamento a una cartella
// sincronizzata non è «fuori dal cloud» (prima si confrontavano le lettere, e Lode prendeva la strada della copia)
const vero = p => { try { return realpathSync.native(p); } catch { return p; } };
const dentro = (cartella, p) => { const r = relative(vero(cartella), vero(p)); return !!r && !r.startsWith('..') && !isAbsolute(r) || r === ''; };

// l'impronta della macchina (⊕1): una cartella dei dati copiata da un altro computer prende un dev nuovo prima di pubblicare
function impronta() {
  try {
    let id = process.env.LODE_MACCHINA || '';
    if (!id && MAC) id = (execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8', timeout: 4000 }).match(/"IOPlatformUUID" = "([^"]+)"/) || [])[1] || '';
    else if (!id && WIN) id = (execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', timeout: 4000, windowsHide: true }).match(/MachineGuid\s+REG_SZ\s+(\S+)/) || [])[1] || '';
    else if (!id) id = ['/etc/machine-id', '/var/lib/dbus/machine-id'].map(f => { try { return readFileSync(f, 'utf8').trim(); } catch { return ''; } }).find(Boolean) || '';
    return id ? createHash('sha256').update('lode|' + id).digest('hex').slice(0, 32) : null;
  } catch { return null; }
}

// le cartelle cloud di questo computer (iCloud Drive, OneDrive, Dropbox, Google Drive, Syncthing). Nelle prove LODE_CLOUD
export function cartelleCloud() {
  if (process.env.LODE_CLOUD) return process.env.LODE_CLOUD.split(delimiter).filter(Boolean).map(p => ({ servizio: 'la cartella cloud di prova', percorso: p }));
  const h = homedir(), out = [], c = (servizio, percorso) => { try { if (statSync(percorso).isDirectory()) out.push({ servizio, percorso }); } catch { } };
  if (MAC) {
    const icloud = join(h, 'Library', 'Mobile Documents', 'com~apple~CloudDocs');
    c('iCloud Drive', icloud);
    // «Scrivania e Documenti» di iCloud: ~/Documents e ~/Desktop si sincronizzano, e iCloud Drive mostra Desktop e Documents
    // (tutti e due: l'opzione li porta insieme). Il vault predefinito ~/Documents/Lode è allora già nel cloud. Non verificato su
    // un iCloud vero (le prove non toccano le cartelle cloud vere): se il riconoscimento sbaglia, il vault resta dov'è
    if (existsSync(join(icloud, 'Desktop')) && existsSync(join(icloud, 'Documents'))) { c('iCloud Drive', join(h, 'Documents')); c('iCloud Drive', join(h, 'Desktop')); }
    let cs = []; try { cs = readdirSync(join(h, 'Library', 'CloudStorage')); } catch { }
    for (const n of cs) {
      const p = join(h, 'Library', 'CloudStorage', n);
      if (/^OneDrive/.test(n)) c('OneDrive', p); else if (/^Dropbox/.test(n)) c('Dropbox', p);
      else if (/^GoogleDrive/.test(n)) for (const d of ['Il mio Drive', 'My Drive']) c('Google Drive', join(p, d));
    }
  }
  if (WIN) {
    for (const k of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) if (process.env[k]) c('OneDrive', process.env[k]); c('iCloud Drive', join(h, 'iCloudDrive'));
    // Google Drive per desktop monta un'unità virtuale (di solito G:) con «Il mio Drive» o «My Drive» alla radice: prima non si
    // guardava, e il benvenuto prometteva Google Drive che poi non compariva. Non verificato su un Windows vero
    for (const l of 'DEFGHIJKLMNOPQRSTUVWXYZ') for (const d of ['Il mio Drive', 'My Drive']) c('Google Drive', `${l}:\\${d}`);
  }
  c('Dropbox', join(h, 'Dropbox')); c('Syncthing', join(h, 'Sync'));
  return out.filter((x, i) => out.findIndex(y => y.percorso === x.percorso) === i);
}
const servizioDi = p => cartelleCloud().find(c => dentro(c.percorso, p)) || null;

// i vault di Lode già sincronizzati (con .lode/sync) dentro una cartella cloud, fino a due livelli
function vaultNelCloud(c) {
  const out = [], guarda = (p, prof) => {
    let l = []; try { l = readdirSync(p, { withFileTypes: true }); } catch { return; }
    if (existsSync(join(p, '.lode', 'sync'))) { out.push(p); return; }
    if (prof < 2) for (const d of l) if (d.isDirectory() && !d.name.startsWith('.')) guarda(join(p, d.name), prof + 1);
  };
  guarda(c.percorso, 0); return out;
}

// il portachiavi (§10.2): le chiavi per id di gruppo, cifrate con safeStorage (Portachiavi del Mac, DPAPI su Windows,
// libsecret su Linux). Su Linux con basic_text non si ricorda niente, e la scheda lo dice. Nelle prove (solo in sviluppo)
// LODE_PORTACHIAVI_FINTO le tiene in chiaro in un file, perché il Portachiavi del Mac chiederebbe il permesso con una finestra
function portachiavi(app, safeStorage) {
  const file = () => join(app.getPath('userData'), 'sync', 'portachiavi.json');
  // il finto (chiavi in esadecimale in chiaro in un file) solo in sviluppo: nell'app pacchettizzata la variabile non conta
  const finto = !!process.env.LODE_PORTACHIAVI_FINTO && !app.isPackaged;
  let negate = 0;   // chiavi che il Portachiavi non ha dato (permesso negato, firma ad hoc cambiata dopo un aggiornamento)
  const disponibile = () => finto || (!!safeStorage?.isEncryptionAvailable?.() && !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text'));
  const tutto = () => { try { return JSON.parse(readFileSync(file(), 'utf8')) || {}; } catch { return {}; } };
  return {
    disponibile,
    leggi() {
      if (!disponibile()) return [];
      negate = 0;
      return Object.entries(tutto()).map(([g, x]) => { try { return [g, Buffer.from(finto ? x : safeStorage.decryptString(Buffer.from(x, 'base64')), 'hex')]; } catch { negate++; return null; } }).filter(Boolean);
    },
    negate: () => negate,
    // quante voci ci sono nel file, anche quelle che safeStorage non decifra (per mostrare «Dimentica la password qui»)
    voci: () => Object.keys(tutto()).length,
    // «Dimentica la password qui» e «Smetti»: via TUTTO il file, anche le voci che non si decifrano adesso (permesso negato dopo
    // un aggiornamento): prima restavano e, col permesso ridato, il gruppo si riapriva da solo con la chiave «dimenticata»
    svuota() { try { rmSync(file(), { force: true }); } catch { } negate = 0; },
    scrivi(g, k) {
      if (!disponibile()) return;
      const t = tutto();
      if (k) t[g] = finto ? k.toString('hex') : safeStorage.encryptString(k.toString('hex')).toString('base64'); else delete t[g];
      mkdirSync(dirname(file()), { recursive: true }); writeFileSync(file(), JSON.stringify(t));
    },
  };
}

// la copia delle note nella cartella cloud: tutto tranne .lode/ (i dati di Lode arrivano come gruppo nuovo, cifrato se serve:
// dati.prev.json, dati.recupero.json e le copie del dati.json di prima non vanno mai nel cloud). Si può rifare: un file con la
// stessa dimensione e la stessa data c'è già e si salta. Niente si cancella, né qui né nel vault di prima.
// Asincrona, con una pausa ogni 25 file: prima era tutta sincrona e bloccava il processo main (e la barra) per tutta la copia,
// decine di secondi con GB di PDF su NTFS o ext4. Un file tenuto aperto da un antivirus (EBUSY, EPERM su Windows) si riprova
const OCCUPATO = ['EBUSY', 'EPERM'];
const pausa = ms => new Promise(r => setTimeout(r, ms));
async function riprovaFile(f) { for (let i = 0; ; i++) { try { return await f(); } catch (x) { if (i >= 5 || !OCCUPATO.includes(x?.code)) throw x; await pausa(100 * 2 ** i); } } }
async function copiaNote(da, a, { dopo = null } = {}) {
  let n = 0, visti = 0;
  const meta = vero(a);
  const giu = async rel => {
    for (const d of await fsp.readdir(join(da, rel), { withFileTypes: true })) {
      const r = rel ? join(rel, d.name) : d.name;
      if (r === '.lode' || d.name.includes('.tmp-') || /^\..+\.icloud$/.test(d.name)) continue;
      // la destinazione dentro il vault (una cartella scelta per sbaglio dentro il vault): mai copiarla dentro se stessa
      if (d.isDirectory() && vero(join(da, r)) === meta) continue;
      if (d.isDirectory()) { await fsp.mkdir(join(a, r), { recursive: true }); await giu(r); continue; }
      if (!d.isFile()) continue;
      if (++visti % 25 === 0) await new Promise(x => setImmediate(x));
      const s = await fsp.stat(join(da, r)); let t = null; try { t = await fsp.stat(join(a, r)); } catch { }
      if (t && t.size === s.size && Math.abs(t.mtimeMs - s.mtimeMs) < 2000) continue;
      await fsp.mkdir(dirname(join(a, r)), { recursive: true });
      await riprovaFile(() => fsp.copyFile(join(da, r), join(a, r))); await fsp.utimes(join(a, r), s.atime, s.mtime);
      dopo?.(++n);
    }
  };
  await fsp.mkdir(a, { recursive: true }); await giu('');
  return n;
}
// la verifica: ogni file del vault di prima (tranne .lode) c'è, con la stessa dimensione
async function verificaCopia(da, a) {
  const giu = async rel => {
    for (const d of await fsp.readdir(join(da, rel), { withFileTypes: true })) {
      const r = rel ? join(rel, d.name) : d.name;
      if (r === '.lode' || d.name.includes('.tmp-') || /^\..+\.icloud$/.test(d.name)) continue;
      if (d.isDirectory()) { await giu(r); continue; }
      if (!d.isFile()) continue;
      const x = await fsp.stat(join(a, r)).catch(() => null);
      if (x?.size !== (await fsp.stat(join(da, r))).size) throw Object.assign(new Error(`la copia di ${r} non è uguale all'originale`), { code: 'COPIA', file: r });
    }
  };
  await giu('');
}
// un errore della copia in una frase per lo studente (prima arrivava in inglese, col percorso completo che contiene il suo nome)
function fraseCopia(x) {
  const f = x?.file || (x?.path ? basename(x.path) : '');
  if (OCCUPATO.includes(x?.code)) return f ? t('desktop.sync-file-occupato-nome', { file: f }) : t('desktop.sync-file-occupato');
  if (x?.code === 'ENOSPC') return t('desktop.sync-disco-pieno');
  if (x?.code === 'EACCES') return f ? t('desktop.sync-permesso-nome', { file: f }) : t('desktop.sync-permesso');
  if (x?.code === 'COPIA') return t('desktop.sync-copia-diversa', { file: f });
  return t('desktop.sync-copia-non-riuscita');
}

// un dati.json v1 con dati veri (esami, carte, sessioni, lezioni… o un nome): quello di un computer che usava Lode da solo
// Anche un dati.json col segno lode2 che una Lode vecchia (o Lode 2 con la sincronizzazione spenta) ha riempito con i dati dello
// studente (scrittoDaVecchia): prima si scartava proprio quello, e i dati restavano solo nel file nascosto (giro 3)
const conDati = D => !!D && typeof D === 'object' && D.v === 1 && (!D.lode2 || scrittoDaVecchia(D, null)) && (LISTE.some(l => Array.isArray(D[l]) && D[l].length) || (!!D.profilo?.nome && D.profilo.nome !== MINIMO(null).profilo.nome));

export function creaSincronizzazione({ app, safeStorage, dialog, powerMonitor, conf, salvaConf, vault, impostaVault, manda, tutte, scriviTutto = () => { }, scriviDati = () => { } }) {
  const prova = !!process.env.LODE_PROVA;
  const pc = portachiavi(app, safeStorage);
  const SPOST = () => join(app.getPath('userData'), 'sync', 'spostamento.json');
  const SOSP = () => join(app.getPath('userData'), 'sync', 'in-sospeso.json');
  const AVVIO = Date.now();
  let motore = null, fermo = null, ultimo = 0, coda = Promise.resolve(), tGiro = 0, tOgni = 0, firma = null, VER = 0, chiuso = false, riapro = null;
  // sospese: le operazioni che il diario non ha preso (disco pieno, EACCES): si ritentano a ogni giro e a chiudi(), e stanno anche
  // in <userData>/sync/in-sospeso.json (se si riesce a scriverlo) per il prossimo avvio. Prima si perdevano in silenzio e la
  // scheda diceva «in pari». recupero: il file dove sono finiti i dati della barra quando il diario non poteva prenderli (fermo,
  // sola lettura): la scheda lo dice
  let sospese = [], recupero = null, recuperi = 0, errScrittura = null;
  // accendo: il motore sta leggendo dati.json per l'accensione (da scriviTutto subito prima di attiva() a conf.sync scritto). I salvataggi della barra in quel momento non
  // vanno a dati.json (la migrazione l'ha già letto, o il minimo l'ha già coperto, e con il vault nel cloud dati.json e
  // dati.prev.json tornerebbero in chiaro in un gruppo cifrato): si tengono qui e vanno a salva() appena conf.sync c'è, o a
  // dati.json se l'accensione non riesce. tenuti: finestra → { D, ops }. copiando: la copia del vault nel cloud in corso
  // (giro 3) accendo vale solo dal momento in cui il motore legge dati.json (subito prima di motore.attiva) a conf.sync scritto:
  // prima valeva anche per i 30 s di attesa col vault nel cloud e per tutta la finestra «Un'altra cartella…», e un'uscita lì
  // perdeva i tenuti. accensione: c'è un'accensione in corso (per non farne due insieme). pendenti: finestra → l'ultimo D mandato
  // a salva() e non ancora preso dal diario (la barra crede di aver salvato appena manda): se chiudi() scade, o Windows si spegne,
  // va in un file di recupero (salvaPendenti), mai perso
  let accendo = false, copiando = false, accensione = null;
  const tenuti = new Map(), caricamenti = new Map(), pendenti = new Map();
  const basi = new Map(), vuoti = new Map();   // finestra → Map(ver → { B, meta }); finestra → VUOTO() della barra
  const acceso = () => !!conf().sync?.motore;
  const inFila = f => (coda = coda.then(f, f));   // le operazioni sul motore una alla volta, nell'ordine in cui arrivano
  const spostamento = () => { try { return JSON.parse(readFileSync(SPOST(), 'utf8')); } catch { return null; } };

  function nuovoMotore(v) {
    return creaMotore({
      // fs con fsync: la scrittura del diario è confermata solo quando è sul disco (§5.1)
      fs: { ...fsp, writeFile: async (p, d) => { const h = await fsp.open(p, 'w'); try { await h.writeFile(d); await h.sync(); } finally { await h.close(); } } },
      vault: v, dati: app.getPath('userData'), orologio: () => Date.now(), casuale: () => randomBytes(4).readUInt32BE() / 2 ** 32,
      macchina: impronta(), attendi: ms => new Promise(r => setTimeout(r, ms)), portachiavi: pc,
      registro: (...x) => { if (process.env.LODE_SYNC_REGISTRO) console.log('sync:', ...x); },
    });
  }
  async function apri() {
    fermo = null;
    try { motore = nuovoMotore(vault()); await motore.apri(); }
    catch (x) { console.error('Lode: il diario della sincronizzazione non si legge', x); fermo = x.code || x.message || 'lettura'; return; }
    // uno spostamento finito sul motore (corrente.json punta già al vault nuovo) ma non nella configurazione: si chiude qui
    const s = spostamento(), v = motore?.stato().vault;
    if (s && v && v === s.a && vault() !== s.a) await finisciSpostamento(s);
    // il vault del diario (corrente.json) comanda: l'app guarda la stessa cartella in cui il motore scrive
    else if (v && v !== vault() && existsSync(v)) await impostaVault(v, { ricarica: false });
    // le operazioni rimaste in sospeso dall'ultima volta (disco pieno all'uscita)
    try { const j = JSON.parse(readFileSync(SOSP(), 'utf8')); if (Array.isArray(j?.ops)) sospese = [...j.ops, ...sospese]; } catch { }
    if (sospese.length) await ritenta();
    ultimo = Date.now();
  }
  function salvaSospese() {
    try { if (sospese.length) { mkdirSync(dirname(SOSP()), { recursive: true }); writeFileSync(SOSP(), JSON.stringify({ ops: sospese })); } else rmSync(SOSP(), { force: true }); } catch { }
  }
  // i dati della barra in un file a parte, quando il diario non li può prendere: mai buttati (come dati.recupero.json senza sync)
  // Un file per finestra e per caricamento, mai sovrascritto da un'altra finestra o dopo «Riprova» (che ricarica la pagina: la
  // barra riparte vuota). Prima c'era un solo recupero-<AVVIO>.json, riscritto per intero a ogni salvataggio: le modifiche fatte
  // prima di «Riprova», o nell'altra finestra, sparivano. Dentro lo stesso caricamento il D della finestra contiene il precedente
  function salvaRecupero(D, id = 0) {
    const nome = `recupero-${AVVIO}-${id}-${caricamenti.get(id) || 0}.json`;
    for (const dir of [join(app.getPath('userData'), 'sync'), app.getPath('userData')]) {
      try { mkdirSync(dir, { recursive: true }); if (!existsSync(join(dir, nome))) recuperi++; writeFileSync(join(dir, nome), JSON.stringify(D)); recupero = join(dir, nome); return true; } catch { }
    }
    return false;
  }
  async function ritenta() {
    while (sospese.length && motore && !fermo) {
      try { await motore.modifica(sospese[0]); } catch (x) { errScrittura = x.code || 'scrittura'; console.error('Lode: il diario non prende ancora le modifiche', x); break; }
      sospese.shift();
    }
    if (!sospese.length) errScrittura = null;
    salvaSospese();
  }
  // un giro: il motore legge, pubblica, Orario.md; poi la vista nuova alle finestre se è cambiata
  const giro = () => inFila(async () => {
    if (!motore || fermo) return;
    if (sospese.length) await ritenta();
    try { await motore.arrivati(); ultimo = Date.now(); } catch (x) { console.error('Lode: giro della sincronizzazione', x); }
    spingi();
  });
  const giroDopo = (ms = 1500) => { clearTimeout(tGiro); tGiro = setTimeout(giro, ms); };

  // la vista per una finestra, con la sua BASE (normalizzata coi predefiniti della barra) e la META di quella versione.
  // L è la vista del motore (calcolata una volta per versione della piega): non si ricalcola per ogni finestra
  function vistaPer(id, L = motore?.locale()) {
    if (!L?.D || L.solaLettura) return null;
    const D = { ...L.D, imp: { ...L.D.imp, ultimoSuggerimento: conf().syncLocale?.ultimoSuggerimento || 0 } };
    if (D.codice?.eventi?.length > 2000) D.codice = { ...D.codice, eventi: D.codice.eventi.slice(-2000) };   // il limite della barra (js/codice/diario.js)
    const ver = ++VER, b = basi.get(id) || new Map();
    b.set(ver, { B: normalizza(D, vuoti.get(id) || {}), meta: { ...L.meta } });
    // le versioni vecchie: si tengono le ultime 6 DI QUESTA FINESTRA (prima si potava col contatore VER, comune a tutte: con barra e
    // quadro aperti bastavano 3 viste perché sparisse la versione con cui una finestra bloccata da confirm() avrebbe salvato)
    const ks = [...b.keys()]; while (ks.length > 6) b.delete(ks.shift());
    basi.set(id, b);
    return { ...D, __ver: ver };
  }
  // la firma della vista è la sua versione nel motore (prima JSON.stringify di tutto D a ogni giro)
  function spingi(forza = false) {
    const L = motore && !fermo ? motore.locale() : null;
    const f = L ? L.versione : null;
    if (f !== firma || forza) { firma = f; for (const w of tutte()) { const v = vistaPer(w.webContents.id, L); if (v) w.webContents.send('dati:cambiati', v); } }
    manda('sync:stato', stato());
  }

  async function salva(id, D, x = {}) {
    if (!D || typeof D !== 'object') return;
    // il diario non può prendere niente (fermo, dati.json che non si legge ancora: sola lettura): i dati della barra in un file a
    // parte, e la scheda lo dice. Prima si buttavano e la scheda diceva «Niente è stato cancellato»
    const L = motore && !fermo ? motore.locale() : null;
    if (!L?.D || L.solaLettura) { salvaRecupero(D, id); manda('sync:stato', stato()); return; }
    let b = basi.get(id);
    const conVer = x.ver != null && x.ver !== '';
    let base = conVer ? b?.get(Number(x.ver)) : (b?.size ? b.get(Math.max(...b.keys())) : null);
    // la versione con cui la finestra salva non c'è più (potata): MAI le differenze da un'altra BASE, che scambierebbero per «torna
    // indietro» tutto quello che è arrivato dopo (voti di nuovo vuoti, record creati altrove cancellati, senza conflitti). Si
    // mandano solo le creazioni, le voci nuove dei diari e i ripassi detti dalla barra; il D intero va in un file di recupero
    let parziale = false;
    if (!base && conVer && b?.size) { base = b.get(Math.max(...b.keys())); parziale = true; salvaRecupero(D, id); }
    // una finestra che non ha mai ricevuto una vista (accesa mentre era aperta): si parte da quella di adesso, mai da niente
    if (!base) { vistaPer(id, L); b = basi.get(id); base = b?.get(VER); if (!base) return; }
    if (D.imp?.ultimoSuggerimento !== undefined && D.imp.ultimoSuggerimento !== conf().syncLocale?.ultimoSuggerimento) { conf().syncLocale = { ...conf().syncLocale, ultimoSuggerimento: D.imp.ultimoSuggerimento }; salvaConf(); }
    let ops = differenze(base.B, D, { esplicite: Array.isArray(x.ops) ? x.ops : [], meta: base.meta });
    if (parziale) ops = ops.filter(o => o.tipo === 'crea' || o.tipo === 'eventi' || (o.tipo === 'ripasso' && o.q != null));
    if (sospese.length) await ritenta();
    let i = 0;
    // in ordine: se una non entra (disco pieno), lei e le successive aspettano in sospese, dietro a quelle di prima
    if (!sospese.length) for (; i < ops.length; i++) {
      let r;
      try { r = await motore.modifica(ops[i]); } catch (e) { errScrittura = e.code || 'scrittura'; console.error('Lode: il diario non prende la modifica', e); break; }
      if (r?.h && ops[i].tipo === 'campo') base.meta[ops[i].percorso] = r.h;
    }
    if (i < ops.length) { sospese.push(...ops.slice(i)); salvaSospese(); }
    if (!parziale) base.B = normalizza(D, vuoti.get(id) || {});   // la finestra ora ha questo: un altro salva con la stessa versione parte da qui
    if (ops.length) { spingi(); giroDopo(); }
  }

  function stato() {
    const s = motore && !fermo ? motore.stato() : {}, sp = spostamento(), c = conf().sync?.cloud;
    const avvisi = [...(s.avvisi || [])];
    if (sospese.length) avvisi.push('scrittura');
    if (recupero) avvisi.push('recupero');
    if (pc.negate()) avvisi.push('portachiavi');
    const el = motore && !fermo ? (() => { try { return motore.elenchi(); } catch { return null; } })() : null;
    return {
      acceso: acceso(), fermo, cloud: !!c, servizio: c ? (servizioDi(vault())?.servizio || basename(c)) : null, vault: basename(vault() || ''),
      // mai «in pari» con modifiche non scritte nel diario
      stato: sospese.length ? 'scrittura' : s.stato || null, avvisi, cifrato: !!s.cifrato, chiave: !!s.chiave, altri: s.altri || 0, ultimo,
      recupero: recupero ? basename(recupero) : null, recuperi, inSospeso: sospese.length,
      // aggiunte: i record di un altro primo avvio (secondari) più quelli nuovi di un dati.json scritto da una Lode vecchia (§8.3);
      // vecchiaDiversi: i campi di quel dati.json diversi da quelli di adesso (si guardano, non cambiano niente da soli)
      aggiunte: (el?.secondari?.length || 0) + (el?.vecchia?.aggiunte?.length || 0), vecchiaDiversi: el?.vecchia?.diversi?.length || 0,
      conflitti: el?.conflitti?.length || 0,
      portachiavi: pc.disponibile(), ricordate: pc.voci(), piattaforma: process.platform,
      spostamento: sp && vault() !== sp.a ? { interrotto: true, cifrata: !!sp.cifrata, servizio: sp.servizio } : null,
    };
  }

  // ---- spostare il vault nella cartella cloud (§10.1), sicuro e riprendibile ----
  async function finisciSpostamento(s) {
    try { writeFileSync(join(s.a, '.lode', 'dati.json'), JSON.stringify(MINIMO(motore.stato().gruppo), null, 1)); } catch { }
    conf().sync = { ...conf().sync, motore: true, cloud: s.cloud }; salvaConf();
    try { rmSync(SPOST(), { force: true }); } catch { }
    await impostaVault(s.a, { ricarica: false });
  }
  // i giri: ogni 30 s (4 nelle prove), al risveglio; si accendono una volta, all'avvio o quando lo studente accende
  let giriAccesi = false;
  function giri() {
    if (giriAccesi) return; giriAccesi = true;
    tOgni = setInterval(giro, prova ? 4000 : 30000);
    powerMonitor?.on('resume', () => giroDopo(2000));
  }
  const avanza = testo => manda('sync:progresso', { testo });
  // il dati.json del vault si legge? (un antivirus su Windows lo tiene per un attimo dopo scriviTutto: EBUSY, EPERM). Prima la
  // migrazione partiva da zero e il dati.json vero restava abbandonato
  async function datiLeggibili(da) {
    const p = join(da, '.lode', 'dati.json');
    for (let i = 0; i < 6; i++) { try { readFileSync(p); return true; } catch (x) { if (x.code === 'ENOENT') return true; if (!OCCUPATO.includes(x.code) && x.code !== 'EACCES') return false; await pausa(150 * 2 ** i); } }
    return false;
  }
  // conf.sync si scrive solo quando il motore può davvero prendere le modifiche: il gruppo c'è, o ci si sta unendo a uno (in_arrivo).
  // Prima si scriveva prima dell'attesa di 30 s: un'uscita o un crash lì lasciava Lode `spento` con la barra vuota per sempre
  const pronto = () => { const s = motore?.stato(); return !!s && (!!s.gruppo || s.modo === 'unisciti'); };
  // l'accensione: il segno «accendo» si accende solo quando il motore sta per leggere dati.json (dopo la scelta della cartella e,
  // col vault nel cloud, dopo i 30 s di attesa) e si spegne con conf.sync scritto; i salvataggi tenuti nel frattempo vanno al
  // diario se conf.sync c'è, se no a dati.json come prima (lì la barra lavorava ancora)
  async function attiva(x = {}) {
    if (accensione || copiando) return { esito: 'errore', errore: t('desktop.sync-sto-accendendo') };
    accensione = attivaDentro(x);
    try { return await accensione; } finally { accensione = null; accendo = false; rilasciaTenuti(); }
  }
  function rilasciaTenuti() {
    const t = [...tenuti]; tenuti.clear();
    for (const [id, { D, ops }] of t) { if (acceso()) salvaInFila(id, D, { ops }); else scriviDati(D); }
  }
  // salva() in fila, col D segnato come pendente finché il diario non l'ha preso
  function salvaInFila(id, D, x) {
    const segno = { D, ops: Array.isArray(x?.ops) ? x.ops : [] }; pendenti.set(id, segno);
    return inFila(() => salva(id, D, x)).catch(e => console.error('Lode: salvataggio nel diario', e)).finally(() => { if (pendenti.get(id) === segno) pendenti.delete(id); });
  }
  // i salvataggi che il diario non ha ancora preso (tenuti durante l'accensione, in fila dietro un lavoro lungo) in un file di
  // recupero per finestra: sincrono, per before-quit dopo il limite di chiudi() e per session-end (Windows si spegne)
  function salvaPendenti() {
    for (const [id, { D }] of [...tenuti, ...pendenti]) salvaRecupero(D, id);
  }
  async function attivaDentro({ i, scegli, password = null } = {}) {
    if (motore && !fermo && conf().sync?.cloud && pronto()) return { esito: 'gia' };
    const cartelle = cartelleCloud();
    let cloud = cartelle[i]?.percorso || null, nome = cartelle[i]?.servizio || null;
    if (!cloud && (scegli || process.env.LODE_SCEGLI)) {
      const r = process.env.LODE_SCEGLI ? { filePaths: [process.env.LODE_SCEGLI] } : await dialog.showOpenDialog({ title: t('desktop.sync-cartella-titolo'), buttonLabel: t('desktop.sync-sincronizza-qui'), properties: ['openDirectory', 'createDirectory'] });
      cloud = r.canceled ? null : r.filePaths?.[0] || null; nome = cloud ? (servizioDi(cloud)?.servizio || basename(cloud)) : null;
    }
    if (!cloud) return { esito: 'annullato' };
    if (password != null && String(password).length < 8) return { esito: 'errore', errore: t('desktop.sync-password-corta') };
    const da = vault();
    // uno spostamento cominciato con la password si riprende solo con la password: prima la ripresa senza password lo finiva in
    // chiaro, e tutti i dati andavano nella cartella cloud senza avviso
    const sp0 = spostamento();
    if (sp0?.cifrata && sp0.da === da && sp0.cloud === cloud && !password) return { esito: 'password', errore: t('desktop.sync-spostamento-con-password') };
    scriviTutto();   // il dati.json in sospeso va sul disco prima della migrazione
    if (!(await datiLeggibili(da))) return { esito: 'errore', errore: t('desktop.sync-dati-occupati') };
    const prima = conf().sync;
    // il vault è già nella cartella cloud: niente da spostare (il dati.json di prima resta nella cronologia del servizio)
    if (dentro(cloud, da)) {
      return inFila(async () => {
        if (!motore || fermo) await apri();
        if (fermo) return { esito: 'errore', errore: t('desktop.sync-diario-illeggibile') };
        giri();
        if (MAC && !prova) try { execFileSync('brctl', ['download', join(da, '.lode')], { timeout: 10000 }); } catch { }
        // §8.1: con il vault nel cloud si aspetta un giro prima di creare un gruppo (un altro computer potrebbe averlo già fatto)
        if (!prova) { avanza(t('desktop.sync-controllo-altro-computer')); await new Promise(r => setTimeout(r, 30000)); await motore.arrivati(); }
        // da qui i salvataggi della barra si tengono (accendo): nei 30 s andavano ancora a dati.json, e scriviTutto li porta nella
        // migrazione. Prima accendo valeva già durante l'attesa e un'uscita lì perdeva i tenuti (giro 3)
        accendo = true;
        scriviTutto();
        const r = await motore.attiva({ modo: 'nuovo', password: password || null });
        // con la password scritta: un gruppo in chiaro, un gruppo.json manomesso, una Lode più nuova. Si torna com'era, motore
        // compreso (con motore acceso i giri continuerebbero e l'unione in chiaro avverrebbe lo stesso), e via il corrente.json
        // dell'unione appena cominciata. Prima si scriveva conf.sync e si rispondeva «ok»: la scheda diceva «Sincronizzato» e il
        // computer pubblicava in chiaro (§10.2, giro 3)
        if (['chiaro', 'manomesso', 'parametri'].includes(r?.codice)) {
          conf().sync = prima; salvaConf(); motore = null;
          try { rmSync(join(app.getPath('userData'), 'sync', 'corrente.json'), { force: true }); } catch { }
          return { esito: 'errore', errore: frasePassword(r.codice) };
        }
        if (!pronto()) { conf().sync = prima; salvaConf(); return { esito: 'aspetta', errore: t('desktop.sync-aspetto-dati') }; }
        conf().sync = { motore: true, cloud }; salvaConf();
        accendo = false; rilasciaTenuti();   // i salvataggi tenuti: in fila dietro a questa, prima di quelli che arrivano dopo
        await impostaVault(da, { ricarica: false });   // il watcher di prima non sapeva della sincronizzazione: riparte col motore
        spingi(true);
        if (r?.codice === 'chiave_sbagliata') return { esito: 'sbagliata', errore: t('desktop.sync-altra-password') };
        if (password && motore.stato().stato === 'password') return { esito: 'password', errore: t('desktop.sync-gia-con-password') };
        return r?.rifiutata ? { esito: 'errore', errore: t('desktop.sync-non-accendo') } : { esito: 'ok', servizio: nome, giaDentro: true };
      });
    }
    // una cartella dentro il vault (scelta per sbaglio con «Un'altra cartella…», per esempio Allegati): la copia finirebbe dentro
    // il vault stesso, Allegati/Lode/Allegati/Lode/… fino a ENAMETOOLONG. Prima si accettava
    if (dentro(da, cloud)) return { esito: 'errore', errore: t('desktop.sync-cartella-dentro-vault') };
    // un vault di Lode già sincronizzato in quella cartella: è «Uso già Lode su un altro computer»
    const a0 = join(cloud, 'Lode');
    if (existsSync(join(a0, '.lode', 'sync'))) return { esito: 'esiste', servizio: nome };
    const sp = spostamento();
    const a = sp?.da === da && sp.cloud === cloud ? sp.a : [a0, ...[2, 3, 4, 5, 6, 7, 8, 9].map(k => `${a0} ${k}`)].find(p => !existsSync(p) || !readdirSync(p).length) || join(cloud, `Lode ${Date.now()}`);
    mkdirSync(dirname(SPOST()), { recursive: true });
    writeFileSync(SPOST(), JSON.stringify({ da, a, cloud, servizio: nome, cifrata: !!password, iniziato: Date.now() }));
    // 1. i dati di Lode passano nel diario, qui, fuori dal cloud (migrazione, §8.2: dati.json resta in copie/ e il minimo al suo posto)
    const r1 = await inFila(async () => {
      if (!motore || fermo) { await apri(); giri(); }
      if (fermo) return { esito: 'errore', errore: t('desktop.sync-diario-illeggibile') };
      accendo = true; scriviTutto();   // da qui la migrazione legge dati.json: i salvataggi dopo si tengono
      if (!motore.stato().gruppo) await motore.attiva({ modo: 'nuovo' });
      // il gruppo non è nato: la configurazione torna com'era e la barra resta su dati.json (prima restava accesa sul motore vuoto)
      if (!motore.stato().gruppo) { conf().sync = prima; salvaConf(); return { esito: 'errore', errore: t('desktop.sync-dati-non-ancora') }; }
      if (!conf().sync?.motore) { conf().sync = { motore: true, cloud: null }; salvaConf(); }
      spingi(true);   // da qui le finestre lavorano sul diario: ricevono la vista (e la loro BASE) prima di copiare
      return null;
    });
    if (r1) return r1;
    // da qui i salvataggi della barra vanno al diario (conf.sync c'è): quelli tenuti partono subito, non dopo la copia
    accendo = false; rilasciaTenuti();
    // 2. le note nella cartella cloud (si può rifare: i file già copiati si saltano). FUORI dalla fila: con GB di allegati dura
    // minuti, e i salvataggi della barra (motore.modifica non dipende dalla copia) restavano in fila dietro di lei; un'uscita a
    // metà li perdeva (chiudi() aspetta al massimo 5 s). Lo spostamento resta in spostamento.json e si riprende
    copiando = true;
    try {
      avanza(t('desktop.sync-copio-vault'));
      await copiaNote(da, a, { dopo: n => { if (process.env.LODE_SYNC_CRASH === 'copia' && n === 3) process.kill(process.pid, 'SIGKILL'); if (n % 50 === 0) avanza(t('desktop.sync-copio-vault-file', { n })); } });
      await verificaCopia(da, a);
    } catch (x) { console.error('Lode: copia del vault', x); return { esito: 'errore', errore: fraseCopia(x) }; }
    finally { copiando = false; }
    return inFila(async () => {
      if (!motore || fermo) return { esito: 'errore', errore: t('desktop.sync-diario-illeggibile') };
      // 3. il gruppo nuovo, già cifrato se c'è la password: nella cartella cloud non arriva mai un evento in chiaro (#20)
      avanza(password ? t('desktop.sync-cifro-pubblico') : t('desktop.sync-pubblico'));
      const r = await motore.trasloca({ destinazione: a, password: password || null });
      if (!r?.ok) return { esito: 'errore', errore: t('desktop.sync-non-creo-dati') };
      await finisciSpostamento({ a, cloud });
      spingi(true);
      return { esito: 'ok', servizio: nome, da: basename(da), a };
    });
  }

  // «Uso già Lode su un altro computer»: il vault della cartella cloud diventa quello di Lode; i dati arrivano dagli altri
  // chi chiede (il benvenuto) non si ricarica: riceve la vista nuova come le altre finestre, e prosegue
  async function collega({ i, scegli, password = null } = {}, chi = null) {
    if (motore && !fermo && conf().sync?.cloud && pronto() && motore.stato().stato !== 'sparito') return { esito: 'gia' };
    const elenco = cartelleCloud().flatMap(c => vaultNelCloud(c).map(p => ({ p, servizio: c.servizio })));
    let v = elenco[i]?.p || null;
    if (!v && (scegli || process.env.LODE_SCEGLI_VAULT)) {
      const r = process.env.LODE_SCEGLI_VAULT ? { filePaths: [process.env.LODE_SCEGLI_VAULT] } : await dialog.showOpenDialog({ title: t('desktop.sync-vault-nel-cloud'), buttonLabel: t('desktop.usa-questo-vault'), properties: ['openDirectory'] });
      v = r.canceled ? null : r.filePaths?.[0] || null;
    }
    if (!v) return { esito: 'annullato' };
    // una cartella qualunque (il vault di prima, una cartella vuota) non è un vault sincronizzato: prima si accettava e Lode
    // restava «in arrivo» per sempre, con la barra vuota e nessuna strada per tornare indietro
    if (!existsSync(join(v, '.lode', 'sync'))) return { esito: 'errore', errore: t('desktop.sync-non-e-vault-sincronizzato') };
    const prima = conf().sync;
    // dopo «Smetti su questo computer» (cloud null) il motore ha un gruppo locale: lo lascia e si unisce al vault scelto, con
    // tutti i suoi eventi. Prima rispondeva «prima Smetti», cioè proprio quello che lo studente aveva appena fatto. Lo stesso
    // per «Trova il vault» nello stato `sparito` (lo studente ha spostato il vault: si sceglie la cartella spostata)
    if (motore && !fermo && motore.stato().gruppo && (!conf().sync?.cloud || motore.stato().stato === 'sparito')) {
      return inFila(async () => {
        const r = await motore.ricollega({ vault: v });
        if (!r?.ok) return { esito: 'errore', errore: t('desktop.sync-riprova-tra-poco') };
        conf().sync = { motore: true, cloud: servizioDi(v)?.percorso || dirname(v) }; salvaConf(); benvenutoFatto();
        await impostaVault(v, { ricarica: false });
        const sb = password ? await motore.sblocca(password) : null;
        spingi(true);
        return { esito: 'ok', servizio: servizioDi(v)?.servizio || basename(dirname(v)), stato: motore.stato().stato, ...(sb && !sb.ok ? { avviso: frasePassword(sb.codice) } : {}) };
      });
    }
    if (motore && !fermo && pronto()) return { esito: 'errore', errore: t('desktop.sync-diario-altro-vault') };
    // il vault di adesso ha i dati di un computer che usava Lode da solo (dati.json v1 con esami, carte…): non spariscono. Entrano
    // nel gruppo come importa secondari (6.7): non cambiano niente da soli e compaiono in «Dati di un altro primo avvio» con
    // [importa le aggiunte]. Il dati.json resta comunque dov'è. Prima Lode passava al vault del cloud e i dati di questo computer
    // restavano solo nel vault di prima, senza un avviso (§8.1)
    const da = vault();
    let importa = null;
    try { scriviTutto(); const D = JSON.parse(readFileSync(join(da, '.lode', 'dati.json'), 'utf8')); if (conDati(D) && !dentro(v, da)) importa = D; } catch { }
    conf().sync = { motore: true, cloud: servizioDi(v)?.percorso || dirname(v) }; salvaConf();
    await impostaVault(v, { ricarica: false });
    // con la password scritta, un gruppo in chiaro, una password che non apre o un gruppo.json manomesso: ci si ferma e si torna
    // com'era (prima collega() ignorava la risposta e il benvenuto diceva «Ricevo i dati…» mentre il computer si univa in chiaro)
    const indietro = async errore => { conf().sync = prima; salvaConf(); motore = null; await impostaVault(da, { ricarica: false }); return { esito: 'errore', errore }; };
    return inFila(async () => {
      await apri(); giri();
      if (fermo) { conf().sync = prima; salvaConf(); return { esito: 'errore', errore: t('desktop.sync-diario-illeggibile') }; }
      const r = await motore.attiva({ modo: 'unisciti', password: password || null, importa });
      if (['chiaro', 'manomesso', 'parametri'].includes(r?.codice)) return indietro(frasePassword(r.codice));
      spingi(true); tutte().forEach(w => { if (w.webContents !== chi) w.webContents.reload(); });
      benvenutoFatto();
      const s = motore.stato();
      return { esito: 'ok', servizio: servizioDi(v)?.servizio || basename(dirname(v)), stato: s.stato,
        ...(r?.codice === 'chiave_sbagliata' ? { avviso: t('desktop.sync-password-sbagliata-di-nuovo') } : {}),
        ...(importa ? { importati: LISTE.reduce((n, l) => n + (Array.isArray(importa[l]) ? importa[l].length : 0), 0), vaultPrima: basename(da) } : {}) };
    });
  }
  // §12: su un computer collegato a un gruppo il benvenuto non riparte (conf.benvenuto). Prima lo scriveva solo «Inizia»: chiusa
  // la finestra, o riavviato prima, il benvenuto ripartiva con i dati del gruppo e poteva togliere a tutti i computer gli esami
  // scambiati per quelli di esempio (giro 3)
  function benvenutoFatto() { if (!conf().benvenuto) { conf().benvenuto = new Date().toISOString(); salvaConf(); } }
  // le risposte di sblocca e dell'unione con la password, in una frase per lo studente
  function frasePassword(codice) {
    switch (codice) {
      case 'vecchia': return t('desktop.sync-password-vecchia');
      case 'parametri': return t('desktop.sync-lode-piu-nuova');
      case 'manomesso': return t('desktop.sync-gruppo-manomesso');
      case 'chiaro': return t('desktop.sync-gruppo-in-chiaro');
      default: return t('desktop.sync-password-sbagliata');
    }
  }
  // «Scegli il vault» dopo «Smetti» (conf.sync con cloud null): il diario è legato al vault, quindi non si cambia cartella e basta.
  // Le note si copiano nella cartella scelta (mai cancellato niente) e lì nasce un gruppo locale con tutti gli eventi. Prima
  // «Scegli il vault» rimandava a «Smetti», che rispondeva «la sincronizzazione non è accesa»: un vicolo cieco
  async function cambiaVaultLocale(dest) {
    if (!motore || fermo || conf().sync?.cloud) return { esito: 'errore', errore: t('desktop.sync-adesso-non-si-puo') };
    if (cartelleCloud().some(c => dentro(c.percorso, dest))) return { esito: 'errore', errore: t('desktop.sync-cartella-in-cloud') };
    const da = vault();
    if (dentro(da, dest) || dentro(dest, da)) return { esito: 'errore', errore: t('desktop.sync-fuori-dal-vault') };
    try { if (existsSync(da)) { await copiaNote(da, dest); await verificaCopia(da, dest); } } catch (x) { return { esito: 'errore', errore: fraseCopia(x) }; }
    return inFila(async () => {
      const r = await motore.trasloca({ destinazione: dest });
      if (!r?.ok) return { esito: 'errore', errore: t('desktop.sync-non-sposto-dati') };
      try { mkdirSync(join(dest, '.lode'), { recursive: true }); writeFileSync(join(dest, '.lode', 'dati.json'), JSON.stringify(MINIMO(motore.stato().gruppo), null, 1)); } catch { }
      await impostaVault(dest, { ricarica: false });
      spingi(true);
      return { esito: 'ok', vault: dest };
    });
  }

  return {
    acceso,
    stato,
    cambiaVaultLocale,
    accendendo: () => accendo,
    // un salvataggio della barra durante l'accensione: l'ultimo D di ogni finestra (contiene i precedenti) e tutte le operazioni dette
    tieni(id, D, x = {}) { const t = tenuti.get(id); tenuti.set(id, { D, ops: [...(t?.ops || []), ...(Array.isArray(x.ops) ? x.ops : [])] }); },
    async avvia() {
      // i file di recupero rimasti dall'ultima volta (un'uscita durante l'accensione, chiudi() scaduto, Windows spento): la scheda
      // li dice finché sono recenti (14 giorni). Prima l'avviso spariva al riavvio e lo studente non sapeva dove fossero
      try {
        const dir = join(app.getPath('userData'), 'sync');
        const l = readdirSync(dir).filter(n => /^recupero-\d+-.*\.json$/.test(n) && !n.startsWith(`recupero-${AVVIO}-`)).map(n => ({ n, t: statSync(join(dir, n)).mtimeMs })).filter(x => Date.now() - x.t < 14 * 864e5).sort((a, b) => a.t - b.t);
        if (l.length) { recupero = join(dir, l.at(-1).n); recuperi = l.length; }
      } catch { }
      // un'accensione finita sul motore (il gruppo c'è, corrente.json punta a questo vault e dati.json è il minimo) ma non nella
      // configurazione (Lode chiuso o in crash proprio lì): si riprende, altrimenti la barra mostrerebbe il dati.json minimo
      if (!acceso()) {
        try {
          const c = JSON.parse(readFileSync(join(app.getPath('userData'), 'sync', 'corrente.json'), 'utf8'))?.dati;
          const d = JSON.parse(readFileSync(join(vault(), '.lode', 'dati.json'), 'utf8'));
          // la cartella cloud: quella riconosciuta, se no quella che contiene il vault (come collega). Prima null per una cartella
          // non riconosciuta (Google Drive su Windows, Nextcloud, «Un'altra cartella…»): Lode si comportava come dopo «Smetti»
          if (c?.gruppo && c.vault === vault() && d?.lode2?.gruppo) { conf().sync = { motore: true, cloud: servizioDi(vault())?.percorso || dirname(vault()) }; salvaConf(); }
        } catch { }
      }
      if (!acceso()) return;
      await inFila(apri);
      // acceso ma il motore non ha mai creato niente (una versione di prima scriveva conf.sync prima del gruppo, poi si è chiusa):
      // si torna a dati.json, che è ancora quello vero. Prima era un vicolo cieco: barra vuota, «Attiva» rispondeva «già»
      if (!fermo && motore?.stato().stato === 'spento') { delete conf().sync; salvaConf(); motore = null; return; }
      if (!fermo && motore?.locale()?.D?.benvenuto) benvenutoFatto();   // i dati del gruppo hanno già fatto il benvenuto (§12)
      giri(); giroDopo(500);
    },
    leggi(id, vuoto) {
      if (vuoto && typeof vuoto === 'object') vuoti.set(id, vuoto);
      caricamenti.set(id, (caricamenti.get(id) || 0) + 1);   // ogni caricamento della finestra ha il suo file di recupero
      // fermo: si riprova ad aprire il diario (il «Riprova» della barra ricarica la pagina e passa di qui). Se riesce, la vista
      // arriva con dati:cambiati. Prima fermo si azzerava solo riavviando l'app
      if (fermo) { if (!riapro) riapro = inFila(apri).then(() => { riapro = null; if (!fermo) { giri(); spingi(true); } }); return { __errore: 'fermo' }; }
      return vistaPer(id) || { __errore: 'sync' };
    },
    salva: (id, D, x) => salvaInFila(id, D, x),
    salvaPendenti,
    cambiato: () => giroDopo(),
    dimenticaFinestra: id => { basi.delete(id); vuoti.delete(id); },
    // l'ultima pubblicazione (al massimo 5 s). Un'accensione in corso si aspetta prima (al massimo 15 s: i salvataggi tenuti vanno
    // al diario con la fila). Quello che il diario non ha preso allo scadere (tenuti, salvataggi in fila dietro un lavoro lungo)
    // va in un file di recupero: prima si perdeva (giro 3)
    async chiudi() {
      if (chiuso) return; chiuso = true; clearInterval(tOgni); clearTimeout(tGiro);
      const scade = ms => new Promise(r => setTimeout(r, ms));
      if (accensione && accendo) await Promise.race([accensione.catch(() => { }), scade(15000)]);   // prima di «accendo» (scelta della cartella, i 30 s) non c'è niente da perdere
      if (motore) await Promise.race([inFila(async () => { if (sospese.length) await ritenta(); if (motore && !fermo) await motore.chiudi().catch(x => console.error('Lode: chiusura della sincronizzazione', x)); }), scade(5000)]);
      salvaPendenti();
    },
    registra(ipcMain) {
      ipcMain.handle('sync:stato', () => stato());
      ipcMain.handle('sync:cartelle', () => {
        const c = cartelleCloud(), v = vault();
        return { cartelle: c.map((x, i) => ({ i, servizio: x.servizio, nome: basename(x.percorso), qui: dentro(x.percorso, v) })),
          vault: c.flatMap(x => vaultNelCloud(x).map(p => ({ nome: basename(p), servizio: x.servizio }))).map((x, i) => ({ ...x, i })) };
      });
      ipcMain.handle('sync:attiva', (_, x) => attiva(x || {}));
      ipcMain.handle('sync:collega', (e, x) => collega(x || {}, e.sender));
      // ok solo se il gruppo di adesso si è aperto (il motore lo verifica dopo il giro); gli altri codici hanno la loro frase: «la
      // password di prima», «una Lode più nuova», «gruppo.json manomesso». Lo stato va con la risposta: chi chiede lo guarda
      ipcMain.handle('sync:sblocca', (_, { password } = {}) => inFila(async () => {
        if (!motore) return { esito: 'errore' };
        const r = await motore.sblocca(String(password || '')); spingi(true);
        const st = motore.stato().stato;
        return r.ok ? { esito: 'ok', ricordata: pc.disponibile(), stato: st } : { esito: r.codice === 'chiave_sbagliata' ? 'sbagliata' : r.codice || 'sbagliata', errore: frasePassword(r.codice), stato: st };
      }));
      // «importa le aggiunte» (6.7): i record di un altro primo avvio (un computer che usava Lode da solo) diventano record veri
      ipcMain.handle('sync:importaAggiunte', () => inFila(async () => { const r = await motore?.importaAggiunte?.(); spingi(true); giroDopo(); return r?.ok ? { esito: 'ok', importati: r.importati } : { esito: 'errore', errore: t('desktop.sync-riprova-tra-poco') }; }));
      // cambio password e «Ho dimenticato la password» sono la stessa rigenerazione (§10.4, 10.5): un gruppo nuovo, cifrato
      ipcMain.handle('sync:cifra', (_, { password } = {}) => inFila(async () => {
        if (!motore) return { esito: 'errore' };
        if (String(password || '').length < 8) return { esito: 'errore', errore: t('desktop.sync-password-corta') };
        const r = await motore.cifra(String(password)); spingi(true);
        return r.ok ? { esito: 'ok', ricordata: pc.disponibile() } : { esito: 'errore', errore: t('desktop.sync-riprova-tra-poco') };
      }));
      ipcMain.handle('sync:dimentica', () => inFila(async () => { await motore?.dimentica(); spingi(true); return { esito: 'ok' }; }));
      ipcMain.handle('sync:toglila', () => inFila(async () => { const r = await motore?.toglila(); spingi(true); return { esito: r?.ok ? 'ok' : 'errore', tolte: r?.tolte || 0 }; }));
      ipcMain.handle('sync:giro', () => giro().then(() => stato()));
      // «Smetti su questo computer» (§11): il vault copiato in una cartella fuori dal cloud, un gruppo locale in chiaro
      ipcMain.handle('sync:smetti', async () => {
        if (fermo && conf().sync?.cloud) return { esito: 'errore', errore: t('desktop.sync-diario-illeggibile-riprova') };
        if (!motore || fermo || !conf().sync?.cloud) return { esito: 'errore', errore: t('desktop.sync-non-accesa') };
        // il vault non c'è più dove Lode lo cercava (spostato: stato `sparito`): copiarlo darebbe un vault vuoto. Prima «Smetti»
        // rispondeva ok e portava Lode su una cartella vuota dicendo «il vault ora è fuori dalla cartella cloud»
        if (!existsSync(vault())) return { esito: 'errore', errore: t('desktop.sync-vault-spostato-scegli') };
        const r = process.env.LODE_SCEGLI_SMETTI ? { filePaths: [process.env.LODE_SCEGLI_SMETTI] } : await dialog.showOpenDialog({ title: t('desktop.sync-dove-fuori-cloud'), buttonLabel: t('desktop.sync-tieni-qui'), properties: ['openDirectory', 'createDirectory'] });
        const base = r.canceled ? null : r.filePaths?.[0];
        if (!base) return { esito: 'annullato' };
        if (cartelleCloud().some(c => dentro(c.percorso, base)) || dentro(conf().sync.cloud, base)) return { esito: 'errore', errore: t('desktop.sync-fuori-dal-cloud') };
        const dest = [join(base, 'Lode'), ...[2, 3, 4, 5, 6, 7, 8, 9].map(k => join(base, `Lode ${k}`))].find(p => !existsSync(p)) || join(base, `Lode ${Date.now()}`);
        // i rifiuti del motore, in una frase
        const frase = x => {
          if (x?.motivo === 'sorgente') return t('desktop.sync-vault-spostato');
          if (x?.motivo === 'in_arrivo') return t('desktop.sync-cambio-in-arrivo');
          if (x?.motivo === 'password') return t('desktop.sync-smetti-serve-password');
          if (x?.motivo === 'segnaposti') return x.mancano.length > 3 ? t('desktop.sync-note-non-scaricate-altre', { note: x.mancano.slice(0, 3).join(', '), n: x.mancano.length - 3 }) : t('desktop.sync-note-non-scaricate', { note: x.mancano.join(', ') });
          return t('desktop.sync-riprova-tra-poco');
        };
        // 1. i controlli (in fila); 2. la copia delle note FUORI dalla fila (con GB di allegati dura minuti: prima stava in fila e i
        // salvataggi della barra dietro di lei si perdevano a un'uscita, chiudi() aspetta 5 s, giro 3); 3. in fila il motore
        // ricopia solo quello che è cambiato nel frattempo, e cambia vault
        const x0 = await inFila(async () => {
          if (!motore || fermo) return { rifiutata: true };
          // le note «tolte dal Mac» da iCloud si fanno scaricare prima (il motore non cambia vault se ne resta qualcuna)
          if (MAC && !prova) try { execFileSync('brctl', ['download', vault()], { timeout: 60000 }); } catch { }
          return motore.smetti({ destinazione: dest, controlla: true });
        });
        if (!x0?.ok) return { esito: 'errore', errore: frase(x0) };
        copiando = true;
        try { avanza(t('desktop.sync-copio-fuori-cloud')); await copiaNote(vault(), dest); await verificaCopia(vault(), dest); }
        catch (x) { console.error('Lode: copia del vault (Smetti)', x); return { esito: 'errore', errore: fraseCopia(x) }; }
        finally { copiando = false; }
        return inFila(async () => {
          if (!motore || fermo) return { esito: 'errore', errore: t('desktop.sync-diario-illeggibile') };
          const x = await motore.smetti({ destinazione: dest, copiata: true });
          if (!x?.ok) return { esito: 'errore', errore: frase(x) };
          conf().sync = { motore: true, cloud: null }; salvaConf();
          await impostaVault(dest, { ricarica: false });
          spingi(true);
          return { esito: 'ok', vault: dest };
        });
      });
    },
  };
}
