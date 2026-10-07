// Il vault Obsidian di Lode. Alla prima apertura nasce in Documenti/Lode, già pronto per Obsidian: cartelle, modello
// della lezione, orario, la nota «Memoria» e un tema bianco e nero. Se Obsidian è installato, il vault viene aggiunto
// alla sua lista, così lo studente lo trova già collegato. Lode non sovrascrive mai un file che esiste.
// Poi lo guarda: ogni volta che lo studente scrive una lezione in Obsidian, la barra rilegge definizioni e ★.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync, rmSync, watch } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, relative, resolve, sep, isAbsolute } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

let M = null, NM = null;   // js/markdown.js e js/nomi.js, condivisi con la barra
export async function carica(web) { M = await import(pathToFileURL(join(web, 'js', 'markdown.js')).href); NM = await import(pathToFileURL(join(web, 'js', 'nomi.js')).href); }
const N = () => NM.nomi();   // i nomi del vault aperto (impostati da crea)

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

// le note che nascono col vault, nella lingua del vault (js/lingue/<codice>/vaultnomi.js). In italiano sono quelle di sempre
const metti = (s, p) => String(s).replace(/\{(\w+)\}/g, (x, k) => (k in p ? String(p[k]) : x));
const benvenuto = N => metti(N.testi.benvenuto, { firma: N.testi.benvenutoFirma, corso: N.testi.corso, orario: N.note.orario, lezioni: N.cartelle.lezioni, stella: N.sezioni.stella, definizioni: N.sezioni.definizione, memoria: N.note.memoria, lode: N.cartelle.lode, notePerLode: N.titoli.notePerLode });
const modello = N => `---
corso: "[[]]"
data: {{date:YYYY-MM-DD}}
tipo: lezione
tags: [lezione]
---
# {{title}}

## ${N.sezioni.appunti}


## ${N.sezioni.stella}


## ${N.sezioni.definizione}
%% ${N.commenti.definizioni} %%


## ${N.sezioni.domanda}

`;
const modelloEsame = N => `---
tipo: esame
corso: "[[]]"
appello: {{date:YYYY-MM-DD}}
tags: [esame]
---
# {{title}}

## ${N.testi.esameProgramma}


## ${N.testi.esameDomande}
%% ${N.testi.esameDomandeCommento} %%


## ${N.testi.esameEsercizi}


## ${N.testi.esameManca}

`;
const modelloRipasso = N => `---
tipo: ripasso
corso: "[[]]"
data: {{date:YYYY-MM-DD}}
tags: [ripasso]
---
# ${N.modelli.ripasso} · {{title}}

## ${N.testi.ripassoTreRighe}


## ${N.sezioni.definizione}
%% ${N.testi.ripassoCommentoDefinizioni} %%


## ${N.testi.ripassoCollegamenti}
%% ${N.testi.ripassoCommentoCollegamenti} %%
`;
const memoriaNuova = N => `---
tipo: memoria
---
# ${N.testi.memoriaTitolo}

%% ${metti(N.testi.memoriaCommento, { sezione: N.titoli.notePerLode })} %%

## ${N.testi.memoriaInBreve}
- ${N.testi.memoriaAncoraNiente}

## ${N.titoli.notePerLode}
%% ${N.testi.memoriaNoteCommento} %%
`;
const TEMA = `/* Lode: bianco e nero, come la barra. Attivo da Impostazioni > Aspetto > Snippet CSS. */
.theme-dark{--interactive-accent:#fff;--interactive-accent-hover:#e4e4e4;--text-on-accent:#000;--text-accent:#fff;--background-primary:#0a0a0a;--background-secondary:#111;--h1-weight:600;--h2-weight:600}
.theme-light{--interactive-accent:#0a0a0a;--interactive-accent-hover:#2a2a2a;--text-on-accent:#fff;--text-accent:#0a0a0a}
body{--font-text-theme:"Geist",-apple-system,"Segoe UI",sans-serif;--font-monospace-theme:"Geist Mono",ui-monospace,monospace}
.markdown-rendered h2{letter-spacing:-.02em}
`;

