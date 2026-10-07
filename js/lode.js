// Lode, l'aiutante in cima allo schermo. A riposo è una pillola di vetro nero: il prossimo esame, le carte di oggi
// o il timer che scorre. Passandoci sopra si apre a molla in un pannello: «Oggi», sei strumenti e il campo
// «Chiedi o scrivi un comando…». Si parla tenendo premuto ⌥ Spazio. I file trascinati diventano carte del ripasso.
// Senza AI capisce i comandi in italiano (comandi.js); con il cervello locale (gratis) o la tua AI preferita spiega, crea carte e interroga come all'orale.
import { inverti, datiIllegibili, piuGiorni, norm, D, DESKTOP, lezioneOra, prossimaLezione, daGiocare, ricorda, aggiungiOrario, lezioni, RISPOSTE, aggiungiCarta, aggiungiEsame, cfuFatti, dataBreve, dataLunga, daFare, daRipassare, esame, esc, fatti, media, minuti, num, oggi, ore, piano, prossimi, prossimoIntervallo, registraVoto, rispondi, salva, serie, serve, simula, sostituisci, traQuanto, trovaEsame, intervalloTesto, giorniTra, definizioni } from './dati.js';
import { t } from './lingua.js';
import { t as tn } from './lingua.js';   // t() dove una variabile locale si chiama già t (arrivaTurno, schedaTurno, piedeSync, schedaNote)
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
import * as AL from './allenatore.js';
import * as PG from './programma.js';
import * as QC from './crocette.js';
import * as TE from './temi.js';
import * as ORE from './ore.js';
import * as PV from './prova.js';
import * as CO from './computer.js';
import { parlatoInFormule } from './formule.js';
import { pulito } from './markdown.js';
import { preparaAnki, testoAnki, nomeFileAnki, mazzo } from './anki.js';
import * as TA from './tasca.js';
// informatica (docs/PROGETTO-INFORMATICA.md): «Cosa stampa?», «Segui il progetto», gli errori spiegati, il registro nel vault
import * as ST from './codice/stampa.js';
import * as PR from './codice/progetto.js';
import * as DI from './codice/diario.js';
import * as DC from './codice/discussione.js';
import { ERRORI } from './codice/modelli.js';
import * as ER from './errori.js';
import * as TS from './sync-testi.js';
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
  codice: '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13.5 5l-3 14"/>',
};
const ico = k => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- stato ---------- */
let A, shell, pill, corpo, testa, campo, home, filo, allegatiBox, tacche = [], forma, velo, GEN = 0;
const nuovoStato = () => ({ proposta: null, zona: false, cattura: null, gioco: null, aperto: false, fisso: false, modo: 'riposo', turno: null, attesa: null, home: true, avviso: null, chiudiTra: null, apriTra: null, storia: [], allegati: [], orale: null, controller: null, ripasso: null, risposta: null, ultimoUso: 0 });

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
  const piede = h('footer', 'ld-piede', `<span class="ld-piede-sx">Tieni premuto per parlare <kbd>${TASTI}</kbd></span><span class="ld-piede-dati">${IC.lucchetto}<span>I dati restano su questo computer</span></span>`);
  corpo.append(testa, dentro, piede);
  const zona = h('div', 'ld-zona', `<i class="bordo"></i><div class="ld-zona-in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg><b>Lascia qui il file</b><span>${FILE.ACCETTATI}</span></div>`);
  zona.setAttribute('aria-hidden', 'true');
  const prop = h('div', 'ld-proposta', '<i class="ld-rombo"></i><span class="t"><b></b><span></span></span><button type="button" class="btn small primary" data-p="si"></button><button type="button" class="btn small ld-piano" data-p="dopo">Dopo</button>');
  shell.append(pill, corpo, zona, prop);
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
  // la sincronizzazione: password da scrivere, cartella sparita, spostamento interrotto (i dati locali restano usabili)
  if (syncBloccata()) r.push({ cls: 'urg', t: TS.rigaStato(SYNC), d: 'Lode funziona con i dati di questo computer: le modifiche aspettano nel diario.', n: '', b: 'Sblocca', f: () => { nuovoTurno(); detto(A.turno, 'Sblocca'); schedaSincronizza('sblocca'); } });
  else if (SYNC?.acceso && SYNC.stato === 'sparito') r.push({ cls: 'urg', t: 'La cartella di Lode nel vault non c\'è più', d: 'È stata spostata o cancellata? I dati di questo computer sono al sicuro nel suo diario.', n: '', b: 'Vedi', f: () => { nuovoTurno(); schedaSincronizza(); } });
  else if (SYNC?.spostamento) r.push({ cls: 'att', t: 'Lo spostamento nella cartella cloud si è interrotto', d: 'Il vault di prima è intatto: riprendo da dove ero rimasto.', n: '', b: 'Riprendi', f: () => { nuovoTurno(); detto(A.turno, 'Sincronizza fra i computer'); schedaSincronizza(); } });
  if (datiIllegibili === 'altrove') r.push({ cls: 'urg', t: 'Questo vault si sincronizza con Lode su un altro computer', d: 'I dati sono nel diario di Lode 2: scegli «Uso già Lode su un altro computer» per vederli qui. Le modifiche di adesso vanno in un file a parte, non sopra i dati.', n: '', b: 'Uso già Lode', f: () => { nuovoTurno(); detto(A.turno, 'Uso già Lode su un altro computer'); schedaSincronizza('collega'); } });
  else if (datiIllegibili === 'fermo') r.push({ cls: 'urg', t: 'Il diario di Lode su questo computer non si legge', d: 'Niente è stato cancellato: la cartella dei dati di Lode non risponde (disco pieno o guasto?).', n: '', b: 'Riprova', f: () => location.reload() });
  else if (datiIllegibili) r.push({ cls: 'urg', t: 'Non riesco a leggere i tuoi dati', d: 'Esami, voti e carte sono al sicuro, ma la cartella non risponde (OneDrive offline o file bloccato). Le modifiche di adesso vanno in un file a parte; riprovo da solo.', n: '', b: 'Riprova', f: () => location.reload() });   // ricaricata, la barra rilegge: se ora si legge, torna tutto
  const lo = lezioneOra(), pl = prossimaLezione();
  if (!lo && pl && pl.tra <= 90) r.push({ cls: pl.tra <= 15 ? 'urg' : 'att', t: `${pl.corso} alle ${pl.inizio}`, d: `${pl.aula ? 'Aula ' + pl.aula + ' · ' : ''}tra ${pl.tra} min`, n: '', b: V.attivo ? 'Appunti' : 'Orario', f: () => V.attivo ? apriAppunti(pl) : (nuovoTurno(), schedaOrario()) });
  const rp = PR.rigaOggi(); if (rp) r.push(rp);   // il progetto seguito: «non provato», l'ultima prova andata male, «sta cambiando»
  if (V.attivo && STATO && (!STATO.obsidian.installato || !STATO.modello) && !D.imp.preparaNascosto) r.push({ cls: 'att', t: 'Completa Lode', d: [!STATO.obsidian.installato && 'Obsidian', !STATO.modello && 'il cervello locale'].filter(Boolean).join(' e ') + ': un clic, gratis', n: '', b: 'Prepara', f: () => { nuovoTurno(); detto(A.turno, 'Prepara Lode'); schedaPrepara(); } });
  const ag = rigaAggiornamento(); if (ag) r.push(ag);   // Lode nuova: pronta da installare, o (Mac senza firma) da scaricare
  const dc = daChiudere();
  if (dc) r.push({ cls: 'att', t: `Chiudi la lezione di ${dc.corso}`, d: `${dc.parole} parole di appunti · estraggo definizioni e ★`, n: '', b: 'Chiudi', f: () => { nuovoTurno(); detto(A.turno, 'Chiudi lezione'); chiudiLezione(dc.corso); } });
  if (A.propostaAperta) { const p = A.propostaAperta; r.push({ cls: 'urg', t: p.titolo, d: p.testo, n: '', b: p.bottone, f: () => { A.propostaAperta = null; A.proposta = p; accettaProposta(); } }); }
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
  return `<section class="ld-aula"><div class="capo"><span class="ld-lbl"><i class="ld-live"></i>In aula · ${esc(lo.corso)}</span><span>${lo.aula ? 'aula ' + esc(lo.aula) + ' · ' : ''}finisce tra ${esc(lo.mancano)} min</span></div>
    <div class="ld-cattura">${[['stella', '★ Da esame', 'S'], ['definizione', 'Definizione', 'D'], ['domanda', 'Domanda', 'Q']].map(([k, t, l]) => `<button type="button" class="btn" data-ld-cattura="${k}"><span>${t}</span><kbd>${MAC ? '⌃⌥' : 'Ctrl Alt '}${l}</kbd></button>`).join('')}
      ${V.attivo ? '<button type="button" class="btn primary" data-ld-appunti>Appunti</button>' : ''}</div>
    ${V.attivo ? bloccoTrascrizione() + bloccoRipeti() : ''}
    ${st ? `<p class="ld-nota">${esc(st)} ${st === 1 ? 'cosa segnata' : 'cose segnate'} da esame oggi.</p>` : ''}</section>`;
}
function bloccoRipeti() {
  if (O.attivo()) return `<div class="ld-ripeti-riga"><i class="ld-orecchio"></i><span>Ripeti attivo · solo in memoria, mai su disco</span><button type="button" class="btn small primary" data-ld-ripeti="si">Ripeti <kbd>${MAC ? '⌃⌥P' : 'Ctrl Alt P'}</kbd></button><button type="button" class="btn small ld-piano" data-ld-ripeti="spegni">Spegni</button></div>`;
  return `<button type="button" class="ld-ripeti-riga spento" data-ld-ripeti="accendi"><i class="ld-orecchio"></i><span><b>Ripeti 60 s</b> · ti sei perso una frase? Lode te la ripete. Niente viene salvato.</span></button>`;
}
function bloccoTrascrizione() {
  const t = TR.stato();
  if (!t) return `<button type="button" class="ld-trascrivi" data-ld-trascrivi><i class="ld-rec"></i><span><b>Trascrivi la lezione</b><small>Tutto quello che dice il prof, formule comprese, nella nota Obsidian · ${MAC ? '⌃⌥R' : 'Ctrl Alt R'}</small></span></button>`;
  return `<div class="ld-trascrivi on"><i class="ld-rec"></i><span><b>${t.inPausa ? 'In pausa' : 'Trascrivo'} · ${esc(t.minuti)} min · ${esc(t.parole.toLocaleString('it-IT'))} parole</b><small>${t.ultima ? esc(t.ultima.replace(/^\*\*\d\d:\d\d\*\*\s*/, '').slice(-110)) : 'Ascolto: la prima riga arriva fra una ventina di secondi.'}</small></span>
    <button type="button" class="btn small" data-ld-tr="${t.inPausa ? 'riprendi' : 'pausa'}">${t.inPausa ? 'Riprendi' : 'Pausa'}</button><button type="button" class="btn small primary" data-ld-tr="fine">Fine</button></div>`;
}
function disegnaHome() {
  const r = righeOggi(), lo = lezioneOra(), st = strumenti();
  home._righe = r;
  home.innerHTML = `${lo ? bloccoAula(lo) : V.attivo && O.attivo() && !TR.stato() ? `<section class="ld-aula">${bloccoRipeti()}</section>` : ''}${lo && !r.length ? '' : `<section class="ld-oggi"><div class="capo"><span class="ld-lbl">Oggi</span><span>${D.esami.length ? `${esc(cfuFatti())} di ${esc(D.profilo.cfuTotali)} CFU` : ''}</span></div>
    ${r.map((x, i) => `<div class="ld-riga ${x.cls}"><i class="ld-seg"></i><div class="t"><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div><span class="n">${esc(x.n)}</span><button type="button" class="btn small${i === 0 && x.cls === 'urg' ? ' primary' : ''}" data-ld-riga="${i}">${x.b}</button></div>`).join('') ||
    `<div class="ld-riga info vuota"><i class="ld-seg"></i><div class="t"><b>Inizia da qui</b><span>Scrivi «lezione analisi 2 lunedì 9-11 aula 7», oppure prova i dati di esempio</span></div><span class="n"></span><button type="button" class="btn small primary" data-ld-esempio>Esempio</button></div>`}</section>`}
    <div class="ld-strumenti${st.length === 9 ? ' nove' : ''}">${st.map(([k, t]) => `<button type="button" class="btn" data-ld-strumento="${k}">${ico(k)}<span>${t}</span></button>`).join('')}</div>`;
}
// il corso di programmazione (esame da dare, orario o lezione), se c'è: fa comparire «Codice» e dà il nome a «Cosa stampa?»
const corsoInf = () => ST.corsoProgrammazione([...prossimi().map(e => e.nome), ...daFare().map(e => e.nome), ...D.orario.map(o => o.corso), ...lezioni().map(l => l.corso)]);
const STRUMENTI = [
  ['focus', 'Focus', () => schedaFocus()],
  ['ripasso', 'Ripasso', () => schedaRipasso()],
  ['gioco', 'Gioco', () => schedaGioco()],
  ['codice', 'Codice', () => ST.schedaStampa({ corso: corsoInf() })],
  ['orario', 'Orario', () => schedaOrario()],
  ['appunti', 'Note', () => schedaNote()],
  ['orale', 'Interrogami', () => avviaOrale(null)],
  ['libretto', 'Libretto', () => schedaLibretto()],
  ['esami', 'Esami', () => schedaEsami()],
];
// «Codice» solo se c'è un corso di programmazione
const strumenti = () => STRUMENTI.filter(([k]) => k !== 'codice' || !!corsoInf());
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
  // il microfono di Ripeti acceso si vede in ogni stato della pillola, timer compreso
  const mic = O.attivo(), orecchio = mic ? `<i class="ld-orecchio" title="Ripeti attivo: l'ultimo minuto e mezzo, solo in memoria"></i>` : '';
  if (T) {
    const fermo = !!T.fermo, pausa = T.fase === 'pausa';
    if (!pill.querySelector('.ld-tempo')) pill.innerHTML = `<i class="ld-rombo"></i><b class="ld-tempo"></b><span class="ld-cosa"></span><i class="ld-orecchio" title="Ripeti attivo: l'ultimo minuto e mezzo, solo in memoria"></i><i class="ld-avanza"><i></i></i>`;
    pill.querySelector('.ld-tempo').textContent = F.mmss(F.restante());
    pill.querySelector('.ld-cosa').textContent = fermo ? 'in pausa' : pausa ? 'pausa' : F.etichetta();
    pill.querySelector('.ld-orecchio').style.display = mic ? '' : 'none';
    pill.querySelector('.ld-avanza i').style.transform = `scaleX(${F.avanzamento().toFixed(4)})`;
    pill.classList.toggle('sosta', fermo || pausa);
    pill.setAttribute('aria-label', `${pausa ? 'Pausa' : T.fase === 'prova' ? 'Prova generale' : 'Focus su ' + F.etichetta()}: mancano ${F.mmss(F.restante())}${mic ? '. Ripeti: microfono acceso' : ''}`);
    return;
  }
  const lo = lezioneOra(), pl = prossimaLezione(), sg = suggerimento(), tr = TR.stato(), pp = PR.pillola();
  const p = prossimi()[0], c = daRipassare().length;
  let testo, pieno = false;
  if (tr) { testo = `<i class="ld-live rec"></i><b>${esc(tr.lezione.corso)}</b><span class="ld-tenue">${tr.inPausa ? 'trascrizione in pausa' : 'trascrivo'} · ${tr.parole.toLocaleString('it-IT')} parole</span>`; pieno = true; }
  else if (lo) { const st = stelleOggi(lo.corso); testo = `<i class="ld-live"></i><b>${esc(lo.corso)}</b><span class="ld-tenue">fine tra ${esc(lo.mancano)} min</span>${st ? `<span class="ld-punto"></span><span class="ld-tenue">★${esc(st)}</span>` : ''}${orecchio}`; pieno = true; }
  else if (pl && pl.tra <= 20) { testo = `<b>${esc(pl.corso)}</b><span class="ld-tenue">${pl.aula ? 'aula ' + esc(pl.aula) + ' · ' : ''}tra ${esc(pl.tra)} min</span>${orecchio}`; pieno = true; }
  else if (pp) { testo = pp.html + orecchio; pieno = pp.pieno; }   // il progetto seguito: «lab3 · 2 file +41 −7», «lab3 · fatto · non provato»
  else if (mic) { testo = `<b>Ripeti</b><span class="ld-tenue">microfono acceso</span>${orecchio}`; pieno = true; }   // acceso a mano fuori lezione
  else if (sg) testo = `<b>2 minuti</b><span class="ld-tenue">${esc(sg.testo)}</span>`;
  else if (p) { const g = giorniTra(oggi(), p.data); testo = `<b>${esc(p.nome)}</b><span class="ld-tenue">${g === 0 ? 'oggi' : g === 1 ? 'domani' : `tra ${esc(g)} g`}</span>${c ? `<span class="ld-punto"></span><span class="ld-tenue">${esc(c)} carte</span>` : ''}`; pieno = g <= 7; }
  else if (c) testo = `<b>${esc(c)}</b><span class="ld-tenue">carte da ripassare</span>`;
  else testo = `<b>Lode</b><span class="ld-tenue">passa qui sopra</span>`;
  pill.innerHTML = `<i class="ld-rombo${pieno ? '' : ' ld-cavo'}"></i><span class="ld-testo">${testo}</span>`;
  pill.setAttribute('aria-label', `Lode: ${pill.textContent}${mic && !tr && !testo.includes('microfono acceso') ? '. Ripeti: microfono acceso' : ''}. Passa sopra o premi ${TASTI}.`);
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
  if (A.proposta && !A.aperto) { A.propostaAperta = nascondiProposta(null); }
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
  if (BRIDGE && [AI.motore(), AI.motore('testo')].includes('locale')) BRIDGE.invoca('locale:scalda').catch(() => { });
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
// L'etichetta di «Un attimo…» quando si aspetta la voce (Ripeti, l'inizio e la fine della trascrizione): se intanto la
// voce si scarica, o Parakeet non parte e si passa a Whisper (200-600 MB), l'etichetta lo dice (vedi lode:voce in avvia)
let attesaVoce = null, voceRipiegata = false;
function modo(m, etichetta) {
  A.modo = m; campo.dataset.modo = m; attesaVoce = null;
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
  // un programma o delle domande incollati: si vede la prima riga e quante righe sono, non tutto il testo
  const righe = String(testo).split('\n').filter(r => r.trim());
  if (righe.length > 3 || String(testo).length > 280) testo = `${righe[0].slice(0, 120)}${righe[0].length > 120 ? '…' : ''} (+${righe.length > 1 ? `${righe.length - 1} ${righe.length === 2 ? 'riga' : 'righe'}` : 'altro'})`;
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
// le formule ($…$) disegnate in MathML (temml, come nella sbobina): prima si vede il testo, poi arrivano le formule;
// senza rete per temml resta il testo
function formuleIn(nodo, md) { if (nodo && /\$/.test(md)) SB.corpoHtml(md).then(h => { if (nodo.isConnected) nodo.innerHTML = h; }).catch(() => { }); }
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
  d.annulla?.fotografa?.();   // D subito dopo il comando: «Annulla» toglie solo quello che il comando ha cambiato
  const f = h('div', 'ld-fatto' + (d.no ? ' no' : ''), `${d.no ? IC.croce : IC.spunta}<b>${esc(d.testo || 'Fatto.')}</b>${d.nota ? `<span>${esc(d.nota)}</span>` : ''}`);
  if (d.annulla) { const b = h('button', 'btn small', 'Annulla'); b.type = 'button'; b.addEventListener('click', () => { d.annulla(); b.replaceWith(h('span', '', 'annullato')); aggiornaTutto(); }, { once: true }); f.append(b); }
  if (d.azione) { const b = h('button', 'btn small', esc(d.azione[0])); b.type = 'button'; b.addEventListener('click', d.azione[1]); f.append(b); }
  if (dove) dove.replaceWith(f); else (A.turno || nuovoTurno()).append(f);
  if (d.sintesi && A.turno) A.turno.dataset.sintesi = d.sintesi;
  segnala(d.no ? 'quiete' : 'fatto');
  const path = f.querySelector('path');
  return Promise.all([entra(f, { dy: 4, blur: 4, ms: 380 }), tween(420, e => { path.style.strokeDashoffset = (1 - e).toFixed(3); }, { ritardo: 80 })]);
}
// ogni modifica fatta da un comando si può annullare con un clic. «Annulla» fa l'operazione inversa e tocca solo quello che il
// comando ha cambiato: le differenze fra l'istantanea e D subito dopo il comando (mostraFatto la scatta), rimesse al contrario
// sul D di adesso. Prima rimetteva tutto D com'era prima del comando (sostituisci): con la sincronizzazione annullava anche
// quello che era arrivato nel frattempo da un altro computer o dall'altra finestra (una carta fatta altrove finiva nel Cestino, §7)
function istantanea() {
  const prima = JSON.parse(JSON.stringify(D)); let dopo = null;
  const ann = () => { if (!dopo) dopo = JSON.parse(JSON.stringify(D)); inverti(prima, dopo, D); salva(); };
  ann.fotografa = () => { dopo = JSON.parse(JSON.stringify(D)); };
  return ann;
}
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
const opzioniEsami = (sel, soloDaFare = true) => (soloDaFare ? daFare() : D.esami).map(e => `<option value="${esc(e.id)}"${e.id === sel ? ' selected' : ''}>${esc(e.nome)}</option>`).join('');

