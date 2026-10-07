// Il libretto nei sistemi dei voti (js/libretto.js, js/dati.js, js/sistemi.js): node test/libretto-sistemi.mjs
// 1) in Italia tutto come prima: media(), serve(), simula(), cfuFatti(), registraVoto() e i dati letti dal disco danno gli
//    STESSI numeri delle funzioni di prima (copiate qui sotto com'erano), e i comandi sono quelli del riconoscitore;
// 2) un libretto per ogni sistema (es fr de pt br uk us): registrare un voto detto nella barra, la media, il voto finale,
//    «quanto mi serve», «e se prendo», il libretto incollato nel benvenuto, la finestra della pagina;
// 3) i comandi nelle altre lingue (spagnolo, francese, tedesco, inglese, portoghese) con il loro sistema e le frasi della
//    barra nella lingua scelta.
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.removeEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
// benvenuto.js in node (come test/unita.mjs)
globalThis.DOMParser ||= class { }; globalThis.matchMedia ||= () => ({ matches: false }); globalThis.window ||= globalThis; globalThis.document ||= { addEventListener() { }, querySelector() { return null; }, documentElement: { classList: { add() { } } } }; globalThis.navigator ||= {}; globalThis.requestAnimationFrame ||= f => setTimeout(f, 16);
const L = await import('../js/lingua.js');
const Dm = await import('../js/dati.js');
const S = await import('../js/sistemi.js');
const C = await import('../js/comandi.js');
const LB = await import('../js/libretto.js');
const B = await import('../js/benvenuto.js').catch(e => ({ errore: e }));

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const uguale = (nome, a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); prova(nome, x === y, `\n   ${x}\n ≠ ${y}`); };
const vicino = (nome, a, b, eps = 1e-9) => prova(nome, a != null && Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const D = () => Dm.D;
const cmd = f => LB.interpretaVoti(f, C.interpreta);

/* ---------- 1. Italia: come prima ---------- */
// le funzioni di js/dati.js com'erano prima dei sistemi dei voti (ef9921f), copiate qui per il confronto
const PRIMA = {
  valore: e => (e.lode ? Number(D().profilo.lode || 30) : e.voto),
  media(lista = Dm.fatti()) {
    const conVoto = lista.filter(e => e.voto != null && !e.idoneita);
    const cfu = conVoto.reduce((s, e) => s + e.cfu, 0);
    if (!conVoto.length) return { ponderata: null, aritmetica: null, base: null, cfuVoto: 0, somma: 0, n: 0 };
    const somma = conVoto.reduce((s, e) => s + PRIMA.valore(e) * e.cfu, 0);
    const ponderata = somma / cfu, aritmetica = conVoto.reduce((s, e) => s + PRIMA.valore(e), 0) / conVoto.length;
    return { ponderata, aritmetica, base: ponderata * 110 / 30, cfuVoto: cfu, somma, n: conVoto.length };
  },
  cfuFatti: () => Dm.fatti().reduce((s, e) => s + e.cfu, 0),
  serve(baseObiettivo) {
    const m = PRIMA.media(), mancano = Math.max(0, (D().profilo.cfuTotali || 180) - PRIMA.cfuFatti() - 6);
    if (!mancano) return null;
    const mediaObiettivo = baseObiettivo * 30 / 110;
    const v = (mediaObiettivo * (m.cfuVoto + mancano) - m.somma) / mancano;
    return { voto: v, cfu: mancano, possibile: v <= 30, gia: v < 18 };
  },
  simula(esameId, voto, lode = false) {
    const e = Dm.esame(esameId); if (!e) return null;
    const finto = { ...e, voto, lode: lode && voto === 30, idoneita: false, fatto: true };
    const lista = [...Dm.fatti().filter(x => x.id !== e.id), finto];
    const prima = PRIMA.media(), dopo = PRIMA.media(lista);
    return { prima, dopo, delta: prima.ponderata == null ? null : dopo.ponderata - prima.ponderata };
  },
  inForma: e => ({ ...e, cfu: Number(e.cfu) || 6, voto: e.voto !== null && e.voto !== '' && Number.isInteger(+e.voto) && +e.voto >= 18 && +e.voto <= 30 ? +e.voto : null }),
};
let seme = 11;
const caso = () => (seme = (seme * 1103515245 + 12345) % 2147483648) / 2147483648;
const E = (nome, cfu, voto, lode = false, fatto = true, x = {}) => ({ id: 'e' + Math.floor(caso() * 1e9).toString(36), nome, cfu, data: '2026-01-10', voto, lode, idoneita: fatto && voto == null, fatto, oreObiettivo: null, ...x });
const libretti = [Dm.esempio(), { ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, lode: 31 }, esami: [E('Analisi 1', 9, 30, true), E('Fisica', 6, 27), E('Chimica', 12, 18), E('Logica', 6, null, false, false)] }];
for (let k = 0; k < 6; k++) {
  const esami = [];
  for (let i = 0, n = 2 + Math.floor(caso() * 15); i < n; i++) { const v = caso() < .1 ? null : 18 + Math.floor(caso() * 13); esami.push(E('Esame ' + i, [3, 6, 9, 12][Math.floor(caso() * 4)], v, v === 30 && caso() < .5, caso() < .85)); }
  libretti.push({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, cfuTotali: [180, 120, 300][k % 3], lode: [30, 32, 33][k % 3], ...(k % 2 ? { sistema: 'it' } : {}) }, esami });
}
let n = 0;
for (const d of libretti) {
  Dm.sostituisci(structuredClone(d));
  prova('it: il sistema è l\'Italia', Dm.sistemaVoti() === 'it' && LB.italiano());
  uguale(`it libretto ${n}: media`, Dm.media(), PRIMA.media());
  uguale(`it libretto ${n}: media di tutti`, Dm.media(D().esami), PRIMA.media(D().esami));
  prova(`it libretto ${n}: cfuFatti`, Dm.cfuFatti() === PRIMA.cfuFatti());
  for (const b of [66, 99, 100, 105, 110]) uguale(`it libretto ${n}: serve(${b})`, Dm.serve(b), PRIMA.serve(b));
  for (const e of D().esami) for (const [v, l] of [[18, false], [27, false], [30, true], [29, true]]) uguale(`it libretto ${n}: simula ${e.nome} ${v}${l ? 'L' : ''}`, Dm.simula(e.id, v, l), PRIMA.simula(e.id, v, l));
  const f = Dm.votoFinale();
  if (f) vicino(`it libretto ${n}: voto finale = base`, f.valore, PRIMA.media().base);
  n++;
}
// i dati letti dal disco o da un backup: in Italia il voto si controlla come prima (intero 18-30)
for (const v of [28, '28', 30, 18, 17, 31, 8.5, '8,5', 27.5, '', null, 'A']) {
  Dm.sostituisci({ ...Dm.VUOTO(), esami: [{ id: 'x1', nome: 'X', cfu: '9', voto: v, fatto: true }] });
  uguale(`it: voto ${JSON.stringify(v)} letto come prima`, D().esami[0], PRIMA.inForma({ id: 'x1', nome: 'X', cfu: '9', voto: v, fatto: true }));
}
// registraVoto: la lode solo con il 30
Dm.sostituisci({ ...Dm.VUOTO(), esami: [E('Fisica', 6, null, false, false)] });
const fis = D().esami[0];
Dm.registraVoto(fis.id, { voto: 29, lode: true }); prova('it: 29 e lode non esiste', fis.voto === 29 && fis.lode === false);
Dm.registraVoto(fis.id, { voto: 30, lode: true }); prova('it: 30 e lode', fis.voto === 30 && fis.lode === true && fis.fatto);
// i comandi italiani: in Italia esattamente quelli del riconoscitore
Dm.sostituisci(Dm.esempio());
for (const f of ['ho preso 28 in fisica 2', '30 e lode ad analisi 2', 'se prendo 25 in basi di dati', 'quanto mi serve per 110', 'quanto mi serve per 1,5', 'ho preso 8,5 in fisica 2', 'ho preso A- in fisica 2', 'libretto', 'media', 'focus 50 su analisi 2', 'ho passato inglese', 'ciao'])
  uguale(`it: «${f}» come il riconoscitore`, cmd(f), C.interpreta(f));
