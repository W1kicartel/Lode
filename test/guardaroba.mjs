// Il guardaroba di Lode (js/guardaroba.js): node test/guardaroba.mjs
// 1) almeno 10 accessori, ognuno con il disegno piccolo (20–40 px) e quello grande (80–200 px), diversi fra loro;
// 2) l'SVG è ben formato (tag chiusi, attributi fra virgolette, niente NaN né undefined);
// 3) niente colori: fill e stroke solo in scala di grigi (#rgb o #rrggbb con r = g = b), none o currentColor;
// 4) il disegno piccolo non ha linee sottili e ha meno pezzi del grande; nappa e pompon oscillano, gli occhiali seguono gli occhi;
// 5) i nomi nelle sei lingue (catalogo «guardaroba»), diversi fra loro;
// 6) D.imp.accessorio: c'è in VUOTO(), si salva, si valida nei backup (facoltativo per quelli vecchi), uno sconosciuto vale nessuno;
// 7) il comando nelle sei lingue: mettere, togliere, aprire; ogni accessorio si può chiamare per nome in ogni lingua;
// 8) i file nuovi nella cache di sw.js (l'anteprima docs/guardaroba.html no), la prova in prove.yml; la festa per un voto.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const R = new URL('../', import.meta.url);
const LINGUE = ['it', 'en', 'es', 'fr', 'de', 'pt'];
const arg = process.argv.indexOf('--lingua'), solo = arg > 0 ? process.argv[arg + 1] : null;

const eventi = [];
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = e => eventi.push(e); globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };

if (solo) {
  // 7) una lingua sola, in questo processo (la lingua si sceglie all'avvio)
  const C = await import('../js/comandi.js'), G = await import('../js/guardaroba.js');
  const RIC = await import(`../js/comandi/${solo}.js`), X = await import(`./comandi/${solo}.mjs`);
  const casi = X.CASI.filter(([, a]) => a.tipo === 'accessorio');
  prova(`${solo}: frasi del guardaroba nel banco`, casi.length >= 6, `(sono ${casi.length})`);
  prova(`${solo}: si mette un accessorio`, casi.some(([, a]) => a.id));
  prova(`${solo}: si toglie`, casi.some(([, a]) => a.id === null));
  prova(`${solo}: si apre il guardaroba`, casi.some(([, a]) => a.apri === true));
  for (const [f, a] of casi) prova(`${solo}: ${JSON.stringify(f)}`, JSON.stringify(C.interpreta(f)) === JSON.stringify(a), JSON.stringify(C.interpreta(f)));
  const nomi = RIC.GUARDAROBA?.nomi || {};
  for (const id of G.IDS) prova(`${solo}: «${id}» ha un nome nel riconoscitore`, Object.values(nomi).includes(id));
  for (const [detto, id] of Object.entries(nomi)) prova(`${solo}: il nome «${detto}» è di un accessorio vero`, G.IDS.includes(id));
  // ogni nome detto si mette davvero con il primo modo di metterlo (NOME al posto del nome, senza articolo)
  const verbo = RIC.GUARDAROBA.metti[0].match(/^\(\?:([^|)]+)/)[1];
  for (const [detto, id] of Object.entries(nomi)) {
    const f = RIC.GUARDAROBA.metti[0].startsWith('(?:') ? `${verbo} ${detto}${solo === 'de' ? ' auf' : ''}` : detto;
    const r = C.interpreta(f);
    prova(`${solo}: «${f}» mette ${id}`, r?.tipo === 'accessorio' && r.id === id, JSON.stringify(r));
  }
  console.log(`${solo}: ${ok} prove passate, ${ko} fallite`);
  process.exit(ko ? 1 : 0);
}

