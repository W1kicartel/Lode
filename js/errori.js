// Gli errori del compilatore e dei programmi, spiegati in italiano, un passo alla volta (F3 di docs/PROGETTO-INFORMATICA.md).
// Niente AI: solo regole fisse. analizza(testo) legge quello che scrivono gcc, clang, MinGW, MSVC (cl), javac, Python e Java
// (anche copiato da Code::Blocks e Dev-C++)
// e lo trasforma in una lista di errori. spiega(errore, { sorgente, righeCambiate }) prepara i tre passi:
// «Dove guardare», «Cosa vuol dire» e, solo per le correzioni meccaniche, «Fammi vedere la correzione».
// Modulo puro: niente DOM, niente rete, niente salvataggi. Lo usano la barra e il main («spiegami l'errore» dagli appunti).
// Un errore che non è nel dizionario resta col suo messaggio originale e Lode lo dice: mai dettagli inventati.
// I testi per lo studente sono nel catalogo (js/lingue/<lingua>/errori.js); le regex che leggono i compilatori no.
import { t } from './lingua.js';

// ---------- piccoli attrezzi ----------
const ANSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
// gli apici cambiano da un compilatore all'altro (', ‘’, «», `): per riconoscere i messaggi li rendiamo tutti uguali
const apici = s => String(s || '').replace(/[‘’`´«»“”„]/g, "'");
const LINGUA = { c: 'c', h: 'c', cc: 'c', cpp: 'c', cxx: 'c', hpp: 'c', py: 'python', pyw: 'python', java: 'java' };
export const linguaDi = file => LINGUA[String(file || '').toLowerCase().match(/\.(\w+)$/)?.[1]] || null;
export const nomeFile = file => file ? String(file).split(/[\\/]/).pop() : null;
const NOME_LINGUA = { c: 'C', python: 'Python', java: 'Java' };

const GRAVITA = {
  'error': 'errore', 'fatal error': 'errore', 'errore': 'errore', 'errore fatale': 'errore', 'errore irreversibile': 'errore',
  'warning': 'avviso', 'avviso': 'avviso', 'attenzione': 'avviso', 'avvertenza': 'avviso',
  'note': 'nota', 'nota': 'nota', 'remark': 'nota', 'runtime error': 'esecuzione',
};
const gravita = g => GRAVITA[String(g).toLowerCase()] || 'errore';

// ---------- le righe che sappiamo leggere ----------
// gcc, clang, MinGW (anche «C:\lab\lista.c:42:5: errore: …»), javac «Main.java:5: error: …» e UBSan «…: runtime error: …»
const RE_GCC = /^(.+?):(\d+):(?:(\d+):)?\s*(fatal error|runtime error|error|warning|note|remark|errore fatale|errore|avviso|attenzione|avvertenza|nota):\s*(.*)$/i;
// MSVC: «lista.c(42): error C2065: …» oppure «lista.c(42,5): …»
const RE_MSVC = /^(.+?)\((\d+)(?:,(\d+))?\)\s*:\s*(fatal error|error|warning|note|errore irreversibile|errore|avviso|nota)\s+([A-Z]{1,3}\d{3,5})\s*:\s*(.*)$/i;
// linker di MSVC: «main.obj : error LNK2019: …». Il nome non ha «:» (a parte la lettera del disco): così la regex non torna indietro
const RE_LNK = /^((?:[A-Za-z]:)?[^:]*):\s*(fatal error|error|warning|errore irreversibile|errore|avviso)\s+(LNK\d{4})\s*:\s*(.*)$/i;
// strumenti senza file: «clang: error: …», «gcc: fatal error: …» (i riassunti come «ld returned 1 exit status» si saltano)
const RE_STRUMENTO = /^(?:\S*[\\/])?(?:clang|gcc|cc|g\+\+|clang\+\+|cl)(?:-\d+)?(?:\.exe)?:\s*(fatal error|error|errore fatale|errore):\s*(.*)$/i;
const RIASSUNTO = /linker command failed|ld returned \d+ exit status|symbol\(s\) not found|\d+ duplicate symbols?|compilation terminated|compilazione terminata/i;
const RIGA_CODICE = /^\s*(\d+)\s*\|\s?(.*)$/;      // « 42 |     int x = 5»: il codice che gcc ≥ 9 e clang mostrano sotto l'errore
const SOTTO_CODICE = /^\s*\|/;                     // le righe con ^ ~~~ e i suggerimenti sotto il codice
const CARET = /^\s*[~^]+[~^ ]*$/;
const RE_PY_FILE = /^\s*File "(.+?)", line (\d+)(?:, in (.*\S))?\s*$/;
const RE_PY_ECC = /^([A-Za-z_][\w.]*(?:Error|Exception|Warning|Interrupt|Exit|StopIteration))(?::\s?(.*))?$/;
const RE_JAVA_ECC = /^(?:Exception in thread "[^"]*"|Eccezione nel thread "[^"]*"|Caused by:|Causato da:)\s*([\w.$]+)(?::\s*(.*))?$/;
const RE_JAVA_AT = /^\s*at\s+(?:([\w.$@-]+)\/)?([\w.$<>]+)\(([^():]+?)(?::(\d+))?\)\s*$/;
const RE_ASAN = /ERROR: (AddressSanitizer|LeakSanitizer|MemorySanitizer|ThreadSanitizer): ([\w-]+)/;
const RE_ASAN_FRAME = /^\s*#\d+\s+0x[0-9a-f]+\s+in\s+(\S+)\s+(.+?):(\d+)(?::(\d+))?\s*$/i;
const RE_ASSERT_MAC = /Assertion failed: (.*?), (?:function ([\w$]+), )?file (.+?), line (\d+)\.?\s*$/;
const RE_ASSERT_GLIBC = /^(?:[^:]*: )?([^:]+):(\d+): ([\w$ ]+): Assertion '(.*)' failed\.?\s*$/;
const LIBRERIA_PY = /[\\/](?:site-packages|dist-packages)[\\/]|[\\/]lib[\\/]python\d[\d.]*[\\/]|[\\/]Python\d+[\\/]Lib[\\/]|^<frozen /i;
const LIBRERIA_C = /asan|sanitizer|interceptor|compiler-rt|libsystem|libc[.-]|libdyld|^\/usr\/|<unknown module>/i;
// una riga lunghissima non è un errore del compilatore: si legge solo l'inizio (così nessuna regex costa troppo)
const MAX_RIGA = 2000;

// Code::Blocks («Build messages») e Dev-C++ copiano gli errori in colonne. Si riscrivono nel formato di gcc:
//   Code::Blocks  «C:\lab\main.c|6|error: 'nodo' undeclared …|»   («C:\lab\main.c||In function 'main':|», «||=== Build … ===|»)
//   Dev-C++       «6<TAB>2<TAB>C:\lab\main.c<TAB>[Error] 'nodo' undeclared …»   («<TAB><TAB>C:\lab\main.c<TAB>In function 'main':»)
const RE_CODEBLOCKS = /^([^|\t]*)\|(\d*)\|(.*)$/;
const RE_DEVCPP = /^(\d*)\t(\d*)\t([^\t]+)\t(.*)$/;
const FILE_IDE = /^\S[^\t]*\.(?:c|h|cc|cpp|cxx|hpp|o|obj|exe|win)$/i;
const GRAVITA_IDE = { error: 'error', errore: 'error', warning: 'warning', avviso: 'warning', note: 'note', nota: 'note' };
const IN_FUNZIONE = /^(?:In function|In member function|At top level|Nella funzione|Al livello principale)\b/;
function daIde(r) {
  let m;
  if ((m = RE_DEVCPP.exec(r)) && FILE_IDE.test(m[3].trim()) && (m[1] || !m[2])) {
    const file = m[3].trim(), riga = m[1], col = m[2];
    let msg = m[4].trim();
    const g = /^\[(error|errore|warning|avviso|note|nota)\]\s*/i.exec(msg);
    if (g) msg = msg.slice(g[0].length);
    if (riga && g) return `${file}:${riga}:${col ? col + ':' : ''} ${GRAVITA_IDE[g[1].toLowerCase()]}: ${msg}`;
    return IN_FUNZIONE.test(msg) ? `${file}: ${msg}` : msg;
  }
  if (r.includes('|') && (m = RE_CODEBLOCKS.exec(r))) {
    const file = m[1].trim(), riga = m[2];
    let msg = m[3].trim(); if (msg.endsWith('|')) msg = msg.slice(0, -1).trim();
    if (!msg || (file ? !FILE_IDE.test(file) || /^\s/.test(r) : !r.startsWith('||')) || (!file && riga)) return r;   // non è una riga di Code::Blocks
    if (/^=+.*=+$/.test(msg)) return '';
    if (file && riga) return `${file}:${riga}: ${msg}`;
    return file ? `${file}: ${msg}` : msg;
  }
  return r;
}

// le uscite di Windows: il programma è stato fermato dal sistema
const WINDOWS = { c0000005: 'esec-memoria', c0000094: 'esec-divisione-zero', c00000fd: 'esec-stack', c0000409: 'esec-fuori-array', c0000374: 'esec-heap', c0000095: 'esec-overflow' };
const WINDOWS_DEC = {
  '3221225477': 'c0000005', '-1073741819': 'c0000005', '3221225620': 'c0000094', '-1073741676': 'c0000094',
  '3221225725': 'c00000fd', '-1073741571': 'c00000fd', '3221226505': 'c0000409', '-1073740791': 'c0000409',
  '3221226356': 'c0000374', '-1073740940': 'c0000374', '3221225621': 'c0000095', '-1073741675': 'c0000095',
};
const SEGNALI = { SIGSEGV: 'esec-memoria', SIGBUS: 'esec-memoria', SIGFPE: 'esec-divisione-zero', SIGABRT: 'esec-abort', SIGIOT: 'esec-abort' };
// codice d'uscita di una shell: 128 + numero del segnale (139 = SIGSEGV, 136 = SIGFPE, 134 = SIGABRT, 135/138 = SIGBUS)
const DA_SHELL = { 139: 'SIGSEGV', 136: 'SIGFPE', 134: 'SIGABRT', 135: 'SIGBUS', 138: 'SIGBUS', '-11': 'SIGSEGV', '-8': 'SIGFPE', '-6': 'SIGABRT', '-10': 'SIGBUS', '-7': 'SIGBUS' };
// frasi delle shell e dei terminali (anche in italiano) quando il programma si schianta
const CRASH = [
  [/segmentation fault|errore di segmentazione|\bSIGSEGV\b|\bsegfault\b/i, 'esec-memoria', 'SIGSEGV'],
  [/\bbus error\b|\bSIGBUS\b/i, 'esec-memoria', 'SIGBUS'],
  [/floating point exception|eccezione in virgola mobile|\bSIGFPE\b/i, 'esec-divisione-zero', 'SIGFPE'],
  [/stack smashing detected/i, 'esec-fuori-array', 'SIGABRT'],
  [/double free|free\(\): invalid|malloc\(\): |corrupted (?:size|double-linked|top size)|pointer being freed was not allocated|heap corruption/i, 'esec-heap', 'SIGABRT'],
  [/\bstack overflow\b/i, 'esec-stack', null],
  [/access violation|violazione di accesso/i, 'esec-memoria', null],
  [/\bAbort(?:ed)?\b(?: trap)?|\bSIGABRT\b|^\s*Annullato\b|\bAnnullato \(core dump/i, 'esec-abort', 'SIGABRT'],
];

function vuoto(d) {
  return {
    file: null, riga: null, colonna: null, tipo: 'errore', chiave: null, messaggio: '', linguaggio: null, nome: null,
    note: [], righeUscita: {}, dettagli: {}, parti: {}, ...d,
  };
}

// ---------- traceback di Python ----------
function leggiPython(righe, i) {
  const pila = [];
  for (let j = i; j < righe.length; j++) {
    const r = righe[j];
    if (/^\s*Traceback \(most recent call last\):/.test(r)) continue;
    const f = r.match(RE_PY_FILE);
    if (f) { pila.push({ file: f[1], riga: +f[2], funzione: f[3] || null, codice: null }); continue; }
    if (/^\s*\[Previous line repeated/.test(r) || !r.trim()) continue;
    const e = r.match(RE_PY_ECC);
    if (e && !/^\s/.test(r)) return pila.length ? { pila, eccezione: e[1], testo: (e[2] || '').trim(), fine: j } : { fallito: j };
    if (/^\s/.test(r) && pila.length) { if (!CARET.test(r) && pila.at(-1).codice == null) pila.at(-1).codice = r.trim(); continue; }
    return { fallito: j };
  }
  return { fallito: righe.length };
}
function daPython({ pila, eccezione, testo }) {
  // il punto da mostrare è l'ultima chiamata nel codice dello studente, non dentro le librerie di Python
  const tua = [...pila].reverse().find(f => !LIBRERIA_PY.test(f.file)) || pila.at(-1);
  const nome = eccezione.split('.').pop();
  const sintassi = /^(SyntaxError|IndentationError|TabError)$/.test(nome);
  const d = vuoto({
    file: tua.file, riga: tua.riga, tipo: sintassi ? 'errore' : 'esecuzione', linguaggio: 'python',
    messaggio: testo ? `${nome}: ${testo}` : nome, eccezione: nome, funzione: tua.funzione,
    pila: pila.map(({ file, riga, funzione }) => ({ file, riga, funzione })),
  });
  if (tua.codice != null) d.righeUscita[tua.riga] = tua.codice;
  return d;
}

// ---------- eccezioni di Java ----------
function leggiJava(righe, i, m) {
  const pila = []; let j = i + 1;
  for (; j < righe.length; j++) {
    const a = righe[j].match(RE_JAVA_AT);
    if (a) { pila.push({ modulo: a[1] || null, metodo: a[2], file: a[3], riga: a[4] ? +a[4] : null }); continue; }
    if (/^\s*\.\.\. \d+ more/.test(righe[j])) continue;
    break;
  }
  const tua = pila.find(f => !f.modulo && !/^(java|javax|jdk|sun|com\.sun)\./.test(f.metodo) && f.riga) || pila[0] || {};
  const nome = m[1].split('.').pop();
  return {
    fine: j - 1, d: vuoto({
      file: tua.file || null, riga: tua.riga || null, tipo: 'esecuzione', linguaggio: 'java',
      messaggio: m[2] ? `${m[1]}: ${m[2].trim()}` : m[1], eccezione: nome, pila,
    }),
  };
}

// ---------- AddressSanitizer: tipo di errore e prima riga del tuo codice ----------
const ASAN = {
  SEGV: 'esec-memoria', 'unknown-crash': 'esec-memoria', 'stack-overflow': 'esec-stack', FPE: 'esec-divisione-zero',
  'heap-buffer-overflow': 'esec-fuori-array', 'stack-buffer-overflow': 'esec-fuori-array', 'global-buffer-overflow': 'esec-fuori-array',
  'stack-buffer-underflow': 'esec-fuori-array', 'dynamic-stack-buffer-overflow': 'esec-fuori-array', 'stack-use-after-return': 'esec-heap',
  'heap-use-after-free': 'esec-heap', 'double-free': 'esec-heap', 'attempting': 'esec-heap', 'bad-free': 'esec-heap',
  'alloc-dealloc-mismatch': 'esec-heap', 'detected': 'esec-memoria-persa', 'use-of-uninitialized-value': 'esec-non-inizializzata',
};
function leggiAsan(righe, i, m) {
  const d = vuoto({ tipo: 'esecuzione', linguaggio: 'c', chiave: ASAN[m[2]] || 'esec-memoria', messaggio: righe[i].replace(/^=+\d+=+/, '').trim(), dettagli: { sanitizer: m[2] } });
  let j = i + 1;
  for (; j < righe.length && j < i + 400; j++) {
    const r = righe[j];
    if (/address points to the zero page|null pointer/i.test(r)) d.dettagli.nullo = true;
    const w = r.match(/^(READ|WRITE) of size (\d+)/); if (w) d.dettagli.accesso = w[1] === 'WRITE' ? 'scrittura' : 'lettura';
    const f = r.match(RE_ASAN_FRAME);
    if (f && !d.file && !LIBRERIA_C.test(f[2])) Object.assign(d, { file: f[2], riga: +f[3], colonna: f[4] ? +f[4] : null, funzione: f[1] });
    if (/^SUMMARY: \w+Sanitizer/.test(r)) {
      const s = r.match(/\s(\S+?\.(?:c|cc|cpp|h)):(\d+)(?::(\d+))?\s+in\s+(\S+)/);
      if (s && !d.file) Object.assign(d, { file: s[1], riga: +s[2], colonna: s[3] ? +s[3] : null, funzione: s[4] });
      break;
    }
  }
  return { d, fine: Math.min(j, righe.length - 1) };
}

// ---------- analizza ----------
// Restituisce [{ file, riga, colonna, tipo, chiave, messaggio, linguaggio, nome, … }] nell'ordine in cui compaiono.
// tipo: 'errore' (non compila), 'avviso', 'linker' (manca un pezzo quando si uniscono i file) o 'esecuzione' (si è fermato mentre girava).
// chiave: la voce del dizionario (VOCI), oppure null se Lode non conosce questo errore.
export function analizza(testo) {
  const righe = String(testo ?? '').replace(ANSI, '').replace(/\r\n?/g, '\n').split('\n').map(r => daIde(r.length > MAX_RIGA ? r.slice(0, MAX_RIGA) : r));
  const out = [], visti = new Set();
  let ultimo = null, funzione = null, simboli = null, pyFino = -1;
  const metti = d => {
    d = vuoto(d);
    const k = [d.file, d.riga, d.colonna, d.tipo, d.messaggio].join('\0');
    if (visti.has(k)) { ultimo = vuoto({}); return null; }      // i doppioni (stesso header incluso due volte) si saltano
    if (funzione && d.linguaggio !== 'python' && !d.funzione) d.funzione = funzione;
    visti.add(k); out.push(d); ultimo = d; return d;
  };
  const crash = (chiave, extra = {}) => {
    // una frase generica («Abort trap: 6») dopo un errore di esecuzione già letto è lo stesso schianto: non si conta due volte
    if (out.some(d => d.tipo === 'esecuzione')) return null;
    return metti({ tipo: 'esecuzione', linguaggio: 'c', chiave, ...extra });
  };
  for (let i = 0; i < righe.length; i++) {
    const r = righe[i], t = r.trim();
    if (!t) { simboli = null; continue; }
    let m;
    // il codice che il compilatore mostra sotto l'errore: utile quando lo studente incolla l'errore senza il file
    if ((m = r.match(RIGA_CODICE))) { if (ultimo && ultimo.righeUscita[+m[1]] == null) ultimo.righeUscita[+m[1]] = m[2]; continue; }
    if (SOTTO_CODICE.test(r)) continue;
    // «main.c: In function 'main':» (gcc): ricordiamo la funzione per gli errori che seguono
    if ((m = apici(t).match(/^(.+?): (?:In function|Nella funzione|In member function) '([\w$:~]+)':$/))) { funzione = m[2]; continue; }
    if (/^(.+?): (?:At top level|Al livello principale):$/.test(t)) { funzione = null; continue; }
    // Python
    if (i > pyFino && (/^Traceback \(most recent call last\):/.test(t) || RE_PY_FILE.test(r))) {
      const p = leggiPython(righe, i);
      if (p.pila) { metti(daPython(p)); i = p.fine; continue; }
      pyFino = p.fallito;   // fin lì non c'è un traceback intero: non si rilegge da ogni riga
    }
    // Java: eccezione con la pila «at Classe.metodo(File.java:6)»
    if ((m = t.match(RE_JAVA_ECC))) { const j = leggiJava(righe, i, m); metti(j.d); i = j.fine; continue; }
    // AddressSanitizer
    if ((m = t.match(RE_ASAN))) {
      if (m[1] === 'LeakSanitizer' && out.some(d => d.chiave === 'esec-memoria-persa')) continue;
      const a = leggiAsan(righe, i, m); if (!out.some(d => d.tipo === 'esecuzione' && d.chiave === a.d.chiave)) metti(a.d); i = a.fine; continue;
    }
    // assert fallita (Mac, Windows e glibc)
    if ((m = apici(t).match(RE_ASSERT_MAC))) { metti({ file: m[3], riga: +m[4], tipo: 'esecuzione', linguaggio: 'c', chiave: 'esec-asserzione', messaggio: t, funzione: m[2] || null, parti: { cond: m[1].replace(/^\((.*)\)$/, '$1') } }); continue; }
    if ((m = apici(t).match(RE_ASSERT_GLIBC))) { metti({ file: m[1], riga: +m[2], tipo: 'esecuzione', linguaggio: 'c', chiave: 'esec-asserzione', messaggio: t, funzione: m[3].trim(), parti: { cond: m[4] } }); continue; }
    // gcc, clang, MinGW, javac
    if ((m = r.match(RE_GCC)) && !/^\s/.test(r)) {
      const g = gravita(m[4]);
      if (g === 'nota') { if (ultimo) ultimo.note.push({ file: m[1].trim(), riga: +m[2], colonna: m[3] ? +m[3] : null, messaggio: m[5].trim() }); continue; }
      const d = metti({ file: m[1].trim(), riga: +m[2], colonna: m[3] ? +m[3] : null, tipo: g, messaggio: m[5].trim() });
      if (!d) continue;
      // javac e i compilatori vecchi: la riga di codice e il ^ subito sotto, senza numeri
      const a = righe[i + 1], b = righe[i + 2];
      if (a != null && b != null && !RIGA_CODICE.test(a) && !SOTTO_CODICE.test(a) && CARET.test(b) && !RE_GCC.test(a)) {
        d.righeUscita[d.riga] = a; if (!d.colonna) d.colonna = b.indexOf('^') + 1 || null; i += 2;
      }
      // javac: «symbol: variable y», «location: class Main»
      while ((m = (righe[i + 1] || '').match(/^\s+(symbol|simbolo|location|posizione|found|trovato|required|richiesto|reason|motivo)\s*:\s*(.*)$/i))) {
        d.dettagli[m[1].toLowerCase()] = m[2].trim(); i++;
      }
      continue;
    }
    // MSVC
    if ((m = r.match(RE_MSVC))) {
      const g = gravita(m[4]);
      if (g === 'nota') { if (ultimo) ultimo.note.push({ file: m[1].trim(), riga: +m[2], colonna: m[3] ? +m[3] : null, messaggio: m[6].trim() }); continue; }
      metti({ file: m[1].trim(), riga: +m[2], colonna: m[3] ? +m[3] : null, tipo: g, messaggio: m[6].trim(), sigla: m[5].toUpperCase(), linguaggio: 'c' });
      continue;
    }
    if ((m = r.match(RE_LNK))) {
      const sigla = m[3].toUpperCase(); if (sigla === 'LNK1120') continue;   // «1 unresolved externals»: è il riassunto
      metti({ tipo: 'linker', messaggio: m[4].trim(), sigla, linguaggio: 'c', dettagli: { oggetto: m[1].trim() } });
      continue;
    }
    // linker di GNU (gcc, MinGW): «main.c:(.text+0x13): undefined reference to `calcola'»
    const n = apici(r);
    if ((m = n.match(/(?:undefined reference to|riferimento non definito a)\s*['"]([^'"]+)['"]|riferimento a\s*['"]([^'"]+)['"]\s*non definito/i))) {
      const prima = n.slice(Math.max(0, m.index - 300), m.index).match(/((?:(?<![\w.])[A-Za-z]:)?[^:]*?\.(?:c|cc|cpp|cxx))\s*:\s*(?:(\d+)\s*:)?\s*(?:\([^)]*\)\s*:)?\s*$/i);
      metti({ file: prima ? prima[1].trim() : null, riga: prima?.[2] ? +prima[2] : null, tipo: 'linker', chiave: 'riferimento-non-definito', linguaggio: 'c', nome: (m[1] || m[2]).replace(/@\d+$/, ''), messaggio: t });
      continue;
    }
    if ((m = n.match(/(?:multiple definition of|definizione multipla di)\s*['"]([^'"]+)['"]/i))) {
      const prima = n.slice(Math.max(0, m.index - 300), m.index).match(/((?:(?<![\w.])[A-Za-z]:)?[^:]*?\.(?:c|cc|cpp|cxx))\s*:\s*(?:(\d+)\s*:)?\s*(?:\([^)]*\)\s*:)?\s*$/i);
      metti({ file: prima ? prima[1].trim() : null, riga: prima?.[2] ? +prima[2] : null, tipo: 'linker', chiave: 'definizione-multipla', linguaggio: 'c', nome: m[1], messaggio: t });
      continue;
    }
    // lld (clang su Windows e Linux): «ld.lld: error: undefined symbol: calcola»
    if ((m = n.match(/(?:error|errore):\s*(undefined|duplicate) symbol:\s*(\S+)/i))) {
      metti({ tipo: 'linker', chiave: m[1].toLowerCase() === 'undefined' ? 'riferimento-non-definito' : 'definizione-multipla', linguaggio: 'c', nome: m[2].replace(/^_(?=[A-Za-z_])/, ''), messaggio: t });
      continue;
    }
    // linker di Apple: «Undefined symbols for architecture arm64:» e sotto «  "_calcola", referenced from:»
    if (/^Undefined symbols for architecture/i.test(t)) { simboli = 'riferimento-non-definito'; continue; }
    if (simboli && (m = t.match(/^"_?([^"]+)", referenced from:?$/))) {
      metti({ tipo: 'linker', chiave: simboli, linguaggio: 'c', nome: m[1], messaggio: `Undefined symbol: ${m[1]}` });
      continue;
    }
    if ((m = n.match(/^duplicate symbol '?_?([^'\s]+)'? in:?$/i))) {
      metti({ tipo: 'linker', chiave: 'definizione-multipla', linguaggio: 'c', nome: m[1], messaggio: t });
      continue;
    }
    if (simboli && /^\s/.test(r)) continue;
    // strumenti senza file: «clang: error: no such file or directory: 'lista.c'»
    if ((m = r.match(RE_STRUMENTO))) { if (!RIASSUNTO.test(m[2])) metti({ tipo: 'errore', messaggio: m[2].trim(), linguaggio: 'c' }); continue; }
    if (RIASSUNTO.test(t) || /^ld: warning:/i.test(t)) continue;
    // Windows: «Process returned -1073741819 (0xC0000005)», «return value 3221225477», «0xc0000005 Access violation»
    if ((m = t.match(/0x(c0000005|c0000094|c00000fd|c0000409|c0000374|c0000095)\b/i) || t.match(/(?<![\w.])(3221225477|-1073741819|3221225620|-1073741676|3221225725|-1073741571|3221226505|-1073740791|3221226356|-1073740940|3221225621|-1073741675)(?!\d)/))) {
      const hex = (WINDOWS_DEC[m[1]] || m[1]).toLowerCase();
      crash(WINDOWS[hex], { messaggio: t, codiceUscita: '0x' + hex.toUpperCase() });
      continue;
    }
    // shell, make e IDE: «Segmentation fault: 11», «Floating point exception (core dumped)», «make: *** [test] Error 139»
    const c = CRASH.find(([re]) => re.test(t));
    if (c) { crash(c[1], { messaggio: t, segnale: c[2] }); continue; }
    if ((m = t.match(/(?:\bError|exit(?:ed)?(?: with)? (?:code|status)|return value|returned|codice(?: di uscita)?)\s*(?:[=:]\s*)?(13[4-9]|-(?:6|7|8|10|11))\b/i)) && DA_SHELL[m[1]]) {
      crash(SEGNALI[DA_SHELL[m[1]]], { messaggio: t, segnale: DA_SHELL[m[1]] });
      continue;
    }
  }
  for (const d of out) classifica(d);
  return out;
}

