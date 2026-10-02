// I modelli di «Cosa stampa?». Ogni modello è { id, cosa, concetti, concetto, genera(rng), mutanti }:
// - genera(rng) costruisce un programma C (albero.js) coi numeri presi dal seme;
// - ogni mutante { id, applica(programma), frase(scelta, dati) } è un errore tipico dello studente:
//   l'uscita del programma mutato è un distrattore, e la frase spiega cosa ha sbagliato chi lo sceglie.
// Le risposte le calcola esegui(), non un'AI. test/verifica-c.mjs controlla che il compilatore vero stampi lo stesso.
import { num, car, reale, v, indice, valore, indirizzo, bin, cast, ternario, assegna, incr, chiama, printf, dich, array, espr, blocco, se, mentre, fai, per, scegli, caso, interrompi, continua, ritorna, param, funzione, main, programma, clona, visita, esegui, stampaC, normalizza, ErroreC } from './albero.js';

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
  'c:for': 'Ciclo for', 'c:while': 'Ciclo while', 'c:do-while': 'Ciclo do-while', 'c:ritroso': 'Conteggio a ritroso', 'c:array': 'Array',
  'c:divisione-intera': 'Divisione intera', 'c:resto': 'Resto con i negativi', 'c:cast': 'Cast a double', 'c:incremento': 'i++ e ++i',
  'c:assegnamento': 'Assegnamenti composti (+=)', 'c:switch': 'switch e break', 'c:cortocircuito': '&& e || in cortocircuito',
  'c:else-pendente': 'else pendente', 'c:puntatori': 'Passaggio per indirizzo', 'c:parametri': 'Passaggio per valore',
  'c:visibilita': 'Variabili nei blocchi', 'c:char': 'char e codici ASCII', 'c:ricorsione': 'Ricorsione', 'c:annidati': 'Cicli annidati',
  'c:break-continue': 'break e continue', 'c:ternario': 'Operatore ternario',
};
// i sette errori della spec: quelli che contano in D.codice.errori («Sbagli spesso: …»). Stessi nomi di diario.js
export const MUTANTI = { 'fuori-di-uno': 'fuori di uno', 'divisione-intera': 'divisione intera', 'post-vs-pre': 'i++ e ++i', 'break-dimenticato': 'break dimenticato', 'copia-del-parametro': 'copia del parametro', cortocircuito: 'cortocircuito', 'resto-col-segno': 'resto col segno' };
// tutti gli errori che i modelli sanno riconoscere (i sette, più quelli di argomenti che la spec non nomina)
export const ERRORI = {
  ...MUTANTI, 'piu-uguale': '+= e =', 'maggiore-o-uguale': '> e >=', 'indice-valore': 'indice e valore', sovrascrittura: 'primo e ultimo',
  'else-pendente': 'else pendente', 'variabile-nascosta': 'variabile nascosta', 'carattere-codice': 'carattere e codice', 'caso-base': 'caso base',
  'passo-del-ciclo': 'quando scatta il passo del ciclo',
  ricorsione: 'ricorsione', 'cicli-annidati': 'cicli annidati', 'break-continue': 'break e continue', 'do-while': 'do-while',
  ternario: 'ternario al contrario', 'scambi-in-fila': 'scambi in fila',
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
const hai = s => 'Hai scelto `' + s + '`';
const fila = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, k) => a + k);

