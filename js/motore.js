// Il tempo di Lode: un solo giro di requestAnimationFrame per tutte le animazioni (lo stesso motore di Lumi).
// Curva morbida cubic-bezier(.22,1,.36,1), entrate con sfocatura, molle smorzate senza rimbalzi.
export const RIDOTTO = matchMedia('(prefers-reduced-motion: reduce)').matches;
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
  return p => {
    if (p <= 0) return 0; if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 8; i++) { const e = X(t) - p, d = dX(t); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; t -= e / d; }
    if (t < 0 || t > 1 || Math.abs(X(t) - p) > 1e-3) { let a = 0, b = 1; t = p; for (let i = 0; i < 24; i++) { if (X(t) < p) a = t; else b = t; t = (a + b) / 2; } }
    return Y(t);
  };
}
export const morbido = bezier(.22, 1, .36, 1), lineare = x => x;
const giri = new Set(); let raf = 0;
function giro() {
  raf = 0; const t = performance.now();
  for (const f of [...giri]) { if (!giri.has(f)) continue; let ok = false; try { ok = f(t); } catch (e) { console.error(e); } if (ok === false) giri.delete(f); }
  if (giri.size) raf = requestAnimationFrame(giro);
}
export function ogni(f) { giri.add(f); if (!raf) raf = requestAnimationFrame(giro); return () => giri.delete(f); }
export function tween(ms, fn, { ritardo = 0, ease = morbido } = {}) {
  if (RIDOTTO) ms = Math.min(ms, 1);
  return new Promise(res => {
    const t0 = performance.now() + ritardo; fn(0, 0);
    ogni(t => { const p = ms > 0 ? (t - t0) / ms : (t >= t0 ? 1 : -1); if (p < 0) return true; if (p >= 1) { fn(1, 1); res(); return false; } fn(ease(p), p); return true; });
  });
}
export const attendi = ms => new Promise(res => { const t0 = performance.now(); ogni(t => { if (t - t0 >= ms) { res(); return false; } return true; }); });
export function dopo(ms, f) { const t0 = performance.now(); let via = false; const stop = ogni(t => { if (via) return false; if (t - t0 >= ms) { f(); return false; } return true; }); return () => { via = true; stop(); }; }
export function entra(el, { ritardo = 0, dy = 8, blur = 6, ms = 520, scala = 1 } = {}) {
  return tween(ms, e => {
    if (e >= 1) { el.style.opacity = ''; el.style.transform = ''; el.style.filter = ''; return; }
    el.style.opacity = e.toFixed(3);
    el.style.transform = `translateY(${((1 - e) * dy).toFixed(2)}px)` + (scala !== 1 ? ` scale(${(scala + (1 - scala) * e).toFixed(4)})` : '');
    el.style.filter = blur ? `blur(${((1 - e) * blur).toFixed(2)}px)` : '';
  }, { ritardo });
}
export function comprimi(el, ms = 360, togli = true) {
  const h0 = el.offsetHeight, gap = parseFloat(getComputedStyle(el.parentElement).rowGap) || 0;
  el.style.overflow = 'hidden';
  return tween(ms, e => {
    el.style.height = (h0 * (1 - e)).toFixed(2) + 'px'; el.style.marginBottom = (-gap * e).toFixed(2) + 'px';
    el.style.opacity = Math.max(0, 1 - e * 1.8).toFixed(3);
  }).then(() => { if (togli) el.remove(); else el.style.display = 'none'; });
}
export function premi(b) {
  if (!b) return Promise.resolve();
  return tween(90, e => { b.style.transform = `scale(${1 - .04 * e})`; }, { ease: lineare }).then(() => tween(260, e => { b.style.transform = e >= 1 ? '' : `scale(${.96 + .04 * e})`; }));
}
// un numero che sale fino al suo valore
export function conta(el, a, fmt, { ms = 900, ritardo = 60 } = {}) { return tween(ms, e => { el.textContent = fmt(a * e); }, { ritardo }); }
export function h(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

// luce che segue il cursore sulle superfici (come movimento.js del gestionale)
const LUCE = '.blocco,.esame,.btn,.ld-scheda,.stat';
const mouse = matchMedia('(hover: hover) and (pointer: fine)');
let ultimo = null, r2 = 0;
document.addEventListener('pointermove', e => {
  if (RIDOTTO || !mouse.matches) return; ultimo = e;
  if (!r2) r2 = requestAnimationFrame(() => {
    r2 = 0;
    for (let el = ultimo.target instanceof Element ? ultimo.target : null; el && el !== document.body; el = el.parentElement) {
      if (!el.matches(LUCE)) continue;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (ultimo.clientX - r.left).toFixed(0) + 'px'); el.style.setProperty('--my', (ultimo.clientY - r.top).toFixed(0) + 'px');
    }
  });
}, { passive: true });
