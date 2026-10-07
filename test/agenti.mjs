// Il ponte con gli agenti di programmazione (desktop/agenti.mjs): node test/agenti.mjs
import * as A from '../desktop/agenti.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const R = join(tmpdir(), 'lab3-liste'), PROGETTI = { p1: { percorso: R, nome: 'lab3-liste' }, p2: { percorso: join(R, 'sotto'), nome: 'sotto' } };

// dagli eventi di ogni agente alla forma comune
const cc = A.normalizza('claude', 'strumento', { session_id: 's1', cwd: R, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: join(R, 'lista.c'), old_string: 'a', new_string: 'b' } });
prova('Claude Code: Edit → modifica', cc.tipo === 'modifica' && cc.file[0] === join(R, 'lista.c') && cc.sessione === 's1');
const cb = A.normalizza('claude', 'strumento', { session_id: 's1', cwd: R, tool_name: 'Bash', tool_input: { command: 'make test' }, tool_response: { stdout: 'ok', exit_code: 2 } });
prova('Claude Code: Bash → comando con codice', cb.tipo === 'comando' && cb.comando === 'make test' && cb.codice === 2);
const cm = A.normalizza('claude', 'strumento', { cwd: R, tool_name: 'MultiEdit', tool_input: { file_path: 'test/prova.c', edits: [{ old_string: 'x', new_string: 'y' }] } });
prova('Claude Code: MultiEdit con percorso relativo', cm.tipo === 'modifica' && cm.file[0] === 'test/prova.c');
const cx = A.normalizza('codex', 'fine', { type: 'agent-turn-complete', 'thread-id': 't9', cwd: R, 'last-assistant-message': 'All tests pass now.', 'input-messages': ['fix'] });
prova('Codex: notify → fine con messaggio', cx.tipo === 'fine' && /All tests pass/.test(cx.messaggio) && cx.sessione === 't9');
const cu = A.normalizza('cursor', 'modifica', { conversation_id: 'c1', file_path: join(R, 'main.c'), edits: [{ old_string: 'a', new_string: 'b' }], workspace_roots: [R] });
prova('Cursor: afterFileEdit', cu.tipo === 'modifica' && cu.file.includes(join(R, 'main.c')) && cu.cwd === R);
const cs = A.normalizza('cursor', 'shell', { command: 'gcc lista.c && ./a.out', cwd: R });
prova('Cursor: comando della shell', cs.tipo === 'comando' && /gcc/.test(cs.comando));
const ge = A.normalizza('gemini', 'strumento', { cwd: R, tool_name: 'run_shell_command', tool_input: { command: 'pytest -q' }, tool_response: { exitCode: 1 } });
prova('Gemini: run_shell_command', ge.tipo === 'comando' && ge.codice === 1);
prova('prompt e notifica', A.normalizza('claude', 'prompt', { cwd: R, prompt: 'segreto' }).tipo === 'prompt' && !('prompt' in A.normalizza('claude', 'prompt', { cwd: R, prompt: 'segreto' })) && A.normalizza('claude', 'notifica', { message: 'serve il permesso' }).messaggio === 'serve il permesso');

// a quale progetto
prova('progetto: il più interno', A.progettoDi({ cwd: join(R, 'sotto', 'x') }, PROGETTI)?.id === 'p2' && A.progettoDi({ cwd: R }, PROGETTI)?.id === 'p1');
prova('progetto: dal file assoluto anche con un altro cwd', A.progettoDi({ cwd: '/altrove', file: [join(R, 'a.c')] }, PROGETTI)?.id === 'p1');
prova('progetto: fuori da quelli seguiti → niente', A.progettoDi({ cwd: join(tmpdir(), 'lab3-listeX') }, PROGETTI) === null && A.progettoDi({ cwd: null }, PROGETTI) === null);

// riconoscere test e «passano»
prova('test: comandi', ['make test', 'pytest -q', 'npm test', 'cargo test', 'go test ./...', './run_tests.sh', 'python3 -m unittest', 'mvn -q test', 'ctest', 'bash prove.sh', 'diff out.txt atteso.out'].every(c => A.TEST.test(' ' + c)) && !['make', 'gcc lista.c', 'ls tests', 'cat test.c'].some(c => A.TEST.test(' ' + c)));
prova('test: file', ['tests/lista_test.c', 'test_lista.py', 'lista.test.js', 'prove/caso1.in', 'spec/a.rb', 'caso1.out'].every(f => A.FILE_TEST.test(f)) && !['lista.c', 'main.py', 'latest.c', 'contest.c'].some(f => A.FILE_TEST.test(f)));
prova('dice che passano', ['All tests pass.', 'All 12 tests passed', 'I test ora passano', 'Tutti i test passano ✅', '5 passed, 0 failed', '✅ Tests'].every(m => A.DICE_PASSANO.test(m)) && !['I will run the tests', 'Some tests fail', 'test non passano'].some(m => A.DICE_PASSANO.test(m)));

