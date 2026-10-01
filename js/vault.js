// Il vault Obsidian visto dalla barra. Nell'app desktop ogni lezione è una nota Markdown nel vault (Lezioni/<corso>/<data>.md):
// la barra ci scrive le ★ da esame, le definizioni e le domande, e rilegge tutto quando lo studente scrive in Obsidian.
// La nota «Lode/Memoria.md» è ciò che Lode ha imparato dello studente: definizioni sicure e da rinforzare, orari, abitudini.
// Nel browser (senza app) le stesse cose restano nei dati locali, così giochi e ripasso funzionano lo stesso.
import { D, DESKTOP, definizioni, esame, id, impostaLezioniVault, lezioneOra, lezioni, oggi, salva, serie, minuti, ultimaLezioneFinita, dataLunga, norm, trovaEsame } from './dati.js';
import { SEZIONI, fileCorso, fileLezione, notaCorso, notaLezione, orarioMd, pulito } from './markdown.js';

const L = DESKTOP ? window.lodeDesktop : null;
export const attivo = DESKTOP;
export let info = null;   // { percorso, nome, obsidian: { installato, registrato } }
const avvisa = () => dispatchEvent(new CustomEvent('lode:vault'));
if (L) {
  L.su('vault:lezioni', l => impostaLezioniVault(l));
  L.su('vault:orario', o => { D.orario = o.map(x => ({ id: id(), ...x })); salva(); });
  L.su('vault:info', i => { info = i; avvisa(); });
  L.invoca('vault:info').then(i => { info = i; avvisa(); });
  L.invoca('vault:lezioni').then(l => impostaLezioniVault(l));
}

const ora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
// dove scrivere adesso: la lezione in corso, se no l'ultima finita oggi, se no la nota «Appunti sparsi» di oggi
export function lezioneDaAnnotare(corsoDetto) {
  if (corsoDetto) { const o = D.orario.find(x => norm(x.corso) === norm(corsoDetto)) || { corso: trovaEsame(corsoDetto)?.nome || corsoDetto }; return { corso: o.corso, data: oggi(), inizio: o.inizio, fine: o.fine, aula: o.aula }; }
  const l = lezioneOra(); if (l) return l;
  const u = ultimaLezioneFinita(); if (u && u.data === oggi()) return u;
  return { corso: 'Appunti sparsi', data: oggi() };
}
export async function annota(tipo, testo, { corso, termine } = {}) {
  const l = lezioneDaAnnotare(corso);
  termine = termine && termine.trim().replace(/^./, c => c.toUpperCase());
  const riga = tipo === 'definizione' ? `- **${termine}**: ${testo.trim()}` : tipo === 'stella' ? `- ${ora()} ${testo.trim()}` : `- ${testo.trim()}`;
  if (L) {
    await L.invoca('vault:annota', { file: fileLezione(l), nuovo: notaLezione(l), corso: l.corso === 'Appunti sparsi' ? null : { file: fileCorso(l.corso), testo: notaCorso(l.corso, { cfu: trovaEsame(l.corso)?.cfu, appello: trovaEsame(l.corso)?.data }) }, chiave: tipo, riga });
  } else {
    let x = D.lezioni.find(y => y.corso === l.corso && y.data === l.data);
    if (!x) { x = { id: id(), corso: l.corso, data: l.data, inizio: l.inizio || null, fine: l.fine || null, aula: l.aula || null, definizioni: [], stelle: [], domande: [] }; D.lezioni.push(x); }
    if (tipo === 'definizione') x.definizioni.push({ t: termine, d: testo.trim() });
    else if (tipo === 'stella') x.stelle.push(`${ora()} ${testo.trim()}`); else x.domande.push(testo.trim());
    salva(); impostaLezioniVault(null);
  }
  return l;
}
// apre la nota in Obsidian; l'esito dice se Obsidian c'è ('ok'), c'è ma il vault va aperto una volta ('da_aprire') o manca ('manca')
export async function apri(l) {
  if (!L) return { esito: 'web' };
  const x = l || lezioneDaAnnotare();
  try { return await L.invoca('vault:apri', { file: x.file || fileLezione(x), nuovo: x.file ? undefined : notaLezione(x) }); } catch (e) { return { esito: 'errore', errore: e.message }; }
}
export const apriFile = file => L?.invoca('vault:apri', { file });
export const apriVault = () => L?.invoca('vault:apri', { file: 'Benvenuto.md' });
export function scriviOrario() { if (L) L.invoca('vault:scrivi', { file: 'Orario.md', testo: orarioMd(D.orario) }); }

