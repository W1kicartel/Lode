// Il ponte con gli agenti di programmazione (docs/PROGETTO-INFORMATICA.md §3.1), in sola lettura.
// Claude Code, Codex, Gemini CLI, Cursor e gli altri (desktop/agenti-collegamenti.mjs) mandano i loro eventi con un comando
// curl a un piccolo server su 127.0.0.1, con un token casuale nel percorso: /lode/<token>/<agente>/<evento>.
// Il server risponde SEMPRE vuoto (204): niente finisce nel contesto dell'agente e niente decide al suo posto.
// Rifiuta le richieste dei browser (header Origin), i corpi oltre 2 MB e i token sbagliati.
// Gli eventi contano solo se cadono in un progetto seguito («segui progetto»): quelli delle altre cartelle si buttano subito.
// Con gli eventi Lode dice allo studente cose che dai soli file non si vedono:
// - il riassunto del turno dell'agente (file toccati, comandi, test lanciati o no);
// - «dice che i test passano, ma dopo la sua ultima modifica non li ha rilanciati»;
// - «ha modificato i test mentre fallivano».
// Sono stime da regole fisse: se le regole non trovano niente, non è una garanzia (lo dice la scheda).
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const MAX_CORPO = 2 * 1048576;
const MAX_EVENTI = 300;

