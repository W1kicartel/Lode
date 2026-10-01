// I dati di Lode: nel browser (localStorage) oppure, nell'app desktop, dentro il vault Obsidian (.lode/dati.json).
// Niente account, niente server. La chiave AI non va mai nel vault (i vault si sincronizzano): resta in questo computer.
// Esami e voti, sessioni di studio, carte del ripasso, impostazioni. Più i conti che servono a uno studente:
// media ponderata, base di laurea, voto che serve, ore da fare oggi, ripasso a intervalli (SM-2).
const CHIAVE = 'lode:v1';
export const VUOTO = () => ({
  v: 1,
  profilo: { nome: '', corso: '', cfuTotali: 180, lode: 30 },
  esami: [],      // {id, nome, cfu, data, voto, lode, idoneita, fatto, oreObiettivo}
  sessioni: [],   // {id, esameId, inizio, min}
  carte: [],      // {id, esameId, fronte, retro, ease, int, rip, scad, creata}
  orario: [],     // {id, corso, giorni:[0-6], inizio:'09:00', fine:'11:00', aula}
  lezioni: [],    // solo nel browser: {id, corso, data, inizio, fine, aula, definizioni:[{t,d}], stelle:[], domande:[]} (nell'app stanno nel vault)
  memoria: {},    // definizioni ripassate: chiave → {ease, int, rip, scad, giuste, sbagliate, ultima}
  imp: { focus: 25, pausa: 5, voceAlta: false, chiave: '', aspetto: 'scuro', suoni: true, suggerimenti: true, ultimoSuggerimento: 0 },
  benvenuto: false,
});

export const DESKTOP = typeof window !== 'undefined' && !!window.lodeDesktop;
const chiaveLocale = () => { try { return localStorage.getItem('lode:chiave') || ''; } catch { return ''; } };
function unisci(d) { return d && d.v === 1 ? { ...VUOTO(), ...d, profilo: { ...VUOTO().profilo, ...d.profilo }, imp: { ...VUOTO().imp, ...d.imp } } : null; }
function carica() {
  let d = null;
  try { d = unisci(DESKTOP ? window.lodeDesktop.leggiDati() : JSON.parse(localStorage.getItem(CHIAVE))); } catch { }
  d ||= VUOTO();
  if (DESKTOP) d.imp.chiave = chiaveLocale();
  return d;
}
export let D = carica();
export function salva() {
  try {
    if (DESKTOP) {
      const c = { ...D, imp: { ...D.imp, chiave: '' } };
      window.lodeDesktop.salvaDati(c);
      localStorage.setItem('lode:chiave', D.imp.chiave || '');
    } else localStorage.setItem(CHIAVE, JSON.stringify(D));
  } catch (e) { console.warn('Lode: salvataggio non riuscito', e); }
  dispatchEvent(new CustomEvent('lode:dati'));
}
// un'altra finestra dell'app (o un altro computer, via vault sincronizzato) ha cambiato i dati
if (DESKTOP) window.lodeDesktop.su('dati:cambiati', d => { const n = unisci(d); if (!n) return; n.imp.chiave = D.imp.chiave; D = n; dispatchEvent(new CustomEvent('lode:dati')); });
export function sostituisci(nuovi) { D = { ...VUOTO(), ...nuovi, profilo: { ...VUOTO().profilo, ...nuovi.profilo }, imp: { ...VUOTO().imp, ...nuovi.imp, chiave: D.imp.chiave } }; salva(); }
// la chiave AI non esce mai in un'esportazione
export function esporta() { const c = structuredClone(D); c.imp.chiave = ''; return c; }
// in ascolto da altre schede dello stesso browser
addEventListener('storage', e => { if (e.key === CHIAVE && !DESKTOP) { D = carica(); dispatchEvent(new CustomEvent('lode:dati')); } });

