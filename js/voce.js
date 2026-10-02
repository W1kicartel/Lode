// La voce di Lode, in italiano, gratis.
// • Nell'app desktop: Whisper gira DENTRO la barra (transformers.js su WebGPU), niente server e niente chiavi.
//   Mentre parli le parole compaiono (ritrascrizione dell'audio ogni ~1,2 s); quando smetti di parlare (o lasci il tasto)
//   la frase finale arriva in mezzo secondo. Il modello (base o small, in base alla memoria) si scarica una volta sola.
// • Nel browser: il riconoscimento vocale di Chrome/Edge/Safari.
// Le risposte si possono leggere ad alta voce con la voce italiana del sistema.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const DESKTOP = !!window.lodeDesktop;
export const disponibile = DESKTOP ? !!navigator.mediaDevices?.getUserMedia : !!SR;
let rec = null, livello = 0;

/* ---------- Whisper locale ---------- */
const MEM = navigator.deviceMemory || 8;   // Chromium la limita a 8: usiamo anche i core come indizio
export const MODELLO_VOCE = (MEM >= 8 && (navigator.hardwareConcurrency || 4) >= 12) ? 'onnx-community/whisper-small' : 'onnx-community/whisper-base';
let T = null, asr = null, caricando = null;
const avvisa = x => dispatchEvent(new CustomEvent('lode:voce', { detail: x }));
export const pronta = () => !!asr || MAC_PRONTO;
let MAC_PRONTO = false;
export async function prepara() {
  if (await motoreMac()) return preparaMac();
  return preparaWhisper();
}
// Parakeet: il programma si avvia (la prima volta scarica il modello, ~500 MB, e ne manda l'avanzamento)
let caricaMac = null;
function preparaMac() {
  if (MAC_PRONTO) return Promise.resolve(true);
  caricaMac ||= (async () => {
    window.lodeDesktop.su('voce:progresso', x => { if (!MAC_PRONTO) avvisa({ fase: 'scarico', p: x.p }); });
    await window.lodeDesktop.invoca('voce:prepara');
    MAC_PRONTO = true; avvisa({ fase: 'pronta' }); return true;
  })().catch(e => { caricaMac = null; avvisa({ fase: 'errore', testo: e.message }); throw e; });
  return caricaMac;
}
// sul Mac con Apple Silicon la voce è Parakeet (testi dell'interfaccia: nome e peso)
export const MAC_ARM = DESKTOP && window.lodeDesktop.piattaforma === 'darwin' && window.lodeDesktop.arch === 'arm64';
export const NOME_VOCE = MAC_ARM ? 'Parakeet' : 'Whisper';
export const PESO_VOCE = MAC_ARM ? '470' : MODELLO_VOCE.endsWith('small') ? '600' : '200';
function preparaWhisper() {
  if (asr) return Promise.resolve(asr);
  caricando ||= (async () => {
    T ||= await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');
    const dev = navigator.gpu ? 'webgpu' : 'wasm', file = {};
    asr = await T.pipeline('automatic-speech-recognition', MODELLO_VOCE, {
      device: dev, dtype: dev === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
      progress_callback: p => { if (p.status === 'progress' && p.total) { file[p.file] = [p.loaded, p.total]; const v = Object.values(file); avvisa({ fase: 'scarico', p: v.reduce((s, x) => s + x[0], 0) / v.reduce((s, x) => s + x[1], 0) }); } },
    });
    // un giro a vuoto: la prima trascrizione vera non paga la compilazione degli shader
    await asr(new Float32Array(16000), { language: 'italian', task: 'transcribe' });
    avvisa({ fase: 'pronta' });
    return asr;
  })().catch(e => { caricando = null; avvisa({ fase: 'errore', testo: e.message }); throw e; });
  return caricando;
}
// una trascrizione alla volta (il modello è uno solo), in fila; «Ripeti» passa davanti ai pezzi della lezione
// ({ subito: true }): lo studente sta aspettando, la trascrizione della lezione può aspettare due secondi.
// Sul Mac, se c'è, il motore è Parakeet (lode-voce, desktop/voce-mac): più preciso e più veloce di Whisper.
const fila = []; let lavora = false;
export function trascriviAudio(audio, { subito = false } = {}) {
  return new Promise((ok, ko) => { const x = { audio, ok, ko }; subito ? fila.unshift(x) : fila.push(x); gira(); });
}
async function gira() {
  if (lavora) return; lavora = true;
  while (fila.length) {
    const { audio, ok, ko } = fila.shift();
    try { const t = await ((await motoreMac()) ? preparaMac().then(() => parakeet(audio)) : prepara().then(() => trascrivi(audio))); ok(ALLUCINAZIONI.test(t) ? '' : t); } catch (e) { ko(e); }
  }
  lavora = false;
}
// Whisper legge 30 secondi alla volta: oltre, l'audio va diviso in finestre sovrapposte (senza, di un minuto di
// «Ripeti» arrivava solo la prima metà, la più vecchia, e mancava proprio l'ultima frase del prof)
const trascrivi = async audio => (await asr(audio, { language: 'italian', task: 'transcribe', ...(audio.length > 16000 * 29 ? { chunk_length_s: 30, stride_length_s: 5 } : {}) }))
  .text.trim().replace(/^[\s.…]+|[\s.…]+$/g, '').replace(/\s*\[.*?\]\s*/g, ' ').trim();
