// Il guardaroba di Lode: gli accessori del personaggio (il rombo bianco di js/mascotte.js), disegnati a mano in SVG.
// Solo bianco, nero e grigi, come la gemma: niente contorni, due facce di grigio diverse con la luce dall'alto a sinistra,
// angoli morbidi. Ogni accessorio ha due disegni: «piccolo» per 20–40 px (la pillola, l'intestazione del pannello: una
// silhouette pulita, pochi tratti spessi) e «grande» per 80–200 px (le carte delle Impostazioni: tutti i dettagli).
// Le coordinate sono quelle della gemma (viewBox -50 -50 100 100, la punta in alto è a y = -44, gli occhi a ±13, -2):
// i cappelli escono dal rombo verso l'alto e l'SVG li lascia uscire (overflow visibile), senza spostare la gemma.
// Le parti che oscillano (la nappa del tocco, i pompon) stanno in un <g class="acc-molla"> che ruota attorno al suo perno:
// la mascotte le muove con una molla, le carte con una piccola animazione al passaggio del cursore.
// Modulo senza DOM: si importa anche nelle prove in node (test/guardaroba.mjs).

// i grigi della gemma (e il nero degli occhi)
const B = '#FFFFFF', G1 = '#F2F2F2', G2 = '#E6E6E6', G3 = '#D2D2D2', G4 = '#BDBDBD', G5 = '#A6A6A6', G6 = '#8C8C8C',
  G7 = '#6E6E6E', G8 = '#555555', G9 = '#3C3C3C', G10 = '#2E2E2E', G11 = '#232323', G12 = '#191919', N = '#0A0A0A';

// sotto questa misura (in px, la gemma intera) si usa il disegno piccolo
export const SOGLIA = 60;

