# Le lingue di Lode

Lode parla italiano, inglese, spagnolo, francese, tedesco e portoghese (del Brasile, vedi sotto).

L'**italiano resta la lingua di partenza**: ogni testo nasce in italiano, ogni chiave c'è sempre in italiano, e se una traduzione manca la barra mostra l'italiano.

## Cosa cambia con la lingua e cosa no

| Cambia | Non cambia |
|---|---|
| tutti i testi per lo studente: barra, pagina, benvenuto, finestre di sistema dell'app | i nomi nel codice e i commenti (restano in italiano, come il resto del progetto) |
| i comandi che la barra capisce senza AI | il formato dei dati (`dati.json`): le chiavi restano quelle di adesso |
| date, numeri, plurali | i messaggi di errore per chi sviluppa (console, log) |
| la lingua in cui risponde l'AI | |
| i nomi delle cartelle, delle note e delle sezioni di un vault **nuovo** | i nomi di un vault che esiste già (anche se la lingua della barra cambia) |
| le formule dettate a voce (italiano e inglese) | |

**La lingua non è il paese.** Il sistema dei voti (sezione «Sistemi dei voti») si sceglie a parte: uno studente italiano in Erasmus a Madrid può avere la barra in italiano e i voti spagnoli.

## Come si scrive un testo

```js
import { t, elenco, numero } from './lingua.js';
mostraFatto({ testo: t('barra.salvato'), nota: t('barra.carteDaRipassare', { n: quante }) });
h('div', 'riga', `<b>${esc(e.nome)}</b> ${t('barra.traGiorni', { n })}`);   // escape dei dati dello studente, come prima
```

