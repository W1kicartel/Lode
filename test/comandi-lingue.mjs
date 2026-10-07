// Il banco dei comandi senza AI in tutte le lingue (docs/LINGUE.md, «I comandi senza AI»): node test/comandi-lingue.mjs
// Per ogni lingua con i suoi casi (test/comandi/<codice>.mjs: CASI = [[frase, risultato atteso], …], NON = [frasi che non
// sono comandi]) lancia sé stesso con LODE_LINGUA=<codice>, perché la lingua si sceglie una volta all'avvio, e controlla:
//   - ogni frase dà esattamente il risultato atteso (deep-equal; gli esami si scrivono E('Nome') e diventano quelli del libretto);
//   - almeno 3 frasi per ogni tipo che l'italiano riconosce, e gli stessi campi dell'italiano (per tipo, e per azione dove c'è);
//   - le frasi NON restano null (vanno all'AI): almeno 15 nelle lingue diverse dall'italiano;
//   - ESEMPI del riconoscitore: stesso numero dell'italiano, e ogni esempio è davvero un comando nella sua lingua;
//   - ogni riconoscitore in js/comandi/ ha i suoi casi, e quello della lingua scelta è caricato davvero;
//   - ogni comando che un testo cita fra virgolette («segui il progetto», «sì», «esci»…) la barra lo capisce davvero.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const R = new URL('../', import.meta.url);
const QUESTO = fileURLToPath(import.meta.url);
const LINGUE = ['it', 'en', 'es', 'fr', 'de', 'pt'];
const arg = process.argv.indexOf('--lingua'), cod = arg > 0 ? process.argv[arg + 1] : null;
let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };

if (!cod) {
  // il giro di tutte le lingue: un processo per lingua
  const conCasi = LINGUE.filter(c => existsSync(new URL(`test/comandi/${c}.mjs`, R)));
  const riconoscitori = readdirSync(new URL('js/comandi/', R)).filter(f => /^[a-z]{2}\.js$/.test(f)).map(f => f.slice(0, 2));
  prova('i casi italiani ci sono (test/comandi/it.mjs)', conCasi.includes('it'));
  for (const c of riconoscitori) prova(`js/comandi/${c}.js ha i suoi casi in test/comandi/${c}.mjs`, conCasi.includes(c));
  for (const c of conCasi) {
    let out = '', fallita = false;
    try { out = execFileSync(process.execPath, [QUESTO, '--lingua', c], { env: { ...process.env, LODE_LINGUA: c }, encoding: 'utf8', timeout: 60000 }); }
    catch (e) { out = (e.stdout || '') + (e.stderr || ''); fallita = true; }
    process.stdout.write(out);
    const r = out.match(/(\d+) prove passate, (\d+) fallite/);
    if (r) { ok += +r[1]; ko += +r[2]; } else ko++;
    if (fallita && !(r && +r[2])) { ko++; console.log(`✗ ${c}: il processo è finito male`); }
  }
  console.log(`comandi-lingue (${conCasi.join(', ')}): ${ok} prove passate, ${ko} fallite`);
  process.exit(ko ? 1 : 0);
}

// una lingua sola, in questo processo (LODE_LINGUA = cod)
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const D = await import('../js/dati.js'), L = await import('../js/lingua.js'), C = await import('../js/comandi.js');
const { ESAMI } = await import('./comandi/aiuto.mjs');
const IT = await import('./comandi/it.mjs'), X = cod === 'it' ? IT : await import(`./comandi/${cod}.mjs`);
const RIT = await import('../js/comandi/it.js');
// il libretto del banco: esami italiani e inglesi, fatti e da fare
D.sostituisci({ ...D.esempio(), esami: [], sessioni: [], carte: [] });
for (const [nome, cfu, voto, idoneita] of [...ESAMI, ...(X.ESAMI || [])]) {   // X.ESAMI: gli esami della lingua, solo nel suo giro
  const e = D.aggiungiEsame({ nome, cfu, data: voto !== undefined ? D.piuGiorni(D.oggi(), -100) : D.piuGiorni(D.oggi(), 30) });
  if (voto !== undefined) D.registraVoto(e.id, { voto, idoneita: !!idoneita, data: e.data });
}
const esame = nome => D.D.esami.find(e => e.nome === nome) || `(nessun esame «${nome}» nel libretto del banco)`;
const risolvi = x => (typeof x === 'string' && x.startsWith('@esame:') ? esame(x.slice(7)) : Array.isArray(x) ? x.map(risolvi) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, risolvi(v)])) : x);
const breve = x => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && 'id' in v && 'nome' in v ? `esame:${v.nome}` : v));

