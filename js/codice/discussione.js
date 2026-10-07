// «Pronto per la discussione»: le funzioni cambiate nel progetto da quando Lode lo segue, prima quelle cambiate mentre lavorava
// un agente e mai spiegate, e un controllo senza AI della spiegazione dello studente. Lode non spiega il codice e non suggerisce
// cosa dire: firma e posto prima, i punti trovati nel codice e il corpo solo dopo [Ho finito].
// I dati ci sono già: gli eventi 'cambio' in D.codice.eventi (da daProgetto di diario.js, con funzioni: [{ nome, file, stato }])
// e i turni degli agenti (registraTurno, da arrivaTurno di lode.js). Il file si legge con 'progetto:righe' del main.
// «Mentre lavorava l'agente» è una stima per finestra di tempo: Lode non sa chi ha scritto le righe, e non lo dice mai.
// In D.codice solo nomi: mai righe di codice, mai percorsi assoluti. Funzioni pure (test/discussione.mjs) più la scheda.
import { VOCI, linguaDi, dati } from './glossario.js';
import { opzioniProgetto, giornoDi } from './diario.js';
import { t } from '../lingua.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const md = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>');
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const nomeSicuro = n => typeof n === 'string' && n && !['__proto__', 'constructor', 'prototype'].includes(n);
const rientro = r => /^[ \t]*/.exec(r)[0].replace(/\t/g, '    ').length;
const MIN = 60e3;
export const MAX_TURNI = 100, MAX_ELENCO = 30, MAX_RIGHE = 2000, MAX_MOSTRA = 60;
// un percorso assoluto: /…, \…, C:… (o ~): in dati.json i percorsi dei progetti non ci vanno mai
const ASSOLUTO = /^(?:[\\/~]|[A-Za-z]:)/;
// le spiegazioni dei progetti con il diario spento: solo in memoria, per questa sessione
const SESSIONE = {};

/* ---------- i turni degli agenti ---------- */
// t come arriva da 'agente:turno' (desktop/agenti.mjs): { id (del progetto), nome, agente, inizio, fine, file: [relativi], … }.
// Si tengono solo id, nome, agente, inizio, fine e i file relativi; un turno di sole parole (nessun file) non serve. Al massimo
// 100, i più recenti. Lo stesso turno che arriva due volte (stesso progetto e stesso inizio) si sostituisce.
export function registraTurno(codice, t) {
  if (!codice || !t?.id) return null;
  const file = [...new Set((Array.isArray(t.file) ? t.file : []).filter(f => typeof f === 'string' && f && !ASSOLUTO.test(f) && !f.split(/[\\/]/).includes('..')))].slice(0, 50);
  if (!file.length) return null;
  const n = v => Number.isFinite(+v) && v != null ? +v : null;
  const x = { id: String(t.id).slice(0, 64), nome: typeof t.nome === 'string' ? t.nome.slice(0, 200) : null, agente: typeof t.agente === 'string' ? t.agente.slice(0, 40) : null, inizio: n(t.inizio), fine: n(t.fine), file };
  const l = (Array.isArray(codice.turni) ? codice.turni : []).filter(y => !(y?.id === x.id && y?.inizio === x.inizio));
  l.push(x); l.sort((a, b) => (a.fine ?? a.inizio ?? 0) - (b.fine ?? b.inizio ?? 0));
  if (l.length > MAX_TURNI) l.splice(0, l.length - MAX_TURNI);
  codice.turni = l;
  return x;
}

/* ---------- l'elenco delle funzioni ---------- */
// le funzioni toccate da un evento: 'cambio' di diario.js ({ funzioni: [{ nome, file, stato: 'nuova'|'cambiata'|'tolta' }] })
// oppure 'fatto' come lo manda progetto.js ({ file: [{ rel, nuove, cambiate, tolte }] })
function funzioniDi(e) {
  if (Array.isArray(e.funzioni)) return e.funzioni.filter(f => f?.nome && f.file).map(f => ({ nome: String(f.nome), rel: String(f.file), tolta: f.stato === 'tolta' }));
  return (Array.isArray(e.file) ? e.file : []).filter(f => f?.rel).flatMap(f => [['nuove', false], ['cambiate', false], ['tolte', true]].flatMap(([k, tolta]) => (Array.isArray(f[k]) ? f[k] : []).map(nome => ({ nome: String(nome), rel: String(f.rel), tolta }))));
}
// il turno di un agente sullo stesso progetto (per nome o per id) che ha toccato lo stesso file, con t fra inizio − 2 minuti e
// fine + 10 minuti: il «Fatto» arriva dopo un minuto di quiete, e i file si salvano un po' prima che il turno cominci a contare
const nelTurno = (turni, progetto, rel, t) => turni.some(u => u && (u.nome === progetto || u.id === progetto) && Array.isArray(u.file) && u.file.includes(rel)
  && Number.isFinite(u.inizio ?? u.fine) && t >= (u.inizio ?? u.fine) - 2 * MIN && t <= (u.fine ?? u.inizio) + 10 * MIN);
