// Il mini-albero di «Cosa stampa?». Nato per il C, si scrive anche in Java e in Python:
// - stampaC(nodo): scrive il sorgente C vero (si compila con cc, gcc o clang);
// - stampaJava(nodo) e stampaPython(nodo): lo stesso programma in Java (class Main) e in Python 3, solo se si scrive fedele
//   (altrimenti ErroreC 'lingua': il modello non vale per quella lingua); stampaIn(nodo, lingua) sceglie;
// - esegui(nodo, { maxPassi, lingua }): lo esegue qui, con le regole della lingua, e restituisce { uscita, passi }.
//   Java fa i conti come il C (int a 32 bit, / troncata, % col segno del dividendo); Python divide con // verso il basso
//   e il resto ha il segno del divisore. Un conto che esce dai 32 bit si scarta in tutte e tre, così l'uscita non dipende mai dal trabocco.
// Regole: int a 32 bit, divisione troncata verso zero, % col segno del dividendo, char come codice ASCII,
// printf solo con %d %i %c %s %.Nf %%, il passaggio per indirizzo come cella (&x e *p, niente aritmetica dei puntatori).
// Quello che in C sarebbe comportamento indefinito non si può scrivere: ogni variabile nasce con un valore,
// e un int che esce da 32 bit, una divisione per zero o un indice fuori dall'array fanno lanciare ErroreC (il modello si scarta).
// Puro: niente DOM, si usa anche in Node.

export class ErroreC extends Error {
  constructor(tipo, messaggio) { super(messaggio || tipo); this.name = 'ErroreC'; this.tipo = tipo; }
}
const MIN = -2147483648, MAX = 2147483647;

/* ---------- costruire l'albero ---------- */
// espressioni
export const num = v => ({ t: 'num', v });
export const car = c => ({ t: 'car', v: c });            // un carattere: car('a')
export const reale = v => ({ t: 'reale', v });          // un double scritto nel codice: reale(2) → 2.0
export const testo = s => ({ t: 'testo', v: s });        // una stringa letterale, col vero «\n» dentro
export const v = nome => ({ t: 'var', nome });
export const indice = (a, i) => ({ t: 'indice', a, i }); // a[i]
export const valore = p => ({ t: 'valore', p });         // *p
export const indirizzo = x => ({ t: 'indirizzo', x });   // &x
export const bin = (op, a, b) => ({ t: 'bin', op, a, b });
export const un = (op, a) => ({ t: 'un', op, a });       // '-' oppure '!'
export const cast = (tipo, a) => ({ t: 'cast', tipo, a });
export const ternario = (c, a, b) => ({ t: 'ternario', c, a, b });
export const assegna = (x, op, e) => ({ t: 'assegna', op, x, e });       // op: = += -= *= /= %=
export const incr = (x, op = '++', pre = false) => ({ t: 'incr', op, pre, x });
export const chiama = (nome, ...arg) => ({ t: 'chiama', nome, arg });
export const printf = (formato, ...arg) => chiama('printf', testo(formato), ...arg);
// istruzioni
export const dich = (tipo, ...voci) => ({ t: 'dich', tipo, voci: voci.map(([nome, init]) => ({ nome, init })) });   // dich('int', ['a', num(1)], ['b', num(2)])
export const array = (tipo, nome, valori) => ({ t: 'array', tipo, nome, valori: valori.map(x => typeof x === 'number' ? num(x) : x) });
export const espr = e => ({ t: 'espr', e });
export const blocco = (...corpo) => ({ t: 'blocco', corpo });
export const se = (c, allora, altrimenti = null) => ({ t: 'se', c, allora, altrimenti });
export const mentre = (c, corpo) => ({ t: 'mentre', c, corpo });
export const fai = (corpo, c) => ({ t: 'fai', corpo, c });
export const per = (init, c, passo, corpo) => ({ t: 'per', init, c, passo, corpo });
export const scegli = (e, ...casi) => ({ t: 'scegli', e, casi });
export const caso = (val, ...corpo) => ({ val: typeof val === 'number' ? num(val) : val, corpo });    // val null = default
export const interrompi = () => ({ t: 'interrompi' });
export const continua = () => ({ t: 'continua' });
export const ritorna = (e = null) => ({ t: 'ritorna', e });
// funzioni e programma
export const param = (tipo, nome, forma = '') => ({ tipo, nome, forma });   // forma: '' (valore), '*' (indirizzo), '[]' (array)
export const funzione = (tipo, nome, params, ...corpo) => ({ t: 'funzione', tipo, nome, params, corpo: blocco(...corpo) });
export const main = (...corpo) => funzione('int', 'main', [], ...corpo);
export const programma = (...funzioni) => ({ t: 'programma', funzioni });

// una copia profonda: i mutanti cambiano la copia, mai l'originale
export const clona = n => JSON.parse(JSON.stringify(n));
// visita ogni nodo (oggetti e liste), anche dentro le funzioni
export function visita(n, f) {
  if (Array.isArray(n)) { for (const x of n) visita(x, f); return; }
  if (!n || typeof n !== 'object') return;
  f(n);
  for (const k of Object.keys(n)) if (n[k] && typeof n[k] === 'object') visita(n[k], f);
}