// la memoria di Lode, leggibile dallo studente: cosa sa, cosa sbaglia, come studia
export function scriviMemoria() {
  if (!L) return;
  const defs = definizioni({ giorni: 3650 }), fatte = defs.filter(d => d.m);
  const sicure = fatte.filter(d => d.m.rip >= 2 && d.m.giuste >= d.m.sbagliate * 2);
  const deboli = fatte.filter(d => d.m.sbagliate > 0 && !sicure.includes(d)).sort((a, b) => b.m.sbagliate - a.m.sbagliate).slice(0, 15);
  const mai = defs.filter(d => !d.m);
  const link = d => d.file ? `[[${d.file.replace(/\.md$/, '').split('/').pop()}]]` : d.corso;
  const fasce = [['mattina', 6, 13], ['pomeriggio', 13, 19], ['sera', 19, 24]].map(([n, a, b]) => [n, D.sessioni.filter(s => { const h = new Date(s.inizio).getHours(); return h >= a && h < b; }).reduce((t, s) => t + s.min, 0)]).sort((a, b) => b[1] - a[1]);
  const lez = lezioni();
  const testo = `---
tipo: memoria
aggiornata: ${oggi()}
---
# Cosa so di te

%% Questa nota la scrive Lode. Puoi leggerla e anche correggerla: la sezione «Note per Lode» la leggo ogni volta che uso l'AI. %%

## In breve
- ${lez.length} ${lez.length === 1 ? 'lezione annotata' : 'lezioni annotate'}, ${defs.length} ${defs.length === 1 ? 'definizione' : 'definizioni'}: **${sicure.length} sicure**, ${deboli.length} da rinforzare, ${mai.length} ancora da giocare.
- Serie di studio: ${serie()} ${serie() === 1 ? 'giorno' : 'giorni'} di fila. Questo mese: ${Math.round(minuti({ da: oggi().slice(0, 8) + '01' }) / 60)} h.
${fasce[0][1] ? `- Studi soprattutto di **${fasce[0][0]}**.\n` : ''}
## Da rinforzare
${deboli.map(d => `- **${d.t}** (${link(d)}): sbagliata ${d.m.sbagliate} ${d.m.sbagliate === 1 ? 'volta' : 'volte'} su ${d.m.giuste + d.m.sbagliate}`).join('\n') || '- Niente, per ora.'}

## Sicure
${sicure.slice(0, 40).map(d => `- ${d.t} (${d.corso})`).join('\n') || '- Ancora nessuna: gioca qualche partita.'}

## ★ Da esame, le ultime
${lez.flatMap(l => (l.stelle || []).map(s => `- ${s.replace(/^\d\d:\d\d\s*/, '')} (${l.file ? `[[${l.file.replace(/\.md$/, '').split('/').pop()}]]` : l.corso})`)).slice(0, 15).join('\n') || '- Ancora nessuna.'}

## Note per Lode
%% Scrivi qui come vuoi essere aiutato: «spiegami con esempi pratici», «sono dislessico, frasi brevi», «l'orale di Analisi è con Rossi, molto teorico». %%
`;
  L.invoca('vault:memoria', { testo });
}
export { SEZIONI, pulito, dataLunga, esame };
