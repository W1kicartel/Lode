// La prova del simulatore stesso: non deve dare falsi allarmi (il motore banale passa senza guasti) e deve accorgersi dei
// difetti veri (motori «mutanti», rotti apposta in un punto solo). Gira in pochi secondi: node test/sync-sim/autoprova.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { esegui } from './mondo.mjs';
import { generaStoria } from './fuzz.mjs';
import { nomeConflitto, SERVIZI } from './cloud.mjs';
import * as banale from './banale.mjs';

const qui = dirname(fileURLToPath(import.meta.url));
let ok = 0, ko = 0;
const prova = (nome, vero, dettaglio = '') => { if (vero) ok++; else ko++; console.log(`${vero ? 'ok  ' : 'NO  '} ${nome}${!vero && dettaglio ? `\n       ${dettaglio}` : ''}`); };

// un mutante dal sorgente del motore banale, con un pezzo cambiato (i percorsi relativi diventano assoluti)
async function mutante(da, a) {
  let src = readFileSync(join(qui, 'banale.mjs'), 'utf8');
  if (!src.includes(da)) throw new Error('mutante: non trovo ' + da);
  src = src.replace(da, a).replace("'./operazioni.mjs'", `'${pathToFileURL(join(qui, 'operazioni.mjs')).href}'`);
  return import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
}
async function fuzz(motore, giri, gen = {}) {
  const prop = new Map();
  for (let s = 1; s <= giri; s++) { const r = await esegui(generaStoria(s, { guasti: false, ...gen }), { motore }); for (const v of r.violazioni) prop.set(v.proprieta, (prop.get(v.proprieta) || 0) + 1); }
  return prop;
}
const elenco = m => [...m].map(([k, n]) => `${k} ${n}`).join(', ') || 'niente';

// 1. niente falsi allarmi
const b = await fuzz(join(qui, 'banale.mjs'), 300);
prova('il motore banale passa 300 storie senza guasti', b.size === 0, elenco(b));

// 2. i mutanti si vedono
const ordine = await mutante('a.l - b.l || (a.pc < b.pc ? -1 : a.pc > b.pc ? 1 : a.n - b.n)', '(a.pc < b.pc ? -1 : a.pc > b.pc ? 1 : a.n - b.n)');
const m1 = await fuzz(ordine, 100);
prova('mutante «ordine per computer invece che causale»: operazioni superate', (m1.get('operazione superata') || 0) + (m1.get('operazione persa') || 0) > 0, elenco(m1));

const dimentica = await mutante("for (const o of j.ops) { ops.set(`${o.pc}:${o.n}`, o); lamport = Math.max(lamport, o.l); }", "for (const o of j.ops.slice(0, -1)) { ops.set(`${o.pc}:${o.n}`, o); lamport = Math.max(lamport, o.l); }");
const m2 = await fuzz(dimentica, 100);
prova('mutante «salta l\'ultima operazione degli altri»: convergenza o operazioni perse', (m2.get('convergenza') || 0) + (m2.get('operazione persa') || 0) + (m2.get('contatore') || 0) > 0, elenco(m2));

const fuori = { crea: x => { const m = banale.crea(x); return { ...m, async modifica(op) { await m.modifica(op); await x.fs.mkdir('vault/Appunti', { recursive: true }); await x.fs.writeFile('vault/Appunti/lode.tmp', 'x'); } }; } };
const m3 = await fuzz(fuori, 20);
prova('mutante «scrive fra gli appunti dello studente»: fuori dalle cartelle', (m3.get('fuori dalle cartelle') || 0) > 0, elenco(m3));

// conferma prima di scrivere: il mutante tiene le modifiche in memoria e le scrive solo al giro dopo (arrivati); se il processo
// muore lì, un'operazione già confermata allo studente è persa
const pigro = { crea: x => { const m = banale.crea(x), coda = []; return { ...m, async modifica(op) { coda.push(op); }, async arrivati(y) { for (const op of coda.splice(0)) await m.modifica(op); return m.arrivati(y); } }; } };
const storiaCrash = { seme: 'crash', computer: ['A', 'B'], passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'quiete' }, { t: 'op', pc: 'A', op: { tipo: 'aggiungiEsame', id: 'ex', nome: 'Esame ZQ 9', cfu: 6 } }, { t: 'crash', pc: 'A', dopo: 1 }, { t: 'arrivati', pc: 'A' }] };
const r4 = await esegui(storiaCrash, { motore: pigro }), r4b = await esegui(storiaCrash, { motore: banale });
prova('mutante «conferma prima di scrivere» + crash: operazione persa', r4.violazioni.some(v => v.proprieta === 'operazione persa'), r4.violazioni.map(v => v.testo).join('; '));
prova('la stessa storia col motore banale (scrive prima di confermare): niente', !r4b.violazioni.length, r4b.violazioni.map(v => v.testo).join('; '));

// la cifratura: un motore che dice di cifrare e scrive in chiaro
const finto = { crea: x => { const m = banale.crea(x); return { ...m, async cifra() { } }; } };
const r5 = await esegui({ seme: 'cif', computer: ['A', 'B'], passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'quiete' }, { t: 'cifra', pc: 'A', password: 'parola segreta' }, { t: 'op', pc: 'A', op: { tipo: 'aggiungiEsame', id: 'ey', nome: 'Esame ZQ 8', cfu: 6 } }] }, { motore: finto });
prova('mutante «cifra() che non cifra»: cifratura', r5.violazioni.some(v => v.proprieta === 'cifratura') && r5.violazioni.some(v => v.proprieta === 'cifratura (cronologia)'), r5.violazioni.map(v => v.proprieta).join(', '));

// 3. il cloud: i nomi delle copie in conflitto come quelli veri
const att = { icloud: 'dati 2.json', dropbox: "dati (PC1's conflicted copy 2026-10-03).json", onedrive: 'dati-PC1.json', gdrive: 'dati (1).json', syncthing: 'dati.sync-conflict-20261003-080000-PC1XXXX.json' };
// i guasti del disco (giro 1): letture e scritture che falliscono con un errore che non è «non c'è», finché il mondo non ripara
{
  const { creaDisco } = await import('./disco.mjs');
  const d = creaDisco('X', { orologio: () => 0 }), m = d.maniglia();
  await m.mkdir('dati/a', { recursive: true }); await m.writeFile('dati/a/f', 'x');
  d.guasta('dati/a', 'EIO', 'leggi'); let c1 = null; try { await m.readFile('dati/a/f', 'utf8'); } catch (x) { c1 = x.code; }
  d.guasta('dati/a', 'ENOSPC', 'scrivi'); let c2 = null; try { await m.writeFile('dati/a/g', 'y'); } catch (x) { c2 = x.code; }
  let c3 = null; try { await m.readFile('dati/b', 'utf8'); } catch (x) { c3 = x.code; }
  d.ripara(); const t = await m.readFile('dati/a/f', 'utf8');
  prova('il disco guasto: EIO in lettura, ENOSPC in scrittura, solo sotto la cartella guasta, e poi riparato', c1 === 'EIO' && c2 === 'ENOSPC' && c3 === 'ENOENT' && t === 'x', JSON.stringify([c1, c2, c3, t]));
}
for (const s of SERVIZI) { const n = nomeConflitto('.lode/dati.json', { servizio: s, pc: 'pc1', ora: Date.parse('2026-10-03T08:00:00Z') }); prova(`copia in conflitto ${s}: ${n}`, n === '.lode/' + att[s], att[s]); }

console.log(`\n${ok} ok, ${ko} no`);
process.exitCode = ko ? 1 : 0;
