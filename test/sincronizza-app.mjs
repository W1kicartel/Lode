// Prova dell'app desktop con la sincronizzazione v2 (docs/SINCRONIZZAZIONE.md): due e poi tre «computer» sulla stessa cartella
// cloud, uno alla volta (un solo Electron per volta), senza toccare i tuoi dati.   node test/sincronizza-app.mjs
// Tutto in una cartella temporanea: la «cartella cloud» (LODE_CLOUD, solo in sviluppo), le cartelle dei dati dei computer
// (LODE_DATI), i vault, la lista di Obsidian. LODE_MACCHINA dà a ogni computer la sua impronta, LODE_PORTACHIAVI_FINTO tiene
// le chiavi in un file (il Portachiavi vero chiederebbe il permesso con una finestra).
//  1. A accende con la password e lo spostamento si interrompe a metà della copia (il processo muore): il vault di prima e i
//     dati restano, e lo spostamento riprende e finisce. Nella cartella cloud nessun dato di Lode in chiaro.
//  2. B: «Uso già Lode su un altro computer», la password, i dati arrivano; poi B cambia un voto.
//  3. A cambia lo stesso voto senza vedere B (la cartella di B nascosta: il cloud in ritardo) e aggiunge un esame.
//  4. Orario.md cambiato «in Obsidian»: una lezione tolta e una aggiunta, il marcatore in fondo resta.
//  5. C, il terzo computer, dalla scheda della barra; poi tutti vedono lo stesso risultato e niente si perde.
//  6. C fa «Smetti su questo computer»: vault fuori dal cloud, i dati restano, gli altri continuano senza le sue modifiche nuove.
//  7. Senza password, con il vault già nella cartella cloud: D accende sul posto, E si unisce.
//  8. Con la password, con il vault già nella cartella cloud: F accende sul posto; il gruppo nasce cifrato e nella cartella
//     cloud non passa niente in chiaro (nemmeno dati.prev.json). E la ripresa dello spostamento di A senza password (passo 1)
//     si rifiuta: era cominciato con la password.
// Niente AI, niente voce, niente microfono. Ogni Electron ha il suo cane da guardia (LODE_LIMITE_MIN, 4 minuti).
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, renameSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IN_CHIARO } from '../js/sync-testi.js';

const QUI = dirname(fileURLToPath(import.meta.url)), DESKTOP = join(QUI, '..', 'desktop');
let ELECTRON; try { ELECTRON = createRequire(join(DESKTOP, 'package.json'))('electron'); } catch { }
if (!ELECTRON || !existsSync(ELECTRON)) { console.error('Prima: cd desktop && npm install'); process.exit(1); }
const DIR = mkdtempSync(join(tmpdir(), 'lode-sync2-app-')), CLOUD = join(DIR, 'cloud'), CLOUD2 = join(DIR, 'cloud2'), OBS = join(DIR, 'obsidian');
const dati = n => join(DIR, `${n}-dati`), locale = n => join(DIR, `${n}-Documenti`, 'Lode'), NUVOLA = join(CLOUD, 'Lode');
for (const d of [CLOUD, CLOUD2, OBS, locale('A'), locale('B'), locale('C')]) mkdirSync(d, { recursive: true });
writeFileSync(join(OBS, 'obsidian.json'), JSON.stringify({ vaults: {} }));
const LIMITE = +process.env.LODE_LIMITE_MIN || 4, PW = 'cavallo-batteria-1', OGGI = new Date().toISOString().slice(0, 10);
console.log('Cartella di prova:', DIR);

