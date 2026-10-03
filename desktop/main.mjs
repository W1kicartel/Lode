// Lode, l'app desktop. Una finestra trasparente in cima allo schermo, sopra tutte le altre: dentro c'è solo la barra.
// I clic passano attraverso tranne che sulla barra. Scorciatoie globali per la cattura in aula. Il vault Obsidian in
// Documenti/Lode è la memoria: dati di Lode in .lode/dati.json, lezioni in Markdown. Icona nella barra dei menu.
import { app, BrowserWindow, Menu, ShareMenu, Tray, clipboard, dialog, globalShortcut, ipcMain, nativeImage, nativeTheme, net, powerMonitor, safeStorage, screen, shell, utilityProcess } from 'electron';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, renameSync, copyFileSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { totalmem, cpus, homedir, userInfo } from 'node:os';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as V from './vault.mjs';
import * as I from './installa.mjs';
import * as VOCE from './voce.mjs';
import * as VOCE_ONNX from './voce-onnx.mjs';
import * as PROGETTO from './progetto.mjs';
import * as AGGIORNA from './aggiorna.mjs';
import * as SY from './sincronizza.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const WEB = existsSync(join(QUI, 'web', 'index.html')) ? join(QUI, 'web') : join(QUI, '..');
const MAC = process.platform === 'darwin', WIN = process.platform === 'win32';
// Windows: lo stesso id dei collegamenti dell'installer (appId), per notifiche, barra delle applicazioni e avvio automatico
if (WIN) app.setAppUserModelId(app.isPackaged ? 'it.lode.app' : process.execPath);
// Gli agganci per le prove (LODE_PROVA, LODE_CONFERMA_AUTO, LODE_PROGETTO, LODE_VAULT, LODE_DATI, LODE_AUDIO_FINTO,
// LODE_NON_APRIRE, LODE_QUADRO, LODE_AI_BASE e tutte le altre LODE_*) valgono solo in sviluppo (npm start, test/prova-app.mjs).
// Nell'app installata si tolgono qui, prima che main.mjs o gli altri moduli le leggano: chi avvia Lode con variabili scelte
// da lui non salta la finestra di conferma dei comandi, non sposta vault e dati, non fa eseguire script alla barra
if (app.isPackaged) for (const k of Object.keys(process.env)) if (/^LODE_/i.test(k)) delete process.env[k];
// per le prove: LODE_DATI e LODE_VAULT spostano configurazione e vault in una cartella a parte
if (process.env.LODE_DATI) app.setPath('userData', process.env.LODE_DATI);
if (process.env.LODE_AUDIO_FINTO) { app.commandLine.appendSwitch('use-fake-ui-for-media-stream'); app.commandLine.appendSwitch('use-fake-device-for-media-stream'); app.commandLine.appendSwitch('use-file-for-fake-audio-capture', process.env.LODE_AUDIO_FINTO + '%noloop'); }   // prove della voce
if (!app.requestSingleInstanceLock()) app.quit();

/* ---------- configurazione: dov'è il vault ---------- */
const CONF = () => join(app.getPath('userData'), 'config.json');
let conf = {};
function leggiConf() { try { conf = JSON.parse(readFileSync(CONF(), 'utf8')); } catch { conf = {}; } }
function salvaConf() { mkdirSync(dirname(CONF()), { recursive: true }); V.scriviSicuro(CONF(), JSON.stringify(conf, null, 2)); }
const vault = () => conf.vault;
const fileDati = () => join(vault(), '.lode', 'dati.json');

/* ---------- finestre ---------- */
let barra = null, quadro = null, tray = null, guardiano = null, uscendo = false;
const LARGA = 640;
function posiziona() {
  if (!barra || barra.isDestroyed()) return;
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()), a = d.workArea;
  barra.setBounds({ x: Math.round(a.x + a.width / 2 - LARGA / 2), y: a.y, width: LARGA, height: Math.min(780, a.height) });
}
// La finestra resta Lode: un link senza target nella pagina (anche un <a> messo ad arte in un .lode/dati.json di un vault
// condiviso o sincronizzato) non la porta su un'altra pagina, che riceverebbe lo stesso preload e quindi window.lodeDesktop
// (vault, progetti, installazioni). setWindowOpenHandler copre solo target=_blank e window.open: qui il resto. Le pagine
// https vanno nel browser; passa solo la pagina stessa di Lode, lo stesso file:// con un'altra query o un altro # (il
// ricaricamento di «Riprova», ?benvenuto=1 delle prove): un altro file del disco, anche nel vault, resta fuori
const stessaPagina = (a, b) => { try { const x = new URL(a), y = new URL(b); return x.protocol === 'file:' && y.protocol === 'file:' && x.host === y.host && x.pathname === y.pathname; } catch { return false; } };
function restaLode(w) {
  w.webContents.on('will-navigate', (e, url) => { if (stessaPagina(url, w.webContents.getURL())) return; e.preventDefault(); if (/^https:/.test(url)) shell.openExternal(url); });
}
function creaBarra() {
  barra = new BrowserWindow({
    width: LARGA, height: 760, frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, hasShadow: false, skipTaskbar: true, alwaysOnTop: true, show: false, backgroundColor: '#00000000',
    ...(MAC ? { type: 'panel' } : WIN ? { type: 'toolbar' } : {}),   // toolbar: su Windows fuori da Alt+Tab e da Visualizzazione attività
    webPreferences: { preload: join(QUI, 'preload.cjs'), contextIsolation: true, sandbox: true, spellcheck: true, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false },
  });
  barra.setAlwaysOnTop(true, MAC ? 'floating' : 'screen-saver');
  barra.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  barra.setIgnoreMouseEvents(true, { forward: true });
  posiziona();
  barra.loadFile(join(WEB, 'index.html'));
  barra.once('ready-to-show', () => barra.showInactive());
  barra.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:|^obsidian:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  restaLode(barra);
  barra.webContents.session.setPermissionRequestHandler((_, p, cb) => cb(['media', 'notifications', 'clipboard-sanitized-write'].includes(p)));
  // Alt+F4 (o Ctrl+W) non la distrugge: si richiude e basta. Se ne va solo uscendo da Lode
  barra.on('close', e => { if (!uscendo) { e.preventDefault(); rilascia(); } });
  barra.on('closed', () => { barra = null; if (!uscendo) creaBarra(); });
  barra.on('session-end', () => { uscendo = true; scriviTutto(); });   // Windows si spegne o esce l'utente: before-quit non arriva
}
function apriQuadro() {
  if (quadro && !quadro.isDestroyed()) { quadro.show(); quadro.focus(); return; }
  quadro = new BrowserWindow({ width: 1120, height: 820, minWidth: 380, minHeight: 500, title: 'Lode', backgroundColor: '#0A0A0A', titleBarStyle: MAC ? 'hiddenInset' : 'default',
    webPreferences: { preload: join(QUI, 'preload.cjs'), contextIsolation: true, sandbox: true } });
  quadro.loadFile(join(WEB, 'index.html'), { query: { quadro: '1' } });
  quadro.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  restaLode(quadro);
  if (MAC) app.dock?.show();
  quadro.on('closed', () => { quadro = null; if (MAC) app.dock?.hide(); });
}
/* ---------- la prima volta: la finestra di benvenuto ---------- */
let benvenuto = null;
function apriBenvenuto() {
  if (benvenuto && !benvenuto.isDestroyed()) { benvenuto.show(); benvenuto.focus(); return; }
  benvenuto = new BrowserWindow({ width: 980, height: 760, minWidth: 420, minHeight: 600, title: 'Benvenuto in Lode', backgroundColor: '#0A0A0A', titleBarStyle: MAC ? 'hiddenInset' : 'default', show: false,
    webPreferences: { preload: join(QUI, 'preload.cjs'), contextIsolation: true, sandbox: true } });
  benvenuto.loadFile(join(WEB, 'index.html'), { query: { benvenuto: '1' } });
  benvenuto.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });   // come il quadro: niente finestre nuove col preload
  restaLode(benvenuto);
  benvenuto.once('ready-to-show', () => { benvenuto.show(); benvenuto.focus(); if (MAC) app.focus({ steal: true }); });
  if (MAC) app.dock?.show();
  benvenuto.on('closed', () => { benvenuto = null; if (MAC && !quadro) app.dock?.hide(); });
}
const tutte = () => [barra, quadro, benvenuto].filter(w => w && !w.isDestroyed());
const manda = (canale, x, tranne) => tutte().forEach(w => { if (w.webContents !== tranne) w.webContents.send(canale, x); });

/* ---------- vault ---------- */
function info() { const o = V.obsidian(vault()); return { percorso: vault(), nome: vault().split(/[\\/]/).pop(), obsidian: { installato: o.installato, registrato: !!o.registrato }, note: V.notePerLode(vault()) }; }
function avviaVault() {
  guardiano?.chiudi(); guardiano = null;
  // con la sincronizzazione accesa dati.json non c'è più: Orario.md non si crea qui (vuoto, arriverebbe agli altri computer e
  // toglierebbe le loro lezioni). Si crea dopo, dalla vista unita, solo se c'è qualcosa e i dati degli altri sono arrivati
  const conSync = SY.attiva(vault());
  let orario = [];
  if (!conSync) try { orario = JSON.parse(readFileSync(fileDati(), 'utf8')).orario || []; } catch { }
  V.crea(vault(), conSync ? null : orario);
  V.registra(vault());
  guardiano = V.guarda(vault(), {
    lezioniCambiate: () => manda('vault:lezioni', V.lezioni(vault())),
    // con la sincronizzazione accesa un Orario.md senza righe arrivato dalla cartella (una versione di Lode di prima partita
    // vuota, un computer appena collegato) non toglie tutte le lezioni: si riscrive dalla vista unita
    orarioCambiato: o => {
      if (motore && !motore.bloccato && !o.righe?.length && o.tolte?.length) {
        const vista = motore.vista().orario || [];
        if (vista.length) { console.warn('Lode: Orario.md vuoto arrivato dalla cartella: lo riscrivo dalla vista unita'); try { const t = V.testoOrario(vista); guardiano?.segnaOrario(t); V.scriviSicuro(join(vault(), 'Orario.md'), t); } catch { } return; }
      }
      manda('vault:orario', o);
    },
    noteCambiate: () => manda('vault:info', info()),
    lodeCambiata: () => { try { arrivati(); } catch (x) { console.error('Lode: sincronizzazione', x); } },
  });
  try { guardiano.segnaOrario(readFileSync(join(vault(), 'Orario.md'), 'utf8')); } catch { }
  apriSincronizzazione();
  if (conSync) creaOrarioSync();
}
// Orario.md manca (non ancora scaricato, tolto) con la sincronizzazione accesa: si scrive dalla vista unita, ma solo se ha
// delle lezioni e se sono già arrivati i file degli altri computer (o non ce ne sono): mai un Orario.md vuoto o indietro
function creaOrarioSync() {
  try {
    const f = join(vault(), 'Orario.md');
    if (!motore || motore.bloccato || existsSync(f) || existsSync(join(vault(), '.Orario.md.icloud'))) return;
    const o = motore.vista().orario || [], id = confSync().dispositivo;
    let altriFile = []; try { altriFile = readdirSync(join(vault(), '.lode', 'dispositivi')).filter(n => /^\.?[0-9a-f]{16}\.json(\.icloud)?$/.test(n) && !n.replace(/^\./, '').startsWith(id + '.')); } catch { }
    if (!o.length || (altriFile.length && !motore.stato().altri.length)) return;
    const t = V.testoOrario(o); guardiano?.segnaOrario(t); V.scriviSicuro(f, t);
  } catch (x) { console.warn('Lode: Orario.md non scritto', x.message); }
}
async function scegliVault() {
  const r = await dialog.showOpenDialog({ title: 'Scegli il vault Obsidian', buttonLabel: 'Usa questo vault', properties: ['openDirectory', 'createDirectory'], defaultPath: vault() });
  if (r.canceled || !r.filePaths[0]) return null;
  scriviTutto(); motore?.chiudi?.();   // i dati in sospeso vanno nel vault di prima
  chiaveSessione = null; bloccate.clear(); inAttesa.clear(); vecchieSessione = [];   // la chiave e le modifiche in attesa sono del vault di prima
  // fino al ricaricamento le finestre hanno i dati del vault di prima: un loro salvataggio non deve entrare nel nuovo
  for (const w of tutte()) nonLetti.add(w.webContents.id);
  conf.vault = r.filePaths[0]; salvaConf();
  const ok = await apriVault();
  tutte().forEach(w => w.webContents.reload());
  return ok ? info() : null;
}
// la cartella può essere bloccata (Windows: accesso controllato alle cartelle, antivirus, OneDrive irraggiungibile): lo si dice e si sceglie
async function apriVault() {
  try { avviaVault(); return true; }
  catch (x) {
    console.error(x);
    if (process.env.LODE_PROVA) return false;   // prove automatiche: nessuna finestra modale che le blocchi
    const r = await dialog.showMessageBox({ type: 'warning', title: 'Lode', message: `Lode non riesce a usare la cartella ${vault()}`, noLink: true,
      detail: WIN && /^(EPERM|EACCES)$/.test(x.code) ? 'Probabilmente Windows la protegge (Sicurezza di Windows › Protezione da ransomware › Accesso alle cartelle controllato) o l\'antivirus blocca Lode. Consenti Lode, oppure scegli un\'altra cartella.' : x.message,
      buttons: ['Scegli un\'altra cartella', 'Riprova', 'Non ora'], defaultId: 0, cancelId: 2 });
    return r.response === 1 ? apriVault() : r.response === 0 ? !!(await scegliVault()) : false;
  }
}

