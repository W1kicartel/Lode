// Prove del motore della sincronizzazione v2 (desktop/sync/), le parti pure: node test/sync-motore.mjs
// Identità e ordine degli eventi, la piega (registri e prev, cancellazioni morbide, contatori, importa secondari, tipi
// sconosciuti, I4 per permutazioni e partizioni), la cifratura, il formato dei contenitori, la migrazione, Orario.md (marcatore,
// modifiche dello studente, file troncato), e poi il motore intero su un disco finto (test/sync-sim/disco.mjs): diario con la
// coda rotta, impronta di macchina cambiata. Gli scenari e il fuzz sono in test/sync-sim/.
import { piega, vista, meta, conImpronta, impronta, valida, confronta, canonico } from '../desktop/sync/piega.mjs';
import { deriva, chiudi, apri, nuovaCifratura, provaPassword } from '../desktop/sync/cifra.mjs';
import { scriviContenitore, leggiContenitore } from '../desktop/sync/contenitore.mjs';
import { testoOrario, eventiDaOrario, leggiMarcatore, rimarca, idLezione, kLezione } from '../desktop/sync/orario.mjs';
import { importi, creaMotore, MINIMO } from '../desktop/sync/motore.mjs';
import { tipoPercorso, campoDiRecord } from '../desktop/sync/schema.mjs';
import { creaDisco } from './sync-sim/disco.mjs';
import { caso } from './sync-sim/comune.mjs';
import { proiezione, testoProiezione } from './sync-sim/modello.mjs';
import { datiIniziali, orarioMd } from './sync-sim/operazioni.mjs';

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett === '' ? '' : typeof dett === 'string' ? dett : JSON.stringify(dett)); } };
const P = { kdf: 'scrypt', N: 2 ** 10, r: 8, p: 1 };   // parametri leggeri per le prove (il motore accetta solo quelli che riceve)
let seq = 0;
const ev = (dev, ms, x, c = 0) => conImpronta({ dev, t: [ms, c], k: 1, r: String(++seq).padStart(16, '0'), ...x });

/* ---------- identità e ordine ---------- */
{
  const a = ev('aaaa', 10, { tipo: 'campo', percorso: 'profilo/nome', valore: 'Ada', prev: null });
  prova('forma canonica: chiavi in ordine', canonico({ b: 1, a: [2, { d: 3, c: 4 }] }) === '{"a":[2,{"c":4,"d":3}],"b":1}');
  prova('h: 128 bit esadecimali, deterministica', /^[0-9a-f]{32}$/.test(a.h) && impronta(a) === a.h);
  prova('evento valido', valida(a) === 'ok');
  prova('h che non torna: malformato', valida({ ...a, valore: 'Eva' }) === 'malformato');
  prova('orologio impossibile: malformato', valida(conImpronta({ ...a, h: undefined, t: [2 ** 53, 0] })) === 'malformato' && valida(conImpronta({ ...a, h: undefined, t: [1, 2 ** 31] })) === 'malformato' && valida(conImpronta({ ...a, h: undefined, t: [1.5, 0] })) === 'malformato');
  prova('tipo sconosciuto: si tiene', valida(conImpronta({ dev: 'x', t: [1, 0], k: 1, tipo: 'nuovo-v21' })) === 'sconosciuto');
  prova('alg sconosciuto: si tiene', valida(conImpronta({ dev: 'x', t: [1, 0], k: 1, tipo: 'ripasso', carta: 'c', ris: {}, alg: 2 })) === 'sconosciuto');
  const l = [ev('b', 5, { tipo: 'conta', percorso: 'x', delta: 1 }), ev('a', 5, { tipo: 'conta', percorso: 'x', delta: 1 }), ev('a', 5, { tipo: 'conta', percorso: 'x', delta: 1 }, 1), ev('a', 4, { tipo: 'conta', percorso: 'x', delta: 1 }), conImpronta({ dev: 'migrazione', t: [0, 0], k: 0, tipo: 'importa', fonte: 'f', percorso: 'x', valore: 1 })];
  const o = [...l].sort(confronta);
  prova('ordine (k, ms, c, dev, h): la migrazione prima di tutto', o[0].k === 0 && o[1].t[0] === 4 && o[2].dev === 'a' && o[2].t[1] === 0 && o[3].dev === 'b' && o[4].t[1] === 1);
  prova('schema: contatori, locali, record', tipoPercorso('codice/errori/k1') === 'contatore' && tipoPercorso('memoria/k/giuste') === 'contatore' && tipoPercorso('imp/chiave') === 'locale' && tipoPercorso('profilo/nome') === 'registro' && tipoPercorso('qualcosa/di/nuovo') === 'registro' && campoDiRecord('esami/e2/voto')?.campo === 'voto' && campoDiRecord('profilo/nome') === null);
}

