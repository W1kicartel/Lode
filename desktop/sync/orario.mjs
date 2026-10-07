// Orario.md (docs/SINCRONIZZAZIONE.md §9): la proiezione che si scrive dalla vista e si rilegge. Funzioni pure.
// In fondo al file c'è il marcatore (⊕6), con l'hash del testo sopra e le chiavi delle righe che Lode ci aveva messo:
//   <!-- lode2 n=<eventi piegati> x=<xor delle h, 8 hex> t=<ms>.<c> h=<sha del testo sopra, 16 hex> righe=<k1>,<k2>… -->
// k è l'hash corto della chiave della lezione, e l'id della lezione è «o<k>»: la stessa riga dà lo stesso id dappertutto.
import { sha, conImpronta, lezioniVive } from './piega.mjs';
import { chiaveLezione } from './schema.mjs';
import { daWeb } from '../web.mjs';

// js/markdown.js dalla cartella dell'interfaccia (desktop/web.mjs): nel pacchetto «../../js» non c'è
const { orarioMd, leggiOrario } = await daWeb('js/markdown.js');

export const kLezione = o => sha(chiaveLezione(o), 12);
export const idLezione = o => 'o' + kLezione(o);
const riga = o => ({ corso: o.corso, giorni: [...(o.giorni || [])], inizio: o.inizio, fine: o.fine, aula: o.aula || '' });

// il testo che Lode scrive per questo stato piegato
export function testoOrario(stato) {
  const righe = lezioniVive(stato).map(r => riga(Object.fromEntries([...r.campi].map(([c, w]) => [c, w.v]))));
  const sopra = orarioMd(righe);
  return { testo: `${sopra}<!-- lode2 n=${stato.n} x=${stato.x.toString(16).padStart(8, '0')} t=${stato.t[0]}.${stato.t[1]} h=${sha(sopra, 16)} righe=${righe.map(kLezione).sort().join(',')} -->\n`, n: stato.n, x: stato.x };
}

// il marcatore in fondo (null se non c'è) e il testo sopra
export function leggiMarcatore(testo) {
  const m = String(testo).match(/(^|\n)<!-- lode2 ([^\n]*) -->\s*$/);
  if (!m) return null;
  const campi = Object.fromEntries(m[2].split(' ').map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));
  const [ms, c] = String(campi.t || '').split('.').map(Number), n = Number(campi.n), x = parseInt(campi.x, 16);
  if (!Number.isInteger(ms) || !Number.isInteger(c) || !Number.isInteger(n) || !Number.isFinite(x) || !/^[0-9a-f]{16}$/.test(campi.h || '')) return null;
  return { n, x, t: [ms, c], h: campi.h, righe: campi.righe ? campi.righe.split(',').filter(Boolean) : [], sopra: testo.slice(0, m.index + m[1].length) };
}
// il marcatore rimesso sotto un testo cambiato dallo studente (dopo averne ricavato gli eventi): stesso (n, x), t + 1, hash del
// testo e righe di adesso
export function rimarca(m) {
  const righe = leggiOrario(m.sopra).map(kLezione).sort();
  return `${m.sopra}<!-- lode2 n=${m.n} x=${m.x.toString(16).padStart(8, '0')} t=${m.t[0]}.${m.t[1] + 1} h=${sha(m.sopra, 16)} righe=${[...new Set(righe)].join(',')} -->\n`;
}
// (n, x) maggiore in ordine lessicografico: chi sa di più (I9)
export const sopra = (a, b) => a.n > b.n || (a.n === b.n && a.x > b.x);

// gli eventi che una versione di Orario.md porta (o nessuno). nomeFile serve solo all'identità degli eventi.
// - marcatore e hash che torna: l'ha scritto Lode, nessun evento
// - marcatore e hash diverso: lo studente l'ha cambiato partendo da `righe`: riga nuova → crea o<k>, k elencata e assente →
//   cancella o<k>. t = t del marcatore + 1: dopo tutto quello che il file mostrava
// - niente marcatore (troncato, vuoto, Lode vecchia, tolto a mano): solo crea delle righe con k mai vista, a t [0,0] (prima di
//   ogni evento vero: non riporta mai indietro niente), mai cancellazioni. Le righe sparite si propongono (tolte()).
// Un file che non finisce con un a capo è arrivato a metà (Lode scrive sempre il marcatore, con il suo a capo, per ultimo): non
// porta niente e non si riscrive finché non arriva intero (I3). Se no si leggono comunque solo le righe intere
// visto: le righe delle versioni cambiate dallo studente che il motore ha letto sotto questo stesso marcatore ma non ha potuto
// scrivere nel diario (disco pieno: il marcatore non si è rimesso). { h, t, righe }. Se c'è, una riga vista e poi tolta è una
// cancellazione, anche se il file è tornato identico al testo di Lode, e t = t del marcatore + 2. Senza, un'aggiunta in Obsidian non scritta e poi tolta riportava il file identico al
// testo di Lode (hash che torna: «nessun evento»), e la rimozione si perdeva mentre un altro computer, che aveva letto il file
// con l'aggiunta, la teneva viva (fuzz --disco 62101019, scenario R05)
export function eventiDaOrario(testo, stato, visto = null) {
  const t = String(testo), interi = t.endsWith('\n') ? t : t.slice(0, t.lastIndexOf('\n') + 1);
  if (t && !t.endsWith('\n')) return { eventi: [], marcatore: null, tolte: [], parziale: true };
  const m = leggiMarcatore(t);
  const v = m && visto && visto.h === m.h && visto.t[0] === m.t[0] && visto.t[1] === m.t[1] ? visto : null;
  if (m && !v && sha(m.sopra, 16) === m.h) return { eventi: [], marcatore: m, tolte: [], righe: m.righe };
  const righe = new Map(); for (const o of leggiOrario(m ? m.sopra : interi)) righe.set(kLezione(o), riga(o));
  const f = sha(t, 16), eventi = [];
  const ev = (tt, x) => conImpronta({ dev: 'orario', t: tt, k: 1, f, ...x });
  if (m) {
    // le aggiunte si contano dalle righe del marcatore (quelle non scritte nel diario si rifanno); le righe tolte anche da quelle viste
    const base = new Set(m.righe), viste = new Set([...m.righe, ...(v ? v.righe : [])]), tt = [m.t[0], m.t[1] + (v ? 2 : 1)];
    for (const [k, o] of righe) if (!base.has(k)) eventi.push(ev(tt, { tipo: 'crea', lista: 'orario', id: 'o' + k, campi: o }));
    for (const k of viste) if (!righe.has(k)) eventi.push(ev(tt, { tipo: 'cancella', lista: 'orario', id: 'o' + k, prev: null }));
    return { eventi, marcatore: m, tolte: [], righe: [...righe.keys()] };
  }
  for (const [k, o] of righe) if (!stato.recs.has(`orario/o${k}`)) eventi.push(ev([0, 0], { tipo: 'crea', lista: 'orario', id: 'o' + k, campi: o }));
  const tolte = lezioniVive(stato).filter(r => !righe.has(r.id.slice(1))).map(r => r.id);
  return { eventi, marcatore: null, tolte };
}
