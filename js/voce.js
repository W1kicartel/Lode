// La voce di Lode, nella lingua della barra, gratis.
// • Nell'app desktop il motore lo sceglie il main (voce:stato): Parakeet v3 sul Neural Engine (Mac con chip Apple e
//   lode-voce), Parakeet v3 ONNX sul processore (Windows, Linux: desktop/voce-onnx.mjs, se c'è l'addon e almeno ~6 GB di
//   memoria), altrimenti Whisper DENTRO la barra (transformers.js su WebGPU, o sul processore se la scheda non c'è).
//   Niente server e niente chiavi. Mentre parli le parole compaiono (ritrascrizione dell'audio ogni ~1,2 s); quando smetti
//   di parlare (o lasci il tasto) la frase finale arriva in mezzo secondo. Il modello si scarica una volta sola.
//   Se Parakeet ONNX non parte (addon, crash, modello rovinato, spazio) si passa a Whisper senza perdere l'audio in corso.
// • Nel browser: il riconoscimento vocale di Chrome/Edge/Safari.
// Le risposte si possono leggere ad alta voce con la voce del sistema nella lingua della barra.
// La lingua: a Whisper si dice quale (WHISPER di parole.js: «italian», «english»…), il riconoscimento del browser e la
// lettura ad alta voce vogliono il paese («it-IT», «pt-BR»). Parakeet v3 (lode-voce sul Mac, sherpa-onnx altrove) la
// riconosce da solo: né FluidAudio né il transducer di sherpa-onnx hanno un parametro per la lingua.
import { libreria } from './librerie.js';
import { t, lingua } from './lingua.js';
import { WHISPER, PAESE_VOCE } from './parole.js';
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const DESKTOP = !!window.lodeDesktop;
export const disponibile = DESKTOP ? !!navigator.mediaDevices?.getUserMedia : !!SR;
let rec = null, livello = 0;

