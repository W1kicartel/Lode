// I sistemi dei voti (docs/LINGUE.md, «Sistemi dei voti»): Italia, Spagna, Francia, Germania, Portogallo, Brasile, Regno
// Unito, Stati Uniti. Modulo puro: niente D, niente pagina. Chi lo usa passa gli esami e le opzioni del profilo
// (profilo.sistema, profilo.lode, profilo.cfuTotali). La lingua non è il paese: il sistema si sceglie a parte, il
// predefinito viene dalla lingua (predefinito()).
// In Italia i conti sono ESATTAMENTE quelli di sempre (media(), serve(), simula() di js/dati.js): stesse somme, stesso
// ordine, stessa lode che vale profilo.lode, stessa base × 110 / 30, stessi 6 CFU di prova finale senza voto.
// Come si salva un voto: sempre un numero nella scala del sistema (30, 8.5, 2.3, 65). Negli Stati Uniti il numero è il
// punteggio GPA della lettera (A− → 3.7), e formato() lo rimostra come lettera. La lode (Italia) e la Matrícula de Honor
// (Spagna) sono lode: true accanto al voto massimo.
import { t, numero } from './lingua.js';

// le lettere degli Stati Uniti e il loro punteggio (A+ vale 4,0 come A: il massimo del GPA resta 4,0)
const LETTERE = { 'a+': 4, a: 4, 'a-': 3.7, 'b+': 3.3, b: 3, 'b-': 2.7, 'c+': 2.3, c: 2, 'c-': 1.7, 'd+': 1.3, d: 1, 'd-': 0.7, f: 0 };
const LETTERA = [[4, 'A'], [3.7, 'A−'], [3.3, 'B+'], [3, 'B'], [2.7, 'B−'], [2.3, 'C+'], [2, 'C'], [1.7, 'C−'], [1.3, 'D+'], [1, 'D'], [0.7, 'D−'], [0, 'F']];

// Ogni sistema: scala (min, max, passo, decimali ammessi), sufficienza, migliore 'alto' o 'basso', voti ammessi (solo dove
// sono un elenco), lode, il voto finale (finale), i crediti totali di una laurea di primo livello e quelli di un esame tipico,
// i crediti della prova finale senza voto (solo Italia), e se i voti non sufficienti contano nella media (solo GPA).
export const SISTEMI = {
  it: { cod: 'it', min: 18, max: 30, passo: 1, decimali: 0, sufficienza: 18, migliore: 'alto', lode: true, finale: 'base', totali: 180, esame: 6, provaFinale: 6, bocciatiInMedia: true },
  es: { cod: 'es', min: 0, max: 10, passo: 0.1, decimali: 2, sufficienza: 5, migliore: 'alto', lode: true, finale: 'media', totali: 240, esame: 6, provaFinale: 0 },
  fr: { cod: 'fr', min: 0, max: 20, passo: 0.01, decimali: 2, sufficienza: 10, migliore: 'alto', lode: false, finale: 'mention', totali: 180, esame: 6, provaFinale: 0 },
  de: { cod: 'de', min: 1, max: 5, passo: 0.1, decimali: 1, sufficienza: 4, migliore: 'basso', lode: false, finale: 'gesamtnote', totali: 180, esame: 5, provaFinale: 0,
    voti: [1, 1.3, 1.7, 2, 2.3, 2.7, 3, 3.3, 3.7, 4, 5] },
  pt: { cod: 'pt', min: 0, max: 20, passo: 1, decimali: 2, sufficienza: 10, migliore: 'alto', lode: false, finale: 'media', totali: 180, esame: 6, provaFinale: 0 },
  br: { cod: 'br', min: 0, max: 10, passo: 0.1, decimali: 2, sufficienza: 6, migliore: 'alto', lode: false, finale: 'media', totali: 240, esame: 4, provaFinale: 0 },
  uk: { cod: 'uk', min: 0, max: 100, passo: 1, decimali: 1, sufficienza: 40, migliore: 'alto', lode: false, finale: 'classe', totali: 360, esame: 15, provaFinale: 0 },
  us: { cod: 'us', min: 0, max: 4, passo: 0.1, decimali: 1, sufficienza: 1, migliore: 'alto', lode: false, finale: 'gpa', totali: 120, esame: 3, provaFinale: 0, bocciatiInMedia: true,
    voti: [0, 0.7, 1, 1.3, 1.7, 2, 2.3, 2.7, 3, 3.3, 3.7, 4] },
};
export const CODICI = Object.keys(SISTEMI);
// il sistema dato (codice o oggetto); un codice sconosciuto vale l'Italia, come i dati di prima che non hanno profilo.sistema
export const sistema = s => (s && typeof s === 'object' ? s : SISTEMI[s] || SISTEMI.it);
// il sistema predefinito per la lingua della barra: l'inglese va al Regno Unito
export const predefinito = lingua => ({ it: 'it', es: 'es', fr: 'fr', de: 'de', pt: 'pt', en: 'uk' })[lingua] || 'it';

