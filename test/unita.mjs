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

// «Ripeti» controllato a ogni minuto: acceso a mano fuori orario non si spegne subito (prima si spegneva al minuto dopo)
{
  const O = await import('../js/orecchio.js'), ora = Date.parse('2026-10-03T12:00:00Z'), r = o => O.regolaAula({ ora, auto: true, trascrive: false, ...o });
  prova('ripeti: a lezione si accende da solo', r({ acceso: false, inLezione: true }) === 'accendi' && r({ acceso: true, inLezione: true }) === null);
  prova('ripeti: spento altrove (altro computer, configurazione) si spegne anche se acceso a mano o a lezione', r({ auto: false, acceso: true, inLezione: false, manualeDa: ora - 60e3 }) === 'spegni' && r({ auto: false, acceso: true, inLezione: true }) === 'spegni' && r({ auto: false, acceso: false, inLezione: true }) === null);
  prova('ripeti: acceso dalla lezione, finita la lezione si spegne', r({ acceso: true, inLezione: false }) === 'spegni');
  prova('ripeti: acceso a mano fuori orario resta acceso', r({ acceso: true, inLezione: false, manualeDa: ora - 10 * 60e3 }) === null && r({ acceso: true, inLezione: false, manualeDa: ora - O.MANUALE + 60e3 }) === null);
  prova('ripeti: acceso a mano, dopo 3 ore si spegne da solo', r({ acceso: true, inLezione: false, manualeDa: ora - O.MANUALE }) === 'spegni');
  prova('ripeti: mentre trascrivi non si tocca, spento resta spento', r({ acceso: true, inLezione: false, trascrive: true }) === null && r({ acceso: false, inLezione: false }) === null);
}
prova('esame detto a voce', c("ho l'esame di analisi 2 il 15 gennaio")?.esistente?.nome === 'Analisi 2' && c('analisi 2 spostato al 20 gennaio')?.data?.endsWith('-01-20'));
prova('«ho lezione domani» non crea esami', c('ho lezione domani')?.tipo !== 'esame');
prova('proposte', c('proposte frequenti')?.livello === 'spesso' && c('spegni le proposte')?.livello === 'mai');
prova('gioca', c('gioca analisi 2')?.tipo === 'gioco');
prova('naviga', c('apri glossario')?.tipo === 'naviga');
prova('domanda libera all\'AI', c('spiegami il teorema di Stokes') === null);

// informatica: «Cosa stampa?», «Segui il progetto», «spiegami l'errore», il diario
prova('cosa stampa', c('cosa stampa')?.tipo === 'stampa' && c('Cosa stampa?')?.tipo === 'stampa' && c('esercizi di C')?.tipo === 'stampa' && c('esercizio di programmazione')?.tipo === 'stampa' && c('allenami su c')?.tipo === 'stampa');
prova('cosa stampa in Python e in Java', c('cosa stampa python')?.lingua === 'python' && c('Cosa stampa in Java?')?.lingua === 'java' && c('esercizi di python')?.lingua === 'python' && c('allenami su java')?.lingua === 'java' && c('cosa stampa c')?.lingua === 'c' && !c('cosa stampa')?.lingua && c('allenami')?.tipo === 'gioco');
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
prova('sincronizza: i comandi in italiano', c('sincronizza fra i computer')?.tipo === 'sincronizza' && c('sincronizza')?.cosa === null && c('smetti di sincronizzare')?.cosa === 'smetti' && c('smetti su questo computer')?.cosa === 'smetti' && c('sblocca')?.cosa === 'sblocca' && c('uso già lode su un altro computer')?.cosa === 'collega' && c('smetti di seguire')?.tipo !== 'sincronizza' && c('prepara obsidian')?.tipo === 'prepara', JSON.stringify([c('sincronizza'), c('uso già lode su un altro computer'), c('smetti di seguire')]));
prova('sincronizza: spegni, password, collega un altro computer', c('spegni la sincronizzazione')?.cosa === 'smetti' && c('disattiva la sincronizzazione')?.cosa === 'smetti' && c('cambia password')?.cosa === 'password' && c('ho dimenticato la password')?.cosa === 'password' && c('accendi la sincronizzazione')?.cosa === null && c('collega un altro computer')?.cosa === 'altro' && c('uso già lode su un altro computer')?.cosa === 'collega', JSON.stringify([c('spegni la sincronizzazione'), c('cambia password'), c('collega un altro computer')]));
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
  // il «mancava» passa solo se un pezzo del materiale sull'argomento lo dice, con le parole che cambiano il senso al loro posto.
  // Caso vero (riprese del reel, Qwen3.5 4B, materiale = dati d'esempio): per Green «derivate seconde» passava con le parole
  // della carta di Schwarz; deve restare solo «Teorema di Green»
  const esempio = `Carte del ripasso:
– Che cos'è il gradiente di f(x, y)? → Il vettore delle derivate parziali (∂f/∂x, ∂f/∂y): punta nella direzione di massima crescita.
– Enuncia il teorema di Schwarz → Se le derivate seconde miste sono continue in un intorno, allora f_xy = f_yx.
– Condizione per un punto stazionario → Il gradiente si annulla: ∇f(x₀) = 0.
– Come si classifica un punto stazionario? → Con la matrice hessiana: definita positiva → minimo, definita negativa → massimo, indefinita → sella.
– Teorema di Green: enunciato → L'integrale di linea su ∂D di P dx + Q dy è uguale all'integrale doppio su D di (∂Q/∂x − ∂P/∂y).
– Serie geometrica: quando converge? → Per |q| < 1, con somma 1/(1 − q).

Lezioni:
– Teorema di Green: Lega l'integrale di linea lungo il bordo di un dominio all'integrale doppio sul dominio.
– ★ Il teorema di Green all'esame lo chiede sempre, con la dimostrazione`;
  // le carte che Qwen3.5 ha scritto dalle slide, e il testo delle slide com'esce dal PDF (righe spezzate a metà frase)
  const qwen = `– Quali sono le condizioni per applicare il Teorema di Green? → Il dominio deve essere regolare con bordo orientato positivamente e P, Q devono avere derivate parziali continue.
– Come si comporta l'integrale di una forma esatta lungo una curva? → Dipende esclusivamente dagli estremi della curva e non dal percorso seguito.`;
  const slide = `Teorema di Green 
Sia D un dominio regolare con bordo orientato positivamente (senso
antiorario). Se P e Q hanno derivate parziali continue, l'integrale di
linea di P dx + Q dy lungo il bordo di D è uguale all'integrale doppio su
D di (∂Q/∂x − ∂P/∂y).`;
  const seconde = "La condizione di continuità delle derivate seconde nell'intorno.";
  const dm = (cosa, mat, tema) => AI.dalMateriale(cosa, mat, tema);
  prova('orale: «derivate seconde» per Green non passa con la carta di Schwarz', !dm(seconde, esempio, ['Teorema di Green', 'Come si dimostra il teorema di Green?']));
  prova('orale: «derivate seconde» per Green non passa con la carta di Green', !dm(seconde, qwen, 'Teorema di Green') && !dm(seconde, slide, 'Teorema di Green'));
  prova('orale: «seconde» al posto di «parziali» non passa', !dm('La continuità delle derivate seconde di P e Q', slide, 'Teorema di Green'));
  prova('orale: senza materiale niente «mancava»', !dm('P e Q devono avere derivate parziali continue', '', 'Teorema di Green'));
  const verde = AI.ripassoOrale({ storico: [{ argomento: 'Teorema di Green', esito: 'parziale', mancava: dm(seconde, esempio, 'Teorema di Green') ? seconde : '' }] });
  prova('orale: da ripassare resta solo l\'argomento', JSON.stringify(verde) === '["Teorema di Green"]', JSON.stringify(verde));
  prova('orale: vero dalla carta di Green resta', dm('P e Q devono avere derivate parziali continue', qwen, 'Teorema di Green') && dm('La condizione che P e Q abbiano derivate parziali continue', slide, 'Teorema di Green'));
  prova('orale: vero dalle slide, titolo due righe sopra', dm('Il bordo deve essere orientato positivamente, in senso antiorario', slide, 'Teorema di Green'));
  prova('orale: vero su Schwarz resta (seconde e miste ci sono)', dm('Le derivate seconde miste devono essere continue in un intorno', esempio, 'Teorema di Schwarz'));
  prova('orale: la carta giusta ma su un altro argomento non basta', !dm('Le derivate seconde miste devono essere continue in un intorno', esempio, 'Teorema di Green'));
  prova('orale: segni al loro posto', dm('Definita negativa vuol dire massimo, indefinita vuol dire sella', esempio, 'Classificazione stazionari') && !dm('Definita positiva vuol dire massimo', esempio, 'Classificazione stazionari'));
  prova('orale: i numeri devono essere quelli', dm('Converge per |q| < 1 con somma 1/(1 − q)', esempio, 'Serie geometrica') && !dm('Converge per |q| < 2', esempio, 'Serie geometrica'));
  prova('orale: «solo» ~ «esclusivamente»', dm('Dipende solo dagli estremi della curva', qwen, 'Forma esatta'));
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