prova('it: l\'oggetto è proprio quello del riconoscitore', (() => { let x = null; const r = LB.interpretaVoti('ho preso 28 in fisica 2', f => (x = C.interpreta(f))); return r === x; })());
if (!B.errore) {
  const esse3 = 'Codice  Attività didattica  Anno  CFU  Voto  Data\n00123 - ANALISI MATEMATICA I   1  9  28/30  12/02/2025\n00456 - FISICA GENERALE I   1  9  30 e lode  20/06/2025\nINGLESE B2  1  3  IDONEO  10/01/2025';
  uguale('it: libretto incollato = lettore di Esse3', B.librettoIncollato(esse3), B.librettoSenzaAI(esse3));
} else console.log('(benvenuto.js non caricabile in node:', B.errore.message, ')');

/* ---------- 2. un libretto per ogni sistema ---------- */
// ogni sistema: il profilo, gli esami già dati (voto nella scala), quelli da dare, le frasi dette (in italiano: la lingua
// della barra non è il paese) con il voto atteso, la media attesa, il voto finale scritto, un obiettivo, un «e se» e un
// libretto incollato
const CASI = {
  es: { totali: 240, dati: [['Cálculo I', 6, 7.5], ['Física', 6, 9], ['Álgebra', 6, 6]], detti: [['ho preso 8,5 in programación', 8.5], ['ho preso 10 in estadística', 10]],
    nonValidi: ['ho preso 28 in programación', 'ho preso 12 in programación'], bocciato: 'ho preso 3 in programación', finale: x => x === L.numero(Dm.media().ponderata, 2), obiettivo: 8, se: 9,
    incolla: 'Asignatura\tCréditos\tCalificación\nCálculo I\t6\tNotable (7,5)\nFísica\t6\tSobresaliente 9,0\nÁlgebra\t6\tAprobado 6,0\nQuímica\t6\tMatrícula de Honor\nDibujo\t6\tSuspenso 3,5',
    attesi: [['Cálculo I', 6, 7.5], ['Física', 6, 9], ['Álgebra', 6, 6], ['Química', 6, 10, true]] },
  fr: { totali: 180, dati: [['Analyse 1', 6, 12.5], ['Physique', 6, 15], ['Chimie', 3, 10]], detti: [['ho preso 16/20 in programmation', 16], ['ho preso 14,25 in statistique', 14.25]],
    nonValidi: ['ho preso 28 in programmation'], bocciato: 'ho preso 8 in programmation', finale: x => /Bien|Assez bien|Passable|Très bien/.test(x), obiettivo: 14, se: 18,
    incolla: 'UE | ECTS | Note\nAnalyse 1 | 6 | 12,5/20\nPhysique | 6 | 15\nChimie | 3 | 10/20\nAnglais | 3 | 8/20',
    attesi: [['Analyse 1', 6, 12.5], ['Physique', 6, 15], ['Chimie', 3, 10]] },
  de: { totali: 180, dati: [['Analysis 1', 10, 2.3], ['Physik', 5, 1.7], ['Chemie', 5, 3]], detti: [['ho preso 1,3 in programmierung', 1.3], ['ho preso 2,0 in statistik', 2]],
    nonValidi: ['ho preso 1,5 in programmierung', 'ho preso 28 in programmierung'], bocciato: 'ho preso 5,0 in programmierung', finale: x => /^\d,\d$/.test(x), obiettivo: 2, se: 1,
    incolla: 'Modul;ECTS;Note\nAnalysis 1;10;2,3\nPhysik;5;1,7\nChemie;5;3,0\nLogik;5;5,0\nSeminar;5;bestanden',
    attesi: [['Analysis 1', 10, 2.3], ['Physik', 5, 1.7], ['Chemie', 5, 3], ['Seminar', 5, null]] },
  pt: { totali: 180, dati: [['Análise 1', 6, 14], ['Física', 6, 16], ['Química', 6, 11]], detti: [['ho preso 17 in programação', 17], ['ho preso 13 in estatística', 13]],
    nonValidi: ['ho preso 25 in programação'], bocciato: 'ho preso 8 in programação', finale: x => x === L.numero(Dm.media().ponderata, 2), obiettivo: 16, se: 18,
    incolla: 'Unidade curricular\tECTS\tClassificação\nAnálise 1\t6\t14\nFísica\t6\t16 valores\nQuímica\t6\t11',
    attesi: [['Análise 1', 6, 14], ['Física', 6, 16], ['Química', 6, 11]] },
  br: { totali: 240, dati: [['Cálculo 1', 4, 7.5], ['Física', 4, 8.2], ['Química', 2, 6]], detti: [['ho preso 9,5 in programação', 9.5], ['ho preso 7 in estatística', 7]],
    nonValidi: ['ho preso 28 in programação'], bocciato: 'ho preso 4 in programação', finale: x => x === L.numero(Dm.media().ponderata, 2), obiettivo: 8, se: 10,
    incolla: 'Disciplina\tCréditos\tNota\nCálculo 1\t4\t7,5\nFísica\t4\t8,2\nQuímica\t2\t6,0\nDesenho\t2\t3,0',
    attesi: [['Cálculo 1', 4, 7.5], ['Física', 4, 8.2], ['Química', 2, 6]] },
  uk: { totali: 360, dati: [['Calculus', 15, 65], ['Physics', 15, 72], ['Chemistry', 30, 58]], detti: [['ho preso 68 in programming', 68], ['ho preso 75% in statistics', 75]],
    nonValidi: ['ho preso 120 in programming'], bocciato: 'ho preso 35 in programming', finale: x => /\(\d+,\d\)/.test(x), obiettivo: 70, se: 80,
    incolla: 'Module\tCredits\tMark\nCalculus\t15\t65%\nPhysics\t15\t72\nChemistry\t30\t58\nLogic\t15\t30',
    attesi: [['Calculus', 15, 65], ['Physics', 15, 72], ['Chemistry', 30, 58]] },
  us: { totali: 120, dati: [['Calculus I', 4, 3.7], ['Physics', 4, 3], ['Chemistry', 3, 2.3]], detti: [['ho preso A- in programming', 3.7], ['ho preso B+ in statistics', 3.3], ['ho preso A in history', 4]],
    nonValidi: ['ho preso 28 in programming', 'ho preso 8 in programming'], bocciato: null, finale: x => /^\d,\d\d$/.test(x), obiettivo: 3.5, se: 4,
    incolla: 'Course\tCredits\tGrade\nMATH 221 Calculus I\t4\tA-\nPHYS 201 Physics\t4\tB\nCHEM 101 Chemistry\t3\tC+\nHIST 100 History\t3\tF',
    attesi: [['Calculus I', 4, 3.7], ['Physics', 4, 3], ['Chemistry', 3, 2.3], ['History', 3, 0]] },
};
// la frase di esempio della pagina quando il libretto è vuoto («ho preso 8,5 in fisica», «I got A− in physics»…): la barra
// la capisce, con il voto d'esempio del sistema
function esempioVuoto() {
  const f = L.t('libretto.libretto-vuoto', { voto: LB.votoEsempio() }).match(/<kbd>(.*)<\/kbd>/)?.[1], c = f && cmd(f);
  return c?.tipo === 'voto' && c.voto === LB.leggiVoto(LB.votoEsempio()).voto && !c.fuoriScala;
}
// quello che fa la barra con il comando del voto (esegui → votoSistema in js/lode.js), senza la scheda
function registra(c) {
  if (c.fuoriScala || !LB.valido(c.voto)) return 'non valido';
  if (!LB.contaNelLibretto(c.voto)) return 'non superato';
  const e = c.esame || Dm.aggiungiEsame({ nome: c.nomeDetto, cfu: LB.sis().esame });
  return Dm.registraVoto(e.id, { voto: c.voto, lode: c.lode });
}
const pesata = lista => { const v = lista.filter(e => e.voto != null && !e.idoneita); const c = v.reduce((s, e) => s + e.cfu, 0); return v.reduce((s, e) => s + e.voto * e.cfu, 0) / c; };
for (const [cod, K] of Object.entries(CASI)) {
  const s = S.sistema(cod);
  Dm.sostituisci({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, sistema: cod, cfuTotali: K.totali },
    esami: [...K.dati.map(([nome, cfu, voto]) => E(nome, cfu, voto)), ...['Programmazione', 'Statistica', 'History'].map(nome => E(nome, s.esame, null, false, false))] });
  prova(`${cod}: il sistema`, Dm.sistemaVoti() === cod && !LB.italiano());
  // i dati letti dal disco tengono i voti del sistema (prima un 8,5 o un 2,3 diventavano null)
  uguale(`${cod}: i voti restano quelli del sistema`, Dm.fatti().map(e => e.voto), K.dati.map(x => x[2]));
  vicino(`${cod}: media ponderata`, Dm.media().ponderata, pesata(Dm.fatti()));
  prova(`${cod}: la media non ha la base su 110`, Dm.media().base === null && !('finale' in Dm.media()));
  const fin = Dm.votoFinale();
  prova(`${cod}: voto finale del sistema`, fin && fin.tipo === s.finale && K.finale(LB.formatoFinale(fin)), JSON.stringify(fin) + ' ' + LB.formatoFinale(fin));
  // registrare i voti detti nella barra (in italiano)
  for (const [f, v] of K.detti) {
    const c = cmd(f), e = c && registra(c);
    prova(`${cod}: «${f}» → ${v}`, c?.tipo === 'voto' && c.voto === v && e?.voto === v && e.fatto, JSON.stringify(c));
  }
  for (const f of K.nonValidi) prova(`${cod}: «${f}» non è un voto del sistema`, registra(cmd(f) || { fuoriScala: true }) === 'non valido', JSON.stringify(cmd(f)));
  if (K.bocciato) {
    const prima = Dm.fatti().length, c = cmd(K.bocciato);
    prova(`${cod}: «${K.bocciato}» non sufficiente non va nel libretto`, c?.tipo === 'voto' && registra(c) === 'non superato' && Dm.fatti().length === prima, JSON.stringify(c));
  }
  vicino(`${cod}: media dopo i voti detti`, Dm.media().ponderata, pesata(Dm.fatti()));
  prova(`${cod}: crediti presi`, Dm.cfuFatti() === Dm.fatti().filter(e => e.voto == null || S.superato(e.voto, s)).reduce((x, e) => x + e.cfu, 0));
  // quanto mi serve: la media nei crediti che mancano per arrivare all'obiettivo
  const c = cmd(`quanto mi serve per ${L.numero(K.obiettivo, Number.isInteger(K.obiettivo) ? 0 : 1)}`);
  prova(`${cod}: «quanto mi serve per ${K.obiettivo}»`, c?.tipo === 'serve' && c.base === K.obiettivo, JSON.stringify(c));
  const sv = Dm.serve(K.obiettivo), m = Dm.media(), mancano = K.totali - Dm.cfuFatti();
  prova(`${cod}: serve, crediti che mancano`, sv && sv.cfu === mancano, JSON.stringify(sv));
  vicino(`${cod}: serve, la media giusta`, (m.somma + sv.voto * sv.cfu) / (m.cfuVoto + sv.cfu), K.obiettivo, 1e-9);
  const ts = LB.testoServe(K.obiettivo);
  prova(`${cod}: la frase di «quanto mi serve»`, ts.includes(`<b>${LB.formatoNumero(K.obiettivo)}</b>`) && (sv.gia || !sv.possibile || ts.includes(LB.formatoNumero(sv.voto))) && !/110|CFU/.test(ts), ts);
  const ob = LB.obiettivo();
  prova(`${cod}: obiettivo di partenza migliore della media (o il massimo)`, LB.obiettivoValido(ob) && (s.migliore === 'basso' ? ob < m.ponderata || ob === 1 : ob > m.ponderata || ob === s.max || ob === 4), String(ob));
  const fuori = cmd(cod === 'uk' ? 'quanto mi serve per 30' : cod === 'de' ? 'quanto mi serve per 4,5' : 'quanto mi serve per 99');
  prova(`${cod}: obiettivo fuori dalla scala`, fuori?.tipo === 'serve' && fuori.fuoriScala && LB.testoObiettivoFuori().includes(S.nomeSistema(s)), JSON.stringify(fuori));
  // e se prendo
  const st = D().esami.find(e => !e.fatto);
  const x = Dm.simula(st.id, K.se, false);
  vicino(`${cod}: e se prendo ${K.se}`, x.dopo.ponderata, pesata([...Dm.fatti(), { ...st, voto: K.se }]));
  prova(`${cod}: e se prendo il voto migliore, la media migliora`, x.meglio === true && (s.migliore === 'basso' ? x.delta < 0 : x.delta > 0), JSON.stringify(x.delta));
  const cs = cmd(`se prendo ${S.formato(K.se, s)} in ${st.nome}`);
  prova(`${cod}: «se prendo ${S.formato(K.se, s)} in ${st.nome}»`, cs?.tipo === 'simula' && cs.voto === K.se && cs.esame?.id === st.id, JSON.stringify(cs));
  const tsim = LB.testoSimula(st, K.se);
  prova(`${cod}: la frase di «e se prendo»`, tsim.includes(st.nome) && tsim.includes(LB.formatoMedia(x.dopo.ponderata)) && tsim.includes(S.etichettaFinale(s)), tsim);
  prova(`${cod}: l'esito della barra «e se…»`, LB.esitoSimula(st.id, K.se).includes(LB.formatoMedia(x.dopo.ponderata)));
  const sc = LB.scala();
  prova(`${cod}: i voti della barra «e se…» sono validi, sufficienti, dal peggiore al migliore`, sc.length > 2 && sc.every(v => S.valido(v, s) && S.superato(v, s)) && (s.migliore === 'basso' ? sc[0] > sc.at(-1) : sc[0] < sc.at(-1)), sc.join());
  // la scheda: i numeri della scheda e della pagina
  const q = LB.quadro();
  prova(`${cod}: quadro`, q.crediti === S.nomeCrediti(s) && q.nomeFinale === S.etichettaFinale(s) && q.cfu === Dm.cfuFatti() && q.tot === K.totali && q.valore === LB.formatoFinale(), JSON.stringify(q));
  prova(`${cod}: il voto finale nel riquadro`, q.breve.v === L.numero(q.finale.valore, cod === 'de' || cod === 'uk' ? 1 : 2) && (cod === 'fr' ? q.breve.dett.includes(L.t(`sistemi.mention.${q.finale.mention}`)) : cod === 'uk' ? q.breve.dett === L.t(`sistemi.classe.${q.finale.classe}`) : q.breve.dett === ''), JSON.stringify(q.breve));
  prova(`${cod}: un voto nel libretto si scrive come nel sistema`, Dm.fatti().every(e => LB.votoEsame(e) === S.formato(e.voto, s, { lode: e.lode, idoneita: e.idoneita })));
  // la finestra della pagina: il voto scritto come sul libretto, e l'esempio si rilegge
  prova(`${cod}: l'esempio della pagina si rilegge`, LB.leggiVoto(LB.votoEsempio())?.voto != null && LB.rigaEsempio().includes(LB.votoEsempio()));
  prova(`${cod}: il comando d'esempio del libretto vuoto è un voto`, esempioVuoto(), L.t('libretto.libretto-vuoto', { voto: LB.votoEsempio() }));
  const tot = LB.opzioniTotali();
  prova(`${cod}: crediti della laurea nelle impostazioni`, tot[0] === s.totali && tot.includes(K.totali) && tot.includes(180) && new Set(tot).size === tot.length, tot.join());
  // il libretto incollato nel benvenuto: il lettore generico, voti senza arrotondare
  if (!B.errore) {
    const lib = B.librettoIncollato(K.incolla);
    uguale(`${cod}: libretto incollato`, lib.map(e => [e.nome, e.cfu, e.voto, ...(e.lode ? [true] : [])]), K.attesi);
    const fatti = lib.map(B.votoIncollato);
    prova(`${cod}: libretto incollato salvato senza arrotondare`, fatti.every((e, i) => e.voto === K.attesi[i][2] && e.fatto && e.cfu === K.attesi[i][1]), JSON.stringify(fatti));
    Dm.sostituisci({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, sistema: cod }, esami: fatti.map((e, i) => ({ id: 'p' + i, nome: lib[i].nome, ...e })) });
    vicino(`${cod}: media del libretto incollato`, Dm.media().ponderata, S.media(lib.map((e, i) => ({ ...e, cfu: K.attesi[i][1] })), { sistema: cod }).ponderata);
  }
}
// Stati Uniti: la F conta nel GPA (e nel libretto), ma non dà crediti
Dm.sostituisci({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, sistema: 'us', cfuTotali: 120 }, esami: [E('Calculus', 4, 4), E('History', 3, null, false, false)] });
const cF = cmd('ho preso F in history');
prova('us: «ho preso F in history» → 0, conta nel GPA', cF?.voto === 0 && registra(cF)?.voto === 0, JSON.stringify(cF));
vicino('us: GPA con la F', Dm.media().ponderata, 16 / 7);
prova('us: la F non dà crediti', Dm.cfuFatti() === 4);
// Spagna: la Matrícula de Honor è un 10 con la lode (nella media vale 10)
Dm.sostituisci({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, sistema: 'es' }, esami: [E('Física', 6, 8), E('Cálculo', 6, null, false, false)] });
Dm.registraVoto(D().esami[1].id, { voto: 10, lode: true });
prova('es: 10 con Matrícula', D().esami[1].lode === true && LB.votoEsame(D().esami[1]) === S.formato(10, 'es', { lode: true }) && Dm.media().ponderata === 9);
Dm.registraVoto(D().esami[1].id, { voto: 9, lode: true });
prova('es: la Matrícula solo con il 10', D().esami[1].lode === false);
// Germania: un 5,0 resta nel libretto letto dal disco ma non conta nella media e non dà crediti
Dm.sostituisci({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, sistema: 'de' }, esami: [E('Analysis', 10, 1.7), E('Logik', 5, 5)] });
prova('de: il 5,0 non conta', Dm.media().ponderata === 1.7 && Dm.cfuFatti() === 10 && Dm.votoFinale().valore === 1.7);
prova('de: «quanto mi serve per 1,0» è un obiettivo giusto, «per 0,7» no', cmd('quanto mi serve per 1,0')?.base === 1 && cmd('quanto mi serve per 0,7')?.fuoriScala === true);
// i dati letti dal disco fuori dall'Italia: voti del sistema sì, voti fuori scala no
// (un voto che il sistema non ha si tiene, come numero, ma non conta: lo studente ha cambiato sistema e lo corregge)
for (const [cod, v, atteso, conta] of [['es', 8.5, 8.5, true], ['es', '7,5', null], ['es', 'A', null], ['es', 11, 11, false], ['es', 28, 28, false], ['fr', 16.25, 16.25, true], ['fr', 21, 21, false], ['de', 2.3, 2.3, true], ['de', 2.5, 2.5, false],
  ['us', 3.7, 3.7, true], ['us', 3.5, 3.5, false], ['us', 28, 28, false], ['uk', 65, 65, true], ['uk', 101, null], ['uk', -3, null], ['br', 9.5, 9.5, true], ['pt', 18, 18, true]]) {
  Dm.sostituisci({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, sistema: cod }, esami: [{ id: 'x1', nome: 'X', cfu: 6, voto: v, fatto: true }, { id: 'x2', nome: 'Y', cfu: 6, voto: null, fatto: false }] });
  prova(`${cod}: voto ${JSON.stringify(v)} dal disco → ${atteso}`, D().esami[0].voto === atteso, String(D().esami[0].voto));
  if (atteso != null) {
    const s = S.sistema(cod), m = Dm.media();
    prova(`${cod}: voto ${JSON.stringify(v)} ${conta ? 'conta' : 'non conta'} nella media`, conta ? m.n === (s.bocciatiInMedia || S.superato(atteso, s) ? 1 : 0) : m.n === 0 && Dm.serve(LB.obiettivo()).cfu === (D().profilo.cfuTotali || s.totali) - Dm.cfuFatti() && Dm.simula('x2', s.max).prima.n === 0, JSON.stringify(m));
  }
}
// cambio di sistema: dall'Italia alla Spagna i voti italiani restano (da correggere), la media spagnola parte vuota
Dm.sostituisci(Dm.esempio());
const votiIt = Dm.fatti().map(e => e.voto);
D().profilo.sistema = 'es'; Dm.sostituisci(structuredClone(D()));
uguale('it → es: i voti restano', Dm.fatti().map(e => e.voto), votiIt);
prova('it → es: non contano nella media spagnola', Dm.media().n === 0 && Dm.votoFinale() === null);
// un sistema che non c'è (dati scritti a mano, una versione più nuova) vale l'Italia in tutto: conti, schede e voti dal disco
for (const cod of ['xx', '', null, 42]) {
  Dm.sostituisci({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, sistema: cod }, esami: [E('Analisi', 9, 28), E('Fisica', 6, 8.5)] });
  prova(`sistema ${JSON.stringify(cod)}: vale l'Italia`, Dm.sistemaVoti() === 'it' && LB.italiano() && !('meglio' in Dm.simula(Dm.fatti()[0].id, 30)));
  uguale(`sistema ${JSON.stringify(cod)}: i voti dal disco come in Italia`, Dm.fatti().map(e => e.voto), [28, null]);
}
// un voto detto che il sistema non ha si ridice com'è stato detto («28», non «28,0» del formato tedesco)
Dm.sostituisci({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, sistema: 'de' }, esami: [E('Fisica', 5, null, false, false)] });
for (const [f, d] of [['ho preso 28 in fisica', '28'], ['ho preso 30 e lode in fisica', '30']]) {
  const c = cmd(f);
  prova(`de: «${f}» fuori scala, detto ${d}`, c?.tipo === 'voto' && c.fuoriScala && c.detto === d, JSON.stringify(c));
}

