// I giochi di memoria: due minuti sulle definizioni dell'ultima lezione. Quattro tipi di manche:
// «abbina» (4 termini e 4 definizioni), «chi sono?» (dalla definizione al termine, 4 scelte),
// «completa» (la parola chiave che manca) e «flash» (te la ricordi?). Niente AI: bastano le definizioni del vault.
import { norm } from './dati.js';

// le parole da non nascondere: l'italiano di sempre più le parole vuote (di almeno 5 lettere: le altre non si scelgono mai)
// delle altre lingue, perché le definizioni vengono dagli appunti, nella lingua in cui li prende lo studente.
// Niente parole che in italiano sono piene («mediante», «tiene»)
const VUOTE = new Set(['della delle degli dello dalla dalle dagli nella nelle negli sulla sulle sugli come cioè quando dove anche ogni sono essere viene vengono questa questo quella quello tutte tutti molto più meno solo ogni fra tra per con una uno che non del dei gli alla alle allo agli sua suo loro',
  'which where there their these those about after before being between through other others could would should under while every always often',
  'donde cuando sobre entre porque desde hasta estos estas otros otras puede pueden tienen según también siempre todos todas',
  'dans avec pour sont cette entre leurs autre autres peuvent quand comme selon depuis aussi toujours chaque toutes',
  'nicht einer eines einem einen keine diese dieser dieses wenn durch werden wird sind zwischen unter oder über ihrer seine seiner immer jeder jedes',
  'quando sobre entre porque desde para pelos pelas estes estas outros outras pode podem como segundo também sempre todos todas cada',
].join(' ').split(' '));
const mescola = a => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

// la parola da nascondere: la più lunga e significativa, che non ripeta il termine
export function buco(def) {
  const parole = [...def.d.matchAll(/[\p{L}][\p{L}'-]*/gu)];
  const termine = norm(def.t).split(' ');
  const cand = parole.filter(m => m[0].length >= 5 && !VUOTE.has(m[0].toLowerCase()) && !termine.includes(norm(m[0]))).sort((a, b) => b[0].length - a[0].length);
  const m = cand[0]; if (!m) return null;
  return { prima: def.d.slice(0, m.index), parola: m[0], dopo: def.d.slice(m.index + m[0].length) };
}
function distanza(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// tollerante agli errori di battitura (una lettera ogni sei) e alle desinenze
export function giusta(risposta, parola) {
  const r = norm(risposta), p = norm(parola);
  if (!r) return false;
  if (r === p) return true;
  if (p.length >= 6 && r.slice(0, -1) === p.slice(0, -1)) return true;
  return distanza(r, p) <= Math.floor(p.length / 6);
}

// prepara la partita: con almeno 4 definizioni si parte da «abbina», poi «chi sono?», «completa» e «flash»
export function partita(scelte, tutte) {
  const manche = [], pool = tutte.length >= 4 ? tutte : scelte;
  const distrattori = d => mescola(pool.filter(x => x.k !== d.k)).slice(0, 3);
  let resto = [...scelte];
  if (resto.length >= 4) { manche.push({ tipo: 'abbina', defs: resto.slice(0, 4) }); resto = resto.slice(4).concat(mescola(scelte.slice(0, 4)).slice(0, 2)); }
  resto.forEach((d, i) => {
    const b = buco(d);
    const tipo = i % 3 === 0 && pool.length >= 4 ? 'chi' : i % 3 === 1 && b ? 'completa' : 'flash';
    manche.push(tipo === 'chi' ? { tipo, def: d, opzioni: mescola([d, ...distrattori(d)]) } : tipo === 'completa' ? { tipo, def: d, buco: b } : { tipo, def: d });
  });
  return manche.slice(0, 5);
}
