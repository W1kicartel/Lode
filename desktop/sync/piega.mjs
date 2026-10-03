// Gli eventi e la piega (docs/SINCRONIZZAZIONE.md §3 e §6). Funzioni pure: niente disco, niente orologio.
// Un evento è { h, dev, t:[ms,c], k, r?, tipo, ...campi }. h è lo SHA-256 (128 bit, hex) della forma canonica senza h: è
// l'identità, e gli eventi formano un insieme. La piega mette l'insieme in un ordine totale, (k, t.ms, t.c, dev, h), e lo
// scorre: registri (vince l'ultimo, prev dice se era contemporaneo), cancellazioni morbide, contatori, importa secondari.
import { createHash } from 'node:crypto';
import { LISTE, RIPASSO, VUOTO, campoDiRecord, tipoPercorso, chiaveLezione } from './schema.mjs';
import { applica, ricordaStato } from '../../js/sm2.js';

// JSON con le chiavi in ordine: stesso contenuto, stesso testo (la forma canonica)
export function canonico(x) {
  if (Array.isArray(x)) return '[' + x.map(v => v === undefined ? 'null' : canonico(v)).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonico(x[k])).join(',') + '}';
  return JSON.stringify(x ?? null);
}
export const sha = (testo, n = 64) => createHash('sha256').update(testo).digest('hex').slice(0, n);
export function impronta(e) { const { h, ...resto } = e; return sha(canonico(resto), 32); }
export const conImpronta = e => ({ ...e, h: impronta(e) });

export const TIPI = new Set(['crea', 'campo', 'cancella', 'ripristina', 'ripasso', 'ricorda', 'conta', 'eventi', 'importa']);
const MAX_MS = 2 ** 53, MAX_C = 2 ** 31;
// un evento ben fatto? 'ok', 'sconosciuto' (tipo o alg più nuovi: si tiene e si ripubblica, non si piega) o 'malformato'
// (quarantena: h sbagliata, orologio impossibile, campi mancanti)
export function valida(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return 'malformato';
  if (typeof e.h !== 'string' || !/^[0-9a-f]{32}$/.test(e.h) || typeof e.dev !== 'string' || !e.dev || typeof e.tipo !== 'string') return 'malformato';
  if (!Array.isArray(e.t) || e.t.length !== 2 || !Number.isInteger(e.t[0]) || e.t[0] < 0 || e.t[0] >= MAX_MS || !Number.isInteger(e.t[1]) || e.t[1] < 0 || e.t[1] >= MAX_C) return 'malformato';
  if (e.k !== 0 && e.k !== 1) return 'malformato';
  if (impronta(e) !== e.h) return 'malformato';
  if (!TIPI.has(e.tipo) || (e.alg !== undefined && e.alg !== 1)) return 'sconosciuto';
  return 'ok';
}
export function confronta(a, b) {
  return a.k - b.k || a.t[0] - b.t[0] || a.t[1] - b.t[1] || (a.dev < b.dev ? -1 : a.dev > b.dev ? 1 : 0) || (a.h < b.h ? -1 : a.h > b.h ? 1 : 0);
}
export const dopo = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
export const tMax = (a, b) => (dopo(a, b) ? a : b);