/* ---------- Whisper locale ---------- */
const MEM = navigator.deviceMemory || 8;   // Chromium la limita a 8: usiamo anche i core come indizio
// sul processore (senza una scheda per WebGPU) gira su un filo solo: sempre base, small sarebbe troppo lento
let CPU = !navigator.gpu;
// transformers.js e i file di onnxruntime (wasm) con la versione esatta, dal disco (vendor/, js/librerie.js): dalla rete
// arriva solo il modello, da huggingface.co
const BASE = 'onnx-community/whisper-base', TJS = libreria('transformers');
export let MODELLO_VOCE = (!CPU && MEM >= 8 && (navigator.hardwareConcurrency || 4) >= 12) ? 'onnx-community/whisper-small' : BASE;
let T = null, asr = null, caricando = null;
const avvisa = x => dispatchEvent(new CustomEvent('lode:voce', { detail: x }));
// «pronta» = scaricata e partita almeno una volta: dopo un riposo (vedi sotto) torna in memoria da sola, senza riscaricare
export const pronta = () => !!asr || NATIVO_PRONTO || partita;
let NATIVO_PRONTO = false, partita = false;
export async function prepara() {
  if (await motoreNelMain()) return preparaNativo().catch(e => { if (!e.ripiego) throw e; ripiega(e); return preparaWhisper(); });
  return preparaWhisper();
}
// Parakeet (nel main: lode-voce sul Mac, o il motore ONNX): si avvia, e la prima volta scarica il modello (470-640 MB)
// mandandone l'avanzamento. Il main risponde { errore, ripiego } quando Parakeet ONNX non può partire su questo computer
let caricaNativo = null, suProgresso = false, staCaricando = 0;
function preparaNativo() {
  if (NATIVO_PRONTO) return Promise.resolve(true);
  caricaNativo ||= (async () => {
    staCaricando++;
    if (!suProgresso) { suProgresso = true; window.lodeDesktop.su('voce:progresso', x => { if (!NATIVO_PRONTO && !partita) avvisa({ fase: 'scarico', p: x.p }); }); }
    risposta(await window.lodeDesktop.invoca('voce:prepara'));
    NATIVO_PRONTO = partita = true; avvisa({ fase: 'pronta' }); return true;
  })().catch(e => { caricaNativo = null; if (!e.ripiego) avvisa({ fase: 'errore', testo: e.message }); throw e; }).finally(() => staCaricando--);
  return caricaNativo;
}
// la risposta del main: il testo, oppure { errore, ripiego } → un errore che dice se passare a Whisper
export function risposta(r) {
  if (r && typeof r === 'object' && r.errore) throw Object.assign(new Error(r.errore), { ripiego: !!r.ripiego });
  return r;
}
// I testi dell'interfaccia (nome, descrizione, peso del download) seguono il motore. Sul Mac con chip Apple si parte
// da Parakeet, altrove da Whisper; voce:stato li corregge appena risponde (pochi millisecondi dopo l'avvio della barra).
export const MAC_ARM = DESKTOP && window.lodeDesktop.piattaforma === 'darwin' && window.lodeDesktop.arch === 'arm64';
export let NOME_VOCE = MAC_ARM ? 'Parakeet' : 'Whisper';
export let PESO_VOCE = MAC_ARM ? '470' : MODELLO_VOCE.endsWith('small') ? '600' : '200';
let MOTORE_TESTI = MAC_ARM ? 'mac' : 'whisper';
const whisperTesti = () => { NOME_VOCE = 'Whisper'; PESO_VOCE = MODELLO_VOCE.endsWith('small') ? '600' : '200'; };
export function testiVoce(m, peso) {
  MOTORE_TESTI = m;
  if (m === 'mac') { NOME_VOCE = 'Parakeet'; PESO_VOCE = '470'; }
  else if (m === 'onnx') { NOME_VOCE = 'Parakeet'; PESO_VOCE = String(peso || 640); }
  else whisperTesti();
}
// «Parakeet v3 sul Neural Engine del Mac», «Parakeet v3 sul processore» o «Whisper base»/«Whisper small»
export const descrizioneVoce = () => MOTORE_TESTI === 'mac' ? t('voce.parakeet-mac') : MOTORE_TESTI === 'onnx' ? t('voce.parakeet-processore') : 'Whisper ' + (MODELLO_VOCE.endsWith('small') ? 'small' : 'base');
const sulProcessore = () => { CPU = true; MODELLO_VOCE = BASE; if (MOTORE_TESTI === 'whisper') PESO_VOCE = '200'; };
const rete = e => /fetch|network|locate/i.test(e?.message) || !navigator.onLine;
function preparaWhisper() {
  if (asr) return Promise.resolve(asr);
  caricando ||= (async () => {
    staCaricando++;
    // WebGPU solo con una scheda vera: su Windows navigator.gpu c'è anche senza (VM, driver in lista nera)
    const ad = CPU ? null : await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null);
    if (!ad || (ad.info?.isFallbackAdapter ?? ad.isFallbackAdapter)) sulProcessore();
    try { asr = await carica(CPU ? 'wasm' : 'webgpu'); }
    catch (e) {   // la scheda c'è ma WebGPU non parte (driver, shader): si riprova sul processore
      if (CPU || rete(e)) throw e;
      T = await import(TJS + '?cpu');   // un transformers.js nuovo (un altro indirizzo, sempre lo stesso file): quello di prima si ricorda l'errore di WebGPU
      asr = await carica('wasm'); sulProcessore();
    }
    partita = true; avvisa({ fase: 'pronta' });
    return asr;
  })().catch(e => { caricando = null; console.warn(e); avvisa({ fase: 'errore', testo: rete(e) ? t('voce.non-scarica') : t('voce.non-parte') }); throw e; }).finally(() => staCaricando--);
  return caricando;
}
async function carica(dev) {
  T ||= await import(TJS);
  T.env.backends.onnx.wasm.wasmPaths = libreria('onnx');   // i .wasm di onnxruntime accanto a transformers.js, non dal CDN
  const file = {}, a = await T.pipeline('automatic-speech-recognition', dev === 'wasm' ? BASE : MODELLO_VOCE, {
    device: dev, dtype: dev === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: p => { if (p.status === 'progress' && p.total && !partita) { file[p.file] = [p.loaded, p.total]; const v = Object.values(file); avvisa({ fase: 'scarico', p: v.reduce((s, x) => s + x[0], 0) / v.reduce((s, x) => s + x[1], 0) }); } },
  });
  // un giro a vuoto: la prima trascrizione vera non paga la compilazione degli shader (e se la scheda non regge, si vede qui)
  await a(new Float32Array(16000), { language: WHISPER[lingua], task: 'transcribe' });
  return a;
}
// una trascrizione alla volta (il modello è uno solo), in fila; «Ripeti» passa davanti ai pezzi della lezione
// ({ subito: true }): lo studente sta aspettando, la trascrizione della lezione può aspettare due secondi.
// Se c'è, il motore è Parakeet (nel main: lode-voce sul Mac, ONNX altrove): più preciso e più veloce di Whisper.
const fila = []; let lavora = false;
export function trascriviAudio(audio, { subito = false } = {}) {
  usata = Date.now();
  return new Promise((ok, ko) => { const x = { audio, ok, ko }; subito ? fila.unshift(x) : fila.push(x); gira(); });
}
async function gira() {
  if (lavora) return; lavora = true;
  while (fila.length) {
    const { audio, ok, ko } = fila.shift();
    try { const t = await unaVolta(audio); ok(ALLUCINAZIONI.test(t) ? '' : t); } catch (e) { ko(e); }
  }
  lavora = false; usata = Date.now();
}
const unaVolta = async audio => (await motoreNelMain())
  ? conRipiego(audio, { nativo: a => preparaNativo().then(() => parakeet(a)), whisper: a => preparaWhisper().then(() => trascrivi(a)), ripiega })
  : prepara().then(() => trascrivi(audio));
