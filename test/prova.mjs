// Prove della «Prova generale» (js/prova.js), senza browser: node --experimental-vm-modules test/prova.mjs
// I punti e la durata letti dal compito (js/temi.js), i compiti interi e quale proporre, la chiusura con gli esiti scelti
// dallo studente (temi e mappa), il riepilogo senza voti, la fase 'prova' del timer (js/focus.js) e i comandi.
const eventi = [];
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = e => { if (e.detail) eventi.push(e.detail); return true; };
globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
globalThis.window = globalThis; globalThis.document = { visibilityState: 'visible' };
const D = await import('../js/dati.js'), C = await import('../js/comandi.js'), P = await import('../js/programma.js'), TE = await import('../js/temi.js');
const PV = await import('../js/prova.js'), F = await import('../js/focus.js');
D.sostituisci(D.esempio()); D.D.imp.suoni = false;
let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const J = x => JSON.stringify(x);
const T = D.oggi();

/* ---------- dividi: i punti in testa all'esercizio ---------- */
{
  const { pezzi } = TE.dividi(`Prova scritta del 12/02/2024
Esercizio 1 (6 punti). Calcolare l'integrale doppio di xy sul triangolo.
Esercizio 2 (6 pt) Studiare la convergenza della serie di potenze.
Esercizio 3 - 8 punti Risolvere il problema di Cauchy y' = y, y(0) = 1.
Esercizio 4 [7,5 punti] Calcolare il flusso del campo F attraverso la sfera.
Esercizio 5: 4,5 punti: enunciare e dimostrare il teorema di Green.
Esercizio 6 (punti 3) Calcolare la lunghezza della curva data.
Esercizio 7 Trovare massimi e minimi di f sul quadrato.`);
  prova('dividi: punti in sei scritture', J(pezzi.map(p => p.punti)) === '[6,6,8,7.5,4.5,3,null]', J(pezzi.map(p => p.punti)));
  prova('dividi: «(6 punti)» e «- 8 punti» tolti dal testo come prima', pezzi[0].t.startsWith('Calcolare l\'integrale') && pezzi[2].t.startsWith('Risolvere'), J(pezzi.map(p => p.t.slice(0, 20))));
  prova('dividi: un esercizio senza punti → null', pezzi[6].punti === null && TE.dividi('Esercizio 1 Una spira circolare ruota.\nEsercizio 2 Un condensatore piano.').pezzi.every(p => p.punti === null));
  prova('dividi: «3 pentagoni» non sono punti', TE.dividi('Esercizio 1 3 pentagoni regolari sono inscritti in un cerchio.\nEsercizio 2 Calcolare l\'area del cerchio.').pezzi[0].punti === null);
  // il testo pulito resta quello di prima: «(6 punti)» si toglie ancora, il resto non cambia
  const vecchio = TE.dividi('Esercizio 1 (6 punti). Calcolare l\'integrale doppio di f(x, y) = xy.\nES 2 - Una spira circolare ruota in un campo magnetico.');
  prova('dividi: testo uguale a prima', vecchio.pezzi[0].t === 'Calcolare l\'integrale doppio di f(x, y) = xy.' && vecchio.pezzi[1].t === 'Una spira circolare ruota in un campo magnetico.' && vecchio.pezzi[1].punti === null, J(vecchio));
  const u = TE.unisci([{ n: 1, t: 'a', sol: null, punti: 4 }, { n: 2, t: 'b', sol: null, punti: 2 }], 1);
  prova('unisci: i punti si sommano', u[0].punti === 6);
}

/* ---------- durataDi ---------- */
{
  const casi = [['Tempo: 2 ore', 120], ['durata 3h', 180], ['120 minuti', 120], ['2 ore e 30', 150], ['tempo a disposizione: 2h30', 150], ['2h30', 150], ['2 ore e mezza', 150],
    ['durata 10 ore', null], ['Compito di analisi, niente tempo scritto', null], ['Prova del 12/02/2024 ore 9:30. Tempo: 3 ore.', 180], ['15 minuti', null]];
  for (const [t, v] of casi) prova(`durataDi: «${t}» → ${v}`, TE.durataDi(t) === v, TE.durataDi(t));
  prova('dividi: la durata dall\'intestazione', TE.dividi('Analisi 2 · 12/02/2024 · Tempo: 2 ore\nEsercizio 1 Calcolare il gradiente di f.\nEsercizio 2 Calcolare la hessiana di f.').durata === 120);
  prova('dividi: la durata nel testo di un esercizio non conta', TE.dividi('Esercizio 1 Un treno viaggia per 2 ore a 80 km/h.\nEsercizio 2 Calcolare la hessiana di f.').durata === null);
}

