// Prova completa dell'app desktop, su un vault e una configurazione temporanei (non tocca i tuoi dati):
//   node test/prova-app.mjs
// Le frasi «parlate»: sul Mac si generano con la voce Alice di sistema; altrove (Windows, Linux) si usano quelle salvate
// in test/audio (si rigenerano su un Mac con LODE_SALVA_AUDIO=1 LODE_SOLO_AUDIO=1 node test/prova-app.mjs).
// LODE_CI=1 (la macchina Windows di GitHub): prima installa davvero Ollama e il modello con l'installer di Lode, salva le
// foto della barra in LODE_FOTO e i risultati in LODE_RISULTATI (JSON).
// Copre comandi, aula (★, definizioni, domande nella nota Obsidian), focus, libretto, ripasso, giochi, orario, note,
// indietro/Esc, voce (Whisper locale), trascrizione di una lezione con formule, riordino e definizioni col modello
// locale, domanda all'AI. L'audio va direttamente al motore: niente altoparlanti, niente microfono.
// L'uscita di Electron si vede dal vivo; dopo LODE_LIMITE_MIN minuti (100: GitHub ferma tutto a 120) Electron si ferma e
// il resoconto arriva lo stesso, con l'ultimo passo finito.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url)), DESKTOP = join(QUI, '..', 'desktop');
const DIR = mkdtempSync(join(tmpdir(), 'lode-prova-')), VAULT = join(DIR, 'Vault');
// il binario di Electron, su qualunque sistema (su Windows .bin/electron è uno script .cmd)
let ELECTRON; try { ELECTRON = createRequire(join(DESKTOP, 'package.json'))('electron'); } catch { }
if (!ELECTRON || !existsSync(ELECTRON)) { console.error('Prima: cd desktop && npm install'); process.exit(1); }
const CI = !!process.env.LODE_CI, FOTO = process.env.LODE_FOTO || '';
if (FOTO) mkdirSync(FOTO, { recursive: true });

// audio: frasi dette con la voce di sistema, 16 kHz mono, in base64 (int16). Il nome del file salvato contiene
// l'impronta del testo: se la frase cambia, l'audio vecchio non viene usato per sbaglio.
const AUDIO = join(QUI, 'audio'), MAC = process.platform === 'darwin';
const wav16 = pcm => { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
function parla(testo, nome) {
  const fisso = join(AUDIO, `${nome}-${createHash('sha1').update(testo).digest('hex').slice(0, 10)}.pcm`);
  let pcm;
  if (MAC && !process.env.LODE_AUDIO_FISSO) {
    const aiff = join(DIR, nome + '.aiff'), wav = join(DIR, nome + '-mac.wav');
    execFileSync('say', ['-v', 'Alice', '-r', '175', '-o', aiff, testo]);
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, wav]);
    const b = readFileSync(wav); pcm = b.subarray(b.indexOf('data') + 8);
    if (process.env.LODE_SALVA_AUDIO) { mkdirSync(AUDIO, { recursive: true }); writeFileSync(fisso, pcm); }
  } else {
    if (!existsSync(fisso)) { console.error(`Manca l'audio di prova ${fisso}: generalo su un Mac con LODE_SALVA_AUDIO=1 LODE_SOLO_AUDIO=1 node test/prova-app.mjs`); process.exit(1); }
    pcm = readFileSync(fisso);
  }
  writeFileSync(join(DIR, nome + '.wav'), wav16(pcm));   // per i passi che lasciano un file audio sulla pillola
  return pcm.toString('base64');
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
// un minuto intero di lezione: l'ultima frase (quella da ripetere) arriva dopo i 50 secondi
const MINUTO = parla(`Allora ragazzi, riprendiamo da dove eravamo rimasti la volta scorsa. Oggi parliamo del teorema di Green, che lega l'integrale di linea lungo il bordo di un dominio all'integrale doppio sul dominio stesso. Perché valga, il dominio deve essere regolare e il bordo va percorso in senso antiorario. Le funzioni P e Q devono avere derivate parziali continue. Una conseguenza importante riguarda il calcolo delle aree: l'area di un dominio si può ottenere con un integrale di linea lungo il suo bordo. Vediamo un esempio con il cerchio di raggio uno, che conoscete bene dal corso di Analisi uno. Prima però una domanda: chi si ricorda la definizione di forma differenziale esatta? Una forma è esatta se ammette un potenziale. E attenzione: il teorema di Green all'esame lo chiedo sempre, con la dimostrazione.`, 'minuto');
const WAV = Buffer.from(readFileSync(join(DIR, 'voto.wav'))).toString('base64');
const LEZIONE = parla(`Buongiorno a tutti, oggi parliamo di integrali definiti. Calcoliamo l'integrale da zero a pi greco di seno di x in d x, che vale due.
Ricordate il teorema fondamentale del calcolo integrale: la derivata della funzione integrale è uguale alla funzione integranda.
Vediamo un esempio: f di x uguale x al quadrato più due x più uno. Una primitiva di f è x al cubo fratto tre più x al quadrato più x.
Il limite per x che tende a zero di seno di x fratto x è uguale a uno, questo all'esame lo chiedo sempre.
Definiamo infine la funzione integrale come l'integrale da a a x di f di t in d t.`, 'lezione');