/* ---------- scrivere il C ---------- */
const PREC = { '||': 4, '&&': 5, '==': 9, '!=': 9, '<': 10, '<=': 10, '>': 10, '>=': 10, '+': 12, '-': 12, '*': 13, '/': 13, '%': 13 };
const RIENTRO = '    ';
const scappa = (s, q) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(q === '"' ? /"/g : /'/g, '\\' + q);
const scriviReale = x => { const s = String(x); return /[.e]/.test(s) ? s : s + '.0'; };
const tondo = (s, si) => si ? `(${s})` : s;

// un'espressione: { s: testo, p: precedenza }
function E(e) {
  switch (e.t) {
    case 'num': return { s: String(e.v), p: e.v < 0 ? 15 : 17 };
    case 'reale': return { s: scriviReale(e.v), p: e.v < 0 ? 15 : 17 };
    case 'car': return { s: `'${scappa(e.v, "'")}'`, p: 17 };
    case 'testo': return { s: `"${scappa(e.v, '"')}"`, p: 17 };
    case 'var': return { s: e.nome, p: 17 };
    case 'indice': { const a = E(e.a); return { s: `${tondo(a.s, a.p < 16)}[${E(e.i).s}]`, p: 16 }; }
    case 'valore': { const a = E(e.p); return { s: '*' + tondo(a.s, a.p < 15), p: 15 }; }
    case 'indirizzo': { const a = E(e.x); return { s: '&' + tondo(a.s, a.p < 15), p: 15 }; }
    case 'un': { const a = E(e.a); return { s: e.op + tondo(a.s, a.p < 15 || a.s.startsWith(e.op)), p: 15 }; }
    case 'cast': { const a = E(e.a); return { s: `(${e.tipo})` + tondo(a.s, a.p < 15), p: 15 }; }
    case 'bin': {
      const p = PREC[e.op], a = E(e.a), b = E(e.b);
      // && dentro || sempre tra parentesi (gcc e clang lo chiedono); un numero negativo a destra pure: «a - (-7)»
      const pa = a.p < p || (e.op === '||' && e.a.t === 'bin' && e.a.op === '&&');
      const pb = b.p <= p || (e.op === '||' && e.b.t === 'bin' && e.b.op === '&&') || /^-/.test(b.s);
      return { s: `${tondo(a.s, pa)} ${e.op} ${tondo(b.s, pb)}`, p };
    }
    case 'ternario': { const c = E(e.c), a = E(e.a), b = E(e.b); return { s: `${tondo(c.s, c.p <= 3)} ? ${tondo(a.s, a.p < 3)} : ${tondo(b.s, b.p < 3)}`, p: 3 }; }
    case 'assegna': { const x = E(e.x), y = E(e.op === '=' ? perChar(e.x, e.e) : e.e); return { s: `${x.s} ${e.op} ${tondo(y.s, y.p < 2)}`, p: 2 }; }
    case 'incr': { const x = E(e.x); return e.pre ? { s: e.op + tondo(x.s, x.p < 15), p: 15 } : { s: tondo(x.s, x.p < 16) + e.op, p: 16 }; }
    case 'chiama': {
      if (LING === 'java' && e.nome === 'printf') return { s: stampaJ(e), p: 16 };
      return { s: `${e.nome}(${e.arg.map(a => { const x = E(a); return tondo(x.s, x.p < 3); }).join(', ')})`, p: 16 };
    }
  }
  throw new ErroreC('nodo', `espressione sconosciuta: ${e?.t}`);
}
export const stampaEspr = e => E(e).s;

const dichTesto = n => n.t === 'array'
  ? (LING === 'java' ? `${n.tipo}[] ${n.nome} = {` : `${n.tipo} ${n.nome}[] = {`) + `${n.valori.map(x => E(x).s).join(', ')}}`
  : `${n.tipo} ${n.voci.map(x => `${x.nome} = ${E(n.tipo === 'char' ? perChar(v(x.nome), x.init) : x.init).s}`).join(', ')}`;
// finisce con un if senza else? (l'else che segue andrebbe a lui)
const pendente = n => n.t === 'se' ? !n.altrimenti || pendente(n.altrimenti) : n.t === 'mentre' || n.t === 'per' ? pendente(n.corpo) : false;
const semplice = n => n.t === 'espr' || n.t === 'interrompi' || n.t === 'continua' || n.t === 'ritorna';

// un corpo dopo «if (…)», «for (…)», «while (…)»: tra graffe se è un blocco, altrimenti sulla riga sotto, rientrato
function corpo(testa, n, liv, out) {
  const r = RIENTRO.repeat(liv);
  if (n.t === 'blocco') { out.push(`${r}${testa} {`); for (const x of n.corpo) istr(x, liv + 1, out); out.push(`${r}}`); }
  else { out.push(r + testa); istr(n, liv + 1, out); }
}
function istr(n, liv, out) {
  const r = RIENTRO.repeat(liv);
  switch (n.t) {
    case 'dich': case 'array': out.push(`${r}${dichTesto(n)};`); return;
    case 'espr': out.push(`${r}${E(n.e).s};`); return;
    case 'interrompi': out.push(`${r}break;`); return;
    case 'continua': out.push(`${r}continue;`); return;
    case 'ritorna': out.push(`${r}return${n.e ? ' ' + E(n.e).s : ''};`); return;
    case 'blocco': out.push(`${r}{`); for (const x of n.corpo) istr(x, liv + 1, out); out.push(`${r}}`); return;
    case 'mentre': corpo(`while (${E(n.c).s})`, n.corpo, liv, out); return;
    case 'per': {
      const init = !n.init ? '' : n.init.t === 'espr' ? E(n.init.e).s : dichTesto(n.init);
      corpo(`for (${init}; ${n.c ? E(n.c).s : ''}; ${n.passo ? E(n.passo).s : ''})`, n.corpo, liv, out); return;
    }
    case 'fai': {
      const b = n.corpo.t === 'blocco' ? n.corpo.corpo : [n.corpo];
      out.push(`${r}do {`); for (const x of b) istr(x, liv + 1, out); out.push(`${r}} while (${E(n.c).s});`); return;
    }
    case 'scegli': {
      out.push(`${r}switch (${E(n.e).s}) {`);
      for (const c of n.casi) {
        const et = c.val ? `case ${E(c.val).s}:` : 'default:';
        if (c.corpo.every(semplice)) { const tmp = []; for (const x of c.corpo) istr(x, 0, tmp); out.push(`${r}${RIENTRO}${[et, ...tmp].join(' ')}`); }
        else { out.push(`${r}${RIENTRO}${et}`); for (const x of c.corpo) istr(x, liv + 2, out); }
      }
      out.push(`${r}}`); return;
    }
    case 'se': {
      // un if senza else dentro un if con l'else: le graffe servono, altrimenti il C darebbe l'else all'if interno
      const allora = n.altrimenti && !n.elseFuori && pendente(n.allora) ? blocco(n.allora) : n.allora;
      if (allora !== n.allora) return istr({ ...n, allora }, liv, out);
      corpo(`if (${E(n.c).s})`, n.allora, liv, out);
      const a = n.altrimenti; if (!a) return;
      // elseFuori: l'else scritto all'altezza dell'if di fuori, come lo legge l'occhio (l'else pendente)
      const re = n.elseFuori ? RIENTRO.repeat(Math.max(0, liv - 1)) : r, lb = n.elseFuori ? Math.max(0, liv - 1) : liv;
      if (n.allora.t === 'blocco' && !n.elseFuori) out.pop();
      const pre = n.allora.t === 'blocco' && !n.elseFuori ? `${r}} else` : `${re}else`;
      if (a.t === 'blocco') { out.push(`${pre} {`); for (const x of a.corpo) istr(x, lb + 1, out); out.push(`${re}}`); }
      else if (a.t === 'se') { const tmp = []; istr(a, lb, tmp); out.push(`${pre} ${tmp[0].trimStart()}`, ...tmp.slice(1)); }
      else { out.push(pre); istr(a, lb + 1, out); }
      return;
    }
  }
  throw new ErroreC('nodo', `istruzione sconosciuta: ${n?.t}`);
}
const firma = f => `${f.tipo} ${f.nome}(${f.params.length ? f.params.map(p => p.forma === '*' ? `${p.tipo} *${p.nome}` : p.forma === '[]' ? `${p.tipo} ${p.nome}[]` : `${p.tipo} ${p.nome}`).join(', ') : 'void'})`;

// il sorgente C. Con { include: false } senza «#include <stdio.h>»: è quello che vede lo studente
export function stampaC(n, { include = true } = {}) {
  LING = 'c';
  const out = [];
  if (n.t === 'programma') {
    if (include) out.push('#include <stdio.h>', '');
    n.funzioni.forEach((f, i) => { if (i) out.push(''); out.push(firma(f) + ' {'); for (const x of f.corpo.corpo) istr(x, 1, out); out.push('}'); });
  } else if (n.t === 'funzione') { out.push(firma(n) + ' {'); for (const x of n.corpo.corpo) istr(x, 1, out); out.push('}'); }
  else if (n.t in { dich: 1, array: 1, espr: 1, blocco: 1, se: 1, mentre: 1, per: 1, fai: 1, scegli: 1, interrompi: 1, continua: 1, ritorna: 1 }) istr(n, 0, out);
  else return E(n).s;
  return out.join('\n') + (n.t === 'programma' && include ? '\n' : '');
}

/* ---------- Java e Python ---------- */
// la lingua che si sta scrivendo (le stampe sono sincrone, una alla volta) e i tipi della funzione che si sta scrivendo
let LING = 'c', TIPI = new Map(), FUNZ = new Map();
export const LINGUE = ['c', 'java', 'python'];
export const NOMI_LINGUE = { c: 'C', java: 'Java', python: 'Python' };
const no = cosa => { throw new ErroreC('lingua', `${NOMI_LINGUE[LING] || LING}: ${cosa}`); };
const CONFRONTI = new Set(['==', '!=', '<', '<=', '>', '>=']);
const comeProgramma = n => n.t === 'programma' ? n : n.t === 'funzione' ? programma(n) : programma(main(...(n.t === 'blocco' ? n.corpo : [n])));
// in Java un char si inizializza da un'espressione int solo col cast: char d = (char)(c - 32)
const perChar = (x, e) => LING === 'java' && e.t !== 'car' && tipoS(x) === 'char' ? cast('char', e) : e;

// i tipi dichiarati in una funzione: nome → { tipo, arr }. Lo stesso nome con due tipi non si scrive in Java né in Python
function tipiDi(f) {
  const m = new Map();
  const segna = (nome, tipo, arr = false) => { const t = m.get(nome); if (t && (t.tipo !== tipo || t.arr !== arr)) no(`${nome} con due tipi`); m.set(nome, { tipo, arr }); };
  for (const p of f.params) segna(p.nome, p.tipo, p.forma === '[]');
  visita(f.corpo, n => { if (n.t === 'dich') for (const x of n.voci) segna(x.nome, n.tipo); else if (n.t === 'array') segna(n.nome, n.tipo, true); });
  return m;
}
// il tipo di un'espressione letto dal codice: 'int' 'double' 'char' 'bool' 'str' 'arr'
function tipoS(e) {
  switch (e.t) {
    case 'num': return 'int';
    case 'car': return 'char';
    case 'reale': return 'double';
    case 'testo': return 'str';
    case 'var': { const t = TIPI.get(e.nome); if (!t) no(`variabile sconosciuta: ${e.nome}`); return t.arr ? 'arr' : t.tipo; }
    case 'indice': { const t = e.a.t === 'var' && TIPI.get(e.a.nome); if (!t?.arr) no('indice su un non-array'); return t.tipo; }
    case 'bin': {
      if (e.op === '&&' || e.op === '||' || CONFRONTI.has(e.op)) return 'bool';
      const a = tipoS(e.a), b = tipoS(e.b);
      return a === 'double' || b === 'double' || (e.op === '/' && e.modo === 'reale') ? 'double' : 'int';
    }
    case 'un': return e.op === '!' ? 'bool' : tipoS(e.a) === 'double' ? 'double' : 'int';
    case 'cast': return e.tipo;
    case 'ternario': { const a = tipoS(e.a), b = tipoS(e.b); return a === 'double' || b === 'double' ? 'double' : a === b ? a : 'int'; }
    case 'assegna': case 'incr': return tipoS(e.x);
    case 'chiama': return e.nome === 'printf' ? 'int' : FUNZ.get(e.nome)?.tipo || no(`funzione sconosciuta: ${e.nome}`);
    case 'valore': case 'indirizzo': return no('i puntatori ci sono solo in C');
  }
  return no(`espressione sconosciuta: ${e?.t}`);
}
// un int (o un char) che riceve un double: il C tronca, Java non compila, Python tiene il double. Fuori
const daDouble = (tipo, da) => { if ((tipo === 'int' || tipo === 'char') && da === 'double') no('un double finisce in un int'); };
// la variabile cambia dentro questo pezzo di codice?
const cambiata = (n, nome) => { let si = false; visita(n, x => { if ((x.t === 'assegna' || x.t === 'incr') && x.x.t === 'var' && x.x.nome === nome) si = true; }); return si; };
// un continue di questo ciclo (non di un ciclo dentro)
function continuaQui(n) {
  if (!n || typeof n !== 'object') return false;
  if (Array.isArray(n)) return n.some(continuaQui);
  if (n.t === 'continua') return true;
  if (n.t === 'mentre' || n.t === 'per' || n.t === 'fai') return false;
  if (n.t === 'se') return continuaQui(n.allora) || continuaQui(n.altrimenti);
  if (n.t === 'blocco') return continuaQui(n.corpo);
  if (n.t === 'scegli') return n.casi.some(c => continuaQui(c.corpo));
  return false;
}

// si può scrivere fedele in Java o in Python? Se no, ErroreC 'lingua'. Prepara anche FUNZ
function controlla(prog) {
  FUNZ = new Map(prog.funzioni.map(f => [f.nome, f]));
  if (!FUNZ.has('main')) no('manca main');
  const py = LING === 'python';
  for (const f of prog.funzioni) {
    TIPI = tipiDi(f);
    if (f.params.some(p => p.forma === '*')) no('il passaggio per indirizzo c\'è solo in C');
    if (py && f.tipo === 'char') no('char');
    const scope = [new Set()];
    // una variabile ridichiarata in un blocco dentro: in C nasconde quella di fuori, Java non compila, in Python è la stessa
    const nuovo = nome => {
      if (scope.some(s => s.has(nome))) no(`${nome} ridichiarata in un blocco dentro`);
      if (py && FUNZ.has(nome)) no(`${nome} è anche il nome di una funzione`);
      scope.at(-1).add(nome);
    };
    f.params.forEach(p => nuovo(p.nome));
    const dentro = fn => { scope.push(new Set()); fn(); scope.pop(); };
    // b: qui serve una condizione. Java vuole un boolean; in Python and e or restituiscono un operando, non 0 o 1
    const ex = (e, b, cima = false) => {
      if (e.t === 'bin' && (e.op === '&&' || e.op === '||')) { if (!b) no(`${e.op} usato come numero`); ex(e.a, true); ex(e.b, true); return; }
      if (e.t === 'bin' && CONFRONTI.has(e.op)) { if (!b) no('un confronto usato come numero'); ex(e.a, false); ex(e.b, false); return; }
      if (e.t === 'un' && e.op === '!') { if (!b) no('! usato come numero'); ex(e.a, true); return; }
      if (e.t === 'ternario') { ex(e.c, true); ex(e.a, b); ex(e.b, b); return; }
      if (b) no('un numero usato come condizione');
      switch (e.t) {
        case 'num': case 'reale': case 'testo': case 'var': return;
        case 'car': if (py) no('in Python non c\'è il tipo char'); return;
        case 'bin': case 'un': if (e.op === '%' && e.t === 'bin' && (tipoS(e.a) === 'double' || tipoS(e.b) === 'double')) no('% con un double'); ex(e.a, false); if (e.b) ex(e.b, false); return;
        case 'cast': if (py && e.tipo === 'char') no('in Python non c\'è il tipo char'); ex(e.a, false); return;
        case 'indice': ex(e.a, false); ex(e.i, false); return;
        case 'assegna':
          if (py && !cima) no('un assegnamento dentro un\'espressione');
          ex(e.x, false); ex(e.e, false); daDouble(tipoS(e.x), e.op === '=' ? tipoS(e.e) : tipoS(bin(e.op[0], e.x, e.e))); return;
        case 'incr': if (py && !cima) no('++ e -- dentro un\'espressione'); ex(e.x, false); return;
        case 'chiama': {
          if (e.nome === 'printf') { if (py && !cima) no('printf dentro un\'espressione'); e.arg.slice(1).forEach(a => ex(a, false)); return; }
          const g = FUNZ.get(e.nome); if (!g || g.params.length !== e.arg.length) no(`chiamata sbagliata: ${e.nome}`);
          e.arg.forEach((a, k) => { ex(a, false); if (g.params[k].forma !== '[]') daDouble(g.params[k].tipo, tipoS(a)); });
          return;
        }
      }
      no(`espressione: ${e.t}`);
    };
    // in Java il codice dopo break, continue o return non compila
    const lista = xs => { if (xs.slice(0, -1).some(x => x.t === 'interrompi' || x.t === 'continua' || x.t === 'ritorna')) no('codice dopo break, continue o return'); xs.forEach(istr); };
    const istr = n => {
      switch (n.t) {
        case 'dich': for (const x of n.voci) { if (py && n.tipo === 'char') no('in Python non c\'è il tipo char'); ex(x.init, false); daDouble(n.tipo, tipoS(x.init)); nuovo(x.nome); } return;
        case 'array': if (py && n.tipo === 'char') no('in Python non c\'è il tipo char'); n.valori.forEach(x => { ex(x, false); daDouble(n.tipo, tipoS(x)); }); nuovo(n.nome); return;
        case 'espr': ex(n.e, false, true); if (!['assegna', 'incr', 'chiama'].includes(n.e.t)) no('un\'espressione da sola non è un\'istruzione'); return;
        case 'blocco': dentro(() => lista(n.corpo)); return;
        case 'se': ex(n.c, true); dentro(() => istr(n.allora)); if (n.altrimenti) dentro(() => istr(n.altrimenti)); return;
        case 'mentre': ex(n.c, true); dentro(() => istr(n.corpo)); return;
        case 'fai': if (py) no('in Python non c\'è il do-while'); dentro(() => istr(n.corpo)); ex(n.c, true); return;
        case 'per': dentro(() => {
          if (n.init) { if (n.init.t === 'espr') { ex(n.init.e, false, true); } else istr(n.init); }
          if (n.c) ex(n.c, true);
          if (n.passo) ex(n.passo, false, true);
          dentro(() => istr(n.corpo));
          // in Python un for che non diventa range diventa un while col passo in fondo: un continue lo salterebbe
          if (py && !rangeDi(n) && continuaQui(n.corpo)) no('for con continue che non diventa range');
        }); return;
        case 'scegli': if (py) no('in Python non c\'è lo switch del C (cade nel case sotto)'); ex(n.e, false); dentro(() => n.casi.forEach(c => { if (c.val) ex(c.val, false); lista(c.corpo); })); return;
        case 'interrompi': case 'continua': return;
        case 'ritorna':
          if (f.nome === 'main' && (n.e || py)) no('return in main');
          if (n.e) { ex(n.e, false); daDouble(f.tipo, tipoS(n.e)); }
          return;
      }
      no(`istruzione: ${n.t}`);
    };
    lista(f.corpo.corpo);
    if (f.tipo !== 'void' && f.nome !== 'main' && f.corpo.corpo.at(-1)?.t !== 'ritorna') no(`${f.nome} non finisce con return`);
  }
}

/* Java */
const firmaJ = f => `${f.tipo} ${f.nome}(${f.params.map(p => p.forma === '[]' ? `${p.tipo}[] ${p.nome}` : `${p.tipo} ${p.nome}`).join(', ')})`;
// printf: con solo testo diventa print o println; %i diventa %d; un char con %d passa come (int)
function stampaJ(e) {
  const f = e.arg[0]; if (f?.t !== 'testo') no('printf senza formato');
  const args = e.arg.slice(1);
  if (!args.length) {
    const t = f.v.replace(/%%/g, '%');
    if (t.endsWith('\n') && !t.slice(0, -1).includes('\n')) return `System.out.println(${t.length > 1 ? `"${scappa(t.slice(0, -1), '"')}"` : ''})`;
    return `System.out.print("${scappa(t, '"')}")`;
  }
  const spec = [...f.v.matchAll(/%(?:\.\d+)?([dicsf%])/g)].map(m => m[1]).filter(c => c !== '%');
  const xs = args.map((a, k) => { const x = E(/[di]/.test(spec[k] || '') && tipoS(a) === 'char' ? cast('int', a) : a); return tondo(x.s, x.p < 3); });
  return `System.out.printf("${scappa(f.v.replace(/%i/g, '%d'), '"')}", ${xs.join(', ')})`;
}
// con un %f il programma fissa la lingua: su un computer italiano Java scriverebbe 3,50
const conVirgola = prog => { let si = false; visita(prog, x => { if (x.t === 'chiama' && x.nome === 'printf' && x.arg.length > 1 && /%(?:\.\d+)?f/.test(x.arg[0].v)) si = true; }); return si; };

// il sorgente Java: public class Main, le funzioni diventano metodi static, main è public static void main(String[] args)
export function stampaJava(n) {
  const prima = LING; LING = 'java';
  try {
    const prog = comeProgramma(n);
    controlla(prog);
    const locale = conVirgola(prog), out = [], r2 = RIENTRO.repeat(2);
    if (locale) out.push('import java.util.Locale;', '');
    out.push('public class Main {');
    for (const f of prog.funzioni) if (f.nome !== 'main') { TIPI = tipiDi(f); out.push(`${RIENTRO}static ${firmaJ(f)} {`); for (const x of f.corpo.corpo) istr(x, 2, out); out.push(`${RIENTRO}}`, ''); }
    const m = FUNZ.get('main'); TIPI = tipiDi(m);
    out.push(`${RIENTRO}public static void main(String[] args) {`);
    if (locale) out.push(`${r2}Locale.setDefault(Locale.ROOT);   // il punto nei decimali, anche su un computer italiano`);
    for (const x of m.corpo.corpo) istr(x, 2, out);
    out.push(`${RIENTRO}}`, '}');
    return out.join('\n') + '\n';
  } finally { LING = prima; }
}

/* Python */
const PYP = { '||': 2, '&&': 3, '==': 5, '!=': 5, '<': 5, '<=': 5, '>': 5, '>=': 5, '+': 7, '-': 7, '*': 8, '/': 8, '%': 8 };
function PY(e) {
  switch (e.t) {
    case 'num': return { s: String(e.v), p: e.v < 0 ? 9 : 11 };
    case 'reale': return { s: scriviReale(e.v), p: e.v < 0 ? 9 : 11 };
    case 'testo': return { s: `"${scappa(e.v, '"')}"`, p: 11 };
    case 'var': return { s: e.nome, p: 11 };
    case 'indice': { const a = PY(e.a); return { s: `${tondo(a.s, a.p < 11)}[${PY(e.i).s}]`, p: 11 }; }
    case 'un': {
      const a = PY(e.a);
      if (e.op === '!') return { s: 'not ' + tondo(a.s, a.p < 4), p: 4 };
      return { s: '-' + tondo(a.s, a.p < 9 || a.s.startsWith('-')), p: 9 };
    }
    case 'cast': return { s: `${e.tipo === 'double' ? 'float' : 'int'}(${PY(e.a).s})`, p: 11 };
    case 'bin': {
      // tra due int / del C è //; con un double è / (e 2.0 si scrive 2: in Python / tiene comunque la virgola)
      const reale = e.op === '/' && tipoS(e) === 'double';
      const op = e.op === '&&' ? 'and' : e.op === '||' ? 'or' : e.op === '/' && !reale ? '//' : e.op;
      // e (double)s / n si scrive s / n: il cast davanti a / in Python non cambia niente
      const b0 = reale && e.b.t === 'reale' && Number.isInteger(e.b.v) && tipoS(e.a) !== 'double' ? num(e.b.v) : e.b;
      const a0 = reale && e.a.t === 'cast' && e.a.tipo === 'double' && tipoS(e.a.a) === 'int' && tipoS(b0) !== 'double' ? e.a.a : e.a;
      const p = PYP[e.op], a = PY(a0), b = PY(b0);
      // i confronti non si incatenano: a < b < c in Python non è (a < b) < c
      const pa = a.p < p || (p === 5 && a.p === 5) || (e.op === '||' && a0.t === 'bin' && a0.op === '&&');
      const pb = b.p <= p || (e.op === '||' && b0.t === 'bin' && b0.op === '&&') || /^-/.test(b.s);
      return { s: `${tondo(a.s, pa)} ${op} ${tondo(b.s, pb)}`, p };
    }
    case 'ternario': { const c = PY(e.c), a = PY(e.a), b = PY(e.b); return { s: `${tondo(a.s, a.p <= 1)} if ${tondo(c.s, c.p <= 1)} else ${tondo(b.s, b.p < 1)}`, p: 1 }; }
    case 'chiama': if (e.nome !== 'printf') return { s: `${e.nome}(${e.arg.map(a => PY(a).s).join(', ')})`, p: 11 };
  }
  return no(`espressione: ${e?.t}`);
}
// printf diventa print con la formattazione %, che in Python ha gli stessi %d %i %c %s %.Nf %% del C
function stampaPy(e) {
  const f = e.arg[0]; if (f?.t !== 'testo') no('printf senza formato');
  const args = e.arg.slice(1);
  let t = args.length ? f.v : f.v.replace(/%%/g, '%');
  const aCapo = t.endsWith('\n'); if (aCapo) t = t.slice(0, -1);
  let x = t || args.length ? `"${scappa(t, '"')}"` : '';
  if (args.length === 1) { const a = PY(args[0]); x += ` % ${tondo(a.s, a.p < 9)}`; }
  else if (args.length) x += ` % (${args.map(a => PY(a).s).join(', ')})`;
  return `print(${[x, aCapo ? '' : 'end=""'].filter(Boolean).join(', ')})`;
}
function pyEspr(e) {
  if (e.t === 'assegna') { const op = e.op === '/=' && tipoS(e.x) !== 'double' && tipoS(e.e) !== 'double' ? '//=' : e.op; return `${PY(e.x).s} ${op} ${PY(e.e).s}`; }
  if (e.t === 'incr') return `${PY(e.x).s} ${e.op === '++' ? '+=' : '-='} 1`;
  if (e.t === 'chiama' && e.nome === 'printf') return stampaPy(e);
  return PY(e).s;
}
// un for del C che è proprio un range: for (int i = a; i < b; i++) con b che non cambia e i che il corpo non tocca
function rangeDi(n) {
  const d = n.init, c = n.c, p = n.passo;
  if (!d || d.t !== 'dich' || d.tipo !== 'int' || d.voci.length !== 1 || !c || !p) return null;
  const i = d.voci[0].nome;
  if (c.t !== 'bin' || !['<', '<=', '>', '>='].includes(c.op) || c.a.t !== 'var' || c.a.nome !== i) return null;
  if (!(c.b.t === 'num' || (c.b.t === 'var' && c.b.nome !== i && !cambiata(n.corpo, c.b.nome)))) return null;
  let k = 0;
  if (p.t === 'incr' && p.x.t === 'var' && p.x.nome === i) k = p.op === '++' ? 1 : -1;
  else if (p.t === 'assegna' && p.x.t === 'var' && p.x.nome === i && (p.op === '+=' || p.op === '-=') && p.e.t === 'num' && p.e.v > 0) k = p.op === '+=' ? p.e.v : -p.e.v;
  if (!k || cambiata(n.corpo, i) || (k > 0) !== (c.op[0] === '<')) return null;
  const sposta = c.op === '<=' ? 1 : c.op === '>=' ? -1 : 0;
  const fine = c.b.t === 'num' ? String(c.b.v + sposta) : sposta ? `${c.b.nome} ${sposta > 0 ? '+' : '-'} 1` : c.b.nome;
  const inizio = PY(d.voci[0].init).s;
  return { i, testo: `range(${(k === 1 && inizio === '0' ? [fine] : k === 1 ? [inizio, fine] : [inizio, fine, String(k)]).join(', ')})` };
}
const pySuite = (n, liv, out) => { const k = out.length; pyIstr(n, liv, out); if (out.length === k) out.push(RIENTRO.repeat(liv) + 'pass'); };
function pyIstr(n, liv, out) {
  const r = RIENTRO.repeat(liv);
  switch (n.t) {
    case 'dich': for (const x of n.voci) out.push(`${r}${x.nome} = ${PY(x.init).s}`); return;
    case 'array': out.push(`${r}${n.nome} = [${n.valori.map(x => PY(x).s).join(', ')}]`); return;
    case 'espr': out.push(r + pyEspr(n.e)); return;
    case 'blocco': for (const x of n.corpo) pyIstr(x, liv, out); return;
    case 'se': {
      out.push(`${r}if ${PY(n.c).s}:`); pySuite(n.allora, liv + 1, out);
      let a = n.altrimenti;
      while (a && a.t === 'se') { out.push(`${r}elif ${PY(a.c).s}:`); pySuite(a.allora, liv + 1, out); a = a.altrimenti; }
      if (a) { out.push(`${r}else:`); pySuite(a, liv + 1, out); }
      return;
    }
    case 'mentre': out.push(`${r}while ${PY(n.c).s}:`); pySuite(n.corpo, liv + 1, out); return;
    case 'per': {
      const rg = rangeDi(n);
      if (rg) { out.push(`${r}for ${rg.i} in ${rg.testo}:`); pySuite(n.corpo, liv + 1, out); return; }
      if (n.init) pyIstr(n.init, liv, out);
      out.push(`${r}while ${n.c ? PY(n.c).s : 'True'}:`);
      pySuite(blocco(...(n.corpo.t === 'blocco' ? n.corpo.corpo : [n.corpo]), ...(n.passo ? [espr(n.passo)] : [])), liv + 1, out);
      return;
    }
    case 'interrompi': out.push(`${r}break`); return;
    case 'continua': out.push(`${r}continue`); return;
    case 'ritorna': out.push(`${r}return${n.e ? ' ' + PY(n.e).s : ''}`); return;
  }
  no(`istruzione: ${n?.t}`);
}
// il sorgente Python 3: le funzioni con def, poi il corpo di main al primo livello, come negli esercizi d'esame
export function stampaPython(n) {
  const prima = LING; LING = 'python';
  try {
    const prog = comeProgramma(n);
    controlla(prog);
    const out = [];
    for (const f of prog.funzioni) if (f.nome !== 'main') { TIPI = tipiDi(f); out.push(`def ${f.nome}(${f.params.map(p => p.nome).join(', ')}):`); pySuite(f.corpo, 1, out); out.push('', ''); }
    const m = FUNZ.get('main'); TIPI = tipiDi(m);
    for (const x of m.corpo.corpo) pyIstr(x, 0, out);
    return out.join('\n') + '\n';
  } finally { LING = prima; }
}

// il sorgente nella lingua scelta. { include: false } vale solo per il C (senza #include): Java e Python si mostrano interi
export function stampaIn(n, lingua = 'c', { include = true } = {}) {
  if (lingua === 'java') return stampaJava(n);
  if (lingua === 'python') return stampaPython(n);
  return stampaC(n, { include });
}
// si scrive fedele in quella lingua?
export const scrivibile = (n, lingua) => { try { stampaIn(n, lingua); return true; } catch (e) { if (e instanceof ErroreC) return false; throw e; } };

/* ---------- eseguire ---------- */
// i valori: { tipo: 'int' | 'double' | 'ptr' | 'arr' | 'str' | 'void', v }. Un char letto diventa int (promozione del C).
// le celle (variabili): { tipo: 'int' | 'char' | 'double' | 'ptr' | 'arr', v }
const INT = v => ({ tipo: 'int', v }), DBL = v => ({ tipo: 'double', v });
const VUOTO = { tipo: 'void', v: 0 };
const intero = (r, cosa = 'conto') => { if (!Number.isFinite(r) || r < MIN || r > MAX) throw new ErroreC('trabocco', `${cosa} fuori dai 32 bit: ${r}`); return r | 0; };

class Ambiente {
  constructor(su = null) { this.su = su; this.m = new Map(); }
  cerca(nome) { for (let a = this; a; a = a.su) if (a.m.has(nome)) return a.m.get(nome); throw new ErroreC('nome', `variabile non dichiarata: ${nome}`); }
  dichiara(nome, cella) { if (this.m.has(nome)) throw new ErroreC('nome', `doppia dichiarazione: ${nome}`); this.m.set(nome, cella); }
}

// la conversione di un valore nel tipo di una cella, come l'assegnamento del C
function converti(x, tipo) {
  if (tipo === 'double') { if (x.tipo !== 'int' && x.tipo !== 'double') throw new ErroreC('tipo', `non è un numero: ${x.tipo}`); return x.v; }
  if (tipo === 'int' || tipo === 'char') {
    if (x.tipo !== 'int' && x.tipo !== 'double') throw new ErroreC('tipo', `non è un numero: ${x.tipo}`);
    const n = x.tipo === 'double' ? intero(Math.trunc(x.v), 'conversione') : x.v;
    if (tipo === 'char' && (n < 0 || n > 127)) throw new ErroreC('char', `char fuori dall'ASCII: ${n}`);
    return n;
  }
  if (tipo === 'ptr') { if (x.tipo !== 'ptr') throw new ErroreC('tipo', 'serve un indirizzo'); return x.v; }
  throw new ErroreC('tipo', `tipo sconosciuto: ${tipo}`);
}
const leggi = c => c.tipo === 'double' ? DBL(c.v) : c.tipo === 'ptr' ? { tipo: 'ptr', v: c.v } : c.tipo === 'arr' ? { tipo: 'arr', v: c.v, el: c.el } : INT(c.v);
const vero = x => { if (x.tipo !== 'int' && x.tipo !== 'double') throw new ErroreC('tipo', 'condizione non numerica'); return x.v !== 0; };

// formattare un double come %.Nf. I casi esattamente a metà si scartano: toFixed e glibc arrotondano in modo diverso
export function fissa(x, n = 6) {
  if (!Number.isFinite(x)) throw new ErroreC('reale', `valore non finito: ${x}`);
  const m = Math.abs(x) * 10 ** n, fr = m - Math.floor(m);
  if (Math.abs(fr - .5) < 1e-6) throw new ErroreC('meta', `caso a metà con %.${n}f: ${x}`);
  const s = Math.abs(x).toFixed(n);
  return (x < 0 || Object.is(x, -0)) ? '-' + s : s;
}
// come la scriverebbe chi pensa che 7/2 faccia 3.5 (solo per i mutanti: modo tollerante)
const libero = x => Number.isInteger(x) ? String(x) : String(+x.toFixed(2));

// la divisione e il resto di Python: verso il basso, il resto col segno del divisore
const giu = (x, y) => { const q = (x / y) | 0; return x % y !== 0 && (x < 0) !== (y < 0) ? q - 1 : q; };
const restoGiu = (x, y) => { const r = x % y; return r !== 0 && (r < 0) !== (y < 0) ? r + y : r; };

export function esegui(nodo, { maxPassi = 10000, tollerante = false, maxProfondita = 400, lingua = 'c' } = {}) {
  const py = lingua === 'python';
  const prog = nodo.t === 'programma' ? nodo : nodo.t === 'funzione' ? programma(nodo) : programma(main(...(nodo.t === 'blocco' ? nodo.corpo : [nodo])));
  const funz = new Map(prog.funzioni.map(f => [f.nome, f]));
  if (!funz.has('main')) throw new ErroreC('main', 'manca main');
  let uscita = '', passi = 0, prof = 0;
  const passo = () => { if (++passi > maxPassi) throw new ErroreC('passi', `più di ${maxPassi} passi`); };

  // il tipo di un'espressione senza eseguirla (serve al ternario: «c ? 1 : 2.5» è un double)
  function tipoDi(e, amb) {
    switch (e.t) {
      case 'num': case 'car': return 'int';
      case 'reale': return 'double';
      case 'testo': return 'str';
      case 'var': { const c = amb.cerca(e.nome); return c.tipo === 'char' ? 'int' : c.tipo; }
      case 'indice': { const a = tipoCella(e, amb); return a === 'char' ? 'int' : a; }
      case 'valore': { const a = tipoCella(e, amb); return a === 'char' ? 'int' : a; }
      case 'indirizzo': return 'ptr';
      case 'bin': {
        const a = tipoDi(e.a, amb), b = tipoDi(e.b, amb);
        if (e.op === '%' && (a === 'double' || b === 'double')) throw new ErroreC('tipo', '% con un double');
        if (PREC[e.op] <= 10) return 'int';
        return (a === 'double' || b === 'double' || (e.modo === 'reale' && e.op === '/')) ? 'double' : 'int';
      }
      case 'un': return e.op === '!' ? 'int' : tipoDi(e.a, amb);
      case 'cast': return e.tipo === 'char' ? 'int' : e.tipo;
      case 'ternario': { const a = tipoDi(e.a, amb), b = tipoDi(e.b, amb); return a === 'double' || b === 'double' ? 'double' : a; }
      case 'assegna': case 'incr': { const a = tipoCella(e.x, amb); return a === 'char' ? 'int' : a; }
      case 'chiama': { if (e.nome === 'printf') return 'int'; const f = funz.get(e.nome); return f?.tipo === 'char' ? 'int' : f?.tipo || 'int'; }
    }
    return 'int';
  }
  function tipoCella(e, amb) {
    if (e.t === 'var') return amb.cerca(e.nome).tipo;
    if (e.t === 'indice') { const a = e.a.t === 'var' ? amb.cerca(e.a.nome) : null; return a?.el || 'int'; }
    if (e.t === 'valore') { const p = e.p.t === 'var' ? amb.cerca(e.p.nome) : null; return p?.v?.tipo || 'int'; }
    return 'int';
  }

  // la cella dietro un'espressione che si può assegnare: x, a[i], *p
  function cella(e, amb) {
    if (e.t === 'var') return amb.cerca(e.nome);
    if (e.t === 'indice') {
      const a = val(e.a, amb), i = val(e.i, amb);
      if (a.tipo !== 'arr') throw new ErroreC('tipo', 'indice su un non-array');
      if (i.tipo !== 'int') throw new ErroreC('tipo', 'indice non intero');
      if (i.v < 0 || i.v >= a.v.length) throw new ErroreC('indice', `indice ${i.v} fuori dall'array di ${a.v.length}`);
      return a.v[i.v];
    }
    if (e.t === 'valore') { const p = val(e.p, amb); if (p.tipo !== 'ptr') throw new ErroreC('tipo', '* su un non-puntatore'); return p.v; }
    throw new ErroreC('lvalue', `non si può assegnare: ${e.t}`);
  }
  function scrivi(c, x) { c.v = converti(x, c.tipo); return leggi(c); }

  function conto(op, a, b, modo) {
    if (a.tipo !== 'int' && a.tipo !== 'double' || b.tipo !== 'int' && b.tipo !== 'double') throw new ErroreC('tipo', `operandi non numerici per ${op}`);
    if (op === '%' && (a.tipo === 'double' || b.tipo === 'double')) throw new ErroreC('tipo', '% con un double');
    const reali = a.tipo === 'double' || b.tipo === 'double' || (op === '/' && modo === 'reale');
    if (reali) {
      const x = a.v, y = b.v;
      if (op === '+') return DBL(x + y); if (op === '-') return DBL(x - y); if (op === '*') return DBL(x * y);
      if (op === '/') { if (y === 0) throw new ErroreC('zero', 'divisione per zero'); return DBL(x / y); }
      if (op === '<') return INT(+(x < y)); if (op === '<=') return INT(+(x <= y)); if (op === '>') return INT(+(x > y)); if (op === '>=') return INT(+(x >= y));
      if (op === '==') return INT(+(x === y)); if (op === '!=') return INT(+(x !== y));
    } else {
      const x = a.v, y = b.v;
      if (op === '+') return INT(intero(x + y)); if (op === '-') return INT(intero(x - y));
      if (op === '*') { intero(x * y); return INT(Math.imul(x, y)); }
      if (op === '/' || op === '%') {
        if (y === 0) throw new ErroreC('zero', 'divisione per zero');
        if (x === MIN && y === -1) throw new ErroreC('trabocco', 'INT_MIN / -1');
        if (op === '/') {
          if (modo === 'pavimento') return INT(Math.floor(x / y));        // mutante: la divisione «come in Python»
          if (modo === 'arrotondata') return INT(Math.round(x / y));      // mutante: chi pensa che arrotondi
          if (modo === 'zero') return INT((x / y) | 0);                    // mutante in Python: la divisione «come in C»
          return INT(py ? giu(x, y) : (x / y) | 0);                        // Python: verso il basso; C e Java: verso zero
        }
        if (modo === 'matematico') return INT(((x % y) + Math.abs(y)) % Math.abs(y));   // mutante: resto sempre positivo
        if (modo === 'divisore') return INT(((x % y) + y) % y);                          // mutante: col segno del divisore
        if (modo === 'dividendo') return INT(x % y);                                     // mutante in Python: il resto «come in C»
        return INT(py ? restoGiu(x, y) : x % y);                                         // Python: segno del divisore; C e Java: del dividendo
      }
      if (op === '<') return INT(+(x < y)); if (op === '<=') return INT(+(x <= y)); if (op === '>') return INT(+(x > y)); if (op === '>=') return INT(+(x >= y));
      if (op === '==') return INT(+(x === y)); if (op === '!=') return INT(+(x !== y));
    }
    throw new ErroreC('op', `operatore sconosciuto: ${op}`);
  }

  function val(e, amb) {
    switch (e.t) {
      case 'num': return INT(intero(e.v, 'costante'));
      case 'car': { const c = e.v.charCodeAt(0); if (e.v.length !== 1 || c > 127) throw new ErroreC('char', `carattere non ASCII: ${e.v}`); return INT(c); }
      case 'reale': return DBL(e.v);
      case 'testo': return { tipo: 'str', v: e.v };
      case 'var': return leggi(amb.cerca(e.nome));
      case 'indice': case 'valore': return leggi(cella(e, amb));
      case 'indirizzo': { if (e.x.t !== 'var') throw new ErroreC('tipo', '& solo su una variabile'); const c = amb.cerca(e.x.nome); if (c.tipo === 'arr' || c.tipo === 'ptr') throw new ErroreC('tipo', '& su array o puntatore'); return { tipo: 'ptr', v: c }; }
      case 'un': {
        const a = val(e.a, amb);
        if (e.op === '!') return INT(vero(a) ? 0 : 1);
        if (e.op === '-') { if (a.tipo === 'double') return DBL(-a.v); if (a.tipo !== 'int') throw new ErroreC('tipo', '- su un non-numero'); return INT(intero(-a.v)); }
        throw new ErroreC('op', `operatore unario sconosciuto: ${e.op}`);
      }
      case 'cast': { const a = val(e.a, amb); return e.tipo === 'double' ? DBL(converti(a, 'double')) : INT(converti(a, e.tipo)); }
      case 'bin': {
        if (e.op === '&&' || e.op === '||') {
          const a = vero(val(e.a, amb));
          if (e.modo === 'entrambi') { const b = vero(val(e.b, amb)); return INT(+(e.op === '&&' ? a && b : a || b)); }   // mutante: senza cortocircuito
          if (a === (e.op === '||')) { tipoDi(e.b, amb); return INT(a ? 1 : 0); }   // il pezzo saltato deve comunque essere C valido
          return INT(+vero(val(e.b, amb)));
        }
        return conto(e.op, val(e.a, amb), val(e.b, amb), e.modo);
      }
      case 'ternario': {
        const t = tipoDi(e, amb), x = vero(val(e.c, amb)) ? val(e.a, amb) : val(e.b, amb);
        return t === 'double' && x.tipo === 'int' ? DBL(x.v) : x;
      }
      case 'assegna': {
        const c = cella(e.x, amb), x = val(e.e, amb);
        if (e.op === '=') return scrivi(c, x);
        return scrivi(c, conto(e.op[0], leggi(c), x, e.modo));
      }
      case 'incr': {
        const c = cella(e.x, amb), prima = leggi(c);
        if (prima.tipo !== 'int' && prima.tipo !== 'double') throw new ErroreC('tipo', '++ su un non-numero');
        const dopo = scrivi(c, conto(e.op === '++' ? '+' : '-', prima, INT(1)));
        return e.pre ? dopo : prima;
      }
      case 'chiama': return chiamata(e, amb);
    }
    throw new ErroreC('nodo', `espressione sconosciuta: ${e?.t}`);
  }

  function formato(args) {
    const f = args[0]; if (!f || f.tipo !== 'str') throw new ErroreC('printf', 'printf senza formato');
    let i = 1, out = '';
    const prendi = () => { if (i >= args.length) throw new ErroreC('printf', 'mancano argomenti a printf'); return args[i++]; };
    const s = f.v;
    for (let k = 0; k < s.length; k++) {
      if (s[k] !== '%') { out += s[k]; continue; }
      const m = /^%(?:\.(\d+))?([dicsf%])/.exec(s.slice(k));
      if (!m) throw new ErroreC('printf', `formato non previsto: ${s.slice(k, k + 4)}`);
      k += m[0].length - 1;
      const [, prec, c] = m;
      if (c === '%') { if (prec != null) throw new ErroreC('printf', '%.N%'); out += '%'; continue; }
      const a = prendi();
      if (c === 'd' || c === 'i') {
        if (a.tipo === 'int' && prec == null) { out += String(a.v); continue; }
        if (tollerante && (a.tipo === 'double' || a.tipo === 'int')) { out += libero(a.v); continue; }
        throw new ErroreC('printf', `%${c} vuole un int`);
      }
      if (c === 'c') {
        if (a.tipo === 'int' && prec == null && a.v >= 32 && a.v <= 126) { out += String.fromCharCode(a.v); continue; }
        if (tollerante) { out += a.tipo === 'int' && a.v >= 32 && a.v <= 126 ? String.fromCharCode(a.v) : '?'; continue; }
        throw new ErroreC('printf', '%c vuole un carattere stampabile');
      }
      if (c === 's') { if (a.tipo === 'str' && prec == null) { out += a.v; continue; } throw new ErroreC('printf', '%s vuole una stringa'); }
      if (c === 'f') {
        if (a.tipo === 'double') { out += fissa(a.v, prec == null ? 6 : +prec); continue; }
        if (tollerante && a.tipo === 'int') { out += fissa(a.v, prec == null ? 6 : +prec); continue; }
        throw new ErroreC('printf', '%f vuole un double');
      }
    }
    if (i !== args.length) throw new ErroreC('printf', 'troppi argomenti a printf');
    return out;
  }

  function chiamata(e, amb) {
    const args = e.arg.map(a => val(a, amb));
    if (e.nome === 'printf') { const s = formato(args); uscita += s; return INT(s.length); }
    const f = funz.get(e.nome); if (!f) throw new ErroreC('nome', `funzione sconosciuta: ${e.nome}`);
    if (f.params.length !== args.length) throw new ErroreC('chiamata', `${e.nome} vuole ${f.params.length} argomenti`);
    if (++prof > maxProfondita) throw new ErroreC('ricorsione', 'ricorsione troppo profonda');
    const loc = new Ambiente(null);
    f.params.forEach((p, k) => {
      const a = args[k];
      if (p.forma === '[]') { if (a.tipo !== 'arr' || a.el !== p.tipo) throw new ErroreC('tipo', `${p.nome} vuole un array di ${p.tipo}`); loc.dichiara(p.nome, { tipo: 'arr', v: a.v, el: a.el }); }
      else if (p.forma === '*') { if (a.tipo !== 'ptr' || a.v.tipo !== p.tipo) throw new ErroreC('tipo', `${p.nome} vuole un indirizzo di ${p.tipo}`); loc.dichiara(p.nome, { tipo: 'ptr', v: a.v }); }
      else loc.dichiara(p.nome, { tipo: p.tipo, v: converti(a, p.tipo) });
    });
    const r = blocco_(f.corpo.corpo, loc);
    prof--;
    if (f.tipo === 'void') return VUOTO;
    if (!r || r.segnale !== 'ritorna' || !r.valore) {
      if (f.nome === 'main') return INT(0);
      throw new ErroreC('ritorno', `${f.nome} finisce senza return`);
    }
    return f.tipo === 'double' ? DBL(converti(r.valore, 'double')) : INT(converti(r.valore, f.tipo));
  }

  function dichiara(n, amb) {
    if (n.t === 'array') {
      if (!n.valori.length) throw new ErroreC('array', 'array vuoto');
      const celle = n.valori.map(x => ({ tipo: n.tipo, v: converti(val(x, amb), n.tipo) }));
      amb.dichiara(n.nome, { tipo: 'arr', v: celle, el: n.tipo });
      return;
    }
    for (const x of n.voci) {
      if (!x.init) throw new ErroreC('init', `variabile senza valore: ${x.nome}`);
      const c = { tipo: n.tipo, v: converti(val(x.init, amb), n.tipo) };
      amb.dichiara(x.nome, c);
    }
  }

  const blocco_ = (lista, amb) => { for (const x of lista) { const r = istruzione(x, amb); if (r) return r; } return null; };
  // un ciclo: «interrompi» esce, «continua» va avanti, «ritorna» risale
  const giro = r => r && (r.segnale === 'interrompi' ? 'esci' : r.segnale === 'continua' ? null : r);

  function istruzione(n, amb) {
    passo();
    switch (n.t) {
      case 'dich': case 'array': dichiara(n, amb); return null;
      case 'espr': val(n.e, amb); return null;
      case 'blocco': return blocco_(n.corpo, new Ambiente(amb));
      case 'se': {
        if (vero(val(n.c, amb))) return istruzione(n.allora, new Ambiente(amb));
        return n.altrimenti ? istruzione(n.altrimenti, new Ambiente(amb)) : null;
      }
      case 'mentre': {
        for (;;) {
          passo(); if (!vero(val(n.c, amb))) return null;
          const r = giro(istruzione(n.corpo, new Ambiente(amb))); if (r === 'esci') return null; if (r) return r;
        }
      }
      case 'fai': {
        for (;;) {
          const r = giro(istruzione(n.corpo, new Ambiente(amb))); if (r === 'esci') return null; if (r) return r;
          passo(); if (!vero(val(n.c, amb))) return null;
        }
      }
      case 'per': {
        const a = new Ambiente(amb);
        if (n.init) { if (n.init.t === 'espr') val(n.init.e, a); else dichiara(n.init, a); }
        for (;;) {
          passo(); if (n.c && !vero(val(n.c, a))) return null;
          const r = giro(istruzione(n.corpo, new Ambiente(a))); if (r === 'esci') return null; if (r) return r;
          if (n.passo) val(n.passo, a);
        }
      }
      case 'scegli': {
        const x = val(n.e, amb); if (x.tipo !== 'int') throw new ErroreC('tipo', 'switch su un non-intero');
        let k = n.casi.findIndex(c => c.val && val(c.val, amb).v === x.v);
        if (k < 0) k = n.casi.findIndex(c => !c.val);
        if (k < 0) return null;
        const a = new Ambiente(amb);
        for (let j = k; j < n.casi.length; j++) {
          const r = blocco_(n.casi[j].corpo, a);
          if (r) return r.segnale === 'interrompi' ? null : r;
        }
        return null;
      }
      case 'interrompi': return { segnale: 'interrompi' };
      case 'continua': return { segnale: 'continua' };
      case 'ritorna': return { segnale: 'ritorna', valore: n.e ? val(n.e, amb) : null };
    }
    throw new ErroreC('nodo', `istruzione sconosciuta: ${n?.t}`);
  }

  chiamata(chiama('main'), new Ambiente());
  return { uscita, passi };
}

// due uscite che si leggono uguali: senza \r, senza spazi in fondo alle righe, senza righe vuote in fondo
export const normalizza = s => String(s ?? '').replace(/\r\n?/g, '\n').split('\n').map(r => r.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '');
