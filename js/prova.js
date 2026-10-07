// «Prova generale»: un compito vecchio intero, con il tempo vero, come all'esame. Prende i temi d'esame (js/temi.js) di un
// compito (stessa fonte e stessa data), li mostra tutti in fila senza soluzioni e fa partire il timer della pillola in una
// fase sua ('prova', js/focus.js). Alla fine (consegna o tempo scaduto) lo studente dice lui com'è andato ogni esercizio:
// Giusto, A metà, Sbagliato, Non fatto. Lode non corregge e non dà voti: somma solo i punti che lo studente si è dato giusti,
// se il compito li scrive. Gli esiti vanno ai temi (tornano a 7 o 3 giorni) e alla mappa del programma, come l'esercizio
// singolo. Dove sta: lo storico in esami[i].prove (al massimo 30); la prova in corso in localStorage 'lode:prova', come il
// focus, così regge a un ricaricamento e alla sospensione del computer (sono orari, non un contatore).
// Il piano (js/programma.js) non si tocca: la prova generale dentro il piano verrà col piano a ore.
import { salva, id, oggi } from './dati.js';
import { esito } from './temi.js';
import { t } from './lingua.js';
import { numeroCorto } from './parole.js';

/* ---------- i compiti interi ---------- */
// il compito di un tema: fonte e data; senza data, fonte e lotto (l'incollatura da cui viene, js/temi.js metti), così due
// compiti incollati senza data non si mescolano. I temi vecchi senza lotto restano insieme, «fonte|»
const chiaveDi = x => `${x.fonte || 'incollato'}|${x.data || x.lotto || ''}`;
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
// un compito dai suoi temi: in ordine di esercizio (quelli senza numero in fondo), la durata (la prima scritta), i punti
// (la somma, solo se ce li hanno tutti) e quando l'hai fatto intero l'ultima volta
function componi(e, chiave, temi) {
  const t = [...temi].sort((a, b) => (a.es == null) - (b.es == null) || (a.es || 0) - (b.es || 0));
  // fonte e data dal primo tema (la chiave può avere il lotto al posto della data); gli esercizi scelti a mano: «scelti»
  const p = t.map(x => num(x.punti)), scelti = chiave.startsWith('scelti|'), fonte = scelti ? 'scelti' : t[0]?.fonte || 'incollato', data = scelti ? null : t[0]?.data || null;
  const fatte = (e.prove || []).filter(x => x.chiave === chiave).map(x => x.g).sort();
  return {
    chiave, fonte, data: data || null, temi: t,
    durata: t.map(x => num(x.durata)).find(x => x != null) ?? null,
    punti: p.length && p.every(x => x != null) ? Math.round(p.reduce((a, b) => a + b, 0) * 100) / 100 : null,
    fatto: fatte.at(-1) || null,
  };
}
// i compiti di un esame: i temi raggruppati per fonte e data, solo quelli con almeno 2 esercizi, i più recenti prima
// (quelli senza data in fondo)
export function compiti(e) {
  const per = new Map();
  for (const x of e?.temi || []) { const k = chiaveDi(x); if (!per.has(k)) per.set(k, []); per.get(k).push(x); }
  return [...per].filter(([, t]) => t.length >= 2).map(([k, t]) => componi(e, k, t))
    .sort((a, b) => (!a.data - !b.data) || (b.data || '').localeCompare(a.data || ''));
}
// quale proporre: il più recente mai fatto intero; se li hai fatti tutti, quello fatto da più tempo
export function scegli(e) {
  const c = compiti(e); if (!c.length) return null;
  return c.find(x => !x.fatto) || [...c].sort((a, b) => a.fatto.localeCompare(b.fatto))[0];
}
// gli esercizi scelti a mano (quando non c'è un compito intero): un compito senza data, chiave «scelti|»
export function daTemi(e, ids) {
  const temi = ids.map(i => (e?.temi || []).find(x => x.id === i)).filter(Boolean);
  return temi.length ? componi(e, 'scelti|', temi) : null;
}
// i minuti da proporre: quelli scritti nel compito (fra 30 e 240, il massimo del timer), se no 120
export const minutiDa = c => c?.durata ? Math.max(30, Math.min(240, Math.round(c.durata))) : 120;

