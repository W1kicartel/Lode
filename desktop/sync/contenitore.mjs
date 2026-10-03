// Il contenitore nel vault (docs/SINCRONIZZAZIONE.md §4): `.lode/sync/<g>/<dev>/<n>.seg`. Una riga d'intestazione
// { v:2, gruppo, dev, n, cifrato, conta }, poi gli eventi, uno per riga; in un gruppo cifrato, dopo l'intestazione, un solo
// blocco AES-256-GCM con AAD «gruppo|dev|n» (⊕8). Lo riscrive solo il computer dev. Funzioni pure.
import { canonico, valida } from './piega.mjs';
import { chiudi, apri } from './cifra.mjs';

export const aad = (gruppo, dev, n) => `${gruppo}|${dev}|${n}`;

// eventi → testo del contenitore (chiave: Buffer se il gruppo è cifrato)
export function scriviContenitore({ gruppo, dev, n, eventi, chiave = null }) {
  const righe = eventi.map(canonico), testa = canonico({ v: 2, gruppo, dev, n, cifrato: !!chiave, conta: righe.length });
  if (!chiave) return [testa, ...righe].join('\n') + '\n';
  return testa + '\n' + chiudi(chiave, righe.join('\n'), aad(gruppo, dev, n)) + '\n';
}

// testo → { eventi, n, sconosciuti } oppure { errore }:
//   'intestazione' non è un contenitore di questo gruppo e di questo computer (o è a metà fin dalla prima riga)
//   'versione'     intestazione di una Lode più nuova
//   'chiaro'       contenitore in chiaro in un gruppo cifrato: si rifiuta (I5)
//   'password'     cifrato e la chiave non c'è
//   'rovinato'     non si verifica (GCM) o righe che non tornano: a metà, rovinato o manomesso. Si salta e si riprova
export function leggiContenitore(testo, { gruppo, dev, cifrato, chiave = null }) {
  const righe = String(testo).split('\n');
  let testa; try { testa = JSON.parse(righe[0]); } catch { return { errore: 'intestazione' }; }
  if (!testa || typeof testa !== 'object' || testa.gruppo !== gruppo || testa.dev !== dev) return { errore: 'intestazione' };
  if (testa.v !== 2) return { errore: Number(testa.v) > 2 ? 'versione' : 'intestazione' };
  if (!Number.isInteger(testa.n) || testa.n < 1 || !Number.isInteger(testa.conta) || testa.conta < 0) return { errore: 'intestazione' };
  if (cifrato && !testa.cifrato) return { errore: 'chiaro' };
  let corpo = righe.slice(1);
  if (testa.cifrato) {
    if (!chiave) return { errore: 'password' };
    if (!testo.endsWith('\n')) return { errore: 'rovinato' };
    const t = apri(chiave, righe[1] || '', aad(gruppo, dev, testa.n));
    if (t == null) return { errore: 'rovinato' };
    corpo = t ? t.split('\n') : [];
  } else {
    if (!testo.endsWith('\n')) return { errore: 'rovinato' };
    corpo = corpo.slice(0, -1);
  }
  if (corpo.length !== testa.conta) return { errore: 'rovinato' };
  // un evento malformato (riga illeggibile, h che non torna, orologio impossibile) va in quarantena da solo (§6.2)
  const eventi = [], sconosciuti = []; let malformati = 0;
  for (const r of corpo) {
    let e; try { e = JSON.parse(r); } catch { malformati++; continue; }
    const v = valida(e);
    if (v === 'malformato') { malformati++; continue; }
    (v === 'ok' ? eventi : sconosciuti).push(e);
  }
  return { eventi: [...eventi, ...sconosciuti], sconosciuti: sconosciuti.length, malformati, n: testa.n };
}
