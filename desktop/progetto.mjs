/* «Segui il progetto»: cosa è cambiato davvero, e l'hai provato? (F2 di docs/PROGETTO-INFORMATICA.md)
   Node puro, senza import di electron: si prova anche fuori dall'app (test/progetto.mjs).
   Lode guarda una cartella scelta dallo studente e tiene le versioni dei file nella SUA cartella
   (userData/progetti/<id>/oggetti/<sha256>, tappe in tappe.json, eseguibili in bin/): nella cartella dello studente
   non scrive mai niente. Non sa chi scrive le righe (lo studente, un agente, un copia-incolla) e lo dice.

   CONTRATTO IPC (registra() li registra tutti; la barra manda solo l'id del progetto, mai percorsi o comandi da eseguire)
   OUT (barra → main, ipcRenderer.invoke). Ogni risposta può essere { errore: 'testo per lo studente' }.
     progetto:scegli   ()                        → { token, nome, percorso, file, gia } | { annullato: true }
                       apre il dialogo di sistema per la cartella (con LODE_PROGETTO niente dialogo). Il percorso resta nel main:
                       la barra riceve un token da ripassare a progetto:segui.
     progetto:segui    { token, corso, valutato } → stato del progetto (come un elemento di progetto:stato)
     progetto:smetti   { id }                    → { ok, nome }   chiude il watcher e toglie le copie di Lode
     progetto:stato    { id? }                   → { progetti: [stato…] }   (con id: solo quello)
     progetto:diff     { id, rel?, da?, a? }     → senza rel: { file: [{ rel, stato, piu, meno, grande }] }
                                                   con rel:   { rel, stato, piu, meno, grande, blocchi: [{ righe: [{ t: ' '|'+'|'-', s, na, nb }] }], tagliato }
                       da/a: il t di una tappa (riassunto.base, riassunto.fine); senza, da = ultima «vista», a = adesso
     progetto:righe    { id, rel, da, a }        → { rel, da, a, totale, righe: [{ n, s }], impronta }   (al massimo 400 righe)
     progetto:rileva   { id }                    → { tipo, testo, testoCasi, casi, programmi, manca, note, confermato, uguale }
     progetto:conferma { id, testo? }            → { ok, comando } | { annullato: true }
                       testo = il comando scritto con «Cambia». Il main mostra dialog.showMessageBox con l'argv esatto;
                       solo dopo il sì salva conf.progetti[id].prova (in userData/config.json, mai nel vault)
     progetto:prova    { id }                    → esito (come progetto:esito) | { serveConferma, cambiato?, proposta } | { inCorso }
     progetto:visto    { id }                    → stato   (tappa «vista»: «Cosa sta cambiando» riparte da qui)
   IN (main → barra, webContents.send)
     progetto:cambiato { id, nome, motivo, file, piu, meno, ultima, ultimaCodice, inizio, vista, impronta, vecchio, ultimaProva, quieteMs, manca, troppi, provaInCorso }
                       motivo: 'inizio' | 'modifica' | 'visto' | 'prova' | 'manca' | 'troppi'
     progetto:fatto    riassunto: { id, nome, da, a, base, fine, file, piu, meno, frase, punti, provatoTesto, provato, vecchio, codiceCambiato, nota, testo }
     progetto:uscita   { id, fase: 'compila'|'caso', caso?, flusso: 'stdout'|'stderr', testo }   (a pezzi, al massimo 64 KB per prova)
     progetto:esito    { id, nome, impronta, quando, esito: 'ok'|'prove'|'non-compila'|'errore', breve, compilazione: { codice, segnale, stderr, durata, avvisi },
                         casi: [{ nome, ok, riga, atteso, ottenuto, codice, segnale, crash, scaduto, troncato, stderr }], saltati, ok, tot, primo,
                         messaggio, cambiatoDurante, dopoRiuscita: [{ rel, intervalli: [[da, a]] }] | null, valutato }
   Variabili per le prove: LODE_PROGETTO (cartella senza dialogo), LODE_CONFERMA_AUTO=1 (solo con LODE_PROVA: niente finestra
   di conferma), LODE_QUIETE_MS (attesa del «Fatto», 60 s), LODE_FATTO_MS (al massimo un «Fatto» ogni…, 10 min). */
