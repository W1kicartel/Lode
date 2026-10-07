// Le lingue di Lode: node test/lingue.mjs
// 1) ogni catalogo di ogni lingua ha le STESSE chiavi dell'italiano, con gli stessi parametri {x}, gli stessi tag HTML,
//    elenchi della stessa lunghezza e plurali con «other»; 2) ogni t('…') / elenco('…') scritto nel codice ha la sua
//    chiave in italiano; 3) ogni file dei cataloghi è nella cache del service worker (sw.js, FILE); 4) ogni chiave
//    italiana è usata da qualche file (le chiavi composte con una variabile stanno in COMPOSTE); 5) ogni lingua usa le
//    sue virgolette.
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
// 5) le virgolette di ogni lingua, in tutti i testi (fuori da `…`, dove stanno i caratteri di cui si parla):
//    «» in italiano, spagnolo e portoghese; « » in francese, con lo spazio fine (U+202F) dentro; „“ in tedesco; “” in inglese
const VIRGOLETTE = {
  it: { no: /[“”„]/ }, es: { no: /[“”„]/ }, pt: { no: /[“”„]/ },
  fr: { no: /[“”„]|«(?!\u202f)|(?<!\u202f)»/ }, de: { no: /[«»”]/ }, en: { no: /[«»„]/ },
};
const testi = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(testi) : v && typeof v === 'object' ? Object.values(v).flatMap(testi) : [];
for (const cod of Object.keys(LINGUE)) {
  const cat = {}; for (const a of AREE) Object.assign(cat, await carica(cod, a) || {});
  // e le virgolette dritte ("…") solo dove le ha anche l'italiano (nei programmi e nelle stringhe del codice)
  const fuori = s => s.split('`').filter((x, i) => i % 2 === 0).join(' '), dritte = v => testi(v).some(s => /"[^"]{2,}"/.test(fuori(s)));
  const storte = Object.entries(cat).filter(([k, v]) => testi(v).some(s => VIRGOLETTE[cod].no.test(fuori(s))) || (dritte(v) && !dritte(IT[k]))).map(([k]) => k);
  prova(`${cod}: le virgolette della lingua`, storte.length === 0, `${storte.length}: ${storte.slice(0, 8).join(', ')}`);
}
// 4) nessuna chiave dimenticata: ogni chiave del catalogo italiano compare nel codice fra virgolette ('area.chiave'),
//    oppure è costruita da un prefisso che sta in COMPOSTE (chiavi fatte con una variabile). Una chiave che non usa più
//    nessuno si toglie da tutte e sei le lingue; una chiave nuova composta con una variabile si aggiunge qui
const COMPOSTE = {
  'sistemi.nome.': 'js/sistemi.js, nomeSistema',
  'sistemi.crediti.': 'js/sistemi.js, nomeCrediti',
  'sistemi.finale.': 'js/sistemi.js, etichettaFinale',
  'sistemi.mention.': 'js/sistemi.js e js/libretto.js, la mention francese',
  'sistemi.classe.': 'js/sistemi.js e js/libretto.js, la classe inglese',
  'desktop.progetto-esito-': 'desktop/progetto.mjs, K + tipo',
  'vaultnomi.': "js/nomi.js, v('cartella-lezioni')…: il resto della chiave fra virgolette in nomi.js",
};
const codice = [...file('js/'), ...file('desktop/').filter(f => !f.includes('node_modules') && !f.startsWith('desktop/web/'))]
  .map(f => readFileSync(new URL(f, R), 'utf8').replace(/^\s*(\/\/|\/\*|\*).*$/gm, '')).join('\n') + readFileSync(new URL('index.html', R), 'utf8');   // senza le righe di commento
const nomi = readFileSync(new URL('js/nomi.js', R), 'utf8');
for (const p of Object.keys(COMPOSTE)) prova(`chiavi composte: il prefisso ${p} si usa ancora`, codice.includes(`'${p}'`) || codice.includes('`' + p + '${') || codice.includes(`'${p}' +`), COMPOSTE[p]);
const inutili = Object.keys(IT).filter(k => {
  if ([`'${k}'`, `"${k}"`, '`' + k + '`'].some(x => codice.includes(x))) return false;
  const p = Object.keys(COMPOSTE).find(p => k.startsWith(p));
  if (p === 'vaultnomi.') return !nomi.includes(`'${k.slice(p.length)}'`);
  return !p;
});
prova('ogni chiave del catalogo è usata nel codice', inutili.length === 0, `nessuno usa ${inutili.length}: ${inutili.slice(0, 12).join(', ')}`);
// cache del service worker
const sw = readFileSync(new URL('sw.js', R), 'utf8');
for (const cod of Object.keys(LINGUE)) for (const a of AREE) if (existsSync(new URL(`js/lingue/${cod}/${a}.js`, R))) prova(`sw.js ha js/lingue/${cod}/${a}.js`, sw.includes(`'js/lingue/${cod}/${a}.js'`));
prova('sw.js ha lingua.js e indice.js', sw.includes("'js/lingua.js'") && sw.includes("'js/lingue/indice.js'"));
console.log(`lingue: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
