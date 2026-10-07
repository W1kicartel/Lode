// Lode, l'app desktop. Una finestra trasparente in cima allo schermo, sopra tutte le altre: dentro c'è solo la barra.
// I clic passano attraverso tranne che sulla barra. Scorciatoie globali per la cattura in aula. Il vault Obsidian in
// Documenti/Lode è la memoria: dati di Lode in .lode/dati.json, lezioni in Markdown. Icona nella barra dei menu.
import { app, BrowserWindow, Menu, desktopCapturer, ShareMenu, Tray, clipboard, dialog, globalShortcut, ipcMain, nativeImage, nativeTheme, net, powerMonitor, safeStorage, screen, shell, utilityProcess } from 'electron';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync, renameSync, copyFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as V from './vault.mjs';
import * as I from './installa.mjs';
import * as VOCE from './voce.mjs';
import * as VOCE_ONNX from './voce-onnx.mjs';
import * as ASCOLTA from './ascolta.mjs';
import * as PROGETTO from './progetto.mjs';
import * as AGGIORNA from './aggiorna.mjs';
import { creaSincronizzazione } from './sincronizza.mjs';
import * as ICONA from './collegamento.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const WEB = existsSync(join(QUI, 'web', 'index.html')) ? join(QUI, 'web') : join(QUI, '..');
const MAC = process.platform === 'darwin', WIN = process.platform === 'win32';
// installata dal codice (npm start), fuori dalle prove: l'icona per riaprirla e l'avvio all'accensione (collegamento.mjs)
// (non per chi sviluppa con vault e dati di prova: LODE_DATI, LODE_VAULT)
const DAL_CODICE = !app.isPackaged && !process.env.LODE_PROVA && !process.env.LODE_CI && !process.env.LODE_DATI && !process.env.LODE_VAULT;
const datiIcona = () => ({ piattaforma: process.platform, home: app.getPath('home'), appData: app.getPath('appData'), scrivania: app.getPath('desktop'),
  eseguibile: process.execPath, cartella: app.getAppPath(), argomenti: app.commandLine.hasSwitch('no-sandbox') ? ['--no-sandbox'] : [], versione: app.getVersion() });
function provaIcona(f, { zitto = false } = {}) {
  try { return f(); } catch (e) { console.warn('Lode: icona o avvio all\'accensione non riusciti:', e.message); if (!zitto) dialog.showMessageBox({ type: 'warning', title: 'Lode', message: 'Non ci sono riuscito.', detail: e.message, noLink: true }); return false; }
}
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
  barra.webContents.session.setPermissionRequestHandler((_, p, cb) => cb(['media', 'display-capture', 'notifications', 'clipboard-sanitized-write'].includes(p)));
  // «Lezione dal computer» (js/computer.js): la barra chiede l'audio che esce dal computer. Si concede l'audio del sistema
  // (loopback: WASAPI su Windows, CoreAudio tap sul Mac da 14.2 con NSAudioCaptureUsageDescription, il monitor su Linux);
  // lo schermo serve solo all'API e la barra ferma subito il video. Solo la barra lo chiede, e solo quando lo studente lo avvia
  barra.webContents.session.setDisplayMediaRequestHandler((req, cb) => {
    desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
      .then(s => s[0] ? cb({ video: s[0], audio: 'loopback' }) : cb({}))
      .catch(e => { console.warn('Lode: audio del computer non concesso', e); cb({}); });
  });
  // Alt+F4 (o Ctrl+W) non la distrugge: si richiude e basta. Se ne va solo uscendo da Lode
  barra.on('close', e => { if (!uscendo) { e.preventDefault(); rilascia(); } });
  const idBarra = barra.webContents.id;   // preso prima: dopo 'closed' webContents non c'è più
  barra.on('closed', () => { barra = null; sync.dimenticaFinestra(idBarra); if (!uscendo) creaBarra(); });
  // Windows si spegne o esce l'utente: before-quit non arriva. I salvataggi che il diario non ha ancora preso (tenuti durante
  // un'accensione, in fila dietro un lavoro lungo) vanno subito, in modo sincrono, in un file di recupero; poi l'ultima
  // pubblicazione se Windows ce ne lascia il tempo (prima sync.chiudi() qui non si chiamava affatto, giro 3)
  barra.on('session-end', () => { uscendo = true; scriviTutto(); sync.salvaPendenti(); sync.chiudi().catch(() => { }); });
}
function apriQuadro() {
  if (quadro && !quadro.isDestroyed()) { quadro.show(); quadro.focus(); return; }
  quadro = new BrowserWindow({ width: 1120, height: 820, minWidth: 380, minHeight: 500, title: 'Lode', backgroundColor: '#0A0A0A', titleBarStyle: MAC ? 'hiddenInset' : 'default',
    webPreferences: { preload: join(QUI, 'preload.cjs'), contextIsolation: true, sandbox: true } });
  quadro.loadFile(join(WEB, 'index.html'), { query: { quadro: '1' } });
  quadro.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  restaLode(quadro);
  if (MAC) app.dock?.show();
  // le BASE della finestra chiusa (fino a 6, MB con anni di dati) si buttano: ogni quadro nuovo ha un webContents.id nuovo
  const idQuadro = quadro.webContents.id;
  quadro.on('closed', () => { quadro = null; sync.dimenticaFinestra(idQuadro); if (MAC) app.dock?.hide(); });
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
  const idBenvenuto = benvenuto.webContents.id;
  benvenuto.on('closed', () => { benvenuto = null; sync.dimenticaFinestra(idBenvenuto); if (MAC && !quadro) app.dock?.hide(); });
}
const tutte = () => [barra, quadro, benvenuto].filter(w => w && !w.isDestroyed());
const manda = (canale, x, tranne) => tutte().forEach(w => { if (w.webContents !== tranne) w.webContents.send(canale, x); });

