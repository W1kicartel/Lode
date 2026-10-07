// Lode funziona anche senza rete: prima prova la rete (così gli aggiornamenti arrivano subito), se manca usa la copia in cache.
const CACHE = 'lode-v9';
const FILE = ['./', 'index.html', 'manifest.webmanifest', 'css/stile.css', 'css/lode.css', 'js/inizio.js', 'js/app.js', 'js/librerie.js', 'js/fornitori.js', 'js/pagina.js', 'js/lode.js', 'js/dati.js', 'js/motore.js', 'js/comandi.js', 'js/focus.js', 'js/voce.js', 'js/ai.js', 'js/mascotte.js', 'js/markdown.js', 'js/vault.js', 'js/giochi.js', 'js/formule.js', 'js/trascrizione.js', 'js/orecchio.js', 'js/file.js', 'js/sbobina.js', 'js/allenatore.js', 'js/programma.js', 'js/crocette.js', 'js/temi.js', 'js/computer.js', 'js/errori.js', 'js/anki.js', 'js/codice/albero.js', 'js/codice/modelli.js', 'js/codice/stampa.js', 'js/codice/progetto.js', 'js/codice/diario.js', 'fonts/Geist-Variable.woff2', 'fonts/GeistMono-Variable.woff2', 'icone/icona.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // l'API di Claude e le librerie da jsDelivr (versione esatta, js/librerie.js) passano dritte
  e.respondWith(fetch(e.request).then(x => { if (x.ok) { const copia = x.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); } return x; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
