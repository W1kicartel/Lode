// Lode, l'aiutante in cima allo schermo. A riposo è una pillola di vetro nero: il prossimo esame, le carte di oggi
// o il timer che scorre. Passandoci sopra si apre a molla in un pannello: «Oggi», sei strumenti e il campo
// «Chiedi o scrivi un comando…». Si parla tenendo premuto ⌥ Spazio. I file trascinati diventano carte del ripasso.
// Senza AI capisce i comandi in italiano (comandi.js); con la chiave Claude spiega, crea carte e interroga come all'orale.
import { D, RISPOSTE, aggiungiCarta, aggiungiEsame, cfuFatti, dataBreve, dataLunga, daFare, daRipassare, esame, esc, fatti, media, minuti, num, oggi, ore, piano, prossimi, prossimoIntervallo, registraVoto, rispondi, salva, serie, serve, simula, sostituisci, traQuanto, trovaEsame, intervalloTesto, giorniTra } from './dati.js';
import { RIDOTTO, attendi, comprimi, conta, dopo, entra, h, lineare, morbido, ogni, premi, tween } from './motore.js';
import { ESEMPI, interpreta } from './comandi.js';
import * as F from './focus.js';
import * as AI from './ai.js';
import * as Voce from './voce.js';
import { livelloVoce } from './mascotte.js';