- **I cataloghi** sono in `js/lingue/<codice>/<area>.js`. Ognuno ha `export default { 'area.chiave': 'testo', … }`.
- **Le chiavi** iniziano con il nome dell'area, seguito da un nome breve in italiano che dice cosa c'è: `barra.salvato`, `errori.manca-punto-e-virgola.titolo`.
- **Le aree** sono elencate in `js/lingue/indice.js` (`AREE`). Ogni file di catalogo va anche in `sw.js` (`FILE`). Quando si aggiunge un file, il numero di `CACHE` sale.
- **In che area va un testo nuovo:** in quella del file che lo mostra. `js/lode.js` è diviso in tre: `barra1` (pillola, pannello, home, strumenti, ripasso, orario, trascrizione, file), `barra2` (allenatore, AI, «Prepara Lode», aggiornamenti, sincronizzazione, note, chiusura della lezione, giochi, comandi locali, errori, orale, agenti) e `barra3` (tasca, Moodle, crocette, temi, prova generale, programma, «te lo spiego io», voce, scorciatoie); il processo principale (`desktop/*.mjs`) usa `desktop`; i testi che servono a più file stanno in `comune`; gli altri moduli hanno l'area con il loro nome (`pagina`, `benvenuto`, `vault`, `libretto`…). Un modulo nuovo con molti testi può avere un'area nuova: va in `AREE`, nei sei cataloghi e in `sw.js`. Una chiave nuova si scrive **in tutte e sei le lingue** nello stesso commit, con il registro di ogni lingua (tu, du, tú, tu, você).
- **Le chiavi composte con una variabile** (``t(`sistemi.nome.${cod}`)``, `'desktop.progetto-esito-' + tipo`, i nomi del vault letti da `js/nomi.js`) vanno in `COMPOSTE` di `test/lingue.mjs`: la prova segnala ogni chiave del catalogo italiano che nessun file usa, e una chiave che non serve più si toglie da tutte le lingue.
- **Parametri:** si scrivono `{nome}`. `t()` non fa l'escape: i dati dello studente, come il nome dell'esame o un pezzo di nota, si mettono nell'HTML con `esc()` esattamente come prima.
- **Plurali:** `{ one: '{n} carta', other: '{n} carte' }` con il parametro `n`. Dove la lingua li ha, si usano anche `few` e `many`, scelti con `Intl.PluralRules`. Se il numero può valere 1 e cambia la frase **in almeno una lingua**, il valore italiano è un plurale anche quando le due forme italiane sono uguali (`{ one: '{n} file', other: '{n} file' }`: in inglese è «1 file» / «2 files»). Il codice passa sempre `n`, anche quando il numero mostrato è un altro parametro già formattato (`t('barra1.lezione-trascritta', { parole: numero(r.parole, 0), n: r.parole })`) o quando la parola si accorda con un numero che non è il totale (`barra3.punti-su`: `{ x, n: x, tot }`). Attenzione: in francese e in portoghese anche lo 0 è `one` («0 fichier»), quindi la forma `one` tiene `{n}` se il numero può valere 0.
- **Elenchi** (come i nomi dei mesi): un array, letto con `elenco('area.chiave')`.
- **Tag ammessi** nei testi: `b i em strong code br span kbd`. Nella traduzione restano gli stessi tag e gli stessi parametri dell'italiano.
- **Virgolette:** ogni lingua usa le sue, sempre quelle: «…» in italiano, spagnolo e portoghese; « … » in francese, con lo spazio fine indivisibile (U+202F) dentro; „…“ in tedesco; “…” in inglese. Le virgolette dritte ("…") solo dove le ha anche l'italiano (stringhe di un programma). Fra `` `…` `` il testo resta com'è: lì si parla dei caratteri stessi.
- **Comandi citati:** un testo che cita fra virgolette una frase da scrivere nella barra («segui il progetto», «sì», «esci») cita, in ogni lingua, una frase che il riconoscitore di quella lingua capisce davvero (`interpreta()`, o le parole delle schede in `PAROLE`). Se cita un bottone o una voce di menu, cita l'etichetta della lingua (lo stesso testo della chiave del bottone).
- **Frasi intere, non pezzi.** Mai `t('a') + nome + t('b')`: in un'altra lingua l'ordine delle parole cambia. Si scrive una frase sola con il parametro: `t('x', { nome })`.
- **Date e numeri:** `dataLunga`, `dataBreve`, `traQuanto`, `ore`, `num` di `js/dati.js` (che usano il catalogo `comune`), oppure `numero()` e `data()` di `js/lingua.js`. Mai `'it-IT'` scritto a mano.
- **In italiano, ogni testo resta identico a prima, carattere per carattere:** le prove esistenti controllano proprio le frasi italiane. Le sole eccezioni volute sono le forme con 1 dei plurali che prima erano sbagliate («1 carta», «tra 1 giorno», «E un altro file.» al posto di «1 carte», «tra 1 giorni», «E altri 1 file.»): la forma `other` resta il testo di prima. Anche i numeri restano come prima: dove l'italiano scriveva «1.2 GB» col punto, il punto resta (`desktop/installa.mjs`).
- **`node test/lingue.mjs`** controlla:
  - stesse chiavi, parametri, tag e lunghezze degli elenchi in tutte le lingue, plurali con `other`;
  - ogni `t('…')` scritto nel codice ha la sua chiave in italiano;
  - ogni chiave italiana è usata da qualche file (le composte stanno in `COMPOSTE`);
  - le virgolette di ogni lingua;
  - ogni catalogo è nella cache del service worker.
- **`node test/comandi-lingue.mjs`** controlla anche i comandi citati nei testi (sopra) e le parole delle schede con l'apostrofo tipografico.

## Come si sceglie la lingua

