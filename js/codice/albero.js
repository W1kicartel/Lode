// Il mini-albero del C di «Cosa stampa?». Due cose sole:
// - stampaC(nodo): scrive il sorgente C vero (si compila con cc, gcc o clang);
// - esegui(nodo, { maxPassi }): lo esegue qui, con le regole del C, e restituisce { uscita, passi }.
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
    case 'assegna': { const x = E(e.x), y = E(e.e); return { s: `${x.s} ${e.op} ${tondo(y.s, y.p < 2)}`, p: 2 }; }
    case 'incr': { const x = E(e.x); return e.pre ? { s: e.op + tondo(x.s, x.p < 15), p: 15 } : { s: tondo(x.s, x.p < 16) + e.op, p: 16 }; }
    case 'chiama': return { s: `${e.nome}(${e.arg.map(a => { const x = E(a); return tondo(x.s, x.p < 3); }).join(', ')})`, p: 16 };
  }
  throw new ErroreC('nodo', `espressione sconosciuta: ${e?.t}`);
}
export const stampaEspr = e => E(e).s;

const dichTesto = n => n.t === 'array'
  ? `${n.tipo} ${n.nome}[] = {${n.valori.map(x => E(x).s).join(', ')}}`
  : `${n.tipo} ${n.voci.map(x => `${x.nome} = ${E(x.init).s}`).join(', ')}`;
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
  const out = [];
  if (n.t === 'programma') {
    if (include) out.push('#include <stdio.h>', '');
    n.funzioni.forEach((f, i) => { if (i) out.push(''); out.push(firma(f) + ' {'); for (const x of f.corpo.corpo) istr(x, 1, out); out.push('}'); });
  } else if (n.t === 'funzione') { out.push(firma(n) + ' {'); for (const x of n.corpo.corpo) istr(x, 1, out); out.push('}'); }
  else if (n.t in { dich: 1, array: 1, espr: 1, blocco: 1, se: 1, mentre: 1, per: 1, fai: 1, scegli: 1, interrompi: 1, continua: 1, ritorna: 1 }) istr(n, 0, out);
  else return E(n).s;
  return out.join('\n') + (n.t === 'programma' && include ? '\n' : '');
}

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

export function esegui(nodo, { maxPassi = 10000, tollerante = false, maxProfondita = 400 } = {}) {
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
          return INT((x / y) | 0);                                         // troncata verso zero
        }
        if (modo === 'matematico') return INT(((x % y) + Math.abs(y)) % Math.abs(y));   // mutante: resto sempre positivo
        if (modo === 'divisore') return INT(((x % y) + y) % y);                          // mutante: col segno del divisore
        return INT(x % y);                                                                // col segno del dividendo
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
