# Lode

**L'assistente di studio per l'università che vive in cima allo schermo. Open source, gratis, in italiano. I tuoi appunti restano sul tuo computer.**

Lode è una piccola pillola di vetro nero in cima allo schermo. Mentre sei a lezione e prendi appunti, ascolta per te e ti fa recuperare quello che ti sei perso. A casa ti allena sulle cose che il prof ha detto davvero. Tutto finisce in un vault [Obsidian](https://obsidian.md) che è tuo: file Markdown che puoi leggere, correggere e portarti dietro.

![«Ripeti»: gli ultimi 60 secondi del prof, con l'ultima frase in evidenza](docs/immagini/ripeti.jpg)

> **Stato: beta.** È fatto per **Windows, macOS e Linux**, ma finora è stato provato a fondo solo su un Mac con chip Apple. Il codice per Windows c'è tutto (installazione di Obsidian e dell'AI, scorciatoie, voce), però non l'abbiamo ancora provato su un PC vero: se lo provi, [raccontaci com'è andata](https://github.com/W1kicartel/Lode/issues/new/choose) (prima togli dal messaggio il tuo nome, le chiavi e i percorsi: il modulo te lo ricorda).

**[Installa Lode](#installa)** su Windows, Mac o Linux: una volta sola, dal terminale, copiando pochi comandi. Poi si apre dalla sua icona come le altre app e parte da sola all'accensione.

---

## Cosa fa

### In aula
- **Ripeti** (⌃⌥P). Ti sei perso una frase? Lode tiene in memoria l'ultimo minuto e mezzo, solo in RAM e mai su disco, e su richiesta ti scrive gli ultimi 60 secondi, con l'ultima frase del prof in evidenza. Un clic e va negli appunti o tra le cose «★ da esame». A lezione si accende da solo, se l'hai attivato una volta; se lo accendi tu (con ⌃⌥P o dal pannello) fuori dall'orario resta acceso al massimo 3 ore. Quando il microfono è acceso, la pillola lo segnala con un pallino.
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
- **Le carte anche in Anki.** Scrivi «esporta per anki» (o «esporta le carte di analisi 2 per anki») e Lode prepara un file con le carte del ripasso e le definizioni delle lezioni, senza doppioni: un mazzo per corso (`Lode::Analisi 2`), con le formule, il codice e il grassetto. Nell'app il file va nella cartella `Anki` del vault, nel browser si scarica. In Anki: **File › Importa**, scegli il file e come tipo di nota **Basilare** (in inglese *Basic*), una volta sola per tutti i corsi. Se lo importi di nuovo, Anki aggiorna le carte che ha già invece di raddoppiarle.
- **Interrogazione:** un prof d'orale che fa una domanda alla volta, ti corregge e alla fine ti dà un voto onesto.
- **Libretto e conti:** media ponderata, base di laurea, «quanto mi serve per 110», «se prendo 30 in analisi», ore da fare oggi per arrivare all'appello.
- **Sbobine da passare ai compagni:** un `.md` per Obsidian e una pagina `.html` che si apre su qualsiasi telefono, con le formule disegnate.

![La proposta a sorpresa nella pillola](docs/immagini/proposta.jpg)

![Il gioco: abbina ogni termine alla sua definizione](docs/immagini/gioco.jpg)

### Parli come parli
Nessun comando da imparare. Scrivi, oppure tieni premuto ⌥ Spazio (Ctrl+Shift+Spazio su Windows) e parla:

```
ho preso 28 in fisica 2
esame basi di dati il 15 gennaio 9 cfu
quanto mi serve per 110
def: gradiente = vettore delle derivate parziali
ripeti
trascrivi la lezione
interrogami su analisi 2
spiegami il teorema di Green
esporta per anki
```

### Per chi studia informatica
Quattro cose per Programmazione e i laboratori. Niente AI: le risposte le calcola il computer, e Lode non scrive codice al posto tuo.

- **«Cosa stampa?»** Cinque domande da un minuto su piccoli programmi in C: cicli, divisione intera, `%` con i negativi, `i++` e `++i`, switch senza break, puntatori, ricorsione. La risposta giusta la calcola Lode, e nelle prove la confrontiamo con un compilatore vero su centinaia di programmi. Le risposte sbagliate sono gli errori tipici, e se ne scegli una ti dice quale: «è quello che stamperebbe con `i <= 4`». Se hai un corso di programmazione, compare anche il bottone **Codice** e ogni tanto la pillola te lo propone.
- **«Segui progetto».** Scegli la cartella del laboratorio. Lode ti dice cosa è cambiato davvero, file per file, con le funzioni nuove, e se l'hai provato dopo l'ultima modifica. Vale anche se il codice lo scrive Claude Code, Codex o un copia-incolla: Lode non sa chi ha scritto le righe, e lo dice. Lode nella tua cartella non scrive: le versioni le tiene nella sua. I comandi che confermi (per esempio make) e il tuo programma invece sì, come dal terminale.
- **Le prove a un clic.** Lode compila e lancia le prove `.in`/`.out` che trova nella cartella. Ti mostra prima il comando esatto, e lo esegue solo dopo il tuo sì in una finestra del sistema. Non è una sandbox: il programma gira sul tuo computer, come dal terminale. Se manca il compilatore te lo dice e ti spiega come installarlo, ma non scarica niente da sola.
- **Gli errori in italiano.** «**lista.c, riga 42**: usi `nodo` ma non è dichiarato», con la tua riga sotto e tre passi da aprire uno alla volta: dove guardare, cosa vuol dire e, solo per gli errori meccanici, la correzione. Nei progetti segnati «valutato» la correzione non c'è (e finché ne segui uno, nemmeno per gli errori copiati). Funziona anche senza seguire un progetto: copia l'errore dal terminale, da Code::Blocks o da Dev-C++ e scrivi «spiegami l'errore».
- **Il registro nel vault.** Il diario del progetto (`Progetti/<nome>/<giorno>.md`), la tabella «Cosa so davvero» nella pagina del corso e gli errori che fai più spesso. È un registro per te, non una prova per il prof: lo puoi correggere o spegnere, e niente esce dal computer.

Cosa è permesso con gli agenti e con l'AI lo decide il tuo corso: chiedi al docente. Su Windows serve un compilatore C (MSYS2 o WinLibs): finora l'abbiamo provato solo sul Mac. Su Windows, mentre Lode segue una cartella, non la puoi rinominare né spostare: prima scrivi «smetti di seguire».

```
cosa stampa
segui progetto
cosa è cambiato
provato?
prova il progetto
spiegami l'errore
diario del progetto
non scrivere il diario del progetto lab3
smetti di seguire lab3
```

---

## Installazione

### Installa

Per ora Lode si installa dal codice: gli installer da scaricare arriveranno quando saranno firmati con un certificato ([perché](#gli-installer-non-ancora-firmati)). Non serve saper programmare. Apri il terminale una volta, copi i comandi della tua sezione e al resto pensa Lode. Così il sistema non blocca niente: Node.js, Electron, Obsidian e Ollama sono firmati dai loro autori.

Ti servono circa **5 GB liberi** (Obsidian circa 300 MB, l'AI locale circa 3,5 GB, la voce dai 200 ai 640 MB) e 15-30 minuti, quasi tutti di download. I comandi mettono Lode nella cartella `Lode` dentro la tua cartella utente.

Scegli il tuo sistema: **[Windows](#windows)** · **[Mac](#mac)** · **[Linux](#linux)**.

Al primo avvio Lode ti chiede il nome e con un clic installa Obsidian, l'AI locale e la voce (su Linux l'AI locale no: prima installa Ollama, come spiega la sezione Linux). Poi crea la sua **icona**:
- **Mac:** in **Applicazioni** (quella della tua cartella utente); la trovi anche con Spotlight;
- **Windows:** nel **menu Start** e sul **desktop**;
- **Linux:** nel **menu delle applicazioni**.

Da lì la riapri come le altre app, e all'accensione del computer parte da sola: il terminale non serve più. Icona e avvio all'accensione si tolgono dal menu dell'icona di Lode. Sul Mac, quando Lode attiva l'avvio all'accensione, macOS mostra la notifica «Elementi in background aggiunti»: è lei.

Lode vive nella barra dei menu (Mac) o nell'area di notifica (Windows): non cercarla nel Dock. È la pillola nera in cima allo schermo: si apre con un clic, o tenendo premuto **⌥ Spazio** sul Mac e **Ctrl+Shift+Spazio** su Windows e Linux.

**Aggiornare.** Installata dal codice, Lode non si aggiorna da sola. Ogni tanto chiudila (menu della sua icona › Esci da Lode) e dal terminale scrivi:
- **Mac e Linux:** `cd ~/Lode && git pull && cd desktop && npm install`
- **Windows** (PowerShell): `cd ~\Lode; git pull; cd desktop; npm.cmd install`

Poi riaprila dall'icona. Sul Mac, se avevi compilato la voce per il Neural Engine, rilancia anche `bash ~/Lode/desktop/voce-mac/compila.sh`.

### Windows

**Cosa serve:** Windows 10 o 11 a 64 bit, almeno 8 GB di memoria (16 GB consigliati per l'AI locale).

1. **Apri PowerShell.** Tasto Windows, scrivi «PowerShell», Invio. Aprilo normale, non «come amministratore».

2. **Installa Node.js e Git** (una volta sola):
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```
   ```powershell
   winget install Git.Git
   ```
   La prima volta winget chiede di accettare le sue condizioni: scrivi **Y** e Invio. Windows chiede anche il permesso di installare Node.js e Git: rispondi sì. Poi **chiudi e riapri PowerShell**, così vede i programmi nuovi. Se `winget` non c'è, scaricali a mano da [nodejs.org](https://nodejs.org) (versione «LTS») e [git-scm.com](https://git-scm.com/download/win).

3. **Scarica Lode e avvialo** (copia la riga intera; `npm install` scarica qualche centinaio di MB e ci mette qualche minuto):
   ```powershell
   cd ~; git clone https://github.com/W1kicartel/Lode.git; cd Lode\desktop; npm.cmd install; npm.cmd start
   ```

4. **La configurazione guidata** si apre da sola. Ti chiede come ti chiami e con un clic installa **Obsidian**, l'**AI locale** (Ollama + Qwen3.5) e la **voce** (Parakeet, o Whisper se il computer ha meno di 6 GB di memoria). Il vault con i tuoi appunti nasce in `Documenti\Lode`. La pillola compare in cima allo schermo; l'icona di Lode è vicino all'orologio, nell'area di notifica.

5. **Il microfono.** Se la voce non sente niente: *Impostazioni → Privacy e sicurezza → Microfono* e attiva «Consenti alle app desktop di accedere al microfono».

**Su Windows cambia questo:**

| | Windows |
|---|---|
| Voce, Ripeti, trascrizione | **Parakeet v3** sul processore (con [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)), se il computer ha almeno 6 GB di memoria; altrimenti **Whisper** (base o small), dentro l'app. Vedi [La voce](#la-voce). |
| Scorciatoie | **Ctrl+Shift+Spazio** tenuto premuto per parlare. Poi Ctrl+Alt+P Ripeti, Ctrl+Alt+R trascrivi, Ctrl+Alt+S/D/Q cattura. |
| AI locale | Va bene con una scheda video NVIDIA o AMD. Senza scheda video funziona lo stesso, ma è lenta: le carte da un PDF possono richiedere qualche minuto (intanto puoi chiudere il pannello e continuare). Se il computer è debole, puoi collegare la tua AI (vedi sotto). |
| Condividere una sbobina | Lode apre la cartella con i file, da mandare come vuoi (WhatsApp Web, Drive, mail). Sul Mac c'è il menu Condividi. |

**Se qualcosa non va su Windows:**
- **`npm` dà «impossibile caricare il file… l'esecuzione di script è disabilitata»:** PowerShell blocca gli script. Una volta sola:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```
  oppure usa `npm.cmd install` e `npm.cmd start`.
- **La pillola non risponde alle scorciatoie:** un altro programma usa le stesse combinazioni (per esempio alcune utility di schede video o di tastiera). Chiudilo, oppure usa la pillola col mouse.
- **Windows Defender chiede il permesso** per Ollama o Obsidian: sono gli installer ufficiali, scaricati dai loro siti.

### Mac

**Cosa serve:** macOS con chip Apple (M1 o successivi) e almeno 8 GB di memoria. Funziona anche sui Mac Intel: nell'app scaricata con Whisper al posto di Parakeet, dal codice con Parakeet sul processore.

1. **Gli strumenti di Apple.** Servono per git e per la voce Parakeet. Apri il Terminale e scrivi:
   ```bash
   xcode-select --install
   ```
   Si apre una finestra: premi **Installa**. Se dice che sono già installati, va bene così.

2. **Node.js.** Scarica la versione «LTS» da [nodejs.org](https://nodejs.org) e installala.

3. **Scarica Lode e avvialo** (copia la riga intera; `npm install` scarica qualche centinaio di MB e ci mette qualche minuto):
   ```bash
   cd ~ && git clone https://github.com/W1kicartel/Lode.git && cd Lode/desktop && npm install && npm start
   ```

4. **La configurazione guidata** si apre da sola:
   - **Obbligatoria.** Come ti chiami, poi un clic installa **Obsidian** (l'installer ufficiale, con la firma verificata), l'**AI locale** (Ollama + Qwen3.5, scelto in base alla memoria del computer) e la **voce**. I download continuano anche mentre vai avanti.
   - **Facoltativa, il setup veloce.** Ateneo e corso, il **libretto incollato da Esse3** (letto anche senza AI), gli esami con le date, l'**orario** (a parole, incollato dal sito o dal calendario `.ics`), quando studi e quanto spesso Lode può proporti cose.

   La pillola compare in cima allo schermo. Il vault Obsidian è in `Documenti/Lode`. Ti serve di nuovo la configurazione? Dal menu dell'icona: «Rifai la configurazione…».

5. **Il microfono.** La prima volta che usi la voce, Ripeti o la trascrizione, macOS chiede il permesso: concedilo. Se hai avviato Lode dal Terminale lo chiede per il Terminale; se l'hai aperta dall'icona può chiederlo per «Electron», il programma su cui gira Lode. Se l'hai negato, si riattiva da *Impostazioni di Sistema → Privacy e sicurezza → Microfono*.

6. **La voce migliore (consigliato, Mac con chip Apple).** Lode parte con Parakeet sul processore (sherpa-onnx, la stessa voce di Windows e Linux). Sul Neural Engine è più veloce: chiudi Lode (menu della sua icona › Esci da Lode) e compila `lode-voce`, ci vogliono 3-5 minuti la prima volta:
   ```bash
   bash ~/Lode/desktop/voce-mac/compila.sh
   ```
   Poi riapri Lode dall'icona.

**Se qualcosa non va sul Mac:**
- **`npm install` dà `EACCES`:** la cartella della cache di npm appartiene a root (un vecchio difetto di npm). Si sistema con:
  ```bash
  sudo chown -R $(id -u):$(id -g) ~/.npm
  ```
- **`compila.sh` si ferma con errori su `PackageDescription` o `SwiftBridging`:** sono due difetti noti dei Command Line Tools 16.4 di Apple. Lo script li aggira da solo. Se fallisce comunque, aggiorna gli strumenti di Apple (passo 1) e riprova.
- **La prima trascrizione con Parakeet ci mette circa 45 secondi:** il Mac sta preparando il modello per il Neural Engine. Succede una volta sola.

### Linux

**Cosa serve:** una distribuzione a 64 bit recente, Node.js 20 o successivo e git (dal gestore pacchetti).

1. **Ollama** su Linux si installa con lo script ufficiale, da [ollama.com/download/linux](https://ollama.com/download/linux). Lode installa da sé Obsidian (AppImage) e il modello.
2. **Scarica Lode e avvialo** (copia la riga intera):
   ```bash
   cd ~ && git clone https://github.com/W1kicartel/Lode.git && cd Lode/desktop && npm install && npm start
   ```
   Se si ferma con «The SUID sandbox helper binary was found, but is not configured correctly» (succede su alcune distribuzioni, per esempio Ubuntu 24.04), avvialo con `npm start -- --no-sandbox`: l'icona che crea Lode se lo ricorda.
3. La voce è Parakeet sul processore (Whisper con meno di 6 GB di memoria) e le scorciatoie sono quelle di Windows. Le finestre trasparenti e le scorciatoie globali dipendono dal desktop (GNOME, KDE…): su Wayland alcune potrebbero non funzionare. Raccontaci com'è andata.

### Gli installer (non ancora firmati)

Nella pagina **[Release](https://github.com/W1kicartel/Lode/releases/latest)** ci sono già gli installer per Mac (`.dmg`), Windows (`.exe`) e Linux (`.AppImage`). Non sono ancora firmati con un certificato (Apple 99 $ l'anno; per Windows serve un servizio di firma, vedi [docs/FIRMA.md](docs/FIRMA.md)), quindi macOS e Windows li bloccano alla prima apertura e chiedono di confermare a mano. Quando saranno firmati torneranno la via più semplice, e si aggiorneranno da soli.

<details>
<summary>Usarli lo stesso</summary>

**Controlla che sia quello vero.** Scarica Lode solo dalla pagina Release di questo repository: un «Lode» passato in un gruppo o preso da un altro sito può avere lo stesso aspetto ed essere un'altra cosa. Accanto a ogni file GitHub mostra la sua impronta SHA-256 (`sha256:…`); dalle versioni dopo la 0.3.0 le stesse impronte sono anche nel file `SHA256SUMS.txt` della Release. Prima di aprirlo, calcola quella del file che hai scaricato e confrontale: devono avere le stesse lettere e cifre (Windows le scrive in maiuscolo). Se sono diverse, non aprirlo.

- **Mac** (Terminale): `shasum -a 256 ~/Downloads/Lode-*.dmg`
- **Windows** (PowerShell): `Get-FileHash $HOME\Downloads\Lode-*.exe`
- **Linux**: `sha256sum Lode-*.AppImage`, nella cartella dove l'hai scaricato

Gli installer non sono firmati con un certificato a pagamento (costa ogni anno e Lode è gratis), quindi **la prima volta** il sistema chiede una conferma:

| | Scarica | Primo avvio |
|---|---|---|
| **Mac** (chip Apple e Intel) | `Lode-…-mac.dmg` | Apri il `.dmg` e trascina Lode in **Applicazioni**. Aprilo: il Mac dice che non può verificarlo, premi **Fine**. Poi vai in **Impostazioni di Sistema › Privacy e sicurezza**, scorri in fondo e premi **Apri comunque** accanto a «Lode». Serve solo la prima volta. |
| **Windows** 10 e 11 | `Lode-…-windows.exe` | Aprilo. Se compare «Windows ha protetto il PC», premi **Ulteriori informazioni**, poi **Esegui comunque**. Si installa per il tuo utente, senza permessi di amministratore, e parte da solo. |
| **Linux** (64 bit) | `Lode-…-linux.AppImage` | Rendilo eseguibile (tasto destro › Proprietà › «Consenti l'esecuzione», oppure `chmod +x Lode-*.AppImage`) e aprilo. L'AI locale su Linux non si installa da sola: prima installa Ollama con lo script di [ollama.com](https://ollama.com/download/linux). |

**Gli aggiornamenti.** Su Windows e Linux (AppImage) Lode si aggiorna da sola: scarica la versione nuova in background e in «Oggi» compare «Lode X.Y.Z è pronta» con **Riavvia ora**; se non premi niente, si installa quando chiudi Lode. Sul Mac, finché l'app non è firmata con un certificato Apple, la barra ti avvisa che è uscita una versione nuova e con **Scarica** apre il `.dmg`: lo trascini in Applicazioni come la prima volta. Si spengono da «Prepara Lode» o dal menu dell'icona. Gli aggiornamenti ci sono dalle versioni dopo la 0.3.0: chi ha la 0.3.0 o una precedente scarica la nuova una volta, a mano.

</details>

### Per tutti

**Quanto è veloce l'AI locale.** Dipende dal computer. Su un Mac con 8 GB, Qwen3.5 4B scrive circa 20 parole al secondo e le carte da un PDF arrivano in circa mezzo minuto. Su un portatile senza scheda video ci mette di più.

**Aggiornare:** vedi [Installa](#installa).

**Disinstallare.** Dal menu dell'icona di Lode togli la spunta a «Avvia Lode all'accensione» e all'icona di Lode, poi esci e cancella la cartella `Lode`. I tuoi appunti restano in `Documenti/Lode`: sono tuoi. Obsidian e Ollama sono programmi normali e si disinstallano come gli altri. Il modello si toglie con `ollama rm qwen3.5:4b`.

**Solo nel browser, senza installare.** Per provare libretto, conti, timer, ripasso e giochi, dalla cartella `Lode`:
```bash
npx --yes http-server@14.1.1 -a 127.0.0.1 -p 5173
```
(`-a 127.0.0.1`: lo vede solo questo computer, non chi è sul tuo stesso Wi-Fi; `@14.1.1`: sempre la stessa versione, non l'ultima pubblicata) poi apri http://localhost:5173: segui la configurazione oppure, per vederlo pieno in un attimo, premi «Esempio» nella barra. Voce, trascrizione, Ripeti, Obsidian e AI locale sono solo nell'app.

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

| | Mac con chip Apple | Windows e Linux (almeno 6 GB di memoria) | Mac Intel, e i computer con meno di 6 GB |
|---|---|---|---|
| Motore | **Parakeet TDT v3** di NVIDIA sul Neural Engine, con [FluidAudio](https://github.com/FluidInference/FluidAudio), lo stesso motore dell'app FluidVoice | **Parakeet TDT v3** sul processore, in formato ONNX, con [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | **Whisper** (base o small), dentro l'app |
| Download, una volta sola | circa 470 MB | circa 640 MB | 200 o 600 MB |
| Un minuto di Ripeti (prova sul Mac di sviluppo) | 0,8 s, quasi senza errori, con la punteggiatura | 2-4 s nella barra (il motore da solo: circa 2 s; 90 secondi: 2,7 s), quasi senza errori, con la punteggiatura. Misurato sul Mac di sviluppo con 4 fili: su un PC dipende dal processore | 3,7 s, con qualche errore |

Tutto offline. L'audio non resta mai su disco: sul Mac passa a Parakeet in un file temporaneo che si cancella subito (anche se qualcosa va storto); su Windows e Linux passa al motore in memoria.

**Parakeet su Windows e Linux.** Il modello (Parakeet TDT 0.6B v3, int8, convertito per sherpa-onnx) si scarica la prima volta che prepari la voce, da Hugging Face, sempre dalla stessa versione (un commit preciso, non «l'ultima»), nella cartella dei dati di Lode. Lode controlla l'impronta SHA256 di ogni file quando arriva e di nuovo prima di usarlo, una volta a ogni avvio di Lode (0,3 secondi sul Mac di sviluppo, qualche secondo su un PC lento): se non torna, cancella il file e lo riscarica. Se il download si interrompe, la volta dopo riprende da dove era rimasto. Il riconoscimento gira in un processo a parte, che tiene circa 1,5 GB di memoria; l'audio lungo (Ripeti arriva a 90 secondi) passa a pezzi di al massimo 30 secondi, così la memoria non sale. Se qualcosa non va (manca un pezzo del programma, poco spazio sul disco, un modello che non si carica o che arriva sbagliato), Lode lo dice e passa a Whisper senza perdere la frase o il pezzo di lezione in corso. Un file del modello rovinato sul disco invece va riscaricato: se in quel momento manca la rete, la voce dà errore finché la connessione non torna. Il pacchetto del Mac non include sherpa-onnx: il `.dmg` è universale (chip Apple e Intel insieme) e l'addon ha un file diverso per ogni processore, quindi sui Mac Intel resta Whisper.

## Privacy
- **Niente account, niente server di Lode, niente pubblicità, niente tracciamento.**
- I dati stanno sul tuo computer: nel vault Obsidian (`Documenti/Lode`) e nei file dell'app.
- Il microfono si accende solo quando lo chiedi: voce, Ripeti in aula se l'hai attivato (o fuori lezione, se lo accendi tu: al massimo 3 ore), trascrizione. Per Ripeti l'audio vive solo in memoria, per 90 secondi.
- La chiave della tua AI resta su questo computer e parte solo verso il servizio che hai scelto. Non finisce nel vault né nei backup.
- **Aggiornamenti:** l'app degli installer (dal codice no) chiede a GitHub, poco dopo l'avvio e poi ogni 6 ore, se c'è una versione nuova di Lode, e da lì la scarica. Non manda niente di tuo: né dati, né identificativi, né statistiche. Si spengono da «Prepara Lode» o dal menu dell'icona.
- **Registrare una lezione** dipende dal regolamento del tuo ateneo e dal docente: chiedi prima.

## Sincronizza fra i tuoi computer (sperimentale)

> **Nuova e sperimentale.** È spenta finché non la accendi tu. È stata provata a fondo con un simulatore di più computer e un cloud che fa di tutto per rompere le cose (centinaia di migliaia di sequenze, più tre giri di revisione indipendente), ma non ancora da tanti studenti. Prima di accenderla Lode tiene una copia di tutto: il vault di adesso resta dov'è, intatto, e i dati di Lode vanno anche nella cartella «copie» dei dati di Lode. Se qualcosa non torna, [raccontacelo](https://github.com/W1kicartel/Lode/issues).

Facoltativa, nell'app desktop: in **Prepara Lode › Sincronizza fra i tuoi computer** (o scrivi «sincronizza»). Lode usa la cartella cloud che hai già (iCloud Drive, OneDrive, Dropbox, Google Drive, Syncthing): niente account, niente server di Lode. Sposta il vault lì (la cartella di prima resta dov'è, intatta; se lo spostamento si interrompe, riprende da dove era rimasto) e ogni computer scrive solo il suo diario: niente conflitti, niente si perde. Sugli altri computer: **Uso già Lode su un altro computer**, nel benvenuto o in Prepara Lode. Se su quel computer Lode aveva già esami, voti o carte suoi, non spariscono: compaiono in «Dati di un altro primo avvio» nella scheda, e con **Importa le aggiunte** entrano nel gruppo (profilo e impostazioni restano nel file dei dati del vault di prima). Prima di accenderla, aggiorna Lode su tutti i computer.

**La password è facoltativa e si sceglie una volta, all'accensione.** Con la password sono cifrati i dati di Lode nel diario: esami, voti, carte e ripassi, sessioni, profilo, impostazioni. Restano **in chiaro** nella cartella cloud, anche con la password (e le pagine per Obsidian riportano molti di quei dati):
- appunti, Sbobine, file per Anki, diari dei Progetti;
- Orario.md con le aule;
- le pagine che Lode scrive per Obsidian, ricavate proprio da quei dati: Esami (voti, media, CFU e ore studiate per esame), Memoria (ore di studio del mese, in che fascia del giorno studi, la serie di giorni, le definizioni sbagliate e quante volte), Home (il prossimo appello, quante carte ci sono da ripassare), Corsi, Glossario;
- nomi, dimensioni e orari dei file (quando studi);
- quanti computer ci sono, quanti file scrive ciascuno e quante azioni ha in ogni file (un file per giorno);
- il file del gruppo (sale e controllo della password, quando è nato e da quale computer, l'impronta del dati.json di prima);
- quando è cambiata la password;
- il dati.json minimo che dice «Aggiorna Lode».

Sul computer il diario di Lode resta in chiaro, protetto solo dal tuo account del sistema; nella cronologia del servizio cloud resta quello che era passato in chiaro prima della password. **Se dimentichi la password non si perde niente**: ogni computer ha i suoi dati sul disco, e con «Ho dimenticato la password» ne scegli una nuova (gli altri computer te la chiederanno). La password si ricorda nel portachiavi del sistema (su Linux senza portachiavi Lode la chiede a ogni avvio). **Smetti su questo computer** copia il vault in una cartella fuori dal cloud: gli altri computer continuano tra loro. Come funziona dentro: [docs/SINCRONIZZAZIONE.md](docs/SINCRONIZZAZIONE.md).

## Sicurezza
Hai trovato un problema di sicurezza? Non aprire una issue pubblica: segnalalo in privato, come spiegato in [SECURITY.md](SECURITY.md). Lì c'è anche cosa togliere (nome, chiavi, percorsi, pezzi del vault) prima di incollare un errore o uno screenshot in una issue.

## Come cresce con te
Lode non ha un server e non addestra modelli: **la sua memoria è il tuo vault**.
1. **Ogni lezione è una nota.** Contiene appunti, ★, definizioni, domande, trascrizione e appunti riordinati. Lode la rilegge anche quando scrivi in Obsidian.
2. **Ogni definizione ha una memoria.** Ogni risposta ai giochi e al ripasso decide quando ripresentarla.
3. **`Lode/Memoria.md`** riassume cosa sai, cosa sbagli, quando studi e quali proposte ti piacciono. Nella sezione «Note per Lode» puoi dirgli come vuoi essere aiutato.
4. **L'AI legge tutto questo** quando le chiedi qualcosa: le spiegazioni e l'orale sono sul *tuo* corso, con le parole del *tuo* prof.
5. **Le pagine Home, Esami, Glossario e dei corsi** si aggiornano da sole. Lode scrive solo dentro i suoi riquadri, il resto è tuo.

## Scorciatoie

| | Mac | Windows e Linux |
|---|---|---|
| parla (tieni premuto) | ⌥ Spazio | Ctrl+Shift+Spazio |
| scrivi | ⌃⌥ Spazio | Ctrl+Alt+Spazio |
| Ripeti | ⌃⌥P | Ctrl+Alt+P |
| trascrivi la lezione / fine | ⌃⌥R | Ctrl+Alt+R |
| ★ da esame · definizione · domanda | ⌃⌥S · ⌃⌥D · ⌃⌥Q | Ctrl+Alt+S · D · Q |
| gioco | ⌃⌥G | Ctrl+Alt+G |
| indietro, poi chiudi | Esc | Esc |

---

## Per chi sviluppa

**Niente build:** HTML, CSS e moduli ES che il browser legge così come sono. L'app desktop è Electron.

**Prove:**
```bash
node --experimental-vm-modules test/unita.mjs
node test/codice.mjs
node test/verifica-c.mjs
node --experimental-vm-modules test/progetto.mjs
node test/errori.mjs
node --experimental-vm-modules test/diario.mjs
node test/aggiorna.mjs
node test/controlla-privacy.mjs
node test/voce-onnx.mjs
node test/prova-app.mjs
node test/sync-motore.mjs
node test/sincronizza-app.mjs
node test/sync-sim/autoprova.mjs
node test/sync-sim/scenari.mjs --motore test/sync-sim/motore-v2.mjs
node test/sync-sim/fuzz.mjs --motore test/sync-sim/motore-v2.mjs --giri 1000 --seme 1
```
- `test/unita.mjs` controlla comandi, formule, note, conti e il file per Anki, più la sicurezza della barra (librerie con versione esatta, Content-Security-Policy, percorsi, backup, dati del vault, chiavi, finestre che restano su Lode) e le parti della voce Parakeet ONNX che non hanno bisogno del modello (scelta del motore, versioni esatte, download con ripresa e impronta SHA256, la fila, il riposo, l'audio lungo a finestre, la chiusura durante l'avvio, il ripiego su Whisper): 168 prove.
- Informatica: `codice.mjs` (141 prove su «Cosa stampa?»), `verifica-c.mjs` (452 programmi confrontati con il compilatore vero; senza compilatore salta), `progetto.mjs` (119, «Segui il progetto»), `errori.mjs` (218, gli errori spiegati), `diario.mjs` (90, il registro nel vault). Su GitHub girano tutte su Windows, Linux e macOS.
- La sincronizzazione v2 ([docs/SINCRONIZZAZIONE.md](docs/SINCRONIZZAZIONE.md)): `sync-motore.mjs` prova le parti pure del motore (`desktop/sync/`); `sincronizza-app.mjs` prova l'app vera con Electron, tre computer uno alla volta su una cartella «cloud» temporanea (accensione con e senza password, spostamento interrotto e ripreso, modifiche contemporanee, Orario.md cambiato in Obsidian, «Smetti su questo computer»); `test/sync-sim/` è il simulatore di due o tre computer e di un servizio cloud dispettoso, con gli scenari dei problemi noti e il fuzz che, quando trova un errore, riduce la storia alla più corta e la racconta.
- `test/aggiorna.mjs` (411 prove) controlla gli aggiornamenti senza Electron e senza rete: versioni con le prerelease, l'installer giusto per sistema e architettura, i `latest*.yml`, il Mac senza firma, un finto electron-updater, e che package.json, preload ed entitlements stiano insieme.
- `test/voce-onnx.mjs` prova la voce Parakeet ONNX con il modello vero, senza Electron e senza microfono: trascrive le frasi di `test/audio`, misura un minuto di audio e un Ripeti di 90 secondi (su Mac e Linux anche la memoria del processo, che non deve salire), controlla le impronte, la fila, il riposo, la chiusura durante l'avvio e i ripieghi (crash, addon che manca, modello rovinato). Il modello lo cerca in `LODE_MODELLO_ONNX`; con `--scarica` lo scarica lì (circa 640 MB). Senza modello salta. Su GitHub gira su Windows e Linux solo a richiesta («Run workflow» o `[voce]` nel messaggio del commit), con il modello nella cache.
- `test/controlla-privacy.mjs` guarda i file che finirebbero su GitHub (quelli in git e i nuovi non ignorati) e si ferma se trova chiavi, percorsi con un nome vero (`/Users/<nome>/`, `C:\Users\<nome>\`, `/home/<nome>/`, anche il tuo nome utente), file privati (`.env`, certificati, un vault di prova, foto e risultati delle prove), codice da un CDN o `npx --yes` senza versione esatta, pacchetti di `desktop/package-lock.json` fuori dal registro npm. Lancialo prima di ogni commit: su GitHub gira con le prove unitarie.
- `test/prova-app.mjs` fa il giro completo dell'app su un vault temporaneo, senza toccare i tuoi dati: 81 prove (80 senza compilatore C). Con `LODE_SOLO='informatica|stampa|progetto|errore|diario|davvero'` fa solo i passi di informatica (2-3 minuti). Con `LODE_SOLO='anki'` solo «Esporta per Anki» (meno di un minuto). Per ora gira solo su macOS (su Windows e Linux manca la voce di sistema per generare l'audio delle prove; contributi benvenuti): le frasi «parlate» le genera la voce di sistema e l'audio va direttamente al motore, senza altoparlanti né microfono.

**Provare le modifiche senza rischi** (le tue, e soprattutto quelle degli altri: una pull request, un ramo scaricato):
- **Mai sul vault vero né con le chiavi vere.** In sviluppo `npm start` usa la stessa configurazione dell'app installata: il vault in `Documenti/Lode`, le chiavi della tua AI, le cartelle che segui. `LODE_DATI` e `LODE_VAULT` spostano tutto in cartelle temporanee, `LODE_OBSIDIAN_DIR` tiene il vault di prova fuori dall'elenco di Obsidian. Dalla cartella `desktop`, su Mac e Linux:
  ```bash
  LODE_DATI="$(mktemp -d)" LODE_VAULT="$(mktemp -d)/Vault" LODE_OBSIDIAN_DIR="$(mktemp -d)" npm start
  ```
  Su Windows (PowerShell; le variabili restano finché non chiudi la finestra):
  ```powershell
  $t = Join-Path $env:TEMP "lode-prova-$(Get-Random)"; New-Item -ItemType Directory "$t\dati", "$t\obsidian" | Out-Null
  $env:LODE_DATI = "$t\dati"; $env:LODE_VAULT = "$t\Vault"; $env:LODE_OBSIDIAN_DIR = "$t\obsidian"; npm start
  ```
  Se serve l'AI, usa quella locale o una chiave fatta apposta per le prove, con un limite di spesa basso, da cancellare dopo.
- **Prima leggi il diff, poi `npm install` o `npm start`.** Il codice di una PR gira con i tuoi permessi: `desktop/*.mjs` e `test/*.mjs` sono Node completo e leggono tutta la tua cartella utente. Guarda soprattutto `desktop/package.json`, `desktop/package-lock.json` (un pacchetto può puntare a un altro archivio, e `npm install` ne esegue gli script), `desktop/*.mjs` e `.github/workflows/`. Per installare le dipendenze di una PR: `npm ci --ignore-scripts` (esattamente il lockfile, senza script dei pacchetti; a `npm start` basta).
- **Le cartelle a parte proteggono i tuoi dati da un errore, non da codice scritto apposta**: per quello leggi il diff o usa una macchina virtuale.
- **Foto e risultati delle prove fuori dal repository**: `LODE_FOTO` e `LODE_RISULTATI` in una cartella temporanea, non dentro `Lode`. Il JSON ha il «registro» dell'app, con i percorsi della tua macchina; le foto mostrano la barra con nome, voti e orario.
- **Prima di incollare un registro o uno screenshot** (in una issue, in una PR): sostituisci il tuo nome con `<nome>`, anche nei percorsi (`C:\Users\<nome>\…`, `/Users/<nome>/…`, i «Vault di prova:» e «Laboratorio di prova:» di `prova-app.mjs`), togli chiavi e token, copri voti, appunti e il saluto della barra. Dettagli in [SECURITY.md](SECURITY.md).

**Pacchetti** (non firmati): `cd desktop`, poi `npm run dist:mac`, `dist:win` oppure `dist:linux`. Gli installer pubblici li costruisce GitHub da solo (`.github/workflows/rilascio.yml`) quando si pubblica un tag `v…` uguale alla versione di `desktop/package.json`, su un commit già su `main`, insieme ai `latest*.yml` per gli aggiornamenti e a `SHA256SUMS.txt` con le impronte. Se nel repository ci sono i certificati, li firma (e sul Mac li notarizza); se no escono come oggi. Come attivare la firma: [docs/FIRMA.md](docs/FIRMA.md).

| File | Cosa fa |
|---|---|
| `js/lode.js` | La barra: pillola, pannello a molla, conversazione, schede, conferme, voce, file trascinati, «La tua AI» |
| `js/comandi.js` | Capisce l'italiano senza AI: date, voti, minuti, nomi d'esame approssimati |
| `js/dati.js` | Dati e conti: media, base di laurea, voto che serve, piano, SM-2 |
| `js/ai.js` | L'AI: locale (Ollama), Claude con gli strumenti (API chiamata con `fetch`, senza SDK), oppure un servizio in formato OpenAI; il prof dell'orale |
| `js/fornitori.js` | I servizi della «tua AI», un elenco solo per la barra e per il main (che accetta dalla barra solo l'id del servizio) |
| `js/librerie.js`, `desktop/vendor.mjs` | Le librerie di altri (pdf.js, Temml, transformers.js) con la versione esatta: nell'app file locali in `vendor/`, copiati da `desktop/node_modules`; nel browser da jsDelivr con l'impronta nell'import map |
| `js/voce.js` | La voce: Parakeet (Neural Engine sul Mac, ONNX altrove) o Whisper, in fila con priorità per Ripeti e i comandi; il ripiego su Whisper |
| `js/orecchio.js` | Il microfono condiviso in aula, con gli ultimi 90 secondi solo in memoria |
| `js/trascrizione.js` | La lezione intera: microfono, pezzi da 20-30 s, voce, formule, nota Obsidian |
| `js/formule.js` | Le formule dette a voce in LaTeX |
| `js/file.js` | I file trascinati: tipo, testo di PDF (pdf.js), Word e PowerPoint, audio a 16 kHz |
| `js/sbobina.js` | Sbobine da condividere (.md + .html con formule) e sbobine ricevute |
| `js/anki.js` | «Esporta per Anki»: carte e definizioni nel testo d'importazione di Anki, un mazzo per corso, senza doppioni |
| `js/allenatore.js` | Le proposte a sorpresa: quando, cosa, e cosa impara |
| `js/benvenuto.js` | La configurazione guidata |
| `js/codice/albero.js`, `js/codice/modelli.js`, `js/codice/stampa.js` | «Cosa stampa?»: un piccolo C che Lode sa eseguire, i modelli di domanda con i loro errori tipici, la scheda |
| `js/codice/progetto.js` | «Segui il progetto» nella barra: pillola, «Fatto. In parole semplici», «Provato?» |
| `js/errori.js` | Gli errori di gcc, clang, MinGW, Python e Java spiegati in italiano, senza AI |
| `js/codice/diario.js` | Il registro nel vault: diario del progetto, «Cosa so davvero», la sezione «Informatica» della Memoria |
| `js/giochi.js` | I giochi di memoria |
| `js/markdown.js`, `js/vault.js` | Le note di Obsidian e il vault visto dalla barra |
| `js/mascotte.js`, `js/motore.js` | La gemma con gli occhi e le animazioni |
| `desktop/main.mjs` | L'app Electron: finestra trasparente sempre in primo piano, scorciatoie globali, icona nella barra dei menu, chiamate all'AI |
| `desktop/installa.mjs` | Installa Obsidian e Ollama + Qwen3.5 |
| `desktop/voce.mjs`, `desktop/voce-mac/` | `lode-voce`: Parakeet v3 via FluidAudio |
| `desktop/voce-onnx.mjs`, `desktop/voce-onnx-motore.mjs` | Parakeet v3 ONNX con sherpa-onnx: scelta del motore, download verificato del modello, il processo che trascrive |
| `desktop/vault.mjs` | Crea il vault, lo registra in Obsidian, rilegge le lezioni quando cambiano |
| `desktop/progetto.mjs`, `desktop/esegui.mjs` | Le cartelle seguite: versioni, diff, impronta, e le prove eseguite solo dopo la conferma |
| `desktop/aggiorna.mjs`, `desktop/verifica-rilascio.mjs` | Gli aggiornamenti: electron-updater su Windows e Linux, avviso e `.dmg` sul Mac senza firma; il controllo dei `latest*.yml` prima di pubblicare |

**Sicurezza della barra.** `index.html` ha una Content-Security-Policy: script solo dalla cartella dell'app (niente script scritti nella pagina, niente `eval`), rete solo verso i servizi della «tua AI» e i modelli della voce (Ollama e gli aggiornamenti da GitHub passano dal main, non dalla pagina), nessun form verso altri indirizzi. Nell'app impacchettata `desktop/prepara.mjs` toglie anche jsDelivr e l'import map. Le finestre dell'app non navigano verso altre pagine: un link https si apre nel browser. Una libreria nuova o una versione nuova: `desktop/package.json` (`npm install`), `js/librerie.js`, import map e CSP in `index.html`; `test/unita.mjs` controlla che coincidano. In sviluppo l'app copia da sola le librerie in `vendor/` (ignorata da git). Le variabili `LODE_*` per le prove valgono solo in sviluppo: l'app installata le ignora.

Design: solo bianco e nero, font [Geist](https://github.com/vercel/geist-font), movimento morbido, `prefers-reduced-motion` rispettato. Le regole per contribuire sono in [CONTRIBUTING.md](CONTRIBUTING.md).

## Cosa manca (cerco mani)
- [ ] Firma degli installer: il workflow è pronto, mancano solo i certificati (Apple 99 $ l'anno; per Windows Azure Trusted Signing o SignPath). Cosa comprare e come attivarla: [docs/FIRMA.md](docs/FIRMA.md)
- [ ] Parakeet su Windows e Linux c'è (ONNX, sul processore), ma va provato su un PC vero: raccontaci quanto ci mette
- [ ] La sincronizzazione fra i tuoi computer c'è dalla 0.5.0, cifrata se vuoi, ma è [sperimentale](#sincronizza-fra-i-tuoi-computer-sperimentale): va provata con iCloud, OneDrive, Dropbox e Google Drive veri. Raccontaci com'è andata
- [ ] Riconoscere chi parla (prof o studenti) nella trascrizione
- [ ] Regole dei singoli atenei per il voto di laurea

## Crediti
Lode usa, senza modificarli:
- [Obsidian](https://obsidian.md): gratis per uso personale, non open source;
- [Ollama](https://ollama.com) (MIT) e [Qwen3.5](https://huggingface.co/Qwen) (Apache 2.0);
- [FluidAudio](https://github.com/FluidInference/FluidAudio) (Apache 2.0) e il modello [Parakeet TDT v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) di NVIDIA (CC BY 4.0);
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (Apache 2.0) con la [versione ONNX di Parakeet TDT v3](https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8);
- [transformers.js](https://github.com/huggingface/transformers.js) (Apache 2.0) con [Whisper](https://github.com/openai/whisper) (MIT);
- [pdf.js](https://github.com/mozilla/pdf.js) (Apache 2.0) e [Temml](https://temml.org) (MIT);
- [Electron](https://www.electronjs.org) (MIT);
- [Geist](https://github.com/vercel/geist-font) (SIL OFL 1.1).

## Licenza
MIT. Fai quello che vuoi, citando il progetto. Geist e Geist Mono: SIL Open Font License 1.1 (vedi `fonts/LICENZE.txt`).
