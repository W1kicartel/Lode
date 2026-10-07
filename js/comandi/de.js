// Il riconoscitore tedesco (smistato da js/comandi.js): le frasi che scriverebbe davvero uno studente in Germania, Austria o
// Svizzera, senza AI e spesso di fretta, senza dieresi («Prufung», «Pruefung») e con «ss» al posto di «ß»: «Fokus 50 auf
// Mathe 2», «hab ne 28 in Physik 2», «Prüfung Datenbanken am 15. Januar 9 ECTS», «was brauch ich für 110», «Mathe 2
// wiederholen», «Karte: Satz von Green = …», «erklär den Fehler», «Projekt verfolgen», «Sprache Englisch».
// Restituisce gli stessi oggetti { tipo, … } del riconoscitore italiano (js/comandi/it.js), campo per campo: il resto della
// barra non sa in che lingua è arrivata la frase. Se la frase non è un comando ritorna null: comandi.js prova allora
// l'inglese, e poi (se c'è la chiave) ci pensa l'AI.
// I voti restano quelli detti sulla scala italiana (18-30, «mit Lode», «cum laude»), come in inglese: le note tedesche
// (1,0-5,0) le leggerà il sistema dei voti (js/sistemi.js), non qui.
// I numeri a parole («achtundzwanzig») diventano cifre solo dentro i comandi: non c'è un export «numeri», così le formule
// dettate in tedesco restano come sono (docs/LINGUE.md, «La voce e le formule»).
import { norm, oggi, piuGiorni, trovaEsame } from '../dati.js';
import { sembraErrore, dataInCifre, conAnno, orarioOk, oreInCifre, linguaDetta, linguaIgnota, linguaIgnotaDetta, VOTO_CIFRE, VOTO_SOLO, numeroVoto, obiettivoDetto, accessorioDetto } from './comune.js';

// le espressioni si scrivono con le dieresi; chi scrive di fretta le salta o le scioglie: «ü» vale anche «ue» e «u», «ß»
// anche «ss». \b diventa un confine di parola che conosce le lettere tedesche (quello di JavaScript taglia «über» prima
// della ü). Si compilano una volta sola
const LETTERA = 'a-z0-9_äöüß';
const CONFINE = `(?:(?<![${LETTERA}])(?=[${LETTERA}])|(?<=[${LETTERA}])(?![${LETTERA}]))`;
const COMPILATE = new Map();
function R(s, f = '') {
  const k = f + '\u0000' + s;
  if (!COMPILATE.has(k)) {
    const x = s.replace(/ä/g, '(?:ä|ae|a)').replace(/ö/g, '(?:ö|oe|o)').replace(/ü/g, '(?:ü|ue|u)').replace(/ß/g, '(?:ß|ss)').replace(/\\b/g, CONFINE);
    COMPILATE.set(k, new RegExp(x, f));
  }
  return COMPILATE.get(k);
}
const r = (s, ...v) => R(String.raw(s, ...v));
const ri = (s, ...v) => R(String.raw(s, ...v), 'i');
const rg = (s, ...v) => R(String.raw(s, ...v), 'g');
// la parola senza dieresi, per confrontarla con gli elenchi: «Fünf», «fuenf», «funf» → «funf»
const piega = s => String(s).toLowerCase().replace(/ä|ae/g, 'a').replace(/ö|oe/g, 'o').replace(/ü|ue/g, 'u').replace(/ß/g, 'ss');

const GIORNI = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
// i nomi delle lingue detti in tedesco (quelli nella loro lingua li conosce comune.js); linguaDetta toglie le dieresi
const LINGUE_DE = { italienisch: 'it', englisch: 'en', spanisch: 'es', franzosisch: 'fr', franzoesisch: 'fr', deutsch: 'de', portugiesisch: 'pt' };

