# Lode

**L'assistente di studio per chi fa l'università. Open source, gratis, i dati restano tuoi.**

Lode vive in una piccola barra di vetro nero in cima allo schermo. A riposo ti dice una cosa sola: il prossimo esame, le carte da ripassare o il tempo che scorre. Ci passi sopra e si apre: il piano di oggi, sei strumenti, un campo dove scrivere (o parlare) in italiano normale.

```
focus 50 su analisi 2
ho preso 28 in fisica
esame basi di dati il 15 gennaio 9 cfu
quanto mi serve per 110
se prendo 30 in analisi 2
ripassa analisi
carta: teorema di Green = l'integrale di linea sul bordo è uguale…
interrogami su basi di dati
```

Niente account, niente server, niente pubblicità. Si apre nel browser, funziona offline, si installa come app su computer e telefono.

## Al primo avvio

Una finestra di benvenuto in due parti:
- **Obbligatoria.** Come ti chiami, poi un clic per installare **Obsidian** (l'installer ufficiale), il **cervello locale** (Ollama + Gemma 3, scelto in base alla memoria del computer) e la **voce**: sui Mac con chip Apple è Parakeet v3 sul Neural Engine, altrove Whisper.
- **Facoltativa, il setup veloce:**
  - ateneo e corso;
  - il **libretto incollato da Esse3**, letto anche senza AI;
  - gli esami da dare con le date;
  - l'**orario**, scritto a parole, incollato dal sito o importato dal calendario `.ics`;
  - quando studi, quanto spesso Lode può proporti cose e le ore di silenzio.

Si rifà dal menu dell'icona («Rifai la configurazione…»).

## L'allenatore

Dì a Lode quando hai l'esame: «ho l'esame di analisi 2 il 15 gennaio», «l'appello di fisica è il 3 febbraio», «analisi 2 spostato al 20». In momenti a caso della giornata, quando sei al computer e libero, la pillola si allunga e ti propone una cosa piccola. Per esempio:
- *2 minuti su 6 definizioni?*
- *8 carte da ripassare*
- *Rileggi le cose che il prof ha detto «da esame»*
- *Tre domande lampo, come all'orale?*
- *Oggi ti mancano 2 h: un focus?*

Rispondi con **Gioca** o con **Dopo**. Più l'esame è vicino, più le proposte sono frequenti. Mai a lezione, in focus, durante una trascrizione o nelle ore di silenzio. Lode impara: le proposte che accetti tornano più spesso, e la [[Memoria]] le registra. Per regolarle: «proposte poche / normali / frequenti», «spegni le proposte».

## In aula, a casa, nel tuo vault Obsidian

L'**app desktop** mette la barra sopra tutte le finestre. Al primo avvio:
- crea un **vault Obsidian** in `Documenti/Lode`;
- con un clic da «Prepara Lode» installa **Obsidian** (l'installer ufficiale) e un **cervello locale**: Ollama + Gemma 3, scelto in base alla memoria del computer;
- prepara la **voce**: sui Mac con chip Apple **Parakeet v3** di NVIDIA sul Neural Engine, con [FluidAudio](https://github.com/FluidInference/FluidAudio) (Apache 2.0, lo stesso motore dell'app FluidVoice). Su Windows e Linux c'è Whisper, che gira dentro la barra. Su un minuto di lezione Parakeet trascrive in 0,8 s quasi senza errori e con la punteggiatura, Whisper base in 3,7 s.

Tutto funziona sul computer, senza account e senza internet.

- **Sa quando sei a lezione.** Scrivi una volta «lezione analisi 2 lunedì e mercoledì 9-11 aula 7». Da quel momento la barra mostra `● Analisi 2 · fine tra 23 min · ★2`.
- **Trascrive la lezione intera** (⌃⌥R). Ogni 20-30 secondi aggiunge le parole del prof alla nota della lezione in Obsidian, quindi niente si perde. Le **formule dette a voce diventano LaTeX**: «l'integrale da zero a pi greco di seno di x in d x» → $\int_{0}^{\pi} \sin x \, dx$. L'audio non viene mai salvato.
- **Ripeti** (⌃⌥P): ti sei perso una frase? In aula Lode tiene in memoria gli ultimi 60 secondi, solo in RAM e mai su disco, e su richiesta te li trascrive. Poi puoi aggiungerli agli appunti o segnarli come ★.
- **Sbobine da passare ai compagni.** Con «condividi la sbobina» Lode crea due file: un `.md` per Obsidian e una pagina `.html` che si apre su qualsiasi telefono, con le formule disegnate. Partono dal menu Condividi (AirDrop, Messaggi, Mail…). Chi ha Lode trascina la sbobina sulla pillola e se la ritrova nel vault, con definizioni e ★ pronte per i giochi.
- **Trascina un file sulla pillola, anche chiusa.** Si allarga in una zona di rilascio e poi chiede *cosa ne faccio?*. Accetta:
  - PDF e slide `.pptx`: carte del ripasso, riassunto in Obsidian, definizioni per i giochi, interrogazione, allegato alla lezione;
  - foto della lavagna: trascritta in appunti con le formule;
  - registrazioni audio: trascritte nella lezione;
  - appunti `.md`, `.txt` e `.docx`;
  - sbobine dei compagni;
  - carte di Anki.
- **Riordina.** A fine lezione il modello locale (o Claude) trasforma la trascrizione in appunti puliti, con titoli, punti e formule. Poi ne estrae definizioni e ★ da esame.
- **Cattura veloce senza lasciare gli appunti:** ⌃⌥S **★ Da esame**, ⌃⌥D **Definizione**, ⌃⌥Q **Domanda per il prof**.
- **Voce:** tieni premuto ⌥ Spazio e parla. Esempi: «ho preso ventotto in fisica due», «definizione nucleofilo uguale specie ricca di elettroni», «spiegami il teorema di Green».
- **A casa ti allena:** «2 minuti · 6 definizioni di Analisi 2 di stamattina». I giochi sono abbina, chi sono?, completa e flash.
- **Impara con te:** Lode scrive e rilegge `Lode/Memoria.md`, il Glossario e le pagine dei corsi. Più usi Lode, più sa cosa ripassare e come aiutarti (vedi «Come cresce» qui sotto).

```bash
cd desktop && npm install && npm start
```

Per i pacchetti: `npm run dist:mac`, `dist:win`, `dist:linux`.

**Prove:**
- `node test/unita.mjs` controlla comandi, formule, note e conti;
- `node test/prova-app.mjs`, solo su macOS, fa un giro completo dell'app su un vault temporaneo. Le frasi «parlate» le genera la voce di sistema.

## Come cresce con ogni studente

Lode non ha un server e non addestra un modello: **la sua memoria è il vault Obsidian dello studente**. Sono file Markdown leggibili, che lo studente può correggere e sincronizzare come vuole.

1. **Ogni lezione è una nota.** Contiene appunti, ★, definizioni, domande, trascrizione e appunti riordinati. Lode la rilegge a ogni modifica, anche quando scrivi in Obsidian.
2. **Ogni definizione ha una memoria.** Ogni risposta ai giochi e al ripasso aggiorna quando ripresentarla (ripetizione dilazionata SM-2). Quelle sbagliate tornano prima, quelle sicure si diradano.
3. **`Lode/Memoria.md`** è il riassunto di cosa sai, cosa sbagli, quando studi e le ★ recenti. Nella sezione «Note per Lode» gli dici come vuoi essere aiutato.
4. **L'AI legge tutto questo a ogni domanda**, insieme alle ultime lezioni: orario, esami, ★, definizioni e appunti. Le spiegazioni e l'orale sono quindi sul *tuo* corso, con le parole del *tuo* prof.
5. **Pagine generate:** Home, Esami, Glossario e le pagine dei corsi si aggiornano da sole e collegano tutto. Lode scrive solo dentro i suoi riquadri, il resto è tuo.

## Cosa fa

| | |
|---|---|
| **Libretto** | Media ponderata e aritmetica, **base di laurea** (media × 110 / 30), CFU fatti e mancanti. La lode vale quanto dice il tuo ateneo (30, 31, 32 o 33). |
| **Che voto mi serve** | «quanto mi serve per 105» → la media che ti serve nei CFU che mancano. «se prendo 30 in analisi» → come cambia la media, subito. |
| **Piano per gli appelli** | Ogni esame ha le sue ore previste (10 per CFU, le cambi). Lode conta i giorni e ti dice quante ore fare **oggi** per arrivarci in pari. |
| **Focus** | Il timer sta nella barra, sempre visibile. A fine sessione un rintocco, la pausa parte da sola, le ore entrano nel piano dell'esame. Serie di giorni di fila. |
| **Ripasso a intervalli** | Flashcard con l'algoritmo SM-2: Spazio per girare, 1-4 per rispondere. Le difficili tornano domani, le facili tra settimane. Importa i mazzi di Anki (testo con tab). |
| **Voce** | Tieni premuto ⌥ Spazio (Ctrl ⇧ Spazio su Windows) e parla. Gratis, nel browser. |
| **AI (facoltativa)** | Con la tua chiave Claude: spiegazioni da tutor, **carte del ripasso da PDF, slide e foto della lavagna** (trascinali sulla finestra), e **l'interrogazione**: un prof d'orale che fa una domanda alla volta, ti corregge e alla fine ti dà un voto onesto. |

Lode non scrive mai niente da solo: quello che propone l'AI (carte, esami, voti) arriva con **Conferma / Annulla**, e ogni comando si può annullare con un clic.

## Come si usa

**Online:** apri il sito (GitHub Pages) e premi «prova con i dati di esempio» per vederlo pieno in dieci secondi. Dal menu del browser: *Installa app*.

**Sul tuo computer:**

```bash
git clone https://github.com/<tuo-utente>/lode && cd lode
python3 -m http.server 5173
```

poi apri http://localhost:5173. Non c'è niente da compilare: HTML, CSS e JavaScript a moduli.

Scorciatoie: **/** o **⌘K** per scrivere, **⌥ Spazio** tenuto premuto per parlare, **Esc** per chiudere, **Spazio** e **1-4** nel ripasso.

## Privacy

- Tutto sta nel `localStorage` del tuo browser. Da *Esporta* scarichi un backup JSON; da *Importa un backup* lo rimetti, anche su un altro computer.
- La chiave Claude resta in questo browser e parte solo verso `api.anthropic.com`. Non finisce nei backup.
- Senza chiave non esce nessun dato dal computer: comandi, timer, libretto e ripasso sono locali.

## Quanto costa l'AI

Lode usa Claude Opus 5.5 con la chiave dello studente (si crea su [console.anthropic.com](https://console.anthropic.com)). Una spiegazione costa circa due centesimi, un'interrogazione intera una decina, le carte da un PDF di 30 pagine qualche decina. Senza chiave tutto il resto funziona uguale.

## Com'è fatto

| File | Cosa fa |
|---|---|
| `js/lode.js` | La barra: pillola, pannello a molla, conversazione, strumenti, conferme, voce, file trascinati |
| `js/comandi.js` | Capisce l'italiano senza AI: date («15/1», «lunedì», «tra 10 giorni»), voti, minuti, nomi d'esame approssimati |
| `js/dati.js` | Dati e conti: media, base di laurea, voto che serve, piano, SM-2 |
| `js/focus.js` | Il timer: sopravvive al ricaricamento, notifiche, rintocco sintetizzato |
| `js/ai.js` | Claude in streaming con strumenti (carte, esami, voti, focus) e il prof dell'orale |
| `js/voce.js` | Riconoscimento e lettura ad alta voce del browser, in italiano |
| `js/mascotte.js` | La gemma con gli occhi: guarda il cursore, ascolta, pensa, legge mentre studi, salta quando finisci |
| `js/motore.js` | Un solo ciclo di animazione: curve morbide, entrate sfocate, molle senza rimbalzi |
| `js/pagina.js` | La pagina sotto la barra (nel browser) o «il quadro» (nell'app): numeri, appelli, libretto, mazzi, impostazioni |
| `js/markdown.js` | Le note di Obsidian: modello della lezione, lettura di definizioni/★/domande, inserimento in una sezione, orario come tabella |
| `js/vault.js` | Il vault visto dalla barra: annota nella lezione giusta, apre Obsidian, scrive la Memoria |
| `js/giochi.js` | I giochi di memoria: abbina, chi sono?, completa, flash |
| `js/trascrizione.js` | La lezione intera: microfono → pezzi da 20-30 s → Parakeet o Whisper → formule → nota Obsidian, salvata a ogni pezzo |
| `desktop/voce-mac/` | `lode-voce`: Parakeet v3 (FluidAudio) sul Neural Engine. Si compila con `desktop/voce-mac/compila.sh`, che aggira due difetti dei Command Line Tools 16.4 |
| `desktop/voce.mjs` | Avvia `lode-voce` e gli passa l'audio |
| `js/orecchio.js` | Il microfono condiviso in aula, con gli ultimi 90 secondi solo in memoria (per «Ripeti») |
| `js/file.js` | I file trascinati: tipo, testo di PDF (pdf.js), Word e PowerPoint (zip di XML), audio a 16 kHz |
| `js/sbobina.js` | Sbobine da condividere (.md + .html con formule MathML) e sbobine ricevute |
| `js/benvenuto.js` | La configurazione guidata: nome, installazioni, setup veloce (libretto da Esse3, .ics, abitudini) |
| `js/allenatore.js` | Le proposte a sorpresa: quando (al computer, libero, non in silenzio), cosa (giochi, carte, ★, orale, focus), e cosa impara |
| `js/formule.js` | Le formule dette a voce in LaTeX (integrali, limiti, sommatorie, derivate, frazioni, potenze, lettere greche…) |
| `desktop/installa.mjs` | Installa Obsidian (installer ufficiale, firma verificata) e Ollama + Gemma 3 |
| `desktop/main.mjs` | L'app Electron: finestra trasparente sempre in primo piano, clic che passano attraverso, scorciatoie globali, icona nella barra dei menu |
| `desktop/vault.mjs` | Crea il vault, lo registra in Obsidian, lo guarda e rilegge le lezioni quando cambiano |

Design: solo bianco e nero, font [Geist](https://github.com/vercel/geist-font) (OFL), luce che segue il cursore, `prefers-reduced-motion` rispettato.

## Da fare (cerco mani)

- [ ] Sincronizzazione facoltativa fra dispositivi (cifrata, file su Drive/iCloud o Supabase)
- [ ] Import del libretto dai portali d'ateneo (Esse3, Infostud, …) incollando la pagina
- [ ] Calendario `.ics` degli appelli e promemoria
- [ ] Esportazione dei mazzi per Anki
- [ ] Mazzi condivisi per corso (link a un JSON)
- [ ] Riconoscere chi parla (prof o studenti) nella trascrizione
- [ ] Passare da Electron a Tauri (app più leggera)
- [ ] Regole dei singoli atenei per il voto di laurea (punti bonus, lodi, Erasmus)

Le pull request sono benvenute: leggi [CONTRIBUTING.md](CONTRIBUTING.md).

## Licenza

MIT. Geist e Geist Mono: SIL Open Font License 1.1 (vedi `fonts/LICENZE.txt`).
