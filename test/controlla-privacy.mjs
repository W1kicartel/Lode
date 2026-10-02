// Prima di pubblicare: node test/controlla-privacy.mjs
// Il repository è pubblico. Questo controllo legge i file che finirebbero su GitHub (quelli già in git più quelli nuovi che
// «git add -A» aggiungerebbe: tutto tranne gli ignorati da .gitignore) e si ferma con un errore se trova:
// • chiavi e token (Claude, OpenAI, Gemini, Groq, OpenRouter, Hugging Face, GitHub, npm, AWS, chiavi private);
// • percorsi con un nome vero, come /Users/<nome>/, /home/<nome>/ o C:\Users\<nome>\ (i nomi finti delle prove vanno bene),
//   e il nome utente di chi lo lancia scritto da qualche parte;
// • file che non si pubblicano: .env, certificati, impostazioni degli editor, dati e configurazione dell'app, un vault di prova
//   (.lode/), foto e risultati delle prove, registri, registrazioni audio;
// • codice da un CDN senza la versione esatta (x.y.z) e «npx --yes» con un pacchetto senza versione esatta: prenderebbero
//   l'ultima versione pubblicata, cioè codice che nessuno di noi ha letto;
// • pacchetti di desktop/package-lock.json che non vengono dal registro npm o senza impronta (integrity).
// Senza git (una cartella scaricata come zip) legge tutta la cartella, tranne .git, node_modules e le cartelle che l'app o
// le prove rigenerano. Di quello che trova stampa solo dove e cosa, mai il valore: il registro della CI è pubblico.
// Gira anche su GitHub, nelle prove unitarie (.github/workflows/prove.yml). Nessuna dipendenza.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';

const RADICE = fileURLToPath(new URL('../', import.meta.url));
const problemi = [];
const segnala = (dove, cosa) => problemi.push(`${dove}: ${cosa}`);
// un nome si mostra solo con l'iniziale: chi legge il registro capisce dove guardare, il nome non finisce in pubblico
const coperto = n => n[0] + '…';

/* ---------- quali file: quelli che git pubblicherebbe ---------- */
// senza git: queste cartelle non si pubblicano mai (dipendenze, librerie copiate, pacchetti, compilazioni, impostazioni locali)
const SALTA_NOMI = new Set(['.git', 'node_modules', '.claude', '.build', '.pm', '.swiftpm', 'xcuserdata']);
const SALTA_PERCORSI = new Set(['vendor', 'desktop/bin', 'desktop/dist', 'desktop/web', 'desktop/voce-mac/vendor', 'desktop/voce-mac/build']);
function elenco() {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: RADICE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 });
    return { daGit: true, file: [...new Set(out.split('\0').filter(Boolean))].filter(f => existsSync(join(RADICE, f))) };   // i cancellati non ancora in un commit non ci sono più
  } catch { }
  const file = [];
  (function visita(dir) {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n), rel = relative(RADICE, p).split(sep).join('/');
      if (SALTA_NOMI.has(n) || SALTA_PERCORSI.has(rel)) continue;
      if (statSync(p).isDirectory()) visita(p); else file.push(rel);
    }
  })(RADICE);
  return { daGit: false, file };
}
const { daGit, file: FILE } = elenco();