export const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const oggi = () => isoGiorno(new Date());
export function isoGiorno(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
export function piuGiorni(iso, n) { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoGiorno(d); }
export const giorniTra = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
export const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const dataLunga = iso => { const d = new Date(iso + 'T12:00'); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
export const dataBreve = iso => { const d = new Date(iso + 'T12:00'); return `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)}`; };
export function traQuanto(iso) {
  const n = giorniTra(oggi(), iso);
  return n < 0 ? 'passato' : n === 0 ? 'oggi' : n === 1 ? 'domani' : `tra ${n} giorni`;
}
export const num = (x, dec = 1) => Number(x).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const ore = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- esami ---------- */
export const esame = id => D.esami.find(e => e.id === id);
export const fatti = () => D.esami.filter(e => e.fatto);
export const daFare = () => D.esami.filter(e => !e.fatto);
export const prossimi = () => daFare().filter(e => e.data && e.data >= oggi()).sort((a, b) => a.data.localeCompare(b.data));
// trova un esame dal nome detto o scritto («analisi», «analisi 2», «fisica uno»)
export function trovaEsame(testo, { anche = 'tutti' } = {}) {
  const q = norm(testo).replace(/\buno\b/g, '1').replace(/\bdue\b/g, '2').replace(/\btre\b/g, '3');
  if (!q) return null;
  const lista = anche === 'daFare' ? daFare() : D.esami;
  let migliore = null, punti = 0;
  for (const e of lista) {
    const n = norm(e.nome);
    let p = n === q ? 100 : n.startsWith(q) ? 80 : n.includes(q) ? 60 : 0;
    if (!p) { const parole = q.split(' '); const tutte = parole.every(w => n.split(' ').some(x => x.startsWith(w))); if (tutte) p = 50; }
    if (!p && sigla(e.nome) === q.replace(/ /g, '')) p = 55;
    if (p > punti || (p === punti && p && !e.fatto && migliore?.fatto)) { migliore = e; punti = p; }
  }
  return migliore;
}
const sigla = s => norm(s).split(' ').filter(w => w.length > 2 || /\d/.test(w)).map(w => /\d/.test(w) ? w : w[0]).join('');
export function aggiungiEsame({ nome, cfu = 6, data = null, voto = null, lode = false, idoneita = false }) {
  const e = { id: id(), nome: String(nome).trim().replace(/^./, c => c.toUpperCase()), cfu: Number(cfu) || 6, data, voto, lode: !!lode, idoneita: !!idoneita, fatto: voto != null || false, oreObiettivo: null };
  D.esami.push(e); salva(); return e;
}
export function registraVoto(esameId, { voto, lode = false, idoneita = false, data = oggi() }) {
  const e = esame(esameId); if (!e) return null;
  Object.assign(e, { voto: idoneita ? null : voto, lode: !!lode && voto === 30, idoneita: !!idoneita, fatto: true, data });
  salva(); return e;
}

/* ---------- media e laurea ---------- */
const valore = e => e.lode ? Number(D.profilo.lode || 30) : e.voto;
export function media(lista = fatti()) {
  const conVoto = lista.filter(e => e.voto != null && !e.idoneita);
  const cfu = conVoto.reduce((s, e) => s + e.cfu, 0);
  if (!conVoto.length) return { ponderata: null, aritmetica: null, base: null, cfuVoto: 0, somma: 0, n: 0 };
  const somma = conVoto.reduce((s, e) => s + valore(e) * e.cfu, 0);
  const ponderata = somma / cfu, aritmetica = conVoto.reduce((s, e) => s + valore(e), 0) / conVoto.length;
  return { ponderata, aritmetica, base: ponderata * 110 / 30, cfuVoto: cfu, somma, n: conVoto.length };
}
export const cfuFatti = () => fatti().reduce((s, e) => s + e.cfu, 0);
// che media serve nei CFU che mancano per arrivare a una base di partenza (es. 100/110)
export function serve(baseObiettivo) {
  const m = media(), mancano = Math.max(0, (D.profilo.cfuTotali || 180) - cfuFatti() - 6); // 6 CFU circa di prova finale, senza voto
  if (!mancano) return null;
  const mediaObiettivo = baseObiettivo * 30 / 110;
  const v = (mediaObiettivo * (m.cfuVoto + mancano) - m.somma) / mancano;
  return { voto: v, cfu: mancano, possibile: v <= 30, gia: v < 18 };
}
// se prendo X in quell'esame, come cambia la media?
export function simula(esameId, voto, lode = false) {
  const e = esame(esameId); if (!e) return null;
  const finto = { ...e, voto, lode: lode && voto === 30, idoneita: false, fatto: true };
  const lista = [...fatti().filter(x => x.id !== e.id), finto];
  const prima = media(), dopo = media(lista);
  return { prima, dopo, delta: prima.ponderata == null ? null : dopo.ponderata - prima.ponderata };
}

/* ---------- studio ---------- */
export function minuti({ esameId, da, a } = {}) {
  return D.sessioni.filter(s => (!esameId || s.esameId === esameId) && (!da || isoGiorno(s.inizio) >= da) && (!a || isoGiorno(s.inizio) <= a)).reduce((t, s) => t + s.min, 0);
}
export function registraSessione(esameId, min, inizio = Date.now()) {
  if (min < 1) return null;
  const s = { id: id(), esameId: esameId || null, inizio, min: Math.round(min) }; D.sessioni.push(s); salva(); return s;
}
export function settimana() {
  const T = oggi(), giorni = [];
  for (let i = 6; i >= 0; i--) { const g = piuGiorni(T, -i); giorni.push({ g, min: minuti({ da: g, a: g }), oggi: g === T }); }
  return giorni;
}
// giorni di fila con almeno 25 minuti di studio (oggi conta se c'è già, altrimenti si parte da ieri)
export function serie() {
  let n = 0, g = oggi();
  if (minuti({ da: g, a: g }) < 25) g = piuGiorni(g, -1);
  while (minuti({ da: g, a: g }) >= 25) { n++; g = piuGiorni(g, -1); }
  return n;
}
// il piano: quante ore servono per ogni esame e quante ne restano da fare oggi per restare in pari
export const obiettivo = e => e.oreObiettivo ?? Math.round(e.cfu * 10);
export function piano(e) {
  const T = oggi(), fatte = minuti({ esameId: e.id }) / 60, oggiFatte = minuti({ esameId: e.id, da: T, a: T }) / 60;
  const tot = obiettivo(e), giorni = e.data ? Math.max(1, giorniTra(T, e.data)) : 30;
  const perGiorno = Math.max(0, tot - (fatte - oggiFatte)) / giorni;
  return { fatte, tot, giorni, perGiorno, oggi: Math.max(0, perGiorno - oggiFatte), quota: Math.min(1, fatte / tot) };
}

/* ---------- ripasso a intervalli (SM-2 semplificato) ---------- */
export const RISPOSTE = [{ q: 0, t: 'Di nuovo', k: '1' }, { q: 3, t: 'Difficile', k: '2' }, { q: 4, t: 'Bene', k: '3' }, { q: 5, t: 'Facile', k: '4' }];
export const daRipassare = (esameId) => D.carte.filter(c => (!esameId || c.esameId === esameId) && c.scad <= oggi());
export function aggiungiCarta({ esameId = null, fronte, retro }) {
  const c = { id: id(), esameId, fronte: String(fronte).trim(), retro: String(retro).trim(), ease: 2.5, int: 0, rip: 0, scad: oggi(), creata: Date.now() };
  D.carte.push(c); return c;
}
export function prossimoIntervallo(c, q) {
  if (q < 3) return 0;
  const rip = c.rip + 1;
  return rip === 1 ? { 3: 1, 4: 2, 5: 4 }[q] : rip === 2 ? { 3: 3, 4: 6, 5: 10 }[q] : Math.max(1, Math.round(c.int * c.ease * (q === 3 ? .8 : q === 5 ? 1.3 : 1)));
}
export function rispondi(c, q) {
  const int = prossimoIntervallo(c, q);
  if (q < 3) { c.rip = 0; c.int = 0; c.scad = oggi(); }
  else { c.rip += 1; c.int = int; c.scad = piuGiorni(oggi(), int); }
  c.ease = Math.max(1.3, c.ease + .1 - (5 - q) * (.08 + (5 - q) * .02));
  salva();
}
export const intervalloTesto = n => n === 0 ? 'ora' : n === 1 ? '1 g' : n < 30 ? `${n} g` : n < 365 ? `${Math.round(n / 30)} mesi` : `${num(n / 365)} anni`;

/* ---------- orario delle lezioni ---------- */
const minutiDi = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const adesso = () => { const d = new Date(); return { g: d.getDay(), m: d.getHours() * 60 + d.getMinutes() }; };
// la lezione in corso (con qualche minuto di margine prima dell'inizio)
export function lezioneOra() {
  const { g, m } = adesso();
  const x = D.orario.find(o => o.giorni.includes(g) && m >= minutiDi(o.inizio) - 3 && m < minutiDi(o.fine));
  return x ? { ...x, data: oggi(), mancano: minutiDi(x.fine) - m, passati: m - minutiDi(x.inizio) } : null;
}
// la prossima lezione di oggi
export function prossimaLezione() {
  const { g, m } = adesso();
  return D.orario.filter(o => o.giorni.includes(g) && minutiDi(o.inizio) > m).map(o => ({ ...o, data: oggi(), tra: minutiDi(o.inizio) - m })).sort((a, b) => a.tra - b.tra)[0] || null;
}
// l'ultima lezione finita (oggi o nei giorni scorsi, fino a una settimana fa)
export function ultimaLezioneFinita() {
  const { g, m } = adesso();
  for (let k = 0; k < 8; k++) {
    const gg = (g - k + 7) % 7, data = piuGiorni(oggi(), -k);
    const l = D.orario.filter(o => o.giorni.includes(gg) && (k > 0 || minutiDi(o.fine) <= m)).sort((a, b) => minutiDi(b.fine) - minutiDi(a.fine))[0];
    if (l) return { ...l, data };
  }
  return null;
}
export function aggiungiOrario({ corso, giorni, inizio, fine, aula = '' }) {
  const o = { id: id(), corso: String(corso).trim().replace(/^./, c => c.toUpperCase()), giorni: [...new Set(giorni)].sort(), inizio, fine, aula: String(aula || '').trim() };
  D.orario.push(o); salva(); return o;
}

/* ---------- lezioni e definizioni (dal vault nell'app, da qui nel browser) ---------- */
let LEZ_VAULT = null;
export function impostaLezioniVault(l) { LEZ_VAULT = l; dispatchEvent(new CustomEvent('lode:lezioni')); }
// nel vault le lezioni vere; quelle salvate qui (esempio, browser) solo se il vault non ha già la stessa lezione
export const lezioni = () => [...(LEZ_VAULT || []), ...D.lezioni.filter(l => !(LEZ_VAULT || []).some(v => norm(v.corso) === norm(l.corso) && v.data === l.data))].filter(l => l.data).sort((a, b) => b.data.localeCompare(a.data) || String(b.inizio || '').localeCompare(String(a.inizio || '')));
export const chiaveDef = (corso, t) => norm(corso) + '|' + norm(t);
// tutte le definizioni con la loro memoria, dalla lezione più recente
export function definizioni({ giorni = 60 } = {}) {
  const da = piuGiorni(oggi(), -giorni), visti = new Set(), out = [];
  for (const l of lezioni()) {
    if (l.data < da) continue;
    for (const d of l.definizioni || []) {
      const k = chiaveDef(l.corso, d.t); if (visti.has(k)) continue; visti.add(k);
      out.push({ ...d, k, corso: l.corso, data: l.data, file: l.file, stella: (l.stelle || []).some(s => norm(s).includes(norm(d.t))), m: D.memoria[k] || null });
    }
  }
  return out;
}
const forza = d => !d.m ? 0 : d.m.giuste / Math.max(1, d.m.giuste + d.m.sbagliate);
// le definizioni da giocare adesso: mai viste o in scadenza, prima quelle dell'ultima lezione e quelle «da esame»
export function daGiocare(n = 6, corso) {
  const T = oggi();
  const tutte = definizioni().filter(d => !corso || norm(d.corso) === norm(corso));
  const pronte = tutte.filter(d => !d.m || d.m.scad <= T);
  pronte.sort((a, b) => b.data.localeCompare(a.data) || (b.stella - a.stella) || (forza(a) - forza(b)));
  return { scelte: pronte.slice(0, n), tutte };
}
export function ricorda(k, ok, q = ok ? 4 : 0) {
  const m = D.memoria[k] ||= { ease: 2.5, int: 0, rip: 0, scad: oggi(), giuste: 0, sbagliate: 0, ultima: null };
  const finta = { ...m };
  if (ok) { m.giuste++; m.int = prossimoIntervallo(finta, q); m.rip++; m.scad = piuGiorni(oggi(), m.int); }
  else { m.sbagliate++; m.rip = 0; m.int = 0; m.scad = piuGiorni(oggi(), 1); }
  m.ease = Math.max(1.3, m.ease + .1 - (5 - q) * (.08 + (5 - q) * .02));
  m.ultima = oggi();
}

/* ---------- dati di esempio: per provare Lode in dieci secondi ---------- */
export function esempio() {
  const T = oggi(), d = VUOTO();
  d.profilo = { nome: 'Giulia', corso: 'Ingegneria informatica', cfuTotali: 180, lode: 30 };
  d.benvenuto = true; d.imp = { ...D.imp };
  const E = (nome, cfu, voto, lode, giorniFa) => ({ id: id(), nome, cfu, voto, lode, idoneita: voto == null, fatto: true, data: piuGiorni(T, -giorniFa), oreObiettivo: null });
  d.esami = [
    E('Analisi 1', 9, 27, false, 300), E('Fondamenti di informatica', 9, 30, true, 290), E('Geometria e algebra lineare', 6, 24, false, 250),
    E('Fisica 1', 9, 26, false, 160), E('Lingua inglese B2', 3, null, false, 150), E('Programmazione a oggetti', 6, 29, false, 140),
    { id: id(), nome: 'Analisi 2', cfu: 9, data: piuGiorni(T, 12), voto: null, lode: false, idoneita: false, fatto: false, oreObiettivo: 90 },
    { id: id(), nome: 'Basi di dati', cfu: 9, data: piuGiorni(T, 26), voto: null, lode: false, idoneita: false, fatto: false, oreObiettivo: null },
    { id: id(), nome: 'Fisica 2', cfu: 6, data: piuGiorni(T, 41), voto: null, lode: false, idoneita: false, fatto: false, oreObiettivo: null },
  ];
  const an2 = d.esami[6].id, bd = d.esami[7].id;
  const ora = new Date(); ora.setHours(10, 0, 0, 0);
  [[an2, [50, 75, 0, 100, 50, 125, 25]], [bd, [25, 0, 50, 0, 25, 0, 0]]].forEach(([e, mins]) => mins.forEach((m, i) => { if (m) d.sessioni.push({ id: id(), esameId: e, inizio: ora.getTime() - (6 - i) * 864e5 + (e === bd ? 6 * 36e5 : 0), min: m }); }));
  for (let i = 0; i < 18; i++) d.sessioni.push({ id: id(), esameId: an2, inizio: ora.getTime() - (8 + i) * 864e5, min: 100 });
  const C = (fronte, retro, scadFra, esameId = an2) => ({ id: id(), esameId, fronte, retro, ease: 2.5, int: Math.max(0, scadFra), rip: scadFra > 0 ? 2 : 0, scad: piuGiorni(T, scadFra), creata: Date.now() });
  d.carte = [
    C('Che cos\'è il gradiente di f(x, y)?', 'Il vettore delle derivate parziali (∂f/∂x, ∂f/∂y): punta nella direzione di massima crescita.', 0),
    C('Enuncia il teorema di Schwarz', 'Se le derivate seconde miste sono continue in un intorno, allora f_xy = f_yx.', 0),
    C('Condizione per un punto stazionario', 'Il gradiente si annulla: ∇f(x₀) = 0.', 0),
    C('Come si classifica un punto stazionario?', 'Con la matrice hessiana: definita positiva → minimo, definita negativa → massimo, indefinita → sella.', 0),
    C('Che cos\'è un integrale doppio su un dominio normale?', 'Un integrale iterato: prima sulla variabile «interna» con estremi funzione dell\'altra, poi sull\'altra.', 0),
    C('Teorema di Green: enunciato', 'L\'integrale di linea su ∂D di P dx + Q dy è uguale all\'integrale doppio su D di (∂Q/∂x − ∂P/∂y).', 0),
    C('Forma differenziale esatta: definizione', 'ω è esatta se esiste una funzione U (potenziale) con dU = ω.', 1),
    C('Serie geometrica: quando converge?', 'Per |q| < 1, con somma 1/(1 − q).', 3),
    C('Che cos\'è una chiave primaria?', 'Un insieme minimo di attributi che identifica in modo univoco ogni tupla di una relazione.', 0, bd),
    C('Differenza tra LEFT JOIN e INNER JOIN', 'La LEFT JOIN tiene tutte le righe della tabella di sinistra, anche senza corrispondenze (con NULL); la INNER solo le coppie che combaciano.', 0, bd),
    C('Che cosa garantisce la 3ª forma normale?', 'Che ogni attributo non chiave dipenda dalla chiave, da tutta la chiave e da nient\'altro che la chiave (niente dipendenze transitive).', 2, bd),
  ];
  const dow = new Date(T + 'T12:00').getDay(), ieri = piuGiorni(T, -1);
  d.orario = [
    { id: id(), corso: 'Analisi 2', giorni: [...new Set([1, 3, dow])].sort(), inizio: '09:00', fine: '11:00', aula: '7' },
    { id: id(), corso: 'Basi di dati', giorni: [...new Set([2, (dow + 6) % 7])].sort(), inizio: '14:00', fine: '16:00', aula: 'B2' },
    { id: id(), corso: 'Fisica 2', giorni: [5], inizio: '11:00', fine: '13:00', aula: 'Magna' },
  ];
  d.lezioni = [
    { id: id(), corso: 'Analisi 2', data: T, inizio: '09:00', fine: '11:00', aula: '7', domande: ['Perché nel teorema di Schwarz serve la continuità delle derivate miste?'],
      stelle: ['Il teorema di Green all\'esame lo chiede sempre, con la dimostrazione', 'Classificare i punti stazionari con l\'hessiana: esercizio sicuro'],
      definizioni: [
        { t: 'Gradiente', d: 'Il vettore delle derivate parziali di f: punta nella direzione di massima crescita.' },
        { t: 'Punto stazionario', d: 'Un punto in cui il gradiente della funzione si annulla.' },
        { t: 'Matrice hessiana', d: 'La matrice quadrata delle derivate seconde parziali di una funzione.' },
        { t: 'Punto di sella', d: 'Un punto stazionario che non è né di massimo né di minimo locale: l\'hessiana è indefinita.' },
        { t: 'Teorema di Green', d: 'Lega l\'integrale di linea lungo il bordo di un dominio all\'integrale doppio sul dominio.' },
        { t: 'Forma differenziale esatta', d: 'Una forma che ammette un potenziale, cioè è il differenziale di una funzione.' },
      ] },
    { id: id(), corso: 'Basi di dati', data: ieri, inizio: '14:00', fine: '16:00', aula: 'B2', domande: [], stelle: ['Normalizzazione fino alla BCNF: c\'è sempre nello scritto'],
      definizioni: [
        { t: 'Chiave primaria', d: 'Un insieme minimo di attributi che identifica in modo univoco ogni tupla.' },
        { t: 'Chiave esterna', d: 'Un attributo che fa riferimento alla chiave primaria di un\'altra relazione.' },
        { t: 'Dipendenza funzionale', d: 'Un vincolo per cui il valore di un insieme di attributi determina quello di un altro.' },
        { t: 'Forma normale di Boyce-Codd', d: 'Ogni dipendenza funzionale non banale ha a sinistra una superchiave.' },
      ] },
  ];
  return d;
}