/* ---------- i modelli ---------- */
export const MODELLI = [
  {
    id: 'for-minore', cosa: 'questo for', concetti: ['c:for'],
    concetto: 'Con `i < n` l\'ultimo giro ha i = n - 1: il valore n non viene mai stampato.',
    genera(r) {
      const a = tra(r, 0, 3), b = a + tra(r, 3, 6);
      return P({ a, b }, main(
        per(dich('int', ['i', S(num(a), 'inizio')]), S(bin('<', v('i'), num(b)), 'cond'), incr(v('i')), espr(printf('%d ', v('i')))),
        espr(printf('\n'))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '<='; }), frase: (s, d) => `${hai(s)}: è quello che stamperebbe con \`i <= ${d.b}\`. Qui il ciclo si ferma prima.` },
      { id: 'passo-del-ciclo', applica: p => cambia(p, 'inizio', n => { n.v += 1; }), frase: (s, d) => `${hai(s)}: è come se \`i++\` scattasse prima del primo giro. L'incremento arriva alla fine di ogni giro: il primo giro ha i = ${d.a}.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.b.v -= 1; }), frase: (s, d) => `${hai(s)}: ti sei fermato un giro prima. Con \`i < ${d.b}\` l'ultimo giro ha i = ${d.b - 1}.` },
    ],
  },
  {
    id: 'for-passo', cosa: 'questo for', concetti: ['c:for'],
    concetto: 'Con `<=` il ciclo fa anche il giro in cui i è uguale al limite.',
    genera(r) {
      const a = tra(r, 0, 4), s = tra(r, 2, 3), b = a + s * tra(r, 3, 4);
      return P({ a, s, b }, main(
        per(dich('int', ['i', S(num(a), 'inizio')]), S(bin('<=', v('i'), num(b)), 'cond'), assegna(v('i'), '+=', num(s)), espr(printf('%d ', v('i')))),
        espr(printf('\n'))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '<'; }), frase: (s, d) => `${hai(s)}: è quello che stamperebbe con \`i < ${d.b}\`. Con \`<=\` anche ${d.b} viene stampato.` },
      { id: 'passo-del-ciclo', applica: p => cambia(p, 'inizio', n => { n.v += p.dati.s; }), frase: (s, d) => `${hai(s)}: \`i += ${d.s}\` non scatta prima del primo giro. Il primo giro ha i = ${d.a}.` },
    ],
  },
  {
    id: 'for-indietro', cosa: 'questo conto alla rovescia', concetti: ['c:ritroso', 'c:for'],
    concetto: 'Il ciclo gira finché la condizione è vera: con `i > L` il valore L non viene stampato.',
    genera(r) {
      const l = tra(r, 0, 2), n = l + tra(r, 3, 6);
      return P({ l, n }, main(
        per(dich('int', ['i', S(num(n), 'inizio')]), S(bin('>', v('i'), num(l)), 'cond'), incr(v('i'), '--'), espr(printf('%d ', v('i')))),
        espr(printf('\n'))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '>='; }), frase: (s, d) => `${hai(s)}: è quello che stamperebbe con \`i >= ${d.l}\`. Con \`i > ${d.l}\` l'ultimo giro ha i = ${d.l + 1}.` },
      { id: 'passo-del-ciclo', applica: p => cambia(p, 'inizio', n => { n.v -= 1; }), frase: (s, d) => `${hai(s)}: \`i--\` arriva alla fine del giro, non prima. Il primo giro stampa ${d.n}.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.b.v += 1; }), frase: (s, d) => `${hai(s)}: ti sei fermato un giro prima. Anche i = ${d.l + 1} rispetta \`i > ${d.l}\`.` },
    ],
  },
  {
    id: 'while-somma', cosa: 'questo while', concetti: ['c:while'],
    concetto: 'Il while esce quando la condizione diventa falsa: dopo `while (i < n)` la variabile i vale n.',
    genera(r) {
      const n = tra(r, 3, 6);
      return P({ n }, main(
        dich('int', ['i', num(0)], ['s', num(0)]),
        mentre(S(bin('<', v('i'), num(n)), 'cond'), S(blocco(espr(assegna(v('s'), '+=', v('i'))), espr(incr(v('i')))), 'corpo')),
        S(espr(printf('%d %d\n', v('i'), v('s'))), 'stampa')));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '<='; }), frase: (s, d) => `${hai(s)}: è quello che stamperebbe con \`i <= ${d.n}\`. Qui il ciclo fa un giro in meno.` },
      { id: 'passo-del-ciclo', applica: p => cambia(p, 'corpo', n => { n.corpo.reverse(); }), frase: s => `${hai(s)}: è come se \`i++\` venisse prima di \`s += i\`. Qui s somma i e solo dopo i cresce.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'stampa', n => { n.e.arg[1] = bin('-', v('i'), num(1)); }), frase: (s, d) => `${hai(s)}: dopo il ciclo i non vale ${d.n - 1}. Il while esce proprio quando i diventa ${d.n}.` },
    ],
  },
  {
    id: 'while-dimezza', cosa: 'questo while', concetti: ['c:while', 'c:divisione-intera'],
    concetto: 'Tra due int `/` tronca: 7 / 2 fa 3, e dimezzando si arriva a 1 senza virgole.',
    genera(r) {
      let n; do n = tra(r, 9, 60); while ((n & (n - 1)) === 0);
      return P({ n }, main(
        S(dich('int', ['n', num(n)]), 'dn'),
        dich('int', ['k', num(0)]),
        mentre(S(bin('>', v('n'), num(1)), 'cond'), blocco(espr(assegna(v('n'), '/=', num(2))), espr(incr(v('k'))))),
        espr(printf('%d %d\n', v('n'), v('k')))));
    },
    mutanti: [
      { id: 'divisione-intera', applica: p => cambia(p, 'dn', n => { n.tipo = 'double'; }), frase: s => `${hai(s)}: è quello che succederebbe se n fosse un double. n è un int: \`n /= 2\` butta via la parte dopo la virgola.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '>='; }), frase: s => `${hai(s)}: è quello che stamperebbe con \`n >= 1\`. Il ciclo si ferma appena n arriva a 1.` },
    ],
  },
  {
    id: 'while-post', cosa: 'questo while con i++', concetti: ['c:incremento', 'c:while'],
    concetto: '`i++ < n` confronta il valore vecchio e poi incrementa: dentro il ciclo i è già cresciuto.',
    genera(r) {
      const n = tra(r, 3, 6);
      return P({ n }, main(
        dich('int', ['i', num(0)]),
        mentre(bin('<', S(incr(v('i')), 'inc'), num(n)), S(espr(printf('%d ', v('i'))), 'stampa')),
        S(espr(printf('| %d\n', v('i'))), 'fine')));
    },
    mutanti: [
      { id: 'post-vs-pre', applica: p => cambia(p, 'inc', n => { n.pre = true; }), frase: s => `${hai(s)}: è quello che stamperebbe con \`++i\`. Con \`i++\` il confronto usa il valore di prima.` },
      { id: 'post-vs-pre', applica: p => cambia(p, 'stampa', n => { n.e.arg[1] = bin('-', v('i'), num(1)); }), frase: s => `${hai(s)}: quando printf parte, i è già stato incrementato dal confronto.` },
      { id: 'post-vs-pre', applica: p => cambia(p, 'fine', n => { n.e.arg[1] = bin('-', v('i'), num(1)); }), frase: (s, d) => `${hai(s)}: anche l'ultimo confronto, quello falso, incrementa i. Alla fine i vale ${d.n + 1}.` },
    ],
  },
  {
    id: 'array-somma', cosa: 'questa somma', concetti: ['c:array'],
    concetto: 'Gli indici di un array di n elementi vanno da 0 a n - 1.',
    genera(r) {
      const k = tra(r, 4, 6), xs = Array.from({ length: k }, () => tra(r, 1, 9));
      return P({ k, xs }, main(
        array('int', 'v', xs), dich('int', ['s', num(0)]),
        per(dich('int', ['i', S(num(0), 'inizio')]), S(bin('<', v('i'), num(k)), 'cond'), incr(v('i')), S(espr(assegna(v('s'), '+=', indice(v('v'), v('i')))), 'acc')),
        espr(printf('%d\n', v('s')))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'inizio', n => { n.v = 1; }), frase: s => `${hai(s)}: hai saltato \`v[0]\`. Il primo elemento ha indice 0.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.b.v -= 1; }), frase: (s, d) => `${hai(s)}: hai lasciato fuori l'ultimo. Con \`i < ${d.k}\` l'ultimo giro legge \`v[${d.k - 1}]\`.` },
      { id: 'piu-uguale', applica: p => cambia(p, 'acc', n => { n.e.op = '='; }), frase: s => `${hai(s)}: è l'ultimo elemento, come se ci fosse \`s = v[i]\`. \`+=\` aggiunge, non sostituisce.` },
    ],
  },
  {
    id: 'array-massimo', cosa: 'questo massimo', concetti: ['c:array'],
    concetto: 'p è un indice: conta da 0. Con `>` resta la prima posizione del massimo.',
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
      { id: 'fuori-di-uno', applica: p => cambia(p, 'stampa', n => { n.e.arg[2] = bin('+', v('p'), num(1)); }), frase: s => `${hai(s)}: hai contato le posizioni da 1. In C il primo elemento ha indice 0.` },
      { id: 'maggiore-o-uguale', applica: p => cambia(p, 'cmp', n => { n.op = '>='; }), frase: s => `${hai(s)}: è quello che farebbe \`>=\`. Con \`>\` un massimo uguale non sposta p: resta il primo.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.b.v -= 1; }), frase: s => `${hai(s)}: hai lasciato fuori l'ultimo elemento. Anche lui viene confrontato.` },
    ],
  },
  {
    id: 'array-ultimo', cosa: 'questa ricerca', concetti: ['c:array'],
    concetto: 'Il ciclo non si ferma quando trova x: p viene sovrascritto e resta l\'ultima posizione.',
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
      { id: 'sovrascrittura', applica: p => cambia(p, 'trova', n => blocco({ ...n, segno: undefined }, interrompi())), frase: s => `${hai(s)}: è la prima posizione. Il ciclo non si ferma: ogni volta che trova x riscrive p.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'stampa', n => { n.e.arg[1] = bin('+', v('p'), num(1)); }), frase: s => `${hai(s)}: hai contato le posizioni da 1. In C il primo elemento ha indice 0.` },
      { id: 'indice-valore', applica: p => cambia(p, 'stampa', n => { n.e.arg[1] = num(p.dati.x); }), frase: s => `${hai(s)}: è il valore cercato, non la sua posizione. p è un indice.` },
    ],
  },
  {
    id: 'media-array', cosa: 'questa media', concetti: ['c:divisione-intera', 'c:cast'],
    concetto: '`s / n` tra int tronca. `(double)s / n` converte prima e divide con la virgola.',
    genera(r) {
      const k = uno(r, [3, 4, 5, 6, 7]), xs = Array.from({ length: k }, () => tra(r, 1, 9));
      if (xs.reduce((a, b) => a + b, 0) % k === 0) xs[0] = xs[0] === 9 ? 8 : xs[0] + 1;
      return P({ k, xs }, main(
        array('int', 'v', xs), dich('int', ['s', num(0)]),
        per(dich('int', ['i', num(0)]), bin('<', v('i'), num(k)), incr(v('i')), espr(assegna(v('s'), '+=', indice(v('v'), v('i'))))),
        espr(printf('%d %.2f\n', S(bin('/', v('s'), num(k)), 'd1'), S(bin('/', cast('double', v('s')), num(k)), 'd2')))));
    },
    mutanti: [
      { id: 'divisione-intera', applica: p => cambia(p, 'd1', n => { n.modo = 'reale'; }), frase: (s, d) => `${hai(s)}: \`s / ${d.k}\` è una divisione tra due int: la parte dopo la virgola si perde.` },
      { id: 'divisione-intera', applica: p => cambia(p, 'd2', n => cast('double', bin('/', v('s'), num(p.dati.k)))), frase: s => `${hai(s)}: il cast \`(double)s\` avviene prima della divisione, quindi la divisione tiene la virgola.` },
      { id: 'divisione-intera', applica: p => cambia(p, 'd1', n => { n.modo = 'arrotondata'; }), frase: s => `${hai(s)}: la divisione tra int non arrotonda, tronca.` },
    ],
  },
  {
    id: 'divisione-double', cosa: 'questa divisione', concetti: ['c:divisione-intera'],
    concetto: 'Il tipo del risultato non conta: `a / b` tra int tronca anche se finisce in un double.',
    genera(r) {
      const b = uno(r, [3, 5, 6, 7, 9]); let a; do a = tra(r, b + 1, 6 * b); while (a % b <= b / 2);
      return P({ a, b }, main(
        dich('int', ['a', num(a)], ['b', num(b)]),
        dich('double', ['m', S(bin('/', v('a'), v('b')), 'div')]),
        espr(printf('%.1f\n', v('m')))));
    },
    mutanti: [
      { id: 'divisione-intera', applica: p => cambia(p, 'div', n => { n.modo = 'reale'; }), frase: s => `${hai(s)}: \`a / b\` si calcola tra int, prima di finire in m. Il double riceve un numero già troncato.` },
      { id: 'divisione-intera', applica: p => cambia(p, 'div', n => { n.modo = 'arrotondata'; }), frase: s => `${hai(s)}: la divisione tra int non arrotonda, tronca verso lo zero.` },
    ],
  },
  {
    id: 'cast-prima-dopo', cosa: 'questi due cast', concetti: ['c:cast', 'c:divisione-intera'],
    concetto: '`(double)(s / n)` divide tra int e poi converte. `(double)s / n` converte e poi divide.',
    genera(r) {
      const n = uno(r, [2, 3, 4, 5]); let s; do s = tra(r, n + 1, 9 * n); while (s % n === 0);
      return P({ s, n }, main(
        dich('int', ['s', num(s)], ['n', num(n)]),
        espr(printf('%.2f %.2f\n', S(cast('double', bin('/', v('s'), v('n'))), 'c1'), S(bin('/', cast('double', v('s')), v('n')), 'c2')))));
    },
    mutanti: [
      { id: 'divisione-intera', applica: p => cambia(p, 'c1', () => bin('/', cast('double', v('s')), v('n'))), frase: s => `${hai(s)}: in \`(double)(s / n)\` le parentesi fanno dividere prima, tra int. Il cast arriva dopo.` },
      { id: 'divisione-intera', applica: p => cambia(p, 'c2', () => cast('double', bin('/', v('s'), v('n')))), frase: s => `${hai(s)}: in \`(double)s / n\` il cast vale solo per s, e la divisione tiene la virgola.` },
      { id: 'divisione-intera', applica: p => cambiaTutti(p, ['c1', () => bin('/', cast('double', v('s')), v('n'))], ['c2', () => cast('double', bin('/', v('s'), v('n')))]), frase: s => `${hai(s)}: li hai scambiati. Le parentesi decidono se il cast arriva prima o dopo la divisione.` },
    ],
  },
  {
    id: 'diviso-due', cosa: 'questa divisione per 2', concetti: ['c:divisione-intera'],
    concetto: 'Basta un double nel conto: `a / 2.0` tiene la virgola, `a / 2` no.',
    genera(r) {
      const a = 2 * tra(r, 2, 12) + 1;
      return P({ a }, main(
        dich('int', ['a', num(a)]),
        espr(printf('%d %.1f\n', S(bin('/', v('a'), num(2)), 'd1'), S(bin('/', v('a'), reale(2)), 'd2')))));
    },
    mutanti: [
      { id: 'divisione-intera', applica: p => cambia(p, 'd1', n => { n.modo = 'reale'; }), frase: s => `${hai(s)}: \`a / 2\` è tra due int: tronca e dà un int, che %d stampa senza virgola.` },
      { id: 'divisione-intera', applica: p => cambia(p, 'd2', n => { n.b = num(2); }), frase: s => `${hai(s)}: \`2.0\` è un double, quindi \`a / 2.0\` tiene la virgola.` },
      { id: 'divisione-intera', applica: p => cambia(p, 'd1', n => { n.modo = 'arrotondata'; }), frase: s => `${hai(s)}: \`a / 2\` non arrotonda: tronca verso lo zero.` },
    ],
  },
  {
    id: 'resto-negativi', cosa: 'questo resto', concetti: ['c:resto'],
    concetto: 'In C la divisione tronca verso lo zero e il resto ha il segno del dividendo: -7 % 3 fa -1.',
    genera(r) {
      const segni = uno(r, [[-1, 1], [-1, 1], [1, -1]]), b0 = tra(r, 2, 5); let a0; do a0 = tra(r, b0 + 1, 20); while (a0 % b0 === 0);
      const a = segni[0] * a0, b = segni[1] * b0;
      return P({ a, b }, main(
        dich('int', ['a', num(a)], ['b', num(b)]),
        espr(printf('%d %d\n', S(bin('/', v('a'), v('b')), 'div'), S(bin('%', v('a'), v('b')), 'mod')))));
    },
    mutanti: [
      { id: 'resto-col-segno', applica: p => cambiaTutti(p, ['div', n => { n.modo = 'pavimento'; }], ['mod', n => { n.modo = 'divisore'; }]), frase: s => `${hai(s)}: così fa Python, che arrotonda verso il basso. Il C tronca verso lo zero.` },
      { id: 'resto-col-segno', applica: p => cambia(p, 'mod', n => { n.modo = 'matematico'; }), frase: s => `${hai(s)}: in C il resto non è sempre positivo. Ha il segno del dividendo, cioè di a.` },
      { id: 'divisione-intera', applica: p => cambia(p, 'div', n => { n.modo = 'pavimento'; }), frase: s => `${hai(s)}: la divisione tra int tronca verso lo zero, non verso il basso.` },
    ],
  },
  {
    id: 'post-pre', cosa: 'questi incrementi', concetti: ['c:incremento'],
    // il concetto segue il segno del seme: con i-- e --i si parla di decremento
    concetto: d => d.op === '--' ? '`x = i--` usa il valore di prima e poi decrementa; `y = --i` decrementa e poi usa il valore nuovo.'
      : '`x = i++` usa il valore di prima e poi incrementa; `y = ++i` incrementa e poi usa il valore nuovo.',
    genera(r) {
      const a = tra(r, 1, 9), op = uno(r, ['++', '--']);
      return P({ a, op }, main(
        dich('int', ['i', num(a)]),
        dich('int', ['x', S(incr(v('i'), op, false), 'x')]),
        dich('int', ['y', S(incr(v('i'), op, true), 'y')]),
        espr(printf('%d %d %d\n', v('x'), v('y'), v('i')))));
    },
    mutanti: [
      { id: 'post-vs-pre', applica: p => cambia(p, 'x', n => { n.pre = true; }), frase: (s, d) => `${hai(s)}: con \`x = i${d.op}\` x prende il valore di prima, poi i cambia.` },
      { id: 'post-vs-pre', applica: p => cambia(p, 'y', n => { n.pre = false; }), frase: (s, d) => `${hai(s)}: con \`y = ${d.op}i\` prima cambia i, poi y prende il valore nuovo.` },
      { id: 'post-vs-pre', applica: p => cambiaTutti(p, ['x', n => { n.pre = true; }], ['y', n => { n.pre = false; }]), frase: (s, d) => `${hai(s)}: li hai scambiati. Il segno dopo (\`i${d.op}\`) usa il valore di prima, quello prima (\`${d.op}i\`) il valore nuovo.` },
    ],
  },
  {
    id: 'piu-uguale', cosa: 'questo +=', concetti: ['c:assegnamento', 'c:for'],
    concetto: '`s += x` vuol dire `s = s + x`: aggiunge al valore che c\'era.',
    genera(r) {
      const a = tra(r, 1, 5), n = tra(r, 3, 5), k = tra(r, 2, 4);
      return P({ a, n, k }, main(
        dich('int', ['s', S(num(a), 's0')]),
        per(dich('int', ['i', num(1)]), S(bin('<=', v('i'), num(n)), 'cond'), incr(v('i')), S(espr(assegna(v('s'), '+=', bin('*', v('i'), num(k)))), 'acc')),
        espr(printf('%d\n', v('s')))));
    },
    mutanti: [
      { id: 'piu-uguale', applica: p => cambia(p, 'acc', n => { n.e.op = '='; }), frase: s => `${hai(s)}: è solo l'ultimo giro, come se ci fosse \`=\`. \`+=\` aggiunge ogni volta.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '<'; }), frase: (s, d) => `${hai(s)}: con \`<=\` anche i = ${d.n} fa il suo giro.` },
      { id: 'piu-uguale', applica: p => cambia(p, 's0', n => { n.v = 0; }), frase: (s, d) => `${hai(s)}: hai dimenticato il valore iniziale. s parte da ${d.a}.` },
    ],
  },
  {
    id: 'switch', cosa: 'questo switch', concetti: ['c:switch'],
    concetto: 'Senza break l\'esecuzione cade nel case sotto e continua fino al primo break o alla fine.',
    genera(r) {
      const parole = ['uno', 'due', 'tre', 'quattro'];
      let rompe; do rompe = parole.map(() => r() < .4); while (rompe.every(Boolean) || !rompe.some(Boolean));
      // di solito x cade in un case senza break, e più sotto un break lo ferma
      const buoni = fila(1, 4).filter(k => !rompe[k - 1] && rompe.slice(k).some(Boolean));
      const x = buoni.length && r() < .8 ? uno(r, buoni) : tra(r, 1, 5);
      const casi = parole.map((w, k) => caso(k + 1, espr(printf(w + ' ')), ...(rompe[k] ? [interrompi()] : [])));
      return P({ x, rompe }, main(
        dich('int', ['x', num(x)]),
        S(scegli(v('x'), ...casi, caso(null, espr(printf('altro ')))), 'sw'),
        espr(printf('\n'))));
    },
    mutanti: [
      { id: 'break-dimenticato', applica: p => cambia(p, 'sw', n => { for (const c of n.casi) if (!c.corpo.some(x => x.t === 'interrompi')) c.corpo.push(interrompi()); }), frase: s => `${hai(s)}: è come se ogni case avesse il suo break. Senza break si continua nel case sotto.` },
      { id: 'break-dimenticato', applica: p => cambia(p, 'sw', n => { for (const c of n.casi) c.corpo = c.corpo.filter(x => x.t !== 'interrompi'); }), frase: s => `${hai(s)}: hai saltato il break. Lì lo switch si ferma.` },
      { id: 'break-dimenticato', applica: p => cambia(p, 'sw', n => { const d = clona(n.casi.at(-1).corpo); for (const c of n.casi) if (!c.corpo.some(x => x.t === 'interrompi')) c.corpo.push(interrompi()); return blocco({ ...n, segno: undefined }, ...d); }), frase: s => `${hai(s)}: default non parte sempre. Parte se nessun case corrisponde, o se ci arrivi cadendo da un case senza break.` },
    ],
  },
  {
    id: 'cortocircuito', cosa: 'questo if con || e &&', concetti: ['c:cortocircuito'],
    concetto: 'Se il primo pezzo basta a decidere (vero con ||, falso con &&), il secondo non viene eseguito.',
    genera(r) {
      const o = r() < .5, a = o ? tra(r, 1, 9) : tra(r, -9, 0);
      const cond = o ? bin('||', bin('>', v('a'), num(0)), bin('>', incr(v('n'), '++', true), num(1)))
        : bin('&&', bin('>', v('a'), num(0)), bin('>', incr(v('n'), '++', true), num(0)));
      return P({ a, op: o ? '||' : '&&' }, main(
        dich('int', ['a', num(a)], ['n', num(0)]),
        se(S(cond, 'cond'), espr(printf('si ')), espr(printf('no '))),
        espr(printf('%d\n', v('n')))));
    },
    mutanti: [
      { id: 'cortocircuito', applica: p => cambia(p, 'cond', n => { n.modo = 'entrambi'; }), frase: (s, d) => `${hai(s)}: \`++n\` non viene eseguito. Con \`${d.op}\` il primo pezzo basta già a decidere, e n resta 0.` },
      { id: 'cortocircuito', applica: p => cambia(p, 'cond', n => { n.op = n.op === '||' ? '&&' : '||'; }), frase: (s, d) => `${hai(s)}: hai letto \`${d.op === '||' ? '&&' : '||'}\`. ${d.op === '||' ? '|| vuole vero almeno un pezzo' : '&& vuole veri tutti e due i pezzi'}.` },
    ],
  },
  {
    id: 'else-pendente', cosa: 'questo else', concetti: ['c:else-pendente'],
    concetto: 'L\'else va con l\'if più vicino che non ha già un else, qualunque sia il rientro.',
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
      { id: 'else-pendente', applica: p => cambia(p, 'fuori', n => { n.altrimenti = n.allora.altrimenti; n.allora.altrimenti = null; }), frase: (s, d) => `${hai(s)}: hai seguito il rientro. Ma l'else va con l'if più vicino, \`if (i > ${d.t})\`.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op = '<='; }), frase: (s, d) => `${hai(s)}: con \`i < ${d.n}\` l'ultimo giro ha i = ${d.n - 1}.` },
    ],
  },
  {
    id: 'swap-valore', cosa: 'questo scambio', concetti: ['c:parametri'],
    concetto: 'Una funzione riceve copie dei valori: scambiare a e b non tocca x e y.',
    genera(r) {
      const x = tra(r, 1, 9); let y; do y = tra(r, 1, 9); while (y === x);
      return P({ x, y }, funzione('void', 'scambia', [param('int', 'a'), param('int', 'b')],
        dich('int', ['t', v('a')]), espr(assegna(v('a'), '=', v('b'))), espr(assegna(v('b'), '=', v('t'))), espr(printf('%d %d\n', v('a'), v('b')))),
      main(dich('int', ['x', num(x)], ['y', num(y)]), espr(chiama('scambia', v('x'), v('y'))), espr(printf('%d %d\n', v('x'), v('y')))));
    },
    mutanti: [
      { id: 'copia-del-parametro', applica: p => soloUscita(`${p.dati.y} ${p.dati.x}\n${p.dati.y} ${p.dati.x}\n`), frase: s => `${hai(s)}: a e b sono copie di x e y. Lo scambio resta dentro la funzione.` },
      { id: 'copia-del-parametro', applica: p => soloUscita(`${p.dati.x} ${p.dati.y}\n${p.dati.x} ${p.dati.y}\n`), frase: s => `${hai(s)}: dentro la funzione lo scambio avviene davvero. Sono le copie a scambiarsi, non x e y.` },
    ],
  },
  {
    id: 'swap-indirizzo', cosa: 'questi scambi con i puntatori', concetti: ['c:puntatori'],
    concetto: 'Con `&x` la funzione riceve l\'indirizzo: `*a = …` cambia proprio x. Gli scambi avvengono uno dopo l\'altro.',
    genera(r) {
      const [x, y, z] = mescola(r, fila(1, 9)).slice(0, 3);
      return P({ x, y, z }, funzione('void', 'scambia', [param('int', 'a', '*'), param('int', 'b', '*')],
        dich('int', ['t', valore(v('a'))]), espr(assegna(valore(v('a')), '=', valore(v('b')))), espr(assegna(valore(v('b')), '=', v('t')))),
      main(dich('int', ['x', num(x)], ['y', num(y)], ['z', num(z)]),
        espr(chiama('scambia', indirizzo(v('x')), indirizzo(v('y')))), espr(chiama('scambia', indirizzo(v('y')), indirizzo(v('z')))),
        espr(printf('%d %d %d\n', v('x'), v('y'), v('z')))));
    },
    mutanti: [
      { id: 'copia-del-parametro', applica: p => soloUscita(`${p.dati.x} ${p.dati.y} ${p.dati.z}\n`), frase: s => `${hai(s)}: qui non sono copie. \`&x\` passa l'indirizzo, e \`*a\` scrive proprio in x.` },
      { id: 'scambi-in-fila', applica: p => soloUscita(`${p.dati.z} ${p.dati.x} ${p.dati.y}\n`), frase: s => `${hai(s)}: gli scambi vanno in ordine. Prima x con y, poi la y nuova con z.` },
      { id: 'scambi-in-fila', applica: p => soloUscita(`${p.dati.y} ${p.dati.z} ${p.dati.y}\n`), frase: s => `${hai(s)}: il secondo scambio vede la y già cambiata dal primo.` },
    ],
  },
  {
    id: 'valore-e-indirizzo', cosa: 'questa funzione', concetti: ['c:puntatori', 'c:parametri'],
    concetto: 'a è una copia di x; b è l\'indirizzo di y: solo `*b = …` cambia la variabile di main.',
    genera(r) {
      const x = tra(r, 1, 9), y = tra(r, 1, 9), k = tra(r, 2, 3), nome = k === 2 ? 'raddoppia' : 'triplica';
      return P({ x, y, k }, funzione('void', nome, [param('int', 'a'), param('int', 'b', '*')],
        espr(assegna(v('a'), '=', bin('*', v('a'), num(k)))), espr(assegna(valore(v('b')), '=', bin('*', valore(v('b')), num(k)))), espr(printf('%d %d\n', v('a'), valore(v('b'))))),
      main(dich('int', ['x', num(x)], ['y', num(y)]), espr(chiama(nome, v('x'), indirizzo(v('y')))), espr(printf('%d %d\n', v('x'), v('y')))));
    },
    mutanti: [
      { id: 'copia-del-parametro', applica: p => { const { x, y, k } = p.dati; return soloUscita(`${x * k} ${y * k}\n${x * k} ${y * k}\n`); }, frase: s => `${hai(s)}: a è una copia di x. Cambiare a non cambia x.` },
      { id: 'copia-del-parametro', applica: p => { const { x, y, k } = p.dati; return soloUscita(`${x * k} ${y * k}\n${x} ${y}\n`); }, frase: s => `${hai(s)}: b non è una copia, è l'indirizzo di y. \`*b = …\` cambia y.` },
    ],
  },
  {
    id: 'array-in-funzione', cosa: 'questo array passato a una funzione', concetti: ['c:array', 'c:parametri'],
    concetto: 'Un array passa per indirizzo: la funzione cambia proprio a. Un int invece passa come copia.',
    genera(r) {
      const k = tra(r, 2, 3), xs = Array.from({ length: 3 }, () => tra(r, 1, 9));
      return P({ k, xs }, funzione('void', 'moltiplica', [param('int', 'v', '[]'), param('int', 'n')],
        mentre(bin('>', v('n'), num(0)), blocco(espr(incr(v('n'), '--')), espr(assegna(indice(v('v'), v('n')), '*=', num(k)))))),
      main(array('int', 'a', xs), dich('int', ['n', num(3)]), espr(chiama('moltiplica', v('a'), v('n'))),
        espr(printf('%d %d %d %d\n', indice(v('a'), num(0)), indice(v('a'), num(1)), indice(v('a'), num(2)), v('n')))));
    },
    mutanti: [
      { id: 'copia-del-parametro', applica: p => soloUscita(`${p.dati.xs.join(' ')} 3\n`), frase: s => `${hai(s)}: un array non viene copiato. La funzione lavora sugli stessi elementi di a.` },
      { id: 'copia-del-parametro', applica: p => soloUscita(`${p.dati.xs.map(x => x * p.dati.k).join(' ')} 0\n`), frase: s => `${hai(s)}: n invece è una copia. Il \`n--\` della funzione non tocca la n di main.` },
    ],
  },
  {
    id: 'blocco-ombra', cosa: 'queste due x', concetti: ['c:visibilita'],
    concetto: 'La x dichiarata nel blocco è un\'altra variabile: nasconde quella di fuori e sparisce alla }.',
    genera(r) {
      const a = tra(r, 1, 9), b = tra(r, 10, 20);
      return P({ a, b }, main(
        dich('int', ['x', num(a)], ['y', num(0)]),
        blocco(dich('int', ['x', num(b)]), espr(assegna(v('y'), '=', bin('+', v('x'), num(1)))), espr(assegna(v('x'), '=', bin('*', v('x'), num(2)))), espr(printf('%d ', v('x')))),
        espr(printf('%d %d\n', v('x'), v('y')))));
    },
    mutanti: [
      { id: 'variabile-nascosta', applica: p => { const { b } = p.dati; return soloUscita(`${2 * b} ${2 * b} ${b + 1}\n`); }, frase: (s, d) => `${hai(s)}: \`int x = ${d.b}\` dentro le graffe crea una x nuova. Fuori la x vale ancora ${d.a}.` },
      { id: 'variabile-nascosta', applica: p => { const { a, b } = p.dati; return soloUscita(`${2 * b} ${a} ${a + 1}\n`); }, frase: s => `${hai(s)}: dentro il blocco la x più vicina è quella interna. y la usa.` },
    ],
  },
  {
    id: 'char-ascii', cosa: 'questi char', concetti: ['c:char'],
    concetto: 'Un char è un numero: \'a\' vale 97. %c stampa la lettera, %d il codice. Maiuscola = minuscola - 32.',
    genera(r) {
      const k = tra(r, 1, 20);
      return P({ k }, main(
        dich('char', ['c', bin('+', car('a'), num(k))]),
        dich('char', ['d', bin('-', v('c'), num(32))]),
        S(espr(printf('%c %d %c\n', v('c'), v('c'), v('d'))), 'stampa')));
    },
    mutanti: [
      { id: 'carattere-codice', applica: p => cambia(p, 'stampa', n => { n.e.arg[2] = bin('+', bin('-', v('c'), car('a')), num(1)); }), frase: s => `${hai(s)}: %d non dà la posizione nell'alfabeto. Dà il codice ASCII: 'a' vale 97.` },
      { id: 'carattere-codice', applica: p => cambia(p, 'stampa', n => { n.e.arg[0].v = '%c %c %c\n'; }), frase: s => `${hai(s)}: %d stampa il numero del carattere, non la lettera.` },
      { id: 'carattere-codice', applica: p => cambia(p, 'stampa', n => { n.e.arg[0].v = '%c %d %d\n'; }), frase: s => `${hai(s)}: d è un char e %c lo stampa come lettera, la maiuscola.` },
    ],
  },
  {
    id: 'fattoriale', cosa: 'questa ricorsione', concetti: ['c:ricorsione'],
    concetto: 'fatt(n) = n · fatt(n - 1), e il caso base ferma la discesa a 1.',
    genera(r) {
      const n = tra(r, 3, 7);
      return P({ n }, funzione('int', 'fatt', [param('int', 'n')],
        se(bin('<=', v('n'), num(1)), ritorna(num(1))),
        ritorna(bin('*', v('n'), chiama('fatt', bin('-', v('n'), num(1)))))),
      main(espr(printf('%d\n', S(chiama('fatt', num(n)), 'chiama')))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'chiama', n => { n.arg[0].v -= 1; }), frase: (s, d) => `${hai(s)}: è fatt(${d.n - 1}). Hai fatto un passo in meno: si moltiplica da ${d.n} fino a 1.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'chiama', n => { n.arg[0].v += 1; }), frase: (s, d) => `${hai(s)}: è fatt(${d.n + 1}). Hai fatto un passo in più: si parte da ${d.n}.` },
      { id: 'ricorsione', applica: p => soloUscita(`${p.dati.n * (p.dati.n - 1)}\n`), frase: s => `${hai(s)}: ti sei fermato alla prima chiamata. fatt(n - 1) continua a chiamarsi fino al caso base.` },
    ],
  },
  {
    id: 'somma-cifre', cosa: 'questa ricorsione', concetti: ['c:ricorsione'],
    concetto: 'n % 10 è l\'ultima cifra, n / 10 toglie l\'ultima cifra. Il caso base restituisce la cifra che resta.',
    genera(r) {
      const cifre = Array.from({ length: tra(r, 3, 4) }, () => tra(r, 1, 9)), n = +cifre.join('');
      return P({ n, cifre }, funzione('int', 'cifre', [param('int', 'n')],
        se(bin('<', v('n'), num(10)), S(ritorna(v('n')), 'base')),
        ritorna(bin('+', bin('%', v('n'), num(10)), chiama('cifre', bin('/', v('n'), num(10)))))),
      main(espr(printf('%d\n', chiama('cifre', num(n))))));
    },
    mutanti: [
      { id: 'caso-base', applica: p => cambia(p, 'base', n => { n.e = num(0); }), frase: s => `${hai(s)}: hai perso la prima cifra. Il caso base restituisce n, non 0.` },
      { id: 'ricorsione', applica: p => soloUscita(`${p.dati.cifre.length}\n`), frase: s => `${hai(s)}: è il numero delle cifre. Qui ogni chiamata aggiunge \`n % 10\`, la cifra, non 1.` },
      { id: 'ricorsione', applica: p => soloUscita(`${p.dati.n % 10}\n`), frase: s => `${hai(s)}: è solo l'ultima cifra. Il valore di ritorno si somma a quello della chiamata dopo.` },
    ],
  },
  {
    id: 'ricorsione-ordine', cosa: 'questa ricorsione', concetti: ['c:ricorsione'],
    concetto: 'printf viene dopo la chiamata: si stampa al ritorno, quindi dal più piccolo al più grande.',
    genera(r) {
      const n = tra(r, 3, 6);
      return P({ n }, funzione('void', 'conta', [param('int', 'n')],
        se(bin('==', v('n'), num(0)), ritorna()),
        espr(chiama('conta', bin('-', v('n'), num(1)))),
        espr(printf('%d ', v('n')))),
      main(espr(chiama('conta', num(n))), espr(printf('\n'))));
    },
    mutanti: [
      { id: 'ricorsione', applica: p => soloUscita(fila(1, p.dati.n).reverse().join(' ') + '\n'), frase: s => `${hai(s)}: sarebbe così con printf prima della chiamata. Qui si stampa al ritorno.` },
      { id: 'caso-base', applica: p => soloUscita(fila(0, p.dati.n).join(' ') + '\n'), frase: s => `${hai(s)}: con n = 0 la funzione esce subito, senza stampare.` },
    ],
  },
  {
    id: 'annidati-conta', cosa: 'questi cicli annidati', concetti: ['c:annidati'],
    concetto: 'Il ciclo interno riparte a ogni giro di quello esterno: qui gira i volte, cioè 0, 1, 2, …',
    genera(r) {
      const n = tra(r, 3, 6);
      return P({ n }, main(
        dich('int', ['c', num(0)]),
        per(dich('int', ['i', num(0)]), bin('<', v('i'), num(n)), incr(v('i')),
          per(dich('int', ['j', num(0)]), S(bin('<', v('j'), v('i')), 'jc'), incr(v('j')), espr(incr(v('c'))))),
        espr(printf('%d\n', v('c')))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'jc', n => { n.op = '<='; }), frase: s => `${hai(s)}: è quello che darebbe \`j <= i\`. Con \`j < i\` il primo giro (i = 0) non conta niente.` },
      { id: 'cicli-annidati', applica: p => cambia(p, 'jc', n => { n.b = num(p.dati.n); }), frase: (s, d) => `${hai(s)}: il ciclo interno non gira sempre ${d.n} volte: gira i volte.` },
    ],
  },
  {
    id: 'annidati-stelle', cosa: 'queste stelle', concetti: ['c:annidati'],
    concetto: 'Per ogni riga i il ciclo interno stampa i simboli, poi `\\n` va a capo.',
    genera(r) {
      const n = tra(r, 3, 4), x = uno(r, ['*', '#']);
      return P({ n, x }, main(
        per(dich('int', ['i', num(1)]), S(bin('<=', v('i'), num(n)), 'ic'), incr(v('i')), blocco(
          per(dich('int', ['j', num(0)]), S(bin('<', v('j'), v('i')), 'jc'), incr(v('j')), espr(printf(x))),
          espr(printf('\n'))))));
    },
    mutanti: [
      { id: 'fuori-di-uno', applica: p => cambia(p, 'jc', n => { n.op = '<='; }), frase: s => `${hai(s)}: un simbolo in più per riga. j parte da 0 e con \`j < i\` fa i giri.` },
      { id: 'cicli-annidati', applica: p => cambia(p, 'jc', n => { n.b = num(p.dati.n); }), frase: (s, d) => `${hai(s)}: il ciclo interno dipende da i: non stampa sempre ${d.n} simboli.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'ic', n => { n.op = '<'; }), frase: (s, d) => `${hai(s)}: manca l'ultima riga. Con \`i <= ${d.n}\` anche la riga ${d.n} viene stampata.` },
    ],
  },
  {
    id: 'break-continue', cosa: 'questo break e questo continue', concetti: ['c:break-continue'],
    concetto: '`continue` salta al giro dopo; `break` esce dal ciclo, e il printf di quel giro non arriva.',
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
      { id: 'break-continue', applica: p => cambia(p, 'cont', () => interrompi()), frase: (s, d) => `${hai(s)}: \`continue\` non esce dal ciclo: salta solo il giro con i = ${d.a}.` },
      { id: 'break-continue', applica: p => cambia(p, 'brk', () => continua()), frase: (s, d) => `${hai(s)}: \`break\` non salta un giro: esce dal ciclo quando i vale ${d.b}.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'brk', () => blocco(espr(printf('%d ', v('i'))), interrompi())), frase: (s, d) => `${hai(s)}: il break arriva prima del printf: ${d.b} non viene stampato.` },
    ],
  },
  {
    id: 'do-while', cosa: 'questo do-while', concetti: ['c:do-while'],
    concetto: 'Il do-while controlla la condizione alla fine di ogni giro: il corpo gira sempre almeno una volta.',
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
      { id: 'do-while', applica: p => cambia(p, 'ciclo', n => mentre(n.c, n.corpo)), frase: s => `${hai(s)}: è quello che farebbe un while. Il do-while esegue il corpo prima di controllare.` },
      { id: 'do-while', applica: p => cambia(p, 'ciclo', n => blocco(clona(n.corpo), { ...n, segno: undefined })), frase: (s, d) => `${hai(s)}: un giro di troppo. ${d.vero ? 'Il do-while non aggiunge un giro: controlla la condizione alla fine di ogni giro.' : 'Dopo il primo giro la condizione è già falsa.'}` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'cond', n => { n.op += '='; }), frase: (s, d) => `${hai(s)}: è quello che darebbe \`i ${d.op}= ${d.b}\`. Con \`i ${d.op} ${d.b}\`, quando i arriva a ${d.b} il ciclo si ferma.` },
      { id: 'fuori-di-uno', applica: p => cambia(p, 'stampa', n => { n.e.arg[2] = bin(p.dati.op === '<' ? '-' : '+', v('i'), num(p.dati.s)); }), frase: s => `${hai(s)}: hai stampato i com'era prima dell'ultimo giro. Anche l'ultimo giro cambia i: il controllo arriva dopo.` },
    ],
  },
  {
    id: 'ternario', cosa: 'questi ternari', concetti: ['c:ternario'],
    concetto: '`c ? x : y` vale x se c è vera, y se è falsa.',
    genera(r) {
      const a = tra(r, 1, 20); let b; do b = tra(r, 1, 20); while (b === a);
      return P({ a, b }, main(
        dich('int', ['a', num(a)], ['b', num(b)]),
        dich('int', ['m', S(ternario(bin('>', v('a'), v('b')), v('a'), v('b')), 't1')]),
        dich('int', ['d', S(ternario(bin('<', v('a'), v('b')), bin('-', v('b'), v('a')), bin('-', v('a'), v('b'))), 't2')]),
        espr(printf('%d %d\n', v('m'), v('d')))));
    },
    mutanti: [
      { id: 'ternario', applica: p => cambia(p, 't1', n => { [n.a, n.b] = [n.b, n.a]; }), frase: (s, d) => `${hai(s)}: per m hai preso il ramo sbagliato. \`a > b\` è ${d.a > d.b ? 'vera, quindi vale quello dopo `?`' : 'falsa, quindi vale quello dopo `:`'}.` },
      { id: 'ternario', applica: p => cambia(p, 't2', n => { [n.a, n.b] = [n.b, n.a]; }), frase: (s, d) => `${hai(s)}: per d hai preso il ramo sbagliato. \`a < b\` è ${d.a < d.b ? 'vera, quindi vale quello dopo `?`' : 'falsa, quindi vale quello dopo `:`'}.` },
      { id: 'ternario', applica: p => cambiaTutti(p, ['t1', n => { [n.a, n.b] = [n.b, n.a]; }], ['t2', n => { [n.a, n.b] = [n.b, n.a]; }]), frase: s => `${hai(s)}: hai letto i due ternari al contrario. Vero → il valore dopo \`?\`.` },
    ],
  },
];
export const modello = id => MODELLI.find(m => m.id === id) || null;