if (process.env.LODE_SOLO_AUDIO) { console.log('audio di prova salvati in', AUDIO); process.exit(0); }

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
    dispatchEvent(new CustomEvent('lode:esempio'));
    // a qualunque ora parta la prova, «adesso» c'è solo la lezione di Analisi 2 (la aggiunge il passo dopo): gli altri corsi oggi no
    { const D = __lode.D(), g = new Date().getDay(); D.orario.forEach(o => { if (o.corso !== 'Analisi 2') o.giorni = o.giorni.filter(x => x !== g); }); dispatchEvent(new CustomEvent('lode:dati')); }
    document.querySelector('.ld-pill').click(); return 'pronto'; })()` },
  ...(CI ? [{ nome: 'installa: AI locale (Ollama + modello, installer di Lode)', attesa: 500, js: `(async()=>{ const r = await window.lodeDesktop.invoca('installa:cervello'); for (let k = 0; k < 20 && !__lode.AI.modelloLocale(); k++) { dispatchEvent(new CustomEvent('lode:dati')); await new Promise(r => setTimeout(r, 1000)); } return JSON.stringify(r) })()`, atteso: '"esito":"ok"', mostra: true }] : []),
  { nome: 'orario: lezione adesso', js: `T.di(${A(lezioneOra)})`, atteso: 'in orario' },
  { nome: 'pillola in aula', ...(FOTO ? { foto: 'pillola-aula.png' } : {}), js: `(async()=>{ await __lode.indietro(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,900)); return document.querySelector('.ld-pill').innerText })()`, atteso: 'Analisi 2' },
  { nome: '★ da esame', js: `(async()=>{ document.querySelector('.ld-pill').click(); await new Promise(r=>setTimeout(r,700)); return T.di('★ il teorema di Green all\\'esame lo chiede sempre') })()`, atteso: 'Segnato in Analisi 2' },
  { nome: 'definizione', js: `T.di('def: gradiente = vettore delle derivate parziali')`, atteso: '«Gradiente» in Analisi 2' },
  { nome: 'domanda per il prof', js: `T.di('? perché serve la continuità delle derivate')`, atteso: 'Domanda salvata' },
  { nome: 'focus', js: `(async()=>{ await __lode.invia('focus 25 su analisi 2'); await new Promise(r=>setTimeout(r,2500)); const p=document.querySelector('.ld-pill').innerText; await __lode.invia('stop'); return p })()`, atteso: 'Analisi 2' },
  { nome: 'voto', js: `T.di('ho preso 28 in fisica 2')`, atteso: '28 in Fisica 2' },
  { nome: 'quanto mi serve', js: `T.di('quanto mi serve per 105')`, atteso: 'Per partire da 105' },
  { nome: 'simulazione', js: `T.di('se prendo 30 in basi di dati')`, atteso: 'la media passa' },
  { nome: 'ripasso', js: `(async()=>{ await T.di('ripassa analisi 2'); document.querySelector('.ld-rip .gira').click(); await new Promise(r=>setTimeout(r,400)); document.querySelector('.ld-rip [data-q="4"]').click(); await new Promise(r=>setTimeout(r,700)); return document.querySelector('.ld-rip .conto').innerText })()`, atteso: '2 di' },
  { nome: 'gioco', ...(FOTO ? { foto: 'gioco.png' } : {}), js: `(async()=>{ await T.di('gioca analisi 2'); return document.querySelector('.ld-gioco')?.innerText.slice(0, 60) || document.querySelector('.ld-filo').innerText.slice(-200) })()`, atteso: 'GIOCO · ANALISI 2' },
  { nome: 'orario scheda', js: `(async()=>{ await T.di('orario'); return document.querySelector('.ld-orario')?.innerText.slice(0,80) })()`, atteso: 'ORARIO' },
  { nome: 'note del vault', js: `(async()=>{ await T.di('note'); await new Promise(r=>setTimeout(r,800)); return document.querySelector('.ld-note')?.innerText.slice(0,200) })()`, atteso: 'Glossario' },
  { nome: 'indietro', js: `(async()=>{ document.querySelector('.ld-indietro').click(); await new Promise(r=>setTimeout(r,900)); return String(document.querySelector('.ld-indietro').hidden) + ' ' + getComputedStyle(document.querySelector('.ld-home')).display })()`, atteso: 'true flex' },
  { nome: 'Esc: indietro poi chiudi', js: `(async()=>{ await T.di('libretto'); dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,900)); const a = document.querySelector('.ld').dataset.aperto + (document.querySelector('.ld-indietro').hidden ? ' home' : ' scheda'); dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,900)); return a + ' / ' + document.querySelector('.ld').dataset.aperto })()`, atteso: '1 home / 0' },
  { nome: 'voce: voto detto', attesa: 600, js: `(async()=>{ document.querySelector('.ld-pill').click(); const t = await __lode.Voce.trascriviAudio(T.audio(${A(VOCE.voto)})); return t + ' → ' + await T.di(t) })()`, atteso: 'Fisica 2' },
  { nome: 'voce: definizione detta', js: `(async()=>{ const t = await __lode.Voce.trascriviAudio(T.audio(${A(VOCE.def)})); return t + ' → ' + await T.di(t) })()`, atteso: 'in Analisi 2' },
  { nome: 'trascrizione della lezione', js: `(async()=>{ __lode.avviaTrascrizione({ audioProva: T.audio(${A(LEZIONE)}) }); await T.conferma(30); await T.aspetta(() => __lode.TR.stato() && !__lode.TR.stato().coda && __lode.TR.stato().righe > 0, 180); await __lode.fermaTrascrizione(); return (await T.calma(60)).slice(-200) })()`, atteso: 'Lezione trascritta' },
  { nome: 'riordina col modello locale', js: `(async()=>{ await __lode.indietro(); const p = T.di('riordina la lezione', 600); const t = await T.conferma(420); if (!t) return (await p); await T.aspetta(() => document.querySelector('.ld-filo').innerText.includes('Appunti salvati'), 60); const d = await T.conferma(240); await T.calma(60); return t + ' | ' + d })()`, atteso: 'Salvare gli appunti riordinati' },
  { nome: 'ripeti: gli ultimi 60 secondi', js: `(async()=>{ await __lode.indietro(); await __lode.O.immetti(T.audio(${A(VOCE.voto)})); await __lode.ripeti(); await T.calma(60); return document.querySelector('.ld-ripeti')?.innerText.slice(0, 200) || document.querySelector('.ld-filo').innerText.slice(-200) })()`, atteso: 'ULTIMI' },
  { nome: 'voce: motore', js: `__lode.Voce.nomeMotore()`, atteso: '', mostra: true },
  { nome: 'ripeti: un minuto intero, ultima frase in chiaro', ...(FOTO ? { foto: 'ripeti.png' } : {}), js: `(async()=>{ await __lode.indietro(); await __lode.O.immetti(T.audio(${A(MINUTO)})); const t0 = performance.now(); await __lode.ripeti(); const ms = performance.now() - t0; const s = [...document.querySelectorAll('.ld-ripeti')].pop(); return Math.round(ms) + ' ms · ULTIMA: ' + s.querySelector('.ultima')?.innerText + ' · TUTTO: ' + s.querySelector('.ld-detto-prof').innerText })()`, atteso: 'chiedo sempre', mostra: true },
  { nome: 'ripeti: agli appunti', js: `(async()=>{ document.querySelector('.ld-ripeti [data-r=appunti]').click(); return (await T.calma(20)).slice(-120) })()`, atteso: 'Negli appunti di Analisi 2' },
  { nome: 'condividi la sbobina', js: `(async()=>{ await __lode.indietro(); return T.di('condividi la sbobina di analisi 2', 60) })()`, atteso: 'Sbobina di Analisi 2 pronta' },
  { nome: 'trascina: la pillola si allarga', ...(FOTO ? { foto: 'zona-file.png' } : {}), js: `(async()=>{ try { await __lode.indietro(); dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,900)); const w = await T.lascia(T.file(${A(Buffer.from('Il gradiente è il vettore delle derivate parziali. La matrice hessiana raccoglie le derivate seconde. Un punto di sella è un punto stazionario che non è né massimo né minimo.').toString('base64'))}, 'appunti-compagno.md', 'text/markdown')); const c = [...document.querySelectorAll('.ld-file-op')].pop(); return 'larga ' + w + ' · ' + (c ? c.querySelector('.ld-opzioni').innerText.split('\\n').join(' | ').slice(0, 300) : 'nessuna scheda: ' + document.querySelector('.ld-filo').innerText.slice(-300)); } catch (e) { return 'ERRORE ' + e.message; } })()`, atteso: 'Carte del ripasso' },
  { nome: 'file di testo → carte (modello locale)', js: `(async()=>{ await T.scegli('carte'); const t = await T.conferma(300); await T.calma(30); return t })()`, atteso: 'Salvare' },
  { nome: 'PDF → definizioni per i giochi', js: `(async()=>{ await __lode.indietro(); await T.lascia(T.file(${A(DISPENSA)}, 'dispensa-forme.pdf', 'application/pdf')); await T.scegli('definizioni'); const t = await T.conferma(300); await T.calma(30); return t + ' | ' + document.querySelector('.ld-filo').innerText.slice(-150) })()`, atteso: 'Aggiungere a Analisi 2' },
  { nome: 'registrazione audio → trascritta nella lezione', js: `(async()=>{ await __lode.indietro(); await T.lascia(T.file(${A(WAV)}, 'registrazione.wav', 'audio/wav')); await T.scegli('audio'); await T.aspetta(() => document.querySelector('.ld-filo').innerText.includes('Lezione trascritta'), 240); return document.querySelector('.ld-filo').innerText.slice(-200) })()`, atteso: 'Lezione trascritta' },
  { nome: 'ricevi una sbobina', js: `(async()=>{ await __lode.indietro(); const testo = await window.lodeDesktop.invoca('vault:leggi', { file: 'Sbobine/' + (await window.lodeDesktop.invoca('vault:note')).find(n => n.file.startsWith('Sbobine/') && n.file.endsWith('.md')).file.slice(8) }); const md = testo.replace(/corso: "Analisi 2"/, 'corso: "Fisica 2"'); await T.lascia(new File([md], 'sbobina-fisica.md', { type: 'text/markdown' })); await T.scegli('sbobina'); return (await T.calma(30)).slice(-160) })()`, atteso: 'nel tuo vault' },
  { nome: 'esame comunicato a voce', js: `(async()=>{ await __lode.indietro(); return T.di("ho l'esame di fisica 2 tra 5 giorni", 30) })()`, atteso: 'ti propongo' },
  { nome: 'allenatore: la pillola propone', ...(FOTO ? { foto: 'proposta.png' } : {}), js: `(async()=>{ await __lode.indietro(); dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,900)); const r = await __lode.provaAllenatore(true); await new Promise(r=>setTimeout(r,900)); const el = document.querySelector('.ld.propone .ld-proposta'); return r + ' | ' + (el ? el.innerText.replace(/\\n/g,' ') + ' | larga ' + Math.round(document.querySelector('.ld').getBoundingClientRect().width) : 'nessuna proposta visibile') })()`, atteso: 'larga' },
  { nome: 'allenatore: accetta e parte', js: `(async()=>{ document.querySelector('.ld-proposta [data-p=si]').click(); await new Promise(r=>setTimeout(r,2500)); const st = __lode.AL.riepilogo(); return 'accettate ' + Object.values(st).reduce((a, x) => a + x.si, 0) + ' | ' + document.querySelector('.ld-filo').innerText.slice(-160) })()`, atteso: 'accettate 1' },
  { nome: 'allenatore: «Dopo» rimanda', js: `(async()=>{ __lode.D().imp.silenzio = { da: '00:00', a: '00:00' }; await __lode.indietro(); dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await new Promise(r=>setTimeout(r,900)); await __lode.provaAllenatore(true); await new Promise(r=>setTimeout(r,700)); document.querySelector('.ld-proposta [data-p=dopo]').click(); await new Promise(r=>setTimeout(r,400)); return (await __lode.provaAllenatore(false)) })()`, atteso: 'rimandata' },
  { nome: "domanda all'AI locale", js: `(async()=>{ await __lode.indietro(); return T.di('spiegami in una frase cos\\'è un integrale definito', 240) })()`, atteso: 'integrale' },
  // la tua AI: Ollama espone lo stesso formato di ChatGPT/Groq/OpenRouter (/v1), qui fa da «servizio esterno» con la sua chiave finta
  { nome: 'la tua AI: la scheda', ...(FOTO ? { foto: 'tua-ai.png' } : {}), js: `(async()=>{ await __lode.indietro(); await __lode.invia('AI'); await new Promise(r=>setTimeout(r,700)); return [...document.querySelectorAll('.ld-tuaai [data-f]')].map(b=>b.dataset.f).join(',') })()`, atteso: 'anthropic,openai,google,mistral,groq,openrouter,deepseek' },
  { nome: 'la tua AI: collega un servizio in formato OpenAI', js: `(async()=>{ const F = __lode.AI.FORNITORI.openai; F.base = 'http://127.0.0.1:11434/v1'; F.preferiti = [/^gemma3:4b$/, /^qwen3/]; document.querySelector('.ld-tuaai [data-f=openai]').click(); await new Promise(r=>setTimeout(r,500)); const i = document.querySelector('.ld-ai-chiave input'); i.value = 'chiave-di-prova'; document.querySelector('.ld-ai-chiave [data-collega]').click(); await T.aspetta(() => document.querySelector('.ld-filo').innerText.includes('ChatGPT collegata'), 30); return __lode.AI.motore() + ' · ' + JSON.stringify(__lode.AI.statoAI()) + ' · ' + document.querySelector('.ld-filo').innerText.slice(-160) })()`, atteso: 'cloud' },
  { nome: 'la tua AI: risposta in streaming', pesante: true, js: `(async()=>{ await __lode.indietro(); return T.di('spiegami in una frase cos\\'è il gradiente', 300) })()`, atteso: 'gradiente' },
  { nome: 'la tua AI: carte con risposta strutturata', pesante: true, js: `(async()=>{ const c = await __lode.AI.carteDa([{ type: 'text', text: 'Il gradiente di f è il vettore delle derivate parziali e punta nella direzione di massima crescita. Un punto stazionario è un punto dove il gradiente si annulla. La matrice hessiana raccoglie le derivate seconde.' }]); return c.length + ' carte: ' + c.map(x => x.fronte).join(' | ') })()`, atteso: 'carte' },
  { nome: 'la tua AI: appunti sul computer', js: `(async()=>{ __lode.AI.impostaUso('pesante'); const r = __lode.AI.motore() + '/' + __lode.AI.motore('testo'); __lode.AI.impostaUso('tutto'); return r })()`, atteso: 'cloud/locale' },
  { nome: 'la tua AI: torna al locale', js: `(async()=>{ __lode.AI.scollegaFornitore(); return __lode.AI.motore() + '/' + __lode.AI.motore('testo') })()`, atteso: 'locale/locale' },
  { nome: 'configurazione: si apre', js: `(()=>{ location.href = location.href.split('?')[0] + '?benvenuto=1'; return 1 })()`, attesa: 500, atteso: '1' },
  { nome: 'configurazione: nome e dati di esempio', attesa: 3500, js: `(async()=>{ const w = ms => new Promise(r => setTimeout(r, ms)); const av = () => document.querySelector('[data-bv=avanti]').click(); av(); await w(900); const i = document.querySelector('#bv-nome'); i.value = 'Marco'; i.dispatchEvent(new Event('input')); const pulisci = !!document.querySelector('#bv-pulisci'); av(); await w(900); return document.querySelector('h1').innerText + ' | esempio da togliere: ' + pulisci })()`, atteso: 'Prepariamo il tuo computer. | esempio da togliere: true' },
  { nome: 'configurazione: installazioni', js: `(async()=>{ const w = ms => new Promise(r => setTimeout(r, ms)); document.querySelector('[data-bv=avanti]').click(); for (let k = 0; k < 120; k++) { await w(1000); if (document.querySelectorAll('.bv-riga.ok').length === 3) break; } return [...document.querySelectorAll('.bv-riga')].map(r => r.dataset.k + ':' + (r.classList.contains('ok') ? 'pronto' : r.querySelector('.d').textContent)).join(' | ') })()`, atteso: 'obsidian:pronto | cervello:pronto | voce:pronto' },
  { nome: 'configurazione: setup veloce e fine', js: `(async()=>{ const w = ms => new Promise(r => setTimeout(r, ms)); const av = () => document.querySelector('[data-bv=avanti]').click(); av(); await w(900); av(); await w(900); document.querySelector('#bv-corso').value = 'Matematica'; av(); await w(900); document.querySelector('#bv-lib').value = '00123 - ANALISI MATEMATICA I   1  9  28/30  12/02/2025'; document.querySelector('#bv-leggi').click(); await w(4000); av(); await w(900); document.querySelector('.bv-es .n').value = 'Geometria 2'; document.querySelector('.bv-es .d').value = '2026-12-15'; av(); await w(900); av(); await w(900); av(); await w(900); const fine = document.querySelector('.bv-corpo').innerText; setTimeout(av, 100); return fine.replace(/\\n/g, ' ').slice(0, 400) })()`, atteso: 'Fatto, Marco' },
  { attesa: 3000, js: '1' },
];
// sulla macchina Windows di GitHub (niente scheda video) i passi pesanti col modello di prova si saltano: verificano il
// formato delle chiamate ai servizi esterni, che non dipende dal sistema ed è provato sul Mac
if (CI) for (let i = passi.length - 1; i >= 0; i--) if (passi[i].pesante) { console.log('saltato su questa macchina:', passi[i].nome); passi.splice(i, 1); }
writeFileSync(join(DIR, 'passi.json'), JSON.stringify(passi));
console.log('Vault di prova:', VAULT);
const LIMITE = +process.env.LODE_LIMITE_MIN || 100;

const out = await new Promise(ok => {
  const p = spawn(ELECTRON, ['.'], { cwd: DESKTOP, env: { ...process.env, LODE_DATI: join(DIR, 'dati'), LODE_VAULT: VAULT, LODE_OBSIDIAN_DIR: join(DIR, 'obsidian'), LODE_NON_APRIRE: '1', LODE_PROVA: join(DIR, 'passi.json'), LODE_ESCI: '1', ...(FOTO ? { LODE_FOTO: FOTO } : {}) } });
  let s = '', fatto = false;
  const eco = x => { s += x; process.stdout.write(x); }, fine = () => { if (!fatto) { fatto = true; clearTimeout(cane); ok(s); } };
  p.stdout.on('data', eco); p.stderr.on('data', eco);
  const cane = setTimeout(() => {
    eco(`\nCANE DA GUARDIA: Electron fermato dopo ${LIMITE} minuti (ultimo passo finito: ${[...s.matchAll(/^passo (\d+)/gm)].pop()?.[1] ?? 'nessuno'})\n`);
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); else p.kill('SIGKILL');
    setTimeout(fine, 5000);
  }, LIMITE * 60e3);
  // su Windows un processo figlio (Ollama) può tenere aperta l'uscita e 'close' non arrivare: basta 'exit'
  p.on('close', fine); p.on('exit', () => setTimeout(fine, 5000)); p.on('error', e => { eco(`\nElectron non parte: ${e.message}\n`); fine(); });
});
const ris = Object.fromEntries([...out.matchAll(/^passo (\d+)(?: errore)?: (.*)$/gm)].map(m => [+m[1], m[2]]));
let ok = 0, ko = 0;
passi.forEach((p, i) => {
  if (!p.nome) return;
  const r = ris[i] ?? '(nessuna risposta)';
  const passa = r.toLowerCase().includes(p.atteso.toLowerCase());
  passa ? ok++ : ko++;
  console.log(`${passa ? '✓' : '✗'} ${p.nome}${passa ? '' : `\n    atteso «${p.atteso}», arrivato: ${r.slice(0, 300)}`}`); if (p.mostra && passa) console.log('    → ' + r.slice(0, 900));
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
const dati = existsSync(join(VAULT, '.lode', 'dati.json')) ? JSON.parse(readFileSync(join(VAULT, '.lode', 'dati.json'), 'utf8')) : {};
const conf = existsSync(join(DIR, 'dati', 'config.json')) ? JSON.parse(readFileSync(join(DIR, 'dati', 'config.json'), 'utf8')) : {};
verifica.push(
  ['configurazione: nome salvato, «Giulia» tolta', dati.profilo?.nome === 'Marco' && !dati.esami?.some(e => e.nome === 'Programmazione a oggetti')],
  ['configurazione: libretto ed esami salvati', dati.esami?.some(e => /analisi matematica i/i.test(e.nome) && e.voto === 28 && e.cfu === 9) && dati.esami?.some(e => e.nome === 'Geometria 2' && e.data === '2026-12-15')],
  ['configurazione: segnata come fatta', !!conf.benvenuto],
);
for (const [n, v] of verifica) { v ? ok++ : ko++; console.log(`${v ? '✓' : '✗'} ${n}`); }
if (process.env.LODE_RISULTATI) writeFileSync(process.env.LODE_RISULTATI, JSON.stringify({
  sistema: `${process.platform} ${process.arch}`, ok, ko,
  passi: passi.map((p, i) => p.nome && { nome: p.nome, passa: (ris[i] ?? '').toLowerCase().includes(p.atteso.toLowerCase()), risposta: (ris[i] ?? '(nessuna risposta)').slice(0, 1500) }).filter(Boolean),
  verifica: verifica.map(([n, v]) => ({ nome: n, passa: !!v })), registro: out.slice(-20000),
}, null, 1));
console.log(`\n${ok} passate, ${ko} fallite · nota: ${file ? join(cartella, file) : 'non creata'}`);
process.exit(ko ? 1 : 0);
