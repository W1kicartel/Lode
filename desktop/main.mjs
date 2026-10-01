// Lode, l'app desktop. Una finestra trasparente in cima allo schermo, sopra tutte le altre: dentro c'è solo la barra.
// I clic passano attraverso tranne che sulla barra. Scorciatoie globali per la cattura in aula. Il vault Obsidian in
// Documenti/Lode è la memoria: dati di Lode in .lode/dati.json, lezioni in Markdown. Icona nella barra dei menu.
import { app, BrowserWindow, Menu, Tray, dialog, globalShortcut, ipcMain, nativeImage, powerMonitor, screen, shell } from 'electron';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as V from './vault.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const WEB = existsSync(join(QUI, 'web', 'index.html')) ? join(QUI, 'web') : join(QUI, '..');
const MAC = process.platform === 'darwin';
// per le prove: LODE_DATI e LODE_VAULT spostano configurazione e vault in una cartella a parte
if (process.env.LODE_DATI) app.setPath('userData', process.env.LODE_DATI);
if (!app.requestSingleInstanceLock()) app.quit();

/* ---------- configurazione: dov'è il vault ---------- */
const CONF = () => join(app.getPath('userData'), 'config.json');
let conf = {};
function leggiConf() { try { conf = JSON.parse(readFileSync(CONF(), 'utf8')); } catch { conf = {}; } }
function salvaConf() { mkdirSync(dirname(CONF()), { recursive: true }); V.scriviSicuro(CONF(), JSON.stringify(conf, null, 2)); }
const vault = () => conf.vault;
const fileDati = () => join(vault(), '.lode', 'dati.json');

/* ---------- finestre ---------- */
let barra = null, quadro = null, tray = null, guardiano = null;
const LARGA = 640;
function posiziona() {
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()), a = d.workArea;
  barra.setBounds({ x: Math.round(a.x + a.width / 2 - LARGA / 2), y: a.y, width: LARGA, height: Math.min(780, a.height) });
}
function creaBarra() {
  barra = new BrowserWindow({
    width: LARGA, height: 760, frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, hasShadow: false, skipTaskbar: true, alwaysOnTop: true, show: false, backgroundColor: '#00000000',
    ...(MAC ? { type: 'panel' } : {}),
    webPreferences: { preload: join(QUI, 'preload.cjs'), contextIsolation: true, sandbox: true, spellcheck: true },
  });
  barra.setAlwaysOnTop(true, MAC ? 'floating' : 'screen-saver');
  barra.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  barra.setIgnoreMouseEvents(true, { forward: true });
  posiziona();
  barra.loadFile(join(WEB, 'index.html'));
  barra.once('ready-to-show', () => barra.showInactive());
  barra.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:|^obsidian:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  barra.webContents.session.setPermissionRequestHandler((_, p, cb) => cb(['media', 'notifications', 'clipboard-sanitized-write'].includes(p)));
}
function apriQuadro() {
  if (quadro && !quadro.isDestroyed()) { quadro.show(); quadro.focus(); return; }
  quadro = new BrowserWindow({ width: 1120, height: 820, minWidth: 380, minHeight: 500, title: 'Lode', backgroundColor: '#0A0A0A', titleBarStyle: MAC ? 'hiddenInset' : 'default',
    webPreferences: { preload: join(QUI, 'preload.cjs'), contextIsolation: true, sandbox: true } });
  quadro.loadFile(join(WEB, 'index.html'), { query: { quadro: '1' } });
  quadro.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  if (MAC) app.dock?.show();
  quadro.on('closed', () => { quadro = null; if (MAC) app.dock?.hide(); });
}
const tutte = () => [barra, quadro].filter(w => w && !w.isDestroyed());
const manda = (canale, x, tranne) => tutte().forEach(w => { if (w.webContents !== tranne) w.webContents.send(canale, x); });

