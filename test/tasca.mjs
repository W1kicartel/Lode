// Prove del «Ripasso in tasca» (js/tasca.js), senza browser: node --experimental-vm-modules test/tasca.mjs
// Le funzioni pure (scegli, scriviNota, leggiNota, impronta), il giro con un vault finto (leggi/scrivi in memoria: niente
// file, niente rete) e i comandi. Stesso avvio di test/unita.mjs: localStorage e addEventListener finti, dati di esempio.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.removeEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const Dm = await import('../js/dati.js'), C = await import('../js/comandi.js'), T = await import('../js/tasca.js');
Dm.sostituisci(Dm.esempio());

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
if (vm.SourceTextModule) { let e = null; try { new vm.SourceTextModule(readFileSync(new URL('../js/tasca.js', import.meta.url), 'utf8')); } catch (x) { e = x; } prova('modulo valido', !e, e?.message); }
const D = () => Dm.D, OGGI = Dm.oggi(), piu = n => Dm.piuGiorni(OGGI, n);

/* ---------- scegli ---------- */
const AN = { id: 'an2', nome: 'Analisi 2' }, BD = { id: 'bd', nome: 'Basi di dati' }, ESAMI = [AN, BD];
const carta = (id, scad, esameId = 'an2', extra = {}) => ({ id, esameId, fronte: 'Domanda ' + id, retro: 'Risposta ' + id, ease: 2.5, int: 0, rip: 0, scad, creata: 0, ...extra });
const tante = Array.from({ length: 25 }, (_, i) => carta('c' + i, piu(-(i % 9)), i % 2 ? 'an2' : 'bd'));
const scelte = T.scegli([...tante, carta('dopo1', piu(2)), carta('dopo2', piu(5)), carta('dom', piu(1))], OGGI, ESAMI);
prova('scegli: al massimo 20', scelte.length === 20, scelte.length);
prova('scegli: niente carte di dopodomani', !scelte.some(c => c.scad > piu(1)));
prova('scegli: prima le più in ritardo', scelte.every((c, i) => !i || scelte[i - 1].scad <= c.scad), scelte.map(c => c.scad).join(' '));
prova('scegli: a parità di ritardo, per corso', scelte.every((c, i) => !i || scelte[i - 1].scad !== c.scad || (scelte[i - 1].esameId === 'an2' || c.esameId === 'bd')));
prova('scegli: domani entra se c\'è posto', T.scegli([carta('dom', piu(1)), carta('dopo', piu(2))], OGGI, ESAMI).map(c => c.id).join() === 'dom');

/* ---------- scriviNota: il formato esatto ---------- */
const atteso = `# Ripasso in tasca
Carte per mercoledì 8 ottobre. Apri la risposta con un tocco, poi spunta una casella sola. Quando la nota torna sul computer, Lode segna il ripasso.

## 1 · Analisi 2
**Cos'è il gradiente?**

> [!risposta]- Risposta
> Il vettore delle derivate parziali.

- [ ] sapevo
- [ ] non sapevo
<!-- lode-carta:ID -->

<!-- lode-tasca giro:GIRO -->
`;
const una = [{ id: 'ID', esameId: 'an2', fronte: 'Cos\'è il gradiente?', retro: 'Il vettore delle derivate parziali.', scad: '2025-10-07' }];
prova('scriviNota: formato esatto', T.scriviNota(una, ESAMI, 'GIRO', '2025-10-07') === atteso, '\n' + T.scriviNota(una, ESAMI, 'GIRO', '2025-10-07'));
const due = [{ id: 'a1', esameId: 'an2', fronte: 'Punto stazionario\nche cos\'è?', retro: 'Il gradiente si annulla: $\\nabla f(x_0) = 0$.\n\n$$H = \\begin{pmatrix} a & b \\end{pmatrix}$$' }, { id: 'b1', esameId: 'boh', fronte: 'Chiave primaria', retro: 'Identifica la tupla.' }];
const nota2 = T.scriviNota(due, ESAMI, 'g2', '2025-10-07');
prova('scriviNota: risposta su più righe con «> »', nota2.includes('> [!risposta]- Risposta\n> Il gradiente si annulla: $\\nabla f(x_0) = 0$.\n>\n> $$H = \\begin{pmatrix} a & b \\end{pmatrix}$$\n\n- [ ] sapevo'), nota2);
prova('scriviNota: fronte su una riga, formule intatte', nota2.includes('**Punto stazionario che cos\'è?**') && nota2.includes('$\\nabla f(x_0) = 0$'));
prova('scriviNota: due carte numerate, «Senza corso»', nota2.includes('## 1 · Analisi 2\n') && nota2.includes('\n## 2 · Senza corso\n') && nota2.includes('<!-- lode-carta:b1 -->\n\n<!-- lode-tasca giro:g2 -->\n'));
const vuota = T.scriviNota([], ESAMI, 'g0', '2025-10-07');
prova('scriviNota: senza carte', vuota.includes('Domani non hai carte da ripassare. Bravo, o hai poche carte: trascina le slide e scegli «Carte del ripasso».') && vuota.includes('<!-- lode-tasca giro:g0 -->'));
prova('scriviNota → leggiNota: niente spunte', JSON.stringify(T.leggiNota(nota2)) === JSON.stringify({ giro: 'g2', esiti: [] }));

