// F4 · Il registro onesto nel vault. Niente AI: solo conti.
// Dagli eventi in D.codice nascono tre testi:
// - il diario del progetto, in Progetti/<nome>/<giorno>.md (riquadro «diario» + «## Cosa ho capito», che resta dello studente);
// - la tabella «Cosa so davvero», sulla pagina del corso (riquadro «informatica»);
// - la sezione «## Informatica» di Lode/Memoria.md.
// Il diario dice cosa Lode ha visto. Non dice chi ha scritto le righe: non lo sa.
// Le funzioni sono pure (si provano in Node). aggiornaDiario(V, D) passa i testi a vault:blocco e basta.
import { pulito, fileCorso, notaCorso } from '../markdown.js';
import { ERRORI } from './modelli.js';
// «Pronto per la discussione»: solo i conti delle funzioni spiegate (si importano a vicenda: qui servono solo a chiamata)
import { contiDiario } from './discussione.js';
import { t, elenco, locale } from '../lingua.js';

/* ---------- gli eventi: lo schema comune a F1, F2 e F3 ----------
  Ogni evento entra in D.codice.eventi con registra(D.codice, evento). Campi di tutti:
    t         millisecondi (Date.now()). Se manca, lo mette registra().
    tipo      'stampa' | 'segui' | 'cambio' | 'prova' | 'errore' | 'correzione-vista'
    progetto  il nome del progetto, mai il percorso. Senza progetto l'evento non va in nessun diario.
    corso     il nome del corso, come in D.esami o D.orario (facoltativo).
  Per tipo:
    'stampa'            F1, una per risposta: { concetto: 'c:for' (oppure concetti: [...]), ok: true|false, mutante?: 'fuori-di-uno' }
    'segui'             F2, quando Lode inizia a seguire il progetto: {}. Quando smette: { smetti: true }.
    'cambio'            F2, uno per ogni «Fatto» (non per ogni salvataggio):
                        { file: 2 oppure [{ rel, piu, meno, stato: 'nuovo'|'cambiato'|'tolto' }], piu: 41, meno: 7,
                          funzioni?: [{ nome, file, stato: 'nuova'|'cambiata'|'tolta' }], impronta? }
    'prova'             F2, a fine prova: { compila: true|false, passate: 6, totale: 6, primo?: { file, riga, titolo },
                          impronta?, cambiato?: true (il codice è cambiato mentre provava) }
    'errore'            F3, quando la scheda «Errore» si apre: { voce: 'id della voce'|null, nome: 'nome generale della voce',
                          titolo: 'il messaggio breve', file?, riga?, prova?: <t della prova da cui viene>, passi?: ['dove', 'cosa'] }
                        I passi aperti dopo si aggiungono con segnaPasso(evento, 'dove'|'cosa').
    'correzione-vista'  F3, quando lo studente apre «Fammi vedere la correzione»: { voce, nome?, titolo?, file?, riga? }
*/
export const TIPI = ['stampa', 'segui', 'cambio', 'prova', 'errore', 'correzione-vista'];
const NEL_DIARIO = new Set(['segui', 'cambio', 'prova', 'errore', 'correzione-vista']);
export const MAX_EVENTI = 2000, GIORNI_DIARIO = 30;
// la forma di D.codice (da mettere in VUOTO() di js/dati.js)
export const codiceVuoto = () => ({ memoria: {}, errori: {}, eventi: [], diari: {}, opzioni: {} });
// le opzioni di un progetto, con i valori di partenza
export const opzioniProgetto = (codice, nome) => ({ diario: true, valutato: false, ...(codice?.opzioni && Object.hasOwn(codice.opzioni, nome) ? codice.opzioni[nome] : {}) });