import { watch, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, realpathSync, statSync, unlinkSync } from 'node:fs';
import { readdir, stat, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { join, basename, resolve, relative, isAbsolute, parse } from 'node:path';
import { homedir } from 'node:os';
import { dentro, scriviSicuro } from './vault.mjs';
import * as E from './esegui.mjs';
import { t } from './lingua.mjs';

export const LIMITE_FILE = 5000, LIMITE_BYTE = 1024 * 1024, MAX_PROGETTI = 3, MAX_TAPPE = 300, GIORNI_TAPPE = 30, MAX_RIGHE = 400;
export const QUIETE_MS = 60e3, INTERVALLO_FATTO = 10 * 60e3, ATTESA_MS = 400, SONDAGGIO_MS = 3000, SICUREZZA_MS = 30e3;

/* =====================================================================================================================
   Funzioni pure: quali file contano, diff, funzioni cambiate, impronta, riassunto. Provate in test/progetto.mjs
   ===================================================================================================================== */

// cartelle e file che non si seguono: nascosti (.git, .vscode…), uscite di compilazione, ambienti, file degli editor
const CARTELLE_NO = new Set(['node_modules', 'build', 'dist', 'target', '__pycache__', 'venv', 'obj', 'cmake-build-debug', 'cmake-build-release']);
export const cartellaIgnorata = n => n.startsWith('.') || CARTELLE_NO.has(n.toLowerCase()) || /\.dSYM$/i.test(n);
export const fileIgnorato = n => n.startsWith('.') || /^a\.out$/i.test(n) || /\.(o|obj|exe|class|pyc|pyo|so|dylib|dll|a|lib|ilk|pdb|swp|swo|tmp|bak)$/i.test(n) || n.endsWith('~') || n === '4913' || /\.tmp-\d+/.test(n);
// un percorso che arriva dal watcher (non si sa se l'ultimo pezzo è una cartella o un file: si guardano entrambe le regole)
export function ignorato(rel) {
  const parti = String(rel).split(/[\\/]+/).filter(Boolean);
  return parti.some((p, i) => cartellaIgnorata(p) || (i === parti.length - 1 && fileIgnorato(p)));
}
// i file che contano per «Provato?»: il codice e i casi di prova. Un README cambiato non rende il codice «non provato»
export const eCaso = rel => /\.(in|out)$/i.test(rel) || /(^|\/)(input|output)[^/]*\.txt$/i.test(rel);
export const contaPerImpronta = rel => /\.(c|h|py|java)$/i.test(rel) || /(^|\/)(GNUmakefile|makefile|Makefile)$/.test(rel) || eCaso(rel);
// l'impronta del codice: sha256 della lista ordinata «percorso\0hash» dei soli file che contano. Esatta, anche dopo un annulla
export function impronta(mappa) {
  const righe = Object.keys(mappa).filter(contaPerImpronta).sort().map(r => r + '\0' + mappa[r]);
  return createHash('sha256').update(righe.join('\n')).digest('hex');
}
export const sha256 = buf => createHash('sha256').update(buf).digest('hex');
export const binario = buf => buf.subarray(0, 8192).includes(0);

// le righe di un testo: CRLF e spazi in fondo non contano, così su Windows un file non sembra cambiato per intero
export function righe(testo) {
  if (!testo) return [];
  const r = String(testo).replace(/^\uFEFF/, '').split('\n').map(x => x.replace(/[ \t\r]+$/, ''));
  if (r.at(-1) === '') r.pop();
  return r;
}

// Myers sulle righe: lo script di modifiche più corto. Prima si tolgono inizio e fine uguali (le modifiche sono quasi sempre
// in un punto solo). Oltre maxRighe per lato, o con più di maxD differenze, solo i conteggi.
function myers(A, B, maxD) {
  const N = A.length, M = B.length, MAX = N + M;
  if (!MAX) return [];
  const off = MAX + 1, V = new Int32Array(2 * MAX + 3), trace = [];
  let fine = -1;
  for (let d = 0; d <= MAX && fine < 0; d++) {
    if (d > maxD) return null;
    trace.push(V.slice(off - d - 1, off + d + 2));   // V prima del passo d, per k da -d-1 a d+1
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && V[off + k - 1] < V[off + k + 1]) ? V[off + k + 1] : V[off + k - 1] + 1, y = x - k;
      while (x < N && y < M && A[x] === B[y]) { x++; y++; }
      V[off + k] = x;
      if (x >= N && y >= M) { fine = d; break; }
    }
  }
  const ops = [];
  let x = N, y = M;
  for (let d = fine; d >= 0; d--) {
    const T = trace[d], v = k => T[k + d + 1], k = x - y;
    const pk = k === -d || (k !== d && v(k - 1) < v(k + 1)) ? k + 1 : k - 1, px = v(pk), py = px - pk;
    while (x > px && y > py) { ops.push([' ', A[x - 1]]); x--; y--; }
    if (d > 0) { if (x === px) { ops.push(['+', B[y - 1]]); y--; } else { ops.push(['-', A[x - 1]]); x--; } }
  }
  return ops.reverse();
}
function contiGrezzi(A, B) {
  const c = new Map(); for (const s of A) c.set(s, (c.get(s) || 0) + 1);
  let piu = 0, meno = 0;
  for (const s of B) { const n = c.get(s) || 0; if (n) c.set(s, n - 1); else piu++; }
  for (const n of c.values()) meno += n;
  return { piu, meno };
}
// diffRighe(a, b) → { ops: [{ t, s, na, nb }], piu, meno, grande }. na/nb: numero di riga (da 1) nel file di prima e di dopo
export function diffRighe(a, b, { maxD = 1500, maxRighe = 5000 } = {}) {
  let ini = 0; while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini++;
  let fa = a.length, fb = b.length; while (fa > ini && fb > ini && a[fa - 1] === b[fb - 1]) { fa--; fb--; }
  const A = a.slice(ini, fa), B = b.slice(ini, fb);
  const mezzo = a.length > maxRighe || b.length > maxRighe ? null : myers(A, B, maxD);
  if (!mezzo) return { ops: null, grande: true, ...contiGrezzi(A, B) };
  const ops = [];
  let na = 0, nb = 0;
  for (let i = 0; i < ini; i++) ops.push({ t: ' ', s: a[i], na: ++na, nb: ++nb });
  for (const [t, s] of mezzo) ops.push(t === ' ' ? { t, s, na: ++na, nb: ++nb } : t === '-' ? { t, s, na: ++na, nb: null } : { t, s, na: null, nb: ++nb });
  for (let i = fa; i < a.length; i++) ops.push({ t: ' ', s: a[i], na: ++na, nb: ++nb });
  let piu = 0, meno = 0; for (const o of ops) { if (o.t === '+') piu++; else if (o.t === '-') meno++; }
  return { ops, piu, meno, grande: false };
}
// i blocchi da mostrare: ogni gruppo di modifiche con 3 righe di contesto; blocchi vicini si uniscono
export function blocchi(ops, contesto = 3) {
  const idx = []; (ops || []).forEach((o, i) => { if (o.t !== ' ') idx.push(i); });
  if (!idx.length) return [];
  const out = []; let da = Math.max(0, idx[0] - contesto), a = Math.min(ops.length - 1, idx[0] + contesto);
  for (const i of idx.slice(1)) {
    if (i - contesto <= a + 1) a = Math.min(ops.length - 1, i + contesto);
    else { out.push(ops.slice(da, a + 1)); da = i - contesto; a = Math.min(ops.length - 1, i + contesto); }
  }
  out.push(ops.slice(da, a + 1));
  return out.map(r => ({ righe: r }));
}

