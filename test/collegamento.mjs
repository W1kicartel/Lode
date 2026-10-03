// L'icona di Lode per chi la installa dal codice (desktop/collegamento.mjs): node test/collegamento.mjs
// I file per Mac, Windows e Linux si preparano e si scrivono su qualsiasi computer, in una cartella temporanea (mai nella
// cartella vera dell'utente). Windows usa un finto shell (collegamenti .lnk in JSON) e un finto app (avvio all'accensione).
// Sul Mac e su Linux, in più, si lancia l'icona con un finto Electron che scrive gli argomenti che riceve.
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import * as C from '../desktop/collegamento.mjs';

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const T = mkdtempSync(join(tmpdir(), 'lode-icona-'));
// una cartella con spazi, apostrofo, virgolette e $: deve arrivare intatta a Electron
const strana = join(T, `Documenti di Gian'Luca "prova" $HOME`, 'Lode', 'desktop');
const base = p => ({ piattaforma: p, home: join(T, p, 'casa'), appData: join(T, p, 'casa', 'AppData', 'Roaming'), scrivania: join(T, p, 'casa', 'Desktop'), eseguibile: join(T, 'electron'), cartella: strana, argomenti: [], versione: '0.5.1' });

// la riga Exec di un .desktop letta come la legge il lanciatore (specifica freedesktop): prima l'escape delle stringhe
// (\\ → \), poi gli argomenti tra virgolette (\" \` \$ \\), poi %% → %
function leggiExec(riga) {
  const s = riga.replace(/\\(.)/g, (m, c) => c === '\\' ? '\\' : c === 's' ? ' ' : c === 'n' ? '\n' : c === 't' ? '\t' : m);
  const arg = []; let i = 0;
  while (i < s.length) {
    if (s[i] === ' ') { i++; continue; }
    let a = '';
    if (s[i] === '"') { i++; while (i < s.length && s[i] !== '"') { if (s[i] === '\\' && '"`$\\'.includes(s[i + 1])) i++; a += s[i++]; } i++; }
    else while (i < s.length && s[i] !== ' ') a += s[i++];
    arg.push(a.replace(/%%/g, '%'));
  }
  return arg;
}
// il finto shell di Electron: un collegamento .lnk è un file JSON con i suoi campi
const shell = {
  writeShortcutLink(f, op, c) { if (op === 'replace' && !existsSync(f)) return false; mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(c)); return true; },
  readShortcutLink(f) { return JSON.parse(readFileSync(f, 'utf8')); },
};
// il finto app: l'avvio all'accensione con path e args, come nel registro di Windows
const avvii = new Map(), app = {
  setLoginItemSettings(o) { const k = o.path + ' ' + (o.args || []).join(' '); if (o.openAtLogin) avvii.set(k, o); else avvii.delete(k); },
  getLoginItemSettings(o) { return { openAtLogin: avvii.has(o.path + ' ' + (o.args || []).join(' ')) }; },
};