function schedaFocus(esameId) {
  const pross = esameId || prossimi()[0]?.id || '';
  const s = scheda('ld-focus', `<span class="ld-lbl">Focus</span>
    <div class="ld-preset" role="radiogroup" aria-label="Durata">${[25, 50, 90].map(m => `<button type="button" role="radio" class="ld-chip${m === D.imp.focus ? ' on' : ''}" data-min="${m}" aria-checked="${m === D.imp.focus}"><b>${m}</b><span>min</span></button>`).join('')}</div>
    <div class="ld-riga-form"><select aria-label="Su che cosa">${'<option value="">Studio libero</option>' + opzioniEsami(pross)}</select><button type="button" class="btn primary" data-via>Inizia</button></div>
    <p class="ld-nota">Pausa di ${esc(D.imp.pausa)} minuti alla fine. Le ore contano nel piano dell'esame.</p>`);
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
      <div><span class="ld-lbl">Media ponderata</span><b class="v" data-v="m">${m.ponderata ? '0' : '—'}</b><span class="d">${m.n ? `aritmetica ${esc(num(m.aritmetica, 2))} · ${esc(m.n)} esami` : 'ancora nessun voto'}</span></div>
      <div><span class="ld-lbl">Base di laurea</span><b class="v" data-v="b">${m.base ? '0' : '—'}<small>/110</small></b><span class="d">${esc(cf)} di ${esc(tot)} CFU</span></div>
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

// sotto ogni appello: gli argomenti di oggi dal piano del programma, o l'invito a incollarlo
function rigaProgramma(e) {
  const o = PG.oggiDi(e);
  if (!o) return `<button type="button" class="ld-prog-riga vuota" data-prog="${esc(e.id)}">Incolla il programma: ti preparo il piano per argomenti</button>`;
  const cosa = o.tipo === 'cuscinetto' ? 'giorno cuscinetto' : o.tipo === 'generale' ? 'ripasso generale' : [...o.studia, ...o.ripassa].map(c => (o.ripassa.includes(c) ? '↻ ' : '') + corto(c.a.t)).join(' · ') || 'niente di nuovo';
  return `<button type="button" class="ld-prog-riga" data-prog="${esc(e.id)}"><span>Oggi</span>${esc(cosa)}<small>${Math.round(PG.pronto(o.cop) * 100)}% pronto</small></button>`;
}
function schedaEsami() {
  const p = prossimi(), senza = daFare().filter(e => !e.data);
  const s = scheda('ld-esami', `<span class="ld-lbl">Prossimi appelli · ${p.length}</span>
    ${p.map(e => { const pi = piano(e), g = giorniTra(oggi(), e.data); return `<div class="ld-es"><div class="t"><b>${esc(e.nome)}</b><span>${esc(dataBreve(e.data))} · ${esc(e.cfu)} CFU · ${esc(num(pi.fatte, 0))} di ${esc(pi.tot)} h${pi.oggi >= .1 ? ` · <em>${esc(num(pi.oggi))} h oggi</em>` : ''}</span><i class="q"><i style="transform:scaleX(0)" data-q="${esc(pi.quota.toFixed(3))}"></i></i></div><span class="g">${g === 0 ? 'oggi' : esc(g)}<small>${g === 0 ? '' : g === 1 ? 'giorno' : 'giorni'}</small></span><button type="button" class="btn small" data-focus="${esc(e.id)}">Focus</button>${rigaProgramma(e)}</div>`; }).join('') || '<p class="ld-nota">Nessun appello in calendario.</p>'}
    ${senza.length ? `<p class="ld-nota">Senza data: ${senza.map(e => esc(e.nome)).join(', ')}.</p>` : ''}
    <form class="ld-riga-form ld-nuovo"><input name="nome" placeholder="Nuovo esame" aria-label="Nome dell'esame" required><input name="cfu" type="number" min="1" max="30" value="6" aria-label="CFU" title="CFU"><input name="data" type="date" aria-label="Data dell'appello"><button class="btn" type="submit">Aggiungi</button></form>`);
  s.querySelectorAll('[data-q]').forEach((x, i) => tween(700, e => { x.style.transform = `scaleX(${(x.dataset.q * e).toFixed(4)})`; }, { ritardo: 150 + i * 70 }));
  s.querySelectorAll('[data-focus]').forEach(b => b.addEventListener('click', () => avviaFocus({ esameId: b.dataset.focus })));
  s.querySelectorAll('[data-prog]').forEach(b => b.addEventListener('click', () => { const e = esame(b.dataset.prog); nuovoTurno(); detto(A.turno, `Programma di ${e.nome}`); schedaProgramma({ esame: e }); }));
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
    ${AI.attiva() ? '' : '<p class="ld-nota">Con il cervello locale (gratis) o la tua AI (scrivi «AI») puoi anche chiedere spiegazioni, creare carte dai PDF e farti interrogare.</p>'}`);
  s.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => { const t = b.dataset.cmd; if (t.endsWith('=')) { const i = campo.querySelector('input'); i.value = t + ' '; i.focus(); } else invia(t); }));
  if (A.turno) A.turno.dataset.sintesi = 'comandi';
}

/* ---------- orario delle lezioni ---------- */
function schedaOrario() {
  const corsi = [...new Set([...D.orario.map(o => o.corso), ...daFare().map(e => e.nome)])];
  const s = scheda('ld-orario', `<span class="ld-lbl">Orario · ${esc(D.orario.length)} ${D.orario.length === 1 ? 'lezione' : 'lezioni'} a settimana</span>
    <div class="ld-sett">${[1, 2, 3, 4, 5, 6].map(g => { const del = D.orario.filter(o => o.giorni.includes(g)).sort((a, b) => a.inizio.localeCompare(b.inizio)); return `<div class="ld-giorno${new Date().getDay() === g ? ' oggi' : ''}"><b>${GIORNI_BREVI[g]}</b>${del.map(o => `<span title="${esc(o.corso)}${o.aula ? ' · aula ' + esc(o.aula) : ''}"><em>${esc(o.inizio)}</em>${esc(o.corso)}</span>`).join('') || '<span class="vuoto">—</span>'}</div>`; }).join('')}</div>
    ${D.orario.length ? `<div class="ld-orari">${D.orario.map(o => `<div class="ld-or"><span class="t"><b>${esc(o.corso)}</b><span>${esc(o.giorni.map(g => GIORNI_BREVI[g]).join(', '))} · ${esc(o.inizio)}–${esc(o.fine)}${o.aula ? ' · aula ' + esc(o.aula) : ''}</span></span><button type="button" class="ld-x" data-via="${esc(o.id)}" aria-label="Togli ${esc(o.corso)}">${IC.chiudi}</button></div>`).join('')}</div>` : ''}
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

/* ---------- il piano per chi lavora: le ore vere, più esami in un calendario solo (js/ore.js) ---------- */
// «2 ore», «1 ora», «circa 1 h 30»: il tetto è una regola scelta dallo studente, non una stima
const oreRegola = m => m % 60 ? ORE.circa(m) : `${m / 60} ${m === 60 ? 'ora' : 'ore'}`;
async function comandoLavoro(c) {
  if (c.azione === 'vedi') return schedaOre();
  const vai = ['La tua settimana', () => { nuovoTurno(); detto(A.turno, 'Piano della settimana'); schedaOre(); }];
  if (c.azione === 'aggiungi' || c.azione === 'sostituisci') {
    const tetto = D.imp.lavoro?.tetto ?? 120, nuovi = c.turni || [c], turni = c.azione === 'sostituisci' ? nuovi : [...(D.imp.lavoro?.turni || []), ...nuovi];
    const card = schedaConferma({ titolo: `Lavori ${ORE.turniTesto(turni)}.`,
      nota: `Lo tolgo dalle ore di studio, con mezz'ora per il viaggio. Nei giorni di lavoro studi al massimo ${oreRegola(tetto)}: lo cambi con «nei giorni di lavoro studio al massimo ${tetto >= 180 ? 2 : 3} ore».` });
    return attendiDecisione(card, async () => {
      const ann = istantanea(); ORE.applica(c); segnala('fatto');
      await mostraFatto({ testo: c.azione === 'sostituisci' ? 'Turni cambiati.' : 'Turni salvati.', nota: `Lavori ${ORE.turniTesto()}.`, annulla: ann, azione: vai, sintesi: `lavoro ${ORE.turniTesto()}` }, card);
      aggiornaTutto(); return {};
    });
  }
  const ann = istantanea(); ORE.applica(c);
  const giorno = d => cap(dataLunga(d));
  const fatto = c.azione === 'togli' ? { testo: 'Turni tolti.', nota: 'Il piano torna a contare tutta la tua giornata di studio.' }
    : c.azione === 'eccezione' ? (c.no ? { testo: `${giorno(c.data)} non lavori.`, nota: 'Quelle ore tornano libere per studiare.' } : { testo: `${giorno(c.data)} lavori anche ${ORE.ora(c.inizio)}–${ORE.ora(c.fine)}.`, nota: 'Solo quel giorno: lo tolgo dalle ore di studio.' })
    : c.azione === 'tetto' ? { testo: `Nei giorni di lavoro studi al massimo ${oreRegola(D.imp.lavoro.tetto)}.`, nota: 'Il piano si rifà con questo tetto.' }
    : { testo: `Studi dalle ${ORE.ora(c.da)} alle ${ORE.ora(c.a)}.`, nota: 'Il piano usa solo queste ore, meno lezioni e lavoro.' };
  aggiornaTutto();
  return mostraFatto({ ...fatto, annulla: ann, azione: vai, sintesi: fatto.testo });
}
// quello che non ci sta: le frasi, sempre con le opzioni (ognuna col suo risparmio) o con la frase di ripiego; le scelte
// accese come chip con ✕. Solo dei turni di quell'esame se solo è un id. msg: la frase dopo un clic
function riquadroOre(cal, solo = null, msg = '') {
  const r = ORE.riquadro(cal, esame, solo), scelte = D.imp.oreScelte || [];
  const chip = scelte.length ? `<div class="ld-ore-scelte">${scelte.map(k => `<button type="button" class="ld-ore-chip" data-via="${esc(k)}" aria-label="Togli: ${esc(ORE.testoScelta(k))}">${esc(ORE.testoScelta(k))} <span aria-hidden="true">✕</span></button>`).join('')}</div>` : '';
  const dopo = msg ? `<p class="ld-ore-msg">${esc(msg)}</p>` : '';
  if (!r) return dopo || chip ? `<div class="ld-ore-manca">${dopo}${chip}</div>` : '';
  return `<div class="ld-ore-manca">${r.righe.map(t => `<p>${esc(t)}</p>`).join('')}
    ${r.opzioni.length ? `<div class="az">${r.opzioni.map(o => `<button type="button" class="btn small" data-scelta="${esc(o.k)}">${esc(o.testo)}</button>`).join('')}</div>` : `<p class="ld-nota">${esc(r.ripiego)}</p>`}${dopo}${chip}</div>`;
}
// i bottoni del riquadro: una scelta si accende solo col clic, poi si rifà il conto e si dice quanto manca ancora
function legaOre(s, ridisegna) {
  s.querySelectorAll('[data-scelta]').forEach(b => b.addEventListener('click', () => { ORE.scegli(b.dataset.scelta); segnala('fatto'); ridisegna(ORE.dopoScelta(ORE.calendario())); aggiornaTutto(); }));
  s.querySelectorAll('.ld-ore-chip').forEach(b => b.addEventListener('click', () => { ORE.scegli(b.dataset.via, false); ridisegna(''); aggiornaTutto(); }));
}
// «La tua settimana»: oggi in cima, poi 7 giorni con le ore libere, il turno e le voci di tutti gli esami
function schedaOre() {
  const s = scheda('ld-ore', '');
  const disegna = (msg = '') => {
    const cal = ORE.calendario(), turni = D.imp.lavoro?.turni || [];
    s.innerHTML = `<span class="ld-lbl">La tua settimana</span>
      <div class="ld-ore-oggi"><span class="ld-lbl">Oggi</span><p>${esc(ORE.testoOggi(cal, esame))}</p></div>
      ${riquadroOre(cal, null, msg)}
      <ul class="ld-ore-giorni">${cal.giorni.slice(0, 7).map((g, k) => `<li${k ? '' : ' class="oggi"'}><b>${esc(ORE.rigaGiorno(g))}</b>${ORE.vociGiorno(g, esame).map(t => `<span>${esc(t)}</span>`).join('') || '<span class="vuoto">niente nel piano</span>'}</li>`).join('')}</ul>
      <p class="ld-nota">${turni.length ? `Lavori ${esc(ORE.turniTesto())}: lo tolgo dalle ore di studio, con mezz'ora per il viaggio. Nei giorni di lavoro studi al massimo ${esc(oreRegola(D.imp.lavoro.tetto ?? 120))}.` : 'Se lavori, scrivimelo: «lavoro lunedì mercoledì venerdì 14-19».'} ${cal.attivo ? '' : 'Con un esame solo e senza lavoro, il piano è quello del programma.'} Le ore sono stime: un argomento nuovo circa 1 h, un ripasso circa 30 min.</p>`;
    legaOre(s, disegna);
  };
  disegna();
  if (A.turno) A.turno.dataset.sintesi = 'la tua settimana';
  return s;
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
// «Lezione dal computer» (js/computer.js): per chi non frequenta. Prima la scheda: di che corso è, e il patto (la prima volta)
function schedaComputer(corsoDetto) {
  if (!V.attivo) return rispostaFissa('La trascrizione delle videolezioni è nell\'**app desktop** di Lode: ascolta l\'audio del computer e scrive nella nota Obsidian della lezione.');
  if (TR.attiva()) return mostraFatto({ testo: 'Sto già trascrivendo.', nota: `${TR.stato().parole} parole finora.` });
  const corsi = corsiPossibili(), scelto = corsoDetto ? (trovaEsame(corsoDetto)?.nome || corsi.find(c => norm(c).startsWith(norm(corsoDetto))) || corsoDetto.replace(/^./, c => c.toUpperCase())) : corsi[0];
  const lista = scelto && !corsi.some(c => norm(c) === norm(scelto)) ? [scelto, ...corsi] : corsi;
  const s = scheda('ld-computer', `<span class="ld-lbl">Lezione dal computer</span>
    <p>Fai partire la videolezione (sulla piattaforma del tuo ateneo, su Teams, Zoom o dove la segui): ascolto l'audio che esce dal computer e la scrivo nella nota della lezione, formule comprese.</p>
    <div class="ld-riga-form ld-per"><span class="ld-lbl">Corso</span>${lista.length ? `<select aria-label="Corso">${lista.map(c => `<option${norm(c) === norm(scelto || '') ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>` : '<input aria-label="Corso" placeholder="Nome del corso">'}<button type="button" class="btn primary" data-via>Inizia</button></div>
    ${D.imp.computerOk ? '' : '<p class="ld-nota">Solo per studiare tu: non scarico il video e non carico niente online, l\'audio non si salva e nella nota va solo il testo. Le lezioni sono dei docenti: non condividere la trascrizione se il regolamento del tuo ateneo non lo permette.</p>'}
    <p class="ld-nota">${window.lodeDesktop?.piattaforma === 'darwin' ? 'La prima volta il Mac ti chiede il permesso di registrare l\'audio del sistema.' : window.lodeDesktop?.piattaforma === 'win32' ? 'Su Windows senti l\'audio come sempre: lo ascolto anch\'io.' : 'Su Linux ascolto il «monitor» dell\'uscita audio.'}</p>`);
  s.querySelector('[data-via]').addEventListener('click', () => {
    const corso = (s.querySelector('select')?.value || s.querySelector('input')?.value || '').trim() || 'Videolezioni';
    D.imp.computerOk = true; salva(); s.querySelector('[data-via]').disabled = true;
    nuovoTurno(); detto(A.turno, `Trascrivi la videolezione di ${corso}`);
    avviaTrascrizione({ sorgente: 'computer', lezione: lezionePer(corso, oggi()) });
  });
  if (A.turno) A.turno.dataset.sintesi = 'lezione dal computer';
}
// il sistema non dà l'audio: cosa fare, per sistema
function erroreComputer(e) {
  const mac = window.lodeDesktop?.piattaforma === 'darwin', win = window.lodeDesktop?.piattaforma === 'win32';
  if (/NotAllowed|Permission/i.test(e?.name + e?.message)) return mac ? 'Il Mac non mi dà l\'audio del computer: in **Impostazioni di Sistema › Privacy e sicurezza › Registrazione audio dello schermo e del sistema** attiva Lode, poi riprova (a volte serve riaprire Lode).' : 'Il sistema non mi dà l\'audio del computer: riprova e conferma la richiesta di condivisione.';
  return (mac ? 'Non riesco ad ascoltare l\'audio del computer (serve macOS 14.2 o più recente). ' : win ? 'Non riesco ad ascoltare l\'audio del computer. ' : 'Non riesco ad ascoltare l\'audio del computer (serve PulseAudio o PipeWire). ') + (e?.message || '');
}
// lo stream può arrivare muto senza errori (permesso negato in silenzio): dopo 25 s senza un suono, lo dico
let tMuto = 0;
function controllaMuto() {
  clearTimeout(tMuto);
  tMuto = setTimeout(() => {
    if (!TR.attiva() || TR.stato()?.sorgente !== 'computer' || !CO.muto(20000)) return;
    const mac = window.lodeDesktop?.piattaforma === 'darwin';
    apri({ fisso: true }).then(() => { nuovoTurno(); rispostaFissa(`Non sento niente dal computer. La videolezione è partita, con il volume alzato?${mac ? ' Se sì, il Mac non mi sta dando l\'audio: **Impostazioni di Sistema › Privacy e sicurezza › Registrazione audio dello schermo e del sistema**, attiva Lode e riprova.' : ''}`); });
  }, 25000);
}
if (typeof addEventListener === 'function') addEventListener('lode:computer', e => { if (e.detail?.finito && TR.attiva() && TR.stato()?.sorgente === 'computer') { apri({ fisso: true }).then(() => { nuovoTurno(); fermaTrascrizione(); }); } });
async function avviaTrascrizione(opz = {}) {
  if (!V.attivo) return rispostaFissa('La trascrizione delle lezioni è nell\'**app desktop** di Lode: scrive direttamente nella nota Obsidian della lezione.');
  if (TR.attiva()) return mostraFatto({ testo: 'Sto già trascrivendo.', nota: `${TR.stato().parole} parole finora.` });
  if (opz.sorgente === 'computer' && !CO.disponibile()) return rispostaFissa('Questa versione non riesce ad ascoltare l\'audio del computer: aggiorna Lode.');
  const l = opz.lezione || V.lezioneDaAnnotare();
  if (!opz.daFile && opz.sorgente !== 'computer' && !(await consensoAula())) return;
  try {
    if (!Voce.pronta()) { modo('pensa', 'Preparo la voce…'); attesaVoce = 'Preparo la voce…'; }
    await TR.avvia(l, opz); modo('riposo');
    try { localStorage.setItem('lode:voce', '1'); } catch { }
    if (opz.daFile) {   // una registrazione: si trascrive tutta, poi si chiude da sola
      await mostraFatto({ testo: `Trascrivo «${opz.daFile}» nella lezione di ${l.corso}.`, nota: 'Puoi chiudere il pannello: ti avviso alla fine.', sintesi: 'registrazione in trascrizione' });
      aggiornaTutto();
      await new Promise(ok => { const g = () => { const t = TR.stato(); if (!t || (!t.coda && !TR.occupata())) ok(); else setTimeout(g, 500); }; setTimeout(g, 800); });
      return fermaTrascrizione();
    }
    if (opz.sorgente === 'computer') {
      await mostraFatto({ testo: `Ascolto l'audio del computer per ${l.corso}.`, nota: 'Fai partire la videolezione: le righe arrivano nella nota ogni 20-30 secondi. Quando finisce, scrivi «fine lezione».', azione: ['Apri in Obsidian', () => apriAppunti(l)], sintesi: 'videolezione in trascrizione' });
      segnala('focus'); aggiornaTutto(); controllaMuto();
      dopo(2500, () => { if (A.aperto && !A.attesa) chiudi('Ascolto la videolezione'); });
      return;
    }
    await mostraFatto({ testo: `Trascrivo ${l.corso === 'Appunti sparsi' ? 'gli appunti sparsi' : 'la lezione di ' + l.corso}.`, nota: 'Le righe arrivano nella nota ogni 20-30 secondi.', azione: ['Apri in Obsidian', () => apriAppunti(l)], sintesi: 'trascrizione avviata' });
    segnala('focus'); aggiornaTutto();
    if (!opz.audioProva) dopo(1200, () => { if (A.aperto && !A.attesa) chiudi('Trascrivo la lezione'); });
  } catch (e) { modo('riposo'); rispostaFissa(opz.sorgente === 'computer' ? erroreComputer(e) : 'Non riesco a trascrivere: ' + (/Permission|NotAllowed|NotFound|NotReadable/i.test(e.name + e.message) ? Voce.erroreMicrofono(e) : e.message), { errore: true }); }
}
async function fermaTrascrizione() {
  if (!TR.attiva()) return rispostaFissa('Non sto trascrivendo niente.');
  modo('pensa', 'Trascrivo gli ultimi secondi…'); attesaVoce = 'Trascrivo gli ultimi secondi…';
  const l = TR.stato().lezione, r = await TR.ferma(); modo('riposo'); segnala('fatto'); aggiornaTutto();
  await mostraFatto({ testo: `Lezione trascritta: ${r.parole.toLocaleString('it-IT')} parole.`, nota: r.sospese ? `${r.sospese} ${r.sospese === 1 ? 'riga non è ancora' : 'righe non sono ancora'} nella nota (la cartella non risponde): le scrivo appena posso, tienimi aperto.` : 'È tutto nella nota.', azione: AI.attiva() ? ['Riordina', () => { nuovoTurno(); detto(A.turno, 'Riordina la lezione'); riordinaLezione(null, l); }] : ['Condividi', () => { nuovoTurno(); detto(A.turno, 'Condividi la sbobina'); condividiLezione(l.corso); }], sintesi: `${r.parole} parole trascritte` });
  if (r.sorgente !== 'computer' && !(D.imp.ripetiInAula && (lezioneOra() || ripetiAMano()))) O.spegni();   // il microfono resta acceso solo se serve a «Ripeti»
  clearTimeout(tMuto);
  if (!AI.attiva()) rispostaFissa('Con il **cervello locale** (da «Prepara Lode») la trascrizione diventa appunti ordinati, definizioni e ★ con un clic.');
}
async function riordinaLezione(corso, lez) {
  await new Promise(r => setTimeout(r, 600));   // il vault rilegge la nota appena scritta
  const l = lez ? (lezioni().find(x => x.file && norm(x.corso) === norm(lez.corso) && x.data === lez.data) || lez) : lezioni().find(x => (x.paroleTrascritte || 0) >= 40 && (!corso || norm(x.corso) === norm(corso)));
  if (!l?.trascrizione || l.paroleTrascritte < 30) return rispostaFissa(corso ? `Non trovo una trascrizione di **${corso}**.` : 'Non trovo una lezione trascritta. In aula premi **Trascrivi la lezione**.');
  if (!AI.attiva()) return rispostaFissa('Per riordinare serve l\'AI: installa il **cervello locale** da «Prepara Lode» (gratis, offline) o collega la tua AI: scrivi «AI».');
  modo('pensa', `Riordino ${l.corso}…`); segnala('pensa');
  let md;
  try { md = await AI.riordina({ corso: l.corso, testo: l.trascrizione, appunti: l.appunti, avanza: p => modo('pensa', `Riordino ${l.corso}… ${Math.round(p * 100)}%`) }); }
  catch (e) { modo('riposo'); return rispostaFissa('Non sono riuscito a riordinare: ' + e.message, { errore: true }); }
  modo('riposo');
  const card = schedaConferma({ titolo: `Salvare gli appunti riordinati di ${l.corso}?`, extra: `<div class="ld-anteprima">${mdHtml(md.slice(0, 1400))}${md.length > 1400 ? '<span class="ld-tenue"> …</span>' : ''}</div>`,
    nota: `Vanno nella nota, in «Appunti riordinati da Lode», sotto la trascrizione (che resta). Li ha scritti ${AI.nomeMotore('testo')}: rileggili.` });
  await attendiDecisione(card, async () => {
    await V.annota('riordinati', md, { lezione: l, grezza: true });
    await mostraFatto({ testo: 'Appunti salvati nella nota.', azione: ['Condividi', () => { nuovoTurno(); detto(A.turno, 'Condividi la sbobina'); condividiLezione(l.corso); }], sintesi: 'lezione riordinata' }, card);
    nuovoTurno(); detto(A.turno, 'Definizioni dalla lezione');
    return chiudiLezione(l.corso, { lezione: l, testo: md.slice(0, 9000) });
  });
}

/* ---------- «Ripeti»: cosa ha appena detto il prof ---------- */
// quando l'hai acceso tu fuori dall'orario di lezione: il controllo di ogni minuto non lo spegne per O.MANUALE
let ripetiManuale = 0;
const ripetiAMano = () => !!ripetiManuale && Date.now() - ripetiManuale < O.MANUALE;
async function consensoAula() {
  if (D.imp.trascrizioneOk) return true;
  const card = schedaConferma({ titolo: 'Ascoltare la lezione?', fuoco: false,
    righe: [['Ripeti', 'tengo in memoria solo l\'ultimo minuto e mezzo, mai su disco'], ['Trascrivi', 'scrivo la lezione nella nota, l\'audio non si salva'], ['Dove', 'tutto sul computer, niente su internet']],
    nota: 'Registrare una lezione dipende dal regolamento del tuo ateneo e dal docente: chiedi prima.' });
  card.dataset.soloClic = '1'; card.querySelector('.az small').textContent = 'Te lo chiedo solo la prima volta.';
  const r = await attendiDecisione(card, async () => { D.imp.trascrizioneOk = true; salva(); await mostraFatto({ testo: 'D\'accordo.' }, card); return { ok: true }; });
  return !!r?.ok;
}
async function accendiRipeti() {
  if (!V.attivo) return rispostaFissa('«Ripeti» è nell\'**app desktop** di Lode.');
  if (!(await consensoAula())) return;
  try { await O.accendi(); D.imp.ripetiInAula = true; ripetiManuale = lezioneOra() ? 0 : Date.now(); salva(); Voce.prepara().catch(() => { }); aggiornaTutto(); }
  catch (e) { return rispostaFissa(Voce.erroreMicrofono(e), { errore: true }); }
  return mostraFatto({ testo: 'Ripeti è attivo.', nota: `Tengo in memoria l'ultimo minuto e mezzo, mai su disco. Ti sei perso qualcosa? ${MAC ? '⌃⌥P' : 'Ctrl Alt P'} o «ripeti».${ripetiManuale ? ' Fuori dall\'orario di lezione resto acceso al massimo 3 ore.' : ''}`, ...(ripetiManuale ? { azione: ['Spegni', () => { nuovoTurno(); detto(A.turno, 'Spegni Ripeti'); spegniRipeti(); }] } : {}), sintesi: 'ripeti attivo' });
}
function spegniRipeti() {
  const eraAuto = !!D.imp.ripetiInAula; D.imp.ripetiInAula = false; ripetiManuale = 0; salva(); if (!TR.attiva()) O.spegni(); aggiornaTutto();
  return mostraFatto({ testo: 'Ripeti spento.', nota: `${TR.attiva() ? 'Il microfono resta acceso per la trascrizione, finché non la chiudi.' : 'Il microfono è chiuso.'}${eraAuto ? ` A lezione non si accende più da solo: lo riaccendi con ${MAC ? '⌃⌥P' : 'Ctrl Alt P'}.` : ''}` });
}
// quello che ha detto il prof: l'ultima frase (quella che ti sei perso) in chiaro, il resto prima, più tenue
function dettoProf(f) {
  const frasi = f.match(/[^.!?…]+(?:[.!?…]+|$)/g)?.map(x => x.trim()).filter(Boolean) || [f];
  let k = frasi.length - 1; while (k > 0 && frasi.slice(k).join(' ').length < 70) k--;
  let prima = frasi.slice(0, k).join(' '), ultima = frasi.slice(k).join(' ');
  // senza punti (Whisper a volte non li mette) l'«ultima frase» sarebbe tutto: si taglia sulle virgole, poi sulle parole
  if (ultima.length > 220) {
    const pezzi = ultima.split(/(?<=,)\s+/); let j = pezzi.length - 1; while (j > 0 && pezzi.slice(j).join(' ').length < 90) j--;
    let coda = pezzi.slice(j).join(' ');
    if (coda.length > 220) coda = coda.split(' ').slice(-30).join(' ');
    prima = (prima + ' ' + ultima.slice(0, ultima.length - coda.length)).trim(); ultima = coda;
  }
  return `${prima ? `<span class="prima">${mdHtml(prima)}</span> ` : ''}<span class="ultima">${mdHtml(ultima)}</span>`;
}
// gesto: la scorciatoia o il bottone. Scritto o detto («ripeti», «non ho capito») fuori lezione non accende il microfono da solo
async function ripeti(sec = 60, { gesto = false } = {}) {
  if (!O.attivo()) {
    if (gesto || lezioneOra()) return accendiRipeti();
    return mostraFatto({ testo: 'Ripeti è spento.', nota: `Ripeti ti scrive cosa ha detto il prof negli ultimi 60 secondi: lo accendi qui o con ${MAC ? '⌃⌥P' : 'Ctrl Alt P'}. Se volevi altro, chiedimelo con parole tue.`, azione: ['Accendi', () => { nuovoTurno(); detto(A.turno, 'Accendi Ripeti'); accendiRipeti(); }], sintesi: 'ripeti spento', no: true });
  }
  if (O.secondi() < 1) return rispostaFissa('Ascolto da un attimo: non ho ancora niente da ripeterti.');
  const quando = new Date(), audio = O.ultimi(sec);
  const riascolto = `Riascolto gli ultimi ${Math.round(Math.min(sec, O.secondi()))} secondi…`;
  modo('pensa', riascolto); attesaVoce = riascolto; segnala('pensa');
  let testo = ''; try { testo = await Voce.trascriviAudio(audio, { subito: true }); } catch (e) { modo('riposo'); return rispostaFissa('Non sono riuscito a riascoltare: ' + e.message, { errore: true }); }
  modo('riposo');
  if (!testo) return rispostaFissa('Negli ultimi 60 secondi non ho sentito parlare.');
  const f = parlatoInFormule(testo), hh = `${String(quando.getHours()).padStart(2, '0')}:${String(quando.getMinutes()).padStart(2, '0')}`;
  const s = scheda('ld-ripeti', `<span class="ld-lbl">Gli ultimi ${esc(Math.round(Math.min(sec, audio.length / 16000)))} secondi · ${esc(hh)}</span><p class="ld-detto-prof">${dettoProf(f)}</p>
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

/* ---------- esportare per Anki (js/anki.js) ---------- */
// le carte del ripasso e le definizioni delle lezioni, senza doppioni, in un file solo con un mazzo per corso (Lode::<Corso>):
// in Anki basta un'importazione. Nell'app il file va nel vault (Anki/…) e si mostra nella cartella; nel browser si scarica.
// La nota dice di scegliere il tipo «Basilare»: #notetype:Basic vale solo nell'Anki in inglese (js/anki.js)
function scaricaTesto(nome, testo) {
  const u = URL.createObjectURL(new Blob([testo], { type: 'text/plain;charset=utf-8' })), a = h('a');
  a.href = u; a.download = nome; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60e3);
}
async function esportaAnki(corsoDetto) {
  // il corso detto vale col suo nome e con quello dell'esame che gli somiglia («analisi 2» → «Analisi 2»), niente di più largo
  const e = corsoDetto ? trovaEsame(corsoDetto) : null, nomi = new Set([norm(corsoDetto), norm(e?.nome)].filter(Boolean));
  const carte = D.carte.map(c => ({ id: c.id, fronte: c.fronte, retro: c.retro, corso: esame(c.esameId)?.nome || 'Varie' }));
  const p = preparaAnki({ carte, definizioni: definizioni({ giorni: 3650 }), corso: corsoDetto ? n => nomi.has(norm(n)) : null });
  if (!p.totale) return rispostaFissa(corsoDetto ? `Non trovo carte né definizioni di **${e?.nome || corsoDetto}** da esportare.` : 'Non ho ancora carte né definizioni da esportare: segna qualche definizione a lezione («def: gradiente = …») o crea delle carte da un PDF.');
  const nome = nomeFileAnki(corsoDetto ? p.mazzi[0].corso : null, oggi()), testo = testoAnki(p.mazzi);
  const quante = `${p.totale} ${p.totale === 1 ? 'carta' : 'carte'} per Anki${p.mazzi.length > 1 ? `, ${p.mazzi.length} mazzi` : ` nel mazzo ${mazzo(p.mazzi[0].corso)}`}.${p.doppioni ? ` ${p.doppioni} ${p.doppioni === 1 ? 'doppione saltato' : 'doppioni saltati'}.` : ''}`;
  if (!V.attivo) { scaricaTesto(nome, testo); return mostraFatto({ testo: quante, nota: `In Anki: File › Importa, scegli «${nome}» (è tra i download) e come tipo di nota «Basilare» («Basic» in inglese).`, azione: ['Scarica', () => scaricaTesto(nome, testo)], sintesi: 'carte per Anki' }); }
  try {
    const r = await V.salvaFile(`Anki/${nome}`, { testo, sostituisci: true });
    return mostraFatto({ testo: quante, nota: `In Anki: File › Importa, scegli «${r.file}» nel vault e come tipo di nota «Basilare» («Basic» in inglese).`, azione: ['Mostra', () => V.mostra(r.file).catch(x => rispostaFissa('Non riesco a mostrare il file: ' + x.message, { errore: true }))], sintesi: 'carte per Anki' });
  } catch (x) { return rispostaFissa('Non riesco a salvare il file per Anki: ' + x.message, { errore: true }); }
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
  const ai = AI.attiva(), app = V.attivo, serveAI = ai ? '' : 'serve il cervello locale o la tua AI', serveApp = app ? '' : 'nell\'app desktop';
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
    { k: 'crocette', t: 'Quiz a crocette', d: 'Domande con 4 risposte, come allo scritto: allenamento o simulazione d\'esame', no: serveAI, corso: true },
    { k: 'temi', t: 'Temi d\'esame', d: 'Gli esercizi di un compito vecchio, divisi per argomento, uno al giorno nel piano', corso: true },
    { k: 'programma', t: 'È il programma d\'esame', d: 'Lo divido in argomenti e ti preparo il piano fino all\'appello', corso: true },
    { k: 'domande', t: 'Domande uscite agli appelli', d: 'Le metto sotto i loro argomenti: quelli che escono di più salgono nel piano', corso: true },
  ].map(o => /programm|syllabus|scheda.?(?:del.?)?corso/i.test(x.nome) ? { ...o, primo: o.k === 'programma' } : /compit|(?:^|[^a-z])temi(?:[^a-z]|$)|prova.?scritt|esercitaz/i.test(x.nome) ? { ...o, primo: o.k === 'temi' } : /domande|appell/i.test(x.nome) ? { ...o, primo: o.k === 'domande' } : o);
  return [];
}
function schedaFile(x, { corso: suggerito } = {}) {
  if (x.tipo === 'altro') return rispostaFissa(t('barra2.file-non-so-usare', { motivo: x.motivo }));
  const op = opzioniPer(x), tutti = corsiPossibili(), corsi = suggerito ? [suggerito, ...tutti.filter(c => norm(c) !== norm(suggerito))] : tutti, serveCorso = op.some(o => o.corso), serveData = op.some(o => o.data);
  const s = scheda('ld-file-op', `<div class="capo">${ico(ICONA_FILE[x.tipo] || 'doc')}<span class="t"><b>${esc(x.nome)}</b><span>${NOME_TIPO[x.tipo]} · ${x.mb < 1 ? t('barra2.peso-kb', { n: Math.max(1, Math.round(x.mb * 1024)) }) : t('barra2.peso-mb', { n: num(x.mb, 1) })}</span></span></div>
    <span class="ld-lbl">${t('barra2.cosa-ne-faccio')}</span>
    <div class="ld-opzioni">${op.map(o => `<button type="button" class="ld-op${o.primo && !o.no ? ' primo' : ''}" data-op="${o.k}"${o.no ? ' disabled' : ''}><b>${esc(o.t)}</b><span>${esc(o.no ? o.d + ' · ' + o.no : o.d)}</span></button>`).join('')}</div>
    ${serveCorso && corsi.length ? `<div class="ld-riga-form ld-per"><span class="ld-lbl">${t('barra2.per')}</span><select aria-label="${t('barra2.corso')}">${corsi.map(c => `<option>${esc(c)}</option>`).join('')}</select>${serveData ? `<input type="date" aria-label="${t('barra2.data-lezione')}" value="${isoDi(x.file.lastModified || Date.now())}">` : ''}</div>` : ''}`);
  s.querySelectorAll('.ld-op').forEach((b, i) => entra(b, { ritardo: 80 + i * 55, dy: 6, blur: 5, ms: 420 }));
  s.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', async () => {
    s.querySelectorAll('[data-op]').forEach(y => { y.disabled = true; y.classList.toggle('scelta', y === b); });
    const corso = s.querySelector('.ld-per select')?.value || corsi[0] || null, data = s.querySelector('.ld-per input[type=date]')?.value;
    try { await usaFile(x, b.dataset.op, { corso, data }); }
    catch (e) { modo('riposo'); rispostaFissa(t('barra2.non-andata', { errore: e.message }), { errore: true }); s.querySelectorAll('[data-op]').forEach((y, i) => { y.disabled = !!op[i].no; y.classList.remove('scelta'); }); }
  }));
  if (A.turno) A.turno.dataset.sintesi = t('barra2.sintesi-cosa-ne-faccio', { nome: x.nome });
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
  if (op === 'allega') { const r = await allegaFile(x, corso); return mostraFatto({ testo: t('barra2.allegato-lezione', { corso: r.l.corso }), azione: [t('barra2.apri'), () => apriAppunti(r.l)] }); }
  if (op === 'sbobina') {
    const sb = SB.leggi(x.testo), corsoN = trovaEsame(sb.corso)?.nome || sb.corso;
    const r = await V.salvaFile(`Lezioni/${pulito(corsoN)}/${sb.data} ${pulito(corsoN)} · sbobina${sb.da ? ' di ' + pulito(sb.da) : ''}.md`, { testo: sb.nota });
    aggiornaTutto(); segnala('fatto');
    return mostraFatto({ testo: t('barra2.sbobina-nel-vault', { corso: corsoN }), nota: sb.da ? t('barra2.sbobina-nota-da', { data: dataBreve(sb.data), da: sb.da }) : dataBreve(sb.data), azione: [t('barra2.apri'), () => apriAppunti({ file: r.file, corso: corsoN })], sintesi: t('barra2.sbobina-ricevuta') });
  }
  if (op === 'importaCarte') {
    const carte = [];
    for (const riga of x.testo.split(/\r?\n/)) { if (!riga.trim() || riga.startsWith('#')) continue; const p = riga.split(/\t| = | → |;(?=[^;]*$)/); if (p.length >= 2 && p[0].trim() && p[1].trim()) carte.push({ fronte: p[0].trim().replace(/^"|"$/g, ''), retro: p.slice(1).join(' ').trim().replace(/^"|"$/g, '') }); }
    if (!carte.length) return rispostaFissa(t('barra2.nessuna-riga-carte'));
    return eseguiStrumento('crea_carte', { carte: carte.slice(0, 30), esame: corso || prossimi()[0]?.nome });
  }
  if (op === 'audio') {
    modo('pensa', t('barra2.apro-registrazione'));
    const audio = await FILE.audioDi(x.file); modo('riposo');
    const l = lezionePer(corso, data);
    return avviaTrascrizione({ audioProva: audio, lezione: l, daFile: x.nome });
  }
  if (op === 'lavagna') {
    modo('pensa', t('barra2.leggo-foto')); segnala('pensa');
    const blocco = await AI.bloccoFile(x.file), md = await AI.trascriviFoto({ blocco, corso }); modo('riposo');
    const card = schedaConferma({ titolo: t('barra2.lavagna-titolo', { corso }), extra: `<div class="ld-anteprima">${mdHtml(md.slice(0, 1400))}</div>`, nota: t('barra2.lavagna-nota', { motore: AI.nomeMotore('testo') }) });
    formuleIn(card.querySelector('.ld-anteprima'), md.slice(0, 1400));   // le formule disegnate, come in Obsidian
    return attendiDecisione(card, async () => { const r = await allegaFile(x, corso); await V.annota('appunti', md, { lezione: r.l, grezza: true }); await mostraFatto({ testo: t('barra2.lavagna-fatta'), azione: [t('barra2.apri'), () => apriAppunti(r.l)] }, card); return {}; });
  }
  // i temi d'esame leggono il testo da soli: un PDF scansionato non è un errore, si dice di incollare il testo (niente AI né OCR)
  if (op === 'temi') return temiDaFile(x, corso);
  // da qui serve il testo del file
  modo('pensa', t('barra2.leggo-file', { nome: x.nome })); segnala('pensa');
  let testo = null, blocchi;
  if (x.tipo === 'foto') blocchi = [await AI.bloccoFile(x.file)];
  else {
    try { testo = await FILE.testoDi(x); blocchi = [{ type: 'text', text: `[${x.nome}]\n${testo.slice(0, 120000)}` }]; }
    catch (e) { if (x.tipo === 'pdf' && AI.motore('testo') === 'claude') blocchi = [await AI.bloccoFile(x.file)]; else throw e; }
  }
  if (op === 'crocette') { modo('riposo'); if (!testo) return rispostaFissa(t('barra2.file-senza-testo')); return schedaCrocette({ esame: trovaEsame(corso || ''), materiale: testo, nomeFile: x.nome }); }
  if (op === 'programma' || op === 'domande') {
    modo('riposo');
    if (!testo) return rispostaFissa(t('barra2.file-senza-testo-incolla'));
    const e = trovaEsame(corso || '') || (corso ? aggiungiEsame({ nome: corso }) : prossimi()[0]);
    if (!e) return rispostaFissa(t('barra2.prima-esame'));
    return op === 'programma' ? proponiProgramma(e, testo, { fonte: x.nome }) : aggiungiDomandeUscite(e, testo);
  }
  if (op === 'carte') {
    modo('pensa', t('barra2.scrivo-carte'));
    const carte = await AI.carteDa(blocchi); modo('riposo');
    if (!carte.length) return rispostaFissa(t('barra2.file-senza-carte'));
    return eseguiStrumento('crea_carte', { carte, esame: corso || prossimi()[0]?.nome });
  }
  if (op === 'definizioni') { modo('riposo'); return chiudiLezione(corso, { lezione: lezionePer(corso), testo: (testo || '').slice(0, 9000) }); }
  if (op === 'orale') { modo('riposo'); return avviaOrale(trovaEsame(corso || '') || { id: null, nome: corso || x.nome }, null, (testo || '').slice(0, 30000)); }
  if (op === 'riassunto') {
    const md = await AI.riassumi({ corso, testo, nome: x.nome, avanza: p => modo('pensa', t('barra2.riassumo', { nome: x.nome, p: Math.round(p * 100) })) }); modo('riposo');
    const card = schedaConferma({ titolo: t('barra2.riassunto-titolo'), extra: `<div class="ld-anteprima">${mdHtml(md.slice(0, 1400))}${md.length > 1400 ? '<span class="ld-tenue"> …</span>' : ''}</div>`, nota: t('barra2.riassunto-nota', { cartella: `Materiali/${pulito(corso || 'Varie')}` }) });
    return attendiDecisione(card, async () => {
      const al = await V.salvaFile(`Allegati/${x.nome}`, { dati: new Uint8Array(await x.file.arrayBuffer()) });
      const n = await V.salvaFile(`Materiali/${pulito(corso || 'Varie')}/${x.nome.replace(/\.[^.]+$/, '')}.md`, { testo: `---\ntipo: materiale\ncorso: "[[${pulito(corso || '')}]]"\nfonte: "[[${al.file.split('/').pop()}]]"\ntags: [materiale]\n---\n# ${x.nome.replace(/\.[^.]+$/, '')}\n\n[[${pulito(corso || 'Home')}]] · file originale: ![[${al.file.split('/').pop()}]]\n\n${md}\n` });
      await mostraFatto({ testo: t('barra2.riassunto-salvato'), azione: [t('barra2.apri'), () => apriAppunti({ file: n.file, corso: x.nome })] }, card); return {};
    });
  }
}

/* ---------- le proposte dell'allenatore: la pillola si allunga e chiede ---------- */
let tProposta = 0;
function mostraProposta(p) {
  if (A.aperto || A.zona || A.proposta || O.attivo()) return;   // col microfono acceso la pillola resta visibile
  A.proposta = p; const el = shell.querySelector('.ld-proposta');
  el.querySelector('b').textContent = p.titolo; el.querySelector('.t span').textContent = p.testo; el.querySelector('[data-p=si]').textContent = p.bottone;
  shell.classList.add('propone'); forma.w.t = Math.min(520, innerWidth - 16); forma.h.t = 50; forma.r.t = 25; molla();
  entra(el, { ritardo: 120, dy: 4, blur: 6, ms: 480 }); segnala('conferma-pronta');
  clearTimeout(tProposta); tProposta = setTimeout(() => nascondiProposta('ignorata'), 90e3);
}
function nascondiProposta(esito) {
  const p = A.proposta; if (!p) return; A.proposta = null; clearTimeout(tProposta);
  if (esito) AL.registra(p, esito);
  shell.classList.remove('propone');
  if (!A.aperto) { forma.w.t = larghezza(); forma.h.t = 36; forma.r.t = 18; molla(); }
  return p;
}
async function accettaProposta() {
  const p = nascondiProposta('accettata'); if (!p) return;
  await apri({ fisso: true }); nuovoTurno(); detto(A.turno, `${p.bottone} · ${p.esame?.nome || p.corso || ''}`);
  if (p.tipo === 'gioco') return schedaGioco(p.esame?.nome || p.corso);
  if (p.tipo === 'stampa') return ST.schedaStampa({ corso: p.corso, seme: p.seme });   // con lo stesso seme parte dalla domanda annunciata
  if (p.tipo === 'ripasso') return schedaRipasso(p.esame?.id);
  if (p.tipo === 'orale') return avviaOrale(p.esame);
  if (p.tipo === 'moodle') return schedaMoodle('novita');
  if (p.tipo === 'agente') return schedaTurno(p.turno);
  if (p.tipo === 'programma') { const a = p.esame?.programma?.argomenti?.find(x => x.id === p.argomento); return a && AI.attiva() ? avviaOraleProgramma(p.esame, [a], { max: 2 }) : schedaProgramma({ esame: p.esame }); }
  if (p.tipo === 'focus') return avviaFocus({ esameId: p.esame?.id });
  if (p.tipo === 'stelle') {
    const s = scheda('ld-elenco-stelle', `<span class="ld-lbl">${t('barra2.stelle-titolo', { esame: esc(p.esame?.nome || '') })}</span>${p.stelle.map(x => `<div class="ld-stella">${mdHtml(x.replace(/^\d\d:\d\d\s*/, ''))}</div>`).join('')}<div class="az"><button type="button" class="btn primary" data-g>${t('barra2.ora-un-gioco')}</button></div>`);
    s.querySelector('[data-g]').addEventListener('click', () => { nuovoTurno(); detto(A.turno, t('barra2.gioca')); schedaGioco(p.esame?.nome); });
    s.querySelectorAll('.ld-stella').forEach((x, i) => entra(x, { ritardo: 80 + i * 60, dy: 6, blur: 5, ms: 420 }));
  }
}
export async function provaAllenatore(forza = false) {
  const r = await AL.momento({ forza });
  if (r.proposta) mostraProposta(r.proposta);
  return r.proposta ? r.proposta.tipo + ': ' + r.proposta.testo : r.no;
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

/* ---------- la tua AI: la chiave del servizio che preferisci (facoltativa, a consumo) ---------- */
function schedaAI(preferito) {
  const st = AI.statoAI(), F = AI.FORNITORI, loc = !!st.locale;
  const s = scheda('ld-tuaai', `<span class="ld-lbl">${t('barra2.la-tua-ai')}</span>
    <p class="ld-nota" style="margin-top:6px">${loc ? t('barra2.ai-locale-attivo') : t('barra2.ai-locale-da-installare')} ${t('barra2.ai-chiave-spiegazione')}</p>
    <div class="ld-opzioni">${Object.entries(F).map(([k, f]) => `<button type="button" class="ld-op${st.fornitore === k ? ' primo' : ''}" data-f="${k}"><b>${st.fornitore === k ? t('barra2.ai-nome-collegata', { nome: esc(f.nome) }) : esc(f.nome)}</b><span>${esc(f.ditta)} · ${esc(f.nota)}</span></button>`).join('')}</div>
    <div class="ld-ai-chiave" hidden><span class="ld-lbl"></span><div class="ld-riga-form"><input type="password" autocomplete="off" spellcheck="false" aria-label="${t('barra2.chiave-api')}"><button type="button" class="btn small primary" data-collega>${t('barra2.collega')}</button></div><small class="ld-tenue"></small></div>
    <div class="ld-ai-modello" ${st.fornitore && st.fornitore !== 'anthropic' ? '' : 'hidden'}><span class="ld-lbl">${t('barra2.modello')}</span><div class="ld-riga-form"><select aria-label="${t('barra2.modello')}">${st.modello ? `<option>${esc(st.modello)}</option>` : ''}</select></div></div>
    ${loc ? `<label class="ld-spunta-ai"><input type="checkbox" data-uso${st.uso === 'pesante' ? ' checked' : ''}> ${t('barra2.ai-solo-spiegazioni')}</label>` : ''}
    ${st.fornitore ? `<div class="az"><button type="button" class="btn small ld-piano" data-scollega>${t('barra2.usa-solo-locale')}</button></div>` : ''}`);
  const box = s.querySelector('.ld-ai-chiave'), inp = box.querySelector('input'), nota = box.querySelector('small');
  let scelto = null;
  const scegli = k => {
    scelto = k; const f = F[k];
    s.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('scelta', b.dataset.f === k));
    box.hidden = false; box.querySelector('.ld-lbl').textContent = t('barra2.chiave-di', { nome: f.nome });
    inp.placeholder = f.segnaposto || t('barra2.incolla-chiave'); inp.value = AI.chiaveSalvata(k) || '';
    nota.innerHTML = t('barra2.si-crea-su', { sito: esc(f.sito) });
    entra(box, { dy: 6, blur: 5, ms: 360 }); requestAnimationFrame(() => inp.focus({ preventScroll: true }));
  };
  s.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => scegli(b.dataset.f)));
  const collega = async () => {
    const chiave = inp.value.trim(); if (!scelto || !chiave) return;
    const b = box.querySelector('[data-collega]'); b.disabled = true; nota.textContent = t('barra2.provo-chiave');
    try {
      const r = await AI.provaFornitore(scelto, chiave);
      AI.collegaFornitore(scelto, chiave, r.modello); salva();
      const sel = s.querySelector('.ld-ai-modello select'), mod = s.querySelector('.ld-ai-modello');
      if (scelto !== 'anthropic' && r.modelli.length) { sel.innerHTML = r.modelli.map(m => `<option${m === r.modello ? ' selected' : ''}>${esc(m)}</option>`).join(''); mod.hidden = false; }
      else mod.hidden = true;
      s.querySelectorAll('[data-f]').forEach(x => { x.classList.toggle('primo', x.dataset.f === scelto); x.querySelector('b').textContent = x.dataset.f === scelto ? t('barra2.ai-nome-collegata', { nome: F[x.dataset.f].nome }) : F[x.dataset.f].nome; });
      nota.textContent = ''; box.hidden = true; segnala('fatto'); aggiornaTutto();
      await mostraFatto({ testo: t('barra2.ai-collegata', { nome: F[scelto].nome }), nota: `${r.modello ? t('barra2.ai-modello', { modello: r.modello }) + ' ' : ''}${AI.statoAI().uso === 'pesante' ? t('barra2.ai-appunti-restano') : t('barra2.ai-usano-tua')}`, sintesi: t('barra2.sintesi-ai-collegata') }, s);
    } catch (e) { nota.textContent = e.status === 401 || e.status === 403 ? t('barra2.chiave-non-valida') : /fetch|network/i.test(e.message) ? t('barra2.servizio-irraggiungibile') : t('barra2.non-andata', { errore: e.message }); }
    finally { b.disabled = false; }
  };
  box.querySelector('[data-collega]').addEventListener('click', collega);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); collega(); } });
  s.querySelector('.ld-ai-modello select')?.addEventListener('change', e => { AI.collegaFornitore(AI.fornitore(), D.imp.chiave, e.target.value); salva(); });
  s.querySelector('[data-uso]')?.addEventListener('change', e => { AI.impostaUso(e.target.checked ? 'pesante' : 'tutto'); salva(); });
  s.querySelector('[data-scollega]')?.addEventListener('click', async e => {
    const f = F[AI.scollegaFornitore()]; salva(); aggiornaTutto(); e.target.disabled = true;
    await mostraFatto({ testo: t('barra2.solo-locale-fatto'), nota: f ? (f.sito ? t('barra2.ai-scollegata-sito', { nome: f.nome, sito: f.sito }) : t('barra2.ai-scollegata-nome', { nome: f.nome })) : t('barra2.ai-scollegata') }, s);
  });
  if (preferito && F[preferito]) scegli(preferito);
  s.querySelectorAll('.ld-op').forEach((b, i) => entra(b, { ritardo: 60 + i * 40, dy: 6, blur: 5, ms: 400 }));
  if (A.turno) A.turno.dataset.sintesi = t('barra2.sintesi-la-tua-ai');
}

