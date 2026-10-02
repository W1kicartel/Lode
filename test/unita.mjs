// Prove veloci, senza browser: node --experimental-vm-modules test/unita.mjs
// Comandi in italiano (anche detti a voce), formule parlate → LaTeX, note di Obsidian, conti del libretto, giochi.
// Le prove di informatica hanno file a parte (in CI sono passi del job «unita», .github/workflows/prove.yml):
//   node test/codice.mjs                              «Cosa stampa?»: albero del C, modelli, mutanti
//   node test/verifica-c.mjs                          le risposte di Lode contro il compilatore vero (salta senza compilatore)
//   node --experimental-vm-modules test/progetto.mjs  «Segui il progetto»: watcher, diff, «Fatto», prove .in/.out
//   node test/errori.mjs                              gli errori del compilatore spiegati in italiano
//   node --experimental-vm-modules test/diario.mjs    il registro nel vault: diario, «Cosa so davvero», Memoria
// prima di tutto: ogni file dell'interfaccia deve essere un modulo valido (doppioni, sintassi), anche nelle sottocartelle (js/codice/)
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const JS = new URL('../js/', import.meta.url);
const rotti = [], moduli = readdirSync(JS, { recursive: true }).map(f => String(f).replaceAll('\\', '/')).filter(f => f.endsWith('.js'));
if (vm.SourceTextModule) for (const f of moduli) { try { new vm.SourceTextModule(readFileSync(new URL(f, JS), 'utf8')); } catch (e) { rotti.push(`${f}: ${e.message}`); } }
else console.log('(controllo dei moduli saltato: lancia con node --experimental-vm-modules)');
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const D = await import('../js/dati.js'), C = await import('../js/comandi.js'), F = await import('../js/formule.js'), M = await import('../js/markdown.js'), G = await import('../js/giochi.js');
D.sostituisci(D.esempio());
let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
prova('moduli validi', !rotti.length, rotti.join('; '));
prova('moduli: anche js/codice/', moduli.includes('codice/stampa.js') && moduli.includes('codice/progetto.js') && moduli.includes('codice/diario.js') && moduli.includes('errori.js'), moduli.join(', '));
const c = f => C.interpreta(f);

// comandi scritti e detti a voce
prova('focus', c('focus 50 su analisi 2')?.min === 50 && c('focus 50 su analisi 2').esame?.nome === 'Analisi 2');
prova('focus a voce', c('Focus cinquanta minuti su analisi due.')?.min === 50);
prova('focus un\'ora', c("studia basi di dati per un'ora")?.min === 60);
prova('voto', c('ho preso 28 in fisica 2')?.voto === 28);
prova('voto a voce', c('Ho priso ventotto in fisica 2.')?.voto === 28);
prova('lode', c('30 e lode ad analisi 2')?.lode === true);
prova('idoneità solo per esami veri', c('ho preso vettuto in') === null && c('ho passato inglese')?.tipo === 'idoneita');
prova('esame con data', c('esame basi di dati il 15 gennaio 9 cfu')?.cfu === 9);
prova('serve', c('quanto mi serve per centodieci')?.base === 110);
prova('simula', c('se prendo 30 in analisi 2')?.voto === 30);
prova('orario', JSON.stringify(c('lezione analisi 2 lunedì e mercoledì 9-11 aula 7')?.giorni) === '[1,3]');
prova('stella', c('★ il teorema lo chiede sempre')?.tipo === 'stella');
prova('definizione a voce', c('definizione nucleofilo uguale specie ricca di elettroni.')?.termine === 'nucleofilo');
prova('domanda a voce', c('Domanda per il prof perché serve la continuità?')?.tipo === 'domanda');
prova('trascrivi', c('trascrivi la lezione')?.tipo === 'trascrivi' && c('fine trascrizione')?.tipo === 'fineTrascrizione');
prova('riordina', c('riordina la lezione')?.tipo === 'riordina');
prova('esame detto a voce', c("ho l'esame di analisi 2 il 15 gennaio")?.esistente?.nome === 'Analisi 2' && c('analisi 2 spostato al 20 gennaio')?.data?.endsWith('-01-20'));
prova('«ho lezione domani» non crea esami', c('ho lezione domani')?.tipo !== 'esame');
prova('proposte', c('proposte frequenti')?.livello === 'spesso' && c('spegni le proposte')?.livello === 'mai');
prova('gioca', c('gioca analisi 2')?.tipo === 'gioco');
prova('naviga', c('apri glossario')?.tipo === 'naviga');
prova('domanda libera all\'AI', c('spiegami il teorema di Stokes') === null);