/* ---------- i dati di Lode: .lode/dati.json ---------- */
// «non c'è» (ENOENT) vuol dire primo avvio; ogni altro errore no (OneDrive offline, file bloccato da antivirus o sync).
// La finestra che non ha letto i dati veri non scrive mai sopra dati.json: le sue modifiche vanno in dati.recupero.json
const accanto = nome => join(vault(), '.lode', nome);
const ATTESA = new Int32Array(new SharedArrayBuffer(4)), pausa = ms => Atomics.wait(ATTESA, 0, 0, ms);
// dati.json che manca ma c'è un dati.migrato-*: la sincronizzazione era accesa e il segno non c'è più. Si riparte dall'ultima
// migrazione, mai vuoti (se il segno torna, migra() la usa come base del confronto a tre vie: entrano solo le modifiche vere)
function ultimoMigrato() {
  let nomi = []; try { nomi = readdirSync(join(vault(), '.lode')); } catch { }
  const m = nomi.map(n => n.match(/^dati\.migrato-(\d+)\.json$/)).filter(Boolean).sort((a, b) => b[1] - a[1])[0];
  if (!m) return null;
  try { const d = JSON.parse(readFileSync(accanto(m[0]), 'utf8').replace(/^\uFEFF/, '')); if (d?.v === 1) { console.warn('Lode: dati.json manca, riparto da', m[0]); return d; } } catch { }
  return null;
}
// baseLetta: l'ultimo dati.json letto davvero (o la migrazione da cui si riparte, o null: niente, la barra parte vuota). È la
// base del confronto a tre vie se un dati.json scritto da questo processo ricompare dopo la migrazione (sincronizza.mjs, migra)
let baseLetta = null;
function leggiDati() {
  const f = fileDati();
  for (let i = 1; ; i++) {
    let testo;
    try { testo = readFileSync(f, 'utf8'); } catch (x) { if (x.code === 'ENOENT') { const m = ultimoMigrato(); baseLetta = m ? JSON.parse(JSON.stringify(m)) : null; return m; } if (i >= 3) throw x; pausa(250); continue; }
    // un dati.json scritto da questo processo: la base resta quella da cui è partito (le sue modifiche non sono la base)
    try { const d = JSON.parse(testo.replace(/^\uFEFF/, '')), mia = datiScritti.get(firmaCorta(d)); baseLetta = mia ? mia.base : JSON.parse(testo.replace(/^\uFEFF/, '')); return d; } catch { }
    // rovinato (es. corrente saltata mentre scriveva): resta da parte e si riparte dalla copia di prima
    renameSync(f, accanto(`dati.illeggibile-${Date.now()}.json`));
    try { const d = JSON.parse(readFileSync(accanto('dati.prev.json'), 'utf8')); try { copyFileSync(accanto('dati.prev.json'), f); } catch { } return d; } catch { return null; }
  }
}
// si scrive dopo 250 ms; se Windows tiene il file bloccato (EPERM, EBUSY) si riprova più tardi, senza perdere niente
const inSospeso = new Map();   // percorso → { d, t, n }
// i dati.json scritti da questo processo (firma): se ricompaiono dopo la migrazione, sono le modifiche di qui e si uniscono
// (sincronizza.mjs, migra). fileDatiNostro: mtime e dimensione dell'ultimo scritto (dopo «Smetti di sincronizzare», un
// dati.json riscritto da un altro computer si rilegge)
const datiScritti = new Map(); let fileDatiNostro = '';   // impronta della firma → { base: il dati.json letto prima di scriverlo }
const firmaCorta = d => createHash('sha256').update(SY.firmaDati(d)).digest('hex');
const recuperoRuotato = new Set();
function scriviDopo(f, d) { clearTimeout(inSospeso.get(f)?.t); inSospeso.set(f, { d, n: 0, t: setTimeout(() => scrivi(f), 250) }); }
function scrivi(f) {
  const x = inSospeso.get(f); if (!x) return; clearTimeout(x.t);
  try {
    if (/[\\/]dati\.json$/.test(f)) try { copyFileSync(f, f.replace(/json$/, 'prev.json')); } catch { }   // la versione di prima, per ogni evenienza
    else if (!recuperoRuotato.has(f)) { if (existsSync(f)) renameSync(f, f.replace(/json$/, `${Date.now()}.json`)); recuperoRuotato.add(f); }   // il recupero di un'altra volta resta
    V.scriviSicuro(f, JSON.stringify(x.d, null, 1)); inSospeso.delete(f);
    if (/[\\/]dati\.json$/.test(f)) { datiScritti.set(firmaCorta(x.d), { base: baseLetta }); try { const st = statSync(f); fileDatiNostro = `${st.mtimeMs}|${st.size}`; } catch { } }
  } catch (e) { console.error(e); if (x.n < 10) x.t = setTimeout(() => scrivi(f), Math.min(30e3, 1000 * 2 ** x.n++)); }   // poi riprova al prossimo salvataggio o all'uscita
}
// all'uscita, quando Windows si spegne, prima di cambiare vault; con la sincronizzazione anche il file di questo computer
const scriviTutto = () => { [...inSospeso.keys()].forEach(scrivi); try { motore?.scriviOra?.(); } catch (x) { console.error(x); } };
app.on('before-quit', () => { uscendo = true; scriviTutto(); });
app.whenReady().then(() => { powerMonitor.on('resume', riprovaLettura); powerMonitor.on('unlock-screen', riprovaLettura); });