/* ---------- preparare il computer: Obsidian e il cervello locale ---------- */
let STATO = null;
// le versioni nuove di Lode (desktop/aggiorna.mjs). AGG è lo stato che manda il main: { attivi, possibile, modo, fase, versione, nuova, p }.
// La barra chiede solo azioni (riavvia, scarica, accendi/spegni): cosa scaricare e da dove lo decide il main, da GitHub
let AGG = null;
const azioneAgg = async canale => { const r = await BRIDGE.invoca(canale).catch(e => ({ errore: e.message })); if (r?.errore) rispostaFissa(r.errore, { errore: true }); };
function rigaAggiornamento() {
  if (!AGG?.nuova || !AGG.attivi) return null;   // spenti: niente righe (la versione nuova è su GitHub)
  // errore con 'pronta': «Riavvia ora» non ha installato (aggiorna.mjs, nonEsce); resta pronta e si installa all'uscita
  if (AGG.fase === 'pronta') return { cls: 'info', t: t('barra2.agg-pronta', { versione: AGG.nuova.versione }), d: AGG.errore || t('barra2.agg-si-installa'), n: '', b: t('barra2.riavvia-ora'), f: () => azioneAgg('aggiorna:riavvia') };
  if (AGG.fase === 'da_scaricare') return { cls: 'info', t: t('barra2.agg-uscita', { versione: AGG.nuova.versione }), d: MAC ? t('barra2.agg-scarica-dmg') : t('barra2.agg-scarica-github'), n: '', b: t('barra2.scarica'), f: () => azioneAgg('aggiorna:scarica') };
  return null;
}
function testoAggiornamenti() {
  const v = AGG.nuova?.versione;
  if (!AGG.attivi) return t('barra2.agg-spenti', { versione: AGG.versione });
  if (AGG.fase === 'scarico' && v) return t('barra2.agg-scarico', { versione: v, p: Math.round((AGG.p || 0) * 100) });
  if (AGG.fase === 'pronta' && v) return t('barra2.agg-pronta-riga', { versione: v });
  if (AGG.fase === 'da_scaricare' && v) return MAC ? t('barra2.agg-uscita-mac', { versione: v }) : t('barra2.agg-uscita-github', { versione: v });
  return AGG.modo === 'manuale' ? t('barra2.agg-manuale', { versione: AGG.versione }) : t('barra2.agg-automatici', { versione: AGG.versione });
}
// la riga «Aggiornamenti» di «Prepara Lode», aggiornata sul posto: testo, avanzamento del download e bottoni
function mostraAggiornamenti(s) {
  const r = s?.querySelector('.ld-prep[data-k="aggiorna"]'); if (!r || !AGG) return;
  r.classList.toggle('ok', !!AGG.attivi); r.classList.toggle('va', AGG.attivi && AGG.fase === 'scarico');
  r.querySelector('.d').textContent = testoAggiornamenti();
  r.querySelector('.ld-prog i').style.transform = `scaleX(${(AGG.p || 0).toFixed(3)})`;
  const az = r.querySelector('.ld-agg-az'), ora = rigaAggiornamento();
  az.innerHTML = `${ora ? `<button type="button" class="btn small primary" data-agg-ora>${ora.b}</button>` : ''}<button type="button" class="btn small" data-agg-interruttore>${AGG.attivi ? t('barra2.spegni') : t('barra2.accendi')}</button>`;
  az.querySelector('[data-agg-ora]')?.addEventListener('click', () => ora.f());
  az.querySelector('[data-agg-interruttore]').addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    const x = await BRIDGE.invoca('aggiorna:imposta', { attivi: !AGG.attivi }).catch(() => null);
    if (x && !x.errore) AGG = x;
    mostraAggiornamenti(s);
  });
}
async function aggiornaStato() { if (!V.attivo) return; try { STATO = await V.stato(); AI.impostaLocale(STATO.modello); } catch { } if (A?.aperto && A.home) disegnaHome(); }
const avanzamenti = {};
function schedaPrepara(cosa) {
  if (!V.attivo) return rispostaFissa(t('barra2.prep-solo-app'));
  const st = STATO, m = st?.consigliato;
  const riga = (k, titolo, pronto, dett, b) => `<div class="ld-prep${pronto ? ' ok' : ''}" data-k="${k}"><i class="ld-seg"></i><div class="t"><b>${titolo}</b><span class="d">${dett}</span><i class="ld-prog"><i></i></i></div>${b}</div>`;
  const s = scheda('ld-prepara', `<span class="ld-lbl">${t('barra2.prepara-lode')}</span>
    ${riga('vault', t('barra2.il-tuo-vault'), true, t('barra2.prep-vault-dett', { percorso: esc(V.info?.percorso || 'Documenti/Lode') }), `<button type="button" class="btn small" data-apri>${t('barra2.apri')}</button>`)}
    ${riga('obsidian', 'Obsidian', st?.obsidian.installato, st?.obsidian.installato ? t('barra2.obs-installato') : t('barra2.obs-da-installare'), st?.obsidian.installato ? `<button type="button" class="btn small" data-apri>${t('barra2.apri')}</button>` : `<button type="button" class="btn small primary" data-installa="obsidian">${t('barra2.installa')}</button>`)}
    ${riga('cervello', t('barra2.cervello-locale'), !!st?.modello, st?.modello ? t('barra2.cervello-pronto-dett', { modello: esc(st.modello) }) : t('barra2.cervello-da-installare', { etichetta: esc(m?.etichetta || 'Qwen3.5'), perche: esc(m?.perche || ''), gb: m ? String(m.gb + 0.2).replace('.', ',') : '3,5' }), st?.modello ? `<span class="ld-spunta">${t('barra2.pronto')}</span>` : `<button type="button" class="btn small primary" data-installa="cervello">${t('barra2.installa')}</button>`)}
    ${riga('voce', t('barra2.voce'), Voce.pronta(), Voce.pronta() ? t('barra2.voce-pronta-dett', { voce: Voce.NOME_VOCE, tasti: TASTI }) : t('barra2.voce-da-preparare', { descrizione: Voce.descrizioneVoce(), peso: Voce.PESO_VOCE }), Voce.pronta() ? `<span class="ld-spunta">${t('barra2.pronta')}</span>` : `<button type="button" class="btn small primary" data-voce>${t('barra2.prepara')}</button>`)}
    ${riga('tuaai', `${t('barra2.la-tua-ai')} <small>${t('barra2.facoltativa')}</small>`, !!AI.fornitore(), AI.fornitore() ? t('barra2.tua-ai-collegata-dett', { nome: esc(AI.FORNITORI[AI.fornitore()].nome) }) : t('barra2.tua-ai-da-collegare'), `<button type="button" class="btn small" data-tuaai>${AI.fornitore() ? t('barra2.cambia') : t('barra2.collega')}</button>`)}
    ${BRIDGE ? riga('sync', `${t('barra2.sincronizza-computer')} <small>${t('barra2.sperimentale')}</small>`, !!SYNC?.acceso && !!SYNC.cloud && !syncBloccata(), esc(TS.rigaStato(SYNC)), `<button type="button" class="btn small" data-sync>${syncBloccata() ? t('barra2.sblocca') : SYNC?.acceso && SYNC.cloud ? t('barra2.gestisci') : t('barra2.attiva')}</button>`) : ''}
    ${BRIDGE && !(SYNC?.acceso && SYNC.cloud) ? riga('collega', t('barra2.uso-gia-altrove'), false, t('barra2.collega-dett'), `<button type="button" class="btn small" data-collega>${t('barra2.collega')}</button>`) : ''}
    ${AGG?.possibile ? riga('aggiorna', t('barra2.aggiornamenti'), AGG.attivi, esc(testoAggiornamenti()), '<span class="ld-agg-az" style="display:flex;gap:6px"></span>') : ''}
    <p class="ld-nota">${t('barra2.prep-nota')}</p>`);
  s.querySelector('[data-tuaai]')?.addEventListener('click', () => { nuovoTurno(); detto(A.turno, t('barra2.detto-mia-ai')); schedaAI(); });
  s.querySelector('[data-sync]')?.addEventListener('click', () => { nuovoTurno(); detto(A.turno, t('barra2.detto-sincronizza')); schedaSincronizza(syncBloccata() ? 'sblocca' : null); });
  s.querySelector('[data-collega]')?.addEventListener('click', () => { nuovoTurno(); detto(A.turno, t('barra2.uso-gia-altrove')); schedaSincronizza('collega'); });
  mostraAggiornamenti(s);
  s.querySelectorAll('[data-apri]').forEach(b => b.addEventListener('click', () => apriAppunti({ file: 'Home.md', corso: 'Home' })));
  s.querySelectorAll('[data-installa]').forEach(b => b.addEventListener('click', () => chiediInstalla(b.dataset.installa, s)));
  s.querySelector('[data-voce]')?.addEventListener('click', () => { mostraAvanzamento(s, 'voce', { testo: t('barra2.scarico-voce', { voce: Voce.NOME_VOCE }), p: 0 }); Voce.prepara().then(() => { try { localStorage.setItem('lode:voce', '1'); } catch { } }).catch(() => { }); });
  if (cosa && !(cosa === 'obsidian' ? st?.obsidian.installato : st?.modello)) chiediInstalla(cosa, s);
  for (const [k, x] of Object.entries(avanzamenti)) mostraAvanzamento(s, k, x);
  if (A.turno) A.turno.dataset.sintesi = t('barra2.sintesi-prepara');
}
async function chiediInstalla(cosa, s) {
  const m = STATO?.consigliato;
  const card = schedaConferma(cosa === 'obsidian'
    ? { titolo: t('barra2.installare-obsidian'), righe: [[t('barra2.da'), t('barra2.github-obsidian')], [t('barra2.peso'), t('barra2.circa-230-mb')], [t('barra2.dove'), STATO?.piattaforma === 'darwin' ? t('barra2.applicazioni') : t('barra2.il-tuo-utente')]], nota: t('barra2.obs-nota'), fuoco: false }
    : { titolo: m?.etichetta ? t('barra2.installare-nome', { nome: m.etichetta }) : t('barra2.installare-cervello'), righe: [[t('barra2.cosa'), t('barra2.ollama-motore', { nome: m?.nome || 'qwen3.5' })], [t('barra2.peso'), t('barra2.circa-gb', { gb: m ? String(m.gb + 0.2).replace('.', ',') : '3,5' })], [t('barra2.perche'), m?.perche || '']], nota: t('barra2.cervello-nota'), fuoco: false });
  card.dataset.soloClic = '1'; card.querySelector('.az small').textContent = t('barra2.solo-clic');
  await attendiDecisione(card, async () => {
    await mostraFatto({ testo: t('barra2.avviato'), nota: t('barra2.continuo-da-solo') }, card);
    const r = await V.installa(cosa);
    await aggiornaStato();
    if (r.esito === 'ok') { segnala('confermato'); mostraAvviso(cosa === 'obsidian' ? t('barra2.obsidian-pronto') : t('barra2.cervello-pronto')); }
    else if (r.esito === 'errore') rispostaFissa(t('barra2.non-andata', { errore: r.errore }), { errore: true });
    return r;
  });
}
function mostraAvanzamento(s, cosa, x) {
  const r = s?.querySelector(`.ld-prep[data-k="${cosa}"]`); if (!r) return;
  r.classList.add('va'); r.querySelector('.d').textContent = x.testo || '';
  r.querySelector('.ld-prog i').style.transform = `scaleX(${(x.p ?? 0).toFixed(3)})`;
  if (x.fase === 'fatto') { r.classList.remove('va'); r.classList.add('ok'); r.querySelector('.btn.primary')?.replaceWith(h('span', 'ld-spunta', t('barra2.pronto'))); }
  if (x.fase === 'errore') r.classList.remove('va');
}

