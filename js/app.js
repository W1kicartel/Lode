// Avvio: la pagina, poi la barra in cima, poi la mascotte. Offline grazie al service worker.
import { applicaAspetto, collega, disegna } from './pagina.js';
import { avvia } from './lode.js';
import './mascotte.js';

applicaAspetto();
disegna();
collega();
avvia();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