/* ---------- piccoli attrezzi per disegnare ---------- */
const r2 = x => +x.toFixed(2);
const P = (d, fill, x = '') => `<path d="${d}" fill="${fill}"${x}/>`;
const T = (d, stroke, w, x = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${x}/>`;
const E = (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${x}/>`;
const C = (cx, cy, r, fill, x = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${x}/>`;
const G = (tr, s) => `<g transform="${tr}">${s}</g>`;
const poli = pt => 'M' + pt.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' L') + ' Z';
// una parte che oscilla attorno al perno (px, py): «appesa» (la nappa: pende e torna giù) o «ritta» (il pompon: ondeggia)
const molla = (px, py, tipo, s) => `<g transform="translate(${px},${py})"><g class="acc-molla" data-tipo="${tipo}"><g transform="translate(${-px},${-py})">${s}</g></g></g>`;
// una piccola gemma sfaccettata come Lode: faccia sinistra bianca, destra grigia
const gemmina = (cx, cy, r, chiara = B, scura = G3) => P(poli([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]]), chiara) + P(poli([[cx, cy - r], [cx + r, cy], [cx, cy + r]]), scura);
// la scintilla a quattro punte (come le scintille della festa)
const scintilla = (cx, cy, r, fill = B) => P(`M${cx},${r2(cy - r)} Q${cx},${cy} ${r2(cx + r)},${cy} Q${cx},${cy} ${cx},${r2(cy + r)} Q${cx},${cy} ${r2(cx - r)},${cy} Q${cx},${cy} ${cx},${r2(cy - r)} Z`, fill);
// il pompon: un batuffolo a festoni, ombra in basso a destra e luce in alto a sinistra
function batuffolo(cx, cy, r, n = 9, dettagli = true) {
  const festoni = (x, y, rr) => {
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2, m = a - Math.PI / n;
      const px = x + Math.cos(a) * rr * .9, py = y + Math.sin(a) * rr * .9;
      d += i === 0 ? `M${r2(px)},${r2(py)}` : ` Q${r2(x + Math.cos(m) * rr * 1.12)},${r2(y + Math.sin(m) * rr * 1.12)} ${r2(px)},${r2(py)}`;
    }
    return d + ' Z';
  };
  if (!dettagli) return P(festoni(cx, cy, r), G1) + C(r2(cx + r * .28), r2(cy + r * .28), r2(r * .45), G3, ' opacity=".7"');
  return P(festoni(cx, cy, r), G3) + P(festoni(cx - r * .12, cy - r * .12, r * .82), G1) + C(r2(cx - r * .3), r2(cy - r * .32), r2(r * .26), B);
}
// ritaglia un poligono convesso con un altro (Sutherland–Hodgman): le righe del cappellino restano dentro il cono
function ritaglia(pol, contro) {
  let out = pol;
  for (let i = 0; i < contro.length; i++) {
    const a = contro[i], b = contro[(i + 1) % contro.length], dentro = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const inc = (p, q) => { const x1 = p[0], y1 = p[1], x2 = q[0], y2 = q[1], x3 = a[0], y3 = a[1], x4 = b[0], y4 = b[1]; const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4); const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d; return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]; };
    const ent = out; out = [];
    for (let j = 0; j < ent.length; j++) {
      const p = ent[j], q = ent[(j + 1) % ent.length];
      if (dentro(q)) { if (!dentro(p)) out.push(inc(p, q)); out.push(q); } else if (dentro(p)) out.push(inc(p, q));
    }
    if (!out.length) break;
  }
  return out;
}
// una foglia d'alloro lunga l, larga w, con la punta nella direzione ang (gradi): metà in luce, metà in ombra, la nervatura
function foglia(x, y, ang, l, w, dettagli = true) {
  const forma = `M0,0 Q${r2(l * .45)},${r2(-w)} ${l},0 Q${r2(l * .45)},${r2(w)} 0,0 Z`;
  const s = dettagli
    ? P(forma, G6) + P(`M0,0 Q${r2(l * .45)},${r2(-w)} ${l},0 Z`, G5) + T(`M${r2(l * .08)},0 L${r2(l * .8)},0`, G7, .6)
      + T(`M${r2(l * .35)},0 L${r2(l * .5)},${r2(-w * .45)} M${r2(l * .55)},0 L${r2(l * .68)},${r2(w * .4)}`, G7, .4)
    : P(forma, G5);
  return G(`translate(${r2(x)},${r2(y)}) rotate(${r2(ang)})`, s);
}

/* ---------- gli accessori ---------- */
// 1. il tocco del laureato (il simbolo di Lode: «30 e lode»), con la nappa che oscilla
function tocco(g) {
  if (!g) return {
    davanti: P('M-19,-20 L-17,-36 L17,-36 L19,-20 Q0,-14 -19,-20 Z', G11)
      + P('M-40,-40 L0,-27 L40,-40 L40,-35 L0,-22 L-40,-35 Z', N)
      + P('M-40,-40 L0,-53 L40,-40 L0,-27 Z', G9) + P('M0,-53 L40,-40 L0,-27 Z', G10)
      + T('M-40,-40 L0,-53', G6, 2.4)
      + T('M0,-40 Q20,-44 33,-38', G2, 3.6)
      + molla(33, -38, 'appesa', T('M33,-38 L33,-24', G2, 3.6) + E(33, -18, 4.6, 7, G1) + E(34.4, -16.5, 2.2, 4.6, G4)),
  };
  return {
    davanti: P('M-18,-21 L-16,-35 L16,-35 L18,-21 Q0,-16 -18,-21 Z', G12)
      + P('M-18,-21 L-16,-35 L-8,-35 L-9,-19.6 Q-14,-19.9 -18,-21 Z', G11)
      + P('M-37,-40 L0,-29 L37,-40 L37,-36.4 L0,-25.4 L-37,-36.4 Z', N)
      + P('M-37,-40 L0,-51 L37,-40 L0,-29 Z', G9) + P('M0,-51 L37,-40 L0,-29 Z', G10)
      + P('M-37,-40 L0,-51 L0,-46 L-28,-40 Z', G8, ' opacity=".55"')
      + T('M-37,-40 L0,-51 L37,-40', G7, 1.1)
      + T('M0,-40 Q17,-43.5 30,-38.5', G3, 1.6)
      + C(0, -40, 2.6, G4) + C(-.6, -40.7, 1, B)
      + molla(30, -38.5, 'appesa', T('M30,-38.5 L30,-25', G3, 1.6)
        + E(30, -24.2, 2.6, 2, G4)
        + P('M27.2,-23 L32.8,-23 L34.6,-10.5 Q30,-8.6 25.4,-10.5 Z', G1)
        + P('M30,-23 L32.8,-23 L34.6,-10.5 Q32.4,-9.4 30,-9.2 Z', G3)
        + T('M28.3,-21 L27.6,-11 M30,-21 L30,-10 M31.7,-21 L32.4,-11', G4, .55)),
  };
}
// 2. la corona d'alloro della laurea italiana: due rami che si incontrano in cima, foglie con le nervature, le bacche
function alloro(g) {
  const ramo = (lato, n, l, w, dett) => {
    let s = '';
    const A = [-34 * lato, -9], K = [-27 * lato, -33], Z = [-3.5 * lato, -37];
    const pt = t => [(1 - t) ** 2 * A[0] + 2 * (1 - t) * t * K[0] + t * t * Z[0], (1 - t) ** 2 * A[1] + 2 * (1 - t) * t * K[1] + t * t * Z[1]];
    s += T(`M${A[0]},${A[1]} Q${K[0]},${K[1]} ${Z[0]},${Z[1]}`, G7, dett ? 1.3 : 3);
    for (let i = 0; i < n; i++) {
      const t = .06 + i * (.9 / (n - 1)), [x, y] = pt(t), [x2, y2] = pt(Math.min(1, t + .02));
      const dir = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
      s += foglia(x, y, dir - 38 * lato, l, w, dett) + foglia(x, y, dir + 34 * lato, l * .92, w * .95, dett);
    }
    return s;
  };
  if (!g) return { davanti: ramo(1, 4, 14, 6.2, false) + ramo(-1, 4, 14, 6.2, false) + C(0, -40, 4.2, G10) };
  return {
    davanti: ramo(1, 6, 11.5, 4.6, true) + ramo(-1, 6, 11.5, 4.6, true)
      + C(-3.2, -39, 2.4, G10) + C(3.2, -39, 2.4, G10) + C(0, -42.6, 2.4, G9)
      + C(-3.9, -39.8, .7, G6) + C(2.5, -39.8, .7, G6) + C(-.7, -43.4, .7, G6),
  };
}
// 3. la coroncina con le gemme sfaccettate come il rombo
function corona(g) {
  if (!g) return {
    davanti: G('rotate(-8 0 -30)', P('M-22,-22 L-25,-46 L-12,-34 L0,-53 L12,-34 L25,-46 L22,-22 Q0,-17 -22,-22 Z', G4)
      + P('M0,-53 L12,-34 L25,-46 L22,-22 Q11,-19.4 0,-19.2 Z', G6)
      + P('M-23,-30 L23,-30 L22,-22 Q0,-17 -22,-22 Z', G8)
      + gemmina(0, -25.4, 5, B, G3) + C(-25, -47, 3.8, B) + C(0, -55, 4.2, B) + C(25, -47, 3.8, G2)),
  };
  return {
    davanti: G('rotate(-8 0 -30)', P('M-20,-22.5 L-22.5,-44 L-11,-33.5 L0,-50 L11,-33.5 L22.5,-44 L20,-22.5 Q0,-18.5 -20,-22.5 Z', G3)
      + P('M0,-50 L11,-33.5 L22.5,-44 L20,-22.5 Q10,-20.4 0,-20.4 Z', G5)
      + T('M-20.6,-29 L-22.5,-44 L-11,-33.5 L0,-50', G1, 1)
      + P('M-20.9,-30 L20.9,-30 L20,-22.5 Q0,-18.5 -20,-22.5 Z', G7)
      + P('M0,-30 L20.9,-30 L20,-22.5 Q10,-20.4 0,-20.4 Z', G8)
      + T('M-20.9,-30 L20.9,-30', G5, .8)
      + gemmina(-11, -25.6, 3, B, G3) + gemmina(0, -25.2, 3.8, B, G3) + gemmina(11, -25.6, 3, B, G3)
      + gemmina(-22.5, -46.6, 3.2, B, G3) + gemmina(0, -53, 3.8, B, G3) + gemmina(22.5, -46.6, 3.2, B, G3)),
  };
}
// 4. il berretto di lana con il risvolto a coste e il pompon
function berretto(g) {
  if (!g) return {
    davanti: P('M-22,-27 C-23,-45 -12,-53 0,-53 C12,-53 23,-45 22,-27 Z', G9)
      + P('M-22,-27 C-23,-45 -12,-53 0,-53 C-8,-50 -14,-43 -14,-27 Z', G8)
      + P('M-25,-30 Q-25,-33 -22,-33 L22,-33 Q25,-33 25,-30 L25,-21 Q25,-18 22,-18 L-22,-18 Q-25,-18 -25,-21 Z', G11)
      + T('M-13,-30 L-13,-21 M0,-30 L0,-21 M13,-30 L13,-21', G8, 2.6)
      + molla(0, -52, 'ritta', batuffolo(0, -58, 9, 8, false)),
  };
  let coste = '';
  for (let x = -21; x <= 21; x += 3.5) coste += `M${x},-29.4 L${x},-21.6 `;
  return {
    davanti: P('M-21,-27 C-22,-44 -12,-52 0,-52 C12,-52 22,-44 21,-27 Z', G9)
      + P('M-21,-27 C-22,-44 -12,-52 0,-52 C-8,-49 -14,-42 -14,-27 Z', G8)
      + T('M-12,-28 Q-9,-42 -3,-50 M-6,-28 Q-4,-42 -1,-51 M0,-28 L0,-51.5 M6,-28 Q4,-42 1,-51 M12,-28 Q9,-42 3,-50', G10, .8)
      + P('M-24,-28 Q-24,-31 -21,-31 L21,-31 Q24,-31 24,-28 L24,-22 Q24,-19 21,-19 L-21,-19 Q-24,-19 -24,-22 Z', G11)
      + T(coste, G9, 1.5)
      + T('M-22,-30.6 L22,-30.6', G7, .8)
      + molla(0, -51, 'ritta', batuffolo(0, -56.5, 7.5, 10, true)),
  };
}
// 5. il cappello da mago con la punta piegata, la luna e le stelline
function mago(g) {
  if (!g) return {
    davanti: E(0, -24, 33, 7, G11)
      + P('M-18,-25 C-12,-42 -3,-58 7,-70 C11,-75 19,-77 24,-72 C17,-70 13,-64 11,-58 C9,-46 14,-34 18,-25 Z', G9)
      + P('M-18,-25 C-12,-42 -3,-58 7,-70 C3,-56 -2,-42 -2,-25 Z', G8)
      + P('M-17,-32 Q0,-28.5 17,-32 L18.4,-25 Q0,-21 -18.4,-25 Z', G5)
      + scintilla(0, -46, 7.5, B) + T('M-33,-24 Q0,-36 33,-24', G7, 2),
  };
  return {
    davanti: E(0, -24, 31, 6.5, G12)
      + T('M-31,-24 A31,6.5 0 0 1 31,-24', G8, 1)
      + P('M-17,-25 C-12,-40 -4,-56 6,-68 C10,-73 17,-75 22,-71 C16,-69 12,-64 10,-58 C8,-46 13,-34 17,-25 Z', G11)
      + P('M-17,-25 C-12,-40 -4,-56 6,-68 C2,-56 -2,-42 -2,-25 Z', G10)
      + T('M-17,-25 C-12,-40 -4,-56 6,-68 C10,-73 17,-75 22,-71', G8, .9)
      + P('M-16,-31.5 Q0,-28.2 16,-31.5 L17.4,-25.2 Q0,-21.4 -17.4,-25.2 Z', G5)
      + P('M0,-28.6 Q8,-29 16,-31.5 L17.4,-25.2 Q9,-23 0,-22.7 Z', G6)
      + P('M-9,-42.5 A4.6,4.6 0 1 0 -6.2,-34 A3.6,3.6 0 1 1 -9,-42.5 Z', G2)
      + scintilla(5, -49, 3.8, B) + scintilla(2.5, -37.5, 2.2, G1) + scintilla(9.5, -60, 2, G2) + scintilla(-2, -55, 1.4, G3)
      + C(22.5, -71.5, 1.6, G4),
  };
}
// 6. le cuffie per il focus: archetto imbottito e cuscinetti
function cuffie(g) {
  if (!g) return {
    davanti: T('M-36,-10 C-38,-62 38,-62 36,-10', G8, 8)
      + T('M-36,-22 C-37.6,-62 37.6,-62 36,-22', G6, 2, ' transform="translate(0,-2.4)"')
      + P('M-46,-11 Q-46,-17 -40,-17 L-35,-17 Q-29,-17 -29,-11 L-29,6 Q-29,12 -35,12 L-40,12 Q-46,12 -46,6 Z', G9)
      + P('M46,-11 Q46,-17 40,-17 L35,-17 Q29,-17 29,-11 L29,6 Q29,12 35,12 L40,12 Q46,12 46,6 Z', G10)
      + E(-40, -2.5, 3.4, 7.4, G6) + E(40, -2.5, 3.4, 7.4, G7),
  };
  const coppa = (s, scura) => {
    const x = v => v * s;
    return P(`M${x(-44)},-9 Q${x(-44)},-15 ${x(-38)},-15 L${x(-35)},-15 Q${x(-30)},-15 ${x(-30)},-9 L${x(-30)},5 Q${x(-30)},11 ${x(-35)},11 L${x(-38)},11 Q${x(-44)},11 ${x(-44)},5 Z`, scura ? G12 : G11)
      + P(`M${x(-31.5)},-12 Q${x(-28)},-12 ${x(-28)},-8 L${x(-28)},4 Q${x(-28)},8 ${x(-31.5)},8 Z`, G8)
      + E(x(-38.6), -2, 3.6, 8, scura ? G11 : G10)
      + T(`M${x(-40.6)},-7.5 Q${x(-41.6)},-2 ${x(-40.6)},3.5`, scura ? G8 : G6, 1.1)
      + P(`M${x(-36.5)},-20 L${x(-33.5)},-20 L${x(-33)},-14.6 L${x(-37)},-14.6 Z`, G5);
  };
  return {
    davanti: T('M-35,-18 C-37,-60 37,-60 35,-18', G11, 6)
      + T('M-33,-30 C-31,-55 31,-55 33,-30', G10, 2.4)
      + T('M-34.6,-24 C-36.4,-61.6 36.4,-61.6 34.6,-24', G8, 1.1, ' transform="translate(0,-1.6)"')
      + coppa(1, false) + coppa(-1, true),
  };
}
// 7. gli occhiali tondi da secchione: seguono lo sguardo (la mascotte sposta il gruppo «acc-occhi» con gli occhi)
function occhiali(g) {
  if (!g) return {
    occhi: `<g class="acc-occhi">${C(-13, -2, 12, 'none', ` stroke="${N}" stroke-width="4.6"`)}${C(13, -2, 12, 'none', ` stroke="${N}" stroke-width="4.6"`)}${T('M-2,-4 Q0,-7 2,-4', N, 4)}</g>`,
  };
  const lente = cx => C(cx, -2, 11.5, B, ' opacity=".14"') + C(cx, -2, 11.5, 'none', ` stroke="${N}" stroke-width="2.6"`)
    + T(`M${cx - 8},-5.5 A8.6,8.6 0 0 1 ${cx - 3.4},-10`, B, 1.7, ' opacity=".9"') + C(cx + 6.4, 4.4, .9, B, ' opacity=".8"');
  return {
    occhi: `<g class="acc-occhi">${lente(-13)}${lente(13)}${T('M-1.6,-4.2 Q0,-7.2 1.6,-4.2', N, 2.4)}${T('M-24.4,-5 L-31,-8.5 M24.4,-5 L31,-8.5', N, 2.2)}</g>`,
  };
}
// 8. il fiocco, di lato sulla testa
function fiocco(g) {
  const k = g ? 1 : 1.28;
  const ali = P('M-2,-1 C-10,-13 -21,-11 -20,-1 C-21,9 -10,11 -2,1 Z', G12) + P('M2,-1 C10,-13 21,-11 20,-1 C21,9 10,11 2,1 Z', G11)
    + P('M-2,2 L-9,15 L-4.6,13 L-1.4,16 L0,3 Z', G12) + P('M2,2 L9,15 L4.6,13 L1.4,16 L0,3 Z', G11);
  if (!g) return { davanti: G(`translate(11,-31) rotate(36) scale(${k})`, ali + T('M-19.6,-2 C-19,-10 -12,-12 -4,-5 M4,-5 C12,-12 19,-10 19.6,-2', G6, 1.8) + P('M-3.4,-4 Q-3.4,-5 -2.4,-5 L2.4,-5 Q3.4,-5 3.4,-4 L3.4,4 Q3.4,5 2.4,5 L-2.4,5 Q-3.4,5 -3.4,4 Z', G9)) };
  return {
    davanti: G('translate(15,-34) rotate(36)', ali
      + P('M-3,-1 C-8,-7 -13,-6 -13,0 C-13,5 -8,6 -3,1 Z', G10) + P('M3,-1 C8,-7 13,-6 13,0 C13,5 8,6 3,1 Z', G12)
      + T('M-19.6,-3 C-19,-10 -12,-12 -5,-5', G8, .9) + T('M5,-5 C10,-10 16,-10 19,-5', G9, .8)
      + P('M-3.2,-3.6 Q-3.2,-4.6 -2.2,-4.6 L2.2,-4.6 Q3.2,-4.6 3.2,-3.6 L3.2,3.6 Q3.2,4.6 2.2,4.6 L-2.2,4.6 Q-3.2,4.6 -3.2,3.6 Z', G10)
      + T('M-1.6,-2.6 L-1.6,2.6', G8, .9)),
  };
}
// 9. il cappellino da festa con le righe e il pompon (anche quello della festa per un voto nuovo)
function festa(g) {
  const cono = [[-15, -25], [3, -63], [15, -25]];
  const righe = (passo, larga) => {
    let s = '';
    for (let k = 0; k < 6; k++) {
      const y0 = -29 - k * passo;
      const banda = ritaglia([[-40, y0 + 10], [40, y0 - 10], [40, y0 - 10 - larga], [-40, y0 + 10 - larga]], cono);
      if (banda.length > 2) s += P(poli(banda), G11);
    }
    return s;
  };
  if (!g) return {
    davanti: P(poli(cono), G2) + righe(13, 5.4) + P('M-16.4,-27 Q0,-21 16.4,-27 L15.6,-23 Q0,-17 -15.6,-23 Z', G9)
      + molla(3, -63, 'ritta', batuffolo(3, -68, 8, 8, false)),
  };
  return {
    davanti: P(poli(cono), G2) + P(poli([[3, -63], [15, -25], [6, -25]]), G4)
      + righe(8.6, 3.4)
      + P('M-15.6,-28 Q0,-22.2 15.6,-28 L14.9,-24 Q0,-18.4 -14.9,-24 Z', G10)
      + C(-10, -24.6, 1.3, G2) + C(-3.4, -22.4, 1.3, G2) + C(3.4, -22.4, 1.3, G2) + C(10, -24.6, 1.3, G2)
      + molla(3, -63, 'ritta', batuffolo(3, -67.5, 6, 9, true))
      + G('translate(-22,-44) rotate(-24)', P('M-1.6,-3 L1.6,-3 L1.6,3 L-1.6,3 Z', G6))
      + G('translate(23,-54) rotate(30)', P('M-1.4,-2.8 L1.4,-2.8 L1.4,2.8 L-1.4,2.8 Z', G4))
      + C(-17, -57, 1.5, G3) + C(20, -38, 1.3, G6),
  };
}
// 10. l'aureola che galleggia sopra la testa
function aureola(g) {
  if (!g) return {
    davanti: `<g class="acc-fluttua">${T('M-24,-60 A24,8 0 0 1 24,-60', G4, 7)}${T('M-24,-60 A24,8 0 0 0 24,-60', G1, 7)}</g>`,
  };
  return {
    davanti: `<g class="acc-fluttua">${T('M-22,-60 A22,6.5 0 0 1 22,-60', G5, 4.6)}${T('M-22,-60 A22,6.5 0 0 1 22,-60', G3, 2)}`
      + `${T('M-22,-60 A22,6.5 0 0 0 22,-60', G2, 4.8)}${T('M-19,-57.4 A22,6.5 0 0 0 6,-53.6', B, 1.8)}${scintilla(20, -69, 3.6, B)}${scintilla(-23, -66, 2, G2)}</g>`,
  };
}
// 11. il basco, inclinato da una parte, con il picciolo
function basco(g) {
  if (!g) return {
    davanti: P('M-28,-24 C-43,-31 -35,-54 -6,-55 C21,-56 36,-44 26,-30 C20,-25 -13,-20 -28,-24 Z', G10)
      + T('M-35,-37 C-31,-50 -19,-54 -6,-55 C8,-55.5 21,-51 28,-44', G6, 2.6) + T('M-4,-55 Q-3,-61 1,-62', G11, 4.4),
  };
  return {
    davanti: P('M-27,-25 C-41,-31 -34,-52 -6,-53 C20,-54 34,-43 25,-31 C19,-26 -12,-21 -27,-25 Z', G12)
      + P('M-31,-31 C-32,-45 -18,-51 -5,-51 C-17,-47 -25,-41 -25,-28 Z', G10)
      + T('M-33,-36 C-30,-48 -18,-52 -6,-53 C8,-53.5 20,-50 27,-43', G8, 1)
      + T('M-25,-25.6 C-10,-22.6 13,-25.2 23,-29.6', N, 2.4)
      + T('M-4,-53 Q-3.2,-58 0.4,-59.4', G12, 2.6) + C(.6, -59.4, 1.3, G11),
  };
}
// 12. il cilindro, con il nastro e un biglietto con una gemmina (la firma di Lode)
function cilindro(g) {
  if (!g) return {
    davanti: G('rotate(-8 0 -28)', E(0, -26, 29, 6, G12)
      + P('M-17,-27 L-18.5,-63 Q0,-66 18.5,-63 L17,-27 Q0,-24 -17,-27 Z', G10)
      + P('M-17.4,-38 Q0,-35 17.4,-38 L17,-29 Q0,-26 -17,-29 Z', G4)
      + E(0, -63, 18.5, 3.6, G9) + T('M-18.5,-63 L-17,-27', G7, 2.4)),
  };
  return {
    davanti: G('rotate(-8 0 -28)', E(0, -26, 27, 5.6, G12)
      + T('M-27,-26 A27,5.6 0 0 0 27,-26', G9, 1)
      + P('M-16,-27 L-17.5,-62 Q0,-65 17.5,-62 L16,-27 Q0,-24 -16,-27 Z', G11)
      + P('M-16,-27 L-17.5,-62 Q-12,-63.3 -9,-63.6 L-9,-25.6 Q-13,-26 -16,-27 Z', G10)
      + E(0, -62, 17.5, 3.5, G9) + T('M-17.5,-62 A17.5,3.5 0 0 1 17.5,-62', G7, .8)
      + P('M-16.4,-35.5 Q0,-32.5 16.4,-35.5 L16.1,-29 Q0,-26 -16.1,-29 Z', G4)
      + P('M0,-32.6 Q8,-33 16.4,-35.5 L16.1,-29 Q8,-26.6 0,-26.2 Z', G5)
      + G('translate(9.6,-39) rotate(10)', P('M-3.4,-5 L3.4,-5 L3.4,5 L-3.4,5 Z', G1) + gemmina(0, -.4, 2.4, B, G4))),
  };
}

// l'elenco: id (si salva in D.imp.accessorio), la chiave del nome nel catalogo «guardaroba», il disegno
export const ACCESSORI = [
  { id: 'tocco', chiave: 'guardaroba.tocco', disegna: tocco },
  { id: 'alloro', chiave: 'guardaroba.alloro', disegna: alloro },
  { id: 'corona', chiave: 'guardaroba.corona', disegna: corona },
  { id: 'berretto', chiave: 'guardaroba.berretto', disegna: berretto },
  { id: 'mago', chiave: 'guardaroba.mago', disegna: mago },
  { id: 'cuffie', chiave: 'guardaroba.cuffie', disegna: cuffie },
  { id: 'occhiali', chiave: 'guardaroba.occhiali', disegna: occhiali },
  { id: 'fiocco', chiave: 'guardaroba.fiocco', disegna: fiocco },
  { id: 'festa', chiave: 'guardaroba.festa', disegna: festa },
  { id: 'aureola', chiave: 'guardaroba.aureola', disegna: aureola },
  { id: 'basco', chiave: 'guardaroba.basco', disegna: basco },
  { id: 'cilindro', chiave: 'guardaroba.cilindro', disegna: cilindro },
];
export const IDS = ACCESSORI.map(a => a.id);
export const accessorio = id => ACCESSORI.find(a => a.id === id) || null;
// un accessorio che si può salvare: uno dell'elenco, o null (nessuno). Una stringa sconosciuta (un backup di una versione
// futura, dati scritti a mano) non è un errore: vale nessuno
export const valido = id => id == null || IDS.includes(id);
export const inForma = id => (typeof id === 'string' && IDS.includes(id) ? id : null);

// le parti dell'accessorio da disegnare alla misura px (la gemma intera, in px): dietro la gemma, sopra la faccia, sugli occhi
export function disegno(id, px = 20) {
  const a = accessorio(id); if (!a) return { dietro: '', davanti: '', occhi: '', grande: px >= SOGLIA };
  const grande = px >= SOGLIA, d = a.disegna(grande);
  return { dietro: d.dietro || '', davanti: d.davanti || '', occhi: d.occhi || '', grande };
}

// la gemma con gli occhi (gli stessi tracciati di js/mascotte.js), per le carte del guardaroba e l'anteprima
export const GEMMA = '<path d="M0,-44 Q4,-44 7,-41 L41,-7 Q44,-4 44,0 Q44,4 41,7 L7,41 Q4,44 0,44 Q-4,44 -7,41 L-41,7 Q-44,4 -44,0 Q-44,-4 -41,-7 L-7,-41 Q-4,-44 0,-44 Z" fill="#FFFFFF"/>'
  + '<path d="M0,-44 L44,0 L0,44 Z" fill="#E9E9E9"/><path d="M-24,-20 L0,-44 L8,-36 L-16,-12 Z" fill="#FFFFFF" opacity=".9"/>';
const OCCHI = '<g class="gr-occhi"><ellipse class="gr-occhio" cx="-13" cy="-2" rx="5.2" ry="8.5" fill="#0A0A0A"/><ellipse class="gr-occhio" cx="13" cy="-2" rx="5.2" ry="8.5" fill="#0A0A0A"/>'
  + '<circle cx="-11.5" cy="-5.5" r="1.8" fill="#FFFFFF"/><circle cx="14.5" cy="-5.5" r="1.8" fill="#FFFFFF"/></g>';
// la cornice delle carte: c'è posto per il cappello più alto (il mago), le cuffie ai lati e l'ombra sotto
export const CORNICE = { x: -56, y: -82, l: 112, a: 136 };
// il personaggio intero con l'accessorio, alto circa px (la gemma è larga px * 100 / 112 della cornice)
export function personaggio(id, px = 100, { classe = '' } = {}) {
  const gemma = Math.round(px * 100 / CORNICE.l), d = disegno(id, gemma), { x, y, l, a } = CORNICE;
  return `<svg class="gr-pers${classe ? ' ' + classe : ''}" viewBox="${x} ${y} ${l} ${a}" width="${px}" height="${Math.round(px * a / l)}" aria-hidden="true" focusable="false">`
    + `<ellipse class="gr-ombra" cx="0" cy="50" rx="26" ry="3.6" fill="#000000" opacity=".35"/>`
    + `<g class="gr-salta">${d.dietro}${GEMMA}${OCCHI}${d.occhi}${d.davanti}</g></svg>`;
}

// la festa per un voto nuovo: per qualche secondo il cappellino (o il tocco, se è 30 e lode), poi l'accessorio di sempre
export function festeggia(lode = false, ms = 4500) {
  if (typeof dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return;
  dispatchEvent(new CustomEvent('lode:guardaroba', { detail: { festa: lode ? 'tocco' : 'festa', ms } }));
}
// l'accessorio scelto è cambiato (le Impostazioni, la barra): la mascotte lo mette subito
export function cambiato(id) {
  if (typeof dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return;
  dispatchEvent(new CustomEvent('lode:guardaroba', { detail: { id: inForma(id) } }));
}
