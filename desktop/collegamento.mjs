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

const ID = 'it.lode.sorgente';
const MICROFONO = 'Lode usa il microfono quando parli con lui, per «Ripeti» in aula e per trascrivere le lezioni che scegli. L\'audio non resta mai sul computer.';

// d = { piattaforma, home, appData, scrivania, eseguibile, cartella, argomenti: [] }
export function percorsi(d) {
  if (d.piattaforma === 'darwin') return { icone: [join(d.home, 'Applications', 'Lode.app')], avvio: join(d.home, 'Library', 'LaunchAgents', `${ID}.plist`) };
  if (d.piattaforma === 'win32') return { icone: [join(d.appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Lode.lnk'), join(d.scrivania, 'Lode.lnk')], avvio: null };
  return { icone: [join(d.home, '.local', 'share', 'applications', 'lode.desktop')], avvio: join(d.home, '.config', 'autostart', 'lode.desktop') };
}

const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// bash: tra apici singoli non si espande niente; l'apice stesso diventa '\''
const sh = s => `'${String(s).replace(/'/g, `'\\''`)}'`;
// .desktop (specifica freedesktop): argomenti tra virgolette, con \ " ` $ preceduti da \, e % raddoppiato
const dq = s => `"${String(s).replace(/[\\"`$]/g, m => '\\' + m).replace(/%/g, '%%')}"`;

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
  <key>NSMicrophoneUsageDescription</key><string>${xml(MICROFONO)}</string>
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
${autostart ? 'X-GNOME-Autostart-enabled=true\n' : ''}`;
}

// Windows: i campi del collegamento (shell.writeShortcutLink). appUserModelId come main.mjs in sviluppo (process.execPath)
export function collegamentoWin(d) {
  return { target: d.eseguibile, args: [d.cartella, ...(d.argomenti || [])].map(a => `"${a}"`).join(' '), cwd: d.cartella,
    description: 'Lode', icon: join(d.cartella, 'build', 'icon.ico'), iconIndex: 0, appUserModelId: d.eseguibile };
}

function scrivi(f, testo, modo) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, testo); if (modo) chmodSync(f, modo); }

export function haIcona(d) { return percorsi(d).icone.some(existsSync); }

// crea (o riscrive) l'icona. shell: il modulo shell di Electron, serve solo su Windows
export function creaIcona(d, shell) {
  const p = percorsi(d);
  if (d.piattaforma === 'darwin') {
    const app = p.icone[0];
    rmSync(app, { recursive: true, force: true });
    for (const f of fileMac(d)) {
      const dest = join(app, f.rel);
      if (f.copia) { mkdirSync(dirname(dest), { recursive: true }); if (existsSync(f.copia)) copyFileSync(f.copia, dest); }
      else scrivi(dest, f.testo, f.modo);
    }
  } else if (d.piattaforma === 'win32') {
    const c = collegamentoWin(d);
    for (const f of p.icone) { mkdirSync(dirname(f), { recursive: true }); if (!shell.writeShortcutLink(f, existsSync(f) ? 'replace' : 'create', c)) throw new Error(`non riesco a creare ${f}`); }
  } else scrivi(p.icone[0], fileLinux(d), 0o755);
  // se l'avvio all'accensione era acceso, punta anche lui alla cartella di adesso
  if (d.piattaforma !== 'win32' && p.avvio && existsSync(p.avvio)) avvio(d, true);
}

export function togliIcona(d) { for (const f of percorsi(d).icone) rmSync(f, { recursive: true, force: true }); }

// l'avvio all'accensione. app: l'oggetto app di Electron, serve solo su Windows
const argWin = d => [d.cartella, ...(d.argomenti || [])];
export function avvioAttivo(d, app) {
  if (d.piattaforma === 'win32') return !!app.getLoginItemSettings({ path: d.eseguibile, args: argWin(d) }).openAtLogin;
  return existsSync(percorsi(d).avvio);
}
export function avvio(d, acceso, app) {
  if (d.piattaforma === 'win32') return app.setLoginItemSettings({ openAtLogin: acceso, path: d.eseguibile, args: argWin(d) });
  const f = percorsi(d).avvio;
  if (!acceso) return rmSync(f, { force: true });
  if (d.piattaforma === 'darwin') { if (!haIcona(d)) creaIcona(d); scrivi(f, agenteMac(percorsi(d).icone[0])); }
  else scrivi(f, fileLinux(d, { autostart: true }));
}

// l'icona che c'è punta ancora a questa cartella? (Mac e Linux: si legge il file; Windows: si riscrive comunque)
export function puntaQui(d) {
  try {
    const p = percorsi(d);
    if (d.piattaforma === 'darwin') return readFileSync(join(p.icone[0], 'Contents', 'MacOS', 'Lode'), 'utf8').includes(sh(d.cartella));
    if (d.piattaforma === 'linux') return readFileSync(p.icone[0], 'utf8').includes(dq(d.cartella));
  } catch { }
  return false;
}