/* ---------- sincronizzare fra i computer dello studente (desktop/sincronizza.mjs, docs/SINCRONIZZAZIONE.md) ---------- */
// Niente server di Lode: il vault va nella cartella cloud che lo studente usa già. La barra mostra lo stato e chiede; le
// cartelle e i percorsi li conosce solo il main (qui solo indici). I testi stanno in js/sync-testi.js
let SYNC = null;
async function aggiornaSync() { if (!BRIDGE) return null; try { SYNC = await BRIDGE.invoca('sync:stato'); } catch { } piedeSync(); return SYNC; }
const syncBloccata = () => !!SYNC?.acceso && ['password', 'rigenerato'].includes(SYNC.stato);
// il piede della barra: con la sincronizzazione accesa i dati non restano solo su questo computer, e lo si dice
function piedeSync() {
  const t = document.querySelector('.ld-piede-dati > span'); if (!t) return;
  t.textContent = SYNC?.acceso && SYNC.cloud ? (SYNC.cifrato ? tn('barra2.sync-piede-cifrati', { servizio: SYNC.servizio || tn('barra2.la-tua-cartella-cloud') }) : tn('barra2.sync-piede', { servizio: SYNC.servizio || tn('barra2.la-tua-cartella-cloud') })) : tn('barra2.dati-restano-qui');
}
const listaChiaro = () => `<ul class="ld-sync-lista">${TS.IN_CHIARO.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
const testoPortachiavi = () => SYNC?.portachiavi ? (BRIDGE?.piattaforma === 'darwin' ? t('barra2.portachiavi-mac') : BRIDGE?.piattaforma === 'win32' ? t('barra2.portachiavi-windows') : t('barra2.portachiavi-sistema'))
  : t('barra2.senza-portachiavi');
async function schedaSincronizza(cosa) {
  if (!BRIDGE) return rispostaFissa(t('barra2.sync-solo-app'));
  await aggiornaSync();
  if (!SYNC) return rispostaFissa(t('barra2.sync-stato-illeggibile'), { errore: true });
  if (SYNC.acceso && SYNC.cloud && cosa === 'altro') return rispostaFissa(t('barra2.sync-altro-computer', { vault: SYNC.vault || 'Lode', servizio: SYNC.servizio || t('barra2.la-cartella-cloud') }));
  if (SYNC.acceso && SYNC.cloud) return schedaSyncAccesa(cosa);
  if (cosa === 'altro') cosa = 'collega';
  if (cosa === 'smetti' || cosa === 'sblocca' || cosa === 'password') return rispostaFissa(t('barra2.sync-non-accesa'));
  const { cartelle = [], vault = [] } = await BRIDGE.invoca('sync:cartelle').catch(() => ({}));
  const altro = cosa === 'collega';
  const s = scheda('ld-sync', `<span class="ld-lbl">${altro ? t('barra2.sync-titolo-altro') : t('barra2.sync-titolo')}</span>
    <p class="ld-nota">${t('barra2.sync-sperimentale', { testo: esc(TS.SPERIMENTALE) })}</p>
    ${altro ? '' : `<p class="ld-nota">${t('barra2.sync-cartella-cloud', { prima: esc(TS.PRIMA) })}</p>
    ${SYNC.spostamento ? `<p class="ld-nota">${t('barra2.sync-interrotto', { servizio: esc(SYNC.spostamento.servizio || t('barra2.cartella-cloud')) })}${SYNC.spostamento.cifrata ? ' ' + t('barra2.sync-interrotto-pw') : ''}</p>` : ''}
    <div class="ld-opzioni">${cartelle.map(c => `<button type="button" class="ld-op" data-cloud="${c.i}"><b>${esc(c.servizio)}</b><span>${c.qui ? t('barra2.vault-gia-qui') : esc(c.nome)}</span></button>`).join('')}
      <button type="button" class="ld-op" data-cloud="altra"><b>${t('barra2.altra-cartella')}</b><span>${t('barra2.altra-cartella-dett')}</span></button></div>
    ${cartelle.length ? '' : `<p class="ld-nota">${t('barra2.nessuna-cartella-cloud')}</p>`}`}
    <span class="ld-lbl" style="margin-top:14px;display:block">${altro ? t('barra2.scegli-vault-cloud') : t('barra2.uso-gia-altrove')}</span>
    <div class="ld-opzioni">${vault.map(v => `<button type="button" class="ld-op" data-vault="${v.i}"><b>${esc(v.nome)}</b><span>${t('barra2.gia-sincronizzato', { servizio: esc(v.servizio) })}</span></button>`).join('')}
      <button type="button" class="ld-op" data-vault="altro"><b>${t('barra2.scegli-vault')}</b><span>${t('barra2.scegli-vault-dett')}</span></button></div>
    <p class="ld-nota">${t('barra2.vault-resta')}${altro ? ' ' + t('barra2.vault-resta-altro') : ''}</p>`);
  s.querySelectorAll('[data-cloud]').forEach(b => b.addEventListener('click', () => {
    const c = cartelle.find(x => String(x.i) === b.dataset.cloud);
    chiediSincronizza(c ? { i: c.i } : { scegli: true }, c?.servizio || t('barra2.la-cartella-che-scegli'), c?.qui);
  }));
  s.querySelectorAll('[data-vault]').forEach(b => b.addEventListener('click', () => collegaAltro(b.dataset.vault === 'altro' ? { scegli: true } : { i: +b.dataset.vault })));
  s.querySelectorAll('.ld-op').forEach((b, i) => entra(b, { ritardo: 60 + i * 40, dy: 6, blur: 5, ms: 400 }));
  if (A.turno) A.turno.dataset.sintesi = altro ? t('barra2.sintesi-uso-gia-altrove') : t('barra2.sintesi-sincronizza');
}
// la scelta della cifratura, una volta sola all'accensione (§10.1): il gruppo nasce cifrato o in chiaro e non cambia più modo
async function chiediSincronizza(dove, servizio, giaDentro) {
  const card = schedaConferma({ titolo: t('barra2.sincronizzare-con', { servizio }), righe: [[t('barra2.vault'), giaDentro ? t('barra2.vault-resta-cloud') : t('barra2.cartella-lode-in', { servizio })], [t('barra2.prima'), giaDentro ? t('barra2.dati-json-cronologia') : t('barra2.vault-adesso-resta')], [t('barra2.dati-di-lode'), t('barra2.un-diario-per-computer')]],
    extra: `<div class="ld-sync-pw"><label class="ld-spunta-ai"><input type="checkbox" data-conpw> ${t('barra2.proteggi-con-password')}</label>
      <div class="ld-sync-pwbox" hidden><div class="ld-riga-form"><input type="password" autocomplete="new-password" placeholder="${t('barra2.password-almeno-8')}" aria-label="${t('barra2.password')}" data-pw><input type="password" autocomplete="new-password" placeholder="${t('barra2.ripetila')}" aria-label="${t('barra2.ripeti-password')}" data-pw2></div>
      <p class="ld-nota">${t('barra2.cifrati-in-chiaro-anche', { cifrati: esc(TS.CIFRATI) })}</p>${listaChiaro()}
      <p class="ld-nota">${esc(TS.SUL_COMPUTER)} ${giaDentro ? esc(TS.CRONOLOGIA) + ' ' : ''}${esc(TS.DIMENTICATA)} ${esc(testoPortachiavi())}</p></div><small class="ld-tenue" data-msg></small></div>`,
    nota: t('barra2.sync-nota-password', { prima: TS.PRIMA }), fuoco: false });
  card.dataset.soloClic = '1'; card.querySelector('.az small').textContent = t('barra2.solo-clic');
  const box = card.querySelector('.ld-sync-pwbox'), msg = t => { card.querySelector('[data-msg]').textContent = t; };
  card.querySelector('[data-conpw]').addEventListener('change', e => { box.hidden = !e.target.checked; if (e.target.checked) card.querySelector('[data-pw]').focus(); });
  // uno spostamento interrotto che era cominciato con la password si riprende solo con la password (il main lo rifiuta senza)
  if (SYNC?.spostamento?.cifrata && !giaDentro) { const c = card.querySelector('[data-conpw]'); c.checked = true; c.disabled = true; box.hidden = false; msg(t('barra2.spostamento-con-password')); }
  // una password che non va: si dice e la scheda aspetta di nuovo la conferma (attendiDecisione si riarma)
  const esegui = async () => {
    let password = null;
    if (card.querySelector('[data-conpw]').checked) {
      password = card.querySelector('[data-pw]').value;
      if (password.length < 8) { msg(t('barra2.almeno-8')); return attendiDecisione(card, esegui); }
      if (password !== card.querySelector('[data-pw2]').value) { msg(t('barra2.password-diverse')); return attendiDecisione(card, esegui); }
    }
    card.querySelectorAll('input[type=password]').forEach(i => { i.value = ''; });
    const p = h('p', 'ld-nota ld-sync-avanza', t('barra2.preparo')); card.append(p);
    const r = await BRIDGE.invoca('sync:attiva', { ...dove, password }).catch(e => ({ esito: 'errore', errore: e.message }));
    await aggiornaSync();
    if (r.esito === 'ok') await mostraFatto({ testo: t('barra2.sincronizzato-con', { servizio: r.servizio }), nota: r.giaDentro ? t('barra2.vault-era-gia-cloud') : t('barra2.cartella-prima-resta', { da: r.da }) }, card);
    else if (r.esito === 'esiste') await mostraFatto({ testo: t('barra2.vault-gia-in-servizio', { servizio: r.servizio }), nota: t('barra2.usa-uso-gia'), no: true }, card);
    else if (r.esito === 'annullato') await mostraFatto({ testo: t('barra2.annullato'), nota: t('barra2.niente-cambiato'), no: true }, card);
    // la password che serve (spostamento cominciato con la password, o un gruppo già cifrato nel vault): si chiede di nuovo qui
    else if (r.esito === 'password' || r.esito === 'sbagliata') { const c = card.querySelector('[data-conpw]'); c.checked = true; box.hidden = false; p.remove(); msg(r.errore || t('barra2.scrivi-password')); return attendiDecisione(card, esegui); }
    else if (r.esito === 'aspetta') await mostraFatto({ testo: t('barra2.non-ancora'), nota: r.errore, no: true }, card);
    else rispostaFissa(/intatto/.test(r.errore || '') ? t('barra2.non-andata', { errore: r.errore || r.esito }) : t('barra2.non-andata-vault-intatto', { errore: r.errore || r.esito }), { errore: true });
    return r;
  };
  await attendiDecisione(card, esegui);
}
async function collegaAltro(dove) {
  const r = await BRIDGE.invoca('sync:collega', dove).catch(e => ({ esito: 'errore', errore: e.message }));
  await aggiornaSync();
  if (r.esito === 'ok') return mostraFatto({ testo: t('barra2.collegato-vault-in', { servizio: r.servizio }), nota: [r.avviso, r.stato === 'password' ? t('barra2.dati-protetti-password') : t('barra2.ricevo-dati'),
    r.importati ? t('barra2.dati-importati-altrove', { n: r.importati, vault: r.vaultPrima }) : ''].filter(Boolean).join(' ') });
  if (r.esito !== 'annullato') rispostaFissa(r.errore || t('barra2.cartella-inusabile'), { errore: true });
}
function schedaSyncAccesa(cosa) {
  // fermo (il diario non si legge): solo la frase e «Riprova». Prima i rami della password guardavano uno stato vuoto e dicevano
  // «Senza password…» con [Proteggi con una password] anche per un gruppo cifrato (giro 3)
  if (SYNC.fermo) {
    const f = scheda('ld-sync', `<span class="ld-lbl">${t('barra2.sincronizza-computer')}</span><p class="ld-sync-stato"><b>${t('barra2.diario-illeggibile')}</b></p>
      <p class="ld-nota">${t('barra2.diario-illeggibile-nota')}</p><div class="ld-riga-form"><button type="button" class="btn small primary" data-riprova>${t('barra2.riprova')}</button></div>`);
    f.querySelector('[data-riprova]')?.addEventListener('click', () => location.reload());
    return f;
  }
  const st = SYNC, bloccata = syncBloccata(), avvisi = (st.avvisi || []).filter(a => TS.AVVISI[a] && !(a === 'altra_password' && st.stato === 'rigenerato') && !(a === 'scrittura' && st.stato === 'scrittura'));
  const s = scheda('ld-sync', `<span class="ld-lbl">${t('barra2.sincronizza-computer')}</span>
    <p class="ld-sync-stato"><b>${esc(TS.rigaStato(st))}</b></p>
    ${avvisi.map(a => `<p class="ld-nota">${esc(TS.AVVISI[a])}</p>`).join('')}
    ${st.stato === 'sparito' ? `<p class="ld-nota">${t('barra2.vault-sparito')}</p><div class="ld-riga-form"><button type="button" class="btn small primary" data-trova>${t('barra2.trova-vault')}</button></div>` : ''}
    ${st.vecchiaDiversi ? `<p class="ld-nota">${t('barra2.lode-vecchia-campi', { n: st.vecchiaDiversi })}</p>` : ''}
    ${st.aggiunte ? `<p class="ld-nota">${t('barra2.aggiunte', { n: st.aggiunte })}</p><div class="ld-riga-form"><button type="button" class="btn small" data-aggiunte>${t('barra2.importa-aggiunte')}</button></div>` : ''}
    ${bloccata || cosa === 'sblocca' && st.cifrato ? `<div class="ld-sync-pw"><span class="ld-lbl">${t('barra2.password-dati-lode')}</span><div class="ld-riga-form"><input type="password" autocomplete="current-password" aria-label="${t('barra2.password')}" data-pw><button type="button" class="btn small primary" data-sblocca>${t('barra2.sblocca')}</button></div>
      <p class="ld-nota">${t('barra2.intanto-funziona', { portachiavi: esc(testoPortachiavi()) })}</p><small class="ld-tenue" data-msg></small>
      <p class="ld-nota">${esc(TS.DIMENTICATA)}</p><button type="button" class="btn small" data-dimenticata>${t('barra2.ho-dimenticato-password')}</button>${st.ricordate ? ` <button type="button" class="btn small" data-dimentica>${t('barra2.dimentica-password-qui')}</button>` : ''}</div>`
    : st.cifrato ? `<p class="ld-nota">${t('barra2.cifrati-in-chiaro', { cifrati: esc(TS.CIFRATI) })}</p>${listaChiaro()}<p class="ld-nota">${esc(TS.SUL_COMPUTER)}</p>
      <div class="ld-riga-form"><button type="button" class="btn small" data-cambia>${t('barra2.cambia-password')}</button>${st.chiave || st.ricordate ? `<button type="button" class="btn small" data-dimentica>${t('barra2.dimentica-password-qui')}</button>` : ''}</div>`
    : `<p class="ld-nota">${t('barra2.senza-password')}</p>
      <div class="ld-riga-form"><button type="button" class="btn small" data-proteggi>${t('barra2.proteggi-password')}</button></div>`}
    ${st.recupero ? `<p class="ld-nota">${st.recuperi > 1 ? t('barra2.recuperi', { n: st.recuperi, file: esc(st.recupero) }) : t('barra2.recupero', { file: esc(st.recupero) })}</p>` : ''}
    <div class="ld-riga-form" style="margin-top:12px"><button type="button" class="btn small" data-smetti>${t('barra2.smetti-qui')}</button></div><small class="ld-tenue" data-msg2></small>`);
  const msg = t => { const m = s.querySelector('[data-msg]') || s.querySelector('[data-msg2]'); if (m) m.textContent = t; };
  s.querySelector('[data-trova]')?.addEventListener('click', () => collegaAltro({ scegli: true }));
  s.querySelector('[data-aggiunte]')?.addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    const r = await BRIDGE.invoca('sync:importaAggiunte').catch(x => ({ esito: 'errore', errore: x.message }));
    await aggiornaSync(); aggiornaTutto();
    if (r.esito === 'ok') mostraFatto({ testo: t('barra2.importati-record', { n: r.importati }), nota: t('barra2.ora-su-tutti') }, s);
    else msg(r.errore || t('barra2.non-andata-punto'));
  });
  s.querySelector('[data-sblocca]')?.addEventListener('click', async e => {
    const b = e.currentTarget, pw = s.querySelector('[data-pw]').value; if (!pw) return msg(t('barra2.scrivi-password'));
    b.disabled = true; msg(t('barra2.controllo'));
    const r = await BRIDGE.invoca('sync:sblocca', { password: pw }).catch(x => ({ esito: 'errore', errore: x.message }));
    s.querySelector('[data-pw]').value = ''; b.disabled = false;
    if (r.esito !== 'ok') return msg(r.errore || t('barra2.non-andata-punto'));
    await aggiornaSync(); aggiornaTutto();
    mostraFatto({ testo: t('barra2.sbloccata'), nota: r.ricordata ? t('barra2.password-ricordata') : t('barra2.chiedero-prossimo-avvio') }, s);
  });
  s.querySelector('[data-pw]')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); s.querySelector('[data-sblocca]')?.click(); } });
  const nuovaPassword = (titolo, nota) => {
    const card = schedaConferma({ titolo, extra: `<div class="ld-riga-form"><input type="password" autocomplete="new-password" placeholder="${t('barra2.password-nuova-almeno-8')}" aria-label="${t('barra2.password-nuova')}" data-pw><input type="password" autocomplete="new-password" placeholder="${t('barra2.ripetila')}" aria-label="${t('barra2.ripeti-password')}" data-pw2></div><small class="ld-tenue" data-msg></small>`, nota, fuoco: false });
    card.dataset.soloClic = '1'; card.querySelector('.az small').textContent = t('barra2.solo-clic');
    const esegui = async () => {
      const pw = card.querySelector('[data-pw]').value, m = t => { card.querySelector('[data-msg]').textContent = t; };
      if (pw.length < 8) { m(t('barra2.almeno-8')); return attendiDecisione(card, esegui); }
      if (pw !== card.querySelector('[data-pw2]').value) { m(t('barra2.password-diverse')); return attendiDecisione(card, esegui); }
      card.querySelectorAll('input[type=password]').forEach(i => { i.value = ''; });
      const r = await BRIDGE.invoca('sync:cifra', { password: pw }).catch(x => ({ esito: 'errore', errore: x.message }));
      await aggiornaSync(); aggiornaTutto();
      if (r.esito === 'ok') await mostraFatto({ testo: t('barra2.password-nuova-pronta'), nota: t('barra2.altri-chiederanno') }, card);
      else rispostaFissa(r.errore || t('barra2.non-andata-punto'), { errore: true });
      return r;
    };
    return attendiDecisione(card, esegui);
  };
  s.querySelector('[data-cambia]')?.addEventListener('click', () => nuovaPassword(t('barra2.cambiare-password'), t('barra2.rifa-password-nuova', { testo: TS.NUOVA_PASSWORD })));
  s.querySelector('[data-dimenticata]')?.addEventListener('click', () => nuovaPassword(t('barra2.scegliere-password-nuova'), TS.NUOVA_PASSWORD));
  // §10.4 «proteggo dopo»: il main (sync:cifra) e il motore (cifra() da in_pari) lo sapevano già fare, mancava il bottone
  s.querySelector('[data-proteggi]')?.addEventListener('click', () => nuovaPassword(t('barra2.proteggere-password'), t('barra2.rifa-cifrati', { testo: TS.CRONOLOGIA })));
  s.querySelector('[data-dimentica]')?.addEventListener('click', async e => { e.currentTarget.disabled = true; await BRIDGE.invoca('sync:dimentica'); await aggiornaSync(); mostraFatto({ testo: t('barra2.password-dimenticata'), nota: t('barra2.chiedero-di-nuovo') }, s); });
  s.querySelector('[data-smetti]')?.addEventListener('click', () => chiediSmetti());
  if (cosa === 'smetti') chiediSmetti();
  if (bloccata || cosa === 'sblocca') requestAnimationFrame(() => s.querySelector('[data-pw]')?.focus({ preventScroll: true }));
  if (A.turno) A.turno.dataset.sintesi = 'sincronizza';
}
// «Smetti su questo computer» (§11): non esiste un segnale che spegne tutto per tutti
async function chiediSmetti() {
  const card = schedaConferma({ titolo: t('barra2.smettere-qui'), righe: [[t('barra2.vault'), t('barra2.vault-copiato-fuori')], [t('barra2.dati-di-lode'), t('barra2.tutti-dati')], [t('barra2.gli-altri-computer'), t('barra2.continuano-sincronizzarsi')]],
    nota: TS.SMETTI(SYNC?.servizio), fuoco: false });
  card.dataset.soloClic = '1'; card.querySelector('.az small').textContent = t('barra2.solo-clic');
  await attendiDecisione(card, async () => {
    const r = await BRIDGE.invoca('sync:smetti').catch(e => ({ esito: 'errore', errore: e.message }));
    await aggiornaSync(); aggiornaTutto();
    if (r.esito === 'ok') await mostraFatto({ testo: t('barra2.smesso-qui'), nota: t('barra2.smesso-nota'), sintesi: t('barra2.sintesi-smessa') }, card);
    else if (r.esito === 'annullato') await mostraFatto({ testo: t('barra2.annullato'), nota: t('barra2.niente-cambiato'), no: true }, card);
    else rispostaFissa(r.errore || t('barra2.non-andata-punto'), { errore: true });
    return r;
  });
}

/* ---------- navigare il vault ---------- */
async function schedaNote(q = '') {
  if (!V.attivo) return apriAppunti();
  const tutte = await V.note(), lo = V.lezioneDaAnnotare(), ultima = lezioni().find(l => l.file);
  const rapide = [['Home', 'Home.md'], [lo.corso === 'Appunti sparsi' ? (ultima ? t('barra2.ultima-lezione') : null) : t('barra2.lezione-di', { corso: lo.corso }), lo.corso === 'Appunti sparsi' ? ultima?.file : null], ['Orario', 'Orario.md'], ['Esami', 'Esami.md'], ['Glossario', 'Glossario.md'], [t('barra2.cosa-sa-lode'), 'Lode/Memoria.md']].filter(x => x[0]);
  const s = scheda('ld-note', `<span class="ld-lbl">${t('barra2.vai-a-note', { n: esc(tutte.length) })}</span>
    <div class="ld-rapide">${rapide.map(([t, f], i) => `<button type="button" class="ld-chip larga" data-r="${i}"><b>${esc(t)}</b><span>${esc(f ? f.replace(/\.md$/, '').split('/').slice(0, -1).join('/') || tn('barra2.radice-vault') : tn('barra2.oggi'))}</span></button>`).join('')}</div>
    <input class="ld-cerca-note" placeholder="${t('barra2.cerca-nota-segnaposto')}" aria-label="${t('barra2.cerca-nota')}" value="${esc(q)}"><div class="ld-risultati"></div>`);
  const apriR = i => { const [t, f] = rapide[i]; f ? apriAppunti({ file: f, corso: t }) : apriAppunti(lo); };
  s.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => apriR(+b.dataset.r)));
  const inp = s.querySelector('input'), box = s.querySelector('.ld-risultati');
  const filtra = () => {
    const w = norm(inp.value).split(' ').filter(Boolean);
    const ris = (w.length ? tutte.filter(n => w.every(x => norm(n.file).includes(x))) : tutte.filter(n => n.cartella === 'Lezioni').sort((a, b) => b.titolo.localeCompare(a.titolo))).slice(0, 7);
    box.innerHTML = ris.map((n, i) => `<button type="button" class="ld-nota-r${i === 0 ? ' su' : ''}" data-f="${esc(n.file)}"><b>${esc(n.titolo)}</b><span>${esc(n.file.split('/').slice(0, -1).join(' / ') || t('barra2.radice-vault'))}</span></button>`).join('') || `<p class="ld-nota">${t('barra2.nessuna-nota')}</p>`;
    box.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => apriAppunti({ file: b.dataset.f, corso: b.querySelector('b').textContent })));
  };
  inp.addEventListener('input', filtra);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); box.querySelector('[data-f]')?.click(); } });
  filtra();
  if (q && box.querySelectorAll('[data-f]').length === 1) box.querySelector('[data-f]').click();
  requestAnimationFrame(() => inp.focus({ preventScroll: true }));
  if (A.turno) A.turno.dataset.sintesi = q ? t('barra2.sintesi-cerco', { q }) : t('barra2.sintesi-note');
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
  if (!l) return rispostaFissa(corso ? t('barra2.niente-appunti-di', { corso }) : t('barra2.niente-appunti', { sezione: 'Appunti' }));
  if (!AI.attiva()) return rispostaFissa(t('barra2.appunti-serve-ai'));
  modo('pensa', t('barra2.leggo-appunti-di', { corso: l.corso })); segnala('pensa');
  let r; try { r = await AI.estraiLezione({ corso: l.corso, appunti: l.appunti, gia: (l.definizioni || []).map(d => d.t) }); }
  catch (e) { modo('riposo'); return rispostaFissa(t('barra2.appunti-illeggibili', { errore: e.message }), { errore: true }); }
  modo('riposo');
  if (!r.definizioni.length && !r.daEsame.length) return rispostaFissa(t('barra2.nessuna-definizione-nuova'));
  const card = schedaConferma({ titolo: t('barra2.aggiungere-a', { corso: l.corso, data: dataBreve(l.data) }),
    extra: `<ol class="ld-proposte">${r.definizioni.map(d => `<li><b>${esc(d.termine)}</b><span>${esc(d.definizione)}</span></li>`).join('')}${r.daEsame.map(x => `<li><b>★ ${esc(x)}</b></li>`).join('')}</ol>`,
    nota: r.daEsame.length ? t('barra2.chiudi-nota-stelle', { n: r.definizioni.length, stelle: r.daEsame.length, motore: AI.nomeMotore('testo') }) : t('barra2.chiudi-nota', { n: r.definizioni.length, motore: AI.nomeMotore('testo') }) });
  card.querySelectorAll('.ld-proposte li').forEach((li, i) => entra(li, { ritardo: 100 + Math.min(i, 12) * 55, dy: 6, blur: 5, ms: 420 }));
  await attendiDecisione(card, async () => {
    for (const d of r.definizioni) await V.annota('definizione', d.definizione, { termine: d.termine, lezione: l });
    for (const x of r.daEsame) await V.annota('stella', x, { lezione: l });
    D.imp.chiuse = [...(D.imp.chiuse || []), l.file].slice(-60); salva();
    await mostraFatto({ testo: t('barra2.lezione-chiusa'), nota: t('barra2.definizioni-pronte', { n: r.definizioni.length }), azione: [t('barra2.gioca'), () => { nuovoTurno(); schedaGioco(l.corso); }], sintesi: t('barra2.sintesi-definizioni', { n: r.definizioni.length }) }, card);
    aggiornaTutto(); return {};
  });
}

/* ---------- i giochi di memoria ---------- */
async function apriAppunti(l) {
  if (V.attivo) {
    l ||= V.lezioneDaAnnotare(); if (!A.turno || A.home) nuovoTurno();
    const r = await V.apri(l), nome = l.corso === 'Appunti sparsi' ? t('barra2.appunti-sparsi-oggi') : t('barra2.la-nota-di', { corso: l.corso });
    if (r.esito === 'ok') return mostraFatto({ testo: t('barra2.apro-in-obsidian', { nome }) });
    if (r.esito === 'da_aprire') return rispostaFissa(t('barra2.apro-se-non-trova', { nome, percorso: r.percorso }));
    if (r.esito === 'manca') return rispostaFissa(t('barra2.aperto-editor', { nome, percorso: r.percorso }));
    return rispostaFissa(t('barra2.nota-non-si-apre', { errore: r.errore || '' }), { errore: true });
  }
  rispostaFissa(t('barra2.appunti-solo-app'));
}
function schedaGioco(corso) {
  const { scelte, tutte } = daGiocare(6, corso);
  if (scelte.length < 2) {
    rispostaFissa(tutte.length ? (corso ? t('barra2.gioco-sai-gia-di', { corso: tutte[0]?.corso || corso }) : t('barra2.gioco-sai-gia')) : corso ? t('barra2.gioco-nessuna-di', { corso, sezione: 'Definizioni' }) : t('barra2.gioco-nessuna', { sezione: 'Definizioni' }));
    return;
  }
  const manche = partita(scelte, tutte), corsi = [...new Set(scelte.map(d => d.corso))];
  let i = 0, punti = 0, tot = 0; const t0 = Date.now(), sbagliate = new Set();
  const s = scheda('ld-gioco', `<div class="capo"><span class="ld-lbl">${t('barra2.gioco-di', { corso: esc(corsi.length === 1 ? corsi[0] : t('barra2.ultime-lezioni')) })}</span><span class="conto"></span></div><i class="ld-prog"><i></i></i><div class="manche"></div>`);
  const box = s.querySelector('.manche'), conto = s.querySelector('.conto'), pr = s.querySelector('.ld-prog i');
  const segna = (d, ok, q) => { tot++; if (ok) punti++; else sbagliate.add(d.t); ricorda(d.k, ok, q); };
  const avanti = () => { i++; tween(140, e => { box.style.opacity = (1 - e).toFixed(3); }).then(() => { box.style.opacity = ''; mostra(); }); };
  const scuoti = el => tween(260, e => { el.style.transform = e >= 1 ? '' : `translateX(${(Math.sin(e * Math.PI * 4) * 4 * (1 - e)).toFixed(2)}px)`; }, { ease: lineare });
  const mostra = () => {
    pr.style.transform = `scaleX(${(i / manche.length).toFixed(4)})`;
    if (i >= manche.length) return fine();
    const m = manche[i]; conto.textContent = t('barra2.manche-di', { i: i + 1, n: manche.length });
    if (m.tipo === 'abbina') {
      const destra = [...m.defs].sort(() => Math.random() - .5);
      box.innerHTML = `<p class="dom">${t('barra2.abbina')}</p><div class="ld-abbina"><div class="col">${m.defs.map((d, j) => `<button type="button" class="ld-tess" data-s="${j}">${esc(d.t)}</button>`).join('')}</div><div class="col">${destra.map(d => `<button type="button" class="ld-tess def" data-d="${m.defs.indexOf(d)}">${esc(d.d.length > 92 ? d.d.slice(0, 90) + '…' : d.d)}</button>`).join('')}</div></div>`;
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
      box.innerHTML = `<p class="dom">${t('barra2.chi-sono')}</p><p class="def">${esc(m.def.d)}</p><div class="ld-scelte">${m.opzioni.map(o => `<button type="button" class="btn" data-o="${esc(o.k)}">${esc(o.t)}</button>`).join('')}</div>`;
      box.querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => {
        const ok = b.dataset.o === m.def.k; box.querySelectorAll('[data-o]').forEach(x => { x.disabled = true; if (x.dataset.o === m.def.k) x.classList.add('giusta'); });
        if (!ok) { b.classList.add('errata'); scuoti(b); } segna(m.def, ok); segnala(ok ? 'fatto' : 'quiete'); dopo(ok ? 650 : 1500, avanti);
      }));
    } else if (m.tipo === 'completa') {
      box.innerHTML = `<p class="dom">${t('barra2.completa', { termine: esc(m.def.t) })}</p><p class="def">${esc(m.buco.prima)}<input class="ld-buco" aria-label="${t('barra2.parola-mancante')}" autocomplete="off" spellcheck="false" style="width:${Math.max(5, m.buco.parola.length) + 1}ch">${esc(m.buco.dopo)}</p><div class="az"><button type="button" class="btn primary">${t('barra2.controlla-invio')}</button><button type="button" class="btn ld-piano" data-salta>${t('barra2.non-la-so')}</button></div>`;
      const inp = box.querySelector('.ld-buco'), verifica = salta => {
        if (inp.disabled) return; const ok = !salta && giusta(inp.value, m.buco.parola); inp.disabled = true;
        inp.value = m.buco.parola; inp.classList.add(ok ? 'ok' : 'no'); if (!ok) scuoti(inp); segna(m.def, ok); segnala(ok ? 'fatto' : 'quiete'); dopo(ok ? 700 : 1600, avanti);
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); verifica(false); } });
      box.querySelector('.btn.primary').addEventListener('click', () => verifica(false)); box.querySelector('[data-salta]').addEventListener('click', () => verifica(true));
      requestAnimationFrame(() => inp.focus({ preventScroll: true }));
    } else {
      box.innerHTML = `<p class="dom">${t('barra2.te-la-ricordi')}</p><p class="termine">${esc(m.def.t)}</p><p class="def" hidden>${esc(m.def.d)}</p><div class="az"><button type="button" class="btn primary" data-gira>${t('barra2.mostra-spazio')}</button></div>`;
      const gira = () => { const d = box.querySelector('.def'); if (!d.hidden) return; d.hidden = false; entra(d, { dy: 6, blur: 6, ms: 400 });
        box.querySelector('.az').innerHTML = `<button type="button" class="btn" data-no>${t('barra2.non-la-sapevo')}</button><button type="button" class="btn primary" data-si>${t('barra2.la-sapevo')}</button>`;
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
    box.innerHTML = `<div class="ld-esito"><b>${esc(punti)}<small>/${esc(tot)}</small></b><span>${punti === tot ? t('barra2.tutte-giuste') : t('barra2.da-rinforzare', { elenco: [...sbagliate].slice(0, 3).map(esc).join(', ') })}</span><small>${sec < 60 ? t('barra2.secondi', { n: sec }) : t('barra2.minuti', { n: Math.round(sec / 60) })}</small></div>`;
    entra(box, { dy: 8, blur: 6, ms: 480 }); segnala(punti >= tot - 1 ? 'confermato' : 'quiete');
    if (A.turno) A.turno.dataset.sintesi = t('barra2.sintesi-punti', { punti, tot });
    const ancora = daGiocare(6, corso).scelte.length;
    if (ancora >= 2) { const b = h('button', 'btn small', t('barra2.ancora-una')); b.type = 'button'; b.addEventListener('click', () => { nuovoTurno(); detto(A.turno, t('barra2.gioca-ancora')); schedaGioco(corso); }); box.querySelector('.ld-esito').append(b); }
  };
  mostra();
  if (A.turno) A.turno.dataset.sintesi = t('barra2.sintesi-gioco');
}

/* ---------- eseguire un comando locale ---------- */
async function esegui(c) {
  switch (c.tipo) {
    case 'aiuto': return schedaAiuto();
    case 'ferma': { const r = F.ferma(); return r ? mostraFatto({ testo: r.era.fase === 'pausa' ? t('barra2.pausa-finita') : t('barra2.fermato-dopo', { tempo: ore(r.min) }), nota: r.era.fase === 'prova' && PV.inCorso() ? t('barra2.prova-resta-aperta') : r.min >= 5 && r.era.fase !== 'pausa' ? t('barra2.li-conto') : '', sintesi: t('barra2.sintesi-timer-fermato') }) : rispostaFissa(t('barra2.nessun-timer')); }
    case 'sospendi': F.sospendi(); return mostraFatto({ testo: t('barra2.timer-in-pausa'), nota: t('barra2.scrivi-riprendi') });
    case 'riprendi': F.riprendi(); return mostraFatto({ testo: t('barra2.si-riparte') });
    case 'focus': {
      if (c.nomeDetto && !c.esame) return rispostaFissa(t('barra2.focus-esame-sconosciuto', { nome: c.nomeDetto, min: c.min || D.imp.focus }));
      if (!c.min && !c.esame) return schedaFocus();
      return avviaFocus({ min: c.min || D.imp.focus, esameId: c.esame?.id || null, dove: null });
    }
    case 'voto': case 'idoneita': {
      const ann = istantanea(); let e = c.esame, nuovo = false;
      if (!e) { if (!c.nomeDetto) return rispostaFissa(t('barra2.di-quale-esame')); e = aggiungiEsame({ nome: c.nomeDetto, cfu: 6 }); nuovo = true; }
      const prima = media();
      registraVoto(e.id, c.tipo === 'idoneita' ? { idoneita: true } : { voto: c.voto, lode: c.lode });
      const dopo = media(), d = prima.ponderata != null && dopo.ponderata != null ? dopo.ponderata - prima.ponderata : null;
      await mostraFatto({ testo: c.tipo === 'idoneita' ? t('barra2.idoneita-registrata', { nome: e.nome }) : c.lode ? t('barra2.voto-lode-in', { voto: c.voto, nome: e.nome }) : t('barra2.voto-in', { voto: c.voto, nome: e.nome }), nota: nuovo ? t('barra2.nuovo-esame-6-cfu') : (d != null ? t('barra2.media-diff', { media: num(dopo.ponderata, 2), segno: d >= 0 ? '+' : '−', diff: num(Math.abs(d), 2) }) : ''), annulla: ann, sintesi: t('barra2.sintesi-voto', { nome: e.nome, voto: c.tipo === 'idoneita' ? t('barra2.idoneita') : c.voto }) });
      segnala('fatto'); aggiornaTutto();
      if (c.voto >= 28 || c.lode) rispostaFissa(c.lode ? t('barra2.trenta-e-lode') : t('barra2.bel-colpo'));
      return schedaLibretto();
    }
    case 'esame': {
      const ann = istantanea(); let e = c.esistente && !c.esistente.fatto ? c.esistente : null;
      if (e) { if (c.data) e.data = c.data; if (c.cfu) e.cfu = c.cfu; salva(); }
      else e = aggiungiEsame({ nome: c.nome, cfu: c.cfu || 6, data: c.data });
      await mostraFatto({ testo: c.esistente && !c.esistente.fatto ? t('barra2.esame-aggiornato', { nome: e.nome }) : t('barra2.esame-aggiunto', { nome: e.nome }), nota: !c.cfu && !c.esistente ? t('barra2.esame-nota-cambiali', { quando: e.data ? cap(dataLunga(e.data)) : t('barra2.senza-data'), cfu: e.cfu }) : t('barra2.esame-nota', { quando: e.data ? cap(dataLunga(e.data)) : t('barra2.senza-data'), cfu: e.cfu }), annulla: ann, sintesi: `${e.nome} ${e.data ? traQuanto(e.data) : ''}` });
      aggiornaTutto();
      if (e.data) { const p = piano(e), g = giorniTra(oggi(), e.data), liv = D.imp.allenatore || 'normale'; rispostaFissa(`${t('barra2.piano-ore', { h: num(p.perGiorno), tot: p.tot })} ${liv === 'mai' ? t('barra2.proposte-spente-riaccendi') : g <= 14 ? t('barra2.proposte-da-adesso-vicino', { nome: e.nome }) : t('barra2.proposte-da-adesso', { nome: e.nome })}`); }
      return;
    }
    case 'carta': {
      aggiungiCarta({ esameId: c.esame?.id || null, fronte: c.fronte, retro: c.retro }); salva(); aggiornaTutto();
      return mostraFatto({ testo: t('barra2.carta-aggiunta'), nota: c.esame ? c.esame.nome : t('barra2.senza-esame'), annulla: (() => { const id = D.carte.at(-1).id; return () => { D.carte = D.carte.filter(x => x.id !== id); salva(); }; })() });
    }
    case 'simula': return schedaSimula(c);
    case 'serve': return schedaLibretto({ base: c.base });
    case 'libretto': return schedaLibretto();
    case 'esami': return schedaEsami();
    // «piano»: con il lavoro, una finestra di studio o due esami vicini, la settimana a ore (js/ore.js); se no gli appelli
    case 'oggi': return ORE.calendario().attivo ? schedaOre() : schedaEsami();
    case 'apriEsame': return c.esame.fatto ? schedaLibretto() : schedaEsami();
    case 'ripasso': {
      if (c.nomeDetto && !c.esame) return rispostaFissa(t('barra2.esame-sconosciuto', { nome: c.nomeDetto }));
      return schedaRipasso(c.esame?.id);
    }
    case 'orale': {
      // «interrogami su green»: non è un esame ma un argomento del programma di uno degli esami
      if (!c.esame && c.nomeDetto) for (const e of daFare()) { const a = PG.programmaDi(e) && PG.abbina(c.nomeDetto, e.programma.argomenti); if (a) return avviaOraleProgramma(e, [a], { max: 2 }); }
      return avviaOrale(c.esame, c.nomeDetto);
    }
    case 'programma': return schedaProgramma(c);
    case 'crocette': return schedaCrocette(c);
    case 'temi': return schedaTemi(c);
    case 'prova': return schedaProva(c);
    case 'moodle': return schedaMoodle(c.cosa);
    case 'agenti': return schedaAgenti(c);
    case 'turnoAgente': return schedaTurno([...turniAgenti.values()].sort((a, b) => (b.fine || 0) - (a.fine || 0))[0]);
    case 'spiego': {
      // l'argomento detto, cercato nei programmi degli esami da fare; senza argomento, il primo di oggi nel piano
      const conP = daFare().filter(e => PG.programmaDi(e));
      if (!conP.length) return rispostaFissa(t('barra2.spiego-senza-programma'));
      for (const e of conP) { const a = c.q ? PG.abbina(c.q, e.programma.argomenti) : null; if (a) return avviaSpiego(e, a); }
      if (c.q) return rispostaFissa(t('barra2.argomento-sconosciuto', { q: c.q }));
      const e = prossimi().find(x => PG.programmaDi(x)) || conP[0], o = PG.oggiDi(e), x = o && [...o.studia, ...o.ripassa][0];
      return avviaSpiego(e, x?.a || e.programma.argomenti[0]);
    }
    case 'domande': {
      const e = c.esame || (c.nomeDetto ? null : prossimi().find(x => PG.programmaDi(x)) || prossimi()[0]);
      if (!e) return rispostaFissa(c.nomeDetto ? t('barra2.esame-non-trovato', { nome: c.nomeDetto }) : t('barra2.domande-di-quale-esame'));
      if (!c.testo) return PG.programmaDi(e) ? disegnaProgramma(e, { domande: true }) : programmaVuoto(e);
      return aggiungiDomandeUscite(e, c.testo);
    }
    case 'stella': case 'domanda': case 'definizione': {
      const r = await salvaCattura(c.tipo, c.testo, { termine: c.termine }); if (!r) return;
      return mostraFatto({ testo: r.testo, nota: V.attivo ? t('barra2.nella-nota-lezione') : '', azione: V.attivo ? [t('barra2.apri'), () => apriAppunti(r.l)] : null, sintesi: r.testo });
    }
    case 'orario': {
      const o = aggiungiOrario(c); V.scriviOrario(); aggiornaTutto();
      await mostraFatto({ testo: t('barra2.in-orario', { corso: o.corso }), nota: `${o.giorni.map(g => GIORNI_BREVI[g]).join(', ')} · ${o.inizio}–${o.fine}${o.aula ? ' · ' + t('barra2.aula', { aula: o.aula }) : ''}`, sintesi: t('barra2.sintesi-in-orario', { corso: o.corso }) });
      return rispostaFissa(t('barra2.orario-spiegazione'));
    }
    case 'vediOrario': return schedaOrario();
    case 'lavoro': return comandoLavoro(c);
    case 'ore': return schedaOre();
    case 'gioco': return schedaGioco(c.corso);
    case 'appunti': return apriAppunti();
    case 'naviga': return schedaNote(c.q);
    case 'chiudiLezione': return chiudiLezione(c.corso);
    case 'prepara': return schedaPrepara(c.cosa);
    case 'sincronizza': return schedaSincronizza(c.cosa);
    case 'ai': return schedaAI(c.fornitore);
    case 'proposte': D.imp.allenatore = c.livello; salva(); return mostraFatto({ testo: c.livello === 'mai' ? t('barra2.proposte-spente') : ({ poco: t('barra2.proposte-poche'), normale: t('barra2.proposte-normali'), spesso: t('barra2.proposte-frequenti') })[c.livello], nota: c.livello === 'mai' ? t('barra2.riaccendi-quando-vuoi') : t('barra2.proposte-mai-quando') });
    case 'proponi': { const r = await provaAllenatore(true); return r?.includes(':') ? null : rispostaFissa(t('barra2.niente-da-proporre')); }
    case 'trascrivi': return c.sorgente === 'computer' ? schedaComputer(c.corso) : avviaTrascrizione();
    case 'ripeti': return ripeti(c.sec || 60);
    case 'spegniRipeti': return spegniRipeti();
    case 'condividi': return condividiLezione(c.corso);
    case 'anki': return esportaAnki(c.corso);
    case 'tasca': return schedaTasca(c);
    case 'fineTrascrizione': return fermaTrascrizione();
    case 'pausaTrascrizione': TR.pausa(); return mostraFatto({ testo: t('barra2.trascrizione-in-pausa'), nota: t('barra2.scrivi-riprendi-trascrizione') });
    case 'riprendiTrascrizione': TR.riprendi(); return mostraFatto({ testo: t('barra2.riprendo-trascrivere') });
    case 'riordina': return riordinaLezione(c.corso);
    case 'stampa': {   // scritto nel campo: il campo lascia il fuoco, così i tasti 1-4 rispondono subito
      const s = ST.schedaStampa({ corso: c.corso || corsoInf(), lingua: c.lingua });
      if (s && !ST.ultima()?.scrivi && document.activeElement === campo.querySelector('input')) campo.querySelector('input').blur();
      return s;
    }
    case 'progetto': return PR.esegui(c);
    case 'errore': return spiegaIncollato(c.testo);
    case 'diario': return apriDiario(c.progetto);
    case 'diarioOpz': return opzioneDiario(c);
  }
}

/* ---------- informatica: gli errori spiegati (F3) e il registro onesto (F4) ---------- */
const nomeFile = f => f ? String(f).split(/[\\/]/).pop() : null;
const nomeSicuro = n => typeof n === 'string' && n && !['__proto__', 'constructor', 'prototype'].includes(n);
// la scheda «Errore»: il primo errore, le righe vere con due prima e due dopo, i passi che si aprono uno alla volta.
// conta: la prima volta che la scheda si apre per quell'errore (D.codice.errori e l'evento del diario)
function schedaErrore(r, { progetto = null, corso = null, prova = null, valutato = false, sorgente = null, righeCambiate = null, cambiato = false, conta = true, notaValutato = t('barra2.err-valutato') } = {}) {
  // con il file vero spiega() può correggere la voce (uno «scanf senza &» che è un printf): conta quella
  const d0 = r.primo, sp = ER.spiega(d0, { sorgente, righeCambiate, valutato, cambiato }), d = sp.chiave === d0.chiave ? d0 : { ...d0, chiave: sp.chiave };
  const chi = { ...(progetto ? { progetto } : {}), ...(corso ? { corso } : {}), voce: d.chiave || null, nome: ER.nomeErrore(d.chiave), titolo: ER.breve(d), file: nomeFile(d.file), riga: d.riga || null };
  // la correzione di questo errore l'hai già guardata? Allora resta scritto
  const vista = D.codice.eventi.some(x => x.tipo === 'correzione-vista' && x.voce === chi.voce && x.file === chi.file && x.riga === chi.riga && (prova == null || x.t >= prova));
  const s = scheda('ld-err', ER.schedaHtml(sp, { conto: r.conto, vista }));
  s.setAttribute('role', 'group'); s.setAttribute('aria-label', t('barra2.errore-spiegato'));
  if (vista) s.querySelector('[data-passo=correzione]')?.setAttribute('data-vista', '1');
  if (sp.correzioneNascosta) { const n = document.createElement('p'); n.className = 'ld-nota'; n.dataset.valutato = '1'; n.textContent = notaValutato; s.append(n); }
  if (A.turno) A.turno.dataset.sintesi = ER.perDiario(d);
  let t0 = null;
  if (conta) {
    const k = d.chiave || 'sconosciuto';
    D.codice.errori[k] = (Number(D.codice.errori[k]) || 0) + 1;
    t0 = DI.registra(D.codice, { tipo: 'errore', ...chi, ...(prova != null ? { prova } : {}) })?.t ?? null;
    salva(); V.scriviMemoria();
  }
  s.querySelectorAll('details[data-passo]').forEach(det => det.addEventListener('toggle', () => {
    if (!det.open) return;
    const passo = det.dataset.passo;
    if ((passo === 'dove' || passo === 'cosa') && t0 != null) {   // D può essere stato ricaricato: l'evento si cerca per t
      const ev = D.codice.eventi.find(x => x.tipo === 'errore' && x.t === t0);
      if (ev && !(ev.passi || []).includes(passo)) { DI.segnaPasso(ev, passo); salva(); }
    }
    if (passo === 'correzione' && !det.dataset.vista) {   // resta scritto: la correzione l'hai vista
      det.dataset.vista = '1';
      det.querySelector('summary').insertAdjacentHTML('beforeend', `<span class="ld-err-vista">${t('barra2.correzione-vista')}</span>`);
      DI.registra(D.codice, { tipo: 'correzione-vista', ...chi }); salva();
    }
  }));
  return s;
}
// i percorsi che il compilatore scrive (relativi alla cartella, o assoluti, o con «\» su Windows) → quelli del progetto
function percorsiPossibili(file) {
  const f = String(file || '').split('\\').join('/').replace(/^\.\//, '');
  if (!/^(?:\/|[A-Za-z]:\/)/.test(f)) return [f];
  const p = f.split('/').filter(Boolean);
  return [4, 3, 2, 1].filter(n => n <= p.length).map(n => p.slice(-n).join('/'));
}
// dopo una prova che non compila o che si ferma: l'errore in italiano, con le righe vere del file seguito
const spiegati = new Set();
async function spiegaEsito(e) {
  let lista = [];
  if (e.esito === 'non-compila') lista = ER.analizza(`${e.compilazione?.stderr || ''}\n${e.compilazione?.stdout || ''}`);
  else { const c = (e.casi || []).find(x => x.crash || x.scaduto); if (c) lista = ER.analizzaUscita({ codice: c.codice, segnale: c.segnale, stderr: c.stderr, tempoScaduto: !!c.scaduto }); }
  const r = ER.riassunto(lista); if (!r.primo) return null;
  const d = r.primo; let sorgente = null, cambiato = false;
  if (BRIDGE && d.file && d.riga) {
    const da = d.chiave === 'include-mancante' ? 1 : Math.max(1, d.riga - 150), a = d.riga + 3;
    for (const rel of percorsiPossibili(d.file)) {
      const x = await BRIDGE.invoca('progetto:righe', { id: e.id, rel, da, a }).catch(() => null);
      if (x && !x.errore) { sorgente = x; cambiato = !!x.impronta && !!e.impronta && x.impronta !== e.impronta; break; }
    }
  }
  const righeCambiate = (e.dopoRiuscita || []).flatMap(f => (f.intervalli || []).map(([da, a]) => ({ file: f.rel, da, a })));
  const k = `${e.id}|${e.quando}`, conta = !spiegati.has(k); spiegati.add(k);
  return schedaErrore(r, { progetto: e.nome, corso: PR.stato().get(e.id)?.corso || null, prova: e.quando, valutato: !!e.valutato, sorgente, righeCambiate: righeCambiate.length ? righeCambiate : null, cambiato, conta });
}
// segui almeno un progetto «valutato»? Un errore copiato a mano non dice da quale progetto viene: niente correzione
async function seguoValutato() {
  let seguiti = [...PR.stato().values()];
  if (!seguiti.length && BRIDGE) seguiti = (await BRIDGE.invoca('progetto:stato').catch(() => null))?.progetti || [];
  return seguiti.some(p => p?.valutato);
}
// «spiegami l'errore»: il testo scritto dopo, se no quello copiato negli appunti (letto dal main, solo se è un errore)
async function spiegaIncollato(testo) {
  if (!testo && BRIDGE) testo = (await BRIDGE.invoca('appunti:errore').catch(() => null))?.testo || null;
  if (!testo) return rispostaFissa(BRIDGE ? t('barra2.copia-errore') : t('barra2.incolla-errore'));
  const r = ER.riassunto(ER.analizza(testo));
  if (!r.primo) return rispostaFissa(t('barra2.nessun-errore-nel-testo'));
  return schedaErrore(r, { valutato: await seguoValutato(), notaValutato: t('barra2.segui-valutato') });
}
// gli eventi di «Segui il progetto» nel registro (D.codice.eventi → diario del progetto). Mai il percorso: solo il nome
function eventoProgetto(x) {
  if (!nomeSicuro(x?.nome)) return;
  if (x.tipo === 'segui') D.codice.opzioni[x.nome] = { ...DI.opzioniProgetto(D.codice, x.nome), diario: x.diario !== false, valutato: !!x.valutato };
  if (x.tipo === 'prova' && x.primo && x.stderr) { const d = ER.riassunto(ER.analizza(x.stderr)).primo; if (d) x = { ...x, primo: { ...x.primo, titolo: ER.breve(d) } }; }
  const ev = DI.daProgetto(x, { corso: x.corso || PR.stato().get(x.id)?.corso || null });
  if (ev) DI.registra(D.codice, ev);
  salva();
}
// «diario del progetto»: la nota di oggi in Obsidian (Progetti/<nome>/<giorno>.md)
async function apriDiario(progetto) {
  if (!V.attivo) return rispostaFissa(t('barra2.diario-solo-app'));
  await V.scriviDiario();
  const x = DI.diarioDaAprire(D.codice, { progetto });
  if (!x) return rispostaFissa(progetto ? t('barra2.progetto-sconosciuto', { nome: progetto }) : t('barra2.nessun-progetto-segui'));
  if (x.spento) return rispostaFissa(t('barra2.diario-spento-per', { progetto: x.progetto }));
  const r = await V.apriDiario(x).catch(e => ({ esito: 'errore', errore: e.message }));
  if (r?.esito === 'errore') return rispostaFissa(t('barra2.diario-non-si-apre', { errore: r.errore }), { errore: true });
  return mostraFatto({ testo: t('barra2.diario-di', { progetto: x.progetto }), nota: r?.esito === 'manca' ? t('barra2.aperto-editor-sistema') : t('barra2.aperto-in-obsidian', { file: x.file }), sintesi: t('barra2.sintesi-diario-di', { progetto: x.progetto }) });
}
// l'interruttore «non scrivere il diario di questo progetto» (e il contrario)
function opzioneDiario(c) {
  const seguiti = [...PR.stato().values()].map(p => p.nome).filter(Boolean);
  const nome = DI.diarioDaAprire(D.codice, { progetto: c.progetto })?.progetto || seguiti.find(n => !c.progetto || norm(n).includes(norm(c.progetto)));
  if (!nomeSicuro(nome)) return rispostaFissa(c.progetto ? t('barra2.progetto-sconosciuto', { nome: c.progetto }) : t('barra2.nessun-progetto'));
  D.codice.opzioni[nome] = { ...DI.opzioniProgetto(D.codice, nome), diario: c.diario }; salva(); aggiornaTutto();
  return mostraFatto(c.diario ? { testo: t('barra2.diario-acceso', { nome }), nota: t('barra2.diario-acceso-nota') }
    : { testo: t('barra2.diario-spento', { nome }), nota: t('barra2.diario-spento-nota') });
}

/* ---------- AI ---------- */
async function eseguiStrumento(nome, x) {
  A.risposta?.fine(); A.risposta = null; modo('riposo');
  if (nome === 'avvia_focus') { const e = x.esame ? trovaEsame(x.esame) : null; F.avvia({ min: x.minuti || D.imp.focus, esameId: e?.id || null }); await mostraFatto({ testo: e ? t('barra2.focus-di-minuti-su', { min: x.minuti || D.imp.focus, nome: e.nome }) : t('barra2.focus-di-minuti', { min: x.minuti || D.imp.focus }) }); aggiornaPillola(); return { esito: 'avviato' }; }
  if (nome === 'mostra') { const e = x.esame ? trovaEsame(x.esame) : null; x.scheda === 'libretto' ? schedaLibretto() : x.scheda === 'esami' ? schedaEsami() : schedaRipasso(e?.id); return { esito: 'mostrata' }; }
  if (nome === 'crea_carte') {
    const e = x.esame ? trovaEsame(x.esame) : null, carte = x.carte.slice(0, 30);
    const card = schedaConferma({ titolo: e ? t('barra2.salvare-carte-di', { n: carte.length, nome: e.nome }) : t('barra2.salvare-carte', { n: carte.length }),
      extra: `<ol class="ld-proposte">${carte.map(c => `<li><b>${esc(c.fronte)}</b><span>${esc(c.retro)}</span></li>`).join('')}</ol>`, nota: t('barra2.entrano-ripasso') });
    card.querySelectorAll('.ld-proposte li').forEach((li, i) => entra(li, { ritardo: 120 + Math.min(i, 12) * 60, dy: 6, blur: 5, ms: 420 }));
    return attendiDecisione(card, async () => { carte.forEach(c => aggiungiCarta({ esameId: e?.id || null, fronte: c.fronte, retro: c.retro })); salva(); aggiornaTutto(); await mostraFatto({ testo: t('barra2.carte-salvate', { n: carte.length }), azione: [t('barra2.ripassa-ora'), () => { nuovoTurno(); schedaRipasso(e?.id); }], sintesi: t('barra2.sintesi-carte', { n: carte.length }) }, card); return { esito: 'salvate', n: carte.length }; });
  }
  if (nome === 'aggiungi_esame') {
    const card = schedaConferma({ titolo: t('barra2.aggiungere-esame', { nome: x.nome }), righe: [[t('barra2.esame'), x.nome], [t('barra2.cfu'), String(x.cfu || 6)], [t('barra2.appello'), x.data ? dataLunga(x.data) : t('barra2.senza-data')]] });
    return attendiDecisione(card, async () => { const e = aggiungiEsame({ nome: x.nome, cfu: x.cfu || 6, data: /^\d{4}-\d\d-\d\d$/.test(x.data || '') ? x.data : null }); aggiornaTutto(); await mostraFatto({ testo: t('barra2.esame-aggiunto', { nome: e.nome }) }, card); return { esito: 'aggiunto' }; });
  }
  if (nome === 'registra_voto') {
    const e = trovaEsame(x.esame);
    const card = schedaConferma({ titolo: x.lode && x.voto === 30 ? t('barra2.registrare-voto-lode', { voto: x.voto }) : t('barra2.registrare-voto', { voto: x.voto }), righe: [[t('barra2.esame'), e?.nome || t('barra2.esame-nuovo-6-cfu', { nome: x.esame })], [t('barra2.voto'), x.lode && x.voto === 30 ? t('barra2.voto-e-lode', { voto: x.voto }) : `${x.voto}`]] });
    return attendiDecisione(card, async () => { const ee = e || aggiungiEsame({ nome: x.esame, cfu: 6 }); registraVoto(ee.id, { voto: x.voto, lode: x.lode }); aggiornaTutto(); await mostraFatto({ testo: t('barra2.voto-registrato'), nota: t('barra2.media', { media: num(media().ponderata, 2) }) }, card); return { esito: 'registrato', media: media().ponderata }; });
  }
  return { errore: 'strumento sconosciuto' };
}
async function chiediAI(testo, { sistema } = {}) {
  const g = GEN; modo('pensa', A.allegati.length ? t('barra2.leggo-il-file') : A.orale ? t('barra2.prof-ci-pensa') : t('barra2.un-attimo')); segnala('pensa');
  const blocchi = [];
  for (const f of A.allegati) {
    try {
      // a Claude i PDF vanno così come sono; agli altri (locale o servizi in formato OpenAI) il testo estratto qui
      const x = AI.motore() !== 'claude' ? await FILE.classifica(f.file) : null;
      if (x && ['pdf', 'slide', 'word'].includes(x.tipo)) blocchi.push({ type: 'document', source: { type: 'text', media_type: 'text/plain', data: (await FILE.testoDi(x)).slice(0, 120000) }, title: f.file.name });
      else blocchi.push(await AI.bloccoFile(f.file));
    } catch { }
  }
  if (A.allegati.length) { const t = A.turno; const box = h('div', 'ld-allegati'); A.allegati.forEach(f => box.append(chipFile(f.file, false))); t.append(box); A.allegati = []; allegatiBox.innerHTML = ''; }
  // col modello locale i file diventano carte con una risposta strutturata (niente strumenti)
  if (blocchi.length && AI.motore() !== 'claude' && !A.orale) {
    try { const carte = await AI.carteDa([...blocchi, { type: 'text', text: testo }]); modo('riposo'); if (!carte.length) return rispostaFissa(t('barra2.file-senza-carte-locale')); return eseguiStrumento('crea_carte', { carte, esame: prossimi()[0]?.nome }); }
    catch (e) { modo('riposo'); return rispostaFissa(t('barra2.file-illeggibile', { errore: e.message }), { errore: true }); }
    finally { if (g === GEN) segnala('quiete'); }
  }
  A.storia.push({ role: 'user', content: [...blocchi, { type: 'text', text: testo }] });
  A.controller = new AbortController();
  try {
    if (AI.motore() !== 'claude') { await AI.conversaSemplice({ storia: A.storia, sistema, segnale: A.controller.signal, suTesto: d => { if (g !== GEN) return; if (!A.risposta) { modo('riposo'); A.risposta = nuovaRisposta(); } A.risposta.aggiungi(d); } }); A.risposta?.fine(); return; }
    await AI.conversa({ storia: A.storia, sistema, strumenti: !A.orale, segnale: A.controller.signal, esegui: eseguiStrumento,
      suTesto: d => { if (g !== GEN) return; if (!A.risposta) { modo('riposo'); A.risposta = nuovaRisposta(); } A.risposta.aggiungi(d); } });
    A.risposta?.fine();
  } catch (e) {
    if (g !== GEN || e.name === 'AbortError' || /abort/i.test(e.message)) return;
    console.error(e);
    const msg = e.status === 401 ? t('barra2.chiave-non-valida-ricollega') : e.status === 429 ? t('barra2.troppe-richieste') : e.status === 529 || e.status >= 500 ? t('barra2.sovraccarico', { motore: AI.nomeMotore() }) : /Failed to fetch|NetworkError/i.test(e.message) ? t('barra2.manca-rete') : t('barra2.qualcosa-non-andato', { errore: e.message });
    A.risposta?.fine(); rispostaFissa(msg, { errore: true });
    // la storia resta coerente: tolgo la domanda senza risposta
    while (A.storia.length && A.storia.at(-1).role === 'user') A.storia.pop();
  } finally { A.risposta = null; if (g === GEN) { modo('riposo'); segnala('quiete'); } }
}

/* ---------- l'orale ---------- */
async function avviaOrale(e, nomeDetto, materialeFile) {
  if (!A.turno || A.home) nuovoTurno();
  if (!AI.attiva()) {
    rispostaFissa(V.attivo ? t('barra2.orale-serve-ai-app') : t('barra2.orale-serve-ai-web'));
    return;
  }
  if (!e) {
    const lista = prossimi().length ? prossimi() : daFare();
    if (nomeDetto) { rispostaFissa(t('barra2.orale-esame-sconosciuto', { nome: nomeDetto })); e = { id: null, nome: nomeDetto }; }
    else if (lista.length === 1) e = lista[0];
    else {
      const s = scheda('ld-scegli', `<span class="ld-lbl">${t('barra2.su-quale-esame')}</span><div class="ld-preset">${lista.slice(0, 6).map(x => `<button type="button" class="ld-chip larga" data-e="${esc(x.id)}"><b>${esc(x.nome)}</b><span>${x.data ? traQuanto(x.data) : ''}</span></button>`).join('') || `<p class="ld-nota">${t('barra2.aggiungi-prima-esame')}</p>`}</div>`);
      s.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => { nuovoTurno(); detto(A.turno, t('barra2.interrogami-su', { nome: esame(b.dataset.e).nome })); avviaOrale(esame(b.dataset.e)); }));
      return;
    }
  }
  // il materiale: il file che hai dato, o le tue carte, o le tue lezioni (definizioni e ★)
  const carte = D.carte.filter(x => x.esameId === e.id).slice(0, 80), lez = lezioni().filter(l => norm(l.corso) === norm(e.nome)).slice(0, 6);
  const materiale = materialeFile || [
    carte.length ? `Carte del ripasso:\n${carte.map(x => `– ${x.fronte} → ${x.retro}`).join('\n')}` : '',
    lez.length ? `Lezioni:\n${lez.map(l => [...(l.definizioni || []).map(d => `– ${d.t}: ${d.d}`), ...(l.stelle || []).map(x => `– ★ ${x}`)].join('\n')).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
  A.orale = { esameId: e.id, nome: e.nome, materiale, storico: [], corrente: null, max: 5 }; A.storia = [];
  const c = contesto(t('barra2.orale-di-contesto', { nome: esc(e.nome) })); const via = h('button', 'ld-esci', t('barra2.esci')); via.type = 'button'; via.addEventListener('click', esciOrale); c.append(via);
  A.turno.dataset.sintesi = t('barra2.sintesi-orale-di', { nome: e.nome });
  return domandaOrale();
}
// l'orale guidato dal codice: domanda → risposta dello studente → giudizio → domanda… (5) → voto calcolato da Lode
async function domandaOrale() {
  const o = A.orale, g = GEN; if (!o) return;
  modo('pensa', t('barra2.prof-ci-pensa')); segnala('pensa');
  try {
    const arg = o.argomenti ? o.argomenti[o.storico.length % o.argomenti.length] : null;
    const materiale = arg ? PG.materialeArgomento(esame(o.esameId), arg) : o.materiale;
    const d = await AI.domandaOrale({ nome: o.nome, materiale, fatte: o.storico.map(x => arg ? x.domanda : x.argomento), argomento: arg?.t });
    if (g !== GEN || A.orale !== o) return;
    o.corrente = arg ? { ...d, argomentoId: arg.id, argomento: arg.t, materiale } : d; modo('riposo');
    const r = nuovaRisposta(); r.aggiungi(t('barra2.domanda-n-di', { n: o.storico.length + 1, max: o.max, domanda: d.domanda })); await r.fine();
  } catch (e) { if (g === GEN) { modo('riposo'); rispostaFissa(t('barra2.prof-non-risponde', { errore: e.message }), { errore: true }); } }
  finally { if (g === GEN) segnala('quiete'); }
}
async function rispostaOrale(testo) {
  const o = A.orale, g = GEN;
  if (/^(basta|voto|dammi il voto|ho finito)\b/i.test(testo) || !o.corrente) return chiudiOrale();
  modo('pensa', t('barra2.prof-ascolta')); segnala('pensa');
  try {
    const giu = await AI.giudicaRisposta({ nome: o.nome, domanda: o.corrente.domanda, argomento: o.corrente.argomento, risposta: testo, materiale: o.corrente.materiale || o.materiale });
    if (g !== GEN || A.orale !== o) return;
    o.storico.push({ ...o.corrente, risposta: testo, ...giu }); o.corrente = null; modo('riposo');
    esitoSulProgramma(o, o.storico.at(-1));
    const r = nuovaRisposta(); r.aggiungi(`**${cap(giu.esito)}.** ${giu.giudizio}${giu.mancava ? `\n\n${t('barra2.orale-mancava', { cosa: giu.mancava })}` : ''}`); await r.fine();
    segnala(giu.esito === 'giusta' ? 'fatto' : 'quiete');
    // il giudizio è il parere di un modello (piccolo, se locale): se era giusta lo studente lo dice, e il voto ne tiene conto
    if (giu.esito !== 'giusta') {
      const x = o.storico.at(-1), b = h('button', 'btn small ld-piano ld-contesta', t('barra2.era-giusta')); b.type = 'button';
      b.addEventListener('click', () => { x.esitoModello = x.esito; x.esito = 'giusta'; x.contestata = true; b.disabled = true; b.textContent = t('barra2.segnata-giusta'); const u = x.registrato?.esiti?.at(-1); if (u) { u.e = 'giusta'; salva(); } });
      (A.turno || filo).append(b);
    }
    return o.storico.length >= o.max ? chiudiOrale() : domandaOrale();
  } catch (e) { if (g === GEN) { modo('riposo'); rispostaFissa(t('barra2.prof-non-risponde', { errore: e.message }), { errore: true }); } }
}
async function chiudiOrale() {
  const o = A.orale; if (!o) return;
  if (!o.storico.length) return esciOrale();
  A.orale = null; nuovoTurno();
  const v = AI.votoOrale(o.storico);
  modo('pensa', t('barra2.prof-scrive-voto')); segnala('pensa');
  let rip = []; try { rip = await AI.ripassoOrale({ nome: o.nome, storico: o.storico }); } catch { }
  modo('riposo'); segnala(v.voto >= 27 ? 'confermato' : 'quiete');
  const s = scheda('ld-voto', `<span class="ld-lbl">${t('barra2.orale-titolo', { nome: esc(o.nome), n: esc(o.storico.length) })}</span>
    <div class="ld-voto-n">${esc(v.testo)}</div>
    <div class="ld-esiti">${o.storico.map((x, i) => `<div class="ld-esito-r e-${x.esito.replace(' ', '-')}"><span class="n">${i + 1}</span><b>${esc(x.argomento || x.domanda)}</b><em>${esc(x.esito)}</em></div>`).join('')}</div>
    ${rip.length ? `<span class="ld-lbl">${t('barra2.da-ripassare')}</span><ul class="ld-ripassa">${rip.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <p class="ld-nota">${o.storico.some(x => x.contestata) ? t('barra2.orale-calcolo-contestate', { n: o.storico.filter(x => x.contestata).length }) : t('barra2.orale-calcolo')} ${AI.motore() === 'locale' ? t('barra2.orale-giudizi-locale') : t('barra2.orale-giudizi-ai')}</p>`);
  s.querySelectorAll('.ld-esito-r').forEach((x, i) => entra(x, { ritardo: 120 + i * 70, dy: 6, blur: 5, ms: 420 }));
  if (A.turno) A.turno.dataset.sintesi = t('barra2.sintesi-orale-voto', { nome: o.nome, voto: v.testo });
}
function esciOrale() { if (!A.orale) return; A.orale = null; A.storia = []; mostraFatto({ testo: t('barra2.orale-chiuso'), nota: t('barra2.ripassa-esitato') }); }

/* ---------- il ponte con gli agenti di programmazione (desktop/agenti.mjs), in sola lettura ---------- */
// l'agente manda i suoi eventi a Lode; Lode guarda i progetti seguiti e a fine turno dice cosa ha fatto davvero
const NOMI_AGENTI = {};
const turniAgenti = new Map();   // id progetto → ultimo turno arrivato
async function schedaAgenti(c = {}) {
  if (!BRIDGE) return rispostaFissa(t('barra2.agenti-solo-app'));
  let st; try { st = await BRIDGE.invoca('agenti:stato'); } catch (e) { return rispostaFissa(t('barra2.ponte-non-risponde', { errore: e.message }), { errore: true }); }
  st.agenti.forEach(a => { NOMI_AGENTI[a.id] = a.nome; });
  if (c.agente) {
    const a = st.agenti.find(x => x.id === c.agente || norm(x.nome).replace(/ /g, '').startsWith(c.agente));
    if (!a) return rispostaFissa(t('barra2.agente-sconosciuto', { agente: c.agente }));
    return collegaAgente(a, c.togli);
  }
  const ordinati = [...st.agenti].sort((a, b) => (b.collegato - a.collegato) || (b.installato - a.installato));
  const s = scheda('ld-agenti', `<span class="ld-lbl">${t('barra2.agenti-titolo')}</span>
    <p>${t('barra2.agenti-spiegazione')}</p>
    <ul class="ld-agenti-l">${ordinati.map(a => `<li><span class="t"><b>${esc(a.nome)}</b><small>${a.collegato ? (a.eventi ? t('barra2.ag-collegato-eventi', { n: a.eventi, ora: esc(PR.ora(a.ultimo)) }) : t('barra2.ag-collegato-nessuno')) : a.installato ? t('barra2.ag-trovato') : t('barra2.ag-non-trovato')}${a.eventi?.length && Array.isArray(a.eventi) ? '' : ''}</small></span><button type="button" class="btn small${a.collegato ? ' ld-piano' : a.installato ? ' primary' : ''}" data-a="${esc(a.id)}">${a.collegato ? t('barra2.scollega') : t('barra2.collega')}</button></li>`).join('')}</ul>
    <p class="ld-nota">${t('barra2.agenti-nota')}</p>`);
  s.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', async () => { const a = st.agenti.find(x => x.id === b.dataset.a); b.disabled = true; const r = await collegaAgente(a, a.collegato, { silenzioso: true }); b.disabled = false; if (r?.ok && !r.uguale) { b.textContent = a.collegato ? t('barra2.collega') : t('barra2.scollega'); a.collegato = !a.collegato; b.classList.toggle('ld-piano', a.collegato); b.classList.toggle('primary', !a.collegato); } }));
  if (A.turno) A.turno.dataset.sintesi = t('barra2.sintesi-agenti');
}
async function collegaAgente(a, togli = false, { silenzioso = false } = {}) {
  const r = await BRIDGE.invoca(togli ? 'agenti:scollega' : 'agenti:collega', { id: a.id }).catch(e => ({ errore: e.message }));
  if (r?.annullato) { if (!silenzioso) rispostaFissa(t('barra2.niente-toccato')); return r; }
  if (r?.errore) { rispostaFissa(r.errore, { errore: true }); return r; }
  segnala('fatto');
  mostraFatto({ testo: togli ? t('barra2.ag-scollegato', { nome: a.nome }) : r.uguale ? t('barra2.ag-gia-collegato', { nome: a.nome }) : t('barra2.ag-collegato', { nome: a.nome }), nota: togli ? t('barra2.ag-tolte-righe') : `${a.nota || ''} ${t('barra2.ag-poi-segui')}`.trim() });
  return r;
}
// a fine turno: se la barra è chiusa la pillola lo propone; se è aperta resta pronto per «cosa ha fatto l'agente»
function arrivaTurno(t) {
  if (!t?.id) return; turniAgenti.set(t.id, t);
  DC.registraTurno(D.codice, t); salva();   // per «Pronto per la discussione»: solo id, nome, agente, orari e file relativi
  if (!t.file.length && !t.comandi && !t.avvisi.length) return;   // un turno di sole parole
  if (A?.aperto || A?.proposta) return;
  const chi = NOMI_AGENTI[t.agente] || t.agente || tn('barra2.l-agente');
  mostraProposta({ tipo: 'agente', titolo: `${chi} · ${t.nome}`, testo: t.avvisi.length ? t.avvisi[0].testo.replace(/`/g, '') : (t.test ? t.dopoTest ? tn('barra2.ag-finito-test-dopo', { n: t.file.length }) : tn('barra2.ag-finito-test-prima', { n: t.file.length }) : tn('barra2.ag-finito-senza-test', { n: t.file.length })), bottone: tn('barra2.guarda'), turno: t });
}
function schedaTurno(t) {
  if (!t) return rispostaFissa(tn('barra2.nessun-turno'));
  const chi = NOMI_AGENTI[t.agente] || t.agente || tn('barra2.l-agente');
  const es = t.ultimoTest ? (t.ultimoTest.codice == null ? tn('barra2.esito-non-noto') : t.ultimoTest.codice === 0 ? tn('barra2.riuscito') : tn('barra2.fallito-codice', { codice: t.ultimoTest.codice })) : '';
  const s = scheda('ld-turno-ag', `<span class="ld-lbl">${esc(chi)} · ${esc(t.nome)}${t.fine ? ' · ' + tn('barra2.alle', { ora: esc(PR.ora(t.fine)) }) : ''}</span>
    ${t.avvisi.map(a => `<p class="avviso">${PR.md(a.testo)}</p>`).join('')}
    <p>${t.file.length ? tn('barra2.file-toccati', { n: t.file.length, elenco: t.file.slice(0, 8).map(f => `<code>${esc(f)}</code>`).join(', ') + (t.file.length > 8 ? '…' : '') }) : tn('barra2.nessun-file-toccato', { n: t.file.length })}</p>
    <p>${tn('barra2.comandi', { n: t.comandi })} · ${t.test ? (t.dopoTest ? tn('barra2.test-lanciati-dopo', { n: t.test, comando: esc(t.ultimoTest.comando), esito: esc(es) }) : tn('barra2.test-lanciati-prima', { n: t.test, comando: esc(t.ultimoTest.comando), esito: esc(es) })) : tn('barra2.nessun-test-lanciato')}.</p>
    ${t.messaggio ? `<blockquote>${esc(t.messaggio.slice(0, 300))}${t.messaggio.length > 300 ? '…' : ''}</blockquote>` : ''}
    <div class="az"><button type="button" class="btn primary" data-c>${tn('barra2.cosa-cambiato')}</button><button type="button" class="btn" data-p>${tn('barra2.prova-tu')}</button>${DC.daSpiegare(t) ? `<button type="button" class="btn" data-d>${tn('barra2.preparati-discussione')}</button>` : ''}</div>
    <p class="ld-nota">${tn('barra2.parole-agente')}</p>`);
  s.querySelector('[data-c]').addEventListener('click', () => { nuovoTurno(); detto(A.turno, tn('barra2.cosa-cambiato')); PR.schedaCambia(t.id); });
  s.querySelector('[data-p]').addEventListener('click', () => { nuovoTurno(); detto(A.turno, tn('barra2.prova-il-progetto')); PR.prova(t.id); });
  s.querySelector('[data-d]')?.addEventListener('click', () => { nuovoTurno(); detto(A.turno, tn('barra2.preparati-discussione')); PR.discussione(t.id); });
  PR.coseNuoveDi(t.id).then(l => PR.mostraCoseNuove(s, l));   // le funzioni di libreria nuove nelle righe aggiunte (glossario.js)
  if (A.turno) A.turno.dataset.sintesi = tn('barra2.sintesi-turno', { chi, n: t.file.length });
}
if (BRIDGE) { BRIDGE.su('agente:turno', arrivaTurno); BRIDGE.invoca('agenti:stato').then(st => st?.agenti?.forEach(a => { NOMI_AGENTI[a.id] = a.nome; })).catch(() => { }); }

