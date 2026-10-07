# Le lingue di Lode

Lode parla italiano, inglese, spagnolo, francese, tedesco e portoghese.

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
- **Parametri:** si scrivono `{nome}`. `t()` non fa l'escape: i dati dello studente, come il nome dell'esame o un pezzo di nota, si mettono nell'HTML con `esc()` esattamente come prima.
- **Plurali:** `{ one: '{n} carta', other: '{n} carte' }` con il parametro `n`. Dove la lingua li ha, si usano anche `few` e `many`, scelti con `Intl.PluralRules`. Se il numero cambia la frase, il valore italiano è un plurale, non una stringa.
- **Elenchi** (come i nomi dei mesi): un array, letto con `elenco('area.chiave')`.
- **Tag ammessi** nei testi: `b i em strong code br span kbd`. Nella traduzione restano gli stessi tag e gli stessi parametri dell'italiano.
- **Frasi intere, non pezzi.** Mai `t('a') + nome + t('b')`: in un'altra lingua l'ordine delle parole cambia. Si scrive una frase sola con il parametro: `t('x', { nome })`.
- **Date e numeri:** `dataLunga`, `dataBreve`, `traQuanto`, `ore`, `num` di `js/dati.js` (che usano il catalogo `comune`), oppure `numero()` e `data()` di `js/lingua.js`. Mai `'it-IT'` scritto a mano.
- **In italiano, ogni testo resta identico a prima, carattere per carattere:** le prove esistenti controllano proprio le frasi italiane.
- **`node test/lingue.mjs`** controlla tre cose:
  - stesse chiavi, parametri, tag e lunghezze degli elenchi in tutte le lingue;
  - ogni `t('…')` scritto nel codice ha la sua chiave in italiano;
  - ogni catalogo è nella cache del service worker.

## Come si sceglie la lingua