/* ---------- la piega ---------- */
{
  const c = ev('a', 10, { tipo: 'crea', lista: 'esami', id: 'e1', campi: { nome: 'Analisi', cfu: 9 } });
  const v1 = ev('a', 20, { tipo: 'campo', percorso: 'esami/e1/voto', valore: 28, prev: null });
  const v2 = ev('b', 30, { tipo: 'campo', percorso: 'esami/e1/voto', valore: 30, prev: v1.h });   // ha visto v1
  let s = piega([c, v1, v2]);
  prova('registro: vince l\'ultimo, niente conflitto se ha visto il valore', vista(s).esami[0].voto === 30 && !s.conflitti.length);
  const v3 = ev('c', 25, { tipo: 'campo', percorso: 'esami/e1/voto', valore: 18, prev: null });   // contemporanea: non aveva visto v1
  s = piega([c, v1, v3]);
  prova('prev diverso: contemporanee, il perdente va nei conflitti (I8)', vista(s).esami[0].voto === 18 && s.conflitti.length === 1 && s.conflitti[0].perdente === 28 && s.conflitti[0].percorso === 'esami/e1/voto');
  prova('META: percorso → h di chi l\'ha scritto', meta(s).get('esami/e1/voto') === v3.h && meta(s).get('esami/e1/nome') === c.h);
  const del = ev('b', 40, { tipo: 'cancella', lista: 'esami', id: 'e1', prev: v1.h });
  const dopo = ev('a', 50, { tipo: 'campo', percorso: 'esami/e1/nome', valore: 'Analisi 1', prev: c.h });
  s = piega([c, v1, del, dopo]);
  prova('cancellazione morbida: un campo dopo il cancella non riporta il record, ma si vede nell\'elenco', !vista(s).esami.length && s.mentreCancellato.length === 1 && s.mentreCancellato[0].id === 'e1');
  const rip = ev('a', 60, { tipo: 'ripristina', lista: 'esami', id: 'e1', prev: del.h });
  s = piega([c, v1, del, dopo, rip]);
  prova('ripristina: il record torna intero, con le modifiche fatte mentre era cancellato', vista(s).esami[0]?.nome === 'Analisi 1' && vista(s).esami[0]?.voto === 28 && !s.mentreCancellato.length);
  const carta = ev('a', 10, { tipo: 'crea', lista: 'carte', id: 'c1', campi: { fronte: 'F', retro: 'R', ease: 2.5, int: 0, rip: 0, scad: '2026-10-03' } });
  const r1 = ev('a', 20, { tipo: 'ripasso', carta: 'c1', ris: { ease: 2.6, int: 1, rip: 1, scad: '2026-10-04' }, prev: carta.h, alg: 1 });
  const cc = ev('b', 30, { tipo: 'cancella', lista: 'carte', id: 'c1', prev: carta.h });
  const r2 = ev('a', 40, { tipo: 'ripasso', carta: 'c1', ris: { ease: 2.7, int: 6, rip: 2, scad: '2026-10-10' }, prev: r1.h, alg: 1 });
  s = piega([carta, r1, cc, r2]);
  prova('un ripasso dopo un cancella: carta cancellata, nell\'elenco (⊕11)', !vista(s).carte.length && s.mentreCancellato.some(m => m.id === 'c1'));
  s = piega([carta, r1, cc, r2, ev('b', 50, { tipo: 'crea', lista: 'carte', id: 'c1', campi: {} })]);
  prova('un crea con lo stesso id riporta la carta con tutto l\'SM-2', vista(s).carte[0]?.int === 6 && vista(s).carte[0]?.fronte === 'F');
  const k1 = ev('a', 10, { tipo: 'conta', percorso: 'codice/errori/k', delta: 2 }), k2 = ev('a', 10, { tipo: 'conta', percorso: 'codice/errori/k', delta: 2 });
  prova('contatori: somma dei delta; due incrementi uguali con r diversi contano due volte', k1.h !== k2.h && vista(piega([k1, k2, k1])).codice.errori.k === 4);
  const sc = conImpronta({ dev: 'x', t: [5, 0], k: 1, tipo: 'tipo-di-domani', dati: 1 });
  s = piega([c, sc]);
  prova('un tipo sconosciuto non si piega e non rompe niente', s.totale === 2 && s.n === 1 && vista(s).esami.length === 1);
  // importa: la fonte del gruppo e una fonte diversa (⊕2, 6.7)
  const ip = (fonte, x) => conImpronta({ dev: 'migrazione', t: [0, 0], k: 0, tipo: 'importa', fonte, ...x });
  const prim = [ip('F', { lista: 'esami', id: 'e1', campi: { nome: 'Analisi', cfu: 9 } }), ip('F', { percorso: 'profilo/nome', valore: 'Ada' }), ip('F', { percorso: 'codice/errori/k', valore: 2 })];
  const sec = [ip('G', { lista: 'esami', id: 'e1', campi: { nome: 'Altro nome', cfu: 6 } }), ip('G', { lista: 'esami', id: 'e9', campi: { nome: 'Solo là' } }), ip('G', { lista: 'esami', id: 'e8', campi: { nome: 'Toccato' } }), ip('G', { percorso: 'profilo/nome', valore: 'Eva' }), ip('G', { percorso: 'codice/errori/k', valore: 5 })];
  const tocca = ev('a', 10, { tipo: 'campo', percorso: 'esami/e8/voto', valore: 27, prev: null });
  s = piega([...prim, ...sec, tocca], { fonte: 'F' });
  const D = vista(s);
  prova('importa secondario: non cambia un record che c\'è già', D.esami.find(e => e.id === 'e1')?.nome === 'Analisi' && D.profilo.nome === 'Ada' && D.codice.errori.k === 2);
  prova('importa secondario: un record solo lì non compare da solo, ma compare se un evento normale lo nomina', !D.esami.some(e => e.id === 'e9') && D.esami.find(e => e.id === 'e8')?.nome === 'Toccato' && D.esami.find(e => e.id === 'e8')?.voto === 27 && s.secondari.includes('esami/e9'));
  // I4: ogni permutazione e ogni partizione d'arrivo danno la stessa vista, uguale a quella dell'insieme ordinato
  const r = caso(7), devs = ['a', 'b', 'c'], tutti = [];
  for (let i = 0; i < 300; i++) {
    const d = r.scegli(devs), ms = r.intero(1, 50), id = 'e' + r.intero(1, 6), x = r();
    tutti.push(ev(d, ms, x < 0.25 ? { tipo: 'crea', lista: 'esami', id, campi: { nome: 'N' + i } } : x < 0.6 ? { tipo: 'campo', percorso: `esami/${id}/nome`, valore: 'V' + i, prev: r.vero(0.5) ? null : tutti.at(-1)?.h ?? null }
      : x < 0.7 ? { tipo: r.vero(0.5) ? 'cancella' : 'ripristina', lista: 'esami', id, prev: null } : x < 0.85 ? { tipo: 'conta', percorso: `codice/errori/${id}`, delta: r.intero(1, 3) } : { tipo: 'campo', percorso: 'profilo/nome', valore: 'P' + i, prev: null }, r.intero(0, 2)));
  }
  const rif = canonico(vista(piega([...tutti].sort(confronta))));
  let uguali = true;
  for (let k = 0; k < 30 && uguali; k++) {
    const p = [...tutti].sort(() => r() - 0.5);
    // arrivo a pezzi: la piega rifatta dopo ogni pezzo, con doppioni
    let visti = []; for (let i = 0; i < p.length; i += 37) { visti = [...visti, ...p.slice(i, i + 37), ...p.slice(0, 3)]; piega(visti); }
    uguali = canonico(vista(piega(visti))) === rif && canonico(vista(piega(p))) === rif;
  }
  prova('I4: 30 permutazioni e partizioni d\'arrivo, sempre la stessa vista', uguali);
  // 100 000 eventi
  const molti = []; for (let i = 0; i < 100000; i++) molti.push(conImpronta({ dev: 'd' + (i % 3), t: [1000 + i, 0], k: 1, r: String(i), tipo: i % 5 ? 'campo' : 'conta', percorso: i % 5 ? `esami/e${i % 50}/nome` : 'codice/errori/k', valore: 'x' + i, delta: 1, prev: null }));
  molti.sort(() => r() - 0.5);
  const t0 = performance.now(); piega(molti); const ms = performance.now() - t0;
  console.log(`  (100 000 eventi piegati in ${ms.toFixed(0)} ms; obiettivo del progetto: 200 ms)`);
  prova('100 000 eventi piegati in meno di un secondo', ms < 1000, `${ms.toFixed(0)} ms`);
}

