// Lode, l'aiutante in cima allo schermo. A riposo è una pillola di vetro nero: il prossimo esame, le carte di oggi
// o il timer che scorre. Passandoci sopra si apre a molla in un pannello: «Oggi», sei strumenti e il campo
// «Chiedi o scrivi un comando…». Si parla tenendo premuto ⌥ Spazio. I file trascinati diventano carte del ripasso.
// Senza AI capisce i comandi in italiano (comandi.js); con la chiave Claude spiega, crea carte e interroga come all'orale.
import { piuGiorni, norm, D, DESKTOP, lezioneOra, prossimaLezione, daGiocare, ricorda, aggiungiOrario, lezioni, RISPOSTE, aggiungiCarta, aggiungiEsame, cfuFatti, dataBreve, dataLunga, daFare, daRipassare, esame, esc, fatti, media, minuti, num, oggi, ore, piano, prossimi, prossimoIntervallo, registraVoto, rispondi, salva, serie, serve, simula, sostituisci, traQuanto, trovaEsame, intervalloTesto, giorniTra } from './dati.js';
import { RIDOTTO, attendi, comprimi, conta, dopo, entra, h, lineare, morbido, ogni, premi, tween } from './motore.js';
import { ESEMPI, interpreta } from './comandi.js';
import * as F from './focus.js';
import * as AI from './ai.js';
import * as Voce from './voce.js';
import { livelloVoce } from './mascotte.js';
import * as V from './vault.js';
import { partita, giusta } from './giochi.js';
import { GIORNI_BREVI } from './markdown.js';
import * as TR from './trascrizione.js';
import * as O from './orecchio.js';
import * as FILE from './file.js';
import * as SB from './sbobina.js';
import { parlatoInFormule } from './formule.js';
import { pulito } from './markdown.js';
const BRIDGE = DESKTOP ? window.lodeDesktop : null;