/* ---------- leggiNota ---------- */
const spunta = (testo, id, quale, segno = 'x') => testo.replace(new RegExp(`- \\[ \\] ${quale}\\n((?:- \\[.\\] .*\\n)*)<!-- lode-carta:${id} -->`), (m, resto) => `- [${segno}] ${quale}\n${resto}<!-- lode-carta:${id} -->`);
const tre = [carta('k1', OGGI), carta('k2', OGGI), carta('k3', OGGI), carta('k4', OGGI)];
let t3 = T.scriviNota(tre, ESAMI, 'gg', OGGI);
t3 = spunta(t3, 'k1', 'sapevo'); t3 = spunta(t3, 'k2', 'non sapevo', 'X'); t3 = spunta(spunta(t3, 'k3', 'sapevo'), 'k3', 'non sapevo');
const l3 = T.leggiNota(t3);
prova('leggiNota: il giro', l3.giro === 'gg');
prova('leggiNota: [x] su sapevo → sapevo', l3.esiti.some(e => e.id === 'k1' && e.sapevo === true), JSON.stringify(l3));
prova('leggiNota: [X] su non sapevo → non sapevo', l3.esiti.some(e => e.id === 'k2' && e.sapevo === false));
prova('leggiNota: due spunte → ignorata', !l3.esiti.some(e => e.id === 'k3'));
prova('leggiNota: nessuna spunta → ignorata', !l3.esiti.some(e => e.id === 'k4') && l3.esiti.length === 2);
prova('leggiNota: id che non esiste più → ignorato', T.leggiNota(t3, [tre[1]]).esiti.map(e => e.id).join() === 'k2');
prova('leggiNota: le caselle dentro la risposta non contano', T.leggiNota('## 1 · X\n> - [x] sapevo\n- [ ] sapevo\n- [ ] non sapevo\n<!-- lode-carta:z1 -->\n<!-- lode-tasca giro:q -->').esiti.length === 0);
prova('leggiNota: la stessa carta due volte conta una volta', T.leggiNota('- [x] sapevo\n<!-- lode-carta:z1 -->\n- [x] non sapevo\n<!-- lode-carta:z1 -->').esiti.length === 1);
prova('leggiNota: con \\r\\n', T.leggiNota(t3.replace(/\n/g, '\r\n')).esiti.length === 2);

/* ---------- impronta ---------- */
prova('impronta: stabile tra \\r\\n e \\n', T.impronta('a\r\nb\r\n') === T.impronta('a\nb\n') && T.impronta('a\nb') === T.impronta('a\nb\n'));
prova('impronta: cambia con una spunta', T.impronta(t3) !== T.impronta(t3.replace('[x]', '[ ]')) && /^[0-9a-f]{8}$/.test(T.impronta(t3)));
prova('impronta: deterministica', T.impronta('Lode') === T.impronta('Lode') && T.impronta('') === '811c9dc5');

