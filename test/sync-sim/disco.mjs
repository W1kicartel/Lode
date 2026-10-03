// Il disco finto di un computer, in memoria. Due cartelle: «vault» (quella nella cartella cloud, che cloud.mjs porta agli
// altri computer) e «dati» (la cartella dei dati di Lode su quel computer, mai condivisa). Percorsi relativi alla radice del
// computer, con «/» («vault/.lode/x.json»).
//
// Il motore non tocca il disco direttamente: riceve una «maniglia» (maniglia()) con le funzioni di node:fs/promises che servono
// (readFile, writeFile, rename, unlink, rm, readdir, stat, mkdir) e, per l'adattatore del v1 che è sincrono, le stesse in
// .sync (readFileSync, existsSync…). La maniglia:
// - controlla che ogni scrittura stia nelle cartelle permesse (permesso(p)): se no la segna in violazioni, e la fa lo stesso
//   (si vuole vedere il danno, non nasconderlo);
// - può «uccidere» il motore a una scrittura qualsiasi (armaCrash): prima della k-esima operazione che cambia il disco, o a metà
//   di una writeFile (sul disco resta solo l'inizio: writeFile non è atomica, rename sì). Da lì in poi ogni chiamata di quella
//   maniglia lancia Crash: il processo è morto, niente può più scrivere, nemmeno un catch del motore che prova a rimediare;
// - prima di ogni operazione asincrona chiama prima(op, p): il mondo ci fa arrivare file dal cloud nel mezzo di un'operazione
//   del motore (ordini arbitrari anche dentro una sola chiamata);
// - può far fallire le letture o le scritture sotto una cartella con un errore che non è «non c'è» (guasta: EIO di un disco
//   che muore, EACCES, EBUSY di un antivirus, ENOSPC del disco pieno) finché il mondo non ripara. Prima il simulatore non
//   faceva mai fallire una lettura con un errore diverso da ENOENT, e un diario saltato in silenzio non si vedeva
import { Crash, erroreFs } from './comune.mjs';

const MUTA = new Set(['writeFile', 'rename', 'unlink', 'rm', 'mkdir', 'copyFile', 'cp', 'rmdir']);

export function normalizza(p) {
  const s = String(p ?? '').replace(/\\/g, '/');
  const assoluto = s.startsWith('/') || /^[a-zA-Z]:/.test(s);
  const parti = [];
  let fuori = false;
  for (const x of s.split('/')) {
    if (!x || x === '.') continue;
    if (x === '..') { if (parti.length) parti.pop(); else fuori = true; continue; }
    parti.push(x);
  }
  return { p: parti.join('/'), assoluto, fuori };
}

