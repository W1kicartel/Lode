// La pagina sotto la barra: il quadro della carriera a colpo d'occhio. Media, base di laurea, CFU, ore della settimana,
// i prossimi appelli con il piano, il libretto e i mazzi del ripasso. Tutto il resto si fa dalla barra in alto.
import { D, VUOTO, backupValido, aggiungiCarta, aggiungiEsame, cfuFatti, dataBreve, dataLunga, daFare, daRipassare, esame, esempio, esc, esporta, fatti, giorniTra, media, minuti, num, obiettivo, oggi, ore, piano, prossimi, salva, serie, settimana, sostituisci, traQuanto } from './dati.js';
import { azioni, TASTI } from './lode.js';
import { conta, tween } from './motore.js';
import * as AI from './ai.js';
import * as F from './focus.js';

const $ = (s, r = document) => r.querySelector(s);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const GEMMA = '<svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="M0,-44 Q4,-44 7,-41 L41,-7 Q44,-4 44,0 Q44,4 41,7 L7,41 Q4,44 0,44 Q-4,44 -7,41 L-41,7 Q-44,4 -44,0 Q-44,-4 -41,-7 L-7,-41 Q-4,-44 0,-44 Z" fill="currentColor"/></svg>';

export function toast(t) { const el = $('.toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2400); }
function saluto() { const n = String(D.profilo.nome || '').trim().split(/\s+/)[0], o = new Date().getHours(); const s = o < 5 ? 'Ancora sveglio' : o < 13 ? 'Buongiorno' : o < 18 ? 'Buon pomeriggio' : 'Buonasera'; return n ? `${s}, ${n}.` : `${s}.`; }

let primaVolta = true;
export function disegna() {
  const m = media(), cf = cfuFatti(), tot = D.profilo.cfuTotali, sett = settimana(), minS = sett.reduce((s, g) => s + g.min, 0), maxS = Math.max(60, ...sett.map(g => g.min));
  const p = prossimi(), senza = daFare().filter(e => !e.data), c = daRipassare().length, sr = serie();
  const sotto = [p[0] ? `${p[0].nome} ${traQuanto(p[0].data)}` : null, c ? `${c} ${c === 1 ? 'carta' : 'carte'} da ripassare` : null, sr ? `${sr} ${sr === 1 ? 'giorno' : 'giorni'} di fila` : null].filter(Boolean).join(' · ') || (D.esami.length ? 'Niente in sospeso oggi.' : 'Il tuo libretto, il piano di studio e il ripasso. Tutto qui, tutto tuo.');
  const main = $('main');
  main.innerHTML = `
  <header class="testata"><div class="marchio">${GEMMA}Lode<small>${esc(D.profilo.corso || 'assistente di studio')}</small></div>
    <nav><button class="btn piano small" data-a="esporta">Esporta</button><button class="btn small" data-a="impostazioni">Impostazioni</button></nav></header>
  <div class="saluto ${primaVolta ? 'entra' : ''}"><h1>${esc(saluto())}</h1><p>${esc(sotto)}</p>
    <div class="suggerimento">Passa sopra la barra in alto, premi <kbd>/</kbd> per scrivere o tieni premuto <kbd>${TASTI}</kbd> per parlare.</div></div>

  <div class="stats ${primaVolta ? 'entra' : ''}">
    <div class="stat"><span class="lbl">Media ponderata</span><b class="v" data-c="${esc(m.ponderata ?? '')}" data-dec="2">${m.ponderata ? '0' : '—'}</b><span class="d">${m.n ? `aritmetica ${esc(num(m.aritmetica, 2))} · ${esc(m.n)} ${m.n === 1 ? 'voto' : 'voti'}` : 'segna il primo voto dalla barra'}</span></div>
    <div class="stat"><span class="lbl">Base di laurea</span><b class="v"><span data-c="${esc(m.base ?? '')}" data-dec="1">${m.base ? '0' : '—'}</span><small>/110</small></b><span class="d">media × 110 / 30</span></div>
    <div class="stat"><span class="lbl">Crediti</span><b class="v"><span data-c="${esc(cf)}" data-dec="0">0</span><small>/${esc(tot)}</small></b><div class="barra"><i style="transform:scaleX(0)" data-x="${esc(Math.min(1, cf / tot))}"></i></div><span class="d">${esc(Math.max(0, tot - cf))} CFU alla laurea</span></div>
    <div class="stat"><span class="lbl">Questa settimana</span><b class="v" style="font-size:28px">${minS ? esc(ore(minS)) : '0 min'}</b>
      <div class="sett" aria-label="Minuti di studio negli ultimi 7 giorni">${sett.map(g => `<span class="${g.oggi ? 'oggi' : ''}" title="${esc(dataLunga(g.g))}: ${esc(ore(g.min))}"><i style="height:${Math.max(2, Math.round(g.min / maxS * 32))}px;transform:scaleY(0)"></i><em>${'DLMMGVS'[new Date(g.g + 'T12:00').getDay()]}</em></span>`).join('')}</div></div>
  </div>

  <section><div class="capo"><h2>Prossimi esami</h2><div class="az"><button class="btn small" data-a="nuovoEsame">Nuovo esame</button></div></div>
    <div class="griglia ${primaVolta ? 'entra' : ''}">${p.map(cartaEsame).join('')}${senza.map(cartaEsame).join('')}
      ${!p.length && !senza.length ? `<div class="esame nuovo"><p>Scrivi nella barra in alto:</p><p><code>esame analisi 2 il 15 gennaio 9 cfu</code></p><p style="margin-top:10px">oppure <button class="btn small" data-a="esempio">prova con i dati di esempio</button></p></div>` : ''}</div></section>

  <div class="due">
    <section><div class="capo"><h2>Libretto</h2><div class="az"><button class="btn small" data-a="nuovoVoto">Segna un voto</button></div></div>
      <div class="blocco">${libretto()}</div></section>
    <section><div class="capo"><h2>Ripasso</h2><div class="az"><button class="btn small piano" data-a="file">Da file</button><button class="btn small" data-a="ripassa"${c ? '' : ' disabled'}>Ripassa ${c || ''}</button></div></div>
      <div class="blocco mazzi">${mazzi()}</div></section>
  </div>

  <footer class="piede"><span>Lode è open source (MIT). I tuoi dati restano in questo browser: nessun account, nessun server.</span>
    <span><button data-a="importa">Importa un backup</button> · <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a></span></footer>`;
  anima(main, primaVolta); primaVolta = false;
}
function cartaEsame(e) {
  const pi = piano(e), g = e.data ? giorniTra(oggi(), e.data) : null, nc = D.carte.filter(c => c.esameId === e.id).length, nd = daRipassare(e.id).length;
  return `<article class="esame${g != null && g <= 7 ? ' vicino' : ''}">
    <div class="r1"><div><h3>${esc(e.nome)}</h3><div class="quando">${e.data ? esc(cap(dataLunga(e.data))) : 'Data da decidere'} · ${esc(e.cfu)} CFU</div></div>
      ${g != null ? `<div class="g">${g === 0 ? 'oggi' : esc(g)}${g ? `<small>${g === 1 ? 'GIORNO' : 'GIORNI'}</small>` : ''}</div>` : ''}</div>
    <div class="avanza"><div class="riga"><span>${pi.fatte < .05 ? '0' : esc(num(pi.fatte, pi.fatte < 10 ? 1 : 0))} di ${esc(pi.tot)} h studiate</span><span>${e.data ? (pi.oggi >= .1 ? `<b>${esc(num(pi.oggi))} h</b> oggi` : 'oggi in pari') : ''}</span></div><div class="q"><i style="transform:scaleX(0)" data-x="${esc(pi.quota)}"></i></div></div>
    <div class="az"><button class="btn small primary" data-a="focus" data-e="${esc(e.id)}">Focus</button><button class="btn small" data-a="ripassaE" data-e="${esc(e.id)}"${nc ? '' : ' disabled'}>Ripassa${nd ? ' ' + nd : ''}</button><button class="btn small" data-a="interroga" data-e="${esc(e.id)}">Interrogami</button></div>
    <button class="modifica" data-a="modifica" data-e="${esc(e.id)}">Modifica · Segna voto</button>
  </article>`;
}
function libretto() {
  const lista = fatti().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  if (!lista.length) return `<p style="margin:0;padding:18px 16px;color:var(--muted);font-size:14px">Nessun esame dato. Scrivi nella barra <kbd>ho preso 28 in fisica</kbd>.</p>`;
  const m = media();
  return `<table><thead><tr><th>Esame</th><th class="num">CFU</th><th class="num">Voto</th><th class="num">Data</th><th></th></tr></thead><tbody>
    ${lista.map(e => `<tr><td>${esc(e.nome)}</td><td class="num">${esc(e.cfu)}</td><td class="num"><span class="voto">${e.idoneita ? '<span class="tenue">idoneo</span>' : esc(e.voto + (e.lode ? 'L' : ''))}</span></td><td class="num tenue">${e.data ? esc(dataBreve(e.data)) : ''}</td><td class="num"><button class="x" data-a="modifica" data-e="${esc(e.id)}" aria-label="Modifica ${esc(e.nome)}">⋯</button></td></tr>`).join('')}
  </tbody></table><div class="tbl-piede"><span>${esc(lista.length)} esami · ${esc(cfuFatti())} CFU</span><span>media <b>${m.ponderata ? esc(num(m.ponderata, 2)) : '—'}</b> · base <b>${m.base ? esc(num(m.base, 1)) : '—'}</b></span></div>`;
}
function mazzi() {
  const gruppi = new Map(); D.carte.forEach(c => { const k = c.esameId || ''; gruppi.set(k, (gruppi.get(k) || 0) + 1); });
  if (!gruppi.size) return `<p style="margin:0;padding:18px 16px;color:var(--muted);font-size:14px">Ancora nessuna carta. Scrivi <kbd>carta: domanda = risposta</kbd> o trascina un PDF sulla finestra.</p>`;
  return [...gruppi].sort((a, b) => b[1] - a[1]).map(([k, n]) => { const d = daRipassare(k || undefined).filter(c => (c.esameId || '') === k).length; return `<div class="mazzo"><div><b>${esc(k ? esame(k)?.nome || 'Esame tolto' : 'Senza esame')}</b><span>${esc(n)} ${n === 1 ? 'carta' : 'carte'}</span></div><span class="n${d ? '' : ' zero'}" title="da ripassare oggi">${esc(d)}</span><button class="btn small" data-a="ripassaE" data-e="${esc(k)}"${d ? '' : ' disabled'}>Ripassa</button></div>`; }).join('');
}
// la prima volta i numeri salgono e le barre crescono; agli aggiornamenti successivi cambiano e basta
function anima(r, prima) {
  r.querySelectorAll('[data-c]').forEach((el, i) => { const v = parseFloat(el.dataset.c); if (isNaN(v)) return; if (prima) conta(el, v, x => num(x, +el.dataset.dec), { ritardo: 120 + i * 60 }); else el.textContent = num(v, +el.dataset.dec); });
  r.querySelectorAll('[data-x]').forEach((el, i) => prima ? tween(900, e => { el.style.transform = `scaleX(${(+el.dataset.x * e).toFixed(4)})`; }, { ritardo: 200 + i * 40 }) : (el.style.transform = `scaleX(${el.dataset.x})`));
  r.querySelectorAll('.sett i').forEach((el, i) => prima ? tween(620, e => { el.style.transform = `scaleY(${e.toFixed(3)})`; }, { ritardo: 200 + i * 55 }) : (el.style.transform = ''));
}

/* ---------- finestre ---------- */
function finestra(html, alSalva) {
  const d = document.createElement('dialog'); d.innerHTML = `<form class="finestra" method="dialog">${html}</form>`; document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.querySelector('form').addEventListener('submit', ev => { const b = ev.submitter; if (b?.value === 'annulla') return; ev.preventDefault(); if (alSalva(new FormData(ev.target), b?.value, d) !== false) d.close(); });
  d.showModal(); return d;
}
function finestraEsame(id) {
  const e = id ? esame(id) : null;
  finestra(`<h2>${e ? esc(e.nome) : 'Nuovo esame'}</h2><p>${e ? 'Correggi i dati o segna il voto.' : 'Puoi anche scriverlo nella barra: «esame fisica 2 il 20 febbraio 6 cfu».'}</p>
    <div class="campi"><label class="tutta">Nome<input name="nome" required value="${esc(e?.nome || '')}" placeholder="Analisi 2"></label>
      <label>CFU<input name="cfu" type="number" min="1" max="30" value="${esc(e?.cfu || 6)}"></label>
      <label>${e?.fatto ? 'Data' : 'Data dell\'appello'}<input name="data" type="date" value="${esc(e?.data || '')}"></label>
      <label>Voto <small>vuoto se non l'hai ancora dato</small><select name="voto"><option value="">—</option>${Array.from({ length: 13 }, (_, i) => 18 + i).map(v => `<option${e?.voto === v ? ' selected' : ''}>${v}</option>`).join('')}<option value="L"${e?.lode ? ' selected' : ''}>30 e lode</option><option value="I"${e?.idoneita ? ' selected' : ''}>Idoneità</option></select></label>
      <label>Ore di studio previste <small>per il piano</small><input name="ore" type="number" min="1" max="500" value="${esc(e ? obiettivo(e) : '')}" placeholder="10 × CFU"></label></div>
    <div class="piedi">${e ? '<button class="btn piano" value="elimina">Elimina</button>' : ''}<div class="dx"><button class="btn piano" value="annulla" formnovalidate>Annulla</button><button class="btn primary" value="salva">Salva</button></div></div>`,
  (f, azione) => {
    if (azione === 'elimina') { if (!confirm(`Eliminare ${e.nome}? Le sue ore e le carte restano, senza esame.`)) return false; D.esami = D.esami.filter(x => x.id !== e.id); salva(); toast('Esame eliminato'); return; }
    const v = f.get('voto'), x = e || aggiungiEsame({ nome: f.get('nome'), cfu: +f.get('cfu') });
    Object.assign(x, { nome: String(f.get('nome')).trim(), cfu: +f.get('cfu') || 6, data: f.get('data') || null, oreObiettivo: f.get('ore') ? +f.get('ore') : null,
      voto: v === 'L' ? 30 : v && v !== 'I' ? +v : null, lode: v === 'L', idoneita: v === 'I', fatto: !!v });
    if (x.fatto && !x.data) x.data = oggi();
    salva(); toast(e ? 'Salvato' : 'Esame aggiunto');
  });
}
function finestraImpostazioni() {
  const d = finestra(`<h2>Impostazioni</h2><p>Tutto resta su questo computer. La chiave della tua AI va solo al servizio che scegli.</p>
    <div class="campi"><label>Il tuo nome<input name="nome" value="${esc(D.profilo.nome)}" placeholder="Giulia"></label>
      <label>Corso di laurea<input name="corso" value="${esc(D.profilo.corso)}" placeholder="Ingegneria informatica"></label>
      <label>CFU della laurea<select name="cfuTotali">${[180, 120, 300, 360].map(v => `<option${D.profilo.cfuTotali === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>La lode vale<select name="lode">${[30, 31, 32, 33].map(v => `<option${D.profilo.lode === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Focus (minuti)<input name="focus" type="number" min="5" max="180" value="${esc(D.imp.focus)}"></label>
      <label>Pausa (minuti)<input name="pausa" type="number" min="1" max="60" value="${esc(D.imp.pausa)}"></label>
      <label class="spunta tutta"><input type="checkbox" name="suoni"${D.imp.suoni ? ' checked' : ''}>Rintocco alla fine del focus</label>
      <label class="spunta tutta"><input type="checkbox" name="chiaro"${D.imp.aspetto === 'chiaro' ? ' checked' : ''}>Aspetto chiaro</label></div>
    <hr>
    <div class="campi"><label>La tua AI <small>facoltativa, a consumo: paghi tu il servizio</small><select name="fornitore"><option value="">Solo il cervello locale (gratis)</option>${Object.entries(AI.FORNITORI).map(([k, f]) => `<option value="${esc(k)}"${AI.fornitore() === k ? ' selected' : ''}>${esc(f.nome)} · ${esc(f.ditta)}</option>`).join('')}</select></label>
      <label>Chiave <small>si crea sul sito del servizio</small><input name="chiave" type="password" autocomplete="off" value="${esc(D.imp.chiave)}" placeholder="incolla la chiave"></label>
      <label class="spunta tutta"><input type="checkbox" name="voceAlta"${D.imp.voceAlta ? ' checked' : ''}>Leggi le risposte ad alta voce</label></div>
    <p class="stato-ai" style="margin:10px 0 0">${D.imp.chiave ? `AI <b>attiva</b>: ${esc(AI.FORNITORI[AI.fornitore()].nome)}.` : 'Senza chiave Lode funziona lo stesso: comandi, timer, libretto e ripasso sono tutti locali; nell\'app c\'è anche il cervello locale gratis.'}</p>
    <div class="piedi"><button class="btn piano" value="azzera">Cancella tutto</button><div class="dx"><button class="btn piano" value="annulla" formnovalidate>Annulla</button><button class="btn primary" value="salva">Salva</button></div></div>`,
  (f, azione, dlg) => {
    // «Cancella tutto» cancella anche le chiavi: prima si scollega (D.imp.chiave vuota, via 'lode:chiavi'; senza chiave
    // tolta resta undefined), poi sostituisci() tiene la chiave di D, ormai vuota, e salva() toglie anche 'lode:chiave'
    if (azione === 'azzera') { if (!confirm('Cancellare tutti i dati di Lode da questo browser? Prima conviene esportarli.')) return false;
      const tolta = AI.FORNITORI[AI.scollegaFornitore()]; sostituisci(VUOTO());
      toast(tolta ? `Dati cancellati, anche la chiave di ${tolta.nome}: revocala anche nel tuo account (${tolta.sito})` : 'Dati cancellati'); return; }
    Object.assign(D.profilo, { nome: String(f.get('nome')).trim(), corso: String(f.get('corso')).trim(), cfuTotali: +f.get('cfuTotali'), lode: +f.get('lode') });
    const chiave = String(f.get('chiave')).trim(), forn = String(f.get('fornitore') || '');
    Object.assign(D.imp, { focus: Math.max(5, +f.get('focus') || 25), pausa: Math.max(1, +f.get('pausa') || 5), suoni: !!f.get('suoni'), voceAlta: !!f.get('voceAlta'), aspetto: f.get('chiaro') ? 'chiaro' : 'scuro' });
    const tolta = !forn || !chiave ? AI.FORNITORI[AI.scollegaFornitore()] : null;   // la chiave si cancella davvero da qui
    salva(); applicaAspetto(); toast(tolta ? `Chiave di ${tolta.nome} cancellata da qui: revocala anche nel tuo account (${tolta.sito})` : 'Impostazioni salvate');
    if (forn && chiave) AI.provaFornitore(forn, chiave).then(r => { AI.collegaFornitore(forn, chiave, r.modello); salva(); toast(`${AI.FORNITORI[forn].nome} collegata${r.modello ? ' · ' + r.modello : ''}`); })
      .catch(e => toast(e.status === 401 || e.status === 403 ? 'La chiave non è valida' : 'Non riesco a verificare la chiave adesso'));
  });
  d.querySelector('[name=nome]').focus();
}
export function applicaAspetto() { document.documentElement.dataset.aspetto = D.imp.aspetto === 'chiaro' ? 'chiaro' : 'scuro'; }

function scarica() {
  const b = new Blob([JSON.stringify(esporta(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `lode-${oggi()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup scaricato');
}
function importa() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.addEventListener('change', async () => {
    try { const d = JSON.parse(await i.files[0].text()); if (!backupValido(d)) throw 0; if (!confirm('Sostituire i dati attuali con questo backup?')) return; sostituisci(d); toast('Backup importato'); }
    catch { toast('Questo file non è un backup di Lode'); }
  }); i.click();
}

export function collega() {
  document.addEventListener('click', e => {
    const b = e.target.closest('main [data-a]'); if (!b || b.disabled) return;
    const id = b.dataset.e || null;
    ({
      impostazioni: finestraImpostazioni, esporta: scarica, importa, nuovoEsame: () => finestraEsame(null), modifica: () => finestraEsame(id),
      nuovoVoto: () => azioni.scrivi('ho preso '), esempio: () => dispatchEvent(new CustomEvent('lode:esempio')),
      focus: () => azioni.focus(id), ripassaE: () => azioni.ripassa(id || null), ripassa: () => azioni.ripassa(null), interroga: () => azioni.interroga(id), file: () => azioni.file(),
    })[b.dataset.a]?.();
  });
  addEventListener('lode:esempio', () => {
    if (D.esami.length && !confirm('Caricare i dati di esempio al posto dei tuoi?')) return;
    sostituisci(esempio()); azioni.home(); toast('Dati di esempio caricati: passa sopra la barra in alto');
  });
  let attesa = 0;
  addEventListener('lode:dati', () => { cancelAnimationFrame(attesa); attesa = requestAnimationFrame(disegna); });
  addEventListener('lode:focus', e => { if (e.detail.evento === 'fine' || e.detail.evento === 'fermo') disegna(); });
  // a mezzanotte cambia il giorno: i conteggi si aggiornano
  setInterval(() => { if (disegna._giorno !== oggi()) { disegna._giorno = oggi(); disegna(); } }, 60e3); disegna._giorno = oggi();
}
