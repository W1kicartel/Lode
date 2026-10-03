// L'icona di Lode per chi la installa dal codice (desktop/collegamento.mjs): node test/collegamento.mjs
// I file per Mac, Windows e Linux si preparano su qualsiasi computer; sul Mac e su Linux si creano davvero in una cartella
// temporanea (mai nella cartella vera dell'utente) e si lancia lo script con un finto Electron che stampa gli argomenti.
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as C from '../desktop/collegamento.mjs';

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const T = mkdtempSync(join(tmpdir(), 'lode-icona-'));
// una cartella con spazi, apostrofo, virgolette e $: deve arrivare intatta a Electron
const strana = join(T, `Documenti di Gian'Luca "prova" $HOME`, 'Lode', 'desktop');
const base = p => ({ piattaforma: p, home: join(T, 'casa'), appData: join(T, 'casa', 'AppData', 'Roaming'), scrivania: join(T, 'casa', 'Desktop'), eseguibile: join(T, 'electron'), cartella: strana, argomenti: [], versione: '0.5.1' });

try {
  // dove vanno i file, senza permessi di amministratore
  const pm = C.percorsi(base('darwin')), pw = C.percorsi(base('win32')), pl = C.percorsi(base('linux'));
  prova('mac: icona in ~/Applications, avvio in ~/Library/LaunchAgents', pm.icone[0].endsWith(join('Applications', 'Lode.app')) && pm.avvio.endsWith(join('LaunchAgents', 'it.lode.sorgente.plist')));
  prova('windows: menu Start e desktop', pw.icone.length === 2 && pw.icone[0].includes(join('Start Menu', 'Programs')) && pw.icone[1] === join(T, 'casa', 'Desktop', 'Lode.lnk') && pw.avvio === null);
  prova('linux: applications e autostart', pl.icone[0].endsWith(join('.local', 'share', 'applications', 'lode.desktop')) && pl.avvio.endsWith(join('.config', 'autostart', 'lode.desktop')));
  for (const p of [pm, pw, pl]) prova('tutto dentro la cartella dell\'utente', [...p.icone, p.avvio].filter(Boolean).every(f => f.startsWith(join(T, 'casa'))), JSON.stringify(p));

  // Mac: Info.plist con LSUIElement e la frase del microfono, script eseguibile, icona
  const fm = C.fileMac(base('darwin'));
  const plist = fm.find(f => f.rel === 'Contents/Info.plist').testo, script = fm.find(f => f.rel === 'Contents/MacOS/Lode');
  prova('mac: Info.plist completo', /<key>CFBundleExecutable<\/key><string>Lode<\/string>/.test(plist) && /<key>LSUIElement<\/key><true\/>/.test(plist) && /NSMicrophoneUsageDescription/.test(plist) && /CFBundleIconFile<\/key><string>icona</.test(plist));
  prova('mac: script eseguibile che lancia Electron con la cartella', script.modo === 0o755 && script.testo.startsWith('#!/bin/bash') && script.testo.includes('exec '));
  prova('mac: icona copiata da build/icon.icns', fm.some(f => f.copia === join(strana, 'build', 'icon.icns')));
  prova('mac: avvio con open -g sull\'icona', /<string>\/usr\/bin\/open<\/string><string>-g<\/string>/.test(C.agenteMac('/x/Lode.app')) && /RunAtLoad<\/key><true\/>/.test(C.agenteMac('/x/Lode.app')));
  prova('mac: & e < nei percorsi diventano XML valido', C.agenteMac('/a & b/<c>.app').includes('/a &amp; b/&lt;c&gt;.app'));

  // Windows: i campi del collegamento
  const cw = C.collegamentoWin({ ...base('win32'), eseguibile: 'C:\\Lode\\desktop\\node_modules\\electron\\dist\\electron.exe', cartella: 'C:\\Users\\studente\\Corso di Laurea\\Lode\\desktop' });
  prova('windows: collegamento a electron.exe con la cartella tra virgolette', cw.target.endsWith('electron.exe') && cw.args === '"C:\\Users\\studente\\Corso di Laurea\\Lode\\desktop"' && cw.cwd === 'C:\\Users\\studente\\Corso di Laurea\\Lode\\desktop' && cw.icon.endsWith('icon.ico') && cw.appUserModelId === cw.target);

  // Linux: .desktop secondo la specifica (virgolette, \ " ` $ e %)
  const dl = C.fileLinux({ ...base('linux'), cartella: '/home/studente/50% "x" $y/Lode/desktop', argomenti: ['--no-sandbox'] });
  prova('linux: Exec con argomenti protetti', dl.includes('Exec="') && dl.includes('"/home/studente/50%% \\"x\\" \\$y/Lode/desktop" "--no-sandbox"'), dl);
  prova('linux: autostart solo nella copia per l\'accensione', !C.fileLinux(base('linux')).includes('Autostart') && C.fileLinux(base('linux'), { autostart: true }).includes('X-GNOME-Autostart-enabled=true'));

  // sul computer vero (cartella temporanea): Mac e Linux
  const qui = process.platform === 'win32' ? null : process.platform === 'darwin' ? 'darwin' : 'linux';
  if (qui) {
    // il finto Electron: stampa gli argomenti uno per riga, in un file
    const uscita = join(T, 'argomenti.txt'), finto = join(T, 'electron');
    writeFileSync(finto, `#!/bin/bash\nfor a in "$@"; do printf '%s\\n' "$a"; done > ${JSON.stringify(uscita)}\n`); chmodSync(finto, 0o755);
    mkdirSync(join(strana, 'build'), { recursive: true }); writeFileSync(join(strana, 'build', 'icon.icns'), 'icns finto');
    const d = { ...base(qui), eseguibile: finto };
    prova(`${qui}: prima non c'è`, !C.haIcona(d) && !C.avvioAttivo(d));
    C.creaIcona(d); C.avvio(d, true);
    prova(`${qui}: icona e avvio creati`, C.haIcona(d) && C.avvioAttivo(d) && C.puntaQui(d));
    if (qui === 'darwin') {
      const app = C.percorsi(d).icone[0];
      let lint = ''; try { lint = execFileSync('plutil', ['-lint', join(app, 'Contents', 'Info.plist'), C.percorsi(d).avvio], { encoding: 'utf8' }); } catch (e) { lint = String(e.stdout || e.message); }
      prova('mac: plist validi (plutil)', (lint.match(/: OK/g) || []).length === 2, lint);
      prova('mac: icona copiata', readFileSync(join(app, 'Contents', 'Resources', 'icona.icns'), 'utf8') === 'icns finto');
      execFileSync(join(app, 'Contents', 'MacOS', 'Lode'), ['--extra']);
    } else {
      execFileSync('bash', ['-c', readFileSync(C.percorsi(d).icone[0], 'utf8').match(/^Exec=(.*)$/m)[1].replace(/%%/g, '%')]);
      prova('linux: autostart con la stessa riga Exec', readFileSync(C.percorsi(d).avvio, 'utf8').includes(readFileSync(C.percorsi(d).icone[0], 'utf8').match(/^Exec=.*$/m)[0]));
    }
    const arg = readFileSync(uscita, 'utf8').split('\n').filter(Boolean);
    prova(`${qui}: Electron riceve la cartella intatta (spazi, apostrofo, virgolette, $)`, arg[0] === strana && (qui !== 'darwin' || arg[1] === '--extra'), JSON.stringify(arg));
    // la cartella si sposta: l'icona non punta più qui, si riscrive
    const spostata = { ...d, cartella: join(T, 'altrove', 'Lode', 'desktop') };
    prova(`${qui}: cartella spostata, l'icona va aggiornata`, C.haIcona(spostata) && !C.puntaQui(spostata));
    C.creaIcona(spostata);
    prova(`${qui}: riscritta, punta alla cartella nuova (anche l'avvio)`, C.puntaQui(spostata) && readFileSync(C.percorsi(d).avvio, 'utf8').includes(qui === 'darwin' ? 'Lode.app' : 'altrove'));
    C.avvio(d, false); C.togliIcona(d);
    prova(`${qui}: tolti`, !C.haIcona(d) && !C.avvioAttivo(d) && !existsSync(C.percorsi(d).icone[0]));
  }
} finally { rmSync(T, { recursive: true, force: true }); }
console.log(`collegamento: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
