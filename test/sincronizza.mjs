// Prove della sincronizzazione fra i computer (desktop/unione.mjs, desktop/sincronizza.mjs), senza Electron e senza rete:
//   node test/sincronizza.mjs
// Tutto in cartelle temporanee: una «cartella cloud» finta e le cartelle dati di due (o tre) «computer». Unione (modifiche
// contemporanee, cancellazioni, orologi sballati, contatori, ripasso SM-2), migrazione da dati.json, file rovinati o troncati,
// copie in conflitto, cifratura (password giusta e sbagliata, file manomessi), lo spostamento del vault interrotto a ogni passo.
// E i casi di perdita di dati trovati in revisione: dati.json riscritto dopo la migrazione, valori di partenza della barra,
// campi diversi dello stesso esame, propri file cifrati con un'altra chiave (mai riscritti), timbri nel futuro, copia locale per vault.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, utimesSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as U from '../desktop/unione.mjs';
import * as SY from '../desktop/sincronizza.mjs';

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const RADICE = mkdtempSync(join(tmpdir(), 'lode-sync-'));
const A = 'aaaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbbb', C = 'cccccccccccccccc';
const uguali = (x, y) => U.firma(x) === U.firma(y);
const clona = x => structuredClone(x);
const LEGGERI = { N: 2 ** 15, r: 8, p: 1 };   // scrypt più leggero solo nelle prove (l'app usa sempre 2^17)

// un dati.json come quelli di oggi: esami, sessioni, carte, orario, memoria SM-2, informatica, impostazioni, chiave AI
const DATI = () => ({
  v: 1, profilo: { nome: 'Ada', corso: 'Fisica', cfuTotali: 180, lode: 30 }, benvenuto: true,
  esami: [{ id: 'e1', nome: 'Analisi 1', cfu: 9, data: '2026-01-20', voto: 27, lode: false, idoneita: false, fatto: true, oreObiettivo: null },
    { id: 'e2', nome: 'Fisica 1', cfu: 9, data: '2026-12-15', voto: null, lode: false, idoneita: false, fatto: false, oreObiettivo: 80 },
    { id: 'e3', nome: 'Chimica', cfu: 6, data: null, voto: null, lode: false, idoneita: false, fatto: false, oreObiettivo: null }],
  sessioni: [{ id: 's1', esameId: 'e2', inizio: 1759300000000, min: 50 }, { id: 's2', esameId: 'e2', inizio: 1759390000000, min: 25 }],
  carte: [{ id: 'c1', esameId: 'e2', fronte: 'Legge di Ohm', retro: 'V = RI', ease: 2.5, int: 0, rip: 0, scad: '2026-10-02', creata: 1 },
    { id: 'c2', esameId: 'e2', fronte: 'Primo principio', retro: 'ΔU = Q − L', ease: 2.36, int: 6, rip: 2, scad: '2026-10-08', creata: 2 }],
  orario: [{ id: 'xx1', corso: 'Fisica 1', giorni: [1, 3], inizio: '09:00', fine: '11:00', aula: '7' }],
  lezioni: [], memoria: { 'fisica 1|ohm': { ease: 2.5, int: 2, rip: 1, scad: '2026-10-04', giuste: 3, sbagliate: 1, ultima: '2026-10-02' } },
  codice: { memoria: { 'stampa|c:for': { ease: 2.5, int: 1, rip: 1, scad: '2026-10-03', giuste: 2, sbagliate: 0, ultima: '2026-10-02' } }, errori: { 'manca-punto-e-virgola': 2 },
    eventi: [{ t: 1759300000000, tipo: 'stampa', concetto: 'c:for', ok: true }], diari: {}, opzioni: { lab1: { diario: true, valutato: false } } },
  imp: { focus: 25, pausa: 5, voceAlta: false, chiave: 'sk-segretissima-di-prova', aspetto: 'scuro', suoni: true, suggerimenti: true, ultimoSuggerimento: 0 },
  allenatore: { storia: [{ tipo: 'gioco', esame: 'Fisica 1', esito: 'accettata', giorno: '2026-10-01', ora: 18 }], ultima: 5, rimandaFino: 0 },
});

/* ---------- unione: funzioni pure ---------- */
{
  const D0 = DATI(), S0 = U.daDati(D0, 1000), v0 = U.vista(S0);
  const atteso = clona(D0); atteso.imp.chiave = undefined;
  prova('migrazione: niente si perde (stessa firma, chiave AI esclusa)', uguali(v0, { ...atteso, imp: { ...atteso.imp } }) && !JSON.stringify(S0).includes('sk-segretissima'), U.firma(v0).slice(0, 300));
  prova('migrazione: l\'ordine delle liste resta', v0.esami.map(e => e.id).join() === 'e1,e2,e3' && v0.carte.map(c => c.id).join() === 'c1,c2');
  prova('migrazione: contatori e memorie SM-2 come prima', v0.memoria['fisica 1|ohm'].giuste === 3 && v0.codice.errori['manca-punto-e-virgola'] === 2 && v0.codice.memoria['stampa|c:for'].ease === 2.5);
  const doppia = U.unisci(U.daDati(D0, 1000), U.daDati(clona(D0), 1000));
  prova('migrazione fatta da due computer: niente doppioni né doppi conteggi', uguali(U.vista(doppia), v0) && U.vista(doppia).memoria['fisica 1|ohm'].giuste === 3 && U.vista(doppia).esami.length === 3);
  const nuovo = clona(D0); nuovo.esami[0].voto = 28;
  prova('migrazione: un dati.json più recente vince registro per registro', U.vista(U.unisci(U.daDati(D0, 1000), U.daDati(nuovo, 2000))).esami[0].voto === 28 && U.vista(U.unisci(U.daDati(nuovo, 2000), U.daDati(D0, 1000))).esami[0].voto === 28);

  // due computer partono dallo stesso stato e modificano insieme
  const SA = clona(S0), SB = clona(S0);
  const a = clona(v0); a.esami[0].voto = 28; a.carte[0].fronte = 'Legge di Ohm (prima)'; a.memoria['fisica 1|ohm'].giuste = 4; a.esami.push({ id: 'eA', nome: 'Geometria', cfu: 6 }); a.codice.errori['manca-punto-e-virgola'] = 3;
  U.applica(SA, v0, a, A, 2000);
  const b = clona(v0); b.carte[0].ease = 2.6; b.carte[0].rip = 1; b.carte[0].int = 1; b.memoria['fisica 1|ohm'].giuste = 5; b.esami.push({ id: 'eB', nome: 'Inglese', cfu: 3 }); b.codice.errori['manca-punto-e-virgola'] = 4; b.profilo.corso = 'Fisica (magistrale)';
  U.applica(SB, v0, b, B, 2000);
  const M = U.unisci(SA, SB), vm = U.vista(M);
  prova('unione commutativa', U.stabile(U.unisci(SA, SB)) === U.stabile(U.unisci(SB, SA)));
  prova('unione idempotente', U.stabile(U.unisci(M, SA)) === U.stabile(M) && U.stabile(U.unisci(M, M)) === U.stabile(M));
  prova('modifiche a record diversi: restano tutte', vm.esami.some(e => e.id === 'eA') && vm.esami.some(e => e.id === 'eB') && vm.esami[0].voto === 28 && vm.profilo.corso === 'Fisica (magistrale)');
  prova('carta: testo da un computer, ripasso SM-2 dall\'altro, restano tutti e due', vm.carte[0].fronte === 'Legge di Ohm (prima)' && vm.carte[0].ease === 2.6 && vm.carte[0].rip === 1);
  prova('contatori: +1 e +2 su due computer fanno 3 in più, non di più', vm.memoria['fisica 1|ohm'].giuste === 6 && vm.codice.errori['manca-punto-e-virgola'] === 5, JSON.stringify(vm.memoria));
  // stesso registro, stesso millisecondo: regola fissa (l'id più grande), uguale in tutti e due gli ordini
  const SA2 = clona(S0), SB2 = clona(S0), a2 = clona(v0), b2 = clona(v0);
  a2.esami[1].data = '2026-12-16'; b2.esami[1].data = '2026-12-17';
  U.applica(SA2, v0, a2, A, 5000); U.applica(SB2, v0, b2, B, 5000);
  prova('stesso campo, stesso istante: vince sempre lo stesso (regola fissa)', U.vista(U.unisci(SA2, SB2)).esami[1].data === '2026-12-17' && U.vista(U.unisci(SB2, SA2)).esami[1].data === '2026-12-17');
  // orologio di B indietro di 5 minuti: ha visto la modifica di A e poi cambia lo stesso campo → vince B (orologio ibrido)
  const SA3 = clona(S0), a3 = clona(v0); a3.esami[1].data = '2026-12-20'; U.applica(SA3, v0, a3, A, 1_000_000);
  const SB3 = U.unisci(clona(S0), SA3), vb3 = U.vista(SB3), b3 = clona(vb3); b3.esami[1].data = '2026-12-21';
  U.applica(SB3, vb3, b3, B, 1_000_000 - 5 * 60e3);
  prova('orologio indietro di 5 minuti: la modifica fatta dopo aver visto l\'altra vince lo stesso', U.vista(U.unisci(SA3, SB3)).esami[1].data === '2026-12-21' && U.vista(U.unisci(SB3, SA3)).esami[1].data === '2026-12-21');
  prova('orologio ibrido: il timbro non va mai indietro', SB3.r['esami/e2'].t[0] > SA3.r['esami/e2'].t[0], JSON.stringify([SB3.r['esami/e2'].t, SA3.r['esami/e2'].t]));
  // orologio avanti di qualche minuto, modifiche davvero contemporanee: decide l'orologio, uguale da tutte e due le parti
  const SA4 = clona(S0), SB4 = clona(S0), a4 = clona(v0), b4 = clona(v0);
  a4.profilo.nome = 'Ada L.'; b4.profilo.nome = 'Ada Lovelace';
  U.applica(SA4, v0, a4, A, 2_000_000 + 3 * 60e3); U.applica(SB4, v0, b4, B, 2_000_000);
  prova('modifiche contemporanee con un orologio avanti: risultato deterministico', U.vista(U.unisci(SA4, SB4)).profilo.nome === 'Ada L.' && U.vista(U.unisci(SB4, SA4)).profilo.nome === 'Ada L.');

  // cancellazioni: lapidi
  const SA5 = clona(S0), a5 = clona(v0); a5.esami = a5.esami.filter(e => e.id !== 'e3'); a5.carte = a5.carte.filter(c => c.id !== 'c2'); U.applica(SA5, v0, a5, A, 3000);
  const SB5 = clona(S0), b5 = clona(v0); b5.esami[0].cfu = 12; U.applica(SB5, v0, b5, B, 3100);
  const v5 = U.vista(U.unisci(SA5, SB5));
  prova('cancellazione: arriva all\'altro computer, le sue modifiche restano', !v5.esami.some(e => e.id === 'e3') && !v5.carte.some(c => c.id === 'c2') && v5.esami[0].cfu === 12);
  const SB6 = clona(S0), b6 = clona(v0); b6.esami[2].cfu = 7; U.applica(SB6, v0, b6, B, 3500);
  prova('cancellazione contro modifica fatta dopo: vince la più recente (la modifica)', U.vista(U.unisci(SA5, SB6)).esami.some(e => e.id === 'e3' && e.cfu === 7));
  const SB7 = clona(S0), b7 = clona(v0); b7.esami[2].cfu = 8; U.applica(SB7, v0, b7, B, 2500);
  prova('modifica fatta prima della cancellazione: il record resta cancellato', !U.vista(U.unisci(SA5, SB7)).esami.some(e => e.id === 'e3'));
  const SB8 = clona(S0), b8 = clona(v0); b8.carte[1].ease = 2.7; b8.carte[1].rip = 3; U.applica(SB8, v0, b8, B, 3600);
  prova('ripasso di una carta cancellata sull\'altro computer: non la fa tornare', !U.vista(U.unisci(SA5, SB8)).carte.some(c => c.id === 'c2'));

  // «Cancella tutto» su A mentre B gioca: l'azzeramento vince sui conti fatti insieme; poi si conta da zero, senza numeri negativi
  const SA9 = clona(S0), SB9 = clona(S0), vuotoA = { v: 1, esami: [], sessioni: [], carte: [], orario: [], lezioni: [], memoria: {}, codice: { memoria: {}, errori: {}, eventi: [], diari: {}, opzioni: {} }, imp: {}, profilo: {} };
  U.applica(SA9, v0, vuotoA, A, 4000);
  const b9 = clona(v0); b9.memoria['fisica 1|ohm'].giuste = 4; U.applica(SB9, v0, b9, B, 3900);
  const M9 = U.unisci(SA9, SB9), v9 = U.vista(M9);
  prova('«Cancella tutto» arriva dappertutto', !v9.esami.length && !v9.carte.length && !Object.keys(v9.memoria).length && !Object.keys(v9.codice.errori).length && !v9.profilo.nome, JSON.stringify(v9).slice(0, 300));
  const SB10 = U.unisci(clona(SB9), SA9), vb10 = U.vista(SB10), b10 = clona(vb10); b10.memoria['fisica 1|ohm'] = { ease: 2.5, int: 1, rip: 1, scad: '2026-10-03', giuste: 1, sbagliate: 0, ultima: '2026-10-02' };
  U.applica(SB10, vb10, b10, B, 5000);
  prova('dopo l\'azzeramento si riparte da zero (1, non 1 + i conti vecchi)', U.vista(U.unisci(SA9, SB10)).memoria['fisica 1|ohm'].giuste === 1, JSON.stringify(U.vista(U.unisci(SA9, SB10)).memoria));
  // due azzeramenti contemporanei, poi un +1: 1 (non un numero negativo)
  const SA11 = clona(S0), SB11 = clona(S0), az = clona(v0); az.codice.errori = {};
  U.applica(SA11, v0, az, A, 6000); U.applica(SB11, v0, clona(az), B, 6000);
  const M11 = U.unisci(SA11, SB11), v11 = U.vista(M11), p11 = clona(v11); p11.codice.errori['manca-punto-e-virgola'] = 1;
  U.applica(M11, v11, p11, A, 7000);
  prova('due azzeramenti insieme e poi +1: fa 1', U.vista(U.unisci(M11, SB11)).codice.errori['manca-punto-e-virgola'] === 1);

  // a tre vie: la barra salva partendo da una versione vecchia, dopo che è arrivata una modifica dall'altro computer
  const SA12 = clona(S0), a12 = clona(v0); a12.esami[1].oreObiettivo = 120; U.applica(SA12, v0, a12, A, 8000);
  const SB12 = U.unisci(clona(S0), SA12), b12 = clona(v0); b12.carte[0].retro = 'V = R·I';   // B parte da v0, non ha visto le 120 ore
  U.applica(SB12, v0, b12, B, 8100);
  prova('base vecchia: la modifica arrivata dall\'altro computer non sembra «tolta»', U.vista(SB12).esami[1].oreObiettivo === 120 && U.vista(SB12).carte[0].retro === 'V = R·I');
  // orario riletto da Orario.md su tutti e due i computer, con id nuovi a caso: niente doppioni
  const SA13 = clona(S0), SB13 = clona(S0), a13 = clona(v0), b13 = clona(v0);
  a13.orario = [{ id: 'rnd1', corso: 'Fisica 1', giorni: [1, 3], inizio: '09:00', fine: '11:00', aula: '7' }, { id: 'rnd2', corso: 'Chimica', giorni: [2], inizio: '14:00', fine: '16:00', aula: 'B' }];
  b13.orario = [{ id: 'zzz9', corso: 'Fisica 1', giorni: [1, 3], inizio: '09:00', fine: '11:00', aula: '7' }, { id: 'zzz8', corso: 'Chimica', giorni: [2], inizio: '14:00', fine: '16:00', aula: 'B' }];
  U.applica(SA13, v0, a13, A, 9000); U.applica(SB13, v0, b13, B, 9001);
  const v13 = U.vista(U.unisci(SA13, SB13));
  prova('orario riletto con id nuovi su due computer: niente doppioni, id stabili', v13.orario.length === 2 && v13.orario.every(o => /^o[0-9a-f]{16}$/.test(o.id)), JSON.stringify(v13.orario));
  // eventi di informatica e storia dell'allenatore: si sommano, due eventi uguali restano due
  const SA14 = clona(S0), SB14 = clona(S0), a14 = clona(v0), b14 = clona(v0);
  const ev = { t: 1759400000000, tipo: 'stampa', concetto: 'c:if', ok: false };
  a14.codice.eventi.push(ev, clona(ev)); b14.codice.eventi.push({ t: 1759400000500, tipo: 'prova', progetto: 'lab1', compila: true, passate: 2, totale: 2 });
  a14.allenatore.storia.push({ tipo: 'ripasso', esame: 'Fisica 1', esito: 'rifiutata', giorno: '2026-10-02', ora: 9 });
  U.applica(SA14, v0, a14, A, 9100); U.applica(SB14, v0, b14, B, 9100);
  const v14 = U.vista(U.unisci(SA14, SB14));
  prova('eventi: quelli dei due computer, in ordine di tempo, i doppi restano doppi', v14.codice.eventi.length === 4 && v14.codice.eventi.map(e => e.t).every((t, i, x) => !i || x[i - 1] <= t) && v14.allenatore.storia.length === 2, JSON.stringify(v14.codice.eventi));
  // tre computer, unioni in ordini diversi: stesso risultato
  const SC = clona(S0), c15 = clona(v0); c15.sessioni.push({ id: 's3', esameId: 'e1', inizio: 1759500000000, min: 40 }); U.applica(SC, v0, c15, C, 9200);
  const o1 = U.unisci(U.unisci(SA14, SB14), SC), o2 = U.unisci(SC, U.unisci(SB14, SA14)), o3 = U.unisci(U.unisci(SC, SA14), SB14);
  prova('tre computer: associativa (stesso stato in ogni ordine)', U.stabile(o1) === U.stabile(o2) && U.stabile(o2) === U.stabile(o3));
  prova('la chiave AI e __rev non entrano mai nei registri', !Object.keys(U.registri({ ...v0, __rev: 7, imp: { chiave: 'sk-x', focus: 50 } }).reg).some(k => /chiave|__rev/.test(k)));
  // uno stato scritto da altri: si controlla tutto
  const brutto = { r: { '__proto__': { v: 1, t: [1, A] }, 'esami/x': { v: { id: 'x' }, t: [1, 'nonvalido'] }, 'esami/y': { v: { id: 'y' }, t: [2, A] }, 'esami/z': { v: { id: 'z' }, t: [Infinity, A] } }, x: { 'esami/q': [1, 'x'] }, c: { 'k': { z: null, d: { [A]: [null, -5], [B]: [null, 2] } } } };
  const vb = U.valida(brutto);
  prova('stato da un file: timbri, dispositivi e contatori storti si scartano', vb && Object.keys(vb.r).join() === 'esami/y' && !Object.keys(vb.x).length && JSON.stringify(vb.c.k.d) === JSON.stringify({ [B]: [null, 2] }), JSON.stringify(vb));
  prova('stato da un file: spazzatura → null', U.valida(null) === null && U.valida({ r: [] }) === null && U.valida('ciao') === null);
}

