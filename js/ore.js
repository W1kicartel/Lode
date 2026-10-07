// Il piano per chi lavora: le ore vere di ogni giorno e più esami in un calendario solo.
// Due studenti su tre lavorano mentre studiano: un piano che conta solo gli argomenti («3 argomenti oggi») non sa che il
// martedì attacchi al bar alle 14. Qui ogni giorno ha i suoi minuti liberi (la finestra di studio, meno le lezioni, meno i
// turni con mezz'ora per il viaggio, meno le ore di silenzio, con un tetto: nei giorni di lavoro poco) e il piano di
// ogni esame (programma.js, piano()) si riempie a minuti. Quando un giorno è troppo pieno si toglie prima dall'esame più
// lontano e si sposta più avanti; quello che non ci sta resta in «mancano», con le opzioni per farcelo stare (solo con un
// clic dello studente: Lode non sceglie al posto suo). Tutto senza AI e senza rete, i conti sono qui.
// Dove sta: in D.imp (lavoro, studio, oreScelte), così la sincronizzazione lo porta già. Se manca, non lavori: il piano
// resta quello di programma.js, identico (un esame solo, niente lavoro, niente finestra di studio).
import { D, salva, oggi, piuGiorni, giorniTra, prossimi, isoGiorno } from './dati.js';
import * as PG from './programma.js';
import * as TE from './temi.js';

/* ---------- ore e minuti ---------- */
const minDi = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
// «14:00» → «14», «14:30» → «14:30» (per le righe: «lavoro 14–19»)
export const ora = hhmm => { const m = minDi(hhmm); return m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : String(m / 60); };
export const STIMA = { studia: 60, ripassa: 25, generale: 25 };
const VIAGGIO = 30, TETTO_LAVORO = 120, TETTO_LIBERO = 360, FINESTRA = { da: '09:00', a: '20:00' }, ENTRO = 45;
const giu15 = m => Math.max(0, Math.floor(m / 15) * 15), su15 = m => Math.ceil(m / 15) * 15;
// tutti i tempi per lo studente: «circa», in multipli di 15 minuti. ore: «circa 14 ore» invece di «circa 14 h»
export function circa(min, { ore = false } = {}) {
  const r = Math.max(15, Math.round(min / 15) * 15), h = Math.floor(r / 60), m = r % 60;
  if (!h) return `circa ${m} min`;
  if (ore && !m) return `circa ${h} ${h === 1 ? 'ora' : 'ore'}`;
  return `circa ${h} h${m ? ' ' + m : ''}`;
}

/* ---------- i turni ---------- */
// D.imp.lavoro arriva anche da un dati.json del vault (non passa da backupValido): le liste si leggono con prudenza
const lavoro = () => D.imp.lavoro && typeof D.imp.lavoro === 'object' ? D.imp.lavoro : null, lista = x => Array.isArray(x) ? x : [];
// i turni di una data: quelli della settimana (salvo un'eccezione «non lavoro») più quelli in più di quella data
export function turniDi(data) {
  const L = lavoro(); if (!L) return [];
  const dow = new Date(data + 'T12:00').getDay(), ecc = lista(L.eccezioni).filter(x => x?.data === data);
  const fissi = ecc.some(x => x.no) ? [] : lista(L.turni).filter(t => lista(t?.giorni).includes(dow));
  return [...fissi, ...ecc.filter(x => !x.no && x.inizio && x.fine)].map(t => ({ inizio: t.inizio, fine: t.fine })).sort((a, b) => minDi(a.inizio) - minDi(b.inizio));
}
// un turno che finisce «prima» di cominciare (22-2) arriva a mezzanotte
const fineDi = t => minDi(t.fine) > minDi(t.inizio) ? minDi(t.fine) : 1440;
// il turno in corso, con mezz'ora di margine prima e dopo (il viaggio), oppure null
export function alLavoro(d = new Date()) {
  const m = d.getHours() * 60 + d.getMinutes();
  return turniDi(isoGiorno(d)).find(t => m >= minDi(t.inizio) - VIAGGIO && m < fineDi(t) + VIAGGIO) || null;
}

