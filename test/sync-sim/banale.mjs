// Un motore banale, per provare il simulatore: se questo non passa senza guasti, il simulatore dà falsi allarmi.
// Ogni computer scrive solo il suo registro di operazioni (.lode/banale/<id>.json, temporaneo + rename) e legge quelli degli
// altri; lo stato è dati.json di partenza (.lode/banale/base.json, scritto una volta dal primo computer) più tutte le
// operazioni in ordine di orologio di Lamport (poi id del computer, poi numero). Un'operazione fatta dopo averne viste altre ha
// un Lamport più alto: le supera. I contatori sommano perché applicaOp somma. Orario.md: una modifica che il watcher vede
// diventa operazioni (righe aggiunte e tolte rispetto all'ultima versione vista qui), con l'impronta del file: chi riceve un
// Orario.md già spiegato dal registro di un altro computer non lo rifà.
// Non regge i guasti (crash a metà, file a metà, segnaposto, copie in conflitto dei suoi file): non è il suo mestiere.
import { applicaOp, leggiOrario, chiaveLezione } from './operazioni.mjs';
import { createHash } from 'node:crypto';

const impronta = t => createHash('sha256').update(t).digest('hex').slice(0, 16);

export function crea({ fs, vault, dati, casuale }) {
  const DIR = `${vault}/.lode/banale`, CONF = `${dati}/banale.json`;
  let id = null, base = null, lamport = 0, n = 0, ultimoOrario = null;
  const ops = new Map();   // `${pc}:${n}` → { l, pc, n, op, orario? }
  const miei = [];
  const leggi = async p => { try { return await fs.readFile(p, 'utf8'); } catch { return null; } };
  const json = t => { try { return JSON.parse(t); } catch { return null; } };
  async function scriviAtomico(p, testo) { const tmp = `${p}.tmp-${n}`; await fs.writeFile(tmp, testo); await fs.rename(tmp, p); }
  async function salvaMiei() { await fs.mkdir(DIR, { recursive: true }); await scriviAtomico(`${DIR}/${id}.json`, JSON.stringify({ id, ops: miei })); }
  async function leggiTutto() {
    let nomi = []; try { nomi = await fs.readdir(DIR); } catch { }
    for (const nome of nomi) {
      if (nome === 'base.json') { if (!base) base = json(await leggi(`${DIR}/${nome}`)); continue; }
      const j = json(await leggi(`${DIR}/${nome}`)); if (!j?.ops) continue;
      for (const o of j.ops) { ops.set(`${o.pc}:${o.n}`, o); lamport = Math.max(lamport, o.l); }
    }
  }
  function stato() {
    const D = structuredClone(base || { v: 1, esami: [], carte: [], orario: [], memoria: {}, codice: { errori: {} }, profilo: {}, imp: {} });
    const l = [...ops.values()].sort((a, b) => a.l - b.l || (a.pc < b.pc ? -1 : a.pc > b.pc ? 1 : a.n - b.n));
    for (const o of l) applicaOp(D, o.op);
    return D;
  }
  async function aggiungi(op, extra = {}) {
    const o = { l: ++lamport, pc: id, n: ++n, op, ...extra };
    miei.push(o); ops.set(`${id}:${o.n}`, o);
    await salvaMiei();
  }
  // solo le modifiche fatte qui (studente: l'aiuto del mondo): un Orario.md arrivato dal cloud è già spiegato dal registro di
  // chi l'ha cambiato, e rifarne le differenze qui darebbe doppioni fuori ordine
  async function guardaOrario(studente) {
    const t = await leggi(`${vault}/Orario.md`); if (t == null || t === ultimoOrario) return;
    const h = impronta(t), prima = ultimoOrario; ultimoOrario = t;
    if (prima == null || !studente) return;
    const A = leggiOrario(prima), B = leggiOrario(t), kA = new Set(A.map(chiaveLezione)), kB = new Set(B.map(chiaveLezione));
    for (const o of B) if (!kA.has(chiaveLezione(o))) await aggiungi({ tipo: 'aggiungiLezione', lezione: o }, { orario: h });
    for (const o of A) if (!kB.has(chiaveLezione(o))) await aggiungi({ tipo: 'togliLezione', lezione: o }, { orario: h });
  }
  return {
    async apri() {
      const c = json(await leggi(CONF));
      if (c?.id) { id = c.id; n = c.n || 0; }
      else { id = Array.from({ length: 16 }, () => '0123456789abcdef'[Math.floor(casuale() * 16)]).join(''); await fs.mkdir(dati, { recursive: true }); await fs.writeFile(CONF, JSON.stringify({ id })); }
      const mio = json(await leggi(`${DIR}/${id}.json`)); if (mio?.ops) { miei.push(...mio.ops); n = Math.max(n, ...mio.ops.map(o => o.n)); }
      await leggiTutto();
      ultimoOrario = await leggi(`${vault}/Orario.md`);
    },
    async attiva({ modo }) {
      if (modo === 'nuovo') {
        const d = json(await leggi(`${vault}/.lode/dati.json`));
        base = d; await fs.mkdir(DIR, { recursive: true }); await scriviAtomico(`${DIR}/base.json`, JSON.stringify(d));
      }
      await leggiTutto();
    },
    async modifica(op) { await aggiungi(op); },
    vista: () => stato(),
    async arrivati(x) { await leggiTutto(); await guardaOrario(x?.orario === 'studente'); },
    chiudi() { },
  };
}
