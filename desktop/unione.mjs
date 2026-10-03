// L'unione dei dati di Lode fra i computer dello studente (docs/SINCRONIZZAZIONE.md). Funzioni pure, senza file: si provano
// in Node (test/sincronizza.mjs). Il D di js/dati.js si scompone in «registri» (un esame, una carta, un campo del profilo…),
// ognuno col suo timbro [ms, dispositivo]; le cancellazioni sono lapidi; i contatori sono per dispositivo, con un'«epoca» che
// li azzera. unisci() è commutativa, associativa e idempotente: l'ordine in cui arrivano i file non conta, e rileggere un
// file già unito non cambia niente. Lo stato S:
//   S.r  chiave → { v: valore, t: timbro, n?: timbro di nascita (ordine delle liste) }
//   S.x  chiave del record → timbro della lapide
//   S.c  chiave del contatore → { z: timbro dell'ultimo azzeramento | null, d: { dispositivo: [z, n] } }
//   S.o  il timbro più alto visto (orologio ibrido: un computer col tempo indietro non «perde» quello che ha già visto)
import { createHash } from 'node:crypto';

export const ID_DISPOSITIVO = /^[0-9a-f]{16}$/, MIGRAZIONE = 'migrazione';
const VIETATE = new Set(['__proto__', 'constructor', 'prototype']);
// dentro le chiavi: «/» separa la raccolta dal record, «:» i campi sparsi, SEP il gruppo o il contatore di un record
// (un carattere che non sta mai in un id, in una chiave SM-2 o nel nome di un progetto)
const SEP = '\u0001', CAMPO = '.';
const devOk = d => typeof d === 'string' && (ID_DISPOSITIVO.test(d) || d === MIGRAZIONE);
export const timbroOk = t => Array.isArray(t) && t.length === 2 && Number.isFinite(t[0]) && t[0] >= 0 && t[0] <= 8.64e15 && devOk(t[1]);
// un timbro più avanti di un anno non viene da un orologio vero: da un file rovinato o scritto ad arte. Si scarta (e si dice),
// se no ogni modifica fatta dopo su questo computer avrebbe un timbro «più vecchio» e sparirebbe all'unione
export const FUTURO = 365 * 864e5;
// vince il più recente; a parità di millisecondi l'id più grande (regola fissa, uguale su ogni computer)
export const confronta = (a, b) => (a ? 1 : 0) - (b ? 1 : 0) || (!a ? 0 : a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
const max = (a, b) => confronta(a, b) >= 0 ? a : b;
const ogg = x => !!x && typeof x === 'object' && !Array.isArray(x);
// JSON con le chiavi in ordine: lo stesso contenuto dà lo stesso testo su ogni computer
export function stabile(x) {
  if (Array.isArray(x)) return '[' + x.map(v => v === undefined ? 'null' : stabile(v)).join(',') + ']';
  if (ogg(x)) return '{' + Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stabile(x[k])).join(',') + '}';
  return JSON.stringify(x ?? null);
}
const impronta = x => createHash('sha256').update(stabile(x)).digest('hex').slice(0, 16);
export const vuoto = () => ({ r: {}, x: {}, c: {}, o: [0, MIGRAZIONE] });