// il dati.json di A, come lo lascia la Lode di oggi
mkdirSync(join(locale('A'), '.lode'), { recursive: true });
writeFileSync(join(locale('A'), '.lode', 'dati.json'), JSON.stringify({ v: 1, benvenuto: true, profilo: { nome: 'Anna', corso: 'Ingegneria', cfuTotali: 180, lode: 30 },
  esami: [{ id: 'e1', nome: 'Analisi 1', cfu: 9, voto: 27, lode: false, idoneita: false, fatto: true, data: '2026-02-01', oreObiettivo: null }, { id: 'e2', nome: 'Fisica 1', cfu: 9, voto: null, lode: false, idoneita: false, fatto: false, data: null, oreObiettivo: null }],
  carte: [{ id: 'c1', esameId: 'e2', fronte: 'Seconda legge di Newton?', retro: 'F = m a', ease: 2.5, int: 0, rip: 0, scad: OGGI, creata: 1 }],
  orario: [{ id: 'x1', corso: 'Analisi 2', giorni: [1, 3], inizio: '09:00', fine: '11:00', aula: '7' }, { id: 'x2', corso: 'Chimica', giorni: [2], inizio: '14:00', fine: '16:00', aula: 'B2' }],
  sessioni: [], lezioni: [], memoria: {}, imp: { focus: 25 } }, null, 1));

function avvia(nome, passi, env) {
  const file = join(DIR, `passi-${nome}.json`); writeFileSync(file, JSON.stringify(passi));
  return new Promise(ok => {
    const p = spawn(ELECTRON, ['.'], { cwd: DESKTOP, env: { ...process.env, LODE_NON_APRIRE: '1', LODE_PROVA: file, LODE_ESCI: '1', LODE_OBSIDIAN_DIR: OBS, LODE_CLOUD: CLOUD, LODE_PORTACHIAVI_FINTO: '1', ...env } });
    let s = '', fatto = false;
    const eco = x => { s += x; for (const r of String(x).split('\n')) if (r.trim() && !/Warning|DevTools|trace-warnings/.test(r)) process.stdout.write(`[${nome}] ${r.slice(0, 300)}\n`); };
    const testo = x => { try { const v = JSON.parse(x); return typeof v === 'string' ? v : JSON.stringify(v); } catch { return x; } };
    const fine = (codice, segnale) => { if (fatto) return; fatto = true; clearTimeout(cane); ok({ out: s, codice, segnale, ris: Object.fromEntries([...s.matchAll(/^passo (\d+)(?: errore)?: (.*)$/gm)].map(m => [+m[1], testo(m[2])])) }); };
    p.stdout.on('data', eco); p.stderr.on('data', eco);
    const cane = setTimeout(() => { eco(`CANE DA GUARDIA: ${nome} fermato dopo ${LIMITE} minuti\n`); if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); else p.kill('SIGKILL'); }, LIMITE * 60e3);
    p.on('exit', (c, sg) => setTimeout(() => fine(c, sg), 800)); p.on('error', e => { eco(`Electron non parte: ${e.message}\n`); fine(null); });
  });
}
let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { cond ? ok++ : ko++; console.log(`${cond ? '✓' : '✗'} ${nome}${cond ? '' : `\n    ${String(dett).slice(0, 700)}`}`); };
const leggi = f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const tutti = d => { const out = []; const giu = p => { let l = []; try { l = readdirSync(p, { withFileTypes: true }); } catch { return; } for (const x of l) { const q = join(p, x.name); if (x.isDirectory()) giu(q); else out.push(q); } }; giu(d); return out; };
const J = r => { try { return JSON.parse(r); } catch { return null; } };
// helper dentro la barra (ogni passo li rifà)
const H = `const w = ms => new Promise(r => setTimeout(r, ms)); const aspetta = async (f, sec = 30) => { const t0 = Date.now(); for (;;) { let r; try { r = await f(); } catch { } if (r || Date.now() - t0 > sec * 1000) return r; await w(300); } };
  const S = () => window.lodeDesktop.invoca('sync:stato'), giro = () => window.lodeDesktop.invoca('sync:giro');
  const riassunto = () => { const D = __lode.D(); return { nome: D.profilo.nome, esami: D.esami.map(e => e.nome + ':' + (e.voto ?? '-')).sort(), carte: D.carte.map(c => c.fronte + ':' + c.rip).sort(), orario: D.orario.map(o => o.corso + ' ' + o.inizio).sort() }; };
  const apri = async () => { if (!__lode.stato().aperto) { document.querySelector('.ld-pill')?.click(); await w(600); } };
  const di = async t => { await apri(); __lode.invia(t); await w(1800); };`;
