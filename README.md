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

## In aula, a casa, nel tuo vault Obsidian

**L'app desktop** mette la barra sopra tutte le finestre (Notion, Word, il PDF delle slide) e alla prima apertura crea un **vault Obsidian già pronto** in `Documenti/Lode`: cartelle, modello della lezione, orario, tema bianco e nero. Se Obsidian è installato, il vault compare già nella sua lista.

- **Sa quando sei a lezione.** Imposti l'orario una volta («lezione analisi 2 lunedì e mercoledì 9-11 aula 7») e la barra diventa `● Analisi 2 · fine tra 23 min · ★2`.
- **Cattura veloce senza lasciare gli appunti:**
  - ⌃⌥S **★ Da esame**: quello che il prof ha detto che chiederà;
  - ⌃⌥D **Definizione**;
  - ⌃⌥Q **Domanda per il prof**.

  Finisce tutto nella nota della lezione, `Lezioni/Analisi 2/2026-10-01 Analisi 2.md`, e il fuoco torna dove stavi scrivendo.
- **A casa ti allena.** Quando la memoria sta per cedere, la barra propone *«2 minuti · 6 definizioni di Analisi 2 di stamattina»*. I giochi sono quattro:
  - **abbina** termini e definizioni;
  - **chi sono?**;
  - **completa** la parola mancante;
  - **flash**.
- **Impara con te.** Le definizioni le prende dalle tue note, scritte come preferisci:
  - `- **Termine**: definizione`;
  - `Termine :: definizione`, compatibile col plugin Spaced Repetition;
  - un callout `> [!definizione]`.

  Dopo ogni gioco Lode aggiorna `Lode/Memoria.md`: definizioni sicure, da rinforzare, le ★ recenti. È una nota leggibile e correggibile. Nella sezione «Note per Lode» gli dici come vuoi essere aiutato, e l'AI la legge.

```bash
cd desktop && npm install && npm start
```

Per i pacchetti: `npm run dist:mac`, `dist:win`, `dist:linux`.

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
| `desktop/main.mjs` | L'app Electron: finestra trasparente sempre in primo piano, clic che passano attraverso, scorciatoie globali, icona nella barra dei menu |
| `desktop/vault.mjs` | Crea il vault, lo registra in Obsidian, lo guarda e rilegge le lezioni quando cambiano |

Design: solo bianco e nero, font [Geist](https://github.com/vercel/geist-font) (OFL), luce che segue il cursore, `prefers-reduced-motion` rispettato.

## Da fare (cerco mani)

- [ ] Sincronizzazione facoltativa fra dispositivi (cifrata, file su Drive/iCloud o Supabase)
- [ ] Import del libretto dai portali d'ateneo (Esse3, Infostud, …) incollando la pagina
- [ ] Calendario `.ics` degli appelli e promemoria
- [ ] Esportazione dei mazzi per Anki
- [ ] Mazzi condivisi per corso (link a un JSON)
- [ ] Voce nell'app con Whisper in locale e «Ripeti gli ultimi 60 secondi» del prof
- [ ] «Chiudi lezione»: appunti riordinati e carte dalla nota, con un modello locale (Ollama) o Claude
- [ ] Passare da Electron a Tauri (app più leggera)
- [ ] Regole dei singoli atenei per il voto di laurea (punti bonus, lodi, Erasmus)

Le pull request sono benvenute: leggi [CONTRIBUTING.md](CONTRIBUTING.md).

## Licenza

MIT. Geist e Geist Mono: SIL Open Font License 1.1 (vedi `fonts/LICENZE.txt`).
