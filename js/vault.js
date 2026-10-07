// Il vault Obsidian visto dalla barra. Nell'app desktop ogni lezione è una nota Markdown nel vault (Lezioni/<corso>/<data>.md):
// la barra ci scrive le ★ da esame, le definizioni e le domande, e rilegge tutto quando lo studente scrive in Obsidian.
// La nota «Lode/Memoria.md» è ciò che Lode ha imparato dello studente: definizioni sicure e da rinforzare, orari, abitudini.
// Nel browser (senza app) le stesse cose restano nei dati locali, così giochi e ripasso funzionano lo stesso.
import { D, DESKTOP, definizioni, esame, id, impostaLezioniVault, lezioneOra, lezioni, oggi, salva, serie, minuti, ultimaLezioneFinita, dataLunga, dataBreve, norm, trovaEsame, prossimi, fatti, daFare, media, num, piano, giorniTra, cfuFatti, daRipassare, prossimaLezione } from './dati.js';
import { SEZIONI, GIORNI_BREVI, fileCorso, fileLezione, notaCorso, notaLezione, orarioMd, pulito } from './markdown.js';
import { aggiornaDiario, sezioneMemoria } from './codice/diario.js';
import { CONCETTI } from './codice/modelli.js';
import { t, locale } from './lingua.js';

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
export const apriVault = () => L?.invoca('vault:apri', { file: 'Benvenuto.md' });
export function scriviOrario() { if (L) L.invoca('vault:scrivi', { file: 'Orario.md', testo: orarioMd(D.orario) }); }

// le proposte dell'allenatore che funzionano (quelle accettate più spesso)
const NOMI_PROP = { gioco: t('vault.prop-gioco'), ripasso: t('vault.prop-ripasso'), stelle: t('vault.prop-stelle'), orale: t('vault.prop-orale'), focus: t('vault.prop-focus'), stampa: t('vault.prop-stampa') };
function proposte() {
  const per = {}; for (const x of D.allenatore?.storia || []) { per[x.tipo] ||= { si: 0, tot: 0 }; per[x.tipo].tot++; if (x.esito === 'accettata') per[x.tipo].si++; }
  const k = Object.entries(per).filter(([, v]) => v.tot >= 2).sort((a, b) => b[1].si / b[1].tot - a[1].si / a[1].tot);
  return k.length ? `- ${t('vault.memoria-proposte', { elenco: k.slice(0, 2).map(([tipo, v]) => t('vault.prop-voce', { nome: NOMI_PROP[tipo] || tipo, si: v.si, tot: v.tot })).join(', ') })}\n` : '';
}
// la memoria di Lode, leggibile dallo studente: cosa sa, cosa sbaglia, come studia
const FASCE = { mattina: t('vault.fascia-mattina'), pomeriggio: t('vault.fascia-pomeriggio'), sera: t('vault.fascia-sera') };
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
# ${t('vault.memoria-titolo')}

%% ${t('vault.memoria-commento', { sezione: 'Note per Lode' })} %%

## ${t('vault.titolo-in-breve')}
- ${t('vault.memoria-in-breve', { lezioni: t('vault.memoria-lezioni', { n: lez.length }), definizioni: t('vault.memoria-definizioni', { n: defs.length }), sicure: sicure.length, deboli: deboli.length, mai: mai.length })}
- ${t('vault.memoria-serie', { n: serie(), h: Math.round(minuti({ da: oggi().slice(0, 8) + '01' }) / 60) })}
${fasce[0][1] ? `- ${t('vault.memoria-fascia', { fascia: FASCE[fasce[0][0]] })}\n` : ''}${proposte()}
## ${t('vault.titolo-da-rinforzare')}
${deboli.map(d => `- **${d.t}** (${link(d)}): ${t('vault.sbagliata', { n: d.m.sbagliate, tot: d.m.giuste + d.m.sbagliate })}`).join('\n') || `- ${t('vault.niente-per-ora')}`}

## ${t('vault.titolo-sicure')}
${sicure.slice(0, 40).map(d => `- ${d.t} (${d.corso})`).join('\n') || `- ${t('vault.sicure-vuoto')}`}

## ★ Da esame, le ultime
${lez.flatMap(l => (l.stelle || []).map(s => `- ${s.replace(/^\d\d:\d\d\s*/, '')} (${l.file ? `[[${l.file.replace(/\.md$/, '').split('/').pop()}]]` : l.corso})`)).slice(0, 15).join('\n') || `- ${t('vault.ancora-nessuna')}`}

