# Firmare gli installer di Lode

Oggi gli installer di Lode non sono firmati con un certificato a pagamento. Funzionano, ma:

- **Mac**: al primo avvio macOS dice che non può verificare Lode e bisogna passare da *Privacy e sicurezza › Apri comunque*. Gli aggiornamenti automatici del Mac (Squirrel.Mac) accettano solo app firmate: senza firma la barra si limita ad avvisare che è uscita una versione nuova e apre il download del `.dmg`.
- **Windows**: compare «Windows ha protetto il PC» e bisogna premere *Ulteriori informazioni › Esegui comunque*. Gli aggiornamenti automatici funzionano anche senza firma.

Il lavoro dalla parte del codice è già fatto. `.github/workflows/rilascio.yml` guarda se nel repository ci sono i segreti giusti:

- **se ci sono**, firma (e sul Mac notarizza) da solo;
- **se non ci sono**, costruisce gli installer come oggi.

Quindi devi solo comprare e attivare i certificati, poi incollare i segreti in GitHub. Nessuna modifica al codice.

| | Cosa serve | Costo | Cosa cambia |
|---|---|---|---|
| **Mac** | Apple Developer Program | 99 $ l'anno (in euro il prezzo lo mostra Apple quando ti iscrivi) | Nessun avviso al primo avvio, aggiornamenti automatici anche sul Mac |
| **Windows** | Azure Trusted Signing (prima verifica che sia disponibile per te, vedi sotto) | circa 10 $ al mese (piano Basic) | Niente «Windows ha protetto il PC» (dopo un po' di download, vedi sotto) |
| **Windows, gratis** | SignPath Foundation | gratis per i progetti open source, se ti approvano | Come sopra, ma con un passaggio in più nel workflow |

---

## Mac: Apple Developer Program

### 1. Iscriviti

1. Ti serve un **Apple ID con l'autenticazione a due fattori** attiva (quella dell'iPhone va bene).
2. Vai su [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/), oppure usa l'app **Apple Developer** su iPhone o Mac (è più veloce: la verifica dell'identità si fa con la foto del documento).
3. Scegli **Individuo** (*Individual / Sole Proprietor*). Il nome che comparirà nel certificato, e quindi su Lode, è il tuo nome e cognome.
4. Paga e aspetta la conferma: di solito arriva in giornata, a volte in un paio di giorni.

### 2. Crea il certificato «Developer ID Application»

È il certificato per le app distribuite fuori dall'App Store. Lo può creare solo il titolare dell'account (*Account Holder*), cioè tu.

1. Sul Mac apri **Accesso Portachiavi** (Applicazioni › Utility).
2. Menu **Accesso Portachiavi › Assistente Certificato › Richiedi un certificato da un'Autorità di Certificazione…**
   - Indirizzo email: il tuo. Nome comune: il tuo nome.
   - Scegli **Salvata su disco** e salva `CertificateSigningRequest.certSigningRequest`.
3. Vai su [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates/list) e premi **+**.
4. Scegli **Developer ID Application** (non «Developer ID Installer», non «Apple Development»). Se chiede il tipo di profilo, lascia **G2 Sub-CA**.
5. Carica il file `.certSigningRequest`, poi **Download**: ottieni `developerID_application.cer`.
6. Fai doppio clic sul `.cer`: finisce nel portachiavi **login**, insieme alla chiave privata creata al punto 2.

### 3. Esporta il certificato (.p12) per GitHub

1. In **Accesso Portachiavi**, portachiavi **login**, categoria **I miei certificati**, trova **Developer ID Application: Nome Cognome (XXXXXXXXXX)**. Con la freccina accanto deve comparire anche la chiave privata: se non c'è, il certificato è stato creato su un altro Mac e va esportato da lì.
2. Tasto destro sul certificato › **Esporta…** › formato **Scambio di informazioni personali (.p12)** › salva come `DeveloperID.p12`.
3. Scegli una **password lunga** e annotala: è il segreto `CSC_KEY_PASSWORD`.
4. Trasformalo in testo (base64) e copialo negli appunti dal Terminale:
   ```bash
   base64 -i DeveloperID.p12 | pbcopy
   ```
   Quello che hai negli appunti è il segreto `CSC_LINK`.

### 4. Crea la chiave API per la notarizzazione

Apple vuole che ogni app firmata sia anche **notarizzata**: la manda ai suoi server, che la controllano in pochi minuti. Il workflow lo fa da solo con una chiave API di App Store Connect (senza la tua password).

