// Prova dell'app desktop con la sincronizzazione: due «computer» sulla stessa cartella cloud, senza toccare i tuoi dati.
//   node test/sincronizza-app.mjs
// Tutto in una cartella temporanea: la «cartella cloud» (LODE_CLOUD, solo in sviluppo: per la barra è una cartella cloud
// come le altre), le cartelle dati dei due computer (LODE_DATI), i vault (LODE_VAULT), la lista di Obsidian (LODE_OBSIDIAN_DIR).
//  1. Computer A: dati di esempio, un esame nuovo, poi «Sincronizza» → lo spostamento si interrompe a metà della copia
//     (LODE_FERMA_SPOSTAMENTO, come se saltasse la corrente) e Lode si chiude.
//  2. A riparte: lo spostamento interrotto si annulla, il vault di prima è intatto. Poi «Sincronizza» dalla barra (scheda e
//     conferma): copia, verifica, passaggio, la vecchia cartella resta come copia. Lo stato in «Prepara Lode».
//  3. A e B insieme: B fa «Uso già Lode su un altro computer», tutti e due cambiano cose (anche lo stesso campo), e alla fine
//     vedono lo stesso risultato. Nella cartella cloud: un file per computer, niente copie in conflitto, niente dati.json.
//  4. La sincronizzazione accesa sul posto mentre l'altro computer è aperto con dati.json.
//  5. Dati bloccati (Orario.md non si tocca, le modifiche aspettano anche dopo un riavvio), poi «Smetti di sincronizzare».
//  6. Vault cifrato: chi può solo scrivere nella cartella cloud (un segno dello stop finto, i file della sincronizzazione tolti)
//     non fa riscrivere i dati in chiaro in .lode/dati.json: Lode resta bloccata e lo dice.
// Niente AI, niente voce, niente microfono. Ogni Electron ha il suo cane da guardia (LODE_LIMITE_MIN, 6 minuti).
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as SY from '../desktop/sincronizza.mjs';

const QUI = dirname(fileURLToPath(import.meta.url)), DESKTOP = join(QUI, '..', 'desktop');
let ELECTRON; try { ELECTRON = createRequire(join(DESKTOP, 'package.json'))('electron'); } catch { }
if (!ELECTRON || !existsSync(ELECTRON)) { console.error('Prima: cd desktop && npm install'); process.exit(1); }
const DIR = mkdtempSync(join(tmpdir(), 'lode-sync-app-')), CLOUD = join(DIR, 'cloud'), OBS = join(DIR, 'obsidian');
const A_DATI = join(DIR, 'A-dati'), B_DATI = join(DIR, 'B-dati'), A_LOCALE = join(DIR, 'A-Documenti', 'Lode'), B_LOCALE = join(DIR, 'B-Documenti', 'Lode'), NUVOLA = join(CLOUD, 'Lode');
for (const d of [CLOUD, OBS]) mkdirSync(d, { recursive: true });
writeFileSync(join(OBS, 'obsidian.json'), JSON.stringify({ vaults: {} }));   // Obsidian «installato»: Lode ci registra il vault
const LIMITE = +process.env.LODE_LIMITE_MIN || 6, FOTO = process.env.LODE_FOTO || '';   // LODE_FOTO: le foto della barra (fuori dal repository)
if (FOTO) mkdirSync(FOTO, { recursive: true });
const foto = nome => FOTO ? { foto: nome } : {};
console.log('Cartella di prova:', DIR);