`js/lingua.js` legge la scelta prima di tutto il resto (`await` in cima al modulo), così le costanti in cima ai moduli trovano già il catalogo pronto. L'ordine è questo:
1. la lingua salvata: `window.lodeDesktop.lingua` nell'app, `localStorage['lode:lingua']` nel browser;
2. **chi usa già Lode resta in italiano**: se il benvenuto è già fatto (nell'app `conf.benvenuto`; nel browser `imp.benvenuto` o degli esami nei dati) e non c'è una lingua salvata, si salva `it` una volta sola, prima che la barra si disegni. Così uno studente italiano con il computer in inglese non si ritrova la barra in inglese;
3. la lingua del sistema, se Lode la conosce;
4. altrimenti l'inglese.

Nel browser lo fa `iniziale()` di `js/lingua.js`. Nell'app lo fa il processo principale (`desktop/lingua.mjs`: `linguaDiPartenza`, `daFissare`), che la dà alla barra con `lingua:leggi` (sincrono, nel preload) e la usa anche per i suoi testi: menu dell'icona, finestre di sistema.

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
- **Il comando della lingua** c'è in tutte: «lingua inglese», «language italian», «idioma español»… → `{ tipo: 'lingua', codice }`. Una lingua che Lode non parla («lingua giapponese», «language japanese», «Sprache Japanisch», anche «cambia lingua in giapponese») dà `codice: null` e la barra elenca le sei lingue (`linguaIgnota`, `linguaIgnotaDetta` in `js/comandi/comune.js`).
- **I voti** restano quelli detti (28, 30 e lode): come leggerli lo decide il sistema dei voti, non il riconoscitore.
- **Le piccole parole dentro le schede** (il sì e il no di una conferma, «basta»/«voto» che chiudono l'orale, l'uscita da «spiegamelo» e dall'orale): ogni riconoscitore esporta `PAROLE = { si, siCoda, no, voto, basta, esci }`, frasi intere in minuscolo. `comandi.js` dà `dice(testo, 'si')` nella lingua scelta; le regole sono in `detto()` di `js/comandi/comune.js`, e in italiano danno esattamente le risposte delle regex di prima (`test/scelta.mjs`).
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
- **Cambio di sistema:** passa da `cambiaSistema(cod)` di `js/dati.js` (benvenuto, Impostazioni). Nessun voto si perde: quelli scritti con il sistema di prima restano com'erano, con accanto il loro sistema (`e.sistema`), si mostrano in quel sistema con «non conta in questo sistema» (`libretto.voto-altro-sistema`) e non entrano nei conti (i crediti sì). Tornando al loro sistema contano di nuovo, e un 8,5 della Spagna non diventa null tornando all'Italia. Un voto registrato di nuovo toglie `e.sistema`. I voti letti dal disco senza `e.sistema` e fuori scala (dati di prima) restano nel libretto da correggere, come prima.
- **Crediti di una laurea:** scegliendo un sistema `profilo.cfuTotali` diventa `SISTEMI[cod].totali`; la prima volta fuori dall'Italia i 180 di partenza diventano quelli del sistema (`profilo.totaliScelti`, mai scritto in Italia). Le opzioni del benvenuto e delle Impostazioni vengono da `opzioniTotali()` di `js/sistemi.js` (in Italia le solite 180/120/300/360); «la lode vale» c'è solo con il sistema italiano.
- **La lode detta:** «10 e lode», «10 con lode», «with honours», «cum laude», «com louvor» danno la lode nei sistemi che ce l'hanno (la Matrícula de Honor in Spagna).
- **Germania:** nel cursore «e se…» e dopo un voto il cambio della media si mostra con una freccia (↑ migliora, ↓ peggiora), senza un «+» quando la media peggiora (`segno()` di `js/libretto.js`).
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
- **I testi delle note che Lode riscrive** (Memoria, Home, Esami, Glossario, le pagine dei corsi, la navigazione delle lezioni, `In tasca`) sono nella lingua del vault, come i titoli, anche quando la barra parla un'altra lingua. `js/vault.js` (`tv`) e `js/tasca.js` usano `tIn(cod, chiave, p)`, `elencoIn` e `numeroIn` di `js/lingua.js`, e le date `dataLungaIn` / `dataBreveIn` di `js/dati.js`. Il catalogo della lingua del vault si carica con `caricaLingua(cod)` quando arrivano i nomi (`vault:info`), e chi scrive aspetta `nomiPronti()`. Con la lingua della barra `tIn` è `t`; con un catalogo non ancora caricato vale l'italiano. Il diario dei progetti e «Cosa so davvero» (`js/codice/diario.js`) seguono ancora la barra.
- `vault:pulisciCorsi` (main.mjs) toglie una nota di corso solo se `scrittoNelCorso()` di `desktop/vault.mjs` è vuoto: riconosce il riquadro, i commenti, la frase italiana delle prime versioni e il commento del corso (`vaultnomi.commento-corso`) di tutte e sei le lingue.
- **Sincronizzazione:** la copia delle note nella cartella cloud (`copiaNote` in `desktop/sincronizza.mjs`) porta anche `.lode/vault.json` (solo quello di `.lode/`, e mai sopra uno che c'è già). Così un computer che entra nel gruppo crea il vault con la lingua degli altri e non con quella della sua barra; senza `vault.json` valgono le tracce (`linguaDalleTracce`).
- Le frasi della barra che citano un nome del vault lo ricevono come parametro (`vaultnomi.frase-orario-nel-vault` con `{nota}`, `vaultnomi.frase-nella-cartella` con `{cartella}`, `vaultnomi.frase-riordinati-nota` con `{sezione}`).
- Prove: `node --experimental-vm-modules test/vault-nomi.mjs`.
- **Nel pacchetto** electron-builder mette solo `desktop/`: il processo principale prende i moduli di `js/` da `desktop/web.mjs` (`WEB`, `daWeb('js/…')`), cioè dalla copia in `desktop/web` fatta da `prepara.mjs`, mai con `../js/…`. `test/unita.mjs` controlla che nessun import di `desktop/*.mjs` e `desktop/sync/*.mjs` esca da `desktop/`.

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

**Il sistema dei voti nei prompt.** In italiano con il sistema italiano i prompt sono quelli di sempre. Altrimenti `sistemaDiBase()` e `sistemaLocale()` parlano di «uno studente universitario (sistema dei voti: <paese>)», e il comando citato («chiudi lezione») viene dagli `ESEMPI` del riconoscitore della lingua scelta, allo stesso posto di quello italiano. `contesto()` dà crediti, media e voto finale con le etichette e la scala di `js/sistemi.js`; `registra_voto` riceve il voto come si scrive nel sistema («8,5», «A-»), che si legge con `leggiVoto()` e si controlla con `valido()`; `leggiLibretto(testo, sistema)` legge i libretti di tutti i sistemi (il benvenuto lo usa anche fuori dall'Italia, e se l'AI non trova niente c'è il lettore generico). `dalMateriale` e `giaDetto` conoscono le parole vuote, generiche, i numeri e le parole distintive delle sei lingue.

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

## README

`README.md` è in inglese, la porta d'ingresso su GitHub. `README.it.md` è l'italiano completo. In cima a tutti e due ci sono i link alle lingue.
