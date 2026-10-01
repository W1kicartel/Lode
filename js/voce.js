// La voce, gratis e senza chiavi: riconoscimento del parlato del browser (Chrome, Edge, Safari) in italiano.
// Tieni premuto ⌥ Spazio (Ctrl ⇧ Spazio su Windows/Linux) o premi il microfono. Le parole compaiono mentre parli.
// Le risposte possono essere lette ad alta voce (Impostazioni), con la voce italiana del sistema.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const disponibile = !!SR;
let rec = null, finale = '', livello = 0;
export function ascolta({ parziale, fine, errore }) {
  // nell'app desktop il riconoscimento del browser non c'è (usa i server di Google): arriverà Whisper in locale
  if (window.lodeDesktop) { errore?.('Nell\'app la voce arriva con la trascrizione in locale (Whisper), nel prossimo aggiornamento. Intanto scrivi qui.'); return null; }
  if (!SR) { errore?.('Il riconoscimento vocale non c\'è in questo browser: prova Chrome o Edge.'); return null; }
  ferma(true);
  finale = '';
  rec = new SR(); rec.lang = 'it-IT'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
  rec.onresult = e => {
    let prov = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finale += r[0].transcript; else prov += r[0].transcript; }
    livello = Math.min(1, .35 + Math.random() * .65);
    parziale?.((finale + prov).trim());
  };
  rec.onerror = e => { if (e.error !== 'aborted' && e.error !== 'no-speech') errore?.(e.error === 'not-allowed' ? 'Serve il permesso del microfono.' : 'La voce non ha funzionato: riprova.'); };
  rec.onend = () => { const t = finale.trim(); const era = rec; rec = null; if (era?._annullato) return; fine?.(t); };
  try { rec.start(); } catch { }
  return rec;
}
export function ferma(annulla = false) { if (!rec) return; rec._annullato = annulla; try { rec.stop(); } catch { } }
export const attivo = () => !!rec;
export function livelloVoce() { livello *= .92; return livello; }

// lettura ad alta voce: la voce italiana più naturale che il sistema ha
let voce = null;
function scegli() { const v = speechSynthesis.getVoices().filter(x => x.lang?.startsWith('it')); voce = v.find(x => /premium|enhanced|natural|neural/i.test(x.name)) || v.find(x => /alice|federica|elsa|isabella/i.test(x.name)) || v[0] || null; }
if ('speechSynthesis' in window) { scegli(); speechSynthesis.onvoiceschanged = scegli; }
export function leggi(testo) {
  if (!('speechSynthesis' in window) || !testo) return;
  const u = new SpeechSynthesisUtterance(String(testo).replace(/\*\*/g, '')); u.lang = 'it-IT'; if (voce) u.voice = voce; u.rate = 1.04;
  speechSynthesis.speak(u);
}
export function zitto() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }
