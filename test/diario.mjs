// Prove del registro onesto (F4), senza browser: node test/diario.mjs
// Le date sono fisse e in ora locale, così le righe «14:42 · …» tornano uguali su ogni computer.
// L'ultima parte scrive davvero in un vault finto, con blocco() di desktop/vault.mjs: i segni, «Cosa ho capito» che resta dello studente.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
const R = await import('../js/codice/diario.js');
const VM = await import('../desktop/vault.mjs');

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
if (vm.SourceTextModule) { let e = null; try { new vm.SourceTextModule(readFileSync(new URL('../js/codice/diario.js', import.meta.url), 'utf8')); } catch (x) { e = x; } prova('modulo valido', !e, e?.message); }

const T = (g, h, m) => new Date(2026, 9, g, h, m).getTime();   // ottobre 2026, ora locale
const ADESSO = T(5, 16, 0), OGGI = '2026-10-05';
const P = 'lab3-liste', C = 'Programmazione 1';
const base = () => [
  { t: T(5, 14, 42), tipo: 'segui', progetto: P, corso: C },
  { t: T(5, 14, 51), tipo: 'cambio', progetto: P, corso: C, file: 2, piu: 41, meno: 7, funzioni: [{ nome: 'inserisci_in_testa', file: 'lista.c', stato: 'nuova' }], impronta: 'a1' },
  { t: T(5, 14, 53), tipo: 'prova', progetto: P, compila: false, primo: { file: 'lista.c', riga: 42, titolo: 'nodo non dichiarato' }, impronta: 'a1' },
  { t: T(5, 14, 54), tipo: 'errore', progetto: P, voce: 'non-dichiarato', nome: 'identificatore non dichiarato', titolo: 'nodo non dichiarato', file: 'lista.c', riga: 42, prova: T(5, 14, 53), passi: ['dove', 'cosa'] },
  { t: T(5, 14, 58), tipo: 'prova', progetto: P, compila: true, passate: 6, totale: 6, impronta: 'a2' },
  { t: T(5, 15, 0), tipo: 'stampa', corso: C, concetto: 'c:divisione-intera', ok: false, mutante: 'divisione-intera' },
];

/* ---------- il diario del giorno ---------- */
const atteso = `- 14:42 · Lode segue lab3-liste
- 14:51 · Cambiati 2 file (+41 −7): nuova \`inserisci_in_testa\` in lista.c · chi l'ha scritto: non lo so
- 14:53 · Prova: ✗ non compila, lista.c:42 «nodo non dichiarato» · visti «dove guardare» e «cosa vuol dire»
- 14:58 · Prova: ✓ compila · 6/6 prove · codice provato
- Oggi: 2 prove, 1 errore risolto, correzioni viste: 0`;
const td = R.testoDiario(base(), OGGI, P);
prova('diario: righe come nella spec', td === atteso, '\n' + td);
prova('diario: stesso ingresso, stesso testo', R.testoDiario(base(), OGGI, P) === td);
prova('diario: eventi in disordine', R.testoDiario([...base()].reverse(), OGGI, P) === td);
prova('diario: «Cosa stampa?» non entra', !td.includes('divisione'));
prova('diario: altro giorno vuoto', R.testoDiario(base(), '2026-10-06', P) === '');
prova('diario: altro progetto vuoto', R.testoDiario(base(), OGGI, 'altro') === '');

