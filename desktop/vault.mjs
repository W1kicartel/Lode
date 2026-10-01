// Il vault Obsidian di Lode. Alla prima apertura nasce in Documenti/Lode, già pronto per Obsidian: cartelle, modello
// della lezione, orario, la nota «Memoria» e un tema bianco e nero. Se Obsidian è installato, il vault viene aggiunto
// alla sua lista, così lo studente lo trova già collegato. Lode non sovrascrive mai un file che esiste.
// Poi lo guarda: ogni volta che lo studente scrive una lezione in Obsidian, la barra rilegge definizioni e ★.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync, watch } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

let M = null;   // js/markdown.js, condiviso con la barra
export async function carica(web) { M = await import(pathToFileURL(join(web, 'js', 'markdown.js')).href); }

const scriviSicuro = (f, testo) => { mkdirSync(dirname(f), { recursive: true }); const t = f + '.tmp-' + process.pid; writeFileSync(t, testo); renameSync(t, f); };
const seManca = (f, testo) => { if (!existsSync(f)) scriviSicuro(f, testo); };
// ogni percorso chiesto dalla barra deve restare dentro il vault
export function dentro(vault, rel) {
  const p = resolve(vault, String(rel || '').replace(/^[/\\]+/, ''));
  if (p !== resolve(vault) && !p.startsWith(resolve(vault) + sep)) throw new Error('percorso fuori dal vault');
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
  // la configurazione di Obsidian solo se il vault è nuovo: in un vault esistente non tocchiamo niente
  const ob = join(vault, '.obsidian');
  if (!existsSync(ob)) {
    seManca(join(ob, 'app.json'), JSON.stringify({ attachmentFolderPath: 'Allegati', newFileLocation: 'folder', newFileFolderPath: 'Inbox', alwaysUpdateLinks: true, showUnsupportedFiles: false }, null, 2));
    seManca(join(ob, 'appearance.json'), JSON.stringify({ theme: 'obsidian', accentColor: '#ffffff', enabledCssSnippets: ['lode'] }, null, 2));
    seManca(join(ob, 'templates.json'), JSON.stringify({ folder: 'Modelli', dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm' }, null, 2));
    seManca(join(ob, 'core-plugins.json'), JSON.stringify({ 'file-explorer': true, 'global-search': true, switcher: true, graph: true, backlink: true, 'outgoing-link': true, 'tag-pane': true, 'page-preview': true, templates: true, 'note-composer': true, 'command-palette': true, outline: true, 'word-count': true, 'file-recovery': true, bookmarks: true, 'daily-notes': false }, null, 2));
    seManca(join(ob, 'snippets', 'lode.css'), TEMA);
  }
}

/* ---------- Obsidian: è installato? il vault è nella sua lista? ---------- */
function cartellaObsidian() {
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'obsidian');
  if (process.platform === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'obsidian');
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'obsidian');
}
export function obsidian(vault) {
  const conf = join(cartellaObsidian(), 'obsidian.json');
  const app = process.platform === 'darwin' ? ['/Applications/Obsidian.app', join(homedir(), 'Applications', 'Obsidian.app')]
    : process.platform === 'win32' ? [join(process.env.LOCALAPPDATA || '', 'Programs', 'Obsidian', 'Obsidian.exe'), join(process.env.LOCALAPPDATA || '', 'Obsidian', 'Obsidian.exe')]
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
  if (o.registrato) return { url: `obsidian://open?vault=${encodeURIComponent(nome)}&file=${encodeURIComponent(String(file).replace(/\.md$/, ''))}`, esito: 'ok' };
  if (o.installato) return { url: `obsidian://open?path=${encodeURIComponent(dentro(vault, file))}`, esito: 'da_aprire' };
  return { url: null, esito: 'manca' };
}

/* ---------- leggere le lezioni ---------- */
function mdSotto(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) { if (n.startsWith('.')) continue; const p = join(dir, n); const s = statSync(p); if (s.isDirectory()) mdSotto(p, out); else if (n.endsWith('.md')) out.push(p); }
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
  let t1 = 0, ultimoOrario = null;
  const segnaOrario = testo => { ultimoOrario = testo; };
  let w;
  try {
    w = watch(vault, { recursive: true }, (_, nome) => {
      const n = String(nome || '').split(sep).join('/');
      if (!n.endsWith('.md') || n.includes('.tmp-')) return;
      if (n.startsWith('Lezioni/')) { clearTimeout(t1); t1 = setTimeout(lezioniCambiate, 300); }
      else if (n === 'Orario.md') setTimeout(() => { try { const t = readFileSync(join(vault, 'Orario.md'), 'utf8'); if (t !== ultimoOrario) { ultimoOrario = t; orarioCambiato(M.leggiOrario(t)); } } catch { } }, 200);
      else if (n === 'Lode/Memoria.md') setTimeout(noteCambiate, 200);
    });
  } catch (e) { console.warn('Lode: non riesco a guardare il vault', e.message); }
  return { chiudi: () => w?.close(), segnaOrario };
}
export { scriviSicuro };
