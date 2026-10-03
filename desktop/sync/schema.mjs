// La tabella dei percorsi di D (docs/SINCRONIZZAZIONE.md §3): per ogni percorso dice se è un registro, un contatore, un valore
// ricavato o un valore solo locale. Un percorso che la tabella non conosce vale come registro, così nessun dato si scarta.
// Un percorso è un testo con «/»: «esami/e2/voto», «profilo/nome», «codice/errori/k2», «memoria/k1/giuste».

// le liste di record con un id: ogni record è un insieme di registri (un registro per campo) che si cancella e si ripristina
export const LISTE = ['esami', 'carte', 'orario', 'sessioni', 'lezioni'];
// i campi SM-2 di una carta: si piegano come un valore solo (il registro «carte/<id>/ripasso»)
export const RIPASSO = ['ease', 'int', 'rip', 'scad'];

const CONTATORI = [/^codice\/errori\/[^/]+$/, /^memoria\/[^/]+\/(giuste|sbagliate)$/];
const LOCALI = new Set(['imp/chiave', 'imp/ultimoSuggerimento']);   // restano in config.json, sul computer
const RICAVATI = [/^esami\/[^/]+\/media$/];   // si ricalcolano: le differenze li ignorano

export function tipoPercorso(p) {
  if (LOCALI.has(p)) return 'locale';
  if (CONTATORI.some(r => r.test(p))) return 'contatore';
  if (RICAVATI.some(r => r.test(p))) return 'ricavato';
  return 'registro';
}
// «esami/e2/voto» → { lista: 'esami', id: 'e2', campo: 'voto' }; null se non è il campo di un record
export function campoDiRecord(p) {
  const i = p.indexOf('/'), j = p.indexOf('/', i + 1);
  if (i < 0 || j < 0 || !LISTE.includes(p.slice(0, i))) return null;
  return { lista: p.slice(0, i), id: p.slice(i + 1, j), campo: p.slice(j + 1) };
}

// il D vuoto (come VUOTO() di js/dati.js, per la parte che si sincronizza)
export const VUOTO = () => ({
  v: 1, profilo: {}, esami: [], carte: [], orario: [], sessioni: [], lezioni: [], memoria: {},
  codice: { memoria: {}, errori: {}, eventi: [], diari: {}, opzioni: {} }, imp: {},
});

// la chiave di una lezione (corso|giorni|inizio|fine|aula) e il suo id deterministico: la stessa lezione, scritta da Lode, da
// Obsidian o dalla migrazione, ha lo stesso id su tutti i computer (§9)
export const chiaveLezione = o => [o.corso, (o.giorni || []).join(','), o.inizio, o.fine, o.aula || ''].join('|');