1. Vai su [appstoreconnect.apple.com](https://appstoreconnect.apple.com) › **Utenti e accessi** › **Integrazioni** › **App Store Connect API**. La prima volta va chiesto l'accesso: premi il pulsante e accetta.
2. Scheda **Chiavi del team** › **+** (Genera chiave API).
   - Nome: `Lode notarizzazione`.
   - Accesso: **Developer** basta.
3. Premi **Scarica chiave API**: ottieni `AuthKey_XXXXXXXXXX.p8`. **Si scarica una volta sola**: tienilo in un posto sicuro (un gestore di password va bene).
4. Annota due valori dalla stessa pagina:
   - **ID chiave** (10 caratteri, è anche nel nome del file): segreto `APPLE_API_KEY_ID`;
   - **ID emittente** (*Issuer ID*, in alto, nella forma `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`): segreto `APPLE_API_ISSUER`.
5. Copia tutto il contenuto del file `.p8`, comprese le righe `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----`:
   ```bash
   pbcopy < AuthKey_XXXXXXXXXX.p8
   ```
   È il segreto `APPLE_API_KEY`. Nel workflow diventa di nuovo un file `.p8`, che electron-builder passa ad Apple.

### Cosa succede dopo

- La Release successiva esce **firmata e notarizzata**: si apre con un doppio clic, senza passare da *Apri comunque*.
- Il workflow costruisce anche un `.zip` accanto al `.dmg`: serve agli aggiornamenti automatici del Mac. All'avvio Lode guarda la propria firma (`codesign`). Se è «Developer ID Application», si aggiorna da sola come su Windows e Linux; non c'è niente da cambiare nel codice.
- Chi ha una versione con gli aggiornamenti (quelle dopo la 0.3.0) firmata ad hoc vede nella barra «È uscita Lode X.Y.Z» e scarica il `.dmg` una volta, a mano. Chi ha la 0.3.0 o una precedente non vede niente: le note della Release gli dicono di scaricarla a mano. Da lì in poi si aggiorna da solo.
- Il certificato Developer ID dura **5 anni**. Le versioni già notarizzate continuano ad aprirsi anche dopo la scadenza; per le nuove ne crei un altro (punti 2 e 3) e aggiorni i due segreti.
- Se smetti di pagare il programma, le Release nuove tornano firmate ad hoc (basta togliere i segreti). Chi ha una versione firmata non riceverà più gli aggiornamenti automatici: la barra gli dirà di scaricare a mano.

---

## Windows: Azure Trusted Signing

### Prima di pagare: verifica che sia disponibile per te

Trusted Signing è il servizio di Microsoft per firmare il codice con un certificato «a fiducia pubblica», che Windows riconosce. Costa circa 10 $ al mese (piano *Basic*), senza chiavette USB né certificati da rinnovare a mano.

**Da verificare per un privato in Italia.** Quando abbiamo scritto questa guida, la verifica dell'identità per i **privati** (*Individual*) era aperta solo a chi vive negli Stati Uniti e in Canada. Le **organizzazioni** potevano usarla anche nell'Unione Europea, ma con almeno tre anni di storia verificabile (per esempio una ditta individuale o una società con partita IVA). Prima di attivare un abbonamento, controlla la pagina ufficiale di Microsoft, *Trusted Signing › Identity validation*: le regole cambiano, e Microsoft ogni tanto cambia anche il nome ai servizi (se non lo trovi, cerca «code signing» nel portale Azure).

Se non è disponibile, vai alla [via gratis: SignPath Foundation](#windows-gratis-signpath-foundation).

### I passi, se è disponibile

1. **Account Azure**: [portal.azure.com](https://portal.azure.com), con una carta e un abbonamento (*Subscription*) a consumo.
2. **Attiva il servizio**: *Sottoscrizioni › la tua › Provider di risorse*, cerca `Microsoft.CodeSigning` e premi **Registra**.
3. **Crea l'account di firma**: cerca «Trusted Signing» › **Crea**. Scegli una regione europea, per esempio *West Europe*. Annota:
   - il **nome dell'account**: segreto `AZURE_CODE_SIGNING_ACCOUNT`;
   - l'**endpoint** della regione: segreto `AZURE_ENDPOINT`. Per *West Europe* è `https://weu.codesigning.azure.net/`, per *North Europe* `https://neu.codesigning.azure.net/`. Lo trovi nella pagina *Panoramica* dell'account, alla voce *Account URI*.
4. **Fatti verificare**: nell'account › **Identity validation** › **New identity** › **Public**. Carica i documenti che chiede e aspetta l'approvazione (da qualche ora a qualche giorno).
5. **Crea il profilo del certificato**: **Certificate profiles** › **Create** › **Public Trust**, scegli l'identità appena verificata. Annota:
   - il **nome del profilo**: segreto `AZURE_CERT_PROFILE`;
   - il **nome che compare nel certificato** (il *Common Name*, cioè il tuo nome o quello della tua organizzazione, esattamente com'è scritto): segreto `AZURE_PUBLISHER_NAME`. Lode lo usa anche per controllare che gli aggiornamenti arrivino davvero da te.
6. **Un «utente» per GitHub**: cerca **Microsoft Entra ID** › **Registrazioni app** › **Nuova registrazione**, nome `Lode GitHub`. Dalla pagina *Panoramica* annota:
   - **ID applicazione (client)**: segreto `AZURE_CLIENT_ID`;
   - **ID directory (tenant)**: segreto `AZURE_TENANT_ID`.

   Poi *Certificati e segreti* › **Nuovo segreto client**, scadenza 24 mesi. Copia subito il **Valore** (non l'ID): è il segreto `AZURE_CLIENT_SECRET`. Mettiti un promemoria: fra due anni va rifatto.
7. **Dai il permesso di firmare**: torna all'account Trusted Signing › **Controllo di accesso (IAM)** › **Aggiungi assegnazione di ruolo** › ruolo **Trusted Signing Certificate Profile Signer** › membro: l'app `Lode GitHub`.

### Cosa succede dopo

- electron-builder firma `Lode.exe` e l'installer **mentre li costruisce**, quindi prima di scrivere `latest.yml`: l'impronta (sha512) che gli aggiornamenti controllano è quella del file firmato.
- I primi giorni Windows può mostrare ancora l'avviso: SmartScreen si fida di un'app firmata dopo un certo numero di download. Poi sparisce.
- **Attenzione:** quando una versione firmata è installata, Lode accetta aggiornamenti solo firmati con lo stesso nome (`AZURE_PUBLISHER_NAME`). Se un giorno smetti di firmare, chi ha una versione firmata dovrà scaricare la nuova a mano.

---

## Windows, gratis: SignPath Foundation

[SignPath Foundation](https://signpath.org) firma gratis i progetti open source con licenza approvata dall'OSI (MIT va bene).

- **Serve l'approvazione**: si fa domanda dal loro sito. Guardano che il progetto sia davvero open source, attivo e costruito da GitHub Actions a partire dal codice pubblico (Lode lo è già).
- Il certificato è intestato a **SignPath Foundation**, non a te; Windows mostra quel nome.
- **La firma avviene dopo la build**: il workflow carica il `.exe` su SignPath con la loro GitHub Action, e loro lo restituiscono firmato. A quel punto l'impronta del file cambia, e il `latest.yml` scritto da electron-builder non combacia più. Va riscritto dopo la firma (sha512 e peso del `.exe` firmato), altrimenti gli aggiornamenti si rifiutano di installare. `desktop/verifica-rilascio.mjs` se ne accorge e ferma la Release prima di pubblicarla. È il motivo per cui il workflow oggi è pronto per Trusted Signing e non per SignPath: se scegli questa strada, va aggiunto quel passaggio.

---

## Dove mettere i segreti in GitHub

Sul repository **W1kicartel/Lode**: **Settings › Secrets and variables › Actions** › scheda **Secrets** › **New repository secret**. Un segreto per riga, con questi nomi esatti:

| Nome | Cosa contiene | Per |
|---|---|---|
| `CSC_LINK` | il `.p12` del Developer ID in base64 (`base64 -i DeveloperID.p12`) | Mac |
| `CSC_KEY_PASSWORD` | la password scelta quando hai esportato il `.p12` | Mac |
| `APPLE_API_KEY` | tutto il testo del file `AuthKey_XXXXXXXXXX.p8` | Mac (notarizzazione) |
| `APPLE_API_KEY_ID` | l'ID della chiave, 10 caratteri | Mac (notarizzazione) |
| `APPLE_API_ISSUER` | l'Issuer ID di App Store Connect | Mac (notarizzazione) |
| `AZURE_TENANT_ID` | ID directory (tenant) di Entra ID | Windows |
| `AZURE_CLIENT_ID` | ID applicazione (client) di `Lode GitHub` | Windows |
| `AZURE_CLIENT_SECRET` | il **valore** del segreto client | Windows |
| `AZURE_ENDPOINT` | per esempio `https://weu.codesigning.azure.net/` | Windows |
| `AZURE_CODE_SIGNING_ACCOUNT` | il nome dell'account Trusted Signing | Windows |
| `AZURE_CERT_PROFILE` | il nome del profilo del certificato | Windows |
| `AZURE_PUBLISHER_NAME` | il nome nel certificato, esattamente com'è scritto | Windows |

Gli ultimi quattro non sono segreti veri: se preferisci, mettili nella scheda **Variables** con gli stessi nomi.

Il workflow passa a ogni macchina solo i segreti del suo sistema: quelli di Apple non arrivano mai alla macchina Windows, e viceversa. Il Mac firma solo se ci sono **tutti e due** `CSC_LINK` e `CSC_KEY_PASSWORD`, e notarizza solo se ci sono anche i tre `APPLE_API_*`. Windows firma solo se ci sono tutti e sette quelli `AZURE_*`. Se ne manca uno, l'installer esce come oggi: il workflow lo segnala con un avviso (*warning*) e le note della Release non dicono «firmato», perché le scrive guardando cosa hanno fatto davvero le build.

**Mai** mettere `.p12`, `.p8` o password nel repository, nemmeno per un attimo: restano nella storia di git.

---

## Provare e pubblicare

1. **Prova senza pubblicare**: su GitHub, **Actions › Rilascio › Run workflow**. Esce una bozza «Anteprima N» nella pagina Release, visibile solo a te.
2. **Controlla il Mac**: scarica il `.dmg`, installa Lode e, nel Terminale:
   ```bash
   codesign -dv --verbose=2 /Applications/Lode.app 2>&1 | grep Authority
   spctl -a -vv /Applications/Lode.app
   ```
   La prima riga deve dire `Authority=Developer ID Application: Nome Cognome (…)`; la seconda `accepted` e `source=Notarized Developer ID`.
3. **Controlla Windows**: tasto destro sul `.exe` › **Proprietà** › scheda **Firme digitali**: deve esserci il tuo nome.
4. **Pubblica una versione**: cambia `version` in `desktop/package.json` (per esempio `0.4.0`), fai il commit e `git push`, poi:
   ```bash
   git tag v0.4.0 && git push --tags
   ```
   Il tag deve dire la stessa versione di `package.json`: se non combaciano, il workflow si ferma (gli aggiornamenti confrontano proprio quel numero). Deve anche stare su un commit che è già su `main`: se hai spinto solo il tag, il workflow si ferma prima di pubblicare; fai `git push` e poi, nella pagina del workflow, **Re-run failed jobs** (gli installer già costruiti non si rifanno). Un tag con il trattino, per esempio `v0.4.0-beta.1` (con `0.4.0-beta.1` in `package.json`), esce come *prerelease*: gli aggiornamenti non la propongono a chi ha una versione finale.

   La Release nasce come bozza, riceve tutti i file e solo alla fine diventa pubblica. Una Release già pubblicata il workflow non la sovrascrive mai: se un installer è sbagliato, esce una versione nuova: due installer diversi con lo stesso numero confonderebbero gli aggiornamenti e chi controlla l'impronta.

Nella pagina della Release, accanto agli installer, ci sono `latest.yml`, `latest-mac.yml`, `latest-linux.yml` e alcuni `.blockmap` (e il `.zip` del Mac firmato). Non vanno tolti: sono quelli che l'app legge per aggiornarsi.

C'è anche `SHA256SUMS.txt`: le impronte SHA-256 di tutti i file, calcolate dal workflow su quelli che carica. Chi scarica può confrontarle con il file che ha (il README, alla voce «Installa», dice come). Per controllarle tutte insieme, nella cartella con i file scaricati: `shasum -a 256 -c SHA256SUMS.txt --ignore-missing` sul Mac, `sha256sum -c SHA256SUMS.txt --ignore-missing` su Linux.

---

## Proteggere le Release (impostazioni di GitHub, una volta)

Il workflow è già pronto; queste tre cose si attivano solo dalle impostazioni del repository **W1kicartel/Lode**, e servono a far sì che un tag spostato o un token rubato non possano cambiare installer già scaricati dagli studenti.

1. **Release immutabili**: **Settings › General**, sezione **Releases**, spunta **Enable release immutability**. Da lì in poi, una Release pubblicata non cambia più: né i file né il tag. Il workflow carica tutto mentre la Release è ancora una bozza, quindi funziona anche così. Vale solo per le Release pubblicate dopo averla attivata: la 0.3.0 resta modificabile, la prima protetta è la versione successiva.
2. **Regole per i tag `v*`**: **Settings › Rules › Rulesets › New ruleset › New tag ruleset**. Destinazione: i tag che corrispondono a `v*`. Regole: **Restrict creations**, **Restrict updates**, **Restrict deletions**. Nella lista di chi può scavalcarle (*Bypass list*) metti **Repository admin**, cioè tu. Così solo tu crei, sposti o cancelli i tag che pubblicano.
3. **Regole per `main`**: **New branch ruleset** sul ramo predefinito, con **Block force pushes** e **Restrict deletions**. Non attivare «Require a pull request» se non metti anche te nella *Bypass list*: oggi i commit vanno direttamente su `main` e resterebbero bloccati.