const ORDINE = { agente: 0, mai: 1, cambiata: 2, rivedere: 3, ok: 4 };
// le spiegazioni segnate (dati.json più quelle di questa sessione, se il diario è spento)
const spiegateDi = (codice, progetto, memoria) => ({ ...(Object.hasOwn(codice?.spiegate || {}, progetto) ? codice.spiegate[progetto] : {}), ...(Object.hasOwn(memoria || {}, progetto) ? memoria[progetto] : {}) });
function tutte(codice, progetto, { memoria = SESSIONE } = {}) {
  if (!nomeSicuro(progetto)) return [];
  const turni = Array.isArray(codice?.turni) ? codice.turni : [];
  const ev = (codice?.eventi || []).filter(e => e && (e.tipo === 'cambio' || e.tipo === 'fatto') && (e.progetto ?? e.nome) === progetto && Number.isFinite(e.t)).sort((a, b) => a.t - b.t);
  const m = new Map();
  for (const e of ev) for (const f of funzioniDi(e)) {
    const k = `${f.rel}#${f.nome}`, x = m.get(k) || { chiave: k, rel: f.rel, nome: f.nome, ultima: 0, agente: false, tolta: false };
    x.ultima = Math.max(x.ultima, e.t); x.tolta = f.tolta;   // conta l'ultimo evento: tolta e poi rimessa torna nell'elenco
    if (!f.tolta && nelTurno(turni, progetto, f.rel, e.t)) x.agente = true;
    m.set(k, x);
  }
  const sp = spiegateDi(codice, progetto, memoria), out = [];
  for (const x of m.values()) {
    if (x.tolta || ASSOLUTO.test(x.rel)) continue;
    const s = Object.hasOwn(sp, x.chiave) ? sp[x.chiave] : null, quando = s ? (Number.isFinite(s.t) ? s.t : new Date(s.g + 'T23:59:59').getTime()) : 0;
    if (s?.esito === 'tolta' && quando >= x.ultima) continue;   // «Togli dall'elenco»: torna solo se cambia ancora
    const spiegata = s && s.esito !== 'tolta' ? s : null;
    const stato = !spiegata ? (x.agente ? 'agente' : 'mai') : x.ultima > quando ? 'cambiata' : spiegata.esito === 'provata' && spiegata.saltati > 0 ? 'rivedere' : 'ok';
    out.push({ ...x, spiegata, stato });
  }
  return out.sort((a, b) => ORDINE[a.stato] - ORDINE[b.stato] || b.ultima - a.ultima);
}
// progetto: il nome (gli eventi e le opzioni di diario.js vanno per nome, mai per percorso). Al massimo 30
export const elenco = (codice, progetto, opz = {}) => tutte(codice, progetto, opz).slice(0, MAX_ELENCO);
// «Spiegate: 5 su 12» (su tutte, anche oltre le 30) e i nomi da rivedere, per la scheda e per il diario
export function conti(codice, progetto, opz = {}) {
  const l = tutte(codice, progetto, opz);
  return { spiegate: l.filter(x => x.stato === 'ok').length, totale: l.length, rivedere: l.filter(x => x.stato === 'rivedere').map(x => x.nome) };
}
// per il diario del giorno (diario.js): i conti solo se lo studente ha già spiegato qualcosa in questo progetto, se no null.
// Solo le spiegazioni salvate (con il diario spento non c'è niente da scrivere comunque)
export function contiDiario(codice, progetto) {
  if (!nomeSicuro(progetto) || !Object.hasOwn(codice?.spiegate || {}, progetto) || !Object.keys(codice.spiegate[progetto] || {}).length) return null;
  const c = conti(codice, progetto, { memoria: {} });
  return c.totale ? c : null;
}
const dataBreve = g => { const m = /^\d{4}-(\d\d)-(\d\d)$/.exec(g || ''); return m ? t('discussione.data-breve', { g: +m[2], m: +m[1] }) : ''; };
// il testo dello stato, così come lo legge lo studente
export function testoStato(x) {
  if (x.stato === 'agente') return t('discussione.stato-agente');
  if (x.stato === 'mai') return t('discussione.stato-mai');
  if (x.stato === 'cambiata') return t('discussione.stato-cambiata');
  if (x.stato === 'rivedere') return t('discussione.stato-rivedere', { n: x.spiegata.saltati });
  return t('discussione.stato-spiegata', { data: dataBreve(x.spiegata?.g) });
}