/* ---------- file: due computer sulla stessa cartella cloud ---------- */
const cartelle = nome => { const d = join(RADICE, nome); mkdirSync(d, { recursive: true }); return d; };
const leggiJson = p => JSON.parse(readFileSync(p, 'utf8'));
{
  const cloud = cartelle('cloud1'), vault = join(cloud, 'Lode'), locA = cartelle('pcA'), locB = cartelle('pcB');
  mkdirSync(join(vault, '.lode'), { recursive: true });
  writeFileSync(join(vault, '.lode', 'dati.json'), JSON.stringify(DATI()));
  const firmaPrima = U.firma({ ...DATI(), imp: { ...DATI().imp, chiave: undefined } });
  SY.segna(vault);
  const mA = SY.apri({ vault, locale: locA, dispositivo: A, ritardo: 60e3 });
  const nomiLode = readdirSync(join(vault, '.lode'));
  prova('migrazione: dati.json diventa dati.migrato-…, copia di sicurezza sul computer', !nomiLode.includes('dati.json') && nomiLode.some(n => /^dati\.migrato-\d+\.json$/.test(n)) && readdirSync(join(locA, 'copie')).some(n => /^dati-prima-della-sincronizzazione-\d+\.json$/.test(n)), nomiLode.join());
  prova('migrazione: la vista di A è il dati.json di prima', U.firma(mA.vista()) === firmaPrima);
  prova('il file di A: solo il suo, con il suo id, e la copia locale', readdirSync(join(vault, '.lode', 'dispositivi')).join() === A + '.json' && existsSync(SY.fileLocale(locA, vault, A)));
  prova('la chiave AI non è nel vault', !JSON.stringify(readdirSync(join(vault, '.lode', 'dispositivi')).map(f => readFileSync(join(vault, '.lode', 'dispositivi', f), 'utf8'))).includes('sk-segretissima'));
  const mB = SY.apri({ vault, locale: locB, dispositivo: B, ritardo: 60e3 });
  prova('B apre il vault sincronizzato: vede quello che vede A', uguali(mA.vista(), mB.vista()));
  // tutti e due modificano, da due finestre (__rev)
  const dA = mA.per(1), dB = mB.per(1);
  dA.esami.push({ id: 'eA1', nome: 'Geometria', cfu: 6, data: '2027-01-10', voto: null }); dA.memoria['fisica 1|ohm'].giuste++;
  dB.esami[1].voto = 30; dB.esami[1].lode = true; dB.esami[1].fatto = true; dB.memoria['fisica 1|ohm'].giuste++; dB.carte[0].ease = 2.6; dB.carte[0].rip = 1;
  const rA = mA.salva(dA, 1), rB = mB.salva(dB, 1);
  mA.scriviOra(); mB.scriviOra();
  prova('salva: la finestra ha già tutto (niente rimando), le altre si aggiornano', !rA.perChi && rA.perAltri && rA.n > 0);
  const cA = mA.ricarica(), cB = mB.ricarica();
  prova('ricarica: ognuno vede i file dell\'altro', cA && cB);
  prova('due computer, modifiche insieme: alla fine vedono la stessa cosa', uguali(mA.vista(), mB.vista()) && mA.vista().esami.length === 4 && mA.vista().esami[1].lode === true && mA.vista().memoria['fisica 1|ohm'].giuste === 5, JSON.stringify(mA.vista().memoria));
  prova('ognuno ha scritto solo il suo file', readdirSync(join(vault, '.lode', 'dispositivi')).sort().join() === [A, B].map(x => x + '.json').join());
  prova('stato: ultimo arrivo dall\'altro computer', mA.stato().ultimoArrivo > 0 && mA.stato().altri.length === 1 && mA.stato().altri[0].id === B);
  // finestra che salva da una versione vecchia (non ha ancora ricevuto quello che è arrivato da B)
  const vecchia = mA.per(2); vecchia.__rev = dA.__rev; vecchia.esami = clona(dA.esami); vecchia.profilo.corso = 'Fisica e astrofisica';
  const r2 = mA.salva(vecchia, 2);
  prova('finestra indietro: la sua modifica entra, il 30 e lode di B resta, e le si rimanda la vista', mA.vista().profilo.corso === 'Fisica e astrofisica' && mA.vista().esami[1].voto === 30 && r2.perChi);
  mA.scriviOra(); mB.ricarica();
  prova('… e arriva anche a B', mB.vista().profilo.corso === 'Fisica e astrofisica' && uguali(mA.vista(), mB.vista()));

  // un file rovinato o troncato di B: A lo salta, lo segnala, non lo riscrive, e i dati restano
  const fB = join(vault, '.lode', 'dispositivi', B + '.json'), buonoB = readFileSync(fB, 'utf8');
  writeFileSync(fB, buonoB.slice(0, Math.floor(buonoB.length / 2)));
  const primaA = U.firma(mA.vista());
  mA.ricarica();
  prova('file troncato: saltato e segnalato, niente perso', U.firma(mA.vista()) === primaA && mA.stato().problemi.some(p => p.file === B + '.json' && p.codice === 'rotto') && readFileSync(fB, 'utf8').length < buonoB.length);
  const mA2 = SY.apri({ vault, locale: locA, dispositivo: A, ritardo: 60e3 });
  prova('file troncato: anche riaprendo A, i dati di B che A aveva già visto restano (nel file di A)', U.firma(mA2.vista()) === primaA);
  mA2.chiudi();
  writeFileSync(fB, buonoB); utimesSync(fB, new Date(), new Date(Date.now() + 2000));
  mA.ricarica();
  prova('file di B di nuovo sano: il problema sparisce', !mA.stato().problemi.some(p => p.file === B + '.json'));
  writeFileSync(fB, '{"formato":"altro"}'); utimesSync(fB, new Date(), new Date(Date.now() + 4000));
  mA.ricarica();
  prova('file con un formato che non è di Lode: saltato', mA.stato().problemi.some(p => p.file === B + '.json' && p.codice === 'formato') && U.firma(mA.vista()) === primaA);
  writeFileSync(fB, buonoB); utimesSync(fB, new Date(), new Date(Date.now() + 6000)); mA.ricarica();

  // copie in conflitto: una copia vecchia del file di B («… 2.json») e un «dati 2.json» rimasto da prima
  const copia = join(vault, '.lode', 'dispositivi', `${B} 2.json`);
  const vecchioB = JSON.parse(buonoB); vecchioB.stato.r['esami/eB9'] = { v: { id: 'eB9', nome: 'Statistica', cfu: 6 }, t: [Date.now() - 1e6, B], n: [Date.now() - 1e6, B] };
  writeFileSync(copia, JSON.stringify(vecchioB));
  const datiCopia = DATI(); datiCopia.esami.push({ id: 'eD2', nome: 'Laboratorio', cfu: 3, voto: null }); datiCopia.imp.chiave = 'sk-altra';
  writeFileSync(join(vault, '.lode', 'dati 2.json'), JSON.stringify(datiCopia));
  writeFileSync(join(vault, '.lode', 'dati (conflicted copy 2026-10-02).json'), JSON.stringify({ ...DATI(), esami: [{ id: 'eD3', nome: 'Ottica', cfu: 6 }] }));
  mA.ricarica(); mA.scriviOra();
  const risolti = existsSync(join(vault, '.lode', 'conflitti-risolti')) ? readdirSync(join(vault, '.lode', 'conflitti-risolti')) : [];
  prova('copie in conflitto di un file di computer: unite (niente perso)', mA.vista().esami.some(e => e.id === 'eB9'), mA.vista().esami.map(e => e.id).join());
  prova('copie in conflitto di dati.json: non unite (senza timbri farebbero tornare cose cancellate), segnalate e copiate sul computer', !['eD2', 'eD3'].some(id => mA.vista().esami.some(e => e.id === id)) && mA.stato().problemi.filter(p => p.codice === 'dati_da_parte').length === 2 && readdirSync(join(locA, 'copie')).filter(n => /^dati .*-prima-della-sincronizzazione-/.test(n)).length === 2, JSON.stringify(mA.stato().problemi));
  prova('copie in conflitto: messe da parte, si possono rimettere', !existsSync(copia) && !existsSync(join(vault, '.lode', 'dati 2.json')) && risolti.some(n => n.endsWith(`${B} 2.json`)) && risolti.some(n => n.endsWith('dati 2.json')) && risolti.some(n => n.includes('conflicted copy')), risolti.join(' | '));
  prova('copie in conflitto: la chiave AI di un dati.json non entra', !JSON.stringify(mA._stato()).includes('sk-altra'));
  mB.ricarica();
  prova('… e B le vede attraverso il file di A', mB.vista().esami.some(e => e.id === 'eB9') && uguali(mA.vista(), mB.vista()));

  // iCloud/OneDrive tolgono dal disco il file di A: la copia locale basta, niente si perde, il file si riscrive
  const fA = join(vault, '.lode', 'dispositivi', A + '.json'), firmaA = U.firma(mA.vista());
  mA.chiudi(); rmSync(fA);
  const mA3 = SY.apri({ vault, locale: locA, dispositivo: A, ritardo: 60e3 });
  prova('proprio file sparito dal vault: riparte dalla copia locale e lo riscrive', U.firma(mA3.vista()) === firmaA && existsSync(fA));
  // e il contrario: computer nuovo per lo stesso id (copia locale persa), il file nel vault c'è
  rmSync(join(locA, 'sincronizzazione'), { recursive: true });
  mA3.chiudi();
  const mA4 = SY.apri({ vault, locale: locA, dispositivo: A, ritardo: 60e3 });
  prova('copia locale persa: riparte dal file nel vault', U.firma(mA4.vista()) === firmaA);
  // orologio di B indietro di 5 minuti: cambia un campo che A ha cambiato prima, dopo averlo visto → vince B
  const mBs = SY.apri({ vault, locale: locB, dispositivo: B, ritardo: 60e3, ora: () => Date.now() - 5 * 60e3 });
  const x1 = mA4.per(9); x1.profilo.nome = 'Ada (A)'; mA4.salva(x1, 9); mA4.scriviOra(); mBs.ricarica();
  const x2 = mBs.per(9); x2.profilo.nome = 'Ada (B, dopo)'; mBs.salva(x2, 9); mBs.scriviOra(); mA4.ricarica();
  prova('file: orologio indietro di 5 minuti, la modifica fatta dopo vince su tutti e due', mA4.vista().profilo.nome === 'Ada (B, dopo)' && mBs.vista().profilo.nome === 'Ada (B, dopo)');
  // note Markdown in conflitto: segnalate, non toccate
  mkdirSync(join(vault, 'Lezioni', 'Fisica 1'), { recursive: true });
  for (const [f, t] of [['Lezioni/Fisica 1/2026-10-01 Fisica 1.md', 'a'], ['Lezioni/Fisica 1/2026-10-01 Fisica 1 2.md', 'b'], ['Analisi 2.md', 'c'], ['Home.md', 'h'], ['Home (conflicted copy 2026-10-02).md', 'h2'], ['Orario.sync-conflict-20261002-101010-ABCDEFG.md', 'o'], ['Esami.md', 'e'], ['Esami-DESKTOP-4G7H2K1.md', 'e2']]) writeFileSync(join(vault, ...f.split('/')), t);
  const cn = SY.copieNote(vault);
  prova('note in conflitto: trovate (iCloud, Dropbox, Syncthing, OneDrive)', ['Lezioni/Fisica 1/2026-10-01 Fisica 1 2.md', 'Home (conflicted copy 2026-10-02).md', 'Orario.sync-conflict-20261002-101010-ABCDEFG.md', 'Esami-DESKTOP-4G7H2K1.md'].every(f => cn.some(x => x.file === f)), JSON.stringify(cn));
  prova('note in conflitto: «Analisi 2.md» da sola non è una copia, e niente viene toccato', !cn.some(x => x.file === 'Analisi 2.md') && readFileSync(join(vault, 'Esami-DESKTOP-4G7H2K1.md'), 'utf8') === 'e2');
  for (const m of [mA, mB, mA4, mBs]) m.chiudi();
  // due computer con lo stesso id (la cartella dei dati copiata su un computer nuovo): scrivono lo stesso file, ma ognuno
  // rilegge quello che ha scritto l'altro e lo unisce. Il main poi dà un id nuovo (impronta della macchina)
  const locA2 = cartelle('pcA-copia'), m1 = SY.apri({ vault, locale: locA, dispositivo: A, ritardo: 60e3 }), m2 = SY.apri({ vault, locale: locA2, dispositivo: A, ritardo: 60e3 });
  const y1 = m1.per(1); y1.esami.push({ id: 'id1', nome: 'Dal primo', cfu: 6 }); m1.salva(y1, 1); m1.scriviOra();
  const fileA = join(vault, '.lode', 'dispositivi', A + '.json'); utimesSync(fileA, new Date(), new Date(Date.now() + 8000));
  m2.ricarica();
  const y2 = m2.per(1); y2.esami.push({ id: 'id2', nome: 'Dal secondo', cfu: 6 }); m2.salva(y2, 1); m2.scriviOra();
  utimesSync(fileA, new Date(), new Date(Date.now() + 10000));
  m1.ricarica();
  prova('stesso id su due computer: ognuno unisce quello che ha scritto l\'altro nel file comune', ['id1', 'id2'].every(id => m1.vista().esami.some(e => e.id === id)) && ['id1', 'id2'].every(id => m2.vista().esami.some(e => e.id === id)));
  prova('stesso id su due computer: chi vede il proprio file riscritto da un\'altra istanza lo dice (il main prende un id nuovo)', m1.stato().conteso === true && m2.stato().conteso === true);
  m1.chiudi(); m2.chiudi();
}

