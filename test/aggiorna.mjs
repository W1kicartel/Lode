// Prove degli aggiornamenti (desktop/aggiorna.mjs), senza Electron e senza rete: node test/aggiorna.mjs
// Prima le funzioni pure (versioni semver con le prerelease, l'installer giusto dalla risposta di GitHub, la firma del Mac,
// i latest*.yml), poi registra() con un finto Electron: Mac senza firma (avviso + .dmg), Windows con un finto
// electron-updater (scarica, «pronta», Riavvia ora), spento, sviluppo e prove. Infine la configurazione che deve tenere
// insieme tutto: preload.cjs, package.json, entitlements e rilascio.yml.
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as AG from '../desktop/aggiorna.mjs';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett === '' ? '' : typeof dett === 'string' ? dett : JSON.stringify(dett)); } };
const lancia = f => { try { f(); return false; } catch { return true; } };

/* ---------- versioni ---------- */
// l'ordine di semver.org (§11), più qualche caso di Lode
const ORDINE = ['0.2.9', '0.3.0-alpha', '0.3.0-alpha.1', '0.3.0-alpha.beta', '0.3.0-beta', '0.3.0-beta.2', '0.3.0-beta.11', '0.3.0-rc.1', '0.3.0', '0.3.1', '0.9.0', '0.10.0', '1.0.0-0', '1.0.0-1', '1.0.0-a', '1.0.0'];
for (let i = 0; i < ORDINE.length; i++) for (let j = 0; j < ORDINE.length; j++) {
  const atteso = i < j ? -1 : i > j ? 1 : 0;
  prova(`confronta ${ORDINE[i]} ${ORDINE[j]}`, AG.confronta(ORDINE[i], ORDINE[j]) === atteso, AG.confronta(ORDINE[i], ORDINE[j]));
}
prova('la «v» del tag non conta', AG.confronta('v0.4.0', '0.4.0') === 0);
prova('il +build non conta', AG.confronta('1.2.3+7', '1.2.3+8') === 0 && AG.confronta('1.2.3-rc.1+x', '1.2.3-rc.1') === 0);
prova('numeri come numeri, non come testo', AG.confronta('0.10.0', '0.9.9') === 1 && AG.confronta('2.0.0', '10.0.0') === -1);
prova('leggiVersione', JSON.stringify(AG.leggiVersione('v1.2.3-beta.11')) === JSON.stringify({ numeri: [1, 2, 3], pre: ['beta', 11] }));
for (const x of ['', '1.2', '1.2.3.4', 'anteprima-12', '01.2.3', '1.2.3-', 'v', null, undefined, '1.2.3-be ta']) prova(`non è una versione: ${JSON.stringify(x)}`, AG.leggiVersione(x) === null);
prova('confronta con una versione illeggibile lancia', lancia(() => AG.confronta('anteprima-3', '0.3.0')));
prova('piuNuova', AG.piuNuova('0.3.0', '0.3.1') && !AG.piuNuova('0.3.0', '0.3.0') && !AG.piuNuova('0.4.0', '0.3.9') && AG.piuNuova('0.4.0-beta.1', '0.4.0'));
prova('piuNuova: illeggibile → no', !AG.piuNuova('0.3.0', 'anteprima-7') && !AG.piuNuova('boh', '9.9.9'));