/* ---------- il giro, con un vault finto ---------- */
// prima: un hook chiamato a ogni lettura (per cambiare la nota fra la lettura e la rilettura)
const finto = (testo = null) => ({ testo, scritture: 0, letture: 0, prima: null, async leggi() { this.letture++; this.prima?.(this); return this.testo; }, async scrivi(t) { this.scritture++; this.testo = t; } });
D().carte = [carta('p1', OGGI), carta('p2', OGGI), carta('p3', OGGI), carta('p4', piu(-2)), carta('p5', piu(9))];
delete D().tasca;
prova('stato: D.tasca nasce vuoto', JSON.stringify(T.stato()) === JSON.stringify({ giro: null, impronta: null, scritta: null, sera: false, fatte: [] }));
const v = finto();
let r = await T.aggiorna({ vault: v });
prova('giro: nota che manca, senza forza → niente', r.saltata === 'manca' && v.scritture === 0);
r = await T.aggiorna({ forza: true, vault: v });
prova('giro: con forza scrive la nota', v.scritture === 1 && r.scritte === 4 && r.saltata === null, JSON.stringify(r));
prova('giro: D.tasca aggiornato', T.stato().giro === T.leggiNota(v.testo).giro && T.stato().impronta === T.impronta(v.testo) && T.stato().scritta === OGGI);
r = await T.aggiorna({ vault: v });
prova('giro: nota uguale, senza forza → si ferma', r.saltata === 'uguale' && v.scritture === 1);
const copia = id => { const c = D().carte.find(x => x.id === id); return { ...c }; };
const attesi = { p1: copia('p1'), p2: copia('p2'), p3: copia('p3') }; Dm.rispondi(attesi.p1, 4); Dm.rispondi(attesi.p2, 0); Dm.rispondi(attesi.p3, 4);
const prima = JSON.stringify(D().carte), vecchio = v.testo;
// (d) una copia vecchia: un giro che non è l'ultimo scritto
const altroGiro = spunta(vecchio, 'p1', 'sapevo').replace(/giro:\S+ -->/, 'giro:vecchio -->');
const vv = finto(altroGiro);
r = await T.aggiorna({ forza: true, vault: vv });
prova('giro vecchio: nessuna carta cambia', r.saltata === 'vecchia' && JSON.stringify(D().carte) === prima && r.segnate === 0);
prova('giro vecchio: la nota non si riscrive', vv.scritture === 0 && vv.testo === altroGiro);
// (g) la nota cambia fra la lettura e la rilettura: si segna, ma non si scrive
let spuntata = spunta(spunta(spunta(vecchio, 'p1', 'sapevo'), 'p2', 'non sapevo'), 'p3', 'sapevo');
const vc = finto(spuntata); vc.prima = x => { if (x.letture === 2) x.testo = x.testo + '\nuna riga da Obsidian'; };
r = await T.aggiorna({ vault: vc });
prova('giro: rilettura cambiata → non scrive', r.saltata === 'cambiata' && vc.scritture === 0, JSON.stringify(r));
prova('giro: le spunte segnate', r.segnate === 3 && r.sapevo === 2);
const uguale = id => { const c = D().carte.find(x => x.id === id), a = attesi[id]; return c.scad === a.scad && c.int === a.int && c.rip === a.rip && c.ease === a.ease; };
prova('giro: come rispondi(c,4) e rispondi(c,0)', uguale('p1') && uguale('p2') && uguale('p3'));
prova('giro: le altre carte no', JSON.stringify(D().carte.filter(c => !attesi[c.id])) === JSON.stringify(JSON.parse(prima).filter(c => !attesi[c.id])));
// (e) lo stesso testo una seconda volta (la riscrittura era saltata): nessuna carta segnata di nuovo, poi la nota nuova
const dopoUno = JSON.stringify(D().carte);
const vs = finto(spuntata);
r = await T.aggiorna({ vault: vs });
prova('giro: la stessa spunta non vale due volte', r.segnate === 0 && JSON.stringify(D().carte) === dopoUno, JSON.stringify(r));
prova('giro: nota riscritta con un giro nuovo', vs.scritture === 1 && T.leggiNota(vs.testo).giro !== T.leggiNota(spuntata).giro && T.stato().fatte.length === 0);
prova('giro: le carte sapute escono dalla nota', !vs.testo.includes('lode-carta:p1 ') && !vs.testo.includes('lode-carta:p1 -->') && vs.testo.includes('lode-carta:p2 -->'));
// la vecchia nota spuntata che torna dopo (sync in ritardo): giro vecchio, niente
r = await T.aggiorna({ vault: finto(spuntata) });
prova('giro: la copia spuntata che torna tardi non segna niente', r.saltata === 'vecchia' && JSON.stringify(D().carte) === dopoUno);
// spunta nuova nel giro nuovo, una carta sola
const vn = finto(spunta(vs.testo, 'p4', 'sapevo'));
r = await T.aggiorna({ vault: vn });
prova('giro: una spunta nuova nel giro giusto', r.segnate === 1 && r.sapevo === 1 && vn.scritture === 1 && D().carte.find(c => c.id === 'p4').scad > OGGI);
// riscrivi: lo studente lo chiede, la copia vecchia si sostituisce ma le sue spunte non si segnano
const dopoDue = JSON.stringify(D().carte), vr = finto(spunta(vs.testo, 'p2', 'sapevo'));
r = await T.aggiorna({ forza: true, riscrivi: true, vault: vr });
prova('giro: riscrivi una copia vecchia senza segnare', r.saltata === null && r.segnate === 0 && vr.scritture === 1 && JSON.stringify(D().carte) === dopoDue && T.stato().giro === T.leggiNota(vr.testo).giro);
// una nota «In tasca.md» dello studente (senza il segno di Lode) non si tocca
const ve = finto('# In tasca\n- [x] sapevo\n<!-- lode-carta:p3 -->\n');
r = await T.aggiorna({ forza: true, vault: ve });
prova('giro: nota senza il segno di Lode → non si tocca', r.saltata === 'estranea' && ve.scritture === 0);
// un errore di lettura non è «non c'è»: niente scrittura
r = await T.aggiorna({ forza: true, vault: { leggi: async () => { throw new Error('EBUSY: file bloccato'); }, scrivi: async () => { throw new Error('non doveva scrivere'); } } });
prova('giro: lettura in errore → non scrive', r.saltata === 'errore' && /EBUSY/.test(r.errore));
// due giri insieme (avvio e comando): uno alla volta, la spunta vale una volta
const giroOra = T.stato().giro, vp = finto(spunta(vr.testo, 'p2', 'sapevo'));
const [r1, r2] = await Promise.all([T.aggiorna({ vault: vp }), T.aggiorna({ vault: vp })]);
prova('giro: due giri insieme segnano una volta', r1.segnate + r2.segnate === 1 && T.stato().giro !== giroOra, JSON.stringify([r1, r2]));