const segnala = (evento, x = {}) => dispatchEvent(new CustomEvent('lode', { detail: { evento, ...x } }));
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const TASTI = MAC ? '⌥ Spazio' : 'Ctrl ⇧ Spazio';
const NUMERI = ['Nessuna', 'Una', 'Due', 'Tre', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Otto', 'Nove', 'Dieci'];
const IC = {
  lente: '<svg class="lente" viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/></svg>',
  spunta: '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:0"/></svg>',
  croce: '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:0"/></svg>',
  filo: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7H6a4 4 0 0 0 0 8h3"/><path d="M15 7h3a4 4 0 0 1 0 8h-3"/><path d="M8 11h8"/></svg>',
  lucchetto: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  chiudi: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9.5 2.5h5"/>',
  ripasso: '<rect x="3" y="6" width="14" height="13" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v11"/><path d="M7 11h6M7 14h4"/>',
  libretto: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/>',
  esami: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16"/><path d="M9 3v4"/><path d="M15 3v4"/><path d="M8 14h3"/>',
  orale: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/>',
  file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M12 11v6M9 14h6"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 15h5M10 18h3"/>',
};
const ico = k => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- stato ---------- */
let A, shell, pill, corpo, testa, campo, home, filo, allegatiBox, tacche = [], forma, velo, GEN = 0;
const nuovoStato = () => ({ aperto: false, fisso: false, modo: 'riposo', turno: null, attesa: null, home: true, avviso: null, chiudiTra: null, apriTra: null, storia: [], allegati: [], orale: null, controller: null, ripasso: null, risposta: null, ultimoUso: 0 });

function saluto() {
  const n = String(D.profilo.nome || '').trim().split(/\s+/)[0], o = new Date().getHours();
  const s = o < 5 ? 'Ancora sveglio' : o < 13 ? 'Buongiorno' : o < 18 ? 'Buon pomeriggio' : 'Buonasera';
  return n ? `${s}, ${n}.` : s + '.';
}
function frase() {
  const p = prossimi()[0], c = daRipassare().length;
  const pezzi = [];
  if (p) { const g = giorniTra(oggi(), p.data); pezzi.push(g === 0 ? `Oggi c'è ${p.nome}. In bocca al lupo.` : `${p.nome} ${traQuanto(p.data)}.`); }
  if (c) pezzi.push(`${NUMERI[c] || c} ${c === 1 ? 'carta' : 'carte'} da ripassare.`);
  if (!pezzi.length) return D.esami.length ? 'Niente in sospeso oggi.' : 'Dimmi il tuo prossimo esame e preparo il piano.';
  return pezzi.join(' ');
}

function costruisci() {
  shell = h('div', 'ld'); shell.setAttribute('role', 'region'); shell.setAttribute('aria-label', 'Lode, assistente di studio'); shell.dataset.aperto = '0';
  pill = h('button', 'ld-pill'); pill.type = 'button'; pill.setAttribute('aria-expanded', 'false');
  corpo = h('div', 'ld-corpo');
  testa = h('header', 'ld-testa', `<div class="r1"><i class="ld-rombo"></i><h2></h2><span class="esc">Esc</span></div><div class="sotto"><p></p><small></small></div>`);
  const dentro = h('div', 'ld-dentro');
  campo = h('div', 'ld-campo'); campo.dataset.modo = 'riposo';
  campo.innerHTML = `<div class="cerca">${IC.lente}<input type="text" aria-label="Chiedi o scrivi un comando" placeholder="Chiedi o scrivi un comando…" autocomplete="off" spellcheck="true"></div>
    <div class="stato ascolto"><span class="lbl">Ti ascolto</span><div class="ld-onda" aria-hidden="true">${Array.from({ length: 41 }, (_, i) => `<i${i === 20 ? ' class="c"' : ''}></i>`).join('')}</div><span class="esc">Esc annulla</span></div>
    <div class="stato pensa"><span class="lbl">Un attimo…</span><div class="ld-linea" aria-hidden="true"><i></i></div></div>
    <button type="button" class="ld-mic" aria-label="Parla (oppure tieni premuto ${TASTI})">${IC.mic}<i class="quadro"></i><i class="anello"></i></button>`;
  tacche = [...campo.querySelectorAll('.ld-onda i')];
  allegatiBox = h('div', 'ld-allegati');
  home = h('div', 'ld-home');
  filo = h('div', 'ld-filo'); filo.setAttribute('aria-live', 'polite');
  dentro.append(campo, allegatiBox, home, filo);
  const piede = h('footer', 'ld-piede', `<span>Tieni premuto per parlare <kbd>${TASTI}</kbd></span><span>${IC.lucchetto}I dati restano su questo computer</span>`);
  corpo.append(testa, dentro, piede);
  shell.append(pill, corpo);
  document.body.append(shell);
  velo = h('div', 'ld-drop', '<i class="bordo"></i><div class="ld-drop-in"><b>Lascia qui il file</b><span>PDF, slide, appunti, foto della lavagna: Lode ne fa carte del ripasso</span></div>');
  velo.setAttribute('aria-hidden', 'true'); document.body.append(velo);
  forma = { w: { x: larghezza(), v: 0, t: larghezza() }, h: { x: 36, v: 0, t: 36 }, r: { x: 18, v: 0, t: 18 } };
  disegnaHome(); aggiornaTesta(); aggiornaPillola(); applica();
}

/* ---------- la home del pannello: «Oggi» e gli strumenti ---------- */
function righeOggi() {
  const r = [];
  for (const e of prossimi().slice(0, 2)) {
    const p = piano(e), g = giorniTra(oggi(), e.data);
    r.push({ cls: g <= 7 ? 'urg' : 'att', t: e.nome, d: `${cap(dataLunga(e.data))} · ${p.oggi >= .1 ? `${num(p.oggi)} h oggi per stare in pari` : 'oggi sei in pari'}`, n: g === 0 ? 'oggi' : `${g} g`, b: 'Focus', f: () => avviaFocus({ esameId: e.id }) });
  }
  const c = daRipassare().length;
  if (c) r.push({ cls: 'att', t: 'Ripasso', d: `${c} ${c === 1 ? 'carta' : 'carte'} · circa ${Math.max(1, Math.round(c * .4))} min`, n: String(c), b: 'Inizia', f: () => { nuovoTurno(); schedaRipasso(); } });
  const s = serie(), m = minuti({ da: oggi(), a: oggi() });
  if (m || s) r.push({ cls: 'info', t: m ? `${ore(m)} di studio oggi` : 'Oggi non hai ancora studiato', d: s ? `${s} ${s === 1 ? 'giorno' : 'giorni'} di fila` : 'Bastano 25 minuti per iniziare una serie', n: '', b: m ? 'Libretto' : 'Focus', f: () => m ? (nuovoTurno(), schedaLibretto()) : avviaFocus({}) });
  return r.slice(0, 4);
}
function disegnaHome() {
  const r = righeOggi();
  home._righe = r;
  home.innerHTML = `<section class="ld-oggi"><div class="capo"><span class="ld-lbl">Oggi</span><span>${D.esami.length ? `${cfuFatti()} di ${D.profilo.cfuTotali} CFU` : ''}</span></div>
    ${r.map((x, i) => `<div class="ld-riga ${x.cls}"><i class="ld-seg"></i><div class="t"><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div><span class="n">${esc(x.n)}</span><button type="button" class="btn small${i === 0 && x.cls === 'urg' ? ' primary' : ''}" data-ld-riga="${i}">${x.b}</button></div>`).join('') ||
    `<div class="ld-riga info vuota"><i class="ld-seg"></i><div class="t"><b>Inizia da qui</b><span>Scrivi «esame analisi 2 il 15 gennaio 9 cfu», oppure prova i dati di esempio</span></div><span class="n"></span><button type="button" class="btn small primary" data-ld-esempio>Esempio</button></div>`}</section>
    <div class="ld-strumenti">${STRUMENTI.map(([k, t], i) => `<button type="button" class="btn" data-ld-strumento="${i}">${ico(k)}<span>${t}</span></button>`).join('')}</div>`;
}
const STRUMENTI = [
  ['focus', 'Focus', () => schedaFocus()],
  ['ripasso', 'Ripasso', () => schedaRipasso()],
  ['libretto', 'Libretto', () => schedaLibretto()],
  ['esami', 'Esami', () => schedaEsami()],
  ['orale', 'Interrogami', () => avviaOrale(null)],
  ['file', 'Carte da file', () => scegliFile()],
];
function aggiornaTesta() {
  testa.querySelector('h2').textContent = saluto();
  testa.querySelector('p').textContent = frase();
  const d = new Date(), m = media();
  testa.querySelector('small').textContent = `${cap(dataLunga(oggi()))}${m.ponderata ? ` · media ${num(m.ponderata, 2)}` : ''}${serie() ? ` · serie di ${serie()} ${serie() === 1 ? 'giorno' : 'giorni'}` : ''}`;
  testa.querySelector('.r1 .ld-rombo').classList.toggle('ld-cavo', !prossimi().some(e => giorniTra(oggi(), e.data) <= 7));
}

/* ---------- la pillola ---------- */
function aggiornaPillola(avviso) {
  if (!pill) return;
  const T = F.stato();
  pill.classList.toggle('timer', !!T && !avviso);
  if (avviso) { pill.innerHTML = `<svg class="ld-ok" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg><span>${esc(avviso)}</span>`; pill.setAttribute('aria-label', avviso); return; }
  if (T) {
    const fermo = !!T.fermo, pausa = T.fase === 'pausa';
    if (!pill.querySelector('.ld-tempo')) pill.innerHTML = `<i class="ld-rombo"></i><b class="ld-tempo"></b><span class="ld-cosa"></span><i class="ld-avanza"><i></i></i>`;
    pill.querySelector('.ld-tempo').textContent = F.mmss(F.restante());
    pill.querySelector('.ld-cosa').textContent = fermo ? 'in pausa' : pausa ? 'pausa' : F.etichetta();
    pill.querySelector('.ld-avanza i').style.transform = `scaleX(${F.avanzamento().toFixed(4)})`;
    pill.classList.toggle('sosta', fermo || pausa);
    pill.setAttribute('aria-label', `${pausa ? 'Pausa' : 'Focus su ' + F.etichetta()}: mancano ${F.mmss(F.restante())}`);
    return;
  }
  const p = prossimi()[0], c = daRipassare().length;
  let testo;
  if (p) { const g = giorniTra(oggi(), p.data); testo = `<b>${esc(p.nome)}</b><span class="ld-tenue">${g === 0 ? 'oggi' : g === 1 ? 'domani' : `tra ${g} g`}</span>${c ? `<span class="ld-punto"></span><span class="ld-tenue">${c} carte</span>` : ''}`; }
  else if (c) testo = `<b>${c}</b><span class="ld-tenue">carte da ripassare</span>`;
  else testo = `<b>Lode</b><span class="ld-tenue">passa qui sopra</span>`;
  pill.innerHTML = `<i class="ld-rombo${p && giorniTra(oggi(), p.data) <= 7 ? '' : ' ld-cavo'}"></i><span class="ld-testo">${testo}</span>`;
  pill.setAttribute('aria-label', `Lode: ${pill.textContent}. Passa sopra o premi ${TASTI}.`);
}

// a riposo la pillola è larga 336; col timer si stringe attorno al tempo
const larghezza = () => F.stato() ? 248 : 336;
// la conchiglia: tre molle smorzate criticamente (niente rimbalzi) che seguono larghezza, altezza e raggio
let formaViva = false;
function applica() { shell.style.width = forma.w.x.toFixed(2) + 'px'; shell.style.height = forma.h.x.toFixed(2) + 'px'; shell.style.borderRadius = forma.r.x.toFixed(2) + 'px'; }
function molla() {
  if (formaViva) return; formaViva = true; let prec = performance.now();
  ogni(t => {
    const dt = Math.min(64, Math.max(0, t - prec)) / 1000; prec = t;
    if (A.aperto) forma.h.t = Math.min(corpo.offsetHeight, innerHeight - 20);
    let fermo = true; const w0 = RIDOTTO ? 80 : 15.5;
    for (const k of ['w', 'h', 'r']) {
      const m = forma[k], n = Math.max(1, Math.ceil(dt / .008)), s = dt / n;
      for (let i = 0; i < n; i++) { const a = -w0 * w0 * (m.x - m.t) - 2 * w0 * m.v; m.v += a * s; m.x += m.v * s; }
      if (Math.abs(m.x - m.t) < .2 && Math.abs(m.v) < 3) { m.x = m.t; m.v = 0; } else fermo = false;
    }
    applica();
    if (fermo && !A.aperto) { formaViva = false; return false; }
    return true;
  });
}

/* ---------- aprire e chiudere ---------- */
export function apri({ fisso = false } = {}) {
  if (fisso) A.fisso = true;
  if (A.aperto) return Promise.resolve();
  if (A.storia.length && Date.now() - A.ultimoUso > 20 * 60e3 && !A.attesa && !A.orale) ricomincia();
  A.apriTra?.(); A.chiudiTra?.(); A.aperto = true;
  if (A.home) disegnaHome();
  aggiornaTesta();
  shell.dataset.aperto = '1'; pill.setAttribute('aria-expanded', 'true');
  forma.w.t = Math.min(560, innerWidth - 16); forma.r.t = 20; molla();
  tween(150, e => { if (!A.aperto) return; pill.style.opacity = (1 - e).toFixed(3); pill.style.transform = `scale(${1 - .04 * e})`; }).then(() => { if (A.aperto) pill.style.visibility = 'hidden'; });
  corpo.style.opacity = '1';
  const pezzi = [testa, ...corpo.querySelector('.ld-dentro').children, corpo.querySelector('.ld-piede')].filter(x => x.style.display !== 'none' && !(x === filo && !filo.children.length) && !(x === allegatiBox && !allegatiBox.children.length));
  pezzi.forEach((p, i) => entra(p, { ritardo: 50 + i * 45, dy: 10, blur: 8, ms: 560 }));
  segnala('aperto');
  return attendi(560);
}
export function chiudi(avviso) {
  A.fisso = false;
  if (!A.aperto) { if (avviso) mostraAvviso(avviso); return Promise.resolve(); }
  A.chiudiTra?.(); A.aperto = false; pill.setAttribute('aria-expanded', 'false');
  if (shell.contains(document.activeElement)) document.activeElement.blur();
  forma.w.t = larghezza(); forma.h.t = 36; forma.r.t = 18; molla();
  tween(170, e => { if (!A.aperto) corpo.style.opacity = (1 - e).toFixed(3); });
  if (avviso) mostraAvviso(avviso, true); else aggiornaPillola();
  pill.style.visibility = '';
  tween(300, e => { if (A.aperto) return; pill.style.opacity = e.toFixed(3); pill.style.transform = `scale(${.96 + .04 * e})`; }, { ritardo: 170 });
  segnala('chiuso'); if (F.stato()?.fase === 'focus' && !F.stato().fermo) dopo(700, () => segnala('focus'));
  return attendi(480).then(() => { if (!A.aperto) shell.dataset.aperto = '0'; });
}
function mostraAvviso(testo, silenzioso) {
  A.avviso?.(); aggiornaPillola(testo);
  if (!silenzioso) entra(pill, { dy: 0, blur: 4, ms: 300 });
  A.avviso = dopo(2800, () => { A.avviso = null; if (A.aperto) return; tween(160, e => { pill.style.opacity = (1 - e).toFixed(3); }).then(() => { aggiornaPillola(); tween(260, e => { pill.style.opacity = e.toFixed(3); }); }); });
}
function ricomincia() {
  GEN++; A.controller?.abort(); Voce.zitto();
  const fisso = A.fisso, aperto = A.aperto;
  A = { ...nuovoStato(), fisso, aperto };
  filo.innerHTML = ''; allegatiBox.innerHTML = '';
  mostraHome(); modo('riposo');
}

/* ---------- campo: riposo, ascolto, un attimo ---------- */
function modo(m, etichetta) {
  A.modo = m; campo.dataset.modo = m;
  if (m === 'pensa') {
    campo.querySelector('.stato.pensa .lbl').textContent = etichetta || 'Un attimo…';
    if (campo._pensa) return; campo._pensa = true;
    const t0 = performance.now(), seg = campo.querySelector('.ld-linea i');
    ogni(t => { if (A.modo !== 'pensa') { campo._pensa = false; return false; } const p = ((t - t0) % 900) / 900; seg.style.transform = `translateX(${(-48 + 218 * morbido(p)).toFixed(1)}px)`; return true; });
  }
  if (m === 'ascolto') {
    if (campo._onda) return; campo._onda = true;
    ogni(t => {
      if (A.modo !== 'ascolto') { campo._onda = false; tacche.forEach(x => { x.style.transform = ''; }); return false; }
      const v = Voce.livelloVoce(); livelloVoce(v);
      tacche.forEach((x, i) => { const d = Math.abs(i - 20) / 20, k = .17 + (1 - d) * v * (.5 + .5 * Math.sin(t / 90 + i * .7)); x.style.transform = `scaleY(${Math.max(.12, k).toFixed(3)})`; });
      return true;
    });
  }
}

/* ---------- conversazione ---------- */
function nascondiHome() {
  if (!A.home) return; A.home = false;
  comprimi(home, 380, false); comprimi(testa.querySelector('.sotto'), 380, false);
}
function mostraHome() {
  A.home = true;
  for (const el of [home, testa.querySelector('.sotto')]) { el.style.display = ''; el.style.height = ''; el.style.marginBottom = ''; el.style.opacity = ''; el.style.overflow = ''; }
  disegnaHome(); aggiornaTesta();
}
function riassumi(t) {
  const dom = t.dataset.domanda || '', sin = t.dataset.sintesi || '';
  if (!dom && !sin) { t.classList.add('passato'); comprimi(t, 300); return; }
  const h0 = t.offsetHeight; t.style.height = h0 + 'px'; t.style.overflow = 'hidden';
  tween(140, e => { for (const c of t.children) c.style.opacity = (1 - e).toFixed(3); }).then(() => {
    t.innerHTML = ''; const r = h('div', 'ld-riass', `<q>${esc(dom || '…')}</q><span>→</span><b>${esc(sin || '…')}</b>`); t.append(r);
    const h1 = r.offsetHeight; entra(r, { dy: 4, blur: 4, ms: 380 });
    return tween(380, e => { t.style.height = (h0 + (h1 - h0) * e).toFixed(2) + 'px'; });
  }).then(() => { t.style.height = ''; });
  t.classList.add('passato');
}
function nuovoTurno() {
  if (!A.aperto) apri({ fisso: true });
  A.fisso = true; A.ultimoUso = Date.now();
  nascondiHome(); chiudiRipasso();
  if (A.turno && !A.turno.classList.contains('passato') && !(A.attesa && A.turno.contains(A.attesa.card)) && !A.orale) riassumi(A.turno);
  const vecchi = [...filo.querySelectorAll('.ld-turno.passato')]; if (vecchi.length > 2) comprimi(vecchi[0], 300);
  const t = h('article', 'ld-turno'); filo.append(t); A.turno = t;
  requestAnimationFrame(() => { corpo.scrollTo({ top: corpo.scrollHeight, behavior: RIDOTTO ? 'auto' : 'smooth' }); });
  return t;
}
function detto(t, testo) {
  let p = t.querySelector('.ld-detto');
  if (!p) { p = h('p', 'ld-detto'); t.prepend(p); p._parole = []; }
  const parole = String(testo).split(/\s+/).filter(Boolean);
  parole.forEach((w, i) => {
    const s = p._parole[i];
    if (s) { if (s.textContent !== w) s.textContent = w; return; }
    if (i > 0) p.append(document.createTextNode(' '));
    const n = h('span', 'w'); n.textContent = w; p.append(n); p._parole.push(n);
    entra(n, { dy: 5, blur: 7, ms: 380 });
  });
  while (p._parole.length > parole.length) { const n = p._parole.pop(); const sp = n.previousSibling; n.remove(); if (sp && sp.nodeType === 3) sp.remove(); }
  t.dataset.domanda = testo;
  return p;
}
const mdHtml = t => {
  let s = esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const i = s.lastIndexOf('**'); if (i >= 0) s = s.slice(0, i) + '<b>' + s.slice(i + 2) + '</b>';
  return s.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
};
// la risposta dell'AI: i pezzi dello streaming si scrivono con un ritmo morbido, mai a scatti
function nuovaRisposta() {
  const t = A.turno || nuovoTurno(), g = GEN;
  const p = h('p', 'ld-ai', '<i class="ld-rombo"></i><span class="tx"></span>'); t.append(p);
  entra(p, { dy: 3, blur: 0, ms: 240 });
  const tx = p.querySelector('.tx'), caret = h('span', 'ld-caret');
  let testo = '', visti = 0, finito = false, chiusa = null, prec = performance.now(), ultimoSegno = 0;
  const fatto = new Promise(r => { chiusa = r; });
  ogni(t2 => {
    if (g !== GEN) { chiusa(); return false; }
    const dt = Math.min(100, t2 - prec) / 1000; prec = t2;
    const arretrato = testo.length - visti, cps = Math.max(70, arretrato * 5);
    if (arretrato > 0) {
      visti = Math.min(testo.length, visti + Math.max(1, cps * dt)); tx.innerHTML = mdHtml(testo.slice(0, Math.floor(visti))); tx.append(caret);
      if (t2 - ultimoSegno > 300) { ultimoSegno = t2; segnala('risposta', { ms: 700 }); if (corpo.scrollHeight - corpo.scrollTop - corpo.clientHeight < 140) corpo.scrollTop = corpo.scrollHeight; }
    }
    if (finito && Math.floor(visti) >= testo.length) {
      chiusa(); const t1 = performance.now();
      ogni(tt => { if (g !== GEN) return false; const e = tt - t1; if (e > 1100) { caret.remove(); return false; } caret.style.opacity = (Math.floor(e / 530) % 2 ? 0 : 1) * (e > 900 ? (1100 - e) / 200 : 1); return true; });
      return false;
    }
    return true;
  });
  return {
    get testo() { return testo; },
    aggiungi(d) { testo += d; },
    fine() { finito = true; if (!t.dataset.sintesi && testo) t.dataset.sintesi = testo.replace(/\*\*/g, '').split(/(?<=[.?!])\s/)[0].slice(0, 90); if (D.imp.voceAlta) Voce.leggi(testo); return fatto; },
  };
}
function rispostaFissa(testo, { errore = false } = {}) {
  const t = A.turno || nuovoTurno(); modo('riposo');
  const p = h('p', 'ld-ai' + (errore ? ' ld-err' : ''), `<i class="ld-rombo"></i><span class="tx">${mdHtml(testo)}</span>`); t.append(p);
  entra(p, { dy: 3, blur: 2, ms: 300 });
  if (!t.dataset.sintesi) t.dataset.sintesi = testo.replace(/\*\*/g, '').split(/(?<=[.?!])\s/)[0];
  segnala('risposta', { ms: 600 });
  return p;
}
function scheda(cls, html) { const t = A.turno || nuovoTurno(); const s = h('div', 'ld-scheda ' + cls, html); t.append(s); segnala('scheda'); entra(s, { dy: 10, blur: 8, ms: 520, scala: .985 }); requestAnimationFrame(() => s.scrollIntoView({ block: 'nearest', behavior: RIDOTTO ? 'auto' : 'smooth' })); return s; }
function contesto(html) {
  const t = A.turno || nuovoTurno(); const c = h('div', 'ld-ctx', `${IC.filo}<span>${html}</span>`);
  const det = t.querySelector('.ld-detto'); if (det) det.after(c); else t.prepend(c);
  return c;
}
function mostraFatto(d = {}, dove) {
  const f = h('div', 'ld-fatto' + (d.no ? ' no' : ''), `${d.no ? IC.croce : IC.spunta}<b>${esc(d.testo || 'Fatto.')}</b>${d.nota ? `<span>${esc(d.nota)}</span>` : ''}`);
  if (d.annulla) { const b = h('button', 'btn small', 'Annulla'); b.type = 'button'; b.addEventListener('click', () => { d.annulla(); b.replaceWith(h('span', '', 'annullato')); aggiornaTutto(); }, { once: true }); f.append(b); }
  if (d.azione) { const b = h('button', 'btn small', esc(d.azione[0])); b.type = 'button'; b.addEventListener('click', d.azione[1]); f.append(b); }
  if (dove) dove.replaceWith(f); else (A.turno || nuovoTurno()).append(f);
  if (d.sintesi && A.turno) A.turno.dataset.sintesi = d.sintesi;
  segnala(d.no ? 'quiete' : 'fatto');
  const path = f.querySelector('path');
  return Promise.all([entra(f, { dy: 4, blur: 4, ms: 380 }), tween(420, e => { path.style.strokeDashoffset = (1 - e).toFixed(3); }, { ritardo: 80 })]);
}
// ogni modifica fatta da un comando si può annullare con un clic
function istantanea() { const s = JSON.parse(JSON.stringify(D)); return () => sostituisci(s); }
function aggiornaTutto() { aggiornaPillola(); if (A.home) disegnaHome(); aggiornaTesta(); }

/* ---------- proposte con «Conferma / Annulla» (per l'AI) ---------- */
function schedaConferma({ titolo, righe = [], extra = '', nota }) {
  const s = scheda('ld-conf', `<h3>${esc(titolo || 'Confermi?')}</h3>
    ${righe.length ? `<dl>${righe.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}${extra}
    ${nota ? `<p class="ld-nota">${esc(nota)}</p>` : ''}
    <div class="az"><button type="button" class="btn primary" data-ld="si">Conferma</button><button type="button" class="btn ld-piano" data-ld="no">Annulla</button><small>Puoi anche scrivere «sì».</small></div>`);
  s.setAttribute('role', 'alertdialog'); s.setAttribute('aria-label', titolo || 'Conferma');
  s.querySelector('[data-ld=si]').addEventListener('click', () => conferma());
  s.querySelector('[data-ld=no]').addEventListener('click', () => annulla());
  dopo(520, () => segnala('conferma-pronta'));
  return s;
}
const attendiDecisione = (card, esegui) => new Promise(res => { A.attesa = { card, esegui, risolvi: r => { A.attesa = null; res(r); } }; });
async function conferma() {
  const a = A.attesa; if (!a || a.inCorso) return; a.inCorso = true;
  await premi(a.card.querySelector('[data-ld=si]')); segnala('confermato');
  let r; try { r = await a.esegui(a.card); } catch (e) { console.error(e); r = { esito: 'errore', errore: e.message }; }
  a.risolvi(r);
}
async function annulla() {
  const a = A.attesa; if (!a || a.inCorso) return; a.inCorso = true;
  await mostraFatto({ testo: 'Annullato.', nota: 'Non ho cambiato niente.', sintesi: 'annullato', no: true }, a.card.isConnected ? a.card : null);
  a.risolvi({ esito: 'annullato_dallo_studente' });
}
const SI = /^(s[iì]|ok(ay)?|conferm[aoi]|confermo|vai|procedi|certo|perfetto|d'accordo|fallo|esatto|giusto|salva(le|li)?)( pure)?[\s,.!]*$/i;
const NO = /^(no|annulla|lascia (stare|perdere)|aspetta|stop|niente|meglio di no)[\s,.!]*$/i;

/* ---------- gli strumenti ---------- */
const opzioniEsami = (sel, soloDaFare = true) => (soloDaFare ? daFare() : D.esami).map(e => `<option value="${e.id}"${e.id === sel ? ' selected' : ''}>${esc(e.nome)}</option>`).join('');

function schedaFocus(esameId) {
  const pross = esameId || prossimi()[0]?.id || '';
  const s = scheda('ld-focus', `<span class="ld-lbl">Focus</span>
    <div class="ld-preset" role="radiogroup" aria-label="Durata">${[25, 50, 90].map(m => `<button type="button" role="radio" class="ld-chip${m === D.imp.focus ? ' on' : ''}" data-min="${m}" aria-checked="${m === D.imp.focus}"><b>${m}</b><span>min</span></button>`).join('')}</div>
    <div class="ld-riga-form"><select aria-label="Su che cosa">${'<option value="">Studio libero</option>' + opzioniEsami(pross)}</select><button type="button" class="btn primary" data-via>Inizia</button></div>
    <p class="ld-nota">Pausa di ${D.imp.pausa} minuti alla fine. Le ore contano nel piano dell'esame.</p>`);
  let min = D.imp.focus;
  s.querySelectorAll('.ld-chip').forEach(b => b.addEventListener('click', () => { min = +b.dataset.min; s.querySelectorAll('.ld-chip').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); premi(b); }));
  s.querySelector('[data-via]').addEventListener('click', () => avviaFocus({ min, esameId: s.querySelector('select').value || null, dove: s }));
  if (A.turno) A.turno.dataset.sintesi = 'focus';
}
export async function avviaFocus({ min = D.imp.focus, esameId = null, dove } = {}) {
  if (!A.aperto) { F.avvia({ min, esameId }); return; }
  F.avvia({ min, esameId });
  const nome = esame(esameId)?.nome;
  if (!A.home || dove) await mostraFatto({ testo: `Focus di ${min} minuti${nome ? ' su ' + nome : ''}.`, nota: 'Ci vediamo alla pausa.', sintesi: `focus ${min} min` }, dove);
  await attendi(dove || !A.home ? 700 : 0);
  chiudi();
}

function schedaLibretto({ base } = {}) {
  const m = media(), cf = cfuFatti(), tot = D.profilo.cfuTotali, obiettivo = base || (m.base && m.base > 104 ? 110 : m.base ? Math.min(110, Math.floor(m.base / 5) * 5 + 5) : 100);
  const sv = m.n ? serve(obiettivo) : null, df = daFare();
  const s = scheda('ld-libretto', `<div class="ld-kpi">
      <div><span class="ld-lbl">Media ponderata</span><b class="v" data-v="m">${m.ponderata ? '0' : '—'}</b><span class="d">${m.n ? `aritmetica ${num(m.aritmetica, 2)} · ${m.n} esami` : 'ancora nessun voto'}</span></div>
      <div><span class="ld-lbl">Base di laurea</span><b class="v" data-v="b">${m.base ? '0' : '—'}<small>/110</small></b><span class="d">${cf} di ${tot} CFU</span></div>
    </div>
    <div class="ld-cfu" aria-hidden="true"><i style="transform:scaleX(0)"></i></div>
    ${sv ? `<p class="ld-serve">${sv.gia ? `Per partire da <b>${obiettivo}</b> ti basta passare gli esami che restano.` : sv.possibile ? `Per partire da <b>${obiettivo}</b> ti serve <b>${num(sv.voto, 1)}</b> di media nei ${sv.cfu} CFU che mancano.` : `Partire da <b>${obiettivo}</b> non è più possibile: punta a ${Math.floor(((m.somma + 30 * sv.cfu) / (m.cfuVoto + sv.cfu)) * 110 / 30)}.`}</p>` : ''}
    ${df.length && m.n ? `<div class="ld-sim"><span class="ld-lbl">E se…</span><div class="ld-riga-form"><select aria-label="Esame">${opzioniEsami(df[0].id)}</select><input type="range" min="18" max="31" value="28" aria-label="Voto"><b class="vv">28</b></div><p class="esito"></p></div>` : ''}`);
  const vm = s.querySelector('[data-v=m]'), vb = s.querySelector('[data-v=b]');
  if (m.ponderata) { conta(vm, m.ponderata, x => num(x, 2)); tween(900, e => { vb.firstChild.textContent = num(m.base * e, 1); }, { ritardo: 120 }); }
  const barra = s.querySelector('.ld-cfu i'); tween(900, e => { barra.style.transform = `scaleX(${(Math.min(1, cf / tot) * e).toFixed(4)})`; }, { ritardo: 200 });
  const sim = s.querySelector('.ld-sim');
  if (sim) {
    const sel = sim.querySelector('select'), r = sim.querySelector('input'), vv = sim.querySelector('.vv'), out = sim.querySelector('.esito');
    const calc = () => {
      const v = Math.min(30, +r.value), lode = +r.value === 31; vv.textContent = lode ? '30L' : v;
      const x = simula(sel.value, v, lode); if (!x) return;
      const d = x.delta; out.innerHTML = `Media <b>${num(x.dopo.ponderata, 2)}</b> <span class="${d < 0 ? 'giu' : 'su'}">${d >= 0 ? '+' : '−'}${num(Math.abs(d), 2)}</span> · base <b>${num(x.dopo.base, 1)}</b>`;
    };
    r.addEventListener('input', calc); sel.addEventListener('change', calc); calc();
  }
  if (A.turno) A.turno.dataset.sintesi = m.ponderata ? `media ${num(m.ponderata, 2)}, base ${num(m.base, 1)}` : 'libretto vuoto';
  return s;
}
function schedaSimula({ esame: e, voto, lode, nomeDetto }) {
  if (!e) return rispostaFissa(`Non trovo **${nomeDetto}** tra i tuoi esami. Aggiungilo con «esame ${nomeDetto} 6 cfu».`);
  const x = simula(e.id, voto, lode);
  if (!x.prima.n) return rispostaFissa(`Con ${voto}${lode ? ' e lode' : ''} in **${e.nome}** la tua media partirebbe da **${voto}**: base **${num(voto * 110 / 30, 1)}**.`);
  const d = x.delta;
  rispostaFissa(`Con **${voto}${lode ? ' e lode' : ''}** in ${e.nome} la media passa da ${num(x.prima.ponderata, 2)} a **${num(x.dopo.ponderata, 2)}** (${d >= 0 ? '+' : '−'}${num(Math.abs(d), 2)}): base di laurea **${num(x.dopo.base, 1)}**.`);
  A.turno.dataset.sintesi = `media ${num(x.dopo.ponderata, 2)}`;
}

function schedaEsami() {
  const p = prossimi(), senza = daFare().filter(e => !e.data);
  const s = scheda('ld-esami', `<span class="ld-lbl">Prossimi appelli · ${p.length}</span>
    ${p.map(e => { const pi = piano(e), g = giorniTra(oggi(), e.data); return `<div class="ld-es"><div class="t"><b>${esc(e.nome)}</b><span>${dataBreve(e.data)} · ${e.cfu} CFU · ${num(pi.fatte, 0)} di ${pi.tot} h${pi.oggi >= .1 ? ` · <em>${num(pi.oggi)} h oggi</em>` : ''}</span><i class="q"><i style="transform:scaleX(0)" data-q="${pi.quota.toFixed(3)}"></i></i></div><span class="g">${g === 0 ? 'oggi' : g}<small>${g === 0 ? '' : g === 1 ? 'giorno' : 'giorni'}</small></span><button type="button" class="btn small" data-focus="${e.id}">Focus</button></div>`; }).join('') || '<p class="ld-nota">Nessun appello in calendario.</p>'}
    ${senza.length ? `<p class="ld-nota">Senza data: ${senza.map(e => esc(e.nome)).join(', ')}.</p>` : ''}
    <form class="ld-riga-form ld-nuovo"><input name="nome" placeholder="Nuovo esame" aria-label="Nome dell'esame" required><input name="cfu" type="number" min="1" max="30" value="6" aria-label="CFU" title="CFU"><input name="data" type="date" aria-label="Data dell'appello"><button class="btn" type="submit">Aggiungi</button></form>`);
  s.querySelectorAll('[data-q]').forEach((x, i) => tween(700, e => { x.style.transform = `scaleX(${(x.dataset.q * e).toFixed(4)})`; }, { ritardo: 150 + i * 70 }));
  s.querySelectorAll('[data-focus]').forEach(b => b.addEventListener('click', () => avviaFocus({ esameId: b.dataset.focus })));
  s.querySelector('form').addEventListener('submit', ev => {
    ev.preventDefault(); const f = new FormData(ev.target); const nome = String(f.get('nome')).trim(); if (!nome) return;
    const ann = istantanea(); const e = aggiungiEsame({ nome, cfu: +f.get('cfu') || 6, data: f.get('data') || null });
    ev.target.reset(); mostraFatto({ testo: `${e.nome} aggiunto.`, nota: e.data ? dataLunga(e.data) : 'senza data', annulla: ann });
    aggiornaTutto();
  });
  if (A.turno) A.turno.dataset.sintesi = p[0] ? `${p[0].nome} ${traQuanto(p[0].data)}` : 'nessun appello';
}

// il ripasso: una carta alla volta, Spazio per girarla, 1-4 per rispondere
function schedaRipasso(esameId) {
  const coda = daRipassare(esameId).sort((a, b) => a.scad.localeCompare(b.scad) || a.creata - b.creata);
  const nomeE = esameId ? esame(esameId)?.nome : null;
  if (!coda.length) {
    const tot = D.carte.filter(c => !esameId || c.esameId === esameId);
    const prossima = tot.map(c => c.scad).sort()[0];
    const s = scheda('ld-rip', `<span class="ld-lbl">Ripasso${nomeE ? ' · ' + esc(nomeE) : ''}</span><p class="ld-vuoto">${tot.length ? `Niente da ripassare oggi. La prossima carta torna ${traQuanto(prossima)}.` : 'Ancora nessuna carta. Scrivi «carta: domanda = risposta», oppure trascina qui un PDF.'}</p>
      <form class="ld-carta-form"><input name="f" placeholder="Domanda" aria-label="Domanda" required><input name="r" placeholder="Risposta" aria-label="Risposta" required><select name="e" aria-label="Esame"><option value="">—</option>${opzioniEsami(esameId, false)}</select><button class="btn" type="submit">Aggiungi carta</button></form>`);
    s.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); const f = new FormData(ev.target); aggiungiCarta({ esameId: f.get('e') || null, fronte: f.get('f'), retro: f.get('r') }); salva(); ev.target.reset(); mostraFatto({ testo: 'Carta aggiunta.', nota: 'Torna oggi stesso nel ripasso.' }); aggiornaTutto(); });
    if (A.turno) A.turno.dataset.sintesi = 'niente da ripassare';
    return;
  }
  const tot = coda.length, t0 = Date.now(); let fatte = 0;
  const s = scheda('ld-rip', `<div class="capo"><span class="ld-lbl">Ripasso${nomeE ? ' · ' + esc(nomeE) : ''}</span><span class="conto"></span></div><i class="ld-prog"><i></i></i>
    <div class="carta"><p class="fronte"></p><div class="retro" hidden></div></div>
    <div class="az"><button type="button" class="btn primary gira">Mostra risposta <kbd>Spazio</kbd></button></div>`);
  const fr = s.querySelector('.fronte'), re = s.querySelector('.retro'), az = s.querySelector('.az'), conto = s.querySelector('.conto'), pr = s.querySelector('.ld-prog i');
  let c = null, girata = false;
  const mostra = () => {
    c = coda[0]; girata = false;
    const e = esame(c.esameId);
    fr.innerHTML = `${e && !esameId ? `<small>${esc(e.nome)}</small>` : ''}${mdHtml(c.fronte)}`; re.hidden = true; re.innerHTML = mdHtml(c.retro);
    az.innerHTML = '<button type="button" class="btn primary gira">Mostra risposta <kbd>Spazio</kbd></button>';
    az.querySelector('.gira').addEventListener('click', gira);
    conto.textContent = `${fatte + 1} di ${Math.max(tot, fatte + coda.length)}`;
    pr.style.transform = `scaleX(${(fatte / Math.max(tot, fatte + coda.length)).toFixed(4)})`;
    entra(fr, { dy: 6, blur: 6, ms: 420 });
  };
  const gira = () => {
    if (girata || !c) return; girata = true; re.hidden = false; entra(re, { dy: 6, blur: 6, ms: 420 });
    az.innerHTML = RISPOSTE.map(r => `<button type="button" class="btn${r.q === 4 ? ' primary' : ''}" data-q="${r.q}">${r.t}<small>${intervalloTesto(prossimoIntervallo(c, r.q))}</small><kbd>${r.k}</kbd></button>`).join('');
    az.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => vota(+b.dataset.q, b)));
    segnala('risposta', { ms: 400 });
  };
  const vota = async (q, b) => {
    if (!girata || !c) return; const carta = c; c = null;
    await premi(b || az.querySelector(`[data-q="${q}"]`));
    rispondi(carta, q); coda.shift(); if (q < 3) coda.push(carta); else fatte++;
    if (!coda.length) {
      const min = Math.max(1, Math.round((Date.now() - t0) / 60e3)); A.ripasso = null;
      pr.style.transform = 'scaleX(1)';
      await mostraFatto({ testo: `Ripasso finito: ${fatte} ${fatte === 1 ? 'carta' : 'carte'} in ${min} min.`, nota: 'Le difficili tornano domani.', sintesi: `${fatte} carte ripassate` });
      s.querySelector('.carta').remove(); az.remove();
      aggiornaTutto(); return;
    }
    tween(140, e => { s.querySelector('.carta').style.opacity = (1 - e).toFixed(3); }).then(() => { s.querySelector('.carta').style.opacity = ''; mostra(); });
  };
  A.ripasso = { gira, vota, card: s, attiva: () => !!c };
  mostra();
  if (A.turno) A.turno.dataset.sintesi = `ripasso di ${tot} carte`;
}
function chiudiRipasso() { A.ripasso = null; }

