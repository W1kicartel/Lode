// I dati di Lode: nel browser (localStorage) oppure, nell'app desktop, dentro il vault Obsidian (.lode/dati.json).
// Niente account, niente server. La chiave AI non va mai nel vault (i vault si sincronizzano): resta in questo computer.
// Esami e voti, sessioni di studio, carte del ripasso, impostazioni. Più i conti che servono a uno studente:
// media ponderata, base di laurea, voto che serve, ore da fare oggi, ripasso a intervalli (SM-2).
import { t, elenco, numero, lingua } from './lingua.js';
import * as S from './sistemi.js';
import { numeroInFondo } from './parole.js';
// i dati di esempio di tutte le lingue: esempio() prende quelli della lingua della barra, il benvenuto li riconosce tutti
import esempioIt from './lingue/it/esempio.js';
import esempioEn from './lingue/en/esempio.js';
import esempioEs from './lingue/es/esempio.js';
import esempioFr from './lingue/fr/esempio.js';
import esempioDe from './lingue/de/esempio.js';
import esempioPt from './lingue/pt/esempio.js';
const { CODICI } = S;
const CHIAVE = 'lode:v1';
export const VUOTO = () => ({
  v: 1,
  profilo: { nome: '', corso: '', cfuTotali: 180, lode: 30, sistema: 'it' },   // sistema dei voti (js/sistemi.js): i dati di prima sono italiani
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
// un backup o da un dati.json di un vault sincronizzato, e finiscono nelle pagine. Fuori dall'Italia (profilo.sistema) il voto
// è un numero (8.5, 16, 2.3, 3.7: js/sistemi.js) e si tiene anche se non è della scala del sistema (lo studente ha appena
// cambiato sistema: i voti di prima non si buttano, restano nel libretto da correggere e non contano nella media, vedi
// validi()); in Italia il controllo è quello di sempre
const ID = /^[\w-]{1,40}$/, DATA = /^\d{4}-\d{2}-\d{2}$/;
// Un voto scritto con un altro sistema (e.sistema, messo da cambiaSistema) si tiene com'è anche in Italia: un 8,5 della
// Spagna non diventa null tornando al sistema italiano
const votoInForma = (v, sis, da) => v !== null && v !== '' && (S.sistema(sis).cod === 'it' && !(da && da !== 'it') ? Number.isInteger(+v) && +v >= 18 && +v <= 30 : Number.isFinite(+v) && +v >= 0 && +v <= 100) ? +v : null;
const inForma = (e, sis) => {
  if (!(e && typeof e === 'object')) return e;
  const x = { ...e, cfu: Number(e.cfu) || 6, voto: votoInForma(e.voto, sis, CODICI.includes(e.sistema) ? e.sistema : null), ...(e.oreObiettivo != null ? { oreObiettivo: Number(e.oreObiettivo) || null } : {}) };
  if ('sistema' in x && !CODICI.includes(x.sistema)) delete x.sistema;   // un sistema che non esiste (dati scritti a mano): via
  return x;
};
// i dati di Lode letti dal disco: .lode/dati.json nel vault (che si sincronizza o si condivide: chi può scriverci può
// metterci di tutto) o localStorage nel browser. Non passano da backupValido(), che rifiuterebbe tutto per un solo esame
// storto: qui l'esame con un id strano (virgolette, HTML: finirebbe in un data-e="…") si scarta, gli altri restano
// il profilo con i campi che mancano; un sistema dei voti sconosciuto (o assente, nei dati di prima) vale l'Italia
// Fuori dall'Italia, la prima volta, i crediti di una laurea che sono ancora quelli italiani di partenza (180, mai scelti:
// totaliScelti manca) diventano quelli del sistema (240 in Spagna e in Brasile, 360 nel Regno Unito, 120 negli Stati Uniti)
export function profiloInForma(p) {
  const x = { ...VUOTO().profilo, ...p }; if (!CODICI.includes(x.sistema)) x.sistema = 'it';
  if (x.sistema !== 'it' && !x.totaliScelti) { if (!(Number(x.cfuTotali) > 0) || +x.cfuTotali === 180) x.cfuTotali = S.sistema(x.sistema).totali; x.totaliScelti = true; }
  return x;
}
// i voti si controllano con il sistema del profilo già in forma
function unisci(d) { if (!(d && d.v === 1)) return null; const profilo = profiloInForma(d.profilo); return { ...VUOTO(), ...d, esami: Array.isArray(d.esami) ? d.esami.filter(e => e && typeof e === 'object' && ID.test(e.id)).map(e => inForma(e, profilo.sistema)) : [], profilo, imp: { ...VUOTO().imp, ...d.imp }, codice: { ...VUOTO().codice, ...d.codice } }; }
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
  // il lavoro (js/ore.js): turni coi giorni dell'orario e ore «HH:MM», eccezioni con la data; i backup vecchi non ce l'hanno
  const ora = x => typeof x === 'string' && /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(x), giorni = x => Array.isArray(x) && x.every(g => Number.isInteger(g) && g >= 0 && g <= 6);
  const turnoOk = t => ogg(t) && giorni(t.giorni) && ora(t.inizio) && ora(t.fine);
  const eccezioneOk = x => ogg(x) && DATA.test(x.data) && (x.no === true || (ora(x.inizio) && ora(x.fine)));
  const lavoroOk = l => l == null || (ogg(l) && lista(l.turni, turnoOk) && lista(l.eccezioni, eccezioneOk) && numero(l.tetto));
  const impOk = i => ogg(i) && lavoroOk(i.lavoro) && (i.studio == null || (ogg(i.studio) && ora(i.studio.da) && ora(i.studio.a))) && lista(i.oreScelte, x => typeof x === 'string');
  return ogg(d) && d.v === 1 && Array.isArray(d.esami) && d.esami.every(esameOk) && lista(d.carte, cartaOk) && lista(d.orario, orarioOk) && lista(d.sessioni, sessioneOk)
    && (d.profilo == null || (ogg(d.profilo) && testo(d.profilo.nome) && testo(d.profilo.corso) && numero(d.profilo.cfuTotali) && numero(d.profilo.lode) && (d.profilo.sistema == null || CODICI.includes(d.profilo.sistema)))) && (d.imp == null || impOk(d.imp));
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

export function sostituisci(nuovi) { const profilo = profiloInForma(nuovi.profilo); D = { ...VUOTO(), ...nuovi, esami: (nuovi.esami || []).map(e => inForma(e, profilo.sistema)), profilo, imp: { ...VUOTO().imp, ...nuovi.imp, chiave: D.imp.chiave }, codice: { ...VUOTO().codice, ...nuovi.codice } }; salva(); }
// la chiave AI non esce mai in un'esportazione
export function esporta() { const c = structuredClone(D); c.imp.chiave = ''; return c; }
// in ascolto da altre schede dello stesso browser
addEventListener('storage', e => { if (e.key === CHIAVE && !DESKTOP) { D = carica(); dispatchEvent(new CustomEvent('lode:dati')); } });

export const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const oggi = () => isoGiorno(new Date());
export function isoGiorno(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
export function piuGiorni(iso, n) { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoGiorno(d); }
export const giorniTra = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
// nomi dei giorni e dei mesi nella lingua della barra (in italiano: «domenica»… e «gennaio»…)
export const GIORNI = elenco('comune.giorni');
export const MESI = elenco('comune.mesi');
export const dataLunga = iso => { const d = new Date(iso + 'T12:00'); return t('comune.dataLunga', { giorno: GIORNI[d.getDay()], n: d.getDate(), mese: MESI[d.getMonth()] }); };
export const dataBreve = iso => { const d = new Date(iso + 'T12:00'); return t('comune.dataBreve', { n: d.getDate(), mese: elenco('comune.mesiBrevi')[d.getMonth()] }); };
export function traQuanto(iso) {
  const n = giorniTra(oggi(), iso);
  return n < 0 ? t('comune.passato') : n === 0 ? t('comune.oggi') : n === 1 ? t('comune.domani') : t('comune.traGiorni', { n });
}
export const num = (x, dec = 1) => numero(x, dec);
export const ore = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? (m ? t('comune.oreMinuti', { h, m }) : t('comune.ore', { h })) : t('comune.minuti', { m }); };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- esami ---------- */
export const esame = id => D.esami.find(e => e.id === id);
export const fatti = () => D.esami.filter(e => e.fatto);
export const daFare = () => D.esami.filter(e => !e.fatto);
export const prossimi = () => daFare().filter(e => e.data && e.data >= oggi()).sort((a, b) => a.data.localeCompare(b.data));
// trova un esame dal nome detto o scritto («analisi», «analisi 2», «fisica uno»)
export function trovaEsame(testo, { anche = 'tutti' } = {}) {
  const q = numeroInFondo(norm(testo).replace(/\buno\b/g, '1').replace(/\bdue\b/g, '2').replace(/\btre\b/g, '3'));   // e «physics two», «Mathe zwei» (parole.js)
  if (!q) return null;
  const lista = anche === 'daFare' ? daFare() : D.esami;
  let migliore = null, punti = 0;
  for (const e of lista) {
    const n = numeroInFondo(norm(e.nome));   // anche il nome salvato: «Physics Two» si trova con «physics two» come prima
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
  const s = S.sistema(sistemaVoti());   // la lode solo con il massimo del sistema (30 in Italia, 10 la Matrícula in Spagna)
  Object.assign(e, { voto: idoneita ? null : voto, lode: !!lode && s.lode && voto === s.max, idoneita: !!idoneita, fatto: true, data });
  delete e.sistema;   // il voto nuovo è del sistema di adesso
  salva(); return e;
}
// Cambia il sistema dei voti (benvenuto, Impostazioni). Nessun voto si perde: quelli scritti con il sistema di prima restano
// com'erano, con accanto il loro sistema (e.sistema), si mostrano in quel sistema e non contano nei conti del sistema nuovo;
// tornando al loro sistema contano di nuovo. I crediti di una laurea diventano quelli del sistema nuovo (chi li vuole
// diversi li sceglie accanto). Non salva: lo fa chi chiama. Restituisce true se il sistema è cambiato
export function cambiaSistema(cod) {
  const nuovo = S.sistema(cod).cod, prima = sistemaVoti();
  if (nuovo === prima) return false;
  for (const e of D.esami) {
    if (e.voto == null || e.idoneita) continue;
    if (!e.sistema) e.sistema = prima;
    if (e.sistema === nuovo) delete e.sistema;
  }
  Object.assign(D.profilo, { sistema: nuovo, cfuTotali: S.sistema(nuovo).totali });
  if (nuovo !== 'it') D.profilo.totaliScelti = true; else delete D.profilo.totaliScelti;   // in Italia non si scrive mai
  return true;
}
// il voto dell'esame è stato scritto con un altro sistema dei voti (prima di cambiarlo)? Allora non conta nei conti
export const altroSistema = e => !!e?.sistema && e.voto != null && !e.idoneita && e.sistema !== sistemaVoti();

/* ---------- media e laurea ---------- */
// I conti passano da js/sistemi.js, con il sistema dei voti scelto (profilo.sistema, l'Italia se non c'è): in Italia sono
// gli stessi di sempre (test/sistemi.mjs li confronta). media(), serve() e simula() restituiscono gli oggetti di prima;
// il voto finale del sistema (base, mention, Gesamtnote, classe, GPA) lo dà votoFinale()
// un codice che non è dei sistemi (dati scritti a mano, una versione più nuova) vale l'Italia, come in sistemi.js
export const sistemaVoti = () => S.sistema(D.profilo?.sistema).cod;
const opzVoti = () => ({ sistema: sistemaVoti(), lode: D.profilo.lode, totali: D.profilo.cfuTotali });
const senzaFinale = m => { const { finale, ...r } = m; return r; };
// fuori dall'Italia un voto che il sistema non ha (un 28 rimasto da prima del cambio di sistema) non entra nei conti
// (e nemmeno uno scritto con un altro sistema, che si riconosce da e.sistema: in Italia con i dati di sempre non c'è mai)
const validi = lista => { const s = sistemaVoti(); return s === 'it' ? (lista.some(altroSistema) ? lista.filter(e => !altroSistema(e)) : lista) : lista.filter(e => !altroSistema(e) && (e.voto == null || e.idoneita || S.valido(Number(e.voto), s))); };
export function media(lista = fatti()) { return senzaFinale(S.media(validi(lista), opzVoti())); }
// il voto finale della media ponderata nel sistema scelto: { tipo, valore, max, mention | classe } oppure null
export const votoFinale = (m = media()) => S.finale(m.ponderata, sistemaVoti());
// i crediti presi: in Italia tutti gli esami dati (come sempre); altrove un esame non superato (5,0, suspenso, F) non li dà
// (un esame superato con un altro sistema, prima di cambiarlo, i crediti li dà: superato nel suo sistema)
export const cfuFatti = () => { const s = S.sistema(sistemaVoti()); return fatti().filter(e => s.cod === 'it' || e.voto == null || e.idoneita || (altroSistema(e) ? S.superato(Number(e.voto), e.sistema) : S.superato(Number(e.voto), s))).reduce((x, e) => x + e.cfu, 0); };
// che media serve nei CFU che mancano per arrivare a una base di partenza (es. 100/110). Fuori dall'Italia l'obiettivo è il
// voto finale del sistema (la media, la moyenne, la Gesamtnote, il GPA…). 6 CFU circa di prova finale, senza voto (Italia)
// Un esame con il voto di un altro sistema ha già dato i crediti (come in cfuFatti()), ma il voto non entra nella media:
// qui vale come un'idoneità. Con i dati di sempre (nessun e.sistema) la lista è quella di prima
const conCrediti = lista => lista.some(altroSistema) ? lista.flatMap(e => !altroSistema(e) ? [e]
  : sistemaVoti() === 'it' || S.superato(Number(e.voto), e.sistema) ? [{ ...e, voto: null, lode: false, idoneita: true }] : []) : lista;
export function serve(baseObiettivo) { return S.serve(baseObiettivo, validi(conCrediti(fatti())), opzVoti()); }
// se prendo X in quell'esame, come cambia la media? (fuori dall'Italia anche meglio: true se la media migliora, in
// Germania quando scende)
export function simula(esameId, voto, lode = false) {
  const e = esame(esameId); if (!e) return null;
  const x = S.simula(e, voto, lode, validi(fatti()), opzVoti());
  const r = { prima: senzaFinale(x.prima), dopo: senzaFinale(x.dopo), delta: x.delta };
  return sistemaVoti() === 'it' ? r : { ...r, meglio: x.meglio };
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
export const RISPOSTE = [{ q: 0, t: t('comune.risposta0'), k: '1' }, { q: 3, t: t('comune.risposta3'), k: '2' }, { q: 4, t: t('comune.risposta4'), k: '3' }, { q: 5, t: t('comune.risposta5'), k: '4' }];
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
export const intervalloTesto = n => n === 0 ? t('comune.adesso') : n < 30 ? t('comune.giorniBrevi', { n }) : n < 365 ? t('comune.mesi_n', { n: Math.round(n / 30) }) : t('comune.anni', { x: num(n / 365) });

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
// I testi stanno nel catalogo «esempio» di ogni lingua (js/lingue/<codice>/esempio.js); i numeri qui, nella scala del
// sistema dei voti del paese della lingua (js/sistemi.js): il portoghese è quello del Brasile. Crediti dei 9 esami (6 fatti,
// 3 da fare) e voti dei 6 fatti (null = idoneità). L'italiano è esattamente quello di sempre.
const ESEMPI = { it: esempioIt, en: esempioEn, es: esempioEs, fr: esempioFr, de: esempioDe, pt: esempioPt };
export const PAESI_ESEMPIO = {
  it: { sistema: 'it', cfuTotali: 180, cfu: [9, 9, 6, 9, 3, 6, 9, 9, 6], voti: [27, 30, 24, 26, null, 29], lode: 1 },
  en: { sistema: 'uk', cfuTotali: 360, cfu: [20, 20, 15, 15, 10, 20, 20, 15, 15], voti: [64, 78, 58, 66, null, 72] },
  es: { sistema: 'es', cfuTotali: 240, cfu: [6, 6, 6, 6, 3, 6, 6, 6, 6], voti: [6.8, 9.2, 5.5, 7.1, null, 8.4] },
  fr: { sistema: 'fr', cfuTotali: 180, cfu: [6, 6, 6, 6, 3, 6, 6, 6, 6], voti: [12.5, 16, 10.5, 13, null, 14.5] },
  de: { sistema: 'de', cfuTotali: 180, cfu: [10, 8, 6, 8, 3, 8, 10, 6, 6], voti: [2.3, 1.3, 2.7, 2, null, 1.7] },
  pt: { sistema: 'br', cfuTotali: 240, cfu: [6, 4, 4, 4, 2, 4, 6, 4, 4], voti: [7.5, 9.5, 6.5, 8, null, 8.8] },
};
// i nomi di esempio di tutte le lingue: il benvenuto toglie i dati di esempio anche se intanto lo studente ha cambiato lingua
export const NOMI_ESEMPIO = [...new Set(Object.values(ESEMPI).flatMap(c => c['esempio.esami']))];
export const STUDENTI_ESEMPIO = [...new Set(Object.values(ESEMPI).map(c => c['esempio.nome']))];
// i dati sono di esempio? Dal segno che mette esempio(); senza il segno (dati caricati da una Lode di prima, che aveva solo
// l'italiano) da «Giulia» insieme a un esame di esempio italiano. Un nome di esempio di un'altra lingua (Emily, Lena…) senza
// il segno può essere quello di uno studente vero, coi suoi esami («Databases», «Physik 1»…): non basta
const PRIMA = esempioIt['esempio.nome'], ESAMI_PRIMA = esempioIt['esempio.esami'];
export const eEsempio = (d = D) => d.esempio === true || (d.profilo?.nome === PRIMA && (d.esami || []).some(e => ESAMI_PRIMA.includes(e.nome) && e.id));
// il nome da proporre nel benvenuto: non quello dello studente di esempio (Emily, Lena… solo se i dati hanno il segno)
export const nomeVero = (d = D) => { const n = d.profilo?.nome; return n && n !== PRIMA && !(d.esempio === true && STUDENTI_ESEMPIO.includes(n)) ? n : ''; };
export function esempio(cod = lingua) {
  const T = oggi(), d = VUOTO(), X = ESEMPI[cod] || ESEMPI.it, N = PAESI_ESEMPIO[ESEMPI[cod] ? cod : 'it'];
  const nomi = X['esempio.esami'], aule = X['esempio.aule'];
  d.profilo = { nome: X['esempio.nome'], corso: X['esempio.corso'], cfuTotali: N.cfuTotali, lode: 30 };
  if (N.sistema !== 'it') d.profilo.sistema = N.sistema;   // in italiano il profilo resta quello di sempre
  d.benvenuto = true; d.imp = { ...D.imp };
  d.esempio = true;   // il segno dei dati di esempio: il benvenuto li riconosce da qui, non dai nomi degli esami (comunissimi anche veri)
  const E = (k, giorniFa) => ({ id: id(), nome: nomi[k], cfu: N.cfu[k], voto: N.voti[k], lode: k === N.lode, idoneita: N.voti[k] == null, fatto: true, data: piuGiorni(T, -giorniFa), oreObiettivo: null });
  d.esami = [
    E(0, 300), E(1, 290), E(2, 250),
    E(3, 160), E(4, 150), E(5, 140),
    { id: id(), nome: nomi[6], cfu: N.cfu[6], data: piuGiorni(T, 12), voto: null, lode: false, idoneita: false, fatto: false, oreObiettivo: 90 },
    { id: id(), nome: nomi[7], cfu: N.cfu[7], data: piuGiorni(T, 26), voto: null, lode: false, idoneita: false, fatto: false, oreObiettivo: null },
    { id: id(), nome: nomi[8], cfu: N.cfu[8], data: piuGiorni(T, 41), voto: null, lode: false, idoneita: false, fatto: false, oreObiettivo: null },
  ];
  const an2 = d.esami[6].id, bd = d.esami[7].id;
  const ora = new Date(); ora.setHours(10, 0, 0, 0);
  [[an2, [50, 75, 0, 100, 50, 125, 25]], [bd, [25, 0, 50, 0, 25, 0, 0]]].forEach(([e, mins]) => mins.forEach((m, i) => { if (m) d.sessioni.push({ id: id(), esameId: e, inizio: ora.getTime() - (6 - i) * 864e5 + (e === bd ? 6 * 36e5 : 0), min: m }); }));
  for (let i = 0; i < 18; i++) d.sessioni.push({ id: id(), esameId: an2, inizio: ora.getTime() - (8 + i) * 864e5, min: 100 });
  const C = ([fronte, retro], scadFra, esameId = an2) => ({ id: id(), esameId, fronte, retro, ease: 2.5, int: Math.max(0, scadFra), rip: scadFra > 0 ? 2 : 0, scad: piuGiorni(T, scadFra), creata: Date.now() });
  const carte = X['esempio.carte'];
  d.carte = [0, 0, 0, 0, 0, 0, 1, 3].map((scad, k) => C(carte[k], scad)).concat([0, 0, 2].map((scad, k) => C(carte[8 + k], scad, bd)));
  const dow = new Date(T + 'T12:00').getDay(), ieri = piuGiorni(T, -1);
  d.orario = [
    { id: id(), corso: nomi[6], giorni: [...new Set([1, 3, dow])].sort(), inizio: '09:00', fine: '11:00', aula: aule[0] },
    { id: id(), corso: nomi[7], giorni: [...new Set([2, (dow + 6) % 7])].sort(), inizio: '14:00', fine: '16:00', aula: aule[1] },
    { id: id(), corso: nomi[8], giorni: [5], inizio: '11:00', fine: '13:00', aula: aule[2] },
  ];
  const def = l => l.map(([t, d]) => ({ t, d }));
  d.lezioni = [
    { id: id(), corso: nomi[6], data: T, inizio: '09:00', fine: '11:00', aula: aule[0], domande: [...X['esempio.domande']],
      stelle: [...X['esempio.stelle']],
      definizioni: def(X['esempio.definizioni']) },
    { id: id(), corso: nomi[7], data: ieri, inizio: '14:00', fine: '16:00', aula: aule[1], domande: [], stelle: [...X['esempio.stelle-basi']],
      definizioni: def(X['esempio.definizioni-basi']) },
  ];
  return d;
}
// i dati di esempio se ne vanno (il benvenuto, «togli i dati di esempio»), quello che ha aggiunto lo studente resta. Gli esami e
// i corsi dell'orario si riconoscono dai nomi di esempio di tutte le lingue
export function togliEsempio(d = D) {
  const finti = new Set(d.esami.filter(e => NOMI_ESEMPIO.includes(e.nome)).map(e => e.id));
  const vuoto = VUOTO();
  d.esami = d.esami.filter(e => !finti.has(e.id));
  d.sessioni = d.sessioni.filter(s => !s.esameId || (!finti.has(s.esameId) && d.esami.some(e => e.id === s.esameId)));
  d.carte = d.carte.filter(c => c.esameId && !finti.has(c.esameId));
  d.lezioni = []; d.memoria = {};
  d.orario = d.orario.filter(o => !NOMI_ESEMPIO.includes(o.corso));
  // restano i crediti totali e il sistema dei voti (quelli di esempio sono quelli del paese della lingua)
  d.profilo = { ...vuoto.profilo, cfuTotali: d.profilo.cfuTotali, ...(d.profilo.sistema ? { sistema: d.profilo.sistema } : {}) };
  delete d.esempio;
  return d;
}
