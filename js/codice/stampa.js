// «Cosa stampa?»: la scheda con 5 domande di C, Java o Python (la lingua dal nome del corso, o detta nel comando). Il codice lo genera Lode, la risposta la calcola esegui() (albero.js),
// le opzioni sbagliate sono gli errori tipici (i mutanti di modelli.js). Niente AI: la spiegazione è la frase del mutante.
// Lo scheletro è quello di schedaGioco in lode.js (capo, ld-prog, manche, ld-esito). Gli attrezzi di lode.js arrivano da
// collega({ scheda, segnala, entra, tween, dopo, rispostaFissa, ricorda, codice, … }): qui non si importa niente dell'interfaccia,
// così il file si carica anche in Node (le funzioni pure si provano in test/codice.mjs).
import { MODELLI, CONCETTI, MUTANTI, istanza, vista, inLinea, compatta, creaRng, mescola, modelliPer } from './modelli.js';
import { normalizza, NOMI_LINGUE } from './albero.js';
import { t } from '../lingua.js';

export const CHIAVE = c => 'stampa|' + c;           // la chiave SM-2 di un concetto in D.codice.memoria
const due = n => String(n).padStart(2, '0');
export const oggiIso = (d = new Date()) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// `codice` tra backtick diventa <code>
const inline = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>');
const minuscola = s => /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

// i corsi di programmazione (stessa regola di F1 per l'allenatore e per il bottone «Codice»)
// «laboratorio» da solo no: «Laboratorio di chimica» non è un corso di programmazione. «Lab di C», «Laboratorio di Python» sì
// Anche un corso che nomina Python o Java («Fondamenti di Java»): «JavaScript» no
export const RE_PROGRAMMAZIONE = /programmazione|informatica|algoritm|\blab(?:oratorio)?\s+(?:di\s+)?(?:c|python|java)\b|\bpython\b|\bjava\b/i;
export const corsoProgrammazione = nomi => (nomi || []).find(n => RE_PROGRAMMAZIONE.test(String(n || ''))) || '';
// la lingua degli esercizi dal nome del corso: «Programmazione in Python» → 'python', «Fondamenti di Java» → 'java'. Se non si capisce, C
export const linguaDi = nome => { const t = String(nome || ''); return /\bpython\b/i.test(t) ? 'python' : /\bjava\b/i.test(t) ? 'java' : 'c'; };
export const nomeLingua = l => NOMI_LINGUE[l] || 'C';

