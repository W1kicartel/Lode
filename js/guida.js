// «Voglio fare…»: la guida passo passo. Lo studente scrive «voglio fare un sito» (js/comandi/<codice>.js, { tipo: 'voglio', q }),
// Lode trova le app utili sul computer (desktop/app-utili.mjs), le apre solo dopo il clic e spiega il lavoro un passo alla
// volta fino alla fine. Il piano lo scrive l'AI quando c'è (js/ai.js, pianoGuida: un JSON che qui si valida per bene), se no
// una delle ricette scritte a mano (i testi sono nel catalogo «guida», js/lingue/<codice>/guida.js), se no un piano generico.
// Qui c'è solo la parte pura (si prova in node, test/guida.mjs): le ricette, la scelta, la validazione, la nota del vault.
// Le schede sono in js/lode.js. L'avanzamento sta in D.guida (js/dati.js), null quando non c'è una guida a metà.
import { t, elenco, tIn } from './lingua.js';

export const MAX_PASSI = 10;
const MAX = { titolo: 80, cosa: 520, fatto: 180, app: 60 };

// le ricette: quanti passi, quali sono di codice (da 1) e le app candidate (si aprono solo se ci sono). Le parole che le
// riconoscono sono nelle sei lingue, senza accenti (testo passato da semplice()), come fanno i lettori dei testi incollati
const A = {
  scrivere: /^(?:microsoft word|word|pages|libreoffice(?: writer)?|onlyoffice|zotero|obsidian|texshop|texstudio|texmaker|overleaf)$/i,
  presentare: /^(?:keynote|microsoft powerpoint|powerpoint|libreoffice(?: impress)?|onlyoffice|canva|google slides)$/i,
  video: /^(?:imovie|final cut pro|davinci resolve|shotcut|kdenlive|openshot|capcut|clipchamp|obs|obs studio|quicktime player|lumafusion)$/i,
  dati: /^(?:microsoft excel|excel|numbers|libreoffice(?: calc)?|onlyoffice|rstudio|jupyterlab|anaconda-navigator|python3|spss|jasp|jamovi|matlab)$/i,
  editor: /^(?:visual studio code|code|cursor|zed|sublime text|terminal|terminale|iterm|warp|windows terminal|git|github desktop|claude code|codex|gemini cli)$/i,
  browser: /^(?:safari|google chrome|chrome|firefox|microsoft edge|arc|brave browser)$/i,
  python: /^(?:python3|pycharm(?: ce| community edition| professional edition)?|thonny|idle|spyder|jupyterlab)$/i,
  c: /^(?:gcc|clang|xcode|clion|code::blocks|codeblocks|dev-c\+\+)$/i,
  java: /^(?:java|intellij idea(?: ce| community edition| ultimate)?|eclipse|netbeans|bluej)$/i,
  web: /^(?:node)$/i,
  studio: /^(?:obsidian|anki)$/i,
};
export const RICETTE = {
  esame: { passi: 5, app: [A.studio], parole: /\b(?:esam[ei]|appello|prepararmi|exams?|examen(?:es)?|parcial|partiel|prufung|klausur|provas?|vestibular)\b/ },
  tesi: { passi: 6, app: [A.scrivere], parole: /\b(?:tesi|tesina|relazione|saggio|thesis|dissertation|report|essay|term paper|tesis|tfg|tfm|informe|ensayo|memoire|rapport|bachelorarbeit|masterarbeit|hausarbeit|abschlussarbeit|seminararbeit|bericht|tcc|monografia|relatorio|artigo)\b/ },
  presentazione: { passi: 5, app: [A.presentare], parole: /\b(?:presentazion\w*|slide\w*|powerpoint|keynote|presentations?|presentacion\w*|diapositiva\w*|presentation|exposes?|prasentation\w*|vortrag|folien|apresentac\w*|seminario)\b/ },
  video: { passi: 5, app: [A.video], parole: /\b(?:video(?!gioc|game|jueg|jogo|spiel)\w*|filmato|montare|montaggio|montage|youtube|vlog|reel|tiktok|cortometraggio|short film|film|clip|schneiden|editar um video)\b/ },
  dati: { passi: 5, app: [A.dati], parole: /\b(?:dati|grafic[oi]|statistic\w*|excel|data|charts?|graphs?|plots?|spreadsheet|datos|grafica|estadistic\w*|donnees|graphique\w*|tableur|daten|diagramm\w*|auswertung|tabellenkalkulation|dados|planilha|estatistic\w*)\b/ },
  sito: { passi: 5, app: [A.editor, A.browser], codice: [2, 3, 4], parole: /\b(?:sito|siti|website|web ?site|web|pagina web|portfolio|landing|homepage|blog|site|sitio|pagina|webseite|internetseite)\b/ },
  codice: { passi: 5, app: [A.editor], codice: [2, 3, 4, 5], parole: /\b(?:programm\w*|codice|cod(?:e|ing)|python|java|javascript|typescript|c\+\+|c|rust|app|software|script|algoritm\w*|codigo|programa\w*|logiciel|coder|entwickeln|spiel|game|gioco|videogioco|juego|jeu|jogo|bot|esercizio di laboratorio|lab)\b/ },
};
// l'ordine conta: «preparare l'esame di programmazione» è un esame, «una presentazione sui dati» è una presentazione
const ORDINE = ['esame', 'tesi', 'presentazione', 'video', 'sito', 'dati', 'codice'];
// il linguaggio di una ricetta di codice
const LINGUAGGI = [['python', /\bpython\b/, 'Python'], ['java', /\bjava\b(?!\s*script)/, 'Java'], ['c', /\bc(?:\+\+)?\b(?!#)/, 'C'], ['web', /\b(?:html|css|javascript|js|typescript|web)\b/, 'HTML, CSS e JavaScript']];

// minuscolo, senza accenti, con gli spazi in ordine
export const semplice = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
export function scegliRicetta(q) {
  const s = semplice(q);
  const chiave = ORDINE.find(k => RICETTE[k].parole.test(s)) || 'generico';
  const l = chiave === 'codice' || chiave === 'sito' ? LINGUAGGI.find(([, r]) => r.test(s)) : null;
  return { chiave, linguaggio: l ? l[0] : null, nomeLinguaggio: l ? (l[0] === 'web' ? 'HTML, CSS, JavaScript' : l[2]) : null };
}
// le app di una ricetta fra quelle trovate sul computer: al massimo 5, nell'ordine dell'elenco del main
export function appPer(chiave, linguaggio, trovate = []) {
  const regole = [...(RICETTE[chiave]?.app || []), ...(linguaggio && A[linguaggio] ? [A[linguaggio]] : [])];
  return trovate.filter(a => regole.some(r => r.test(a.nome))).sort((a, b) => (a.tipo === 'cli') - (b.tipo === 'cli')).slice(0, 5).map(a => a.nome);
}
const riempi = (s, p) => String(s).replace(/\{(\w+)\}/g, (x, k) => (k in p ? p[k] : x));
// il piano di una ricetta (o quello generico), con i testi della lingua della barra
export function pianoDaRicetta(q, trovate = []) {
  const r = scegliRicetta(q), R = RICETTE[r.chiave], n = R?.passi || 4;
  const p = { linguaggio: r.nomeLinguaggio || t('guida.linguaggio') };
  const passi = [];
  for (let k = 1; k <= n; k++) {
    const [titolo, cosa, fattoQuando, aiuto] = elenco(`guida.r-${r.chiave}-${k}`).map(x => riempi(x, p));
    passi.push({ titolo, cosa, fattoQuando, aiuto, ...(R?.codice?.includes(k) ? { codice: true } : {}) });
  }
  return { titolo: maiuscola(q), fonte: r.chiave === 'generico' ? 'generico' : 'ricetta', ricetta: r.chiave, linguaggio: r.linguaggio, app: appPer(r.chiave, r.linguaggio, trovate), passi };
}
const maiuscola = s => { s = String(s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

/* ---------- il piano dell'AI: si valida tutto ---------- */
// un testo tagliato alla lunghezza giusta, alla fine di una frase o di una parola
export function taglia(s, max) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const x = s.slice(0, max), f = x.search(/[.!?](?=[^.!?]*$)/);
  return f > max * .5 ? x.slice(0, f + 1) : x.replace(/\s+\S*$/, '') + '…';
}
// al più 4 frasi
const frasi = (s, n = 4) => (String(s).match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [s]).slice(0, n).join('').trim();
export const SCHEMA_PIANO = { type: 'object', additionalProperties: false, required: ['titolo', 'app', 'passi'], properties: {
  titolo: { type: 'string' }, app: { type: 'array', items: { type: 'string' } },
  passi: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['titolo', 'cosa', 'fattoQuando'], properties: {
    titolo: { type: 'string' }, cosa: { type: 'string' }, app: { type: 'string' }, fattoQuando: { type: 'string' }, codice: { type: 'boolean' } } } } } };
// il JSON dell'AI → il piano, o null se non va (allora si usa la ricetta). Le app sono SOLO quelle dell'elenco passato
export function validaPiano(x, nomiApp = []) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.passi)) return null;
  const nomi = new Map(nomiApp.map(n => [semplice(n), n]));
  const app = n => (typeof n === 'string' ? nomi.get(semplice(n)) || null : null);
  const passi = [];
  for (const p of x.passi.slice(0, MAX_PASSI)) {
    if (!p || typeof p !== 'object') return null;
    const titolo = taglia(p.titolo, MAX.titolo), cosa = taglia(frasi(String(p.cosa ?? '')), MAX.cosa), fattoQuando = taglia(p.fattoQuando, MAX.fatto);
    if (!titolo || !cosa) return null;
    const a = app(p.app);
    passi.push({ titolo, cosa, fattoQuando, ...(a ? { app: a } : {}), ...(p.codice === true ? { codice: true } : {}) });
  }
  if (!passi.length) return null;
  const titolo = taglia(x.titolo, MAX.titolo);
  return { titolo: titolo || null, app: [...new Set((Array.isArray(x.app) ? x.app : []).map(app).filter(Boolean))].slice(0, 6), passi };
}
// «Non ci riesco» con l'AI: una spiegazione più semplice e, se serve, il passo diviso in sotto-passi
export const SCHEMA_AIUTO = { type: 'object', additionalProperties: false, required: ['spiegazione', 'sottopassi'], properties: { spiegazione: { type: 'string' }, sottopassi: { type: 'array', items: { type: 'string' } } } };
export function validaAiuto(x) {
  if (!x || typeof x !== 'object') return null;
  const spiegazione = taglia(frasi(String(x.spiegazione ?? ''), 5), 600);
  const sottopassi = (Array.isArray(x.sottopassi) ? x.sottopassi : []).map(s => taglia(s, 200)).filter(Boolean).slice(0, 6);
  return spiegazione || sottopassi.length ? { spiegazione, sottopassi } : null;
}

