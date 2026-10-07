// Prove del piano per chi lavora (js/ore.js), senza browser: node --experimental-vm-modules test/ore.mjs
// Le ore libere di un giorno, il turno in corso, il calendario di più esami a minuti (identico a piano() quando non serve),
// quello che non ci sta con le sue opzioni, i comandi, il backup e l'allenatore che tace al lavoro. Stesso avvio di
// test/tasca.mjs: localStorage e addEventListener finti; dati fatti qui (esami, programmi, niente lezioni), T e adesso fissi.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
globalThis.window = {};   // allenatore.js importa voce.js, che guarda window.SpeechRecognition
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.removeEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const Lt = await import('../js/lingua.js'), Dm = await import('../js/dati.js'), C = await import('../js/comandi.js'), PG = await import('../js/programma.js'), O = await import('../js/ore.js');

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
if (vm.SourceTextModule) for (const f of ['ore.js', 'programma.js']) { let e = null; try { new vm.SourceTextModule(readFileSync(new URL('../js/' + f, import.meta.url), 'utf8')); } catch (x) { e = x; } prova(`${f}: modulo valido`, !e, e?.message); }
const D = () => Dm.D, T = Dm.oggi(), piu = n => Dm.piuGiorni(T, n), ADESSO = new Date(T + 'T08:00').getTime();
// il prossimo giorno della settimana dow (oggi compreso)
const prossimo = dow => piu((dow - new Date(T + 'T12:00').getDay() + 7) % 7);
const LUN = prossimo(1), MAR = prossimo(2);
// un mondo pulito: niente lezioni, niente carte, niente lavoro
function pulito() { Dm.sostituisci({ ...Dm.VUOTO(), benvenuto: true }); D().orario = []; delete D().imp.lavoro; delete D().imp.studio; delete D().imp.oreScelte; }
// un esame con un programma di n argomenti, negli stati detti: 0 mai toccato, 1 sbagliato, 2 in allenamento, 3 sicuro
const NOMI = ['Fiumi europei', 'Catene montuose', 'Climi temperati', 'Deserti caldi', 'Vulcani attivi', 'Ghiacciai alpini', 'Coste rocciose', 'Laghi glaciali', 'Isole vulcaniche', 'Foreste pluviali', 'Pianure alluvionali', 'Delta fluviali', 'Barriere coralline', 'Steppe asiatiche', 'Tundra artica', 'Fiordi norvegesi'];
function esameCon(nome, giorni, stati, cfu = 6) {
  const e = Dm.aggiungiEsame({ nome, cfu, data: piu(giorni) });
  PG.impostaProgramma(e, stati.map((_, i) => ({ t: `${NOMI[i % NOMI.length]} ${nome.split(' ')[0]} ${i + 1}`, sotto: [] })));
  e.programma.argomenti.forEach((a, i) => { const s = stati[i]; if (s) PG.registraEsito(e, a.id, s === 3 ? 'giusta' : s === 2 ? 'parziale' : 'sbagliata'); });
  return e;
}
const somma = g => g.voci.reduce((s, v) => s + v.min, 0);