/* ---------- lo schema: come si scompone D ---------- */
// lista: array di record con identità (id, oppure il contenuto); mappa: oggetto chiave → valore; conti: oggetto chiave → numero.
// gruppo: campi con un timbro a parte (le carte: il testo da una parte, il ripasso SM-2 dall'altra).
// perCampo: ogni campo del record è un registro a sé («esami/e2␁.voto»): il voto messo su un computer e le ore obiettivo
// cambiate sull'altro restano tutti e due (così anche il fronte e il retro di una carta, il titolo e le stelle di una lezione).
// Il registro del record («esami/e2», solo l'id) tiene identità, ordine e lapide.
// conti: i campi contatore di una mappa (giuste/sbagliate delle memorie SM-2). perTempo: si ordinano col campo t.
const RIPASSO = ['ease', 'int', 'rip', 'scad'];
const RACCOLTE = [
  { p: 'esami', tipo: 'lista', perCampo: true }, { p: 'sessioni', tipo: 'lista', perCampo: true }, { p: 'carte', tipo: 'lista', gruppo: RIPASSO, perCampo: true }, { p: 'lezioni', tipo: 'lista', perCampo: true },
  // l'orario si rilegge da Orario.md con id nuovi ogni volta: l'identità è il contenuto, e l'id lo rifà l'unione
  { p: 'orario', tipo: 'lista', chiave: o => 'o' + impronta([o.corso, o.giorni, o.inizio, o.fine, o.aula ?? '']), senzaId: true },
  { p: 'memoria', tipo: 'mappa', conti: ['giuste', 'sbagliate'] }, { p: 'codice.memoria', tipo: 'mappa', conti: ['giuste', 'sbagliate'] },
  { p: 'codice.errori', tipo: 'conti' },
  // i registri di eventi: si cambiano solo aggiungendo (e «passi» dentro un evento); due eventi uguali restano due
  { p: 'codice.eventi', tipo: 'lista', chiave: e => `${e.t}|${e.tipo}|${impronta({ ...e, passi: undefined })}`, conta: true, perTempo: true },
  { p: 'codice.diari', tipo: 'mappa' }, { p: 'codice.opzioni', tipo: 'mappa' },
  { p: 'allenatore.storia', tipo: 'lista', chiave: x => impronta(x), conta: true },
];
// i campi sparsi, uno per registro. imp.chiave (la chiave AI) non entra mai: resta su questo computer
const CAMPI = { profilo: [], imp: ['chiave'], allenatore: ['storia'], codice: ['memoria', 'errori', 'eventi', 'diari', 'opzioni'],
  radice: ['esami', 'sessioni', 'carte', 'orario', 'lezioni', 'memoria', 'profilo', 'imp', 'codice', 'allenatore', '__rev', '__errore'] };
