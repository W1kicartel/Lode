// Il node:fs sincrono che vede la copia del v1: inoltra al disco finto del computer che sta lavorando adesso (usa()). Il v1 è
// tutto sincrono, quindi una chiamata del motore non si intreccia con un'altra: basta dire «adesso è il computer B» prima di
// ogni chiamata (motore.mjs, C()).
let fs = null, orologio = () => Date.now(), n = 0;
export function usa(fsSincrono, oro) { fs = fsSincrono; orologio = oro; }
const f = nome => (...a) => fs[nome](...a);
export const existsSync = f('existsSync'), mkdirSync = f('mkdirSync'), readFileSync = f('readFileSync'), readdirSync = f('readdirSync'),
  renameSync = f('renameSync'), rmSync = f('rmSync'), rmdirSync = f('rmdirSync'), statSync = f('statSync'), copyFileSync = f('copyFileSync'),
  cpSync = f('cpSync'), writeFileSync = f('writeFileSync');
// percorsi relativi, niente collegamenti: il percorso vero è lui
export const realpathSync = Object.assign(p => p, { native: p => p });
export const adesso = () => orologio();
// niente timer: l'adattatore riprova a scrivere a ogni modifica e a ogni arrivati()
export const rimanda = () => null;
// desktop/vault.mjs, scriviSicuro: cartella, temporaneo, rename; il temporaneo che resta si toglie
export function scriviSicuro(p, testo) {
  const i = p.lastIndexOf('/'); if (i > 0) mkdirSync(p.slice(0, i), { recursive: true });
  const t = `${p}.tmp-${++n}`;
  try { writeFileSync(t, testo); renameSync(t, p); }
  finally { try { rmSync(t, { force: true }); } catch (x) { if (x?.crash) throw x; } }
}