try {
  // dove vanno i file, senza permessi di amministratore
  const pm = C.percorsi(base('darwin')), pw = C.percorsi(base('win32')), pl = C.percorsi(base('linux'));
  prova('mac: icona in ~/Applications, avvio in ~/Library/LaunchAgents', pm.icone[0].endsWith(join('Applications', 'Lode.app')) && pm.avvio.endsWith(join('LaunchAgents', 'it.lode.sorgente.plist')));
  prova('windows: menu Start e desktop', pw.icone.length === 2 && pw.icone[0].includes(join('Start Menu', 'Programs')) && pw.icone[1] === join(T, 'win32', 'casa', 'Desktop', 'Lode.lnk') && pw.avvio === null);
  prova('linux: applications e autostart', pl.icone[0].endsWith(join('.local', 'share', 'applications', 'lode.desktop')) && pl.avvio.endsWith(join('.config', 'autostart', 'lode.desktop')));
  for (const [p, x] of [['darwin', pm], ['win32', pw], ['linux', pl]]) prova('tutto dentro la cartella dell\'utente', [...x.icone, x.avvio].filter(Boolean).every(f => f.startsWith(join(T, p, 'casa'))), JSON.stringify(x));

  // Mac: Info.plist con LSUIElement e la frase del microfono, script eseguibile, icona
  const fm = C.fileMac(base('darwin'));
  const plist = fm.find(f => f.rel === 'Contents/Info.plist').testo, script = fm.find(f => f.rel === 'Contents/MacOS/Lode');
  prova('mac: Info.plist completo', /<key>CFBundleExecutable<\/key><string>Lode<\/string>/.test(plist) && /<key>LSUIElement<\/key><true\/>/.test(plist) && /NSMicrophoneUsageDescription/.test(plist) && /CFBundleIconFile<\/key><string>icona</.test(plist));
  prova('mac: script eseguibile che lancia Electron con la cartella', script.modo === 0o755 && script.testo.startsWith('#!/bin/bash') && script.testo.includes('exec '));
  prova('mac: avvio con open -g sull\'icona', /<string>\/usr\/bin\/open<\/string><string>-g<\/string>/.test(C.agenteMac('/x/Lode.app')) && /RunAtLoad<\/key><true\/>/.test(C.agenteMac('/x/Lode.app')));
  prova('mac: & e < nei percorsi diventano XML valido', C.agenteMac('/a & b/<c>.app').includes('/a &amp; b/&lt;c&gt;.app'));

  // Windows: i campi del collegamento
  const cw = C.collegamentoWin({ ...base('win32'), eseguibile: 'C:\\Lode\\desktop\\node_modules\\electron\\dist\\electron.exe', cartella: 'C:\\Users\\studente\\Corso di Laurea\\Lode\\desktop' });
  prova('windows: collegamento a electron.exe con la cartella tra virgolette', cw.target.endsWith('electron.exe') && cw.args === '"C:\\Users\\studente\\Corso di Laurea\\Lode\\desktop"' && cw.cwd === 'C:\\Users\\studente\\Corso di Laurea\\Lode\\desktop' && cw.icon.endsWith('icon.ico') && cw.appUserModelId === cw.target);

  // Linux: .desktop secondo la specifica (prima \ " ` $ dentro le virgolette, poi ogni \ raddoppiata, % raddoppiato)
  const cl = '/home/studente/50% "x" $y/Lode/desktop', dl = C.fileLinux({ ...base('linux'), cartella: cl, argomenti: ['--no-sandbox'] });
  const exec = dl.match(/^Exec=(.*)$/m)[1];
  prova('linux: Exec scritto come chiede la specifica', exec.endsWith('"/home/studente/50%% \\\\"x\\\\" \\\\$y/Lode/desktop" "--no-sandbox"'), exec);
  prova('linux: Exec letto dal lanciatore dà la cartella intatta', JSON.stringify(leggiExec(exec).slice(1)) === JSON.stringify([cl, '--no-sandbox']), JSON.stringify(leggiExec(exec)));
  prova('linux: contrassegno e autostart solo nella copia per l\'accensione', dl.includes('X-Lode-Dal-Codice=true') && !C.fileLinux(base('linux')).includes('Autostart') && C.fileLinux(base('linux'), { autostart: true }).includes('X-GNOME-Autostart-enabled=true'));

  // Windows con il finto shell e il finto app (gira su ogni sistema)
  {
    const d = { ...base('win32'), eseguibile: 'C:\\Users\\studente\\Corso di Laurea\\Lode\\desktop\\node_modules\\electron\\dist\\electron.exe', cartella: join(T, 'win32', 'Corso di Laurea', 'Lode', 'desktop') };
    const [start, desk] = C.percorsi(d).icone;
    // l'installer aveva già messo il suo collegamento nel menu Start: non si tocca
    shell.writeShortcutLink(start, 'create', { target: join(d.appData, '..', 'Local', 'Programs', 'Lode', 'Lode.exe') });
    C.creaIcona(d, shell);
    prova('windows: il collegamento dell\'installer resta com\'era', shell.readShortcutLink(start).target.endsWith('Lode.exe') && !C.nostra(d, start, shell));
    prova('windows: il collegamento nostro sul desktop', C.nostra(d, desk, shell) && shell.readShortcutLink(desk).args === `"${d.cartella}"` && C.haIcona(d, shell) && C.puntaQui(d, shell));
    // l'avvio all'accensione: la cartella con lo spazio arriva tra virgolette (Electron non le mette)
    C.avvio(d, true, app);
    const reg = [...avvii.values()][0];
    prova('windows: avvio con la cartella tra virgolette', C.avvioAttivo(d, app) && reg.path === d.eseguibile && reg.args.length === 1 && reg.args[0] === `"${d.cartella}"`, JSON.stringify(reg));
    C.avvio(d, false, app);
    prova('windows: avvio spento', !C.avvioAttivo(d, app) && avvii.size === 0);
    // senza l'installer: tutti e due i collegamenti; lo studente toglie quello sul desktop, la cartella si sposta
    rmSync(start); C.creaIcona(d, shell); rmSync(desk);
    const spostata = { ...d, cartella: join(T, 'win32', 'altrove', 'Lode', 'desktop') };
    prova('windows: cartella spostata, il collegamento va aggiornato', !C.puntaQui(spostata, shell));
    const n = C.aggiornaIcona(spostata, shell);
    prova('windows: aggiornato solo il collegamento che c\'era, quello tolto non ricompare', n === 1 && shell.readShortcutLink(start).args === `"${spostata.cartella}"` && !existsSync(desk));
    prova('windows: alla seconda volta non riscrive niente', C.aggiornaIcona(spostata, shell) === 0);
    C.togliIcona(spostata, shell);
    prova('windows: tolto', !C.haIcona(spostata, shell) && !existsSync(start));
  }

  // Mac: una Lode.app vera (dell'installer) in ~/Applications non si tocca (solo file: gira su ogni sistema)
  {
    const d = base('darwin'), app0 = C.percorsi(d).icone[0];
    mkdirSync(join(app0, 'Contents', 'MacOS'), { recursive: true });
    writeFileSync(join(app0, 'Contents', 'Info.plist'), '<plist><dict><key>CFBundleIdentifier</key><string>it.lode.app</string></dict></plist>');
    writeFileSync(join(app0, 'Contents', 'MacOS', 'Lode'), 'binario vero');
    C.creaIcona(d); C.togliIcona(d);
    prova('mac: la Lode.app dell\'installer resta intatta', readFileSync(join(app0, 'Contents', 'MacOS', 'Lode'), 'utf8') === 'binario vero' && !C.haIcona(d));
    rmSync(app0, { recursive: true, force: true });
  }

  // sul computer vero (cartella temporanea): Mac e Linux, con il finto Electron
  const qui = process.platform === 'win32' ? null : process.platform === 'darwin' ? 'darwin' : 'linux';
  if (qui) {
    const uscita = join(T, 'argomenti.txt'), finto = join(T, 'electron');
    writeFileSync(finto, `#!/bin/bash\nfor a in "$@"; do printf '%s\\n' "$a"; done > ${JSON.stringify(uscita)}\n`); chmodSync(finto, 0o755);
    mkdirSync(join(strana, 'build'), { recursive: true }); writeFileSync(join(strana, 'build', 'icon.icns'), 'icns finto');
    const d = { ...base(qui), home: join(T, 'vero', 'casa'), eseguibile: finto };
    prova(`${qui}: prima non c'è`, !C.haIcona(d) && !C.avvioAttivo(d));
    C.creaIcona(d); C.avvio(d, true);
    prova(`${qui}: icona e avvio creati`, C.haIcona(d) && C.avvioAttivo(d) && C.puntaQui(d));
    if (qui === 'darwin') {
      const a = C.percorsi(d).icone[0];
      let lint = ''; try { lint = execFileSync('plutil', ['-lint', join(a, 'Contents', 'Info.plist'), C.percorsi(d).avvio], { encoding: 'utf8' }); } catch (e) { lint = String(e.stdout || e.message); }
      prova('mac: plist validi (plutil)', (lint.match(/: OK/g) || []).length === 2, lint);
      prova('mac: icona copiata', readFileSync(join(a, 'Contents', 'Resources', 'icona.icns'), 'utf8') === 'icns finto');
      execFileSync(join(a, 'Contents', 'MacOS', 'Lode'), ['--extra']);
    } else {
      const arg = leggiExec(readFileSync(C.percorsi(d).icone[0], 'utf8').match(/^Exec=(.*)$/m)[1]);
      execFileSync(arg[0], arg.slice(1));
      prova('linux: autostart con la stessa riga Exec', readFileSync(C.percorsi(d).avvio, 'utf8').includes(readFileSync(C.percorsi(d).icone[0], 'utf8').match(/^Exec=.*$/m)[0]));
    }
    const arg = readFileSync(uscita, 'utf8').split('\n').filter(Boolean);
    prova(`${qui}: Electron riceve la cartella intatta (spazi, apostrofo, virgolette, $)`, arg[0] === strana && (qui !== 'darwin' || arg[1] === '--extra'), JSON.stringify(arg));
    // la cartella si sposta: l'icona non punta più qui e si riscrive, anche l'avvio
    const spostata = { ...d, cartella: join(T, 'altrove', 'Lode', 'desktop') };
    prova(`${qui}: cartella spostata, l'icona va aggiornata`, C.haIcona(spostata) && !C.puntaQui(spostata));
    prova(`${qui}: riscritta una volta sola`, C.aggiornaIcona(spostata) === 1 && C.aggiornaIcona(spostata) === 0);
    prova(`${qui}: punta alla cartella nuova (anche l'avvio)`, C.puntaQui(spostata) && readFileSync(C.percorsi(d).avvio, 'utf8').includes(qui === 'darwin' ? 'Lode.app' : 'altrove'));
    C.togliIcona(d);
    // sul Mac l'avvio apre l'icona: senza icona si toglie anche lui; su Linux l'autostart è indipendente
    prova(`${qui}: icona tolta${qui === 'darwin' ? ', e con lei l\'avvio' : ''}`, !C.haIcona(d) && !existsSync(C.percorsi(d).icone[0]) && (qui === 'darwin' ? !C.avvioAttivo(d) : C.avvioAttivo(d)));
    C.avvio(d, false);
    prova(`${qui}: avvio tolto`, !C.avvioAttivo(d));
  }
} finally { rmSync(T, { recursive: true, force: true }); }
console.log(`collegamento: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
