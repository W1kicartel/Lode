// Il libretto nel sistema dei voti scelto (docs/LINGUE.md, «Sistemi dei voti»): i numeri e le frasi delle schede del
// libretto (js/lode.js), della pagina (js/pagina.js) e del benvenuto (js/benvenuto.js) quando il sistema NON è l'Italia.
// In Italia chi chiama resta sul codice di sempre (italiano() è true) e da qui non passa niente: le frasi, i numeri e i
// controlli italiani non cambiano di una virgola. Testi nel catalogo «libretto» (e «sistemi» per nomi, crediti e finale).
import { t, numero } from './lingua.js';
import * as S from './sistemi.js';
import { D, sistemaVoti, media, serve, simula, cfuFatti, votoFinale } from './dati.js';

export const italiano = () => sistemaVoti() === 'it';
export const sis = () => S.sistema(sistemaVoti());
export const crediti = () => S.nomeCrediti(sis());
export const nomeFinale = () => S.etichettaFinale(sis());
// un voto come si scrive nel sistema: «8,5», «16», «2,3», «A−», «10 MH»
export const formato = (v, opz) => S.formato(v, sis(), opz);
// la media: due decimali (il Regno Unito, in percentuale, uno)
export const formatoMedia = x => (x == null || !Number.isFinite(x) ? '—' : numero(x, sis().cod === 'uk' ? 1 : 2));
// il voto finale del sistema: «7,85», «13,45/20 · Assez bien», «1,7», «First (72,0)», «3,45»
export const formatoFinale = (f = votoFinale()) => S.formatoFinale(f, sis());
// un obiettivo (o un voto «di media che serve»): in Germania e negli Stati Uniti sempre un decimale (2,0 · 3,5), altrove
// senza decimali se è intero (14, 60), se no fino a due
export function formatoNumero(x, s = sis()) {
  if (s.cod === 'de' || s.cod === 'us') return numero(x, 1);
  const r = Math.round(x * 100) / 100;
  return numero(r, Number.isInteger(r) ? 0 : Math.round(r * 10) === r * 10 ? 1 : 2);
}

/* ---------- il voto detto ---------- */
// I riconoscitori (js/comandi/<cod>.js) capiscono i voti italiani (18-30) e qualche scala vicina: un 8,5, un 16/20, un 2,3, un
// A− o un 65 % spesso non li prendono. Qui, fuori dall'Italia, si prova ogni pezzo della frase che si legge come voto del
// sistema: lo si sostituisce con un voto italiano di comodo (27), il riconoscitore riconosce la frase, e al posto del 27 si
// rimette il voto vero. Lo stesso per «quanto mi serve per 1,5»: l'obiettivo diventa 100 e poi torna quello detto.
const SEGNO = 27, SEGNO_SERVE = 100;
const PEZZI = /(?<![\p{L}\d,.])(\d{1,3}(?:[.,]\d{1,2})?(?:\s*\/\s*\d{1,3})?(?:\s*%)?|[A-F][+\-−–]?|[a-f][+\-−–])(?![\p{L}\d])/gu;
const pezzi = testo => [...String(testo || '').matchAll(PEZZI)].map(m => ({ x: m[1], i: m.index }));
const metti = (testo, p, con) => testo.slice(0, p.i) + con + testo.slice(p.i + p.x.length);
// il voto detto che il sistema non ha, com'è stato detto («28», «27,5»): non «28,0» del formato di un altro sistema
const detto = v => numero(v, Math.min(2, (String(v).split('.')[1] || '').length));
const conSegno = (r, segno) => r && String(r.nomeDetto || '').includes(String(segno));
// un obiettivo detto («1,5», «14», «3.5», «60 %»): un numero nella scala del voto finale, o null
export function leggiObiettivo(x, s = sis()) {
  const m = String(x ?? '').trim().match(/^(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*\/\s*(\d{1,3}))?\s*%?$/);
  if (!m || (m[2] && Number(m[2]) !== s.max)) return null;
  const v = Number(m[1].replace(',', '.'));
  return obiettivoValido(v, s) ? v : null;
}
// un obiettivo si può chiedere se sta fra la sufficienza e il voto migliore (in Germania fra 1,0 e 4,0)
export const obiettivoValido = (v, s = sis()) => Number.isFinite(v) && (s.migliore === 'basso' ? v >= s.min && v <= s.sufficienza : v >= s.sufficienza && v <= s.max);