function avvia(nome, passi, env, ascolta = null) {
  const file = join(DIR, `passi-${nome}.json`); writeFileSync(file, JSON.stringify(passi));
  return new Promise(ok => {
    const p = spawn(ELECTRON, ['.'], { cwd: DESKTOP, env: { ...process.env, LODE_NON_APRIRE: '1', LODE_PROVA: file, LODE_ESCI: '1', LODE_OBSIDIAN_DIR: OBS, LODE_CLOUD: CLOUD, ...(FOTO ? { LODE_FOTO: FOTO } : {}), ...env } });
    let s = '', fatto = false;
    const eco = x => { s += x; ascolta?.(s); for (const r of String(x).split('\n')) if (r.trim()) process.stdout.write(`[${nome}] ${r}\n`); };
    // le risposte dei passi arrivano come JSON (main.mjs: JSON.stringify): una stringa torna testo semplice
    const testo = x => { try { const v = JSON.parse(x); return typeof v === 'string' ? v : JSON.stringify(v); } catch { return x; } };
    const fine = codice => { if (fatto) return; fatto = true; clearTimeout(cane); ok({ out: s, codice, ris: Object.fromEntries([...s.matchAll(/^passo (\d+)(?: errore)?: (.*)$/gm)].map(m => [+m[1], testo(m[2])])) }); };
    p.stdout.on('data', eco); p.stderr.on('data', eco);
    const cane = setTimeout(() => { eco(`CANE DA GUARDIA: ${nome} fermato dopo ${LIMITE} minuti\n`); if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); else p.kill('SIGKILL'); setTimeout(() => fine(null), 3000); }, LIMITE * 60e3);
    p.on('exit', c => setTimeout(() => fine(c), 1500)); p.on('error', e => { eco(`Electron non parte: ${e.message}\n`); fine(null); });
  });
}
let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { cond ? ok++ : ko++; console.log(`${cond ? '✓' : '✗'} ${nome}${cond ? '' : `\n    ${String(dett).slice(0, 600)}`}`); };
const passo = (r, i, atteso, nome) => prova(nome, (r.ris[i] ?? '').includes(atteso), `atteso «${atteso}», arrivato: ${r.ris[i] ?? '(nessuna risposta)'}`);
const leggi = f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
// helper dentro la barra (ogni passo li rifà: dopo un ricaricamento della pagina spariscono)
const H = `const w = ms => new Promise(r => setTimeout(r, ms)); const aspetta = async (f, sec = 30) => { const t0 = Date.now(); for (;;) { let r; try { r = await f(); } catch { } if (r || Date.now() - t0 > sec * 1000) return r; await w(400); } };
  const riassunto = () => { const D = __lode.D(); return JSON.stringify({ esami: D.esami.map(e => e.nome + ':' + (e.voto ?? '-')).sort(), carte: D.carte.length, sessioni: D.sessioni.length, orario: D.orario.map(o => o.corso + ' ' + o.inizio).sort(), proposte: D.imp.allenatore || null, nome: D.profilo.nome, memoria: Object.keys(D.memoria).length }); };
  const apri = async () => { if (!__lode.stato().aperto) { document.querySelector('.ld-pill')?.click(); await w(700); } };
  const di = async t => { await apri(); __lode.invia(t); await w(2500); };`;
const nomi = `__lode.D().esami.map(e => e.nome).join(',')`;

/* ---------- 1. A: lo spostamento si interrompe a metà ---------- */
const r1 = await avvia('A1', [
  { attesa: 3500, js: `(async()=>{ ${H} dispatchEvent(new CustomEvent('lode:esempio')); await w(1500); await di('esame statistica tra 20 giorni 6 cfu'); return ${nomi} })()` },
  { attesa: 500, js: `(async()=>{ const c = await window.lodeDesktop.invoca('sync:cartelle'); const i = c.find(x => x.servizio === 'Cartella di prova')?.i; window.lodeDesktop.invoca('sync:attiva', { i }); return 'avviato ' + i })()` },
  { attesa: 15000, js: '"non doveva arrivare qui"' },
], { LODE_DATI: A_DATI, LODE_VAULT: A_LOCALE, LODE_FERMA_SPOSTAMENTO: 'meta-copia' });
passo(r1, 0, 'Statistica', 'A: dati di esempio e un esame nuovo');
prova('A: lo spostamento si interrompe a metà della copia e Lode si chiude', r1.out.includes('LODE-INTERROTTO') && r1.codice === 3, `codice ${r1.codice}`);
prova('A: dopo l\'interruzione il vault di prima è intatto (dati.json con l\'esame nuovo)', /Statistica/.test(leggi(join(A_LOCALE, '.lode', 'dati.json'))) && existsSync(join(A_LOCALE, 'Home.md')));
prova('A: il registro di bordo dice «copia» e la copia a metà è nella cartella cloud', /"fase": "copia"/.test(leggi(join(A_DATI, 'spostamento.json'))) && readdirSync(CLOUD).some(x => x.startsWith('Lode.copia-in-corso-')), readdirSync(CLOUD).join());