// la piega di un insieme di eventi (iterabile, anche con doppioni). fonte: gruppo.json.fonte (gli importa con un'altra fonte
// sono secondari, §6.7). Restituisce lo stato piegato; vista(stato) ne fa il D della barra
export const pieghevole = e => TIPI.has(e.tipo) && (e.alg === undefined || e.alg === 1);
export function piega(eventi, { fonte = null } = {}) {
  const tutti = new Map();
  for (const e of eventi) if (e && !tutti.has(e.h)) tutti.set(e.h, e);
  const ord = [...tutti.values()].filter(pieghevole).sort(confronta);
  const p = piegatore({ fonte });
  for (const e of ord) p.applica(e);
  return p.risultato(tutti.size);
}
// la piega un evento alla volta, nell'ordine (k, ms, c, dev, h). Il motore la tiene aperta: un evento che arriva in coda
// all'ordine (quasi sempre: una risposta del ripasso, un campo) si piega da solo, senza rifare tutto (§6.2); uno «nel passato»
// la fa rifare da zero. ultimo: l'ultimo evento piegato (per decidere se il prossimo è in coda)
export function piegatore({ fonte = null } = {}) {
  const recs = new Map(), regs = new Map(), conti = new Map(), secondari = new Map();
  const conflitti = [], mentreCancellato = [], diari = [];
  let ordine = 0, x = 0, t = [0, 0];
  const rec = (lista, id, crea = true) => {
    const k = `${lista}/${id}`;
    if (!recs.has(k) && crea) recs.set(k, { lista, id, vivo: false, nato: false, primo: ordine++, campi: new Map(), ultimo: null });
    return recs.get(k);
  };
  // un record che esiste solo in importa secondari compare se un evento normale lo nomina (§6.7)
  const nomina = (lista, id) => {
    const k = `${lista}/${id}`;
    if (recs.get(k)?.nato) return;
    const s = secondari.get(k); if (!s) return;
    secondari.delete(k);
    const r = rec(lista, id); r.vivo = true; r.nato = true;
    for (const [c, v] of Object.entries(s.campi)) if (!r.campi.has(c)) r.campi.set(c, { v, h: s.h, t: s.t });
  };
  // scrive un registro (mappa campi di un record, o regs). prev: undefined = nessun controllo (crea, importa, eventi da file)
  const scrivi = (mappa, chiave, percorso, v, e, prev) => {
    const cur = mappa.get(chiave);
    if (prev !== undefined && cur && cur.h !== prev && cur.h !== e.h) conflitti.push({ percorso, perdente: cur.v, daPerdente: cur.h, vincente: v, daVincente: e.h });
    mappa.set(chiave, { v, h: e.h, t: e.t });
  };
  let n = 0, ultimo = null;
  function applica1(e) {
    ultimo = e; n++;
    x = (x ^ parseInt(e.h.slice(0, 8), 16)) >>> 0; t = tMax(e.t, t);
    switch (e.tipo) {
      case 'crea': case 'importa': {
        const secondario = e.tipo === 'importa' && e.fonte !== fonte;
        if (e.lista !== undefined) {
          if (!LISTE.includes(e.lista) || typeof e.id !== 'string') break;
          const k = `${e.lista}/${e.id}`;
          if (secondario) { if (!recs.get(k)?.nato && !secondari.has(k)) secondari.set(k, { campi: e.campi || {}, h: e.h, t: e.t }); break; }
          const r = rec(e.lista, e.id); r.vivo = true; r.nato = true; r.ultimo = e.h;
          secondari.delete(k);
          for (const [c, v] of Object.entries(e.campi || {})) {
            if (e.lista === 'carte' && RIPASSO.includes(c)) continue;
            scrivi(r.campi, c, `${k}/${c}`, v, e);
          }
          if (e.lista === 'carte' && RIPASSO.some(c => e.campi?.[c] !== undefined)) scrivi(r.campi, 'ripasso', `${k}/ripasso`, Object.fromEntries(RIPASSO.map(c => [c, e.campi[c] ?? null])), e);
        } else if (typeof e.percorso === 'string' && !secondario) {
          if (tipoPercorso(e.percorso) === 'contatore') conti.set(e.percorso, (conti.get(e.percorso) || 0) + (Number(e.valore) || 0));
          else if (tipoPercorso(e.percorso) !== 'locale') scrivi(regs, e.percorso, e.percorso, e.valore, e);
        }
        break;
      }
      case 'campo': {
        if (typeof e.percorso !== 'string') break;
        const cr = campoDiRecord(e.percorso);
        if (cr) {
          nomina(cr.lista, cr.id);
          const r = rec(cr.lista, cr.id); r.ultimo = e.h;
          if (!r.vivo && r.nato) mentreCancellato.push({ lista: cr.lista, id: cr.id, h: e.h });
          scrivi(r.campi, cr.campo, e.percorso, e.valore, e, e.prev ?? null);
        } else if (tipoPercorso(e.percorso) === 'registro') scrivi(regs, e.percorso, e.percorso, e.valore, e, e.prev ?? null);
        break;
      }
      // SM-2 (§6.6): con q e giorno lo stato diventa sempre sm2.applica(stato di adesso, q, giorno). Se lo studente vedeva
      // proprio quello stato è esattamente ris; se no (ripasso contemporaneo a un altro, o partito da uno stato fresco, #43)
      // contano tutti e due e la storia vera non si perde. Senza q e giorno vince l'ultimo e il perdente va nei conflitti
      case 'ripasso': case 'ricorda': {
        const conQ = Number.isInteger(e.q) && typeof e.giorno === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.giorno);
        if (e.tipo === 'ripasso') {
          if (typeof e.carta !== 'string' || !e.ris) break;
          nomina('carte', e.carta);
          const r = rec('carte', e.carta); r.ultimo = e.h;
          if (!r.vivo && r.nato) mentreCancellato.push({ lista: 'carte', id: e.carta, h: e.h });
          const cur = r.campi.get('ripasso');
          if (conQ && cur) r.campi.set('ripasso', { v: applica(cur.v, e.q, e.giorno), h: e.h, t: e.t });
          else scrivi(r.campi, 'ripasso', `carte/${e.carta}/ripasso`, Object.fromEntries(RIPASSO.map(c => [c, e.ris[c] ?? null])), e, e.prev ?? null);
        } else if (typeof e.mappa === 'string' && typeof e.chiave === 'string') {
          const p = `${e.mappa}/${e.chiave}`, cur = regs.get(p);
          if (conQ && cur && cur.v && typeof cur.v === 'object') regs.set(p, { v: { ...cur.v, ...ricordaStato(cur.v, e.q >= 3, e.q, e.giorno) }, h: e.h, t: e.t });
          else scrivi(regs, p, p, e.ris, e, e.prev ?? null);
        }
        break;
      }
      case 'cancella': case 'ripristina': {
        if (!LISTE.includes(e.lista) || typeof e.id !== 'string') break;
        nomina(e.lista, e.id);
        const r = rec(e.lista, e.id); r.vivo = e.tipo === 'ripristina' && r.nato; r.ultimo = e.h; r.cancellatoDa = e.tipo === 'cancella' ? e : null;
        break;
      }
      case 'conta': if (typeof e.percorso === 'string' && Number.isFinite(e.delta)) conti.set(e.percorso, (conti.get(e.percorso) || 0) + e.delta); break;
      case 'eventi': if (Array.isArray(e.voci)) diari.push(...e.voci); break;
    }
  }
  return {
    applica: applica1,
    get ultimo() { return ultimo; },
    // un evento «mentre lo cancellavi» conta solo se il record è ancora cancellato alla fine
    risultato(totale) {
      const ancora = mentreCancellato.filter(m => !recs.get(`${m.lista}/${m.id}`)?.vivo);
      return { recs, regs, conti, conflitti, mentreCancellato: ancora, secondari: [...secondari.keys()], aggiunte: [...secondari].map(([k, v]) => ({ k, campi: v.campi })), diari, n, x, t, totale };
    },
  };
}

