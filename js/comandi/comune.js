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
export function detto(testo, P, quale) {
  const x = String(testo ?? '').toLowerCase(), lista = P?.[quale] || [];
  if (quale === 'si' || quale === 'no') {
    const f = x.replace(/[\s,.!]*$/, '');
    if (lista.includes(f)) return true;
    return quale === 'si' && (P.siCoda || []).some(c => f.endsWith(' ' + c) && lista.includes(f.slice(0, -(c.length + 1))));
  }
  if (quale === 'voto') return lista.some(w => x.startsWith(w) && !/\w/.test(x.charAt(w.length)));
  return lista.includes(x);
}