/* ---------- Ripasso in tasca (js/tasca.js) ---------- */
// le carte di domani in In tasca.md, da fare sul telefono con Obsidian: quando la nota torna, le spunte diventano ripasso.
// Il comando fa sempre un giro (segna le spunte e riscrive); «… ogni sera» lo fa da solo dopo le 19. Una copia vecchia della
// nota (sync in ritardo) non segna niente: si riscrive solo se lo studente lo chiede, e le spunte di quella copia si perdono
const N_CARTE = n => `${n} ${n === 1 ? 'carta' : 'carte'}`;
async function schedaTasca(c = {}, { riscrivi = false } = {}) {
  if (!V.attivo) return rispostaFissa('Il ripasso in tasca va nell\'app: serve il vault di Obsidian.');
  if (c.sera === false) { TA.sera(false); return mostraFatto({ testo: 'Ripasso in tasca solo quando lo chiedi.', nota: 'La nota In tasca.md resta nel vault: scrivi «ripasso in tasca» per aggiornarla.', sintesi: 'ripasso in tasca spento' }); }
  if (c.sera === true) TA.sera(true);
  modo('pensa', 'Preparo la nota…');
  let r; try { r = await TA.aggiorna({ forza: true, riscrivi }); } catch (e) { r = { saltata: 'errore', errore: e.message }; }
  modo('riposo');
  if (r.segnate) aggiornaTutto();
  if (r.saltata === 'errore') return rispostaFissa('Non riesco a leggere o scrivere la nota In tasca.md: ' + r.errore, { errore: true });
  if (r.saltata === 'estranea') return rispostaFissa('Nel vault c\'è già una nota **In tasca.md** che non ha scritto Lode: non la tocco. Rinominala e riprova.');
  const segnate = !r.segnate ? '' : r.segnate === 1 ? `Ho segnato la carta che hai fatto sul telefono: ${r.sapevo ? 'la sapevi' : 'non la sapevi'}.` : `Ho segnato ${r.segnate} carte che hai fatto sul telefono: ${r.sapevo} sapevi, ${r.segnate - r.sapevo} no.`;
  const gia = !r.gia ? '' : r.gia === 1 ? 'Una carta l\'avevi già ripassata sul computer: non la segno due volte.' : `${r.gia} carte le avevi già ripassate sul computer: non le segno due volte.`;
  const vecchia = r.saltata === 'vecchia', cambia = r.saltata === 'cambiata';
  const dentro = vecchia ? 'La nota sul telefono è di un giro vecchio: non segno niente.' : cambia ? 'La nota sta ancora cambiando: Obsidian la sta sincronizzando. Non la riscrivo adesso, riprova tra un minuto.'
    : r.scritte ? `Nella nota In tasca.md ${r.scritte === 1 ? 'c\'è' : 'ci sono'} ${N_CARTE(r.scritte)} per domani.` : 'Domani non hai carte da ripassare: la nota In tasca.md lo dice.';
  const sera = () => TA.stato().sera;
  const s = scheda('ld-tasca', `<span class="ld-lbl">Ripasso in tasca</span>
    ${segnate ? `<p>${esc(segnate)}</p>` : ''}${gia ? `<p>${esc(gia)}</p>` : ''}<p>${esc(dentro)}</p>
    ${vecchia ? '<p class="ld-nota">Aspetta che il telefono finisca di sincronizzare e riprova. Se la nota giusta non arriva, riscrivila: le spunte di quella copia non le segno.</p>' : ''}
    <div class="az"><button type="button" class="btn primary" data-t="apri">Apri la nota</button>${vecchia ? '<button type="button" class="btn" data-t="riscrivi">Riscrivi la nota</button>' : ''}<button type="button" class="btn" data-t="sera">${sera() ? 'Solo quando lo chiedo' : 'Ogni sera'}</button></div>
    <p class="ld-nota" data-sera>${sera() ? 'Ogni sera dopo le 19 la riscrivo da sola, se Lode è aperto.' : ''}</p>
    <p class="ld-nota">Funziona se il vault arriva sul telefono (iCloud, Obsidian Sync, Syncthing). Lode non usa la rete: la nota la porta il servizio che usi già.</p>`);
  s.querySelector('[data-t=apri]').addEventListener('click', () => TA.apri()?.catch(e => rispostaFissa('Non riesco ad aprire la nota: ' + e.message, { errore: true })));
  s.querySelector('[data-t=riscrivi]')?.addEventListener('click', () => { nuovoTurno(); detto(A.turno, 'Riscrivi la nota In tasca.md'); schedaTasca({}, { riscrivi: true }); });
  s.querySelector('[data-t=sera]').addEventListener('click', e => {
    TA.sera(!sera()); e.target.textContent = sera() ? 'Solo quando lo chiedo' : 'Ogni sera';
    s.querySelector('[data-sera]').textContent = sera() ? 'Ogni sera dopo le 19 la riscrivo da sola, se Lode è aperto.' : 'La riscrivo solo quando me lo chiedi.';
  });
  if (A.turno) A.turno.dataset.sintesi = 'ripasso in tasca';
}
// all'avvio, col vault pronto: il giro solo se la nota c'è o la sera è accesa; poi il timer della sera (js/tasca.js)
if (V.attivo) TA.avvia(r => { if (r?.segnate) aggiornaTutto(); });