// la mappa percorso → h dell'evento che ha scritto il valore (META, ⊕10): il prev delle modifiche
export function meta(stato) {
  const m = new Map();
  for (const r of stato.recs.values()) for (const [c, w] of r.campi) m.set(`${r.lista}/${r.id}/${c}`, w.h);
  for (const [p, w] of stato.regs) m.set(p, w.h);
  return m;
}

const metti = (D, percorso, v) => {
  const parti = percorso.split('/'); let o = D;
  for (const p of parti.slice(0, -1)) { if (!o[p] || typeof o[p] !== 'object' || Array.isArray(o[p])) o[p] = {}; o = o[p]; }
  o[parti.at(-1)] = v;
};
// lo stato piegato → il D della barra (i record vivi nell'ordine in cui sono nati)
export function vista(stato) {
  const D = VUOTO();
  for (const r of [...stato.recs.values()].sort((a, b) => a.primo - b.primo)) {
    if (!r.vivo) continue;
    const o = { id: r.id };
    for (const [c, w] of r.campi) { if (c === 'ripasso' && r.lista === 'carte') Object.assign(o, w.v); else o[c] = w.v; }
    (D[r.lista] ||= []).push(o);
  }
  for (const [p, w] of [...stato.regs].sort(([a], [b]) => (a < b ? -1 : 1))) metti(D, p, structuredClone(w.v));
  for (const [p, n] of stato.conti) metti(D, p, n);
  // gli eventi dei diari dei progetti: quelli della migrazione (il registro codice/eventi) e poi quelli degli eventi «eventi», in
  // ordine (prima la vista li sostituiva, e quelli importati sparivano appena ne arrivava uno nuovo: trovato al collegamento)
  if (stato.diari.length) D.codice.eventi = [...(Array.isArray(D.codice.eventi) ? D.codice.eventi : []), ...stato.diari];
  return D;
}

// le lezioni vive per chiave (per Orario.md)
export const lezioniVive = stato => [...stato.recs.values()].filter(r => r.lista === 'orario' && r.vivo);
export { chiaveLezione };
