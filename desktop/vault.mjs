// Il vault Obsidian di Lode. Alla prima apertura nasce in Documenti/Lode, già pronto per Obsidian: cartelle, modello
// della lezione, orario, la nota «Memoria» e un tema bianco e nero. Se Obsidian è installato, il vault viene aggiunto
// alla sua lista, così lo studente lo trova già collegato. Lode non sovrascrive mai un file che esiste.
// Poi lo guarda: ogni volta che lo studente scrive una lezione in Obsidian, la barra rilegge definizioni e ★.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync, rmSync, watch } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, relative, resolve, sep, isAbsolute } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

let M = null;   // js/markdown.js, condiviso con la barra
export async function carica(web) { M = await import(pathToFileURL(join(web, 'js', 'markdown.js')).href); }

// scrittura atomica: file temporaneo, poi rename. Su Windows il rename fallisce (EPERM/EACCES/EBUSY) se OneDrive, l'antivirus
// o Obsidian tengono aperta la nota: si riprova per circa un secondo, poi si scrive sul posto. Il .tmp si cancella sempre.
const OCCUPATO = new Set(['EPERM', 'EACCES', 'EBUSY']), ATTESA = new Int32Array(new SharedArrayBuffer(4));
const scriviSicuro = (f, testo) => {
  mkdirSync(dirname(f), { recursive: true });
  const t = f + '.tmp-' + process.pid + '-' + randomBytes(3).toString('hex');
  try {
    writeFileSync(t, testo);
    for (let i = 0; ; i++) {
      try { return renameSync(t, f); } catch (e) {
        if (process.platform !== 'win32' || !OCCUPATO.has(e.code)) throw e;   // altrove EPERM/EACCES sono definitivi: niente attesa
        if (i >= 8) return writeFileSync(f, testo);   // non atomico, ma niente va perso
        Atomics.wait(ATTESA, 0, 0, Math.min(25 * 2 ** i, 250));
      }
    }
  } finally { try { rmSync(t, { force: true }); } catch { } }
};
const seManca = (f, testo) => { if (!existsSync(f)) scriviSicuro(f, testo); };
// un percorso relativo chiesto dalla barra, normalizzato prima di ogni controllo sulle cartelle: barre in «/», niente
// percorsi assoluti (C:\, /, \\server), niente segmenti «..» e niente cartelle o file che cominciano col punto (.obsidian,
// .lode, .git): lì Lode non scrive e non legge mai per conto della barra. «./» e le barre doppie si tolgono
export function relativo(rel) {
  const s = String(rel ?? '').replace(/\\/g, '/');
  if (!s || s.startsWith('/') || /^[a-z]:/i.test(s) || s.includes('\0')) throw new Error('percorso non permesso');
  const parti = s.split('/').filter(x => x && x !== '.');
  if (!parti.length || parti.some(x => x.startsWith('.'))) throw new Error('percorso non permesso');
  return parti.join('/');
}
// ogni percorso chiesto dalla barra deve restare dentro il vault (anche se il vault è la radice di un disco, E:\ o \\server\share)
export function dentro(vault, rel) {
  const base = resolve(vault), p = resolve(base, String(rel || '').replace(/^[/\\]+/, '')), r = relative(base, p);
  if (r === '..' || r.startsWith('..' + sep) || isAbsolute(r)) throw new Error('percorso fuori dal vault');
  return p;
}