/* ---------- i minuti liberi di un giorno ---------- */
// finestra di studio, meno lezioni, meno turni (± 30 minuti di viaggio), meno silenzio; poi il tetto e giù a 15 minuti.
// Oggi si conta da adesso (su a 15 minuti), non dall'inizio della finestra
export function liberi(data, { adesso = Date.now(), tetto } = {}) {
  const f = D.imp.studio || FINESTRA, dow = new Date(data + 'T12:00').getDay(), turni = turniDi(data);
  let da = minDi(f.da), a = minDi(f.a) > da ? minDi(f.a) : 1440;
  const ad = new Date(adesso);
  if (isoGiorno(ad) === data) da = Math.max(da, su15(ad.getHours() * 60 + ad.getMinutes()));
  const lez = (D.orario || []).filter(o => (o.giorni || []).includes(dow)).map(o => ({ corso: o.corso, inizio: o.inizio, fine: o.fine }));
  const s = D.imp.silenzio || { da: '23:00', a: '08:00' }, sa = minDi(s.da), sb = minDi(s.a);
  const occupati = [...lez.map(o => [minDi(o.inizio), minDi(o.fine)]), ...turni.map(t => [minDi(t.inizio) - VIAGGIO, fineDi(t) + VIAGGIO]),
    ...(sa === sb ? [] : sa < sb ? [[sa, sb]] : [[sa, 1440], [0, sb]])];
  // minuto per minuto sarebbe più semplice ma 1440 × 45 giorni × più conti: si tagliano gli intervalli
  let liberi = da < a ? [[da, a]] : [];
  for (const [x, y] of occupati) liberi = liberi.flatMap(([p, q]) => y <= p || x >= q ? [[p, q]] : [...(x > p ? [[p, x]] : []), ...(y < q ? [[y, q]] : [])]);
  const lordo = liberi.reduce((s, [p, q]) => s + q - p, 0);
  const t = turni.length ? (tetto ?? lavoro()?.tetto ?? TETTO_LAVORO) : TETTO_LIBERO;
  return { min: giu15(Math.min(lordo, t)), lavoro: turni, tetto: t, lezioni: lez };
}

/* ---------- il calendario di tutti gli esami ---------- */
export const OPZIONI = [
  { k: 'cuscinetto', testo: 'Uso anche i giorni cuscinetto' },
  { k: 'unRipasso', testo: 'Un ripasso solo per gli argomenti nuovi, non due' },
  { k: 'tetto', testo: 'Nei giorni di lavoro studio 3 ore, non 2' },
];
export const testoScelta = k => OPZIONI.find(o => o.k === k)?.testo || k;
const totale = m => Object.values(m).reduce((s, x) => s + x, 0);
// gli esami presi: con la data entro 45 giorni (non oggi: il giorno dell'esame non si pianifica) e con il programma
export const esamiDelPiano = (T = oggi()) => prossimi().filter(e => e.data > T && giorniTra(T, e.data) <= ENTRO && PG.programmaDi(e));
export function attivo(T = oggi()) { return !!lista(lavoro()?.turni).length || !!D.imp.studio || esamiDelPiano(T).length >= 2; }

