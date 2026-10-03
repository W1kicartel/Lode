// Dalla barra al diario (docs/SINCRONIZZAZIONE.md §7): le differenze fra la BASE che una finestra aveva (l'ultima vista che
// le è arrivata, normalizzata come fa js/dati.js) e il D che manda con salva(), tradotte negli eventi del motore. Pura.
// - liste (esami, carte, sessioni, lezioni) per id: record nuovo → crea, record sparito → cancella (solo se la finestra lo
//   aveva: #28), campo cambiato → campo; i campi SM-2 di una carta → ripasso (con q e giorno se la barra l'ha detto, sm2.js)
// - orario per chiave della lezione (corso|giorni|ore|aula, §9): l'id è sempre o<k>, anche se la barra ne aveva uno casuale;
//   una lezione cambiata è una tolta e una aggiunta
// - il resto foglia per foglia (mai un oggetto intero: un registro generico scritto dopo quelli specifici li coprirebbe nella
//   vista); gli array sono valori. Contatori → conta con la differenza; valori locali e ricavati → niente; codice.eventi → le
//   sole voci nuove («eventi»)
// Un valore di partenza mai toccato non è una differenza (#9): la BASE arriva già normalizzata con i predefiniti della barra.
import { LISTE, RIPASSO, tipoPercorso } from './schema.mjs';
import { canonico } from './piega.mjs';
import { idLezione } from './orario.mjs';

const uguale = (a, b) => canonico(a) === canonico(b);
const oggetto = x => !!x && typeof x === 'object' && !Array.isArray(x);
const riga = o => ({ corso: o.corso, giorni: [...(o.giorni || [])], inizio: o.inizio, fine: o.fine, aula: o.aula || '' });

// la BASE come la vede la barra: i predefiniti (VUOTO() di js/dati.js, mandato dalla barra) sotto la vista, come unisci()
export function normalizza(V, vuoto = {}) {
  const d = structuredClone(V || {});
  return { ...structuredClone(vuoto), ...d, profilo: { ...vuoto.profilo, ...d.profilo }, imp: { ...vuoto.imp, ...d.imp }, codice: { ...vuoto.codice, ...d.codice } };
}

// esplicite: le operazioni che la barra ha già detto lei (ripasso con q e giorno): i campi SM-2 di quelle carte non si confrontano
export function differenze(B, D, { esplicite = [], meta = {} } = {}) {
  const ops = [], conRipasso = new Set(esplicite.filter(o => o?.tipo === 'ripasso').map(o => o.carta));
  for (const o of esplicite) if (o?.tipo === 'ripasso' && typeof o.carta === 'string' && Number.isInteger(o.q) && /^\d{4}-\d{2}-\d{2}$/.test(o.giorno || '') && oggetto(o.ris)) {
    ops.push({ tipo: 'ripasso', carta: o.carta, q: o.q, giorno: o.giorno, ris: Object.fromEntries(RIPASSO.map(c => [c, o.ris[c] ?? null])) });
  }
  const campo = (percorso, valore) => ops.push({ tipo: 'campo', percorso, valore: valore === undefined ? null : structuredClone(valore), prev: meta[percorso] ?? null });
  for (const lista of LISTE) {
    const b = Array.isArray(B?.[lista]) ? B[lista] : [], d = Array.isArray(D?.[lista]) ? D[lista] : [];
    if (lista === 'orario') {
      const kb = new Map(b.filter(oggetto).map(o => [idLezione(o), o])), kd = new Map(d.filter(oggetto).map(o => [idLezione(o), o]));
      for (const [id] of kb) if (!kd.has(id)) ops.push({ tipo: 'cancella', lista, id });
      for (const [id, o] of kd) if (!kb.has(id)) ops.push({ tipo: 'crea', lista, id, campi: riga(o) });
      continue;
    }
    const mb = new Map(b.filter(r => oggetto(r) && typeof r.id === 'string').map(r => [r.id, r]));
    const md = new Map(d.filter(r => oggetto(r) && typeof r.id === 'string').map(r => [r.id, r]));
    for (const [id] of mb) if (!md.has(id)) ops.push({ tipo: 'cancella', lista, id });
    for (const [id, r] of md) {
      const { id: _, ...campi } = r, prima = mb.get(id);
      if (!prima) { ops.push({ tipo: 'crea', lista, id, campi: structuredClone(campi) }); continue; }
      let sm2 = false;
      for (const c of new Set([...Object.keys(prima), ...Object.keys(r)])) {
        if (c === 'id' || uguale(prima[c], r[c])) continue;
        const p = `${lista}/${id}/${c}`;
        if (lista === 'carte' && RIPASSO.includes(c)) { sm2 = true; continue; }
        if (tipoPercorso(p) !== 'registro') continue;
        campo(p, r[c]);
      }
      if (sm2 && !conRipasso.has(id)) ops.push({ tipo: 'ripasso', carta: id, ris: Object.fromEntries(RIPASSO.map(c => [c, r[c] ?? null])) });
    }
  }
  // il resto, foglia per foglia
  const giu = (b, d, percorso) => {
    if (oggetto(b) || oggetto(d)) {
      if (!oggetto(d) && d !== undefined && percorso) { if (!uguale(b, d)) campo(percorso, d); return; }   // un oggetto diventato un valore
      const kb = oggetto(b) ? b : {}, kd = oggetto(d) ? d : {};
      for (const k of new Set([...Object.keys(kb), ...Object.keys(kd)])) giu(kb[k], kd[k], percorso ? `${percorso}/${k}` : k);
      return;
    }
    if (uguale(b, d)) return;
    const tipo = tipoPercorso(percorso);
    if (tipo === 'contatore') { const delta = (Number(d) || 0) - (Number(b) || 0); if (delta) ops.push({ tipo: 'conta', percorso, delta }); }
    else if (tipo === 'registro') campo(percorso, d);
  };
  // i diari dei progetti (codice.eventi, al massimo 2000 voci nella barra): solo le voci nuove, con un evento «eventi»; quelle
  // che la barra toglie in testa per il limite non sono cancellazioni
  const be = Array.isArray(B?.codice?.eventi) ? B.codice.eventi : [], de = Array.isArray(D?.codice?.eventi) ? D.codice.eventi : [];
  const viste = new Set(be.map(canonico)), voci = de.filter(e => !viste.has(canonico(e)));
  if (voci.length) ops.push({ tipo: 'eventi', voci: structuredClone(voci) });
  const resto = x => { const r = Object.fromEntries(Object.entries(x || {}).filter(([k]) => k !== 'v' && !LISTE.includes(k) && !k.startsWith('__'))); if (oggetto(r.codice)) { r.codice = { ...r.codice }; delete r.codice.eventi; } return r; };
  giu(resto(B), resto(D), '');
  return ops;
}