// funzioni: regole prudenti. Meglio perdere una funzione che inventarla.
// C: la riga deve iniziare in colonna 0, con un tipo obbligatorio e un nome che non sia una parola chiave (la regola dei giudici)
const NON_NOMI = new Set(['if', 'while', 'for', 'switch', 'return', 'sizeof', 'else', 'do', 'case', 'catch', 'new', 'throw', 'synchronized']);
export const RE_FUNZIONE_C = /^(?:static\s+|inline\s+|const\s+|unsigned\s+|signed\s+|long\s+|short\s+)*(?:void|char|int|float|double|long|short|bool|size_t|struct\s+\w+|enum\s+\w+|[A-Z]\w*|\w+_t)[\s*]+(\w+)\s*\(([^;{}]*)\)\s*\{?\s*$/;
export const RE_FUNZIONE_PY = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/;
// Java: almeno un modificatore (public, static…), poi tipo e nome. I costruttori e i metodi senza modificatori si perdono
export const RE_FUNZIONE_JAVA = /^\s*(?:(?:public|private|protected|static|final|abstract|synchronized|native|default)\s+)+(?:<[\w\s,?.]+>\s+)?[\w.]+(?:<[\w\s,<>?.]*>)?(?:\[\])*\s+(\w+)\s*\(([^;{}]*)\)\s*(?:throws\s+[\w.,\s]+)?\{?\s*$/;
export const linguaggio = rel => /\.[ch]$/i.test(rel) ? 'c' : /\.py$/i.test(rel) ? 'python' : /\.java$/i.test(rel) ? 'java' : null;
export function firma(riga, lingua) {
  if (lingua === 'c') { const m = RE_FUNZIONE_C.exec(riga); return m && !NON_NOMI.has(m[1]) ? m[1] : null; }
  if (lingua === 'python') return RE_FUNZIONE_PY.exec(riga)?.[2] || null;
  if (lingua === 'java') { const m = RE_FUNZIONE_JAVA.exec(riga); return m && !NON_NOMI.has(m[1]) ? m[1] : null; }
  return null;
}
// una riga del diff («+int conta(Nodo *l) {»): si toglie il segno, poi la stessa regola
export const firmaDiff = (rigaDiff, lingua) => firma(/^[+\- ]/.test(rigaDiff) ? rigaDiff.slice(1) : rigaDiff, lingua);
const rientro = r => /^[ \t]*/.exec(r)[0].replace(/\t/g, '    ').length;
// per ogni riga del file, la funzione che la contiene (o null): la firma più vicina sopra, finché una } non la chiude
export function funzioniPerRiga(r, lingua) {
  const out = new Array(r.length).fill(null);
  if (lingua === 'python') {
    const pila = [];
    r.forEach((s, i) => {
      if (s.trim()) { const ind = rientro(s); while (pila.length && ind <= pila.at(-1).ind) pila.pop(); const m = RE_FUNZIONE_PY.exec(s); if (m) pila.push({ nome: m[2], ind }); }
      out[i] = pila.at(-1)?.nome ?? null;
    });
    return out;
  }
  let cur = null, ind = 0;
  r.forEach((s, i) => {
    const n = firma(s, lingua);
    if (n) { cur = n; ind = rientro(s); out[i] = n; return; }
    out[i] = cur;
    if (cur && /^\s*\}/.test(s) && rientro(s) <= ind) cur = null;   // la } che chiude appartiene ancora alla funzione
  });
  return out;
}
// quali funzioni sono nuove, cambiate o tolte. Una funzione è «cambiata» quando la firma più vicina sopra un blocco del diff è la sua.
// Le righe vuote e quelle con una graffa sola non contano: il diff le sposta da una funzione all'altra.
export function cambiamentiFunzioni(prima, dopo, ops, lingua) {
  const fa = funzioniPerRiga(prima, lingua), fb = funzioniPerRiga(dopo, lingua);
  const nomi = x => new Set(x.map(s => firma(s, lingua)).filter(Boolean)), nPrima = nomi(prima), nDopo = nomi(dopo);
  const nuove = [], cambiate = [], tolte = [], metti = (l, n) => { if (!l.includes(n)) l.push(n); };
  for (const o of ops || []) {
    if (o.t === ' ' || !o.s.trim() || /^\s*[{}]\s*;?\s*$/.test(o.s)) continue;
    const n = o.t === '+' ? fb[o.nb - 1] : fa[o.na - 1];
    if (!n) continue;
    if (o.t === '+' && !nPrima.has(n)) metti(nuove, n);
    else if (o.t === '-' && !nDopo.has(n)) metti(tolte, n);
    else metti(cambiate, n);
  }
  return { nuove, cambiate: cambiate.filter(n => !nuove.includes(n) && !tolte.includes(n)), tolte };
}
// i nuovi #include (C) e import (Python, Java), scritti come nel file
export function nuoviInclude(prima, ops, lingua) {
  const re = lingua === 'c' ? /^\s*#\s*include\s*([<"][^>"]+[>"])/ : lingua === 'python' ? /^(import\s+[\w., ]+|from\s+[\w.]+\s+import\s+[\w., *]+)\s*$/ : lingua === 'java' ? /^\s*(import\s+(?:static\s+)?[\w.*]+)\s*;/ : null;
  if (!re) return [];
  const testo = m => lingua === 'c' ? `#include ${m[1]}` : m[1].replace(/\s+/g, ' ').trim();
  const c = new Set(prima.map(s => re.exec(s)).filter(Boolean).map(testo)), out = [];
  for (const o of ops || []) if (o.t === '+') { const m = re.exec(o.s); if (m && !c.has(testo(m)) && !out.includes(testo(m))) out.push(testo(m)); }
  return out;
}

// il riassunto «Fatto. In parole semplici»: frasi fisse, conti esatti. Mai una stima su chi ha scritto cosa
const due = n => String(n).padStart(2, '0');
export const ora = t => { const d = new Date(t); return `${due(d.getHours())}:${due(d.getMinutes())}`; };
const codice = s => '`' + s + '`';
const unisci = l => l.length < 2 ? l.join('') : t('desktop.progetto-elenco', { primi: l.slice(0, -1).join(', '), ultimo: l.at(-1) });
const elenco = (l, altri = false, max = 4) => l.length <= max ? unisci(l.map(codice)) : t(altri ? 'desktop.progetto-elenco-altri' : 'desktop.progetto-elenco-altre', { primi: l.slice(0, max).map(codice).join(', '), n: l.length - max });
export function righePiuMeno(piu, meno) {
  if (piu && meno) return t('desktop.progetto-righe-piu-meno', { n: piu, meno });
  if (piu) return t('desktop.progetto-righe-piu', { n: piu });
  if (meno) return t('desktop.progetto-righe-meno', { n: meno });
  return t('desktop.progetto-solo-spazi');
}
export function fraseFile(f) {
  const pz = [], nuove = f.nuove || [], cambiate = f.cambiate || [], tolte = f.tolte || [], inc = f.include || [];
  if (f.stato === 'nuovo') pz.push(t('desktop.progetto-file-nuovo', { n: f.piu }));
  if (f.stato === 'tolto') pz.push(t('desktop.progetto-file-tolto'));
  if (f.stato !== 'tolto') {
    if (nuove.length) pz.push(t('desktop.progetto-funzioni-nuove', { n: nuove.length, elenco: elenco(nuove) }));
    if (cambiate.length) pz.push(t('desktop.progetto-funzioni-cambiate', { n: cambiate.length, elenco: elenco(cambiate) }));
    if (tolte.length) pz.push(t('desktop.progetto-funzioni-tolte', { n: tolte.length, elenco: elenco(tolte) }));
    if (f.stato === 'cambiato' && !nuove.length && !cambiate.length && !tolte.length) pz.push(righePiuMeno(f.piu, f.meno));
  }
  let s = t('desktop.progetto-file', { file: codice(f.rel), cosa: pz.join(', ') });
  if (inc.length && f.stato !== 'tolto') s += ' ' + t('desktop.progetto-include-nuovi', { n: inc.length, elenco: elenco(inc, true) });
  return s;
}
const TIPI = { c: ['compila', 'non-compila'], java: ['compila', 'non-compila'], python: ['sintassi-a-posto', 'errore-di-sintassi'], make: ['make-riuscito', 'make-non-riuscito'] };   // chiavi del catalogo: desktop.progetto-esito-…
// l'esito in breve, per la pillola e per «Provato?»: «✓ compila · 6/6», «✗ 2 prove su 6», «✗ non compila · lista.c:42»
export function esitoBreve(p) {
  if (!p) return '';
  const [si, no] = (TIPI[p.tipo] || TIPI.c).map(k => t('desktop.progetto-esito-' + k));
  if (p.esito === 'ok') return `✓ ${si}${p.tot ? ` · ${p.ok}/${p.tot}` : ''}`;
  if (p.esito === 'prove') { const k = p.tot - p.ok; return '✗ ' + t('desktop.progetto-prove-su', { n: k, tot: p.tot }); }
  if (p.esito === 'non-compila') return `✗ ${no}${p.primo?.file ? ` · ${p.primo.file.split(/[\\/]/).pop()}${p.primo.riga ? ':' + p.primo.riga : ''}` : ''}`;
  return '✗ ' + t('desktop.progetto-prova-non-partita');
}
export function fraseInizio({ da, a, n, piu, meno }) {
  return ora(da) === ora(a) ? t('desktop.progetto-inizio-alle', { ora: ora(a), n, piu, meno }) : t('desktop.progetto-inizio-dalle', { da: ora(da), a: ora(a), n, piu, meno });
}
export function fraseProvato({ impronta: imp, ultimaProva: up, ultima, codiceCambiato = true }) {
  if (up && up.impronta === imp) return { si: true, testo: t('desktop.progetto-provato-si', { ora: ora(up.quando), esito: esitoBreve(up) }) };
  if (!codiceCambiato) return { si: false, testo: t('desktop.progetto-provato-no-codice') };
  return { si: false, testo: t('desktop.progetto-provato-no', { ora: ora(ultima) }) };
}
// una funzione e non una costante: il main sceglie la lingua dopo aver caricato i moduli
export const notaChi = () => t('desktop.progetto-nota-chi');
// file: [{ rel, stato, piu, meno, nuove, cambiate, tolte, include }] in ordine di percorso
export function riassunto({ id = null, nome = '', da, a, file, impronta: imp, improntaBase = null, ultimaProva = null, base = null, fine = null }) {
  const piu = file.reduce((s, f) => s + f.piu, 0), meno = file.reduce((s, f) => s + f.meno, 0);
  const frase = fraseInizio({ da, a, n: file.length, piu, meno });
  const punti = file.slice(0, 8).map(fraseFile); if (file.length > 8) punti.push(t('desktop.progetto-altri-file', { n: file.length - 8 }));
  const codiceCambiato = improntaBase == null || improntaBase !== imp;
  const p = fraseProvato({ impronta: imp, ultimaProva, ultima: a, codiceCambiato });
  const nota = notaChi(), testo = [frase, ...punti.map(x => '– ' + x), p.testo, nota].join('\n');
  return { id, nome, da, a, base, fine, file, piu, meno, impronta: imp, frase, punti, provatoTesto: p.testo, provato: p.si, vecchio: !p.si, codiceCambiato, nota, testo };
}

/* =====================================================================================================================
   Il motore: guardare le cartelle, tenere le versioni, provare. crea({ dir, conf, salvaConf, manda })
   ===================================================================================================================== */
const ID = /^[0-9a-f]{12}$/;
const idDi = percorso => createHash('sha1').update(percorso).digest('hex').slice(0, 12);
const WIN = process.platform === 'win32';
const insensibile = WIN || process.platform === 'darwin';
const sotto = (figlio, padre) => {
  if (!figlio || !padre) return false;
  const [f, p] = insensibile ? [figlio.toLowerCase(), padre.toLowerCase()] : [figlio, padre];
  const r = relative(p, f); return r === '' || (!r.startsWith('..') && !isAbsolute(r));
};
const vero = p => { try { return realpathSync.native(resolve(p)); } catch { return resolve(p); } };

// tutti i file seguiti della cartella (i collegamenti simbolici no: potrebbero portare fuori dal progetto)
export async function elencaFile(radice, limite = LIMITE_FILE) {
  const out = [], pila = [''];
  while (pila.length) {
    const d = pila.pop();
    let voci;
    try { voci = await readdir(d ? join(radice, d) : radice, { withFileTypes: true }); } catch (e) { if (!d) throw e; continue; }
    for (const v of voci) {
      const rel = d ? d + '/' + v.name : v.name;
      if (v.isDirectory()) { if (!cartellaIgnorata(v.name)) pila.push(rel); continue; }
      if (!v.isFile() || fileIgnorato(v.name)) continue;
      let s; try { s = await stat(join(radice, rel)); } catch { continue; }
      out.push({ rel, size: s.size, mtimeMs: s.mtimeMs });
      if (out.length > limite) return { troppi: true, file: out };
    }
  }
  return { troppi: false, file: out };
}

export function crea({ dir, conf = {}, salvaConf = () => { }, manda = () => { }, vietate = () => ({}), quieteMs = QUIETE_MS, intervalloFatto = INTERVALLO_FATTO,
  attesaMs = ATTESA_MS, sondaggioMs = SONDAGGIO_MS, sicurezzaMs = SICUREZZA_MS, tempoCompila = E.TEMPO_COMPILA, tempoCaso = E.TEMPO_CASO, trova = E.TROVA }) {
  const C = typeof conf === 'function' ? conf : () => conf;
  const progetti = () => (C().progetti ||= {});
  const vivi = new Map();   // id → stato in memoria
  const tieni = t => { t?.unref?.(); return t; };

  /* ----- seguire ----- */
  async function controlla(percorso) {
    if (!percorso) return { errore: t('desktop.progetto-nessuna-cartella') };
    const p = vero(String(percorso));
    let s; try { s = statSync(p); } catch { return { errore: t('desktop.progetto-non-trovo-cartella') }; }
    if (!s.isDirectory()) return { errore: t('desktop.progetto-cartella-non-file') };
    const { vault, userData } = vietate() || {};
    if (parse(p).root === p) return { errore: t('desktop.progetto-radice-disco') };
    if (sotto(vero(homedir()), p)) return { errore: t('desktop.progetto-tutta-la-home') };
    if (vault && (sotto(p, vero(vault)) || sotto(vero(vault), p))) return { errore: t('desktop.progetto-e-il-vault') };
    if (userData && (sotto(p, vero(userData)) || sotto(vero(userData), p))) return { errore: t('desktop.progetto-dati-di-lode') };
    const id = idDi(p), gia = !!progetti()[id];
    if (!gia && Object.keys(progetti()).length >= MAX_PROGETTI) return { errore: t('desktop.progetto-troppi-progetti', { n: MAX_PROGETTI }) };
    let el; try { el = await elencaFile(p, LIMITE_FILE); } catch { return { errore: t('desktop.progetto-cartella-illeggibile') }; }
    if (el.troppi) return { errore: t('desktop.progetto-troppi-file', { n: LIMITE_FILE }) };
    return { id, percorso: p, nome: basename(p), file: el.file.length, gia };
  }
  async function segui(percorso, { corso, valutato } = {}) {
    const c = await controlla(percorso); if (c.errore) return c;
    const tutti = progetti();
    if (!tutti[c.id]) tutti[c.id] = { percorso: c.percorso, nome: c.nome, corso: corso || null, valutato: !!valutato, prova: null, ultimaProva: null, dal: Date.now() };
    else { if (corso !== undefined) tutti[c.id].corso = corso || null; if (valutato !== undefined) tutti[c.id].valutato = !!valutato; }
    salvaConf();
    const S = await avvia(c.id);
    return statoDi(S);
  }
  async function avvia(id) {
    if (vivi.has(id)) return vivi.get(id);
    const P = progetti()[id];
    const S = { id, radice: P.percorso, nome: P.nome, cartella: join(dir, id), corrente: new Map(), tappe: [], ultima: 0, ultimaCodice: 0, inizioModifiche: null,
      ultimoFatto: 0, riassunto: null, elenco: [], piu: 0, meno: 0, noti: new Set(), cache: new Map(), chiuso: false, manca: false, troppi: false };
    vivi.set(id, S);
    mkdirSync(join(S.cartella, 'oggetti'), { recursive: true }); mkdirSync(join(S.cartella, 'bin'), { recursive: true });
    carica(S);
    try { for (const n of readdirSync(join(S.cartella, 'oggetti'))) if (/^[0-9a-f]{64}$/.test(n)) S.noti.add(n); } catch { }
    const nuovo = !S.tappe.length;
    if (!existsSync(S.radice)) { S.manca = true; sonda(S); return S; }
    await scansiona(S, { ripresa: !nuovo, silenzioso: nuovo });
    if (S.chiuso) return S;   // «smetti di seguire» mentre partiva: niente tappe, niente file
    if (nuovo) nuovaTappa(S, 'inizio');
    else if (S.inizioModifiche != null) programmaFatto(S);   // modifiche rimaste senza «Fatto» quando Lode si è chiusa
    await aggiornaElenco(S);
    if (S.chiuso) return S;
    manda('progetto:cambiato', pacchetto(S, 'inizio'));
    guarda(S);
    scansiona(S);   // quello che è cambiato mentre il watcher partiva
    raccogli(S);
    return S;
  }
  const riprendi = () => Promise.all(Object.keys(progetti()).filter(id => ID.test(id)).map(id => avvia(id).catch(e => console.error('Lode: non riesco a seguire', id, e))));

  /* ----- guardare ----- */
  function guarda(S) {
    if (S.chiuso || S.watcher) return;
    try {
      S.watcher = watch(S.radice, { recursive: true, ignore: rel => ignorato(String(rel)) }, (_, nome) => { if (nome && ignorato(String(nome))) return; attendi(S); });
      S.watcher.on('error', () => { chiudiWatcher(S); sonda(S); attendi(S); });
    } catch { sonda(S); }   // Linux senza ricorsione, OneDrive, cartelle di rete: si guarda ogni 3 s
    // ogni tanto si ricontrolla lo stesso: in OneDrive e Dropbox gli eventi a volte si perdono
    if (!S.sicurezza) S.sicurezza = tieni(setInterval(() => { if (!S.scansione) scansiona(S); }, sicurezzaMs));
  }
  const attendi = S => { clearTimeout(S.tAttesa); S.tAttesa = tieni(setTimeout(() => scansiona(S), attesaMs)); };
  function sonda(S) { if (!S.sonda && !S.chiuso) S.sonda = tieni(setInterval(() => { if (!S.scansione) scansiona(S); }, sondaggioMs)); }
  function chiudiWatcher(S) { try { S.watcher?.close(); } catch { } S.watcher = null; }

  function scansiona(S, opz = {}) {
    if (S.chiuso) return Promise.resolve();
    if (S.scansione) { S.ancora = true; return S.scansione; }
    S.scansione = (async () => {
      try { let primo = true; do { S.ancora = false; await scansionaUnaVolta(S, primo ? opz : {}); primo = false; } while (S.ancora && !S.chiuso); }
      catch (e) { console.error('Lode: scansione del progetto', e); }
      finally { S.scansione = null; }
    })();
    return S.scansione;
  }
  async function scansionaUnaVolta(S, { ripresa = false, silenzioso = false } = {}) {
    let el;
    try { el = await elencaFile(S.radice, LIMITE_FILE); }
    catch {   // la cartella non c'è più (rinominata, disco staccato): si aspetta che torni
      if (!S.manca) { S.manca = true; chiudiWatcher(S); sonda(S); manda('progetto:cambiato', pacchetto(S, 'manca')); }
      return;
    }
    if (S.manca) { S.manca = false; if (!S.watcher) { clearInterval(S.sonda); S.sonda = null; guarda(S); } }
    if (el.troppi) { if (!S.troppi) { S.troppi = true; manda('progetto:cambiato', pacchetto(S, 'troppi')); } return; }
    S.troppi = false;
    const adesso = Date.now(), nuova = new Map();
    for (const f of el.file) {
      if (f.size > LIMITE_BYTE) continue;
      const v = S.corrente.get(f.rel);
      // stesso mtime e stessa misura: lo stesso file. Quelli toccati negli ultimi 2 s si rileggono comunque (orologi grossolani)
      if (v && v.m === f.mtimeMs && v.s === f.size && adesso - f.mtimeMs > 2000) { nuova.set(f.rel, v); continue; }
      let buf; try { buf = await readFile(join(S.radice, f.rel)); } catch { if (v) nuova.set(f.rel, v); continue; }   // bloccato da un editor: resta com'era
      if (buf.length > LIMITE_BYTE || binario(buf)) continue;
      const h = sha256(buf);
      try { await salvaOggetto(S, h, buf); }
      catch (e) { console.error('Lode: non salvo la copia di', f.rel, e?.code || e); if (v) nuova.set(f.rel, v); attendi(S); continue; }   // si riprova al giro dopo
      nuova.set(f.rel, { h, m: f.mtimeMs, s: f.size });
    }
    if (S.chiuso) return;   // «smetti di seguire» durante la lettura: niente eventi né tappe
    let cambiato = false, codiceCambiato = false, tMax = 0;
    for (const [rel, v] of nuova) { const p = S.corrente.get(rel); if (!p || p.h !== v.h) { cambiato = true; codiceCambiato ||= contaPerImpronta(rel); tMax = Math.max(tMax, v.m); } }
    for (const rel of S.corrente.keys()) if (!nuova.has(rel)) { cambiato = true; codiceCambiato ||= contaPerImpronta(rel); tMax = adesso; }
    S.corrente = nuova;
    if (silenzioso || !cambiato) { if (silenzioso) salvaDopo(S); return; }
    const quando = ripresa ? Math.min(adesso, Math.round(tMax) || adesso) : adesso;   // cambiato a Lode chiusa: conta l'ora del file
    S.ultima = quando; if (codiceCambiato) S.ultimaCodice = quando;
    S.inizioModifiche ??= quando;
    await aggiornaElenco(S);
    manda('progetto:cambiato', pacchetto(S, 'modifica'));
    programmaFatto(S);
    salvaDopo(S);
  }

  /* ----- copie, tappe e diff ----- */
  async function salvaOggetto(S, h, buf) {
    if (S.noti.has(h)) return;
    const f = join(S.cartella, 'oggetti', h), t = f + '.tmp-' + randomBytes(3).toString('hex');
    if (!existsSync(f)) try { await writeFile(t, buf); await rinomina(t, f); } catch (e) { try { unlinkSync(t); } catch { } if (!existsSync(f)) throw e; }
    S.noti.add(h);
  }
  // su Windows l'antivirus o l'indicizzatore aprono il file appena scritto: la rinomina si riprova per circa 1 s (come scriviSicuro)
  async function rinomina(da, a) {
    for (let i = 0; ; i++) {
      try { return await rename(da, a); }
      catch (e) { if (!WIN || i >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(e?.code)) throw e; await new Promise(r => setTimeout(r, 30 * 2 ** i)); }
    }
  }
  async function leggiOggetto(S, h) { try { return await readFile(join(S.cartella, 'oggetti', h), 'utf8'); } catch { return ''; } }
  const mappa = S => Object.fromEntries([...S.corrente].map(([r, v]) => [r, v.h]));
  const improntaDi = S => impronta(mappa(S));
  const tappaBase = (S, tipi) => S.tappe.findLast(t => tipi.includes(t.tipo)) || null;
  async function diffTesti(S, ha, hb) {
    const k = `${ha || ''}|${hb || ''}`;
    if (S.cache.has(k)) { const d = S.cache.get(k); S.cache.delete(k); S.cache.set(k, d); return d; }
    const a = ha ? righe(await leggiOggetto(S, ha)) : [], b = hb ? righe(await leggiOggetto(S, hb)) : [];
    const d = { ...diffRighe(a, b), a, b };
    S.cache.set(k, d); if (S.cache.size > 40) S.cache.delete(S.cache.keys().next().value);
    return d;
  }
  async function confrontaMappe(S, prima, dopo) {
    const out = [];
    for (const rel of [...new Set([...Object.keys(prima), ...Object.keys(dopo)])].sort()) {
      const ha = prima[rel], hb = dopo[rel]; if (ha === hb) continue;
      const d = await diffTesti(S, ha, hb);
      out.push({ rel, stato: !ha ? 'nuovo' : !hb ? 'tolto' : 'cambiato', piu: d.piu, meno: d.meno, grande: d.grande });
    }
    return out;
  }
  async function aggiornaElenco(S) {
    S.elenco = await confrontaMappe(S, tappaBase(S, ['inizio', 'vista'])?.file || {}, mappa(S));
    S.piu = S.elenco.reduce((s, f) => s + f.piu, 0); S.meno = S.elenco.reduce((s, f) => s + f.meno, 0);
  }
  function nuovaTappa(S, tipo, extra = {}) {
    const t = { tipo, t: Math.max(Date.now(), (S.tappe.at(-1)?.t || 0) + 1), file: mappa(S), impronta: improntaDi(S), ...extra };
    S.tappe.push(t);
    // al massimo 300 tappe o 30 giorni; restano sempre le basi (vista, ultimo fatto, ultima prova, ultima prova riuscita)
    const limite = Date.now() - GIORNI_TAPPE * 864e5;
    const basi = new Set([tappaBase(S, ['inizio', 'vista']), tappaBase(S, ['inizio', 'vista', 'fatto']), tappaBase(S, ['prova']), S.tappe.findLast(x => x.tipo === 'prova' && x.riuscita)]);
    S.tappe = S.tappe.filter((x, i) => basi.has(x) || (x.t >= limite && i >= S.tappe.length - MAX_TAPPE));
    salvaDopo(S); raccogli(S);
    return t;
  }
  // le copie che nessuna tappa usa più se ne vanno. Mai durante una scansione (sta scrivendo copie nuove)
  function raccogli(S) {
    clearTimeout(S.tRaccogli);
    S.tRaccogli = tieni(setTimeout(() => {
      if (S.chiuso) return; if (S.scansione) return raccogli(S);
      const usati = new Set([...S.corrente.values()].map(v => v.h));
      for (const t of S.tappe) for (const h of Object.values(t.file)) usati.add(h);
      for (const h of [...S.noti]) if (!usati.has(h)) { try { unlinkSync(join(S.cartella, 'oggetti', h)); } catch { } S.noti.delete(h); }
    }, 2000));
  }
  function salvaOra(S) {
    clearTimeout(S.tSalva);
    if (S.chiuso && !S.salvaChiudendo) return;   // dopo «smetti» la cartella di Lode è stata tolta: non si ricrea
    const dati = { v: 1, nome: S.nome, tappe: S.tappe, corrente: Object.fromEntries([...S.corrente].map(([r, v]) => [r, [v.h, v.m, v.s]])),
      ultima: S.ultima, ultimaCodice: S.ultimaCodice, inizioModifiche: S.inizioModifiche, ultimoFatto: S.ultimoFatto, riassunto: S.riassunto };
    try { scriviSicuro(join(S.cartella, 'tappe.json'), JSON.stringify(dati)); } catch (e) { console.error('Lode: non salvo le tappe', e); }
  }
  const salvaDopo = S => { if (S.chiuso) return; clearTimeout(S.tSalva); S.tSalva = tieni(setTimeout(() => salvaOra(S), 800)); };
  function carica(S) {
    let d; try { d = JSON.parse(readFileSync(join(S.cartella, 'tappe.json'), 'utf8')); } catch { return; }
    if (!d || d.v !== 1 || !Array.isArray(d.tappe)) return;
    S.tappe = d.tappe.filter(t => t && typeof t.t === 'number' && t.file && typeof t.file === 'object');
    for (const [r, v] of Object.entries(d.corrente || {})) if (Array.isArray(v) && /^[0-9a-f]{64}$/.test(v[0])) S.corrente.set(r, { h: v[0], m: v[1], s: v[2] });
    Object.assign(S, { ultima: d.ultima || 0, ultimaCodice: d.ultimaCodice || 0, inizioModifiche: d.inizioModifiche ?? null, ultimoFatto: d.ultimoFatto || 0, riassunto: d.riassunto || null });
  }

  /* ----- «Fatto»: dopo il silenzio, al massimo uno ogni 10 minuti ----- */
  function programmaFatto(S, ms = quieteMs) { clearTimeout(S.tFatto); S.tFatto = tieni(setTimeout(() => fatto(S), ms)); }
  async function fatto(S) {
    if (S.chiuso) return;
    if (S.scansione) { await S.scansione; if (Date.now() - S.ultima < quieteMs) return programmaFatto(S, quieteMs - (Date.now() - S.ultima)); }
    const base = tappaBase(S, ['inizio', 'vista', 'fatto']), adesso = mappa(S);
    if (!base || stessa(base.file, adesso)) { S.inizioModifiche = null; salvaDopo(S); return; }   // tutto annullato: niente da dire
    const manca = (S.ultimoFatto || 0) + intervalloFatto - Date.now();
    if (manca > 0) return programmaFatto(S, manca);
    const fine = nuovaTappa(S, 'fatto');
    const r = await creaRiassunto(S, base, fine);
    S.ultimoFatto = fine.t; S.riassunto = r; S.inizioModifiche = null;
    salvaDopo(S);
    manda('progetto:fatto', r);
  }
  const stessa = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]); };
  async function creaRiassunto(S, base, fine) {
    const file = [];
    for (const rel of [...new Set([...Object.keys(base.file), ...Object.keys(fine.file)])].sort()) {
      const ha = base.file[rel], hb = fine.file[rel]; if (ha === hb) continue;
      const d = await diffTesti(S, ha, hb), lingua = linguaggio(rel);
      const f = { rel, stato: !ha ? 'nuovo' : !hb ? 'tolto' : 'cambiato', piu: d.piu, meno: d.meno, nuove: [], cambiate: [], tolte: [], include: [] };
      if (lingua && !d.grande) Object.assign(f, cambiamentiFunzioni(d.a, d.b, d.ops, lingua), { include: nuoviInclude(d.a, d.ops, lingua) });
      file.push(f);
    }
    return riassunto({ id: S.id, nome: S.nome, da: S.inizioModifiche || S.ultima || fine.t, a: S.ultima || fine.t, file, impronta: fine.impronta, improntaBase: base.impronta,
      ultimaProva: progetti()[S.id]?.ultimaProva || null, base: base.t, fine: fine.t });
  }

  /* ----- quello che la barra vede ----- */
  function pacchetto(S, motivo) {
    const P = progetti()[S.id] || {}, imp = improntaDi(S), up = P.ultimaProva || null;
    return { id: S.id, nome: S.nome, motivo, file: S.elenco.slice(0, 200), nFile: S.elenco.length, piu: S.piu, meno: S.meno, ultima: S.ultima || null, ultimaCodice: S.ultimaCodice || null, inizio: S.inizioModifiche,
      vista: tappaBase(S, ['inizio', 'vista'])?.t || null, impronta: imp, vecchio: !up || up.impronta !== imp, ultimaProva: up, quieteMs, manca: S.manca, troppi: S.troppi, provaInCorso: !!S.provaInCorso };
  }
  function statoDi(S) {
    const P = progetti()[S.id] || {};
    return { ...pacchetto(S, 'stato'), corso: P.corso || null, valutato: !!P.valutato, comando: P.prova ? { testo: P.prova.testo, manuale: !!P.prova.manuale, tipo: P.prova.tipo } : null, riassunto: S.riassunto };
  }
  const vivo = id => ID.test(String(id)) && progetti()[id] ? vivi.get(id) || null : null;
  const nonSeguo = () => ({ errore: t('desktop.progetto-non-seguo') });
  async function stato(id) {
    if (id != null) { const S = vivo(id); return S ? { progetti: [statoDi(S)] } : nonSeguo(); }
    return { progetti: [...vivi.values()].filter(S => progetti()[S.id]).map(statoDi) };
  }
  async function visto(id) {
    const S = vivo(id); if (!S) return nonSeguo();
    if (S.scansione) await S.scansione;
    nuovaTappa(S, 'vista'); S.inizioModifiche = null; clearTimeout(S.tFatto);
    await aggiornaElenco(S);
    manda('progetto:cambiato', pacchetto(S, 'visto'));
    return statoDi(S);
  }
  async function diff(id, { rel, da, a } = {}) {
    const S = vivo(id); if (!S) return nonSeguo();
    if (S.scansione) await S.scansione;
    const tappa = t => S.tappe.find(x => x.t === Number(t))?.file;
    const mA = da != null ? tappa(da) : tappaBase(S, ['inizio', 'vista'])?.file || {}, mB = a != null ? tappa(a) : mappa(S);
    if (!mA || !mB) return { errore: t('desktop.progetto-versione-scaduta') };
    if (rel == null) return { file: await confrontaMappe(S, mA, mB) };
    rel = String(rel);
    if (!(rel in mA) && !(rel in mB)) return { errore: t('desktop.progetto-file-non-seguito') };
    const d = await diffTesti(S, mA[rel], mB[rel]), st = !mA[rel] ? 'nuovo' : !mB[rel] ? 'tolto' : 'cambiato';
    if (d.grande) return { rel, stato: st, piu: d.piu, meno: d.meno, grande: true, blocchi: [] };
    const out = []; let n = 0, tagliato = false;
    for (const b of blocchi(d.ops, 3)) { if (n > 3000) { tagliato = true; break; } n += b.righe.length; out.push({ righe: b.righe.map(r => ({ t: r.t, s: r.s.length > 400 ? r.s.slice(0, 400) + '…' : r.s, na: r.na, nb: r.nb })) }); }
    return { rel, stato: st, piu: d.piu, meno: d.meno, grande: false, blocchi: out, tagliato };
  }
  // le righe vere di un file seguito (per gli errori spiegati di F3): al massimo 400, solo dentro il progetto
  async function leggiRighe(id, rel, da = 1, a) {
    const S = vivo(id); if (!S) return nonSeguo();
    rel = String(rel || '').split('\\').join('/');
    if (!S.corrente.has(rel)) return { errore: t('desktop.progetto-file-non-seguito') };
    let testo; try { testo = readFileSync(dentro(S.radice, rel), 'utf8'); } catch { return { errore: t('desktop.progetto-file-illeggibile') }; }
    const tutte = testo.replace(/^\uFEFF/, '').split('\n').map(r => r.replace(/\r$/, '')); if (tutte.at(-1) === '' && tutte.length > 1) tutte.pop();
    const intero = (x, d) => Number.isFinite(+x) ? Math.trunc(+x) : d;
    const inizio = Math.min(Math.max(1, intero(da, 1)), tutte.length), fine = Math.min(tutte.length, Math.max(inizio, intero(a, inizio + MAX_RIGHE - 1)), inizio + MAX_RIGHE - 1);
    return { rel, da: inizio, a: fine, totale: tutte.length, righe: tutte.slice(inizio - 1, fine).map((s, i) => ({ n: inizio + i, s: s.length > 500 ? s.slice(0, 500) + '…' : s })), impronta: improntaDi(S) };
  }

  /* ----- provare ----- */
  const leggiTesto = S => rel => { try { return readFileSync(dentro(S.radice, rel), 'utf8'); } catch { return ''; } };
  const piano = S => E.proponi({ nome: S.nome, file: [...S.corrente.keys()].sort(), leggi: leggiTesto(S), bin: join(S.cartella, 'bin'), trova });
  async function rileva(id) {
    const S = vivo(id); if (!S) return nonSeguo();
    if (S.scansione) await S.scansione;
    const p = await piano(S), P = progetti()[id];
    return { tipo: p.tipo, testo: p.testo, testoCasi: p.testoCasi, casi: p.casi.length, programmi: p.programmi.map(x => x.nome), manca: p.manca, note: p.note,
      confermato: P.prova?.testo || null, uguale: !!P.prova && (P.prova.manuale || P.prova.chiave === p.chiave) && !lanciaDiPiu(P.prova, p) };
  }
  // la conferma copre solo i programmi che si lanciavano quando lo studente ha detto sì. Se prima si compilava soltanto
  // (nessuna prova .in/.out) e adesso c'è da lanciare un programma, si chiede di nuovo: è un comando che la finestra non ha mostrato
  const lanciaDiPiu = (prova, p) => { const ok = new Set(prova.lancia || []); return E.lanciati(E.assegna(p.casi, prova.programmi || [])).some(n => !ok.has(n)); };
  // la conferma ha due tempi: preparaConferma costruisce l'argv (nel main), il main lo mostra nella finestra di sistema,
  // confermaPiano lo salva solo dopo il sì. Il piano non passa mai dalla barra.
  async function preparaConferma(id, testo) {
    const S = vivo(id); if (!S) return nonSeguo();
    if (S.scansione) await S.scansione;
    const p = await piano(S), bin = join(S.cartella, 'bin');
    if (testo == null || !String(testo).trim()) {
      if (p.manca) return { errore: p.manca.come, manca: p.manca };
      return { ...p, nome: S.nome, manuale: false, dettaglio: dettaglio(p) };
    }
    let argv; try { argv = E.daTesto(testo, { bin, strumento: p.strumento, cartelle: p.cartelle }); } catch (e) { return { errore: e.message }; }
    const q = { ...p, passi: [{ ruolo: 'compila', argv }], manuale: true, nome: S.nome, testo: E.mostraArgv(argv, { bin }), manca: null };
    return { ...q, dettaglio: dettaglio(q) };
  }
  const dettaglio = p => [p.passi.map(x => E.argvEsatto(x.argv)).join('\n'),
    p.casi.some(k => k.programma) ? t('desktop.progetto-poi-per-ogni-prova', { comandi: p.programmi.map(x => E.argvEsatto(x.argv) + ' < prova.in').join('\n') }) : t('desktop.progetto-senza-prove')].join('\n\n');
  function confermaPiano(id, p) {
    const P = progetti()[id]; if (!P || !vivi.has(id)) return nonSeguo();
    P.prova = { tipo: p.tipo, passi: p.passi, programmi: p.programmi, cartelle: p.cartelle, chiave: p.chiave, lancia: E.lanciati(E.assegna(p.casi, p.programmi)), manuale: !!p.manuale, testo: p.testo, confermato: new Date().toISOString() };
    salvaConf();
    return { ok: true, comando: p.testo };
  }
  // l'uscita arriva alla barra a pezzi, ogni 120 ms e al massimo 64 KB per prova
  function flusso(id) {
    let coda = [], mandati = 0, t = 0;
    const via = () => { t = 0; for (const x of coda) manda('progetto:uscita', x); coda = []; };
    return {
      pezzo: x => {
        if (mandati >= 64 * 1024) return;
        const testo = x.testo.slice(0, 64 * 1024 - mandati); mandati += testo.length;
        const u = coda.at(-1);
        if (u && u.fase === x.fase && u.caso === x.caso && u.flusso === x.flusso) u.testo += testo; else coda.push({ id, ...x, testo });
        if (mandati >= 64 * 1024) coda.push({ id, fase: x.fase, caso: x.caso, flusso: 'stderr', testo: '\n… ' + t('desktop.progetto-resto-non-mostro') + '\n' });
        if (!t) t = setTimeout(via, 120);
      },
      fine: () => { clearTimeout(t); via(); },
    };
  }
  // le righe cambiate dopo l'ultima prova riuscita: «guarda prima qui» (per gli errori a run-time di F3)
  async function dopoRiuscita(S) {
    const r = S.tappe.findLast(x => x.tipo === 'prova' && x.riuscita); if (!r) return null;
    const adesso = mappa(S), out = [];
    for (const rel of Object.keys(adesso).filter(contaPerImpronta).sort()) {
      if (r.file[rel] === adesso[rel] || eCaso(rel)) continue;
      const d = await diffTesti(S, r.file[rel], adesso[rel]); if (d.grande) { out.push({ rel, intervalli: [] }); continue; }
      const iv = []; for (const o of d.ops) if (o.t === '+') { const u = iv.at(-1); if (u && o.nb === u[1] + 1) u[1] = o.nb; else iv.push([o.nb, o.nb]); }
      if (iv.length) out.push({ rel, intervalli: iv });
    }
    return out;
  }
  async function prova(id) {
    const S = vivo(id), P = progetti()[id]; if (!S) return nonSeguo();
    if (S.provaInCorso) return { inCorso: true };
    if (!P.prova) return { serveConferma: true, proposta: await rileva(id) };
    S.provaInCorso = true;
    try {
      await scansiona(S);
      const p = await piano(S);
      // il comando confermato è ancora quello che Lode proporrebbe? (un .c in più, un main nuovo): allora si richiede
      if (!P.prova.manuale && p.chiave !== P.prova.chiave) return { serveConferma: true, cambiato: true, proposta: await rileva(id) };
      // ci sono prove da lanciare con un programma che la conferma non copriva (prima: «compilo soltanto»)
      if (lanciaDiPiu(P.prova, p)) return { serveConferma: true, cambiato: true, lancia: true, proposta: await rileva(id) };
      const file0 = mappa(S), imp0 = impronta(file0), quando = Date.now();
      manda('progetto:cambiato', pacchetto(S, 'prova'));
      const f = flusso(id);
      const r = await E.eseguiProva({ radice: S.radice, passi: P.prova.passi, programmi: P.prova.programmi, casi: E.assegna(p.casi, P.prova.programmi), cartelle: P.prova.cartelle,
        leggi: rel => readFileSync(dentro(S.radice, rel)), pezzo: f.pezzo, tempoCompila, tempoCaso });
      f.fine();
      if (S.chiuso) return { errore: t('desktop.progetto-smesso-durante-prova') };
      await scansiona(S);
      const up = { impronta: imp0, esito: r.esito, quando, ok: r.ok, tot: r.tot, primo: r.primo, tipo: P.prova.tipo };
      up.breve = esitoBreve(up);
      P.ultimaProva = up; salvaConf();
      nuovaTappa(S, 'prova', { file: file0, impronta: imp0, esito: r.esito, riuscita: r.esito === 'ok' });
      const esito = { id, nome: S.nome, tipo: P.prova.tipo, impronta: imp0, quando, breve: up.breve, ...r, cambiatoDurante: improntaDi(S) !== imp0, valutato: !!P.valutato, comando: P.prova.testo,
        dopoRiuscita: r.esito === 'ok' ? null : await dopoRiuscita(S) };
      manda('progetto:esito', esito);
      return esito;
    } finally { S.provaInCorso = false; if (!S.chiuso) manda('progetto:cambiato', pacchetto(S, 'prova')); }
  }

  /* ----- smettere e chiudere ----- */
  function chiudiUno(S, salva = true) {
    S.chiuso = true; chiudiWatcher(S);
    for (const t of [S.sonda, S.sicurezza]) clearInterval(t);
    for (const t of [S.tAttesa, S.tFatto, S.tRaccogli]) clearTimeout(t);
    if (salva) { S.salvaChiudendo = true; salvaOra(S); S.salvaChiudendo = false; } else clearTimeout(S.tSalva);
  }
  function smetti(id) {
    if (!ID.test(String(id)) || !progetti()[id]) return nonSeguo();
    const S = vivi.get(id); if (S) chiudiUno(S, false);
    vivi.delete(id);
    const nome = progetti()[id].nome; delete progetti()[id]; salvaConf();
    try { rmSync(join(dir, id), { recursive: true, force: true }); } catch { }   // solo le copie di Lode: la cartella dello studente non si tocca
    return { ok: true, nome };
  }
  function chiudi() { for (const S of vivi.values()) chiudiUno(S, true); vivi.clear(); E.fermaTutto(); }

  return { controlla, segui, smetti, stato, diff, righe: leggiRighe, rileva, preparaConferma, confermaPiano, prova, visto, chiudi, riprendi, scansiona: id => vivi.get(id) && scansiona(vivi.get(id)) };
}