/* ---------- la prova in corso (localStorage, come il timer) ---------- */
const CH = 'lode:prova';
let S = leggi();
function leggi() { try { return JSON.parse(localStorage.getItem(CH)) || null; } catch { return null; } }
function scrivi() { try { S ? localStorage.setItem(CH, JSON.stringify(S)) : localStorage.removeItem(CH); } catch { } }
export const inCorso = () => S;
export function avvia(e, c, min = minutiDa(c), ora = Date.now()) {
  S = { esameId: e.id, chiave: c.chiave, temi: c.temi.map(x => x.id), durata: Math.max(30, Math.min(240, Math.round(min))), inizio: ora, segni: [], consegnata: null };
  scrivi(); return S;
}
// «Passo al prossimo»: segna l'orario, così alla fine si sanno i minuti di ogni esercizio
export function passo(ora = Date.now()) { if (!S || S.consegnata || S.segni.length >= S.temi.length - 1) return S; S.segni.push(ora); scrivi(); return S; }
export const corrente = (s = S) => s ? s.segni.length : 0;
// la consegna (o il tempo scaduto): mai oltre la fine del tempo
export function consegna(ora = Date.now()) { if (!S || S.consegnata) return S; S.consegnata = Math.min(ora, S.inizio + S.durata * 60e3); scrivi(); return S; }
export function togli() { S = null; scrivi(); }
// il compito della prova in corso, rifatto dai temi salvati (null se intanto i temi sono spariti)
export function compitoDi(e, s = S) {
  if (!s) return null;
  const temi = s.temi.map(i => (e?.temi || []).find(x => x.id === i)).filter(Boolean);
  return temi.length ? { ...componi(e, s.chiave, temi), temi } : null;
}
// i minuti di ogni esercizio, solo se hai usato «Passo al prossimo»: da un segno al successivo; l'ultimo segnato fino alla
// consegna; quelli dopo (non arrivati) null
export function minutiDi(s = S) {
  if (!s) return [];
  const fine = s.consegnata || Date.now(), segni = [s.inizio, ...s.segni, fine];
  return s.temi.map((_, i) => !s.segni.length || i > s.segni.length ? null : Math.max(0, Math.round((segni[i + 1] - segni[i]) / 60e3)));
}
export const minutiTotali = (s = S) => s ? Math.min(s.durata, Math.max(0, Math.round(((s.consegnata || Date.now()) - s.inizio) / 60e3))) : 0;

/* ---------- la chiusura: gli esiti li sceglie lo studente ---------- */
export const COME = { giusto: t('prova.giusto'), meta: t('prova.meta'), sbagliato: t('prova.sbagliato'), nonfatto: t('prova.non-fatto') };
// esiti: [{ tema, come, min }]. Ogni esercizio fatto va al suo tema (e alla mappa); «Non fatto» non registra niente.
// La prova finisce in e.prove (le 30 più recenti) e la prova in corso si toglie
export function chiudi(e, c, esiti, { T = oggi(), min = null, durata = null } = {}) {
  const lista = (esiti || []).filter(x => x && x.tema && Object.hasOwn(COME, x.come)).map(x => ({ tema: x.tema, come: x.come, min: num(x.min) }));
  const p = { id: id(), chiave: c?.chiave || 'scelti|', g: T, min: num(min), durata: num(durata), esiti: lista };
  for (const x of lista) if (x.come !== 'nonfatto') esito(e, x.tema, x.come, T);
  e.prove = [...(e.prove || []), p].slice(-30);
  if (S && S.esameId === e.id) togli();
  salva(); return p;
}

/* ---------- il riepilogo: onesto, senza voti ---------- */
// i punti con al più due decimali, nella forma della lingua («7,5» in italiano, «7.5» in inglese)
const puntiScritti = v => numeroCorto(v, 2);
// le frasi dopo il salvataggio: quanti ne hai fatti, dove sei stato di più (se hai segnato i passaggi), i punti che ti sei
// dato giusti (solo se il compito li scrive per tutti gli esercizi: «A metà» non conta) e dove sono finiti gli esiti
export function riepilogo(p, c, { mappa = true } = {}) {
  const es = p?.esiti || [], n = es.length, fatti = es.filter(x => x.come !== 'nonfatto').length, frasi = [];
  frasi.push(t('prova.hai-fatto', { n: fatti, tot: n }));
  const conMin = es.map((x, i) => ({ ...x, i })).filter(x => x.min != null);
  if (conMin.length) {
    const lungo = conMin.reduce((a, b) => b.min > a.min ? b : a), tema = c?.temi?.find(t => t.id === lungo.tema);
    const tot = p.min ?? es.reduce((a, b) => a + (b.min || 0), 0);
    frasi.push(t('prova.sei-stato', { es: tema?.es ?? lungo.i + 1, n: lungo.min, tot }));
  }
  if (c?.punti != null && c.temi?.length) {
    const presi = es.filter(x => x.come === 'giusto').reduce((a, x) => a + (num(c.temi.find(t => t.id === x.tema)?.punti) || 0), 0);
    frasi.push(t('prova.valgono', { n: presi, presi: puntiScritti(presi), tot: puntiScritti(c.punti) }));
  }
  frasi.push(mappa ? t('prova.esiti-nella-mappa') : t('prova.tornano-nei-temi'));
  return frasi;
}
