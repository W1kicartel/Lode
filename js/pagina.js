// La pagina sotto la barra: il quadro della carriera a colpo d'occhio. Media, base di laurea, CFU, ore della settimana,
// i prossimi appelli con il piano, il libretto e i mazzi del ripasso. Tutto il resto si fa dalla barra in alto.
import { D, DESKTOP, VUOTO, backupValido, cambiaSistema, aggiungiCarta, aggiungiEsame, cfuFatti, dataBreve, dataLunga, daFare, daRipassare, esame, esempio, esc, esporta, fatti, giorniTra, media, minuti, num, obiettivo, oggi, ore, piano, prossimi, salva, serie, settimana, sostituisci, traQuanto } from './dati.js';
import { azioni, TASTI } from './lode.js';
import { conta, tween } from './motore.js';
import * as AI from './ai.js';
import * as PG from './programma.js';
import * as F from './focus.js';
import { t, elenco, LINGUE, lingua, imposta } from './lingua.js';
import { CODICI, SISTEMI, nomeSistema, opzioniTotali } from './sistemi.js';
import * as LB from './libretto.js';

const $ = (s, r = document) => r.querySelector(s);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const GEMMA = '<svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="M0,-44 Q4,-44 7,-41 L41,-7 Q44,-4 44,0 Q44,4 41,7 L7,41 Q4,44 0,44 Q-4,44 -7,41 L-41,7 Q-44,4 -44,0 Q-44,-4 -41,-7 L-7,-41 Q-4,-44 0,-44 Z" fill="currentColor"/></svg>';