const segnala = (evento, x = {}) => dispatchEvent(new CustomEvent('lode', { detail: { evento, ...x } }));
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const TASTI = MAC ? '⌥ Spazio' : 'Ctrl ⇧ Spazio';
const NUMERI = ['Nessuna', 'Una', 'Due', 'Tre', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Otto', 'Nove', 'Dieci'];
const IC = {
  lente: '<svg class="lente" viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/></svg>',
  spunta: '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:0"/></svg>',
  croce: '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:0"/></svg>',
  filo: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7H6a4 4 0 0 0 0 8h3"/><path d="M15 7h3a4 4 0 0 1 0 8h-3"/><path d="M8 11h8"/></svg>',
  lucchetto: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  chiudi: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9.5 2.5h5"/>',
  ripasso: '<rect x="3" y="6" width="14" height="13" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v11"/><path d="M7 11h6M7 14h4"/>',
  libretto: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/>',
  esami: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16"/><path d="M9 3v4"/><path d="M15 3v4"/><path d="M8 14h3"/>',
  orale: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/>',
  file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M12 11v6M9 14h6"/>',
  foto: '<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-5-5-8 9"/>',
  audio: '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
  gioco: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M15 17h4M17 15v4"/>',
  orario: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  appunti: '<path d="M12 3l7 4v10l-7 4-7-4V7z"/><path d="M12 3v18"/><path d="M5 7l7 4 7-4"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 15h5M10 18h3"/>',
};
const ico = k => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- stato ---------- */
let A, shell, pill, corpo, testa, campo, home, filo, allegatiBox, tacche = [], forma, velo, GEN = 0;
const nuovoStato = () => ({ zona: false, cattura: null, gioco: null, aperto: false, fisso: false, modo: 'riposo', turno: null, attesa: null, home: true, avviso: null, chiudiTra: null, apriTra: null, storia: [], allegati: [], orale: null, controller: null, ripasso: null, risposta: null, ultimoUso: 0 });

function saluto() {
  const n = String(D.profilo.nome || '').trim().split(/\s+/)[0], o = new Date().getHours();
  const s = o < 5 ? 'Ancora sveglio' : o < 13 ? 'Buongiorno' : o < 18 ? 'Buon pomeriggio' : 'Buonasera';
  return n ? `${s}, ${n}.` : s + '.';
}
function frase() {
  const p = prossimi()[0], c = daRipassare().length;
  const pezzi = [];
  if (p) { const g = giorniTra(oggi(), p.data); pezzi.push(g === 0 ? `Oggi c'è ${p.nome}. In bocca al lupo.` : `${p.nome} ${traQuanto(p.data)}.`); }
  if (c) pezzi.push(`${NUMERI[c] || c} ${c === 1 ? 'carta' : 'carte'} da ripassare.`);
  if (!pezzi.length) return D.esami.length ? 'Niente in sospeso oggi.' : 'Dimmi il tuo prossimo esame e preparo il piano.';
  return pezzi.join(' ');
}

function costruisci() {
  shell = h('div', 'ld'); shell.setAttribute('role', 'region'); shell.setAttribute('aria-label', 'Lode, assistente di studio'); shell.dataset.aperto = '0';
  pill = h('button', 'ld-pill'); pill.type = 'button'; pill.setAttribute('aria-expanded', 'false');
  corpo = h('div', 'ld-corpo');
  testa = h('header', 'ld-testa', `<div class="r1"><i class="ld-rombo"></i><h2></h2><button type="button" class="ld-indietro" hidden aria-label="Torna alla home di Lode"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>Indietro</button><span class="esc">Esc</span></div><div class="sotto"><p></p><small></small></div>`);
  const dentro = h('div', 'ld-dentro');
  campo = h('div', 'ld-campo'); campo.dataset.modo = 'riposo';
  campo.innerHTML = `<div class="cerca">${IC.lente}<input type="text" aria-label="Chiedi o scrivi un comando" placeholder="Chiedi o scrivi un comando…" autocomplete="off" spellcheck="true"></div>
    <div class="stato ascolto"><span class="lbl">Ti ascolto</span><div class="ld-onda" aria-hidden="true">${Array.from({ length: 41 }, (_, i) => `<i${i === 20 ? ' class="c"' : ''}></i>`).join('')}</div><span class="esc">Esc annulla</span></div>
    <div class="stato pensa"><span class="lbl">Un attimo…</span><div class="ld-linea" aria-hidden="true"><i></i></div></div>
    <button type="button" class="ld-mic" aria-label="Parla (oppure tieni premuto ${TASTI})">${IC.mic}<i class="quadro"></i><i class="anello"></i></button>`;
  tacche = [...campo.querySelectorAll('.ld-onda i')];
  allegatiBox = h('div', 'ld-allegati');
  home = h('div', 'ld-home');
  filo = h('div', 'ld-filo'); filo.setAttribute('aria-live', 'polite');
  dentro.append(campo, allegatiBox, home, filo);
  const piede = h('footer', 'ld-piede', `<span class="ld-piede-sx">Tieni premuto per parlare <kbd>${TASTI}</kbd></span><span>${IC.lucchetto}I dati restano su questo computer</span>`);
  corpo.append(testa, dentro, piede);
  const zona = h('div', 'ld-zona', `<i class="bordo"></i><div class="ld-zona-in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg><b>Lascia qui il file</b><span>${FILE.ACCETTATI}</span></div>`);
  zona.setAttribute('aria-hidden', 'true');
  shell.append(pill, corpo, zona);
  document.body.append(shell);
  velo = h('div', 'ld-drop', '<i class="bordo"></i><div class="ld-drop-in"><b>Lascia qui il file</b><span>PDF, slide, appunti, foto della lavagna: Lode ne fa carte del ripasso</span></div>');
  velo.setAttribute('aria-hidden', 'true'); document.body.append(velo);
  forma = { w: { x: larghezza(), v: 0, t: larghezza() }, h: { x: 36, v: 0, t: 36 }, r: { x: 18, v: 0, t: 18 } };
  disegnaHome(); aggiornaTesta(); aggiornaPillola(); applica();
}

/* ---------- la home del pannello: «Oggi» e gli strumenti ---------- */
// «di stamattina», «di ieri», «di lunedì»: quando era la lezione
function quandoEra(data, inizio) {
  const g = giorniTra(data, oggi());
  if (g === 0) return inizio && inizio < '13:00' ? 'di stamattina' : 'di oggi';
  if (g === 1) return 'di ieri';
  return 'di ' + dataLunga(data).split(' ')[0];
}
// il suggerimento fuori dall'aula: un gioco di due minuti sulle definizioni da fissare (mai durante una lezione)
function suggerimento() {
  if (!D.imp.suggerimenti || lezioneOra() || F.stato()) return null;
  const pl = prossimaLezione(); if (pl && pl.tra <= 20) return null;
  const { scelte } = daGiocare(6); if (scelte.length < 3) return null;
  const corsi = [...new Set(scelte.map(d => d.corso))], primo = scelte[0];
  return { n: scelte.length, corso: corsi.length === 1 ? primo.corso : null, testo: `${scelte.length} definizioni ${corsi.length === 1 ? `di ${primo.corso} ${quandoEra(primo.data, lezioni().find(l => l.data === primo.data && l.corso === primo.corso)?.inizio)}` : 'delle ultime lezioni'}` };
}
const stelleOggi = corso => (lezioni().find(l => l.corso === corso && l.data === oggi())?.stelle || []).length;
function righeOggi() {
  const r = [];
  const lo = lezioneOra(), pl = prossimaLezione();
  if (!lo && pl && pl.tra <= 90) r.push({ cls: pl.tra <= 15 ? 'urg' : 'att', t: `${pl.corso} alle ${pl.inizio}`, d: `${pl.aula ? 'Aula ' + pl.aula + ' · ' : ''}tra ${pl.tra} min`, n: '', b: V.attivo ? 'Appunti' : 'Orario', f: () => V.attivo ? apriAppunti(pl) : (nuovoTurno(), schedaOrario()) });
  if (V.attivo && STATO && (!STATO.obsidian.installato || !STATO.modello) && !D.imp.preparaNascosto) r.push({ cls: 'att', t: 'Completa Lode', d: [!STATO.obsidian.installato && 'Obsidian', !STATO.modello && 'il cervello locale'].filter(Boolean).join(' e ') + ': un clic, gratis', n: '', b: 'Prepara', f: () => { nuovoTurno(); detto(A.turno, 'Prepara Lode'); schedaPrepara(); } });
  const dc = daChiudere();
  if (dc) r.push({ cls: 'att', t: `Chiudi la lezione di ${dc.corso}`, d: `${dc.parole} parole di appunti · estraggo definizioni e ★`, n: '', b: 'Chiudi', f: () => { nuovoTurno(); detto(A.turno, 'Chiudi lezione'); chiudiLezione(dc.corso); } });
  const sg = suggerimento();
  if (sg) r.push({ cls: 'att', t: 'Gioco da due minuti', d: cap(sg.testo), n: String(sg.n), b: 'Gioca', f: () => { nuovoTurno(); detto(A.turno, 'Gioca'); schedaGioco(sg.corso); } });
  for (const e of prossimi().slice(0, 2)) {
    const p = piano(e), g = giorniTra(oggi(), e.data);
    r.push({ cls: g <= 7 ? 'urg' : 'att', t: e.nome, d: `${cap(dataLunga(e.data))} · ${p.oggi >= .1 ? `${num(p.oggi)} h oggi per stare in pari` : 'oggi sei in pari'}`, n: g === 0 ? 'oggi' : `${g} g`, b: 'Focus', f: () => avviaFocus({ esameId: e.id }) });
  }
  const c = daRipassare().length;
  if (c) r.push({ cls: 'att', t: 'Ripasso', d: `${c} ${c === 1 ? 'carta' : 'carte'} · circa ${Math.max(1, Math.round(c * .4))} min`, n: String(c), b: 'Inizia', f: () => { nuovoTurno(); schedaRipasso(); } });
  const s = serie(), m = minuti({ da: oggi(), a: oggi() });
  if (m || s) r.push({ cls: 'info', t: m ? `${ore(m)} di studio oggi` : 'Oggi non hai ancora studiato', d: s ? `${s} ${s === 1 ? 'giorno' : 'giorni'} di fila` : 'Bastano 25 minuti per iniziare una serie', n: '', b: m ? 'Libretto' : 'Focus', f: () => m ? (nuovoTurno(), schedaLibretto()) : avviaFocus({}) });
  return r.slice(0, 4);
}
// in aula il pannello si apre sulla cattura veloce: ★ da esame, definizione, domanda
function bloccoAula(lo) {
  const st = stelleOggi(lo.corso);
  return `<section class="ld-aula"><div class="capo"><span class="ld-lbl"><i class="ld-live"></i>In aula · ${esc(lo.corso)}</span><span>${lo.aula ? 'aula ' + esc(lo.aula) + ' · ' : ''}finisce tra ${lo.mancano} min</span></div>
    <div class="ld-cattura">${[['stella', '★ Da esame', 'S'], ['definizione', 'Definizione', 'D'], ['domanda', 'Domanda', 'Q']].map(([k, t, l]) => `<button type="button" class="btn" data-ld-cattura="${k}"><span>${t}</span><kbd>${MAC ? '⌃⌥' : 'Ctrl Alt '}${l}</kbd></button>`).join('')}
      ${V.attivo ? '<button type="button" class="btn primary" data-ld-appunti>Appunti</button>' : ''}</div>
    ${V.attivo ? bloccoTrascrizione() + bloccoRipeti() : ''}
    ${st ? `<p class="ld-nota">${st} ${st === 1 ? 'cosa segnata' : 'cose segnate'} da esame oggi.</p>` : ''}</section>`;
}
function bloccoRipeti() {
  if (O.attivo()) return `<div class="ld-ripeti-riga"><i class="ld-orecchio"></i><span>Ripeti attivo · tengo gli ultimi 60 secondi</span><button type="button" class="btn small primary" data-ld-ripeti="si">Ripeti <kbd>${MAC ? '⌃⌥P' : 'Ctrl Alt P'}</kbd></button><button type="button" class="btn small ld-piano" data-ld-ripeti="spegni">Spegni</button></div>`;
  return `<button type="button" class="ld-ripeti-riga spento" data-ld-ripeti="accendi"><i class="ld-orecchio"></i><span><b>Ripeti 60 s</b> · ti sei perso una frase? Lode te la ripete. Niente viene salvato.</span></button>`;
}
function bloccoTrascrizione() {
  const t = TR.stato();
  if (!t) return `<button type="button" class="ld-trascrivi" data-ld-trascrivi><i class="ld-rec"></i><span><b>Trascrivi la lezione</b><small>Tutto quello che dice il prof, formule comprese, nella nota Obsidian · ${MAC ? '⌃⌥R' : 'Ctrl Alt R'}</small></span></button>`;
  return `<div class="ld-trascrivi on"><i class="ld-rec"></i><span><b>${t.inPausa ? 'In pausa' : 'Trascrivo'} · ${t.minuti} min · ${t.parole.toLocaleString('it-IT')} parole</b><small>${t.ultima ? esc(t.ultima.replace(/^\*\*\d\d:\d\d\*\*\s*/, '').slice(-110)) : 'Ascolto: la prima riga arriva fra una ventina di secondi.'}</small></span>
    <button type="button" class="btn small" data-ld-tr="${t.inPausa ? 'riprendi' : 'pausa'}">${t.inPausa ? 'Riprendi' : 'Pausa'}</button><button type="button" class="btn small primary" data-ld-tr="fine">Fine</button></div>`;
}
function disegnaHome() {
  const r = righeOggi(), lo = lezioneOra();
  home._righe = r;
  home.innerHTML = `${lo ? bloccoAula(lo) : ''}${lo && !r.length ? '' : `<section class="ld-oggi"><div class="capo"><span class="ld-lbl">Oggi</span><span>${D.esami.length ? `${cfuFatti()} di ${D.profilo.cfuTotali} CFU` : ''}</span></div>
    ${r.map((x, i) => `<div class="ld-riga ${x.cls}"><i class="ld-seg"></i><div class="t"><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div><span class="n">${esc(x.n)}</span><button type="button" class="btn small${i === 0 && x.cls === 'urg' ? ' primary' : ''}" data-ld-riga="${i}">${x.b}</button></div>`).join('') ||
    `<div class="ld-riga info vuota"><i class="ld-seg"></i><div class="t"><b>Inizia da qui</b><span>Scrivi «lezione analisi 2 lunedì 9-11 aula 7», oppure prova i dati di esempio</span></div><span class="n"></span><button type="button" class="btn small primary" data-ld-esempio>Esempio</button></div>`}</section>`}
    <div class="ld-strumenti">${STRUMENTI.map(([k, t], i) => `<button type="button" class="btn" data-ld-strumento="${i}">${ico(k)}<span>${t}</span></button>`).join('')}</div>`;
}
const STRUMENTI = [
  ['focus', 'Focus', () => schedaFocus()],
  ['ripasso', 'Ripasso', () => schedaRipasso()],
  ['gioco', 'Gioco', () => schedaGioco()],
  ['orario', 'Orario', () => schedaOrario()],
  ['appunti', 'Note', () => schedaNote()],
  ['orale', 'Interrogami', () => avviaOrale(null)],
  ['libretto', 'Libretto', () => schedaLibretto()],
  ['esami', 'Esami', () => schedaEsami()],
];
function aggiornaTesta() {
  testa.querySelector('h2').textContent = saluto();
  const lo = lezioneOra();
  testa.querySelector('p').textContent = lo ? `Sei a lezione di ${lo.corso}. Prendi appunti tranquillo: ci penso io a non perdere niente.` : frase();
  const m = media();
  testa.querySelector('small').textContent = `${cap(dataLunga(oggi()))}${m.ponderata ? ` · media ${num(m.ponderata, 2)}` : ''}${serie() ? ` · serie di ${serie()} ${serie() === 1 ? 'giorno' : 'giorni'}` : ''}`;
  testa.querySelector('.r1 .ld-rombo').classList.toggle('ld-cavo', !prossimi().some(e => giorniTra(oggi(), e.data) <= 7));
}

/* ---------- la pillola ---------- */
function aggiornaPillola(avviso) {
  if (!pill) return;
  const T = F.stato();
  pill.classList.toggle('timer', !!T && !avviso);
  if (avviso) { pill.innerHTML = `<i class="ld-rombo"></i><span class="ld-testo"><b>${esc(avviso)}</b></span>`; pill.setAttribute('aria-label', avviso); return; }
  if (T) {
    const fermo = !!T.fermo, pausa = T.fase === 'pausa';
    if (!pill.querySelector('.ld-tempo')) pill.innerHTML = `<i class="ld-rombo"></i><b class="ld-tempo"></b><span class="ld-cosa"></span><i class="ld-avanza"><i></i></i>`;
    pill.querySelector('.ld-tempo').textContent = F.mmss(F.restante());
    pill.querySelector('.ld-cosa').textContent = fermo ? 'in pausa' : pausa ? 'pausa' : F.etichetta();
    pill.querySelector('.ld-avanza i').style.transform = `scaleX(${F.avanzamento().toFixed(4)})`;
    pill.classList.toggle('sosta', fermo || pausa);
    pill.setAttribute('aria-label', `${pausa ? 'Pausa' : 'Focus su ' + F.etichetta()}: mancano ${F.mmss(F.restante())}`);
    return;
  }
  const lo = lezioneOra(), pl = prossimaLezione(), sg = suggerimento(), tr = TR.stato();
  const p = prossimi()[0], c = daRipassare().length;
  let testo, pieno = false;
  if (tr) { testo = `<i class="ld-live rec"></i><b>${esc(tr.lezione.corso)}</b><span class="ld-tenue">${tr.inPausa ? 'trascrizione in pausa' : 'trascrivo'} · ${tr.parole.toLocaleString('it-IT')} parole</span>`; pieno = true; }
  else if (lo) { const st = stelleOggi(lo.corso); testo = `<i class="ld-live"></i><b>${esc(lo.corso)}</b><span class="ld-tenue">fine tra ${lo.mancano} min</span>${st ? `<span class="ld-punto"></span><span class="ld-tenue">★${st}</span>` : ''}${O.attivo() ? '<i class="ld-orecchio" title="Ripeti attivo: gli ultimi 60 secondi in memoria"></i>' : ''}`; pieno = true; }
  else if (pl && pl.tra <= 20) { testo = `<b>${esc(pl.corso)}</b><span class="ld-tenue">${pl.aula ? 'aula ' + esc(pl.aula) + ' · ' : ''}tra ${pl.tra} min</span>`; pieno = true; }
  else if (sg) testo = `<b>2 minuti</b><span class="ld-tenue">${esc(sg.testo)}</span>`;
  else if (p) { const g = giorniTra(oggi(), p.data); testo = `<b>${esc(p.nome)}</b><span class="ld-tenue">${g === 0 ? 'oggi' : g === 1 ? 'domani' : `tra ${g} g`}</span>${c ? `<span class="ld-punto"></span><span class="ld-tenue">${c} carte</span>` : ''}`; pieno = g <= 7; }
  else if (c) testo = `<b>${c}</b><span class="ld-tenue">carte da ripassare</span>`;
  else testo = `<b>Lode</b><span class="ld-tenue">passa qui sopra</span>`;
  pill.innerHTML = `<i class="ld-rombo${pieno ? '' : ' ld-cavo'}"></i><span class="ld-testo">${testo}</span>`;
  pill.setAttribute('aria-label', `Lode: ${pill.textContent}. Passa sopra o premi ${TASTI}.`);
  // un suggerimento nuovo: la gemma fa un piccolo cenno, al massimo ogni 90 minuti
  const chiave = sg ? sg.testo : '';
  if (chiave && chiave !== aggiornaPillola._ultimo && Date.now() - (D.imp.ultimoSuggerimento || 0) > 90 * 60e3 && !A.aperto) {
    D.imp.ultimoSuggerimento = Date.now(); salva(); segnala('conferma-pronta');
  }
  aggiornaPillola._ultimo = chiave;
}

// a riposo la pillola è larga 336; col timer si stringe attorno al tempo
const larghezza = () => F.stato() ? 248 : 336;
// la conchiglia: tre molle smorzate criticamente (niente rimbalzi) che seguono larghezza, altezza e raggio
let formaViva = false;
let ultimaZona = 0;
function applica() {
  shell.style.width = forma.w.x.toFixed(2) + 'px'; shell.style.height = forma.h.x.toFixed(2) + 'px'; shell.style.borderRadius = forma.r.x.toFixed(2) + 'px';
  const t = performance.now();
  if (BRIDGE && t - ultimaZona > 120) { ultimaZona = t; const r = shell.getBoundingClientRect(); BRIDGE.zona({ x: r.left, y: r.top, w: r.width, h: r.height, aperto: A?.aperto || A?.zona }); }
}
function molla() {
  if (formaViva) return; formaViva = true; let prec = performance.now();
  ogni(t => {
    const dt = Math.min(64, Math.max(0, t - prec)) / 1000; prec = t;
    if (A.aperto) forma.h.t = Math.min(corpo.offsetHeight, innerHeight - 20);
    let fermo = true; const w0 = RIDOTTO ? 80 : 15.5;
    for (const k of ['w', 'h', 'r']) {
      const m = forma[k], n = Math.max(1, Math.ceil(dt / .008)), s = dt / n;
      for (let i = 0; i < n; i++) { const a = -w0 * w0 * (m.x - m.t) - 2 * w0 * m.v; m.v += a * s; m.x += m.v * s; }
      if (Math.abs(m.x - m.t) < .2 && Math.abs(m.v) < 3) { m.x = m.t; m.v = 0; } else fermo = false;
    }
    applica();
    if (fermo && !A.aperto) { formaViva = false; return false; }
    return true;
  });
}

/* ---------- aprire e chiudere ---------- */
export function apri({ fisso = false } = {}) {
  if (fisso) A.fisso = true;
  if (A.aperto) return Promise.resolve();
  // si riparte dalla home: dopo 2 minuti se erano solo comandi, dopo 20 se c'era una conversazione con l'AI
  if (!A.home && Date.now() - A.ultimoUso > (A.storia.length ? 20 : 2) * 60e3 && !A.attesa && !A.orale && !A.gioco && !Voce.attivo()) ricomincia();
  A.apriTra?.(); A.chiudiTra?.(); A.aperto = true;
  if (A.home) disegnaHome();
  aggiornaTesta();
  shell.dataset.aperto = '1'; pill.setAttribute('aria-expanded', 'true');
  forma.w.t = Math.min(560, innerWidth - 16); forma.r.t = 20; molla();
  tween(150, e => { if (!A.aperto) return; pill.style.opacity = (1 - e).toFixed(3); pill.style.transform = `scale(${1 - .04 * e})`; }).then(() => { if (A.aperto) pill.style.visibility = 'hidden'; });
  corpo.style.opacity = '1';
  const pezzi = [testa, ...corpo.querySelector('.ld-dentro').children, corpo.querySelector('.ld-piede')].filter(x => x.style.display !== 'none' && !(x === filo && !filo.children.length) && !(x === allegatiBox && !allegatiBox.children.length));
  pezzi.forEach((p, i) => entra(p, { ritardo: 50 + i * 45, dy: 10, blur: 8, ms: 560 }));
  segnala('aperto');
  if (BRIDGE && AI.motore() === 'locale') BRIDGE.invoca('locale:scalda').catch(() => { });
  return attendi(560);
}
export function chiudi(avviso) {
  A.fisso = false;
  if (!A.aperto) { if (avviso) mostraAvviso(avviso); return Promise.resolve(); }
  A.chiudiTra?.(); A.aperto = false; pill.setAttribute('aria-expanded', 'false');
  if (shell.contains(document.activeElement)) document.activeElement.blur();
  forma.w.t = larghezza(); forma.h.t = 36; forma.r.t = 18; molla();
  tween(170, e => { if (!A.aperto) corpo.style.opacity = (1 - e).toFixed(3); });
  if (avviso) mostraAvviso(avviso, true); else aggiornaPillola();
  pill.style.visibility = '';
  tween(300, e => { if (A.aperto) return; pill.style.opacity = e.toFixed(3); pill.style.transform = `scale(${.96 + .04 * e})`; }, { ritardo: 170 });
  if (A.cattura) fineCattura(); A.gioco = null;
  if (BRIDGE && document.hasFocus()) BRIDGE.invoca('finestra:rilascia');
  segnala('chiuso'); if (F.stato()?.fase === 'focus' && !F.stato().fermo) dopo(700, () => segnala('focus'));
  return attendi(480).then(() => { if (!A.aperto) shell.dataset.aperto = '0'; });
}
function mostraAvviso(testo, silenzioso) {
  A.avviso?.(); aggiornaPillola(testo);
  if (!silenzioso) entra(pill, { dy: 0, blur: 4, ms: 300 });
  A.avviso = dopo(2800, () => { A.avviso = null; if (A.aperto) return; tween(160, e => { pill.style.opacity = (1 - e).toFixed(3); }).then(() => { aggiornaPillola(); tween(260, e => { pill.style.opacity = e.toFixed(3); }); }); });
}
// tornare indietro: dalla scheda aperta alla home del pannello, con la conversazione che scivola via
export async function indietro() {
  if (A.home) return;
  if (A.attesa && !A.attesa.inCorso) A.attesa.risolvi({ esito: 'annullato_dallo_studente' });
  if (A.orale) A.orale = null;
  Voce.zitto(); A.controller?.abort();
  await tween(160, e => { filo.style.opacity = (1 - e).toFixed(3); filo.style.transform = `translateY(${(e * 6).toFixed(1)}px)`; });
  filo.style.opacity = ''; filo.style.transform = '';
  ricomincia();
  [testa.querySelector('.sotto'), home].forEach((el, i) => entra(el, { ritardo: i * 50, dy: -6, blur: 6, ms: 460 }));
  if (A.aperto) campo.querySelector('input').focus({ preventScroll: true });
}
function ricomincia() {
  GEN++; A.controller?.abort(); Voce.zitto();
  const fisso = A.fisso, aperto = A.aperto;
  A = { ...nuovoStato(), fisso, aperto };
  filo.innerHTML = ''; allegatiBox.innerHTML = '';
  mostraHome(); modo('riposo');
}

/* ---------- campo: riposo, ascolto, un attimo ---------- */
function modo(m, etichetta) {
  A.modo = m; campo.dataset.modo = m;
  if (m === 'pensa') {
    campo.querySelector('.stato.pensa .lbl').textContent = etichetta || 'Un attimo…';
    if (campo._pensa) return; campo._pensa = true;
    const t0 = performance.now(), seg = campo.querySelector('.ld-linea i');
    ogni(t => { if (A.modo !== 'pensa') { campo._pensa = false; return false; } const p = ((t - t0) % 900) / 900; seg.style.transform = `translateX(${(-48 + 218 * morbido(p)).toFixed(1)}px)`; return true; });
  }
  if (m === 'ascolto') {
    if (campo._onda) return; campo._onda = true;
    ogni(t => {
      if (A.modo !== 'ascolto') { campo._onda = false; tacche.forEach(x => { x.style.transform = ''; }); return false; }
      const v = Voce.livelloVoce(); livelloVoce(v);
      tacche.forEach((x, i) => { const d = Math.abs(i - 20) / 20, k = .17 + (1 - d) * v * (.5 + .5 * Math.sin(t / 90 + i * .7)); x.style.transform = `scaleY(${Math.max(.12, k).toFixed(3)})`; });
      return true;
    });
  }
}

/* ---------- conversazione ---------- */
function nascondiHome() {
  if (!A.home) return; A.home = false;
  const b = testa.querySelector('.ld-indietro'); b.hidden = false; entra(b, { dy: 0, blur: 4, ms: 320 });
  comprimi(home, 380, false); comprimi(testa.querySelector('.sotto'), 380, false);
}
function mostraHome() {
  A.home = true; testa.querySelector('.ld-indietro').hidden = true;
  for (const el of [home, testa.querySelector('.sotto')]) { el.style.display = ''; el.style.height = ''; el.style.marginBottom = ''; el.style.opacity = ''; el.style.overflow = ''; }
  disegnaHome(); aggiornaTesta();
}
function riassumi(t) {
  const dom = t.dataset.domanda || '', sin = t.dataset.sintesi || '';
  if (!dom && !sin) { t.classList.add('passato'); comprimi(t, 300); return; }
  const h0 = t.offsetHeight; t.style.height = h0 + 'px'; t.style.overflow = 'hidden';
  tween(140, e => { for (const c of t.children) c.style.opacity = (1 - e).toFixed(3); }).then(() => {
    t.innerHTML = ''; const r = h('div', 'ld-riass', `<q>${esc(dom || '…')}</q><span>→</span><b>${esc(sin || '…')}</b>`); t.append(r);
    const h1 = r.offsetHeight; entra(r, { dy: 4, blur: 4, ms: 380 });
    return tween(380, e => { t.style.height = (h0 + (h1 - h0) * e).toFixed(2) + 'px'; });
  }).then(() => { t.style.height = ''; });
  t.classList.add('passato');
}
function nuovoTurno() {
  if (!A.aperto) apri({ fisso: true });
  A.fisso = true; A.ultimoUso = Date.now();
  nascondiHome(); chiudiRipasso();
  if (A.turno && !A.turno.classList.contains('passato') && !(A.attesa && A.turno.contains(A.attesa.card)) && !A.orale) riassumi(A.turno);
  const vecchi = [...filo.querySelectorAll('.ld-turno.passato')]; if (vecchi.length > 2) comprimi(vecchi[0], 300);
  const t = h('article', 'ld-turno'); filo.append(t); A.turno = t;
  requestAnimationFrame(() => { corpo.scrollTo({ top: corpo.scrollHeight, behavior: RIDOTTO ? 'auto' : 'smooth' }); });
  return t;
}
function detto(t, testo) {
  let p = t.querySelector('.ld-detto');
  if (!p) { p = h('p', 'ld-detto'); t.prepend(p); p._parole = []; }
  const parole = String(testo).split(/\s+/).filter(Boolean);
  parole.forEach((w, i) => {
    const s = p._parole[i];
    if (s) { if (s.textContent !== w) s.textContent = w; return; }
    if (i > 0) p.append(document.createTextNode(' '));
    const n = h('span', 'w'); n.textContent = w; p.append(n); p._parole.push(n);
    entra(n, { dy: 5, blur: 7, ms: 380 });
  });
  while (p._parole.length > parole.length) { const n = p._parole.pop(); const sp = n.previousSibling; n.remove(); if (sp && sp.nodeType === 3) sp.remove(); }
  t.dataset.domanda = testo;
  return p;
}
const mdHtml = t => {
  let s = esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const i = s.lastIndexOf('**'); if (i >= 0) s = s.slice(0, i) + '<b>' + s.slice(i + 2) + '</b>';
  return s.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
};
// la risposta dell'AI: i pezzi dello streaming si scrivono con un ritmo morbido, mai a scatti
function nuovaRisposta() {
  const t = A.turno || nuovoTurno(), g = GEN;
  const p = h('p', 'ld-ai', '<i class="ld-rombo"></i><span class="tx"></span>'); t.append(p);
  entra(p, { dy: 3, blur: 0, ms: 240 });
  const tx = p.querySelector('.tx'), caret = h('span', 'ld-caret');
  let testo = '', visti = 0, finito = false, chiusa = null, prec = performance.now(), ultimoSegno = 0;
  const fatto = new Promise(r => { chiusa = r; });
  ogni(t2 => {
    if (g !== GEN) { chiusa(); return false; }
    const dt = Math.min(100, t2 - prec) / 1000; prec = t2;
    const arretrato = testo.length - visti, cps = Math.max(70, arretrato * 5);
    if (arretrato > 0) {
      visti = Math.min(testo.length, visti + Math.max(1, cps * dt)); tx.innerHTML = mdHtml(testo.slice(0, Math.floor(visti))); tx.append(caret);
      if (t2 - ultimoSegno > 300) { ultimoSegno = t2; segnala('risposta', { ms: 700 }); if (corpo.scrollHeight - corpo.scrollTop - corpo.clientHeight < 140) corpo.scrollTop = corpo.scrollHeight; }
    }
    if (finito && Math.floor(visti) >= testo.length) {
      chiusa(); const t1 = performance.now();
      ogni(tt => { if (g !== GEN) return false; const e = tt - t1; if (e > 1100) { caret.remove(); return false; } caret.style.opacity = (Math.floor(e / 530) % 2 ? 0 : 1) * (e > 900 ? (1100 - e) / 200 : 1); return true; });
      return false;
    }
    return true;
  });
  return {
    get testo() { return testo; },
    aggiungi(d) { testo += d; },
    fine() { finito = true; if (!t.dataset.sintesi && testo) t.dataset.sintesi = testo.replace(/\*\*/g, '').split(/(?<=[.?!])\s/)[0].slice(0, 90); if (D.imp.voceAlta) Voce.leggi(testo); return fatto; },
  };
}
function rispostaFissa(testo, { errore = false } = {}) {
  const t = A.turno || nuovoTurno(); modo('riposo');
  const p = h('p', 'ld-ai' + (errore ? ' ld-err' : ''), `<i class="ld-rombo"></i><span class="tx">${mdHtml(testo)}</span>`); t.append(p);
  entra(p, { dy: 3, blur: 2, ms: 300 });
  if (!t.dataset.sintesi) t.dataset.sintesi = testo.replace(/\*\*/g, '').split(/(?<=[.?!])\s/)[0];
  segnala('risposta', { ms: 600 });
  return p;
}
function scheda(cls, html) { const t = A.turno || nuovoTurno(); const s = h('div', 'ld-scheda ' + cls, html); t.append(s); segnala('scheda'); entra(s, { dy: 10, blur: 8, ms: 520, scala: .985 }); requestAnimationFrame(() => s.scrollIntoView({ block: 'nearest', behavior: RIDOTTO ? 'auto' : 'smooth' })); return s; }
function contesto(html) {
  const t = A.turno || nuovoTurno(); const c = h('div', 'ld-ctx', `${IC.filo}<span>${html}</span>`);
  const det = t.querySelector('.ld-detto'); if (det) det.after(c); else t.prepend(c);
  return c;
}
function mostraFatto(d = {}, dove) {
  const f = h('div', 'ld-fatto' + (d.no ? ' no' : ''), `${d.no ? IC.croce : IC.spunta}<b>${esc(d.testo || 'Fatto.')}</b>${d.nota ? `<span>${esc(d.nota)}</span>` : ''}`);
  if (d.annulla) { const b = h('button', 'btn small', 'Annulla'); b.type = 'button'; b.addEventListener('click', () => { d.annulla(); b.replaceWith(h('span', '', 'annullato')); aggiornaTutto(); }, { once: true }); f.append(b); }
  if (d.azione) { const b = h('button', 'btn small', esc(d.azione[0])); b.type = 'button'; b.addEventListener('click', d.azione[1]); f.append(b); }
  if (dove) dove.replaceWith(f); else (A.turno || nuovoTurno()).append(f);
  if (d.sintesi && A.turno) A.turno.dataset.sintesi = d.sintesi;
  segnala(d.no ? 'quiete' : 'fatto');
  const path = f.querySelector('path');
  return Promise.all([entra(f, { dy: 4, blur: 4, ms: 380 }), tween(420, e => { path.style.strokeDashoffset = (1 - e).toFixed(3); }, { ritardo: 80 })]);
}
// ogni modifica fatta da un comando si può annullare con un clic
function istantanea() { const s = JSON.parse(JSON.stringify(D)); return () => sostituisci(s); }
function aggiornaTutto() { aggiornaPillola(); if (A.home) disegnaHome(); aggiornaTesta(); }

/* ---------- proposte con «Conferma / Annulla» (per l'AI) ---------- */
function schedaConferma({ titolo, righe = [], extra = '', nota, fuoco = true }) {
  const s = scheda('ld-conf', `<h3>${esc(titolo || 'Confermi?')}</h3>
    ${righe.length ? `<dl>${righe.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}${extra}
    ${nota ? `<p class="ld-nota">${esc(nota)}</p>` : ''}
    <div class="az"><button type="button" class="btn primary" data-ld="si">Conferma</button><button type="button" class="btn ld-piano" data-ld="no">Annulla</button><small>Puoi anche scrivere «sì».</small></div>`);
  s.setAttribute('role', 'alertdialog'); s.setAttribute('aria-label', titolo || 'Conferma');
  s.querySelector('[data-ld=si]').addEventListener('click', () => conferma());
  s.querySelector('[data-ld=no]').addEventListener('click', () => annulla());
  dopo(520, () => segnala('conferma-pronta'));
  if (fuoco) s.querySelector('[data-ld=si]').focus({ preventScroll: true });
  return s;
}
const attendiDecisione = (card, esegui) => new Promise(res => { A.attesa = { card, esegui, risolvi: r => { A.attesa = null; res(r); } }; });
async function conferma() {
  const a = A.attesa; if (!a || a.inCorso) return; a.inCorso = true;
  await premi(a.card.querySelector('[data-ld=si]')); segnala('confermato');
  let r; try { r = await a.esegui(a.card); } catch (e) { console.error(e); r = { esito: 'errore', errore: e.message }; }
  a.risolvi(r);
}
async function annulla() {
  const a = A.attesa; if (!a || a.inCorso) return; a.inCorso = true;
  await mostraFatto({ testo: 'Annullato.', nota: 'Non ho cambiato niente.', sintesi: 'annullato', no: true }, a.card.isConnected ? a.card : null);
  a.risolvi({ esito: 'annullato_dallo_studente' });
}
const SI = /^(s[iì]|ok(ay)?|conferm[aoi]|confermo|vai|procedi|certo|perfetto|d'accordo|fallo|esatto|giusto|salva(le|li)?)( pure)?[\s,.!]*$/i;
const NO = /^(no|annulla|lascia (stare|perdere)|aspetta|stop|niente|meglio di no)[\s,.!]*$/i;

/* ---------- gli strumenti ---------- */
const opzioniEsami = (sel, soloDaFare = true) => (soloDaFare ? daFare() : D.esami).map(e => `<option value="${e.id}"${e.id === sel ? ' selected' : ''}>${esc(e.nome)}</option>`).join('');

function schedaFocus(esameId) {
  const pross = esameId || prossimi()[0]?.id || '';
  const s = scheda('ld-focus', `<span class="ld-lbl">Focus</span>
    <div class="ld-preset" role="radiogroup" aria-label="Durata">${[25, 50, 90].map(m => `<button type="button" role="radio" class="ld-chip${m === D.imp.focus ? ' on' : ''}" data-min="${m}" aria-checked="${m === D.imp.focus}"><b>${m}</b><span>min</span></button>`).join('')}</div>
    <div class="ld-riga-form"><select aria-label="Su che cosa">${'<option value="">Studio libero</option>' + opzioniEsami(pross)}</select><button type="button" class="btn primary" data-via>Inizia</button></div>
    <p class="ld-nota">Pausa di ${D.imp.pausa} minuti alla fine. Le ore contano nel piano dell'esame.</p>`);
  let min = D.imp.focus;
  s.querySelectorAll('.ld-chip').forEach(b => b.addEventListener('click', () => { min = +b.dataset.min; s.querySelectorAll('.ld-chip').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); premi(b); }));
  s.querySelector('[data-via]').addEventListener('click', () => avviaFocus({ min, esameId: s.querySelector('select').value || null, dove: s }));
  if (A.turno) A.turno.dataset.sintesi = 'focus';
}
export async function avviaFocus({ min = D.imp.focus, esameId = null, dove } = {}) {
  if (!A.aperto) { F.avvia({ min, esameId }); return; }
  F.avvia({ min, esameId });
  const nome = esame(esameId)?.nome;
  if (!A.home || dove) await mostraFatto({ testo: `Focus di ${min} minuti${nome ? ' su ' + nome : ''}.`, nota: 'Ci vediamo alla pausa.', sintesi: `focus ${min} min` }, dove);
  await attendi(dove || !A.home ? 700 : 0);
  chiudi();
}

function schedaLibretto({ base } = {}) {
  const m = media(), cf = cfuFatti(), tot = D.profilo.cfuTotali, obiettivo = base || (m.base && m.base > 104 ? 110 : m.base ? Math.min(110, Math.floor(m.base / 5) * 5 + 5) : 100);
  const sv = m.n ? serve(obiettivo) : null, df = daFare();
  const s = scheda('ld-libretto', `<div class="ld-kpi">
      <div><span class="ld-lbl">Media ponderata</span><b class="v" data-v="m">${m.ponderata ? '0' : '—'}</b><span class="d">${m.n ? `aritmetica ${num(m.aritmetica, 2)} · ${m.n} esami` : 'ancora nessun voto'}</span></div>
      <div><span class="ld-lbl">Base di laurea</span><b class="v" data-v="b">${m.base ? '0' : '—'}<small>/110</small></b><span class="d">${cf} di ${tot} CFU</span></div>
    </div>
    <div class="ld-cfu" aria-hidden="true"><i style="transform:scaleX(0)"></i></div>
    ${sv ? `<p class="ld-serve">${sv.gia ? `Per partire da <b>${obiettivo}</b> ti basta passare gli esami che restano.` : sv.possibile ? `Per partire da <b>${obiettivo}</b> ti serve <b>${num(sv.voto, 1)}</b> di media nei ${sv.cfu} CFU che mancano.` : `Partire da <b>${obiettivo}</b> non è più possibile: punta a ${Math.floor(((m.somma + 30 * sv.cfu) / (m.cfuVoto + sv.cfu)) * 110 / 30)}.`}</p>` : ''}
    ${df.length && m.n ? `<div class="ld-sim"><span class="ld-lbl">E se…</span><div class="ld-riga-form"><select aria-label="Esame">${opzioniEsami(df[0].id)}</select><input type="range" min="18" max="31" value="28" aria-label="Voto"><b class="vv">28</b></div><p class="esito"></p></div>` : ''}`);
  const vm = s.querySelector('[data-v=m]'), vb = s.querySelector('[data-v=b]');
  if (m.ponderata) { conta(vm, m.ponderata, x => num(x, 2)); tween(900, e => { vb.firstChild.textContent = num(m.base * e, 1); }, { ritardo: 120 }); }
  const barra = s.querySelector('.ld-cfu i'); tween(900, e => { barra.style.transform = `scaleX(${(Math.min(1, cf / tot) * e).toFixed(4)})`; }, { ritardo: 200 });
  const sim = s.querySelector('.ld-sim');
  if (sim) {
    const sel = sim.querySelector('select'), r = sim.querySelector('input'), vv = sim.querySelector('.vv'), out = sim.querySelector('.esito');
    const calc = () => {
      const v = Math.min(30, +r.value), lode = +r.value === 31; vv.textContent = lode ? '30L' : v;
      const x = simula(sel.value, v, lode); if (!x) return;
      const d = x.delta; out.innerHTML = `Media <b>${num(x.dopo.ponderata, 2)}</b> <span class="${d < 0 ? 'giu' : 'su'}">${d >= 0 ? '+' : '−'}${num(Math.abs(d), 2)}</span> · base <b>${num(x.dopo.base, 1)}</b>`;
    };
    r.addEventListener('input', calc); sel.addEventListener('change', calc); calc();
  }
  if (A.turno) A.turno.dataset.sintesi = m.ponderata ? `media ${num(m.ponderata, 2)}, base ${num(m.base, 1)}` : 'libretto vuoto';
  return s;
}
function schedaSimula({ esame: e, voto, lode, nomeDetto }) {
  if (!e) return rispostaFissa(`Non trovo **${nomeDetto}** tra i tuoi esami. Aggiungilo con «esame ${nomeDetto} 6 cfu».`);
  const x = simula(e.id, voto, lode);
  if (!x.prima.n) return rispostaFissa(`Con ${voto}${lode ? ' e lode' : ''} in **${e.nome}** la tua media partirebbe da **${voto}**: base **${num(voto * 110 / 30, 1)}**.`);
  const d = x.delta;
  rispostaFissa(`Con **${voto}${lode ? ' e lode' : ''}** in ${e.nome} la media passa da ${num(x.prima.ponderata, 2)} a **${num(x.dopo.ponderata, 2)}** (${d >= 0 ? '+' : '−'}${num(Math.abs(d), 2)}): base di laurea **${num(x.dopo.base, 1)}**.`);
  A.turno.dataset.sintesi = `media ${num(x.dopo.ponderata, 2)}`;
}

function schedaEsami() {
  const p = prossimi(), senza = daFare().filter(e => !e.data);
  const s = scheda('ld-esami', `<span class="ld-lbl">Prossimi appelli · ${p.length}</span>
    ${p.map(e => { const pi = piano(e), g = giorniTra(oggi(), e.data); return `<div class="ld-es"><div class="t"><b>${esc(e.nome)}</b><span>${dataBreve(e.data)} · ${e.cfu} CFU · ${num(pi.fatte, 0)} di ${pi.tot} h${pi.oggi >= .1 ? ` · <em>${num(pi.oggi)} h oggi</em>` : ''}</span><i class="q"><i style="transform:scaleX(0)" data-q="${pi.quota.toFixed(3)}"></i></i></div><span class="g">${g === 0 ? 'oggi' : g}<small>${g === 0 ? '' : g === 1 ? 'giorno' : 'giorni'}</small></span><button type="button" class="btn small" data-focus="${e.id}">Focus</button></div>`; }).join('') || '<p class="ld-nota">Nessun appello in calendario.</p>'}
    ${senza.length ? `<p class="ld-nota">Senza data: ${senza.map(e => esc(e.nome)).join(', ')}.</p>` : ''}
    <form class="ld-riga-form ld-nuovo"><input name="nome" placeholder="Nuovo esame" aria-label="Nome dell'esame" required><input name="cfu" type="number" min="1" max="30" value="6" aria-label="CFU" title="CFU"><input name="data" type="date" aria-label="Data dell'appello"><button class="btn" type="submit">Aggiungi</button></form>`);
  s.querySelectorAll('[data-q]').forEach((x, i) => tween(700, e => { x.style.transform = `scaleX(${(x.dataset.q * e).toFixed(4)})`; }, { ritardo: 150 + i * 70 }));
  s.querySelectorAll('[data-focus]').forEach(b => b.addEventListener('click', () => avviaFocus({ esameId: b.dataset.focus })));
  s.querySelector('form').addEventListener('submit', ev => {
    ev.preventDefault(); const f = new FormData(ev.target); const nome = String(f.get('nome')).trim(); if (!nome) return;
    const ann = istantanea(); const e = aggiungiEsame({ nome, cfu: +f.get('cfu') || 6, data: f.get('data') || null });
    ev.target.reset(); mostraFatto({ testo: `${e.nome} aggiunto.`, nota: e.data ? dataLunga(e.data) : 'senza data', annulla: ann });
    aggiornaTutto();
  });
  if (A.turno) A.turno.dataset.sintesi = p[0] ? `${p[0].nome} ${traQuanto(p[0].data)}` : 'nessun appello';
}

// il ripasso: una carta alla volta, Spazio per girarla, 1-4 per rispondere
function schedaRipasso(esameId) {
  const coda = daRipassare(esameId).sort((a, b) => a.scad.localeCompare(b.scad) || a.creata - b.creata);
  const nomeE = esameId ? esame(esameId)?.nome : null;
  if (!coda.length) {
    const tot = D.carte.filter(c => !esameId || c.esameId === esameId);
    const prossima = tot.map(c => c.scad).sort()[0];
    const s = scheda('ld-rip', `<span class="ld-lbl">Ripasso${nomeE ? ' · ' + esc(nomeE) : ''}</span><p class="ld-vuoto">${tot.length ? `Niente da ripassare oggi. La prossima carta torna ${traQuanto(prossima)}.` : 'Ancora nessuna carta. Scrivi «carta: domanda = risposta», oppure trascina qui un PDF.'}</p>
      <form class="ld-carta-form"><input name="f" placeholder="Domanda" aria-label="Domanda" required><input name="r" placeholder="Risposta" aria-label="Risposta" required><select name="e" aria-label="Esame"><option value="">—</option>${opzioniEsami(esameId, false)}</select><button class="btn" type="submit">Aggiungi carta</button></form>`);
    s.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); const f = new FormData(ev.target); aggiungiCarta({ esameId: f.get('e') || null, fronte: f.get('f'), retro: f.get('r') }); salva(); ev.target.reset(); mostraFatto({ testo: 'Carta aggiunta.', nota: 'Torna oggi stesso nel ripasso.' }); aggiornaTutto(); });
    if (A.turno) A.turno.dataset.sintesi = 'niente da ripassare';
    return;
  }
  const tot = coda.length, t0 = Date.now(); let fatte = 0;
  const s = scheda('ld-rip', `<div class="capo"><span class="ld-lbl">Ripasso${nomeE ? ' · ' + esc(nomeE) : ''}</span><span class="conto"></span></div><i class="ld-prog"><i></i></i>
    <div class="carta"><p class="fronte"></p><div class="retro" hidden></div></div>
    <div class="az"><button type="button" class="btn primary gira">Mostra risposta <kbd>Spazio</kbd></button></div>`);
  const fr = s.querySelector('.fronte'), re = s.querySelector('.retro'), az = s.querySelector('.az'), conto = s.querySelector('.conto'), pr = s.querySelector('.ld-prog i');
  let c = null, girata = false;
  const mostra = () => {
    c = coda[0]; girata = false;
    const e = esame(c.esameId);
    fr.innerHTML = `${e && !esameId ? `<small>${esc(e.nome)}</small>` : ''}${mdHtml(c.fronte)}`; re.hidden = true; re.innerHTML = mdHtml(c.retro);
    az.innerHTML = '<button type="button" class="btn primary gira">Mostra risposta <kbd>Spazio</kbd></button>';
    az.querySelector('.gira').addEventListener('click', gira);
    conto.textContent = `${fatte + 1} di ${Math.max(tot, fatte + coda.length)}`;
    pr.style.transform = `scaleX(${(fatte / Math.max(tot, fatte + coda.length)).toFixed(4)})`;
    entra(fr, { dy: 6, blur: 6, ms: 420 });
  };
  const gira = () => {
    if (girata || !c) return; girata = true; re.hidden = false; entra(re, { dy: 6, blur: 6, ms: 420 });
    az.innerHTML = RISPOSTE.map(r => `<button type="button" class="btn${r.q === 4 ? ' primary' : ''}" data-q="${r.q}">${r.t}<small>${intervalloTesto(prossimoIntervallo(c, r.q))}</small><kbd>${r.k}</kbd></button>`).join('');
    az.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => vota(+b.dataset.q, b)));
    segnala('risposta', { ms: 400 });
  };
  const vota = async (q, b) => {
    if (!girata || !c) return; const carta = c; c = null;
    await premi(b || az.querySelector(`[data-q="${q}"]`));
    rispondi(carta, q); coda.shift(); if (q < 3) coda.push(carta); else fatte++;
    if (!coda.length) {
      const min = Math.max(1, Math.round((Date.now() - t0) / 60e3)); A.ripasso = null;
      pr.style.transform = 'scaleX(1)';
      await mostraFatto({ testo: `Ripasso finito: ${fatte} ${fatte === 1 ? 'carta' : 'carte'} in ${min} min.`, nota: 'Le difficili tornano domani.', sintesi: `${fatte} carte ripassate` });
      s.querySelector('.carta').remove(); az.remove();
      aggiornaTutto(); return;
    }
    tween(140, e => { s.querySelector('.carta').style.opacity = (1 - e).toFixed(3); }).then(() => { s.querySelector('.carta').style.opacity = ''; mostra(); });
  };
  A.ripasso = { gira, vota, card: s, attiva: () => !!c };
  mostra();
  if (A.turno) A.turno.dataset.sintesi = `ripasso di ${tot} carte`;
}
function chiudiRipasso() { A.ripasso = null; }