// Dall'esito di una prova (spawn senza shell): { codice, segnale, stderr, tempoScaduto } → stessa lista di analizza().
// Se lo stderr non dice niente (un crash spesso non scrive nulla), si usa il segnale o il codice d'uscita.
export function analizzaUscita({ codice = null, segnale = null, stderr = '', tempoScaduto = false } = {}) {
  const lista = analizza(stderr);
  if (lista.some(d => d.tipo === 'esecuzione')) return lista;
  let chiave = null, codiceUscita = null, sig = segnale || null;
  if (tempoScaduto) chiave = 'esec-tempo';
  else if (sig) chiave = SEGNALI[sig] || 'esec-segnale';
  else if (codice != null) {
    const hex = WINDOWS_DEC[String(codice)];
    if (hex) { chiave = WINDOWS[hex]; codiceUscita = '0x' + hex.toUpperCase(); }
    else if (DA_SHELL[codice]) { sig = DA_SHELL[codice]; chiave = SEGNALI[sig]; }
  }
  if (chiave) {
    const d = vuoto({ tipo: 'esecuzione', linguaggio: 'c', chiave, segnale: sig, codiceUscita, codice, messaggio: tempoScaduto ? t('errori.tempo-scaduto') : sig ? t('errori.segnale', { sig }) : codiceUscita ? t('errori.codice-uscita-windows', { codice, codiceUscita }) : t('errori.codice-uscita', { codice }) });
    lista.push(classifica(d));
  }
  return lista;
}

// Il primo errore da mostrare e quanti altri ce ne sono: «e 3 avvisi».
const CAUSE = new Set(['virgolette', 'carattere-strano']);
export function riassunto(lista = []) {
  const gravi = lista.filter(d => d.tipo !== 'avviso');
  let primo = gravi[0] || lista[0] || null;
  // una stringa non chiusa o un carattere strano confondono tutto quello che viene dopo: si mostrano per primi
  const causa = lista.find(d => CAUSE.has(d.chiave));
  if (causa && primo && lista.indexOf(causa) < lista.indexOf(primo) + 1 && (!primo.file || causa.file === primo.file)) primo = causa;
  const errori = Math.max(0, gravi.length - (primo && primo.tipo !== 'avviso' ? 1 : 0));
  const avvisi = lista.filter(d => d.tipo === 'avviso' && d !== primo).length;
  const pz = [];
  const conto = errori && avvisi ? t('errori.conto-errori-e-avvisi', { errori: t('errori.altri-errori', { n: errori }), avvisi: t('errori.avvisi', { n: avvisi }) })
    : errori ? t('errori.conto', { cosa: t('errori.altri-errori', { n: errori }) }) : avvisi ? t('errori.conto', { cosa: t('errori.avvisi', { n: avvisi }) }) : '';
  return { primo, errori, avvisi, conto };
}

// ---------- il dizionario ----------
// Le funzioni della libreria standard e il loro header: per «manca #include».
const HEADER = {};
for (const [h, nomi] of Object.entries({
  'stdio.h': 'printf scanf puts gets fgets fopen fclose fprintf fscanf getchar putchar sprintf snprintf sscanf fputs fgetc fputc getc putc feof ferror perror fflush rewind fseek ftell fread fwrite remove rename EOF FILE stdin stdout stderr',
  'stdlib.h': 'malloc calloc realloc free exit atoi atof atol atoll rand srand abs labs qsort bsearch system strtol strtoul strtod getenv NULL RAND_MAX EXIT_SUCCESS EXIT_FAILURE',
  'string.h': 'strlen strcpy strncpy strcat strncat strcmp strncmp strchr strrchr strstr memset memcpy memmove memcmp strtok strdup strspn strcspn',
  'math.h': 'sqrt pow sin cos tan asin acos atan atan2 fabs floor ceil round trunc log log2 log10 exp fmod hypot cbrt M_PI',
  'ctype.h': 'isdigit isalpha isalnum isspace isupper islower toupper tolower ispunct isxdigit',
  'time.h': 'time clock difftime localtime strftime CLOCKS_PER_SEC',
  'stdbool.h': 'bool true false',
  'limits.h': 'INT_MAX INT_MIN CHAR_MAX CHAR_MIN LONG_MAX LONG_MIN UINT_MAX SHRT_MAX LLONG_MAX',
  'float.h': 'DBL_MAX DBL_MIN FLT_MAX FLT_MIN DBL_EPSILON',
  'assert.h': 'assert',
})) for (const n of nomi.split(' ')) HEADER[n] ??= h;
export const headerDi = nome => HEADER[nome] || null;
const HEADER_NOTI = ['stdio.h', 'stdlib.h', 'string.h', 'math.h', 'ctype.h', 'time.h', 'stdbool.h', 'limits.h', 'float.h', 'assert.h', 'stddef.h', 'stdint.h'];