// informatica: «Cosa stampa?», «Segui il progetto», «spiegami l'errore», il diario
prova('cosa stampa', c('cosa stampa')?.tipo === 'stampa' && c('Cosa stampa?')?.tipo === 'stampa' && c('esercizi di C')?.tipo === 'stampa' && c('esercizio di programmazione')?.tipo === 'stampa' && c('allenami su c')?.tipo === 'stampa');
prova('«allenami» da solo resta il gioco', c('allenami')?.tipo === 'gioco');
prova('segui progetto', c('segui progetto')?.azione === 'segui' && c('Segui il progetto.')?.azione === 'segui');
prova('prova il progetto', c('prova il progetto')?.azione === 'prova' && c('compila')?.azione === 'prova' && c('provato?')?.azione === 'provato' && c('cosa è cambiato')?.azione === 'cambiato');
prova('smetti di seguire', c('smetti di seguire lab3')?.azione === 'smetti' && c('smetti di seguire lab3').nome === 'lab3');
{ const e = c("spiegami l'errore: lista.c:42:5: error: 'nodo' undeclared\n   42 |     nodo->v = 3;");
  prova("spiegami l'errore (con le righe)", e?.tipo === 'errore' && e.testo.split('\n').length === 2 && e.testo.startsWith('lista.c:42'), JSON.stringify(e)); }
prova("spiegami l'errore (dagli appunti)", c("spiegami l'errore")?.tipo === 'errore' && c("spiegami l'errore").testo === null && c('Spiegami questo errore.')?.tipo === 'errore');
prova("«errore» di statistica e fisica resta all'AI", c('cosa vuol dire errore standard') === null && c("spiegami l'errore relativo") === null && c('che vuol dire errore assoluto in fisica') === null);
prova("spiegami l'errore senza due punti, con l'errore dopo", c("spiegami l'errore lista.c:42:5: error: 'nodo' undeclared")?.testo?.startsWith('lista.c:42') && c("spiegami l'errore?")?.testo === null);
prova('«compila» solo per il codice', c('compila la relazione di fisica') === null && c('compila il modulo Erasmus') === null && c('compila il codice')?.azione === 'prova');
prova('diario del progetto', c('diario del progetto')?.tipo === 'diario' && c('apri il diario del progetto lab3')?.progetto === 'lab3');
prova('diario: interruttore', c('non scrivere il diario del progetto lab3')?.diario === false && c('spegni il diario')?.diario === false && c('accendi il diario di lab3')?.diario === true);
prova('ricorda: gli esercizi in una mappa a parte', (() => { const m = {}, prima = JSON.stringify(D.D.memoria); D.ricorda('stampa|c:for', true, 4, m); return m['stampa|c:for']?.giuste === 1 && JSON.stringify(D.D.memoria) === prima; })());
prova('dati: D.codice c\'è sempre', !!D.D.codice && Array.isArray(D.D.codice.eventi) && typeof D.VUOTO().codice.memoria === 'object');