function schedaAiuto() {
  const s = scheda('ld-aiuto', `<span class="ld-lbl">Prova a scrivere</span>${ESEMPI.map(([f, d]) => `<button type="button" class="ld-es-cmd" data-cmd="${esc(f.replace(' …', ''))}"><b>${esc(f)}</b><span>${esc(d)}</span></button>`).join('')}
    ${AI.attiva() ? '' : '<p class="ld-nota">Con la chiave Claude (Impostazioni) puoi anche chiedere spiegazioni, creare carte dai PDF e farti interrogare.</p>'}`);
  s.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => { const t = b.dataset.cmd; if (t.endsWith('=')) { const i = campo.querySelector('input'); i.value = t + ' '; i.focus(); } else invia(t); }));
  if (A.turno) A.turno.dataset.sintesi = 'comandi';
}

/* ---------- orario delle lezioni ---------- */
function schedaOrario() {
  const corsi = [...new Set([...D.orario.map(o => o.corso), ...daFare().map(e => e.nome)])];
  const s = scheda('ld-orario', `<span class="ld-lbl">Orario · ${D.orario.length} ${D.orario.length === 1 ? 'lezione' : 'lezioni'} a settimana</span>
    <div class="ld-sett">${[1, 2, 3, 4, 5, 6].map(g => { const del = D.orario.filter(o => o.giorni.includes(g)).sort((a, b) => a.inizio.localeCompare(b.inizio)); return `<div class="ld-giorno${new Date().getDay() === g ? ' oggi' : ''}"><b>${GIORNI_BREVI[g]}</b>${del.map(o => `<span title="${esc(o.corso)}${o.aula ? ' · aula ' + esc(o.aula) : ''}"><em>${o.inizio}</em>${esc(o.corso)}</span>`).join('') || '<span class="vuoto">—</span>'}</div>`; }).join('')}</div>
    ${D.orario.length ? `<div class="ld-orari">${D.orario.map(o => `<div class="ld-or"><span class="t"><b>${esc(o.corso)}</b><span>${o.giorni.map(g => GIORNI_BREVI[g]).join(', ')} · ${o.inizio}–${o.fine}${o.aula ? ' · aula ' + esc(o.aula) : ''}</span></span><button type="button" class="ld-x" data-via="${o.id}" aria-label="Togli ${esc(o.corso)}">${IC.chiudi}</button></div>`).join('')}</div>` : ''}
    <form class="ld-or-form"><input name="corso" list="ld-corsi" placeholder="Corso" aria-label="Corso" required><datalist id="ld-corsi">${corsi.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="ld-giorni" role="group" aria-label="Giorni">${[1, 2, 3, 4, 5, 6].map(g => `<label><input type="checkbox" name="g" value="${g}"><span>${GIORNI_BREVI[g].slice(0, 2)}</span></label>`).join('')}</div>
      <input name="inizio" type="time" value="09:00" aria-label="Inizio" required><input name="fine" type="time" value="11:00" aria-label="Fine" required><input name="aula" placeholder="Aula" aria-label="Aula"><button class="btn" type="submit">Aggiungi</button></form>
    <p class="ld-nota">${V.attivo ? 'L\'orario è anche nel vault, in «Orario.md»: puoi cambiarlo da Obsidian.' : 'Oppure scrivi: «lezione analisi 2 lunedì e mercoledì 9-11 aula 7».'}</p>`);
  s.querySelectorAll('[data-via]').forEach(b => b.addEventListener('click', () => { D.orario = D.orario.filter(o => o.id !== b.dataset.via); salva(); V.scriviOrario(); comprimi(b.closest('.ld-or'), 300); aggiornaTutto(); }));
  s.querySelector('form').addEventListener('submit', ev => {
    ev.preventDefault(); const f = new FormData(ev.target), giorni = f.getAll('g').map(Number);
    if (!giorni.length) { s.querySelector('.ld-giorni').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 260 }); return; }
    const o = aggiungiOrario({ corso: f.get('corso'), giorni, inizio: f.get('inizio'), fine: f.get('fine'), aula: f.get('aula') }); V.scriviOrario();
    mostraFatto({ testo: `${o.corso} in orario.`, nota: `${o.giorni.map(g => GIORNI_BREVI[g]).join(', ')} · ${o.inizio}–${o.fine}` }); aggiornaTutto();
    nuovoTurno(); schedaOrario();
  });
  if (A.turno) A.turno.dataset.sintesi = `${D.orario.length} lezioni a settimana`;
}