function schedaAiuto() {
  const s = scheda('ld-aiuto', `<span class="ld-lbl">Prova a scrivere</span>${ESEMPI.map(([f, d]) => `<button type="button" class="ld-es-cmd" data-cmd="${esc(f.replace(' …', ''))}"><b>${esc(f)}</b><span>${esc(d)}</span></button>`).join('')}
    ${AI.attiva() ? '' : '<p class="ld-nota">Con la chiave Claude (Impostazioni) puoi anche chiedere spiegazioni, creare carte dai PDF e farti interrogare.</p>'}`);
  s.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => { const t = b.dataset.cmd; if (t.endsWith('=')) { const i = campo.querySelector('input'); i.value = t + ' '; i.focus(); } else invia(t); }));
  if (A.turno) A.turno.dataset.sintesi = 'comandi';
}

/* ---------- eseguire un comando locale ---------- */
async function esegui(c) {
  switch (c.tipo) {
    case 'aiuto': return schedaAiuto();
    case 'ferma': { const r = F.ferma(); return r ? mostraFatto({ testo: r.era.fase === 'pausa' ? 'Pausa finita.' : `Fermato dopo ${ore(r.min)}.`, nota: r.min >= 5 && r.era.fase === 'focus' ? 'Li conto nelle ore di studio.' : '', sintesi: 'timer fermato' }) : rispostaFissa('Non c\'è nessun timer acceso.'); }
    case 'sospendi': F.sospendi(); return mostraFatto({ testo: 'Timer in pausa.', nota: 'Scrivi «riprendi» quando torni.' });
    case 'riprendi': F.riprendi(); return mostraFatto({ testo: 'Si riparte.' });
    case 'focus': {
      if (c.nomeDetto && !c.esame) return rispostaFissa(`Non trovo **${c.nomeDetto}** tra i tuoi esami. Faccio partire lo studio libero? Scrivi «focus ${c.min || D.imp.focus}».`);
      if (!c.min && !c.esame) return schedaFocus();
      return avviaFocus({ min: c.min || D.imp.focus, esameId: c.esame?.id || null, dove: null });
    }
    case 'voto': case 'idoneita': {
      const ann = istantanea(); let e = c.esame, nuovo = false;
      if (!e) { if (!c.nomeDetto) return rispostaFissa('Di quale esame?'); e = aggiungiEsame({ nome: c.nomeDetto, cfu: 6 }); nuovo = true; }
      const prima = media();
      registraVoto(e.id, c.tipo === 'idoneita' ? { idoneita: true } : { voto: c.voto, lode: c.lode });
      const dopo = media(), d = prima.ponderata != null && dopo.ponderata != null ? dopo.ponderata - prima.ponderata : null;
      await mostraFatto({ testo: c.tipo === 'idoneita' ? `${e.nome}: idoneità registrata.` : `${c.voto}${c.lode ? ' e lode' : ''} in ${e.nome}.`, nota: nuovo ? 'Nuovo esame da 6 CFU: correggi i CFU nel libretto.' : (d != null ? `Media ${num(dopo.ponderata, 2)} (${d >= 0 ? '+' : '−'}${num(Math.abs(d), 2)})` : ''), annulla: ann, sintesi: `${e.nome}: ${c.tipo === 'idoneita' ? 'idoneità' : c.voto}` });
      segnala('fatto'); aggiornaTutto();
      if (c.voto >= 28 || c.lode) rispostaFissa(c.lode ? 'Trenta e lode. Questa si festeggia.' : 'Bel colpo. Respira oggi, domani si riparte.');
      return schedaLibretto();
    }
    case 'esame': {
      const ann = istantanea(); let e = c.esistente && !c.esistente.fatto ? c.esistente : null;
      if (e) { if (c.data) e.data = c.data; if (c.cfu) e.cfu = c.cfu; salva(); }
      else e = aggiungiEsame({ nome: c.nome, cfu: c.cfu || 6, data: c.data });
      await mostraFatto({ testo: `${e.nome}${c.esistente && !c.esistente.fatto ? ' aggiornato' : ' aggiunto'}.`, nota: `${e.data ? cap(dataLunga(e.data)) + ' · ' : 'senza data · '}${e.cfu} CFU${!c.cfu && !c.esistente ? ' (cambiali se sono di più)' : ''}`, annulla: ann, sintesi: `${e.nome} ${e.data ? traQuanto(e.data) : ''}` });
      aggiornaTutto();
      if (e.data) { const p = piano(e); rispostaFissa(`Per arrivarci pronto: circa **${num(p.perGiorno)} h al giorno** (${p.tot} h in tutto, le cambi dal piano).`); }
      return;
    }
    case 'carta': {
      aggiungiCarta({ esameId: c.esame?.id || null, fronte: c.fronte, retro: c.retro }); salva(); aggiornaTutto();
      return mostraFatto({ testo: 'Carta aggiunta.', nota: c.esame ? c.esame.nome : 'senza esame', annulla: (() => { const id = D.carte.at(-1).id; return () => { D.carte = D.carte.filter(x => x.id !== id); salva(); }; })() });
    }
    case 'simula': return schedaSimula(c);
    case 'serve': return schedaLibretto({ base: c.base });
    case 'libretto': return schedaLibretto();
    case 'esami': case 'oggi': return schedaEsami();
    case 'apriEsame': return c.esame.fatto ? schedaLibretto() : schedaEsami();
    case 'ripasso': {
      if (c.nomeDetto && !c.esame) return rispostaFissa(`Non trovo **${c.nomeDetto}** tra i tuoi esami.`);
      return schedaRipasso(c.esame?.id);
    }
    case 'orale': return avviaOrale(c.esame, c.nomeDetto);
  }
}