/* ---------- cifratura ---------- */
{
  const cloud = cartelle('cloud2'), vault = join(cloud, 'Lode'), locA = cartelle('pcA2'), locB = cartelle('pcB2');
  mkdirSync(join(vault, '.lode'), { recursive: true });
  writeFileSync(join(vault, '.lode', 'dati.json'), JSON.stringify(DATI()));
  SY.segna(vault);
  const mA = SY.apri({ vault, locale: locA, dispositivo: A, ritardo: 60e3 }), mB = SY.apri({ vault, locale: locB, dispositivo: B, ritardo: 60e3 });
  const prima = U.firma(mA.vista());
  let corta = null; try { SY.accendiCifratura(vault, locA, 'breve', LEGGERI); } catch (x) { corta = x.codice; }
  prova('cifratura: password troppo corta rifiutata', corta === 'corta');
  mA.scriviOra();
  const chiave = SY.accendiCifratura(vault, locA, 'una password lunga', LEGGERI);
  prova('cifratura: i vecchi file in chiaro escono dal vault e restano sul computer', !readdirSync(join(vault, '.lode')).some(n => /^dati/.test(n)) && readdirSync(join(locA, 'copie')).some(n => n.startsWith('in-chiaro-')));
  mA.chiudi({ soloLocale: true });
  const mAc = SY.apri({ vault, locale: locA, dispositivo: A, chiave, ritardo: 60e3 });
  const fA = join(vault, '.lode', 'dispositivi', A + '.json'), testoA = readFileSync(fA, 'utf8');
  // (il testo cifrato in base64 può contenere «Ohm» per caso: si guarda tutto il resto del file)
  const fuoriA = JSON.stringify({ ...JSON.parse(testoA), cifrato: { ...JSON.parse(testoA).cifrato, dati: '' } });
  prova('cifratura: il file di A è cifrato (niente nomi di esami né voti in chiaro)', JSON.parse(testoA).cifrato && !/Analisi|Fisica|Ohm|"voto"/.test(fuoriA) && !/"voto"/.test(testoA) && U.firma(mAc.vista()) === prima);
  const d = mAc.per(1); d.esami.push({ id: 'eC', nome: 'Termodinamica', cfu: 6 }); mAc.salva(d, 1); mAc.scriviOra();
  const testoA2 = readFileSync(fA, 'utf8');
  prova('cifratura: nonce nuovo a ogni scrittura', JSON.parse(testoA2).cifrato.nonce !== JSON.parse(testoA).cifrato.nonce);
  // B: il vault ora è cifrato. Senza password è bloccato; password sbagliata → errore; giusta → vede tutto
  mB.chiudi({ soloLocale: true });
  prova('cifratura: sull\'altro computer, senza password, i dati sono bloccati', SY.apri({ vault, locale: locB, dispositivo: B }).bloccato === true);
  const fBc = join(vault, '.lode', 'dispositivi', B + '.json');
  // il file in chiaro di B (che contiene tutto lo stato) è già uscito dal vault con la cifratura di A; se B lo riscrive in chiaro
  // prima di vedere cifratura.json, togliInChiaro lo toglie lui
  prova('cifratura: i file in chiaro degli altri computer escono dal vault quando A cifra', !existsSync(fBc) && readdirSync(join(locA, 'copie')).some(n => n.startsWith('in-chiaro-') && existsSync(join(locA, 'copie', n, 'dispositivi', B + '.json'))));
  writeFileSync(fBc, readFileSync(SY.fileLocale(locB, vault, B)));
  prova('cifratura: il file in chiaro di B esce dal vault e resta su B finché non scrive la password', existsSync(fBc) && SY.togliInChiaro(vault, locB, B) && !existsSync(fBc) && readdirSync(join(locB, 'copie')).some(n => n.startsWith('in-chiaro-')) && existsSync(SY.fileLocale(locB, vault, B)));
  const info = SY.leggiCifratura(vault);
  let sbagliata = null; try { SY.chiaveDa(info, 'password sbagliata!'); } catch (x) { sbagliata = x.codice; }
  prova('cifratura: password sbagliata riconosciuta (valore di controllo)', sbagliata === 'password');
  const kB = SY.chiaveDa(info, 'una password lunga');
  const mBc = SY.apri({ vault, locale: locB, dispositivo: B, chiave: kB, ritardo: 60e3 });
  prova('cifratura: password giusta, B vede tutto (anche Termodinamica)', mBc.vista().esami.some(e => e.id === 'eC') && uguali(mBc.vista(), mAc.vista()));
  mBc.scriviOra();
  prova('cifratura: anche il file di B è cifrato', !!JSON.parse(readFileSync(join(vault, '.lode', 'dispositivi', B + '.json'), 'utf8')).cifrato);
  // un file in chiaro infilato da qualcuno nel vault cifrato: rifiutato; un file cifrato manomesso: rifiutato
  const intruso = 'dddddddddddddddd', Sx = U.daDati({ v: 1, esami: [{ id: 'evil', nome: '<img src=x>', cfu: 6 }] }, 1);
  writeFileSync(join(vault, '.lode', 'dispositivi', intruso + '.json'), SY.serializza(Sx, { dispositivo: intruso }));
  const man = JSON.parse(readFileSync(join(vault, '.lode', 'dispositivi', B + '.json'), 'utf8')); const buf = Buffer.from(man.cifrato.dati, 'base64'); buf[10] ^= 1; man.cifrato.dati = buf.toString('base64');
  writeFileSync(join(vault, '.lode', 'dispositivi', `${B} (1).json`), JSON.stringify(man));
  mAc.ricarica();
  prova('cifratura: file in chiaro di un intruso rifiutato', !mAc.vista().esami.some(e => e.id === 'evil') && mAc.stato().problemi.some(p => p.file === intruso + '.json' && p.codice === 'in_chiaro'));
  prova('cifratura: file manomesso rifiutato (e lasciato dov\'è)', mAc.stato().problemi.some(p => p.file === `${B} (1).json` && p.codice === 'password') && existsSync(join(vault, '.lode', 'dispositivi', `${B} (1).json`)));
  // un file cifrato con un'altra chiave e messo al posto di quello di B (stesso id): rifiutato
  const altra = SY.creaCifratura('un\'altra password ancora', LEGGERI).chiave;
  writeFileSync(join(vault, '.lode', 'dispositivi', 'eeeeeeeeeeeeeeee.json'), SY.serializza(Sx, { dispositivo: 'eeeeeeeeeeeeeeee', chiave: altra }));
  mAc.ricarica();
  prova('cifratura: file con un\'altra password saltato', mAc.stato().problemi.some(p => p.file === 'eeeeeeeeeeeeeeee.json' && p.codice === 'password'));
  // il file di B rinominato come se fosse di un altro computer (stesso contenuto, altro id): l'id è legato al file cifrato
  writeFileSync(join(vault, '.lode', 'dispositivi', 'ffffffffffffffff.json'), JSON.stringify({ ...JSON.parse(readFileSync(join(vault, '.lode', 'dispositivi', B + '.json'), 'utf8')), dispositivo: 'ffffffffffffffff' }));
  mAc.ricarica();
  prova('cifratura: un file spacciato per un altro computer non si apre', mAc.stato().problemi.some(p => p.file === 'ffffffffffffffff.json' && p.codice === 'password'));
  // un dati.json in chiaro infilato nel vault cifrato: non si migra
  writeFileSync(join(vault, '.lode', 'dati.json'), JSON.stringify({ ...DATI(), esami: [{ id: 'evil2', nome: 'Intruso', cfu: 6 }] }));
  mAc.ricarica();
  prova('cifratura: un dati.json in chiaro infilato nel vault cifrato non entra', !mAc.vista().esami.some(e => e.id === 'evil2') && mAc.stato().problemi.some(p => p.file === 'dati.json' && p.codice === 'in_chiaro'));
  // cifratura.json con parametri deboli: rifiutato
  const cj = SY.fileCifratura(vault), buono = readFileSync(cj, 'utf8');
  writeFileSync(cj, JSON.stringify({ ...JSON.parse(buono), N: 1024 }));
  let debole = null; try { SY.leggiCifratura(vault); } catch (x) { debole = x.codice; }
  prova('cifratura: parametri deboli in cifratura.json rifiutati', debole === 'cifratura');
  writeFileSync(cj, buono);
  prova('cifratura: la chiave sbagliata non apre nemmeno il motore', SY.apri({ vault, locale: locB, dispositivo: B, chiave: altra }).bloccato === true);
  prova('cifratura: l\'app usa scrypt N=2^17, r=8, p=1', SY.SCRYPT.N === 2 ** 17 && SY.SCRYPT.r === 8 && SY.SCRYPT.p === 1);
  mAc.chiudi(); mBc.chiudi();
}

