// Prova completa dell'app desktop, su un vault e una configurazione temporanei (non tocca i tuoi dati):
//   node test/prova-app.mjs            (macOS: le frasi «parlate» si generano con la voce Alice di sistema)
// Copre comandi, aula (★, definizioni, domande nella nota Obsidian), focus, libretto, ripasso, giochi, orario, note,
// indietro/Esc, voce (Whisper locale), trascrizione di una lezione con formule, riordino e definizioni col modello
// locale, domanda all'AI. L'audio va direttamente al motore: niente altoparlanti, niente microfono.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url)), DESKTOP = join(QUI, '..', 'desktop');
const DIR = mkdtempSync(join(tmpdir(), 'lode-prova-')), VAULT = join(DIR, 'Vault');
const ELECTRON = join(DESKTOP, 'node_modules', '.bin', 'electron');
if (!existsSync(ELECTRON)) { console.error('Prima: cd desktop && npm install'); process.exit(1); }

// audio: frasi dette con la voce di sistema, 16 kHz mono, in base64 (int16)
function parla(testo, nome) {
  const aiff = join(DIR, nome + '.aiff'), wav = join(DIR, nome + '.wav');
  execFileSync('say', ['-v', 'Alice', '-r', '175', '-o', aiff, testo]);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, wav]);
  const b = readFileSync(wav), i = b.indexOf('data') + 8;
  return b.subarray(i).toString('base64');
}
const VOCE = {
  voto: parla('Ho preso ventotto in fisica due.', 'voto'),
  def: parla('Definizione elettrofilo uguale specie povera di elettroni.', 'def'),
};
// un PDF minimo con del testo (dispensa), per leggere i PDF in locale con pdf.js
function pdf(righe) {
  const testo = righe.map((r, i) => `BT /F1 12 Tf 50 ${760 - i * 18} Td (${r.replace(/[()\\]/g, '')}) Tj ET`).join('\n');
  const ogg = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${testo.length} >>\nstream\n${testo}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const pos = [];
  ogg.forEach((o, i) => { pos.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length; out += `xref\n0 ${ogg.length + 1}\n0000000000 65535 f \n${pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${ogg.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, 'latin1').toString('base64');
}
const DISPENSA = pdf(['Dispensa di Analisi 2 - Forme differenziali', 'Una forma differenziale si dice chiusa se le derivate incrociate coincidono.', 'Una forma differenziale si dice esatta se ammette un potenziale.', 'Ogni forma esatta e chiusa. Il viceversa vale su domini semplicemente connessi.', 'Un dominio e semplicemente connesso se ogni curva chiusa si contrae a un punto.']);
const WAV = Buffer.from(readFileSync(join(DIR, 'voto.wav'))).toString('base64');
const LEZIONE = parla(`Buongiorno a tutti, oggi parliamo di integrali definiti. Calcoliamo l'integrale da zero a pi greco di seno di x in d x, che vale due.
Ricordate il teorema fondamentale del calcolo integrale: la derivata della funzione integrale è uguale alla funzione integranda.
Vediamo un esempio: f di x uguale x al quadrato più due x più uno. Una primitiva di f è x al cubo fratto tre più x al quadrato più x.
Il limite per x che tende a zero di seno di x fratto x è uguale a uno, questo all'esame lo chiedo sempre.
Definiamo infine la funzione integrale come l'integrale da a a x di f di t in d t.`, 'lezione');

const d = new Date(), hh = d.getHours();
const lezioneOra = `lezione analisi 2 ${['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][d.getDay()]} dalle ${hh} alle ${Math.min(23, hh + 2)} aula 7`;
const A = v => JSON.stringify(v);
const passi = [
  { attesa: 3500, js: `(()=>{
    window.T = {
      aspetta: (f, sec = 30) => new Promise(ok => { const t0 = Date.now(); const g = () => { let r; try { r = f(); } catch { } if (r || Date.now() - t0 > sec * 1000) ok(r); else setTimeout(g, 300); }; g(); }),
      calma: (sec = 60) => new Promise(ok => { const t0 = Date.now(); let st = 0, prima = ''; const g = () => { const f = document.querySelector('.ld-filo').innerText; const fermo = document.querySelector('.ld-campo').dataset.modo === 'riposo' && !document.querySelector('.ld-caret'); st = f === prima && fermo ? st + 1 : 0; prima = f; if (st >= 3 || Date.now() - t0 > sec * 1000) ok(f); else setTimeout(g, 400); }; setTimeout(g, 500); }),
      di: async (testo, sec) => { await __lode.invia(testo); return (await T.calma(sec)).slice(-400); },
      conferma: async (sec = 60) => { const c = await T.aspetta(() => { const x = [...document.querySelectorAll('.ld-conf')].pop(); return x && !x.dataset.cliccata && x; }, sec); if (!c) return null; c.dataset.cliccata = 1; const t = c.querySelector('h3').textContent; c.querySelector('[data-ld=si]').click(); return t; },
      file: (b64, nome, tipo) => { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new File([a], nome, { type: tipo, lastModified: Date.now() }); },
      lascia: async f => { const dt = new DataTransfer(); dt.items.add(f); dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 500)); const largo = document.querySelector('.ld').classList.contains('drop') ? Math.round(document.querySelector('.ld').getBoundingClientRect().width) : 0; document.querySelector('.ld-pill').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); await T.aspetta(() => document.querySelector('.ld-file-op:last-of-type .ld-op'), 20); return largo; },
      scegli: async (op, sec = 300) => { const c = [...document.querySelectorAll('.ld-file-op')].pop(); if (!c) return 'nessuna scheda'; const b = c.querySelector('[data-op="' + op + '"]'); if (!b || b.disabled) return 'opzione non disponibile: ' + op; b.click(); return 'ok'; },
      audio: b64 => { const s = atob(b64), n = s.length >> 1, a = new Float32Array(n); for (let i = 0; i < n; i++) { let v = s.charCodeAt(2 * i) | (s.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; a[i] = v / 32768; } return a; },
    };
    dispatchEvent(new CustomEvent('lode:esempio')); document.querySelector('.ld-pill').click(); return 'pronto'; })()` },
  { nome: 'orario: lezione adesso', js: `T.di(${A(lezioneOra)})`, atteso: 'in orario' },
  { nome: 'pillola in aula', js: `(async()=>{ await __lode.indietro(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,900)); return document.querySelector('.ld-pill').innerText })()`, atteso: 'Analisi 2' },
  { nome: '★ da esame', js: `(async()=>{ document.querySelector('.ld-pill').click(); await new Promise(r=>setTimeout(r,700)); return T.di('★ il teorema di Green all\\'esame lo chiede sempre') })()`, atteso: 'Segnato in Analisi 2' },
  { nome: 'definizione', js: `T.di('def: gradiente = vettore delle derivate parziali')`, atteso: '«Gradiente» in Analisi 2' },
  { nome: 'domanda per il prof', js: `T.di('? perché serve la continuità delle derivate')`, atteso: 'Domanda salvata' },
  { nome: 'focus', js: `(async()=>{ await __lode.invia('focus 25 su analisi 2'); await new Promise(r=>setTimeout(r,2500)); const p=document.querySelector('.ld-pill').innerText; await __lode.invia('stop'); return p })()`, atteso: 'Analisi 2' },
  { nome: 'voto', js: `T.di('ho preso 28 in fisica 2')`, atteso: '28 in Fisica 2' },
  { nome: 'quanto mi serve', js: `T.di('quanto mi serve per 105')`, atteso: 'Per partire da 105' },
  { nome: 'simulazione', js: `T.di('se prendo 30 in basi di dati')`, atteso: 'la media passa' },
  { nome: 'ripasso', js: `(async()=>{ await T.di('ripassa analisi 2'); document.querySelector('.ld-rip .gira').click(); await new Promise(r=>setTimeout(r,400)); document.querySelector('.ld-rip [data-q="4"]').click(); await new Promise(r=>setTimeout(r,700)); return document.querySelector('.ld-rip .conto').innerText })()`, atteso: '2 di' },
  { nome: 'gioco', js: `(async()=>{ await T.di('gioca analisi 2'); return document.querySelector('.ld-gioco')?.innerText.slice(0, 60) || document.querySelector('.ld-filo').innerText.slice(-200) })()`, atteso: 'GIOCO · ANALISI 2' },
  { nome: 'orario scheda', js: `(async()=>{ await T.di('orario'); return document.querySelector('.ld-orario')?.innerText.slice(0,80) })()`, atteso: 'ORARIO' },
  { nome: 'note del vault', js: `(async()=>{ await T.di('note'); await new Promise(r=>setTimeout(r,800)); return document.querySelector('.ld-note')?.innerText.slice(0,200) })()`, atteso: 'Glossario' },
  { nome: 'indietro', js: `(async()=>{ document.querySelector('.ld-indietro').click(); await new Promise(r=>setTimeout(r,900)); return String(document.querySelector('.ld-indietro').hidden) + ' ' + getComputedStyle(document.querySelector('.ld-home')).display })()`, atteso: 'true flex' },
  { nome: 'Esc: indietro poi chiudi', js: `(async()=>{ await T.di('libretto'); dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,900)); const a = document.querySelector('.ld').dataset.aperto + (document.querySelector('.ld-indietro').hidden ? ' home' : ' scheda'); dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,900)); return a + ' / ' + document.querySelector('.ld').dataset.aperto })()`, atteso: '1 home / 0' },
  { nome: 'voce: voto detto', attesa: 600, js: `(async()=>{ document.querySelector('.ld-pill').click(); const t = await __lode.Voce.trascriviAudio(T.audio(${A(VOCE.voto)})); return t + ' → ' + await T.di(t) })()`, atteso: 'Fisica 2' },
  { nome: 'voce: definizione detta', js: `(async()=>{ const t = await __lode.Voce.trascriviAudio(T.audio(${A(VOCE.def)})); return t + ' → ' + await T.di(t) })()`, atteso: 'in Analisi 2' },
  { nome: 'trascrizione della lezione', js: `(async()=>{ __lode.avviaTrascrizione({ audioProva: T.audio(${A(LEZIONE)}) }); await T.conferma(30); await T.aspetta(() => __lode.TR.stato() && !__lode.TR.stato().coda && __lode.TR.stato().righe > 0, 180); await __lode.fermaTrascrizione(); return (await T.calma(60)).slice(-200) })()`, atteso: 'Lezione trascritta' },
  { nome: 'riordina col modello locale', js: `(async()=>{ await __lode.indietro(); const p = T.di('riordina la lezione', 600); const t = await T.conferma(420); if (!t) return (await p); await T.aspetta(() => document.querySelector('.ld-filo').innerText.includes('Appunti salvati'), 60); const d = await T.conferma(240); await T.calma(60); return t + ' | ' + d })()`, atteso: 'Salvare gli appunti riordinati' },
  { nome: 'ripeti: gli ultimi 60 secondi', js: `(async()=>{ await __lode.indietro(); await __lode.O.immetti(T.audio(${A(VOCE.voto)})); await __lode.ripeti(); await T.calma(60); return document.querySelector('.ld-ripeti')?.innerText.slice(0, 200) || document.querySelector('.ld-filo').innerText.slice(-200) })()`, atteso: 'ULTIMI' },
  { nome: 'ripeti: agli appunti', js: `(async()=>{ document.querySelector('.ld-ripeti [data-r=appunti]').click(); return (await T.calma(20)).slice(-120) })()`, atteso: 'Negli appunti di Analisi 2' },
  { nome: 'condividi la sbobina', js: `(async()=>{ await __lode.indietro(); return T.di('condividi la sbobina di analisi 2', 60) })()`, atteso: 'Sbobina di Analisi 2 pronta' },
  { nome: 'trascina: la pillola si allarga', js: `(async()=>{ try { await __lode.indietro(); dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,900)); const w = await T.lascia(T.file(${A(Buffer.from('Il gradiente è il vettore delle derivate parziali. La matrice hessiana raccoglie le derivate seconde. Un punto di sella è un punto stazionario che non è né massimo né minimo.').toString('base64'))}, 'appunti-compagno.md', 'text/markdown')); const c = [...document.querySelectorAll('.ld-file-op')].pop(); return 'larga ' + w + ' · ' + (c ? c.querySelector('.ld-opzioni').innerText.split('\\n').join(' | ').slice(0, 300) : 'nessuna scheda: ' + document.querySelector('.ld-filo').innerText.slice(-300)); } catch (e) { return 'ERRORE ' + e.message; } })()`, atteso: 'Carte del ripasso' },
  { nome: 'file di testo → carte (modello locale)', js: `(async()=>{ await T.scegli('carte'); const t = await T.conferma(300); await T.calma(30); return t })()`, atteso: 'Salvare' },
  { nome: 'PDF → definizioni per i giochi', js: `(async()=>{ await __lode.indietro(); await T.lascia(T.file(${A(DISPENSA)}, 'dispensa-forme.pdf', 'application/pdf')); await T.scegli('definizioni'); const t = await T.conferma(300); await T.calma(30); return t + ' | ' + document.querySelector('.ld-filo').innerText.slice(-150) })()`, atteso: 'Aggiungere a Analisi 2' },
  { nome: 'registrazione audio → trascritta nella lezione', js: `(async()=>{ await __lode.indietro(); await T.lascia(T.file(${A(WAV)}, 'registrazione.wav', 'audio/wav')); await T.scegli('audio'); await T.aspetta(() => document.querySelector('.ld-filo').innerText.includes('Lezione trascritta'), 240); return document.querySelector('.ld-filo').innerText.slice(-200) })()`, atteso: 'Lezione trascritta' },
  { nome: 'ricevi una sbobina', js: `(async()=>{ await __lode.indietro(); const testo = await window.lodeDesktop.invoca('vault:leggi', { file: 'Sbobine/' + (await window.lodeDesktop.invoca('vault:note')).find(n => n.file.startsWith('Sbobine/') && n.file.endsWith('.md')).file.slice(8) }); const md = testo.replace(/corso: "Analisi 2"/, 'corso: "Fisica 2"'); await T.lascia(new File([md], 'sbobina-fisica.md', { type: 'text/markdown' })); await T.scegli('sbobina'); return (await T.calma(30)).slice(-160) })()`, atteso: 'nel tuo vault' },
  { nome: "domanda all'AI locale", js: `(async()=>{ await __lode.indietro(); return T.di('spiegami in una frase cos\\'è un integrale definito', 240) })()`, atteso: 'integrale' },
];
writeFileSync(join(DIR, 'passi.json'), JSON.stringify(passi));
console.log('Vault di prova:', VAULT);

const out = await new Promise(ok => {
  const p = spawn(ELECTRON, ['.'], { cwd: DESKTOP, env: { ...process.env, LODE_DATI: join(DIR, 'dati'), LODE_VAULT: VAULT, LODE_OBSIDIAN_DIR: join(DIR, 'obsidian'), LODE_NON_APRIRE: '1', LODE_PROVA: join(DIR, 'passi.json'), LODE_ESCI: '1' } });
  let s = ''; p.stdout.on('data', x => s += x); p.stderr.on('data', x => s += x); p.on('close', () => ok(s));
});
const ris = Object.fromEntries([...out.matchAll(/^passo (\d+)(?: errore)?: (.*)$/gm)].map(m => [+m[1], m[2]]));
let ok = 0, ko = 0;
passi.forEach((p, i) => {
  if (!p.nome) return;
  const r = ris[i] ?? '(nessuna risposta)';
  const passa = r.toLowerCase().includes(p.atteso.toLowerCase());
  passa ? ok++ : ko++;
  console.log(`${passa ? '✓' : '✗'} ${p.nome}${passa ? '' : `\n    atteso «${p.atteso}», arrivato: ${r.slice(0, 300)}`}`);
});
// la nota della lezione nel vault
const cartella = join(VAULT, 'Lezioni', 'Analisi 2'), file = existsSync(cartella) ? readdirSync(cartella).find(f => f.endsWith('.md')) : null;
const nota = file ? readFileSync(join(cartella, file), 'utf8') : '';
const verifica = [
  ['nota: ★ salvata', /## ★ Da esame[\s\S]*teorema di Green/.test(nota)],
  ['nota: definizione salvata', /\*\*Gradiente\*\*: vettore delle derivate/.test(nota)],
  ['nota: domanda salvata', /## Domande per il prof[\s\S]*continuità/.test(nota)],
  ['nota: trascrizione con formule LaTeX', /## Trascrizione[\s\S]*\$\\int/.test(nota)],
  ['nota: appunti riordinati', /## Appunti riordinati da Lode/.test(nota)],
  ['nota: «Ripeti» negli appunti', /## Appunti[\s\S]*Fisica/i.test(nota)],
  ['vault: sbobina .md e .html', existsSync(join(VAULT, 'Sbobine')) && readdirSync(join(VAULT, 'Sbobine')).some(f => f.endsWith('.html')) && readdirSync(join(VAULT, 'Sbobine')).some(f => f.endsWith('.md'))],
  ['vault: sbobina ricevuta come lezione', existsSync(join(VAULT, 'Lezioni', 'Fisica 2'))],
  ['vault: sbobina html con formule MathML', existsSync(join(VAULT, 'Sbobine')) && readdirSync(join(VAULT, 'Sbobine')).filter(f => f.endsWith('.html')).some(f => readFileSync(join(VAULT, 'Sbobine', f), 'utf8').includes('<math'))],
  ['vault: Home, Glossario, Orario, Memoria', ['Home.md', 'Glossario.md', 'Orario.md', 'Lode/Memoria.md'].every(f => existsSync(join(VAULT, f)))],
];
for (const [n, v] of verifica) { v ? ok++ : ko++; console.log(`${v ? '✓' : '✗'} ${n}`); }
console.log(`\n${ok} passate, ${ko} fallite · nota: ${file ? join(cartella, file) : 'non creata'}`);
process.exit(ko ? 1 : 0);
