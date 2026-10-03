// L'adattatore del motore v2 (desktop/sync/motore.mjs) al contratto del simulatore (mondo.mjs, docs/SINCRONIZZAZIONE.md §13.1).
// Traduce le operazioni del simulatore (operazioni.mjs) negli eventi della barra, e passa al motore parametri scrypt leggeri
// (le prove ne fanno migliaia: il motore accetta solo quelli che riceve, come in produzione accetta solo N=2^17).
// La cifratura delle prove è vera (AES-256-GCM): cambia solo il costo della chiave. Il portachiavi (safeStorage nel main) lo dà
// il mondo, uno per computer.
import { creaMotore, percorsi } from '../../desktop/sync/motore.mjs';
import { idLezione } from '../../desktop/sync/orario.mjs';

export { percorsi };
export const PARAMETRI_PROVA = { kdf: 'scrypt', N: 2 ** 10, r: 8, p: 1 };
const riga = o => ({ corso: o.corso, giorni: [...(o.giorni || [])], inizio: o.inizio, fine: o.fine, aula: o.aula || '' });

// operazione del simulatore → evento della barra (js/dati.js lo farà con le differenze fra BASE e D)
export function evento(op) {
  switch (op.tipo) {
    case 'aggiungiEsame': return { tipo: 'crea', lista: 'esami', id: op.id, campi: { nome: op.nome, cfu: op.cfu ?? 6, voto: null } };
    case 'campoEsame': return { tipo: 'campo', percorso: `esami/${op.id}/${op.campo}`, valore: op.valore };
    case 'cancellaEsame': return { tipo: 'cancella', lista: 'esami', id: op.id };
    case 'aggiungiCarta': return { tipo: 'crea', lista: 'carte', id: op.id, campi: { esameId: op.esameId, fronte: op.fronte, retro: op.retro, ease: 2.5, int: 0, rip: 0, scad: op.scad || '2026-10-03' } };
    case 'testoCarta': return { tipo: 'campo', percorso: `carte/${op.id}/${op.campo}`, valore: op.valore };
    case 'ripassaCarta': return { tipo: 'ripasso', carta: op.id, ris: op.ripasso, ...(op.q != null ? { q: op.q, giorno: op.giorno } : {}) };
    case 'cancellaCarta': return { tipo: 'cancella', lista: 'carte', id: op.id };
    case 'incrementa': return { tipo: 'conta', percorso: op.dove === 'errori' ? `codice/errori/${op.chiave}` : `memoria/${op.chiave}/giuste`, delta: op.di };
    case 'profilo': return { tipo: 'campo', percorso: `profilo/${op.campo}`, valore: op.valore };
    case 'impostazione': return { tipo: 'campo', percorso: `imp/${op.campo}`, valore: op.valore };
    case 'aggiungiLezione': return { tipo: 'crea', lista: 'orario', id: idLezione(op.lezione), campi: riga(op.lezione) };
    case 'togliLezione': return { tipo: 'cancella', lista: 'orario', id: idLezione(op.lezione) };
    default: throw new Error('operazione sconosciuta: ' + op.tipo);
  }
}
// i percorsi del motore → i registri del modello (per i conflitti: ritocco f)
const registro = p => p.replace(/^esami\//, 'esame/').replace(/^carte\//, 'carta/');

export function crea(x) {
  const m = creaMotore({ ...x, parametri: PARAMETRI_PROVA });
  return {
    apri: () => m.apri(), attiva: o => m.attiva(o), migra: () => m.migra(), vista: () => m.vista(), arrivati: () => m.arrivati(),
    chiudi: () => m.chiudi(), cifra: pw => m.cifra(pw), sblocca: pw => m.sblocca(pw), smetti: o => m.smetti(o), toglila: () => m.toglila(),
    modifica: op => m.modifica(evento(op)),
    conflitti: () => m.conflitti().map(registro), importaAggiunte: () => m.importaAggiunte(),
    stato: () => m.stato(),
    motore: m,
  };
}