export function creaDisco(nome, { orologio, permesso = () => true } = {}) {
  const files = new Map();   // percorso → { dati: Buffer, mtime }
  const dirs = new Set(['vault', 'dati']);
  const violazioni = [];
  const scrittiDalMotore = new Map();   // percorso → ultimo contenuto scritto da un motore (per le prove sui «propri file»)
  const osservati = new Map();   // percorso → { dati, letto }: un file rovinato apposta; letto: il motore l'ha letto così
  let crash = null;   // { dopo, meta, frazione } armato da armaCrash
  const guasti = [];   // { prefisso, codice, quale: 'leggi' | 'scrivi' }
  const ascoltatori = [];   // cloud: chi vuole sapere quando un file del vault cambia

  const dirEsiste = p => p === '' || dirs.has(p) || [...files.keys()].some(f => f.startsWith(p + '/')) || [...dirs].some(d => d.startsWith(p + '/'));
  const cambiato = (p, chi) => { for (const f of ascoltatori) f(p, chi); };
  const buf = x => Buffer.isBuffer(x) ? Buffer.from(x) : x instanceof Uint8Array ? Buffer.from(x) : Buffer.from(String(x), 'utf8');
  const genitore = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';

  // ---- operazioni crude (cloud e simulatore: niente crash, niente controlli) ----
  const crudo = {
    leggi: p => files.get(p)?.dati ?? null,
    scrivi(p, dati, chi = 'cloud') { files.set(p, { dati: buf(dati), mtime: orologio() }); cambiato(p, chi); },
    togli(p, chi = 'cloud') { if (files.delete(p)) cambiato(p, chi); },
    esiste: p => files.has(p),
    elenco: (prefisso = '') => [...files.keys()].filter(f => !prefisso || f === prefisso || f.startsWith(prefisso + '/')).sort(),
    mtime: p => files.get(p)?.mtime,
  };

  function maniglia({ prima = async () => { }, nomeMotore = 'motore' } = {}) {
    const m = { morto: false };
    const controlla = (op, p, mutante) => {
      if (m.morto) throw new Crash(`${op} dopo la morte del processo`);
      const n = normalizza(p);
      if (mutante && (n.assoluto || n.fuori || !permesso(n.p))) violazioni.push({ op, percorso: String(p), motore: nomeMotore });
      if (n.assoluto || n.fuori) throw erroreFs('EACCES', op, p);   // fuori dal computer finto: non si può davvero
      const g = guasti.find(x => (x.quale === 'scrivi') === mutante && (n.p === x.prefisso || n.p.startsWith(x.prefisso + '/')));
      if (g) throw erroreFs(g.codice, op, p);
      return n.p;
    };
    // il kill: prima della k-esima operazione che cambia il disco (o a metà, se è una writeFile e meta è vero)
    const forseMuori = (op, p, scriviMeta) => {
      if (!crash) return;
      if (--crash.dopo > 0) return;
      const c = crash; crash = null; m.morto = true;
      if (op === 'writeFile' && c.meta && scriviMeta) scriviMeta(c.frazione);
      throw new Crash(`${op} ${p}`);
    };
    const core = {
      readFile(p, enc) {
        const q = controlla('readFile', p, false), f = files.get(q);
        if (!f) throw erroreFs(dirEsiste(q) ? 'EISDIR' : 'ENOENT', 'open', p);
        const oss = osservati.get(q); if (oss && f.dati.equals(oss.dati)) oss.letto = true;
        const o = typeof enc === 'object' ? enc?.encoding : enc;
        return o ? f.dati.toString(o) : Buffer.from(f.dati);
      },
      writeFile(p, dati) {
        const q = controlla('writeFile', p, true), b = buf(dati);
        if (dirEsiste(q) && !files.has(q)) throw erroreFs('EISDIR', 'open', p);
        if (!dirEsiste(genitore(q))) throw erroreFs('ENOENT', 'open', p);
        forseMuori('writeFile', q, fr => { files.set(q, { dati: b.subarray(0, Math.floor(b.length * fr)), mtime: orologio() }); cambiato(q, nomeMotore); });
        files.set(q, { dati: b, mtime: orologio() }); scrittiDalMotore.set(q, b); cambiato(q, nomeMotore);
      },
      rename(a, b) {
        const x = controlla('rename', a, true), y = controlla('rename', b, true);
        if (files.has(x)) {
          if (!dirEsiste(genitore(y))) throw erroreFs('ENOENT', 'rename', b);
          forseMuori('rename', x);
          const f = files.get(x); files.delete(x); files.set(y, f);
          if (scrittiDalMotore.has(x)) { scrittiDalMotore.set(y, scrittiDalMotore.get(x)); scrittiDalMotore.delete(x); }
          cambiato(x, nomeMotore); cambiato(y, nomeMotore); return;
        }
        if (!dirEsiste(x) || x === '') throw erroreFs('ENOENT', 'rename', a);
        forseMuori('rename', x);
        for (const [k, f] of [...files]) if (k.startsWith(x + '/')) { files.delete(k); const n = y + k.slice(x.length); files.set(n, f); cambiato(k, nomeMotore); cambiato(n, nomeMotore); }
        for (const d of [...dirs]) if (d === x || d.startsWith(x + '/')) { dirs.delete(d); dirs.add(y + d.slice(x.length)); }
      },
      unlink(p) {
        const q = controlla('unlink', p, true);
        if (!files.has(q)) throw erroreFs(dirEsiste(q) ? 'EPERM' : 'ENOENT', 'unlink', p);
        forseMuori('unlink', q);
        files.delete(q); cambiato(q, nomeMotore);
      },
      rm(p, o = {}) {
        const q = controlla('rm', p, true);
        if (files.has(q)) { forseMuori('rm', q); files.delete(q); cambiato(q, nomeMotore); return; }
        if (!dirEsiste(q) || q === '') { if (o.force) return; throw erroreFs('ENOENT', 'rm', p); }
        if (!o.recursive) throw erroreFs('EISDIR', 'rm', p);
        forseMuori('rm', q);
        for (const k of [...files.keys()]) if (k.startsWith(q + '/')) { files.delete(k); cambiato(k, nomeMotore); }
        for (const d of [...dirs]) if (d === q || d.startsWith(q + '/')) dirs.delete(d);
      },
      rmdir(p) { const q = controlla('rmdir', p, true); if ([...files.keys()].some(k => k.startsWith(q + '/'))) throw erroreFs('ENOTEMPTY', 'rmdir', p); dirs.delete(q); },
      readdir(p) {
        const q = controlla('readdir', p, false);
        if (files.has(q)) throw erroreFs('ENOTDIR', 'scandir', p);
        if (!dirEsiste(q)) throw erroreFs('ENOENT', 'scandir', p);
        const pre = q ? q + '/' : '', nomi = new Set();
        for (const k of [...files.keys(), ...dirs]) if (k.startsWith(pre) && k !== q) nomi.add(k.slice(pre.length).split('/')[0]);
        return [...nomi].sort();
      },
      stat(p) {
        const q = controlla('stat', p, false), f = files.get(q);
        if (f) return { size: f.dati.length, mtimeMs: f.mtime, mtime: new Date(f.mtime), isFile: () => true, isDirectory: () => false };
        if (dirEsiste(q)) return { size: 0, mtimeMs: 0, mtime: new Date(0), isFile: () => false, isDirectory: () => true };
        throw erroreFs('ENOENT', 'stat', p);
      },
      mkdir(p, o = {}) {
        const q = controlla('mkdir', p, true);
        if (files.has(q)) throw erroreFs('EEXIST', 'mkdir', p);
        if (dirEsiste(q)) { if (o.recursive) return; throw erroreFs('EEXIST', 'mkdir', p); }
        if (!o.recursive && !dirEsiste(genitore(q))) throw erroreFs('ENOENT', 'mkdir', p);
        let c = q; while (c) { dirs.add(c); c = genitore(c); }
      },
      copyFile(a, b) { const d = core.readFile(a); core.writeFile(b, d); },
      cp(a, b, o = {}) {
        const x = controlla('cp', a, false);
        if (files.has(x)) return core.copyFile(a, b);
        if (!o.recursive) throw erroreFs('EISDIR', 'cp', a);
        const y = normalizza(b).p;
        core.mkdir(y, { recursive: true });
        for (const k of [...files.keys()]) if (k.startsWith(x + '/')) { const n = y + k.slice(x.length); core.mkdir(genitore(n), { recursive: true }); core.writeFile(n, files.get(k).dati); }
      },
      exists(p) { const q = controlla('exists', p, false); return files.has(q) || dirEsiste(q); },
    };
    const conMuta = (nome, f) => (...a) => { if (MUTA.has(nome) && m.morto) throw new Crash(nome); return f(...a); };
    // asincrona: come node:fs/promises
    for (const nome of ['readFile', 'writeFile', 'rename', 'unlink', 'rm', 'rmdir', 'readdir', 'stat', 'mkdir', 'copyFile', 'cp']) {
      m[nome] = async (...a) => { if (m.morto) throw new Crash(nome); await prima(nome, a[0]); return conMuta(nome, core[nome])(...a); };
    }
    m.access = async p => { if (m.morto) throw new Crash('access'); await prima('access', p); if (!core.exists(p)) throw erroreFs('ENOENT', 'access', p); };
    // sincrona: solo per l'adattatore del v1 (scritto con node:fs sincrono)
    m.sync = {
      readFileSync: core.readFile, writeFileSync: core.writeFile, renameSync: core.rename, unlinkSync: core.unlink, rmSync: core.rm,
      rmdirSync: core.rmdir, readdirSync: core.readdir, statSync: core.stat, mkdirSync: core.mkdir, copyFileSync: core.copyFile,
      cpSync: core.cp, existsSync: p => { try { return core.exists(p); } catch (x) { if (x.crash) throw x; return false; } },
    };
    return m;
  }

  return {
    nome, files, dirs, violazioni, scrittiDalMotore, osservati, crudo, maniglia,
    armaCrash(dopo, { meta = false, frazione = 0.5 } = {}) { crash = { dopo: Math.max(1, dopo | 0), meta, frazione }; },
    disarma() { crash = null; },
    guasta(prefisso, codice = 'EIO', quale = 'leggi') { guasti.push({ prefisso: normalizza(prefisso).p, codice, quale }); },
    ripara() { guasti.length = 0; },
    guasti,
    armato: () => !!crash,
    ascolta(f) { ascoltatori.push(f); },
  };
}
