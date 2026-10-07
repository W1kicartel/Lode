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
2. la lingua del sistema, se Lode la conosce;
3. altrimenti l'inglese.

Nelle prove in node la lingua è l'italiano, salvo `LODE_LINGUA=<codice>`. Per cambiare lingua si chiama `imposta(cod)`, che salva la scelta (e nell'app la passa al processo principale con `lingua:imposta`), e poi si ricarica la finestra.

La lingua si sceglie:
- nel benvenuto, come prima domanda;
- con il comando «lingua inglese» / «language italian» / «idioma español»…;
- dalla pagina, in Impostazioni.

## I comandi senza AI

`js/comandi.js` smista: prova le frasi della lingua scelta (`js/comandi/<codice>.js`), poi quelle inglesi se la lingua scelta non è l'inglese. Ogni riconoscitore restituisce gli **stessi oggetti** `{ tipo, … }` del riconoscitore italiano, così il resto della barra non cambia.

- Le parti senza lingua restano in `comandi.js`: orari «14-19», date «12/02», numeri, durate in cifre.
- Ogni lingua ha le sue parole: giorni, mesi, «domani», numeri scritti, verbi dei comandi.
- **`ESEMPI`** diventa un elenco per lingua, nel catalogo (`comandi.esempi`).
- **Prove:** `test/comandi-lingue.mjs`. Per ogni lingua, almeno 3 frasi per ogni `tipo` che l'italiano riconosce. Ogni frase deve dare lo stesso `tipo`, con gli stessi campi, della frase italiana corrispondente. Ci sono anche frasi che **non** devono diventare comandi.

## Sistemi dei voti

`js/sistemi.js` descrive ogni sistema. Lo studente lo sceglie nel benvenuto e lo salva in `profilo.sistema`. Il predefinito viene dalla lingua: `it` → `it`, `es` → `es`, `fr` → `fr`, `de` → `de`, `pt` → `pt`, `en` → `uk`.

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