// «Esporta per Anki» (js/anki.js): il comando, i campi, i mazzi, i doppioni
prova('anki: comando', c('esporta per anki')?.tipo === 'anki' && c('esporta per anki').corso === null && c('anki')?.corso === null && c('Esporta per Anki.')?.tipo === 'anki' && c('carte per anki')?.corso === null && c('esporta tutto per anki')?.corso === null && c('esporta tutte le carte su anki')?.corso === null);
prova('anki: comando con il corso', c('esporta le carte di analisi 2 per anki')?.corso === 'analisi 2' && c('esporta le carte di analisi due per anki')?.corso === 'analisi 2' && c('anki fisica 2')?.corso === 'fisica 2' && c('esporta basi di dati in anki')?.corso === 'basi di dati' && c('le carte di basi di dati per anki')?.corso === 'basi di dati' && c('prepara il mazzo di fisica 2 per anki')?.corso === 'fisica 2' && c('le mie carte per anki')?.corso === null, JSON.stringify(c('esporta le carte di analisi 2 per anki')));
prova('anki: le domande su anki e «scarica anki» restano all\'AI', ['anki come si usa', 'anki funziona con lode?', 'anki è aperto?', 'anki o lode?', 'anki perché non va', 'scarica anki'].every(f => c(f) === null) && c('scarica le carte per anki')?.tipo === 'anki' && c('crea un mazzo su anki')?.corso === null && c('anki sistemi operativi')?.corso === 'sistemi operativi', ['anki come si usa', 'anki è aperto?', 'scarica anki', 'crea un mazzo su anki'].map(f => JSON.stringify(c(f))).join(' '));
prova('anki: le altre frasi restano com\'erano', c('ripassa analisi 2')?.tipo === 'ripasso' && c('le carte')?.tipo === 'ripasso' && c('come importo le carte in anki') === null && c('cos\'è anki') === null);
const K = await import('../js/anki.js');
prova('anki: tab e a capo dentro i campi', K.campo('a\tb\r\nc\nd') === 'a b<br>c<br>d', K.campo('a\tb\r\nc\nd'));
prova('anki: HTML protetto, l\'apostrofo resta', K.campo('<script>alert("x")</script> & cos\'è') === '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; cos\'è' && K.campo('"Citazione" del prof') === '&quot;Citazione&quot; del prof', K.campo('<script>alert("x")</script> & cos\'è'));
prova('anki: grassetto', K.campo('Il **gradiente** è un **vettore**') === 'Il <b>gradiente</b> è un <b>vettore</b>' && K.campo('2 ** 3 = 8') === '2 ** 3 = 8', K.campo('2 ** 3 = 8'));
prova('anki: formule in linea e in blocco (MathJax)', K.campo('Vale $\\int_0^1 x \\, dx = \\frac{1}{2}$.') === 'Vale \\(\\int_0^1 x \\, dx = \\frac{1}{2}\\).' && K.campo('$$a < b\n+ c$$') === '\\[a &lt; b + c\\]', K.campo('$$a < b\n+ c$$'));
prova('anki: niente formule finte', K.campo('costa 5$ e 10$') === 'costa 5$ e 10$' && K.campo('$ x $') === '$ x $' && K.campo('\\$5 e $x^2$') === '$5 e \\(x^2\\)' && K.campo('**$x$** e $y$') === '<b>\\(x\\)</b> e \\(y\\)', K.campo('\\$5 e $x^2$'));
prova('anki: un # all\'inizio non è un commento', K.campo('#include <stdio.h>') === '&#35;include &lt;stdio.h&gt;');
prova('anki: i $ dentro il codice non sono formule', K.campo('Differenza tra `$*` e `$@` in bash?') === 'Differenza tra <code>$*</code> e <code>$@</code> in bash?' && K.campo('`echo $HOME` e `$PATH`') === '<code>echo $HOME</code> e <code>$PATH</code>' && K.campo('`a\tb` e $x$') === '<code>a b</code> e \\(x\\)', K.campo('Differenza tra `$*` e `$@` in bash?'));
prova('anki: i prezzi non sono formule', K.campo('costa 5$, ma usato 3$') === 'costa 5$, ma usato 3$' && K.campo('Il libro costa 20$, quello usato 12$.') === 'Il libro costa 20$, quello usato 12$.', K.campo('costa 5$, ma usato 3$'));
prova('anki: il Markdown di Obsidian', K.campo('Il vettore delle [[derivate parziali]] e [[Nota|alias]]') === 'Il vettore delle derivate parziali e alias' && K.campo('*corsivo* e ==evidenziato==') === '<i>corsivo</i> e <mark>evidenziato</mark>' && K.campo('2 * 3 * 4 e 2*3 e a == b') === '2 * 3 * 4 e 2*3 e a == b', K.campo('*corsivo* e ==evidenziato=='));
prova('anki: tag e mazzi sicuri', K.tagCorso('Analisi 2') === 'analisi_2' && K.tagCorso('Économie & Société') === 'economie_societe' && K.mazzo('Fisica 2') === 'Lode::Fisica 2' && K.mazzo('A::B "c"\td') === 'Lode::A:B c d' && K.mazzo('') === 'Lode::Varie', K.mazzo('A::B "c"\td'));
prova('anki: niente «:» ai bordi del mazzo, C e C++ restano due tag', K.mazzo(':Fisica') === 'Lode::Fisica' && K.mazzo('Fisica:') === 'Lode::Fisica' && K.mazzo('::') === 'Lode::Varie' && K.tagCorso('Programmazione in C++') === 'programmazione_in_c++' && K.tagCorso('Programmazione in C') === 'programmazione_in_c', K.mazzo(':Fisica'));
{ const fr = ['Cosa stampa `printf("%d", i++)`?', 'Cosa stampa `printf("%d", ++i)`?', 'Differenza tra `=` e `==`?', 'Differenza tra `==` e `===`?', 'Quando vale $a<b$?', 'Quando vale $a>b$?'];
  const p = K.preparaAnki({ carte: [...fr.map((f, i) => ({ id: 'p' + i, fronte: f, retro: 'r', corso: 'Programmazione in C' })), { id: 'q', fronte: fr[0], retro: 'r', corso: 'Programmazione in C++' }] });
  prova('anki: i simboli contano (niente doppioni finti), C e C++ due mazzi', p.totale === 7 && p.doppioni === 0 && p.mazzi.map(m => m.corso).join('|') === 'Programmazione in C|Programmazione in C++', { totale: p.totale, doppioni: p.doppioni }); }
{ const carte = [{ id: 'c1', corso: 'Analisi 2', fronte: 'Gradiente', retro: 'Il vettore delle **derivate** parziali' }, { id: 'c2', corso: 'Analisi 2', fronte: 'gradiente?', retro: 'doppione della carta' }, { id: 'c3', corso: 'Basi di dati', fronte: 'Chiave primaria', retro: 'Identifica ogni tupla' }, { id: 'c4', corso: 'Varie', fronte: 'Vuota', retro: '  ' }];
  const defs = [{ corso: 'Analisi 2', t: 'Gradiente', d: 'doppione della carta' }, { corso: 'analisi 2', t: 'Hessiana', d: 'La matrice delle $f_{xy}$' }, { corso: 'Analisi 2', t: 'HESSIANA', d: 'doppione' }, { corso: 'Basi di dati', t: 'Gradiente', d: 'stesso termine, altro corso: non è un doppione' }];
  const p = K.preparaAnki({ carte, definizioni: defs }), t = K.testoAnki(p.mazzi), righe = t.trimEnd().split('\n'), dati = righe.filter(r => !r.startsWith('#')).map(r => r.split('\t'));
  prova('anki: doppioni tolti (stesso corso, stesso fronte), prima le carte', p.totale === 4 && p.doppioni === 3 && p.mazzi.map(m => m.corso).join('|') === 'Analisi 2|Basi di dati' && p.mazzi[0].voci.map(v => v.fronte).join('|') === 'Gradiente|Hessiana', JSON.stringify(p));
  prova('anki: intestazioni di Anki', righe.slice(0, 6).join('|') === '#separator:tab|#html:true|#notetype:Basic|#tags column:3|#deck column:4|#guid column:5', righe.slice(0, 6).join('|'));
  prova('anki: una riga per carta: fronte, retro, tag, mazzo, guid', dati.length === 4 && dati.every(r => r.length === 5) && dati[0].join('|') === 'Gradiente|Il vettore delle <b>derivate</b> parziali|lode analisi_2|Lode::Analisi 2|lode-c-c1' && dati[1][1] === 'La matrice delle \\(f_{xy}\\)' && dati[3][2] === 'lode basi_di_dati' && dati[3][3] === 'Lode::Basi di dati', JSON.stringify(dati));
  prova('anki: guid stabili, uno per carta', K.testoAnki(K.preparaAnki({ carte, definizioni: defs }).mazzi) === t && new Set(dati.map(r => r[4])).size === 4 && dati[1][4].startsWith('lode-d-'));
  const solo = K.preparaAnki({ carte, definizioni: defs, corso: 'basi di dati' });
  prova('anki: un corso solo', solo.mazzi.length === 1 && solo.mazzi[0].corso === 'Basi di dati' && solo.totale === 2 && K.preparaAnki({ carte, definizioni: defs, corso: n => n === 'Analisi 2' }).totale === 2);
  prova('anki: nome del file', K.nomeFileAnki(null, '2026-10-02') === 'Lode per Anki 2026-10-02.txt' && K.nomeFileAnki('Analisi 2: forme', '2026-10-02') === 'Analisi 2 forme per Anki 2026-10-02.txt', K.nomeFileAnki('Analisi 2: forme', '2026-10-02'));
  const es = K.preparaAnki({ carte: D.D.carte.map(x => ({ ...x, corso: D.esame(x.esameId)?.nome })), definizioni: D.definizioni({ giorni: 3650 }) });
  prova('anki: i dati di esempio, un mazzo per corso', es.mazzi.map(m => `${m.corso}:${m.voci.length}`).join(' ') === 'Analisi 2:14 Basi di dati:7' && es.doppioni === 0, es.mazzi.map(m => `${m.corso}:${m.voci.length}`).join(' '));
}