function conto({ T, adesso, scelte }) {
  const esami = esamiDelPiano(T), on = attivo(T);
  const base = lavoro()?.tetto ?? TETTO_LAVORO, tetto = base + (scelte.includes('tetto') ? 60 : 0);
  const piani = esami.map(e => { const cop = PG.copertura(e); return { e, p: PG.piano(e, cop, T), pri: new Map(cop.map(c => [c.a.id, PG.priorita(c)])) }; });
  const n = Math.max(7, ...piani.map(x => x.p.giorni.length));
  const giorni = Array.from({ length: n }, (_, k) => { const data = piuGiorni(T, k), L = liberi(data, { adesso, tetto }); return { data, liberi: L.min, lavoro: L.lavoro, voci: [], tipo: {}, cusc: new Set(), gen: new Set() }; });
  piani.forEach(({ e, p, pri }, ei) => {
    const voce = (tipo, id, k, extra = {}) => giorni[k].voci.push({ esameId: e.id, tipo, id, min: tipo === 'tema' ? extra.min : STIMA[tipo], ei, data: e.data, pri: pri.get(id) ?? 0, giro: false, ...extra });
    // «un ripasso solo»: il secondo ripasso di un argomento nuovo (il terzo passaggio di piano()) non si mette
    const visti = new Map(), studiati = new Set(p.giorni.flatMap(g => g.studia));
    p.giorni.forEach((g, k) => {
      giorni[k].tipo[e.id] = g.tipo;
      if (g.tipo === 'generale') { giorni[k].gen.add(ei); g.ripassa.forEach(id => voce('generale', id, k)); return; }
      if (g.tipo === 'cuscinetto') { giorni[k].cusc.add(ei); return; }
      g.studia.forEach(id => voce('studia', id, k));
      g.ripassa.forEach(id => {
        const giro = !!g.giro?.includes(id);
        if (!giro && studiati.has(id)) { visti.set(id, (visti.get(id) || 0) + 1); if (scelte.includes('unRipasso') && visti.get(id) >= 2) return; }
        voce('ripassa', id, k, { giro });
      });
    });
    const tema = TE.temaDiOggi(e, T);
    if (tema && p.giorni.length) voce('tema', tema.id, 0, { min: TE.minuti(tema.t) });
  });
  const mancano = {};
  if (on) {
    const somma = g => g.voci.reduce((s, v) => s + v.min, 0), pieno = g => g.voci.reduce((s, v) => s + (v.giro ? 0 : v.min), 0);
    const genDi = ei => { const k = giorni.findIndex(g => g.gen.has(ei)); return k < 0 ? n : k; };
    const manca = v => { mancano[v.esameId] = (mancano[v.esameId] || 0) + v.min; };
    // l'ordine in cui si toglie: i riempitivi, poi dall'esame più lontano i ripassi (e l'esercizio), poi gli argomenti
    // nuovi; poi l'esame dopo. Il ripasso generale per ultimo. A parità di data, prima le voci con meno priorità
    const banda = v => v.giro ? 0 : v.tipo === 'generale' ? 2 : 1, cat = v => v.tipo === 'studia' ? 1 : 0;
    const prima = (x, y) => banda(x) - banda(y) || y.data.localeCompare(x.data) || cat(x) - cat(y) || x.pri - y.pri;
    // una voce tolta va al primo giorno dopo con posto, prima del ripasso generale del suo esame (mai nel cuscinetto del
    // suo esame, salvo la scelta: il cuscinetto di Analisi per Fisica è un giorno di studio come gli altri); i riempitivi
    // del giorno d'arrivo non contano, se serve si tolgono quando ci si arriva
    const vietato = (g, v) => g.cusc.has(v.ei) && !scelte.includes('cuscinetto');
    const posto = (v, da) => { for (let j = da; j < genDi(v.ei); j++) { const g = giorni[j]; if (!vietato(g, v) && pieno(g) + v.min <= g.liberi) return j; } return -1; };
    for (let i = 0; i < n; i++) {
      const g = giorni[i];
      while (somma(g) > g.liberi && g.voci.length) {
        const v = [...g.voci].sort(prima)[0]; g.voci.splice(g.voci.indexOf(v), 1);
        if (v.giro || v.tipo === 'tema') continue;   // un riempitivo si butta, l'esercizio torna un altro giorno
        if (v.tipo === 'generale') { manca(v); continue; }
        const j = posto(v, i + 1);
        // i ripassi dello stesso argomento vengono dopo lo studio: se lo studio slitta di k giorni, slittano anche loro
        const dopo = v.tipo !== 'studia' ? [] : giorni.slice(i + 1).flatMap((x, d) => x.voci.filter(w => w.ei === v.ei && w.id === v.id && w.tipo === 'ripassa').map(w => [w, i + 1 + d]));
        for (const [w, k] of dopo) giorni[k].voci.splice(giorni[k].voci.indexOf(w), 1);
        if (j < 0) { manca(v); dopo.forEach(([w]) => manca(w)); continue; }
        giorni[j].voci.push(v);
        // il ripasso slitta di quanto lo studio; se così cade nel cuscinetto o dopo il ripasso generale, va al primo giorno
        // con posto (da lì, o se no dal giorno dopo lo studio). Solo se non c'è posto da nessuna parte manca
        for (const [w, k] of dopo) {
          let nk = Math.max(k + j - i, j + 1);
          if (nk >= genDi(w.ei) || vietato(giorni[nk], w)) { nk = posto(w, nk); if (nk < 0) nk = posto(w, j + 1); }
          if (nk < 0) manca(w); else giorni[nk].voci.push(w);
        }
      }
    }
  }
  return { attivo: on, giorni: giorni.map(g => ({ data: g.data, liberi: g.liberi, lavoro: g.lavoro, tipo: g.tipo, voci: g.voci.map(({ esameId, tipo, id, min, giro }) => ({ esameId, tipo, id, min, ...(giro ? { giro } : {}) })), min: g.voci.reduce((s, v) => s + v.min, 0) })), mancano };
}
// { attivo, giorni:[{ data, liberi, lavoro, tipo:{ esameId: tipo del giorno in piano() }, voci, min }], mancano:{ esameId: minuti }, opzioni:[{ k, testo, risparmio }] }.
// Le opzioni solo se manca qualcosa: si rifà il conto con la scelta accesa e si tiene solo quella che fa risparmiare
export function calendario({ T = oggi(), adesso = Date.now(), scelte = D.imp.oreScelte || [] } = {}) {
  const r = conto({ T, adesso, scelte }), tot = totale(r.mancano), opzioni = [];
  if (r.attivo && tot > 0) {
    const tetto = lavoro()?.tetto ?? TETTO_LAVORO, conLavoro = !!lista(lavoro()?.turni).length;
    for (const o of OPZIONI) {
      if (scelte.includes(o.k) || (o.k === 'tetto' && (!conLavoro || tetto >= 180))) continue;
      const risparmio = tot - totale(conto({ T, adesso, scelte: [...scelte, o.k] }).mancano);
      if (risparmio > 0) opzioni.push({ k: o.k, testo: o.testo, risparmio });
    }
  }
  return { ...r, opzioni };
}