${sezioneMemoria(D.codice, OPZ_DIARIO)}## Note per Lode
%% ${t('vault.note-commento')} %%
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
  return [...c.values()].sort((a, b) => a.localeCompare(b, locale()));
};
function home() {
  const T = oggi(), dow = new Date(T + 'T12:00').getDay(), lez = lezioni(), p = prossimi()[0], m = media(), c = daRipassare().length;
  const oggiOrario = D.orario.filter(o => o.giorni.includes(dow)).sort((a, b) => a.inizio.localeCompare(b.inizio));
  const notaDi = o => lez.find(l => norm(l.corso) === norm(o.corso) && l.data === T);
  return `> ${dataLunga(T).replace(/^./, x => x.toUpperCase())}${p ? ` · **${p.nome}** ${giorniTra(T, p.data) === 0 ? t('comune.oggi') : t('comune.traGiorni', { n: giorniTra(T, p.data) })}` : ''}${c ? ` · ${t('vault.home-carte', { n: c })}` : ''}

[[Orario]] · [[Esami]] · [[Glossario]] · [[Memoria|${t('vault.alias-memoria')}]] · [[Benvenuto|${t('vault.alias-benvenuto')}]]

## ${t('vault.titolo-oggi')}
${oggiOrario.map(o => `- ${o.inizio}–${o.fine} **[[${pulito(o.corso)}]]**${o.aula ? ` · ${t('vault.aula', { aula: o.aula })}` : ''}${notaDi(o) ? ` → ${linkLez(notaDi(o))}` : ''}`).join('\n') || `- ${t('vault.niente-lezioni-oggi')}`}

## ${t('vault.titolo-corsi')}
${corsiNoti().map(n => { const e = trovaEsame(n), k = lez.filter(l => norm(l.corso) === norm(n)).length; return `- [[${n}]]${k ? ` · ${t('vault.n-lezioni', { n: k })}` : ''}${e?.fatto ? ` · ${e.idoneita ? t('vault.idoneo') : e.lode ? t('vault.voto-e-lode', { voto: e.voto }) : e.voto}` : e?.data ? ` · ${t('vault.appello', { data: dataBreve(e.data) })}` : ''}`; }).join('\n') || `- ${t('vault.corsi-vuoto')}`}

## ${t('vault.titolo-ultime-lezioni')}
${lez.filter(l => l.file).slice(0, 8).map(l => `- ${linkLez(l)}${l.stelle?.length ? ` · ★${l.stelle.length}` : ''}${l.definizioni?.length ? ` · ${t('vault.definizioni-n', { n: l.definizioni.length })}` : ''}`).join('\n') || `- ${t('vault.ancora-nessuna')}`}

## ★ Da esame, le ultime
${lez.flatMap(l => (l.stelle || []).map(s => `- ${s.replace(/^\d\d:\d\d\s*/, '')} · ${linkLez(l)}`)).slice(0, 8).join('\n') || `- ${t('vault.ancora-nessuna')}`}
${m.ponderata ? `\n## ${t('vault.titolo-carriera')}\n${t('vault.carriera', { media: num(m.ponderata, 2), base: num(m.base, 1), cfu: cfuFatti(), tot: D.profilo.cfuTotali, esami: '[[Esami]]' })}` : ''}`;
}
function esami() {
  const p = prossimi(), f = fatti().sort((a, b) => (b.data || '').localeCompare(a.data || '')), m = media(), cella = s => String(s).replace(/\|/g, '\\|');
  return `## ${t('vault.titolo-prossimi-appelli')}
${p.length ? `${t('vault.tabella-appelli')}\n|---|---|---|---|---|\n${p.map(e => { const pi = piano(e); return `| [[${cella(pulito(e.nome))}]] | ${dataBreve(e.data)} | ${t('comune.giorniBrevi', { n: giorniTra(oggi(), e.data) })} | ${e.cfu} | ${t('vault.ore-di', { fatte: num(pi.fatte, 0), tot: pi.tot })} |`; }).join('\n')}` : t('vault.nessun-appello')}
${daFare().filter(e => !e.data).length ? `\n${t('vault.senza-data', { elenco: daFare().filter(e => !e.data).map(e => `[[${pulito(e.nome)}]]`).join(', ') })}\n` : ''}
## ${t('vault.titolo-libretto')}
${f.length ? `${t('vault.tabella-libretto')}\n|---|---|---|---|\n${f.map(e => `| [[${cella(pulito(e.nome))}]] | ${e.cfu} | ${e.idoneita ? t('vault.idoneo') : e.lode ? t('vault.voto-l', { voto: e.voto }) : e.voto} | ${e.data ? dataBreve(e.data) : ''} |`).join('\n')}\n\n${t('vault.libretto-piede', { media: m.ponderata ? num(m.ponderata, 2) : '—', base: m.base ? num(m.base, 1) : '—', cfu: cfuFatti(), tot: D.profilo.cfuTotali })}` : t('vault.libretto-vuoto')}`;
}
function glossario() {
  const defs = definizioni({ giorni: 3650 }), per = new Map();
  defs.forEach(d => { const k = pulito(d.corso); if (!per.has(k)) per.set(k, []); per.get(k).push(d); });
  return [...per].sort((a, b) => a[0].localeCompare(b[0], locale())).map(([c, ds]) => `## ${c}\n[[${c}]] · ${t('vault.n-definizioni', { n: ds.length })}\n\n${ds.sort((a, b) => a.t.localeCompare(b.t, locale())).map(d => `- **${d.t}**: ${d.d}${d.file ? ` · [[${nomeNota(d.file)}]]` : ''}${d.m && d.m.sbagliate > d.m.giuste ? ` · ${t('vault.da-rinforzare')}` : ''}`).join('\n')}`).join('\n\n') || t('vault.glossario-vuoto');
}
function corso(n) {
  const lez = lezioni().filter(l => norm(l.corso) === norm(n)), e = trovaEsame(n), o = D.orario.filter(x => norm(x.corso) === norm(n));
  return `[[Home]] · [[Esami]] · [[Glossario#${n}|Glossario]]

${e ? `${t('vault.corso-cfu', { cfu: e.cfu })}${e.fatto ? ` · ${e.idoneita ? t('vault.idoneo') : t(e.lode ? 'vault.corso-voto-lode' : 'vault.corso-voto', { voto: e.voto })}` : e.data ? ` · ${t('vault.corso-appello', { data: dataLunga(e.data), n: giorniTra(oggi(), e.data), fatte: num(piano(e).fatte, 0), tot: piano(e).tot })}` : ''}` : ''}${o.length ? `\n${t('vault.corso-lezioni', { elenco: o.map(x => t(x.aula ? 'vault.orario-voce-aula' : 'vault.orario-voce', { giorni: x.giorni.map(g => GIORNI_BREVI[g]).join(', '), inizio: x.inizio, fine: x.fine, aula: x.aula })).join(' · ') })}` : ''}

## Lezioni
${lez.map(l => `- ${linkLez(l)}${l.stelle?.length ? ` · ★${l.stelle.length}` : ''}${l.definizioni?.length ? ` · ${t('vault.definizioni-n', { n: l.definizioni.length })}` : ''}`).join('\n') || `- ${t('vault.lezioni-vuoto')}`}

## ★ Da esame
${lez.flatMap(l => (l.stelle || []).map(s => `- ${s.replace(/^\d\d:\d\d\s*/, '')} · ${linkLez(l)}`)).join('\n') || `- ${t('vault.ancora-nessuna')}`}`;
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
    // informatica: il diario dei progetti (oggi e ieri) e «Cosa so davvero» sulla pagina dei corsi di programmazione
    (await scriviDiario()).filter(x => x.errore).forEach(x => console.warn('Lode:', x.file, x.errore));
  }, 900);
}
// il registro onesto (js/codice/diario.js): solo conti, scritti dentro i segni di Lode. Gli argomenti di «Cosa stampa?»
// sono tutti quelli di modelli.js, così nella tabella compaiono anche quelli «mai fatti»
const OPZ_DIARIO = { concetti: Object.keys(CONCETTI), nomi: CONCETTI };
const scrittore = { blocco: x => L.invoca('vault:blocco', x) };
export const scriviDiario = () => L ? aggiornaDiario(scrittore, D, OPZ_DIARIO) : Promise.resolve([]);
export const apriDiario = x => L?.invoca('vault:apri', { file: x.file, nuovo: x.nuovo });
// una volta al giorno si riscrive tutto anche senza novità: «Ultima volta: 9 giorni fa» e «da rifare» dipendono dalla data
let giornoScritto = oggi();
if (L) setInterval(() => { if (oggi() !== giornoScritto) { giornoScritto = oggi(); aggiornaPagine(); scriviMemoria(); } }, 10 * 60e3);
export const note = () => L ? L.invoca('vault:note') : Promise.resolve([]);
export const stato = () => L ? L.invoca('installa:stato') : Promise.resolve(null);
export const installa = cosa => L.invoca(cosa === 'obsidian' ? 'installa:obsidian' : 'installa:cervello');
export const suProgresso = fn => L?.su('installa:progresso', fn);
if (L) { addEventListener('lode:lezioni', aggiornaPagine); addEventListener('lode:dati', aggiornaPagine); aggiornaPagine(); }

export const leggiNota = file => L.invoca('vault:leggi', { file });
// «Ripasso in tasca» (js/tasca.js): In tasca.md alla radice del vault, l'unica nota che scrive (il main non ne permette altre)
export const scriviTasca = testo => L.invoca('vault:scrivi', { file: 'In tasca.md', testo });
export const salvaFile = (file, { testo, dati, sostituisci } = {}) => L.invoca('vault:salvaFile', { file, testo, dati, sostituisci });
export const condividi = files => L.invoca('condividi', { files });
// mostra un file del vault nella sua cartella (Finder, Esplora risorse): per esempio il file per Anki
export const mostra = file => L.invoca('vault:mostra', { file });
