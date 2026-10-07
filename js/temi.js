// «Temi d'esame»: gli esercizi dei compiti vecchi, uno al giorno, dentro il piano del programma (js/programma.js).
// Lo studente incolla (o trascina) il testo di un compito vecchio: Lode lo divide in esercizi sui segni fissi («Esercizio 1»,
// «Es. 2», «Problema 3»…), mette ognuno sotto il suo argomento del programma e ogni giorno ne propone uno degli argomenti
// di oggi. Lo studente lo fa su carta, senza appunti, e dice lui com'è andata: Lode non corregge e non dà voti (sarebbe
// un voto finto). La soluzione del prof, se c'è nel testo, si vede solo dopo l'esito. Gli esercizi tornano a intervalli
// (2 giorni se non sapevi da dove partire, 3 se sbagliato, 7 e poi il doppio se giusto) e l'esito va sull'argomento,
// così la mappa del programma si aggiorna. Tutto senza AI e senza OCR: un PDF scansionato si incolla a mano.
// Dove sta: dentro l'esame (esami[i].temi), come il programma. piano() non si tocca: gli esercizi si agganciano ai suoi giorni.
import { salva, id, oggi, piuGiorni, norm, MESI } from './dati.js';
import { abbina, oggiDi, registraEsito } from './programma.js';
import { t } from './lingua.js';