/* ---------- riconoscere test, file di test e «i test passano» ---------- */
// i comandi che lanciano dei test (o le prove del laboratorio)
export const TEST = /(?:^|[\s;&|(])(?:make\s+(?:\S+\s+)*(?:test|check|prove)\b|ctest\b|pytest\b|python3?\s+-m\s+(?:pytest|unittest)\b|npm\s+(?:run\s+)?test\b|npx\s+(?:jest|vitest|mocha)\b|yarn\s+test\b|pnpm\s+(?:run\s+)?test\b|jest\b|vitest\b|mocha\b|cargo\s+test\b|go\s+test\b|mvn\s+(?:\S+\s+)*test\b|gradle\w*\s+(?:\S+\s+)*test\b|\.\/gradlew\s+(?:\S+\s+)*test\b|dotnet\s+test\b|ruby\s+\S*test\S*|rspec\b|phpunit\b|\.\/\S*(?:test|prove|check)\S*|bash\s+\S*(?:test|prove)\S*\.sh|valgrind\b|diff\s+(?:\S+\s+)?\S+\.(?:out|expected)\b)/i;
export const FILE_TEST = /(?:^|[\\/])(?:tests?|spec|__tests__|prove)(?:[\\/]|$)|(?:^|[\\/._-])(?:test|tests|spec)(?:[._-][^\\/]*)?\.[a-z0-9]+$|_test\.[a-z0-9]+$|\.(?:in|out|expected)$/i;
// l'ultimo messaggio dell'agente che dice che i test passano (italiano e inglese)
export const DICE_PASSANO = /\b(?:all\s+(?:\d+\s+)?tests?\s+(?:now\s+)?pass(?:ed|ing)?|tests?\s+(?:are\s+)?(?:now\s+)?pass(?:ed|ing)|(?:\d+\s+)?passed,?\s+0\s+failed|tutti\s+i\s+test\s+(?:ora\s+)?(?:passano|superati)|i\s+test\s+(?:ora\s+)?passano|test\s+superati|build\s+(?:and\s+tests?\s+)?(?:succeed|pass)|everything\s+(?:passes|works))\b|✅\s*(?:tests?|test)/i;

/* ---------- dagli eventi di ogni agente a una forma sola ---------- */
// { tipo: 'prompt'|'modifica'|'comando'|'fine'|'notifica'|'inizio', cwd, file: [assoluti], comando, codice, messaggio, sessione }
const testo = x => typeof x === 'string' ? x : x == null ? '' : JSON.stringify(x);
const primo = (...v) => v.find(x => x != null && x !== '');
function fileDa(x) {
  const out = [], metti = p => { if (typeof p === 'string' && p.trim()) out.push(p.trim()); };
  if (!x || typeof x !== 'object') return out;
  metti(x.file_path); metti(x.filePath); metti(x.path); metti(x.notebook_path); metti(x.file); metti(x.target_file); metti(x.absolute_path);
  for (const e of [x.edits, x.files, x.changes].filter(Array.isArray)) for (const y of e) { if (typeof y === 'string') metti(y); else { metti(y?.file_path); metti(y?.path); metti(y?.file); } }
  return out;
}
const codiceDa = r => { const c = primo(r?.exit_code, r?.exitCode, r?.code, r?.returncode, r?.status); return Number.isInteger(+c) && c !== '' && c != null ? +c : null; };
export function normalizza(agente, evento, d = {}) {
  d = d && typeof d === 'object' ? d : {};
  // Copilot manda gli argomenti come testo JSON; Windsurf mette tutto in tool_info
  let args = d.tool_input || d.toolInput || d.toolArgs || d.tool_info || d.input || d.args || d.parameters || {};
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = { command: args }; } }
  const tool = primo(d.tool_name, d.toolName, d.tool, d.name) || '', input = args && typeof args === 'object' ? args : {};
  const risposta = d.tool_response || d.toolResponse || d.toolResult || d.result || (typeof d.output === 'object' ? d.output : null) || {};
  const base = { agente, cwd: primo(d.cwd, d.workspace_roots?.[0], d.workspaceRoots?.[0], d.workingDirectory, d.project_dir, d.projectDir, d.tool_info?.cwd, d.directory) || null, sessione: String(primo(d.session_id, d.sessionId, d.conversation_id, d.thread_id, d['thread-id'], d.trajectory_id, d.taskId) || '').slice(0, 80) || null };
  const e = String(evento || '').toLowerCase();
  if (/prompt|submit|user/.test(e)) return { ...base, tipo: 'prompt' };
  if (/^(?:fine|stop|idle|turn|agent-turn-complete|session\.idle|afteragent|aftermodel)/.test(e) || d.type === 'agent-turn-complete')
    return { ...base, tipo: 'fine', messaggio: testo(primo(d['last-assistant-message'], d.last_assistant_message, d.lastAssistantMessage, d.prompt_response, d.response, d.tool_info?.response, d.text, d.message)).slice(0, 4000) };
  if (/notif/.test(e)) return { ...base, tipo: 'notifica', messaggio: testo(primo(d.message, d.title, d.text)).slice(0, 500) };
  if (/session|inizio|start/.test(e)) return { ...base, tipo: 'inizio' };
  // un comando della shell: Bash di Claude Code, run_shell_command di Gemini, beforeShellExecution di Cursor…
  const cmd = primo(input.command, input.cmd, input.command_line, d.command, d.command_line, Array.isArray(input.argv) ? input.argv.join(' ') : null);
  if (/shell|bash|command|exec/.test(e) || /^(?:bash|shell|run_shell_command|run_terminal_cmd|execute_command|terminal|exec)$/i.test(tool)) {
    if (cmd) return { ...base, tipo: 'comando', comando: String(cmd).slice(0, 2000), codice: codiceDa(risposta) ?? codiceDa(d) };
  }
  const file = [...fileDa(input), ...fileDa(d)];
  if (file.length || /edit|write|file/.test(e) || /edit|write|replace|create|patch|notebook/i.test(tool)) return { ...base, tipo: 'modifica', file: [...new Set(file)].slice(0, 50) };
  if (cmd) return { ...base, tipo: 'comando', comando: String(cmd).slice(0, 2000), codice: codiceDa(risposta) ?? codiceDa(d) };
  return { ...base, tipo: 'altro' };
}

