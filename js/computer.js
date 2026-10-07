// «Lezione dal computer»: l'audio che esce dal computer (la videolezione nel browser, la piattaforma della telematica,
// Teams o Zoom, la registrazione del prof) entra nella trascrizione come il microfono in aula. Lode sente quello che senti
// tu: niente download dei video, niente accesso alla piattaforma, niente account. L'audio resta in memoria a pezzi solo il
// tempo di trascriverlo, poi si butta; nella nota della lezione va solo il testo.
// Nell'app desktop: getDisplayMedia e il main che concede l'audio del sistema (desktop/main.mjs, «loopback»: WASAPI su
// Windows, CoreAudio tap sul Mac da macOS 14.2, il «monitor» di PulseAudio/PipeWire su Linux). Il video dello schermo serve
// solo all'API e si ferma subito. Se il sistema non concede l'audio, lo stream arriva muto senza errori: per questo Lode
// misura il livello e, se dopo un po' non sente niente, lo dice (muto()).
// Sul Mac l'audio arriva da lode-ascolta (desktop/ascolta.mjs, il process tap di CoreAudio): chiede solo il permesso
// dell'audio di sistema. La condivisione dello schermo sul Mac vorrebbe anche il permesso di registrare lo schermo, troppo
// per sentire una lezione: lì si usa solo se lode-ascolta non c'è.
import { t } from './lingua.js';
const SR = 16000, L = typeof window !== 'undefined' ? window.lodeDesktop : null, MAC = L?.piattaforma === 'darwin';
let flusso = null, nativo = false, ctx = null, src = null, proc = null, livello = 0, ultimoSuono = 0, inizio = 0, accensione = null;
const ascoltatori = new Set();
const avvisa = (x = {}) => dispatchEvent(new CustomEvent('lode:computer', { detail: { acceso: attivo(), ...x } }));
export const attivo = () => !!flusso || nativo;
export const disponibile = () => MAC || (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia);
// un pezzo di audio (Float32, mono, 16 kHz), da qualunque parte arrivi: il livello per l'indicatore, poi a chi ascolta
function arriva(x) {
  let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  const rms = Math.sqrt(s / Math.max(1, x.length)); livello = livello * .7 + Math.min(1, rms * 8) * .3;
  if (rms > .002) ultimoSuono = Date.now();
  for (const f of ascoltatori) { try { f(x); } catch (err) { console.warn(err); } }
}
if (MAC) {
  L.su('computer:audio', u8 => { if (!nativo || !u8?.byteLength) return; const x = new Float32Array(u8.byteLength >> 2); new Uint8Array(x.buffer).set(u8.subarray(0, x.length * 4)); arriva(x); });
  L.su('computer:fine', () => { if (nativo) { nativo = false; ascoltatori.clear(); avvisa({ finito: true }); } });
}
async function accendiMac() {
  const r = await L.invoca('computer:avvia');
  if (!r?.ok) {
    const e = new Error(r?.motivo === 'macos' ? t('computer.serve-macos') : t('computer.ascolta-non-parte', { motivo: `${r?.motivo || t('computer.motivo-sconosciuto')}${r?.codice != null ? ' ' + r.codice : ''}` }));
    e.name = r?.motivo === 'macos' ? 'VersioneMac' : 'SenzaAudio'; throw e;
  }
  nativo = true; inizio = Date.now(); ultimoSuono = 0; livello = 0; avvisa(); return true;
}
// quanto suona adesso (0-1, per l'indicatore) e se da quando è acceso non è mai arrivato un suono
export const livelloAudio = () => livello;
export const muto = (dopoMs = 20000) => attivo() && Date.now() - inizio > dopoMs && !ultimoSuono;

export function accendi() {
  if (attivo()) return Promise.resolve(true);
  accensione ||= (async () => {
    if (MAC) return accendiMac();
    const f = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    f.getVideoTracks().forEach(t => t.stop());
    const tracce = f.getAudioTracks();
    if (!tracce.length) { f.getTracks().forEach(t => t.stop()); const e = new Error(t('computer.senza-audio')); e.name = 'SenzaAudio'; throw e; }
    flusso = new MediaStream(tracce);
    ctx = new AudioContext({ sampleRate: SR }); if (ctx.state === 'suspended') await ctx.resume().catch(() => { });
    // un canale solo: lo ScriptProcessor a 1 ingresso fonde i canali (stereo → mono)
    src = ctx.createMediaStreamSource(flusso); proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = e => arriva(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc); proc.connect(ctx.destination);   // (lo ScriptProcessor manda silenzio: non si sente due volte)
    // «Interrompi condivisione» del sistema, o la sorgente sparita: si spegne e la trascrizione lo sa
    tracce[0].addEventListener('ended', () => { spegni(); avvisa({ finito: true }); });
    inizio = Date.now(); ultimoSuono = 0; livello = 0;
    avvisa(); return true;
  })().catch(e => { flusso = null; throw e; }).finally(() => { accensione = null; });
  return accensione;
}
export function spegni() {
  if (nativo) { nativo = false; livello = 0; ascoltatori.clear(); L.invoca('computer:ferma').catch(() => { }); avvisa(); return; }
  if (!flusso) return;
  proc?.disconnect(); src?.disconnect(); flusso?.getTracks().forEach(t => t.stop()); ctx?.close().catch(() => { });
  flusso = ctx = src = proc = null; livello = 0; ascoltatori.clear(); avvisa();
}
export function ascolta(f) { ascoltatori.add(f); return () => ascoltatori.delete(f); }