`js/lingua.js` legge la scelta prima di tutto il resto (`await` in cima al modulo), così le costanti in cima ai moduli trovano già il catalogo pronto. L'ordine è questo:
1. la lingua salvata: `window.lodeDesktop.lingua` nell'app, `localStorage['lode:lingua']` nel browser;
2. **chi usa già Lode resta in italiano**: se il benvenuto è già fatto (nell'app `conf.benvenuto`; nel browser `imp.benvenuto` o degli esami nei dati) e non c'è una lingua salvata, si salva `it` una volta sola, prima che la barra si disegni. Così uno studente italiano con il computer in inglese non si ritrova la barra in inglese;
3. la lingua del sistema, se Lode la conosce;
4. altrimenti l'inglese.

Nel browser lo fa `iniziale()` di `js/lingua.js`. Nell'app lo fa il processo principale (`desktop/lingua.mjs`: `linguaDiPartenza`, `daFissare`), che la dà alla barra con `lingua:leggi` (sincrono, nel preload) e la usa anche per i suoi testi: menu dell'icona, finestre di sistema.

**Nell'app** la lingua scelta sta in `conf.lingua` (la configurazione del processo principale, accanto a `conf.benvenuto`). `desktop/lingua.mjs` carica **gli stessi cataloghi** della barra, presi dalla cartella dell'interfaccia (`desktop/web` nel pacchetto, la radice del progetto in sviluppo), e ne esporta `t`, `elenco`, `numero`, `locale()`. All'avvio `main.mjs` salva `it` se serve (`daFissare`), poi chiama `usa(linguaScelta())` prima di creare le finestre. Fino ad allora vale l'italiano: nei moduli del processo principale niente `t()` in cima al file, i testi si chiedono quando servono.

Nelle prove in node la lingua è l'italiano, salvo `LODE_LINGUA=<codice>`; nell'app `LODE_LINGUA` vale come `conf.lingua` (test/prova-app.mjs la mette a `it`, così gira in italiano anche sulle macchine in inglese). Per cambiare lingua si chiama `imposta(cod)`, che salva la scelta. Nell'app la passa al processo principale con `lingua:imposta`, che ricarica tutte le finestre (barra, quadro, benvenuto), ma solo se la lingua cambia davvero. Nel browser la pagina si ricarica da sola (`location.reload()`).

La lingua si sceglie:
- nel benvenuto, come primo passo: le sei lingue, ognuna scritta nella sua lingua, con quella di adesso già scelta. Un clic cambia subito la lingua del benvenuto;
- con il comando «lingua inglese» / «language italian» / «idioma español»… (`{ tipo: 'lingua', codice }`, `cambiaLingua` in `js/lode.js`): prima la conferma nella lingua nuova («Lode ora parla English.»), poi si salva e si ricarica;
- dalla pagina, in Impostazioni, insieme al sistema dei voti.

`index.html` prende `lang`, titolo e descrizione dalla lingua scelta (`js/app.js`, catalogo `impostazioni`).

## I comandi senza AI

`js/comandi.js` smista: prova le frasi della lingua scelta (`js/comandi/<codice>.js`), poi quelle inglesi se la lingua scelta non è l'inglese. Ogni riconoscitore restituisce gli **stessi oggetti** `{ tipo, … }` del riconoscitore italiano, così il resto della barra non cambia.

- **`js/comandi/it.js`** sono le regole italiane di sempre, spostate senza cambiarle (le frasi di `js/codice/progetto.js`, «segui progetto»…, restano lì per l'italiano). **`js/comandi/en.js`** è l'inglese, e fa anche da riserva.
- **La riserva inglese non prende le frasi della lingua scelta**: se la frase ha le parole piccole della lingua della barra (`PAROLE_PROPRIE` in `js/comandi/comune.js`: «è», «di», «la», «sono»…) e l'inglese non ha trovato un esame del libretto, `comandi.js` la lascia all'AI («today è una giornata storta», «open la pagina di fisica»). Valgono sempre l'errore incollato, le carte, i progetti e il cambio di lingua. Chi aggiunge una lingua controlla la sua riga in `PAROLE_PROPRIE` (mai parole che sono anche inglesi: «come», «mon», «do», «die», «a») e può mettere in `test/comandi/<codice>.mjs` anche `RISERVA = [[frase inglese, risultato atteso], …]`.
- **Le parti senza lingua** stanno in `js/comandi/comune.js`: date in cifre «12/02», orari «14-19» (anche «2-7pm»), durate in cifre, gli errori del compilatore incollati, i nomi delle lingue scritti nella loro lingua («español», «deutsch»…).
- **Ogni riconoscitore** esporta `interpreta(frase)`, `leggiData(testo)` e `ESEMPI = [[frase, spiegazione], …]`: stesso numero e stesso ordine dell'italiano, spiegazioni nella sua lingua. Se ce l'ha, anche `numeri`, `giorniEOre`, `leggiOrario`, `leggiLavoro`; altrimenti `comandi.js` usa quelli inglesi. Se esporta `nonInglese(frase)` (il tedesco: «ist», «ich», «und»…), una frase che il suo riconoscitore non prende e che è chiaramente nella sua lingua non passa all'inglese: «Training ist anstrengend» non diventa il gioco.
- Ogni lingua ha le sue parole: giorni, mesi, «domani», numeri scritti, verbi dei comandi.
- **Il comando della lingua** c'è in tutte: «lingua inglese», «language italian», «idioma español»… → `{ tipo: 'lingua', codice }`.
- **I voti** restano quelli detti (28, 30 e lode): come leggerli lo decide il sistema dei voti, non il riconoscitore.
- **Le piccole parole dentro le schede** (il sì e il no di una conferma, «basta»/«voto» che chiudono l'orale, l'uscita da «spiegamelo» e dall'orale): ogni riconoscitore esporta `PAROLE = { si, siCoda, no, voto, basta, esci }`, frasi intere in minuscolo. `comandi.js` dà `dice(testo, 'si')` nella lingua scelta; le regole sono in `detto()` di `js/comandi/comune.js`, e in italiano danno esattamente le risposte delle regex di prima (`test/scelta.mjs`), con una differenza voluta: l'apostrofo tipografico vale come quello dritto («d’accordo», «d’accord», «c’est bon», come li scrivono i telefoni). I testi che citano queste parole («Puoi anche scrivere «sì».», «Scrivi «esci» per lasciar stare.») citano in ogni lingua una parola della sua `PAROLE`: la prova dei comandi citati lo controlla.
- **Prove:** `node test/comandi-lingue.mjs`. Ogni lingua ha i suoi casi in `test/comandi/<codice>.mjs` (`CASI = [[frase, risultato atteso], …]`, `NON = [frasi che non sono comandi]`). La tabella di riferimento è `test/comandi/it.mjs`: per ogni lingua almeno 3 frasi per ogni `tipo` che l'italiano riconosce, con gli stessi campi, e almeno 15 frasi che **non** devono diventare comandi. Il banco lancia ogni lingua con `LODE_LINGUA=<codice>`.
- Un riconoscitore nuovo va anche in `sw.js` (`FILE`, e il numero di `CACHE` sale).

## Sistemi dei voti

`js/sistemi.js` descrive ogni sistema. Lo studente lo sceglie nel benvenuto (accanto a università e corso) o in Impostazioni, e lo salva in `profilo.sistema`. I dati e i backup di prima non ce l'hanno: valgono come `it`, e un codice sconosciuto pure. Il predefinito viene dalla lingua: `it` → `it`, `es` → `es`, `fr` → `fr`, `de` → `de`, `pt` → `br` (la lingua è il portoghese del Brasile; chi studia in Portogallo sceglie `pt`), `en` → `uk`.

| Codice | Paese | Voti | Sufficienza | Migliore | Crediti | Voto finale |
|---|---|---|---|---|---|---|
| `it` | Italia | 18–30, lode | 18 | alto | CFU | base di laurea = media × 110 / 30 |
| `es` | Spagna | 0–10 (un decimale) | 5 | alto | ECTS | media ponderata 0–10 |
| `fr` | Francia | 0–20 | 10 | alto | ECTS | moyenne 0–20, mention (10 passable, 12 AB, 14 B, 16 TB) |
| `de` | Germania | 1,0–5,0 (1,0 1,3 1,7 2,0 … 4,0, 5,0) | 4,0 | **basso** | ECTS | Gesamtnote 1,0–4,0, media ponderata troncata a un decimale |
| `pt` | Portogallo | 0–20 | 10 | alto | ECTS | média final 0–20 |
| `br` | Brasile | 0–10 | 6 (dipende dall'ateneo) | alto | créditos | média 0–10 (CR) |
| `uk` | Regno Unito | 0–100 % | 40 | alto | credits | classe: 70 First, 60 2:1, 50 2:2, 40 Third |
| `us` | Stati Uniti | A–F → GPA 4,0 (A 4,0, A− 3,7, B+ 3,3 …) | D (1,0) | alto | credit hours | GPA 0–4,0 |

Le funzioni di libretto, media, «quanto mi serve» ed «e se prendo…» passano da `sistemi.js`. Restano uguali in italiano.
- **Media ponderata sui crediti:** vale per tutti i sistemi.
- **«Quanto mi serve»:** diventa «che media mi serve nei crediti che mancano per arrivare a X», nella scala del sistema. Nel tedesco migliore = più basso.
- **Base di laurea × 110 / 30:** solo per `it`.
- **Libretto incollato:** il lettore di Esse3 resta per l'italiano. Per gli altri c'è un lettore generico di tabelle (nome · crediti · voto) che riconosce la scala del sistema.
- **Dove si aggancia:** `js/dati.js` (`media`, `serve`, `simula`, `cfuFatti`, `registraVoto`, `votoFinale`, `sistemaVoti`) legge `D.profilo.sistema` (l'Italia se manca) e passa da `sistemi.js`; `media()`, `serve()` e `simula()` restituiscono gli oggetti di prima. Fuori dall'Italia le schede del libretto (`js/lode.js`), la pagina (`js/pagina.js`) e il benvenuto (`js/benvenuto.js`) prendono numeri e frasi da `js/libretto.js` (catalogo `libretto`); in Italia restano sul codice e sulle frasi di sempre.
- **Il voto detto nella barra:** `interpretaVoti()` di `js/libretto.js` prova i pezzi della frase che si leggono come voto del sistema («8,5», «16/20», «2,3», «A−», «65 %») al posto di un voto italiano di comodo, così i riconoscitori restano quelli di oggi. Un voto che il sistema non ha si dice e non si segna; uno non sufficiente non va nel libretto (nel GPA la F sì).
- **Cambio di sistema:** fuori dall'Italia i voti letti dal disco si tengono anche se non sono della scala (un 28 rimasto dall'Italia): restano nel libretto da correggere e non contano nei conti.
- **Prove:** `node test/libretto-sistemi.mjs`.

## Il vault

I nomi che Lode scrive nel vault e poi rilegge passano da un'unica tabella, `js/nomi.js`, letta dal catalogo `vaultnomi` (`js/lingue/<codice>/vaultnomi.js`):
- **cartelle:** `Lezioni`, `Corsi`, `Sbobine`, `Anki`, `Allegati`, `Materiali`, `Progetti`, `Modelli`, `Inbox` (la cartella `Lode` resta `Lode` in tutte le lingue);
- **i «corsi» che inventa Lode:** «Appunti sparsi», «Videolezioni», «Varie»;
- **note:** `Home`, `Orario`, `Esami`, `Glossario`, `Benvenuto`, `Lode/Memoria`, `In tasca`, i modelli di Obsidian;
- **sezioni:** quelle della lezione (`SEZIONI` di `js/markdown.js`: «Appunti», «★ Da esame», «Definizioni», «Domande per il prof», «Trascrizione», «Appunti riordinati da Lode») e «Note per Lode», «Cosa ho capito», «Cosa so davvero», «Informatica», «Ripasso in tasca», «Orario delle lezioni»;
- **parole che si rileggono:** il callout della risposta e le caselle «sapevo» / «non sapevo» della tasca, le colonne e i giorni dell'orario;
- **i testi delle note che nascono col vault:** benvenuto, modelli, memoria, i commenti `%% … %%` delle note nuove.

Come funziona:
- I nomi si decidono **una volta sola**, quando il vault nasce (`crea` in `desktop/vault.mjs`), nella lingua della barra di quel momento, e si salvano in `.lode/vault.json` (`{ lingua, nomi }`). Da lì in poi ogni lettura e scrittura usa i nomi del vault, **non** la lingua della barra: cambiare lingua non rinomina niente.
- Un vault di Lode che esiste già senza `vault.json` (ha `Lezioni/`, `Home.md`, `Lode/Memoria.md`…) tiene i nomi italiani, e `vault.json` si scrive con `{ lingua: 'it' }`. Più in generale, senza `vault.json` (mai scritto, rovinato, o rimasto indietro con un servizio che non copia le cartelle col punto, come Obsidian Sync) la lingua è quella con più tracce nel vault (cartelle delle lezioni, dei corsi e dei modelli, Benvenuto, Home, Orario, Esami, Glossario, Memoria; a parità l'italiano, `linguaDalleTracce`). Una cartella vuota, o un vault di Obsidian dove Lode non ha mai scritto, nasce nella lingua di adesso.
- I nomi salvati in `vault.json` valgono così come sono: se un catalogo cambia una parola, i vault che esistono già non cambiano. Le voci che mancano (una versione nuova di Lode) prendono il valore della lingua del vault.
- La barra riceve i nomi con `vault:info` e li imposta con `impostaNomi`; chi scrive nel vault aspetta che siano arrivati. Nel browser, senza vault, valgono i nomi della lingua scelta (servono solo ai file che si scaricano).
- Il processo principale costruisce le regex dei percorsi permessi dai nomi del vault (`permessi()` in `desktop/vault.mjs`); in italiano sono quelle di sempre. La sincronizzazione riceve il nome della nota dell'orario (`nomeOrario` di `creaMotore`); la sua nota e `CONTROLLO` non cambiano.
- In lettura Lode capisce anche i nomi italiani (sezioni, giorni dell'orario, caselle della tasca): le note scritte prima restano leggibili.
- **Non cambiano mai:** i marcatori (`%% lode:pagina %%`, `%% lode:diario %%`, `<!-- lode-carta:… -->`, `<!-- lode-tasca giro:… -->`), le chiavi e i valori del frontmatter (`tipo: lezione`, `corso`, `data`…).
- Le frasi della barra che citano un nome del vault lo ricevono come parametro (`vaultnomi.frase-orario-nel-vault` con `{nota}`, `vaultnomi.frase-nella-cartella` con `{cartella}`, `vaultnomi.frase-riordinati-nota` con `{sezione}`).
- Prove: `node --experimental-vm-modules test/vault-nomi.mjs`.

## I dati di esempio

«Prova con i dati di esempio» carica uno studente finto nella lingua della barra: `esempio()` in `js/dati.js` prende i testi dal catalogo `esempio` (`js/lingue/<codice>/esempio.js`: studente, corso, esami, aule, carte, definizioni, stelle) e i numeri da `PAESI_ESEMPIO` (crediti e voti nel sistema del paese: `it` Giulia, `en` → `uk` Emily, `es` Lucía, `fr` Camille, `de` Lena, `pt` → `br` Júlia). In italiano i dati sono quelli di sempre.
- Gli elenchi del catalogo hanno la stessa forma in tutte le lingue (9 esami: 6 fatti, il quinto è un'idoneità, poi 3 da fare; 11 carte; 6 + 4 definizioni). Nella prima stella c'è il nome della quinta definizione, che diventa «da esame».
- `NOMI_ESEMPIO` e `STUDENTI_ESEMPIO` (in `dati.js`) raccolgono gli esami e gli studenti di **tutte** le lingue: `togliEsempio()`, chiamata dal benvenuto, toglie i dati di esempio anche se lo studente ha cambiato lingua dopo averli caricati. Il benvenuto li riconosce con `eEsempio()`: dal segno `esempio: true`; senza il segno (una Lode di prima, solo italiana) solo da «Giulia» con un esame di esempio italiano, perché Emily con «Databases» o Lena con «Physik 1» possono essere studenti veri. `nomeVero()` non propone il nome dello studente di esempio.
- Nello stesso catalogo ci sono le parole che stampano i programmi di «Cosa stampa?» (switch, if) e «Hai scritto…»: `istanza()` in `js/codice/modelli.js` fa la frase scelta e quella scritta dallo stesso mutante, e la risposta giusta la calcola sempre il codice dal programma.
- Prove: `node test/esempio-lingue.mjs`.

## L'AI

Ogni richiesta all'AI (`js/ai.js`) dice in che lingua rispondere, quella della barra. In italiano i prompt restano quelli di sempre, carattere per carattere. Nelle altre lingue si aggiunge in fondo una riga in inglese, che i modelli (anche quelli piccoli) seguono meglio:
- `inLingua()`: «Always answer in Spanish…». Va nella conversazione (`conversa`, `conversaLocale`, dopo i dati dello studente), nel riordino della lezione e nella foto della lavagna.
- `inLinguaJSON()`: per le risposte strutturate (carte, «chiudi lezione», crocette, domanda e giudizio dell'orale, verifica). I testi vanno nella lingua dello studente, ma le chiavi e i valori fissi dello schema restano come sono, e una citazione resta copiata parola per parola.
- `comeScritti()`: per le letture del libretto, dell'orario e del programma. I nomi restano quelli del testo, senza traduzione.

Gli esiti dell'orale e di «te lo spiego io» (`giusta`, `parziale`, `sbagliata`, `fuori tema`, `non so`) sono codici interni. Si salvano così e lo studente li vede con `nomeEsito()`, che legge il catalogo `contenuti`.

I controlli italiani sul giudizio dell'orale (`correggiGiudizio`, `mancanze`: NIENTE, NEGATIVO, MANCANZA, CONNETTIVI) restano solo per l'italiano. Nelle altre lingue l'esito resta quello del modello, e il «mancava» si toglie solo se il modello cita davvero le parole dello studente (`citazioneValida`): è il controllo sulle citazioni, che non dipende dalla lingua e vale in tutte.

## I testi incollati dallo studente

Un programma o un compito incollato non è per forza nella lingua della barra: uno studente in Erasmus incolla il compito in tedesco con la barra in italiano. Per questo chi **legge** usa l'**unione delle sei lingue**, con l'italiano sempre per primo e con le regole di prima. In italiano i risultati non cambiano.
- `js/programma.js`: parole vuote e generiche, titoli d'inizio («Course content», «Temario», «Inhalte», «Ementa»…), parti da saltare (testi, esame, «Assessment», «Literatur»…), segni delle righe («Tema 1.», «Kapitel 2»), frase d'apertura, «Q1:», «Frage 3:».
- `js/temi.js`: segni degli esercizi («Exercise», «Ejercicio», «Exercice», «Aufgabe», «Questão»…), soluzione e sezione delle soluzioni («Solution», «Corrigé», «Lösung», «Resolução»…), punti («points», «Punkte», «pontos»…), durata («2 hours and 30 minutes», «Bearbeitungszeit: 150 Minuten»), date in lettere («February 12, 2024», «12 de febrero de 2024», «12. März 2024»).
- `js/giochi.js` (parole da non nascondere), `js/crocette.js` («all of the above», «ninguna de las anteriores»…), `js/tasca.js`, `js/dati.js` (`trovaEsame`: «physics two», «Mathe zwei», solo in fondo al nome).
- Le parti comuni stanno in `js/parole.js`: mesi delle sei lingue (`meseDa`, `meseAltre`; `meseInglese` per l'ordine «February 12, 2024», che è solo inglese), numeri in fondo al nome di un esame, nomi delle lingue per l'AI e per la voce, `numeroCorto` (al più 2 decimali, senza separatori delle migliaia) e `oraBreve` («14:05»).
- Chi aggiunge una parola controlla che in italiano non sia una parola piena: «onde», «include», «mais», «tiene» e «mediante» non vanno fra le parole vuote.
- **Prove:** `node --experimental-vm-modules test/contenuti-lingue.mjs`, con un programma e un compito per ogni lingua.

## La voce e le formule

- **Voce:** Parakeet v3 e Whisper capiscono tutte e sei le lingue. A Whisper si passa la lingua della barra (`WHISPER` di `js/parole.js`: «italian», «english»…). Il riconoscimento del browser e la lettura ad alta voce usano il paese (`PAESE_VOCE`: «it-IT», «pt-BR»…). Parakeet v3 riconosce la lingua da solo: né FluidAudio (`lode-voce` sul Mac) né il transducer di sherpa-onnx hanno un parametro per la lingua. Le frasi che Whisper inventa nel silenzio (`ALLUCINAZIONI` in `js/voce.js`: «Thank you for watching», «Sous-titres réalisés par…», «Untertitel im Auftrag des ZDF», «Legendas pela comunidade…») si scartano in tutte le lingue.
- **Formule dettate** (`js/formule.js`): italiano e inglese. Nelle altre lingue il testo resta com'è, senza conversione in formule.
  `parlatoInFormule(testo, lingua)` usa la lingua della barra se non gliela passi. In inglese capisce, per esempio, «x squared plus two x», «the integral from zero to one of x squared d x», «d y over d x», «partial f partial x», «the limit as x approaches zero of …», «the sum from n equals one to infinity of …», «f prime of x», «x to the minus one», «x sub n», «square root of», «less than or equal to», «for every epsilon … there exists delta», e anche quello che Whisper scrive già in simboli («f(x) = x^2 + 1», «sin(x)», «sqrt(2)»). I confronti, «in» e «goes to» diventano simboli solo se prima e dopo c'è un pezzo di formula: «x goes to zero» sì, «the function goes to zero» resta frase. Le prove sono in `test/formule.mjs`, con i casi italiani fissati come erano prima delle lingue.

## Il portoghese del Brasile

Il portoghese di Lode è quello del Brasile: locale `pt-BR` (`LINGUE` di `js/lingua.js`), voce `pt-BR` (`PAESE_VOCE`), «Brazilian Portuguese» per l'AI (`NOME_INGLESE` di `js/parole.js`), sistema dei voti predefinito `br` (0–10, `predefinito()` di `js/sistemi.js`), lo studente di esempio Júlia. Il registro è *você*, con le parole del Brasile (arquivo, tela, celular, aula, prova). Chi studia in Portogallo tiene la lingua `pt` e sceglie il sistema `pt` (0–20): la lingua non è il paese. Le parole del Portogallo restano capite dove non danno fastidio (il riconoscitore e i lettori dei testi incollati), ma i testi mostrati sono in brasiliano. Il codice della lingua resta `pt`: cartelle, chiavi e `conf.lingua` già salvate non cambiano.

## Aggiungere una lingua, passo per passo

Con l'olandese (`nl`) come esempio. Ogni passo ha la sua prova: alla fine `node test/lingue.mjs` e `node test/comandi-lingue.mjs` devono dare 0 errori.

1. **La lingua:** una riga in `LINGUE` di `js/lingua.js` (`nl: { nome: 'Nederlands', locale: 'nl-NL' }`: il nome scritto nella lingua).
2. **I cataloghi:** `js/lingue/nl/<area>.js` per ogni area di `AREE`, con tutte le chiavi dell'italiano: stessi parametri, stessi tag, stessi elenchi; i plurali con le forme della lingua (`Intl.PluralRules('nl')`), le virgolette della lingua (aggiungile a `VIRGOLETTE` di `test/lingue.mjs`). Un glossario delle parole scelte va in `docs/lingue/glossario-nl.md`. Nel catalogo `impostazioni` ci sono anche il nome della lingua (`impostazioni.lingua-nome`) e l'esempio del comando «lingua …» (`impostazioni.comando-esempio`).
3. **Il vault:** `js/lingue/nl/vaultnomi.js` (cartelle, note, sezioni, giorni dell'orario, testi delle note che nascono col vault) e la riga in `CAT` di `js/nomi.js`. Le parole diventano nomi di file: niente `/ \ : * ? " < > |` e niente punto in fondo, perché il vault deve aprirsi su Windows, macOS e Linux (`node --experimental-vm-modules test/vault-nomi.mjs`).
4. **I dati di esempio:** `js/lingue/nl/esempio.js` (stessa forma dell'italiano) e il paese in `PAESI_ESEMPIO` di `js/dati.js` (`node test/esempio-lingue.mjs`).
5. **Il riconoscitore:** `js/comandi/nl.js` con `interpreta`, `leggiData`, `ESEMPI` (quanti l'italiano), `PAROLE` e, se servono, `numeri`, `giorniEOre`, `leggiOrario`, `leggiLavoro`, `nonInglese`. In `js/comandi/comune.js`: la riga `nl` in `PAROLE_PROPRIE` (mai parole che sono anche inglesi) e il nome della lingua scritto nella lingua in `NATIVI` («nederlands»). In ogni riconoscitore, il nome della lingua nuova per il comando «lingua olandese», «language dutch»… I casi in `test/comandi/nl.mjs`: almeno 3 frasi per ogni tipo dell'italiano e 15 che non sono comandi.
6. **I voti:** il sistema predefinito della lingua in `predefinito()` di `js/sistemi.js`; se il paese ha un sistema nuovo, va in `SISTEMI` con i suoi testi nel catalogo `sistemi` (`node test/sistemi.mjs`, `node test/libretto-sistemi.mjs`).
7. **L'AI e la voce:** il nome inglese della lingua in `NOME_INGLESE`, la lingua di Whisper in `WHISPER` e il paese della voce in `PAESE_VOCE` (`js/parole.js`). Le frasi che Whisper inventa nel silenzio in quella lingua vanno in `ALLUCINAZIONI` di `js/voce.js`.
8. **I testi incollati:** le parole della lingua nei lettori (`js/programma.js`, `js/temi.js`, `js/crocette.js`, `js/giochi.js`, `js/parole.js`: mesi, numeri in fondo al nome di un esame), con un programma e un compito di prova in `test/contenuti-lingue.mjs`. Nessuna parola che in italiano è una parola piena.
9. **La cache:** ogni file nuovo (cataloghi, riconoscitore) in `FILE` di `sw.js`, e il numero di `CACHE` sale (`node test/unione-lingue.mjs`).
10. **I README:** il link alla lingua in cima a `README.md` e `README.it.md`, se c'è un README tradotto.

## README

`README.md` è in inglese, la porta d'ingresso su GitHub. `README.it.md` è l'italiano completo. In cima a tutti e due ci sono i link alle lingue.