/* ---------- a quale progetto seguito appartiene un evento ---------- */
const dentro = (radice, p) => { if (!p) return false; const r = relative(radice, p); return r === '' || (!!r && !r.startsWith('..') && !isAbsolute(r)); };
export function progettoDi(ev, progetti) {
  // il progetto più interno che contiene la cartella di lavoro o il primo file toccato
  const candidati = Object.entries(progetti || {}).filter(([, p]) => p?.percorso);
  const prova = x => candidati.filter(([, p]) => dentro(p.percorso, x)).sort((a, b) => b[1].percorso.length - a[1].percorso.length)[0];
  const ass = f => isAbsolute(f) ? f : ev.cwd ? resolve(ev.cwd, f) : null;
  const c = (ev.file || []).map(ass).map(prova).find(Boolean) || prova(ev.cwd);
  return c ? { id: c[0], radice: c[1].percorso, nome: c[1].nome } : null;
}
const rel = (radice, f, cwd) => { const a = isAbsolute(f) ? f : resolve(cwd || radice, f); const r = relative(radice, a); return r && !r.startsWith('..') ? r.split(sep).join('/') : null; };

/* ---------- il turno: da un prompt alla fine ---------- */
// eventi di un progetto (già con t e rel) → il riassunto dell'ultimo turno di una sessione (o di tutte, se la sessione manca)
export function turno(eventi, { sessione = null } = {}) {
  const ev = eventi.filter(e => !sessione || !e.sessione || e.sessione === sessione);
  let da = 0; for (let i = ev.length - 2; i >= 0; i--) if (ev[i].tipo === 'prompt' || ev[i].tipo === 'fine') { da = ev[i].tipo === 'prompt' ? i : i + 1; break; }
  const t = ev.slice(da), fine = t.findLast(e => e.tipo === 'fine');
  const modifiche = t.filter(e => e.tipo === 'modifica'), comandi = t.filter(e => e.tipo === 'comando'), test = comandi.filter(e => TEST.test(' ' + e.comando));
  const file = [...new Set(modifiche.flatMap(e => e.rel || []))];
  const ultimaModifica = modifiche.at(-1)?.t || 0, ultimoTest = test.at(-1) || null;
  const avvisi = [];
  // «dice che passano, ma non li ha rilanciati dopo l'ultima modifica»
  if (fine?.messaggio && DICE_PASSANO.test(fine.messaggio) && ultimaModifica && (!ultimoTest || ultimoTest.t < ultimaModifica))
    avvisi.push({ tipo: 'non-rilanciati', testo: ultimoTest ? 'Dice che i test passano, ma dopo la sua ultima modifica non li ha rilanciati.' : 'Dice che i test passano, ma in questo turno non l\'ho visto lanciarli.' });
  // «ha modificato i test mentre fallivano»: una modifica a un file di test dopo un test fallito, prima di un test riuscito
  let fallito = null;
  for (const e of t) {
    if (e.tipo === 'comando' && TEST.test(' ' + e.comando) && e.codice != null) fallito = e.codice !== 0 ? e : null;
    if (e.tipo === 'modifica' && fallito && (e.rel || []).some(f => FILE_TEST.test(f))) { avvisi.push({ tipo: 'test-toccati', testo: `Ha modificato i test (${(e.rel || []).filter(f => FILE_TEST.test(f)).slice(0, 2).map(f => '`' + f + '`').join(', ')}) mentre fallivano: controlla che non li abbia resi più facili.` }); break; }
  }
  return { agente: (fine || t.at(-1))?.agente || null, inizio: t[0]?.t || null, fine: fine?.t || null, file, comandi: comandi.length, test: test.length, ultimoTest: ultimoTest ? { comando: ultimoTest.comando.slice(0, 120), codice: ultimoTest.codice, t: ultimoTest.t } : null, dopoTest: !!ultimoTest && ultimoTest.t >= ultimaModifica, avvisi, messaggio: (fine?.messaggio || '').slice(0, 400) };
}