const BENVENUTO = `# Benvenuto nel tuo vault

Questo vault l'ha preparato **Lode**, l'assistente che vive in cima allo schermo. È un normale vault di Obsidian: le note sono tue, in Markdown, e restano su questo computer.

## Come lavorano insieme
- **In aula** Lode sa quando sei a lezione (dall'[[Orario]]) e tiene pronta la nota della lezione in \`Lezioni/<corso>/\`. Dalla barra segni al volo:
  - **★ Da esame** (⌃⌥S): cosa il prof ha detto che chiederà;
  - **Definizione** (⌃⌥D): «termine: definizione»;
  - **Domanda** (⌃⌥Q): da fare al prof.
- **Gli appunti** li scrivi qui, in Obsidian, come sempre. Le definizioni che metti nella sezione «Definizioni» (\`- **Termine**: definizione\`) o scritte come \`Termine :: definizione\` Lode le trova da solo.
- **A casa** la barra ti propone due minuti di gioco sulle definizioni dell'ultima lezione, quando stanno per scappare.
- **[[Memoria]]** (in \`Lode/\`) è quello che Lode ha imparato di te: definizioni sicure, da rinforzare, come studi. Nella sezione «Note per Lode» puoi dirgli come vuoi essere aiutato.

## Scorciatoie
| | Mac | Windows |
|---|---|---|
| Apri Lode e scrivi | ⌥ Spazio | Ctrl ⇧ Spazio |
| ★ Da esame | ⌃⌥ S | Ctrl Alt S |
| Definizione | ⌃⌥ D | Ctrl Alt D |
| Domanda per il prof | ⌃⌥ Q | Ctrl Alt Q |
| Gioco di memoria | ⌃⌥ G | Ctrl Alt G |
`;
const MODELLO = `---
corso: "[[]]"
data: {{date:YYYY-MM-DD}}
tipo: lezione
tags: [lezione]
---
# {{title}}

## Appunti


## ★ Da esame


## Definizioni
%% Una per riga: - **Termine**: definizione. Lode ne fa giochi di memoria e carte. %%


## Domande per il prof

`;
const MODELLO_ESAME = `---
tipo: esame
corso: "[[]]"
appello: {{date:YYYY-MM-DD}}
tags: [esame]
---
# {{title}}

## Programma


## Domande che fanno sempre
%% Quelle che senti dai colleghi o trovi nei vecchi appelli. Lode le usa per interrogarti. %%


## Esercizi tipo


## Cosa mi manca

`;
const MODELLO_RIPASSO = `---
tipo: ripasso
corso: "[[]]"
data: {{date:YYYY-MM-DD}}
tags: [ripasso]
---
# Ripasso · {{title}}

## In tre righe


## Definizioni
%% - **Termine**: definizione. Finiscono nei giochi di Lode. %%


## Collegamenti
%% Le lezioni e i concetti legati: [[...]] %%
`;
const MEMORIA = `---
tipo: memoria
---
# Cosa so di te

%% Questa nota la scrive Lode dopo ogni gioco. La sezione «Note per Lode» resta tua: la leggo ogni volta che uso l'AI. %%

## In breve
- Ancora niente: segna qualche definizione in aula e gioca una partita.

## Note per Lode
%% Scrivi qui come vuoi essere aiutato: «spiegami con esempi pratici», «frasi brevi», «l'orale di Analisi è molto teorico». %%
`;
const TEMA = `/* Lode: bianco e nero, come la barra. Attivo da Impostazioni > Aspetto > Snippet CSS. */
.theme-dark{--interactive-accent:#fff;--interactive-accent-hover:#e4e4e4;--text-on-accent:#000;--text-accent:#fff;--background-primary:#0a0a0a;--background-secondary:#111;--h1-weight:600;--h2-weight:600}
.theme-light{--interactive-accent:#0a0a0a;--interactive-accent-hover:#2a2a2a;--text-on-accent:#fff;--text-accent:#0a0a0a}
body{--font-text-theme:"Geist",-apple-system,"Segoe UI",sans-serif;--font-monospace-theme:"Geist Mono",ui-monospace,monospace}
.markdown-rendered h2{letter-spacing:-.02em}
`;

