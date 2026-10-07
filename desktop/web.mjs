// Dove sta l'interfaccia (index.html e js/) per il processo principale. Nel pacchetto electron-builder mette solo desktop/
// («files» in package.json): js/ c'è solo come copia in desktop/web (prepara.mjs). In sviluppo, dopo prepara.mjs, vale la
// stessa copia; senza (le prove in node su GitHub, un clone appena fatto) la radice del progetto.
// Chi nel processo principale usa un modulo di js/ lo prende da qui, mai con «../js/…»: quel percorso nel pacchetto non
// esiste e il main si romperebbe all'avvio (test/unita.mjs controlla gli import di desktop/*.mjs e desktop/sync/*.mjs)
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
export const WEB = existsSync(join(QUI, 'web', 'index.html')) ? join(QUI, 'web') : join(QUI, '..');
// un modulo dell'interfaccia: daWeb('js/nomi.js')
export const daWeb = rel => import(pathToFileURL(join(WEB, ...rel.split('/'))).href);
