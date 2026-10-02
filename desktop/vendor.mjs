// Le librerie di altri che la barra carica solo quando servono: pdf.js (leggere i PDF), Temml (le formule delle sbobine) e
// transformers.js con onnxruntime (Whisper, la voce su Windows, Linux e Mac Intel). Prima arrivavano da un CDN con una
// versione «circa» (o nessuna): un rilascio malevolo su npm sarebbe finito nella finestra con la chiave AI e il ponte verso
// il vault. Ora hanno la versione esatta in package.json (devDependencies, con l'impronta nel package-lock) e questo file
// le copia da node_modules in vendor/, accanto a index.html:
//   • nell'app impacchettata: prepara.mjs le copia in desktop/web/vendor;
//   • in sviluppo (npm start, test/prova-app.mjs): main.mjs le copia in vendor/ nella cartella di Lode (ignorata da git),
//     se mancano o se le versioni sono cambiate.
// Solo i file per il browser: onnxruntime-node, sharp e le parti per Node non si installano (overrides → vuoto/).
// I file .wasm pesano ~21 MB: non stanno nel repository, si rigenerano da node_modules.
// Uso a mano: node vendor.mjs [cartella]   (predefinita: vendor/ nella cartella di Lode)
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
// pacchetto → i file che servono alla barra (stesso percorso dentro vendor/<pacchetto>/), più la licenza
export const LIBRERIE = {
  'pdfjs-dist': ['build/pdf.min.mjs', 'build/pdf.worker.min.mjs', 'LICENSE'],
  temml: ['dist/temml.mjs', 'LICENSE'],
  '@huggingface/transformers': ['dist/transformers.min.js', 'dist/ort-wasm-simd-threaded.jsep.mjs', 'dist/ort-wasm-simd-threaded.jsep.wasm', 'LICENSE'],
};
// le versioni volute: quelle esatte di package.json (le stesse di js/librerie.js, controllate da test/unita.mjs)
export const versioni = () => {
  const p = JSON.parse(readFileSync(join(QUI, 'package.json'), 'utf8'));
  return Object.fromEntries(Object.keys(LIBRERIE).map(n => [n, p.devDependencies?.[n]]));
};
const installata = n => { try { return JSON.parse(readFileSync(join(QUI, 'node_modules', n, 'package.json'), 'utf8')).version; } catch { return null; } };

// copia le librerie in <dest> e scrive <dest>/versioni.json; se manca qualcosa (npm install non fatto) lo dice chiaro
export function copiaVendor(dest) {
  const v = versioni();
  for (const [n, file] of Object.entries(LIBRERIE)) {
    if (installata(n) !== v[n]) throw new Error(`${n} ${v[n]} non è installato in desktop/node_modules (c'è ${installata(n) || 'niente'}): esegui «npm install» nella cartella desktop`);
    for (const f of file) { const a = join(QUI, 'node_modules', n, f), b = join(dest, n, f); mkdirSync(dirname(b), { recursive: true }); copyFileSync(a, b); }
  }
  writeFileSync(join(dest, 'versioni.json'), JSON.stringify(v, null, 1));
  return v;
}
// in sviluppo: ricopia solo se vendor/ manca o ha versioni diverse da package.json
export function vendorAggiornato(dest) {
  let c = null; try { c = JSON.parse(readFileSync(join(dest, 'versioni.json'), 'utf8')); } catch { }
  const v = versioni();
  if (c && Object.keys(LIBRERIE).every(n => c[n] === v[n] && LIBRERIE[n].every(f => existsSync(join(dest, n, f))))) return false;
  rmSync(dest, { recursive: true, force: true });
  copiaVendor(dest); return true;
}
// La Content-Security-Policy dell'app (prepara.mjs, per desktop/web/index.html): le librerie arrivano da vendor/, quindi
// via jsDelivr e l'import map con le impronte, che servono solo alla versione web. Fine riga LF o CRLF: su Windows Git
// scrive spesso index.html con CRLF (core.autocrlf, anche sui runner di GitHub) e una regex che voleva solo «\n» fermava la
// build. Se il formato di index.html cambia e non si trova cosa togliere, ci si ferma (meglio che un pacchetto con la CSP
// sbagliata). test/unita.mjs la prova su index.html con LF e con CRLF
export function cspApp(html) {
  const dopo = html.replace(/<script type="importmap">[^<]*<\/script>\r?\n/, '')
    .replace(/ 'sha256-[A-Za-z0-9+/=]+'/, '').replace(/ https:\/\/cdn\.jsdelivr\.net\/\S+?(?=[ ;])/g, '');
  const csp = dopo.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)?.[0] || '';
  if (!csp || /jsdelivr|'sha256-/.test(csp) || dopo.includes('type="importmap"')) throw new Error('prepara.mjs: non riesco a preparare la Content-Security-Policy dell\'app in web/index.html');
  return dopo;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dest = process.argv[2] || join(QUI, '..', 'vendor');
  rmSync(dest, { recursive: true, force: true });
  console.log('Librerie copiate in', dest, copiaVendor(dest));
}
