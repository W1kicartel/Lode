// I nomi del vault: cartelle, note, titoli delle sezioni e parole che Lode scrive nel vault e poi rilegge. Un'unica tabella,
// presa dal catalogo «vaultnomi» (js/lingue/<codice>/vaultnomi.js) della lingua in cui il vault è NATO, non da quella della
// barra: si decidono una volta sola, quando il vault si crea (desktop/vault.mjs, crea), e si salvano in .lode/vault.json
// ({ lingua, nomi }). Un vault che esiste già senza vault.json tiene i nomi italiani: Lode non rinomina mai niente.
// I marcatori che nessuno legge (%% lode:pagina %%, <!-- lode-carta -->, le chiavi del frontmatter) sono codici: qui non ci sono.
// La tabella attiva vive in globalThis (Symbol.for), perché questo modulo si può caricare da due percorsi: js/ e la copia in
// desktop/web/js che usa il processo principale (desktop/web.mjs), per esempio nelle prove in node. Due copie, una tabella sola.
import it from './lingue/it/vaultnomi.js';
import en from './lingue/en/vaultnomi.js';
import es from './lingue/es/vaultnomi.js';
import fr from './lingue/fr/vaultnomi.js';
import de from './lingue/de/vaultnomi.js';
import pt from './lingue/pt/vaultnomi.js';