/* ---------- AI ---------- */
async function eseguiStrumento(nome, x) {
  A.risposta?.fine(); A.risposta = null; modo('riposo');
  if (nome === 'avvia_focus') { const e = x.esame ? trovaEsame(x.esame) : null; F.avvia({ min: x.minuti || D.imp.focus, esameId: e?.id || null }); await mostraFatto({ testo: `Focus di ${x.minuti || D.imp.focus} minuti${e ? ' su ' + e.nome : ''}.` }); aggiornaPillola(); return { esito: 'avviato' }; }
  if (nome === 'mostra') { const e = x.esame ? trovaEsame(x.esame) : null; x.scheda === 'libretto' ? schedaLibretto() : x.scheda === 'esami' ? schedaEsami() : schedaRipasso(e?.id); return { esito: 'mostrata' }; }
  if (nome === 'crea_carte') {
    const e = x.esame ? trovaEsame(x.esame) : null, carte = x.carte.slice(0, 30);
    const card = schedaConferma({ titolo: `Salvare ${carte.length} ${carte.length === 1 ? 'carta' : 'carte'}${e ? ' di ' + e.nome : ''}?`,
      extra: `<ol class="ld-proposte">${carte.map(c => `<li><b>${esc(c.fronte)}</b><span>${esc(c.retro)}</span></li>`).join('')}</ol>`, nota: 'Entrano nel ripasso di oggi.' });
    card.querySelectorAll('.ld-proposte li').forEach((li, i) => entra(li, { ritardo: 120 + Math.min(i, 12) * 60, dy: 6, blur: 5, ms: 420 }));
    return attendiDecisione(card, async () => { carte.forEach(c => aggiungiCarta({ esameId: e?.id || null, fronte: c.fronte, retro: c.retro })); salva(); aggiornaTutto(); await mostraFatto({ testo: `${carte.length} carte salvate.`, azione: ['Ripassa ora', () => { nuovoTurno(); schedaRipasso(e?.id); }], sintesi: `${carte.length} carte` }, card); return { esito: 'salvate', n: carte.length }; });
  }
  if (nome === 'aggiungi_esame') {
    const card = schedaConferma({ titolo: `Aggiungere ${x.nome}?`, righe: [['Esame', x.nome], ['CFU', String(x.cfu || 6)], ['Appello', x.data ? dataLunga(x.data) : 'senza data']] });
    return attendiDecisione(card, async () => { const e = aggiungiEsame({ nome: x.nome, cfu: x.cfu || 6, data: /^\d{4}-\d\d-\d\d$/.test(x.data || '') ? x.data : null }); aggiornaTutto(); await mostraFatto({ testo: `${e.nome} aggiunto.` }, card); return { esito: 'aggiunto' }; });
  }
  if (nome === 'registra_voto') {
    const e = trovaEsame(x.esame);
    const card = schedaConferma({ titolo: `Registrare ${x.voto}${x.lode && x.voto === 30 ? ' e lode' : ''}?`, righe: [['Esame', e?.nome || x.esame + ' (nuovo, 6 CFU)'], ['Voto', `${x.voto}${x.lode && x.voto === 30 ? ' e lode' : ''}`]] });
    return attendiDecisione(card, async () => { const ee = e || aggiungiEsame({ nome: x.esame, cfu: 6 }); registraVoto(ee.id, { voto: x.voto, lode: x.lode }); aggiornaTutto(); await mostraFatto({ testo: 'Voto registrato.', nota: `Media ${num(media().ponderata, 2)}` }, card); return { esito: 'registrato', media: media().ponderata }; });
  }
  return { errore: 'strumento sconosciuto' };
}
async function chiediAI(testo, { sistema } = {}) {
  const g = GEN; modo('pensa', A.allegati.length ? 'Leggo il file…' : A.orale ? 'Il prof ci pensa…' : 'Un attimo…'); segnala('pensa');
  const blocchi = [];
  for (const f of A.allegati) { try { blocchi.push(await AI.bloccoFile(f.file)); } catch { } }
  if (A.allegati.length) { const t = A.turno; const box = h('div', 'ld-allegati'); A.allegati.forEach(f => box.append(chipFile(f.file, false))); t.append(box); A.allegati = []; allegatiBox.innerHTML = ''; }
  A.storia.push({ role: 'user', content: [...blocchi, { type: 'text', text: testo }] });
  A.controller = new AbortController();
  try {
    await AI.conversa({ storia: A.storia, sistema, strumenti: !A.orale, segnale: A.controller.signal, esegui: eseguiStrumento,
      suTesto: d => { if (g !== GEN) return; if (!A.risposta) { modo('riposo'); A.risposta = nuovaRisposta(); } A.risposta.aggiungi(d); } });
    A.risposta?.fine();
  } catch (e) {
    if (g !== GEN || e.name === 'AbortError' || /abort/i.test(e.message)) return;
    console.error(e);
    const msg = e.status === 401 ? 'La chiave non è valida: controllala in Impostazioni.' : e.status === 429 ? 'Troppe richieste in poco tempo: riprova tra un minuto.' : e.status === 529 || e.status >= 500 ? 'Claude è sovraccarico in questo momento: riprova tra poco.' : /Failed to fetch|NetworkError/i.test(e.message) ? 'Sembra che manchi la rete.' : 'Qualcosa non è andato: ' + e.message;
    A.risposta?.fine(); rispostaFissa(msg, { errore: true });
    // la storia resta coerente: tolgo la domanda senza risposta
    while (A.storia.length && A.storia.at(-1).role === 'user') A.storia.pop();
  } finally { A.risposta = null; if (g === GEN) { modo('riposo'); segnala('quiete'); } }
}