/* ---------- 2. A riparte, poi sincronizza dalla barra ---------- */
const r2 = await avvia('A2', [
  { attesa: 3500, js: `(async()=>{ const s = await window.lodeDesktop.invoca('sync:stato'); return JSON.stringify({ attiva: s.attiva, statistica: __lode.D().esami.some(e => e.nome === 'Statistica') }) })()` },
  { nome: 'attiva', attesa: 800, js: `(async()=>{ ${H} await di('sincronizza fra i computer');
    const b = await aspetta(() => [...document.querySelectorAll('.ld-sync [data-cloud]')].find(x => x.innerText.includes('Cartella di prova')), 15); if (!b) return 'nessuna scheda: ' + document.querySelector('.ld-filo')?.innerText.slice(-300);
    b.click(); const c = await aspetta(() => [...document.querySelectorAll('.ld-conf')].pop(), 10); if (!c) return 'nessuna conferma';
    const t = c.querySelector('h3').textContent; c.querySelector('[data-ld=si]').click(); return 'confermato: ' + t })()` },
  { attesa: 9000, js: `(async()=>{ const s = await window.lodeDesktop.invoca('sync:stato'), D = __lode.D(); return JSON.stringify({ attiva: s.attiva, servizio: s.servizio, nellaNuvola: /cloud/.test(s.vault), statistica: D.esami.some(e => e.nome === 'Statistica'), rev: typeof D.__rev }) })()` },
  { ...foto('prepara-sincronizzato.png'), attesa: 800, js: `(async()=>{ ${H} await di('prepara'); const r = await aspetta(() => document.querySelector('.ld-prepara .ld-prep[data-k="sync"] .d')?.textContent, 10); return r || 'nessuna riga' })()` },
  { attesa: 500, js: `(async()=>{ ${H} await di('esame algebra tra 30 giorni 6 cfu'); await w(2000); return ${nomi} })()` },
  { attesa: 1500, js: '1' },
], { LODE_DATI: A_DATI, LODE_VAULT: A_LOCALE });
passo(r2, 0, '{"attiva":false,"statistica":true}', 'A riparte: lo spostamento interrotto si annulla, i dati ci sono');
prova('A riparte: niente copie a metà nella cartella cloud, registro di bordo tolto', r2.out.includes('spostamento del vault ripreso: annullato') && !readdirSync(CLOUD).some(x => x.includes('copia-in-corso')) && !existsSync(join(A_DATI, 'spostamento.json')), readdirSync(CLOUD).join());
passo(r2, 1, 'confermato: Sincronizzare con Cartella di prova?', 'A: «Sincronizza» dalla barra, con la scheda di conferma');
passo(r2, 2, '{"attiva":true,"servizio":"Cartella di prova","nellaNuvola":true,"statistica":true,"rev":"number"}', 'A: vault nella cartella cloud, dati migrati, la barra ricaricata');
passo(r2, 3, 'Sincronizzato con Cartella di prova', 'A: lo stato in «Prepara Lode»');
passo(r2, 4, 'Algebra', 'A: un esame nuovo dopo la sincronizzazione');
const confA = JSON.parse(leggi(join(A_DATI, 'config.json')) || '{}'), idA = confA.sincronizzazione?.dispositivo;
prova('A: config.json punta al vault nella cartella cloud, l\'id del computer è lì (non nel vault)', resolve(confA.vault || '') === resolve(NUVOLA) && /^[0-9a-f]{16}$/.test(idA || '') && !leggi(join(NUVOLA, '.lode', 'sincronizzazione.json')).includes(idA), JSON.stringify(confA));
prova('A: la vecchia cartella resta come «Lode (copia prima della sincronizzazione)»', !existsSync(A_LOCALE) && /Statistica/.test(leggi(join(DIR, 'A-Documenti', 'Lode (copia prima della sincronizzazione)', '.lode', 'dati.json'))));
prova('A: nella cartella cloud il file di A, dati.json migrato, copia di sicurezza sul computer', existsSync(join(NUVOLA, '.lode', 'dispositivi', idA + '.json')) && !existsSync(join(NUVOLA, '.lode', 'dati.json')) && readdirSync(join(NUVOLA, '.lode')).some(n => /^dati\.migrato-/.test(n)) && readdirSync(join(A_DATI, 'copie')).some(n => /prima-della-sincronizzazione/.test(n)));
const obs = JSON.parse(leggi(join(OBS, 'obsidian.json')) || '{}');
prova('A: nella lista di Obsidian lo stesso vault ha il percorso nuovo', Object.values(obs.vaults || {}).length === 1 && resolve(Object.values(obs.vaults)[0].path) === resolve(NUVOLA), JSON.stringify(obs));

