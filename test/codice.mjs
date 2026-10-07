// Prove di «Cosa stampa?», senza browser e senza compilatore: node test/codice.mjs
// albero.js (semantica del C e stampa del sorgente), modelli.js (20 semi per modello) e la parte pura di stampa.js.
// Il confronto con un compilatore vero è in test/verifica-c.mjs.
import * as A from '../js/codice/albero.js';
import { MODELLI, CONCETTI, MUTANTI, ERRORI, istanza, vista, compatta, creaRng, modello, modelliPer, variante } from '../js/codice/modelli.js';
import { scegliModelli, preparaManche, valuta, anteprima, scaduti, CHIAVE, schedaStampa, collega, corsoProgrammazione, linguaDi } from '../js/codice/stampa.js';
import * as G from '../js/codice/glossario.js';
import { coseNuoveDi, htmlCoseNuove, mostraCoseNuove, mettiNelRipasso } from '../js/codice/progetto.js';

const { num, car, reale, v, indice, valore, indirizzo, bin, un, cast, ternario, assegna, incr, chiama, printf, dich, array, espr, blocco, se, mentre, fai, per, scegli, caso, interrompi, continua, ritorna, param, funzione, main, programma, esegui, stampaC, normalizza, ErroreC } = A;
let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const out = (...istr) => esegui(blocco(...istr)).uscita;
const stampa = (f, ...a) => out(espr(printf(f, ...a)));
const lancia = (f, tipo) => { try { f(); return false; } catch (e) { return e instanceof ErroreC && (!tipo || e.tipo === tipo); } };

/* ---------- la semantica del C ---------- */
prova('-7 % 3 → -1', stampa('%d', bin('%', num(-7), num(3))) === '-1');
prova('7 / 2 → 3', stampa('%d', bin('/', num(7), num(2))) === '3');
prova('printf("%.2f", 2.5) → 2.50', stampa('%.2f', reale(2.5)) === '2.50');
prova('-7 / 2 → -3 (verso lo zero)', stampa('%d', bin('/', num(-7), num(2))) === '-3');
prova('7 % -3 → 1 (segno del dividendo)', stampa('%d', bin('%', num(7), num(-3))) === '1');
prova('(double)7 / 2 → 3.5', stampa('%.1f', bin('/', cast('double', num(7)), num(2))) === '3.5');
prova('(double)(7 / 2) → 3.0', stampa('%.1f', cast('double', bin('/', num(7), num(2)))) === '3.0');
prova('7 / 2.0 → 3.5', stampa('%.1f', bin('/', num(7), reale(2))) === '3.5');
prova("'a' + 2 con %c e %d", stampa('%c %d', bin('+', car('a'), num(2)), bin('+', car('a'), num(2))) === 'c 99');
prova('%% e %s e %i', stampa('100%% %s %i', A.testo('ok'), num(4)) === '100% ok 4');
prova('%.Nf con N diversi', stampa('%.0f %.3f %f', reale(2.75), reale(1.0626), reale(0.5)) === '3 1.063 0.500000');
prova('%.3f di 1.0625 (caso a metà) si scarta', lancia(() => stampa('%.3f', reale(1.0625)), 'meta'));
prova('%.2f di 0.125 (caso a metà) si scarta', lancia(() => stampa('%.2f', reale(0.125)), 'meta'));
prova('%.0f di 2.75 → 3', stampa('%.0f', reale(2.75)) === '3');
prova('negativi con %.1f', stampa('%.1f', reale(-2.26)) === '-2.3' && lancia(() => stampa('%.1f', reale(-2.25)), 'meta'));
prova('int a 32 bit: INT_MAX + 1 si scarta', lancia(() => stampa('%d', bin('+', num(2147483647), num(1))), 'trabocco'));
prova('int a 32 bit: 65536 * 65536 si scarta', lancia(() => stampa('%d', bin('*', num(65536), num(65536))), 'trabocco'));
prova('int a 32 bit: moltiplicazione grande ma valida', stampa('%d', bin('*', num(46340), num(46340))) === '2147395600');
prova('divisione per zero si scarta', lancia(() => stampa('%d', bin('/', num(1), num(0))), 'zero') && lancia(() => stampa('%d', bin('%', num(1), num(0))), 'zero'));
prova('INT_MIN / -1 si scarta', lancia(() => stampa('%d', bin('/', bin('-', num(-2147483647), num(1)), num(-1))), 'trabocco'));
prova('ciclo infinito: maxPassi', lancia(() => esegui(blocco(mentre(num(1), blocco())), { maxPassi: 500 }), 'passi'));
prova('esegui conta i passi', esegui(blocco(per(dich('int', ['i', num(0)]), bin('<', v('i'), num(3)), incr(v('i')), espr(num(0))))).passi > 3);
prova('indice fuori dall\'array si scarta', lancia(() => out(array('int', 'v', [1, 2]), espr(printf('%d', indice(v('v'), num(2))))), 'indice'));
prova('variabile non dichiarata', lancia(() => stampa('%d', v('x')), 'nome'));
prova('char fuori dall\'ASCII si scarta', lancia(() => out(dich('char', ['c', num(200)])), 'char'));
prova('formato sbagliato: %d con un double', lancia(() => stampa('%d', reale(2.5)), 'printf'));
prova('formato sbagliato: %f con un int', lancia(() => stampa('%f', num(2)), 'printf'));
prova('troppi o pochi argomenti a printf', lancia(() => stampa('%d'), 'printf') && lancia(() => stampa('%d', num(1), num(2)), 'printf'));
prova('modo tollerante (per i mutanti)', esegui(blocco(espr(printf('%d', bin('/', reale(7), num(2))))), { tollerante: true }).uscita === '3.5');
prova('% con un double non è C', lancia(() => stampa('%d', bin('%', reale(7), num(2))), 'tipo'));
prova('% con un double anche nel ramo che non gira', lancia(() => stampa('%d', ternario(num(1), num(1), bin('%', reale(7), num(2)))), 'tipo'));
prova('ternario con un double è double', stampa('%.1f', ternario(num(1), num(2), reale(2.5))) === '2.0');
prova('cortocircuito: || non valuta il secondo', out(dich('int', ['n', num(0)]), espr(bin('||', num(1), incr(v('n'), '++', true))), espr(printf('%d', v('n')))) === '0');
prova('cortocircuito: && non valuta il secondo', out(dich('int', ['n', num(0)]), espr(bin('&&', num(0), incr(v('n'), '++', true))), espr(printf('%d', v('n')))) === '0');
prova('i++ e ++i', out(dich('int', ['i', num(5)]), dich('int', ['a', incr(v('i'))], ['b', incr(v('i'), '++', true)]), espr(printf('%d %d %d', v('a'), v('b'), v('i')))) === '5 7 7');
prova('assegnamenti composti', out(dich('int', ['x', num(10)]), espr(assegna(v('x'), '-=', num(3))), espr(assegna(v('x'), '*=', num(2))), espr(assegna(v('x'), '/=', num(4))), espr(assegna(v('x'), '%=', num(2))), espr(printf('%d', v('x')))) === '1');
prova('int = double tronca', out(dich('int', ['x', reale(-3.9)]), espr(printf('%d', v('x')))) === '-3');
prova('double = int', out(dich('double', ['x', bin('/', num(7), num(2))]), espr(printf('%.1f', v('x')))) === '3.0');
prova('char che si incrementa', out(dich('char', ['c', car('a')]), espr(incr(v('c'))), espr(printf('%c', v('c')))) === 'b');
prova('switch senza break cade nel case sotto', out(dich('int', ['x', num(2)]), scegli(v('x'), caso(1, espr(printf('a'))), caso(2, espr(printf('b'))), caso(3, espr(printf('c')), interrompi()), caso(null, espr(printf('d'))))) === 'bc');
prova('switch: default', out(dich('int', ['x', num(9)]), scegli(v('x'), caso(1, espr(printf('a'))), caso(null, espr(printf('d'))))) === 'd');
prova('break e continue', out(per(dich('int', ['i', num(0)]), bin('<', v('i'), num(6)), incr(v('i')), blocco(se(bin('==', v('i'), num(1)), continua()), se(bin('==', v('i'), num(4)), interrompi()), espr(printf('%d', v('i')))))) === '023');
prova('do-while gira almeno una volta', out(dich('int', ['i', num(9)]), fai(blocco(espr(printf('%d', v('i')))), bin('<', v('i'), num(0)))) === '9');
prova('continue nel do-while va alla condizione', out(dich('int', ['i', num(0)]), fai(blocco(espr(incr(v('i'))), se(bin('==', v('i'), num(2)), continua()), espr(printf('%d', v('i')))), bin('<', v('i'), num(4)))) === '134');
prova('variabile nascosta in un blocco', out(dich('int', ['x', num(1)]), blocco(dich('int', ['x', num(2)]), espr(printf('%d', v('x')))), espr(printf('%d', v('x')))) === '21');
prova('doppia dichiarazione nello stesso blocco', lancia(() => out(dich('int', ['x', num(1)]), dich('int', ['x', num(2)])), 'nome'));
const scambia = funzione('void', 'scambia', [param('int', 'a', '*'), param('int', 'b', '*')], dich('int', ['t', valore(v('a'))]), espr(assegna(valore(v('a')), '=', valore(v('b')))), espr(assegna(valore(v('b')), '=', v('t'))));
prova('swap per indirizzo', esegui(programma(scambia, main(dich('int', ['x', num(1)], ['y', num(2)]), espr(chiama('scambia', indirizzo(v('x')), indirizzo(v('y')))), espr(printf('%d %d', v('x'), v('y')))))).uscita === '2 1');
const perValore = funzione('void', 'f', [param('int', 'a')], espr(assegna(v('a'), '=', num(9))), espr(printf('%d ', v('a'))));
prova('passaggio per valore', esegui(programma(perValore, main(dich('int', ['x', num(1)]), espr(chiama('f', v('x'))), espr(printf('%d', v('x')))))).uscita === '9 1');
const raddoppia = funzione('void', 'r', [param('int', 'v', '[]'), param('int', 'n')], per(dich('int', ['i', num(0)]), bin('<', v('i'), v('n')), incr(v('i')), espr(assegna(indice(v('v'), v('i')), '*=', num(2)))));
prova('array modificato da una funzione', esegui(programma(raddoppia, main(array('int', 'a', [1, 2]), espr(chiama('r', v('a'), num(2))), espr(printf('%d %d', indice(v('a'), num(0)), indice(v('a'), num(1))))))).uscita === '2 4');
const fatt = funzione('int', 'fatt', [param('int', 'n')], se(bin('<=', v('n'), num(1)), ritorna(num(1))), ritorna(bin('*', v('n'), chiama('fatt', bin('-', v('n'), num(1))))));
prova('ricorsione: fatt(10)', esegui(programma(fatt, main(espr(printf('%d', chiama('fatt', num(10))))))).uscita === '3628800');
prova('ricorsione: fatt(13) trabocca e si scarta', lancia(() => esegui(programma(fatt, main(espr(printf('%d', chiama('fatt', num(13))))))), 'trabocco'));
const giu = funzione('int', 'giu', [param('int', 'n')], ritorna(chiama('giu', bin('+', v('n'), num(1)))));
prova('ricorsione senza fine si scarta', lancia(() => esegui(programma(giu, main(espr(chiama('giu', num(0))))), { maxPassi: 1e6 })));
prova('funzione int senza return si scarta', lancia(() => esegui(programma(funzione('int', 'f', []), main(espr(printf('%d', chiama('f')))))), 'ritorno'));
prova('una variabile senza valore non si può scrivere', lancia(() => out({ t: 'dich', tipo: 'int', voci: [{ nome: 'x' }] }), 'init'));
prova('normalizza', normalizza('a \r\nb  \n\n\n') === 'a\nb' && normalizza('') === '');

