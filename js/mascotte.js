// Lode, il personaggio: un piccolo rombo bianco sfaccettato, come una gemma, con due occhi che vive nella pillola in cima alla
// finestra. Sbatte le palpebre, guarda il cursore, ascolta (si gonfia con la voce), pensa, parla, sorride quando ha finito,
// salta quando c'è da confermare. È un livello sopra l'interfaccia che segue il rombo della pillola o dell'intestazione
// del pannello, e reagisce agli eventi 'lode' di lode.js.
// Porta l'accessorio del guardaroba (js/guardaroba.js, D.imp.accessorio), nel disegno piccolo: segue il corpo (salti, gonfiore
// della voce, inclinazione verso il cursore), gli occhiali seguono lo sguardo, nappa e pompon arrivano con un po' di ritardo
// (una molla). Per un voto nuovo, qualche secondo con il cappellino da festa (il tocco per il 30 e lode).
import { D } from './dati.js';
import { disegno, inForma } from './guardaroba.js';
const RIDOTTO = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, padre) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (padre) padre.append(e); return e; };
const radice = document.createElement('div'); radice.id = 'mascotte'; radice.setAttribute('aria-hidden', 'true');
const corpo = document.createElement('div'); corpo.className = 'corpo'; radice.append(corpo);
const scint = document.createElement('div'); scint.className = 'scintille'; radice.append(scint);
const raggi = Array.from({ length: 6 }, () => { const i = document.createElement('i'); scint.append(i); return i; });

// la gemma: rombo con angoli morbidi, due facce di bianco diverse (luce dall'alto a sinistra) e gli occhi
const svg = el('svg', { viewBox: '-50 -50 100 100', width: 20, height: 20 }, corpo);
const accDietro = el('g', { class: 'acc-dietro' }, svg);   // le parti dell'accessorio dietro la gemma
el('path', { d: 'M0,-44 Q4,-44 7,-41 L41,-7 Q44,-4 44,0 Q44,4 41,7 L7,41 Q4,44 0,44 Q-4,44 -7,41 L-41,7 Q-44,4 -44,0 Q-44,-4 -41,-7 L-7,-41 Q-4,-44 0,-44 Z', fill: '#FFFFFF' }, svg);
el('path', { d: 'M0,-44 L44,0 L0,44 Z', fill: '#E9E9E9' }, svg);
el('path', { d: 'M-24,-20 L0,-44 L8,-36 L-16,-12 Z', fill: '#FFFFFF', opacity: .9 }, svg);
const occhi = el('g', {}, svg);
const occhioS = el('ellipse', { cx: -13, cy: -2, rx: 5.2, ry: 8.5, fill: '#0A0A0A' }, occhi);
const occhioD = el('ellipse', { cx: 13, cy: -2, rx: 5.2, ry: 8.5, fill: '#0A0A0A' }, occhi);
const lucS = el('circle', { cx: -11.5, cy: -5.5, r: 1.8, fill: '#fff' }, occhi);
const lucD = el('circle', { cx: 14.5, cy: -5.5, r: 1.8, fill: '#fff' }, occhi);
const felice = el('g', { opacity: 0 }, svg);
el('path', { d: 'M-19,1 Q-13,-9 -7,1', stroke: '#0A0A0A', 'stroke-width': 4.2, fill: 'none', 'stroke-linecap': 'round' }, felice);
el('path', { d: 'M7,1 Q13,-9 19,1', stroke: '#0A0A0A', 'stroke-width': 4.2, fill: 'none', 'stroke-linecap': 'round' }, felice);
// l'accessorio sopra la faccia (e gli occhiali sopra gli occhi): il gruppo «pop» fa la molla quando cambia
const accOcchi = el('g', { class: 'acc-sugli-occhi' }, svg);
const accPop = el('g', { class: 'acc-pop' }, svg);
const accDavanti = el('g', { class: 'acc-davanti' }, accPop);
const ACC = { id: undefined, pop: -1e9, molle: [], fluttua: null, festaId: null, festaFino: 0, prima: null };
function vesti(id, t) {
  const d = disegno(id, 20);   // la mascotte è sempre piccola (20 px nella pillola, ~29 nel pannello): il disegno piccolo
  accDietro.innerHTML = d.dietro; accDavanti.innerHTML = d.davanti; accOcchi.innerHTML = d.occhi;
  ACC.molle = [...svg.querySelectorAll('.acc-molla')].map(g => ({ g, tipo: g.dataset.tipo, a: 0, v: 0 }));
  ACC.fluttua = svg.querySelector('.acc-fluttua');
  if (ACC.id !== undefined && id) ACC.pop = t;
  ACC.id = id;
}
addEventListener('lode:guardaroba', e => {
  if (e.detail?.festa) { ACC.festaId = e.detail.festa; ACC.festaFino = ora() + (e.detail.ms || 4500); }
});