/* ---------- l'orale ---------- */
async function avviaOrale(e, nomeDetto) {
  if (!A.turno || A.home) nuovoTurno();
  if (!AI.attiva()) {
    rispostaFissa('Per l\'interrogazione serve l\'AI: aggiungi la tua chiave Claude in **Impostazioni** (costa pochi centesimi a sessione). Intanto puoi fare il **ripasso** delle carte.');
    return;
  }
  if (!e) {
    const lista = prossimi().length ? prossimi() : daFare();
    if (nomeDetto) { rispostaFissa(`Non trovo **${nomeDetto}**: ti interrogo comunque su quello.`); e = { id: null, nome: nomeDetto }; }
    else if (lista.length === 1) e = lista[0];
    else {
      const s = scheda('ld-scegli', `<span class="ld-lbl">Su quale esame?</span><div class="ld-preset">${lista.slice(0, 6).map(x => `<button type="button" class="ld-chip larga" data-e="${x.id}"><b>${esc(x.nome)}</b><span>${x.data ? traQuanto(x.data) : ''}</span></button>`).join('') || '<p class="ld-nota">Aggiungi prima un esame.</p>'}</div>`);
      s.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => { nuovoTurno(); detto(A.turno, 'Interrogami su ' + esame(b.dataset.e).nome); avviaOrale(esame(b.dataset.e)); }));
      return;
    }
  }
  A.orale = { esameId: e.id, nome: e.nome }; A.storia = [];
  const c = contesto(`Orale · <b>${esc(e.nome)}</b>`); const via = h('button', 'ld-esci', 'Esci'); via.type = 'button'; via.addEventListener('click', esciOrale); c.append(via);
  const carte = D.carte.filter(x => x.esameId === e.id).slice(0, 80);
  const materiale = carte.length ? `\n\nMateriale dello studente (sue carte del ripasso):\n${carte.map(x => `– ${x.fronte} → ${x.retro}`).join('\n')}` : '';
  A.turno.dataset.sintesi = `orale di ${e.nome}`;
  await chiediAI(`Iniziamo. Sono pronto per l'orale di ${e.nome}.${materiale}`, { sistema: AI.SISTEMA_ORALE(e.nome) });
}
function esciOrale() { if (!A.orale) return; A.orale = null; A.storia = []; mostraFatto({ testo: 'Orale chiuso.', nota: 'Ripassa le domande dove hai esitato.' }); }

