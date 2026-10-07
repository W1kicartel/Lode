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
  // informatica (js/codice/): esercizi «Cosa stampa?» (SM-2 a parte), errori contati, eventi per il diario, opzioni dei progetti.
  // Una chiave a sé: pulisciEsempio() in benvenuto.js azzera D.memoria, non questa. I percorsi dei progetti qui non ci sono mai.
  codice: { memoria: {}, errori: {}, eventi: [], diari: {}, opzioni: {}, turni: [], spiegate: {} },
  imp: { focus: 25, pausa: 5, voceAlta: false, chiave: '', aspetto: 'scuro', suoni: true, suggerimenti: true, ultimoSuggerimento: 0 },
  benvenuto: false,
});

export const DESKTOP = typeof window !== 'undefined' && !!window.lodeDesktop;
const chiaveLocale = () => { try { return localStorage.getItem('lode:chiave') || ''; } catch { return ''; } };
// cfu, voto e ore sempre in forma (un numero, un voto intero 18-30 o null): arrivano anche da un libretto letto dall'AI, da
// un backup o da un dati.json di un vault sincronizzato, e finiscono nelle pagine
const ID = /^[\w-]{1,40}$/, DATA = /^\d{4}-\d{2}-\d{2}$/;
const inForma = e => e && typeof e === 'object' ? { ...e, cfu: Number(e.cfu) || 6, voto: e.voto !== null && e.voto !== '' && Number.isInteger(+e.voto) && +e.voto >= 18 && +e.voto <= 30 ? +e.voto : null,
  ...(e.oreObiettivo != null ? { oreObiettivo: Number(e.oreObiettivo) || null } : {}) } : e;