/* ---------- le perdite di dati trovate in revisione: ogni caso con file veri, in cartelle temporanee ---------- */
{
  // la base del confronto a tre vie è la vista come la vede la barra: i valori di partenza devono essere quelli di js/dati.js
  globalThis.localStorage ||= { getItem: () => null, setItem() { }, removeItem() { } };
  globalThis.addEventListener ||= () => { }; globalThis.dispatchEvent ||= () => { }; globalThis.CustomEvent ||= class { };
  const DJ = await import('../js/dati.js');
  prova('normalizza: gli stessi valori di partenza della barra (js/dati.js VUOTO)', U.stabile(U.VUOTO_BARRA()) === U.stabile(DJ.VUOTO()));
  const vaultNuovo = (nome, dati) => { const v = join(cartelle(nome), 'Lode'); mkdirSync(join(v, '.lode'), { recursive: true }); if (dati) writeFileSync(join(v, '.lode', 'dati.json'), JSON.stringify(dati)); SY.segna(v); return v; };
  const nomiLode = v => readdirSync(join(v, '.lode'));

  // 1. un dati.json che ricompare dopo la migrazione. Scritto da un altro (una versione di Lode di prima, un computer rimasto
  // spento con un dati.json vecchio, uno partito vuoto): messo da parte e segnalato, niente si cancella e niente torna indietro.
  // Scritto da questo processo (le modifiche che aspettavano quando la sincronizzazione si è accesa altrove): a tre vie
  const prima = DATI(); prima.imp.chiave = '';
  const v1 = vaultNuovo('rev1', prima), l1 = cartelle('rev1-A'), fDati = join(v1, '.lode', 'dati.json'), miei = new Map();
  // datiMiei: { base } = il dati.json che il processo aveva letto prima di scrivere (main.mjs, baseLetta)
  const m1 = SY.apri({ vault: v1, locale: l1, dispositivo: A, ritardo: 60e3, datiMiei: d => miei.get(SY.firmaDati(d)) || false });
  const a1 = m1.per(1); a1.esami = a1.esami.filter(e => e.id !== 'e1'); a1.esami.find(e => e.id === 'e2').voto = 30; a1.profilo.nome = 'Ada Lovelace';
  m1.salva(a1, 1); m1.scriviOra();
  const vuota = { v: 1, profilo: { nome: '' }, esami: [{ id: 'eX', nome: 'Chimica', cfu: 6, voto: null }], carte: [], sessioni: [] };
  writeFileSync(fDati, JSON.stringify(vuota)); m1.ricarica(); m1.scriviOra();
  let w = m1.vista();
  prova('dati.json ricomparso scritto da un\'altra versione (quasi vuoto): messo da parte, niente lapidi né azzeramenti', !existsSync(fDati) && w.esami.length === prima.esami.length - 1 && !w.esami.some(e => e.id === 'eX') && w.profilo.nome === 'Ada Lovelace' && w.carte.length === prima.carte.length && Object.keys(m1._stato().x).length === 1
    && m1.stato().problemi.some(p => p.file === 'dati.json' && p.codice === 'dati_da_parte') && readdirSync(join(v1, '.lode', 'conflitti-risolti')).some(n => /dati\.json$/.test(n)) && readdirSync(join(l1, 'copie')).length >= 2, JSON.stringify(w.esami.map(e => e.id)) + JSON.stringify(m1.stato().problemi));
  const b1 = clona(prima); b1.esami.push({ id: 'eB', nome: 'Inglese', cfu: 3, voto: null }); miei.set(SY.firmaDati(b1), { base: prima });
  writeFileSync(fDati, JSON.stringify(b1)); m1.ricarica(); m1.scriviOra();
  w = m1.vista();
  prova('dati.json riscritto da questo processo dopo la migrazione: entra solo l\'esame nuovo, niente risorge e niente torna indietro', w.esami.some(e => e.id === 'eB') && !w.esami.some(e => e.id === 'e1') && w.esami.find(e => e.id === 'e2')?.voto === 30 && w.profilo.nome === 'Ada Lovelace', JSON.stringify(w.esami.map(e => [e.id, e.voto])) + w.profilo.nome);
  prova('… e dati.json esce di nuovo di scena (due dati.migrato)', !existsSync(fDati) && nomiLode(v1).filter(n => /^dati\.migrato-/.test(n)).length === 2, nomiLode(v1).join());
  const b2 = clona(b1); b2.esami = b2.esami.filter(e => e.id !== 'e3'); b2.esami.find(e => e.id === 'eB').cfu = 6; miei.set(SY.firmaDati(b2), { base: prima });
  writeFileSync(fDati, JSON.stringify(b2)); m1.ricarica();
  // riscritto ancora prima che il file di A sia scritto: non si sposta, e al giro dopo entra anche l'ultima modifica
  const b3 = clona(b2); b3.profilo.corso = 'Fisica (B)'; miei.set(SY.firmaDati(b3), { base: prima }); writeFileSync(fDati, JSON.stringify(b3)); utimesSync(fDati, new Date(), new Date(Date.now() + 5000));
  m1.scriviOra();
  prova('dati.json cambiato fra la lettura e lo spostamento: resta dov\'è', existsSync(fDati));
  m1.ricarica(); m1.scriviOra(); w = m1.vista();
  prova('… e al giro dopo entrano tutte e due le modifiche, a tre vie', !existsSync(fDati) && !w.esami.some(e => e.id === 'e3') && w.esami.find(e => e.id === 'eB')?.cfu === 6 && w.profilo.corso === 'Fisica (B)' && !w.esami.some(e => e.id === 'e1') && w.profilo.nome === 'Ada Lovelace');
  m1.chiudi();

  // 2. il file dell'altro computer non ancora leggibile (a metà): la barra di B salva una cosa sua, i valori di partenza no
  const v2 = vaultNuovo('rev2'), l2A = cartelle('rev2-A'), l2B = cartelle('rev2-B');
  const m2A = SY.apri({ vault: v2, locale: l2A, dispositivo: A, ritardo: 60e3 });
  const x2 = m2A.per(1); x2.profilo = { nome: 'Ada', corso: 'Fisica', cfuTotali: 120, lode: 30 }; x2.imp.focus = 50; x2.imp.aspetto = 'chiaro'; x2.benvenuto = true; x2.esami.push({ id: 'eA', nome: 'Analisi', cfu: 9, voto: 28 });
  m2A.salva(x2, 1); m2A.scriviOra();
  const f2A = join(v2, '.lode', 'dispositivi', A + '.json'), buono2 = readFileSync(f2A, 'utf8');
  writeFileSync(f2A, buono2.slice(0, 120));
  const m2B = SY.apri({ vault: v2, locale: l2B, dispositivo: B, ritardo: 60e3 });
  const barra = DJ.VUOTO(); Object.assign(barra, U.normalizza(m2B.per(1))); barra.imp.ultimoSuggerimento = 12345;
  m2B.salva(barra, 1); m2B.scriviOra();
  writeFileSync(f2A, buono2); utimesSync(f2A, new Date(), new Date(Date.now() + 3000));
  m2B.ricarica(); m2B.scriviOra(); m2A.ricarica();
  const ok2 = m => { const v = m.vista(); return v.profilo.nome === 'Ada' && v.profilo.cfuTotali === 120 && v.imp.focus === 50 && v.imp.aspetto === 'chiaro' && v.benvenuto === true && v.imp.ultimoSuggerimento === 12345; };
  prova('file dell\'altro computer a metà: i valori di partenza della barra non vincono su profilo e impostazioni veri', ok2(m2B) && ok2(m2A), JSON.stringify([m2A.vista().profilo, m2A.vista().imp, m2A.vista().benvenuto]));
  m2A.chiudi(); m2B.chiudi();

  // 3. campi diversi dello stesso esame (e della stessa sessione) su due computer: restano tutti
  const S3 = U.daDati(DATI(), 1000), v3 = U.normalizza(U.vista(S3));
  const SA3 = clona(S3), a3 = clona(v3); a3.esami[1].voto = 29; a3.esami[1].fatto = true; a3.sessioni[0].min = 55; U.applica(SA3, v3, a3, A, 2000);
  const SB3 = clona(S3), b3x = clona(v3); b3x.esami[1].oreObiettivo = 100; b3x.sessioni[0].esameId = 'e3'; U.applica(SB3, v3, b3x, B, 3000);
  const u3 = U.vista(U.unisci(SA3, SB3)), e23 = u3.esami.find(e => e.id === 'e2'), s13 = u3.sessioni.find(s => s.id === 's1');
  prova('esame: voto da un computer, ore obiettivo dall\'altro, restano tutti e due', e23.voto === 29 && e23.fatto === true && e23.oreObiettivo === 100 && e23.nome === 'Fisica 1', JSON.stringify(e23));
  prova('sessione: minuti da un computer, esame dall\'altro, restano tutti e due', s13.min === 55 && s13.esameId === 'e3');
  const c3 = clona(v3); delete c3.esami[1].oreObiettivo; const SC3 = clona(S3); U.applica(SC3, v3, c3, A, 4000);
  prova('esame: un campo tolto arriva come null', U.vista(SC3).esami[1].oreObiettivo === null && U.vista(SC3).esami[1].nome === 'Fisica 1');

  // 4. una copia in conflitto di dati.json, vecchia ma con l'ora più nuova: non fa risorgere niente
  const p4 = DATI(); p4.esami = p4.esami.filter(e => e.id !== 'e1'); p4.esami.find(e => e.id === 'e2').voto = 30;
  const v4 = join(cartelle('rev4'), 'Lode'); mkdirSync(join(v4, '.lode'), { recursive: true });
  writeFileSync(join(v4, '.lode', 'dati.json'), JSON.stringify(p4)); writeFileSync(join(v4, '.lode', 'dati 2.json'), JSON.stringify(DATI()));
  utimesSync(join(v4, '.lode', 'dati.json'), new Date(), new Date(Date.now() - 60e3));
  SY.segna(v4);
  const m4 = SY.apri({ vault: v4, locale: cartelle('rev4-A'), dispositivo: A, ritardo: 60e3 }); w = m4.vista();
  prova('dati 2.json vecchio con l\'ora più nuova: e1 non torna, il 30 resta, la copia è da parte e segnalata', !w.esami.some(e => e.id === 'e1') && w.esami.find(e => e.id === 'e2').voto === 30 && m4.stato().problemi.some(p => p.file === 'dati 2.json' && p.codice === 'dati_da_parte') && readdirSync(join(v4, '.lode', 'conflitti-risolti')).some(n => n.endsWith('dati 2.json')));
  m4.chiudi();

  // 5. i propri file cifrati con una chiave che non c'è: mai riscritti
  const v5 = vaultNuovo('rev5', DATI()), l5 = cartelle('rev5-A');
  const m5 = SY.apri({ vault: v5, locale: l5, dispositivo: A, ritardo: 60e3 }); m5.scriviOra();
  const k5 = SY.accendiCifratura(v5, l5, 'password lunga 5', LEGGERI); m5.chiudi({ soloLocale: true });
  SY.apri({ vault: v5, locale: l5, dispositivo: A, chiave: k5, ritardo: 60e3 }).chiudi();
  const mio5 = join(v5, '.lode', 'dispositivi', A + '.json'), loc5 = SY.fileLocale(l5, v5, A), byteMio = readFileSync(mio5, 'utf8'), byteLoc = readFileSync(loc5, 'utf8');
  const intatti = () => readFileSync(mio5, 'utf8') === byteMio && readFileSync(loc5, 'utf8') === byteLoc;
  rmSync(SY.fileCifratura(v5));
  const r5a = SY.apri({ vault: v5, locale: l5, dispositivo: A, ritardo: 60e3 });
  prova('cifratura.json tolto, nessuna chiave: bloccato, i propri file cifrati restano com\'erano', r5a.bloccato && r5a.codice === 'chiave_diversa' && intatti() && /cifratura\.json/.test(r5a.errore));
  const r5b = SY.apri({ vault: v5, locale: l5, dispositivo: A, chiave: k5, altreChiavi: [k5], ritardo: 60e3 });
  prova('cifratura.json tolto, con la chiave di prima: bloccato lo stesso (mai riscritti in chiaro)', r5b.bloccato && r5b.codice === 'chiave_diversa' && intatti());
  const k5b = SY.accendiCifratura(v5, l5, 'password nuova 55', LEGGERI);
  const r5c = SY.apri({ vault: v5, locale: l5, dispositivo: A, chiave: k5b, ritardo: 60e3 });
  prova('password «cambiata» (cifratura nuova): i file cifrati con la vecchia restano, e c\'è una copia in copie/illeggibili', r5c.bloccato && r5c.codice === 'chiave_diversa' && intatti() && readdirSync(join(l5, 'copie')).some(n => n.startsWith('illeggibili-')));
  const m5d = SY.apri({ vault: v5, locale: l5, dispositivo: A, chiave: k5b, altreChiavi: [k5], ritardo: 60e3 });
  let nuova5 = false; try { nuova5 = !!SY.leggiDispositivo(readFileSync(mio5, 'utf8'), { chiave: k5b }).S; } catch { }
  prova('… con la chiave di prima (ricordata) si riaprono, niente perso, e si riscrivono con la nuova', !m5d.bloccato && m5d.vista().esami.length === 3 && nuova5);
  m5d.chiudi();

  // 6. due computer accendono la cifratura insieme, con la stessa password: il servizio cloud tiene il cifratura.json di A
  const v6 = vaultNuovo('rev6', DATI()), l6A = cartelle('rev6-A'), l6B = cartelle('rev6-B');
  SY.apri({ vault: v6, locale: l6A, dispositivo: A, ritardo: 60e3 }).chiudi({ soloLocale: false });
  const b6 = SY.apri({ vault: v6, locale: l6B, dispositivo: B, ritardo: 60e3 }); b6.scriviOra();
  const kB6 = SY.accendiCifratura(v6, l6B, 'la stessa password', LEGGERI); b6.chiudi({ soloLocale: true });
  const b6c = SY.apri({ vault: v6, locale: l6B, dispositivo: B, chiave: kB6, ritardo: 60e3 }); const d6 = b6c.per(1); d6.esami.push({ id: 'eB6', nome: 'Solo su B', cfu: 6 }); b6c.salva(d6, 1); b6c.chiudi();
  rmSync(SY.fileCifratura(v6));
  const kA6 = SY.accendiCifratura(v6, l6A, 'la stessa password', LEGGERI);
  const kB6a = SY.chiaveDa(SY.leggiCifratura(v6), 'la stessa password'), fB6 = join(v6, '.lode', 'dispositivi', B + '.json'), byteB6 = readFileSync(fB6, 'utf8');
  const r6 = SY.apri({ vault: v6, locale: l6B, dispositivo: B, chiave: kB6a, ritardo: 60e3 });
  prova('cifratura accesa su due computer: B resta bloccato e non riscrive i suoi file', r6.bloccato && r6.codice === 'chiave_diversa' && readFileSync(fB6, 'utf8') === byteB6);
  const b6d = SY.apri({ vault: v6, locale: l6B, dispositivo: B, chiave: kB6a, altreChiavi: SY.chiaviVecchie(v6, l6B, 'la stessa password'), ritardo: 60e3 });
  prova('… con la stessa password Lode ritrova la chiave di prima: l\'esame fatto su B c\'è', !b6d.bloccato && b6d.vista().esami.some(e => e.id === 'eB6'));
  b6d.chiudi();
  const a6 = SY.apri({ vault: v6, locale: l6A, dispositivo: A, chiave: kA6, ritardo: 60e3 });
  prova('… e arriva ad A con la chiave del vault', a6.vista().esami.some(e => e.id === 'eB6'));
  a6.chiudi();
  writeFileSync(join(v6, '.lode', 'cifratura 2.json'), readFileSync(SY.fileCifratura(v6)));
  const a6b = SY.apri({ vault: v6, locale: l6A, dispositivo: A, chiave: kA6, ritardo: 60e3 });
  prova('una «cifratura 2.json» si segnala', a6b.stato().problemi.some(p => p.file === 'cifratura 2.json' && p.codice === 'cifratura_doppia'));
  a6b.chiudi();

  // 7. vault cifrato: il proprio file messo in chiaro da qualcun altro (con un intruso e una lapide) non entra
  const fA6 = join(v6, '.lode', 'dispositivi', A + '.json');
  const Si = U.daDati({ v: 1, esami: [{ id: 'intruso', nome: 'Intruso', cfu: 6 }] }, Date.now() + 1000); Si.x['esami/e1'] = [Date.now() + 5000, A];
  writeFileSync(fA6, SY.serializza(Si, { dispositivo: A }));
  const a6c = SY.apri({ vault: v6, locale: l6A, dispositivo: A, chiave: kA6, ritardo: 60e3 }); w = a6c.vista();
  prova('vault cifrato: il proprio file in chiaro infilato nel vault non entra (niente intruso, niente lapide)', !w.esami.some(e => e.id === 'intruso') && w.esami.some(e => e.id === 'e1') && readdirSync(join(l6A, 'copie')).some(n => n.startsWith('illeggibili-')));
  let pulito = false; try { const x = JSON.parse(readFileSync(fA6, 'utf8')); pulito = !!x.cifrato && !SY.leggiDispositivo(JSON.stringify(x), { chiave: kA6 }).S.r['esami/intruso']; } catch { }
  prova('… e il file nel vault torna cifrato, senza l\'intruso', pulito);
  a6c.chiudi();

  // 8. la chiave di un vault cifrato non cifra mai i file di un vault senza password
  const v8 = vaultNuovo('rev8'), l8 = cartelle('rev8-A');
  const m8 = SY.apri({ vault: v8, locale: l8, dispositivo: A, chiave: kA6, ritardo: 60e3 }); const d8 = m8.per(1); d8.esami.push({ id: 'e8', nome: 'Solo nel vault X', cfu: 6 }); m8.salva(d8, 1); m8.scriviOra(); m8.chiudi();
  prova('chiave di un altro vault su un vault senza password: il file resta in chiaro e leggibile', !JSON.parse(readFileSync(join(v8, '.lode', 'dispositivi', A + '.json'), 'utf8')).cifrato);
  // 9. la copia locale è legata al vault: un vault nuovo non riceve i dati di quello di prima
  const v9 = vaultNuovo('rev9'), m9 = SY.apri({ vault: v9, locale: l8, dispositivo: A, ritardo: 60e3 }); m9.scriviOra(); m9.chiudi();
  prova('copia locale legata al vault: i dati del vault di prima non entrano nel nuovo', !m9.vista().esami.some(e => e.id === 'e8') && !readFileSync(join(v9, '.lode', 'dispositivi', A + '.json'), 'utf8').includes('Solo nel vault X'));
  // 10. il segno tolto (o non ancora scaricato) con i file dei computer già lì: la sincronizzazione resta accesa
  rmSync(SY.fileSegno(v8));
  prova('segno mancante ma file dei computer presenti: resta accesa (mai ripartire vuoti)', SY.attiva(v8) && !SY.attiva(join(RADICE, 'non-esiste')));

  // 11. timbri al limite in un file di un altro computer: scartati e segnalati, e le modifiche fatte dopo restano al riavvio
  const v11 = vaultNuovo('rev11'), l11 = cartelle('rev11-A');
  mkdirSync(join(v11, '.lode', 'dispositivi'), { recursive: true });
  writeFileSync(join(v11, '.lode', 'dispositivi', C + '.json'), SY.serializza(U.daDati({ v: 1, esami: [{ id: 'eF', nome: 'Futuro', cfu: 6 }] }, 8.64e15), { dispositivo: C }));
  const m11 = SY.apri({ vault: v11, locale: l11, dispositivo: A, ritardo: 60e3 });
  prova('timbri troppo nel futuro: scartati e segnalati', !m11.vista().esami.some(e => e.id === 'eF') && m11.stato().problemi.some(p => p.file === C + '.json' && p.codice === 'timbri'));
  const d11 = m11.per(1); d11.esami.push({ id: 'eN', nome: 'Nuovo', cfu: 6 }); m11.salva(d11, 1); m11.chiudi();
  const m11b = SY.apri({ vault: v11, locale: l11, dispositivo: A, ritardo: 60e3 });
  prova('… e la modifica fatta dopo resta al riavvio', m11b.vista().esami.some(e => e.id === 'eN')); m11b.chiudi();
  prova('orologio ibrido: mai un timbro oltre il limite', U.timbro({ o: [8.64e15, A] }, A)[0] <= 8.64e15);

  // 12. password arrivata dall'altro computer mentre la finestra lavora: allo sblocco le modifiche fatte intanto entrano, a tre
  // vie dalla versione che la finestra aveva (main.mjs: bloccaFinestre e sbloccaFinestre)
  const v12 = vaultNuovo('rev12', DATI()), l12A = cartelle('rev12-A'), l12B = cartelle('rev12-B');
  const m12 = SY.apri({ vault: v12, locale: l12A, dispositivo: A, ritardo: 60e3 }), m12B = SY.apri({ vault: v12, locale: l12B, dispositivo: B, ritardo: 60e3 });
  const fin = m12.per(7), base12 = m12.baseDi(7); m12.chiudi({ soloLocale: true });
  fin.esami.push({ id: 'eChim', nome: 'Chimica 2', cfu: 6 });
  const bb = m12B.per(1); bb.esami = bb.esami.filter(e => e.id !== 'e2'); m12B.salva(bb, 1); m12B.scriviOra();
  const m12c = SY.apri({ vault: v12, locale: l12A, dispositivo: A, ritardo: 60e3 });
  m12c.salva(fin, 7, base12); w = m12c.vista();
  prova('sblocco: la modifica fatta mentre era bloccato entra, e quello che l\'altro ha cancellato intanto non torna', w.esami.some(e => e.id === 'eChim') && !w.esami.some(e => e.id === 'e2') && w.esami.some(e => e.id === 'e1'));
  m12c.chiudi(); m12B.chiudi();
}

