// Gli errori del compilatore e dei programmi, spiegati in italiano, un passo alla volta (F3 di docs/PROGETTO-INFORMATICA.md).
// Niente AI: solo regole fisse. analizza(testo) legge quello che scrivono gcc, clang, MinGW, MSVC (cl), javac, Python e Java
// (anche copiato da Code::Blocks e Dev-C++)
// e lo trasforma in una lista di errori. spiega(errore, { sorgente, righeCambiate }) prepara i tre passi:
// «Dove guardare», «Cosa vuol dire» e, solo per le correzioni meccaniche, «Fammi vedere la correzione».
// Modulo puro: niente DOM, niente rete, niente salvataggi. Lo usano la barra e il main («spiegami l'errore» dagli appunti).
// Un errore che non è nel dizionario resta col suo messaggio originale e Lode lo dice: mai dettagli inventati.

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
    const d = vuoto({ tipo: 'esecuzione', linguaggio: 'c', chiave, segnale: sig, codiceUscita, codice, messaggio: tempoScaduto ? 'Tempo scaduto' : sig ? `Segnale ${sig}` : `Codice d'uscita ${codice}${codiceUscita ? ` (${codiceUscita})` : ''}` });
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
  if (errori) pz.push(errori === 1 ? 'un altro errore' : `altri ${errori} errori`);
  if (avvisi) pz.push(avvisi === 1 ? '1 avviso' : `${avvisi} avvisi`);
  return { primo, errori, avvisi, conto: pz.length ? 'e ' + pz.join(' e ') : '' };
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
const conNome = (d, s = 'un nome') => d.nome ? cod(d.nome) : s;
const allaRiga = d => d.riga ? `alla riga ${d.riga}` : 'nel punto indicato';
const laRiga = d => d.riga ? `la riga ${d.riga}` : 'il punto indicato';
const colonna = d => d.colonna ? `, colonna ${d.colonna}` : '';
const DEL_KW = { if: 'dell\'`if`', while: 'del `while`', for: 'del `for`' };
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
    id: 'for-punto-e-virgola', lingue: ['c', 'java'], re: [/expected ';' in 'for' statement specifier/i], etichetta: 'il `for` con le virgole',
    frase: () => 'le tre parti del `for` vanno separate con `;`',
    dove: d => `Guarda il \`for\` ${allaRiga(d)}: tra le parentesi devono esserci due \`;\`.`,
    cosa: () => 'Il `for` ha tre parti: partenza, condizione e passo, come in `for (i = 0; i < n; i++)`. Si separano con `;`, non con `,`. Con le virgole il compilatore vede una parte sola.',
    concetto: 'ciclo for',
  },
  {
    id: 'punto-e-virgola', lingue: ['c', 'java'], meccanica: true,
    re: [/expected ';'(?!,)/i, /missing ';'/i, /';' expected/i, /(?:atteso|previsto|attesa) ';'|';' (?:atteso|previsto)/i],
    etichetta: 'manca `;`', breve: () => 'manca ;',
    frase: () => 'manca un `;`',
    dove: (d, x) => {
      const p = puntoMancante(d, x);
      if (p?.riga && p.riga !== d.riga) return `Guarda la fine della riga ${p.riga}, quella prima della ${d.riga}: lì manca il \`;\`. Il compilatore se ne accorge solo quando legge la riga dopo.`;
      if (p?.riga) return `Guarda la fine della riga ${p.riga}${colonna(d)}: lì manca il \`;\`.`;
      return d.riga ? `Guarda la fine della riga ${d.riga} e quella della riga prima: il compilatore a volte se ne accorge solo sulla riga dopo.` : 'Guarda la fine delle istruzioni vicino al punto indicato.';
    },
    cosa: (d, x) => `In ${x.L} ogni istruzione finisce con \`;\`, come una frase finisce con il punto. Senza, il compilatore attacca l'istruzione a quella dopo e non capisce più cosa volevi dire. Per questo a volte l'errore viene segnalato sulla riga successiva.`,
    concetto: 'fine delle istruzioni', correzione: (d, x) => correggiPunto(d, x),
  },
  {
    id: 'include-mancante', lingue: ['c'], meccanica: true,
    re: [/call to undeclared library function '(?<n>[\w$]+)'/i, /implicitly declaring library function '(?<n>[\w$]+)'/i, /incompatible implicit declaration of built-in function '(?<n>[\w$]+)'/i, /dichiarazione implicita incompatibile della funzione (?:built-in |interna )?'(?<n>[\w$]+)'/i],
    etichetta: 'manca un `#include`', breve: d => `manca #include${d.parti.h ? ` <${d.parti.h}>` : ''}`,
    frase: d => d.parti.h ? `per usare ${conNome(d, 'questa funzione')} manca \`#include <${d.parti.h}>\`` : `per usare ${conNome(d, 'questa funzione')} manca un \`#include\``,
    dove: d => `Guarda in cima al file, dove ci sono le righe \`#include\`${d.parti.h ? `: manca quella di \`<${d.parti.h}>\`` : ''}.`,
    cosa: d => {
      let s = /^(bool|true|false)$/.test(d.nome || '')
        ? '`bool`, `true` e `false` in C non ci sono di base: arrivano con `<stdbool.h>`.'
        : `${conNome(d, 'Questo nome')} non lo scrivi tu: sta nella libreria standard del C. Per usarlo devi includere il file che lo descrive (l'header)${d.parti.h ? `, cioè \`<${d.parti.h}>\`` : ''}. Senza \`#include\` il compilatore non sa che esiste né come si usa.`;
      if (d.parti.h === 'math.h') s += ' Con `math.h`, su Linux aggiungi anche `-lm` alla fine del comando di compilazione.';
      return s;
    },
    concetto: 'librerie e #include', correzione: (d, x) => correggiInclude(d, x),
  },
  {
    id: 'funzione-non-dichiarata', lingue: ['c'], re: [/call to undeclared function '(?<n>[\w$]+)'/i, /implicit declaration of function '(?<n>[\w$]+)'/i, /dichiarazione implicita della funzione '(?<n>[\w$]+)'/i],
    etichetta: 'funzione non dichiarata', breve: d => `${d.nome || 'funzione'} non dichiarata`,
    frase: d => `usi la funzione ${conNome(d)} prima di dichiararla`,
    dove: d => `Cerca dove scrivi la funzione ${conNome(d)}: se sta sotto la riga ${d.riga || 'dell\'errore'}, il compilatore lì non la conosce ancora. Controlla anche che il nome sia scritto proprio uguale.`,
    cosa: () => 'Il compilatore legge il file dall\'alto in basso. Se chiami una funzione che non ha ancora visto, non sa quali parametri vuole né cosa restituisce: i compilatori recenti si fermano, quelli più vecchi tirano a indovinare e spesso sbagliano. Sposta la funzione sopra `main`, oppure scrivi sopra `main` il suo prototipo: la prima riga della funzione seguita da `;`.',
    concetto: 'prototipi delle funzioni',
  },
  {
    id: 'non-dichiarato', lingue: ['c', 'java'],
    re: [/use of undeclared identifier '(?<n>[\w$]+)'(?:; did you mean '(?<s>[\w$]+)'\?)?/i, /'(?<n>[\w$]+)' undeclared/i, /'(?<n>[\w$]+)' non (?:è )?dichiarat[oa]/i, /cannot find symbol/i, /impossibile trovare il simbolo|simbolo non trovato/i],
    etichetta: 'nome non dichiarato', breve: d => `${d.nome || 'nome'} non dichiarato`,
    frase: d => d.nome ? `usi ${cod(d.nome)} ma non è dichiarato` : 'usi un nome che non è dichiarato',
    dove: d => (d.parti.s ? `Il compilatore propone ${cod(d.parti.s)}: controlla se volevi scrivere quello. ` : '') +
      `Cerca dove dichiari ${conNome(d, 'questo nome')}: forse ha un altro nome (una lettera diversa, maiuscole e minuscole), o è dichiarato dentro un altro blocco \`{ }\`.`,
    cosa: d => (d.parti.genere === 'method' || d.parti.genere === 'metodo'
      ? 'Il metodo che chiami non esiste con quel nome e con quei tipi di argomenti. Controlla come è scritto e che sia nella classe giusta. '
      : 'Prima di usare una variabile devi dichiararla, cioè scrivere il suo tipo e il suo nome (per esempio `int conta = 0;`). ') +
      'Una variabile dichiarata dentro `{ }` esiste solo lì dentro: fuori dal blocco il compilatore non la vede più. Conta anche l\'ordine: la dichiarazione deve stare sopra la riga che la usa.',
    concetto: 'dichiarazione e visibilità delle variabili',
  },
  {
    id: 'formato', lingue: ['c'],
    re: [/format specifies type '(?<atteso>[^']+)' but the argument has type '(?<dato>[^']+)'/i, /format '(?<f>%[^']*)' expects argument of type '(?<atteso>[^']+)', but argument \d+ has type '(?<dato>[^']+)'/i, /formato '(?<f>%[^']*)'.*?tipo '(?<atteso>[^']+)'.*?tipo '(?<dato>[^']+)'/i],
    etichetta: 'formato di printf o scanf sbagliato',
    frase: d => d.parti.atteso ? `il formato vuole un ${cod(tipoPulito(d.parti.atteso))} ma passi un ${cod(tipoPulito(d.parti.dato))}` : 'il formato non corrisponde al valore che passi',
    dove: d => `Guarda la riga ${d.riga || 'indicata'}: confronta ogni \`%\` della stringa con il valore nella stessa posizione.`,
    cosa: (d, x) => {
      const dato = tipoPulito(d.parti.dato).replace(/\s+/g, ' ');
      // scanf: la riga lo dice; senza riga, quando atteso e dato sono tutti e due indirizzi
      const t = d.riga ? x.riga(d.riga) : null, scanf = t != null ? RE_SCANF.test(t) : /\*\s*$/.test(d.parti.atteso || '') && /\*\s*$/.test(d.parti.dato || '');
      if (scanf) {
        const f = FORMATO_SCANF[dato];
        return 'In `scanf` ogni `%` vuole l\'indirizzo di una variabile del tipo giusto: `%d` → `int`, `%f` → `float`, `%lf` → `double`, `%c` → `char`, `%s` → array di `char`. Se il tipo non corrisponde, il valore letto finisce scritto male.' +
          (f ? ` Per un ${cod(dato)} in \`scanf\` si usa ${cod(f)}.` : '');
      }
      const f = FORMATO[dato];
      return '`printf` non sa di che tipo sono i valori: si fida della stringa di formato. `%d` è per gli `int`, `%f` per i `double`, `%c` per i `char`, `%s` per le stringhe. Se il formato non corrisponde al valore, stampa numeri senza senso.' +
        (dato === 'unsigned long' ? ' Per un `unsigned long` si usa `%lu`; se è il risultato di `strlen` o `sizeof` (un `size_t`) si usa `%zu`.'
          : f ? ` Per un ${cod(dato)} in \`printf\` si usa ${cod(f)}.` : '');
    },
    concetto: 'printf, scanf e i formati',
  },
  {
    id: 'scanf-e-commerciale', lingue: ['c'], etichetta: 'manca `&` in scanf', breve: () => 'manca & in scanf',
    frase: () => '`scanf` vuole l\'indirizzo della variabile: manca `&`',
    dove: d => `Guarda la \`scanf\` ${allaRiga(d)}: c'è una variabile senza \`&\` davanti.`,
    cosa: () => '`scanf` deve scrivere dentro la tua variabile, quindi le serve sapere dove sta in memoria: il suo indirizzo, che si ottiene con `&`. Si scrive `scanf("%d", &n);`. Gli array di `char` (le stringhe) fanno eccezione: il loro nome è già un indirizzo, quindi niente `&`.',
    concetto: 'scanf e indirizzi',
  },
  {
    id: 'return-mancante', lingue: ['c', 'java'], meccanica: true,
    re: [/non-void function (?:'(?<n>[\w$]+)' )?does not return a value(?<tutti> in all control paths)?/i, /control reaches end of non-void function/i, /il controllo raggiunge la fine di una funzione non[- ]void/i, /missing return statement/i, /manca (?:l'istruzione )?return|istruzione return mancante/i],
    etichetta: 'manca il `return`', breve: () => 'manca il return',
    frase: (d, x) => { const f = funzioneDi(d, x); return `${f ? `la funzione ${cod(f.nome)}` : 'la funzione'} ${d.parti.tutti || d.sigla === 'C4715' ? 'in alcuni casi ' : ''}arriva alla fine senza \`return\``; },
    dove: (d, x) => { const f = funzioneDi(d, x); return `Guarda la \`}\` ${allaRiga(d)}: è la fine della funzione${f ? ` ${cod(f.nome)}` : ''}. Segui ogni strada possibile (ogni \`if\` ed \`else\`) e controlla che finisca con un \`return\`.`; },
    cosa: (d, x) => { const f = funzioneDi(d, x); return `Una funzione che non è \`void\`${f?.tipo ? ` (qui restituisce ${cod(f.tipo)})` : ''} promette di restituire un valore. Se arriva alla \`}\` finale senza \`return\`, chi la chiama riceve un valore a caso. Succede spesso con un \`if\` che ha il suo \`return\` ma senza un \`else\`.`; },
    concetto: 'return nelle funzioni', correzione: (d, x) => correggiReturn(d, x),
  },
  {
    id: 'assegnamento-in-condizione', lingue: ['c', 'java'], meccanica: true,
    re: [/using the result of an assignment as a condition without parentheses/i, /suggest parentheses around assignment used as truth value/i, /parentesi (?:attorno|intorno) all'assegnazione/i],
    etichetta: '`=` al posto di `==`', breve: () => '= al posto di ==',
    frase: () => 'nella condizione c\'è `=` (assegna) invece di `==` (confronta)',
    dove: d => `Guarda la condizione ${allaRiga(d)}${colonna(d)}.`,
    cosa: () => '`=` mette un valore nella variabile; `==` controlla se due valori sono uguali. `if (x = 5)` assegna 5 a `x` ed è sempre vero, perché 5 non è zero. Per confrontare serve `if (x == 5)`.',
    concetto: 'assegnamento e confronto', correzione: (d, x) => correggiUguale(d, x),
  },
  {
    id: 'confronto-stringhe', lingue: ['c'], re: [/result of comparison against a string literal is unspecified/i, /comparison with string literal results in unspecified behavio/i],
    etichetta: 'stringhe confrontate con `==`',
    frase: () => 'confronti delle stringhe con `==`',
    dove: d => `Guarda il confronto ${allaRiga(d)}.`,
    cosa: () => 'In C `==` tra due stringhe confronta gli indirizzi, non le lettere: quasi sempre dà falso anche se il testo è uguale. Per confrontare il testo si usa `strcmp(a, b) == 0`, da `<string.h>`. Se invece volevi un solo carattere, scrivilo tra apici singoli: `\'c\'`.',
    concetto: 'stringhe in C',
  },
  {
    id: 'puntatore-intero', lingue: ['c'], re: [/comparison between pointer and integer/i, /confronto tra (?:un )?puntatore e (?:un )?intero/i],
    etichetta: 'confronto tra puntatore e intero',
    frase: () => 'confronti un indirizzo (un puntatore) con un numero o un carattere',
    dove: d => `Guarda i due lati del confronto ${allaRiga(d)}.`,
    cosa: () => 'Da un lato c\'è un puntatore (un indirizzo, per esempio una stringa), dall\'altro un numero o un carattere. Un errore tipico: `"a"` tra virgolette doppie è una stringa, `\'a\'` tra apici singoli è un carattere. Per controllare un carattere scrivi `s[0] == \'a\'`; per confrontare due stringhe usa `strcmp`.',
    concetto: 'caratteri, stringhe e puntatori',
  },
  {
    id: 'puntatori-incompatibili', lingue: ['c'],
    re: [/incompatible pointer types passing '(?<dato>[^']+)' to parameter of type '(?<atteso>[^']+)'/i, /incompatible pointer types (?:assigning to|initializing) '(?<atteso>[^']+)' (?:from|with an expression of type) '(?<dato>[^']+)'/i, /incompatible pointer types/i, /from incompatible pointer type/i, /tipo di puntatore incompatibile/i],
    etichetta: 'puntatori di tipo diverso',
    frase: d => d.parti.dato ? `usi un ${cod(tipoPulito(d.parti.dato))} dove serve un ${cod(tipoPulito(d.parti.atteso))}` : 'usi un puntatore di un tipo dove ne serve un altro',
    dove: d => `Guarda la riga ${d.riga || 'indicata'}: confronta il tipo di quello che passi (o assegni) con il tipo che serve.`,
    cosa: () => 'Un puntatore porta con sé il tipo di quello a cui punta: un `int *` punta a interi, un `char *` a caratteri. Usarne uno al posto dell\'altro di solito vuol dire che hai sbagliato variabile, oppure il tipo nella dichiarazione o nel parametro della funzione.',
    concetto: 'puntatori',
  },
  {
    id: 'intero-puntatore', lingue: ['c'],
    re: [/incompatible (?<verso>integer to pointer|pointer to integer) conversion/i, /makes (?<verso2>pointer from integer|integer from pointer) without a cast/i, /crea un (?:puntatore da un intero|intero da un puntatore)/i],
    etichetta: 'numero e indirizzo mescolati',
    frase: () => 'mescoli un numero e un indirizzo (un puntatore)',
    dove: d => `Guarda la riga ${d.riga || 'indicata'}: da una parte c'è un puntatore, dall'altra un valore normale.`,
    cosa: d => {
      const m = apici(d.messaggio);
      let s = 'Un puntatore contiene un indirizzo di memoria, non un numero qualsiasi. Se vuoi l\'indirizzo di una variabile scrivi `&x`; se vuoi il valore a cui punta un puntatore scrivi `*p`.';
      if (/take the address with &/i.test(m)) s += ' Qui il compilatore suggerisce `&`.';
      if (/dereference with \*/i.test(m)) s += ' Qui il compilatore suggerisce `*`.';
      if (/char\[\d*\]|char \*/.test(m) && /'char'|'int'/.test(m)) s += ' Attenzione: `"a"` tra virgolette doppie è una stringa; un carattere si scrive tra apici singoli: `\'a\'`.';
      return s;
    },
    concetto: 'puntatori',
  },
  {
    id: 'variabile-non-usata', lingue: ['c'], re: [/unused variable '(?<n>[\w$]+)'/i, /variable '(?<n>[\w$]+)' set but not used/i, /variabile '(?<n>[\w$]+)' (?:non usata|impostata ma non usata|non utilizzata)/i],
    etichetta: 'variabile non usata', breve: d => `${d.nome || 'variabile'} non usata`,
    frase: d => `${conNome(d, 'una variabile')} è dichiarata ma non la usi mai`,
    dove: d => `Guarda la dichiarazione ${allaRiga(d)}.`,
    cosa: () => 'È solo un avviso: il programma compila lo stesso. Però spesso vuol dire che ti sei dimenticato di usarla, o che al suo posto usi per sbaglio un\'altra variabile con un nome simile. Se non serve, toglila.',
    concetto: 'variabili',
  },
  {
    id: 'parametro-non-usato', lingue: ['c'], re: [/unused parameter '(?<n>[\w$]+)'/i, /parametro '(?<n>[\w$]+)' non (?:usato|utilizzato)/i],
    etichetta: 'parametro non usato',
    frase: d => `il parametro ${conNome(d, '')} non viene mai usato`,
    dove: d => `Guarda la prima riga della funzione ${allaRiga(d)}.`,
    cosa: () => 'La funzione riceve questo valore ma non lo usa. A volte va bene (per esempio `argc` e `argv` in `main`); altre volte vuol dire che al suo posto usi un\'altra variabile.',
    concetto: 'parametri delle funzioni',
  },
  {
    id: 'non-inizializzata', lingue: ['c', 'java'],
    re: [/variable '(?<n>[\w$]+)' is uninitialized when used here/i, /'(?<n>[\w$]+)' is used uninitialized/i, /'(?<n>[\w$]+)' may be used uninitialized/i, /variable '(?<n>[\w$]+)' is used uninitialized whenever/i, /'(?<n>[\w$]+)' (?:è|viene) usat[ao] (?:senza essere )?(?:non )?inizializzat/i, /variable (?<n>[\w$]+) might not have been initialized/i, /la variabile (?<n>[\w$]+) potrebbe non essere stata inizializzata/i],
    etichetta: 'variabile senza valore', breve: d => `${d.nome || 'variabile'} senza valore`,
    frase: d => `usi ${conNome(d, 'una variabile')} prima di darle un valore`,
    dove: d => `Guarda ${laRiga(d)}, poi risali fino alla dichiarazione di ${conNome(d, 'questa variabile')}${d.parti.dichiarata ? ` (riga ${d.parti.dichiarata})` : ''}: c'è una strada in cui non riceve mai un valore?`,
    cosa: (d, x) => x.L === 'Java'
      ? 'In Java una variabile locale deve ricevere un valore prima di essere letta, su ogni strada possibile (anche quando un `if` è falso). Dai un valore di partenza nella dichiarazione, per esempio `int somma = 0;`.'
      : 'Una variabile locale appena dichiarata contiene un valore a caso, quello rimasto in memoria. Prima di leggerla devi darle un valore, per esempio `int somma = 0;`. Capita spesso con le somme e i contatori.',
    concetto: 'inizializzazione delle variabili',
  },
  {
    id: 'riferimento-non-definito', lingue: ['c'], etichetta: 'funzione mai definita (linker)', breve: d => d.parti.main ? 'manca main' : `${d.nome || 'funzione'} non definita`,
    frase: d => d.parti.main ? 'manca la funzione `main`' : d.parti.h === 'math.h' ? `${conNome(d)} non viene trovata: manca \`-lm\` nel comando` : `${conNome(d, 'una funzione')} è usata ma non trovo dove è scritta`,
    dove: d => d.parti.main
      ? 'Controlla che uno dei file abbia `int main(void)` (oppure `int main(int argc, char *argv[])`) scritto proprio così, e che quel file sia nel comando di compilazione.'
      : d.parti.h === 'math.h' ? 'Guarda il comando di compilazione: alla fine serve `-lm`.'
        : `Il linker non indica una riga. Cerca nel progetto il corpo di ${conNome(d, 'questa funzione')}, cioè la versione con le \`{ }\`: il nome deve essere identico (maiuscole comprese) e il file che la contiene deve essere nel comando di compilazione.`,
    cosa: d => d.parti.main
      ? 'Ogni programma C parte da `main`. Se manca, o è scritta con un altro nome (`Main`, `mian`), non c\'è un punto da cui partire. Su Windows il messaggio a volte parla di `WinMain`: è lo stesso problema.'
      : d.parti.h === 'math.h' ? 'Le funzioni di `<math.h>` stanno in una libreria a parte. Su Linux (e a volte con MinGW) bisogna aggiungere `-lm` alla fine del comando: `gcc main.c -o main -lm`.'
        : 'La compilazione ha due fasi: prima ogni file `.c` viene tradotto da solo, poi il linker li unisce. Il prototipo dice al compilatore che la funzione esiste, ma il linker non ha trovato il suo corpo da nessuna parte. Di solito il nome è scritto diverso, un file manca nel comando, o la funzione non è mai stata scritta.',
    concetto: 'compilazione e linker',
  },
  {
    id: 'definizione-multipla', lingue: ['c'], etichetta: 'definita due volte (linker)', breve: d => `${d.nome || 'nome'} definito due volte`,
    frase: d => `${conNome(d, 'un nome')} è definito due volte nel programma`,
    dove: d => `Cerca ${conNome(d, 'questo nome')} in tutti i file del progetto. Spesso è una variabile o una funzione scritta dentro un file \`.h\` incluso da più file \`.c\`, oppure un file \`.c\` incluso con \`#include\`.`,
    cosa: () => 'Ogni funzione e ogni variabile globale deve avere una sola definizione in tutto il programma. Nei file `.h` vanno solo i prototipi (e le variabili con `extern`); i corpi delle funzioni vanno nei `.c`. Un file `.c` non si include con `#include`.',
    concetto: 'file .h e .c',
  },
  {
    id: 'tipi-in-conflitto', lingue: ['c'], re: [/conflicting types for '(?<n>[\w$]+)'/i, /tipi in conflitto per '(?<n>[\w$]+)'/i],
    etichetta: 'dichiarazioni diverse',
    frase: d => `${conNome(d, 'una funzione')} è dichiarata in due modi diversi`,
    dove: d => `Confronta la riga ${d.riga || 'indicata'} con la dichiarazione precedente${d.parti.prima ? ` (riga ${d.parti.prima})` : ''}: tipo restituito e parametri devono essere identici.` +
      (d.note.some(n => /implicit/i.test(n.messaggio)) ? ` La prima dichiarazione qui è implicita: hai chiamato ${conNome(d, 'la funzione')} prima di dichiararla. Metti il prototipo sopra \`main\`.` : ''),
    cosa: () => 'Il prototipo (la riga con `;`, di solito in alto o in un `.h`) e la funzione vera devono dire le stesse cose: stesso tipo restituito, stessi tipi dei parametri, nello stesso ordine.',
    concetto: 'prototipi delle funzioni',
  },
  {
    id: 'argomenti', lingue: ['c', 'java'],
    re: [/too (?<q>few|many) arguments to function call, expected (?<e>\d+), have (?<h>\d+)/i, /too (?<q>few|many) arguments to function '(?<n>[\w$]+)'/i, /troppo (?<q>pochi|molti) argomenti (?:per la|alla) funzione '?(?<n>[\w$]+)?/i, /method (?<n>[\w$]+) in (?:class|interface) [\w$<>]+ cannot be applied to given types/i, /constructor (?<n>[\w$]+) in class [\w$<>]+ cannot be applied/i],
    etichetta: 'numero di argomenti sbagliato',
    frase: d => {
      const q = d.parti.q, poco = q === 'few' || q === 'pochi', tanti = q === 'many' || q === 'molti';
      const quanti = d.parti.e ? ` (${d.parti.h} invece di ${d.parti.e})` : '';
      return poco ? `passi meno argomenti di quelli che la funzione vuole${quanti}` : tanti ? `passi più argomenti di quelli che la funzione vuole${quanti}` : `la chiamata a ${conNome(d, 'questa funzione')} non corrisponde ai suoi parametri`;
    },
    dove: d => `Confronta la chiamata ${allaRiga(d)} con la prima riga della funzione${d.nome ? ` ${cod(d.nome)}` : ''}${d.parti.dich ? ` (riga ${d.parti.dich})` : ''}: conta gli argomenti e guarda i loro tipi.`,
    cosa: () => 'Una funzione va chiamata con tanti argomenti quanti sono i suoi parametri, nello stesso ordine. Se la funzione è `int somma(int a, int b)`, la chiamata è `somma(x, y)`.',
    concetto: 'parametri delle funzioni',
  },
  {
    id: 'graffa', lingue: ['c', 'java'],
    re: [/expected '\}'/i, /expected declaration or statement at end of input/i, /reached end of file while parsing/i, /(?<troppa>extraneous closing brace)/i, /(?:atteso|previsto) '\}'|fine (?:del file|dell'input) raggiunta/i],
    etichetta: 'graffa che manca',
    frase: d => d.parti.troppa ? 'c\'è una `}` di troppo' : 'manca una `}`',
    dove: d => d.parti.troppa ? `Guarda la \`}\` ${allaRiga(d)}: chiude un blocco che era già chiuso. Conta le \`{\` e le \`}\` sopra.`
      : `Il compilatore se ne accorge solo alla fine${d.riga ? ` (riga ${d.riga})` : ''}, ma la graffa manca prima.${d.parti.aperta ? ` La \`{\` rimasta aperta è alla riga ${d.parti.aperta}.` : ''} Conta le \`{\` e le \`}\` di ogni funzione, di ogni \`if\` e di ogni ciclo.`,
    cosa: () => 'Ogni `{` apre un blocco e ogni `}` lo chiude: devono essere in pari. Con il codice indentato bene (ogni blocco spostato un po\' a destra) la graffa che manca si vede subito.',
    concetto: 'blocchi e graffe',
  },
  {
    id: 'parentesi', lingue: ['c', 'java'], re: [/expected '\)'/i, /missing '\)'/i, /'\)' expected/i, /(?:atteso|previsto) '\)'|'\)' (?:atteso|previsto)/i],
    etichetta: 'parentesi che manca',
    frase: () => 'manca una `)`',
    dove: d => d.parti.aperta ? `La \`(\` rimasta aperta è alla riga ${d.parti.aperta}${d.parti.apertaCol ? `, colonna ${d.parti.apertaCol}` : ''}: la sua \`)\` manca prima del punto segnalato ${allaRiga(d)}.` : `Guarda la riga ${d.riga || 'indicata'} e conta le \`(\` e le \`)\`.`,
    cosa: () => 'Ogni `(` deve avere la sua `)`. Nelle condizioni lunghe e nelle chiamate dentro altre chiamate è facile perderne una: contale da sinistra a destra.',
    concetto: 'parentesi',
  },
  {
    id: 'espressione-attesa', lingue: ['c', 'java'], re: [/expected expression/i, /illegal start of expression/i, /(?:attesa|prevista) (?:un'|una )?espressione|inizio (?:non valido|illegale) (?:dell'|di )espressione/i],
    etichetta: 'manca un valore',
    frase: () => 'il compilatore si aspettava un valore e non l\'ha trovato',
    dove: d => `Guarda ${laRiga(d)}${colonna(d)}: lì manca qualcosa (un numero, una variabile) oppure c'è un simbolo di troppo. Succede anche con le virgolette non chiuse sulla stessa riga.`,
    cosa: () => 'Dopo un `=`, un operatore come `+` o una virgola, il compilatore si aspetta un valore. Se trova subito `;`, `)` o un altro simbolo, si ferma.',
    concetto: 'espressioni',
  },
  {
    id: 'ridefinizione', lingue: ['c', 'java'], re: [/redefinition of '(?<n>[\w$]+)'/i, /redeclaration of '(?<n>[\w$]+)'/i, /(?:ridefinizione|ridichiarazione) di '(?<n>[\w$]+)'/i, /variable (?<n>[\w$]+) is already defined in/i, /la variabile (?<n>[\w$]+) è già definita/i],
    etichetta: 'dichiarato due volte', breve: d => `${d.nome || 'nome'} dichiarato due volte`,
    frase: d => `${conNome(d, 'un nome')} è dichiarato due volte`,
    dove: d => d.parti.prima ? `Le due dichiarazioni sono alla riga ${d.parti.prima} e alla riga ${d.riga}.` : `Cerca sopra la riga ${d.riga || 'indicata'} un'altra dichiarazione di ${conNome(d, 'questo nome')}.`,
    cosa: () => 'Nello stesso blocco un nome si dichiara una volta sola. Se vuoi solo cambiare il valore, scrivi `x = 2;` senza il tipo davanti.',
    concetto: 'dichiarazione delle variabili',
  },
  {
    id: 'non-array', lingue: ['c', 'java'], re: [/subscripted value is not an array, pointer, or vector/i, /subscripted value is neither array nor pointer/i, /array required, but [\w$]+ found/i, /il valore indicizzato non è né un array né un puntatore/i],
    etichetta: '`[ ]` su un non array',
    frase: () => 'usi `[ ]` su qualcosa che non è un array',
    dove: d => `Guarda le parentesi quadre ${allaRiga(d)}${colonna(d)}.`,
    cosa: () => 'Le parentesi quadre servono a prendere un elemento di un array (o di un puntatore). Una variabile semplice, come un `int`, non ha elementi. Forse volevi usare un\'altra variabile, oppure dichiararla come array, per esempio `int v[10];`.',
    concetto: 'array',
  },
  {
    id: 'freccia-punto', lingue: ['c'],
    re: [/member reference type '[^']+' is a pointer; did you mean to use '(?<usa>->)'/i, /member reference type '[^']+' is not a pointer; did you mean to use '(?<usa>\.)'/i, /'[\w$]+' is a pointer; did you mean to use '(?<usa>->)'/i, /invalid type argument of '->'/i, /request for member '(?<m>[\w$]+)' in something not a structure or union/i],
    etichetta: '`.` e `->` scambiati',
    frase: d => d.parti.usa === '.' ? 'con una struttura (non un puntatore) si usa `.`, non `->`' : d.parti.usa === '->' ? 'con un puntatore a struttura si usa `->`, non `.`' : 'il campo della struttura si prende nel modo sbagliato',
    dove: d => `Guarda ${laRiga(d)}${colonna(d)}: controlla come è dichiarata la variabile prima del punto o della freccia.`,
    cosa: () => 'Se hai la struttura stessa (`struct nodo n`), il campo si prende con il punto: `n.val`. Se hai un puntatore alla struttura (`struct nodo *p`), si usa la freccia: `p->val`, che vuol dire `(*p).val`.',
    concetto: 'strutture e puntatori',
  },
  {
    id: 'membro-inesistente', lingue: ['c'], re: [/no member named '(?<m>[\w$]+)' in '(?<t>[^']+)'/i, /'(?<t>[^']+)' has no member named '(?<m>[\w$]+)'/i, /'(?<t>[^']+)' non ha un membro (?:chiamato|di nome) '(?<m>[\w$]+)'/i],
    etichetta: 'campo che non esiste',
    frase: d => d.parti.m ? `${cod(tipoPulito(d.parti.t || 'la struttura'))} non ha un campo ${cod(d.parti.m)}` : 'la struttura non ha questo campo',
    dove: d => `Guarda la definizione della struttura${d.parti.t ? ` ${cod(tipoPulito(d.parti.t))}` : ''} e confronta i nomi dei campi${d.parti.m ? ` con ${cod(d.parti.m)}` : ''}.`,
    cosa: () => 'I campi di una struttura sono quelli scritti nella sua definizione, con quei nomi esatti. Un nome diverso, anche di una lettera sola, è un altro campo.',
    concetto: 'strutture',
  },
  {
    id: 'header-non-trovato', lingue: ['c'], re: [/'(?<h>[^']+)' file not found/i, /^(?<h>[\w./\\-]+\.h(?:pp)?): No such file or directory/i, /^(?<h>[\w./\\-]+\.h(?:pp)?): (?:File o directory non esistente|file o directory inesistente)/i, /Cannot open include file: '(?<h>[^']+)'/i],
    etichetta: 'header non trovato',
    frase: d => `non trovo il file ${cod(d.parti.h || 'incluso')}`,
    dove: d => {
      const h = d.parti.h || '', v = vicino(h);
      let s = `Guarda la riga \`#include\` ${allaRiga(d)}.`;
      if (v && v !== h) s += ` Forse volevi ${cod(v)}.`;
      if (/^conio\.h$/i.test(h)) s += ' `conio.h` esiste solo con alcuni compilatori vecchi per Windows (Turbo C, Dev-C++): non fa parte del C standard.';
      return s;
    },
    cosa: () => 'Con `#include <nome.h>` il compilatore cerca il file tra quelli del sistema; con `#include "nome.h"` lo cerca prima nella cartella del progetto. Se il nome è sbagliato anche di una lettera, non lo trova e si ferma subito.',
    concetto: 'librerie e #include',
  },
  {
    id: 'file-sorgente-mancante', lingue: ['c'], re: [/no such file or directory: '(?<h>[^']+)'/i, /^(?<h>[^:]+\.(?:c|cc|cpp|o)): No such file or directory/i],
    etichetta: 'file non trovato',
    frase: d => `il compilatore non trova il file ${cod(nomeFile(d.parti.h) || 'indicato')}`,
    dove: () => 'Guarda il comando di compilazione e i nomi dei file nella cartella.',
    cosa: () => 'Il comando nomina un file che nella cartella non c\'è. Controlla il nome (maiuscole, estensione `.c`) e che il comando parta dalla cartella giusta.',
    concetto: 'compilazione',
  },
  {
    id: 'non-assegnabile', lingue: ['c'], re: [/array type '(?<arr>[^']+)' is not assignable/i, /(?<arr>assignment to expression with array type)/i, /expression is not assignable/i, /lvalue required as left operand of assignment/i, /richiesto un lvalue/i],
    etichetta: 'assegnamento impossibile',
    frase: d => d.parti.arr ? 'non puoi copiare un array (o una stringa) con `=`' : 'a sinistra di `=` c\'è qualcosa che non è una variabile',
    dove: d => `Guarda quello che sta a sinistra di \`=\` ${allaRiga(d)}.`,
    cosa: d => d.parti.arr
      ? 'Un array non si copia con `=`. Per una stringa usa `strcpy(destinazione, "testo");` da `<string.h>`, oppure dai il valore quando la dichiari: `char nome[10] = "testo";`.'
      : 'A sinistra di `=` deve esserci un posto dove mettere il valore: una variabile, un elemento di array, un campo. Non un calcolo come `a + 1`. Se volevi confrontare, serve `==`.',
    concetto: 'assegnamento',
  },
  {
    id: 'tipo-sconosciuto', lingue: ['c'], re: [/unknown type name '(?<n>[\w$]+)'/i, /nome di tipo '(?<n>[\w$]+)' sconosciuto/i],
    etichetta: 'tipo sconosciuto',
    frase: d => `${conNome(d, 'questo nome')} non è un tipo che il compilatore conosce`,
    dove: d => `Guarda ${laRiga(d)} e cerca sopra dove definisci ${conNome(d, 'il tipo')}.`,
    cosa: d => d.nome === 'string'
      ? 'In C il tipo `string` non esiste (c\'è in C++ e in altri linguaggi). Una stringa in C è un array di `char`: `char s[50];` oppure `char *s`.'
      : 'Prima di usare un tipo come `Nodo` va definito, per esempio con `typedef struct nodo Nodo;`, sopra la riga che lo usa. Controlla anche maiuscole e minuscole.',
    concetto: 'tipi e typedef',
  },
  {
    id: 'virgolette', lingue: ['c', 'java'], re: [/missing terminating '?["']'? character/i, /unclosed string literal/i, /stringa (?:letterale )?non chiusa|manca il carattere '?"'? di (?:chiusura|terminazione)/i],
    etichetta: 'stringa non chiusa',
    frase: () => 'una stringa non è chiusa: manca `"`',
    dove: d => `Guarda ${laRiga(d)}${colonna(d)}: da lì parte la stringa. Cerca dove dovrebbe finire.`,
    cosa: () => 'Una stringa inizia e finisce con `"` sulla stessa riga. Se manca quella di chiusura, il compilatore considera stringa tutto il resto della riga e poi si perde: per questo gli errori che vengono dopo spesso spariscono da soli.',
    concetto: 'stringhe',
  },
  {
    id: 'if-vuoto', lingue: ['c'], re: [/(?<kw>if|while|for) (?:statement|loop) has empty body/i, /suggest braces around empty body in an? '(?<kw>if|else|do)' statement/i, /corpo vuoto/i],
    etichetta: '`;` dopo la condizione',
    frase: d => senzaCondizione(d) ? `c'è un \`;\` subito dopo \`${d.parti.kw}\`` : `c'è un \`;\` subito dopo la condizione ${DEL_KW[d.parti.kw] || DEL_KW.if}`,
    dove: d => senzaCondizione(d) ? `Guarda la riga ${d.riga || 'indicata'}: subito dopo \`${d.parti.kw}\` c'è un \`;\`.` : `Guarda la fine della riga ${d.riga || 'indicata'}: dopo la \`)\` della condizione c'è un \`;\`.`,
    cosa: d => d.parti.kw === 'else' ? 'Il `;` subito dopo `else` è un\'istruzione vuota: l\'`else` comanda solo quella. Il blocco `{ }` sotto viene eseguito sempre, anche quando la condizione dell\'`if` è vera.'
      : d.parti.kw === 'do' ? 'Il `;` subito dopo `do` è un\'istruzione vuota: il ciclo ripete solo quella. Il blocco `{ }` sotto non fa parte del ciclo.'
        : 'Il `;` subito dopo `if (...)` è un\'istruzione vuota: l\'`if` controlla solo quella. Il blocco `{ }` sotto viene eseguito sempre, qualunque sia la condizione. Con `while` è peggio: il ciclo può non finire mai.',
    concetto: 'if e cicli',
  },
  {
    id: 'confronto-inutile', lingue: ['c'], re: [/(?<uguale>equality) comparison result unused/i, /statement with no effect/i, /expression result unused/i, /l'istruzione non ha effetto/i],
    etichetta: 'istruzione che non fa niente',
    frase: d => d.parti.uguale || /'=='/.test(apici(d.messaggio)) ? 'c\'è un `==` che non fa niente: forse volevi `=`' : 'questa istruzione non fa niente',
    dove: d => `Guarda ${laRiga(d)}${colonna(d)}.`,
    cosa: d => d.parti.uguale || /'=='/.test(apici(d.messaggio))
      ? 'Un confronto da solo (`x == 4;`) calcola vero o falso e butta via il risultato. Se volevi dare un valore alla variabile serve un solo `=`: `x = 4;`.'
      : 'Un calcolo che non viene salvato in una variabile, né stampato, né usato in una condizione, viene buttato via. Forse manca un `=` o una chiamata a funzione.',
    concetto: 'assegnamento e confronto',
  },
  {
    id: 'indirizzo-locale', lingue: ['c'], re: [/address of stack memory associated with local variable '(?<n>[\w$]+)' returned/i, /function returns address of local variable/i, /restituisce l'indirizzo di una variabile locale/i],
    etichetta: 'indirizzo di una variabile locale',
    frase: d => `restituisci l'indirizzo di ${conNome(d, 'una variabile locale')}, che sparisce quando la funzione finisce`,
    dove: d => `Guarda il \`return\` ${allaRiga(d)}.`,
    cosa: () => 'Le variabili locali vivono solo finché la funzione è in esecuzione. Restituire il loro indirizzo vuol dire dare a chi chiama un posto di memoria che non esiste più. Se devi restituire un array, crealo con `malloc` (e poi ricordati `free`), oppure fattelo passare come parametro.',
    concetto: 'memoria e funzioni',
  },
  {
    id: 'segni-diversi', lingue: ['c'], re: [/comparison of integers of different signs/i, /comparison of integer expressions of different signedness/i, /comparison between signed and unsigned/i, /confronto tra (?:espressioni )?(?:intere )?(?:con e senza segno|signed e unsigned)/i],
    etichetta: 'numeri con e senza segno',
    frase: () => 'confronti un numero con il segno e uno senza segno',
    dove: d => `Guarda il confronto ${allaRiga(d)}.`,
    cosa: () => 'Funzioni come `strlen` restituiscono un numero senza segno (`size_t`). Confrontarlo con un `int` di solito funziona, ma se l\'`int` è negativo il confronto sbaglia. È un avviso: puoi dichiarare l\'indice come `size_t`, oppure salvare la lunghezza in un `int` prima del ciclo.',
    concetto: 'tipi interi',
  },
  {
    id: 'return-void', lingue: ['c', 'java'], re: [/void function '(?<n>[\w$]+)' should not return a value/i, /'return' with a value, in function returning void/i, /(?<senza>non-void function '(?<n2>[\w$]+)' should return a value)/i, /(?<senza2>'return' with no value, in function returning non-void)/i, /unexpected return value/i, /(?<senza3>missing return value)/i],
    etichetta: '`return` e `void` in contrasto',
    frase: d => d.parti.senza || d.parti.senza2 || d.parti.senza3 || d.sigla === 'C2561' ? '`return;` senza valore in una funzione che deve restituirne uno' : 'una funzione `void` non può restituire un valore',
    dove: d => `Guarda il \`return\` ${allaRiga(d)} e la prima riga della funzione.`,
    cosa: () => '`void` vuol dire che la funzione non restituisce niente: lì si scrive solo `return;` (o niente). Se la funzione deve dare un risultato, al posto di `void` va il tipo giusto, per esempio `int`, e ogni `return` deve avere un valore.',
    concetto: 'return nelle funzioni',
  },
  {
    id: 'main-int', lingue: ['c'], re: [/'main' must return 'int'/i, /return type of 'main' is not 'int'/i, /il tipo (?:restituito|di ritorno) di 'main' non è 'int'/i],
    etichetta: '`main` non `int`',
    frase: () => '`main` deve restituire `int`',
    dove: d => `Guarda la riga di \`main\`${d.riga ? ` (riga ${d.riga})` : ''}.`,
    cosa: () => 'Lo standard del C vuole `int main(void)`, e alla fine `return 0;` per dire «tutto bene». `void main` lo accettano solo alcuni compilatori vecchi.',
    concetto: 'la funzione main',
  },
  {
    id: 'fuori-array', lingue: ['c'], re: [/array index (?<i>-?\d+) is (?:past the end|before the beginning) of the array/i, /array subscript (?<i>-?\d+) is (?:above|below) array bounds/i, /indice (?<i>-?\d+) (?:dell'array )?(?:fuori|oltre)/i],
    etichetta: 'indice fuori dall\'array',
    frase: d => d.parti.i != null ? `usi l'indice ${d.parti.i}, ma l'array non arriva fin lì` : 'usi un indice fuori dall\'array',
    dove: d => `Guarda ${laRiga(d)}${d.note[0]?.riga ? ` e la dichiarazione dell'array alla riga ${d.note[0].riga}` : ''}.`,
    cosa: () => 'Un array di N elementi ha gli indici da `0` a `N-1`: con `int v[5]` l\'ultimo è `v[4]`, e `v[5]` è già fuori. Succede spesso con un ciclo `for (i = 0; i <= 5; i++)` invece di `i < 5`.',
    concetto: 'array e indici',
  },
  {
    id: 'argomenti-formato', lingue: ['c'], re: [/(?<piu>more '%' conversions than data arguments)/i, /data argument not used by format string/i, /too many arguments for format/i, /(?<piu2>expects a matching '[^']+' argument)/i, /(?<piu3>too few arguments for format)/i],
    etichetta: '`%` e valori non tornano',
    frase: d => d.parti.piu || d.parti.piu2 || d.parti.piu3 || d.sigla === 'C4473' ? 'nella stringa ci sono più `%` che valori' : 'passi più valori dei `%` nella stringa',
    dove: d => `Guarda la stringa ${allaRiga(d)} e conta i \`%\` e i valori dopo la virgola.`,
    cosa: () => 'Ogni `%d`, `%f`, `%c`… nella stringa di `printf` (o `scanf`) prende il valore successivo, nell\'ordine. Il numero di `%` e il numero di valori dopo la stringa devono essere uguali.',
    concetto: 'printf e i formati',
  },
  {
    id: 'divisione-zero', lingue: ['c'], re: [/(?:division|remainder) by zero is undefined/i, /^division by zero/i, /divisione per zero/i],
    etichetta: 'divisione per zero',
    frase: () => 'dividi per zero',
    dove: d => `Guarda la divisione ${allaRiga(d)}.`,
    cosa: () => 'Dividere un intero per zero non ha un risultato: di solito il programma si blocca. Prima di dividere controlla che il divisore non sia zero, per esempio con `if (n != 0)`.',
    concetto: 'divisione',
  },
  {
    id: 'troppi-inizializzatori', lingue: ['c'], re: [/excess elements in (?:array|scalar|struct) initializer/i, /(?:troppi|elementi in eccesso).*inizializzator/i],
    etichetta: 'troppi valori nell\'array',
    frase: () => 'metti più valori di quanti l\'array ne può tenere',
    dove: d => `Guarda la dichiarazione ${allaRiga(d)}: confronta la dimensione tra \`[ ]\` con quanti valori ci sono tra \`{ }\`.`,
    cosa: () => 'Se un array ha posto per 2 valori e tra le graffe ne scrivi 3, il terzo viene buttato. Aumenta la dimensione o togli dei valori. Puoi anche lasciare le quadre vuote, `int v[] = {1, 2, 3};`, e il compilatore conta da solo.',
    concetto: 'array',
  },
  {
    id: 'operandi', lingue: ['c', 'java'], re: [/invalid operands to binary expression \('(?<a>[^']+)' and '(?<b>[^']+)'\)/i, /invalid operands to binary \S+ \(have '(?<a>[^']+)' and '(?<b>[^']+)'\)/i, /bad operand types for binary operator/i, /operandi non validi/i],
    etichetta: 'operazione impossibile tra questi tipi',
    frase: d => d.parti.a ? `l'operazione non si può fare tra ${cod(tipoPulito(d.parti.a))} e ${cod(tipoPulito(d.parti.b))}` : 'l\'operazione non si può fare tra questi due tipi',
    dove: d => `Guarda l'operatore ${allaRiga(d)}${colonna(d)} e i tipi dei due lati.`,
    cosa: (d, x) => x.L === 'Java'
      ? 'Gli operatori come `&&`, `+` o `<` vogliono tipi precisi: `&&` lavora su `boolean`, `<` sui numeri. Le stringhe non si confrontano con `<`: si usa `compareTo`, e per l\'uguaglianza `equals`.'
      : 'Gli operatori come `+`, `-` e `<` funzionano sui numeri (e alcuni sui puntatori). Due strutture non si sommano e non si confrontano direttamente: lavora sui loro campi, per esempio `a.x + b.x`. Le stringhe in C non si uniscono con `+`: si usa `strcat`.',
    concetto: 'tipi e operatori',
  },
  {
    id: 'carattere-strano', lingue: ['c', 'java'], re: [/stray '\\?[^']*' in program/i, /illegal character: '\\?[^']*'/i, /non-ASCII characters are not allowed outside of literals/i, /carattere (?:non valido|illegale|vagante)/i],
    etichetta: 'carattere strano nel codice',
    frase: () => 'nel codice c\'è un carattere strano',
    dove: d => `Guarda ${laRiga(d)}${colonna(d)}.`,
    cosa: () => 'Spesso è un carattere copiato da un PDF o da una pagina web: virgolette curve `“ ”`, un apostrofo curvo, uno spazio speciale o un trattino lungo. A occhio sembrano uguali, ma per il compilatore non lo sono. Riscrivi la riga a mano.',
    concetto: 'caratteri nel codice',
  },
  {
    id: 'non-sicura', lingue: ['c'], re: [/This function or variable may be unsafe/i, /potrebbe non essere sicur/i],
    etichetta: 'Visual Studio e le funzioni «non sicure»',
    frase: d => `Visual Studio non vuole ${conNome(d, 'questa funzione')}: la considera non sicura`,
    dove: () => 'Non c\'è niente di sbagliato nel tuo C: è una regola di Visual Studio.',
    cosa: () => 'Visual Studio segnala `scanf`, `strcpy` e simili perché, usate male, possono scrivere oltre la fine di un array. Il C standard le permette e i corsi le usano. Per spegnere l\'avviso scrivi `#define _CRT_SECURE_NO_WARNINGS` come primissima riga del file, prima degli `#include`. Se il docente preferisce `scanf_s`, segui il docente.',
    concetto: 'compilatori diversi',
  },
  {
    id: 'ricorsione-infinita', lingue: ['c', 'java'], re: [/all paths through this function will call itself/i, /infinite recursion detected/i, /ricorsione infinita/i],
    etichetta: 'ricorsione senza fine',
    frase: () => 'la funzione chiama sempre se stessa: non si ferma mai',
    dove: (d, x) => { const f = funzioneDi(d, x); return `Guarda la funzione${f ? ` ${cod(f.nome)}` : ''} ${allaRiga(d)}: cerca il caso base, cioè un \`if\` che restituisce un valore senza richiamare la funzione.`; },
    cosa: () => 'Una funzione ricorsiva deve avere un caso base, e ogni chiamata deve avvicinarsi a quel caso (per esempio con `n - 1`). Qui ogni strada porta a un\'altra chiamata: il programma riempirà la memoria e si fermerà.',
    concetto: 'ricorsione',
  },
  {
    id: 'sintassi', lingue: ['c', 'java'], re: [/expected (?:identifier|statement|declaration|unqualified-id|'\(')/i, /expected '=', ','/i, /<identifier> expected/i, /not a statement/i, /class, interface, enum, or record expected/i, /syntax error/i, /errore di sintassi/i],
    etichetta: 'codice scritto in un modo che il compilatore non capisce',
    frase: () => 'il compilatore non capisce come continua il codice qui',
    dove: d => `Guarda ${laRiga(d)} e quella prima: spesso il problema vero sta subito sopra, per esempio un \`;\` di troppo dopo la prima riga di una funzione, una \`}\` in più o una parentesi non chiusa.`,
    cosa: () => 'Il compilatore legge il codice seguendo regole precise, come la grammatica di una lingua. Qui ha trovato qualcosa che in quel punto non può stare. Il messaggio originale dice cosa si aspettava.',
    concetto: 'sintassi',
  },

  // ===== Java (solo quello che cambia rispetto al C) =====
  {
    id: 'java-tipi', lingue: ['java'], re: [/(?<perdita>possible lossy conversion) from (?<dato>[\w$.<>\[\]]+) to (?<atteso>[\w$.<>\[\]]+)/i, /incompatible types: (?<dato>.+?) cannot be converted to (?<atteso>.+)$/i, /tipi incompatibili/i],
    etichetta: 'tipi incompatibili (Java)',
    frase: d => d.parti.perdita ? `da ${cod(d.parti.dato)} a ${cod(d.parti.atteso)} si possono perdere dei dati` : d.parti.dato ? `${cod(d.parti.dato)} non si può usare dove serve ${cod(d.parti.atteso)}` : 'il valore non ha il tipo che serve',
    dove: d => `Guarda ${laRiga(d)}${colonna(d)}: confronta il tipo della variabile con quello del valore.`,
    cosa: () => 'In Java ogni variabile ha un tipo e il compilatore controlla che i valori corrispondano. Da `double` a `int` si perdono i decimali, quindi va detto esplicitamente con un cast: `(int) x`. Una `String` non diventa un numero da sola: si usa `Integer.parseInt(s)`.',
    concetto: 'tipi in Java',
  },
  {
    id: 'java-import', lingue: ['java'], etichetta: 'manca un `import` (Java)',
    frase: d => `per usare ${conNome(d, 'questa classe')} manca un \`import\``,
    dove: () => 'Guarda in cima al file, sopra la classe, dove ci sono le righe `import`.',
    cosa: d => `${conNome(d, 'Questa classe')} sta in un pacchetto della libreria di Java: per usarla serve l'\`import\` in cima al file${/^(Scanner|ArrayList|List|HashMap|Map|HashSet|Set|Random|Arrays|Collections|LinkedList)$/.test(d.nome || '') ? `, cioè \`import java.util.${d.nome};\`` : ''}. Controlla anche maiuscole e minuscole.`,
    concetto: 'import in Java',
  },
  {
    id: 'java-nome-file', lingue: ['java'], re: [/class (?<n>[\w$]+) is public, should be declared in a file named (?<f>\S+)/i, /la classe (?<n>[\w$]+) è pubblica/i],
    etichetta: 'nome del file e della classe diversi',
    frase: d => `la classe ${conNome(d, 'pubblica')} deve stare nel file ${cod((d.nome || 'Classe') + '.java')}`,
    dove: () => 'Guarda il nome del file e la riga `public class`.',
    cosa: () => 'In Java una classe `public` deve stare in un file con lo stesso nome, maiuscole comprese: `public class Main` va in `Main.java`. Rinomina il file o la classe.',
    concetto: 'classi e file in Java',
  },
  {
    id: 'java-statico', lingue: ['java'], re: [/non-static (?:variable|method) (?<n>[\w$]+).*cannot be referenced from a static context/i, /non statico .* contesto statico/i],
    etichetta: 'non static usato da static',
    frase: d => `${conNome(d, 'questo nome')} non è \`static\`, ma lo usi da un metodo \`static\``,
    dove: d => `Guarda ${laRiga(d)} e la dichiarazione di ${conNome(d, 'quel nome')}.`,
    cosa: () => '`main` è `static`: appartiene alla classe, non a un oggetto. Da lì puoi usare solo metodi e variabili `static`, oppure creare prima un oggetto con `new` e usare quello. Negli esercizi con una classe sola spesso al metodo manca `static`.',
    concetto: 'static in Java',
  },
  {
    id: 'java-irraggiungibile', lingue: ['java'], re: [/unreachable statement/i, /istruzione non raggiungibile/i],
    etichetta: 'istruzione mai eseguita',
    frase: () => 'questa istruzione non verrà mai eseguita',
    dove: d => `Guarda ${laRiga(d)} e la riga prima.`,
    cosa: () => 'Prima di questa riga c\'è un `return`, un `break`, un `continue` o un ciclo che non finisce: da lì il programma non arriva mai qui. Toglila o spostala prima.',
    concetto: 'flusso del programma',
  },
  {
    id: 'java-indice', lingue: ['java'], re: [/(?:ArrayIndexOutOfBounds|StringIndexOutOfBounds|IndexOutOfBounds)Exception(?::\s*(?:Index (?<i>-?\d+) out of bounds for length (?<l>\d+))?)?/],
    etichetta: 'indice fuori (Java)',
    frase: d => d.parti.i != null ? `usi l'indice ${d.parti.i}, ma la lunghezza è ${d.parti.l}` : 'leggi una posizione che l\'array (o la stringa) non ha',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Gli indici partono da 0: con lunghezza 5 vanno da 0 a 4. Controlla la condizione del ciclo: spesso c\'è `<=` dove serve `<`, oppure si usa `length` come indice.',
    concetto: 'array e indici',
  },
  {
    id: 'java-null', lingue: ['java'], re: [/NullPointerException/],
    etichetta: 'oggetto null (Java)',
    frase: () => 'usi un oggetto che vale `null`',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'L\'oggetto non è mai stato creato con `new`, oppure un metodo ha restituito `null`. Le versioni recenti di Java scrivono nel messaggio quale variabile era `null`.',
    concetto: 'oggetti e null',
  },
  {
    id: 'java-divisione-zero', lingue: ['java'], re: [/ArithmeticException: \/ by zero/],
    etichetta: 'divisione per zero (Java)',
    frase: () => 'dividi un intero per zero',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Dividere un intero per zero (anche con `%`) non ha un risultato e Java si ferma. Prima della divisione controlla il divisore, per esempio con `if (n != 0)`.',
    concetto: 'divisione',
  },
  {
    id: 'java-input', lingue: ['java'], re: [/InputMismatchException/, /NumberFormatException(?:: For input string: "(?<v>[^"]*)")?/],
    etichetta: 'input che non è un numero (Java)',
    frase: d => d.parti.v != null ? `${cod(d.parti.v)} non è un numero` : 'il programma aspettava un numero e ha letto altro',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Il programma voleva un numero e ha trovato altro: lettere, spazi, una riga vuota, oppure una virgola al posto del punto. Controlla cosa scrivi in input, o il file `.in` della prova.',
    concetto: 'input',
  },
  {
    id: 'java-stack', lingue: ['java'], re: [/StackOverflowError/],
    etichetta: 'ricorsione senza fine (Java)',
    frase: () => 'il metodo chiama se stesso troppe volte',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Ogni metodo ricorsivo ha bisogno di un caso base: una condizione in cui restituisce un valore senza richiamarsi. E ogni chiamata deve avvicinarsi al caso base.',
    concetto: 'ricorsione',
  },

  // ===== Python =====
  {
    id: 'py-uguale', lingue: ['python'], meccanica: true, re: [/^SyntaxError: .*Maybe you meant '==' or ':=' instead of '='\?/, /^SyntaxError: .*cannot assign to .*here\. Maybe you meant '=='/],
    etichetta: '`=` al posto di `==`', breve: () => '= al posto di ==',
    frase: () => 'nella condizione c\'è `=` invece di `==`',
    dove: d => `Guarda la condizione ${allaRiga(d)}.`,
    cosa: () => '`=` mette un valore in una variabile; `==` controlla se due valori sono uguali. In una condizione (`if`, `elif`, `while`) serve `==`: `if x == 5:`.',
    concetto: 'assegnamento e confronto', correzione: (d, x) => correggiUguale(d, x),
  },
  {
    id: 'py-due-punti', lingue: ['python'], re: [/^SyntaxError: expected ':'/],
    etichetta: 'mancano i `:`',
    frase: () => 'mancano i `:` alla fine della riga',
    dove: d => `Guarda la fine della riga ${d.riga || 'indicata'}.`,
    cosa: () => 'In Python `if`, `elif`, `else`, `for`, `while`, `def` e `class` finiscono con `:`. I due punti dicono «adesso inizia il blocco», che va scritto sotto, rientrato.',
    concetto: 'blocchi in Python',
  },
  {
    id: 'py-parentesi', lingue: ['python'], re: [/^SyntaxError: '(?<p>[(\[{])' was never closed/, /^SyntaxError: unmatched '(?<c>[)\]}])'/, /^SyntaxError: closing parenthesis '(?<c>.)' does not match opening parenthesis '(?<p>.)'/],
    etichetta: 'parentesi non chiusa',
    frase: d => d.parti.c && !d.parti.p ? `c'è una ${cod(d.parti.c)} che non chiude niente` : `una ${cod(d.parti.p || '(')} non è chiusa`,
    dove: d => `Guarda ${laRiga(d)}: conta le parentesi aperte e chiuse. Se la riga sembra giusta, guarda quella prima.`,
    cosa: () => 'Ogni `(`, `[` e `{` deve avere la sua parentesi di chiusura dello stesso tipo. Se ne manca una, Python continua a leggere le righe dopo come se fossero la stessa istruzione.',
    concetto: 'parentesi',
  },
  {
    id: 'py-stringa', lingue: ['python'], re: [/^SyntaxError: unterminated (?:triple-quoted )?string literal/, /^SyntaxError: EOL while scanning string literal/, /^SyntaxError: EOF while scanning triple-quoted/],
    etichetta: 'stringa non chiusa',
    frase: () => 'una stringa non è chiusa',
    dove: d => `Guarda ${laRiga(d)}: la stringa inizia lì. Cerca dove manca la virgoletta di chiusura.`,
    cosa: () => 'Una stringa inizia e finisce con lo stesso tipo di virgolette, `"` oppure `\'`, sulla stessa riga. Se dentro il testo c\'è un apostrofo, usa le virgolette doppie: `"l\'anno"`.',
    concetto: 'stringhe',
  },
  {
    id: 'py-print', lingue: ['python'], re: [/^SyntaxError: Missing parentheses in call to 'print'/],
    etichetta: '`print` senza parentesi',
    frase: () => '`print` vuole le parentesi',
    dove: d => `Guarda ${laRiga(d)}.`,
    cosa: () => 'In Python 3 `print` è una funzione: si scrive `print("ciao")`. La forma senza parentesi era di Python 2, che si trova ancora in vecchi esempi su internet.',
    concetto: 'funzioni',
  },
  {
    id: 'py-indentazione', lingue: ['python'], re: [/^IndentationError: (?<atteso>expected an indented block)(?: after '(?<kw>[^']+)' statement on line (?<l>\d+))?/, /^IndentationError: (?<troppo>unexpected indent)/, /^IndentationError: (?<torna>unindent does not match)/, /^(?<tab>TabError)/, /^IndentationError/],
    etichetta: 'rientro sbagliato',
    frase: d => d.parti.atteso ? 'manca il rientro dopo i due punti' : d.parti.troppo ? 'c\'è un rientro di troppo' : d.parti.torna ? 'il rientro non torna con le righe sopra' : d.parti.tab ? 'mescoli tab e spazi nel rientro' : 'il rientro della riga è sbagliato',
    dove: d => `Guarda ${laRiga(d)} e quella sopra: confronta gli spazi a inizio riga.${d.parti.kw ? ` L'\`${d.parti.kw}\` è alla riga ${d.parti.l}.` : ''}`,
    cosa: () => 'In Python il rientro (gli spazi a inizio riga) fa parte del codice: dice quali righe stanno dentro un `if`, un `for` o una `def`. Dopo i `:` la riga sotto deve rientrare, e le righe dello stesso blocco devono rientrare uguali. Usa sempre 4 spazi, senza mescolarli con i tab.',
    concetto: 'blocchi in Python',
  },
  {
    id: 'py-sintassi', lingue: ['python'], re: [/^SyntaxError: (?<virgola>invalid syntax\. Perhaps you forgot a comma\?)/, /^SyntaxError/],
    etichetta: 'riga che Python non sa leggere',
    frase: d => d.parti.virgola ? 'forse manca una virgola' : 'Python non riesce a leggere questa riga',
    dove: d => `Guarda ${laRiga(d)}: il segno \`^\` sotto la riga indica dove Python si è accorto del problema. Spesso l'errore vero è appena prima, anche nella riga sopra (una parentesi o una virgoletta non chiusa).`,
    cosa: d => d.parti.virgola ? 'Tra due valori di una lista, di una tupla o degli argomenti di una funzione ci vuole la virgola: `[1, 2, 3]`, `print(a, b)`.'
      : 'Python legge il codice seguendo regole precise, come la grammatica di una lingua. Qui ha trovato qualcosa che in quel punto non può stare. Il messaggio originale, dopo `SyntaxError:`, dice cosa non torna.',
    concetto: 'sintassi',
  },
  {
    id: 'py-nome', lingue: ['python'], re: [/^NameError: name '(?<n>[\w$]+)' is not defined(?:\. Did you mean: '(?<s>[^']+)'\?)?/, /^NameError/],
    etichetta: 'nome che non esiste', breve: d => `${d.nome || 'nome'} non definito`,
    frase: d => `${conNome(d, 'questo nome')} non esiste ancora quando Python arriva alla riga ${d.riga || 'indicata'}`,
    dove: d => (d.parti.s ? `Python propone ${cod(d.parti.s)}: controlla se volevi scrivere quello. ` : '') +
      `Cerca dove dai un valore a ${conNome(d, 'questo nome')}: deve stare sopra questa riga ed essere scritto uguale, maiuscole comprese. Se è una funzione, la \`def\` deve venire prima della chiamata.`,
    cosa: d => {
      let s = 'In Python un nome esiste solo dopo che gli hai dato un valore (`x = ...`), dopo la sua `def` o dopo l\'`import`. Le variabili create dentro una funzione non esistono fuori.';
      if (/^(true|false|none|null)$/i.test(d.nome || '')) s += ' Attenzione: in Python si scrive `True`, `False` e `None`, con la maiuscola.';
      else if (d.nome) s += ` Se ${cod(d.nome)} doveva essere un testo, mancano le virgolette: ${cod('"' + d.nome + '"')}.`;
      return s;
    },
    concetto: 'variabili in Python',
  },
  {
    id: 'py-locale', lingue: ['python'], re: [/^UnboundLocalError: (?:cannot access local variable '(?<n>[\w$]+)'|local variable '(?<n2>[\w$]+)' referenced before assignment)/, /^UnboundLocalError/],
    etichetta: 'variabile locale senza valore',
    frase: d => `usi ${conNome(d, 'una variabile')} dentro la funzione prima di darle un valore`,
    dove: d => `Guarda ${laRiga(d)} e cerca, nella stessa funzione, dove assegni ${conNome(d, 'la variabile')}.`,
    cosa: () => 'Se dentro una funzione assegni un valore a una variabile, per Python quella diventa locale in tutta la funzione, anche nelle righe prima. Così non legge più la variabile con lo stesso nome che sta fuori. Meglio passare il valore come parametro e restituire il risultato con `return`.',
    concetto: 'funzioni e variabili locali',
  },
  {
    id: 'py-tipo-concatena', lingue: ['python'], re: [/^TypeError: can only concatenate (?<a>\w+) \(not "(?<b>\w+)"\) to \w+/, /^TypeError: unsupported operand type\(s\) for (?<op>\S+): '(?<a>\w+)' and '(?<b>\w+)'/, /^TypeError: '(?<op><|>|<=|>=)' not supported between instances of '(?<a>\w+)' and '(?<b>\w+)'/],
    etichetta: 'testo e numero mescolati',
    frase: d => (d.parti.a === 'str' || d.parti.b === 'str') && (/int|float/.test(d.parti.a + d.parti.b)) ? 'mescoli un testo (`str`) e un numero' : `l'operazione non si può fare tra ${cod(d.parti.a || '?')} e ${cod(d.parti.b || '?')}`,
    dove: d => `Guarda ${laRiga(d)}: di che tipo è ciascun valore vicino all'operatore?`,
    cosa: () => 'Per Python `"5"` (testo) e `5` (numero) sono cose diverse. Per unire testo e numero converti il numero: `"Totale: " + str(x)`, oppure usa una f-string: `f"Totale: {x}"`. Se il valore viene da `input()`, ricorda che `input()` restituisce sempre testo: per fare i conti serve `int(input())` o `float(input())`.',
    concetto: 'tipi in Python',
  },
  {
    id: 'py-tipo-indice', lingue: ['python'], re: [/^TypeError: '(?<t>\w+)' object is not subscriptable/, /^TypeError: (?<intero>list|string|tuple) indices must be integers/, /^TypeError: '(?<immut>\w+)' object does not support item assignment/],
    etichetta: '`[ ]` usate male',
    frase: d => d.parti.intero ? 'l\'indice deve essere un numero intero' : d.parti.immut ? `un valore \`${d.parti.immut}\` non si può modificare` : d.parti.t === 'NoneType' ? 'usi `[ ]` su un valore `None`' : `usi \`[ ]\` su un valore di tipo ${cod(d.parti.t || '?')}, che non ha elementi`,
    dove: d => `Guarda le parentesi quadre ${allaRiga(d)}.`,
    cosa: d => d.parti.intero ? 'Con `v[i]` la `i` deve essere un `int`. Se viene da `input()` è testo: convertila con `int()`. Se nasce da una divisione con `/` è un `float`: usa `//`.'
      : d.parti.immut ? 'Le stringhe e le tuple in Python non si cambiano: si crea un valore nuovo, per esempio `s = "C" + s[1:]`. Se ti serve modificare gli elementi, usa una lista.'
        : 'Le quadre `[ ]` servono per liste, stringhe, dizionari e tuple. Un numero non ha elementi. Se il tipo è `NoneType`, la variabile vale `None`: spesso è il risultato di una funzione senza `return`.',
    concetto: 'liste e indici',
  },
  {
    id: 'py-tipo-argomenti', lingue: ['python'], re: [/^TypeError: (?<f>[\w.]+)\(\) missing \d+ required positional argument/, /^TypeError: (?<f>[\w.]+)\(\) takes (?:from \d+ to )?\d+ positional arguments? but \d+ (?:was|were) given/, /^TypeError: (?<f>[\w.]+)\(\) got an unexpected keyword argument/],
    etichetta: 'numero di argomenti sbagliato',
    frase: d => `${cod((d.parti.f || 'la funzione') + '()')} è chiamata con il numero sbagliato di argomenti`,
    dove: d => `Confronta la chiamata ${allaRiga(d)} con la riga \`def\` della funzione.`,
    cosa: () => 'Una funzione va chiamata con tanti argomenti quanti sono i parametri nella sua `def`. Nei metodi di una classe il primo parametro è `self` e Python lo passa da solo: se dice «takes 1 positional argument but 2 were given», forse manca `self` nella `def`.',
    concetto: 'funzioni e parametri',
  },
  {
    id: 'py-non-iterabile', lingue: ['python'], re: [/^TypeError: '(?<t>\w+)' object is not iterable/, /^TypeError: cannot unpack non-iterable (?<t>\w+) object/],
    etichetta: '`for` su un numero',
    frase: d => `provi a scorrere un valore di tipo ${cod(d.parti.t || '?')}, che non ha elementi`,
    dove: d => `Guarda ${laRiga(d)}: cosa c'è dopo \`in\`?`,
    cosa: () => 'Il `for` scorre gli elementi di una lista, di una stringa o di un `range`. Un numero non ha elementi: per ripetere n volte si scrive `for i in range(n):`.',
    concetto: 'cicli for',
  },
  {
    id: 'py-non-chiamabile', lingue: ['python'], re: [/^TypeError: '(?<t>\w+)' object is not callable/],
    etichetta: '`( )` dopo qualcosa che non è una funzione',
    frase: d => `metti \`( )\` dopo un valore di tipo ${cod(d.parti.t || '?')}, che non è una funzione`,
    dove: d => `Guarda ${laRiga(d)}: cosa c'è subito prima delle parentesi tonde?`,
    cosa: () => 'Le parentesi tonde dopo un nome vogliono dire «chiama questa funzione». Spesso una variabile ha lo stesso nome di una funzione (per esempio `sum = 0` e poi `sum(v)`), oppure manca un operatore: `2(x + 1)` invece di `2 * (x + 1)`.',
    concetto: 'funzioni',
  },
  {
    id: 'py-tipo', lingue: ['python'], re: [/^TypeError/],
    etichetta: 'tipo sbagliato',
    frase: () => 'un\'operazione riceve un valore del tipo sbagliato',
    dove: d => `Guarda ${laRiga(d)}: di che tipo sono i valori usati? Puoi stamparli con \`print(type(x))\`.`,
    cosa: () => 'Ogni valore in Python ha un tipo (`int`, `str`, `list`…) e ogni operazione accetta solo certi tipi. Il messaggio originale dice quali tipi ha trovato.',
    concetto: 'tipi in Python',
  },
  {
    id: 'py-indice', lingue: ['python'], re: [/^IndexError: (?<cosa>list|string|tuple|range object) index out of range/, /^IndexError: (?<vuota>pop from empty list)/, /^IndexError/],
    etichetta: 'posizione che non esiste',
    frase: d => d.parti.vuota ? 'togli un elemento da una lista vuota' : `stai leggendo una posizione che ${d.parti.cosa === 'string' ? 'la stringa' : d.parti.cosa === 'tuple' ? 'la tupla' : 'la lista'} non ha`,
    dove: d => `Guarda ${laRiga(d)}: quanto vale l'indice in quel momento, e quanti elementi ci sono?`,
    cosa: () => 'Una lista di n elementi ha le posizioni da `0` a `n-1`: con 3 elementi l\'ultima è `v[2]`. Succede spesso con `range(len(v) + 1)` o con un ciclo che va un passo oltre. Una lista vuota non ha nessuna posizione: anche `v[0]` è un errore.',
    concetto: 'liste e indici',
  },
  {
    id: 'py-chiave', lingue: ['python'], re: [/^KeyError: (?<k>.+)$/, /^KeyError/],
    etichetta: 'chiave che non c\'è',
    frase: d => d.parti.k ? `la chiave ${cod(d.parti.k)} non è nel dizionario` : 'la chiave non è nel dizionario',
    dove: d => `Guarda ${laRiga(d)}: come è scritta la chiave, e come sono scritte quelle nel dizionario?`,
    cosa: () => 'Con `d[k]` la chiave deve esistere già. Controlla come è scritta (maiuscole, spazi, numero o testo). Per controllare prima: `if k in d:`. Per avere un valore di riserva: `d.get(k, 0)`.',
    concetto: 'dizionari',
  },
  {
    id: 'py-valore', lingue: ['python'], re: [/^ValueError: invalid literal for int\(\) with base \d+: (?<v>.+)$/, /^ValueError: could not convert string to float: (?<v>.+)$/, /^ValueError: (?<spacchetta>too many values to unpack|not enough values to unpack)/, /^ValueError: (?<dominio>math domain error)/, /^ValueError/],
    etichetta: 'valore sbagliato',
    frase: d => d.parti.v ? `${cod(d.parti.v.replace(/^'(.*)'$/, '$1'))} non si può trasformare in un numero` : d.parti.spacchetta ? 'le variabili a sinistra di `=` non sono tante quanti i valori' : d.parti.dominio ? 'una funzione matematica riceve un valore che non accetta' : 'il tipo è giusto ma il valore no',
    dove: d => `Guarda ${laRiga(d)}: che valore arriva lì, davvero? Puoi stamparlo con \`print(repr(x))\`.`,
    cosa: d => d.parti.v ? '`int()` trasforma in numero solo un testo fatto di cifre. Spazi in mezzo, lettere, il testo vuoto o un numero con la virgola (`"2,5"`) non vanno. Per i decimali serve `float()` e il punto: `"2.5"`. Se leggi da `input()` o da un file, controlla cosa arriva davvero.'
      : d.parti.spacchetta ? 'Con `a, b = valori` il numero di variabili a sinistra deve essere uguale al numero di valori a destra. Spesso `split()` restituisce più (o meno) pezzi di quelli che ti aspettavi.'
        : d.parti.dominio ? 'Funzioni come `math.sqrt` e `math.log` non accettano tutti i numeri: niente radice di un negativo, niente logaritmo di zero. Controlla il valore prima della chiamata.'
          : 'Il valore ha il tipo giusto ma non va bene per quell\'operazione. Il messaggio originale dice quale valore non andava.',
    concetto: 'conversioni e input',
  },
  {
    id: 'py-divisione-zero', lingue: ['python'], re: [/^ZeroDivisionError/],
    etichetta: 'divisione per zero',
    frase: () => 'dividi per zero',
    dove: d => `Guarda ${laRiga(d)}: quale divisore vale 0 in quel momento? Spesso è \`len()\` di una lista vuota o un contatore rimasto a 0.`,
    cosa: () => 'Dividere per zero non ha un risultato, quindi Python si ferma. Vale anche per `//` e `%`. Prima della divisione controlla il divisore: `if n != 0:`.',
    concetto: 'divisione',
  },
  {
    id: 'py-attributo', lingue: ['python'], re: [/^AttributeError: '(?<t>\w+)' object has no attribute '(?<a>[\w$]+)'/, /^AttributeError: (?:partially initialized )?module '(?<mod>[\w.]+)' has no attribute '(?<a>[\w$]+)'/, /^AttributeError/],
    etichetta: 'metodo o attributo che non c\'è',
    frase: d => d.parti.t === 'NoneType' ? `la variabile vale \`None\`, quindi non ha ${cod(d.parti.a)}` : d.parti.mod ? `il modulo ${cod(d.parti.mod)} non ha ${cod(d.parti.a)}` : d.parti.a ? `un valore di tipo ${cod(d.parti.t)} non ha ${cod(d.parti.a)}` : 'quel valore non ha questo attributo',
    dove: d => `Guarda ${laRiga(d)}: cosa c'è prima del punto, e di che tipo è?`,
    cosa: d => d.parti.t === 'NoneType'
      ? 'Un valore `None` di solito arriva da una funzione senza `return`, oppure da metodi come `v.sort()` che cambiano la lista e restituiscono `None` (quindi `v = v.sort()` perde la lista).'
      : d.parti.mod ? 'Controlla come è scritto il nome. Se il tuo file si chiama come il modulo (per esempio `random.py` o `math.py`), Python importa il tuo file al posto del modulo vero: rinominalo.'
        : 'Ogni tipo ha i suoi metodi: le liste hanno `append`, `pop`, `sort`; le stringhe hanno `upper`, `split`, `strip`. Controlla il nome del metodo e il tipo della variabile.',
    concetto: 'metodi e tipi',
  },
  {
    id: 'py-ricorsione', lingue: ['python'], re: [/^RecursionError/],
    etichetta: 'ricorsione senza fine',
    frase: () => 'la funzione chiama se stessa troppe volte',
    dove: d => `Guarda la funzione${d.funzione && d.funzione !== '<module>' ? ` ${cod(d.funzione)}` : ''} ${allaRiga(d)}: dov'è il caso base, e ogni chiamata ci si avvicina?`,
    cosa: () => 'Ogni funzione ricorsiva ha bisogno di un caso base: una condizione in cui restituisce un valore senza richiamarsi. E ogni chiamata deve avvicinarsi al caso base (per esempio `n - 1`, non `n + 1`). Python si ferma dopo circa 1000 chiamate una dentro l\'altra.',
    concetto: 'ricorsione',
  },
  {
    id: 'py-modulo', lingue: ['python'], re: [/^ModuleNotFoundError: No module named '(?<m>[\w.]+)'/, /^ImportError: cannot import name '(?<nome>[\w$]+)' from '(?<m>[\w.]+)'/, /^(?:ModuleNotFoundError|ImportError)/],
    etichetta: 'modulo che non c\'è',
    frase: d => d.parti.nome ? `nel modulo ${cod(d.parti.m)} non c'è ${cod(d.parti.nome)}` : d.parti.m ? `il modulo ${cod(d.parti.m)} non c'è` : 'un modulo non si importa',
    dove: d => `Guarda la riga \`import\` ${allaRiga(d)}.`,
    cosa: () => 'O il nome è scritto male, o il modulo non è installato per questo Python. I moduli esterni (per esempio `numpy`) si installano con `python3 -m pip install nome` (su Windows `py -m pip install nome`). Se il modulo è un tuo file, deve stare nella stessa cartella e chiamarsi `nome.py`.',
    concetto: 'moduli e import',
  },
  {
    id: 'py-file', lingue: ['python'], re: [/^FileNotFoundError: \[Errno 2\] No such file or directory: '(?<f>[^']+)'/, /^FileNotFoundError/],
    etichetta: 'file non trovato',
    frase: d => `non trovo il file ${cod(d.parti.f || '?')}`,
    dove: d => `Guarda la \`open\` ${allaRiga(d)}.`,
    cosa: () => 'Python cerca il file a partire dalla cartella da cui lanci il programma, non da quella dello script. Controlla il nome, l\'estensione (Windows a volte la nasconde) e la cartella.',
    concetto: 'file',
  },
  {
    id: 'py-input-finito', lingue: ['python'], re: [/^EOFError/],
    etichetta: 'input finito',
    frase: () => 'il programma chiede un input che non arriva',
    dove: d => `Guarda la \`input()\` ${allaRiga(d)}.`,
    cosa: () => '`input()` aspettava una riga, ma l\'input era già finito. Nelle prove con i file `.in` controlla che il file abbia tante righe quante sono le `input()`.',
    concetto: 'input',
  },

  // ===== programmi che si fermano mentre girano (C e simili) =====
  {
    id: 'esec-memoria', lingue: ['c'], etichetta: 'memoria che non è sua (segmentation fault)', breve: () => 'memoria non sua',
    frase: () => 'il programma ha usato memoria che non è sua',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: d => (d.dettagli.nullo ? 'Qui il puntatore valeva `NULL`. ' : '') +
      'Spesso è un puntatore `NULL` (`p->next` con `p` che vale `NULL`), un indice fuori dall\'array o una ricorsione senza fine. Il sistema ferma il programma per proteggere il resto della memoria.' +
      (d.codiceUscita ? ` Su Windows questo errore ha il codice ${d.codiceUscita}.` : ''),
    concetto: 'puntatori e memoria',
  },
  {
    id: 'esec-divisione-zero', lingue: ['c'], etichetta: 'divisione intera per zero',
    frase: () => 'il programma ha diviso un intero per zero',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Un intero diviso per zero (anche con `%`) non ha un risultato e il sistema ferma il programma. Il nome «floating point exception» inganna: succede proprio con gli interi. Controlla i divisori, per esempio un contatore che vale ancora 0.',
    concetto: 'divisione',
  },
  {
    id: 'esec-stack', lingue: ['c'], etichetta: 'pila delle chiamate piena (stack overflow)',
    frase: () => 'la pila delle chiamate è piena: forse una ricorsione senza fine',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Ogni chiamata a funzione occupa un po\' di memoria nella pila (lo stack). Una funzione ricorsiva senza caso base, o con un caso base che non arriva mai, la riempie. Anche un array locale enorme può bastare: in quel caso usa `malloc`.',
    concetto: 'ricorsione',
  },
  {
    id: 'esec-fuori-array', lingue: ['c'], etichetta: 'scrittura fuori da un array',
    frase: d => `il programma ha ${d.dettagli.accesso === 'lettura' ? 'letto' : d.dettagli.accesso === 'scrittura' ? 'scritto' : 'letto o scritto'} fuori da un array`,
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Un array di N elementi va da `0` a `N-1`. Controlla le condizioni dei cicli (`<` e non `<=`), le stringhe senza posto per il `\'\\0\'` finale e le `malloc` con la dimensione giusta (`n * sizeof(int)`).',
    concetto: 'array e indici',
  },
  {
    id: 'esec-heap', lingue: ['c'], etichetta: 'malloc e free usate male',
    frase: () => 'la memoria presa con `malloc` è stata usata male',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Succede quando liberi due volte la stessa memoria (`free` due volte), quando usi un puntatore dopo `free`, o quando scrivi oltre la fine di un blocco preso con `malloc`. Dopo `free(p);` aiuta scrivere `p = NULL;`.',
    concetto: 'memoria dinamica',
  },
  {
    id: 'esec-memoria-persa', lingue: ['c'], etichetta: 'memoria mai liberata',
    frase: () => 'il programma prende memoria con `malloc` e non la libera',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Ogni `malloc` (o `calloc`) deve avere la sua `free` quando la memoria non serve più. Nelle liste va liberato ogni nodo, uno alla volta, prima di perdere il puntatore.',
    concetto: 'memoria dinamica',
  },
  {
    id: 'esec-non-inizializzata', lingue: ['c'], etichetta: 'valore mai inizializzato',
    frase: () => 'il programma usa un valore che non è mai stato inizializzato',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Una variabile locale (o la memoria presa con `malloc`) contiene valori a caso finché non le dai un valore. Inizializzala prima di leggerla.',
    concetto: 'inizializzazione delle variabili',
  },
  {
    id: 'esec-asserzione', lingue: ['c'], etichetta: 'assert fallita',
    frase: d => d.parti.cond ? `una \`assert\` è fallita: ${cod(d.parti.cond)} era falsa` : 'una `assert` è fallita',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => '`assert(condizione)` ferma il programma se la condizione è falsa. Chi l\'ha scritta (tu o il docente) dice: «qui deve essere sempre vero». Il problema vero è prima: cerca dove il valore è diventato sbagliato.',
    concetto: 'assert e controlli',
  },
  {
    id: 'esec-abort', lingue: ['c'], etichetta: 'programma interrotto (abort)',
    frase: () => 'il programma si è interrotto da solo (abort)',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Di solito lo chiede la libreria quando trova un problema grave: una `assert` fallita, una `free` sbagliata, memoria rovinata. Guarda le righe stampate subito prima: spesso dicono il motivo.',
    concetto: 'memoria dinamica',
  },
  {
    id: 'esec-overflow', lingue: ['c'], re: [/signed integer overflow/i, /integer overflow/i],
    etichetta: 'intero troppo grande',
    frase: () => 'un intero è diventato troppo grande',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Un `int` arriva a 2147483647. Oltre, il risultato è sbagliato. Succede con fattoriali e potenze: usa `long long` (con `%lld` in `printf`), oppure controlla i conti.',
    concetto: 'tipi interi',
  },
  {
    id: 'esec-tempo', lingue: ['c', 'python', 'java'], etichetta: 'tempo scaduto',
    frase: () => 'il programma non ha finito in tempo',
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Forse c\'è un ciclo che non finisce: la condizione non diventa mai falsa, oppure la variabile del ciclo non cambia. Oppure il programma aspetta un input (`scanf`, `input()`) che non arriva.',
    concetto: 'cicli',
  },
  {
    id: 'esec-segnale', lingue: ['c'], etichetta: 'programma fermato dal sistema',
    frase: d => `il programma è stato fermato dal sistema${d.segnale ? ` (${d.segnale})` : ''}`,
    dove: (d, x) => doveEsecuzione(d, x),
    cosa: () => 'Il sistema ha fermato il programma mentre girava. Lode non sa dire di più da questo segnale: guarda le ultime righe stampate e le righe cambiate da poco.',
    concetto: 'esecuzione',
  },
];
// le voci UBSan («main.c:5:12: runtime error: …») usano gli stessi testi degli errori di esecuzione
const UBSAN = [[/division by zero/i, 'esec-divisione-zero'], [/index -?\d+ out of bounds/i, 'esec-fuori-array'], [/null pointer|misaligned address/i, 'esec-memoria'], [/overflow/i, 'esec-overflow']];
const PER_ID = Object.fromEntries(VOCI.map(v => [v.id, v]));
export const voce = chiave => PER_ID[chiave] || null;
// Per il registro (F4): «manca `;`», «funzione non dichiarata»…
export const nomeErrore = chiave => PER_ID[chiave]?.etichetta || 'errore sconosciuto';
export const CHIAVI = Object.freeze(VOCI.map(v => v.id));

// ---------- dove si è fermato un programma ----------
function doveEsecuzione(d, x) {
  const f = nomeFile(d.file), fn = d.funzione && !/^<.*>$/.test(d.funzione) ? `, nella funzione ${cod(d.funzione)}` : '';
  let s = d.riga ? `Il programma si è fermato alla riga ${d.riga}${f ? ` di ${cod(f)}` : ''}${fn}.` : '';
  if (x.cambiate) s += (s ? ' Poi guarda' : 'Guarda prima') + ` le righe cambiate dopo l'ultima prova riuscita: ${x.cambiate}.`;
  if (!s) s = d.linguaggio === 'c' && d.chiave !== 'esec-tempo'
    ? 'Il sistema non dice la riga. Aggiungi qualche `printf` per capire fin dove arriva il programma; su Mac e Linux puoi anche compilare con `-g -fsanitize=address` per avere file e riga.'
    : 'Il messaggio non dice la riga: guarda le ultime righe stampate dal programma.';
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
  return pz.length > 4 ? pz.slice(0, 4).join(', ') + ` e altre ${pz.length - 4}` : pz.join(', ');
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
  const p = puntoMancante(d, x), t = p ? x.riga(p.riga) : null;
  if (!p || t == null || /;\s*$/.test(t.slice(0, p.indice)) || /^\s*#/.test(t))
    return { testo: d.riga ? `Aggiungi \`;\` alla fine dell'istruzione: sulla riga ${d.riga} o su quella prima.` : 'Aggiungi `;` alla fine dell\'istruzione.' };
  const nuova = t.slice(0, p.indice) + ';' + t.slice(p.indice);
  return {
    testo: p.indice >= fineCodice(t) ? `Alla fine della riga ${p.riga} aggiungi \`;\`:` : `Nella riga ${p.riga}, nel punto indicato, aggiungi \`;\`:`,
    righe: [{ n: p.riga, testo: t, segno: '-' }, { n: p.riga, testo: nuova, segno: '+' }],
  };
}
function correggiInclude(d, x) {
  const h = d.parti.h; if (!h) return null;
  const nuova = `#include <${h}>`;
  if (x.riga(1) == null || !x.daFile(1)) return { testo: 'In cima al file, insieme agli altri `#include`, aggiungi:', righe: [{ n: null, testo: nuova, segno: '+' }] };
  let ultima = 0;
  for (let n = 1; n <= 300; n++) {
    const s = x.riga(n); if (s == null) break;
    if (new RegExp(`^\\s*#\\s*include\\s*[<"]${h.replace(/\./g, '\\.')}[>"]`).test(s)) return null;   // c'è già: il problema è un altro
    if (/^\s*#\s*include\b/.test(s)) ultima = n;
  }
  return ultima
    ? { testo: `Dopo la riga ${ultima} aggiungi:`, righe: [{ n: ultima, testo: x.riga(ultima), segno: ' ' }, { n: ultima + 1, testo: nuova, segno: '+' }] }
    : { testo: 'In cima al file aggiungi:', righe: [{ n: 1, testo: nuova, segno: '+' }, { n: 2, testo: x.riga(1), segno: ' ' }] };
}
function correggiUguale(d, x) {
  const generica = { testo: 'Nella condizione sostituisci `=` con `==`.' };
  const t = d.riga ? x.riga(d.riga) : null; if (t == null) return generica;
  const py = d.linguaggio === 'python', soli = ugualiSoli(t, py);
  let i = d.colonna && x.daFile(d.riga) && soli.includes(d.colonna - 1) ? d.colonna - 1 : null;
  if (i == null) {
    const k = t.search(py ? /\b(if|elif|while)\b/ : /\b(if|while)\s*\(/);
    const dopo = k >= 0 ? soli.filter(p => p > k) : [];
    i = dopo.length === 1 ? dopo[0] : soli.length === 1 ? soli[0] : null;
  }
  if (i == null) return generica;
  return { testo: `Alla riga ${d.riga} sostituisci \`=\` con \`==\`:`, righe: [{ n: d.riga, testo: t, segno: '-' }, { n: d.riga, testo: t.slice(0, i) + '==' + t.slice(i + 1), segno: '+' }] };
}
function correggiReturn(d, x) {
  const f = funzioneDi(d, x), t = d.riga ? x.riga(d.riga) : null;
  const testo = `Prima della \`}\` che chiude ${f ? cod(f.nome) : 'la funzione'} aggiungi un \`return\` con il valore giusto per i casi rimasti fuori. Quale valore lo decidi tu: dipende da cosa deve calcolare la funzione.`;
  if (t == null || !/^\s*\}/.test(t)) return { testo, righe: [{ n: null, testo: '    return ‹valore›;', segno: '+' }, { n: null, testo: '}', segno: ' ' }] };
  const rientro = t.match(/^\s*/)[0] + (/^\t/.test(x.riga(d.riga - 1) || '') ? '\t' : '    ');
  const sopra = x.riga(d.riga - 1);
  return { testo, righe: [...(sopra != null ? [{ n: d.riga - 1, testo: sopra, segno: ' ' }] : []), { n: d.riga, testo: `${rientro}return ‹valore›;`, segno: '+' }, { n: d.riga + 1, testo: t, segno: ' ' }] };
}

// ---------- spiega ----------
function doveGenerico(d, x) {
  if (d.tipo === 'linker') return 'Il linker non indica una riga: cerca nel progetto il nome citato nel messaggio, e controlla che tutti i file `.c` siano nel comando di compilazione.';
  if (d.tipo === 'esecuzione') return doveEsecuzione(d, x);
  const f = nomeFile(d.file);
  if (!d.riga) return 'Il messaggio non indica una riga: leggi il testo originale qui sotto.';
  if (d.linguaggio === 'python') return `${x.L} si è fermato ${allaRiga(d)}${f ? ` di ${cod(f)}` : ''}. Se lì sembra tutto giusto, guarda la riga prima.`;
  return `Guarda ${laRiga(d)}${colonna(d)}${f ? ` di ${cod(f)}` : ''}. Se lì sembra tutto giusto, guarda anche la riga prima: spesso il compilatore si accorge di un problema solo dopo.`;
}
function cosaGenerico(d, x) {
  let s = '';
  if (d.eccezione) s = `${cod(d.eccezione)} è il tipo di errore che ${x.L} ha incontrato mentre ${d.tipo === 'errore' ? 'leggeva' : 'eseguiva'} il programma. `;
  return s + 'Lode non ha ancora una spiegazione per questo messaggio. Il testo originale è qui sotto: leggi le parole tra apici, di solito sono il nome o il tipo che dà problemi.';
}
// il percorso delle chiamate (Python e Java): «riga 4 (<module>) → riga 2 (media)»
function catena(d) {
  const p = (d.pila || []).filter(f => f.riga && !LIBRERIA_PY.test(f.file || '') && !f.modulo && !/^(java|javax|jdk|sun)\./.test(f.metodo || ''));
  if (p.length < 2) return '';
  const base = nomeFile(d.file), ultime = d.linguaggio === 'java' ? [...p].reverse().slice(-4) : p.slice(-4);
  return ` Ci sei arrivato così: ${ultime.map(f => `riga ${f.riga}${nomeFile(f.file) !== base ? ` di ${cod(nomeFile(f.file))}` : ''} (${cod(String(f.funzione || f.metodo || '').split('.').pop())})`).join(' → ')}.`;
}
const maiuscola = s => s ? s[0].toUpperCase() + s.slice(1) : s;

// Il testo breve, senza file e riga: «nodo non dichiarato» (per il diario di F4, che il luogo lo scrive da sé)
export function breve(d) {
  const v = PER_ID[d?.chiave];
  return v ? (v.breve ? v.breve(d) : v.etichetta.replace(/`/g, '')) : String(d?.messaggio || 'errore').slice(0, 60);
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
  const luogo = file ? (d.riga ? `${file}, riga ${d.riga}` : file) : d.riga ? `riga ${d.riga}` : null;
  let frase = v ? v.frase(d, x) : 'questo errore non lo conosco ancora';
  if (d.eccezione) frase = `${d.eccezione}: ${frase}`;
  const intestazione = luogo ? `**${luogo}**${d.eccezione ? ' · ' : ': '}${frase}` : maiuscola(frase);
  let cosa = v ? v.cosa(d, x) : cosaGenerico(d, x);
  if (v && d.tipo === 'avviso' && !/avviso/.test(cosa)) cosa = 'È un avviso: il programma compila lo stesso, ma così com\'è probabilmente non fa quello che vuoi. ' + cosa;
  const passi = [
    { id: 'dove', titolo: 'Dove guardare', testo: (v ? v.dove(d, x) : doveGenerico(d, x)) + catena(d) },
    { id: 'cosa', titolo: 'Cosa vuol dire', testo: cosa },
  ];
  // nei progetti «valutato» la correzione non c'è; correzioneNascosta dice che ci sarebbe stata (per una nota nella scheda)
  let correzioneNascosta = false;
  if (v?.meccanica && v.correzione) { if (valutato) correzioneNascosta = true; else { const c = v.correzione(d, x); if (c) passi.push({ id: 'correzione', titolo: 'Fammi vedere la correzione', ...c }); } }
  let estratto = null;
  if (d.riga) {
    const righe = [];
    for (let n = Math.max(1, d.riga - 2); n <= d.riga + 2; n++) { const t = x.riga(n); if (t != null) righe.push({ n, testo: t, qui: n === d.riga }); }
    if (righe.length) estratto = { da: righe[0].n, a: righe.at(-1).n, colonna: d.colonna, daFile: x.daFile(d.riga), righe };
  }
  return {
    chiave: d.chiave, conosciuto: !!v, tipo: d.tipo, linguaggio: d.linguaggio, etichetta: v?.etichetta || null, concetto: v?.concetto || null,
    luogo, frase, intestazione, breve: perDiario(d), estratto, passi, originale: d.messaggio,
    avviso: cambiato ? 'Il file è cambiato da allora: i numeri di riga potrebbero non tornare.' : null,
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
const ETICHETTA_TIPO = { errore: 'Errore', avviso: 'Avviso', linker: 'Errore del linker', esecuzione: 'Si è fermato' };
// L'interno della scheda «Errore»: da mettere in scheda('ld-err', schedaHtml(sp, { conto, vista })).
// I passi sono <details data-passo="dove|cosa|correzione">: si aprono uno alla volta, senza JS.
export function schedaHtml(sp, { conto = '', vista = false } = {}) {
  if (!sp) return '';
  const capo = `<div class="capo"><span class="ld-lbl">${ETICHETTA_TIPO[sp.tipo] || 'Errore'}${sp.linguaggio ? ' · ' + (NOME_LINGUA[sp.linguaggio] || '') : ''}</span>${conto ? `<span class="ld-err-conto">${esc(conto)}</span>` : ''}</div>`;
  const estratto = sp.estratto ? codiceHtml(sp.estratto.righe.map(r => ({ n: r.n, testo: r.testo, cls: r.qui ? 'qui' : '' }))) : '';
  const passi = sp.passi.map((p, i) => `<details class="ld-err-passo" data-passo="${p.id}"><summary><small>${i + 1}</small>${esc(p.titolo)}${p.id === 'correzione' && vista ? '<span class="ld-err-vista">correzione vista</span>' : ''}</summary><p>${html(p.testo)}</p>${p.righe ? codiceHtml(p.righe.map(r => ({ n: r.n, testo: r.testo, cls: r.segno === '+' ? 'piu' : r.segno === '-' ? 'meno' : '' }))) : ''}</details>`).join('');
  const orig = `<details class="ld-err-passo ld-err-orig" data-passo="originale"${sp.conosciuto ? '' : ' open'}><summary><small>·</small>Messaggio originale</summary><pre>${esc(sp.originale)}</pre></details>`;
  return capo + `<p class="ld-err-titolo">${html(sp.intestazione)}</p>` + (sp.avviso ? `<p class="ld-nota">${html(sp.avviso)}</p>` : '') + estratto + passi + orig;
}