// i dati di Lode letti dal disco: .lode/dati.json nel vault (che si sincronizza o si condivide: chi può scriverci può
// metterci di tutto) o localStorage nel browser. Non passano da backupValido(), che rifiuterebbe tutto per un solo esame
// storto: qui l'esame con un id strano (virgolette, HTML: finirebbe in un data-e="…") si scarta, gli altri restano
function unisci(d) { return d && d.v === 1 ? { ...VUOTO(), ...d, esami: Array.isArray(d.esami) ? d.esami.filter(e => e && typeof e === 'object' && ID.test(e.id)).map(inForma) : [], profilo: { ...VUOTO().profilo, ...d.profilo }, imp: { ...VUOTO().imp, ...d.imp }, codice: { ...VUOTO().codice, ...d.codice } } : null; }
// Un backup da importare (magari passato da un compagno) si controlla tutto e, se qualcosa non torna, si rifiuta: non si
// «aggiusta», perché rigenerare gli id romperebbe i legami fra carte ed esami. Numeri come numeri (o cifre), id semplici,
// date AAAA-MM-GG, giorni dell'orario 0-6. Poi passa da sostituisci(), che rimette in forma cfu e voti
export function backupValido(d) {
  const ogg = x => !!x && typeof x === 'object' && !Array.isArray(x), testo = x => x == null || typeof x === 'string';
  const numero = x => x == null || x === '' || (typeof x === 'number' || (typeof x === 'string' && /^\d{1,3}$/.test(x))) && Number.isFinite(+x);
  const lista = (x, ok) => x == null || (Array.isArray(x) && x.every(ok));
  const esameOk = e => ogg(e) && ID.test(e.id) && typeof e.nome === 'string' && numero(e.cfu) && numero(e.voto) && (!e.data || DATA.test(e.data)) && numero(e.oreObiettivo);
  const cartaOk = c => ogg(c) && ID.test(c.id) && (!c.esameId || ID.test(c.esameId)) && testo(c.fronte) && testo(c.retro);
  const orarioOk = o => ogg(o) && (o.id == null || ID.test(o.id)) && testo(o.corso) && testo(o.inizio) && testo(o.fine) && testo(o.aula) && Array.isArray(o.giorni) && o.giorni.every(g => Number.isInteger(g) && g >= 0 && g <= 6);
  const sessioneOk = s => ogg(s) && (s.id == null || ID.test(s.id)) && (!s.esameId || ID.test(s.esameId)) && numero(s.min);
  return ogg(d) && d.v === 1 && Array.isArray(d.esami) && d.esami.every(esameOk) && lista(d.carte, cartaOk) && lista(d.orario, orarioOk) && lista(d.sessioni, sessioneOk)
    && (d.profilo == null || (ogg(d.profilo) && testo(d.profilo.nome) && testo(d.profilo.corso) && numero(d.profilo.cfuTotali) && numero(d.profilo.lode))) && (d.imp == null || ogg(d.imp));
}
// i dati non si sono potuti leggere (non «non ci sono»: OneDrive offline, file bloccato): Lode lo dice e non li sovrascrive
export let datiIllegibili = null;
// Con la sincronizzazione accesa (desktop/sincronizza.mjs) i dati arrivano dal diario con una versione (__ver): salva() la
// rimanda, così il main confronta D con la BASE che questa finestra aveva davvero e ne ricava gli eventi (docs/SINCRONIZZAZIONE.md
// §7). OPS: le operazioni che le differenze non sanno dire da sole (il ripasso con la risposta e il giorno, per l'SM-2 di
// js/sm2.js). Con la sincronizzazione spenta VER resta null e tutto va come prima (dati.json intero)
let VER = null;
const OPS = [];
// la forma di D che questa finestra ha mandato (o ricevuto) per ultima. Se D è cambiato da allora senza salva() (il gioco delle
// definizioni e «Cosa stampa?» salvano solo alla fine), prima di sostituirlo con una vista nuova si manda (§7): prima ogni vista
// che arrivava (un altro computer, Orario.md scritto in Obsidian, l'altra finestra) buttava le risposte della sessione
let mandato = null;
const forma = d => { try { return JSON.stringify({ ...d, imp: { ...d.imp, chiave: '' } }); } catch { return null; } };
const prendiVersione = g => { if (g && g.__ver != null) { VER = g.__ver; delete g.__ver; } return g; };
function carica() {
  let d = null;
  try { const g = prendiVersione(DESKTOP ? window.lodeDesktop.leggiDati({ ...VUOTO(), imp: { ...VUOTO().imp, chiave: '' } }) : JSON.parse(localStorage.getItem(CHIAVE))); if (g?.__errore) datiIllegibili = g.__errore; d = unisci(g); } catch { }
  d ||= VUOTO();
  if (DESKTOP) d.imp.chiave = chiaveLocale();
  if (VER != null) mandato = forma(d);
  return d;
}
export let D = carica();
export function salva() {
  try {
    if (DESKTOP) {
      const c = { ...D, imp: { ...D.imp, chiave: '' } };
      window.lodeDesktop.salvaDati(c, VER != null ? { ver: VER, ops: OPS.splice(0) } : undefined);
      if (VER != null) mandato = JSON.stringify(c);
      if (D.imp.chiave) localStorage.setItem('lode:chiave', D.imp.chiave); else localStorage.removeItem('lode:chiave');   // scollegata: niente resta sul disco
    } else localStorage.setItem(CHIAVE, JSON.stringify(D));
  } catch (e) { console.warn('Lode: salvataggio non riuscito', e); }
  dispatchEvent(new CustomEvent('lode:dati'));
}
// un'altra finestra dell'app (o un altro computer, via vault sincronizzato) ha cambiato i dati
if (DESKTOP) window.lodeDesktop.su('dati:cambiati', d => {
  // prima le modifiche fatte qui e non ancora mandate, con la versione che questa finestra aveva (il main le confronta con quella BASE)
  if (VER != null && d?.__ver != null && forma(D) !== mandato) salva();
  const n = unisci(prendiVersione(d)); if (!n) return; n.imp.chiave = D.imp.chiave; D = n; datiIllegibili = null;
  if (VER != null) mandato = forma(D);
  dispatchEvent(new CustomEvent('lode:dati'));
});
// «Annulla» (js/lode.js, istantanea): l'operazione inversa di un comando, solo su quello che il comando ha cambiato.
const copiaJ = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const stessoJ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const conId = a => Array.isArray(a) && a.length > 0 && a.every(r => r && typeof r === 'object' && typeof r.id === 'string');
// p, q: prima e dopo il comando; cur: l'oggetto di adesso, cambiato sul posto. Liste di record per id (creato → via, tolto →
// torna, cambiato → solo i campi cambiati); un valore torna com'era solo se nessuno l'ha cambiato dopo il comando
export function inverti(p, q, cur) {
  if (!cur || typeof cur !== 'object') return;
  for (const k of new Set([...Object.keys(p || {}), ...Object.keys(q || {})])) {
    const a = p?.[k], b = q?.[k];
    if (stessoJ(a, b)) continue;
    if ((conId(a) || conId(b)) && (a === undefined || Array.isArray(a)) && (b === undefined || Array.isArray(b))) {
      const lista = Array.isArray(cur[k]) ? cur[k] : (cur[k] = []);
      const ma = new Map((a || []).map(r => [r.id, r])), mb = new Map((b || []).map(r => [r.id, r]));
      for (const [id, r] of mb) {
        const i = lista.findIndex(x => x?.id === id);
        if (!ma.has(id)) { if (i >= 0) lista.splice(i, 1); } else if (i >= 0) inverti(ma.get(id), r, lista[i]);
      }
      for (const [id, r] of ma) if (!mb.has(id) && !lista.some(x => x?.id === id)) lista.push(copiaJ(r));
      continue;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) { inverti(a, b, cur[k]); continue; }
    if (stessoJ(cur[k], b)) { if (a === undefined) delete cur[k]; else cur[k] = copiaJ(a); }
  }
}

