/* «Voglio fare…» (js/guida.js): le app che ci sono sul computer, aprirle dopo il clic e aprire un terminale VERO con
   Claude Code (o Codex, Gemini CLI) in una cartella scelta dallo studente.
   Node puro, senza import di electron: si prova anche fuori dall'app (test/app-utili.mjs).

   CONTRATTO IPC (registra() li registra tutti; come per «segui il progetto», la barra manda solo indici e token, mai percorsi
   o comandi: l'elenco delle app, i percorsi e i comandi restano qui)
      guida:app       ()                       → { app: [{ i, nome, tipo: 'app'|'cli', categoria }], agenti: ['claude', …] }
      guida:apri      { i }                    → { ok } | { errore }      apre l'app numero i dell'elenco (dopo il clic)
      guida:cartella  ()                       → { token, nome, seguita } | { annullato: true }
                                                  seguita: l'id del progetto seguito («segui progetto») che contiene la cartella,
                                                  così la barra riconosce l'evento agente:turno di quel progetto
      guida:terminale { token, agente, testo } → { ok } | { errore }      apre il terminale nella cartella con l'agente e il testo

   Il testo dello studente non passa MAI per la shell: va in un file a parte, e lo script lo legge con cat (Mac, Linux) o con
   PowerShell (Windows). Anche i percorsi vanno fra apici, con l'escape giusto (quotaSh, quotaCmd, quotaPs).
   Prove: LODE_GUIDA_FINTA=<file> non apre niente (né app né terminali né claude): scrive su quel file una riga JSON per ogni
   azione. LODE_APP_CARTELLE (cartelle separate da «:» o «;») sostituisce le cartelle delle app, LODE_GUIDA_CARTELLA il dialogo. */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync, chmodSync, appendFileSync, mkdtempSync } from 'node:fs';