/* ---------- i nomi del vault (js/nomi.js): decisi una volta, salvati in .lode/vault.json ---------- */
// Un vault con vault.json usa i nomi salvati. Un vault di Lode che esiste già senza vault.json (nato prima delle lingue) usa
// i nomi italiani, e non si rinomina niente. Una cartella vuota, o un vault di Obsidian dove Lode non ha mai scritto, nasce
// nella lingua di adesso (quella della barra). La decisione si scrive subito in vault.json: dopo, la lingua della barra non conta più
const VAULT_JSON = vault => join(vault, '.lode', 'vault.json');
export function leggiNomi(vault) {
  try { const j = JSON.parse(readFileSync(VAULT_JSON(vault), 'utf8')); if (j && typeof j === 'object' && typeof j.lingua === 'string') return NM.completa(j); } catch { }
  return null;
}
// senza vault.json (mai scritto, rovinato, o rimasto indietro con un servizio che non copia le cartelle col punto, come
// Obsidian Sync) la lingua si riconosce dalle cartelle e dalle note che Lode ha già creato: quella con più tracce, a parità
// l'italiano (i vault nati prima delle lingue). Nessuna traccia: un vault nuovo, nella lingua della barra
const tracce = N => [N.cartelle.lezioni, N.cartelle.corsi, N.cartelle.modelli, ...['benvenuto', 'home', 'orario', 'esami', 'glossario'].map(k => NM.md(N.note[k])), join(N.cartelle.lode, NM.md(N.note.memoria))];
export function linguaDalleTracce(vault) {
  let meglio = null, punti = 0;
  for (const cod of NM.LINGUE_NOMI) {
    const p = tracce(NM.nomiDi(cod)).filter(x => existsSync(join(vault, x))).length;
    if (p > punti) { meglio = cod; punti = p; }
  }
  return meglio;
}
export function nomiPer(vault, lingua = 'it') {
  return leggiNomi(vault) || NM.nomiDi(linguaDalleTracce(vault) || lingua);
}
// apre il vault coi suoi nomi (senza scrivere niente): per chi legge un vault senza crearlo
export function usaNomi(vault, lingua = 'it') { return NM.impostaNomi(nomiPer(vault, lingua)); }