/* ---------- la Release di GitHub ---------- */
const URL = n => `https://github.com/W1kicartel/Lode/releases/download/v0.4.0/${n}`;
const asset = (name, extra = {}) => ({ name, browser_download_url: URL(name), size: 1000 + name.length, state: 'uploaded', ...extra });
// come la risposta vera di /releases/latest dopo rilascio.yml (installer, blockmap, yml), con i campi che contano
const RELEASE = {
  tag_name: 'v0.4.0', name: 'Lode 0.4.0', draft: false, prerelease: false, html_url: 'https://github.com/W1kicartel/Lode/releases/tag/v0.4.0',
  assets: ['Lode-0.4.0-mac.dmg', 'Lode-0.4.0-mac.dmg.blockmap', 'Lode-0.4.0-windows.exe', 'Lode-0.4.0-windows.exe.blockmap', 'Lode-0.4.0-linux.AppImage', 'latest.yml', 'latest-mac.yml', 'latest-linux.yml'].map(n => asset(n)),
};
const sceglie = (rel, piattaforma, arch) => AG.scegliAsset(rel, { piattaforma, arch })?.nome ?? null;
prova('Mac Apple Silicon: il .dmg universale', sceglie(RELEASE, 'darwin', 'arm64') === 'Lode-0.4.0-mac.dmg');
prova('Mac Intel: lo stesso .dmg', sceglie(RELEASE, 'darwin', 'x64') === 'Lode-0.4.0-mac.dmg');
prova('Windows: il .exe, non il .blockmap', sceglie(RELEASE, 'win32', 'x64') === 'Lode-0.4.0-windows.exe');
prova('Windows ARM: l\'x64 (gira emulato)', sceglie(RELEASE, 'win32', 'arm64') === 'Lode-0.4.0-windows.exe');
prova('Windows a 32 bit: niente', sceglie(RELEASE, 'win32', 'ia32') === null);
prova('Linux x64: l\'AppImage', sceglie(RELEASE, 'linux', 'x64') === 'Lode-0.4.0-linux.AppImage');
prova('Linux ARM: l\'AppImage x64 non va', sceglie(RELEASE, 'linux', 'arm64') === null);
prova('sistema sconosciuto: niente', sceglie(RELEASE, 'freebsd', 'x64') === null);
prova('scegliAsset: peso e URL', JSON.stringify(AG.scegliAsset(RELEASE, { piattaforma: 'darwin', arch: 'arm64' })) === JSON.stringify({ nome: 'Lode-0.4.0-mac.dmg', url: URL('Lode-0.4.0-mac.dmg'), peso: 1000 + 18 }));
const PER_ARCH = { ...RELEASE, assets: ['Lode-0.4.0-mac-x64.dmg', 'Lode-0.4.0-mac-arm64.dmg', 'Lode-0.4.0-mac-universal.dmg', 'Lode-0.4.0-linux-x86_64.AppImage', 'Lode-0.4.0-linux-arm64.AppImage', 'Lode-0.4.0-windows-ia32.exe', 'Lode-0.4.0-windows-x64.exe'].map(n => asset(n)) };
prova('per architettura: Mac arm64', sceglie(PER_ARCH, 'darwin', 'arm64') === 'Lode-0.4.0-mac-arm64.dmg');
prova('per architettura: Mac x64', sceglie(PER_ARCH, 'darwin', 'x64') === 'Lode-0.4.0-mac-x64.dmg');
prova('per architettura: Linux arm64', sceglie(PER_ARCH, 'linux', 'arm64') === 'Lode-0.4.0-linux-arm64.AppImage');
prova('per architettura: Linux x86_64 = x64', sceglie(PER_ARCH, 'linux', 'x64') === 'Lode-0.4.0-linux-x86_64.AppImage');
prova('per architettura: Windows ia32', sceglie(PER_ARCH, 'win32', 'ia32') === 'Lode-0.4.0-windows-ia32.exe');
prova('Mac: universale se manca quella giusta', sceglie({ assets: [asset('Lode-0.4.0-mac-x64.dmg'), asset('Lode-0.4.0-mac-universal.dmg')] }, 'darwin', 'arm64') === 'Lode-0.4.0-mac-universal.dmg');
prova('un file ancora in caricamento non si propone', sceglie({ assets: [asset('Lode-0.4.0-mac.dmg', { state: 'starter' })] }, 'darwin', 'arm64') === null);
prova('un URL fuori dalle Release di Lode non si propone', sceglie({ assets: [asset('Lode-0.4.0-mac.dmg', { browser_download_url: 'https://esempio.it/Lode-0.4.0-mac.dmg' })] }, 'darwin', 'arm64') === null);
prova('nemmeno da un altro repository', sceglie({ assets: [asset('Lode-0.4.0-mac.dmg', { browser_download_url: 'https://github.com/altro/Lode/releases/download/v0.4.0/Lode-0.4.0-mac.dmg' })] }, 'darwin', 'arm64') === null);
prova('risposta strana: niente', sceglie(null, 'darwin', 'arm64') === null && sceglie({ assets: 'boh' }, 'win32', 'x64') === null && sceglie({ assets: [null, {}, { name: 'x.dmg' }] }, 'darwin', 'arm64') === null);
prova('urlSicuro', AG.urlSicuro(URL('a.dmg')) && !AG.urlSicuro('http://github.com/W1kicartel/Lode/releases/x') && !AG.urlSicuro('https://github.com/W1kicartel/Lode/issues') && !AG.urlSicuro(URL('a b.dmg')) && !AG.urlSicuro(42));
prova('urlSicuro: niente «..» né %2e che portano a un altro repository', !AG.urlSicuro('https://github.com/W1kicartel/Lode/releases/../../../attacker/evil/releases/download/v9/x.dmg') && !AG.urlSicuro('https://github.com/W1kicartel/Lode/releases/%2e%2e/%2e%2e/%2e%2e/attacker/evil/releases/download/v9/x.dmg') && !AG.urlSicuro('https://github.com/W1kicartel/Lode/releases/%2E%2E/x') && !AG.urlSicuro('https://github.com/W1kicartel/Lode/releases/download/v0.4.0/../../x.dmg') && AG.urlSicuro('https://github.com/W1kicartel/Lode/releases/latest'));

const propone = (rel, versione, piattaforma = 'darwin', arch = 'arm64') => AG.daProporre(rel, { versione, piattaforma, arch });
const p1 = propone(RELEASE, '0.3.0');
prova('daProporre: 0.4.0 su 0.3.0', p1 && p1.versione === '0.4.0' && p1.download === URL('Lode-0.4.0-mac.dmg') && p1.pagina === RELEASE.html_url && p1.peso > 0, p1);
prova('daProporre: già aggiornata', propone(RELEASE, '0.4.0') === null);
prova('daProporre: installata più nuova (anteprima locale)', propone(RELEASE, '0.5.0-beta.1') === null);
prova('daProporre: bozza mai', propone({ ...RELEASE, draft: true }, '0.3.0') === null);
prova('daProporre: prerelease non a chi ha la finale', propone({ ...RELEASE, tag_name: 'v0.4.0-beta.1', prerelease: true }, '0.3.0') === null);
prova('daProporre: prerelease a chi ha un\'anteprima', propone({ ...RELEASE, tag_name: 'v0.4.0-beta.2', prerelease: true }, '0.4.0-beta.1')?.versione === '0.4.0-beta.2');
prova('daProporre: tag «anteprima-12» ignorato', propone({ ...RELEASE, tag_name: 'anteprima-12' }, '0.3.0') === null);
prova('daProporre: tag senza «v»', propone({ ...RELEASE, tag_name: '0.4.0' }, '0.3.0')?.versione === '0.4.0');
prova('daProporre: pagina strana → la pagina delle Release', propone({ ...RELEASE, html_url: 'https://esempio.it' }, '0.3.0')?.pagina === 'https://github.com/W1kicartel/Lode/releases/latest');
prova('daProporre: senza installer per questo computer resta la pagina', (x => x && x.download === null && x.pagina === RELEASE.html_url)(propone(RELEASE, '0.3.0', 'linux', 'arm64')));
prova('daProporre: risposta vuota o di errore', propone(null, '0.3.0') === null && propone({ message: 'Not Found' }, '0.3.0') === null && propone('testo', '0.3.0') === null);