export function crea(vault, orario = []) {
  for (const d of ['Lezioni', 'Corsi', 'Lode', 'Modelli', 'Allegati', 'Inbox', '.lode']) mkdirSync(join(vault, d), { recursive: true });
  seManca(join(vault, 'Benvenuto.md'), BENVENUTO);
  seManca(join(vault, 'Orario.md'), M.orarioMd(orario));
  seManca(join(vault, 'Lode', 'Memoria.md'), MEMORIA);
  seManca(join(vault, 'Modelli', 'Lezione.md'), MODELLO);
  seManca(join(vault, 'Modelli', 'Esame.md'), MODELLO_ESAME);
  seManca(join(vault, 'Modelli', 'Ripasso.md'), MODELLO_RIPASSO);
  for (const [f, t] of [['Home.md', 'Home'], ['Esami.md', 'Esami'], ['Glossario.md', 'Glossario']]) seManca(join(vault, f), `# ${t}\n\n%% lode:pagina %%\n%% /lode:pagina %%\n`);
  // il vault l'ha creato Lode? allora possiamo preparare anche la disposizione di Obsidian
  let nostro = false; try { nostro = readFileSync(join(vault, 'Benvenuto.md'), 'utf8').includes("l'ha preparato **Lode**"); } catch { }
  // la configurazione di Obsidian solo se il vault è nuovo: in un vault esistente non tocchiamo niente
  const ob = join(vault, '.obsidian');
  if (!existsSync(ob)) {
    seManca(join(ob, 'app.json'), JSON.stringify({ attachmentFolderPath: 'Allegati', newFileLocation: 'folder', newFileFolderPath: 'Inbox', alwaysUpdateLinks: true, showUnsupportedFiles: false }, null, 2));
    seManca(join(ob, 'appearance.json'), JSON.stringify({ theme: 'obsidian', accentColor: '#ffffff', enabledCssSnippets: ['lode'] }, null, 2));
    seManca(join(ob, 'templates.json'), JSON.stringify({ folder: 'Modelli', dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm' }, null, 2));
    seManca(join(ob, 'core-plugins.json'), JSON.stringify({ 'file-explorer': true, 'global-search': true, switcher: true, graph: true, backlink: true, 'outgoing-link': true, 'tag-pane': true, 'page-preview': true, templates: true, 'note-composer': true, 'command-palette': true, outline: true, 'word-count': true, 'file-recovery': true, bookmarks: true, 'daily-notes': false }, null, 2));
    seManca(join(ob, 'snippets', 'lode.css'), TEMA);
  }
  if (nostro) {
    // Obsidian si apre sulla Home, con le cartelle e i segnalibri a sinistra, i collegamenti in entrata e l'indice a destra
    seManca(join(ob, 'workspace.json'), JSON.stringify(DISPOSIZIONE, null, 2));
    const t = Date.now();
    seManca(join(ob, 'bookmarks.json'), JSON.stringify({ items: [['Home.md', 'Home'], ['Orario.md', 'Orario'], ['Esami.md', 'Esami'], ['Glossario.md', 'Glossario'], ['Lode/Memoria.md', 'Cosa sa Lode di me']].map(([path, title]) => ({ type: 'file', ctime: t, path, title })) }, null, 2));
  }
}
const DISPOSIZIONE = {
  main: { id: 'lode-main', type: 'split', direction: 'vertical', children: [{ id: 'lode-tabs', type: 'tabs', children: [{ id: 'lode-home', type: 'leaf', state: { type: 'markdown', state: { file: 'Home.md', mode: 'preview', source: false } } }] }] },
  left: { id: 'lode-left', type: 'split', direction: 'horizontal', width: 260, children: [{ id: 'lode-left-tabs', type: 'tabs', children: [
    { id: 'lode-files', type: 'leaf', state: { type: 'file-explorer', state: { sortOrder: 'alphabetical' } } },
    { id: 'lode-bm', type: 'leaf', state: { type: 'bookmarks', state: {} } },
    { id: 'lode-search', type: 'leaf', state: { type: 'search', state: { query: '' } } }] }] },
  right: { id: 'lode-right', type: 'split', direction: 'horizontal', width: 280, children: [{ id: 'lode-right-tabs', type: 'tabs', children: [
    { id: 'lode-back', type: 'leaf', state: { type: 'backlink', state: { file: 'Home.md', collapseAll: false, extraContext: false, sortOrder: 'alphabetical', showSearch: false, searchQuery: '', backlinkCollapsed: false, unlinkedCollapsed: true } } },
    { id: 'lode-outline', type: 'leaf', state: { type: 'outline', state: { file: 'Home.md' } } }] }] },
  active: 'lode-home', lastOpenFiles: ['Home.md'],
};

/* ---------- blocchi di Lode dentro le note: tutto ciò che sta fuori dai segni resta dello studente ---------- */
const segni = id => [`%% lode:${id} %%`, `%% /lode:${id} %%`];
export function blocco(vault, { file, id, testo, nuovo, dove = 'fine' }) {
  const p = dentro(vault, file);
  if (!existsSync(p)) { if (!nuovo) return false; scriviSicuro(p, nuovo); }
  const prima = readFileSync(p, 'utf8'), [a, b] = segni(id), blocco = `${a}\n${testo.trim()}\n${b}`;
  let dopo;
  const i = prima.indexOf(a), j = prima.indexOf(b);
  if (i >= 0 && j > i) dopo = prima.slice(0, i) + blocco + prima.slice(j + b.length);
  else if (dove === 'titolo') { const m = prima.match(/^# .*$/m); dopo = m ? prima.slice(0, m.index + m[0].length) + '\n' + blocco + prima.slice(m.index + m[0].length) : blocco + '\n' + prima; }
  else dopo = prima.replace(/\s*$/, '\n\n') + blocco + '\n';
  if (dopo === prima) return false;
  scriviSicuro(p, dopo); return true;
}
// tutte le note, per la ricerca rapida dalla barra
export function note(vault) {
  return mdSotto(vault).map(f => relative(vault, f).split(sep).join('/')).filter(f => !f.startsWith('Modelli/')).map(f => ({ file: f, titolo: f.split('/').pop().replace(/\.md$/, ''), cartella: f.includes('/') ? f.split('/')[0] : '' }));
}

/* ---------- Obsidian: è installato? il vault è nella sua lista? ---------- */
function cartellaObsidian() {
  if (process.env.LODE_OBSIDIAN_DIR) return process.env.LODE_OBSIDIAN_DIR;   // solo per le prove
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'obsidian');
  if (process.platform === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'obsidian');
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'obsidian');
}
export function obsidian(vault) {
  const conf = join(cartellaObsidian(), 'obsidian.json');
  const app = process.platform === 'darwin' ? ['/Applications/Obsidian.app', join(homedir(), 'Applications', 'Obsidian.app')]
    : process.platform === 'win32' ? [join(process.env.LOCALAPPDATA || '', 'Programs', 'Obsidian', 'Obsidian.exe'), join(process.env.LOCALAPPDATA || '', 'Obsidian', 'Obsidian.exe'),
      join(process.env.ProgramFiles || 'C:\\Program Files', 'Obsidian', 'Obsidian.exe'), join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Obsidian', 'Obsidian.exe')]   // anche «per tutti gli utenti»
    : ['/usr/bin/obsidian', '/opt/Obsidian/obsidian', join(homedir(), '.local', 'share', 'flatpak', 'app', 'md.obsidian.Obsidian'), '/var/lib/flatpak/app/md.obsidian.Obsidian'];
  const installato = existsSync(conf) || app.some(existsSync);
  let registrato = null;
  try { const j = JSON.parse(readFileSync(conf, 'utf8')); registrato = Object.entries(j.vaults || {}).find(([, v]) => resolve(v.path) === resolve(vault))?.[0] || null; } catch { }
  return { installato, registrato, conf };
}
// aggiunge il vault alla lista di Obsidian (solo se la lista esiste e si legge bene: mai creare o rompere la configurazione altrui)
export function registra(vault) {
  const o = obsidian(vault); if (o.registrato || !existsSync(o.conf)) return o;
  try {
    const j = JSON.parse(readFileSync(o.conf, 'utf8')); j.vaults ||= {};
    j.vaults[randomBytes(8).toString('hex')] = { path: resolve(vault), ts: Date.now() };
    scriviSicuro(o.conf, JSON.stringify(j));
  } catch { }
  return obsidian(vault);
}
export function linkObsidian(vault, file) {
  const o = obsidian(vault), nome = vault.split(sep).pop();
  if (o.registrato) return { url: `obsidian://open?vault=${encodeURIComponent(o.registrato)}&file=${encodeURIComponent(String(file).replace(/\.md$/, ''))}`, esito: 'ok' };
  if (o.installato) return { url: `obsidian://open?path=${encodeURIComponent(dentro(vault, file))}`, esito: 'da_aprire' };
  return { url: null, esito: 'manca' };
}

/* ---------- leggere le lezioni ---------- */
// le cartelle di sistema di Windows (cestino, System Volume Information) si saltano; una voce illeggibile non ferma la ricerca
const DI_SISTEMA = /^(\$recycle\.bin|recycler|system volume information)$/i;
function mdSotto(dir, out = [], radice = true) {
  let nomi; try { nomi = readdirSync(dir); } catch { return out; }
  for (const n of nomi) { if (n.startsWith('.') || (radice && DI_SISTEMA.test(n))) continue; const p = join(dir, n); let s; try { s = statSync(p); } catch { continue; } if (s.isDirectory()) mdSotto(p, out, false); else if (n.endsWith('.md')) out.push(p); }
  return out;
}
export function lezioni(vault) {
  const out = [];
  for (const f of mdSotto(join(vault, 'Lezioni'))) {
    try { const l = M.leggiLezione(readFileSync(f, 'utf8'), relative(vault, f).split(sep).join('/')); if (l.data) out.push(l); } catch { }
  }
  return out;
}
export function notePerLode(vault) {
  try { const t = readFileSync(join(vault, 'Lode', 'Memoria.md'), 'utf8'); const i = t.indexOf('## Note per Lode'); return i < 0 ? '' : t.slice(i + 16).replace(/%%[\s\S]*?%%/g, '').trim(); } catch { return ''; }
}

/* ---------- scrivere ---------- */
export function annota(vault, { file, nuovo, corso, chiave, riga }) {
  const p = dentro(vault, file);
  if (!existsSync(p)) scriviSicuro(p, nuovo || '');
  if (corso?.file) { const c = dentro(vault, corso.file); if (!existsSync(c)) scriviSicuro(c, corso.testo); }
  scriviSicuro(p, M.inserisci(readFileSync(p, 'utf8'), chiave, riga));
  return { file };
}
// la memoria si riscrive, ma la sezione «Note per Lode» dello studente resta com'è
export function memoria(vault, testo) {
  const p = join(vault, 'Lode', 'Memoria.md');
  let note = '';
  try { const v = readFileSync(p, 'utf8'); const i = v.indexOf('## Note per Lode'); if (i >= 0) note = v.slice(i); } catch { }
  const j = testo.indexOf('## Note per Lode');
  scriviSicuro(p, (j >= 0 && note ? testo.slice(0, j) + note : testo).replace(/\s*$/, '\n'));
}

/* ---------- guardare il vault ---------- */
export function guarda(vault, { lezioniCambiate, orarioCambiato, noteCambiate }) {
  let t1 = 0, t2 = 0, ultimoOrario = null;
  const segnaOrario = testo => { ultimoOrario = testo; };
  const orario = () => { try { const t = readFileSync(join(vault, 'Orario.md'), 'utf8'); if (t !== ultimoOrario) { ultimoOrario = t; orarioCambiato(M.leggiOrario(t)); } } catch { } };
  let w;
  try {
    w = watch(vault, { recursive: true }, (_, nome) => {
      // Windows: con tanti cambi insieme (OneDrive, git, uno zip) il nome si perde: può essere cambiato tutto, si rilegge tutto
      if (!nome) { clearTimeout(t1); t1 = setTimeout(lezioniCambiate, 300); clearTimeout(t2); t2 = setTimeout(() => { orario(); noteCambiate(); }, 300); return; }
      const n = String(nome).split(sep).join('/');
      if (!n.endsWith('.md') || n.includes('.tmp-')) return;
      if (n.startsWith('Lezioni/')) { clearTimeout(t1); t1 = setTimeout(lezioniCambiate, 300); }
      else if (n === 'Orario.md') setTimeout(orario, 200);
      else if (n === 'Lode/Memoria.md') setTimeout(noteCambiate, 200);
    });
  } catch (e) { console.warn('Lode: non riesco a guardare il vault', e.message); }
  return { chiudi: () => w?.close(), segnaOrario };
}
export { scriviSicuro };
