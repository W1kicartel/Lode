// L'orecchio di Lode: il microfono condiviso in aula. Tiene in memoria SOLO gli ultimi 90 secondi (mai su disco,
// mai trascritti finché non lo chiedi): così «Ripeti» può dirti cosa ha appena detto il prof. La trascrizione completa
// della lezione ascolta dallo stesso microfono. Si accende solo dopo il tuo consenso e, se vuoi, da solo a lezione.
const SR = 16000, TENUTA = 90;
let flusso = null, ctx = null, src = null, proc = null, anello = [], campioni = 0, ascoltatori = new Set(), accensione = null;
const avvisa = () => dispatchEvent(new CustomEvent('lode:orecchio', { detail: { acceso: attivo() } }));
export const attivo = () => !!flusso || PROVA.on;

function aggiungi(x) {
  anello.push(x); campioni += x.length;
  while (campioni - anello[0].length > SR * TENUTA) campioni -= anello.shift().length;
  for (const f of ascoltatori) { try { f(x); } catch (e) { console.warn(e); } }
}
export function accendi() {
  if (flusso) return Promise.resolve(true);
  accensione ||= (async () => {
    flusso = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    ctx = new AudioContext({ sampleRate: SR }); if (ctx.state === 'suspended') await ctx.resume().catch(() => { });
    src = ctx.createMediaStreamSource(flusso); proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = e => aggiungi(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc); proc.connect(ctx.destination);
    avvisa(); return true;
  })().catch(e => { flusso = null; throw e; }).finally(() => { accensione = null; });
  return accensione;
}
export function spegni() {
  if (!flusso && !PROVA.on) return;
  proc?.disconnect(); src?.disconnect(); flusso?.getTracks().forEach(t => t.stop()); ctx?.close();
  flusso = ctx = src = proc = null; anello = []; campioni = 0; PROVA.on = false; avvisa();
}
// gli ultimi N secondi, in un solo blocco
export function ultimi(sec = 60) {
  const n = Math.min(campioni, SR * sec), a = new Float32Array(n);
  let o = n;
  for (let i = anello.length - 1; i >= 0 && o > 0; i--) { const p = anello[i], k = Math.min(p.length, o); a.set(p.subarray(p.length - k), o - k); o -= k; }
  return a;
}
export const secondi = () => campioni / SR;
export function ascolta(f) { ascoltatori.add(f); return () => ascoltatori.delete(f); }

// prove automatiche: audio che entra come se venisse dal microfono
const PROVA = { on: false };
export async function immetti(audio) {
  PROVA.on = true; avvisa();
  for (let i = 0; i < audio.length; i += 4096) { aggiungi(audio.slice(i, i + 4096)); if (i % (4096 * 32) === 0) await new Promise(r => setTimeout(r, 0)); }
}