/* ---------- cattura veloce in aula ---------- */
const CATTURE = { stella: ['★ Da esame', 'Cosa ha detto il prof che sarà all\'esame?'], definizione: ['Definizione', 'Termine: definizione'], domanda: ['Domanda', 'La domanda da fare al prof'] };
export function cattura(tipo) {
  A.cattura = tipo; apri({ fisso: true });
  campo.dataset.cattura = tipo;
  let chip = campo.querySelector('.ld-tipo'); if (!chip) { chip = h('span', 'ld-tipo'); campo.querySelector('.cerca').prepend(chip); }
  chip.textContent = CATTURE[tipo][0];
  const inp = campo.querySelector('input'); inp.placeholder = CATTURE[tipo][1];
  requestAnimationFrame(() => inp.focus({ preventScroll: true }));
}
function fineCattura() { A.cattura = null; delete campo.dataset.cattura; campo.querySelector('.ld-tipo')?.remove(); campo.querySelector('input').placeholder = 'Chiedi o scrivi un comando…'; }
async function salvaCattura(tipo, testo, { termine, corso } = {}) {
  if (tipo === 'definizione' && !termine) { const m = testo.match(/^(.+?)\s*(?:::|:|=|→|—)\s*(.+)$/); if (!m) { rispostaFissa('Scrivila così: **termine: definizione**.'); return false; } termine = m[1]; testo = m[2]; }
  let l; try { l = await V.annota(tipo, testo, { termine, corso }); } catch (e) { rispostaFissa('Non riesco a scrivere nel vault: ' + e.message, { errore: true }); return false; }
  const dove = l.corso === 'Appunti sparsi' ? 'negli appunti sparsi di oggi' : `in ${l.corso}`;
  const testoFatto = tipo === 'stella' ? `★ Segnato ${dove}.` : tipo === 'definizione' ? `«${termine.trim().replace(/^./, c => c.toUpperCase())}» ${dove}.` : `Domanda salvata ${dove}.`;
  aggiornaTutto();
  return { testo: testoFatto, l };
}

/* ---------- trascrivere la lezione ---------- */
async function avviaTrascrizione(opz = {}) {
  if (!V.attivo) return rispostaFissa('La trascrizione delle lezioni è nell\'**app desktop** di Lode: scrive direttamente nella nota Obsidian della lezione.');
  if (TR.attiva()) return mostraFatto({ testo: 'Sto già trascrivendo.', nota: `${TR.stato().parole} parole finora.` });
  const l = opz.lezione || V.lezioneDaAnnotare();
  if (!opz.daFile && !(await consensoAula())) return;
  try {
    if (!Voce.pronta()) { modo('pensa', 'Preparo la voce…'); }
    await TR.avvia(l, opz); modo('riposo');
    try { localStorage.setItem('lode:voce', '1'); } catch { }
    if (opz.daFile) {   // una registrazione: si trascrive tutta, poi si chiude da sola
      await mostraFatto({ testo: `Trascrivo «${opz.daFile}» nella lezione di ${l.corso}.`, nota: 'Puoi chiudere il pannello: ti avviso alla fine.', sintesi: 'registrazione in trascrizione' });
      aggiornaTutto();
      await new Promise(ok => { const g = () => { const t = TR.stato(); if (!t || (!t.coda && !TR.occupata())) ok(); else setTimeout(g, 500); }; setTimeout(g, 800); });
      return fermaTrascrizione();
    }
    await mostraFatto({ testo: `Trascrivo ${l.corso === 'Appunti sparsi' ? 'gli appunti sparsi' : 'la lezione di ' + l.corso}.`, nota: 'Le righe arrivano nella nota ogni 20-30 secondi.', azione: ['Apri in Obsidian', () => apriAppunti(l)], sintesi: 'trascrizione avviata' });
    segnala('focus'); aggiornaTutto();
    if (!opz.audioProva) dopo(1200, () => { if (A.aperto && !A.attesa) chiudi('Trascrivo la lezione'); });
  } catch (e) { modo('riposo'); rispostaFissa('Non riesco a trascrivere: ' + (/Permission|NotAllowed/i.test(e.name + e.message) ? 'serve il permesso del microfono (Impostazioni di sistema > Privacy > Microfono).' : e.message), { errore: true }); }
}
async function fermaTrascrizione() {
  if (!TR.attiva()) return rispostaFissa('Non sto trascrivendo niente.');
  modo('pensa', 'Trascrivo gli ultimi secondi…');
  const l = TR.stato().lezione, r = await TR.ferma(); modo('riposo'); segnala('fatto'); aggiornaTutto();
  await mostraFatto({ testo: `Lezione trascritta: ${r.parole.toLocaleString('it-IT')} parole.`, nota: 'È tutto nella nota.', azione: AI.attiva() ? ['Riordina', () => { nuovoTurno(); detto(A.turno, 'Riordina la lezione'); riordinaLezione(null, l); }] : ['Condividi', () => { nuovoTurno(); detto(A.turno, 'Condividi la sbobina'); condividiLezione(l.corso); }], sintesi: `${r.parole} parole trascritte` });
  if (!(D.imp.ripetiInAula && lezioneOra())) O.spegni();   // il microfono resta acceso solo se serve a «Ripeti» in aula
  if (!AI.attiva()) rispostaFissa('Con il **cervello locale** (da «Prepara Lode») la trascrizione diventa appunti ordinati, definizioni e ★ con un clic.');
}
async function riordinaLezione(corso, lez) {
  await new Promise(r => setTimeout(r, 600));   // il vault rilegge la nota appena scritta
  const l = lez ? (lezioni().find(x => x.file && norm(x.corso) === norm(lez.corso) && x.data === lez.data) || lez) : lezioni().find(x => (x.paroleTrascritte || 0) >= 40 && (!corso || norm(x.corso) === norm(corso)));
  if (!l?.trascrizione || l.paroleTrascritte < 30) return rispostaFissa(corso ? `Non trovo una trascrizione di **${corso}**.` : 'Non trovo una lezione trascritta. In aula premi **Trascrivi la lezione**.');
  if (!AI.attiva()) return rispostaFissa('Per riordinare serve l\'AI: installa il **cervello locale** da «Prepara Lode» (gratis, offline) o aggiungi una chiave Claude.');
  modo('pensa', `Riordino ${l.corso}…`); segnala('pensa');
  let md;
  try { md = await AI.riordina({ corso: l.corso, testo: l.trascrizione, appunti: l.appunti, avanza: p => modo('pensa', `Riordino ${l.corso}… ${Math.round(p * 100)}%`) }); }
  catch (e) { modo('riposo'); return rispostaFissa('Non sono riuscito a riordinare: ' + e.message, { errore: true }); }
  modo('riposo');
  const card = schedaConferma({ titolo: `Salvare gli appunti riordinati di ${l.corso}?`, extra: `<div class="ld-anteprima">${mdHtml(md.slice(0, 1400))}${md.length > 1400 ? '<span class="ld-tenue"> …</span>' : ''}</div>`,
    nota: `Vanno nella nota, in «Appunti riordinati da Lode», sotto la trascrizione (che resta). Li ha scritti ${AI.motore() === 'locale' ? 'il modello locale' : 'Claude'}: rileggili.` });
  await attendiDecisione(card, async () => {
    await V.annota('riordinati', md, { lezione: l, grezza: true });
    await mostraFatto({ testo: 'Appunti salvati nella nota.', azione: ['Condividi', () => { nuovoTurno(); detto(A.turno, 'Condividi la sbobina'); condividiLezione(l.corso); }], sintesi: 'lezione riordinata' }, card);
    nuovoTurno(); detto(A.turno, 'Definizioni dalla lezione');
    return chiudiLezione(l.corso, { lezione: l, testo: md.slice(0, 9000) });
  });
}

/* ---------- «Ripeti»: cosa ha appena detto il prof ---------- */
async function consensoAula() {
  if (D.imp.trascrizioneOk) return true;
  const card = schedaConferma({ titolo: 'Ascoltare la lezione?', fuoco: false,
    righe: [['Ripeti', 'tengo in memoria solo gli ultimi 60 secondi, mai su disco'], ['Trascrivi', 'scrivo la lezione nella nota, l\'audio non si salva'], ['Dove', 'tutto sul computer, niente su internet']],
    nota: 'Registrare una lezione dipende dal regolamento del tuo ateneo e dal docente: chiedi prima.' });
  card.dataset.soloClic = '1'; card.querySelector('.az small').textContent = 'Te lo chiedo solo la prima volta.';
  const r = await attendiDecisione(card, async () => { D.imp.trascrizioneOk = true; salva(); await mostraFatto({ testo: 'D\'accordo.' }, card); return { ok: true }; });
  return !!r?.ok;
}
async function accendiRipeti() {
  if (!V.attivo) return rispostaFissa('«Ripeti» è nell\'**app desktop** di Lode.');
  if (!(await consensoAula())) return;
  try { await O.accendi(); D.imp.ripetiInAula = true; salva(); Voce.prepara().catch(() => { }); aggiornaTutto(); }
  catch (e) { return rispostaFissa('Serve il permesso del microfono: Impostazioni di sistema > Privacy > Microfono.', { errore: true }); }
  return mostraFatto({ testo: 'Ripeti è attivo.', nota: `Tengo gli ultimi 60 secondi. Ti sei perso qualcosa? ${MAC ? '⌃⌥P' : 'Ctrl Alt P'} o «ripeti».`, sintesi: 'ripeti attivo' });
}
function spegniRipeti() { D.imp.ripetiInAula = false; salva(); if (!TR.attiva()) O.spegni(); aggiornaTutto(); return mostraFatto({ testo: 'Ripeti spento.', nota: 'Il microfono è chiuso.' }); }
async function ripeti(sec = 60) {
  if (!O.attivo()) return accendiRipeti();
  if (O.secondi() < 1) return rispostaFissa('Ascolto da un attimo: non ho ancora niente da ripeterti.');
  const quando = new Date(), audio = O.ultimi(sec);
  modo('pensa', `Riascolto gli ultimi ${Math.round(Math.min(sec, O.secondi()))} secondi…`); segnala('pensa');
  let testo = ''; try { testo = await Voce.trascriviAudio(audio); } catch (e) { modo('riposo'); return rispostaFissa('Non sono riuscito a riascoltare: ' + e.message, { errore: true }); }
  modo('riposo');
  if (!testo) return rispostaFissa('Negli ultimi 60 secondi non ho sentito parlare.');
  const f = parlatoInFormule(testo), hh = `${String(quando.getHours()).padStart(2, '0')}:${String(quando.getMinutes()).padStart(2, '0')}`;
  const s = scheda('ld-ripeti', `<span class="ld-lbl">Gli ultimi ${Math.round(Math.min(sec, audio.length / 16000))} secondi · ${hh}</span><p class="ld-detto-prof">${mdHtml(f)}</p>
    <div class="az"><button type="button" class="btn primary" data-r="appunti">Agli appunti</button><button type="button" class="btn" data-r="stella">★ Da esame</button><button type="button" class="btn" data-r="copia">Copia</button></div>`);
  s.querySelector('[data-r=copia]').addEventListener('click', e => { navigator.clipboard.writeText(f).then(() => { e.target.textContent = 'Copiato'; }); });
  s.querySelector('[data-r=appunti]').addEventListener('click', async e => { e.target.disabled = true; const l = await V.annota('appunti', `- **${hh}** ${f}`, { grezza: true }); mostraFatto({ testo: `Negli appunti di ${l.corso}.` }); });
  s.querySelector('[data-r=stella]').addEventListener('click', async e => { e.target.disabled = true; const l = await V.annota('stella', f); mostraFatto({ testo: `★ Segnato in ${l.corso}.` }); aggiornaTutto(); });
  if (A.turno) A.turno.dataset.sintesi = f.slice(0, 80);
}

/* ---------- condividere la sbobina ---------- */
async function condividiLezione(corso) {
  if (!V.attivo) return rispostaFissa('Le sbobine si condividono dall\'**app desktop**.');
  const l = lezioni().find(x => x.file && (!corso || norm(x.corso) === norm(corso)) && ((x.paroleTrascritte || 0) > 20 || x.riordinata || (x.definizioni || []).length));
  if (!l) return rispostaFissa(corso ? `Non trovo una lezione di **${corso}** da condividere.` : 'Non trovo una lezione da condividere: prima trascrivila o riordinala.');
  modo('pensa', 'Preparo la sbobina…');
  try {
    const sb = SB.crea(await V.leggiNota(l.file), { autore: D.profilo.nome }), pagina = await SB.html(sb);
    const a = await V.salvaFile(`Sbobine/${sb.nome}.md`, { testo: sb.md, sostituisci: true }), b = await V.salvaFile(`Sbobine/${sb.nome}.html`, { testo: pagina, sostituisci: true });
    modo('riposo'); const r = await V.condividi([b.file, a.file]);
    return mostraFatto({ testo: `Sbobina di ${l.corso} pronta.`, nota: r.esito === 'menu' ? 'Scegli dove mandarla: AirDrop, Messaggi, Mail…' : 'È nella cartella Sbobine del vault.', azione: ['Mostra', () => V.condividi([b.file, a.file])], sintesi: 'sbobina condivisa' });
  } catch (e) { modo('riposo'); return rispostaFissa('Non riesco a preparare la sbobina: ' + e.message, { errore: true }); }
}

