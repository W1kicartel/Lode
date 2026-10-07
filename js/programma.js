// Il programma d'esame: gli argomenti del corso, quanto li hai coperti davvero e il piano fino all'appello.
// Lo studente incolla (o trascina) il programma del corso e, se le ha, le domande uscite agli appelli (quelle che girano
// nei gruppi del corso). Lode divide il programma in argomenti e per ognuno guarda le prove che ha: appunti e ★ delle
// lezioni, carte, ripasso, interrogazioni. Ne esce una mappa (mai toccato → sicuro) e un piano giorno per giorno che si
// rifà ogni volta da quello che sai oggi: prima gli argomenti deboli e quelli che escono di più, ogni argomento nuovo
// ripreso dopo un paio di giorni (ripasso distanziato), l'ultimo giorno per il ripasso generale e, se c'è tempo, un giorno
// cuscinetto per gli imprevisti. Tutto senza AI: con l'AI il programma si legge meglio, ma non serve.
// Dove sta: dentro l'esame (esami[i].programma). Con la sincronizzazione è un campo unico («esami/<id>/programma»): se due
// computer lo cambiano insieme, vince l'ultimo (domande ed esiti compresi).
import { D, salva, id, oggi, piuGiorni, giorniTra, norm, lezioni, chiaveDef } from './dati.js';
import { elenco } from './lingua.js';

/* ---------- parole: le stesse regole di ai.js (dalMateriale), in piccolo ---------- */
const piana = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const VUOTE = new Set('della delle dello degli nella nelle nello negli sulla sulle sullo dalla dalle alla alle allo agli questo questa questi queste quello quella quelli anche come quando perche molto sempre tutto tutti tutte ogni caso casi cosa cose loro sono essere fare nell dell sull dall quell uguale cioe ovvero oppure mediante attraverso relativ relativa relativo relative relativi principali principale elementi elementari generale generali cenni nozioni introduzione parte prima seconda terza'.split(' '));
// parole che da sole non dicono di che argomento si parla («Teorema di Green»: conta Green)
const GENERICHE = new Set('teorema teoremi definizione definizioni enunciato enunciati dimostrazione dimostrazioni proprieta formula formule concetto concetti regola regole metodo metodi criterio criteri esempio esempi esercizi esercizio applicazioni applicazione calcolo studio analisi teoria problemi problema'.split(' '));
const radice = w => w.length <= 5 ? w : w.slice(0, Math.max(5, Math.ceil(w.length * .6)));
const piene = s => piana(s).split(/[^a-z0-9]+/).filter(w => (w.length >= 4 || /\d/.test(w)) && !VUOTE.has(w));
// le parole che identificano un argomento: quelle piene meno le generiche (se restano solo generiche, tutte)
export function chiavi(t) { const p = [...new Set(piene(t))], s = p.filter(w => !GENERICHE.has(w)); return s.length ? s : p; }
// quanto un testo parla di un argomento: la parte delle sue parole chiave che il testo contiene (con la radice)
export function quanto(argomento, testo) {
  const k = chiavi(argomento), t = ' ' + piana(testo).replace(/[^a-z0-9]+/g, ' ') + ' ';
  if (!k.length) return 0;
  return k.filter(w => t.includes(' ' + radice(w))).length / k.length;
}
const parla = (a, testo) => quanto(a.t, testo) >= (chiavi(a.t).length >= 3 ? .6 : .5) || (a.sotto || []).some(s => quanto(s, testo) >= .75);