// formule dette a voce
const f = F.parlatoInFormule;
prova('formule: «integrale di linea» resta parola', f("l'integrale di linea lungo il bordo") === "l'integrale di linea lungo il bordo", f("l'integrale di linea lungo il bordo"));
prova('formule: «integrale doppio sul dominio» resta parola', !f("all'integrale doppio sul dominio stesso").includes('$'), f("all'integrale doppio sul dominio stesso"));
prova('formule: integrale doppio su D in dx dy', f('integrale doppio su D di f in dx dy').includes('\\iint_{D} f \\, dx \\, dy$'), f('integrale doppio su D di f in dx dy'));
prova('integrale', f("l'integrale da zero a pi greco di seno di x in d x").includes('$\\int_{0}^{\\pi} \\sin x \\, dx$'));
prova('polinomio', f('f di x uguale x al quadrato più due x più uno.').includes('$f(x) = x^{2} + 2 x + 1$'));
prova('limite', f('il limite per x che tende a zero di seno di x fratto x').includes('\\lim_{x \\to 0} \\frac{\\sin x}{x}'));
prova('sommatoria', f('sommatoria per n che va da uno a infinito di uno fratto n al quadrato').includes('\\sum_{n=1}^{\\infty} \\frac{1}{n^{2}}'));
prova('derivata parziale', f('derivata parziale di f rispetto a x').includes('\\frac{\\partial f}{\\partial x}'));
prova('quantificatori', f('per ogni epsilon maggiore di zero esiste delta').includes('\\forall \\varepsilon > 0 \\exists \\delta'));
prova('scrittura di Whisper', f("calcoliamo l'integrale da 0 a p greco di seno di x in dx").includes('\\int_{0}^{\\pi} \\sin x \\, dx') && f('f di x uguale x² più 2x più 1').includes('x^{2} + 2 x + 1') && f('x³ frattotre').includes('\\frac{x^{3}}{3}'), f('x³ frattotre'));
prova('prosa intatta', f('Oggi parliamo di algebra lineare e di matrici.') === 'Oggi parliamo di algebra lineare e di matrici.');

// note di Obsidian
let n = M.notaLezione({ corso: 'Analisi 2', data: '2026-10-01', inizio: '09:00', fine: '11:00', aula: '7' });
n = M.inserisci(n, 'stella', '- 10:42 Green sempre'); n = M.inserisci(n, 'definizione', '- **Gradiente**: vettore delle derivate');
n = M.inserisci(n, 'trascrizione', '**10:43** Calcoliamo $\\int_0^1 x \\, dx$'); n += '\nHessiana :: matrice delle derivate seconde\n';
const l = M.leggiLezione(n, 'Lezioni/Analisi 2/2026-10-01 Analisi 2.md');
prova('lezione: definizioni', l.definizioni.length === 2, JSON.stringify(l.definizioni));
prova('lezione: stelle', l.stelle.length === 1);
prova('lezione: trascrizione', l.paroleTrascritte >= 3 && l.trascrizione.startsWith('Calcoliamo'));
prova('orario andata e ritorno', M.leggiOrario(M.orarioMd([{ corso: 'Analisi 2', giorni: [1, 3], inizio: '09:00', fine: '11:00', aula: '7' }]))[0]?.aula === '7');