// il server: token, Origin, sempre vuoto
const TOK = A.nuovoToken(), arrivati = [];
const S = A.crea({ token: TOK, progetti: () => PROGETTI, manda: (c, x) => arrivati.push([c, x]) });
const porta = await S.avvia(), url = (ag, ev, t = TOK) => `http://127.0.0.1:${porta}/lode/${t}/${ag}/${ev}`;
const manda = (u, corpo, h = {}) => fetch(u, { method: 'POST', body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo), headers: h });
let r = await manda(url('claude', 'prompt'), { cwd: R, session_id: 's1', prompt: 'aggiusta la lista' });
prova('server: 204 vuoto', r.status === 204 && (await r.text()) === '');
prova('server: token sbagliato', (await manda(url('claude', 'prompt', 'f'.repeat(32)), {})).status === 404);
prova('server: niente dai browser', (await manda(url('claude', 'prompt'), { cwd: R }, { Origin: 'https://sito-cattivo.example' })).status === 403);
prova('server: solo POST', (await fetch(url('claude', 'prompt'))).status === 405);
// un turno intero: modifica, test che fallisce, modifica del test, fine «all tests pass» senza rilanciare
const passi = [
  ['strumento', { cwd: R, session_id: 's1', tool_name: 'Edit', tool_input: { file_path: join(R, 'lista.c') } }],
  ['strumento', { cwd: R, session_id: 's1', tool_name: 'Bash', tool_input: { command: 'make test' }, tool_response: { exit_code: 1 } }],
  ['strumento', { cwd: R, session_id: 's1', tool_name: 'Write', tool_input: { file_path: join(R, 'tests', 'lista_test.c') } }],
  ['strumento', { cwd: R, session_id: 's1', tool_name: 'Edit', tool_input: { file_path: join(R, 'lista.c') } }],
  ['fine', { cwd: R, session_id: 's1', last_assistant_message: 'Done! All tests pass.' }],
];
for (const [e, c] of passi) { await manda(url('claude', e), c); await new Promise(x => setTimeout(x, 15)); }
await new Promise(x => setTimeout(x, 100));
const tu = arrivati.find(([c]) => c === 'agente:turno')?.[1];
prova('turno: file relativi e conteggi', tu && JSON.stringify(tu.file) === '["lista.c","tests/lista_test.c"]' && tu.comandi === 1 && tu.test === 1 && tu.nome === 'lab3-liste', JSON.stringify(tu));
prova('turno: test toccati mentre fallivano', tu?.avvisi.some(a => a.tipo === 'test-toccati'));
prova('turno: dice che passano senza rilanciarli', tu?.avvisi.some(a => a.tipo === 'non-rilanciati'), JSON.stringify(tu?.avvisi));
prova('i percorsi assoluti non escono dal main', !JSON.stringify(arrivati).includes(tmpdir()));
prova('il prompt non si salva', !JSON.stringify(S.eventi('p1')).includes('aggiusta la lista'));
// un turno pulito: modifica, test riuscito, fine
for (const [e, c] of [['prompt', { cwd: R, session_id: 's2' }], ['strumento', { cwd: R, session_id: 's2', tool_name: 'Edit', tool_input: { file_path: join(R, 'lista.c') } }], ['strumento', { cwd: R, session_id: 's2', tool_name: 'Bash', tool_input: { command: 'make test' }, tool_response: { exit_code: 0 } }], ['fine', { cwd: R, session_id: 's2', last_assistant_message: 'All tests pass.' }]]) { await manda(url('claude', e), c); await new Promise(x => setTimeout(x, 15)); }
await new Promise(x => setTimeout(x, 100));
const t2 = arrivati.filter(([c]) => c === 'agente:turno').at(-1)?.[1];
prova('turno pulito: niente avvisi, provato dopo l\'ultima modifica', t2 && !t2.avvisi.length && t2.dopoTest && JSON.stringify(t2.file) === '["lista.c"]', JSON.stringify(t2));
// fuori dai progetti seguiti: scartato
const prima = arrivati.length; await manda(url('codex', 'fine'), { cwd: '/tmp/altro', 'last-assistant-message': 'ok' }); await new Promise(x => setTimeout(x, 50));
prova('fuori dai progetti: scartato', arrivati.length === prima && S.contatori().scartati >= 1);
// Codex: il JSON come argomento (-d), anche non valido
await manda(url('codex', 'fine'), 'testo che non è json'); await new Promise(x => setTimeout(x, 30));
prova('corpo non JSON: non rompe niente', S.contatori().ricevuti >= 10);
// corpo troppo grande
let rotto = false; try { await manda(url('claude', 'strumento'), 'x'.repeat(A.MAX_CORPO + 10)); } catch { rotto = true; }
prova('corpo troppo grande: chiuso', rotto || true);

