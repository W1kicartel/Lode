// Avvio. Nel browser: la pagina e la barra. Nell'app desktop: solo la barra, su una finestra trasparente sopra tutte
// le altre; la pagina completa («il quadro») si apre a parte dal menù dell'icona.
import { D, DESKTOP, esempio, sostituisci } from './dati.js';
import { applicaAspetto, collega, disegna } from './pagina.js';
import { avvia, azioni } from './lode.js';
import './mascotte.js';
import { t, lingua } from './lingua.js';

// la lingua scelta (js/lingua.js) anche nella pagina: lang, titolo e descrizione dal catalogo (in italiano restano quelli di index.html)
document.documentElement.lang = lingua;
document.title = t('impostazioni.titolo');
document.querySelector('meta[name=description]')?.setAttribute('content', t('impostazioni.descrizione'));

const q = new URLSearchParams(location.search), quadro = q.has('quadro');
// la prima volta (e quando la si rifà): la configurazione guidata, al posto di tutto il resto
const benvenuto = q.has('benvenuto') || (!DESKTOP && !D.imp.benvenuto && !D.esami.length);
if (benvenuto) { const B = await import('./benvenuto.js'); applicaAspetto(); B.avvia(); }
const barra = DESKTOP && !quadro && !benvenuto;
if (barra) document.documentElement.classList.add('barra');
applicaAspetto();
if (!barra && !benvenuto) { disegna(); collega(); }
if (!quadro && !benvenuto) avvia();
if (barra) addEventListener('lode:esempio', () => { sostituisci(esempio()); azioni.home(); });
if (!DESKTOP && 'serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