/* ---------- il server ---------- */
// progetti(): conf.progetti (id → {percorso, nome}); manda(canale, x): alla barra; salva/carica: gli eventi per progetto
export function crea({ token, porta = 0, progetti, manda = () => { }, adesso = () => Date.now() }) {
  const eventi = new Map();   // id progetto → [eventi]
  const contatori = { ricevuti: 0, scartati: 0, perAgente: {} };
  // lo stesso file di configurazione lo leggono più agenti (.claude/settings.json anche Copilot e Continue): chi scrive
  // si riconosce dalla forma dei campi
  const chi = (agente, c) => !c || typeof c !== 'object' ? agente : c.toolName && c.sessionId ? 'copilot' : c.conversation_id && c.workspace_roots ? 'cursor' : c.trajectory_id ? 'windsurf' : agente;
  function ricevi(agente0, evento, corpo) {
    const agente = chi(agente0, corpo);
    contatori.ricevuti++; contatori.perAgente[agente] = { ultimo: adesso(), n: (contatori.perAgente[agente]?.n || 0) + 1 };
    const ev = normalizza(agente, evento, corpo); if (ev.tipo === 'altro') return null;
    const p = progettoDi(ev, progetti()); if (!p) { contatori.scartati++; return null; }
    const e = { ...ev, t: adesso(), rel: (ev.file || []).map(f => rel(p.radice, f, ev.cwd)).filter(Boolean) };
    delete e.file; delete e.cwd;   // i percorsi assoluti non escono dal main
    const lista = eventi.get(p.id) || []; lista.push(e); if (lista.length > MAX_EVENTI) lista.splice(0, lista.length - MAX_EVENTI); eventi.set(p.id, lista);
    manda('agente:evento', { id: p.id, nome: p.nome, agente, tipo: e.tipo, rel: e.rel, t: e.t });
    if (e.tipo === 'fine') manda('agente:turno', { id: p.id, nome: p.nome, ...turno(lista, { sessione: e.sessione }) });
    return { progetto: p.id, evento: e };
  }
  const server = http.createServer((req, res) => {
    const fine = (c = 204) => { res.statusCode = c; res.end(); };
    // dai browser no (una pagina web potrebbe provare a chiamarlo): gli agenti non mandano Origin
    if (req.headers.origin || req.method !== 'POST') return fine(req.method === 'POST' ? 403 : 405);
    const m = String(req.url || '').match(/^\/lode\/([a-f0-9]{32})\/([a-z0-9-]{2,24})\/([a-zA-Z0-9._-]{1,48})\/?$/);
    if (!m || m[1] !== token) return fine(404);
    let n = 0; const pezzi = [];
    req.on('data', d => { n += d.length; if (n > MAX_CORPO) { req.destroy(); return; } pezzi.push(d); });
    req.on('end', () => {
      fine(204);   // subito, sempre vuoto: l'agente non aspetta Lode e non riceve niente
      let corpo = {}; const t = Buffer.concat(pezzi).toString('utf8').trim();
      if (t) { try { corpo = JSON.parse(t); } catch { try { corpo = JSON.parse(decodeURIComponent(t)); } catch { corpo = { message: t.slice(0, 2000) }; } } }
      try { ricevi(m[2], m[3], corpo); } catch (e) { console.error('Lode: evento dell\'agente', e); }
    });
    req.on('error', () => { });
  });
  server.headersTimeout = 5000; server.requestTimeout = 5000;
  const avvia = () => new Promise((ok, ko) => {
    server.once('error', e => { if (porta && e.code === 'EADDRINUSE') { porta = 0; server.listen(0, '127.0.0.1', () => ok(server.address().port)); } else ko(e); });
    server.listen(porta, '127.0.0.1', () => ok(server.address().port));
  });
  return {
    avvia, ricevi, chiudi: () => new Promise(r => server.close(() => r())),
    porta: () => server.address()?.port || null,
    eventi: id => eventi.get(id) || [],
    turno: (id, o) => turno(eventi.get(id) || [], o),
    contatori: () => contatori,
  };
}
export const nuovoToken = () => randomBytes(16).toString('hex');