/* ---------- il sorgente C ---------- */
const piccolo = programma(main(per(dich('int', ['i', num(0)]), bin('<', v('i'), num(3)), incr(v('i')), espr(printf('%d ', v('i')))), espr(printf('\n'))));
prova('stampaC: programma completo', stampaC(piccolo) === '#include <stdio.h>\n\nint main(void) {\n    for (int i = 0; i < 3; i++)\n        printf("%d ", i);\n    printf("\\n");\n}\n', JSON.stringify(stampaC(piccolo)));
prova('stampaC: senza #include per lo studente', stampaC(piccolo, { include: false }).startsWith('int main(void) {'));
prova('stampaC: parentesi minime', stampaC(bin('*', bin('+', v('a'), v('b')), v('c'))) === '(a + b) * c' && stampaC(bin('-', v('a'), bin('-', v('b'), v('c')))) === 'a - (b - c)' && stampaC(bin('-', bin('-', v('a'), v('b')), v('c'))) === 'a - b - c');
prova('stampaC: cast e divisione', stampaC(bin('/', cast('double', v('s')), v('n'))) === '(double)s / n' && stampaC(cast('double', bin('/', v('s'), v('n')))) === '(double)(s / n)');
prova('stampaC: && dentro || tra parentesi', stampaC(bin('||', bin('&&', v('a'), v('b')), v('c'))) === '(a && b) || c');
prova('stampaC: negativi', stampaC(bin('-', v('a'), num(-7))) === 'a - (-7)' && stampaC(bin('%', num(-7), num(3))) === '-7 % 3' && stampaC(un('-', un('-', v('x')))) === '-(-x)');
prova('stampaC: char, stringhe e reali', stampaC(car("'")) === "'\\''" && stampaC(A.testo('a"b\n')) === '"a\\"b\\n"' && stampaC(reale(2)) === '2.0' && stampaC(reale(0.5)) === '0.5');
prova('stampaC: puntatori e array', stampaC(assegna(valore(v('a')), '=', valore(v('b')))) === '*a = *b' && stampaC(chiama('f', indirizzo(v('x')), indice(v('v'), bin('+', v('i'), num(1))))) === 'f(&x, v[i + 1])');
prova('stampaC: i++ e ++i', stampaC(incr(v('i'))) === 'i++' && stampaC(incr(v('i'), '--', true)) === '--i');
prova('stampaC: switch compatto', stampaC(scegli(v('x'), caso(1, espr(printf('a')), interrompi()), caso(null, espr(printf('b'))))) === 'switch (x) {\n    case 1: printf("a"); break;\n    default: printf("b");\n}');
prova('stampaC: do-while', stampaC(fai(blocco(espr(incr(v('i')))), bin('<', v('i'), num(3)))) === 'do {\n    i++;\n} while (i < 3);');
prova('stampaC: else if', stampaC(se(v('a'), blocco(espr(printf('1'))), se(v('b'), blocco(espr(printf('2'))), blocco(espr(printf('3')))))) === 'if (a) {\n    printf("1");\n} else if (b) {\n    printf("2");\n} else {\n    printf("3");\n}');
// l'else pendente: scritto all'altezza dell'if di fuori, ma il C lo dà all'if interno (ed esegui fa lo stesso)
const interno = se(bin('>', v('y'), num(0)), espr(printf('A')), espr(printf('B'))); interno.elseFuori = true;
prova('stampaC: else pendente col rientro che inganna', stampaC(se(bin('>', v('x'), num(0)), interno)) === 'if (x > 0)\n    if (y > 0)\n        printf("A");\nelse\n    printf("B");');
prova('esegui: l\'else pendente va all\'if interno', out(dich('int', ['x', num(1)], ['y', num(-1)]), se(bin('>', v('x'), num(0)), interno)) === 'B' && out(dich('int', ['x', num(-1)], ['y', num(1)]), se(bin('>', v('x'), num(0)), interno)) === '');
// un if senza else dentro un if con l'else: stampaC mette le graffe, così il C non sposta l'else
const senzaElse = se(bin('>', v('x'), num(0)), se(bin('>', v('y'), num(0)), espr(printf('A'))), espr(printf('B')));
prova('stampaC: graffe contro l\'else pendente involontario', stampaC(senzaElse) === 'if (x > 0) {\n    if (y > 0)\n        printf("A");\n} else\n    printf("B");', JSON.stringify(stampaC(senzaElse)));
prova('clona non condivide niente', (() => { const a = programma(main(espr(printf('x')))), b = A.clona(a); b.funzioni[0].nome = 'z'; return a.funzioni[0].nome === 'main'; })());

