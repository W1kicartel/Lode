// L'allenatore: in momenti a caso della giornata, quando sei al computer e libero, la pillola ti propone una cosa
// piccola e utile per il prossimo esame: due minuti di gioco sulle definizioni, le carte di oggi, le ★ da esame,
// tre domande lampo come all'orale, un focus quando sei indietro col piano.
// Più l'esame è vicino, più spesso. Mai a lezione, durante un focus o una trascrizione, né nelle ore di silenzio.
// Impara: le proposte che accetti tornano più spesso, quelle che rimandi o ignori meno.
import { D, salva, prossimi, daGiocare, daRipassare, lezioneOra, prossimaLezione, lezioni, piano, giorniTra, oggi, norm, num } from './dati.js';
import * as F from './focus.js';
import * as TR from './trascrizione.js';
import * as AI from './ai.js';

const L = typeof window !== 'undefined' ? window.lodeDesktop : null;
const OGNI = { poco: 180, normale: 90, spesso: 40 }, MASSIMO = { poco: 3, normale: 6, spesso: 12 };
const mem = () => (D.allenatore ||= { storia: [], ultima: 0, rimandaFino: 0 });
let ultimoMovimento = Date.now();
if (typeof addEventListener === 'function') addEventListener('pointermove', () => { ultimoMovimento = Date.now(); }, { passive: true });

const urgenza = g => g <= 3 ? 3 : g <= 7 ? 2.2 : g <= 14 ? 1.6 : g <= 30 ? 1.2 : .8;
const minuti = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
function inSilenzio(d = new Date()) {
  const s = D.imp.silenzio || { da: '23:00', a: '08:00' }, m = d.getHours() * 60 + d.getMinutes(), a = minuti(s.da), b = minuti(s.a);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}
const fascia = (d = new Date()) => { const h = d.getHours(); return h < 6 ? 'notte' : h < 13 ? 'mattina' : h < 19 ? 'pomeriggio' : h < 24 ? 'sera' : 'notte'; };
// quanto lo studente accetta ogni tipo di proposta (impara dalle ultime 60)
function gradimento(tipo) {
  const st = mem().storia.slice(-60).filter(x => x.tipo === tipo);
  const si = st.filter(x => x.esito === 'accettata').length, no = st.filter(x => x.esito !== 'accettata').length;
  return Math.max(.15, Math.min(2, (si + 1) / (si + no + 2) * 2));
}

export function candidati() {
  const out = [], esami = prossimi().filter(e => giorniTra(oggi(), e.data) <= 60).slice(0, 3);
  for (const e of esami) {
    const g = giorniTra(oggi(), e.data), u = urgenza(g), quando = g === 0 ? 'oggi' : g === 1 ? 'domani' : `tra ${g} giorni`;
    const defs = daGiocare(6, e.nome).scelte, carte = daRipassare(e.id), stelle = lezioni().filter(l => norm(l.corso) === norm(e.nome)).flatMap(l => l.stelle || []);
    if (defs.length >= 3) out.push({ tipo: 'gioco', esame: e, titolo: `${e.nome} · ${quando}`, testo: `2 minuti su ${defs.length} definizioni?`, bottone: 'Gioca', peso: 1 * u });
    if (carte.length >= 3) out.push({ tipo: 'ripasso', esame: e, titolo: `${e.nome} · ${quando}`, testo: `${carte.length} carte da ripassare, circa ${Math.max(2, Math.round(carte.length * .4))} minuti`, bottone: 'Ripassa', peso: .9 * u });
    if (stelle.length >= 2) out.push({ tipo: 'stelle', esame: e, titolo: `${e.nome} · ${quando}`, testo: `Rileggi le ${Math.min(stelle.length, 8)} cose che il prof ha detto «da esame»`, bottone: 'Rileggi', peso: .7 * u, stelle: stelle.slice(-8) });
    if (AI.attiva() && g <= 21) out.push({ tipo: 'orale', esame: e, titolo: `${e.nome} · ${quando}`, testo: 'Tre domande lampo, come all\'orale?', bottone: 'Interrogami', peso: .8 * u * (g <= 7 ? 1.5 : 1) });
    const p = piano(e);
    if (p.oggi >= .75 && fascia() === (D.imp.momento || 'pomeriggio')) out.push({ tipo: 'focus', esame: e, titolo: `${e.nome} · ${quando}`, testo: `Oggi ti mancano ${num(p.oggi)} h per stare in pari: un focus da ${D.imp.focus || 25}?`, bottone: 'Focus', peso: .6 * u });
  }
  if (!esami.length) {   // nessun esame vicino: si ripassa l'ultima lezione
    const s = daGiocare(6).scelte;
    if (s.length >= 3) out.push({ tipo: 'gioco', esame: null, corso: s[0].corso, titolo: `${s[0].corso} · ultima lezione`, testo: `2 minuti su ${s.length} definizioni?`, bottone: 'Gioca', peso: .6 });
  }
  const ultimoTipo = mem().storia.at(-1)?.tipo;
  for (const c of out) { c.peso *= gradimento(c.tipo); if (c.tipo === ultimoTipo) c.peso *= .5; }
  return out.filter(c => c.peso > 0);
}

// è il momento giusto? (al computer, libero, non in silenzio, abbastanza tempo dall'ultima, un po' a caso)
export async function momento({ forza = false } = {}) {
  const liv = D.imp.allenatore || 'normale';
  if (liv === 'mai' && !forza) return { no: 'proposte spente' };
  if (!forza) {
    if (inSilenzio()) return { no: 'ore di silenzio' };
    if (lezioneOra() || (prossimaLezione()?.tra ?? 99) < 15) return { no: 'lezione' };
    if (F.stato() || TR.attiva()) return { no: 'occupato' };
    const m = mem(), adesso = Date.now();
    if (adesso < (m.rimandaFino || 0)) return { no: 'rimandata' };
    const oggiN = m.storia.filter(x => x.giorno === oggi()).length;
    if (oggiN >= MASSIMO[liv]) return { no: 'basta per oggi' };
    const esame = prossimi()[0], g = esame ? giorniTra(oggi(), esame.data) : 99;
    const intervallo = OGNI[liv] / (g <= 3 ? 2 : g <= 10 ? 1.4 : 1);
    if (adesso - (m.ultima || 0) < intervallo * 60e3) return { no: 'troppo presto' };
    // al computer? (inattività del sistema nell'app, movimento del mouse nel browser)
    const fermo = L ? await L.invoca('sistema:inattivo').catch(() => 999) : (Date.now() - ultimoMovimento) / 1000;
    if (fermo > 120) return { no: 'non sei al computer' };
    if (Math.random() > .35) return { no: 'non ancora (a caso)' };
  }
  const c = candidati(); if (!c.length) return { no: 'niente da proporre' };
  let r = Math.random() * c.reduce((s, x) => s + x.peso, 0);
  return { proposta: c.find(x => (r -= x.peso) <= 0) || c[0] };
}
export function registra(p, esito) {
  const m = mem(); m.ultima = Date.now();
  if (esito === 'rimandata') m.rimandaFino = Date.now() + 60 * 60e3;
  m.storia = [...m.storia, { tipo: p.tipo, esame: p.esame?.nome || p.corso || null, esito, giorno: oggi(), ora: new Date().getHours() }].slice(-200);
  salva();
}
// per la Memoria: quanto funzionano le proposte
export function riepilogo() {
  const st = mem().storia, per = {};
  for (const x of st) { per[x.tipo] ||= { si: 0, tot: 0 }; per[x.tipo].tot++; if (x.esito === 'accettata') per[x.tipo].si++; }
  return per;
}