/* ---------- 3. A e B insieme ---------- */
const FINE = `(async()=>{ ${H} await w(6000); return 'FINE ' + riassunto() })()`;
const [a3, b3] = await Promise.all([
  avvia('A3', [
    { attesa: 3500, js: `(async()=>{ return ${nomi} })()` },
    { attesa: 4000, js: `(async()=>{ ${H} await di('proposte frequenti'); await di('esame geometria tra 40 giorni 9 cfu'); return ${nomi} + ' | ' + __lode.D().imp.allenatore })()` },
    { attesa: 500, js: `(async()=>{ ${H} const r = await aspetta(() => __lode.D().esami.some(e => e.nome === 'Fisica tecnica') && __lode.D().imp.allenatore === 'poco', 150); return (r ? 'visto B' : 'NON visto B') + ' | ' + ${nomi} })()` },
    { attesa: 500, js: FINE },
    { ...foto('scheda-sincronizza.png'), attesa: 500, js: `(async()=>{ ${H} await di('sincronizza'); return document.querySelector('.ld-sync .ld-sync-stato')?.innerText || 'nessuna scheda' })()` },
    // la password: A cifra i dati di Lode, poi aggiunge un esame
    { attesa: 3000, js: `(async()=>{ ${H} const r = await window.lodeDesktop.invoca('sync:cifra', { password: 'password di prova lunga', ricorda: false }); await di('esame ottica tra 50 giorni 6 cfu'); const s = await window.lodeDesktop.invoca('sync:stato'); return r.esito + ' | cifrata ' + s.cifrata + ' | ' + ${nomi} })()` },
    // l'esame che B aggiunge mentre è bloccata (la password è arrivata da A con B aperta) arriva anche qui, dopo lo sblocco
    { attesa: 500, js: `(async()=>{ ${H} const c = await aspetta(() => __lode.D().esami.some(e => e.nome === 'Chimica organica'), 150); return c ? 'Chimica organica arrivata' : 'Chimica organica NO' })()` },
    { attesa: 1500, js: '1' },
  ], { LODE_DATI: A_DATI, LODE_VAULT: NUVOLA }),
  avvia('B3', [
    { attesa: 3500, js: `(async()=>{ const c = await window.lodeDesktop.invoca('sync:cartelle'); const x = c.find(x => x.servizio === 'Cartella di prova'), v = x?.vaults.find(v => v.nome === 'Lode'); window.lodeDesktop.invoca('sync:collega', { i: x?.i, j: v?.j }); return 'collego ' + JSON.stringify(v) })()` },
    { attesa: 8000, js: `(async()=>{ ${H} const s = await window.lodeDesktop.invoca('sync:stato'); await di('esame chimica tra 35 giorni 6 cfu'); return JSON.stringify({ attiva: s.attiva, servizio: s.servizio }) + ' | ' + ${nomi} })()` },
    { attesa: 500, js: `(async()=>{ ${H} const r = await aspetta(() => __lode.D().esami.some(e => e.nome === 'Geometria') && __lode.D().imp.allenatore === 'spesso', 150); await di('esame fisica tecnica tra 25 giorni 6 cfu'); await di('proposte poche'); return (r ? 'visto A' : 'NON visto A') + ' | ' + ${nomi} })()` },
    { attesa: 500, js: FINE },
    // B si accorge che i dati sono cifrati, si blocca e la barra lo dice (anche se era già aperta); B aggiunge un esame mentre è
    // bloccata; la password sbagliata non apre, quella giusta sì: arriva «Ottica» e l'esame fatto intanto resta
    { attesa: 500, js: `(async()=>{ ${H} const b = await aspetta(async () => (await window.lodeDesktop.invoca('sync:stato')).bloccata, 90); if (!b) return 'non bloccato';
      await w(1200); await apri(); await __lode.indietro(); const avviso = await aspetta(() => document.body.innerText.includes('protetti da una password'), 10);
      await di('esame chimica organica tra 45 giorni 6 cfu');
      const no = await window.lodeDesktop.invoca('sync:sblocca', { password: 'sbagliata sbagliata', ricorda: false }); const si = await window.lodeDesktop.invoca('sync:sblocca', { password: 'password di prova lunga', ricorda: false });
      const o = await aspetta(() => __lode.D().esami.some(e => e.nome === 'Ottica'), 60), c = await aspetta(() => __lode.D().esami.some(e => e.nome === 'Chimica organica'), 20);
      return 'bloccato | avviso ' + !!avviso + ' | sbagliata: ' + no.errore + ' | giusta: ' + si.esito + ' | ' + (o ? 'Ottica arrivata' : 'Ottica NO') + ' | ' + (c ? 'Chimica organica resta' : 'Chimica organica NO') })()` },
    { attesa: 4000, js: '1' },   // il file di B (cifrato) parte prima dell'uscita
  ], { LODE_DATI: B_DATI, LODE_VAULT: B_LOCALE }),
]);
passo(a3, 0, 'Algebra', 'A riparte sul vault nella cartella cloud: i suoi dati ci sono');
passo(b3, 0, '"sincronizzato":true', 'B: trova il vault di Lode nella cartella cloud');
passo(b3, 1, '{"attiva":true,"servizio":"Cartella di prova"} | ', 'B: «Uso già Lode su un altro computer»: collegato');
prova('B: arrivano i dati di A (esempio, Statistica, Algebra)', ['Statistica', 'Algebra', 'Analisi 2'].every(n => (b3.ris[1] || '').includes(n)), b3.ris[1]);
passo(b3, 2, 'visto A', 'B vede le modifiche fatte da A mentre B lavorava');
passo(a3, 2, 'visto B', 'A vede le modifiche fatte da B mentre A lavorava');
const fa = (a3.ris[3] || '').replace(/^FINE /, ''), fb = (b3.ris[3] || '').replace(/^FINE /, '');
prova('alla fine A e B vedono lo stesso risultato', fa && fa === fb, `A: ${fa}\n    B: ${fb}`);
let finale = {}; try { finale = JSON.parse(fa); } catch { }
prova('… con le modifiche di tutti e due, e lo stesso campo deciso nello stesso modo (l\'ultima: «proposte poche»)', ['Statistica', 'Algebra', 'Geometria', 'Chimica', 'Fisica tecnica'].every(n => finale.esami?.some(e => e.startsWith(n + ':'))) && finale.proposte === 'poco' && finale.carte > 0 && finale.sessioni > 0, fa);
const confB = JSON.parse(leggi(join(B_DATI, 'config.json')) || '{}'), idB = confB.sincronizzazione?.dispositivo;
const disp = existsSync(join(NUVOLA, '.lode', 'dispositivi')) ? readdirSync(join(NUVOLA, '.lode', 'dispositivi')).sort() : [];
prova('nella cartella cloud: un file per computer, niente copie in conflitto, niente dati.json', idB && idB !== idA && disp.join() === [idA, idB].sort().map(x => x + '.json').join() && !existsSync(join(NUVOLA, '.lode', 'dati.json')) && !existsSync(join(NUVOLA, '.lode', 'conflitti-risolti')), disp.join());
prova('B: il vault che aveva prima resta dov\'era', existsSync(join(B_LOCALE, 'Home.md')) && resolve(confB.vault || '') === resolve(NUVOLA));
const tutto = disp.map(f => leggi(join(NUVOLA, '.lode', 'dispositivi', f))).join('');
prova('privacy: niente chiavi AI né percorsi delle cartelle dati nei file del vault', !/sk-|A-dati|B-dati/.test(tutto));
passo(a3, 4, 'ultimo arrivo dall\'altro computer alle', 'A: la scheda «Sincronizza»: «Sincronizzato con … · ultimo arrivo dall\'altro computer alle …»');
passo(a3, 5, 'ok | cifrata true | ', 'A: «Proteggi con una password»: i dati di Lode cifrati');
passo(b3, 4, 'bloccato | avviso true | sbagliata: Password sbagliata. | giusta: ok | Ottica arrivata | Chimica organica resta', 'B: si blocca da solo e la barra già aperta lo dice; la password sbagliata non apre, quella giusta sì; arriva l\'esame nuovo e quello fatto da bloccata resta');
passo(a3, 6, 'Chimica organica arrivata', 'A: l\'esame che B ha aggiunto mentre era bloccata arriva anche ad A (non resta solo nel file di recupero)');
prova('cifratura: nel vault niente esami in chiaro, niente dati*.json, cifratura.json con scrypt', disp.length === 2 && disp.every(f => JSON.parse(leggi(join(NUVOLA, '.lode', 'dispositivi', f)) || '{}').cifrato) && !/Analisi|Ottica|Statistica/.test(tutto) && !readdirSync(join(NUVOLA, '.lode')).some(n => /^dati/.test(n)) && JSON.parse(leggi(join(NUVOLA, '.lode', 'cifratura.json')) || '{}').N === 2 ** 17, readdirSync(join(NUVOLA, '.lode')).join());
prova('cifratura: la password non è da nessuna parte (vault e configurazioni)', ![tutto, leggi(join(NUVOLA, '.lode', 'cifratura.json')), leggi(join(A_DATI, 'config.json')), leggi(join(B_DATI, 'config.json'))].some(t => t.includes('password di prova lunga')));