/* ---------- la sera ---------- */
T.sera(true); T.stato().scritta = piu(-1);
const vsera = finto(vp.testo), alle = h => { const d = new Date(); d.setHours(h, 5, 0, 0); return d; };
r = await T.controlla({ adesso: alle(15), vault: vsera });
prova('sera: prima delle 19 non riscrive', r.saltata === 'uguale' && vsera.scritture === 0);
r = await T.controlla({ adesso: alle(20), vault: vsera });
prova('sera: dopo le 19, una volta al giorno', vsera.scritture === 1 && T.stato().scritta === OGGI);
r = await T.controlla({ adesso: alle(21), vault: vsera });
prova('sera: la seconda volta no', vsera.scritture === 1);
T.sera(false); prova('sera: si spegne', T.stato().sera === false);

/* ---------- comandi ---------- */
const c = f => C.interpreta(f);
prova('comando: ripasso in tasca', JSON.stringify(c('ripasso in tasca')) === '{"tipo":"tasca"}' && c('Ripasso in tasca.')?.tipo === 'tasca');
prova('comando: carte sul telefono, ripasso sul telefono', c('carte sul telefono')?.tipo === 'tasca' && c('ripasso sul telefono')?.tipo === 'tasca' && c('mettimi le carte sul telefono')?.tipo === 'tasca');
prova('comando: ogni sera', c('ripasso in tasca ogni sera')?.sera === true);
prova('comando: non mettere / spegni', c('non mettere il ripasso in tasca')?.sera === false && c('spegni il ripasso in tasca')?.sera === false && c('ripasso in tasca solo quando lo chiedo')?.sera === false);
prova('comando: «ripasso» resta il ripasso', c('ripasso')?.tipo === 'ripasso' && c('carte')?.tipo === 'ripasso');
prova('comando: «ripasso di analisi 2» resta il ripasso', c('ripasso di analisi 2')?.tipo === 'ripasso' && c('ripasso di analisi 2')?.esame?.nome === 'Analisi 2');
prova('comando: «esporta per anki» resta Anki', c('esporta per anki')?.tipo === 'anki');
prova('comando: tra gli esempi', C.ESEMPI.some(([f]) => f === 'ripasso in tasca'));

console.log(`\n${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