// gli sbagli di «Cosa stampa?» sono i mutanti di F1 (i sette della spec più quelli degli altri argomenti, tutti in ERRORI di
// modelli.js). Tutto il resto in D.codice.errori sono voci di F3 (compilatore, esecuzione): gli id non si sovrappongono.
export const MUTANTI = ERRORI;
// i nomi degli argomenti, se F1 non li passa. Un id sconosciuto diventa leggibile da solo: 'c:do-while' → «Do while».
export const NOMI_CONCETTI = {
  'c:for': t('diario.concetto-for'), 'c:while': t('diario.concetto-while'), 'c:do-while': t('diario.concetto-do-while'), 'c:ritroso': t('diario.concetto-ritroso'), 'c:array': t('diario.concetto-array'),
  'c:divisione-intera': t('diario.concetto-divisione-intera'), 'c:resto': t('diario.concetto-resto'), 'c:cast': t('diario.concetto-cast'), 'c:incremento': t('diario.concetto-incremento'),
  'c:switch': t('diario.concetto-switch'), 'c:cortocircuito': t('diario.concetto-cortocircuito'), 'c:else-pendente': t('diario.concetto-else-pendente'),
  'c:puntatori': t('diario.concetto-puntatori'), 'c:parametri': t('diario.concetto-parametri'), 'c:visibilita': t('diario.concetto-visibilita'),
  'c:char': t('diario.concetto-char'), 'c:ricorsione': t('diario.concetto-ricorsione'), 'c:annidati': t('diario.concetto-annidati'), 'c:break-continue': t('diario.concetto-break-continue'),
  'c:ternario': t('diario.concetto-ternario'), 'c:printf': t('diario.concetto-printf'),
};
// i corsi di programmazione, con la stessa regola di F1
export const RE_INFORMATICA = /programmazione|informatica|algoritm|\blab(?:oratorio)?\s+(?:di\s+)?(?:c|python|java)\b/i;   // la stessa di RE_PROGRAMMAZIONE in stampa.js

