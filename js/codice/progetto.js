// «Segui il progetto» nella barra (F2 di docs/PROGETTO-INFORMATICA.md): lo stato che arriva dal main, il testo per la
// pillola e le schede «Seguo…?», «Cosa sta cambiando», «Fatto. In parole semplici» e «Provato?».
// Qui niente calcoli che contano: diff, riassunto, impronta e prove li fa il main (desktop/progetto.mjs), senza AI.
// La barra manda al main solo l'id del progetto: mai percorsi, mai comandi da eseguire. Lode propone, lo studente decide.
// lode.js passa i suoi strumenti con collega(), perché quelle funzioni sono interne a lode.js (come stampa.js).
import { coseNuove, linguaDi, segna, dati, cartaDa, esameDi } from './glossario.js';
import * as DI from './discussione.js';
import { t, numero } from '../lingua.js';

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
const invoca = (canale, x) => L ? L.invoca(canale, x).catch(e => ({ errore: e.message })) : Promise.resolve({ errore: t('progetto.solo-app') });
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
  if (p.provaInCorso) return fai(adesso, t('progetto.provo'), true);
  const up = p.ultimaProva, aggiornata = !!up && up.impronta === p.impronta, recente = p.ultima && adesso - p.ultima < 30 * MIN;
  const quieto = !p.ultima || adesso - p.ultima >= (p.quieteMs || 60e3);
  if (!quieto && recente && (p.piu || p.meno || p.nFile)) return { ...fai(p.ultima, t('progetto.file-cambiati', { n: p.nFile ?? p.file?.length ?? 0, piu: p.piu || 0, meno: p.meno || 0 }), true), cambia: true };
  if (aggiornata && (adesso - up.quando < 120 * MIN || recente)) return fai(up.quando, `${up.breve} · ${ora(up.quando)}`, up.esito !== 'ok');
  if (!aggiornata && p.ultimaCodice && adesso - p.ultimaCodice < 120 * MIN) return fai(p.ultimaCodice, t('progetto.fatto-non-provato'), true);
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
  if (r && !p.riassuntoVisto && r.vecchio && r.codiceCambiato) return { cls: 'att', t: t('progetto.oggi-non-provato', { nome: p.nome }), d: piano(r.frase), n: '', b: t('progetto.vedi'), f: () => { turno(t('progetto.cosa-e-cambiato')); schedaFatto(r); } };
  if (p.ultimaProva && p.ultimaProva.impronta === p.impronta && p.ultimaProva.esito !== 'ok') return { cls: 'urg', t: t('progetto.oggi-esito', { nome: p.nome, breve: p.ultimaProva.breve }), d: t('progetto.ultima-prova-alle', { ora: ora(p.ultimaProva.quando) }), n: '', b: e ? t('progetto.esito') : t('progetto.prova'), f: () => { turno(t('progetto.provato')); e?.id === p.id ? schedaEsito(e) : prova(p.id); } };
  if (x.cambia) return { cls: 'info', t: t('progetto.oggi-sta-cambiando', { nome: p.nome }), d: x.testo.split(' · ').slice(1).join(' · '), n: '', b: t('progetto.vedi'), f: () => { turno(t('progetto.cosa-sta-cambiando')); schedaCambia(p.id); } };
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
  // «Pronto per la discussione» (discussione.js): «preparami alla discussione di lab3», «pronto per la discussione», «funzioni da
  // spiegare di lab3». Con un nome, in tutte le forme, solo se è un progetto seguito o ha l'aria di un laboratorio (un numero,
  // «lab», «progetto»): «sono pronta per la discussione della tesi» o «preparami alla discussione di laurea» restano all'AI
  [/^(?:preparami|prepararmi|preparami bene|prepara(?:mi)?) (?:alla|per la|la) discussione(?: (?:di|del|della|dello|per|su|sul) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:sono )?pront[oa] per la discussione(?: (?:di|del|della|dello|su|sul) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:le )?funzioni da spiegare(?: (?:di|del|della|dello|in|nel) (.+))?$/, m => perDiscussione(m[1])],
  [/^discussione$/, () => ({ azione: 'discussione' })],
  [/^discussione (?:di|del|della|dello|su|sul) (.+)$/, m => perDiscussione(m[1])],
];
// la guardia delle frasi di «Pronto per la discussione»: senza nome il progetto più recente, con un nome solo un laboratorio
function perDiscussione(nome) {
  if (!nome) return { azione: 'discussione' };
  return seguito(nome.replace(/^(?:il |l')?progetto\s+/, '')) || /\d|\blab|progett/.test(nome) ? { azione: 'discussione', nome } : null;
}
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
const SERVE_SEGUITO = t('progetto.serve-seguito');
export async function esegui(c) {
  if (c.azione === 'segui') return segui();
  if (c.azione === 'discussione' && !attivo) return risposta(SERVE_SEGUITO);
  if (!attivo) return segui();
  if (!P.size) { const r = await invoca('progetto:stato'); for (const x of r.progetti || []) metti(x); }
  const p = trova(c.nome);
  if (!p) return risposta(c.nome && P.size ? t('progetto.non-seguo-nome', { nome: c.nome }) : c.azione === 'discussione' ? SERVE_SEGUITO : t('progetto.non-seguo-niente'));
  if (c.azione === 'discussione') return DI.scheda(p, T, invoca);
  if (c.azione === 'cambiato') return schedaCambia(p.id);
  if (c.azione === 'provato') return schedaProvato(p.id);
  if (c.azione === 'prova') return prova(p.id);
  if (c.azione === 'smetti') return schedaSmetti(p.id);
}

/* ---------- seguire ---------- */
const CAPITO = t('progetto.capito-testo');
// la prima volta, una volta sola: cosa fa Lode e cosa no
function schedaCapito() {
  return new Promise(fatto => {
    const s = T.scheda('ld-progetto ld-pcapito', `<span class="ld-lbl">${t('progetto.prima-di-cominciare')}</span><p class="ld-ptesto">${esc(CAPITO)}</p><div class="az"><button type="button" class="btn primary" data-capito>${t('progetto.ho-capito')}</button></div>`);
    s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', t('progetto.prima-di-cominciare'));
    bottone(s, '[data-capito]', b => { b.disabled = true; segnaCapito(); fatto(); });
  });
}
export async function segui() {
  if (!attivo) return risposta(t('progetto.solo-app-desktop'));
  const r = await invoca('progetto:scegli');
  if (r.annullato) return risposta(t('progetto.va-bene-non-seguo'));
  if (r.errore) return risposta(r.errore, { errore: true });
  if (r.gia) { risposta(t('progetto.seguo-gia', { nome: r.nome })); const p = [...P.values()].find(x => x.nome === r.nome); return p ? schedaCambia(p.id) : null; }
  if (!leggiCapito()) await schedaCapito();
  return schedaSegui(r);
}
function schedaSegui(r) {
  const corsi = T.corsiPossibili?.() || [];
  const s = T.scheda('ld-conf ld-progetto ld-psegui', `<h3>${t('progetto.seguo-domanda', { nome: esc(r.nome) })}</h3>
    <p class="ld-ptesto">${t('progetto.seguo-spiega')}</p>
    ${L?.piattaforma === 'win32' ? `<p class="ld-nota">${t('progetto.nota-windows')}</p>` : ''}
    <div class="ld-riga-form"><span class="ld-lbl">${t('progetto.corso')}</span><select aria-label="${t('progetto.corso')}">${['', ...corsi].map(c => `<option value="${esc(c)}">${c ? esc(c) : t('progetto.nessun-corso')}</option>`).join('')}</select></div>
    <div class="ld-preset"><button type="button" class="ld-chip larga" role="switch" aria-checked="false" data-valutato><b>${t('progetto.valutato')}</b><span>${t('progetto.valutato-spiega')}</span></button><button type="button" class="ld-chip larga" role="switch" aria-checked="false" data-nodiario><b>${t('progetto.no-diario')}</b><span>${t('progetto.no-diario-spiega')}</span></button></div>
    <p class="ld-nota">${t('progetto.n-file', { n: r.file })} · ${esc(r.percorso)}</p>
    <div class="az"><button type="button" class="btn primary" data-si>${t('progetto.segui')}</button><button type="button" class="btn ld-piano" data-no>${t('progetto.annulla')}</button></div>`);
  s.setAttribute('role', 'alertdialog'); s.setAttribute('aria-label', t('progetto.seguo-aria', { nome: r.nome }));
  // il corso di programmazione, se c'è; se no il primo
  if (corsi.length) s.querySelector('select').selectedIndex = 1 + Math.max(0, corsi.findIndex(c => /programmazione|informatica|algoritm|\blab(?:oratorio)?\s+(?:di\s+)?(?:c|python|java)\b/i.test(c)));
  const chip = s.querySelector('[data-valutato]'), noDiario = s.querySelector('[data-nodiario]');
  for (const c of [chip, noDiario]) c.addEventListener('click', () => { const on = c.getAttribute('aria-checked') !== 'true'; c.setAttribute('aria-checked', on); c.classList.toggle('on', on); T.premi?.(c); });
  bottone(s, '[data-no]', () => { s.querySelectorAll('button').forEach(b => { b.disabled = true; }); T.mostraFatto?.({ testo: t('progetto.annullato'), nota: t('progetto.non-seguo-niente-nota'), no: true }, s); });
  bottone(s, '[data-si]', async () => {
    s.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const x = await invoca('progetto:segui', { token: r.token, corso: s.querySelector('select').value || null, valutato: chip.getAttribute('aria-checked') === 'true' });
    if (x.errore) { s.querySelectorAll('button').forEach(b => { b.disabled = false; }); return risposta(x.errore, { errore: true }); }
    metti(x); aggiorna(); evento({ tipo: 'segui', id: x.id, nome: x.nome, corso: x.corso, valutato: x.valutato, diario: noDiario.getAttribute('aria-checked') !== 'true' });
    T.mostraFatto?.({ testo: t('progetto.seguo-fatto', { nome: x.nome }), nota: t('progetto.seguo-fatto-nota'), sintesi: t('progetto.seguo-sintesi', { nome: x.nome }) }, s);
  });
  s.querySelector('[data-si]').focus({ preventScroll: true });
  return s;
}
// [Preparati alla discussione] della scheda del turno (lode.js): la stessa scheda del comando, per il progetto del turno
export function discussione(id) {
  const p = P.get(id);
  return p?.nome ? DI.scheda(p, T, invoca) : risposta(SERVE_SEGUITO);
}
export function schedaSmetti(id) {
  const p = P.get(id); if (!p) return null;
  const s = T.scheda('ld-conf ld-progetto', `<h3>${t('progetto.smetto-domanda', { nome: esc(p.nome) })}</h3>
    <p class="ld-ptesto">${t('progetto.smetto-spiega')}</p>
    <div class="az"><button type="button" class="btn primary" data-si>${t('progetto.smetti-di-seguire')}</button><button type="button" class="btn ld-piano" data-no>${t('progetto.annulla')}</button></div>`);
  bottone(s, '[data-no]', () => T.mostraFatto?.({ testo: t('progetto.annullato'), nota: t('progetto.continuo-a-seguire', { nome: p.nome }), no: true }, s));
  bottone(s, '[data-si]', async () => {
    const r = await invoca('progetto:smetti', { id }); if (r.errore) return risposta(r.errore, { errore: true });
    P.delete(id); aggiorna(); evento({ tipo: 'smetti', id, nome: p.nome });
    T.mostraFatto?.({ testo: t('progetto.non-seguo-piu', { nome: p.nome }), nota: t('progetto.non-seguo-piu-nota'), sintesi: t('progetto.smesso-sintesi', { nome: p.nome }) }, s);
  });
  return s;
}

/* ---------- «Cosa sta cambiando» e il diff ---------- */
const etichetta = f => f.stato === 'nuovo' ? t('progetto.etichetta-nuovo') : f.stato === 'tolto' ? t('progetto.etichetta-tolto') : f.grande ? t('progetto.etichetta-grande') : !f.piu && !f.meno ? t('progetto.etichetta-spazi') : t('progetto.etichetta-cambiato');
const rigaFile = (f, i) => `<div class="ld-riga ${f.stato}" data-i="${i}"><i class="ld-seg"></i><div class="t"><b>${esc(f.rel)}</b><span>${etichetta(f)}</span></div><span class="n">+${f.piu} −${f.meno}</span><button type="button" class="btn small" data-diff="${i}" aria-expanded="false">${t('progetto.diff')}</button></div>`;
// il diff in Geist Mono, bianco e nero: righe aggiunte con la barra bianca, tolte tenui e barrate, 3 righe di contesto
export function htmlDiff(d) {
  if (d.errore) return `<p class="ld-nota">${esc(d.errore)}</p>`;
  if (d.grande) return `<p class="ld-nota">${t('progetto.diff-grande', { piu: d.piu, meno: d.meno })}</p>`;
  if (!d.blocchi?.length) return `<p class="ld-nota">${t('progetto.diff-solo-spazi')}</p>`;
  const riga = r => `<div class="r${r.t === '+' ? ' piu' : r.t === '-' ? ' meno' : ''}"><i>${r.t === '+' ? '+' : r.na ?? ''}</i><i>${r.t === '-' ? '−' : r.nb ?? ''}</i><span>${esc(r.s) || ' '}</span></div>`;
  return `<div class="ld-diff" role="region" aria-label="${t('progetto.diff-aria', { file: esc(d.rel) })}">${d.blocchi.map((b, i) => (i ? '<div class="salto">···</div>' : '') + b.righe.map(riga).join('')).join('')}${d.tagliato ? `<div class="salto">${t('progetto.diff-tagliato')}</div>` : ''}</div>`;
}
// opz.da / opz.a: un tratto preciso (dal riassunto); senza, dall'ultimo «Visto» a adesso
export async function schedaCambia(id, opz = {}) {
  const p = P.get(id);
  const s = T.scheda('ld-progetto ld-pcambia', `<div class="capo"><span class="ld-lbl">${esc(opz.titolo || t('progetto.cosa-sta-cambiando'))}</span><span class="ld-tenue">${esc(p?.nome || '')}</span></div><div class="ld-pfile"></div><div class="az"></div>`);
  if (!opz.da) schedeCambia.set(id, s);
  await riempiCambia(s, id, opz);
  return s;
}
async function riempiCambia(s, id, opz = {}) {
  const r = await invoca('progetto:diff', { id, da: opz.da, a: opz.a });
  const box = s.querySelector('.ld-pfile'), az = s.querySelector('.az'), p = P.get(id) || {};
  if (r.errore) { box.innerHTML = `<p class="ld-nota">${esc(r.errore)}</p>`; return; }
  const dal = !opz.da && p.vista ? ora(p.vista) : '';
  box.innerHTML = r.file.length ? r.file.map(rigaFile).join('') : `<p class="ld-ptesto">${opz.da ? t('progetto.niente-di-diverso') : dal ? t('progetto.niente-di-nuovo-dalle', { ora: dal }) : t('progetto.niente-di-nuovo')}</p>`;
  if (r.file.length && dal) s.querySelector('.capo .ld-tenue').textContent = t('progetto.nome-dalle', { nome: p.nome, ora: dal });
  box.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', async () => {
    const riga = b.closest('.ld-riga'), aperto = riga.nextElementSibling?.classList.contains('ld-pdiff');
    if (aperto) { riga.nextElementSibling.remove(); b.setAttribute('aria-expanded', 'false'); b.textContent = t('progetto.diff'); return; }
    b.disabled = true;
    const f = r.file[+b.dataset.diff], d = await invoca('progetto:diff', { id, rel: f.rel, da: opz.da, a: opz.a });
    const el = document.createElement('div'); el.className = 'ld-pdiff'; el.innerHTML = htmlDiff({ ...d, rel: f.rel });
    riga.after(el); T.entra?.(el, { dy: 4, blur: 4, ms: 320 });
    b.disabled = false; b.setAttribute('aria-expanded', 'true'); b.textContent = t('progetto.chiudi');
  }));
  const vecchio = p.vecchio !== false;
  az.innerHTML = `<button type="button" class="btn${vecchio ? ' primary' : ''}" data-prova>${t('progetto.prova-adesso')}</button>${opz.da ? '' : `<button type="button" class="btn ld-piano" data-visto>${t('progetto.visto')}</button>`}${vecchio ? '' : `<span class="ld-tenue">${t('progetto.provato-breve')}</span>`}`;
  bottone(az, '[data-prova]', () => { turno(t('progetto.prova-il-progetto')); prova(id); });
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
  T.mostraFatto?.({ testo: t('progetto.visto-fatto'), nota: t('progetto.visto-nota'), sintesi: t('progetto.visto-sintesi') }, s?.isConnected ? s : null);
}

