// Trascrivere una lezione intera, in diretta, dentro la nota Obsidian della lezione.
// Il microfono ascolta; ogni 20-30 secondi (tagliando in una pausa del prof) il pezzo passa a Whisper, le formule dette
// a voce diventano LaTeX (formule.js) e la riga si aggiunge SUBITO alla sezione «Trascrizione» della nota:
// se il computer si spegne a metà, quello che c'era è già salvato. L'audio non viene mai scritto su disco.
// Alla fine «Riordina» (modello locale o Claude) trasforma la trascrizione in appunti puliti, definizioni e ★.
import * as Voce from './voce.js';
import { parlatoInFormule } from './formule.js';
import * as V from './vault.js';
import * as O from './orecchio.js';

let R = null;
const avvisa = () => dispatchEvent(new CustomEvent('lode:trascrizione', { detail: stato() }));
export const attiva = () => !!R;
export const occupata = () => !!R?.lavora;
export const stato = () => R ? { lezione: R.lezione, inizio: R.inizio, parole: R.parole, righe: R.righe, ultima: R.ultima, inPausa: R.inPausa, coda: R.coda.length, minuti: Math.round((Date.now() - R.inizio - R.pausaTot) / 60000) } : null;
const ora = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// i pezzi si trascrivono uno alla volta, in ordine, mentre la lezione continua
async function lavora() {
  if (!R || R.lavora) return; R.lavora = true;
  while (R && R.coda.length) {
    const { audio, quando } = R.coda[0];
    try {
      const testo = await Voce.trascriviAudio(audio);
      if (testo && R) {
        const riga = `**${ora(quando)}** ${parlatoInFormule(testo)}`;
        await V.annota('trascrizione', riga, { lezione: R.lezione, grezza: true });
        R.parole += testo.split(/\s+/).length; R.righe++; R.ultima = riga;
      }
    } catch (e) { console.warn('Lode: pezzo non trascritto', e); }
    R?.coda.shift(); avvisa();
  }
  if (R) R.lavora = false;
}

// taglia l'audio in pezzi da 20-30 s in un momento di silenzio (soglia adattiva al rumore dell'aula)
function segmentatore(onPezzo) {
  let buf = [], n = 0, rumore = .006, voce = 0, silenzio = 0, t0 = Date.now();
  const chiudi = () => {
    if (n < 16000 * 1.5 || voce < .6) { buf = []; n = 0; voce = 0; t0 = Date.now(); return; }   // pezzo senza parlato: si butta
    const a = new Float32Array(n); let o = 0; for (const p of buf) { a.set(p, o); o += p.length; }
    onPezzo(a, new Date(t0)); buf = []; n = 0; voce = 0; t0 = Date.now();
  };
  return {
    aggiungi(x) {
      buf.push(x); n += x.length;
      let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i];
      const rms = Math.sqrt(s / x.length), dt = x.length / 16000;
      if (rms > Math.max(.01, rumore * 2.2 + .005)) { voce += dt; silenzio = 0; } else { silenzio += dt; rumore = rumore * .97 + rms * .03; }
      const sec = n / 16000;
      if ((sec >= 20 && silenzio >= .3) || sec >= 29 || (sec >= 4 && silenzio >= 2.5)) chiudi();
    },
    fine: chiudi,
  };
}

export async function avvia(lezione, { audioProva } = {}) {
  if (R) return stato();
  await Voce.prepara();
  R = { lezione, inizio: Date.now(), parole: 0, righe: 0, ultima: '', coda: [], inPausa: false, pausaTot: 0, pausaDa: 0 };
  const seg = segmentatore((audio, quando) => { R?.coda.push({ audio, quando }); lavora(); avvisa(); });
  R.seg = seg;
  await V.annota('trascrizione', `%% Trascrizione automatica di Lode, iniziata alle ${ora(new Date())}. Le formule dette a voce sono in LaTeX. %%`, { lezione, grezza: true });
  if (audioProva) {   // prove: l'audio arriva da un file invece che dal microfono, più veloce del tempo reale
    for (let i = 0; i < audioProva.length && R; i += 2048) { seg.aggiungi(audioProva.subarray(i, i + 2048)); if (i % (2048 * 64) === 0) await new Promise(r => setTimeout(r, 0)); }
    avvisa(); return stato();
  }
  // il microfono è quello condiviso (orecchio.js): resta acceso anche per «Ripeti», se l'hai attivato
  await O.accendi();
  R.spegni = O.ascolta(x => { if (R && !R.inPausa) R.seg.aggiungi(x); });
  avvisa(); return stato();
}
export function pausa() { if (!R || R.inPausa) return; R.inPausa = true; R.pausaDa = Date.now(); R.seg.fine(); avvisa(); }
export function riprendi() { if (!R || !R.inPausa) return; R.inPausa = false; R.pausaTot += Date.now() - R.pausaDa; avvisa(); }
// fine: l'ultimo pezzo si trascrive, poi si chiude (la nota è già tutta salvata)
export async function ferma() {
  if (!R) return null;
  R.spegni?.(); R.seg.fine(); R.inPausa = true;
  while (R.coda.length || R.lavora) await new Promise(r => setTimeout(r, 200));
  const fatto = { ...stato(), minuti: Math.max(1, Math.round((Date.now() - R.inizio - R.pausaTot) / 60000)) };
  await V.annota('trascrizione', `%% Fine della trascrizione alle ${ora(new Date())}: ${fatto.parole} parole. %%`, { lezione: R.lezione, grezza: true });
  R = null; avvisa();
  return fatto;
}