const js = corpo => `(async()=>{ ${H} ${corpo} })()`;
const gruppo = () => { let g = []; try { g = readdirSync(join(NUVOLA, '.lode', 'sync')); } catch { return 'manca'; } g = g.filter(x => !x.startsWith('.')); return g.find(x => existsSync(join(NUVOLA, '.lode', 'sync', x, 'gruppo.json'))) || g[0]; };

/* ---------- 1. A accende con la password; lo spostamento si interrompe e poi riprende ---------- */
const A = { LODE_DATI: dati('A'), LODE_MACCHINA: 'macchina-A' };
const a1 = await avvia('A1', [
  { attesa: 2500, js: js(`return JSON.stringify(riassunto())`) },
  { attesa: 300, js: js(`const c = await window.lodeDesktop.invoca('sync:cartelle'); window.lodeDesktop.invoca('sync:attiva', { i: c.cartelle[0].i, password: '${PW}' }); await w(20000); return 'non doveva arrivare qui'`) },
], { ...A, LODE_VAULT: locale('A'), LODE_SYNC_CRASH: 'copia' });
prova('A: con la sincronizzazione spenta i dati vengono da dati.json come prima', /Analisi 1:27/.test(a1.ris[0] || '') && /Analisi 2 09:00/.test(a1.ris[0] || ''), a1.ris[0]);
prova('A: lo spostamento muore a metà della copia', a1.segnale === 'SIGKILL' || a1.codice === null || !a1.ris[1], `codice ${a1.codice} ${a1.segnale} ${a1.ris[1]}`);
prova('A: il dati.json di prima è in copie/ e al suo posto c\'è il minimo', /Analisi 1/.test(tutti(join(dati('A'), 'sync', 'copie')).map(leggi).join('')) && /lode2/.test(leggi(join(locale('A'), '.lode', 'dati.json'))));
prova('A: lo spostamento è segnato come da finire, la copia nel cloud è a metà', existsSync(join(dati('A'), 'sync', 'spostamento.json')) && !existsSync(join(NUVOLA, '.lode', 'sync')));