/* ---------- «Fatto. In parole semplici» ---------- */
export function schedaFatto(r) {
  const p = metti({ id: r.id }); p.riassuntoVisto = true;
  const s = T.scheda('ld-progetto ld-pfatto', `<div class="capo"><span class="ld-lbl">${t('progetto.fatto-titolo')}</span><span class="ld-tenue">${esc(r.nome)}</span></div>
    <p class="ld-ptesto">${md(r.frase)}</p>
    ${r.punti?.length ? `<ul>${r.punti.map(x => `<li>${md(x)}</li>`).join('')}</ul>` : ''}
    <p class="provato">${md(r.provatoTesto)}</p>
    <p class="ld-nota">${esc(r.nota)}</p>
    <div class="az"><button type="button" class="btn${r.vecchio ? ' primary' : ''}" data-prova>${t('progetto.prova-adesso')}</button><button type="button" class="btn" data-diff>${t('progetto.vedi-le-modifiche')}</button><button type="button" class="btn ld-piano" data-visto>${t('progetto.visto')}</button></div>`);
  bottone(s, '[data-prova]', () => { turno(t('progetto.prova-il-progetto')); prova(r.id); });
  bottone(s, '[data-diff]', () => { turno(t('progetto.vedi-le-modifiche')); schedaCambia(r.id, { da: r.base, a: r.fine, titolo: t('progetto.modifiche-tratto', { da: ora(r.da), a: ora(r.a) }) }); });
  bottone(s, '[data-visto]', () => visto(r.id, s));
  coseNuoveDi(r.id, { da: r.base, a: r.fine }).then(l => mostraCoseNuove(s, l));
  return s;
}
// «provato?» scritto nel campo: la risposta è un conto, non un'opinione
export async function schedaProvato(id) {
  const r = await invoca('progetto:stato', { id }); if (r.errore) return risposta(r.errore, { errore: true });
  const p = metti(r.progetti[0]), up = p.ultimaProva;
  if (up && !p.vecchio) return risposta(t('progetto.provato-si', { nome: p.nome, ora: ora(up.quando), breve: up.breve }));
  const s = T.scheda('ld-progetto', `<p class="ld-ptesto">${up ? (p.ultimaCodice ? t('progetto.provato-no-cambiato-alle', { ora: ora(up.quando), nome: esc(p.nome), ultima: ora(p.ultimaCodice) }) : t('progetto.provato-no-cambiato', { ora: ora(up.quando), nome: esc(p.nome) })) : t('progetto.provato-no-mai', { nome: esc(p.nome) })}</p>
    <p class="ld-nota">${t('progetto.provato-nota')}</p>
    <div class="az"><button type="button" class="btn primary" data-prova>${t('progetto.prova-adesso')}</button><button type="button" class="btn ld-piano" data-cambia>${t('progetto.cosa-e-cambiato')}</button></div>`);
  bottone(s, '[data-prova]', () => { turno(t('progetto.prova-il-progetto')); prova(id); });
  bottone(s, '[data-cambia]', () => { turno(t('progetto.cosa-e-cambiato')); schedaCambia(id); });
  return s;
}