/* ---------- spostare il vault nella cartella cloud ---------- */
const vaultFinto = dir => {
  mkdirSync(join(dir, 'Lezioni', 'Fisica 1'), { recursive: true }); mkdirSync(join(dir, '.lode'), { recursive: true }); mkdirSync(join(dir, '.obsidian'), { recursive: true }); mkdirSync(join(dir, 'Allegati'), { recursive: true });
  writeFileSync(join(dir, 'Home.md'), '# Home\n'); writeFileSync(join(dir, 'Lezioni', 'Fisica 1', '2026-10-01 Fisica 1.md'), '# Lezione\n- **Ohm**: V = RI\n');
  writeFileSync(join(dir, '.lode', 'dati.json'), JSON.stringify(DATI())); writeFileSync(join(dir, '.obsidian', 'app.json'), '{}');
  writeFileSync(join(dir, 'Allegati', 'foto.bin'), Buffer.alloc(300_000, 7));
  for (let i = 0; i < 60; i++) writeFileSync(join(dir, 'Lezioni', 'Fisica 1', `nota ${i}.md`), `# ${i}\n` + 'x'.repeat(i * 50));
};
const contaFile = dir => { let n = 0; const giro = d => { for (const x of readdirSync(d, { withFileTypes: true })) x.isDirectory() ? giro(join(d, x.name)) : n++; }; giro(dir); return n; };
{
  const casa = cartelle('casa1'), cloud = cartelle('casa1/Dropbox'), da = join(casa, 'Documenti', 'Lode'), loc = cartelle('pc-sposta1');
  vaultFinto(da); const n = contaFile(da);
  let conf = da;
  const r = await SY.spostaVault({ da, cartella: cloud, locale: loc, passa: x => { conf = x; } });
  prova('spostamento: il vault è nella cartella cloud, con tutti i file e il segno', conf === join(cloud, 'Lode') && contaFile(conf) === n + 1 && SY.attiva(conf) && SY.confrontaCartelle(r.copia, conf, { escludi: f => f === join('.lode', 'sincronizzazione.json') }).diversi.length === 0, `${contaFile(conf)} ${n}`);
  prova('spostamento: la vecchia cartella resta come «Lode (copia prima della sincronizzazione)»', r.copia === join(casa, 'Documenti', 'Lode (copia prima della sincronizzazione)') && existsSync(r.copia) && !existsSync(da) && contaFile(r.copia) === n);
  prova('spostamento: niente registro di bordo né cartelle temporanee rimaste', !existsSync(join(loc, 'spostamento.json')) && !readdirSync(cloud).some(x => x.includes('copia-in-corso')));
  const g = await SY.spostaVault({ da: conf, cartella: cloud, locale: loc, passa: () => { throw new Error('non doveva passare'); } });
  prova('spostamento: vault già nella cartella cloud → niente da spostare', g.giaDentro === true);
  let dentro = null; try { await SY.spostaVault({ da: conf, cartella: join(conf, 'Lezioni'), locale: loc, passa: () => { } }); } catch (x) { dentro = x.codice; }
  prova('spostamento: una cartella dentro il vault è rifiutata', dentro === 'dentro');
  // «Documenti» che è un collegamento dentro la cartella cloud (sul Mac: Scrivania e Documenti in iCloud): niente da spostare
  const reale = join(cloud, 'Documents'); vaultFinto(join(reale, 'Lode'));
  let link = null; try { symlinkSync(reale, join(casa, 'DocumentiLink'), 'junction'); link = join(casa, 'DocumentiLink', 'Lode'); } catch { }
  if (link) { const gl = await SY.spostaVault({ da: link, cartella: cloud, locale: loc, passa: () => { throw new Error('non doveva passare'); } }); prova('spostamento: Documenti già in iCloud (collegamento): niente da spostare', gl.giaDentro === true); }
  else console.log('(collegamento non permesso su questo sistema: prova saltata)');
  // un secondo vault «Lode» nella stessa cartella cloud: il nuovo si chiama «Lode 2», niente sovrascritto
  const da2 = join(casa, 'Altro', 'Lode'); vaultFinto(da2);
  const r2 = await SY.spostaVault({ da: da2, cartella: cloud, locale: loc, passa: () => { } });
  prova('spostamento: c\'è già un «Lode» nella cartella → «Lode 2», il primo intatto', r2.vault === join(cloud, 'Lode 2') && contaFile(join(cloud, 'Lode')) === n + 1);
}
// interrotto a ogni passo (come se saltasse la corrente): al riavvio la configurazione punta sempre a un vault completo
for (const fase of ['meta-copia', 'copia', 'verifica', 'rename', 'passaggio']) {
  const casa = cartelle('casa-' + fase), cloud = cartelle(`casa-${fase}/iCloud`), da = join(casa, 'Documenti', 'Lode'), loc = cartelle('pc-' + fase);
  vaultFinto(da); const n = contaFile(da), impronte = SY.confrontaCartelle(da, da);
  let conf = da, errore = null;
  try { await SY.spostaVault({ da, cartella: cloud, locale: loc, passa: x => { conf = x; }, ferma: fase }); } catch (x) { errore = x.codice; }
  const completo = v => existsSync(v) && contaFile(v) >= n && existsSync(join(v, '.lode', 'dati.json')) && readFileSync(join(v, 'Lezioni', 'Fisica 1', '2026-10-01 Fisica 1.md'), 'utf8').includes('Ohm');
  prova(`spostamento interrotto («${fase}»): subito dopo la configurazione punta a un vault completo`, errore === 'interrotto' && completo(conf), `${errore} ${conf}`);
  const r = SY.riprendiSpostamento({ locale: loc, vaultAttuale: conf, passa: x => { conf = x; } });
  const atteso = ['meta-copia', 'copia', 'verifica'].includes(fase) ? 'annullato' : 'finito';
  const dopo = atteso === 'annullato' ? da : join(cloud, 'Lode');
  prova(`spostamento interrotto («${fase}»): al riavvio ${atteso === 'annullato' ? 'si torna al vault di prima' : 'si finisce'}, niente perso`, r.esito === atteso && conf === dopo && completo(conf) && SY.confrontaCartelle(conf, atteso === 'annullato' ? conf : r.copia, { escludi: f => f === join('.lode', 'sincronizzazione.json') }).diversi.length === 0 && impronte.n === n, JSON.stringify(r));
  prova(`spostamento interrotto («${fase}»): niente copie a metà nella cartella cloud`, !readdirSync(cloud).some(x => x.includes('copia-in-corso')) && !existsSync(join(loc, 'spostamento.json')), readdirSync(cloud).join());
  if (atteso === 'finito') prova(`spostamento interrotto («${fase}»): la vecchia cartella è la copia di prima`, !existsSync(da) && existsSync(join(casa, 'Documenti', 'Lode (copia prima della sincronizzazione)')));
}
{
  // interrotto dopo il rename, ma intanto lo studente ha scritto nel vecchio vault con Obsidian: si resta sul vecchio, la copia va da parte
  const casa = cartelle('casa-cambiato'), cloud = cartelle('casa-cambiato/OneDrive'), da = join(casa, 'Documenti', 'Lode'), loc = cartelle('pc-cambiato');
  vaultFinto(da); let conf = da;
  try { await SY.spostaVault({ da, cartella: cloud, locale: loc, passa: x => { conf = x; }, ferma: 'rename' }); } catch { }
  writeFileSync(join(da, 'Home.md'), '# Home\nscritto dopo, in Obsidian\n');
  const r = SY.riprendiSpostamento({ locale: loc, vaultAttuale: conf, passa: x => { conf = x; } });
  prova('interrotto e poi cambiato a mano: resta il vault di prima (con la nota nuova), la copia non finita va da parte', r.esito === 'annullato' && conf === da && readFileSync(join(da, 'Home.md'), 'utf8').includes('scritto dopo') && existsSync(r.copia || '') && /copia non finita/.test(r.copia), JSON.stringify(r));
}