/* ---------- file che non si pubblicano, dal solo nome ---------- */
const VIETATI = [
  [/(^|\/)\.env(\.(?!example$)[^/]+)?$/, 'variabili d\'ambiente (.env): di solito ci sono chiavi'],
  [/(^|\/)electron-builder\.env$/, 'segreti di electron-builder (GH_TOKEN, password dei certificati)'],
  [/\.(p12|pfx|pem|key|p8|cer|mobileprovision|keystore|jks)$/i, 'certificato o chiave privata'],
  [/(^|\/)(xcuserdata|\.swiftpm|\.vscode|\.idea)\//, 'impostazioni locali di un editor: contengono percorsi e nome utente'],
  [/(^|\/)\.lode\//, 'dati di un vault (.lode/): voti, appunti, statistiche di chi studia'],
  [/(^|\/)(config|dati)\.json$/, 'configurazione o dati dell\'app (vault, progetti seguiti)'],
  [/(^|\/)risultati[^/]*\.json$/, 'risultati delle prove: il «registro» ha i percorsi della macchina'],
  [/^foto\//, 'foto delle prove: la barra mostra nome, voti e orario'],
  [/\.(ldb|sqlite3?|db)$/i, 'database locale (Local Storage, Thumbs.db…)'],
  [/(^|\/)(desktop\.ini|\.DS_Store)$/, 'file di sistema'],
  [/\.log$/i, 'registro: di solito ha percorsi e nome utente'],
  [/\.(wav|aiff?|f32|m4a|mp3|webm|ogg|flac)$/i, 'audio: potrebbe essere una registrazione (le prove usano .pcm sintetici in test/audio)'],
];
for (const f of FILE) for (const [re, perché] of VIETATI) if (re.test(f)) { segnala(f, `file da non pubblicare (${perché})`); break; }

/* ---------- dentro i file ---------- */
const BINARI = /\.(png|jpe?g|gif|webp|ico|icns|woff2?|ttf|otf|pcm|pdf|zip|gz|dmg|exe|appimage|wasm|onnx|bin)$/i;
const SEGRETI = [   // l'ordine conta: i prefissi più lunghi prima (sk-ant- e sk-or- somigliano a una chiave OpenAI)
  ['una chiave di Claude (Anthropic)', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['una chiave di OpenRouter', /sk-or-v1-[A-Za-z0-9]{32,}/],
  ['una chiave di OpenAI o DeepSeek', /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/],
  ['una chiave di Google (Gemini)', /AIza[0-9A-Za-z_-]{35}/],
  ['una chiave di Groq', /\bgsk_[A-Za-z0-9]{40,}/],
  ['un token di Hugging Face', /\bhf_[A-Za-z0-9]{30,}/],
  ['un token di GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['un token di npm', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['una chiave di AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['un token di Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
];
// valori finti scritti apposta nelle prove o negli esempi
const FINTO = /prova|finta|finto|esempio|x{6,}|0{8,}/i;
// la chiave privata vera ha il contenuto sotto l'intestazione: la sola intestazione citata in una guida va bene
const CHIAVE_PRIVATA = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----\s*\r?\n\s*[A-Za-z0-9+/=]{20,}/g;
// /Users/<nome>, /home/<nome>, C:\Users\<nome> (anche con \\ dentro le stringhe e con /). Un segnaposto (<nome>, $USER,
// %USERNAME%, ${…}, *) non è un nome: il primo carattere non rientra nella classe e il percorso non conta
const PERCORSO = /(?:\/Users\/|\/home\/|\b[A-Za-z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/))([^/\\\s"'`<>$%{}()*,;:|…]+)/g;
// i nomi finti delle prove (test/errori.mjs, test/progetto.mjs, test/aggiorna.mjs), gli utenti dei runner di GitHub e le
// cartelle di sistema che non sono una persona
const NOMI_FINTI = new Set(['studente', 'stud', 'anna', 's', 'nome', 'utente', 'tuonome', 'runner', 'runneradmin', 'shared', 'public', 'default', 'default user', 'all users']);
// il nome utente di chi lancia il controllo, se è un nome vero e non una parola che può stare nel testo
const GENERICI = new Set(['admin', 'administrator', 'user', 'utente', 'root', 'test', 'prova', 'dev', 'lode', 'ubuntu', 'ec2-user', 'vagrant']);
let IO = ''; try { IO = userInfo().username.toLowerCase(); } catch { }
const reIo = IO.length >= 4 && !NOMI_FINTI.has(IO) && !GENERICI.has(IO) ? new RegExp(`(?<![A-Za-z0-9])${IO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'i') : null;
// codice da un CDN: il pacchetto (anche @ambito/nome) e la versione, se c'è
const CDN = /(?:cdn\.jsdelivr\.net\/npm\/|unpkg\.com\/|esm\.sh\/|cdn\.skypack\.dev\/|ga\.jspm\.io\/npm:)((?:@[^/\s'"`]+\/)?[^/@\s'"`]+)(@[^/\s'"`?#]*)?/g;
const CDN_GH = /cdn\.jsdelivr\.net\/gh\/([^/\s'"`]+\/[^/@\s'"`]+)(@[^/\s'"`?#]*)?/g;
const CDNJS = /cdnjs\.cloudflare\.com\/ajax\/libs\/([^/\s'"`]+)\/([^/\s'"`]+)/g;
const ESATTA = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
// «${VERSIONI[p]}»: la versione viene da js/librerie.js, che qui sotto si controlla a parte
const daVersioni = v => /^\$\{(?:[A-Za-z_]+\.)?VERSIONI\[/.test(v);
// npx: solo con --yes/-y scarica ed esegue senza chiedere; senza, usa il pacchetto già installato (desktop/node_modules)
const NPX = /\bnpx\s+((?:-[^\s`'"]+\s+)*)([^\s`'"-][^\s`'"]*)/g;

let letti = 0;
for (const f of FILE) {
  if (BINARI.test(f)) continue;
  let testo;
  try { const b = readFileSync(join(RADICE, f)); if (b.subarray(0, 8000).includes(0)) continue; testo = b.toString('utf8'); } catch { continue; }
  letti++;
  for (const m of testo.matchAll(CHIAVE_PRIVATA)) segnala(`${f}:${testo.slice(0, m.index).split('\n').length}`, 'sembra una chiave privata (con il contenuto)');
  testo.split(/\r?\n/).forEach((r, i) => {
    const dove = `${f}:${i + 1}`;
    for (const [tipo, re] of SEGRETI) { const m = r.match(re); if (m && !FINTO.test(m[0])) { segnala(dove, `sembra ${tipo}`); break; } }
    for (const m of r.matchAll(PERCORSO)) if (!NOMI_FINTI.has(m[1].toLowerCase())) segnala(dove, `percorso con un nome vero (${coperto(m[1])}): usa un nome finto o <nome>`);
    if (reIo && reIo.test(r)) segnala(dove, `c'è il tuo nome utente (${coperto(IO)})`);
    for (const m of r.matchAll(CDN)) { const v = (m[2] || '').slice(1); if (!ESATTA.test(v) && !daVersioni(v)) segnala(dove, `codice da CDN senza versione esatta (${m[1]}${m[2] || ''}): scrivi pacchetto@x.y.z`); }
    for (const m of r.matchAll(CDN_GH)) { const v = (m[2] || '').slice(1); if (!/^v?\d+\.\d+\.\d+$/.test(v) && !/^[0-9a-f]{40}$/.test(v)) segnala(dove, `codice da CDN senza versione esatta (${m[1]}${m[2] || ''}): un tag x.y.z o il commit intero`); }
    for (const m of r.matchAll(CDNJS)) if (!ESATTA.test(m[2])) segnala(dove, `codice da CDN senza versione esatta (${m[1]}/${m[2]})`);
    for (const m of r.matchAll(NPX)) {
      const sì = /(^|\s)(--yes|-y)(\s|$)/.test(m[1]), v = m[2].match(/^(?:@[^/]+\/)?[^@]+@(.+)$/)?.[1] || '';
      if (sì && !ESATTA.test(v)) segnala(dove, `«npx» con --yes e senza versione esatta (${m[2]}): scarica l'ultima pubblicata, scrivi pacchetto@x.y.z`);
    }
  });
}

/* ---------- le versioni di js/librerie.js (gli URL della barra le prendono da lì) ---------- */
try {
  const { VERSIONI } = await import('../js/librerie.js');
  for (const [p, v] of Object.entries(VERSIONI)) if (!ESATTA.test(v)) segnala('js/librerie.js', `${p} senza versione esatta (${v})`);
} catch (e) { segnala('js/librerie.js', `non si legge (${e.message})`); }

/* ---------- desktop/package-lock.json: tutto dal registro npm, ogni pacchetto con l'impronta ---------- */
// una PR può far puntare un pacchetto a un altro archivio (con la sua integrity): npm install lo scaricherebbe e ne
// eseguirebbe gli script. I «link» (i pacchetti vuoti di desktop/vuoto) devono restare dentro desktop/
try {
  const lock = JSON.parse(readFileSync(join(RADICE, 'desktop', 'package-lock.json'), 'utf8'));
  for (const [nome, v] of Object.entries(lock.packages || {})) {
    if (!nome) continue;
    if (v.link) { if (/^(\/|[A-Za-z]:|\w+:)|(^|\/)\.\.(\/|$)/.test(v.resolved || '')) segnala('desktop/package-lock.json', `${nome} punta fuori da desktop/ (${v.resolved})`); continue; }
    if (v.resolved === undefined) continue;   // cartelle dentro un altro pacchetto (come node_modules/…/vuoto): niente da scaricare
    if (!v.resolved.startsWith('https://registry.npmjs.org/')) segnala('desktop/package-lock.json', `${nome} non viene dal registro npm (${v.resolved})`);
    else if (!v.integrity) segnala('desktop/package-lock.json', `${nome} senza impronta (integrity)`);
  }
} catch (e) { segnala('desktop/package-lock.json', `non si legge (${e.message})`); }

if (problemi.length) {
  console.log(problemi.map(p => '✗ ' + p).join('\n'));
  console.log(`\ncontrolla-privacy: ${problemi.length} problemi in ${FILE.length} file${daGit ? '' : ' (senza git: tutta la cartella)'}. Togli o sistema prima di pubblicare.`);
  process.exit(1);
}
console.log(`controlla-privacy: ${FILE.length} file (${letti} letti), niente chiavi, nomi veri, file privati o codice senza versione esatta`);