// setup veloce: libretto incollato e calendario .ics (senza AI)
globalThis.DOMParser ||= class {}; globalThis.matchMedia ||= () => ({ matches: false }); globalThis.window ||= globalThis; globalThis.document ||= { addEventListener() { }, querySelector() { return null; }, documentElement: { classList: { add() { } } } }; globalThis.navigator ||= {}; globalThis.requestAnimationFrame ||= f => setTimeout(f, 16);
const B = await import('../js/benvenuto.js').catch(e => ({ errore: e }));
if (!B.errore) {
  const lib = B.librettoSenzaAI('Libretto\nANALISI MATEMATICA I  9 CFU  28/30  12/02/2025\n2004 - Fisica generale, 6 crediti, 30 e lode, 20/06/2025\nLingua inglese B2  3 CFU  Idoneo  10/01/2025\nBasi di dati  9 CFU  -');
  const esse3 = B.librettoSenzaAI('Codice  Attività didattica  Anno  CFU  Voto  Data\n00123 - ANALISI MATEMATICA I   1  9  28/30  12/02/2025\n00456 - FISICA GENERALE I   1  9  30 e lode  20/06/2025\nINGLESE B2  1  3  IDONEO  10/01/2025\nCHIMICA  1  6  -  -');
  prova('libretto da Esse3', esse3.length === 3 && esse3[0].cfu === 9 && esse3[0].nome === 'Analisi matematica I' && esse3[1].lode && esse3[2].cfu === 3 && esse3[2].nome === 'Inglese B2', JSON.stringify(esse3));
  prova('libretto incollato', lib.length === 3 && lib[0].voto === 28 && lib[0].cfu === 9 && lib[1].lode && lib[2].idoneita, JSON.stringify(lib));
  const ics = B.orarioDaIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Analisi 2 - Lezione\nDTSTART;TZID=Europe/Rome:20261005T090000\nDTEND;TZID=Europe/Rome:20261005T110000\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE\nLOCATION:Aula 7\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:Fisica 2\nDTSTART:20261006T140000\nDTEND:20261006T160000\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:Fisica 2\nDTSTART:20261013T140000\nDTEND:20261013T160000\nEND:VEVENT\nEND:VCALENDAR');
  prova('calendario .ics', ics.length === 2 && JSON.stringify(ics[0].giorni) === '[1,3]' && ics[0].inizio === '09:00' && ics[1].giorni[0] === 2, JSON.stringify(ics));
} else console.log('(benvenuto.js non caricabile in Node:', B.errore.message, ')');

// libretto e giochi
const m = D.media();
prova('media ponderata', Math.abs(m.ponderata - 27.3077) < .001, m.ponderata);
prova('base di laurea', Math.abs(m.base - 100.128) < .01);
prova('giochi', G.partita(D.daGiocare(6).scelte, D.daGiocare(6).tutte)[0]?.tipo === 'abbina');
prova('risposta tollerante', G.giusta('potenzial', 'potenziale') && !G.giusta('gradiente', 'hessiana'));

// l'allenatore propone «Cosa stampa?» solo se c'è un corso di programmazione, e la scheda parte dalla domanda annunciata
const AL = await import('../js/allenatore.js').catch(e => ({ errore: e }));
if (!AL.errore) {
  prova('allenatore: niente «Cosa stampa?» senza un corso di programmazione', !AL.candidati().some(x => x.tipo === 'stampa'));
  D.aggiungiEsame({ nome: 'Programmazione 1', cfu: 12, data: D.piuGiorni(D.oggi(), 10) });
  const st = AL.candidati().find(x => x.tipo === 'stampa'), ST = await import('../js/codice/stampa.js');
  prova('allenatore: «Cosa stampa?» per Programmazione 1', st?.titolo === 'Programmazione 1' && st.corso === 'Programmazione 1' && /^Cosa stampa .+\? 1 minuto$/.test(st.testo) && st.peso > 0, JSON.stringify(st));
  prova('allenatore: la scheda parte dalla domanda annunciata', !!st && ST.preparaManche({ memoria: D.D.codice.memoria, seme: st.seme })[0]?.modello === ST.anteprima({ memoria: D.D.codice.memoria, seme: st.seme })?.modello);
} else console.log('(allenatore.js non caricabile in Node:', AL.errore.message, ')');

