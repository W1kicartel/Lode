// «Ripasso in tasca»: le carte di domani in una nota del vault (In tasca.md), da fare sul telefono con Obsidian. Lode non usa
// la rete: la nota sul telefono la porta il servizio che lo studente usa già (iCloud, Obsidian Sync, Syncthing). Solo nell'app.
// Ogni carta è un callout chiuso («> [!risposta]-»: si apre con un tocco) e due caselle, «sapevo» e «non sapevo». Quando la
// nota torna sul computer, il giro legge le spunte e chiama rispondi() di dati.js (sapevo = 4, non sapevo = 0), poi riscrive
// la nota con le carte nuove e un giro nuovo. Il giro (un id scritto in fondo alla nota e in D.tasca) è la difesa contro le
// copie vecchie: una nota con un giro che non è l'ultimo scritto arriva da un sync in ritardo e le sue spunte non si segnano.
// Una spunta non si segna mai due volte: D.tasca.fatte tiene le carte già segnate in questo giro (se la riscrittura salta
// perché Obsidian sta ancora sincronizzando, il giro dopo segna solo le spunte nuove). E una carta già ripassata sul computer
// dopo la scrittura della nota (le carte di oggi sono anche nel ripasso di Lode) non si segna di nuovo: D.tasca.carte tiene
// il segno di ogni carta scritta (scad, rip, int, ease) e una carta col segno cambiato si salta (r.gia). Senza, «sapevo»
// sul telefono dopo «sapevo» sul computer gonfierebbe l'intervallo SM-2 (6 giorni → 15).
// Funzioni pure (scegli, scriviNota, leggiNota, impronta) provate in test/tasca.mjs; aggiorna() prende un vault finto.
import { D, dataLunga, oggi, piuGiorni, rispondi, salva, id } from './dati.js';
import * as V from './vault.js';
import { t } from './lingua.js';
import { nomi, nomiDi, fileNota, rx } from './nomi.js';

// il nome della nota nei vault italiani (e in quelli nati prima delle lingue); il vault aperto usa il suo (js/nomi.js)
export const FILE = 'In tasca.md';
const file = () => fileNota('tasca');
export const MASSIMO = 20;
// lo stato vive in D (dati.json nel vault): D può essere sostituito (sync, altra finestra), quindi si prende ogni volta
export const stato = () => { const t = D.tasca ||= { giro: null, impronta: null, scritta: null, sera: false }; t.fatte ||= []; t.carte ||= {}; return t; };
// lo stato SM-2 di una carta in una stringa: se cambia fra la scrittura della nota e la spunta, la carta l'ha fatta il computer
export const segno = c => [c.scad, c.rip, c.int, c.ease].join('|');

// le carte che scadono entro domani: prima le più in ritardo, poi per corso (a parità, l'ordine di D.carte); al massimo 20
export function scegli(carte, T, esami = []) {
  const domani = piuGiorni(T, 1), corso = c => esami.find(e => e.id === c.esameId)?.nome || '￿';
  return (carte || []).filter(c => c && c.scad && c.scad <= domani && String(c.fronte || '').trim())
    .map((c, i) => ({ c, i })).sort((a, b) => a.c.scad.localeCompare(b.c.scad) || corso(a.c).localeCompare(corso(b.c), 'it') || a.i - b.i)
    .slice(0, MASSIMO).map(x => x.c);
}

// il testo della nota. Il fronte su una riga sola (dentro ** **), la risposta con «> » davanti a ogni riga (le formule
// $…$ restano come sono: Obsidian le mostra anche nel callout). Marcatori in commenti HTML: in lettura non si vedono
// Il titolo, il callout e le caselle hanno le parole del vault (js/nomi.js): «sapevo»/«non sapevo» in un vault italiano
export function scriviNota(carte, esami, giro, T) {
  const N = nomi(), P = N.parole, callout = P.risposta.toLowerCase();
  const capo = `# ${N.titoli.ripassoInTasca}\n${t('tasca.nota-capo', { data: dataLunga(piuGiorni(T, 1)) })}\n`;
  const fine = `<!-- lode-tasca giro:${giro} -->\n`;
  if (!carte.length) return `# ${N.titoli.ripassoInTasca}\n${t('tasca.nota-vuota')}\n\n${fine}`;
  const blocchi = carte.map((c, i) => {
    const corso = (esami || []).find(e => e.id === c.esameId)?.nome || t('tasca.senza-corso');
    const fronte = String(c.fronte).replace(/\s*\n\s*/g, ' ').trim();
    const retro = String(c.retro || '').replace(/\r\n?/g, '\n').trim().split('\n').map(r => (r.trim() ? '> ' + r.replace(/\s+$/, '') : '>')).join('\n') || '>';
    return `## ${i + 1} · ${corso}\n**${fronte}**\n\n> [!${callout}]- ${P.risposta}\n${retro}\n\n- [ ] ${P.sapevo}\n- [ ] ${P.nonSapevo}\n<!-- lode-carta:${c.id} -->\n`;
  });
  return `${capo}\n${blocchi.join('\n')}\n${fine}`;
}

