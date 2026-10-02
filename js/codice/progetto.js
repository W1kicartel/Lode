// «Segui il progetto» nella barra (F2 di docs/PROGETTO-INFORMATICA.md): lo stato che arriva dal main, il testo per la
// pillola e le schede «Seguo…?», «Cosa sta cambiando», «Fatto. In parole semplici» e «Provato?».
// Qui niente calcoli che contano: diff, riassunto, impronta e prove li fa il main (desktop/progetto.mjs), senza AI.
// La barra manda al main solo l'id del progetto: mai percorsi, mai comandi da eseguire. Lode propone, lo studente decide.
// lode.js passa i suoi strumenti con collega(), perché quelle funzioni sono interne a lode.js (come stampa.js).

const L = globalThis.lodeDesktop || null;
export const attivo = !!L;
const P = new Map();        // id → ultimo stato arrivato dal main
const T = {};               // strumenti di lode.js
const uscite = new Map();   // id → <pre> dove scorre l'uscita della prova in corso
const schedeCambia = new Map();   // id → scheda «Cosa sta cambiando» aperta (si aggiorna da sola)
let collegato = false, tQuiete = 0;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// i testi del main hanno `codice` e **grassetto**
export const md = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const piano = t => String(t ?? '').replace(/[`*]/g, '');
const due = n => String(n).padStart(2, '0');
export const ora = t => { const d = new Date(t); return `${due(d.getHours())}:${due(d.getMinutes())}`; };
const invoca = (canale, x) => L ? L.invoca(canale, x).catch(e => ({ errore: e.message })) : Promise.resolve({ errore: 'Seguire un progetto si può solo nell\'app desktop di Lode.' });
const segnala = (ev, x) => T.segnala?.(ev, x);
const evento = x => { try { T.evento?.({ t: Date.now(), ...x }); } catch (e) { console.error(e); } };
const dopo = (ms, f) => (T.dopo ? T.dopo(ms, f) : setTimeout(f, ms));
const aggiorna = () => { T.aggiornaPillola?.(); try { dispatchEvent(new CustomEvent('lode:progetto')); } catch { } };
const risposta = (testo, opz) => T.rispostaFissa?.(testo, opz);
const turno = testo => { T.nuovoTurno?.(); if (testo) T.detto?.(testo); };
const bottone = (s, sel, f) => s.querySelector(sel)?.addEventListener('click', async e => { const b = e.currentTarget; if (b.disabled) return; await T.premi?.(b); f(b); });
const leggiCapito = () => { try { return localStorage.getItem('lode:progetto:capito') === '1'; } catch { return false; } };
const segnaCapito = () => { try { localStorage.setItem('lode:progetto:capito', '1'); } catch { } };

function metti(x) { const p = P.get(x.id) || { id: x.id }; Object.assign(p, x); P.set(x.id, p); return p; }
export const stato = () => P;   // per le prove (window.__lode)

/* ---------- collegamento ---------- */
// strumenti: { scheda, segnala, entra, dopo, premi, rispostaFissa, mostraFatto, nuovoTurno, detto(testo), corsiPossibili, aggiornaPillola, evento? }
// evento(x), facoltativo, per il diario di F4: { tipo: 'segui'|'fatto'|'prova'|'smetti', id, nome, t, … }. Solo il nome del progetto, mai il percorso.
// spiegaErrore(esito), facoltativo, per F3: dopo una prova che non compila o che si ferma, la scheda «Errore» in italiano.
export function collega(strumenti = {}) {
  Object.assign(T, strumenti);
  if (collegato || !L) return; collegato = true;
  L.su('progetto:cambiato', x => {
    metti(x);
    if (x.motivo === 'modifica') {   // i file cambiano: la gemma pensa, e torna quieta se il «Fatto» tarda
      segnala('pensa'); clearTimeout(tQuiete); tQuiete = setTimeout(() => segnala('quiete'), (x.quieteMs || 60e3) + 3000);
    }
    rinfresca(x.id); aggiorna();
  });
  L.su('progetto:fatto', r => {
    const p = metti({ id: r.id }); p.riassunto = r; p.riassuntoVisto = false;
    clearTimeout(tQuiete); segnala('quiete');
    if (r.vecchio && r.codiceCambiato) dopo(450, () => segnala('conferma-pronta'));   // la gemma salta una volta: non provato
    evento({ tipo: 'fatto', id: r.id, nome: r.nome, t: r.a, frase: piano(r.frase), piu: r.piu, meno: r.meno, impronta: r.impronta, file: (r.file || []).map(f => ({ rel: f.rel, stato: f.stato, piu: f.piu, meno: f.meno, nuove: f.nuove || [], cambiate: f.cambiate || [], tolte: f.tolte || [] })), provato: r.provato });
    aggiorna();   // la pillola cambia sempre, il pannello non si apre mai da solo
  });
  L.su('progetto:uscita', uscita);
  L.su('progetto:esito', e => {
    metti({ id: e.id, ultimoEsito: e }); segnala(e.esito === 'ok' ? 'fatto' : 'quiete'); aggiorna();
    // stderr serve solo a chi riceve l'evento per dire il primo errore in italiano (errori.js): nel diario non va
    evento({ tipo: 'prova', id: e.id, nome: e.nome, t: e.quando, esito: e.esito, breve: e.breve, ok: e.ok, tot: e.tot, impronta: e.impronta, cambiatoDurante: !!e.cambiatoDurante,
      primo: e.primo ? { file: nomeCaso(e.primo.file), riga: e.primo.riga, messaggio: e.primo.messaggio } : null, stderr: e.esito === 'non-compila' ? e.compilazione?.stderr || '' : '' });
  });
  invoca('progetto:stato').then(r => { for (const x of r.progetti || []) metti(x); aggiorna(); });
}

/* ---------- la pillola e la riga in «Oggi» ---------- */
// lineaPillola: «lab3-liste · 2 file +41 −7», «lab3-liste · fatto · non provato», «lab3-liste · ✓ compila · 6/6 · 14:53».
// Solo con modifiche negli ultimi 30 minuti o un «non provato» delle ultime 2 ore.
export function lineaPillola(p, adesso = Date.now()) {
  if (!p?.nome || p.manca) return null;
  const MIN = 60e3, fai = (t, testo, pieno) => ({ id: p.id, t, pieno, testo: `${p.nome} · ${testo}`, html: `<b>${esc(p.nome)}</b><span class="ld-tenue">${esc(testo)}</span>` });
  if (p.provaInCorso) return fai(adesso, 'provo…', true);
  const up = p.ultimaProva, aggiornata = !!up && up.impronta === p.impronta, recente = p.ultima && adesso - p.ultima < 30 * MIN;
  const quieto = !p.ultima || adesso - p.ultima >= (p.quieteMs || 60e3);
  if (!quieto && recente && (p.piu || p.meno || p.nFile)) return fai(p.ultima, `${p.nFile ?? p.file?.length ?? 0} file +${p.piu || 0} −${p.meno || 0}`, true);
  if (aggiornata && (adesso - up.quando < 120 * MIN || recente)) return fai(up.quando, `${up.breve} · ${ora(up.quando)}`, up.esito !== 'ok');
  if (!aggiornata && p.ultimaCodice && adesso - p.ultimaCodice < 120 * MIN) return fai(p.ultimaCodice, 'fatto · non provato', true);
  return null;
}
// per aggiornaPillola() di lode.js: { html, testo, pieno } del progetto più recente che ha qualcosa da dire, o null
export function pillola(adesso = Date.now()) {
  let migliore = null;
  for (const p of P.values()) { const x = lineaPillola(p, adesso); if (x && (!migliore || x.t > migliore.t)) migliore = x; }
  return migliore;
}
// per righeOggi() di lode.js: { cls, t, d, n, b, f } come le altre righe, o null
export function rigaOggi(adesso = Date.now()) {
  const x = pillola(adesso); if (!x) return null;
  const p = P.get(x.id), r = p.riassunto, e = p.ultimoEsito;
  if (r && !p.riassuntoVisto && r.vecchio && r.codiceCambiato) return { cls: 'att', t: `${p.nome}: non provato`, d: piano(r.frase), n: '', b: 'Vedi', f: () => { turno('Cosa è cambiato'); schedaFatto(r); } };
  if (p.ultimaProva && p.ultimaProva.impronta === p.impronta && p.ultimaProva.esito !== 'ok') return { cls: 'urg', t: `${p.nome}: ${p.ultimaProva.breve}`, d: `L'ultima prova, alle ${ora(p.ultimaProva.quando)}`, n: '', b: e ? 'Esito' : 'Prova', f: () => { turno('Provato?'); e?.id === p.id ? schedaEsito(e) : prova(p.id); } };
  if (x.testo.includes(' file +')) return { cls: 'info', t: `${p.nome}: sta cambiando`, d: x.testo.split(' · ').slice(1).join(' · '), n: '', b: 'Vedi', f: () => { turno('Cosa sta cambiando'); schedaCambia(p.id); } };
  return null;
}

/* ---------- i comandi scritti ---------- */
const COMANDI = [
  [/^(?:segui|guarda|osserva)(?: (?:il|un|questo|un nuovo))? progetto(?: nuovo)?$/, () => ({ azione: 'segui' })],
  [/^cosa (?:è|e'|é|e) cambiat[oa](?: (?:in|nel|nella|di|del|su) (.+))?$/, m => ({ azione: 'cambiato', nome: m[1] })],
  [/^(?:mostra |vedi )?(?:le )?modifiche(?: (?:di|del|al|in|nel) (.+))?$/, m => ({ azione: 'cambiato', nome: m[1] })],
  [/^(?:l'ho )?provat[oa]$|^(?:è|e') provat[oa]$/, () => ({ azione: 'provato' })],
  [/^(?:prova|testa|verifica) (?:il |l')?(?:progetto|codice|programma)(?: (.+))?$/, m => ({ azione: 'prova', nome: m[1] })],
  // «compila» da solo, «compila il progetto/codice/programma [nome]» o «compila <nome di un progetto seguito>»:
  // «compila la relazione di fisica» o «compila il modulo Erasmus» non sono prove
  [/^compila(?: (?:il |l')?(?:progetto|codice|programma)(?: (.+))?)?$/, m => ({ azione: 'prova', nome: m[1] })],
  [/^compila (.+)$/, m => seguito(m[1]) ? { azione: 'prova', nome: m[1] } : null],
  [/^smetti di seguire(?: (?:il )?(?:progetto )?(.+))?$/, m => ({ azione: 'smetti', nome: m[1] })],
];
// «segui progetto», «cosa è cambiato», «provato?», «prova il progetto», «compila», «smetti di seguire lab3» → { tipo: 'progetto', azione, nome? }
export function interpreta(testo) {
  const t = String(testo || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim();
  for (const [re, f] of COMANDI) {
    const m = re.exec(t); if (!m) continue;
    const r = f(m); if (!r) continue;
    const c = { tipo: 'progetto', ...r }, nome = c.nome?.replace(/^(?:il |l')?(?:progetto|codice|programma)\b\s*/, '').trim();
    if (nome) c.nome = nome; else delete c.nome;
    return c;
  }
  return null;
}
export const ESEMPI = ['segui progetto', 'cosa è cambiato', 'provato?', 'prova il progetto'];
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
// un progetto che Lode segue, con questo nome esatto (per «compila lab3»)
const seguito = nome => !!norm(nome) && [...P.values()].some(p => norm(p.nome) === norm(nome));
function trova(nome) {
  if (!nome) return recente();
  const n = norm(nome); return [...P.values()].find(p => norm(p.nome) === n) || [...P.values()].find(p => p.nome && norm(p.nome).includes(n)) || null;
}
function recente() {
  const t = p => Math.max(p.ultima || 0, p.ultimaProva?.quando || 0, p.vista || 0);
  return [...P.values()].filter(p => p.nome).sort((a, b) => t(b) - t(a))[0] || null;
}
export async function esegui(c) {
  if (c.azione === 'segui') return segui();
  if (!attivo) return segui();
  if (!P.size) { const r = await invoca('progetto:stato'); for (const x of r.progetti || []) metti(x); }
  const p = trova(c.nome);
  if (!p) return risposta(c.nome && P.size ? `Non seguo nessun progetto che si chiama «${c.nome}».` : 'Non seguo nessun progetto. Scrivi **segui progetto** e scegli la cartella del laboratorio.');
  if (c.azione === 'cambiato') return schedaCambia(p.id);
  if (c.azione === 'provato') return schedaProvato(p.id);
  if (c.azione === 'prova') return prova(p.id);
  if (c.azione === 'smetti') return schedaSmetti(p.id);
}

/* ---------- seguire ---------- */
const CAPITO = 'Lode guarda i file e verifica se il codice è provato: non scrive codice al posto tuo. Se usi un agente o un\'AI, cosa è permesso lo decide il tuo corso: chiedi al docente. Il diario è un registro per te, non una prova per il prof: è quello che Lode ha visto, e non sa chi ha scritto le righe. Per una consegna valutata segna il progetto come "valutato": Lode ti dirà dove guardare e cosa vuol dire un errore, ma non ti mostrerà la correzione.';
// la prima volta, una volta sola: cosa fa Lode e cosa no
function schedaCapito() {
  return new Promise(fatto => {
    const s = T.scheda('ld-progetto ld-pcapito', `<span class="ld-lbl">Prima di cominciare</span><p class="ld-ptesto">${esc(CAPITO)}</p><div class="az"><button type="button" class="btn primary" data-capito>Ho capito</button></div>`);
    s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', 'Prima di cominciare');
    bottone(s, '[data-capito]', b => { b.disabled = true; segnaCapito(); fatto(); });
  });
}
export async function segui() {
  if (!attivo) return risposta('Seguire un progetto si può solo nell\'**app desktop** di Lode: lì guardo la cartella del tuo laboratorio.');
  const r = await invoca('progetto:scegli');
  if (r.annullato) return risposta('Va bene, non seguo niente.');
  if (r.errore) return risposta(r.errore, { errore: true });
  if (r.gia) { risposta(`Seguo già **${r.nome}**.`); const p = [...P.values()].find(x => x.nome === r.nome); return p ? schedaCambia(p.id) : null; }
  if (!leggiCapito()) await schedaCapito();
  return schedaSegui(r);
}
function schedaSegui(r) {
  const corsi = T.corsiPossibili?.() || [];
  const s = T.scheda('ld-conf ld-progetto ld-psegui', `<h3>Seguo <b>${esc(r.nome)}</b>?</h3>
    <p class="ld-ptesto">Guardo i file e tengo le versioni nella cartella di Lode: io nella tua cartella non scrivo. I comandi che confermi (per esempio make) sì, come dal terminale. Non so chi scrive le righe (tu, un agente o un copia-incolla): ti dico cosa è cambiato e se l'hai provato.</p>
    ${L?.piattaforma === 'win32' ? '<p class="ld-nota">Mentre la seguo, Windows non ti lascia rinominare o spostare la cartella: prima scrivi «smetti di seguire».</p>' : ''}
    <div class="ld-riga-form"><span class="ld-lbl">Corso</span><select aria-label="Corso">${['', ...corsi].map(c => `<option value="${esc(c)}">${c ? esc(c) : 'Nessun corso'}</option>`).join('')}</select></div>
    <div class="ld-preset"><button type="button" class="ld-chip larga" role="switch" aria-checked="false" data-valutato><b>Progetto valutato (consegna)</b><span>Ti dico dove guardare, ma niente correzioni pronte</span></button><button type="button" class="ld-chip larga" role="switch" aria-checked="false" data-nodiario><b>Non scrivere il diario di questo progetto</b><span>Nel vault non finiscono nomi di file né di funzioni</span></button></div>
    <p class="ld-nota">${r.file === 1 ? '1 file' : `${r.file} file`} · ${esc(r.percorso)}</p>
    <div class="az"><button type="button" class="btn primary" data-si>Segui</button><button type="button" class="btn ld-piano" data-no>Annulla</button></div>`);
  s.setAttribute('role', 'alertdialog'); s.setAttribute('aria-label', `Seguo ${r.nome}?`);
  // il corso di programmazione, se c'è; se no il primo
  if (corsi.length) s.querySelector('select').selectedIndex = 1 + Math.max(0, corsi.findIndex(c => /programmazione|informatica|algoritm|\blab(?:oratorio)?\s+(?:di\s+)?(?:c|python|java)\b/i.test(c)));
  const chip = s.querySelector('[data-valutato]'), noDiario = s.querySelector('[data-nodiario]');
  for (const c of [chip, noDiario]) c.addEventListener('click', () => { const on = c.getAttribute('aria-checked') !== 'true'; c.setAttribute('aria-checked', on); c.classList.toggle('on', on); T.premi?.(c); });
  bottone(s, '[data-no]', () => { s.querySelectorAll('button').forEach(b => { b.disabled = true; }); T.mostraFatto?.({ testo: 'Annullato.', nota: 'Non seguo niente.', no: true }, s); });
  bottone(s, '[data-si]', async () => {
    s.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const x = await invoca('progetto:segui', { token: r.token, corso: s.querySelector('select').value || null, valutato: chip.getAttribute('aria-checked') === 'true' });
    if (x.errore) { s.querySelectorAll('button').forEach(b => { b.disabled = false; }); return risposta(x.errore, { errore: true }); }
    metti(x); aggiorna(); evento({ tipo: 'segui', id: x.id, nome: x.nome, corso: x.corso, valutato: x.valutato, diario: noDiario.getAttribute('aria-checked') !== 'true' });
    T.mostraFatto?.({ testo: `Seguo ${x.nome}.`, nota: 'Ti dico cosa cambia e se l\'hai provato. Le versioni le tengo nella cartella di Lode.', sintesi: `seguo ${x.nome}` }, s);
  });
  s.querySelector('[data-si]').focus({ preventScroll: true });
  return s;
}
export function schedaSmetti(id) {
  const p = P.get(id); if (!p) return null;
  const s = T.scheda('ld-conf ld-progetto', `<h3>Smetto di seguire <b>${esc(p.nome)}</b>?</h3>
    <p class="ld-ptesto">Tolgo le copie che ho tenuto nella cartella di Lode. I tuoi file non li tocco.</p>
    <div class="az"><button type="button" class="btn primary" data-si>Smetti di seguire</button><button type="button" class="btn ld-piano" data-no>Annulla</button></div>`);
  bottone(s, '[data-no]', () => T.mostraFatto?.({ testo: 'Annullato.', nota: `Continuo a seguire ${p.nome}.`, no: true }, s));
  bottone(s, '[data-si]', async () => {
    const r = await invoca('progetto:smetti', { id }); if (r.errore) return risposta(r.errore, { errore: true });
    P.delete(id); aggiorna(); evento({ tipo: 'smetti', id, nome: p.nome });
    T.mostraFatto?.({ testo: `Non seguo più ${p.nome}.`, nota: 'Le copie di Lode sono andate. I tuoi file non li ho toccati.', sintesi: `smesso ${p.nome}` }, s);
  });
  return s;
}

/* ---------- «Cosa sta cambiando» e il diff ---------- */
const etichetta = f => f.stato === 'nuovo' ? 'nuovo' : f.stato === 'tolto' ? 'tolto' : f.grande ? 'file grande: solo i conteggi' : !f.piu && !f.meno ? 'solo spazi o a capo' : 'cambiato';
const rigaFile = (f, i) => `<div class="ld-riga ${f.stato}" data-i="${i}"><i class="ld-seg"></i><div class="t"><b>${esc(f.rel)}</b><span>${etichetta(f)}</span></div><span class="n">+${f.piu} −${f.meno}</span><button type="button" class="btn small" data-diff="${i}" aria-expanded="false">Diff</button></div>`;
// il diff in Geist Mono, bianco e nero: righe aggiunte con la barra bianca, tolte tenui e barrate, 3 righe di contesto
export function htmlDiff(d) {
  if (d.errore) return `<p class="ld-nota">${esc(d.errore)}</p>`;
  if (d.grande) return `<p class="ld-nota">File grande (+${d.piu} −${d.meno}): il dettaglio non lo mostro.</p>`;
  if (!d.blocchi?.length) return '<p class="ld-nota">Cambiano solo spazi in fondo alle righe o gli a capo.</p>';
  const riga = r => `<div class="r${r.t === '+' ? ' piu' : r.t === '-' ? ' meno' : ''}"><i>${r.t === '+' ? '+' : r.na ?? ''}</i><i>${r.t === '-' ? '−' : r.nb ?? ''}</i><span>${esc(r.s) || ' '}</span></div>`;
  return `<div class="ld-diff" role="region" aria-label="Modifiche a ${esc(d.rel)}">${d.blocchi.map((b, i) => (i ? '<div class="salto">···</div>' : '') + b.righe.map(riga).join('')).join('')}${d.tagliato ? '<div class="salto">… il resto non lo mostro</div>' : ''}</div>`;
}
// opz.da / opz.a: un tratto preciso (dal riassunto); senza, dall'ultimo «Visto» a adesso
export async function schedaCambia(id, opz = {}) {
  const p = P.get(id);
  const s = T.scheda('ld-progetto ld-pcambia', `<div class="capo"><span class="ld-lbl">${esc(opz.titolo || 'Cosa sta cambiando')}</span><span class="ld-tenue">${esc(p?.nome || '')}</span></div><div class="ld-pfile"></div><div class="az"></div>`);
  if (!opz.da) schedeCambia.set(id, s);
  await riempiCambia(s, id, opz);
  return s;
}
async function riempiCambia(s, id, opz = {}) {
  const r = await invoca('progetto:diff', { id, da: opz.da, a: opz.a });
  const box = s.querySelector('.ld-pfile'), az = s.querySelector('.az'), p = P.get(id) || {};
  if (r.errore) { box.innerHTML = `<p class="ld-nota">${esc(r.errore)}</p>`; return; }
  const dal = !opz.da && p.vista ? ` dalle ${ora(p.vista)}` : '';
  box.innerHTML = r.file.length ? r.file.map(rigaFile).join('') : `<p class="ld-ptesto">${opz.da ? 'Niente di diverso.' : `Niente di nuovo${dal ? dal : ''}.`}</p>`;
  if (r.file.length && dal) s.querySelector('.capo .ld-tenue').textContent = `${p.nome}${dal}`;
  box.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', async () => {
    const riga = b.closest('.ld-riga'), aperto = riga.nextElementSibling?.classList.contains('ld-pdiff');
    if (aperto) { riga.nextElementSibling.remove(); b.setAttribute('aria-expanded', 'false'); b.textContent = 'Diff'; return; }
    b.disabled = true;
    const f = r.file[+b.dataset.diff], d = await invoca('progetto:diff', { id, rel: f.rel, da: opz.da, a: opz.a });
    const el = document.createElement('div'); el.className = 'ld-pdiff'; el.innerHTML = htmlDiff({ ...d, rel: f.rel });
    riga.after(el); T.entra?.(el, { dy: 4, blur: 4, ms: 320 });
    b.disabled = false; b.setAttribute('aria-expanded', 'true'); b.textContent = 'Chiudi';
  }));
  const vecchio = p.vecchio !== false;
  az.innerHTML = `<button type="button" class="btn${vecchio ? ' primary' : ''}" data-prova>Prova adesso</button>${opz.da ? '' : '<button type="button" class="btn ld-piano" data-visto>Visto</button>'}${vecchio ? '' : '<span class="ld-tenue">provato</span>'}`;
  bottone(az, '[data-prova]', () => { turno('Prova il progetto'); prova(id); });
  bottone(az, '[data-visto]', () => visto(id, s));
}
// un evento nuovo: la scheda «Cosa sta cambiando» aperta si aggiorna (senza perdere il diff che lo studente sta leggendo)
function rinfresca(id) {
  const s = schedeCambia.get(id);
  if (!s?.isConnected) { schedeCambia.delete(id); return; }
  if (s.querySelector('.ld-pdiff')) return;
  riempiCambia(s, id);
}
async function visto(id, s) {
  const r = await invoca('progetto:visto', { id }); if (r.errore) return risposta(r.errore, { errore: true });
  metti(r); const p = P.get(id); if (p) p.riassuntoVisto = true; aggiorna();
  schedeCambia.delete(id);
  T.mostraFatto?.({ testo: 'Visto.', nota: 'Da qui in poi ti mostro solo le modifiche nuove.', sintesi: 'visto' }, s?.isConnected ? s : null);
}

/* ---------- «Fatto. In parole semplici» ---------- */
export function schedaFatto(r) {
  const p = metti({ id: r.id }); p.riassuntoVisto = true;
  const s = T.scheda('ld-progetto ld-pfatto', `<div class="capo"><span class="ld-lbl">Fatto. In parole semplici</span><span class="ld-tenue">${esc(r.nome)}</span></div>
    <p class="ld-ptesto">${md(r.frase)}</p>
    ${r.punti?.length ? `<ul>${r.punti.map(x => `<li>${md(x)}</li>`).join('')}</ul>` : ''}
    <p class="provato">${md(r.provatoTesto)}</p>
    <p class="ld-nota">${esc(r.nota)}</p>
    <div class="az"><button type="button" class="btn${r.vecchio ? ' primary' : ''}" data-prova>Prova adesso</button><button type="button" class="btn" data-diff>Vedi le modifiche</button><button type="button" class="btn ld-piano" data-visto>Visto</button></div>`);
  bottone(s, '[data-prova]', () => { turno('Prova il progetto'); prova(r.id); });
  bottone(s, '[data-diff]', () => { turno('Vedi le modifiche'); schedaCambia(r.id, { da: r.base, a: r.fine, titolo: `Modifiche · ${ora(r.da)}–${ora(r.a)}` }); });
  bottone(s, '[data-visto]', () => visto(r.id, s));
  return s;
}
// «provato?» scritto nel campo: la risposta è un conto, non un'opinione
export async function schedaProvato(id) {
  const r = await invoca('progetto:stato', { id }); if (r.errore) return risposta(r.errore, { errore: true });
  const p = metti(r.progetti[0]), up = p.ultimaProva;
  if (up && !p.vecchio) return risposta(`**Sì**: il codice di ${p.nome} è quello provato alle ${ora(up.quando)} (${up.breve}).`);
  const s = T.scheda('ld-progetto', `<p class="ld-ptesto">${up ? `<b>No</b>: dopo l'ultima prova (${ora(up.quando)}) il codice di ${esc(p.nome)} è cambiato${p.ultimaCodice ? `, l'ultima volta alle ${ora(p.ultimaCodice)}` : ''}.` : `<b>No</b>: ${esc(p.nome)} con Lode non l'hai ancora provato.`}</p>
    <p class="ld-nota">Non so chi ha scritto le righe: so solo se il codice di adesso è passato da una prova.</p>
    <div class="az"><button type="button" class="btn primary" data-prova>Prova adesso</button><button type="button" class="btn ld-piano" data-cambia>Cosa è cambiato</button></div>`);
  bottone(s, '[data-prova]', () => { turno('Prova il progetto'); prova(id); });
  bottone(s, '[data-cambia]', () => { turno('Cosa è cambiato'); schedaCambia(id); });
  return s;
}

/* ---------- provare ---------- */
// la prima volta (o se il progetto è cambiato): il comando che userebbe Lode, con [Usa questo] e [Cambia].
// cambiato: true se i file hanno cambiato forma, 'lancia' se ora ci sono prove da lanciare e prima si compilava soltanto
function schedaComando(p, x, cambiato) {
  const titolo = x.manca ? `Per provare ${p.nome} manca ${x.manca.cosa}` : `Come provo ${p.nome}?`;
  const casi = x.testoCasi ? (x.testoCasi.startsWith('poi') ? `, ${esc(x.testoCasi)}.` : `. ${esc(x.testoCasi)}`) : '.';
  const s = T.scheda('ld-conf ld-progetto ld-pcomando', `<h3>${esc(titolo)}</h3>
    ${x.manca ? `<p class="ld-ptesto">${md(x.manca.come)}</p>` : `<p class="ld-ptesto">${cambiato === 'lancia' ? 'Adesso ci sono prove .in/.out: per lanciare il programma mi serve un nuovo sì. ' : cambiato ? 'I file del progetto sono cambiati: il comando di prima non basta più. ' : ''}Per provare userei <code>${esc(x.testo)}</code>${casi}</p>`}
    ${(x.note || []).map(n => `<p class="ld-nota">${esc(n)}</p>`).join('')}
    <p class="ld-nota">Eseguo solo il comando che confermi nella finestra del sistema, mai uno proposto da un agente. Non è una sandbox: il programma gira sul tuo computer, come dal terminale, e può scrivere file nella tua cartella.</p>
    <div class="az">${x.manca ? '<button type="button" class="btn primary" data-riprova>Riprova</button>' : '<button type="button" class="btn primary" data-usa>Usa questo</button>'}<button type="button" class="btn" data-cambia>${x.manca ? 'Scrivo io il comando' : 'Cambia'}</button></div>
    <div class="ld-riga-form" hidden><input type="text" data-testo aria-label="Comando per provare" spellcheck="false" autocomplete="off"><button type="button" class="btn primary" data-mio>Usa questo comando</button></div>`);
  const conferma = async testo => {
    s.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const r = await invoca('progetto:conferma', { id: p.id, testo });
    if (r.annullato) return T.mostraFatto?.({ testo: 'Non eseguo niente.', nota: 'Il comando non l\'hai confermato.', no: true }, s);
    if (r.errore) { s.querySelectorAll('button').forEach(b => { b.disabled = false; }); return risposta(r.errore, { errore: true }); }
    await T.mostraFatto?.({ testo: 'Comando confermato.', nota: 'Per questo progetto lo uso sempre, finché i file non cambiano forma.', sintesi: 'comando confermato' }, s);
    prova(p.id);
  };
  bottone(s, '[data-usa]', () => conferma(null));
  bottone(s, '[data-riprova]', () => { s.querySelectorAll('button').forEach(b => { b.disabled = true; }); prova(p.id); });
  bottone(s, '[data-cambia]', () => {
    const f = s.querySelector('.ld-riga-form'), i = f.querySelector('input');
    f.hidden = false; i.value = x.testo || ''; i.focus(); T.entra?.(f, { dy: 4, blur: 4, ms: 320 });
  });
  const mio = () => { const t = s.querySelector('[data-testo]').value.trim(); if (t) conferma(t); };
  bottone(s, '[data-mio]', mio);
  s.querySelector('[data-testo]').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); mio(); } });
  if (!x.manca) dopo(520, () => segnala('conferma-pronta'));
  return s;
}
function uscita(x) {
  const pre = uscite.get(x.id); if (!pre?.isConnected) return;
  pre.hidden = false;
  if (x.fase === 'caso' && x.caso !== pre._caso) { pre._caso = x.caso; pre.textContent += `\n— prova ${nomeCaso(x.caso)} —\n`; }
  pre.textContent = (pre.textContent + x.testo).slice(-16000);
  pre.scrollTop = pre.scrollHeight;
}
export async function prova(id) {
  const p = P.get(id); if (!p) return risposta('Non seguo questo progetto.');
  let s = null;
  const attesa = setTimeout(() => {   // se la prova dura, si vede che lavora e scorre l'uscita
    s = T.scheda('ld-progetto ld-pesito', `<div class="capo"><span class="ld-lbl">Provato? · ${esc(p.nome)}</span><span class="ld-tenue">provo…</span></div><pre class="ld-puscita" aria-live="polite" hidden></pre>`);
    uscite.set(id, s.querySelector('.ld-puscita')); segnala('pensa');
  }, 250);
  const r = await invoca('progetto:prova', { id });
  clearTimeout(attesa); uscite.delete(id);
  if (r.inCorso) return risposta('Sto già provando questo progetto: un attimo.');
  if (r.errore) { s?.remove(); segnala('quiete'); return risposta(r.errore, { errore: true }); }
  if (r.serveConferma) { s?.remove(); return schedaComando(p, r.proposta, r.lancia ? 'lancia' : !!r.cambiato); }
  return schedaEsito(r, s);
}
const nomeCaso = n => String(n || '').split('/').pop();
const fmt = v => v == null ? 'niente' : v === '' ? 'una riga vuota' : `<code>${esc(v.length > 120 ? v.slice(0, 120) + '…' : v)}</code>`;
function fraseCaso(c) {
  const n = `Prova ${esc(nomeCaso(c.nome))}`;
  if (c.ok) return `${n}${c.codice ? ` · passa, ma il programma esce con il codice ${c.codice}` : ''}`;
  if (c.errore) return `${n}: ${esc(c.errore)}`;
  if (c.scaduto) return `${n}: non è finita in tempo. Un ciclo che non si ferma, o il programma aspetta altro input?`;
  if (c.troncato) return `${n}: ha scritto troppo (oltre 200 KB) e l'ho fermata.`;
  if (c.crash) return `${n}: il programma si è fermato con un errore${c.segnale ? ` (${esc(c.segnale)})` : c.codice != null ? ` (codice ${c.codice})` : ''}.`;
  return `${n} · riga ${c.riga}: atteso ${fmt(c.atteso)}, ottenuto ${fmt(c.ottenuto)}`;
}
const VERBI = { python: ['La sintassi è a posto', 'Errore di sintassi'], make: ['make è andato', 'make non è andato'] };
export function htmlEsito(e) {
  const [si, no] = VERBI[e.tipo] || ['Compila', 'Non compila'];
  const sec = e.durata ? ` · ${(e.durata / 1000).toFixed(1).replace('.', ',')} s` : '';
  let grande, frase;
  if (e.esito === 'ok') { grande = e.tot ? `${e.ok}<small>/${e.tot}</small>` : '✓'; frase = e.tot ? `${si} e passa ${e.tot === 1 ? 'la prova' : `tutte le ${e.tot} prove`}.` : `${si}. Non ci sono prove .in/.out: il programma non l'ho lanciato.`; }
  else if (e.esito === 'prove') { const k = e.tot - e.ok; grande = `${e.ok}<small>/${e.tot}</small>`; frase = `${k === 1 ? 'Una prova non passa' : `${k} prove non passano`} su ${e.tot}.`; }
  else if (e.esito === 'non-compila') { grande = '✗'; frase = `${no}${e.primo?.file ? `: ${esc(nomeCaso(e.primo.file))}${e.primo.riga ? `, riga ${e.primo.riga}` : ''}` : ''}.${e.messaggio ? ' ' + esc(e.messaggio) : ''}`; }
  else { grande = '✗'; frase = esc(e.messaggio || 'La prova non è partita.'); }
  const casi = [...(e.casi || [])].sort((a, b) => a.ok - b.ok);
  const male = casi.filter(c => !c.ok).slice(0, 8), bene = casi.filter(c => c.ok);
  const errori = e.esito === 'non-compila' || e.esito === 'errore' ? (e.compilazione?.stderr || e.compilazione?.stdout || '').split('\n').slice(0, 30).join('\n').trim() : '';
  return `<div class="capo"><span class="ld-lbl">Provato? · ${esc(e.nome || '')}</span><span class="ld-tenue">${ora(e.quando)}${sec}</span></div>
    <div class="ld-esito"><b>${grande}</b><span>${frase}</span></div>
    ${errori ? `<pre class="ld-puscita">${esc(errori)}</pre>` : ''}
    ${male.map(c => `<div class="ld-pcaso no"><span class="s">✗</span><span>${fraseCaso(c)}</span></div>`).join('')}
    ${bene.length ? `<div class="ld-pcaso"><span class="s">✓</span><span>${bene.length === 1 ? fraseCaso(bene[0]) : `Passano: ${bene.slice(0, 12).map(c => esc(nomeCaso(c.nome))).join(', ')}${bene.length > 12 ? '…' : ''}`}</span></div>` : ''}
    ${e.saltati?.length ? `<p class="ld-nota">${e.saltati.length === 1 ? 'Una prova saltata' : `${e.saltati.length} prove saltate`}: ${esc(e.saltati[0].motivo)}.</p>` : ''}
    ${e.compilazione?.avvisi && e.esito !== 'non-compila' ? `<p class="ld-nota">${e.compilazione.avvisi === 1 ? '1 avviso' : `${e.compilazione.avvisi} avvisi`} del compilatore.</p>` : ''}
    ${e.cambiatoDurante ? '<p class="ld-nota"><b>Il codice è cambiato mentre provavo: rifaccio?</b></p>' : ''}
    <div class="az"><button type="button" class="btn${e.cambiatoDurante ? ' primary' : ''}" data-rifai>${e.cambiatoDurante ? 'Rifai' : 'Prova di nuovo'}</button><button type="button" class="btn ld-piano" data-cambia>Cosa è cambiato</button></div>`;
}
// l'esito della prova; dove: la scheda «provo…» da sostituire
export function schedaEsito(e, dove) {
  metti({ id: e.id, ultimoEsito: e });
  let s;
  if (dove?.isConnected) { dove.innerHTML = htmlEsito(e); s = dove; T.entra?.(s, { dy: 4, blur: 4, ms: 360 }); }
  else s = T.scheda('ld-progetto ld-pesito', htmlEsito(e));
  bottone(s, '[data-rifai]', () => { turno('Prova di nuovo'); prova(e.id); });
  bottone(s, '[data-cambia]', () => { turno('Cosa è cambiato'); schedaCambia(e.id); });
  if (e.esito === 'non-compila' || e.casi?.some(c => c.crash || c.scaduto)) T.spiegaErrore?.(e);   // F3: l'errore spiegato, sotto
  return s;
}
