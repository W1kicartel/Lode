// Prove di «Pronto per la discussione» (js/codice/discussione.js), senza browser e senza Electron:
// node --experimental-vm-modules test/discussione.mjs
// Le funzioni pure (trova, punti, controlla, elenco, registraTurno, segna), i comandi di progetto.js e la scheda intera con un
// DOM finto piccolo piccolo (solo quello che la scheda usa) e un main finto per 'progetto:righe'. Niente rete, niente file.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const M = await import('../js/codice/discussione.js'), B = await import('../js/codice/progetto.js');

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const SRC = readFileSync(new URL('../js/codice/discussione.js', import.meta.url), 'utf8');
if (vm.SourceTextModule) { let e = null; try { new vm.SourceTextModule(SRC); } catch (x) { e = x; } prova('modulo valido', !e, e?.message); }
prova('niente rete nel modulo', !/\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//.test(SRC));
prova('mai «scritta dall\'agente»', !/scritt[oa] dall.agente/i.test(SRC) && !/scritt[oa] dall.agente/i.test(readFileSync(new URL('../js/lode.js', import.meta.url), 'utf8')));
const righe = s => s.split('\n');

/* ---------- (1) trova ---------- */
const C = righe(`#include <stdlib.h>
#include <string.h>
int inserisci(Nodo **testa, int v);
/* int inserisci(Nodo **testa, int v) { finto } */
int conta(Nodo *l);

static int
inserisci(Nodo **testa, int v)
{
  char *s = "{ graffa aperta";   // }
  char c = '}';
  if (inserisci(testa, v - 1)) {
    while (*testa) { testa = &(*testa)->succ; }
  }
  Nodo *n = malloc(sizeof *n);
  n->v = v;
  return 1;
}

int conta(Nodo *l) {
  if (conta(l)) return 0;
  return l ? 1 + conta(l->succ) : 0;
}
void libera_lista(Nodo *l) { while (l) { Nodo *x = l->succ; free(l); l = x; } }
int main(void) { return inserisci(0, 0); }`);
const ti = M.trova(C, 'inserisci', 'c');
prova('C: salta il prototipo e il commento, prende il tipo sulla riga sopra', ti?.riga === 8 && ti.da === 7 && ti.firma === 'static int inserisci(Nodo **testa, int v)', JSON.stringify(ti));
prova('C: graffa sulla riga dopo, graffe dentro stringhe, caratteri e commenti, graffe annidate', ti?.a === 18, ti?.a);
const tc = M.trova(C, 'conta', 'c');
prova('C: «if (conta(l))» non è una firma', tc?.riga === 20 && tc.a === 23, JSON.stringify(tc));
prova('C: una funzione su una riga', JSON.stringify(M.trova(C, 'libera_lista', 'c')) === JSON.stringify({ da: 24, a: 24, riga: 24, firma: 'void libera_lista(Nodo *l)', nome: 'libera_lista' }));
prova('C: prototipo «int f(int);» da solo → null', M.trova(righe('int f(int);\nint main(void) { return f(1); }'), 'f', 'c') === null);
prova('C: nome assente → null', M.trova(C, 'cancella', 'c') === null && M.trova(C, 'inserisci', null) === null && M.trova(C, 'a.b', 'c') === null);
const J = righe(`import java.util.*;
public class Lista<T> {
  @Override
  public String toString() { return "{"; }
  public static <K extends Comparable<K>> Map<K, List<String>> raggruppa(List<K> chiavi, String... nomi)
      throws IOException {
    Map<K, List<String>> m = new HashMap<>();
    for (K k : chiavi) {
      m.computeIfAbsent(k, x -> new ArrayList<>()).add("}");
    }
    return m;
  }
  public Lista(int n) { this.n = n; }
}`);
const tj = M.trova(J, 'raggruppa', 'java');
prova('Java: metodo con throws e generici, firma su due righe', tj?.riga === 5 && tj.a === 12 && /raggruppa\(List<K> chiavi, String\.\.\. nomi\) throws IOException$/.test(tj.firma), JSON.stringify(tj));
const P = righe(`import functools

@functools.lru_cache
@altro(1)
async def conta(nodo, x: int = 3, *args, **kw) -> int:
    """Conta i nodi.
fine della docstring"""
    def interna(y):
        return y + 1

    while nodo:
        nodo = nodo.succ
    return conta(nodo)

def stampa(self, testa) -> None:
    print(testa)
def vuota(): pass
`);
const tp = M.trova(P, 'conta', 'python');
prova('Python: async def con decoratori sopra, corpo fino al dedent (docstring a capo compresa)', tp?.da === 3 && tp.riga === 5 && tp.a === 13 && tp.firma === 'async def conta(nodo, x: int = 3, *args, **kw) -> int', JSON.stringify(tp));
prova('Python: funzione annidata', JSON.stringify(M.trova(P, 'interna', 'python')) === JSON.stringify({ da: 8, a: 9, riga: 8, firma: 'def interna(y)', nome: 'interna' }));
prova('Python: def su una riga sola', M.trova(P, 'vuota', 'python')?.a === 17 && M.trova(P, 'stampa', 'python')?.a === 16);
prova('Python: nome assente → null', M.trova(P, 'contare', 'python') === null);

/* ---------- (2) punti ---------- */
const tipi = l => l.map(p => p.tipo).join(',');
const pi = M.punti(ti, C, 'c');
prova('punti C: parametri senza puntatori, tipo, malloc, ciclo, ricorsione', tipi(pi) === 'parametri,restituisce,chiama,ciclo,ricorsione' && pi[0].nomi.join() === 'testa,v' && pi[1].tipoRitorno === 'int' && pi[2].nome === 'malloc', JSON.stringify(pi));
const pl = M.punti(M.trova(C, 'libera_lista', 'c'), C, 'c');
prova('punti C: void → «non restituisce niente», free è di libreria', pl[1].testo === 'che non restituisce niente' && pl.some(p => p.nome === 'free'), JSON.stringify(pl));
const ps = M.punti(M.trova(P, 'stampa', 'python'), P, 'python');
prova('punti Python: -> None → «non restituisce niente», self non è un parametro', ps[1].testo === 'che non restituisce niente' && ps[0].nomi.join() === 'testa', JSON.stringify(ps));
const pv = M.punti(M.trova(P, 'vuota', 'python'), P, 'python');
prova('punti Python: niente parametri, niente return → «non riceve niente», «non restituisce niente»', pv[0].testo === 'che non riceve niente' && pv[1].niente, JSON.stringify(pv));
const pc = M.punti(tp, P, 'python');
prova('punti Python: x: int = 3, *args, **kw ridotti ai nomi; ciclo e ricorsione', pc[0].nomi.join() === 'nodo,x,args,kw' && /ciclo/.test(tipi(pc)) && /ricorsione/.test(tipi(pc)), JSON.stringify(pc));
prova('parametri: Nodo **testa, int v[], String... args, int (*cmp)(…)', M.parametri('int f(Nodo **testa, int v[])', 'f', 'c').join() === 'testa,v' && M.parametri('void main(String... args)', 'main', 'java').join() === 'args'
  && M.parametri('void ordina(void *v, int (*cmp)(const void *, const void *))', 'ordina', 'c').join() === 'v,cmp' && M.parametri('int main(void)', 'main', 'c').length === 0);
const S = righe('char *parola(char *s) {\n  char *t = strtok(s, " ");\n  return crea_nodo(t);\n}');
const pt = M.punti(M.trova(S, 'parola', 'c'), S, 'c');
prova('punti: strtok riconosciuto, una funzione propria (crea_nodo) non è di libreria, niente ricorsione', pt.some(p => p.nome === 'strtok') && !pt.some(p => p.nome === 'crea_nodo') && !/ricorsione|ciclo/.test(tipi(pt)) && pt[1].tipoRitorno === 'char *', JSON.stringify(pt));
prova('punti: al massimo 5', M.punti(ti, C, 'c').length <= 5 && M.punti(null, C, 'c').length === 0);

/* ---------- (3) controlla ---------- */
const cc = M.controlla(pi, 'Riceve la testa della lista e un valore; ritorna 1. Usa malloc e scorre la lista finché non arriva in fondo, e si richiama.');
prova('controlla: sinonimi presi (riceve, ritorna, scorre, si richiama)', cc.saltati.length === 0 && cc.presi.length === 5, JSON.stringify(cc.saltati));
prova('controlla: una spiegazione vuota salta tutto', M.controlla(pi, '   ').presi.length === 0 && M.controlla(pi, '').saltati.length === pi.length);
const c2 = M.controlla(pi, 'Prende testa, v. Dà 1 se va bene.');
prova('controlla: «dà» conta, la ricorsione saltata', c2.presi.map(p => p.tipo).join() === 'parametri,restituisce' && c2.saltati.map(p => p.tipo).join() === 'chiama,ciclo,ricorsione', JSON.stringify(c2.presi.map(p => p.tipo)));
prova('controlla: «da» preposizione non vale «dà»', M.controlla([pi[1]], 'parte da testa').presi.length === 0);
prova('controlla: un parametro nominato senza accento conta (città → citta)', M.controlla([{ tipo: 'parametri', nomi: ['città', 'n'] }], 'usa citta per cercare').presi.length === 1);
prova('controlla: void → «niente», «nulla»', M.controlla([pl[1]], 'alla fine non dà nulla').presi.length === 1 && M.controlla([pl[1]], 'libera tutto').presi.length === 0);
prova('controlla: metà dei nomi basta, meno no', M.controlla([{ tipo: 'parametri', nomi: ['a', 'b', 'c', 'd'] }], 'usa a e b').presi.length === 1 && M.controlla([{ tipo: 'parametri', nomi: ['testa', 'v', 'k'] }], 'usa testa').presi.length === 0);

/* ---------- (4) elenco ---------- */
const T0 = new Date(2026, 9, 3, 15, 0).getTime(), MIN = 60e3;
const cambio = (t, funzioni, progetto = 'lab3') => ({ t, tipo: 'cambio', progetto, file: [], piu: 1, meno: 0, funzioni: funzioni.map(([nome, file, stato = 'cambiata']) => ({ nome, file, stato })) });
const turno = { id: 'abc123', nome: 'lab3', agente: 'claude', inizio: T0, fine: T0 + 20 * MIN, file: ['lista.c'] };
const codice = () => ({ eventi: [
  cambio(T0 - 60 * MIN, [['main', 'main.c'], ['vecchia', 'lista.c']]),
  cambio(T0 + 25 * MIN, [['inserisci', 'lista.c', 'nuova']]),          // dentro la finestra (fine + 5 minuti)
  cambio(T0 + 31 * MIN, [['cerca', 'lista.c']]),                       // 11 minuti dopo la fine: fuori
  cambio(T0 + 10 * MIN, [['stampa', 'main.c']]),                       // durante il turno, ma un file che l'agente non ha toccato
  cambio(T0 + 12 * MIN, [['ordina', 'lista.c']], 'lab4'),             // durante il turno, ma un altro progetto
  cambio(T0 + 90 * MIN, [['vecchia', 'lista.c', 'tolta']]),
], turni: [turno], opzioni: {}, spiegate: {} });
let k = codice(), l = M.elenco(k, 'lab3', { memoria: {} });
prova('elenco: prima la funzione cambiata durante il turno e mai spiegata', l[0]?.nome === 'inserisci' && l[0].stato === 'agente' && M.testoStato(l[0]) === 'cambiata mentre lavorava l\'agente · mai spiegata', JSON.stringify(l[0]));
prova('elenco: 11 minuti dopo la fine, un file diverso, un altro progetto → non è dell\'agente', ['cerca', 'stampa'].every(n => l.find(x => x.nome === n)?.stato === 'mai') && !l.some(x => x.nome === 'ordina'));
prova('elenco: la funzione tolta sparisce', !l.some(x => x.nome === 'vecchia') && l.length === 4, l.map(x => x.nome).join());
prova('elenco: a parità, la più recente prima', l.map(x => x.nome).join() === 'inserisci,cerca,stampa,main', l.map(x => x.nome).join());
prova('elenco: 2 minuti prima dell\'inizio conta, 3 no', M.elenco({ ...codice(), eventi: [cambio(T0 - 2 * MIN, [['a', 'lista.c']]), cambio(T0 - 3 * MIN, [['b', 'lista.c']])] }, 'lab3', { memoria: {} }).map(x => x.stato).join() === 'agente,mai');
prova('elenco: anche gli eventi «fatto» di progetto.js', M.elenco({ eventi: [{ t: T0 + MIN, tipo: 'fatto', nome: 'lab3', file: [{ rel: 'lista.c', nuove: ['crea'], cambiate: [], tolte: [] }] }], turni: [turno] }, 'lab3', { memoria: {} })[0]?.stato === 'agente');
// spiegazioni
k = codice();
M.segna(k, 'lab3', 'lista.c#inserisci', 'so', 0, T0 + 40 * MIN);
M.segna(k, 'lab3', 'main.c#main', 'provata', 2, T0 + 40 * MIN);
M.segna(k, 'lab3', 'main.c#stampa', 'so', 0, T0 + 5 * MIN);   // poi stampa è cambiata (T0 + 10)
l = M.elenco(k, 'lab3', { memoria: {} });
prova('elenco: ordine agente/mai, cambiata dopo la spiegazione, da rivedere, a posto', l.map(x => `${x.nome}:${x.stato}`).join() === 'cerca:mai,stampa:cambiata,main:rivedere,inserisci:ok', l.map(x => `${x.nome}:${x.stato}`).join());
prova('elenco: i testi degli stati', M.testoStato(l[1]) === 'cambiata dopo l\'ultima volta che l\'hai spiegata' && M.testoStato(l[3]) === 'spiegata il 3/10' && M.testoStato(l[2]) === 'da rivedere · hai saltato 2 punti');
prova('conti: «Spiegate: 1 su 4», da rivedere main', JSON.stringify(M.conti(k, 'lab3', { memoria: {} })) === JSON.stringify({ spiegate: 1, totale: 4, rivedere: ['main'] }));
M.segna(k, 'lab3', 'lista.c#cerca', 'tolta', 0, T0 + 50 * MIN);
prova('elenco: «Togli dall\'elenco» toglie, finché non cambia ancora', !M.elenco(k, 'lab3', { memoria: {} }).some(x => x.nome === 'cerca') && (k.eventi.push(cambio(T0 + 60 * MIN, [['cerca', 'lista.c']])), M.elenco(k, 'lab3', { memoria: {} }).find(x => x.nome === 'cerca')?.stato === 'mai'));
const tanti = { eventi: Array.from({ length: 40 }, (_, i) => cambio(T0 + i * MIN, [[`f${i}`, 'a.c']])), turni: [] };
prova('elenco: al massimo 30, ma il conto è su tutte', M.elenco(tanti, 'lab3', { memoria: {} }).length === 30 && M.conti(tanti, 'lab3', { memoria: {} }).totale === 40);
prova('elenco: dati vecchi senza turni né spiegate, o nome strano → vuoto senza errori', M.elenco({ eventi: [] }, 'lab3').length === 0 && M.elenco(undefined, 'lab3').length === 0 && M.elenco(codice(), '__proto__').length === 0);

/* ---------- (5) registraTurno ---------- */
const kt = { eventi: [] };
M.registraTurno(kt, { ...turno, file: ['lista.c', '/Users/studente/lab3/lista.c', 'C:\\Users\\studente\\lab3\\x.c', '../fuori.c', 'test/01.in'], comandi: 3, messaggio: 'ho finito' });
prova('registraTurno: i percorsi assoluti si scartano, restano solo i campi che servono', JSON.stringify(kt.turni) === JSON.stringify([{ id: 'abc123', nome: 'lab3', agente: 'claude', inizio: T0, fine: T0 + 20 * MIN, file: ['lista.c', 'test/01.in'] }]), JSON.stringify(kt.turni));
prova('registraTurno: un turno di sole parole non si tiene', M.registraTurno(kt, { ...turno, inizio: T0 + 1, file: [] }) === null && M.registraTurno(kt, { ...turno, inizio: T0 + 2, file: ['/Users/studente/a.c'] }) === null && kt.turni.length === 1);
M.registraTurno(kt, { ...turno });
prova('registraTurno: lo stesso turno due volte resta uno', kt.turni.length === 1);
for (let i = 0; i < 130; i++) M.registraTurno(kt, { ...turno, inizio: T0 + i * MIN, fine: T0 + i * MIN + 30e3 });
prova('registraTurno: al massimo 100, i più recenti', kt.turni.length === 100 && kt.turni.at(-1).inizio === T0 + 129 * MIN && kt.turni[0].inizio === T0 + 30 * MIN);

/* ---------- (6) segna con il diario spento ---------- */
const spento = { ...codice(), opzioni: { lab3: { diario: false } }, spiegate: {} }, mem = {};
prova('segna: diario spento → niente in codice.spiegate, solo in memoria', M.segna(spento, 'lab3', 'lista.c#inserisci', 'so', 0, T0 + 100 * MIN, mem) === false && JSON.stringify(spento.spiegate) === '{}' && mem.lab3['lista.c#inserisci'].esito === 'so');
prova('segna: in memoria vale per questa sessione', M.elenco(spento, 'lab3', { memoria: mem }).find(x => x.nome === 'inserisci')?.stato === 'ok');
prova('segna: rifiuta chiavi e progetti strani', !M.segna(codice(), '__proto__', 'a.c#f', 'so') && !M.segna(codice(), 'lab3', '/Users/studente/a.c#f', 'so') && !M.segna(codice(), 'lab3', 'a.c#f', 'boh'));

/* ---------- (7) i comandi ---------- */
const I = B.interpreta;
prova('comandi: «preparami alla discussione di lab3» → discussione, lab3', JSON.stringify(I('preparami alla discussione di lab3')) === JSON.stringify({ tipo: 'progetto', azione: 'discussione', nome: 'lab3' }));
prova('comandi: «discussione», «pronto per la discussione», «funzioni da spiegare» senza nome', ['discussione', 'Pronto per la discussione!', 'funzioni da spiegare'].every(t => I(t)?.azione === 'discussione' && !('nome' in I(t))));
prova('comandi: «discussione di lab3», «funzioni da spiegare di lab3»', I('discussione di lab3')?.nome === 'lab3' && I('funzioni da spiegare di lab3')?.nome === 'lab3' && I('preparami alla discussione del progetto lab3')?.nome === 'lab3');
prova('comandi: «discussione di laurea» non è un progetto', I('discussione di laurea') === null && I('discussione della tesi') === null);
prova('comandi: tesi e laurea non sono progetti, in nessuna forma', I('sono pronta per la discussione della tesi') === null && I('preparami alla discussione di laurea') === null && I('pronto per la discussione di laurea') === null && I('funzioni da spiegare della tesi') === null && I('preparami alla discussione di lab3')?.azione === 'discussione' && I('sono pronta per la discussione di lab3')?.nome === 'lab3');
prova('comandi: quelli di prima restano uguali', I('Segui progetto')?.azione === 'segui' && I('cosa è cambiato?')?.azione === 'cambiato' && I('compila')?.azione === 'prova' && I('smetti di seguire lab3-liste')?.nome === 'lab3-liste' && I('gioca analisi 2') === null);
prova('daSpiegare: solo con file C, Java o Python', M.daSpiegare({ file: ['lista.c'] }) && !M.daSpiegare({ file: ['README.md'] }) && !M.daSpiegare({}));

/* ---------- (8) la scheda, con un DOM finto ---------- */
// Un albero di elementi che sa leggere l'HTML che scrive la scheda (ben formato), cercare per .classe, [attributo] e tag, e
// cliccare. Basta per vedere cosa compare e quando.
const DEC = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
class El {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.attr = {}; this.figli = []; this.padre = null; this.ascolta = {}; this.hidden = false; this.disabled = false; this.value = ''; this.readOnly = false; }
  get parentElement() { return this.padre instanceof El ? this.padre : null; }
  get className() { return this.attr.class || ''; } set className(v) { this.attr.class = v; }
  get classList() { const el = this; return { contains: c => el.className.split(/\s+/).includes(c) }; }
  get dataset() { return Object.fromEntries(Object.entries(this.attr).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5), v])); }
  setAttribute(k, v) { this.attr[k] = String(v); } getAttribute(k) { return this.attr[k] ?? null; }
  addEventListener(t, f) { (this.ascolta[t] ||= []).push(f); }
  click() { return Promise.all((this.ascolta.click || []).map(f => f({ currentTarget: this, target: this }))); }
  focus() { }
  append(...xs) { for (const x of xs) { x.padre?.figli && (x.padre.figli = x.padre.figli.filter(y => y !== x)); x.padre = this; this.figli.push(x); } }
  remove() { if (this.padre) this.padre.figli = this.padre.figli.filter(y => y !== this); this.padre = null; }
  get textContent() { return this.figli.map(x => typeof x === 'string' ? x : x.hidden ? '' : x.tagName === 'TEXTAREA' ? x.value : x.textContent).join(''); }
  set textContent(v) { this.figli = [String(v)]; }
  get innerHTML() { return this.figli.map(x => typeof x === 'string' ? x : `<${x.tagName.toLowerCase()}>${x.innerHTML}</${x.tagName.toLowerCase()}>`).join(''); }
  set innerHTML(h) {
    this.figli = []; const pila = [this];
    for (const m of String(h).matchAll(/<\/([a-z0-9]+)>|<([a-z0-9]+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*>|([^<]+)/gi)) {
      const cima = pila.at(-1);
      if (m[1]) { pila.pop(); continue; }
      if (m[4]) { if (cima.tagName === 'TEXTAREA') cima.value += DEC(m[4]); else cima.figli.push(DEC(m[4])); continue; }
      const el = new El(m[2]);
      for (const a of m[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) el.attr[a[1]] = a[2] === undefined ? '' : DEC(a[2]);
      if ('hidden' in el.attr) el.hidden = true;
      cima.append(el); pila.push(el);
    }
  }
  tutti() { return this.figli.flatMap(x => typeof x === 'string' ? [] : [x, ...x.tutti()]); }
  querySelectorAll(sel) {
    const ok = el => sel.startsWith('.') ? el.className.split(/\s+/).includes(sel.slice(1)) : sel.startsWith('[') ? sel.slice(1, -1) in el.attr : el.tagName === sel.toUpperCase();
    return this.tutti().filter(ok);
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
globalThis.document = { createElement: t => new El(t) };
const filo = new El('div');
const T = { scheda: (cls, html) => { const s = new El('div'); s.className = 'ld-scheda ' + cls; s.innerHTML = html; filo.append(s); return s; }, premi: async () => { } };
const LISTA = righe(`#include <stdlib.h>

int inserisci(Nodo **testa, int v) {
  Nodo *n = malloc(sizeof *n);
  n->v = v;
  n->succ = *testa;
  *testa = n;
  return 1;
}`);
let chieste = 0;
const main = (righeFile, totale = righeFile.length) => async (canale, x) => {
  chieste++;
  if (canale !== 'progetto:righe') return { errore: 'canale sbagliato' };
  const da = x.da, a = Math.min(totale, x.a);
  return { rel: x.rel, da, a, totale, righe: righeFile.slice(da - 1, a).map((s, i) => ({ n: da + i, s })) };
};
let salvato = 0;
const D = { codice: { eventi: [cambio(T0 + 25 * MIN, [['inserisci', 'lista.c', 'nuova']]), cambio(T0 - 60 * MIN, [['main', 'main.c']])], turni: [], opzioni: {}, spiegate: {} } };
M.registraTurno(D.codice, { ...turno, file: ['lista.c', '/Users/studente/lab3/lista.c'] });
const sc = await M.scheda({ id: 'abc123', nome: 'lab3' }, T, main(LISTA), { dati: { D, salva: () => salvato++ }, memoria: {} });
const testo = () => sc.textContent.replace(/\s+/g, ' ');
const voci = () => sc.querySelectorAll('.voce');
prova('scheda: titolo, conto e frase', /Pronto per la discussione · lab3/.test(testo()) && /Spiegate: 0 su 2/.test(testo()) && /Prima quelle cambiate mentre lavorava un agente e che non hai mai spiegato\./.test(testo()), testo().slice(0, 300));
prova('scheda: per prima la funzione cambiata durante il turno, con la scritta giusta', /inserisci · lista\.c/.test(voci()[0].textContent) && voci()[0].textContent.includes('cambiata mentre lavorava l\'agente · mai spiegata'), voci()[0]?.textContent);
prova('scheda: la nota fissa in fondo, mai «scritta dall\'agente»', testo().includes('Lode non sa chi ha scritto le righe: «mentre lavorava l\'agente» vuol dire che il file è cambiato durante un suo turno. Lode non ti spiega il codice: controlla solo che tu lo sappia spiegare.') && !/scritt[oa] dall.agente/i.test(testo()));
// [Proviamo]: firma e posto, il corpo no
await voci()[0].querySelector('[data-prova]').click();
const pr = voci()[0].querySelector('.prova');
prova('Proviamo: firma, posto e consegna', pr.textContent.includes('int inserisci(Nodo **testa, int v) · lista.c, riga 3. Spiegala come alla discussione: cosa riceve, cosa restituisce, come funziona. Il codice te lo mostro dopo.'), pr.textContent);
prova('Proviamo: il corpo della funzione non si vede prima di [Ho finito]', !testo().includes('malloc') && !testo().includes('n->succ') && !!pr.querySelector('textarea') && !!pr.querySelector('[data-finito]'));
prova('Proviamo: l\'area di testo è della scheda, non il campo principale', pr.querySelector('textarea').parentElement === pr);
await pr.querySelector('[data-finito]').click();
prova('Ho finito: a vuoto non succede niente', !testo().includes('Hai ') && !!pr.querySelector('[data-finito]'));
pr.querySelector('textarea').value = 'Riceve la testa della lista e il valore v, e restituisce 1.';
await pr.querySelector('[data-finito]').click();
prova('Ho finito: detti e saltati', testo().includes('Hai detto: i parametri, cosa restituisce. Hai saltato: che chiama malloc.'), testo());
prova('Ho finito: solo adesso il codice, con i numeri di riga', testo().includes('malloc(sizeof *n)') && /3int inserisci/.test(pr.querySelector('.codice').textContent) && !pr.querySelector('[data-finito]'));
prova('Ho finito: esito «provata» con i punti saltati, stato «da rivedere»', D.codice.spiegate.lab3['lista.c#inserisci'].esito === 'provata' && D.codice.spiegate.lab3['lista.c#inserisci'].saltati === 1 && voci()[0].querySelector('.stato').textContent.startsWith('da rivedere') && salvato === 1);
// [La so spiegare] sull'altra: va in fondo, il conto sale
await voci()[1].querySelector('[data-so]').click();
prova('La so spiegare: esito «so», in fondo, «Spiegate: 1 su 2»', D.codice.spiegate.lab3['main.c#main'].esito === 'so' && voci()[1].textContent.includes('main · main.c') && /Spiegate: 1 su 2/.test(testo()) && salvato === 2);
// in D.codice niente codice e niente percorsi assoluti
const json = JSON.stringify(D.codice);
prova('dati: niente codice sorgente e niente percorsi assoluti in D.codice', !/malloc|sizeof|n->|\/Users\/|C:\\\\|Nodo \*\*/.test(json), json);
// una funzione che non c'è più → [Togli dall'elenco]
const D2 = { codice: { eventi: [cambio(T0, [['cancella', 'lista.c']])], turni: [], opzioni: {}, spiegate: {} } };
const s2 = await M.scheda({ id: 'abc123', nome: 'lab3' }, T, main(LISTA), { dati: { D: D2, salva() { } }, memoria: {} });
await s2.querySelector('[data-prova]').click();
prova('sparita: «Non trovo più …: forse l\'hai rinominata o tolta.»', s2.textContent.includes('Non trovo più cancella in lista.c: forse l\'hai rinominata o tolta.'), s2.textContent);
await s2.querySelector('[data-togli]').click();
prova('sparita: Togli dall\'elenco', D2.codice.spiegate.lab3['lista.c#cancella'].esito === 'tolta' && !s2.querySelector('.voce'));
// file troppo lungo, file che non si legge, lingua che non conosco
const lungo = Array.from({ length: 2400 }, (_, i) => `// riga ${i}`);
const s3 = await M.scheda({ id: 'abc123', nome: 'lab3' }, T, main(lungo), { dati: { D: { codice: { eventi: [cambio(T0, [['f', 'grande.c']])] } }, salva() { } }, memoria: {} });
await s3.querySelector('[data-prova]').click();
prova('file oltre 2000 righe: lo dice in chiaro', s3.textContent.includes('grande.c ha 2400 righe: oltre 2000 non lo leggo.'), s3.textContent);
const s4 = await M.scheda({ id: 'abc123', nome: 'lab3' }, T, async () => ({ errore: 'Questo file non è tra quelli che seguo.' }), { dati: { D: { codice: { eventi: [cambio(T0, [['f', 'a.c']])] } }, salva() { } }, memoria: {} });
await s4.querySelector('[data-prova]').click();
prova('file che non si legge: lo dice', s4.textContent.includes('Non riesco a leggere a.c: Questo file non è tra quelli che seguo.'));
chieste = 0;
const s5 = await M.scheda({ id: 'abc123', nome: 'lab3' }, T, main(LISTA), { dati: { D: { codice: { eventi: [cambio(T0, [['f', 'a.rs']])] } }, salva() { } }, memoria: {} });
await s5.querySelector('[data-prova]').click();
prova('lingua sconosciuta: «Per questa lingua non so controllare» e il file non si legge', s5.textContent.includes('Per questa lingua non so controllare: segnala tu se la sai spiegare.') && chieste === 0);
// a pezzi di 400 righe
chieste = 0;
const r1200 = await M.leggiFile(main(Array.from({ length: 1000 }, (_, i) => 'x' + i)), 'abc', 'a.c');
prova('leggiFile: a pezzi di 400', r1200.righe?.length === 1000 && chieste === 3 && r1200.righe[999] === 'x999');
// diario spento: la scheda lo dice e non salva
const D6 = { codice: { eventi: [cambio(T0, [['f', 'a.c']])], opzioni: { lab3: { diario: false } }, spiegate: {} } }; let s6n = 0;
const s6 = await M.scheda({ id: 'abc123', nome: 'lab3' }, T, main(LISTA), { dati: { D: D6, salva: () => s6n++ }, memoria: {} });
await s6.querySelector('[data-so]').click();
prova('diario spento: «Diario spento: non mi segno niente.» e niente in D.codice', s6.textContent.includes('Diario spento: non mi segno niente.') && JSON.stringify(D6.codice.spiegate) === '{}' && s6n === 0 && /Spiegate: 1 su 1/.test(s6.textContent));
prova('esito: tutti i punti', M.htmlEsito({ presi: [pi[0]], saltati: [] }).includes('Hai toccato tutti i punti che trovo nel codice.'));
prova('codice: al massimo 60 righe, poi «…»', (() => { const h = M.htmlCodice(Array.from({ length: 100 }, (_, i) => 'r' + i), { da: 1, a: 100 }); return h.includes('r59') && !h.includes('r60<') && h.includes('…'); })());

/* ---------- (9) la riga nel diario di oggi (diario.js) ---------- */
const R = await import('../js/codice/diario.js');
const kd = codice();
const oggi = T0 + 100 * MIN;
M.segna(kd, 'lab3', 'main.c#main', 'provata', 1, oggi);
M.segna(kd, 'lab3', 'lista.c#inserisci', 'so', 0, oggi);
const nd = R.noteDiario(kd, { adesso: oggi }).find(n => n.progetto === 'lab3' && n.giorno === R.giornoDi(oggi));
prova('diario: «Spiegate: 1 su 4; da rivedere: `main`», solo nomi', nd?.testo.endsWith('\n- Spiegate: 1 su 4; da rivedere: `main`'), nd?.testo);
prova('diario: senza spiegazioni nessuna riga in più', !R.noteDiario(codice(), { adesso: oggi }).some(n => /Spiegate:/.test(n.testo)));
prova('diario: con il diario spento nessuna nota per quel progetto', !R.noteDiario({ ...kd, opzioni: { lab3: { diario: false } } }, { adesso: oggi }).some(n => n.progetto === 'lab3'));

console.log(ko ? `\n${ko} prove fallite, ${ok} passate` : `Pronto per la discussione: ${ok} prove passate`);
process.exit(ko ? 1 : 0);