export function toast(t) { const el = $('.toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2400); }
function saluto() { const n = String(D.profilo.nome || '').trim().split(/\s+/)[0], o = new Date().getHours(); const s = t(o < 5 ? 'pagina.saluto-notte' : o < 13 ? 'pagina.saluto-mattina' : o < 18 ? 'pagina.saluto-pomeriggio' : 'pagina.saluto-sera'); return n ? t('pagina.saluto-con-nome', { saluto: s, nome: n }) : t('pagina.saluto-senza-nome', { saluto: s }); }

let primaVolta = true;
export function disegna() {
  const m = media(), cf = cfuFatti(), tot = D.profilo.cfuTotali, sett = settimana(), minS = sett.reduce((s, g) => s + g.min, 0), maxS = Math.max(60, ...sett.map(g => g.min));
  const p = prossimi(), senza = daFare().filter(e => !e.data), c = daRipassare().length, sr = serie();
  const sotto = [p[0] ? t('pagina.sotto-esame', { nome: p[0].nome, quando: traQuanto(p[0].data) }) : null, c ? t('pagina.sotto-carte', { n: c }) : null, sr ? t('pagina.sotto-serie', { n: sr }) : null].filter(Boolean).join(' · ') || (D.esami.length ? t('pagina.sotto-niente') : t('pagina.sotto-vuoto'));
  const main = $('main');
  main.innerHTML = `
  <header class="testata"><div class="marchio">${GEMMA}Lode<small>${esc(D.profilo.corso || t('pagina.sottotitolo'))}</small></div>
    <nav><button class="btn piano small" data-a="esporta">${t('pagina.esporta')}</button><button class="btn small" data-a="impostazioni">${t('pagina.impostazioni')}</button></nav></header>
  <div class="saluto ${primaVolta ? 'entra' : ''}"><h1>${esc(saluto())}</h1><p>${esc(sotto)}</p>
    <div class="suggerimento">${t('pagina.suggerimento', { tasti: TASTI })}</div></div>

  <div class="stats ${primaVolta ? 'entra' : ''}">
    <div class="stat"><span class="lbl">${t('pagina.media-ponderata')}</span><b class="v" data-c="${esc(m.ponderata ?? '')}" data-dec="2">${m.ponderata ? '0' : '—'}</b><span class="d">${m.n ? t('pagina.media-dettaglio', { media: esc(num(m.aritmetica, 2)), n: esc(m.n) }) : t('pagina.primo-voto')}</span></div>
    ${LB.italiano() ? `<div class="stat"><span class="lbl">${t('pagina.base-laurea')}</span><b class="v"><span data-c="${esc(m.base ?? '')}" data-dec="1">${m.base ? '0' : '—'}</span><small>/110</small></b><span class="d">${t('pagina.base-formula')}</span></div>`
    : `<div class="stat"><span class="lbl">${esc(LB.nomeFinale())}</span><b class="v">${esc(LB.finaleBreve().v)}${LB.finaleBreve().dett ? `<small>${esc(LB.finaleBreve().dett)}</small>` : ''}</b><span class="d">${t('libretto.formula', { crediti: esc(LB.crediti()) })}</span></div>`}
    <div class="stat"><span class="lbl">${t('pagina.crediti')}</span><b class="v"><span data-c="${esc(cf)}" data-dec="0">0</span><small>/${esc(tot)}</small></b><div class="barra"><i style="transform:scaleX(0)" data-x="${esc(Math.min(1, cf / tot))}"></i></div><span class="d">${LB.italiano() ? t('pagina.cfu-alla-laurea', { n: esc(Math.max(0, tot - cf)) }) : t('libretto.alla-laurea', { n: esc(Math.max(0, tot - cf)), crediti: esc(LB.crediti()) })}</span></div>
    <div class="stat"><span class="lbl">${t('pagina.questa-settimana')}</span><b class="v" style="font-size:28px">${esc(ore(minS))}</b>
      <div class="sett" aria-label="${t('pagina.minuti-settimana')}">${sett.map(g => `<span class="${g.oggi ? 'oggi' : ''}" title="${t('pagina.giorno-ore', { giorno: esc(dataLunga(g.g)), ore: esc(ore(g.min)) })}"><i style="height:${Math.max(2, Math.round(g.min / maxS * 32))}px;transform:scaleY(0)"></i><em>${elenco('pagina.iniziali-giorni')[new Date(g.g + 'T12:00').getDay()]}</em></span>`).join('')}</div></div>
  </div>

  <section><div class="capo"><h2>${t('pagina.prossimi-esami')}</h2><div class="az"><button class="btn small" data-a="nuovoEsame">${t('pagina.nuovo-esame')}</button></div></div>
    <div class="griglia ${primaVolta ? 'entra' : ''}">${p.map(cartaEsame).join('')}${senza.map(cartaEsame).join('')}
      ${!p.length && !senza.length ? `<div class="esame nuovo"><p>${t('pagina.vuoto-scrivi')}</p><p><code>${t('pagina.vuoto-comando')}</code></p><p style="margin-top:10px">${t('pagina.vuoto-oppure', { bottone: `<button class="btn small" data-a="esempio">${t('pagina.prova-esempio')}</button>` })}</p></div>` : ''}</div></section>

  <div class="due">
    <section><div class="capo"><h2>${t('pagina.libretto')}</h2><div class="az"><button class="btn small" data-a="nuovoVoto">${t('pagina.segna-voto')}</button></div></div>
      <div class="blocco">${libretto()}</div></section>
    <section><div class="capo"><h2>${t('pagina.ripasso')}</h2><div class="az"><button class="btn small piano" data-a="file">${t('pagina.da-file')}</button><button class="btn small" data-a="ripassa"${c ? '' : ' disabled'}>${t('pagina.ripassa-n', { n: c || '' })}</button></div></div>
      <div class="blocco mazzi">${mazzi()}</div></section>
  </div>

  <footer class="piede"><span>${t('pagina.piede')}</span>
    <span><button data-a="importa">${t('pagina.importa-backup')}</button> · <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a></span></footer>`;
  anima(main, primaVolta); primaVolta = false;
}
// il programma d'esame sulla carta dell'esame: quanto è pronto e cosa c'è oggi nel piano
function rigaProgramma(e) {
  const o = PG.oggiDi(e);
  if (!o) return `<button class="programma vuoto" data-a="programma" data-e="${esc(e.id)}">${t('pagina.programma-aggiungi')}</button>`;
  const oggiT = o.tipo === 'cuscinetto' ? t('pagina.giorno-cuscinetto') : o.tipo === 'generale' ? t('pagina.ripasso-generale') : [...o.studia, ...o.ripassa].map(c => c.a.t).join(' · ') || t('pagina.niente-di-nuovo');
  return `<button class="programma" data-a="programma" data-e="${esc(e.id)}"><span class="cop">${o.cop.map(c => `<i class="s${c.stato}"></i>`).join('')}</span><span class="t">${t('pagina.programma-pronto', { pct: esc(Math.round(PG.pronto(o.cop) * 100)), oggi: esc(oggiT) })}</span></button>`;
}
function cartaEsame(e) {
  const pi = piano(e), g = e.data ? giorniTra(oggi(), e.data) : null, nc = D.carte.filter(c => c.esameId === e.id).length, nd = daRipassare(e.id).length;
  return `<article class="esame${g != null && g <= 7 ? ' vicino' : ''}">
    <div class="r1"><div><h3>${esc(e.nome)}</h3><div class="quando">${t('pagina.quando-cfu', { quando: e.data ? esc(cap(dataLunga(e.data))) : t('pagina.data-da-decidere'), cfu: esc(e.cfu) })}</div></div>
      ${g != null ? `<div class="g">${g === 0 ? t('comune.oggi') : esc(g)}${g ? `<small>${t('pagina.giorni-maiuscolo', { n: g })}</small>` : ''}</div>` : ''}</div>
    <div class="avanza"><div class="riga"><span>${t('pagina.ore-studiate', { fatte: pi.fatte < .05 ? '0' : esc(num(pi.fatte, pi.fatte < 10 ? 1 : 0)), tot: esc(pi.tot) })}</span><span>${e.data ? (pi.oggi >= .1 ? t('pagina.ore-oggi', { h: esc(num(pi.oggi)) }) : t('pagina.oggi-in-pari')) : ''}</span></div><div class="q"><i style="transform:scaleX(0)" data-x="${esc(pi.quota)}"></i></div></div>
    <div class="az"><button class="btn small primary" data-a="focus" data-e="${esc(e.id)}">${t('pagina.focus')}</button><button class="btn small" data-a="ripassaE" data-e="${esc(e.id)}"${nc ? '' : ' disabled'}>${nd ? t('pagina.ripassa-n', { n: nd }) : t('pagina.ripassa')}</button><button class="btn small" data-a="interroga" data-e="${esc(e.id)}">${t('pagina.interrogami')}</button></div>
    ${rigaProgramma(e)}
    <button class="modifica" data-a="modifica" data-e="${esc(e.id)}">${t('pagina.modifica-segna-voto')}</button>
  </article>`;
}
function libretto() {
  const lista = fatti().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  if (!lista.length) return `<p style="margin:0;padding:18px 16px;color:var(--muted);font-size:14px">${LB.italiano() ? t('pagina.libretto-vuoto') : t('libretto.libretto-vuoto', { voto: esc(LB.votoEsempio()) })}</p>`;
  const m = media();
  if (!LB.italiano()) return librettoSistema(lista);
  return `<table><thead><tr><th>${t('pagina.col-esame')}</th><th class="num">${t('pagina.col-cfu')}</th><th class="num">${t('pagina.col-voto')}</th><th class="num">${t('pagina.col-data')}</th><th></th></tr></thead><tbody>
    ${lista.map(e => `<tr><td>${esc(e.nome)}</td><td class="num">${esc(e.cfu)}</td><td class="num"><span class="voto">${e.idoneita ? `<span class="tenue">${t('pagina.idoneo')}</span>` : LB.altroSistema(e) ? `<span class="tenue">${esc(LB.votoAltro(e))}</span>` : e.lode ? t('pagina.voto-lode', { voto: esc(e.voto) }) : esc(e.voto)}</span></td><td class="num tenue">${e.data ? esc(dataBreve(e.data)) : ''}</td><td class="num"><button class="x" data-a="modifica" data-e="${esc(e.id)}" aria-label="${t('pagina.modifica-esame', { nome: esc(e.nome) })}">⋯</button></td></tr>`).join('')}
  </tbody></table><div class="tbl-piede"><span>${t('pagina.libretto-esami', { n: esc(lista.length), cfu: esc(cfuFatti()) })}</span><span>${t('pagina.libretto-media', { media: m.ponderata ? esc(num(m.ponderata, 2)) : '—', base: m.base ? esc(num(m.base, 1)) : '—' })}</span></div>`;
}
// il libretto fuori dall'Italia (js/libretto.js): i voti come si scrivono nel sistema, i crediti col loro nome, il voto finale
function librettoSistema(lista) {
  const q = LB.quadro();
  return `<table><thead><tr><th>${t('pagina.col-esame')}</th><th class="num">${esc(q.crediti)}</th><th class="num">${t('pagina.col-voto')}</th><th class="num">${t('pagina.col-data')}</th><th></th></tr></thead><tbody>
    ${lista.map(e => `<tr><td>${esc(e.nome)}</td><td class="num">${esc(LB.numCrediti(e.cfu))}</td><td class="num"><span class="voto">${e.idoneita ? `<span class="tenue">${esc(LB.votoEsame(e))}</span>` : esc(LB.votoEsame(e))}</span></td><td class="num tenue">${e.data ? esc(dataBreve(e.data)) : ''}</td><td class="num"><button class="x" data-a="modifica" data-e="${esc(e.id)}" aria-label="${t('pagina.modifica-esame', { nome: esc(e.nome) })}">⋯</button></td></tr>`).join('')}
  </tbody></table><div class="tbl-piede"><span>${t('libretto.piede-esami', { n: lista.length, cfu: esc(LB.numCrediti(q.cfu)), crediti: esc(q.crediti) })}</span><span>${t('libretto.piede-media', { media: q.m.ponderata != null ? esc(q.media) : '—', finale: esc(q.nomeFinale), valore: esc(q.valore) })}</span></div>`;
}
function mazzi() {
  const gruppi = new Map(); D.carte.forEach(c => { const k = c.esameId || ''; gruppi.set(k, (gruppi.get(k) || 0) + 1); });
  if (!gruppi.size) return `<p style="margin:0;padding:18px 16px;color:var(--muted);font-size:14px">${t('pagina.mazzi-vuoto')}</p>`;
  return [...gruppi].sort((a, b) => b[1] - a[1]).map(([k, n]) => { const d = daRipassare(k || undefined).filter(c => (c.esameId || '') === k).length; return `<div class="mazzo"><div><b>${esc(k ? esame(k)?.nome || t('pagina.esame-tolto') : t('pagina.senza-esame'))}</b><span>${t('pagina.n-carte', { n: esc(n) })}</span></div><span class="n${d ? '' : ' zero'}" title="${t('pagina.da-ripassare-oggi')}">${esc(d)}</span><button class="btn small" data-a="ripassaE" data-e="${esc(k)}"${d ? '' : ' disabled'}>${t('pagina.ripassa')}</button></div>`; }).join('');
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
  finestra(`<h2>${e ? esc(e.nome) : t('pagina.nuovo-esame')}</h2><p>${e ? t('pagina.esame-correggi') : t('pagina.esame-aiuto')}</p>
    <div class="campi"><label class="tutta">${t('pagina.campo-nome')}<input name="nome" required value="${esc(e?.nome || '')}" placeholder="${t('pagina.esempio-esame')}"></label>
      ${LB.italiano() ? `<label>${t('pagina.campo-cfu')}<input name="cfu" type="number" min="1" max="30" value="${esc(e?.cfu || 6)}"></label>` : `<label>${t('libretto.campo-crediti', { crediti: esc(LB.crediti()) })}<input name="cfu" type="number" min="1" max="60" step="any" value="${esc(e?.cfu || LB.sis().esame)}"></label>`}
      <label>${e?.fatto ? t('pagina.campo-data') : t('pagina.campo-data-appello')}<input name="data" type="date" value="${esc(e?.data || '')}"></label>
      ${!LB.italiano() ? `<label>${t('pagina.campo-voto')} <small>${t('libretto.campo-voto-nota', { esempio: esc(LB.votoEsempio()) })}</small><input name="voto" value="${esc(e?.fatto && (e.voto != null || e.idoneita) ? (LB.altroSistema(e) ? LB.votoScritto(e) : LB.votoEsame(e)) : '')}" placeholder="${esc(LB.votoEsempio())}" autocomplete="off"></label>` : ''}
      ${LB.italiano() ? `<label>${t('pagina.campo-voto')} <small>${t('pagina.campo-voto-nota')}</small><select name="voto"><option value="">—</option>${Array.from({ length: 13 }, (_, i) => 18 + i).map(v => `<option${e?.voto === v ? ' selected' : ''}>${v}</option>`).join('')}<option value="L"${e?.lode ? ' selected' : ''}>${t('pagina.trenta-e-lode')}</option><option value="I"${e?.idoneita ? ' selected' : ''}>${t('pagina.idoneita')}</option>${LB.altroSistema(e) ? `<option value="X" selected>${esc(LB.votoAltro(e))}</option>` : ''}</select></label>` : ''}
      <label>${t('pagina.campo-ore')} <small>${t('pagina.campo-ore-nota')}</small><input name="ore" type="number" min="1" max="500" value="${esc(e ? obiettivo(e) : '')}" placeholder="${t('pagina.ore-segnaposto')}"></label></div>
    <div class="piedi">${e ? `<button class="btn piano" value="elimina">${t('pagina.elimina')}</button>` : ''}<div class="dx"><button class="btn piano" value="annulla" formnovalidate>${t('pagina.annulla')}</button><button class="btn primary" value="salva">${t('pagina.salva')}</button></div></div>`,
  (f, azione) => {
    if (azione === 'elimina') { if (!confirm(t('pagina.conferma-elimina', { nome: e.nome }))) return false; D.esami = D.esami.filter(x => x.id !== e.id); salva(); toast(t('pagina.esame-eliminato')); return; }
    if (!LB.italiano()) return salvaEsameSistema(e, f);
    const v = f.get('voto'), x = e || aggiungiEsame({ nome: f.get('nome'), cfu: +f.get('cfu') });
    // «X»: il voto scritto con un altro sistema resta com'è (non si perde correggendo il nome o la data)
    Object.assign(x, { nome: String(f.get('nome')).trim(), cfu: +f.get('cfu') || 6, data: f.get('data') || null, oreObiettivo: f.get('ore') ? +f.get('ore') : null,
      ...(v === 'X' ? {} : { voto: v === 'L' ? 30 : v && v !== 'I' ? +v : null, lode: v === 'L', idoneita: v === 'I', fatto: !!v }) });
    if (v !== 'X') delete x.sistema;
    if (x.fatto && !x.data) x.data = oggi();
    salva(); toast(e ? t('pagina.salvato') : t('pagina.esame-aggiunto'));
  });
}
// salva l'esame della finestra fuori dall'Italia: il voto scritto si legge nel sistema dei voti (8,5 · 16/20 · 2,3 · A− · idoneo)
function salvaEsameSistema(e, f) {
  const scritto = String(f.get('voto') || '').trim();
  // il voto scritto con un altro sistema, lasciato com'era: resta com'è
  const resta = e && LB.altroSistema(e) && scritto === LB.votoScritto(e), r = scritto && !resta ? LB.leggiVoto(scritto) : null;
  if (scritto && !r && !resta) { toast(t('libretto.voto-non-letto', { voto: scritto, esempio: LB.votoEsempio() })); return false; }
  const x = e || aggiungiEsame({ nome: f.get('nome'), cfu: +f.get('cfu') || LB.sis().esame });
  Object.assign(x, { nome: String(f.get('nome')).trim(), cfu: +f.get('cfu') || LB.sis().esame, data: f.get('data') || null, oreObiettivo: f.get('ore') ? +f.get('ore') : null,
    ...(resta ? {} : { voto: r && !r.idoneita ? r.voto : null, lode: !!r?.lode, idoneita: !!r?.idoneita, fatto: !!r }) });
  if (!resta) delete x.sistema;
  if (x.fatto && !x.data) x.data = oggi();
  salva(); toast(e ? t('pagina.salvato') : t('pagina.esame-aggiunto'));
}
function finestraImpostazioni() {
  const d = finestra(`<h2>${t('pagina.impostazioni')}</h2><p>${t('pagina.impostazioni-aiuto')}</p>
    <div class="campi"><label>${t('pagina.campo-tuo-nome')}<input name="nome" value="${esc(D.profilo.nome)}" placeholder="${t('pagina.esempio-nome')}"></label>
      <label>${t('pagina.campo-corso')}<input name="corso" value="${esc(D.profilo.corso)}" placeholder="${t('pagina.esempio-corso')}"></label>
      <label>${t('pagina.campo-cfu-laurea')}<select name="cfuTotali">${(LB.italiano() ? [180, 120, 300, 360] : LB.opzioniTotali()).map(v => `<option${D.profilo.cfuTotali === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label${LB.italiano() ? '' : ' hidden'}>${t('pagina.campo-lode-vale')}<select name="lode">${[30, 31, 32, 33].map(v => `<option${D.profilo.lode === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>${t('impostazioni.lingua')}<select name="lingua">${Object.entries(LINGUE).map(([c, l]) => `<option value="${c}"${c === lingua ? ' selected' : ''}>${esc(l.nome)}</option>`).join('')}</select></label>
      <label>${t('sistemi.scelta')} <small>${t('impostazioni.sistema-nota')}</small><select name="sistema">${CODICI.map(c => `<option value="${c}"${(D.profilo.sistema || 'it') === c ? ' selected' : ''}>${esc(nomeSistema(c))}</option>`).join('')}</select></label>
      <label>${t('pagina.campo-focus')}<input name="focus" type="number" min="5" max="180" value="${esc(D.imp.focus)}"></label>
      <label>${t('pagina.campo-pausa')}<input name="pausa" type="number" min="1" max="60" value="${esc(D.imp.pausa)}"></label>
      <label class="spunta tutta"><input type="checkbox" name="suoni"${D.imp.suoni ? ' checked' : ''}>${t('pagina.rintocco')}</label>
      <label class="spunta tutta"><input type="checkbox" name="chiaro"${D.imp.aspetto === 'chiaro' ? ' checked' : ''}>${t('pagina.aspetto-chiaro')}</label></div>
    <hr>
    <div class="campi"><label>${t('pagina.campo-ai')} <small>${t('pagina.campo-ai-nota')}</small><select name="fornitore"><option value="">${t('pagina.solo-locale')}</option>${Object.entries(AI.FORNITORI).map(([k, f]) => `<option value="${esc(k)}"${AI.fornitore() === k ? ' selected' : ''}>${esc(f.nome)} · ${esc(f.ditta)}</option>`).join('')}</select></label>
      <label>${t('pagina.campo-chiave')} <small>${t('pagina.campo-chiave-nota')}</small><input name="chiave" type="password" autocomplete="off" value="${esc(D.imp.chiave)}" placeholder="${t('pagina.chiave-segnaposto')}"></label>
      <label class="spunta tutta"><input type="checkbox" name="voceAlta"${D.imp.voceAlta ? ' checked' : ''}>${t('pagina.voce-alta')}</label></div>
    <p class="stato-ai" style="margin:10px 0 0">${D.imp.chiave ? t('pagina.ai-attiva', { nome: esc(AI.FORNITORI[AI.fornitore()].nome) }) : t('pagina.senza-chiave')}</p>
    <div class="piedi"><button class="btn piano" value="azzera">${t('pagina.cancella-tutto')}</button><div class="dx"><button class="btn piano" value="annulla" formnovalidate>${t('pagina.annulla')}</button><button class="btn primary" value="salva">${t('pagina.salva')}</button></div></div>`,
  (f, azione, dlg) => {
    // «Cancella tutto» cancella anche le chiavi: prima si scollega (D.imp.chiave vuota, via 'lode:chiavi'; senza chiave
    // tolta resta undefined), poi sostituisci() tiene la chiave di D, ormai vuota, e salva() toglie anche 'lode:chiave'
    if (azione === 'azzera') { if (!confirm(t('pagina.conferma-azzera'))) return false;
      const tolta = AI.FORNITORI[AI.scollegaFornitore()]; sostituisci(VUOTO());
      toast(tolta ? t('pagina.dati-cancellati-chiave', { nome: tolta.nome, sito: tolta.sito }) : t('pagina.dati-cancellati')); return; }
    // il sistema nuovo prima (i voti di prima restano col loro sistema, i crediti diventano quelli del sistema), poi i crediti scelti
    const sistema = CODICI.includes(f.get('sistema')) ? f.get('sistema') : 'it'; cambiaSistema(sistema);
    Object.assign(D.profilo, { nome: String(f.get('nome')).trim(), corso: String(f.get('corso')).trim(), cfuTotali: +f.get('cfuTotali'), lode: +f.get('lode'), sistema });
    if (sistema !== 'it') D.profilo.totaliScelti = true;
    const nuova = String(f.get('lingua') || lingua);
    const chiave = String(f.get('chiave')).trim(), forn = String(f.get('fornitore') || '');
    Object.assign(D.imp, { focus: Math.max(5, +f.get('focus') || 25), pausa: Math.max(1, +f.get('pausa') || 5), suoni: !!f.get('suoni'), voceAlta: !!f.get('voceAlta'), aspetto: f.get('chiaro') ? 'chiaro' : 'scuro' });
    const tolta = !forn || !chiave ? AI.FORNITORI[AI.scollegaFornitore()] : null;   // la chiave si cancella davvero da qui
    salva(); applicaAspetto(); toast(tolta ? t('pagina.chiave-cancellata', { nome: tolta.nome, sito: tolta.sito }) : t('pagina.impostazioni-salvate'));
    const prova = !(forn && chiave) ? Promise.resolve() : AI.provaFornitore(forn, chiave).then(r => { AI.collegaFornitore(forn, chiave, r.modello); salva(); toast(r.modello ? t('pagina.ai-collegata-modello', { nome: AI.FORNITORI[forn].nome, modello: r.modello }) : t('pagina.ai-collegata', { nome: AI.FORNITORI[forn].nome })); })
      .catch(e => toast(e.status === 401 || e.status === 403 ? t('pagina.chiave-non-valida') : t('pagina.chiave-non-verificabile')));
    // un'altra lingua: si salva e si ricarica (nell'app tutte le finestre, dal processo principale; nel browser questa
    // pagina), ma dopo la prova della chiave, che altrimenti si perderebbe a metà
    if (nuova !== lingua && Object.hasOwn(LINGUE, nuova)) prova.finally(() => setTimeout(() => { imposta(nuova); if (!DESKTOP) location.reload(); }, 600));
  });
  // un altro sistema scelto qui: i crediti di una laurea del sistema (240 ECTS, 360 credits…) e «la lode vale» solo in Italia
  d.querySelector('[name=sistema]').addEventListener('change', ev => {
    const c = ev.target.value, scelto = c === (D.profilo.sistema || 'it') ? D.profilo.cfuTotali : SISTEMI[c]?.totali;
    d.querySelector('[name=cfuTotali]').innerHTML = opzioniTotali(c, scelto).map(v => `<option${scelto === v ? ' selected' : ''}>${v}</option>`).join('');
    d.querySelector('[name=lode]').closest('label').hidden = c !== 'it';
  });
  d.querySelector('[name=nome]').focus();
}
export function applicaAspetto() { document.documentElement.dataset.aspetto = D.imp.aspetto === 'chiaro' ? 'chiaro' : 'scuro'; }

function scarica() {
  const b = new Blob([JSON.stringify(esporta(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `lode-${oggi()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(t('pagina.backup-scaricato'));
}
function importa() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.addEventListener('change', async () => {
    try { const d = JSON.parse(await i.files[0].text()); if (!backupValido(d)) throw 0; if (!confirm(t('pagina.conferma-importa'))) return; sostituisci(d); toast(t('pagina.backup-importato')); }
    catch { toast(t('pagina.non-backup')); }
  }); i.click();
}

export function collega() {
  document.addEventListener('click', e => {
    const b = e.target.closest('main [data-a]'); if (!b || b.disabled) return;
    const id = b.dataset.e || null;
    ({
      impostazioni: finestraImpostazioni, esporta: scarica, importa, nuovoEsame: () => finestraEsame(null), modifica: () => finestraEsame(id),
      nuovoVoto: () => azioni.scrivi('ho preso '), esempio: () => dispatchEvent(new CustomEvent('lode:esempio')),
      focus: () => azioni.focus(id), ripassaE: () => azioni.ripassa(id || null), ripassa: () => azioni.ripassa(null), interroga: () => azioni.interroga(id), programma: () => azioni.programma(id), file: () => azioni.file(),
    })[b.dataset.a]?.();
  });
  addEventListener('lode:esempio', () => {
    if (D.esami.length && !confirm(t('pagina.conferma-esempio'))) return;
    sostituisci(esempio()); azioni.home(); toast(t('pagina.esempio-caricato'));
  });
  let attesa = 0;
  addEventListener('lode:dati', () => { cancelAnimationFrame(attesa); attesa = requestAnimationFrame(disegna); });
  addEventListener('lode:focus', e => { if (e.detail.evento === 'fine' || e.detail.evento === 'fermo') disegna(); });
  // a mezzanotte cambia il giorno: i conteggi si aggiornano
  setInterval(() => { if (disegna._giorno !== oggi()) { disegna._giorno = oggi(); disegna(); } }, 60e3); disegna._giorno = oggi();
}