// la frase come la capisce la barra, con il voto letto nel sistema scelto. interpreta: quello di js/comandi.js
// Il comando del voto può avere fuoriScala: true (il voto detto non esiste nel sistema: lode.js lo dice); quello di
// «quanto mi serve» ha base = l'obiettivo nella scala del voto finale, o fuoriScala: true
export function interpretaVoti(testo, interpreta) {
  const c = interpreta(testo);
  if (italiano()) return c;
  const s = sis();
  if (c && (c.tipo === 'voto' || c.tipo === 'simula') && S.valido(c.voto, s)) return { ...c, lode: !!c.lode && s.lode && c.voto === s.max };
  if (!c || c.tipo === 'voto' || c.tipo === 'simula') {
    for (const p of pezzi(testo)) {
      const v = S.leggiVoto(p.x, s); if (!v || v.idoneita) continue;
      const r = interpreta(metti(testo, p, String(SEGNO)));
      if (r && (r.tipo === 'voto' || r.tipo === 'simula') && r.voto === SEGNO && !conSegno(r, SEGNO)) return { ...r, voto: v.voto, lode: v.lode || (!!r.lode && s.lode && v.voto === s.max) };
    }
    if (c) return { ...c, fuoriScala: true, detto: detto(c.voto) };
    // un voto che il sistema non ha («65» in Spagna, «8» negli Stati Uniti): il comando c'è, il voto no (lode.js lo dice)
    for (const p of pezzi(testo)) {
      const r = interpreta(metti(testo, p, String(SEGNO)));
      if (r && (r.tipo === 'voto' || r.tipo === 'simula') && r.voto === SEGNO && !conSegno(r, SEGNO)) return { ...r, voto: null, lode: false, fuoriScala: true, detto: p.x };
    }
  }
  if (!c || c.tipo === 'serve' || c.tipo === 'libretto') {
    for (const p of pezzi(testo)) {
      if (!/\d/.test(p.x)) continue;
      const r = interpreta(metti(testo, p, String(SEGNO_SERVE)));
      if (r?.tipo !== 'serve' || r.base !== SEGNO_SERVE) continue;
      const b = leggiObiettivo(p.x, s);
      return b == null ? { ...r, base: null, fuoriScala: true, detto: p.x } : { ...r, base: b };
    }
    if (c?.tipo === 'serve') { const b = leggiObiettivo(String(c.base), s); return b == null ? { ...c, base: null, fuoriScala: true, detto: String(c.base) } : { ...c, base: b }; }
  }
  return c;
}

