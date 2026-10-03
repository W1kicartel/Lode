// Copia il motore della prima versione (ramo git sincronizzazione-v1: desktop/sincronizza.mjs e desktop/unione.mjs) qui, solo
// per la prova nel simulatore, cambiando il minimo: node:fs → fs-v1.mjs (il disco finto del computer che sta lavorando),
// scriviSicuro di desktop/vault.mjs → la stessa idea (temporaneo + rename) sul disco finto, Date.now() → l'orologio di quel
// computer, setTimeout → niente (il mondo non ha tempo vero: l'adattatore riscrive a ogni modifica e a ogni arrivati()).
// Il resto è il codice del v1 così com'era. Rifallo con: node test/sync-sim/v1/prepara.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = dirname(fileURLToPath(import.meta.url)), radice = join(qui, '..', '..', '..');
const git = f => execFileSync('git', ['-C', radice, 'show', `sincronizzazione-v1:${f}`], { encoding: 'utf8' });
const cambia = (testo, da, a, nome) => { if (!testo.includes(da)) throw new Error(`${nome}: non trovo «${da}»`); return testo.split(da).join(a); };
const TESTA = f => `// COPIA ADATTATA per test/sync-sim (vedi prepara.mjs) di ${f} dal ramo sincronizzazione-v1. Non modificare a mano.\n`;

let s = git('desktop/sincronizza.mjs');
s = cambia(s, "import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, copyFileSync, cpSync } from 'node:fs';",
  "import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, copyFileSync, cpSync, scriviSicuro, adesso, rimanda } from './fs-v1.mjs';", 'sincronizza');
s = cambia(s, "import { scriviSicuro } from './vault.mjs';\n", '', 'sincronizza');
s = cambia(s, 'Date.now()', 'adesso()', 'sincronizza');
s = cambia(s, 'setTimeout(', 'rimanda(', 'sincronizza');
writeFileSync(join(qui, 'sincronizza.mjs'), TESTA('desktop/sincronizza.mjs') + s);

let u = git('desktop/unione.mjs');
u = cambia(u, "import { createHash } from 'node:crypto';", "import { createHash } from 'node:crypto';\nimport { adesso } from './fs-v1.mjs';", 'unione');
u = cambia(u, 'Date.now()', 'adesso()', 'unione');
writeFileSync(join(qui, 'unione.mjs'), TESTA('desktop/unione.mjs') + u);
console.log('copiati e adattati: sincronizza.mjs, unione.mjs');