/* ---------- metti: punti e durata; i temi vecchi senza campi ---------- */
const PROG = [{ t: 'Integrali doppi e tripli', sotto: [] }, { t: 'Serie di potenze', sotto: [] }, { t: 'Equazioni differenziali', sotto: [] }];
const finto = () => { const e = { id: 'finto' + Math.random(), nome: 'Analisi Finta', cfu: 6, data: D.piuGiorni(T, 20), fatto: false }; P.impostaProgramma(e, PROG.map(a => ({ ...a }))); return e; };
const COMPITO = `Analisi Matematica 2 · Prova scritta del 12/02/2024
Tempo: 2 ore.
Esercizio 1 (6 punti). Calcolare l'integrale doppio di xy sul triangolo di vertici (0,0), (1,0), (1,1).
Esercizio 2 (8 punti) Studiare la convergenza della serie di potenze di x^n/n.
Esercizio 3 (8 punti) Risolvere l'equazione differenziale y'' + y = 0 con y(0) = 1.
Soluzione: y(x) = cos x.
Esercizio 4 (6 punti) Calcolare l'integrale triplo di z sul cilindro.
Esercizio 5 (4 punti) Trovare il raggio di convergenza della serie di potenze di n x^n.`;
{
  const e = finto(), d = TE.dividi(COMPITO);
  TE.metti(e, d.pezzi, { fonte: 'compito.pdf', data: d.data, durata: d.durata });
  prova('metti: punti e durata salvati', J(e.temi.map(x => x.punti)) === '[6,8,8,6,4]' && e.temi.every(x => x.durata === 120), J(e.temi.map(x => [x.punti, x.durata])));
  TE.metti(e, [{ n: 1, t: 'Un esercizio scritto a mano, senza punti' }]);
  prova('metti: senza punti né durata → null', e.temi.at(-1).punti === null && e.temi.at(-1).durata === null);
  // un esame salvato prima di questa versione: i temi non hanno punti né durata
  const vecchio = { id: 'v', nome: 'Vecchio', temi: [1, 2, 3].map(n => ({ id: 'v' + n, t: `Esercizio vecchio numero ${n}`, sol: null, a: null, fonte: 'incollato', data: '2023-06-01', es: n, esiti: [], scad: T })) };
  const cv = PV.compiti(vecchio);
  prova('compiti: temi vecchi senza campi funzionano', cv.length === 1 && cv[0].punti === null && cv[0].durata === null && cv[0].temi.length === 3 && PV.minutiDa(cv[0]) === 120, J(cv));
}