/* ---------- Moodle in sola lettura (desktop/moodle.mjs): corsi, file nuovi, scadenze ---------- */
const nomeMoodle = st => st?.nome || st?.sito || 'Moodle';
async function schedaMoodle(cosa = null) {
  if (!BRIDGE) return rispostaFissa('Il collegamento a Moodle è nell\'**app desktop** di Lode.');
  let st; try { st = await BRIDGE.invoca('moodle:stato'); } catch (e) { return rispostaFissa('Moodle non risponde: ' + e.message, { errore: true }); }
  if (cosa === 'scollega') { if (!st.collegato) return rispostaFissa('Moodle non è collegato.'); await BRIDGE.invoca('moodle:scollega'); return mostraFatto({ testo: 'Moodle scollegato.', nota: 'Il token è cancellato da questo computer. I file già presi restano nel tuo vault.' }); }
  if (!st.collegato) return collegaMoodle(st);
  if (cosa === 'corsi' || !Object.keys(st.corsi || {}).length) return corsiMoodle(st);
  if (cosa === 'novita') return novitaMoodle(st);
  if (cosa === 'scadenze') return scadenzeMoodle(st);
  const s = scheda('ld-moodle', `<span class="ld-lbl">Moodle · ${esc(nomeMoodle(st))}</span>
    <p>${esc(st.utente || '')}${st.utente ? ' · ' : ''}${Object.keys(st.corsi).length} ${Object.keys(st.corsi).length === 1 ? 'corso seguito' : 'corsi seguiti'}: ${esc(Object.values(st.corsi).join(', '))}</p>
    <div class="az"><button type="button" class="btn primary" data-m="novita">File nuovi</button><button type="button" class="btn" data-m="scadenze">Scadenze</button><button type="button" class="btn" data-m="corsi">Corsi</button><button type="button" class="btn ld-piano" data-m="scollega">Scollega</button></div>
    ${st.memoria ? '<p class="ld-nota">Questo computer non ha un portachiavi: il collegamento vale fino a quando chiudi Lode.</p>' : ''}`);
  s.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { nuovoTurno(); detto(A.turno, { novita: 'Novità da Moodle', scadenze: 'Scadenze', corsi: 'Corsi di Moodle', scollega: 'Scollega Moodle' }[b.dataset.m]); schedaMoodle(b.dataset.m); }));
  if (A.turno) A.turno.dataset.sintesi = `Moodle · ${nomeMoodle(st)}`;
}
function collegaMoodle() {
  const s = scheda('ld-moodle', `<span class="ld-lbl">Collega Moodle</span>
    <p>La piattaforma dei corsi del tuo ateneo (Virtuale, Ariel, e-learning…): Lode prende i file nuovi e le scadenze dei corsi che scegli. Solo lettura: non consegna niente e non scrive niente.</p>
    <form class="ld-riga-form" data-sito><input name="s" placeholder="Indirizzo, per esempio virtuale.unibo.it" aria-label="Indirizzo di Moodle" required autocomplete="off" spellcheck="false"><button class="btn primary" type="submit">Continua</button></form>
    <div class="passo"></div>
    <p class="ld-nota">Entri come nell'app Moodle ufficiale. Il collegamento resta cifrato su questo computer, mai nel vault; con «scollega moodle» lo togli.</p>`);
  const passo = s.querySelector('.passo'), inp = s.querySelector('[data-sito] input');
  s.querySelector('[data-sito]').addEventListener('submit', async ev => {
    ev.preventDefault(); const indirizzo = inp.value.trim(); if (!indirizzo) return;
    passo.innerHTML = '<p class="ld-nota">Cerco il sito…</p>';
    const v = await BRIDGE.invoca('moodle:verifica', indirizzo).catch(e => ({ ok: false, motivo: e.message }));
    if (!v.ok) { passo.innerHTML = `<p class="ld-nota">${v.motivo === 'indirizzo' ? 'Questo non sembra un indirizzo.' : `Non trovo un Moodle con l'app attiva a questo indirizzo (${esc(v.motivo)}). Copia l'indirizzo dalla barra del browser quando sei sulla pagina dei tuoi corsi.`}</p>`; return; }
    const fatto = async r => {
      if (!r.ok) { passo.querySelector('.esito').textContent = r.motivo === 'finestra chiusa' ? 'Accesso annullato.' : `Accesso non riuscito: ${r.motivo}.`; passo.querySelectorAll('button').forEach(b => { b.disabled = false; }); return; }
      segnala('fatto'); nuovoTurno(); detto(A.turno, 'Corsi di Moodle'); corsiMoodle(r);
    };
    if (v.tipo === 'browser') {
      passo.innerHTML = `<p><b>${esc(v.nome)}</b> · si entra con il login dell'ateneo (SPID o le credenziali d'ateneo), in una finestra di Lode.</p><div class="az"><button type="button" class="btn primary" data-sso>Accedi</button></div><p class="ld-nota esito"></p>`;
      passo.querySelector('[data-sso]').addEventListener('click', async e => { e.target.disabled = true; passo.querySelector('.esito').textContent = 'Accedi nella finestra che si è aperta…'; fatto(await BRIDGE.invoca('moodle:accediBrowser', indirizzo).catch(x => ({ ok: false, motivo: x.message }))); });
    } else {
      passo.innerHTML = `<p><b>${esc(v.nome)}</b> · accesso con utente e password di Moodle.</p><form class="ld-riga-form" data-pw><input name="u" placeholder="Utente" aria-label="Utente" autocomplete="username" required><input name="p" type="password" placeholder="Password" aria-label="Password" autocomplete="current-password" required><button class="btn primary" type="submit">Accedi</button></form><p class="ld-nota esito">La password va solo a Moodle: Lode non la salva.</p>`;
      passo.querySelector('[data-pw]').addEventListener('submit', async e => {
        e.preventDefault(); const f = new FormData(e.target); passo.querySelectorAll('button').forEach(b => { b.disabled = true; });
        const r = await BRIDGE.invoca('moodle:accedi', { indirizzo, utente: String(f.get('u')), password: String(f.get('p')) }).catch(x => ({ ok: false, motivo: x.message }));
        e.target.reset(); fatto(r);
      });
    }
    entra(passo, { dy: 4, blur: 4, ms: 320 });
  });
  requestAnimationFrame(() => inp.focus({ preventScroll: true }));
  if (A.turno) A.turno.dataset.sintesi = 'collega Moodle';
}
// quali corsi seguire e con che nome in Lode: proposto dal nome dell'esame o del corso che Lode conosce già
async function corsiMoodle(st) {
  modo('pensa', 'Leggo i tuoi corsi…');
  let corsi; try { corsi = await BRIDGE.invoca('moodle:corsi'); } catch (e) { modo('riposo'); return rispostaFissa('Non riesco a leggere i corsi: ' + e.message, { errore: true }); }
  modo('riposo');
  if (!corsi.length) return rispostaFissa('Su Moodle non risulti iscritto a nessun corso.');
  const noti = [...new Set([...daFare().map(e => e.nome), ...corsiPossibili()])], adesso = Date.now();
  const proposta = k => st.corsi?.[k.id] || trovaEsame(k.nome, { anche: 'daFare' })?.nome || trovaEsame(k.breve || '', { anche: 'daFare' })?.nome || noti.find(n => norm(k.nome).includes(norm(n)) && norm(n).length >= 4) || '';
  const attivi = [...corsi].sort((a, b) => (b.fine === 0 || b.fine > adesso) - (a.fine === 0 || a.fine > adesso));
  const s = scheda('ld-moodle', `<span class="ld-lbl">Corsi di Moodle · ${esc(nomeMoodle(st))}</span>
    <p>Scegli quali seguire e con quale corso di Lode: i loro file nuovi arrivano qui.</p>
    <div class="ld-corsi-m">${attivi.slice(0, 40).map(k => { const p = proposta(k); return `<label><span><b>${esc(k.nome)}</b>${k.fine && k.fine < adesso ? '<small>concluso</small>' : ''}</span><select data-k="${esc(k.id)}" aria-label="Corso di Lode per ${esc(k.nome)}"><option value="">Non seguire</option>${[...new Set([p, ...noti].filter(Boolean))].map(n => `<option${n === p ? ' selected' : ''}>${esc(n)}</option>`).join('')}<option value="__nuovo">Con il nome di Moodle</option></select></label>`; }).join('')}</div>
    <div class="az"><button type="button" class="btn primary" data-salva>Salva</button></div>`);
  s.querySelector('[data-salva]').addEventListener('click', async () => {
    const scelta = {}; s.querySelectorAll('select[data-k]').forEach(x => { const k = corsi.find(c => String(c.id) === x.dataset.k); if (x.value) scelta[x.dataset.k] = x.value === '__nuovo' ? k.nome : x.value; });
    const r = await BRIDGE.invoca('moodle:segui', scelta); segnala('fatto');
    const n = Object.keys(r.corsi || {}).length;
    await mostraFatto({ testo: n ? `Seguo ${n} ${n === 1 ? 'corso' : 'corsi'} su Moodle.` : 'Nessun corso seguito.', nota: n ? 'Ti avviso quando arrivano file nuovi.' : '', azione: n ? ['File nuovi', () => { nuovoTurno(); detto(A.turno, 'Novità da Moodle'); schedaMoodle('novita'); }] : null }, s);
  });
  if (A.turno) A.turno.dataset.sintesi = 'corsi di Moodle';
}
async function novitaMoodle(st) {
  modo('pensa', 'Guardo i file su Moodle…');
  let r; try { r = await BRIDGE.invoca('moodle:novita', { segna: true }); } catch (e) { modo('riposo'); return rispostaFissa('Moodle non risponde: ' + e.message, { errore: true }); }
  modo('riposo'); moodleNuovi = 0;
  const nuovi = r.file.filter(f => f.nuovo), lista = r.primaVolta ? r.file.slice(0, 20) : nuovi.length ? nuovi : r.file.slice(0, 8);
  if (!r.file.length) return rispostaFissa(r.errori?.length ? `Non riesco a leggere ${r.errori.map(x => x.corso).join(', ')}: ${r.errori[0].errore}.` : 'Nei corsi che segui non ci sono ancora file.');
  const s = scheda('ld-moodle', `<span class="ld-lbl">Moodle · ${r.primaVolta ? 'i file più recenti' : nuovi.length ? `${nuovi.length} ${nuovi.length === 1 ? 'file nuovo' : 'file nuovi'}` : 'niente di nuovo, gli ultimi file'}</span>
    <ul class="ld-file-m">${lista.map(f => `<li><span class="t"><b>${esc(f.nome)}</b><small>${esc(f.corso)}${f.modulo && f.modulo !== f.nome ? ' · ' + esc(f.modulo) : ''} · ${esc(dataBreve(isoDi(f.quando)))}${f.mb >= .1 ? ` · ${esc(num(f.mb))} MB` : ''}${f.nuovo && !r.primaVolta ? ' · <em>nuovo</em>' : ''}</small></span><button type="button" class="btn small" data-i="${f.i}">Apri</button></li>`).join('')}</ul>
    <p class="ld-nota">«Apri» lo porta in Lode come se lo avessi trascinato: carte, riassunto, programma, quiz.</p>`);
  s.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'Scarico…';
    const x = await BRIDGE.invoca('moodle:scarica', +b.dataset.i).catch(e => ({ ok: false, motivo: e.message }));
    if (!x.ok) { b.textContent = 'Non riesco'; b.title = x.motivo; return; }
    b.textContent = 'Aperto';
    const file = new File([x.dati], x.nome, { type: x.mime || '' });
    nuovoTurno(); detto(A.turno, `${x.nome} da Moodle`);
    try { schedaFile(await FILE.classifica(file), { corso: x.corso }); } catch (e) { rispostaFissa('Non riesco a leggere il file: ' + e.message, { errore: true }); }
  }));
  if (A.turno) A.turno.dataset.sintesi = `Moodle: ${nuovi.length} file nuovi`;
}
async function scadenzeMoodle() {
  let ev; try { ev = await BRIDGE.invoca('moodle:scadenze'); } catch (e) { return rispostaFissa('Moodle non risponde: ' + e.message, { errore: true }); }
  if (!ev.length) return rispostaFissa('Nessuna scadenza su Moodle nelle prossime settimane.');
  const s = scheda('ld-moodle', `<span class="ld-lbl">Scadenze su Moodle</span><ul class="ld-file-m">${ev.slice(0, 20).map(e => `<li><span class="t"><b>${esc(e.nome)}</b><small>${esc(e.corso)}</small></span><span class="q">${esc(traQuanto(isoDi(e.quando)))}<small>${esc(dataBreve(isoDi(e.quando)))}</small></span></li>`).join('')}</ul>`);
  if (A.turno) A.turno.dataset.sintesi = `${ev.length} scadenze`;
}
// ogni tanto, con Lode aperto: se nei corsi seguiti ci sono file nuovi, la pillola lo propone (una volta per gruppo di file)
let moodleNuovi = 0;
async function controllaMoodle() {
  if (!BRIDGE || A?.proposta || A?.aperto) return;
  try {
    const st = await BRIDGE.invoca('moodle:stato'); if (!st.collegato || !Object.keys(st.corsi || {}).length || !st.ultimo) return;
    const r = await BRIDGE.invoca('moodle:novita'), nuovi = r.file.filter(f => f.nuovo);
    if (!nuovi.length || nuovi.length === moodleNuovi) return;
    moodleNuovi = nuovi.length;
    const corsi = [...new Set(nuovi.map(f => f.corso))];
    mostraProposta({ tipo: 'moodle', titolo: `Moodle · ${corsi.slice(0, 2).join(', ')}${corsi.length > 2 ? '…' : ''}`, testo: `${nuovi.length} ${nuovi.length === 1 ? 'file nuovo' : 'file nuovi'}`, bottone: 'Guarda' });
  } catch { }
}
if (BRIDGE) { setTimeout(controllaMoodle, 90e3); setInterval(controllaMoodle, 3 * 3600e3); }

/* ---------- il quiz a crocette (js/crocette.js): allenamento o simulazione d'esame ---------- */
// il materiale dello studente in testo, per l'AI: carte, definizioni, ★ e domande uscite
function testoDelCorso(e, mat = PG.materialeDi(e)) {
  return [mat.definizioni.map(d => `– ${d.testo}`).join('\n'), mat.stelle.map(x => `– ★ ${x}`).join('\n'), mat.carte.map(c => `– ${c.fronte} → ${c.retro}`).join('\n'),
    (e.programma?.argomenti || []).flatMap(a => (a.domande || []).map(d => `– Domanda uscita (${a.t}): ${d.t}`)).join('\n')].filter(Boolean).join('\n');
}
async function schedaCrocette(c = {}) {
  let e = c.esame;
  if (!e && c.nomeDetto && !c.materiale) return rispostaFissa(`Non trovo l'esame **${c.nomeDetto}**.`);
  e ||= c.materiale ? null : prossimi()[0] || daFare()[0] || null;
  const nome = e?.nome || c.nomeFile || 'il tuo materiale', mat = e ? PG.materialeDi(e) : { carte: [], definizioni: [], stelle: [] };
  const offline = QC.daMateriale(mat, { n: 30 }).length, testo = c.materiale || (e ? testoDelCorso(e, mat) : '');
  const conAI = AI.attiva() && testo.length > 300;
  if (!conAI && offline < 4) return rispostaFissa(AI.attiva() || c.materiale
    ? `Per un quiz su **${nome}** mi serve più materiale: trascina la dispensa o le slide (scegli «Quiz a crocette»), oppure crea qualche carta.`
    : `Per il quiz senza AI mi servono almeno 4 carte o 4 definizioni di **${nome}**. Con l'AI (scrivi «AI») lo faccio anche dalla dispensa.`);
  const max = conAI ? 30 : Math.min(30, offline);
  const da = c.materiale ? `dalla dispensa ${c.nomeFile ? '«' + c.nomeFile + '»' : ''}` : conAI ? 'dalle tue carte, definizioni e domande uscite' : `dalle tue ${mat.carte.length ? 'carte' : ''}${mat.carte.length && mat.definizioni.length ? ' e ' : ''}${mat.definizioni.length ? 'definizioni' : ''}`;
  const s = scheda('ld-quiz-via', `<span class="ld-lbl">Quiz a crocette · ${esc(nome)}</span>
    <div class="ld-opzioni">
      <button type="button" class="ld-op primo" data-n="${Math.min(10, max)}"><b>Allenamento · ${Math.min(10, max)} domande</b><span>La correzione subito, con la spiegazione</span></button>
      <button type="button" class="ld-op" data-n="${max}" data-sim><b>Simulazione d'esame · ${max} domande in ${max} minuti</b><span>Come allo scritto: il tempo scorre, la correzione alla fine, il voto in trentesimi</span></button>
    </div>
    <p class="ld-nota">Domande ${esc(da)}.${conAI ? ` Le scrive ${esc(AI.nomeMotore('testo'))}: tengo solo quelle che il materiale dimostra.` : ' Le risposte sbagliate sono quelle di altre carte del corso.'}</p>`);
  s.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', async () => {
    s.querySelectorAll('[data-n]').forEach(x => { x.disabled = true; x.classList.toggle('scelta', x === b); });
    const n = +b.dataset.n, sim = b.hasAttribute('data-sim');
    nuovoTurno(); detto(A.turno, sim ? `Simulazione d'esame · ${nome}` : `Quiz · ${nome}`);
    let domande = [], scartate = 0;
    if (conAI) {
      const parti = QC.pezzi(testo, Math.ceil(n / 10)), lista = parti.length ? parti : [testo];
      try {
        for (let k = 0; domande.length < n && k < lista.length + 2; k++) {
          modo('pensa', `Preparo le domande… ${domande.length} di ${n}`); segnala('pensa');
          const pezzo = lista[k % lista.length];
          const v = QC.valida(await AI.crocette({ nome, materiale: pezzo, n: Math.min(12, n - domande.length + 2), fatte: domande.map(q => q.domanda) }), pezzo);
          scartate += v.scartate; const viste = new Set(domande.map(q => norm(q.domanda)));
          domande.push(...v.domande.filter(q => !viste.has(norm(q.domanda))));
        }
      } catch (err) { console.warn('Lode: quiz con l\'AI', err); if (!domande.length && offline < 4) { modo('riposo'); return rispostaFissa('Non riesco a preparare le domande: ' + err.message, { errore: true }); } }
      modo('riposo');
    }
    if (domande.length < n) domande.push(...QC.daMateriale(mat, { n: n - domande.length }));
    domande = domande.slice(0, n);
    if (!domande.length) return rispostaFissa('Non sono riuscito a preparare domande affidabili da questo materiale.');
    giocaQuiz({ e, nome, domande, simulazione: sim, minuti: domande.length, scartate });
  }));
  if (A.turno) A.turno.dataset.sintesi = `quiz di ${nome}`;
  if (c.simulazione) s.querySelector('[data-sim]').click();
}
function giocaQuiz({ e, nome, domande, simulazione, minuti, scartate = 0 }) {
  const N = domande.length, scelte = new Array(N).fill(null), t0 = Date.now(), scade = simulazione ? t0 + minuti * 60e3 : null;
  let i = 0, finito = false, mostrata = false, tic = 0;
  const s = scheda('ld-quiz', `<div class="capo"><span class="ld-lbl">${simulazione ? 'Simulazione' : 'Quiz'} · ${esc(nome)}</span><span class="conto"></span></div><i class="ld-prog"><i></i></i><div class="box"></div>`);
  const box = s.querySelector('.box'), conto = s.querySelector('.conto'), pr = s.querySelector('.ld-prog i');
  const mmss = ms => { const x = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };
  const aggiornaConto = () => { const fatte = scelte.filter(x => x != null).length; conto.textContent = simulazione ? `${mmss(scade - Date.now())} · ${fatte} di ${N}` : `${i + 1} di ${N}`; };
  if (simulazione) tic = setInterval(() => { if (!s.isConnected) { clearInterval(tic); if (A.quiz?.card === s) A.quiz = null; return; } aggiornaConto(); if (Date.now() >= scade) consegna(true); }, 1000);
  const mostra = () => {
    const q = domande[i]; mostrata = false;
    pr.style.transform = `scaleX(${(simulazione ? scelte.filter(x => x != null).length / N : i / N).toFixed(4)})`; aggiornaConto();
    box.innerHTML = `<p class="dom"><small>Domanda ${i + 1} di ${N}</small>${esc(q.domanda)}</p>
      <div class="ld-opz">${q.opzioni.map((o, j) => `<button type="button" class="ld-oq${scelte[i] === j ? ' scelta' : ''}" data-j="${j}"><kbd>${'ABCD'[j]}</kbd><span>${esc(o)}</span></button>`).join('')}</div>
      <p class="spieg" hidden></p>
      <div class="az">${simulazione ? `${i > 0 ? '<button type="button" class="btn ld-piano" data-prec>Indietro</button>' : ''}<button type="button" class="btn ld-piano" data-salta>${i < N - 1 ? 'Salta' : 'Lascia vuota'}</button><button type="button" class="btn" data-consegna>Consegna</button>` : ''}</div>`;
    box.querySelectorAll('[data-j]').forEach(b => b.addEventListener('click', () => scegli(+b.dataset.j)));
    box.querySelector('[data-prec]')?.addEventListener('click', () => { i--; mostra(); });
    box.querySelector('[data-salta]')?.addEventListener('click', () => avanti());
    box.querySelector('[data-consegna]')?.addEventListener('click', () => consegna(false));
    entra(box, { dy: 6, blur: 6, ms: 380 });
  };
  const avanti = () => { if (finito) return; if (i < N - 1) { i++; mostra(); } else if (simulazione) { const vuote = scelte.filter(x => x == null).length; vuote ? (i = scelte.indexOf(null), mostra()) : consegna(false); } else consegna(false); };
  const scegli = j => {
    if (finito || j < 0 || j > 3) return;
    const q = domande[i];
    if (simulazione) { scelte[i] = j; box.querySelectorAll('[data-j]').forEach(b => b.classList.toggle('scelta', +b.dataset.j === j)); aggiornaConto(); dopo(220, () => { if (!finito) avanti(); }); return; }
    if (mostrata) return; mostrata = true; scelte[i] = j;
    const ok = j === q.giusta;
    box.querySelectorAll('[data-j]').forEach(b => { b.disabled = true; const k = +b.dataset.j; if (k === q.giusta) b.classList.add('giusta'); else if (k === j) b.classList.add('errata'); });
    const sp = box.querySelector('.spieg'); if (q.spiegazione || !ok) { sp.hidden = false; sp.textContent = q.spiegazione || `La risposta giusta è la ${'ABCD'[q.giusta]}.`; entra(sp, { dy: 4, blur: 4, ms: 320 }); }
    box.querySelector('.az').innerHTML = `<button type="button" class="btn primary" data-av>${i < N - 1 ? 'Avanti' : 'Risultato'} <kbd>Invio</kbd></button>`;
    box.querySelector('[data-av]').addEventListener('click', avanti);
    segnala(ok ? 'fatto' : 'quiete');
  };
  const consegna = scaduto => {
    if (finito) return; finito = true; clearInterval(tic); if (A.quiz?.card === s) A.quiz = null;
    const giuste = domande.filter((q, k) => scelte[k] === q.giusta).length, v = QC.voto(giuste, N), sbagliate = domande.map((q, k) => ({ q, k })).filter(x => scelte[x.k] !== x.q.giusta);
    pr.style.transform = 'scaleX(1)'; conto.textContent = `${giuste} di ${N}`;
    // l'esito sugli argomenti del programma: la parte di domande giuste per argomento
    if (PG.programmaDi(e)) {
      const per = new Map();
      domande.forEach((q, k) => { const a = PG.abbina(`${q.domanda} ${q.opzioni[q.giusta]}`, e.programma.argomenti); if (a) { const x = per.get(a.id) || { g: 0, t: 0 }; x.t++; if (scelte[k] === q.giusta) x.g++; per.set(a.id, x); } });
      for (const [id, x] of per) PG.registraEsito(e, id, x.g / x.t >= .8 ? 'giusta' : x.g / x.t >= .5 ? 'parziale' : 'sbagliata', 'quiz');
    }
    box.innerHTML = `<div class="ld-esito"><b>${esc(giuste)}<small>/${esc(N)}</small></b><span>${simulazione ? `Voto: <em>${esc(v.testo)}</em>${scaduto ? ' · tempo scaduto' : ''}` : giuste === N ? 'Tutte giuste.' : `${N - giuste} da rivedere.`}</span><small>${esc(Math.max(1, Math.round((Date.now() - t0) / 60e3)))} min${scartate ? ` · ${scartate} domande scartate perché il materiale non le dimostrava` : ''}</small></div>
      ${sbagliate.length ? `<span class="ld-lbl">Da rivedere</span><ol class="ld-sbagliate">${sbagliate.slice(0, 30).map(({ q, k }) => `<li><b>${esc(q.domanda)}</b><span>${scelte[k] == null ? 'Lasciata vuota' : `Hai scelto: ${esc(q.opzioni[scelte[k]])}`}</span><span class="g">Giusta: ${esc(q.opzioni[q.giusta])}</span>${q.spiegazione ? `<small>${esc(q.spiegazione)}</small>` : ''}</li>`).join('')}</ol>` : ''}
      <div class="az">${sbagliate.length && e ? '<button type="button" class="btn primary" data-carte>Le sbagliate diventano carte</button>' : ''}<button type="button" class="btn" data-ancora>Un altro quiz</button></div>
      <p class="ld-nota">Una risposta giusta vale 1 punto, sbagliata o vuota 0. ${simulazione ? 'Lo scritto vero può avere regole diverse (penalità per le sbagliate, soglie): è un allenamento.' : ''}</p>`;
    entra(box, { dy: 8, blur: 6, ms: 480 }); segnala(v.superato ? 'confermato' : 'quiete');
    box.querySelector('[data-carte]')?.addEventListener('click', ev => {
      for (const { q } of sbagliate) aggiungiCarta({ esameId: e.id, fronte: q.domanda, retro: q.opzioni[q.giusta] + (q.spiegazione ? `\n\n${q.spiegazione}` : '') });
      salva(); ev.target.disabled = true; ev.target.textContent = `${sbagliate.length} carte aggiunte: tornano oggi nel ripasso`; aggiornaTutto();
    });
    box.querySelector('[data-ancora]').addEventListener('click', () => { nuovoTurno(); detto(A.turno, `Quiz · ${nome}`); schedaCrocette({ esame: e }); });
    if (A.turno) A.turno.dataset.sintesi = `quiz di ${nome}: ${giuste} su ${N}`;
    aggiornaTutto();
  };
  A.quiz = { card: s, scegli, avanti: () => { if (!simulazione && mostrata) avanti(); } };
  campo.querySelector('input').blur();   // i tasti A-D e 1-4 rispondono subito
  mostra();
}

