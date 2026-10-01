# Contribuire a Lode

Grazie. Poche regole, per tenere Lode semplice:

1. **Niente build.** HTML, CSS e moduli ES che il browser legge così come sono. Una dipendenza nuova va giustificata.
2. **Prima i dati dello studente.** Nessuna chiamata di rete senza che lo studente l'abbia chiesta; nessun tracciamento.
3. **Italiano ovunque**: testi, nomi delle funzioni, commenti. Frasi brevi, niente gergo.
4. **Bianco e nero.** Gli stati si distinguono per pieno/vuoto, luminosità e peso, non per colore.
5. **Movimento morbido e rispettoso**: tutto passa da `js/motore.js` e si spegne con `prefers-reduced-motion`.
6. **L'AI propone, lo studente decide**: ogni scrittura dell'AI passa da una scheda «Conferma / Annulla».

Per provare: `python3 -m http.server 5173` e apri http://localhost:5173. Nuove frasi da capire? Aggiungile in `js/comandi.js` e mettile negli esempi (`ESEMPI`).
