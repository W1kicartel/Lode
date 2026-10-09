// Le parti dei comandi senza lingua, per tutti i riconoscitori (js/comandi/<codice>.js): date in cifre «12/02», orari
// «14-19», durate e numeri in cifre, gli errori del compilatore incollati e i nomi delle lingue scritti nella loro lingua.
// Le parole (giorni, mesi, «domani», i verbi dei comandi) stanno nel riconoscitore di ogni lingua.
import { isoGiorno, norm, oggi } from '../dati.js';
import { analizza as analizzaErrore } from '../errori.js';

// c'è davvero un errore del compilatore (o di un programma) nel testo incollato?
export const sembraErrore = testo => analizzaErrore(testo).length > 0;

// giorno e mese senza anno: il prossimo (se è già passato quest'anno, l'anno dopo)
export function conAnno(g, me, a) {
  const T = oggi(); let anno = a || new Date().getFullYear();
  let iso = isoGiorno(new Date(anno, me, g, 12));
  if (!a && iso < T) iso = isoGiorno(new Date(anno + 1, me, g, 12));
  return iso;
}
// una data in cifre: «12/02», «12.02.2027», «12-2-27» (t è già normalizzato con norm() e uno spazio prima e dopo; testo è
// la frase com'era). Giorno prima del mese; con mese = true il mese prima del giorno (02/12 all'americana), che vale anche
// quando il primo numero non può essere un mese («12/25» è il 25 dicembre)
export function dataInCifre(t, testo, { mese = false } = {}) {
  let m;
  if ((m = t.match(/ (\d{1,2}) (\d{1,2}) (\d{2,4}) /)) || (m = String(' ' + testo + ' ').match(/[\s(](\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?[\s),.]/))) {
    let g = +m[1], me = +m[2] - 1; let a = m[3] ? +m[3] : null; if (a && a < 100) a += 2000;
    if (mese && g <= 12) [g, me] = [me + 1, g - 1];
    if (g >= 1 && g <= 31 && me >= 0 && me < 12) return { data: conAnno(g, me, a), pezzo: m[0].trim() };
  }
  return null;
}

// due cifre di un orario: «9» → «09:00», «14», «30» → «14:30»
export const hh = (h, mm) => `${String(+h).padStart(2, '0')}:${mm || '00'}`;
// un orario vero: «14:00»-«19:00»; un turno che passa la mezzanotte (22-2) finisce a mezzanotte
export const orarioOk = (inizio, fine) => {
  const m = x => { const [h, mm] = x.split(':').map(Number); return h <= 24 && mm < 60 ? h * 60 + mm : NaN; };
  if (Number.isNaN(m(inizio)) || Number.isNaN(m(fine)) || m(inizio) >= 1440) return null;
  return m(fine) > m(inizio) ? { inizio, fine } : { inizio, fine: '24:00' };
};
// un orario in cifre «14-19», «9:30–11», «14.00-19.00» (con le parole di una lingua fra i due numeri: tra = 'to|until');
// le 12 ore all'inglese «2-7pm», «9am-1pm» diventano 24 ore
export function oreInCifre(testo, tra = '') {
  const re = new RegExp(`(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?\\s*(?:-|–${tra ? '|' + tra : ''})\\s*(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?`);
  const o = String(testo).toLowerCase().match(re); if (!o) return null;
  const ventiquattro = (h, ap, altro) => { h = +h; const x = ap || altro; if (x === 'pm' && h < 12) h += 12; if (x === 'am' && h === 12) h = 0; return h; };
  let a = ventiquattro(o[1], o[3], o[3] ? null : o[6] && +o[1] < +o[4] ? o[6] : null), b = ventiquattro(o[4], o[6]);
  return { inizio: hh(a, o[2]), fine: hh(b, o[5]), pezzo: o[0] };
}
// una durata in cifre: «50», «90 min», «2 h», «1h30»
export function minutiInCifre(t) {
  let m;
  if ((m = t.match(/(?:^|\s)(\d{1,2})\s*h\s*(\d{1,2})?\b/))) return { min: +m[1] * 60 + (+m[2] || 0), pezzo: m[0].trim() };
  if ((m = t.match(/(?:^|\s)(\d{1,3})\s*m(?:in)?\b/))) return { min: +m[1], pezzo: m[0].trim() };
  if ((m = t.match(/(?:^|\s)(\d{1,3})(?=\s|$)/))) return { min: +m[1], pezzo: m[1] };
  return null;
}

// i nomi delle lingue scritti nella loro lingua (e i codici): valgono in tutti i riconoscitori, così «language italiano» o
// «lingua english» funzionano anche se uno non sa come si dice nella lingua della barra. proprie = i nomi detti nella lingua
// del riconoscitore ({ inglese: 'en', … })
const NATIVI = { italiano: 'it', english: 'en', espanol: 'es', castellano: 'es', francais: 'fr', deutsch: 'de', portugues: 'pt' };
export function linguaDetta(parola, proprie = {}) {
  const p = norm(parola);
  return proprie[p] || NATIVI[p] || null;
}
// le lingue che Lode non parla, dette nelle sei lingue (senza accenti, come le dà norm()): «lingua giapponese», «language
// japanese», «Sprache Japanisch» sono il comando della lingua con codice null, e la barra dice quali lingue conosce invece
// di passare la frase all'AI. Niente nomi che sono anche esami o parole comuni («latino», «inglese tecnico» non c'entrano)
const IGNOTE = new Set(`giapponese japanese japones japonais japanisch japones japonesa
  cinese chinese chino chinois chinesisch chines mandarino mandarin
  russo russian ruso russe russisch
  arabo arabic arabe arabisch
  coreano korean coreen koreanisch
  olandese dutch neerlandes neerlandais niederlandisch hollandisch holandes
  polacco polish polaco polonais polnisch polones
  svedese swedish sueco suedois schwedisch
  turco turkish turc turkisch
  hindi
  ucraino ukrainian ucraniano ukrainien ukrainisch
  rumeno romanian rumano roumain rumanisch romeno
  catalano catalan catala
  danese danish danes danois danisch dinamarques
  norvegese norwegian noruego norvegien norwegisch noruegues
  finlandese finnish finlandes finnois finnisch
  ebraico hebrew hebreo hebreu hebraisch
  vietnamita vietnamese vietnamien vietnamesisch
  ungherese hungarian hungaro hongrois ungarisch
  ceco czech checo tcheque tschechisch tcheco
  japonaise chinoise coreenne neerlandaise polonaise suedoise turque ukrainienne roumaine catalane danoise norvegienne finnoise
  hebraique vietnamienne hongroise`.split(/\s+/));
export const linguaIgnota = parola => IGNOTE.has(norm(parola));
// «lingua giapponese», «language japanese», «idioma japonés», «langue japonaise», «Sprache Japanisch», «idioma japonês»
// (anche «língua», «lengua», con i due punti): una lingua che Lode non parla, detta con la parola «lingua» di una delle sei
export function linguaIgnotaDetta(frase) {
  const m = norm(frase).replace(/[.!?]+$/, '').trim().match(/^(?:lingua|language|idioma|lengua|langue|sprache):?\s+(\S+)$/);
  return !!m && linguaIgnota(m[1]);
}

// Le parole piccole di ogni lingua (articoli, preposizioni, «è», «sono»…), già senza accenti come le dà norm(), e solo quelle
// che non sono anche parole inglesi («come», «mon», «do», «die», «a» restano fuori). Servono a comandi.js: l'inglese di riserva
// non deve prendere una frase scritta nella lingua scelta che comincia con una parola inglese («today è una giornata storta»,
// «open la pagina di fisica», «my exams sono troppi»): quella va all'AI, come prima
export const PAROLE_PROPRIE = {
  it: 'di del della dello dei delle degli il lo la le gli un una uno e per con su sul sulla nel nella al alla allo ai dal dalla che non sono ho hai mi ti ci ma cosa perche questo questa quando dove anche piu molto troppo',
  es: 'de del la las los el un una unos unas y o para por con que es estoy tengo mi mis tu pero como cuando muy mas tambien esta este',
  fr: 'de du des la le les un une et ou pour par avec que qui ne pas est sont je ai ma mes tu mais comment quand tres aussi ce cette',
  de: 'der das den dem des ein eine einen und oder fur mit von zu ist sind ich habe mein meine nicht aber wie wann sehr auch im',
  pt: 'de da dos das o os um uma e para por que nao sao estou tenho meu minha mas como quando muito mais tambem na nos nas em',
};
const PROPRIE = Object.fromEntries(Object.entries(PAROLE_PROPRIE).map(([c, p]) => [c, new RegExp(` (?:${p.split(' ').join('|')}) `)]));
// la frase ha parole piccole della lingua cod? (per l'inglese non vale mai)
export const inLingua = (frase, cod) => !!PROPRIE[cod]?.test(' ' + norm(frase) + ' ');

// Le piccole parole che la barra riconosce dentro le schede: il sì e il no di una conferma, «basta»/«voto» che chiudono
// l'orale con il giudizio, l'uscita da «spiegamelo» e dall'orale. Ogni riconoscitore esporta PAROLE = { si, siCoda, no,
// voto, basta, esci }: frasi intere, in minuscolo. Le regole sono quelle delle regex italiane di prima (js/lode.js):
// - si / no: la frase intera, con dopo spazi, virgole, punti o punti esclamativi; il sì può avere una coda («sì pure»);
// - voto: la frase comincia così e dopo non c'è una lettera o una cifra (come \b: «basta così» sì, «bastava» no);
// - basta / esci: la frase intera e basta.
// L'apostrofo tipografico (’, quello che mettono le tastiere dei telefoni e la correzione automatica) vale come ':
// «d’accordo», «d’accord», «c’est bon».
export function detto(testo, P, quale) {
  const x = String(testo ?? '').toLowerCase().replace(/[’‘]/g, "'"), lista = P?.[quale] || [];
  if (quale === 'si' || quale === 'no') {
    const f = x.replace(/[\s,.!]*$/, '');
    if (lista.includes(f)) return true;
    return quale === 'si' && (P.siCoda || []).some(c => f.endsWith(' ' + c) && lista.includes(f.slice(0, -(c.length + 1))));
  }
  if (quale === 'voto') return lista.some(w => x.startsWith(w) && !/\w/.test(x.charAt(w.length)));
  return lista.includes(x);
}

/* ---------- i voti detti ---------- */
// Un voto detto nella barra, in qualsiasi sistema (docs/LINGUE.md, «I voti»): «28», «8,5», «1.7», «2,3», «72», «72 %». Il
// riconoscitore restituisce il numero detto; se il sistema scelto lo ha lo decide js/libretto.js (interpretaVoti) con
// js/sistemi.js. VOTO_CIFRE vale dopo un verbo o un articolo («I got 8.5», «ich hab ne 2»); VOTO_SOLO, senza verbo, vuole
// due cifre o i decimali («1,7 in Mathe»: «2 in Mathe» da solo non è un voto)
export const VOTO_CIFRE = '(\\d{1,3}(?:[.,]\\d{1,2})?(?: ?%)?)';
export const VOTO_SOLO = '(\\d{2,3}(?:[.,]\\d{1,2})?(?: ?%)?|\\d[.,]\\d{1,2})';
// le lettere degli Stati Uniti («A», «A-», «B+», nella frase in minuscolo): il numero è il punteggio GPA, come lo salva
// js/sistemi.js (A− → 3,7)
export const VOTO_LETTERA = '([abcdf][+\\-−–]?)(?![\\p{L}\\d+\\-−–])';
const GPA = { 'a+': 4, a: 4, 'a-': 3.7, 'b+': 3.3, b: 3, 'b-': 2.7, 'c+': 2.3, c: 2, 'c-': 1.7, 'd+': 1.3, d: 1, 'd-': 0.7, f: 0 };
// il numero di un voto detto (cifre o lettera), fra 0 e 100; altrimenti null
export function numeroVoto(x) {
  const s = String(x ?? '').trim().toLowerCase().replace(/[−–]/g, '-');
  if (/^[a-f]/.test(s)) return s in GPA ? GPA[s] : null;
  const v = Number(s.replace(/\s*%$/, '').replace(',', '.'));
  return s && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
}
// l'obiettivo di «quanto mi serve»: l'ultimo numero detto («110», «105», «2,0», «3.5», «7»), come numero. Da 66 in su è la
// base di laurea italiana (al massimo 110, come prima); sotto è un voto finale di un altro sistema (lo legge js/libretto.js)
export function obiettivoDetto(resto) {
  const tutti = [...String(resto ?? '').matchAll(/(?<![\d.,])(\d{1,3}(?:[.,]\d{1,2})?)(?![\d])/g)];
  if (!tutti.length) return null;
  const b = Number(tutti[tutti.length - 1][1].replace(',', '.'));
  if (!Number.isFinite(b) || b <= 0) return null;
  return b >= 66 ? Math.min(110, b) : b;
}

/* ---------- i voti negli esempi della barra ---------- */
// Gli esempi di «Prova a scrivere» (ESEMPI di ogni riconoscitore) hanno {voto}, {obiettivo} e {simula} al posto dei numeri:
// qui diventano i voti del sistema scelto, così ogni esempio è un voto che il sistema ha. Per ogni sistema: un voto buono,
// un obiettivo tipico del voto finale, il voto di «e se prendo». In Italia 28, 110 e 30: gli esempi di sempre
export const VOTI_ESEMPIO = {
  it: { voto: 28, obiettivo: 110, simula: 30 },
  es: { voto: 8.5, obiettivo: 8, simula: 9 },
  fr: { voto: 15, obiettivo: 14, simula: 16 },
  de: { voto: 1.7, obiettivo: 2, simula: 1.3 },
  pt: { voto: 16, obiettivo: 14, simula: 17 },
  br: { voto: 8.5, obiettivo: 7, simula: 9 },
  uk: { voto: 72, obiettivo: 70, simula: 80 },
  us: { voto: 'A-', obiettivo: 3.5, simula: 'A' },
};
// ESEMPI con i voti del sistema (codice). opz: virgola (il separatore dei decimali della lingua: «8,5»; in inglese «8.5») e
// voti (le parole della lingua per un sistema, dal riconoscitore: «a first», «an A-»). In Germania i voti hanno sempre un
// decimale («2,0»), come l'obiettivo del GPA («3.5»)
export function riempiEsempi(ESEMPI, sistema, { virgola = true, voti = {} } = {}) {
  const cod = sistema in VOTI_ESEMPIO ? sistema : 'it', base = VOTI_ESEMPIO[cod], proprie = voti?.[cod] || {};
  const scrivi = k => {
    const x = proprie[k] ?? base[k];
    if (typeof x !== 'number') return x;
    const s = cod === 'de' || (cod === 'us' && k === 'obiettivo') ? x.toFixed(1) : String(x);
    return virgola ? s.replace('.', ',') : s;
  };
  return ESEMPI.map(([frase, cosa]) => [frase.replace(/\{(voto|obiettivo|simula)\}/g, (_, k) => scrivi(k)), cosa]);
}

// Il guardaroba (js/guardaroba.js): «metti la corona», «togli il cappello», «guardaroba» in ogni lingua. Ogni riconoscitore
// dà le sue parole: nomi (detto → id dell'accessorio, già senza accenti né apostrofi), i modi di metterlo e di toglierlo
// (NOME al posto del nome), le parole generiche per «il cappello» e i modi di aprire il guardaroba. La frase si confronta
// tutta (^…$): «metti la corona» sì, «metti la corona di spine nel riassunto» no (va all'AI).
// { tipo: 'accessorio', id } mette (id) o toglie (null); { tipo: 'accessorio', apri: true } apre la scelta
export function accessorioDetto(frase, { nomi, metti, togli, generico, apri }) {
  const t = norm(String(frase || '').replace(/œ/g, 'oe').replace(/Œ/g, 'oe').replace(/ß/g, 'ss').replace(/æ/g, 'ae'));
  if (!t || t.length > 60) return null;
  const tutti = Object.keys(nomi).sort((a, b) => b.length - a.length).join('|');
  if (new RegExp(`^(?:${apri})$`).test(t)) return { tipo: 'accessorio', apri: true };
  for (const re of togli) if (new RegExp(`^${re.replace('NOME', `(?:${tutti}|${generico})`)}$`).test(t)) return { tipo: 'accessorio', id: null };
  let m;
  for (const re of metti) if ((m = t.match(new RegExp(`^${re.replace('NOME', `(${tutti})`)}$`)))) return { tipo: 'accessorio', id: nomi[m[1]] };
  return null;
}

// «Voglio fare…» (la guida passo passo, js/guida.js): «voglio fare un sito», «I want to make a presentation», «wie mache ich
// ein Video»… diventano { tipo: 'voglio', q }; «riprendi la guida» diventa { tipo: 'guida' }. Ogni riconoscitore dà le sue
// due regex (VOGLIO con il gruppo «q», GUIDA già in minuscolo) e la sua funzione di sempre (base). I comandi che ci sono già
// vincono: «voglio fare la prova generale», «voglio ripassare», «voglio spiegare» restano quelli di adesso. Se quello che si
// vuole fare è a sua volta un comando («voglio studiare analisi 2» → «studiare analisi 2», il focus), vale quel comando.
// Le regole generiche che prendono una parola in mezzo alla frase (il libretto con «media», «crediti»; un esame trovato per
// nome) non rubano la frase alla guida: «voglio fare un grafico della media» è un obiettivo, non il libretto.
const GENERICI = new Set(['libretto', 'serve', 'apriEsame']);
const DELEGA = new Set(['ripasso', 'focus', 'temi', 'prova', 'crocette', 'orale', 'spiego', 'stampa', 'gioco', 'trascrivi', 'programma', 'anki', 'tasca', 'domande',
  'riordina', 'chiudiLezione', 'ore', 'esami', 'vediOrario', 'agenti', 'moodle', 'sincronizza', 'prepara', 'ai', 'progetto', 'errore', 'diario', 'condividi', 'lingua']);
const ripulita = f => String(f || '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/^[¿¡\s]+/, '').replace(/[?!.\s]+$/, '').trim();
// restano all'AI: capire o studiare qualcosa («voglio capire gli integrali», «quero estudar mais») e le domande su Lode e i
// suoi compagni («how do I import my cards into anki»)
const ALL_AI = /^(?:capire|comprendere|studiare|imparare a memoria|understand|study|entender|comprender|estudiar|estudar|comprendre|[ée]tudier|verstehen|lernen)\b|\b(?:anki|lode|obsidian|moodle)\b/i;
export function conVoglio(frase, base, { VOGLIO, GUIDA, CODA = null }) {
  const g = ripulita(frase);
  if (g && GUIDA.test(g.toLowerCase())) return { tipo: 'guida' };
  const m = g.match(VOGLIO), r = base(frase);
  if (!m) return r;
  if (r && !GENERICI.has(r.tipo)) return r;
  let q = m.groups.q.trim();
  if (CODA) q = q.replace(CODA, '').trim();   // il tedesco: «eine Präsentation machen» → «eine Präsentation»
  if (q.replace(/[^\p{L}\p{N}]/gu, '').length < 2 || ALL_AI.test(q)) return r;
  const x = base(q);
  if (x && DELEGA.has(x.tipo)) return x;
  return { tipo: 'voglio', q };
}