// Parakeet sul Neural Engine (solo Mac con Apple Silicon, quando lode-voce è installato)
let MAC = null;
export const motoreMac = () => (MAC ??= DESKTOP ? window.lodeDesktop.invoca('voce:stato').then(s => !!s?.parakeet).catch(() => false) : Promise.resolve(false));
export const nomeMotore = async () => (await motoreMac()) ? 'Parakeet v3 (Neural Engine)' : 'Whisper ' + MODELLO_VOCE.split('-').pop();
const parakeet = async audio => String(await window.lodeDesktop.invoca('voce:trascrivi', audio)).replace(/\s+/g, ' ').trim();
// Whisper sul silenzio a volte «sente» frasi tipiche dei sottotitoli: le scartiamo
const ALLUCINAZIONI = /^(sottotitoli|grazie (a tutti )?per (la visione|l'attenzione)|grazie\.?|buona visione|amara\.org|iscriviti)/i;

function ascoltaWhisper({ parziale, fine, errore, auto = true }) {
  const stato = { fermo: false, annullato: false };
  rec = stato;
  (async () => {
    let flusso;
    try { flusso = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch { rec = null; return errore?.('Serve il permesso del microfono: Impostazioni di sistema > Privacy > Microfono > Lode.'); }
    if (stato.annullato) { flusso.getTracks().forEach(t => t.stop()); return; }
    const ctx = new AudioContext({ sampleRate: 16000 }), sorgente = ctx.createMediaStreamSource(flusso);
    if (ctx.state === 'suspended') await ctx.resume().catch(() => { });   // aperta con la scorciatoia: nessun clic nella pagina
    const proc = ctx.createScriptProcessor(2048, 1, 1), pezzi = []; let campioni = 0, parlato = false, silenzio = 0, ultimo = '', occupato = false;
    const t0 = performance.now();
    const tutto = () => { const a = new Float32Array(campioni); let o = 0; for (const p of pezzi) { a.set(p, o); o += p.length; } return a; };
    // rilevamento della voce adattivo: misura il rumore di fondo della stanza (aula, TV, ventola) e considera «voce»
    // solo ciò che sta chiaramente sopra; la frase finisce quando si torna al livello del fondo per 0,9 s
    let rumore = .006, picco = 0, durataVoce = 0;   // si parte da una stanza silenziosa: chi parla subito non viene scambiato per rumore
    proc.onaudioprocess = e => {
      if (stato.fermo) return;
      const x = new Float32Array(e.inputBuffer.getChannelData(0)); pezzi.push(x); campioni += x.length;
      let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i];
      const rms = Math.sqrt(s / x.length), dt = x.length / 16000; livello = Math.min(1, rms * 9);
      const sogliaVoce = Math.max(.012, rumore * 2.4 + .006), sogliaSilenzio = Math.max(rumore * 1.5 + .004, picco * .3);
      if (rms > sogliaVoce) { parlato = true; durataVoce += dt; picco = Math.max(picco * .995, rms); silenzio = Math.max(0, silenzio - dt * 2); }
      else {
        if (!parlato || rms < sogliaSilenzio) rumore = rumore * .95 + rms * .05;   // il fondo si aggiorna solo quando non parli
        if (parlato && rms < sogliaSilenzio) silenzio += dt;
      }
      if (auto && ((parlato && durataVoce > .3 && silenzio > .9) || campioni > 16000 * 20)) chiudi();
      if (!parlato && auto && performance.now() - t0 > 8000) chiudi();
    };
    sorgente.connect(proc); proc.connect(ctx.destination);
    const giro = setInterval(async () => {   // parole mentre parli
      if (stato.fermo || occupato || !pronta() || !parlato || campioni < 16000 * .8) return;
      occupato = true; try { const t = await trascriviAudio(tutto(), { subito: true }); if (t && t !== ultimo && !ALLUCINAZIONI.test(t) && !stato.fermo) { ultimo = t; parziale?.(t); } } catch { } occupato = false;
    }, MODELLO_VOCE.endsWith('small') ? 2000 : 1200);
    async function chiudi() {
      if (stato.chiuso) return; stato.chiuso = stato.fermo = true;
      clearInterval(giro); proc.disconnect(); sorgente.disconnect(); flusso.getTracks().forEach(t => t.stop()); ctx.close();
      rec = null; livello = 0;
      if (stato.annullato) return;
      window.__lodeAudio = { n: campioni, sr: ctx.sampleRate, dati: tutto() };   // per le prove
      if (!parlato) return fine?.('');
      try { while (occupato) await new Promise(r => setTimeout(r, 30)); fine?.(await trascriviAudio(tutto(), { subito: true })); }
      catch (e) { errore?.('La voce non ha funzionato: ' + e.message); }
    }
    stato.chiudi = chiudi;
    if (stato.fermo) chiudi();
  })();
  prepara().catch(() => { });
  return stato;
}

/* ---------- riconoscimento del browser ---------- */
function ascoltaBrowser({ parziale, fine, errore }) {
  if (!SR) { errore?.('Il riconoscimento vocale non c\'è in questo browser: prova Chrome o Edge.'); return null; }
  let finale = '';
  const r = new SR(); r.lang = 'it-IT'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
  r.onresult = e => {
    let prov = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) finale += x[0].transcript; else prov += x[0].transcript; }
    livello = Math.min(1, .35 + Math.random() * .65);
    parziale?.((finale + prov).trim());
  };
  r.onerror = e => { if (e.error !== 'aborted' && e.error !== 'no-speech') errore?.(e.error === 'not-allowed' ? 'Serve il permesso del microfono.' : 'La voce non ha funzionato: riprova.'); };
  r.onend = () => { const era = rec; rec = null; if (era?._annullato) return; fine?.(finale.trim()); };
  try { r.start(); } catch { }
  return r;
}

