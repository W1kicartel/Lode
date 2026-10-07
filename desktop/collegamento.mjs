// Per chi installa Lode dal codice (npm start): l'icona per riaprirla senza terminale e l'avvio all'accensione, come fa
// l'installer. Tutto nella cartella dell'utente, senza permessi di amministratore, e mai nell'app impacchettata.
//   Mac      ~/Applications/Lode.app: uno script che lancia l'Electron di desktop/node_modules con la cartella di Lode;
//            all'accensione un LaunchAgent (~/Library/LaunchAgents) che apre quell'icona.
//   Windows  Lode.lnk nel menu Start e sul desktop; all'accensione setLoginItemSettings con lo stesso Electron.
//   Linux    lode.desktop in ~/.local/share/applications; all'accensione una copia in ~/.config/autostart.
// L'icona punta alla cartella da cui è partito Lode: se esiste già, a ogni avvio dal codice si riscrive (cartella spostata).
// Le funzioni che preparano i file sono pure (test/collegamento.mjs le prova per i tre sistemi su qualsiasi computer).
import { existsSync, mkdirSync, writeFileSync, chmodSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { t } from './lingua.mjs';

const ID = 'it.lode.sorgente';
// funzioni e non costanti: il main sceglie la lingua dopo aver caricato i moduli
const AUDIO_COMPUTER = () => t('desktop.permesso-audio-computer');
const MICROFONO = () => t('desktop.permesso-microfono');

// d = { piattaforma, home, appData, scrivania, eseguibile, cartella, argomenti: [] }
export function percorsi(d) {
  if (d.piattaforma === 'darwin') return { icone: [join(d.home, 'Applications', 'Lode.app')], avvio: join(d.home, 'Library', 'LaunchAgents', `${ID}.plist`) };
  if (d.piattaforma === 'win32') return { icone: [join(d.appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Lode.lnk'), join(d.scrivania, 'Lode.lnk')], avvio: null };
  return { icone: [join(d.home, '.local', 'share', 'applications', 'lode.desktop')], avvio: join(d.home, '.config', 'autostart', 'lode.desktop') };
}

const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// bash: tra apici singoli non si espande niente; l'apice stesso diventa '\''
const sh = s => `'${String(s).replace(/'/g, `'\\''`)}'`;
// .desktop (specifica freedesktop): dentro le virgolette \ " ` $ hanno davanti \; poi vale l'escape delle stringhe, che
// raddoppia ogni \ (così un $ diventa \\$, come chiede la specifica e come legge GLib); il % si raddoppia
const dq = s => `"${String(s).replace(/[\\"`$]/g, m => '\\' + m).replace(/\\/g, '\\\\').replace(/%/g, '%%')}"`;

// il bundle del Mac: Info.plist, lo script che parte e l'icona. LSUIElement come nell'app installata (niente Dock);
// la frase del microfono serve anche qui, perché macOS può chiedere il permesso a nome di questa icona
export function fileMac(d) {
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Lode</string>
  <key>CFBundleDisplayName</key><string>Lode</string>
  <key>CFBundleIdentifier</key><string>${ID}</string>
  <key>CFBundleExecutable</key><string>Lode</string>
  <key>CFBundleIconFile</key><string>icona</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${xml(d.versione || '0')}</string>
  <key>LSUIElement</key><true/>
  <key>NSMicrophoneUsageDescription</key><string>${xml(MICROFONO())}</string>
  <key>NSAudioCaptureUsageDescription</key><string>${xml(AUDIO_COMPUTER())}</string>
</dict>
</plist>
`;
  const script = `#!/bin/bash
# Lode dal codice: apre l'app della cartella ${d.cartella.replace(/\n/g, ' ')}
# (l'ha creata Lode; se sposti la cartella, avvia una volta con npm start e si aggiorna da sola)
exec ${[d.eseguibile, d.cartella, ...(d.argomenti || [])].map(sh).join(' ')} "$@"
`;
  return [
    { rel: 'Contents/Info.plist', testo: plist },
    { rel: 'Contents/MacOS/Lode', testo: script, modo: 0o755 },
    { rel: 'Contents/Resources/icona.icns', copia: join(d.cartella, 'build', 'icon.icns') },
  ];
}

export function agenteMac(app) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${ID}</string>
  <key>ProgramArguments</key>
  <array><string>/usr/bin/open</string><string>-g</string><string>${xml(app)}</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`;
}

export function fileLinux(d, { autostart = false } = {}) {
  return `[Desktop Entry]
Type=Application
Name=Lode
Comment=L'assistente di studio che vive in cima allo schermo
Exec=${[d.eseguibile, d.cartella, ...(d.argomenti || [])].map(dq).join(' ')}
Icon=${join(d.cartella, 'build', 'icon.png')}
Terminal=false
Categories=Education;
StartupWMClass=lode
X-Lode-Dal-Codice=true
${autostart ? 'X-GNOME-Autostart-enabled=true\n' : ''}`;
}

// Windows: i campi del collegamento (shell.writeShortcutLink). appUserModelId come main.mjs in sviluppo (process.execPath)
export function collegamentoWin(d) {
  return { target: d.eseguibile, args: [d.cartella, ...(d.argomenti || [])].map(a => `"${a}"`).join(' '), cwd: d.cartella,
    description: 'Lode', icon: join(d.cartella, 'build', 'icon.ico'), iconIndex: 0, appUserModelId: d.eseguibile };
}

function scrivi(f, testo, modo) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, testo); if (modo) chmodSync(f, modo); }
const leggi = f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };

