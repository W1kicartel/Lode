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
| i nomi delle cartelle e delle note di un vault **nuovo** | i nomi di un vault che esiste già |
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
- **Il comando della lingua** c'è in tutte: «lingua inglese», «language italian», «idioma español»… → `{ tipo: 'lingua', codice }`.
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

## Il vault

I nomi delle cartelle e delle note (`Lezioni`, `Esami`, `Glossario`, `Home.md`, `In tasca.md`…) passano da un'unica tabella, `NOMI` in `js/vault.js`, letta dal catalogo `vault`. Si decidono **una volta sola**, alla creazione del vault, e si salvano in `.lode/vault.json`. Un vault che esiste già tiene i nomi che ha: se `vault.json` manca, valgono i nomi italiani.

## L'AI

Ogni richiesta all'AI (`js/ai.js`) dice in che lingua rispondere, quella della barra.

I controlli italiani sul giudizio dell'orale restano solo per l'italiano. In tutte le lingue resta il controllo sulle citazioni, che non dipende dalla lingua.

## La voce e le formule

- **Voce:** Parakeet v3 e Whisper capiscono tutte e sei le lingue. A Whisper si passa la lingua della barra.
- **Formule dettate** (`js/formule.js`): italiano e inglese. Nelle altre lingue il testo resta com'è, senza conversione in formule.
  `parlatoInFormule(testo, lingua)` usa la lingua della barra se non gliela passi. In inglese capisce, per esempio, «x squared plus two x», «the integral from zero to one of x squared d x», «d y over d x», «partial f partial x», «the limit as x approaches zero of …», «the sum from n equals one to infinity of …», «f prime of x», «x to the minus one», «x sub n», «square root of», «less than or equal to», «for every epsilon … there exists delta», e anche quello che Whisper scrive già in simboli («f(x) = x^2 + 1», «sin(x)», «sqrt(2)»). I confronti, «in» e «goes to» diventano simboli solo se prima e dopo c'è un pezzo di formula: «x goes to zero» sì, «the function goes to zero» resta frase. Le prove sono in `test/formule.mjs`, con i casi italiani fissati come erano prima delle lingue.

## README

`README.md` è in inglese, la porta d'ingresso su GitHub. `README.it.md` è l'italiano completo. In cima a tutti e due ci sono i link alle lingue.