/* ---------- segnare ---------- */
// esito: 'so' (La so spiegare), 'provata' (con quanti punti saltati) o 'tolta' (Togli dall'elenco). Solo nomi, mai codice.
// Con il diario spento non si salva niente: vale in memoria, per questa sessione. Restituisce true se è finito in D.codice
export function segna(codice, progetto, chiave, esito, saltati = 0, adesso = Date.now(), memoria = SESSIONE) {
  if (!codice || !nomeSicuro(progetto) || typeof chiave !== 'string' || !chiave.includes('#') || ASSOLUTO.test(chiave) || !['so', 'provata', 'tolta'].includes(esito)) return false;
  const x = { g: giornoDi(adesso), t: adesso, esito, ...(esito === 'provata' ? { saltati: Math.max(0, Number(saltati) || 0) } : {}) };
  if (opzioniProgetto(codice, progetto).diario === false) { (memoria[progetto] ||= {})[chiave] = x; return false; }
  const sp = codice.spiegate && typeof codice.spiegate === 'object' ? codice.spiegate : (codice.spiegate = {});
  (Object.hasOwn(sp, progetto) ? sp[progetto] : (sp[progetto] = {}))[chiave] = x;
  return true;
}

/* ---------- il codice senza commenti e senza testo tra virgolette ---------- */
// come in glossario.js: una riga alla volta con lo stato di chi legge (un /* … */ o un """ … """ che va a capo). Le stringhe e i
// caratteri diventano "", i commenti spariscono: le graffe dentro non contano più. Alla buona, ma basta per trovare una funzione
function pulisci(s, py, st) {
  let out = '', i = 0;
  while (i < s.length) {
    if (st.dentro) { const j = s.indexOf(st.dentro, i); if (j < 0) return out; i = j + st.dentro.length; if (py) out += '""'; st.dentro = null; continue; }
    const c = s[i];
    if (py ? c === '#' : s.startsWith('//', i)) break;
    if (!py && s.startsWith('/*', i)) { st.dentro = '*/'; i += 2; continue; }
    if (py && (s.startsWith('"""', i) || s.startsWith("'''", i))) { st.dentro = s.slice(i, i + 3); i += 3; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < s.length && s[j] !== c) j += s[j] === '\\' ? 2 : 1; out += '""'; i = j + 1; continue; }
    out += c; i++;
  }
  return out;
}
// out.dentro[i]: la riga i comincia dentro una stringa o un commento lungo (il suo rientro non conta, in Python)
const pulite = (righe, lingua) => { const st = {}, py = lingua === 'python', dentro = []; const out = righe.map((s, i) => { dentro[i] = !!st.dentro; return pulisci(String(s ?? ''), py, st); }); out.dentro = dentro; return out; };

