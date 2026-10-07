// I modelli di «Cosa stampa?». Ogni modello è { id, cosa, concetti, concetto, genera(rng), mutanti }:
// - genera(rng) costruisce un programma C (albero.js) coi numeri presi dal seme;
// - ogni mutante { id, applica(programma), frase(scelta, dati) } è un errore tipico dello studente:
//   l'uscita del programma mutato è un distrattore, e la frase spiega cosa ha sbagliato chi lo sceglie.
// Le risposte le calcola esegui(), non un'AI. test/verifica-c.mjs controlla che il compilatore vero stampi lo stesso.
// Lingue: ogni modello dice in quali si scrive (lingue: C, Java, Python; albero.js controlla che la stampa sia fedele) e, se
// serve, le frasi e il concetto che cambiano con la lingua (python: { concetto, frasi, mutanti }, java: { … }).
// test/stampa-vero.mjs li prova contro python3 e javac/java veri.
import { t, elenco } from '../lingua.js';
import { num, car, reale, v, indice, valore, indirizzo, bin, cast, ternario, assegna, incr, chiama, printf, dich, array, espr, blocco, se, mentre, fai, per, scegli, caso, interrompi, continua, ritorna, param, funzione, main, programma, clona, visita, esegui, stampaC, stampaIn, normalizza, ErroreC, NOMI_LINGUE } from './albero.js';

/* ---------- il seme ---------- */
// mulberry32: stessi semi, stessi numeri, su ogni computer
export function creaRng(seme) {
  let a = seme >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const tra = (r, a, b) => a + Math.floor(r() * (b - a + 1));
export const uno = (r, xs) => xs[Math.floor(r() * xs.length)];
export const mescola = (r, xs) => { const x = [...xs]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const impasta = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/* ---------- i nomi ---------- */
// gli argomenti (chiavi SM-2 'stampa|<id>' in D.codice.memoria). Stessi id e nomi di js/codice/diario.js
export const CONCETTI = {
  'c:for': t('modelli.concetti.for'), 'c:while': t('modelli.concetti.while'), 'c:do-while': t('modelli.concetti.do-while'),
  'c:ritroso': t('modelli.concetti.ritroso'), 'c:array': t('modelli.concetti.array'), 'c:divisione-intera': t('modelli.concetti.divisione-intera'),
  'c:resto': t('modelli.concetti.resto'), 'c:cast': t('modelli.concetti.cast'), 'c:incremento': t('modelli.concetti.incremento'),
  'c:assegnamento': t('modelli.concetti.assegnamento'), 'c:switch': t('modelli.concetti.switch'), 'c:cortocircuito': t('modelli.concetti.cortocircuito'),
  'c:else-pendente': t('modelli.concetti.else-pendente'), 'c:puntatori': t('modelli.concetti.puntatori'), 'c:parametri': t('modelli.concetti.parametri'),
  'c:visibilita': t('modelli.concetti.visibilita'), 'c:char': t('modelli.concetti.char'), 'c:ricorsione': t('modelli.concetti.ricorsione'),
  'c:annidati': t('modelli.concetti.annidati'), 'c:break-continue': t('modelli.concetti.break-continue'), 'c:ternario': t('modelli.concetti.ternario'),
};
// i sette errori della spec: quelli che contano in D.codice.errori («Sbagli spesso: …»). Stessi nomi di diario.js
export const MUTANTI = {
  'fuori-di-uno': t('modelli.errori.fuori-di-uno'), 'divisione-intera': t('modelli.errori.divisione-intera'), 'post-vs-pre': t('modelli.errori.post-vs-pre'),
  'break-dimenticato': t('modelli.errori.break-dimenticato'), 'copia-del-parametro': t('modelli.errori.copia-del-parametro'), cortocircuito: t('modelli.errori.cortocircuito'),
  'resto-col-segno': t('modelli.errori.resto-col-segno'),
};
// tutti gli errori che i modelli sanno riconoscere (i sette, più quelli di argomenti che la spec non nomina)
export const ERRORI = {
  ...MUTANTI, 'piu-uguale': t('modelli.errori.piu-uguale'), 'maggiore-o-uguale': t('modelli.errori.maggiore-o-uguale'), 'indice-valore': t('modelli.errori.indice-valore'),
  sovrascrittura: t('modelli.errori.sovrascrittura'), 'else-pendente': t('modelli.errori.else-pendente'), 'variabile-nascosta': t('modelli.errori.variabile-nascosta'),
  'carattere-codice': t('modelli.errori.carattere-codice'), 'caso-base': t('modelli.errori.caso-base'), 'passo-del-ciclo': t('modelli.errori.passo-del-ciclo'),
  ricorsione: t('modelli.errori.ricorsione'), 'cicli-annidati': t('modelli.errori.cicli-annidati'), 'break-continue': t('modelli.errori.break-continue'),
  'do-while': t('modelli.errori.do-while'), ternario: t('modelli.errori.ternario'), 'scambi-in-fila': t('modelli.errori.scambi-in-fila'),
};

/* ---------- attrezzi per i modelli ---------- */
const P = (dati, ...f) => Object.assign(programma(...f), { dati });
const S = (n, segno) => { n.segno = segno; return n; };     // segna il punto che un mutante cambia
// copia il programma e cambia i nodi segnati. f cambia il nodo sul posto, oppure ne restituisce uno nuovo
function cambia(p, segno, f) {
  const c = clona(p), trovati = [];
  visita(c, x => { if (x.segno === segno) trovati.push(x); });
  if (!trovati.length) throw new Error(`segno mancante: ${segno}`);
  for (const x of trovati) { const r = f(x); if (r && r !== x) { const nuovo = clona(r); for (const k of Object.keys(x)) delete x[k]; Object.assign(x, nuovo); } }
  return c;
}
const cambiaTutti = (p, ...passi) => passi.reduce((q, [segno, f]) => cambia(q, segno, f), p);
// un programma che stampa solo questo testo: per gli errori che non sono una modifica del codice
const soloUscita = s => programma(main(espr(printf(s.replace(/%/g, '%%')))));
// «Hai scelto `…`» (risposta scelta fra le opzioni) o «Hai scritto `…`» (risposta scritta): istanza() fa le due frasi di ogni
// distrattore con lo stesso mutante, così valuta() in stampa.js non deve riscrivere la frase (in un'altra lingua non saprebbe come)
let HAI = 'modelli.hai-scelto';
const hai = s => t(HAI, { s });
const scritta = f => { const prima = HAI; HAI = 'esempio.hai-scritto'; try { return f(); } finally { HAI = prima; } };
const NOME = l => NOMI_LINGUE[l] || 'C';
const pr = l => l === 'python' ? 'print' : 'printf';
// il range che stampaPython scrive per un for del C
const rangeTesto = (a, b, k = 1) => `range(${k === 1 && a === 0 ? b : k === 1 ? `${a}, ${b}` : `${a}, ${b}, ${k}`})`;
const fila = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, k) => a + k);