// Parakeet nel main che non va (il main dice ripiego): lo stesso audio passa a Whisper, così la frase o il pezzo di
// lezione in corso non si perde. Gli altri errori (la rete che manca durante il download) restano errori
export async function conRipiego(audio, { nativo, whisper, ripiega }) {
  try { return await nativo(audio); }
  catch (e) { if (!e?.ripiego) throw e; ripiega(e); return whisper(audio); }
}
// da qui in poi Whisper, per tutta la sessione: i testi cambiano e la barra lo dice una volta, in chiaro
function ripiega(e) {
  if (MOTORE === RIPIEGATO) return;
  MOTORE = RIPIEGATO; NATIVO_PRONTO = false; caricaNativo = null; testiVoce('whisper');
  console.warn('Lode: Parakeet non parte, passo a Whisper:', e?.message);
  avvisa({ fase: 'ripiego', p: 0, testo: t('voce.ripiego', { motivo: String(e?.message || '').slice(0, 160) }) });
}
// A riposo la voce esce dalla memoria: fuori dalla lezione (orecchio spento), dopo 10 minuti senza usarla. Whisper su WebGPU
// tiene circa 1 GB tra barra e scheda, Parakeet un processo a parte: su un portatile da 8 GB, tutto il giorno, pesa.
// Torna da sola alla prima frase, dal disco (un paio di secondi, niente da riscaricare). In aula resta sempre pronta.
const RIPOSO = 10 * 60e3; let usata = Date.now(), inAula = false;
addEventListener('lode:orecchio', e => { inAula = !!e.detail?.acceso; usata = Date.now(); });
setInterval(() => {
  if (inAula || lavora || fila.length || rec || staCaricando || Date.now() - usata < RIPOSO) return;
  if (asr) { const a = asr; asr = caricando = null; Promise.resolve(a.dispose?.()).catch(() => { }); }
  if (NATIVO_PRONTO) { NATIVO_PRONTO = false; caricaNativo = null; window.lodeDesktop?.invoca('voce:riposa').catch(() => { }); }
}, 60e3)?.unref?.();
// Whisper legge 30 secondi alla volta: oltre, l'audio va diviso in finestre sovrapposte (senza, di un minuto di
// «Ripeti» arrivava solo la prima metà, la più vecchia, e mancava proprio l'ultima frase del prof)
const trascrivi = async audio => (await asr(audio, { language: WHISPER[lingua], task: 'transcribe', ...(audio.length > 16000 * 29 ? { chunk_length_s: 30, stride_length_s: 5 } : {}) }))
  .text.trim().replace(/^[\s.…]+|[\s.…]+$/g, '').replace(/\s*\[.*?\]\s*/g, ' ').trim();