// l'icona in quel percorso l'ha creata Lode dal codice? Quelle dell'installer (Lode.lnk di NSIS, una Lode.app vera in
// ~/Applications) non si toccano mai: né riscritte, né tolte
export function nostra(d, f, shell) {
  if (!existsSync(f)) return false;
  if (d.piattaforma === 'darwin') return leggi(join(f, 'Contents', 'Info.plist')).includes(`<string>${ID}</string>`);
  if (d.piattaforma === 'win32') { try { const t = shell.readShortcutLink(f).target || ''; return t === d.eseguibile || /node_modules[\\/]electron[\\/]dist[\\/]electron\.exe$/i.test(t); } catch { return false; } }
  return leggi(f).includes('X-Lode-Dal-Codice=true');
}
export function haIcona(d, shell) { return percorsi(d).icone.some(f => nostra(d, f, shell)); }

// l'icona punta già a questa cartella?
function puntaQuiFile(d, f, shell) {
  // sul Mac anche l'Info.plist dev'essere quello di adesso: senza NSAudioCaptureUsageDescription (icone create prima della
  // «Lezione dal computer») macOS dà l'audio del sistema muto, senza chiedere niente
  if (d.piattaforma === 'darwin') return leggi(join(f, 'Contents', 'MacOS', 'Lode')).includes(sh(d.cartella)) && leggi(join(f, 'Contents', 'Info.plist')).includes('NSAudioCaptureUsageDescription');
  if (d.piattaforma === 'win32') { try { const l = shell.readShortcutLink(f), c = collegamentoWin(d); return l.target === c.target && l.args === c.args; } catch { return false; } }
  return leggi(f).includes(dq(d.cartella));
}
export function puntaQui(d, shell) { const f = percorsi(d).icone.filter(x => nostra(d, x, shell)); return f.length > 0 && f.every(x => puntaQuiFile(d, x, shell)); }

function scriviIcona(d, f, shell) {
  if (d.piattaforma === 'darwin') {
    rmSync(f, { recursive: true, force: true });
    for (const x of fileMac(d)) {
      const dest = join(f, x.rel);
      if (x.copia) { mkdirSync(dirname(dest), { recursive: true }); if (existsSync(x.copia)) copyFileSync(x.copia, dest); }
      else scrivi(dest, x.testo, x.modo);
    }
  } else if (d.piattaforma === 'win32') {
    mkdirSync(dirname(f), { recursive: true });
    if (!shell.writeShortcutLink(f, existsSync(f) ? 'replace' : 'create', collegamentoWin(d))) throw new Error(t('desktop.icona-non-creata', { file: f }));
  } else scrivi(f, fileLinux(d), 0o755);
}

// crea l'icona dove manca o è nostra (mai sopra quella dell'installer). shell: il modulo shell di Electron, per Windows
export function creaIcona(d, shell) {
  for (const f of percorsi(d).icone) if (!existsSync(f) || nostra(d, f, shell)) scriviIcona(d, f, shell);
  aggiornaAvvio(d);
}
// a ogni avvio dal codice: le icone nostre che puntano a un'altra cartella tornano qui. Quelle tolte dallo studente
// (per esempio dal desktop) non ricompaiono
export function aggiornaIcona(d, shell) {
  let n = 0;
  for (const f of percorsi(d).icone) if (nostra(d, f, shell) && !puntaQuiFile(d, f, shell)) { scriviIcona(d, f, shell); n++; }
  if (n) aggiornaAvvio(d);
  return n;
}
// Mac e Linux: se l'avvio all'accensione era acceso, punta anche lui alla cartella di adesso
function aggiornaAvvio(d) { const a = percorsi(d).avvio; if (d.piattaforma !== 'win32' && a && existsSync(a)) avvio(d, true); }

// toglie solo le icone nostre. Sul Mac l'avvio apre l'icona: senza icona si toglie anche lui
export function togliIcona(d, shell) {
  for (const f of percorsi(d).icone) if (nostra(d, f, shell)) rmSync(f, { recursive: true, force: true });
  if (d.piattaforma === 'darwin') rmSync(percorsi(d).avvio, { force: true });
}

// l'avvio all'accensione. app: l'oggetto app di Electron, serve solo su Windows. Su Windows Electron unisce gli argomenti
// con uno spazio senza virgolette: una cartella con uno spazio (C:\Users\<nome cognome>\…) va messa tra virgolette qui
const argWin = d => [d.cartella, ...(d.argomenti || [])].map(a => `"${a}"`);
export function avvioAttivo(d, app) {
  if (d.piattaforma === 'win32') return !!app.getLoginItemSettings({ path: d.eseguibile, args: argWin(d) }).openAtLogin;
  return existsSync(percorsi(d).avvio);
}
export function avvio(d, acceso, app, shell) {
  if (d.piattaforma === 'win32') return app.setLoginItemSettings({ openAtLogin: acceso, path: d.eseguibile, args: argWin(d) });
  const f = percorsi(d).avvio;
  if (!acceso) return rmSync(f, { force: true });
  if (d.piattaforma === 'darwin') { if (!haIcona(d)) creaIcona(d, shell); scrivi(f, agenteMac(percorsi(d).icone[0])); }
  else scrivi(f, fileLinux(d, { autostart: true }));
}