/* ---------- 4. la sincronizzazione si accende sul posto mentre l'altro computer è aperto con dati.json ---------- */
// «Documenti» già nella cartella cloud: C accende la sincronizzazione sul posto, D è aperto sullo stesso vault e scrive ancora
// dati.json. D deve accorgersene da solo e passare al suo file; le modifiche di C dopo la migrazione (il 30, le proposte) non
// devono tornare indietro, e quella di D (un esame) deve arrivare a C
const C_DATI = join(DIR, 'C-dati'), D_DATI = join(DIR, 'D-dati'), SUL_POSTO = join(CLOUD, 'Documenti', 'Lode');
mkdirSync(join(SUL_POSTO, '.lode'), { recursive: true });
writeFileSync(join(SUL_POSTO, '.lode', 'dati.json'), JSON.stringify({ v: 1, profilo: { nome: 'Ada', corso: 'Fisica', cfuTotali: 180, lode: 30 }, benvenuto: true,
  esami: [{ id: 'f1', nome: 'Fisica 1', cfu: 9, data: '2026-12-15', voto: null, lode: false, idoneita: false, fatto: false }, { id: 'a1', nome: 'Analisi 1', cfu: 9, data: '2026-11-20', voto: null, lode: false, idoneita: false, fatto: false }],
  sessioni: [], carte: [], orario: [], lezioni: [], memoria: {}, imp: { focus: 25, pausa: 5, aspetto: 'scuro', suoni: true, suggerimenti: true, ultimoSuggerimento: 0 } }));
