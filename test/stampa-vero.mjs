// «Cosa stampa?» in Java e in Python contro gli strumenti veri: node test/stampa-vero.mjs [semi] [python|java] [id-modello …]
// Per ogni modello che si scrive in quella lingua e per ogni seme (20 se non dici altro; anche LODE_SEMI) scrive il programma
// con stampaJava / stampaPython, lo esegue con python3 o con javac + java e controlla che lo stdout sia esattamente quello di
// esegui(…, { lingua }). Il C lo prova test/verifica-c.mjs. Una sola differenza e l'uscita è 1.
// Una lingua senza strumenti si salta con un messaggio (con LODE_PYTHON_OBBLIGATORIO=1 o LODE_JAVA_OBBLIGATORIO=1 invece fallisce).
import { spawnSync, execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';
import { MODELLI, istanza, modelliPer } from '../js/codice/modelli.js';
import { esegui } from '../js/codice/albero.js';

const WIN = process.platform === 'win32';
const argomenti = process.argv.slice(2);
const SEMI = Number(argomenti.find(a => /^\d+$/.test(a)) || process.env.LODE_SEMI || 20);
const LINGUE = argomenti.filter(a => a === 'python' || a === 'java');
const SOLO = argomenti.filter(a => !/^\d+$/.test(a) && a !== 'python' && a !== 'java');
if (SOLO.some(id => !MODELLI.some(m => m.id === id))) { console.log('Modelli sconosciuti:', SOLO.filter(id => !MODELLI.some(m => m.id === id)).join(', ')); process.exit(1); }

const prova = (cmd, args, re) => { const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 20000, windowsHide: true }); const t = `${r.stdout || ''}${r.stderr || ''}`; return r.status === 0 && re.test(t) ? t.split('\n')[0].trim() : null; };
function trovaPython() {
  for (const c of [process.env.PYTHON, 'python3', 'python', ...(WIN ? ['py'] : [])].filter(Boolean)) { const v = prova(c, ['--version'], /^Python 3\./); if (v) return { cmd: c, versione: v }; }
  return null;
}
function trovaJava() {
  const c = prova('javac', ['-version'], /javac/), j = prova('java', ['-version'], /version/);
  return c && j ? { versione: `${c}, ${j}` } : null;
}

const lancia = (cmd, args, opz) => new Promise(res => execFile(cmd, args, { windowsHide: true, maxBuffer: 1 << 22, ...opz }, (errore, stdout, stderr) => res({ errore, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })));
async function inParallelo(lavori, n) {
  const out = new Array(lavori.length); let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, lavori.length) }, async () => { while (k < lavori.length) { const j = k++; out[j] = await lavori[j](); } }));
  return out;
}
const PARALLELI = Math.max(2, Math.min(16, cpus().length));

// i programmi di una lingua: uno per sorgente diverso
function casiDi(lingua, problemi) {
  const modelli = modelliPer(lingua).filter(m => !SOLO.length || SOLO.includes(m.id)), casi = [], visti = new Set();
  for (const m of modelli) for (let seme = 1; seme <= SEMI; seme++) {
    const ist = istanza(m, seme, { lingua });
    if (!ist) { problemi.push({ m: m.id, seme, cosa: 'il modello non genera un programma valido' }); continue; }
    if (esegui(ist.programma, { lingua }).uscita !== ist.giusta) problemi.push({ m: m.id, seme, cosa: 'esegui() non è deterministico' });
    if (visti.has(ist.sorgente)) continue;
    visti.add(ist.sorgente);
    casi.push({ m: m.id, seme, sorgente: ist.sorgente, atteso: ist.giusta });
  }
  return { modelli, casi };
}
// su Windows lo stdout in modo testo scrive \r\n (print, println)
const uguale = (avuto, c) => (avuto.replace(/\r\n/g, '\n') === c.atteso ? null : { ...c, cosa: 'uscita diversa', avuto });

