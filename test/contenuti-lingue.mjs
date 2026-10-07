// I contenuti nelle sei lingue: node --experimental-vm-modules test/contenuti-lingue.mjs
// - la lettura dei testi incollati dallo studente: un programma e un compito per ogni lingua (it en es fr de pt) si dividono
//   come quello italiano (argomenti, esercizi, punti, soluzione, data, durata), più le domande uscite agli appelli;
// - l'AI: in italiano i prompt restano quelli di sempre, nelle altre lingue c'è la riga «Always answer in …»; i controlli
//   italiani sul giudizio dell'orale solo in italiano, quello delle citazioni in tutte; gli esiti dal catalogo «contenuti»;
// - la voce: la lingua per Whisper e per il browser, le frasi inventate da Whisper nel silenzio nelle sei lingue;
// - i numeri e le ore nella forma della lingua; i nomi degli esami con il numero scritto («physics two»), i giochi, le crocette.
// Le prove in italiano di sempre (temi, prova, programma, tasca) restano nei loro file e non cambiano.
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
globalThis.window = globalThis;   // per voce.js (in node lingua.js resta comunque sull'italiano, salvo usa())
const L = await import('../js/lingua.js');
const D = await import('../js/dati.js'), P = await import('../js/programma.js'), TE = await import('../js/temi.js');
const AI = await import('../js/ai.js'), PA = await import('../js/parole.js'), G = await import('../js/giochi.js'), QC = await import('../js/crocette.js');
const V = await import('../js/voce.js');
D.sostituisci(D.esempio());
let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const J = x => JSON.stringify(x);