/* ---------- la scelta delle domande (puro) ---------- */
// i concetti già visti con la scadenza SM-2 arrivata (oggi compreso), dal più vecchio
export function scaduti(memoria = {}, oggi = oggiIso()) {
  return Object.keys(CONCETTI).map(c => [c, memoria?.[CHIAVE(c)]]).filter(([, m]) => m?.scad && m.scad <= oggi)
    .sort((a, b) => a[1].scad.localeCompare(b[1].scad)).map(([c]) => c);
}
// 5 modelli: prima quelli con un concetto scaduto, poi quelli mai visti, poi a caso. Due dello stesso argomento solo se servono
export function scegliModelli({ memoria = {}, n = 5, seme = 1, oggi = oggiIso(), modelli = MODELLI } = {}) {
  const r = creaRng(seme), scad = new Map(scaduti(memoria, oggi).map((c, i) => [c, i]));
  const prima = m => Math.min(...m.concetti.map(c => scad.has(c) ? scad.get(c) : Infinity));
  const misti = mescola(r, modelli);
  const gruppi = [
    misti.filter(m => prima(m) < Infinity).sort((a, b) => prima(a) - prima(b)),
    misti.filter(m => prima(m) === Infinity && m.concetti.every(c => !memoria?.[CHIAVE(c)])),
    misti.filter(m => prima(m) === Infinity && m.concetti.some(c => memoria?.[CHIAVE(c)])),
  ];
  const ordine = gruppi.flat(), scelti = [], visti = new Set();
  for (const m of ordine) { if (scelti.length >= n) break; if (!visti.has(m.concetti[0])) { scelti.push(m); visti.add(m.concetti[0]); } }
  for (const m of ordine) { if (scelti.length >= n) break; if (!scelti.includes(m)) scelti.push(m); }
  return scelti;
}
// le domande pronte: un'istanza per modello, ognuna col suo seme
// lingua: 'c' (di solito), 'java' o 'python': solo i modelli che in quella lingua si scrivono fedeli
export function preparaManche({ memoria = {}, n = 5, seme = 1, oggi = oggiIso(), lingua = 'c', modelli = modelliPer(lingua) } = {}) {
  const lista = scegliModelli({ memoria, n: modelli.length, seme, oggi, modelli }), out = [];
  for (const [k, m] of lista.entries()) {
    if (out.length >= n) break;
    const ist = istanza(m, (seme + 7919 * (k + 1)) >>> 0, { lingua });
    if (ist) out.push(ist);
  }
  return out;
}
// il testo della proposta nella pillola: «Cosa stampa questo for?». Con lo stesso seme, schedaStampa parte proprio da quel modello
export function anteprima({ memoria = {}, seme = 1, oggi = oggiIso(), lingua = 'c' } = {}) {
  const m = scegliModelli({ memoria, n: 1, seme, oggi, modelli: modelliPer(lingua) })[0];
  return m ? { modello: m.id, testo: t('stampa.anteprima', { cosa: m.cosa }) } : null;
}
// una risposta: { indice } (0, 1, 2, 3 nelle opzioni) oppure { testo } (scritta)
export function valuta(ist, risposta = {}) {
  const giusta = vista(ist.giusta);
  if (risposta.indice != null) {
    const o = ist.opzioni[risposta.indice];
    if (!o) return { ok: false, mutante: null, frase: t('stampa.risposta-assente'), giusta, scelta: '' };
    return { ok: !!o.giusta, mutante: o.giusta ? null : o.mutante, frase: o.giusta ? '' : o.frase, giusta, scelta: vista(o.uscita) };
  }
  const sc = compatta(risposta.testo);
  if (sc === compatta(ist.giusta)) return { ok: true, mutante: null, frase: '', giusta, scelta: sc };
  const d = ist.distrattori.find(x => compatta(x.uscita) === sc);
  if (d) return { ok: false, mutante: d.mutante, frase: d.scritta ?? d.frase, giusta, scelta: sc };   // «Hai scritto…» (istanza() in modelli.js)
  return { ok: false, mutante: null, frase: sc ? t('stampa.hai-scritto-altro', { uscita: sc }) : t('stampa.nessuna-risposta'), giusta, scelta: sc };
}

/* ---------- la scheda ---------- */
let H = {}, ULTIMA = null;
// gli attrezzi di lode.js. Obbligatori: scheda, entra, tween, dopo. Gli altri sono facoltativi:
// segnala(evento), rispostaFissa(testo), ricorda(chiave, ok, q) (SM-2 su D.codice.memoria), codice() → D.codice,
// registra(evento) (altrimenti l'evento va in codice().eventi), allaFine({ punti, tot, deboli }) (salva, vault),
// ricomincia(testo) (nuovo turno per «Ancora una»), aperto() → la barra è aperta?, errori (gli id che contano in D.codice.errori)
export function collega(h = {}) { H = { ...H, ...h }; }
// la domanda sullo schermo, per le prove: { modello, giusta, indice (1-4, null se si scrive), scrivi, codice }
export const ultima = () => ULTIMA;

const righeCodice = (c, l) => `<pre class="ld-codice" aria-label="${t('stampa.aria-codice', { lingua: nomeLingua(l) })}"><code>${c.split('\n').map((r, k) => `<span class="r"><i>${k + 1}</i>${esc(r) || ' '}</span>`).join('')}</code></pre>`;

function registraRisposta(ist, r, modo, corso) {
  const q = r.ok ? (modo === 'scritta' ? 5 : 4) : 0;
  for (const c of ist.concetti) H.ricorda?.(CHIAVE(c), r.ok, q);
  const cod = H.codice?.(), contati = H.errori || MUTANTI;
  if (!r.ok && r.mutante && cod && Object.hasOwn(contati, r.mutante)) { cod.errori ||= {}; cod.errori[r.mutante] = (Number(cod.errori[r.mutante]) || 0) + 1; }
  const ev = { tipo: 'stampa', concetto: ist.concetti[0], concetti: [...ist.concetti], ok: r.ok, modello: ist.modello, modo };
  if (corso) ev.corso = corso;
  if (!r.ok && r.mutante) ev.mutante = r.mutante;
  if (H.registra) H.registra(ev);
  else if (cod) { ev.t = Date.now(); (cod.eventi ||= []).push(ev); if (cod.eventi.length > 2000) cod.eventi.splice(0, cod.eventi.length - 2000); }
}

