// Le parole delle sei lingue per LEGGERE i testi dello studente (programmi, compiti, date) e i numeri scritti nella forma
// della lingua della barra. Un programma o un compito incollato non è per forza nella lingua della barra: uno studente in
// Erasmus incolla il compito in tedesco con la barra in italiano. Per questo chi legge (programma.js, temi.js, giochi.js…)
// usa l'UNIONE delle sei lingue, con l'italiano sempre per primo: in italiano i risultati restano quelli di prima.
// I testi da MOSTRARE invece stanno nei cataloghi (js/lingue/<codice>/<area>.js), come sempre.
import { locale } from './lingua.js';

// il nome della lingua per le istruzioni all'AI: in inglese, che i modelli (anche quelli piccoli) seguono meglio
export const NOME_INGLESE = { it: 'Italian', en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Brazilian Portuguese' };
// le lingue della voce: Whisper vuole il nome inglese in minuscolo, il riconoscimento del browser e la lettura il codice del paese
export const WHISPER = { it: 'italian', en: 'english', es: 'spanish', fr: 'french', de: 'german', pt: 'portuguese' };
export const PAESE_VOCE = { it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR' };

// numeri con al più «max» decimali, nella forma della lingua: 7,5 in italiano, 7.5 in inglese; mai i separatori delle
// migliaia (punti e gigabyte sono numeri piccoli, e in italiano «3,5» resta «3,5» come prima)
export const numeroCorto = (x, max = 2) => Number(x).toLocaleString(locale(), { maximumFractionDigits: max, useGrouping: false });
// l'ora «14:05» nella forma della lingua (tutte e sei usano le 24 ore: in italiano è quella di prima)
export const oraBreve = d => new Date(d).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// i mesi delle sei lingue, senza accenti e in minuscolo, scritti qui (non da Intl: un browser senza tutte le lingue li
// darebbe in inglese). Il primo è l'italiano
const MESI_LINGUE = [
  'gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre',
  'january february march april may june july august september october november december',
  'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre',
  'janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre',
  'januar februar marz april mai juni juli august september oktober november dezember',
  'janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro',
].map(r => r.split(' '));
const piana = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
// una parola delle altre lingue («february», «Feb.», «März», «juil») → il numero del mese, o 0: il nome intero, o
// un'abbreviazione di almeno 3 lettere che è l'inizio di un mese solo (in francese «jui» è giugno e luglio: non vale)
export function meseAltre(parola, lingue = MESI_LINGUE.slice(1)) {
  const w = piana(parola); if (w.length < 3) return 0;
  for (const mesi of lingue) {
    const i = mesi.indexOf(w); if (i >= 0) return i + 1;
    const inizio = mesi.flatMap((m, k) => m.startsWith(w) ? [k] : []);
    if (inizio.length === 1) return inizio[0] + 1;
  }
  return 0;
}
// solo i mesi inglesi: l'ordine «February 12, 2024» è solo inglese (con tutte le lingue «Marco 12 2024», un nome italiano
// in un'intestazione, diventava il 12 marzo per il «março» portoghese)
export const meseInglese = parola => meseAltre(parola, [MESI_LINGUE[1]]);
// una parola qualsiasi → il numero del mese, o 0. Prima la regola italiana di sempre (le prime 3 lettere di un mese
// italiano: «febbraio», «feb», «sett.»), poi le altre lingue. Le prime 3 lettere non si contraddicono mai fra le sei lingue
// («mar» è marzo ovunque, «set» settembre in italiano e in portoghese)
export function meseDa(parola) {
  const w = piana(parola), it = w.length >= 3 ? MESI_LINGUE[0].findIndex(m => m.startsWith(w.slice(0, 3))) : -1;
  return it >= 0 ? it + 1 : meseAltre(w);
}

// i numeri da 1 a 3 scritti in fondo al nome di un esame («physics two», «Física dos», «Mathe zwei») → la cifra.
// Solo in fondo: «dos» in portoghese è anche «dei» («História dos Números»). L'italiano (uno, due, tre) lo fa dati.js come prima
const NUMERI_FONDO = { one: 1, two: 2, three: 3, dos: 2, tres: 3, deux: 2, trois: 3, eins: 1, zwei: 2, drei: 3, dois: 2, duas: 2 };
export const numeroInFondo = q => q.replace(/\b(one|two|three|dos|tres|deux|trois|eins|zwei|drei|dois|duas)$/, (_, w) => String(NUMERI_FONDO[w]));