/* ---------- piccoli attrezzi ---------- */
const due = n => String(n).padStart(2, '0');
const ms = t => typeof t === 'number' ? t : new Date(t).getTime();
export const giornoDi = t => { const d = new Date(ms(t)); return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`; };
const oraDi = t => { const d = new Date(ms(t)); return `${due(d.getHours())}:${due(d.getMinutes())}`; };
const piuGiorni = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return giornoDi(d.getTime()); };
const giorniTra = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
// i nomi dei giorni e dei mesi nella lingua della barra (catalogo comune, come dataLunga e dataBreve di js/dati.js)
const GIORNI = elenco('comune.giorni'), MESI = elenco('comune.mesi'), MESI_BREVI = elenco('comune.mesiBrevi');
const dataLunga = iso => { const d = new Date(iso + 'T12:00'); return t('comune.dataLunga', { giorno: GIORNI[d.getDay()], n: d.getDate(), mese: MESI[d.getMonth()] }); };
const dataBreve = iso => { const d = new Date(iso + 'T12:00'); return t('comune.dataBreve', { n: d.getDate(), mese: MESI_BREVI[d.getMonth()] }); };
const unisci = xs => xs.length < 2 ? xs.join('') : t('diario.elenco-e', { prima: xs.slice(0, -1).join(', '), ultimo: xs.at(-1) });
const cella = s => String(s).replace(/\|/g, '\\|');
const leggibile = id => String(id).replace(/^[a-z]+:/i, '').replace(/[-_]+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
// un pezzo di testo che arriva da fuori (nomi di file, messaggi del compilatore): una riga sola e niente «%%», che chiuderebbe il riquadro.
// Un «#» fuori dai backtick diventerebbe un tag di Obsidian (#include): si scrive «\#».
export function pezzo(s, max = 120) {
  const t = String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/%{2,}/g, '%').replace(/\s+/g, ' ').trim().slice(0, max);
  return t.split('`').map((x, i) => i % 2 ? x : x.replace(/(^|[\s«(])#(?=\S)/g, '$1\\#')).join('`');
}
const codiceIn = s => '`' + pezzo(s, 60).replace(/`/g, "'").replace(/\\#/g, '#') + '`';

/* ---------- registrare ---------- */
// aggiunge un evento: tiene gli ultimi 2000 e, per i progetti con il diario acceso, i giorni degli ultimi 30 in D.codice.diari[nome]
export function registra(codice, ev, adesso = Date.now()) {
  if (!codice || !ev || !TIPI.includes(ev.tipo)) return null;
  const e = { ...ev, t: ev.t != null ? ms(ev.t) : adesso };
  for (const [k, v] of Object.entries(e)) if (typeof v === 'string' && v.length > 200) e[k] = v.slice(0, 200);
  (codice.eventi ||= []).push(e);
  if (codice.eventi.length > MAX_EVENTI) codice.eventi.splice(0, codice.eventi.length - MAX_EVENTI);
  if (e.progetto && NEL_DIARIO.has(e.tipo) && nomeSicuro(e.progetto) && opzioniProgetto(codice, e.progetto).diario) {
    const diari = codice.diari ||= {}, x = diari[e.progetto] ||= { corso: null, giorni: [] };
    if (e.corso) x.corso = e.corso;
    const g = giornoDi(e.t); if (!x.giorni.includes(g)) { x.giorni.push(g); x.giorni.sort(); }
  }
  pulisciDiari(codice, adesso);
  return e;
}
const nomeSicuro = n => typeof n === 'string' && n && !['__proto__', 'constructor', 'prototype'].includes(n);
// i giorni più vecchi di 30 giorni escono dall'elenco dei diari (le note restano nel vault)
export function pulisciDiari(codice, adesso = Date.now()) {
  const limite = piuGiorni(giornoDi(adesso), -GIORNI_DIARIO);
  for (const [n, x] of Object.entries(codice?.diari || {})) {
    x.giorni = (x.giorni || []).filter(g => g >= limite);
    if (!x.giorni.length) delete codice.diari[n];
  }
}
// F3: lo studente apre un altro passo della scheda «Errore»
export function segnaPasso(ev, passo) {
  if (!ev || !['dove', 'cosa'].includes(passo)) return ev;
  ev.passi = [...new Set([...(ev.passi || []), passo])];
  return ev;
}

// dagli eventi di «Segui il progetto» (js/codice/progetto.js) a questo schema: segui, smetti, fatto → cambio, prova.
// Solo il nome del progetto, mai il percorso. x.primo.titolo, se c'è, è già il testo breve in italiano (da errori.js).
export function daProgetto(x, { corso } = {}) {
  if (!x?.nome || !nomeSicuro(x.nome)) return null;
  const base = { ...(x.t != null ? { t: x.t } : {}), progetto: x.nome, ...(corso ? { corso } : {}) };
  if (x.tipo === 'segui') return { ...base, tipo: 'segui' };
  if (x.tipo === 'smetti') return { ...base, tipo: 'segui', smetti: true };
  if (x.tipo === 'fatto') {
    const fl = Array.isArray(x.file) ? x.file.filter(f => f?.rel) : [];
    const funzioni = fl.flatMap(f => [['nuove', 'nuova'], ['cambiate', 'cambiata'], ['tolte', 'tolta']].flatMap(([k, stato]) => (Array.isArray(f[k]) ? f[k] : []).map(nome => ({ nome, file: f.rel, stato }))));
    return { ...base, tipo: 'cambio', file: fl.map(f => ({ rel: f.rel, piu: Number(f.piu) || 0, meno: Number(f.meno) || 0, stato: f.stato })), piu: Number(x.piu) || 0, meno: Number(x.meno) || 0,
      ...(funzioni.length ? { funzioni } : {}), ...(x.impronta ? { impronta: x.impronta } : {}) };
  }
  if (x.tipo === 'prova') {
    const ev = { ...base, tipo: 'prova', passate: Number(x.ok) || 0, totale: Number(x.tot) || 0 };
    if (x.esito === 'ok' || x.esito === 'prove') ev.compila = true; else if (x.esito === 'non-compila') ev.compila = false;   // 'errore': la prova non è partita
    if (x.primo && (x.primo.file || x.primo.titolo || x.primo.messaggio)) ev.primo = { file: x.primo.file || null, riga: x.primo.riga ?? null, titolo: x.primo.titolo || x.primo.messaggio || null };
    if (x.impronta) ev.impronta = x.impronta;
    if (x.cambiatoDurante) ev.cambiato = true;
    return ev;
  }
  return null;
}

/* ---------- il diario del progetto ---------- */
export const fileDiario = (progetto, giorno) => `Progetti/${pulito(progetto)}/${giorno}.md`;
// la nota nuova: proprietà, titolo, il riquadro di Lode vuoto e «Cosa ho capito», scritto una volta sola
export function notaDiario({ progetto, corso, giorno }) {
  return `---
tipo: diario-progetto
${corso ? `corso: "[[${pulito(corso)}]]"\n` : ''}progetto: "${pulito(progetto)}"
data: ${giorno}
tags: [diario-progetto]
---
# ${pulito(progetto)} · ${dataLunga(giorno)}

%% lode:diario %%
%% /lode:diario %%

## Cosa ho capito
%% Questa parte è tua: Lode non la tocca mai. Cosa hai capito oggi, cosa non ti torna ancora. %%

`;
}
const riuscita = p => p.compila === true && (Number(p.passate) || 0) === (Number(p.totale) || 0);
const numeroRiga = r => r == null || r === '' || !Number.isFinite(+r) ? '' : ':' + +r;
const doveErrore = x => `${x.file ? pezzo(x.file, 60) + numeroRiga(x.riga) + ' ' : ''}${t('diario.errore-titolo', { titolo: pezzo(x.titolo || x.nome || x.voce || t('diario.errore-generico')) })}`;
const PASSI = { dove: t('diario.passo-dove'), cosa: t('diario.passo-cosa') };
const passiVisti = passi => { const p = ['dove', 'cosa'].filter(x => (passi || []).includes(x)).map(x => PASSI[x]); return p.length ? ` · ${t('diario.passi-visti', { n: p.length, passi: unisci(p) })}` : ''; };
// «nuova `f` in lista.c»: una frase per stato, con e senza il file (uno stato sconosciuto vale «cambiata»)
function rigaFunzione(f) {
  const nome = codiceIn(f.nome), file = f.file ? pezzo(f.file, 60) : '';
  if (f.stato === 'nuova') return f.file ? t('diario.funzione-nuova-in', { nome, file }) : t('diario.funzione-nuova', { nome });
  if (f.stato === 'tolta') return f.file ? t('diario.funzione-tolta-in', { nome, file }) : t('diario.funzione-tolta', { nome });
  return f.file ? t('diario.funzione-cambiata-in', { nome, file }) : t('diario.funzione-cambiata', { nome });
}

function rigaCambio(e) {
  const fl = Array.isArray(e.file) ? e.file.filter(Boolean) : [];
  const n = Array.isArray(e.file) ? fl.length : Number(e.file) || 0;
  const piu = Number(e.piu ?? fl.reduce((s, f) => s + (Number(f.piu) || 0), 0)) || 0;
  const meno = Number(e.meno ?? fl.reduce((s, f) => s + (Number(f.meno) || 0), 0)) || 0;
  const cose = [
    ...(Array.isArray(e.funzioni) ? e.funzioni : []).filter(f => f?.nome).map(rigaFunzione),
    ...fl.filter(f => f.stato === 'nuovo' && f.rel).map(f => t('diario.file-nuovo', { file: pezzo(f.rel, 60) })),
    ...fl.filter(f => f.stato === 'tolto' && f.rel).map(f => t('diario.file-tolto', { file: pezzo(f.rel, 60) })),
  ];
  const visti = cose.slice(0, 4), resto = cose.length - visti.length;
  const quanti = n ? t('diario.cambiati-file', { n }) : t('diario.cambiato-codice');
  return `${quanti} (+${piu} −${meno})${visti.length ? `: ${visti.join(', ')}${resto ? ' ' + t('diario.altre-modifiche', { n: resto }) : ''}` : ''} · ${t('diario.chi-ha-scritto')}`;
}
function rigaProva(p, legati) {
  const primo = p.primo || legati.find(x => x.titolo || x.nome || x.file) || null;
  const cambiato = p.cambiato ? ' · ' + t('diario.cambiato-durante') : '';
  let r;
  if (p.compila === false) r = `${primo ? t('diario.prova-non-compila-errore', { errore: doveErrore(primo) }) : t('diario.prova-non-compila')}${cambiato}`;
  else if (p.compila !== true) r = `${t('diario.prova-non-partita')}${cambiato}`;
  else {
    const tot = Number(p.totale) || 0, ok = Number(p.passate) || 0;
    if (riuscita(p)) r = t('diario.prova-ok', { prove: tot ? t('diario.prove-conto', { ok, tot }) : t('diario.nessun-caso'), stato: p.cambiato ? t('diario.ma-cambiato') : t('diario.codice-provato') });
    else r = `${t('diario.prova-ko', { ok, tot })}${primo ? ' · ' + doveErrore(primo) : ''}${cambiato}`;
  }
  return r + passiVisti(legati.flatMap(x => x.passi || []));
}
// l'ultima riga: quante prove, quanti errori risolti, quante correzioni viste. E se l'ultima modifica non è stata provata.
function riassuntoGiorno(es, legati) {
  const prove = es.filter(e => e.tipo === 'prova');
  const ultimaOk = Math.max(-Infinity, ...prove.filter(riuscita).map(e => ms(e.t)));
  // gli errori del giorno: dalle schede di F3; per una prova fallita senza scheda, dal suo primo errore
  const ultimaVolta = new Map();
  const conta = (x, t) => { const k = `${norm(x.voce || x.titolo || x.nome)}|${norm(x.file)}`; ultimaVolta.set(k, Math.max(ultimaVolta.get(k) ?? -Infinity, t)); };
  for (const e of es) {
    if (e.tipo === 'errore') conta(e, ms(e.t));
    else if (e.tipo === 'prova' && !riuscita(e) && e.primo && !(legati.get(ms(e.t)) || []).length) conta(e.primo, ms(e.t));
  }
  const errori = ultimaVolta.size, risolti = [...ultimaVolta.values()].filter(t => t < ultimaOk).length;
  const correzioni = es.filter(e => e.tipo === 'correzione-vista').length;
  const uc = es.filter(e => e.tipo === 'cambio').at(-1), up = prove.at(-1);
  const nonProvato = uc && (!up || (ms(uc.t) > ms(up.t) && !(uc.impronta && uc.impronta === up.impronta)));
  const parti = [prove.length ? t('diario.n-prove', { n: prove.length }) : t('diario.nessuna-prova')];
  if (errori) parti.push(risolti === errori ? t('diario.errori-risolti', { n: errori }) : `${t('diario.n-errori', { n: errori })}, ${t('diario.n-risolti', { n: risolti })}`);
  parti.push(t('diario.correzioni-viste', { n: correzioni }));
  return `${t('diario.oggi', { parti: parti.join(', ') })}${nonProvato ? ' · ' + t('diario.ultima-non-provata') : ''}`;
}
// il testo del riquadro «diario» per un progetto in un giorno: una riga per evento, poi il riassunto
export function testoDiario(eventi, giorno, progetto) {
  const es = (eventi || []).filter(e => e && NEL_DIARIO.has(e.tipo) && (progetto == null || e.progetto === progetto) && giornoDi(e.t) === giorno)
    .map((e, i) => [e, i]).sort((a, b) => ms(a[0].t) - ms(b[0].t) || a[1] - b[1]).map(x => x[0]);
  if (!es.length) return '';
  // una scheda «Errore» aperta da una prova finisce sulla riga di quella prova
  const prove = new Set(es.filter(e => e.tipo === 'prova').map(e => ms(e.t))), legati = new Map(), piegati = new Set();
  for (const e of es) if (e.tipo === 'errore' && e.prova != null && prove.has(ms(e.prova))) { const k = ms(e.prova); if (!legati.has(k)) legati.set(k, []); legati.get(k).push(e); piegati.add(e); }
  const righe = [];
  for (const e of es) {
    let r = null;
    if (e.tipo === 'segui') r = e.smetti ? t('diario.smette', { progetto: pezzo(e.progetto, 80) }) : t('diario.segue', { progetto: pezzo(e.progetto, 80) });
    else if (e.tipo === 'cambio') r = rigaCambio(e);
    else if (e.tipo === 'prova') r = rigaProva(e, legati.get(ms(e.t)) || []);
    else if (e.tipo === 'errore' && !piegati.has(e)) r = `${t('diario.errore', { errore: doveErrore(e) })}${passiVisti(e.passi)}`;
    else if (e.tipo === 'correzione-vista') r = t('diario.correzione-vista', { errore: doveErrore(e) });
    if (r) righe.push(`- ${oraDi(e.t)} · ${r}`);
  }
  righe.push(`- ${riassuntoGiorno(es, legati)}`);
  return righe.join('\n');
}
// nel diario di oggi, solo se hai già spiegato qualcosa: «Spiegate: 7 su 12; da rivedere: `inserisci`, `libera_lista`». Solo nomi
function rigaSpiegate(codice, progetto) {
  const c = contiDiario(codice, progetto); if (!c) return '';
  const r = c.rivedere.slice(0, 6).map(codiceIn);
  return `\n- ${r.length ? t('diario.spiegate-rivedere', { spiegate: c.spiegate, totale: c.totale, nomi: r.join(', ') }) + (c.rivedere.length > r.length ? '…' : '') : t('diario.spiegate', { spiegate: c.spiegate, totale: c.totale })}`;
}
const corsoDelProgetto = (codice, nome) => (Object.hasOwn(codice?.diari || {}, nome) ? codice.diari[nome].corso : null)
  || [...(codice?.eventi || [])].reverse().find(e => e?.progetto === nome && e.corso)?.corso || null;
// le note da scrivere adesso: oggi e ieri (per gli eventi a cavallo della mezzanotte), solo per i progetti col diario acceso.
// Un giorno di cui il limite dei 2000 eventi ha tolto l'inizio non si riscrive: la nota resta com'è.
export function noteDiario(codice, { adesso = Date.now() } = {}) {
  const eventi = codice?.eventi || [], ieri = piuGiorni(giornoDi(adesso), -1);
  const primo = eventi.length >= MAX_EVENTI ? giornoDi(Math.min(...eventi.map(e => ms(e?.t)).filter(Number.isFinite))) : null;
  const coppie = new Map();
  for (const e of eventi) {
    if (!e?.progetto || !NEL_DIARIO.has(e.tipo) || !nomeSicuro(e.progetto)) continue;
    const g = giornoDi(e.t);
    if (g < ieri || (primo && g <= primo) || !opzioniProgetto(codice, e.progetto).diario) continue;
    coppie.set(`${e.progetto}\n${g}`, { progetto: e.progetto, giorno: g });
  }
  return [...coppie.values()].sort((a, b) => a.giorno.localeCompare(b.giorno) || a.progetto.localeCompare(b.progetto)).map(({ progetto, giorno }) => ({
    progetto, giorno, file: fileDiario(progetto, giorno), testo: testoDiario(eventi, giorno, progetto) + (giorno === giornoDi(adesso) ? rigaSpiegate(codice, progetto) : ''),
    nuovo: notaDiario({ progetto, corso: corsoDelProgetto(codice, progetto), giorno }),
  }));
}
// «diario del progetto»: la nota di oggi se oggi è successo qualcosa, se no l'ultima che c'è, se no quella di oggi (nuova)
export function diarioDaAprire(codice, { progetto, adesso = Date.now() } = {}) {
  // dal più recente; senza un nome si sceglie un progetto col diario acceso
  const recenti = (codice?.eventi || []).filter(e => e?.progetto && NEL_DIARIO.has(e.tipo)).sort((a, b) => ms(b.t) - ms(a.t)).map(e => e.progetto);
  const noti = [...new Set([...recenti, ...Object.keys(codice?.diari || {})])];
  const nome = progetto ? noti.find(n => norm(n) === norm(progetto)) || noti.find(n => norm(n).includes(norm(progetto)))
    : noti.find(n => opzioniProgetto(codice, n).diario) || noti[0];
  if (!nome) return null;
  const oggi = giornoDi(adesso), giorni = Object.hasOwn(codice?.diari || {}, nome) ? codice.diari[nome].giorni || [] : [];
  const giorno = giorni.includes(oggi) || (codice?.eventi || []).some(e => e?.progetto === nome && giornoDi(e.t) === oggi) ? oggi : giorni.at(-1) || oggi;
  return { progetto: nome, giorno, file: fileDiario(nome, giorno), nuovo: notaDiario({ progetto: nome, corso: corsoDelProgetto(codice, nome), giorno }), spento: !opzioniProgetto(codice, nome).diario };
}

/* ---------- «Cosa so davvero»: la pagina del corso ---------- */
const PRIMA = { 'da rifare': 0, sicuro: 1, 'mai fatto': 2 };
const quando = (iso, oggi) => { const d = giorniTra(iso, oggi); return d <= 0 ? t('comune.oggi') : d === 1 ? t('diario.ieri') : t('diario.giorni-fa', { n: d }); };
// lo stato come si legge nella tabella (nei dati resta 'da rifare' | 'sicuro' | 'mai fatto')
const STATO_TESTO = { 'da rifare': t('diario.stato-da-rifare'), sicuro: t('diario.stato-sicuro'), 'mai fatto': t('diario.stato-mai-fatto') };
// gli argomenti di «Cosa stampa?», uno per concetto, dai conti SM-2 in D.codice.memoria (chiavi 'stampa|<concetto>').
// Un concetto appartiene ai corsi dei suoi eventi 'stampa'. Se non ne ha più (o non ne ha mai avuti), vale per ogni corso.
// concetti: l'elenco completo di F1 (id, oppure { id, nome }), per le righe «mai fatto».
export function argomenti(codice, { corso, oggi = giornoDi(Date.now()), concetti = [], nomi = {}, prefisso = 'stampa|' } = {}) {
  const mem = codice?.memoria || {}, nomeDa = {};
  for (const c of concetti || []) if (c && typeof c === 'object' && c.id) nomeDa[c.id] = c.nome;
  const ids = [...new Set([...Object.keys(mem).filter(k => k.startsWith(prefisso)).map(k => k.slice(prefisso.length)), ...(concetti || []).map(c => typeof c === 'string' ? c : c?.id).filter(Boolean)])];
  let scelti = ids;
  if (corso) {
    const di = new Map();
    for (const e of codice?.eventi || []) if (e?.tipo === 'stampa' && e.corso) for (const c of [e.concetto, ...(e.concetti || [])].filter(Boolean)) { if (!di.has(c)) di.set(c, new Set()); di.get(c).add(norm(e.corso)); }
    scelti = ids.filter(id => !di.has(id) || di.get(id).has(norm(corso)));
  }
  return scelti.map(id => {
    const m = Object.hasOwn(mem, prefisso + id) ? mem[prefisso + id] : null;
    const giuste = Number(m?.giuste) || 0, esercizi = giuste + (Number(m?.sbagliate) || 0);
    const stato = !esercizi ? 'mai fatto' : (m.scad && m.scad < oggi) || !m.rip ? 'da rifare' : 'sicuro';
    return { concetto: id, argomento: nomi[id] || nomeDa[id] || NOMI_CONCETTI[id] || leggibile(id), esercizi, giuste, primoColpo: esercizi ? Math.round(giuste / esercizi * 100) : null, ultima: esercizi ? m.ultima || null : null, scad: m?.scad || null, stato };
  }).sort((a, b) => PRIMA[a.stato] - PRIMA[b.stato] || (a.stato === 'da rifare' ? String(a.scad).localeCompare(String(b.scad)) : 0) || a.argomento.localeCompare(b.argomento, locale()));
}
const conteggi = (mappa, tieni) => Object.entries(mappa || {}).filter(([k, n]) => tieni(k) && Number(n) > 0).map(([k, n]) => [k, Number(n)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
// gli errori del compilatore (e dell'esecuzione) contati da F3, con il nome della voce preso dall'ultimo evento che lo porta
export function erroriFrequenti(codice, { nomiErrori = {}, quanti = 5 } = {}) {
  const ultimo = {};
  for (const e of codice?.eventi || []) if ((e?.tipo === 'errore' || e?.tipo === 'correzione-vista') && e.voce && e.nome) ultimo[e.voce] = e.nome;
  return conteggi(codice?.errori, k => !Object.hasOwn(MUTANTI, k)).slice(0, quanti).map(([k, n]) => ({ voce: k, nome: pezzo(nomiErrori[k] || ultimo[k] || leggibile(k), 80), volte: n }));
}
function linkDiari(codice, corso) {
  const righe = Object.entries(codice?.diari || {}).filter(([n, x]) => x?.corso && norm(x.corso) === norm(corso) && opzioniProgetto(codice, n).diario && (x.giorni || []).length)
    .sort((a, b) => a[0].localeCompare(b[0], locale()))
    .map(([n, x]) => `- ${pezzo(n, 80)}: ${[...x.giorni].sort().reverse().slice(0, 5).map(g => `[[${fileDiario(n, g).replace(/\.md$/, '')}|${dataBreve(g)}]]`).join(' · ')}`);
  return righe.length ? `${t('diario.diari-dei-progetti')}\n${righe.join('\n')}` : '';
}
// il testo del riquadro «informatica» sulla pagina del corso
export function cosaSoDavvero(codice, opz = {}) {
  const oggi = opz.oggi || giornoDi(Date.now()), righe = argomenti(codice, { ...opz, oggi });
  const parti = ['## Cosa so davvero'];
  if (righe.length) parti.push(`*${t('diario.tabella-nota')}*

${t('diario.tabella-testa')}
|---|---|---|---|---|
${righe.map(r => `| ${cella(pezzo(r.argomento, 80))} | ${r.esercizi} | ${r.primoColpo == null ? '—' : r.primoColpo + '%'} | ${r.ultima ? quando(r.ultima, oggi) : '—'} | ${STATO_TESTO[r.stato]} |`).join('\n')}`);
  else parti.push(t('diario.nessun-esercizio'));
  const err = erroriFrequenti(codice, opz);
  if (err.length) parti.push(t('diario.errori-frequenti', { errori: err.map(x => `${x.nome} (${x.volte})`).join(', ') }));
  const diari = opz.corso ? linkDiari(codice, opz.corso) : '';
  if (diari) parti.push(diari);
  return parti.join('\n\n');
}
// i corsi che hanno un riquadro «informatica»: quelli degli esercizi e dei progetti.
// Il nome si scrive come in D.orario o D.esami, così la pagina è la stessa di aggiornaPagine().
export function corsiInformatica(D) {
  const c = D?.codice || {}, canonico = new Map(), visti = new Map();
  for (const n of [...(D?.orario || []).map(o => o.corso), ...(D?.esami || []).map(e => e.nome)]) if (n && !canonico.has(norm(n))) canonico.set(norm(n), n);
  const metti = n => { const k = norm(n); if (k && !visti.has(k)) visti.set(k, pulito(canonico.get(k) || n)); };
  for (const e of c.eventi || []) if (e?.corso && (e.tipo === 'stampa' || e.progetto)) metti(e.corso);
  for (const x of Object.values(c.diari || {})) metti(x?.corso);
  // esercizi fatti, ma nessun evento ricorda più il corso: i corsi che dal nome sono di programmazione
  if (!visti.size && Object.keys(c.memoria || {}).some(k => k.startsWith('stampa|'))) for (const n of canonico.values()) if (RE_INFORMATICA.test(n)) metti(n);
  return [...visti.values()].sort((a, b) => a.localeCompare(b, 'it'));
}

/* ---------- Lode/Memoria.md: la sezione «## Informatica» ---------- */
export function righeMemoria(codice, opz = {}) {
  const r = [], oggi = opz.oggi || giornoDi(Date.now());
  const sbagli = conteggi(codice?.errori, k => Object.hasOwn(MUTANTI, k)).slice(0, 5);
  if (sbagli.length) r.push(`- ${t('diario.sbagli-spesso', { sbagli: sbagli.map(([k, n]) => `${MUTANTI[k]} (${n})`).join(', ') })}`);
  const tutti = argomenti(codice, { ...opz, corso: null, oggi, concetti: [] }), fatti = tutti.filter(a => a.esercizi);
  if (fatti.length) {
    const tot = fatti.reduce((s, a) => s + a.esercizi, 0), giuste = fatti.reduce((s, a) => s + a.giuste, 0);
    r.push(`- ${t('diario.memoria-stampa', { n: tot, giuste: Math.round(giuste / tot * 100) })}`);
  }
  const rifare = tutti.filter(a => a.stato === 'da rifare').slice(0, 6);
  if (rifare.length) r.push(`- ${t('diario.da-rifare', { argomenti: rifare.map(a => pezzo(a.argomento, 80)).join(', ') })}`);
  const err = erroriFrequenti(codice, opz);
  if (err.length) r.push(`- ${t('diario.errori-frequenti', { errori: err.map(x => `${x.nome} (${x.volte})`).join(', ') })}`);
  return r;
}
// la sezione intera, da mettere nel modello di scriviMemoria() prima di «## Note per Lode». Vuota se non c'è niente da dire.
export const sezioneMemoria = (codice, opz) => { const r = righeMemoria(codice, opz); return r.length ? `## Informatica\n${r.join('\n')}\n\n` : ''; };

/* ---------- lo scrittore ---------- */
// V.blocco({ file, id, testo, nuovo }) → Promise<boolean>: nella barra è L.invoca('vault:blocco', x).
// Scrive i diari di oggi (e di ieri) e il riquadro «informatica» dei corsi. Un errore su un file non ferma gli altri.
// Restituisce [{ file, id, scritto }] oppure [{ file, id, errore }].
export async function aggiornaDiario(V, D, opz = {}) {
  const c = D?.codice; if (!V?.blocco || !c) return [];
  const adesso = opz.adesso ?? Date.now(), oggi = giornoDi(adesso), fatto = [];
  const scrivi = async x => { try { fatto.push({ file: x.file, id: x.id, scritto: !!(await V.blocco(x)) }); } catch (e) { fatto.push({ file: x.file, id: x.id, errore: e?.message || String(e) }); } };
  for (const n of noteDiario(c, { adesso })) await scrivi({ file: n.file, id: 'diario', testo: n.testo, nuovo: n.nuovo });
  for (const corso of corsiInformatica(D)) {
    const e = (D.esami || []).find(x => norm(x.nome) === norm(corso));
    await scrivi({ file: fileCorso(corso), id: 'informatica', testo: cosaSoDavvero(c, { ...opz, corso, oggi }), nuovo: notaCorso(corso, { cfu: e?.cfu, appello: e?.data }) });
  }
  return fatto;
}
