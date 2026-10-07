// Trascrivere una lezione intera, in diretta, dentro la nota Obsidian della lezione.
// Il microfono ascolta; ogni 20-30 secondi (tagliando in una pausa del prof) il pezzo passa a Whisper, le formule dette
// a voce diventano LaTeX (formule.js) e la riga si aggiunge SUBITO alla sezione «Trascrizione» della nota:
// se il computer si spegne a metà, quello che c'era è già salvato. L'audio non viene mai scritto su disco.
// Alla fine «Riordina» (modello locale o Claude) trasforma la trascrizione in appunti puliti, definizioni e ★.
import * as Voce from './voce.js';
import { parlatoInFormule } from './formule.js';
import * as V from './vault.js';
import * as O from './orecchio.js';
import * as C from './computer.js';
import { t } from './lingua.js';

let R = null;
let sospese = [], scrivendo = null, tRiprova = 0;   // righe trascritte che non sono ancora entrate nella nota
const avvisa = () => dispatchEvent(new CustomEvent('lode:trascrizione', { detail: stato() }));
export const attiva = () => !!R;
export const occupata = () => !!R?.lavora;
export const stato = () => R ? { sorgente: R.sorgente, lezione: R.lezione, inizio: R.inizio, parole: R.parole, righe: R.righe, ultima: R.ultima, inPausa: R.inPausa, coda: R.coda.length, sospese: sospese.length, minuti: Math.round((Date.now() - R.inizio - R.pausaTot) / 60000) } : null;
const ora = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const attendi = ms => new Promise(r => setTimeout(r, ms));

// la nota a volte è occupata (su Windows OneDrive, l'antivirus o Obsidian la tengono aperta): si riprova un attimo
const riprova = async (fn, volte = 4) => { for (let i = 1; ; i++) { try { return await fn(); } catch (e) { if (i >= volte) throw e; await attendi(400 * i); } } };
// scrive in ordine le righe in attesa; se proprio non va restano in memoria e si riprova fra poco: nessuna riga si perde
async function svuota() {
  clearTimeout(tRiprova);
  // a gruppi per lezione: una nota che non si scrive (bloccata) non ferma quelle delle altre lezioni
  const lezioni = [...new Set(sospese.map(x => x.lezione))]; let fallite = 0, errore = null;
  for (const l of lezioni) {
    const righe = sospese.filter(x => x.lezione === l);
    try { await riprova(() => V.annota('trascrizione', righe.map(x => x.riga).join('\n'), { lezione: l, grezza: true })); sospese = sospese.filter(x => !righe.includes(x)); }
    catch (e) { fallite++; errore = e; }
  }
  if (!fallite) return true;
  console.warn('Lode: righe non ancora salvate, riprovo fra poco', errore); tRiprova = setTimeout(scrivi, 15000); avvisa(); return false;
}
async function scrivi() { if (scrivendo) return scrivendo; scrivendo = svuota(); try { return await scrivendo; } finally { scrivendo = null; } }

// i pezzi si trascrivono uno alla volta, in ordine, mentre la lezione continua
async function lavora() {
  if (!R || R.lavora) return; R.lavora = true;
  while (R && R.coda.length) {
    const { audio, quando } = R.coda[0];
    try {
      const testo = await Voce.trascriviAudio(audio);
      if (testo && R) {
        const riga = `**${ora(quando)}** ${parlatoInFormule(testo)}`;
        sospese.push({ lezione: R.lezione, riga });
        R.parole += testo.split(/\s+/).length; R.righe++; R.ultima = riga;
      }
    } catch (e) { console.warn('Lode: pezzo non trascritto', e); }
    if (sospese.length) await scrivi();
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

// sorgente: 'microfono' (in aula) o 'computer' (l'audio che esce dal computer: videolezioni, js/computer.js)
export async function avvia(lezione, { audioProva, sorgente = 'microfono' } = {}) {
  if (R) return stato();
  await Voce.prepara();
  // l'audio del computer si chiede subito: se il sistema dice di no, non si scrive niente nella nota
  if (sorgente === 'computer' && !audioProva) await C.accendi();
  R = { lezione, inizio: Date.now(), parole: 0, righe: 0, ultima: '', coda: [], inPausa: false, pausaTot: 0, pausaDa: 0, sorgente };
  const seg = segmentatore((audio, quando) => { R?.coda.push({ audio, quando }); lavora(); avvisa(); });
  R.seg = seg;
  await scrivi();   // prima le righe rimaste indietro dalla volta scorsa
  // se la nota non si scrive nemmeno adesso, meglio dirlo subito, prima che il prof cominci
  try { await riprova(() => V.annota('trascrizione', `%% ${t(sorgente === 'computer' ? 'trascrizione.inizio-computer' : 'trascrizione.inizio', { ora: ora(new Date()) })} %%`, { lezione, grezza: true })); } catch (e) { R = null; if (sorgente === 'computer') C.spegni(); throw e; }
  if (audioProva) {   // prove: l'audio arriva da un file invece che dal microfono, più veloce del tempo reale
    for (let i = 0; i < audioProva.length && R; i += 2048) { seg.aggiungi(audioProva.subarray(i, i + 2048)); if (i % (2048 * 64) === 0) await new Promise(r => setTimeout(r, 0)); }
    avvisa(); return stato();
  }
  if (sorgente === 'computer') { const via = C.ascolta(x => { if (R && !R.inPausa) R.seg.aggiungi(x); }); R.spegni = () => { via(); C.spegni(); }; avvisa(); return stato(); }
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
  while (R.coda.length || R.lavora) await attendi(200);
  const fatto = { ...stato(), minuti: Math.max(1, Math.round((Date.now() - R.inizio - R.pausaTot) / 60000)) };
  sospese.push({ lezione: R.lezione, riga: `%% ${t('trascrizione.fine', { ora: ora(new Date()), n: fatto.parole })} %%` });
  await scrivi(); fatto.sospese = sospese.length;   // se restano righe in attesa, si riprova da sole
  R = null; avvisa();
  return fatto;
}