/* ---------- (1) liberi ---------- */
pulito();
prova('liberi: finestra 9-20 senza niente → 360 (il tetto)', O.liberi(MAR, { adesso: ADESSO }).min === 360, O.liberi(MAR, { adesso: ADESSO }).min);
prova('liberi: oggi conta da adesso (15:07 → dalle 15:15 alle 20)', O.liberi(T, { adesso: new Date(T + 'T15:07').getTime() }).min === 285, O.liberi(T, { adesso: new Date(T + 'T15:07').getTime() }).min);
D().orario = [{ id: 'l1', corso: 'Analisi 2', giorni: [2], inizio: '09:00', fine: '11:00', aula: '' }];
prova('liberi: con una lezione 9-11 → 360 (la finestra ne lascia 540)', O.liberi(MAR, { adesso: ADESSO }).min === 360 && O.liberi(MAR, { adesso: ADESSO }).lezioni.length === 1);
D().imp.studio = { da: '09:00', a: '14:00' };
prova('liberi: finestra 9-14 meno la lezione → 180', O.liberi(MAR, { adesso: ADESSO }).min === 180, O.liberi(MAR, { adesso: ADESSO }).min);
pulito();
D().imp.lavoro = { turni: [{ giorni: [1, 3, 5], inizio: '14:00', fine: '19:00' }], eccezioni: [], tetto: 120 };
const lun = O.liberi(LUN, { adesso: ADESSO });
prova('liberi: lunedì con lavoro 14-19 → il tetto, 120', lun.min === 120 && lun.tetto === 120 && lun.lavoro.length === 1, JSON.stringify(lun));
D().imp.lavoro.tetto = 400;
prova('liberi: tetto alto → 9-13:30 più 19:30-20 = 300 (mezz\'ora di viaggio prima e dopo)', O.liberi(LUN, { adesso: ADESSO }).min === 300, O.liberi(LUN, { adesso: ADESSO }).min);
D().imp.studio = { da: '09:00', a: '19:30' };
prova('liberi: finestra fino alle 19:30 → 9-13:30 = 270', O.liberi(LUN, { adesso: ADESSO }).min === 270, O.liberi(LUN, { adesso: ADESSO }).min);
D().imp.studio = { da: '09:10', a: '13:00' };
prova('liberi: giù a 15 minuti (9:10-13 = 230 → 225)', O.liberi(MAR, { adesso: ADESSO }).min === 225, O.liberi(MAR, { adesso: ADESSO }).min);
delete D().imp.studio;
prova('liberi: martedì senza lavoro → 360', O.liberi(MAR, { adesso: ADESSO }).min === 360 && !O.liberi(MAR, { adesso: ADESSO }).lavoro.length);
prova('liberi: un altro giorno non guarda l\'ora di adesso', O.liberi(piu(7), { adesso: new Date(T + 'T19:00').getTime() }).min === O.liberi(piu(7), { adesso: ADESSO }).min);
D().imp.lavoro.eccezioni = [{ data: LUN, no: true }];
prova('liberi: eccezione «non lavoro» → il giorno torna libero', O.liberi(LUN, { adesso: ADESSO }).min === 360 && !O.liberi(LUN, { adesso: ADESSO }).lavoro.length);
D().imp.lavoro.tetto = 120; D().imp.lavoro.eccezioni = [{ data: MAR, inizio: '18:00', fine: '23:00' }];
prova('liberi: eccezione con orario → un turno solo quel giorno', O.liberi(MAR, { adesso: ADESSO }).lavoro.length === 1 && O.liberi(MAR, { adesso: ADESSO }).min === 120 && !O.liberi(Dm.piuGiorni(MAR, 7), { adesso: ADESSO }).lavoro.length, JSON.stringify(O.liberi(MAR, { adesso: ADESSO })));
D().imp.silenzio = { da: '12:00', a: '08:00' }; D().imp.lavoro.eccezioni = [];
prova('liberi: le ore di silenzio non contano (silenzio dalle 12 → 9-12 = 180)', O.liberi(MAR, { adesso: ADESSO }).min === 180, O.liberi(MAR, { adesso: ADESSO }).min);
delete D().imp.silenzio;

/* ---------- (2) alLavoro ---------- */
const alle = (data, hhmm) => new Date(`${data}T${hhmm}`);
prova('alLavoro: dentro il turno', !!O.alLavoro(alle(LUN, '16:00')));
prova('alLavoro: 20 minuti prima → sì (il viaggio)', !!O.alLavoro(alle(LUN, '13:40')) && !!O.alLavoro(alle(LUN, '19:20')));
prova('alLavoro: 40 minuti prima → no', !O.alLavoro(alle(LUN, '13:20')) && !O.alLavoro(alle(LUN, '19:40')) && !O.alLavoro(alle(MAR, '16:00')));

/* ---------- (3) identità: un esame, niente lavoro → il piano di sempre ---------- */
for (const [g, stati] of [[5, [0, 1, 2, 3, 0]], [12, [0, 0, 1, 2, 3, 0, 1, 2]], [30, [0, 0, 0, 1, 1, 2, 2, 3, 0, 0, 1, 2]]]) {
  pulito(); const e = esameCon('Geografia fisica', g, stati);
  const p = PG.piano(e), cal = O.calendario({ T, adesso: ADESSO });
  const uguali = p.giorni.every((x, k) => { const y = cal.giorni[k], v = y.voci.filter(w => w.esameId === e.id);
    return y.data === x.data && y.tipo[e.id] === x.tipo && JSON.stringify(v.filter(w => w.tipo === 'studia').map(w => w.id)) === JSON.stringify(x.studia)
      && JSON.stringify(v.filter(w => w.tipo === 'ripassa' || w.tipo === 'generale').map(w => w.id)) === JSON.stringify(x.ripassa); });
  prova(`identità: esame fra ${g} giorni, piano uguale a piano()`, !cal.attivo && uguali && !Object.keys(cal.mancano).length && !cal.opzioni.length);
  prova(`identità: esame fra ${g} giorni, le stime (60 studio, 25 ripasso)`, cal.giorni.every(x => x.voci.every(v => v.min === ({ studia: 60, ripassa: 25, generale: 25 })[v.tipo])) && cal.giorni.every(x => x.min === somma(x)));
  prova(`identità: esame fra ${g} giorni, g.giro solo coi ripassi`, p.giorni.every(x => (x.giro || []).every(id => x.ripassa.includes(id))));
}

