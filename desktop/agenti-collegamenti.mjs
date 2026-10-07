// I collegamenti del ponte (desktop/agenti.mjs) con ogni agente di programmazione: dove sta la sua configurazione e
// come ci si aggiunge Lode SENZA toccare il resto. Regole uguali per tutti:
// - Lode scrive solo dopo il sì dello studente in una finestra di sistema che mostra il file e il testo esatto (main.mjs);
// - si fonde, non si sovrascrive: le voci di Lode si riconoscono dall'indirizzo (127.0.0.1 …/lode/…) e solo quelle si
//   tolgono o si rimettono; un file che non si legge (JSON rotto) non si tocca;
// - la prima volta si fa una copia del file com'era (<file>.prima-di-lode), una volta sola;
// - il comando è curl, che c'è su Mac, Linux e Windows 10+ (curl.exe): niente node, niente script di Lode da eseguire.
//   Manda l'evento e butta la risposta (-o /dev/null), esce sempre con 0 (|| true): non blocca e non parla all'agente.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const SEGNO = /127\.0\.0\.1:\d+\/lode\//;
const WIN = process.platform === 'win32';
// il comando che manda lo stdin (il JSON dell'evento) a Lode
// Su Windows niente operatori: la shell dell'agente può essere PowerShell 5.1 (niente «||») o cmd. Con Lode chiusa curl
// esce con 7 (connessione rifiutata), mai con 2 (che per gli agenti vuol dire «blocca»)
export const curl = (url, { win = WIN } = {}) => win ? `curl.exe -s -o NUL --max-time 3 --data-binary @- ${url}` : `curl -s -o /dev/null --max-time 3 --data-binary @- ${url} || true`;
const leggi = f => { try { return readFileSync(f, 'utf8'); } catch { return null; } };
const json = t => { if (t == null || !t.trim()) return {}; const x = JSON.parse(t); if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('non è un oggetto JSON'); return x; };
const nostro = x => SEGNO.test(JSON.stringify(x ?? ''));

/* ---------- gli agenti ---------- */
// Formati verificati sulla documentazione ufficiale (ottobre 2026; vedi docs/PROGETTO-INFORMATICA.md, «Ponte con gli agenti»).
// Fuori per ora: Kiro (le pagine ufficiali si contraddicono sui nomi degli eventi), Amp (plugin forse sperimentali), Cline
// (non va su Windows, documentazione in movimento), Junie (niente evento sulle modifiche), Roo Code e Zed (niente hook).
// Ogni agente: id (anche nel percorso dell'evento), nome, dove (la cartella della sua configurazione: se c'è, è installato),
// file, applica(testo, url) → testo nuovo, togli(testo) → testo senza Lode, eventi (quelli che manda), nota per lo studente.

// i file JSON con gli hook «alla Claude Code» (Claude Code, Codex, Qwen Code): hooks: { Evento: [ { matcher?, hooks: [ {…} ] } ] }
function stileClaude(id, voci, extra = () => ({})) {
  return {
    applica(testo, url) {
      const c = json(testo); const h = c.hooks && typeof c.hooks === 'object' && !Array.isArray(c.hooks) ? c.hooks : (c.hooks = {});
      for (const [ev, percorso, matcher] of voci) {
        const lista = Array.isArray(h[ev]) ? h[ev].filter(x => !nostro(x)) : [];
        lista.push({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: curl(`${url}/${id}/${percorso}`, { win: false }), ...extra(`${url}/${id}/${percorso}`) }] });
        h[ev] = lista;
      }
      return JSON.stringify(c, null, 2) + '\n';
    },
    togli: togliDaHooks,
  };
}
// toglie le voci di Lode da hooks: { Evento: [ … ] } (anche dove gli hook sono un elenco piatto, come in Cursor e Windsurf)
function togliDaHooks(testo) {
  const c = json(testo);
  if (c.hooks && typeof c.hooks === 'object') {
    for (const k of Object.keys(c.hooks)) { if (!Array.isArray(c.hooks[k])) continue; c.hooks[k] = c.hooks[k].filter(x => !nostro(x)); if (!c.hooks[k].length) delete c.hooks[k]; }
    if (!Object.keys(c.hooks).length) delete c.hooks;
  }
  return JSON.stringify(c, null, 2) + '\n';
}
// un elenco piatto di comandi per evento (Cursor, Windsurf): hooks: { evento: [ {command, …} ] }
function stilePiatto(id, voci, voce, base = {}) {
  return {
    applica(testo, url) {
      const c = { ...base, ...json(testo) }; const h = c.hooks && typeof c.hooks === 'object' && !Array.isArray(c.hooks) ? c.hooks : (c.hooks = {});
      for (const [ev, percorso] of voci) { const lista = Array.isArray(h[ev]) ? h[ev].filter(x => !nostro(x)) : []; lista.push(voce(`${url}/${id}/${percorso}`)); h[ev] = lista; }
      return JSON.stringify(c, null, 2) + '\n';
    },
    togli: togliDaHooks,
  };
}
// un file tutto di Lode (Copilot CLI, OpenCode): collegare lo scrive, scollegare lo svuota (resta solo se non è nostro)
function fileNostro(crea) {
  return { applica: (testo, url) => { if (testo != null && testo.trim() && !SEGNO.test(testo)) throw new Error('c\'è già un file con questo nome che non è di Lode'); return crea(url); }, togli: testo => (testo != null && SEGNO.test(testo) ? '' : testo), proprio: true };
}
const ps = url => `$input | curl.exe -s -o NUL --max-time 3 --data-binary '@-' ${url}; exit 0`;
const conWin = (url, chiave) => WIN ? { [chiave]: curl(url, { win: true }) } : {};