export function ascolta(opz) { ferma(true); rec = DESKTOP ? ascoltaWhisper(opz) : ascoltaBrowser(opz); return rec; }
export function ferma(annulla = false) {
  if (!rec) return;
  if (DESKTOP) { rec.annullato = annulla; rec.fermo = true; rec.chiudi?.(); if (annulla) rec = null; return; }
  rec._annullato = annulla; try { rec.stop(); } catch { }
}
export const attivo = () => !!rec;
export function livelloVoce() { if (!DESKTOP) livello *= .92; return livello; }

/* ---------- lettura ad alta voce ---------- */
let voce = null;
function scegli() { const v = speechSynthesis.getVoices().filter(x => x.lang?.startsWith('it')); voce = v.find(x => /premium|enhanced|natural|neural/i.test(x.name)) || v.find(x => /alice|federica|elsa|isabella/i.test(x.name)) || v[0] || null; }
if ('speechSynthesis' in window) { scegli(); speechSynthesis.onvoiceschanged = scegli; }
export function leggi(testo) {
  if (!('speechSynthesis' in window) || !testo) return;
  const u = new SpeechSynthesisUtterance(String(testo).replace(/\*\*/g, '')); u.lang = 'it-IT'; if (voce) u.voice = voce; u.rate = 1.04;
  speechSynthesis.speak(u);
}
export function zitto() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }
