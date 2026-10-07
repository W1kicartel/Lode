// Le lingue di Lode: node test/lingue.mjs
// 1) ogni catalogo di ogni lingua ha le STESSE chiavi dell'italiano, con gli stessi parametri {x}, gli stessi tag HTML,
//    elenchi della stessa lunghezza e plurali con «other»; 2) ogni t('…') / elenco('…') scritto nel codice ha la sua
//    chiave in italiano; 3) ogni file dei cataloghi è nella cache del service worker (sw.js, FILE).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { AREE } from '../js/lingue/indice.js';
import { LINGUE } from '../js/lingua.js';

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const R = new URL('../', import.meta.url);
const carica = async (cod, area) => { const f = new URL(`js/lingue/${cod}/${area}.js`, R); return existsSync(f) ? (await import(f)).default : null; };
const parametri = v => [...new Set(JSON.stringify(v).match(/\{\w+\}/g) || [])].sort().join(',');
const tag = v => (JSON.stringify(v).match(/<\/?[a-z]+/g) || []).sort().join(',');
const TAG_OK = /^<\/?(b|i|em|strong|code|br|span|kbd)$/;

const IT = {};
for (const a of AREE) {
  const c = await carica('it', a);
  prova(`it/${a}.js esiste`, !!c); if (!c) continue;
  for (const [k, v] of Object.entries(c)) {
    prova(`it: ${k} nell'area giusta`, k.startsWith(a + '.'), `(file ${a})`);
    prova(`it: ${k} senza tag strani`, (JSON.stringify(v).match(/<\/?[a-z]+/g) || []).every(x => TAG_OK.test(x)));
    IT[k] = v;
  }
}
for (const cod of Object.keys(LINGUE).filter(c => c !== 'it')) {
  let chiavi = 0, mancanti = [];
  for (const a of AREE) {
    const c = await carica(cod, a);
    if (!c) { mancanti.push(`${a}.js (tutto)`); continue; }
    for (const k of Object.keys(IT).filter(k => k.startsWith(a + '.'))) {
      if (!(k in c)) { mancanti.push(k); continue; }
      chiavi++;
      const v = c[k], vi = IT[k];
      prova(`${cod}: ${k} stessi parametri`, parametri(v) === parametri(vi), `${parametri(v)} ≠ ${parametri(vi)}`);
      prova(`${cod}: ${k} stessi tag`, tag(v) === tag(vi), `${tag(v)} ≠ ${tag(vi)}`);
      if (Array.isArray(vi)) prova(`${cod}: ${k} elenco lungo uguale`, Array.isArray(v) && v.length === vi.length);
      else if (typeof vi === 'object') prova(`${cod}: ${k} plurale con other`, v && typeof v === 'object' && 'other' in v);
      else prova(`${cod}: ${k} testo`, typeof v === 'string' && v.trim().length > 0);
    }
    for (const k of Object.keys(c)) prova(`${cod}: ${k} esiste in italiano`, k in IT);
  }
  // una lingua è «completa» quando non manca niente; finché manca qualcosa la barra mostra l'italiano al suo posto
  prova(`${cod}: catalogo completo`, mancanti.length === 0, `mancano ${mancanti.length}: ${mancanti.slice(0, 8).join(', ')}${mancanti.length > 8 ? '…' : ''}`);
  console.log(`${cod}: ${chiavi}/${Object.keys(IT).length} chiavi`);
}
// le chiavi usate nel codice
const file = d => readdirSync(new URL(d, R), { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'lingue' ? [] : file(d + e.name + '/')) : /\.(m?js)$/.test(e.name) ? [d + e.name] : []);
const usate = new Set();
for (const f of [...file('js/'), ...file('desktop/').filter(f => !f.includes('node_modules') && !f.startsWith('desktop/web/'))]) {
  const s = readFileSync(new URL(f, R), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // anche tv('…') (i testi delle note nella lingua del vault, js/vault.js e js/tasca.js) e tIn(cod, '…') / elencoIn(cod, '…')
  for (const m of s.matchAll(/\b(?:t|elenco|tn|tv)\(\s*'([a-z][\w-]*\.[\w.-]+)'|\b(?:tIn|elencoIn)\([^,()]+,\s*'([a-z][\w-]*\.[\w.-]+)'/g)) { const k = m[1] || m[2]; usate.add(k); prova(`${f}: chiave ${k} in italiano`, k in IT); }
}
prova('ci sono chiavi usate', usate.size > 0);
// cache del service worker
const sw = readFileSync(new URL('sw.js', R), 'utf8');
for (const cod of Object.keys(LINGUE)) for (const a of AREE) if (existsSync(new URL(`js/lingue/${cod}/${a}.js`, R))) prova(`sw.js ha js/lingue/${cod}/${a}.js`, sw.includes(`'js/lingue/${cod}/${a}.js'`));
prova('sw.js ha lingua.js e indice.js', sw.includes("'js/lingua.js'") && sw.includes("'js/lingue/indice.js'"));
console.log(`lingue: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