/* ---------- le cartelle cloud ---------- */
{
  const fs = mappa => ({ esiste: p => mappa.has(p) || [...mappa.keys()].some(k => k.startsWith(p + '/') || k.startsWith(p + '\\')), elenca: d => [...new Set([...mappa.keys()].filter(k => k.startsWith(d + '/') || k.startsWith(d + '\\')).map(k => k.slice(d.length + 1).split(/[\\/]/)[0]))] });
  const mac = SY.cartelleCloud({ piattaforma: 'darwin', casa: '/Users/studente', env: {}, ...fs(new Map([['/Users/studente/Library/Mobile Documents/com~apple~CloudDocs', 1], ['/Users/studente/Library/CloudStorage/OneDrive-Personale', 1], ['/Users/studente/Library/CloudStorage/Dropbox', 1], ['/Users/studente/Library/CloudStorage/GoogleDrive-a@b.it/Il mio Drive', 1]])) });
  prova('cartelle cloud su Mac: iCloud Drive, OneDrive, Dropbox, Google Drive (dentro «Il mio Drive»)', mac.map(c => c.servizio).join() === 'iCloud Drive,Dropbox,Google Drive,OneDrive' && mac.find(c => c.servizio === 'Google Drive').percorso.endsWith('/Il mio Drive'), JSON.stringify(mac));
  const win = SY.cartelleCloud({ piattaforma: 'win32', casa: 'C:\\Users\\studente', env: { OneDrive: 'C:\\Users\\studente\\OneDrive - Università' }, ...fs(new Map([['C:\\Users\\studente\\OneDrive - Università', 1], ['C:\\Users\\studente\\Dropbox', 1], ['C:\\Users\\studente\\iCloudDrive', 1]])) });
  prova('cartelle cloud su Windows: variabile OneDrive (una volta sola), Dropbox, iCloudDrive', win.map(c => c.servizio).join() === 'OneDrive,Dropbox,iCloud Drive', JSON.stringify(win));
  const lin = SY.cartelleCloud({ piattaforma: 'linux', casa: '/home/studente', env: {}, ...fs(new Map([['/home/studente/Dropbox', 1], ['/home/studente/Sync', 1]])) });
  prova('cartelle cloud su Linux: Dropbox e Syncthing', lin.map(c => c.servizio).join() === 'Dropbox,Syncthing');
  prova('servizio dal percorso', SY.servizioDi('/Users/studente/Library/Mobile Documents/com~apple~CloudDocs/Lode') === 'iCloud Drive' && SY.servizioDi('C:\\Users\\studente\\OneDrive\\Lode') === 'OneDrive' && SY.servizioDi('/home/studente/Documenti/Lode') === null);
  prova('nomi delle copie in conflitto', SY.originaleDi('dati 2.json') === 'dati.json' && SY.originaleDi('dati (conflicted copy 2026-10-02).json') === 'dati.json' && SY.originaleDi('dati-DESKTOP-AB12CD.json') === 'dati.json' && SY.originaleDi('dati (1).json') === 'dati.json' && SY.originaleDi('dati.sync-conflict-20261002-101010-ABCDEFG.json') === 'dati.json' && SY.originaleDi('dati.json') === null && SY.originaleDi(`${A}.json`) === null);
}

