// Provare il codice del progetto seguito (F2 di docs/PROGETTO-INFORMATICA.md). Node puro: niente import di electron.
// Regole che non si toccano:
// - i comandi li costruisce solo il main, partendo dai file del progetto (proponi). Mai un comando proposto da un
//   agente, mai uno scritto nel vault. Il testo scritto dallo studente con «Cambia» diventa argv qui (daTesto) e
//   parte solo dopo la finestra di sistema di conferma (progetto.mjs);
// - niente shell: spawn con argv. Su Windows niente .bat e .cmd (senza shell non si possono lanciare in modo sicuro);
// - tempi massimi e limiti all'uscita; alla fine si chiude l'intero albero dei processi
//   (gruppo di processi su Mac e Linux, taskkill /T /F su Windows);
// - un programma senza casi di prova viene solo compilato e mai eseguito: uno scanf che aspetta non blocca niente.
import { spawn, execFile } from 'node:child_process';
import { existsSync, statSync, lstatSync } from 'node:fs';
import { join, dirname, basename, extname, isAbsolute, delimiter, posix, sep } from 'node:path';

const WIN = process.platform === 'win32', MAC = process.platform === 'darwin';
export const CARTELLA_LODE = '‹cartella di Lode›';   // al posto di userData/progetti/<id>/bin nei testi per lo studente
export const TEMPO_COMPILA = 60e3, TEMPO_CASO = 5e3, LIMITE_USCITA = 200 * 1024, LIMITE_ERRORI = 50 * 1024;

/* ---------- cercare i programmi ---------- */
const chiavePath = env => Object.keys(env).find(k => /^path$/i.test(k)) || 'PATH';
// un nome nel PATH, come farebbe il terminale. Su Windows solo .exe e .com: un .bat senza shell non parte.
// Su Windows gli alias di esecuzione (Python dello Store, «py» del Python install manager in WindowsApps) sono reparse point:
// stat a volte non li segue, lstat sì. Se il programma vero c'è lo dice poi --version
export function cercaNelPath(nome, { env = process.env, cartelle = [], win = WIN } = {}) {
  if (isAbsolute(nome)) return existsSync(nome) ? nome : null;
  const dirs = [...cartelle, ...String(env[chiavePath(env)] || '').split(delimiter)].map(d => d.replace(/^"|"$/g, '')).filter(Boolean);
  const est = win && !extname(nome) ? ['.exe', '.com'] : [''];
  for (const d of dirs) for (const e of est) {
    const p = join(d, nome + e);
    try { if (statSync(p).isFile()) return p; } catch { if (win) try { if (!lstatSync(p).isDirectory()) return p; } catch { } }
  }
  return null;
}
// lancia «programma --version» e guarda se risponde quello che ci aspettiamo (nessuna finestra). Se il tempo scade
// (computer molto carico, antivirus al primo avvio) si riprova una volta con più calma: «manca il compilatore» deve essere vero
function versione(percorso, args, re, { cartelle = [] } = {}) {
  const una = tempo => new Promise(fine => {
    try {
      execFile(percorso, args, { timeout: tempo, windowsHide: true, env: ambiente(cartelle), maxBuffer: 256 * 1024 }, (err, out, errOut) => {
        const t = `${out || ''}\n${errOut || ''}`.trim();
        fine({ t: !err && re.test(t) ? t : null, scaduto: !!err?.killed });
      });
    } catch { fine({ t: null, scaduto: false }); }
  });
  return una(8000).then(r => r.scaduto ? una(30000) : r).then(r => r.t);
}
const esce0 = (percorso, args) => {
  const una = tempo => new Promise(fine => { try { execFile(percorso, args, { timeout: tempo, windowsHide: true }, err => fine({ ok: !err, scaduto: !!err?.killed })); } catch { fine({ ok: false, scaduto: false }); } });
  return una(5000).then(r => r.scaduto ? una(20000) : r).then(r => r.ok);
};