/* ---------- SM-2 nella piega (§6.6) ---------- */
{
  const { applica, piuGiorni } = await import('../js/sm2.js');
  const s0 = { ease: 2.36, int: 15, rip: 4, scad: '2026-10-20' };
  const carta = ev('a', 10, { tipo: 'crea', lista: 'carte', id: 'c1', campi: { fronte: 'F', ...s0 } });
  const rB = ev('b', 20, { tipo: 'ripasso', carta: 'c1', q: 3, giorno: '2026-10-05', ris: applica(s0, 3, '2026-10-05'), prev: carta.h, alg: 1 });
  const rC = ev('c', 21, { tipo: 'ripasso', carta: 'c1', q: 5, giorno: '2026-10-05', ris: applica(s0, 5, '2026-10-05'), prev: carta.h, alg: 1 });
  const atteso = applica(applica(s0, 3, '2026-10-05'), 5, '2026-10-05');
  const st = piega([carta, rB, rC]), c = vista(st).carte[0];
  prova('due ripassi contemporanei contano tutti e due (nell\'ordine della piega)', c.int === atteso.int && c.rip === atteso.rip && c.ease === atteso.ease && !st.conflitti.length);
  prova('in sequenza (ha visto il primo): lo stato è esattamente il risultato che lo studente ha visto', (() => { const r2 = ev('c', 30, { tipo: 'ripasso', carta: 'c1', q: 4, giorno: '2026-10-06', ris: applica(rB.ris, 4, '2026-10-06'), prev: rB.h, alg: 1 }); return canonico(vista(piega([carta, rB, r2])).carte[0].scad) === canonico(r2.ris.scad); })());
  const fresco = ev('d', 40, { tipo: 'ripasso', carta: 'c1', q: 4, giorno: '2026-10-07', ris: applica({ ease: 2.5, int: 0, rip: 0 }, 4, '2026-10-07'), prev: null, alg: 1 });
  prova('un ripasso partito da uno stato fresco non cancella la storia (#43)', vista(piega([carta, rB, rC, fresco])).carte[0].rip === atteso.rip + 1);
  const tz = process.env.TZ; const risultati = [];
  for (const z of ['Pacific/Kiritimati', 'America/Los_Angeles', 'Europe/Rome']) { process.env.TZ = z; risultati.push(canonico(vista(piega([carta, rB, rC, fresco])).carte[0]) + piuGiorni('2026-03-28', 1)); }
  process.env.TZ = tz;
  prova('lo stesso rigioco in tre fusi orari (e sull\'ora legale)', new Set(risultati).size === 1 && risultati[0].endsWith('2026-03-29'));
  prova('senza q (formato vecchio): vince l\'ultimo, il perdente nei conflitti', (() => { const a1 = ev('b', 20, { tipo: 'ripasso', carta: 'c1', ris: { ease: 2, int: 1, rip: 0, scad: 'x' }, prev: carta.h, alg: 1 }), a2 = ev('c', 21, { tipo: 'ripasso', carta: 'c1', ris: { ease: 3, int: 2, rip: 1, scad: 'y' }, prev: carta.h, alg: 1 }); const p = piega([carta, a1, a2]); return vista(p).carte[0].ease === 3 && p.conflitti.length === 1; })());
}

/* ---------- cifratura ---------- */
{
  const k = await deriva('parola', '00112233445566778899aabbccddeeff', P), k2 = await deriva('parola', '00112233445566778899aabbccddeeff', P);
  prova('scrypt: stessa password e sale, stessa chiave da 32 byte', k.length === 32 && k.equals(k2));
  const b = chiudi(k, 'ciao ZQ 1', 'g|d|1');
  prova('GCM: si apre con la stessa chiave e lo stesso AAD', apri(k, b, 'g|d|1') === 'ciao ZQ 1');
  prova('GCM: AAD diverso (contenitore spostato o rinominato) non si apre', apri(k, b, 'g|d|2') === null);
  prova('GCM: nonce nuovo a ogni scrittura', chiudi(k, 'x', 'a') !== chiudi(k, 'x', 'a'));
  const t = b.split('.'); t[1] = t[1].slice(0, -2) + (t[1].at(-2) === 'A' ? 'B' : 'A') + t[1].at(-1);
  prova('GCM: un byte cambiato non si apre', apri(k, t.join('.'), 'g|d|1') === null);
  const { cifratura, chiave } = await nuovaCifratura('segreta', 'gruppo1', P, () => 'aabbccddeeff00112233445566778899');
  prova('controllo: la password giusta apre', (await provaPassword('segreta', 'gruppo1', cifratura, P)).chiave?.equals(chiave));
  prova('controllo: password sbagliata → chiave_sbagliata', (await provaPassword('altra', 'gruppo1', cifratura, P)).codice === 'chiave_sbagliata');
  prova('controllo: legato all\'id del gruppo', (await provaPassword('segreta', 'gruppo2', cifratura, P)).codice === 'chiave_sbagliata');
  prova('parametri diversi da quelli accettati: rifiutati (#24)', (await provaPassword('segreta', 'gruppo1', { ...cifratura, N: 2 ** 20 }, P)).codice === 'parametri');
  prova('nessun dato in chiaro nel gruppo.json cifrato', !JSON.stringify(cifratura).includes('segreta'));

  /* ---------- contenitori ---------- */
  const evs = [ev('d1', 10, { tipo: 'campo', percorso: 'profilo/nome', valore: 'Ada ZQ 3', prev: null }), ev('d1', 11, { tipo: 'conta', percorso: 'codice/errori/k', delta: 1 })];
  const chiaro = scriviContenitore({ gruppo: 'g', dev: 'd1', n: 1, eventi: evs });
  prova('contenitore in chiaro: intestazione e una riga per evento', chiaro.split('\n').length === 4 && JSON.parse(chiaro.split('\n')[0]).conta === 2);
  prova('si rilegge uguale', canonico(leggiContenitore(chiaro, { gruppo: 'g', dev: 'd1', cifrato: false }).eventi) === canonico(evs));
  prova('gruppo o computer diversi: intestazione', leggiContenitore(chiaro, { gruppo: 'h', dev: 'd1' }).errore === 'intestazione' && leggiContenitore(chiaro, { gruppo: 'g', dev: 'd2' }).errore === 'intestazione');
  prova('a metà: rovinato (si riprova)', leggiContenitore(chiaro.slice(0, chiaro.length - 20), { gruppo: 'g', dev: 'd1' }).errore === 'rovinato');
  prova('in chiaro in un gruppo cifrato: rifiutato (I5)', leggiContenitore(chiaro, { gruppo: 'g', dev: 'd1', cifrato: true, chiave }).errore === 'chiaro');
  const cif = scriviContenitore({ gruppo: 'g', dev: 'd1', n: 3, eventi: evs, chiave });
  prova('cifrato: niente dati in chiaro', !/ZQ \d/.test(cif) && JSON.parse(cif.split('\n')[0]).cifrato === true);
  prova('cifrato: si rilegge con la chiave', leggiContenitore(cif, { gruppo: 'g', dev: 'd1', cifrato: true, chiave }).eventi?.length === 2);
  prova('cifrato senza chiave: password', leggiContenitore(cif, { gruppo: 'g', dev: 'd1', cifrato: true }).errore === 'password');
  prova('cifrato, intestazione con un altro n (AAD): rovinato', leggiContenitore(cif.replace('"n":3', '"n":4'), { gruppo: 'g', dev: 'd1', cifrato: true, chiave }).errore === 'rovinato');
  const guasto = chiaro.replace('"delta":1', '"delta":9');
  const lg = leggiContenitore(guasto, { gruppo: 'g', dev: 'd1' });
  prova('un evento manomesso va in quarantena da solo', lg.eventi?.length === 1 && lg.malformati === 1);
}