const G = await import('../js/guardaroba.js');
// 1) gli accessori
prova('almeno 10 accessori', G.ACCESSORI.length >= 10, `(sono ${G.ACCESSORI.length})`);
prova('id diversi e semplici', new Set(G.IDS).size === G.IDS.length && G.IDS.every(id => /^[a-z]+$/.test(id)));
const tutto = d => d.dietro + d.davanti + d.occhi;
for (const a of G.ACCESSORI) {
  const p = G.disegno(a.id, 20), p40 = G.disegno(a.id, 40), g = G.disegno(a.id, 120), g200 = G.disegno(a.id, 200);
  prova(`${a.id}: piccolo a 20 e 40 px`, !p.grande && !p40.grande && tutto(p).length > 40 && tutto(p) === tutto(p40));
  prova(`${a.id}: grande a 120 e 200 px`, g.grande && g200.grande && tutto(g).length > 40 && tutto(g) === tutto(g200));
  prova(`${a.id}: piccolo e grande sono due disegni`, tutto(p) !== tutto(g));
  const pezzi = s => (s.match(/<(path|circle|ellipse|rect|polygon)\b/g) || []).length;
  prova(`${a.id}: il piccolo ha meno pezzi del grande`, pezzi(tutto(p)) < pezzi(tutto(g)), `${pezzi(tutto(p))} / ${pezzi(tutto(g))}`);
  // 4) niente linee sottili nel piccolo: a 20 px uno spessore di 1,8 unità è già meno di mezzo pixel
  const sottili = [...tutto(p).matchAll(/stroke-width="([\d.]+)"/g)].map(m => +m[1]).filter(w => w < 1.8);
  prova(`${a.id}: il piccolo senza linee sottili`, !sottili.length, sottili.join(', '));
  for (const [quale, px] of [['piccolo', 20], ['grande', 120]]) {
    const svg = G.personaggio(a.id, px * 1.12);
    // 2) ben formato
    const pila = []; let bene = true;
    for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g)) {
      if (m[1]) { if (pila.pop() !== m[2]) bene = false; } else if (!m[4]) pila.push(m[2]);
    }
    const resto = svg.replace(/<(\/?)([a-zA-Z]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g, '');
    prova(`${a.id} ${quale}: SVG ben formato`, bene && !pila.length && !resto.trim(), resto.slice(0, 80));
    prova(`${a.id} ${quale}: niente NaN né undefined`, !/NaN|undefined|Infinity/.test(svg));
    // 3) solo grigi
    const colori = [...svg.matchAll(/\b(?:fill|stroke)="([^"]*)"/g)].map(m => m[1]);
    const grigio = c => c === 'none' || c === 'currentColor' || /^#([0-9a-f])\1\1$/i.test(c) || /^#([0-9a-f]{2})\1\1$/i.test(c);
    const storti = colori.filter(c => !grigio(c));
    prova(`${a.id} ${quale}: solo bianchi, grigi e nero`, !storti.length, storti.join(', '));
    prova(`${a.id} ${quale}: niente colori nello stile`, !/style=|rgb\(|hsl\(/.test(svg));
  }
}
prova('la nappa del tocco oscilla (appesa)', /class="acc-molla" data-tipo="appesa"/.test(tutto(G.disegno('tocco', 20))) && /data-tipo="appesa"/.test(tutto(G.disegno('tocco', 120))));
for (const id of ['berretto', 'festa']) prova(`il pompon di ${id} oscilla (ritto)`, /data-tipo="ritta"/.test(tutto(G.disegno(id, 20))) && /data-tipo="ritta"/.test(tutto(G.disegno(id, 120))));
prova('gli occhiali seguono gli occhi', /class="acc-occhi"/.test(G.disegno('occhiali', 20).occhi) && /class="acc-occhi"/.test(G.disegno('occhiali', 120).occhi));
prova("l'aureola galleggia", /acc-fluttua/.test(G.disegno('aureola', 20).davanti));
prova('nessuno: niente da disegnare', !tutto(G.disegno(null, 20)) && !tutto(G.disegno('boh', 120)));
prova('valido e inForma', G.valido(null) && G.valido('corona') && !G.valido('boh') && !G.valido(3) && G.inForma('boh') === null && G.inForma('tocco') === 'tocco' && G.inForma({}) === null);

// 5) i nomi nelle sei lingue
for (const cod of LINGUE) {
  const f = new URL(`js/lingue/${cod}/guardaroba.js`, R);
  prova(`${cod}: c'è il catalogo guardaroba`, existsSync(f)); if (!existsSync(f)) continue;
  const c = (await import(f)).default, nomi = G.ACCESSORI.map(a => c[a.chiave]);
  prova(`${cod}: ogni accessorio ha il nome`, nomi.every(n => typeof n === 'string' && n.trim()), nomi.join(' | '));
  prova(`${cod}: nomi diversi fra loro`, new Set(nomi).size === nomi.length);
  for (const k of ['titolo', 'aiuto', 'nessuno', 'messo', 'tolto', 'scheda-aiuto']) prova(`${cod}: guardaroba.${k}`, typeof c['guardaroba.' + k] === 'string' && c['guardaroba.' + k].trim());
}
prova("l'area guardaroba è in js/lingue/indice.js", (await import('../js/lingue/indice.js')).AREE.includes('guardaroba'));

// 6) D.imp.accessorio
const D = await import('../js/dati.js');
prova('VUOTO().imp.accessorio è null', D.VUOTO().imp.accessorio === null);
const base = { v: 1, esami: [], imp: { focus: 25 } };
prova('backup vecchio senza accessorio: valido', D.backupValido(base));
prova('backup con un accessorio vero: valido', D.backupValido({ ...base, imp: { focus: 25, accessorio: 'corona' } }));
prova('backup con accessorio null: valido', D.backupValido({ ...base, imp: { focus: 25, accessorio: null } }));
prova('backup con un accessorio sconosciuto: rifiutato', !D.backupValido({ ...base, imp: { accessorio: '<img onerror=x>' } }) && !D.backupValido({ ...base, imp: { accessorio: 7 } }));
D.sostituisci({ ...base, imp: { focus: 25, accessorio: 'cilindro' } });
prova('si salva e resta', D.D.imp.accessorio === 'cilindro' && D.esporta().imp.accessorio === 'cilindro');
D.sostituisci({ ...base, imp: { focus: 25, accessorio: 'boh' } });
prova('uno sconosciuto (dati scritti a mano) vale nessuno', D.D.imp.accessorio === null);
D.sostituisci({ ...base, imp: { focus: 25 } });
prova('i dati di prima: nessuno', D.D.imp.accessorio === null);

// 7) il comando nelle sei lingue: un processo per lingua
const QUESTO = fileURLToPath(import.meta.url);
for (const cod of LINGUE) {
  let out = '';
  try { out = execFileSync(process.execPath, [QUESTO, '--lingua', cod], { env: { ...process.env, LODE_LINGUA: cod }, encoding: 'utf8', timeout: 60000 }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  const r = out.match(/(\d+) prove passate, (\d+) fallite/);
  if (r) { ok += +r[1]; ko += +r[2]; } else { ko++; console.log(`✗ ${cod}: il processo è finito male`); }
  if (!r || +r[2]) process.stdout.write(out);
}

// 8) cache, prove, festa
const sw = readFileSync(new URL('sw.js', R), 'utf8'), FILE = sw.match(/const FILE = \[(.*?)\];/s)[1];
prova('sw.js: js/guardaroba.js nella cache', FILE.includes("'js/guardaroba.js'"));
for (const cod of LINGUE) prova(`sw.js: js/lingue/${cod}/guardaroba.js nella cache`, FILE.includes(`'js/lingue/${cod}/guardaroba.js'`));
prova("sw.js: l'anteprima per chi sviluppa resta fuori", !FILE.includes('guardaroba.html'));
prova("l'anteprima docs/guardaroba.html c'è", existsSync(new URL('docs/guardaroba.html', R)));
prova('prove.yml lancia test/guardaroba.mjs', readFileSync(new URL('.github/workflows/prove.yml', R), 'utf8').includes('node test/guardaroba.mjs'));
eventi.length = 0; G.festeggia(false); G.festeggia(true);
prova('la festa: il cappellino per un voto, il tocco per il 30 e lode', eventi.length === 2 && eventi[0].type === 'lode:guardaroba' && eventi[0].detail.festa === 'festa' && eventi[1].detail.festa === 'tocco' && eventi[0].detail.ms > 1000);
const masc = readFileSync(new URL('js/mascotte.js', R), 'utf8');
prova('la mascotte indossa il disegno piccolo e rispetta prefers-reduced-motion', /disegno\(id, 20\)/.test(masc) && /RIDOTTO \? '' : `translate\(0,/.test(masc) && /if \(RIDOTTO\) \{ m\.g\.setAttribute\('transform', ''\)/.test(masc));
const css = readFileSync(new URL('css/lode.css', R), 'utf8');
prova('le animazioni delle carte solo senza prefers-reduced-motion', /@media \(prefers-reduced-motion:no-preference\)\{\n  \.gr-pers \.gr-occhio/.test(css));
console.log(`guardaroba: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
