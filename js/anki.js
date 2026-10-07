// «Esporta per Anki»: le carte del ripasso (SM-2) e le definizioni delle lezioni (termine → definizione) in un file di testo
// che Anki importa da solo (File › Importa, Anki 2.1.54 o successivo). Logica pura, senza DOM: la provano test/unita.mjs
// e test/prova-app.mjs; la barra (js/lode.js) sceglie le carte, salva il file nel vault (Anki/…) o lo scarica nel browser.
//
// Un file solo, anche con più corsi: ogni riga dice il suo mazzo (Lode::<Corso>), così basta un'importazione. Le intestazioni:
//   #separator:tab · #html:true · #notetype:Basic · #tags column:3 · #deck column:4 · #guid column:5
// Perché la colonna del mazzo e non «#deck:Lode::<Corso>»: secondo il manuale di Anki #deck sceglie il mazzo solo se esiste
// già (la prima volta le carte finirebbero nel mazzo «Predefinito»), la colonna invece crea il mazzo che manca.
// La colonna guid dà a ogni carta un'identità fissa: se lo studente esporta e importa di nuovo, Anki aggiorna le note che
// ha già invece di farne doppioni. Una riga per carta: fronte, retro, tag («lode» e il corso), mazzo, guid.
// Il tipo di nota: #notetype vuole il nome che il tipo ha nella lingua di Anki. «Basic» c'è solo nell'Anki in inglese; in
// italiano si chiama «Basilare», e un nome che non esiste viene ignorato: Anki usa il tipo scelto l'ultima volta (con
// «Cloze» le carte danno errore al ripasso, con «Basilare (e carta inversa)» diventano il doppio). Nessun nome vale in tutte
// le lingue, quindi resta «Basic» e la barra dice di scegliere «Basilare» nella finestra d'importazione (js/lode.js, README).
import { norm } from './dati.js';
import { pulito } from './markdown.js';
import { t, locale } from './lingua.js';

const INTESTAZIONE = ['#separator:tab', '#html:true', '#notetype:Basic', '#tags column:3', '#deck column:4', '#guid column:5'];