/* ---------- migrazione ---------- */
{
  const D = datiIniziali(), fonte = 'f0';
  const a = importi(D, fonte), b = importi(JSON.parse(JSON.stringify(D)), fonte);
  prova('importa deterministici: stesso dati.json, stessi eventi', canonico(a) === canonico(b) && a.every(e => !e.r && e.dev === 'migrazione' && e.k === 0));
  prova('imp.chiave e imp.ultimoSuggerimento restano sul computer', !a.some(e => e.percorso === 'imp/chiave' || e.percorso === 'imp/ultimoSuggerimento'));
  prova('le lezioni hanno l\'id della loro chiave (o<k>)', a.some(e => e.lista === 'orario' && e.id === idLezione(D.orario[0])));
  const V = vista(piega(a, { fonte }));
  prova('la piega degli importa dà il dati.json di prima', testoProiezione(proiezione(V)) === testoProiezione(proiezione(D)), [...proiezione(D)].filter(([k, v]) => proiezione(V).get(k) !== v));
  prova('il dati.json minimo non ha dati dello studente', !/ZQ \d/.test(JSON.stringify(MINIMO('g1'))) && MINIMO('g1').v === 1 && MINIMO('g1').lode2.gruppo === 'g1');
}

/* ---------- Orario.md ---------- */
{
  const lez = n => ({ corso: `Corso ZQ ${n}`, giorni: [1], inizio: '09:00', fine: '11:00', aula: `A${n}` });
  const crea = (o, ms) => ev('a', ms, { tipo: 'crea', lista: 'orario', id: idLezione(o), campi: o });
  const s = piega([crea(lez(1), 10), crea(lez(2), 11)]);
  const { testo } = testoOrario(s), m = leggiMarcatore(testo);
  prova('marcatore in fondo: n, x, t, h e righe', m && m.n === 2 && m.righe.length === 2 && m.t[0] === 11 && m.righe.includes(kLezione(lez(1))));
  prova('scritto da Lode: nessun evento', eventiDaOrario(testo, s).eventi.length === 0);
  const sopra = orarioMd([lez(1), lez(3)]), cambiato = sopra + testo.slice(testo.indexOf('<!-- lode2'));
  const r = eventiDaOrario(cambiato, s);
  prova('cambiato dallo studente: riga nuova → crea, riga tolta → cancella, a t del marcatore + 1', r.eventi.length === 2 && r.eventi.some(e => e.tipo === 'crea' && e.id === idLezione(lez(3))) && r.eventi.some(e => e.tipo === 'cancella' && e.id === idLezione(lez(2))) && r.eventi.every(e => e.t[0] === 11 && e.t[1] === 1 && !e.r && e.dev === 'orario'));
  prova('stessa modifica letta su due computer: stessi eventi', canonico(eventiDaOrario(cambiato, s).eventi) === canonico(r.eventi));
  const s2 = piega([crea(lez(1), 10), crea(lez(2), 11), ...r.eventi]);
  prova('dopo la modifica: lezione 3 sì, lezione 2 no', vista(s2).orario.map(o => o.corso).sort().join() === 'Corso ZQ 1,Corso ZQ 3');
  const rm = rimarca(leggiMarcatore(cambiato));
  prova('marcatore rimesso: h torna, righe = quelle di adesso, t = quello degli eventi ricavati', (() => { const x = leggiMarcatore(rm); return eventiDaOrario(rm, s2).eventi.length === 0 && x.righe.length === 2 && x.t[1] === 1 && x.sopra === sopra; })());
  const senza = orarioMd([lez(1), lez(4)]);
  const r3 = eventiDaOrario(senza, s);
  prova('senza marcatore: solo crea delle righe mai viste, mai cancellazioni', r3.eventi.length === 1 && r3.eventi[0].tipo === 'crea' && r3.eventi[0].t[0] === 0 && r3.tolte.includes(idLezione(lez(2))));
  const tronco = testo.slice(0, testo.indexOf('| A2 |') + 4);
  prova('troncato a metà riga: nessuna lezione inventata', eventiDaOrario(tronco, s).eventi.length === 0);
}

/* ---------- il motore su un disco finto ---------- */
{
  const disco = creaDisco('A', { orologio: () => 1790000000000 });
  disco.crudo.scrivi('vault/.lode/dati.json', JSON.stringify(datiIniziali()), 'studente');
  const nuovo = (macchina = 'M1', seme = 1) => creaMotore({ fs: disco.maniglia(), vault: 'vault', dati: 'dati', orologio: () => 1790000000000, casuale: caso(seme), macchina, parametri: P });
  let m = nuovo(); await m.apri(); await m.attiva({ modo: 'nuovo' });
  prova('migrazione: la vista ha il dati.json di prima', m.vista().esami?.length === 2 && JSON.parse(disco.crudo.leggi('vault/.lode/dati.json')).lode2);
  await m.modifica({ tipo: 'campo', percorso: 'profilo/nome', valore: 'Eva ZQ 9' });
  const g = m.stato().gruppo, dev = m.stato().dev, seg = `dati/sync/${g}/miei/1.jsonl`;
  const pieno = disco.crudo.leggi(seg).toString();
  disco.crudo.scrivi(seg, pieno + '{"h":"rott', 'studente');   // un crash a metà di una riga
  m = nuovo(); await m.apri();
  prova('diario con la coda rotta: gli eventi confermati ci sono', m.vista().profilo?.nome === 'Eva ZQ 9');
  prova('i byte della coda rotta sono in copie/', disco.crudo.elenco('dati/sync/copie').some(p => disco.crudo.leggi(p).toString().endsWith('{"h":"rott')));
  await m.modifica({ tipo: 'conta', percorso: 'codice/errori/k2', delta: 1 });
  prova('la coda rotta si tronca al prossimo append', !disco.crudo.leggi(seg).toString().includes('{"h":"rott') && m.vista().codice.errori.k2 === 3);
  m = nuovo('M2', 2); await m.apri();
  prova('impronta di macchina cambiata: dev nuovo prima di pubblicare (⊕1)', m.stato().dev !== dev && m.stato().avvisi.includes('clone') && m.vista().profilo?.nome === 'Eva ZQ 9');
  prova('modifica in fermo o senza gruppo: rifiutata', (await creaMotore({ fs: creaDisco('B', { orologio: () => 1 }).maniglia(), vault: 'vault', dati: 'dati', orologio: () => 1, casuale: caso(3), parametri: P }).modifica({ tipo: 'campo', percorso: 'x', valore: 1 })).rifiutata === true);
}