/* ---------- firma del Mac, modo, pacchetto ---------- */
// uscite vere di «codesign -dv --verbose=2» (stderr): Lode 0.3.0 firmata ad hoc, e una app con Developer ID
const ADHOC = 'Executable=/Applications/Lode.app/Contents/MacOS/Lode\nIdentifier=it.lode.app\nFormat=app bundle with Mach-O universal (x86_64 arm64)\nCodeDirectory v=20400 size=520 flags=0x2(adhoc) hashes=5+7 location=embedded\nSignature=adhoc\nInfo.plist entries=29\nTeamIdentifier=not set\nSealed Resources version=2 rules=13 files=210\nInternal requirements count=0 size=12\n';
const DEVID = 'Executable=/Applications/Lode.app/Contents/MacOS/Lode\nIdentifier=it.lode.app\nFormat=app bundle with Mach-O universal (x86_64 arm64)\nCodeDirectory v=20500 size=520 flags=0x10000(runtime) hashes=5+7 location=embedded\nSignature size=9035\nAuthority=Developer ID Application: Mario Rossi (AB12CD34EF)\nAuthority=Developer ID Certification Authority\nAuthority=Apple Root CA\nTimestamp=2 ott 2026, 19:20:00\nNotarization Ticket=stapled\nInfo.plist entries=29\nTeamIdentifier=AB12CD34EF\nRuntime Version=15.0.0\n';
prova('firma ad hoc: non è Developer ID', !AG.firmaDeveloperId(ADHOC));
prova('firma Developer ID', AG.firmaDeveloperId(DEVID));
prova('firma: niente uscita (non firmata) → no', !AG.firmaDeveloperId('') && !AG.firmaDeveloperId('code object is not signed at all') && !AG.firmaDeveloperId(null));
prova('firma: «Apple Development» non basta', !AG.firmaDeveloperId(DEVID.replace('Developer ID Application', 'Apple Development')));
const M = (piattaforma, impacchettata, env = {}, firmaMac = false) => AG.modo({ piattaforma, impacchettata, env, firmaMac });
prova('modo: sviluppo → niente', M('darwin', false) === null && M('win32', false) === null && M('linux', false, { APPIMAGE: '/x' }) === null);
prova('modo: prove → niente', M('win32', true, { LODE_PROVA: 'passi.json' }) === null && M('darwin', true, { LODE_CI: '1' }, true) === null);
prova('modo: Windows automatico', M('win32', true) === 'automatico');
prova('modo: Linux AppImage automatico, altrimenti avviso', M('linux', true, { APPIMAGE: '/home/s/Lode.AppImage' }) === 'automatico' && M('linux', true) === 'manuale');
prova('modo: Mac ad hoc → avviso, Developer ID → automatico', M('darwin', true) === 'manuale' && M('darwin', true, {}, true) === 'automatico');
prova('pacchettoMac', AG.pacchettoMac('/Applications/Lode.app/Contents/MacOS/Lode') === '/Applications/Lode.app' && AG.pacchettoMac('/Users/s/Applications/Lode 2.app/Contents/MacOS/Lode') === '/Users/s/Applications/Lode 2.app');
prova('intervalli: poco dopo l\'avvio, poi ogni 6 ore', AG.PRIMO_CONTROLLO > 0 && AG.PRIMO_CONTROLLO <= 5 * 60e3 && AG.OGNI === 6 * 3600e3);