const FINE4 = `(async()=>{ ${H} await w(5000); const D = __lode.D(); return 'FINE ' + JSON.stringify({ esami: D.esami.map(e => e.nome + ':' + (e.voto ?? '-')).sort(), proposte: D.imp.allenatore || null, nome: D.profilo.nome }) })()`;
const [c4, d4] = await Promise.all([
  avvia('C4', [
    { attesa: 3500, js: `(async()=>{ return ${nomi} })()` },
    { attesa: 1500, js: `(async()=>{ const c = await window.lodeDesktop.invoca('sync:cartelle'); const i = c.find(x => x.servizio === 'Cartella di prova')?.i; window.lodeDesktop.invoca('sync:attiva', { i }); return 'avviato ' + i })()` },
    { attesa: 8000, js: `(async()=>{ ${H} const s = await window.lodeDesktop.invoca('sync:stato'); await di('ho preso 30 in fisica 1'); await di('proposte frequenti'); return 'attiva ' + s.attiva + ' | ' + __lode.D().esami.map(e => e.nome + ':' + (e.voto ?? '-')).join(',') + ' | ' + __lode.D().imp.allenatore })()` },
    { attesa: 500, js: `(async()=>{ ${H} const r = await aspetta(() => __lode.D().esami.some(e => e.nome === 'Geometria'), 120); await di('proposte poche'); return r ? 'visto D' : 'NON visto D' })()` },
    { attesa: 500, js: FINE4 },
  ], { LODE_DATI: C_DATI, LODE_VAULT: SUL_POSTO }),
  avvia('D4', [
    { attesa: 3500, js: `(async()=>{ const s = await window.lodeDesktop.invoca('sync:stato'); return 'attiva ' + s.attiva + ' | ' + ${nomi} })()` },
    { attesa: 9000, js: `(async()=>{ ${H} const p = await aspetta(async () => (await window.lodeDesktop.invoca('sync:stato')).attiva && typeof __lode.D().__rev === 'number', 60); await di('esame geometria tra 40 giorni 9 cfu'); return (p ? 'passato al suo file' : 'ancora dati.json') + ' | ' + ${nomi} })()` },
    { attesa: 500, js: `(async()=>{ ${H} const r = await aspetta(() => __lode.D().esami.some(e => e.nome === 'Fisica 1' && e.voto === 30) && __lode.D().imp.allenatore === 'poco', 150); return r ? 'visto C' : 'NON visto C: ' + JSON.stringify(__lode.D().esami) + __lode.D().imp.allenatore })()` },
    { attesa: 500, js: FINE4 },
  ], { LODE_DATI: D_DATI, LODE_VAULT: SUL_POSTO }),
]);
passo(c4, 2, 'attiva true', 'C: sincronizzazione accesa sul posto (vault già nella cartella cloud)');
passo(d4, 0, 'attiva false', 'D: aperto sullo stesso vault, ancora con dati.json');
passo(d4, 1, 'passato al suo file', 'D: si accorge da solo che la sincronizzazione è accesa e passa al file del computer');
passo(c4, 3, 'visto D', 'C vede l\'esame aggiunto da D');
passo(d4, 2, 'visto C', 'D vede il 30 e le proposte di C (niente torna indietro)');
const fc = (c4.ris[4] || '').replace(/^FINE /, ''), fd = (d4.ris[3] || '').replace(/^FINE /, '');
prova('C e D alla fine vedono lo stesso: il 30 di C, l\'esame di D, «proposte poche», il nome', fc && fc === fd && /Fisica 1:30/.test(fc) && /Geometria/.test(fc) && /"proposte":"poco"/.test(fc) && /"nome":"Ada"/.test(fc), `C: ${fc}\n    D: ${fd}`);
const disp4 = existsSync(join(SUL_POSTO, '.lode', 'dispositivi')) ? readdirSync(join(SUL_POSTO, '.lode', 'dispositivi')) : [];
prova('sul posto: un file per computer, niente dati.json rimasto né copie in conflitto', disp4.length === 2 && !existsSync(join(SUL_POSTO, '.lode', 'dati.json')) && !existsSync(join(SUL_POSTO, '.lode', 'conflitti-risolti')), readdirSync(join(SUL_POSTO, '.lode')).join() + ' / ' + disp4.join());