async function python(py, casi, dir) {
  return inParallelo(casi.map((c, k) => async () => {
    const file = join(dir, `p${k}.py`); writeFileSync(file, c.sorgente);
    const run = await lancia(py.cmd, [file], { timeout: 20000 });
    if (run.errore) return { ...c, cosa: `si ferma con un errore (${run.errore.code ?? run.errore.signal})`, dett: run.stderr.trim() };
    return uguale(run.stdout, c);
  }), PARALLELI);
}
// tutti i file in un solo javac (la JVM che parte una volta sola): ognuno con la sua classe pubblica, P0, P1, …
async function java(casi, dir) {
  const file = casi.map((c, k) => { const f = join(dir, `P${k}.java`); writeFileSync(f, c.sorgente.replace(/^public class Main \{$/m, `public class P${k} {`)); return f; });
  writeFileSync(join(dir, 'file.txt'), file.map(f => `"${f.replace(/\\/g, '/')}"`).join('\n'));
  const comp = await lancia('javac', ['-encoding', 'UTF-8', '-Xlint:all,-fallthrough', '-Werror', '-d', join(dir, 'classi'), `@${join(dir, 'file.txt')}`], { timeout: 600000 });
  if (comp.errore) return casi.map(c => ({ ...c, cosa: 'non compila', dett: (comp.stderr || comp.errore.message).trim().slice(0, 4000) })).slice(0, 1);
  return inParallelo(casi.map((c, k) => async () => {
    const run = await lancia('java', ['-cp', join(dir, 'classi'), `P${k}`], { timeout: 30000 });
    if (run.errore) return { ...c, cosa: `si ferma con un errore (${run.errore.code ?? run.errore.signal})`, dett: run.stderr.trim() };
    return uguale(run.stdout, c);
  }), PARALLELI);
}

let ko = 0, saltate = 0;
for (const lingua of LINGUE.length ? LINGUE : ['python', 'java']) {
  const nome = lingua === 'python' ? 'Python' : 'Java';
  const strumento = lingua === 'python' ? trovaPython() : trovaJava();
  const obbligo = process.env[lingua === 'python' ? 'LODE_PYTHON_OBBLIGATORIO' : 'LODE_JAVA_OBBLIGATORIO'] === '1';
  if (!strumento) {
    console.log(`${nome}: ${lingua === 'python' ? 'python3' : 'javac e java'} non trovato, prova saltata.${obbligo ? ' Ma qui è obbligatoria.' : ''}`);
    if (obbligo) ko++; else saltate++;
    continue;
  }
  console.log(`\n${nome}: ${strumento.cmd ? strumento.cmd + ' ' : ''}(${strumento.versione})`);
  const problemi = [], { modelli, casi } = casiDi(lingua, problemi), dir = mkdtempSync(join(tmpdir(), `lode-${lingua}-`)), t0 = Date.now();
  const esiti = lingua === 'python' ? await python(strumento, casi, dir) : await java(casi, dir);
  try { rmSync(dir, { recursive: true, force: true }); } catch { }
  for (const e of esiti) if (e) problemi.push(e);
  const perModello = new Map(modelli.map(m => [m.id, { casi: 0, ko: 0 }]));
  for (const c of casi) perModello.get(c.m).casi++;
  for (const p of problemi) perModello.get(p.m).ko++;
  for (const [id, x] of perModello) console.log(`${x.ko ? '✗' : '✓'} ${id.padEnd(20)} ${x.casi} programmi${x.ko ? ` · ${x.ko} problemi` : ''}`);
  for (const p of problemi.slice(0, 10)) {
    console.log(`\n✗ ${p.m}, seme ${p.seme}: ${p.cosa}`);
    if (p.sorgente) console.log(p.sorgente);
    if (p.dett) console.log(p.dett);
    if (p.avuto != null) console.log(`atteso: ${JSON.stringify(p.atteso)}\navuto:  ${JSON.stringify(p.avuto)}`);
  }
  console.log(`${nome}: ${casi.length} programmi eseguiti in ${((Date.now() - t0) / 1000).toFixed(1)} s (${modelli.length} modelli × ${SEMI} semi): ${problemi.length ? problemi.length + ' problemi' : 'tutti uguali a esegui()'}`);
  ko += problemi.length;
}
if (saltate) console.log(`\n${saltate} lingue saltate per mancanza degli strumenti.`);
process.exit(ko ? 1 : 0);