// orario null: Orario.md non si crea (con la sincronizzazione lo scrive il motore, mai «perché manca»: docs/SINCRONIZZAZIONE.md §9, #40).
// lingua: quella della barra, usata solo se il vault nasce adesso
export function crea(vault, orario = [], lingua = 'it') {
  const N = NM.impostaNomi(nomiPer(vault, lingua)), C = N.cartelle;
  for (const d of [C.lezioni, C.corsi, C.lode, C.modelli, C.allegati, C.inbox, '.lode']) mkdirSync(join(vault, d), { recursive: true });
  seManca(VAULT_JSON(vault), JSON.stringify(NM.daSalvare(N), null, 2) + '\n');
  const nota = k => NM.md(N.note[k]);
  seManca(join(vault, nota('benvenuto')), benvenuto(N));
  if (orario) seManca(join(vault, nota('orario')), M.orarioMd(orario));
  seManca(join(vault, C.lode, nota('memoria')), memoriaNuova(N));
  seManca(join(vault, C.modelli, NM.md(N.modelli.lezione)), modello(N));
  seManca(join(vault, C.modelli, NM.md(N.modelli.esame)), modelloEsame(N));
  seManca(join(vault, C.modelli, NM.md(N.modelli.ripasso)), modelloRipasso(N));
  for (const k of ['home', 'esami', 'glossario']) seManca(join(vault, nota(k)), `# ${N.note[k]}\n\n%% lode:pagina %%\n%% /lode:pagina %%\n`);
  // il vault l'ha creato Lode? allora possiamo preparare anche la disposizione di Obsidian
  let nostro = false; try { nostro = readFileSync(join(vault, nota('benvenuto')), 'utf8').includes(N.testi.benvenutoFirma); } catch { }
  // la configurazione di Obsidian solo se il vault è nuovo: in un vault esistente non tocchiamo niente
  const ob = join(vault, '.obsidian');
  if (!existsSync(ob)) {
    seManca(join(ob, 'app.json'), JSON.stringify({ attachmentFolderPath: C.allegati, newFileLocation: 'folder', newFileFolderPath: C.inbox, alwaysUpdateLinks: true, showUnsupportedFiles: false }, null, 2));
    seManca(join(ob, 'appearance.json'), JSON.stringify({ theme: 'obsidian', accentColor: '#ffffff', enabledCssSnippets: ['lode'] }, null, 2));
    seManca(join(ob, 'templates.json'), JSON.stringify({ folder: C.modelli, dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm' }, null, 2));
    seManca(join(ob, 'core-plugins.json'), JSON.stringify({ 'file-explorer': true, 'global-search': true, switcher: true, graph: true, backlink: true, 'outgoing-link': true, 'tag-pane': true, 'page-preview': true, templates: true, 'note-composer': true, 'command-palette': true, outline: true, 'word-count': true, 'file-recovery': true, bookmarks: true, 'daily-notes': false }, null, 2));
    seManca(join(ob, 'snippets', 'lode.css'), TEMA);
  }
  if (nostro) {
    // Obsidian si apre sulla Home, con le cartelle e i segnalibri a sinistra, i collegamenti in entrata e l'indice a destra
    seManca(join(ob, 'workspace.json'), JSON.stringify(disposizione(nota('home')), null, 2));
    const t = Date.now();
    seManca(join(ob, 'bookmarks.json'), JSON.stringify({ items: [[nota('home'), N.note.home], [nota('orario'), N.note.orario], [nota('esami'), N.note.esami], [nota('glossario'), N.note.glossario], [`${C.lode}/${nota('memoria')}`, N.segnalibri.memoria]].map(([path, title]) => ({ type: 'file', ctime: t, path, title })) }, null, 2));
  }
}
const disposizione = home => ({
  main: { id: 'lode-main', type: 'split', direction: 'vertical', children: [{ id: 'lode-tabs', type: 'tabs', children: [{ id: 'lode-home', type: 'leaf', state: { type: 'markdown', state: { file: home, mode: 'preview', source: false } } }] }] },
  left: { id: 'lode-left', type: 'split', direction: 'horizontal', width: 260, children: [{ id: 'lode-left-tabs', type: 'tabs', children: [
    { id: 'lode-files', type: 'leaf', state: { type: 'file-explorer', state: { sortOrder: 'alphabetical' } } },
    { id: 'lode-bm', type: 'leaf', state: { type: 'bookmarks', state: {} } },
    { id: 'lode-search', type: 'leaf', state: { type: 'search', state: { query: '' } } }] }] },
  right: { id: 'lode-right', type: 'split', direction: 'horizontal', width: 280, children: [{ id: 'lode-right-tabs', type: 'tabs', children: [
    { id: 'lode-back', type: 'leaf', state: { type: 'backlink', state: { file: home, collapseAll: false, extraContext: false, sortOrder: 'alphabetical', showSearch: false, searchQuery: '', backlinkCollapsed: false, unlinkedCollapsed: true } } },
    { id: 'lode-outline', type: 'leaf', state: { type: 'outline', state: { file: home } } }] }] },
  active: 'lode-home', lastOpenFiles: [home],
});

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
  const modelli = N().cartelle.modelli.normalize('NFC') + '/';
  return mdSotto(vault).map(f => relative(vault, f).split(sep).join('/')).filter(f => !f.normalize('NFC').startsWith(modelli)).map(f => ({ file: f, titolo: f.split('/').pop().replace(/\.md$/, ''), cartella: f.includes('/') ? f.split('/')[0] : '' }));
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
  for (const f of mdSotto(join(vault, N().cartelle.lezioni))) {
    try { const l = M.leggiLezione(readFileSync(f, 'utf8'), relative(vault, f).split(sep).join('/')); if (l.data) out.push(l); } catch { }
  }
  return out;
}
export function notePerLode(vault) {
  try { const t = readFileSync(join(vault, NM.fileMemoria()), 'utf8'), titolo = `## ${N().titoli.notePerLode}`, i = t.indexOf(titolo); return i < 0 ? '' : t.slice(i + titolo.length).replace(/%%[\s\S]*?%%/g, '').trim(); } catch { return ''; }
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
  const p = join(vault, NM.fileMemoria()), titolo = `## ${N().titoli.notePerLode}`;
  let note = '';
  try { const v = readFileSync(p, 'utf8'); const i = v.indexOf(titolo); if (i >= 0) note = v.slice(i); } catch { }
  const j = testo.indexOf(titolo);
  scriviSicuro(p, (j >= 0 && note ? testo.slice(0, j) + note : testo).replace(/\s*$/, '\n'));
}

/* ---------- guardare il vault ---------- */
// syncCambiato (facoltativo): un file della sincronizzazione (.lode/sync, .lode/dati.json) o un Orario*.md, per il motore
export function guarda(vault, { lezioniCambiate, orarioCambiato, noteCambiate, syncCambiato = null }) {
  let t1 = 0, t2 = 0, ultimoOrario = null;
  const segnaOrario = testo => { ultimoOrario = testo; };
  const orario = () => { try { const t = readFileSync(join(vault, NM.fileNota('orario')), 'utf8'); if (t !== ultimoOrario) { ultimoOrario = t; orarioCambiato(M.leggiOrario(t)); } } catch { } };
  let w;
  try {
    w = watch(vault, { recursive: true }, (_, nome) => {
      // Windows: con tanti cambi insieme (OneDrive, git, uno zip) il nome si perde: può essere cambiato tutto, si rilegge tutto
      if (!nome) { clearTimeout(t1); t1 = setTimeout(lezioniCambiate, 300); clearTimeout(t2); t2 = setTimeout(() => { orario(); noteCambiate(); }, 300); syncCambiato?.(); return; }
      // i nomi del vault (js/nomi.js), con le lettere accentate in una forma sola (FSEvents può darle scomposte)
      const n = String(nome).split(sep).join('/').normalize('NFC'), Nv = N(), orarioMd = NM.fileNota('orario').normalize('NFC');
      if (syncCambiato && (n.startsWith('.lode/sync/') || n === '.lode/dati.json' || new RegExp(`^${NM.rx(Nv.note.orario)}.*\\.md$`).test(n))) syncCambiato();
      if (!n.endsWith('.md') || n.includes('.tmp-')) return;
      if (n.startsWith(Nv.cartelle.lezioni.normalize('NFC') + '/')) { clearTimeout(t1); t1 = setTimeout(lezioniCambiate, 300); }
      else if (n === orarioMd) setTimeout(orario, 200);
      else if (n === NM.fileMemoria().normalize('NFC')) setTimeout(noteCambiate, 200);
    });
  } catch (e) { console.warn('Lode: non riesco a guardare il vault', e.message); }
  return { chiudi: () => w?.close(), segnaOrario };
}
export { scriviSicuro };
// i nomi del vault aperto, per main.mjs e la barra (vault:info): la tabella intera, il file di una nota alla radice
// («Orario.md», «Timetable.md»…) e le regex dei percorsi che la barra può chiedere
export const nomi = () => N();
export const fileNota = k => NM.fileNota(k);
export function permessi() {
  const n = N(), C = n.cartelle, x = s => NM.rx(s), nota = k => x(n.note[k]);
  return {
    // le note di una lezione possono stare in sottocartelle (Lezioni/Corso/Esercitazioni/x.md)
    lezione: new RegExp(`^(${x(C.lezioni)}|${x(C.corsi)})\\/(?:[^/.][^/]*\\/)*[^/.][^/]*\\.md$`),
    // In tasca.md: js/tasca.js; Lode/<nota>: la memoria (e le note di Lode che hanno un nome semplice, come prima)
    scrivi: new RegExp(`^(${nota('orario')}|${nota('tasca')}|${x(C.lode)}\\/(?:[\\w ]+|${nota('memoria')}))\\.md$`),
    blocco: new RegExp(`^(${nota('home')}|${nota('esami')}|${nota('glossario')})\\.md$|^${x(C.corsi)}\\/[^/]+\\.md$|^${x(C.lezioni)}\\/[^/]+\\/[^/]+\\.md$|^${x(C.progetti)}\\/[^/]+\\/[^/]+\\.md$`),
    salvaFile: new RegExp(`^(${[C.sbobine, C.allegati, C.materiali, C.lezioni, C.anki].map(x).join('|')})\\/`),
  };
}