export function sostituisci(nuovi) { D = { ...VUOTO(), ...nuovi, esami: (nuovi.esami || []).map(inForma), profilo: { ...VUOTO().profilo, ...nuovi.profilo }, imp: { ...VUOTO().imp, ...nuovi.imp, chiave: D.imp.chiave }, codice: { ...VUOTO().codice, ...nuovi.codice } }; salva(); }
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
  if (VER != null) OPS.push({ tipo: 'ripasso', carta: c.id, q, giorno: oggi(), ris: { ease: c.ease, int: c.int, rip: c.rip, scad: c.scad } });
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
// nel vault le lezioni vere; quelle salvate qui (esempio, browser) si aggiungono, e se c'è la stessa lezione nel vault
// le loro definizioni, ★ e domande si sommano a quelle della nota
export const lezioni = () => {
  const v = (LEZ_VAULT || []).map(l => ({ ...l }));
  for (const l of D.lezioni) {
    const x = v.find(y => norm(y.corso) === norm(l.corso) && y.data === l.data);
    if (!x) { v.push(l); continue; }
    const ha = new Set((x.definizioni || []).map(d => norm(d.t)));
    x.definizioni = [...(x.definizioni || []), ...(l.definizioni || []).filter(d => !ha.has(norm(d.t)))];
    x.stelle = [...(x.stelle || []), ...(l.stelle || []).filter(s => !(x.stelle || []).includes(s))];
    x.domande = [...(x.domande || []), ...(l.domande || []).filter(s => !(x.domande || []).includes(s))];
  }
  return v.filter(l => l.data).sort((a, b) => b.data.localeCompare(a.data) || String(b.inizio || '').localeCompare(String(a.inizio || '')));
};
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
// mappa: dove tenere i conti. Le definizioni in D.memoria; gli esercizi di «Cosa stampa?» in D.codice.memoria
export function ricorda(k, ok, q = ok ? 4 : 0, mappa = D.memoria) {
  const m = mappa[k] ||= { ease: 2.5, int: 0, rip: 0, scad: oggi(), giuste: 0, sbagliate: 0, ultima: null };
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
  d.esempio = true;   // il segno dei dati di esempio: il benvenuto li riconosce da qui, non dai nomi degli esami (comunissimi anche veri)
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