/* ---------- N11: una Lode più nuova accanto (tipo e campo sconosciuti), anche dopo una rigenerazione ---------- */
{
  const disco = creaDisco('A', { orologio: () => 1790000000000 });
  disco.crudo.scrivi('vault/.lode/dati.json', JSON.stringify(datiIniziali()), 'studente');
  const m = creaMotore({ fs: disco.maniglia(), vault: 'vault', dati: 'dati', orologio: () => 1790000000000, casuale: caso(5), macchina: 'M1', parametri: P });
  await m.apri(); await m.attiva({ modo: 'nuovo' });
  const g = m.stato().gruppo;
  // il contenitore di un computer con la v2.1: un tipo nuovo e un campo nuovo in un evento noto
  const nuovi = [conImpronta({ dev: 'ffffffffffffffff', t: [1790000000001, 0], k: 1, r: '1', tipo: 'evidenzia', carta: 'c1', colore: 'giallo' }),
    conImpronta({ dev: 'ffffffffffffffff', t: [1790000000002, 0], k: 1, r: '2', tipo: 'campo', percorso: 'esami/e1/nome', valore: 'Analisi ZQ 90', prev: null, nota: 'campo v2.1' })];
  disco.crudo.scrivi(`vault/.lode/sync/${g}/ffffffffffffffff/1.seg`, scriviContenitore({ gruppo: g, dev: 'ffffffffffffffff', n: 1, eventi: nuovi }), 'cloud');
  await m.arrivati();
  prova('N11: tipo sconosciuto tenuto (stato versione), campo nuovo piegato', m.stato().stato === 'versione' && m.vista().esami.find(e => e.id === 'e1')?.nome === 'Analisi ZQ 90');
  await m.cifra('segreta');
  const g2 = m.stato().gruppo, dev = m.stato().dev;
  const t = disco.crudo.leggi(`vault/.lode/sync/${g2}/${dev}/1.seg`).toString();
  const { cifratura } = JSON.parse(disco.crudo.leggi(`vault/.lode/sync/${g2}/gruppo.json`).toString());
  const { chiave } = await provaPassword('segreta', g2, cifratura, P);
  const letti = leggiContenitore(t, { gruppo: g2, dev, cifrato: true, chiave });
  prova('N11: la rigenerazione fatta dalla v2.0 ripubblica anche gli eventi che non capisce', letti.eventi?.some(e => e.tipo === 'evidenzia') && letti.eventi?.some(e => e.nota === 'campo v2.1'));
  prova('rigenerazione: sostituito.json nel gruppo vecchio, cartella propria tolta, niente in chiaro nel gruppo nuovo', !!disco.crudo.leggi(`vault/.lode/sync/${g}/sostituito.json`) && !disco.crudo.elenco(`vault/.lode/sync/${g}/${dev}`).length && !/ZQ \d/.test(t));
}

/* ---------- su un disco vero (node:fs/promises, cartelle temporanee): due computer, un vault in comune ---------- */
{
  const { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, readFileSync } = await import('node:fs');
  const fsp = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const radice = mkdtempSync(join(tmpdir(), 'lode-sync-prova-'));
  try {
    const vault = join(radice, 'vault'), datiA = join(radice, 'datiA'), datiB = join(radice, 'datiB');
    mkdirSync(join(vault, '.lode'), { recursive: true });
    writeFileSync(join(vault, '.lode', 'dati.json'), JSON.stringify(datiIniziali()));
    writeFileSync(join(vault, 'Orario.md'), orarioMd(datiIniziali().orario));
    let t = 1790000000000;
    const crea = (dati, seme, macchina) => creaMotore({ fs: fsp, vault, dati, orologio: () => (t += 1000), casuale: caso(seme), macchina, parametri: P });
    const A = crea(datiA, 11, 'MA'), B = crea(datiB, 12, 'MB');
    await A.apri(); await A.attiva({ modo: 'nuovo' });
    await B.apri(); await B.attiva({ modo: 'unisciti' });
    await A.modifica({ tipo: 'campo', percorso: 'esami/e1/voto', valore: 30 });
    await B.modifica({ tipo: 'conta', percorso: 'codice/errori/k2', delta: 5 });
    for (const m of [A, B, A, B]) await m.arrivati();
    const vA = canonico(proiezione(A.vista()).entries ? [...proiezione(A.vista())] : null), vB = canonico([...proiezione(B.vista())]);
    prova('disco vero: due computer convergono', vA === vB && B.vista().esami.find(e => e.id === 'e1')?.voto === 30 && A.vista().codice.errori.k2 === 7, { a: A.stato(), b: B.stato() });
    const om = readFileSync(join(vault, 'Orario.md'), 'utf8');
    prova('disco vero: Orario.md ha il marcatore e nessun temporaneo resta in giro', /<!-- lode2 n=\d+/.test(om) && !readdirSync(vault).some(n => n.includes('.tmp-')));
    await A.cifra('segreta');
    await B.arrivati();
    prova('disco vero: dopo la cifratura altrove, B chiede la password', B.vista().bloccato === true && B.vista().motivo === 'password');
    await B.sblocca('sbagliata');
    prova('disco vero: password sbagliata, resta in pausa', B.vista().bloccato === true);
    await B.sblocca('segreta'); await A.arrivati(); await B.arrivati(); await A.arrivati();
    const g = A.stato().gruppo, testi = [];
    const giu = d => { for (const n of readdirSync(d, { withFileTypes: true })) { const p = join(d, n.name); if (n.isDirectory()) giu(p); else testi.push(readFileSync(p, 'latin1')); } };
    giu(join(vault, '.lode', 'sync'));
    prova('disco vero: tutti nel gruppo cifrato, niente dati in chiaro sotto .lode/sync', B.stato().gruppo === g && !B.vista().bloccato && !testi.some(x => /ZQ \d/.test(x)), { g, b: B.stato() });
  } finally { rmSync(radice, { recursive: true, force: true }); }
}