/* ---------- Temi d'esame (js/temi.js) ---------- */
// gli esercizi dei compiti vecchi: la scheda di controllo (divisi, con l'argomento), l'esercizio di oggi e l'esito, che
// sceglie lo studente. Lode non corregge: il voto se lo dà chi l'ha fatto su carta. La soluzione del prof solo dopo
const minuscola = t => t.charAt(0).toLowerCase() + t.slice(1);
const argDi = (e, x) => x?.a ? e.programma?.argomenti?.find(a => a.id === x.a) || null : null;
// «es. 3 del 12/02/2024 · integrali doppi · circa 25 min su carta»
function rigaTema(e, x) {
  const da = x.data ? ` del ${TE.dataScritta(x.data)}` : x.fonte && x.fonte !== 'incollato' ? ` di «${x.fonte}»` : '';
  return [x.es ? `es. ${x.es}${da}` : da.trim(), argDi(e, x) && minuscola(argDi(e, x).t), `circa ${TE.minuti(x.t)} min su carta`].filter(Boolean).join(' · ');
}
async function temiDaFile(x, corso) {
  modo('pensa', `Leggo ${x.nome}…`); segnala('pensa');
  let testo = ''; try { testo = await FILE.testoDi(x); } catch { }   // un PDF senza testo: niente errore, lo diciamo sotto
  modo('riposo');
  // il comando da suggerire col corso giusto; senza corso e senza esami, la forma generica (mai un corso inventato)
  const nome = corso || prossimi()[0]?.nome, cmd = nome ? `«temi d'esame di ${minuscola(nome)}:»` : '«temi d\'esame:»';
  const pagine = Math.max(1, ...[...testo.matchAll(/\[Pagina (\d+)\]/g)].map(m => +m[1]));
  if (x.tipo === 'pdf' && TE.scansione(testo, pagine)) return rispostaFissa(`Questo PDF sembra una scansione: senza AI non leggo le immagini. Incolla il testo degli esercizi con ${cmd} e il testo sotto.`);
  if (!testo.trim()) return rispostaFissa(`Da questo file non riesco a leggere il testo. Incollalo con ${cmd} e il testo sotto.`);
  const e = trovaEsame(corso || '') || (corso ? aggiungiEsame({ nome: corso }) : prossimi()[0]);
  if (!e) return rispostaFissa('Aggiungi prima l\'esame, per esempio: «esame analisi 2 il 15 gennaio 9 cfu».');
  return controllaTemi(e, testo, { fonte: x.nome });
}
async function schedaTemi(c = {}) {
  let e = c.esame;
  if (!e && c.nomeDetto) return rispostaFissa(`Non trovo l'esame **${c.nomeDetto}**. Aggiungilo prima, per esempio: «esame ${c.nomeDetto} il 15 gennaio 9 cfu».`);
  // senza esame detto: quello con un esercizio in scadenza oggi, poi il più vicino
  e ||= daFare().find(x => TE.temaDiOggi(x)) || prossimi().find(x => x.temi?.length) || prossimi()[0] || daFare()[0];
  if (!e) return rispostaFissa('Aggiungi prima un esame, per esempio: «esame analisi 2 il 15 gennaio 9 cfu». Poi incolla un compito vecchio.');
  if (c.testo) return controllaTemi(e, c.testo, { fonte: 'incollato' });
  const x = TE.temaDiOggi(e), s = x ? schedaTema(e, x) : temiVuoti(e);
  invitoProva(e);
  return s;
}
// sotto la scheda dei temi (fuori dalla scheda dell'esercizio, che resta com'è): il compito intero col tempo vero
function invitoProva(e) {
  if (!PV.compiti(e).length && (e.temi || []).length < 2) return;
  const p = h('p', 'ld-prova-invito', 'Vuoi provare un compito intero, col tempo vero? <button type="button" class="btn small">Prova generale</button>');
  (A.turno || nuovoTurno()).append(p); entra(p, { dy: 4, blur: 4, ms: 360 });
  p.querySelector('button').addEventListener('click', () => { nuovoTurno(); detto(A.turno, `Prova generale di ${e.nome}`); schedaProva({ esame: e }); });
}
// nessun esercizio da fare oggi: quanti ce ne sono per argomento, e il campo per incollare un compito
function temiVuoti(e) {
  const per = TE.conta(e), prossimo = (e.temi || []).map(x => x.scad).sort()[0];
  const s = scheda('ld-temi', `<span class="ld-lbl">Temi d'esame · ${esc(e.nome)}</span>
    ${per.length ? `<p>Nessun esercizio in scadenza oggi.${prossimo ? ` Il prossimo torna ${esc(dataLunga(prossimo))}.` : ''}</p><ul class="ld-temi-conta">${per.map(([t, n]) => `<li><span>${esc(t)}</span><b>${esc(n)}</b></li>`).join('')}</ul>`
      : '<p class="ld-vuoto">Incolla il testo di un compito vecchio (quelli che girano nel gruppo del corso o sul sito del prof), oppure trascina il PDF. Lo divido in esercizi, li metto sotto i loro argomenti e ogni giorno te ne propongo uno.</p>'}
    <form class="ld-prog-form"><textarea name="t" rows="5" placeholder="Esercizio 1. Calcolare…&#10;Esercizio 2. Studiare…" aria-label="Testo del compito" required></textarea><button class="btn${per.length ? '' : ' primary'}" type="submit">Dividi in esercizi</button></form>`);
  s.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); const t = String(new FormData(ev.target).get('t') || ''); if (t.trim()) { nuovoTurno(); detto(A.turno, `Temi d'esame di ${e.nome}`); controllaTemi(e, t, { fonte: 'incollato' }); } });
  if (A.turno) A.turno.dataset.sintesi = `temi d'esame di ${e.nome}`;
}
// la scheda di controllo: i pezzi con le prime due righe e l'argomento; si possono unire o togliere prima di salvarli
function controllaTemi(e, testo, { fonte = 'incollato' } = {}) {
  const d = TE.dividi(testo), argomenti = e.programma?.argomenti || [];
  let pezzi = d.pezzi.map(p => ({ ...p, a: PG.abbina(p.t, argomenti)?.id || null }));
  if (!pezzi.length) return rispostaFissa('Non ho trovato esercizi in questo testo.');
  const s = scheda('ld-temi', `<span class="ld-lbl">Temi d'esame · ${esc(e.nome)}${d.data ? ` · compito ${esc(TE.dataScritta(d.data))}` : ''}</span>
    ${pezzi.length === 1 ? '<p class="ld-nota">Non ho trovato «Esercizio 1», «Esercizio 2»… Se il compito ha più esercizi, scrivili con quei segni e incollalo di nuovo.</p>' : ''}
    ${argomenti.length ? '' : `<p class="ld-nota">Per ${esc(e.nome)} non c'è ancora il programma: li salvo senza argomento.</p>`}
    <ol class="ld-temi-l"></ol>
    <div class="az"><button type="button" class="btn primary" data-metti>Mettili nel piano</button></div>`);
  const ol = s.querySelector('ol');
  const leggi = () => ol.querySelectorAll('select').forEach((x, i) => { pezzi[i].a = x.value || null; });
  const disegna = () => {
    ol.innerHTML = pezzi.map((p, i) => `<li><span class="t"><b>Es. ${esc(p.n)}</b>${esc(p.t.split('\n').filter(r => r.trim()).slice(0, 2).join(' ').slice(0, 220))}${p.sol ? '<small>con la soluzione del prof</small>' : ''}</span>
      <span class="az">${argomenti.length ? `<select aria-label="Argomento dell'esercizio ${esc(p.n)}"><option value="">Che argomento è?</option>${argomenti.map(a => `<option value="${esc(a.id)}"${a.id === p.a ? ' selected' : ''}>${esc(corto(a.t))}</option>`).join('')}</select>` : ''}
      ${i ? '<button type="button" class="btn small ld-piano" data-unisci>Unisci al precedente</button>' : ''}<button type="button" class="btn small ld-piano" data-togli>Togli</button></span></li>`).join('');
    ol.querySelectorAll('li').forEach((li, i) => {
      li.querySelector('[data-unisci]')?.addEventListener('click', () => { leggi(); pezzi = TE.unisci(pezzi, i); disegna(); });
      li.querySelector('[data-togli]').addEventListener('click', () => { leggi(); pezzi.splice(i, 1); disegna(); });
    });
    s.querySelector('[data-metti]').disabled = !pezzi.length;
  };
  disegna();
  s.querySelector('[data-metti]').addEventListener('click', ev => {
    leggi(); ev.target.disabled = true; s.querySelectorAll('button,select').forEach(x => { x.disabled = true; });
    const ann = istantanea(), r = TE.metti(e, pezzi, { fonte, data: d.data, durata: d.durata }), n = r.messi;
    const conArg = argomenti.length ? `: ${n - r.senza} con il loro argomento, ${r.senza} senza` : '';
    mostraFatto(n ? { testo: `${n} ${n === 1 ? 'esercizio' : 'esercizi'} nel piano${conArg}.`, annulla: ann, sintesi: `temi d'esame di ${e.nome}`,
      nota: !argomenti.length ? `Senza programma non so dove metterli: incolla il programma di ${minuscola(e.nome)} e li sistemo.` : r.doppi ? `${r.doppi} c'erano già.` : 'Ogni giorno uno sugli argomenti del piano.',
      azione: !argomenti.length ? ['Programma', () => { nuovoTurno(); programmaVuoto(e); }] : TE.temaDiOggi(e) ? ['Fanne uno', () => { nuovoTurno(); detto(A.turno, `Esercizio di ${e.nome}`); schedaTema(e, TE.temaDiOggi(e)); }] : null }
      : { testo: 'Questi esercizi c\'erano già.', no: true });
    aggiornaTutto();
  });
  if (A.turno) A.turno.dataset.sintesi = `temi d'esame di ${e.nome}: ${pezzi.length} esercizi`;
}
// l'esercizio: il testo con le formule, poi l'esito scelto dallo studente. La soluzione del prof solo dopo l'esito
function schedaTema(e, x) {
  const a = argDi(e, x);
  const s = scheda('ld-tema', `<span class="ld-lbl">Esercizio · ${esc(e.nome)}</span>
    <p class="ld-tema-meta">${esc(rigaTema(e, x))}</p>
    <div class="ld-tema-testo">${mdHtml(x.t)}</div>
    <p>Fallo su carta, senza guardare gli appunti. Quando hai finito:</p>
    <div class="az ld-tema-esiti"><button type="button" class="btn" data-come="giusto">Giusto</button><button type="button" class="btn" data-come="sbagliato">Sbagliato</button><button type="button" class="btn" data-come="nonso">Non sapevo da dove partire</button></div>
    <p class="ld-nota">Il voto te lo dai tu: Lode non corregge l'esercizio.</p>`);
  formuleIn(s.querySelector('.ld-tema-testo'), x.t);
  s.querySelectorAll('[data-come]').forEach(b => b.addEventListener('click', () => {
    const come = b.dataset.come, r = TE.esito(e, x.id, come); if (!r) return;
    s.querySelectorAll('[data-come]').forEach(y => { y.disabled = true; y.classList.toggle('scelta', y === b); });
    const dopoG = `Torna tra ${r.giorni} giorni.`;
    const testo = come === 'giusto' ? dopoG : come === 'sbagliato' ? `${dopoG} ${x.sol ? 'Guarda la soluzione e rifallo da capo, non rileggerla e basta.' : 'Rileggi l\'argomento e rifallo da capo, senza guardare.'}`
      : `${dopoG} Prima rileggi l'argomento${a ? `: ${minuscola(a.t)}` : ''}.`;
    const altro = TE.temaDiOggi(e);
    const f = h('div', 'ld-tema-dopo', `<p>${esc(testo)}</p><div class="az">${x.sol ? '<button type="button" class="btn primary" data-sol>Vedi la soluzione del prof</button>' : ''}${altro ? '<button type="button" class="btn" data-altro>Un altro esercizio</button>' : ''}</div><div class="ld-tema-sol" hidden></div>`);
    s.querySelector('.ld-tema-esiti').after(f); entra(f, { dy: 4, blur: 4, ms: 360 });
    f.querySelector('[data-sol]')?.addEventListener('click', ev => { const box = f.querySelector('.ld-tema-sol'); box.innerHTML = mdHtml(x.sol); box.hidden = false; formuleIn(box, x.sol); ev.target.remove(); entra(box, { dy: 4, blur: 4, ms: 360 }); });
    f.querySelector('[data-altro]')?.addEventListener('click', () => { nuovoTurno(); detto(A.turno, `Esercizio di ${e.nome}`); schedaTema(e, altro); });
    segnala(come === 'giusto' ? 'fatto' : 'quiete'); aggiornaTutto();
    if (A.turno) A.turno.dataset.sintesi = `esercizio di ${e.nome}: ${b.textContent.toLowerCase()}`;
  }));
  if (A.turno) A.turno.dataset.sintesi = `esercizio di ${e.nome}`;
  return s;
}

/* ---------- Prova generale (js/prova.js) ---------- */
// un compito vecchio intero, con il tempo vero: la partenza (che compito, quanti minuti), il testo di tutti gli esercizi
// mentre il timer scorre nella pillola, poi gli esiti scelti dallo studente e solo dopo le soluzioni del prof. Niente voti
let provaS = null;   // la scheda della prova aperta (la fine del tempo la ridisegna lì)
async function schedaProva(c = {}) {
  // una prova già in corso: si riapre quella (anche dopo un ricaricamento)
  const st = PV.inCorso();
  if (st) { const e = esame(st.esameId), comp = e && PV.compitoDi(e, st); if (comp) return provaInCorso(e, comp); PV.togli(); }
  let e = c.esame;
  if (!e && c.nomeDetto) return rispostaFissa(`Non trovo l'esame **${c.nomeDetto}**. Aggiungilo prima, per esempio: «esame ${c.nomeDetto} il 15 gennaio 9 cfu».`);
  e ||= prossimi().find(x => PV.compiti(x).length) || prossimi().find(x => (x.temi || []).length >= 2) || daFare().find(x => PV.compiti(x).length) || prossimi()[0] || daFare()[0];
  if (!e) return rispostaFissa('Aggiungi prima un esame, per esempio: «esame analisi 2 il 15 gennaio 9 cfu». Poi incolla un compito vecchio.');
  if ((e.temi || []).length < 2) return rispostaFissa(`Prima incolla o trascina i compiti vecchi: «temi d'esame di ${minuscola(e.nome)}: …».`);
  const cs = PV.compiti(e);
  return cs.length ? provaPartenza(e, PV.scegli(e), cs) : provaScegli(e);
}
// «Compito del 12/02/2024 · 5 esercizi · 32 punti»
const nomeCompito = c => c.data ? `Compito del ${TE.dataScritta(c.data)}` : c.fonte === 'scelti' ? 'Esercizi scelti da te' : c.fonte && c.fonte !== 'incollato' ? `Compito «${c.fonte}»` : 'Compito incollato';
const rigaCompito = c => [nomeCompito(c), `${c.temi.length} esercizi`, c.punti != null ? `${String(c.punti).replace('.', ',')} punti` : ''].filter(Boolean).join(' · ');
function provaPartenza(e, comp, cs = [comp]) {
  const s = scheda('ld-prova', `<span class="ld-lbl">Prova generale · ${esc(e.nome)}</span>
    <p class="ld-prova-cosa"></p>
    <div class="ld-riga-form ld-prova-dura"><span class="ld-prova-q">Quanto dura?</span><input type="number" min="30" max="240" step="5" inputmode="numeric" aria-label="Quanti minuti dura la prova"><span>minuti</span></div>
    <p class="ld-nota ld-prova-da"></p>
    ${cs.length > 1 ? `<div class="ld-riga-form"><select aria-label="Un altro compito">${cs.map(x => `<option value="${esc(x.chiave)}"${x.chiave === comp.chiave ? ' selected' : ''}>${esc([nomeCompito(x), `${x.temi.length} esercizi`, x.fatto ? `già fatto il ${TE.dataScritta(x.fatto)}` : ''].filter(Boolean).join(' · '))}</option>`).join('')}</select></div>` : ''}
    <div class="az"><button type="button" class="btn primary" data-via>Comincio</button></div>
    <p class="ld-nota">Su carta, senza appunti, come all'esame. Le soluzioni le vedi alla fine.</p>`);
  const inp = s.querySelector('input');
  const mostra = c => {
    comp = c;
    s.querySelector('.ld-prova-cosa').textContent = rigaCompito(c) + (c.fatto ? ` · già fatto il ${TE.dataScritta(c.fatto)}` : '');
    inp.value = PV.minutiDa(c);
    s.querySelector('.ld-prova-da').textContent = c.durata ? 'L\'ho letto nel compito.' : 'Di solito 2 ore.';
  };
  mostra(comp);
  s.querySelector('select')?.addEventListener('change', ev => { const c = cs.find(x => x.chiave === ev.target.value); if (c) mostra(c); });
  s.querySelector('[data-via]').addEventListener('click', () => provaVia(e, comp, Math.max(30, Math.min(240, Math.round(+inp.value) || 120)), s));
  if (A.turno) A.turno.dataset.sintesi = `prova generale di ${e.nome}`;
  return s;
}
// nessun compito intero (almeno 2 esercizi della stessa fonte e data): li sceglie lo studente, al massimo 12
function provaScegli(e) {
  const temi = [...(e.temi || [])].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 12);
  const s = scheda('ld-prova', `<span class="ld-lbl">Prova generale · ${esc(e.nome)}</span>
    <p>Non trovo un compito intero: scegli tu gli esercizi.</p>
    <ul class="ld-prova-scegli">${temi.map(x => `<li><label><input type="checkbox" value="${esc(x.id)}"><span>${esc(x.t.split('\n').find(r => r.trim()).slice(0, 140))}<small>${esc(rigaTema(e, x))}</small></span></label></li>`).join('')}</ul>
    <div class="az"><button type="button" class="btn primary" data-via disabled>Comincio</button></div>
    <p class="ld-nota">120 minuti, su carta, senza appunti. Le soluzioni le vedi alla fine.</p>`);
  const via = s.querySelector('[data-via]'), scelti = () => [...s.querySelectorAll('input:checked')].map(x => x.value);
  s.querySelectorAll('input').forEach(x => x.addEventListener('change', () => { via.disabled = scelti().length < 2; }));
  via.addEventListener('click', () => { const c = PV.daTemi(e, scelti()); if (c && c.temi.length >= 2) provaVia(e, c, 120, s); });
  if (A.turno) A.turno.dataset.sintesi = `prova generale di ${e.nome}`;
  return s;
}
// si parte: se c'è un altro timer acceso lo chiede prima
function provaVia(e, comp, min, s) {
  const T = F.stato();
  if (T && T.fase !== 'prova') {
    const az = s.querySelector('.az');
    az.innerHTML = `<span class="ld-prova-chiede">${T.fase === 'pausa' ? 'C\'è una pausa in corso: la fermo' : 'C\'è un focus acceso: lo fermo'} e parto con la prova?</span><button type="button" class="btn primary" data-si>Sì, parti</button><button type="button" class="btn ld-piano" data-no>No</button>`;
    az.querySelector('[data-si]').addEventListener('click', () => { F.ferma(); provaVia(e, comp, min, s); });
    az.querySelector('[data-no]').addEventListener('click', () => { az.innerHTML = '<button type="button" class="btn primary" data-via>Comincio</button>'; az.querySelector('[data-via]').addEventListener('click', () => provaVia(e, comp, min, s)); });
    return;
  }
  PV.avvia(e, comp, min); F.avvia({ min, esameId: e.id, fase: 'prova' });
  segnala('focus'); aggiornaTutto();
  provaInCorso(e, comp, s);
}
// la prova: tutti gli esercizi, senza soluzioni; dopo la consegna, gli esiti. dove = la scheda da ridisegnare
function provaInCorso(e, comp, dove) {
  const st = PV.inCorso(); if (!st) return null;
  const s = dove?.isConnected ? dove : scheda('ld-prova', ''); provaS = s;
  if (st.consegnata) return provaEsiti(e, comp, s);
  const fine = new Date(st.inizio + st.durata * 60e3), cor = PV.corrente(st), mins = PV.minutiDi(st);
  s.innerHTML = `<span class="ld-lbl">Prova generale · ${esc(e.nome)}</span>
    <p class="ld-tema-meta">${esc(rigaCompito(comp))} · ${esc(st.durata)} minuti, fino alle ${esc(fine.toTimeString().slice(0, 5))}</p>
    <ol class="ld-prova-l">${comp.temi.map((x, i) => `<li class="${i === cor ? 'ora' : i < cor ? 'fatto' : ''}"><span class="ld-prova-n">Esercizio ${esc(x.es ?? i + 1)}${x.punti != null ? ` · ${esc(String(x.punti).replace('.', ','))} punti` : ''}${i < cor && mins[i] != null ? ` · ${esc(mins[i])} min` : ''}</span>
      <div class="ld-tema-testo">${mdHtml(x.t)}</div>${i === cor && i < comp.temi.length - 1 ? '<button type="button" class="btn small ld-piano" data-passo>Passo al prossimo</button>' : ''}</li>`).join('')}</ol>
    <div class="az"><button type="button" class="btn primary" data-consegno>Consegno</button><button type="button" class="btn ld-piano" data-lascio>Lascio perdere</button></div>
    <p class="ld-nota">Il tempo scorre nella pillola. «Passo al prossimo» è facoltativo: segna quanto stai su ogni esercizio.</p>`;
  s.querySelectorAll('.ld-tema-testo').forEach((n, i) => formuleIn(n, comp.temi[i].t));
  s.querySelector('[data-passo]')?.addEventListener('click', () => { PV.passo(); provaInCorso(e, comp, s); s.querySelector('li.ora')?.scrollIntoView({ block: 'nearest', behavior: RIDOTTO ? 'auto' : 'smooth' }); });
  s.querySelector('[data-consegno]').addEventListener('click', () => { PV.consegna(); if (F.stato()?.fase === 'prova') F.ferma(); provaEsiti(e, comp, s); });
  s.querySelector('[data-lascio]').addEventListener('click', () => provaLascio(e, comp, s));
  if (A.turno) A.turno.dataset.sintesi = `prova generale di ${e.nome}`;
  return s;
}
// «Lascio perdere»: per una prova partita per sbaglio. Chiede conferma, poi la toglie e ferma il timer della prova. Non
// scrive niente in e.prove né sui temi: il compito resta «mai fatto» e «prova generale» non la riapre più
function provaLascio(e, comp, s) {
  const az = s.querySelector('.az');
  az.innerHTML = `<span class="ld-prova-chiede">La lascio perdere? Non segno niente: né gli esercizi né il compito.</span><button type="button" class="btn primary" data-si>Sì, lascio perdere</button><button type="button" class="btn ld-piano" data-no>No, continuo</button>`;
  az.querySelector('[data-no]').addEventListener('click', () => (PV.inCorso()?.consegnata ? provaEsiti : provaInCorso)(e, comp, s));
  az.querySelector('[data-si]').addEventListener('click', () => {
    PV.togli(); if (F.stato()?.fase === 'prova') F.ferma();
    s.innerHTML = `<span class="ld-lbl">Prova generale · ${esc(e.nome)}</span><p>Lasciata perdere: non ho segnato niente. Quando vuoi rifarla, scrivi «prova generale di ${esc(e.nome.toLowerCase())}».</p>`;
    aggiornaTutto();
  });
}
// il tempo è finito (anche a computer spento: focus.js se ne accorge al ritorno): si consegna e si chiedono gli esiti
function provaScaduta() {
  const st = PV.inCorso(); if (!st) return;
  PV.consegna();
  const e = esame(st.esameId), comp = e && PV.compitoDi(e, st); if (!comp) { PV.togli(); return; }
  if (provaS?.isConnected && A.turno?.contains(provaS)) return provaEsiti(e, comp, provaS);   // la scheda è ancora quella davanti
  nuovoTurno(); detto(A.turno, `Prova generale di ${e.nome}`); provaInCorso(e, comp);
}
// gli esiti: quattro bottoni per esercizio; [Salva] quando li hai scelti tutti. Le soluzioni solo dopo
function provaEsiti(e, comp, s) {
  const st = PV.inCorso(), scelte = comp.temi.map(() => null);
  s.innerHTML = `<span class="ld-lbl">Prova generale · ${esc(e.nome)}</span>
    <p>Consegnato. Prendi il foglio e, per ogni esercizio, dimmi tu com'è andata.</p>
    <ol class="ld-prova-l">${comp.temi.map((x, i) => `<li><span class="ld-prova-n">Esercizio ${esc(x.es ?? i + 1)}${x.punti != null ? ` · ${esc(String(x.punti).replace('.', ','))} punti` : ''}</span>
      <span class="ld-prova-inizio">${esc(x.t.split('\n').find(r => r.trim()).slice(0, 160))}</span>
      <div class="az ld-prova-esiti" role="group" aria-label="Com'è andato l'esercizio ${esc(x.es ?? i + 1)}">${Object.entries(PV.COME).map(([k, t]) => `<button type="button" class="btn small" data-i="${i}" data-come="${k}">${t}</button>`).join('')}</div></li>`).join('')}</ol>
    <div class="az"><button type="button" class="btn primary" data-salva disabled>Salva</button><button type="button" class="btn ld-piano" data-lascio>Lascio perdere</button></div>
    <p class="ld-nota">Lode non corregge: l'esito lo scegli tu.</p>`;
  s.querySelector('[data-lascio]').addEventListener('click', () => provaLascio(e, comp, s));
  const salvaB = s.querySelector('[data-salva]');
  s.querySelectorAll('[data-come]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i; scelte[i] = b.dataset.come;
    s.querySelectorAll(`[data-i="${i}"]`).forEach(y => { y.classList.toggle('scelta', y === b); y.setAttribute('aria-pressed', y === b); });
    salvaB.disabled = scelte.some(x => !x);
  }));
  salvaB.addEventListener('click', () => {
    const mins = PV.minutiDi(st), min = PV.minutiTotali(st);
    const p = PV.chiudi(e, comp, comp.temi.map((x, i) => ({ tema: x.id, come: scelte[i], min: mins[i] })), { min, durata: st?.durata ?? null });
    s.querySelectorAll('button').forEach(y => { y.disabled = true; });
    salvaB.closest('.az').remove();
    // adesso, e solo adesso, le soluzioni del prof
    s.querySelectorAll('.ld-prova-l > li').forEach((li, i) => {
      const x = comp.temi[i]; if (!x.sol) return;
      const box = h('div', 'ld-tema-sol', mdHtml(x.sol)); li.append(box); formuleIn(box, x.sol);
    });
    const mappa = !!e.programma?.argomenti?.length && comp.temi.some(x => x.a);
    const r = h('div', 'ld-prova-fine', PV.riepilogo(p, comp, { mappa }).map(f => `<p>${esc(f)}</p>`).join('')); s.append(r); entra(r, { dy: 4, blur: 4, ms: 360 });
    provaS = null; segnala('fatto'); aggiornaTutto();
    if (A.turno) A.turno.dataset.sintesi = `prova generale di ${e.nome}: ${p.esiti.filter(x => x.come !== 'nonfatto').length} su ${p.esiti.length}`;
  });
  if (A.turno) A.turno.dataset.sintesi = `prova generale di ${e.nome}: com'è andata`;
  return s;
}