/* ---------- (4) due esami vicini e il lavoro ---------- */
pulito();
const A = esameCon('Analisi tre', 10, [0, 0, 0, 0, 1, 1, 2, 2]), B = esameCon('Biologia uno', 16, [0, 0, 0, 0, 0, 1, 2, 2, 0]);
D().imp.lavoro = { turni: [{ giorni: [1, 3, 5], inizio: '14:00', fine: '19:00' }], eccezioni: [], tetto: 120 };
let cal = O.calendario({ T, adesso: ADESSO });
prova('due esami: attivo', cal.attivo);
prova('due esami: nessun giorno con più minuti di quelli liberi', cal.giorni.every(g => g.min <= g.liberi), JSON.stringify(cal.giorni.map(g => [g.min, g.liberi])));
prova('due esami: nei giorni di lavoro al massimo 2 ore', cal.giorni.every(g => !g.lavoro.length || g.liberi <= 120));
// l'esame più vicino non perde voci nei giorni in cui le sue ci stanno
const pA = PG.piano(A);
const tieneA = pA.giorni.every((x, k) => { const g = cal.giorni[k], suoi = x.studia.length * 60 + x.ripassa.filter(id => !(x.giro || []).includes(id)).length * 25;
  if (x.tipo !== 'studio' || suoi > g.liberi) return true;
  const qui = g.voci.filter(v => v.esameId === A.id).map(v => v.tipo + v.id);
  // (un ripasso il cui studio è slittato slitta con lui: quello non conta)
  const fermo = id => { const k0 = pA.giorni.findIndex(y => y.studia.includes(id)); return k0 < 0 || cal.giorni[k0].voci.some(v => v.esameId === A.id && v.id === id && v.tipo === 'studia'); };
  return [...x.studia.map(id => 'studia' + id), ...x.ripassa.filter(id => !(x.giro || []).includes(id) && fermo(id)).map(id => 'ripassa' + id)].every(s => qui.includes(s)); });
prova('due esami: il più vicino non perde voci quando c\'è posto', tieneA);
// uno studio spostato si porta dietro i ripassi: ogni ripasso (non di riempimento) dopo il suo studio
const dopoStudio = [A, B].every(e => e.programma.argomenti.every(a => {
  const k = cal.giorni.findIndex(g => g.voci.some(v => v.esameId === e.id && v.id === a.id && v.tipo === 'studia')); if (k < 0) return true;
  return cal.giorni.every((g, j) => j > k || !g.voci.some(v => v.esameId === e.id && v.id === a.id && v.tipo === 'ripassa' && !v.giro)); }));
prova('due esami: i ripassi restano dopo lo studio (anche spostato)', dopoStudio);
const spostati = [A, B].flatMap(e => { const p = PG.piano(e); return e.programma.argomenti.filter(a => { const k0 = p.giorni.findIndex(g => g.studia.includes(a.id)), k1 = cal.giorni.findIndex(g => g.voci.some(v => v.esameId === e.id && v.id === a.id && v.tipo === 'studia')); return k0 >= 0 && k1 > k0; }); });
prova('due esami: qualche argomento è davvero slittato', spostati.length > 0, spostati.length);
// riempitivi: un esame con pochi argomenti già in allenamento e tanti giorni → piano() riempie a rotazione; con poco tempo si buttano
pulito();
const R = esameCon('Storia antica', 20, [2, 2, 2]);
D().imp.lavoro = { turni: [{ giorni: [0, 1, 2, 3, 4, 5, 6], inizio: '09:30', fine: '19:00' }], eccezioni: [], tetto: 120 };
D().imp.studio = { da: '09:00', a: '20:00' };   // 9-9:00 e 19:30-20: 30 minuti al giorno
const pR = PG.piano(R), giri = pR.giorni.reduce((s, g) => s + (g.giro || []).length, 0);
cal = O.calendario({ T, adesso: ADESSO });
const tenuti = cal.giorni.reduce((s, g) => s + g.voci.filter(v => v.giro).length, 0);
prova('riempitivi: piano() ne mette', giri > 0, giri);
prova('riempitivi: con 30 minuti al giorno ci stanno (1 da 25)', cal.giorni.every(g => g.min <= g.liberi) && tenuti > 0, tenuti);
D().imp.studio = { da: '09:00', a: '19:50' };   // 20 minuti: nessun ripasso ci sta
cal = O.calendario({ T, adesso: ADESSO });
prova('riempitivi: buttati senza finire in mancano', cal.giorni.every(g => !g.voci.some(v => v.giro)) && (cal.mancano[R.id] || 0) === pR.giorni.reduce((s, g) => s + (g.tipo === 'generale' ? g.ripassa.length * 25 : g.tipo === 'studio' ? g.studia.length * 60 + g.ripassa.filter(id => !(g.giro || []).includes(id)).length * 25 : 0), 0), JSON.stringify(cal.mancano));