prova(`${cod}: la lingua scelta è ${cod}`, L.lingua === cod, L.lingua);
const ric = await C.carica(cod);
prova(`${cod}: il riconoscitore js/comandi/${cod}.js è caricato`, !!ric && typeof ric.interpreta === 'function' && typeof ric.leggiData === 'function' && Array.isArray(ric.ESEMPI));

// 1. i casi
for (const [frase, atteso] of X.CASI) {
  const r = C.interpreta(frase), a = risolvi(atteso);
  prova(`${cod}: ${JSON.stringify(frase)}`, isDeepStrictEqual(r, a), `\n    dà     ${breve(r)}\n    atteso ${breve(a)}`);
}
// 1b. l'inglese di riserva nella lingua scelta (RISERVA del file della lingua, se c'è)
for (const [frase, atteso] of X.RISERVA || []) {
  const r = C.interpreta(frase), a = risolvi(atteso);
  prova(`${cod}: riserva inglese ${JSON.stringify(frase)}`, isDeepStrictEqual(r, a), `\n    dà     ${breve(r)}\n    atteso ${breve(a)}`);
}
// 2. i tipi dell'italiano: almeno 3 frasi per tipo, e gli stessi campi (per tipo + azione)
const firma = o => o.tipo + (o.azione ? ':' + o.azione : '');
const campi = o => Object.keys(o).sort().join(',');
const CAMPI_IT = new Map();
for (const [, a] of IT.CASI) { const f = firma(a); if (!CAMPI_IT.has(f)) CAMPI_IT.set(f, new Set()); CAMPI_IT.get(f).add(campi(a)); }
const quanti = {};
for (const [, a] of X.CASI) quanti[a.tipo] = (quanti[a.tipo] || 0) + 1;
const TIPI = [...new Set(IT.CASI.map(([, a]) => a.tipo))];
for (const t of TIPI) prova(`${cod}: almeno 3 frasi per il tipo «${t}»`, (quanti[t] || 0) >= 3, `(sono ${quanti[t] || 0})`);
for (const [frase, a] of X.CASI) {
  const f = firma(a);
  prova(`${cod}: ${JSON.stringify(frase)} è un tipo dell'italiano, con gli stessi campi`, CAMPI_IT.has(f) && CAMPI_IT.get(f).has(campi(a)), `${f} {${campi(a)}} — in italiano: ${[...(CAMPI_IT.get(f) || [])].join(' | ') || 'nessuno'}`);
}
// 3. le frasi che non sono comandi
prova(`${cod}: almeno ${cod === 'it' ? 10 : 15} frasi che non sono comandi`, (X.NON || []).length >= (cod === 'it' ? 10 : 15), `(sono ${(X.NON || []).length})`);
for (const f of X.NON || []) { const r = C.interpreta(f); prova(`${cod}: ${JSON.stringify(f)} non è un comando`, r === null, breve(r)); }
// 4. gli esempi: stesso numero dell'italiano, coppie di testi, e ognuno è un comando nella sua lingua
prova(`${cod}: ESEMPI quanti l'italiano`, ric?.ESEMPI?.length === RIT.ESEMPI.length, `${ric?.ESEMPI?.length} invece di ${RIT.ESEMPI.length}`);
prova(`${cod}: comandi.js dà gli ESEMPI della lingua scelta`, C.ESEMPI === ric?.ESEMPI);
for (const [frase, cosa] of ric?.ESEMPI || []) {
  prova(`${cod}: esempio ${JSON.stringify(frase)} con la spiegazione`, typeof frase === 'string' && typeof cosa === 'string' && !!cosa.trim());
  prova(`${cod}: esempio ${JSON.stringify(frase)} è un comando`, ric.interpreta(frase.replace(/…/g, 'x')) !== null);
}
// 5. i comandi citati nei testi: se un testo italiano cita fra virgolette una frase che la barra italiana prende (un
//    comando, o una parola delle schede: «sì», «esci»…), la stessa chiave nella lingua scelta cita frasi che la barra in
//    quella lingua prende davvero, almeno quante l'italiano. Se la frase citata è un'etichetta (un bottone, una voce del
//    menu: il testo intero di un'altra chiave, come «Smetti su questo computer»), basta che la lingua citi la sua etichetta (o un comando).
//    I dati di esempio (catalogo «esempio») non sono testi della barra e non contano
const CO = await import('../js/comandi/comune.js');
const SCHEDE = ['si', 'no', 'basta', 'esci', 'voto'];
const citate = s => [...String(s).matchAll(/„([^„“]+)“|«\u202f?([^«»]+?)\u202f?»|“([^“”]+)”/g)].map(m => (m[1] ?? m[2] ?? m[3]).trim()).filter(q => !q.includes('{'));
const testi = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(testi) : v && typeof v === 'object' ? Object.values(v).flatMap(testi) : [];
const comandoIt = q => RIT.interpreta(q.replace(/…/g, 'x')) != null || SCHEDE.some(k => CO.detto(q, RIT.PAROLE, k));
const comando = q => C.interpreta(q.replace(/…/g, 'x')) != null || SCHEDE.some(k => C.dice(q, k));
const CIT = L._cataloghi.it, CAT = L._cataloghi[cod] || CIT;
const etichette = new Map();
for (const [k, v] of Object.entries(CIT)) if (typeof v === 'string' && !etichette.has(v)) etichette.set(v, k);
let citati = 0;
for (const [k, v] of Object.entries(CIT)) {
  if (k.startsWith('esempio.')) continue;
  const it = testi(v).flatMap(citate).filter(comandoIt);
  if (!it.length) continue;
  citati++;
  const loro = testi(CAT[k]).flatMap(citate);
  const comandi = it.filter(q => !(etichette.has(q) && etichette.get(q) !== k)).length;
  for (const q of it) if (etichette.has(q) && etichette.get(q) !== k) {
    const e = etichette.get(q);
    prova(`${cod}: ${k} cita l'etichetta ${e}`, loro.some(x => x === String(CAT[e]).trim() || comando(x)), `cita ${JSON.stringify(loro)}, l'etichetta è ${JSON.stringify(CAT[e])}`);
  }
  const buoni = loro.filter(comando);
  prova(`${cod}: ${k} cita comandi che la barra capisce`, buoni.length >= comandi, `l'italiano ne cita ${comandi} (${JSON.stringify(it)}), ${cod} ${JSON.stringify(loro)} → capiti ${JSON.stringify(buoni)}`);
}
// 6. le parole delle schede con l'apostrofo tipografico: «d’accordo» come «d'accordo»
for (const k of SCHEDE) for (const w of (ric.PAROLE?.[k] || []).filter(w => w.includes("'")))
  prova(`${cod}: ${k} «${w.replace(/'/g, '’')}» con l'apostrofo tipografico`, C.dice(w.replace(/'/g, '’'), k) && C.dice(w.replace(/'/g, '’').toUpperCase(), k));
prova(`${cod}: ci sono testi che citano comandi`, citati >= 30, `(sono ${citati})`);
console.log(`${cod}: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
