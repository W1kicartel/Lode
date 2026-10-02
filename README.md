# Lode

**L'assistente di studio per l'università che vive in cima allo schermo. Open source, gratis, in italiano. I tuoi appunti restano sul tuo computer.**

Lode è una piccola pillola di vetro nero in cima allo schermo. Mentre sei a lezione e prendi appunti, ascolta per te e ti fa recuperare quello che ti sei perso. A casa ti allena sulle cose che il prof ha detto davvero. Tutto finisce in un vault [Obsidian](https://obsidian.md) che è tuo: file Markdown che puoi leggere, correggere e portarti dietro.

![«Ripeti»: gli ultimi 60 secondi del prof, con l'ultima frase in evidenza](docs/immagini/ripeti.jpg)

> **Stato: beta.** Funziona ed è provato, ma su un computer solo, un Mac con chip Apple. Non c'è ancora un installer da scaricare: si installa dal codice in cinque minuti (vedi sotto). Windows e Linux non sono ancora stati provati.

---

## Cosa fa

### In aula
- **Ripeti** (⌃⌥P). Ti sei perso una frase? Lode tiene in memoria gli ultimi 60 secondi, solo in RAM e mai su disco, e su richiesta te li scrive, con l'ultima frase del prof in evidenza. Un clic e va negli appunti o tra le cose «★ da esame».
- **Trascrive la lezione intera** (⌃⌥R) nella nota della lezione in Obsidian, a pezzi di 20-30 secondi: se il computer si spegne, quello che c'era è già salvato.
- **Le formule dette a voce diventano formule.** «l'integrale da zero a uno di x al quadrato in dx» diventa $\int_{0}^{1} x^{2} \, dx$, e lo stesso vale per limiti, derivate, sommatorie, frazioni e lettere greche.
- **Cattura veloce** senza lasciare gli appunti: ⌃⌥S **★ Da esame**, ⌃⌥D **Definizione**, ⌃⌥Q **Domanda per il prof**.
- **Sa quando sei a lezione.** Scrivi una volta «lezione analisi 2 lunedì e mercoledì 9-11 aula 7» e la pillola mostra `● Analisi 2 · fine tra 23 min · ★2`.

![La lezione trascritta nella nota, con le formule](docs/immagini/trascrizione.jpg)

### Con i file
Trascina un file sulla pillola, anche chiusa: si allarga e ti chiede *cosa ne faccio?*

- **PDF e slide (`.pptx`):** carte del ripasso, riassunto in Obsidian, definizioni per i giochi, interrogazione, allegato alla lezione.
- **Foto della lavagna:** trascritta in appunti, formule comprese.
- **Registrazioni audio:** trascritte nella lezione.
- **Appunti (`.md`, `.txt`, `.docx`), sbobine dei compagni e mazzi di Anki.**

![Un PDF lasciato sulla pillola: cosa ne faccio?](docs/immagini/file.jpg)

### A casa
- **Ti allena quando hai due minuti.** Digli quando hai l'esame («ho l'esame di analisi 2 il 15 gennaio»). Quando sei al computer e libero, la pillola si allunga e ti propone una cosa piccola: un gioco sulle definizioni, le carte da ripassare, le ★ da rileggere, tre domande come all'orale. Più l'esame è vicino, più spesso. Mai a lezione o nelle ore di silenzio. Impara cosa ti serve.
- **Giochi di memoria** sulle definizioni delle tue lezioni: abbina, chi sono?, completa, flash.
- **Ripasso a intervalli** (SM-2): le carte difficili tornano domani, le facili tra settimane.
- **Interrogazione:** un prof d'orale che fa una domanda alla volta, ti corregge e alla fine ti dà un voto onesto.
- **Libretto e conti:** media ponderata, base di laurea, «quanto mi serve per 110», «se prendo 30 in analisi», ore da fare oggi per arrivare all'appello.
- **Sbobine da passare ai compagni:** un `.md` per Obsidian e una pagina `.html` che si apre su qualsiasi telefono, con le formule disegnate.

![La proposta a sorpresa nella pillola](docs/immagini/proposta.jpg)

![Il gioco: abbina ogni termine alla sua definizione](docs/immagini/gioco.jpg)

### Parli come parli
Nessun comando da imparare. Scrivi, o tieni premuto ⌥ Spazio e parla:

```
ho preso 28 in fisica 2
esame basi di dati il 15 gennaio 9 cfu
quanto mi serve per 110
def: gradiente = vettore delle derivate parziali
ripeti
trascrivi la lezione
interrogami su analisi 2
spiegami il teorema di Green
```

---

## Installazione

### Cosa serve
- **Un Mac con chip Apple (M1 o successivi) e almeno 8 GB di memoria.** È la configurazione provata. Windows e Linux dovrebbero funzionare con la voce Whisper al posto di Parakeet, ma non sono ancora stati provati.
- **Circa 5 GB liberi:** Obsidian circa 230 MB, l'AI locale circa 3,5 GB, la voce circa 470 MB.
- **[Node.js](https://nodejs.org) 20 o successivo** e **git.** Sul Mac git arriva con gli strumenti di Apple (passo 1).

### Passo per passo (Mac)

1. **Gli strumenti di Apple.** Servono per git e per la voce Parakeet. Apri il Terminale e scrivi:
   ```bash
   xcode-select --install
   ```
   Si apre una finestra: premi **Installa**. Se dice che sono già installati, va bene così.

2. **Node.js.** Scarica la versione «LTS» da [nodejs.org](https://nodejs.org) e installala.

3. **Scarica Lode:**
   ```bash
   git clone https://github.com/W1kicartel/Lode.git
   cd Lode
   ```

4. **La voce migliore (consigliato, Mac con chip Apple).** Compila `lode-voce`, il riconoscimento vocale Parakeet sul Neural Engine. Ci vogliono 3-5 minuti la prima volta:
   ```bash
   bash desktop/voce-mac/compila.sh
   ```
   Se salti questo passo, Lode usa Whisper. Funziona, ma è più lento e sbaglia di più.

5. **Avvia l'app:**
   ```bash
   cd desktop
   npm install
   npm start
   ```

6. **La configurazione guidata** si apre da sola:
   - **Obbligatoria.** Come ti chiami, poi un clic installa **Obsidian** (l'installer ufficiale, con la firma verificata), l'**AI locale** (Ollama + Qwen3.5, scelto in base alla memoria del computer) e la **voce**. I download continuano anche mentre vai avanti.
   - **Facoltativa, il setup veloce.** Ateneo e corso, il **libretto incollato da Esse3** (letto anche senza AI), gli esami con le date, l'**orario** (a parole, incollato dal sito o dal calendario `.ics`), quando studi e quanto spesso Lode può proporti cose.

   La pillola compare in cima allo schermo. Il vault Obsidian è in `Documenti/Lode`. Ti serve di nuovo la configurazione? Dal menu dell'icona: «Rifai la configurazione…».

7. **Il microfono.** La prima volta che usi la voce, Ripeti o la trascrizione, macOS chiede il permesso: concedilo. Se l'hai negato, si riattiva da *Impostazioni di Sistema → Privacy e sicurezza → Microfono*.

### Aggiornare
```bash
cd Lode
git pull
bash desktop/voce-mac/compila.sh
cd desktop
npm install
```

### Se qualcosa non va
- **`npm install` dà `EACCES`:** la cartella della cache di npm appartiene a root (un vecchio difetto di npm). Si sistema con:
  ```bash
  sudo chown -R $(id -u):$(id -g) ~/.npm
  ```
- **`compila.sh` si ferma con errori su `PackageDescription` o `SwiftBridging`:** sono due difetti noti dei Command Line Tools 16.4 di Apple. Lo script li aggira da solo. Se fallisce comunque, aggiorna gli strumenti di Apple (passo 1) e riprova.
- **La prima trascrizione con Parakeet ci mette circa 45 secondi:** il Mac sta preparando il modello per il Neural Engine. Succede una volta sola.
- **L'AI locale è lenta:** con 8 GB di memoria Qwen3.5 4B scrive circa 20 parole al secondo. Le carte da un PDF richiedono circa mezzo minuto.

### Disinstallare
Cancella la cartella `Lode`. I tuoi appunti restano in `Documenti/Lode`: sono tuoi. Obsidian e Ollama sono app normali, si tolgono dalla cartella Applicazioni. Il modello si toglie con `ollama rm qwen3.5:4b`.

### Solo nel browser (senza installare)
Per provare libretto, conti, timer, ripasso e giochi senza installare niente:
```bash
python3 -m http.server 5173
```
poi apri http://localhost:5173: segui la configurazione oppure, per vederlo pieno in un attimo, premi «Esempio» nella barra. Voce, trascrizione, Ripeti, Obsidian e AI locale sono solo nell'app.

---

## L'AI: gratis di base, potenziabile con la tua chiave

**Niente da pagare.** L'AI locale (Ollama + Qwen3.5) gira sul tuo computer, gratis e offline: gli appunti non escono. Lode sceglie il modello in base alla memoria:

| Memoria del computer | Modello |
|---|---|
| fino a 15 GB | Qwen3.5 4B |
| da 16 GB | Qwen3.5 9B |
| da 40 GB | Qwen3.5 35B-A3B, un modello «a esperti»: grande ma veloce come uno piccolo |

Sulle slide di prova Qwen3.5 4B ha scritto carte tutte fedeli al materiale. Il modello che usavamo prima, Gemma 3 4B, ne sbagliava o inventava circa una su tre.

**Se vuoi di più**, scrivi **«AI»** nella barra e collega la chiave del servizio che preferisci:
- **Claude** (Anthropic);
- **ChatGPT** (OpenAI);
- **Gemini** (Google);
- **Mistral** (server in Europa);
- **Groq**;
- **OpenRouter**;
- **DeepSeek**.

Paghi direttamente il servizio, a consumo, di solito pochi centesimi a sessione: Lode non vede né incassa niente. Alcuni servizi hanno piani gratuiti con limiti. Lode ti dice quando i testi possono essere usati per addestrare i modelli: per esempio il piano gratuito di Gemini.

- **Appunti sul computer.** Con l'opzione «Appunti e lezioni restano sul computer», la tua AI fa solo spiegazioni e orale. Carte, definizioni e riordino restano all'AI locale.
- **Con Claude** Lode può anche proporre carte, esami e voti da confermare.
- **L'AI propone, tu decidi.** Ogni modifica ai tuoi dati arriva con **Conferma / Annulla**.

## La voce

| | Mac con chip Apple | Windows, Linux, Mac Intel |
|---|---|---|
| Motore | **Parakeet TDT v3** di NVIDIA sul Neural Engine, con [FluidAudio](https://github.com/FluidInference/FluidAudio), lo stesso motore dell'app FluidVoice | **Whisper** (base o small), dentro l'app |
| Un minuto di Ripeti (prova sul Mac di sviluppo) | 0,8 s, quasi senza errori, con la punteggiatura | 3,7 s, con qualche errore |

Tutto offline. L'audio non viene mai salvato su disco.

## Privacy
- **Niente account, niente server di Lode, niente pubblicità, niente tracciamento.**
- I dati stanno sul tuo computer: nel vault Obsidian (`Documenti/Lode`) e nei file dell'app.
- Il microfono si accende solo quando lo chiedi: voce, Ripeti in aula se l'hai attivato, trascrizione. Per Ripeti l'audio vive solo in memoria, per 90 secondi.
- La chiave della tua AI resta su questo computer e parte solo verso il servizio che hai scelto. Non finisce nel vault né nei backup.
- **Registrare una lezione** dipende dal regolamento del tuo ateneo e dal docente: chiedi prima.

## Come cresce con te
Lode non ha un server e non addestra modelli: **la sua memoria è il tuo vault**.
1. **Ogni lezione è una nota.** Contiene appunti, ★, definizioni, domande, trascrizione e appunti riordinati. Lode la rilegge anche quando scrivi in Obsidian.
2. **Ogni definizione ha una memoria.** Ogni risposta ai giochi e al ripasso decide quando ripresentarla.
3. **`Lode/Memoria.md`** riassume cosa sai, cosa sbagli, quando studi e quali proposte ti piacciono. Nella sezione «Note per Lode» puoi dirgli come vuoi essere aiutato.
4. **L'AI legge tutto questo** quando le chiedi qualcosa: le spiegazioni e l'orale sono sul *tuo* corso, con le parole del *tuo* prof.
5. **Le pagine Home, Esami, Glossario e dei corsi** si aggiornano da sole. Lode scrive solo dentro i suoi riquadri, il resto è tuo.

## Scorciatoie (Mac)

| | |
|---|---|
| ⌥ Spazio (tieni premuto) | parla |
| ⌃⌥ Spazio | scrivi |
| ⌃⌥P | Ripeti |
| ⌃⌥R | trascrivi la lezione / fine |
| ⌃⌥S · ⌃⌥D · ⌃⌥Q | ★ da esame · definizione · domanda |
| ⌃⌥G | gioco |
| Esc | indietro, poi chiudi |

---

## Per chi sviluppa

**Niente build:** HTML, CSS e moduli ES che il browser legge così come sono. L'app desktop è Electron.

**Prove:**
```bash
node --experimental-vm-modules test/unita.mjs
node test/prova-app.mjs
```
- `test/unita.mjs` controlla comandi, formule, note e conti: 45 prove.
- `test/prova-app.mjs` fa il giro completo dell'app su un vault temporaneo, senza toccare i tuoi dati: 57 prove. Funziona solo su macOS: le frasi «parlate» le genera la voce di sistema e l'audio va direttamente al motore, senza altoparlanti né microfono.

**Pacchetti** (sperimentali, non ancora firmati): `cd desktop`, poi `npm run dist:mac`, `dist:win` oppure `dist:linux`.

| File | Cosa fa |
|---|---|
| `js/lode.js` | La barra: pillola, pannello a molla, conversazione, schede, conferme, voce, file trascinati, «La tua AI» |
| `js/comandi.js` | Capisce l'italiano senza AI: date, voti, minuti, nomi d'esame approssimati |
| `js/dati.js` | Dati e conti: media, base di laurea, voto che serve, piano, SM-2 |
| `js/ai.js` | L'AI: locale (Ollama), Claude con gli strumenti, oppure un servizio in formato OpenAI; il prof dell'orale |
| `js/voce.js` | La voce: Parakeet (Mac) o Whisper, in fila con priorità per Ripeti e i comandi |
| `js/orecchio.js` | Il microfono condiviso in aula, con gli ultimi 90 secondi solo in memoria |
| `js/trascrizione.js` | La lezione intera: microfono, pezzi da 20-30 s, voce, formule, nota Obsidian |
| `js/formule.js` | Le formule dette a voce in LaTeX |
| `js/file.js` | I file trascinati: tipo, testo di PDF (pdf.js), Word e PowerPoint, audio a 16 kHz |
| `js/sbobina.js` | Sbobine da condividere (.md + .html con formule) e sbobine ricevute |
| `js/allenatore.js` | Le proposte a sorpresa: quando, cosa, e cosa impara |
| `js/benvenuto.js` | La configurazione guidata |
| `js/giochi.js` | I giochi di memoria |
| `js/markdown.js`, `js/vault.js` | Le note di Obsidian e il vault visto dalla barra |
| `js/mascotte.js`, `js/motore.js` | La gemma con gli occhi e le animazioni |
| `desktop/main.mjs` | L'app Electron: finestra trasparente sempre in primo piano, scorciatoie globali, icona nella barra dei menu, chiamate all'AI |
| `desktop/installa.mjs` | Installa Obsidian e Ollama + Qwen3.5 |
| `desktop/voce.mjs`, `desktop/voce-mac/` | `lode-voce`: Parakeet v3 via FluidAudio |
| `desktop/vault.mjs` | Crea il vault, lo registra in Obsidian, rilegge le lezioni quando cambiano |

Design: solo bianco e nero, font [Geist](https://github.com/vercel/geist-font), movimento morbido, `prefers-reduced-motion` rispettato. Le regole per contribuire sono in [CONTRIBUTING.md](CONTRIBUTING.md).

## Cosa manca (cerco mani)
- [ ] Installer firmato per macOS e Windows
- [ ] Prove vere su Windows e Linux; Parakeet anche lì (versione ONNX)
- [ ] Prove in aule vere: rumore, distanza, accenti
- [ ] Sincronizzazione facoltativa fra dispositivi, cifrata
- [ ] Esportazione dei mazzi per Anki
- [ ] Riconoscere chi parla (prof o studenti) nella trascrizione
- [ ] Regole dei singoli atenei per il voto di laurea

## Crediti
Lode usa, senza modificarli:
- [Obsidian](https://obsidian.md): gratis per uso personale, non open source;
- [Ollama](https://ollama.com) (MIT) e [Qwen3.5](https://huggingface.co/Qwen) (Apache 2.0);
- [FluidAudio](https://github.com/FluidInference/FluidAudio) (Apache 2.0) e il modello [Parakeet TDT v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) di NVIDIA (CC BY 4.0);
- [transformers.js](https://github.com/huggingface/transformers.js) (Apache 2.0) con [Whisper](https://github.com/openai/whisper) (MIT);
- [pdf.js](https://github.com/mozilla/pdf.js) (Apache 2.0) e [Temml](https://temml.org) (MIT);
- [Electron](https://www.electronjs.org) (MIT);
- [Geist](https://github.com/vercel/geist-font) (SIL OFL 1.1).

## Licenza
MIT. Fai quello che vuoi, citando il progetto. Geist e Geist Mono: SIL Open Font License 1.1 (vedi `fonts/LICENZE.txt`).