/* ---------- (5) settimana piena: mancano e opzioni ---------- */
pulito();
const P1 = esameCon('Chimica generale', 12, Array(12).fill(0)), P2 = esameCon('Diritto privato', 13, Array(12).fill(0));
D().imp.lavoro = { turni: [{ giorni: [1, 2, 3, 4, 5], inizio: '12:00', fine: '19:00' }], eccezioni: [], tetto: 120 };
cal = O.calendario({ T, adesso: ADESSO, scelte: [] });
const tot = c => Object.values(c.mancano).reduce((s, x) => s + x, 0);
prova('piena: mancano > 0', tot(cal) > 0, JSON.stringify(cal.mancano));
prova('piena: ogni giorno ≤ liberi', cal.giorni.every(g => g.min <= g.liberi));
prova('piena: ci sono opzioni', cal.opzioni.length >= 2, JSON.stringify(cal.opzioni));
for (const o of cal.opzioni) {
  const c2 = O.calendario({ T, adesso: ADESSO, scelte: [o.k] });
  prova(`piena: «${o.k}» risparmia davvero ${o.risparmio} minuti`, o.risparmio > 0 && o.risparmio === tot(cal) - tot(c2), `${o.risparmio} vs ${tot(cal) - tot(c2)}`);
}
prova('piena: niente opzione «sposta all\'appello dopo»', cal.opzioni.every(o => ['cuscinetto', 'unRipasso', 'tetto'].includes(o.k)));
D().imp.oreScelte = cal.opzioni.map(o => o.k);
const c3 = O.calendario({ T, adesso: ADESSO });
prova('piena: con le scelte in D.imp.oreScelte mancano scende', tot(c3) < tot(cal) && c3.opzioni.every(o => !D().imp.oreScelte.includes(o.k)), `${tot(c3)} < ${tot(cal)}`);
D().imp.lavoro.tetto = 180; delete D().imp.oreScelte;
prova('piena: niente opzione «tetto» se studi già 3 ore', O.calendario({ T, adesso: ADESSO }).opzioni.every(o => o.k !== 'tetto'));
D().imp.lavoro.tetto = 120;

