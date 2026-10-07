// I rami delle lingue messi insieme: node test/unione-lingue.mjs
// 1) i dati di esempio di ogni lingua, caricati come fa il benvenuto (sostituisci), tengono tutti i voti e li contano nel
//    sistema del paese (ramo esempio + ramo voti: prima dell'unione inForma lasciava solo gli interi 18-30);
// 2) in italiano il profilo caricato ha il sistema 'it' e la media di sempre; togliEsempio lascia il sistema di VUOTO;
// 3) ogni area di js/lingue/indice.js ha il suo file in tutte e sei le lingue, e ogni catalogo e ogni modulo nuovo
//    (libretto.js, nomi.js, parole.js) è nella cache di sw.js, con un solo CACHE.
import { readFileSync, readdirSync } from 'node:fs';
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const Dati = await import('../js/dati.js');
const S = await import('../js/sistemi.js');
const { AREE } = await import('../js/lingue/indice.js');

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const SISTEMA = { it: 'it', en: 'uk', es: 'es', fr: 'fr', de: 'de', pt: 'br' };
const LINGUE = Object.keys(SISTEMA);
const vicino = (a, b) => Math.abs(a - b) < 1e-9;

/* ---------- 1-2. i dati di esempio caricati ---------- */
for (const cod of LINGUE) {
  const e = Dati.esempio(cod);
  Dati.sostituisci(structuredClone(e));
  const D = Dati.D, sis = SISTEMA[cod];
  prova(`${cod}: il sistema dei voti caricato è ${sis}`, Dati.sistemaVoti() === sis && D.profilo.sistema === sis, D.profilo.sistema);
  prova(`${cod}: nessun voto perso al caricamento`, JSON.stringify(D.esami.map(x => x.voto)) === JSON.stringify(e.esami.map(x => x.voto)), D.esami.map(x => x.voto).join(' '));
  const conVoto = e.esami.filter(x => x.voto != null && !x.idoneita);
  prova(`${cod}: ci sono esami con il voto`, conVoto.length >= 3);
  prova(`${cod}: ogni voto è valido e sufficiente nel sistema`, conVoto.every(x => S.valido(Number(x.voto), sis) && S.superato(Number(x.voto), sis)));
  const m = Dati.media(), cfu = conVoto.reduce((s, x) => s + x.cfu, 0), pond = conVoto.reduce((s, x) => s + x.voto * x.cfu, 0) / cfu;
  prova(`${cod}: media ponderata nel sistema`, m.n === conVoto.length && vicino(m.ponderata, pond), JSON.stringify(m));
  prova(`${cod}: la base di laurea solo in Italia`, cod === 'it' ? m.base > 0 : m.base == null, m.base);
  prova(`${cod}: crediti fatti contati`, Dati.cfuFatti() > 0);
  const d = structuredClone(e);
  Dati.togliEsempio(d);
  prova(`${cod}: togliEsempio lascia il sistema (in italiano quello di VUOTO)`, d.profilo.sistema === (e.profilo.sistema ?? Dati.VUOTO().profilo.sistema));
}
prova('it: l\'esempio italiano non scrive il sistema (identico a prima)', !('sistema' in Dati.esempio('it').profilo));

/* ---------- 3. cataloghi e cache ---------- */
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const FILE = new Set([...sw.match(/const FILE = \[(.*?)\];/s)[1].matchAll(/'([^']*)'/g)].map(m => m[1]));
prova('sw.js: un solo CACHE', (sw.match(/const CACHE = /g) || []).length === 1);
prova('sw.js: FILE senza doppioni', FILE.size === [...sw.match(/const FILE = \[(.*?)\];/s)[1].matchAll(/'([^']*)'/g)].length);
prova('indice.js: AREE senza doppioni', new Set(AREE).size === AREE.length);
for (const a of ['impostazioni', 'libretto', 'vaultnomi', 'contenuti', 'esempio']) prova(`indice.js: c'è l'area ${a}`, AREE.includes(a));
for (const cod of LINGUE) {
  const sul = new Set(readdirSync(new URL(`../js/lingue/${cod}/`, import.meta.url)).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)));
  for (const a of AREE) {
    prova(`${cod}/${a}.js esiste`, sul.has(a));
    prova(`sw.js: js/lingue/${cod}/${a}.js nella cache`, FILE.has(`js/lingue/${cod}/${a}.js`));
  }
}
for (const f of ['js/libretto.js', 'js/nomi.js', 'js/parole.js', 'js/sistemi.js', 'js/lingua.js', 'js/comandi/es.js', 'js/comandi/fr.js', 'js/comandi/de.js']) prova(`sw.js: ${f} nella cache`, FILE.has(f));
for (const f of FILE) if (f.startsWith('js/')) prova(`sw.js: ${f} esiste`, (() => { try { readFileSync(new URL('../' + f, import.meta.url)); return true; } catch { return false; } })());

console.log(`unione-lingue: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
