// «Cosa stampa?» contro un compilatore vero: node test/verifica-c.mjs [semi] [id-modello …]
// Per ogni modello e per ogni seme (20 se non dici altro; anche LODE_SEMI) scrive il programma C con stampaC,
// lo compila col compilatore del sistema (cc, gcc o clang; su Windows anche gcc di MinGW/MSYS2), lo esegue
// e controlla che lo stdout sia esattamente quello di esegui(). Una sola differenza e l'uscita è 1.
// Senza compilatore salta con un messaggio (con LODE_CC_OBBLIGATORIO=1 invece fallisce).
import { spawnSync, execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join, dirname, isAbsolute } from 'node:path';
import { MODELLI, istanza } from '../js/codice/modelli.js';
import { esegui } from '../js/codice/albero.js';
import { cartelleMinGW, ambiente } from '../desktop/esegui.mjs';

const WIN = process.platform === 'win32';
const argomenti = process.argv.slice(2);
const SEMI = Number(argomenti.find(a => /^\d+$/.test(a)) || process.env.LODE_SEMI || 20);
const SOLO = argomenti.filter(a => !/^\d+$/.test(a));

// su Windows il compilatore c'è spesso ma fuori dal PATH: le stesse cartelle che guarda Lode (cartelleMinGW di esegui.mjs).
// Un gcc preso da una di quelle cartelle carica le sue DLL (cc1.exe: libgmp, zlib…) da lì: la cartella va in testa al Path,
// sia per compilare sia per lanciare il programma (ambiente() di esegui.mjs)
function trovaCompilatore() {
  const nomi = [process.env.CC, ...(WIN ? ['gcc', 'cc', 'clang'] : ['cc', 'gcc', 'clang']), ...(WIN ? cartelleMinGW().map(d => join(d, 'gcc.exe')) : [])].filter(Boolean);
  for (const c of nomi) {
    const cartelle = WIN && isAbsolute(c) ? [dirname(c)] : [];
    const r = spawnSync(c, ['--version'], { encoding: 'utf8', timeout: 15000, windowsHide: true, env: ambiente(cartelle) });
    const testo = `${r.stdout || ''}${r.stderr || ''}`;
    if (r.status === 0 && /gcc|clang|llvm|free software/i.test(testo)) return { cmd: c, versione: testo.split('\n')[0].trim(), mingw: WIN || /mingw/i.test(testo), cartelle };
  }
  return null;
}

const cc = trovaCompilatore();
if (!cc) {
  console.log('Nessun compilatore C trovato (cc, gcc, clang' + (WIN ? ', né MinGW/MSYS2 nelle cartelle solite' : '') + '): verifica contro il compilatore saltata.');
  process.exit(process.env.LODE_CC_OBBLIGATORIO === '1' ? 1 : 0);
}
// -Werror tiene fuori ogni avviso vero (variabili inutili, formati sbagliati). Tre avvisi restano spenti di proposito:
// l'else pendente, il rientro che inganna e il case senza break sono proprio le trappole degli esercizi.
const OPZIONI = ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O1', '-Wno-dangling-else', '-Wno-misleading-indentation', '-Wno-implicit-fallthrough', ...(cc.mingw ? ['-D__USE_MINGW_ANSI_STDIO=1'] : [])];
console.log(`Compilatore: ${cc.cmd} (${cc.versione})`);
console.log(`Opzioni: ${OPZIONI.join(' ')}`);

const ENV = ambiente(cc.cartelle);
const lancia = (cmd, args, opz) => new Promise(res => execFile(cmd, args, { windowsHide: true, maxBuffer: 1 << 20, env: ENV, ...opz }, (errore, stdout, stderr) => res({ errore, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })));
// al massimo N lavori insieme
async function inParallelo(lavori, n) {
  const out = new Array(lavori.length); let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, lavori.length) }, async () => { while (k < lavori.length) { const j = k++; out[j] = await lavori[j](); } }));
  return out;
}

const dir = mkdtempSync(join(tmpdir(), 'lode-c-'));
const modelli = SOLO.length ? MODELLI.filter(m => SOLO.includes(m.id)) : MODELLI;
if (SOLO.length && modelli.length !== SOLO.length) { console.log('Modelli sconosciuti:', SOLO.filter(id => !MODELLI.some(m => m.id === id)).join(', ')); process.exit(1); }

const casi = [], problemi = [], visti = new Map();
for (const m of modelli) for (let seme = 1; seme <= SEMI; seme++) {
  const ist = istanza(m, seme);
  if (!ist) { problemi.push({ m: m.id, seme, cosa: 'il modello non genera un programma valido' }); continue; }
  const atteso = esegui(ist.programma).uscita;
  if (atteso !== ist.giusta) problemi.push({ m: m.id, seme, cosa: 'esegui() non è deterministico' });
  if (visti.has(ist.sorgente)) continue;              // stesso programma: basta compilarlo una volta
  visti.set(ist.sorgente, true);
  casi.push({ m: m.id, seme, sorgente: ist.sorgente, atteso });
}

const t0 = Date.now();
const esiti = await inParallelo(casi.map((c, k) => async () => {
  const file = join(dir, `p${k}.c`), exe = join(dir, `p${k}${WIN ? '.exe' : ''}`);
  writeFileSync(file, c.sorgente);
  const comp = await lancia(cc.cmd, [...OPZIONI, file, '-o', exe], { timeout: 120000 });
  if (comp.errore) return { ...c, cosa: 'non compila', dett: (comp.stderr || comp.errore.message).trim() };
  const run = await lancia(exe, [], { timeout: 10000 });
  if (run.errore) return { ...c, cosa: `si ferma con un errore (${run.errore.code ?? run.errore.signal})`, dett: run.stderr.trim() };
  const avuto = WIN ? run.stdout.replace(/\r\n/g, '\n') : run.stdout;   // su Windows lo stdout in modo testo scrive \r\n
  return avuto === c.atteso ? null : { ...c, cosa: 'uscita diversa', avuto };
}), Math.max(2, Math.min(16, cpus().length)));
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
console.log(`\n${casi.length} programmi compilati ed eseguiti in ${((Date.now() - t0) / 1000).toFixed(1)} s (${modelli.length} modelli × ${SEMI} semi): ${problemi.length ? problemi.length + ' problemi' : 'tutti uguali a esegui()'}`);
process.exit(problemi.length ? 1 : 0);
