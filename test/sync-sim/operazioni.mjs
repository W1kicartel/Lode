// Le operazioni dello studente, in un formato comune a tutti i motori. Ognuna cambia il D della barra (js/dati.js: esami,
// carte, orario, memoria, codice.errori, profilo, imp) come lo cambierebbe la barra: applicaOp(D, op) è il riferimento, e un
// motore che lavora per differenze sul D intero (come il v1) può usarlo così com'è.
//
// L'elenco esatto (op.tipo):
//   aggiungiEsame  { id, nome, cfu }                     campoEsame   { id, campo: nome|data|oreObiettivo|voto, valore }
//   cancellaEsame  { id }
//   aggiungiCarta  { id, esameId, fronte, retro }        testoCarta   { id, campo: fronte|retro, valore }
//   ripassaCarta   { id, ripasso: { ease, int, rip, scad } }   (il risultato dell'SM-2, già calcolato dal ripasso)
//   cancellaCarta  { id }
//   incrementa     { dove: errori|giuste, chiave, di }   (codice.errori[chiave] += di; memoria[chiave].giuste += di)
//   profilo        { campo: nome|corso, valore }          impostazione { campo: focus|aspetto|pausa, valore }
//   aggiungiLezione { lezione: { corso, giorni, inizio, fine, aula }, da: lode|obsidian }
//   togliLezione    { lezione, da: lode|obsidian }
// Le lezioni «da: obsidian» non passano da modifica(): il mondo cambia Orario.md sul disco (come lo studente in Obsidian) e
// chiama arrivati(), come il watcher. Le altre passano da modifica(op) del motore.
//
// Nelle storie del fuzzer le operazioni sono «astratte»: invece dell'id portano quale (un numero fra 0 e 1) e risolvi() sceglie
// il record nella vista di quel computer in quel momento. Così togliere un passo dalla storia (per ridurla) non rende
// impossibili gli altri. I valori sono unici (un marcatore «ZQ <n>»): dal valore che lo studente vede si capisce quale
// operazione l'ha scritto (modello.mjs).
import { leggiOrario, orarioMd } from '../../js/markdown.js';
import { applica } from '../../js/sm2.js';
export { leggiOrario, orarioMd };

export const chiaveLezione = o => [o.corso, (o.giorni || []).join(','), o.inizio, o.fine, o.aula || ''].join('|');
const lista = (D, k) => (Array.isArray(D[k]) ? D[k] : (D[k] = []));

export function applicaOp(D, op) {
  const esame = id => lista(D, 'esami').find(e => e.id === id), carta = id => lista(D, 'carte').find(c => c.id === id);
  switch (op.tipo) {
    case 'aggiungiEsame': if (esame(op.id)) return false; lista(D, 'esami').push({ id: op.id, nome: op.nome, cfu: op.cfu ?? 6, voto: null }); return true;
    case 'campoEsame': { const e = esame(op.id); if (!e) return false; e[op.campo] = op.valore; return true; }
    case 'cancellaEsame': { const n = lista(D, 'esami').length; D.esami = D.esami.filter(e => e.id !== op.id); return D.esami.length !== n; }
    case 'aggiungiCarta': if (carta(op.id)) return false; lista(D, 'carte').push({ id: op.id, esameId: op.esameId, fronte: op.fronte, retro: op.retro, ease: 2.5, int: 0, rip: 0, scad: op.scad || '2026-10-03' }); return true;
    case 'testoCarta': { const c = carta(op.id); if (!c) return false; c[op.campo] = op.valore; return true; }
    case 'ripassaCarta': { const c = carta(op.id); if (!c) return false; Object.assign(c, op.ripasso); return true; }
    case 'cancellaCarta': { const n = lista(D, 'carte').length; D.carte = D.carte.filter(c => c.id !== op.id); return D.carte.length !== n; }
    case 'incrementa': {
      if (op.dove === 'errori') { D.codice ||= {}; D.codice.errori ||= {}; D.codice.errori[op.chiave] = (D.codice.errori[op.chiave] || 0) + op.di; return true; }
      D.memoria ||= {}; const m = D.memoria[op.chiave] ||= { giuste: 0, sbagliate: 0 }; m.giuste = (m.giuste || 0) + op.di; return true;
    }
    case 'profilo': (D.profilo ||= {})[op.campo] = op.valore; return true;
    case 'impostazione': (D.imp ||= {})[op.campo] = op.valore; return true;
    case 'aggiungiLezione': { const l = lista(D, 'orario'); if (l.some(o => chiaveLezione(o) === chiaveLezione(op.lezione))) return false; l.push({ id: 'o' + Math.abs(hash(chiaveLezione(op.lezione))).toString(36), ...op.lezione }); return true; }
    case 'togliLezione': { const n = lista(D, 'orario').length; D.orario = D.orario.filter(o => chiaveLezione(o) !== chiaveLezione(op.lezione)); return D.orario.length !== n; }
    default: throw new Error('operazione sconosciuta: ' + op.tipo);
  }
}
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };

