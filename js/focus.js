// Il timer di concentrazione: vive nella pillola. Sopravvive a un ricaricamento della pagina (sta in localStorage).
// Fine del focus → la sessione entra nelle ore di studio dell'esame, suona un rintocco leggero e parte la pausa.
// La fase 'prova' è la prova generale (js/prova.js): un compito intero col tempo vero. Alla fine conta le ore come un
// focus, suona e avvisa «Tempo scaduto», ma la pausa non parte: prima si consegna e si dice com'è andata.
import { D, esame, registraSessione } from './dati.js';
const CH = 'lode:focus';
let T = leggi(), tic = 0;
function leggi() { try { return JSON.parse(localStorage.getItem(CH)) || null; } catch { return null; } }
function scrivi() { try { T ? localStorage.setItem(CH, JSON.stringify(T)) : localStorage.removeItem(CH); } catch { } }
const avvisa = (evento, x = {}) => dispatchEvent(new CustomEvent('lode:focus', { detail: { evento, ...x } }));

export const stato = () => T;
export function restante() {
  if (!T) return 0;
  const passati = (T.fermo ?? Date.now()) - T.inizio - T.sospeso;
  return Math.max(0, T.durata * 60e3 - passati);
}
export const avanzamento = () => T ? 1 - restante() / (T.durata * 60e3) : 0;
export const etichetta = () => T?.fase === 'pausa' ? 'Pausa' : T?.fase === 'prova' ? 'Prova generale' : (esame(T?.esameId)?.nome || 'Studio libero');
export const mmss = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function avvia({ min = D.imp.focus, esameId = null, fase = 'focus' } = {}) {
  T = { fase, durata: Math.max(1, Math.min(240, Math.round(min))), esameId, inizio: Date.now(), sospeso: 0, fermo: null };
  scrivi(); gira(); avvisa('avvio', { fase }); permesso();
  return T;
}
export function sospendi() { if (!T || T.fermo) return; T.fermo = Date.now(); scrivi(); avvisa('sospeso'); }
export function riprendi() { if (!T || !T.fermo) return; T.sospeso += Date.now() - T.fermo; T.fermo = null; scrivi(); gira(); avvisa('ripreso'); }
// fermare prima: i minuti fatti contano comunque (se almeno 5)
export function ferma() {
  if (!T) return null;
  const fatti = (T.durata * 60e3 - restante()) / 60e3, era = T;
  if ((era.fase === 'focus' || era.fase === 'prova') && fatti >= 5) registraSessione(era.esameId, fatti, era.inizio);
  T = null; scrivi(); avvisa('fermo', { min: fatti, fase: era.fase }); return { min: fatti, era };
}
function finito() {
  const era = T; T = null; scrivi();
  if (era.fase === 'focus') {
    registraSessione(era.esameId, era.durata, era.inizio);
    rintocco(2); notifica('Focus finito', `${era.durata} minuti su ${esame(era.esameId)?.nome || 'studio libero'}. Pausa di ${D.imp.pausa} minuti.`);
    avvisa('fine', { fase: 'focus', min: era.durata, esameId: era.esameId });
    avvia({ min: D.imp.pausa, esameId: era.esameId, fase: 'pausa' });
  } else if (era.fase === 'prova') {
    registraSessione(era.esameId, era.durata, era.inizio);
    rintocco(2); notifica('Tempo scaduto', 'Consegna e scrivi com\'è andata.');
    avvisa('fine', { fase: 'prova', esameId: era.esameId });
  } else {
    rintocco(1); notifica('Pausa finita', 'Si riparte quando vuoi.');
    avvisa('fine', { fase: 'pausa', esameId: era.esameId });
  }
}
function gira() {
  clearInterval(tic);
  tic = setInterval(() => {
    if (!T) { clearInterval(tic); return; }
    if (!T.fermo && restante() <= 0) { clearInterval(tic); finito(); return; }
    avvisa('tic');
  }, 250);
}
if (T) { if (!T.fermo && restante() <= 0) setTimeout(finito, 400); else gira(); }

function permesso() { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => { }); }
function notifica(titolo, corpo) {
  if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(titolo, { body: corpo, icon: 'icone/icona.svg', silent: true }); } catch { }
}
// un rintocco morbido, sintetizzato: niente file audio
let ctx;
export function rintocco(n = 1) {
  if (!D.imp.suoni) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * .28, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = i ? 1046.5 : 784;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 1.5);
    }
  } catch { }
}