/* ---------- programmi, uno per lingua ---------- */
const PROGRAMMI = {
  it: [`Analisi Matematica 2 (9 CFU)
Obiettivi
Lo studente impara a calcolare.
Programma del corso
1. Successioni e serie: criteri di convergenza, serie di potenze
2. Calcolo differenziale in più variabili: derivate parziali, gradiente
3. Integrali multipli: teorema di Fubini, cambio di variabili
Testi consigliati
Bramanti, Pagani, Salsa
Modalità d'esame
Scritto e orale`, ['Successioni e serie', 'Calcolo differenziale in più variabili', 'Integrali multipli'], ['criteri di convergenza', 'serie di potenze']],
  en: [`Calculus II (9 ECTS)
Learning objectives
Students learn to compute.
Course content
1. Sequences and series: convergence tests, power series
2. Differential calculus in several variables: partial derivatives, gradient
3. Multiple integrals: Fubini theorem, change of variables
Recommended textbooks
Stewart, Calculus
Assessment
Written and oral exam`, ['Sequences and series', 'Differential calculus in several variables', 'Multiple integrals'], ['convergence tests', 'power series']],
  es: [`Cálculo II (6 ECTS)
Objetivos
El estudiante aprende a calcular.
Programa de la asignatura
Tema 1. Sucesiones y series: criterios de convergencia, series de potencias
Tema 2. Cálculo diferencial en varias variables: derivadas parciales, gradiente
Tema 3. Integrales múltiples: teorema de Fubini, cambio de variable
Bibliografía
Apostol, Calculus
Evaluación
Examen escrito`, ['Sucesiones y series', 'Cálculo diferencial en varias variables', 'Integrales múltiples'], ['criterios de convergencia', 'series de potencias']],
  fr: [`Analyse 2 (6 ECTS)
Objectifs
Savoir calculer.
Contenu du cours
- Suites et séries : critères de convergence, séries entières
- Calcul différentiel à plusieurs variables : dérivées partielles, gradient
- Intégrales multiples : théorème de Fubini, changement de variables
Bibliographie
Ramis, Deschamps, Odoux
Modalités d'évaluation
Examen écrit`, ['Suites et séries', 'Calcul différentiel à plusieurs variables', 'Intégrales multiples'], ['critères de convergence', 'séries entières']],
  de: [`Analysis 2 (9 ECTS)
Lernziele
Die Studierenden lernen rechnen.
Inhalte
1. Folgen und Reihen: Konvergenzkriterien, Potenzreihen
2. Differentialrechnung in mehreren Variablen: partielle Ableitungen, Gradient
3. Mehrfachintegrale: Satz von Fubini, Variablentransformation
Literatur
Forster, Analysis 2
Prüfungsform
Klausur`, ['Folgen und Reihen', 'Differentialrechnung in mehreren Variablen', 'Mehrfachintegrale'], ['Konvergenzkriterien', 'Potenzreihen']],
  pt: [`Cálculo II (4 créditos)
Objetivos
O aluno aprende a calcular.
Conteúdo programático
1. Sequências e séries: critérios de convergência, séries de potências
2. Cálculo diferencial em várias variáveis: derivadas parciais, gradiente
3. Integrais múltiplas: teorema de Fubini, mudança de variáveis
Bibliografia
Guidorizzi, Um Curso de Cálculo
Avaliação
Provas escritas`, ['Sequências e séries', 'Cálculo diferencial em várias variáveis', 'Integrais múltiplas'], ['critérios de convergência', 'séries de potências']],
};
for (const [cod, [testo, titoli, sotto]] of Object.entries(PROGRAMMI)) {
  const a = P.leggiProgramma(testo);
  prova(`programma ${cod}: tre argomenti, senza testi e modalità d'esame`, J(a.map(x => x.t)) === J(titoli), J(a));
  prova(`programma ${cod}: le voci del primo argomento`, J(a[0]?.sotto) === J(sotto), J(a[0]));
  // il programma letto si usa: una domanda uscita agli appelli finisce sotto il suo argomento
  prova(`programma ${cod}: abbina una domanda al suo argomento`, P.abbina(sotto[1] + ' ' + titoli[0], a)?.t === titoli[0]);
}
// un paragrafo unico con la frase d'apertura («The course covers:», «Der Kurs behandelt folgende Themen:»)
for (const [cod, testo, n] of [
  ['en', 'The course covers the following topics: limits and continuity; derivatives and their applications; Riemann integrals; numerical series.', 4],
  ['es', 'La asignatura aborda los siguientes temas: límites y continuidad; derivadas y aplicaciones; integrales de Riemann; series numéricas.', 4],
  ['fr', 'Le cours traite les thèmes suivants : limites et continuité ; dérivées et applications ; intégrales de Riemann ; séries numériques.', 4],
  ['de', 'Die Vorlesung behandelt folgende Themen: Grenzwerte und Stetigkeit; Ableitungen und Anwendungen; Riemann-Integrale; Zahlenreihen.', 4],
  ['pt', 'A disciplina aborda os seguintes temas: limites e continuidade; derivadas e aplicações; integrais de Riemann; séries numéricas.', 4],
]) {
  const a = P.leggiProgramma(testo);
  prova(`programma ${cod} in un paragrafo: la frase d'apertura non è un argomento`, a.length === n && !/topics|temas|thèmes|Themen/i.test(a[0].t), J(a));
}
// le domande uscite agli appelli: «Q1:», «Pregunta 2:», «Frage 3:», «Questão 4:» si tolgono
{
  const d = P.leggiDomande('Q1: State and prove the mean value theorem?\nPregunta 2: ¿Qué dice el teorema de Fubini?\nFrage 3: Was besagt der Satz von Green?\nQuestão 4: O que diz o teorema de Stokes?\nQuestion 5) What is a power series?');
  prova('domande: le etichette nelle sei lingue si tolgono', J(d.map(x => x.t)) === J(['State and prove the mean value theorem?', '¿Qué dice el teorema de Fubini?', 'Was besagt der Satz von Green?', 'O que diz o teorema de Stokes?', 'What is a power series?']), J(d));
}
// le parole generiche delle altre lingue non bastano a dire l'argomento: «Theorem of Green» → conta Green
prova('chiavi: «theorem», «Satz», «théorème» sono generiche', J(P.chiavi('Theorem of Green')) === J(['green']) && J(P.chiavi('Satz von Green')) === J(['green']) && J(P.chiavi('Théorème de Green')) === J(['green']), J([P.chiavi('Theorem of Green'), P.chiavi('Satz von Green')]));

