// I sistemi dei voti (js/sistemi.js): node test/sistemi.mjs
// 1) in Italia gli STESSI numeri di media(), serve() e simula() di js/dati.js, su libretti di prova (con la lode, senza voti,
//    con le idoneità, con la lode che vale 31 o 33, a crediti finiti); 2) ogni sistema: scala, lettura dei voti, validità,
//    sufficienza, media, voto finale, «che media mi serve», «e se prendo»; 3) il lettore generico di libretti incollati;
//    4) formato e etichette in tutte le lingue.
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const Dati = await import('../js/dati.js');
const S = await import('../js/sistemi.js');
const L = await import('../js/lingua.js');

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const uguale = (nome, a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); prova(nome, x === y, `\n   ${x}\n ≠ ${y}`); };
const vicino = (nome, a, b, eps = 1e-9) => prova(nome, a != null && Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const senzaFinale = m => { const { finale, ...r } = m; return r; };

/* ---------- 1. Italia: gli stessi numeri di js/dati.js ---------- */
let seme = 7;
const caso = () => (seme = (seme * 1103515245 + 12345) % 2147483648) / 2147483648;
const E = (nome, cfu, voto, lode = false, fatto = true) => ({ id: 'e' + Math.floor(caso() * 1e9).toString(36), nome, cfu, data: '2026-01-10', voto, lode, idoneita: fatto && voto == null, fatto, oreObiettivo: null });
const libretti = [
  { nome: 'esempio di Lode', d: Dati.esempio() },
  { nome: 'vuoto', d: { v: 1, profilo: { cfuTotali: 180, lode: 30 }, esami: [] } },
  { nome: 'senza voti (solo idoneità)', d: { v: 1, profilo: { cfuTotali: 180, lode: 30 }, esami: [E('Inglese', 3, null), E('Tirocinio', 6, null), E('Analisi 2', 9, null, false, false)] } },
  { nome: 'con la lode', d: { v: 1, profilo: { cfuTotali: 180, lode: 30 }, esami: [E('Analisi 1', 9, 30, true), E('Fisica', 6, 27), E('Chimica', 6, 24), E('Analisi 2', 9, null, false, false)] } },
  { nome: 'lode che vale 31', d: { v: 1, profilo: { cfuTotali: 180, lode: 31 }, esami: [E('Analisi 1', 9, 30, true), E('Fisica', 6, 30, true), E('Chimica', 12, 18), E('Logica', 6, null, false, false)] } },
  { nome: 'lode che vale 33', d: { v: 1, profilo: { cfuTotali: 120, lode: 33 }, esami: [E('Diritto privato', 12, 30, true), E('Economia', 9, 22), E('Storia', 6, 25), E('Diritto penale', 12, null, false, false)] } },
  { nome: 'tutti 18', d: { v: 1, profilo: { cfuTotali: 180, lode: 30 }, esami: [E('A', 6, 18), E('B', 6, 18), E('C', 12, 18), E('D', 6, null, false, false)] } },
  { nome: 'crediti finiti (serve → null)', d: { v: 1, profilo: { cfuTotali: 30, lode: 30 }, esami: [E('A', 12, 28), E('B', 12, 26), E('C', 6, null, false, false)] } },
  { nome: 'magistrale 120', d: { v: 1, profilo: { cfuTotali: 120, lode: 30 }, esami: [E('Machine learning', 9, 29), E('Sistemi', 6, 30, true), E('Reti', 6, 23), E('Tesi', 6, null, false, false)] } },
  { nome: 'cfuTotali mancante (vale 180)', d: { v: 1, profilo: { cfuTotali: 0, lode: 30 }, esami: [E('A', 6, 25), E('B', 9, 27), E('C', 6, null, false, false)] } },
];
// libretti a caso (con il seme fisso: riproducibili)
for (let k = 0; k < 8; k++) {
  const esami = [];
  const n = 2 + Math.floor(caso() * 20);
  for (let i = 0; i < n; i++) {
    const cfu = [3, 5, 6, 8, 9, 12, 15][Math.floor(caso() * 7)], r = caso();
    const voto = r < 0.1 ? null : 18 + Math.floor(caso() * 13), lode = voto === 30 && caso() < 0.5;
    esami.push(E('Esame ' + i, cfu, voto, lode, caso() < 0.85));
  }
  libretti.push({ nome: `a caso ${k}`, d: { v: 1, profilo: { cfuTotali: [180, 120, 300, 60][k % 4], lode: [30, 31, 32, 33][k % 4] }, esami } });
}
let confronti = 0;
for (const { nome, d } of libretti) {
  Dati.sostituisci(d);
  const D = Dati.D, fatti = Dati.fatti(), opz = { sistema: 'it', lode: D.profilo.lode, totali: D.profilo.cfuTotali };
  uguale(`it ${nome}: media`, senzaFinale(S.media(fatti, opz)), Dati.media());
  uguale(`it ${nome}: media di tutti gli esami`, senzaFinale(S.media(D.esami, opz)), Dati.media(D.esami));
  for (const b of [66, 90, 100, 105, 110, 113]) uguale(`it ${nome}: serve(${b})`, S.serve(b, fatti, opz), Dati.serve(b));
  for (const e of D.esami) for (const [v, l] of [[18, false], [24, false], [30, false], [30, true], [29, true]]) {
    const a = S.simula(e, v, l, fatti, opz), b = Dati.simula(e.id, v, l);
    uguale(`it ${nome}: simula ${e.nome} ${v}${l ? 'L' : ''}`, { prima: senzaFinale(a.prima), dopo: senzaFinale(a.dopo), delta: a.delta }, b);
    confronti++;
  }
  const m = S.media(fatti, opz);
  if (m.ponderata != null) vicino(`it ${nome}: finale = base`, S.finale(m.ponderata, 'it').valore, Dati.media().base);
}
prova('confronti con dati.js abbastanza', confronti >= 100, String(confronti));
prova('simula esame che non c\'è', S.simula(null, 28, false, []) === null);

/* ---------- 2. i sistemi ---------- */
prova('otto sistemi', S.CODICI.join() === 'it,es,fr,de,pt,br,uk,us');
for (const [l, c] of [['it', 'it'], ['es', 'es'], ['fr', 'fr'], ['de', 'de'], ['pt', 'br'], ['en', 'uk'], ['xx', 'it']]) prova(`predefinito ${l} → ${c}`, S.predefinito(l) === c);
prova('sistema sconosciuto vale l\'Italia', S.sistema('zz') === S.SISTEMI.it && S.sistema(undefined).cod === 'it');
prova('Germania: migliore basso', S.SISTEMI.de.migliore === 'basso' && Object.values(S.SISTEMI).filter(s => s.migliore === 'basso').length === 1);
for (const s of Object.values(S.SISTEMI)) {
  prova(`${s.cod}: sufficienza nella scala`, s.sufficienza >= s.min && s.sufficienza <= s.max);
  prova(`${s.cod}: sufficienza valida e superata`, S.valido(s.sufficienza, s) && S.superato(s.sufficienza, s));
  prova(`${s.cod}: massimo valido`, S.valido(s.max, s));
}

// lettura dei voti
const lv = (x, s) => { const r = S.leggiVoto(x, s); return r && (r.idoneita ? 'I' : r.voto + (r.lode ? 'L' : '')); };
const casi = [
  ['it', '30L', '30L'], ['it', '30 e lode', '30L'], ['it', '30 E LODE', '30L'], ['it', '30/30 e lode', '30L'], ['it', '30 cum laude', '30L'], ['it', '28/30', '28'],
  ['it', '28', '28'], ['it', '18', '18'], ['it', '17', null], ['it', '31', null], ['it', '29 e lode', null], ['it', '27,5', null], ['it', '28/20', null], ['it', 'idoneo', 'I'],
  ['it', '9 CFU', null], ['it', '', null], ['it', 'ciao', null],
  ['es', '8,5', '8.5'], ['es', '8.5', '8.5'], ['es', '10', '10'], ['es', 'Notable (7,8)', '7.8'], ['es', 'Sobresaliente 9,5', '9.5'], ['es', 'MH', '10L'],
  ['es', 'Matrícula de Honor', '10L'], ['es', '9,8 Matrícula de Honor', '9.8L'], ['es', '7,25', '7.25'], ['es', '10,5', null], ['es', '8/10', '8'], ['es', 'apto', 'I'], ['es', '6 ECTS', null],
  ['fr', '16/20', '16'], ['fr', '12,75/20', '12.75'], ['fr', '12,5', '12.5'], ['fr', '21', null], ['fr', '8/10', null], ['fr', 'validé', 'I'],
  ['de', '2,3', '2.3'], ['de', '1.7', '1.7'], ['de', '1,0', '1'], ['de', '4,0', '4'], ['de', '5,0', '5'], ['de', '2,5', null], ['de', '0,7', null], ['de', 'sehr gut', '1'],
  ['de', 'befriedigend', '3'], ['de', 'nicht ausreichend', '5'], ['de', 'bestanden', 'I'], ['de', '6', null],
  ['pt', '14', '14'], ['pt', '16/20', '16'], ['pt', '14,5', '14.5'], ['pt', '20', '20'], ['pt', 'aprovado', 'I'],
  ['br', '8,5', '8.5'], ['br', '6', '6'], ['br', '11', null],
  ['uk', '65%', '65'], ['uk', '65 %', '65'], ['uk', '72', '72'], ['uk', '39%', '39'], ['uk', '101', null], ['uk', 'pass', 'I'],
  ['us', 'A', '4'], ['us', 'A-', '3.7'], ['us', 'A−', '3.7'], ['us', 'b+', '3.3'], ['us', 'C-', '1.7'], ['us', 'D', '1'], ['us', 'F', '0'], ['us', 'A+', '4'],
  ['us', 'E', null], ['us', 'F+', null], ['us', '3.7', '3.7'], ['us', '3.5', null], ['us', 'A- (3.7)', '3.7'], ['us', 'P', 'I'], ['us', '65%', null],
];
for (const [s, x, atteso] of casi) prova(`leggiVoto ${s} «${x}»`, lv(x, s) === atteso, `→ ${lv(x, s)}, atteso ${atteso}`);

// validità e sufficienza: i casi limite
prova('it 30 valido, 30.5 no', S.valido(30, 'it') && !S.valido(30.5, 'it') && !S.valido('30', 'it'));
prova('de 4,0 sufficiente', S.superato(4, 'de'));
prova('de 5,0 bocciato', S.valido(5, 'de') && !S.superato(5, 'de'));
prova('de 1,0 il migliore', S.superato(1, 'de') && !S.valido(0.7, 'de'));
prova('uk 39% non basta, 40% sì', !S.superato(39, 'uk') && S.superato(40, 'uk'));
prova('us D passa, D− e F no', S.superato(1, 'us') && !S.superato(0.7, 'us') && !S.superato(0, 'us'));
prova('es 4,9 no, 5 sì', !S.superato(4.9, 'es') && S.superato(5, 'es'));
prova('fr 9,99 no, 10 sì', !S.superato(9.99, 'fr') && S.superato(10, 'fr'));
prova('br 6 sì, 5,9 no', S.superato(6, 'br') && !S.superato(5.9, 'br'));

// media e voto finale
const X = (voto, cfu, lode = false) => ({ id: Math.random().toString(36).slice(2), voto, cfu, lode, idoneita: false, fatto: true });
const mde = S.media([X(1.3, 10), X(2.0, 5), X(2.7, 5)], { sistema: 'de' });
vicino('de: media ponderata', mde.ponderata, (1.3 * 10 + 2 * 5 + 2.7 * 5) / 20);
prova('de: Gesamtnote troncata (1,825 → 1,8)', mde.finale.valore === 1.8 && mde.finale.tipo === 'gesamtnote', JSON.stringify(mde.finale));
prova('de: Gesamtnote 2,3 resta 2,3 (niente errori di virgola)', S.finale(2.3, 'de').valore === 2.3 && S.finale(1.7, 'de').valore === 1.7 && S.finale(2.29999, 'de').valore === 2.2);
prova('de: 5,0 non conta nella media', S.media([X(2, 5), X(5, 5)], { sistema: 'de' }).ponderata === 2);
const mus = S.media([X(4, 3), X(3.7, 4), X(0, 3)], { sistema: 'us' });
vicino('us: GPA con A, A− e F (la F conta)', mus.ponderata, (12 + 14.8 + 0) / 10);
prova('us: tipo gpa', mus.finale.tipo === 'gpa');
prova('fr: mentions', S.finale(9.9, 'fr').mention === null && S.finale(10, 'fr').mention === 'passable' && S.finale(12.4, 'fr').mention === 'assezBien' && S.finale(14, 'fr').mention === 'bien' && S.finale(17, 'fr').mention === 'tresBien');
prova('uk: classi', S.finale(72, 'uk').classe === 'first' && S.finale(65, 'uk').classe === 'upperSecond' && S.finale(55, 'uk').classe === 'lowerSecond' && S.finale(41, 'uk').classe === 'third' && S.finale(39, 'uk').classe === 'fail');
prova('uk: 39% non entra nella media', S.media([X(39, 20), X(70, 20)], { sistema: 'uk' }).ponderata === 70);
prova('es: Matrícula vale 10', S.media([X(10, 6, true), X(8, 6)], { sistema: 'es' }).ponderata === 9);
prova('es: la lode italiana non vale fuori dall\'Italia', S.media([X(10, 6, true)], { sistema: 'es', lode: 33 }).ponderata === 10);
prova('pt/br: media 0-20 e 0-10', S.media([X(14, 6), X(16, 6)], { sistema: 'pt' }).finale.valore === 15 && S.media([X(7, 4), X(9, 4)], { sistema: 'br' }).finale.valore === 8);
prova('it: base solo in Italia', S.media([X(14, 6)], { sistema: 'pt' }).base === null && S.media([X(27, 6)], { sistema: 'it' }).base === 99);
const zero = S.media([X(28, 0), X(30, 0)], { sistema: 'it' });
prova('crediti zero: niente ponderata, sì aritmetica', zero.ponderata === null && zero.base === null && zero.finale === null && zero.aritmetica === 29 && zero.cfuVoto === 0);
prova('crediti zero: serve non esplode', S.serve(100, [X(28, 0)], { sistema: 'it', totali: 180 }).cfu === 174);
prova('nessun esame', S.media([], { sistema: 'fr' }).ponderata === null && S.finale(null, 'fr') === null);
prova('crediti anche come «crediti»', S.media([{ voto: 8, crediti: 6 }, { voto: 6, crediti: 12 }], { sistema: 'es' }).ponderata === 20 / 3 * 1);

// «che media mi serve»
const sde = S.serve(1.5, [X(2, 30)], { sistema: 'de', totali: 180 });
vicino('de: per arrivare a 1,5 da 2,0 su 30 ECTS serve 1,4 nei 150 che mancano', sde.voto, 1.4);
prova('de: possibile e non già fatto', sde.possibile && !sde.gia && sde.cfu === 150);
prova('de: 1,0 da 3,0 a metà non è possibile', !S.serve(1, [X(3, 90)], { sistema: 'de', totali: 180 }).possibile);
prova('de: 4,0 è già fatto da 2,0', S.serve(4, [X(2, 90)], { sistema: 'de', totali: 180 }).gia);
const sfr = S.serve(14, [X(12, 60)], { sistema: 'fr', totali: 180 });
vicino('fr: per 14 da 12 su 60 serve 15', sfr.voto, 15);
prova('fr: niente prova finale senza voto', sfr.cfu === 120);
prova('uk: 70 da 50 su 240 di 360 → 110, impossibile', !S.serve(70, [X(50, 240)], { sistema: 'uk' }).possibile);
prova('us: GPA 3,0 da 2,0 su 60 di 120 → 4,0 possibile al pelo', S.serve(3, [X(2, 60)], { sistema: 'us' }).voto === 4 && S.serve(3, [X(2, 60)], { sistema: 'us' }).possibile);
prova('es: totali predefiniti 240', S.serve(7, [], { sistema: 'es' }).cfu === 240 && S.serve(7, [], { sistema: 'es' }).voto === 7);
prova('it: crediti finiti → null', S.serve(100, [X(28, 174)], { sistema: 'it', totali: 180 }) === null);

// «e se prendo»
const es1 = X(2, 10), es2 = X(3, 10);
const sim = S.simula({ id: 'n', cfu: 10 }, 1, false, [es1, es2], { sistema: 'de' });
prova('de: un 1,0 migliora (delta negativo, meglio)', sim.delta < 0 && sim.meglio === true);
prova('de: un 4,0 peggiora', S.simula({ id: 'n', cfu: 10 }, 4, false, [es1, es2], { sistema: 'de' }).meglio === false);
prova('us: una A alza il GPA', S.simula({ id: 'n', cfu: 3 }, 4, false, [X(3, 3)], { sistema: 'us' }).meglio === true);
prova('es: Matrícula solo con il 10', S.simula({ id: 'n', cfu: 6 }, 9, true, [], { sistema: 'es' }).dopo.ponderata === 9);
prova('fr: niente lode', S.simula({ id: 'n', cfu: 6 }, 20, true, [], { sistema: 'fr' }).dopo.n === 1);
prova('simula su un esame già dato lo sostituisce', S.simula(es1, 1.3, false, [es1, es2], { sistema: 'de' }).dopo.n === 2);

/* ---------- 3. libretto incollato ---------- */
const lib = (t, s) => S.leggiLibretto(t, s).map(x => `${x.nome}|${x.crediti}|${x.idoneita ? 'I' : x.voto}${x.lode ? 'L' : ''}`).join(' / ');
uguale('libretto it con tab e intestazione', lib('Esame\tCFU\tVoto\nAnalisi 1\t9\t30 e lode\nFisica\t6\t27\nInglese B2\t3\tidoneo', 'it'), 'Analisi 1|9|30L / Fisica|6|27 / Inglese B2|3|I');
uguale('libretto it a spazi', lib('Analisi 1 9 28\nFisica 1 9 CFU 30L\nChimica 6 30 e lode', 'it'), 'Analisi 1|9|28 / Fisica 1|9|30L / Chimica|6|30L');
uguale('libretto es con ; e intestazione', lib('Asignatura;Créditos;Calificación\nCálculo;6;8,5\nÁlgebra;6;Matrícula de Honor\nFísica;6;4,2', 'es'), 'Cálculo|6|8.5 / Álgebra|6|10L');
uguale('libretto fr con | e /20', lib('UE | ECTS | Note\nAnalyse | 6 | 14,5/20\nAlgèbre | 6 | 9/20', 'fr'), 'Analyse|6|14.5');
uguale('libretto de con colonne Note prima di LP', lib('Modul\tNote\tLP\nMathematik I\t1,7\t10\nPhysik\t5,0\t5\nInformatik\t2,3\t5', 'de'), 'Mathematik I|10|1.7 / Informatik|5|2.3');
uguale('libretto pt a più spazi', lib('Unidade curricular    ECTS    Nota\nCálculo I    6    16\nProgramação    7,5    14', 'pt'), 'Cálculo I|6|16 / Programação|7.5|14');
uguale('libretto uk con %', lib('Module · Credits · Mark\nIntroduction to Economics · 20 · 68%\nStatistics · 20 · 39%\nMicroeconomics · 15 · 72', 'uk'), 'Introduction to Economics|20|68 / Microeconomics|15|72');
uguale('libretto us con lettere e F', lib('Course\tCredits\tGrade\nCalculus II\t4\tA-\nChemistry\t3\tB+\nHistory\t3\tF', 'us'), 'Calculus II|4|3.7 / Chemistry|3|3.3 / History|3|0');
uguale('libretto us a spazi', lib('Calculus II 4 A-\nWriting 3 credits B', 'us'), 'Calculus II|4|3.7 / Writing|3|3');
uguale('libretto con codici e date', lib('MAT101 | Analysis I | 6 | 8,5 | 12/02/2025\n12345 - Física | 6 | 7', 'es'), 'Analysis I|6|8.5 / Física|6|7');
uguale('libretto br con vírgola e espaço', lib('Disciplina, Créditos, Nota\nCálculo I, 4, 7,5\nFísica I, 4, 5,0', 'br'), 'Cálculo I|4|7.5');
uguale('libretto senza crediti', lib('Analyse\t15/20', 'fr'), 'Analyse|null|15');
uguale('libretto vuoto e righe di testo', lib('\n\nLibretto dello studente\nStampato il 12/02/2025\n', 'it'), '');
uguale('libretto it: «9 CFU» non è un voto', lib('Analisi | 9 CFU', 'it'), '');
uguale('libretto: voto e crediti in ordine inverso, senza intestazione (it: 9 non è un voto)', lib('Analisi | 28 | 9', 'it'), 'Analisi|9|28');

/* ---------- verifica: casi scritti come li scrive davvero uno studente ---------- */
for (const [s, x, atteso] of [
  ['it', '30 lode', '30L'], ['it', '30elode', '30L'], ['it', '30l', '30L'], ['it', '27 / 30', '27'], ['it', '30,0', '30'], ['it', 'Idonea', 'I'], ['it', 'superato', 'I'],
  ['it', '30 e lod', null], ['it', 'trenta', null], ['it', 'ritirato', null], ['it', '6 cfu', null], ['it', '2026', null],
  ['es', 'Aprobado (5,0)', '5'], ['es', 'matricula', '10L'], ['es', 'Matricula de Honor 10', '10L'], ['es', 'NP', null], ['es', 'no presentado', null], ['es', '11', null], ['es', 'Notable', null],
  ['fr', '14.5/20', '14.5'], ['fr', 'Assez bien 12', '12'], ['fr', 'ADM', null], ['fr', 'défaillant', null], ['fr', '12,755', null],
  ['de', 'sehr gut (1,0)', '1'], ['de', 'BE', 'I'], ['de', 'nicht bestanden', '5'], ['de', 'NB', null], ['de', '1,15', null], ['de', '0,7', null],
  ['pt', 'Muito Bom 18', '18'], ['pt', '14 valores', '14'], ['br', 'aprovada', 'I'], ['br', 'SS', null],
  ['uk', '72 %', '72'], ['uk', 'Merit 65', '65'], ['uk', '2:1', null], ['uk', 'First', null], ['uk', '101', null],
  ['us', 'B +', '3.3'], ['us', 'A–', '3.7'], ['us', 'W', null], ['us', 'I', null], ['us', 'NP', null], ['us', '3.5', null], ['us', 'E', null],
]) prova(`verifica leggiVoto ${s} «${x}»`, lv(x, s) === atteso, String(lv(x, s)));
// libretti scritti come li copia uno studente
uguale('verifica libretto es a spazi con giudizio e MH', lib('Cálculo I 6 8,5\nÁlgebra Lineal 6 Notable 7,8\nFísica 6 Suspenso 3,2\nEstadística 6 Matrícula de Honor', 'es'), 'Cálculo I|6|8.5 / Álgebra Lineal|6|7.8 / Estadística|6|10L');
uguale('verifica libretto es con codice e convocatoria', lib('Código\tAsignatura\tCréditos\tCalificación\tConvocatoria\n10234\tCálculo\t6\tNotable (7,5)\tFeb 2025\n10235\tFísica I\t6\tAPTO\tJun 2025', 'es'), 'Cálculo|6|7.5 / Física I|6|I');
uguale('verifica libretto fr: Coef è la colonna dei crediti', lib('Matière;Coef;Note\nMaths;3;15\nPhysique;2;11,5', 'fr'), 'Maths|3|15 / Physique|2|11.5');
uguale('verifica libretto de con LP e bestanden', lib('Mathematik für Informatiker 1 9 LP 1,7\nTheoretische Informatik 6 LP 2,3\nProgrammierpraktikum 6 LP bestanden', 'de'), 'Mathematik für Informatiker 1|9|1.7 / Theoretische Informatik|6|2.3 / Programmierpraktikum|6|I');
uguale('verifica libretto uk: «Year 1» non è il nome', lib('Year 1 · Introduction to Programming · 20 credits · 74%\nYear 2 · Econometrics · 20 · 61', 'uk'), 'Introduction to Programming|20|74 / Econometrics|20|61');
uguale('verifica libretto us: il codice del corso non è nel nome', lib('MATH 221 Calculus I 4 A\nENGL 101 Composition 3 B-\nCHEM 103 General Chemistry 4 C+', 'us'), 'Calculus I|4|4 / Composition|3|2.7 / General Chemistry|4|2.3');
uguale('verifica libretto us con i semestri in mezzo', lib('Fall 2024\nCalculus I\t4\tA\nSpring 2025\nPhysics\t4\tB\nFall 2024 | Linear Algebra | 3 | B+', 'us'), 'Calculus I|4|4 / Physics|4|3 / Linear Algebra|3|3.3');
uguale('verifica libretto pt/es/de/fr: anno e semestre non sono il nome', [lib('1º ano | Cálculo I | 6 | 16', 'pt'), lib('Primer curso; Cálculo; 6; 8', 'es'), lib('3. Semester | Analysis II | 9 | 2,0', 'de'), lib('Semestre 1 ; Analyse ; 6 ; 13,5', 'fr')].join(' / '), 'Cálculo I|6|16 / Cálculo|6|8 / Analysis II|9|2 / Analyse|6|13.5');
uguale('verifica libretto: «Economics 101» resta il nome, il docente non lo diventa', [lib('Economics 101 20 65', 'uk'), lib('Analisi 1 | Prof. Rossi | 9 | 28', 'it')].join(' / '), 'Economics 101|20|65 / Analisi 1|9|28');
// «che media mi serve»: un esame non superato non dà i crediti (il 5,0 tedesco, la F), ma la F resta nel GPA
{
  const de = S.serve(1.5, [{ voto: 5, cfu: 5 }, { voto: 1, cfu: 5 }], { sistema: 'de', totali: 180 });
  prova('verifica serve de: il 5,0 non dà crediti', de.cfu === 175, String(de.cfu));
  const us = S.serve(3, [{ voto: 0, cfu: 3 }, { voto: 4, cfu: 3 }], { sistema: 'us', totali: 120 });
  vicino('verifica serve us: la F conta nel GPA ma non nei crediti', us.voto, (3 * (6 + 117) - 12) / 117);
  prova('verifica serve us: crediti che mancano', us.cfu === 117, String(us.cfu));
  const es = S.serve(7, [{ voto: 4, cfu: 6 }, { voto: 8, cfu: 6 }, { voto: null, idoneita: true, cfu: 6 }], { sistema: 'es', totali: 240 });
  prova('verifica serve es: il suspenso non dà crediti, l\'apto sì', es.cfu === 228, String(es.cfu));
}

/* ---------- 4. formato ed etichette ---------- */
prova('formato it come nel libretto', S.formato(30, 'it', { lode: true }) === '30L' && S.formato(28, 'it') === '28');
prova('formato it idoneo e vuoto', S.formato(null, 'it', { idoneita: true }) === 'idoneo' && S.formato(null, 'it') === '—');
prova('formato es', S.formato(8.5, 'es') === '8,5' && S.formato(7, 'es') === '7,0' && S.formato(10, 'es', { lode: true }) === '10,0 MH' && S.formato(7.25, 'es') === '7,25');
prova('formato fr e pt', S.formato(16, 'fr') === '16' && S.formato(12.75, 'fr') === '12,75' && S.formato(14, 'pt') === '14');
prova('formato de sempre con un decimale', S.formato(1, 'de') === '1,0' && S.formato(2.3, 'de') === '2,3');
prova('formato uk e us', S.formato(65, 'uk') === '65' && S.formato(3.7, 'us') === 'A−' && S.formato(0, 'us') === 'F' && S.formato(4, 'us') === 'A');
prova('formatoFinale it', S.formatoFinale(S.finale(27, 'it'), 'it') === '99,0/110');
prova('formatoFinale fr', S.formatoFinale(S.finale(13.45, 'fr'), 'fr') === '13,45/20 · Assez bien' && S.formatoFinale(S.finale(8, 'fr'), 'fr') === '8,00/20 · nessuna mention');
prova('formatoFinale uk', S.formatoFinale(S.finale(72, 'uk'), 'uk') === 'First (72,0)');
prova('formatoFinale de', S.formatoFinale(S.finale(1.825, 'de'), 'de') === '1,8');
prova('formatoFinale vuoto', S.formatoFinale(null, 'us') === '—');
prova('etichette it', S.nomeCrediti('it') === 'CFU' && S.etichettaFinale('it') === 'Base di laurea' && S.etichettaFinale('uk') === 'Classe di laurea' && S.nomeSistema('de') === 'Germania · 1,0–5,0');
for (const cod of Object.keys(L.LINGUE)) {
  await L.usa(cod);
  for (const s of S.CODICI) prova(`${cod}: etichette di ${s}`, [S.nomeSistema(s), S.nomeCrediti(s), S.etichettaFinale(s)].every(x => x && !x.startsWith('sistemi.')));
}
await L.usa('en');
prova('en: formato con il punto', S.formato(8.5, 'es') === '8.5' && S.formatoFinale(S.finale(72, 'uk'), 'uk') === 'First (72.0)' && S.formato(null, 'uk', { idoneita: true }) === 'pass');
await L.usa('de');
prova('de: Gesamtnote e Klasse', S.etichettaFinale('de') === 'Gesamtnote' && S.etichettaFinale('uk') === 'Klasse' && S.formato(2.3, 'de') === '2,3');
await L.usa('it');

console.log(`sistemi: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