/* ---------- vault ---------- */
function info() { const o = V.obsidian(vault()); return { percorso: vault(), nome: vault().split(/[\\/]/).pop(), obsidian: { installato: o.installato, registrato: !!o.registrato }, note: V.notePerLode(vault()) }; }
function avviaVault() {
  guardiano?.chiudi();
  let orario = [];
  try { orario = JSON.parse(readFileSync(fileDati(), 'utf8')).orario || []; } catch { }
  V.crea(vault(), orario);
  V.registra(vault());
  guardiano = V.guarda(vault(), {
    lezioniCambiate: () => manda('vault:lezioni', V.lezioni(vault())),
    orarioCambiato: o => manda('vault:orario', o),
    noteCambiate: () => manda('vault:info', info()),
  });
  try { guardiano.segnaOrario(readFileSync(join(vault(), 'Orario.md'), 'utf8')); } catch { }
}
async function scegliVault() {
  const r = await dialog.showOpenDialog({ title: 'Scegli il vault Obsidian', buttonLabel: 'Usa questo vault', properties: ['openDirectory', 'createDirectory'], defaultPath: vault() });
  if (r.canceled || !r.filePaths[0]) return null;
  conf.vault = r.filePaths[0]; salvaConf(); avviaVault();
  tutte().forEach(w => w.webContents.reload());
  return info();
}

/* ---------- canali con la barra ---------- */
let tSalva = 0, daSalvare = null;
ipcMain.on('dati:leggi', e => { try { e.returnValue = JSON.parse(readFileSync(fileDati(), 'utf8')); } catch { e.returnValue = null; } });
ipcMain.on('dati:salva', (e, d) => {
  daSalvare = d; clearTimeout(tSalva);
  tSalva = setTimeout(() => { try { V.scriviSicuro(fileDati(), JSON.stringify(daSalvare, null, 1)); } catch (x) { console.error(x); } }, 250);
  manda('dati:cambiati', d, e.sender);
});
ipcMain.on('mouse', (e, ignora) => BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(ignora, { forward: true }));
ipcMain.handle('vault:info', () => info());
ipcMain.handle('vault:lezioni', () => V.lezioni(vault()));
ipcMain.handle('vault:annota', (_, x) => V.annota(vault(), x));
ipcMain.handle('vault:scrivi', (_, { file, testo }) => {
  if (!/^(Orario|Lode\/[\w ]+)\.md$/.test(file)) throw new Error('file non permesso');
  if (file === 'Orario.md') guardiano?.segnaOrario(testo);
  V.scriviSicuro(V.dentro(vault(), file), testo); return true;
});
ipcMain.handle('vault:memoria', (_, { testo }) => { V.memoria(vault(), testo); return true; });
ipcMain.handle('vault:apri', async (_, { file, nuovo }) => {
  const p = V.dentro(vault(), file);
  if (!existsSync(p) && nuovo) V.scriviSicuro(p, nuovo);
  const l = V.linkObsidian(vault(), file);
  if (l.url) await shell.openExternal(l.url); else await shell.openPath(p);
  return { esito: l.esito, percorso: vault() };
});
ipcMain.handle('vault:scegli', () => scegliVault());
ipcMain.handle('sistema:inattivo', () => powerMonitor.getSystemIdleTime());
// dopo una cattura veloce il fuoco torna all'app dove lo studente stava scrivendo
ipcMain.handle('finestra:rilascia', e => {
  const w = BrowserWindow.fromWebContents(e.sender); if (w !== barra) return;
  if (MAC) { if (!quadro || !quadro.isVisible()) { app.hide(); setTimeout(() => barra.showInactive(), 60); } else barra.blur(); }
  else barra.blur();
});

/* ---------- scorciatoie e icona ---------- */
const TASTI = MAC
  ? { apri: 'Alt+Space', stella: 'Control+Alt+S', definizione: 'Control+Alt+D', domanda: 'Control+Alt+Q', gioco: 'Control+Alt+G' }
  : { apri: 'Control+Shift+Space', stella: 'Control+Alt+S', definizione: 'Control+Alt+D', domanda: 'Control+Alt+Q', gioco: 'Control+Alt+G' };