/* ---------- i testi per la barra ---------- */
const BREVI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const turnoTesto = t => `${ora(t.inizio)}–${ora(t.fine)}`;
export const liberiTesto = min => min >= 15 ? `${circa(min)} libere` : 'niente ore libere';
// «Lun 13 · circa 1 h 45 libere · lavoro 14–19»
export function rigaGiorno(g) {
  const d = new Date(g.data + 'T12:00');
  return [`${BREVI[d.getDay()]} ${d.getDate()}`, liberiTesto(g.liberi), g.lavoro.length ? `lavoro ${g.lavoro.map(turnoTesto).join(', ')}` : ''].filter(Boolean).join(' · ');
}
const corto = t => t.length > 34 ? t.slice(0, 33).replace(/\s+\S*$/, '') + '…' : t;
const titolo = (e, id) => e?.programma?.argomenti?.find(a => a.id === id)?.t || '';
// «Analisi 2: Integrali (circa 1 h) · ↻ Serie (circa 30 min)», un pezzo per esame. esami: id → esame
export function vociGiorno(g, esami) {
  const per = new Map(); for (const v of g.voci) { if (!per.has(v.esameId)) per.set(v.esameId, []); per.get(v.esameId).push(v); }
  return [...per].map(([id, voci]) => {
    const e = esami(id), gen = voci.filter(v => v.tipo === 'generale');
    const pezzi = voci.filter(v => v.tipo !== 'generale').map(v => v.tipo === 'tema' ? `esercizio d'esame (${circa(v.min)})` : `${v.tipo === 'ripassa' ? '↻ ' : ''}${corto(titolo(e, v.id) || 'argomento')} (${circa(v.min)})`);
    if (gen.length) pezzi.unshift(`ripasso generale (${circa(gen.reduce((s, v) => s + v.min, 0))})`);
    return `${e?.nome || 'Esame'}: ${pezzi.join(' · ')}`;
  }).concat(Object.entries(g.tipo || {}).filter(([id, t]) => t === 'cuscinetto' && !per.has(id)).map(([id]) => `${esami(id)?.nome || 'Esame'}: giorno cuscinetto, per recuperare`));
}
// «Oggi hai circa 2 h libere (lavoro 14–19): circa 1 h 30 per Analisi 2, circa 30 min per Fisica.»
export function testoOggi(cal, esami) {
  const g = cal.giorni[0]; if (!g) return '';
  const lav = g.lavoro.length ? ` (lavoro ${g.lavoro.map(turnoTesto).join(', ')})` : '';
  if (g.liberi < 15) return `Oggi non hai ore libere per studiare${lav}.`;
  const per = new Map(); for (const v of g.voci) per.set(v.esameId, (per.get(v.esameId) || 0) + v.min);
  return `Oggi hai ${liberiTesto(g.liberi)}${lav}${per.size ? `: ${[...per].map(([id, m]) => `${circa(m)} per ${esami(id)?.nome || 'un esame'}`).join(', ')}.` : '. Nel piano oggi non c\'è niente.'}`;
}
// le frasi di quello che non ci sta, sempre con le opzioni (o con la frase di ripiego): mai il numero da solo
export function riquadro(cal, esami, solo = null) {
  const righe = Object.entries(cal.mancano).filter(([id, m]) => m > 0 && (!solo || id === solo)).map(([id, m]) => `Fino all'appello di ${esami(id)?.nome || 'questo esame'} ti mancano ${circa(m, { ore: true })}.`);
  if (!righe.length) return null;
  return { righe, opzioni: cal.opzioni.map(o => ({ ...o, testo: `${o.testo} · recuperi ${circa(o.risparmio)}` })),
    ripiego: cal.opzioni.length ? '' : 'Con le ore che hai non ci sta tutto. Puoi scrivermi giorni di studio in più («studio dalle 9 alle 21») o pensare all\'appello dopo: decidi tu.' };
}
// dopo un clic su un'opzione: quanto manca ancora
export const dopoScelta = cal => { const t = totale(cal.mancano); return t > 0 ? `Ti mancano ancora ${circa(t, { ore: true })}.` : 'Ora ci sta.'; };

