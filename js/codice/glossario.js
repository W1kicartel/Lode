// «Cose nuove»: le funzioni della libreria standard che le righe aggiunte di un turno portano in un file dove prima non c'erano
// (dell'agente o tue), con la domanda che ti farebbero all'orale. Niente AI: un dizionario fisso scritto a mano, C99/C11,
// Java 17 e Python 3. La risposta la scrive il dizionario; Lode non sa chi ha scritto le righe e non lo dice.
// Funzioni pure (si provano in test/codice.mjs senza Electron); segna() è l'unica che scrive, in D.codice.glossario.
import { corsoProgrammazione } from './stampa.js';
import { t } from '../lingua.js';
// dati.js si carica solo quando serve: in Node, senza finestra, non parte (vuole addEventListener e localStorage)
export const dati = () => import('../dati.js');

// k: chiave unica (anche fra le lingue: visti è per chiave), l: lingua, cerca: dove compare nel codice già pulito
// (commenti tolti, stringhe ridotte a ""), f: il nome che, se lo studente definisce una sua funzione o classe così, fa saltare
// la voce (un suo `int realloc(` non è la realloc della libreria), d: la domanda da orale, r: la risposta in 1-3 frasi
export const VOCI = [
  /* ---------- C ---------- */
  { k: 'malloc', l: 'c', f: 'malloc', cerca: /\bmalloc\s*\(/, d: t('glossario.malloc.domanda'), r: t('glossario.malloc.risposta') },
  { k: 'calloc', l: 'c', f: 'calloc', cerca: /\bcalloc\s*\(/, d: t('glossario.calloc.domanda'), r: t('glossario.calloc.risposta') },
  { k: 'realloc', l: 'c', f: 'realloc', cerca: /\brealloc\s*\(/, d: t('glossario.realloc.domanda'), r: t('glossario.realloc.risposta') },
  { k: 'free', l: 'c', f: 'free', cerca: /\bfree\s*\(/, d: t('glossario.free.domanda'), r: t('glossario.free.risposta') },
  { k: 'strtok', l: 'c', f: 'strtok', cerca: /\bstrtok\s*\(/, d: t('glossario.strtok.domanda'), r: t('glossario.strtok.risposta') },
  { k: 'strcpy', l: 'c', f: 'strcpy', cerca: /\bstrcpy\s*\(/, d: t('glossario.strcpy.domanda'), r: t('glossario.strcpy.risposta') },
  { k: 'strncpy', l: 'c', f: 'strncpy', cerca: /\bstrncpy\s*\(/, d: t('glossario.strncpy.domanda'), r: t('glossario.strncpy.risposta') },
  { k: 'strcmp', l: 'c', f: 'strcmp', cerca: /\bstrcmp\s*\(/, d: t('glossario.strcmp.domanda'), r: t('glossario.strcmp.risposta') },
  { k: 'strlen', l: 'c', f: 'strlen', cerca: /\bstrlen\s*\(/, d: t('glossario.strlen.domanda'), r: t('glossario.strlen.risposta') },
  { k: 'strcat', l: 'c', f: 'strcat', cerca: /\bstrcat\s*\(/, d: t('glossario.strcat.domanda'), r: t('glossario.strcat.risposta') },
  { k: 'memcpy', l: 'c', f: 'memcpy', cerca: /\bmemcpy\s*\(/, d: t('glossario.memcpy.domanda'), r: t('glossario.memcpy.risposta') },
  { k: 'memset', l: 'c', f: 'memset', cerca: /\bmemset\s*\(/, d: t('glossario.memset.domanda'), r: t('glossario.memset.risposta') },
  { k: 'sizeof', l: 'c', cerca: /\bsizeof\b/, d: t('glossario.sizeof.domanda'), r: t('glossario.sizeof.risposta') },
  { k: 'fgets', l: 'c', f: 'fgets', cerca: /\bfgets\s*\(/, d: t('glossario.fgets.domanda'), r: t('glossario.fgets.risposta') },
  { k: 'scanf', l: 'c', f: 'scanf', cerca: /\bscanf\s*\(/, d: t('glossario.scanf.domanda'), r: t('glossario.scanf.risposta') },
  { k: 'sscanf', l: 'c', f: 'sscanf', cerca: /\bsscanf\s*\(/, d: t('glossario.sscanf.domanda'), r: t('glossario.sscanf.risposta') },
  { k: 'fopen', l: 'c', f: 'fopen', cerca: /\bfopen\s*\(/, d: t('glossario.fopen.domanda'), r: t('glossario.fopen.risposta') },
  { k: 'fclose', l: 'c', f: 'fclose', cerca: /\bfclose\s*\(/, d: t('glossario.fclose.domanda'), r: t('glossario.fclose.risposta') },
  { k: 'fprintf', l: 'c', f: 'fprintf', cerca: /\bfprintf\s*\(/, d: t('glossario.fprintf.domanda'), r: t('glossario.fprintf.risposta') },
  { k: 'atoi', l: 'c', f: 'atoi', cerca: /\batoi\s*\(/, d: t('glossario.atoi.domanda'), r: t('glossario.atoi.risposta') },
  { k: 'strtol', l: 'c', f: 'strtol', cerca: /\bstrtol\s*\(/, d: t('glossario.strtol.domanda'), r: t('glossario.strtol.risposta') },
  { k: 'qsort', l: 'c', f: 'qsort', cerca: /\bqsort\s*\(/, d: t('glossario.qsort.domanda'), r: t('glossario.qsort.risposta') },
  { k: 'exit', l: 'c', f: 'exit', cerca: /\bexit\s*\(/, d: t('glossario.exit.domanda'), r: t('glossario.exit.risposta') },
  { k: 'assert', l: 'c', f: 'assert', cerca: /\bassert\s*\(/, d: t('glossario.assert.domanda'), r: t('glossario.assert.risposta') },
  { k: 'static locale', l: 'c', cerca: /^\s+static\s+[^(]*[;=]/, d: t('glossario.static-locale.domanda'), r: t('glossario.static-locale.risposta') },

  /* ---------- Java ---------- */
  { k: 'computeIfAbsent', l: 'java', f: 'computeIfAbsent', cerca: /\.computeIfAbsent\s*\(/, d: t('glossario.computeifabsent.domanda'), r: t('glossario.computeifabsent.risposta') },
  { k: 'getOrDefault', l: 'java', f: 'getOrDefault', cerca: /\.getOrDefault\s*\(/, d: t('glossario.getordefault.domanda'), r: t('glossario.getordefault.risposta') },
  { k: 'putIfAbsent', l: 'java', f: 'putIfAbsent', cerca: /\.putIfAbsent\s*\(/, d: t('glossario.putifabsent.domanda'), r: t('glossario.putifabsent.risposta') },
  { k: 'List.remove', l: 'java', cerca: /\.remove\s*\(\s*[^)\s]/, d: t('glossario.list-remove.domanda'), r: t('glossario.list-remove.risposta') },
  { k: 'equals', l: 'java', cerca: /\.equals\s*\(/, d: t('glossario.equals.domanda'), r: t('glossario.equals.risposta') },
  { k: 'hashCode', l: 'java', cerca: /\bhashCode\s*\(/, d: t('glossario.hashcode.domanda'), r: t('glossario.hashcode.risposta') },
  { k: 'Collections.sort', l: 'java', cerca: /\bCollections\s*\.\s*sort\s*\(/, d: t('glossario.collections-sort.domanda'), r: t('glossario.collections-sort.risposta') },
  { k: 'Comparator.comparing', l: 'java', cerca: /\bComparator\s*\.\s*comparing(?:Int|Long|Double)?\s*\(/, d: t('glossario.comparator-comparing.domanda'), r: t('glossario.comparator-comparing.risposta') },
  { k: 'Optional', l: 'java', f: 'Optional', cerca: /\bOptional\s*[<.]/, d: t('glossario.optional.domanda'), r: t('glossario.optional.risposta') },
  { k: 'stream', l: 'java', cerca: /\.stream\s*\(\s*\)/, d: t('glossario.stream.domanda'), r: t('glossario.stream.risposta') },
  { k: 'StringBuilder', l: 'java', f: 'StringBuilder', cerca: /\bStringBuilder\b/, d: t('glossario.stringbuilder.domanda'), r: t('glossario.stringbuilder.risposta') },
  { k: 'Integer.parseInt', l: 'java', cerca: /\bInteger\s*\.\s*parseInt\s*\(/, d: t('glossario.integer-parseint.domanda'), r: t('glossario.integer-parseint.risposta') },
  { k: 'Scanner.nextInt', l: 'java', cerca: /\.nextInt\s*\(\s*\)/, d: t('glossario.scanner-nextint.domanda'), r: t('glossario.scanner-nextint.risposta') },
  { k: 'try-with-resources', l: 'java', cerca: /\btry\s*\(/, d: t('glossario.try-with-resources.domanda'), r: t('glossario.try-with-resources.risposta') },
  { k: 'instanceof', l: 'java', cerca: /\binstanceof\b/, d: t('glossario.instanceof.domanda'), r: t('glossario.instanceof.risposta') },
  { k: 'Arrays.asList', l: 'java', cerca: /\bArrays\s*\.\s*asList\s*\(/, d: t('glossario.arrays-aslist.domanda'), r: t('glossario.arrays-aslist.risposta') },
  { k: 'Iterator.remove', l: 'java', cerca: /\.remove\s*\(\s*\)/, d: t('glossario.iterator-remove.domanda'), r: t('glossario.iterator-remove.risposta') },
  { k: 'substring', l: 'java', cerca: /\.substring\s*\(/, d: t('glossario.substring.domanda'), r: t('glossario.substring.risposta') },
  { k: 'compareTo', l: 'java', cerca: /\.compareTo\s*\(/, d: t('glossario.compareto.domanda'), r: t('glossario.compareto.risposta') },

  /* ---------- Python ---------- */
  { k: 'list comprehension', l: 'python', cerca: /\[(?!.*\bfor\b.*\bfor\b).*?\bfor\b.+?\bin\b.*\]/, d: t('glossario.list-comprehension.domanda'), r: t('glossario.list-comprehension.risposta') },
  { k: 'list comprehension annidata', l: 'python', cerca: /\[.*?\bfor\b.+?\bfor\b.+?\bin\b.*\]/, d: t('glossario.list-comprehension-annidata.domanda'), r: t('glossario.list-comprehension-annidata.risposta') },
  { k: 'lambda', l: 'python', cerca: /\blambda\b/, d: t('glossario.lambda.domanda'), r: t('glossario.lambda.risposta') },
  { k: 'sorted con key', l: 'python', cerca: /(?:\bsorted\s*\(|\.sort\s*\().*\bkey\s*=/, d: t('glossario.sorted-con-key.domanda'), r: t('glossario.sorted-con-key.risposta') },
  { k: 'enumerate', l: 'python', f: 'enumerate', cerca: /\benumerate\s*\(/, d: t('glossario.enumerate.domanda'), r: t('glossario.enumerate.risposta') },
  { k: 'zip', l: 'python', f: 'zip', cerca: /\bzip\s*\(/, d: t('glossario.zip.domanda'), r: t('glossario.zip.risposta') },
  { k: 'dict.get', l: 'python', f: 'get', cerca: /\.get\s*\(/, d: t('glossario.dict-get.domanda'), r: t('glossario.dict-get.risposta') },
  { k: 'setdefault', l: 'python', f: 'setdefault', cerca: /\.setdefault\s*\(/, d: t('glossario.setdefault.domanda'), r: t('glossario.setdefault.risposta') },
  { k: 'defaultdict', l: 'python', f: 'defaultdict', cerca: /\bdefaultdict\s*\(/, d: t('glossario.defaultdict.domanda'), r: t('glossario.defaultdict.risposta') },
  { k: 'Counter', l: 'python', f: 'Counter', cerca: /\bCounter\s*\(/, d: t('glossario.counter.domanda'), r: t('glossario.counter.risposta') },
  { k: 'with open', l: 'python', cerca: /\bwith\s+open\s*\(/, d: t('glossario.with-open.domanda'), r: t('glossario.with-open.risposta') },
  { k: 'yield', l: 'python', cerca: /\byield\b/, d: t('glossario.yield.domanda'), r: t('glossario.yield.risposta') },
  { k: '*args e **kwargs', l: 'python', cerca: /\bdef\s+\w+\s*\(.*(?:^|[(,\s])\*{1,2}[A-Za-z_]/, d: t('glossario.args-e-kwargs.domanda'), r: t('glossario.args-e-kwargs.risposta') },
  { k: '[::-1]', l: 'python', cerca: /\[\s*::\s*-\s*1\s*\]/, d: t('glossario.rovescia.domanda'), r: t('glossario.rovescia.risposta') },
  { k: 'is e ==', l: 'python', cerca: /\bis\s+(?!None\b)(?!not\s+None\b)/, d: t('glossario.is-e-uguale.domanda'), r: t('glossario.is-e-uguale.risposta') },
  { k: 'default mutabile', l: 'python', cerca: /\bdef\s+\w+\s*\(.*=\s*(?:\[\s*\]|\{\s*\}|list\(\s*\)|dict\(\s*\)|set\(\s*\))/, d: t('glossario.default-mutabile.domanda'), r: t('glossario.default-mutabile.risposta') },
  { k: 'f-string', l: 'python', cerca: /(?:^|[^\w])(?:[rR]?[fF]|[fF][rR])""/, d: t('glossario.f-string.domanda'), r: t('glossario.f-string.risposta') },
  { k: 'extend', l: 'python', f: 'extend', cerca: /\.extend\s*\(/, d: t('glossario.extend.domanda'), r: t('glossario.extend.risposta') },
  { k: 'split', l: 'python', f: 'split', cerca: /\.split\s*\(/, d: t('glossario.split.domanda'), r: t('glossario.split.risposta') },
];

// la lingua dal nome del file: .c/.h → 'c', .java → 'java', .py → 'python', il resto → null
export const linguaDi = rel => { const m = /\.([A-Za-z]+)$/.exec(String(rel || '')); const e = m?.[1].toLowerCase(); return e === 'c' || e === 'h' ? 'c' : e === 'java' ? 'java' : e === 'py' ? 'python' : null; };

/* ---------- il codice senza commenti e senza testo tra virgolette ---------- */
// Una riga alla volta, con lo stato di chi legge (un /* … */ o un """ … """ che va a capo): le stringhe diventano "" (così
// f"…" resta riconoscibile), i commenti spariscono. Le righe di solo commento (//, #, /*, * ) danno ''.
function pulisci(s, l, st) {
  const py = l === 'python';
  if (!st.dentro && !py && /^\s*\*(?:\s|\/|$)/.test(s)) { const j = s.indexOf('*/'); if (j < 0) return ''; s = s.slice(j + 2); }
  let out = '', i = 0;
  while (i < s.length) {
    if (st.dentro) { const j = s.indexOf(st.dentro, i); if (j < 0) return out; i = j + st.dentro.length; if (py) out += '""'; st.dentro = null; continue; }
    const c = s[i];
    if (py ? c === '#' : s.startsWith('//', i)) break;
    if (!py && s.startsWith('/*', i)) { st.dentro = '*/'; i += 2; continue; }
    if (py && (s.startsWith('"""', i) || s.startsWith("'''", i))) { st.dentro = s.slice(i, i + 3); i += 3; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < s.length && s[j] !== c) j += s[j] === '\\' ? 2 : 1; out += '""'; i = j + 1; continue; }
    out += c; i++;
  }
  return out;
}
// le parole che in C e Java possono stare prima di una chiamata senza che sia una definizione
const NON_TIPI = 'return|else|case|new|throw|goto|sizeof|do|assert|yield|await|typeof|delete|not|and|or|in|is';
const RE_DEF_C = new RegExp(`^\\s*(?:(?!(?:${NON_TIPI})\\b)[A-Za-z_$][\\w$<>\\[\\],.?]*[\\s*&]+)+([A-Za-z_$][\\w$]*)\\s*\\(`);
const RE_DEF_PY = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;
const RE_CLASSE = /\b(?:class|interface|record|enum)\s+([A-Za-z_$][\w$]*)/;
// i nomi che lo studente definisce in queste righe: funzioni, metodi, classi
function definiti(righe, l) {
  const n = new Set();
  for (const c of righe) {
    const m = (l === 'python' ? RE_DEF_PY : RE_DEF_C).exec(c); if (m) n.add(m[1]);
    const k = RE_CLASSE.exec(c); if (k) n.add(k[1]);
  }
  return n;
}
// un file del diff → { nuove: [{ r, c }] (le righe '+' con il codice pulito), prima: [codice delle righe ' ' e '-'] }.
// Due letture separate: il file di prima (' ' e '-') e quello di dopo (' ' e '+'), ognuna con il suo stato dei commenti
function leggi(blocchi, l) {
  const nuove = [], prima = [], tutte = [];
  for (const b of blocchi || []) {
    const sPrima = {}, sDopo = {};
    for (const r of b?.righe || []) {
      const s = String(r?.s ?? '');
      if (r.t === '+') { const c = pulisci(s, l, sDopo); tutte.push(c); if (c.trim()) nuove.push({ r, c }); }
      else if (r.t === '-') { const c = pulisci(s, l, sPrima); tutte.push(c); prima.push(c); }
      else { const a = pulisci(s, l, sPrima), c = pulisci(s, l, sDopo); tutte.push(c); prima.push(a); }
    }
  }
  return { nuove, prima, tutte };
}

// il file intero di adesso (progetto:righe, tutte le righe), pulito come il diff: un solo stato dei commenti dall'inizio
const pulito = (righe, l) => { const st = {}; return righe.map(s => pulisci(String(s ?? ''), l, st)); };
const quante = (codice, v) => codice.reduce((n, c) => n + (v.cerca.test(c) ? 1 : 0), 0);

/* ---------- le voci nuove di un diff ---------- */
// file: [{ rel, blocchi, grande?, tagliato?, attuale? }] come progetto:diff con rel. Una voce è nuova per un file se compare in
// una riga '+', in nessuna riga ' ' o '-' dello stesso file, non è in visti, nessuna carta ha la sua domanda come fronte, e nel
// diff nessuno definisce una funzione o una classe con il suo nome. attuale (facoltativo): tutte le righe del file di adesso.
// Il diff vede solo 3 righe di contesto per blocco: con attuale, se la voce compare in più righe del file che nelle righe '+',
// c'era già altrove (un malloc nuovo a riga 200 con un malloc vecchio a riga 10) e si salta. Se il file è cambiato ancora dopo
// il tratto, l'errore va dalla parte del silenzio. Una volta per voce (la prima), al massimo 5, nell'ordine del diff.
export const MAX = 5;
export function coseNuove(file, { visti = {}, carte = [] } = {}) {
  const fronti = new Set((carte || []).map(c => String(c?.fronte ?? '').trim()));
  const letti = (file || []).map(f => { const l = linguaDi(f?.rel); return l && !f.grande && !f.tagliato && Array.isArray(f.blocchi) ? { rel: f.rel, l, ...leggi(f.blocchi, l), ora: Array.isArray(f.attuale) ? pulito(f.attuale, l) : null } : null; }).filter(Boolean);
  const def = {};
  for (const x of letti) for (const n of definiti(x.tutte, x.l)) (def[x.l] ||= new Set()).add(n);
  const out = [], prese = new Set();
  for (const x of letti) {
    const voci = VOCI.filter(v => v.l === x.l && !prese.has(v.k) && !visti?.[v.k] && !fronti.has(v.d) && !(v.f && def[x.l]?.has(v.f)) && !x.prima.some(c => v.cerca.test(c)) && !(x.ora && quante(x.ora, v) > quante(x.nuove.map(n => n.c), v)));
    for (const { r, c } of x.nuove) for (const v of voci) {
      if (out.length >= MAX) return out;
      if (prese.has(v.k) || !v.cerca.test(c)) continue;
      prese.add(v.k); out.push({ voce: v, rel: x.rel, riga: r.nb, testo: String(r.s).trim().slice(0, 120) });
    }
  }
  return out;
}

// la carta per il ripasso: la domanda davanti, dietro la risposta e da dove viene
export const cartaDa = x => ({ fronte: x.voce.d, retro: `${x.voce.r}\n\n${t('glossario.da-riga', { file: x.rel, riga: x.riga })}` });
// l'esame a cui va la carta: il corso del progetto, se è un esame da fare; se no il corso di programmazione; se no nessuno
export function esameDi(esami = [], corso = null) {
  const da = (esami || []).filter(e => e && !e.fatto), nome = (corso && da.some(e => e.nome === corso) && corso) || corsoProgrammazione(da.map(e => e.nome));
  return (nome && da.find(e => e.nome === nome)?.id) || null;
}

// «La so già» ('so') o «Mettila nel ripasso» ('carta'): la voce non torna più. Il campo nasce qui, non in VUOTO.
// x: { D, salva, oggi } per le prove; nella barra quelli di dati.js
export async function segna(k, come, x) {
  const { D, salva, oggi } = x || await dati();
  const c = D.codice ||= {}, g = c.glossario ||= { visti: {} };
  (g.visti ||= {})[k] = { g: oggi(), come };
  salva();
}