/* ---------- provare ---------- */
// la prima volta (o se il progetto è cambiato): il comando che userebbe Lode, con [Usa questo] e [Cambia].
// cambiato: true se i file hanno cambiato forma, 'lancia' se ora ci sono prove da lanciare e prima si compilava soltanto
function schedaComando(p, x, cambiato) {
  const titolo = x.manca ? t('progetto.comando-manca', { nome: p.nome, cosa: x.manca.cosa }) : t('progetto.comando-come', { nome: p.nome });
  const casi = x.testoCasi ? (x.testoCasi.startsWith('poi') ? `, ${esc(x.testoCasi)}.` : `. ${esc(x.testoCasi)}`) : '.';
  const s = T.scheda('ld-conf ld-progetto ld-pcomando', `<h3>${esc(titolo)}</h3>
    ${x.manca ? `<p class="ld-ptesto">${md(x.manca.come)}</p>` : `<p class="ld-ptesto">${cambiato === 'lancia' ? t('progetto.comando-lancia') + ' ' : cambiato ? t('progetto.comando-cambiato') + ' ' : ''}${t('progetto.comando-userei', { comando: esc(x.testo) })}${casi}</p>`}
    ${(x.note || []).map(n => `<p class="ld-nota">${esc(n)}</p>`).join('')}
    <p class="ld-nota">${t('progetto.comando-nota')}</p>
    <div class="az">${x.manca ? `<button type="button" class="btn primary" data-riprova>${t('progetto.riprova')}</button>` : `<button type="button" class="btn primary" data-usa>${t('progetto.usa-questo')}</button>`}<button type="button" class="btn" data-cambia>${x.manca ? t('progetto.scrivo-io') : t('progetto.cambia')}</button></div>
    <div class="ld-riga-form" hidden><input type="text" data-testo aria-label="${t('progetto.comando-aria')}" spellcheck="false" autocomplete="off"><button type="button" class="btn primary" data-mio>${t('progetto.usa-questo-comando')}</button></div>`);
  const conferma = async testo => {
    s.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const r = await invoca('progetto:conferma', { id: p.id, testo });
    if (r.annullato) return T.mostraFatto?.({ testo: t('progetto.non-eseguo'), nota: t('progetto.non-confermato'), no: true }, s);
    if (r.errore) { s.querySelectorAll('button').forEach(b => { b.disabled = false; }); return risposta(r.errore, { errore: true }); }
    await T.mostraFatto?.({ testo: t('progetto.comando-confermato'), nota: t('progetto.comando-confermato-nota'), sintesi: t('progetto.comando-confermato-sintesi') }, s);
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
  if (x.fase === 'caso' && x.caso !== pre._caso) { pre._caso = x.caso; pre.textContent += `\n${t('progetto.uscita-caso', { caso: nomeCaso(x.caso) })}\n`; }
  pre.textContent = (pre.textContent + x.testo).slice(-16000);
  pre.scrollTop = pre.scrollHeight;
}
export async function prova(id) {
  const p = P.get(id); if (!p) return risposta(t('progetto.non-seguo-questo'));
  let s = null;
  const attesa = setTimeout(() => {   // se la prova dura, si vede che lavora e scorre l'uscita
    s = T.scheda('ld-progetto ld-pesito', `<div class="capo"><span class="ld-lbl">${t('progetto.provato')} · ${esc(p.nome)}</span><span class="ld-tenue">${t('progetto.provo')}</span></div><pre class="ld-puscita" aria-live="polite" hidden></pre>`);
    uscite.set(id, s.querySelector('.ld-puscita')); segnala('pensa');
  }, 250);
  const r = await invoca('progetto:prova', { id });
  clearTimeout(attesa); uscite.delete(id);
  if (r.inCorso) return risposta(t('progetto.sto-gia-provando'));
  if (r.errore) { s?.remove(); segnala('quiete'); return risposta(r.errore, { errore: true }); }
  if (r.serveConferma) { s?.remove(); return schedaComando(p, r.proposta, r.lancia ? 'lancia' : !!r.cambiato); }
  return schedaEsito(r, s);
}
const nomeCaso = n => String(n || '').split('/').pop();
const fmt = v => v == null ? t('progetto.niente') : v === '' ? t('progetto.riga-vuota') : `<code>${esc(v.length > 120 ? v.slice(0, 120) + '…' : v)}</code>`;
function fraseCaso(c) {
  const caso = esc(nomeCaso(c.nome));
  if (c.ok) return c.codice ? t('progetto.caso-ok-codice', { caso, codice: c.codice }) : t('progetto.caso-ok', { caso });
  if (c.errore) return t('progetto.caso-errore', { caso, errore: esc(c.errore) });
  if (c.scaduto) return t('progetto.caso-scaduto', { caso });
  if (c.troncato) return t('progetto.caso-troncato', { caso });
  if (c.crash) return c.segnale ? t('progetto.caso-crash-segnale', { caso, segnale: esc(c.segnale) }) : c.codice != null ? t('progetto.caso-crash-codice', { caso, codice: c.codice }) : t('progetto.caso-crash', { caso });
  return t('progetto.caso-diverso', { caso, riga: c.riga, atteso: fmt(c.atteso), ottenuto: fmt(c.ottenuto) });
}
const VERBI = { python: [t('progetto.sintassi-ok'), t('progetto.sintassi-errore')], make: [t('progetto.make-ok'), t('progetto.make-errore')] };
export function htmlEsito(e) {
  const [si, no] = VERBI[e.tipo] || [t('progetto.compila'), t('progetto.non-compila')];
  const sec = e.durata ? ` · ${t('progetto.durata', { s: numero(e.durata / 1000, 1) })}` : '';
  let grande, frase;
  if (e.esito === 'ok') { grande = e.tot ? `${e.ok}<small>/${e.tot}</small>` : '✓'; frase = e.tot ? t('progetto.esito-passa', { si, n: e.tot }) : t('progetto.esito-senza-prove', { si }); }
  else if (e.esito === 'prove') { const k = e.tot - e.ok; grande = `${e.ok}<small>/${e.tot}</small>`; frase = t('progetto.esito-non-passano', { n: k, tot: e.tot }); }
  else if (e.esito === 'non-compila') { grande = '✗'; frase = `${e.primo?.file ? (e.primo.riga ? t('progetto.non-compila-file-riga', { no, file: esc(nomeCaso(e.primo.file)), riga: e.primo.riga }) : t('progetto.non-compila-file', { no, file: esc(nomeCaso(e.primo.file)) })) : t('progetto.non-compila-frase', { no })}${e.messaggio ? ' ' + esc(e.messaggio) : ''}`; }
  else { grande = '✗'; frase = esc(e.messaggio || t('progetto.non-partita')); }
  const casi = [...(e.casi || [])].sort((a, b) => a.ok - b.ok);
  const male = casi.filter(c => !c.ok).slice(0, 8), bene = casi.filter(c => c.ok);
  const errori = e.esito === 'non-compila' || e.esito === 'errore' ? (e.compilazione?.stderr || e.compilazione?.stdout || '').split('\n').slice(0, 30).join('\n').trim() : '';
  return `<div class="capo"><span class="ld-lbl">${t('progetto.provato')} · ${esc(e.nome || '')}</span><span class="ld-tenue">${ora(e.quando)}${sec}</span></div>
    <div class="ld-esito"><b>${grande}</b><span>${frase}</span></div>
    ${errori ? `<pre class="ld-puscita">${esc(errori)}</pre>` : ''}
    ${male.map(c => `<div class="ld-pcaso no"><span class="s">✗</span><span>${fraseCaso(c)}</span></div>`).join('')}
    ${bene.length ? `<div class="ld-pcaso"><span class="s">✓</span><span>${bene.length === 1 ? fraseCaso(bene[0]) : `${t('progetto.passano', { nomi: bene.slice(0, 12).map(c => esc(nomeCaso(c.nome))).join(', ') })}${bene.length > 12 ? '…' : ''}`}</span></div>` : ''}
    ${e.saltati?.length ? `<p class="ld-nota">${t('progetto.saltate', { n: e.saltati.length, motivo: esc(e.saltati[0].motivo) })}</p>` : ''}
    ${e.compilazione?.avvisi && e.esito !== 'non-compila' ? `<p class="ld-nota">${t('progetto.avvisi', { n: e.compilazione.avvisi })}</p>` : ''}
    ${e.cambiatoDurante ? `<p class="ld-nota">${t('progetto.cambiato-durante')}</p>` : ''}
    <div class="az"><button type="button" class="btn${e.cambiatoDurante ? ' primary' : ''}" data-rifai>${e.cambiatoDurante ? t('progetto.rifai') : t('progetto.prova-di-nuovo')}</button><button type="button" class="btn ld-piano" data-cambia>${t('progetto.cosa-e-cambiato')}</button></div>`;
}
// l'esito della prova; dove: la scheda «provo…» da sostituire
export function schedaEsito(e, dove) {
  metti({ id: e.id, ultimoEsito: e });
  let s;
  if (dove?.isConnected) { dove.innerHTML = htmlEsito(e); s = dove; T.entra?.(s, { dy: 4, blur: 4, ms: 360 }); }
  else s = T.scheda('ld-progetto ld-pesito', htmlEsito(e));
  bottone(s, '[data-rifai]', () => { turno(t('progetto.prova-di-nuovo')); prova(e.id); });
  bottone(s, '[data-cambia]', () => { turno(t('progetto.cosa-e-cambiato')); schedaCambia(e.id); });
  if (e.esito === 'non-compila' || e.casi?.some(c => c.crash || c.scaduto)) T.spiegaErrore?.(e);   // F3: l'errore spiegato, sotto
  return s;
}

/* ---------- «Cose nuove»: le funzioni di libreria comparse nelle righe aggiunte (glossario.js, senza AI) ---------- */
// Per i file cambiati serve anche il file intero di adesso (progetto:righe, 400 righe a chiamata, fino a 2000): il diff ha solo
// 3 righe di contesto e un malloc vecchio a riga 10 non lo vede. Se il file non arriva tutto → null, e vale solo il diff
async function fileIntero(chiedi, id, rel) {
  const out = [];
  for (let da = 1; da <= 2000; da += 400) {
    const x = await chiedi('progetto:righe', { id, rel, da, a: da + 399 }).catch(() => null);
    if (!x || x.errore || !Array.isArray(x.righe) || !Number.isFinite(x.totale)) return null;
    out.push(...x.righe.map(r => r?.s ?? ''));
    if (out.length >= x.totale) return out;
    if (!x.righe.length) return null;
  }
  return null;
}
// Il tratto da/a (come schedaCambia), poi il diff dei soli file C/Java/Python: al massimo 10, non quelli grandi o tagliati.
// Se qualcosa va storto restituisce [] in silenzio: la scheda di base non si rompe mai. opz.invoca e opz.dati per le prove
export async function coseNuoveDi(id, opz = {}) {
  try {
    const chiedi = opz.invoca || (attivo ? invoca : null); if (!chiedi) return [];
    const r = await chiedi('progetto:diff', { id, da: opz.da, a: opz.a });
    const scelti = (r?.file || []).filter(f => f && linguaDi(f.rel) && !f.grande && f.stato !== 'tolto' && (f.piu || f.stato === 'nuovo')).slice(0, 10);
    if (!scelti.length) return [];
    const file = [];
    for (const f of scelti) {
      const d = await chiedi('progetto:diff', { id, rel: f.rel, da: opz.da, a: opz.a }); if (!d || d.errore || d.grande || d.tagliato) continue;
      file.push({ ...d, rel: f.rel, attuale: f.stato === 'cambiato' ? await fileIntero(chiedi, id, f.rel) : null });
    }
    const { D } = opz.dati || await dati();
    return coseNuove(file, { visti: D.codice?.glossario?.visti || {}, carte: D.carte || [] }).map(x => ({ ...x, id }));
  } catch (e) { console.warn('Lode: cose nuove', e); return []; }
}
const NOTA_CN = t('progetto.nota-cose-nuove');
// l'HTML della sezione (puro: si prova in Node). Ogni voce è chiusa: il nome; un clic apre file, riga e la domanda
export function htmlCoseNuove(lista) {
  if (!lista?.length) return '';
  const voce = (x, i) => `<div class="voce" data-i="${i}"><button type="button" class="apri" aria-expanded="false"><code>${esc(x.voce.k)}</code><span class="ld-tenue">${t('progetto.file-riga', { file: esc(x.rel), riga: esc(x.riga) })}</span></button>
    <div class="corpo" hidden><p class="dove"><b>${t('progetto.file-riga', { file: esc(x.rel), riga: esc(x.riga) })}</b></p><pre class="riga">${esc(x.testo)}</pre>
    <p class="dom"><span class="ld-tenue">${t('progetto.domanda-orale')}</span> ${esc(x.voce.d)}</p>
    <div class="az"><button type="button" class="btn small" data-risposta>${t('progetto.risposta')}</button></div></div></div>`;
  return `<p class="tit">${t('progetto.cose-nuove', { nomi: lista.map(x => `<code>${esc(x.voce.k)}</code>`).join(', ') })}</p>${lista.map(voce).join('')}<p class="ld-nota">${esc(NOTA_CN)}</p>`;
}
// «Mettila nel ripasso»: la carta (domanda davanti, risposta e fonte dietro) nell'esame del corso, e la voce non torna più
export async function mettiNelRipasso(x, DA) {
  DA ||= await dati();
  const carta = DA.aggiungiCarta({ esameId: esameDi(DA.D.esami, P.get(x.id)?.corso || null), ...cartaDa(x) });
  await segna(x.voce.k, 'carta', DA);   // salva() lo fa segna
  return carta;
}
// la sezione in fondo alla scheda s, prima della sua ultima ld-nota. Lista vuota: la scheda resta com'è
export function mostraCoseNuove(s, lista) {
  if (!s || !lista?.length || s.isConnected === false) return null;
  const sez = document.createElement('div'); sez.className = 'ld-cosenuove'; sez.innerHTML = htmlCoseNuove(lista);
  const nota = [...s.children].filter(c => c.classList?.contains('ld-nota')).pop();
  if (nota) nota.before(sez); else s.append(sez);
  T.entra?.(sez, { dy: 4, blur: 4, ms: 360 });
  sez.querySelectorAll('.voce').forEach(el => {
    const x = lista[+el.dataset.i], corpo = el.querySelector('.corpo'), apri = el.querySelector('.apri');
    apri.addEventListener('click', () => { const su = corpo.hidden; corpo.hidden = !su; apri.setAttribute('aria-expanded', String(su)); if (su) T.entra?.(corpo, { dy: 4, blur: 4, ms: 320 }); });
    bottone(el, '[data-risposta]', b => {
      const az = b.parentElement, p = document.createElement('p'); p.className = 'risp'; p.textContent = x.voce.r;
      az.before(p);
      az.innerHTML = `<button type="button" class="btn small primary" data-carta>${t('progetto.mettila-nel-ripasso')}</button><button type="button" class="btn small ld-piano" data-so>${t('progetto.la-so-gia')}</button>`;
      T.entra?.(p, { dy: 4, blur: 4, ms: 320 });
      bottone(az, '[data-carta]', async () => {
        az.querySelectorAll('button').forEach(y => { y.disabled = true; });
        await mettiNelRipasso(x);
        if (T.mostraFatto) T.mostraFatto({ testo: t('progetto.nel-ripasso') }, az); else az.innerHTML = `<p class="ld-nota">${t('progetto.nel-ripasso')}</p>`;
      });
      bottone(az, '[data-so]', async () => {
        az.querySelectorAll('button').forEach(y => { y.disabled = true; });
        await segna(x.voce.k, 'so');
        corpo.remove(); apri.disabled = true; apri.removeAttribute('aria-expanded'); apri.querySelector('.ld-tenue').textContent = t('progetto.la-sai-gia');
      });
    });
  });
  return sez;
}