/* ---------- il programma d'esame: la mappa degli argomenti e il piano fino all'appello (js/programma.js) ---------- */
const nomiArg = (e, lista) => lista.map(c => c.a?.t || c.t).filter(Boolean);
const corto = t => t.length > 34 ? t.slice(0, 33).replace(/\s+\S*$/, '') + '…' : t;
async function schedaProgramma(c = {}) {
  let e = c.esame;
  if (!e && c.nomeDetto) return rispostaFissa(`Non trovo l'esame **${c.nomeDetto}**. Aggiungilo prima, per esempio: «esame ${c.nomeDetto} il 15 gennaio 9 cfu».`);
  e ||= prossimi().find(x => PG.programmaDi(x)) || prossimi()[0] || daFare().find(x => PG.programmaDi(x)) || daFare()[0];
  if (!e) return rispostaFissa('Aggiungi prima un esame, per esempio: «esame analisi 2 il 15 gennaio 9 cfu». Poi incolla il suo programma.');
  if (c.testo) return proponiProgramma(e, c.testo, { fonte: 'incollato' });
  return PG.programmaDi(e) ? disegnaProgramma(e) : programmaVuoto(e);
}
function programmaVuoto(e) {
  const s = scheda('ld-programma', `<span class="ld-lbl">Programma · ${esc(e.nome)}</span>
    <p class="ld-vuoto">Incolla il programma del corso (dalla pagina del corso o dal PDF), oppure trascina qui il file. Lo divido in argomenti, ti mostro cosa sai già e ti preparo il piano fino all'appello.</p>
    <form class="ld-prog-form"><textarea name="t" rows="6" placeholder="1. Limiti e continuità&#10;2. Derivate: definizione, regole, teoremi di Rolle e Lagrange&#10;…" aria-label="Programma del corso" required></textarea><button class="btn primary" type="submit">Leggi il programma</button></form>`);
  s.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); const t = new FormData(ev.target).get('t'); if (String(t).trim()) { nuovoTurno(); detto(A.turno, `Programma di ${e.nome}`); proponiProgramma(e, String(t), { fonte: 'incollato' }); } });
  // con Moodle collegato e il corso seguito: la descrizione del corso, che spesso è proprio il programma
  BRIDGE?.invoca('moodle:stato').then(st => {
    const id = st?.collegato && Object.entries(st.corsi || {}).find(([, n]) => norm(n) === norm(e.nome))?.[0]; if (!id || !s.isConnected) return;
    const b = h('button', 'btn', 'Prendilo da Moodle'); b.type = 'button'; s.querySelector('form').append(b);
    b.addEventListener('click', async () => {
      b.disabled = true; const d = await BRIDGE.invoca('moodle:descrizione', +id).catch(() => null);
      if (!d?.testo || d.testo.length < 40) { b.textContent = 'Su Moodle la descrizione è vuota'; return; }
      nuovoTurno(); detto(A.turno, `Programma di ${e.nome} da Moodle`); proponiProgramma(e, d.testo, { fonte: 'Moodle' });
    });
  }).catch(() => { });
  if (A.turno) A.turno.dataset.sintesi = `programma di ${e.nome}`;
}
// dal testo agli argomenti: prima senza AI; con l'AI se il testo è lungo (un PDF intero) o se senza AI ne escono pochi
async function proponiProgramma(e, testo, { fonte = '' } = {}) {
  let arg = PG.leggiProgramma(testo), daAI = false;
  if (AI.attiva() && (arg.length < 4 || testo.length > 5000)) {
    modo('pensa', 'Leggo il programma…'); segnala('pensa');
    try { const x = await AI.leggiProgramma({ nome: e.nome, testo }); if (x.length >= 3) { arg = x; daAI = true; } } catch (err) { console.warn('Lode: programma con l\'AI', err); }
    modo('riposo');
  }
  if (!arg.length) return rispostaFissa('Da questo testo non riesco a tirare fuori gli argomenti. Incollali uno per riga, magari numerati.');
  const card = schedaConferma({ titolo: `${arg.length} argomenti per ${e.nome}: li salvo?`,
    extra: `<ol class="ld-arg-anteprima">${arg.map(a => `<li><b>${esc(a.t)}</b>${a.sotto?.length ? `<span>${esc(a.sotto.join(' · '))}</span>` : ''}</li>`).join('')}</ol>`,
    nota: `${daAI ? `Li ha letti ${AI.nomeMotore('testo')}: controlla che ci siano tutti. ` : ''}Se qualcosa non torna, incolla di nuovo il programma corretto.${PG.programmaDi(e) ? ' Gli argomenti con lo stesso nome tengono domande ed esiti.' : ''}`, fuoco: true });
  return attendiDecisione(card, async () => {
    PG.impostaProgramma(e, arg, { fonte }); TE.risistema(e); segnala('fatto');
    card.replaceWith(h('div')); disegnaProgramma(e); aggiornaTutto(); return {};
  });
}
function disegnaProgramma(e, { domande = false, msg = '' } = {}) {
  const cop = PG.copertura(e), per = new Map(cop.map(c => [c.a.id, c])), pr = PG.pronto(cop);
  // con il calendario delle ore acceso (lavoro, finestra di studio, più esami: js/ore.js) «Oggi» e «I prossimi giorni» vengono
  // da lì, solo le voci di questo esame; se no il piano di sempre, identico
  let p = PG.piano(e, cop);
  const cal = ORE.esamiDelPiano().some(x => x.id === e.id) && ORE.calendario();
  if (cal?.attivo) p = { ...p, giorni: p.giorni.map((x, k) => { const v = (cal.giorni[k]?.voci || []).filter(w => w.esameId === e.id);
    return { ...x, studia: v.filter(w => w.tipo === 'studia').map(w => w.id), ripassa: v.filter(w => w.tipo === 'ripassa' || w.tipo === 'generale').map(w => w.id) }; }) };
  const g = p.giorni[0] || null, oreH = cal?.attivo ? `<p class="ld-ore-testa">${esc(ORE.testoOggi(cal, esame))}</p>${riquadroOre(cal, e.id, msg)}` : '';
  const giorniA = e.data ? giorniTra(oggi(), e.data) : null, senza = e.programma.senza || [], tema = TE.temaDiOggi(e);
  const cosa = x => x.map(i => per.get(i)).filter(Boolean);
  const oggiH = !g ? '' : g.tipo === 'cuscinetto' ? '<p class="ld-nota">Oggi è il giorno cuscinetto: recupera quello che è rimasto indietro, oppure riposati.</p>'
    : g.tipo === 'generale' ? `<p>Ultimo giorno: ripasso generale. Le domande uscite e i punti deboli: ${esc(nomiArg(e, cosa(g.ripassa)).map(corto).join(', ') || 'tutto il programma')}.</p>`
    : `${g.studia.length ? `<p><em>Studia</em> ${cosa(g.studia).map(c => `<span class="${c.oggi ? 'fatto' : ''}">${esc(corto(c.a.t))}</span>`).join(', ')}</p>` : ''}${g.ripassa.length ? `<p><em>Ripassa</em> ${cosa(g.ripassa).map(c => `<span class="${c.oggi ? 'fatto' : ''}">${esc(corto(c.a.t))}</span>`).join(', ')}</p>` : ''}`;
  const prossimi7 = p.giorni.slice(1, 8).map(x => `<li><span>${esc(dataBreve(x.data))}</span>${x.tipo === 'cuscinetto' ? '<i>cuscinetto</i>' : x.tipo === 'generale' ? '<i>ripasso generale</i>' : esc([...cosa(x.studia).map(c => corto(c.a.t)), ...cosa(x.ripassa).map(c => '↻ ' + corto(c.a.t))].join(' · ') || '—')}</li>`).join('');
  const s = scheda('ld-programma', `<div class="capo"><span class="ld-lbl">Programma · ${esc(e.nome)}</span><span>${giorniA != null && giorniA >= 0 ? `${giorniA === 0 ? 'oggi' : giorniA === 1 ? 'domani' : `tra ${giorniA} giorni`} · ` : ''}${Math.round(pr * 100)}% pronto</span></div>
    <i class="ld-cop">${cop.map(c => `<i class="s${c.stato}${c.debole ? ' debole' : ''}" title="${esc(c.a.t)}: ${esc(PG.STATI[c.stato])}"></i>`).join('')}</i>
    ${g ? `<div class="ld-prog-oggi"><span class="ld-lbl">Oggi</span>${oreH}${oggiH}${tema ? `<p class="ld-tema-oggi"><em>Esercizio di oggi</em> ${esc(rigaTema(e, tema))} <button type="button" class="btn small" data-tema>Fallo adesso</button></p>` : ''}<div class="az">${AI.attiva() && (g.studia.length || g.ripassa.length) ? '<button type="button" class="btn primary" data-o>Interrogami su questi</button>' : ''}<button type="button" class="btn" data-f>Focus</button></div></div>` : ''}
    <ul class="ld-argomenti">${cop.map(c => `<li data-a="${esc(c.a.id)}"><i class="s${c.stato}${c.debole ? ' debole' : ''}"></i><span class="t"><b>${esc(c.a.t)}</b><small>${esc(c.debole ? 'da rivedere' : PG.STATI[c.stato])}${c.domande ? ` · uscita ${c.domande} ${c.domande === 1 ? 'volta' : 'volte'}` : ''}${c.stelle ? ' · ★' : ''}${c.oggi ? ' · fatto oggi' : ''}</small></span><span class="az"><button type="button" class="btn small ld-piano" data-spiego>Lo spiego io</button>${AI.attiva() ? '<button type="button" class="btn small" data-uno>Interrogami</button>' : ''}</span></li>`).join('')}</ul>
    ${prossimi7 ? `<details class="ld-prossimi"><summary>I prossimi giorni${p.conData ? '' : ' (senza data dell\'appello: piano su due settimane)'}</summary><ul>${prossimi7}</ul></details>` : ''}
    <details class="ld-domande-uscite"${domande ? ' open' : ''}><summary>Domande uscite agli appelli${senza.length ? ` · ${senza.length} senza argomento` : ''}</summary>
      <form class="ld-prog-form"><textarea name="t" rows="4" placeholder="Una per riga: quelle che girano nel gruppo del corso" aria-label="Domande uscite" required></textarea><button class="btn" type="submit">Aggiungi</button></form>
      ${senza.length ? `<p class="ld-nota">Non so di che argomento sono: ${senza.slice(0, 5).map(d => `«${esc(corto(d.t))}»`).join(', ')}${senza.length > 5 ? '…' : ''}</p>` : ''}</details>
    <p class="ld-nota">Il piano si rifà ogni giorno da quello che sai: appunti, carte, ripasso e interrogazioni. Prima gli argomenti deboli e quelli che escono di più; ogni argomento nuovo torna dopo qualche giorno.</p>`);
  s.querySelectorAll('.ld-argomenti li').forEach((x, i) => entra(x, { ritardo: 60 + Math.min(i, 12) * 35, dy: 4, blur: 4, ms: 380 }));
  // una scelta delle ore cambia il piano: la scheda si rifà (in fondo al turno) con la frase di quanto manca
  if (cal?.attivo) legaOre(s, m => { disegnaProgramma(e, { msg: m }); s.remove(); });
  s.querySelector('[data-o]')?.addEventListener('click', () => { nuovoTurno(); detto(A.turno, 'Interrogami sugli argomenti di oggi'); avviaOraleProgramma(e, [...cosa(g.studia), ...cosa(g.ripassa)].map(c => c.a)); });
  s.querySelector('[data-f]')?.addEventListener('click', () => avviaFocus({ esameId: e.id }));
  s.querySelector('[data-tema]')?.addEventListener('click', () => { nuovoTurno(); detto(A.turno, `Esercizio di ${e.nome}`); schedaTema(e, tema); });
  s.querySelectorAll('[data-uno]').forEach(b => b.addEventListener('click', () => { const a = e.programma.argomenti.find(x => x.id === b.closest('li').dataset.a); nuovoTurno(); detto(A.turno, `Interrogami su ${a.t}`); avviaOraleProgramma(e, [a], { max: 2 }); }));
  s.querySelectorAll('[data-spiego]').forEach(b => b.addEventListener('click', () => { const a = e.programma.argomenti.find(x => x.id === b.closest('li').dataset.a); nuovoTurno(); detto(A.turno, `Te lo spiego io: ${a.t}`); avviaSpiego(e, a); }));
  s.querySelector('.ld-domande-uscite form').addEventListener('submit', ev => { ev.preventDefault(); const t = String(new FormData(ev.target).get('t') || ''); nuovoTurno(); detto(A.turno, 'Domande uscite'); aggiungiDomandeUscite(e, t); });
  if (A.turno) A.turno.dataset.sintesi = `programma di ${e.nome}: ${Math.round(pr * 100)}% pronto`;
}
function aggiungiDomandeUscite(e, testo) {
  const dom = PG.leggiDomande(testo);
  if (!dom.length) return rispostaFissa('Non ho trovato domande: scrivine una per riga.');
  if (!PG.programmaDi(e)) { PG.aggiungiDomande(e, dom.map(d => d.t), { conta: dom.map(d => d.n) }); return mostraFatto({ testo: `${dom.length} ${dom.length === 1 ? 'domanda salvata' : 'domande salvate'}.`, nota: 'Incolla anche il programma: le metto sotto i loro argomenti.', azione: ['Programma', () => { nuovoTurno(); programmaVuoto(e); }] }); }
  const r = PG.aggiungiDomande(e, dom.map(d => d.t), { conta: dom.map(d => d.n) }); segnala('fatto');
  mostraFatto({ testo: `${dom.length} ${dom.length === 1 ? 'domanda aggiunta' : 'domande aggiunte'}.`, nota: r.senza ? `${r.senza} senza argomento: non capisco di quale parlano.` : 'Gli argomenti che escono di più salgono nel piano.', sintesi: 'domande uscite' });
  disegnaProgramma(e); aggiornaTutto();
}
// «te lo spiego io»: spiegare un argomento con parole proprie è uno dei modi più efficaci di studiare (autospiegazione).
// Senza AI Lode controlla i punti che trova negli appunti e nel programma; con l'AI giudica come all'orale
function avviaSpiego(e, a) {
  A.orale = null; A.spiega = { e, a, t0: Date.now() };
  const punti = PG.puntiDi(e, a);
  const s = scheda('ld-spiego', `<span class="ld-lbl">Te lo spiego io · ${esc(e.nome)}</span>
    <h3>${esc(a.t)}</h3>
    <p>Spiegalo come se fossi all'orale, con parole tue: scrivi qui sotto o tieni premuto ${esc(TASTI)} e parla. Quando hai finito, invia.</p>
    <p class="ld-nota">${AI.attiva() ? `Ti risponde ${esc(AI.nomeMotore())}, usando i tuoi appunti.` : punti.length ? `Controllo ${punti.length} punti presi dal programma e dai tuoi appunti: non te li mostro prima.` : 'Per questo argomento non ho appunti: senza AI posso solo segnare che l\'hai ripassato.'} Scrivi «esci» per lasciar stare.</p>`);
  campo.querySelector('input').placeholder = 'La tua spiegazione…'; campo.querySelector('input').focus({ preventScroll: true });
  if (A.turno) A.turno.dataset.sintesi = `spiego ${a.t}`;
  return s;
}
async function valutaSpiego(testo) {
  const { e, a } = A.spiega; A.spiega = null; campo.querySelector('input').placeholder = 'Chiedi o scrivi un comando…';
  if (AI.attiva()) {
    modo('pensa', 'Ascolto la spiegazione…'); segnala('pensa');
    try {
      const giu = await AI.giudicaRisposta({ nome: e.nome, domanda: `Spiegami «${a.t}»${a.sotto?.length ? ` (${a.sotto.join(', ')})` : ''}.`, argomento: a.t, risposta: testo, materiale: PG.materialeArgomento(e, a) });
      modo('riposo'); PG.registraEsito(e, a.id, giu.esito, 'spiega');
      const r = nuovaRisposta(); r.aggiungi(`**${cap(giu.esito)}.** ${giu.giudizio}${giu.mancava ? `\n\nMancava: ${giu.mancava}` : ''}`); await r.fine();
      segnala(giu.esito === 'giusta' ? 'fatto' : 'quiete'); aggiornaTutto();
      return;
    } catch (err) { modo('riposo'); if (!PG.puntiDi(e, a).length) return rispostaFissa('Non riesco a valutarla adesso: ' + err.message, { errore: true }); }
  }
  const c = PG.controllaSpiegazione(e, a, testo);
  if (!c) { PG.registraEsito(e, a.id, 'parziale', 'spiega'); aggiornaTutto(); return mostraFatto({ testo: `Segnato: hai ripassato ${a.t}.`, nota: 'Per un controllo vero servono appunti su questo argomento, o l\'AI.' }); }
  PG.registraEsito(e, a.id, c.esito, 'spiega'); segnala(c.esito === 'giusta' ? 'fatto' : 'quiete');
  scheda('ld-spiego-esito', `<span class="ld-lbl">${esc(a.t)} · ${c.punti.filter(p => p.detto).length} punti su ${c.punti.length}</span>
    <ul class="ld-punti">${c.punti.map(p => `<li class="${p.detto ? 'si' : 'no'}"><b>${p.detto ? '✓' : '○'}</b><span>${esc(p.t)}${!p.detto && p.d ? `<small>${esc(p.d.replace(/^[^:]+:\s*/, ''))}</small>` : ''}</span></li>`).join('')}</ul>
    <p class="ld-nota">Controllo le parole chiave, non il ragionamento: se un punto l'hai detto con parole diverse, vale lo stesso. ${c.esito === 'giusta' ? 'Argomento segnato come sicuro.' : 'Quelli col cerchio vuoto: rileggili e riprova tra un paio di giorni.'}</p>`);
  aggiornaTutto();
}
// l'interrogazione sugli argomenti del programma: una domanda per argomento, a giro; ogni esito resta sull'argomento
async function avviaOraleProgramma(e, argomenti, { max } = {}) {
  if (!argomenti.length) return rispostaFissa('Oggi nel piano non c\'è niente da interrogare.');
  if (!AI.attiva()) return avviaOrale(e);   // spiega che serve l'AI
  if (!A.turno || A.home) nuovoTurno();
  A.orale = { esameId: e.id, nome: e.nome, materiale: '', storico: [], corrente: null, max: max || Math.min(5, Math.max(3, argomenti.length)), argomenti }; A.storia = [];
  const c = contesto(`Orale · <b>${esc(e.nome)}</b> · ${esc(argomenti.length === 1 ? corto(argomenti[0].t) : `${argomenti.length} argomenti`)}`); const via = h('button', 'ld-esci', 'Esci'); via.type = 'button'; via.addEventListener('click', esciOrale); c.append(via);
  A.turno.dataset.sintesi = `orale di ${e.nome} sul programma`;
  return domandaOrale();
}
// dopo ogni risposta: l'esito va sull'argomento del programma (quello scelto, o quello di cui parla la domanda)
function esitoSulProgramma(o, x) {
  const e = o.esameId ? esame(o.esameId) : null; if (!PG.programmaDi(e)) return;
  const a = x.argomentoId ? e.programma.argomenti.find(y => y.id === x.argomentoId) : PG.abbina(`${x.argomento} ${x.domanda}`, e.programma.argomenti);
  if (a) { PG.registraEsito(e, a.id, x.esito, 'orale'); x.registrato = a; }
}

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
  if (A.spiega) {
    const t = h('article', 'ld-turno'); filo.append(t); A.turno = t; detto(t, testo); requestAnimationFrame(() => { corpo.scrollTop = corpo.scrollHeight; });
    if (/^(esci|annulla|basta|lascia stare)$/i.test(testo)) { A.spiega = null; return mostraFatto({ testo: 'Va bene, niente spiegazione.' }); }
    return valutaSpiego(testo);
  }
  if (A.orale) {
    if (/^(esci|basta orale|chiudi( l'orale)?|fine orale)$/i.test(testo)) { nuovoTurno(); detto(A.turno, testo); return esciOrale(); }
    const t = h('article', 'ld-turno'); filo.append(t); A.turno = t; detto(t, testo); requestAnimationFrame(() => { corpo.scrollTop = corpo.scrollHeight; });
    return rispostaOrale(testo);
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
  const c = h('span', 'ld-file', `${ico('doc')}<span>${esc(file.name)}</span><small>${esc(tipo)}</small>`);
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
    for (const riga of (await FILE.leggiTesto(file)).split(/\r?\n/)) {
      if (!riga.trim() || riga.startsWith('#')) continue;
      const p = riga.split(/\t| = | → |;(?=[^;]*$)/); if (p.length >= 2 && p[0].trim() && p[1].trim()) carte.push({ fronte: p[0].trim().replace(/^"|"$/g, ''), retro: p.slice(1).join(' ').trim().replace(/^"|"$/g, '') });
    }
  }
  A.allegati = []; allegatiBox.innerHTML = ''; campo.querySelector('input').placeholder = 'Chiedi o scrivi un comando…';
  if (!carte.length) return rispostaFissa('Senza AI leggo solo file di testo con una carta per riga (domanda, poi Tab o «;» o « = », poi risposta), come l\'export di Anki. Per PDF e foto serve il cervello locale o la tua AI (scrivi «AI»).');
  const e = prossimi()[0];
  const card = schedaConferma({ titolo: `Importare ${carte.length} carte?`, extra: `<ol class="ld-proposte">${carte.slice(0, 8).map(c => `<li><b>${esc(c.fronte)}</b><span>${esc(c.retro)}</span></li>`).join('')}${carte.length > 8 ? `<li class="altre">e altre ${esc(carte.length - 8)}</li>` : ''}</ol>`, nota: e ? `Le metto in ${e.nome}: lo cambi dalla pagina.` : '' });
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
  shell.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; A.chiudiTra?.(); A.chiudiTra = null; if (!A.aperto && !A.proposta) A.apriTra = dopo(70, () => apri()); });   // sulla proposta il mouse deve poter premere «Gioca» o «Dopo»
  shell.addEventListener('pointerleave', e => {
    if (e.pointerType !== 'mouse') return; A.apriTra?.(); A.apriTra = null;
    if (A.aperto && !A.fisso && !shell.contains(document.activeElement) && !Voce.attivo()) A.chiudiTra = dopo(380, () => { A.chiudiTra = null; if (!A.fisso) chiudi(); });
  });
  testa.querySelector('.ld-indietro').addEventListener('click', () => indietro());
  shell.querySelector('.ld-proposta [data-p=si]').addEventListener('click', e => { e.stopPropagation(); accettaProposta(); });
  shell.querySelector('.ld-proposta [data-p=dopo]').addEventListener('click', e => { e.stopPropagation(); nascondiProposta('rimandata'); mostraAvviso('Va bene, più tardi'); });
  // l'allenatore guarda ogni minuto (con un po' di caso dentro): niente proposte se la barra è aperta
  setTimeout(() => setInterval(() => { if (!A.aperto && !A.zona && !A.proposta) provaAllenatore().catch(() => { }); }, 60e3), Math.random() * 30e3);
  pill.addEventListener('click', () => { apri({ fisso: true }).then(() => campo.querySelector('input').focus({ preventScroll: true })); });
  pill.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') apri({ fisso: true }); });   // dito o penna (touch di Windows): si apre al primo tocco
  corpo.addEventListener('pointerdown', () => { A.fisso = true; });
  document.addEventListener('pointerdown', e => { if (A.aperto && !shell.contains(e.target) && !e.target.closest('.ld-drop')) chiudi(); });
  const inp = campo.querySelector('input');
  // il campo è su una riga sola: un errore incollato su più righe si vede in una riga, ma «spiegami l'errore» riceve le righe vere
  let incollato = null;
  inp.addEventListener('paste', e => {
    const t = e.clipboardData?.getData('text/plain') || '';
    if (!/\n/.test(t.trim())) return;
    e.preventDefault();
    const piatto = t.trim().replace(/\s*\r?\n\s*/g, ' ');
    inp.setRangeText(piatto, inp.selectionStart ?? inp.value.length, inp.selectionEnd ?? inp.value.length, 'end');
    incollato = { piatto, vero: t.replace(/\r\n?/g, '\n').trim() };
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const v = incollato && inp.value.includes(incollato.piatto) ? inp.value.replace(incollato.piatto, () => incollato.vero) : inp.value; incollato = null; invia(v); return; }
    if (Voce.attivo() && e.key.length === 1 && !pttAttivo) fineAscolto(true);   // si mette a scrivere: smetto di ascoltare
  });
  inp.addEventListener('focus', () => { A.fisso = true; });
  campo.querySelector('.ld-mic').addEventListener('click', () => { Voce.attivo() ? fineAscolto() : iniziaAscolto(); });
  home.addEventListener('click', e => {
    const r = e.target.closest('[data-ld-riga]'); if (r) { premi(r); home._righe[+r.dataset.ldRiga]?.f(); return; }
    const s = e.target.closest('[data-ld-strumento]'); if (s) { premi(s); const x = STRUMENTI.find(([k]) => k === s.dataset.ldStrumento); if (!x) return; const [, nome, f] = x; if (nome !== 'Carte da file') { nuovoTurno(); detto(A.turno, nome); } f(); return; }
    if (e.target.closest('[data-ld-esempio]')) dispatchEvent(new CustomEvent('lode:esempio'));
    const c = e.target.closest('[data-ld-cattura]'); if (c) { premi(c); cattura(c.dataset.ldCattura); return; }
    if (e.target.closest('[data-ld-appunti]')) apriAppunti();
    if (e.target.closest('[data-ld-trascrivi]')) { nuovoTurno(); detto(A.turno, 'Trascrivi la lezione'); avviaTrascrizione(); }
    const rp = e.target.closest('[data-ld-ripeti]'); if (rp) { const k = rp.dataset.ldRipeti; nuovoTurno(); detto(A.turno, k === 'si' ? 'Ripeti' : k === 'spegni' ? 'Spegni Ripeti' : 'Accendi Ripeti'); k === 'si' ? ripeti(60, { gesto: true }) : k === 'spegni' ? spegniRipeti() : accendiRipeti(); return; }
    const tr = e.target.closest('[data-ld-tr]'); if (tr) { const k = tr.dataset.ldTr; if (k === 'fine') { nuovoTurno(); detto(A.turno, 'Fine trascrizione'); fermaTrascrizione(); } else { k === 'pausa' ? TR.pausa() : TR.riprendi(); disegnaHome(); } }
  });
  addEventListener('keydown', e => {
    // AltGr su Windows arriva come Ctrl+Alt (la «[» della tastiera italiana è AltGr+è): mai una scorciatoia. Sul Mac ⌥ non conta
    const altGr = !MAC && (e.getModifierState?.('AltGraph') || (e.ctrlKey && e.altKey));
    const ptt = (MAC ? e.altKey && !e.ctrlKey : e.ctrlKey && e.shiftKey && !altGr) && e.code === 'Space';
    if (ptt) { e.preventDefault(); if (!e.repeat && !pttAttivo) { pttAttivo = true; iniziaAscolto(); } return; }
    // Esc: prima torna indietro alla home, la seconda volta chiude
    if (e.key === 'Escape') { if (Voce.attivo()) { fineAscolto(true); return; } if (A.cattura) { e.preventDefault(); fineCattura(); chiudi(); return; } if (A.aperto) { e.preventDefault(); A.home ? chiudi() : indietro(); } return; }
    // indietro: ⌘[ o ⌘← sul Mac; Ctrl+[ o Ctrl+← altrove, ma solo a campo vuoto (se scrivi, Ctrl+← salta tra le parole)
    const inCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    const vuoto = !inCampo || !(document.activeElement.value ?? document.activeElement.textContent);
    if (A.aperto && !A.home && !altGr && (MAC ? e.metaKey || e.ctrlKey : e.ctrlKey && !e.metaKey && vuoto) && (e.key === '[' || e.key === 'ArrowLeft')) { e.preventDefault(); indietro(); return; }
    const inCampo0 = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (A.aperto && A.gioco && !inCampo0 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.code === 'Space') { e.preventDefault(); A.gioco.gira(); return; }
      if (e.key === '1' || e.key === '2') { e.preventDefault(); A.gioco.vota(e.key); return; }
    }
    if (A.aperto && A.quiz && !inCampo0 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!A.quiz.card.isConnected) A.quiz = null;
      else {
        const j = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
        if (e.key.length === 1 && j >= 0) { e.preventDefault(); A.quiz.scegli(j); return; }
        if (e.key === 'Enter') { e.preventDefault(); A.quiz.avanti(); return; }
      }
    }
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey) && !altGr) || (e.key === '/' && !inCampo)) { e.preventDefault(); apri({ fisso: true }).then(() => inp.focus()); return; }
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
    if (ev === 'fine') { segnala('fatto'); mostraAvviso(e.detail.fase === 'focus' ? `${e.detail.min} minuti fatti · pausa` : e.detail.fase === 'prova' ? 'Tempo scaduto · consegna' : 'Pausa finita · si riparte?'); if (e.detail.fase !== 'focus') document.title = 'Lode'; }
    if (ev === 'fine' && e.detail.fase === 'prova') provaScaduta();
    if (ev === 'fermo') { document.title = 'Lode'; segnala('quiete'); }
    if (!A.aperto && forma.w.t !== larghezza()) { forma.w.t = larghezza(); molla(); }
    aggiornaTutto();
  });
  addEventListener('lode:dati', () => { if (!A.avviso) aggiornaPillola(); if (A.aperto && A.home) { disegnaHome(); aggiornaTesta(); } });
  addEventListener('lode:progetto', () => { if (A.aperto && A.home) disegnaHome(); });   // il progetto seguito cambia: la riga in «Oggi»
  addEventListener('resize', () => { if (A.aperto) { forma.w.t = Math.min(560, innerWidth - 16); molla(); } });
  let tTr = 0;
  addEventListener('lode:trascrizione', () => { if (!A.avviso) aggiornaPillola(); clearTimeout(tTr); tTr = setTimeout(() => { if (A.aperto && A.home && !shell.contains(document.activeElement)) disegnaHome(); }, 300); });
  addEventListener('lode:orecchio', e => { if (!e.detail?.acceso) ripetiManuale = 0; if (!A.avviso) aggiornaPillola(); if (A.aperto && A.home && !shell.contains(document.activeElement)) disegnaHome(); });
  addEventListener('lode:lezioni', () => { if (!A.avviso) aggiornaPillola(); if (A.aperto && A.home) disegnaHome(); });
  // il tempo passa: «fine tra 23 min», la lezione che inizia, il suggerimento del pomeriggio
  let minuto = -1;
  setInterval(() => { const m = new Date().getMinutes(); if (m === minuto) return; minuto = m;
    // Ripeti: si accende da solo a lezione (se l'hai attivato una volta) e si spegne dopo; acceso a mano fuori orario resta (orecchio.js)
    if (V.attivo && !O.inProva()) {
      const auto = !!(D.imp.ripetiInAula && D.imp.trascrizioneOk), inLezione = !!lezioneOra();
      if (auto && inLezione) ripetiManuale = 0;   // a lezione decide l'orario: finita la lezione si spegne come sempre
      const r = O.regolaAula({ acceso: O.attivo(), inLezione, auto, trascrive: TR.attiva(), manualeDa: ripetiManuale });
      if (r === 'accendi') O.accendi().then(aggiornaTutto).catch(() => { });
      else if (r === 'spegni') { const aMano = auto && ripetiManuale; ripetiManuale = 0; O.spegni(); aggiornaTutto(); if (aMano) mostraAvviso('Ripeti spento dopo 3 ore'); }
    }
    // dieci minuti dopo la fine della lezione la trascrizione si chiude da sola
    const tr = TR.stato(); if (tr?.lezione.fine && !lezioneOra()) { const [hh, mm] = tr.lezione.fine.split(':').map(Number), d = new Date(); if (d.getHours() * 60 + d.getMinutes() >= hh * 60 + mm + 10) fermaTrascrizione(); } if (!A.avviso && !F.stato()) aggiornaPillola(); if (A.aperto && A.home && !shell.contains(document.activeElement)) { disegnaHome(); aggiornaTesta(); } }, 5000);
  if (BRIDGE) collegaDesktop();
}
// nell'app la barra è una finestra trasparente sopra tutte le altre: i clic passano attraverso tranne che sulla barra
function collegaDesktop() {
  let ignora = null;
  const passa = v => { if (v !== ignora) { ignora = v; BRIDGE.mouse(v); } };
  const fuori = e => !(e.target instanceof Element && e.target.closest('.ld'));
  document.addEventListener('pointermove', e => passa(fuori(e)), { passive: true });
  // al tocco non c'è un pointermove prima, e alzare il dito è sempre un pointerleave: decide dove si tocca
  document.addEventListener('pointerdown', e => passa(fuori(e)), { passive: true, capture: true });
  document.addEventListener('pointerleave', e => { if (!A.aperto && e.pointerType !== 'touch') passa(true); });
  passa(true);
  addEventListener('blur', () => { setTimeout(() => { if (A.aperto && !document.hasFocus() && !Voce.attivo()) chiudi(); }, 120); });
  let ultimoApri = 0;
  BRIDGE.su('scorciatoia', nome => {
    // ⌥ Spazio: si apre e ascolta (tieni premuto e parla; lasci o stai zitto e parte). Se inizi a scrivere, smette.
    // Su Windows tenere premuto ripete la scorciatoia (ogni 30-400 ms, la prima dopo fino a 1 s): senza un rilascio in mezzo non riapre l'ascolto
    if (nome === 'apri') { const t = Date.now(), ripetuto = pttAttivo && t - ultimoApri < 1100; ultimoApri = t; if (ripetuto || Voce.attivo()) return; pttAttivo = true; apri({ fisso: true }).then(() => campo.querySelector('input').focus({ preventScroll: true })); iniziaAscolto(); }
    else if (nome === 'scrivi') { apri({ fisso: true }).then(() => campo.querySelector('input').focus()); }
    else if (CATTURE[nome]) cattura(nome);
    else if (nome === 'ripeti') { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Ripeti'); ripeti(60, { gesto: true }); }
    else if (nome === 'trascrivi') { apri({ fisso: true }); nuovoTurno(); if (TR.attiva()) { detto(A.turno, 'Fine trascrizione'); fermaTrascrizione(); } else { detto(A.turno, 'Trascrivi la lezione'); avviaTrascrizione(); } }
    else if (nome === 'gioco') { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Gioca'); schedaGioco(); }
  });
}

export function avvia() {
  A = nuovoStato(); costruisci(); collega();
  // «Cosa stampa?» e «Segui il progetto» usano gli attrezzi di questo file (scheda, molle, conferme)
  ST.collega({ scheda, segnala, entra, tween, dopo, rispostaFissa, errori: ERRORI,
    ricorda: (k, ok, q) => ricorda(k, ok, q, D.codice.memoria),   // SM-2 a parte: D.memoria è delle definizioni
    codice: () => D.codice,                                        // una funzione: D viene riassegnato quando i dati cambiano
    registra: ev => DI.registra(D.codice, ev),
    allaFine: () => { salva(); V.scriviMemoria(); aggiornaTutto(); },   // salva() → lode:dati → aggiornaPagine: diario e «Cosa so davvero»
    ricomincia: t => { nuovoTurno(); detto(A.turno, t); },
    aperto: () => A.aperto });
  PR.collega({ scheda, segnala, entra, dopo, premi, rispostaFissa, mostraFatto, nuovoTurno, detto: t => detto(A.turno, t), corsiPossibili,
    aggiornaPillola: () => { if (!A.avviso && !F.stato()) aggiornaPillola(); },
    evento: eventoProgetto, spiegaErrore: e => { spiegaEsito(e).catch(x => console.error('Lode: errore non spiegato', x)); } });
  addEventListener('lode:voce', e => { const x = e.detail; document.querySelectorAll('.ld-prepara').forEach(s => mostraAvanzamento(s, 'voce', x.fase === 'pronta' ? { fase: 'fatto', p: 1, testo: Voce.NOME_VOCE + ' in locale · tieni premuto ' + TASTI + ' e parla' } : x.fase === 'errore' || x.fase === 'ripiego' ? { fase: x.fase === 'errore' ? 'errore' : undefined, p: 0, testo: x.testo } : { p: x.p, testo: `Scarico ${Voce.NOME_VOCE} · ${Math.round((x.p || 0) * 100)}%` })); if (A.modo === 'ascolto' && x.fase === 'scarico') campo.querySelector('.stato.ascolto .lbl').textContent = `Ti ascolto · preparo la voce ${Math.round((x.p || 0) * 100)}%`; if (x.fase === 'pronta' && A.modo === 'ascolto') campo.querySelector('.stato.ascolto .lbl').textContent = 'Ti ascolto';
    if (x.fase === 'ripiego') voceRipiegata = true;
    if (A.modo === 'pensa' && attesaVoce) {   // Ripeti o la trascrizione che aspettano la voce: si vede a che punto è
      const lbl = campo.querySelector('.stato.pensa .lbl'), cosa = voceRipiegata ? 'Parakeet non parte: preparo Whisper' : 'Preparo la voce';
      if (x.fase === 'ripiego') lbl.textContent = cosa + '…';
      else if (x.fase === 'scarico') lbl.textContent = `${cosa} · ${Math.round((x.p || 0) * 100)}%`;
      else if (x.fase === 'pronta') lbl.textContent = attesaVoce;
    } });
  // la voce già preparata si carica in silenzio dopo l'avvio: così il primo ⌥ Spazio è immediato
  try { if (DESKTOP && localStorage.getItem('lode:voce')) setTimeout(() => Voce.prepara().catch(() => { }), 4000); } catch { }
  if (V.attivo) {
    aggiornaStato(); setInterval(aggiornaStato, 5 * 60e3);
    // uno stato ha sempre la fase; { errore } senza fase è l'IPC che non ha risposto (uno stato può avere anche errore)
    BRIDGE.invoca('aggiorna:stato').then(s => { if (s?.fase) AGG = s; }).catch(() => { });
    BRIDGE.su('aggiorna:cambiato', s => {
      const prima = AGG?.fase, erroreDiPrima = AGG?.errore ?? null; AGG = s;
      document.querySelectorAll('.ld-prepara').forEach(mostraAggiornamenti);
      if (prima === s.fase && erroreDiPrima === (s.errore ?? null)) return;
      if (A.aperto && A.home && !shell.contains(document.activeElement)) disegnaHome();
      if (prima !== s.fase && !A.aperto && (s.fase === 'pronta' || s.fase === 'da_scaricare')) mostraAvviso(s.fase === 'pronta' ? `Lode ${s.nuova.versione} è pronta` : `È uscita Lode ${s.nuova.versione}`, true);
    });
    aggiornaSync().then(() => { if (A.aperto && A.home) disegnaHome(); });
    // lo stato arriva dal main a ogni giro: la riga in home e nel «Prepara Lode», e un avviso se serve la password
    BRIDGE.su('sync:stato', x => {
      const prima = syncBloccata(), primo = SYNC?.stato; SYNC = x; piedeSync();
      document.querySelectorAll('.ld-prepara .ld-prep[data-k="sync"] .d').forEach(d => { d.textContent = TS.rigaStato(x); });
      if (prima !== syncBloccata() || primo !== x.stato) { if (A.aperto && A.home && !shell.contains(document.activeElement)) disegnaHome(); if (!prima && syncBloccata() && !A.aperto) mostraAvviso('Sincronizzazione in pausa · scrivi la password', true); }
    });
    BRIDGE.su('sync:progresso', x => document.querySelectorAll('.ld-sync-avanza').forEach(p => { p.textContent = x.testo || ''; }));
    V.suProgresso(x => { avanzamenti[x.cosa] = x; if (x.fase === 'fatto' || x.fase === 'errore') { delete avanzamenti[x.cosa]; aggiornaStato(); } document.querySelectorAll('.ld-prepara').forEach(s => mostraAvanzamento(s, x.cosa, x)); if (!A.aperto && x.fase !== 'fatto' && x.fase !== 'errore' && x.p != null) mostraAvviso(`${x.cosa === 'obsidian' ? 'Obsidian' : 'Cervello locale'} · ${Math.round(x.p * 100)}%`, true); });
  }
  if (F.stato()?.fase === 'focus' && !F.stato().fermo) setTimeout(() => segnala('focus'), 600);
}
// la pagina sotto chiede a Lode di fare cose (ripassa, interroga, focus) dal suo pannello
// per le prove automatiche (test/): accesso ai motori della barra
window.__lode = { D: () => D, SYNC: () => SYNC, aggiornaSync, schedaSincronizza, AI, invia, provaAllenatore, AL, riceviFile, O, ripeti, condividiLezione, indietro, TR, Voce, avviaTrascrizione, fermaTrascrizione, riordinaLezione, stato: () => A, ST, PR, ER, DI };
export const azioni = {
  focus: esameId => avviaFocus({ esameId }),
  ripassa: esameId => { apri({ fisso: true }); nuovoTurno(); detto(A.turno, esameId ? 'Ripassa ' + esame(esameId)?.nome : 'Ripasso'); schedaRipasso(esameId); },
  interroga: esameId => { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Interrogami su ' + esame(esameId)?.nome); avviaOrale(esame(esameId)); },
  libretto: () => { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Libretto'); schedaLibretto(); },
  programma: esameId => { apri({ fisso: true }); nuovoTurno(); detto(A.turno, 'Programma di ' + esame(esameId)?.nome); schedaProgramma({ esame: esame(esameId) }); },
  scrivi: testo => { apri({ fisso: true }).then(() => { const i = campo.querySelector('input'); i.value = testo; i.focus(); }); },
  invia: testo => { apri({ fisso: true }); invia(testo); },
  file: () => scegliFile(),
  ricevi: lista => riceviFile(lista),
  home: () => { ricomincia(); },
};