// SM-2, come js/dati.js (ricorda): q da 0 a 5
export function sm2(c, q, oggi = '2026-10-03') {
  let ease = Number(c.ease) || 2.5, int = Number(c.int) || 0, rip = Number(c.rip) || 0;
  if (q < 3) { rip = 0; int = 1; } else { rip += 1; int = rip === 1 ? 1 : rip === 2 ? 6 : Math.round(int * ease); }
  ease = Math.max(1.3, Math.round((ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)) * 100) / 100);
  const d = new Date(oggi + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + int);
  return { ease, int, rip, scad: d.toISOString().slice(0, 10) };
}

const ordinati = l => [...(l || [])].filter(x => x && typeof x.id === 'string').sort((a, b) => (a.id < b.id ? -1 : 1));
const sceglie = (l, q) => l.length ? l[Math.min(l.length - 1, Math.floor((q ?? 0) * l.length))] : null;
// dall'operazione astratta a quella vera, nella vista D del computer. null: non si può (niente esami, niente carte…)
export function risolvi(op, D) {
  if (!op.quale && op.quale !== 0) return op;
  const x = { ...op }; delete x.quale;
  switch (op.tipo) {
    case 'campoEsame': case 'cancellaEsame': { const e = sceglie(ordinati(D.esami), op.quale); if (!e) return null; x.id = e.id; return x; }
    case 'aggiungiCarta': { const e = sceglie(ordinati(D.esami), op.quale); if (!e) return null; x.esameId = e.id; return x; }
    case 'testoCarta': case 'cancellaCarta': { const c = sceglie(ordinati(D.carte), op.quale); if (!c) return null; x.id = c.id; return x; }
    // ritocco (a): il ripasso porta anche q e giorno (la data locale di chi ripassa: la mette il mondo), e il risultato è quello
    // di js/sm2.js, lo stesso calcolo della barra
    case 'ripassaCarta': { const c = sceglie(ordinati(D.carte), op.quale); if (!c) return null; x.id = c.id; x.q = op.q ?? 4; x.giorno = op.giorno || '2026-10-03'; x.ripasso = applica(c, x.q, x.giorno); return x; }
    case 'togliLezione': { const l = [...(D.orario || [])].sort((a, b) => chiaveLezione(a) < chiaveLezione(b) ? -1 : 1), o = sceglie(l, op.quale); if (!o) return null; x.lezione = { corso: o.corso, giorni: o.giorni, inizio: o.inizio, fine: o.fine, aula: o.aula || '' }; return x; }
    default: return x;
  }
}

// il generatore: un'operazione astratta a caso (r: caso() di comune.mjs; n(): un numero nuovo per i valori unici)
export function generaOp(r, n) {
  const k = n(), z = `ZQ ${k}`;
  const giorni = [r.intero(0, 4)], h = r.intero(8, 16);
  const tipi = [
    [8, () => ({ tipo: 'aggiungiEsame', id: `e${k}`, nome: `Esame ${z}`, cfu: r.scegli([6, 9, 12]) })],
    [10, () => ({ tipo: 'campoEsame', quale: r(), campo: r.scegli(['nome', 'data', 'oreObiettivo']), valore: null })],
    [2, () => ({ tipo: 'cancellaEsame', quale: r() })],
    [6, () => ({ tipo: 'aggiungiCarta', quale: r(), id: `c${k}`, fronte: `Fronte ${z}`, retro: `Retro ${z}` })],
    [6, () => ({ tipo: 'testoCarta', quale: r(), campo: r.scegli(['fronte', 'retro']), valore: `Testo ${z}` })],
    [8, () => ({ tipo: 'ripassaCarta', quale: r(), q: r.intero(1, 5) })],
    [2, () => ({ tipo: 'cancellaCarta', quale: r() })],
    [8, () => ({ tipo: 'incrementa', dove: r.scegli(['errori', 'giuste']), chiave: r.scegli(['k1', 'k2', 'k3']), di: r.intero(1, 3) })],
    [5, () => ({ tipo: 'profilo', campo: r.scegli(['nome', 'corso']), valore: `Profilo ${z}` })],
    [4, () => ({ tipo: 'impostazione', campo: r.scegli(['focus', 'pausa']), valore: 100 + k })],
    [5, () => ({ tipo: 'aggiungiLezione', da: r.vero(0.5) ? 'lode' : 'obsidian', lezione: { corso: `Corso ${z}`, giorni, inizio: `${String(h).padStart(2, '0')}:00`, fine: `${String(h + 2).padStart(2, '0')}:00`, aula: `A${k}` } })],
    [3, () => ({ tipo: 'togliLezione', da: r.vero(0.5) ? 'lode' : 'obsidian', quale: r() })],
  ];
  const tot = tipi.reduce((s, [p]) => s + p, 0);
  let x = r() * tot;
  for (const [p, f] of tipi) { if ((x -= p) < 0) { const op = f(); if (op.tipo === 'campoEsame') op.valore = op.campo === 'oreObiettivo' ? 1000 + k : op.campo === 'data' ? `2027-${z}` : `Esame ${z}`; return op; } }
  return tipi[0][1]();
}