// Il motore: 'mac' (Parakeet sul Neural Engine, lode-voce), 'onnx' (Parakeet sul processore, sherpa-onnx), tutti e due
// nel main, oppure 'whisper' nella barra. Lo chiede una volta sola al main, all'avvio della barra
let MOTORE = null; const RIPIEGATO = Promise.resolve('whisper');
export const motore = () => (MOTORE ??= DESKTOP ? window.lodeDesktop.invoca('voce:stato').then(s => { const m = s?.motore || (s?.parakeet ? 'mac' : 'whisper'); testiVoce(m, s?.peso); return m; }).catch(() => 'whisper') : Promise.resolve('whisper'));
export const motoreNelMain = async () => (await motore()) !== 'whisper';
if (DESKTOP) motore();
export const nomeMotore = async () => ({ mac: 'Parakeet v3 (Neural Engine)', onnx: 'Parakeet v3 (ONNX, processore)' })[await motore()] || 'Whisper ' + MODELLO_VOCE.split('-').pop();
const parakeet = async audio => String(risposta(await window.lodeDesktop.invoca('voce:trascrivi', audio))).replace(/\s+/g, ' ').trim();
// Whisper sul silenzio a volte «sente» frasi tipiche dei sottotitoli (le ha imparate dai video): le scartiamo, in tutte le
// lingue (lo studente può parlare inglese con la barra in italiano). L'italiano è quello di sempre, le altre sono in più
export const ALLUCINAZIONI = new RegExp('^(?:' + [
  /sottotitoli|grazie (?:a tutti )?per (?:la visione|l'attenzione)|grazie\.?|buona visione|amara\.org|iscriviti/,
  /thank you(?: (?:so|very) much)?(?: for watching)?[.!]?$|thanks for watching|(?:please )?subscribe(?: to (?:my|the|our) channel)?|subtitles? by|captions? by|you$|bye[.!]?$/,
  /subt[ií]tulos (?:realizados )?por|gracias por ver|gracias[.!]?$|suscr[ií]bete/,
  /sous-titr(?:es|age)(?: r[ée]alis[ée]s)? (?:par|st)|merci d'avoir regard[ée]|merci[.!]?$|abonnez-vous/,
  /untertitel(?:ung)?(?: im auftrag| des zdf| der amara| von)|vielen dank(?: f[üu]rs zuschauen)?[.!]?$|danke(?: f[üu]rs zuschauen)?[.!]?$|abonniert/,
  /legendas? (?:pela comunidade|por)|obrigad[oa](?: por assistir)?[.!]?$|inscreva-se/,
].map(r => r.source).join('|') + ')', 'i');

function ascoltaWhisper({ parziale, fine, errore, auto = true }) {
  const stato = { fermo: false, annullato: false };
  rec = stato;
  (async () => {
    let flusso;
    try { flusso = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { rec = null; return errore?.(erroreMicrofono(e)); }
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
    }, MODELLO_VOCE.endsWith('small') || CPU ? 2000 : 1200);
    async function chiudi() {
      if (stato.chiuso) return; stato.chiuso = stato.fermo = true;
      clearInterval(giro); proc.disconnect(); sorgente.disconnect(); flusso.getTracks().forEach(t => t.stop()); ctx.close();
      rec = null; livello = 0;
      if (stato.annullato) return;
      window.__lodeAudio = { n: campioni, sr: ctx.sampleRate, dati: tutto() };   // per le prove
      if (!parlato) return fine?.('');
      try { while (occupato) await new Promise(r => setTimeout(r, 30)); fine?.(await trascriviAudio(tutto(), { subito: true })); }
      catch (e) { errore?.(t('voce.non-ha-funzionato-perche', { motivo: e.message })); }
    }
    stato.chiudi = chiudi;
    if (stato.fermo) chiudi();
  })();
  prepara().catch(() => { });
  return stato;
}