// orale: il codice corregge il giudizio del modello (casi veri di Qwen3.5 4B) e decide cosa ripassare
const AI = await import('../js/ai.js').catch(e => ({ errore: e }));
if (!AI.errore) {
  const gj = (esito, giudizio, risposta, mancava = '') => AI.correggiGiudizio({ esito, giudizio, mancava, risposta });
  const sella = 'Se l\'hessiana è definita positiva è un minimo locale, se è indefinita è un punto di sella. Se è solo semidefinita, il test non basta.';
  let x = gj('giusta', 'Hai detto tutto correttamente, solo che hai omesso di menzionare i casi semidefiniti.', sella);
  prova('orale: «hai omesso» una cosa detta si toglie', x.esito === 'giusta' && x.giudizio === 'Hai detto tutto correttamente.', JSON.stringify(x));
  x = gj('parziale', "Hai detto giusto l'idea ma manca la dimostrazione per domini regolari e il ruolo del teorema fondamentale.", 'Si dimostra su un dominio normale col teorema fondamentale del calcolo, poi si estende ai domini regolari.');
  prova('orale: parziale solo per una mancanza falsa → giusta', x.esito === 'giusta' && x.giudizio === "Hai detto giusto l'idea.", JSON.stringify(x));
  x = gj('giusta', "Corretto, ma hai dimenticato l'ipotesi di continuità delle derivate parziali.", 'Se le derivate esistono la funzione è differenziabile');
  prova('orale: una mancanza vera resta e la rende parziale', x.esito === 'parziale' && x.giudizio.startsWith('Corretto, ma hai dimenticato'), JSON.stringify(x));
  prova('orale: «non ti manca niente» resta giusta', gj('giusta', 'Giusto, non ti manca niente.', 'boh').esito === 'giusta');
  prova('orale: un errore non è parziale', gj('parziale', 'Hai sbagliato il segno del determinante.', 'x').esito === 'sbagliata');
  prova('orale: un nome che manca davvero resta', gj('parziale', 'Manca il teorema del Dini.', 'Uso il teorema delle funzioni implicite').giudizio === 'Manca il teorema del Dini.');
  prova('orale: «mancava» già detto si toglie', gj('parziale', 'Idea giusta, però è vaga.', 'Se la forma è chiusa e il dominio è semplicemente connesso allora è esatta', 'La condizione di chiusura su domini semplicemente connessi').mancava === '');
  // il «sì, l'ha detto» del modello vale solo con una citazione vera e pertinente (Qwen3.5 4B dice sì a tutto)
  const esatta = 'Una forma è esatta se esiste U tale che dU = ω, cioè la derivata di U rispetto a x è P e quella rispetto a y è Q.';
  prova('orale: citazione vera e pertinente', AI.citazioneValida('la derivata di U rispetto a x è P e quella rispetto a y è Q', 'specificare che P e Q sono le derivate parziali di U', esatta));
  prova('orale: citazione vera ma fuori tema non smentisce', !AI.citazioneValida('Si dimostra su un dominio normale', "l'estensione ai domini regolari", 'Si dimostra su un dominio normale: lo stesso per P.'));
  prova('orale: citazione inventata non smentisce', !AI.citazioneValida('P e Q sono le derivate parziali di U', 'le derivate parziali di U', esatta));
  x = AI.correggiGiudizio({ esito: 'parziale', giudizio: 'Hai definito correttamente la forma esatta, ma manca specificare che P e Q sono le derivate parziali di U.', mancava: '', risposta: esatta, smentite: ['specificare che P e Q sono le derivate parziali di U'] });
  prova('orale: mancanza smentita → giusta', x.esito === 'giusta' && x.giudizio === 'Hai definito correttamente la forma esatta.', JSON.stringify(x));
  prova('orale: mancanze lette dal giudizio', JSON.stringify(AI.mancanze('Bene, ma manca la regolarità del bordo.')) === '["la regolarità del bordo"]');
  const rip = AI.ripassoOrale({ storico: [{ argomento: 'Green', esito: 'parziale', mancava: 'La regolarità del bordo' }, { argomento: 'Hessiana', esito: 'giusta' }, { argomento: 'Dini', esito: 'sbagliata', mancava: '' }] });
  prova('orale: da ripassare, prima le peggiori e niente di inventato', JSON.stringify(rip) === '["Dini","Green: la regolarità del bordo"]', JSON.stringify(rip));
} else console.log('(ai.js non caricabile in Node:', AI.errore.message, ')');

