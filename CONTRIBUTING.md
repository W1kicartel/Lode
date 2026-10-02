# Contribuire a Lode

Grazie. Poche regole, per tenere Lode semplice:

1. **Niente build.** HTML, CSS e moduli ES che il browser legge così come sono. Una dipendenza nuova va giustificata.
2. **Prima i dati dello studente.** Nessuna chiamata di rete senza che lo studente l'abbia chiesta; nessun tracciamento.
3. **Italiano ovunque**: testi, nomi delle funzioni, commenti. Frasi brevi, niente gergo.
4. **Bianco e nero.** Gli stati si distinguono per pieno/vuoto, luminosità e peso, non per colore.
5. **Movimento morbido e rispettoso**: tutto passa da `js/motore.js` e si spegne con `prefers-reduced-motion`.
6. **L'AI propone, lo studente decide**: ogni scrittura dell'AI passa da una scheda «Conferma / Annulla».

Per provare nel browser: `python3 -m http.server 5173 --bind 127.0.0.1` e apri http://localhost:5173 (con `--bind 127.0.0.1` la cartella, `.git` compreso, la vede solo questo computer e non tutta la rete). Nuove frasi da capire? Aggiungile in `js/comandi.js` e mettile negli esempi (`ESEMPI`).

## Provare senza rischi

Vale per le tue modifiche e ancora di più per quelle degli altri (una pull request, un ramo scaricato). I comandi sono in «Per chi sviluppa» nel [README](README.md#per-chi-sviluppa).

- **Leggi il diff prima di `npm install` o `npm start`.** Il codice gira con i tuoi permessi e può leggere tutta la tua cartella utente. Guarda soprattutto `desktop/package.json`, `desktop/package-lock.json`, `desktop/*.mjs`, `test/*.mjs` e `.github/workflows/`. Le dipendenze di una PR: `npm ci --ignore-scripts`.
- **Mai sul vault vero, mai con le chiavi vere.** `LODE_DATI` e `LODE_VAULT` (più `LODE_OBSIDIAN_DIR`) su cartelle temporanee; per l'AI quella locale o una chiave fatta apposta, con un limite di spesa basso. Le cartelle a parte proteggono i tuoi dati da un errore, non da codice scritto apposta: per quello leggi il diff o usa una macchina virtuale.
- **Foto e risultati delle prove fuori dal repository** (`LODE_FOTO`, `LODE_RISULTATI` in una cartella temporanea).

## Prima di pubblicare

- `node test/controlla-privacy.mjs`: si ferma se trova chiavi, percorsi con un nome vero (`/Users/<nome>/`, `C:\Users\<nome>\`), file privati o codice da un CDN senza versione esatta. Gira anche su GitHub.
- **Log e screenshot** in una issue o in una PR: togli il tuo nome (anche dai percorsi: scrivi `<nome>`), chiavi e token, pezzi del vault (appunti, voti, orario, il saluto della barra). Le issue le legge chiunque.
- **Un problema di sicurezza** non va in una issue: segnalalo in privato, come spiegato in [SECURITY.md](SECURITY.md).