/* =====================================================================================================================
   registra: gli handler IPC «progetto:*». Il main chiama solo questa, dentro whenReady, dopo leggiConf().
   conf può essere l'oggetto o una funzione che lo restituisce (in main.mjs conf viene riassegnato: meglio () => conf).
   ===================================================================================================================== */
export function registra({ ipcMain, dialog, app, conf, salvaConf, manda, env = process.env }) {
  const C = typeof conf === 'function' ? conf : () => conf;
  const M = crea({ dir: join(app.getPath('userData'), 'progetti'), conf: C, salvaConf, manda,
    vietate: () => ({ vault: C().vault, userData: app.getPath('userData') }),
    quieteMs: +env.LODE_QUIETE_MS > 0 ? +env.LODE_QUIETE_MS : QUIETE_MS, intervalloFatto: +env.LODE_FATTO_MS > 0 ? +env.LODE_FATTO_MS : INTERVALLO_FATTO });
  const scelte = new Map();   // token → percorso: la barra non manda mai un percorso
  const automatica = env.LODE_CONFERMA_AUTO === '1' && !!env.LODE_PROVA;   // solo nelle prove automatiche
  const gestisci = (canale, f) => ipcMain.handle(canale, async (_, x) => {
    try { return await f(x && typeof x === 'object' ? x : {}); } catch (e) { console.error(`Lode ${canale}:`, e); return { errore: e?.message || String(e) }; }
  });
  gestisci('progetto:scegli', async () => {
    let percorso = env.LODE_PROGETTO || null;
    if (!percorso) {
      const r = await dialog.showOpenDialog({ title: t('desktop.progetto-scegli-cartella'), buttonLabel: t('desktop.progetto-segui-cartella'), properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths?.[0]) return { annullato: true };
      percorso = r.filePaths[0];
    }
    const c = await M.controlla(percorso); if (c.errore) return c;
    const token = randomBytes(12).toString('hex'); scelte.set(token, c.percorso);
    setTimeout(() => scelte.delete(token), 30 * 60e3).unref?.();
    return { token, nome: c.nome, percorso: c.percorso, file: c.file, gia: c.gia };
  });
  gestisci('progetto:segui', ({ token, corso, valutato }) => {
    const p = scelte.get(String(token)); if (!p) return { errore: t('desktop.progetto-scegli-di-nuovo') };
    scelte.delete(String(token));
    return M.segui(p, { corso: typeof corso === 'string' ? corso.slice(0, 120) : null, valutato: !!valutato });
  });
  gestisci('progetto:smetti', ({ id }) => M.smetti(id));
  gestisci('progetto:stato', ({ id }) => M.stato(id));
  gestisci('progetto:diff', ({ id, rel, da, a }) => M.diff(id, { rel, da, a }));
  gestisci('progetto:righe', ({ id, rel, da, a }) => M.righe(id, rel, da, a));
  gestisci('progetto:rileva', ({ id }) => M.rileva(id));
  // la finestra di conferma è l'unico cancello prima di eseguire: una alla volta (le richieste mentre è aperta si rifiutano),
  // e Invio sceglie «Annulla». Il comando si mostra con i caratteri invisibili resi visibili (esegui.mjs)
  let confermaAperta = false;
  gestisci('progetto:conferma', async ({ id, testo }) => {
    if (confermaAperta) return { errore: t('desktop.progetto-conferma-aperta') };
    confermaAperta = true;
    try {
      const p = await M.preparaConferma(id, typeof testo === 'string' ? testo.slice(0, 4000) : null);
      if (p.errore) return p;
      if (!automatica) {
        const r = await dialog.showMessageBox({ type: 'question', title: 'Lode', noLink: true,
          message: t('desktop.progetto-eseguira', { cartella: E.visibile(p.nome) }),
          detail: `${p.dettaglio}\n\n${t('desktop.progetto-come-terminale')}`,
          buttons: [t('desktop.progetto-esegui-sempre'), t('desktop.annulla')], defaultId: 1, cancelId: 1 });
        if (r.response !== 0) return { annullato: true };
      }
      return M.confermaPiano(id, p);
    } finally { confermaAperta = false; }
  });
  gestisci('progetto:prova', ({ id }) => M.prova(id));
  gestisci('progetto:visto', ({ id }) => M.visto(id));
  M.riprendi();
  return M;   // il main chiama M.chiudi() in will-quit
}