/* ---------- i file lasciati sulla pillola ---------- */
const ICONA_FILE = { pdf: 'doc', slide: 'doc', word: 'doc', testo: 'doc', sbobina: 'appunti', carte: 'ripasso', foto: 'foto', audio: 'audio', altro: 'doc' };
const NOME_TIPO = { pdf: 'PDF', slide: 'slide PowerPoint', word: 'documento Word', testo: 'testo', sbobina: 'sbobina di Lode', carte: 'carte (Anki/CSV)', foto: 'foto', audio: 'registrazione audio', altro: 'file' };
function corsiPossibili() {
  const c = new Map(); const metti = n => { if (n && n !== 'Appunti sparsi' && !c.has(norm(n))) c.set(norm(n), n); };
  const lo = lezioneOra(); metti(lo?.corso); metti(V.lezioneDaAnnotare().corso); metti(prossimi()[0]?.nome);
  D.orario.forEach(o => metti(o.corso)); lezioni().forEach(l => metti(l.corso)); daFare().forEach(e => metti(e.nome));
  return [...c.values()];
}
const isoDi = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export async function riceviFile(lista) {
  const tutti = [...lista].filter(f => f.size > 0);
  if (!tutti.length) return;
  const f = tutti[0];
  await apri({ fisso: true }); nuovoTurno(); detto(A.turno, f.name);
  if (tutti.length > 1) rispostaFissa(`Uno alla volta: comincio da **${f.name}**, poi lascia gli altri ${tutti.length - 1}.`);
  let x; try { x = await FILE.classifica(f); } catch (e) { return rispostaFissa('Non riesco a leggere il file: ' + e.message, { errore: true }); }
  schedaFile(x);
}
function opzioniPer(x) {
  const ai = AI.attiva(), app = V.attivo, serveAI = ai ? '' : 'serve il cervello locale o Claude', serveApp = app ? '' : 'nell\'app desktop';
  const testo = ['pdf', 'slide', 'word', 'testo'].includes(x.tipo);
  if (x.tipo === 'sbobina') return [{ k: 'sbobina', t: 'Aggiungi al mio vault', d: 'Diventa una lezione nel tuo Obsidian: definizioni e ★ entrano nei giochi', no: serveApp, primo: true }, { k: 'allega', t: 'Allega soltanto', d: 'Salvo il file negli allegati della lezione', no: serveApp }];
  if (x.tipo === 'carte') return [{ k: 'importaCarte', t: 'Importa le carte', d: 'Una per riga: domanda, poi Tab, «;» o « = », poi risposta', primo: true }];
  if (x.tipo === 'audio') return [{ k: 'audio', t: 'Trascrivi la registrazione', d: 'Tutta la lezione in appunti, formule comprese, nella nota della lezione', no: app ? '' : serveApp, primo: true, corso: true, data: true }, { k: 'allega', t: 'Allega alla lezione', d: 'Salvo l\'audio negli allegati, con il link nella nota', no: serveApp, corso: true }];
  if (x.tipo === 'foto') return [{ k: 'lavagna', t: 'Trascrivi in appunti', d: 'Testo e formule in LaTeX, nella nota della lezione', no: serveAI || serveApp, primo: true, corso: true }, { k: 'carte', t: 'Carte del ripasso', d: 'Le domande che chiederebbero all\'esame', no: serveAI }, { k: 'allega', t: 'Allega alla lezione', d: 'La foto nella nota della lezione', no: serveApp, corso: true }];
  if (testo) return [
    { k: 'carte', t: 'Carte del ripasso', d: 'Domande e risposte per il ripasso a intervalli', no: serveAI, primo: true },
    { k: 'riassunto', t: 'Riassunto in Obsidian', d: 'Appunti ordinati con formule, in una nota nuova', no: serveAI || serveApp, corso: true },
    { k: 'definizioni', t: 'Definizioni per i giochi', d: 'Le aggiungo alla lezione: diventano giochi di memoria', no: serveAI || serveApp, corso: true },
    { k: 'orale', t: 'Interrogami su questo', d: 'Un prof d\'orale con domande su questo materiale', no: serveAI },
    { k: 'allega', t: 'Allega alla lezione', d: 'Salvo il file con il link nella nota', no: serveApp, corso: true },
  ];
  return [];
}
function schedaFile(x) {
  if (x.tipo === 'altro') return rispostaFissa(`Questo non lo so usare: ${x.motivo}.`);
  const op = opzioniPer(x), corsi = corsiPossibili(), serveCorso = op.some(o => o.corso), serveData = op.some(o => o.data);
  const s = scheda('ld-file-op', `<div class="capo">${ico(ICONA_FILE[x.tipo] || 'doc')}<span class="t"><b>${esc(x.nome)}</b><span>${NOME_TIPO[x.tipo]} · ${x.mb < 1 ? Math.max(1, Math.round(x.mb * 1024)) + ' KB' : x.mb.toFixed(1).replace('.', ',') + ' MB'}</span></span></div>
    <span class="ld-lbl">Cosa ne faccio?</span>
    <div class="ld-opzioni">${op.map(o => `<button type="button" class="ld-op${o.primo && !o.no ? ' primo' : ''}" data-op="${o.k}"${o.no ? ' disabled' : ''}><b>${esc(o.t)}</b><span>${esc(o.no ? o.d + ' · ' + o.no : o.d)}</span></button>`).join('')}</div>
    ${serveCorso && corsi.length ? `<div class="ld-riga-form ld-per"><span class="ld-lbl">Per</span><select aria-label="Corso">${corsi.map(c => `<option>${esc(c)}</option>`).join('')}</select>${serveData ? `<input type="date" aria-label="Data della lezione" value="${isoDi(x.file.lastModified || Date.now())}">` : ''}</div>` : ''}`);
  s.querySelectorAll('.ld-op').forEach((b, i) => entra(b, { ritardo: 80 + i * 55, dy: 6, blur: 5, ms: 420 }));
  s.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', async () => {
    s.querySelectorAll('[data-op]').forEach(y => { y.disabled = true; y.classList.toggle('scelta', y === b); });
    const corso = s.querySelector('.ld-per select')?.value || corsi[0] || null, data = s.querySelector('.ld-per input[type=date]')?.value;
    try { await usaFile(x, b.dataset.op, { corso, data }); }
    catch (e) { modo('riposo'); rispostaFissa('Non è andata: ' + e.message, { errore: true }); s.querySelectorAll('[data-op]').forEach((y, i) => { y.disabled = !!op[i].no; y.classList.remove('scelta'); }); }
  }));
  if (A.turno) A.turno.dataset.sintesi = `${x.nome}: cosa ne faccio?`;
}
const lezionePer = (corso, data) => {
  const d = data || oggi();
  const v = lezioni().find(l => l.file && norm(l.corso) === norm(corso) && l.data === d);
  if (v) return v;
  const o = D.orario.find(y => norm(y.corso) === norm(corso));
  return { corso: corso || 'Appunti sparsi', data: d, inizio: o?.inizio, fine: o?.fine, aula: o?.aula };
};
async function allegaFile(x, corso) {
  const r = await V.salvaFile(`Allegati/${x.nome}`, { dati: new Uint8Array(await x.file.arrayBuffer()) });
  const nome = r.file.split('/').pop(), l = lezionePer(corso);
  await V.annota('appunti', `- ![[${nome}]]`, { lezione: l, grezza: true });
  return { l, nome };
}
async function usaFile(x, op, { corso, data }) {
  if (op === 'allega') { const r = await allegaFile(x, corso); return mostraFatto({ testo: `Allegato alla lezione di ${r.l.corso}.`, azione: ['Apri', () => apriAppunti(r.l)] }); }
  if (op === 'sbobina') {
    const sb = SB.leggi(x.testo), corsoN = trovaEsame(sb.corso)?.nome || sb.corso;
    const r = await V.salvaFile(`Lezioni/${pulito(corsoN)}/${sb.data} ${pulito(corsoN)} · sbobina${sb.da ? ' di ' + pulito(sb.da) : ''}.md`, { testo: sb.nota });
    aggiornaTutto(); segnala('fatto');
    return mostraFatto({ testo: `Sbobina di ${corsoN} nel tuo vault.`, nota: `${dataBreve(sb.data)}${sb.da ? ' · da ' + sb.da : ''}`, azione: ['Apri', () => apriAppunti({ file: r.file, corso: corsoN })], sintesi: 'sbobina ricevuta' });
  }
  if (op === 'importaCarte') {
    const carte = [];
    for (const riga of x.testo.split(/\r?\n/)) { if (!riga.trim() || riga.startsWith('#')) continue; const p = riga.split(/\t| = | → |;(?=[^;]*$)/); if (p.length >= 2 && p[0].trim() && p[1].trim()) carte.push({ fronte: p[0].trim().replace(/^"|"$/g, ''), retro: p.slice(1).join(' ').trim().replace(/^"|"$/g, '') }); }
    if (!carte.length) return rispostaFissa('Non ho trovato righe «domanda, risposta» in questo file.');
    return eseguiStrumento('crea_carte', { carte: carte.slice(0, 30), esame: corso || prossimi()[0]?.nome });
  }
  if (op === 'audio') {
    modo('pensa', 'Apro la registrazione…');
    const audio = await FILE.audioDi(x.file); modo('riposo');
    const l = lezionePer(corso, data);
    return avviaTrascrizione({ audioProva: audio, lezione: l, daFile: x.nome });
  }
  if (op === 'lavagna') {
    modo('pensa', 'Leggo la foto…'); segnala('pensa');
    const blocco = await AI.bloccoFile(x.file), md = await AI.trascriviFoto({ blocco, corso }); modo('riposo');
    const card = schedaConferma({ titolo: `Mettere negli appunti di ${corso}?`, extra: `<div class="ld-anteprima">${mdHtml(md.slice(0, 1400))}</div>`, nota: 'Insieme alla foto, nella nota della lezione di oggi. Rileggila: l\'ha trascritta ' + (AI.motore() === 'locale' ? 'il modello locale.' : 'Claude.') });
    return attendiDecisione(card, async () => { const r = await allegaFile(x, corso); await V.annota('appunti', md, { lezione: r.l, grezza: true }); await mostraFatto({ testo: 'Lavagna negli appunti.', azione: ['Apri', () => apriAppunti(r.l)] }, card); return {}; });
  }
  // da qui serve il testo del file
  modo('pensa', `Leggo ${x.nome}…`); segnala('pensa');
  let testo = null, blocchi;
  if (x.tipo === 'foto') blocchi = [await AI.bloccoFile(x.file)];
  else {
    try { testo = await FILE.testoDi(x); blocchi = [{ type: 'text', text: `[${x.nome}]\n${testo.slice(0, 120000)}` }]; }
    catch (e) { if (x.tipo === 'pdf' && AI.motore() === 'claude') blocchi = [await AI.bloccoFile(x.file)]; else throw e; }
  }
  if (op === 'carte') {
    modo('pensa', 'Scrivo le carte…');
    const carte = await AI.carteDa(blocchi); modo('riposo');
    if (!carte.length) return rispostaFissa('Da questo file non ho tirato fuori carte.');
    return eseguiStrumento('crea_carte', { carte, esame: corso || prossimi()[0]?.nome });
  }
  if (op === 'definizioni') { modo('riposo'); return chiudiLezione(corso, { lezione: lezionePer(corso), testo: (testo || '').slice(0, 9000) }); }
  if (op === 'orale') { modo('riposo'); return avviaOrale(trovaEsame(corso || '') || { id: null, nome: corso || x.nome }, null, (testo || '').slice(0, 30000)); }
  if (op === 'riassunto') {
    const md = await AI.riassumi({ corso, testo, nome: x.nome, avanza: p => modo('pensa', `Riassumo ${x.nome}… ${Math.round(p * 100)}%`) }); modo('riposo');
    const card = schedaConferma({ titolo: `Salvare il riassunto in Obsidian?`, extra: `<div class="ld-anteprima">${mdHtml(md.slice(0, 1400))}${md.length > 1400 ? '<span class="ld-tenue"> …</span>' : ''}</div>`, nota: `Nota nuova in Materiali/${pulito(corso || 'Varie')}, con il file originale allegato.` });
    return attendiDecisione(card, async () => {
      const al = await V.salvaFile(`Allegati/${x.nome}`, { dati: new Uint8Array(await x.file.arrayBuffer()) });
      const n = await V.salvaFile(`Materiali/${pulito(corso || 'Varie')}/${x.nome.replace(/\.[^.]+$/, '')}.md`, { testo: `---\ntipo: materiale\ncorso: "[[${pulito(corso || '')}]]"\nfonte: "[[${al.file.split('/').pop()}]]"\ntags: [materiale]\n---\n# ${x.nome.replace(/\.[^.]+$/, '')}\n\n[[${pulito(corso || 'Home')}]] · file originale: ![[${al.file.split('/').pop()}]]\n\n${md}\n` });
      await mostraFatto({ testo: 'Riassunto salvato.', azione: ['Apri', () => apriAppunti({ file: n.file, corso: x.nome })] }, card); return {};
    });
  }
}

/* ---------- la zona dove lasciare i file: la pillola si allarga ---------- */
function zonaOn() {
  if (A.zona) return; A.zona = true; shell.classList.add('drop');
  if (!A.aperto) { forma.w.t = Math.min(470, innerWidth - 16); forma.h.t = 148; forma.r.t = 24; molla(); }
  entra(shell.querySelector('.ld-zona-in'), { dy: 6, blur: 6, ms: 420, scala: .97 });
  segnala('conferma-pronta');
}
function zonaOff() {
  if (!A.zona) return; A.zona = false; shell.classList.remove('drop', 'sopra');
  if (!A.aperto) { forma.w.t = larghezza(); forma.h.t = 36; forma.r.t = 18; molla(); }
}

/* ---------- preparare il computer: Obsidian e il cervello locale ---------- */
let STATO = null;
async function aggiornaStato() { if (!V.attivo) return; try { STATO = await V.stato(); AI.impostaLocale(STATO.modello); } catch { } if (A?.aperto && A.home) disegnaHome(); }
const avanzamenti = {};
function schedaPrepara(cosa) {
  if (!V.attivo) return rispostaFissa('Obsidian e il cervello locale si installano dall\'**app desktop** di Lode.');
  const st = STATO, m = st?.consigliato;
  const riga = (k, titolo, pronto, dett, b) => `<div class="ld-prep${pronto ? ' ok' : ''}" data-k="${k}"><i class="ld-seg"></i><div class="t"><b>${titolo}</b><span class="d">${dett}</span><i class="ld-prog"><i></i></i></div>${b}</div>`;
  const s = scheda('ld-prepara', `<span class="ld-lbl">Prepara Lode</span>
    ${riga('vault', 'Il tuo vault', true, esc(V.info?.percorso || 'Documenti/Lode') + ' · Home, corsi, lezioni, glossario', '<button type="button" class="btn small" data-apri>Apri</button>')}
    ${riga('obsidian', 'Obsidian', st?.obsidian.installato, st?.obsidian.installato ? 'Installato e collegato al vault' : 'Gratis per uso personale · installer ufficiale da GitHub, circa 230 MB', st?.obsidian.installato ? '<button type="button" class="btn small" data-apri>Apri</button>' : '<button type="button" class="btn small primary" data-installa="obsidian">Installa</button>')}
    ${riga('cervello', 'Cervello locale', !!st?.modello, st?.modello ? `${esc(st.modello)} · gira sul computer, senza internet` : `Ollama + ${esc(m?.etichetta || 'Gemma 3')}, ${esc(m?.perche || '')} · circa ${m ? String(m.gb + 0.2).replace('.', ',') : '3,5'} GB`, st?.modello ? '<span class="ld-spunta">pronto</span>' : '<button type="button" class="btn small primary" data-installa="cervello">Installa</button>')}
    ${riga('voce', 'Voce', Voce.pronta(), Voce.pronta() ? 'Whisper in locale · tieni premuto ' + TASTI + ' e parla' : `Whisper ${Voce.MODELLO_VOCE.endsWith('small') ? 'small' : 'base'} in locale, in italiano · circa ${Voce.MODELLO_VOCE.endsWith('small') ? '600' : '200'} MB, una volta sola`, Voce.pronta() ? '<span class="ld-spunta">pronta</span>' : '<button type="button" class="btn small primary" data-voce>Prepara</button>')}
    <p class="ld-nota">${AI.motore() === 'claude' ? 'Hai anche Claude attivo: per spiegazioni e orale usa quello, il cervello locale lavora offline.' : 'Il cervello locale estrae le definizioni dagli appunti, crea carte, spiega e ti interroga. Tutto resta sul computer.'}</p>`);
  s.querySelectorAll('[data-apri]').forEach(b => b.addEventListener('click', () => apriAppunti({ file: 'Home.md', corso: 'Home' })));
  s.querySelectorAll('[data-installa]').forEach(b => b.addEventListener('click', () => chiediInstalla(b.dataset.installa, s)));
  s.querySelector('[data-voce]')?.addEventListener('click', () => { mostraAvanzamento(s, 'voce', { testo: 'Scarico Whisper…', p: 0 }); Voce.prepara().then(() => { try { localStorage.setItem('lode:voce', '1'); } catch { } }).catch(() => { }); });
  if (cosa && !(cosa === 'obsidian' ? st?.obsidian.installato : st?.modello)) chiediInstalla(cosa, s);
  for (const [k, x] of Object.entries(avanzamenti)) mostraAvanzamento(s, k, x);
  if (A.turno) A.turno.dataset.sintesi = 'prepara Lode';
}
async function chiediInstalla(cosa, s) {
  const m = STATO?.consigliato;
  const card = schedaConferma(cosa === 'obsidian'
    ? { titolo: 'Installare Obsidian?', righe: [['Da', 'github.com/obsidianmd (ufficiale)'], ['Peso', 'circa 230 MB'], ['Dove', STATO?.piattaforma === 'darwin' ? 'Applicazioni' : 'il tuo utente']], nota: 'Obsidian è gratis per uso personale. Si apre già sul tuo vault, sulla Home.', fuoco: false }
    : { titolo: `Installare ${m?.etichetta || 'il cervello locale'}?`, righe: [['Cosa', `Ollama (motore) + ${m?.nome || 'gemma3'}`], ['Peso', `circa ${m ? String(m.gb + 0.2).replace('.', ',') : '3,5'} GB`], ['Perché', m?.perche || '']], nota: 'Si scarica una volta sola. Poi funziona senza internet e senza chiavi.', fuoco: false });
  card.dataset.soloClic = '1'; card.querySelector('.az small').textContent = 'Si conferma solo col clic.';
  await attendiDecisione(card, async () => {
    await mostraFatto({ testo: 'Avviato.', nota: 'Puoi chiudere il pannello: continuo da solo.' }, card);
    const r = await V.installa(cosa);
    await aggiornaStato();
    if (r.esito === 'ok') { segnala('confermato'); mostraAvviso(cosa === 'obsidian' ? 'Obsidian è pronto' : 'Cervello locale pronto'); }
    else if (r.esito === 'errore') rispostaFissa(`Non è andata: ${r.errore}`, { errore: true });
    return r;
  });
}
function mostraAvanzamento(s, cosa, x) {
  const r = s?.querySelector(`.ld-prep[data-k="${cosa}"]`); if (!r) return;
  r.classList.add('va'); r.querySelector('.d').textContent = x.testo || '';
  r.querySelector('.ld-prog i').style.transform = `scaleX(${(x.p ?? 0).toFixed(3)})`;
  if (x.fase === 'fatto') { r.classList.remove('va'); r.classList.add('ok'); r.querySelector('.btn.primary')?.replaceWith(h('span', 'ld-spunta', 'pronto')); }
  if (x.fase === 'errore') r.classList.remove('va');
}