/* ---------- collaudo del 3 ottobre, su disco vero: password dimenticata, radice cancellata, lezione cambiata, Lode vecchia ---------- */
{
  const { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } = await import('node:fs');
  const fsp = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const radice = mkdtempSync(join(tmpdir(), 'lode-sync-collaudo-'));
  try {
    const vault = join(radice, 'vault'), dir = n => join(radice, 'dati' + n);
    mkdirSync(join(vault, '.lode'), { recursive: true });
    writeFileSync(join(vault, '.lode', 'dati.json'), JSON.stringify(datiIniziali()));
    writeFileSync(join(vault, 'Orario.md'), orarioMd(datiIniziali().orario));
    let t = 1790000000000, semi = 40;
    const crea = n => creaMotore({ fs: fsp, vault, dati: dir(n), orologio: () => (t += 1000), casuale: caso(++semi), macchina: 'M' + n, parametri: P });
    const giri = async (...ms) => { for (let i = 0; i < 3; i++) for (const m of ms) await m.arrivati(); };
    let A = crea('A'), B = crea('B');
    await A.apri(); await A.attiva({ modo: 'nuovo' }); await B.apri(); await B.attiva({ modo: 'unisciti' });
    await A.cifra('vecchia'); await B.sblocca('vecchia'); await giri(A, B);
    // p1: nessuno ricorda più la password (riavvio senza portachiavi): «Ho dimenticato la password» su B
    A = crea('A'); B = crea('B'); await A.apri(); await B.apri();
    const r1 = await B.cifra('nuova');
    await B.modifica({ tipo: 'crea', lista: 'esami', id: 'eb1', campi: { nome: 'Esame ZQ 1', cfu: 6, voto: null } });
    await A.arrivati();
    prova('10.5: cifra() nello stato password funziona; A chiede la password nuova', r1.ok === true && A.vista().motivo === 'password', { r1, a: A.stato() });
    await A.sblocca('nuova'); await giri(A, B);
    prova('10.5: con la password nuova A segue B e vede il suo lavoro', A.stato().gruppo === B.stato().gruppo && A.vista().esami?.some(e => e.id === 'eb1'), { a: A.stato(), b: B.stato() });
    // p2: la cartella della radice (e del gruppo di prima) cancellata, poi A cambia di nuovo password: B segue, C si unisce
    for (const g of (await fsp.readdir(join(vault, '.lode', 'sync')))) if (g !== A.stato().gruppo) rmSync(join(vault, '.lode', 'sync', g), { recursive: true, force: true });
    await giri(A, B);
    await A.cifra('terza'); await B.arrivati(); await B.sblocca('terza'); await giri(A, B);
    await B.modifica({ tipo: 'crea', lista: 'esami', id: 'eb2', campi: { nome: 'Esame ZQ 2', cfu: 6, voto: null } }); await giri(A, B);
    const C = crea('C'); await C.apri(); await C.attiva({ modo: 'unisciti' }); await C.sblocca('terza'); await giri(A, B, C);
    prova('radice cancellata: B segue A, la modifica di B arriva, un computer nuovo si unisce', B.stato().gruppo === A.stato().gruppo && C.stato().gruppo === A.stato().gruppo && A.vista().esami?.some(e => e.id === 'eb2') && C.vista().esami?.some(e => e.id === 'eb2'), { a: A.stato(), b: B.stato(), c: C.stato() });
    // p3: una lezione cambiata (campo su orario/) diventa cancella + crea con il nuovo o<k>; tolta poi in Obsidian, sparisce
    await A.modifica({ tipo: 'crea', lista: 'orario', id: idLezione({ corso: 'Corso ZQ 7', giorni: [2], inizio: '09:00', fine: '11:00', aula: 'A1' }), campi: { corso: 'Corso ZQ 7', giorni: [2], inizio: '09:00', fine: '11:00', aula: 'A1' } });
    const vecchioId = idLezione({ corso: 'Corso ZQ 7', giorni: [2], inizio: '09:00', fine: '11:00', aula: 'A1' }), nuovoId = idLezione({ corso: 'Corso ZQ 7', giorni: [2], inizio: '09:00', fine: '11:00', aula: 'B2' });
    const r3 = await A.modifica({ tipo: 'campo', percorso: `orario/${vecchioId}/aula`, valore: 'B2' });
    const lez = A.vista().orario.filter(o => o.corso === 'Corso ZQ 7');
    prova('§9: campo su una lezione = cancella + crea con il nuovo id', r3.id === nuovoId && lez.length === 1 && lez[0].id === nuovoId && lez[0].aula === 'B2', { r3, lez });
    const om = readFileSync(join(vault, 'Orario.md'), 'utf8');
    writeFileSync(join(vault, 'Orario.md'), om.split('\n').filter(r => !r.includes('Corso ZQ 7')).join('\n'));
    await A.arrivati();
    prova('§9: la lezione cambiata, tolta da Orario.md, sparisce e non torna nel file', !A.vista().orario.some(o => o.corso === 'Corso ZQ 7') && !readFileSync(join(vault, 'Orario.md'), 'utf8').includes('Corso ZQ 7'));
    // avviso lode_vecchia: una Lode vecchia riscrive dati.json dopo la migrazione
    writeFileSync(join(vault, '.lode', 'dati.json'), JSON.stringify({ ...datiIniziali(), v: 1 }));
    await A.arrivati();
    prova('§8.3: dati.json scritto da una Lode vecchia: avviso lode_vecchia', A.stato().avvisi.includes('lode_vecchia'), A.stato());
  } finally { rmSync(radice, { recursive: true, force: true }); }
}