/* ---------- leggere il programma (senza AI) ---------- */
const STOP = /^(?:testi?(?: consigliati| di riferimento| adottati)?|bibliografia|libri|materiale didattico|modalit[aà]|metodi didattici|prerequisit|obiettivi|risultati (?:di )?apprendimento|orario|ricevimento|propedeuticit|frequenza|valutazione|esame)\b/i;
const INIZIO = /^(?:programma(?: del corso| dettagliato| d'esame)?|contenuti(?: del corso)?|argomenti(?: del corso| trattati)?|syllabus)\s*:?\s*$/i;
const PUNTO = /^\s*(?:[-–—•*▪◦·]|\(?\d{1,2}(?:\.\d{1,2})*[.)]|\(?[a-z][.)]|[ivx]{1,5}[.)]|(?:capitolo|modulo|parte|unit[aà]|lezione|tema)\s+\w+\s*[:.\-–]?)\s+/i;
const pulisciT = s => String(s).replace(/\(\s*\d+\s*(?:ore|h|cfu)\s*\)/gi, '').replace(/\s+/g, ' ').replace(/^[\s:;,.–—-]+|[\s:;,.–—-]+$/g, '').trim();
const maiuscola = t => t.replace(/^\p{Ll}/u, c => c.toUpperCase());
// «Il corso tratta:», «Il corso si articola nei seguenti argomenti:»: la frase d'apertura non è un argomento
const APERTURA = /^[^:;]{0,80}?\b(?:tratta|affronta|comprende|riguarda|articola|prevede|verte|seguenti|introduce)\b[^:;]{0,60}:\s*/i;
const ok = t => t.length >= 3 && t.length <= 160 && piene(t).length > 0 && !INIZIO.test(t) && !/^(?:programma|argomenti|contenuti)$/i.test(t);
// un pezzo di programma → {t, sotto}: «Derivate: definizione, regole, teoremi di Rolle e Lagrange» → t «Derivate», sotto [...]
function argomentoDa(pezzo) {
  const x = pulisciT(pezzo); if (!x) return null;
  const m = x.match(/^([^:]{3,80}):\s*(.+)$/);
  if (m) return { t: maiuscola(pulisciT(m[1])), sotto: m[2].split(/\s*[;,]\s*|\.\s+/).map(pulisciT).filter(ok).slice(0, 12) };
  // «Curve e integrali di linea; forme differenziali; teorema di Green»: il primo pezzo è l'argomento, gli altri le sue voci
  const p = x.split(/\s*;\s*/).map(pulisciT).filter(Boolean);
  if (p.length >= 2) return { t: maiuscola(p[0]), sotto: p.slice(1).filter(ok).slice(0, 12) };
  return { t: maiuscola(x.length > 90 ? x.slice(0, 90).replace(/\s+\S*$/, '') + '…' : x), sotto: [] };
}
export function leggiProgramma(testo) {
  let righe = String(testo || '').replace(/\r/g, '').split('\n').map(r => r.trim());
  // se c'è un titolo «Programma» / «Contenuti», si parte da lì; ci si ferma ai testi, alle modalità d'esame…
  const i = righe.findIndex(r => INIZIO.test(r.replace(/[#*_]/g, '').trim()));
  if (i >= 0) righe = righe.slice(i + 1);
  const fine = righe.findIndex((r, k) => k > 0 && STOP.test(r.replace(/[#*_]/g, '').trim()) && r.length < 60);
  if (fine > 0) righe = righe.slice(0, fine);
  righe = righe.map(r => r.replace(/^#+\s*/, '').replace(/\*\*/g, '')).filter(Boolean);
  const out = [];
  const conPunti = righe.filter(r => PUNTO.test(r)).length >= 2;
  if (conPunti) {
    // ogni riga col numero o il trattino apre un argomento; le righe senza segno lo continuano
    let cur = null;
    for (const r of righe) {
      if (PUNTO.test(r)) { if (cur) out.push(cur); cur = r.replace(PUNTO, ''); }
      else if (cur) cur += ' ' + r;
    }
    if (cur) out.push(cur);
  } else {
    // un paragrafo unico (spesso nelle schede dei corsi): si divide sui punti e virgola, poi sulle frasi
    const tutto = righe.join(' ').replace(APERTURA, '');
    const parti = tutto.split(/\s*;\s*/).length >= 3 ? tutto.split(/\s*;\s*/) : righe.length >= 3 ? righe : tutto.split(/(?<=[a-zà-ù)\]])\.\s+(?=[A-ZÀ-Ù])/);
    out.push(...parti);
  }
  const visti = new Set(), argomenti = [];
  for (const p of out) {
    const a = argomentoDa(p); if (!a || !ok(a.t)) continue;
    const k = norm(a.t); if (visti.has(k)) continue; visti.add(k);
    argomenti.push(a);
  }
  return argomenti.slice(0, 40);
}

/* ---------- le domande uscite agli appelli ---------- */
// una per riga (o separate da «?»): numeri, trattini e «Domanda:» si tolgono; le domande uguali si contano
export function leggiDomande(testo) {
  const righe = String(testo || '').replace(/\r/g, '').split('\n').flatMap(r => r.split(/(?<=\?)\s+(?=\S)/));
  const out = new Map();
  for (const r of righe) {
    const t = r.replace(PUNTO, '').replace(/^(?:domanda|d)\s*\d*\s*[:.)-]\s*/i, '').replace(/\s+/g, ' ').trim();
    if (t.length < 8 || piene(t).length < 1 || (!/\?$/.test(t) && piene(t).length < 2)) continue;
    const k = norm(t); out.set(k, { t: out.get(k)?.t || t, n: (out.get(k)?.n || 0) + 1 });
  }
  return [...out.values()];
}
// l'argomento del programma di cui parla un testo (una domanda, l'argomento dell'orale), o null
export function abbina(testo, argomenti) {
  let migliore = null, punti = 0;
  for (const a of argomenti || []) {
    const q = Math.max(quanto(a.t, testo), ...(a.sotto || []).map(s => quanto(s, testo) * .9));
    if (q > punti) { migliore = a; punti = q; }
  }
  return punti >= .5 ? migliore : null;
}

/* ---------- salvare ---------- */
export const programmaDi = e => e?.programma?.argomenti?.length ? e.programma : null;
// il programma nuovo prende il posto del vecchio, ma gli argomenti con lo stesso nome tengono domande ed esiti
export function impostaProgramma(e, argomenti, { fonte = '' } = {}) {
  const vecchi = new Map((e.programma?.argomenti || []).map(a => [norm(a.t), a]));
  const altre = (e.programma?.argomenti || []).flatMap(a => vecchi.has(norm(a.t)) && argomenti.some(x => norm(x.t) === norm(a.t)) ? [] : a.domande || []);
  e.programma = {
    argomenti: argomenti.map(a => { const v = vecchi.get(norm(a.t)); return { id: v?.id || id(), t: a.t, sotto: a.sotto || [], domande: v?.domande || [], esiti: v?.esiti || [] }; }),
    senza: [...(e.programma?.senza || [])], fonte: String(fonte || '').slice(0, 120), agg: oggi(),
  };
  if (altre.length) aggiungiDomande(e, altre.map(d => d.t), { conta: altre.map(d => d.n) });
  salva(); return e.programma;
}
// le domande vanno sotto il loro argomento; quelle che non si capisce di cosa parlano restano «senza argomento»
export function aggiungiDomande(e, domande, { conta = [] } = {}) {
  const p = e.programma ||= { argomenti: [], senza: [], fonte: '', agg: oggi() };
  p.senza ||= [];
  let messe = 0, senza = 0;
  domande.forEach((t, i) => {
    const n = conta[i] || 1, a = abbina(t, p.argomenti), dove = a ? (a.domande ||= []) : p.senza;
    const g = dove.find(x => norm(x.t) === norm(t));
    if (g) g.n += n; else dove.push({ t, n });
    a ? messe++ : senza++;
  });
  salva(); return { messe, senza };
}
// l'esito di un'interrogazione (o di «te lo spiego io») su un argomento: resta nella sua storia (le ultime 8)
export function registraEsito(e, argomentoId, esito, fonte = 'orale') {
  const a = e?.programma?.argomenti?.find(x => x.id === argomentoId); if (!a) return null;
  a.esiti = [...(a.esiti || []), { g: oggi(), e: esito, f: fonte }].slice(-8);
  salva(); return a;
}

/* ---------- la mappa: quanto hai coperto ogni argomento ---------- */
// 0 mai toccato · 1 ci sono appunti o carte, ma non l'hai mai provato · 2 in allenamento · 3 sicuro
export const STATI = elenco('programma.stati');
export function materialeDi(e) {
  const corso = norm(e.nome), lez = lezioni().filter(l => norm(l.corso) === corso);
  return {
    definizioni: lez.flatMap(l => (l.definizioni || []).map(d => ({ testo: `${d.t}: ${d.d}`, t: d.t, m: D.memoria[chiaveDef(l.corso, d.t)] || null }))),
    stelle: lez.flatMap(l => (l.stelle || []).map(s => String(s).replace(/^\d\d:\d\d\s*/, ''))),
    carte: D.carte.filter(c => c.esameId === e.id),
  };
}
export function copertura(e, mat = materialeDi(e)) {
  const T = oggi();
  return (e.programma?.argomenti || []).map(a => {
    const defs = mat.definizioni.filter(d => parla(a, d.testo)), stelle = mat.stelle.filter(s => parla(a, s)), carte = mat.carte.filter(c => parla(a, c.fronte + ' ' + c.retro));
    const provate = defs.filter(d => d.m && d.m.giuste > 0).length + carte.filter(c => c.rip >= 1).length;
    const solide = defs.filter(d => d.m && d.m.giuste >= 2 && d.m.rip >= 1).length + carte.filter(c => c.rip >= 2).length;
    const ultimo = (a.esiti || []).at(-1), vecchio = ultimo ? giorniTra(ultimo.g, T) : 99;
    let stato = defs.length || stelle.length || carte.length ? 1 : 0, debole = false;
    if (provate) stato = 2;
    if (solide >= 2 && solide >= (defs.length + carte.length) / 2) stato = 3;
    if (ultimo) {
      if (ultimo.e === 'giusta') stato = vecchio <= 21 ? 3 : Math.max(stato, 2);
      else if (ultimo.e === 'parziale') stato = 2;
      else { stato = 1; debole = true; }
    }
    const domande = (a.domande || []).reduce((s, d) => s + (d.n || 1), 0);
    return { a, stato, debole, domande, stelle: stelle.length, appunti: defs.length + stelle.length, carte: carte.length, provate, oggi: (a.esiti || []).some(x => x.g === T) };
  });
}
// un numero per la barra: quanto del programma è pronto (sicuro conta 1, in allenamento ½, appunti ¼)
export const pronto = cop => cop.length ? cop.reduce((s, c) => s + [0, .25, .5, 1][c.stato], 0) / cop.length : 0;

/* ---------- il piano fino all'appello ---------- */
// priorità: quanto sei indietro, quante volte è uscito, se il prof l'ha detto «da esame», se l'ultima volta è andata male
export const priorita = c => (3 - c.stato) * 2 + Math.min(c.domande, 5) * 1.2 + (c.stelle ? 1 : 0) + (c.debole ? 2 : 0);
export function piano(e, cop = copertura(e), T = oggi()) {
  const conData = !!(e.data && e.data > T), giorni = conData ? giorniTra(T, e.data) : 14;
  const lista = [];
  for (let k = 0; k < giorni; k++) lista.push({ data: piuGiorni(T, k), tipo: 'studio', studia: [], ripassa: [] });
  // l'ultimo giorno prima dell'esame: ripasso generale (le domande uscite, i punti deboli), niente cose nuove
  if (conData) lista.at(-1).tipo = 'generale';
  // un giorno cuscinetto per gli imprevisti, se c'è tempo
  if (giorni >= 9) lista[Math.floor(giorni * .7)].tipo = 'cuscinetto';
  const lavoro = lista.filter(g => g.tipo === 'studio');
  if (!lavoro.length) {   // l'esame è domani (o oggi): solo il ripasso generale
    if (lista[0]) lista[0].ripassa = [...cop].sort((x, y) => priorita(y) - priorita(x)).filter(c => c.stato < 3 || c.domande).slice(0, 6).map(c => c.a.id);
    return { giorni: lista, oggi: lista[0] || null, conData };
  }
  const ordinati = [...cop].sort((x, y) => priorita(y) - priorita(x)), W = lavoro.length;
  const pausa = W >= 6 ? 2 : 1;   // un argomento nuovo si riprende dopo un paio di giorni, non il giorno dopo
  // quante volte torna ogni argomento: nuovo → studio, ripasso dopo «pausa» giorni, secondo ripasso dopo il triplo
  // (se ci sta prima del ripasso generale); in allenamento → un ripasso; sicuro → solo nel ripasso generale
  const passaggi = c => c.stato <= 1 ? [0, pausa, pausa * 3].filter(d => d < W) : c.stato === 2 ? [0] : [];
  const cap = Math.max(1, Math.ceil(ordinati.reduce((s, c) => s + passaggi(c).length, 0) / W));
  const carico = g => g.studia.length + g.ripassa.length;
  // prima si mettono in calendario tutti gli argomenti (i più urgenti per primi), poi i loro ripassi: così un argomento
  // nuovo non aspetta che i ripassi degli altri abbiano riempito la prima settimana
  const primo = new Map();
  for (const c of ordinati) {
    if (!passaggi(c).length) continue;
    let k = lavoro.findIndex(g => carico(g) < cap); if (k < 0) k = lavoro.findIndex(g => carico(g) < cap + 1); if (k < 0) continue;
    (c.stato <= 1 ? lavoro[k].studia : lavoro[k].ripassa).push(c.a.id); primo.set(c.a.id, k);
  }
  for (const c of ordinati) {
    let prima = primo.get(c.a.id); if (prima == null) continue;
    for (const dopo of passaggi(c).slice(1)) {
      const k = lavoro.findIndex((g, i) => i >= prima + Math.max(pausa, dopo - (prima - primo.get(c.a.id))) && carico(g) < cap);
      if (k < 0) break;
      lavoro[k].ripassa.push(c.a.id); prima = k;
    }
  }
  // i giorni rimasti vuoti: un ripasso degli argomenti meno sicuri, a rotazione (mai due giorni di fila lo stesso).
  // g.giro dice quali sono: il piano per chi lavora (ore.js) li toglie per primi quando il tempo non basta
  const giro = ordinati.filter(c => c.stato < 3 || c.domande);
  let r = 0;
  lavoro.forEach((g, i) => {
    if (carico(g) || !giro.length) return;
    for (let t = 0; t < giro.length; t++) {
      const c = giro[(r + t) % giro.length];
      if (!lavoro[i - 1]?.ripassa.includes(c.a.id) && !lavoro[i - 1]?.studia.includes(c.a.id)) { g.ripassa.push(c.a.id); g.giro = [c.a.id]; r = (r + t + 1) % giro.length; break; }
    }
  });
  const gen = lista.find(g => g.tipo === 'generale');
  if (gen) gen.ripassa = ordinati.filter(c => c.domande || c.debole || c.stato < 3).slice(0, 8).map(c => c.a.id);
  return { giorni: lista, oggi: lista[0], conData };
}
// gli argomenti di oggi, con la loro copertura (prima quelli da studiare)
export function oggiDi(e) {
  if (!programmaDi(e)) return null;
  const cop = copertura(e), p = piano(e, cop), per = new Map(cop.map(c => [c.a.id, c]));
  const g = p.oggi; if (!g) return null;
  return { tipo: g.tipo, studia: g.studia.map(i => per.get(i)).filter(Boolean), ripassa: g.ripassa.map(i => per.get(i)).filter(Boolean), cop, piano: p };
}
// il materiale di un argomento per l'interrogazione: le sue definizioni, ★, carte e le domande uscite
export function materialeArgomento(e, a, mat = materialeDi(e)) {
  const righe = [
    ...mat.definizioni.filter(d => parla(a, d.testo)).map(d => `– ${d.testo}`),
    ...mat.stelle.filter(s => parla(a, s)).map(s => `– ★ ${s}`),
    ...mat.carte.filter(c => parla(a, c.fronte + ' ' + c.retro)).map(c => `– ${c.fronte} → ${c.retro}`),
  ];
  return [`Argomento del programma: ${a.t}${a.sotto?.length ? ` (${a.sotto.join(', ')})` : ''}`, righe.length ? righe.join('\n') : '',
    a.domande?.length ? `Domande uscite agli appelli su questo argomento:\n${a.domande.map(d => `– ${d.t}${d.n > 1 ? ` (${d.n} volte)` : ''}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
}

/* ---------- «te lo spiego io»: lo studente spiega un argomento, Lode controlla cosa ha detto (senza AI) ---------- */
// i punti da toccare: le voci del programma per quell'argomento e i termini delle definizioni delle lezioni che ne parlano.
// Un punto è detto se la spiegazione ne contiene quasi tutte le parole chiave (con la radice: «differenziabile» ~ «differenziabilità»)
export function puntiDi(e, a, mat = materialeDi(e)) {
  const visti = new Set(), out = [];
  // «punti di sella» e «Punto di sella» sono lo stesso punto: si confrontano le parole chiave con la radice
  const metti = (t, d = '') => { const k = norm(t); if (!k || visti.has(k) || !chiavi(t).length || out.some(p => quanto(p.t, t) >= .99 && quanto(t, p.t) >= .99)) return; visti.add(k); out.push({ t, d }); };
  (a.sotto || []).forEach(s => metti(s));
  mat.definizioni.filter(d => parla(a, d.testo)).forEach(d => metti(d.t, d.testo));
  return out.slice(0, 12);
}
export function controllaSpiegazione(e, a, testo, mat = materialeDi(e)) {
  const punti = puntiDi(e, a, mat).map(p => ({ ...p, detto: quanto(p.t, testo) >= (chiavi(p.t).length >= 3 ? .67 : .99) }));
  if (!punti.length) return null;
  const quota = punti.filter(p => p.detto).length / punti.length, parole = piene(testo).length;
  const esito = parole < 6 ? 'non so' : quota >= .7 ? 'giusta' : quota >= .3 ? 'parziale' : 'sbagliata';
  return { punti, quota, esito };
}
