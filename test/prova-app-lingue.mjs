// L'app desktop in inglese e in tedesco, su dati e vault temporanei nuovi (non tocca i tuoi dati):
//   node test/prova-app-lingue.mjs            (LODE_FOTO=cartella per le foto delle finestre)
// Per ogni lingua un avvio pulito con LODE_LINGUA: il benvenuto (scelta della lingua, «Ciao», nome, la pagina delle
// installazioni senza installare niente), il vault nuovo con le cartelle e le note nella lingua giusta (js/nomi.js), due
// comandi nella barra senza AI (focus e un esame con data e crediti), il quadro, poi il cambio di lingua con il comando
// della barra: tutte le finestre si ricaricano nella lingua nuova, il vault tiene i suoi nomi.
// Niente rete e niente AI: la pagina delle installazioni si guarda e basta. Gli stessi agganci di test/prova-app.mjs
// (LODE_PROVA, un passo per volta nella barra) più LODE_PROVA_BENVENUTO e i passi con «finestra» (desktop/main.mjs).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url)), RADICE = join(QUI, '..'), DESKTOP = join(RADICE, 'desktop');
let ELECTRON; try { ELECTRON = createRequire(join(DESKTOP, 'package.json'))('electron'); } catch { }
if (!ELECTRON || !existsSync(ELECTRON)) { console.error('Prima: cd desktop && npm install'); process.exit(1); }
const FOTO = process.env.LODE_FOTO || '';
if (FOTO) mkdirSync(FOTO, { recursive: true });
const LIMITE = +process.env.LODE_LIMITE_MIN || 10;
const { nomiDi } = await import(pathToFileURL(join(RADICE, 'js', 'nomi.js')).href);
const cat = async (cod, area) => (await import(pathToFileURL(join(RADICE, 'js', 'lingue', cod, area + '.js')).href)).default;
const A = v => JSON.stringify(v);
const senzaHtml = s => s.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

// le frasi di ogni lingua: il comando della barra e la lingua in cui si passa
const LINGUE = {
  en: { focus: 'focus 25', esame: 'exam databases on 15 January 6 credits', corso: 'Databases', cambia: 'language german', verso: 'de', focusDopo: 'Fokus 25' },
  de: { focus: 'Fokus 25', esame: 'Prüfung Datenbanken am 15. Januar 6 ECTS', corso: 'Datenbanken', cambia: 'Sprache Englisch', verso: 'en', focusDopo: 'focus 25' },
};

// gli aiuti della barra (come in test/prova-app.mjs): si rimettono dopo ogni ricarica
const AIUTI = `window.T = {
  aspetta: (f, sec = 30) => new Promise(ok => { const t0 = Date.now(); const g = () => { let r; try { r = f(); } catch { } if (r || Date.now() - t0 > sec * 1000) ok(r); else setTimeout(g, 300); }; g(); }),
  calma: (sec = 30) => new Promise(ok => { const t0 = Date.now(); let st = 0, prima = ''; const g = () => { const f = document.querySelector('.ld-filo').innerText; const fermo = document.querySelector('.ld-campo').dataset.modo === 'riposo' && !document.querySelector('.ld-caret'); st = f === prima && fermo ? st + 1 : 0; prima = f; if (st >= 3 || Date.now() - t0 > sec * 1000) ok(f); else setTimeout(g, 400); }; setTimeout(g, 500); }),
  di: async (testo, sec) => { await __lode.invia(testo); return (await T.calma(sec)).slice(-300); },
};`;
const apri = `(async()=>{ ${AIUTI} await T.aspetta(() => window.__lode && document.querySelector('.ld-pill'), 20); if (document.querySelector('.ld').dataset.aperto !== '1') document.querySelector('.ld-pill').click(); await new Promise(r=>setTimeout(r,700)); return 'lingua ' + window.lodeDesktop.lingua })()`;

