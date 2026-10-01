// Il vault Obsidian visto dalla barra. Nell'app desktop ogni lezione è una nota Markdown nel vault (Lezioni/<corso>/<data>.md):
// la barra ci scrive le ★ da esame, le definizioni e le domande, e rilegge tutto quando lo studente scrive in Obsidian.
// La nota «Lode/Memoria.md» è ciò che Lode ha imparato dello studente: definizioni sicure e da rinforzare, orari, abitudini.
// Nel browser (senza app) le stesse cose restano nei dati locali, così giochi e ripasso funzionano lo stesso.
import { D, DESKTOP, definizioni, esame, id, impostaLezioniVault, lezioneOra, lezioni, oggi, salva, serie, minuti, ultimaLezioneFinita, dataLunga, dataBreve, norm, trovaEsame, prossimi, fatti, daFare, media, num, piano, giorniTra, cfuFatti, daRipassare, prossimaLezione } from './dati.js';
import { SEZIONI, GIORNI_BREVI, fileCorso, fileLezione, notaCorso, notaLezione, orarioMd, pulito } from './markdown.js';

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
export async function annota(tipo, testo, { corso, termine, lezione, grezza } = {}) {
  const l = lezione || lezioneDaAnnotare(corso);
  termine = termine && termine.trim().replace(/^./, c => c.toUpperCase());
  const riga = grezza ? testo : tipo === 'definizione' ? `- **${termine}**: ${testo.trim()}` : tipo === 'stella' ? `- ${ora()} ${testo.trim()}` : `- ${testo.trim()}`;
  if (L) {
    await L.invoca('vault:annota', { file: l.file || fileLezione(l), nuovo: notaLezione(l), corso: l.corso === 'Appunti sparsi' ? null : { file: fileCorso(l.corso), testo: notaCorso(l.corso, { cfu: trovaEsame(l.corso)?.cfu, appello: trovaEsame(l.corso)?.data }) }, chiave: tipo, riga });
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

/* ---------- le pagine per navigare il vault: Home, Esami, Glossario, i corsi, «← precedente · successiva →» ---------- */
const nomeNota = f => f.replace(/\.md$/, '').split('/').pop();
const linkLez = l => l.file ? `[[${nomeNota(l.file)}]]` : `${l.corso} (${dataBreve(l.data)})`;
const corsiNoti = () => {
  const c = new Map();
  const metti = n => { const k = norm(n); if (n && k !== norm('Appunti sparsi') && !c.has(k)) c.set(k, pulito(n)); };
  D.orario.forEach(o => metti(o.corso)); lezioni().forEach(l => metti(l.corso)); D.esami.forEach(e => metti(e.nome));
  return [...c.values()].sort((a, b) => a.localeCompare(b, 'it'));
};
function home() {
  const T = oggi(), dow = new Date(T + 'T12:00').getDay(), lez = lezioni(), p = prossimi()[0], m = media(), c = daRipassare().length;
  const oggiOrario = D.orario.filter(o => o.giorni.includes(dow)).sort((a, b) => a.inizio.localeCompare(b.inizio));
  const notaDi = o => lez.find(l => norm(l.corso) === norm(o.corso) && l.data === T);
  return `> ${dataLunga(T).replace(/^./, x => x.toUpperCase())}${p ? ` · **${p.nome}** ${giorniTra(T, p.data) === 0 ? 'oggi' : `tra ${giorniTra(T, p.data)} giorni`}` : ''}${c ? ` · ${c} carte da ripassare` : ''}

[[Orario]] · [[Esami]] · [[Glossario]] · [[Memoria|Cosa sa Lode di me]] · [[Benvenuto|Come funziona]]

## Oggi
${oggiOrario.map(o => `- ${o.inizio}–${o.fine} **[[${pulito(o.corso)}]]**${o.aula ? ` · aula ${o.aula}` : ''}${notaDi(o) ? ` → ${linkLez(notaDi(o))}` : ''}`).join('\n') || '- Niente lezioni oggi.'}

## Corsi
${corsiNoti().map(n => { const e = trovaEsame(n), k = lez.filter(l => norm(l.corso) === norm(n)).length; return `- [[${n}]]${k ? ` · ${k} ${k === 1 ? 'lezione' : 'lezioni'}` : ''}${e?.fatto ? ` · ${e.idoneita ? 'idoneo' : e.voto + (e.lode ? ' e lode' : '')}` : e?.data ? ` · appello ${dataBreve(e.data)}` : ''}`; }).join('\n') || '- Aggiungi l\'orario dalla barra: «lezione analisi 2 lunedì 9-11 aula 7».'}

## Ultime lezioni
${lez.filter(l => l.file).slice(0, 8).map(l => `- ${linkLez(l)}${l.stelle?.length ? ` · ★${l.stelle.length}` : ''}${l.definizioni?.length ? ` · ${l.definizioni.length} definizioni` : ''}`).join('\n') || '- Ancora nessuna.'}

## ★ Da esame, le ultime
${lez.flatMap(l => (l.stelle || []).map(s => `- ${s.replace(/^\d\d:\d\d\s*/, '')} · ${linkLez(l)}`)).slice(0, 8).join('\n') || '- Ancora nessuna.'}
${m.ponderata ? `\n## Carriera\nMedia **${num(m.ponderata, 2)}** · base di laurea **${num(m.base, 1)}**/110 · ${cfuFatti()} di ${D.profilo.cfuTotali} CFU → [[Esami]]` : ''}`;
}
function esami() {
  const p = prossimi(), f = fatti().sort((a, b) => (b.data || '').localeCompare(a.data || '')), m = media(), cella = s => String(s).replace(/\|/g, '\\|');
  return `## Prossimi appelli
${p.length ? `| Esame | Data | Tra | CFU | Ore studiate |\n|---|---|---|---|---|\n${p.map(e => { const pi = piano(e); return `| [[${cella(pulito(e.nome))}]] | ${dataBreve(e.data)} | ${giorniTra(oggi(), e.data)} g | ${e.cfu} | ${num(pi.fatte, 0)} di ${pi.tot} h |`; }).join('\n')}` : 'Nessun appello segnato.'}
${daFare().filter(e => !e.data).length ? `\nSenza data: ${daFare().filter(e => !e.data).map(e => `[[${pulito(e.nome)}]]`).join(', ')}.\n` : ''}
## Libretto
${f.length ? `| Esame | CFU | Voto | Data |\n|---|---|---|---|\n${f.map(e => `| [[${cella(pulito(e.nome))}]] | ${e.cfu} | ${e.idoneita ? 'idoneo' : e.voto + (e.lode ? 'L' : '')} | ${e.data ? dataBreve(e.data) : ''} |`).join('\n')}\n\nMedia ponderata **${m.ponderata ? num(m.ponderata, 2) : '—'}** · base di laurea **${m.base ? num(m.base, 1) : '—'}**/110 · ${cfuFatti()} di ${D.profilo.cfuTotali} CFU` : 'Ancora nessun esame dato.'}`;
}
function glossario() {
  const defs = definizioni({ giorni: 3650 }), per = new Map();
  defs.forEach(d => { const k = pulito(d.corso); if (!per.has(k)) per.set(k, []); per.get(k).push(d); });
  return [...per].sort((a, b) => a[0].localeCompare(b[0], 'it')).map(([c, ds]) => `## ${c}\n[[${c}]] · ${ds.length} ${ds.length === 1 ? 'definizione' : 'definizioni'}\n\n${ds.sort((a, b) => a.t.localeCompare(b.t, 'it')).map(d => `- **${d.t}**: ${d.d}${d.file ? ` · [[${nomeNota(d.file)}]]` : ''}${d.m && d.m.sbagliate > d.m.giuste ? ' · *da rinforzare*' : ''}`).join('\n')}`).join('\n\n') || 'Le definizioni delle lezioni compaiono qui, in ordine alfabetico, divise per corso.';
}
function corso(n) {
  const lez = lezioni().filter(l => norm(l.corso) === norm(n)), e = trovaEsame(n), o = D.orario.filter(x => norm(x.corso) === norm(n));
  return `[[Home]] · [[Esami]] · [[Glossario#${n}|Glossario]]

${e ? `**${e.cfu} CFU**${e.fatto ? ` · ${e.idoneita ? 'idoneo' : 'voto ' + e.voto + (e.lode ? ' e lode' : '')}` : e.data ? ` · appello **${dataLunga(e.data)}** (tra ${giorniTra(oggi(), e.data)} giorni) · ${num(piano(e).fatte, 0)} di ${piano(e).tot} h studiate` : ''}` : ''}${o.length ? `\nLezioni: ${o.map(x => `${x.giorni.map(g => GIORNI_BREVI[g]).join(', ')} ${x.inizio}–${x.fine}${x.aula ? ' aula ' + x.aula : ''}`).join(' · ')}` : ''}

## Lezioni
${lez.map(l => `- ${linkLez(l)}${l.stelle?.length ? ` · ★${l.stelle.length}` : ''}${l.definizioni?.length ? ` · ${l.definizioni.length} definizioni` : ''}`).join('\n') || '- Ancora nessuna: la prima nasce quando segni qualcosa in aula.'}

## ★ Da esame
${lez.flatMap(l => (l.stelle || []).map(s => `- ${s.replace(/^\d\d:\d\d\s*/, '')} · ${linkLez(l)}`)).join('\n') || '- Ancora nessuna.'}`;
}
let tPagine = 0;
export function aggiornaPagine() {
  if (!L) return; clearTimeout(tPagine);
  tPagine = setTimeout(async () => {
    const b = (file, id, testo, extra = {}) => L.invoca('vault:blocco', { file, id, testo, ...extra }).catch(e => console.warn('Lode:', file, e.message));
    await b('Home.md', 'pagina', home()); await b('Esami.md', 'pagina', esami()); await b('Glossario.md', 'pagina', glossario());
    for (const n of corsiNoti()) await b(fileCorso(n), 'corso', corso(n), { nuovo: notaCorso(n, { cfu: trovaEsame(n)?.cfu, appello: trovaEsame(n)?.data }) });
    // in ogni lezione: Home, il corso, la lezione prima e quella dopo
    const perCorso = new Map(); lezioni().filter(l => l.file).forEach(l => { const k = norm(l.corso); if (!perCorso.has(k)) perCorso.set(k, []); perCorso.get(k).push(l); });
    for (const ls of perCorso.values()) {
      ls.sort((a, b) => a.data.localeCompare(b.data));
      for (const [i, l] of ls.entries()) {
        const prima = ls[i - 1], dopo = ls[i + 1];
        await b(l.file, 'nav', `[[Home]] · [[${pulito(l.corso)}]]${prima ? ` · ← [[${nomeNota(prima.file)}|${dataBreve(prima.data)}]]` : ''}${dopo ? ` · [[${nomeNota(dopo.file)}|${dataBreve(dopo.data)}]] →` : ''}`, { dove: 'titolo' });
      }
    }
  }, 900);
}
export const note = () => L ? L.invoca('vault:note') : Promise.resolve([]);
export const stato = () => L ? L.invoca('installa:stato') : Promise.resolve(null);
export const installa = cosa => L.invoca(cosa === 'obsidian' ? 'installa:obsidian' : 'installa:cervello');
export const suProgresso = fn => L?.su('installa:progresso', fn);
if (L) { addEventListener('lode:lezioni', aggiornaPagine); addEventListener('lode:dati', aggiornaPagine); aggiornaPagine(); }

export const leggiNota = file => L.invoca('vault:leggi', { file });
export const salvaFile = (file, { testo, dati, sostituisci } = {}) => L.invoca('vault:salvaFile', { file, testo, dati, sostituisci });
export const condividi = files => L.invoca('condividi', { files });