/* ---------- revisione del 3 ottobre, giro 1 delle correzioni: i problemi trovati nel motore, su disco vero ---------- */
{
  const { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync, statSync, utimesSync } = await import('node:fs');
  const fsp = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { scrittoDaVecchia } = await import('../desktop/sync/motore.mjs');
  const radice = mkdtempSync(join(tmpdir(), 'lode-sync-revisione-'));
  let t = 1795000000000, semi = 700;
  const tutti = d => { const out = []; const giu = q => { for (const n of readdirSync(q)) { const x = join(q, n); if (statSync(x).isDirectory()) giu(x); else out.push(x); } }; if (existsSync(d)) giu(d); return out; };
  const nuovoVault = nome => { const v = join(radice, nome); mkdirSync(join(v, '.lode'), { recursive: true }); writeFileSync(join(v, '.lode', 'dati.json'), JSON.stringify(datiIniziali())); return v; };
  const crea = (vault, n, extra = {}) => creaMotore({ fs: fsp, vault, dati: join(radice, 'dati-' + n), orologio: () => (t += 1000), casuale: caso(++semi), macchina: 'M' + n, parametri: P, ...extra });
  const giri = async (...ms) => { for (let i = 0; i < 3; i++) for (const m of ms) await m.arrivati(); };
  try {
    // Lode vecchia riconosciuta dal contenuto (la Lode di prima conserva lode2)
    const MIN = MINIMO('g1');
    prova('§8.3: il minimo non è una Lode vecchia, nemmeno con i predefiniti della Lode di prima', !scrittoDaVecchia(MIN, 'g1') && !scrittoDaVecchia({ ...MIN, esami: [], carte: [], profilo: { ...MIN.profilo, cfuTotali: 180, lode: 30, corso: '' }, imp: { aspetto: 'chiaro', focus: 50 }, memoria: {}, codice: { errori: {} } }, 'g1'));
    prova('§8.3: con lode2 ma un esame aggiunto, o un nome cambiato: Lode vecchia', scrittoDaVecchia({ ...MIN, esami: [{ id: 'x', nome: 'Chimica ZQ 25' }] }, 'g1') && scrittoDaVecchia({ ...MIN, profilo: { nome: 'Ada' } }, 'g1') && scrittoDaVecchia({ v: 1, esami: [] }, 'g1'));

    // iniezione in un antenato in chiaro (prova3, caso a): una cartella di computer nata dopo il cambio di password non entra
    const v1 = nuovoVault('v1');
    const A = crea(v1, 'A1'), B = crea(v1, 'B1');
    await A.apri(); await A.attiva({ modo: 'nuovo' }); await B.apri(); await B.attiva({ modo: 'unisciti' }); await giri(A, B);
    const g0 = A.stato().gruppo;
    await A.cifra('password uno'); await B.arrivati(); await B.sblocca('password uno'); await giri(A, B);
    const falso = conImpronta({ dev: 'ffff0000ffff0000', t: [t + 9e6, 0], k: 1, r: 'f'.repeat(16), tipo: 'campo', percorso: 'esami/e1/voto', valore: 18, prev: null });
    mkdirSync(join(v1, '.lode', 'sync', g0, 'ffff0000ffff0000'), { recursive: true });
    writeFileSync(join(v1, '.lode', 'sync', g0, 'ffff0000ffff0000', '1.seg'), scriviContenitore({ gruppo: g0, dev: 'ffff0000ffff0000', n: 1, eventi: [falso], chiave: null }));
    await giri(A, B);
    prova('I5: eventi in chiaro di una cartella nuova in un antenato non entrano nel gruppo cifrato', A.vista().esami?.find(e => e.id === 'e1')?.voto === 28 && B.vista().esami?.find(e => e.id === 'e1')?.voto === 28, { a: A.vista().esami, b: B.stato() });
    // prova3b: il gruppo.json di un antenato cifrato riscritto con cifratura null, e un contenitore in chiaro: C, arrivato dopo, non lo legge
    const g1 = A.stato().gruppo;
    await A.cifra('password due'); await B.arrivati(); await B.sblocca('password due'); await giri(A, B);
    const gj1 = JSON.parse(readFileSync(join(v1, '.lode', 'sync', g1, 'gruppo.json'), 'utf8'));
    writeFileSync(join(v1, '.lode', 'sync', g1, 'gruppo.json'), JSON.stringify({ ...gj1, cifratura: null }));
    const falso2 = conImpronta({ dev: 'eeee0000eeee0000', t: [t + 9e6, 1], k: 1, r: 'e'.repeat(16), tipo: 'campo', percorso: 'esami/e1/voto', valore: 17, prev: null });
    mkdirSync(join(v1, '.lode', 'sync', g1, 'eeee0000eeee0000'), { recursive: true });
    writeFileSync(join(v1, '.lode', 'sync', g1, 'eeee0000eeee0000', '1.seg'), scriviContenitore({ gruppo: g1, dev: 'eeee0000eeee0000', n: 1, eventi: [falso2], chiave: null }));
    const C = crea(v1, 'C1'); await C.apri(); await C.attiva({ modo: 'unisciti' }); await C.sblocca('password due'); await giri(A, B, C);
    prova('I5: il modo di un antenato non si prende dal gruppo.json del vault (non autenticato)', [A, B, C].every(m => m.vista().esami?.find(e => e.id === 'e1')?.voto === 28), [A, B, C].map(m => m.vista().esami?.find(e => e.id === 'e1')?.voto));
    // attiva con la password su un vault che ha già un gruppo cifrato (prova6): la password sblocca, non si ignora
    const D2 = crea(v1, 'D1'); await D2.apri();
    const rs = await D2.attiva({ modo: 'nuovo', password: 'sbagliata 123' });
    const D3 = crea(v1, 'E1'); await D3.apri();
    const rg = await D3.attiva({ modo: 'nuovo', password: 'password due' }); await giri(D3, A);
    prova('attiva con la password su un gruppo già cifrato: sblocca (giusta) o lo dice (sbagliata)', rs.codice === 'chiave_sbagliata' && rg.ok === true && D3.stato().chiave && D3.stato().stato === 'in_pari', { rs, rg, s: D3.stato() });
    // «Smetti» senza la chiave: si rifiuta (le modifiche fatte in pausa resterebbero solo qui)
    await B.dimentica();
    const rb = await B.smetti({ destinazione: join(radice, 'fuori-B') });
    prova('§11: Smetti in pausa (password dimenticata qui) si rifiuta, e il vault non cambia', rb.rifiutata && rb.motivo === 'password' && B.stato().vault === v1, rb);

    // migrazione con la password (vault già nel cloud): il gruppo nasce cifrato, e le copie in chiaro di .lode vanno in copie/
    const v2 = nuovoVault('v2');
    writeFileSync(join(v2, '.lode', 'dati.prev.json'), JSON.stringify(datiIniziali())); writeFileSync(join(v2, '.lode', 'dati.recupero.json'), JSON.stringify(datiIniziali()));
    const scritti = [];
    const fsReg = { ...fsp, writeFile: async (q, d, o) => { scritti.push([q, String(d)]); return fsp.writeFile(q, d, o); } };
    const M = crea(v2, 'M2', { fs: fsReg });
    await M.apri(); const rm = await M.attiva({ modo: 'nuovo', password: 'password tre' }); await M.arrivati();
    const nelVault = scritti.filter(([q]) => q.startsWith(join(v2, '.lode', 'sync')));
    const copie = readdirSync(join(radice, 'dati-M2', 'sync', 'copie'));
    prova('#20: con la password il gruppo della migrazione nasce cifrato: nessun evento in chiaro scritto nel vault, mai', rm.ok && M.stato().cifrato && nelVault.length > 0 && !nelVault.some(([, d]) => /ZQ \d/.test(d)), { rm, n: nelVault.length });
    prova('#20: dati.prev.json e dati.recupero.json escono da .lode/ e restano in copie/', !existsSync(join(v2, '.lode', 'dati.prev.json')) && !existsSync(join(v2, '.lode', 'dati.recupero.json')) && copie.some(n => n.endsWith('dati.prev.json')) && copie.some(n => n.endsWith('dati.recupero.json')), copie);
    prova('#20: la vista dopo la migrazione cifrata ha tutti i dati', M.vista().esami?.length === 2 && M.vista().profilo?.nome === 'Ada ZQ 1');

    // «Smetti» con note tolte dal Mac da iCloud: non si cambia vault, e si elencano
    const v3 = nuovoVault('v3'); mkdirSync(join(v3, 'Lezioni'), { recursive: true });
    writeFileSync(join(v3, 'Lezioni', 'Analisi 2025-10-01.md'), '# Analisi'); writeFileSync(join(v3, 'Lezioni', '.Fisica 2024-03-02.md.icloud'), 'segnaposto');
    const S = crea(v3, 'S3'); await S.apri(); await S.attiva({ modo: 'nuovo' });
    const rsm = await S.smetti({ destinazione: join(radice, 'fuori-S') });
    prova('§11: Smetti con note non scaricate si rifiuta e le elenca', rsm.rifiutata && rsm.motivo === 'segnaposti' && rsm.mancano?.[0] === 'Lezioni/Fisica 2024-03-02.md' && S.stato().vault === v3, rsm);
    rmSync(join(v3, 'Lezioni', '.Fisica 2024-03-02.md.icloud')); writeFileSync(join(v3, 'Lezioni', 'Fisica 2024-03-02.md'), '# Fisica');

    // «Smetti» e poi «Uso già Lode»: ci si riunisce, con le modifiche fatte fuori
    const T = crea(v3, 'T3'); await T.apri(); await T.attiva({ modo: 'unisciti' }); await giri(S, T);
    const rsm2 = await S.smetti({ destinazione: join(radice, 'fuori-S') });
    await S.modifica({ tipo: 'crea', lista: 'esami', id: 'es9', campi: { nome: 'Esame ZQ 9', cfu: 6, voto: null } });
    const rr = await S.ricollega({ vault: v3 }); await giri(S, T);
    prova('§11: dopo Smetti, ricollega: S torna nel gruppo di T e T vede la modifica fatta fuori', rsm2.ok && rr.ok && S.stato().gruppo === T.stato().gruppo && S.stato().vault === v3 && T.vista().esami?.some(e => e.id === 'es9'), { s: S.stato(), t: T.stato().gruppo });

    // rovinato_altro: si accende col file di un altro computer rovinato e si spegne quando torna buono
    const dirT = join(v3, '.lode', 'sync', T.stato().gruppo, T.stato().dev);
    await T.modifica({ tipo: 'campo', percorso: 'profilo/nome', valore: 'Ada ZQ 10' }); await giri(T, S);
    const fT = join(dirT, readdirSync(dirT).find(n => n.endsWith('.seg'))), buono = readFileSync(fT);
    writeFileSync(fT, Buffer.concat([buono.subarray(0, buono.length - 30), Buffer.from('x'.repeat(30))])); await S.arrivati();
    const conAvviso = S.stato().avvisi.includes('rovinato_altro') && !S.stato().avvisi.includes('rovinato_mio');
    writeFileSync(fT, buono); utimesSync(fT, new Date(), new Date(t)); await S.arrivati();
    prova('§12: rovinato_altro col file di un altro computer rovinato, e via quando torna buono', conAvviso && !S.stato().avvisi.includes('rovinato_altro'), S.stato().avvisi);

    // una scrittura del diario che fallisce non resta in memoria: niente doppioni dopo il riavvio (p2b)
    const v4 = nuovoVault('v4'); let rompi = false;
    const fsRotto = { ...fsp, writeFile: async (q, d, o) => { if (rompi && /\/miei\//.test(q)) throw Object.assign(new Error('ENOSPC: disco pieno'), { code: 'ENOSPC' }); return fsp.writeFile(q, d, o); } };
    const W = crea(v4, 'W4', { fs: fsRotto }); await W.apri(); await W.attiva({ modo: 'nuovo' });
    rompi = true; let lanciato = false;
    try { await W.modifica({ tipo: 'conta', percorso: 'codice/errori/F3', delta: 1 }); } catch { lanciato = true; }
    rompi = false; await W.modifica({ tipo: 'conta', percorso: 'codice/errori/F3', delta: 1 }); await W.modifica({ tipo: 'campo', percorso: 'profilo/corso', valore: 'Chimica ZQ 11' });
    const prima = canonico(W.vista());
    const W2 = crea(v4, 'W4', { fs: fsRotto }); await W2.apri();
    prova('I4: modifica fallita, poi riuscite, poi riavvio: il contatore conta una volta e la vista è la stessa', lanciato && W2.vista().codice?.errori?.F3 === 1 && canonico(W2.vista()) === prima, W2.vista().codice?.errori);

    // un segmento del diario che non si legge all'avvio: apri() lancia (fermo), niente si scrive sopra (p4)
    const fsEio = { ...fsp, readFile: async (q, o) => { if (/\/miei\/1\.jsonl$/.test(q)) throw Object.assign(new Error('EIO'), { code: 'EIO' }); return fsp.readFile(q, o); } };
    const segPrima = readFileSync(join(radice, 'dati-W4', 'sync', W2.stato().gruppo, 'miei', '1.jsonl'), 'utf8');
    const W3 = crea(v4, 'W4', { fs: fsEio }); let fermo = null; try { await W3.apri(); } catch (x) { fermo = x.code; }
    prova('§5.2: un segmento illeggibile all\'avvio ferma il motore e non si riscrive', fermo === 'EIO' && readFileSync(join(radice, 'dati-W4', 'sync', W2.stato().gruppo, 'miei', '1.jsonl'), 'utf8') === segPrima, fermo);

    // dati.json bloccato (EBUSY) all'accensione: da_migrare, vista bloccata, poi la migrazione con i dati veri
    const v5 = nuovoVault('v5'); let occupato = true;
    const fsOcc = { ...fsp, readFile: async (q, o) => { if (occupato && q.endsWith(join('.lode', 'dati.json'))) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' }); return fsp.readFile(q, o); } };
    const Z = crea(v5, 'Z5', { fs: fsOcc }); await Z.apri(); const rz = await Z.attiva({ modo: 'nuovo' });
    const inAttesa = Z.stato().stato === 'da_migrare' && Z.vista().bloccato && Z.locale()?.solaLettura && rz.ok === false;
    occupato = false; await Z.arrivati();
    prova('#20: dati.json che non si legge (EBUSY) non vale «Comincio da zero»: si aspetta e poi si migra con i dati veri', inAttesa && Z.stato().gruppo && Z.vista().esami?.length === 2, { rz, s: Z.stato() });
  } finally { rmSync(radice, { recursive: true, force: true }); }
}

/* ---------- giro 3: sblocca con una chiave già nota, «Dimentica la password qui» svuota tutto il portachiavi ---------- */
{
  const disco = creaDisco('A', { orologio: () => 1790000000000 });
  disco.crudo.scrivi('vault/.lode/dati.json', JSON.stringify(datiIniziali()), 'studente');
  // come portachiavi() di desktop/sincronizza.mjs: leggi() salta le voci che safeStorage non decifra (qui: «negata»), svuota() toglie tutto
  const voci = new Map(), negate = new Set();
  const pc = { leggi: () => [...voci].filter(([g]) => !negate.has(g)), scrivi: (g, k) => { if (k) voci.set(g, k); else voci.delete(g); }, svuota: () => voci.clear() };
  const nuovo = seme => creaMotore({ fs: disco.maniglia(), vault: 'vault', dati: 'dati', orologio: () => 1790000000000, casuale: caso(seme), macchina: 'M1', parametri: P, portachiavi: pc });
  let m = nuovo(31); await m.apri(); await m.attiva({ modo: 'nuovo' });
  await m.cifra('vecchia-123'); const g1 = m.stato().gruppo, k1 = voci.get(g1);
  prova('sblocca: la password giusta su un gruppo già aperto risponde ok (prima «Password sbagliata»)', (await m.sblocca('vecchia-123')).ok === true);
  prova('sblocca: una password sbagliata resta sbagliata', (await m.sblocca('sbagliata-000')).codice === 'chiave_sbagliata');
  await m.cifra('nuova-456'); const g2 = m.stato().gruppo;
  // un computer che ricorda solo la chiave di prima (il cambio è avvenuto altrove): la password di prima è «vecchia», non «sbagliata»
  voci.clear(); voci.set(g1, k1);
  m = nuovo(32); await m.apri();
  prova('dopo il cambio, senza la chiave nuova: bloccato', m.stato().gruppo === g2 && !m.stato().chiave);
  prova('sblocca: la password di prima, con la sua chiave già nota, risponde «vecchia» (prima «Password sbagliata»)', (await m.sblocca('vecchia-123')).codice === 'vecchia');
  prova('sblocca: la password nuova apre', (await m.sblocca('nuova-456')).ok === true && m.stato().chiave);
  // una voce che il Portachiavi non ha dato all'avvio (permesso negato): «Dimentica» la toglie lo stesso
  negate.add(g2); m = nuovo(33); await m.apri();
  await m.dimentica();
  prova('dimentica: il portachiavi resta vuoto, anche le voci non decifrate', voci.size === 0, [...voci.keys()]);
  negate.clear(); m = nuovo(34); await m.apri();
  prova('dimentica: col permesso ridato il gruppo non si riapre da solo', !m.stato().chiave);
}

console.log(`${ok} ok, ${ko} no`);
process.exitCode = ko ? 1 : 0;