// ogni LB.<funzione> usata da lode.js, pagina.js e benvenuto.js c'è in js/libretto.js (le schede non girano in node)
{
  const { readFileSync } = await import('node:fs');
  for (const f of ['lode.js', 'pagina.js', 'benvenuto.js']) {
    const usate = [...new Set([...readFileSync(new URL('../js/' + f, import.meta.url), 'utf8').matchAll(/\bLB\.(\w+)/g)].map(m => m[1]))];
    const mancano = usate.filter(n => typeof LB[n] !== 'function');
    prova(`${f}: le funzioni di js/libretto.js ci sono (${usate.length})`, usate.length > 2 && !mancano.length, mancano.join(', '));
  }
}

/* ---------- 3. le altre lingue con il loro sistema ---------- */
const LINGUE = [
  ['es', 'es', 'Física', [['saqué un 8,5 en física', 8.5], ['me pusieron un 7 en física', 7]], 'Para llegar a'],
  ['fr', 'fr', 'Physique', [["j'ai eu 16/20 en physique", 16], ["j'ai eu 13,5 en physique", 13.5]], 'Pour arriver à'],
  ['de', 'de', 'Physik', [['ich habe eine 2,3 in Physik', 2.3], ['hab ne 1,7 in Physik', 1.7]], 'Für'],
  ['en', 'us', 'Physics', [['I got an A- in physics', 3.7], ['I got a B+ in physics', 3.3]], 'To reach'],
  ['en', 'uk', 'Physics', [['I got 68 in physics', 68], ['I got 72 in physics', 72]], 'To reach'],
  ['pt', 'br', 'Física', [['tirei 8,5 em física', 8.5], ['tirei 9 em física', 9]], 'Para chegar a'],
];
for (const [lin, cod, nome, frasi, serveInizio] of LINGUE) {
  await L.usa(lin); await C.carica(lin);
  for (const [f, v] of frasi) {
    Dm.sostituisci({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, sistema: cod }, esami: [E('Analysis', 6, S.SISTEMI[cod].sufficienza), E(nome, 6, null, false, false)] });
    const c = cmd(f);
    prova(`${lin}/${cod}: «${f}» → ${v}`, c?.tipo === 'voto' && c.voto === v && c.esame?.nome === nome && registra(c)?.voto === v, JSON.stringify(c));
  }
  const ts = LB.testoServe(LB.obiettivo());
  prova(`${lin}/${cod}: «quanto mi serve» nella lingua della barra`, ts.startsWith(serveInizio) && !ts.includes('{'), ts);
  prova(`${lin}/${cod}: crediti e voto finale nella lingua della barra`, LB.crediti() === S.nomeCrediti(cod) && !LB.crediti().startsWith('sistemi.'));
  prova(`${lin}/${cod}: il comando d'esempio del libretto vuoto è un voto`, esempioVuoto(), L.t('libretto.libretto-vuoto', { voto: LB.votoEsempio() }));
  prova(`${lin}/${cod}: esempio della riga nella lingua della barra`, !LB.rigaEsempio().includes('{') && LB.rigaEsempio().includes(LB.votoEsempio()), LB.rigaEsempio());
}
// ogni lingua della barra con ogni sistema (la lingua non è il paese): la frase d'esempio del libretto vuoto, «quanto mi
// serve» e «e se prendo» detti con il voto del sistema
for (const lin of ['it', 'en', 'es', 'fr', 'de', 'pt']) {
  await L.usa(lin); await C.carica(lin);
  for (const cod of Object.keys(CASI)) {
    Dm.sostituisci({ ...Dm.VUOTO(), profilo: { ...Dm.VUOTO().profilo, sistema: cod } });
    prova(`${lin}/${cod}: il comando d'esempio del libretto vuoto è un voto`, esempioVuoto(), L.t('libretto.libretto-vuoto', { voto: LB.votoEsempio() }));
  }
}
await L.usa('it');