/* ---------- i modelli ---------- */
const ids = MODELLI.map(m => m.id);
prova('almeno 25 modelli', MODELLI.length >= 25, MODELLI.length);
prova('id dei modelli unici', new Set(ids).size === ids.length);
prova('concetti conosciuti', MODELLI.every(m => m.concetti.length && m.concetti.every(c => CONCETTI[c])), MODELLI.filter(m => !m.concetti.every(c => CONCETTI[c])).map(m => m.id).join(', '));
prova('errori conosciuti', MODELLI.every(m => m.mutanti.length >= 2 && m.mutanti.every(x => ERRORI[x.id])), MODELLI.flatMap(m => m.mutanti.filter(x => !ERRORI[x.id]).map(x => x.id)).join(', '));
prova('i sette errori della spec', Object.keys(MUTANTI).length === 7 && ['fuori-di-uno', 'divisione-intera', 'post-vs-pre', 'break-dimenticato', 'copia-del-parametro', 'cortocircuito', 'resto-col-segno'].every(k => MUTANTI[k] && MODELLI.some(m => m.mutanti.some(x => x.id === k))));
prova('ogni concetto ha almeno un modello', Object.keys(CONCETTI).every(c => MODELLI.some(m => m.concetti.includes(c))), Object.keys(CONCETTI).filter(c => !MODELLI.some(m => m.concetti.includes(c))).join(', '));
prova('mulberry32 è deterministico', (() => { const a = creaRng(42), b = creaRng(42); return [1, 2, 3].every(() => a() === b()); })());

const SEMI = 20;
for (const m of MODELLI) {
  const errori = [];
  let scritte = 0;
  for (let seme = 1; seme <= SEMI; seme++) {
    const ist = istanza(m, seme);
    if (!ist) { errori.push(`seme ${seme}: nessuna istanza`); continue; }
    const prima = stampaC(ist.programma);
    let r; try { r = esegui(ist.programma); } catch (e) { errori.push(`seme ${seme}: esegui lancia ${e.message}`); continue; }
    if (r.uscita !== ist.giusta) errori.push(`seme ${seme}: giusta diversa da esegui()`);
    const righe = normalizza(r.uscita).split('\n').length;
    if (righe > 10) errori.push(`seme ${seme}: ${righe} righe`);
    if (!normalizza(r.uscita)) errori.push(`seme ${seme}: non stampa niente`);
    if (!ist.distrattori.length) errori.push(`seme ${seme}: nessun mutante cambia l'uscita`);
    const tutte = [ist.giusta, ...ist.distrattori.map(d => d.uscita)].map(normalizza);
    if (new Set(tutte).size !== tutte.length) errori.push(`seme ${seme}: distrattori doppi o uguali alla giusta`);
    if (ist.distrattori.some(d => !d.frase || !d.frase.startsWith('Hai scelto `'))) errori.push(`seme ${seme}: frase mancante`);
    if (ist.scrivi) { scritte++; if (ist.opzioni.length || ist.distrattori.length >= 2) errori.push(`seme ${seme}: scrivi con le opzioni`); }
    else {
      if (ist.opzioni.length < 3 || ist.opzioni.length > 4) errori.push(`seme ${seme}: ${ist.opzioni.length} opzioni`);
      if (ist.opzioni.filter(o => o.giusta).length !== 1 || normalizza(ist.opzioni.find(o => o.giusta).uscita) !== normalizza(ist.giusta)) errori.push(`seme ${seme}: la giusta non è una sola`);
    }
    if (stampaC(ist.programma) !== prima) errori.push(`seme ${seme}: un mutante ha cambiato l'originale`);
    if (ist.codice.split('\n').length > 13) errori.push(`seme ${seme}: codice di ${ist.codice.split('\n').length} righe`);
    if (!ist.sorgente.startsWith('#include <stdio.h>\n') || !ist.sorgente.includes(ist.codice)) errori.push(`seme ${seme}: sorgente e codice non tornano`);
    const di = istanza(m, seme);
    if (di.sorgente !== ist.sorgente || JSON.stringify(di.opzioni.map(o => o.uscita)) !== JSON.stringify(ist.opzioni.map(o => o.uscita))) errori.push(`seme ${seme}: non deterministico`);
  }
  if (scritte > SEMI / 2) errori.push(`${scritte} domande su ${SEMI} solo da scrivere`);
  prova(`modello ${m.id} (${SEMI} semi)`, !errori.length, errori.slice(0, 3).join('; '));
}
// ogni mutante deve arrivare allo studente: in 300 semi dà almeno una volta un distrattore (se no la sua frase non si legge mai)
const maiUsati = MODELLI.flatMap(m => {
  const usati = new Set();
  for (let seme = 1; seme <= 300 && usati.size < m.mutanti.length; seme++) for (const d of istanza(m, seme)?.distrattori || []) usati.add(d.indiceMutante);
  return m.mutanti.map((x, k) => usati.has(k) ? null : `${m.id}#${k} (${x.id})`).filter(Boolean);
});
prova('ogni mutante dà almeno un distrattore in 300 semi', !maiUsati.length, maiUsati.join(', '));
// «i++ e ++i» nel registro solo dove c'è davvero un incremento da leggere: non nel passo del for, non nell'ordine delle istruzioni
prova('post-vs-pre solo nei modelli sull\'incremento', MODELLI.every(m => !m.mutanti.some(x => x.id === 'post-vs-pre') || m.concetti.includes('c:incremento')) && !modello('for-passo').mutanti.some(x => x.id === 'post-vs-pre'),
  MODELLI.filter(m => m.mutanti.some(x => x.id === 'post-vs-pre') && !m.concetti.includes('c:incremento')).map(m => m.id).join(', '));
