// Lode, l'app desktop. Una finestra trasparente in cima allo schermo, sopra tutte le altre: dentro c'è solo la barra.
// I clic passano attraverso tranne che sulla barra. Scorciatoie globali per la cattura in aula. Il vault Obsidian in
// Documenti/Lode è la memoria: dati di Lode in .lode/dati.json, lezioni in Markdown. Icona nella barra dei menu.
import { app, BrowserWindow, Menu, ShareMenu, Tray, dialog, globalShortcut, ipcMain, nativeImage, nativeTheme, powerMonitor, screen, shell } from 'electron';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync, renameSync, copyFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as V from './vault.mjs';
import * as I from './installa.mjs';
import * as VOCE from './voce.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const WEB = existsSync(join(QUI, 'web', 'index.html')) ? join(QUI, 'web') : join(QUI, '..');
const MAC = process.platform === 'darwin', WIN = process.platform === 'win32';
// Windows: lo stesso id dei collegamenti dell'installer (appId), per notifiche, barra delle applicazioni e avvio automatico
if (WIN) app.setAppUserModelId(app.isPackaged ? 'it.lode.app' : process.execPath);
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
app.on('before-quit', () => { uscendo = true; scriviTutto(); });
app.whenReady().then(() => { powerMonitor.on('resume', riprovaLettura); powerMonitor.on('unlock-screen', riprovaLettura); });

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
  scrivi(fileDati());   // prima quello che aspetta di essere scritto (una finestra che si ricarica rilegge i dati giusti)
  try { e.returnValue = leggiDati(); nonLetti.delete(e.sender.id); }
  catch (x) { console.error('Lode: non riesco a leggere i dati', x); nonLetti.add(e.sender.id); e.returnValue = { __errore: x.code || 'lettura' }; tRilettura = setTimeout(riprovaLettura, 15e3); }   // js/dati.js parte vuoto e lo dice
});
ipcMain.on('dati:salva', (e, d) => {
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
ipcMain.handle('vault:annota', (_, x) => V.annota(vault(), x));
ipcMain.handle('vault:scrivi', (_, { file, testo }) => {
  if (!/^(Orario|Lode\/[\w ]+)\.md$/.test(file)) throw new Error('file non permesso');
  if (file === 'Orario.md') guardiano?.segnaOrario(testo);
  V.scriviSicuro(V.dentro(vault(), file), testo); return true;
});
// le pagine che Lode tiene aggiornate (Home, Esami, Glossario, corsi, navigazione delle lezioni): solo dentro i suoi segni
ipcMain.handle('vault:blocco', (_, x) => {
  if (!/^(Home|Esami|Glossario)\.md$|^Corsi\/[^/]+\.md$|^Lezioni\/[^/]+\/[^/]+\.md$/.test(x.file)) throw new Error('file non permesso');
  return V.blocco(vault(), x);
});
ipcMain.handle('vault:note', () => V.note(vault()));
// leggere una nota (per le sbobine) e salvare file nel vault: sbobine, allegati, materiali, sbobine ricevute
ipcMain.handle('vault:leggi', (_, { file }) => { if (!/\.md$/.test(file)) throw new Error('solo note'); return readFileSync(V.dentro(vault(), file), 'utf8'); });
ipcMain.handle('vault:salvaFile', (_, { file, testo, dati, sostituisci = false }) => {
  if (!/^(Sbobine|Allegati|Materiali|Lezioni)\//.test(file)) throw new Error('cartella non permessa');
  let p = V.dentro(vault(), file), rel = file;
  if (!sostituisci) for (let k = 2; existsSync(p); k++) { rel = file.replace(/(\.[a-z0-9]+)$/i, ` ${k}$1`); p = V.dentro(vault(), rel); }
  mkdirSync(dirname(p), { recursive: true });
  if (dati) writeFileSync(p, Buffer.from(dati)); else V.scriviSicuro(p, testo);
  return { file: rel, percorso: p };
});
// condividere: il menu Condividi di macOS (AirDrop, Messaggi, Mail, WhatsApp…), altrove la cartella con i file
ipcMain.handle('condividi', (e, { files }) => {
  const percorsi = files.map(f => V.dentro(vault(), f));
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
const chatCloud = new Map();
ipcMain.handle('ai:chat', async (e, { id, base, chiave, corpo }) => {
  const c = new AbortController(); chatCloud.set(id, c);
  try {
    const r = await I.rete(base.replace(/\/$/, '') + '/chat/completions', { method: 'POST', signal: c.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + chiave, 'X-Title': 'Lode' }, body: JSON.stringify(corpo) });
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
ipcMain.handle('ai:modelli', async (_, { base, chiave }) => {
  const r = await I.rete(base.replace(/\/$/, '') + '/models', { headers: { authorization: 'Bearer ' + chiave } });
  if (!r.ok) return { errore: (await r.text().catch(() => '')).slice(0, 300) || r.statusText, stato: r.status };
  const j = await r.json(); return { modelli: (j.data || j.models || []).map(m => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean) };
});
ipcMain.handle('locale:scalda', async () => { if (conf.modello) await fetch(I.OLLAMA + '/api/generate', { method: 'POST', body: JSON.stringify({ model: conf.modello, keep_alive: '15m' }) }).catch(() => { }); return true; });
ipcMain.handle('locale:stop', (_, { id }) => { chat.get(id)?.abort(); return true; });
ipcMain.handle('vault:memoria', (_, { testo }) => { V.memoria(vault(), testo); return true; });
ipcMain.handle('vault:apri', async (_, { file, nuovo }) => {
  const p = V.dentro(vault(), file);
  if (!existsSync(p) && nuovo) V.scriviSicuro(p, nuovo);
  const l = V.linkObsidian(vault(), file);
  if (l.url) await I.apriObsidian(l.url); else await shell.openPath(p);
  return { esito: l.esito, percorso: vault() };
});
ipcMain.handle('vault:scegli', () => scegliVault());
ipcMain.handle('sistema:inattivo', () => powerMonitor.getSystemIdleTime());
// la voce sul Mac: Parakeet v3 sul Neural Engine (lode-voce). Altrove, o senza il programma, resta Whisper nella barra.
const voce = VOCE.crea({ binario: [join(process.resourcesPath || '', 'bin', 'lode-voce'), join(QUI, 'bin', 'lode-voce')].find(existsSync) || join(QUI, 'bin', 'lode-voce'),   // nel pacchetto: Resources/bin
  avanza: x => { for (const w of BrowserWindow.getAllWindows()) w.webContents.send('voce:progresso', x); } });
ipcMain.handle('voce:stato', () => ({ parakeet: voce.disponibile() }));
ipcMain.handle('voce:prepara', () => voce.avvia());
ipcMain.handle('voce:trascrivi', (_, audio) => voce.trascrivi(audio));
app.on('will-quit', () => voce.chiudi());
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
  await V.carica(WEB);
  await apriVault();   // se la cartella è bloccata lo dice, e Lode parte comunque
  creaBarra(); creaTray(); scorciatoie();
  if (!conf.benvenuto && !process.env.LODE_PROVA) apriBenvenuto();
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