/* ---------- «quanto mi serve» e «e se prendo» ---------- */
// i traguardi del voto finale, dal peggiore al migliore: le soglie delle mention e delle classi, i mezzi punti altrove
const TRAGUARDI = { es: [6, 7, 8, 9], fr: [10, 12, 14, 16], de: [3, 2.5, 2, 1.5, 1], pt: [12, 14, 16, 18], br: [7, 8, 9], uk: [50, 60, 70], us: [2.5, 3, 3.5, 3.7, 4] };
// l'obiettivo di partenza della scheda: il primo traguardo migliore della media di adesso (il migliore, se l'hai già passato)
export function obiettivo(m = media(), s = sis()) {
  const lista = TRAGUARDI[s.cod] || [s.max];
  if (m.ponderata == null) return lista[Math.floor((lista.length - 1) / 2)];
  const meglio = s.migliore === 'basso' ? lista.find(x => x < m.ponderata - 1e-9) : lista.find(x => x > m.ponderata + 1e-9);
  return meglio ?? lista[lista.length - 1];
}
// la frase di «quanto mi serve per X» (HTML, senza dati dello studente), o '' se non manca niente
export function testoServe(ob = obiettivo()) {
  const s = sis(), m = media(), sv = m.n ? serve(ob) : null;
  if (!sv) return '';
  const o = formatoNumero(ob, s);
  if (sv.gia) return t('libretto.serve-gia', { obiettivo: o });
  if (sv.possibile) return t('libretto.serve-media', { obiettivo: o, voto: formatoNumero(sv.voto, s), cfu: numero(sv.cfu, 0), crediti: crediti() });
  // non ci arrivi: dove arrivi prendendo il voto migliore in tutto quello che manca
  const meglio = s.migliore === 'basso' ? s.min : s.max, punta = (m.somma + meglio * sv.cfu) / (m.cfuVoto + sv.cfu);
  return t('libretto.serve-impossibile', { obiettivo: o, punta: formatoNumero(s.migliore === 'basso' ? Math.ceil(punta * 10 - 1e-9) / 10 : Math.floor(punta * 10 + 1e-9) / 10, s) });
}
// i voti della barra «e se…»: quelli sufficienti, dal peggiore al migliore (Germania 4,0 → 1,0; Stati Uniti D → A)
const PASSO = { es: 0.5, fr: 0.5, pt: 1, br: 0.5, uk: 1 };
export function scala(s = sis()) {
  if (s.voti) return s.voti.filter(v => S.superato(v, s)).sort((a, b) => (s.migliore === 'basso' ? b - a : a - b));
  const out = [], p = PASSO[s.cod] || 1;
  for (let v = s.sufficienza; v <= s.max + 1e-9; v += p) out.push(Math.round(v * 100) / 100);
  return out;
}
const delta = d => `${d >= 0 ? '+' : '−'}${formatoMedia(Math.abs(d))}`;
// l'esito della barra «e se…» (HTML)
export function esitoSimula(esameId, voto) {
  const x = simula(esameId, voto, false); if (!x) return '';
  const f = votoFinale(x.dopo);
  return t('libretto.simula-esito', { media: formatoMedia(x.dopo.ponderata), classe: x.meglio === false ? 'giu' : 'su', delta: delta(x.delta ?? 0), finale: nomeFinale(), valore: formatoFinale(f) });
}
// la risposta a «e se prendo X in Y» (markdown della barra); il nome dell'esame lo mette chi chiama, come in italiano
export function testoSimula(e, voto, lode = false) {
  const x = simula(e.id, voto, lode), v = formato(voto, { lode: lode && sis().lode && voto === sis().max });
  if (!x.prima.n) return t('libretto.simula-primo', { voto: v, nome: e.nome, media: formatoMedia(x.dopo.ponderata), finale: nomeFinale(), valore: formatoFinale(votoFinale(x.dopo)) });
  return t('libretto.simula', { voto: v, nome: e.nome, prima: formatoMedia(x.prima.ponderata), dopo: formatoMedia(x.dopo.ponderata), delta: delta(x.delta ?? 0), finale: nomeFinale(), valore: formatoFinale(votoFinale(x.dopo)) });
}