async function giro(cod) {
  const F = LINGUE[cod], B = await cat(cod, 'benvenuto'), I = await cat(cod, 'impostazioni'), dopo = await cat(F.verso, 'impostazioni');
  const DIR = mkdtempSync(join(tmpdir(), `lode-lingue-${cod}-`)), VAULT = join(DIR, 'Vault');
  const foto = n => FOTO ? { foto: `${cod}-${n}.png` } : {};
  const passi = [
    { attesa: 3000, js: apri },
    // il benvenuto: la lingua scelta è quella dell'avvio, poi «Ciao», il nome, la pagina delle installazioni (senza cliccare)
    { nome: 'benvenuto: la domanda della lingua', finestra: 'benvenuto', attesa: 1500, ...foto('benvenuto-lingua'), js: `(async()=>{ await new Promise(r=>setTimeout(r,1200)); return document.querySelector('.bv h1').innerText + ' · scelta: ' + document.querySelector('[data-k=lingua] .on')?.dataset.v })()`,
      atteso: `${I['impostazioni.benvenuto-lingua-titolo']} · scelta: ${cod}` },
    { nome: 'benvenuto: «Ciao»', finestra: 'benvenuto', ...foto('benvenuto-ciao'), js: `(async()=>{ document.querySelector('[data-bv=avanti]').click(); await new Promise(r=>setTimeout(r,900)); return document.querySelector('.bv h1').innerText })()`,
      atteso: senzaHtml(B['benvenuto.ciao-titolo']).split('\n')[0] },
    { nome: 'benvenuto: il nome', finestra: 'benvenuto', js: `(async()=>{ document.querySelector('[data-bv=avanti]').click(); await new Promise(r=>setTimeout(r,900)); const h = document.querySelector('.bv h1').innerText; const i = document.querySelector('#bv-nome'); i.value = 'Sam'; i.dispatchEvent(new Event('input')); return h })()`,
      atteso: B['benvenuto.nome-titolo'] },
    { nome: 'benvenuto: le installazioni (senza installare)', finestra: 'benvenuto', ...foto('benvenuto-installa'), js: `(async()=>{ document.querySelector('[data-bv=avanti]').click(); await new Promise(r=>setTimeout(r,900)); return document.querySelector('.bv h1').innerText + ' · ' + document.querySelector('[data-bv=avanti]').innerText })()`,
      atteso: `${B['benvenuto.installa-titolo']} · ${B['benvenuto.installa-tutto']}` },
    // fatto: il benvenuto si chiude e la barra si ricarica (desktop/main.mjs, benvenuto:fatto)
    { nome: 'benvenuto: fatto', finestra: 'benvenuto', js: `(()=>{ setTimeout(() => window.lodeDesktop.invoca('benvenuto:fatto'), 200); return 'chiuso' })()`, atteso: 'chiuso' },
    { attesa: 4000, js: apri },
    { nome: 'barra: focus', ...foto('focus'), js: `(async()=>{ await __lode.invia(${A(F.focus)}); await new Promise(r=>setTimeout(r,2500)); const p = document.querySelector('.ld-pill').innerText; const f = (await T.di('stop')); return p.replace(/\\n/g, ' ') + ' | ' + f })()`, atteso: '24:5' },
    { nome: 'barra: esame con data e crediti', ...foto('esame'), js: `T.di(${A(F.esame)})`, atteso: F.corso },
    { nome: 'quadro: nella lingua di partenza', finestra: 'quadro', attesa: 2500, ...foto('quadro'), js: `(async()=>{ await new Promise(r=>setTimeout(r,1500)); return 'lingua ' + window.lodeDesktop.lingua + ' · ' + document.body.innerText.slice(0, 200).replace(/\\n+/g, ' / ') })()`, atteso: `lingua ${cod}` },
    // il cambio di lingua con il comando: la frase nella lingua nuova, poi tutte le finestre si ricaricano
    { nome: 'barra: cambio di lingua', ...foto('cambio'), js: `(async()=>{ const p = __lode.invia(${A(F.cambia)}); for (let k = 0; k < 40; k++) { const s = document.querySelector('.ld-filo')?.innerText || ''; if (s.includes(${A('§')})) break; await new Promise(r=>setTimeout(r,25)); const f = document.querySelector('.ld-filo')?.innerText.slice(-200) || ''; if (f.trim() && !f.endsWith(${A(F.cambia)})) return f; } await p; return document.querySelector('.ld-filo').innerText.slice(-200) })()`,   // la conferma si legge subito: dopo poche centinaia di ms la finestra si ricarica
      atteso: dopo['impostazioni.lingua-ora'].split('{nome}')[0] },
    { nome: 'barra: ricaricata nella lingua nuova', attesa: 5000, js: apri, atteso: `lingua ${F.verso}` },
    { nome: 'barra: un comando nella lingua nuova', ...foto('dopo'), js: `(async()=>{ await __lode.invia(${A(F.focusDopo)}); await new Promise(r=>setTimeout(r,2500)); const p = document.querySelector('.ld-pill').innerText; await T.di(${A(F.verso === 'de' ? 'Stopp' : 'stop')}); return p.replace(/\\n/g, ' ') })()`, atteso: '24:5' },
    { nome: 'quadro: ricaricato nella lingua nuova', finestra: 'quadro', attesa: 1500, ...foto('quadro-dopo'), js: `(async()=>{ return 'lingua ' + window.lodeDesktop.lingua + ' · ' + document.body.innerText.slice(0, 200).replace(/\\n+/g, ' / ') })()`, atteso: `lingua ${F.verso}` },
  ];
  writeFileSync(join(DIR, 'passi.json'), JSON.stringify(passi));
  console.log(`\n== ${cod} == vault di prova: ${VAULT}`);
  const out = await new Promise(ok => {
    const p = spawn(ELECTRON, ['.'], { cwd: DESKTOP, env: { ...process.env, LODE_DATI: join(DIR, 'dati'), LODE_VAULT: VAULT, LODE_LINGUA: cod, LODE_OBSIDIAN_DIR: join(DIR, 'obsidian'),
      LODE_NON_APRIRE: '1', LODE_PROVA: join(DIR, 'passi.json'), LODE_PROVA_BENVENUTO: '1', LODE_ESCI: '1', ...(FOTO ? { LODE_FOTO: FOTO } : {}),
      LODE_QUIETE_MS: '1500', LODE_FATTO_MS: '2000', LODE_AI_BASE: 'http://127.0.0.1:9/v1' } });
    let s = '', fatto = false;
    const eco = x => { s += x; process.stdout.write(x); }, fine = () => { if (!fatto) { fatto = true; clearTimeout(cane); ok(s); } };
    p.stdout.on('data', eco); p.stderr.on('data', eco);
    const cane = setTimeout(() => { eco(`\nCANE DA GUARDIA: Electron fermato dopo ${LIMITE} minuti\n`); p.kill('SIGKILL'); setTimeout(fine, 3000); }, LIMITE * 60e3);
    p.on('close', fine); p.on('exit', () => setTimeout(fine, 5000)); p.on('error', e => { eco(`\nElectron non parte: ${e.message}\n`); fine(); });
  });
  const ris = Object.fromEntries([...out.matchAll(/^passo (\d+)(?: errore)?: (.*)$/gm)].map(m => [+m[1], m[2]]));
  let ok = 0, ko = 0;
  passi.forEach((p, i) => {
    if (!p.nome) return;
    const r = ris[i] ?? '(nessuna risposta)', passa = r.toLowerCase().includes(p.atteso.toLowerCase());
    passa ? ok++ : ko++;
    console.log(`${passa ? '✓' : '✗'} ${cod} · ${p.nome}${passa ? '' : `\n    atteso «${p.atteso}», arrivato: ${r.slice(0, 300)}`}`);
  });
  // il vault è nato nella lingua di partenza e non cambia con la barra; la lingua nuova è salvata
  const N = nomiDi(cod), M = nomiDi(F.verso);
  const leggi = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return {}; } };
  const vj = leggi(join(VAULT, '.lode', 'vault.json')), dati = leggi(join(VAULT, '.lode', 'dati.json')), conf = leggi(join(DIR, 'dati', 'config.json'));
  const cartelle = existsSync(VAULT) ? readdirSync(VAULT) : [];
  const esame = (dati.esami || []).find(e => e.nome?.toLowerCase().includes(F.corso.toLowerCase()));
  const verifica = [
    [`vault: .lode/vault.json in ${cod}`, vj.lingua === cod],
    ['vault: cartelle nella lingua di partenza', [N.cartelle.lezioni, N.cartelle.corsi].every(c => cartelle.includes(c))],
    ['vault: note nella lingua di partenza', [N.note.home, N.note.orario, N.note.glossario].every(n => cartelle.includes(n + '.md'))],
    ['vault: niente cartelle nella lingua nuova', ![M.cartelle.lezioni, M.cartelle.corsi, M.note.home + '.md'].some(c => cartelle.includes(c) && !Object.values(N.cartelle).includes(c) && c !== N.note.home + '.md')],
    ['vault: nessuna cartella italiana', !['Lezioni', 'Corsi'].some(c => cartelle.includes(c))],
    ['dati: l\'esame con la data e 6 crediti', !!esame && /-01-15$/.test(esame.data || '') && esame.cfu === 6],
    ['dati: il nome dal benvenuto', dati.profilo?.nome === 'Sam'],
    [`configurazione: lingua ${F.verso} salvata, benvenuto fatto`, conf.lingua === F.verso && !!conf.benvenuto],
  ];
  for (const [n, v] of verifica) { v ? ok++ : ko++; console.log(`${v ? '✓' : '✗'} ${cod} · ${n}`); }
  if (!esame) console.log('    esami:', JSON.stringify(dati.esami || []).slice(0, 400));
  console.log('    cartelle del vault:', cartelle.join(', '));
  return { ok, ko };
}

let ok = 0, ko = 0;
for (const cod of (process.env.LODE_LINGUE || 'en,de').split(',')) { const r = await giro(cod); ok += r.ok; ko += r.ko; }
console.log(`\n${ok} passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