const CAT = { it, en, es, fr, de, pt };
export const LINGUE_NOMI = Object.keys(CAT);
const LOCALE = { it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR' };

// la tabella di una lingua (quelle che Lode non conosce: l'italiano)
export function nomiDi(cod) {
  const lingua = CAT[cod] ? cod : 'it', c = CAT[lingua], v = k => c['vaultnomi.' + k] ?? it['vaultnomi.' + k];
  return {
    lingua, locale: LOCALE[lingua],
    cartelle: { lezioni: v('cartella-lezioni'), corsi: v('cartella-corsi'), sbobine: v('cartella-sbobine'), anki: v('cartella-anki'), allegati: v('cartella-allegati'), materiali: v('cartella-materiali'), progetti: v('cartella-progetti'), modelli: v('cartella-modelli'), inbox: v('cartella-inbox'), lode: 'Lode' },
    corsi: { sparsi: v('corso-sparsi'), videolezioni: v('corso-videolezioni'), varie: v('corso-varie') },
    note: { home: v('nota-home'), orario: v('nota-orario'), esami: v('nota-esami'), glossario: v('nota-glossario'), benvenuto: v('nota-benvenuto'), memoria: v('nota-memoria'), tasca: v('nota-tasca') },
    modelli: { lezione: v('modello-lezione'), esame: v('modello-esame'), ripasso: v('modello-ripasso') },
    sezioni: { appunti: v('sezione-appunti'), stella: v('sezione-stella'), definizione: v('sezione-definizioni'), domanda: v('sezione-domande'), trascrizione: v('sezione-trascrizione'), riordinati: v('sezione-riordinati') },
    titoli: { notePerLode: v('titolo-note-per-lode'), cosaHoCapito: v('titolo-cosa-ho-capito'), cosaSoDavvero: v('titolo-cosa-so-davvero'), informatica: v('titolo-informatica'), ripassoInTasca: v('titolo-ripasso-in-tasca'), orario: v('titolo-orario'), lezioni: v('titolo-lezioni'), stelleUltime: v('titolo-stelle-ultime') },
    parole: { risposta: v('parola-risposta'), sapevo: v('parola-sapevo'), nonSapevo: v('parola-non-sapevo') },
    orario: { colonne: [...v('orario-colonne')], giorni: [...v('giorni-brevi')], spiega: v('orario-spiega') },
    commenti: { definizioni: v('commento-definizioni'), corso: v('commento-corso'), cosaHoCapito: v('commento-cosa-ho-capito') },
    segnalibri: { memoria: v('segnalibro-memoria') },
    file: { sbobina: v('file-sbobina'), sbobinaDi: v('file-sbobina-di'), originale: v('materiale-originale') },
    // i testi delle note che nascono col vault (desktop/vault.mjs): non si rileggono, ma restano nella lingua del vault
    testi: { esameProgramma: v('esame-programma'), esameDomande: v('esame-domande'), esameDomandeCommento: v('esame-domande-commento'), esameEsercizi: v('esame-esercizi'), esameManca: v('esame-manca'),
      ripassoTreRighe: v('ripasso-tre-righe'), ripassoCommentoDefinizioni: v('ripasso-commento-definizioni'), ripassoCollegamenti: v('ripasso-collegamenti'), ripassoCommentoCollegamenti: v('ripasso-commento-collegamenti'),
      memoriaTitolo: v('memoria-titolo'), memoriaCommento: v('memoria-commento'), memoriaInBreve: v('memoria-in-breve'), memoriaAncoraNiente: v('memoria-ancora-niente'), memoriaNoteCommento: v('memoria-note-commento'),
      benvenutoFirma: v('benvenuto-firma'), benvenuto: v('benvenuto-testo'), corso: v('parola-corso') },
  };
}

// la tabella salvata in vault.json sopra quella della sua lingua: le voci aggiunte dopo (una versione nuova di Lode) prendono
// il valore della lingua del vault, quelle salvate restano come sono. Un valore storto (non stringa, vuoto, con «/») si ignora
const buono = x => typeof x === 'string' && x.trim() && !/[\\/\0]/.test(x);
export function completa(salvati) {
  const base = nomiDi(salvati?.lingua), s = salvati?.nomi;
  if (!s || typeof s !== 'object') return base;
  for (const [g, voci] of Object.entries(base)) {
    if (!voci || typeof voci !== 'object' || !s[g] || typeof s[g] !== 'object') continue;
    for (const k of Object.keys(voci)) {
      const x = s[g][k];
      if (Array.isArray(voci[k])) { if (Array.isArray(x) && x.length === voci[k].length && x.every(y => typeof y === 'string' && y.trim())) voci[k] = [...x]; }
      else if (['orario', 'commenti', 'testi', 'segnalibri', 'titoli', 'sezioni', 'parole', 'file'].includes(g) ? typeof x === 'string' && x.trim() && !x.includes('\0') : buono(x)) voci[k] = x;
    }
  }
  base.cartelle.lode = 'Lode';   // la cartella di Lode ha il suo nome in tutte le lingue (la sincronizzazione ci scrive la sua nota)
  return base;
}
// quello che si salva in .lode/vault.json
export const daSalvare = N => ({ lingua: N.lingua, nomi: Object.fromEntries(Object.entries(N).filter(([k]) => !['lingua', 'locale', 'testi'].includes(k))) });

const K = Symbol.for('lode.nomi');
// la tabella del vault aperto (prima che qualcuno la imposti: l'italiano, cioè i nomi di sempre)
export const nomi = () => globalThis[K] || (globalThis[K] = nomiDi('it'));
// imposta la tabella: un codice di lingua, una tabella intera o quello che c'è in vault.json ({ lingua, nomi })
export function impostaNomi(x) {
  globalThis[K] = typeof x === 'string' || x == null ? nomiDi(x || 'it') : x.cartelle && x.note && x.sezioni ? completa({ lingua: x.lingua, nomi: x }) : completa(x);
  return globalThis[K];
}

// un nome di file composto («{data} {corso} · sbobina di {da}»): i pezzi arrivano già puliti (markdown.js, pulito)
export const nomeFile = (k, p) => String(nomi().file[k]).replace(/\{(\w+)\}/g, (x, c) => (c in p ? String(p[c]) : x));
// comodità: il nome del file di una nota alla radice («Home.md») e i percorsi fissi
export const md = nome => `${nome}.md`;
export const fileNota = chiave => md(nomi().note[chiave]);
export const fileMemoria = () => `${nomi().cartelle.lode}/${md(nomi().note.memoria)}`;
// confronto di nomi con le lettere accentate scritte in due modi (NFC/NFD: macOS e i servizi cloud non sempre le salvano uguali)
export const stesso = (a, b) => String(a ?? '').normalize('NFC') === String(b ?? '').normalize('NFC');
// un nome dentro una regex
export const rx = s => String(s).normalize('NFC').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