/* ---------- vault ---------- */
function info() { const o = V.obsidian(vault()); return { percorso: vault(), nome: vault().split(/[\\/]/).pop(), obsidian: { installato: o.installato, registrato: !!o.registrato }, note: V.notePerLode(vault()) }; }
// con la sincronizzazione Orario.md lo legge e lo scrive il motore (docs/SINCRONIZZAZIONE.md §9): il watcher gli fa fare un giro
function avviaVault() {
  guardiano?.chiudi(); guardiano = null;
  let orario = [];
  try { orario = JSON.parse(readFileSync(fileDati(), 'utf8')).orario || []; } catch { }
  const conSync = sync.acceso();
  V.crea(vault(), conSync ? null : orario);
  V.registra(vault());
  guardiano = V.guarda(vault(), {
    lezioniCambiate: () => manda('vault:lezioni', V.lezioni(vault())),
    orarioCambiato: o => { if (!sync.acceso()) manda('vault:orario', o); },
    noteCambiate: () => manda('vault:info', info()),
    syncCambiato: conSync ? () => sync.cambiato() : null,
  });
  try { guardiano.segnaOrario(readFileSync(join(vault(), 'Orario.md'), 'utf8')); } catch { }
}
// il vault cambiato da fuori (spostamento nella cartella cloud, «Uso già Lode su un altro computer», «Smetti su questo computer»)
async function impostaVault(p, { ricarica = true } = {}) {
  scriviTutto(); conf.vault = p; salvaConf();
  await apriVault();
  if (ricarica) tutte().forEach(w => w.webContents.reload());
  else { manda('vault:info', info()); manda('vault:lezioni', V.lezioni(vault())); }   // la scheda che aspetta l'esito resta aperta
}
async function scegliVault() {
  // dopo «Smetti» (sincronizzazione senza cartella cloud) il diario è legato al vault: le note si copiano nella cartella scelta e lì
  // nasce un gruppo locale (sincronizza.mjs, cambiaVaultLocale). Prima qui si rimandava a «Smetti», che rispondeva «non è accesa»
  if (sync.acceso() && !conf.sync?.cloud) {
    const r = await dialog.showOpenDialog({ title: 'Dove tenere il vault', buttonLabel: 'Usa questa cartella', properties: ['openDirectory', 'createDirectory'], defaultPath: vault() });
    if (r.canceled || !r.filePaths[0]) return null;
    const x = await sync.cambiaVaultLocale(r.filePaths[0]);
    if (x.esito !== 'ok') { if (!process.env.LODE_PROVA) dialog.showMessageBox({ type: 'warning', title: 'Lode', message: x.errore || 'Non è andata.', noLink: true }); return null; }
    tutte().forEach(w => w.webContents.reload());
    return info();
  }
  // con la sincronizzazione nel cloud il vault è legato al diario (il gruppo): si cambia con «Smetti su questo computer» o «Uso già Lode»
  if (sync.acceso()) { if (!process.env.LODE_PROVA) dialog.showMessageBox({ type: 'info', title: 'Lode', message: 'Con la sincronizzazione il vault si cambia da «Sincronizza fra i tuoi computer»', detail: '«Smetti su questo computer» porta il vault fuori dalla cartella cloud.', noLink: true }); return null; }
  const r = await dialog.showOpenDialog({ title: 'Scegli il vault Obsidian', buttonLabel: 'Usa questo vault', properties: ['openDirectory', 'createDirectory'], defaultPath: vault() });
  if (r.canceled || !r.filePaths[0]) return null;
  scriviTutto();   // i dati in sospeso vanno nel vault di prima
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
function leggiDati() {
  const f = fileDati();
  for (let i = 1; ; i++) {
    let testo;
    try { testo = readFileSync(f, 'utf8'); } catch (x) { if (x.code === 'ENOENT') return null; if (i >= 3) throw x; pausa(250); continue; }
    try { return JSON.parse(testo.replace(/^\uFEFF/, '')); } catch { }
    // rovinato (es. corrente saltata mentre scriveva): resta da parte e si riparte dalla copia di prima
    renameSync(f, accanto(`dati.illeggibile-${Date.now()}.json`));
    try { const d = JSON.parse(readFileSync(accanto('dati.prev.json'), 'utf8')); try { copyFileSync(accanto('dati.prev.json'), f); } catch { } return d; } catch { return null; }
  }
}
// si scrive dopo 250 ms; se Windows tiene il file bloccato (EPERM, EBUSY) si riprova più tardi, senza perdere niente
const inSospeso = new Map();   // percorso → { d, t, n }
const recuperoRuotato = new Set();
function scriviDopo(f, d) { clearTimeout(inSospeso.get(f)?.t); inSospeso.set(f, { d, n: 0, t: setTimeout(() => scrivi(f), 250) }); }
function scrivi(f) {
  const x = inSospeso.get(f); if (!x) return; clearTimeout(x.t);
  try {
    if (/[\\/]dati\.json$/.test(f)) try { copyFileSync(f, f.replace(/json$/, 'prev.json')); } catch { }   // la versione di prima, per ogni evenienza
    else if (!recuperoRuotato.has(f)) { if (existsSync(f)) renameSync(f, f.replace(/json$/, `${Date.now()}.json`)); recuperoRuotato.add(f); }   // il recupero di un'altra volta resta
    V.scriviSicuro(f, JSON.stringify(x.d, null, 1)); inSospeso.delete(f);
  } catch (e) { console.error(e); if (x.n < 10) x.t = setTimeout(() => scrivi(f), Math.min(30e3, 1000 * 2 ** x.n++)); }   // poi riprova al prossimo salvataggio o all'uscita
}
const scriviTutto = () => [...inSospeso.keys()].forEach(scrivi);   // all'uscita, quando Windows si spegne, prima di cambiare vault
// la sincronizzazione (desktop/sincronizza.mjs): spenta finché lo studente non la accende, e allora i dati passano dal diario
const sync = creaSincronizzazione({ app, safeStorage, dialog, powerMonitor, conf: () => conf, salvaConf, vault, impostaVault: (p, o) => impostaVault(p, o), manda, tutte: () => tutte(), scriviTutto: () => scriviTutto(),
  scriviDati: d => scriviDopo(fileDati(), d) });   // i salvataggi tenuti durante un'accensione che non è riuscita: a dati.json come prima
sync.registra(ipcMain);
let syncChiusa = false;
app.on('before-quit', e => {
  uscendo = true; scriviTutto();
  // l'ultima pubblicazione prima di uscire (al massimo 5 s), poi si esce davvero. Anche durante un'accensione (accendendo: conf.sync
  // non c'è ancora): chiudi() la aspetta, e quello che il diario non ha preso finisce in un file di recupero (prima si usciva
  // subito e i salvataggi tenuti sparivano, giro 3)
  if ((sync.acceso() || sync.accendendo()) && !syncChiusa) { e.preventDefault(); syncChiusa = true; sync.chiudi().finally(() => app.quit()); }
});
app.whenReady().then(() => { powerMonitor.on('resume', riprovaLettura); powerMonitor.on('unlock-screen', riprovaLettura); });

/* ---------- canali con la barra ---------- */
const nonLetti = new Set();   // finestre partite senza i dati veri (lettura fallita)
// appena dati.json torna leggibile (OneDrive di nuovo in linea, file sbloccato) le finestre ricevono i dati veri;
// le modifiche fatte nel frattempo restano in dati.recupero.json
let tRilettura = 0;
function riprovaLettura() {
  clearTimeout(tRilettura); if (!nonLetti.size) return;
  try {
    const d = leggiDati(); if (!d || d.lode2) throw new Error(d ? 'altrove' : 'vuoto');   // il minimo di Lode 2 non è un dato da mostrare
    for (const w of tutte()) if (nonLetti.has(w.webContents.id)) { nonLetti.delete(w.webContents.id); w.webContents.send('dati:cambiati', d); }
    console.log('Lode: dati di nuovo leggibili');
  } catch { tRilettura = setTimeout(riprovaLettura, 30e3); }
}
ipcMain.on('dati:leggi', (e, vuoto) => {
  if (sync.acceso()) { e.returnValue = sync.leggi(e.sender.id, vuoto); return; }   // la vista del diario, con la sua versione
  scrivi(fileDati());   // prima quello che aspetta di essere scritto (una finestra che si ricarica rilegge i dati giusti)
  // un dati.json col segno lode2 con la sincronizzazione spenta su questo computer: i dati di questo vault stanno nel diario di
  // Lode 2 di un altro computer. La barra lo mostra in sola lettura (i salvataggi vanno in dati.recupero.json, come quando il
  // file non si legge) e propone «Uso già Lode su un altro computer». Prima la barra lo prendeva per buono e ci scriveva sopra
  // i dati dello studente, che poi sparivano al collegamento (giro 3)
  try { const d = leggiDati(); if (d?.lode2) { nonLetti.add(e.sender.id); e.returnValue = { ...d, __errore: 'altrove' }; return; } }
  catch { }
  try { e.returnValue = leggiDati(); nonLetti.delete(e.sender.id); }
  catch (x) { console.error('Lode: non riesco a leggere i dati', x); nonLetti.add(e.sender.id); e.returnValue = { __errore: x.code || 'lettura' }; tRilettura = setTimeout(riprovaLettura, 15e3); }   // js/dati.js parte vuoto e lo dice
});
ipcMain.on('dati:salva', (e, d, x) => {
  // durante l'accensione (migrazione, scrypt, 30 s di attesa) conf.sync non c'è ancora: il salvataggio non va a dati.json (la
  // migrazione l'ha già letto, e con il vault nel cloud tornerebbe in chiaro), lo tiene la sincronizzazione finché conf.sync c'è
  if (sync.accendendo()) return void sync.tieni(e.sender.id, d, x);
  if (sync.acceso()) return void sync.salva(e.sender.id, d, x);   // differenze dalla BASE di quella finestra → eventi nel diario
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
  file = V.relativo(file);
  if (!/^(Orario|Lode\/[\w ]+)\.md$/.test(file)) throw new Error('file non permesso');
  if (file === 'Orario.md' && sync.acceso()) return true;   // con la sincronizzazione Orario.md lo scrive il motore, col marcatore
  if (file === 'Orario.md') guardiano?.segnaOrario(testo);
  V.scriviSicuro(V.dentro(vault(), file), testo); return true;
});
// le pagine che Lode tiene aggiornate (Home, Esami, Glossario, corsi, navigazione delle lezioni, diari dei progetti): solo dentro i suoi segni
ipcMain.handle('vault:blocco', (_, x) => {
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
ipcMain.handle('vault:memoria', (_, { testo }) => { V.memoria(vault(), testo); return true; });
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
// «Lezione dal computer» sul Mac: l'audio del sistema da lode-ascolta (desktop/ascolta.mjs), solo alla barra
const ascolta = ASCOLTA.crea({ binario: [join(process.resourcesPath || '', 'bin', 'lode-ascolta'), join(QUI, 'bin', 'lode-ascolta')].find(existsSync) || join(QUI, 'bin', 'lode-ascolta'), sorgenti: join(QUI, 'ascolta-mac'),
  manda: (canale, x) => { if (barra && !barra.isDestroyed()) barra.webContents.send(canale, x); } });
ipcMain.handle('computer:disponibile', () => ascolta.disponibile());
ipcMain.handle('computer:avvia', () => ascolta.avvia().catch(e => ({ ok: false, motivo: e.message })));
ipcMain.handle('computer:ferma', () => ascolta.ferma());
app.on('will-quit', () => ascolta.ferma());
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
    DAL_CODICE
      ? { label: 'Avvia Lode all\'accensione', type: 'checkbox', checked: !!provaIcona(() => ICONA.avvioAttivo(datiIcona(), app), { zitto: true }), click: i => provaIcona(() => ICONA.avvio(datiIcona(), i.checked, app, shell)) }
      : { label: 'Avvia Lode all\'accensione', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, enabled: app.isPackaged, click: i => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    ...(DAL_CODICE ? [{ label: MAC ? 'Icona di Lode in Applicazioni' : WIN ? 'Icona di Lode nel menu Start e sul desktop' : 'Icona di Lode nel menu delle applicazioni', type: 'checkbox',
      checked: !!provaIcona(() => ICONA.haIcona(datiIcona(), shell), { zitto: true }), click: i => provaIcona(() => i.checked ? ICONA.creaIcona(datiIcona(), shell) : ICONA.togliIcona(datiIcona(), shell)) }] : []),
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
    // dal codice, come l'installer: l'icona per riaprirla senza terminale e l'avvio all'accensione
    else if (DAL_CODICE) provaIcona(() => { const d = datiIcona(); ICONA.creaIcona(d, shell); ICONA.avvio(d, true, app, shell); }, { zitto: true });
  }
  // la cartella di Lode è stata spostata (o è un'altra copia): le icone di Lode che ci sono tornano a puntare qui
  else if (DAL_CODICE) provaIcona(() => ICONA.aggiornaIcona(datiIcona(), shell), { zitto: true });
  // in sviluppo (npm start, le prove) le librerie della barra si copiano da desktop/node_modules in vendor/ accanto a
  // index.html, se mancano o se package.json ha cambiato versione (desktop/vendor.mjs); nel pacchetto sono già in web/vendor
  if (!app.isPackaged && WEB !== join(QUI, 'web')) try { if ((await import('./vendor.mjs')).vendorAggiornato(join(WEB, 'vendor'))) console.log('Lode: librerie della barra copiate in vendor/'); }
  catch (x) { console.error('Lode: librerie della barra non copiate (PDF, formule e voce Whisper non funzioneranno):', x.message); }
  await V.carica(WEB);
  try { ER = await import(pathToFileURL(join(WEB, 'js', 'errori.js')).href); } catch (x) { console.error('Lode: errori.js non si carica', x); }
  await apriVault();   // se la cartella è bloccata lo dice, e Lode parte comunque
  await sync.avvia();   // solo se lo studente l'ha accesa: legge il diario e fa il primo giro
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