// la voce Parakeet ONNX (desktop/voce-onnx.mjs, voce-onnx-motore.mjs): le parti che non hanno bisogno del modello vero.
// Scelta del motore, versioni esatte, URL e impronte, download con ripresa e impronta sbagliata (una rete finta e un
// «modello» di pochi byte), il contratto della fila con un processo finto che usa la logica vera del motore, e il ripiego
// su Whisper nella barra. Il modello vero lo prova test/voce-onnx.mjs
{
  const { createHash } = await import('node:crypto');
  const { mkdtempSync, writeFileSync, existsSync, readdirSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const VO = await import('../desktop/voce-onnx.mjs'), MO = await import('../desktop/voce-onnx-motore.mjs');
  const radice = new URL('../', import.meta.url), leggi = f => readFileSync(new URL(f, radice), 'utf8');
  const GB = 2 ** 30, sc = x => VO.scegliMotore({ memoria: 16 * GB, ...x });
  prova('voce: Mac con chip Apple e lode-voce → Neural Engine, come prima', sc({ piattaforma: 'darwin', arch: 'arm64', lodeVoce: true, sherpa: true }) === 'mac');
  prova('voce: Windows e Linux con l\'addon e memoria → Parakeet ONNX', sc({ piattaforma: 'win32', arch: 'x64', sherpa: true }) === 'onnx' && sc({ piattaforma: 'linux', arch: 'x64', sherpa: true, memoria: 8 * GB - 300e6 }) === 'onnx');
  prova('voce: poca memoria, niente addon o addon guasto → Whisper', sc({ piattaforma: 'win32', arch: 'x64', sherpa: true, memoria: 4 * GB }) === 'whisper' && sc({ piattaforma: 'linux', arch: 'x64' }) === 'whisper' && sc({ piattaforma: 'win32', arch: 'x64', sherpa: true, guasta: 'addon' }) === 'whisper');
  prova('voce: Mac Intel del pacchetto (senza sherpa) → Whisper; Mac di sviluppo senza lode-voce → ONNX', sc({ piattaforma: 'darwin', arch: 'x64' }) === 'whisper' && sc({ piattaforma: 'darwin', arch: 'arm64', sherpa: true }) === 'onnx');
  prova('voce: il pacchetto dell\'addon per sistema', VO.pacchettoAddon('win32', 'x64') === 'sherpa-onnx-win-x64' && VO.pacchettoAddon('linux', 'arm64') === 'sherpa-onnx-linux-arm64' && VO.pacchettoAddon('win32', 'arm64') === null && VO.pacchettoAddon('freebsd', 'x64') === null);
  prova('voce: sherpaPresente senza addon per il sistema → false, senza caricarlo', VO.sherpaPresente({ piattaforma: 'freebsd', arch: 'x64' }) === false && VO.sherpaPresente({ piattaforma: 'win32', arch: 'x64', moduli: tmpdir() }) === false);
  prova('voce: fili per onnxruntime da 1 a 4', VO.fili(1) === 1 && VO.fili(4) === 2 && VO.fili(32) === 4);
  // versioni esatte: package.json (dipendenza e overrides per ogni addon), package-lock e il codice
  const pkg = JSON.parse(leggi('desktop/package.json')), lock = JSON.parse(leggi('desktop/package-lock.json')), V = VO.VERSIONE_SHERPA;
  const addon = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'win-x64', 'win-ia32'].map(a => 'sherpa-onnx-' + a);
  prova('voce: sherpa-onnx-node con la versione esatta in package.json, overrides e package-lock', /^\d+\.\d+\.\d+$/.test(V) && pkg.dependencies['sherpa-onnx-node'] === V && addon.every(a => pkg.overrides[a] === V)
    && ['sherpa-onnx-node', ...addon].every(a => lock.packages['node_modules/' + a]?.version === V && lock.packages['node_modules/' + a]?.resolved?.startsWith('https://registry.npmjs.org/')), JSON.stringify(addon.map(a => lock.packages['node_modules/' + a]?.version)));
  prova('voce: nessuno script d\'installazione nei pacchetti di sherpa-onnx', ['sherpa-onnx-node', ...addon].every(a => !lock.packages['node_modules/' + a]?.hasInstallScript));
  const B = pkg.build;
  prova('voce: i due moduli nel pacchetto, l\'addon fuori dall\'asar, il Mac universale senza sherpa (lode-voce e lode-ascolta già universali)', ['voce-onnx.mjs', 'voce-onnx-motore.mjs'].every(f => B.files.includes(f)) && ['win', 'linux'].every(s => B.asarUnpack?.includes(`node_modules/sherpa-onnx-${s}-*/**`)) && B.files.includes('!node_modules/sherpa-onnx-darwin-*{,/**}') && !B.mac.files && B.mac.x64ArchFiles === 'Contents/Resources/bin/{lode-voce,lode-ascolta}');
  // nel pacchetto ci sono tutti i moduli che il main importa (a cascata): nella 0.5.0 mancavano sincronizza.mjs e sync/,
  // e l'app installata si chiudeva all'avvio. vendor.mjs si importa solo in sviluppo (!app.isPackaged)
  {
    const nelPacchetto = f => B.files.some(g => !g.startsWith('!') && (g === f || (g.endsWith('/**') && f.startsWith(g.slice(0, -2)))));
    const visti = new Set(), mancano = [], coda = ['main.mjs'];
    while (coda.length) {
      const f = coda.shift(); if (visti.has(f)) continue; visti.add(f);
      if (!nelPacchetto(f)) mancano.push(f);
      const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/') + 1) : '';
      for (const m of leggi('desktop/' + f).matchAll(/(?:^|\n)\s*import\s[^'"]*?from\s+['"](\.\/[^'"]+)['"]|\bimport\(\s*['"](\.\/[^'"]+)['"]\s*\)|utilityProcess\.fork\([^)]*?['"]([\w-]+\.mjs)['"]/g)) {
        const rel = (m[1] || m[2] || ('./' + m[3])).slice(2);
        if (rel !== 'vendor.mjs') coda.push((dir + rel).replace(/[^/]+\/\.\.\//g, ''));
      }
    }
    prova('pacchetto: tutti i moduli importati dal main sono negli installer (build.files)', !mancano.length && visti.has('sincronizza.mjs') && visti.has('sync/motore.mjs') && visti.has('collegamento.mjs'), 'mancano: ' + mancano.join(', ') + ' · visti: ' + [...visti].join(', '));
  }
  prova('voce: modello da un commit preciso (mai main o latest), impronte SHA256 complete', /\/resolve\/[0-9a-f]{40}\/$/.test(VO.MODELLO.base) && !/\/(main|latest)\//.test(VO.MODELLO.base) && VO.MODELLO.file.length === 4 && VO.MODELLO.file.every(f => /^[0-9a-f]{64}$/.test(f.sha256) && f.byte > 0));
  prova('voce: il peso detto all\'interfaccia è quello dei file', Math.abs(VO.MODELLO.file.reduce((s, f) => s + f.byte, 0) / 2 ** 20 - VO.PESO_MB) < 10);
  // il job della CI con la cache del modello: la chiave contiene le impronte (cambiano → si riscarica)
  const yml = leggi('.github/workflows/prove.yml'), job = yml.slice(yml.indexOf('  voce-onnx:'));
  prova('voce: job «Voce Parakeet (ONNX)» a richiesta, Windows e Linux, sola lettura, senza credenziali, cache con le impronte', yml.includes('  voce-onnx:') && /name: Voce Parakeet \(ONNX\)/.test(job) && /\[voce\]/.test(job) && /windows-latest/.test(job) && /ubuntu-latest/.test(job)
    && /persist-credentials: false/.test(job) && /contents: read/.test(job) && VO.MODELLO.file.every(f => job.includes(f.sha256.slice(0, 12))) && /actions\/cache@/.test(job), job.slice(0, 200));
  // impronta e download: un «modello» di due file piccoli, una rete finta che sa riprendere (Range) o no
  const dir = mkdtempSync(join(tmpdir(), 'lode-voce-onnx-')), sha = b => createHash('sha256').update(b).digest('hex');
  const A = Buffer.alloc(300000, 7), T = Buffer.from('ciao 0\nmondo 1\n');
  for (let i = 0; i < A.length; i++) A[i] = (i * 31) % 251;
  const finto = { base: 'https://esempio.invalid/m/', file: [{ nome: 'a.onnx', byte: A.length, sha256: sha(A) }, { nome: 'tokens.txt', byte: T.length, sha256: sha(T) }] };
  writeFileSync(join(dir, 'x.bin'), A);
  prova('voce: impronta SHA256 di un file', await VO.impronta(join(dir, 'x.bin')) === sha(A));
  const contenuti = { 'a.onnx': A, 'tokens.txt': T }; let chieste = [];
  const rete = ({ guasta = {}, senzaRange = false } = {}) => async (url, opz) => {
    const nome = url.split('/').pop(), b = guasta[nome] || contenuti[nome], r = opz?.headers?.Range; chieste.push(nome + (r ? ' ' + r : ''));
    if (r && !senzaRange) { const da = +r.match(/bytes=(\d+)-/)[1]; return new Response(b.subarray(da), { status: 206, headers: { 'content-range': `bytes ${da}-${b.length - 1}/${b.length}` } }); }
    return new Response(b, { status: 200 });
  };
  const m1 = join(dir, 'm1'), p = []; chieste = [];
  await VO.scaricaModello({ cartella: m1, modello: finto, rete: rete(), avanza: x => p.push(x) });
  prova('voce: download completo, verificato, senza .parziale, avanzamento fino a 1', readFileSync(join(m1, 'a.onnx')).equals(A) && readFileSync(join(m1, 'tokens.txt')).equals(T) && !readdirSync(m1).some(f => f.endsWith('.parziale')) && !existsSync(join(m1, 'verificato.json')) && p.at(-1) === 1 && p.every((x, i) => !i || x >= p[i - 1]) && VO.statoModello(m1, finto).pronto, JSON.stringify({ p: p.slice(-3), f: readdirSync(m1) }));
  chieste = []; const r2 = await VO.scaricaModello({ cartella: m1, modello: finto, rete: rete() });
  prova('voce: modello già verificato in questa sessione → niente rete', r2.scaricati === 0 && !chieste.length, chieste.join());
  const r2b = await VO.scaricaModello({ cartella: m1, modello: finto, rete: rete(), verificati: new Map() });
  prova('voce: a un altro avvio di Lode il modello sano si rilegge, senza rete', r2b.scaricati === 0 && !chieste.length);
  const m2 = join(dir, 'm2'); (await import('node:fs')).mkdirSync(m2); writeFileSync(join(m2, 'a.onnx.parziale'), A.subarray(0, 120000)); chieste = [];
  await VO.scaricaModello({ cartella: m2, modello: finto, rete: rete() });
  prova('voce: download ripreso da dove era rimasto (Range)', chieste.includes('a.onnx bytes=120000-') && readFileSync(join(m2, 'a.onnx')).equals(A), chieste.join());
  const m3 = join(dir, 'm3'); (await import('node:fs')).mkdirSync(m3); writeFileSync(join(m3, 'a.onnx.parziale'), A.subarray(0, 50000));
  await VO.scaricaModello({ cartella: m3, modello: finto, rete: rete({ senzaRange: true }) });
  prova('voce: server che non riprende (200) → il file ricomincia da capo, giusto', readFileSync(join(m3, 'a.onnx')).equals(A));
  const m4 = join(dir, 'm4'), rotto = Buffer.from(A); rotto[1234] ^= 1; let e4 = null;
  try { await VO.scaricaModello({ cartella: m4, modello: finto, rete: rete({ guasta: { 'a.onnx': rotto } }) }); } catch (e) { e4 = e; }
  prova('voce: impronta diversa → errore «impronta» (ripiego), file cancellato', e4?.codice === 'impronta' && VO.RIPIEGO.includes('impronta') && !readdirSync(m4).some(f => f.startsWith('a.onnx')), e4?.message);
  writeFileSync(join(m1, 'tokens.txt'), 'cambiato\n'); chieste = [];
  await VO.scaricaModello({ cartella: m1, modello: finto, rete: rete() });
  prova('voce: un file cambiato sul disco si ricontrolla e si riscarica', chieste.join() === 'tokens.txt' && readFileSync(join(m1, 'tokens.txt')).equals(T) && !VO.statoModello(m4, finto).pronto, chieste.join());
  // stessa dimensione e stessa data di modifica, contenuto diverso (una lettera cambiata, la data rimessa com'era come
  // con touch -r): si vede sia nella stessa sessione (la data di cambio, ctime, non torna indietro) sia a un altro avvio
  const { statSync, utimesSync } = await import('node:fs');
  const tk = join(m1, 'tokens.txt'), T2 = Buffer.from(T); T2[0] ^= 0x20;
  utimesSync(tk, 1.7e9, 1.7e9); await VO.scaricaModello({ cartella: m1, modello: finto, rete: rete() }); const prima = statSync(tk);
  for (const [nome, verificati] of [['nella stessa sessione', undefined], ['a un altro avvio di Lode', new Map()]]) {
    writeFileSync(tk, T2); utimesSync(tk, 1.7e9, 1.7e9); chieste = [];
    const st = statSync(tk), uguale = st.size === prima.size && st.mtimeMs === prima.mtimeMs;
    await VO.scaricaModello({ cartella: m1, modello: finto, rete: rete(), ...(verificati ? { verificati } : {}) });
    prova(`voce: stessa dimensione e stessa data, contenuto diverso → si riscarica (${nome})`, uguale && chieste.join() === 'tokens.txt' && readFileSync(tk).equals(T), chieste.join());
  }
  let e5 = null; chieste = [];
  try { await VO.scaricaModello({ cartella: join(dir, 'm5'), modello: finto, rete: rete(), libero: () => 1000 }); } catch (e) { e5 = e; }
  prova('voce: spazio che non basta → errore «spazio» prima di scaricare, in MB da 2^20 come il peso detto all\'interfaccia', e5?.codice === 'spazio' && !chieste.length && / circa 96 MB liberi/.test(e5.message), e5?.message);
  let e6 = null;
  try { await VO.scaricaModello({ cartella: join(dir, 'm6'), modello: finto, rete: async () => { throw new Error('offline'); } }); } catch (e) { e6 = e; }
  prova('voce: rete che manca → errore «rete», niente ripiego (si riprova la volta dopo)', e6?.codice === 'rete' && !VO.RIPIEGO.includes('rete'));
  // il contratto della fila: un processo finto nello stesso Node, con la logica vera di voce-onnx-motore.mjs (servi) e un
  // riconoscitore finto che ci mette un po'. I messaggi passano dal clone strutturato, come fra processi
  let processi = 0, uccisi = 0, insieme = 0, maxInsieme = 0, ultimo = null, ricevuto = null;
  const riconoscitore = { createStream: () => ({ acceptWaveform(o) { this.o = o; } }), async decodeAsync(s) { insieme++; maxInsieme = Math.max(maxInsieme, insieme); ricevuto = s.o.samples; await new Promise(r => setTimeout(r, 15)); insieme--; return { text: 'n' + s.o.samples.length }; } };
  // esce: come un processo vero, ucciso manda anche l'evento d'uscita (codice null)
  const processoFinto = ({ addon = () => ({ version: 'finta' }), carica = async () => riconoscitore, esce = false } = {}) => () => {
    processi++; const su = { messaggio: [], uscita: [] }; let vivo = true;
    const ricevi = MO.servi({ manda: m => setImmediate(() => vivo && su.messaggio.forEach(f => f(structuredClone(m)))), addon, carica });
    return ultimo = { manda: m => { if (!vivo) throw new Error('morto'); setImmediate(() => vivo && ricevi(structuredClone(m))); }, su: (ev, f) => su[ev].push(f), uccidi: () => { if (vivo) { vivo = false; uccisi++; if (esce) setImmediate(() => su.uscita.forEach(f => f(null))); } }, crash: () => { vivo = false; su.uscita.forEach(f => f(134)); }, pid: () => 1 };
  };
  // l'audio lungo (Ripeti fino a 90 s) a finestre di al massimo 30 s, tagliate nella pausa: la memoria resta quella di 30 s
  const lungo = new Float32Array(90 * 16000).fill(.2); lungo.fill(0, 24 * 16000, 24 * 16000 + 3200);   // una pausa a 24 s
  const fw = MO.finestre(lungo.length, lungo);
  prova('voce: audio oltre 30 s a finestre di al massimo 30 s, la prima tagliata nella pausa, senza buchi', fw.length === 4 && fw.every(([a, b]) => b - a <= 30 * 16000 && b - a > 0) && fw[0][0] === 0 && fw.at(-1)[1] === lungo.length && fw.every(([a], i) => !i || a === fw[i - 1][1]) && fw[0][1] >= 24 * 16000 && fw[0][1] <= 24 * 16000 + 3200, JSON.stringify(fw));
  prova('voce: fino a 30 s un pezzo solo', JSON.stringify(MO.finestre(30 * 16000, new Float32Array(30 * 16000))) === '[[0,480000]]' && MO.finestre(1000, new Float32Array(1000)).length === 1);
  const mf = VO.crea({ cartella: m1, modello: finto, rete: rete(), avvia: processoFinto() });
  prova('voce: avvio pigro (nessun processo prima della prima frase)', processi === 0 && !mf.attivo());
  const audio = n => new Float32Array(n).fill(.25);
  const ris = await Promise.all([mf.trascrivi(audio(16000)), mf.trascrivi(audio(800)), mf.trascrivi(audio(32000))]);
  prova('voce: fila, una alla volta, risposte nell\'ordine giusto', ris.join() === 'n16000,n800,n32000' && maxInsieme === 1 && processi === 1, ris.join() + ' max ' + maxInsieme);
  prova('voce: l\'audio arriva intero (Float32Array in memoria)', ricevuto instanceof Float32Array && ricevuto.length === 32000 && ricevuto[31999] === .25);
  const sospesa = mf.trascrivi(audio(1000)); await new Promise(r => setTimeout(r, 1)); mf.chiudi();
  const es = await sospesa.then(() => null, e => e);
  prova('voce: a riposo il processo esce e la richiesta in attesa finisce', uccisi === 1 && !mf.attivo() && es?.codice === 'chiusa', es?.message);
  const dopo = await mf.trascrivi(audio(500));
  prova('voce: dopo il riposo riparte da sola', dopo === 'n500' && processi === 2);
  maxInsieme = 0; const lunga = await mf.trascrivi(lungo), pezzi = lunga.split(' ').map(x => +x.slice(1));
  prova('voce: 90 s al motore → una finestra alla volta, i testi uniti in ordine', pezzi.length === fw.length && pezzi.every((x, i) => x === fw[i][1] - fw[i][0]) && maxInsieme === 1, lunga);
  const inCorso = mf.trascrivi(audio(2000)); await new Promise(r => setTimeout(r, 2)); ultimo.crash();
  const ec = await inCorso.then(() => null, e => e);
  prova('voce: crash del processo → errore «crash» (ripiego), poi riparte', ec?.codice === 'crash' && VO.RIPIEGO.includes('crash') && await mf.trascrivi(audio(10)) === 'n10' && processi === 3, ec?.message);
  mf.chiudi(); chieste = [];
  const senzaAddon = VO.crea({ cartella: join(dir, 'm7'), modello: finto, rete: rete(), avvia: processoFinto({ addon: () => { throw new Error('Could not find sherpa-onnx-node'); } }) });
  const ea = await senzaAddon.trascrivi(audio(10)).then(() => null, e => e);
  prova('voce: addon che non si carica → errore «addon» prima di scaricare il modello, in italiano (il dettaglio a parte)', ea?.codice === 'addon' && !chieste.length && !existsSync(join(dir, 'm7', 'a.onnx')) && !senzaAddon.attivo() && !/Could not/.test(ea.message) && /Could not find/.test(ea.dettaglio), ea?.message);
  const verificatoPrima = VO.statoModello(m1, finto).pronto;
  const modelloRotto = VO.crea({ cartella: m1, modello: finto, rete: rete(), avvia: processoFinto({ carica: async () => { throw new Error(`Load model from ${join(m1, 'a.onnx')} failed:Protobuf parsing failed.`); } }) });
  const em = await modelloRotto.avvia().then(() => null, e => e);
  prova('voce: modello che non si carica → errore «modello» (ripiego), senza percorso né inglese per lo studente', em?.codice === 'modello' && VO.RIPIEGO.includes('modello') && !em.message.includes(m1) && !/Protobuf|failed/.test(em.message) && /Protobuf/.test(em.dettaglio), em?.message);
  prova('voce: modello che non si carica → il controllo si dimentica, al prossimo avvio si rileggono le impronte', verificatoPrima && !VO.statoModello(m1, finto).pronto);
  // chiudi() mentre il motore parte (un riposo, l'uscita): «chiusa», mai «crash» (il crash porta a Whisper per la sessione)
  const vc = VO.crea({ cartella: m1, modello: finto, rete: rete(), avvia: processoFinto({ esce: true }) });
  const pa = vc.avvia(), occupatoAvvio = vc.occupato(); vc.chiudi();
  const eAddon = await pa.then(() => null, e => e);
  let partito; const caricaPartita = new Promise(r => { partito = r; });
  const vc2 = VO.crea({ cartella: m1, modello: finto, rete: rete(), avvia: processoFinto({ esce: true, carica: async () => { partito(); await new Promise(r => setTimeout(r, 40)); return riconoscitore; } }) });
  const pb = vc2.avvia(); await caricaPartita; vc2.chiudi();
  const eCarica = await pb.then(() => null, e => e); await new Promise(r => setTimeout(r, 60));
  prova('voce: chiudi durante l\'avvio (addon o modello) → codice «chiusa», non «crash»', occupatoAvvio && eAddon?.codice === 'chiusa' && eCarica?.codice === 'chiusa' && !vc.occupato() && !vc2.attivo() && VO.statoModello(m1, finto).pronto, [eAddon?.codice, eCarica?.codice].join());
  rmSync(dir, { recursive: true, force: true });
  // nella barra (js/voce.js): il ripiego su Whisper con lo stesso audio, e i testi dell'interfaccia per ogni motore
  globalThis.window ??= globalThis;
  const VC = await import('../js/voce.js');
  const pezzo = new Float32Array(3); let aWhisper = null, ripiegato = 0;
  const t1 = await VC.conRipiego(pezzo, { nativo: async () => { throw Object.assign(new Error('addon'), { ripiego: true }); }, whisper: async a => { aWhisper = a; return 'da whisper'; }, ripiega: () => ripiegato++ });
  prova('voce: ripiego → lo stesso audio passa a Whisper', t1 === 'da whisper' && aWhisper === pezzo && ripiegato === 1);
  const e7 = await VC.conRipiego(pezzo, { nativo: async () => { throw new Error('rete'); }, whisper: async () => 'no', ripiega: () => ripiegato++ }).then(() => null, e => e);
  prova('voce: un errore senza ripiego resta un errore', e7?.message === 'rete' && ripiegato === 1);
  let e8 = null; try { VC.risposta({ errore: 'addon mancante', ripiego: true }); } catch (e) { e8 = e; }
  prova('voce: la risposta del main { errore, ripiego } diventa un errore', e8?.ripiego === true && e8.message === 'addon mancante' && VC.risposta('testo') === 'testo');
  VC.testiVoce('onnx', 640); const onnx = [VC.NOME_VOCE, VC.PESO_VOCE, VC.descrizioneVoce()].join('|');
  VC.testiVoce('mac'); const mac = [VC.NOME_VOCE, VC.PESO_VOCE, VC.descrizioneVoce()].join('|');
  VC.testiVoce('whisper'); const wh = [VC.NOME_VOCE, VC.PESO_VOCE, VC.descrizioneVoce()].join('|');
  prova('voce: testi per motore (nome, MB, descrizione)', onnx === 'Parakeet|640|Parakeet v3 sul processore' && mac === 'Parakeet|470|Parakeet v3 sul Neural Engine del Mac' && /^Whisper\|(200|600)\|Whisper (base|small)$/.test(wh), [onnx, mac, wh].join(' / '));
  // il main: voce:prepara e voce:trascrivi passano da suOnnx (ripiego), riposo e uscita chiudono tutti e due i motori
  const main = leggi('desktop/main.mjs');
  prova('voce: main.mjs instrada ONNX con il ripiego e lo chiude a riposo e all\'uscita', /voce:prepara[^\n]*suOnnx\(\(\) => voceOnnx\.avvia\(\)\)/.test(main) && /voce:trascrivi[^\n]*suOnnx\(\(\) => voceOnnx\.trascrivi\(audio\)\)/.test(main) && /voce:riposa[^\n]*if \(!voceOnnx\.occupato\(\)\) voceOnnx\.chiudi\(\)/.test(main) && /will-quit[^\n]*voceOnnx\.chiudi\(\)/.test(main) && /processoElectron\(utilityProcess\)/.test(main));
}

/* ---------- sincronizzazione: dalla barra agli eventi (desktop/sync/differenze.mjs) e il testo unico (js/sync-testi.js) ---------- */
{
  const { differenze, normalizza } = await import('../desktop/sync/differenze.mjs'), TS = await import('../js/sync-testi.js');
  const vuoto = { ...D.VUOTO(), imp: { ...D.VUOTO().imp, chiave: '' } };
  const V = { v: 1, profilo: { nome: 'Anna' }, esami: [{ id: 'e1', nome: 'Analisi 1', cfu: 9, voto: 27 }], carte: [{ id: 'c1', fronte: 'F', retro: 'R', ease: 2.5, int: 0, rip: 0, scad: '2026-10-03' }],
    orario: [{ id: 'oabc', corso: 'Analisi 2', giorni: [1], inizio: '09:00', fine: '11:00', aula: '7' }], sessioni: [], lezioni: [], memoria: {}, codice: { memoria: {}, errori: { k: 2 }, eventi: [], diari: {}, opzioni: {} }, imp: {} };
  const B = normalizza(V, vuoto), dopo = f => { const x = structuredClone(B); f(x); return differenze(B, x, { meta: { 'esami/e1/voto': 'h1' } }); };
  prova('sync: i valori di partenza della barra non sono differenze (#9)', differenze(B, normalizza(structuredClone(V), vuoto)).length === 0);
  const v = dopo(x => { x.esami[0].voto = 30; });
  prova('sync: un voto cambiato è un campo con il prev della finestra (⊕10)', v.length === 1 && v[0].tipo === 'campo' && v[0].percorso === 'esami/e1/voto' && v[0].valore === 30 && v[0].prev === 'h1', JSON.stringify(v));
  const o = dopo(x => { x.orario = [{ id: 'casuale1', corso: 'Analisi 2', giorni: [1], inizio: '09:00', fine: '11:00', aula: '7' }, { id: 'casuale2', corso: 'Fisica', giorni: [2], inizio: '14:00', fine: '16:00', aula: '' }]; });
  prova('sync: l\'orario si confronta per lezione, con l\'id o<k> (§9)', o.length === 1 && o[0].tipo === 'crea' && /^o[0-9a-f]{12}$/.test(o[0].id) && o[0].campi.corso === 'Fisica', JSON.stringify(o));
  const c = dopo(x => { x.codice.errori.k = 5; x.codice.errori.z = 1; });
  prova('sync: i contatori mandano la differenza', c.length === 2 && c.every(e => e.tipo === 'conta') && c.find(e => e.percorso === 'codice/errori/k').delta === 3, JSON.stringify(c));
  const x1 = structuredClone(B); x1.carte[0] = { ...x1.carte[0], ease: 2.6, int: 2, rip: 1, scad: '2026-10-05' };
  const r = differenze(B, x1, { esplicite: [{ tipo: 'ripasso', carta: 'c1', q: 4, giorno: '2026-10-03', ris: { ease: 2.6, int: 2, rip: 1, scad: '2026-10-05' } }] });
  prova('sync: il ripasso parte con risposta e giorno, una volta sola (§6.6)', r.length === 1 && r[0].tipo === 'ripasso' && r[0].q === 4 && r[0].giorno === '2026-10-03', JSON.stringify(r));
  const k = dopo(x => { x.esami = []; x.imp.chiave = 'sk-segreta'; x.imp.ultimoSuggerimento = 5; });
  prova('sync: un esame tolto è un cancella; chiave e suggerimento restano sul computer', k.length === 1 && k[0].tipo === 'cancella' && k[0].id === 'e1', JSON.stringify(k));
  const ev = dopo(x => { x.codice.eventi = [{ t: 1, tipo: 'errore' }, { t: 2, tipo: 'prova' }]; });
  prova('sync: i diari dei progetti mandano solo le voci nuove', ev.length === 1 && ev[0].tipo === 'eventi' && ev[0].voci.length === 2, JSON.stringify(ev));
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  prova('sync: il README dice cosa resta in chiaro con le stesse parole di js/sync-testi.js (#4 #23)', TS.IN_CHIARO.every(t => readme.includes(t)) && readme.includes('Se dimentichi la password non si perde niente'), TS.IN_CHIARO.filter(t => !readme.includes(t)).join(' | '));
  prova('sync: la riga di stato dice la verità', TS.rigaStato({ acceso: false }).startsWith('Spenta') && TS.rigaStato({ acceso: true, cloud: true, stato: 'password' }) === 'In pausa: scrivi la password per sincronizzare.' && /Sincronizzato con iCloud Drive · cifrato/.test(TS.rigaStato({ acceso: true, cloud: true, stato: 'in_pari', servizio: 'iCloud Drive', cifrato: true })));
}
// la barra con la sincronizzazione: una vista nuova che arriva non butta le modifiche non ancora mandate (§7, giro 1). Il gioco
// delle definizioni e «Cosa stampa?» salvano solo alla fine: prima ogni vista arrivata nel frattempo le cancellava
{
  const mandati = [], asc = {}, base = { v: 1, profilo: { nome: 'Ada' }, esami: [], carte: [], orario: [], sessioni: [], memoria: {}, codice: { errori: {} }, imp: {} };
  globalThis.window = { lodeDesktop: { leggiDati: () => ({ ...structuredClone(base), __ver: 7 }), salvaDati: (d, x) => mandati.push({ d: structuredClone(d), x }), su: (c, f) => { asc[c] = f; } } };
  const M = await import('../js/dati.js?sync-vista');
  M.D.memoria.k1 = { giuste: 3 };   // ricorda() senza salva()
  asc['dati:cambiati']({ ...structuredClone(base), profilo: { nome: 'Ada, da un altro computer' }, __ver: 8 });
  const prima = mandati.length === 1 && mandati[0].x?.ver === 7 && mandati[0].d.memoria?.k1?.giuste === 3;
  asc['dati:cambiati']({ ...structuredClone(base), profilo: { nome: 'di nuovo' }, __ver: 9 });   // niente di nuovo qui: niente salva
  prova('sync: una vista che arriva manda prima le modifiche non salvate, con la versione che la finestra aveva', prima && mandati.length === 1 && M.D.profilo.nome === 'di nuovo', JSON.stringify(mandati.map(m => [m.x?.ver, m.d.memoria])));
  delete globalThis.window;
}
// sincronizzazione, giro 2 delle correzioni. «Annulla» fa l'operazione inversa e tocca solo quello che il comando ha cambiato
{
  const p = { esami: [{ id: 'e1', nome: 'Analisi', voto: null }], carte: [], profilo: { nome: 'Ada' } };
  const q = { esami: [{ id: 'e1', nome: 'Analisi', voto: 30 }], carte: [], profilo: { nome: 'Ada' } };
  const cur = { esami: [{ id: 'e1', nome: 'Analisi', voto: 30 }], carte: [{ id: 'cQ', fronte: 'fatta su un altro computer' }], profilo: { nome: 'Ada L.' } };
  D.inverti(p, q, cur);
  prova('sync: «Annulla» del voto rimette solo il voto; la carta e il nome arrivati dopo restano', cur.esami[0].voto === null && cur.carte.length === 1 && cur.profilo.nome === 'Ada L.', JSON.stringify(cur));
  const c2 = { esami: [{ id: 'e9', nome: 'Nuovo' }, { id: 'e8', nome: 'arrivato da un altro computer' }] };
  D.inverti({ esami: [] }, { esami: [{ id: 'e9', nome: 'Nuovo' }] }, c2);
  prova('sync: «Annulla» di un esame aggiunto toglie solo quello', c2.esami.length === 1 && c2.esami[0].id === 'e8', JSON.stringify(c2));
}
// due finestre e una versione potata: il main non confronta mai con un'altra BASE (le modifiche arrivate dopo non tornano indietro)
{
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const T = mkdtempSync(join(tmpdir(), 'lode-unita-sync-'));
  const env = { LODE_CLOUD: process.env.LODE_CLOUD, LODE_PROVA: process.env.LODE_PROVA, LODE_MACCHINA: process.env.LODE_MACCHINA };
  Object.assign(process.env, { LODE_CLOUD: join(T, 'cloud'), LODE_PROVA: '1', LODE_MACCHINA: 'm-unita' });
  try {
    const { creaSincronizzazione } = await import('../desktop/sincronizza.mjs');
    const vault = join(T, 'cloud', 'Lode'); mkdirSync(join(vault, '.lode'), { recursive: true });
    writeFileSync(join(vault, '.lode', 'dati.json'), JSON.stringify({ v: 1, profilo: { nome: 'Ada' }, esami: [{ id: 'e1', nome: 'Analisi', cfu: 9, voto: null }, { id: 'e2', nome: 'Fisica', cfu: 6, voto: null }], carte: [], orario: [], sessioni: [], imp: {}, benvenuto: true }));
    const ud = join(T, 'ud'); mkdirSync(ud);
    const conf = { vault }, viste = new Map(), h = {};
    const finestra = id => ({ webContents: { id, send: (c, v) => { if (c === 'dati:cambiati') viste.set(id, v); } } });
    const S = creaSincronizzazione({ app: { getPath: () => ud, isPackaged: false }, safeStorage: null, dialog: null, powerMonitor: null, conf: () => conf, salvaConf: () => { }, vault: () => conf.vault, impostaVault: async x => { conf.vault = x; }, manda: () => { }, tutte: () => [finestra(1), finestra(2)] });
    S.registra({ handle: (c, f) => { h[c] = f; } });
    const acc = await h['sync:attiva']({}, { i: 0 });
    const senza = v => { const d = structuredClone(v); delete d.__ver; return d; };
    const vA = S.leggi(1, {}); let vB = S.leggi(2, {});
    // B salva 7 volte (ogni salvataggio manda una vista nuova anche ad A): la versione di A, bloccata in un confirm(), si pota
    for (let n = 0; n < 7; n++) {
      const d = senza(vB);
      if (n === 0) d.esami.find(e => e.id === 'e1').voto = 28; else d.esami.push({ id: `n${n}`, nome: `Nuovo ${n}`, cfu: 6, voto: null });
      await S.salva(2, d, { ver: vB.__ver, ops: [] }); vB = viste.get(2) || vB;
    }
    const dA = senza(vA); dA.profilo.nome = 'Ada Lovelace';
    await S.salva(1, dA, { ver: vA.__ver, ops: [] });
    const fine = S.leggi(2, {}), st = S.stato();
    prova('sync: una finestra che salva con una versione potata non riporta indietro voti ed esami arrivati dopo', acc.esito === 'ok' && fine.esami.find(e => e.id === 'e1')?.voto === 28 && fine.esami.some(e => e.id === 'n6') && !!st.recupero, JSON.stringify({ acc: acc.esito, esami: fine.esami.map(e => [e.id, e.voto]), recupero: st.recupero }));
    await S.chiudi();
  } finally {
    for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    try { rmSync(T, { recursive: true, force: true }); } catch { }
  }
}

// il programma d'esame (js/programma.js): leggere il programma, abbinare le domande uscite, la mappa e il piano
{
  D.sostituisci(D.esempio());
  const P = await import('../js/programma.js');
  prova('programma: comando', c('programma di analisi 2')?.tipo === 'programma' && c('programma di analisi 2').esame?.nome === 'Analisi 2' && c('programma')?.esame === null);
  prova('programma: a voce', c('Programma di analisi due.')?.esame?.nome === 'Analisi 2');
  prova('programma: incollato su più righe', c('programma analisi 2:\n1. Limiti\n2. Derivate')?.testo === '1. Limiti\n2. Derivate');
  prova('programma incollato con «CFU» non è il libretto', c('programma di analisi 2:\nANALISI 2 (9 CFU)\n1. Limiti')?.tipo === 'programma');
  prova('programma di oggi resta il piano', c('programma di oggi')?.tipo === 'oggi');
  prova('domande uscite', c("domande uscite di analisi 2: teorema di Green?")?.tipo === 'domande' && c("domande d'esame analisi 2\nGreen?").testo === 'Green?');
  const SCH = `ANALISI MATEMATICA 2 (9 CFU)
Obiettivi
Fornire gli strumenti del calcolo differenziale in più variabili.
Programma
1. Successioni e serie di funzioni: convergenza puntuale e uniforme; serie di potenze; serie di Taylor.
2. Funzioni di più variabili: limiti, continuità, derivate parziali, gradiente, differenziabilità, teorema di Schwarz.
3. Massimi e minimi: punti stazionari, matrice hessiana, punti di sella, moltiplicatori di Lagrange.
4. Integrali doppi e tripli: domini normali, cambiamento di variabili, coordinate polari.
5. Curve e integrali di linea; forme differenziali esatte e chiuse; teorema di Green.
6. Equazioni differenziali ordinarie (10 ore): problema di Cauchy, equazioni lineari del secondo ordine.
Testi consigliati
Bramanti, Pagani, Salsa - Analisi matematica 2`;
  const arg = P.leggiProgramma(SCH);
  prova('programma: argomenti numerati', arg.length === 6 && arg[0].t === 'Successioni e serie di funzioni' && arg[2].sotto.includes('matrice hessiana'), JSON.stringify(arg.map(a => a.t)));
  prova('programma: «;» senza due punti', arg[4].t === 'Curve e integrali di linea' && arg[4].sotto.includes('teorema di Green'));
  prova('programma: niente ore né testi', arg[5].t === 'Equazioni differenziali ordinarie' && !arg.some(a => /Bramanti|Obiettivi|Fornire/.test(a.t)));
  const par = P.leggiProgramma('Il corso tratta: fonti del diritto; la Costituzione italiana; il Parlamento e il procedimento legislativo; il Governo; la Corte costituzionale.');
  prova('programma: un paragrafo', par.length === 5 && par[0].t === 'Fonti del diritto', JSON.stringify(par.map(a => a.t)));
  const dom = P.leggiDomande('1. Enunciare e dimostrare il teorema di Green\n2) Come si classificano i punti stazionari con la matrice hessiana?\n- enunciare e dimostrare il teorema di Green\nok\nParlami della Juventus');
  prova('domande: numeri tolti, doppioni contati', dom.length === 3 && dom[0].n === 2 && !dom.some(d => d.t === 'ok'), JSON.stringify(dom));
  const e = D.trovaEsame('analisi 2');
  P.impostaProgramma(e, arg, { fonte: 'prova' });
  const r = P.aggiungiDomande(e, dom.map(d => d.t), { conta: dom.map(d => d.n) });
  const green = e.programma.argomenti[4], massimi = e.programma.argomenti[2];
  prova('domande: abbinate all\'argomento', r.messe === 2 && r.senza === 1 && green.domande[0].n === 2 && massimi.domande.length === 1 && e.programma.senza[0].t === 'Parlami della Juventus');
  const cop = P.copertura(e), per = id => cop.find(x => x.a.id === id);
  prova('mappa: appunti e carte dall\'esempio', per(green.id).stato === 1 && per(green.id).stelle === 1 && per(e.programma.argomenti[0].id).stato === 0, JSON.stringify(cop.map(x => [x.a.t, x.stato])));
  const pi = P.piano(e, cop), tutti = pi.giorni.flatMap(g => [...g.studia, ...g.ripassa]);
  prova('piano: fino al giorno prima dell\'appello', pi.giorni.length === D.giorniTra(D.oggi(), e.data) && pi.giorni.at(-1).tipo === 'generale' && pi.giorni.some(g => g.tipo === 'cuscinetto'));
  prova('piano: ogni argomento non sicuro c\'è', cop.filter(x => x.stato < 3).every(x => tutti.includes(x.a.id)));
  prova('piano: prima il più urgente', pi.giorni[0].studia.includes(green.id) || pi.giorni[0].studia.includes(massimi.id), JSON.stringify(pi.giorni[0]));
  const k = pi.giorni.findIndex(g => g.studia.includes(green.id)), j = pi.giorni.findIndex((g, i) => i > k && g.ripassa.includes(green.id));
  prova('piano: il ripasso dopo qualche giorno', k >= 0 && j - k >= 2, `${k} ${j}`);
  prova('piano: niente giorni vuoti di studio', pi.giorni.filter(g => g.tipo === 'studio').every(g => g.studia.length + g.ripassa.length > 0));
  P.registraEsito(e, green.id, 'giusta');
  prova('esito: giusta → sicuro', P.copertura(e).find(x => x.a.id === green.id).stato === 3);
  P.registraEsito(e, green.id, 'sbagliata');
  prova('esito: sbagliata → da rivedere', P.copertura(e).find(x => x.a.id === green.id).debole === true);
  const prima = green.id; P.impostaProgramma(e, [{ t: 'Curve e integrali di linea', sotto: [] }, { t: 'Analisi complessa', sotto: [] }]);
  prova('programma nuovo: tiene domande ed esiti', e.programma.argomenti[0].id === prima && e.programma.argomenti[0].esiti.length === 2 && e.programma.argomenti[0].domande.length === 1);
  prova('programma nuovo: le domande degli argomenti tolti non si perdono', e.programma.argomenti.flatMap(a => a.domande).length + e.programma.senza.length >= 3);
  prova('abbina: argomento dall\'orale', P.abbina('Green: enunciato e dimostrazione', P.leggiProgramma(SCH))?.t === 'Curve e integrali di linea' && P.abbina('la Juventus', P.leggiProgramma(SCH)) === null);
  prova('materiale dell\'argomento', /Domande uscite/.test(P.materialeArgomento(e, e.programma.argomenti[0])) && /Teorema di Green/.test(P.materialeArgomento(e, e.programma.argomenti[0])));
  prova('spiego: comando', c('te lo spiego io: green')?.tipo === 'spiego' && c('te lo spiego io: green').q === 'green' && c('Spiego le serie di potenze.')?.q === 'le serie di potenze' && c('spiegami green')?.tipo !== 'spiego');
  {
    const e2 = D.trovaEsame('analisi 2'); P.impostaProgramma(e2, P.leggiProgramma(SCH));
    const mm = e2.programma.argomenti.find(a => a.t === 'Massimi e minimi');
    const punti = P.puntiDi(e2, mm).map(p => p.t);
    prova('spiego: punti dal programma e dagli appunti', punti.includes('matrice hessiana') && punti.includes('Punto di sella'), JSON.stringify(punti));
    const buona = P.controllaSpiegazione(e2, mm, 'Si cercano i punti stazionari, dove il gradiente si annulla; poi la matrice hessiana: se è indefinita è un punto di sella. Con i vincoli si usano i moltiplicatori di Lagrange. Il punto stazionario è dove il gradiente è zero.');
    const scarsa = P.controllaSpiegazione(e2, mm, 'Boh, si deriva e si vede cosa succede alla funzione in quel punto.');
    prova('spiego: buona spiegazione → giusta', buona.esito === 'giusta', JSON.stringify(buona.punti.map(p => [p.t, p.detto])));
    prova('spiego: spiegazione vaga → sbagliata', scarsa.esito === 'sbagliata', JSON.stringify(scarsa));
    prova('spiego: tre parole → non so', P.controllaSpiegazione(e2, mm, 'non lo so').esito === 'non so');
  }
  const vicino = { ...e, data: D.piuGiorni(D.oggi(), 1) }, pv = P.piano(vicino, P.copertura(vicino));
  prova('piano: esame domani → solo ripasso generale', pv.giorni.length === 1 && pv.giorni[0].ripassa.length > 0 && !pv.giorni[0].studia.length);
  const bk = JSON.parse(JSON.stringify(D.esporta()));
  prova('backup col programma valido', D.backupValido(bk));
  D.sostituisci(D.esempio());
}

// il quiz a crocette (js/crocette.js)
{
  D.sostituisci(D.esempio());
  const Q = await import('../js/crocette.js'), P = await import('../js/programma.js');
  prova('crocette: comandi', c('quiz di analisi 2')?.tipo === 'crocette' && c('quiz di analisi 2').esame?.nome === 'Analisi 2' && c("simulazione d'esame di analisi 2")?.simulazione === true && c('crocette')?.tipo === 'crocette' && c('interrogami su analisi 2')?.tipo === 'orale');
  let seme = 7; const caso = () => (seme = (seme * 16807) % 2147483647) / 2147483647;
  const e = D.trovaEsame('analisi 2'), mat = P.materialeDi(e);
  const qs = Q.daMateriale(mat, { n: 10, caso });
  prova('crocette senza AI: dalle carte e dalle definizioni', qs.length === 10 && qs.every(q => q.opzioni.length === 4 && new Set(q.opzioni).size === 4 && q.giusta >= 0 && q.giusta < 4), JSON.stringify(qs[0]));
  prova('crocette: la giusta è davvero la risposta della carta', qs.filter(q => q.fonte === 'carta').every(q => mat.carte.some(cc => cc.fronte === q.domanda && cc.retro.startsWith(q.opzioni[q.giusta].replace(/…$/, '')))));
  prova('crocette: la giusta non è sempre la prima', new Set(qs.map(q => q.giusta)).size >= 2);
  prova('crocette: poco materiale, niente quiz', Q.daMateriale({ carte: mat.carte.slice(0, 3), definizioni: [] }).length === 0);
  const M = 'Il teorema di Green lega l\'integrale di linea lungo il bordo di un dominio all\'integrale doppio sul dominio stesso. La matrice hessiana è la matrice delle derivate seconde parziali.';
  const grezze = [
    { domanda: 'Cosa lega il teorema di Green?', opzioni: ['Integrale di linea sul bordo e integrale doppio sul dominio', 'Due integrali tripli', 'Derivate prime e seconde', 'Serie e successioni'], giusta: 0, citazione: 'lega l\'integrale di linea lungo il bordo di un dominio all\'integrale doppio', spiegazione: 'È l\'enunciato.' },
    { domanda: 'Cos\'è la hessiana?', opzioni: ['A', 'B', 'C', 'Tutte le precedenti'], giusta: 1, citazione: 'la matrice delle derivate seconde parziali', spiegazione: '' },
    { domanda: 'Inventata', opzioni: ['a', 'b', 'c', 'd'], giusta: 2, citazione: 'una frase che nel materiale non compare proprio per niente', spiegazione: '' },
    { domanda: 'Doppie', opzioni: ['x', 'x', 'y', 'z'], giusta: 0, citazione: 'La matrice hessiana è la matrice delle derivate seconde parziali', spiegazione: '' },
  ];
  const v = Q.valida(grezze, M, caso);
  prova('crocette con AI: solo quelle dimostrate dal materiale', v.domande.length === 1 && v.scartate === 3 && v.domande[0].opzioni[v.domande[0].giusta].startsWith('Integrale di linea'), JSON.stringify(v));
  prova('crocette: citazione nel materiale', Q.citazioneNelMateriale('LEGA L\'integrale di linea, lungo il bordo', M) && !Q.citazioneNelMateriale('integrale', M));
  prova('crocette: voto in trentesimi', Q.voto(27, 30).voto === 27 && Q.voto(15, 30).superato === false && Q.voto(18, 30).superato === true);
  const lungo = Array.from({ length: 60 }, (_, i) => `Riga ${i} del materiale con un po' di testo per arrivare alla lunghezza giusta.`).join('\n');
  const pz = Q.pezzi(lungo, 3);
  prova('crocette: il materiale in pezzi', pz.length === 3 && pz.every(p => p.length > 300) && pz[2].includes('Riga 59'));
  D.sostituisci(D.esempio());
}

// «Lezione dal computer»: i comandi
{
  const v = c('trascrivi la videolezione di diritto privato');
  prova('computer: videolezione', v?.tipo === 'trascrivi' && v.sorgente === 'computer' && v.corso === 'diritto privato', JSON.stringify(v));
  prova('computer: altre frasi', c('lezione dal computer')?.sorgente === 'computer' && c('Trascrivi l\'audio del computer.')?.sorgente === 'computer' && c('ascolta il pc')?.sorgente === 'computer' && c('trascrivi la lezione online di analisi 2')?.corso === 'analisi 2');
  prova('computer: la lezione in aula resta dal microfono', c('trascrivi la lezione')?.tipo === 'trascrivi' && !c('trascrivi la lezione').sorgente);
}
console.log(`${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