const prendi = (D, p) => p.split('.').reduce((x, k) => ogg(x) ? x[k] : undefined, D);
const togli = (o, campi) => { const c = { ...o }; for (const k of campi) delete c[k]; return c; };
const solo = (o, campi) => Object.fromEntries(campi.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

// D → { reg: chiave → valore, conti: chiave → numero, ordine: chiave → posizione }
export function registri(D) {
  const reg = {}, conti = {}, ordine = {};
  if (!ogg(D)) return { reg, conti, ordine };
  for (const R of RACCOLTE) {
    const x = prendi(D, R.p);
    if (R.tipo === 'lista') {
      if (!Array.isArray(x)) continue;
      const visti = {};
      x.forEach((el, i) => {
        if (!ogg(el)) return;
        let k = R.chiave ? R.chiave(el) : typeof el.id === 'string' && el.id ? el.id : '~' + impronta(el);
        if (R.conta) { visti[k] = (visti[k] || 0) + 1; if (visti[k] > 1) k += '~' + visti[k]; }
        if (VIETATE.has(k)) return;
        const base = `${R.p}/${k}`;
        let v = R.senzaId ? togli(el, ['id']) : el;
        if (R.gruppo) { reg[base + SEP + 'r'] = solo(v, R.gruppo); v = togli(v, R.gruppo); }
        if (R.perCampo) {
          for (const [c, x] of Object.entries(v)) if (c !== 'id' && x !== undefined && !VIETATE.has(c)) reg[base + SEP + CAMPO + c] = x;
          v = typeof v.id === 'string' ? { id: v.id } : {};
        }
        reg[base] = v; ordine[base] = i;
      });
    } else if (R.tipo === 'mappa') {
      if (!ogg(x)) continue;
      for (const [k, v] of Object.entries(x)) {
        if (VIETATE.has(k)) continue;
        const base = `${R.p}/${k}`;
        if (R.conti && ogg(v)) { for (const c of R.conti) if (Number.isFinite(v[c])) conti[base + SEP + c] = v[c]; reg[base] = togli(v, R.conti); }
        else reg[base] = v;
      }
    } else if (ogg(x)) for (const [k, v] of Object.entries(x)) if (!VIETATE.has(k) && Number.isFinite(+v) && +v) conti[`${R.p}/${k}`] = +v;
  }
  for (const [c, esclusi] of Object.entries(CAMPI)) {
    const x = c === 'radice' ? D : D[c];
    if (!ogg(x)) continue;
    for (const [k, v] of Object.entries(x)) if (!esclusi.includes(k) && !VIETATE.has(k) && v !== undefined) reg[`${c}:${k}`] = v;
  }
  return { reg, conti, ordine };
}
// il record a cui appartiene un registro o un contatore: «carte/abc␁r» → «carte/abc»
const recordDi = k => k.split(SEP)[0];

/* ---------- i contatori ---------- */
// valore = somma dei dispositivi che hanno contato nell'epoca attuale (z). Azzerare = nuova epoca: i conti vecchi non valgono
// più, anche quelli fatti nello stesso momento su un altro computer (vince l'azzeramento, come vince una lapide)
const stessaEpoca = (a, b) => (a == null && b == null) || (!!a && !!b && confronta(a, b) === 0);
export const valoreConto = c => !c ? 0 : Object.values(c.d).reduce((s, [z, n]) => s + (stessaEpoca(z, c.z) ? n : 0), 0);
function unisciConto(a, b) {
  if (!a || !b) return structuredClone(a || b);
  const z = confronta(a.z, b.z) >= 0 ? a.z : b.z, d = {};
  for (const dev of new Set([...Object.keys(a.d), ...Object.keys(b.d)])) {
    const x = a.d[dev], y = b.d[dev], w = !x ? y : !y ? x : (confronta(x[0], y[0]) || x[1] - y[1]) >= 0 ? x : y;   // epoca più nuova, poi il conto più alto
    if (stessaEpoca(w[0], z)) d[dev] = [w[0], w[1]];   // le epoche vecchie non torneranno: si tolgono
  }
  return { z, d };
}

/* ---------- unire due stati ---------- */
export function unisci(a, b) {
  const S = vuoto();
  for (const k of new Set([...Object.keys(a.r), ...Object.keys(b.r)])) {
    const x = a.r[k], y = b.r[k];
    if (!x || !y) { S.r[k] = structuredClone(x || y); continue; }
    const o = confronta(x.t, y.t), w = o > 0 ? x : o < 0 ? y : stabile(x.v) >= stabile(y.v) ? x : y;   // stesso timbro, valori diversi: regola fissa
    S.r[k] = { v: structuredClone(w.v), t: w.t };
    const n = x.n && y.n ? (confronta(x.n, y.n) <= 0 ? x.n : y.n) : x.n || y.n;
    if (n) S.r[k].n = n;
  }
  for (const k of new Set([...Object.keys(a.x), ...Object.keys(b.x)])) S.x[k] = max(a.x[k], b.x[k]) || a.x[k] || b.x[k];
  for (const k of new Set([...Object.keys(a.c), ...Object.keys(b.c)])) S.c[k] = unisciConto(a.c[k], b.c[k]);
  S.o = max(a.o, b.o);
  return S;
}

/* ---------- da uno stato a D ---------- */
// un registro vale se è più recente della lapide del suo record
const vivo = (S, k) => !!S.r[k] && confronta(S.r[k].t, S.x[recordDi(k)]) > 0;
export function vista(S) {
  const D = { v: 1 }, metti = (p, v) => { const ks = p.split('.'); let o = D; for (const k of ks.slice(0, -1)) o = o[k] ||= {}; o[ks.at(-1)] = v; };
  const perRaccolta = {}, campi = {};
  for (const k of Object.keys(S.r)) {
    const i = k.indexOf('/'), j = k.indexOf(SEP);
    if (i > 0 && j < 0) (perRaccolta[k.slice(0, i)] ||= []).push(k);
    else if (i > 0 && k[j + 1] === CAMPO) (campi[k.slice(0, j)] ||= []).push(k.slice(j + 2));
  }
  for (const R of RACCOLTE) {
    const chiavi = (perRaccolta[R.p] || []).filter(k => vivo(S, k));
    if (R.tipo === 'lista') {
      const el = chiavi.map(k => {
        let v = ogg(S.r[k].v) ? { ...S.r[k].v } : S.r[k].v;
        // il gruppo (il ripasso SM-2 di una carta) vale finché il record è vivo, anche se è più vecchio della lapide: una carta
        // cancellata su un computer e corretta nel testo sull'altro torna con il suo ripasso, non senza scadenza
        if (R.gruppo && ogg(v) && S.r[k + SEP + 'r'] && ogg(S.r[k + SEP + 'r'].v)) Object.assign(v, S.r[k + SEP + 'r'].v);
        // il record è vivo (il suo registro ha l'ultima modifica, vedi applica): ci sono tutti i suoi campi
        if (R.perCampo && ogg(v)) for (const c of (campi[k] || []).sort()) v[c] = structuredClone(S.r[k + SEP + CAMPO + c].v);
        if (R.senzaId && ogg(v)) v = { id: k.slice(R.p.length + 1), ...v };
        return { k, v, n: S.r[k].n || S.r[k].t };
      });
      el.sort((a, b) => (R.perTempo ? (+a.v?.t || 0) - (+b.v?.t || 0) : confronta(a.n, b.n)) || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
      metti(R.p, el.map(x => x.v));
    } else if (R.tipo === 'mappa') {
      const m = {};
      for (const k of chiavi.sort()) {
        let v = S.r[k].v;
        if (R.conti && ogg(v)) { v = { ...v }; for (const c of R.conti) v[c] = valoreConto(S.c[k + SEP + c]); }
        m[k.slice(R.p.length + 1)] = v;
      }
      metti(R.p, m);
    } else {
      const m = {};
      for (const k of Object.keys(S.c).filter(k => k.startsWith(R.p + '/')).sort()) { const v = valoreConto(S.c[k]); if (v) m[k.slice(R.p.length + 1)] = v; }
      metti(R.p, m);
    }
  }
  for (const k of Object.keys(S.r).filter(k => /^[a-z]+:/.test(k) && !k.includes(SEP) && vivo(S, k)).sort()) {
    const [c, campo] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
    if (c === 'radice') { if (!CAMPI.radice.includes(campo)) D[campo] = structuredClone(S.r[k].v); }
    else if (CAMPI[c] && !CAMPI[c].includes(campo)) (D[c] = ogg(D[c]) ? D[c] : {})[campo] = structuredClone(S.r[k].v);
  }
  D.v = 1; D.profilo ||= {}; D.imp ||= {};
  if (!D.allenatore?.storia?.length && Object.keys(D.allenatore || {}).length === 1) delete D.allenatore;   // solo la storia vuota: come se non ci fosse
  return D;
}
// la vista come la vede la barra: gli stessi valori di partenza di js/dati.js (VUOTO e unisci, inForma per gli esami). La base
// del confronto a tre vie deve essere questa: un campo che la barra riempie col suo valore di partenza (il profilo non ancora
// arrivato dall'altro computer) non è una modifica, e non deve prendere un timbro nuovo che poi vincerebbe sui dati veri.
// test/sincronizza.mjs controlla che resti uguale a js/dati.js
export const VUOTO_BARRA = () => ({ v: 1, profilo: { nome: '', corso: '', cfuTotali: 180, lode: 30 }, esami: [], sessioni: [], carte: [], orario: [], lezioni: [], memoria: {},
  codice: { memoria: {}, errori: {}, eventi: [], diari: {}, opzioni: {} },
  imp: { focus: 25, pausa: 5, voceAlta: false, chiave: '', aspetto: 'scuro', suoni: true, suggerimenti: true, ultimoSuggerimento: 0 }, benvenuto: false });
const ID_BARRA = /^[\w-]{1,40}$/;
const inForma = e => ({ ...e, cfu: Number(e.cfu) || 6, voto: e.voto !== null && e.voto !== '' && Number.isInteger(+e.voto) && +e.voto >= 18 && +e.voto <= 30 ? +e.voto : null,
  ...(e.oreObiettivo != null ? { oreObiettivo: Number(e.oreObiettivo) || null } : {}) });
export function normalizza(d) {
  const V = VUOTO_BARRA();
  return { ...V, ...d, esami: Array.isArray(d?.esami) ? d.esami.filter(e => ogg(e) && ID_BARRA.test(e.id)).map(inForma) : [],
    profilo: { ...V.profilo, ...d?.profilo }, imp: { ...V.imp, ...d?.imp }, codice: { ...V.codice, ...d?.codice } };
}
// la «firma» di un D: lo stesso contenuto (anche in un altro ordine) dà la stessa firma
export function firma(D) {
  const { reg, conti } = registri(D);
  return stabile({ reg, conti });
}

/* ---------- le modifiche di questo computer ---------- */
// l'orologio ibrido: mai indietro rispetto a quello che si è già visto
export function timbro(S, dev, ora = Date.now()) {
  const t = [Math.min(8.64e15, Math.max(Math.floor(ora), (S.o?.[0] || 0) + 1)), dev];
  S.o = max(S.o, t); return t;
}
// confronta il D da cui la barra è partita (base) con quello che manda adesso (nuovo): quello che è cambiato prende un timbro
// nuovo, quello che manca una lapide, i contatori la differenza. Si confronta con la base e non con lo stato attuale: una
// modifica arrivata dall'altro computer mentre la barra lavorava non sembra «tolta». Restituisce quante cose sono cambiate
// senzaCancellazioni: solo aggiunte e modifiche (niente lapidi, campi tolti o contatori azzerati), quando la base non è sicura
// (una finestra con una versione che il motore non conosce): quello che manca non vuol dire «cancellato»
// soloNuovi: la base è il D vuoto della barra (partita coi dati bloccati): un record che c'è già nello stato (una memoria SM-2,
// una carta, un campo del profilo) la barra l'ha rifatto da capo, non l'ha cambiato. Entrano solo i record nuovi e i conteggi
export function applica(S, base, nuovo, dev, ora = Date.now(), { senzaCancellazioni = false, soloNuovi = false } = {}) {
  const B = registri(base), N = registri(nuovo);
  if (soloNuovi) senzaCancellazioni = true;
  const noti = soloNuovi ? new Set([...Object.keys(S.r).map(recordDi), ...Object.keys(S.x)]) : null;
  let t = null, n = 0;
  const T = () => (t ||= timbro(S, dev, ora));
  for (const [k, v] of Object.entries(N.reg)) {
    if (k in B.reg && stabile(B.reg[k]) === stabile(v)) continue;
    if (noti && noti.has(recordDi(k))) continue;
    // stesso valore già nello stato (per esempio l'orario riletto da Orario.md anche sull'altro computer): niente timbro nuovo
    if (vivo(S, k) && stabile(S.r[k].v) === stabile(v) && vivo(S, recordDi(k))) continue;
    const rec = recordDi(k), nato = k === rec && vivo(S, k) ? S.r[k].n : null;
    S.r[k] = { v: structuredClone(v), t: T(), ...(k === rec && /\//.test(k) ? { n: nato || T() } : {}) };
    // un campo di un record perCampo: anche il registro del record prende il timbro, che resta quello dell'ultima modifica.
    // Così una modifica fatta dopo una cancellazione fatta altrove riporta il record intero (come per gli altri record)
    if (k !== rec && k.includes(SEP + CAMPO) && S.r[rec]) S.r[rec] = { ...S.r[rec], t: T() };
    n++;
  }
  for (const k of senzaCancellazioni ? [] : Object.keys(B.reg)) {
    if (k in N.reg) continue;
    // un campo tolto da un record che resta (per esempio le ore obiettivo cancellate): vale null, col suo timbro
    if (recordDi(k) !== k) {
      const rec = recordDi(k);
      if (k.includes(SEP + CAMPO) && rec in N.reg && S.r[k] && S.r[k].v !== null) { S.r[k] = { v: null, t: T() }; if (S.r[rec]) S.r[rec] = { ...S.r[rec], t: T() }; n++; }
      continue;
    }
    if (!vivo(S, k)) continue;
    S.x[k] = T(); n++;
  }
  for (const k of new Set([...Object.keys(B.conti), ...Object.keys(N.conti)])) {
    const b = B.conti[k] || 0, v = N.conti[k] || 0, delta = v - b;
    if (!delta || (delta < 0 && senzaCancellazioni)) continue;
    const c = S.c[k] ||= { z: null, d: {} }, prima = valoreConto(c);
    if (delta > 0) { const mio = c.d[dev]; c.d[dev] = mio && stessaEpoca(mio[0], c.z) ? [mio[0], mio[1] + delta] : [c.z, delta]; }
    else {   // meno di prima: un azzeramento (record cancellato, «Cancella tutto») o una correzione
      const z = T(); c.z = z; c.d = { [dev]: [z, v === 0 ? 0 : Math.max(0, v + (prima - b))] };
    }
    n++;
  }
  return n;
}

/* ---------- la migrazione da dati.json ---------- */
// i record entrano col timbro [mtime del file, «migrazione»] e i contatori sul dispositivo finto «migrazione»: due computer
// che migrano lo stesso dati.json ottengono gli stessi registri, senza doppioni né doppi conteggi. L'ordine delle liste resta
export function daDati(D, ms) {
  const S = vuoto(), t = [Math.max(1, Math.floor(+ms || 1)), MIGRAZIONE], { reg, conti, ordine } = registri(D);
  for (const [k, v] of Object.entries(reg)) S.r[k] = { v: structuredClone(v), t, ...(k in ordine ? { n: [ordine[k] + 1, MIGRAZIONE] } : {}) };
  for (const [k, v] of Object.entries(conti)) S.c[k] = { z: null, d: { [MIGRAZIONE]: [null, v] } };
  S.o = t;
  return S;
}

/* ---------- uno stato letto da un file: si controlla tutto ---------- */
// i file dei dispositivi arrivano dalla cartella cloud: chi può scriverci può metterci di tutto. Quello che non torna si scarta
// (S.scartati: quanti registri avevano un timbro troppo nel futuro, per dirlo). ora: il riferimento del limite nel futuro,
// che il chiamante prende come il più alto fra l'orologio e i timbri già accettati (un orologio indietro non scarta niente);
// Infinity per i propri file (il proprio file e la copia locale non perdono mai registri)
export function valida(x, ora = Date.now()) {
  if (!ogg(x) || !ogg(x.r) || !ogg(x.x) || !ogg(x.c)) return null;
  const S = vuoto(), lim = ora + FUTURO;
  let scartati = 0;
  const ok = t => { if (!timbroOk(t)) return false; if (t[0] > lim) { scartati++; return false; } return true; };
  for (const [k, g] of Object.entries(x.r)) {
    if (VIETATE.has(k) || typeof k !== 'string' || !ogg(g) || !ok(g.t) || g.v === undefined || (g.n != null && !ok(g.n))) continue;
    S.r[k] = { v: g.v, t: [g.t[0], g.t[1]], ...(g.n ? { n: [g.n[0], g.n[1]] } : {}) };
    S.o = max(S.o, g.t);
  }
  for (const [k, t] of Object.entries(x.x)) if (!VIETATE.has(k) && ok(t)) { S.x[k] = [t[0], t[1]]; S.o = max(S.o, t); }
  for (const [k, c] of Object.entries(x.c)) {
    if (VIETATE.has(k) || !ogg(c) || !ogg(c.d) || (c.z != null && !ok(c.z))) continue;
    const d = {};
    for (const [dev, e] of Object.entries(c.d)) if (devOk(dev) && Array.isArray(e) && e.length === 2 && (e[0] == null || ok(e[0])) && Number.isFinite(e[1]) && e[1] >= 0) d[dev] = [e[0] ?? null, e[1]];
    S.c[k] = { z: c.z ?? null, d };
    if (c.z) S.o = max(S.o, c.z);
  }
  if (scartati) Object.defineProperty(S, 'scartati', { value: scartati, enumerable: false });
  return S;
}