/* ---------- lo stato (D.guida) ---------- */
export function nuova(q, piano, adesso = Date.now()) {
  return { id: 'g' + adesso.toString(36), q: String(q), titolo: piano.titolo || maiuscola(q), fonte: piano.fonte, ricetta: piano.ricetta || null, linguaggio: piano.linguaggio || null,
    app: piano.app || [], passi: piano.passi, i: 0, fatti: [], creata: adesso, aggiornata: adesso, nota: null };
}
// avanti: il passo i è fatto; indietro: si torna al passo prima (resta fatto). Restituiscono la guida aggiornata
export function avanti(g, adesso = Date.now()) {
  if (g.i >= g.passi.length) return g;
  const fatti = [...new Set([...(g.fatti || []), g.i])].sort((a, b) => a - b);
  return { ...g, fatti, i: Math.min(g.i + 1, g.passi.length), aggiornata: adesso };
}
export const indietro = (g, adesso = Date.now()) => ({ ...g, i: Math.max(0, g.i - 1), aggiornata: adesso });
export const finita = g => !!g && g.i >= g.passi.length;
// una guida a metà che si può riprendere (anche una vecchia, scritta da una versione di prima: si controlla la forma)
export const aMeta = g => !!g && Array.isArray(g.passi) && g.passi.length > 0 && Number.isInteger(g.i) && g.i < g.passi.length;
// il testo da mandare a Claude Code per un passo (si può cambiare nella scheda prima di confermare)
export const testoAgente = (g, p) => t('guida.prompt-agente', { obiettivo: g.titolo, passo: p.titolo, cosa: p.cosa });

/* ---------- la nota nel vault: una checklist, nella lingua del vault ---------- */
// il nome della cartella: il titolo senza i caratteri che i file non vogliono
export const nomeCartella = s => String(s || '').replace(/[\\/:*?"<>|#^[\]\0]/g, ' ').replace(/^\.+/, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Lode';
export function testoNota(g, cod) {
  const righe = g.passi.map((p, k) => {
    const casella = (g.fatti || []).includes(k) ? 'x' : ' ';
    const sotto = [p.cosa, p.fattoQuando ? `*${tIn(cod, 'guida.nota-quando')}: ${p.fattoQuando}*` : ''].filter(Boolean).map(x => `    ${x}`).join('\n');
    return `- [${casella}] **${p.titolo}**${p.app ? ` · ${p.app}` : ''}\n${sotto}`;
  });
  return `${tIn(cod, 'guida.nota-intro')}\n\n${righe.join('\n')}`;
}
export const notaNuova = g => `# ${g.titolo}\n\n`;