/* ---------- inviare ---------- */
export async function invia(testo) {
  testo = String(testo || '').trim();
  if (!testo && A.allegati.length) testo = 'Crea le carte del ripasso da questo file.';
  if (!testo) return;
  Voce.zitto();
  const inp = campo.querySelector('input'); inp.value = '';
  if (A.attesa && !A.attesa.inCorso) { if (SI.test(testo)) return conferma(); if (NO.test(testo)) return annulla(); }
  if (A.orale) {
    if (/^(esci|basta orale|chiudi( l'orale)?|fine orale)$/i.test(testo)) { nuovoTurno(); detto(A.turno, testo); return esciOrale(); }
    const t = h('article', 'ld-turno'); filo.append(t); A.turno = t; detto(t, testo); requestAnimationFrame(() => { corpo.scrollTop = corpo.scrollHeight; });
    return chiediAI(testo, { sistema: AI.SISTEMA_ORALE(A.orale.nome) });
  }
  const t = nuovoTurno(); detto(t, testo);
  if (A.allegati.length) {
    if (AI.attiva()) return chiediAI(testo);
    return importaSenzaAI();
  }
  const c = interpreta(testo);
  if (c) { await attendi(120); return esegui(c); }
  if (AI.attiva()) return chiediAI(testo);
  rispostaFissa('Questo non lo so ancora fare senza AI. Ecco cosa capisco:');
  schedaAiuto();
}

/* ---------- file ---------- */
function chipFile(file, togli = true) {
  const tipo = /pdf$/i.test(file.name) ? 'PDF' : file.type.startsWith('image/') ? 'foto' : (file.name.split('.').pop() || 'file').toUpperCase();
  const c = h('span', 'ld-file', `${ico('doc')}<span>${esc(file.name)}</span><small>${tipo}</small>`);
  if (togli) { const b = h('button', '', IC.chiudi); b.type = 'button'; b.setAttribute('aria-label', 'Togli ' + file.name); b.addEventListener('click', () => { A.allegati = A.allegati.filter(x => x.file !== file); c.remove(); }); c.append(b); }
  return c;
}
function allega(files) {
  const ok = [...files].filter(f => f.size < 30e6).slice(0, 4);
  if (!ok.length) return;
  apri({ fisso: true });
  for (const f of ok) { A.allegati.push({ file: f }); const c = chipFile(f); allegatiBox.append(c); entra(c, { dy: 4, blur: 4, ms: 360 }); }
  const inp = campo.querySelector('input'); inp.placeholder = AI.attiva() ? 'Invio: ne faccio carte. Oppure chiedi altro…' : 'Invio: importo le carte (CSV, TSV, testo)';
  inp.focus();
}
function scegliFile() {
  const i = h('input'); i.type = 'file'; i.multiple = true; i.accept = '.pdf,.txt,.md,.csv,.tsv,image/*';
  i.addEventListener('change', () => allega(i.files)); i.click();
}
// senza AI: importa carte da testo «domanda<TAB>risposta» (export di Anki), «domanda;risposta» o «domanda = risposta»
async function importaSenzaAI() {
  const carte = [];
  for (const { file } of A.allegati) {
    if (!/^text\/|\.(txt|csv|tsv|md)$/i.test(file.type + ' ' + file.name)) continue;
    for (const riga of (await file.text()).split(/\r?\n/)) {
      if (!riga.trim() || riga.startsWith('#')) continue;
      const p = riga.split(/\t| = | → |;(?=[^;]*$)/); if (p.length >= 2 && p[0].trim() && p[1].trim()) carte.push({ fronte: p[0].trim().replace(/^"|"$/g, ''), retro: p.slice(1).join(' ').trim().replace(/^"|"$/g, '') });
    }
  }
  A.allegati = []; allegatiBox.innerHTML = ''; campo.querySelector('input').placeholder = 'Chiedi o scrivi un comando…';
  if (!carte.length) return rispostaFissa('Senza AI leggo solo file di testo con una carta per riga (domanda, poi Tab o «;» o « = », poi risposta), come l\'export di Anki. Per PDF e foto aggiungi la chiave Claude in Impostazioni.');
  const e = prossimi()[0];
  const card = schedaConferma({ titolo: `Importare ${carte.length} carte?`, extra: `<ol class="ld-proposte">${carte.slice(0, 8).map(c => `<li><b>${esc(c.fronte)}</b><span>${esc(c.retro)}</span></li>`).join('')}${carte.length > 8 ? `<li class="altre">e altre ${carte.length - 8}</li>` : ''}</ol>`, nota: e ? `Le metto in ${e.nome}: lo cambi dalla pagina.` : '' });
  await attendiDecisione(card, async () => { carte.forEach(c => aggiungiCarta({ ...c, esameId: e?.id || null })); salva(); aggiornaTutto(); await mostraFatto({ testo: `${carte.length} carte importate.`, azione: ['Ripassa ora', () => { nuovoTurno(); schedaRipasso(e?.id); }] }, card); return {}; });
}

/* ---------- voce ---------- */
let pttAttivo = false, testoVoce = '';
function iniziaAscolto() {
  if (Voce.attivo()) return;
  apri({ fisso: true });
  Voce.zitto(); testoVoce = '';
  const t = A.orale ? (() => { const x = h('article', 'ld-turno'); filo.append(x); A.turno = x; return x; })() : null;
  let turno = t;
  modo('ascolto'); segnala('ascolto', { ms: 99999 });
  Voce.ascolta({
    parziale: s => { testoVoce = s; if (!turno) { turno = nuovoTurno(); } detto(turno, s); },
    fine: s => {
      modo('riposo'); segnala('quiete');
      const testo = (s || testoVoce).trim();
      if (!testo) { if (turno && !turno.textContent.trim()) turno.remove(); return; }
      if (turno) { turno.remove(); if (A.turno === turno) A.turno = null; }
      invia(testo);
    },
    errore: m => { modo('riposo'); nuovoTurno(); rispostaFissa(m, { errore: true }); },
  });
}
function fineAscolto(annulla = false) { if (!Voce.attivo()) { modo('riposo'); return; } Voce.ferma(annulla); if (annulla) { modo('riposo'); segnala('quiete'); } }

/* ---------- collegamenti ---------- */
function collega() {
  shell.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; A.chiudiTra?.(); A.chiudiTra = null; if (!A.aperto) A.apriTra = dopo(110, () => apri()); });
  shell.addEventListener('pointerleave', e => {
    if (e.pointerType !== 'mouse') return; A.apriTra?.(); A.apriTra = null;
    if (A.aperto && !A.fisso && !shell.contains(document.activeElement) && !Voce.attivo()) A.chiudiTra = dopo(380, () => { A.chiudiTra = null; if (!A.fisso) chiudi(); });
  });
  pill.addEventListener('click', () => { apri({ fisso: true }).then(() => campo.querySelector('input').focus({ preventScroll: true })); });
  corpo.addEventListener('pointerdown', () => { A.fisso = true; });
  document.addEventListener('pointerdown', e => { if (A.aperto && !shell.contains(e.target) && !e.target.closest('.ld-drop')) chiudi(); });
  const inp = campo.querySelector('input');
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); invia(inp.value); } });
  inp.addEventListener('focus', () => { A.fisso = true; });
  campo.querySelector('.ld-mic').addEventListener('click', () => { Voce.attivo() ? fineAscolto() : iniziaAscolto(); });
  home.addEventListener('click', e => {
    const r = e.target.closest('[data-ld-riga]'); if (r) { premi(r); home._righe[+r.dataset.ldRiga]?.f(); return; }
    const s = e.target.closest('[data-ld-strumento]'); if (s) { premi(s); const [, nome, f] = STRUMENTI[+s.dataset.ldStrumento]; if (nome !== 'Carte da file') { nuovoTurno(); detto(A.turno, nome); } f(); return; }
    if (e.target.closest('[data-ld-esempio]')) dispatchEvent(new CustomEvent('lode:esempio'));
  });
  addEventListener('keydown', e => {
    const ptt = (MAC ? e.altKey && !e.ctrlKey : e.ctrlKey && e.shiftKey) && e.code === 'Space';
    if (ptt) { e.preventDefault(); if (!e.repeat && !pttAttivo) { pttAttivo = true; iniziaAscolto(); } return; }
    if (e.key === 'Escape') { if (Voce.attivo()) { fineAscolto(true); return; } if (A.aperto) { e.preventDefault(); chiudi(); } return; }
    const inCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !inCampo)) { e.preventDefault(); apri({ fisso: true }).then(() => inp.focus()); return; }
    if (A.aperto && A.ripasso && !inCampo && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); A.ripasso.gira(); }
      const r = RISPOSTE.find(x => x.k === e.key); if (r) { e.preventDefault(); A.ripasso.vota(r.q); }
    }
  });
  addEventListener('keyup', e => { if (pttAttivo && (e.code === 'Space' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Shift')) { pttAttivo = false; fineAscolto(); } });
  addEventListener('blur', () => { if (pttAttivo) { pttAttivo = false; fineAscolto(); } });
  // trascinare file sulla finestra
  let dentro = 0;
  addEventListener('dragenter', e => { if (![...(e.dataTransfer?.types || [])].includes('Files')) return; e.preventDefault(); if (++dentro === 1) velo.classList.add('on'); });
  addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
  addEventListener('dragleave', () => { if (--dentro <= 0) { dentro = 0; velo.classList.remove('on'); } });
  addEventListener('drop', e => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); dentro = 0; velo.classList.remove('on'); allega(e.dataTransfer.files); });
  // il timer aggiorna la pillola; la fine del focus festeggia
  addEventListener('lode:focus', e => {
    const ev = e.detail.evento;
    if (ev === 'tic') { if (!A.avviso) aggiornaPillola(); document.title = F.stato() ? `${F.mmss(F.restante())} · ${F.stato().fase === 'pausa' ? 'Pausa' : F.etichetta()}` : 'Lode'; return; }
    if (ev === 'avvio' && e.detail.fase === 'focus') segnala('focus');
    if (ev === 'avvio' && e.detail.fase === 'pausa') segnala('quiete');
    if (ev === 'fine') { segnala('fatto'); mostraAvviso(e.detail.fase === 'focus' ? `${e.detail.min} minuti fatti · pausa` : 'Pausa finita · si riparte?'); if (e.detail.fase === 'pausa') document.title = 'Lode'; }
    if (ev === 'fermo') { document.title = 'Lode'; segnala('quiete'); }
    if (!A.aperto && forma.w.t !== larghezza()) { forma.w.t = larghezza(); molla(); }
    aggiornaTutto();
  });
  addEventListener('lode:dati', () => { if (!A.avviso) aggiornaPillola(); if (A.aperto && A.home) { disegnaHome(); aggiornaTesta(); } });
  addEventListener('resize', () => { if (A.aperto) { forma.w.t = Math.min(560, innerWidth - 16); molla(); } });
}

export function avvia() {
  A = nuovoStato(); costruisci(); collega();
  if (F.stato()?.fase === 'focus' && !F.stato().fermo) setTimeout(() => segnala('focus'), 600);
}
// la pagina sotto chiede a Lode di fare cose (ripassa, interroga, focus) dal suo pannello
export const azioni = {
  focus: esameId => avviaFocus({ esameId }),
  ripassa: esameId => { apri({ fisso: true }); nuovoTurno(); detto(A.turno, esameId ? 'Ripassa ' + esame(esameId)?.nome : 'Ripasso'); schedaRipasso(esameId); },
  interroga: esameId => { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Interrogami su ' + esame(esameId)?.nome); avviaOrale(esame(esameId)); },
  libretto: () => { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Libretto'); schedaLibretto(); },
  scrivi: testo => { apri({ fisso: true }).then(() => { const i = campo.querySelector('input'); i.value = testo; i.focus(); }); },
  invia: testo => { apri({ fisso: true }); invia(testo); },
  file: () => scegliFile(),
  home: () => { ricomincia(); },
};