/* ---------- 5. dati bloccati, poi «Smetti di sincronizzare» ---------- */
// A riparte bloccata (password non ricordata): Orario.md non si tocca, un esame aggiunto intanto aspetta su disco e, dopo un
// riavvio, entra allo sblocco. Poi A e B insieme: A smette dalla barra, B se ne accorge e smette anche lui; un esame aggiunto
// su B dopo (in dati.json) arriva ad A. Alla fine: dati.json con tutto, archivio nel vault, copia di sicurezza sul computer
const PW = 'password di prova lunga', orarioPrima = leggi(join(NUVOLA, 'Orario.md'));
const a5 = await avvia('A5', [
  { attesa: 4000, js: `(async()=>{ ${H} const s = await window.lodeDesktop.invoca('sync:stato'); const o = await window.lodeDesktop.invoca('vault:scrivi', { file: 'Orario.md', testo: '# vuoto' }).catch(e => 'errore ' + e.message); await di('esame anatomia tra 20 giorni 6 cfu'); await w(1500); return 'bloccata ' + s.bloccata + ' | orario scritto ' + o + ' | ' + ${nomi} })()` },
  { attesa: 1500, js: '1' },
], { LODE_DATI: A_DATI, LODE_VAULT: NUVOLA });
passo(a5, 0, 'bloccata true | orario scritto false | Anatomia', 'A riparte bloccata: Orario.md non si riscrive, l\'esame nuovo resta nella barra');
prova('A bloccata: Orario.md nel vault com\'era, le modifiche in attesa salvate su disco', leggi(join(NUVOLA, 'Orario.md')) === orarioPrima && /Anatomia/.test(leggi(join(A_DATI, 'sincronizzazione', 'in-attesa.json'))));
const [a6, b6] = await Promise.all([
  avvia('A6', [
    { attesa: 3500, js: `(async()=>{ ${H} const r = await window.lodeDesktop.invoca('sync:sblocca', { password: '${PW}', ricorda: false }); const a = await aspetta(() => __lode.D().esami.some(e => e.nome === 'Anatomia'), 20); return r.esito + ' | ' + (a ? 'Anatomia c\\'è' : 'Anatomia NO') + ' | ' + ${nomi} })()` },
    { ...foto('smetti.png'), attesa: 7000, js: `(async()=>{ ${H} await di('smetti di sincronizzare'); const c = await aspetta(() => [...document.querySelectorAll('.ld-conf')].pop(), 10); if (!c) return 'nessuna conferma: ' + document.querySelector('.ld-filo')?.innerText.slice(-300);
      const t = c.querySelector('h3').textContent; c.querySelector('[data-ld=si]').click(); const s = await aspetta(async () => { const x = await window.lodeDesktop.invoca('sync:stato'); return !x.attiva && x; }, 20); await w(1500);
      return t + ' | attiva ' + (s ? s.attiva : '?') + ' | ' + ${nomi} })()` },
    { attesa: 500, js: `(async()=>{ ${H} const b = await aspetta(() => __lode.D().esami.some(e => e.nome === 'Biologia'), 120); return (b ? 'Biologia arrivata' : 'Biologia NO') + ' | ' + ${nomi} })()` },
    { attesa: 1500, js: '1' },
  ], { LODE_DATI: A_DATI, LODE_VAULT: NUVOLA }),
  avvia('B6', [
    { attesa: 3500, js: `(async()=>{ const r = await window.lodeDesktop.invoca('sync:sblocca', { password: '${PW}', ricorda: false }); return r.esito })()` },
    { attesa: 500, js: `(async()=>{ ${H} const s = await aspetta(async () => { const x = await window.lodeDesktop.invoca('sync:stato'); return !x.attiva && x; }, 150); await w(2000); return (s ? 'smesso ' + JSON.stringify(s.spenta) : 'ancora accesa') + ' | ' + ${nomi} })()` },
    { attesa: 500, js: `(async()=>{ ${H} await di('esame biologia tra 30 giorni 6 cfu'); await w(2500); return ${nomi} })()` },
    { attesa: 4000, js: '1' },
  ], { LODE_DATI: B_DATI, LODE_VAULT: NUVOLA }),
]);
passo(a6, 0, 'ok | Anatomia c\'è', 'A dopo un riavvio: allo sblocco entra l\'esame aggiunto coi dati bloccati');
passo(a6, 1, 'Smettere di sincronizzare? | attiva false', 'A: «Smetti di sincronizzare» dalla barra, con la conferma');
passo(b6, 0, 'ok', 'B: sbloccata con la password');
prova('B se ne accorge da sola e smette anche lei, con tutti gli esami', /^smesso /.test(b6.ris[1] || '') && ['Anatomia', 'Ottica', 'Chimica organica', 'Statistica', 'Geometria'].every(n => (b6.ris[1] || '').includes(n)), b6.ris[1]);
passo(a6, 2, 'Biologia arrivata', 'A: l\'esame aggiunto su B dopo lo stop (in dati.json) arriva anche ad A');
const fin = (() => { try { return JSON.parse(leggi(join(NUVOLA, '.lode', 'dati.json'))); } catch { return {}; } })(), lodeDir = readdirSync(join(NUVOLA, '.lode'));
prova('smesso: dati.json con gli esami di tutti e due, niente segno né cifratura, archivio nel vault', ['Anatomia', 'Ottica', 'Chimica organica', 'Biologia', 'Statistica'].every(n => fin.esami?.some(e => e.nome === n)) && !lodeDir.includes('sincronizzazione.json') && !lodeDir.includes('cifratura.json') && !lodeDir.includes('dispositivi') && lodeDir.includes('sincronizzazione-spenta.json') && lodeDir.some(n => /^sincronizzazione-spenta-\d+$/.test(n)), lodeDir.join() + ' / ' + (fin.esami || []).map(e => e.nome).join());
prova('smesso: copia di sicurezza su A, modifiche in attesa archiviate', readdirSync(join(A_DATI, 'copie')).some(n => /^sincronizzazione-spenta-/.test(n)) && !existsSync(join(A_DATI, 'sincronizzazione', 'in-attesa.json')));

/* ---------- 6. vault cifrato: un segno dello stop finto, poi i file della sincronizzazione tolti ---------- */
const E_DATI = join(DIR, 'E-dati'), CIF = join(CLOUD, 'Cifrato', 'Lode'), PW6 = 'password del vault cifrato';
mkdirSync(join(CIF, '.lode'), { recursive: true });
writeFileSync(join(CIF, '.lode', 'dati.json'), JSON.stringify({ v: 1, profilo: { nome: 'Ada', corso: 'Fisica', cfuTotali: 180, lode: 30 }, benvenuto: true,
  esami: [{ id: 'z1', nome: 'ZebraSegreta', cfu: 6, data: '2026-12-15', voto: null, lode: false, idoneita: false, fatto: false }], sessioni: [],
  carte: [{ id: 'k1', esameId: 'z1', fronte: 'FronteSegreto', retro: 'r', ease: 2.5, int: 0, rip: 0, scad: '2026-10-09', creata: 1 }], orario: [], lezioni: [], memoria: {}, imp: { focus: 25, pausa: 5, aspetto: 'scuro', suoni: true, suggerimenti: true, ultimoSuggerimento: 0 } }));
