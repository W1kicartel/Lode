// Il quiz a crocette: domande con quattro risposte, una giusta, come allo scritto (e come all'esame delle università
// telematiche: di solito 30 domande in 30 minuti). Due modi: allenamento (la correzione subito, con la spiegazione) e
// simulazione d'esame (il tempo che scorre, la correzione alla fine, il voto in trentesimi).
// Le domande vengono da due parti:
// - senza AI, dalle carte e dalle definizioni dello studente: le risposte sbagliate sono le risposte di altre carte (o altre
//   definizioni) dello stesso corso, quindi plausibili;
// - con l'AI, dalla dispensa o dal materiale: il modello deve copiare la frase che dimostra la risposta giusta, e la
//   domanda resta solo se quella frase c'è davvero nel materiale. L'ordine delle risposte lo decide il codice.
import { norm } from './dati.js';
import { t } from './lingua.js';

export const mescola = (a, caso = Math.random) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(caso() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const corto = (s, n = 160) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
// tre risposte sbagliate da un insieme: diverse dalla giusta e fra loro, prima quelle di lunghezza simile (una risposta
// lunghissima fra tre corte si indovina senza aver studiato)
function distrattori(giusta, insieme, caso) {
  const g = norm(giusta), visti = new Set([g]), lung = String(giusta).length;
  const candidati = mescola(insieme, caso).filter(x => { const k = norm(x); if (!k || visti.has(k)) return false; visti.add(k); return true; });
  return candidati.sort((a, b) => Math.abs(a.length - lung) - Math.abs(b.length - lung)).slice(0, 3);
}
// una domanda pronta: le quattro risposte mescolate e l'indice della giusta
export function componi({ domanda, giusta, sbagliate, spiegazione = '', fonte = '' }, caso = Math.random) {
  const opzioni = mescola([giusta, ...sbagliate].map(x => corto(x)), caso);
  return { domanda: corto(domanda, 400), opzioni, giusta: opzioni.indexOf(corto(giusta)), spiegazione: corto(spiegazione, 300), fonte };
}

/* ---------- senza AI: dalle carte e dalle definizioni ---------- */
// mat: { carte: [{fronte, retro}], definizioni: [{t, testo}] } (vedi materialeDi in js/programma.js)
export function daMateriale(mat, { n = 10, caso = Math.random } = {}) {
  const out = [];
  const carte = (mat.carte || []).filter(c => c.fronte?.trim() && c.retro?.trim());
  if (carte.length >= 4) for (const c of carte) {
    const sb = distrattori(c.retro, carte.filter(x => x !== c).map(x => x.retro), caso);
    if (sb.length === 3) out.push(componi({ domanda: c.fronte, giusta: c.retro, sbagliate: sb, fonte: 'carta' }, caso));
  }
  const defs = (mat.definizioni || []).map(d => ({ t: d.t, d: String(d.testo || '').replace(/^[^:]+:\s*/, '') })).filter(d => d.t && d.d);
  if (defs.length >= 4) for (const [i, d] of defs.entries()) {
    // a giro: «che cos'è X?» (quattro definizioni) e «a cosa corrisponde questa definizione?» (quattro termini)
    if (i % 2 === 0) { const sb = distrattori(d.d, defs.filter(x => x !== d).map(x => x.d), caso); if (sb.length === 3) out.push(componi({ domanda: t('crocette.che-cos-e', { t: d.t }), giusta: d.d, sbagliate: sb, fonte: 'definizione' }, caso)); }
    else { const sb = distrattori(d.t, defs.filter(x => x !== d).map(x => x.t), caso); if (sb.length === 3) out.push(componi({ domanda: t('crocette.a-cosa-corrisponde', { d: d.d }), giusta: d.t, sbagliate: sb, fonte: 'definizione' }, caso)); }
  }
  // niente due domande uguali; poi un po' di carte e un po' di definizioni
  const visti = new Set();
  return mescola(out, caso).filter(q => { const k = norm(q.domanda); if (visti.has(k)) return false; visti.add(k); return true; }).slice(0, n);
}

/* ---------- con l'AI: si tiene solo quello che il materiale dimostra ---------- */
const parole = s => norm(s).split(' ').filter(Boolean);
// la citazione c'è nel materiale? almeno 6 parole di fila (o tutta, se è più corta), ignorando maiuscole, accenti e punteggiatura
export function citazioneNelMateriale(cit, materiale) {
  const c = parole(cit), m = ' ' + parole(materiale).join(' ') + ' ', k = Math.min(6, c.length);
  if (c.length < 4) return false;
  for (let i = 0; i + k <= c.length; i++) if (m.includes(' ' + c.slice(i, i + k).join(' ') + ' ')) return true;
  return false;
}
// «tutte le precedenti», «nessuna delle precedenti» nelle sei lingue (il quiz può essere scritto in un'altra lingua)
const PRECEDENTI = new RegExp([
  /\b(tutte|nessuna) (le|delle) (precedenti|altre|risposte)\b/,
  /\b(?:all|none|both|neither) of (?:the )?(?:above|previous|other (?:answers|options))\b/,
  /\b(?:todas|ninguna) (?:las|de las) (?:anteriores|otras|respuestas)\b/,
  /\b(?:toutes|aucune) (?:les|des) (?:r[ée]ponses|propositions) (?:pr[ée]c[ée]dentes|ci-dessus)\b|\btoutes les r[ée]ponses\b|\baucune des r[ée]ponses\b/,
  /\b(?:alle|keine) (?:der )?(?:oben genannten|vorherigen|vorangehenden|anderen)\b/,
  /\b(?:todas|nenhuma) (?:as|das) (?:anteriores|alternativas|outras|respostas)\b/,
].map(r => r.source).join('|'), 'i');
// le domande del modello → domande pronte, scartando quelle che non tornano (opzioni doppie o vuote, indice fuori posto,
// «tutte le precedenti», citazione che nel materiale non c'è). Ritorna anche quante ne ha scartate, per dirlo
export function valida(grezze, materiale, caso = Math.random) {
  const buone = [], visti = new Set(); let scartate = 0;
  for (const q of grezze || []) {
    const op = (q?.opzioni || []).map(x => String(x || '').trim()), g = Number(q?.giusta);
    const ok = q?.domanda?.trim() && op.length === 4 && op.every(Boolean) && new Set(op.map(norm)).size === 4 && Number.isInteger(g) && g >= 0 && g < 4
      && !op.some(x => PRECEDENTI.test(x)) && citazioneNelMateriale(q.citazione, materiale) && !visti.has(norm(q.domanda));
    if (!ok) { scartate++; continue; }
    visti.add(norm(q.domanda));
    buone.push(componi({ domanda: q.domanda, giusta: op[g], sbagliate: op.filter((_, i) => i !== g), spiegazione: q.spiegazione || '', fonte: 'materiale' }, caso));
  }
  return { domande: buone, scartate };
}
// il materiale lungo in pezzi: ogni giro di domande lavora su un pezzo diverso, così le domande coprono tutta la dispensa
export function pezzi(testo, quanti) {
  const t = String(testo || ''), n = Math.max(1, quanti), lung = Math.ceil(t.length / n), out = [];
  for (let i = 0; i < n; i++) {
    let a = i * lung, b = Math.min(t.length, (i + 1) * lung);
    if (i > 0) { const k = t.lastIndexOf('\n', a); if (k > a - 400 && k > 0) a = k; }
    if (b < t.length) { const k = t.indexOf('\n', b); if (k > 0 && k < b + 400) b = k; }
    out.push(t.slice(a, b));
  }
  return out.filter(x => x.trim().length > 200);
}

/* ---------- il voto ---------- */
// 1 punto per risposta giusta, 0 per sbagliata o saltata, in trentesimi; si supera da 18
export function voto(giuste, tot) {
  if (!tot) return null;
  const v = Math.round(30 * giuste / tot);
  return { voto: v, superato: v >= 18, testo: v >= 18 ? t('crocette.voto', { v }) : t('crocette.voto-non-superato', { v }) };
}