// macOS: senza gli strumenti da riga di comando, /usr/bin/cc, make e java aprono una finestra di installazione. Lo si chiede prima
let strumentiMac, provatoMac = 0;
async function shimMac() {
  if (!MAC) return false;
  if (!strumentiMac && Date.now() - provatoMac > 30e3) { provatoMac = Date.now(); strumentiMac = await esce0('/usr/bin/xcode-select', ['-p']); }
  return !strumentiMac;
}
// le cartelle dove MinGW finisce spesso fuori dal PATH (Code::Blocks, Dev-C++ vecchio e nuovo, MSYS2, TDM).
// Le usa anche test/verifica-c.mjs. Embarcadero Dev-C++ 6 con TDM-GCC: da confermare su un PC con Dev-C++ 6.3
export function cartelleMinGW(env = process.env) {
  const pf = env.ProgramFiles || 'C:\\Program Files', pf86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  return ['C:\\msys64\\ucrt64\\bin', 'C:\\msys64\\mingw64\\bin', 'C:\\mingw64\\bin', 'C:\\MinGW\\bin', 'C:\\TDM-GCC-64\\bin',
    join(pf, 'CodeBlocks', 'MinGW', 'bin'), join(pf86, 'CodeBlocks', 'MinGW', 'bin'), join(pf86, 'Dev-Cpp', 'MinGW64', 'bin'),
    join(pf86, 'Embarcadero', 'Dev-Cpp', 'TDM-GCC-64', 'bin'), join(pf, 'Embarcadero', 'Dev-Cpp', 'TDM-GCC-64', 'bin')];
}
// quello che si trova resta in memoria; quello che manca si ricerca dopo 30 s (magari lo studente l'ha appena installato)
const memo = {};
export function dimentica() { for (const k of Object.keys(memo)) delete memo[k]; strumentiMac = undefined; provatoMac = 0; }
const ricordato = k => k in memo && (memo[k].v || Date.now() - memo[k].t < 30e3);
const ricorda = (k, v) => { memo[k] = { v, t: Date.now() }; return v; };

// il compilatore C: cc, gcc, clang nel PATH (verificati con --version). Su Windows prima gcc (nel PATH, poi nelle
// cartelle di MinGW) e clang solo alla fine: il clang di LLVM senza MinGW punta a MSVC (niente stdio.h senza Visual Studio)
export async function trovaCompilatore() {
  if (ricordato('c')) return memo.c.v;
  const senzaShim = await shimMac(), visti = new Set();
  const nelPath = n => cercaNelPath(n);
  const candidati = WIN
    ? [nelPath('gcc'), ...cartelleMinGW().map(d => join(d, 'gcc.exe')), nelPath('cc'), nelPath('clang')].filter(Boolean)
    : ['cc', 'gcc', 'clang'].map(nelPath).filter(Boolean).filter(p => !(senzaShim && p.startsWith('/usr/bin/')));
  for (const p of candidati) {
    if (visti.has(p) || !existsSync(p)) continue; visti.add(p);
    const cartella = dirname(p), v = await versione(p, ['--version'], /gcc|clang|llvm|free software foundation|mingw/i, { cartelle: WIN ? [cartella] : [] });
    // msvc: clang con il target di Visual Studio. Non ha libm a parte: niente -lm (cercherebbe m.lib)
    if (v) return ricorda('c', { percorso: p, nome: basename(p).replace(/\.exe$/i, ''), versione: v.split('\n')[0].trim(), cartelle: WIN ? [cartella] : [], msvc: /windows-msvc/i.test(v) });
  }
  return ricorda('c', null);
}
// Python 3: py -3 (Windows), python3, python. Deve rispondere davvero «Python 3». Su Windows anche gli alias in WindowsApps
// (Python del Microsoft Store, Python install manager): con --version l'alias senza Python stampa «Python was not found»,
// esce con 9009 e non apre lo Store, quindi il controllo qui sotto lo scarta da solo
export async function trovaPython() {
  if (ricordato('py')) return memo.py.v;
  const prove = [];
  if (WIN) { const py = cercaNelPath('py'); if (py) prove.push([py, ['-3']]); }
  for (const n of ['python3', 'python']) { const p = cercaNelPath(n); if (p && !(await shimMac() && p.startsWith('/usr/bin/'))) prove.push([p, []]); }
  for (const [p, pre] of prove) {
    const v = await versione(p, [...pre, '--version'], /^Python 3\./m);
    if (v) return ricorda('py', { percorso: p, prefisso: pre, nome: basename(p).replace(/\.exe$/i, ''), versione: v.split('\n')[0].trim(), cartelle: [] });
  }
  return ricorda('py', null);
}
// Java: javac e java. Sul Mac /usr/bin/java senza JDK apre una finestra: prima si chiede a java_home
export async function trovaJava() {
  if (ricordato('java')) return memo.java.v;
  if (MAC && !(await esce0('/usr/libexec/java_home', []))) return ricorda('java', null);
  const javac = cercaNelPath('javac'), java = cercaNelPath('java');
  if (!javac || !java) return ricorda('java', null);
  const v = await versione(javac, ['-version'], /javac \d/i);
  return ricorda('java', v ? { javac, java, nome: 'javac', versione: v.split('\n')[0].trim(), cartelle: [] } : null);
}
// make (su Windows anche mingw32-make, pure nelle cartelle di MinGW)
export async function trovaMake() {
  if (ricordato('make')) return memo.make.v;
  const senzaShim = await shimMac(), candidati = [];
  for (const n of WIN ? ['make', 'mingw32-make'] : ['make']) { const p = cercaNelPath(n); if (p && !(senzaShim && p.startsWith('/usr/bin/'))) candidati.push(p); }
  if (WIN) for (const d of cartelleMinGW()) candidati.push(join(d, 'mingw32-make.exe'), join(d, 'make.exe'));
  for (const p of candidati) {
    if (!existsSync(p)) continue;
    const cartella = dirname(p), v = await versione(p, ['--version'], /make/i, { cartelle: WIN ? [cartella] : [] });
    if (v) return ricorda('make', { percorso: p, nome: basename(p).replace(/\.exe$/i, ''), versione: v.split('\n')[0].trim(), cartelle: WIN ? [cartella] : [] });
  }
  return ricorda('make', null);
}
export const TROVA = { compilatore: trovaCompilatore, python: trovaPython, java: trovaJava, make: trovaMake };