// lingua: quella detta nel comando («cosa stampa python»), altrimenti quella del corso, altrimenti C
export function schedaStampa({ corso = '', n = 5, seme, lingua } = {}) {
  if (!H.scheda || !H.tween || !H.dopo) throw new Error('stampa.js: prima collega({ scheda, entra, tween, dopo, … })');
  const memoria = H.codice?.()?.memoria || {};
  const s0 = seme ?? ((Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0);
  const ling = NOMI_LINGUE[lingua] ? lingua : linguaDi(corso);
  const manche = preparaManche({ memoria, n, seme: s0, oggi: oggiIso(), lingua: ling });
  if (!manche.length) { H.rispostaFissa?.(t('stampa.non-riesco', { lingua: nomeLingua(ling) })); return null; }
  const s = H.scheda('ld-gioco ld-stampa', `<div class="capo"><span class="ld-lbl">${t('stampa.titolo')} · ${nomeLingua(ling)}${corso ? ' · ' + esc(corso) : ''}</span><span class="conto"></span></div><i class="ld-prog"><i></i></i><div class="manche"></div>`);
  const box = s.querySelector('.manche'), conto = s.querySelector('.conto'), pr = s.querySelector('.ld-prog i');
  const turno = s.parentElement;
  let i = 0, punti = 0, stato = null; const t0 = Date.now(), deboli = [];
  const entra = (el, o) => H.entra?.(el, o);
  const scuoti = el => H.tween(260, e => { el.style.transform = e >= 1 ? '' : `translateX(${(Math.sin(e * Math.PI * 4) * 4 * (1 - e)).toFixed(2)}px)`; }, { ease: x => x });

  // i tasti: 1-4 scelgono, Invio o Spazio vanno avanti. Solo finché la scheda è quella viva
  const tasti = e => {
    if (!s.isConnected || s.closest('.passato')) return stacca();
    if (!stato || (H.aperto && !H.aperto()) || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    const inCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (inCampo) return;
    if (!stato.risposto && !stato.ist.scrivi && /^[1-4]$/.test(e.key)) {
      const k = +e.key - 1; if (k < stato.ist.opzioni.length) { e.preventDefault(); stato.rispondi({ indice: k }, 'scelta'); }
    } else if (stato.risposto && (e.key === 'Enter' || e.code === 'Space')) { e.preventDefault(); stato.avanti(); }
  };
  const stacca = () => removeEventListener('keydown', tasti);
  addEventListener('keydown', tasti);

  const mostra = () => {
    pr.style.transform = `scaleX(${(i / manche.length).toFixed(4)})`;
    if (i >= manche.length) return fine();
    const ist = manche[i];
    conto.textContent = t('stampa.conto', { i: i + 1, n: manche.length });
    ULTIMA = { modello: ist.modello, giusta: vista(ist.giusta), indice: ist.scrivi ? null : ist.opzioni.findIndex(o => o.giusta) + 1, scrivi: ist.scrivi, codice: ist.codice, lingua: ist.lingua };
    box.innerHTML = `<p class="dom">${ist.scrivi ? t('stampa.scrivi-uscita') : t('stampa.scegli-uscita')}</p>${righeCodice(ist.codice, ist.lingua)}${ist.scrivi
      ? `<div class="ld-riga-form ld-scrivi"><input type="text" aria-label="${t('stampa.aria-campo')}" placeholder="${t('stampa.segnaposto')}" autocomplete="off" spellcheck="false"><button type="button" class="btn primary" data-controlla>${t('stampa.controlla')}</button></div><p class="ld-nota">${t('stampa.piu-righe')}</p>`
      : `<div class="ld-scelte ld-uscite">${ist.opzioni.map((o, k) => `<button type="button" class="btn${normalizza(o.uscita) ? '' : ' vuota'}" data-o="${k}" aria-label="${t('stampa.aria-risposta', { n: k + 1, uscita: esc(inLinea(o.uscita)) })}"><kbd>${k + 1}</kbd><span>${esc(vista(o.uscita))}</span></button>`).join('')}</div>`}
      <div class="ld-spiega" hidden></div>`;
    const spiega = box.querySelector('.ld-spiega');
    const st = stato = { ist, risposto: false, passato: false };
    st.avanti = () => {
      if (st.passato) return; st.passato = true; i++;
      H.tween(140, e => { box.style.opacity = (1 - e).toFixed(3); }).then(() => { box.style.opacity = ''; mostra(); });
    };
    st.rispondi = (risposta, modo) => {
      if (st.risposto) return; st.risposto = true;
      const r = valuta(ist, risposta);
      if (r.ok) punti++; else deboli.push(...ist.concetti);
      registraRisposta(ist, r, modo, corso);
      if (!ist.scrivi) box.querySelectorAll('[data-o]').forEach(b => {
        b.disabled = true;
        if (ist.opzioni[+b.dataset.o].giusta) b.classList.add('giusta');
        else if (+b.dataset.o === risposta.indice) { b.classList.add('errata'); scuoti(b); }
      });
      else { const inp = box.querySelector('.ld-scrivi input'); inp.disabled = true; box.querySelector('[data-controlla]').disabled = true; if (!r.ok) scuoti(inp); }
      spiega.hidden = false;
      if (r.ok) {
        spiega.innerHTML = `<p class="ok">${t('stampa.giusto')}</p>`;
        H.segnala?.('fatto'); H.dopo(950, st.avanti);
      } else {
        spiega.innerHTML = `<p>${inline(r.frase)}</p><p class="ld-nota">${t('stampa.stampa-giusta', { uscita: esc(inLinea(ist.giusta)) })} ${inline(ist.concetto)}</p><div class="az"><button type="button" class="btn primary" data-avanti>${i + 1 < manche.length ? t('stampa.avanti') : t('stampa.com-e-andata')}</button></div>`;
        spiega.querySelector('[data-avanti]').addEventListener('click', () => st.avanti());
        H.segnala?.('quiete');
      }
      entra(spiega, { dy: 4, blur: 4, ms: 360 });
    };
    if (ist.scrivi) {
      const inp = box.querySelector('.ld-scrivi input'), via = () => { if (inp.value.trim()) st.rispondi({ testo: inp.value }, 'scritta'); else inp.focus(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); via(); } });
      box.querySelector('[data-controlla]').addEventListener('click', via);
      requestAnimationFrame(() => inp.focus({ preventScroll: true }));
    } else box.querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => st.rispondi({ indice: +b.dataset.o }, 'scelta')));
    entra(box, { dy: 6, blur: 6, ms: 420 });
  };

  const fine = () => {
    stacca(); stato = null;
    const tot = manche.length, nomi = [...new Set(deboli)].slice(0, 3).map(c => minuscola(CONCETTI[c] || c));
    H.allaFine?.({ punti, tot, deboli: [...new Set(deboli)] });
    const sec = Math.round((Date.now() - t0) / 1000);
    box.innerHTML = `<div class="ld-esito"><b>${punti}<small>/${tot}</small></b><span>${punti === tot ? t('stampa.tutte-giuste') : t('stampa.da-rinforzare', { nomi: nomi.map(esc).join(', ') })}</span><small>${sec < 60 ? t('stampa.secondi', { n: sec }) : t('comune.minuti', { m: Math.round(sec / 60) })}</small></div>`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = t('stampa.ancora-una');
    b.addEventListener('click', () => { H.ricomincia?.(t('stampa.ancora-una')); schedaStampa({ corso, n, lingua: ling }); });
    box.querySelector('.ld-esito').append(b);
    entra(box, { dy: 8, blur: 6, ms: 480 }); H.segnala?.(punti >= tot - 1 ? 'confermato' : 'quiete');
    if (turno?.dataset) turno.dataset.sintesi = t('stampa.sintesi', { punti, tot });
  };

  mostra();
  if (turno?.dataset) turno.dataset.sintesi = t('stampa.titolo');
  return s;
}
