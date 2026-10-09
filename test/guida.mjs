// «Voglio fare…», la parte pura (js/guida.js): node test/guida.mjs
// La scelta della ricetta nelle sei lingue, il piano di una ricetta (le app solo se ci sono), la validazione del piano
// dell'AI (app inventate, testi lunghi, JSON storto), l'aiuto di «Non ci riesco», avanti e indietro, la nota del vault e i dati
// di prima senza D.guida.
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const GU = await import('../js/guida.js');
const D = await import('../js/dati.js');
const L = await import('../js/lingua.js');

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };

/* ---------- la ricetta giusta ---------- */
const RIC = [
  ['scrivere la tesi', 'tesi'], ['una relazione di laboratorio', 'tesi'], ['write my thesis', 'tesi'], ['escribir el TFG', 'tesi'], ['mon mémoire', 'tesi'], ['meine Bachelorarbeit schreiben', 'tesi'], ['escrever o TCC', 'tesi'],
  ['una presentazione', 'presentazione'], ['a presentation on climate data', 'presentazione'], ['una presentación', 'presentazione'], ['eine Präsentation', 'presentazione'], ['uma apresentação', 'presentazione'],
  ['montare un video', 'video'], ['edit a video for youtube', 'video'], ['monter une vidéo', 'video'], ['ein Video schneiden', 'video'],
  ['un sito', 'sito'], ['a website', 'sito'], ['una página web', 'sito'], ['un site', 'sito'], ['eine Webseite', 'sito'],
  ["un'analisi dei dati", 'dati'], ['un grafico dei voti', 'dati'], ['a chart in excel', 'dati'], ['un graphique', 'dati'], ['ein Diagramm', 'dati'], ['uma planilha', 'dati'],
  ['un programma in python', 'codice'], ['programmare in C', 'codice'], ['a java app', 'codice'], ['un videogioco', 'codice'], ['programar en python', 'codice'],
  ["preparare l'esame di analisi", 'esame'], ['prepare for my exam', 'esame'], ['preparar el examen', 'esame'], ['mich auf die Klausur vorbereiten', 'esame'],
  ['imparare a suonare la chitarra', 'generico'], ['organize a trip', 'generico'], ['', 'generico'],
];
for (const [q, k] of RIC) prova(`ricetta: «${q}» → ${k}`, GU.scegliRicetta(q).chiave === k, JSON.stringify(GU.scegliRicetta(q)));
prova('linguaggio: python', GU.scegliRicetta('un programma in python').linguaggio === 'python');
prova('linguaggio: C (e non c come lettera dentro una parola)', GU.scegliRicetta('esercizio in C').linguaggio === 'c' && GU.scegliRicetta('un programma per calcolare').linguaggio === null);
prova('linguaggio: java, non javascript', GU.scegliRicetta('app in java').linguaggio === 'java' && GU.scegliRicetta('un sito in javascript').linguaggio === 'web');

/* ---------- il piano di una ricetta ---------- */
const TROVATE = [{ i: 0, nome: 'Keynote', tipo: 'app' }, { i: 1, nome: 'Microsoft PowerPoint', tipo: 'app' }, { i: 2, nome: 'Visual Studio Code', tipo: 'app' }, { i: 3, nome: 'python3', tipo: 'cli' },
  { i: 4, nome: 'Safari', tipo: 'app' }, { i: 5, nome: 'Claude Code', tipo: 'cli' }, { i: 6, nome: 'Spotify', tipo: 'app' }, { i: 7, nome: 'PyCharm CE', tipo: 'app' }];
const pres = GU.pianoDaRicetta('una presentazione per il seminario', TROVATE);
prova('ricetta: presentazione con le app che ci sono', JSON.stringify(pres.app) === JSON.stringify(['Keynote', 'Microsoft PowerPoint']), JSON.stringify(pres.app));
prova('ricetta: 5 passi con titolo, cosa, fatto quando e aiuto', pres.passi.length === 5 && pres.passi.every(p => p.titolo && p.cosa && p.fattoQuando && p.aiuto));
prova('ricetta: nessun passo di codice in una presentazione', pres.passi.every(p => !p.codice));
const py = GU.pianoDaRicetta('un programma in python', TROVATE);
prova('ricetta: python apre editor e strumenti di python, le app prima degli strumenti', JSON.stringify(py.app) === JSON.stringify(['Visual Studio Code', 'PyCharm CE', 'python3', 'Claude Code']), JSON.stringify(py.app));
prova('ricetta: il linguaggio nel testo dei passi', py.passi.some(p => p.cosa.includes('Python')) && !py.passi.some(p => p.cosa.includes('{linguaggio}')));
prova('ricetta: i passi di codice sono segnati', py.passi.filter(p => p.codice).length === 4 && !py.passi[0].codice);
const gen = GU.pianoDaRicetta('imparare a fare il pane', TROVATE);
prova('generico: 4 passi onesti, nessuna app', gen.fonte === 'generico' && gen.passi.length === 4 && gen.app.length === 0);
prova('generico: il linguaggio di riserva non resta un segnaposto', !JSON.stringify(GU.pianoDaRicetta('programmare', []).passi).includes('{linguaggio}') && JSON.stringify(GU.pianoDaRicetta('programmare', []).passi).includes('il tuo linguaggio'));
prova('il titolo è la frase dello studente con la maiuscola', pres.titolo === 'Una presentazione per il seminario');

