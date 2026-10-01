// Avvio. Nel browser: la pagina e la barra. Nell'app desktop: solo la barra, su una finestra trasparente sopra tutte
// le altre; la pagina completa («il quadro») si apre a parte dal menù dell'icona.
import { DESKTOP, esempio, sostituisci } from './dati.js';
import { applicaAspetto, collega, disegna } from './pagina.js';
import { avvia, azioni } from './lode.js';
import './mascotte.js';

const quadro = new URLSearchParams(location.search).has('quadro');
const barra = DESKTOP && !quadro;
if (barra) document.documentElement.classList.add('barra');
applicaAspetto();
if (!barra) { disegna(); collega(); }
if (!quadro) avvia();
if (barra) addEventListener('lode:esempio', () => { sostituisci(esempio()); azioni.home(); });
if (!DESKTOP && 'serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
