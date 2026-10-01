// Copia l'interfaccia (index.html, css, js, font, icone) dentro desktop/web per il pacchetto dell'app.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const qui = dirname(fileURLToPath(import.meta.url)), radice = join(qui, '..'), web = join(qui, 'web');
rmSync(web, { recursive: true, force: true }); mkdirSync(web);
for (const x of ['index.html', 'manifest.webmanifest', 'css', 'js', 'fonts', 'icone']) cpSync(join(radice, x), join(web, x), { recursive: true });
console.log('Interfaccia copiata in desktop/web');