const ora = () => performance.now();
const S = { dove: 'pillola', salto: null, umore: 'quiete', finoA: 0, parlaFino: 0, festa: 0, mouse: [innerWidth / 2, innerHeight / 2], livello: 0, attivo: false };
addEventListener('pointermove', e => { S.mouse = [e.clientX, e.clientY]; }, { passive: true });
const morb = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const molla = t => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-6.5 * t) * Math.cos(10.5 * t));

function ancora() {
  // mentre si trascina un file, la gemma sta al centro della zona e lo guarda arrivare
  const z = document.querySelector('.ld.drop .ld-zona-in svg');
  if (z) { const r = z.getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: 1.6 }; }
  // con una proposta aperta la gemma sta al suo posto, a sinistra della proposta (non sopra il testo)
  const a = document.querySelector(S.dove === 'pannello' ? '.ld[data-aperto="1"] .ld-testa .r1 .ld-rombo' : '.ld.propone:not([data-aperto="1"]) .ld-proposta .ld-rombo') || document.querySelector(S.dove === 'pannello' ? '.ld[data-aperto="1"] .ld-testa .r1 .ld-rombo' : '.ld-pill .ld-rombo');
  if (!a) return null;
  const r = a.getBoundingClientRect(); if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2 + (S.dove === 'pannello' ? 4 : 0), y: r.top + r.height / 2, s: S.dove === 'pannello' ? 1.45 : 1.05 };
}
let ultima = { x: innerWidth / 2, y: 27, s: 1.05 };
function salta(verso) { if (S.dove === verso) return; S.salto = { da: { ...ultima }, t0: ora(), ms: RIDOTTO ? 1 : 520 }; S.dove = verso; }

addEventListener('lode', e => {
  const ev = e.detail.evento, t = ora();
  if (ev === 'aperto') salta('pannello');
  else if (ev === 'chiuso') salta('pillola');
  else if (ev === 'ascolto') { S.umore = 'ascolto'; S.finoA = t + (e.detail.ms || 600); }
  else if (ev === 'pensa') { S.umore = 'pensa'; S.finoA = 0; }
  else if (ev === 'risposta') { S.umore = 'parla'; S.parlaFino = t + (e.detail.ms || 900); }
  else if (ev === 'scheda' || ev === 'bozza') { if (S.umore !== 'attenzione') { S.umore = 'parla'; S.parlaFino = t + 500; } }
  else if (ev === 'conferma-pronta') { S.umore = 'attenzione'; S.finoA = t + 2200; }
  else if (ev === 'confermato' || ev === 'inviati' || ev === 'in-agenda' || ev === 'fatto') { S.umore = 'felice'; S.finoA = t + 1300; S.festa = t; }
  else if (ev === 'quiete') { S.umore = 'quiete'; S.finoA = 0; }
  else if (ev === 'focus') { S.umore = 'focus'; S.finoA = 0; }
});
export function livelloVoce(v) { S.livello = v; }