// MSVC (cl): i codici non cambiano con la lingua di Visual Studio, quindi si riconoscono dal codice
const MSVC = {
  C2143: m => /';'/.test(m) ? 'punto-e-virgola' : /'\)'/.test(m) ? 'parentesi' : /'\}'/.test(m) ? 'graffa' : 'sintassi',
  C2146: m => /';'/.test(m) ? 'punto-e-virgola' : 'sintassi',
  C2065: 'non-dichiarato', C4013: 'funzione-non-dichiarata', C4477: 'formato', C4473: 'argomenti-formato', C4474: 'argomenti-formato',
  C4715: 'return-mancante', C4716: 'return-mancante', C4706: 'assegnamento-in-condizione',
  C4047: m => /^'(==|!=|<|>|<=|>=)'/.test(m) ? 'puntatore-intero' : 'intero-puntatore',
  C4133: 'puntatori-incompatibili', C4101: 'variabile-non-usata', C4189: 'variabile-non-usata', C4100: 'parametro-non-usato',
  C4700: 'non-inizializzata', C4703: 'non-inizializzata', C2371: 'tipi-in-conflitto', C2084: 'ridefinizione', C2086: 'ridefinizione',
  C2198: 'argomenti', C2197: 'argomenti', C2660: 'argomenti', C1075: 'graffa', C1004: 'graffa', C2059: 'sintassi', C2061: 'tipo-sconosciuto',
  C2109: 'non-array', C2223: 'freccia-punto', C2231: 'freccia-punto', C2232: 'freccia-punto', C2039: 'membro-inesistente', C2037: 'membro-inesistente',
  C1083: 'header-non-trovato', C2106: 'non-assegnabile', C2001: 'virgolette', C4390: 'if-vuoto', C4553: 'confronto-inutile', C4552: 'confronto-inutile',
  C4172: 'indirizzo-locale', C4018: 'segni-diversi', C4389: 'segni-diversi', C4098: 'return-void', C2561: 'return-void', C4996: 'non-sicura',
  C2296: 'operandi', C2297: 'operandi', C2088: 'operandi', C2078: 'troppi-inizializzatori', C4723: 'divisione-zero', C2124: 'divisione-zero',
  LNK2019: 'riferimento-non-definito', LNK2001: 'riferimento-non-definito', LNK1561: 'riferimento-non-definito', LNK2005: 'definizione-multipla', LNK1169: 'definizione-multipla',
};

function classifica(d) {
  d.linguaggio ||= linguaDi(d.file) || 'c';
  if (!d.chiave) {
    const m = apici(d.messaggio);
    if (d.sigla && MSVC[d.sigla]) {
      const k = MSVC[d.sigla]; d.chiave = typeof k === 'function' ? k(m) : k;
      if (!d.nome) d.nome = m.match(/'([\w$]+)'/)?.[1] || m.match(/symbol\s+_?([\w$]+)/)?.[1] || null;
      if (d.sigla === 'LNK1561') d.nome = 'main';
      const x = m.match(/'([\w$]+)'\s*:\s*is not a member of '(?:struct )?([\w$]+)'/); if (x) Object.assign(d.parti, { m: x[1], t: x[2] });
    } else if (d.tipo === 'esecuzione' && d.linguaggio === 'c') {
      d.chiave = UBSAN.find(([re]) => re.test(m))?.[1] || null;      // UBSan: «main.c:5:12: runtime error: …»
    } else {
      for (const v of VOCI) {
        if (!v.re || !v.lingue.includes(d.linguaggio)) continue;
        const x = v.re.map(re => m.match(re)).find(Boolean);
        if (x) { d.chiave = v.id; if (x.groups) for (const [k, val] of Object.entries(x.groups)) if (val != null) d.parti[k] = val; const n = d.parti.n || d.parti.n2; if (n) d.nome = n; break; }
      }
    }
  }
  return ritocca(d);
}