/* ---------- navigare il vault ---------- */
async function schedaNote(q = '') {
  if (!V.attivo) return apriAppunti();
  const tutte = await V.note(), lo = V.lezioneDaAnnotare(), ultima = lezioni().find(l => l.file);
  const rapide = [['Home', 'Home.md'], [lo.corso === 'Appunti sparsi' ? (ultima ? 'Ultima lezione' : null) : `Lezione di ${lo.corso}`, lo.corso === 'Appunti sparsi' ? ultima?.file : null], ['Orario', 'Orario.md'], ['Esami', 'Esami.md'], ['Glossario', 'Glossario.md'], ['Cosa sa Lode di me', 'Lode/Memoria.md']].filter(x => x[0]);
  const s = scheda('ld-note', `<span class="ld-lbl">Vai a… · ${tutte.length} note</span>
    <div class="ld-rapide">${rapide.map(([t, f], i) => `<button type="button" class="ld-chip larga" data-r="${i}"><b>${esc(t)}</b><span>${esc(f ? f.replace(/\.md$/, '').split('/').slice(0, -1).join('/') || 'vault' : 'oggi')}</span></button>`).join('')}</div>
    <input class="ld-cerca-note" placeholder="Cerca una nota: corso, lezione, data…" aria-label="Cerca una nota" value="${esc(q)}"><div class="ld-risultati"></div>`);
  const apriR = i => { const [t, f] = rapide[i]; f ? apriAppunti({ file: f, corso: t }) : apriAppunti(lo); };
  s.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => apriR(+b.dataset.r)));
  const inp = s.querySelector('input'), box = s.querySelector('.ld-risultati');
  const filtra = () => {
    const w = norm(inp.value).split(' ').filter(Boolean);
    const ris = (w.length ? tutte.filter(n => w.every(x => norm(n.file).includes(x))) : tutte.filter(n => n.cartella === 'Lezioni').sort((a, b) => b.titolo.localeCompare(a.titolo))).slice(0, 7);
    box.innerHTML = ris.map((n, i) => `<button type="button" class="ld-nota-r${i === 0 ? ' su' : ''}" data-f="${esc(n.file)}"><b>${esc(n.titolo)}</b><span>${esc(n.file.split('/').slice(0, -1).join(' / ') || 'vault')}</span></button>`).join('') || '<p class="ld-nota">Nessuna nota trovata.</p>';
    box.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => apriAppunti({ file: b.dataset.f, corso: b.querySelector('b').textContent })));
  };
  inp.addEventListener('input', filtra);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); box.querySelector('[data-f]')?.click(); } });
  filtra();
  if (q && box.querySelectorAll('[data-f]').length === 1) box.querySelector('[data-f]').click();
  requestAnimationFrame(() => inp.focus({ preventScroll: true }));
  if (A.turno) A.turno.dataset.sintesi = q ? `cerco «${q}»` : 'note';
}

/* ---------- chiudere una lezione: dagli appunti alle definizioni (con l'AI, anche locale) ---------- */
function daChiudere() {
  if (!AI.attiva() || lezioneOra()) return null;
  const l = lezioni().find(x => x.file && x.data >= piuGiorni(oggi(), -2) && (x.parole || 0) >= 30 && (x.definizioni?.length || 0) < 3 && !(D.imp.chiuse || []).includes(x.file));
  return l || null;
}
async function chiudiLezione(corso, { lezione, testo } = {}) {
  const l0 = lezione || lezioni().find(x => (x.file || x.appunti) && (!corso || norm(x.corso) === norm(corso)) && ((x.parole || 0) >= 10 || (x.paroleTrascritte || 0) >= 60));
  const l = l0 && { ...l0, appunti: testo || (l0.parole >= 10 ? l0.appunti : (l0.trascrizione || '').slice(0, 9000)) };
  if (!l) return rispostaFissa(corso ? `Non trovo appunti di **${corso}** negli ultimi giorni.` : 'Non trovo una lezione con abbastanza appunti: scrivili nella sezione «Appunti» della nota.');
  if (!AI.attiva()) return rispostaFissa('Per leggere gli appunti serve l\'AI: installa il **cervello locale** (gratis, funziona offline) da «Prepara Lode», oppure aggiungi una chiave Claude.');
  modo('pensa', `Leggo gli appunti di ${l.corso}…`); segnala('pensa');
  let r; try { r = await AI.estraiLezione({ corso: l.corso, appunti: l.appunti, gia: (l.definizioni || []).map(d => d.t) }); }
  catch (e) { modo('riposo'); return rispostaFissa('Non sono riuscito a leggere gli appunti: ' + e.message, { errore: true }); }
  modo('riposo');
  if (!r.definizioni.length && !r.daEsame.length) return rispostaFissa('Negli appunti non ho trovato definizioni nuove. Prova a scriverle per esteso, anche brevi.');
  const card = schedaConferma({ titolo: `Aggiungere a ${l.corso} · ${dataBreve(l.data)}?`,
    extra: `<ol class="ld-proposte">${r.definizioni.map(d => `<li><b>${esc(d.termine)}</b><span>${esc(d.definizione)}</span></li>`).join('')}${r.daEsame.map(x => `<li><b>★ ${esc(x)}</b></li>`).join('')}</ol>`,
    nota: `${r.definizioni.length} definizioni${r.daEsame.length ? ` e ${r.daEsame.length} ★` : ''} nella nota della lezione. Controlla che siano giuste: le ha scritte ${AI.motore() === 'locale' ? 'il modello locale' : 'Claude'}.` });
  card.querySelectorAll('.ld-proposte li').forEach((li, i) => entra(li, { ritardo: 100 + Math.min(i, 12) * 55, dy: 6, blur: 5, ms: 420 }));
  await attendiDecisione(card, async () => {
    for (const d of r.definizioni) await V.annota('definizione', d.definizione, { termine: d.termine, lezione: l });
    for (const x of r.daEsame) await V.annota('stella', x, { lezione: l });
    D.imp.chiuse = [...(D.imp.chiuse || []), l.file].slice(-60); salva();
    await mostraFatto({ testo: 'Lezione chiusa.', nota: `${r.definizioni.length} definizioni pronte per i giochi.`, azione: ['Gioca', () => { nuovoTurno(); schedaGioco(l.corso); }], sintesi: `${r.definizioni.length} definizioni` }, card);
    aggiornaTutto(); return {};
  });
}

/* ---------- i giochi di memoria ---------- */
async function apriAppunti(l) {
  if (V.attivo) {
    l ||= V.lezioneDaAnnotare(); if (!A.turno || A.home) nuovoTurno();
    const r = await V.apri(l), nome = l.corso === 'Appunti sparsi' ? 'gli appunti sparsi di oggi' : 'la nota di ' + l.corso;
    if (r.esito === 'ok') return mostraFatto({ testo: `Apro ${nome} in Obsidian.` });
    if (r.esito === 'da_aprire') return rispostaFissa(`Apro ${nome}. Se Obsidian non trova il vault, la prima volta fai **Apri cartella come vault** e scegli la cartella «${r.percorso}»: poi resta collegato.`);
    if (r.esito === 'manca') return rispostaFissa(`Ho aperto ${nome} con l'editor di sistema. Con **Obsidian** (gratis, obsidian.md) il vault «${r.percorso}» è già pronto: cartelle, modelli, orario e la tua memoria.`);
    return rispostaFissa('Non riesco ad aprire la nota: ' + (r.errore || ''), { errore: true });
  }
  rispostaFissa('Gli appunti in Obsidian sono nell\'**app desktop** di Lode: lì ogni lezione diventa una nota del tuo vault, con le ★ e le definizioni che segni dalla barra.');
}
function schedaGioco(corso) {
  const { scelte, tutte } = daGiocare(6, corso);
  if (scelte.length < 2) {
    rispostaFissa(tutte.length ? `Le definizioni ${corso ? 'di ' + (tutte[0]?.corso || corso) + ' ' : ''}per oggi le sai già: tornano quando stanno per scappare.` : `Ancora nessuna definizione${corso ? ' di ' + corso : ''}. In aula premi **Definizione** (o scrivi «def: termine = definizione»), oppure scrivile in Obsidian nella sezione «Definizioni» della lezione.`);
    return;
  }
  const manche = partita(scelte, tutte), corsi = [...new Set(scelte.map(d => d.corso))];
  let i = 0, punti = 0, tot = 0; const t0 = Date.now(), sbagliate = new Set();
  const s = scheda('ld-gioco', `<div class="capo"><span class="ld-lbl">Gioco · ${esc(corsi.length === 1 ? corsi[0] : 'ultime lezioni')}</span><span class="conto"></span></div><i class="ld-prog"><i></i></i><div class="manche"></div>`);
  const box = s.querySelector('.manche'), conto = s.querySelector('.conto'), pr = s.querySelector('.ld-prog i');
  const segna = (d, ok, q) => { tot++; if (ok) punti++; else sbagliate.add(d.t); ricorda(d.k, ok, q); };
  const avanti = () => { i++; tween(140, e => { box.style.opacity = (1 - e).toFixed(3); }).then(() => { box.style.opacity = ''; mostra(); }); };
  const scuoti = el => tween(260, e => { el.style.transform = e >= 1 ? '' : `translateX(${(Math.sin(e * Math.PI * 4) * 4 * (1 - e)).toFixed(2)}px)`; }, { ease: lineare });
  const mostra = () => {
    pr.style.transform = `scaleX(${(i / manche.length).toFixed(4)})`;
    if (i >= manche.length) return fine();
    const m = manche[i]; conto.textContent = `${i + 1} di ${manche.length}`;
    if (m.tipo === 'abbina') {
      const destra = [...m.defs].sort(() => Math.random() - .5);
      box.innerHTML = `<p class="dom">Abbina ogni termine alla sua definizione.</p><div class="ld-abbina"><div class="col">${m.defs.map((d, j) => `<button type="button" class="ld-tess" data-s="${j}">${esc(d.t)}</button>`).join('')}</div><div class="col">${destra.map(d => `<button type="button" class="ld-tess def" data-d="${m.defs.indexOf(d)}">${esc(d.d.length > 92 ? d.d.slice(0, 90) + '…' : d.d)}</button>`).join('')}</div></div>`;
      let sel = null, fatte = 0; const errori = new Set();
      box.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; box.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('sel', x === b)); sel = +b.dataset.s; }));
      box.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => {
        if (sel == null || b.disabled) return; const sx = box.querySelector(`[data-s="${sel}"]`);
        if (+b.dataset.d === sel) {
          [sx, b].forEach(x => { x.disabled = true; x.classList.remove('sel'); x.classList.add('ok'); }); segna(m.defs[sel], !errori.has(sel), errori.has(sel) ? 3 : 4); sel = null; fatte++;
          if (fatte === m.defs.length) { segnala('fatto'); dopo(500, avanti); }
        } else { errori.add(sel); scuoti(b); scuoti(sx); }
      }));
    } else if (m.tipo === 'chi') {
      box.innerHTML = `<p class="dom">Chi sono?</p><p class="def">${esc(m.def.d)}</p><div class="ld-scelte">${m.opzioni.map(o => `<button type="button" class="btn" data-o="${esc(o.k)}">${esc(o.t)}</button>`).join('')}</div>`;
      box.querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => {
        const ok = b.dataset.o === m.def.k; box.querySelectorAll('[data-o]').forEach(x => { x.disabled = true; if (x.dataset.o === m.def.k) x.classList.add('giusta'); });
        if (!ok) { b.classList.add('errata'); scuoti(b); } segna(m.def, ok); segnala(ok ? 'fatto' : 'quiete'); dopo(ok ? 650 : 1500, avanti);
      }));
    } else if (m.tipo === 'completa') {
      box.innerHTML = `<p class="dom">${esc(m.def.t)}: completa la definizione.</p><p class="def">${esc(m.buco.prima)}<input class="ld-buco" aria-label="Parola mancante" autocomplete="off" spellcheck="false" style="width:${Math.max(5, m.buco.parola.length) + 1}ch">${esc(m.buco.dopo)}</p><div class="az"><button type="button" class="btn primary">Controlla <kbd>Invio</kbd></button><button type="button" class="btn ld-piano" data-salta>Non la so</button></div>`;
      const inp = box.querySelector('.ld-buco'), verifica = salta => {
        if (inp.disabled) return; const ok = !salta && giusta(inp.value, m.buco.parola); inp.disabled = true;
        inp.value = m.buco.parola; inp.classList.add(ok ? 'ok' : 'no'); if (!ok) scuoti(inp); segna(m.def, ok); segnala(ok ? 'fatto' : 'quiete'); dopo(ok ? 700 : 1600, avanti);
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); verifica(false); } });
      box.querySelector('.btn.primary').addEventListener('click', () => verifica(false)); box.querySelector('[data-salta]').addEventListener('click', () => verifica(true));
      requestAnimationFrame(() => inp.focus({ preventScroll: true }));
    } else {
      box.innerHTML = `<p class="dom">Te la ricordi?</p><p class="termine">${esc(m.def.t)}</p><p class="def" hidden>${esc(m.def.d)}</p><div class="az"><button type="button" class="btn primary" data-gira>Mostra <kbd>Spazio</kbd></button></div>`;
      const gira = () => { const d = box.querySelector('.def'); if (!d.hidden) return; d.hidden = false; entra(d, { dy: 6, blur: 6, ms: 400 });
        box.querySelector('.az').innerHTML = '<button type="button" class="btn" data-no>Non la sapevo <kbd>1</kbd></button><button type="button" class="btn primary" data-si>La sapevo <kbd>2</kbd></button>';
        box.querySelector('[data-no]').addEventListener('click', () => { segna(m.def, false); avanti(); }); box.querySelector('[data-si]').addEventListener('click', () => { segna(m.def, true); avanti(); }); };
      box.querySelector('[data-gira]').addEventListener('click', gira);
      A.gioco = { gira, vota: k => box.querySelector(k === '1' ? '[data-no]' : '[data-si]')?.click() };
      return entra(box, { dy: 6, blur: 6, ms: 420 });
    }
    A.gioco = null;
    entra(box, { dy: 6, blur: 6, ms: 420 });
  };
  const fine = () => {
    A.gioco = null; salva(); V.scriviMemoria(); aggiornaTutto();
    const sec = Math.round((Date.now() - t0) / 1000);
    box.innerHTML = `<div class="ld-esito"><b>${punti}<small>/${tot}</small></b><span>${punti === tot ? 'Tutte giuste. Queste restano.' : `Da rinforzare: ${[...sbagliate].slice(0, 3).map(esc).join(', ')}. Tornano domani.`}</span><small>${sec < 60 ? sec + ' secondi' : Math.round(sec / 60) + ' min'}</small></div>`;
    entra(box, { dy: 8, blur: 6, ms: 480 }); segnala(punti >= tot - 1 ? 'confermato' : 'quiete');
    if (A.turno) A.turno.dataset.sintesi = `${punti} su ${tot}`;
    const ancora = daGiocare(6, corso).scelte.length;
    if (ancora >= 2) { const b = h('button', 'btn small', 'Ancora una'); b.type = 'button'; b.addEventListener('click', () => { nuovoTurno(); detto(A.turno, 'Gioca ancora'); schedaGioco(corso); }); box.querySelector('.ld-esito').append(b); }
  };
  mostra();
  if (A.turno) A.turno.dataset.sintesi = 'gioco';
}