/* ---------- trovare la funzione nel file ---------- */
// le parole che aprono un'istruzione, non una firma: if (f(x)), return f(x), while (…)
const NON_FIRMA = /^\s*(?:#|(?:if|else|while|for|return|switch|do|case|sizeof|new|throw|catch|assert)\b)/;
// righe: tutte le righe del file (testo), nome: la funzione, lingua: 'c' | 'java' | 'python'.
// → { da, a, riga, firma } con i numeri di riga da 1 (da comprende i decoratori o il tipo sulla riga sopra, riga è quella del
// nome), firma pulita su una riga, senza la graffa o i due punti. null se non c'è (o se la lingua non è una di queste)
export function trova(righe, nome, lingua) {
  if (!['c', 'java', 'python'].includes(lingua) || !/^[A-Za-z_$][\w$]*$/.test(String(nome || ''))) return null;
  const r = (righe || []).map(s => String(s ?? '')), c = pulite(r, lingua);
  return lingua === 'python' ? trovaPy(r, c, nome) : trovaC(c, nome);
}
function trovaC(c, nome) {
  const re = new RegExp(`(^|[^\\w$.])${escRe(nome)}\\s*\\(`);
  for (let i = 0; i < c.length; i++) {
    const m = re.exec(c[i]); if (!m || NON_FIRMA.test(c[i])) continue;
    const prima = c[i].slice(0, m.index + m[1].length);
    if (/[=(;{}]/.test(prima)) continue;   // x = f(…), g(f(…)), una riga che ha già aperto o chiuso qualcosa
    // dalla parentesi del nome: la ) che chiude, poi la prima { o ; (al massimo 6 righe). «;» → prototipo o chiamata: avanti
    let d = 0, k = i, j = m.index + m[0].length - 1, chiusa = false, graffa = null;
    for (; k < c.length && k < i + 6 && graffa === null; k++, j = 0) {
      for (; j < c[k].length; j++) {
        const ch = c[k][j];
        if (!chiusa) { if (ch === '(') d++; else if (ch === ')' && --d === 0) chiusa = true; continue; }
        if (ch === '{') { graffa = { k, j }; break; }
        if (ch === ';') { graffa = false; break; }
      }
      if (graffa !== null) break;
    }
    if (!graffa) continue;
    // il corpo: fino a quando le graffe si chiudono
    let p = 0, a = c.length - 1;
    fuori: for (let y = graffa.k, x = graffa.j; y < c.length; y++, x = 0) for (; x < c[y].length; x++) {
      if (c[y][x] === '{') p++; else if (c[y][x] === '}' && --p === 0) { a = y; break fuori; }
    }
    // il tipo sulla riga sopra (static int↵inserisci(…)): fa parte della firma
    let da = i;
    if (!prima.trim() && i > 0 && /^\s*[A-Za-z_$][\w$<>,\s*&\[\]]*$/.test(c[i - 1]) && !NON_FIRMA.test(c[i - 1]) && c[i - 1].trim()) da = i - 1;
    const testo = c.slice(da, graffa.k + 1).join(' ');
    const firma = testo.slice(0, testo.length - (c[graffa.k].length - graffa.j)).replace(/\s+/g, ' ').trim();
    return { da: da + 1, a: a + 1, riga: i + 1, firma, nome };
  }
  return null;
}
function trovaPy(r, c, nome) {
  const re = new RegExp(`^\\s*(?:async\\s+)?def\\s+${escRe(nome)}\\s*\\(`);
  const i = c.findIndex(s => re.test(s)); if (i < 0) return null;
  const ind = rientro(c[i]);
  let da = i; while (da > 0 && /^\s*@/.test(c[da - 1]) && rientro(c[da - 1]) === ind) da--;
  // la firma può andare a capo: fino alla ) che chiude i parametri (al massimo 6 righe), poi «-> tipo» e i due punti
  let d = 0, f = i, j = c[i].indexOf('(', c[i].search(/\bdef\s/)), chiusa = false;
  for (; f < c.length && f < i + 6; f++, j = 0) {
    for (; j < c[f].length; j++) { if (c[f][j] === '(') d++; else if (c[f][j] === ')' && --d === 0) { chiusa = true; break; } }
    if (chiusa) break;
  }
  if (!chiusa) return null;
  const testo = c.slice(i, f).concat(c[f].slice(0, j + 1)).join(' '), resto = c[f].slice(j + 1), m = /^\s*(->[^:]*)?:/.exec(resto);
  const firma = (testo + (m?.[1] ? ' ' + m[1].trim() : '')).replace(/\s+/g, ' ').trim();
  // il corpo: fino alla prima riga non vuota con rientro minore o uguale. Una def su una riga sola (def f(): return 1) finisce lì
  let a = f;
  if (!(m && resto.slice(m[0].length).trim())) for (let y = f + 1; y < c.length; y++) {
    if (!c[y].trim() || c.dentro[y]) continue;
    if (rientro(c[y]) <= ind) break;
    a = y;
  }
  return { da: da + 1, a: a + 1, riga: i + 1, firma, nome };
}

/* ---------- i punti che una spiegazione dovrebbe toccare ---------- */
const MODIFICATORI = /\b(?:static|inline|extern|public|private|protected|final|abstract|synchronized|native|default|strictfp|virtual|override|register)\b/g;
const TIPI_C = new Set(['int', 'char', 'float', 'double', 'long', 'short', 'unsigned', 'signed', 'void', 'const', 'struct', 'bool', 'size_t', 'boolean', 'byte', 'String']);
// divide su una virgola che non sta dentro (), [], {} o <>
function dividi(s) {
  const out = []; let d = 0, cur = '';
  for (const ch of s) { if ('([{<'.includes(ch)) d++; else if (')]}>'.includes(ch)) d--; if (ch === ',' && d <= 0) { out.push(cur); cur = ''; } else cur += ch; }
  if (cur.trim()) out.push(cur);
  return out;
}
// i nomi dei parametri dalla firma: puntatori, array, valori di default, annotazioni di tipo e varargs tolti
export function parametri(firma, nome, lingua) {
  const s = String(firma || ''), i = s.search(new RegExp(`(^|[^\\w$])${escRe(nome)}\\s*\\(`)); if (i < 0) return [];
  const j0 = s.indexOf('(', i); let d = 0, j = j0;
  for (; j < s.length; j++) { if (s[j] === '(') d++; else if (s[j] === ')' && --d === 0) break; }
  const out = [];
  for (let p of dividi(s.slice(j0 + 1, j))) {
    p = p.replace(/@\w+(?:\([^)]*\))?/g, ' ').trim();
    const fp = /\(\s*\*\s*([A-Za-z_]\w*)\s*\)\s*\(/.exec(p); if (fp) { out.push(fp[1]); continue; }   // int (*cmp)(const void *, …)
    p = p.split('=')[0];
    if (lingua === 'python') p = p.split(':')[0];
    p = p.replace(/\[[^\]]*\]/g, ' ').replace(/\.\.\./g, ' ').replace(/[*&]/g, ' ').trim();
    const m = /([A-Za-z_$][\w$]*)\s*$/.exec(p); if (!m) continue;
    const n = m[1];
    if (lingua === 'python' ? (n === 'self' || n === 'cls') : (n === 'void' || (TIPI_C.has(n) && !/\s/.test(p)))) continue;
    out.push(n);
  }
  return out;
}
// le funzioni di libreria del dizionario di glossario.js (solo quelle che sono funzioni: hanno f), chiamate come nome(
const LIBRERIA = VOCI.filter(v => v.f && /^[A-Za-z_]\w*$/.test(v.f));
// trovata: { da, a, riga, firma } di trova(); righe: tutto il file. Al massimo 5 punti, presi dal codice e basta:
// { tipo, breve (per «Hai detto»), testo (per «Hai saltato»), … }
export function punti(trovata, righe, lingua) {
  if (!trovata || !['c', 'java', 'python'].includes(lingua)) return [];
  const c = pulite((righe || []).map(s => String(s ?? '')), lingua), nome = trovata.nome || nomeDa(trovata.firma, lingua);
  if (!nome) return [];
  // il corpo senza la firma (e senza i decoratori): da qui ciclo, chiamate e ricorsione
  const corpo = c.slice(trovata.riga - 1, trovata.a).join('\n').replace(new RegExp(`(^|[^\\w$])${escRe(nome)}\\s*\\(`), '$1(');
  const out = [];
  const par = parametri(trovata.firma, nome, lingua);
  out.push(par.length ? { tipo: 'parametri', nomi: par, breve: t('discussione.punto-parametri-breve'), testo: t('discussione.punto-parametri', { nomi: par.map(n => '`' + n + '`').join(', ') }) }
    : { tipo: 'parametri', nomi: [], breve: t('discussione.punto-niente'), testo: t('discussione.punto-niente') });
  const ret = restituisce(trovata.firma, nome, lingua, corpo); if (ret) out.push(ret);
  const chiamate = LIBRERIA.filter(v => v.l === lingua && v.f !== nome && new RegExp(`(^|[^\\w$])${escRe(v.f)}\\s*\\(`).test(corpo)).map(v => v.f);
  const ch = [...new Set(chiamate)].slice(0, 2).map(f => ({ tipo: 'chiama', nome: f, breve: t('discussione.punto-chiama', { nome: f }), testo: t('discussione.punto-chiama', { nome: f }) }));
  if (ch[0]) out.push(ch[0]);
  if (/(^|[^\w$])(?:for|while)\b/.test(corpo)) out.push({ tipo: 'ciclo', breve: t('discussione.punto-ciclo-breve'), testo: t('discussione.punto-ciclo') });
  if (new RegExp(`(^|[^\\w$])${escRe(nome)}\\s*\\(`).test(corpo)) out.push({ tipo: 'ricorsione', breve: t('discussione.punto-ricorsiva-breve'), testo: t('discussione.punto-ricorsiva') });
  if (ch[1]) out.push(ch[1]);
  return out.slice(0, 5);
}
// senza il nome (una trovata scritta a mano): l'ultimo identificatore prima della prima parentesi
const nomeDa = (firma, lingua) => lingua === 'python' ? /def\s+([A-Za-z_]\w*)\s*\(/.exec(firma)?.[1] : /([A-Za-z_$][\w$]*)\s*\(/.exec(String(firma))?.[1];
function restituisce(firma, nome, lingua, corpo) {
  const NIENTE = { tipo: 'restituisce', niente: true, breve: t('discussione.punto-restituisce-breve'), testo: t('discussione.punto-restituisce-niente') };
  if (lingua === 'python') {
    const ann = /\)\s*->\s*(.+)$/.exec(firma)?.[1]?.trim();
    if (ann === 'None') return NIENTE;
    if (ann || /(^|[^\w])(?:return\s+[^\s;]|yield\b)/.test(corpo)) return { tipo: 'restituisce', breve: t('discussione.punto-restituisce-breve'), testo: t('discussione.punto-restituisce-valore') };
    return NIENTE;
  }
  const i = firma.search(new RegExp(`(^|[^\\w$])${escRe(nome)}\\s*\\(`));
  let tipo = firma.slice(0, i + 1).replace(MODIFICATORI, ' ').trim();
  if (tipo.startsWith('<')) { let d = 0, j = 0; for (; j < tipo.length; j++) { if (tipo[j] === '<') d++; else if (tipo[j] === '>' && --d === 0) break; } tipo = tipo.slice(j + 1).trim(); }   // <T> di un metodo generico
  tipo = tipo.replace(/\s+/g, ' ').replace(/\s*\*\s*/g, ' *').replace(/^\s+|\s+$/g, '');
  if (!tipo) return null;   // un costruttore di Java: niente da restituire, niente punto
  if (tipo === 'void') return NIENTE;
  return { tipo: 'restituisce', tipoRitorno: tipo, breve: t('discussione.punto-restituisce-breve'), testo: t('discussione.punto-restituisce-tipo', { tipo }) };
}

/* ---------- il controllo della spiegazione ---------- */
// confronto tollerante: minuscole, senza accenti, la punteggiatura diventa spazio. → { presi, saltati } (punti interi)
// Le parole italiane di sempre per prime; poi quelle delle altre lingue (inglese, spagnolo, francese, tedesco, portoghese),
// mai parole italiane: in italiano il controllo resta quello di prima
export function controlla(lista, testo) {
  const grezzo = String(testo ?? '').toLowerCase(), n = ` ${norm(grezzo)} `;
  const parola = w => !!norm(w) && n.includes(` ${norm(w)} `);
  const preso = p => {
    if (!n.trim()) return false;
    if (p.tipo === 'parametri') {
      if (!p.nomi?.length) return /\b(?:niente|nulla|nessun\w*|void)\b|\bnon (?:riceve|prende)\b|\bsenza (?:parametri|argomenti)\b/.test(n)
        || /\b(?:nothing|none|no (?:parameters|arguments)|takes no|ningun\w*|nada|sin (?:parametros|argumentos)|aucun\w*|rien|sans (?:parametres|arguments)|kein\w*|nichts|ohne (?:parameter|argumente)|nenhum\w*|sem (?:parametros|argumentos))\b/.test(n);
      return p.nomi.filter(parola).length >= Math.ceil(p.nomi.length / 2) || /\b(?:parametr\w*|argoment\w*|riceve|prende)\s+[a-z0-9]/.test(n)
        || /\b(?:parameters?|arguments?|takes|receives|recibe|toma|prend|recoit|nimmt|erhalt|bekommt|recebe)\s+[a-z0-9]/.test(n);
    }
    if (p.tipo === 'restituisce') return /\b(?:restitui\w*|ritorn\w*|torna\w*|return\w*)\b/.test(n) || /(?:^|[^\p{L}])d(?:à|a')(?![\p{L}])/u.test(grezzo)
      || /\b(?:devuelv\w*|devolv\w*|retorna\w*|renvoi\w*|retourn\w*|liefert|zuruck\w*)\b/.test(n)
      || (p.niente && /\b(?:niente|nulla|void|none)\b/.test(n)) || (p.niente && /\b(?:nothing|nada|rien|nichts)\b/.test(n));
    if (p.tipo === 'chiama') return parola(p.nome);
    if (p.tipo === 'ciclo') return /\b(?:cicl\w*|scorr\w*|for|while|per ogni|iter\w*|finche|ripet\w*)\b/.test(n)
      || /\b(?:loop\w*|bucle\w*|recorr\w*|boucle\w*|parcour\w*|schleife\w*|durchl\w*|laco\w*)\b/.test(n);
    if (p.tipo === 'ricorsione') return /ricors|chiama se stess|richiam/.test(n) || /recurs|rekurs|itself|si mism|elle meme|sich selbst|si mesm/.test(n);
    return false;
  };
  const presi = [], saltati = [];
  for (const p of lista || []) (preso(p) ? presi : saltati).push(p);
  return { presi, saltati };
}

/* ---------- leggere il file dal main ---------- */
// a pezzi di 400 righe, fino a 2000. → { righe } | { lungo: totale } | { errore }
export async function leggiFile(invoca, id, rel) {
  const out = [];
  for (let da = 1; da <= MAX_RIGHE; da += 400) {
    const x = await Promise.resolve(invoca('progetto:righe', { id, rel, da, a: da + 399 })).catch(e => ({ errore: e?.message || String(e) }));
    if (!x || x.errore || !Array.isArray(x.righe)) return { errore: x?.errore || t('discussione.file-non-arrivato') };
    if (Number(x.totale) > MAX_RIGHE) return { lungo: Number(x.totale) };
    out.push(...x.righe.map(r => String(r?.s ?? '')));
    if (!Number.isFinite(x.totale) || out.length >= x.totale || !x.righe.length) return { righe: out };
  }
  return { righe: out };
}

/* ---------- la scheda ---------- */
const NOTA = t('discussione.nota');
// il giudizio dopo [Ho finito] (puro: si prova in Node)
export function htmlEsito({ presi, saltati }) {
  const detto = presi.length ? t('discussione.hai-detto', { punti: presi.map(p => md(p.breve)).join(', ') }) : t('discussione.nessun-punto');
  return `<p class="ld-ptesto">${saltati.length ? `${detto} ${t('discussione.hai-saltato', { punti: saltati.map(p => md(p.testo)).join(', ') })}` : t('discussione.tutti-i-punti')}</p>`;
}
// il codice della funzione, solo dopo [Ho finito]: al massimo 60 righe, con i numeri
export function htmlCodice(righe, t) {
  const fine = Math.min(t.a, t.da + MAX_MOSTRA - 1);
  const r = [];
  for (let n = t.da; n <= fine; n++) r.push(`<span class="r"><i>${n}</i>${esc(righe[n - 1] ?? '') || ' '}</span>`);
  return `<pre class="codice">${r.join('')}${t.a > fine ? '<span class="r"><i></i>…</span>' : ''}</pre>`;
}
const htmlVoce = (x, i) => `<div class="voce" data-i="${i}"><div class="t"><span><code>${esc(x.nome)}</code> · ${esc(x.rel)}</span><span class="stato${x.stato === 'agente' ? ' forte' : ''}">${esc(testoStato(x))}</span></div>
  <div class="az"><button type="button" class="btn small" data-so>${t('discussione.la-so-spiegare')}</button><button type="button" class="btn small${x.stato === 'agente' || x.stato === 'rivedere' ? ' primary' : ''}" data-prova>${t('discussione.proviamo')}</button></div><div class="prova" hidden></div></div>`;
// p: il progetto di progetto.js ({ id, nome }); T: gli strumenti di lode.js (scheda, mostraFatto, premi, entra); invoca: verso il
// main. opz.dati ({ D, salva }) e opz.memoria per le prove
export async function scheda(p, T, invoca, opz = {}) {
  const { D, salva } = opz.dati || await dati();
  const codice = D.codice ||= {}, nome = p.nome, memoria = opz.memoria || SESSIONE;
  const spento = opzioniProgetto(codice, nome).diario === false;
  const s = T.scheda('ld-progetto ld-discussione', `<div class="capo"><span class="ld-lbl">${t('discussione.titolo')} · ${esc(nome)}</span><span class="ld-tenue conto"></span></div>
    <p class="ld-ptesto">${t('discussione.intro')}</p>
    <div class="lista"></div>${spento ? `<p class="ld-nota">${t('discussione.diario-spento')}</p>` : ''}<p class="ld-nota">${esc(NOTA)}</p>`);
  s.setAttribute?.('aria-label', `${t('discussione.titolo')} · ${nome}`);
  const premi = async b => { try { await T.premi?.(b); } catch { } };
  const salvaSe = scritto => { if (scritto) salva?.(); };
  const disegna = () => {
    const l = elenco(codice, nome, { memoria }), c = conti(codice, nome, { memoria }), box = s.querySelector('.lista');
    s.querySelector('.conto').textContent = c.totale ? t('discussione.spiegate', { spiegate: c.spiegate, totale: c.totale }) : '';
    box.innerHTML = l.length ? l.map(htmlVoce).join('') : `<p class="ld-ptesto">${t('discussione.nessuna-funzione', { nome: esc(nome) })}</p>`;
    box.querySelectorAll('.voce').forEach(el => {
      const x = l[+el.dataset.i];
      el.querySelector('[data-so]').addEventListener('click', async e => { const b = e.currentTarget; if (b.disabled) return; b.disabled = true; await premi(b); salvaSe(segna(codice, nome, x.chiave, 'so', 0, Date.now(), memoria)); disegna(); });
      el.querySelector('[data-prova]').addEventListener('click', async e => { const b = e.currentTarget; if (b.disabled) return; b.disabled = true; await premi(b); await prova(el, x); });
    });
  };
  // [Proviamo]: firma e posto, l'area di testo, [Ho finito]; poi i punti e solo allora il codice
  const prova = async (el, x) => {
    const box = el.querySelector('.prova'), az = el.querySelector('.az'), stato = el.querySelector('.stato');
    box.hidden = false; az.hidden = true;
    const dici = h => { box.innerHTML = h; T.entra?.(box, { dy: 4, blur: 4, ms: 320 }); };
    const lingua = linguaDi(x.rel);
    if (!lingua) return dici(`<p class="ld-ptesto">${t('discussione.lingua-sconosciuta')}</p><div class="az"><button type="button" class="btn small" data-so>${t('discussione.la-so-spiegare')}</button></div>`), box.querySelector('[data-so]').addEventListener('click', () => { salvaSe(segna(codice, nome, x.chiave, 'so', 0, Date.now(), memoria)); disegna(); });
    dici(`<p class="ld-nota">${t('discussione.leggo-il-file')}</p>`);
    const f = await leggiFile(invoca, p.id, x.rel);
    if (f.lungo) return dici(`<p class="ld-ptesto">${t('discussione.file-lungo', { file: esc(x.rel), n: f.lungo })}</p>`), az.hidden = false;
    if (f.errore) return dici(`<p class="ld-ptesto">${t('discussione.non-riesco-leggere', { file: esc(x.rel), errore: esc(f.errore) })}</p>`), az.hidden = false;
    const tr = trova(f.righe, x.nome, lingua);
    if (!tr) {
      dici(`<p class="ld-ptesto">${t('discussione.non-trovo-piu', { nome: esc(x.nome), file: esc(x.rel) })}</p><div class="az"><button type="button" class="btn small" data-togli>${t('discussione.togli')}</button></div>`);
      box.querySelector('[data-togli]').addEventListener('click', () => { salvaSe(segna(codice, nome, x.chiave, 'tolta', 0, Date.now(), memoria)); disegna(); });
      return;
    }
    dici(`<p class="ld-ptesto">${t('discussione.spiegala', { firma: esc(tr.firma), file: esc(x.rel), riga: tr.riga })}</p>
      <textarea rows="5" aria-label="${t('discussione.aria-spiegazione', { nome: esc(x.nome) })}" spellcheck="true"></textarea><div class="az"><button type="button" class="btn small primary" data-finito>${t('discussione.ho-finito')}</button></div>`);
    const area = box.querySelector('textarea'); area.focus?.({ preventScroll: true });
    area.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.isComposing) { e.preventDefault(); box.querySelector('[data-finito]')?.click(); } });   // ⌘↩ o Ctrl+↩
    box.querySelector('[data-finito]').addEventListener('click', async e => {
      const b = e.currentTarget; if (b.disabled) return;
      if (!area.value.trim()) { area.focus?.(); return; }
      b.disabled = true; await premi(b);
      const lista = punti(tr, f.righe, lingua), esito = controlla(lista, area.value);
      area.readOnly = true; b.parentElement.remove();
      const dopo = document.createElement('div'); dopo.className = 'dopo';
      dopo.innerHTML = `${htmlEsito(esito)}${htmlCodice(f.righe, tr)}<p class="ld-nota">${t('discussione.alla-buona')}</p>`;
      box.append(dopo); T.entra?.(dopo, { dy: 4, blur: 4, ms: 360 });
      salvaSe(segna(codice, nome, x.chiave, 'provata', esito.saltati.length, Date.now(), memoria));
      if (stato) stato.textContent = esito.saltati.length ? t('discussione.stato-rivedere', { n: esito.saltati.length }) : t('discussione.spiegata-adesso');
      const c = conti(codice, nome, { memoria }); s.querySelector('.conto').textContent = c.totale ? t('discussione.spiegate', { spiegate: c.spiegate, totale: c.totale }) : '';
    });
  };
  disegna();
  return s;
}
// per il bottone [Preparati alla discussione] della scheda del turno: il turno ha toccato file C, Java o Python. Il «Fatto» con le
// funzioni arriva dopo un minuto di quiete, spesso dopo la scheda del turno: per questo basta il tipo di file
export const daSpiegare = t => Array.isArray(t?.file) && t.file.some(f => linguaDi(f));