function scorciatoie() {
  for (const [nome, tasti] of Object.entries(TASTI)) {
    const ok = globalShortcut.register(tasti, () => {
      posiziona(); barra.show(); barra.focus(); if (MAC) app.focus({ steal: true });
      barra.setIgnoreMouseEvents(false);
      barra.webContents.send('scorciatoia', nome);
    });
    if (!ok) console.warn(`Lode: ${tasti} è già usata da un'altra app`);
  }
}
function creaTray() {
  const img = nativeImage.createFromPath(join(QUI, 'build', 'trayTemplate.png')); img.setTemplateImage(true);
  tray = new Tray(img); tray.setToolTip('Lode');
  const menu = () => Menu.buildFromTemplate([
    { label: `Apri Lode (${MAC ? '⌥ Spazio' : 'Ctrl+Shift+Spazio'})`, click: () => { barra.show(); barra.focus(); barra.setIgnoreMouseEvents(false); barra.webContents.send('scorciatoia', 'apri'); } },
    { label: 'Il quadro: libretto, esami, ripasso', click: apriQuadro },
    { type: 'separator' },
    { label: 'Apri il vault in Obsidian', click: async () => { const l = V.linkObsidian(vault(), 'Benvenuto.md'); if (l.url) shell.openExternal(l.url); else shell.openPath(vault()); } },
    { label: 'Mostra il vault nella cartella', click: () => shell.openPath(vault()) },
    { label: 'Usa un altro vault…', click: scegliVault },
    { type: 'separator' },
    { label: 'Avvia Lode all\'accensione', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, enabled: app.isPackaged, click: i => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { label: 'Esci da Lode', role: 'quit' },
  ]);
  tray.on('click', () => tray.popUpContextMenu(menu())); tray.on('right-click', () => tray.popUpContextMenu(menu()));
}

app.whenReady().then(async () => {
  if (MAC) app.dock?.hide();
  leggiConf();
  if (process.env.LODE_VAULT) conf.vault = process.env.LODE_VAULT;
  if (!conf.vault) { conf.vault = join(app.getPath('documents'), 'Lode'); conf.primoAvvio = Date.now(); salvaConf(); if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true }); }
  await V.carica(WEB);
  avviaVault();
  creaBarra(); creaTray(); scorciatoie();
  screen.on('display-metrics-changed', posiziona); screen.on('display-added', posiziona); screen.on('display-removed', posiziona);
  if (process.env.LODE_QUADRO) apriQuadro();
  // prove automatiche: esegue uno script nella barra e ne salva una foto (LODE_PROVA=script.js, LODE_FOTO=cartella)
  if (process.env.LODE_PROVA) barra.webContents.once('did-finish-load', async () => {
    const { writeFileSync: scrivi } = await import('node:fs');
    const passi = JSON.parse(readFileSync(process.env.LODE_PROVA, 'utf8'));
    for (const [i, p] of passi.entries()) {
      await new Promise(r => setTimeout(r, p.attesa ?? 1200));
      try { const r = await barra.webContents.executeJavaScript(p.js || 'null'); if (r != null) console.log(`passo ${i}:`, JSON.stringify(r)); } catch (e) { console.log(`passo ${i} errore:`, e.message); }
      if (p.foto) { await new Promise(r => setTimeout(r, 900)); scrivi(join(process.env.LODE_FOTO, p.foto), (await barra.webContents.capturePage()).toPNG()); }
    }
    if (process.env.LODE_ESCI) app.quit();
  });
});
app.on('second-instance', () => { barra?.show(); barra?.webContents.send('scorciatoia', 'apri'); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); guardiano?.chiudi(); });
app.on('window-all-closed', e => e.preventDefault?.());