// le etichette per lo studente (catalogo «sistemi», nella lingua della barra)
export const nomeSistema = s => t(`sistemi.nome.${sistema(s).cod}`);
export const nomeCrediti = s => t(`sistemi.crediti.${sistema(s).cod}`);
export const etichettaFinale = s => t(`sistemi.finale.${sistema(s).cod}`);

/* ---------- un voto ---------- */
const quasi = (a, b) => Math.abs(a - b) < 1e-9;
const decimaliDi = x => { const s = String(Math.round(x * 1e6) / 1e6); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
// il voto è nella scala del sistema? (Italia: intero 18-30; Germania e Stati Uniti: uno dei voti dell'elenco)
export function valido(voto, s = 'it') {
  s = sistema(s);
  if (typeof voto !== 'number' || !Number.isFinite(voto)) return false;
  if (s.voti) return s.voti.some(v => quasi(v, voto));
  return voto >= s.min && voto <= s.max && decimaliDi(voto) <= s.decimali;
}
// sufficiente? (Germania: 4,0 passa, 5,0 no; Stati Uniti: D passa, D− e F no)
export function superato(voto, s = 'it') {
  s = sistema(s);
  if (!valido(voto, s)) return false;
  return s.migliore === 'basso' ? voto <= s.sufficienza + 1e-9 : voto >= s.sufficienza - 1e-9;
}

// le parole che si trovano accanto a un numero nei libretti (giudizi, «e lode», «Matrícula»): tutto il resto non è un voto
// («9 CFU» non è un 9)
const GIUDIZI = /^(?:sobresaliente|notable|aprobado|suspenso|suficiente|insuficiente|bien|tr[eè]s bien|assez bien|passable|ajourn[ée]e?|admis|valid[ée]e?|acquis|sehr gut|gut|befriedigend|ausreichend|nicht ausreichend|mangelhaft|ungen[uü]gend|bestanden|aprovad[oa]|reprovad[oa]|muito bom|bom|first|merit|distinction|pass|fail|valori|valores|points?|pts|punti|nota|note|voto|grade|mark)$/;
const LODE_IT = /^(?:e lode|lode|l|con lode|cum laude|e l)$/;
const MATRICULA = /^(?:mh|m\.h\.|matr[ií]cula(?: de honor)?|matr[ií]cula de honra)$/;
// le idoneità (esame superato senza voto) in sei lingue
const IDONEO = /^(?:idone[oa]|idoneit[aà]|superat[oa]|approvat[oa]|apt[oa]|convalidad[oa]|valid[ée]e?|acquis|admis|bestanden|be|aprovad[oa]|passed|pass|p|satisfactory)$/;
const DE_PAROLE = { 'sehr gut': 1, gut: 2, befriedigend: 3, ausreichend: 4, 'nicht ausreichend': 5, mangelhaft: 5, 'ungenügend': 5, ungenugend: 5, 'nicht bestanden': 5 };

// legge un voto scritto dallo studente o copiato da un libretto: «30L», «30 e lode», «28/30», «8,5», «8.5», «2,3», «A-»,
// «B+», «65%», «16/20», «Notable (7,8)», «sehr gut», «idoneo». Restituisce { voto, lode, idoneita } oppure null
export function leggiVoto(testo, s = 'it') {
  s = sistema(s);
  let x = String(testo ?? '').toLowerCase().replace(/[−–—]/g, '-').replace(/\s+/g, ' ').trim().replace(/^\((.*)\)$/, '$1').trim();
  if (!x) return null;
  const esito = (voto, lode = false) => (valido(voto, s) ? { voto: s.voti ? s.voti.find(v => quasi(v, voto)) : voto, lode, idoneita: false } : null);
  if (IDONEO.test(x)) return { voto: null, lode: false, idoneita: true };
  // Italia: «30L», «30 e lode», «30 cum laude», «30elode»
  if (s.cod === 'it') { const m = x.match(/^30\s*(?:\/\s*30)?\s*(e\s*lode|l|lode|con lode|cum laude)$/); if (m) return { voto: 30, lode: true, idoneita: false }; }
  // Spagna: la Matrícula de Honor è un 10 con la lode
  if (s.cod === 'es' && MATRICULA.test(x)) return { voto: 10, lode: true, idoneita: false };
  // Germania: i giudizi a parole
  if (s.cod === 'de' && x in DE_PAROLE) return esito(DE_PAROLE[x]);
  // Stati Uniti: le lettere (A, A-, B+…), anche con il punteggio accanto «A- (3.7)»
  if (s.cod === 'us') {
    const m = x.match(/^([abcdf])\s*([+-])?(?:\s*\(?\s*\d(?:[.,]\d+)?\s*\)?)?$/);
    if (m) { const k = m[1] + (m[2] || ''); return k in LETTERE ? esito(LETTERE[k]) : null; }
  }
  // un numero, con «/max», «%», e parole ammesse prima o dopo
  const m = x.match(/^([\p{L} .()]*?)\s*\(?\s*(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:\/\s*(\d{1,3}))?\s*(%)?\s*\)?\s*([\p{L} .()]*)$/u);
  if (!m) return null;
  const parole = [m[1], m[5]].map(p => p.replace(/[().]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const voto = Number(m[2].replace(',', '.'));
  if (m[3] && Number(m[3]) !== s.max) return null;                 // «28/30» in Italia, «16/20» in Francia; «8/10» non è francese
  if (m[4] && s.cod !== 'uk') return null;                         // la percentuale è del Regno Unito
  let lode = false;
  for (const p of parole) {
    if (s.cod === 'it' && LODE_IT.test(p)) { if (voto !== 30) return null; lode = true; continue; }
    if (s.cod === 'es' && MATRICULA.test(p)) { if (voto < 9) return null; lode = true; continue; }
    if (!GIUDIZI.test(p)) return null;
  }
  // «30» con la virgola («30,0») vale 30; in Italia un voto con i decimali non esiste
  if (s.cod === 'it' && !Number.isInteger(voto)) return null;
  // Matrícula de Honor accanto a un 9,x: per la media vale il voto scritto, la lode resta il segno
  return esito(voto, lode);
}

// come si mostra un voto: «30L» (come oggi nel libretto), «8,5», «16,25», «2,3», «65», «A−»; idoneità e voto mancante a parte
export function formato(voto, s = 'it', { lode = false, idoneita = false } = {}) {
  s = sistema(s);
  if (idoneita) return t('sistemi.idoneo');
  if (voto == null || voto === '' || !Number.isFinite(Number(voto))) return '—';
  const v = Number(voto);
  if (s.cod === 'us') return (LETTERA.find(([p]) => quasi(p, v)) || [, numero(v, 1)])[1];
  if (s.cod === 'it') return numero(v, 0) + (lode ? 'L' : '');
  if (s.cod === 'de') return numero(v, 1);
  const dec = Math.min(s.decimali, decimaliDi(v)), min = s.cod === 'es' || s.cod === 'br' ? 1 : 0;
  return numero(v, Math.max(min, dec)) + (s.cod === 'es' && lode ? ' MH' : '');
}

/* ---------- media, voto finale, «quanto mi serve», «e se prendo» ---------- */
const crediti = e => Number(e.cfu ?? e.crediti);
// il valore di un voto nella media: in Italia la lode vale profilo.lode (di solito 30, come js/dati.js)
export const valore = (e, s = 'it', lodeVale = 30) => (sistema(s).cod === 'it' ? (e.lode ? Number(lodeVale || 30) : e.voto) : Number(e.voto));

// Media sugli esami dati: { ponderata (sui crediti), aritmetica, base (solo Italia: ponderata × 110 / 30), finale (vedi
// finale()), cfuVoto, somma, n }. Le idoneità non contano; i voti non sufficienti non contano (tranne nel GPA, dove la F
// conta, e in Italia, dove un voto sotto 18 non esiste). Crediti tutti a zero: la ponderata non c'è (null), l'aritmetica sì.
// opz: { sistema, lode } (lode = profilo.lode)
export function media(lista = [], { sistema: cod = 'it', lode = 30 } = {}) {
  const s = sistema(cod);
  const conVoto = lista.filter(e => e.voto != null && !e.idoneita && (s.bocciatiInMedia || superato(Number(e.voto), s)));
  const cfu = conVoto.reduce((x, e) => x + crediti(e), 0);
  if (!conVoto.length) return { ponderata: null, aritmetica: null, base: null, finale: null, cfuVoto: 0, somma: 0, n: 0 };
  const somma = conVoto.reduce((x, e) => x + valore(e, s, lode) * crediti(e), 0);
  const aritmetica = conVoto.reduce((x, e) => x + valore(e, s, lode), 0) / conVoto.length;
  const ponderata = cfu > 0 ? somma / cfu : null;
  return { ponderata, aritmetica, base: s.cod === 'it' && ponderata != null ? ponderata * 110 / 30 : null, finale: finale(ponderata, s), cfuVoto: cfu, somma, n: conVoto.length };
}

// Il voto finale dalla media ponderata: { tipo, valore, max, mention | classe }
// it: base di laurea = media × 110 / 30 · es, pt, br: la media · fr: moyenne con la mention (10 passable, 12 assez bien,
// 14 bien, 16 très bien) · de: Gesamtnote, la media troncata (non arrotondata) a un decimale · uk: la classe (70 First,
// 60 2:1, 50 2:2, 40 Third) · us: il GPA
export function finale(ponderata, s = 'it') {
  s = sistema(s);
  if (ponderata == null || !Number.isFinite(ponderata)) return null;
  const f = { tipo: s.finale, valore: ponderata, max: s.max };
  if (s.cod === 'it') return { ...f, valore: ponderata * 110 / 30, max: 110 };
  if (s.cod === 'de') return { ...f, valore: Math.floor(ponderata * 10 + 1e-9) / 10, max: null };
  if (s.cod === 'fr') return { ...f, mention: ponderata >= 16 ? 'tresBien' : ponderata >= 14 ? 'bien' : ponderata >= 12 ? 'assezBien' : ponderata >= 10 ? 'passable' : null };
  if (s.cod === 'uk') return { ...f, classe: ponderata >= 70 ? 'first' : ponderata >= 60 ? 'upperSecond' : ponderata >= 50 ? 'lowerSecond' : ponderata >= 40 ? 'third' : 'fail' };
  return f;
}
// il voto finale da mostrare: «101,2/110», «7,85», «13,45 · Assez bien», «1,7», «First (72,0)», «3,45»
export function formatoFinale(f, s = 'it') {
  s = sistema(s);
  if (!f) return '—';
  const v = numero(f.valore, s.cod === 'de' || s.cod === 'it' || s.cod === 'uk' ? 1 : 2);
  if (s.cod === 'it') return t('sistemi.su', { v, max: 110 });
  if (s.cod === 'fr') return t('sistemi.conMention', { v, mention: t(`sistemi.mention.${f.mention || 'nessuna'}`) });
  if (s.cod === 'uk') return t('sistemi.conClasse', { v, classe: t(`sistemi.classe.${f.classe}`) });
  return v;
}

// Che media serve nei crediti che mancano per arrivare a un voto finale (nella scala del finale: in Italia la base di
// laurea su 110, come serve() di js/dati.js; in Germania la Gesamtnote, dove migliore = più basso). fatti: gli esami dati.
// opz: { sistema, lode, totali (profilo.cfuTotali) }. Restituisce { voto, cfu, possibile, gia } oppure null se non manca niente.
// possibile: la media che serve esiste nella scala; gia: ci arrivi anche con la sufficienza in tutto.
// Germania: «arrivare a 1,5» vuol dire media ≤ 1,5 (la Gesamtnote troncata darebbe 1,5 fino a 1,59: qui si resta prudenti)
export function serve(obiettivo, fatti = [], { sistema: cod = 'it', lode = 30, totali } = {}) {
  const s = sistema(cod);
  const m = media(fatti, { sistema: s, lode });
  const cfuFatti = fatti.reduce((x, e) => x + crediti(e), 0);
  const mancano = Math.max(0, (totali || s.totali) - cfuFatti - s.provaFinale);
  if (!mancano) return null;
  const mediaObiettivo = s.cod === 'it' ? obiettivo * 30 / 110 : obiettivo;
  const v = (mediaObiettivo * (m.cfuVoto + mancano) - m.somma) / mancano;
  return s.migliore === 'basso'
    ? { voto: v, cfu: mancano, possibile: v >= s.min, gia: v > s.sufficienza }
    : { voto: v, cfu: mancano, possibile: v <= s.max, gia: v < s.sufficienza };
}

// E se prendo voto (con la lode) in quell'esame? Come cambia la media: { prima, dopo, delta, meglio }. esame: l'esame
// (anche già dato: il voto nuovo sostituisce quello vecchio); fatti: gli esami dati. Come simula() di js/dati.js
export function simula(esame, voto, lode = false, fatti = [], { sistema: cod = 'it', lode: lodeVale = 30 } = {}) {
  const s = sistema(cod);
  if (!esame) return null;
  const finto = { ...esame, voto, lode: s.lode && lode && voto === s.max, idoneita: false, fatto: true };
  const lista = [...fatti.filter(x => x.id !== esame.id), finto];
  const prima = media(fatti, { sistema: s, lode: lodeVale }), dopo = media(lista, { sistema: s, lode: lodeVale });
  const delta = prima.ponderata == null || dopo.ponderata == null ? null : dopo.ponderata - prima.ponderata;
  return { prima, dopo, delta, meglio: delta == null ? null : s.migliore === 'basso' ? delta < 0 : delta > 0 };
}

/* ---------- libretto incollato (tutti i sistemi) ---------- */
// Un libretto copiato da una tabella: righe «nome · crediti · voto», con le colonne separate da tab, «;», «|», «·», «, »
// o da più spazi (o anche da uno solo: il voto è in fondo, i crediti subito prima). Le intestazioni in sei lingue si
// saltano e, se dicono l'ordine delle colonne («Voto | Crediti»), si segue quello. Date e codici si ignorano.
// Restituisce [{ nome, crediti, voto, lode, idoneita }]: solo gli esami superati (o con un voto che conta, nel GPA).
// In Italia il lettore di Esse3 (librettoSenzaAI in js/benvenuto.js) resta quello di sempre: questo è per gli altri.
const COL_CREDITI = /^(?:cfu|ects|ects-?punkte|cr[eé]dit[oi]?s?|credits?|credit hours|hours|ch|cp|lp|leistungspunkte|cr|crediti|ore|horas|hrs|sws)$/;
const COL_VOTO = /^(?:voto|esito|valutazione|nota|calificaci[oó]n|note|grade|mark|marks|bewertung|classifica[cç][aã]o|resultado|r[ée]sultat|pontua[cç][aã]o|conceito|score|%)$/;
const COL_NOME = /^(?:esame|insegnamento|attivit[aà](?: didattica)?|corso|materia|asignatura|mati[eè]re|ue|unit[eé](?: d'enseignement)?|module?|modul|fach|pr[uü]fung|lehrveranstaltung|unidade curricular|uc|disciplina|cadeira|course|subject|class|nome|name|nom|nombre)$/;
const MARCA_CREDITI = /^(\d{1,3}(?:[.,]\d)?)\s*(?:cfu|ects|cr[eé]dit[oi]?s?|credits?|cr|cp|lp|ch|hrs?|hours|ore|horas)$/i;
const DATA_CELLA = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/;
const CODICE = /^[A-Za-z]{0,6}[-_ ]?\d{2,}[A-Za-z]?$/;
const NUMERO = /^\d{1,3}(?:[.,]\d{1,2})?$/;
const lettere = c => (c.match(/\p{L}/gu) || []).length;

export function leggiLibretto(testo, s = 'it') {
  s = sistema(s);
  const out = [];
  let colonne = null;   // dall'intestazione: { nome, crediti, voto } (indici delle celle)
  const togliDate = r => r.replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g, ' ');
  for (const r0 of String(testo ?? '').split(/\r?\n/)) {
    const r = r0.replace(/ /g, ' ').trim(); if (!r) continue;
    const sep = /\t| ?[;|·•] ?|, | {2,}/.test(r);
    let celle = sep ? r.split(/\t| ?[;|·•] ?|, | {2,}/).map(c => c.trim()) : null;
    // intestazione: nessuna cifra e almeno una parola da colonna
    if (!/\d/.test(r) && !(s.cod === 'us' && leggiRigaUs(r, s))) {
      const cc = (celle || r.split(' ')).map(c => c.toLowerCase().replace(/[.:()]/g, '').trim());
      const i = { nome: cc.findIndex(c => COL_NOME.test(c)), crediti: cc.findIndex(c => COL_CREDITI.test(c)), voto: cc.findIndex(c => COL_VOTO.test(c)) };
      if ((i.crediti >= 0) + (i.voto >= 0) + (i.nome >= 0) >= 2) { colonne = celle && i.voto >= 0 ? i : null; continue; }
    }
    let nome = null, cr = null, v = null;
    if (celle && colonne && celle.length > Math.max(colonne.voto, colonne.crediti, colonne.nome)) {
      v = leggiVoto(celle[colonne.voto], s);
      const c = colonne.crediti >= 0 ? celle[colonne.crediti] : null;
      cr = c == null ? null : (c.match(MARCA_CREDITI)?.[1] ?? (NUMERO.test(c) ? c : null));
      nome = colonne.nome >= 0 ? celle[colonne.nome] : celle.find((c, k) => k !== colonne.voto && k !== colonne.crediti && lettere(c) >= 3 && !CODICE.test(c));
    } else {
      // senza intestazione: il voto è la cella più a destra che si legge come voto; i crediti sono un numero (o «9 CFU»)
      // accanto, di preferenza prima del voto; il nome è la prima cella con delle lettere
      if (!celle) celle = celleDaSpazi(togliDate(r).replace(/\s+/g, ' ').trim(), s);
      celle = celle.filter(c => c && !DATA_CELLA.test(c));
      let iv = -1;
      for (let k = celle.length - 1; k >= 1; k--) { const x = MARCA_CREDITI.test(celle[k]) ? null : leggiVoto(celle[k], s); if (x) { v = x; iv = k; break; } }
      if (!v) continue;
      const marcata = celle.findIndex((c, k) => k !== iv && MARCA_CREDITI.test(c));
      if (marcata >= 0) cr = celle[marcata].match(MARCA_CREDITI)[1];
      else {
        const prima = celle.slice(0, iv).map((c, k) => [c, k]).filter(([c, k]) => k > 0 && NUMERO.test(c)).pop();
        const dopo = celle.slice(iv + 1).find(c => NUMERO.test(c));
        cr = prima ? prima[0] : dopo ?? null;
      }
      nome = celle.slice(0, iv).find(c => lettere(c) >= 3 && !CODICE.test(c) && !MARCA_CREDITI.test(c));
    }
    if (!v || !nome) continue;
    nome = nome.replace(/^[A-Za-z]{0,6}[-_]?\d{3,}[A-Za-z]?\s*[-–:]\s*/, '').trim();
    if (nome.length < 3 || COL_NOME.test(nome.toLowerCase())) continue;
    if (!v.idoneita && !s.bocciatiInMedia && !superato(v.voto, s)) continue;   // non superato: non va nel libretto
    const crediti = cr == null ? null : Number(String(cr).replace(',', '.'));
    out.push({ nome, crediti: Number.isFinite(crediti) ? crediti : null, voto: v.voto, lode: v.lode, idoneita: v.idoneita });
  }
  return out;
}
// una riga senza separatori («Analisi 1 9 28», «Calculus II 4 A-», «Física 6 Matrícula de Honor»): il voto sono le ultime
// 1-4 parole che si leggono come voto, i crediti il numero (o «9 CFU») subito prima, il nome tutto il resto
function celleDaSpazi(r, s) {
  const p = r.split(' ');
  for (let k = Math.min(4, p.length - 1); k >= 1; k--) {
    const coda = p.slice(-k).join(' ');
    if (MARCA_CREDITI.test(coda) || !leggiVoto(coda, s)) continue;
    let resto = p.slice(0, -k), cr = null;
    const due = resto.slice(-2).join(' ');
    if (resto.length > 2 && MARCA_CREDITI.test(due)) { cr = due; resto = resto.slice(0, -2); }
    else if (resto.length > 1 && (NUMERO.test(resto[resto.length - 1]) || MARCA_CREDITI.test(resto[resto.length - 1]))) { cr = resto.pop(); }
    return [resto.join(' '), ...(cr ? [cr] : []), coda];
  }
  return [r];
}
// nel libretto degli Stati Uniti anche una riga senza cifre può essere un esame («Calculus A-»)
function leggiRigaUs(r, s) { const p = r.trim().split(/\s+/); return p.length > 1 && !!leggiVoto(p[p.length - 1], s) && !COL_VOTO.test(p[p.length - 1].toLowerCase()); }