// in italiano, per le storie ridotte
export function descrivi(op) {
  const L = o => `«${o.corso} ${o.inizio}-${o.fine}»`;
  switch (op.tipo) {
    case 'aggiungiEsame': return `aggiunge l'esame ${op.id} «${op.nome}»`;
    case 'campoEsame': return `mette ${op.campo} = ${JSON.stringify(op.valore)} all'esame ${op.id ?? '#' + (op.quale ?? 0).toFixed(2)}`;
    case 'cancellaEsame': return `cancella l'esame ${op.id ?? '#' + (op.quale ?? 0).toFixed(2)}`;
    case 'aggiungiCarta': return `aggiunge la carta ${op.id} «${op.fronte}»${op.esameId ? ` (esame ${op.esameId})` : ''}`;
    case 'testoCarta': return `cambia ${op.campo} della carta ${op.id ?? '#' + (op.quale ?? 0).toFixed(2)} in «${op.valore}»`;
    case 'ripassaCarta': return op.ripasso ? `ripassa la carta ${op.id} → ${JSON.stringify(op.ripasso)}` : `ripassa la carta #${(op.quale ?? 0).toFixed(2)} (q=${op.q})`;
    case 'cancellaCarta': return `cancella la carta ${op.id ?? '#' + (op.quale ?? 0).toFixed(2)}`;
    case 'incrementa': return `${op.dove === 'errori' ? 'codice.errori' : 'memoria.giuste'}[${op.chiave}] += ${op.di}`;
    case 'profilo': return `profilo.${op.campo} = «${op.valore}»`;
    case 'impostazione': return `imp.${op.campo} = ${JSON.stringify(op.valore)}`;
    case 'aggiungiLezione': return `${op.da === 'obsidian' ? 'in Obsidian, in Orario.md, ' : ''}aggiunge la lezione ${L(op.lezione)}`;
    case 'togliLezione': return `${op.da === 'obsidian' ? 'in Obsidian, in Orario.md, ' : ''}toglie la lezione ${op.lezione ? L(op.lezione) : '#' + (op.quale ?? 0).toFixed(2)}`;
    default: return JSON.stringify(op);
  }
}

// i dati iniziali (il dati.json di prima della sincronizzazione), con i marcatori
export function datiIniziali() {
  return {
    v: 1, profilo: { nome: 'Ada ZQ 1', corso: 'Fisica ZQ 2', cfuTotali: 180, lode: 30 },
    esami: [{ id: 'e1', nome: 'Analisi ZQ 3', cfu: 9, voto: 28, data: '2026-01-10' }, { id: 'e2', nome: 'Fisica ZQ 4', cfu: 6, voto: null, oreObiettivo: 50 }],
    carte: [{ id: 'c1', esameId: 'e1', fronte: 'Ohm ZQ 5', retro: 'V = R·I ZQ 6', ease: 2.36, int: 15, rip: 4, scad: '2026-10-20' }],
    orario: [{ id: 'o1', corso: 'Analisi ZQ 7', giorni: [0, 2], inizio: '09:00', fine: '11:00', aula: '7' }],
    sessioni: [], lezioni: [], memoria: { k1: { giuste: 3, sbagliate: 1 } },
    codice: { memoria: {}, errori: { k2: 2 }, eventi: [], diari: {}, opzioni: {} },
    imp: { focus: 50, pausa: 5, voceAlta: false, chiave: '', aspetto: 'chiaro', suoni: true, suggerimenti: true, ultimoSuggerimento: 0 }, benvenuto: true,
  };
}