/* ---------- le righe del libretto ---------- */
// i numeri della scheda e della pagina: media, aritmetica, voto finale, crediti
export function quadro() {
  const m = media(), f = votoFinale(m);
  return { m, finale: f, media: formatoMedia(m.ponderata), aritmetica: formatoMedia(m.aritmetica), valore: formatoFinale(f), breve: finaleBreve(f), nomeFinale: nomeFinale(), crediti: crediti(), cfu: cfuFatti(), tot: D.profilo.cfuTotali || sis().totali };
}
// un voto registrato, come si mostra nel libretto: «8,5», «10 MH», «A−», «idoneo»
export const votoEsame = e => (e.idoneita ? S.formato(null, sis(), { idoneita: true }) : formato(e.voto, { lode: e.lode }));
// un esempio di riga del libretto nel sistema, per i suggerimenti: «Analisi 1, 6 ECTS, 8,5»
const ESEMPIO = { es: 8.5, fr: 14, de: 1.7, pt: 16, br: 8.5, uk: 68, us: 3.7, it: 28 };
export const rigaEsempio = (s = sis()) => t('libretto.riga-esempio', { nome: t('libretto.esame-esempio'), n: s.esame, crediti: S.nomeCrediti(s), voto: S.formato(ESEMPIO[s.cod], s) });
export const votoEsempio = (s = sis()) => S.formato(ESEMPIO[s.cod], s);
// un voto scritto nella pagina o nel libretto incollato: { voto, lode, idoneita } o null
export const leggiVoto = x => S.leggiVoto(x, sis());
// il libretto incollato, letto con il lettore generico di js/sistemi.js, nella forma del benvenuto ({ nome, cfu, voto, lode,
// idoneita, data })
export const leggiLibretto = testo => S.leggiLibretto(testo, sis()).map(x => ({ nome: x.nome, cfu: x.crediti ?? sis().esame, voto: x.idoneita ? null : x.voto, lode: !!x.lode, idoneita: !!x.idoneita, data: null }));

/* ---------- controlli del voto ---------- */
export const valido = v => S.valido(v, sis());
export const nomeSistema = () => S.nomeSistema(sis());
// va nel libretto? (sufficiente; nel GPA anche la F, che conta nella media)
export const contaNelLibretto = v => !!sis().bocciatiInMedia || S.superato(v, sis());
// un voto da festeggiare: Sobresaliente, très bien, 1,3 o meglio, First, A−…
const OTTIMO = { es: 9, fr: 16, de: 1.3, pt: 17, br: 9, uk: 70, us: 3.7 };
export const ottimo = v => { const s = sis(), o = OTTIMO[s.cod] ?? s.max; return s.migliore === 'basso' ? v <= o + 1e-9 : v >= o - 1e-9; };
// «quanto mi serve per 25» in Spagna: l'obiettivo va dalla sufficienza al voto migliore (in Germania da 1,0 a 4,0)
export function testoObiettivoFuori(s = sis()) {
  const [da, a] = s.migliore === 'basso' ? [s.min, s.sufficienza] : [s.sufficienza, s.max];
  return t('libretto.obiettivo-fuori', { sistema: S.nomeSistema(s), da: formatoNumero(da, s), a: formatoNumero(a, s) });
}
// i crediti di una laurea fra cui scegliere nelle impostazioni: quelli del sistema per primi (240 in Spagna e in Brasile,
// 360 nel Regno Unito, 120 negli Stati Uniti), più quelli che hai già
export const opzioniTotali = (s = sis()) => [...new Set([s.totali, 180, 240, 120, 300, 360, Number(D.profilo.cfuTotali) || s.totali])];
// il voto finale in due pezzi, per i riquadri grandi della scheda e della pagina: il numero e, accanto in piccolo, la
// mention (Francia) o la classe (Regno Unito): { v: '13,45', dett: '/20 · Assez bien' }
export function finaleBreve(f = votoFinale()) {
  const s = sis();
  if (!f) return { v: '—', dett: '' };
  const v = numero(f.valore, s.cod === 'de' || s.cod === 'uk' ? 1 : 2);
  if (s.cod === 'fr') return { v, dett: `/20 · ${t(`sistemi.mention.${f.mention || 'nessuna'}`)}` };
  if (s.cod === 'uk') return { v, dett: t(`sistemi.classe.${f.classe}`) };
  return { v, dett: '' };
}