// le spunte: { giro, esiti: [{ id, sapevo }] }. Contano solo le righe che cominciano con «- [ ]» (le righe della risposta
// hanno «> » davanti) e una carta conta solo con una casella spuntata, [x] o [X]: zero o due, ignorata. Le caselle valgono
// fino al marcatore della loro carta; un titolo «## » ricomincia da capo. Con carte, gli id che non ci sono più si ignorano
// le caselle si leggono con le parole del vault e con quelle italiane (una nota scritta prima delle lingue); il «non» prima
const IT = nomiDi('it').parole;
const caselle = () => {
  const P = nomi().parole, no = [...new Set([P.nonSapevo, IT.nonSapevo])], si = [...new Set([P.sapevo, IT.sapevo])];
  return { re: new RegExp(`^\\s*[-*] \\[(.)\\] *(${[...no, ...si].sort((a, b) => b.length - a.length).map(rx).join('|')})\\s*$`, 'i'), no: no.map(x => x.normalize('NFC').toLowerCase()) };
};
const CARTA = /^<!-- lode-carta:([\w-]{1,40}) -->\s*$/, GIRO = /^<!-- lode-tasca giro:([\w-]{1,40}) -->\s*$/m;
export function leggiNota(testo, carte = null) {
  const righe = String(testo || '').replace(/\r\n?/g, '\n').split('\n'), esiti = [], visti = new Set();
  const esistono = carte ? new Set(carte.map(c => c.id)) : null, CASELLA = caselle();
  let viste = [];
  for (const r of righe) {
    let m;
    if (/^#{1,6} /.test(r)) viste = [];
    else if ((m = r.normalize('NFC').match(CASELLA.re))) viste.push({ spunta: /^[xX]$/.test(m[1]), sapevo: !CASELLA.no.includes(m[2].toLowerCase()) });
    else if ((m = r.match(CARTA))) {
      const sp = viste.filter(c => c.spunta);
      if (sp.length === 1 && !visti.has(m[1]) && (!esistono || esistono.has(m[1]))) { visti.add(m[1]); esiti.push({ id: m[1], sapevo: sp[0].sapevo }); }
      viste = [];
    }
  }
  return { giro: String(testo || '').match(GIRO)?.[1] || null, esiti };
}

// FNV-1a a 32 bit sul testo con gli a capo «\n» e senza spazi in fondo (Obsidian può aggiungere o togliere l'ultimo a capo)
export function impronta(testo) {
  const s = String(testo ?? '').replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/* ---------- il giro ---------- */
// vault: { leggi() → testo | null se la nota non c'è, scrivi(testo) }. Quello vero passa da js/vault.js (vault:leggi,
// vault:scrivi: il main permette solo «In tasca.md»). Un errore di lettura che non è «non c'è» ferma tutto: mai
// riscrivere una nota che non si è riusciti a leggere (iCloud che la sta scaricando, file bloccato)
// (il messaggio di node è sempre in inglese, ENOENT; «non c'è» e gli altri nelle sei lingue se l'errore lo scrive Lode)
const NON_CE = /ENOENT|no such file|non c.è|not found|NotFoundError|no existe|n.existe pas|existiert nicht|nicht gefunden|não existe/i;
export const vaultVero = {
  async leggi() { try { await V.nomiPronti(); return await V.leggiNota(file()); } catch (e) { if (NON_CE.test(e?.message || '')) return null; throw e; } },
  scrivi: testo => V.scriviTasca(testo),
};
// i giri uno alla volta: l'avvio e il comando insieme non devono leggere tutti e due la stessa nota e segnare due volte
let coda = Promise.resolve();
export function aggiorna(opz = {}) { const p = coda.then(() => giro(opz)); coda = p.catch(() => { }); return p; }

// forza: anche se la nota è uguale all'ultima scritta (il comando, la sera). riscrivi: anche se la nota è di un giro
// vecchio (lo studente l'ha chiesto: la copia giusta non arriva più); le spunte di quella copia non si segnano.
// Risultato: { segnate, sapevo, gia (spuntate ma già ripassate sul computer), scritte (carte nella nota nuova), saltata: null | 'uguale' | 'manca' | 'estranea' | 'vecchia' | 'cambiata' | 'errore' }
async function giro({ forza = false, riscrivi = false, vault = vaultVero, T = oggi() } = {}) {
  const s = stato(), r = { segnate: 0, sapevo: 0, gia: 0, scritte: 0, saltata: null, errore: null };
  let testo;
  try { testo = await vault.leggi(); } catch (e) { return { ...r, saltata: 'errore', errore: e?.message || String(e) }; }
  if (testo != null) {
    if (impronta(testo) === s.impronta && !forza) return { ...r, saltata: 'uguale' };
    const n = leggiNota(testo, D.carte);
    if (!n.giro) return { ...r, saltata: 'estranea' };   // un «In tasca.md» senza il segno di Lode è dello studente: non si tocca
    if (n.giro !== s.giro) { if (!riscrivi) return { ...r, saltata: 'vecchia' }; }
    else {
      const fatte = new Set(s.fatte);
      for (const e of n.esiti) {
        if (fatte.has(e.id)) continue;
        const c = D.carte.find(x => x.id === e.id); if (!c) continue;
        if (e.id in s.carte && s.carte[e.id] !== segno(c)) { r.gia++; fatte.add(e.id); s.fatte.push(e.id); continue; }   // fatta sul computer
        rispondi(c, e.sapevo ? 4 : 0); fatte.add(e.id); s.fatte.push(e.id); r.segnate++; if (e.sapevo) r.sapevo++;
      }
      if (r.segnate || r.gia) salva();
    }
  } else if (!forza) return { ...r, saltata: 'manca' };
  // prima di scrivere si rilegge: se è cambiata nel frattempo (Obsidian sta ancora sincronizzando) si riprova al giro dopo
  let ora;
  try { ora = await vault.leggi(); } catch (e) { return { ...r, saltata: 'errore', errore: e?.message || String(e) }; }
  if ((ora == null ? null : impronta(ora)) !== (testo == null ? null : impronta(testo))) return { ...r, saltata: 'cambiata' };
  const carte = scegli(D.carte, T, D.esami), nuovo = id(), nota = scriviNota(carte, D.esami, nuovo, T);
  try { await vault.scrivi(nota); } catch (e) { return { ...r, saltata: 'errore', errore: e?.message || String(e) }; }
  Object.assign(s, { giro: nuovo, impronta: impronta(nota), scritta: T, fatte: [], carte: Object.fromEntries(carte.map(c => [c.id, segno(c)])) }); salva();
  return { ...r, scritte: carte.length };
}

/* ---------- quando gira da solo ---------- */
// all'avvio (vault pronto): solo se la nota c'è o la sera è accesa. Con la sera accesa, dopo le 19, una volta al giorno
// (D.tasca.scritta < oggi) il giro riscrive la nota per domani: un timer suo da 30 minuti, non quello dell'allenatore
export const DALLE = 19;
const ePronta = (s, adesso) => s.sera && adesso.getHours() >= DALLE && (s.scritta || '') < oggi();
export async function controlla({ adesso = new Date(), vault = vaultVero } = {}) {
  const s = stato();
  if (ePronta(s, adesso)) return aggiorna({ forza: true, vault });
  return aggiorna({ vault });   // senza forza: con la nota che manca o uguale non fa niente
}
let avviato = false;
export function avvia(fatto = () => { }) {
  if (avviato || !V.attivo) return; avviato = true;
  const parti = () => {
    const s = stato();
    vaultVero.leggi().then(t => (t != null || s.sera ? controlla() : null)).then(x => x && fatto(x)).catch(() => { });
    setInterval(() => { if (ePronta(stato(), new Date())) aggiorna({ forza: true }).then(fatto).catch(() => { }); }, 30 * 60e3);
  };
  if (V.info) return parti();
  const su = () => { if (!V.info) return; removeEventListener('lode:vault', su); parti(); };
  addEventListener('lode:vault', su);
}
export const sera = acceso => { stato().sera = !!acceso; salva(); };
export const apri = () => V.apriDiario({ file: file() });