/* ---------- testi: sempre «circa», sempre multipli di 15 minuti ---------- */
const nomi = id => Dm.esame(id);
const tutti = [...cal.giorni.slice(0, 7).flatMap(g => [O.rigaGiorno(g), ...O.vociGiorno(g, nomi)]), O.testoOggi(cal, nomi), ...O.riquadro(cal, nomi).righe, ...O.riquadro(cal, nomi).opzioni.map(o => o.testo), O.dopoScelta(cal)];
const testi = tutti.join('\n').replace(/Nei giorni di lavoro studio 3 ore, non 2/g, ''), tempi = testi.match(/\d+\s*(?:h|min|ore|ora)\b(?:\s*\d+)?/g) || [];
prova('testi: ogni tempo ha «circa»', tutti.every(t => !/\d+\s*(?:h|min|ore)\b/.test(t) || /circa \d/.test(t)) && !/(?<!circa )\b\d+ (?:h|min|ore)\b/.test(testi.replace(/circa \d+ h \d+/g, '').replace(/circa \d+ (?:h|min|ore|ora)/g, '')), tutti.join('\n'));
prova('testi: multipli di 15', tempi.every(x => { const h = x.match(/(\d+)\s*(?:h|ore|ora)(?:\s*(\d+))?/), m = x.match(/(\d+)\s*min/); const v = h ? +h[1] * 60 + +(h[2] || 0) : +m[1]; return v % 15 === 0; }), tempi.join(' '));
prova('testi: circa', O.circa(25) === 'circa 30 min' && O.circa(105) === 'circa 1 h 45' && O.circa(60) === 'circa 1 h' && O.circa(840, { ore: true }) === 'circa 14 ore' && O.circa(5) === 'circa 15 min');
const rl = O.rigaGiorno({ data: LUN, liberi: 105, lavoro: [{ inizio: '14:00', fine: '19:00' }], voci: [] });
prova('testi: la riga del giorno', /^Lun \d+ · circa 1 h 45 libere · lavoro 14–19$/.test(rl), rl);
prova('testi: il riquadro mai senza opzioni o ripiego', O.riquadro(cal, nomi).opzioni.length > 0 || !!O.riquadro(cal, nomi).ripiego);
prova('testi: il riquadro dice l\'esame', O.riquadro(cal, nomi).righe.some(r => /^Fino all'appello di (Chimica generale|Diritto privato) ti mancano circa \d+ (ore|h)/.test(r)), O.riquadro(cal, nomi).righe.join(' | '));
prova('testi: niente riquadro se ci sta tutto', O.riquadro({ mancano: {}, opzioni: [] }, nomi) === null);
prova('testi: ripiego senza opzioni', /decidi tu/.test(O.riquadro({ mancano: { x: 300 }, opzioni: [] }, nomi).ripiego));
prova('testi: oggi', /^Oggi hai circa .* libere/.test(O.testoOggi({ giorni: [{ data: T, liberi: 120, lavoro: [{ inizio: '14:00', fine: '19:00' }], voci: [{ esameId: P1.id, tipo: 'studia', id: 'x', min: 60 }, { esameId: P2.id, tipo: 'ripassa', id: 'y', min: 25 }] }] }, nomi))
  && O.testoOggi({ giorni: [{ data: T, liberi: 120, lavoro: [{ inizio: '14:00', fine: '19:00' }], voci: [{ esameId: P1.id, tipo: 'studia', id: 'x', min: 60 }, { esameId: P2.id, tipo: 'ripassa', id: 'y', min: 25 }] }] }, nomi) === 'Oggi hai circa 2 h libere (lavoro 14–19): circa 1 h per Chimica generale, circa 30 min per Diritto privato.');

/* ---------- (5b) slittamenti: i ripassi trovano posto, i cuscinetti sono di un esame solo ---------- */
// niente lavoro ma due esami: il calendario è attivo e non deve dire «non ci sta» con giorni vuoti nel piano
pulito();
const An = esameCon('Analisi due', 10, Array(14).fill(0)), Fi = esameCon('Fisica uno', 16, Array(12).fill(0));
cal = O.calendario({ T, adesso: ADESSO, scelte: [] });
prova('slittamenti: senza lavoro e con posto, niente mancano', cal.attivo && !Object.keys(cal.mancano).length && !O.riquadro(cal, nomi0 => Dm.esame(nomi0)), JSON.stringify(cal.mancano));
prova('slittamenti: nessun giorno oltre i suoi minuti', cal.giorni.every(g => g.min <= g.liberi));
const nelCusc = c => c.giorni.flatMap((g, k) => g.voci.filter(v => g.tipo[v.esameId] === 'cuscinetto').map(v => `${g.data} ${v.tipo} ${v.esameId}`));
prova('cuscinetto: con le scelte vuote nessuna voce sta nel cuscinetto del suo esame', !nelCusc(cal).length, nelCusc(cal).join(', '));
D().imp.lavoro = { turni: [{ giorni: [1, 3, 5], inizio: '14:00', fine: '19:00' }], eccezioni: [], tetto: 120 };
cal = O.calendario({ T, adesso: ADESSO, scelte: [] });
prova('cuscinetto: con il lavoro, ancora nessuna voce nel cuscinetto del suo esame', !nelCusc(cal).length && cal.giorni.every(g => g.min <= g.liberi), nelCusc(cal).join(', '));
// il cuscinetto di Analisi è un giorno di studio per Fisica: ci si può spostare una voce di Fisica (che piano() non ci metteva)
const kc = cal.giorni.findIndex(g => g.tipo[An.id] === 'cuscinetto'), pFi = PG.piano(Fi);
const diFi = cal.giorni[kc]?.voci.filter(v => v.esameId === Fi.id).map(v => v.tipo + v.id) || [], primaFi = [...(pFi.giorni[kc]?.studia || []).map(id => 'studia' + id), ...(pFi.giorni[kc]?.ripassa || []).map(id => 'ripassa' + id)];
prova('cuscinetto: una voce di Fisica si sposta nel cuscinetto di Analisi', kc >= 0 && diFi.some(x => !primaFi.includes(x)), `${kc} ${diFi} | ${primaFi}`);
const cc = O.calendario({ T, adesso: ADESSO, scelte: ['cuscinetto'] });
prova('cuscinetto: con la scelta accesa il cuscinetto si può usare', nelCusc(cc).length > 0 || !Object.keys(cal.mancano).length, nelCusc(cc).join(', '));

/* ---------- applica: turni, eccezioni passate, tetto, finestra ---------- */
pulito();
O.applica({ azione: 'aggiungi', giorni: [5, 1, 3], inizio: '14:00', fine: '19:00' });
O.applica({ azione: 'aggiungi', giorni: [1, 3, 5], inizio: '14:00', fine: '19:00' });
prova('applica: aggiungi (senza doppioni)', D().imp.lavoro.turni.length === 1 && JSON.stringify(D().imp.lavoro.turni[0].giorni) === '[1,3,5]' && D().imp.lavoro.tetto === 120);
prova('applica: il testo dei turni', O.turniTesto() === 'lun, mer, ven 14–19', O.turniTesto());
D().imp.lavoro.eccezioni.push({ data: piu(-3), no: true });
O.applica({ azione: 'eccezione', data: piu(1), no: true });
prova('applica: eccezione, e quelle passate si tolgono', D().imp.lavoro.eccezioni.length === 1 && D().imp.lavoro.eccezioni[0].data === piu(1));
O.applica({ azione: 'tetto', min: 90 }); O.applica({ azione: 'finestra', da: '10:00', a: '22:00' });
prova('applica: tetto e finestra', D().imp.lavoro.tetto === 90 && D().imp.studio.da === '10:00' && D().imp.studio.a === '22:00');
O.applica({ azione: 'sostituisci', giorni: [6], inizio: '18:00', fine: '23:00' });
prova('applica: sostituisci', D().imp.lavoro.turni.length === 1 && D().imp.lavoro.turni[0].giorni[0] === 6);
O.applica(C.leggiLavoro('lavoro lunedì 9-13 e mercoledì 15-19'));
prova('applica: più turni in una frase, ognuno col suo orario', JSON.stringify(D().imp.lavoro.turni) === JSON.stringify([{ giorni: [6], inizio: '18:00', fine: '23:00' }, { giorni: [1], inizio: '09:00', fine: '13:00' }, { giorni: [3], inizio: '15:00', fine: '19:00' }]), JSON.stringify(D().imp.lavoro.turni));
O.applica({ azione: 'sostituisci', giorni: [6], inizio: '18:00', fine: '23:00' });
O.applica({ azione: 'togli' });
prova('applica: togli', !D().imp.lavoro);
O.scegli('cuscinetto'); O.scegli('tetto'); O.scegli('cuscinetto', false);
prova('scegli: accendi e spegni', JSON.stringify(D().imp.oreScelte) === '["tetto"]');

/* ---------- (6) comandi ---------- */
const c = f => C.interpreta(f);
const giorno = dow => prossimo(dow);
const casi = [
  ['lavoro lunedì mercoledì venerdì 14-19', x => x?.tipo === 'lavoro' && x.azione === 'aggiungi' && JSON.stringify(x.giorni) === '[1,3,5]' && x.inizio === '14:00' && x.fine === '19:00'],
  ['lavoro il sabato dalle 18 alle 23', x => x?.azione === 'aggiungi' && JSON.stringify(x.giorni) === '[6]' && x.inizio === '18:00' && x.fine === '23:00'],
  ['Lavoro al bar martedì e giovedì 15:30-20', x => x?.azione === 'aggiungi' && JSON.stringify(x.giorni) === '[2,4]' && x.inizio === '15:30' && x.fine === '20:00'],
  ['i miei turni sono lunedì e martedì 9-13', x => x?.azione === 'sostituisci' && JSON.stringify(x.giorni) === '[1,2]' && x.inizio === '09:00'],
  ['non lavoro più', x => x?.tipo === 'lavoro' && x.azione === 'togli'],
  ['niente lavoro', x => x?.azione === 'togli'],
  ['giovedì non lavoro', x => x?.azione === 'eccezione' && x.no === true && x.data === giorno(4)],
  ['oggi non lavoro', x => x?.azione === 'eccezione' && x.no && x.data === T],
  ['domani non lavoro', x => x?.azione === 'eccezione' && x.no && x.data === piu(1)],
  ['sabato lavoro anche 18-23', x => x?.azione === 'eccezione' && !x.no && x.data === giorno(6) && x.inizio === '18:00' && x.fine === '23:00'],
  ['questa settimana lavoro anche sabato 18-23', x => x?.azione === 'eccezione' && x.data === giorno(6) && x.inizio === '18:00'],
  ['nei giorni di lavoro studio al massimo 2 ore', x => x?.azione === 'tetto' && x.min === 120],
  ['quando lavoro studio un\'ora e mezza', x => x?.azione === 'tetto' && x.min === 90],
  ['studio dalle 10 alle 22', x => x?.tipo === 'lavoro' && x.azione === 'finestra' && x.da === '10:00' && x.a === '22:00'],
  ['quando lavoro', x => x?.tipo === 'lavoro' && x.azione === 'vedi'],
  ['i miei turni', x => x?.azione === 'vedi'],
  ['turni', x => x?.azione === 'vedi'],
  ['piano della settimana', x => x?.tipo === 'ore'],
  ['il mio piano', x => x?.tipo === 'ore'],
  ['la mia settimana', x => x?.tipo === 'ore'],
  ['piano', x => x?.tipo === 'oggi'],
  ['ho lavorato fino alle 19', x => x?.tipo !== 'lavoro'],
  ['studio 50 analisi 2', x => x?.tipo === 'focus'],
  ['studio', x => x?.tipo === 'focus'],
  ['lavoro di squadra', x => x?.tipo !== 'lavoro'],
  // più orari: un turno ciascuno, mai un orario inventato per un giorno
  ['lavoro lunedì 9-13 e mercoledì 15-19', x => x?.azione === 'aggiungi' && JSON.stringify(x.turni) === JSON.stringify([{ giorni: [1], inizio: '09:00', fine: '13:00' }, { giorni: [3], inizio: '15:00', fine: '19:00' }])],
  ['i miei turni sono lunedì dalle 9 alle 13 e sabato dalle 18 alle 23', x => x?.azione === 'sostituisci' && x.turni?.length === 2 && x.turni[1].giorni[0] === 6 && x.turni[1].inizio === '18:00'],
  ['lavoro alla tesi lunedì 9-13', x => x?.tipo !== 'lavoro'],
  ['lavoro agli esercizi martedì 15-17', x => x?.tipo !== 'lavoro'],
  ['lavoro ai compiti giovedì 9-11', x => x?.tipo !== 'lavoro'],
  ['lavoro in laboratorio lunedì 9-13', x => x?.tipo !== 'lavoro'],
  ['lavoro alla relazione venerdì 10-12', x => x?.tipo !== 'lavoro'],
];
for (const [f, ok1] of casi) prova(`comando: «${f}»`, ok1(c(f)), JSON.stringify(c(f)));
prova('comandi: leggiLavoro da solo', C.leggiLavoro('lavoro lunedì 14-19')?.azione === 'aggiungi' && C.leggiLavoro('ciao') === null);
Dm.sostituisci(Dm.esempio());
const or = c('lezione analisi 2 lunedì 9-11');
prova('comandi: la lezione resta orario, come prima', or?.tipo === 'orario' && JSON.stringify(or) === JSON.stringify({ tipo: 'orario', corso: 'Analisi 2', giorni: [1], inizio: '09:00', fine: '11:00', aula: '' }), JSON.stringify(or));
prova('comandi: giorniEOre', JSON.stringify(C.giorniEOre('lunedì e mercoledì dalle 9 alle 11')) === JSON.stringify({ giorni: [1, 3], inizio: '09:00', fine: '11:00', resto: '   e   ' }) || (C.giorniEOre('lunedì e mercoledì dalle 9 alle 11')?.inizio === '09:00' && JSON.stringify(C.giorniEOre('lunedì e mercoledì dalle 9 alle 11').giorni) === '[1,3]'));

/* ---------- (7) backup ---------- */
const bk = imp => ({ v: 1, esami: [], imp });
prova('backup: senza lavoro (vecchio) valido', Dm.backupValido(bk({ focus: 25 })) && Dm.backupValido({ v: 1, esami: [] }));
prova('backup: lavoro giusto valido', Dm.backupValido(bk({ lavoro: { turni: [{ giorni: [1, 3], inizio: '14:00', fine: '19:00' }], eccezioni: [{ data: '2026-10-09', no: true }, { data: '2026-10-11', inizio: '18:00', fine: '23:00' }], tetto: 120 }, studio: { da: '09:00', a: '20:00' }, oreScelte: ['tetto'] })));
prova('backup: giorno 9 → rifiutato', !Dm.backupValido(bk({ lavoro: { turni: [{ giorni: [9], inizio: '14:00', fine: '19:00' }] } })));
prova('backup: ore storte → rifiutato', !Dm.backupValido(bk({ lavoro: { turni: [{ giorni: [1], inizio: '14', fine: '19:00' }] } })) && !Dm.backupValido(bk({ lavoro: { turni: [{ giorni: [1], inizio: '25:00', fine: '19:00' }] } })) && !Dm.backupValido(bk({ lavoro: { turni: [{ giorni: [1], inizio: '<b>', fine: '19:00' }] } })));
prova('backup: eccezione con data storta → rifiutato', !Dm.backupValido(bk({ lavoro: { turni: [], eccezioni: [{ data: '9/10', no: true }] } })));
prova('backup: lavoro non oggetto → rifiutato', !Dm.backupValido(bk({ lavoro: 'sempre' })) && !Dm.backupValido(bk({ lavoro: { turni: 'tanti' } })));
prova('backup: studio storto → rifiutato', !Dm.backupValido(bk({ studio: { da: 'mattina', a: '20:00' } })));

/* ---------- l'allenatore tace al lavoro ---------- */
{
  const AL = await import('../js/allenatore.js');
  pulito(); D().imp.silenzio = { da: '00:00', a: '00:00' };
  D().imp.lavoro = { turni: [{ giorni: [0, 1, 2, 3, 4, 5, 6], inizio: '00:00', fine: '23:59' }], eccezioni: [], tetto: 120 };
  prova('allenatore: al lavoro → { no: \'lavoro\' }', (await AL.momento()).no === 'lavoro' && !!O.alLavoro());
  delete D().imp.lavoro;
  prova('allenatore: senza lavoro non dice «lavoro»', (await AL.momento()).no !== 'lavoro' && !O.alLavoro());
}

/* ---------- la barra (js/lode.js, dal sorgente), sw.js, prove.yml ---------- */
{
  const src = readFileSync(new URL('../js/lode.js', import.meta.url), 'utf8');
  prova('barra: case lavoro e ore subito dopo vediOrario', /case 'vediOrario': return schedaOrario\(\);\n\s*case 'lavoro': return comandoLavoro\(c\);\n\s*case 'ore': return schedaOre\(\);/.test(src));
  prova('barra: «piano» apre la settimana solo se il calendario è attivo', src.includes("case 'oggi': return ORE.calendario().attivo ? schedaOre() : schedaEsami();"));
  prova('barra: proposte mai al lavoro', src.includes("'Mai a lezione, al lavoro, in focus o nelle ore di silenzio.'"));
  prova('barra: «La tua settimana»', /scheda\('ld-ore'/.test(src) && src.includes("t('barra1.la-tua-settimana')") && Lt.t('barra1.la-tua-settimana') === 'La tua settimana');
  const dp = src.slice(src.indexOf('function disegnaProgramma'), src.indexOf('function aggiungiDomandeUscite'));
  prova('barra: il programma cambia solo col calendario attivo', /if \(cal\?\.attivo\) p = /.test(dp) && /oreH = cal\?\.attivo \?/.test(dp) && /if \(cal\?\.attivo\) legaOre/.test(dp));
  // il riquadro, preso dal sorgente e fatto girare con i conti veri: mai il numero da solo
  const f = src.slice(src.indexOf('function riquadroOre'), src.indexOf('// i bottoni del riquadro'));
  const riquadroOre = (...a) => new Function('ORE', 'D', 'esame', 'esc', 't', `${f}; return riquadroOre;`)(O, D(), Dm.esame, Dm.esc, Lt.t)(...a);   // D di adesso; t: i testi della barra (js/lingua.js)
  pulito();
  esameCon('Chimica generale', 12, Array(12).fill(0)); esameCon('Diritto privato', 13, Array(12).fill(0));
  D().imp.lavoro = { turni: [{ giorni: [1, 2, 3, 4, 5], inizio: '12:00', fine: '19:00' }], eccezioni: [], tetto: 120 };
  const h = riquadroOre(O.calendario({ T, adesso: ADESSO }));
  prova('barra: il riquadro ha le frasi e i bottoni con il risparmio', /ti mancano circa/.test(h) && /data-scelta="[a-zA-Z]+">[^<]+ · recuperi circa /.test(h), h);
  D().imp.oreScelte = ['cuscinetto', 'unRipasso', 'tetto'];
  const h2 = riquadroOre(O.calendario({ T, adesso: ADESSO }), null, 'Ti mancano ancora circa 11 ore.');
  prova('barra: senza opzioni la frase di ripiego, e le scelte con ✕', (!/ti mancano/.test(h2) || /decidi tu/.test(h2)) && (h2.match(/class="ld-ore-chip"/g) || []).length === 3 && h2.includes('✕') && h2.includes('Ti mancano ancora'), h2);
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), yml = readFileSync(new URL('../.github/workflows/prove.yml', import.meta.url), 'utf8');
  prova('sw.js: js/ore.js e cache nuova (lode-v11 o dopo)', sw.includes("'js/ore.js'") && +(sw.match(/CACHE = 'lode-v(\d+)'/) || [])[1] >= 11);
  prova('prove.yml: la prova nuova dopo unita.mjs', /test\/unita\.mjs\n(?:\s+#.*\n)?\s+- name: [^\n]+\n\s+run: node --experimental-vm-modules test\/ore\.mjs/.test(yml));
}

console.log(`\n${ok} passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