// cosa dire quando manca uno strumento. Lode non scarica e non installa niente da sola
// Su Windows Lode legge il PATH di quando è partita: chi lo cambia deve uscire da Lode e riaprirla
const RIAPRI = ' Se lo hai appena aggiunto al PATH, esci da Lode (dal menu) e riaprila.';
export function comeInstallare(cosa, piattaforma = process.platform) {
  if (cosa === 'c') return piattaforma === 'win32'
    ? 'Non trovo un compilatore C. Installa MSYS2 (msys2.org), apri «MSYS2 UCRT64» e scrivi `pacman -S mingw-w64-ucrt-x86_64-gcc`: Lode lo trova da sola in C:\\msys64\\ucrt64\\bin. In alternativa WinLibs (winlibs.com) o WSL. Lode non scarica niente al posto tuo.' + RIAPRI
    : piattaforma === 'darwin' ? 'Non trovo un compilatore C. Apri il Terminale e scrivi `xcode-select --install`: installa clang di Apple. Poi riprova.'
      : 'Non trovo un compilatore C. Installa gcc (per esempio `sudo apt install build-essential`), poi riprova.';
  if (cosa === 'python') return piattaforma === 'win32' ? 'Non trovo Python 3. Installalo da python.org (spunta «Add python.exe to PATH») oppure dal Microsoft Store, poi riprova.' + RIAPRI : 'Non trovo Python 3. Installalo (python.org, oppure dal gestore dei pacchetti), poi riprova.';
  if (cosa === 'java') return 'Non trovo un JDK (javac e java). Installane uno, per esempio Temurin da adoptium.net, poi riprova.';
  // il make di MSYS2 per Windows: mingw32-make.exe in C:\msys64\ucrt64\bin, una cartella che Lode guarda già (da verificare su Windows)
  if (cosa === 'make') return piattaforma === 'win32' ? 'C\'è un Makefile ma non trovo make. Con MSYS2, in «MSYS2 UCRT64»: `pacman -S mingw-w64-ucrt-x86_64-make`. Oppure togli il Makefile e Lode compila da sola i file .c.' : 'C\'è un Makefile ma non trovo make. Installalo (sul Mac: `xcode-select --install`), poi riprova.';
  return 'Manca un programma per provare il codice.';
}