/* ---------- i modelli ---------- */
export const MODELLI = [
  {
    id: 'for-minore', cosa: t('modelli.for-minore.cosa'), concetti: ['c:for'],
    concetto: t('modelli.for-minore.concetto'),
    genera(r) {
      const a = tra(r, 0, 3), b = a + tra(r, 3, 6);
      return P({ a, b }, main(
        per(dich('int', ['i', S(num(a), 'inizio')]), S(bin('<', v('i'), num(b)), 'cond'), incr(v('i')), espr(printf('%d ', v('i')))),
        espr(printf('\n'))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '<='; }), frase: (s, d) => t('modelli.for-minore.frase', { hai: hai(s), b: d.b }) },
      { id: 'passo-del-ciclo', applica: p => cambia(p, 'inizio', n => { n.v += 1; }), frase: (s, d) => t('modelli.for-minore.frase-2', { hai: hai(s), a: d.a }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.b.v -= 1; }), frase: (s, d) => t('modelli.for-minore.frase-3', { hai: hai(s), b: d.b, b2: d.b - 1 }) },
    ],
  },
  {
    id: 'for-passo', cosa: t('modelli.for-passo.cosa'), concetti: ['c:for'],
    concetto: t('modelli.for-passo.concetto'),
    genera(r) {
      const a = tra(r, 0, 4), s = tra(r, 2, 3), b = a + s * tra(r, 3, 4);
      return P({ a, s, b }, main(
        per(dich('int', ['i', S(num(a), 'inizio')]), S(bin('<=', v('i'), num(b)), 'cond'), assegna(v('i'), '+=', num(s)), espr(printf('%d ', v('i')))),
        espr(printf('\n'))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '<'; }), frase: (s, d) => t('modelli.for-passo.frase', { hai: hai(s), b: d.b }) },
      { id: 'passo-del-ciclo', applica: p => cambia(p, 'inizio', n => { n.v += p.dati.s; }), frase: (s, d) => t('modelli.for-passo.frase-2', { hai: hai(s), s: d.s, a: d.a }) },
    ],
  },
  {
    id: 'for-indietro', cosa: t('modelli.for-indietro.cosa'), concetti: ['c:ritroso', 'c:for'],
    concetto: t('modelli.for-indietro.concetto'),
    genera(r) {
      const l = tra(r, 0, 2), n = l + tra(r, 3, 6);
      return P({ l, n }, main(
        per(dich('int', ['i', S(num(n), 'inizio')]), S(bin('>', v('i'), num(l)), 'cond'), incr(v('i'), '--'), espr(printf('%d ', v('i')))),
        espr(printf('\n'))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '>='; }), frase: (s, d) => t('modelli.for-indietro.frase', { hai: hai(s), l: d.l, l2: d.l + 1 }) },
      { id: 'passo-del-ciclo', applica: p => cambia(p, 'inizio', n => { n.v -= 1; }), frase: (s, d) => t('modelli.for-indietro.frase-2', { hai: hai(s), n: d.n }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.b.v += 1; }), frase: (s, d) => t('modelli.for-indietro.frase-3', { hai: hai(s), l: d.l + 1, l2: d.l }) },
    ],
  },
  {
    id: 'while-somma', cosa: t('modelli.while-somma.cosa'), concetti: ['c:while'],
    concetto: t('modelli.while-somma.concetto'),
    genera(r) {
      const n = tra(r, 3, 6);
      return P({ n }, main(
        dich('int', ['i', num(0)], ['s', num(0)]),
        mentre(S(bin('<', v('i'), num(n)), 'cond'), S(blocco(espr(assegna(v('s'), '+=', v('i'))), espr(incr(v('i')))), 'corpo')),
        S(espr(printf('%d %d\n', v('i'), v('s'))), 'stampa')));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '<='; }), frase: (s, d) => t('modelli.while-somma.frase', { hai: hai(s), n: d.n }) },
      { id: 'passo-del-ciclo', applica: p => cambia(p, 'corpo', n => { n.corpo.reverse(); }), frase: s => t('modelli.while-somma.frase-2', { hai: hai(s) }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'stampa', n => { n.e.arg[1] = bin('-', v('i'), num(1)); }), frase: (s, d) => t('modelli.while-somma.frase-3', { hai: hai(s), n: d.n - 1, n2: d.n }) },
    ],
  },
  {
    id: 'while-dimezza', cosa: t('modelli.while-dimezza.cosa'), concetti: ['c:while', 'c:divisione-intera'],
    concetto: t('modelli.while-dimezza.concetto'),
    genera(r) {
      let n; do n = tra(r, 9, 60); while ((n & (n - 1)) === 0);
      return P({ n }, main(
        S(dich('int', ['n', num(n)]), 'dn'),
        dich('int', ['k', num(0)]),
        mentre(S(bin('>', v('n'), num(1)), 'cond'), blocco(espr(assegna(v('n'), '/=', num(2))), espr(incr(v('k'))))),
        espr(printf('%d %d\n', v('n'), v('k')))));
    },
    mutanti: [
      { id: 'divisione-intera', applica: p => cambia(p, 'dn', n => { n.tipo = 'double'; }), frase: s => t('modelli.while-dimezza.frase', { hai: hai(s) }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '>='; }), frase: s => t('modelli.while-dimezza.frase-2', { hai: hai(s) }) },
    ],
  },
  {
    id: 'while-post', cosa: t('modelli.while-post.cosa'), concetti: ['c:incremento', 'c:while'],
    concetto: t('modelli.while-post.concetto'),
    genera(r) {
      const n = tra(r, 3, 6);
      return P({ n }, main(
        dich('int', ['i', num(0)]),
        mentre(bin('<', S(incr(v('i')), 'inc'), num(n)), S(espr(printf('%d ', v('i'))), 'stampa')),
        S(espr(printf('| %d\n', v('i'))), 'fine')));
    },
    mutanti: [
      { id: 'post-vs-pre', applica: p => cambia(p, 'inc', n => { n.pre = true; }), frase: s => t('modelli.while-post.frase', { hai: hai(s) }) },
      { id: 'post-vs-pre', applica: p => cambia(p, 'stampa', n => { n.e.arg[1] = bin('-', v('i'), num(1)); }), frase: s => t('modelli.while-post.frase-2', { hai: hai(s) }) },
      { id: 'post-vs-pre', applica: p => cambia(p, 'fine', n => { n.e.arg[1] = bin('-', v('i'), num(1)); }), frase: (s, d) => t('modelli.while-post.frase-3', { hai: hai(s), n: d.n + 1 }) },
    ],
  },
  {
    id: 'array-somma', cosa: t('modelli.array-somma.cosa'), concetti: ['c:array'],
    concetto: t('modelli.array-somma.concetto'),
    genera(r) {
      const k = tra(r, 4, 6), xs = Array.from({ length: k }, () => tra(r, 1, 9));
      return P({ k, xs }, main(
        array('int', 'v', xs), dich('int', ['s', num(0)]),
        per(dich('int', ['i', S(num(0), 'inizio')]), S(bin('<', v('i'), num(k)), 'cond'), incr(v('i')), S(espr(assegna(v('s'), '+=', indice(v('v'), v('i')))), 'acc')),
        espr(printf('%d\n', v('s')))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'inizio', n => { n.v = 1; }), frase: s => t('modelli.array-somma.frase', { hai: hai(s) }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.b.v -= 1; }), frase: (s, d) => t('modelli.array-somma.frase-2', { hai: hai(s), k: d.k, k2: d.k - 1 }) },
      { id: 'piu-uguale', applica: p => cambia(p, 'acc', n => { n.e.op = '='; }), frase: s => t('modelli.array-somma.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'array-massimo', cosa: t('modelli.array-massimo.cosa'), concetti: ['c:array'],
    concetto: t('modelli.array-massimo.concetto'),
    genera(r) {
      const k = tra(r, 4, 6), xs = Array.from({ length: k }, () => tra(r, 1, 19));
      const max = 20 + tra(r, 0, 9);
      if (r() < .5) { const i = tra(r, 0, k - 3), j = tra(r, i + 2, k - 1); xs[i] = max; xs[j] = max; } else xs[k - 1] = max;
      return P({ k, xs }, main(
        array('int', 'v', xs), dich('int', ['m', indice(v('v'), num(0))], ['p', num(0)]),
        per(dich('int', ['i', num(1)]), S(bin('<', v('i'), num(k)), 'cond'), incr(v('i')),
          se(S(bin('>', indice(v('v'), v('i')), v('m')), 'cmp'), blocco(espr(assegna(v('m'), '=', indice(v('v'), v('i')))), espr(assegna(v('p'), '=', v('i')))))),
        S(espr(printf('%d %d\n', v('m'), v('p'))), 'stampa')));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'stampa', n => { n.e.arg[2] = bin('+', v('p'), num(1)); }), frase: (s, d, l) => t('modelli.array-massimo.frase', { hai: hai(s), linguaggio: NOME(l) }) },
      { id: 'maggiore-o-uguale', applica: p => cambia(p, 'cmp', n => { n.op = '>='; }), frase: s => t('modelli.array-massimo.frase-2', { hai: hai(s) }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.b.v -= 1; }), frase: s => t('modelli.array-massimo.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'array-ultimo', cosa: t('modelli.array-ultimo.cosa'), concetti: ['c:array'],
    concetto: t('modelli.array-ultimo.concetto'),
    genera(r) {
      const k = tra(r, 5, 6), x = tra(r, 1, 9), i = tra(r, 0, k - 3), j = tra(r, i + 1, k - 1);
      const xs = Array.from({ length: k }, (_, z) => z === i || z === j ? x : uno(r, fila(1, 9).filter(y => y !== x)));
      return P({ k, x, i, j }, main(
        array('int', 'v', xs), dich('int', ['p', num(-1)]),
        per(dich('int', ['i', num(0)]), bin('<', v('i'), num(k)), incr(v('i')),
          se(bin('==', indice(v('v'), v('i')), num(x)), S(espr(assegna(v('p'), '=', v('i'))), 'trova'))),
        S(espr(printf('%d\n', v('p'))), 'stampa')));
    },
    mutanti: [
      { id: 'sovrascrittura', applica: p => cambia(p, 'trova', n => blocco({ ...n, segno: undefined }, interrompi())), frase: s => t('modelli.array-ultimo.frase', { hai: hai(s) }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'stampa', n => { n.e.arg[1] = bin('+', v('p'), num(1)); }), frase: (s, d, l) => t('modelli.array-ultimo.frase-2', { hai: hai(s), linguaggio: NOME(l) }) },
      { id: 'indice-valore', applica: p => cambia(p, 'stampa', n => { n.e.arg[1] = num(p.dati.x); }), frase: s => t('modelli.array-ultimo.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'media-array', cosa: t('modelli.media-array.cosa'), concetti: ['c:divisione-intera', 'c:cast'],
    concetto: t('modelli.media-array.concetto'),
    genera(r) {
      const k = uno(r, [3, 4, 5, 6, 7]), xs = Array.from({ length: k }, () => tra(r, 1, 9));
      if (xs.reduce((a, b) => a + b, 0) % k === 0) xs[0] = xs[0] === 9 ? 8 : xs[0] + 1;
      return P({ k, xs }, main(
        array('int', 'v', xs), dich('int', ['s', num(0)]),
        per(dich('int', ['i', num(0)]), bin('<', v('i'), num(k)), incr(v('i')), espr(assegna(v('s'), '+=', indice(v('v'), v('i'))))),
        espr(printf('%d %.2f\n', S(bin('/', v('s'), num(k)), 'd1'), S(bin('/', cast('double', v('s')), num(k)), 'd2')))));
    },
    mutanti: [
      { id: 'divisione-intera', applica: p => cambia(p, 'd1', n => { n.modo = 'reale'; }), frase: (s, d) => t('modelli.media-array.frase', { hai: hai(s), k: d.k }) },
      { id: 'divisione-intera', applica: p => cambia(p, 'd2', n => cast('double', bin('/', v('s'), num(p.dati.k)))), frase: s => t('modelli.media-array.frase-2', { hai: hai(s) }) },
      { id: 'divisione-intera', applica: p => cambia(p, 'd1', n => { n.modo = 'arrotondata'; }), frase: s => t('modelli.media-array.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'divisione-double', cosa: t('modelli.divisione-double.cosa'), concetti: ['c:divisione-intera'],
    concetto: t('modelli.divisione-double.concetto'),
    genera(r) {
      const b = uno(r, [3, 5, 6, 7, 9]); let a; do a = tra(r, b + 1, 6 * b); while (a % b <= b / 2);
      return P({ a, b }, main(
        dich('int', ['a', num(a)], ['b', num(b)]),
        dich('double', ['m', S(bin('/', v('a'), v('b')), 'div')]),
        espr(printf('%.1f\n', v('m')))));
    },
    mutanti: [
      { id: 'divisione-intera', applica: p => cambia(p, 'div', n => { n.modo = 'reale'; }), frase: s => t('modelli.divisione-double.frase', { hai: hai(s) }) },
      { id: 'divisione-intera', applica: p => cambia(p, 'div', n => { n.modo = 'arrotondata'; }), frase: s => t('modelli.divisione-double.frase-2', { hai: hai(s) }) },
    ],
  },
  {
    id: 'cast-prima-dopo', cosa: t('modelli.cast-prima-dopo.cosa'), concetti: ['c:cast', 'c:divisione-intera'],
    concetto: t('modelli.cast-prima-dopo.concetto'),
    genera(r) {
      const n = uno(r, [2, 3, 4, 5]); let s; do s = tra(r, n + 1, 9 * n); while (s % n === 0);
      return P({ s, n }, main(
        dich('int', ['s', num(s)], ['n', num(n)]),
        espr(printf('%.2f %.2f\n', S(cast('double', bin('/', v('s'), v('n'))), 'c1'), S(bin('/', cast('double', v('s')), v('n')), 'c2')))));
    },
    mutanti: [
      { id: 'divisione-intera', applica: p => cambia(p, 'c1', () => bin('/', cast('double', v('s')), v('n'))), frase: s => t('modelli.cast-prima-dopo.frase', { hai: hai(s) }) },
      { id: 'divisione-intera', applica: p => cambia(p, 'c2', () => cast('double', bin('/', v('s'), v('n')))), frase: s => t('modelli.cast-prima-dopo.frase-2', { hai: hai(s) }) },
      { id: 'divisione-intera', applica: p => cambiaTutti(p, ['c1', () => bin('/', cast('double', v('s')), v('n'))], ['c2', () => cast('double', bin('/', v('s'), v('n')))]), frase: s => t('modelli.cast-prima-dopo.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'diviso-due', cosa: t('modelli.diviso-due.cosa'), concetti: ['c:divisione-intera'],
    concetto: t('modelli.diviso-due.concetto'),
    genera(r) {
      const a = 2 * tra(r, 2, 12) + 1;
      return P({ a }, main(
        dich('int', ['a', num(a)]),
        espr(printf('%d %.1f\n', S(bin('/', v('a'), num(2)), 'd1'), S(bin('/', v('a'), reale(2)), 'd2')))));
    },
    mutanti: [
      { id: 'divisione-intera', applica: p => cambia(p, 'd1', n => { n.modo = 'reale'; }), frase: s => t('modelli.diviso-due.frase', { hai: hai(s) }) },
      { id: 'divisione-intera', applica: p => cambia(p, 'd2', n => { n.b = num(2); }), frase: s => t('modelli.diviso-due.frase-2', { hai: hai(s) }) },
      { id: 'divisione-intera', applica: p => cambia(p, 'd1', n => { n.modo = 'arrotondata'; }), frase: s => t('modelli.diviso-due.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'resto-negativi', cosa: t('modelli.resto-negativi.cosa'), concetti: ['c:resto'],
    concetto: (d, l) => t('modelli.resto-negativi.concetto', { linguaggio: NOME(l) }),
    genera(r) {
      const segni = uno(r, [[-1, 1], [-1, 1], [1, -1]]), b0 = tra(r, 2, 5); let a0; do a0 = tra(r, b0 + 1, 20); while (a0 % b0 === 0);
      const a = segni[0] * a0, b = segni[1] * b0;
      return P({ a, b }, main(
        dich('int', ['a', num(a)], ['b', num(b)]),
        espr(printf('%d %d\n', S(bin('/', v('a'), v('b')), 'div'), S(bin('%', v('a'), v('b')), 'mod')))));
    },
    mutanti: [
      { id: 'resto-col-segno', applica: p => cambiaTutti(p, ['div', n => { n.modo = 'pavimento'; }], ['mod', n => { n.modo = 'divisore'; }]), frase: (s, d, l) => t('modelli.resto-negativi.frase', { hai: hai(s), linguaggio: NOME(l) }) },
      { id: 'resto-col-segno', applica: p => cambia(p, 'mod', n => { n.modo = 'matematico'; }), frase: (s, d, l) => t('modelli.resto-negativi.frase-2', { hai: hai(s), linguaggio: NOME(l) }) },
      { id: 'divisione-intera', applica: p => cambia(p, 'div', n => { n.modo = 'pavimento'; }), frase: s => t('modelli.resto-negativi.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'post-pre', cosa: t('modelli.post-pre.cosa'), concetti: ['c:incremento'],
    // il concetto segue il segno del seme: con i-- e --i si parla di decremento
    concetto: d => d.op === '--' ? t('modelli.post-pre.concetto')
      : t('modelli.post-pre.concetto-2'),
    genera(r) {
      const a = tra(r, 1, 9), op = uno(r, ['++', '--']);
      return P({ a, op }, main(
        dich('int', ['i', num(a)]),
        dich('int', ['x', S(incr(v('i'), op, false), 'x')]),
        dich('int', ['y', S(incr(v('i'), op, true), 'y')]),
        espr(printf('%d %d %d\n', v('x'), v('y'), v('i')))));
    },
    mutanti: [
      { id: 'post-vs-pre', applica: p => cambia(p, 'x', n => { n.pre = true; }), frase: (s, d) => t('modelli.post-pre.frase', { hai: hai(s), op: d.op }) },
      { id: 'post-vs-pre', applica: p => cambia(p, 'y', n => { n.pre = false; }), frase: (s, d) => t('modelli.post-pre.frase-2', { hai: hai(s), op: d.op }) },
      { id: 'post-vs-pre', applica: p => cambiaTutti(p, ['x', n => { n.pre = true; }], ['y', n => { n.pre = false; }]), frase: (s, d) => t('modelli.post-pre.frase-3', { hai: hai(s), op: d.op }) },
    ],
  },
  {
    id: 'piu-uguale', cosa: t('modelli.piu-uguale.cosa'), concetti: ['c:assegnamento', 'c:for'],
    concetto: t('modelli.piu-uguale.concetto'),
    genera(r) {
      const a = tra(r, 1, 5), n = tra(r, 3, 5), k = tra(r, 2, 4);
      return P({ a, n, k }, main(
        dich('int', ['s', S(num(a), 's0')]),
        per(dich('int', ['i', num(1)]), S(bin('<=', v('i'), num(n)), 'cond'), incr(v('i')), S(espr(assegna(v('s'), '+=', bin('*', v('i'), num(k)))), 'acc')),
        espr(printf('%d\n', v('s')))));
    },
    mutanti: [
      { id: 'piu-uguale', applica: p => cambia(p, 'acc', n => { n.e.op = '='; }), frase: s => t('modelli.piu-uguale.frase', { hai: hai(s) }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '<'; }), frase: (s, d) => t('modelli.piu-uguale.frase-2', { hai: hai(s), n: d.n }) },
      { id: 'piu-uguale', applica: p => cambia(p, 's0', n => { n.v = 0; }), frase: (s, d) => t('modelli.piu-uguale.frase-3', { hai: hai(s), a: d.a }) },
    ],
  },
  {
    id: 'switch', cosa: t('modelli.switch.cosa'), concetti: ['c:switch'],
    concetto: t('modelli.switch.concetto'),
    genera(r) {
      // le parole stampate seguono la lingua della barra (catalogo «esempio»); la risposta giusta la calcola esegui() da qui
      const parole = elenco('esempio.switch-parole');
      let rompe; do rompe = parole.map(() => r() < .4); while (rompe.every(Boolean) || !rompe.some(Boolean));
      // di solito x cade in un case senza break, e più sotto un break lo ferma
      const buoni = fila(1, 4).filter(k => !rompe[k - 1] && rompe.slice(k).some(Boolean));
      const x = buoni.length && r() < .8 ? uno(r, buoni) : tra(r, 1, 5);
      const casi = parole.map((w, k) => caso(k + 1, espr(printf(w + ' ')), ...(rompe[k] ? [interrompi()] : [])));
      return P({ x, rompe }, main(
        dich('int', ['x', num(x)]),
        S(scegli(v('x'), ...casi, caso(null, espr(printf(t('esempio.switch-altro') + ' ')))), 'sw'),
        espr(printf('\n'))));
    },
    mutanti: [
      { id: 'break-dimenticato', applica: p => cambia(p, 'sw', n => { for (const c of n.casi) if (!c.corpo.some(x => x.t === 'interrompi')) c.corpo.push(interrompi()); }), frase: s => t('modelli.switch.frase', { hai: hai(s) }) },
      { id: 'break-dimenticato', applica: p => cambia(p, 'sw', n => { for (const c of n.casi) c.corpo = c.corpo.filter(x => x.t !== 'interrompi'); }), frase: s => t('modelli.switch.frase-2', { hai: hai(s) }) },
      { id: 'break-dimenticato', applica: p => cambia(p, 'sw', n => { const d = clona(n.casi.at(-1).corpo); for (const c of n.casi) if (!c.corpo.some(x => x.t === 'interrompi')) c.corpo.push(interrompi()); return blocco({ ...n, segno: undefined }, ...d); }), frase: s => t('modelli.switch.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'cortocircuito', cosa: t('modelli.cortocircuito.cosa'), concetti: ['c:cortocircuito'],
    concetto: t('modelli.cortocircuito.concetto'),
    genera(r) {
      const o = r() < .5, a = o ? tra(r, 1, 9) : tra(r, -9, 0);
      const cond = o ? bin('||', bin('>', v('a'), num(0)), bin('>', incr(v('n'), '++', true), num(1)))
        : bin('&&', bin('>', v('a'), num(0)), bin('>', incr(v('n'), '++', true), num(0)));
      return P({ a, op: o ? '||' : '&&' }, main(
        dich('int', ['a', num(a)], ['n', num(0)]),
        se(S(cond, 'cond'), espr(printf(t('esempio.si') + ' ')), espr(printf(t('esempio.no') + ' '))),
        espr(printf('%d\n', v('n')))));
    },
    mutanti: [
      { id: 'cortocircuito', applica: p => cambia(p, 'cond', n => { n.modo = 'entrambi'; }), frase: (s, d) => t('modelli.cortocircuito.frase', { hai: hai(s), op: d.op }) },
      { id: 'cortocircuito', applica: p => cambia(p, 'cond', n => { n.op = n.op === '||' ? '&&' : '||'; }), frase: (s, d) => t('modelli.cortocircuito.frase-2', { hai: hai(s), op: d.op === '||' ? '&&' : '||', op2: d.op === '||' ? t('modelli.cortocircuito.frase-3') : t('modelli.cortocircuito.frase-4') }) },
    ],
  },
  {
    id: 'else-pendente', cosa: t('modelli.else-pendente.cosa'), concetti: ['c:else-pendente'],
    concetto: t('modelli.else-pendente.concetto'),
    genera(r) {
      const n = uno(r, [4, 6]), t = tra(r, 0, 2);
      const dentro = se(bin('>', v('i'), num(t)), espr(printf('A%d ', v('i'))), espr(printf('B%d ', v('i'))));
      dentro.elseFuori = true;
      return P({ n, t }, main(
        per(dich('int', ['i', num(0)]), S(bin('<', v('i'), num(n)), 'cond'), incr(v('i')),
          S(se(bin('==', bin('%', v('i'), num(2)), num(0)), dentro), 'fuori')),
        espr(printf('\n'))));
    },
    mutanti: [
      { id: 'else-pendente', applica: p => cambia(p, 'fuori', n => { n.altrimenti = n.allora.altrimenti; n.allora.altrimenti = null; }), frase: (s, d) => t('modelli.else-pendente.frase', { hai: hai(s), p: d.t }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '<='; }), frase: (s, d) => t('modelli.else-pendente.frase-2', { hai: hai(s), n: d.n, n2: d.n - 1 }) },
    ],
  },
  {
    id: 'swap-valore', cosa: t('modelli.swap-valore.cosa'), concetti: ['c:parametri'],
    concetto: t('modelli.swap-valore.concetto'),
    genera(r) {
      const x = tra(r, 1, 9); let y; do y = tra(r, 1, 9); while (y === x);
      return P({ x, y }, funzione('void', 'scambia', [param('int', 'a'), param('int', 'b')],
        dich('int', ['t', v('a')]), espr(assegna(v('a'), '=', v('b'))), espr(assegna(v('b'), '=', v('t'))), espr(printf('%d %d\n', v('a'), v('b')))),
      main(dich('int', ['x', num(x)], ['y', num(y)]), espr(chiama('scambia', v('x'), v('y'))), espr(printf('%d %d\n', v('x'), v('y')))));
    },
    mutanti: [
      { id: 'copia-del-parametro', applica: p => soloUscita(`${p.dati.y} ${p.dati.x}\n${p.dati.y} ${p.dati.x}\n`), frase: s => t('modelli.swap-valore.frase', { hai: hai(s) }) },
      { id: 'copia-del-parametro', applica: p => soloUscita(`${p.dati.x} ${p.dati.y}\n${p.dati.x} ${p.dati.y}\n`), frase: s => t('modelli.swap-valore.frase-2', { hai: hai(s) }) },
    ],
  },
  {
    id: 'swap-indirizzo', cosa: t('modelli.swap-indirizzo.cosa'), concetti: ['c:puntatori'],
    concetto: t('modelli.swap-indirizzo.concetto'),
    genera(r) {
      const [x, y, z] = mescola(r, fila(1, 9)).slice(0, 3);
      return P({ x, y, z }, funzione('void', 'scambia', [param('int', 'a', '*'), param('int', 'b', '*')],
        dich('int', ['t', valore(v('a'))]), espr(assegna(valore(v('a')), '=', valore(v('b')))), espr(assegna(valore(v('b')), '=', v('t')))),
      main(dich('int', ['x', num(x)], ['y', num(y)], ['z', num(z)]),
        espr(chiama('scambia', indirizzo(v('x')), indirizzo(v('y')))), espr(chiama('scambia', indirizzo(v('y')), indirizzo(v('z')))),
        espr(printf('%d %d %d\n', v('x'), v('y'), v('z')))));
    },
    mutanti: [
      { id: 'copia-del-parametro', applica: p => soloUscita(`${p.dati.x} ${p.dati.y} ${p.dati.z}\n`), frase: s => t('modelli.swap-indirizzo.frase', { hai: hai(s) }) },
      { id: 'scambi-in-fila', applica: p => soloUscita(`${p.dati.z} ${p.dati.x} ${p.dati.y}\n`), frase: s => t('modelli.swap-indirizzo.frase-2', { hai: hai(s) }) },
      { id: 'scambi-in-fila', applica: p => soloUscita(`${p.dati.y} ${p.dati.z} ${p.dati.y}\n`), frase: s => t('modelli.swap-indirizzo.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'valore-e-indirizzo', cosa: t('modelli.valore-e-indirizzo.cosa'), concetti: ['c:puntatori', 'c:parametri'],
    concetto: t('modelli.valore-e-indirizzo.concetto'),
    genera(r) {
      const x = tra(r, 1, 9), y = tra(r, 1, 9), k = tra(r, 2, 3), nome = k === 2 ? 'raddoppia' : 'triplica';
      return P({ x, y, k }, funzione('void', nome, [param('int', 'a'), param('int', 'b', '*')],
        espr(assegna(v('a'), '=', bin('*', v('a'), num(k)))), espr(assegna(valore(v('b')), '=', bin('*', valore(v('b')), num(k)))), espr(printf('%d %d\n', v('a'), valore(v('b'))))),
      main(dich('int', ['x', num(x)], ['y', num(y)]), espr(chiama(nome, v('x'), indirizzo(v('y')))), espr(printf('%d %d\n', v('x'), v('y')))));
    },
    mutanti: [
      { id: 'copia-del-parametro', applica: p => { const { x, y, k } = p.dati; return soloUscita(`${x * k} ${y * k}\n${x * k} ${y * k}\n`); }, frase: s => t('modelli.valore-e-indirizzo.frase', { hai: hai(s) }) },
      { id: 'copia-del-parametro', applica: p => { const { x, y, k } = p.dati; return soloUscita(`${x * k} ${y * k}\n${x} ${y}\n`); }, frase: s => t('modelli.valore-e-indirizzo.frase-2', { hai: hai(s) }) },
    ],
  },
  {
    id: 'array-in-funzione', cosa: t('modelli.array-in-funzione.cosa'), concetti: ['c:array', 'c:parametri'],
    concetto: t('modelli.array-in-funzione.concetto'),
    genera(r) {
      const k = tra(r, 2, 3), xs = Array.from({ length: 3 }, () => tra(r, 1, 9));
      return P({ k, xs }, funzione('void', 'moltiplica', [param('int', 'v', '[]'), param('int', 'n')],
        mentre(bin('>', v('n'), num(0)), blocco(espr(incr(v('n'), '--')), espr(assegna(indice(v('v'), v('n')), '*=', num(k)))))),
      main(array('int', 'a', xs), dich('int', ['n', num(3)]), espr(chiama('moltiplica', v('a'), v('n'))),
        espr(printf('%d %d %d %d\n', indice(v('a'), num(0)), indice(v('a'), num(1)), indice(v('a'), num(2)), v('n')))));
    },
    mutanti: [
      { id: 'copia-del-parametro', applica: p => soloUscita(`${p.dati.xs.join(' ')} 3\n`), frase: s => t('modelli.array-in-funzione.frase', { hai: hai(s) }) },
      { id: 'copia-del-parametro', applica: p => soloUscita(`${p.dati.xs.map(x => x * p.dati.k).join(' ')} 0\n`), frase: s => t('modelli.array-in-funzione.frase-2', { hai: hai(s) }) },
    ],
  },
  {
    id: 'blocco-ombra', cosa: t('modelli.blocco-ombra.cosa'), concetti: ['c:visibilita'],
    concetto: t('modelli.blocco-ombra.concetto'),
    genera(r) {
      const a = tra(r, 1, 9), b = tra(r, 10, 20);
      return P({ a, b }, main(
        dich('int', ['x', num(a)], ['y', num(0)]),
        blocco(dich('int', ['x', num(b)]), espr(assegna(v('y'), '=', bin('+', v('x'), num(1)))), espr(assegna(v('x'), '=', bin('*', v('x'), num(2)))), espr(printf('%d ', v('x')))),
        espr(printf('%d %d\n', v('x'), v('y')))));
    },
    mutanti: [
      { id: 'variabile-nascosta', applica: p => { const { b } = p.dati; return soloUscita(`${2 * b} ${2 * b} ${b + 1}\n`); }, frase: (s, d) => t('modelli.blocco-ombra.frase', { hai: hai(s), b: d.b, a: d.a }) },
      { id: 'variabile-nascosta', applica: p => { const { a, b } = p.dati; return soloUscita(`${2 * b} ${a} ${a + 1}\n`); }, frase: s => t('modelli.blocco-ombra.frase-2', { hai: hai(s) }) },
    ],
  },
  {
    id: 'char-ascii', cosa: t('modelli.char-ascii.cosa'), concetti: ['c:char'],
    concetto: t('modelli.char-ascii.concetto'),
    genera(r) {
      const k = tra(r, 1, 20);
      return P({ k }, main(
        dich('char', ['c', bin('+', car('a'), num(k))]),
        dich('char', ['d', bin('-', v('c'), num(32))]),
        S(espr(printf('%c %d %c\n', v('c'), v('c'), v('d'))), 'stampa')));
    },
    mutanti: [
      { id: 'carattere-codice', applica: p => cambia(p, 'stampa', n => { n.e.arg[2] = bin('+', bin('-', v('c'), car('a')), num(1)); }), frase: s => t('modelli.char-ascii.frase', { hai: hai(s) }) },
      { id: 'carattere-codice', applica: p => cambia(p, 'stampa', n => { n.e.arg[0].v = '%c %c %c\n'; }), frase: s => t('modelli.char-ascii.frase-2', { hai: hai(s) }) },
      { id: 'carattere-codice', applica: p => cambia(p, 'stampa', n => { n.e.arg[0].v = '%c %d %d\n'; }), frase: s => t('modelli.char-ascii.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'fattoriale', cosa: t('modelli.fattoriale.cosa'), concetti: ['c:ricorsione'],
    concetto: t('modelli.fattoriale.concetto'),
    genera(r) {
      const n = tra(r, 3, 7);
      return P({ n }, funzione('int', 'fatt', [param('int', 'n')],
        se(bin('<=', v('n'), num(1)), ritorna(num(1))),
        ritorna(bin('*', v('n'), chiama('fatt', bin('-', v('n'), num(1)))))),
      main(espr(printf('%d\n', S(chiama('fatt', num(n)), 'chiama')))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'chiama', n => { n.arg[0].v -= 1; }), frase: (s, d) => t('modelli.fattoriale.frase', { hai: hai(s), n: d.n - 1, n2: d.n }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'chiama', n => { n.arg[0].v += 1; }), frase: (s, d) => t('modelli.fattoriale.frase-2', { hai: hai(s), n: d.n + 1, n2: d.n }) },
      { id: 'ricorsione', applica: p => soloUscita(`${p.dati.n * (p.dati.n - 1)}\n`), frase: s => t('modelli.fattoriale.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'somma-cifre', cosa: t('modelli.somma-cifre.cosa'), concetti: ['c:ricorsione'],
    concetto: t('modelli.somma-cifre.concetto'),
    genera(r) {
      const cifre = Array.from({ length: tra(r, 3, 4) }, () => tra(r, 1, 9)), n = +cifre.join('');
      return P({ n, cifre }, funzione('int', 'cifre', [param('int', 'n')],
        se(bin('<', v('n'), num(10)), S(ritorna(v('n')), 'base')),
        ritorna(bin('+', bin('%', v('n'), num(10)), chiama('cifre', bin('/', v('n'), num(10)))))),
      main(espr(printf('%d\n', chiama('cifre', num(n))))));
    },
    mutanti: [
      { id: 'caso-base', applica: p => cambia(p, 'base', n => { n.e = num(0); }), frase: s => t('modelli.somma-cifre.frase', { hai: hai(s) }) },
      { id: 'ricorsione', applica: p => soloUscita(`${p.dati.cifre.length}\n`), frase: s => t('modelli.somma-cifre.frase-2', { hai: hai(s) }) },
      { id: 'ricorsione', applica: p => soloUscita(`${p.dati.n % 10}\n`), frase: s => t('modelli.somma-cifre.frase-3', { hai: hai(s) }) },
    ],
  },
  {
    id: 'ricorsione-ordine', cosa: t('modelli.ricorsione-ordine.cosa'), concetti: ['c:ricorsione'],
    concetto: t('modelli.ricorsione-ordine.concetto'),
    genera(r) {
      const n = tra(r, 3, 6);
      return P({ n }, funzione('void', 'conta', [param('int', 'n')],
        se(bin('==', v('n'), num(0)), ritorna()),
        espr(chiama('conta', bin('-', v('n'), num(1)))),
        espr(printf('%d ', v('n')))),
      main(espr(chiama('conta', num(n))), espr(printf('\n'))));
    },
    mutanti: [
      { id: 'ricorsione', applica: p => soloUscita(fila(1, p.dati.n).reverse().join(' ') + '\n'), frase: s => t('modelli.ricorsione-ordine.frase', { hai: hai(s) }) },
      { id: 'caso-base', applica: p => soloUscita(fila(0, p.dati.n).join(' ') + '\n'), frase: s => t('modelli.ricorsione-ordine.frase-2', { hai: hai(s) }) },
    ],
  },
  {
    id: 'annidati-conta', cosa: t('modelli.annidati-conta.cosa'), concetti: ['c:annidati'],
    concetto: t('modelli.annidati-conta.concetto'),
    genera(r) {
      const n = tra(r, 3, 6);
      return P({ n }, main(
        dich('int', ['c', num(0)]),
        per(dich('int', ['i', num(0)]), bin('<', v('i'), num(n)), incr(v('i')),
          per(dich('int', ['j', num(0)]), S(bin('<', v('j'), v('i')), 'jc'), incr(v('j')), espr(incr(v('c'))))),
        espr(printf('%d\n', v('c')))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'jc', n => { n.op = '<='; }), frase: s => t('modelli.annidati-conta.frase', { hai: hai(s) }) },
      { id: 'cicli-annidati', applica: p => cambia(p, 'jc', n => { n.b = num(p.dati.n); }), frase: (s, d) => t('modelli.annidati-conta.frase-2', { hai: hai(s), n: d.n }) },
    ],
  },
  {
    id: 'annidati-stelle', cosa: t('modelli.annidati-stelle.cosa'), concetti: ['c:annidati'],
    concetto: t('modelli.annidati-stelle.concetto'),
    genera(r) {
      const n = tra(r, 3, 4), x = uno(r, ['*', '#']);
      return P({ n, x }, main(
        per(dich('int', ['i', num(1)]), S(bin('<=', v('i'), num(n)), 'ic'), incr(v('i')), blocco(
          per(dich('int', ['j', num(0)]), S(bin('<', v('j'), v('i')), 'jc'), incr(v('j')), espr(printf(x))),
          espr(printf('\n'))))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'jc', n => { n.op = '<='; }), frase: s => t('modelli.annidati-stelle.frase', { hai: hai(s) }) },
      { id: 'cicli-annidati', applica: p => cambia(p, 'jc', n => { n.b = num(p.dati.n); }), frase: (s, d) => t('modelli.annidati-stelle.frase-2', { hai: hai(s), n: d.n }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'ic', n => { n.op = '<'; }), frase: (s, d) => t('modelli.annidati-stelle.frase-3', { hai: hai(s), n: d.n }) },
    ],
  },
  {
    id: 'break-continue', cosa: t('modelli.break-continue.cosa'), concetti: ['c:break-continue'],
    concetto: (d, l) => t('modelli.break-continue.concetto', { l: pr(l) }),
    genera(r) {
      const n = tra(r, 6, 8), a = tra(r, 1, 2), b = tra(r, a + 2, n - 2);
      return P({ n, a, b }, main(
        per(dich('int', ['i', num(0)]), bin('<', v('i'), num(n)), incr(v('i')), blocco(
          se(bin('==', v('i'), num(a)), S(continua(), 'cont')),
          se(bin('==', v('i'), num(b)), S(interrompi(), 'brk')),
          espr(printf('%d ', v('i'))))),
        espr(printf('\n'))));
    },
    mutanti: [
      { id: 'break-continue', applica: p => cambia(p, 'cont', () => interrompi()), frase: (s, d) => t('modelli.break-continue.frase', { hai: hai(s), a: d.a }) },
      { id: 'break-continue', applica: p => cambia(p, 'brk', () => continua()), frase: (s, d) => t('modelli.break-continue.frase-2', { hai: hai(s), b: d.b }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'brk', () => blocco(espr(printf('%d ', v('i'))), interrompi())), frase: (s, d, l) => t('modelli.break-continue.frase-3', { hai: hai(s), l: pr(l), b: d.b }) },
    ],
  },
  {
    id: 'do-while', cosa: t('modelli.do-while.cosa'), concetti: ['c:do-while'],
    concetto: t('modelli.do-while.concetto'),
    // due casi, metà e metà. Falsa subito: il corpo gira lo stesso una volta (un while non girerebbe mai).
    // Vera all'inizio: i arriva proprio sul limite, e lì `<` e `<=` danno uscite diverse
    genera(r) {
      const s = tra(r, 2, 3), meno = r() < .5, vero = r() < .5, op = meno ? '<' : '>';
      let a, b;
      if (vero) { const k = tra(r, 2, 4); if (meno) { a = tra(r, 0, 4); b = a + k * s; } else { b = tra(r, 0, 4); a = b + k * s; } }
      else { b = tra(r, 1, 6); a = meno ? b + tra(r, 0, 5) : b - tra(r, 0, 5); }
      return P({ a, b, s, op, vero }, main(
        dich('int', ['i', num(a)], ['n', num(0)]),
        S(fai(blocco(espr(incr(v('n'))), espr(assegna(v('i'), meno ? '+=' : '-=', num(s)))), S(bin(op, v('i'), num(b)), 'cond')), 'ciclo'),
        S(espr(printf('%d %d\n', v('n'), v('i'))), 'stampa')));
    },
    mutanti: [
      { id: 'do-while', applica: p => cambia(p, 'ciclo', n => mentre(n.c, n.corpo)), frase: s => t('modelli.do-while.frase', { hai: hai(s) }) },
      { id: 'do-while', applica: p => cambia(p, 'ciclo', n => blocco(clona(n.corpo), { ...n, segno: undefined })), frase: (s, d) => t('modelli.do-while.frase-2', { hai: hai(s), vero: d.vero ? t('modelli.do-while.frase-3') : t('modelli.do-while.frase-4') }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op += '='; }), frase: (s, d) => t('modelli.do-while.frase-5', { hai: hai(s), op: d.op, b: d.b }) },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'stampa', n => { n.e.arg[2] = bin(p.dati.op === '<' ? '-' : '+', v('i'), num(p.dati.s)); }), frase: s => t('modelli.do-while.frase-6', { hai: hai(s) }) },
    ],
  },
  {
    id: 'ternario', cosa: t('modelli.ternario.cosa'), concetti: ['c:ternario'],
    concetto: t('modelli.ternario.concetto'),
    genera(r) {
      const a = tra(r, 1, 20); let b; do b = tra(r, 1, 20); while (b === a);
      return P({ a, b }, main(
        dich('int', ['a', num(a)], ['b', num(b)]),
        dich('int', ['m', S(ternario(bin('>', v('a'), v('b')), v('a'), v('b')), 't1')]),
        dich('int', ['d', S(ternario(bin('<', v('a'), v('b')), bin('-', v('b'), v('a')), bin('-', v('a'), v('b'))), 't2')]),
        espr(printf('%d %d\n', v('m'), v('d')))));
    },
    mutanti: [
      { id: 'ternario', applica: p => cambia(p, 't1', n => { [n.a, n.b] = [n.b, n.a]; }), frase: (s, d) => d.a > d.b ? t('modelli.ternario.frase-m-vera', { hai: hai(s) }) : t('modelli.ternario.frase-m-falsa', { hai: hai(s) }) },
      { id: 'ternario', applica: p => cambia(p, 't2', n => { [n.a, n.b] = [n.b, n.a]; }), frase: (s, d) => d.a < d.b ? t('modelli.ternario.frase-d-vera', { hai: hai(s) }) : t('modelli.ternario.frase-d-falsa', { hai: hai(s) }) },
      { id: 'ternario', applica: p => cambiaTutti(p, ['t1', n => { [n.a, n.b] = [n.b, n.a]; }], ['t2', n => { [n.a, n.b] = [n.b, n.a]; }]), frase: s => t('modelli.ternario.frase-7', { hai: hai(s) }) },
    ],
  },
];
export const modello = id => MODELLI.find(m => m.id === id) || null;

/* ---------- Java e Python ---------- */
// in quali lingue si scrive ogni modello. Fuori da Java e Python: i puntatori e la variabile nascosta nel blocco (Java non
// compila una x ridichiarata dentro, Python non ha i blocchi). Fuori solo da Python: ++ dentro un'espressione, lo switch che
// cade nel case sotto, il do-while, l'else pendente (in Python decide il rientro), i char, i cast e il tipo del risultato
// (in Python una variabile non ha tipo), il ternario (in Python si scrive x if c else y: è un altro esercizio)
const TUTTE = ['c', 'java', 'python'], C_JAVA = ['c', 'java'], SOLO_C = ['c'];
const LINGUE_MODELLI = {
  'for-minore': TUTTE, 'for-passo': TUTTE, 'for-indietro': TUTTE, 'while-somma': TUTTE, 'while-dimezza': TUTTE, 'while-post': C_JAVA,
  'array-somma': TUTTE, 'array-massimo': TUTTE, 'array-ultimo': TUTTE, 'media-array': TUTTE, 'divisione-double': C_JAVA,
  'cast-prima-dopo': C_JAVA, 'diviso-due': TUTTE, 'resto-negativi': TUTTE, 'post-pre': C_JAVA, 'piu-uguale': TUTTE, switch: C_JAVA,
  cortocircuito: C_JAVA, 'else-pendente': C_JAVA, 'swap-valore': TUTTE, 'swap-indirizzo': SOLO_C, 'valore-e-indirizzo': SOLO_C,
  'array-in-funzione': TUTTE, 'blocco-ombra': SOLO_C, 'char-ascii': C_JAVA, fattoriale: TUTTE, 'somma-cifre': TUTTE,
  'ricorsione-ordine': TUTTE, 'annidati-conta': TUTTE, 'annidati-stelle': TUTTE, 'break-continue': TUTTE, 'do-while': C_JAVA, ternario: C_JAVA,
};
// quello che cambia con la lingua: il concetto, le frasi (per posizione del mutante; null = quella del C) o tutti i mutanti
const VARIANTI = {
  'for-minore': { python: {
    concetto: d => t('modelli.for-minore.python.concetto', { b: rangeTesto(d.a, d.b), b2: d.b, b3: d.b - 1 }),
    frasi: [
      (s, d) => t('modelli.for-minore.python.frase', { hai: hai(s), b: rangeTesto(d.a, d.b + 1) }),
      (s, d) => t('modelli.for-minore.python.frase-2', { hai: hai(s), a: d.a }),
      (s, d) => t('modelli.for-minore.python.frase-3', { hai: hai(s), b: rangeTesto(d.a, d.b), b2: d.b - 1 })],
  } },
  'for-passo': { python: {
    concetto: d => t('modelli.for-passo.python.concetto', { s: rangeTesto(d.a, d.b + 1, d.s), s2: d.s, b: d.b + 1, b2: d.b }),
    frasi: [
      (s, d) => t('modelli.for-passo.python.frase', { hai: hai(s), s: rangeTesto(d.a, d.b, d.s), b: d.b + 1, b2: d.b }),
      (s, d) => t('modelli.for-passo.python.frase-2', { hai: hai(s), a: d.a, s: d.a + d.s })],
  } },
  'for-indietro': { python: {
    concetto: d => t('modelli.for-indietro.python.concetto', { n: d.n, l: d.l }),
    frasi: [
      (s, d) => t('modelli.for-indietro.python.frase', { hai: hai(s), l: d.l, l2: d.l + 1 }),
      (s, d) => t('modelli.for-indietro.python.frase-2', { hai: hai(s), n: d.n }),
      (s, d) => t('modelli.for-indietro.python.frase-3', { hai: hai(s), l: d.l + 1 })],
  } },
  'while-somma': { python: {
    concetto: t('modelli.while-somma.python.concetto'),
    frasi: [null, s => t('modelli.while-somma.python.frase', { hai: hai(s) }), null],
  } },
  'while-dimezza': { python: {
    concetto: t('modelli.while-dimezza.python.concetto'),
    frasi: [s => t('modelli.while-dimezza.python.frase', { hai: hai(s) }), null],
  } },
  'array-somma': { python: {
    frasi: [null, (s, d) => t('modelli.array-somma.python.frase', { hai: hai(s), k: d.k, k2: d.k - 1 }), null],
  } },
  'media-array': {
    python: {
      concetto: t('modelli.media-array.python.concetto'),
      frasi: [
        (s, d) => t('modelli.media-array.python.frase', { hai: hai(s), k: d.k }),
        s => t('modelli.media-array.python.frase-2', { hai: hai(s) }),
        s => t('modelli.media-array.python.frase-3', { hai: hai(s) })],
    },
    java: { frasi: [(s, d) => t('modelli.media-array.java.frase', { hai: hai(s), k: d.k }), null, null] },
  },
  'divisione-double': { java: {
    frasi: [s => t('modelli.divisione-double.java.frase', { hai: hai(s) }), null],
  } },
  'diviso-due': { python: {
    concetto: t('modelli.diviso-due.python.concetto'),
    frasi: [
      s => t('modelli.diviso-due.python.frase', { hai: hai(s) }),
      s => t('modelli.diviso-due.python.frase-2', { hai: hai(s) }),
      s => t('modelli.diviso-due.python.frase-3', { hai: hai(s) })],
  } },
  'resto-negativi': { python: {
    concetto: t('modelli.resto-negativi.python.concetto'),
    mutanti: [
      { id: 'resto-col-segno', applica: p => cambiaTutti(p, ['div', n => { n.modo = 'zero'; }], ['mod', n => { n.modo = 'dividendo'; }]), frase: s => t('modelli.resto-negativi.python.frase', { hai: hai(s) }) },
      { id: 'resto-col-segno', applica: p => cambia(p, 'mod', n => { n.modo = 'dividendo'; }), frase: s => t('modelli.resto-negativi.python.frase-2', { hai: hai(s) }) },
      { id: 'divisione-intera', applica: p => cambia(p, 'div', n => { n.modo = 'zero'; }), frase: s => t('modelli.resto-negativi.python.frase-3', { hai: hai(s) }) },
    ],
  } },
  'piu-uguale': { python: {
    frasi: [null, (s, d) => t('modelli.piu-uguale.python.frase', { hai: hai(s), n: d.n + 1, n2: d.n }), null],
  } },
  'swap-valore': { python: {
    concetto: t('modelli.swap-valore.python.concetto'),
    frasi: [s => t('modelli.swap-valore.python.frase', { hai: hai(s) }), s => t('modelli.swap-valore.python.frase-2', { hai: hai(s) })],
  } },
  'array-in-funzione': {
    python: {
      concetto: t('modelli.array-in-funzione.python.concetto'),
      frasi: [s => t('modelli.array-in-funzione.python.frase', { hai: hai(s) }), s => t('modelli.array-in-funzione.python.frase-2', { hai: hai(s) })],
    },
    java: { concetto: t('modelli.array-in-funzione.java.concetto') },
  },
  'somma-cifre': { python: { concetto: t('modelli.somma-cifre.python.concetto') } },
  'ricorsione-ordine': { python: {
    concetto: t('modelli.ricorsione-ordine.python.concetto'),
    frasi: [s => t('modelli.ricorsione-ordine.python.frase', { hai: hai(s) }), null],
  } },
  'annidati-conta': { python: {
    concetto: t('modelli.annidati-conta.python.concetto'),
    frasi: [s => t('modelli.annidati-conta.python.frase', { hai: hai(s) }), null],
  } },
  'annidati-stelle': {
    python: {
      concetto: t('modelli.annidati-stelle.python.concetto'),
      frasi: [s => t('modelli.annidati-stelle.python.frase', { hai: hai(s) }), null, (s, d) => t('modelli.annidati-stelle.python.frase-2', { hai: hai(s), n: d.n + 1, n2: d.n })],
    },
    java: { concetto: t('modelli.annidati-stelle.java.concetto') },
  },
};
for (const m of MODELLI) Object.assign(m, { lingue: LINGUE_MODELLI[m.id] || SOLO_C }, VARIANTI[m.id] || {});
// i modelli di una lingua
export const modelliPer = (lingua = 'c') => MODELLI.filter(m => m.lingue.includes(lingua));
// il modello visto in una lingua: { concetto, mutanti } con le frasi di quella lingua
export function variante(m, lingua = 'c') {
  const o = (lingua !== 'c' && m[lingua]) || {};
  const mutanti = o.mutanti || m.mutanti.map((mu, k) => o.frasi?.[k] ? { ...mu, frase: o.frasi[k] } : mu);
  return { concetto: o.concetto ?? m.concetto, mutanti };
}

/* ---------- una domanda pronta ---------- */
// il testo di un'uscita da mostrare: com'è, oppure «(niente)»; in linea le righe si separano con ⏎
export const vista = u => normalizza(u) || t('modelli.niente');
export const inLinea = u => vista(u).split('\n').join(' ⏎ ');
const righe = u => { const n = normalizza(u); return n ? n.split('\n').length : 0; };

// istanza(modello, seme, { lingua }) → { modello, lingua, seme, programma, codice, sorgente, giusta, opzioni, distrattori, scrivi, concetti, concetto }
// codice: quello che vede lo studente (in C senza #include; Java e Python interi); sorgente: il programma completo da eseguire.
// opzioni: la giusta più al massimo 3 distrattori, mescolati dal seme. Con meno di 2 distrattori scrivi = true: si risponde scrivendo.
// Un modello che non si scrive in quella lingua dà null. Stesso seme, stesso programma in tutte le lingue (le uscite seguono la lingua)
export function istanza(m, seme = 1, { maxPassi = 10000, lingua = 'c' } = {}) {
  if (typeof m === 'string') m = modello(m);
  if (!m || !m.lingue.includes(lingua)) return null;
  const { concetto: conc, mutanti } = variante(m, lingua);
  const r = creaRng(impasta(m.id) ^ Math.imul(seme | 0, 0x9E3779B1));
  for (let tentativo = 0; tentativo < 40; tentativo++) {
    const p = m.genera(r);
    let giusta, codice, sorgente;
    try {
      giusta = esegui(p, { maxPassi, lingua }).uscita;
      sorgente = stampaIn(p, lingua); codice = lingua === 'c' ? stampaC(p, { include: false }) : sorgente;
    } catch (e) { if (e instanceof ErroreC) continue; throw e; }
    if (righe(giusta) > 10) continue;
    const viste = new Set([normalizza(giusta)]), distrattori = [];
    for (const [indiceMutante, mu] of mutanti.entries()) {
      let u;
      try { u = esegui(mu.applica(p), { maxPassi, tollerante: true, lingua }).uscita; } catch (e) { if (e instanceof ErroreC) continue; throw e; }
      const k = normalizza(u);
      if (viste.has(k) || righe(u) > 10) continue;
      viste.add(k);
      distrattori.push({ uscita: u, mutante: mu.id, indiceMutante, frase: mu.frase(inLinea(u), p.dati || {}, lingua), scritta: scritta(() => mu.frase(inLinea(u), p.dati || {}, lingua)) });
    }
    if (!distrattori.length) continue;     // nessun errore cambia l'uscita: con questi numeri non serve, si rigenera
    const scelti = distrattori.length > 3 ? mescola(r, distrattori).slice(0, 3) : distrattori;
    const scrivi = scelti.length < 2;
    const opzioni = scrivi ? [] : mescola(r, [{ uscita: giusta, mutante: null, giusta: true }, ...scelti.map(d => ({ ...d, giusta: false }))]);
    const concetto = typeof conc === 'function' ? conc(p.dati || {}, lingua) : conc;   // alcuni concetti seguono i dati (i++ o i--) o la lingua
    return { modello: m.id, cosa: m.cosa, lingua, seme, programma: p, codice, sorgente, giusta, opzioni, distrattori, scrivi, concetti: [...m.concetti], concetto };
  }
  return null;
}

// una risposta scritta: conta quello che si legge, non gli spazi (le righe si possono separare con uno spazio)
export const compatta = s => normalizza(String(s ?? '').replace(/^\s*[`"«]+|[`"»]+\s*$/g, '')).replace(/\s+/g, ' ').trim();