let montato = false, fot = 0;
function passo() {
  requestAnimationFrame(passo);
  if (!document.querySelector('.ld')) { if (montato) { radice.remove(); montato = false; } return; }
  if (!montato) { document.body.append(radice); montato = true; }
  const t = ora();
  // a riposo e a pannello chiuso basta un fotogramma su due
  const fermo = (S.umore === 'quiete' || S.umore === 'focus') && S.dove === 'pillola' && !S.salto && t - S.festa > 900;
  if (fermo && (fot++ & 1)) return;
  const a = ancora() || ultima; let p = a;
  if (S.salto) {
    const k = (t - S.salto.t0) / S.salto.ms;
    if (k >= 1) S.salto = null;
    else { const q = morb(k), d = S.salto.da; p = { x: d.x + (a.x - d.x) * q, y: d.y + (a.y - d.y) * q - Math.sin(Math.PI * Math.min(1, k)) * 46, s: d.s + (a.s - d.s) * molla(k) }; }
  }
  const dt = ACC.prima ? Math.min(.05, Math.max(.001, (t - ACC.prima.t) / 1000)) : .016, velX = ACC.prima ? (p.x - ACC.prima.x) / dt : 0;
  ACC.prima = { t, x: p.x };
  ultima = p;
  if (['ascolto', 'attenzione', 'felice'].includes(S.umore) && S.finoA && t > S.finoA) { S.umore = S.umore === 'ascolto' ? 'pensa' : 'quiete'; S.finoA = 0; }
  if (S.umore === 'parla' && t > S.parlaFino) S.umore = 'quiete';

  let dy = RIDOTTO ? 0 : Math.sin(t / 380) * 1.1, sc = 1, rot = RIDOTTO ? 0 : Math.sin(t / 900) * 3;
  if (!RIDOTTO) {
    if (S.umore === 'ascolto') { sc = 1 + .05 + .16 * Math.min(1, S.livello) ; rot = Math.sin(t / 140) * 4; }
    if (S.umore === 'pensa') { rot = Math.sin(t / 220) * 9; dy -= 1.5; }
    if (S.umore === 'parla') { dy -= Math.abs(Math.sin(t / 85)) * 2.4; sc = 1 + .05 * Math.abs(Math.sin(t / 85)); }
    if (S.umore === 'attenzione') { dy -= Math.abs(Math.sin(t / 120)) * 5; rot = Math.sin(t / 60) * 6 * Math.max(0, 1 - (t - (S.finoA - 2200)) / 700); }
    if (S.umore === 'focus') { dy = Math.sin(t / 1400) * .9; rot = 0; sc = 1 + Math.sin(t / 1400) * .025; }
    if (S.umore === 'felice') { const k = (t - S.festa) / 520; if (k < 1) { dy -= Math.sin(Math.PI * k) * 16; rot = 360 * morb(k); } sc = 1.06; }
  }
  // gli occhi (e l'inclinazione): verso il cursore
  const vx = S.mouse[0] - p.x, vy = S.mouse[1] - p.y, n = Math.hypot(vx, vy) || 1;
  if (!RIDOTTO && S.umore !== 'focus' && S.umore !== 'felice') rot += vx / n * 3;
  corpo.style.transform = `translate(${(p.x - 10).toFixed(2)}px,${(p.y - 10 + dy).toFixed(2)}px) scale(${(p.s * sc).toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;

  // occhi: guardano il cursore (in alto se pensa, in basso se aspetta la conferma), sbattono ogni ~3,2 s
  let ox = vx / n * 3.2, oy = vy / n * 2.6;
  if (S.umore === 'pensa') { ox = 3.5; oy = -4; }
  if (S.umore === 'attenzione') { ox = 0; oy = 4; }
  if (S.umore === 'focus') { ox = 0; oy = 4.2; }   // legge: occhi bassi
  const ciclo = t % 3200, chiudi = ciclo < 130 ? Math.sin(ciclo / 130 * Math.PI) : 0;
  const ry = 8.5 * (1 - .9 * chiudi) * (S.umore === 'ascolto' ? 1.18 : 1), lieto = S.umore === 'felice';
  occhi.setAttribute('opacity', lieto ? 0 : 1); felice.setAttribute('opacity', lieto ? 1 : 0);
  [[occhioS, -13], [occhioD, 13]].forEach(([o, cx]) => { o.setAttribute('cx', (cx + ox).toFixed(2)); o.setAttribute('cy', (-2 + oy).toFixed(2)); o.setAttribute('ry', ry.toFixed(2)); });
  lucS.setAttribute('cx', (-11.5 + ox).toFixed(2)); lucS.setAttribute('cy', (-5.5 + oy).toFixed(2)); lucS.setAttribute('opacity', chiudi > .5 ? 0 : 1);
  lucD.setAttribute('cx', (14.5 + ox).toFixed(2)); lucD.setAttribute('cy', (-5.5 + oy).toFixed(2)); lucD.setAttribute('opacity', chiudi > .5 ? 0 : 1);

  // l'accessorio: quello scelto, o quello della festa per qualche secondo
  const id = ACC.festaFino > t ? ACC.festaId : inForma(D.imp?.accessorio);
  if (id !== ACC.id) vesti(id, t);
  if (id) {
    accOcchi.setAttribute('transform', `translate(${(ox * .55).toFixed(2)},${(oy * .55).toFixed(2)})`);
    const kp = (t - ACC.pop) / 520;
    accPop.setAttribute('transform', RIDOTTO || kp >= 1 ? '' : `translate(0,-30) scale(${(.55 + .45 * molla(kp)).toFixed(3)}) translate(0,30)`);
    if (ACC.fluttua) ACC.fluttua.setAttribute('transform', RIDOTTO ? '' : `translate(0,${(Math.sin(t / 650) * 2.4).toFixed(2)})`);
    // nappa e pompon: una molla verso dove li porterebbero il peso e il movimento (la nappa pende sempre in giù)
    const giro = ((rot + 180) % 360 + 360) % 360 - 180;
    for (const m of ACC.molle) {
      if (RIDOTTO) { m.g.setAttribute('transform', ''); continue; }
      const meta = Math.max(-45, Math.min(45, m.tipo === 'appesa' ? -giro + velX * .05 : -velX * .04 - giro * .25));
      m.v += (90 * (meta - m.a) - 8 * m.v) * dt; m.a += m.v * dt;
      m.g.setAttribute('transform', `rotate(${m.a.toFixed(2)})`);
    }
  }
  const kf = S.festa ? (t - S.festa) / 700 : 2;
  raggi.forEach((r, i) => {
    if (kf >= 1 || RIDOTTO) { r.style.opacity = 0; return; }
    const ang = i / raggi.length * 360, dist = 10 + morb(kf) * 18 * p.s;
    r.style.opacity = (1 - kf).toFixed(3);
    r.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) rotate(${ang}deg) translateY(${(-dist).toFixed(1)}px) scaleY(${(1 - kf * .6).toFixed(3)})`;
  });
}
requestAnimationFrame(passo);