/* ---------- eseguire un comando locale ---------- */
async function esegui(c) {
  switch (c.tipo) {
    case 'aiuto': return schedaAiuto();
    case 'ferma': { const r = F.ferma(); return r ? mostraFatto({ testo: r.era.fase === 'pausa' ? 'Pausa finita.' : `Fermato dopo ${ore(r.min)}.`, nota: r.min >= 5 && r.era.fase === 'focus' ? 'Li conto nelle ore di studio.' : '', sintesi: 'timer fermato' }) : rispostaFissa('Non c\'è nessun timer acceso.'); }
    case 'sospendi': F.sospendi(); return mostraFatto({ testo: 'Timer in pausa.', nota: 'Scrivi «riprendi» quando torni.' });
    case 'riprendi': F.riprendi(); return mostraFatto({ testo: 'Si riparte.' });
    case 'focus': {
      if (c.nomeDetto && !c.esame) return rispostaFissa(`Non trovo **${c.nomeDetto}** tra i tuoi esami. Faccio partire lo studio libero? Scrivi «focus ${c.min || D.imp.focus}».`);
      if (!c.min && !c.esame) return schedaFocus();
      return avviaFocus({ min: c.min || D.imp.focus, esameId: c.esame?.id || null, dove: null });
    }
    case 'voto': case 'idoneita': {
      const ann = istantanea(); let e = c.esame, nuovo = false;
      if (!e) { if (!c.nomeDetto) return rispostaFissa('Di quale esame?'); e = aggiungiEsame({ nome: c.nomeDetto, cfu: 6 }); nuovo = true; }
      const prima = media();
      registraVoto(e.id, c.tipo === 'idoneita' ? { idoneita: true } : { voto: c.voto, lode: c.lode });
      const dopo = media(), d = prima.ponderata != null && dopo.ponderata != null ? dopo.ponderata - prima.ponderata : null;
      await mostraFatto({ testo: c.tipo === 'idoneita' ? `${e.nome}: idoneità registrata.` : `${c.voto}${c.lode ? ' e lode' : ''} in ${e.nome}.`, nota: nuovo ? 'Nuovo esame da 6 CFU: correggi i CFU nel libretto.' : (d != null ? `Media ${num(dopo.ponderata, 2)} (${d >= 0 ? '+' : '−'}${num(Math.abs(d), 2)})` : ''), annulla: ann, sintesi: `${e.nome}: ${c.tipo === 'idoneita' ? 'idoneità' : c.voto}` });
      segnala('fatto'); aggiornaTutto();
      if (c.voto >= 28 || c.lode) rispostaFissa(c.lode ? 'Trenta e lode. Questa si festeggia.' : 'Bel colpo. Respira oggi, domani si riparte.');
      return schedaLibretto();
    }
    case 'esame': {
      const ann = istantanea(); let e = c.esistente && !c.esistente.fatto ? c.esistente : null;
      if (e) { if (c.data) e.data = c.data; if (c.cfu) e.cfu = c.cfu; salva(); }
      else e = aggiungiEsame({ nome: c.nome, cfu: c.cfu || 6, data: c.data });
      await mostraFatto({ testo: `${e.nome}${c.esistente && !c.esistente.fatto ? ' aggiornato' : ' aggiunto'}.`, nota: `${e.data ? cap(dataLunga(e.data)) + ' · ' : 'senza data · '}${e.cfu} CFU${!c.cfu && !c.esistente ? ' (cambiali se sono di più)' : ''}`, annulla: ann, sintesi: `${e.nome} ${e.data ? traQuanto(e.data) : ''}` });
      aggiornaTutto();
      if (e.data) { const p = piano(e); rispostaFissa(`Per arrivarci pronto: circa **${num(p.perGiorno)} h al giorno** (${p.tot} h in tutto, le cambi dal piano).`); }
      return;
    }
    case 'carta': {
      aggiungiCarta({ esameId: c.esame?.id || null, fronte: c.fronte, retro: c.retro }); salva(); aggiornaTutto();
      return mostraFatto({ testo: 'Carta aggiunta.', nota: c.esame ? c.esame.nome : 'senza esame', annulla: (() => { const id = D.carte.at(-1).id; return () => { D.carte = D.carte.filter(x => x.id !== id); salva(); }; })() });
    }
    case 'simula': return schedaSimula(c);
    case 'serve': return schedaLibretto({ base: c.base });
    case 'libretto': return schedaLibretto();
    case 'esami': case 'oggi': return schedaEsami();
    case 'apriEsame': return c.esame.fatto ? schedaLibretto() : schedaEsami();
    case 'ripasso': {
      if (c.nomeDetto && !c.esame) return rispostaFissa(`Non trovo **${c.nomeDetto}** tra i tuoi esami.`);
      return schedaRipasso(c.esame?.id);
    }
    case 'orale': return avviaOrale(c.esame, c.nomeDetto);
    case 'stella': case 'domanda': case 'definizione': {
      const r = await salvaCattura(c.tipo, c.testo, { termine: c.termine }); if (!r) return;
      return mostraFatto({ testo: r.testo, nota: V.attivo ? 'Nella nota della lezione.' : '', azione: V.attivo ? ['Apri', () => apriAppunti(r.l)] : null, sintesi: r.testo });
    }
    case 'orario': {
      const o = aggiungiOrario(c); V.scriviOrario(); aggiornaTutto();
      await mostraFatto({ testo: `${o.corso} in orario.`, nota: `${o.giorni.map(g => GIORNI_BREVI[g]).join(', ')} · ${o.inizio}–${o.fine}${o.aula ? ' · aula ' + o.aula : ''}`, sintesi: `${o.corso} in orario` });
      return rispostaFissa('Quando sei a lezione la barra lo sa: si apre sulla cattura veloce (★ da esame, definizioni, domande) e a casa ti propone due minuti di gioco su quello che hai appena fatto.');
    }
    case 'vediOrario': return schedaOrario();
    case 'gioco': return schedaGioco(c.corso);
    case 'appunti': return apriAppunti();
    case 'naviga': return schedaNote(c.q);
    case 'chiudiLezione': return chiudiLezione(c.corso);
    case 'prepara': return schedaPrepara(c.cosa);
    case 'trascrivi': return avviaTrascrizione();
    case 'ripeti': return ripeti(c.sec || 60);
    case 'spegniRipeti': return spegniRipeti();
    case 'condividi': return condividiLezione(c.corso);
    case 'fineTrascrizione': return fermaTrascrizione();
    case 'pausaTrascrizione': TR.pausa(); return mostraFatto({ testo: 'Trascrizione in pausa.', nota: 'Scrivi «riprendi trascrizione» quando ricomincia.' });
    case 'riprendiTrascrizione': TR.riprendi(); return mostraFatto({ testo: 'Riprendo a trascrivere.' });
    case 'riordina': return riordinaLezione(c.corso);
  }
}

/* ---------- AI ---------- */
async function eseguiStrumento(nome, x) {
  A.risposta?.fine(); A.risposta = null; modo('riposo');
  if (nome === 'avvia_focus') { const e = x.esame ? trovaEsame(x.esame) : null; F.avvia({ min: x.minuti || D.imp.focus, esameId: e?.id || null }); await mostraFatto({ testo: `Focus di ${x.minuti || D.imp.focus} minuti${e ? ' su ' + e.nome : ''}.` }); aggiornaPillola(); return { esito: 'avviato' }; }
  if (nome === 'mostra') { const e = x.esame ? trovaEsame(x.esame) : null; x.scheda === 'libretto' ? schedaLibretto() : x.scheda === 'esami' ? schedaEsami() : schedaRipasso(e?.id); return { esito: 'mostrata' }; }
  if (nome === 'crea_carte') {
    const e = x.esame ? trovaEsame(x.esame) : null, carte = x.carte.slice(0, 30);
    const card = schedaConferma({ titolo: `Salvare ${carte.length} ${carte.length === 1 ? 'carta' : 'carte'}${e ? ' di ' + e.nome : ''}?`,
      extra: `<ol class="ld-proposte">${carte.map(c => `<li><b>${esc(c.fronte)}</b><span>${esc(c.retro)}</span></li>`).join('')}</ol>`, nota: 'Entrano nel ripasso di oggi.' });
    card.querySelectorAll('.ld-proposte li').forEach((li, i) => entra(li, { ritardo: 120 + Math.min(i, 12) * 60, dy: 6, blur: 5, ms: 420 }));
    return attendiDecisione(card, async () => { carte.forEach(c => aggiungiCarta({ esameId: e?.id || null, fronte: c.fronte, retro: c.retro })); salva(); aggiornaTutto(); await mostraFatto({ testo: `${carte.length} carte salvate.`, azione: ['Ripassa ora', () => { nuovoTurno(); schedaRipasso(e?.id); }], sintesi: `${carte.length} carte` }, card); return { esito: 'salvate', n: carte.length }; });
  }
  if (nome === 'aggiungi_esame') {
    const card = schedaConferma({ titolo: `Aggiungere ${x.nome}?`, righe: [['Esame', x.nome], ['CFU', String(x.cfu || 6)], ['Appello', x.data ? dataLunga(x.data) : 'senza data']] });
    return attendiDecisione(card, async () => { const e = aggiungiEsame({ nome: x.nome, cfu: x.cfu || 6, data: /^\d{4}-\d\d-\d\d$/.test(x.data || '') ? x.data : null }); aggiornaTutto(); await mostraFatto({ testo: `${e.nome} aggiunto.` }, card); return { esito: 'aggiunto' }; });
  }
  if (nome === 'registra_voto') {
    const e = trovaEsame(x.esame);
    const card = schedaConferma({ titolo: `Registrare ${x.voto}${x.lode && x.voto === 30 ? ' e lode' : ''}?`, righe: [['Esame', e?.nome || x.esame + ' (nuovo, 6 CFU)'], ['Voto', `${x.voto}${x.lode && x.voto === 30 ? ' e lode' : ''}`]] });
    return attendiDecisione(card, async () => { const ee = e || aggiungiEsame({ nome: x.esame, cfu: 6 }); registraVoto(ee.id, { voto: x.voto, lode: x.lode }); aggiornaTutto(); await mostraFatto({ testo: 'Voto registrato.', nota: `Media ${num(media().ponderata, 2)}` }, card); return { esito: 'registrato', media: media().ponderata }; });
  }
  return { errore: 'strumento sconosciuto' };
}
async function chiediAI(testo, { sistema } = {}) {
  const g = GEN; modo('pensa', A.allegati.length ? 'Leggo il file…' : A.orale ? 'Il prof ci pensa…' : 'Un attimo…'); segnala('pensa');
  const blocchi = [];
  for (const f of A.allegati) { try { blocchi.push(await AI.bloccoFile(f.file)); } catch { } }
  if (A.allegati.length) { const t = A.turno; const box = h('div', 'ld-allegati'); A.allegati.forEach(f => box.append(chipFile(f.file, false))); t.append(box); A.allegati = []; allegatiBox.innerHTML = ''; }
  // col modello locale i file diventano carte con una risposta strutturata (niente strumenti)
  if (blocchi.length && AI.motore() === 'locale' && !A.orale) {
    try { const carte = await AI.carteDa([...blocchi, { type: 'text', text: testo }]); modo('riposo'); if (!carte.length) return rispostaFissa('Da questo file non ho tirato fuori carte: se è un PDF, il modello locale non lo legge. Prova con una foto delle pagine o col testo.'); return eseguiStrumento('crea_carte', { carte, esame: prossimi()[0]?.nome }); }
    catch (e) { modo('riposo'); return rispostaFissa('Non sono riuscito a leggere il file: ' + e.message, { errore: true }); }
    finally { if (g === GEN) segnala('quiete'); }
  }
  A.storia.push({ role: 'user', content: [...blocchi, { type: 'text', text: testo }] });
  A.controller = new AbortController();
  try {
    if (AI.motore() === 'locale') { await AI.conversaLocale({ storia: A.storia, sistema, segnale: A.controller.signal, suTesto: d => { if (g !== GEN) return; if (!A.risposta) { modo('riposo'); A.risposta = nuovaRisposta(); } A.risposta.aggiungi(d); } }); A.risposta?.fine(); return; }
    await AI.conversa({ storia: A.storia, sistema, strumenti: !A.orale, segnale: A.controller.signal, esegui: eseguiStrumento,
      suTesto: d => { if (g !== GEN) return; if (!A.risposta) { modo('riposo'); A.risposta = nuovaRisposta(); } A.risposta.aggiungi(d); } });
    A.risposta?.fine();
  } catch (e) {
    if (g !== GEN || e.name === 'AbortError' || /abort/i.test(e.message)) return;
    console.error(e);
    const msg = e.status === 401 ? 'La chiave non è valida: controllala in Impostazioni.' : e.status === 429 ? 'Troppe richieste in poco tempo: riprova tra un minuto.' : e.status === 529 || e.status >= 500 ? 'Claude è sovraccarico in questo momento: riprova tra poco.' : /Failed to fetch|NetworkError/i.test(e.message) ? 'Sembra che manchi la rete.' : 'Qualcosa non è andato: ' + e.message;
    A.risposta?.fine(); rispostaFissa(msg, { errore: true });
    // la storia resta coerente: tolgo la domanda senza risposta
    while (A.storia.length && A.storia.at(-1).role === 'user') A.storia.pop();
  } finally { A.risposta = null; if (g === GEN) { modo('riposo'); segnala('quiete'); } }
}

/* ---------- l'orale ---------- */
async function avviaOrale(e, nomeDetto, materialeFile) {
  if (!A.turno || A.home) nuovoTurno();
  if (!AI.attiva()) {
    rispostaFissa(V.attivo ? 'Per l\'interrogazione serve l\'AI: installa il **cervello locale** da «Prepara Lode» (gratis, offline) o aggiungi una chiave Claude. Intanto puoi fare il **ripasso** delle carte.' : 'Per l\'interrogazione serve l\'AI: aggiungi la tua chiave Claude in **Impostazioni** (costa pochi centesimi a sessione). Intanto puoi fare il **ripasso** delle carte.');
    return;
  }
  if (!e) {
    const lista = prossimi().length ? prossimi() : daFare();
    if (nomeDetto) { rispostaFissa(`Non trovo **${nomeDetto}**: ti interrogo comunque su quello.`); e = { id: null, nome: nomeDetto }; }
    else if (lista.length === 1) e = lista[0];
    else {
      const s = scheda('ld-scegli', `<span class="ld-lbl">Su quale esame?</span><div class="ld-preset">${lista.slice(0, 6).map(x => `<button type="button" class="ld-chip larga" data-e="${x.id}"><b>${esc(x.nome)}</b><span>${x.data ? traQuanto(x.data) : ''}</span></button>`).join('') || '<p class="ld-nota">Aggiungi prima un esame.</p>'}</div>`);
      s.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => { nuovoTurno(); detto(A.turno, 'Interrogami su ' + esame(b.dataset.e).nome); avviaOrale(esame(b.dataset.e)); }));
      return;
    }
  }
  A.orale = { esameId: e.id, nome: e.nome }; A.storia = [];
  const c = contesto(`Orale · <b>${esc(e.nome)}</b>`); const via = h('button', 'ld-esci', 'Esci'); via.type = 'button'; via.addEventListener('click', esciOrale); c.append(via);
  const carte = D.carte.filter(x => x.esameId === e.id).slice(0, 80);
  const materiale = materialeFile ? `\n\nMateriale su cui interrogarmi (dal file che ti ho dato):\n${materialeFile}` : carte.length ? `\n\nMateriale dello studente (sue carte del ripasso):\n${carte.map(x => `– ${x.fronte} → ${x.retro}`).join('\n')}` : '';
  A.turno.dataset.sintesi = `orale di ${e.nome}`;
  await chiediAI(`Iniziamo. Sono pronto per l'orale di ${e.nome}.${materiale}`, { sistema: AI.SISTEMA_ORALE(e.nome) });
}
function esciOrale() { if (!A.orale) return; A.orale = null; A.storia = []; mostraFatto({ testo: 'Orale chiuso.', nota: 'Ripassa le domande dove hai esitato.' }); }