// $$…$$ (in blocco) e $…$ (in linea), come in Obsidian: niente spazio subito dentro i $, e «5$ e 10$» resta testo.
// Un \$ è un dollaro scritto apposta e non apre niente, e nemmeno un $ dopo una cifra (un prezzo: «costa 5$, usato 3$»).
const FORMULE = /(?<!\\)\$\$([\s\S]+?)\$\$|(?<![\\$\d])\$(?=[^\s$])((?:[^$\n\\]|\\.)+?)(?<=\S)\$(?![\d$])/g;
// il codice in linea, `…`: come in Obsidian vince sulle formule («`$*` e `$@` in bash» resta codice, non diventa MathJax)
const CODICE = /`([^`\n]+)`/g;
// l'HTML del testo protetto: & < > e le virgolette (un " all'inizio del campo aprirebbe un campo «tra virgolette» per Anki).
// L'apostrofo no: in italiano è dappertutto, e in Anki un &#39; non si troverebbe più cercando «cos'è»
const html = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const formula = x => html(String(x).replace(/\s*\n\s*/g, ' ').replace(/\t/g, ' ').trim());

// un campo per Anki: HTML del testo protetto, `codice` → <code>, $…$ → \(…\) e $$…$$ → \[…\] (MathJax di Anki), e il
// Markdown delle note di Obsidian: [[nota]] e [[nota|alias]] → il testo che si legge, ==evidenziato== → <mark>,
// **grassetto** → <b>, *corsivo* → <i>. A capo → <br>, tab → spazio, \$ (il dollaro scritto apposta) → $.
// Codice e formule si mettono da parte prima (segnaposto \x00n\x00): dentro non si tocca niente. Un # all'inizio sarebbe un
// commento per Anki: diventa &#35;
export function campo(testo) {
  const parte = [], metti = x => { parte.push(x); return `\x00${parte.length - 1}\x00`; };
  let s = String(testo ?? '').replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').trim();
  s = s.replace(CODICE, (_, x) => metti(`<code>${html(x.replace(/\t/g, ' '))}</code>`));
  s = s.replace(FORMULE, (_, blocco, linea) => metti(blocco != null ? `\\[${formula(blocco)}\\]` : `\\(${formula(linea)}\\)`));
  s = html(s.replace(/\\\$/g, '$'))
    .replace(/\[\[(?:[^\]|\n]*\|)?([^\]\n]+)\]\]/g, '$1')
    .replace(/==(?=\S)(.+?)(?<=\S)==/g, '<mark>$1</mark>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/\n/g, '<br>').replace(/\t/g, ' ');
  return s.replace(/\x00(\d+)\x00/g, (_, i) => parte[+i]).replace(/^#/, '&#35;');
}
// il corso come tag di Anki: niente spazi (separano i tag), niente accenti né simboli, tranne + e # che distinguono i corsi
// di programmazione. «Analisi 2» → analisi_2, «Programmazione in C++» → programmazione_in_c++
export const tagCorso = corso => String(corso || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9+#]+/g, '_').replace(/^_+|_+$/g, '') || t('anki.tag-varie');
// il mazzo: Lode::<Corso>. Niente «::» dentro il nome (farebbe un sotto-mazzo), niente virgolette, tab o a capo, e niente
// «:» o spazi ai bordi (con «:Fisica» Anki dividerebbe le carte fra «Lode::Fisica» e un «Lode::Fisica+» nuovo)
export const mazzo = corso => 'Lode::' + (String(corso || '').replace(/[\x00-\x1f\x7f"]/g, ' ').replace(/:{2,}/g, ':').replace(/\s+/g, ' ').replace(/^[\s:]+|[\s:]+$/g, '') || t('anki.varie'));
// la chiave dei doppioni e dei mazzi: non contano maiuscole, accenti, spazi doppi e la punteggiatura alla fine, i simboli sì.
// Così «`i++`» e «`++i`», «$a<b$» e «$a>b$», «Programmazione in C» e «Programmazione in C++» restano diversi
const chiave = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').replace(/[\s.?!:;,]+$/, '').trim();
// un'impronta corta e stabile (cyrb53): la stessa definizione dà sempre lo stesso guid
function impronta(s) {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
}

// le voci da esportare, divise per corso e senza doppioni. carte: [{ id, fronte, retro, corso }] (le carte del ripasso, col
// nome del loro esame); definizioni: [{ t, d, corso }] (dalle lezioni). Doppione = stesso corso e stesso fronte, a meno di
// maiuscole, accenti e punteggiatura finale (chiave): vince la prima, e le carte del ripasso vengono prima delle definizioni.
// corso: null = tutti; altrimenti un nome o una funzione nome → sì/no. Ritorna i mazzi in ordine alfabetico.
export function preparaAnki({ carte = [], definizioni = [], corso = null } = {}) {
  const vale = !corso ? () => true : typeof corso === 'function' ? corso : n => norm(n) === norm(corso);
  const per = new Map(), visti = new Set(); let doppioni = 0;
  const metti = (nomeCorso, fronte, retro, guid, tipo) => {
    nomeCorso = String(nomeCorso || '').trim() || t('anki.varie');
    if (!vale(nomeCorso) || !String(fronte || '').trim() || !String(retro || '').trim()) return;
    const kc = chiave(nomeCorso), k = kc + '|' + (chiave(fronte) || String(fronte).trim());
    if (visti.has(k)) { doppioni++; return; } visti.add(k);
    if (!per.has(kc)) per.set(kc, { corso: nomeCorso, voci: [] });
    per.get(kc).voci.push({ fronte, retro, guid, tipo });
  };
  for (const c of carte) metti(c.corso, c.fronte, c.retro, `lode-c-${c.id || impronta(chiave(c.corso) + '|' + chiave(c.fronte))}`, 'carta');
  for (const d of definizioni) metti(d.corso, d.t, d.d, `lode-d-${impronta(chiave(d.corso) + '|' + chiave(d.t))}`, 'definizione');
  const mazzi = [...per.values()].sort((a, b) => a.corso.localeCompare(b.corso, locale()));
  return { mazzi, totale: mazzi.reduce((t, m) => t + m.voci.length, 0), doppioni };
}

// il testo del file: le intestazioni, poi una riga per carta
export function testoAnki(mazzi) {
  const righe = mazzi.flatMap(m => m.voci.map(v => [campo(v.fronte), campo(v.retro), `lode ${tagCorso(m.corso)}`, mazzo(m.corso), v.guid].join('\t')));
  return [...INTESTAZIONE, ...righe].join('\n') + '\n';
}

// il nome del file: «Lode per Anki 2026-10-02.txt» con tutti i corsi, «Analisi 2 per Anki 2026-10-02.txt» con uno solo
export const nomeFileAnki = (corso, data) => t('anki.nome-file', { corso: corso ? pulito(corso) : 'Lode', data });