prova('il passo del ciclo ha il suo nome nel registro', ERRORI['passo-del-ciclo'] && !MUTANTI['passo-del-ciclo'] && modello('for-passo').mutanti.some(x => x.id === 'passo-del-ciclo'));
// post-pre con i--: il concetto parla di decremento
const conMeno = Array.from({ length: 20 }, (_, s) => istanza('post-pre', s + 1)).find(x => x.codice.includes('i--'));
prova('post-pre: con i-- il concetto dice «decrementa»', conMeno && /decrementa/.test(conMeno.concetto) && !/incrementa/.test(conMeno.concetto), conMeno?.concetto);
// do-while: a volte gira più volte, e allora la condizione con l'uguale cambia l'uscita
const dw = Array.from({ length: 40 }, (_, s) => istanza('do-while', s + 1));
prova('do-while: anche cicli con più giri', dw.some(x => +x.giusta.split(' ')[0] > 1) && dw.some(x => x.distrattori.some(d => d.indiceMutante === 2)));
prova('semi diversi, programmi diversi', new Set(Array.from({ length: 10 }, (_, s) => istanza('for-minore', s + 1).sorgente)).size >= 5);
prova('modello per id', modello('switch')?.id === 'switch' && modello('nessuno') === null && istanza('nessuno', 1) === null);
prova('vista: (niente) e righe', vista('') === '(niente)' && vista('a \nb\n') === 'a\nb');
prova('compatta: spazi, a capo e virgolette', compatta('  1  2\n3 ') === '1 2 3' && compatta('`0 1 2`') === '0 1 2');

/* ---------- stampa.js: la parte pura ---------- */
const OGGI = '2026-10-02';
const cinque = scegliModelli({ seme: 3, oggi: OGGI });
prova('5 modelli diversi', cinque.length === 5 && new Set(cinque.map(m => m.id)).size === 5);
prova('5 argomenti diversi', new Set(cinque.map(m => m.concetti[0])).size === 5);
prova('stessa scelta con lo stesso seme', JSON.stringify(scegliModelli({ seme: 3, oggi: OGGI }).map(m => m.id)) === JSON.stringify(cinque.map(m => m.id)));
const memoria = { [CHIAVE('c:switch')]: { scad: '2026-09-30', giuste: 1, sbagliate: 1, rip: 0 }, [CHIAVE('c:ricorsione')]: { scad: '2026-10-01', giuste: 0, sbagliate: 1, rip: 0 }, [CHIAVE('c:for')]: { scad: '2026-12-01', giuste: 3, sbagliate: 0, rip: 3 } };
prova('scaduti, dal più vecchio', JSON.stringify(scaduti(memoria, OGGI)) === '["c:switch","c:ricorsione"]');
const conMem = scegliModelli({ memoria, seme: 5, oggi: OGGI });
prova('prima i concetti scaduti', conMem[0].concetti.includes('c:switch') && conMem[1].concetti.includes('c:ricorsione'), conMem.map(m => m.id).join(', '));
prova('poi quelli mai visti', conMem.slice(2).every(m => m.concetti.every(c => !memoria[CHIAVE(c)])), conMem.map(m => m.id).join(', '));
const tuttiVisti = Object.fromEntries(Object.keys(CONCETTI).map(c => [CHIAVE(c), { scad: '2027-01-01', giuste: 1, sbagliate: 0, rip: 1 }]));
prova('niente di scaduto né di nuovo: a caso', scegliModelli({ memoria: tuttiVisti, seme: 9, oggi: OGGI }).length === 5);
const manche = preparaManche({ seme: 11, oggi: OGGI });
prova('preparaManche: 5 domande pronte', manche.length === 5 && manche.every(x => x.codice && x.giusta));
prova('preparaManche: deterministico', JSON.stringify(preparaManche({ seme: 11, oggi: OGGI }).map(x => x.sorgente)) === JSON.stringify(manche.map(x => x.sorgente)));
prova('anteprima: la prima domanda è quella promessa', [1, 2, 3, 4, 5].every(sm => anteprima({ memoria, seme: sm, oggi: OGGI }).modello === preparaManche({ memoria, seme: sm, oggi: OGGI })[0].modello));
prova('corso di programmazione', corsoProgrammazione(['Analisi 2', 'Programmazione 1', 'Lab']) === 'Programmazione 1' && corsoProgrammazione(['Fisica']) === '' && corsoProgrammazione() === '');
prova('«Laboratorio di chimica» non è un corso di programmazione', corsoProgrammazione(['Laboratorio di chimica', 'Laboratorio di fisica']) === '' && corsoProgrammazione(['Lab di C']) === 'Lab di C' && corsoProgrammazione(['Laboratorio di Python']) === 'Laboratorio di Python');
prova('anteprima per la pillola', /^Cosa stampa .+\?$/.test(anteprima({ seme: 2, oggi: OGGI })?.testo || ''), anteprima({ seme: 2, oggi: OGGI })?.testo);
const q = istanza('for-minore', 4);
const kGiusta = q.opzioni.findIndex(o => o.giusta), kSbagliata = q.opzioni.findIndex(o => !o.giusta);
prova('valuta: la giusta', valuta(q, { indice: kGiusta }).ok === true && !valuta(q, { indice: kGiusta }).mutante);
const vs = valuta(q, { indice: kSbagliata });
prova('valuta: la sbagliata dice il mutante e la frase', !vs.ok && vs.mutante === q.opzioni[kSbagliata].mutante && vs.frase.startsWith('Hai scelto'));
prova('valuta: scritta giusta (spazi e a capo non contano)', valuta(q, { testo: '  ' + normalizza(q.giusta).replace(/ /g, '  ') + '\n' }).ok);
prova('valuta: scritta uguale a un mutante', (() => { const r = valuta(q, { testo: q.distrattori[0].uscita }); return r.mutante === q.distrattori[0].mutante && r.frase.startsWith('Hai scritto'); })());
prova('valuta: scritta sbagliata qualunque', (() => { const r = valuta(q, { testo: 'boh' }); return !r.ok && r.mutante === null && r.frase.includes('boh'); })());
prova('valuta: niente scritto', !valuta(q, { testo: '   ' }).ok);
prova('schedaStampa senza collega spiega cosa manca', (() => { try { schedaStampa({}); return false; } catch (e) { return /collega/.test(e.message); } })());
prova('collega accetta gli attrezzi', (() => { collega({ errori: MUTANTI }); return true; })());