SY.segna(CIF);
const segreti = () => { let t = ''; const giro = d => { let l = []; try { l = readdirSync(d, { withFileTypes: true }); } catch { } for (const n of l) { const p = join(d, n.name); if (n.isDirectory()) giro(p); else t += leggi(p); } }; giro(join(CIF, '.lode')); return /ZebraSegreta|FronteSegreto/.test(t); };
const fermo = ms => new Promise(r => setTimeout(r, ms));
const finche = async (f, sec) => { const t0 = Date.now(); while (Date.now() - t0 < sec * 1000) { if (f()) return true; await fermo(500); } return false; };
let uscita6 = '';
const e6p = avvia('E6', [
  { attesa: 3500, js: `(async()=>{ const r = await window.lodeDesktop.invoca('sync:cifra', { password: '${PW6}', ricorda: false }); return r.esito + ' | ' + ${nomi} })()` },
  { attesa: 500, js: `(async()=>{ ${H} const s = await aspetta(async () => { const x = await window.lodeDesktop.invoca('sync:stato'); return x.bloccata && x; }, 90); return s ? 'bloccata ' + s.codice : 'NON bloccata' })()` },
  { attesa: 500, js: `(async()=>{ ${H} await aspetta(async () => (await window.lodeDesktop.invoca('sync:stato')).attiva, 90); const r = await window.lodeDesktop.invoca('sync:sblocca', { password: '${PW6}', ricorda: false }); await w(1500); return r.esito + ' | ' + ${nomi} })()` },
  { attesa: 500, js: `(async()=>{ ${H} const s = await aspetta(async () => { const x = await window.lodeDesktop.invoca('sync:stato'); return x.bloccata && x; }, 90); return s ? 'bloccata ' + s.codice : 'NON bloccata' })()` },
  { attesa: 1500, js: '1' },
], { LODE_DATI: E_DATI, LODE_VAULT: CIF }, x => { uscita6 = x; });
const cifratoE = await finche(() => existsSync(SY.fileCifratura(CIF)) && (() => { try { return readdirSync(join(CIF, '.lode', 'dispositivi')).some(n => /^[0-9a-f]{16}\.json$/.test(n) && leggi(join(CIF, '.lode', 'dispositivi', n)).includes('"cifrato"')); } catch { return false; } })(), 90);
const chiaroPrima = segreti();
// fase 1: il segno della sincronizzazione tolto e uno stop finto (senza la prova fatta con la chiave)
const segno6 = leggi(SY.fileSegno(CIF)); rmSync(SY.fileSegno(CIF)); writeFileSync(SY.fileSpenta(CIF), JSON.stringify({ v: 1, spenta: new Date().toISOString(), da: 'cccccccccccccccc', archivio: 'niente' }));
await finche(() => /passo 1:/.test(uscita6), 100); await fermo(3000);
const chiaroFinto = segreti() || existsSync(join(CIF, '.lode', 'dati.json'));
rmSync(SY.fileSpenta(CIF)); writeFileSync(SY.fileSegno(CIF), segno6);
// fase 2: dopo lo sblocco, segno, cifratura.json e file dei computer tolti dalla cartella (senza uno stop)
await finche(() => /passo 2:/.test(uscita6), 120); await fermo(2000);
for (const n of ['sincronizzazione.json', 'cifratura.json', 'dispositivi']) rmSync(join(CIF, '.lode', n), { recursive: true, force: true });
await finche(() => /passo 3:/.test(uscita6), 120); await fermo(3000);
const chiaroTolti = segreti() || existsSync(join(CIF, '.lode', 'dati.json'));
const e6 = await e6p;
passo(e6, 0, 'ok | ZebraSegreta', 'E: cifratura accesa dalla barra');
prova('E: cifrato, in .lode nessun dato in chiaro', cifratoE && !chiaroPrima, readdirSync(join(CIF, '.lode')).join());
passo(e6, 1, 'bloccata spenta_sospetta', 'E: segno dello stop finto (senza la prova della chiave): resta bloccata');
prova('E: con lo stop finto niente dati.json in chiaro nella cartella cloud', !chiaroFinto, readdirSync(join(CIF, '.lode')).join());
passo(e6, 2, 'ok | ZebraSegreta', 'E: segno rimesso, con la password si riapre');
passo(e6, 3, 'bloccata cifratura_sparita', 'E: segno, cifratura.json e file dei computer tolti: resta bloccata');
prova('E: con i file della sincronizzazione tolti niente dati.json in chiaro', !chiaroTolti, readdirSync(join(CIF, '.lode')).join());

if (!process.env.LODE_TIENI) try { rmSync(DIR, { recursive: true, force: true }); } catch { }
console.log(`\n${ok} passate, ${ko} fallite`);
console.log('SINCRONIZZA-APP FINE');
process.exit(ko ? 1 : 0);