/* ---------- una domanda pronta ---------- */
// il testo di un'uscita da mostrare: com'è, oppure «(niente)»; in linea le righe si separano con ⏎
export const vista = u => normalizza(u) || '(niente)';
export const inLinea = u => vista(u).split('\n').join(' ⏎ ');
const righe = u => { const n = normalizza(u); return n ? n.split('\n').length : 0; };

// istanza(modello, seme) → { modello, seme, programma, codice, sorgente, giusta, opzioni, distrattori, scrivi, concetti, concetto }
// codice: quello che vede lo studente (senza #include); sorgente: il C completo da compilare.
// opzioni: la giusta più al massimo 3 distrattori, mescolati dal seme. Con meno di 2 distrattori scrivi = true: si risponde scrivendo.
export function istanza(m, seme = 1, { maxPassi = 10000 } = {}) {
  if (typeof m === 'string') m = modello(m);
  if (!m) return null;
  const r = creaRng(impasta(m.id) ^ Math.imul(seme | 0, 0x9E3779B1));
  for (let tentativo = 0; tentativo < 40; tentativo++) {
    const p = m.genera(r);
    let giusta;
    try { giusta = esegui(p, { maxPassi }).uscita; } catch (e) { if (e instanceof ErroreC) continue; throw e; }
    if (righe(giusta) > 10) continue;
    const viste = new Set([normalizza(giusta)]), distrattori = [];
    for (const [indiceMutante, mu] of m.mutanti.entries()) {
      let u;
      try { u = esegui(mu.applica(p), { maxPassi, tollerante: true }).uscita; } catch (e) { if (e instanceof ErroreC) continue; throw e; }
      const k = normalizza(u);
      if (viste.has(k) || righe(u) > 10) continue;
      viste.add(k);
      distrattori.push({ uscita: u, mutante: mu.id, indiceMutante, frase: mu.frase(inLinea(u), p.dati || {}) });
    }
    if (!distrattori.length) continue;     // nessun errore cambia l'uscita: con questi numeri non serve, si rigenera
    const scelti = distrattori.length > 3 ? mescola(r, distrattori).slice(0, 3) : distrattori;
    const scrivi = scelti.length < 2;
    const opzioni = scrivi ? [] : mescola(r, [{ uscita: giusta, mutante: null, giusta: true }, ...scelti.map(d => ({ ...d, giusta: false }))]);
    const concetto = typeof m.concetto === 'function' ? m.concetto(p.dati || {}) : m.concetto;   // alcuni concetti seguono i dati (i++ o i--)
    return { modello: m.id, cosa: m.cosa, seme, programma: p, codice: stampaC(p, { include: false }), sorgente: stampaC(p), giusta, opzioni, distrattori, scrivi, concetti: [...m.concetti], concetto };
  }
  return null;
}

// una risposta scritta: conta quello che si legge, non gli spazi (le righe si possono separare con uno spazio)
export const compatta = s => normalizza(String(s ?? '').replace(/^\s*[`"«]+|[`"»]+\s*$/g, '')).replace(/\s+/g, ' ').trim();