/* ---------- compiti, uno per lingua ---------- */
const COMPITI = {
  it: [`Università degli Studi · Analisi 1
Prova scritta del 12 febbraio 2024
Tempo: 2 ore e mezza

Esercizio 1 (6 punti)
Calcolare il limite di sin(x)/x per x che tende a zero.
Soluzione: il limite vale 1.

Esercizio 2 (4 punti)
Studiare la funzione e^x - x e disegnarne il grafico.`, '2024-02-12', 150],
  en: [`University of Somewhere · Calculus II
Written exam, February 12, 2024
Time allowed: 2 hours and 30 minutes. No notes.

Exercise 1 (6 points)
Compute the limit of sin(x)/x as x goes to zero.
Solution: the limit is 1.

Exercise 2 (4 points)
Study the function e^x - x and sketch its graph.`, '2024-02-12', 150],
  es: [`Universidad de Algún Lugar · Cálculo I
Examen final, 12 de febrero de 2024
Tiempo: 2 horas y media

Ejercicio 1 (6 puntos)
Calcula el límite de sen(x)/x cuando x tiende a cero.
Solución: el límite vale 1.

Ejercicio 2 (4 puntos)
Estudia la función e^x - x y dibuja su gráfica.`, '2024-02-12', 150],
  fr: [`Université de Quelque Part · Analyse 1
Partiel du 12 février 2024
Durée : 2h30

Exercice 1 (6 points)
Calculer la limite de sin(x)/x quand x tend vers zéro.
Corrigé : la limite vaut 1.

Exercice 2 (4 points)
Étudier la fonction e^x - x et tracer son graphe.`, '2024-02-12', 150],
  de: [`Universität Irgendwo · Analysis 1
Klausur vom 12. Februar 2024
Bearbeitungszeit: 150 Minuten

Aufgabe 1 (6 Punkte)
Berechnen Sie den Grenzwert von sin(x)/x für x gegen null.
Lösung: Der Grenzwert ist 1.

Aufgabe 2 (4 Punkte)
Diskutieren Sie die Funktion e^x - x und skizzieren Sie den Graphen.`, '2024-02-12', 150],
  pt: [`Universidade de Algum Lugar · Cálculo I
Prova 1, 12 de fevereiro de 2024
Duração: 2 horas e meia

Questão 1 (6 pontos)
Calcule o limite de sen(x)/x quando x tende a zero.
Resolução: o limite vale 1.

Questão 2 (4 pontos)
Estude a função e^x - x e esboce o gráfico.`, '2024-02-12', 150],
};
for (const [cod, [testo, data, durata]] of Object.entries(COMPITI)) {
  const d = TE.dividi(testo);
  prova(`compito ${cod}: due esercizi numerati`, d.pezzi.length === 2 && d.pezzi[0].n === 1 && d.pezzi[1].n === 2, J(d));
  prova(`compito ${cod}: i punti (6 e 4), tolti dal testo`, d.pezzi[0]?.punti === 6 && d.pezzi[1]?.punti === 4 && !/^\(|\d\s*(?:punti|points|puntos|Punkte|pontos)/i.test(d.pezzi[0]?.t), J(d.pezzi.map(p => [p.punti, p.t])));
  prova(`compito ${cod}: la soluzione del prof a parte`, /1\.$/.test(d.pezzi[0]?.sol || '') && !/1\.$/.test(d.pezzi[0]?.t) && d.pezzi[1]?.sol === null, J(d.pezzi[0]));
  prova(`compito ${cod}: la data dell'intestazione`, d.data === data, d.data);
  prova(`compito ${cod}: la durata dall'intestazione`, d.durata === durata, d.durata);
}
// le soluzioni tutte in fondo («Solutions», «Lösungen»): gli stessi numeri vanno sugli esercizi di prima
for (const [cod, testo] of [
  ['en', 'Exercise 1\nCompute the derivative of x^3 + 2x.\nExercise 2\nCompute the integral of x from 0 to 1.\nSolutions\nExercise 1\n3x^2 + 2\nExercise 2\n1/2'],
  ['de', 'Aufgabe 1\nBerechnen Sie die Ableitung von x^3 + 2x.\nAufgabe 2\nBerechnen Sie das Integral von x zwischen 0 und 1.\nLösungen\nAufgabe 1\n3x^2 + 2\nAufgabe 2\n1/2'],
]) {
  const d = TE.dividi(testo);
  prova(`compito ${cod}: la sezione delle soluzioni in fondo`, d.pezzi.length === 2 && d.pezzi[0].sol === '3x^2 + 2' && d.pezzi[1].sol === '1/2', J(d));
}
// «Answer all questions» in testa non è una soluzione; «Solution of exercise 2:» sì
{
  const d = TE.dividi('Answer all questions.\nExercise 1\nProve that the square root of two is irrational.\nSolution of exercise 1: assume p/q in lowest terms.');
  prova('compito en: «Answer all questions» è intestazione, «Solution of exercise 1:» l\'etichetta', d.pezzi.length === 1 && d.pezzi[0].sol === 'assume p/q in lowest terms.' && /irrational/.test(d.pezzi[0].t), J(d));
}
// le date in lettere nelle sei lingue (e l'italiano di sempre)
for (const [testo, iso] of [['12 febbraio 2024', '2024-02-12'], ['3 giu 2024', '2024-06-03'], ['March 5, 2024', '2024-03-05'], ['5 March 2024', '2024-03-05'], ['5 de marzo de 2024', '2024-03-05'],
  ['5 juillet 2024', '2024-07-05'], ['5 juin 2024', '2024-06-05'], ['5. Dezember 2024', '2024-12-05'], ['5 de outubro de 2024', '2024-10-05'], ['Okt 2024', null], ['settore 12 2024', null]])
  prova(`data: «${testo}»`, TE.dataDi(testo) === iso, TE.dataDi(testo));
// la durata: «90 minutes», «2 Std.», «1h30» e le righe sul ritardo che non contano
for (const [testo, min] of [['Duration: 90 minutes', 90], ['Zeit: 2 Std.', 120], ['Durée : 1h30', 90], ['Tiempo: 120 minutos', 120], ['Late arrivals: 30 minutes', null], ['Retraso permitido: 30 minutos', null]])
  prova(`durata: «${testo}»`, TE.durataDi(testo) === min, TE.durataDi(testo));

/* ---------- l'AI nella lingua dello studente ---------- */
// fetch finta al posto dell'API di Claude: tiene le richieste e risponde col JSON scelto per lo schema
const richieste = [];
let risposte = {};
globalThis.fetch = async (url, o) => {
  const corpo = JSON.parse(o.body); richieste.push(corpo);
  const p = corpo.output_config?.format?.schema?.properties || {};
  const x = p.esito ? risposte.giudizio : p.detta ? risposte.verifica : p.carte ? { carte: [{ fronte: 'a', retro: 'b' }] } : p.domanda ? { domanda: 'q?', argomento: 'a' } : {};
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(x) }], stop_reason: 'end_turn' }) };
};
D.D.imp.chiave = 'sk-prova'; D.D.imp.ai = { fornitore: 'anthropic', modello: '', uso: 'tutto' };
const testoRichiesta = r => r.messages.at(-1).content.map(b => b.text || '').join('\n');
const LINGUE = { it: '', en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Brazilian Portuguese' };
const ESITI = { it: 'fuori tema', en: 'off topic', es: 'fuera de tema', fr: 'hors sujet', de: 'am Thema vorbei', pt: 'fora do tema' };
for (const [cod, nome] of Object.entries(LINGUE)) {
  await L.usa(cod);
  richieste.length = 0;
  await AI.carteDa('Il teorema di Green collega un integrale di linea e un integrale doppio.');
  await AI.domandaOrale({ nome: 'Analisi 2', materiale: '– Green: integrale di linea = integrale doppio' });
  const [carte, domanda] = richieste.map(testoRichiesta);
  if (cod === 'it') prova('ai it: i prompt di sempre, senza la riga della lingua', !/Always answer|Write every text value/.test(carte + domanda) && /in italiano\. Solo concetti presenti nel materiale\.$/.test(carte), carte.slice(-200));
  else {
    prova(`ai ${cod}: le carte nella lingua dello studente`, carte.includes(`Write every text value in ${nome}, the student's language`), carte.slice(-300));
    prova(`ai ${cod}: la domanda dell'orale nella lingua dello studente`, domanda.includes(`in ${nome}`), domanda.slice(-300));
    prova(`ai ${cod}: gli esiti restano codici (enum come sono)`, carte.includes('Keep the JSON keys and the fixed values of the schema (enum) exactly as they are'));
    prova(`ai ${cod}: la conversazione e il riordino dicono la lingua`, AI.inLingua() === `\n\nAlways answer in ${nome}, the student's language, even if these instructions, the student's data or the material are in Italian or in another language.`);
  }
  prova(`ai ${cod}: l'esito «fuori tema» per lo studente`, AI.nomeEsito('fuori tema') === ESITI[cod] && AI.nomeEsito('boh') === 'boh', AI.nomeEsito('fuori tema'));
}
// il codice che costruisce i prompt mette la riga della lingua anche nella conversazione, nel riordino e nella foto
{
  const src = (await import('node:fs')).readFileSync(new URL('../js/ai.js', import.meta.url), 'utf8');
  prova('ai: conversa e conversaLocale aggiungono inLingua() dopo i dati', (src.match(/contesto\(\) \+ inLingua\(\)/g) || []).length === 2);
  prova('ai: riordina e trascriviFoto aggiungono inLingua()', (src.match(/senza introduzioni\.` \+ inLingua\(\)/g) || []).length === 2);
  prova('ai: libretto, orario e programma tengono i nomi come sono scritti', (src.match(/\+ comeScritti\(\)/g) || []).length === 3);
}
// il giudizio: i controlli italiani solo in italiano, la citazione in tutte le lingue
{
  await L.usa('it');
  risposte = { giudizio: { esito: 'giusta', giudizio: 'Giusto, ma hai dimenticato il bordo orientato.', mancava: '' }, verifica: { detta: false, citazione: '' } };
  let g = await AI.giudicaRisposta({ nome: 'Analisi 2', domanda: 'Enuncia Green', risposta: 'Collega integrale di linea e doppio', materiale: '' });
  prova('giudizio it: «hai dimenticato» con esito giusta → parziale (come prima)', g.esito === 'parziale', J(g));
  await L.usa('en');
  risposte = { giudizio: { esito: 'giusta', giudizio: 'Right, ma hai dimenticato the boundary.', mancava: '' }, verifica: { detta: false, citazione: '' } };
  g = await AI.giudicaRisposta({ nome: 'Calculus', domanda: 'State Green', risposta: 'It links a line integral and a double integral', materiale: '' });
  prova('giudizio en: le parole italiane non cambiano l\'esito del modello', g.esito === 'giusta' && g.giudizio === 'Right, ma hai dimenticato the boundary.', J(g));
  // il «mancava» che lo studente ha detto davvero: il modello lo cita, la citazione è vera → si toglie (in tutte le lingue)
  const materiale = '– Green theorem: the line integral over the positively oriented boundary equals the double integral of the curl';
  risposte = { giudizio: { esito: 'parziale', giudizio: 'Almost there.', mancava: 'the positively oriented boundary' }, verifica: { detta: true, citazione: 'over the positively oriented boundary of the region' } };
  g = await AI.giudicaRisposta({ nome: 'Calculus', domanda: 'State Green', risposta: 'The line integral over the positively oriented boundary of the region equals the double integral', materiale });
  prova('giudizio en: citazione vera → il «mancava» si toglie', g.mancava === '' && g.esito === 'parziale', J(g));
  // la citazione inventata (non è nella risposta) non vale: il «mancava» resta
  risposte = { giudizio: { esito: 'parziale', giudizio: 'Almost there.', mancava: 'the positively oriented boundary' }, verifica: { detta: true, citazione: 'the curve is positively oriented around the region' } };
  g = await AI.giudicaRisposta({ nome: 'Calculus', domanda: 'State Green', risposta: 'It equals the double integral of the curl', materiale });
  prova('giudizio en: citazione inventata → il «mancava» resta', g.mancava === 'the positively oriented boundary', J(g));
  await L.usa('it');
}

/* ---------- la voce ---------- */
for (const [cod, whisper, paese] of [['it', 'italian', 'it-IT'], ['en', 'english', 'en-GB'], ['es', 'spanish', 'es-ES'], ['fr', 'french', 'fr-FR'], ['de', 'german', 'de-DE'], ['pt', 'portuguese', 'pt-BR']])
  prova(`voce ${cod}: ${whisper} per Whisper, ${paese} per il browser`, PA.WHISPER[cod] === whisper && PA.PAESE_VOCE[cod] === paese);
{
  const src = (await import('node:fs')).readFileSync(new URL('../js/voce.js', import.meta.url), 'utf8');
  prova('voce: niente lingua scritta a mano', !/'it-IT'|language: 'italian'/.test(src));
}
for (const f of ['Sottotitoli a cura di QTSS', 'Grazie per la visione', 'Thank you.', 'Thanks for watching!', 'Subtítulos realizados por la comunidad de Amara.org', 'Gracias.',
  "Sous-titres réalisés par la communauté d'Amara.org", 'Merci.', 'Untertitel im Auftrag des ZDF, 2017', 'Untertitelung des ZDF für funk, 2017', 'Legendas pela comunidade Amara.org', 'Obrigado.'])
  prova(`voce: «${f}» è una frase inventata da Whisper`, V.ALLUCINAZIONI.test(f));
for (const f of ['la derivata di x al quadrato', 'Thank you professor, the integral is zero', 'Danke für die Erklärung des Integrals', 'Merci pour la démonstration du théorème', 'gracias a la regla de la cadena'])
  prova(`voce: «${f}» è una frase vera`, !V.ALLUCINAZIONI.test(f));

/* ---------- numeri, ore, nomi degli esami, giochi, crocette ---------- */
for (const [cod, a, b] of [['it', '7,5', '3,25'], ['en', '7.5', '3.25'], ['es', '7,5', '3,25'], ['fr', '7,5', '3,25'], ['de', '7,5', '3,25'], ['pt', '7,5', '3,25']]) {
  await L.usa(cod);
  prova(`numeri ${cod}: ${a} e ${b}, al più due decimali, niente zeri in coda`, PA.numeroCorto(7.5) === a && PA.numeroCorto(3.254) === b && PA.numeroCorto(12) === '12' && PA.numeroCorto(1234.5) === (cod === 'en' ? '1234.5' : '1234,5'), [PA.numeroCorto(7.5), PA.numeroCorto(1234.5)]);
  prova(`ore ${cod}: 09:05 e 00:07, sempre 24 ore`, PA.oraBreve(new Date(2024, 0, 1, 9, 5)) === '09:05' && PA.oraBreve(new Date(2024, 0, 1, 0, 7)) === '00:07', PA.oraBreve(new Date(2024, 0, 1, 9, 5)));
}
await L.usa('it');
prova('numeri it: come prima (String(x).replace(".", ","))', [3.5, 7, 7.25, 0.5].every(x => PA.numeroCorto(x) === String(x).replace('.', ',')));
for (const [detto, nome] of [['analisi due', 'Analisi 2'], ['analisi two', 'Analisi 2'], ['fisica dos', 'Fisica 2'], ['Fisica zwei', 'Fisica 2'], ['analisi deux', 'Analisi 2'], ['fisica dois', 'Fisica 2']])
  prova(`esame: «${detto}» → ${nome}`, D.trovaEsame(detto)?.nome === nome, D.trovaEsame(detto)?.nome);
prova('esame: «dos» in mezzo resta parola («historia dos numeros»)', PA.numeroInFondo('historia dos numeros') === 'historia dos numeros');
// il gioco «completa» non nasconde le parole vuote delle altre lingue
for (const d of [{ t: 'Gradient', d: 'The vector which points between the steepest directions' }, { t: 'Gradiente', d: 'El vector cuando sobre todas direcciones' }, { t: 'Gradient', d: 'Der Vektor zwischen dieser Richtung' }])
  prova(`giochi: «${d.d}» nasconde una parola piena`, !['which', 'between', 'cuando', 'sobre', 'todas', 'zwischen', 'dieser'].includes(G.buco(d)?.parola.toLowerCase()), G.buco(d)?.parola);
// le crocette scartano «all of the above», «ninguna de las anteriores», «keine der anderen», «todas as anteriores»
{
  const mat = 'The gradient of a function points in the direction of the steepest increase of the function at that point.';
  const q = op => ({ domanda: 'Where does the gradient point?', opzioni: ['Steepest increase', 'Steepest decrease', 'Along the level curve', op], giusta: 0, citazione: 'points in the direction of the steepest increase of the function', spiegazione: '' });
  prova('crocette: una domanda buona passa', QC.valida([q('Nowhere at all')], mat).domande.length === 1);
  for (const op of ['All of the above', 'None of the above', 'Ninguna de las anteriores', 'Toutes les réponses précédentes', 'Keine der anderen', 'Todas as anteriores', 'Tutte le precedenti'])
    prova(`crocette: «${op}» si scarta`, QC.valida([q(op)], mat).domande.length === 0);
}

/* ---------- le parole delle altre lingue non cambiano l'italiano (e non rompono i testi veri) ---------- */
// «Metodologia della ricerca» è un argomento italiano, non il titolo spagnolo o portoghese «Metodología»
prova('programma it: «Metodologia della ricerca» resta un argomento', J(P.leggiProgramma('Programma\nIntroduzione alla psicologia\nMetodologia della ricerca\nStatistica descrittiva\nTesti consigliati\nZimbardo').map(a => a.t)) === J(['Introduzione alla psicologia', 'Metodologia della ricerca', 'Statistica descrittiva']));
prova('programma es: «Metodología» da sola è il titolo dove fermarsi', J(P.leggiProgramma('Temario\nLímites y continuidad\nDerivadas\nIntegrales\nMetodología\nClases magistrales').map(a => a.t)) === J(['Límites y continuidad', 'Derivadas', 'Integrales']));
// «Reading and writing files», «Unit testing», «Topic modeling», «Examination of the abdomen»: argomenti, non titoli né segni
{
  const a = P.leggiProgramma('Course content\nPython basics\nReading and writing files\nUnit testing with pytest\nTopic modeling and LDA\nRecommended reading\nLutz, Learning Python').map(a => a.t);
  prova('programma en: «Reading…», «Unit testing», «Topic modeling» sono argomenti interi', J(a) === J(['Python basics', 'Reading and writing files', 'Unit testing with pytest', 'Topic modeling and LDA']), J(a));
  const b = P.leggiProgramma('Contents\nHistory taking\nExamination of the abdomen\nCardiac auscultation\nAssessment\nOSCE').map(a => a.t);
  prova('programma en: «Examination of…» è un argomento, «Assessment» il titolo dove fermarsi', J(b) === J(['History taking', 'Examination of the abdomen', 'Cardiac auscultation']), J(b));
  const c = P.leggiProgramma('Inhalte\nTeil A: Grundlagen der Mengenlehre\nTeil B: Gruppen und Ringe\nTeil C: Körper\nPrüfungsform\nKlausur').map(a => a.t);
  prova('programma de: «Teil A:» è un segno', J(c) === J(['Grundlagen der Mengenlehre', 'Gruppen und Ringe', 'Körper']), J(c));
}
prova('chiavi it: «pelo» è una parola piena (non il «pelo» portoghese)', P.chiavi('Struttura del pelo e del follicolo').includes('pelo'));
// «Marco 12 2024» in un'intestazione italiana non è il 12 marzo (il «março» portoghese): l'ordine mese-giorno è solo inglese
prova('data: «Prof. Marco 12 2024» non è una data', TE.dataDi('Prof. Marco 12 2024') === null, TE.dataDi('Prof. Marco 12 2024'));
prova('data: «Dec 5, 2024» sì', TE.dataDi('Exam, Dec 5, 2024') === '2024-12-05', TE.dataDi('Exam, Dec 5, 2024'));
// un esame salvato col numero in lettere («Physics Two») si trova ancora col suo nome
{
  const prima = JSON.parse(JSON.stringify(D.D.esami));
  D.D.esami.push({ id: 'pt2', nome: 'Physics Two', cfu: 6, fatto: false });
  prova('esame: «physics two» trova «Physics Two» (come prima)', D.trovaEsame('physics two')?.nome === 'Physics Two' && D.trovaEsame('physics 2')?.nome === 'Physics Two', D.trovaEsame('physics two')?.nome);
  D.D.esami.length = 0; D.D.esami.push(...prima);
}

console.log(`contenuti-lingue: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