/* ---------- i comandi: salvare turni, eccezioni, tetto, finestra ---------- */
// «lun, mer, ven 14–19»
const ORDINE = g => (g + 6) % 7;
export const giorniTesto = giorni => [...giorni].sort((a, b) => ORDINE(a) - ORDINE(b)).map(g => BREVI[g].toLowerCase()).join(', ');
export const turniTesto = (turni = lista(lavoro()?.turni)) => turni.map(t => `${giorniTesto(t.giorni)} ${turnoTesto(t)}`).join('; ');
export function applica(c, T = oggi()) {
  if (c.azione === 'finestra') D.imp.studio = { da: c.da, a: c.a };
  else if (c.azione === 'togli') delete D.imp.lavoro;
  else if (c.azione !== 'vedi') {
    const L = D.imp.lavoro ||= { turni: [], eccezioni: [], tetto: TETTO_LAVORO };
    L.turni ||= []; L.eccezioni ||= [];
    // uno o più turni («lunedì 9-13 e mercoledì 15-19» → c.turni)
    const nuovi = (c.turni || [c]).map(x => ({ giorni: [...new Set(x.giorni || [])].sort(), inizio: x.inizio, fine: x.fine }));
    if (c.azione === 'sostituisci') L.turni = nuovi;
    else if (c.azione === 'aggiungi') { for (const turno of nuovi) if (!L.turni.some(t => JSON.stringify(t) === JSON.stringify(turno))) L.turni.push(turno); }
    else if (c.azione === 'eccezione') {
      if (c.no) L.eccezioni = [...L.eccezioni.filter(x => x.data !== c.data || !x.no), { data: c.data, no: true }];
      else L.eccezioni.push({ data: c.data, inizio: c.inizio, fine: c.fine });
    } else if (c.azione === 'tetto') L.tetto = Math.max(15, Math.min(600, Math.round(c.min / 15) * 15));
  }
  // le eccezioni passate non servono più
  if (D.imp.lavoro?.eccezioni) D.imp.lavoro.eccezioni = D.imp.lavoro.eccezioni.filter(x => x.data >= T);
  salva();
}
// le scelte quando non ci sta: si accendono e si spengono solo con un clic
export function scegli(k, si = true) {
  const s = new Set(D.imp.oreScelte || []); si ? s.add(k) : s.delete(k);
  D.imp.oreScelte = [...s]; salva();
}