/* ---------- latest*.yml ---------- */
const sha = b => createHash('sha512').update(b).digest('base64');
const EXE = Buffer.from('installer finto di Lode per Windows'), BM = Buffer.from('blockmap');
// come lo scrive electron-builder 26 (latest.yml di NSIS)
const YML = `version: 0.4.0\nfiles:\n  - url: Lode-0.4.0-windows.exe\n    sha512: ${sha(EXE)}\n    size: ${EXE.length}\npath: Lode-0.4.0-windows.exe\nsha512: ${sha(EXE)}\nreleaseDate: '2026-10-02T17:20:00.000Z'\n`;
const y = AG.leggiYml(YML);
prova('leggiYml', y.versione === '0.4.0' && y.file.length === 1 && y.file[0].url === 'Lode-0.4.0-windows.exe' && y.file[0].size === EXE.length && y.path === 'Lode-0.4.0-windows.exe' && y.sha512 === sha(EXE), y);
const YML_MAC = `version: 0.4.0\nfiles:\n  - url: Lode-0.4.0-mac.zip\n    sha512: AAA\n    size: 10\n    blockMapSize: 3\n  - url: Lode-0.4.0-mac.dmg\n    sha512: BBB\n    size: 20\npath: Lode-0.4.0-mac.zip\nsha512: AAA\nreleaseDate: '2026-10-02T17:20:00.000Z'\n`;
prova('leggiYml: due file (zip e dmg) e campi in più', (x => x.file.length === 2 && x.file[1].url === 'Lode-0.4.0-mac.dmg' && x.file[1].sha512 === 'BBB' && x.file[0].size === 10)(AG.leggiYml(YML_MAC)));
prova('leggiYml: a capo di Windows e virgolette', AG.leggiYml(YML.replace(/\n/g, '\r\n').replace('version: 0.4.0', "version: '0.4.0'")).versione === '0.4.0');
const info = mappa => n => mappa[n] ? { size: mappa[n].length, sha512: sha(mappa[n]) } : null;
prova('problemiYml: tutto a posto', AG.problemiYml('latest.yml', YML, info({ 'Lode-0.4.0-windows.exe': EXE }), '0.4.0').length === 0);
prova('problemiYml: installer firmato dopo il yml', AG.problemiYml('latest.yml', YML, info({ 'Lode-0.4.0-windows.exe': Buffer.concat([EXE, BM]) })).some(p => /sha512/.test(p) && /non combacia/.test(p)));
prova('problemiYml: file che manca', AG.problemiYml('latest.yml', YML, info({})).some(p => /non c'è/.test(p)));
prova('problemiYml: versione diversa dal tag', AG.problemiYml('latest.yml', YML, info({ 'Lode-0.4.0-windows.exe': EXE }), '0.4.1').some(p => /0\.4\.1/.test(p)));
prova('problemiYml: nome con spazi o cartelle', AG.problemiYml('latest.yml', YML.replace(/Lode-0\.4\.0-windows\.exe/g, 'Lode 0.4.0.exe'), info({})).some(p => /nome di file semplice/.test(p)) && AG.problemiYml('latest.yml', YML.replace(/url: Lode/, 'url: ../Lode'), info({})).some(p => /nome di file semplice/.test(p)));
prova('problemiYml: path fuori dai file', AG.problemiYml('latest.yml', YML.replace(/^path: .*$/m, 'path: altro.exe'), info({ 'Lode-0.4.0-windows.exe': EXE })).some(p => /path/.test(p)));
prova('problemiYml: yml vuoto', AG.problemiYml('latest.yml', '', info({})).length >= 2);

// verifica-rilascio.mjs su una cartella vera, come in rilascio.yml
const tmp = mkdtempSync(join(tmpdir(), 'lode-aggiorna-'));
try {
  writeFileSync(join(tmp, 'Lode-0.4.0-windows.exe'), EXE); writeFileSync(join(tmp, 'latest.yml'), YML);
  const vr = (...a) => spawnSync(process.execPath, [join(RADICE, 'desktop', 'verifica-rilascio.mjs'), tmp, ...a], { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } });
  let r = vr('0.4.0');
  prova('verifica-rilascio: cartella giusta → 0', r.status === 0 && /✓ latest\.yml/.test(r.stdout), r.stdout + r.stderr);
  r = vr('0.4.0', '--tutti');
  prova('verifica-rilascio --tutti: mancano mac e linux → 1', r.status === 1 && /latest-mac\.yml/.test(r.stderr) && /latest-linux\.yml/.test(r.stderr), r.stderr);
  r = vr('0.5.0');
  prova('verifica-rilascio: tag diverso dalla versione → 1', r.status === 1, r.stderr);
  writeFileSync(join(tmp, 'Lode-0.4.0-windows.exe'), Buffer.concat([EXE, BM]));
  r = vr();
  prova('verifica-rilascio: installer cambiato dopo il yml → 1', r.status === 1 && /sha512/.test(r.stderr), r.stderr);
  rmSync(join(tmp, 'latest.yml'));
  r = vr();
  prova('verifica-rilascio: nessun yml → 1', r.status === 1 && /publish/.test(r.stderr), r.stderr);
} finally { rmSync(tmp, { recursive: true, force: true }); }

/* ---------- registra(): con un finto Electron ---------- */
const attendi = ms => new Promise(r => setTimeout(r, ms));
function finto({ piattaforma = 'darwin', arch = 'arm64', impacchettata = true, env = {}, firma = ADHOC, risposte = [], conf = {}, aggiornatore } = {}) {
  const canali = new Map(), mandati = [], aperti = [], richieste = [], timer = [];
  let salvataggi = 0, uscite = 0, annullate = 0;
  const ascolti = {};
  const net = { fetch: async (url, opz) => { richieste.push({ url, opz }); const r = risposte.shift(); if (r instanceof Error) throw r;
    if (r === 'appesa') return new Promise((_, no) => opz.signal.addEventListener('abort', () => no(new Error('This operation was aborted'))));   // la rete che non risponde mai
    return { status: r.status ?? 200, ok: (r.status ?? 200) < 300, json: async () => r.json }; } };
  const orologio = {
    setTimeout: (f, ms) => { const t = { f, ms, tipo: 'una' }; timer.push(t); if (ms <= 1000) setTimeout(f, 5); return t; },
    setInterval: (f, ms) => { const t = { f, ms, tipo: 'sempre' }; timer.push(t); return t; },
    clearTimeout: t => { if (t) t.tolto = true; }, clearInterval: t => { if (t) t.tolto = true; },
  };
  const app = { isPackaged: impacchettata, getVersion: () => '0.3.0', getPath: () => '/Applications/Lode.app/Contents/MacOS/Lode', on: (ev, f) => { (ascolti[ev] ||= []).push(f); } };
  const ipcMain = { handle: (c, f) => canali.set(c, f) };
  const A = AG.registra({ ipcMain, app, net, shell: { openExternal: async u => { aperti.push(u); } }, conf: () => conf, salvaConf: () => { salvataggi++; },
    manda: (c, x) => mandati.push([c, x]), primaDiUscire: () => { uscite++; }, annullaUscita: () => { annullate++; }, env, piattaforma, arch, leggiFirma: async () => firma, orologio,
    aggiornatore: aggiornatore || (async () => { throw new Error('electron-updater non dovrebbe servire qui'); }) });
  const invoca = (c, x) => canali.get(c)(null, x);
  const esci = () => (ascolti['before-quit'] || []).forEach(f => f());
  return { A, canali, mandati, aperti, richieste, timer, invoca, conf, esci, salvataggi: () => salvataggi, uscite: () => uscite, annullate: () => annullate };
}

// sviluppo e prove: niente controlli, niente timer, niente rete
for (const [nome, o] of [['sviluppo', { impacchettata: false }], ['prove (LODE_PROVA)', { env: { LODE_PROVA: '/tmp/passi.json' } }], ['prove (LODE_CI)', { piattaforma: 'win32', env: { LODE_CI: '1' } }]]) {
  const f = finto(o); await f.A.avviato;
  const s = await f.invoca('aggiorna:stato');
  await f.A.controlla();
  prova(`${nome}: spento del tutto`, !s.possibile && s.modo === null && !f.timer.length && !f.richieste.length, { s, timer: f.timer.length, rich: f.richieste.length });
}

// Mac senza firma: chiede a GitHub, avvisa, apre il .dmg
{
  const f = finto({ risposte: [{ json: RELEASE }] }); await f.A.avviato;
  prova('Mac ad hoc: modo manuale', (await f.invoca('aggiorna:stato')).modo === 'manuale');
  const t1 = f.timer.find(t => t.tipo === 'una'), t2 = f.timer.find(t => t.tipo === 'sempre');
  prova('Mac: primo controllo poco dopo l\'avvio, poi ogni 6 ore', t1?.ms === AG.PRIMO_CONTROLLO && t2?.ms === AG.OGNI, f.timer);
  prova('Mac: niente rete prima del primo controllo', !f.richieste.length);
  const s = await f.A.controlla();
  prova('Mac: una sola richiesta, all\'API delle Release di Lode', f.richieste.length === 1 && f.richieste[0].url === 'https://api.github.com/repos/W1kicartel/Lode/releases/latest', f.richieste);
  const h = f.richieste[0]?.opz?.headers || {};
  prova('Mac: nella richiesta solo User-Agent e formato, niente identificativi', JSON.stringify(Object.keys(h).sort()) === JSON.stringify(['Accept', 'User-Agent', 'X-GitHub-Api-Version']) && h['User-Agent'] === 'Lode/0.3.0', h);
  prova('Mac: «da scaricare» 0.4.0', s.fase === 'da_scaricare' && s.nuova?.versione === '0.4.0', s);
  prova('Mac: la barra lo sa', f.mandati.some(([c, x]) => c === 'aggiorna:cambiato' && x.fase === 'da_scaricare'));
  const r = await f.invoca('aggiorna:scarica');
  prova('Mac: «Scarica» apre il .dmg di GitHub', r.ok && f.aperti.length === 1 && f.aperti[0] === URL('Lode-0.4.0-mac.dmg'), { r, aperti: f.aperti });
  const rr = await f.invoca('aggiorna:riavvia');
  prova('Mac ad hoc: niente «Riavvia ora»', !!rr.errore && !f.uscite());
}
{
  const f = finto({ risposte: [{ status: 404, json: { message: 'Not Found' } }] }); await f.A.avviato;
  const s = await f.A.controlla();
  prova('Mac: nessuna Release ancora → aggiornata, niente da aprire', s.fase === 'aggiornata' && !s.nuova && !!(await f.invoca('aggiorna:scarica')).errore && !f.aperti.length, s);
}
{
  const f = finto({ risposte: [new Error('net::ERR_INTERNET_DISCONNECTED'), { status: 403, json: {} }, { json: { ...RELEASE, tag_name: 'v0.3.0' } }] }); await f.A.avviato;
  let s = await f.A.controlla();
  prova('Mac: senza rete → errore, si riprova dopo', s.fase === 'errore' && /DISCONNECTED/.test(s.errore), s);
  s = await f.A.controlla();
  prova('Mac: GitHub che rifiuta (limite) → errore', s.fase === 'errore' && /403/.test(s.errore), s);
  s = await f.A.controlla();
  prova('Mac: stessa versione → aggiornata', s.fase === 'aggiornata' && !s.nuova, s);
}
{
  const f = finto({ risposte: ['appesa', { json: RELEASE }] }); await f.A.avviato;
  const c = f.A.controlla(); await attendi(10);
  const limite = f.timer.find(t => t.ms === 30e3);
  prova('Mac: ogni richiesta ha un tempo massimo di 30 s', !!limite && f.A.stato().fase === 'controllo', f.timer.map(t => t.ms));
  limite?.f();
  const s = await c;
  prova('Mac: rete appesa → errore dopo il tempo massimo, e il controllo dopo riparte', s.fase === 'errore' && /abort/i.test(s.errore) && limite?.tolto === true, s);
  prova('Mac: il giro dopo funziona', (await f.A.controlla()).fase === 'da_scaricare');
}

// Windows: un finto electron-updater. computeFinalHeaders come in electron-updater 6.8 (AppUpdater.js): aggiunge requestHeaders.
// electron-updater vero, se c'è (desktop/node_modules), si prova più sotto; su GitHub questo lavoro non fa npm ci
let EU = null;
try { const r = createRequire(join(RADICE, 'desktop', 'package.json')); EU = { NsisUpdater: r('electron-updater/out/NsisUpdater').NsisUpdater }; } catch { }
function aggiornatoreFinto({ esito = 'nuova' } = {}) {
  const u = new EventEmitter();
  u.controlli = 0; u.installa = [];
  u.checkForUpdates = async () => {
    u.controlli++; u.emit('checking-for-update');
    if (esito === 'errore') { const e = new Error(esito === 'errore' ? 'ZIP file not provided: Lode-0.4.0-mac.dmg' : ''); u.emit('error', e); throw e; }
    if (esito === 'uguale') { u.emit('update-not-available', { version: '0.3.0' }); return { updateInfo: { version: '0.3.0' } }; }
    u.emit('update-available', { version: '0.4.0' });
    const downloadPromise = (async () => { for (const p of [10, 12, 40, 80, 100]) u.emit('download-progress', { percent: p }); u.emit('update-downloaded', { version: '0.4.0' }); return []; })();
    return { updateInfo: { version: '0.4.0' }, downloadPromise };
  };
  u.quitAndInstall = (...a) => u.installa.push(a);
  u.computeFinalHeaders = function (h) { if (this.requestHeaders != null) Object.assign(h, this.requestHeaders); return h; };
  u.requestHeaders = { 'X-Altro': 'resta' };
  return u;
}
{
  const u = aggiornatoreFinto(), f = finto({ piattaforma: 'win32', arch: 'x64', aggiornatore: async () => u }); await f.A.avviato;
  prova('Windows: modo automatico, scarica e installa all\'uscita', (await f.invoca('aggiorna:stato')).modo === 'automatico' && u.autoDownload === true && u.autoInstallOnAppQuit === true);
  prova('Windows: electron-updater senza log rumorosi', typeof u.logger?.info === 'function');
  const intest = u.computeFinalHeaders({ 'x-user-staging-id': '77f73fba-98b6-4c1e-9d5e-000000000000' }), scarico = u.computeFinalHeaders({ accept: '*/*' });
  prova('Windows: niente identificativo fisso verso GitHub (x-user-staging-id tolto)', !('x-user-staging-id' in intest) && intest['X-Altro'] === 'resta' && scarico.accept === '*/*', intest);
  await f.A.controlla(); await attendi(20);
  const s = f.A.stato();
  prova('Windows: scaricata → «pronta» 0.4.0', s.fase === 'pronta' && s.nuova?.versione === '0.4.0' && s.p === 1, s);
  prova('Windows: niente richieste fatte a mano (le fa electron-updater)', !f.richieste.length);
  const fasi = f.mandati.map(([, x]) => x.fase);
  prova('Windows: la barra vede controllo → scarico → pronta', fasi.includes('controllo') && fasi.includes('scarico') && fasi.at(-1) === 'pronta', fasi);
  prova('Windows: l\'avanzamento non arriva a ogni pezzo', f.mandati.filter(([, x]) => x.fase === 'scarico').length <= 5, f.mandati.length);
  await f.A.controlla();
  prova('Windows: pronta → non ricontrolla', u.controlli === 1, u.controlli);
  const r = await f.invoca('aggiorna:riavvia'); await attendi(20);
  prova('Windows: «Riavvia ora» salva i dati e installa in silenzio, poi riparte', r.ok && f.uscite() === 1 && JSON.stringify(u.installa) === JSON.stringify([[true, true]]), { r, installa: u.installa });
  // l'installer non parte (quitAndInstall non esce): dopo 10 s la barra torna come prima e lo stato lo dice
  const attesa = f.timer.filter(t => t.ms === 10e3 && !t.tolto).at(-1);
  prova('Windows: «Riavvia ora» aspetta l\'uscita al massimo 10 s', !!attesa && f.annullate() === 0);
  attesa?.f();
  prova('Windows: Lode non esce → annullaUscita, resta pronta con l\'errore', f.annullate() === 1 && f.A.stato().fase === 'pronta' && /non si è installato/.test(f.A.stato().errore || ''), f.A.stato());
  // un errore di electron-updater durante «Riavvia ora» (installer sparito): subito, senza aspettare i 10 s
  await f.invoca('aggiorna:riavvia'); await attendi(20);
  u.emit('error', new Error('No update filepath provided, can\'t quit and install'));
  prova('Windows: errore all\'installazione → annullaUscita subito', f.annullate() === 2 && f.A.stato().fase === 'pronta' && /filepath/.test(f.A.stato().errore || ''), f.A.stato());
  // se invece Lode esce davvero (before-quit), niente annullaUscita
  await f.invoca('aggiorna:riavvia'); await attendi(20); f.esci();
  f.timer.filter(t => t.ms === 10e3 && !t.tolto).at(-1)?.f();
  prova('Windows: Lode che esce davvero non viene trattenuta', f.annullate() === 2, f.annullate());
}
{
  const u = aggiornatoreFinto(), f = finto({ piattaforma: 'win32', arch: 'x64', aggiornatore: async () => u, conf: { vault: '/v' } }); await f.A.avviato;
  let s = await f.invoca('aggiorna:imposta', { attivi: false });
  prova('spenti: conf.aggiornamenti = false, salvato', s.attivi === false && f.conf.aggiornamenti === false && f.salvataggi() === 1 && f.conf.vault === '/v', s);
  prova('spenti: non scarica e non installa all\'uscita', u.autoDownload === false && u.autoInstallOnAppQuit === false);
  prova('spenti: i timer si fermano', f.timer.every(t => t.tolto), f.timer);
  await f.A.controlla();
  prova('spenti: nessun controllo', u.controlli === 0);
  s = await f.invoca('aggiorna:imposta', { attivi: true }); await attendi(20);
  prova('riaccesi: controlla subito e riparte', s.attivi === true && f.conf.aggiornamenti === true && u.controlli === 1 && u.autoDownload === true && f.A.stato().fase === 'pronta', { s, c: u.controlli });
}
{
  const u = aggiornatoreFinto(), f = finto({ piattaforma: 'win32', arch: 'x64', aggiornatore: async () => u, conf: { aggiornamenti: false } }); await f.A.avviato;
  prova('spenti da prima: nessun timer, nessun controllo', !f.timer.length && f.A.stato().attivi === false && u.autoDownload === false);
}
{
  // spenti mentre electron-updater trova una versione (autoDownload falso): niente «scarico» bloccato, e riaccesi riparte
  const u = aggiornatoreFinto(), f = finto({ piattaforma: 'win32', arch: 'x64', aggiornatore: async () => u }); await f.A.avviato;
  await f.invoca('aggiorna:imposta', { attivi: false });
  u.emit('update-available', { version: '0.4.0' });
  prova('spenti: una versione trovata non lascia «scarico»', f.A.stato().fase === 'fermo' && !f.A.stato().nuova, f.A.stato());
  await f.invoca('aggiorna:imposta', { attivi: true }); await attendi(20);
  prova('riaccesi dopo: scarica e diventa pronta', f.A.stato().fase === 'pronta', f.A.stato());
}
{
  const u = aggiornatoreFinto({ esito: 'uguale' }), f = finto({ piattaforma: 'linux', arch: 'x64', env: { APPIMAGE: '/home/s/Lode.AppImage' }, aggiornatore: async () => u }); await f.A.avviato;
  const s = await f.A.controlla();
  prova('Linux AppImage: automatico, già aggiornata', s.modo === 'automatico' && s.fase === 'aggiornata', s);
}
{
  const errore = console.error; console.error = () => { };   // l'errore qui è voluto: non sporca l'uscita delle prove
  const f = finto({ piattaforma: 'win32', arch: 'x64', risposte: [{ json: { ...RELEASE } }], aggiornatore: async () => { throw new Error('Cannot find module electron-updater'); } }); await f.A.avviato;
  console.error = errore;
  const s = await f.A.controlla();
  prova('electron-updater che non si carica: almeno l\'avviso col .exe', s.modo === 'manuale' && s.fase === 'da_scaricare' && (await f.invoca('aggiorna:scarica')).ok && f.aperti[0] === URL('Lode-0.4.0-windows.exe'), { s, aperti: f.aperti });
}
{
  // Mac firmato (Developer ID): electron-updater; se la Release non ha il .zip, si torna al .dmg
  const u = aggiornatoreFinto({ esito: 'errore' }), f = finto({ firma: DEVID, risposte: [{ json: RELEASE }], aggiornatore: async () => u }); await f.A.avviato;
  prova('Mac Developer ID: modo automatico', (await f.invoca('aggiorna:stato')).modo === 'automatico');
  await f.A.controlla(); await attendi(40);
  const s = f.A.stato();
  prova('Mac firmato senza .zip nella Release: torna all\'avviso col .dmg', s.modo === 'manuale' && s.fase === 'da_scaricare' && f.richieste.length === 1, s);
}

if (!EU) console.log('saltata: electron-updater vero senza x-user-staging-id (manca desktop/node_modules: cd desktop && npm ci)');
else {
  // il NsisUpdater vero di electron-updater, senza rete (un esecutore HTTP finto che guarda le intestazioni e poi fallisce):
  // la richiesta a github.com/W1kicartel/Lode/releases.atom non deve portare l'identificativo fisso di userData/.updaterId
  const { NsisUpdater } = EU;
  const cart = mkdtempSync(join(tmpdir(), 'lode-updater-'));
  writeFileSync(join(cart, 'app-update.yml'), 'provider: github\nowner: W1kicartel\nrepo: Lode\n');
  const appFinta = { version: '0.3.0', name: 'Lode', isPackaged: true, appUpdateConfigPath: join(cart, 'app-update.yml'), userDataPath: join(cart, 'dati'), baseCachePath: join(cart, 'cache'), whenReady: () => Promise.resolve(), quit() { }, relaunch() { }, onQuit() { } };
  const u = new NsisUpdater(undefined, appFinta), viste = [];
  u.httpExecutor = { request: async o => { viste.push({ url: `${o.protocol}//${o.hostname}${o.path}`, intest: { ...o.headers } }); throw new Error('niente rete nelle prove'); } };
  const zitto = console.error; console.error = () => { };
  try {
    const f = finto({ piattaforma: 'win32', arch: 'x64', aggiornatore: async () => u }); await f.A.avviato;
    await u.checkForUpdates().catch(() => { });
  } finally { console.error = zitto; }
  prova('electron-updater vero: chiede a GitHub senza x-user-staging-id', viste.length === 1 && /github\.com\/W1kicartel\/Lode\/releases\.atom/.test(viste[0].url) && !Object.keys(viste[0].intest).some(k => /staging/i.test(k)), viste);
  rmSync(cart, { recursive: true, force: true });
}

/* ---------- la configurazione che tiene insieme tutto ---------- */
const PRELOAD = readFileSync(join(RADICE, 'desktop', 'preload.cjs'), 'utf8');
const lista = nome => JSON.parse(PRELOAD.match(new RegExp(`const ${nome} = (\\[[\\s\\S]*?\\]);`))[1].replace(/\/\/.*$/gm, '').replace(/'/g, '"'));
const OUT = lista('OUT'), IN = lista('IN');
const canali = [...finto().canali.keys()];
prova('preload: ogni canale aggiorna:* è nella lista bianca', canali.length >= 4 && canali.every(c => OUT.includes(c)), { canali, mancano: canali.filter(c => !OUT.includes(c)) });
prova('preload: nessun canale aggiorna:* in più', OUT.filter(c => c.startsWith('aggiorna:')).every(c => canali.includes(c)));
prova('preload: aggiorna:cambiato arriva alla barra', IN.includes('aggiorna:cambiato'));
const PKG = JSON.parse(readFileSync(join(RADICE, 'desktop', 'package.json'), 'utf8')), B = PKG.build;
prova('package.json: electron-updater fra le dipendenze di produzione, versione fissa', /^\d+\.\d+\.\d+$/.test(PKG.dependencies?.['electron-updater'] || ''), PKG.dependencies);
const LOCK = JSON.parse(readFileSync(join(RADICE, 'desktop', 'package-lock.json'), 'utf8'));
prova('package-lock: electron-updater c\'è, con la stessa versione', LOCK.packages?.['node_modules/electron-updater']?.version === PKG.dependencies?.['electron-updater'] && LOCK.packages?.['']?.dependencies?.['electron-updater'] === PKG.dependencies?.['electron-updater']);
const runtimeUpdater = LOCK.packages?.['node_modules/electron-updater']?.dependencies?.['builder-util-runtime'], runtimeBuilder = LOCK.packages?.['node_modules/builder-util-runtime']?.version;
prova('electron-updater e electron-builder usano lo stesso builder-util-runtime', !!runtimeUpdater && runtimeUpdater === runtimeBuilder, { runtimeUpdater, runtimeBuilder });
const pub = [].concat(B.publish || [])[0] || {};
prova('package.json: publish su GitHub, W1kicartel/Lode', pub.provider === 'github' && pub.owner === AG.PROPRIETARIO && pub.repo === AG.REPO, B.publish);
prova('package.json: aggiorna.mjs dentro il pacchetto, verifica-rilascio no', B.files.includes('aggiorna.mjs') && !B.files.includes('verifica-rilascio.mjs'));
prova('package.json: niente identity «-» fissa (si passa da riga di comando)', !('identity' in B.mac), B.mac.identity);
prova('package.json: hardenedRuntime con gli entitlements', B.mac.hardenedRuntime === true && B.mac.entitlements === 'build/entitlements.mac.plist' && B.mac.entitlementsInherit === 'build/entitlements.mac.plist');
prova('package.json: dist:mac resta firmato ad hoc', /-c\.mac\.identity=-/.test(PKG.scripts['dist:mac']) && /-c\.mac\.hardenedRuntime=false/.test(PKG.scripts['dist:mac']));
const ENT = join(RADICE, 'desktop', 'build', 'entitlements.mac.plist');
const ent = existsSync(ENT) ? readFileSync(ENT, 'utf8') : '';
for (const k of ['com.apple.security.device.audio-input', 'com.apple.security.cs.allow-jit', 'com.apple.security.cs.allow-unsigned-executable-memory', 'com.apple.security.cs.disable-library-validation'])
  prova(`entitlements: ${k}`, new RegExp(`<key>${k.replace(/\./g, '\\.')}</key>\\s*<true/>`).test(ent));
prova('entitlements: niente sandbox (Lode installa Obsidian e Ollama, segue cartelle)', !/app-sandbox/.test(ent));
const RIL = readFileSync(join(RADICE, '.github', 'workflows', 'rilascio.yml'), 'utf8');
prova('rilascio.yml: carica i latest*.yml e i .blockmap', /latest\*\.yml/.test(RIL) && /\*\.blockmap/.test(RIL));
prova('rilascio.yml: verifica i yml prima di pubblicare', (RIL.match(/verifica-rilascio\.mjs/g) || []).length >= 2);
prova('rilascio.yml: firma ad hoc solo da riga di comando', /-c\.mac\.identity=-/.test(RIL) && /-c\.mac\.hardenedRuntime=false/.test(RIL));
prova('rilascio.yml: notarizzazione con la chiave API in un file .p8', /APPLE_API_KEY=.*\.p8/.test(RIL) && /APPLE_API_KEY_ID/.test(RIL) && /APPLE_API_ISSUER/.test(RIL));
prova('rilascio.yml: Azure Trusted Signing solo con i segreti', /azureSignOptions\.endpoint/.test(RIL) && /AZURE_TENANT_ID/.test(RIL) && /AZURE_CLIENT_SECRET/.test(RIL));
prova('rilascio.yml: i segreti del Mac non arrivano a Windows', /CSC_LINK: \$\{\{ matrix\.nome == 'mac' && secrets\.CSC_LINK \|\| '' \}\}/.test(RIL));
const PROVE = readFileSync(join(RADICE, '.github', 'workflows', 'prove.yml'), 'utf8');
prova('prove.yml: queste prove girano anche su GitHub', /node test\/aggiorna\.mjs/.test(PROVE));

console.log(`aggiorna: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