const a2 = await avvia('A2', [
  { attesa: 2500, js: js(`const s = await S(); const c = await window.lodeDesktop.invoca('sync:cartelle'); const rp = await window.lodeDesktop.invoca('sync:attiva', { i: c.cartelle[0].i }); return JSON.stringify({ sp: s.spostamento, acceso: s.acceso, r: riassunto(), rp })`) },
  { attesa: 300, js: js(`const c = await window.lodeDesktop.invoca('sync:cartelle'); const r = await window.lodeDesktop.invoca('sync:attiva', { i: c.cartelle[0].i, password: '${PW}' }); return JSON.stringify(r)`) },
  { attesa: 3000, js: js(`await giro(); const s = await S(); return JSON.stringify({ s: s.stato, cloud: s.cloud, cifrato: s.cifrato, r: riassunto() })`) },
  { attesa: 300, js: js(`await di('ho preso 30 in fisica 1'); await di('esame storia il 20 dicembre 6 cfu'); await w(2500); return JSON.stringify(riassunto())`) },
], A);
const a20 = J(a2.ris[0]);
prova('A riparte: lo spostamento interrotto si vede e i dati ci sono (dal diario)', a20?.sp?.interrotto && a20.acceso && a20.r.esami.includes('Analisi 1:27'), a2.ris[0]);
prova('A: la ripresa senza password di uno spostamento cominciato con la password si rifiuta (niente in chiaro nel cloud)', a20?.sp?.cifrata && a20.rp?.esito === 'password', a2.ris[0]);
prova('A: lo spostamento riprende e finisce', J(a2.ris[1])?.esito === 'ok', a2.ris[1]);
const a22 = J(a2.ris[2]);
prova('A: sincronizzato, cifrato, in pari, con tutti i dati', a22?.s === 'in_pari' && a22.cloud && a22.cifrato && a22.r.esami.includes('Analisi 1:27') && a22.r.orario.length === 2, a2.ris[2]);
prova('A: le note sono nella cartella cloud', existsSync(join(NUVOLA, 'Home.md')) && existsSync(join(NUVOLA, 'Orario.md')));
const segreti = tutti(join(NUVOLA, '.lode')).filter(f => /Analisi|Fisica|Newton|Anna/.test(leggi(f)));
prova('A: nella cartella cloud nessun dato di Lode in chiaro sotto .lode (gruppo cifrato)', !segreti.length && /"cifratura":\{/.test(leggi(join(NUVOLA, '.lode', 'sync', gruppo(), 'gruppo.json'))), segreti.join(', '));
prova('A: Orario.md lo scrive il motore, col marcatore in fondo', /<!-- lode2 .*righe=/.test(leggi(join(NUVOLA, 'Orario.md'))), leggi(join(NUVOLA, 'Orario.md')).slice(-300));
prova('A: voto ed esame nuovo', /Fisica 1:30/.test(a2.ris[3] || '') && /Storia/.test(a2.ris[3] || ''), a2.ris[3]);

/* ---------- 2. B: «Uso già Lode su un altro computer» ---------- */
const B = { LODE_DATI: dati('B'), LODE_MACCHINA: 'macchina-B' };
const b1 = await avvia('B1', [
  { attesa: 2500, js: js(`const c = await window.lodeDesktop.invoca('sync:cartelle'); const r = await window.lodeDesktop.invoca('sync:collega', { i: c.vault[0]?.i ?? 0 }); return JSON.stringify(r)`) },
  { attesa: 300, js: js(`const r = await window.lodeDesktop.invoca('sync:sblocca', { password: 'sbagliata-123' }); const r2 = await window.lodeDesktop.invoca('sync:sblocca', { password: '${PW}' }); return r.esito + ' ' + r2.esito`) },
  { attesa: 300, js: js(`await aspetta(async () => { await giro(); return __lode.D().esami.some(e => e.nome === 'Storia'); }, 40); const s = await S(); return JSON.stringify({ s: s.stato, r: riassunto() })`) },
  { attesa: 300, js: js(`await di('ho preso 28 in analisi 1'); await w(2500); return JSON.stringify(riassunto())`) },
], { ...B, LODE_VAULT: locale('B') });
prova('B: si collega e il gruppo chiede la password', J(b1.ris[0])?.stato === 'password', b1.ris[0]);
prova('B: password sbagliata rifiutata, quella giusta sblocca', b1.ris[1] === 'sbagliata ok', b1.ris[1]);
const b12 = J(b1.ris[2]);
prova('B: arrivano tutti i dati di A', b12?.s === 'in_pari' && b12.r.nome === 'Anna' && b12.r.esami.includes('Fisica 1:30') && b12.r.esami.some(x => x.startsWith('Storia')) && b12.r.orario.length === 2, b1.ris[2]);
prova('B: il suo vault locale di prima non è toccato', !existsSync(join(locale('B'), '.lode', 'sync')));

/* ---------- 3. A cambia lo stesso voto senza vedere B (il cloud in ritardo) ---------- */
const g = gruppo(), cartelle = (existsSync(join(NUVOLA, '.lode', 'sync', g)) ? readdirSync(join(NUVOLA, '.lode', 'sync', g)) : []).filter(x => !x.endsWith('.json') && !x.startsWith('.'));
const devB = J(leggi(join(dati('B'), 'sync', g, 'stato.json')))?.dati?.dev, nascosta = join(DIR, 'nascosta-B');
if (devB && cartelle.includes(devB)) renameSync(join(NUVOLA, '.lode', 'sync', g, devB), nascosta);
const a3 = await avvia('A3', [
  { attesa: 2500, js: js(`await di('ho preso 29 in analisi 1'); await di('esame latino il 10 gennaio 6 cfu'); await w(2500); return JSON.stringify(riassunto())`) },
], A);
if (existsSync(nascosta)) renameSync(nascosta, join(NUVOLA, '.lode', 'sync', g, devB));
prova('A: modifica contemporanea (29 contro il 28 di B, che non vede)', /Analisi 1:29/.test(a3.ris[0] || '') && /Latino/.test(a3.ris[0] || ''), a3.ris[0]);

/* ---------- 4. Orario.md cambiato in Obsidian: via Chimica, dentro Fisica 2 (il marcatore in fondo resta) ---------- */
const om = leggi(join(NUVOLA, 'Orario.md'));
const om2 = om.replace(/^\| \[\[Chimica\]\].*\n/m, '').replace(/(\|---\|---\|---\|---\|---\|\n)/, '$1| [[Fisica 2]] | ven | 11:00 | 13:00 | Magna |\n');
writeFileSync(join(NUVOLA, 'Orario.md'), om2);
prova('Obsidian: Orario.md cambiato tenendo il marcatore', om2 !== om && /<!-- lode2 /.test(om2) && /Fisica 2/.test(om2) && !/Chimica/.test(om2));

/* ---------- 5. C dalla scheda della barra; poi tutti uguali ---------- */
const C = { LODE_DATI: dati('C'), LODE_MACCHINA: 'macchina-C' };
const c1 = await avvia('C1', [
  { attesa: 2500, js: js(`await di('uso già lode su un altro computer'); const b = await aspetta(() => document.querySelector('.ld-sync [data-vault]:not([data-vault=altro])'), 10); if (!b) return 'nessun vault nella scheda'; b.click(); await aspetta(async () => (await S()).stato === 'password', 20); return (await S()).stato`) },
  { attesa: 1500, js: js(`await di('sblocca'); const i = await aspetta(() => [...document.querySelectorAll('.ld-sync [data-pw]')].pop(), 10); if (!i) return 'nessun campo password'; i.value = '${PW}'; [...document.querySelectorAll('.ld-sync [data-sblocca]')].pop().click(); await aspetta(async () => (await S()).stato === 'in_pari', 30); return (await S()).stato`) },
  { attesa: 300, js: js(`await aspetta(async () => { await giro(); return __lode.D().esami.some(e => e.nome === 'Latino'); }, 30); return JSON.stringify(riassunto())`) },
], { ...C, LODE_VAULT: locale('C') });
prova('C: dalla scheda «Uso già Lode su un altro computer», poi la password', c1.ris[0] === 'password' && c1.ris[1] === 'in_pari', `${c1.ris[0]} / ${c1.ris[1]}`);
const fin = {};
for (const [n, env] of [['A', A], ['B', B], ['C', C], ['A', A]]) {
  const r = await avvia(`${n}-fine`, [{ attesa: 2500, js: js(`for (let i = 0; i < 4; i++) { await giro(); await w(400); } const s = await S(); return JSON.stringify({ s: s.stato, conflitti: s.conflitti, r: riassunto() })`) }], env);
  fin[n] = J(r.ris[0]);
}
const vista = x => JSON.stringify(x?.r);
prova('tre computer: tutti vedono lo stesso risultato', fin.A && vista(fin.A) === vista(fin.B) && vista(fin.B) === vista(fin.C), JSON.stringify(fin));
const R = fin.A?.r || { esami: [], orario: [] };
prova('niente si perde: esami di A e B, voto e orario di Obsidian', ['Fisica 1:30', 'Storia', 'Latino'].every(x => R.esami.some(e => e.startsWith(x))) && R.orario.includes('Fisica 2 11:00') && !R.orario.some(o => o.startsWith('Chimica')) && R.orario.includes('Analisi 2 09:00'), JSON.stringify(R));
prova('la modifica contemporanea si vede in «Cambiato su due computer»', R.esami.some(e => /^Analisi 1:(28|29)$/.test(e)) && fin.A.conflitti >= 1, JSON.stringify(fin.A));
// una copia in conflitto: «conflict» nel nome, o «nome 2.md» accanto a «nome.md»
const conflitto = tutti(CLOUD).filter(f => /conflict/i.test(f) || (m => m && existsSync(`${m[1]}.${m[3]}`))(f.match(/^(.+) (\d+)\.(seg|md|json)$/)));
prova('nella cartella cloud un diario per computer, nessuna copia in conflitto', (existsSync(join(NUVOLA, '.lode', 'sync', g)) ? readdirSync(join(NUVOLA, '.lode', 'sync', g)) : []).filter(x => !x.endsWith('.json')).length === 3 && !conflitto.length, conflitto.join(', '));

/* ---------- 6. C: «Smetti su questo computer» ---------- */
const FUORI = join(DIR, 'C-fuori');
mkdirSync(FUORI, { recursive: true });
const c2 = await avvia('C2', [
  { attesa: 2500, js: js(`const r = await window.lodeDesktop.invoca('sync:smetti'); await w(1500); const s = await S(); return JSON.stringify({ r, cloud: s.cloud, riga: s.stato, d: riassunto() })`) },
  { attesa: 1500, js: js(`await di('esame greco il 3 febbraio 6 cfu'); await w(2000); return JSON.stringify(riassunto())`) },
], { ...C, LODE_SCEGLI_SMETTI: FUORI });
const c20 = J(c2.ris[0]);
prova('C: smette, il vault è fuori dal cloud con tutti i dati', c20?.r?.esito === 'ok' && !c20.cloud && existsSync(join(FUORI, 'Lode', 'Home.md')) && vista({ r: c20.d }) === vista(fin.A), c2.ris[0]);
prova('C: dopo «Smetti» lavora sul suo vault', /Greco/.test(c2.ris[1] || ''), c2.ris[1]);
const PW2 = 'giraffa-lampada-2';
const a4 = await avvia('A-dopo', [
  { attesa: 2500, js: js(`for (let i = 0; i < 3; i++) { await giro(); await w(400); } const s = await S(); return JSON.stringify({ s: s.stato, r: riassunto() })`) },
  { attesa: 300, js: js(`await di('prepara'); return await aspetta(() => document.querySelector('.ld-prepara .ld-prep[data-k="sync"] .d')?.textContent, 10) || 'nessuna riga'`) },
  // «Cambia password»: una rigenerazione (§10.4); B la chiederà
  { attesa: 300, js: js(`const r = await window.lodeDesktop.invoca('sync:cifra', { password: '${PW2}' }); await giro(); const s = await S(); return JSON.stringify({ r, s: s.stato, cifrato: s.cifrato })`) },
], A);
const a40 = J(a4.ris[0]);
prova('A continua dopo «Smetti» di C, senza le sue modifiche nuove', a40?.s === 'in_pari' && !a40.r.esami.some(e => e.startsWith('Greco')) && a40.r.esami.some(e => e.startsWith('Latino')), a4.ris[0]);
prova('Prepara Lode: la riga «Sincronizza fra i tuoi computer» dice lo stato', /^Sincronizzato con .* · cifrato/.test(a4.ris[1] || ''), a4.ris[1]);
prova('A: «Cambia password» fa un gruppo nuovo, cifrato', J(a4.ris[2])?.r?.esito === 'ok' && J(a4.ris[2]).s === 'in_pari', a4.ris[2]);
const b3 = await avvia('B-pw', [
  { attesa: 2500, js: js(`await aspetta(async () => { await giro(); return ['rigenerato', 'password'].includes((await S()).stato); }, 20); const s1 = (await S()).stato; await di('ho preso 18 in latino'); await w(1500); const r = await window.lodeDesktop.invoca('sync:sblocca', { password: '${PW2}' }); await aspetta(async () => { await giro(); return (await S()).stato === 'in_pari'; }, 20); const s = await S(); return JSON.stringify({ s1, r: r.esito, s: s.stato, d: riassunto() })`) },
], B);
const b30 = J(b3.ris[0]);
prova('B: dopo il cambio password chiede quella nuova, intanto lavora sui dati locali, poi riparte', b30?.s1 && ['rigenerato', 'password'].includes(b30.s1) && b30.r === 'ok' && b30.s === 'in_pari' && b30.d.esami.includes('Latino:18'), b3.ris[0]);
const a5 = await avvia('A-pw', [{ attesa: 2500, js: js(`await aspetta(async () => { await giro(); return __lode.D().esami.includes ? __lode.D().esami.some(e => e.nome === 'Latino' && e.voto === 18) : false; }, 25); return JSON.stringify(riassunto())`) }], A);
prova('A riceve la modifica fatta da B mentre aspettava la password', /Latino:18/.test(a5.ris[0] || ''), a5.ris[0]);

/* ---------- 7. Senza password, con il vault già nella cartella cloud ---------- */
const DD = { LODE_DATI: dati('D'), LODE_MACCHINA: 'macchina-D', LODE_CLOUD: CLOUD2 }, EE = { LODE_DATI: dati('E'), LODE_MACCHINA: 'macchina-E', LODE_CLOUD: CLOUD2 };
const V2 = join(CLOUD2, 'Lode');
mkdirSync(join(V2, '.lode'), { recursive: true });
writeFileSync(join(V2, '.lode', 'dati.json'), JSON.stringify({ v: 1, profilo: { nome: 'Dario' }, esami: [{ id: 'z1', nome: 'Economia', cfu: 6, voto: 25, fatto: true }], carte: [], orario: [], sessioni: [], benvenuto: true }));
const d1 = await avvia('D1', [
  // dalla scheda: «sincronizza», la cartella, la conferma con la scelta della password (qui: senza)
  { attesa: 2500, js: js(`await di('sincronizza fra i computer'); const b = await aspetta(() => document.querySelector('.ld-sync [data-cloud]:not([data-cloud=altra])'), 10); if (!b) return 'nessuna scheda';
    b.click(); const c = await aspetta(() => [...document.querySelectorAll('.ld-conf')].pop(), 10); if (!c) return 'nessuna conferma';
    const h = c.innerHTML, onesto = /Proteggi i dati di Lode con una password/.test(h) && /In chiaro nella cartella cloud/.test(h) && /Se dimentichi la password non si perde niente/.test(h) && /già nella cartella cloud/.test(h);
    c.querySelector('[data-ld=si]').click(); await aspetta(async () => (await S()).cloud, 20); await w(1500); const s = await S();
    return JSON.stringify({ onesto, cloud: s.cloud, s: s.stato, cifrato: s.cifrato, d: riassunto(), fatto: [...document.querySelectorAll('.ld-fatto b')].map(x => x.textContent).pop() })`) },
], { ...DD, LODE_VAULT: V2 });
const d10 = J(d1.ris[0]);
prova('D: la conferma dice la scelta della password e cosa resta in chiaro', d10?.onesto, d1.ris[0]);
prova('D: accende dalla scheda senza password, con il vault già nel cloud', d10?.cloud && d10.s === 'in_pari' && !d10.cifrato && d10.d.esami.includes('Economia:25') && /^Sincronizzato con/.test(d10.fatto || ''), d1.ris[0]);
const e1 = await avvia('E1', [
  { attesa: 2500, js: js(`const r = await window.lodeDesktop.invoca('sync:collega', { i: 0 }); await aspetta(async () => { await giro(); return __lode.D().esami.length; }, 30); await di('esame diritto il 9 marzo 6 cfu'); await w(2500); const s = await S(); return JSON.stringify({ r, s: s.stato, d: riassunto() })`) },
], { ...EE, LODE_VAULT: locale('B') });
const e10 = J(e1.ris[0]);
prova('E: si unisce senza password e riceve i dati di D', e10?.r?.esito === 'ok' && e10.s === 'in_pari' && e10.d.nome === 'Dario' && e10.d.esami.includes('Economia:25'), e1.ris[0]);
const d2 = await avvia('D2', [{ attesa: 2500, js: js(`await aspetta(async () => { await giro(); return __lode.D().esami.some(e => e.nome === 'Diritto'); }, 20); return JSON.stringify(riassunto())`) }], DD);
prova('D vede la modifica di E', /Diritto/.test(d2.ris[0] || ''), d2.ris[0]);

/* ---------- 7b. (giro 3) Con la password, sullo stesso vault già nel cloud, il cui gruppo è in chiaro ---------- */
// §10.2: chi accende con la password non entra mai in un gruppo in chiaro. Prima il main guardava solo «chiave_sbagliata»: G
// rispondeva «ok, giaDentro», la scheda diceva «Sincronizzato» e le modifiche di G si pubblicavano in chiaro
const GG = { LODE_DATI: dati('G'), LODE_MACCHINA: 'macchina-G', LODE_CLOUD: CLOUD2 };
const cartelleDev = () => { const g = (() => { try { return readdirSync(join(V2, '.lode', 'sync')).filter(x => !x.startsWith('.') && existsSync(join(V2, '.lode', 'sync', x, 'gruppo.json'))); } catch { return []; } })(); return g.flatMap(x => readdirSync(join(V2, '.lode', 'sync', x)).filter(d => !d.endsWith('.json') && !d.startsWith('.')).map(d => x + '/' + d)).sort().join(','); };
const devPrima = cartelleDev();
const g1 = await avvia('G1', [
  { attesa: 2500, js: js(`const c = await window.lodeDesktop.invoca('sync:cartelle'); const r = await window.lodeDesktop.invoca('sync:attiva', { i: c.cartelle[0].i, password: '${PW}' }); await w(6000); const s = await S(); return JSON.stringify({ r, acceso: s.acceso, cloud: s.cloud })`) },
], { ...GG, LODE_VAULT: V2 });
const g10 = J(g1.ris[0]);
prova('G: con la password su un gruppo in chiaro già nel cloud non entra (errore, spenta, nessuna cartella nuova nel gruppo)', g10?.r?.esito === 'errore' && /non è cifrato/.test(g10.r.errore || '') && !g10.acceso && cartelleDev() === devPrima && !existsSync(join(dati('G'), 'sync', 'corrente.json')), `${g1.ris[0]} · prima ${devPrima} · dopo ${cartelleDev()}`);

/* ---------- 8. Con la password, con il vault già nella cartella cloud ---------- */
const CLOUD3 = join(DIR, 'cloud3'), V3 = join(CLOUD3, 'Lode'), FF = { LODE_DATI: dati('F'), LODE_MACCHINA: 'macchina-F', LODE_CLOUD: CLOUD3 };
mkdirSync(join(V3, '.lode'), { recursive: true });
const datiF = { v: 1, profilo: { nome: 'Federica' }, esami: [{ id: 'q1', nome: 'Topologia', cfu: 6, voto: 29, fatto: true }], carte: [], orario: [], sessioni: [], benvenuto: true };
writeFileSync(join(V3, '.lode', 'dati.json'), JSON.stringify(datiF)); writeFileSync(join(V3, '.lode', 'dati.prev.json'), JSON.stringify(datiF));
const f1 = await avvia('F1', [
  { attesa: 2500, js: js(`const c = await window.lodeDesktop.invoca('sync:cartelle'); const r = await window.lodeDesktop.invoca('sync:attiva', { i: c.cartelle[0].i, password: '${PW}' }); await giro(); await w(1500); const s = await S(); return JSON.stringify({ r, s: s.stato, cifrato: s.cifrato, d: riassunto() })`) },
], { ...FF, LODE_VAULT: V3 });
const f10 = J(f1.ris[0]), inChiaroF = tutti(join(V3, '.lode')).filter(f => /Federica|Topologia/.test(leggi(f)));
prova('F: con la password e il vault già nel cloud accende sul posto, cifrato, con i dati', f10?.r?.esito === 'ok' && f10.r.giaDentro && f10.cifrato && f10.s === 'in_pari' && f10.d.esami.includes('Topologia:29'), f1.ris[0]);
prova('F: sotto .lode nella cartella cloud niente in chiaro (né eventi né dati.prev.json)', !inChiaroF.length && !existsSync(join(V3, '.lode', 'dati.prev.json')), inChiaroF.join(', '));

/* ---------- il testo unico: il README dice le stesse cose di js/sync-testi.js (#4 #23) ---------- */
const readme = leggi(join(QUI, '..', 'README.it.md'));   // il README italiano (README.md è in inglese)
prova('README: l\'elenco di cosa resta in chiaro coincide con js/sync-testi.js', IN_CHIARO.every(x => readme.includes(x)), IN_CHIARO.filter(x => !readme.includes(x)).join(' | '));

console.log(`\n${ok} prove passate, ${ko} fallite (cartella: ${DIR})`);
process.exit(ko ? 1 : 0);
