// Attrezzi per i casi dei comandi (test/comandi/<codice>.mjs), usati dal banco test/comandi-lingue.mjs.
// I nomi degli esami sono dati dello studente, non parole della lingua: il banco mette nel libretto sia quelli italiani
// (Analisi 2, Fisica 2, Basi di dati…) sia quelli inglesi (Calculus 2, Physics 2, Databases…) e spagnoli (Cálculo 2,
// Bases de datos…; «física 2» è già Fisica 2). Le altre lingue scelgono
// fra questi, o aggiungono i loro in ESAMI qui sotto.
import { oggi, piuGiorni } from '../../js/dati.js';
import { conAnno } from '../../js/comandi/comune.js';

// il libretto del banco: [nome, cfu, fatto (con il voto), idoneità]
export const ESAMI = [
  ['Analisi 1', 9, 27], ['Analisi 2', 9], ['Basi di dati', 9], ['Fisica 2', 6], ['Diritto privato', 9], ['Lingua inglese B2', 3, null, true],
  ['Calculus 1', 9, 27], ['Calculus 2', 9], ['Databases', 9], ['Physics 2', 6], ['Private law', 9], ['English B2', 3, null, true],
  ['Cálculo 1', 9, 27], ['Cálculo 2', 9], ['Bases de datos', 9], ['Derecho privado', 9], ['Inglés B2', 3, null, true],
];
// l'esame con questo nome, nel risultato atteso: il banco lo sostituisce con l'oggetto vero del libretto
export const E = nome => '@esame:' + nome;
// le date come le calcolano i riconoscitori
export const giorno = k => piuGiorni(oggi(), k);
// giorno e mese (gennaio = 0) senza anno: il prossimo
export const prossimo = (g, mese) => conAnno(g, mese, null);
// «lunedì», «on monday» in una data: il prossimo, da domani in avanti (dom = 0)
export const prossimoGiorno = dow => piuGiorni(oggi(), (dow - new Date(oggi() + 'T12:00').getDay() + 7) % 7 || 7);
// «giovedì non lavoro»: il prossimo, oggi compreso
export const giornoDetto = dow => piuGiorni(oggi(), (dow - new Date(oggi() + 'T12:00').getDay() + 7) % 7);
