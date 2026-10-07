// Prove dei «Temi d'esame» (js/temi.js), senza browser: node --experimental-vm-modules test/temi.mjs
// Dividere un compito in esercizi, la data dell'intestazione, la soluzione del prof, il PDF scansionato, l'abbinamento agli
// argomenti del programma, l'esercizio di oggi, gli intervalli dopo l'esito e l'esito sulla mappa. Più i comandi.
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const D = await import('../js/dati.js'), C = await import('../js/comandi.js'), P = await import('../js/programma.js'), TE = await import('../js/temi.js');
D.sostituisci(D.esempio());
let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const J = x => JSON.stringify(x);
const T = D.oggi();

{
  // il PDF scansionato o illeggibile: il comando suggerito usa il corso vero, mai «analisi 2» scritto fisso
  const src = (await import('node:fs')).readFileSync(new URL('../js/lode.js', import.meta.url), 'utf8');
  // i testi stanno nel catalogo italiano (js/lingue/it/barra3.js): t('chiave') diventa il testo, poi si controlla come prima
  const IT = (await import('../js/lingue/it/barra3.js')).default;
  const f = src.slice(src.indexOf('async function temiDaFile'), src.indexOf('async function schedaTemi')).replace(/\bt\('([\w.-]+)'/g, (x, k) => typeof IT[k] === 'string' ? 't(' + JSON.stringify(IT[k]) : x);
  prova('temiDaFile: senza corso la forma generica, niente «analisi 2» fisso', f.length > 100 && !/analisi 2["']/.test(f) && f.includes("\"«temi d'esame:»\""), f.slice(0, 300));
}

/* ---------- dividere ---------- */
const COMPITO = `Università degli Studi · Analisi Matematica 2
Prova scritta del 12/02/2024
Tempo: 3 ore. Non è ammesso l'uso di appunti o calcolatrici.

Esercizio 1 (6 punti). Calcolare l'integrale doppio di f(x, y) = xy sul dominio D = {0 ≤ x ≤ 1, 0 ≤ y ≤ x}.
Esercizio 2 (8 punti)
Studiare la convergenza della serie di potenze $\\sum x^n / n$ e trovarne il raggio.
1. Raggio di convergenza
2. Comportamento agli estremi
Esercizio 3 (10 punti). Risolvere il problema di Cauchy per l'equazione differenziale y'' + y = 0, y(0) = 1, y'(0) = 0.
Soluzione: y(x) = cos x.`;
{
  const { pezzi, data } = TE.dividi(COMPITO);
  prova('dividi: tre esercizi', pezzi.length === 3 && J(pezzi.map(p => p.n)) === '[1,2,3]', J(pezzi));
  prova('dividi: intestazione scartata', !pezzi.some(p => /Università|Tempo: 3 ore/.test(p.t)), J(pezzi[0]));
  prova('dividi: «(6 punti)» tolto', pezzi[0].t.startsWith('Calcolare l\'integrale doppio'), pezzi[0].t);
  prova('dividi: l\'elenco dentro un esercizio non spezza', pezzi[1].t.includes('1. Raggio') && pezzi[1].t.includes('2. Comportamento'), pezzi[1].t);
  prova('dividi: data dell\'intestazione', data === '2024-02-12', data);
  prova('dividi: «Soluzione:» separa la soluzione', pezzi[2].sol === 'y(x) = cos x.' && !pezzi[2].t.includes('cos x') && pezzi[0].sol === null, J(pezzi[2]));
}
{
  const { pezzi } = TE.dividi('Compito di Fisica 2\nEs. 1 Un condensatore piano ha armature di area 2 cm².\nES 2 - Una spira circolare ruota in un campo magnetico.\nProblema 3: calcolare il campo elettrico di un filo carico.');
  prova('dividi: «Es.», «ES», «Problema»', pezzi.length === 3 && J(pezzi.map(p => p.n)) === '[1,2,3]' && pezzi[1].t.startsWith('Una spira') && pezzi[2].t.startsWith('calcolare'), J(pezzi));
}
{
  const { pezzi } = TE.dividi('ESERCIZIO 1. Trovare i punti stazionari di f(x,y) = x³ − 3xy.\nQuesito 2: enunciare il teorema di Green e applicarlo.\nDomanda 3) Dire quando una forma differenziale è esatta.');
  prova('dividi: «ESERCIZIO 1.», «Quesito», «Domanda»', pezzi.length === 3 && pezzi[0].t.startsWith('Trovare') && pezzi[1].t.startsWith('enunciare') && pezzi[2].t.startsWith('Dire'), J(pezzi));
}
{
  const { pezzi } = TE.dividi('Appello di giugno\n1. Calcolare il limite di (sin x)/x per x che tende a zero.\n2) Studiare la funzione f(x) = x e^{-x} e disegnarne il grafico.\n3. Calcolare la derivata di log(1 + x²) e il suo dominio.');
  prova('dividi: solo «1.» «2)» «3.» in ordine', pezzi.length === 3 && J(pezzi.map(p => p.n)) === '[1,2,3]' && pezzi[1].t.startsWith('Studiare'), J(pezzi));
}
{
  const { pezzi } = TE.dividi('Prova del 3.07.23\n5. Una riga che parte da 5 non apre niente e da sola non basta per dividere il testo.');
  prova('dividi: numeri fuori ordine non spezzano', pezzi.length === 1, J(pezzi));
}
prova('dividi: data «12.02.24»', TE.dataDi('Prova scritta del 12.02.24') === '2024-02-12');
prova('dividi: data «12 febbraio 2024»', TE.dataDi('Appello del 12 febbraio 2024, aula 3') === '2024-02-12' && TE.dividi('Appello del 12 febbraio 2024\nEsercizio 1 Calcolare il gradiente di f.\nEsercizio 2 Calcolare la hessiana di f.').data === '2024-02-12');
{
  const { pezzi, data } = TE.dividi('Calcolare l\'integrale doppio di xy sul quadrato unitario e discutere il risultato.');
  prova('dividi: nessun segno → un pezzo', pezzi.length === 1 && pezzi[0].n === 1 && data === null, J(pezzi));
}
{
  const { pezzi } = TE.dividi('Esercizio 1 Calcolare la derivata di x² sin x e studiarne il segno.\nEsercizio 2\nEsercizio 3 Calcolare l\'integrale di x e^x tra 0 e 1, per parti.');
  prova('dividi: pezzi sotto 15 caratteri col precedente', pezzi.length === 2 && pezzi[1].n === 3, J(pezzi));
}
{
  const molti = Array.from({ length: 40 }, (_, i) => `Esercizio ${i + 1} Calcolare la derivata della funzione numero ${i + 1}.`).join('\n');
  prova('dividi: al massimo 30', TE.dividi(molti).pezzi.length === 30);
}
{
  const { pezzi } = TE.dividi('Esercizio 1 Calcolare il gradiente di f(x,y) = x²y.\nEsercizio 2 Calcolare la divergenza del campo F = (x, y).\nSoluzioni\nEsercizio 1 ∇f = (2xy, x²).\nEsercizio 2 div F = 2.');
  prova('dividi: la sezione «Soluzioni» in fondo va agli esercizi giusti', pezzi.length === 2 && pezzi[0].sol === '∇f = (2xy, x²).' && pezzi[1].sol === 'div F = 2.', J(pezzi));
}
// «Soluzione» conta solo come etichetta: «Soluzione di NaCl…» e «Soluzione generale…» sono testo dell'esercizio
{
  const { pezzi } = TE.dividi('Esercizio 1\nSoluzione di NaCl 0,9%: calcolare la molarità della soluzione fisiologica.\nEsercizio 2\nCalcolare il pH di una soluzione di HCl 0,1 M.');
  prova('dividi: «Soluzione di NaCl…» non è la soluzione del prof', pezzi.length === 2 && pezzi[0].t.startsWith('Soluzione di NaCl 0,9%: calcolare') && pezzi[1].t.startsWith('Calcolare il pH') && pezzi.every(p => p.sol === null), J(pezzi));
}
{
  const { pezzi } = TE.dividi('Esercizio 1 Data l\'equazione y\'\' - y = x.\nSoluzione generale dell\'equazione omogenea: trovarla e poi trovare una soluzione particolare.\nEsercizio 2 Calcolare il limite di sin x / x per x → 0.');
  prova('dividi: «Soluzione generale…» resta nel testo', pezzi.length === 2 && pezzi[0].t.includes('Soluzione generale dell\'equazione omogenea: trovarla') && pezzi[0].sol === null, J(pezzi));
}
{
  const s = t => TE.dividi(`Esercizio 1 Risolvere y'' + y = 0 con y(0) = 1.\n${t}\nEsercizio 2 Calcolare il limite di sin x / x per x → 0.`).pezzi[0].sol;
  prova('dividi: «Soluzione: y = cos x» tiene la soluzione', s('Soluzione: y = cos x') === 'y = cos x', s('Soluzione: y = cos x'));
  prova('dividi: le etichette «**Soluzione**», «Soluzione.», «Soluzione dell\'esercizio 1:», «Svolgimento:», «Risoluzione:»',
    ['**Soluzione**\ny = cos x', 'Soluzione.\ny = cos x', 'Soluzione dell\'esercizio 1:\ny = cos x', 'Svolgimento: y = cos x', 'Risoluzione:\ny = cos x', '**Soluzione:** y = cos x'].every(t => s(t) === 'y = cos x'));
  const { pezzi } = TE.dividi('Esercizio 1\nSoluzione: calcolare la concentrazione molare di 5 g di NaCl in 1 L.\nEsercizio 2 Calcolare il pH di HCl 0,1 M.');
  prova('dividi: un esercizio non resta mai col testo vuoto e tutto in sol', pezzi.length === 2 && pezzi[0].t.includes('calcolare la concentrazione') && pezzi[0].sol === null, J(pezzi));
}
{
  const { pezzi } = TE.dividi('Esercizio 1 Calcola x.\nSoluzione: x = 2\nEsercizio 2 Calcolare il limite di sin x / x per x → 0.');
  prova('dividi: il primo pezzo corto unito al secondo non perde la sua soluzione', pezzi.length === 1 && pezzi[0].t.startsWith('Calcola x.') && pezzi[0].sol === 'x = 2', J(pezzi));
}
{
  const p = TE.unisci([{ n: 1, t: 'a', sol: null }, { n: 2, t: 'b', sol: 'x' }, { n: 3, t: 'c', sol: null }], 1);
  prova('unisci al precedente', p.length === 2 && p[0].t === 'a\nb' && p[0].sol === 'x' && p[1].n === 3);
}
prova('scansione: 3 pagine con 50 caratteri', TE.scansione('[Pagina 1]\n' + 'x'.repeat(50) + '\n[Pagina 2]\n' + 'y'.repeat(50) + '\n[Pagina 3]\n' + 'z'.repeat(50), 3) === true);
prova('scansione: un PDF di testo no', TE.scansione(COMPITO, 2) === false);
prova('minuti: stima dalla lunghezza', TE.minuti('x'.repeat(100)) === 15 && TE.minuti('x'.repeat(500)) === 25 && TE.minuti('x'.repeat(900)) === 40);

/* ---------- metti: sotto i loro argomenti ---------- */
const PROG = [{ t: 'Integrali doppi e tripli', sotto: [] }, { t: 'Serie di potenze', sotto: [] }, { t: 'Equazioni differenziali', sotto: [] }];
const finto = (giorni = 10) => { const e = { id: 'finto' + Math.random(), nome: 'Analisi Finta', cfu: 6, data: D.piuGiorni(T, giorni), fatto: false }; P.impostaProgramma(e, PROG.map(a => ({ ...a }))); return e; };
{
  const e = finto(), { pezzi, data } = TE.dividi(COMPITO + '\nEsercizio 4 Enunciare il teorema di Bolzano-Weierstrass e commentarlo.');
  const r = TE.metti(e, pezzi, { fonte: 'compito.pdf', data });
  const arg = n => e.programma.argomenti.find(a => a.t === n).id;
  prova('metti: abbinati agli argomenti', r.messi === 4 && r.senza === 1 && e.temi[0].a === arg('Integrali doppi e tripli') && e.temi[1].a === arg('Serie di potenze') && e.temi[2].a === arg('Equazioni differenziali') && e.temi[3].a === null, J(r) + J(e.temi.map(x => x.a)));
  prova('metti: campi del tema', e.temi[0].fonte === 'compito.pdf' && e.temi[0].data === '2024-02-12' && e.temi[0].es === 1 && e.temi[0].scad === T && Array.isArray(e.temi[0].esiti) && e.temi[2].sol === 'y(x) = cos x.');
  const r2 = TE.metti(e, pezzi, { fonte: 'compito.pdf', data });
  prova('metti: i doppioni non raddoppiano', r2.messi === 0 && r2.doppi === 4 && e.temi.length === 4, J(r2));
  const r3 = TE.metti(e, [{ n: 1, t: 'Un esercizio scelto a mano dalla scheda di controllo', a: arg('Serie di potenze') }]);
  prova('metti: l\'argomento scelto nella scheda vince', r3.messi === 1 && r3.senza === 0 && e.temi.at(-1).a === arg('Serie di potenze') && e.temi.at(-1).fonte === 'incollato');
  const senzaP = { id: 'x', nome: 'Senza', temi: undefined }, r4 = TE.metti(senzaP, pezzi);
  prova('metti: senza programma si salvano lo stesso, senza argomento', r4.messi === 4 && r4.senza === 4);
  const tanti = { id: 'y', nome: 'Tanti' }; TE.metti(tanti, Array.from({ length: 230 }, (_, i) => ({ n: i, t: `Esercizio numero ${i} sul calcolo` })));
  prova('metti: al massimo 200, i più recenti', tanti.temi.length === 200 && tanti.temi.at(-1).t.includes('229') && !tanti.temi.some(x => x.t === 'Esercizio numero 0 sul calcolo'));
}

/* ---------- l'esercizio di oggi ---------- */
{
  const e = finto(), o = P.oggiDi(e), oggiIds = [...o.studia, ...o.ripassa].map(c => c.a.id), altro = e.programma.argomenti.find(a => !oggiIds.includes(a.id));
  prova('oggi: il piano ha almeno due argomenti oggi e uno no', oggiIds.length >= 2 && !!altro, J(oggiIds));
  const [A1, A2] = oggiIds;
  TE.metti(e, [{ n: 1, t: 'Tema futuro su A1, non ancora', a: A1 }, { n: 2, t: 'Tema su un argomento di un altro giorno', a: altro.id }]);
  e.temi[0].scad = D.piuGiorni(T, 3);
  prova('oggi: rispetta la scadenza (niente di oggi → uno scaduto di un altro argomento)', TE.temaDiOggi(e, T)?.a === altro.id, J(TE.temaDiOggi(e, T)));
  e.temi[1].scad = D.piuGiorni(T, 3);
  prova('oggi: niente in scadenza → null', TE.temaDiOggi(e, T) === null && TE.temiDiOggi(e, T).length === 0);
  TE.metti(e, [{ n: 3, t: 'Primo tema su A1, scaduto da tempo', a: A1 }, { n: 4, t: 'Tema su A2, appena scaduto', a: A2 }, { n: 5, t: 'Tema su A1 già fatto', a: A1 }]);
  e.temi[2].scad = D.piuGiorni(T, -5);
  const fatto = e.temi[4]; TE.esito(e, fatto.id, 'giusto', T);
  prova('oggi: argomento diverso dall\'ultimo fatto', TE.temaDiOggi(e, T)?.a === A2, J(TE.temaDiOggi(e, T)));
  prova('oggi: un solo tema nei giorni normali', TE.temiDiOggi(e, T).length === 1);
  const g = finto(1);   // esame domani: oggi è il ripasso generale
  TE.metti(g, [{ n: 1, t: 'Generale uno', a: g.programma.argomenti[0].id }, { n: 2, t: 'Generale due', a: g.programma.argomenti[0].id }, { n: 3, t: 'Generale tre', a: g.programma.argomenti[1].id }]);
  const gen = TE.temiDiOggi(g, T);
  prova('oggi: ripasso generale, fino a 2 su argomenti diversi', P.oggiDi(g).tipo === 'generale' && gen.length === 2 && gen[0].a !== gen[1].a, J(gen));
  prova('conta per argomento', TE.conta(g)[0][1] === 2);
}

/* ---------- l'esito: intervalli e mappa ---------- */
{
  const e = finto(); TE.metti(e, [{ n: 1, t: 'Calcolare l\'integrale doppio di xy sul triangolo' }]);
  const x = e.temi[0], a = e.programma.argomenti.find(y => y.id === x.a);
  const st = () => P.copertura(e).find(c => c.a.id === a.id);
  prova('esito: prima, mai toccato', st().stato === 0 && !st().debole);
  const g1 = TE.esito(e, x.id, 'nonso', T).giorni, s1 = x.scad;
  prova('esito: non so → 2 giorni, l\'argomento da rivedere', g1 === 2 && s1 === D.piuGiorni(T, 2) && a.esiti.at(-1).f === 'tema' && a.esiti.at(-1).e === 'non so' && st().debole, J(a.esiti));
  const g2 = TE.esito(e, x.id, 'sbagliato', T).giorni;
  prova('esito: sbagliato → 3 giorni', g2 === 3 && x.scad === D.piuGiorni(T, 3) && a.esiti.at(-1).e === 'sbagliata');
  prova('esito: dopo «Sbagliato» non torna prima di 3 giorni', !TE.temaDiOggi(e, T) && !TE.temaDiOggi(e, D.piuGiorni(T, 2)) && TE.temaDiOggi(e, D.piuGiorni(T, 3))?.id === x.id);
  const g3 = TE.esito(e, x.id, 'giusto', T).giorni, g4 = TE.esito(e, x.id, 'giusto', T).giorni;
  prova('esito: giusto → 7, poi il doppio', g3 === 7 && g4 === 14 && x.scad === D.piuGiorni(T, 14), `${g3} ${g4}`);
  prova('esito: la mappa diventa «sicuro»', st().stato === 3 && a.esiti.at(-1).e === 'giusta');
  for (let i = 0; i < 4; i++) TE.esito(e, x.id, 'giusto', T);
  prova('esito: al massimo 60 giorni, ultimi 6 esiti', x.int === 60 && x.esiti.length === 6, `${x.int} ${x.esiti.length}`);
  prova('esito: valore sconosciuto ignorato', TE.esito(e, x.id, 'perfetto', T) === null);
  const s = { id: 's', nome: 'S' }; TE.metti(s, [{ n: 1, t: 'Senza argomento per niente' }]);
  prova('esito: tema senza argomento, nessun errore', TE.esito(s, s.temi[0].id, 'sbagliato', T)?.giorni === 3);
}
{
  const e = { id: 'r', nome: 'R' }; TE.metti(e, [{ n: 1, t: 'Studiare la serie di potenze di x^n' }]);
  P.impostaProgramma(e, PROG.map(a => ({ ...a })));
  prova('programma incollato dopo: i temi si risistemano', TE.risistema(e) === 1 && e.temi[0].a === e.programma.argomenti[1].id);
}

/* ---------- i comandi ---------- */
const c = f => C.interpreta(f);
{
  const x = c("temi d'esame di analisi 2: Esercizio 1 Calcolare l'integrale\nEsercizio 2 Studiare la serie");
  prova('comando: temi d\'esame con il testo', x?.tipo === 'temi' && x.esame?.nome === 'Analisi 2' && x.testo.startsWith('Esercizio 1') && x.testo.includes('\nEsercizio 2'), J(x));
  prova('comando: compiti vecchi, a capo', c('compiti vecchi di analisi 2\nEsercizio 1 bla bla bla')?.testo === 'Esercizio 1 bla bla bla' && c("temi d'esame di analisi 2")?.testo === '');
  prova('comando: esercizio di analisi 2', c('esercizio di analisi 2')?.tipo === 'temi' && c('esercizio di analisi 2').esame?.nome === 'Analisi 2' && c('esercizio di analisi 2').testo === '');
  prova('comando: un esercizio, a voce', c('un esercizio')?.tipo === 'temi' && c('Fammi fare un esercizio.')?.tipo === 'temi' && c('Esercizio di analisi due.')?.esame?.nome === 'Analisi 2');
  prova('comando: «esercizio di c» e «esercizi in python» restano Cosa stampa?', c('esercizio di c')?.tipo === 'stampa' && c('esercizi in python')?.tipo === 'stampa' && c('esercizi di c')?.tipo === 'stampa' && c('esercizio di programmazione')?.tipo === 'stampa' && c('esercizio di java')?.lingua === 'java');
  prova('comando: le domande uscite restano domande', c('domande uscite di analisi 2: teorema di Green?')?.tipo === 'domande');
  prova('comando: negli esempi', C.ESEMPI.some(([f]) => /^temi d'esame/.test(f)));
}

console.log(`${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
