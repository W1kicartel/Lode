# Contribuire a Lode

*In English: [below](#in-english).*

Grazie. Poche regole, per tenere Lode semplice:

1. **Niente build.** HTML, CSS e moduli ES che il browser legge così come sono. Una dipendenza nuova va giustificata.
2. **Prima i dati dello studente.** Nessuna chiamata di rete senza che lo studente l'abbia chiesta; nessun tracciamento.
3. **Codice e commenti in italiano**: nomi delle funzioni, commenti, documenti per chi sviluppa. **I testi per lo studente stanno nei cataloghi** (`js/lingue/<codice>/`, regole in [docs/LINGUE.md](docs/LINGUE.md)), mai scritti a mano nel codice. In tutte le lingue: frasi brevi, niente gergo.
4. **Bianco e nero.** Gli stati si distinguono per pieno/vuoto, luminosità e peso, non per colore.
5. **Movimento morbido e rispettoso**: tutto passa da `js/motore.js` e si spegne con `prefers-reduced-motion`.
6. **L'AI propone, lo studente decide**: ogni scrittura dell'AI passa da una scheda «Conferma / Annulla».

Per provare nel browser: `python3 -m http.server 5173 --bind 127.0.0.1` e apri http://localhost:5173 (con `--bind 127.0.0.1` la cartella, `.git` compreso, la vede solo questo computer e non tutta la rete). Nuove frasi da capire? Aggiungile nel riconoscitore della loro lingua (`js/comandi/<codice>.js`; le parti senza lingua, come orari e date in cifre, stanno in `js/comandi.js`) e mettile negli esempi (`comandi.esempi` nel catalogo).

## Le traduzioni

Lode parla italiano, inglese, spagnolo, francese, tedesco e portoghese. **Le traduzioni nuove sono benvenute**, e anche le correzioni a quelle che ci sono: chi parla la lingua da sempre si accorge di cose che nessuna prova vede. Per aggiungere una lingua:

1. **Un file per area** in `js/lingue/<codice>/` (le aree sono in `js/lingue/indice.js`), con le stesse chiavi dell'italiano (`js/lingue/it/`): stessi parametri `{nome}`, stessi tag, stessi elenchi, i plurali con le forme della lingua. Una chiave che manca si vede in italiano.
2. **Una riga in `LINGUE`** di `js/lingua.js`: il nome della lingua scritto nella lingua e il locale, per esempio `nl: { nome: 'Nederlands', locale: 'nl-NL' }`.
3. **Il riconoscitore** `js/comandi/<codice>.js`: le frasi che scriverebbe davvero uno studente in quella lingua, con gli stessi oggetti `{ tipo, … }` del riconoscitore italiano. Le prove vanno in `test/comandi-lingue.mjs`.
4. **Ogni file nuovo in `sw.js`** (`FILE`), e il numero di `CACHE` sale.

`node test/lingue.mjs` controlla che i cataloghi abbiano le stesse chiavi, gli stessi parametri e gli stessi tag dell'italiano, e che siano tutti nella cache. Come si scrive un testo, come si sceglie la lingua e cosa non cambia con la lingua: [docs/LINGUE.md](docs/LINGUE.md).

## Provare senza rischi

Vale per le tue modifiche e ancora di più per quelle degli altri (una pull request, un ramo scaricato). I comandi sono in «Per chi sviluppa» nel [README](README.it.md#per-chi-sviluppa).

- **Leggi il diff prima di `npm install` o `npm start`.** Il codice gira con i tuoi permessi e può leggere tutta la tua cartella utente. Guarda soprattutto `desktop/package.json`, `desktop/package-lock.json`, `desktop/*.mjs`, `test/*.mjs` e `.github/workflows/`. Le dipendenze di una PR: `npm ci --ignore-scripts`.
- **Mai sul vault vero, mai con le chiavi vere.** `LODE_DATI` e `LODE_VAULT` (più `LODE_OBSIDIAN_DIR`) su cartelle temporanee; per l'AI quella locale o una chiave fatta apposta, con un limite di spesa basso. Le cartelle a parte proteggono i tuoi dati da un errore, non da codice scritto apposta: per quello leggi il diff o usa una macchina virtuale.
- **Foto e risultati delle prove fuori dal repository** (`LODE_FOTO`, `LODE_RISULTATI` in una cartella temporanea).

## Prima di pubblicare

- `node test/controlla-privacy.mjs`: si ferma se trova chiavi, percorsi con un nome vero (`/Users/<nome>/`, `C:\Users\<nome>\`), file privati o codice da un CDN senza versione esatta. Gira anche su GitHub.
- **Log e screenshot** in una issue o in una PR: togli il tuo nome (anche dai percorsi: scrivi `<nome>`), chiavi e token, pezzi del vault (appunti, voti, orario, il saluto della barra). Le issue le legge chiunque.
- **Un problema di sicurezza** non va in una issue: segnalalo in privato, come spiegato in [SECURITY.md](SECURITY.md).

## In English

Thank you. A few rules, to keep Lode simple:

1. **No build.** HTML, CSS and ES modules that the browser reads as they are. A new dependency needs a good reason.
2. **The student's data comes first.** No network call the student didn't ask for; no tracking.
3. **Code and comments in Italian**: function names, comments, developer docs. **Text for students lives in the catalogs** (`js/lingue/<code>/`, rules in [docs/LINGUE.md](docs/LINGUE.md)), never written by hand in the code. In every language: short sentences, no jargon.
4. **Black and white.** States are told apart by filled/empty, brightness and weight, not by colour.
5. **Soft, respectful motion**: everything goes through `js/motore.js` and turns off with `prefers-reduced-motion`.
6. **The AI suggests, the student decides**: every write by the AI goes through a “Confirm / Cancel” card.

To try it in the browser: `python3 -m http.server 5173 --bind 127.0.0.1` and open http://localhost:5173 (with `--bind 127.0.0.1` only this computer sees the folder, `.git` included, not the whole network). New sentences to understand? Add them to the recognizer for their language (`js/comandi/<code>.js`; the parts with no language, such as times and dates in digits, are in `js/comandi.js`) and put them in the examples (`comandi.esempi` in the catalog).

**Translations.** Lode speaks Italian, English, Spanish, French, German and Portuguese. **New translations are welcome**, and so are fixes to the existing ones: native speakers notice things no test can see. To add a language:

1. **One file per area** in `js/lingue/<code>/` (the areas are listed in `js/lingue/indice.js`), with the same keys as Italian (`js/lingue/it/`): same `{name}` parameters, same tags, same lists, plurals with the forms of the language. A missing key shows up in Italian.
2. **One line in `LINGUE`** in `js/lingua.js`: the language's name written in that language and its locale, for example `nl: { nome: 'Nederlands', locale: 'nl-NL' }`.
3. **The recognizer** `js/comandi/<code>.js`: the sentences a student would really type in that language, returning the same `{ tipo, … }` objects as the Italian recognizer. Its tests go in `test/comandi-lingue.mjs`.
4. **Every new file in `sw.js`** (`FILE`), and the `CACHE` number goes up.

`node test/lingue.mjs` checks that the catalogs have the same keys, parameters and tags as Italian, and that they are all in the cache. How to write a text, how the language is chosen and what doesn't change with the language: [docs/LINGUE.md](docs/LINGUE.md) (in Italian).

**Trying changes safely** — yours, and even more so other people's (a pull request, a downloaded branch). The commands are in [For developers](README.md#for-developers) in the README.

- **Read the diff before `npm install` or `npm start`.** The code runs with your permissions and can read your whole user folder. Look especially at `desktop/package.json`, `desktop/package-lock.json`, `desktop/*.mjs`, `test/*.mjs` and `.github/workflows/`. A PR's dependencies: `npm ci --ignore-scripts`.
- **Never on your real vault, never with your real keys.** `LODE_DATI` and `LODE_VAULT` (plus `LODE_OBSIDIAN_DIR`) on temporary folders; for AI, the local one or a key made for the purpose, with a low spending limit. Separate folders protect your data from a mistake, not from code written on purpose: for that, read the diff or use a virtual machine.
- **Test photos and results outside the repository** (`LODE_FOTO`, `LODE_RISULTATI` in a temporary folder).

**Before publishing.**

- `node test/controlla-privacy.mjs`: it stops if it finds keys, paths with a real name (`/Users/<name>/`, `C:\Users\<name>\`), private files or code from a CDN without an exact version. It also runs on GitHub.
- **Logs and screenshots** in an issue or a PR: remove your name (from paths too: write `<name>`), keys and tokens, pieces of your vault (notes, grades, timetable, the bar's greeting). Anyone can read issues.
- **A security problem** doesn't go in an issue: report it privately, as explained in [SECURITY.md](SECURITY.md).