/* ---------- dividere il compito in esercizi ---------- */
// i segni a inizio riga: «Esercizio 1», «ES. 2», «Es 3», «Problema 4», «Quesito 5», «Domanda 6», anche «Esercizio 1 (6 punti)»
const SEGNO = /^\s*(?:#+\s*)?(?:\*\*)?(?:esercizio|es\.?|problema|quesito|domanda)\s*n?[°º.]?\s*(\d{1,2})\b(?:\*\*)?\s*/i;
// senza segni: righe numerate «1.» «2)» in ordine
const NUMERO = /^\s*(\d{1,2})\s*[.)]\s+/;
// la soluzione del prof dentro un esercizio: solo l'etichetta («Soluzione», «Soluzione:», «Soluzione.», «**Soluzione**»,
// «Soluzione dell'esercizio 3:», «Svolgimento:»). Non «Soluzione di NaCl 0,9%: …» né «Soluzione generale dell'equazione…»,
// che sono testo dell'esercizio: se finissero in sol, lo studente le vedrebbe solo dopo l'esito (o perderebbe l'esercizio)
const SOL = /^\s*(?:\*\*)?(?:soluzione|svolgimento|risoluzione)(?:\s+(?:dell['’]\s*|del\s+)?(?:esercizio|es\.?|problema|quesito|domanda)\s*n?[°º.]?\s*\d{0,2})?\s*(?:\*\*)?\s*(?::(?:\*\*)?\s*|\.(?:\*\*)?(?:\s+|$)|$)/i;
const SEZ_SOL = /^\s*(?:#+\s*)?(?:\*\*)?(?:soluzioni|svolgimenti|risoluzioni)(?: degli esercizi)?\s*:?(?:\*\*)?\s*$/i;
// «(6 punti)», «- 8 pt», «:» dopo il numero: non fanno parte del testo
const pulisciInizio = s => s.replace(/^\s*(?:\(\s*\d+(?:[.,]\d+)?\s*(?:punti|punto|pt|p)\.?\s*\)|[-–—]\s*\d+(?:[.,]\d+)?\s*(?:punti|pt)\.?)?\s*[.):\-–—]?\s*/i, '');
// i punti in testa all'esercizio, prima di pulirlo: «(6 punti)», «(6 pt)», «- 6 punti», «[6 punti]», «6 punti:», «(punti 7,5)».
// Servono solo alla prova generale (js/prova.js): il testo resta com'era
const PUNTI = /^\s*[.):]?\s*(?:[(\[]\s*|[-–—]\s*)?(?:(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:punti|punto|pt|p)\.?|punti\s*:?\s*(\d{1,3}(?:[.,]\d{1,2})?))(?![a-zà-ù])/i;
function puntiDi(riga) {
  const m = String(riga || '').match(PUNTI); if (!m) return null;
  const v = Number((m[1] || m[2]).replace(',', '.')); return v > 0 && v <= 100 ? v : null;
}
// quanto dura il compito, dall'intestazione: «Tempo: 2 ore», «durata 3h», «Avete 120 minuti», «Durata: 2 ore e 30»,
// «tempo a disposizione: 2h30», «(2 ore e mezza)». In minuti, fra 30 e 300; se no null. Il numero conta solo con una parola
// di contesto sulla stessa riga (tempo, durata, a disposizione, avete, hai) o fra parentesi: «Analisi Matematica 2 ore 14»
// è il nome del corso più l'ora di inizio, non 134 minuti. «<n> ore» seguito da un'ora del giorno («ore 9:30», «h 9.00»,
// «ore 9-12») non è una durata, e le righe sul ritardo («Sono ammessi 30 min di ritardo») non contano
const DURATA = /(?<![\d/.,:])(\d{1,3}(?:[.,]\d)?)\s*(?:ore|ora|h)(?![a-zà-ù])(?:\s*e\s*(?:(\d{1,2})(?!\d)(?:\s*(?:minuti|min)\b)?|(mezz[ao]))|(\d{2})(?!\d)|\s*(\d{1,2})\s*(?:minuti|min)\b)?|(?<![\d/.,:])(\d{2,3})\s*(?:minuti|min)\b/g;
const CONTESTO = /\b(?:tempo|durata|a disposizione|avete|hai)\b/, RITARDO = /\b(?:ritard[oi]|ammess[ieao])\b/;
export function durataDi(testo) {
  for (const riga of String(testo || '').toLowerCase().split('\n')) {
    if (RITARDO.test(riga)) continue;
    const pezzi = CONTESTO.test(riga) ? [riga] : [...riga.matchAll(/\(([^()]*)\)/g)].map(m => m[1]);
    for (const t of pezzi) for (const m of t.matchAll(DURATA)) {
      const dopo = t.slice(m.index + m[0].length);
      // l'ora del giorno dopo «ore»/«h»: «ore 14», «h 9.00», «ore 9-12»; anche «2h30:00»
      if (m[1] && !m[2] && !m[3] && !m[4] && !m[5] && /^\s*\d/.test(dopo)) continue;
      if (m[4] && /^[:.\-]\d/.test(dopo)) continue;
      const min = m[6] ? +m[6] : Math.round(Number(m[1].replace(',', '.')) * 60 + (m[2] ? +m[2] : m[4] ? +m[4] : m[5] ? +m[5] : m[3] ? 30 : 0));
      if (min >= 30 && min <= 300) return min;
    }
  }
  return null;
}
const MESE = MESI.map(m => m.slice(0, 3)).join('|');
// la data del compito nell'intestazione: 12/02/2024, 12.02.24, 12-2-2024, «12 febbraio 2024» → ISO
export function dataDi(testo) {
  const t = String(testo || ''); let m;
  if ((m = t.match(/(?:^|[^\d])(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})(?!\d)/))) {
    const g = +m[1], me = +m[2]; let a = +m[3]; if (a < 100) a += 2000;
    if (g >= 1 && g <= 31 && me >= 1 && me <= 12) return `${a}-${String(me).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
  }
  if ((m = norm(t).match(new RegExp(`\\b(\\d{1,2}) (${MESE})[a-z]* (\\d{4})\\b`)))) {
    const me = MESI.findIndex(x => x.startsWith(m[2])) + 1, g = +m[1];
    if (g >= 1 && g <= 31) return `${m[3]}-${String(me).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
  }
  return null;
}
export const dataScritta = iso => iso ? iso.split('-').reverse().join('/') : '';
// un pezzo: il testo fino a «Soluzione», poi la soluzione (senza l'etichetta). L'etichetta conta solo se prima c'è del
// testo: un esercizio non resta mai con t vuoto e tutto nascosto in sol
function separa(righe) {
  const k = righe.findIndex((r, i) => SOL.test(r) && righe.slice(0, i).some(x => x.trim()));
  const t = (k < 0 ? righe : righe.slice(0, k)).join('\n').trim();
  const sol = k < 0 ? '' : [righe[k].replace(SOL, ''), ...righe.slice(k + 1)].join('\n').trim();
  return { t, sol: sol || null };
}
// il testo di un compito → { pezzi: [{ n, t, sol, punti }], data, durata }. L'intestazione (corso, data, istruzioni) si
// scarta, ma la data e la durata si tengono. Al massimo 30 pezzi; quelli sotto 15 caratteri si uniscono al precedente. Nessun segno → un pezzo solo
export function dividi(testo) {
  const righe = String(testo || '').replace(/\r/g, '').replace(/^\[Pagina \d+\]$/gm, '').split('\n');
  const segni = righe.filter(r => SEGNO.test(r)).length;
  let aperture = [];   // [indice della riga, numero]
  if (segni) righe.forEach((r, i) => { const m = r.match(SEGNO); if (m) aperture.push([i, +m[1]]); });
  else {
    let atteso = 1; const x = [];
    righe.forEach((r, i) => { const m = r.match(NUMERO); if (m && +m[1] === atteso) { x.push([i, atteso]); atteso++; } });
    if (x.length >= 2) aperture = x;
  }
  if (!aperture.length) { const p = separa(righe); return { pezzi: p.t || p.sol ? [{ n: 1, ...p, punti: null }] : [], data: null, durata: null }; }
  const testa = righe.slice(0, aperture[0][0]).join('\n'), data = dataDi(testa), durata = durataDi(testa);
  let pezzi = [], inSoluzioni = false;
  aperture.forEach(([i, n], k) => {
    const fine = k + 1 < aperture.length ? aperture[k + 1][0] : righe.length;
    let corpo = [(segni ? righe[i].replace(SEGNO, '') : righe[i].replace(NUMERO, '')), ...righe.slice(i + 1, fine)];
    const punti = puntiDi(corpo[0]); corpo[0] = pulisciInizio(corpo[0]);
    // «Soluzioni» in fondo al compito: da lì gli stessi numeri sono le soluzioni degli esercizi di prima
    const z = corpo.findIndex(r => SEZ_SOL.test(r));
    const prima = z < 0 ? corpo : corpo.slice(0, z);
    const gia = pezzi.find(p => p.n === n);
    if (inSoluzioni && gia) gia.sol = [gia.sol, prima.join('\n').trim()].filter(Boolean).join('\n\n') || null;
    else pezzi.push({ n, ...separa(prima), punti });
    if (z >= 0) inSoluzioni = true;
  });
  // i pezzi troppo corti (un titolo, un numero rimasto solo) vanno col precedente (il primo col successivo)
  const out = [];
  for (const p of pezzi) {
    if (p.t.length < 15 && out.length) { const q = out.at(-1); q.t = [q.t, p.t].filter(Boolean).join('\n'); q.sol = [q.sol, p.sol].filter(Boolean).join('\n\n') || null; q.punti ??= p.punti; }
    else out.push(p);
  }
  if (out.length > 1 && out[0].t.length < 15) { const [a, b] = out; b.t = [a.t, b.t].filter(Boolean).join('\n'); b.sol = [a.sol, b.sol].filter(Boolean).join('\n\n') || null; b.n = a.n; b.punti = a.punti ?? b.punti; out.shift(); }
  return { pezzi: out.slice(0, 30), data, durata };
}
// «Unisci al precedente» della scheda di controllo: il pezzo i va in coda al pezzo i-1 (testo e soluzione)
export function unisci(pezzi, i) {
  if (i <= 0 || i >= pezzi.length) return pezzi;
  const x = pezzi.map(p => ({ ...p })), a = x[i - 1], b = x[i];
  a.t = [a.t, b.t].filter(Boolean).join('\n'); a.sol = [a.sol, b.sol].filter(Boolean).join('\n\n') || null;
  a.punti = a.punti != null && b.punti != null ? a.punti + b.punti : a.punti ?? b.punti ?? null;
  x.splice(i, 1); return x;
}
// un PDF scansionato: meno di 80 caratteri utili per pagina (i segni [Pagina N] e gli spazi non contano)
export function scansione(testo, pagine = 1) {
  const utili = String(testo || '').replace(/\[Pagina \d+\]/g, '').replace(/\s+/g, '').length;
  return utili / Math.max(1, pagine || 1) < 80;
}
// quanto ci vuole su carta: una stima grezza dalla lunghezza del testo (si scrive sempre «circa»)
export const minuti = t => { const n = String(t || '').length; return n < 300 ? 15 : n < 800 ? 25 : 40; };

/* ---------- salvare ---------- */
const MAX = 200;
// i pezzi diventano temi dell'esame: ognuno sotto il suo argomento (abbina di programma.js, o quello scelto nella scheda:
// p.a = id dell'argomento o null; se p.a manca, decide abbina). I doppioni (stesso testo) non si aggiungono. punti (del
// singolo esercizio) e durata (del compito, in minuti) servono alla prova generale: null se il compito non li dice
const numeroO = v => typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
export function metti(e, pezzi, { fonte = 'incollato', data = null, durata = null } = {}) {
  // lotto: un id per ogni chiamata, così due compiti incollati senza data restano due compiti (js/prova.js). I temi
  // salvati prima non ce l'hanno (null): restano raggruppati per fonte e data come prima
  const lista = e.temi ||= [], argomenti = e.programma?.argomenti || [], visti = new Set(lista.map(x => norm(x.t))), T = oggi(), lotto = id();
  let messi = 0, senza = 0, doppi = 0;
  for (const p of pezzi || []) {
    const t = String(p.t || '').trim(), k = norm(t); if (!k) continue;
    if (visti.has(k)) { doppi++; continue; }
    visti.add(k);
    const a = p.a !== undefined ? (argomenti.some(x => x.id === p.a) ? p.a : null) : abbina(t, argomenti)?.id || null;
    lista.push({ id: id(), t, sol: p.sol || null, a, fonte: String(fonte || 'incollato').slice(0, 120), data: data || null, es: p.n || null, punti: numeroO(p.punti), durata: numeroO(durata), lotto, esiti: [], scad: T });
    messi++; if (!a) senza++;
  }
  // al massimo 200 per esame: restano i più recenti
  if (lista.length > MAX) e.temi = lista.slice(-MAX);
  salva(); return { messi, senza, doppi };
}
// un programma nuovo (o incollato dopo i temi): i temi senza argomento, o con un argomento che non c'è più, si risistemano
export function risistema(e) {
  const argomenti = e.programma?.argomenti || []; let n = 0;
  for (const x of e.temi || []) if (!x.a || !argomenti.some(a => a.id === x.a)) { const a = abbina(x.t, argomenti)?.id || null; if (a !== x.a) { x.a = a; if (a) n++; } }
  if (n) salva(); return n;
}

/* ---------- l'esercizio di oggi ---------- */
// l'ultimo tema fatto (per non dare due giorni di fila lo stesso argomento)
const ultimoFatto = e => (e.temi || []).filter(x => x.fatto).sort((a, b) => b.fatto - a.fatto)[0] || null;
// in ordine: prima un argomento diverso da quello dell'ultimo tema fatto, poi i mai fatti, poi i più vecchi (scadenza, data)
function ordina(lista, ultimoA) {
  return [...lista].sort((x, y) => ((x.a && x.a === ultimoA) - (y.a && y.a === ultimoA)) || (!!x.esiti.length - !!y.esiti.length)
    || x.scad.localeCompare(y.scad) || (x.data || '9').localeCompare(y.data || '9'));
}
// gli esercizi di oggi: uno sugli argomenti del piano di oggi (studia + ripassa); il giorno del ripasso generale fino a 2,
// fra tutti gli argomenti e possibilmente diversi. Se oggi non c'è niente di adatto, uno scaduto qualsiasi
export function temiDiOggi(e, T = oggi()) {
  const scaduti = (e?.temi || []).filter(x => x.scad <= T); if (!scaduti.length) return [];
  const o = oggiDi(e), ultimoA = ultimoFatto(e)?.a || null;
  if (o?.tipo === 'generale') {
    const ord = ordina(scaduti, ultimoA), primo = ord[0], secondo = ord.find(x => x !== primo && (!x.a || x.a !== primo.a)) || ord[1];
    return [primo, secondo].filter(Boolean);
  }
  const ids = new Set(o ? [...o.studia, ...o.ripassa].map(c => c.a.id) : []);
  const adatti = scaduti.filter(x => x.a && ids.has(x.a));
  return [ordina(adatti.length ? adatti : scaduti, ultimoA)[0]];
}
export const temaDiOggi = (e, T = oggi()) => temiDiOggi(e, T)[0] || null;
// quanti temi per argomento (per la scheda quando oggi non c'è niente)
export function conta(e) {
  const per = new Map();
  for (const x of e?.temi || []) { const nome = e.programma?.argomenti?.find(a => a.id === x.a)?.t || t('temi.senza-argomento'); per.set(nome, (per.get(nome) || 0) + 1); }
  return [...per].sort((a, b) => b[1] - a[1]);
}

/* ---------- com'è andata: lo dice lo studente ---------- */
export const ESITI = { giusto: 'giusta', sbagliato: 'sbagliata', nonso: 'non so' };
// in più, solo dalla prova generale (js/prova.js): «A metà» torna come uno sbagliato, ma sulla mappa è «parziale».
// Una mappa a parte: ESITI resta quella dei tre bottoni dell'esercizio singolo
const SULLA_MAPPA = { ...ESITI, meta: 'parziale' };
// nonso → tra 2 giorni, sbagliato o a metà → tra 3, giusto → tra 7 (la prima volta, o dopo uno sbagliato), poi il doppio (max 60)
export function esito(e, temaId, come, T = oggi()) {
  const x = (e?.temi || []).find(y => y.id === temaId); if (!x || !Object.hasOwn(SULLA_MAPPA, come)) return null;
  const prima = x.esiti.at(-1)?.e;
  const int = come === 'nonso' ? 2 : come === 'sbagliato' || come === 'meta' ? 3 : prima === 'giusto' ? Math.min(60, (x.int || 7) * 2) : 7;
  x.esiti = [...x.esiti, { g: T, e: come }].slice(-6);
  x.int = int; x.scad = piuGiorni(T, int); x.fatto = Date.now();
  if (x.a) registraEsito(e, x.a, SULLA_MAPPA[come], 'tema');
  salva(); return { tema: x, giorni: int };
}