/* ---------- il piano dell'AI ---------- */
const NOMI = TROVATE.map(a => a.nome);
const buono = { titolo: 'Sito personale', app: ['visual studio code', 'Photoshop', 'Safari', 'Safari'], passi: [
  { titolo: 'Struttura', cosa: 'Crea la cartella. Apri l\'editor. Scrivi index.html. Poi salva. Questa quinta frase va tolta.', fattoQuando: 'il browser mostra la pagina', app: 'Photoshop', codice: true },
  { titolo: 'Stile', cosa: 'Scrivi il CSS.', fattoQuando: 'si legge bene', app: 'SAFARI', codice: 'sì' },
] };
const v = GU.validaPiano(buono, NOMI);
prova('AI: le app solo dall\'elenco, con il nome giusto e senza doppioni', JSON.stringify(v.app) === JSON.stringify(['Visual Studio Code', 'Safari']), JSON.stringify(v.app));
prova('AI: l\'app inventata di un passo si toglie', !('app' in v.passi[0]) && v.passi[1].app === 'Safari');
prova('AI: al più 4 frasi', !v.passi[0].cosa.includes('quinta'), v.passi[0].cosa);
prova('AI: codice solo se è proprio true', v.passi[0].codice === true && !('codice' in v.passi[1]));
const lungo = GU.validaPiano({ titolo: 'x'.repeat(300), app: [], passi: Array.from({ length: 25 }, (_, k) => ({ titolo: 'Passo ' + k + ' '.repeat(3) + 'parola '.repeat(40), cosa: 'Una frase lunghissima '.repeat(60) + '.', fattoQuando: 'quando '.repeat(80) })) }, NOMI);
prova('AI: al massimo 10 passi', lungo.passi.length === GU.MAX_PASSI);
prova('AI: testi tagliati alla lunghezza giusta', lungo.titolo.length <= 81 && lungo.passi.every(p => p.titolo.length <= 81 && p.cosa.length <= 521 && p.fattoQuando.length <= 181));
for (const [nome, x] of [['null', null], ['una stringa', 'piano'], ['senza passi', { titolo: 'x', app: [] }], ['passi vuoti', { titolo: 'x', app: [], passi: [] }], ['un passo senza cosa', { passi: [{ titolo: 'a' }] }], ['un passo che non è un oggetto', { passi: ['fai tutto'] }], ['passi non array', { passi: { titolo: 'a', cosa: 'b' } }]])
  prova(`AI: JSON storto (${nome}) → null, si usa la ricetta`, GU.validaPiano(x, NOMI) === null);
prova('AI: titolo mancante → null (la barra usa quello della ricetta)', GU.validaPiano({ passi: [{ titolo: 'a', cosa: 'b' }] }, NOMI).titolo === null);
prova('AI: lo schema chiede titolo, app e passi', JSON.stringify(GU.SCHEMA_PIANO.required) === JSON.stringify(['titolo', 'app', 'passi']));
prova('aiuto: spiegazione e al più 6 sotto-passi', (() => { const a = GU.validaAiuto({ spiegazione: 'Fai così.', sottopassi: ['a', 'b', '', 'c', 'd', 'e', 'f', 'g'] }); return a.spiegazione === 'Fai così.' && a.sottopassi.length === 6; })());
prova('aiuto: vuoto o storto → null', GU.validaAiuto({ spiegazione: '', sottopassi: [] }) === null && GU.validaAiuto('x') === null);

/* ---------- avanti, indietro, fine ---------- */
let g = GU.nuova('una presentazione', pres, 1000);
prova('nuova: dal passo 0, a metà', g.i === 0 && GU.aMeta(g) && !GU.finita(g) && g.titolo === pres.titolo);
g = GU.avanti(g, 2000); g = GU.avanti(g, 3000);
prova('avanti: passo 2, i primi due fatti', g.i === 2 && JSON.stringify(g.fatti) === '[0,1]' && g.aggiornata === 3000);
g = GU.indietro(g);
prova('indietro: passo 1, resta fatto', g.i === 1 && JSON.stringify(g.fatti) === '[0,1]');
prova('indietro dal primo resta al primo', GU.indietro({ ...g, i: 0 }).i === 0);
for (let k = 0; k < 10; k++) g = GU.avanti(g);
prova('fine: tutti fatti, non più a metà', GU.finita(g) && !GU.aMeta(g) && g.i === g.passi.length && g.fatti.length === g.passi.length);
prova('una guida rovinata non è a metà', !GU.aMeta({ passi: 'x', i: 0 }) && !GU.aMeta(null) && !GU.aMeta({ passi: [], i: 0 }));
prova('il testo per l\'agente ha il passo', GU.testoAgente(g, py.passi[1]).includes(py.passi[1].titolo) && GU.testoAgente(g, py.passi[1]).includes(py.passi[1].cosa));

/* ---------- la nota del vault ---------- */
const meta = GU.avanti(GU.nuova('un sito', GU.pianoDaRicetta('un sito', TROVATE)));
const nota = GU.testoNota(meta, 'it');
prova('nota: una casella per passo, la prima spuntata', (nota.match(/^- \[[x ]\]/gm) || []).length === meta.passi.length && /^- \[x\] \*\*/m.test(nota) && (nota.match(/^- \[x\]/gm) || []).length === 1, nota);
prova('nota: «Fatto quando» nella lingua del vault', nota.includes('*Fatto quando:'));
prova('nota: il titolo in cima', GU.notaNuova(meta) === '# Un sito\n\n');
prova('nome della cartella senza caratteri vietati', GU.nomeCartella('a/b: c?*"<>|#^[x]') === 'a b c x' && GU.nomeCartella('...') === 'Lode' && GU.nomeCartella('x'.repeat(100)).length === 60);

/* ---------- i dati ---------- */
prova('dati: la guida vuota di partenza è null', D.VUOTO().guida === null);
D.sostituisci({ v: 1, esami: [] });
prova('dati: i dati di prima, senza guida, restano buoni', D.D.guida === null && Array.isArray(D.D.esami));
prova('lingua delle prove: italiano', L.lingua === 'it');

console.log(`guida: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