/* ---------- giro 1 di revisione: orologi, carte, basi che non si trovano, segnaposti, «Smetti di sincronizzare» ---------- */
{
  const vNuovo = nome => { const v = join(cartelle(nome), 'Lode'); mkdirSync(join(v, '.lode'), { recursive: true }); SY.segna(v); return v; };
  // l'orologio di questo computer indietro di anni (batteria scarica): i suoi registri non si scartano, e una modifica fatta
  // allora non li cancella
  const v = vNuovo('g1-orologio'), lB = cartelle('g1-orologio-B');
  const mB = SY.apri({ vault: v, locale: lB, dispositivo: B, ritardo: 60e3 });
  const x = mB.per(1); x.esami.push({ id: 'e1', nome: 'Analisi', cfu: 9, voto: null }, { id: 'e2', nome: 'Fisica', cfu: 9, voto: null }); x.carte.push({ id: 'c1', esameId: 'e1', fronte: 'f', retro: 'r', ease: 2.5, int: 0, rip: 0, scad: '2026-10-02', creata: 1 });
  mB.salva(x, 1); mB.scriviOra(); mB.chiudi();
  const vero = Date.now; Date.now = () => Date.parse('2020-01-01');
  let mB2;
  try {
    mB2 = SY.apri({ vault: v, locale: lB, dispositivo: B, ritardo: 60e3, ora: () => Date.now() });
    const y = mB2.per(1); y.imp.focus = 40; mB2.salva(y, 1); mB2.scriviOra();
    prova('orologio indietro di anni: i propri registri restano (niente scartati), e una modifica non li cancella', mB2.vista().esami.length === 2 && mB2.vista().carte.length === 1 && mB2.vista().imp.focus === 40, JSON.stringify(mB2.vista().esami) + JSON.stringify(mB2.stato().problemi));
    mB2.chiudi();
  } finally { Date.now = vero; }
  const mB3 = SY.apri({ vault: v, locale: lB, dispositivo: B, ritardo: 60e3 });
  prova('… e con la data giusta ci sono ancora (copia locale e file nel vault)', mB3.vista().esami.length === 2 && mB3.vista().carte.length === 1 && mB3.vista().imp.focus === 40);
  // l'orologio di un altro computer avanti di 13 mesi: questo computer non perde i suoi dati, e quello non perde i suoi
  const lA = cartelle('g1-orologio-A'), avanti = Date.now() + 395 * 864e5;
  const mA = SY.apri({ vault: v, locale: lA, dispositivo: A, ritardo: 60e3, ora: () => avanti });
  const z = mA.per(1); z.esami.find(e => e.id === 'e2').voto = 28; z.esami.push({ id: 'e3', nome: 'Analisi 2', cfu: 6, voto: null }); mA.salva(z, 1); mA.scriviOra(); mA.chiudi();
  mB3.ricarica();
  prova('orologio di un altro avanti di 13 mesi: qui non spariscono gli esami (il suo file si segnala)', mB3.vista().esami.length >= 2 && mB3.stato().problemi.some(p => p.codice === 'timbri'), JSON.stringify(mB3.vista().esami.map(e => e.id)) + JSON.stringify(mB3.stato().problemi));
  const mA2 = SY.apri({ vault: v, locale: lA, dispositivo: A, ritardo: 60e3 });
  prova('… e quel computer, con la data corretta, vede ancora le sue modifiche', mA2.vista().esami.length === 3 && mA2.vista().esami.find(e => e.id === 'e2')?.voto === 28, JSON.stringify(mA2.vista().esami));
  mA2.chiudi(); mB3.chiudi();

  // una carta cancellata su un computer e corretta nel testo sull'altro torna con il suo ripasso (scadenza compresa)
  const base = DATI(); base.imp.chiave = '';
  const S0 = U.daDati(base, 1000), Sa = U.unisci(U.vuoto(), S0), Sb = U.unisci(U.vuoto(), S0);
  const da = U.normalizza(U.vista(Sa)); const nA = clona(da); nA.carte = nA.carte.filter(c => c.id !== 'c2'); U.applica(Sa, da, nA, A, 2000);
  const db = U.normalizza(U.vista(Sb)); const nB = clona(db); nB.carte.find(c => c.id === 'c2').retro = 'ΔU = Q − W'; U.applica(Sb, db, nB, B, 3000);
  const c2 = U.vista(U.unisci(Sa, Sb)).carte.find(c => c.id === 'c2');
  prova('carta cancellata su A e corretta su B: torna con ease, int, rip e scad', c2 && c2.retro === 'ΔU = Q − W' && c2.scad === '2026-10-08' && c2.int === 6 && c2.rip === 2, JSON.stringify(c2));

  // campi diversi della stessa carta o lezione cambiati offline su due computer: restano tutti e due
  const D4 = U.normalizza({ v: 1, carte: [{ id: 'c1', esameId: 'e1', fronte: 'Ohm', retro: 'V = RI', ease: 2.5, int: 1, rip: 1, scad: '2026-10-20', creata: 1 }], lezioni: [{ id: 'l1', titolo: 'Intro', stelle: [] }] });
  const S4 = U.daDati(D4, 1000), S4a = U.unisci(U.vuoto(), S4), S4b = U.unisci(U.vuoto(), S4);
  const a4 = clona(D4); a4.carte[0].fronte = 'Legge di Ohm'; a4.lezioni[0].stelle = ['a', 'b']; U.applica(S4a, D4, a4, A, 2000);
  const b4 = clona(D4); b4.carte[0].retro = 'V = R·I'; b4.lezioni[0].titolo = 'Introduzione'; U.applica(S4b, D4, b4, B, 3000);
  const w4 = U.vista(U.unisci(S4a, S4b));
  prova('fronte cambiato su A e retro su B, stelle su A e titolo su B: restano tutti', w4.carte[0].fronte === 'Legge di Ohm' && w4.carte[0].retro === 'V = R·I' && w4.carte[0].scad === '2026-10-20' && w4.lezioni[0].titolo === 'Introduzione' && w4.lezioni[0].stelle.join() === 'a,b', JSON.stringify(w4.carte) + JSON.stringify(w4.lezioni));

  // applica senza cancellazioni: quello che manca non diventa una lapide, i contatori non si azzerano
  const S1 = U.daDati(base, 1000), b1 = U.normalizza(U.vista(S1)), quasiVuoto = U.normalizza({ v: 1, esami: [{ id: 'eN', nome: 'Nuovo', cfu: 6 }] });
  U.applica(S1, b1, quasiVuoto, A, 5000, { senzaCancellazioni: true });
  const w1 = U.vista(S1);
  prova('applica senza cancellazioni: niente lapidi né azzeramenti, l\'aggiunta entra', Object.keys(S1.x).length === 0 && w1.esami.length === 4 && w1.carte.length === 2 && w1.memoria['fisica 1|ohm'].giuste === 3);

  // una finestra con un numero di versione che il motore non conosce (un altro vault): niente si cancella, e le si rimanda la vista
  const v6 = vNuovo('g1-rev'), l6 = cartelle('g1-rev-A');
  const m6 = SY.apri({ vault: v6, locale: l6, dispositivo: A, ritardo: 60e3 });
  const p6 = m6.per(1); p6.esami.push({ id: 'n1', nome: 'Nuovo 1', cfu: 6 }, { id: 'n2', nome: 'Nuovo 2', cfu: 6 }); m6.salva(p6, 1);
  const r6 = m6.salva({ ...SY.vuotoBarra(), esami: [{ id: 'old', nome: 'Vecchio', cfu: 6 }], __rev: 999999 }, 2);
  prova('salvataggio con una versione sconosciuta: niente lapidi, e la finestra riceve la vista', r6.perChi && Object.keys(m6._stato().x).length === 0 && ['n1', 'n2'].every(id => m6.vista().esami.some(e => e.id === id)), JSON.stringify(m6.vista().esami.map(e => e.id)));
  // la versione di un motore di prima sullo stesso vault (la password appena accesa) si trova ancora: a tre vie, niente si perde
  const p7 = m6.per(3); m6.chiudi();
  const m7 = SY.apri({ vault: v6, locale: l6, dispositivo: A, ritardo: 60e3 });
  const q7 = m7.per(9); q7.esami = q7.esami.filter(e => e.id !== 'n1'); m7.salva(q7, 9);   // intanto qualcuno cancella n1
  p7.profilo.corso = 'Astrofisica'; m7.salva(p7, 3);
  prova('versione di un motore di prima sullo stesso vault: base trovata, a tre vie (la cancellazione resta, n2 resta)', m7.vista().profilo.corso === 'Astrofisica' && !m7.vista().esami.some(e => e.id === 'n1') && m7.vista().esami.some(e => e.id === 'n2'), JSON.stringify(m7.vista().esami.map(e => e.id)));
  m7.chiudi();

  // segnaposti di iCloud: la sincronizzazione resta accesa (mai ripartire vuoti da dati.json)
  const v8 = join(cartelle('g1-icloud'), 'Lode'); mkdirSync(join(v8, '.lode', 'dispositivi'), { recursive: true });
  writeFileSync(join(v8, '.lode', '.sincronizzazione.json.icloud'), 'x');
  const v9 = join(cartelle('g1-icloud2'), 'Lode'); mkdirSync(join(v9, '.lode', 'dispositivi'), { recursive: true });
  writeFileSync(join(v9, '.lode', 'dispositivi', `.${A}.json.icloud`), 'x');
  prova('segnaposti di iCloud (.sincronizzazione.json.icloud, .<id>.json.icloud): accesa', SY.attiva(v8) && SY.attiva(v9));

  // cifratura.json con parametri pesanti (2 GB di scrypt): rifiutato
  const v10 = vNuovo('g1-scrypt'); const k10 = SY.creaCifratura('password lunga 10', LEGGERI).info;
  writeFileSync(SY.fileCifratura(v10), JSON.stringify({ ...k10, N: 2 ** 20, r: 16, p: 4 }));
  let pesante = null; try { SY.leggiCifratura(v10); } catch (e) { pesante = e.codice; }
  prova('cifratura.json con parametri troppo pesanti (N=2^20, r=16, p=4): rifiutato', pesante === 'cifratura');

  // password diverse: B ha acceso la cifratura con P2, poi il servizio cloud tiene la cifratura.json di A (P1). Con P1 sola B
  // resta bloccato (chiave_diversa); la password di prima (P2) ritrova la chiave di B con la copia salvata sul computer
  const vP = vNuovo('g1-pw'), lPA = cartelle('g1-pw-A'), lPB = cartelle('g1-pw-B');
  const pB = SY.apri({ vault: vP, locale: lPB, dispositivo: B, ritardo: 60e3 }); const xb = pB.per(1); xb.esami.push({ id: 'eB', nome: 'Biologia', cfu: 6 }); pB.salva(xb, 1); pB.scriviOra();
  const k2 = SY.accendiCifratura(vP, lPB, 'password di B lunga', LEGGERI); pB.chiudi({ soloLocale: true });
  const pB2 = SY.apri({ vault: vP, locale: lPB, dispositivo: B, chiave: k2, ritardo: 60e3 }); pB2.scriviOra(); pB2.chiudi();
  rmSync(SY.fileCifratura(vP)); const k1 = SY.accendiCifratura(vP, lPA, 'password di A lunga', LEGGERI);
  const conP1 = SY.apri({ vault: vP, locale: lPB, dispositivo: B, chiave: k1, ritardo: 60e3 });
  const vecchie = SY.chiaviVecchie(vP, lPB, 'password di B lunga');
  const pB3 = SY.apri({ vault: vP, locale: lPB, dispositivo: B, chiave: k1, altreChiavi: vecchie, ritardo: 60e3 });
  prova('password diverse: con quella del vault sola, bloccato; con anche quella di prima di questo computer, si apre e niente si perde', conP1.bloccato && conP1.codice === 'chiave_diversa' && /password che usavi su questo computer/.test(conP1.errore) && vecchie.length === 1 && !pB3.bloccato && pB3.vista().esami.some(e => e.id === 'eB'), JSON.stringify({ c: conP1.codice, n: vecchie.length, b: pB3.bloccato }));
  pB3.chiudi?.();

  // «Smetti di sincronizzare»: A smette, B (aperto) aveva una modifica che A non aveva ancora letto; C era chiuso con una sua
  const vS = vNuovo('g1-smetti'), lsA = cartelle('g1-smetti-A'), lsB = cartelle('g1-smetti-B'), lsC = cartelle('g1-smetti-C');
  const sA = SY.apri({ vault: vS, locale: lsA, dispositivo: A, ritardo: 60e3 });
  const dA = sA.per(1); dA.esami.push({ id: 'eA', nome: 'Analisi', cfu: 9, voto: 27 }); dA.profilo.nome = 'Ada'; sA.salva(dA, 1); sA.scriviOra();
  const sB = SY.apri({ vault: vS, locale: lsB, dispositivo: B, ritardo: 60e3 }), sC = SY.apri({ vault: vS, locale: lsC, dispositivo: C, ritardo: 60e3 });
  const dC = sC.per(1); dC.esami.push({ id: 'eC', nome: 'Chimica', cfu: 6 }); sC.salva(dC, 1); sC.chiudi({ soloLocale: true });   // C: solo nella sua copia locale
  sA.ricarica();
  const dB = sB.per(1); dB.esami.push({ id: 'eB', nome: 'Biologia', cfu: 6 }); sB.salva(dB, 1);   // non ancora scritto: A non lo vede
  const rS = SY.smetti({ vault: vS, locale: lsA, motore: sA });
  const dj = () => JSON.parse(readFileSync(join(vS, '.lode', 'dati.json'), 'utf8'));
  prova('smetti: dati.json con l\'unione, segno spento, archivio nel vault e copia sul computer', dj().esami.some(e => e.id === 'eA') && dj().profilo.nome === 'Ada' && !SY.attiva(vS) && !!SY.spenta(vS) && !existsSync(join(vS, '.lode', 'dispositivi')) && existsSync(join(vS, '.lode', rS.archivio, 'dispositivi', A + '.json')) && existsSync(join(lsA, 'copie', rS.archivio, 'sincronizzazione.json')));
  sB.scriviOra();   // B scrive ancora il suo file prima di accorgersene
  const rB = SY.seguiSpenta({ vault: vS, locale: lsB, dispositivo: B, S: sB._stato() }); sB.chiudi({ niente: true });
  prova('B se ne accorge: la sua modifica arrivata dopo entra in dati.json, niente si perde', rB.esito === 'unito' && ['eA', 'eB'].every(id => dj().esami.some(e => e.id === id)) && !existsSync(join(vS, '.lode', 'dispositivi', B + '.json')), JSON.stringify(rB) + JSON.stringify(dj().esami.map(e => e.id)));
  const rC = SY.seguiSpenta({ vault: vS, locale: lsC, dispositivo: C });
  prova('C, chiuso durante lo stop: alla riapertura quello che sapeva solo lui (copia locale) entra in dati.json', rC.esito === 'unito' && ['eA', 'eB', 'eC'].every(id => dj().esami.some(e => e.id === id)), JSON.stringify(rC) + JSON.stringify(dj().esami.map(e => e.id)));
  // dopo lo stop A lavora con dati.json; un computer che segue dopo non riporta indietro né cancella quelle modifiche
  const dopo = dj(); dopo.esami = dopo.esami.filter(e => e.id !== 'eA'); dopo.esami.push({ id: 'eZ', nome: 'Zoologia', cfu: 6 }); writeFileSync(join(vS, '.lode', 'dati.json'), JSON.stringify(dopo));
  // un computer bloccato (password non scritta) con una modifica in attesa: entra in dati.json
  const lsD = cartelle('g1-smetti-D'), rD = SY.seguiSpenta({ vault: vS, locale: lsD, dispositivo: 'dddddddddddddddd', inAttesa: [{ base: SY.vuotoBarra(), d: { ...SY.vuotoBarra(), esami: [{ id: 'eD', nome: 'Diritto', cfu: 6 }] } }] });
  prova('un computer bloccato con una modifica in attesa: entra in dati.json; le modifiche fatte dopo lo stop restano', rD.esito === 'unito' && ['eB', 'eC', 'eZ', 'eD'].every(id => dj().esami.some(e => e.id === id)) && !dj().esami.some(e => e.id === 'eA'), JSON.stringify(rD) + JSON.stringify(dj().esami.map(e => e.id)));
  const rC2 = SY.seguiSpenta({ vault: vS, locale: lsC, dispositivo: C });
  prova('… una volta sola (la copia locale è segnata), e riaccendere toglie il segno dello stop', rC2.esito === 'uguale' && SY.segna(vS) && SY.attiva(vS) && !SY.spenta(vS));
}