/* ---------- inviare ---------- */
export async function invia(testo) {
  testo = String(testo || '').trim();
  if (!testo && A.allegati.length) testo = 'Crea le carte del ripasso da questo file.';
  if (!testo) return;
  Voce.zitto();
  const inp = campo.querySelector('input'); inp.value = '';
  if (A.cattura) {
    const tipo = A.cattura; fineCattura();
    const r = await salvaCattura(tipo, testo);
    if (r) { segnala('fatto'); return chiudi(r.testo); }
    return;
  }
  if (A.attesa && !A.attesa.inCorso && !A.attesa.card.dataset.soloClic) { if (SI.test(testo)) return conferma(); if (NO.test(testo)) return annulla(); }
  if (A.orale) {
    if (/^(esci|basta orale|chiudi( l'orale)?|fine orale)$/i.test(testo)) { nuovoTurno(); detto(A.turno, testo); return esciOrale(); }
    const t = h('article', 'ld-turno'); filo.append(t); A.turno = t; detto(t, testo); requestAnimationFrame(() => { corpo.scrollTop = corpo.scrollHeight; });
    return chiediAI(testo, { sistema: AI.SISTEMA_ORALE(A.orale.nome) });
  }
  const t = nuovoTurno(); detto(t, testo);
  if (A.allegati.length) {
    if (AI.attiva()) return chiediAI(testo);
    return importaSenzaAI();
  }
  const c = interpreta(testo);
  if (c) { await attendi(120); return esegui(c); }
  if (AI.attiva()) return chiediAI(testo);
  rispostaFissa('Questo non lo so ancora fare senza AI. Ecco cosa capisco:');
  schedaAiuto();
}

/* ---------- file ---------- */
function chipFile(file, togli = true) {
  const tipo = /pdf$/i.test(file.name) ? 'PDF' : file.type.startsWith('image/') ? 'foto' : (file.name.split('.').pop() || 'file').toUpperCase();
  const c = h('span', 'ld-file', `${ico('doc')}<span>${esc(file.name)}</span><small>${tipo}</small>`);
  if (togli) { const b = h('button', '', IC.chiudi); b.type = 'button'; b.setAttribute('aria-label', 'Togli ' + file.name); b.addEventListener('click', () => { A.allegati = A.allegati.filter(x => x.file !== file); c.remove(); }); c.append(b); }
  return c;
}
function allega(files) {
  const ok = [...files].filter(f => f.size < 30e6).slice(0, 4);
  if (!ok.length) return;
  apri({ fisso: true });
  for (const f of ok) { A.allegati.push({ file: f }); const c = chipFile(f); allegatiBox.append(c); entra(c, { dy: 4, blur: 4, ms: 360 }); }
  const inp = campo.querySelector('input'); inp.placeholder = AI.attiva() ? 'Invio: ne faccio carte. Oppure chiedi altro…' : 'Invio: importo le carte (CSV, TSV, testo)';
  inp.focus();
}
function scegliFile() {
  const i = h('input'); i.type = 'file'; i.multiple = true; i.accept = '.pdf,.pptx,.docx,.txt,.md,.csv,.tsv,.html,image/*,audio/*';
  i.addEventListener('change', () => riceviFile(i.files)); i.click();
}
// senza AI: importa carte da testo «domanda<TAB>risposta» (export di Anki), «domanda;risposta» o «domanda = risposta»
async function importaSenzaAI() {
  const carte = [];
  for (const { file } of A.allegati) {
    if (!/^text\/|\.(txt|csv|tsv|md)$/i.test(file.type + ' ' + file.name)) continue;
    for (const riga of (await file.text()).split(/\r?\n/)) {
      if (!riga.trim() || riga.startsWith('#')) continue;
      const p = riga.split(/\t| = | → |;(?=[^;]*$)/); if (p.length >= 2 && p[0].trim() && p[1].trim()) carte.push({ fronte: p[0].trim().replace(/^"|"$/g, ''), retro: p.slice(1).join(' ').trim().replace(/^"|"$/g, '') });
    }
  }
  A.allegati = []; allegatiBox.innerHTML = ''; campo.querySelector('input').placeholder = 'Chiedi o scrivi un comando…';
  if (!carte.length) return rispostaFissa('Senza AI leggo solo file di testo con una carta per riga (domanda, poi Tab o «;» o « = », poi risposta), come l\'export di Anki. Per PDF e foto aggiungi la chiave Claude in Impostazioni.');
  const e = prossimi()[0];
  const card = schedaConferma({ titolo: `Importare ${carte.length} carte?`, extra: `<ol class="ld-proposte">${carte.slice(0, 8).map(c => `<li><b>${esc(c.fronte)}</b><span>${esc(c.retro)}</span></li>`).join('')}${carte.length > 8 ? `<li class="altre">e altre ${carte.length - 8}</li>` : ''}</ol>`, nota: e ? `Le metto in ${e.nome}: lo cambi dalla pagina.` : '' });
  await attendiDecisione(card, async () => { carte.forEach(c => aggiungiCarta({ ...c, esameId: e?.id || null })); salva(); aggiornaTutto(); await mostraFatto({ testo: `${carte.length} carte importate.`, azione: ['Ripassa ora', () => { nuovoTurno(); schedaRipasso(e?.id); }] }, card); return {}; });
}

/* ---------- voce ---------- */
let pttAttivo = false, testoVoce = '';
function iniziaAscolto() {
  if (Voce.attivo()) return;
  apri({ fisso: true });
  campo.querySelector('.stato.ascolto .lbl').textContent = DESKTOP && !Voce.pronta() ? 'Ti ascolto · preparo la voce…' : 'Ti ascolto';
  Voce.zitto(); testoVoce = '';
  const t = A.orale ? (() => { const x = h('article', 'ld-turno'); filo.append(x); A.turno = x; return x; })() : null;
  let turno = t;
  modo('ascolto'); segnala('ascolto', { ms: 99999 });
  Voce.ascolta({
    parziale: s => { testoVoce = s; if (!turno) { turno = nuovoTurno(); } detto(turno, s); },
    fine: s => {
      modo('riposo'); segnala('quiete');
      const testo = (s || testoVoce).trim();
      if (!testo) { if (turno && !turno.textContent.trim()) turno.remove(); return; }
      if (turno) { turno.remove(); if (A.turno === turno) A.turno = null; }
      invia(testo);
    },
    errore: m => { modo('riposo'); nuovoTurno(); rispostaFissa(m, { errore: true }); },
  });
}
function fineAscolto(annulla = false) { if (!Voce.attivo()) { modo('riposo'); return; } Voce.ferma(annulla); if (annulla) { modo('riposo'); segnala('quiete'); } }

/* ---------- collegamenti ---------- */
function collega() {
  shell.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; A.chiudiTra?.(); A.chiudiTra = null; if (!A.aperto) A.apriTra = dopo(70, () => apri()); });
  shell.addEventListener('pointerleave', e => {
    if (e.pointerType !== 'mouse') return; A.apriTra?.(); A.apriTra = null;
    if (A.aperto && !A.fisso && !shell.contains(document.activeElement) && !Voce.attivo()) A.chiudiTra = dopo(380, () => { A.chiudiTra = null; if (!A.fisso) chiudi(); });
  });
  testa.querySelector('.ld-indietro').addEventListener('click', () => indietro());
  pill.addEventListener('click', () => { apri({ fisso: true }).then(() => campo.querySelector('input').focus({ preventScroll: true })); });
  corpo.addEventListener('pointerdown', () => { A.fisso = true; });
  document.addEventListener('pointerdown', e => { if (A.aperto && !shell.contains(e.target) && !e.target.closest('.ld-drop')) chiudi(); });
  const inp = campo.querySelector('input');
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); invia(inp.value); return; }
    if (Voce.attivo() && e.key.length === 1 && !pttAttivo) fineAscolto(true);   // si mette a scrivere: smetto di ascoltare
  });
  inp.addEventListener('focus', () => { A.fisso = true; });
  campo.querySelector('.ld-mic').addEventListener('click', () => { Voce.attivo() ? fineAscolto() : iniziaAscolto(); });
  home.addEventListener('click', e => {
    const r = e.target.closest('[data-ld-riga]'); if (r) { premi(r); home._righe[+r.dataset.ldRiga]?.f(); return; }
    const s = e.target.closest('[data-ld-strumento]'); if (s) { premi(s); const [, nome, f] = STRUMENTI[+s.dataset.ldStrumento]; if (nome !== 'Carte da file') { nuovoTurno(); detto(A.turno, nome); } f(); return; }
    if (e.target.closest('[data-ld-esempio]')) dispatchEvent(new CustomEvent('lode:esempio'));
    const c = e.target.closest('[data-ld-cattura]'); if (c) { premi(c); cattura(c.dataset.ldCattura); return; }
    if (e.target.closest('[data-ld-appunti]')) apriAppunti();
    if (e.target.closest('[data-ld-trascrivi]')) { nuovoTurno(); detto(A.turno, 'Trascrivi la lezione'); avviaTrascrizione(); }
    const rp = e.target.closest('[data-ld-ripeti]'); if (rp) { const k = rp.dataset.ldRipeti; nuovoTurno(); detto(A.turno, k === 'si' ? 'Ripeti' : k === 'spegni' ? 'Spegni Ripeti' : 'Accendi Ripeti'); k === 'si' ? ripeti() : k === 'spegni' ? spegniRipeti() : accendiRipeti(); return; }
    const tr = e.target.closest('[data-ld-tr]'); if (tr) { const k = tr.dataset.ldTr; if (k === 'fine') { nuovoTurno(); detto(A.turno, 'Fine trascrizione'); fermaTrascrizione(); } else { k === 'pausa' ? TR.pausa() : TR.riprendi(); disegnaHome(); } }
  });
  addEventListener('keydown', e => {
    const ptt = (MAC ? e.altKey && !e.ctrlKey : e.ctrlKey && e.shiftKey) && e.code === 'Space';
    if (ptt) { e.preventDefault(); if (!e.repeat && !pttAttivo) { pttAttivo = true; iniziaAscolto(); } return; }
    // Esc: prima torna indietro alla home, la seconda volta chiude
    if (e.key === 'Escape') { if (Voce.attivo()) { fineAscolto(true); return; } if (A.cattura) { e.preventDefault(); fineCattura(); chiudi(); return; } if (A.aperto) { e.preventDefault(); A.home ? chiudi() : indietro(); } return; }
    if (A.aperto && !A.home && (e.metaKey || e.ctrlKey) && (e.key === '[' || e.key === 'ArrowLeft')) { e.preventDefault(); indietro(); return; }
    const inCampo0 = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (A.aperto && A.gioco && !inCampo0 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.code === 'Space') { e.preventDefault(); A.gioco.gira(); return; }
      if (e.key === '1' || e.key === '2') { e.preventDefault(); A.gioco.vota(e.key); return; }
    }
    const inCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !inCampo)) { e.preventDefault(); apri({ fisso: true }).then(() => inp.focus()); return; }
    if (A.aperto && A.ripasso && !inCampo && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); A.ripasso.gira(); }
      const r = RISPOSTE.find(x => x.k === e.key); if (r) { e.preventDefault(); A.ripasso.vota(r.q); }
    }
  });
  addEventListener('keyup', e => { if (pttAttivo && (e.code === 'Space' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Shift')) { pttAttivo = false; fineAscolto(); } });
  addEventListener('blur', () => { if (pttAttivo) { pttAttivo = false; fineAscolto(); } });
  // trascinare file: la pillola si allarga in una zona dove lasciarli (anche a barra chiusa)
  let dentro = 0;
  const conFile = e => [...(e.dataTransfer?.types || [])].includes('Files');
  addEventListener('dragenter', e => { if (!conFile(e)) return; e.preventDefault(); if (++dentro === 1) zonaOn(); });
  addEventListener('dragover', e => { if (!conFile(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; shell.classList.toggle('sopra', !!e.target.closest?.('.ld')); });
  addEventListener('dragleave', e => { if (!conFile(e)) return; if (--dentro <= 0) { dentro = 0; zonaOff(); if (BRIDGE) BRIDGE.mouse(!A.aperto); } });
  addEventListener('drop', e => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); dentro = 0; zonaOff(); riceviFile(e.dataTransfer.files); });
  // il timer aggiorna la pillola; la fine del focus festeggia
  addEventListener('lode:focus', e => {
    const ev = e.detail.evento;
    if (ev === 'tic') { if (!A.avviso) aggiornaPillola(); document.title = F.stato() ? `${F.mmss(F.restante())} · ${F.stato().fase === 'pausa' ? 'Pausa' : F.etichetta()}` : 'Lode'; return; }
    if (ev === 'avvio' && e.detail.fase === 'focus') segnala('focus');
    if (ev === 'avvio' && e.detail.fase === 'pausa') segnala('quiete');
    if (ev === 'fine') { segnala('fatto'); mostraAvviso(e.detail.fase === 'focus' ? `${e.detail.min} minuti fatti · pausa` : 'Pausa finita · si riparte?'); if (e.detail.fase === 'pausa') document.title = 'Lode'; }
    if (ev === 'fermo') { document.title = 'Lode'; segnala('quiete'); }
    if (!A.aperto && forma.w.t !== larghezza()) { forma.w.t = larghezza(); molla(); }
    aggiornaTutto();
  });
  addEventListener('lode:dati', () => { if (!A.avviso) aggiornaPillola(); if (A.aperto && A.home) { disegnaHome(); aggiornaTesta(); } });
  addEventListener('resize', () => { if (A.aperto) { forma.w.t = Math.min(560, innerWidth - 16); molla(); } });
  let tTr = 0;
  addEventListener('lode:trascrizione', () => { if (!A.avviso) aggiornaPillola(); clearTimeout(tTr); tTr = setTimeout(() => { if (A.aperto && A.home && !shell.contains(document.activeElement)) disegnaHome(); }, 300); });
  addEventListener('lode:lezioni', () => { if (!A.avviso) aggiornaPillola(); if (A.aperto && A.home) disegnaHome(); });
  // il tempo passa: «fine tra 23 min», la lezione che inizia, il suggerimento del pomeriggio
  let minuto = -1;
  setInterval(() => { const m = new Date().getMinutes(); if (m === minuto) return; minuto = m;
    // Ripeti: si accende da solo a lezione (se l'hai attivato una volta) e si spegne dopo
    if (V.attivo && D.imp.ripetiInAula && D.imp.trascrizioneOk) { if (lezioneOra() && !O.attivo()) O.accendi().then(aggiornaTutto).catch(() => { }); else if (!lezioneOra() && O.attivo() && !TR.attiva()) { O.spegni(); aggiornaTutto(); } }
    // dieci minuti dopo la fine della lezione la trascrizione si chiude da sola
    const tr = TR.stato(); if (tr?.lezione.fine && !lezioneOra()) { const [hh, mm] = tr.lezione.fine.split(':').map(Number), d = new Date(); if (d.getHours() * 60 + d.getMinutes() >= hh * 60 + mm + 10) fermaTrascrizione(); } if (!A.avviso && !F.stato()) aggiornaPillola(); if (A.aperto && A.home && !shell.contains(document.activeElement)) { disegnaHome(); aggiornaTesta(); } }, 5000);
  if (BRIDGE) collegaDesktop();
}
// nell'app la barra è una finestra trasparente sopra tutte le altre: i clic passano attraverso tranne che sulla barra
function collegaDesktop() {
  let ignora = null;
  const passa = v => { if (v !== ignora) { ignora = v; BRIDGE.mouse(v); } };
  document.addEventListener('pointermove', e => passa(!(e.target instanceof Element && e.target.closest('.ld'))), { passive: true });
  document.addEventListener('pointerleave', () => { if (!A.aperto) passa(true); });
  passa(true);
  addEventListener('blur', () => { setTimeout(() => { if (A.aperto && !document.hasFocus() && !Voce.attivo()) chiudi(); }, 120); });
  BRIDGE.su('scorciatoia', nome => {
    // ⌥ Spazio: si apre e ascolta (tieni premuto e parla; lasci o stai zitto e parte). Se inizi a scrivere, smette.
    if (nome === 'apri') { if (Voce.attivo()) return; pttAttivo = true; apri({ fisso: true }).then(() => campo.querySelector('input').focus({ preventScroll: true })); iniziaAscolto(); }
    else if (nome === 'scrivi') { apri({ fisso: true }).then(() => campo.querySelector('input').focus()); }
    else if (CATTURE[nome]) cattura(nome);
    else if (nome === 'ripeti') { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Ripeti'); ripeti(); }
    else if (nome === 'trascrivi') { apri({ fisso: true }); nuovoTurno(); if (TR.attiva()) { detto(A.turno, 'Fine trascrizione'); fermaTrascrizione(); } else { detto(A.turno, 'Trascrivi la lezione'); avviaTrascrizione(); } }
    else if (nome === 'gioco') { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Gioca'); schedaGioco(); }
  });
}

export function avvia() {
  A = nuovoStato(); costruisci(); collega();
  addEventListener('lode:voce', e => { const x = e.detail; document.querySelectorAll('.ld-prepara').forEach(s => mostraAvanzamento(s, 'voce', x.fase === 'pronta' ? { fase: 'fatto', p: 1, testo: 'Whisper in locale · tieni premuto ' + TASTI + ' e parla' } : x.fase === 'errore' ? { fase: 'errore', testo: x.testo } : { p: x.p, testo: `Scarico Whisper · ${Math.round((x.p || 0) * 100)}%` })); if (A.modo === 'ascolto' && x.fase === 'scarico') campo.querySelector('.stato.ascolto .lbl').textContent = `Ti ascolto · preparo la voce ${Math.round((x.p || 0) * 100)}%`; if (x.fase === 'pronta' && A.modo === 'ascolto') campo.querySelector('.stato.ascolto .lbl').textContent = 'Ti ascolto'; });
  // la voce già preparata si carica in silenzio dopo l'avvio: così il primo ⌥ Spazio è immediato
  try { if (DESKTOP && localStorage.getItem('lode:voce')) setTimeout(() => Voce.prepara().catch(() => { }), 4000); } catch { }
  if (V.attivo) {
    aggiornaStato(); setInterval(aggiornaStato, 5 * 60e3);
    V.suProgresso(x => { avanzamenti[x.cosa] = x; if (x.fase === 'fatto' || x.fase === 'errore') { delete avanzamenti[x.cosa]; aggiornaStato(); } document.querySelectorAll('.ld-prepara').forEach(s => mostraAvanzamento(s, x.cosa, x)); if (!A.aperto && x.fase !== 'fatto' && x.fase !== 'errore' && x.p != null) mostraAvviso(`${x.cosa === 'obsidian' ? 'Obsidian' : 'Cervello locale'} · ${Math.round(x.p * 100)}%`, true); });
  }
  if (F.stato()?.fase === 'focus' && !F.stato().fermo) setTimeout(() => segnala('focus'), 600);
}
// la pagina sotto chiede a Lode di fare cose (ripassa, interroga, focus) dal suo pannello
// per le prove automatiche (test/): accesso ai motori della barra
window.__lode = { invia, riceviFile, O, ripeti, condividiLezione, indietro, TR, Voce, avviaTrascrizione, fermaTrascrizione, riordinaLezione, stato: () => A };
export const azioni = {
  focus: esameId => avviaFocus({ esameId }),
  ripassa: esameId => { apri({ fisso: true }); nuovoTurno(); detto(A.turno, esameId ? 'Ripassa ' + esame(esameId)?.nome : 'Ripasso'); schedaRipasso(esameId); },
  interroga: esameId => { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Interrogami su ' + esame(esameId)?.nome); avviaOrale(esame(esameId)); },
  libretto: () => { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Libretto'); schedaLibretto(); },
  scrivi: testo => { apri({ fisso: true }).then(() => { const i = campo.querySelector('input'); i.value = testo; i.focus(); }); },
  invia: testo => { apri({ fisso: true }); invia(testo); },
  file: () => scegliFile(),
  ricevi: lista => riceviFile(lista),
  home: () => { ricomincia(); },
};