/* ---------- compiti() e scegli() ---------- */
const tema = (id, fonte, data, es, extra = {}) => ({ id, t: `Testo dell'esercizio ${id}`, sol: null, a: null, fonte, data, es, esiti: [], scad: T, ...extra });
{
  const e = { id: 'c', nome: 'C', temi: [
    tema('a3', 'a.pdf', '2023-06-10', 3), tema('a1', 'a.pdf', '2023-06-10', 1), tema('ax', 'a.pdf', '2023-06-10', null), tema('a2', 'a.pdf', '2023-06-10', 2),
    tema('b1', 'b.pdf', '2024-02-12', 1, { punti: 10, durata: 150 }), tema('b2', 'b.pdf', '2024-02-12', 2, { punti: 7.5 }),
    tema('solo', 'c.pdf', '2024-09-01', 1),
    tema('n1', 'incollato', null, 1), tema('n2', 'incollato', null, 2, { punti: 3 }),
  ] };
  const cs = PV.compiti(e);
  prova('compiti: raggruppa per fonte e data, scarta quelli da un esercizio', cs.length === 3 && !cs.some(c => c.temi.some(x => x.id === 'solo')), J(cs.map(c => c.chiave)));
  prova('compiti: il più recente prima, senza data in fondo', J(cs.map(c => c.chiave)) === J(['b.pdf|2024-02-12', 'a.pdf|2023-06-10', 'incollato|']), J(cs.map(c => c.chiave)));
  prova('compiti: in ordine di esercizio, senza numero in fondo', J(cs[1].temi.map(x => x.id)) === J(['a1', 'a2', 'a3', 'ax']));
  prova('compiti: punti sommati solo se ci sono tutti, durata la prima scritta', cs[0].punti === 17.5 && cs[0].durata === 150 && cs[1].punti === null && cs[2].punti === null && PV.minutiDa(cs[0]) === 150);
  prova('scegli: il più recente mai fatto', PV.scegli(e).chiave === 'b.pdf|2024-02-12');
  e.prove = [{ id: 'p1', chiave: 'b.pdf|2024-02-12', g: '2026-09-01', esiti: [] }];
  prova('scegli: uno mai fatto prima di uno già fatto', PV.scegli(e).chiave === 'a.pdf|2023-06-10' && PV.compiti(e)[0].fatto === '2026-09-01');
  e.prove.push({ id: 'p2', chiave: 'a.pdf|2023-06-10', g: '2026-09-20', esiti: [] }, { id: 'p3', chiave: 'incollato|', g: '2026-09-10', esiti: [] }, { id: 'p4', chiave: 'b.pdf|2024-02-12', g: '2026-08-01', esiti: [] });
  // b fatto l'ultima volta il 1° settembre (e prima ad agosto), a il 20, l'incollato il 10: tocca a b
  prova('scegli: tutti fatti → quello fatto da più tempo (conta l\'ultima volta)', PV.scegli(e).chiave === 'b.pdf|2024-02-12', J(PV.compiti(e).map(c => [c.chiave, c.fatto])));
  prova('scegli: nessun compito → null', PV.scegli({ id: 'z', temi: [tema('x', 'a', null, 1)] }) === null);
  const scelti = PV.daTemi(e, ['a3', 'b1']);
  prova('daTemi: gli esercizi scelti a mano', scelti.temi.length === 2 && scelti.chiave === 'scelti|' && scelti.punti === null);
  prova('minutiDa: fra 30 e 240', PV.minutiDa({ durata: 300 }) === 240 && PV.minutiDa({ durata: 20 }) === 30 && PV.minutiDa(null) === 120);
}