/* ---------- 4. cambio di sistema, lode detta, crediti del sistema, segno in Germania, l'AI ---------- */
{
  await C.carica('it');
  Dm.sostituisci({ ...Dm.VUOTO(), esami: [E('Analisi 1', 9, 28), E('Fisica', 6, null, false, false), E('Chimica', 6, null, false, false)] });
  const an = () => D().esami.find(e => e.nome === 'Analisi 1'), fi = () => D().esami.find(e => e.nome === 'Fisica');
  prova('Italia → Spagna: il sistema cambia', Dm.cambiaSistema('es') === true && Dm.sistemaVoti() === 'es' && D().profilo.cfuTotali === 240 && D().profilo.totaliScelti === true);
  prova('Italia → Spagna: il 28 resta com\'era, col suo sistema', an().voto === 28 && an().sistema === 'it' && Dm.altroSistema(an()));
  prova('Spagna: il 28 italiano non conta nella media, i crediti sì', Dm.media().n === 0 && Dm.cfuFatti() === 9, JSON.stringify(Dm.media()));
  uguale('Spagna: il 28 si mostra nel suo sistema', LB.votoEsame(an()), L.t('libretto.voto-altro-sistema', { voto: '28', sistema: S.nomeSistema('it') }));
  Dm.registraVoto(fi().id, { voto: 8.5 });
  prova('Spagna: 8,5 registrato e senza sistema accanto', fi().voto === 8.5 && !('sistema' in fi()) && Dm.media().n === 1);
  prova('Spagna → Italia: torna il 28, l\'8,5 resta com\'era', Dm.cambiaSistema('it') && !('sistema' in an()) && fi().sistema === 'es' && fi().voto === 8.5 && D().profilo.cfuTotali === 180);
  Dm.sostituisci(JSON.parse(JSON.stringify(D())));   // riletto dal disco
  prova('Italia: l\'8,5 della Spagna non diventa null rileggendo i dati', fi().voto === 8.5 && fi().sistema === 'es');
  prova('Italia: conta solo il 28', Dm.media().n === 1 && Dm.media().ponderata === 28);
  prova('Italia → Spagna: l\'8,5 conta di nuovo', Dm.cambiaSistema('es') && !('sistema' in fi()) && an().sistema === 'it' && Dm.media().ponderata === 8.5);
  prova('stesso sistema: niente cambia', Dm.cambiaSistema('es') === false);
  // la lode detta in un sistema che ce l'ha (la Matrícula de Honor in Spagna)
  for (const f of ['ho preso 10 e lode in chimica', 'ho preso 10 con lode in chimica', 'I got 10 with honours in chemistry', 'I got 10 cum laude in chemistry'])
    prova(`Spagna: «${f}» è un 10 con la lode`, cmd(f)?.voto === 10 && cmd(f)?.lode === true, JSON.stringify(cmd(f)));
  prova('Spagna: «ho preso 9 e lode» non ha la lode', cmd('ho preso 9 e lode in chimica')?.lode === false);
  Dm.cambiaSistema('fr');
  prova('Francia: «20 e lode» non ha la lode (il sistema non ce l\'ha)', cmd('ho preso 20 e lode in chimica')?.lode === false);
  // i crediti di una laurea la prima volta fuori dall'Italia
  prova('profilo: Regno Unito con i 180 di partenza → 360', Dm.profiloInForma({ sistema: 'uk', cfuTotali: 180 }).cfuTotali === 360);
  prova('profilo: crediti già scelti restano', Dm.profiloInForma({ sistema: 'uk', cfuTotali: 180, totaliScelti: true }).cfuTotali === 180);
  prova('profilo: in Italia niente di nuovo', !('totaliScelti' in Dm.profiloInForma({ sistema: 'it', cfuTotali: 180 })));
  uguale('opzioni dei crediti: Italia come sempre', S.opzioniTotali('it', 180), [180, 120, 300, 360]);
  prova('opzioni dei crediti: Spagna, Stati Uniti', S.opzioniTotali('es', 240)[0] === 240 && S.opzioniTotali('us', 120)[0] === 120);
  // Germania: peggiora = freccia giù, senza «+»
  Dm.cambiaSistema('de');
  prova('Germania: il segno del cambio', LB.segno(0.3) === '↓' && LB.segno(-0.3) === '↑');
  Dm.cambiaSistema('es');
  prova('Spagna: il segno del cambio', LB.segno(0.3) === '+' && LB.segno(-0.3) === '−');
  prova('crediti con i decimali', LB.numCrediti(7.5) === L.numero(7.5, 1) && LB.numCrediti(6) === '6');
  // l'AI: i dati dello studente nel sistema scelto, il prompt senza «italiano»
  const AI = await import('../js/ai.js');
  const ctx = AI.contesto();
  prova('AI: i dati dello studente con la scala e i crediti del sistema', ctx.includes('Sistema dei voti: Spagna') && ctx.includes('Crediti (ECTS)') && !ctx.includes('CFU:') && !ctx.includes('base di laurea'), ctx);
  prova('AI: il 28 italiano nei dati dello studente non conta', ctx.includes('nel sistema Italia, non conta qui'));
  prova('AI: niente «studente universitario italiano» con il sistema spagnolo', !AI.sistemaDiBase().includes('universitario italiano') && AI.sistemaDiBase().includes('Spagna') && AI.sistemaLocale().includes('«chiudi lezione»'));
  Dm.cambiaSistema('it');
  prova('AI: in italiano con il sistema italiano il prompt di sempre', AI.sistemaDiBase().includes('di uno studente universitario italiano.\nParli italiano, dai del tu'));
}

console.log(`libretto-sistemi: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
