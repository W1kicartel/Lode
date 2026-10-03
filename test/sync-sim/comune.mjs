// Pezzi comuni del simulatore della sincronizzazione (il contratto è in testa a mondo.mjs, le proprietà in testa a fuzz.mjs): il caso con seme, il JSON
// stabile, gli errori del file system finto e quello che si cerca nei file per dire «dati in chiaro».

// mulberry32: 32 bit di stato, abbastanza per le prove, e soprattutto ripetibile: stesso seme, stessa storia
export function caso(seme) {
  let a = (Number(seme) >>> 0) || 0x9e3779b9;
  const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.intero = (min, max) => min + Math.floor(f() * (max - min + 1));
  f.scegli = l => l[Math.floor(f() * l.length)];
  f.vero = p => f() < p;
  return f;
}
// un seme da un testo (per i semi «per passo»: togliere un passo non cambia le scelte degli altri)
export function semeDi(testo) { let h = 2166136261; for (const c of String(testo)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// JSON con le chiavi in ordine: stesso contenuto, stesso testo
export function stabile(x) {
  if (Array.isArray(x)) return '[' + x.map(v => v === undefined ? 'null' : stabile(v)).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stabile(x[k])).join(',') + '}';
  return JSON.stringify(x ?? null);
}

// gli errori come quelli di node:fs (codice in .code), così il motore li tratta come quelli veri
export const erroreFs = (code, op, p) => Object.assign(new Error(`${code}: ${op} '${p}'`), { code, syscall: op, path: p });
// il «kill» del motore: da qui in poi il processo non c'è più. Il motore non deve poterlo prendere per un errore qualsiasi
export class Crash extends Error { constructor(dove) { super(`crash simulato (${dove})`); this.crash = true; this.code = 'ESIMCRASH'; } }

// ogni testo che lo studente scrive nelle prove contiene un marcatore «ZQ <numero>»: se compare in un file della cartella cloud
// con la cifratura accesa, quel file porta dati dello studente in chiaro. Lo spazio non c'è mai in base64, base64url o
// esadecimale: un testo cifrato non lo contiene per caso («ZQ12» sì, una volta ogni ~30 KB di base64)
export const MARCATORE = /ZQ \d+/;
export const contieneMarcatore = buf => MARCATORE.test(Buffer.isBuffer(buf) ? buf.toString('latin1') : String(buf));

export const pausa = () => new Promise(r => setImmediate(r));