/* ---------- sincronizzazione fra i computer dello studente (sincronizza.mjs, docs/SINCRONIZZAZIONE.md) ---------- */
// Accesa se nel vault c'è .lode/sincronizzazione.json. Allora i dati di Lode non stanno più in dati.json: ogni computer scrive
// solo .lode/dispositivi/<id>.json e legge quelli degli altri. L'id sta qui, in config.json, mai nel vault. La password non si
// salva mai: si può ricordare la chiave derivata con safeStorage (portachiavi del sistema), legata a questo vault
let motore = null, chiaveSessione = null, chiaveMotore = null, spostando = false, candidati = [], vecchieSessione = [], esitoSpenta = null;
const durante = new Map();   // finestra → ultimo D mandato mentre il vault cambiava cartella
// la password accesa sull'altro computer mentre questo è aperto: il motore si blocca. Per ogni finestra la versione che aveva
// (bloccate) e l'ultimo D che ha mandato intanto (inAttesa): allo sblocco entrano con un confronto a tre vie, non si perdono
const bloccate = new Map(), inAttesa = new Map();
// le modifiche in attesa anche su disco (<userData>/sincronizzazione/in-attesa.json, legate al vault): se Lode si chiude prima
// dello sblocco, allo sblocco entrano lo stesso. In chiaro come dati.recupero.json: è una copia su questo computer
const PROCESSO = Math.random().toString(36).slice(2), FILE_ATTESA = () => join(LOCALE(), 'sincronizzazione', 'in-attesa.json');
function attesaSuDisco() { try { const j = JSON.parse(readFileSync(FILE_ATTESA(), 'utf8')); return (j.vault === vault() && Array.isArray(j.voci)) ? j.voci : []; } catch { return []; } }
function salvaAttesa() {
  try {
    const voci = attesaSuDisco().filter(x => !x.k.startsWith(PROCESSO + ':'));
    for (const [id, d] of inAttesa) voci.push({ k: `${PROCESSO}:${id}`, base: bloccate.get(id) || SY.vuotoBarra(), d: { ...d, __rev: undefined } });
    mkdirSync(dirname(FILE_ATTESA()), { recursive: true }); V.scriviSicuro(FILE_ATTESA(), JSON.stringify({ vault: vault(), voci }));
  } catch (x) { console.error('Lode: modifiche in attesa non salvate su disco', x); }
}
function archiviaAttesa() { try { if (existsSync(FILE_ATTESA())) { mkdirSync(join(LOCALE(), 'copie'), { recursive: true }); renameSync(FILE_ATTESA(), join(LOCALE(), 'copie', `in-attesa-applicate-${Date.now()}.json`)); } } catch { } }
const LOCALE = () => app.getPath('userData');
const confSync = () => (conf.sincronizzazione ||= {});
// L'id resta legato a questo computer: se config.json arriva da un altro (Migrazione Assistita del Mac, una copia della
// cartella dei dati), i due scriverebbero lo stesso file. Un'impronta della macchina (processore, memoria, utente; mai nel
// vault) se ne accorge, e questo computer prende un id nuovo: il file del vecchio id resta dell'altro, e si unisce come gli altri
const macchina = () => { let u = ''; try { u = userInfo().username; } catch { } return createHash('sha256').update([process.platform, process.arch, cpus()[0]?.model || '', totalmem(), homedir(), u].join('|')).digest('hex').slice(0, 16); };
function idDispositivo() {
  const c = confSync(), m = macchina();
  if (c.dispositivo && c.macchina && c.macchina !== m) { console.warn('Lode: configurazione copiata da un altro computer, nuovo id per la sincronizzazione'); c.dispositivo = null; delete c.chiave; }
  if (!c.dispositivo) { c.dispositivo = SY.nuovoId(); c.macchina = m; salvaConf(); }
  else if (!c.macchina) { c.macchina = m; salvaConf(); }
  return c.dispositivo;
}
// safeStorage: sul Mac il Portachiavi, su Windows DPAPI, su Linux il portachiavi (GNOME Keyring, KWallet). Senza portachiavi
// Linux userebbe «basic_text», cioè in chiaro: lì la chiave non si ricorda e la password si chiede a ogni avvio
function puoRicordare() {
  try { if (!safeStorage.isEncryptionAvailable()) return false; return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'; } catch { return false; }
}
function chiaveRicordata() {
  const k = confSync().chiave;
  if (!k || k.vault !== vault() || !puoRicordare()) return null;
  try { return Buffer.from(safeStorage.decryptString(Buffer.from(k.dati, 'base64')), 'hex'); } catch { return null; }
}
function ricordaChiave(chiave, si) {
  const c = confSync();
  if (si && chiave && puoRicordare()) c.chiave = { vault: vault(), dati: safeStorage.encryptString(chiave.toString('hex')).toString('base64') };
  else delete c.chiave;
  salvaConf();
}
const ERRORE_SOSPETTA = 'La sincronizzazione risulta spenta, ma il segno dello stop non è stato fatto con la password di questi dati (scritto da qualcun altro nella cartella cloud?). Non riscrivo i dati in chiaro in .lode/dati.json: rimetti i file in .lode dal cestino del servizio cloud, o spegnila da un computer che ha la password.';
const ERRORE_SPARITA = 'I dati di Lode qui erano cifrati, ma nel vault mancano i file della sincronizzazione (.lode/cifratura.json, sincronizzazione.json, dispositivi). Non li riscrivo in chiaro: rimettili dal cestino del servizio cloud. Se non ti servono più, «Ricomincia senza i dati cifrati».';
function apriSincronizzazione(altreChiavi = []) {
  try { motore?.chiudi?.(); } catch { }
  motore = null;
  if (!SY.attiva(vault())) {
    // spenta su un altro computer mentre questo era chiuso: quello che sapeva solo lui (la sua copia locale) entra in dati.json
    const sp = SY.spenta(vault()), id = confSync().dispositivo, eraCifrato = confSync().cifrato === vault();
    if (sp && id && sp.da !== id) {
      let r = null;
      // le chiavi solo se qui il vault era cifrato: una chiave ricordata di un'altra volta non deve far sembrare cifrato uno stop in chiaro
      try { r = SY.seguiSpenta({ vault: vault(), locale: LOCALE(), dispositivo: id, chiavi: eraCifrato ? [chiaveSessione, chiaveRicordata()].filter(Boolean) : [], cifratoQui: eraCifrato, inAttesa: attesaSuDisco() }); if (r && r.esito !== 'uguale') esitoSpenta = r; } catch (x) { console.error('Lode: sincronizzazione spenta altrove, unione non riuscita', x); }
      // il segno dello stop non è stato fatto con la chiave di questo vault: non si torna a dati.json in chiaro
      if (r?.esito === 'non_autenticato') { motore = { bloccato: true, cifrato: true, codice: 'spenta_sospetta', errore: ERRORE_SOSPETTA }; return; }
      // seguita (non resta niente da unire): la chiave ricordata non serve più, e il vault non è più cifrato
      if (r && r.esito !== 'da_unire') { ricordaChiave(null, false); archiviaAttesa(); if (eraCifrato) { delete confSync().cifrato; salvaConf(); } }
    } else if (eraCifrato && !sp) {
      // era cifrato e i file della sincronizzazione sono spariti (tolti dalla cartella cloud) senza uno stop: niente dati.json in chiaro
      motore = { bloccato: true, cifrato: true, codice: 'cifratura_sparita', errore: ERRORE_SPARITA };
    }
    return;
  }
  const ricordata = chiaveRicordata(), chiave = chiaveSessione || ricordata;
  chiaveMotore = chiave;
  try { motore = SY.apri({ vault: vault(), locale: LOCALE(), dispositivo: idDispositivo(), chiave, altreChiavi: [...altreChiavi, ...vecchieSessione, ricordata].filter(Boolean), log: (...x) => console.warn(...x), datiMiei: d => datiScritti.get(firmaCorta(d)) || false }); }
  catch (x) { console.error('Lode: sincronizzazione non aperta', x); motore = { bloccato: true, errore: x.message }; }
  // vault cifrato: questo computer lo ricorda (config.json), così se i file della sincronizzazione spariscono non torna in chiaro
  if (motore?.cifrato && confSync().cifrato !== vault()) { confSync().cifrato = vault(); salvaConf(); }
  // cifrato e senza password (anche all'avvio, se la cifratura è arrivata mentre questo computer era spento): il suo file
  // in chiaro esce dal vault (la copia locale ha gli stessi dati) e torna, cifrato, allo sblocco
  if (motore?.bloccato && motore.cifrato && !motore.codice && SY.togliInChiaro(vault(), LOCALE(), idDispositivo())) console.log('Lode: vault cifrato: il file in chiaro di questo computer esce dal vault');
}
// il motore si è appena bloccato (password arrivata dall'altro computer): ogni finestra tiene la versione che aveva, entra fra
// quelle «non lette» (le sue modifiche aspettano lo sblocco) e riceve lo stato bloccato, così la barra lo dice
function bloccaFinestre(vecchio) {
  for (const w of tutte()) {
    const id = w.webContents.id;
    if (!nonLetti.has(id)) { try { bloccate.set(id, vecchio.baseDi(id)); } catch { } }
    nonLetti.add(id);
  }
}
// allo sblocco: le modifiche fatte intanto entrano (a tre vie, dalla versione che la finestra aveva), poi tutte le finestre
// ricevono la vista unita
function sbloccaFinestre() {
  for (const [id, d] of inAttesa) { const base = bloccate.get(id); if (base) { try { motore.salva(d, id, base); } catch (x) { console.error('Lode: modifiche in attesa non applicate (restano in copie/dati.recupero.json)', x); } } }
  // quelle di una volta prima (Lode chiusa o computer riavviato prima dello sblocco): dal file, ognuna con la sua base
  for (const x of attesaSuDisco().filter(x => !x.k.startsWith(PROCESSO + ':'))) { try { motore.salva(x.d, null, x.base || SY.vuotoBarra()); } catch (e) { console.error('Lode: modifiche in attesa di prima non applicate', e); } }
  archiviaAttesa();
  inAttesa.clear(); bloccate.clear();
  for (const w of tutte()) { nonLetti.delete(w.webContents.id); w.webContents.send('dati:cambiati', motore.per(w.webContents.id)); }
}
// la sincronizzazione spenta su un altro computer: si unisce quello che sa solo questo computer, il motore si chiude e le
// finestre passano a dati.json
function seguiSpenta() {
  let r = null;
  try {
    if (motore && !motore.bloccato) motore.ricarica();
    const attesa = [...[...inAttesa].map(([id, d]) => ({ base: bloccate.get(id) || SY.vuotoBarra(), d })), ...attesaSuDisco().filter(x => !x.k.startsWith(PROCESSO + ':'))];
    r = SY.seguiSpenta({ vault: vault(), locale: LOCALE(), dispositivo: idDispositivo(), S: motore && !motore.bloccato ? motore._stato() : null, chiavi: !!motore?.cifrato || confSync().cifrato === vault() ? [chiaveMotore, chiaveSessione, chiaveRicordata()].filter(Boolean) : [], inAttesa: attesa, cifratoQui: !!motore?.cifrato || confSync().cifrato === vault() });
  } catch (x) { console.error('Lode: sincronizzazione spenta altrove, unione non riuscita', x); r = { esito: 'errore' }; }
  // vault cifrato e segno dello stop senza la prova della chiave (o i dati aperti qui, con la chiave, e nessuna prova che torni):
  // non si passa a dati.json, che la barra riscriverebbe in chiaro con tutto quello che ha. Si resta bloccati e lo si dice
  if (r?.cifrato && (r.esito === 'non_autenticato' || (r.esito === 'da_unire' && motore && !motore.bloccato))) {
    const vecchio = motore; try { motore?.chiudi?.({ soloLocale: true }); } catch { }
    motore = { bloccato: true, cifrato: true, codice: 'spenta_sospetta', errore: ERRORE_SOSPETTA };
    if (vecchio && !vecchio.bloccato) bloccaFinestre(vecchio);
    esitoSpenta = r; manda('sync:stato', statoSync()); return;
  }
  try { motore?.chiudi?.({ niente: true }); } catch { }
  motore = null; chiaveSessione = null; chiaveMotore = null;
  // da unire (cifrati, manca la password): le modifiche fatte coi dati bloccati aspettano la password (sbloccaSpenta)
  if (r?.esito === 'da_unire') salvaAttesa();
  else { inAttesa.clear(); bloccate.clear(); archiviaAttesa(); ricordaChiave(null, false); delete confSync().cifrato; salvaConf(); }
  esitoSpenta = r; console.log('Lode: la sincronizzazione è stata spenta su un altro computer:', r?.esito);
  try { const st = statSync(fileDati()); fileDatiNostro = `${st.mtimeMs}|${st.size}`; } catch { }
  let d = null; try { d = leggiDati(); } catch { }
  for (const w of tutte()) { if (d) { nonLetti.delete(w.webContents.id); w.webContents.send('dati:cambiati', d); } else { nonLetti.add(w.webContents.id); w.webContents.reload(); } }
  manda('sync:stato', statoSync());
}
const mandaDati = tranne => { if (motore && !motore.bloccato) tutte().forEach(w => { if (w.webContents !== tranne && !nonLetti.has(w.webContents.id)) w.webContents.send('dati:cambiati', motore.per(w.webContents.id)); }); };
// è cambiato un file sotto .lode/ (watcher) o è passato il controllo periodico: i file degli altri computer
function arrivati() {
  if (spostando || !vault()) return;
  // «Smetti di sincronizzare» su un altro computer: questo smette anche lui (senza perdere quello che sa solo lui)
  if (motore && SY.spenta(vault())) { seguiSpenta(); return; }
  // lo stop è a metà (il segno dello stop c'è, il segno della sincronizzazione non ancora tolto o non ancora arrivato): si
  // aspetta, senza scambiare la cifratura.json che se ne va per una cifratura spenta
  if (motore && SY.spegnendo(vault())) { manda('sync:stato', statoSync()); return; }
  // dopo lo stop: un dati.json riscritto da un altro computer (con le modifiche che sapeva solo lui) si rilegge
  if (!motore && fileDatiNostro && SY.spenta(vault()) && !inSospeso.has(fileDati())) {
    try { const st = statSync(fileDati()), f = `${st.mtimeMs}|${st.size}`; if (f !== fileDatiNostro) { fileDatiNostro = f; const d = leggiDati(); if (d) tutte().forEach(w => { if (!nonLetti.has(w.webContents.id)) w.webContents.send('dati:cambiati', d); }); } } catch { }
  }
  // la sincronizzazione accesa da un altro computer (o da «Documenti» già in iCloud) mentre questo scrive ancora dati.json:
  // si passa subito al file del computer. Quello che aspetta di essere scritto va prima in dati.json (che migra() confronta con
  // l'ultimo dati.migrato: entrano solo le modifiche vere), poi le finestre ricevono la vista unita e dati.json non si scrive più
  if (!motore) {
    if (!SY.attiva(vault())) return;
    scrivi(fileDati()); apriSincronizzazione();
    console.log('Lode: la sincronizzazione si è accesa sul vault: passo al file di questo computer');
    if (motore && !motore.bloccato) { for (const w of tutte()) { nonLetti.delete(w.webContents.id); w.webContents.send('dati:cambiati', motore.per(w.webContents.id)); } }
    else for (const w of tutte()) { nonLetti.add(w.webContents.id); w.webContents.reload(); }   // cifrato: la barra rilegge e chiede la password
    manda('sync:stato', statoSync()); return;
  }
  // la cifratura appena accesa sull'altro computer: questo si blocca finché non si scrive la password (niente più file in chiaro)
  let cif = null; try { cif = SY.leggiCifratura(vault()); } catch { }
  // cifratura.json come segnaposto di iCloud: c'è, non è ancora sul disco. Cifrato: si aspetta; in chiaro: ci si blocca
  if (SY.cifraturaInArrivo(vault())) {
    if (!motore.cifrato && !motore.bloccato) { const vecchio = motore; motore.chiudi({ soloLocale: true }); apriSincronizzazione(); if (motore?.bloccato) bloccaFinestre(vecchio); }
    manda('sync:stato', statoSync()); return;
  }
  // era cifrato e cifratura.json è sparito (tolto dalla cartella cloud, senza uno stop): ci si blocca, mai in chiaro
  if (!cif && motore.cifrato && !motore.bloccato) {
    const vecchio = motore; motore.chiudi({ soloLocale: true });
    motore = { bloccato: true, cifrato: true, codice: 'cifratura_sparita', errore: ERRORE_SPARITA }; bloccaFinestre(vecchio);
    manda('sync:stato', statoSync()); return;
  }
  // anche la cifratura accesa altrove con un'altra password mentre questo era già cifrato con la sua: la chiave di qui non apre
  // più cifratura.json. Si blocca (e non scrive più nel vault un file che gli altri non leggono)
  const altraChiave = !!cif && !!motore.cifrato && !motore.bloccato && !(chiaveMotore && SY.provaChiave(cif, chiaveMotore));
  if ((!!cif !== !!motore.cifrato && !motore.bloccato) || altraChiave) {
    if (altraChiave) { vecchieSessione.push(chiaveMotore); chiaveSessione = null; }
    const vecchio = motore;
    motore.chiudi({ soloLocale: true }); apriSincronizzazione();
    if (motore?.bloccato) bloccaFinestre(vecchio);
    else mandaDati();
    manda('sync:stato', statoSync()); return;
  }
  if (!motore.bloccato && motore.ricarica()) mandaDati();
  // il proprio file riscritto da un altro computer con lo stesso id: questo ne prende uno nuovo (il file di prima resta e si unisce)
  if (motore && !motore.bloccato && motore.stato().conteso) {
    console.warn('Lode: un altro computer usa lo stesso id: ne prendo uno nuovo'); motore.scriviOra();
    confSync().dispositivo = SY.nuovoId(); salvaConf(); apriSincronizzazione(); mandaDati();
  }
  manda('sync:stato', statoSync());
}
setInterval(() => { try { arrivati(); } catch (x) { console.error('Lode: sincronizzazione', x); } }, 30e3);   // i servizi che non generano eventi sul disco (cartelle di rete, alcuni client)
// note: le copie in conflitto delle note (un giro nel vault): solo quando la barra lo chiede, non a ogni file che arriva
function statoSync({ note = false } = {}) {
  const v = vault(), attiva = SY.attiva(v), s = motore && !motore.bloccato ? motore.stato() : null;
  let cifrata = false; try { cifrata = !!SY.leggiCifratura(v); } catch { cifrata = true; }
  const daUnire = !motore && spentaDaUnire();   // spenta altrove: i dati di questo computer sono cifrati, serve la password
  return { attiva, servizio: confSync().servizio || SY.servizioDi(v) || null, vault: v, cifrata: cifrata || daUnire || !!motore?.cifrato, bloccata: !!motore?.bloccato || daUnire, errore: motore?.errore || (daUnire ? 'La sincronizzazione è stata spenta su un altro computer. Quello che sapeva solo questo computer è cifrato (nella cartella dei dati di Lode, copie): scrivi la password per unirlo a .lode/dati.json.' : null), codice: motore?.codice || (daUnire ? 'spenta_cifrata' : null),
    inAttesa: inAttesa.size > 0,
    ricordata: !!confSync().chiave && confSync().chiave.vault === v, puoRicordare: puoRicordare(), linux: process.platform === 'linux',
    ultimoArrivo: s?.ultimoArrivo || 0, ultimoScritto: s?.ultimoScritto || 0, altri: s?.altri.length || 0, problemi: s?.problemi || [],
    note: attiva && note ? SY.copieNote(v, 20) : [], spostando,
    spenta: !attiva && SY.spenta(v) ? { quando: SY.spenta(v).spenta, qui: SY.spenta(v).da === confSync().dispositivo, esito: esitoSpenta?.esito || null } : null };
}
// le cartelle cloud del computer (e, dentro, i vault di Lode già sincronizzati, per il secondo computer). La barra poi manda
// solo l'indice di questo elenco, mai un percorso. Nelle prove (solo in sviluppo) LODE_CLOUD aggiunge una cartella finta
function trovaCandidati() {
  const c = SY.cartelleCloud();
  if (process.env.LODE_CLOUD) c.unshift({ servizio: 'Cartella di prova', percorso: process.env.LODE_CLOUD });
  // i vault di Lode: in cima alla cartella cloud o un livello sotto (Documenti/Lode: sul Mac «Documenti in iCloud»)
  const vaultIn = dir => { const out = []; let nomi = []; try { nomi = readdirSync(dir); } catch { } for (const n of nomi) if (/^Lode/.test(n) && !/copia/.test(n) && existsSync(join(dir, n, '.lode'))) out.push(join(dir, n)); return out; };
  candidati = c.map(x => {
    let sotto = []; try { sotto = readdirSync(x.percorso, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.') && !/^Lode/.test(d.name)).slice(0, 200).map(d => join(x.percorso, d.name)); } catch { }
    const vaults = [x.percorso, ...sotto].flatMap(vaultIn).map(p => ({ nome: p.slice(x.percorso.length + 1).split(/[\\/]/).join('/'), percorso: p, sincronizzato: SY.attiva(p) }));
    return { ...x, vaults };
  });
  return candidati.map((x, i) => ({ i, servizio: x.servizio, nota: x.nota || '', nome: x.percorso.split(/[\\/]/).slice(-2).join('/'), vaults: x.vaults.map((v, j) => ({ j, nome: v.nome, sincronizzato: v.sincronizzato })), qui: SY.dentroA(vault(), x.percorso) }));
}
const progressoSync = x => manda('sync:progresso', x);
// passa al vault nuovo: configurazione di Lode e lista di Obsidian (stessa voce, percorso nuovo)
function passaA(nuovo, vecchio = vault()) { conf.vault = nuovo; salvaConf(); try { V.spostaInObsidian(vecchio, nuovo); } catch (x) { console.warn('Lode: lista di Obsidian non aggiornata', x.message); } }
async function attivaSincronizzazione({ i, scegli } = {}) {
  let cartella, servizio;
  if (scegli) {
    if (process.env.LODE_PROVA) return { esito: 'errore', errore: 'nelle prove niente finestre' };
    const r = await dialog.showOpenDialog({ title: 'Scegli la cartella che si sincronizza', buttonLabel: 'Usa questa cartella', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { esito: 'annullato' };
    cartella = r.filePaths[0]; servizio = SY.servizioDi(cartella);
  } else { const c = candidati[i]; if (!c) return { esito: 'errore', errore: 'cartella sconosciuta' }; cartella = c.percorso; servizio = c.servizio; }
  if (spostando) return { esito: 'in_corso' };
  if (SY.attiva(vault())) return { esito: 'gia', servizio: confSync().servizio };
  scriviTutto(); spostando = true; durante.clear(); guardiano?.chiudi(); guardiano = null;
  const vecchio = vault();
  try {
    const r = await SY.spostaVault({ da: vecchio, cartella, locale: LOCALE(), passa: n => passaA(n, vecchio), avanza: progressoSync, ferma: process.env.LODE_FERMA_SPOSTAMENTO || null });
    if (r.giaDentro) SY.segna(vecchio);   // già nella cartella cloud: si accende sul posto
    confSync().servizio = servizio || SY.servizioDi(cartella) || 'la cartella scelta'; salvaConf();
    spostando = false;
    avviaVault();   // apre la sincronizzazione: migra dati.json nel file di questo computer
    for (const [chi, d] of durante) motore?.salva?.(d, chi);   // quello che è cambiato intanto
    durante.clear();
    tutte().forEach(w => w.webContents.reload());
    progressoSync({ fase: 'fatto', p: 1, testo: 'Fatto' });
    return { esito: 'ok', vault: vault(), copia: r.copia, vecchia: r.vecchia || null, giaDentro: !!r.giaDentro, servizio: confSync().servizio };
  } catch (x) {
    console.error('Lode: spostamento non riuscito', x);
    // per le prove dello spostamento interrotto: Lode si chiude come se fosse saltata la corrente
    if (x.codice === 'interrotto' && process.env.LODE_FERMA_SPOSTAMENTO) { console.log('LODE-INTERROTTO'); uscendo = true; setTimeout(() => app.exit(3), 300); return { esito: 'interrotto' }; }
    spostando = false; try { avviaVault(); } catch { }
    for (const [chi, d] of durante) { const w = tutte().find(x => x.webContents.id === chi); if (w) scriviDopo(fileDati(), d); }
    durante.clear();
    return { esito: 'errore', errore: x.message };
  }
}
// il secondo computer: «Uso già Lode su un altro computer». Il vault di prima resta dov'è, intatto
async function collegaVault({ i, j, scegli } = {}) {
  let p;
  if (scegli) {
    if (process.env.LODE_PROVA) return { esito: 'errore', errore: 'nelle prove niente finestre' };
    const r = await dialog.showOpenDialog({ title: 'Scegli il vault di Lode nella cartella cloud', buttonLabel: 'Usa questo vault', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { esito: 'annullato' };
    p = r.filePaths[0];
  } else p = candidati[i]?.vaults[j]?.percorso;
  if (!p || !existsSync(join(p, '.lode'))) return { esito: 'errore', errore: 'Questa cartella non è un vault di Lode (manca .lode). Scegli la cartella «Lode» dentro la tua cartella cloud.' };
  scriviTutto(); try { motore?.chiudi?.(); } catch { }
  chiaveSessione = null;
  conf.vault = p; confSync().servizio = SY.servizioDi(p) || candidati[i]?.servizio || 'la cartella scelta';
  salvaConf();
  SY.segna(p);   // un vault messo nella cartella cloud a mano: da adesso si sincronizza
  await apriVault();
  // ogni finestra riceve subito i dati del vault nuovo (anche il benvenuto, che resta dov'è): una finestra rimasta coi dati
  // di prima, salvando, li farebbe sembrare «tolti» a tutti i computer
  for (const w of tutte()) { if (motore && !motore.bloccato) { nonLetti.delete(w.webContents.id); w.webContents.send('dati:cambiati', motore.per(w.webContents.id)); } else nonLetti.add(w.webContents.id); }
  tutte().forEach(w => { if (w !== benvenuto) w.webContents.reload(); });
  // niente ancora dagli altri computer (file non scaricati o a metà): lo si dice, e la barra aspetta prima del benvenuto
  const s = motore && !motore.bloccato ? motore.stato() : null, vista = s ? motore.vista() : null;
  const attesa = !!s && !s.altri.length && !vista.esami.length && !vista.profilo?.nome;
  return { esito: 'ok', bloccata: !!motore?.bloccato, attesa, servizio: confSync().servizio };
}
ipcMain.handle('sync:stato', () => statoSync({ note: true }));
ipcMain.handle('sync:cartelle', () => trovaCandidati());
ipcMain.handle('sync:attiva', (_, x) => attivaSincronizzazione(x || {}));
ipcMain.handle('sync:collega', (_, x) => collegaVault(x || {}));
// la password: si usa e si dimentica. Accendere la cifratura riscrive il file di questo computer cifrato
ipcMain.handle('sync:cifra', (_, { password, ricorda } = {}) => {
  if (!motore || motore.bloccato) return { esito: 'errore', errore: motore?.codice === 'chiave_diversa' ? motore.errore : 'Prima accendi la sincronizzazione.' };
  try {
    motore.ricarica(); motore.scriviOra();   // gli ultimi file degli altri computer entrano prima: poi i loro file in chiaro escono dal vault
    const chiave = SY.accendiCifratura(vault(), LOCALE(), password);
    chiaveSessione = chiave; ricordaChiave(chiave, ricorda);
    motore.chiudi({ soloLocale: true }); apriSincronizzazione();
    if (motore && !motore.bloccato) { motore.salva(motore.vista(), null); motore.scriviOra(); mandaDati(); }   // il motore è nuovo: ogni finestra riceve la sua versione
    manda('sync:stato', statoSync());
    return { esito: 'ok', ricordata: !!confSync().chiave };
  } catch (x) { return { esito: 'errore', errore: x.codice === 'corta' ? 'La password deve avere almeno 8 caratteri.' : x.message }; }
});
// spenta su un altro computer e i dati che sapeva solo questo computer sono cifrati: la password apre la cifratura.json
// dell'archivio dello stop, poi si unisce e si riscrive dati.json (sincronizza.mjs, seguiSpenta)
function sbloccaSpenta(password) {
  const info = SY.cifraturaArchiviata(vault());
  if (!info) return { esito: 'errore', errore: 'Nell\'archivio dello stop manca cifratura.json: non posso aprire i dati cifrati di questo computer. Sono in una copia nella cartella dei dati di Lode (copie).' };
  let chiave; try { chiave = SY.chiaveDa(info, password); } catch (x) { return { esito: 'errore', errore: x.codice === 'password' ? 'Password sbagliata.' : x.message }; }
  const fuori = motore && !motore.bloccato ? null : motore;
  const r = SY.seguiSpenta({ vault: vault(), locale: LOCALE(), dispositivo: idDispositivo(), chiavi: [chiave], cifratoQui: true, inAttesa: [...[...inAttesa].map(([id, d]) => ({ base: bloccate.get(id) || SY.vuotoBarra(), d })), ...attesaSuDisco().filter(x => !x.k.startsWith(PROCESSO + ':'))] });
  if (!r || r.esito === 'non_autenticato' || r.esito === 'da_unire') return { esito: 'errore', errore: r?.esito === 'non_autenticato' ? ERRORE_SOSPETTA : 'Non riesco ad aprire i dati di questo computer con questa password.' };
  if (fuori) motore = null;
  inAttesa.clear(); bloccate.clear(); archiviaAttesa(); ricordaChiave(null, false); delete confSync().cifrato; salvaConf();
  esitoSpenta = r;
  try { const st = statSync(fileDati()); fileDatiNostro = `${st.mtimeMs}|${st.size}`; } catch { }
  let d = null; try { d = leggiDati(); } catch { }
  for (const w of tutte()) { if (d) { nonLetti.delete(w.webContents.id); w.webContents.send('dati:cambiati', d); } else { nonLetti.add(w.webContents.id); w.webContents.reload(); } }
  manda('sync:stato', statoSync());
  return { esito: 'ok', ricordata: false };
}
const spentaDaUnire = () => !SY.attiva(vault()) && !!SY.spenta(vault()) && (esitoSpenta?.esito === 'da_unire' || esitoSpenta?.esito === 'non_autenticato' || motore?.codice === 'spenta_sospetta') && !!SY.cifraturaArchiviata(vault());
ipcMain.handle('sync:sblocca', (_, { password, ricorda } = {}) => {
  try {
    if (spentaDaUnire()) return sbloccaSpenta(password);
    const info = SY.leggiCifratura(vault()); if (!info) return { esito: 'errore', errore: motore?.errore || 'Nel vault manca .lode/cifratura.json.' };
    let chiave;
    try { chiave = SY.chiaveDa(info, password); }
    catch (x) {
      if (x.codice !== 'password') throw x;
      // non è la password del vault, ma forse quella che questo computer usava prima (cifratura accesa qui con un'altra
      // password): con le copie di cifratura salvate qui apre i suoi file. Si tiene, e serve ancora quella attuale
      const vecchie = SY.chiaviVecchie(vault(), LOCALE(), password);
      if (!vecchie.length) throw x;
      vecchieSessione.push(...vecchie);
      if (!(chiaveSessione && SY.provaChiave(info, chiaveSessione))) return { esito: 'errore', codice: 'vecchia', errore: 'Questa è la password che usavi prima su questo computer: la tengo per riaprire i suoi dati. Ora scrivi la password attuale, quella degli altri computer.' };
      chiave = chiaveSessione;
    }
    // le chiavi con cui questo computer può aver cifrato i suoi file prima: la sessione di prima, quella ricordata, e la stessa
    // password con i sali di prima (cifratura accesa anche qui mentre l'altro computer la accendeva)
    const vecchie = [chiaveSessione, chiaveRicordata(), ...vecchieSessione, ...SY.chiaviVecchie(vault(), LOCALE(), password)].filter(Boolean);
    chiaveSessione = chiave;
    apriSincronizzazione(vecchie);
    if (!motore || motore.bloccato) return { esito: 'errore', errore: motore?.errore || 'Non riesco ad aprire i dati.' };
    ricordaChiave(chiave, ricorda); vecchieSessione = [];
    sbloccaFinestre();
    manda('sync:stato', statoSync());
    return { esito: 'ok', ricordata: !!confSync().chiave };
  } catch (x) { return { esito: 'errore', errore: x.codice === 'password' ? 'Password sbagliata.' : x.message, codice: x.codice || null }; }
});
ipcMain.handle('sync:dimentica', () => { ricordaChiave(null, false); return statoSync(); });
// «Ho dimenticato la password: ricomincia senza i dati cifrati» (solo coi dati bloccati): i file della sincronizzazione vanno in
// un archivio nel vault (e una copia su questo computer), e Lode riparte da .lode/dati.json. I dati cifrati restano lì, cifrati
ipcMain.handle('sync:ricomincia', () => {
  if (!motore?.bloccato) return { esito: 'errore', errore: 'Si può solo coi dati bloccati.' };
  try {
    const r = SY.ricomincia({ vault: vault(), locale: LOCALE() });
    try { motore?.chiudi?.({ niente: true }); } catch { }
    motore = null; chiaveSessione = null; chiaveMotore = null; vecchieSessione = []; inAttesa.clear(); bloccate.clear(); archiviaAttesa(); ricordaChiave(null, false);
    delete confSync().cifrato; salvaConf(); esitoSpenta = null;
    for (const w of tutte()) { nonLetti.add(w.webContents.id); w.webContents.reload(); }
    manda('sync:stato', statoSync());
    return { esito: 'ok', archivio: r.archivio };
  } catch (x) { return { esito: 'errore', errore: x.message }; }
});
// «Smetti di sincronizzare»: dati.json con l'unione di tutti i computer (in chiaro), i file della sincronizzazione in un
// archivio nel vault e una copia su questo computer; gli altri computer se ne accorgono e smettono anche loro
ipcMain.handle('sync:smetti', () => {
  if (!motore) return { esito: 'errore', errore: 'La sincronizzazione non è accesa.' };
  if (motore.bloccato) return { esito: 'errore', errore: 'Prima scrivi la password: per smettere riscrivo i dati di Lode in chiaro in .lode/dati.json.' };
  try {
    scriviTutto();
    const r = SY.smetti({ vault: vault(), locale: LOCALE(), motore });
    motore = null; chiaveSessione = null; chiaveMotore = null; inAttesa.clear(); bloccate.clear(); ricordaChiave(null, false); esitoSpenta = { esito: 'qui' };
    baseLetta = JSON.parse(JSON.stringify(r.D)); datiScritti.set(firmaCorta(r.D), { base: baseLetta }); delete confSync().cifrato; salvaConf();
    try { const st = statSync(fileDati()); fileDatiNostro = `${st.mtimeMs}|${st.size}`; } catch { }
    for (const w of tutte()) { nonLetti.delete(w.webContents.id); w.webContents.send('dati:cambiati', r.D); }
    manda('sync:stato', statoSync());
    return { esito: 'ok', archivio: r.archivio };
  } catch (x) { console.error('Lode: «Smetti di sincronizzare» non riuscito', x); return { esito: 'errore', errore: x.message }; }
});
app.on('before-quit', () => { try { motore?.chiudi?.(); } catch { } });

/* ---------- canali con la barra ---------- */
const nonLetti = new Set();   // finestre partite senza i dati veri (lettura fallita)
// appena dati.json torna leggibile (OneDrive di nuovo in linea, file sbloccato) le finestre ricevono i dati veri;
// le modifiche fatte nel frattempo restano in dati.recupero.json
let tRilettura = 0;
function riprovaLettura() {
  clearTimeout(tRilettura); if (!nonLetti.size) return;
  try {
    const d = leggiDati(); if (!d) throw new Error('vuoto');
    for (const w of tutte()) if (nonLetti.has(w.webContents.id)) { nonLetti.delete(w.webContents.id); w.webContents.send('dati:cambiati', d); }
    console.log('Lode: dati di nuovo leggibili');
  } catch { tRilettura = setTimeout(riprovaLettura, 30e3); }
}
ipcMain.on('dati:leggi', e => {
  if (motore) {   // sincronizzazione accesa: lo stato unito di tutti i computer (o «bloccati», se manca la password)
    // la finestra riparte vuota: le sue modifiche, allo sblocco, si confrontano con i valori di partenza della barra
    if (motore.bloccato) { nonLetti.add(e.sender.id); bloccate.set(e.sender.id, SY.vuotoBarra()); inAttesa.delete(e.sender.id); e.returnValue = { __errore: 'bloccati' }; return; }
    nonLetti.delete(e.sender.id); e.returnValue = motore.per(e.sender.id); return;
  }
  scrivi(fileDati());   // prima quello che aspetta di essere scritto (una finestra che si ricarica rilegge i dati giusti)
  try { e.returnValue = leggiDati(); nonLetti.delete(e.sender.id); }
  catch (x) { console.error('Lode: non riesco a leggere i dati', x); nonLetti.add(e.sender.id); e.returnValue = { __errore: x.code || 'lettura' }; tRilettura = setTimeout(riprovaLettura, 15e3); }   // js/dati.js parte vuoto e lo dice
});
ipcMain.on('dati:salva', (e, d) => {
  if (spostando) { durante.set(e.sender.id, d); return; }   // il vault sta passando nella cartella cloud: si applica dopo
  if (motore && !motore.bloccato && !nonLetti.has(e.sender.id)) {
    try {
      const r = motore.salva(d, e.sender.id);
      if (r.perAltri) mandaDati(e.sender);
      if (r.perChi) e.sender.send('dati:cambiati', motore.per(e.sender.id));   // le mancava qualcosa arrivato dall'altro computer
      return;
    } catch (x) { console.error('Lode: unione non riuscita, salvo a parte', x); }   // niente va perso: sotto, nel file a parte
  }
  // bloccati (manca la password) o finestra partita senza i dati: le modifiche di adesso vanno in un file a parte su questo
  // computer, mai in chiaro nel vault (che può essere cifrato)
  if (motore) { if (motore.bloccato && bloccate.has(e.sender.id)) { inAttesa.set(e.sender.id, d); salvaAttesa(); } return scriviDopo(join(app.getPath('userData'), 'copie', 'dati.recupero.json'), { ...d, __rev: undefined }); }
  if (nonLetti.has(e.sender.id)) {   // niente dati.json, e i dati vuoti non arrivano alle finestre che hanno quelli veri
    scriviDopo(accanto('dati.recupero.json'), d);
    return tutte().forEach(w => { if (w.webContents !== e.sender && nonLetti.has(w.webContents.id)) w.webContents.send('dati:cambiati', d); });
  }
  scriviDopo(fileDati(), d);
  manda('dati:cambiati', d, e.sender);
});
ipcMain.on('mouse', (e, ignora) => BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(ignora, { forward: true }));
ipcMain.handle('vault:info', () => info());
ipcMain.handle('benvenuto:fatto', () => { conf.benvenuto = new Date().toISOString(); salvaConf(); benvenuto?.close(); barra?.webContents.reload(); setTimeout(() => barra?.webContents.send('scorciatoia', 'scrivi'), 1500); return true; });
// i corsi di esempio se ne vanno dal vault, ma solo le note che non contengono niente di scritto dallo studente
ipcMain.handle('vault:pulisciCorsi', (_, { nomi }) => {
  let tolte = 0;
  for (const n of nomi) {
    const p = V.dentro(vault(), `Corsi/${n.replace(/[\\/:*?"<>|#^[\]]/g, ' ').trim()}.md`);
    try { const t = readFileSync(p, 'utf8').replace(/%% lode:corso %%[\s\S]*?%% \/lode:corso %%/, '').replace(/^---[\s\S]*?---/, '').replace(/^# .*$/m, '').replace(/%%[\s\S]*?%%/g, '').replace(/Le lezioni di questo corso[\s\S]*?definizioni\./, '').trim(); if (!t) { rmSync(p); tolte++; } } catch { }
  }
  return tolte;
});
ipcMain.handle('vault:lezioni', () => V.lezioni(vault()));
// i percorsi che arrivano dalla barra passano tutti da V.relativo (barre in «/», niente «..» né cartelle o file che
// cominciano col punto, come .obsidian o .lode) e solo dopo dal controllo delle cartelle permesse: «Lezioni/../.obsidian/x»
// non passa più. Le note di una lezione possono stare in sottocartelle (Lezioni/Corso/Esercitazioni/x.md)
const NOTA_LEZIONE = /^(Lezioni|Corsi)\/(?:[^/.][^/]*\/)*[^/.][^/]*\.md$/;
ipcMain.handle('vault:annota', (_, x) => {
  const file = V.relativo(x?.file), corso = x?.corso?.file ? { ...x.corso, file: V.relativo(x.corso.file) } : null;
  if (!NOTA_LEZIONE.test(file) || (corso && !NOTA_LEZIONE.test(corso.file))) throw new Error('file non permesso');
  return V.annota(vault(), { ...x, file, corso });
});
ipcMain.handle('vault:scrivi', (_, { file, testo }) => {
  // con i dati bloccati la barra parte vuota: un Orario.md vuoto nel vault condiviso cancellerebbe l'orario a tutti
  if (motore?.bloccato) return false;
  file = V.relativo(file);
  if (!/^(Orario|Lode\/[\w ]+)\.md$/.test(file)) throw new Error('file non permesso');
  // con la sincronizzazione accesa Orario.md rispecchia la vista unita (la barra ha appena salvato: dati:salva arriva prima).
  // Mai un Orario.md vuoto da una barra che non ha ancora ricevuto niente: toglierebbe le lezioni agli altri computer
  if (file === 'Orario.md' && motore) {
    const o = motore.vista().orario || [], S = motore._stato(), conosce = Object.keys(S.r).some(k => k.startsWith('orario/')) || Object.keys(S.x).some(k => k.startsWith('orario/'));
    if (!o.length && (!conosce || !existsSync(V.dentro(vault(), file)))) return false;
    testo = V.testoOrario(o);
  }
  if (file === 'Orario.md') guardiano?.segnaOrario(testo);
  V.scriviSicuro(V.dentro(vault(), file), testo); return true;
});
// le pagine che Lode tiene aggiornate (Home, Esami, Glossario, corsi, navigazione delle lezioni, diari dei progetti): solo dentro i suoi segni
// con i dati bloccati (manca la password) la barra parte vuota: le sue pagine «Ancora nessun esame» non vanno nel vault condiviso
ipcMain.handle('vault:blocco', (_, x) => {
  if (motore?.bloccato) return false;
  x = { ...x, file: V.relativo(x?.file) };
  if (!/^(Home|Esami|Glossario)\.md$|^Corsi\/[^/]+\.md$|^Lezioni\/[^/]+\/[^/]+\.md$|^Progetti\/[^/]+\/[^/]+\.md$/.test(x.file)) throw new Error('file non permesso');
  return V.blocco(vault(), x);
});
ipcMain.handle('vault:note', () => V.note(vault()));
// leggere una nota (per le sbobine) e salvare file nel vault: sbobine, allegati, materiali, sbobine ricevute, file per Anki
ipcMain.handle('vault:leggi', (_, { file }) => { file = V.relativo(file); if (!/\.md$/.test(file)) throw new Error('solo note'); return readFileSync(V.dentro(vault(), file), 'utf8'); });
ipcMain.handle('vault:salvaFile', (_, { file, testo, dati, sostituisci = false }) => {
  file = V.relativo(file);
  if (!/^(Sbobine|Allegati|Materiali|Lezioni|Anki)\//.test(file)) throw new Error('cartella non permessa');
  let p = V.dentro(vault(), file), rel = file;
  if (!sostituisci) for (let k = 2; existsSync(p); k++) { rel = file.replace(/(\.[a-z0-9]+)$/i, ` ${k}$1`); p = V.dentro(vault(), rel); }
  mkdirSync(dirname(p), { recursive: true });
  if (dati) writeFileSync(p, Buffer.from(dati)); else V.scriviSicuro(p, testo);
  return { file: rel, percorso: p };
});
// mostrare un file del vault nella sua cartella (il file per Anki): solo dentro il vault, e nelle prove niente finestre
ipcMain.handle('vault:mostra', (_, { file }) => {
  const p = V.dentro(vault(), V.relativo(file));
  if (!existsSync(p)) throw new Error('il file non c\'è più');
  if (process.env.LODE_NON_APRIRE) return { esito: 'prova', percorso: p };
  shell.showItemInFolder(p); return { esito: 'cartella' };
});
// condividere: il menu Condividi di macOS (AirDrop, Messaggi, Mail, WhatsApp…), altrove la cartella con i file
ipcMain.handle('condividi', (e, { files }) => {
  const percorsi = files.map(f => V.dentro(vault(), V.relativo(f)));
  const w = BrowserWindow.fromWebContents(e.sender);
  if (process.env.LODE_NON_APRIRE) return { esito: 'prova', percorsi };   // prove: niente menu sullo schermo
  if (MAC) { new ShareMenu({ filePaths: percorsi }).popup({ window: w }); return { esito: 'menu' }; }
  shell.showItemInFolder(percorsi[0]); return { esito: 'cartella' };
});
// la zona della pillola (per far arrivare i file trascinati anche quando la barra lascia passare i clic)
let zona = null, forzata = false;
ipcMain.on('finestra:zona', (_, r) => { zona = r; });
setInterval(() => {
  if (!barra || barra.isDestroyed() || !zona || zona.aperto) { forzata = false; return; }
  const c = screen.getCursorScreenPoint(), b = barra.getBounds(), m = 26;
  const dentro = c.x >= b.x + zona.x - m && c.x <= b.x + zona.x + zona.w + m && c.y >= b.y + zona.y - m && c.y <= b.y + zona.y + zona.h + m;
  if (dentro && !forzata) { forzata = true; barra.setIgnoreMouseEvents(false); }
  else if (!dentro && forzata) { forzata = false; barra.setIgnoreMouseEvents(true, { forward: true }); }
}, 80);
/* ---------- installazioni (Obsidian, cervello locale), sempre chieste dallo studente ---------- */
const progresso = (cosa, x) => manda('installa:progresso', { cosa, ...x });
async function stato() {
  const o = V.obsidian(vault()), ol = await I.statoOllama(), m = I.modelloConsigliato();
  // il consigliato se c'è, poi quello scelto prima, poi un Qwen3.5 o un Gemma 3 già installato
  const c = n => n && ol.modelli.some(x => x === n || x === n + ':latest');
  // Ollama occupato (sta caricando un modello) non risponde subito: non vuol dire che il modello non ci sia più
  const scelto = !ol.acceso ? conf.modello || null : c(m.nome) ? m.nome : c(conf.modello) ? conf.modello : ol.modelli.find(x => x.startsWith('qwen3.5')) || ol.modelli.find(x => x.startsWith('gemma3')) || null;
  if (scelto && scelto !== conf.modello) { conf.modello = scelto; salvaConf(); }
  return { obsidian: { installato: I.obsidianInstallato() || o.installato, registrato: !!o.registrato }, ollama: ol, consigliato: m, modello: scelto, piattaforma: process.platform };
}
let inCorso = {};
ipcMain.handle('installa:stato', () => stato());
ipcMain.handle('installa:obsidian', async () => {
  if (inCorso.obsidian) return { esito: 'in_corso' }; inCorso.obsidian = true;
  try {
    if (!I.obsidianInstallato()) await I.installaObsidian({ vault: vault(), confObsidian: V.obsidian(vault()).conf, avanza: x => progresso('obsidian', x) });
    else V.registra(vault());
    const l = V.linkObsidian(vault(), 'Home.md');
    try { await I.apriObsidian(l.url); } catch (x) { console.warn('Lode: Obsidian installato ma non si apre da qui', x); }
    progresso('obsidian', { fase: 'fatto', p: 1, testo: 'Obsidian è pronto sul tuo vault' });
    manda('vault:info', info());
    return { esito: 'ok' };
  } catch (e) { progresso('obsidian', { fase: 'errore', testo: e.message }); return { esito: 'errore', errore: e.message }; }
  finally { inCorso.obsidian = false; }
});
ipcMain.handle('installa:cervello', async () => {
  if (inCorso.cervello) return { esito: 'in_corso' }; inCorso.cervello = true;
  try {
    const m = I.modelloConsigliato();
    if (!(await I.statoOllama()).installato) await I.installaOllama({ avanza: x => progresso('cervello', x) });
    await I.scaricaModello(m.nome, x => progresso('cervello', x));
    conf.modello = m.nome; salvaConf();
    progresso('cervello', { fase: 'fatto', p: 1, testo: `${m.etichetta} è pronto` });
    return { esito: 'ok', modello: m.nome };
  } catch (e) { progresso('cervello', { fase: 'errore', testo: e.message }); return { esito: 'errore', errore: e.message }; }
  finally { inCorso.cervello = false; }
});
// la chat col modello locale passa da qui (niente problemi di origine fra la barra e Ollama)
const chat = new Map();
ipcMain.handle('locale:chat', async (e, { id, messaggi, formato, modello }) => {
  const c = new AbortController(); chat.set(id, c);
  try { return await I.chatLocale({ modello: modello || conf.modello, messaggi, formato, segnale: c.signal, pezzo: t => e.sender.send('locale:pezzo', { id, t }) }); }
  finally { chat.delete(id); }
});
// l'AI dello studente (la sua chiave, il servizio che preferisce): le chiamate passano da qui, niente limiti CORS.
// Formato OpenAI (ChatGPT, Gemini, Mistral, Groq, OpenRouter, DeepSeek). La chiave non viene mai salvata qui.
// La barra manda solo l'id del servizio: la base la sceglie il main dall'elenco di js/fornitori.js (lo stesso della barra),
// così una barra compromessa non può far chiamare al main indirizzi suoi (rete locale, localhost). Nelle prove, solo in
// sviluppo, LODE_AI_BASE sostituisce la base (il server di Ollama in formato OpenAI)
let FORN = null;
async function baseAI(fornitore) {
  FORN ||= await import(pathToFileURL(join(WEB, 'js', 'fornitori.js')).href);
  const b = FORN.baseDi(fornitore);
  if (!b) throw new Error('servizio sconosciuto');
  return (process.env.LODE_AI_BASE || b).replace(/\/$/, '');
}
const chatCloud = new Map();
ipcMain.handle('ai:chat', async (e, { id, fornitore, chiave, corpo }) => {
  const c = new AbortController(); chatCloud.set(id, c);
  try {
    const r = await I.rete(await baseAI(fornitore) + '/chat/completions', { method: 'POST', signal: c.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + chiave, 'X-Title': 'Lode' }, body: JSON.stringify(corpo) });
    if (!r.ok) { const t = await r.text().catch(() => ''); return { errore: t.slice(0, 400) || r.statusText, stato: r.status }; }
    if (!corpo.stream) return { json: await r.json() };
    const lettore = r.body.getReader(), dec = new TextDecoder(); let resto = '', tutto = '';
    for (; ;) {
      const { done, value } = await lettore.read(); if (done) break;
      resto += dec.decode(value, { stream: true }); const righe = resto.split('\n'); resto = righe.pop();
      for (const riga of righe) {
        const d = riga.replace(/^data:\s*/, '').trim(); if (!d || d === '[DONE]' || !riga.startsWith('data:')) continue;
        let x; try { x = JSON.parse(d); } catch { continue; }
        const t = x.choices?.[0]?.delta?.content || ''; if (t) { tutto += t; e.sender.send('ai:pezzo', { id, t }); }
      }
    }
    return { testo: tutto };
  } catch (err) { return { errore: c.signal.aborted ? 'interrotta' : err.message, stato: 0 }; }
  finally { chatCloud.delete(id); }
});
ipcMain.handle('ai:stop', (_, { id }) => { chatCloud.get(id)?.abort(); return true; });
ipcMain.handle('ai:modelli', async (_, { fornitore, chiave }) => {
  const r = await I.rete(await baseAI(fornitore) + '/models', { headers: { authorization: 'Bearer ' + chiave } });
  if (!r.ok) return { errore: (await r.text().catch(() => '')).slice(0, 300) || r.statusText, stato: r.status };
  const j = await r.json(); return { modelli: (j.data || j.models || []).map(m => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean) };
});
ipcMain.handle('locale:scalda', async () => { if (conf.modello) await fetch(I.OLLAMA + '/api/generate', { method: 'POST', body: JSON.stringify({ model: conf.modello, keep_alive: I.CALDO }) }).catch(() => { }); return true; });
ipcMain.handle('locale:stop', (_, { id }) => { chat.get(id)?.abort(); return true; });
ipcMain.handle('vault:memoria', (_, { testo }) => { if (motore?.bloccato) return false; V.memoria(vault(), testo); return true; });
ipcMain.handle('vault:apri', async (_, { file, nuovo }) => {
  file = V.relativo(file);
  if (!/\.md$/i.test(file)) throw new Error('solo note');   // la barra apre solo note: niente altri file con l'app predefinita
  const p = V.dentro(vault(), file);
  if (!existsSync(p) && nuovo) V.scriviSicuro(p, nuovo);
  const l = V.linkObsidian(vault(), file);
  if (process.env.LODE_NON_APRIRE) return { esito: 'ok', percorso: vault(), prova: true };   // prove: niente finestre sullo schermo
  if (l.url) await I.apriObsidian(l.url); else await shell.openPath(p);
  return { esito: l.esito, percorso: vault() };
});
ipcMain.handle('vault:scegli', () => scegliVault());
/* ---------- informatica ---------- */
// «spiegami l'errore» senza testo: quello che lo studente ha copiato dal terminale. Letto una volta, mai salvato,
// restituito solo se errori.js ci trova almeno un errore (altrimenti negli appunti c'è altro: non lo si passa alla barra)
let ER = null, progetti = null, aggiorna = null;
ipcMain.handle('appunti:errore', () => {
  const tutto = clipboard.readText();
  if (!ER || !tutto || tutto.length > 200000) return { vuoto: true };
  const testo = tutto.slice(0, 20000);   // l'inizio basta: il primo errore è lì, e analizza() resta veloce
  return ER.analizza(testo).length ? { testo } : { vuoto: true };
});
app.on('will-quit', () => progetti?.chiudi());
ipcMain.handle('sistema:inattivo', () => powerMonitor.getSystemIdleTime());
// La voce: tre motori, li sceglie il main (VOCE_ONNX.scegliMotore) e la barra chiede solo voce:stato.
// • Mac con chip Apple e lode-voce: Parakeet v3 sul Neural Engine (voce.mjs), come prima.
// • Altrove, se c'è l'addon di sherpa-onnx per questo sistema e almeno ~6 GB di memoria: Parakeet v3 ONNX sul processore,
//   in un utilityProcess (voce-onnx.mjs), con il modello in userData/voce-onnx.
// • Altrimenti Whisper, dentro la barra (js/voce.js). Ci si torna anche se Parakeet ONNX non parte (addon, crash, modello
//   rovinato, spazio): il main risponde { errore, ripiego: true } e la barra ritrascrive lo stesso audio con Whisper.
//   Un addon che non si carica resta segnato in config.json fino alla versione dopo di Lode: niente tentativi a ogni avvio.
const progressoVoce = x => { for (const w of BrowserWindow.getAllWindows()) w.webContents.send('voce:progresso', x); };
const voce = VOCE.crea({ binario: [join(process.resourcesPath || '', 'bin', 'lode-voce'), join(QUI, 'bin', 'lode-voce')].find(existsSync) || join(QUI, 'bin', 'lode-voce'),   // nel pacchetto: Resources/bin
  avanza: progressoVoce });
// nelle prove (solo in sviluppo): LODE_VOCE sceglie il motore (mac, onnx, whisper), LODE_MODELLO_ONNX la cartella del modello
const voceOnnx = VOCE_ONNX.crea({ cartella: process.env.LODE_MODELLO_ONNX || join(app.getPath('userData'), 'voce-onnx'), avvia: VOCE_ONNX.processoElectron(utilityProcess), rete: I.rete, avanza: p => progressoVoce({ p }) });
let onnxGuasta = null, motoreVoce = ['mac', 'onnx', 'whisper'].includes(process.env.LODE_VOCE) ? process.env.LODE_VOCE : null;
const sceltaVoce = () => motoreVoce ??= VOCE_ONNX.scegliMotore({ piattaforma: process.platform, arch: process.arch, lodeVoce: voce.disponibile(), sherpa: VOCE_ONNX.sherpaPresente(), memoria: totalmem(),
  guasta: onnxGuasta || (conf.voceOnnx?.versione === app.getVersion() ? conf.voceOnnx.guasta : null) });
async function suOnnx(fai) {
  try { return await fai(); }
  catch (e) {
    // «chiusa» dopo un guasto: un'altra richiesta in attesa quando il motore è stato chiuso per passare a Whisper
    const ripiego = VOCE_ONNX.RIPIEGO.includes(e.codice) || (e.codice === 'chiusa' && !!onnxGuasta);
    if (ripiego) {
      onnxGuasta = e.codice; motoreVoce = null; voceOnnx.chiudi(); console.warn('Lode: Parakeet ONNX non va, passo a Whisper:', e.message, e.dettaglio || '');
      if (e.codice === 'addon') { conf.voceOnnx = { guasta: 'addon', versione: app.getVersion() }; salvaConf(); }
    } else if (e.dettaglio) console.warn('Lode: voce Parakeet ONNX:', e.message, e.dettaglio);
    return { errore: e.message, ripiego };   // alla barra solo la frase in italiano: il dettaglio tecnico resta qui
  }
}
const nonNelMain = { errore: 'la voce è Whisper, nella barra', ripiego: true };
ipcMain.handle('voce:stato', () => { const m = sceltaVoce(); return { parakeet: m === 'mac', motore: m, peso: m === 'onnx' ? VOCE_ONNX.PESO_MB : null }; });
ipcMain.handle('voce:prepara', () => { const m = sceltaVoce(); return m === 'onnx' ? suOnnx(() => voceOnnx.avvia()) : m === 'mac' ? voce.avvia() : nonNelMain; });
ipcMain.handle('voce:trascrivi', (_, audio) => { const m = sceltaVoce(); return m === 'onnx' ? suOnnx(() => voceOnnx.trascrivi(audio)) : m === 'mac' ? voce.trascrivi(audio) : nonNelMain; });
// a riposo (js/voce.js): il processo esce, torna alla prima frase. Il timer del riposo gira in ogni finestra: Parakeet
// ONNX che sta partendo o trascrivendo per un'altra finestra resta acceso (ci penserà il timer di quella)
ipcMain.handle('voce:riposa', () => { voce.chiudi(); if (!voceOnnx.occupato()) voceOnnx.chiudi(); return true; });
app.on('will-quit', () => { voce.chiudi(); voceOnnx.chiudi(); });
// dopo una cattura veloce il fuoco torna all'app dove lo studente stava scrivendo
function rilascia() {
  if (!barra || barra.isDestroyed()) return;
  if (MAC) { if (!quadro || !quadro.isVisible()) { app.hide(); setTimeout(() => barra?.showInactive(), 60); } else barra.blur(); }
  // Windows: blur() darebbe il fuoco alla barra delle applicazioni; nascosta un attimo, Windows lo ridà alla finestra di prima
  else if (WIN) { barra.hide(); setTimeout(() => { if (barra && !barra.isDestroyed()) barra.showInactive(); }, 60); }
  else barra.blur();
}
ipcMain.handle('finestra:rilascia', e => { if (BrowserWindow.fromWebContents(e.sender) === barra) rilascia(); });

/* ---------- scorciatoie e icona ---------- */
const TASTI = MAC
  ? { apri: 'Alt+Space', scrivi: 'Control+Alt+Space', stella: 'Control+Alt+S', definizione: 'Control+Alt+D', domanda: 'Control+Alt+Q', gioco: 'Control+Alt+G', trascrivi: 'Control+Alt+R', ripeti: 'Control+Alt+P' }
  : { apri: 'Control+Shift+Space', scrivi: 'Control+Alt+Space', stella: 'Control+Alt+S', definizione: 'Control+Alt+D', domanda: 'Control+Alt+Q', gioco: 'Control+Alt+G', trascrivi: 'Control+Alt+R', ripeti: 'Control+Alt+P' };
// Windows: AltGr è Ctrl+Alt, e con tastiere come la tedesca (AltGr+Q = @) o la polacca Ctrl+Alt+lettera ruberebbe caratteri
// in tutte le app. Le lettere si registrano solo se le tastiere installate sono italiana, inglese US o UK (nel dubbio, come prima)
const tastiereSenzaAltGr = () => new Promise(fine => execFile('reg', ['query', 'HKCU\\Keyboard Layout', '/s'], { windowsHide: true, timeout: 4000 }, (err, out) =>
  fine(!!err || (String(out).match(/\b[0-9a-f]{8}\b/gi) || []).every(x => ['00000410', '00000409', '00000809'].includes(x.toLowerCase())))));
const attive = {};   // nome → tasti: solo le scorciatoie registrate davvero
ipcMain.handle('scorciatoie:stato', () => attive);
let ultimoApri = 0;
async function scorciatoie() {
  const lettere = !WIN || await tastiereSenzaAltGr();
  for (const [nome, tasti] of Object.entries(TASTI)) {
    if (!lettere && /\+[A-Z]$/.test(tasti)) continue;
    const ok = globalShortcut.register(tasti, () => {
      // tenuto premuto, Windows ripete la scorciatoia: quelle subito dopo non contano (le altre le scarta la barra)
      if (WIN && nome === 'apri') { const t = Date.now(); if (t - ultimoApri < 600) return; ultimoApri = t; }
      posiziona(); barra.show(); barra.focus(); if (MAC) app.focus({ steal: true });
      barra.setIgnoreMouseEvents(false);
      barra.webContents.send('scorciatoia', nome);
    });
    if (ok) attive[nome] = tasti; else console.warn(`Lode: ${tasti} è già usata da un'altra app`);
  }
}
// l'icona del Mac è nera (template): sulla barra scura di Windows sparirebbe. Lì, se serve, la stessa forma in bianco
function iconaTray() {
  const img = nativeImage.createFromPath(join(QUI, 'build', 'trayTemplate.png'));
  if (MAC) { img.setTemplateImage(true); return img; }
  if (!WIN || !nativeTheme.shouldUseDarkColorsForSystemIntegratedUI) return img;
  const bianca = nativeImage.createEmpty();
  for (const scaleFactor of img.getScaleFactors()) {
    const b = img.toBitmap({ scaleFactor }), lato = Math.round(Math.sqrt(b.length / 4));
    for (let i = 0; i < b.length; i += 4) b[i] = b[i + 1] = b[i + 2] = b[i + 3];   // nero → bianco (alfa premoltiplicato)
    bianca.addRepresentation({ scaleFactor, width: lato, height: lato, buffer: b });
  }
  return bianca.isEmpty() ? img : bianca;
}
// nel menu dell'icona: accendere o spegnere gli aggiornamenti e, quando c'è, la versione nuova (come la riga in «Oggi»)
function voceAggiorna() {
  const s = aggiorna?.stato(); if (!s?.possibile) return [];
  const v = [{ label: s.modo === 'manuale' ? 'Avvisami delle versioni nuove' : 'Aggiornamenti automatici', type: 'checkbox', checked: s.attivi, click: i => aggiorna.impostaAttivi(i.checked) }];
  if (!s.attivi) return v;
  if (s.fase === 'pronta') v.unshift({ label: `Riavvia con Lode ${s.nuova.versione}`, click: () => aggiorna.riavvia() });
  if (s.fase === 'da_scaricare') v.unshift({ label: `Scarica Lode ${s.nuova.versione}…`, click: () => aggiorna.scarica() });
  return v;
}
function creaTray() {
  tray = new Tray(iconaTray()); tray.setToolTip('Lode');
  if (WIN) nativeTheme.on('updated', () => tray?.setImage(iconaTray()));   // barra delle applicazioni chiara o scura
  const menu = () => Menu.buildFromTemplate([
    { label: `Apri Lode (${MAC ? '⌥ Spazio' : 'Ctrl+Shift+Spazio'})`, click: () => { barra.show(); barra.focus(); barra.setIgnoreMouseEvents(false); barra.webContents.send('scorciatoia', 'apri'); } },
    { label: 'Il quadro: libretto, esami, ripasso', click: apriQuadro },
    { label: 'Rifai la configurazione…', click: apriBenvenuto },
    { type: 'separator' },
    { label: 'Apri il vault in Obsidian', click: async () => { const l = V.linkObsidian(vault(), 'Home.md'); if (l.url) I.apriObsidian(l.url); else shell.openPath(vault()); } },
    { label: 'Mostra il vault nella cartella', click: () => shell.openPath(vault()) },
    { label: 'Usa un altro vault…', click: scegliVault },
    { type: 'separator' },
    { label: 'Avvia Lode all\'accensione', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, enabled: app.isPackaged, click: i => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    ...voceAggiorna(),
    { label: 'Esci da Lode', role: 'quit' },
  ]);
  tray.on('click', () => tray.popUpContextMenu(menu())); tray.on('right-click', () => tray.popUpContextMenu(menu()));
}

app.whenReady().then(async () => {
  if (MAC) app.dock?.hide();
  else Menu.setApplicationMenu(null);   // Windows e Linux: niente menu inglese nelle finestre, né Ctrl+R, Ctrl+W, Ctrl+Shift+I
  leggiConf();
  if (process.env.LODE_VAULT) conf.vault = process.env.LODE_VAULT;
  if (!conf.vault) {
    let documenti; try { documenti = app.getPath('documents'); } catch { documenti = app.getPath('home'); }   // Documenti su OneDrive o in rete non raggiungibile
    conf.vault = join(documenti, 'Lode'); conf.primoAvvio = Date.now(); salvaConf(); if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
  }
  // in sviluppo (npm start, le prove) le librerie della barra si copiano da desktop/node_modules in vendor/ accanto a
  // index.html, se mancano o se package.json ha cambiato versione (desktop/vendor.mjs); nel pacchetto sono già in web/vendor
  if (!app.isPackaged && WEB !== join(QUI, 'web')) try { if ((await import('./vendor.mjs')).vendorAggiornato(join(WEB, 'vendor'))) console.log('Lode: librerie della barra copiate in vendor/'); }
  catch (x) { console.error('Lode: librerie della barra non copiate (PDF, formule e voce Whisper non funzioneranno):', x.message); }
  await V.carica(WEB);
  // uno spostamento del vault nella cartella cloud interrotto a metà (corrente, crash): si finisce o si torna indietro
  try { const r = SY.riprendiSpostamento({ locale: LOCALE(), vaultAttuale: conf.vault, passa: passaA }); if (r.esito !== 'niente') console.log('Lode: spostamento del vault ripreso:', r.esito, r.esito === 'annullato' ? '(il vault resta dov\'era)' : ''); }
  catch (x) { console.error('Lode: spostamento non ripreso', x); }
  try { ER = await import(pathToFileURL(join(WEB, 'js', 'errori.js')).href); } catch (x) { console.error('Lode: errori.js non si carica', x); }
  await apriVault();   // se la cartella è bloccata lo dice, e Lode parte comunque
  // «Segui il progetto»: gli handler progetto:* e i progetti già seguiti. Ogni comando passa dalla finestra di conferma del sistema
  // (progetto.mjs); conf.progetti sta in userData/config.json, mai nel vault. conf come funzione: leggiConf() la riassegna
  try { progetti = PROGETTO.registra({ ipcMain, dialog, app, conf: () => conf, salvaConf, manda }); } catch (x) { console.error('Lode: progetti non avviati', x); }
  // le versioni nuove (aggiorna.mjs): solo nell'app impacchettata e mai nelle prove. Prima di «Riavvia ora» i dati in sospeso
  // vanno sul disco e la barra smette di rifiutare la chiusura (uscendo), se no l'installazione resterebbe ferma. Se poi
  // l'installazione non parte e Lode resta aperta (annullaUscita), si torna come prima: Alt+F4 richiude la pillola e basta,
  // e se la barra era già stata chiusa si riapre
  try {
    aggiorna = AGGIORNA.registra({ ipcMain, app, net, shell, conf: () => conf, salvaConf, manda,
      primaDiUscire: () => { uscendo = true; scriviTutto(); }, annullaUscita: () => { uscendo = false; if (!barra) creaBarra(); } });
  } catch (x) { console.error('Lode: aggiornamenti non avviati', x); }
  creaBarra(); creaTray(); scorciatoie();
  if (!conf.benvenuto && !process.env.LODE_PROVA) apriBenvenuto();
  screen.on('display-metrics-changed', posiziona); screen.on('display-added', posiziona); screen.on('display-removed', posiziona);
  if (process.env.LODE_QUADRO) apriQuadro();
  // prove automatiche: esegue uno script nella barra e ne salva una foto (LODE_PROVA=script.js, LODE_FOTO=cartella)
  if (process.env.LODE_PROVA) barra.webContents.once('did-finish-load', async () => {
    const { writeFileSync: scrivi } = await import('node:fs');
    const passi = JSON.parse(readFileSync(process.env.LODE_PROVA, 'utf8'));
    // se la barra cambia pagina mentre un passo aspetta (una navigazione che restaLode non ha fermato), executeJavaScript
    // non risponde più: il passo finisce con un errore invece di bloccare tutte le prove fino al cane da guardia
    const VIA = Symbol('via');
    for (const [i, p] of passi.entries()) {
      await new Promise(r => setTimeout(r, p.attesa ?? 1200));
      let via; const cambiata = new Promise(ok => { via = () => ok(VIA); barra.webContents.once('did-navigate', via); });
      try { const r = await Promise.race([barra.webContents.executeJavaScript(p.js || 'null'), cambiata]); if (r === VIA) console.log(`passo ${i} errore: la barra è andata su un'altra pagina (${barra.webContents.getURL().split('/').pop()})`); else if (r != null) console.log(`passo ${i}:`, JSON.stringify(r)); } catch (e) { console.log(`passo ${i} errore:`, e.message); }
      finally { barra.webContents.off('did-navigate', via); }
      if (p.foto) { await new Promise(r => setTimeout(r, 900)); scrivi(join(process.env.LODE_FOTO, p.foto), (await barra.webContents.capturePage()).toPNG()); }
    }
    if (process.env.LODE_ESCI) app.quit();
  });
});
app.on('second-instance', () => { barra?.show(); barra?.webContents.send('scorciatoia', 'apri'); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); guardiano?.chiudi(); aggiorna?.ferma(); });
app.on('window-all-closed', e => e.preventDefault?.());
