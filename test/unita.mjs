// Prove veloci, senza browser: node test/unita.mjs
// Comandi in italiano (anche detti a voce), formule parlate → LaTeX, note di Obsidian, conti del libretto, giochi.
// prima di tutto: ogni file dell'interfaccia deve essere un modulo valido (doppioni, sintassi)
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const JS = new URL('../js/', import.meta.url);
const rotti = [];
if (vm.SourceTextModule) for (const f of readdirSync(JS).filter(f => f.endsWith('.js'))) { try { new vm.SourceTextModule(readFileSync(new URL(f, JS), 'utf8')); } catch (e) { rotti.push(`${f}: ${e.message}`); } }
else console.log('(controllo dei moduli saltato: lancia con node --experimental-vm-modules)');
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const D = await import('../js/dati.js'), C = await import('../js/comandi.js'), F = await import('../js/formule.js'), M = await import('../js/markdown.js'), G = await import('../js/giochi.js');
D.sostituisci(D.esempio());
let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
prova('moduli validi', !rotti.length, rotti.join('; '));
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
prova('gioca', c('gioca analisi 2')?.tipo === 'gioco');
prova('naviga', c('apri glossario')?.tipo === 'naviga');
prova('domanda libera all\'AI', c('spiegami il teorema di Stokes') === null);

// formule dette a voce
const f = F.parlatoInFormule;
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

// libretto e giochi
const m = D.media();
prova('media ponderata', Math.abs(m.ponderata - 27.3077) < .001, m.ponderata);
prova('base di laurea', Math.abs(m.base - 100.128) < .01);
prova('giochi', G.partita(D.daGiocare(6).scelte, D.daGiocare(6).tutte)[0]?.tipo === 'abbina');
prova('risposta tollerante', G.giusta('potenzial', 'potenziale') && !G.giusta('gradiente', 'hessiana'));

console.log(`${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