// i numeri detti a voce: «achtundzwanzig» → 28, «fünfzig» → 50, «hundertzehn» → 110, «zwo» → 2. «ein», «eine» restano
// articoli («eine Stunde» la legge leggiMinuti)
const EINS = ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const ZEHNER = ['zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
const EINER = ['ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const S100 = `(?:(?:${EINER.join('|')})\\s?und\\s?)?(?:${ZEHNER.join('|')})|${[...EINS].sort((a, b) => b.length - a.length).join('|')}|zwo`;
const ZAHL = R(`\\b(?:(?:ein\\s?)?hundert(?:\\s?und)?\\s?(?:${S100})?|${S100})\\b`, 'gi');
const [EINS_, ZEHNER_, EINER_] = [EINS, ZEHNER, EINER].map(l => l.map(piega));
function wert(w) {
  let s = piega(w).replace(/\s+/g, ''), v = 0;
  if (s.includes('hundert')) { v = 100; s = s.replace(/^.*hundert(?:und)?/, ''); }
  const m = s.match(new RegExp(`^(?:(${EINER_.join('|')})und)?(${ZEHNER_.join('|')})$`));
  if (m) v += (m[1] ? EINER_.indexOf(m[1]) + 1 : 0) + (ZEHNER_.indexOf(m[2]) + 2) * 10;
  else if (s === 'zwo') v += 2;
  else if (s) v += EINS_.indexOf(s) + 1;
  return v;
}
const inCifre = t => String(t).replace(ZAHL, w => String(wert(w)));
const NUM = { ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, ne: 1, nen: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, zwolf: 12, vierzehn: 14, funfzehn: 15, zwanzig: 20, dreissig: 30 };
const n = s => (piega(s) in NUM ? NUM[piega(s)] : Number(s));

// i mesi interi, abbreviati e austriaci («Jänner», «Feber»), già senza dieresi (norm)
const MESI = '(januar|jaenner|janner|jan|februar|feber|feb|marz|maerz|mrz|mar|april|apr|mai|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|dezember|dez)';
const meseDi = s => (/^ja/.test(s) ? 0 : /^fe/.test(s) ? 1 : s === 'mai' ? 4 : /^m/.test(s) ? 2 : /^ap/.test(s) ? 3 : /^jun/.test(s) ? 5 : /^jul/.test(s) ? 6 : /^au/.test(s) ? 7 : /^se/.test(s) ? 8 : /^ok/.test(s) ? 9 : /^no/.test(s) ? 10 : 11);
export function leggiData(testo) {
  const t = ' ' + norm(testo) + ' ', T = oggi();
  let m;
  if ((m = t.match(/ (uber|ueber)morgen /))) return { data: piuGiorni(T, 2), pezzo: m[1] + 'morgen' };
  if (/ morgen /.test(t)) return { data: piuGiorni(T, 1), pezzo: 'morgen' };
  if (/ heute /.test(t)) return { data: T, pezzo: 'heute' };
  if ((m = t.match(/ in (\d+|[a-z]+) (tag|tagen|woche|wochen|monat|monaten) /))) {
    const k = n(m[1]); if (k) return { data: piuGiorni(T, k * (m[2].startsWith('woche') ? 7 : m[2].startsWith('monat') ? 30 : 1)), pezzo: m[0].trim() };
  }
  // «nächste Woche», «kommende Woche»: fra sette giorni, come «in einer Woche»
  if ((m = t.match(/ (?:(?:in der |die )?(?:nachste|naechste|nachsten|naechsten|kommende|kommenden) woche|in einer woche) /))) return { data: piuGiorni(T, 7), pezzo: m[0].trim() };
  { const c = dataInCifre(t, testo); if (c) return c; }
  // «15. Januar», «am 15 Jänner 2027», «den 3. Okt»: mai l'inizio di un'altra parola («Mars», «Juniorprofessor»)
  if ((m = t.match(new RegExp(` (?:am |den |vom )?(\\d{1,2}) (?:ten )?${MESI} (?:(\\d{4}) )?`)))) return { data: conAnno(+m[1], meseDi(m[2]), m[3] ? +m[3] : null), pezzo: m[0].trim() };
  if ((m = t.match(/ (?:(?:am|an|diesen|diesem|nachsten|naechsten|kommenden) )?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag) /))) {
    const dow = m[1] === 'sonnabend' ? 6 : GIORNI.indexOf(m[1]), d = new Date(T + 'T12:00'); const k = (dow - d.getDay() + 7) % 7 || 7;
    return { data: piuGiorni(T, k), pezzo: m[0].trim() };
  }
  return null;
}
// toglie da una frase il pezzo di data trovato da leggiData (che è senza dieresi e senza punti: «am 15 marz»)
function togli(s, pezzo) {
  const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const corpo = s.includes(pezzo) ? esc(pezzo) : pezzo.split(' ').map(w => esc(w).replace(/a/g, '(?:a|ä)').replace(/o/g, '(?:o|ö)').replace(/u/g, '(?:u|ü)').replace(/ss/g, '(?:ss|ß)')).join('[\\s.,/-]+');
  // anche l'«am», il «den», il «vom» davanti a una data in cifre: «Klausur am 12.2. in Mathe 2» → «in Mathe 2»
  return s.replace(new RegExp(`(?:(?<=^|\\s)(?:am|den|vom)\\s+)?${corpo}`, 'i'), ' ');
}

// articoli e preposizioni attorno al nome di un esame o di un corso: «für die Mathe 2», «von meinem Physik 2»
const ART = 'der|die|das|den|dem|des|mein|meine|meinen|meinem|meiner|ein|eine|einen|einem|einer|ne|nen';
// «on»: chi mescola l'inglese («Fokus 50 on Physik 2»)
const PREP = 'von|vom|für|fürs|in|im|zu|zum|zur|auf|über|bei|beim|aus|mit|an|am|um|on';
const pulisci = s => String(s)
  .replace(r`^\s*(?:${PREP}|${ART}|(?:prüfung|klausur)(?: (?:in|von|für|zu))?)\s+`, '').replace(r`^\s*(?:${ART})\s+`, '')
  .replace(/[?.!,;:]+$/, '').replace(r`\s+(?:${PREP}|${ART}|und)\s*$`, '').trim().replace(r`^(?:${PREP}|${ART})$`, '');

// minuti detti a parole: «50», «50 Minuten», «eine Stunde», «ne halbe Stunde», «anderthalb Stunden», «2 Std», «1h30»
function leggiMinuti(t) {
  let m;
  if ((m = t.match(/(?:^|\s)(\d{1,2})\s*h\s*(\d{1,2})\b/))) return { min: +m[1] * 60 + +m[2], pezzo: m[0].trim() };
  if ((m = t.match(r`(?:^|\s)(?:eine |ne )?dreiviertel ?stunde\b`))) return { min: 45, pezzo: m[0].trim() };
  if ((m = t.match(r`(?:^|\s)(?:eine |ne )?viertel ?stunde\b`))) return { min: 15, pezzo: m[0].trim() };
  if ((m = t.match(r`(?:^|\s)(?:eine |ne )?halbe stunde\b`))) return { min: 30, pezzo: m[0].trim() };
  if ((m = t.match(r`(?:^|\s)(?:anderthalb|eineinhalb|1[,.]5) ?(?:stunden|std|h)\b\.?`))) return { min: 90, pezzo: m[0].trim() };
  if ((m = t.match(r`(?:^|\s)(\d+|eine?n?|ne|zwei|drei)(einhalb)? ?(?:stunden?|std|h)\b\.?(?: und (?:eine |ne )?halbe)?`))) return { min: n(m[1]) * 60 + (m[2] || / halbe$/.test(m[0]) ? 30 : 0), pezzo: m[0].trim() };
  if ((m = t.match(r`(?:^|\s)(\d+|[a-z\u00e4\u00f6\u00fc]+)\s*(?:minuten|min)\b\.?|(?:^|\s)(\d+)\s*m\b`))) { const k = n(m[1] || m[2]); if (k) return { min: k, pezzo: m[0].trim() }; }
  // un numero da solo: all'inizio («Fokus 50 auf …») o in fondo dopo «für» («lerne Physik für 50»), non il «2» di «Mathe 2»
  if ((m = t.match(/^\s*(\d{1,3})(?=\s|$)/)) || (m = t.match(r`\bfür (\d{1,3})$`))) return { min: +m[1], pezzo: m[0].trim() };
  return null;
}

// i comandi di «Segui il progetto» (in italiano stanno in js/codice/progetto.js): stessi oggetti { tipo: 'progetto', azione, nome? }.
// In Germania il progetto di laboratorio si discute all'«Abnahme» o al «Testat»
const PRUFUNG_PROGETTO = '(?:diskussion|projektbesprechung|besprechung|verteidigung|abnahme|projektabnahme|testat)';
const PROGETTO = [
  [r`^(?:(?:das |dem |ein |mein |meinem )?projekt (?:verfolgen|beobachten|überwachen|tracken)|(?:verfolg|verfolge|beobachte|beobachten|überwach|überwache|track)(?: das| mein| ein)?(?: neues)? projekt|folge? (?:dem|meinem) projekt)$`, () => ({ azione: 'segui' })],
  [r`^was hat sich(?: (?:in|bei|im|an) (.+?))? geändert$|^was ist (?:in|bei|an) (.+?) (?:neu|anders)$`, m => ({ azione: 'cambiato', nome: m[1] || m[2] })],
  [r`^(?:zeig(?: mir)? )?(?:die )?änderungen(?: (?:in|an|von|bei|im) (.+?))?(?: zeigen| anzeigen)?$`, m => ({ azione: 'cambiato', nome: m[1] })],
  [r`^(?:hab ich(?:'s|s| es| das)? getestet|(?:ist (?:es|das) )?getestet|schon getestet)$`, () => ({ azione: 'provato' })],
  [r`^(?:test|teste|testen|prüf|prüfe|check|checke) (?:das |mein |den |meinen )?(?:projekt|code|programm)(?: (.+))?$`, m => ({ azione: 'prova', nome: m[1] })],
  [r`^(?:das |mein |den |meinen )?(?:projekt|code|programm)(?: (.+?))? (?:testen|prüfen|checken|kompilieren|bauen|laufen lassen)$`, m => ({ azione: 'prova', nome: m[1] })],
  [r`^(?:kompilieren|kompilier|kompiliere|bauen|bau)(?: (?:das |mein |den |meinen )?(?:projekt|code|programm)(?: (.+))?)?$`, m => ({ azione: 'prova', nome: m[1] })],
  [r`^(?:hör|hoer) auf,?(?: (?:das |dem )?(?:projekt )?(.+?))? zu (?:verfolgen|beobachten)$`, m => ({ azione: 'smetti', nome: m[1] })],
  [r`^(?:(?:das |dem )?(?:projekt )?(.+?) )?nicht mehr (?:verfolgen|beobachten)$`, m => ({ azione: 'smetti', nome: m[1] })],
  [r`^(?:verfolgen|beobachten|verfolgung|tracking) (?:beenden|stoppen)$`, () => ({ azione: 'smetti' })],
  [r`^(?:bereite?|mach) mich (?:fit )?(?:auf|für) (?:die |das |den )?${PRUFUNG_PROGETTO}(?: (?:von|für|zu|zum) (.+?))?(?: vor)?$`, m => perDiscussione(m[1])],
  [r`^(?:ich bin )?bereit für (?:die |das |den )?${PRUFUNG_PROGETTO}(?: (?:von|für|zu|zum) (.+))?$`, m => perDiscussione(m[1])],
  [r`^(?:die )?funktionen,? die ich erklären muss(?: (?:in|von|bei) (.+))?$`, m => perDiscussione(m[1])],
  [r`^${PRUFUNG_PROGETTO}$`, () => ({ azione: 'discussione' })],
  [r`^${PRUFUNG_PROGETTO} (?:von|für|zu|zum) (.+)$`, m => perDiscussione(m[1])],
];
// come in progetto.js: senza nome il progetto più recente, con un nome solo se ha l'aria di un laboratorio («lab3», un numero)
const perDiscussione = nome => (!nome ? { azione: 'discussione' } : /\d|\blab|projekt|project|praktikum/.test(nome) ? { azione: 'discussione', nome } : null);
function interpretaProgetto(testo) {
  const t = String(testo || '').toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim();
  for (const [re, f] of PROGETTO) {
    const m = re.exec(t); if (!m) continue;
    const x = f(m); if (!x) continue;
    const c = { tipo: 'progetto', ...x }, nome = c.nome?.replace(r`^(?:das |mein |den |meinen )?(?:projekt|code|programm)\b\s*`, '').trim();
    if (nome) c.nome = nome; else delete c.nome;
    return c;
  }
  return null;
}

// quello che segue «Fokus», «Training», «Karten» è un esame o niente: «Fokus ist wichtig», «Spiel mir das Lied vom Tod»,
// «Karten spielen ist lustig» sono frasi, non comandi
const FRASE = R(String.raw`^(?:ich|man|wir|du|ihr|sie|es|mir|mich|dir|dich|uns)\b|\b(?:ist|sind|war|waren|macht|machen|hilft|bringt|kann|soll|muss)\b`);
// un comando dentro «zeig mir …», «öffne …»: «zeig mir meine Noten» è il libretto, non una pagina che si chiama «Noten»
const DENTRO = new Set(['naviga', 'apriEsame']);

// der Kleiderschrank (js/guardaroba.js): „setz die Krone auf“, „nimm den Hut ab“, „Kleiderschrank“ (Wörter ohne Umlaute: ü → u)
const ART_G = '(?:(?:den|die|das|dem|der|einen|eine|ein|deinen|deine|dein|meinen|meine|mein) )?';
export const GUARDAROBA = {
  nomi: { doktorhut: 'tocco', absolventenhut: 'tocco', abschlusshut: 'tocco', lorbeerkranz: 'alloro', lorbeeren: 'alloro', lorbeer: 'alloro', krone: 'corona', kronchen: 'corona',
    mutze: 'berretto', bommelmutze: 'berretto', wollmutze: 'berretto', pudelmutze: 'berretto', strickmutze: 'berretto', zauberhut: 'mago', zaubererhut: 'mago', kopfhorer: 'cuffie',
    brille: 'occhiali', 'runde brille': 'occhiali', schleife: 'fiocco', partyhut: 'festa', partyhutchen: 'festa', partymutze: 'festa', heiligenschein: 'aureola', baskenmutze: 'basco', barett: 'basco', zylinder: 'cilindro' },
  metti: [`(?:setz|setze|zieh|ziehe|trag|trage)(?: dir| mal| dir mal)? ${ART_G}NOME(?: auf| an)?`, `${ART_G}NOME (?:aufsetzen|anziehen|tragen)`],
  togli: [`(?:nimm|setz|setze|zieh|ziehe)(?: dir| mal| dir mal)? ${ART_G}NOME (?:ab|aus)`, `${ART_G}NOME (?:ab|absetzen|ausziehen)`, 'ohne (?:hut|accessoire|zubehor)'],
  generico: 'hut|hute|accessoire|accessoires|zubehor',
  apri: '(?:(?:offne|zeig mir|zeig) )?(?:den |meinen )?(?:kleiderschrank|garderobe|schrank)(?: offnen| auf)?|(?:hut|accessoire) wechseln|hute|accessoires',
};
export function interpreta(frase) {
  const grezzo0 = String(frase || '').trim(); if (!grezzo0) return null;
  { const a = accessorioDetto(grezzo0, GUARDAROBA); if (a) return a; }
  // informatica: «erklär den Fehler», anche con l'errore incollato dopo. Solo se dopo «Fehler» non c'è niente, ci sono i due
  // punti o un a capo, o c'è davvero un errore del compilatore: «was bedeutet Standardfehler» resta all'AI
  let e0;
  if ((e0 = grezzo0.match(ri`^(?:erklär|erkläre|erklär mir|erkläre mir|erklärst du mir|was bedeutet|was heißt|was sagt|was soll|hilf mir mit|hilf mir bei) (?:mir )?(?:den |der |die |dem |diesen |dieser |diesem |meinen |meinem |mein |das )?(?:compiler-?|kompilier-?)?fehler(?:meldung)?\b([\s\S]*)$`))) {
    const dopo = e0[1].replace(/^[ \t]+/, ''), testo = dopo.replace(/^:/, '').trim();
    const solo = !testo || /^[?.!]+$/.test(testo) || ri`^(?:bedeuten|heißen|sagen|vom compiler|den ich kopiert hab(?:e)?|(?:ich )?hab(?:e)? (?:ihn |es )?(?:gerade |eben )?kopiert)[?.!]*$`.test(testo);
    if (solo) return { tipo: 'errore', testo: null };
    if (/^[:\n]/.test(dopo) || sembraErrore(testo)) return { tipo: 'errore', testo };
  }
  const pr = interpretaProgetto(grezzo0); if (pr) return pr;
  // la voce aggiunge maiuscole e un punto finale; i numeri arrivano a parole; «bitte» e «mal» non cambiano il comando
  const grezzo = inCifre(grezzo0.replace(/[.!]+$/, ''));
  const t = grezzo.toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim()
    .replace(/^bitte,? |,? bitte$/g, '').replace(/(?<!\d|\bnoch|\bein) mal (?!\d)/g, ' ').replace(/^mal (?!\d)/, '');
  let m;

  // la lingua della barra: «Sprache Englisch», «auf Deutsch umstellen», «stell die Sprache auf Spanisch», «Sprache: français»
  if ((m = t.match(r`^(?:(?:stell|stelle|schalt|schalte|wechsel|wechsle|änder|ändere)(?: die)?(?: app)?(?: sprache)? (?:auf|zu|nach|in)|sprache(?: wechseln| ändern| umstellen)?:?(?: auf| zu| in)?|(?:sprich|rede|antworte|schreib)(?: mit mir)? (?:auf|in)|auf|in|ich will (?:lode |die app |es )?(?:auf|in)) (\S+?)(?: (?:um|umstellen|stellen|ändern|wechseln))?$|^(\S+) als sprache$`)) && (linguaDetta(m[1] || m[2], LINGUE_DE) || linguaIgnota(m[1] || m[2]))) return { tipo: 'lingua', codice: linguaDetta(m[1] || m[2], LINGUE_DE) };
  // una lingua che Lode non parla («lingua giapponese», «language japanese»…): codice null, la barra dice quali conosce
  if (linguaIgnotaDetta(grezzo)) return { tipo: 'lingua', codice: null };
  if (r`^(?:hilfe|hilf mir|\?|was kannst du(?: alles)?|was kann ich (?:sagen|schreiben|fragen|eingeben)|befehle|kommandos|welche befehle gibt es)$`.test(t)) return { tipo: 'aiuto' };
  if (r`^(?:stopp?|beenden|beende|aufhören|hör auf|schluss|genug|abbrechen|abbruch|ende)(?: (?:den |die |das |mit dem |mit der )?(?:fokus|timer|pomodoro|session|lernsession))?$|^(?:den |die |das )?(?:fokus|timer|pomodoro|session|lernsession) (?:beenden|stoppen|abbrechen|aus)$`.test(t)) return { tipo: 'ferma' };
  if (r`^(?:pause|pausieren|pausier|pausiere|(?:den )?timer (?:pausieren|anhalten)|pausier den timer|halt den timer an|warte|warte kurz|moment|kurz warten|(?:ich )?mach(?:e)? (?:eine |ne |kurz )?pause)$`.test(t)) return { tipo: 'sospendi' };
  if (r`^(?:weiter|weitermachen|mach weiter|machen wir weiter|fortsetzen|fortfahren|(?:den )?timer (?:fortsetzen|weiterlaufen lassen)|weiter geht's|weiter gehts|los, weiter)$`.test(t)) return { tipo: 'riprendi' };
  // Anki: «nach Anki exportieren», «Anki», «exportier meine Physik 2 Karten nach Anki», «Anki Physik 2». Serve un verbo (prima
  // o in fondo, all'infinito) o la frase che comincia da «Anki» o dalle carte: «wie funktioniert Anki», «Anki herunterladen»
  // e «wie importiere ich Karten in Anki» restano all'AI
  if (r`\banki\b`.test(t)) {
    const VERBO = '(?:exportieren|exportier|exportiere|export|schick|schicke|schicken|pack|packe|packen|speicher|speichere|speichern|erstell|erstelle|erstellen|übertrag|übertrage|übertragen)';
    let s = t, verbo = false;
    s = s.replace(R(`^${VERBO}\\b\\s*`), () => { verbo = true; return ''; }).replace(R(`\\s*\\b${VERBO}$`), () => { verbo = true; return ''; });
    if (verbo || r`^(?:anki\b|(?:alle )?(?:die |meine )?(?:karten|karteikarten|lernkarten|kärtchen|flashcards|decks?|definitionen)\b)`.test(s)) {
      const x = pulisci(s.replace(r`(?:\b(?:nach|zu|in|für|fürs|ins) )?\banki\b`, ' ').replace(r`\b(?:alle )?(?:meine |die |deine )?(?:neuen )?(?:karten|karteikarten|lernkarten|kärtchen|flashcards|decks?|definitionen)\b`, ' ').trim().replace(/\s+/g, ' '));
      const domanda = !verbo && x && (/\?\s*$/.test(grezzo0) || r`^(?:wie|was|warum|wieso|wo|wann|geht|funktioniert|ist|sind|kann|soll|oder|vs|nicht|mit|herunterladen|runterladen|installieren|downloaden)(?=[\s']|$)`.test(x) || !trovaEsame(x));
      if (!domanda) return { tipo: 'anki', corso: x && !r`^(?:alle|alles|alle kurse|jeden kurs|allen kursen)$`.test(x) ? x : null };
    }
  }
  // «Karten fürs Handy» (Ripasso in tasca, js/tasca.js): le carte di domani in una nota, da fare sul telefono con Obsidian
  const TASCA = '(?:die |meine |eine )?(?:taschen-?wiederholung|hosentaschen-?wiederholung|taschenkarten|(?:karten|wiederholung|kärtchen) (?:fürs|für das|aufs|auf das|auf dem|am) handy|(?:karten|wiederholung) für unterwegs)';
  if (r`^(?:keine |nicht mehr )${TASCA}(?: mehr)?(?: jeden abend)?$|^(?:schalt|schalte|mach|stell|stelle) ${TASCA} (?:aus|ab)$|^${TASCA} (?:ausschalten|abschalten|abstellen|stoppen|aus)$`.test(t)) return { tipo: 'tasca', sera: false };
  if ((m = t.match(r`^(?:(?:mach|schick|bereite|schreib|gib|erstell)(?: mir)? )?${TASCA}( jeden abend| abends| jeden tag am abend| nur wenn ich (?:frage|frag|es sage)| nur auf anfrage)?(?: machen| schicken| erstellen| vor)?$`))) return m[1] ? { tipo: 'tasca', sera: !/nur/.test(m[1]) } : { tipo: 'tasca' };

  // il programma d'esame: «Prüfungsstoff für Mathe 2», «Stoffplan», «Mathe 2 Prüfungsstoff: 1. Grenzwerte …» (incollato, anche
  // su più righe). «Plan für heute» resta il piano di oggi
  const STOFF = '(?:prüfungsstoff|stoffplan|stoffübersicht|stoffliste|syllabus|themenliste|prüfungsthemen|prüfungsinhalte|modulinhalte|modulbeschreibung|lehrplan)';
  if ((m = grezzo0.match(ri`^(?:(?:öffne|zeig mir|zeig|hier ist|hier der|hier|füg ein) )?(?:den |die |das |meinen |meine |mein )?${STOFF}(?:\s+(?:von|für|in|zu|zum|im)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$`)) || (m = grezzo0.match(ri`^(?:(?:öffne|zeig mir|hier ist|hier) )?(?:den |die |das |mein |meinen )?([^:\n]+?)[ -]${STOFF}\s*(?:[:\n]([\s\S]*))?$`))) {
    if (!ri`^(?:für )?(?:heute|morgen)$`.test(m[1].trim())) { const nome = pulisci(inCifre(m[1]).toLowerCase()); return { tipo: 'programma', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() }; }
  }
  // «lass mich erklären: Green», «ich erklär dir die Potenzreihen»: lo studente spiega, Lode controlla cosa ha detto
  if ((m = t.match(r`^lass mich(?: dir)? (.+?) erklären$`)) && !/^(?:das|es|was)$/.test(m[1])) return { tipo: 'spiego', q: pulisci(m[1]) };
  if ((m = t.match(r`^(?:lass mich(?: dir)?(?: das| es| was)? erklären|ich erklär(?:e|'s|s)?(?: dir)?(?: es| das)?(?: dir)?|ich will (?:dir )?(?:was |etwas |das )?erklären|jetzt erklär(?:e)? ich(?: dir)?)\b\s*:?\s*(?:(?:jetzt|mal|kurz|gerade) )*(.*)$`))) return { tipo: 'spiego', q: pulisci(m[1] || '') };
  // le domande uscite agli appelli: «Prüfungsfragen für Mathe 2: …» (una per riga), i «Gedächtnisprotokolle» delle orali
  const DOM = '(?:prüfungsfragen|klausurfragen|altfragen|fragen aus (?:alten|früheren|vergangenen|den letzten) (?:klausuren|prüfungen)|gedächtnisprotokoll(?:e)?|prüfungsprotokoll(?:e)?)';
  if ((m = grezzo0.match(ri`^(?:(?:hier sind|hier|füg hinzu) )?(?:die |meine )?${DOM}(?:\s+(?:von|für|aus|in|zu|zum|im)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$`))) {
    const nome = pulisci(inCifre(m[1]).toLowerCase()); return { tipo: 'domande', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  // i temi d'esame (js/temi.js): «Altklausuren für Mathe 2: Aufgabe 1 …», «alte Klausuren von Physik 2»; «Aufgabe für Mathe 2»,
  // «gib mir eine Aufgabe» = l'esercizio di oggi. «Aufgaben in C», «Übungen in Python» restano a «Was gibt das aus?»
  const TEMI = '(?:altklausur(?:en)?|alte (?:klausur(?:en)?|prüfung(?:en)?)|frühere klausur(?:en)?|klausuraufgaben|prüfungsaufgaben|aufgaben aus (?:alten|früheren) klausuren)';
  if ((m = grezzo0.match(ri`^(?:(?:hier sind|hier ist|hier|füg hinzu|öffne|zeig mir|zeig) )?(?:die |eine |meine |ne )?${TEMI}(?:\s+(?:von|für|aus|in|zu|zum|im)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$`))) {
    const nome = pulisci(inCifre(m[1]).toLowerCase()); return { tipo: 'temi', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  if ((m = t.match(r`^(?:(?:gib mir|lass mich|ich mach|ich mache|mach|machen wir) )?(?:eine |ne |die |meine |die heutige |heutige )?(?:aufgabe|übungsaufgabe)(?: des tages| für heute| von heute| aus einer (?:alt)?klausur)?(?:\s+(?:von|für|zu|in|zum|aus)\s+(?!(?:c|c\+\+|java|python|programmieren)$)(.+?))?(?: machen| lösen)?$`))) {
    const nome = pulisci(m[1] || ''); return { tipo: 'temi', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: '' };
  }
  // la prova generale (js/prova.js): un compito vecchio intero col tempo vero. «Probeklausur für Mathe 2», «ganze Altklausur»
  if ((m = t.match(r`^(?:(?:lass mich|lass uns|ich will|ich möchte|starte?|beginne?|mach|schreib|schreibe|öffne) )?(?:eine |die |ne |einen )?(?:probeklausur|probeprüfung|generalprobe|(?:ganze|komplette|volle) (?:alt)?klausur|(?:ganze|komplette) prüfung)(?:\s+(?:von|für|in|zu|aus|im)\b)?\s*(.*?)$`))) {
    const nome = pulisci((m[1] || '').replace(r`(?:^|\s+)(?:schreiben|machen|starten)$`, '')); return { tipo: 'prova', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome };
  }

  // in aula: ★ da esame, definizione, domanda per il prof. «Prüfung: …» senza data né crediti è una ★
  if ((m = grezzo.match(ri`^(?:★|\*{1,2}|!|wichtig\s*:|klausurrelevant\s*:?|prüfungsrelevant\s*:?|relevant\s*:|stern\b\s*:?|(?:das )?kommt (?:sicher |bestimmt |immer )?(?:in der (?:prüfung|klausur) )?dran\s*:|markier(?:e)?(?: das)?(?: für die (?:prüfung|klausur))?\s*:)\s*(.+)$`))) return { tipo: 'stella', testo: m[1].trim() };
  if ((m = grezzo.match(ri`^(?:prüfung|klausur)\s*:\s*(.+)$`)) && !leggiData(m[1]) && !CREDITI.test(m[1])) return { tipo: 'stella', testo: m[1].trim() };
  if ((m = grezzo.match(ri`^(?:definition|definiere|definier|def)\s*:?\s*(.+?)\s*(?:::|:|=|→|—|-{1,2}>|\bbedeutet\b|\bheißt\b|\bist\b)\s*(.+)$`))) return { tipo: 'definizione', termine: m[1].replace(/\*\*/g, '').trim(), testo: m[2].trim() };
  if ((m = grezzo.match(ri`^(?:\?|frage\s*:|frage (?:an|für) (?:den |die )?(?:prof|professor|professorin|dozent|dozentin|dozierende[nr]?)\s*:?|(?:frag|frage) (?:den |die )?(?:prof|professor|professorin|dozent|dozentin)\s*:|prof fragen\s*:)\s*(.+)$`))) return { tipo: 'domanda', testo: m[1].trim() };

  // l'orario: «Vorlesung Mathe 2 Montag und Mittwoch 9-11 Raum 7», «VL Physik 2 freitags von 14 bis 16 Uhr»
  if ((m = t.match(r`^(?:neue |ich hab |ich habe )?(?:eine |die )?(?:vorlesung|vorlesungen|vl|vo|übung|tutorium|seminar|kurs|lv|lehrveranstaltung)\s+(?:von |in |zu |für |über )?(.+)$`))) {
    const o = leggiOrario(m[1]); if (o) return { tipo: 'orario', ...o };
  }
  if (r`^(?:(?:zeig(?: mir)? )?(?:mein |meinen |den )?stundenplan|meine (?:vorlesungen|kurse|lehrveranstaltungen)|wann hab(?:e)? ich (?:vorlesung|vorlesungen|uni|kurs)|welche vorlesungen? hab(?:e)? ich(?: heute| morgen)?)$`.test(t)) return { tipo: 'vediOrario' };
  { const l = leggiLavoro(t); if (l) return l; }
  if (r`^(?:der |mein |den )?(?:wochenplan|plan für die woche|plan der woche|plan für diese woche)$|^(?:meine woche|meine freie zeit|freie zeit|meine freien stunden|freie stunden|wie ?viel zeit hab(?:e)? ich(?: zum lernen)?)$`.test(t)) return { tipo: 'ore' };
  // «Was gibt das aus?»: esercizi di C (anche in Java e in Python) con la risposta calcolata da Lode
  if (r`^(?:was gibt (?:es|das|der code|das programm|er) aus|was wird ausgegeben|was kommt raus|(?:übungen|aufgaben) (?:in|zu) (?:c|programmieren)|c-(?:übungen|aufgaben)|trainier(?:e)? mich in c)$`.test(t)) return { tipo: 'stampa' };
  if ((m = t.match(r`^(?:was gibt (?:es|das|der code|das programm) in (java|python) aus|(?:übungen|aufgaben) (?:in|zu) (java|python)|(java|python)-(?:übungen|aufgaben)|trainier(?:e)? mich in (java|python))$`))) return { tipo: 'stampa', lingua: m[1] || m[2] || m[3] || m[4] };
  if ((m = t.match(r`^lass uns (.+?) spielen$`))) return { tipo: 'gioco', corso: pulisci(m[1]) || null };
  if ((m = t.match(r`^(?:spielen|spiel|lass uns spielen|minispiel|memory|trainier mich|training|definitionen (?:üben|trainieren|spielen))\b\s*(.*)$`)) && !FRASE.test(m[1])) {
    const x = pulisci(m[1] || ''); return { tipo: 'gioco', corso: x || null };
  }
  if (r`^(?:öffne |zeig(?: mir)? )?(?:meine |die )?(?:notizen|mitschrift|mitschriften|obsidian|vault|heutigen notizen|heutige notizen|vorlesungsnotizen)(?: von heute| der vorlesung)?(?: öffnen| zeigen)?$`.test(t)) return { tipo: 'appunti' };
  // «Vorlesung vom Computer»: la videolezione (Zoom, Teams, la piattaforma online) trascritta dall'audio del computer
  if ((m = t.match(r`^(?:((?:transkribier|transkribiere|nimm|schreib) (?:die |eine )?)?(?:videovorlesung|video-vorlesung|onlinevorlesung|online-vorlesung|aufgezeichnete vorlesung|zoom-vorlesung|vorlesung vom (?:computer|rechner|laptop|pc|mac)|computer-?audio|ton vom (?:computer|rechner|laptop|pc|mac))(?: auf| mit)?)\b\s*(?:von |vom |für |zu |in |aus |über )?(.*?)((?:(?<=\s)|\s)(?:transkribieren|aufnehmen|mitschreiben))?$`)) && (m[1] || m[3] || r`vom (?:computer|rechner|laptop|pc|mac)|audio`.test(t))) return { tipo: 'trascrivi', sorgente: 'computer', corso: pulisci(m[2] || '') || null };
  if (r`^(?:transkribieren|transkribier|transkribiere)$|^(?:transkribier|transkribiere|nimm|schreib) (?:die |diese |die ganze )?(?:vorlesung|stunde)\b|^(?:die |diese |die ganze )?vorlesung (?:transkribieren|aufnehmen|mitschreiben)$|^(?:starte?|beginne?) (?:die )?(?:transkription|aufnahme|mitschrift)|^(?:transkription|aufnahme|mitschrift) (?:starten|beginnen)$`.test(t)) return { tipo: 'trascrivi' };
  if (r`^(?:nochmal|noch mal|wiederhol das|wiederhole das|wiederhol den letzten satz|(?:wiederhol|wiederhole) die letzten \d+ sekunden|die letzten \d+ sekunden(?: nochmal| wiederholen)|was hat (?:er|sie|der prof|die prof|die professorin|der professor|der dozent|die dozentin) (?:gerade |eben )?gesagt|(?:das )?hab ich nicht verstanden|hab ich verpasst|sag das nochmal|sag's nochmal|sags nochmal|wie bitte)$`.test(t)) { const sec = +(t.match(/(\d+) sekunden/)?.[1] || 60); return { tipo: 'ripeti', sec: Math.min(90, sec) }; }
  if (r`^(?:(?:schalt|schalte|mach) (?:das )?(?:nochmal|wiederholen|nochmal-funktion) aus|(?:das )?(?:nochmal|wiederholen|nochmal-funktion) (?:ausschalten|abschalten|deaktivieren|aus)|kein nochmal mehr)$`.test(t)) return { tipo: 'spegniRipeti' };
  if ((m = t.match(r`^(?:vorschläge|tipps)\s+(nie|aus|selten|wenig|weniger|normal|oft|häufig|viele|mehr)$|^(?:vorschläge|tipps) (?:ausschalten|abschalten|deaktivieren)$|^(?:keine (?:vorschläge|tipps)(?: mehr)?|(?:schalt|schalte) (?:die )?(?:vorschläge|tipps) aus)$`))) return { tipo: 'proposte', livello: !m[1] || /nie|aus/.test(m[1]) ? 'mai' : /selten|wenig/.test(m[1]) ? 'poco' : r`oft|häufig|viele|mehr`.test(m[1]) ? 'spesso' : 'normale' };
  if (r`^(?:schlag (?:mir )?(?:was|etwas|eine wiederholung|ein spiel) vor|gib mir (?:einen vorschlag|eine idee)|was soll ich (?:jetzt|als nächstes) (?:machen|tun|lernen)|was soll ich wiederholen|was mach ich jetzt|vorschlag)$`.test(t)) return { tipo: 'proponi' };
  // condividi, chiudi, riordina la lezione trascritta: il verbo prima («teil die Mitschrift») o in fondo («Mitschrift teilen»)
  const LEZ = '(?:die |meine |das |den )?(?:mitschrift|vorlesung|transkript|transkription|notizen)';
  if ((m = t.match(r`^(?:teil|teile|schick|schicke|send|sende) ${LEZ}\b(.*)$`)) || (m = t.match(r`^${LEZ}\b(.*?) (?:teilen|schicken|senden|verschicken)$`))) {
    const x = pulisci(m[1].replace(r`^\s*(?:mit|an) (?:meinen |meine |den |die )?(?:kommilitonen|kommilitoninnen|kommiliton:innen|studienkollegen|freunden|leuten|kollegen|gruppe)\s*`, '')); return { tipo: 'condividi', corso: x || null };
  }
  if (r`^(?:beende|stopp?|stoppe|beenden) (?:die )?(?:transkription|aufnahme|mitschrift)|^(?:die )?(?:transkription|aufnahme|mitschrift) (?:beenden|stoppen|aus)$|^(?:die )?vorlesung (?:ist )?(?:vorbei|zu ende|aus|beendet)$|^ende der vorlesung$`.test(t)) return { tipo: 'fineTrascrizione' };
  if (r`^(?:pausier|pausiere|pausieren) (?:die )?(?:transkription|aufnahme|mitschrift)|^(?:die )?(?:transkription|aufnahme|mitschrift) (?:pausieren|anhalten)$|^(?:halt|halte) (?:die )?(?:transkription|aufnahme) an$`.test(t)) return { tipo: 'pausaTrascrizione' };
  if (r`^(?:setz|setze) (?:die )?(?:transkription|aufnahme|mitschrift) fort$|^(?:die )?(?:transkription|aufnahme|mitschrift) (?:fortsetzen|weiter|weitermachen)$|^(?:mach|mache) (?:mit der )?(?:transkription|aufnahme) weiter$|^weiter (?:transkribieren|aufnehmen)$`.test(t)) return { tipo: 'riprendiTrascrizione' };
  if ((m = t.match(r`^(?:räum|räume|ordne|sortier|sortiere) ${LEZ}\b(.*?)(?: auf)?$`)) || (m = t.match(r`^${LEZ}\b(.*?) (?:aufräumen|ordnen|sortieren|säubern)$`))) return { tipo: 'riordina', corso: pulisci(m[1]) || null };
  if ((m = t.match(r`^(?:schließ|schließe) (?:die )?vorlesung\b(.*?)(?: ab)?$`)) || (m = t.match(r`^(?:die )?vorlesung\b(.*?) abschließen$`))) return { tipo: 'chiudiLezione', corso: pulisci(m[1]) || null };
  if (r`^(?:zieh|ziehe) (?:die )?definitionen raus$|^(?:die )?definitionen (?:extrahieren|rausziehen|herausziehen)$|^extrahier(?:e)? (?:die )?definitionen$`.test(t)) return { tipo: 'chiudiLezione', corso: null };
  // la tua AI: «KI», «verbinde ChatGPT», «nimm Gemini», «mein API-Schlüssel»
  { const FORN = { claude: 'anthropic', anthropic: 'anthropic', chatgpt: 'openai', openai: 'openai', gpt: 'openai', gemini: 'google', google: 'google', mistral: 'mistral', groq: 'groq', openrouter: 'openrouter', deepseek: 'deepseek' };
    const AI = '(claude|anthropic|chatgpt|openai|gpt|gemini|google|mistral|groq|openrouter|deepseek)';
    const m = t.match(r`^(?:meine ki|ki|ai|künstliche intelligenz|(?:mein )?(?:api-?)?schlüssel|api-?key|(?:verbinde|nimm|benutze|benutz|nutze|nutz|füg) (?:den schlüssel (?:für |von )?|meine |mein |die )?(?:${AI.slice(1, -1)}|ki|ai|schlüssel|api-?schlüssel|api-?key)(?: hinzu| ein)?|${AI} (?:verbinden|benutzen|nutzen))$`);
    if (m) { const f = t.match(R(`(?:^|\\s)${AI}(?:\\s|$)`)); return { tipo: 'ai', fornitore: f ? FORN[f[1]] : null }; } }
  // la sincronizzazione fra i computer (Rechner, Laptop, Mac, PC)
  const PC = '(?:computer|rechner|pc|mac|laptop)', SYNC = '(?:sync|synchronisierung|synchronisation)';
  if (r`^${SYNC} (?:ausschalten|abschalten|stoppen|beenden|deaktivieren|aus)$|^(?:schalt|schalte|stopp|stoppe|beende) (?:die )?${SYNC}\b|^(?:${SYNC} )?auf diesem ${PC} (?:stoppen|beenden|aufhören|ausschalten)$|^(?:synchronisieren|synchronisation) (?:stoppen|beenden)$`.test(t)) return { tipo: 'sincronizza', cosa: 'smetti' };
  if (r`^(?:passwort|kennwort) (?:ändern|vergessen)$|^(?:neues|anderes) (?:passwort|kennwort)$|^(?:ich )?hab(?:e)? (?:mein |das )?(?:passwort|kennwort) vergessen$|^(?:änder|ändere) (?:mein |das )?(?:passwort|kennwort)$`.test(t)) return { tipo: 'sincronizza', cosa: 'password' };
  if (r`^(?:entsperren|entsperre|entsperr)(?: (?:die )?(?:${SYNC.slice(3, -1)}|meine daten|lode))?$|^(?:die )?(?:${SYNC.slice(3, -1)}|meine daten|lode) entsperren$`.test(t)) return { tipo: 'sincronizza', cosa: 'sblocca' };
  if (r`^(?:einen |noch einen |nen )?(?:anderen|weiteren|zweiten|neuen) ${PC} (?:verbinden|hinzufügen|koppeln)$|^(?:verbinde|füg|koppel|koppele) (?:einen |noch einen |nen )?(?:anderen|weiteren|zweiten|neuen) ${PC}\b`.test(t)) return { tipo: 'sincronizza', cosa: 'altro' };
  if (r`^ich (?:nutze|benutze|nutz|benutz|hab|habe|verwende) lode (?:schon |bereits )?(?:auf|an) (?:einem |nem )?(?:anderen|zweiten) ${PC}$|^verbinde mich mit (?:einem |meinem )?anderen ${PC}$`.test(t)) return { tipo: 'sincronizza', cosa: 'collega' };
  if (r`^(?:sync|synchronisieren|synchronisiere|synchronisierung|synchronisation)\b|^(?:${SYNC.slice(3, -1)}) (?:einschalten|aktivieren|verwalten|öffnen)$|^zwischen (?:computern|rechnern|geräten|laptops) synchronisieren$|^(?:schalt|schalte) (?:die )?${SYNC} (?:ein|an)$`.test(t)) return { tipo: 'sincronizza', cosa: null };
  // preparare Obsidian o il modello locale: «Obsidian einrichten», «installier das Modell», «einrichten»
  const COSA = '(?:das |den |die |ein |eine |mein |meine )?(?:obsidian|modell|ki-modell|lokale ki|lokales modell|ki|gehirn|ollama|gemma|qwen|lode|vault|alles|app)';
  if (r`^(?:einrichten|konfigurieren|installieren|setup|set up)$|^(?:richte|richt) ${COSA} ein$|^(?:konfigurier|konfiguriere|installier|installiere|bereite|bereit) ${COSA}(?: vor)?$|^${COSA} (?:einrichten|installieren|konfigurieren|vorbereiten)$`.test(t)) return { tipo: 'prepara', cosa: /obsidian/.test(t) ? 'obsidian' : /modell|gehirn|ollama|gemma|qwen|\bki\b/.test(t) ? 'cervello' : null };
  // il diario del progetto nel vault: aprirlo, spegnerlo, riaccenderlo
  const DIARIO = '(?:das )?(?:projekttagebuch|projekt-tagebuch|tagebuch|logbuch|projektlog)';
  if ((m = t.match(r`^(?:schalt|schalte|mach|stell|stelle) ${DIARIO}(?: (?:von|für|vom|des) (?:dem )?(?:projekts? )?(.+?))? (aus|ab|an|ein|wieder an|wieder ein)$`)) || (m = t.match(r`^${DIARIO}(?: (?:von|für|vom|des) (?:dem )?(?:projekts? )?(.+?))? (ausschalten|abschalten|einschalten|anschalten|aktivieren|deaktivieren|aus|an|wieder an)$`)))
    return { tipo: 'diarioOpz', diario: /^(?:an|ein|wieder an|wieder ein|einschalten|anschalten|aktivieren)$/.test(m[2]), progetto: m[1] ? pulisci(m[1]) : null };
  if ((m = t.match(r`^(?:schreib|schreibe) (kein|keine|wieder ein|ein)(?: projekt)? ?(?:tagebuch|projekttagebuch|logbuch)(?: (?:für|von|zu) (?:dem )?(?:projekt )?(.+))?$`))) return { tipo: 'diarioOpz', diario: !/^kein/.test(m[1]), progetto: m[2] ? pulisci(m[2]) : null };
  if ((m = t.match(r`^(?:öffne |zeig(?: mir)? )?(?:das )?(?:projekttagebuch|projekt-tagebuch|tagebuch (?:des|vom) projekts?|projektlog)(?: (?:von |für |zu )?(.+?))?(?: öffnen)?$`))) return { tipo: 'diario', progetto: m[1] ? pulisci(m[1]) : null };
  // le pagine del vault: «öffne Glossar», «geh zu Home». Se dopo «zeig mir» c'è un comando, vale il comando
  if ((m = t.match(r`^(?:öffne|öffnen|geh zu|gehe zu|geh auf|bring mich zu|zeig mir|zeig|seite)\s+(.+)$`)) || (m = t.match(r`^(.+?) öffnen$`))) {
    if (!r`^(?:den |die |das )?(?:fokus|timer)|^(?:wie|was|warum|wieso|weshalb|wo|wann|welche[rsmn]?|ob|dass|ein|eine|einen|einem|einer)\b|erklär|berechn|lösen`.test(m[1])) {
      const dentro = interpreta(m[1]); if (dentro && !DENTRO.has(dentro.tipo)) return dentro;
      return { tipo: 'naviga', q: r`^(?:die )?startseite$`.test(m[1]) ? 'home' : pulisci(m[1]) };
    }
  }
  if (r`^(?:alle notizen|seiten|home|startseite|index)$`.test(t)) return { tipo: 'naviga', q: /^(?:home|startseite)$/.test(t) ? 'home' : '' };

  // carta: fronte = retro
  if ((m = grezzo.match(ri`^(?:neue\s+)?(?:karte|karteikarte|lernkarte|kärtchen|flashcard)\s*(?:(?:für|zu|in|von)\s+([^:]+?))?\s*:\s*(.+?)\s*(?:=|->|→|\|)\s*(.+)$`)))
    return { tipo: 'carta', esame: m[1] ? trovaEsame(m[1]) : null, fronte: m[2], retro: m[3] };

  // simulazione: «was wenn ich 28 in Mathe 2 bekomme», «und wenn ich in Physik 2 ne 30 schreibe». Il voto è quello detto
  // (28, «ne 1,7», «2,3», 72 %): se il sistema dei voti lo ha lo decide js/libretto.js
  const LODE = '( mit lode| cum laude| e lode| lode| mit auszeichnung| mit lob)?';
  const VERBI = '(?:bekomme|bekomm|kriege|krieg|schreibe|schreib|hole|hol|habe|hab|mache|mach|erreiche|bekäme|hätte|kriegen würde|bekommen würde|schreiben würde)';
  let s = null;
  if ((m = t.match(r`^(?:und )?(?:was (?:ist|wäre),? )?(?:was )?wenn ich (?:eine |ne |'ne )?${VOTO_CIFRE}${LODE} (?:in|im|bei|für) (.+?) ${VERBI}$`)) || (m = t.match(r`^(?:und )?angenommen,? ich (?:bekomme|krieg|kriege|schreibe|schreib|hab|habe|hole) (?:eine |ne )?${VOTO_CIFRE}${LODE} (?:in|im|bei|für) (.+)$`))) s = { v: numeroVoto(m[1]), lode: m[2], nome: m[3] };
  else if ((m = t.match(r`^(?:und )?(?:was (?:ist|wäre),? )?(?:was )?wenn ich (?:in|im|bei|für) (.+?) (?:eine |ne |'ne )?${VOTO_CIFRE}${LODE} ${VERBI}$`))) s = { v: numeroVoto(m[2]), lode: m[3], nome: m[1] };
  if (s && s.v != null) return { tipo: 'simula', voto: s.v, lode: !!s.lode && s.v === 30, esame: trovaEsame(pulisci(s.nome)), nomeDetto: pulisci(s.nome) };
  // voto: «ich hab 28 in Physik 2», «30 cum laude in Mathe 2», «hab in Physik 2 ne 28 geschrieben»
  s = null;
  const FATTO = '(?:\\s+(?:bekommen|gekriegt|geschrieben|erreicht|geholt|gemacht|erhalten))?';
  if ((m = t.match(r`^(?:(?:ich )?(?:hab|habe|hatte|bekam|kriegte|schrieb|hab ich|habe ich)\s+|eine |ne |'ne |die )(?:eine |ne |'ne |die )?${VOTO_CIFRE}${LODE}\s+(?:in|im|bei|für|auf)\s+(.+?)${FATTO}$`)) || (m = t.match(r`^${VOTO_SOLO}${LODE}\s+(?:in|im|bei|für|auf)\s+(.+?)${FATTO}$`))) s = { v: numeroVoto(m[1]), lode: m[2], nome: m[3] };
  else if ((m = t.match(r`^(?:ich )?(?:hab|habe) (?:in|im|bei) (.+?) (?:(?:eine |ne |'ne )${VOTO_CIFRE}|${VOTO_SOLO})${LODE}${FATTO}$`))) s = { v: numeroVoto(m[2] ?? m[3]), lode: m[4], nome: m[1] };
  // «bestanden mit»: «ich hab Physik 2 mit 27 bestanden», «Physik 2 hab ich mit 27 bestanden», «Physik 2 bestanden mit 26»
  else if ((m = t.match(r`^(?:(?:ich )?(?:hab|habe) )?(?:die |den )?(?:prüfung |klausur )?(?:in |von |aus )?(.+?)(?: (?:hab|habe) ich)? mit (?:einer |eine |ne |'ne |der )?${VOTO_CIFRE}${LODE} (?:bestanden|geschafft|abgeschlossen)$`)) || (m = t.match(r`^(?:die |den )?(?:prüfung |klausur )?(?:in |von |aus )?(.+?) (?:bestanden|geschafft) mit (?:einer |eine |ne |'ne |der )?${VOTO_CIFRE}${LODE}$`))) s = { v: numeroVoto(m[2]), lode: m[3], nome: m[1] };
  // «28 im Schnitt» è la media, non il voto di un esame che si chiama «Schnitt»; «die Prüfung mit 1,3 bestanden» non dice quale
  if (s && s.v != null && !r`^(?:schnitt|durchschnitt|notenschnitt|mittel|(?:die |der |den )?(?:prüfung|klausur|test|klausuren|prüfungen))$`.test(pulisci(s.nome))) return { tipo: 'voto', voto: s.v, lode: !!s.lode && s.v === 30, esame: trovaEsame(pulisci(s.nome)), nomeDetto: pulisci(s.nome) };
  // idoneità (unbenotet, «bestanden»): «ich hab Englisch bestanden», «Englisch geschafft»
  if (((m = t.match(r`^(?:ich )?(?:hab(?:e)? )?(?:die |den )?(?:prüfung |klausur |test |schein )?(?:in |von |für |aus )?(.+?) (?:bestanden|geschafft)$`)) || (m = t.match(r`^bestanden:? (.+)$`))) && !/\d/.test(m[1]) && trovaEsame(pulisci(m[1])))
    return { tipo: 'idoneita', esame: trovaEsame(pulisci(m[1])), nomeDetto: pulisci(m[1]) };

  // focus, anche con i minuti prima: «starte einen 25-Minuten-Pomodoro für Mathe». «lerne ich zu viel?» è una domanda
  if ((m = t.match(r`^(?:(?:starte?|beginne?|mach|lass uns|machen wir) )?(?:eine |einen |ne |nen )?(?:(?:(\d{1,3})[ -]?(?:minuten|min|m)|(\d{1,2}) ?h ?(\d{1,2})?)[ -]?)?(?:fokus|focus|pomodoro|timer|lernsession|lerneinheit|session|lernen|lerne|lern|pauken|büffeln|konzentration|konzentrieren|deep work)\b\s*(.*)$`)) && !FRASE.test(m[4])) {
    // «lerne gerade für Physik 2», «lern jetzt noch Mathe 2»: gli avverbi non sono il nome dell'esame
    let resto = m[4].replace(r`^(?:(?:gerade|jetzt|noch|kurz|etwas|ein bisschen|ne runde|eine runde)\s+)+`, ''); const mi = m[1] ? { min: +m[1] } : m[2] ? { min: +m[2] * 60 + (+m[3] || 0) } : leggiMinuti(resto); if (mi?.pezzo) resto = resto.replace(mi.pezzo, ' ');
    resto = pulisci(resto.replace(/\s+/g, ' ').trim()); const e = resto ? trovaEsame(resto, { anche: 'daFare' }) || trovaEsame(resto) : null;
    return { tipo: 'focus', min: mi ? Math.min(240, Math.max(1, mi.min)) : null, esame: e, nomeDetto: resto };
  }
  // il verbo in fondo, come si dice davvero: «50 Minuten Mathe 2 lernen», «eine Stunde Datenbanken pauken»
  if ((m = t.match(r`^(?:ich will |ich muss |lass uns )?(.+?) (?:lernen|pauken|büffeln)$`))) {
    let resto = m[1]; const mi = leggiMinuti(resto); if (mi?.pezzo) resto = resto.replace(mi.pezzo, ' ');
    resto = pulisci(resto.replace(/\s+/g, ' ').trim()); const e = resto ? trovaEsame(resto, { anche: 'daFare' }) || trovaEsame(resto) : null;
    if (mi || e) return { tipo: 'focus', min: mi ? Math.min(240, Math.max(1, mi.min)) : null, esame: e, nomeDetto: resto };
  }

  // «die Prüfung in Mathe 2 ist am 15. Januar», «ich schreibe Mathe 2 am 13. Oktober», «Mathe 2 wurde auf den 20. Januar verschoben»
  const QUANDO = '(am .+|in \\d.+|morgen|übermorgen|nächste.+|diese.+|kommende.+|(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag).*|\\d{1,2}[./].*)';
  const PR = '(?:prüfung|klausur|test|mündliche(?: prüfung)?|schriftliche(?: prüfung)?|abschlussprüfung)';
  // la data in testa, col verbo al secondo posto: «am Freitag schreibe ich Physik 2», «morgen ist die Mathe 2 Klausur»,
  // «übermorgen Prüfung Mathe 2». Serve «Prüfung», «Klausur» o «schreiben»: «morgen hab ich Physik 2» può essere la lezione
  if ((m = t.match(r`^((?:(?:am|diesen|nächsten|kommenden) )?(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|übermorgen|morgen|(?:am |den )?\d{1,2}\.\s?(?:\d{1,2}\.?(?:\d{2,4})?|\S+)),? (?:(?:schreibe|schreib|hab|habe|ist|mache|mach) (?:ich )?|(?=${PR}))(?:die |eine |meine |ne |den )?(?:${PR} )?(?:in |von |für |zu |über |aus )?(.+?)(?:[ -]${PR})?$`)) && r`prüfung|klausur|mündlich|schreib`.test(t)) {
    const d = leggiData(m[1]), nome = pulisci(m[2]), e = trovaEsame(nome);
    // un esame che non c'è ancora solo se il nome è proprio il nome: «übermorgen Prüfung Statistik», «Klausur in Statistik»,
    // «schreib ich Statistik», «Statistik Klausur»; «morgen ist die Prüfung schwer» resta all'AI
    const nuovo = nome.length >= 3 && (r`schreib`.test(t) || R(`(?:^\\S+ |^\\S+ \\S+ )${PR} \\S|${PR} (?:in|von|für|zu|über|aus) |[ -]${PR}$`).test(t));
    if (d && nome && !FRASE.test(nome) && !R(`^${PR}\\b`).test(nome) && (e || nuovo)) return { tipo: 'esame', nome: e?.nome || nome, cfu: null, data: d.data, esistente: e && !e.fatto ? e : null };
  }
  if ((m = t.match(r`^(?:die )?${PR} (?:in |von |für |zu |über )?(.+?) (?:ist|wäre|findet) (?:am |in |auf |ab )?(.+?)(?: statt)?$`)) || (m = t.match(r`^(?:die )?(.+?)[ -]${PR} (?:ist|findet) (?:am |in |auf )?(.+?)(?: statt)?$`)) || (m = t.match(r`^ich (?:schreibe|schreib|habe|hab|mache|mach) (?:(?:die |eine |meine )?${PR} (?:in |von |für |zu |über )?)?(.+?) ${QUANDO}$`)) || (m = t.match(r`^(?:die )?(?:${PR} )?(?:in |von |für )?(.+?) (?:wurde |ist |wird )?(?:verschoben|vorverlegt|verlegt) (?:auf|zum|nach) (?:den )?(.+)$`)) || (m = t.match(r`^(?:die )?(?:${PR} )?(?:in |von |für )?(.+?) (?:wurde |ist |wird )?auf (?:den )?(.+?) (?:verschoben|vorverlegt|verlegt)(?: worden)?$`))) {
    const d = leggiData(m[2]), e = trovaEsame(pulisci(m[1]));
    if (d && (e || (r`prüfung|klausur|test|mündlich|schriftlich`.test(t) && pulisci(m[1]).length >= 3))) return { tipo: 'esame', nome: e?.nome || pulisci(m[1]), cfu: null, data: d.data, esistente: e && !e.fatto ? e : null };
  }
  // nuovo esame: «Prüfung Datenbanken am 15. Januar 9 ECTS», «neue Klausur Physik 2 mit 6 LP», «Prüfung hinzufügen: …»
  if ((m = t.match(r`^(?:füg |trag |neue |neuer |markier )?(?:eine |die |ein |einen )?(?:prüfung|klausur|test|prüfungstermin|klausurtermin)(?: hinzufügen| eintragen)?\s*:?\s+(?:in |von |für |zu |über )?(.+?)(?:\s+(?:hinzu|ein|eintragen|hinzufügen))?$`)) && !r`^(?:simulier|simulation|üben|schreiben|vorbereit|lernen|fragen|aufgaben|termin|plan|stoff|themen|bestanden|geschafft|verschoben)|^(?:ist|war|wann|welche|nächste|morgen|heute|mich|mir|ab|der|des|wurde|wird|findet|fällt|lief|ging|hat)\b`.test(m[1])) {
    let resto = ' ' + m[1].replace(/[,;]/g, ' ') + ' ';
    const c = resto.match(CREDITI); let cfu = null; if (c) { cfu = +c[1]; resto = resto.replace(c[0], ' '); }
    const d = leggiData(resto); if (d) resto = togli(resto, d.pezzo);
    const nome = pulisci(resto.replace(/\s+/g, ' ').trim());
    // «Test» da solo è una parola di tutte le lingue: vale come esame solo con una data o i crediti
    if (nome && (r`prüfung|klausur`.test(t) || d || cfu)) return { tipo: 'esame', nome, cfu, data: d?.data || null, esistente: trovaEsame(nome) };
  }

  // «was brauche ich für 110», «welchen Schnitt brauch ich für 105», «was brauche ich für 2,0», «was brauche ich für die
  // Bestnote» (1,0). L'obiettivo è il numero detto: se è nella scala del voto finale lo decide js/libretto.js
  if ((m = t.match(r`(?:was|wie ?viel|welchen schnitt|welchen durchschnitt|welche noten?)\s(?:brauch|brauche|muss|müsste|bräuchte)\b(.*)$`))) {
    const b = obiettivoDetto(m[1]);
    if (b != null) return { tipo: 'serve', base: b };
    if (r`\b(?:die |eine )?(?:bestnote|eins vor dem komma|glatte eins|1er schnitt|einser(?:schnitt)?|summa cum laude|mit auszeichnung)$`.test(m[1])) return { tipo: 'serve', base: 1 };
  }
  if (r`\b(?:schnitt|durchschnitt|notenschnitt|noten|notenspiegel|notenübersicht|leistungsübersicht|transcript|ects|credits|leistungspunkte|lp|abschlussnote|endnote|wie steh(?:e)? ich)\b`.test(t) && !r`\b(?:erklär|erkläre|bedeutet|bedeutung|berechne|berechnet|berechnen|rechnet|heißt)\b`.test(t) && (!r`\b(?:was ist|was sind|wie)\b`.test(t) || r`\b(?:mein|meine|meinen|ich)\b`.test(t))) return { tipo: 'libretto' };

  // ripasso: «Mathe 2 wiederholen», «Karten», «lass uns Physik 2 wiederholen»
  if ((m = t.match(r`^(?:lass uns |ich will |ich möchte |starte? )?(?:wiederholen|wiederhol|wiederhole|wiederholung|karten|karteikarten|lernkarten|meine karten|die karten|kärtchen|flashcards)\b\s*(.*)$`)) && !FRASE.test(m[1])) {
    const x = pulisci(m[1] || ''); return { tipo: 'ripasso', esame: x ? trovaEsame(x) : null, nomeDetto: x };
  }
  if ((m = t.match(r`^(?:lass uns |ich will |ich möchte |ich muss )?(.+?) wiederholen$`)) && trovaEsame(pulisci(m[1]))) return { tipo: 'ripasso', esame: trovaEsame(pulisci(m[1])), nomeDetto: pulisci(m[1]) };

  // il ponte con gli agenti di programmazione: «Agenten», «verbinde Claude Code», «Cursor trennen», «was hat der Agent gemacht»
  const AG = '(claude(?: code)?|codex|gemini(?: cli)?|cursor|copilot(?: cli)?|cline|windsurf|opencode|open code|aider|kiro|qwen(?: code)?|amp|roo(?: code)?|kilo(?: code)?|continue|zed|junie)';
  if ((m = t.match(r`^(verbinde|verbinden|trenne|trennen|entferne|entfernen) (?:die agenten|${AG})$`)) || ((m = t.match(r`^(?:die agenten|${AG}) (verbinden|trennen|entfernen|abkoppeln)$`)) && (m = [m[0], m[2], m[1]])))
    return { tipo: 'agenti', agente: m[2] ? m[2].replace(/ (?:code|cli)$/, '').replace(' ', '') : null, togli: !/^verbind/.test(m[1]) };
  if (r`^(?:meine |die )?(?:coding-?|ki-|programmier-?)?agenten$|^(?:die )?brücke(?: zu den agenten)?$`.test(t)) return { tipo: 'agenti', agente: null };
  if (r`^was (?:hat|haben) (?:der agent|die agenten|claude(?: code)?|codex|cursor|gemini|die ki) (?:gemacht|getan)\b|^(?:der |die )?letzter? (?:zug|turn|runde)(?: des agenten)?$`.test(t)) return { tipo: 'turnoAgente' };
  // Moodle in sola lettura: «Moodle verbinden», «was gibt's Neues auf Moodle», «Abgaben», «Moodle trennen»
  if (r`^(?:moodle (?:trennen|abmelden|entfernen)|(?:trenne|entferne) moodle|von moodle abmelden)$`.test(t)) return { tipo: 'moodle', cosa: 'scollega' };
  if (r`^(?:was gibt(?:'s|s| es) neues|was ist neu|neue dateien|neuigkeiten|updates)(?: (?:auf|in|bei|im)) moodle$|^moodle-? ?(?:neuigkeiten|updates|news)$`.test(t)) return { tipo: 'moodle', cosa: 'novita' };
  if (r`^(?:meine )?(?:abgaben|deadlines|fristen|abgabetermine)(?: (?:auf|in|bei) moodle)?$|^was ist (?:bald )?fällig(?: (?:auf|in) moodle)?$|^was muss ich abgeben$`.test(t)) return { tipo: 'moodle', cosa: 'scadenze' };
  if (r`^(?:meine )?kurse (?:auf|in|bei) moodle$|^moodle-? ?kurse$`.test(t)) return { tipo: 'moodle', cosa: 'corsi' };
  if (r`^(?:(?:verbinde|öffne|richte) )?(?:moodle|e-?learning|lernplattform)(?: verbinden| einrichten| ein| öffnen)?$`.test(t)) return { tipo: 'moodle', cosa: null };
  // interrogazione: «frag mich ab», «frag mich zu Datenbanken ab», «mündliche Prüfung für Physik 2 simulieren»
  if ((m = t.match(r`^(?:frag|frage) mich(?: (?:zu|in|über|aus|bei|zum|zur) (.+?))? ab$`)) || (m = t.match(r`^(?:simulier(?:e)? (?:die |eine )?mündliche(?: prüfung)?|mündliche prüfung(?: simulieren)?|mündliche|probe-?mündliche|prüf mich|prüfe mich)\b\s*(.*?)(?:\s+(?:simulieren|üben))?$`))) {
    const x = pulisci(m[1] || ''); return { tipo: 'orale', esame: x ? trovaEsame(x) : null, nomeDetto: x };
  }
  // il quiz a crocette: «Quiz zu Mathe 2», «Multiple Choice», «Prüfungssimulation für Privatrecht», il «Kreuzerltest» austriaco
  if ((m = t.match(r`^(?:gib mir |starte? |mach |machen wir |lass uns )?(?:ein |eine |einen |das |den |die )?(quiz|multiple-? ?choice(?:-?(?:quiz|test|fragen))?|mc-?(?:test|fragen|quiz)|ankreuzfragen|kreuzerltest|prüfungssimulation|klausursimulation|klausur simulieren|prüfung simulieren|übungstest)\b\s*(.*?)$`))) {
    const x = pulisci((m[2] || '').replace(r`(?:^|\s+)(?:machen|starten|simulieren)$`, '')); return { tipo: 'crocette', esame: x ? trovaEsame(x) : null, nomeDetto: x, simulazione: /simul/.test(m[1]) };
  }

  if (r`^(?:meine |die |nächste |nächsten |kommende |kommenden |anstehende |anstehenden )?(?:prüfungen|klausuren|prüfungstermine|klausurtermine|prüfungskalender|prüfungsphase|klausurenphase|kalender)(?: (?:zeigen|anzeigen))?$|^wann sind (?:meine |die )?(?:prüfungen|klausuren)$`.test(t)) return { tipo: 'esami' };
  if (r`^(?:heute|plan|tagesplan|plan für heute|heutiger plan|mein plan|was soll ich heute (?:lernen|machen)|was lern(?:e)? ich heute|was steht heute an|was mach ich heute)$`.test(t)) return { tipo: 'oggi' };

  // ricerca diretta: il nome di un esame da solo apre la sua scheda
  const e = trovaEsame(t);
  if (e && norm(e.nome).startsWith(norm(t)) && norm(t).length >= 3) return { tipo: 'apriEsame', esame: e };
  return null;
}
// una frase tedesca non è un comando inglese: comandi.js allora non la passa all'inglese, che altrimenti prenderebbe
// «Training ist anstrengend» (gioco), «Timer ist kaputt» (focus), «Plan mir die Woche» (oggi) o «was ist der Unterschied
// zwischen ECTS und LP» (libretto): «training», «timer», «plan», «ECTS» sono parole anche inglesi. Bastano le parole che in
// un comando inglese non ci sono mai
const TEDESCO = R(String.raw`\b(?:ist|sind|waren|ich|du|wir|mir|mich|dir|dich|uns|nicht|und|der|das|dem|zwischen|wie|warum|wieso|welche[rsmn]?)\b`);
export const nonInglese = frase => TEDESCO.test(String(frase || '').toLowerCase());

// i crediti di un esame: ECTS, LP (Leistungspunkte), CP, KP (Kreditpunkte, in Svizzera e in Austria)
const CREDITI = R(String.raw`(?:mit |à |zu |für )?(\d{1,2})\s*(?:ects|lp|cp|kp|credits?|leistungspunkte|kreditpunkte|credit points|cfu)\b`);

// giorni e ore di una frase («Montag und Mittwoch 9-11 Raum 7», «mo mi 14-19 Uhr», «freitags von 14 bis 16»): resto è quello
// che avanza, in minuscolo con le dieresi. «c.t.» e «s.t.» (il quarto d'ora accademico) non cambiano l'orario scritto
const GIORNO_BREVE = R(String.raw`\b(mo(?:ntags?)?|di(?:enstags?)?|mi(?:ttwochs?)?|do(?:nnerstags?)?|fr(?:eitags?)?|sa(?:mstags?)?|sonnabends?|so(?:nntags?)?)\b`, 'g');
const SIGLE = { mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 0 };
export function giorniEOre(testo) {
  const basso = String(testo).toLowerCase().replace(/\b[cs]\.\s?t\.?(?=\s|$)/g, ' ').replace(/(\d)\s*uhr\b/g, '$1').replace(/\b(?:von|ab) (?=\d)/g, '');
  const o = oreInCifre(basso, 'bis');
  if (!o) return null;
  // in minuscolo, senza punteggiatura ma con le dieresi (i nomi dei corsi restano come li ha scritti lo studente); il punto
  // fra due cifre resta: l'aula «0.07»
  let x = ' ' + basso.replace(o.pezzo, ' ').normalize('NFC').replace(/[^\p{L}\p{N}. ]/gu, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const giorni = [];
  x = x.replace(/ (?:am|jeden|immer) /g, ' ').replace(GIORNO_BREVE, g => { giorni.push(/^sonnabend/.test(g) ? 6 : SIGLE[g.slice(0, 2)]); return ' '; });
  return { giorni, inizio: o.inizio, fine: o.fine, resto: x.replace(/\s+/g, ' ').replace(/^ ?/, ' ').replace(/ ?$/, ' ') };
}
// giorni, ore e aula di una lezione; quello che resta è il nome del corso
export function leggiOrario(testo) {
  const x = giorniEOre(testo);
  if (!x || !x.giorni.length) return null;
  let rr = x.resto, aula = ''; rr = rr.replace(r` (?:im |in )?(?:raum|hörsaal|hs|saal|seminarraum|zimmer) (\S+)`, (_, a) => { aula = a.length <= 3 ? a.toUpperCase() : a.charAt(0).toUpperCase() + a.slice(1); return ' '; });
  const corso = rr.replace(rg`\b(?:und|am|an|von|bis|um|im|in|jeden|der|die|das|den|zu|für|ab|immer)\b`, ' ').replace(/\s+/g, ' ').trim();
  if (!corso) return null;
  const e = trovaEsame(corso);
  return { corso: e?.nome || corso.replace(/^./, c => c.toUpperCase()), giorni: [...new Set(x.giorni)].sort(), inizio: x.inizio, fine: x.fine, aula };
}

// il lavoro (js/ore.js): «ich arbeite Montag Mittwoch Freitag 14-19», «meine Schichten sind …», «Donnerstag arbeite ich
// nicht», «am Samstag arbeite ich zusätzlich 18-23», «an Arbeitstagen lerne ich höchstens 2 Stunden», «ich lerne von 10 bis
// 22», «ich arbeite nicht mehr». «jobben» è il lavoretto da studente
const GIORNO = '(heute|morgen|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag)';
function dataDetta(s) {
  const T = oggi(), p = piega(s), k = ['heute', 'morgen', 'ubermorgen'].indexOf(p); if (k >= 0) return piuGiorni(T, k);
  const dow = p === 'sonnabend' ? 6 : GIORNI.indexOf(p); if (dow < 0) return null;
  return piuGiorni(T, (dow - new Date(T + 'T12:00').getDay() + 7) % 7);
}
const ORA = /(?:von\s+)?\d{1,2}(?:[:.]\d{2})?\s*(?:uhr)?\s*(?:-|–|bis)\s*\d{1,2}(?:[:.]\d{2})?(?:\s*uhr)?/g;
const ARBEITE = '(?:arbeite|arbeit|jobbe|jobb)';
export function leggiLavoro(testo) {
  const t = String(testo || '').toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim();
  let m;
  if (r`^(?:ich ${ARBEITE} nicht mehr|ich (?:hab|habe) (?:gekündigt|keinen job mehr)|kein job mehr|keine arbeit mehr|keine schichten mehr|(?:job|arbeit|schichten|meine schichten) (?:löschen|entfernen)|(?:lösch|lösche|entfern|entferne) (?:meinen |den )?(?:job|arbeit|meine schichten|schichten))$`.test(t)) return { tipo: 'lavoro', azione: 'togli' };
  if (r`^(?:wann ${ARBEITE} ich|wann muss ich arbeiten|(?:meine )?schichten|mein job|meine arbeit|(?:meine )?arbeitszeiten|(?:mein )?schichtplan)$`.test(t)) return { tipo: 'lavoro', azione: 'vedi' };
  const NON = `(?:${ARBEITE} ich nicht|hab(?:e)? ich frei|muss ich nicht arbeiten)`;
  if ((m = t.match(R(`^(?:am |diesen |diesem )?${GIORNO},? ${NON}$`))) || (m = t.match(R(`^ich ${ARBEITE} (?:am |diesen )?${GIORNO} nicht$`))) || (m = t.match(R(`^ich (?:hab|habe) (?:am |diesen )?${GIORNO} frei$`)))) return { tipo: 'lavoro', azione: 'eccezione', data: dataDetta(m[1]), no: true };
  if ((m = t.match(r`^(?:an arbeitstagen|an tagen,? an denen ich arbeite|wenn ich arbeite),? (?:lerne ich|lern ich|kann ich|will ich)(?: lernen)? (?:höchstens|maximal|max|nur|bis zu|nicht mehr als) (.+?)(?: lernen)?$`))) {
    const mi = leggiMinuti(m[1]); if (mi && /h|std|stunde|min/.test(mi.pezzo) && mi.min >= 15 && mi.min <= 600) return { tipo: 'lavoro', azione: 'tetto', min: mi.min };
  }
  if ((m = t.match(r`^(?:normalerweise |meistens )?(?:ich lerne|ich lern) (?:von |zwischen )?(.+?)(?: uhr)?$`))) {
    const x = oreInCifre(m[1].replace(/(\d)\s*uhr\b/g, '$1'), 'bis|und'), o = x && x.pezzo.trim() === m[1].replace(/(\d)\s*uhr\b/g, '$1').trim() && orarioOk(x.inizio, x.fine);
    if (o && o.fine !== '24:00') return { tipo: 'lavoro', azione: 'finestra', da: o.inizio, a: o.fine };
  }
  // un turno in più solo quel giorno: «am Samstag arbeite ich zusätzlich 18-23», «diese Woche arbeite ich auch Samstag 18-23»
  if ((m = t.match(R(`^(?:diese woche,? )?(?:(.+?),? )?(?:${ARBEITE} ich|ich ${ARBEITE}) (?:auch|zusätzlich|extra|noch)(?: am)? (.+)$`))) || ((m = t.match(R(`^(?:eine )?(?:extra|zusätzliche)[ -]?schicht(?: am)? (.+)$`))) && (m = [m[0], '', m[1]]))) {
    const g = `${m[1] || ''} ${m[2]}`.match(R(`(?:^| )${GIORNO}(?= |$)`)), x = g && giorniEOre(m[2].replace(g[1], ' '));
    const o = x && orarioOk(x.inizio, x.fine);
    if (o) return { tipo: 'lavoro', azione: 'eccezione', data: dataDetta(g[1]), ...o };
  }
  // i turni di ogni settimana: «ich arbeite …» li aggiunge, «meine Schichten sind …» li sostituisce. Quello che avanza (im Café)
  // va bene se è poco: «ich arbeite montags 9-13 an meiner Bachelorarbeit» non è un turno
  if ((m = t.match(R(`^(?:(meine schichten sind|meine schicht ist|ab jetzt ${ARBEITE} ich|jetzt ${ARBEITE} ich|ich ${ARBEITE} nur|ich ${ARBEITE} jetzt)|ich ${ARBEITE}|ich (?:hab|habe) (?:eine )?schichte?n?|schichte?n?)\\s+(.+)$`)))) {
    const pezzi = [];
    let da = 0; for (const o of m[2].matchAll(ORA)) { pezzi.push(m[2].slice(da, o.index + o[0].length)); da = o.index + o[0].length; }
    if (pezzi.length) pezzi[pezzi.length - 1] += m[2].slice(da);
    const xs = pezzi.map(giorniEOre), turni = xs.map(x => x && x.giorni.length && orarioOk(x.inizio, x.fine));
    const resto = xs.flatMap(x => x ? x.resto.replace(rg`\b(?:und|am|an|von|bis|um|im|in|jeden|der|die|das|den|als|beim|uhr|immer)\b`, ' ').trim().split(/\s+/).filter(Boolean) : []);
    if (turni.length && turni.every(Boolean) && resto.length <= 2 && !xs.some(x => r`gruppe|team|projekt|abschlussarbeit|bachelorarbeit|masterarbeit|thesis|übung|hausaufgabe|labor|praktikum|bericht|hausarbeit`.test(x.resto))) {
      const tt = turni.map((o, i) => ({ giorni: [...new Set(xs[i].giorni)].sort(), ...o }));
      return { tipo: 'lavoro', azione: m[1] ? 'sostituisci' : 'aggiungi', ...tt[0], ...(tt.length > 1 ? { turni: tt } : {}) };
    }
  }
  return null;
}

// gli stessi esempi dell'italiano, nello stesso ordine
// i voti degli esempi detti in tedesco: «ich hab ne 1,7 in Physik 2», come si dice
export const VOTI_ESEMPIO = { de: { voto: 'ne 1,7' } };
// gli esempi della barra («Prova a scrivere»): {voto}, {obiettivo} e {simula} sono i voti del sistema scelto
// (riempiEsempi() di js/comandi/comune.js, esempi() di js/comandi.js)
export const ESEMPI = [
  ['Fokus 50 auf Mathe 2', 'startet den Timer und zählt die Stunden'],
  ['ich hab {voto} in Physik 2', 'trägt die Note ein und rechnet deinen Schnitt neu'],
  ['Prüfung Datenbanken am 15. Januar 9 ECTS', 'trägt den Prüfungstermin ein'],
  ['was brauche ich für {obiettivo}', 'der Schnitt, den du ab jetzt bis zum Ende brauchst'],
  ['was wenn ich {simula} in Mathe 2 bekomme', 'simuliert deinen Schnitt'],
  ['Prüfungsstoff für Mathe 2', 'füg den Prüfungsstoff ein: eine Karte der Themen und ein Plan bis zur Prüfung'],
  ['Prüfungsfragen für Mathe 2: …', 'die aus deiner Semestergruppe: sie rücken im Plan nach oben'],
  ['Altklausuren für Mathe 2: …', 'die Aufgaben einer alten Klausur: eine pro Tag, zu den Themen von heute'],
  ['Probeklausur für Mathe 2', 'eine ganze Altklausur mit der echten Zeit: danach sagst du, wie es lief'],
  ['lass mich erklären: Satz von Green', 'du erklärst ein Thema, Lode sagt dir, was gefehlt hat'],
  ['Quiz zu Mathe 2', 'Multiple-Choice-Fragen: zum Üben oder als Prüfungssimulation mit Zeit'],
  ['Videovorlesung Privatrecht transkribieren', 'aus dem Ton des Computers: zum Lernen von zu Hause'],
  ['Moodle verbinden', 'neue Dateien und Abgaben von der Lernplattform deiner Uni'],
  ['Agenten', 'verbinde Claude Code, Codex, Cursor…: Lode sagt dir, was sie in deinen Projekten wirklich gemacht haben'],
  ['Mathe 2 wiederholen', 'die Karten von heute'],
  ['Karte: Satz von Green = …', 'eine schnelle Karte'],
  ['nach Anki exportieren', 'Karten und Definitionen in einer Datei für Anki, ein Deck pro Kurs'],
  ['Karten fürs Handy', 'die Karten von morgen in einer Notiz, für unterwegs auf dem Handy mit Obsidian'],
  ['Vorlesung Mathe 2 Montag und Mittwoch 9-11 Raum 7', 'dein Stundenplan: Lode weiß, wann du in der Vorlesung sitzt'],
  ['ich arbeite Montag Mittwoch Freitag 14-19', 'deine Schichten: der Plan nimmt nur deine echte freie Zeit, mit einer halben Stunde für den Weg'],
  ['Wochenplan', 'alle deine Prüfungen in einem Kalender, auf die Minute: was reinpasst und was nicht'],
  ['★ der Satz von Green kommt immer dran', 'in der Vorlesung: markier, was in der Prüfung kommt'],
  ['def: Gradient = Vektor der partiellen Ableitungen', 'in der Vorlesung: eine Definition in der Notiz'],
  ['spielen', 'zwei Minuten mit den Definitionen der letzten Vorlesung'],
  ['Vorlesung transkribieren', 'in der Vorlesung: die ganze Vorlesung als Notizen, mit Formeln, gespeichert in Obsidian'],
  ['Vorlesung aufräumen', 'aus der Transkription werden saubere Notizen (KI)'],
  ['nochmal', 'in der Vorlesung: was der Prof in den letzten 60 Sekunden gesagt hat'],
  ['KI', 'verbinde deine Lieblings-KI (Claude, ChatGPT, Gemini, Mistral…), du zahlst nur, was du nutzt'],
  ['Mitschrift teilen', 'die Vorlesung für deine Kommilitonen: AirDrop, WhatsApp, E-Mail'],
  ['Vorlesung abschließen', 'Definitionen und ★ aus den Notizen ziehen (KI)'],
  ['öffne Glossar', 'spring zu einer Seite im Vault'],
  ['frag mich zu Datenbanken ab', 'simuliert die mündliche Prüfung (mit KI)'],
  ['was gibt das aus', 'C-Aufgaben: die Lösung rechnet Lode aus, keine KI'],
  ['was gibt das in Python aus', 'dieselben Aufgaben in Python (oder in Java: «was gibt das in Java aus»)'],
  ['Projekt verfolgen', 'beobachtet deinen Praktikumsordner: was sich ändert und ob du es getestet hast'],
  ['Projekt testen', 'kompiliert und startet die .in/.out-Tests, nachdem du bestätigt hast'],
  ['erklär den Fehler', 'kopier den Fehler aus dem Terminal: ich erkläre ihn dir auf Deutsch, Schritt für Schritt'],
  ['Projekttagebuch', 'öffnet das heutige Tagebuch in Obsidian'],
  ['nicht mehr verfolgen', 'Lode beobachtet den Ordner nicht mehr und löscht seine Kopien'],
  ['zwischen Computern synchronisieren', 'dasselbe Lode auf zwei oder drei Computern, mit dem Cloud-Ordner, den du schon hast'],
];

// die kleinen Wörter in den Karten (js/comandi/comune.js, detto()): bestätigen, abbrechen, die mündliche Prüfung beenden
export const PAROLE = {
  si: ['ja', 'jo', 'jep', 'ok', 'okay', 'klar', 'passt', 'genau', 'richtig', 'perfekt', 'bestätige', 'bestaetige', 'los', 'mach', 'mach das', 'mach es', 'weiter', 'einverstanden', 'speichern', 'speicher', 'speichere', 'gern', 'gerne'],
  siCoda: ['bitte'],
  no: ['nein', 'nö', 'abbrechen', 'abbruch', 'stopp', 'stop', 'warte', 'lass es', 'lieber nicht', 'nichts', 'vergiss es'],
  voto: ['genug', 'note', 'meine note', 'gib mir die note', 'ich bin fertig', 'fertig', 'schluss'],
  basta: ['beenden', 'raus', 'abbrechen', 'stopp', 'genug', 'vergiss es'],
  esci: ['beenden', 'raus', 'schließen', 'schliessen', 'prüfung beenden', 'pruefung beenden', 'mündliche beenden', 'muendliche beenden'],
};