// il microfono che non si apre: cosa fare, detto per il sistema giusto (su Windows c'è un interruttore per le app desktop)
export function erroreMicrofono(e) {
  const win = window.lodeDesktop?.piattaforma === 'win32';
  if (/NotFound|Overconstrained/.test(e?.name)) return win ? t('voce.nessun-microfono-win') : t('voce.nessun-microfono');
  if (win) return t('voce.microfono-chiuso-win');
  return t('voce.permesso-microfono-mac');
}

/* ---------- riconoscimento del browser ---------- */
function ascoltaBrowser({ parziale, fine, errore }) {
  if (!SR) { errore?.(t('voce.browser-senza-voce')); return null; }
  let finale = '';
  const r = new SR(); r.lang = PAESE_VOCE[lingua]; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
  r.onresult = e => {
    let prov = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) finale += x[0].transcript; else prov += x[0].transcript; }
    livello = Math.min(1, .35 + Math.random() * .65);
    parziale?.((finale + prov).trim());
  };
  r.onerror = e => { if (e.error !== 'aborted' && e.error !== 'no-speech') errore?.(e.error === 'not-allowed' ? t('voce.serve-permesso') : t('voce.non-ha-funzionato')); };
  r.onend = () => { const era = rec; rec = null; if (era?._annullato) return; fine?.(finale.trim()); };
  try { r.start(); } catch { }
  return r;
}

export function ascolta(opz) { ferma(true); usata = Date.now(); rec = DESKTOP ? ascoltaWhisper(opz) : ascoltaBrowser(opz); return rec; }
export function ferma(annulla = false) {
  if (!rec) return;
  if (DESKTOP) { rec.annullato = annulla; rec.fermo = true; rec.chiudi?.(); if (annulla) rec = null; return; }
  rec._annullato = annulla; try { rec.stop(); } catch { }
}
export const attivo = () => !!rec;
export function livelloVoce() { if (!DESKTOP) livello *= .92; return livello; }

/* ---------- lettura ad alta voce ---------- */
let voce = null;
// la voce del sistema nella lingua della barra: prima quelle buone (premium, naturali), in italiano le voci di sempre,
// poi quella del paese giusto (pt-BR prima di pt-PT), poi una qualsiasi della lingua
function scegli() {
  const v = speechSynthesis.getVoices().filter(x => x.lang?.toLowerCase().startsWith(lingua)), paese = PAESE_VOCE[lingua].toLowerCase();
  voce = v.find(x => /premium|enhanced|natural|neural/i.test(x.name)) || (lingua === 'it' && v.find(x => /alice|federica|elsa|isabella/i.test(x.name))) || v.find(x => x.lang?.toLowerCase().replace('_', '-') === paese) || v[0] || null;
}
if ('speechSynthesis' in window) { scegli(); speechSynthesis.onvoiceschanged = scegli; }
export function leggi(testo) {
  if (!('speechSynthesis' in window) || !testo) return;
  const u = new SpeechSynthesisUtterance(String(testo).replace(/\*\*/g, '')); u.lang = PAESE_VOCE[lingua]; if (voce) u.voice = voce; u.rate = 1.04;
  speechSynthesis.speak(u);
}
export function zitto() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }
