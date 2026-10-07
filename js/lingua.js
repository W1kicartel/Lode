// Le lingue di Lode. Ogni testo per lo studente sta in un catalogo (js/lingue/<codice>/<area>.js): il codice chiama
// t('area.chiave', { parametri }) e mai una frase scritta a mano. L'italiano è la lingua di partenza e di riserva: ogni
// chiave c'è sempre in italiano; se una traduzione manca si vede l'italiano (e test/lingue.mjs lo segnala).
// La lingua si legge PRIMA di tutto il resto (await in cima al modulo): chi importa lingua.js trova già il catalogo pronto,
// anche per le costanti scritte in cima ai moduli. Cambiare lingua = salvarla e ricaricare la finestra.
// Regole dei cataloghi (docs/LINGUE.md): testo semplice; i parametri si scrivono {nome}; i plurali sono oggetti
// { one, other } (più few/many dove la lingua li ha) scelti con Intl.PluralRules; t() NON fa l'escape: chi mette il testo
// nell'HTML fa l'escape dei parametri che vengono dallo studente, esattamente come prima con le frasi scritte a mano.
import { AREE } from './lingue/indice.js';

export const LINGUE = {
  it: { nome: 'Italiano', locale: 'it-IT' },
  en: { nome: 'English', locale: 'en-GB' },
  es: { nome: 'Español', locale: 'es-ES' },
  fr: { nome: 'Français', locale: 'fr-FR' },
  de: { nome: 'Deutsch', locale: 'de-DE' },
  pt: { nome: 'Português', locale: 'pt-BR' },   // il portoghese di Lode è quello del Brasile (docs/LINGUE.md)
};
const CHIAVE = 'lode:lingua';

// la lingua scelta: quella salvata (nell'app la passa il processo principale), poi quella del sistema, poi l'italiano
export function scelta() {
  // prove in node: italiano, salvo LODE_LINGUA. Anche quando la prova finge una finestra (globalThis.window = globalThis):
  // node ha navigator.language (en-US sulle macchine di GitHub) e senza questo controllo la prova girerebbe in inglese
  const node = typeof process !== 'undefined' && !!process.versions?.node && !process.versions?.electron;
  if (typeof window === 'undefined' || node) return (typeof process !== 'undefined' && LINGUE[process.env?.LODE_LINGUA] && process.env.LODE_LINGUA) || 'it';
  let salvata = null, dati = null;
  try { salvata = (typeof window !== 'undefined' && window.lodeDesktop?.lingua) || localStorage.getItem(CHIAVE); } catch { }
  // nel browser, chi usava Lode prima delle lingue non ha una lingua salvata: servono i suoi dati (dati.js, 'lode:v1')
  if (!(salvata && LINGUE[salvata]) && !window.lodeDesktop) try { dati = JSON.parse(localStorage.getItem('lode:v1')); } catch { }
  const sis = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'it';
  const r = iniziale({ salvata, dati, sistema: sis });
  if (r.salva) try { localStorage.setItem(CHIAVE, r.lingua); } catch { }
  return r.lingua;
}
// La lingua all'avvio, senza window né localStorage (per le prove): quella salvata; se no, chi usa già Lode (il benvenuto
// fatto o degli esami nei dati) resta in italiano, e l'italiano si salva una volta sola (salva: true), così non cambia
// più nemmeno quando il sistema è in un'altra lingua; se no la lingua del sistema, se Lode la conosce; se no l'inglese.
// Nell'app la stessa scelta la fa il processo principale con conf.benvenuto (desktop/lingua.mjs, linguaDiPartenza)
export function iniziale({ salvata = null, dati = null, sistema = '' } = {}) {
  if (typeof salvata === 'string' && Object.hasOwn(LINGUE, salvata)) return { lingua: salvata, salva: false };
  const d = dati && typeof dati === 'object' ? dati : null;
  if (d && (d.imp?.benvenuto || d.benvenuto === true || (Array.isArray(d.esami) && d.esami.length))) return { lingua: 'it', salva: true };
  const c = String(sistema || '').slice(0, 2).toLowerCase();
  return { lingua: Object.hasOwn(LINGUE, c) ? c : 'en', salva: false };
}
export let lingua = scelta();
export const locale = () => LINGUE[lingua].locale;

const CAT = { it: {}, [lingua]: {} };
async function carica(cod) {
  const parti = await Promise.all(AREE.map(a => import(`./lingue/${cod}/${a}.js`).then(m => m.default).catch(() => ({}))));
  return Object.assign({}, ...parti);
}
CAT.it = await carica('it');
if (lingua !== 'it') CAT[lingua] = await carica(lingua);

// per le prove (e per l'anteprima nel benvenuto): carica e usa un'altra lingua senza ricaricare la pagina
export async function usa(cod) {
  if (!LINGUE[cod]) throw new Error('lingua sconosciuta: ' + cod);
  if (!CAT[cod] || !Object.keys(CAT[cod]).length) CAT[cod] = cod === 'it' ? CAT.it : await carica(cod);
  lingua = cod;
}
// salva la scelta (la finestra poi si ricarica: i moduli rileggono i testi)
export function imposta(cod) {
  if (!Object.hasOwn(LINGUE, cod)) return false;
  try { localStorage.setItem(CHIAVE, cod); } catch { }
  if (typeof window !== 'undefined') window.lodeDesktop?.invoca?.('lingua:imposta', cod);
  return true;
}

function cerca(chiave) {
  const v = CAT[lingua]?.[chiave] ?? CAT.it[chiave];
  if (v == null) { if (typeof console !== 'undefined') console.warn('testo mancante: ' + chiave); return chiave; }
  return v;
}
const metti = (s, p) => (p ? String(s).replace(/\{(\w+)\}/g, (x, k) => (k in p ? String(p[k]) : x)) : String(s));
let regole = null, regoleDi = null;
function forma(v, n) {
  if (typeof v !== 'object') return v;
  if (regoleDi !== lingua) { regole = new Intl.PluralRules(locale()); regoleDi = lingua; }
  return v[n === 0 && 'zero' in v ? 'zero' : regole.select(n)] ?? v.other;
}

// il testo della chiave, con i parametri; se il valore è un plurale e c'è p.n, sceglie la forma giusta
export function t(chiave, p) {
  const v = cerca(chiave);
  return metti(typeof v === 'object' && !Array.isArray(v) ? forma(v, Number(p?.n ?? 1)) : v, p);
}
// un elenco dal catalogo (es. i nomi dei mesi): sempre un array
export function elenco(chiave) { const v = cerca(chiave); return Array.isArray(v) ? v : [v]; }
// c'è la chiave? (nella lingua scelta o in italiano)
export const esiste = chiave => (CAT[lingua]?.[chiave] ?? CAT.it[chiave]) != null;

// numeri e date nella forma del paese della lingua
export const numero = (x, dec = 1) => Number(x).toLocaleString(locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
export function data(iso, opz = { day: 'numeric', month: 'long' }) {
  return new Date(String(iso).slice(0, 10) + 'T12:00').toLocaleDateString(locale(), opz);
}
// tutti i cataloghi caricati (per le prove)
export const _cataloghi = CAT;
