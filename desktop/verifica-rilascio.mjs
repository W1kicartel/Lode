// Prima di pubblicare una Release: i latest*.yml che electron-updater leggerà citano file che ci sono davvero, con lo
// stesso nome, peso e sha512 (se un installer venisse firmato o cambiato dopo, gli aggiornamenti fallirebbero sui
// computer degli studenti). Lo usa .github/workflows/rilascio.yml dopo electron-builder e di nuovo prima di caricare.
// Uso: node verifica-rilascio.mjs <cartella> [versione attesa, es. 0.4.0] [--tutti: servono latest, latest-mac e latest-linux]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { problemiYml } from './aggiorna.mjs';

const [cartella, versione] = process.argv.slice(2).filter(x => !x.startsWith('--'));
const tutti = process.argv.includes('--tutti');
if (!cartella) { console.error('Uso: node verifica-rilascio.mjs <cartella> [versione] [--tutti]'); process.exit(2); }
const nomi = readdirSync(cartella);
const yml = nomi.filter(n => /^latest(-\w+)?\.yml$/.test(n));
const info = nome => {
  if (!nomi.includes(nome)) return null;
  const f = join(cartella, nome);
  return { size: statSync(f).size, sha512: createHash('sha512').update(readFileSync(f)).digest('base64') };
};
const problemi = [];
if (!yml.length) problemi.push(`nessun latest*.yml in ${cartella}: manca «publish» in desktop/package.json?`);
if (tutti) for (const n of ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']) if (!yml.includes(n)) problemi.push(`manca ${n}`);
for (const n of yml) {
  const p = problemiYml(n, readFileSync(join(cartella, n), 'utf8'), info, versione);
  problemi.push(...p);
  if (!p.length) console.log(`✓ ${n}: tutti i file ci sono e combaciano`);
}
for (const p of problemi) console.error(process.env.GITHUB_ACTIONS ? `::error::${p}` : `✗ ${p}`);
process.exit(problemi.length ? 1 : 0);