/* ---------- giro 2 di revisione: perdite di dati e cifratura ---------- */
{
  const vN = nome => { const v = join(cartelle(nome), 'Lode'); mkdirSync(join(v, '.lode'), { recursive: true }); return v; };
  const dj = v => JSON.parse(readFileSync(join(v, '.lode', 'dati.json'), 'utf8'));
  // 1. un computer rimasto spento giorni (ha letto v1) scrive dati.json dopo che l'altro ha migrato v4: la base è quella letta (v1),
  // non l'ultimo dati.migrato. Entra solo la sua modifica; quello che A ha fatto fra v1 e v4 resta
  {
    const v = vN('g2-vecchio'), lA = cartelle('g2-vecchio-A'), lB = cartelle('g2-vecchio-B');
    const v1 = DATI(); v1.imp.chiave = '';
    const v4 = clona(v1); v4.esami[0].voto = 28; v4.esami.push({ id: 'e4', nome: 'Ottica', cfu: 6, voto: null }); v4.carte.push({ id: 'c3', esameId: 'e2', fronte: 'Snell', retro: 'n1 sin = n2 sin', ease: 2.5, int: 0, rip: 0, scad: '2026-10-09', creata: 3 }); v4.sessioni.push({ id: 's3', esameId: 'e4', inizio: 1759500000000, min: 40 });
    writeFileSync(join(v, '.lode', 'dati.json'), JSON.stringify(v4)); SY.segna(v);
    const mA = SY.apri({ vault: v, locale: lA, dispositivo: A, ritardo: 60e3 }); mA.scriviOra();
    const b = U.normalizza(clona(v1)); b.esami.push({ id: 'eB', nome: 'Inglese', cfu: 3, voto: null }); const miei = new Map([[SY.firmaDati(b), { base: v1 }]]);
    writeFileSync(join(v, '.lode', 'dati.json'), JSON.stringify(b));
    const mB = SY.apri({ vault: v, locale: lB, dispositivo: B, ritardo: 60e3, datiMiei: d => miei.get(SY.firmaDati(d)) || false }); mB.scriviOra(); mA.ricarica();
    const w = mA.vista();
    prova('giro 2: dati.json di un computer rimasto indietro: entra solo la sua modifica, niente di quello fatto dopo si perde', w.esami.find(e => e.id === 'e1')?.voto === 28 && w.esami.some(e => e.id === 'e4') && w.esami.some(e => e.id === 'eB') && w.carte.length === 3 && w.sessioni.length === 3, JSON.stringify(w.esami.map(e => [e.id, e.voto])) + w.carte.length + '/' + w.sessioni.length);
    // senza dati.migrato (non ancora arrivato): stessa base, stesso risultato (niente valori riportati indietro)
    const b2 = clona(b); b2.carte[0].retro = 'V = R·I'; miei.set(SY.firmaDati(b2), { base: v1 });
    for (const n of readdirSync(join(v, '.lode'))) if (/^dati\.migrato-/.test(n)) rmSync(join(v, '.lode', n));
    writeFileSync(join(v, '.lode', 'dati.json'), JSON.stringify(b2)); mB.ricarica(); mB.scriviOra(); mA.ricarica();
    const w2 = mA.vista();
    prova('giro 2: … anche senza dati.migrato: il voto di A resta, entra il retro corretto da B', w2.esami.find(e => e.id === 'e1')?.voto === 28 && w2.carte.find(c => c.id === 'c1')?.retro === 'V = R·I' && w2.sessioni.length === 3);
    mA.chiudi(); mB.chiudi();
  }
  // 2. modifiche fatte coi dati bloccati (base = il D vuoto della barra): un record SM-2 rifatto da capo non scrive sopra quello vero
  {
    const v = vN('g2-bloccati'), lA = cartelle('g2-bloccati-A'); const d = DATI(); d.memoria['fisica 1|ohm'] = { ease: 2.8, int: 34, rip: 6, scad: '2026-11-05', giuste: 9, sbagliate: 1, ultima: '2026-10-01' };
    writeFileSync(join(v, '.lode', 'dati.json'), JSON.stringify(d)); SY.segna(v);
    const m = SY.apri({ vault: v, locale: lA, dispositivo: A, ritardo: 60e3 });
    const barra = SY.vuotoBarra(); barra.memoria = { 'fisica 1|ohm': { ease: 2.5, int: 1, rip: 1, scad: '2026-10-04', giuste: 1, sbagliate: 0, ultima: '2026-10-03' }, 'fisica 1|nuova': { ease: 2.5, int: 1, rip: 1, scad: '2026-10-04', giuste: 1, sbagliate: 0 } };
    barra.esami.push({ id: 'eL', nome: 'Logica', cfu: 6 });
    m.salva(barra, null, SY.vuotoBarra());
    const x = m.vista().memoria['fisica 1|ohm'];
    prova('giro 2: dati bloccati: il ripasso SM-2 vero resta (conta solo la risposta in più), i record nuovi entrano', x.int === 34 && x.rip === 6 && x.ease === 2.8 && x.giuste === 10 && !!m.vista().memoria['fisica 1|nuova'] && m.vista().esami.some(e => e.id === 'eL') && m.vista().esami.length === 4, JSON.stringify(x));
    m.chiudi();
  }
  // 3. cifratura: segnaposto di cifratura.json, archivi di uno stop di prima, stop finto, stop vero senza password
  {
    const v = vN('g2-cif'), lA = cartelle('g2-cif-A'), lB = cartelle('g2-cif-B'); SY.segna(v);
    let mA = SY.apri({ vault: v, locale: lA, dispositivo: A, ritardo: 60e3 }); const a = mA.per(1); a.esami.push({ id: 'eS', nome: 'ZebraSegreta', cfu: 6 }); mA.salva(a, 1); mA.scriviOra();
    let mB = SY.apri({ vault: v, locale: lB, dispositivo: B, ritardo: 60e3 }); mB.scriviOra();
    // stop e riaccensione: l'archivio dello stop (in chiaro) esce dal vault quando si accende la cifratura
    SY.smetti({ vault: v, locale: lA, motore: mA }); SY.seguiSpenta({ vault: v, locale: lB, dispositivo: B, S: mB._stato() }); mB.chiudi({ niente: true });
    SY.segna(v); mA = SY.apri({ vault: v, locale: lA, dispositivo: A, ritardo: 60e3 }); mA.scriviOra();
    const k = SY.accendiCifratura(v, lA, 'password lunga g2', LEGGERI); mA.chiudi({ soloLocale: true });
    mA = SY.apri({ vault: v, locale: lA, dispositivo: A, chiave: k, ritardo: 60e3 }); mA.scriviOra();
    const inChiaro = []; const giro = d => { for (const n of readdirSync(d, { withFileTypes: true })) { const p = join(d, n.name); if (n.isDirectory()) giro(p); else if (n.name !== 'cifratura.json' && /ZebraSegreta/.test(readFileSync(p, 'utf8'))) inChiaro.push(p.slice(v.length)); } };
    giro(join(v, '.lode'));
    prova('giro 2: smetti, riaccendi, password: nessun file in chiaro resta in .lode (nemmeno l\'archivio dello stop)', !inChiaro.length && !readdirSync(join(v, '.lode')).some(n => /^sincronizzazione-spenta/.test(n)), inChiaro.join());
    // segnaposto di iCloud al posto di cifratura.json: il vault resta cifrato, niente in chiaro, niente seconda cifratura
    const lC = cartelle('g2-cif-C'), cj = SY.fileCifratura(v), testoCj = readFileSync(cj, 'utf8');
    rmSync(cj); writeFileSync(join(v, '.lode', '.cifratura.json.icloud'), '');
    const mC = SY.apri({ vault: v, locale: lC, dispositivo: C, ritardo: 60e3 });
    let seconda = null; try { SY.accendiCifratura(v, lC, 'altra password lunga', LEGGERI); } catch (x) { seconda = x.codice; }
    prova('giro 2: cifratura.json ancora segnaposto di iCloud: bloccato (cifratura_in_arrivo), niente file scritto, niente seconda cifratura', mC.bloccato && mC.codice === 'cifratura_in_arrivo' && !existsSync(join(v, '.lode', 'dispositivi', C + '.json')) && seconda === 'gia' && SY.cifraturaInArrivo(v));
    rmSync(join(v, '.lode', '.cifratura.json.icloud')); writeFileSync(cj, testoCj);
    // stop finto (segno dello stop senza la prova della chiave): niente dati.json in chiaro
    const segno = readFileSync(SY.fileSegno(v), 'utf8'); rmSync(SY.fileSegno(v));
    writeFileSync(SY.fileSpenta(v), JSON.stringify({ v: 1, spenta: new Date().toISOString(), da: C, archivio: 'niente' }));
    const rF = SY.seguiSpenta({ vault: v, locale: lA, dispositivo: A, S: mA._stato(), chiavi: [k], cifratoQui: true });
    prova('giro 2: stop finto in un vault cifrato: non autenticato, dati.json in chiaro non scritto', rF.esito === 'non_autenticato' && !existsSync(join(v, '.lode', 'dati.json')), JSON.stringify(rF));
    rmSync(SY.fileSpenta(v)); writeFileSync(SY.fileSegno(v), segno);
    // stop vero; B chiuso, senza la password ricordata: la sua copia locale cifrata va in copie/, poi con la password si unisce
    mB = SY.apri({ vault: v, locale: lB, dispositivo: B, chiave: k, ritardo: 60e3 }); const b = mB.per(1); b.esami.push({ id: 'eSoloB', nome: 'SoloSuB', cfu: 3 }); mB.salva(b, 1); mB.chiudi({ soloLocale: true });
    mA.ricarica(); SY.smetti({ vault: v, locale: lA, motore: mA });
    const rB = SY.seguiSpenta({ vault: v, locale: lB, dispositivo: B, chiavi: [] });
    const copieB = existsSync(join(lB, 'copie')) ? readdirSync(join(lB, 'copie')) : [];
    prova('giro 2: stop in un vault cifrato, B senza password: da_unire, e la sua copia cifrata è anche in copie/', rB.esito === 'da_unire' && rB.cifrato && copieB.some(n => /^dati-cifrati-di-questo-computer-/.test(n)) && !dj(v).esami.some(e => e.id === 'eSoloB'), JSON.stringify(rB) + copieB.join());
    const info = SY.cifraturaArchiviata(v), kB = SY.chiaveDa(info, 'password lunga g2');
    const rB2 = SY.seguiSpenta({ vault: v, locale: lB, dispositivo: B, chiavi: [kB], cifratoQui: true });
    prova('giro 2: … con la password (cifratura.json dell\'archivio) si unisce: SoloSuB entra in dati.json', rB2.esito === 'unito' && dj(v).esami.some(e => e.id === 'eSoloB') && dj(v).esami.some(e => e.id === 'eS'), JSON.stringify(rB2));
  }
  // 4. un problema di un file che non c'è più non resta segnalato
  {
    const v = vN('g2-problemi'), lA = cartelle('g2-problemi-A'); SY.segna(v);
    const m = SY.apri({ vault: v, locale: lA, dispositivo: A, ritardo: 60e3 }); m.scriviOra();
    writeFileSync(join(v, '.lode', 'dispositivi', B + '.json'), '{"rotto"'); m.ricarica();
    const prima = m.stato().problemi.some(p => p.file === B + '.json');
    rmSync(join(v, '.lode', 'dispositivi', B + '.json')); m.ricarica();
    prova('giro 2: il problema di un file tolto se ne va', prima && !m.stato().problemi.some(p => p.file === B + '.json'));
    m.chiudi();
  }
  // 4b. password dimenticata: «ricomincia» toglie dal vault i file della sincronizzazione (cifrati, in un archivio) e basta
  {
    const v = vN('g2-ricomincia'), lA = cartelle('g2-ricomincia-A'); SY.segna(v);
    let m = SY.apri({ vault: v, locale: lA, dispositivo: A, ritardo: 60e3 }); m.scriviOra();
    SY.accendiCifratura(v, lA, 'password dimenticata', LEGGERI); m.chiudi({ soloLocale: true });
    const r = SY.ricomincia({ vault: v, locale: lA }), dentro = readdirSync(join(v, '.lode'));
    prova('giro 2: ricomincia: segno, cifratura e file dei computer in un archivio; la sincronizzazione è spenta', !SY.attiva(v) && !dentro.includes('cifratura.json') && !dentro.includes('dispositivi') && readdirSync(join(v, '.lode', r.archivio)).includes('cifratura.json') && existsSync(join(lA, 'copie', r.archivio)), dentro.join());
  }
  // 4c. l'orologio di questo computer indietro (un file di un altro computer scritto «nel futuro» di ore): si dice
  {
    const v = vN('g2-orologio'), lA = cartelle('g2-orologio-A'), lB = cartelle('g2-orologio-B'); SY.segna(v);
    const mB = SY.apri({ vault: v, locale: lB, dispositivo: B, ritardo: 60e3, ora: () => Date.now() + 5 * 3600e3 }); const b = mB.per(1); b.profilo.nome = 'Bea'; mB.salva(b, 1); mB.scriviOra();
    const mA = SY.apri({ vault: v, locale: lA, dispositivo: A, ritardo: 60e3 });
    prova('giro 2: orologio indietro rispetto a un altro computer: segnalato', mA.stato().problemi.some(p => p.file === 'orologio'));
    mA.chiudi(); mB.chiudi();
  }
  // 5. Orario.md: le righe aggiunte e tolte dalla versione già vista più vicina (due computer che aggiungono insieme)
  {
    const V = await import('../desktop/vault.mjs'); await V.carica(join(import.meta.dirname, '..'));
    const r = (corso, g, i) => ({ corso, giorni: [g], inizio: i, fine: '11:00', aula: '' });
    const base = [r('Analisi 1', 1, '09:00')], mio = [...base, r('Inglese', 2, '10:00')], suo = [...base, r('Chimica', 3, '10:00')];
    const d = V.differenzeOrario([base, mio], suo);
    prova('giro 2: Orario.md arrivato da un altro computer: entra la sua lezione, la mia resta', d.aggiunte.length === 1 && d.aggiunte[0].corso === 'Chimica' && !d.tolte.length, JSON.stringify(d));
    const d2 = V.differenzeOrario([base, mio], [r('Inglese', 2, '10:00')]);
    prova('giro 2: Orario.md cambiato in Obsidian (una riga tolta): si toglie solo quella', !d2.aggiunte.length && d2.tolte.length === 1 && d2.tolte[0].corso === 'Analisi 1');
    const d3 = V.differenzeOrario([], []);
    prova('giro 2: Orario.md vuoto mai visto prima: niente si toglie', !d3.aggiunte.length && !d3.tolte.length);
  }
}

try { rmSync(RADICE, { recursive: true, force: true }); } catch { }
console.log(`${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