// sicurezza della barra: librerie con versione esatta, Content-Security-Policy, percorsi dal renderer, backup, chiavi
{
  const { createHash } = await import('node:crypto');
  const { existsSync } = await import('node:fs');
  const radice = new URL('../', import.meta.url), leggi = f => readFileSync(new URL(f, radice), 'utf8');
  const L = await import('../js/librerie.js'), FO = await import('../js/fornitori.js'), VA = await import('../desktop/vault.mjs');
  const pkg = JSON.parse(leggi('desktop/package.json'));
  prova('librerie: versioni esatte come desktop/package.json', Object.entries(L.VERSIONI).every(([n, v]) => /^\d+\.\d+\.\d+$/.test(v) && pkg.devDependencies[n] === v), JSON.stringify(L.VERSIONI));
  prova('librerie: nel browser da jsDelivr con la versione esatta', L.libreria('pdf') === `https://cdn.jsdelivr.net/npm/pdfjs-dist@${L.VERSIONI['pdfjs-dist']}/build/pdf.min.mjs` && L.libreria('temml').includes('temml@' + L.VERSIONI.temml + '/'));
  const fuori = moduli.filter(f => f !== 'librerie.js' && /cdn\.jsdelivr|unpkg\.com|esm\.sh|https:\/\/[^'"`\s]+\.m?js['"`]/.test(readFileSync(new URL(f, JS), 'utf8')));
  prova('librerie: nessun altro modulo carica codice dalla rete', !fuori.length, fuori.join(', '));
  prova('librerie: niente SDK di Anthropic da un CDN', !/@anthropic-ai\/sdk/.test(leggi('js/ai.js')));
  const html = leggi('index.html'), csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1] || '';
  const dir = n => (csp.match(new RegExp('(?:^|;)\\s*' + n + ' ([^;]+)')) || [, ''])[1].split(/\s+/);
  prova('CSP: c\'è, e senza unsafe-inline o unsafe-eval negli script', csp && !dir('script-src').some(x => /unsafe-inline|unsafe-eval'$/.test(x) && x !== "'wasm-unsafe-eval'") && !dir('script-src').includes("'unsafe-inline'"), csp);
  prova('CSP: connect-src con ogni servizio della «tua AI» (js/fornitori.js)', FO.originiAI().every(o => dir('connect-src').includes(o)), FO.originiAI().filter(o => !dir('connect-src').includes(o)).join(' '));
  // Ollama e gli aggiornamenti da GitHub passano dal main: dalla pagina solo i servizi della «tua AI» e i modelli della voce
  const VOCE = ['https://huggingface.co', 'https://*.huggingface.co', 'https://*.hf.co'];
  prova('CSP: connect-src solo «tua AI» e modelli della voce (niente Ollama, localhost o GitHub)', VOCE.every(o => dir('connect-src').includes(o)) && dir('connect-src').every(o => o === "'self'" || FO.originiAI().includes(o) || VOCE.includes(o)), dir('connect-src').join(' '));
  prova('CSP: nessun form va altrove (form-action \'none\')', dir('form-action').join(' ') === "'none'", dir('form-action').join(' '));
  // la CSP dell'app impacchettata (desktop/prepara.mjs → cspApp): anche con index.html in CRLF, come in un checkout su Windows
  const VE = await import('../desktop/vendor.mjs'), lf = html.replace(/\r\n/g, '\n'), crlf = lf.replace(/\n/g, '\r\n');
  const scriptApp = x => { try { const h = VE.cspApp(x); return (h.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1].match(/script-src ([^;]+)/)?.[1] || '') + (h.includes('type="importmap"') ? ' +importmap' : ''); } catch (e) { return e.message; } };
  prova('CSP dell\'app: senza jsDelivr né import map, con fine riga LF e CRLF', scriptApp(lf) === "'self' 'wasm-unsafe-eval'" && scriptApp(crlf) === "'self' 'wasm-unsafe-eval'", scriptApp(lf) + ' / ' + scriptApp(crlf));
  prova('CSP: da jsDelivr solo i file con la versione esatta', dir('script-src').filter(x => x.includes('jsdelivr')).every(x => x === L.libreria('temml') || L.libreria('pdf').startsWith(x)));
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
  prova('CSP: l\'unico script scritto nella pagina è l\'import map, con la sua impronta', inline.length === 1 && /type="importmap"/.test(inline[0][1]) && dir('script-src').includes(`'sha256-${createHash('sha256').update(inline[0][2]).digest('base64')}'`));
  const mappa = JSON.parse(inline[0]?.[2] || '{}');
  prova('import map: impronta per pdf.js e Temml', !!mappa.integrity?.[L.libreria('pdf')] && !!mappa.integrity?.[L.libreria('temml')]);
  const nm = { [L.libreria('pdf')]: 'desktop/node_modules/pdfjs-dist/build/pdf.min.mjs', [L.libreria('temml')]: 'desktop/node_modules/temml/dist/temml.mjs' };
  if (existsSync(new URL(nm[L.libreria('pdf')], radice))) prova('import map: le impronte sono quelle dei file in node_modules', Object.entries(nm).every(([u, f]) => mappa.integrity[u] === 'sha384-' + createHash('sha384').update(readFileSync(new URL(f, radice))).digest('base64')));
  // percorsi chiesti dalla barra: normalizzati prima dei controlli sulle cartelle
  const rel = x => { try { return VA.relativo(x); } catch { return null; } };
  prova('percorsi: lezioni in sottocartelle e barre di Windows', rel('Lezioni/Corso/Esercitazioni/x.md') === 'Lezioni/Corso/Esercitazioni/x.md' && rel('Lezioni\\A\\b.md') === 'Lezioni/A/b.md' && rel('./Sbobine//a.md') === 'Sbobine/a.md');
  prova('percorsi: niente «..», cartelle col punto o percorsi assoluti', ['Lezioni/../.obsidian/x.css', 'Anki/../.lode/dati.json', '.obsidian/app.json', 'Sbobine/.x.md', '/etc/passwd', 'C:/x', 'Lezioni/..', ''].every(x => rel(x) === null));
  // ogni finestra resta sulla pagina di Lode (restaLode, will-navigate) e il ponte c'è solo nelle pagine file:// dell'app;
  // il comportamento vero lo prova test/prova-app.mjs («difese: un link non porta la barra su un'altra pagina»)
  const main = leggi('desktop/main.mjs'), finestre = [...main.matchAll(/(\w+) = new BrowserWindow\(/g)].map(m => m[1]);
  prova('finestre: tutte con restaLode', finestre.length >= 3 && finestre.every(w => main.includes(`restaLode(${w});`)), finestre.join(', '));
  prova('preload: il ponte solo nelle pagine file://', /if \(location\.protocol === 'file:'\) contextBridge\.exposeInMainWorld/.test(leggi('desktop/preload.cjs')));
  prova('fornitori: il main sceglie la base solo dall\'elenco', FO.baseDi('openai') === 'https://api.openai.com/v1' && FO.baseDi('anthropic') === null && FO.baseDi('__proto__') === null && FO.baseDi('http://127.0.0.1') === null);
  // backup: un file preparato ad arte si rifiuta; quello di Lode passa
  const buono = JSON.parse(JSON.stringify(D.esporta()));
  prova('backup: quello esportato da Lode è valido', D.backupValido(buono));
  prova('backup: CFU con HTML rifiutati', !D.backupValido({ ...buono, esami: [{ ...buono.esami[0], cfu: '<img src=x onerror=alert(1)>' }] }));
  prova('backup: id con HTML rifiutati', !D.backupValido({ ...buono, esami: [{ ...buono.esami[0], id: '"><img src=x>' }] }) && !D.backupValido({ ...buono, carte: [{ id: 'c1', esameId: '"><b>', fronte: 'a', retro: 'b' }] }));
  prova('backup: CFU e voti tornano numeri', (() => { const prima = D.D; D.sostituisci({ ...buono, esami: [{ ...buono.esami[0], cfu: '9', voto: '28' }] }); const e = D.D.esami[0], r = e.cfu === 9 && e.voto === 28; D.sostituisci(prima); return r; })());
  // .lode/dati.json di un vault condiviso o sincronizzato: passa da unisci(), non da backupValido(). Un'istanza nuova di
  // dati.js che legge «dal vault» (window è globalThis, riga 126): l'id con HTML si scarta, le ore tornano un numero
  {
    const STRANO = 'x"><a href="https://esempio.invalid/" style="position:fixed;inset:0;z-index:9"></a><b class="';
    globalThis.lodeDesktop = { leggiDati: () => ({ v: 1, esami: [{ id: STRANO, nome: 'Trappola', cfu: 6 }, { id: 'buono1', nome: 'Analisi', cfu: '9', oreObiettivo: '1"><i>x</i>' }, null, { id: 'buono2', nome: 'Fisica', cfu: 6, oreObiettivo: '40' }] }), salvaDati() { }, su() { } };
    const DV = await import('../js/dati.js?vault').finally(() => { delete globalThis.lodeDesktop; });
    const es = DV.D.esami;
    prova('vault: l\'esame con un id strano si scarta, gli altri restano', DV.DESKTOP && es.length === 2 && es.map(e => e.id).join() === 'buono1,buono2', JSON.stringify(es.map(e => e?.id)));
    prova('vault: ore previste come numero o niente', es[0]?.oreObiettivo === null && DV.obiettivo(es[0]) === 90 && es[1]?.oreObiettivo === 40, JSON.stringify(es.map(e => e?.oreObiettivo)));
  }
  // «Cancella tutto» (pagina.js): prima scollega il servizio, poi svuota i dati; non resta nessuna chiave
  if (!AI.errore) {
    const mem = new Map([['lode:chiavi', '{"openai":"sk-prova"}']]), prima = globalThis.localStorage, dati = D.D;
    globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
    D.D.imp.chiave = 'sk-prova'; D.D.imp.ai = { fornitore: 'openai', modello: 'x', uso: 'tutto' };
    const tolta = AI.FORNITORI[AI.scollegaFornitore()]; D.sostituisci(D.VUOTO());
    const pag = readFileSync(new URL('pagina.js', JS), 'utf8').match(/azione === 'azzera'[^\n]*\n[^\n]*/)?.[0] || '';
    prova('chiavi: «Cancella tutto» toglie anche le chiavi', tolta?.nome === 'ChatGPT' && !D.D.imp.chiave && !mem.has('lode:chiavi') && !(mem.get('lode:v1') || '').includes('sk-prova') && /scollegaFornitore\(\)[^\n]*sostituisci\(VUOTO\(\)\)/.test(pag), [...mem.keys()].join(' '));
    globalThis.localStorage = prima; D.sostituisci(dati);
  }
  // «Usa solo il cervello locale»: le chiavi salvate se ne vanno davvero
  if (!AI.errore) {
    const tolte = []; const prima = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => '{"openai":"sk-prova"}', setItem() { }, removeItem: k => tolte.push(k) };
    D.D.imp.chiave = 'sk-prova'; D.D.imp.ai = { fornitore: 'openai', modello: 'x', uso: 'tutto' };
    const f = AI.scollegaFornitore();
    prova('chiavi: scollegare cancella le chiavi salvate', f === 'openai' && tolte.includes('lode:chiavi') && !D.D.imp.chiave && !AI.fornitore());
    globalThis.localStorage = prima;
  }
}

console.log(`${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