// Un avviso di formato in cui serve un puntatore ma arriva un valore: è lo scanf senza & oppure un printf sbagliato
// (printf("%s", c) con char c vuole un char * e riceve un char). Decide la riga, se la conosciamo: c'è uno scanf?
// Senza la riga: un puntatore che non è char * (int *, double *…) lo chiede solo scanf.
const RE_SCANF = /\b(?:[fs]?scanf|scanf_s)\s*\(/;
const senzaE = d => /\*\s*$/.test(d.parti?.atteso || '') && !/[*[]/.test(d.parti?.dato || '');
const eScanf = (riga, d) => riga != null ? RE_SCANF.test(riga) : !/^(?:const )?(?:(?:un)?signed )?char \*$/.test(tipoPulito(d.parti?.atteso).replace(/\s+/g, ' '));
// ritocchi dopo il riconoscimento: dati presi dalle note, voci più precise
function ritocca(d) {
  const m = apici(d.messaggio), note = d.note.map(n => apici(n.messaggio));
  if (!d.nome && d.linguaggio === 'java' && (d.dettagli.symbol || d.dettagli.simbolo)) {
    const s = d.dettagli.symbol || d.dettagli.simbolo; d.nome = s.match(/^\S+\s+([\w$]+)/)?.[1] || null; d.parti.genere = s.split(/\s+/)[0];
  }
  const sugg = [m, ...note].map(t => t.match(/did you mean:?\s*'([^']+)'|forse intendevi:?\s*'([^']+)'/i)).find(Boolean);
  if (sugg && !d.parti.s) d.parti.s = sugg[1] || sugg[2];
  if (d.linguaggio === 'c' && ['non-dichiarato', 'funzione-non-dichiarata', 'tipo-sconosciuto'].includes(d.chiave) && HEADER[d.nome]) d.chiave = 'include-mancante';
  if (d.chiave === 'include-mancante') d.parti.h ||= note.map(n => n.match(/<([\w./]+\.h)>/)?.[1]).find(Boolean) || m.match(/<([\w./]+\.h)>/)?.[1] || HEADER[d.nome] || null;
  if (d.chiave === 'formato' && senzaE(d) && eScanf(d.righeUscita?.[d.riga], d)) d.chiave = 'scanf-e-commerciale';
  if (d.chiave === 'header-non-trovato' && !d.file) d.chiave = 'file-sorgente-mancante';
  if (d.chiave === 'riferimento-non-definito' && d.nome) { d.nome = d.nome.replace(/^_(?=[A-Za-z_])/, ''); if (/^(main|WinMain|wWinMain)$/.test(d.nome)) { d.parti.main = true; d.file = null; d.riga = null; } d.parti.h = HEADER[d.nome] || null; }
  if (d.chiave === 'definizione-multipla' && d.nome) d.nome = d.nome.replace(/^_(?=[A-Za-z_])/, '');
  if (d.chiave === 'non-dichiarato' && d.linguaggio === 'c' && d.nome === 'string') d.chiave = 'tipo-sconosciuto';
  if (d.chiave === 'non-dichiarato' && d.linguaggio === 'java' && /^(Scanner|ArrayList|List|HashMap|Map|HashSet|Set|Random|Arrays|Collections|LinkedList)$/.test(d.nome || '')) d.chiave = 'java-import';
  if (['ridefinizione', 'tipi-in-conflitto'].includes(d.chiave)) { const p = d.note.find(n => /previous|precedente|first defined|prima definizione/i.test(n.messaggio)); if (p) d.parti.prima = p.riga; }
  if (d.chiave === 'non-inizializzata') { const p = d.note.find(n => /initialize the variable|inizializza/i.test(n.messaggio)); if (p) d.parti.dichiarata = p.riga; }
  if (['graffa', 'parentesi'].includes(d.chiave)) { const p = d.note.find(n => /to match this|per chiudere/i.test(apici(n.messaggio))); if (p) { d.parti.aperta = p.riga; d.parti.apertaCol = p.colonna; } }
  if (d.chiave === 'argomenti') { const p = d.note.find(n => /declared here|dichiarat/i.test(n.messaggio)); if (p) { d.parti.dich = p.riga; d.nome ||= apici(p.messaggio).match(/'([\w$]+)'/)?.[1] || null; } }
  return d;
}

// ---------- testi ----------
const cod = s => '`' + String(s).replace(/`/g, "'") + '`';
const conNome = (d, s = t('errori.un-nome')) => d.nome ? cod(d.nome) : s;
// pezzi di frase per il luogo: «alla riga 5» / «nel punto indicato», «la riga 5» / «il punto indicato», «, colonna 3»
const allaRiga = d => d.riga ? t('errori.alla-riga', { n: d.riga }) : t('errori.nel-punto-indicato');
const laRiga = d => d.riga ? t('errori.la-riga', { n: d.riga }) : t('errori.il-punto-indicato');
const colonna = d => d.colonna ? t('errori.colonna', { n: d.colonna }) : '';
const DEL_KW = { if: t('errori.del-if'), while: t('errori.del-while'), for: t('errori.del-for') };
const senzaCondizione = d => d.parti.kw === 'else' || d.parti.kw === 'do';
const tipoPulito = t => String(t || '').replace(/\s*\(aka [^)]*\)/g, '').replace(/'/g, '').trim();
// il formato giusto per printf, solo nei casi sicuri
// e per scanf, che vuole l'indirizzo: il double qui è %lf
const FORMATO_SCANF = { 'int *': '%d', 'short *': '%hd', 'unsigned int *': '%u', 'unsigned *': '%u', 'long *': '%ld', 'long long *': '%lld', 'unsigned long *': '%lu', 'float *': '%f', 'double *': '%lf', 'long double *': '%Lf' };
const FORMATO = { int: '%d', short: '%d', 'unsigned int': '%u', unsigned: '%u', long: '%ld', 'long long': '%lld', 'unsigned long': '%lu', 'unsigned long long': '%llu', size_t: '%zu', double: '%f', float: '%f', char: '%c', 'char *': '%s', 'const char *': '%s' };

// I passi di una voce ricevono (d, x): d è l'errore, x il contesto di spiega()
// (x.riga(n) = testo della riga n o null, x.cambiate = «lista.c 30-52» o null, x.L = «C», «Python» o «Java»).
const VOCI = [
  // ===== C (e le voci comuni a Java) =====
  {
    id: 'for-punto-e-virgola', lingue: ['c', 'java'], re: [/expected ';' in 'for' statement specifier/i], etichetta: t('errori.for-punto-e-virgola.etichetta'),
    frase: () => t('errori.for-punto-e-virgola.frase'),
    dove: d => t('errori.for-punto-e-virgola.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.for-punto-e-virgola.cosa'),
    concetto: t('errori.for-punto-e-virgola.concetto'),
  },
  {
    id: 'punto-e-virgola', lingue: ['c', 'java'], meccanica: true,
    // gcc dopo una dichiarazione (int x = 5 senza ;) scrive «expected ',' or ';' before …»
    re: [/expected ';'(?!,)/i, /expected ',' or ';'/i, /missing ';'/i, /';' expected/i, /(?:atteso|previsto|attesa) ';'|';' (?:atteso|previsto)/i],
    etichetta: t('errori.punto-e-virgola.etichetta'), breve: () => t('errori.punto-e-virgola.breve'),
    frase: () => t('errori.punto-e-virgola.frase'),
    dove: (d, x) => {
      const p = puntoMancante(d, x);
      if (p?.riga && p.riga !== d.riga) return t('errori.punto-e-virgola.dove', { riga: p.riga, riga2: d.riga });
      if (p?.riga) return t('errori.punto-e-virgola.dove-2', { riga: p.riga, colonna: colonna(d) });
      return d.riga ? t('errori.punto-e-virgola.dove-3', { riga: d.riga }) : t('errori.punto-e-virgola.dove-4');
    },
    cosa: (d, x) => t('errori.punto-e-virgola.cosa', { L: x.L }),
    concetto: t('errori.punto-e-virgola.concetto'), correzione: (d, x) => correggiPunto(d, x),
  },
  {
    id: 'include-mancante', lingue: ['c'], meccanica: true,
    re: [/call to undeclared library function '(?<n>[\w$]+)'/i, /implicitly declaring library function '(?<n>[\w$]+)'/i, /incompatible implicit declaration of built-in function '(?<n>[\w$]+)'/i, /dichiarazione implicita incompatibile della funzione (?:built-in |interna )?'(?<n>[\w$]+)'/i],
    etichetta: t('errori.include-mancante.etichetta'), breve: d => t('errori.include-mancante.breve', { h: d.parti.h ? ` <${d.parti.h}>` : '' }),
    frase: d => d.parti.h ? t('errori.include-mancante.frase', { nome: conNome(d, t('errori.include-mancante.frase-2')), h: d.parti.h }) : t('errori.include-mancante.frase-3', { nome: conNome(d, t('errori.include-mancante.frase-4')) }),
    dove: d => t('errori.include-mancante.dove', { h: d.parti.h ? t('errori.include-mancante.dove-2', { h: d.parti.h }) : '' }),
    cosa: d => {
      let s = /^(bool|true|false)$/.test(d.nome || '')
        ? t('errori.include-mancante.cosa', { h: '<stdbool.h>' })
        : t('errori.include-mancante.cosa-2', { nome: conNome(d, t('errori.include-mancante.cosa-3')), h: d.parti.h ? t('errori.include-mancante.cosa-4', { h: d.parti.h }) : '' });
      if (d.parti.h === 'math.h') s += t('errori.include-mancante.cosa-5');
      return s;
    },
    concetto: t('errori.include-mancante.concetto'), correzione: (d, x) => correggiInclude(d, x),
  },
  {
    id: 'funzione-non-dichiarata', lingue: ['c'], re: [/call to undeclared function '(?<n>[\w$]+)'/i, /implicit declaration of function '(?<n>[\w$]+)'/i, /dichiarazione implicita della funzione '(?<n>[\w$]+)'/i],
    etichetta: t('errori.funzione-non-dichiarata.etichetta'), breve: d => t('errori.funzione-non-dichiarata.breve', { nome: d.nome || t('errori.funzione-non-dichiarata.breve-2') }),
    frase: d => t('errori.funzione-non-dichiarata.frase', { nome: conNome(d) }),
    dove: d => (d.riga ? t('errori.funzione-non-dichiarata.dove', { nome: conNome(d), riga: d.riga }) : t('errori.funzione-non-dichiarata.dove-senza-riga', { nome: conNome(d) })),
    cosa: () => t('errori.funzione-non-dichiarata.cosa'),
    concetto: t('errori.funzione-non-dichiarata.concetto'),
  },
  {
    id: 'non-dichiarato', lingue: ['c', 'java'],
    re: [/use of undeclared identifier '(?<n>[\w$]+)'(?:; did you mean '(?<s>[\w$]+)'\?)?/i, /'(?<n>[\w$]+)' undeclared/i, /'(?<n>[\w$]+)' non (?:è )?dichiarat[oa]/i, /cannot find symbol/i, /impossibile trovare il simbolo|simbolo non trovato/i],
    etichetta: t('errori.non-dichiarato.etichetta'), breve: d => t('errori.non-dichiarato.breve', { nome: d.nome || t('errori.non-dichiarato.breve-2') }),
    frase: d => d.nome ? t('errori.non-dichiarato.frase', { nome: cod(d.nome) }) : t('errori.non-dichiarato.frase-2'),
    dove: d => (d.parti.s ? t('errori.non-dichiarato.dove', { s: cod(d.parti.s) }) : '') +
      t('errori.non-dichiarato.dove-2', { nome: conNome(d, t('errori.non-dichiarato.dove-3')) }),
    cosa: d => (d.parti.genere === 'method' || d.parti.genere === 'metodo'
      ? t('errori.non-dichiarato.cosa')
      : t('errori.non-dichiarato.cosa-2')) +
      t('errori.non-dichiarato.cosa-3'),
    concetto: t('errori.non-dichiarato.concetto'),
  },
  {
    id: 'formato', lingue: ['c'],
    re: [/format specifies type '(?<atteso>[^']+)' but the argument has type '(?<dato>[^']+)'/i, /format '(?<f>%[^']*)' expects argument of type '(?<atteso>[^']+)', but argument \d+ has type '(?<dato>[^']+)'/i, /formato '(?<f>%[^']*)'.*?tipo '(?<atteso>[^']+)'.*?tipo '(?<dato>[^']+)'/i],
    etichetta: t('errori.formato.etichetta'),
    frase: d => d.parti.atteso ? t('errori.formato.frase', { atteso: cod(tipoPulito(d.parti.atteso)), dato: cod(tipoPulito(d.parti.dato)) }) : t('errori.formato.frase-2'),
    dove: d => (d.riga ? t('errori.formato.dove', { riga: d.riga }) : t('errori.formato.dove-senza-riga')),
    cosa: (d, x) => {
      const dato = tipoPulito(d.parti.dato).replace(/\s+/g, ' ');
      // scanf: la riga lo dice; senza riga, quando atteso e dato sono tutti e due indirizzi
      const linea = d.riga ? x.riga(d.riga) : null, scanf = linea != null ? RE_SCANF.test(linea) : /\*\s*$/.test(d.parti.atteso || '') && /\*\s*$/.test(d.parti.dato || '');
      if (scanf) {
        const f = FORMATO_SCANF[dato];
        return t('errori.formato.cosa') +
          (f ? t('errori.formato.cosa-2', { dato: cod(dato), p: cod(f) }) : '');
      }
      const f = FORMATO[dato];
      return t('errori.formato.cosa-3') +
        (dato === 'unsigned long' ? t('errori.formato.cosa-4')
          : f ? t('errori.formato.cosa-5', { dato: cod(dato), p: cod(f) }) : '');
    },
    concetto: t('errori.formato.concetto'),
  },
  {
    id: 'scanf-e-commerciale', lingue: ['c'], etichetta: t('errori.scanf-e-commerciale.etichetta'), breve: () => t('errori.scanf-e-commerciale.breve'),
    frase: () => t('errori.scanf-e-commerciale.frase'),
    dove: d => t('errori.scanf-e-commerciale.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.scanf-e-commerciale.cosa'),
    concetto: t('errori.scanf-e-commerciale.concetto'),
  },
  {
    id: 'return-mancante', lingue: ['c', 'java'], meccanica: true,
    re: [/non-void function (?:'(?<n>[\w$]+)' )?does not return a value(?<tutti> in all control paths)?/i, /control reaches end of non-void function/i, /il controllo raggiunge la fine di una funzione non[- ]void/i, /missing return statement/i, /manca (?:l'istruzione )?return|istruzione return mancante/i],
    etichetta: t('errori.return-mancante.etichetta'), breve: () => t('errori.return-mancante.breve'),
    frase: (d, x) => { const f = funzioneDi(d, x); return t('errori.return-mancante.frase', { p: f ? t('errori.return-mancante.frase-2', { nome: cod(f.nome) }) : t('errori.return-mancante.frase-3'), sigla: d.parti.tutti || d.sigla === 'C4715' ? t('errori.return-mancante.frase-4') : '' }); },
    dove: (d, x) => { const f = funzioneDi(d, x); return t('errori.return-mancante.dove', { allaRiga: allaRiga(d), p: f ? ` ${cod(f.nome)}` : '' }); },
    cosa: (d, x) => { const f = funzioneDi(d, x); return t('errori.return-mancante.cosa', { tipo: f?.tipo ? t('errori.return-mancante.cosa-2', { tipo: cod(f.tipo) }) : '' }); },
    concetto: t('errori.return-mancante.concetto'), correzione: (d, x) => correggiReturn(d, x),
  },
  {
    id: 'assegnamento-in-condizione', lingue: ['c', 'java'], meccanica: true,
    re: [/using the result of an assignment as a condition without parentheses/i, /suggest parentheses around assignment used as truth value/i, /parentesi (?:attorno|intorno) all'assegnazione/i],
    etichetta: t('errori.assegnamento-in-condizione.etichetta'), breve: () => t('errori.assegnamento-in-condizione.breve'),
    frase: () => t('errori.assegnamento-in-condizione.frase'),
    dove: d => t('errori.assegnamento-in-condizione.dove', { allaRiga: allaRiga(d), colonna: colonna(d) }),
    cosa: () => t('errori.assegnamento-in-condizione.cosa'),
    concetto: t('errori.assegnamento-in-condizione.concetto'), correzione: (d, x) => correggiUguale(d, x),
  },
  {
    id: 'confronto-stringhe', lingue: ['c'], re: [/result of comparison against a string literal is unspecified/i, /comparison with string literal results in unspecified behavio/i],
    etichetta: t('errori.confronto-stringhe.etichetta'),
    frase: () => t('errori.confronto-stringhe.frase'),
    dove: d => t('errori.confronto-stringhe.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.confronto-stringhe.cosa', { h: '<string.h>' }),
    concetto: t('errori.confronto-stringhe.concetto'),
  },
  {
    id: 'puntatore-intero', lingue: ['c'], re: [/comparison between pointer and integer/i, /confronto tra (?:un )?puntatore e (?:un )?intero/i],
    etichetta: t('errori.puntatore-intero.etichetta'),
    frase: () => t('errori.puntatore-intero.frase'),
    dove: d => t('errori.puntatore-intero.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.puntatore-intero.cosa'),
    concetto: t('errori.puntatore-intero.concetto'),
  },
  {
    id: 'puntatori-incompatibili', lingue: ['c'],
    re: [/incompatible pointer types passing '(?<dato>[^']+)' to parameter of type '(?<atteso>[^']+)'/i, /incompatible pointer types (?:assigning to|initializing) '(?<atteso>[^']+)' (?:from|with an expression of type) '(?<dato>[^']+)'/i, /incompatible pointer types/i, /from incompatible pointer type/i, /tipo di puntatore incompatibile/i],
    etichetta: t('errori.puntatori-incompatibili.etichetta'),
    frase: d => d.parti.dato ? t('errori.puntatori-incompatibili.frase', { dato: cod(tipoPulito(d.parti.dato)), atteso: cod(tipoPulito(d.parti.atteso)) }) : t('errori.puntatori-incompatibili.frase-2'),
    dove: d => (d.riga ? t('errori.puntatori-incompatibili.dove', { riga: d.riga }) : t('errori.puntatori-incompatibili.dove-senza-riga')),
    cosa: () => t('errori.puntatori-incompatibili.cosa'),
    concetto: t('errori.puntatori-incompatibili.concetto'),
  },
  {
    id: 'intero-puntatore', lingue: ['c'],
    re: [/incompatible (?<verso>integer to pointer|pointer to integer) conversion/i, /makes (?<verso2>pointer from integer|integer from pointer) without a cast/i, /crea un (?:puntatore da un intero|intero da un puntatore)/i],
    etichetta: t('errori.intero-puntatore.etichetta'),
    frase: () => t('errori.intero-puntatore.frase'),
    dove: d => (d.riga ? t('errori.intero-puntatore.dove', { riga: d.riga }) : t('errori.intero-puntatore.dove-senza-riga')),
    cosa: d => {
      const m = apici(d.messaggio);
      let s = t('errori.intero-puntatore.cosa');
      if (/take the address with &/i.test(m)) s += t('errori.intero-puntatore.cosa-2');
      if (/dereference with \*/i.test(m)) s += t('errori.intero-puntatore.cosa-3');
      if (/char\[\d*\]|char \*/.test(m) && /'char'|'int'/.test(m)) s += t('errori.intero-puntatore.cosa-4');
      return s;
    },
    concetto: t('errori.intero-puntatore.concetto'),
  },
  {
    id: 'variabile-non-usata', lingue: ['c'], re: [/unused variable '(?<n>[\w$]+)'/i, /variable '(?<n>[\w$]+)' set but not used/i, /variabile '(?<n>[\w$]+)' (?:non usata|impostata ma non usata|non utilizzata)/i],
    etichetta: t('errori.variabile-non-usata.etichetta'), breve: d => t('errori.variabile-non-usata.breve', { nome: d.nome || t('errori.variabile-non-usata.breve-2') }),
    frase: d => t('errori.variabile-non-usata.frase', { nome: conNome(d, t('errori.variabile-non-usata.frase-2')) }),
    dove: d => t('errori.variabile-non-usata.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.variabile-non-usata.cosa'),
    concetto: t('errori.variabile-non-usata.concetto'),
  },
  {
    id: 'parametro-non-usato', lingue: ['c'], re: [/unused parameter '(?<n>[\w$]+)'/i, /parametro '(?<n>[\w$]+)' non (?:usato|utilizzato)/i],
    etichetta: t('errori.parametro-non-usato.etichetta'),
    frase: d => t('errori.parametro-non-usato.frase', { nome: conNome(d, '') }),
    dove: d => t('errori.parametro-non-usato.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.parametro-non-usato.cosa'),
    concetto: t('errori.parametro-non-usato.concetto'),
  },
  {
    id: 'non-inizializzata', lingue: ['c', 'java'],
    re: [/variable '(?<n>[\w$]+)' is uninitialized when used here/i, /'(?<n>[\w$]+)' is used uninitialized/i, /'(?<n>[\w$]+)' may be used uninitialized/i, /variable '(?<n>[\w$]+)' is used uninitialized whenever/i, /'(?<n>[\w$]+)' (?:è|viene) usat[ao] (?:senza essere )?(?:non )?inizializzat/i, /variable (?<n>[\w$]+) might not have been initialized/i, /la variabile (?<n>[\w$]+) potrebbe non essere stata inizializzata/i],
    etichetta: t('errori.non-inizializzata.etichetta'), breve: d => t('errori.non-inizializzata.breve', { nome: d.nome || t('errori.non-inizializzata.breve-2') }),
    frase: d => t('errori.non-inizializzata.frase', { nome: conNome(d, t('errori.non-inizializzata.frase-2')) }),
    dove: d => t('errori.non-inizializzata.dove', { laRiga: laRiga(d), nome: conNome(d, t('errori.non-inizializzata.dove-2')), dichiarata: d.parti.dichiarata ? t('errori.non-inizializzata.dove-3', { dichiarata: d.parti.dichiarata }) : '' }),
    cosa: (d, x) => x.L === 'Java'
      ? t('errori.non-inizializzata.cosa')
      : t('errori.non-inizializzata.cosa-2'),
    concetto: t('errori.non-inizializzata.concetto'),
  },
  {
    id: 'riferimento-non-definito', lingue: ['c'], etichetta: t('errori.riferimento-non-definito.etichetta'), breve: d => d.parti.main ? t('errori.riferimento-non-definito.breve') : t('errori.riferimento-non-definito.breve-2', { nome: d.nome || t('errori.riferimento-non-definito.breve-3') }),
    frase: d => d.parti.main ? t('errori.riferimento-non-definito.frase') : d.parti.h === 'math.h' ? t('errori.riferimento-non-definito.frase-2', { nome: conNome(d) }) : t('errori.riferimento-non-definito.frase-3', { nome: conNome(d, t('errori.riferimento-non-definito.frase-4')) }),
    dove: d => d.parti.main
      ? t('errori.riferimento-non-definito.dove')
      : d.parti.h === 'math.h' ? t('errori.riferimento-non-definito.dove-2')
        : t('errori.riferimento-non-definito.dove-3', { nome: conNome(d, t('errori.riferimento-non-definito.dove-4')) }),
    cosa: d => d.parti.main
      ? t('errori.riferimento-non-definito.cosa')
      : d.parti.h === 'math.h' ? t('errori.riferimento-non-definito.cosa-2', { h: '<math.h>' })
        : t('errori.riferimento-non-definito.cosa-3'),
    concetto: t('errori.riferimento-non-definito.concetto'),
  },
  {
    id: 'definizione-multipla', lingue: ['c'], etichetta: t('errori.definizione-multipla.etichetta'), breve: d => t('errori.definizione-multipla.breve', { nome: d.nome || t('errori.definizione-multipla.breve-2') }),
    frase: d => t('errori.definizione-multipla.frase', { nome: conNome(d, t('errori.definizione-multipla.frase-2')) }),
    dove: d => t('errori.definizione-multipla.dove', { nome: conNome(d, t('errori.definizione-multipla.dove-2')) }),
    cosa: () => t('errori.definizione-multipla.cosa'),
    concetto: t('errori.definizione-multipla.concetto'),
  },
  {
    id: 'tipi-in-conflitto', lingue: ['c'], re: [/conflicting types for '(?<n>[\w$]+)'/i, /tipi in conflitto per '(?<n>[\w$]+)'/i],
    etichetta: t('errori.tipi-in-conflitto.etichetta'),
    frase: d => t('errori.tipi-in-conflitto.frase', { nome: conNome(d, t('errori.tipi-in-conflitto.frase-2')) }),
    dove: d => (d.riga ? t('errori.tipi-in-conflitto.dove', { riga: d.riga, prima: d.parti.prima ? t('errori.tipi-in-conflitto.dove-3', { prima: d.parti.prima }) : '' }) : t('errori.tipi-in-conflitto.dove-senza-riga', { prima: d.parti.prima ? t('errori.tipi-in-conflitto.dove-3', { prima: d.parti.prima }) : '' })) +
      (d.note.some(n => /implicit/i.test(n.messaggio)) ? t('errori.tipi-in-conflitto.dove-4', { nome: conNome(d, t('errori.tipi-in-conflitto.dove-5')) }) : ''),
    cosa: () => t('errori.tipi-in-conflitto.cosa'),
    concetto: t('errori.tipi-in-conflitto.concetto'),
  },
  {
    id: 'argomenti', lingue: ['c', 'java'],
    re: [/too (?<q>few|many) arguments to function call, expected (?<e>\d+), have (?<h>\d+)/i, /too (?<q>few|many) arguments to function '(?<n>[\w$]+)'/i, /troppo (?<q>pochi|molti) argomenti (?:per la|alla) funzione '?(?<n>[\w$]+)?/i, /method (?<n>[\w$]+) in (?:class|interface) [\w$<>]+ cannot be applied to given types/i, /constructor (?<n>[\w$]+) in class [\w$<>]+ cannot be applied/i],
    etichetta: t('errori.argomenti.etichetta'),
    frase: d => {
      const q = d.parti.q, poco = q === 'few' || q === 'pochi', tanti = q === 'many' || q === 'molti';
      const quanti = d.parti.e ? t('errori.argomenti.frase', { h: d.parti.h, e: d.parti.e }) : '';
      return poco ? t('errori.argomenti.frase-2', { quanti }) : tanti ? t('errori.argomenti.frase-3', { quanti }) : t('errori.argomenti.frase-4', { nome: conNome(d, t('errori.argomenti.frase-5')) });
    },
    dove: d => t('errori.argomenti.dove', { allaRiga: allaRiga(d), nome: d.nome ? ` ${cod(d.nome)}` : '', dich: d.parti.dich ? t('errori.argomenti.dove-2', { dich: d.parti.dich }) : '' }),
    cosa: () => t('errori.argomenti.cosa'),
    concetto: t('errori.argomenti.concetto'),
  },
  {
    id: 'graffa', lingue: ['c', 'java'],
    re: [/expected '\}'/i, /expected declaration or statement at end of input/i, /reached end of file while parsing/i, /(?<troppa>extraneous closing brace)/i, /(?:atteso|previsto) '\}'|fine (?:del file|dell'input) raggiunta/i],
    etichetta: t('errori.graffa.etichetta'),
    frase: d => d.parti.troppa ? t('errori.graffa.frase') : t('errori.graffa.frase-2'),
    dove: d => d.parti.troppa ? t('errori.graffa.dove', { allaRiga: allaRiga(d) })
      : t('errori.graffa.dove-2', { riga: d.riga ? t('errori.graffa.dove-3', { riga: d.riga }) : '', aperta: d.parti.aperta ? t('errori.graffa.dove-4', { aperta: d.parti.aperta }) : '' }),
    cosa: () => t('errori.graffa.cosa'),
    concetto: t('errori.graffa.concetto'),
  },
  {
    id: 'parentesi', lingue: ['c', 'java'], re: [/expected '\)'/i, /missing '\)'/i, /'\)' expected/i, /(?:atteso|previsto) '\)'|'\)' (?:atteso|previsto)/i],
    etichetta: t('errori.parentesi.etichetta'),
    frase: () => t('errori.parentesi.frase'),
    dove: d => d.parti.aperta ? t('errori.parentesi.dove', { aperta: d.parti.aperta, apertaCol: d.parti.apertaCol ? t('errori.parentesi.dove-2', { apertaCol: d.parti.apertaCol }) : '', allaRiga: allaRiga(d) }) : (d.riga ? t('errori.parentesi.dove-3', { riga: d.riga }) : t('errori.parentesi.dove-3-senza-riga')),
    cosa: () => t('errori.parentesi.cosa'),
    concetto: t('errori.parentesi.concetto'),
  },
  {
    id: 'espressione-attesa', lingue: ['c', 'java'], re: [/expected expression/i, /illegal start of expression/i, /(?:attesa|prevista) (?:un'|una )?espressione|inizio (?:non valido|illegale) (?:dell'|di )espressione/i],
    etichetta: t('errori.espressione-attesa.etichetta'),
    frase: () => t('errori.espressione-attesa.frase'),
    dove: d => t('errori.espressione-attesa.dove', { laRiga: laRiga(d), colonna: colonna(d) }),
    cosa: () => t('errori.espressione-attesa.cosa'),
    concetto: t('errori.espressione-attesa.concetto'),
  },
  {
    id: 'ridefinizione', lingue: ['c', 'java'], re: [/redefinition of '(?<n>[\w$]+)'/i, /redeclaration of '(?<n>[\w$]+)'/i, /(?:ridefinizione|ridichiarazione) di '(?<n>[\w$]+)'/i, /variable (?<n>[\w$]+) is already defined in/i, /la variabile (?<n>[\w$]+) è già definita/i],
    etichetta: t('errori.ridefinizione.etichetta'), breve: d => t('errori.ridefinizione.breve', { nome: d.nome || t('errori.ridefinizione.breve-2') }),
    frase: d => t('errori.ridefinizione.frase', { nome: conNome(d, t('errori.ridefinizione.frase-2')) }),
    dove: d => d.parti.prima ? t('errori.ridefinizione.dove', { prima: d.parti.prima, riga: d.riga }) : (d.riga ? t('errori.ridefinizione.dove-2', { riga: d.riga, nome: conNome(d, t('errori.ridefinizione.dove-4')) }) : t('errori.ridefinizione.dove-2-senza-riga', { nome: conNome(d, t('errori.ridefinizione.dove-4')) })),
    cosa: () => t('errori.ridefinizione.cosa'),
    concetto: t('errori.ridefinizione.concetto'),
  },
  {
    id: 'non-array', lingue: ['c', 'java'], re: [/subscripted value is not an array, pointer, or vector/i, /subscripted value is neither array nor pointer/i, /array required, but [\w$]+ found/i, /il valore indicizzato non è né un array né un puntatore/i],
    etichetta: t('errori.non-array.etichetta'),
    frase: () => t('errori.non-array.frase'),
    dove: d => t('errori.non-array.dove', { allaRiga: allaRiga(d), colonna: colonna(d) }),
    cosa: () => t('errori.non-array.cosa'),
    concetto: t('errori.non-array.concetto'),
  },
  {
    id: 'freccia-punto', lingue: ['c'],
    re: [/member reference type '[^']+' is a pointer; did you mean to use '(?<usa>->)'/i, /member reference type '[^']+' is not a pointer; did you mean to use '(?<usa>\.)'/i, /'[\w$]+' is a pointer; did you mean to use '(?<usa>->)'/i, /invalid type argument of '->'/i, /request for member '(?<m>[\w$]+)' in something not a structure or union/i],
    etichetta: t('errori.freccia-punto.etichetta'),
    frase: d => d.parti.usa === '.' ? t('errori.freccia-punto.frase') : d.parti.usa === '->' ? t('errori.freccia-punto.frase-2') : t('errori.freccia-punto.frase-3'),
    dove: d => t('errori.freccia-punto.dove', { laRiga: laRiga(d), colonna: colonna(d) }),
    cosa: () => t('errori.freccia-punto.cosa'),
    concetto: t('errori.freccia-punto.concetto'),
  },
  {
    id: 'membro-inesistente', lingue: ['c'], re: [/no member named '(?<m>[\w$]+)' in '(?<t>[^']+)'/i, /'(?<t>[^']+)' has no member named '(?<m>[\w$]+)'/i, /'(?<t>[^']+)' non ha un membro (?:chiamato|di nome) '(?<m>[\w$]+)'/i],
    etichetta: t('errori.membro-inesistente.etichetta'),
    frase: d => d.parti.m ? t('errori.membro-inesistente.frase', { p: cod(tipoPulito(d.parti.t || t('errori.membro-inesistente.frase-2'))), m: cod(d.parti.m) }) : t('errori.membro-inesistente.frase-3'),
    dove: d => t('errori.membro-inesistente.dove', { p: d.parti.t ? ` ${cod(tipoPulito(d.parti.t))}` : '', m: d.parti.m ? t('errori.membro-inesistente.dove-2', { m: cod(d.parti.m) }) : '' }),
    cosa: () => t('errori.membro-inesistente.cosa'),
    concetto: t('errori.membro-inesistente.concetto'),
  },
  {
    id: 'header-non-trovato', lingue: ['c'], re: [/'(?<h>[^']+)' file not found/i, /^(?<h>[\w./\\-]+\.h(?:pp)?): No such file or directory/i, /^(?<h>[\w./\\-]+\.h(?:pp)?): (?:File o directory non esistente|file o directory inesistente)/i, /Cannot open include file: '(?<h>[^']+)'/i],
    etichetta: t('errori.header-non-trovato.etichetta'),
    frase: d => t('errori.header-non-trovato.frase', { h: cod(d.parti.h || t('errori.header-non-trovato.frase-2')) }),
    dove: d => {
      const h = d.parti.h || '', v = vicino(h);
      let s = t('errori.header-non-trovato.dove', { allaRiga: allaRiga(d) });
      if (v && v !== h) s += t('errori.header-non-trovato.dove-2', { v: cod(v) });
      if (/^conio\.h$/i.test(h)) s += t('errori.header-non-trovato.dove-3');
      return s;
    },
    cosa: () => t('errori.header-non-trovato.cosa', { sistema: '<nome.h>', progetto: '"nome.h"' }),
    concetto: t('errori.header-non-trovato.concetto'),
  },
  {
    id: 'file-sorgente-mancante', lingue: ['c'], re: [/no such file or directory: '(?<h>[^']+)'/i, /^(?<h>[^:]+\.(?:c|cc|cpp|o)): No such file or directory/i],
    etichetta: t('errori.file-sorgente-mancante.etichetta'),
    frase: d => t('errori.file-sorgente-mancante.frase', { h: cod(nomeFile(d.parti.h) || t('errori.file-sorgente-mancante.frase-2')) }),
    dove: () => t('errori.file-sorgente-mancante.dove'),
    cosa: () => t('errori.file-sorgente-mancante.cosa'),
    concetto: t('errori.file-sorgente-mancante.concetto'),
  },
  {
    id: 'non-assegnabile', lingue: ['c'], re: [/array type '(?<arr>[^']+)' is not assignable/i, /(?<arr>assignment to expression with array type)/i, /expression is not assignable/i, /lvalue required as left operand of assignment/i, /richiesto un lvalue/i],
    etichetta: t('errori.non-assegnabile.etichetta'),
    frase: d => d.parti.arr ? t('errori.non-assegnabile.frase') : t('errori.non-assegnabile.frase-2'),
    dove: d => t('errori.non-assegnabile.dove', { allaRiga: allaRiga(d) }),
    cosa: d => d.parti.arr
      ? t('errori.non-assegnabile.cosa', { h: '<string.h>' })
      : t('errori.non-assegnabile.cosa-2'),
    concetto: t('errori.non-assegnabile.concetto'),
  },
  {
    id: 'tipo-sconosciuto', lingue: ['c'], re: [/unknown type name '(?<n>[\w$]+)'/i, /nome di tipo '(?<n>[\w$]+)' sconosciuto/i],
    etichetta: t('errori.tipo-sconosciuto.etichetta'),
    frase: d => t('errori.tipo-sconosciuto.frase', { nome: conNome(d, t('errori.tipo-sconosciuto.frase-2')) }),
    dove: d => t('errori.tipo-sconosciuto.dove', { laRiga: laRiga(d), nome: conNome(d, t('errori.tipo-sconosciuto.dove-2')) }),
    cosa: d => d.nome === 'string'
      ? t('errori.tipo-sconosciuto.cosa')
      : t('errori.tipo-sconosciuto.cosa-2'),
    concetto: t('errori.tipo-sconosciuto.concetto'),
  },
  {
    id: 'virgolette', lingue: ['c', 'java'], re: [/missing terminating '?["']'? character/i, /unclosed string literal/i, /stringa (?:letterale )?non chiusa|manca il carattere '?"'? di (?:chiusura|terminazione)/i],
    etichetta: t('errori.virgolette.etichetta'),
    frase: () => t('errori.virgolette.frase'),
    dove: d => t('errori.virgolette.dove', { laRiga: laRiga(d), colonna: colonna(d) }),
    cosa: () => t('errori.virgolette.cosa'),
    concetto: t('errori.virgolette.concetto'),
  },
  {
    id: 'if-vuoto', lingue: ['c'], re: [/(?<kw>if|while|for) (?:statement|loop) has empty body/i, /suggest braces around empty body in an? '(?<kw>if|else|do)' statement/i, /corpo vuoto/i],
    etichetta: t('errori.if-vuoto.etichetta'),
    frase: d => senzaCondizione(d) ? t('errori.if-vuoto.frase', { kw: d.parti.kw }) : t('errori.if-vuoto.frase-2', { if: DEL_KW[d.parti.kw] || DEL_KW.if }),
    dove: d => senzaCondizione(d) ? (d.riga ? t('errori.if-vuoto.dove', { riga: d.riga, kw: d.parti.kw }) : t('errori.if-vuoto.dove-senza-riga', { kw: d.parti.kw })) : (d.riga ? t('errori.if-vuoto.dove-3', { riga: d.riga }) : t('errori.if-vuoto.dove-3-senza-riga')),
    cosa: d => d.parti.kw === 'else' ? t('errori.if-vuoto.cosa')
      : d.parti.kw === 'do' ? t('errori.if-vuoto.cosa-2')
        : t('errori.if-vuoto.cosa-3'),
    concetto: t('errori.if-vuoto.concetto'),
  },
  {
    id: 'confronto-inutile', lingue: ['c'], re: [/(?<uguale>equality) comparison result unused/i, /statement with no effect/i, /expression result unused/i, /l'istruzione non ha effetto/i],
    etichetta: t('errori.confronto-inutile.etichetta'),
    frase: d => d.parti.uguale || /'=='/.test(apici(d.messaggio)) ? t('errori.confronto-inutile.frase') : t('errori.confronto-inutile.frase-2'),
    dove: d => t('errori.confronto-inutile.dove', { laRiga: laRiga(d), colonna: colonna(d) }),
    cosa: d => d.parti.uguale || /'=='/.test(apici(d.messaggio))
      ? t('errori.confronto-inutile.cosa')
      : t('errori.confronto-inutile.cosa-2'),
    concetto: t('errori.confronto-inutile.concetto'),
  },
  {
    id: 'indirizzo-locale', lingue: ['c'], re: [/address of stack memory associated with local variable '(?<n>[\w$]+)' returned/i, /function returns address of local variable/i, /restituisce l'indirizzo di una variabile locale/i],
    etichetta: t('errori.indirizzo-locale.etichetta'),
    frase: d => t('errori.indirizzo-locale.frase', { nome: conNome(d, t('errori.indirizzo-locale.frase-2')) }),
    dove: d => t('errori.indirizzo-locale.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.indirizzo-locale.cosa'),
    concetto: t('errori.indirizzo-locale.concetto'),
  },
  {
    id: 'segni-diversi', lingue: ['c'], re: [/comparison of integers of different signs/i, /comparison of integer expressions of different signedness/i, /comparison between signed and unsigned/i, /confronto tra (?:espressioni )?(?:intere )?(?:con e senza segno|signed e unsigned)/i],
    etichetta: t('errori.segni-diversi.etichetta'),
    frase: () => t('errori.segni-diversi.frase'),
    dove: d => t('errori.segni-diversi.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.segni-diversi.cosa'),
    concetto: t('errori.segni-diversi.concetto'),
  },
  {
    id: 'return-void', lingue: ['c', 'java'], re: [/void function '(?<n>[\w$]+)' should not return a value/i, /'return' with a value, in function returning void/i, /(?<senza>non-void function '(?<n2>[\w$]+)' should return a value)/i, /(?<senza2>'return' with no value, in function returning non-void)/i, /unexpected return value/i, /(?<senza3>missing return value)/i],
    etichetta: t('errori.return-void.etichetta'),
    frase: d => d.parti.senza || d.parti.senza2 || d.parti.senza3 || d.sigla === 'C2561' ? t('errori.return-void.frase') : t('errori.return-void.frase-2'),
    dove: d => t('errori.return-void.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.return-void.cosa'),
    concetto: t('errori.return-void.concetto'),
  },
  {
    id: 'main-int', lingue: ['c'], re: [/'main' must return 'int'/i, /return type of 'main' is not 'int'/i, /il tipo (?:restituito|di ritorno) di 'main' non è 'int'/i],
    etichetta: t('errori.main-int.etichetta'),
    frase: () => t('errori.main-int.frase'),
    dove: d => t('errori.main-int.dove', { riga: d.riga ? t('errori.main-int.dove-2', { riga: d.riga }) : '' }),
    cosa: () => t('errori.main-int.cosa'),
    concetto: t('errori.main-int.concetto'),
  },
  {
    id: 'fuori-array', lingue: ['c'], re: [/array index (?<i>-?\d+) is (?:past the end|before the beginning) of the array/i, /array subscript (?<i>-?\d+) is (?:above|below) array bounds/i, /indice (?<i>-?\d+) (?:dell'array )?(?:fuori|oltre)/i],
    etichetta: t('errori.fuori-array.etichetta'),
    frase: d => d.parti.i != null ? t('errori.fuori-array.frase', { i: d.parti.i }) : t('errori.fuori-array.frase-2'),
    dove: d => t('errori.fuori-array.dove', { laRiga: laRiga(d), riga: d.note[0]?.riga ? t('errori.fuori-array.dove-2', { riga: d.note[0].riga }) : '' }),
    cosa: () => t('errori.fuori-array.cosa'),
    concetto: t('errori.fuori-array.concetto'),
  },
  {
    id: 'argomenti-formato', lingue: ['c'], re: [/(?<piu>more '%' conversions than data arguments)/i, /data argument not used by format string/i, /too many arguments for format/i, /(?<piu2>expects a matching '[^']+' argument)/i, /(?<piu3>too few arguments for format)/i],
    etichetta: t('errori.argomenti-formato.etichetta'),
    frase: d => d.parti.piu || d.parti.piu2 || d.parti.piu3 || d.sigla === 'C4473' ? t('errori.argomenti-formato.frase') : t('errori.argomenti-formato.frase-2'),
    dove: d => t('errori.argomenti-formato.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.argomenti-formato.cosa'),
    concetto: t('errori.argomenti-formato.concetto'),
  },
  {
    id: 'divisione-zero', lingue: ['c'], re: [/(?:division|remainder) by zero is undefined/i, /^division by zero/i, /divisione per zero/i],
    etichetta: t('errori.divisione-zero.etichetta'),
    frase: () => t('errori.divisione-zero.frase'),
    dove: d => t('errori.divisione-zero.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.divisione-zero.cosa'),
    concetto: t('errori.divisione-zero.concetto'),
  },
  {
    id: 'troppi-inizializzatori', lingue: ['c'], re: [/excess elements in (?:array|scalar|struct) initializer/i, /(?:troppi|elementi in eccesso).*inizializzator/i],
    etichetta: t('errori.troppi-inizializzatori.etichetta'),
    frase: () => t('errori.troppi-inizializzatori.frase'),
    dove: d => t('errori.troppi-inizializzatori.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.troppi-inizializzatori.cosa'),
    concetto: t('errori.troppi-inizializzatori.concetto'),
  },
  {
    id: 'operandi', lingue: ['c', 'java'], re: [/invalid operands to binary expression \('(?<a>[^']+)' and '(?<b>[^']+)'\)/i, /invalid operands to binary \S+ \(have '(?<a>[^']+)' and '(?<b>[^']+)'\)/i, /bad operand types for binary operator/i, /operandi non validi/i],
    etichetta: t('errori.operandi.etichetta'),
    frase: d => d.parti.a ? t('errori.operandi.frase', { a: cod(tipoPulito(d.parti.a)), b: cod(tipoPulito(d.parti.b)) }) : t('errori.operandi.frase-2'),
    dove: d => t('errori.operandi.dove', { allaRiga: allaRiga(d), colonna: colonna(d) }),
    cosa: (d, x) => x.L === 'Java'
      ? t('errori.operandi.cosa')
      : t('errori.operandi.cosa-2'),
    concetto: t('errori.operandi.concetto'),
  },
  {
    id: 'carattere-strano', lingue: ['c', 'java'], re: [/stray '\\?[^']*' in program/i, /illegal character: '\\?[^']*'/i, /non-ASCII characters are not allowed outside of literals/i, /carattere (?:non valido|illegale|vagante)/i],
    etichetta: t('errori.carattere-strano.etichetta'),
    frase: () => t('errori.carattere-strano.frase'),
    dove: d => t('errori.carattere-strano.dove', { laRiga: laRiga(d), colonna: colonna(d) }),
    cosa: () => t('errori.carattere-strano.cosa'),
    concetto: t('errori.carattere-strano.concetto'),
  },
  {
    id: 'non-sicura', lingue: ['c'], re: [/This function or variable may be unsafe/i, /potrebbe non essere sicur/i],
    etichetta: t('errori.non-sicura.etichetta'),
    frase: d => t('errori.non-sicura.frase', { nome: conNome(d, t('errori.non-sicura.frase-2')) }),
    dove: () => t('errori.non-sicura.dove'),
    cosa: () => t('errori.non-sicura.cosa'),
    concetto: t('errori.non-sicura.concetto'),
  },
  {
    id: 'ricorsione-infinita', lingue: ['c', 'java'], re: [/all paths through this function will call itself/i, /infinite recursion detected/i, /ricorsione infinita/i],
    etichetta: t('errori.ricorsione-infinita.etichetta'),
    frase: () => t('errori.ricorsione-infinita.frase'),
    dove: (d, x) => { const f = funzioneDi(d, x); return t('errori.ricorsione-infinita.dove', { p: f ? ` ${cod(f.nome)}` : '', allaRiga: allaRiga(d) }); },
    cosa: () => t('errori.ricorsione-infinita.cosa'),
    concetto: t('errori.ricorsione-infinita.concetto'),
  },
  {
    id: 'sintassi', lingue: ['c', 'java'], re: [/expected (?:identifier|statement|declaration|unqualified-id|'\(')/i, /expected '=', ','/i, /<identifier> expected/i, /not a statement/i, /class, interface, enum, or record expected/i, /syntax error/i, /errore di sintassi/i],
    etichetta: t('errori.sintassi.etichetta'),
    frase: () => t('errori.sintassi.frase'),
    dove: d => t('errori.sintassi.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.sintassi.cosa'),
    concetto: t('errori.sintassi.concetto'),
  },

  // ===== Java (solo quello che cambia rispetto al C) =====
  {
    id: 'java-tipi', lingue: ['java'], re: [/(?<perdita>possible lossy conversion) from (?<dato>[\w$.<>\[\]]+) to (?<atteso>[\w$.<>\[\]]+)/i, /incompatible types: (?<dato>.+?) cannot be converted to (?<atteso>.+)$/i, /tipi incompatibili/i],
    etichetta: t('errori.java-tipi.etichetta'),
    frase: d => d.parti.perdita ? t('errori.java-tipi.frase', { dato: cod(d.parti.dato), atteso: cod(d.parti.atteso) }) : d.parti.dato ? t('errori.java-tipi.frase-2', { dato: cod(d.parti.dato), atteso: cod(d.parti.atteso) }) : t('errori.java-tipi.frase-3'),
    dove: d => t('errori.java-tipi.dove', { laRiga: laRiga(d), colonna: colonna(d) }),
    cosa: () => t('errori.java-tipi.cosa'),
    concetto: t('errori.java-tipi.concetto'),
  },
  {
    id: 'java-import', lingue: ['java'], etichetta: t('errori.java-import.etichetta'),
    frase: d => t('errori.java-import.frase', { nome: conNome(d, t('errori.java-import.frase-2')) }),
    dove: () => t('errori.java-import.dove'),
    cosa: d => t('errori.java-import.cosa', { nome: conNome(d, t('errori.java-import.cosa-2')), nome2: /^(Scanner|ArrayList|List|HashMap|Map|HashSet|Set|Random|Arrays|Collections|LinkedList)$/.test(d.nome || '') ? t('errori.java-import.cosa-3', { nome: d.nome }) : '' }),
    concetto: t('errori.java-import.concetto'),
  },
  {
    id: 'java-nome-file', lingue: ['java'], re: [/class (?<n>[\w$]+) is public, should be declared in a file named (?<f>\S+)/i, /la classe (?<n>[\w$]+) è pubblica/i],
    etichetta: t('errori.java-nome-file.etichetta'),
    frase: d => t('errori.java-nome-file.frase', { nome: conNome(d, t('errori.java-nome-file.frase-2')), nome2: cod((d.nome || t('errori.java-nome-file.frase-3')) + '.java') }),
    dove: () => t('errori.java-nome-file.dove'),
    cosa: () => t('errori.java-nome-file.cosa'),
    concetto: t('errori.java-nome-file.concetto'),
  },
  {
    id: 'java-statico', lingue: ['java'], re: [/non-static (?:variable|method) (?<n>[\w$]+).*cannot be referenced from a static context/i, /non statico .* contesto statico/i],
    etichetta: t('errori.java-statico.etichetta'),
    frase: d => t('errori.java-statico.frase', { nome: conNome(d, t('errori.java-statico.frase-2')) }),
    dove: d => t('errori.java-statico.dove', { laRiga: laRiga(d), nome: conNome(d, t('errori.java-statico.dove-2')) }),
    cosa: () => t('errori.java-statico.cosa'),
    concetto: t('errori.java-statico.concetto'),
  },
  {
    id: 'java-irraggiungibile', lingue: ['java'], re: [/unreachable statement/i, /istruzione non raggiungibile/i],
    etichetta: t('errori.java-irraggiungibile.etichetta'),
    frase: () => t('errori.java-irraggiungibile.frase'),
    dove: d => t('errori.java-irraggiungibile.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.java-irraggiungibile.cosa'),
    concetto: t('errori.java-irraggiungibile.concetto'),
  },
  {
    id: 'java-indice', lingue: ['java'], re: [/(?:ArrayIndexOutOfBounds|StringIndexOutOfBounds|IndexOutOfBounds)Exception(?::\s*(?:Index (?<i>-?\d+) out of bounds for length (?<l>\d+))?)?/],
    etichetta: t('errori.java-indice.etichetta'),
    frase: d => d.parti.i != null ? t('errori.java-indice.frase', { i: d.parti.i, l: d.parti.l }) : t('errori.java-indice.frase-2'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.java-indice.cosa'),
    concetto: t('errori.java-indice.concetto'),
  },
  {
    id: 'java-null', lingue: ['java'], re: [/NullPointerException/],
    etichetta: t('errori.java-null.etichetta'),
    frase: () => t('errori.java-null.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.java-null.cosa'),
    concetto: t('errori.java-null.concetto'),
  },
  {
    id: 'java-divisione-zero', lingue: ['java'], re: [/ArithmeticException: \/ by zero/],
    etichetta: t('errori.java-divisione-zero.etichetta'),
    frase: () => t('errori.java-divisione-zero.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.java-divisione-zero.cosa'),
    concetto: t('errori.java-divisione-zero.concetto'),
  },
  {
    id: 'java-input', lingue: ['java'], re: [/InputMismatchException/, /NumberFormatException(?:: For input string: "(?<v>[^"]*)")?/],
    etichetta: t('errori.java-input.etichetta'),
    frase: d => d.parti.v != null ? t('errori.java-input.frase', { v: cod(d.parti.v) }) : t('errori.java-input.frase-2'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.java-input.cosa'),
    concetto: t('errori.java-input.concetto'),
  },
  {
    id: 'java-stack', lingue: ['java'], re: [/StackOverflowError/],
    etichetta: t('errori.java-stack.etichetta'),
    frase: () => t('errori.java-stack.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.java-stack.cosa'),
    concetto: t('errori.java-stack.concetto'),
  },

  // ===== Python =====
  {
    id: 'py-uguale', lingue: ['python'], meccanica: true, re: [/^SyntaxError: .*Maybe you meant '==' or ':=' instead of '='\?/, /^SyntaxError: .*cannot assign to .*here\. Maybe you meant '=='/],
    etichetta: t('errori.py-uguale.etichetta'), breve: () => t('errori.py-uguale.breve'),
    frase: () => t('errori.py-uguale.frase'),
    dove: d => t('errori.py-uguale.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.py-uguale.cosa'),
    concetto: t('errori.py-uguale.concetto'), correzione: (d, x) => correggiUguale(d, x),
  },
  {
    id: 'py-due-punti', lingue: ['python'], re: [/^SyntaxError: expected ':'/],
    etichetta: t('errori.py-due-punti.etichetta'),
    frase: () => t('errori.py-due-punti.frase'),
    dove: d => (d.riga ? t('errori.py-due-punti.dove', { riga: d.riga }) : t('errori.py-due-punti.dove-senza-riga')),
    cosa: () => t('errori.py-due-punti.cosa'),
    concetto: t('errori.py-due-punti.concetto'),
  },
  {
    id: 'py-parentesi', lingue: ['python'], re: [/^SyntaxError: '(?<p>[(\[{])' was never closed/, /^SyntaxError: unmatched '(?<c>[)\]}])'/, /^SyntaxError: closing parenthesis '(?<c>.)' does not match opening parenthesis '(?<p>.)'/],
    etichetta: t('errori.py-parentesi.etichetta'),
    frase: d => d.parti.c && !d.parti.p ? t('errori.py-parentesi.frase', { c: cod(d.parti.c) }) : t('errori.py-parentesi.frase-2', { p: cod(d.parti.p || '(') }),
    dove: d => t('errori.py-parentesi.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.py-parentesi.cosa'),
    concetto: t('errori.py-parentesi.concetto'),
  },
  {
    id: 'py-stringa', lingue: ['python'], re: [/^SyntaxError: unterminated (?:triple-quoted )?string literal/, /^SyntaxError: EOL while scanning string literal/, /^SyntaxError: EOF while scanning triple-quoted/],
    etichetta: t('errori.py-stringa.etichetta'),
    frase: () => t('errori.py-stringa.frase'),
    dove: d => t('errori.py-stringa.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.py-stringa.cosa'),
    concetto: t('errori.py-stringa.concetto'),
  },
  {
    id: 'py-print', lingue: ['python'], re: [/^SyntaxError: Missing parentheses in call to 'print'/],
    etichetta: t('errori.py-print.etichetta'),
    frase: () => t('errori.py-print.frase'),
    dove: d => t('errori.py-print.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.py-print.cosa'),
    concetto: t('errori.py-print.concetto'),
  },
  {
    id: 'py-indentazione', lingue: ['python'], re: [/^IndentationError: (?<atteso>expected an indented block)(?: after '(?<kw>[^']+)' statement on line (?<l>\d+))?/, /^IndentationError: (?<troppo>unexpected indent)/, /^IndentationError: (?<torna>unindent does not match)/, /^(?<tab>TabError)/, /^IndentationError/],
    etichetta: t('errori.py-indentazione.etichetta'),
    frase: d => d.parti.atteso ? t('errori.py-indentazione.frase') : d.parti.troppo ? t('errori.py-indentazione.frase-2') : d.parti.torna ? t('errori.py-indentazione.frase-3') : d.parti.tab ? t('errori.py-indentazione.frase-4') : t('errori.py-indentazione.frase-5'),
    dove: d => t('errori.py-indentazione.dove', { laRiga: laRiga(d), kw: d.parti.kw ? t('errori.py-indentazione.dove-2', { kw: d.parti.kw, l: d.parti.l }) : '' }),
    cosa: () => t('errori.py-indentazione.cosa'),
    concetto: t('errori.py-indentazione.concetto'),
  },
  {
    id: 'py-sintassi', lingue: ['python'], re: [/^SyntaxError: (?<virgola>invalid syntax\. Perhaps you forgot a comma\?)/, /^SyntaxError/],
    etichetta: t('errori.py-sintassi.etichetta'),
    frase: d => d.parti.virgola ? t('errori.py-sintassi.frase') : t('errori.py-sintassi.frase-2'),
    dove: d => t('errori.py-sintassi.dove', { laRiga: laRiga(d) }),
    cosa: d => d.parti.virgola ? t('errori.py-sintassi.cosa')
      : t('errori.py-sintassi.cosa-2'),
    concetto: t('errori.py-sintassi.concetto'),
  },
  {
    id: 'py-nome', lingue: ['python'], re: [/^NameError: name '(?<n>[\w$]+)' is not defined(?:\. Did you mean: '(?<s>[^']+)'\?)?/, /^NameError/],
    etichetta: t('errori.py-nome.etichetta'), breve: d => t('errori.py-nome.breve', { nome: d.nome || t('errori.py-nome.breve-2') }),
    frase: d => (d.riga ? t('errori.py-nome.frase', { nome: conNome(d, t('errori.py-nome.frase-2')), riga: d.riga }) : t('errori.py-nome.frase-senza-riga', { nome: conNome(d, t('errori.py-nome.frase-2')) })),
    dove: d => (d.parti.s ? t('errori.py-nome.dove', { s: cod(d.parti.s) }) : '') +
      t('errori.py-nome.dove-2', { nome: conNome(d, t('errori.py-nome.dove-3')) }),
    cosa: d => {
      let s = t('errori.py-nome.cosa');
      if (/^(true|false|none|null)$/i.test(d.nome || '')) s += t('errori.py-nome.cosa-2');
      else if (d.nome) s += t('errori.py-nome.cosa-3', { nome: cod(d.nome), nome2: cod('"' + d.nome + '"') });
      return s;
    },
    concetto: t('errori.py-nome.concetto'),
  },
  {
    id: 'py-locale', lingue: ['python'], re: [/^UnboundLocalError: (?:cannot access local variable '(?<n>[\w$]+)'|local variable '(?<n2>[\w$]+)' referenced before assignment)/, /^UnboundLocalError/],
    etichetta: t('errori.py-locale.etichetta'),
    frase: d => t('errori.py-locale.frase', { nome: conNome(d, t('errori.py-locale.frase-2')) }),
    dove: d => t('errori.py-locale.dove', { laRiga: laRiga(d), nome: conNome(d, t('errori.py-locale.dove-2')) }),
    cosa: () => t('errori.py-locale.cosa'),
    concetto: t('errori.py-locale.concetto'),
  },
  {
    id: 'py-tipo-concatena', lingue: ['python'], re: [/^TypeError: can only concatenate (?<a>\w+) \(not "(?<b>\w+)"\) to \w+/, /^TypeError: unsupported operand type\(s\) for (?<op>\S+): '(?<a>\w+)' and '(?<b>\w+)'/, /^TypeError: '(?<op><|>|<=|>=)' not supported between instances of '(?<a>\w+)' and '(?<b>\w+)'/],
    etichetta: t('errori.py-tipo-concatena.etichetta'),
    frase: d => (d.parti.a === 'str' || d.parti.b === 'str') && (/int|float/.test(d.parti.a + d.parti.b)) ? t('errori.py-tipo-concatena.frase') : t('errori.py-tipo-concatena.frase-2', { a: cod(d.parti.a || '?'), b: cod(d.parti.b || '?') }),
    dove: d => t('errori.py-tipo-concatena.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.py-tipo-concatena.cosa'),
    concetto: t('errori.py-tipo-concatena.concetto'),
  },
  {
    id: 'py-tipo-indice', lingue: ['python'], re: [/^TypeError: '(?<t>\w+)' object is not subscriptable/, /^TypeError: (?<intero>list|string|tuple) indices must be integers/, /^TypeError: '(?<immut>\w+)' object does not support item assignment/],
    etichetta: t('errori.py-tipo-indice.etichetta'),
    frase: d => d.parti.intero ? t('errori.py-tipo-indice.frase') : d.parti.immut ? t('errori.py-tipo-indice.frase-2', { immut: d.parti.immut }) : d.parti.t === 'NoneType' ? t('errori.py-tipo-indice.frase-3') : t('errori.py-tipo-indice.frase-4', { p: cod(d.parti.t || '?') }),
    dove: d => t('errori.py-tipo-indice.dove', { allaRiga: allaRiga(d) }),
    cosa: d => d.parti.intero ? t('errori.py-tipo-indice.cosa')
      : d.parti.immut ? t('errori.py-tipo-indice.cosa-2')
        : t('errori.py-tipo-indice.cosa-3'),
    concetto: t('errori.py-tipo-indice.concetto'),
  },
  {
    id: 'py-tipo-argomenti', lingue: ['python'], re: [/^TypeError: (?<f>[\w.]+)\(\) missing \d+ required positional argument/, /^TypeError: (?<f>[\w.]+)\(\) takes (?:from \d+ to )?\d+ positional arguments? but \d+ (?:was|were) given/, /^TypeError: (?<f>[\w.]+)\(\) got an unexpected keyword argument/],
    etichetta: t('errori.py-tipo-argomenti.etichetta'),
    frase: d => t('errori.py-tipo-argomenti.frase', { p: cod((d.parti.f || t('errori.py-tipo-argomenti.frase-2')) + '()') }),
    dove: d => t('errori.py-tipo-argomenti.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.py-tipo-argomenti.cosa'),
    concetto: t('errori.py-tipo-argomenti.concetto'),
  },
  {
    id: 'py-non-iterabile', lingue: ['python'], re: [/^TypeError: '(?<t>\w+)' object is not iterable/, /^TypeError: cannot unpack non-iterable (?<t>\w+) object/],
    etichetta: t('errori.py-non-iterabile.etichetta'),
    frase: d => t('errori.py-non-iterabile.frase', { p: cod(d.parti.t || '?') }),
    dove: d => t('errori.py-non-iterabile.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.py-non-iterabile.cosa'),
    concetto: t('errori.py-non-iterabile.concetto'),
  },
  {
    id: 'py-non-chiamabile', lingue: ['python'], re: [/^TypeError: '(?<t>\w+)' object is not callable/],
    etichetta: t('errori.py-non-chiamabile.etichetta'),
    frase: d => t('errori.py-non-chiamabile.frase', { p: cod(d.parti.t || '?') }),
    dove: d => t('errori.py-non-chiamabile.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.py-non-chiamabile.cosa'),
    concetto: t('errori.py-non-chiamabile.concetto'),
  },
  {
    id: 'py-tipo', lingue: ['python'], re: [/^TypeError/],
    etichetta: t('errori.py-tipo.etichetta'),
    frase: () => t('errori.py-tipo.frase'),
    dove: d => t('errori.py-tipo.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.py-tipo.cosa'),
    concetto: t('errori.py-tipo.concetto'),
  },
  {
    id: 'py-indice', lingue: ['python'], re: [/^IndexError: (?<cosa>list|string|tuple|range object) index out of range/, /^IndexError: (?<vuota>pop from empty list)/, /^IndexError/],
    etichetta: t('errori.py-indice.etichetta'),
    frase: d => d.parti.vuota ? t('errori.py-indice.frase') : t('errori.py-indice.frase-2', { cosa: d.parti.cosa === 'string' ? t('errori.py-indice.frase-3') : d.parti.cosa === 'tuple' ? t('errori.py-indice.frase-4') : t('errori.py-indice.frase-5') }),
    dove: d => t('errori.py-indice.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.py-indice.cosa'),
    concetto: t('errori.py-indice.concetto'),
  },
  {
    id: 'py-chiave', lingue: ['python'], re: [/^KeyError: (?<k>.+)$/, /^KeyError/],
    etichetta: t('errori.py-chiave.etichetta'),
    frase: d => d.parti.k ? t('errori.py-chiave.frase', { k: cod(d.parti.k) }) : t('errori.py-chiave.frase-2'),
    dove: d => t('errori.py-chiave.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.py-chiave.cosa'),
    concetto: t('errori.py-chiave.concetto'),
  },
  {
    id: 'py-valore', lingue: ['python'], re: [/^ValueError: invalid literal for int\(\) with base \d+: (?<v>.+)$/, /^ValueError: could not convert string to float: (?<v>.+)$/, /^ValueError: (?<spacchetta>too many values to unpack|not enough values to unpack)/, /^ValueError: (?<dominio>math domain error)/, /^ValueError/],
    etichetta: t('errori.py-valore.etichetta'),
    frase: d => d.parti.v ? t('errori.py-valore.frase', { v: cod(d.parti.v.replace(/^'(.*)'$/, '$1')) }) : d.parti.spacchetta ? t('errori.py-valore.frase-2') : d.parti.dominio ? t('errori.py-valore.frase-3') : t('errori.py-valore.frase-4'),
    dove: d => t('errori.py-valore.dove', { laRiga: laRiga(d) }),
    cosa: d => d.parti.v ? t('errori.py-valore.cosa')
      : d.parti.spacchetta ? t('errori.py-valore.cosa-2')
        : d.parti.dominio ? t('errori.py-valore.cosa-3')
          : t('errori.py-valore.cosa-4'),
    concetto: t('errori.py-valore.concetto'),
  },
  {
    id: 'py-divisione-zero', lingue: ['python'], re: [/^ZeroDivisionError/],
    etichetta: t('errori.py-divisione-zero.etichetta'),
    frase: () => t('errori.py-divisione-zero.frase'),
    dove: d => t('errori.py-divisione-zero.dove', { laRiga: laRiga(d) }),
    cosa: () => t('errori.py-divisione-zero.cosa'),
    concetto: t('errori.py-divisione-zero.concetto'),
  },
  {
    id: 'py-attributo', lingue: ['python'], re: [/^AttributeError: '(?<t>\w+)' object has no attribute '(?<a>[\w$]+)'/, /^AttributeError: (?:partially initialized )?module '(?<mod>[\w.]+)' has no attribute '(?<a>[\w$]+)'/, /^AttributeError/],
    etichetta: t('errori.py-attributo.etichetta'),
    frase: d => d.parti.t === 'NoneType' ? t('errori.py-attributo.frase', { a: cod(d.parti.a) }) : d.parti.mod ? t('errori.py-attributo.frase-2', { mod: cod(d.parti.mod), a: cod(d.parti.a) }) : d.parti.a ? t('errori.py-attributo.frase-3', { p: cod(d.parti.t), a: cod(d.parti.a) }) : t('errori.py-attributo.frase-4'),
    dove: d => t('errori.py-attributo.dove', { laRiga: laRiga(d) }),
    cosa: d => d.parti.t === 'NoneType'
      ? t('errori.py-attributo.cosa')
      : d.parti.mod ? t('errori.py-attributo.cosa-2')
        : t('errori.py-attributo.cosa-3'),
    concetto: t('errori.py-attributo.concetto'),
  },
  {
    id: 'py-ricorsione', lingue: ['python'], re: [/^RecursionError/],
    etichetta: t('errori.py-ricorsione.etichetta'),
    frase: () => t('errori.py-ricorsione.frase'),
    dove: d => t('errori.py-ricorsione.dove', { funzione: d.funzione && d.funzione !== '<module>' ? ` ${cod(d.funzione)}` : '', allaRiga: allaRiga(d) }),
    cosa: () => t('errori.py-ricorsione.cosa'),
    concetto: t('errori.py-ricorsione.concetto'),
  },
  {
    id: 'py-modulo', lingue: ['python'], re: [/^ModuleNotFoundError: No module named '(?<m>[\w.]+)'/, /^ImportError: cannot import name '(?<nome>[\w$]+)' from '(?<m>[\w.]+)'/, /^(?:ModuleNotFoundError|ImportError)/],
    etichetta: t('errori.py-modulo.etichetta'),
    frase: d => d.parti.nome ? t('errori.py-modulo.frase', { m: cod(d.parti.m), nome: cod(d.parti.nome) }) : d.parti.m ? t('errori.py-modulo.frase-2', { m: cod(d.parti.m) }) : t('errori.py-modulo.frase-3'),
    dove: d => t('errori.py-modulo.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.py-modulo.cosa'),
    concetto: t('errori.py-modulo.concetto'),
  },
  {
    id: 'py-file', lingue: ['python'], re: [/^FileNotFoundError: \[Errno 2\] No such file or directory: '(?<f>[^']+)'/, /^FileNotFoundError/],
    etichetta: t('errori.py-file.etichetta'),
    frase: d => t('errori.py-file.frase', { p: cod(d.parti.f || '?') }),
    dove: d => t('errori.py-file.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.py-file.cosa'),
    concetto: t('errori.py-file.concetto'),
  },
  {
    id: 'py-input-finito', lingue: ['python'], re: [/^EOFError/],
    etichetta: t('errori.py-input-finito.etichetta'),
    frase: () => t('errori.py-input-finito.frase'),
    dove: d => t('errori.py-input-finito.dove', { allaRiga: allaRiga(d) }),
    cosa: () => t('errori.py-input-finito.cosa'),
    concetto: t('errori.py-input-finito.concetto'),
  },

  // ===== programmi che si fermano mentre girano (C e simili) =====
  {
    id: 'esec-memoria', lingue: ['c'], etichetta: t('errori.esec-memoria.etichetta'), breve: () => t('errori.esec-memoria.breve'),
    frase: () => t('errori.esec-memoria.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: d => (d.dettagli.nullo ? t('errori.esec-memoria.cosa') : '') +
      t('errori.esec-memoria.cosa-2') +
      (d.codiceUscita ? t('errori.esec-memoria.cosa-3', { codiceUscita: d.codiceUscita }) : ''),
    concetto: t('errori.esec-memoria.concetto'),
  },
  {
    id: 'esec-divisione-zero', lingue: ['c'], etichetta: t('errori.esec-divisione-zero.etichetta'),
    frase: () => t('errori.esec-divisione-zero.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-divisione-zero.cosa'),
    concetto: t('errori.esec-divisione-zero.concetto'),
  },
  {
    id: 'esec-stack', lingue: ['c'], etichetta: t('errori.esec-stack.etichetta'),
    frase: () => t('errori.esec-stack.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-stack.cosa'),
    concetto: t('errori.esec-stack.concetto'),
  },
  {
    id: 'esec-fuori-array', lingue: ['c'], etichetta: t('errori.esec-fuori-array.etichetta'),
    frase: d => d.dettagli.accesso === 'lettura' ? t('errori.esec-fuori-array.frase-letto') : d.dettagli.accesso === 'scrittura' ? t('errori.esec-fuori-array.frase-scritto') : t('errori.esec-fuori-array.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-fuori-array.cosa'),
    concetto: t('errori.esec-fuori-array.concetto'),
  },
  {
    id: 'esec-heap', lingue: ['c'], etichetta: t('errori.esec-heap.etichetta'),
    frase: () => t('errori.esec-heap.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-heap.cosa'),
    concetto: t('errori.esec-heap.concetto'),
  },
  {
    id: 'esec-memoria-persa', lingue: ['c'], etichetta: t('errori.esec-memoria-persa.etichetta'),
    frase: () => t('errori.esec-memoria-persa.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-memoria-persa.cosa'),
    concetto: t('errori.esec-memoria-persa.concetto'),
  },
  {
    id: 'esec-non-inizializzata', lingue: ['c'], etichetta: t('errori.esec-non-inizializzata.etichetta'),
    frase: () => t('errori.esec-non-inizializzata.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-non-inizializzata.cosa'),
    concetto: t('errori.esec-non-inizializzata.concetto'),
  },
  {
    id: 'esec-asserzione', lingue: ['c'], etichetta: t('errori.esec-asserzione.etichetta'),
    frase: d => d.parti.cond ? t('errori.esec-asserzione.frase', { cond: cod(d.parti.cond) }) : t('errori.esec-asserzione.frase-2'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-asserzione.cosa'),
    concetto: t('errori.esec-asserzione.concetto'),
  },
  {
    id: 'esec-abort', lingue: ['c'], etichetta: t('errori.esec-abort.etichetta'),
    frase: () => t('errori.esec-abort.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-abort.cosa'),
    concetto: t('errori.esec-abort.concetto'),
  },
  {
    id: 'esec-overflow', lingue: ['c'], re: [/signed integer overflow/i, /integer overflow/i],
    etichetta: t('errori.esec-overflow.etichetta'),
    frase: () => t('errori.esec-overflow.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-overflow.cosa'),
    concetto: t('errori.esec-overflow.concetto'),
  },
  {
    id: 'esec-tempo', lingue: ['c', 'python', 'java'], etichetta: t('errori.esec-tempo.etichetta'),
    frase: () => t('errori.esec-tempo.frase'),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-tempo.cosa'),
    concetto: t('errori.esec-tempo.concetto'),
  },
  {
    id: 'esec-segnale', lingue: ['c'], etichetta: t('errori.esec-segnale.etichetta'),
    frase: d => t('errori.esec-segnale.frase', { segnale: d.segnale ? ` (${d.segnale})` : '' }),
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => t('errori.esec-segnale.cosa'),
    concetto: t('errori.esec-segnale.concetto'),
  },
];
// le voci UBSan («main.c:5:12: runtime error: …») usano gli stessi testi degli errori di esecuzione
const UBSAN = [[/division by zero/i, 'esec-divisione-zero'], [/index -?\d+ out of bounds/i, 'esec-fuori-array'], [/null pointer|misaligned address/i, 'esec-memoria'], [/overflow/i, 'esec-overflow']];
const PER_ID = Object.fromEntries(VOCI.map(v => [v.id, v]));
export const voce = chiave => PER_ID[chiave] || null;
// Per il registro (F4): «manca `;`», «funzione non dichiarata»…
export const nomeErrore = chiave => PER_ID[chiave]?.etichetta || t('errori.sconosciuto');
export const CHIAVI = Object.freeze(VOCI.map(v => v.id));

// ---------- dove si è fermato un programma ----------
function doveEsecuzione(d, x) {
  const f = nomeFile(d.file), fn = d.funzione && !/^<.*>$/.test(d.funzione) ? t('errori.nella-funzione', { funzione: cod(d.funzione) }) : '';
  let s = d.riga ? t('errori.fermato-alla-riga', { riga: d.riga, file: f ? t('errori.di-file', { file: cod(f) }) : '', funzione: fn }) : '';
  if (x.cambiate) s += s ? t('errori.poi-guarda-cambiate', { righe: x.cambiate }) : t('errori.guarda-prima-cambiate', { righe: x.cambiate });
  if (!s) s = d.linguaggio === 'c' && d.chiave !== 'esec-tempo'
    ? t('errori.sistema-senza-riga')
    : t('errori.messaggio-senza-riga');
  return s;
}

// ---------- il codice vero ----------
// sorgente: il testo del file, un array di righe, oppure la risposta di progetto:righe { da, righe: [{ n, s }] }
function leggiSorgente(src) {
  if (src == null) return () => null;
  if (typeof src === 'string') { const a = src.replace(/\r\n?/g, '\n').split('\n'); return n => a[n - 1] ?? null; }
  if (Array.isArray(src)) return n => typeof src[n - 1] === 'string' ? src[n - 1] : null;
  if (Array.isArray(src.righe)) {
    if (src.righe.every(r => r && typeof r === 'object')) { const m = new Map(src.righe.map(r => [r.n, r.s ?? r.testo])); return n => m.get(n) ?? null; }
    const da = src.da || 1; return n => typeof src.righe[n - da] === 'string' ? src.righe[n - da] : null;
  }
  return () => null;
}
// righeCambiate: [{ file | rel, da, a }] → «lista.c 30-52, main.c 10»
function testoCambiate(rc) {
  if (!rc) return null;
  if (typeof rc === 'string') return rc;
  const pz = (Array.isArray(rc) ? rc : [rc]).filter(r => r && r.da).map(r => `${nomeFile(r.file || r.rel) || ''} ${r.da}${r.a && r.a > r.da ? '-' + r.a : ''}`.trim());
  if (!pz.length) return null;
  return pz.length > 4 ? t('errori.cambiate-e-altre', { righe: pz.slice(0, 4).join(', '), n: pz.length - 4 }) : pz.join(', ');
}
// Dal diff di F2 ({ rel, blocchi: [{ righe: [{ t, nb }] }] }) alle righe cambiate da passare a spiega()
export function righeCambiateDa(file) {
  const out = []; let cur = null;
  for (const b of file?.blocchi || []) for (const r of b.righe || []) {
    if (r.t === '+' && r.nb) { if (cur && r.nb === cur.a + 1) cur.a = r.nb; else out.push(cur = { file: file.rel, da: r.nb, a: r.nb }); }
    else if (r.t !== '-') cur = null;
  }
  return out;
}

// dove finisce il codice di una riga, senza commento finale e spazi
function fineCodice(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '/' && (s[i + 1] === '/' || s[i + 1] === '*')) return s.slice(0, i).trimEnd().length;
  }
  return s.trimEnd().length;
}
// i '=' da soli (non ==, <=, >=, !=, +=, :=…), fuori dalle stringhe
function ugualiSoli(s, python = false) {
  const out = []; let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (python && c === '#') break;
    if (c === '/' && s[i + 1] === '/' && !python) break;
    if (c === '=' && s[i + 1] === '=') { i++; continue; }
    if (c === '=' && !'=!<>+-*/%&|^:'.includes(s[i - 1] ?? ' ')) out.push(i);
  }
  return out;
}
const CHIAVE_C = /^(if|while|for|switch|return|sizeof|else|do)$/;
const RE_FUNZIONE_C = /^(?:static\s+|inline\s+|const\s+|unsigned\s+|signed\s+|long\s+|short\s+)*(void|char|int|float|double|long|short|bool|size_t|struct\s+\w+|enum\s+\w+|[A-Z]\w*|\w+_t)([\s*]+)(\w+)\s*\(([^;{}]*)\)\s*\{?\s*$/;
const RE_FUNZIONE_JAVA = /^\s*(?:(?:public|private|protected|static|final|synchronized)\s+)*([\w$<>[\],]+)\s+([\w$]+)\s*\([^;]*\)\s*(?:throws\s+[\w$., ]+)?\s*\{?\s*$/;
// la funzione che contiene la riga dell'errore (la firma più vicina sopra), oppure quella detta da gcc «In function»
function funzioneDi(d, x) {
  if (x._f !== undefined) return x._f;
  let f = null;
  for (let n = d.riga || 0; n >= Math.max(1, (d.riga || 0) - 400) && !f; n--) {
    const s = x.riga(n); if (s == null) break;
    let m;
    if (d.linguaggio === 'java') { if ((m = s.match(RE_FUNZIONE_JAVA)) && !CHIAVE_C.test(m[2]) && m[1] !== 'new') f = { nome: m[2], tipo: m[1] }; }
    else if ((m = s.match(RE_FUNZIONE_C)) && !CHIAVE_C.test(m[3])) f = { nome: m[3], tipo: (m[1] + m[2].replace(/\s+/g, '')).trim() };
  }
  if (!f && d.funzione && !/^<.*>$/.test(d.funzione)) f = { nome: d.funzione, tipo: null };
  return (x._f = f);
}
// header standard più vicino a un nome sbagliato («stdoi.h» → «stdio.h»)
function vicino(h) {
  const dist = (a, b) => { const r = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) r[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) r[i][j] = Math.min(r[i - 1][j] + 1, r[i][j - 1] + 1, r[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return r[a.length][b.length]; };
  let best = null, bd = 3;
  for (const n of HEADER_NOTI) { const k = dist(h.toLowerCase(), n); if (k < bd) { bd = k; best = n; } }
  return best;
}

// ---------- le correzioni meccaniche (solo ;, #include, = al posto di ==, return) ----------
// dove manca il ';': { riga, indice } con l'indice della riga in cui va inserito
function puntoMancante(d, x) {
  if (!d.riga) return null;
  const t = x.riga(d.riga); if (t == null) return null;
  const sopra = () => {
    for (let n = d.riga - 1; n >= Math.max(1, d.riga - 20); n--) {
      const s = x.riga(n); if (s == null) return null;
      if (s.trim() && !/^\s*(\/\/|\/\*|\*)/.test(s)) return { riga: n, indice: fineCodice(s) };
    }
    return null;
  };
  if (d.colonna) {
    const col = d.colonna - 1;
    if (!t.slice(0, col).trim()) return sopra();      // gcc e MSVC lo segnalano all'inizio dell'istruzione dopo
    // le righe copiate dall'uscita del compilatore hanno i tab già allargati: la colonna non è affidabile, si va a fine riga
    return { riga: d.riga, indice: x.daFile(d.riga) ? Math.min(col, fineCodice(t)) : fineCodice(t) };
  }
  // senza colonna: se la riga apre o chiude un blocco, o finisce già con ';', il ';' manca sopra
  if (/[;{}]$/.test(t.slice(0, fineCodice(t))) || /^\s*#/.test(t) || !t.trim()) return sopra();
  return { riga: d.riga, indice: fineCodice(t) };
}
function correggiPunto(d, x) {
  const p = puntoMancante(d, x), linea = p ? x.riga(p.riga) : null;
  if (!p || linea == null || /;\s*$/.test(linea.slice(0, p.indice)) || /^\s*#/.test(linea))
    return { testo: d.riga ? t('errori.correggi-punto', { riga: d.riga }) : t('errori.correggi-punto-senza-riga') };
  const nuova = linea.slice(0, p.indice) + ';' + linea.slice(p.indice);
  return {
    testo: p.indice >= fineCodice(linea) ? t('errori.correggi-punto-fine', { riga: p.riga }) : t('errori.correggi-punto-dentro', { riga: p.riga }),
    righe: [{ n: p.riga, testo: linea, segno: '-' }, { n: p.riga, testo: nuova, segno: '+' }],
  };
}
function correggiInclude(d, x) {
  const h = d.parti.h; if (!h) return null;
  const nuova = `#include <${h}>`;
  if (x.riga(1) == null || !x.daFile(1)) return { testo: t('errori.correggi-include-in-cima'), righe: [{ n: null, testo: nuova, segno: '+' }] };
  let ultima = 0;
  for (let n = 1; n <= 300; n++) {
    const s = x.riga(n); if (s == null) break;
    if (new RegExp(`^\\s*#\\s*include\\s*[<"]${h.replace(/\./g, '\\.')}[>"]`).test(s)) return null;   // c'è già: il problema è un altro
    if (/^\s*#\s*include\b/.test(s)) ultima = n;
  }
  return ultima
    ? { testo: t('errori.correggi-include-dopo', { riga: ultima }), righe: [{ n: ultima, testo: x.riga(ultima), segno: ' ' }, { n: ultima + 1, testo: nuova, segno: '+' }] }
    : { testo: t('errori.correggi-include-primo'), righe: [{ n: 1, testo: nuova, segno: '+' }, { n: 2, testo: x.riga(1), segno: ' ' }] };
}
function correggiUguale(d, x) {
  const generica = { testo: t('errori.correggi-uguale') };
  const linea = d.riga ? x.riga(d.riga) : null; if (linea == null) return generica;
  const py = d.linguaggio === 'python', soli = ugualiSoli(linea, py);
  let i = d.colonna && x.daFile(d.riga) && soli.includes(d.colonna - 1) ? d.colonna - 1 : null;
  if (i == null) {
    const k = linea.search(py ? /\b(if|elif|while)\b/ : /\b(if|while)\s*\(/);
    const dopo = k >= 0 ? soli.filter(p => p > k) : [];
    i = dopo.length === 1 ? dopo[0] : soli.length === 1 ? soli[0] : null;
  }
  if (i == null) return generica;
  return { testo: t('errori.correggi-uguale-riga', { riga: d.riga }), righe: [{ n: d.riga, testo: linea, segno: '-' }, { n: d.riga, testo: linea.slice(0, i) + '==' + linea.slice(i + 1), segno: '+' }] };
}
function correggiReturn(d, x) {
  const f = funzioneDi(d, x), linea = d.riga ? x.riga(d.riga) : null;
  const testo = f ? t('errori.correggi-return', { nome: cod(f.nome) }) : t('errori.correggi-return-senza-nome');
  if (linea == null || !/^\s*\}/.test(linea)) return { testo, righe: [{ n: null, testo: `    return ${t('errori.segnaposto-valore')};`, segno: '+' }, { n: null, testo: '}', segno: ' ' }] };
  const rientro = linea.match(/^\s*/)[0] + (/^\t/.test(x.riga(d.riga - 1) || '') ? '\t' : '    ');
  const sopra = x.riga(d.riga - 1);
  return { testo, righe: [...(sopra != null ? [{ n: d.riga - 1, testo: sopra, segno: ' ' }] : []), { n: d.riga, testo: `${rientro}return ${t('errori.segnaposto-valore')};`, segno: '+' }, { n: d.riga + 1, testo: linea, segno: ' ' }] };
}

// ---------- spiega ----------
function doveGenerico(d, x) {
  if (d.tipo === 'linker') return t('errori.generico.dove-linker');
  if (d.tipo === 'esecuzione') return doveEsecuzione(d, x);
  const f = nomeFile(d.file);
  if (!d.riga) return t('errori.generico.dove-senza-riga');
  const di = f ? t('errori.di-file', { file: cod(f) }) : '';
  if (d.linguaggio === 'python') return t('errori.generico.dove-python', { L: x.L, allaRiga: allaRiga(d), file: di });
  return t('errori.generico.dove', { laRiga: laRiga(d), colonna: colonna(d), file: di });
}
function cosaGenerico(d, x) {
  let s = '';
  if (d.eccezione) s = d.tipo === 'errore' ? t('errori.generico.eccezione-leggendo', { eccezione: cod(d.eccezione), L: x.L }) : t('errori.generico.eccezione-eseguendo', { eccezione: cod(d.eccezione), L: x.L });
  return s + t('errori.generico.cosa');
}
// il percorso delle chiamate (Python e Java): «riga 4 (<module>) → riga 2 (media)»
function catena(d) {
  const p = (d.pila || []).filter(f => f.riga && !LIBRERIA_PY.test(f.file || '') && !f.modulo && !/^(java|javax|jdk|sun)\./.test(f.metodo || ''));
  if (p.length < 2) return '';
  const base = nomeFile(d.file), ultime = d.linguaggio === 'java' ? [...p].reverse().slice(-4) : p.slice(-4);
  return t('errori.catena', { passi: ultime.map(f => t('errori.catena-passo', { riga: f.riga, file: nomeFile(f.file) !== base ? t('errori.di-file', { file: cod(nomeFile(f.file)) }) : '', funzione: cod(String(f.funzione || f.metodo || '').split('.').pop()) })).join(' → ') });
}
const maiuscola = s => s ? s[0].toUpperCase() + s.slice(1) : s;

// Il testo breve, senza file e riga: «nodo non dichiarato» (per il diario di F4, che il luogo lo scrive da sé)
export function breve(d) {
  const v = PER_ID[d?.chiave];
  return v ? (v.breve ? v.breve(d) : v.etichetta.replace(/`/g, '')) : String(d?.messaggio || t('errori.errore')).slice(0, 60);
}
// Il testo breve per il diario (F4): «lista.c:42 «nodo non dichiarato»»
export function perDiario(d) {
  const dove = d?.file ? `${nomeFile(d.file)}${d.riga ? ':' + d.riga : ''} ` : '';
  return `${dove}«${breve(d)}»`;
}

// I tre passi per uno studente del primo anno. Opzioni:
//   sorgente: il file vero (testo, array di righe o la risposta di progetto:righe), per l'estratto e la correzione
//   righeCambiate: [{ file, da, a }] dal diff di F2, per gli errori di esecuzione
//   valutato: true nei progetti segnati «valutato» → niente «Fammi vedere la correzione»
//   cambiato: true se l'impronta è cambiata dopo la prova → avviso sui numeri di riga
export function spiega(errore, { sorgente = null, righeCambiate = null, valutato = false, cambiato = false } = {}) {
  let d = errore; if (!d) return null;
  const dalFile = leggiSorgente(sorgente);
  const x = {
    L: NOME_LINGUA[d.linguaggio] || 'C',
    riga: n => dalFile(n) ?? d.righeUscita?.[n] ?? null,
    daFile: n => dalFile(n) != null,
    cambiate: testoCambiate(righeCambiate),
  };
  // con il file vero si sa se la riga è uno scanf: «manca &» solo lì, altrimenti è un formato di printf sbagliato
  if ((d.chiave === 'formato' || d.chiave === 'scanf-e-commerciale') && senzaE(d) && d.riga && x.riga(d.riga) != null) {
    const k = RE_SCANF.test(x.riga(d.riga)) ? 'scanf-e-commerciale' : 'formato';
    if (k !== d.chiave) d = { ...d, chiave: k };
  }
  const v = PER_ID[d.chiave] || null;
  const file = nomeFile(d.file);
  const luogo = file ? (d.riga ? t('errori.luogo-file-riga', { file, riga: d.riga }) : file) : d.riga ? t('errori.luogo-riga', { riga: d.riga }) : null;
  let frase = v ? v.frase(d, x) : t('errori.non-lo-conosco');
  if (d.eccezione) frase = `${d.eccezione}: ${frase}`;
  const intestazione = luogo ? `**${luogo}**${d.eccezione ? ' · ' : ': '}${frase}` : maiuscola(frase);
  let cosa = v ? v.cosa(d, x) : cosaGenerico(d, x);
  // le voci che sono già avvisi lo dicono da sé («È solo un avviso…»): la parola si cerca nella lingua della barra
  if (v && d.tipo === 'avviso' && !cosa.includes(t('errori.parola-avviso'))) cosa = t('errori.e-un-avviso', { cosa });
  const passi = [
    { id: 'dove', titolo: t('errori.passo-dove'), testo: (v ? v.dove(d, x) : doveGenerico(d, x)) + catena(d) },
    { id: 'cosa', titolo: t('errori.passo-cosa'), testo: cosa },
  ];
  // nei progetti «valutato» la correzione non c'è; correzioneNascosta dice che ci sarebbe stata (per una nota nella scheda)
  let correzioneNascosta = false;
  if (v?.meccanica && v.correzione) { if (valutato) correzioneNascosta = true; else { const c = v.correzione(d, x); if (c) passi.push({ id: 'correzione', titolo: t('errori.passo-correzione'), ...c }); } }
  let estratto = null;
  if (d.riga) {
    const righe = [];
    for (let n = Math.max(1, d.riga - 2); n <= d.riga + 2; n++) { const t = x.riga(n); if (t != null) righe.push({ n, testo: t, qui: n === d.riga }); }
    if (righe.length) estratto = { da: righe[0].n, a: righe.at(-1).n, colonna: d.colonna, daFile: x.daFile(d.riga), righe };
  }
  return {
    chiave: d.chiave, conosciuto: !!v, tipo: d.tipo, linguaggio: d.linguaggio, etichetta: v?.etichetta || null, concetto: v?.concetto || null,
    luogo, frase, intestazione, breve: perDiario(d), estratto, passi, originale: d.messaggio,
    avviso: cambiato ? t('errori.file-cambiato') : null,
    correzione: passi.some(p => p.id === 'correzione'), correzioneNascosta,
  };
}

// «spiegami l'errore» con il testo copiato: il primo errore, spiegato, più il conto degli altri
export function spiegaTesto(testo, opzioni = {}) {
  const lista = analizza(testo), r = riassunto(lista);
  return r.primo ? { ...r, lista, spiegazione: spiega(r.primo, opzioni) } : null;
}

// ---------- HTML per la barra (stringhe, niente DOM) ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// testo dei passi → HTML: `codice` diventa <code>, **grassetto** diventa <b>; tutto il resto è escapato
export function html(testo) {
  return String(testo ?? '').split('`').map((p, i) => i % 2 ? `<code>${esc(p)}</code>` : esc(p).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')).join('');
}
const codiceHtml = righe => `<pre class="ld-err-codice">${righe.map(r => `<span class="ld-err-r${r.cls ? ' ' + r.cls : ''}"><i>${r.n ?? ''}</i>${esc(r.testo)}</span>`).join('')}</pre>`;
const ETICHETTA_TIPO = { errore: t('errori.tipo-errore'), avviso: t('errori.tipo-avviso'), linker: t('errori.tipo-linker'), esecuzione: t('errori.tipo-esecuzione') };
// L'interno della scheda «Errore»: da mettere in scheda('ld-err', schedaHtml(sp, { conto, vista })).
// I passi sono <details data-passo="dove|cosa|correzione">: si aprono uno alla volta, senza JS.
export function schedaHtml(sp, { conto = '', vista = false } = {}) {
  if (!sp) return '';
  const capo = `<div class="capo"><span class="ld-lbl">${ETICHETTA_TIPO[sp.tipo] || ETICHETTA_TIPO.errore}${sp.linguaggio ? ' · ' + (NOME_LINGUA[sp.linguaggio] || '') : ''}</span>${conto ? `<span class="ld-err-conto">${esc(conto)}</span>` : ''}</div>`;
  const estratto = sp.estratto ? codiceHtml(sp.estratto.righe.map(r => ({ n: r.n, testo: r.testo, cls: r.qui ? 'qui' : '' }))) : '';
  const passi = sp.passi.map((p, i) => `<details class="ld-err-passo" data-passo="${p.id}"><summary><small>${i + 1}</small>${esc(p.titolo)}${p.id === 'correzione' && vista ? `<span class="ld-err-vista">${t('errori.correzione-vista')}</span>` : ''}</summary><p>${html(p.testo)}</p>${p.righe ? codiceHtml(p.righe.map(r => ({ n: r.n, testo: r.testo, cls: r.segno === '+' ? 'piu' : r.segno === '-' ? 'meno' : '' }))) : ''}</details>`).join('');
  const orig = `<details class="ld-err-passo ld-err-orig" data-passo="originale"${sp.conosciuto ? '' : ' open'}><summary><small>·</small>${t('errori.messaggio-originale')}</summary><pre>${esc(sp.originale)}</pre></details>`;
  return capo + `<p class="ld-err-titolo">${html(sp.intestazione)}</p>` + (sp.avviso ? `<p class="ld-nota">${html(sp.avviso)}</p>` : '') + estratto + passi + orig;
}
