// Copia l'interfaccia (index.html, css, js, font, icone) dentro desktop/web per il pacchetto dell'app, con le librerie
// della barra in web/vendor (desktop/vendor.mjs: versioni esatte da node_modules, niente CDN).
// In web/index.html la Content-Security-Policy diventa quella dell'app: script solo dalla cartella dell'app (tolti
// jsDelivr e l'import map con le impronte, che servono solo alla versione web).
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copiaVendor, cspApp } from './vendor.mjs';
const qui = dirname(fileURLToPath(import.meta.url)), radice = join(qui, '..'), web = join(qui, 'web');
rmSync(web, { recursive: true, force: true }); mkdirSync(web);
for (const x of ['index.html', 'manifest.webmanifest', 'css', 'js', 'fonts', 'icone']) cpSync(join(radice, x), join(web, x), { recursive: true });
copiaVendor(join(web, 'vendor'));
// la CSP dell'app (cspApp in vendor.mjs, LF o CRLF): se il formato di index.html cambia e non si trova cosa togliere, si ferma
const pagina = join(web, 'index.html');
writeFileSync(pagina, cspApp(readFileSync(pagina, 'utf8')));
console.log('Interfaccia copiata in desktop/web, con le librerie in web/vendor');