// i collegamenti: fondere senza toccare il resto, togliere solo le righe di Lode
{
  const C = await import('../desktop/agenti-collegamenti.mjs');
  const { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } = await import('node:fs');
  const casa = mkdtempSync(join(tmpdir(), 'lode-casa-')), url = 'http://127.0.0.1:47123/lode/' + 'c'.repeat(32);
  mkdirSync(join(casa, '.claude'));
  const loro = { model: 'opus', hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo loro' }] }] }, permissions: { allow: ['Bash(make:*)'] } };
  writeFileSync(join(casa, '.claude', 'settings.json'), JSON.stringify(loro, null, 2));
  prova('collegamenti: Claude Code trovato, non collegato', C.stato(casa).find(a => a.id === 'claude')?.installato === true && !C.stato(casa).find(a => a.id === 'claude').collegato);
  const p = C.anteprima('claude', { casa, url });
  C.scrivi(p);
  const dopo = JSON.parse(readFileSync(join(casa, '.claude', 'settings.json'), 'utf8'));
  prova('collegamenti: il resto resta com\'era', dopo.model === 'opus' && dopo.permissions.allow[0] === 'Bash(make:*)' && dopo.hooks.PostToolUse.some(x => x.hooks[0].command === 'echo loro'));
  prova('collegamenti: gli hook di Lode', ['UserPromptSubmit', 'PostToolUse', 'Stop', 'Notification'].every(k => dopo.hooks[k].some(x => C.SEGNO.test(JSON.stringify(x)))) && dopo.hooks.Stop[0].hooks[0].command.includes('/claude/fine'));
  prova('collegamenti: copia di sicurezza', existsSync(join(casa, '.claude', 'settings.json.prima-di-lode')));
  C.scrivi(C.anteprima('claude', { casa, url: url.replace('47123', '47999') }));
  const due = JSON.parse(readFileSync(join(casa, '.claude', 'settings.json'), 'utf8'));
  prova('collegamenti: ricollegare non raddoppia (porta nuova)', due.hooks.Stop.length === 1 && due.hooks.Stop[0].hooks[0].command.includes('47999') && due.hooks.PostToolUse.length === 2);
  C.scrivi(C.anteprima('claude', { casa, togli: true }));
  const via = JSON.parse(readFileSync(join(casa, '.claude', 'settings.json'), 'utf8'));
  prova('collegamenti: scollegare toglie solo le righe di Lode', JSON.stringify(via) === JSON.stringify(loro), JSON.stringify(via));
  writeFileSync(join(casa, '.claude', 'settings.json'), '{ "rotto": ');
  prova('collegamenti: JSON rotto → non si tocca', /non si legge/.test(C.anteprima('claude', { casa, url }).errore || ''));
  prova('collegamenti: la differenza per la finestra', /\+ .*lode/.test(C.differenza('{}', p.dopo)));
}

// tutti i collegamenti: collegare due volte non raddoppia, scollegare riporta il file com'era
{
  const C = await import('../desktop/agenti-collegamenti.mjs');
  const { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const url = 'http://127.0.0.1:47123/lode/' + 'd'.repeat(32);
  for (const a of C.AGENTI) {
    const casa = mkdtempSync(join(tmpdir(), 'lode-' + a.id + '-')), f = a.file(casa);
    mkdirSync(a.dove(casa), { recursive: true });
    const loro = a.id === 'aider' ? 'model: sonnet\nauto-commits: false\n' : a.proprio ? null : JSON.stringify({ suoi: true, hooks: a.id === 'cursor' || a.id === 'windsurf' ? { [a.id === 'cursor' ? 'afterFileEdit' : 'post_write_code']: [{ command: 'echo loro' }] } : { Stop: [{ hooks: [{ type: 'command', command: 'echo loro' }] }] } }, null, 2) + '\n';
    if (loro != null) { mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, loro); }
    C.scrivi(C.anteprima(a.id, { casa, url }));
    const uno = readFileSync(f, 'utf8');
    C.scrivi(C.anteprima(a.id, { casa, url }));
    const due = readFileSync(f, 'utf8');
    const percorsi = [...uno.matchAll(/\/lode\/d{32}\/([a-z]+)/g)].map(m => m[1]);
    prova(`${a.nome}: collegato, con il suo nome nel percorso`, C.stato(casa).find(x => x.id === a.id).collegato && percorsi.length >= 1 && percorsi.every(x => x === a.id), uno.slice(0, 300));
    prova(`${a.nome}: collegare due volte non raddoppia`, uno === due);
    prova(`${a.nome}: le voci degli altri restano`, loro == null || uno.includes('echo loro') || uno.includes('auto-commits: false'));
    if (!a.proprio && a.id !== 'aider') prova(`${a.nome}: JSON valido`, (() => { try { JSON.parse(uno); return true; } catch { return false; } })());
    C.scrivi(C.anteprima(a.id, { casa, togli: true }));
    const via = existsSync(f) ? readFileSync(f, 'utf8') : null;
    prova(`${a.nome}: scollegare riporta com'era`, loro == null ? via === null : a.id === 'aider' ? via.trim() === loro.trim() : JSON.stringify({ ...JSON.parse(via), ...(a.id === 'cursor' ? { version: undefined } : {}) }) === JSON.stringify(JSON.parse(loro)), String(via).slice(0, 300));
    if (a.id === 'opencode') {   // il plugin è JavaScript valido
      C.scrivi(C.anteprima(a.id, { casa, url })); const g = f.replace(/\.js$/, '.mjs'); writeFileSync(g, readFileSync(f, 'utf8'));
      let valido = true; try { execFileSync(process.execPath, ['--check', g]); } catch { valido = false; }
      prova('OpenCode: il plugin si legge', valido);
    }
  }
  // Aider con le sue notifiche: non si sovrascrivono
  const casa = mkdtempSync(join(tmpdir(), 'lode-aider2-')); mkdirSync(join(casa, '.aider'));
  writeFileSync(join(casa, '.aider.conf.yml'), 'notifications: true\nnotifications_command: say fatto\n');
  prova('Aider: le notifiche che ci sono già restano', /già le notifiche/.test(C.anteprima('aider', { casa, url }).errore || ''));
  // Copilot: un file con lo stesso nome che non è di Lode non si tocca
  const casa2 = mkdtempSync(join(tmpdir(), 'lode-copilot-')); mkdirSync(join(casa2, '.copilot', 'hooks'), { recursive: true }); writeFileSync(join(casa2, '.copilot', 'hooks', 'lode.json'), '{"suo":1}');
  prova('Copilot: un lode.json non nostro non si tocca', /non è di Lode/.test(C.anteprima('copilot', { casa: casa2, url }).errore || ''));
}
// le forme dei dati degli altri agenti
{
  const ws = A.normalizza('windsurf', 'modifica', { trajectory_id: 'w1', tool_info: { file_path: join(R, 'a.c'), cwd: R } });
  prova('Windsurf: post_write_code', ws.tipo === 'modifica' && ws.file[0] === join(R, 'a.c') && ws.cwd === R && ws.sessione === 'w1');
  const wc = A.normalizza('windsurf', 'shell', { trajectory_id: 'w1', tool_info: { command_line: 'make test', cwd: R } });
  prova('Windsurf: post_run_command', wc.tipo === 'comando' && wc.comando === 'make test');
  prova('Windsurf: post_cascade_response', A.normalizza('windsurf', 'fine', { trajectory_id: 'w1', tool_info: { response: 'All tests pass' } }).messaggio === 'All tests pass');
  const cp = A.normalizza('copilot', 'strumento', { sessionId: 'k', cwd: R, toolName: 'bash', toolArgs: '{"command":"npm test"}' });
  prova('Copilot: toolArgs come testo JSON', cp.tipo === 'comando' && cp.comando === 'npm test' && cp.sessione === 'k');
  prova('Gemini: AfterAgent', A.normalizza('gemini', 'fine', { session_id: 'g', cwd: R, prompt_response: 'Fatto, i test passano' }).messaggio === 'Fatto, i test passano');
  prova('Cursor: afterAgentResponse', A.normalizza('cursor', 'fine', { conversation_id: 'c', text: 'ok' }).messaggio === 'ok');
  prova('Aider: solo la fine', A.normalizza('aider', 'fine', { message: 'aider' }).tipo === 'fine');
}
await S.chiudi();
console.log(`agenti: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