/* ---------- Java e Python ---------- */
const { stampaJava, stampaPython, stampaIn, scrivibile } = A;
const outIn = (lingua, ...corpo) => esegui(programma(main(...corpo)), { lingua }).uscita;
prova('Python: // e % verso il basso', outIn('python', espr(printf('%d %d %d %d', bin('/', num(-7), num(2)), bin('%', num(-7), num(3)), bin('/', num(7), num(-2)), bin('%', num(7), num(-3))))) === '-4 2 -4 -2');
prova('Python: positivi come in C', outIn('python', espr(printf('%d %d', bin('/', num(7), num(2)), bin('%', num(7), num(3))))) === '3 1');
prova('Java: / e % come in C', outIn('java', espr(printf('%d %d', bin('/', num(-7), num(2)), bin('%', num(-7), num(3))))) === '-3 -1');
prova('Python: anche //= e %=', outIn('python', dich('int', ['x', num(-7)]), espr(assegna(v('x'), '/=', num(2))), espr(printf('%d', v('x')))) === '-4');
prova('Python: il trabocco dei 32 bit si scarta lo stesso', lancia(() => outIn('python', espr(printf('%d', bin('*', num(65536), num(65536))))), 'trabocco'));
const piccoloPy = programma(main(per(dich('int', ['i', num(0)]), bin('<', v('i'), num(3)), incr(v('i')), espr(printf('%d ', v('i')))), espr(printf('\n'))));
prova('stampaPython: for → range, printf → print', stampaPython(piccoloPy) === 'for i in range(3):\n    print("%d " % i, end="")\nprint()\n', JSON.stringify(stampaPython(piccoloPy)));
const ciclo = (init, c, passo) => stampaPython(programma(main(per(dich('int', ['i', num(init)]), c, passo, espr(printf('%d', v('i')))))));
prova('stampaPython: range col passo e all\'indietro', /for i in range\(1, 11, 3\):/.test(ciclo(1, bin('<=', v('i'), num(10)), assegna(v('i'), '+=', num(3)))) && /for i in range\(5, 1, -1\):/.test(ciclo(5, bin('>', v('i'), num(1)), incr(v('i'), '--'))));
prova('stampaPython: un for con i cambiato nel corpo diventa while', /i = 0\nwhile i < 9:\n    i \+= 2\n    print\("%d" % i, end=""\)\n    i \+= 1/.test(stampaPython(programma(main(per(dich('int', ['i', num(0)]), bin('<', v('i'), num(9)), incr(v('i')), blocco(espr(assegna(v('i'), '+=', num(2))), espr(printf('%d', v('i'))))))))));
prova('stampaPython: // tra int, / con un double, and/or/not, elif', (() => { const s = stampaPython(programma(main(dich('int', ['a', num(7)]), dich('double', ['x', reale(2)]), se(bin('&&', bin('>', v('a'), num(0)), un('!', bin('==', v('a'), num(3)))), espr(printf('%d %.1f\n', bin('/', v('a'), num(2)), bin('/', v('a'), v('x')))), se(bin('||', bin('<', v('a'), num(0)), bin('>', v('a'), num(9))), espr(printf('x\n')), espr(printf('y\n'))))))); return s.includes('if a > 0 and not a == 3:') && s.includes('print("%d %.1f" % (a // 2, a / x))') && s.includes('elif a < 0 or a > 9:') && s.includes('else:\n    print("y")'); })());
prova('stampaJava: class Main, printf, println e print', stampaJava(piccoloPy) === 'public class Main {\n    public static void main(String[] args) {\n        for (int i = 0; i < 3; i++)\n            System.out.printf("%d ", i);\n        System.out.println();\n    }\n}\n', JSON.stringify(stampaJava(piccoloPy)));
prova('stampaJava: %f fissa il punto decimale, char col cast, %d di un char come (int)', (() => { const s = stampaJava(programma(main(dich('char', ['c', car('a')]), dich('char', ['d', bin('-', v('c'), num(32))]), espr(printf('%c %d %.1f\n', v('d'), v('c'), reale(2.5)))))); return s.startsWith('import java.util.Locale;') && s.includes('Locale.setDefault(Locale.ROOT);') && s.includes('char d = (char)(c - 32);') && s.includes('System.out.printf("%c %d %.1f\\n", d, (int)c, 2.5);'); })());
prova('stampaJava: array e metodi static', (() => { const s = stampaJava(programma(funzione('int', 'primo', [param('int', 'v', '[]')], ritorna(indice(v('v'), num(0)))), main(array('int', 'a', [4, 5]), espr(printf('%d\n', chiama('primo', v('a'))))))); return s.includes('static int primo(int[] v) {') && s.includes('int[] a = {4, 5};'); })());
// il filtro: quello che non si scrive fedele lancia ErroreC 'lingua'
const nonSiScrive = (n, l) => lancia(() => stampaIn(n, l), 'lingua');
prova('filtro: puntatori solo in C', nonSiScrive(istanza('swap-indirizzo', 1).programma, 'java') && nonSiScrive(istanza('swap-indirizzo', 1).programma, 'python') && scrivibile(istanza('swap-indirizzo', 1).programma, 'c'));
prova('filtro: do-while e switch non in Python, sì in Java', nonSiScrive(istanza('do-while', 1).programma, 'python') && nonSiScrive(istanza('switch', 1).programma, 'python') && scrivibile(istanza('do-while', 1).programma, 'java') && scrivibile(istanza('switch', 1).programma, 'java'));
prova('filtro: i++ dentro un\'espressione non in Python', nonSiScrive(istanza('post-pre', 1).programma, 'python') && nonSiScrive(istanza('while-post', 1).programma, 'python'));
prova('filtro: variabile nascosta nel blocco né in Java né in Python', nonSiScrive(istanza('blocco-ombra', 1).programma, 'java') && nonSiScrive(istanza('blocco-ombra', 1).programma, 'python'));
prova('filtro: char non in Python', nonSiScrive(istanza('char-ascii', 1).programma, 'python') && scrivibile(istanza('char-ascii', 1).programma, 'java'));
prova('filtro: un for con continue che non diventa range non in Python', nonSiScrive(programma(main(dich('int', ['i', num(0)]), per(espr(assegna(v('i'), '=', num(0))), bin('<', v('i'), num(5)), incr(v('i')), blocco(se(bin('==', v('i'), num(2)), continua()), espr(printf('%d', v('i'))))))), 'python'));
prova('filtro: un int come condizione non in Java', nonSiScrive(programma(main(dich('int', ['n', num(1)]), se(v('n'), espr(printf('x'))))), 'java'));
prova('filtro: un double in un int non in Java né in Python', nonSiScrive(programma(main(dich('int', ['n', reale(2.5)]), espr(printf('%d', v('n'))))), 'java') && nonSiScrive(programma(main(dich('int', ['n', reale(2.5)]), espr(printf('%d', v('n'))))), 'python'));
prova('filtro: codice dopo un break non in Java', nonSiScrive(programma(main(per(dich('int', ['i', num(0)]), bin('<', v('i'), num(3)), incr(v('i')), blocco(interrompi(), espr(printf('x')))))), 'java'));
prova('ogni modello dichiara le sue lingue', MODELLI.every(m => m.lingue.includes('c')) && modelliPer('java').length >= 25 && modelliPer('python').length >= 15, `${modelliPer('java').length} Java, ${modelliPer('python').length} Python`);
prova('fuori dalle sue lingue un modello non dà domande', istanza('swap-indirizzo', 1, { lingua: 'python' }) === null && istanza('do-while', 1, { lingua: 'python' }) === null && istanza('blocco-ombra', 1, { lingua: 'java' }) === null);
for (const lingua of ['java', 'python']) for (const m of modelliPer(lingua)) {
  const errori = [];
  for (let seme = 1; seme <= SEMI; seme++) {
    const ist = istanza(m, seme, { lingua });
    if (!ist) { errori.push(`seme ${seme}: nessuna istanza`); continue; }
    if (ist.lingua !== lingua || ist.codice !== ist.sorgente) errori.push(`seme ${seme}: lingua o codice`);
    if (esegui(ist.programma, { lingua }).uscita !== ist.giusta) errori.push(`seme ${seme}: giusta diversa da esegui()`);
    if (!ist.distrattori.length) errori.push(`seme ${seme}: nessun mutante cambia l'uscita`);
    const tutte = [ist.giusta, ...ist.distrattori.map(d => d.uscita)].map(normalizza);
    if (new Set(tutte).size !== tutte.length) errori.push(`seme ${seme}: distrattori doppi o uguali alla giusta`);
    // in Python le spiegazioni parlano Python: niente printf, ++, cast del C, «In C»
    const testi = [ist.concetto, ...ist.distrattori.map(d => d.frase)].join(' | ');
    if (lingua === 'python' && /printf|\+\+|--|\(double\)|\bIn C\b|&&/.test(testi.replace(/`[^`]*`/g, x => x.includes('//') ? '' : x))) errori.push(`seme ${seme}: testo da C: ${testi}`);
    if (lingua === 'java' && /\bIn C\b|\bin C il\b/.test(testi)) errori.push(`seme ${seme}: «In C» in Java: ${testi}`);
    if (ist.codice.split('\n').length > 22) errori.push(`seme ${seme}: codice di ${ist.codice.split('\n').length} righe`);
  }
  prova(`${lingua}: modello ${m.id} (${SEMI} semi)`, !errori.length, errori.slice(0, 2).join('; '));
}
const maiUsatiPy = ['java', 'python'].flatMap(lingua => modelliPer(lingua).flatMap(m => {
  const usati = new Set(), mu = variante(m, lingua).mutanti;
  for (let seme = 1; seme <= 300 && usati.size < mu.length; seme++) for (const d of istanza(m, seme, { lingua })?.distrattori || []) usati.add(d.indiceMutante);
  return mu.map((x, k) => usati.has(k) ? null : `${lingua} ${m.id}#${k} (${x.id})`).filter(Boolean);
}));
prova('Java e Python: ogni mutante dà almeno un distrattore in 300 semi', !maiUsatiPy.length, maiUsatiPy.join(', '));
// gli errori tipici cambiano con la lingua: in Python la divisione verso il basso è la risposta giusta, e l'errore è il C
const rn = Array.from({ length: 30 }, (_, s) => istanza('resto-negativi', s + 1, { lingua: 'python' })).find(x => /-/.test(x.giusta));
prova('Python: resto-negativi, la giusta è verso il basso', rn && rn.giusta === `${Math.floor(rn.programma.dati.a / rn.programma.dati.b)} ${((rn.programma.dati.a % rn.programma.dati.b) + rn.programma.dati.b) % rn.programma.dati.b}\n` && rn.distrattori.some(d => /il C e Java/.test(d.frase)), rn?.giusta);
const dd = Array.from({ length: 30 }, (_, s) => istanza('diviso-due', s + 1, { lingua: 'python' })).find(x => x.distrattori.some(d => d.indiceMutante === 1));
prova('Python: diviso-due mostra a / 2 e a // 2', dd && dd.codice.includes('a // 2, a / 2)') && dd.distrattori.find(d => d.indiceMutante === 1).frase.includes('non tronca come in C o in Java'));
prova('Java: lo stesso seme dà lo stesso programma del C', istanza('for-minore', 5, { lingua: 'java' }).giusta === istanza('for-minore', 5).giusta);
prova('lingua dal corso', linguaDi('Programmazione in Python') === 'python' && linguaDi('Fondamenti di Java') === 'java' && linguaDi('Lab di C') === 'c' && linguaDi('Programmazione 1') === 'c' && linguaDi('Tecnologie web: JavaScript') === 'c' && linguaDi('') === 'c');
prova('corsi che nominano Python o Java sono di programmazione', corsoProgrammazione(['Fisica', 'Fondamenti di Java']) === 'Fondamenti di Java' && corsoProgrammazione(['Python per la data science']) === 'Python per la data science' && corsoProgrammazione(['Tecnologie JavaScript']) === '');
const pyManche = preparaManche({ seme: 11, oggi: OGGI, lingua: 'python' });
prova('preparaManche in Python: 5 domande, tutte Python', pyManche.length === 5 && pyManche.every(x => x.lingua === 'python' && modello(x.modello).lingue.includes('python')));
prova('anteprima in Java: la prima domanda è quella promessa', [1, 2, 3, 4, 5].every(sm => anteprima({ memoria, seme: sm, oggi: OGGI, lingua: 'java' }).modello === preparaManche({ memoria, seme: sm, oggi: OGGI, lingua: 'java' })[0].modello));

/* ---------- glossario: «Cose nuove» (js/codice/glossario.js), il dizionario fisso e le voci nuove di un diff ---------- */
{
  const V = G.VOCI, chiavi = new Set(V.map(v => v.l + '|' + v.k));
  prova('glossario: almeno 55 voci', V.length >= 55, V.length);
  prova('glossario: ogni voce ha k, lingua, cerca, domanda con «?» e risposta corta', V.every(v => v.k && ['c', 'java', 'python'].includes(v.l) && v.cerca instanceof RegExp && /\?$/.test(v.d) && v.r.trim() && v.r.length <= 260), V.filter(v => !(v.r.length <= 260 && /\?$/.test(v.d))).map(v => v.k).join(', '));
  prova('glossario: niente coppie k+lingua doppie, e k unica (visti è per chiave)', chiavi.size === V.length && new Set(V.map(v => v.k)).size === V.length);
  prova('glossario: c\'è ogni lingua (C ≥ 20, Java ≥ 15, Python ≥ 15)', V.filter(v => v.l === 'c').length >= 20 && V.filter(v => v.l === 'java').length >= 15 && V.filter(v => v.l === 'python').length >= 15);
  prova('glossario: domande e risposte su una riga, con le «virgolette basse» se servono', V.every(v => !/\n/.test(v.d + v.r) && !/[“”]/.test(v.d + v.r)));
  const rif = (rel, ...righe) => { let na = 0, nb = 0; return { rel, blocchi: [{ righe: righe.map(([t, x]) => ({ t, s: x, na: t === '+' ? undefined : ++na, nb: t === '-' ? undefined : ++nb })) }] }; };
  const k = l => l.map(x => x.voce.k).join(',');
  let r = G.coseNuove([rif('lab3/lista.c', [' ', 'void cresci(int **p, int n) {'], ['+', '  p2 = realloc(p, n);'], [' ', '}'])]);
  prova('glossario: realloc in una riga + → trovata, con file e riga', r.length === 1 && r[0].voce.k === 'realloc' && r[0].rel === 'lab3/lista.c' && r[0].riga === 2 && r[0].testo === 'p2 = realloc(p, n);', JSON.stringify(r));
  r = G.coseNuove([rif('lista.c', [' ', '  q = realloc(q, m);'], ['+', '  p = realloc(p, n);'])]);
  prova('glossario: c\'era già nel contesto → niente', !r.length, k(r));
  r = G.coseNuove([rif('lista.c', ['-', '  q = realloc(q, m);'], ['+', '  p = realloc(p, n);'])]);
  prova('glossario: c\'era già in una riga tolta → niente', !r.length, k(r));
  r = G.coseNuove([rif('lista.c', ['+', 'int realloc(int x) {'], ['+', '  return x;'], ['+', '}'], ['+', '  y = realloc(3);'])]);
  prova('glossario: una funzione dello studente con lo stesso nome → niente (falso allarme)', !r.length, k(r));
  r = G.coseNuove([rif('u.c', ['+', 'static size_t strlen(const char *s);']), rif('m.c', ['+', '  n = strlen(s);'])]);
  prova('glossario: la definizione in un altro file della stessa lingua conta', !r.length, k(r));
  r = G.coseNuove([rif('lista.c', ['+', '  // p = realloc(p, n);'], ['+', '  printf("realloc(p, n) fallita\\n");'], ['+', '/* free(p);'], ['+', '   strtok(s, ",") */'], ['+', ' * qsort(v, n, 4, f);'])]);
  prova('glossario: solo in un commento o tra virgolette → niente', !r.length, k(r));
  r = G.coseNuove([rif('lista.c', ['+', '  if (strcmp(a, "free(") == 0) free(a); // strtok(']), rif('n.c', ['+', '  return x; /* fine */ memcpy(d, s, n);'])]);
  prova('glossario: il codice vero accanto a stringhe e commenti si vede', k(r) === 'free,strcmp,memcpy' || k(r) === 'strcmp,free,memcpy', k(r));
  r = G.coseNuove([rif('es.py', ['+', 'for i, x in enumerate(v):'], ['+', '    print(f"{i}: {x}")'], ['+', '    # zip(a, b)'])]);
  prova('glossario: Python, enumerate e f-string (zip nel commento no)', k(r) === 'enumerate,f-string', k(r));
  r = G.coseNuove([rif('src/Rubrica.java', ['+', '    mappa.computeIfAbsent(k, x -> new ArrayList<>()).add(v);'])]);
  prova('glossario: Java, computeIfAbsent', k(r) === 'computeIfAbsent' && r[0].riga === 1, k(r));
  r = G.coseNuove([rif('Lista.java', ['+', '    public int compareTo(Voto o) {'], ['+', '        try (Scanner in = new Scanner(f)) {'], ['+', '        Iterator<Integer> it = v.iterator(); it.remove();'], ['+', '        v.remove(1);'])]);
  prova('glossario: Java, try-with-resources, Iterator.remove e List.remove distinti', k(r) === 'try-with-resources,Iterator.remove,List.remove', k(r));
  r = G.coseNuove([rif('m.py', ['+', 'def f(x, v=[]):'], ['+', '    return [y for r in m for y in r]'], ['+', 'if a is b: pass'], ['+', 'if a is None: pass'], ['+', 's = t[::-1]'])]);
  prova('glossario: Python, default mutabile, comprehension annidata, is, [::-1]', k(r) === 'default mutabile,list comprehension annidata,is e ==,[::-1]', k(r));
  r = G.coseNuove([rif('m.py', ['+', 'def zip(a, b):'], ['+', '    return list(zip(a, b))'], ['+', 'class Counter:'], ['+', 'c = Counter()'])]);
  prova('glossario: Python, def zip e class Counter dello studente → niente', !r.length, k(r));
  r = G.coseNuove([rif('note.txt', ['+', 'p = realloc(p, n);']), rif('README.md', ['+', 'usa `strtok(s, " ")`'])]);
  prova('glossario: file non C/Java/Python → niente', !r.length, k(r));
  r = G.coseNuove([rif('a.c', ['+', 'a = malloc(1); b = calloc(1, 2); c = realloc(a, 3); free(b);'], ['+', 'strcpy(d, s); strcat(d, s); n = strlen(d); x = atoi(d);'])]);
  prova('glossario: 8 voci nuove → al massimo 5, nell\'ordine del diff', r.length === 5 && k(r) === 'malloc,calloc,realloc,free,strcpy', k(r));
  r = G.coseNuove([rif('a.c', ['+', 'p = realloc(p, n);']), rif('b.c', ['+', 'q = realloc(q, n);'])]);
  prova('glossario: la stessa voce in due file → una volta sola (la prima)', r.length === 1 && r[0].rel === 'a.c', JSON.stringify(r));
  const realloc = V.find(v => v.k === 'realloc');
  r = G.coseNuove([rif('a.c', ['+', 'p = realloc(p, n); t = strtok(s, ",");'])], { visti: { realloc: { g: '2026-10-01', come: 'so' } } });
  prova('glossario: una voce in visti → saltata', k(r) === 'strtok', k(r));
  r = G.coseNuove([rif('a.c', ['+', 'p = realloc(p, n); t = strtok(s, ",");'])], { carte: [{ fronte: realloc.d, retro: 'x' }] });
  prova('glossario: una carta con la stessa domanda → saltata', k(r) === 'strtok', k(r));
  r = G.coseNuove([{ ...rif('a.c', ['+', 'p = realloc(p, n);']), tagliato: true }, { ...rif('b.c', ['+', 'p = realloc(p, n);']), grande: true }]);
  prova('glossario: diff tagliato o grande → si salta il file', !r.length, k(r));
  prova('glossario: static dentro una funzione sì, una funzione static no', k(G.coseNuove([rif('a.c', ['+', '    static int conta = 0;'])])) === 'static locale' && !G.coseNuove([rif('a.c', ['+', 'static int conta(int x) {'])]).length);
  prova('glossario: la riga mostrata è tagliata a 120 caratteri', G.coseNuove([rif('a.c', ['+', '   p = malloc(' + 'x'.repeat(300) + ');'])])[0].testo.length === 120);
  // il file intero di adesso: il diff ha 3 righe di contesto, un malloc vecchio lontano lo vede solo attuale
  const lontano = { ...rif('lista.c', [' ', 'void f() {'], ['+', '  p = malloc(n);'], [' ', '}']), attuale: ['#include <stdlib.h>', 'int *v;', 'void g() { v = malloc(4); }', '', '', '', 'void f() {', '  p = malloc(n);', '}'] };
  prova('glossario: con il file intero, un malloc che c\'era già lontano dal blocco → niente', !G.coseNuove([lontano]).length, k(G.coseNuove([lontano])));
  prova('glossario: senza il file intero quel malloc esce (vale solo il diff)', k(G.coseNuove([{ ...lontano, attuale: null }])) === 'malloc');
  r = G.coseNuove([{ ...rif('lista.c', ['+', '  p = malloc(n);'], ['+', '  q = malloc(m);']), attuale: ['int main() {', '  p = malloc(n);', '  q = malloc(m);', '  // malloc(x) in un commento', '  puts("malloc(");', '}'] }]);
  prova('glossario: con il file intero, se malloc è solo nelle righe + (e in commenti o stringhe) → esce', k(r) === 'malloc', k(r));
  r = G.coseNuove([{ ...rif('lista.c', ['+', '  p = malloc(n);']), attuale: ['/* una volta', '   v = malloc(4);', '*/', '  p = malloc(n);'] }]);
  prova('glossario: il file intero si pulisce con i /* */ su più righe', k(r) === 'malloc', k(r));
  prova('glossario: linguaDi', G.linguaDi('lista.h') === 'c' && G.linguaDi('src/main.c') === 'c' && G.linguaDi('Main.java') === 'java' && G.linguaDi('es.py') === 'python' && G.linguaDi('LEGGIMI.md') === null && G.linguaDi('Makefile') === null && G.linguaDi('') === null);
  prova('glossario: niente blocchi o file storti non rompono', G.coseNuove([{ rel: 'a.c' }, null, { rel: 'b.c', blocchi: [{}] }].filter(Boolean)).length === 0 && G.coseNuove().length === 0);
  // la carta e l'esame
  const x = G.coseNuove([rif('lab3/lista.c', ['+', 'p2 = realloc(p, n);'])])[0], c = G.cartaDa(x);
  prova('glossario: la carta ha la domanda davanti e la fonte dietro', c.fronte === realloc.d && c.retro === realloc.r + '\n\nDa: lab3/lista.c, riga 1');
  const esami = [{ id: 'a1', nome: 'Analisi 1' }, { id: 'p1', nome: 'Programmazione 1' }, { id: 'f1', nome: 'Fondamenti di Java', fatto: true }, { id: 'l1', nome: 'Laboratorio di algoritmi' }];
  prova('glossario: esame della carta: il corso del progetto, se no programmazione, se no nessuno', G.esameDi(esami, 'Laboratorio di algoritmi') === 'l1' && G.esameDi(esami, null) === 'p1' && G.esameDi(esami, 'Fondamenti di Java') === 'p1' && G.esameDi([{ id: 'a1', nome: 'Analisi 1' }]) === null && G.esameDi() === null);
  // segna: D.codice.glossario nasce qui, e salva una volta
  const finto = { D: { codice: { memoria: {} } }, salvati: 0 }; finto.salva = () => finto.salvati++; finto.oggi = () => '2026-10-07';
  await G.segna('realloc', 'carta', finto); await G.segna('strtok', 'so', finto);
  prova('glossario: segna scrive visti con giorno e modo, e salva', finto.D.codice.glossario.visti.realloc.g === '2026-10-07' && finto.D.codice.glossario.visti.realloc.come === 'carta' && finto.D.codice.glossario.visti.strtok.come === 'so' && finto.salvati === 2 && finto.D.codice.memoria);
  r = G.coseNuove([rif('a.c', ['+', 'p = realloc(p, n); t = strtok(s, ",");'])], { visti: finto.D.codice.glossario.visti });
  prova('glossario: dopo segna la voce non torna', !r.length, k(r));
  // dalla barra: coseNuoveDi chiede il diff al main (qui finto) e salta i file non C/Java/Python, grandi, tagliati o in errore
  const chiamate = [], diffs = {
    'lista.c': rif('lista.c', ['+', 't = strtok(s, " ");']), 'note.txt': rif('note.txt', ['+', 'free(p)']), 'Big.java': rif('Big.java', ['+', 'x.stream()']),
    'tagliato.py': { ...rif('tagliato.py', ['+', 'zip(a, b)']), tagliato: true }, 'rotto.c': { errore: 'non trovato' },
  };
  const finta = async (canale, a) => { if (canale === 'progetto:righe') return null; chiamate.push(a); if (!a.rel) return { file: [{ rel: 'lista.c', stato: 'cambiato', piu: 1, meno: 0 }, { rel: 'note.txt', stato: 'cambiato', piu: 1 }, { rel: 'Big.java', stato: 'cambiato', piu: 900, grande: true }, { rel: 'tagliato.py', stato: 'nuovo', piu: 3000 }, { rel: 'rotto.c', stato: 'cambiato', piu: 1 }, { rel: 'via.c', stato: 'tolto', meno: 4 }] }; return diffs[a.rel]; };
  const l = await coseNuoveDi('p1', { da: 10, a: 20, invoca: finta, dati: { D: { codice: {}, carte: [] } } });
  prova('barra: coseNuoveDi trova strtok con file, riga e progetto', l.length === 1 && l[0].voce.k === 'strtok' && l[0].rel === 'lista.c' && l[0].riga === 1 && l[0].id === 'p1', JSON.stringify(l));
  prova('barra: coseNuoveDi chiede solo i file C/Java/Python non grandi e non tolti, con lo stesso tratto', chiamate.filter(a => a.rel).map(a => a.rel).join(',') === 'lista.c,tagliato.py,rotto.c' && chiamate.every(a => a.id === 'p1' && a.da === 10 && a.a === 20), JSON.stringify(chiamate));
  const tanti = async (c, a) => a.rel ? rif(a.rel, ['+', 'x = 1;']) : { file: Array.from({ length: 15 }, (_, i) => ({ rel: `f${i}.c`, stato: 'cambiato', piu: 1 })) };
  let n = 0; await coseNuoveDi('p1', { invoca: async (c, a) => { if (a.rel && c === 'progetto:diff') n++; return tanti(c, a); }, dati: { D: { codice: {} } } });
  prova('barra: coseNuoveDi guarda al massimo 10 file', n === 10, n);
  // coseNuoveDi chiede il file intero solo per i file cambiati, a pezzi di 400 righe, e se non arriva tutto vale il diff
  const pezzi = [], vecchio = Array.from({ length: 850 }, (_, i) => i === 600 ? '  v = malloc(4);' : i === 849 ? '  p = malloc(n);' : 'x++;');
  const conFile = async (c, a) => {
    if (c === 'progetto:righe') { pezzi.push([a.rel, a.da, a.a]); return { rel: a.rel, totale: vecchio.length, righe: vecchio.slice(a.da - 1, a.a).map((s, i) => ({ n: a.da + i, s })) }; }
    return a.rel ? rif(a.rel, ['+', '  p = malloc(n);']) : { file: [{ rel: 'grande.c', stato: 'cambiato', piu: 1 }, { rel: 'nuovo.c', stato: 'nuovo', piu: 1 }] };
  };
  const cf = await coseNuoveDi('p1', { invoca: conFile, dati: { D: { codice: {}, carte: [] } } });
  prova('barra: coseNuoveDi, file cambiato letto intero (3 pezzi) e malloc vecchio a riga 601 → esce dal file nuovo', JSON.stringify(pezzi) === '[["grande.c",1,400],["grande.c",401,800],["grande.c",801,1200]]' && cf.length === 1 && cf[0].rel === 'nuovo.c', JSON.stringify({ pezzi, cf }));
  const senza = await coseNuoveDi('p1', { invoca: async (c, a) => c === 'progetto:righe' ? { errore: 'Non riesco a leggere il file.' } : conFile(c, a), dati: { D: { codice: {}, carte: [] } } });
  prova('barra: coseNuoveDi, se progetto:righe non risponde → vale solo il diff', senza.length === 1 && senza[0].rel === 'grande.c', JSON.stringify(senza));
  const avviso = console.warn; console.warn = () => { };
  prova('barra: coseNuoveDi, se il main non risponde o fuori dal desktop → [] in silenzio', (await coseNuoveDi('p1', { invoca: async () => { throw new Error('giù'); }, dati: { D: {} } })).length === 0 && (await coseNuoveDi('p1')).length === 0);
  prova('barra: coseNuoveDi con un diff senza blocchi → []', (await coseNuoveDi('p1', { invoca: async (c, a) => a.rel ? { rel: a.rel } : { file: [{ rel: 'a.c', piu: 1 }] }, dati: { D: {} } })).length === 0);
  console.warn = avviso;
  // «Mettila nel ripasso» con il vero dati.js (localStorage finto): la carta in D.carte, poi la voce non torna
  globalThis.localStorage ||= { getItem: () => null, setItem() { }, removeItem() { } };
  globalThis.addEventListener ||= () => { }; globalThis.dispatchEvent ||= () => { }; globalThis.CustomEvent ||= class { };
  const DA = await G.dati();
  DA.D.esami.push({ id: 'prg', nome: 'Programmazione 1', cfu: 12 });
  const turno = await coseNuoveDi('p1', { invoca: async (c, a) => a.rel ? rif('lab3/lista.c', [' ', 'int main() {'], ['+', '  char *t = strtok(s, " ");']) : { file: [{ rel: 'lab3/lista.c', stato: 'cambiato', piu: 1 }] } });
  const carta = turno.length === 1 && await mettiNelRipasso(turno[0]);
  const strtok = V.find(v => v.k === 'strtok');
  prova('barra: «Mettila nel ripasso» crea la carta con la domanda e la fonte, nell\'esame di programmazione', carta && DA.D.carte.includes(carta) && carta.fronte === strtok.d && carta.retro === strtok.r + '\n\nDa: lab3/lista.c, riga 2' && carta.esameId === 'prg', JSON.stringify(carta));
  prova('barra: dopo «Mettila nel ripasso» la voce non ricompare', DA.D.codice.glossario.visti.strtok.come === 'carta' && (await coseNuoveDi('p1', { invoca: async (c, a) => a.rel ? rif('altro.c', ['+', 't = strtok(NULL, " ");']) : { file: [{ rel: 'altro.c', stato: 'cambiato', piu: 1 }] } })).length === 0);
  // la sezione: niente se la lista è vuota; i testi giusti, con l'HTML scappato
  const scheda = { children: [], append() { throw new Error('non doveva toccare'); } };
  prova('barra: lista vuota → la scheda resta com\'è', mostraCoseNuove(scheda, []) === null && mostraCoseNuove(scheda, null) === null && htmlCoseNuove([]) === '');
  const h = htmlCoseNuove(G.coseNuove([rif('lab3/lista.c', ['+', 'p2 = realloc(p, n); if (a < b) t = strtok(s, ",");'])]));
  prova('barra: la sezione ha titolo, file e riga, domanda e i bottoni', h.includes('Cose nuove: <code>realloc</code>, <code>strtok</code>') && h.includes('<b>lab3/lista.c, riga 1</b>') && h.includes('Domanda da orale:') && h.includes('data-risposta>Risposta<') && h.includes('Non vede le idee, solo i nomi.') && h.includes('if (a &lt; b)') && !h.includes(realloc.r), h);
}

console.log(`${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