import { execFile, execFileSync } from 'node:child_process';
import { join, basename, delimiter as DELIM, isAbsolute, relative, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

// gli strumenti a riga di comando utili a chi programma: si cercano nel PATH, senza eseguirli
export const CLI = ['claude', 'codex', 'gemini', 'code', 'git', 'node', 'python3', 'gcc', 'clang', 'java'];
// gli agenti che si possono lanciare nel terminale con un testo: il comando e il nome da mostrare
export const AGENTI = { claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI' };
const NOMI_CLI = { code: 'Visual Studio Code', ...AGENTI };

/* ---------- leggere i file delle app ---------- */
const xmlTesto = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
// Info.plist in XML: le chiavi che servono (solo le stringhe del primo livello)
export function leggiPlist(xml) {
  const out = {};
  for (const m of String(xml).matchAll(/<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g)) if (!(m[1] in out)) out[m[1]] = xmlTesto(m[2]).trim();
  return out;
}
// un file .desktop di Linux: la sezione [Desktop Entry]
export function leggiDesktop(testo) {
  const out = {}; let dentro = false;
  for (const riga of String(testo).split(/\r?\n/)) {
    const r = riga.trim();
    if (/^\[.*\]$/.test(r)) { dentro = r === '[Desktop Entry]'; continue; }
    const m = dentro && r.match(/^([A-Za-z]+)=(.*)$/);   // solo le chiavi senza lingua (Name, non Name[it])
    if (m && !(m[1] in out)) out[m[1]] = m[2].trim();
  }
  return { nome: out.Name || '', exec: out.Exec || '', categorie: (out.Categories || '').split(';').filter(Boolean), tipo: out.Type || '', nascosta: /^true$/i.test(out.NoDisplay || '') || /^true$/i.test(out.Hidden || '') };
}
// il comando di Exec senza i codici di campo (%U, %f…), diviso in parole come fa la specifica (virgolette doppie)
export function parolaExec(exec) {
  const out = []; let cur = '', q = false, c = false;
  for (let k = 0; k < exec.length; k++) {
    const ch = exec[k];
    if (q && ch === '\\' && k + 1 < exec.length) { cur += exec[++k]; c = true; continue; }
    if (ch === '"') { q = !q; c = true; continue; }
    if (!q && /\s/.test(ch)) { if (c || cur) out.push(cur); cur = ''; c = false; continue; }
    cur += ch;
  }
  if (c || cur) out.push(cur);
  return out.filter(p => !/^%[a-zA-Z]$/.test(p)).map(p => p.replace(/%%/g, '%'));
}

/* ---------- cercare ---------- */
const prova = f => { try { return f(); } catch { return null; } };
const elencoDir = d => prova(() => readdirSync(d, { withFileTypes: true })) || [];
function plistDi(app) {
  const f = join(app, 'Contents', 'Info.plist'), b = prova(() => readFileSync(f));
  if (!b) return {};
  if (b.subarray(0, 6).toString() !== 'bplist') return leggiPlist(b.toString('utf8'));
  // un plist binario: plutil lo converte (solo qui serve un programma esterno)
  const j = prova(() => JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', f], { encoding: 'utf8', timeout: 3000 })));
  return j && typeof j === 'object' ? Object.fromEntries(['CFBundleIdentifier', 'LSApplicationCategoryType', 'CFBundleName', 'CFBundleDisplayName'].filter(k => typeof j[k] === 'string').map(k => [k, j[k]])) : {};
}
function appMac(cartelle) {
  const out = [];
  const guarda = (d, livello) => {
    for (const e of elencoDir(d)) {
      if (e.name.startsWith('.')) continue;
      const p = join(d, e.name);
      if (e.name.endsWith('.app')) {
        const pl = plistDi(p);
        out.push({ nome: e.name.slice(0, -4), tipo: 'app', id: pl.CFBundleIdentifier || null, categoria: (pl.LSApplicationCategoryType || '').replace(/^public\.app-category\./, '') || null, percorso: p });
      } else if (livello < 1 && e.isDirectory()) guarda(p, livello + 1);   // /Applications/Utilities, «Microsoft Office»…
    }
  };
  for (const c of cartelle) guarda(c, 0);
  return out;
}
function appWindows(cartelle) {
  const out = [];
  const guarda = (d, livello) => {
    for (const e of elencoDir(d)) {
      const p = join(d, e.name);
      if (e.isDirectory() && livello < 3) guarda(p, livello + 1);
      else if (/\.lnk$/i.test(e.name) && !/uninstall|disinstalla|deinstall|desinstal|readme|help|license/i.test(e.name)) out.push({ nome: e.name.replace(/\.lnk$/i, ''), tipo: 'app', id: null, categoria: basename(d), percorso: p });
    }
  };
  for (const c of cartelle) guarda(c, 0);
  return out;
}
function appLinux(cartelle) {
  const out = [];
  for (const c of cartelle) for (const e of elencoDir(c)) {
    if (!e.name.endsWith('.desktop')) continue;
    const d = leggiDesktop(prova(() => readFileSync(join(c, e.name), 'utf8')) || '');
    if (!d.nome || d.nascosta || (d.tipo && d.tipo !== 'Application') || !d.exec) continue;
    out.push({ nome: d.nome, tipo: 'app', id: e.name, categoria: d.categorie[0] || null, percorso: join(c, e.name), exec: d.exec });
  }
  return out;
}
// un programma nel PATH (senza eseguirlo): il percorso del primo che c'è, o null
export function nelPath(nome, { PATH = '', piattaforma = process.platform, PATHEXT = '.EXE;.CMD;.BAT;.COM', esiste = existsSync } = {}) {
  const sep = piattaforma === 'win32' ? ';' : ':', est = piattaforma === 'win32' ? ['', ...PATHEXT.split(';').map(x => x.toLowerCase())] : [''];
  for (const d of String(PATH).split(sep).filter(Boolean)) for (const e of est) {
    const p = join(d, nome + e);
    if (esiste(p) && prova(() => statSync(p).isFile())) return p;
  }
  return null;
}
// le cartelle delle app di ogni sistema
export function cartelleApp({ piattaforma = process.platform, casa, env = process.env }) {
  if (env.LODE_APP_CARTELLE) return env.LODE_APP_CARTELLE.split(/[:;]/).filter(Boolean);
  if (piattaforma === 'darwin') return ['/Applications', '/System/Applications', join(casa, 'Applications')];
  if (piattaforma === 'win32') return [join(env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'), join(env.APPDATA || join(casa, 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')];
  const dati = (env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':').filter(Boolean);
  return [...dati.map(d => join(d, 'applications')), join(env.XDG_DATA_HOME || join(casa, '.local', 'share'), 'applications'), '/var/lib/flatpak/exports/share/applications', join(casa, '.local', 'share', 'flatpak', 'exports', 'share', 'applications')];
}
// tutte le app e gli strumenti, senza doppioni (per nome), in ordine di nome
export function elenca({ piattaforma = process.platform, casa, env = process.env } = {}) {
  const cartelle = cartelleApp({ piattaforma, casa, env });
  const app = piattaforma === 'darwin' ? appMac(cartelle) : piattaforma === 'win32' ? appWindows(cartelle) : appLinux(cartelle);
  const visti = new Set(app.map(a => a.nome.toLowerCase())), out = [...app];
  for (const c of CLI) {
    const p = nelPath(c, { PATH: env.PATH || env.Path || '', piattaforma, PATHEXT: env.PATHEXT });
    if (!p) continue;
    const nome = NOMI_CLI[c] || c;
    if (c === 'code' && visti.has(nome.toLowerCase())) continue;   // VS Code c'è già come app
    out.push({ nome: c in NOMI_CLI ? nome : c, tipo: 'cli', id: c, categoria: 'developer-tools', percorso: p });
    visti.add(nome.toLowerCase());
  }
  const unici = new Map();
  for (const a of out) if (!unici.has(a.nome.toLowerCase())) unici.set(a.nome.toLowerCase(), a);
  return [...unici.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

/* ---------- l'escape: il testo e i percorsi non diventano mai comandi ---------- */
// sh: fra apici singoli non si espande niente; l'apice si chiude, si scrive \' e si riapre
export const quotaSh = s => `'${String(s).replace(/'/g, `'\\''`)}'`;
// PowerShell: fra apici singoli niente si espande; l'apice (anche quelli tipografici, che PowerShell legge come apici) si raddoppia
export const quotaPs = s => `'${String(s).replace(/['‘’‚‛]/g, x => x + x)}'`;
// cmd.exe: fra virgolette doppie & | < > ^ restano lettere; % si raddoppia nei .cmd. Un percorso di Windows non può avere «"»,
// e un a capo romperebbe la riga: quelli si rifiutano
export function quotaCmd(s) {
  s = String(s);
  if (/["\r\n\0]/.test(s)) throw new Error('percorso non valido');
  return `"${s.replace(/%/g, '%%')}"`;
}

// lo script che apre l'agente nella cartella. testo: il file con il testo (letto dallo script, mai scritto nello script)
// eseguibile: il percorso assoluto trovato nel PATH di Lode (il Terminale potrebbe avere un PATH diverso); senza, il nome
export function scriptTerminale({ piattaforma = process.platform, cartella, fileTesto, agente, script, eseguibile = null }) {
  if (!(agente in AGENTI)) throw new Error('agente sconosciuto');
  if (/[\0\r\n]/.test(cartella) || /[\0\r\n]/.test(fileTesto) || (script && /[\0\r\n]/.test(script)) || (eseguibile && /[\0\r\n]/.test(eseguibile))) throw new Error('percorso non valido');
  if (piattaforma === 'win32') {
    // PowerShell legge il file e passa il testo come un argomento solo; cd /d cambia anche il disco
    const ps = `$t = Get-Content -Raw -Encoding UTF8 -LiteralPath ${quotaPs(fileTesto)}; Remove-Item -LiteralPath ${quotaPs(fileTesto)} -ErrorAction SilentlyContinue; & ${eseguibile ? quotaPs(eseguibile) : agente} $t`;
    if (/"/.test(ps)) throw new Error('percorso non valido');
    return { estensione: '.cmd', contenuto: ['@echo off', 'chcp 65001 >nul', `cd /d ${quotaCmd(cartella)} || exit /b 1`, `powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps.replace(/%/g, '%%')}"`, ''].join('\r\n') };
  }
  // Mac (.command, aperto da Terminale) e Linux (.sh, aperto dal terminale che c'è): sh, con tutto fra apici singoli
  const righe = ['#!/bin/sh', `cd -- ${quotaSh(cartella)} || exit 1`, `T="$(cat -- ${quotaSh(fileTesto)})"`, `rm -f -- ${quotaSh(fileTesto)}`];
  if (script) righe.push(`rm -f -- ${quotaSh(script)}`);
  righe.push(`${eseguibile ? quotaSh(eseguibile) : agente} "$T"`, '');
  return { estensione: piattaforma === 'darwin' ? '.command' : '.sh', contenuto: righe.join('\n') };
}
// il comando che apre lo script in un terminale: { cmd, args } (Linux: il primo terminale che c'è)
export function comandoTerminale({ piattaforma = process.platform, script, PATH = process.env.PATH || '' }) {
  if (piattaforma === 'darwin') return { cmd: 'open', args: ['-a', 'Terminal', script] };
  if (piattaforma === 'win32') return { cmd: 'cmd.exe', args: ['/c', 'start', '""', 'cmd', '/k', script] };
  for (const [t, a] of [['x-terminal-emulator', ['-e']], ['gnome-terminal', ['--']], ['konsole', ['-e']], ['xfce4-terminal', ['-x']], ['kitty', []], ['alacritty', ['-e']], ['xterm', ['-e']]])
    if (nelPath(t, { PATH, piattaforma })) return { cmd: t, args: [...a, 'sh', script] };
  return null;
}
// il comando che apre un'app: { cmd, args } oppure { percorso } (Windows: shell.openPath sul collegamento)
export function comandoApri(a, { piattaforma = process.platform, PATH = process.env.PATH || '' } = {}) {
  if (a.tipo === 'cli') return a.id === 'code' ? { cmd: a.percorso, args: [] } : null;   // gli altri strumenti si usano dal terminale
  if (piattaforma === 'darwin') return { cmd: 'open', args: ['-a', a.percorso] };
  if (piattaforma === 'win32') return { percorso: a.percorso };
  if (nelPath('gtk-launch', { PATH, piattaforma })) return { cmd: 'gtk-launch', args: [a.id.replace(/\.desktop$/, '')] };
  const p = parolaExec(a.exec || ''); return p.length ? { cmd: p[0], args: p.slice(1) } : null;
}

/* ---------- gli handler IPC ---------- */
const dentro = (radice, p) => { const r = relative(radice, p); return r === '' || (!!r && !r.startsWith('..') && !isAbsolute(r)); };
// il progetto seguito che contiene la cartella (il più interno), come progettoDi di desktop/agenti.mjs
export function progettoSeguito(cartella, progetti) {
  const c = Object.entries(progetti || {}).filter(([, p]) => p?.percorso && dentro(p.percorso, resolve(cartella))).sort((a, b) => b[1].percorso.length - a[1].percorso.length)[0];
  return c ? c[0] : null;
}
export function registra({ ipcMain, dialog, shell, app, conf, t, env = process.env, casa }) {
  const C = typeof conf === 'function' ? conf : () => conf;
  const finta = env.LODE_GUIDA_FINTA || null;
  const segna = x => { appendFileSync(finta, JSON.stringify(x) + '\n'); return { ok: true }; };
  let cache = null, quando = 0;
  const lista = () => { if (!cache || Date.now() - quando > 10 * 60e3) { cache = elenca({ casa, env }); quando = Date.now(); } return cache; };
  const scelte = new Map();   // token → cartella: la barra non manda mai un percorso
  const esegui = ({ cmd, args }) => new Promise((ok, no) => execFile(cmd, args, { windowsHide: false, timeout: 15000 }, e => (e && e.code !== 0 && e.code != null ? no(e) : ok())));
  const gestisci = (canale, f) => ipcMain.handle(canale, async (_, x) => {
    try { return await f(x && typeof x === 'object' ? x : {}); } catch (e) { console.error(`Lode ${canale}:`, e); return { errore: e?.message || String(e) }; }
  });
  gestisci('guida:app', () => {
    const l = lista();
    return { app: l.map((a, i) => ({ i, nome: a.nome, tipo: a.tipo, categoria: a.categoria, apribile: a.tipo === 'app' || a.id === 'code' })), agenti: Object.keys(AGENTI).filter(k => l.some(a => a.tipo === 'cli' && a.id === k)) };
  });
  gestisci('guida:apri', async ({ i }) => {
    const a = lista()[Number.isInteger(i) ? i : -1]; if (!a) return { errore: 'app sconosciuta' };
    const c = comandoApri(a); if (!c) return { errore: 'app non apribile' };
    if (finta) return segna({ azione: 'apri', nome: a.nome, ...c });
    if (c.percorso) { const e = await shell.openPath(c.percorso); return e ? { errore: e } : { ok: true }; }
    await esegui(c); return { ok: true };
  });
  gestisci('guida:cartella', async () => {
    let cartella = env.LODE_GUIDA_CARTELLA || null;
    if (!cartella) {
      const r = await dialog.showOpenDialog({ title: t('desktop.guida-scegli-cartella'), buttonLabel: t('desktop.guida-usa-cartella'), properties: ['openDirectory', 'createDirectory'] });
      if (r.canceled || !r.filePaths?.[0]) return { annullato: true };
      cartella = r.filePaths[0];
    }
    if (!prova(() => statSync(cartella).isDirectory())) return { errore: 'cartella non trovata' };
    const token = randomBytes(12).toString('hex'); scelte.set(token, cartella);
    return { token, nome: basename(cartella), seguita: progettoSeguito(cartella, C()?.progetti) };
  });
  gestisci('guida:terminale', async ({ token, agente, testo }) => {
    const cartella = scelte.get(String(token || '')); if (!cartella) return { errore: 'cartella non scelta' };
    if (!(agente in AGENTI) || !lista().some(a => a.tipo === 'cli' && a.id === agente)) return { errore: 'agente non trovato' };
    testo = String(testo || '').slice(0, 8000); if (!testo.trim()) return { errore: 'testo vuoto' };
    const dir = join(app.getPath('temp'), 'lode-guida'); mkdirSync(dir, { recursive: true, mode: 0o700 });
    const qui = mkdtempSync(join(dir, 'g-')), fileTesto = join(qui, 'testo.txt');
    writeFileSync(fileTesto, testo, { mode: 0o600 });
    const piattaforma = process.platform, nome = join(qui, 'avvia' + (piattaforma === 'darwin' ? '.command' : piattaforma === 'win32' ? '.cmd' : '.sh'));
    const eseguibile = lista().find(a => a.tipo === 'cli' && a.id === agente)?.percorso || null;
    const s = scriptTerminale({ piattaforma, cartella, fileTesto, agente, eseguibile, script: piattaforma === 'win32' ? null : nome });
    writeFileSync(nome, s.contenuto, { mode: 0o700 }); chmodSync(nome, 0o700);
    const c = comandoTerminale({ piattaforma, script: nome }); if (!c) return { errore: t('desktop.guida-nessun-terminale') };
    if (finta) return segna({ azione: 'terminale', agente, cartella, script: nome, comando: c });
    await esegui(c); return { ok: true };
  });
}
