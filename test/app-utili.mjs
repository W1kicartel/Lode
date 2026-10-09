// «Voglio fare…», la parte del processo principale (desktop/app-utili.mjs): node test/app-utili.mjs
// Le app lette da cartelle finte (Info.plist, .desktop, collegamenti .lnk), gli strumenti cercati nel PATH senza eseguirli,
// lo script del terminale con i casi cattivi (apici, $, backtick, spazi, a capo) lanciato davvero con sh e un «claude» finto
// che scrive i suoi argomenti su un file, e gli handler IPC in modalità finta (LODE_GUIDA_FINTA): niente app, niente
// terminali, niente claude veri.
import { realpathSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as U from '../desktop/app-utili.mjs';

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const T = mkdtempSync(join(tmpdir(), 'lode-app-utili-'));

/* ---------- Mac: le .app con il loro Info.plist ---------- */
const MAC = join(T, 'Applications');
const plist = (id, cat) => `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key>
  <string>${id}</string>
  ${cat ? `<key>LSApplicationCategoryType</key>\n  <string>${cat}</string>` : ''}
  <key>CFBundleName</key><string>X &amp; Y</string>
</dict></plist>`;
for (const [nome, id, cat, sotto] of [['Keynote', 'com.apple.iWork.Keynote', 'public.app-category.productivity'], ['Visual Studio Code', 'com.microsoft.VSCode', 'public.app-category.developer-tools'], ['Terminal', 'com.apple.Terminal', null, 'Utilities']]) {
  const d = join(MAC, ...(sotto ? [sotto] : []), nome + '.app', 'Contents'); mkdirSync(d, { recursive: true }); writeFileSync(join(d, 'Info.plist'), plist(id, cat));
}
mkdirSync(join(MAC, 'Senza plist.app'), { recursive: true });
prova('plist: legge id e categoria', U.leggiPlist(plist('a.b', 'public.app-category.video')).CFBundleIdentifier === 'a.b' && U.leggiPlist(plist('a.b', 'x')).CFBundleName === 'X & Y');
const BIN = join(T, 'bin'); mkdirSync(BIN);
const eseguibile = (nome, testo = '#!/bin/sh\nexit 0\n') => { writeFileSync(join(BIN, nome), testo); chmodSync(join(BIN, nome), 0o755); };
eseguibile('git'); eseguibile('python3'); eseguibile('code');
const mac = U.elenca({ piattaforma: 'darwin', casa: T, env: { LODE_APP_CARTELLE: MAC, PATH: BIN } });
const di = (l, n) => l.find(a => a.nome === n);
prova('mac: Keynote con id e categoria', di(mac, 'Keynote')?.id === 'com.apple.iWork.Keynote' && di(mac, 'Keynote')?.categoria === 'productivity', JSON.stringify(di(mac, 'Keynote')));
prova('mac: le app in una sottocartella (Utilities)', !!di(mac, 'Terminal'));
prova('mac: una .app senza Info.plist c\'è lo stesso', di(mac, 'Senza plist')?.id === null);
prova('mac: git e python3 dal PATH, come strumenti', di(mac, 'git')?.tipo === 'cli' && di(mac, 'python3')?.tipo === 'cli');
prova('mac: code non fa un doppione di Visual Studio Code', mac.filter(a => /Visual Studio Code/.test(a.nome)).length === 1 && di(mac, 'Visual Studio Code').tipo === 'app');
prova('mac: niente claude se non è nel PATH', !di(mac, 'Claude Code'));
prova('mac: aprire = open -a', JSON.stringify(U.comandoApri(di(mac, 'Keynote'), { piattaforma: 'darwin' })) === JSON.stringify({ cmd: 'open', args: ['-a', di(mac, 'Keynote').percorso] }));
prova('mac: uno strumento a riga di comando non si «apre»', U.comandoApri(di(mac, 'git'), { piattaforma: 'darwin' }) === null);

/* ---------- Linux: i file .desktop ---------- */
const LIN = join(T, 'linux-apps'); mkdirSync(LIN);
writeFileSync(join(LIN, 'org.kde.kdenlive.desktop'), '[Desktop Entry]\nType=Application\nName=Kdenlive\nName[it]=Kdenlive IT\nExec=kdenlive %F\nCategories=AudioVideo;Video;\n\n[Desktop Action nuovo]\nName=Nuovo\nExec=kdenlive --new\n');
writeFileSync(join(LIN, 'nascosta.desktop'), '[Desktop Entry]\nType=Application\nName=Nascosta\nExec=x\nNoDisplay=true\n');
writeFileSync(join(LIN, 'link.desktop'), '[Desktop Entry]\nType=Link\nName=Un link\nURL=https://example.org\n');
writeFileSync(join(LIN, 'libre.desktop'), '[Desktop Entry]\nType=Application\nName=LibreOffice Impress\nExec="/opt/libre office/impress" --impress %U\nCategories=Office;Presentation;\n');
const lin = U.elenca({ piattaforma: 'linux', casa: T, env: { LODE_APP_CARTELLE: LIN, PATH: BIN } });
prova('linux: Name senza lingua, Exec e categoria', di(lin, 'Kdenlive')?.exec === 'kdenlive %F' && di(lin, 'Kdenlive')?.categoria === 'AudioVideo', JSON.stringify(di(lin, 'Kdenlive')));
prova('linux: niente NoDisplay né Type=Link', !di(lin, 'Nascosta') && !di(lin, 'Un link'));
prova('linux: Exec con virgolette e codici di campo', JSON.stringify(U.parolaExec('"/opt/libre office/impress" --impress %U')) === JSON.stringify(['/opt/libre office/impress', '--impress']));
prova('linux: senza gtk-launch si lancia Exec', JSON.stringify(U.comandoApri(di(lin, 'LibreOffice Impress'), { piattaforma: 'linux', PATH: BIN })) === JSON.stringify({ cmd: '/opt/libre office/impress', args: ['--impress'] }));
eseguibile('gtk-launch');
prova('linux: con gtk-launch si usa l\'id', JSON.stringify(U.comandoApri(di(lin, 'Kdenlive'), { piattaforma: 'linux', PATH: BIN })) === JSON.stringify({ cmd: 'gtk-launch', args: ['org.kde.kdenlive'] }));

/* ---------- Windows: i collegamenti del menu Start ---------- */
const WIN1 = join(T, 'ProgramData', 'Start'), WIN2 = join(T, 'AppData', 'Start');
mkdirSync(join(WIN1, 'Microsoft Office'), { recursive: true }); mkdirSync(WIN2, { recursive: true });
writeFileSync(join(WIN1, 'Microsoft Office', 'PowerPoint.lnk'), 'x'); writeFileSync(join(WIN1, 'Microsoft Office', 'Uninstall Office.lnk'), 'x');
writeFileSync(join(WIN2, 'Spotify.lnk'), 'x'); writeFileSync(join(WIN2, 'leggimi.txt'), 'x');
const win = U.elenca({ piattaforma: 'win32', casa: T, env: { LODE_APP_CARTELLE: `${WIN1};${WIN2}`, PATH: '' } });
prova('windows: i .lnk di ProgramData e di AppData, anche nelle sottocartelle', !!di(win, 'PowerPoint') && !!di(win, 'Spotify'), JSON.stringify(win.map(a => a.nome)));
prova('windows: niente disinstallazioni né file che non sono collegamenti', !di(win, 'Uninstall Office') && !win.some(a => /leggimi/.test(a.nome)));
prova('windows: aprire = shell.openPath del collegamento', U.comandoApri(di(win, 'PowerPoint'), { piattaforma: 'win32' })?.percorso === di(win, 'PowerPoint').percorso);

/* ---------- l'escape ---------- */
const CATTIVI = ["it's", 'a"b', '$HOME', '`whoami`', '$(touch PWNED)', 'due  spazi', 'a\\b', '!bang', '; rm -rf x', 'riga\nnuova', "'; touch PWNED; '", '%PATH%', 'è ü ñ 漢字'];
prova('sh: apici singoli', U.quotaSh("it's") === `'it'\\''s'`);
prova('cmd: le virgolette e gli a capo si rifiutano', (() => { try { U.quotaCmd('a"b'); return false; } catch { return true; } })() && (() => { try { U.quotaCmd('a\nb'); return false; } catch { return true; } })());
prova('cmd: % raddoppiato', U.quotaCmd('C:\\a %PATH% b') === '"C:\\a %%PATH%% b"');
prova('powershell: apici raddoppiati, anche quelli tipografici', U.quotaPs("l'a’b") === "'l''a’’b'");
prova('agente sconosciuto: niente script', (() => { try { U.scriptTerminale({ piattaforma: 'darwin', cartella: '/x', fileTesto: '/y', agente: 'rm' }); return false; } catch { return true; } })());
prova('percorso con a capo: niente script', (() => { try { U.scriptTerminale({ piattaforma: 'darwin', cartella: '/x\ny', fileTesto: '/y', agente: 'claude' }); return false; } catch { return true; } })());

// il vero giro: lo script .command lanciato con sh, con un «claude» finto nel PATH che scrive cartella e argomenti
const USCITA = join(T, 'uscita.json');
eseguibile('claude', `#!/bin/sh\nnode -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }))' ${U.quotaSh(USCITA)} "$@"\n`);
const NODE_DIR = process.execPath.replace(/\/node$/, '');
for (const [k, cattivo] of CATTIVI.filter(c => !/\n/.test(c)).entries()) {
  const cartella = join(T, 'progetti', `p${k} ${cattivo.replace(/\//g, '_')}`); mkdirSync(cartella, { recursive: true });
  const testo = `Fai il passo: ${CATTIVI.join(' | ')}\nseconda riga con "virgolette" e 'apici'`;
  const g = join(T, `g${k}`); mkdirSync(g); const fileTesto = join(g, 'testo.txt'), script = join(g, 'avvia.command');
  writeFileSync(fileTesto, testo);
  const s = U.scriptTerminale({ piattaforma: 'darwin', cartella, fileTesto, agente: 'claude', script });
  prova(`mac: l'estensione è .command (${k})`, s.estensione === '.command');
  prova(`mac: il testo non è nello script (${k})`, !s.contenuto.includes('Fai il passo'));
  writeFileSync(script, s.contenuto, { mode: 0o700 });
  rmSync(USCITA, { force: true });
  execFileSync('/bin/sh', [script], { cwd: T, env: { PATH: `${BIN}:${NODE_DIR}:/usr/bin:/bin`, HOME: T }, timeout: 10000 });
  const r = existsSync(USCITA) ? JSON.parse(readFileSync(USCITA, 'utf8')) : null;
  prova(`sh: claude parte nella cartella «${cattivo}»`, r && r.cwd.normalize() === realpathSync(cartella).normalize(), JSON.stringify(r));
  prova(`sh: claude riceve il testo intero, come un argomento solo («${cattivo}»)`, r && r.args.length === 1 && r.args[0] === testo, JSON.stringify(r?.args));
  prova(`sh: niente comandi eseguiti dal testo o dal percorso («${cattivo}»)`, !existsSync(join(T, 'PWNED')) && !existsSync(join(cartella, 'PWNED')));
  prova(`sh: il file del testo e lo script si cancellano («${cattivo}»)`, !existsSync(fileTesto) && !existsSync(script));
}
// Windows: solo il testo dello script (qui non c'è cmd.exe)
const w = U.scriptTerminale({ piattaforma: 'win32', cartella: 'D:\\Corsi\\lab 1 %USERNAME% & echo', fileTesto: "C:\\Temp\\l'x\\testo.txt", agente: 'claude' });
prova('windows: .cmd con cd /d fra virgolette e % raddoppiato', w.estensione === '.cmd' && w.contenuto.includes('cd /d "D:\\Corsi\\lab 1 %%USERNAME%% & echo" || exit /b 1'), w.contenuto);
prova('windows: il testo lo legge PowerShell da un file, con l\'apice raddoppiato', w.contenuto.includes("-LiteralPath 'C:\\Temp\\l''x\\testo.txt'") && w.contenuto.includes('& claude $t'));
prova('windows: righe con a capo di Windows', w.contenuto.split('\r\n').length >= 4);
{ const e = U.scriptTerminale({ piattaforma: 'darwin', cartella: '/a', fileTesto: '/b', agente: 'claude', eseguibile: "/Users/<nome>/my apps/cl'aude" });
  prova('il percorso assoluto dell\'agente, fra apici', e.contenuto.includes(`'/Users/<nome>/my apps/cl'\\''aude' "$T"`)); }
{ const e = U.scriptTerminale({ piattaforma: 'win32', cartella: 'C:\\a', fileTesto: 'C:\\b', agente: 'claude', eseguibile: 'C:\\npm\\claude.cmd' });
  prova('windows: il percorso assoluto dell\'agente', e.contenuto.includes("& 'C:\\npm\\claude.cmd' $t")); }
prova('linux: .sh', U.scriptTerminale({ piattaforma: 'linux', cartella: '/a', fileTesto: '/b', agente: 'gemini' }).estensione === '.sh');
prova('terminale: Mac = open -a Terminal', JSON.stringify(U.comandoTerminale({ piattaforma: 'darwin', script: '/s.command' })) === JSON.stringify({ cmd: 'open', args: ['-a', 'Terminal', '/s.command'] }));
prova('terminale: Linux senza terminali = null', U.comandoTerminale({ piattaforma: 'linux', script: '/s.sh', PATH: join(T, 'vuoto') }) === null);
eseguibile('konsole');
prova('terminale: Linux con konsole', U.comandoTerminale({ piattaforma: 'linux', script: '/s.sh', PATH: BIN })?.cmd === 'konsole');

/* ---------- il progetto seguito che contiene la cartella ---------- */
const PR = { a1: { percorso: join(T, 'progetti'), nome: 'tutti' }, b2: { percorso: join(T, 'progetti', 'p0 it\'s'), nome: 'uno' } };
prova('progetto seguito: il più interno', U.progettoSeguito(join(T, 'progetti', "p0 it's", 'src'), PR) === 'b2');
prova('progetto seguito: nessuno fuori', U.progettoSeguito(T, PR) === null);

/* ---------- gli handler, in finto ---------- */
const H = {}, ipcMain = { handle: (c, f) => { H[c] = x => f(null, x); } };
const FINTA = join(T, 'finta.jsonl'), LAVORO = join(T, 'progetti', "p0 it's");
eseguibile('codex');
U.registra({ ipcMain, dialog: { showOpenDialog: () => { throw new Error('niente dialoghi nelle prove'); } }, shell: { openPath: () => { throw new Error('niente app vere'); } },
  app: { getPath: () => join(T, 'temp') }, conf: () => ({ progetti: PR }), t: k => k, casa: T,
  env: { LODE_GUIDA_FINTA: FINTA, LODE_APP_CARTELLE: MAC, LODE_GUIDA_CARTELLA: LAVORO, PATH: BIN } });
const elenco = await H['guida:app']();
prova('ipc: guida:app dà nomi e indici, niente percorsi', elenco.app.length > 3 && elenco.app.every(a => !('percorso' in a) && Number.isInteger(a.i)) && !JSON.stringify(elenco).includes(T), JSON.stringify(elenco).slice(0, 200));
prova('ipc: gli agenti nel PATH', JSON.stringify(elenco.agenti) === JSON.stringify(['claude', 'codex']), JSON.stringify(elenco.agenti));
const k = elenco.app.find(a => a.nome === 'Keynote').i;
prova('ipc: guida:apri in finto', (await H['guida:apri']({ i: k })).ok === true && readFileSync(FINTA, 'utf8').includes('"azione":"apri"'));
prova('ipc: un indice che non c\'è', !!(await H['guida:apri']({ i: 999 })).errore && !!(await H['guida:apri']({ i: '0' })).errore);
const c = await H['guida:cartella']();
prova('ipc: guida:cartella dà un token, il nome e il progetto seguito, non il percorso', /^[0-9a-f]{24}$/.test(c.token) && c.nome === "p0 it's" && c.seguita === 'b2' && !JSON.stringify(c).includes(T), JSON.stringify(c));
prova('ipc: guida:terminale senza token', !!(await H['guida:terminale']({ token: 'x', agente: 'claude', testo: 'ciao' })).errore);
prova('ipc: guida:terminale con un agente che non c\'è', !!(await H['guida:terminale']({ token: c.token, agente: 'gemini', testo: 'ciao' })).errore);
prova('ipc: guida:terminale con un comando inventato', !!(await H['guida:terminale']({ token: c.token, agente: 'rm', testo: 'ciao' })).errore);
const r = await H['guida:terminale']({ token: c.token, agente: 'claude', testo: "fai $(touch PWNED) e `id`" });
const riga = readFileSync(FINTA, 'utf8').trim().split('\n').map(x => JSON.parse(x)).find(x => x.azione === 'terminale');
prova('ipc: guida:terminale in finto scrive lo script e non apre niente', r.ok === true && riga?.agente === 'claude' && riga.cartella === LAVORO && existsSync(riga.script), JSON.stringify(riga));
if (riga) {
  const corpo = readFileSync(riga.script, 'utf8');
  prova('ipc: lo script non contiene il testo', !corpo.includes('PWNED') && !corpo.includes('`id`'));
  prova('ipc: lo script è solo dello studente (700)', process.platform === 'win32' || (Number(execFileSync('stat', process.platform === 'darwin' ? ['-f', '%Lp', riga.script] : ['-c', '%a', riga.script], { encoding: 'utf8' }).trim()) === 700));
}
prova('niente PWNED da nessuna parte', !existsSync(join(T, 'PWNED')) && !existsSync(join(LAVORO, 'PWNED')));

rmSync(T, { recursive: true, force: true });
console.log(`app-utili: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