/* ---------- dal progetto ai comandi ---------- */
// un nome di file che inizia con «-» o «@» il compilatore lo leggerebbe come un'opzione (o un file di opzioni): ./ davanti
export const esplicito = rel => /^[-@]/.test(rel) ? './' + rel : rel;
const sicuro = s => String(s).replace(/[^\w.-]+/g, '_').replace(/^[.-]+/, '').slice(0, 60) || 'programma';
const senzaCommenti = t => String(t || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');
export const haMainC = t => /^\s*(?:int|void)\s+main\s*\(/m.test(senzaCommenti(t));
export const haMainPy = t => /^if\s+__name__\s*==\s*['"]__main__['"]\s*:/m.test(String(t || ''));
export const haMainJava = t => /\bpublic\s+static\s+void\s+main\s*\(/.test(senzaCommenti(t));
// Python: il controllo della sintassi con compile(), che non scrive niente (py_compile metterebbe i .pyc nella cartella)
const CONTROLLO_PY = "import sys\nfor f in sys.argv[1:]:\n    compile(open(f, 'rb').read(), f, 'exec')";
const ETICHETTE = { [CONTROLLO_PY]: '‹controllo della sintassi›' };

// i casi di prova: X.in → X.out, inputN.txt → outputN.txt; nella radice o dentro test/ e tests/
export function trovaCasi(file) {
  const per = new Map(file.map(f => [f.toLowerCase(), f])), out = [];
  const posto = f => { const d = posix.dirname(f); return d === '.' || d.split('/').some(x => /^tests?$/i.test(x)); };
  for (const f of file) {
    if (!posto(f)) continue;
    let m, o;
    if ((m = /^(.*)\.in$/i.exec(f)) && (o = per.get((m[1] + '.out').toLowerCase()))) out.push({ nome: m[1], in: f, out: o });
    else if ((m = /^(.*\/)?input([^/]*)\.txt$/i.exec(f)) && (o = per.get(((m[1] || '') + 'output' + m[2] + '.txt').toLowerCase()))) out.push({ nome: (m[1] || '') + (m[2] || 'input'), in: f, out: o });
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'it', { numeric: true }));
}
// con più programmi, una prova va a quello che ha il nome nel percorso (test/es1/01.in → es1); se no resta senza programma
export function assegna(casi, programmi) {
  if (programmi.length === 1) return casi.map(c => ({ ...c, programma: programmi[0].nome }));
  return casi.map(c => { const parti = c.nome.toLowerCase().split(/[/_\-. ]+/); return { ...c, programma: programmi.find(p => parti.includes(p.nome.toLowerCase()))?.nome || null }; });
}

// i nomi dei programmi che riceveranno almeno una prova (in ordine): lanciarli è parte di quello che lo studente conferma
export const lanciati = casi => [...new Set(casi.filter(k => k.programma).map(k => k.programma))].sort();

// come lo vede lo studente: niente percorsi lunghi, la cartella di Lode con il suo nome
const barre = x => String(x).replace(/\\/g, '/');
export function mostraArgv(argv, { bin, etichette = {} } = {}) {
  const b = bin ? barre(bin) : null;
  return argv.map((a, i) => {
    if (etichette[a]) return etichette[a];
    if (b && (barre(a) === b || barre(a).startsWith(b + '/'))) return CARTELLA_LODE + virgolette(barre(a).slice(b.length));
    return virgolette(i === 0 && isAbsolute(a) ? basename(a).replace(/\.exe$/i, '') : a);
  }).join(' ');
}
// esatto, per la finestra di conferma: i percorsi interi
export const argvEsatto = argv => argv.map(virgolette).join(' ');
// i caratteri di controllo, gli a capo Unicode e quelli che girano il verso del testo: nella finestra si vedono come \u{…}
export const INVISIBILI = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
export const visibile = s => String(s).replace(new RegExp(INVISIBILI.source, 'gu'), c => c === '\n' ? '\\n' : `\\u{${c.codePointAt(0).toString(16).toUpperCase()}}`);
const virgolette = s => s === '' || /[\s"']/.test(s) || INVISIBILI.test(s) ? `"${visibile(s.replace(/"/g, '\\"'))}"` : s;

// proponi: cosa userebbe Lode per provare questo progetto. Regole fisse, in quest'ordine: Makefile, C, Python, Java.
// file: i percorsi relativi (con /) dei file seguiti; leggi(rel) → testo; bin: la cartella di Lode per gli eseguibili
export async function proponi({ nome, file, leggi, bin, trova = TROVA, piattaforma = process.platform }) {
  const win = piattaforma === 'win32', casiTutti = trovaCasi(file), note = [];
  const c = file.filter(f => /\.c$/i.test(f)), py = file.filter(f => /\.py$/i.test(f)), java = file.filter(f => /\.java$/i.test(f));
  const make = ['Makefile', 'makefile', 'GNUmakefile'].find(f => file.includes(f));
  const fine = p => {
    const casi = assegna(casiTutti, p.programmi || []);
    const testo = (p.passi || []).map(x => mostraArgv(x.argv, { bin, etichette: ETICHETTE })).join(' && ');
    const pronte = casi.filter(k => k.programma), cartelleCasi = [...new Set(pronte.map(k => posix.dirname(k.in)))];
    const testoCasi = !casiTutti.length ? (p.tipo === 'make' ? '' : 'Non trovo prove .in/.out: compilo soltanto, il programma non lo lancio.')
      : p.tipo === 'make' ? `Con il Makefile le ${casiTutti.length} prove .in/.out non le lancio: non so quale programma crea.`
        : `poi ${pronte.length === 1 ? 'la prova' : `le ${pronte.length} prove`}${cartelleCasi.length === 1 && cartelleCasi[0] !== '.' ? ` in ${cartelleCasi[0]}/` : ''} (file .in → .out atteso)${casi.length > pronte.length ? `; ${casi.length - pronte.length} senza un programma chiaro` : ''}`;
    const chiave = JSON.stringify([p.tipo, (p.passi || []).map(x => x.argv), (p.programmi || []).map(x => x.argv)]);
    // lanciati: i programmi che riceveranno almeno una prova. La conferma vale solo per questi (progetto.mjs)
    return { tipo: p.tipo, passi: p.passi || [], programmi: p.programmi || [], casi, lanciati: lanciati(casi), cartelle: p.cartelle || [], manca: p.manca || null, strumento: p.strumento || null, testo, testoCasi, chiave, note };
  };
  if (make) {
    const m = await trova.make();
    if (m) {
      // le regole del Makefile chiamano gcc: se gcc sta in una cartella di MinGW fuori dal PATH, quella cartella serve anche qui
      const conTest = /^test\s*:/m.test(leggi(make) || ''), cc = c.length ? await trova.compilatore() : null;
      note.push('make esegue i comandi scritti nel Makefile: leggilo prima di confermare.');
      return fine({ tipo: 'make', strumento: m, cartelle: [...new Set([...(m.cartelle || []), ...(cc?.cartelle || [])])], passi: [{ ruolo: 'compila', argv: [m.percorso, ...(conTest ? ['test'] : [])] }], programmi: [] });
    }
    if (!c.length) return fine({ tipo: 'make', manca: { cosa: 'make', come: comeInstallare('make', piattaforma) } });
    note.push('C\'è un Makefile ma non trovo make: compilo io i file .c.');
  }
  if (c.length) {
    const cc = await trova.compilatore();
    const conMain = c.filter(f => haMainC(leggi(f))).sort(), altri = c.filter(f => !conMain.includes(f));
    const inc = [...new Set(file.filter(f => /\.h$/i.test(f)).map(f => posix.dirname(f)).filter(d => d !== '.'))].sort().map(d => '-I' + esplicito(d));
    const base = cc ? cc.percorso : 'gcc', opz = ['-std=c11', '-Wall', '-Wextra'], lm = cc?.msvc ? [] : ['-lm'];
    const passi = [], programmi = [], usati = new Set();
    if (!conMain.length) passi.push({ ruolo: 'compila', argv: [base, ...opz, '-fsyntax-only', ...inc, ...[...c].sort().map(esplicito)] });
    for (const m of conMain) {
      let n = sicuro(conMain.length === 1 ? nome : basename(m).replace(/\.c$/i, ''));
      if (usati.has(n)) n = sicuro(m.replace(/\.c$/i, '').replace(/\//g, '_')); usati.add(n);
      const exe = join(bin, n + (win ? '.exe' : ''));
      passi.push({ ruolo: 'compila', nome: n, argv: [base, ...opz, '-g', ...inc, ...[m, ...altri].sort().map(esplicito), '-o', exe, ...lm] });
      programmi.push({ nome: n, argv: [exe], file: m });
    }
    return fine({ tipo: 'c', strumento: cc, cartelle: cc?.cartelle || [], passi, programmi, manca: cc ? null : { cosa: 'il compilatore C', come: comeInstallare('c', piattaforma) } });
  }
  if (py.length) {
    const p = await trova.python(), pre = p ? [p.percorso, ...p.prefisso] : ['python3'];
    const radice = py.filter(f => !f.includes('/'));
    let main = file.includes('main.py') ? ['main.py'] : radice.length === 1 ? radice : py.filter(f => haMainPy(leggi(f))).sort();
    const usati = new Set();
    const programmi = main.map(f => { let n = sicuro(main.length === 1 ? nome : basename(f).replace(/\.py$/i, '')); if (usati.has(n)) n = sicuro(f.replace(/\.py$/i, '').replace(/\//g, '_')); usati.add(n); return { nome: n, argv: [...pre, '-B', esplicito(f)], file: f }; });
    return fine({ tipo: 'python', strumento: p, passi: [{ ruolo: 'compila', argv: [...pre, '-B', '-c', CONTROLLO_PY, ...[...py].sort().map(esplicito)] }], programmi, manca: p ? null : { cosa: 'Python 3', come: comeInstallare('python', piattaforma) } });
  }
  if (java.length) {
    const j = await trova.java(), dirJ = join(bin, 'java');
    // una classe Java si chiama come un identificatore: un file che inizia con «-» o «@» non diventa un programma da lanciare
    const programmi = java.filter(f => haMainJava(leggi(f)) && /^[A-Za-z_$][\w$]*$/.test(basename(f).replace(/\.java$/i, ''))).sort().map(f => {
      const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(leggi(f) || '')?.[1], cls = basename(f).replace(/\.java$/i, '');
      return { nome: sicuro(cls), argv: [j ? j.java : 'java', '-cp', dirJ, pkg ? `${pkg}.${cls}` : cls], file: f };
    });
    return fine({ tipo: 'java', strumento: j, passi: [{ ruolo: 'compila', argv: [j ? j.javac : 'javac', '-encoding', 'UTF-8', '-d', dirJ, ...[...java].sort().map(esplicito)] }], programmi, manca: j ? null : { cosa: 'un JDK', come: comeInstallare('java', piattaforma) } });
  }
  return fine({ tipo: null, manca: { cosa: 'codice', come: 'Non trovo codice C, Python o Java da provare in questa cartella.' } });
}

// «Cambia»: il testo scritto dallo studente diventa argv (le virgolette restano unite). La cartella di Lode torna percorso vero.
export function dividiArgv(testo) {
  const out = []; let cur = '', dentro = null, ha = false;
  for (const ch of String(testo || '').trim()) {
    if (dentro) { if (ch === dentro) dentro = null; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { dentro = ch; ha = true; continue; }
    if (/\s/.test(ch)) { if (ha) { out.push(cur); cur = ''; ha = false; } continue; }
    cur += ch; ha = true;
  }
  if (dentro) throw new Error('Le virgolette non sono chiuse.');
  if (ha) out.push(cur);
  return out;
}
export function daTesto(testo, { bin, strumento = null, cartelle = [] } = {}) {
  // quello che si conferma deve essere quello che si vede: niente caratteri di controllo, a capo nascosti o testo girato
  const t = String(testo ?? '').replace(/\t/g, ' ');
  if (INVISIBILI.test(t)) throw new Error('Nel comando ci sono caratteri invisibili (a capo, controllo o direzione del testo): riscrivilo a mano.');
  // i segnaposto hanno spazi dentro: diventano un segno senza spazi prima di dividere, il valore vero dopo
  const argv = dividiArgv(t.split(CARTELLA_LODE).join('\u0001').split(ETICHETTE[CONTROLLO_PY]).join('\u0002'))
    // dopo la cartella di Lode le barre diventano quelle del sistema (su Windows «…\\bin\\es1», non «…\\bin/es1»)
    .map(a => a === '\u0002' ? CONTROLLO_PY : a.includes('\u0001') ? a.split('\u0001').map((x, i) => i ? x.replace(/[\\/]/g, sep) : x).join(bin) : a);
  if (!argv.length) throw new Error('Il comando è vuoto.');
  if (argv.some(a => /[\0\u0001\u0002]/.test(a) || a.length > 4000)) throw new Error('Il comando non si legge.');
  let p = argv[0];
  if (strumento && [strumento.nome, basename(strumento.percorso || '')].includes(p)) p = strumento.percorso;
  else p = cercaNelPath(p, { cartelle }) || (isAbsolute(p) && existsSync(p) ? p : null);
  if (!p) throw new Error(`Non trovo il programma «${argv[0]}».`);
  if (WIN && /\.(bat|cmd)$/i.test(p)) throw new Error('I file .bat e .cmd non li lancio: scrivi il comando che contengono.');
  return [p, ...argv.slice(1)];
}

/* ---------- eseguire ---------- */
// l'ambiente dei figli: messaggi in inglese (si leggono in modo deterministico), niente .pyc, niente variabili di Lode o di Electron
export function ambiente(cartelle = []) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(LODE_|ELECTRON_)|^NODE_OPTIONS$/i.test(k)) env[k] = v;
  Object.assign(env, { LC_ALL: 'C', LANG: 'C', PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8' });
  if (cartelle.length) { const k = chiavePath(env); env[k] = [...cartelle, env[k] || ''].filter(Boolean).join(delimiter); }
  return env;
}
const vivi = new Set();   // pid dei processi in corso, per chiuderli tutti uscendo
export function uccidiAlbero(pid) {
  if (!pid) return;
  if (WIN) {
    try { spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => { }); } catch { }
    return;
  }
  // il figlio parte «detached»: è capo del suo gruppo di processi, e -pid li prende tutti (nipoti compresi)
  try { process.kill(-pid, 'SIGKILL'); } catch { }
}
export function fermaTutto() { for (const pid of vivi) uccidiAlbero(pid); }

// lancia(argv, { cwd, stdin, timeout, limite, limiteErr }) → { codice, segnale, stdout, stderr, scaduto, troncato, durata, pid, errore }
export function lancia(argv, { cwd, stdin = null, timeout = TEMPO_CASO, limite = LIMITE_USCITA, limiteErr = LIMITE_ERRORI, env = ambiente(), pezzo = null } = {}) {
  return new Promise(fine => {
    const t0 = Date.now(), out = [], err = [];
    let nOut = 0, nErr = 0, troncato = false, scaduto = false, chiuso = false, p, grazia = 0, ultima = 0;
    const risultato = (codice, segnale, errore) => {
      if (chiuso) return; chiuso = true; clearTimeout(timer); clearTimeout(grazia); clearTimeout(ultima);
      if (p?.pid) { if (!WIN) uccidiAlbero(p.pid); vivi.delete(p.pid); }   // anche i nipoti rimasti accesi
      fine({ codice, segnale, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), scaduto, troncato, durata: Date.now() - t0, pid: p?.pid || null, errore: errore || null });
    };
    const timer = setTimeout(() => { scaduto = true; if (p?.pid) uccidiAlbero(p.pid); ultima = setTimeout(() => risultato(null, 'SIGKILL'), 3000); }, timeout);
    try { p = spawn(argv[0], argv.slice(1), { cwd, env, shell: false, windowsHide: true, detached: !WIN, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (e) { return risultato(null, null, e.code === 'ENOENT' ? `Non trovo il programma «${basename(argv[0])}».` : e.message); }
    if (p.pid) vivi.add(p.pid);
    p.on('error', e => risultato(null, null, e.code === 'ENOENT' ? `Non trovo il programma «${basename(argv[0])}».` : e.message));
    p.stdout.on('data', b => {
      if (troncato) return;
      if (nOut + b.length > limite) { out.push(b.subarray(0, Math.max(0, limite - nOut))); nOut = limite; troncato = true; uccidiAlbero(p.pid); return; }
      out.push(b); nOut += b.length; pezzo?.('stdout', b.toString('utf8'));
    });
    p.stderr.on('data', b => {
      if (nErr >= limiteErr) return;
      const x = nErr + b.length > limiteErr ? b.subarray(0, limiteErr - nErr) : b; err.push(x); nErr += x.length; pezzo?.('stderr', x.toString('utf8'));
    });
    // il processo è uscito ma un figlio tiene aperte le uscite: dopo un attimo si chiude lo stesso
    p.on('exit', (codice, segnale) => { if (!WIN) uccidiAlbero(p.pid); grazia = setTimeout(() => risultato(codice, segnale), 1500); });
    p.on('close', (codice, segnale) => risultato(codice, segnale));
    p.stdin.on('error', () => { });   // il programma è uscito senza leggere: va bene
    try { if (stdin != null) p.stdin.end(stdin); else p.stdin.end(); } catch { }
  });
}

/* ---------- confrontare l'uscita ---------- */
// CRLF, spazi in fondo alla riga e righe vuote in fondo non contano
export function normalizza(t) {
  const r = String(t ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').map(x => x.replace(/[ \t]+$/, ''));
  while (r.length && r.at(-1) === '') r.pop();
  return r;
}
export function confronta(atteso, ottenuto) {
  const a = normalizza(atteso), b = normalizza(ottenuto);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return { ok: false, riga: i + 1, atteso: a[i] ?? null, ottenuto: b[i] ?? null };
  return { ok: true, riga: null, atteso: null, ottenuto: null };
}
// il primo errore, per la pillola («lista.c:42»). L'analisi vera degli errori è in js/errori.js (F3)
export function primoErrore(testo) {
  const t = String(testo || '');
  let m = /^(.+?):(\d+)(?::(\d+))?:\s*(?:fatal error|error|errore fatale|errore)\b:?\s*(.*)$/mi.exec(t);
  if (m) return { file: m[1].trim(), riga: +m[2], colonna: m[3] ? +m[3] : null, messaggio: m[4].trim() };
  const py = [...t.matchAll(/File "([^"]+)", line (\d+)/g)].at(-1);
  if (py) return { file: py[1], riga: +py[2], colonna: null, messaggio: t.trim().split('\n').at(-1).trim() };
  m = /(?:undefined reference to|riferimento non definito a) [`'‘"]?([\w$]+)/i.exec(t) || /Undefined symbols?[^\n]*\n\s*"_?([\w$]+)"/i.exec(t);
  if (m) return { file: null, riga: null, colonna: null, messaggio: `undefined reference to ${m[1]}` };
  return null;
}

// si è fermato per un errore? Su Mac e Linux lo dice il segnale. Su Windows il codice d'uscita arriva senza segno (DWORD):
// sono crash solo i codici di errore del sistema (NTSTATUS 0xC0000005, 0xC0000094…), non un «return -1» (4294967295)
const CRASH_WIN = c => { const u = c >>> 0; return u >= 0xC0000000 && u < 0xD0000000; };
export function eCrash(x, piattaforma = process.platform) {
  if (x.scaduto || x.troncato) return false;
  if (x.segnale) return true;
  return piattaforma === 'win32' && x.codice != null && CRASH_WIN(x.codice);
}
// il codice d'uscita da mostrare: su Windows -1 resta -1 (non 4294967295); i codici di sistema restano come sono
export const codiceDaMostrare = (c, piattaforma = process.platform) => piattaforma === 'win32' && c != null && c > 0x7FFFFFFF && !CRASH_WIN(c) ? c | 0 : c;

// la prova intera: i passi di compilazione, poi ogni caso con il suo .in come stdin. leggi(rel) → Buffer
export async function eseguiProva({ radice, passi = [], programmi = [], casi = [], cartelle = [], leggi, pezzo = null, tempoCompila = TEMPO_COMPILA, tempoCaso = TEMPO_CASO }) {
  const env = ambiente(cartelle), t0 = Date.now();
  const r = { esito: 'ok', compilazione: { codice: 0, segnale: null, stdout: '', stderr: '', durata: 0, scaduto: false, avvisi: 0 }, casi: [], saltati: [], ok: 0, tot: 0, primo: null, messaggio: null };
  const c = r.compilazione;
  for (const p of passi) {
    const x = await lancia(p.argv, { cwd: radice, timeout: tempoCompila, env, pezzo: (flusso, testo) => pezzo?.({ fase: 'compila', flusso, testo }) });
    c.stdout += x.stdout; c.stderr += x.stderr; c.durata += x.durata; c.codice = x.codice; c.segnale = x.segnale; c.scaduto ||= x.scaduto;
    if (x.errore) { r.esito = 'errore'; r.messaggio = x.errore; break; }
    if (x.scaduto) { r.esito = 'non-compila'; r.messaggio = `La compilazione non è finita entro ${Math.round(tempoCompila / 1000)} secondi.`; break; }
    if (x.codice !== 0) { r.esito = 'non-compila'; r.primo = primoErrore(`${c.stderr}\n${c.stdout}`); break; }
  }
  c.avvisi = (c.stderr.match(/\bwarning:|\bavviso:/gi) || []).length;
  if (r.esito === 'ok') for (const k of casi) {
    const prog = programmi.find(p => p.nome === k.programma);
    if (!prog) { r.saltati.push({ nome: k.nome, motivo: 'non so a quale programma va' }); continue; }
    if (prog.argv.length === 1 && isAbsolute(prog.argv[0]) && !existsSync(prog.argv[0])) { r.esito = 'errore'; r.messaggio = 'Il comando non ha creato il programma da provare.'; break; }
    let input, atteso;
    try { input = leggi(k.in); atteso = leggi(k.out).toString('utf8'); } catch { r.saltati.push({ nome: k.nome, motivo: 'non riesco a leggere i file della prova' }); continue; }
    const x = await lancia(prog.argv, { cwd: radice, stdin: input, timeout: tempoCaso, env, pezzo: (flusso, testo) => pezzo?.({ fase: 'caso', caso: k.nome, flusso, testo }) });
    const cf = confronta(atteso, x.stdout);
    const crash = eCrash(x);
    r.casi.push({ nome: k.nome, in: k.in, out: k.out, programma: prog.nome, ok: !x.errore && !x.scaduto && !x.troncato && !crash && cf.ok,
      riga: cf.riga, atteso: cf.atteso, ottenuto: cf.ottenuto, codice: codiceDaMostrare(x.codice), segnale: x.scaduto || x.troncato ? null : x.segnale, crash,
      scaduto: x.scaduto, troncato: x.troncato, stderr: x.stderr.slice(0, 4000), durata: x.durata, pid: x.pid, errore: x.errore });
  }
  r.tot = r.casi.length; r.ok = r.casi.filter(x => x.ok).length;
  if (r.esito === 'ok' && r.ok < r.tot) r.esito = 'prove';
  r.durata = Date.now() - t0;
  return r;
}
