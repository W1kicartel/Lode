// Le lingue nel processo principale: gli stessi cataloghi della barra (js/lingua.js), presi dalla cartella dell'interfaccia
// come fa main.mjs con WEB (desktop/web nel pacchetto, la radice del progetto in sviluppo). La lingua la sceglie main.mjs
// all'avvio con usa(): conf.lingua, se no quella del sistema. Fino ad allora vale l'italiano, quindi nei moduli del main
// niente t() in cima al file: i testi si chiedono quando servono
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const WEB = existsSync(join(QUI, 'web', 'index.html')) ? join(QUI, 'web') : join(QUI, '..');
const L = await import(pathToFileURL(join(WEB, 'js', 'lingua.js')).href);
export const { t, elenco, usa, LINGUE } = L;
export const lingua = () => L.lingua;
// la lingua del sistema (app.getLocale(), «it-IT», «pt-BR»…) se Lode la conosce, altrimenti l'inglese (docs/LINGUE.md)
export function dalSistema(locale) { const c = String(locale || '').slice(0, 2).toLowerCase(); return Object.hasOwn(LINGUE, c) ? c : 'en'; }
