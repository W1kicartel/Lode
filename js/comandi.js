// Capire una frase senza AI, nella lingua della barra: «focus 50 su analisi» · «focus 50 on calculus» · «ho preso 28 in
// fisica» · «I got 28 in physics» · «lingua inglese» · «language italian»…
// Qui si smista: prima il riconoscitore della lingua scelta (js/comandi/<codice>.js), poi quello inglese se la lingua scelta
// non è l'inglese. Ogni riconoscitore restituisce gli stessi oggetti { tipo, … } dell'italiano, così il resto della barra
// non cambia (l'elenco dei tipi e la forma degli oggetti: docs/LINGUE.md e test/comandi-lingue.mjs).
// Se la frase non è un comando, ritorna null e (se c'è la chiave) ci pensa l'AI.
// Le parti senza lingua (date e orari in cifre, gli errori incollati) stanno in js/comandi/comune.js.
import { lingua } from './lingua.js';
import { D } from './dati.js';
import { inLingua } from './comandi/comune.js';
import * as it from './comandi/it.js';
import * as en from './comandi/en.js';

// i riconoscitori: l'italiano (la lingua di partenza) e l'inglese (la riserva) ci sono sempre; quello della lingua scelta si
// carica qui, prima di tutto il resto (come i cataloghi in lingua.js). Una lingua senza il suo file usa l'inglese
const R = { it, en };
export async function carica(cod) {
  if (!(cod in R)) R[cod] = await import(`./comandi/${cod}.js`).catch(e => { console.warn(`comandi: niente riconoscitore per «${cod}» (${e.message})`); return null; });
  return R[cod];
}
await carica(lingua);
const scelto = () => R[lingua] || en;
// la funzione «nome» della lingua scelta e poi quella inglese (la prima che dà un risultato)
function prima(nome, ...a) {
  const s = scelto(), r = s[nome]?.(...a);
  if (r != null || s === en) return r ?? null;
  return en[nome]?.(...a) ?? null;
}
// l'inglese di riserva capisce le frasi inglesi, non quelle nella lingua scelta che cominciano con una parola inglese
// («today è una giornata storta», «open la pagina di fisica», «review del codice di lab3»): quelle vanno all'AI. Restano
// buone, anche con parole della lingua scelta, quelle che trovano un esame del libretto («review basi di dati»), l'errore
// incollato, le carte («flashcard: teorema di Green = …»), i progetti e il cambio di lingua
const LIBERI = new Set(['errore', 'carta', 'progetto', 'lingua']);
function interpretaFrase(frase) {
  const s = scelto(), r = s.interpreta(frase);
  if (r != null || s === en) return r;
  const x = en.interpreta(frase);
  if (x && !LIBERI.has(x.tipo) && !x.esame && !x.esistente && inLingua(frase, lingua)) return null;
  return x;
}

export const interpreta = frase => interpretaFrase(frase);
export const leggiData = testo => prima('leggiData', testo);
// giorni e ore di una frase, l'orario di una lezione, i turni di lavoro (per il benvenuto, js/ore.js e le prove)
export const giorniEOre = testo => prima('giorniEOre', testo);
export const leggiOrario = testo => prima('leggiOrario', testo);
export const leggiLavoro = testo => prima('leggiLavoro', testo);
// i numeri detti a voce diventano cifre nella lingua scelta («ventotto» → 28, «twenty-eight» → 28; in italiano è la
// funzione di sempre, che js/formule.js usa per le formule dettate). Una lingua senza le sue parole lascia il testo com'è
export const numeri = t => (R[lingua]?.numeri ? R[lingua].numeri(t) : t);
// gli esempi della lingua scelta: [frase, cosa fa]
export const ESEMPI = scelto().ESEMPI;
export { D };