/* ---------- la prova in corso e la chiusura ---------- */
{
  const e = finto(), d = TE.dividi(COMPITO);
  TE.metti(e, d.pezzi, { fonte: 'compito.pdf', data: d.data, durata: d.durata });
  const c = PV.scegli(e);
  prova('scegli: il compito incollato, 5 esercizi, 32 punti, 120 minuti', c.temi.length === 5 && c.punti === 32 && PV.minutiDa(c) === 120, J({ n: c.temi.length, p: c.punti, d: c.durata }));
  const t0 = Date.UTC(2026, 9, 7, 9, 0);
  const st = PV.avvia(e, c, PV.minutiDa(c), t0);
  prova('avvia: lo stato della prova', PV.inCorso() === st && st.durata === 120 && st.temi.length === 5 && PV.corrente() === 0 && J(PV.minutiDi()) === '[null,null,null,null,null]');
  prova('compitoDi: rifatto dai temi', PV.compitoDi(e).temi.map(x => x.id).join() === c.temi.map(x => x.id).join());
  PV.passo(t0 + 20 * 60e3); PV.passo(t0 + 72 * 60e3); PV.consegna(t0 + 110 * 60e3);
  prova('passo e consegna: i minuti di ogni esercizio', J(PV.minutiDi()) === '[20,52,38,null,null]' && PV.minutiTotali() === 110, J(PV.minutiDi()));
  PV.consegna(t0 + 115 * 60e3);
  prova('consegna: una volta sola', PV.inCorso().consegnata === t0 + 110 * 60e3);
  const arg = n => e.programma.argomenti.find(a => a.t === n);
  const [x1, x2, x3, x4, x5] = c.temi, mins = PV.minutiDi();
  const come = ['giusto', 'meta', 'sbagliato', 'nonfatto', 'giusto'];
  const p = PV.chiudi(e, c, c.temi.map((x, i) => ({ tema: x.id, come: come[i], min: mins[i] })), { T, min: PV.minutiTotali(), durata: 120 });
  prova('chiudi: giusto → fra 7 giorni ed esito «giusta» sull\'argomento', x1.scad === D.piuGiorni(T, 7) && x1.esiti.at(-1).e === 'giusto' && arg('Integrali doppi e tripli').esiti.some(y => y.e === 'giusta' && y.f === 'tema'), J(x1));
  prova('chiudi: a metà → fra 3 giorni e «parziale» sulla mappa', x2.scad === D.piuGiorni(T, 3) && arg('Serie di potenze').esiti.some(y => y.e === 'parziale' && y.f === 'tema'), J(arg('Serie di potenze').esiti));
  prova('chiudi: sbagliato → fra 3 giorni', x3.scad === D.piuGiorni(T, 3) && arg('Equazioni differenziali').esiti.at(-1)?.e === 'sbagliata');
  prova('chiudi: non fatto → niente', x4.scad === T && x4.esiti.length === 0 && !x4.fatto);
  prova('chiudi: la prova in e.prove, quella in corso tolta', e.prove.length === 1 && e.prove[0] === p && p.chiave === c.chiave && p.g === T && p.min === 110 && p.durata === 120 && p.esiti.length === 5 && PV.inCorso() === null, J(p));
  prova('chiudi: il compito risulta fatto oggi', PV.compiti(e)[0].fatto === T);
  prova('esito: «meta» non entra nei bottoni dell\'esercizio singolo', !('meta' in TE.ESITI) && J(Object.keys(TE.ESITI)) === '["giusto","sbagliato","nonso"]');
  for (let i = 0; i < 35; i++) PV.chiudi(e, c, [{ tema: x5.id, come: 'nonfatto' }], { T });
  prova('chiudi: al massimo 30 prove, le più recenti', e.prove.length === 30 && !e.prove.includes(p));
  prova('chiudi: esiti sconosciuti scartati', PV.chiudi(e, c, [{ tema: x5.id, come: 'perfetto' }], { T }).esiti.length === 0);
  prova('dati: l\'esame con e.prove resta un backup valido', D.backupValido({ ...JSON.parse(JSON.stringify(D.D)), esami: [{ ...D.D.esami[0], prove: e.prove }] }));

  /* ---------- il riepilogo ---------- */
  const r = PV.riepilogo(p, c), testo = r.join(' ');
  prova('riepilogo: quanti ne hai fatti', r[0] === 'Hai fatto 4 esercizi su 5.', r[0]);
  prova('riepilogo: l\'esercizio più lungo, coi segni', testo.includes('Sull\'esercizio 2 sei stato 52 minuti su 110.'), testo);
  prova('riepilogo: i punti dei giusti (a metà non conta), detto chiaro', testo.includes('Gli esercizi che segni giusti valgono 10 punti su 32. Lo dici tu: Lode non corregge.'), testo);
  prova('riepilogo: niente voto né trentesimi', !/voto|\/\s*30|trentesim/i.test(testo), testo);
  prova('riepilogo: la mappa', r.at(-1) === 'Gli esiti sono nella mappa del programma.' && PV.riepilogo(p, c, { mappa: false }).at(-1).includes('temi d\'esame'));
  const senzaSegni = { ...p, esiti: p.esiti.map(x => ({ ...x, min: null })) };
  prova('riepilogo: senza «Passo al prossimo» niente frase sui minuti', !PV.riepilogo(senzaSegni, c).join(' ').includes('sei stato'));
  const senzaPunti = { ...c, punti: null };
  prova('riepilogo: i punti solo se tutti gli esercizi li hanno', !PV.riepilogo(p, senzaPunti).join(' ').includes('punti'));
  const uno = { esiti: [{ tema: x1.id, come: 'giusto', min: null }, { tema: x2.id, come: 'nonfatto', min: null }] };
  prova('riepilogo: un esercizio solo, al singolare', PV.riepilogo(uno, null)[0] === 'Hai fatto 1 esercizio su 2.');
  const mezzo = PV.riepilogo({ esiti: [{ tema: 'a', come: 'giusto' }, { tema: 'b', come: 'sbagliato' }] }, { temi: [{ id: 'a', punti: 7.5 }, { id: 'b', punti: 2 }], punti: 9.5 }).join(' ');
  prova('riepilogo: i decimali con la virgola', mezzo.includes('valgono 7,5 punti su 9,5'), mezzo);
}