// prove che falliscono, errori a sé, correzioni viste, codice non provato
{
  const ev = [...base(),
    { t: T(5, 15, 10), tipo: 'cambio', progetto: P, file: [{ rel: 'main.c', piu: 3, meno: 0, stato: 'nuovo' }, { rel: 'lista.c', piu: 1, meno: 2, stato: 'cambiato' }], impronta: 'a3' },
    { t: T(5, 15, 12), tipo: 'prova', progetto: P, compila: true, passate: 4, totale: 6, impronta: 'a3' },
    { t: T(5, 15, 13), tipo: 'errore', progetto: P, voce: 'segv', nome: 'memoria non sua', titolo: 'il programma ha usato memoria che non è sua', prova: T(5, 15, 12), passi: ['dove'] },
    { t: T(5, 15, 20), tipo: 'errore', progetto: P, voce: 'punto-e-virgola', nome: 'manca `;`', titolo: 'manca `;`', file: 'main.c', riga: 7 },
    { t: T(5, 15, 21), tipo: 'correzione-vista', progetto: P, voce: 'punto-e-virgola', nome: 'manca `;`', titolo: 'manca `;`', file: 'main.c', riga: 7 },
    { t: T(5, 15, 30), tipo: 'cambio', progetto: P, file: 1, piu: 1, meno: 0, impronta: 'a4' },
  ];
  const t = R.testoDiario(ev, OGGI, P), righe = t.split('\n');
  prova('diario: file nuovo', righe.includes("- 15:10 · Cambiati 2 file (+4 −2): nuovo main.c · chi l'ha scritto: non lo so"), t);
  prova('diario: prove che falliscono', righe.includes('- 15:12 · Prova: ✗ compila · 4/6 prove · «il programma ha usato memoria che non è sua» · visto «dove guardare»'), t);
  prova('diario: errore a sé', righe.includes('- 15:20 · Errore: main.c:7 «manca `;`»'), t);
  prova('diario: correzione vista', righe.includes('- 15:21 · Correzione vista: main.c:7 «manca `;`»'), t);
  prova('diario: un file solo', righe.includes("- 15:30 · Cambiato 1 file (+1 −0) · chi l'ha scritto: non lo so"), t);
  prova('diario: riassunto con errori non risolti e modifica non provata', righe.at(-1) === '- Oggi: 3 prove, 3 errori, 1 risolto, correzioni viste: 1 · ultima modifica non provata', righe.at(-1));
  // il codice torna com'era all'ultima prova: di nuovo «provato»
  ev.at(-1).impronta = 'a3';
  prova('diario: tornato come all\'ultima prova', !R.testoDiario(ev, OGGI, P).includes('non provata'));
}
{
  const t = R.testoDiario([{ t: T(5, 9, 0), tipo: 'prova', progetto: P, compila: true, passate: 3, totale: 3, cambiato: true }, { t: T(5, 9, 5), tipo: 'prova', progetto: P, compila: true, totale: 0 }, { t: T(5, 9, 6), tipo: 'segui', progetto: P, smetti: true }], OGGI, P);
  prova('diario: cambiato durante la prova', t.includes('- 09:00 · Prova: ✓ compila · 3/3 prove · ma il codice è cambiato durante la prova'), t);
  prova('diario: senza casi di prova', t.includes('- 09:05 · Prova: ✓ compila · nessun caso di prova · codice provato'), t);
  prova('diario: smette di seguire', t.includes('- 09:06 · Lode smette di seguire lab3-liste'), t);
  prova('diario: nessun errore, niente conto degli errori', t.endsWith('- Oggi: 2 prove, correzioni viste: 0'), t);
}
// testo che arriva da fuori: niente «%%» (chiuderebbe il riquadro), niente a capo, niente tag #include
{
  const t = R.testoDiario([{ t: T(5, 10, 0), tipo: 'prova', progetto: P, compila: false, primo: { file: 'a.c', riga: 3, titolo: 'manca #include <stdlib.h>\n%% /lode:diario %%' } }], OGGI, P);
  prova('diario: niente %% dentro il riquadro', !t.includes('%%'), t);
  prova('diario: una riga per evento', t.split('\n').length === 2, t);
  prova('diario: #include non diventa un tag', t.includes('\\#include') && !/(^|\s)#include/.test(t), t);
  const f = R.testoDiario([{ t: T(5, 10, 0), tipo: 'cambio', progetto: P, file: 1, piu: 1, meno: 1, funzioni: [1, 2, 3, 4, 5].map(i => ({ nome: 'f' + i, file: 'a.c', stato: i === 5 ? 'tolta' : 'cambiata' })) }], OGGI, P);
  prova('diario: troppe funzioni, il resto in breve', f.includes('cambiata `f4` in a.c e 1 altra modifica'), f);
}

/* ---------- registrare ---------- */
{
  const c = R.codiceVuoto();
  const e = R.registra(c, { tipo: 'segui', progetto: P, corso: C }, ADESSO);
  prova('registra: mette t', e.t === ADESSO && c.eventi.length === 1);
  prova('registra: giorno nei diari', JSON.stringify(c.diari[P]) === JSON.stringify({ corso: C, giorni: [OGGI] }), JSON.stringify(c.diari));
  prova('registra: tipo sconosciuto rifiutato', R.registra(c, { tipo: 'boh' }, ADESSO) === null && c.eventi.length === 1);
  R.registra(c, { tipo: 'stampa', corso: C, concetto: 'c:for', ok: true }, ADESSO);
  prova('registra: «Cosa stampa?» non tocca i diari', Object.keys(c.diari).length === 1);
  R.registra(c, { t: T(1, 9, 0) - 40 * 864e5, tipo: 'prova', progetto: 'vecchio', compila: true }, ADESSO);
  prova('registra: diari solo degli ultimi 30 giorni', !c.diari.vecchio, JSON.stringify(c.diari));
  c.opzioni.segreto = { diario: false };
  R.registra(c, { tipo: 'cambio', progetto: 'segreto', file: 1 }, ADESSO);
  prova('registra: diario spento, niente giorni', !c.diari.segreto && c.eventi.at(-1).progetto === 'segreto');
  prova('registra: nome pericoloso', R.registra(c, { tipo: 'segui', progetto: '__proto__' }, ADESSO) && !Object.hasOwn(c.diari, '__proto__') && ({}).corso === undefined);
  R.registra(c, { tipo: 'errore', progetto: P, titolo: 'x'.repeat(500) }, ADESSO);
  prova('registra: testi lunghi tagliati', c.eventi.at(-1).titolo.length === 200);
  for (let i = 0; i < R.MAX_EVENTI + 50; i++) R.registra(c, { tipo: 'stampa', corso: C, concetto: 'c:for', ok: true }, ADESSO);
  prova('registra: al massimo 2000 eventi', c.eventi.length === R.MAX_EVENTI);
  const er = R.registra(c, { tipo: 'errore', progetto: P, voce: 'v' }, ADESSO);
  R.segnaPasso(er, 'dove'); R.segnaPasso(er, 'dove'); R.segnaPasso(er, 'cosa'); R.segnaPasso(er, 'correzione');
  prova('segnaPasso: senza doppioni', JSON.stringify(er.passi) === '["dove","cosa"]', JSON.stringify(er.passi));
  prova('opzioni del progetto', R.opzioniProgetto(c, P).diario === true && R.opzioniProgetto(c, 'segreto').diario === false && R.opzioniProgetto(c, P).valutato === false);
}

/* ---------- quali note scrivere ---------- */
{
  const c = { ...R.codiceVuoto(), eventi: [...base(),
    { t: T(4, 23, 59), tipo: 'prova', progetto: P, compila: true, passate: 1, totale: 1 },
    { t: T(2, 10, 0), tipo: 'prova', progetto: P, compila: true, passate: 1, totale: 1 },
    { t: T(5, 11, 0), tipo: 'segui', progetto: 'segreto' },
  ], diari: { [P]: { corso: C, giorni: ['2026-10-02', '2026-10-04', OGGI] } }, opzioni: { segreto: { diario: false } } };
  const n = R.noteDiario(c, { adesso: ADESSO });
  prova('note: oggi e ieri, non prima', JSON.stringify(n.map(x => x.file)) === JSON.stringify(['Progetti/lab3-liste/2026-10-04.md', 'Progetti/lab3-liste/2026-10-05.md']), JSON.stringify(n.map(x => x.file)));
  prova('note: diario spento non si scrive', !n.some(x => x.progetto === 'segreto'));
  const nuovo = n[1].nuovo;
  prova('note: proprietà', nuovo.startsWith('---\ntipo: diario-progetto\ncorso: "[[Programmazione 1]]"\nprogetto: "lab3-liste"\ndata: 2026-10-05\n'), nuovo);
  prova('note: titolo', nuovo.includes('# lab3-liste · lunedì 5 ottobre'), nuovo);
  prova('note: segni prima di «Cosa ho capito»', nuovo.indexOf('%% lode:diario %%\n%% /lode:diario %%') > 0 && nuovo.indexOf('## Cosa ho capito') > nuovo.indexOf('%% /lode:diario %%'));
  prova('note: senza corso, niente proprietà corso', !R.notaDiario({ progetto: 'x', giorno: OGGI }).includes('corso:'));
  // il limite dei 2000 eventi ha tolto l'inizio di oggi: la nota di oggi non si riscrive
  const pieno = { ...R.codiceVuoto(), eventi: Array.from({ length: R.MAX_EVENTI }, (_, i) => ({ t: T(5, 9, 0) + i, tipo: 'prova', progetto: P, compila: true, totale: 0 })) };
  prova('note: giorno incompleto, niente riscrittura', R.noteDiario(pieno, { adesso: ADESSO }).length === 0);
  pieno.eventi[0].t = T(4, 9, 0);
  prova('note: giorno completo, si riscrive', R.noteDiario(pieno, { adesso: ADESSO }).map(x => x.giorno).join() === OGGI);
  const a = R.diarioDaAprire(c, { adesso: ADESSO });
  prova('diario da aprire: oggi', a.file === 'Progetti/lab3-liste/2026-10-05.md' && a.spento === false, JSON.stringify(a));
  prova('diario da aprire: per nome, anche spento', R.diarioDaAprire(c, { progetto: 'Segreto', adesso: ADESSO })?.spento === true);
  prova('diario da aprire: l\'ultimo che c\'è', R.diarioDaAprire(c, { adesso: T(7, 9, 0) }).giorno === OGGI);
  prova('diario da aprire: nessun progetto', R.diarioDaAprire(R.codiceVuoto()) === null);
}

/* ---------- «Cosa so davvero» ---------- */
const codiceEsercizi = () => ({ ...R.codiceVuoto(),
  memoria: {
    'stampa|c:divisione-intera': { ease: 2.3, int: 1, rip: 1, scad: '2026-09-27', giuste: 2, sbagliate: 3, ultima: '2026-09-26' },
    'stampa|c:for': { ease: 2.6, int: 6, rip: 2, scad: '2026-10-08', giuste: 3, sbagliate: 0, ultima: OGGI },
    'stampa|c:switch': { ease: 2.5, int: 0, rip: 0, scad: '2026-10-06', giuste: 0, sbagliate: 1, ultima: OGGI },
    'stampa|c:ternario': { ease: 2.5, int: 1, rip: 1, scad: OGGI, giuste: 1, sbagliate: 0, ultima: '2026-10-04' },
    'stampa|c:solo-algoritmi': { ease: 2.5, int: 1, rip: 1, scad: '2026-10-09', giuste: 1, sbagliate: 0, ultima: OGGI },
    'definizione|qualcosa': { giuste: 9, sbagliate: 0 },
  },
  errori: { 'fuori-di-uno': 3, 'divisione-intera': 2, 'punto-e-virgola': 4, 'implicita': 2, 'cortocircuito': 0 },
  eventi: [
    { t: T(5, 15, 0), tipo: 'stampa', corso: C, concetto: 'c:for', ok: true },
    { t: T(5, 15, 1), tipo: 'stampa', corso: 'Algoritmi', concetto: 'c:solo-algoritmi', ok: true },
    { t: T(5, 15, 2), tipo: 'errore', voce: 'punto-e-virgola', nome: 'manca `;`', titolo: 'manca `;`' },
    { t: T(5, 15, 3), tipo: 'errore', voce: 'implicita', nome: 'funzione non dichiarata', titolo: '`strlen` non dichiarata' },
  ],
  diari: { [P]: { corso: C, giorni: ['2026-10-04', OGGI] }, altro: { corso: 'Algoritmi', giorni: [OGGI] } },
});
{
  const c = codiceEsercizi();
  const a = R.argomenti(c, { corso: C, oggi: OGGI, concetti: ['c:for', 'c:while', { id: 'c:printf', nome: 'printf e i formati' }] });
  const per = Object.fromEntries(a.map(x => [x.concetto, x]));
  prova('argomenti: «da rifare» quando la scadenza è prima di oggi', per['c:divisione-intera'].stato === 'da rifare');
  prova('argomenti: scadenza oggi non è ancora passata', per['c:ternario'].stato === 'sicuro');
  prova('argomenti: ultima risposta sbagliata, da rifare', per['c:switch'].stato === 'da rifare');
  prova('argomenti: sicuro', per['c:for'].stato === 'sicuro' && per['c:for'].primoColpo === 100);
  prova('argomenti: mai fatto dall\'elenco di F1', per['c:while'].stato === 'mai fatto' && per['c:while'].esercizi === 0 && per['c:printf'].argomento === 'printf e i formati');
  prova('argomenti: un concetto di un altro corso resta fuori', !per['c:solo-algoritmi']);
  prova('argomenti: le definizioni non sono esercizi', !a.some(x => x.concetto.includes('qualcosa')));
  prova('argomenti: ordine (da rifare, sicuro, mai fatto)', a.map(x => x.stato).join() === 'da rifare,da rifare,sicuro,sicuro,mai fatto,mai fatto', a.map(x => x.stato).join());
  const t = R.cosaSoDavvero(c, { corso: C, oggi: OGGI, concetti: ['c:for', 'c:while'] });
  prova('tabella: intestazione', t.includes('## Cosa so davvero') && t.includes('| Argomento | Esercizi | Al primo colpo | Ultima volta | Stato |\n|---|---|---|---|---|'), t);
  prova('tabella: la riga della spec', t.includes('| Divisione intera | 5 | 40% | 9 giorni fa | da rifare |'), t);
  prova('tabella: oggi e ieri', t.includes('| Ciclo for | 3 | 100% | oggi | sicuro |') && t.includes('| Operatore ternario | 1 | 100% | ieri | sicuro |'), t);
  prova('tabella: mai fatto', t.includes('| Ciclo while | 0 | — | — | mai fatto |'), t);
  prova('tabella: errori del compilatore, senza i mutanti', t.includes('Errori che incontri di più: manca `;` (4), funzione non dichiarata (2).') && !t.includes('fuori di uno'), t);
  prova('tabella: link ai diari del corso', t.includes('- lab3-liste: [[Progetti/lab3-liste/2026-10-05|5 ott]] · [[Progetti/lab3-liste/2026-10-04|4 ott]]') && !t.includes('altro'), t);
  prova('tabella: niente %%', !t.includes('%%'));
  const tubi = R.cosaSoDavvero({ memoria: { 'stampa|c:cortocircuito': { rip: 1, scad: '2026-10-09', giuste: 1, sbagliate: 0, ultima: OGGI } } }, { oggi: OGGI });
  prova('tabella: «|» nelle celle', tubi.includes('| && e \\|\\| in cortocircuito | 1 |'), tubi);
  prova('tabella: vuota', R.cosaSoDavvero(R.codiceVuoto(), { corso: C, oggi: OGGI }).includes('Ancora nessun esercizio.'));
  prova('tabella: nomi passati da F1', R.cosaSoDavvero(c, { corso: C, oggi: OGGI, nomi: { 'c:for': 'For con <' } }).includes('| For con < | 3 |'));
  prova('tabella: id sconosciuto leggibile', R.argomenti({ memoria: { 'stampa|c:somma-cifre': { rip: 1, scad: OGGI, giuste: 1, sbagliate: 0, ultima: OGGI } } }, { oggi: OGGI })[0].argomento === 'Somma cifre');
}
{
  const D = { orario: [{ corso: 'Programmazione 1', giorni: [1], inizio: '09:00', fine: '11:00' }], esami: [{ nome: 'Algoritmi e strutture dati', cfu: 9 }, { nome: 'Analisi 2', cfu: 9 }],
    codice: { ...R.codiceVuoto(), eventi: [{ t: 1, tipo: 'stampa', corso: 'programmazione 1', concetto: 'c:for' }, { t: 2, tipo: 'prova', progetto: 'x', corso: 'Basi di dati' }, { t: 3, tipo: 'errore', corso: 'Analisi 2' }] } };
  prova('corsi: nome come nell\'orario', JSON.stringify(R.corsiInformatica(D)) === '["Basi di dati","Programmazione 1"]', JSON.stringify(R.corsiInformatica(D)));
  const orfani = { ...D, codice: { memoria: { 'stampa|c:for': { giuste: 1 } } } };
  prova('corsi: esercizi senza eventi, dal nome del corso', JSON.stringify(R.corsiInformatica(orfani)) === '["Algoritmi e strutture dati","Programmazione 1"]', JSON.stringify(R.corsiInformatica(orfani)));
  prova('corsi: niente codice, niente corsi', R.corsiInformatica({ esami: D.esami }).length === 0);
}

/* ---------- Lode/Memoria.md ---------- */
{
  const r = R.righeMemoria(codiceEsercizi(), { oggi: OGGI });
  prova('memoria: sbagli spesso', r[0] === '- Sbagli spesso: fuori di uno (3), divisione intera (2).', r[0]);
  prova('memoria: conti degli esercizi', r.includes('- «Cosa stampa?»: 11 esercizi, 64% giusti al primo colpo.'), JSON.stringify(r));
  prova('memoria: da rifare', r.includes('- Da rifare: Divisione intera, switch e break.'), JSON.stringify(r));
  prova('memoria: errori', r.includes('- Errori che incontri di più: manca `;` (4), funzione non dichiarata (2).'), JSON.stringify(r));
  const s = R.sezioneMemoria(codiceEsercizi(), { oggi: OGGI });
  prova('memoria: sezione con titolo', s.startsWith('## Informatica\n- Sbagli spesso:') && s.endsWith('\n\n'));
  prova('memoria: niente da dire, niente sezione', R.sezioneMemoria(undefined) === '' && R.sezioneMemoria(R.codiceVuoto()) === '');
}

/* ---------- dagli eventi di «Segui il progetto» (js/codice/progetto.js) allo schema del diario ---------- */
{
  const seg = R.daProgetto({ tipo: 'segui', id: 'abc', nome: P, t: T(5, 14, 42), corso: C, valutato: false }, { corso: C });
  const fat = R.daProgetto({ tipo: 'fatto', id: 'abc', nome: P, t: T(5, 14, 51), piu: 41, meno: 7, impronta: 'a1', frase: '…', file: [{ rel: 'lista.c', stato: 'cambiato', piu: 35, meno: 7, nuove: ['inserisci_in_testa'], cambiate: [], tolte: [] }, { rel: 'main.c', stato: 'cambiato', piu: 6, meno: 0 }] }, { corso: C });
  const pro = R.daProgetto({ tipo: 'prova', id: 'abc', nome: P, t: T(5, 14, 53), esito: 'non-compila', ok: 0, tot: 0, impronta: 'a1', primo: { file: 'lista.c', riga: 42, messaggio: "'nodo' undeclared", titolo: 'nodo non dichiarato' }, stderr: 'non va nel diario' });
  const okk = R.daProgetto({ tipo: 'prova', id: 'abc', nome: P, t: T(5, 14, 58), esito: 'ok', ok: 6, tot: 6, impronta: 'a2' });
  const via = R.daProgetto({ tipo: 'smetti', id: 'abc', nome: P, t: T(5, 15, 30) });
  prova('da F2: segui', seg?.tipo === 'segui' && seg.progetto === P && seg.corso === C && !('id' in seg), JSON.stringify(seg));
  prova('da F2: fatto → cambio, con le funzioni', fat?.tipo === 'cambio' && fat.file.length === 2 && fat.piu === 41 && fat.funzioni?.[0]?.nome === 'inserisci_in_testa' && fat.funzioni[0].stato === 'nuova' && fat.impronta === 'a1', JSON.stringify(fat));
  prova('da F2: prova che non compila, titolo in italiano, niente stderr', pro?.compila === false && pro.primo.titolo === 'nodo non dichiarato' && !('stderr' in pro) && !('esito' in pro), JSON.stringify(pro));
  prova('da F2: prova riuscita', okk?.compila === true && okk.passate === 6 && okk.totale === 6, JSON.stringify(okk));
  prova('da F2: smetti', via?.tipo === 'segui' && via.smetti === true);
  prova('da F2: senza nome niente', R.daProgetto({ tipo: 'segui', id: 'abc' }) === null && R.daProgetto({ tipo: 'boh', nome: P }) === null);
  const ev = [seg, fat, pro, okk].map(x => ({ ...x }));
  const td2 = R.testoDiario(ev, OGGI, P);
  prova('da F2: il diario è quello della spec', td2.includes('- 14:51 · Cambiati 2 file (+41 −7): nuova `inserisci_in_testa` in lista.c') && td2.includes('- 14:53 · Prova: ✗ non compila, lista.c:42 «nodo non dichiarato»') && td2.includes('- 14:58 · Prova: ✓ compila · 6/6 prove · codice provato'), '\n' + td2);
  prova('i mutanti in più contano come sbagli di «Cosa stampa?»', R.righeMemoria({ errori: { 'else-pendente': 2, 'manca-punto-e-virgola': 1 }, memoria: {}, eventi: [] }).join('\n').includes('Sbagli spesso: else pendente (2)'));
}

/* ---------- lo scrittore, in un vault vero (desktop/vault.mjs) ---------- */
const vault = mkdtempSync(join(tmpdir(), 'lode-diario-'));
try {
  const V = { blocco: async x => VM.blocco(vault, x) };
  const D = { orario: [{ corso: C, giorni: [1], inizio: '09:00', fine: '11:00' }], esami: [{ nome: C, cfu: 12, data: '2027-01-20' }], codice: { ...R.codiceVuoto(), eventi: base(), memoria: codiceEsercizi().memoria, errori: codiceEsercizi().errori, diari: { [P]: { corso: C, giorni: [OGGI] } } } };
  const fatto = await R.aggiornaDiario(V, D, { adesso: ADESSO, concetti: ['c:for', 'c:while'] });
  const fd = join(vault, 'Progetti', P, OGGI + '.md'), fc = join(vault, 'Corsi', C + '.md');
  prova('scrittore: due file scritti', JSON.stringify(fatto) === JSON.stringify([{ file: `Progetti/${P}/${OGGI}.md`, id: 'diario', scritto: true }, { file: `Corsi/${C}.md`, id: 'informatica', scritto: true }]), JSON.stringify(fatto));
  let nota = existsSync(fd) ? readFileSync(fd, 'utf8') : '';
  prova('scrittore: la nota di oggi ha i segni e la riga «Prova»', nota.includes('%% lode:diario %%\n- 14:42 · Lode segue lab3-liste') && nota.includes('- 14:58 · Prova: ✓ compila · 6/6 prove · codice provato\n- Oggi: 2 prove, 1 errore risolto, correzioni viste: 0\n%% /lode:diario %%'), nota);
  // lo studente scrive la sua parte, poi succede altro: la sua parte resta uguale
  const mia = '\n## Cosa ho capito\nprova mia: il nodo va dichiarato prima di usarlo.\n';
  writeFileSync(fd, nota.replace(/\n## Cosa ho capito\n[\s\S]*$/, mia));
  D.codice.eventi.push({ t: T(5, 15, 40), tipo: 'cambio', progetto: P, file: 1, piu: 2, meno: 1, impronta: 'a5' });
  await R.aggiornaDiario(V, D, { adesso: ADESSO });
  nota = readFileSync(fd, 'utf8');
  prova('scrittore: la parte dello studente resta uguale', nota.endsWith(mia) && nota.split('## Cosa ho capito').length === 2, nota);
  prova('scrittore: il riquadro si aggiorna', nota.includes("- 15:40 · Cambiato 1 file (+2 −1) · chi l'ha scritto: non lo so") && nota.includes('ultima modifica non provata'), nota);
  prova('scrittore: un solo riquadro', nota.split('%% lode:diario %%').length === 2);
  const corso = existsSync(fc) ? readFileSync(fc, 'utf8') : '';
  prova('scrittore: la pagina del corso ha «Cosa so davvero»', corso.includes('%% lode:informatica %%\n## Cosa so davvero') && corso.includes('cfu: 12') && corso.includes('[[Progetti/lab3-liste/2026-10-05|5 ott]]'), corso);
  const ancora = await R.aggiornaDiario(V, D, { adesso: ADESSO });
  prova('scrittore: niente di nuovo, niente scritto', ancora.every(x => x.scritto === false), JSON.stringify(ancora));
  const rotto = await R.aggiornaDiario({ blocco: async () => { throw new Error('file non permesso'); } }, D, { adesso: ADESSO });
  prova('scrittore: un errore non ferma gli altri', rotto.length === 2 && rotto.every(x => x.errore === 'file non permesso'), JSON.stringify(rotto));
  prova('scrittore: senza codice non fa niente', (await R.aggiornaDiario(V, { esami: [] })).length === 0);
} finally { rmSync(vault, { recursive: true, force: true }); }

console.log(`${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
