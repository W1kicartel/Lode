// Capire una frase senza AI, nella lingua della barra: «focus 50 su analisi» · «focus 50 on calculus» · «ho preso 28 in
// fisica» · «I got 28 in physics» · «lingua inglese» · «language italian»…
// Qui si smista: prima il riconoscitore della lingua scelta (js/comandi/<codice>.js), poi quello inglese se la lingua scelta
// non è l'inglese. Ogni riconoscitore restituisce gli stessi oggetti { tipo, … } dell'italiano, così il resto della barra
// non cambia (l'elenco dei tipi e la forma degli oggetti: docs/LINGUE.md e test/comandi-lingue.mjs).
// Se la frase non è un comando, ritorna null e (se c'è la chiave) ci pensa l'AI.
// Le parti senza lingua (date e orari in cifre, gli errori incollati) stanno in js/comandi/comune.js.
import { lingua } from './lingua.js';
import { D } from './dati.js';
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

export const interpreta = frase => prima('interpreta', frase);
export const leggiData = testo => prima('leggiData', testo);
// giorni e ore di una frase, l'orario di una lezione, i turni di lavoro (per il benvenuto, js/ore.js e le prove)
export const giorniEOre = testo => prima('giorniEOre', testo);
export const leggiOrario = testo => prima('leggiOrario', testo);
export const leggiLavoro = testo => prima('leggiLavoro', testo);
// i numeri detti a voce diventano cifre («ventotto» → 28), nella lingua scelta; per le altre lingue senza parole sue,
// quelle italiane (js/formule.js li usa per le formule dettate)
export const numeri = t => (R[lingua]?.numeri || it.numeri)(t);
// gli esempi della lingua scelta: [frase, cosa fa]
export const ESEMPI = scelto().ESEMPI;
export { D };