/* ---------- il timer: la fase 'prova' ---------- */
{
  const vero = Date.now; let ora = vero(); Date.now = () => ora;
  try {
    const prima = D.D.sessioni.length, e = D.D.esami[0];
    F.avvia({ fase: 'prova', min: 30, esameId: e.id });
    prova('focus: etichetta «Prova generale»', F.etichetta() === 'Prova generale');
    ora += 6 * 60e3; const r = F.ferma();
    prova('focus: ferma dopo 6 minuti conta la sessione', r.era.fase === 'prova' && D.D.sessioni.length === prima + 1 && D.D.sessioni.at(-1).min === 6 && D.D.sessioni.at(-1).esameId === e.id, J(D.D.sessioni.at(-1)));
    F.avvia({ fase: 'prova', min: 30 }); ora += 3 * 60e3; F.ferma();
    prova('focus: sotto i 5 minuti no', D.D.sessioni.length === prima + 1);
    eventi.length = 0;
    F.avvia({ fase: 'prova', min: 1, esameId: e.id }); ora += 6 * 60e3;
    await new Promise(r => setTimeout(r, 400));   // il giro del timer (250 ms) se ne accorge
    const fine = eventi.find(x => x.evento === 'fine');
    prova('focus: a tempo scaduto «fine» con fase prova, e niente pausa', fine?.fase === 'prova' && fine.esameId === e.id && F.stato() === null && !eventi.some(x => x.evento === 'avvio' && x.fase === 'pausa'), J(eventi));
    prova('focus: a tempo scaduto la sessione conta', D.D.sessioni.length === prima + 2 && D.D.sessioni.at(-1).min === 1);
    // focus e pausa come prima
    F.avvia({ min: 25 }); prova('focus: l\'etichetta del focus non cambia', F.etichetta() !== 'Prova generale' && F.stato().fase === 'focus'); ora += 6 * 60e3; F.ferma();
    prova('focus: il focus fermato conta come prima', D.D.sessioni.length === prima + 3);
    eventi.length = 0; F.avvia({ min: 1 }); ora += 2 * 60e3;
    await new Promise(r => setTimeout(r, 400));
    prova('focus: dopo un focus parte ancora la pausa', F.stato()?.fase === 'pausa' && F.etichetta() === 'Pausa', J(F.stato()));
    F.ferma();
  } finally { Date.now = vero; }
}

/* ---------- i comandi ---------- */
const c = f => C.interpreta(f);
{
  const x = c('prova generale di analisi 2');
  prova('comando: prova generale di analisi 2', x?.tipo === 'prova' && x.esame?.nome === 'Analisi 2' && x.nomeDetto === 'analisi 2', J(x));
  prova('comando: a voce, «due» in cifre', c('Prova generale di analisi due.')?.esame?.nome === 'Analisi 2');
  prova('comando: compito intero, fammi fare un compito intero, simulazione del compito', c('compito intero di analisi 2')?.tipo === 'prova' && c('fammi fare un compito intero')?.tipo === 'prova' && c('fammi fare un compito intero')?.nomeDetto === '' && c('simulazione del compito di analisi 2')?.esame?.nome === 'Analisi 2');
  prova('comando: «se prendo 30 in analisi» resta la simulazione del voto', c('se prendo 30 in analisi')?.tipo === 'simula');
  prova('comando: «temi d\'esame di analisi 2» resta temi', c("temi d'esame di analisi 2")?.tipo === 'temi' && c('esercizio di analisi 2')?.tipo === 'temi');
  prova('comando: «simulazione d\'esame» resta il quiz a crocette', c("simulazione d'esame di analisi 2")?.tipo === 'crocette' && c("simulazione d'esame di analisi 2").simulazione === true);
  prova('comando: «prova il progetto» resta al progetto', c('prova il progetto')?.tipo === 'progetto');
  prova('comando: negli esempi', C.ESEMPI.some(([f]) => /^prova generale/.test(f)));
}

/* ---------- il modulo e gli agganci ---------- */
{
  const fs = await import('node:fs'), leggi = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
  prova('prova.js: modulo valido con le sue funzioni', ['compiti', 'scegli', 'avvia', 'passo', 'consegna', 'chiudi', 'riepilogo'].every(k => typeof PV[k] === 'function'));
  const sw = leggi('../sw.js');
  prova('sw.js: js/prova.js nella cache, versione nuova', sw.includes("'js/prova.js'") && /CACHE = 'lode-v(\d+)'/.test(sw) && +sw.match(/CACHE = 'lode-v(\d+)'/)[1] >= 11);
  const lode = leggi('../js/lode.js'), f = lode.slice(lode.indexOf('function provaEsiti'), lode.indexOf("/* ---------- il programma d'esame"));
  prova('lode.js: le soluzioni solo dopo «Salva»', f.length > 200 && f.indexOf('x.sol') > f.indexOf("salvaB.addEventListener('click'"), f.slice(0, 120));
  prova('lode.js: la durata passa a TE.metti', /TE\.metti\(e, pezzi, \{ fonte, data: d\.data, durata: d\.durata \}\)/.test(lode));
  prova('programma.js: non chiama la prova generale', !leggi('../js/programma.js').includes('prova.js'));
}

console.log(`${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