export const AGENTI = [
  {
    id: 'claude', nome: 'Claude Code', dove: casa => join(casa, '.claude'), file: casa => join(casa, '.claude', 'settings.json'),
    eventi: ['prompt', 'modifiche e comandi', 'fine del turno', 'notifiche'],
    nota: 'Gli hook valgono dalla prossima sessione (o rivedili in /hooks).',
    // async: Claude Code non aspetta curl. Su Windows gli hook girano in Git Bash (che Claude Code richiede): curl c'è
    ...stileClaude('claude', [['UserPromptSubmit', 'prompt'], ['PostToolUse', 'strumento', 'Edit|Write|MultiEdit|NotebookEdit|Bash'], ['PostToolUseFailure', 'strumento', 'Bash'], ['Stop', 'fine'], ['Notification', 'notifica']], () => ({ async: true, timeout: 5 })),
  },
  {
    id: 'codex', nome: 'Codex CLI', dove: casa => join(casa, '.codex'), file: casa => join(casa, '.codex', 'hooks.json'),
    eventi: ['prompt', 'modifiche (apply_patch) e comandi', 'fine del turno'],
    nota: 'Alla prossima sessione Codex ti chiede di approvare gli hook nuovi: fallo con /hooks.',
    ...stileClaude('codex', [['UserPromptSubmit', 'prompt'], ['PostToolUse', 'strumento', '.*'], ['Stop', 'fine']], u => ({ commandWindows: curl(u, { win: true }), timeout: 5 })),
  },
  {
    id: 'gemini', nome: 'Gemini CLI', dove: casa => join(casa, '.gemini'), file: casa => join(casa, '.gemini', 'settings.json'),
    eventi: ['prompt', 'strumenti (file e comandi)', 'fine della risposta', 'notifiche'],
    nota: 'Vale dalla prossima sessione di Gemini CLI.',
    applica(testo, url) {
      const c = json(testo); const h = c.hooks && typeof c.hooks === 'object' && !Array.isArray(c.hooks) ? c.hooks : (c.hooks = {});
      for (const [ev, percorso] of [['BeforeAgent', 'prompt'], ['AfterTool', 'strumento'], ['AfterAgent', 'fine'], ['Notification', 'notifica']]) {
        const lista = Array.isArray(h[ev]) ? h[ev].filter(x => !nostro(x)) : [];
        lista.push({ matcher: '.*', hooks: [{ name: 'lode', type: 'command', command: curl(`${url}/gemini/${percorso}`), timeout: 3000 }] });
        h[ev] = lista;
      }
      return JSON.stringify(c, null, 2) + '\n';
    },
    togli: togliDaHooks,
  },
  {
    id: 'cursor', nome: 'Cursor', dove: casa => join(casa, '.cursor'), file: casa => join(casa, '.cursor', 'hooks.json'),
    eventi: ['prompt', 'file modificati', 'comandi', 'risposta dell\'agente'],
    nota: 'Riavvia Cursor perché legga gli hook. Cursor non dice il codice d\'uscita dei comandi: i test lanciati si vedono, l\'esito no.',
    // niente «stop»: lì una risposta potrebbe far ripartire l'agente (followup_message)
    ...stilePiatto('cursor', [['beforeSubmitPrompt', 'prompt'], ['afterFileEdit', 'modifica'], ['afterShellExecution', 'shell'], ['afterAgentResponse', 'fine']], u => ({ command: curl(u) }), { version: 1 }),
  },
  {
    id: 'copilot', nome: 'GitHub Copilot CLI', dove: casa => join(casa, '.copilot'), file: casa => join(casa, '.copilot', 'hooks', 'lode.json'),
    eventi: ['prompt', 'strumenti (file e comandi)', 'fine del turno', 'notifiche'],
    nota: 'Un file solo di Lode in ~/.copilot/hooks: vale dalla prossima sessione. Copilot non manda l\'ultimo messaggio dell\'agente.',
    ...fileNostro(url => JSON.stringify({ version: 1, hooks: Object.fromEntries([['userPromptSubmitted', 'prompt'], ['postToolUse', 'strumento'], ['agentStop', 'fine'], ['notification', 'notifica']].map(([ev, p]) => [ev, [{ type: 'command', bash: curl(`${url}/copilot/${p}`, { win: false }), powershell: ps(`${url}/copilot/${p}`), timeoutSec: 5 }]])) }, null, 2) + '\n'),
  },
  {
    id: 'windsurf', nome: 'Windsurf (Devin Desktop)', dove: casa => join(casa, '.codeium', 'windsurf'), file: casa => join(casa, '.codeium', 'windsurf', 'hooks.json'),
    eventi: ['prompt', 'codice scritto', 'comandi', 'risposta di Cascade'],
    nota: 'Vale dalla prossima conversazione di Cascade. Windsurf non dice il codice d\'uscita dei comandi.',
    ...stilePiatto('windsurf', [['pre_user_prompt', 'prompt'], ['post_write_code', 'modifica'], ['post_run_command', 'shell'], ['post_cascade_response', 'fine']], u => ({ command: curl(u, { win: false }), powershell: ps(u), show_output: false })),
  },
  {
    id: 'qwen', nome: 'Qwen Code', dove: casa => join(casa, '.qwen'), file: casa => join(casa, '.qwen', 'settings.json'),
    eventi: ['prompt', 'strumenti (file e comandi)', 'fine del turno', 'notifiche'],
    nota: 'Vale dalla prossima sessione di Qwen Code.',
    ...stileClaude('qwen', [['UserPromptSubmit', 'prompt'], ['PostToolUse', 'strumento', '.*'], ['Stop', 'fine'], ['Notification', 'notifica']], () => ({ timeout: 5 })),
  },
  {
    id: 'opencode', nome: 'OpenCode', dove: casa => join(casa, '.config', 'opencode'), file: casa => join(casa, '.config', 'opencode', 'plugins', 'lode.js'),
    eventi: ['file modificati', 'comandi', 'fine del turno'],
    nota: 'Un plugin di Lode in ~/.config/opencode/plugins: vale dal prossimo avvio di OpenCode. Legge e basta: non tocca le risposte.',
    ...fileNostro(pluginOpenCode('opencode')),
  },
  {
    id: 'kilo', nome: 'Kilo Code', dove: casa => join(casa, '.config', 'kilo'), file: casa => join(casa, '.config', 'kilo', 'plugin', 'lode.js'),
    eventi: ['file modificati', 'comandi', 'fine del turno'],
    nota: 'Il plugin è quello di OpenCode (Kilo ne è un fork): vale dal prossimo avvio. Formato degli eventi da verificare sulla tua versione.',
    ...fileNostro(pluginOpenCode('kilo')),
  },
  {
    id: 'aider', nome: 'Aider', dove: casa => join(casa, '.aider'), file: casa => join(casa, '.aider.conf.yml'),
    eventi: ['fine della risposta (senza dettagli)'],
    nota: 'Aider avvisa solo che ha finito di rispondere, senza dire cosa ha toccato: i file cambiati li vede «segui progetto».',
    applica(testo, url) {
      const t = (testo || '').split('\n').filter(r => !/#\s*lode\b/i.test(r) && !SEGNO.test(r));
      if (t.some(r => /^\s*notifications(?:_command)?\s*:/.test(r))) throw new Error('ci sono già le notifiche di Aider: Lode non le sovrascrive');
      return [...t.join('\n').replace(/\n+$/, '').split('\n').filter((r, i, a) => r || i < a.length - 1), '# lode: avvisa Lode (sola lettura) quando Aider finisce di rispondere', 'notifications: true # lode', `notifications_command: "curl -s -o /dev/null --max-time 3 -d aider ${url}/aider/fine" # lode`].join('\n').replace(/^\n/, '') + '\n';
    },
    togli: testo => testo == null ? null : testo.split('\n').filter(r => !/#\s*lode\b/i.test(r) && !SEGNO.test(r)).join('\n'),
  },
];
// il plugin per OpenCode e Kilo: manda a Lode file modificati, comandi bash e fine del turno. Non cambia mai output né args
function pluginOpenCode(id) {
  return url => `// Lode (sola lettura): manda a Lode, su questo computer, i file modificati, i comandi e la fine del turno.
// Scritto da Lode con il tuo consenso: «scollega ${id}» in Lode lo toglie. Non cambia niente di quello che fa l'agente.
const URL = ${JSON.stringify(url + '/' + id)};
const manda = (evento, corpo) => fetch(URL + '/' + evento, { method: 'POST', body: JSON.stringify(corpo), signal: AbortSignal.timeout(3000) }).catch(() => { });
export const Lode = async ({ directory }) => ({
  event: async ({ event }) => {
    if (event?.type === 'file.edited') manda('modifica', { cwd: directory, file_path: event.properties?.file });
    if (event?.type === 'session.idle') manda('fine', { cwd: directory, session_id: event.properties?.sessionID });
  },
  'tool.execute.before': async (input, output) => {
    if (input?.tool === 'bash' && output?.args?.command) manda('shell', { cwd: directory, session_id: input.sessionID, command: String(output.args.command) });
  },
});
`;
}
export const agente = id => AGENTI.find(a => a.id === id) || null;

/* ---------- leggere, mostrare, scrivere ---------- */
export function stato(casa) {
  return AGENTI.map(a => {
    const f = a.file(casa), t = leggi(f);
    return { id: a.id, nome: a.nome, installato: existsSync(a.dove(casa)) || (a.id === 'aider' && t != null), collegato: t != null && SEGNO.test(t), eventi: a.eventi, nota: a.nota || '' };
  });
}
// cosa cambierebbe: il file e il testo prima/dopo, senza scrivere niente
export function anteprima(id, { casa, url, togli = false }) {
  const a = agente(id); if (!a) return { errore: 'agente sconosciuto' };
  const f = a.file(casa), prima = leggi(f);
  let dopo; try { dopo = togli ? (prima == null ? null : a.togli(prima)) : a.applica(prima, url); } catch (e) { return { errore: `${f} non si legge (${e.message}): non lo tocco. Sistemalo o collega a mano.` }; }
  return { file: f, prima, dopo, esiste: prima != null, nome: a.nome, proprio: !!a.proprio };
}
// scrive davvero (dopo la conferma): copia di sicurezza la prima volta, poi file temporaneo e rinomina
export function scrivi(p) {
  if (p.errore || p.dopo == null) return p;
  mkdirSync(dirname(p.file), { recursive: true });
  const copia = p.file + '.prima-di-lode';
  if (p.esiste && !p.proprio && !existsSync(copia)) copyFileSync(p.file, copia);
  if (p.dopo === '' && p.proprio) { rmSync(p.file, { force: true }); return { ok: true, file: p.file, tolto: true }; }
  const t = p.file + '.lode-tmp'; writeFileSync(t, p.dopo); renameSync(t, p.file);
  return { ok: true, file: p.file, copia: p.esiste ? copia : null };
}
// le righe che cambiano, per la finestra di conferma (al massimo 40)
export function differenza(prima, dopo) {
  const a = String(prima || '').split('\n'), b = String(dopo || '').split('\n'), sa = new Set(a), sb = new Set(b);
  const via = a.filter(r => !sb.has(r) && r.trim()).map(r => '− ' + r.trim()), su = b.filter(r => !sa.has(r) && r.trim()).map(r => '+ ' + r.trim());
  const tutto = [...via, ...su];
  return tutto.slice(0, 40).join('\n') + (tutto.length > 40 ? `\n… e altre ${tutto.length - 40} righe` : '');
}
