// Prove di «Segui il progetto» (F2), senza Electron: node test/progetto.mjs
// Prima le funzioni pure (diff, funzioni cambiate, impronta, riassunto, argv, confronto dell'uscita), poi il motore vero
// su una cartella temporanea: watcher, «Fatto», annulla, cartelle ignorate, file grandi e, se c'è un compilatore C,
// le prove .in/.out, il ciclo infinito chiuso in tempo e lo scanf senza .in che non parte.
// Ogni attesa ha un tempo massimo: la prova intera sta sotto il minuto.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as PR from '../desktop/progetto.mjs';
import * as E from '../desktop/esegui.mjs';
import * as B from '../js/codice/progetto.js';   // la parte della barra: qui solo le funzioni senza DOM

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett === '' ? '' : typeof dett === 'string' ? dett : JSON.stringify(dett)); } };
const t0 = Date.now();

/* ---------- diff ---------- */
const R = PR.righe;
prova('righe: CRLF e spazi finali non contano', JSON.stringify(R('a  \r\nb\t\r\n')) === JSON.stringify(R('a\nb\n')));
let d = PR.diffRighe(R('int x;\r\nint y;\r\n'), R('int x;\nint y;\n'));
prova('diff: una modifica solo di CRLF dà 0 differenze', d.piu === 0 && d.meno === 0 && PR.blocchi(d.ops).length === 0, d);
d = PR.diffRighe(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd', 'e']);
prova('diff: conteggi', d.piu === 2 && d.meno === 1, d);
prova('diff: righe numerate', d.ops.find(o => o.s === 'x').nb === 2 && d.ops.find(o => o.s === 'b').na === 2 && d.ops.find(o => o.s === 'e').nb === 5);
// proprietà: le righe « » e «-» rifanno il file di prima, « » e «+» quello di dopo; e lo script è il più corto (contro un LCS)
let seme = 7; const rnd = n => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme % n; };
const lcs = (a, b) => { const m = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0)); for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) m[i][j] = a[i] === b[j] ? m[i + 1][j + 1] + 1 : Math.max(m[i + 1][j], m[i][j + 1]); return m[0][0]; };
let rifatti = true, minimi = true;
for (let k = 0; k < 300; k++) {
  const a = Array.from({ length: rnd(14) }, () => 'r' + rnd(5)), b = Array.from({ length: rnd(14) }, () => 'r' + rnd(5));
  const x = PR.diffRighe(a, b);
  if (x.ops.filter(o => o.t !== '+').map(o => o.s).join() !== a.join() || x.ops.filter(o => o.t !== '-').map(o => o.s).join() !== b.join()) rifatti = false;
  if (x.piu + x.meno !== a.length + b.length - 2 * lcs(a, b)) minimi = false;
}
prova('diff: rifà i due file (300 casi a caso)', rifatti);
prova('diff: Myers dà lo script più corto', minimi);
const lunghe = Array.from({ length: 40 }, (_, i) => 'riga ' + i), dopo = [...lunghe]; dopo[5] = 'cambiata 5'; dopo[30] = 'cambiata 30';
const bl = PR.blocchi(PR.diffRighe(lunghe, dopo).ops, 3);
prova('diff: due blocchi lontani, 3 righe di contesto', bl.length === 2 && bl[0].righe.length === 8 && bl[0].righe[0].s === 'riga 2' && bl[1].righe.at(-1).s === 'riga 33', bl.map(b => b.righe.length));
const vicini = [...lunghe]; vicini[5] = 'x'; vicini[10] = 'y';
prova('diff: blocchi vicini si uniscono', PR.blocchi(PR.diffRighe(lunghe, vicini).ops, 3).length === 1);
const grande = Array.from({ length: 6000 }, (_, i) => 'l' + i), grande2 = [...grande, 'nuova'];
d = PR.diffRighe(grande, grande2);
prova('diff: oltre 5000 righe solo i conteggi', d.grande && d.piu === 1 && d.meno === 0 && d.ops === null, d.piu);

/* ---------- funzioni ---------- */
const fC = r => PR.firmaDiff(r, 'c');
prova('C: «+    if (x) {» non è una funzione', fC('+    if (x) {') === null);
prova('C: «+    while (p != NULL) {» non è una funzione', fC('+    while (p != NULL) {') === null);
prova('C: «+  switch (c) {» non è una funzione', fC('+  switch (c) {') === null);
prova('C: «+int conta(Nodo *l) {» è una funzione', fC('+int conta(Nodo *l) {') === 'conta');
prova('C: «+Nodo *crea(int v)» è una funzione', fC('+Nodo *crea(int v)') === 'crea');
prova('C: prototipi, chiamate e assegnazioni no', fC('+void stampa(Lista l);') === null && fC('+int x = f(3);') === null && fC('+return conta(l);') === null && fC('+else if (x) {') === null);
prova('C: static, struct, unsigned, *', fC('+static unsigned int somma(int *v, size_t n) {') === 'somma' && fC('+struct nodo *nuovo(void) {') === 'nuovo' && fC('+size_t lung(const char *s)') === 'lung');
prova('Python: def, anche nei metodi', PR.firmaDiff('+def media(v):', 'python') === 'media' && PR.firmaDiff('+    def push(self, x):', 'python') === 'push' && PR.firmaDiff('+    if x:', 'python') === null);
prova('Java: metodi con modificatori', PR.firmaDiff('+    public static int somma(int[] v) {', 'java') === 'somma' && PR.firmaDiff('+    private List<String> nomi() {', 'java') === 'nomi' && PR.firmaDiff('+        if (x > 0) {', 'java') === null && PR.firmaDiff('+        return somma(v);', 'java') === null);

const listaPrima = `#include <stdio.h>
#include "lista.h"

void stampa_lista(Nodo *l) {
    while (l != NULL) {
        printf("%d ", l->v);
        l = l->next;
    }
}

int conta(Nodo *l) {
    int n = 0;
    for (; l; l = l->next) n++;
    return n;
}
`;
const listaDopo = `#include <stdio.h>
#include <stdlib.h>
#include "lista.h"

void stampa_lista(Nodo *l) {
    while (l != NULL) {
        printf("%d -> ", l->v);
        l = l->next;
    }
    printf("NULL\\n");
}

Nodo *inserisci_in_testa(Nodo *l, int v) {
    Nodo *n = malloc(sizeof *n);
    n->v = v;
    n->next = l;
    return n;
}

int conta(Nodo *l) {
    int n = 0;
    for (; l; l = l->next) n++;
    return n;
}
`;
let a = R(listaPrima), b = R(listaDopo), x = PR.diffRighe(a, b), fz = PR.cambiamentiFunzioni(a, b, x.ops, 'c');
prova('funzioni: nuova inserisci_in_testa, cambiata stampa_lista, conta no', JSON.stringify(fz) === JSON.stringify({ nuove: ['inserisci_in_testa'], cambiate: ['stampa_lista'], tolte: [] }), fz);
prova('include: nuovo #include <stdlib.h>', JSON.stringify(PR.nuoviInclude(a, x.ops, 'c')) === JSON.stringify(['#include <stdlib.h>']));
const tolta = R(listaPrima.replace(/int conta[\s\S]*$/, ''));
x = PR.diffRighe(a, tolta); fz = PR.cambiamentiFunzioni(a, tolta, x.ops, 'c');
prova('funzioni: tolta conta', fz.tolte.includes('conta') && !fz.cambiate.length, fz);
const pyA = R('import sys\n\ndef media(v):\n    return sum(v) / len(v)\n\ndef main():\n    print(media([1, 2]))\n'), pyB = R('import sys\nimport math\n\ndef media(v):\n    if not v:\n        return 0\n    return sum(v) / len(v)\n\ndef main():\n    print(media([1, 2]))\n');
x = PR.diffRighe(pyA, pyB);
prova('Python: cambiata media, nuovo import math', JSON.stringify(PR.cambiamentiFunzioni(pyA, pyB, x.ops, 'python')) === JSON.stringify({ nuove: [], cambiate: ['media'], tolte: [] }) && PR.nuoviInclude(pyA, x.ops, 'python')[0] === 'import math');

/* ---------- impronta e file seguiti ---------- */
const m1 = { 'lista.c': 'aa', 'main.c': 'bb', 'README.md': 'cc', 'test/01.in': 'dd', 'test/01.out': 'ee' };
prova('impronta: non dipende dall\'ordine', PR.impronta(m1) === PR.impronta(Object.fromEntries(Object.entries(m1).reverse())));
prova('impronta: un README cambiato non conta', PR.impronta(m1) === PR.impronta({ ...m1, 'README.md': 'zz' }) && PR.impronta(m1) === PR.impronta({ ...m1, 'note.txt': 'zz' }));
prova('impronta: codice e prove contano', PR.impronta(m1) !== PR.impronta({ ...m1, 'lista.c': 'a2' }) && PR.impronta(m1) !== PR.impronta({ ...m1, 'test/01.out': 'e2' }) && PR.impronta(m1) !== PR.impronta({ ...m1, Makefile: 'x' }));
prova('ignorati: .git, build, node_modules, oggetti, a.out', ['.git/HEAD', 'build/x.c', 'src/node_modules/a.c', 'lista.o', 'a.out', 'prog.exe', 'Main.class', '__pycache__/m.pyc', 'prog.dSYM/x', 'lista.c~'].every(PR.ignorato));
prova('seguiti: codice, prove, test/', ['lista.c', 'test/01.in', 'src/main.py', 'Makefile', 'tests/input1.txt'].every(r => !PR.ignorato(r)));

/* ---------- riassunto ---------- */
const alle = (h, m) => new Date(2026, 9, 5, h, m).getTime();
const r1 = PR.riassunto({ nome: 'lab3-liste', da: alle(14, 42), a: alle(14, 51), impronta: 'nuova', improntaBase: 'vecchia', ultimaProva: null, file: [
  { rel: 'lista.c', stato: 'cambiato', piu: 35, meno: 7, nuove: ['inserisci_in_testa'], cambiate: ['stampa_lista'], tolte: [], include: [] },
  { rel: 'main.c', stato: 'cambiato', piu: 6, meno: 0, nuove: [], cambiate: [], tolte: [], include: ['#include <stdlib.h>'] }] });
const atteso = 'Dalle 14:42 alle 14:51 sono cambiati 2 file (+41 −7).\n– `lista.c`: nuova funzione `inserisci_in_testa`, cambiata `stampa_lista`.\n– `main.c`: 6 righe in più. Nuovo `#include <stdlib.h>`.\n**Provato?** No: dopo l\'ultima modifica (14:51) nessuno ha compilato con Lode.\nNon so chi ha scritto queste righe.';
prova('riassunto: il testo della spec', r1.testo === atteso, '\n' + r1.testo);
prova('riassunto: non provato', r1.vecchio && !r1.provato && r1.codiceCambiato);
const r2 = PR.riassunto({ nome: 'x', da: alle(9, 5), a: alle(9, 5), impronta: 'i1', improntaBase: 'i0', ultimaProva: { impronta: 'i1', esito: 'ok', quando: alle(9, 7), ok: 6, tot: 6, tipo: 'c' }, file: [{ rel: 'nuovo.c', stato: 'nuovo', piu: 1, meno: 0, nuove: [], cambiate: [], tolte: [], include: [] }] });
prova('riassunto: un file, provato, file nuovo', r2.frase === 'Alle 09:05 è cambiato 1 file (+1 −0).' && r2.punti[0] === '`nuovo.c`: file nuovo (1 riga).' && r2.provatoTesto === '**Provato?** Sì: è il codice provato alle 09:07 (✓ compila · 6/6).', r2.testo);
const r3 = PR.riassunto({ da: alle(9, 5), a: alle(9, 6), impronta: 'i0', improntaBase: 'i0', file: [{ rel: 'README.md', stato: 'cambiato', piu: 2, meno: 1 }] });
prova('riassunto: solo README, il codice non è cambiato', !r3.codiceCambiato && r3.provatoTesto.includes('non sono codice') && r3.punti[0] === '`README.md`: 2 righe in più e 1 in meno.', r3.testo);
prova('esito in breve', PR.esitoBreve({ esito: 'prove', ok: 4, tot: 6, tipo: 'c' }) === '✗ 2 prove su 6' && PR.esitoBreve({ esito: 'non-compila', primo: { file: '/x/lista.c', riga: 42 }, tipo: 'c' }) === '✗ non compila · lista.c:42' && PR.esitoBreve({ esito: 'ok', ok: 0, tot: 0, tipo: 'python' }) === '✓ sintassi a posto');

/* ---------- comandi e uscita ---------- */
prova('argv: le virgolette restano unite', JSON.stringify(E.dividiArgv('gcc -o "la mia prova" \'a b.c\' x.c')) === JSON.stringify(['gcc', '-o', 'la mia prova', 'a b.c', 'x.c']));
let rotto = false; try { E.dividiArgv('gcc "aperta'); } catch { rotto = true; }
prova('argv: virgolette non chiuse → errore', rotto);
prova('uscita: CRLF, spazi finali, righe vuote in fondo', E.confronta('3 -> 5 -> NULL\n', '3 -> 5 -> NULL  \r\n\r\n\n').ok);
const cf = E.confronta('3 -> 5 -> NULL\nfine\n', '5 -> 3 -> NULL\nfine\n');
prova('uscita: la prima riga diversa', !cf.ok && cf.riga === 1 && cf.atteso === '3 -> 5 -> NULL' && cf.ottenuto === '5 -> 3 -> NULL', cf);
prova('uscita: una riga in meno', E.confronta('a\nb\n', 'a\n').riga === 2 && E.confronta('a\nb\n', 'a\n').ottenuto === null);
prova('primo errore: gcc/clang, Windows, Python', E.primoErrore("lista.c:42:5: error: use of undeclared identifier 'nodo'")?.riga === 42 && E.primoErrore('C:\\lab\\lista.c:7:1: error: expected \';\'')?.file === 'C:\\lab\\lista.c' && E.primoErrore('Traceback (most recent call last):\n  File "main.py", line 12, in <module>\nIndexError: list index out of range')?.riga === 12);
prova('casi: .in/.out e inputN/outputN, anche in test/', JSON.stringify(E.trovaCasi(['test/02.in', 'test/02.out', 'test/01.in', 'test/01.out', 'tests/input3.txt', 'tests/output3.txt', 'altro/x.in', 'altro/x.out', 'solo.in']).map(c => c.nome)) === JSON.stringify(['test/01', 'test/02', 'tests/3']));
prova('casi: con più programmi vanno a quello col nome', JSON.stringify(E.assegna([{ nome: 'test/es1_01' }, { nome: 'test/es2/01' }, { nome: 'test/03' }], [{ nome: 'es1' }, { nome: 'es2' }]).map(c => c.programma)) === JSON.stringify(['es1', 'es2', null]));
const finto = { compilatore: async () => ({ percorso: '/usr/bin/gcc', nome: 'gcc', cartelle: [] }), python: async () => null, java: async () => null, make: async () => null };
const fileProg = { 'lista.c': 'void x(void){}', 'main.c': 'int main(void) { return 0; }', 'lista.h': '', 'test/01.in': '', 'test/01.out': '' };
const pr = await E.proponi({ nome: 'lab3', file: Object.keys(fileProg), leggi: f => fileProg[f], bin: '/dati/progetti/abc/bin', trova: finto, piattaforma: 'darwin' });
prova('proponi: il comando della spec', pr.testo === 'gcc -std=c11 -Wall -Wextra -g lista.c main.c -o ‹cartella di Lode›/lab3 -lm' && pr.testoCasi === 'poi la prova in test/ (file .in → .out atteso)', pr.testo + ' | ' + pr.testoCasi);
prova('proponi: eseguibile fuori dal progetto', pr.programmi[0].argv[0].replace(/\\/g, '/') === '/dati/progetti/abc/bin/lab3' && pr.casi[0].programma === 'lab3');
const daT = E.daTesto('gcc -O2 lista.c main.c -o ‹cartella di Lode›/lab3', { bin: '/dati/bin', strumento: { nome: 'gcc', percorso: '/usr/bin/gcc' } });
prova('Cambia: testo → argv, la cartella di Lode torna percorso', daT[0] === '/usr/bin/gcc' && daT.at(-1) === '/dati/bin/lab3', daT);
const prPy = await E.proponi({ nome: 'es', file: ['main.py', 'util.py'], leggi: () => '', bin: '/b', trova: { ...finto, python: async () => ({ percorso: '/usr/bin/python3', prefisso: [], nome: 'python3', cartelle: [] }) }, piattaforma: 'linux' });
prova('proponi: Python con il controllo della sintassi', prPy.tipo === 'python' && prPy.testo === 'python3 -B -c ‹controllo della sintassi› main.py util.py' && prPy.programmi[0].argv.join(' ') === '/usr/bin/python3 -B main.py', prPy.testo);
const prNo = await E.proponi({ nome: 'x', file: ['a.c'], leggi: () => 'int main(){}', bin: '/b', trova: { ...finto, compilatore: async () => null }, piattaforma: 'win32' });
prova('proponi: senza compilatore spiega come installarlo', prNo.manca?.come.includes('MSYS2') && prNo.manca.come.includes('C:\\msys64\\ucrt64\\bin'));

const binSpazi = '/Users/stud/Library/Application Support/Lode/progetti/abc/bin';
const giro = E.daTesto(E.mostraArgv(['/usr/bin/gcc', 'main.c', '-o', binSpazi + '/lab 3'], { bin: binSpazi }), { bin: binSpazi, strumento: { nome: 'gcc', percorso: '/usr/bin/gcc' } });
prova('Cambia: andata e ritorno con spazi nei percorsi', JSON.stringify(giro) === JSON.stringify(['/usr/bin/gcc', 'main.c', '-o', binSpazi + '/lab 3']), giro);
let senzaBat = false; try { E.daTesto('programma-che-non-esiste-123', { bin: '/b' }); } catch (e) { senzaBat = /Non trovo/.test(e.message); }
prova('Cambia: un programma che non c\'è non parte', senzaBat);

/* ---------- sicurezza dei comandi (revisione) ---------- */
// un file del progetto che si chiama come un'opzione («-x.c», «@opz.c») resta un file: ./ davanti
const prMeno = await E.proponi({ nome: 'x', file: ['-x.c', '@opz.c', 'main.c', '-inc/a.h'], leggi: f => f === 'main.c' ? 'int main(void) { return 0; }' : '', bin: '/b', trova: finto, piattaforma: 'darwin' });
const argvMeno = prMeno.passi[0].argv;
prova('proponi: «-x.c» e «@opz.c» passano come ./-x.c e ./@opz.c', argvMeno.includes('./-x.c') && argvMeno.includes('./@opz.c') && !argvMeno.includes('-x.c') && !argvMeno.includes('@opz.c') && argvMeno.includes('-I./-inc') && argvMeno.includes('main.c'), argvMeno);
const prPyMeno = await E.proponi({ nome: 'p', file: ['-c.py'], leggi: () => '', bin: '/b', trova: { ...finto, python: async () => ({ percorso: '/usr/bin/python3', prefisso: [], nome: 'python3', cartelle: [] }) }, piattaforma: 'linux' });
prova('proponi: un .py che sembra un\'opzione resta un file', prPyMeno.programmi[0].argv.at(-1) === './-c.py' && prPyMeno.passi[0].argv.at(-1) === './-c.py', prPyMeno.programmi[0].argv);
const prMsvc = await E.proponi({ nome: 'x', file: ['main.c'], leggi: () => 'int main(void) { return 0; }', bin: '/b', trova: { ...finto, compilatore: async () => ({ percorso: 'C:\\LLVM\\bin\\clang.exe', nome: 'clang', cartelle: [], msvc: true }) }, piattaforma: 'win32' });
prova('proponi: clang per MSVC senza -lm', !prMsvc.passi[0].argv.includes('-lm') && pr.passi[0].argv.includes('-lm'));
const prMake = await E.proponi({ nome: 'x', file: ['Makefile', 'main.c'], leggi: f => f === 'Makefile' ? 'all:\n\tgcc main.c\n' : 'int main(void) { return 0; }', bin: '/b', trova: { ...finto, make: async () => ({ percorso: 'C:\\make\\make.exe', nome: 'make', cartelle: ['C:\\make'] }), compilatore: async () => ({ percorso: 'C:\\msys64\\ucrt64\\bin\\gcc.exe', nome: 'gcc', cartelle: ['C:\\msys64\\ucrt64\\bin'] }) }, piattaforma: 'win32' });
prova('proponi: con un Makefile anche la cartella del compilatore, e l\'avviso su make', prMake.tipo === 'make' && prMake.cartelle.includes('C:\\make') && prMake.cartelle.includes('C:\\msys64\\ucrt64\\bin') && prMake.note.some(n => /leggilo prima/.test(n)), prMake);
prova('proponi: lanciati = i programmi che ricevono prove', JSON.stringify(pr.lanciati) === '["lab3"]' && JSON.stringify(prMeno.lanciati) === '[]');
// quello che si conferma è quello che si vede
let invisibili = 0;
for (const t of ['gcc a.c\r-o x', 'gcc a.c\u2028-o x', 'gcc a\u202Ec.c', 'gcc\u0000 a.c', 'gcc a.c\u2066x']) { try { E.daTesto(t, { bin: '/b', strumento: { nome: 'gcc', percorso: '/usr/bin/gcc' } }); } catch (e) { if (/invisibili/.test(e.message)) invisibili++; } }
prova('Cambia: a capo nascosti, controllo e direzione del testo rifiutati', invisibili === 5, invisibili);
prova('Cambia: il tab vale uno spazio', E.daTesto('gcc\ta.c', { bin: '/b', strumento: { nome: 'gcc', percorso: '/usr/bin/gcc' } }).join('|') === '/usr/bin/gcc|a.c');
prova('finestra: i caratteri invisibili si vedono', E.argvEsatto(['/usr/bin/gcc', 'a\u202Ec.c', 'x\ry']) === '/usr/bin/gcc "a\\u{202E}c.c" "x\\u{D}y"', E.argvEsatto(['/usr/bin/gcc', 'a\u202Ec.c', 'x\ry']));
// Windows: return -1 esce con 4294967295 e non è un crash; 0xC0000005 sì; su Mac e Linux conta il segnale
prova('crash: Windows solo con i codici di sistema', !E.eCrash({ codice: 4294967295 }, 'win32') && E.eCrash({ codice: 3221225477 }, 'win32') && E.eCrash({ codice: -1073741819 }, 'win32') && !E.eCrash({ codice: 3 }, 'win32') && !E.eCrash({ codice: 1 }, 'win32'));
prova('crash: Mac e Linux col segnale, non col codice', E.eCrash({ segnale: 'SIGSEGV' }, 'linux') && !E.eCrash({ codice: 255 }, 'darwin') && !E.eCrash({ segnale: 'SIGKILL', scaduto: true }, 'darwin'));
prova('codice da mostrare: su Windows -1 resta -1', E.codiceDaMostrare(4294967295, 'win32') === -1 && E.codiceDaMostrare(3221225477, 'win32') === 3221225477 && E.codiceDaMostrare(255, 'darwin') === 255);
prova('Windows: anche Embarcadero Dev-C++ tra le cartelle di MinGW', E.cartelleMinGW({ 'ProgramFiles(x86)': 'C:\\PF86', ProgramFiles: 'C:\\PF' }).some(d => /Embarcadero[\\/]Dev-Cpp[\\/]TDM-GCC-64[\\/]bin$/.test(d)));
prova('Windows: make dal pacchetto di MSYS2 che finisce in ucrt64\\bin', E.comeInstallare('make', 'win32').includes('mingw-w64-ucrt-x86_64-make') && E.comeInstallare('python', 'win32').includes('Microsoft Store') && /esci da Lode/.test(E.comeInstallare('c', 'win32')));

/* ---------- la barra: comandi, pillola, html ---------- */
if (vm.SourceTextModule) { let okMod = true; try { new vm.SourceTextModule(readFileSync(new URL('../js/codice/progetto.js', import.meta.url), 'utf8')); } catch { okMod = false; } prova('barra: modulo valido', okMod); }
const I = B.interpreta;
prova('comandi: segui, cosa è cambiato, provato?, compila, smetti', I('Segui progetto')?.azione === 'segui' && I('cosa è cambiato?')?.azione === 'cambiato' && I('Provato?')?.azione === 'provato' && I('compila')?.azione === 'prova' && I('prova il progetto lab3')?.nome === 'lab3' && I('smetti di seguire lab3-liste')?.nome === 'lab3-liste' && !('nome' in I('smetti di seguire il progetto')));
prova('comandi: niente falsi allarmi', I('prova i dati di esempio') === null && I('spiegami il progetto di fisica') === null && I('gioca analisi 2') === null && I('compila la relazione di fisica') === null && I('compila il modulo erasmus') === null);
const adesso = alle(15, 0), base = { id: 'abc', nome: 'lab3-liste', quieteMs: 60e3, impronta: 'i1' };
prova('pillola: mentre cambia', B.lineaPillola({ ...base, ultima: adesso - 10e3, ultimaCodice: adesso - 10e3, piu: 41, meno: 7, nFile: 2 }, adesso)?.testo === 'lab3-liste · 2 file +41 −7');
prova('pillola: fatto, non provato', B.lineaPillola({ ...base, ultima: adesso - 9 * 60e3, ultimaCodice: adesso - 9 * 60e3, piu: 41, meno: 7, nFile: 2 }, adesso)?.testo === 'lab3-liste · fatto · non provato');
prova('pillola: provato', B.lineaPillola({ ...base, ultima: adesso - 9 * 60e3, ultimaCodice: adesso - 9 * 60e3, ultimaProva: { impronta: 'i1', esito: 'ok', quando: alle(14, 53), breve: '✓ compila · 6/6' } }, adesso)?.testo === 'lab3-liste · ✓ compila · 6/6 · 14:53');
prova('pillola: niente dopo 2 ore', B.lineaPillola({ ...base, ultima: adesso - 3 * 3600e3, ultimaCodice: adesso - 3 * 3600e3 }, adesso) === null);
prova('pillola: solo un README cambiato non dice «non provato»', B.lineaPillola({ ...base, ultima: adesso - 9 * 60e3, ultimaCodice: null, piu: 1, nFile: 1 }, adesso) === null);
const hd = B.htmlDiff({ rel: 'a.c', blocchi: [{ righe: [{ t: ' ', s: 'int x;', na: 1, nb: 1 }, { t: '-', s: '<script>', na: 2, nb: null }, { t: '+', s: 'if (a < b) {', na: null, nb: 2 }] }] });
prova('diff html: classi piu/meno e testo protetto', hd.includes('class="r meno"') && hd.includes('class="r piu"') && hd.includes('&lt;script&gt;') && !hd.includes('<script>') && hd.includes('if (a &lt; b) {'));
const he = B.htmlEsito({ nome: 'lab3', quando: alle(14, 53), esito: 'prove', ok: 5, tot: 6, durata: 1200, casi: [{ nome: 'test/03', ok: false, riga: 1, atteso: '3 -> 5 -> NULL', ottenuto: '5 -> 3 -> NULL' }], compilazione: {} });
prova('esito html: «Prova 03 · riga 1: atteso …, ottenuto …»', he.includes('Prova 03 · riga 1: atteso <code>3 -&gt; 5 -&gt; NULL</code>, ottenuto <code>5 -&gt; 3 -&gt; NULL</code>'), he);
prova('md: codice e grassetto, il resto protetto', B.md('**Provato?** No: `a<b>`') === '<b>Provato?</b> No: <code>a&lt;b&gt;</code>');

/* ---------- il motore vero, su una cartella temporanea ---------- */
const radice = mkdtempSync(join(tmpdir(), 'lode-progetto-')), proj = join(radice, 'lab3-liste'), dati = join(radice, 'dati');
mkdirSync(join(proj, 'test'), { recursive: true });
const SBAGLIATO = '#include <stdio.h>\nint main(void) {\n    int a, b;\n    if (scanf("%d %d", &a, &b) != 2) return 1;\n    printf("%d -> %d -> NULL\\n", b, a);\n    return 0;\n}\n';
const GIUSTO = SBAGLIATO.replace('b, a);', 'a, b);');
writeFileSync(join(proj, 'lista.c'), SBAGLIATO);
writeFileSync(join(proj, 'test', '01.in'), '3 5\n'); writeFileSync(join(proj, 'test', '01.out'), '3 -> 5 -> NULL\n');
writeFileSync(join(proj, 'README.md'), '# lab3\n');
const eventi = [];
const conf = { vault: join(radice, 'vault') };
const M = PR.crea({ dir: join(dati, 'progetti'), conf, manda: (canale, x) => eventi.push({ canale, x, t: Date.now() }), vietate: () => ({ vault: conf.vault, userData: dati }),
  quieteMs: 1500, intervalloFatto: 0, attesaMs: 400, tempoCaso: 2000, tempoCompila: 30e3 });
const aspetta = async (cond, ms) => { const fine = Date.now() + ms; while (Date.now() < fine) { const v = cond(); if (v) return v; await new Promise(r => setTimeout(r, 50)); } return null; };
const dopoIl = (canale, da, filtro = () => true) => eventi.find(e => e.canale === canale && e.t >= da && filtro(e.x));
try {
  prova('segui: rifiuta la radice del disco', !!(await M.controlla('/')).errore);
  mkdirSync(join(dati, 'progetti'), { recursive: true });
  prova('segui: rifiuta la cartella di Lode e il vault', /dove Lode tiene/.test((await M.controlla(dati)).errore) && (mkdirSync(join(conf.vault, 'Lezioni'), { recursive: true }), /vault/.test((await M.controlla(join(conf.vault, 'Lezioni'))).errore)));
  const st = await M.segui(proj, { corso: 'Programmazione 1' });
  prova('segui: id, nome, nessuna modifica all\'inizio', /^[0-9a-f]{12}$/.test(st.id) && st.nome === 'lab3-liste' && st.file.length === 0 && st.vecchio, st);
  const id = st.id, i0 = st.impronta;
  prova('segui: le copie stanno nella cartella di Lode, non nel progetto', readdirSync(join(dati, 'progetti', id, 'oggetti')).length === 4 && JSON.stringify(readdirSync(proj).sort()) === JSON.stringify(['README.md', 'lista.c', 'test']));
  await new Promise(r => setTimeout(r, 300));

  // una modifica scritta dallo script → «cambiato» con i +/− giusti entro 3 s
  let t = Date.now();
  writeFileSync(join(proj, 'lista.c'), SBAGLIATO.replace('    return 0;\n', '    puts("fine");\n    return 0;\n'));
  const c1 = await aspetta(() => dopoIl('progetto:cambiato', t, x => x.motivo === 'modifica'), 3000);
  prova('watcher: «cambiato» entro 3 s', !!c1, eventi.map(e => e.canale));
  prova('watcher: +1 −0 su lista.c', c1?.x.file.length === 1 && c1.x.file[0].rel === 'lista.c' && c1.x.piu === 1 && c1.x.meno === 0 && c1.x.vecchio, c1?.x);

  // «fatto» dopo l'attesa (LODE_QUIETE_MS accorciata a 1,5 s)
  const f1 = await aspetta(() => dopoIl('progetto:fatto', t), 5000);
  prova('fatto: arriva dopo il silenzio', !!f1 && f1.t - c1.t >= 1400, f1 && f1.t - c1.t);
  prova('fatto: il riassunto dice cosa e se è provato', f1?.x.punti[0] === '`lista.c`: cambiata `main`.' && f1.x.provatoTesto.startsWith('**Provato?** No') && f1.x.nota === PR.notaChi(), f1?.x.testo);

  // modificare e poi annullare riporta la stessa impronta
  // (scansioni esplicite: senza aspettare il watcher, l'annulla arriva prima del silenzio anche su una macchina carica)
  const prima = (await M.stato(id)).progetti[0].impronta;
  writeFileSync(join(proj, 'lista.c'), 'int rotto(\n'); await M.scansiona(id);
  const inMezzo = (await M.stato(id)).progetti[0].impronta;
  writeFileSync(join(proj, 'lista.c'), SBAGLIATO.replace('    return 0;\n', '    puts("fine");\n    return 0;\n')); await M.scansiona(id);
  prova('annulla: torna la stessa impronta', inMezzo !== prima && (await M.stato(id)).progetti[0].impronta === prima);
  const nFatti = eventi.filter(e => e.canale === 'progetto:fatto').length;
  await new Promise(r => setTimeout(r, 2200));
  prova('annulla: nessun «Fatto» se alla fine non è cambiato niente', eventi.filter(e => e.canale === 'progetto:fatto').length === nFatti);

  // build/ e .git/ non svegliano il watcher; un file oltre 1 MB si salta
  t = Date.now();
  mkdirSync(join(proj, 'build'), { recursive: true }); mkdirSync(join(proj, '.git'), { recursive: true });
  writeFileSync(join(proj, 'build', 'lista.o'), 'x'); writeFileSync(join(proj, 'build', 'nota.c'), 'int x;'); writeFileSync(join(proj, '.git', 'HEAD'), 'ref: x');
  await new Promise(r => setTimeout(r, 1500));
  prova('ignorati: build/ e .git/ non svegliano il watcher', !dopoIl('progetto:cambiato', t, x => x.motivo === 'modifica'));
  t = Date.now(); writeFileSync(join(proj, 'enorme.c'), 'int x;\n'.repeat(200000));
  writeFileSync(join(proj, 'piccolo.txt'), 'ciao\n');
  const c2 = await aspetta(() => dopoIl('progetto:cambiato', t, x => x.motivo === 'modifica'), 3000);
  prova('oltre 1 MB: saltato', c2 && c2.x.file.some(f => f.rel === 'piccolo.txt') && !c2.x.file.some(f => f.rel === 'enorme.c'), c2?.x.file);
  rmSync(join(proj, 'enorme.c')); rmSync(join(proj, 'piccolo.txt'));

  // diff e righe
  const df = await M.diff(id, { rel: 'lista.c' });
  prova('diff: blocchi con +', df.blocchi?.[0]?.righe.some(r => r.t === '+' && r.s.includes('puts("fine")')), df);
  const rg = await M.righe(id, 'lista.c', 2, 3);
  prova('righe: solo dentro il progetto seguito', rg.righe?.length === 2 && rg.righe[0].n === 2 && !!(await M.righe(id, '../fuori.c', 1, 2)).errore && !!(await M.righe(id, '.git/HEAD', 1, 2)).errore, rg);
  const vis = await M.visto(id);
  prova('visto: «Cosa sta cambiando» riparte da qui', vis.file.length === 0 && vis.piu === 0);

  // le prove .in/.out, se c'è un compilatore C
  const cc = await E.trovaCompilatore();
  if (!cc) console.log('(nessun compilatore C: prove di esecuzione saltate)');
  else {
    const senza = await M.prova(id);
    prova('prova: la prima volta serve la conferma', senza.serveConferma && senza.proposta.testo.startsWith(cc.nome + ' -std=c11'), senza);
    const piano = await M.preparaConferma(id);
    prova('conferma: argv costruito nel main, eseguibile nella cartella di Lode', piano.passi?.[0].argv.includes(join(dati, 'progetti', id, 'bin', 'lab3-liste' + (process.platform === 'win32' ? '.exe' : ''))) && piano.dettaglio.includes('< prova.in'), piano.dettaglio);
    prova('conferma: salvata in conf, mai nel vault', M.confermaPiano(id, piano).ok && conf.progetti[id].prova.passi.length === 1);
    let e1 = await M.prova(id);
    prova('prova: ✗ con la prima riga diversa', e1.esito === 'prove' && e1.casi[0].riga === 1 && e1.casi[0].atteso === '3 -> 5 -> NULL' && e1.casi[0].ottenuto === '5 -> 3 -> NULL' && e1.breve === '✗ 1 prova su 1', e1);
    prova('prova: nella cartella del progetto non è comparso niente', !readdirSync(proj).some(f => /lab3|\.o$|\.dSYM/.test(f)));
    t = Date.now(); writeFileSync(join(proj, 'lista.c'), GIUSTO);
    await aspetta(() => dopoIl('progetto:cambiato', t, x => x.motivo === 'modifica'), 3000);
    const e2 = await M.prova(id);
    prova('prova: la correzione dà ✓', e2.esito === 'ok' && e2.ok === 1 && e2.tot === 1 && e2.breve === '✓ compila · 1/1', e2);
    prova('prova: «provato» finché il codice non cambia', !(await M.stato(id)).progetti[0].vecchio);
    // un programma che non finisce: chiuso entro il tempo massimo, e il processo non c'è più
    t = Date.now(); writeFileSync(join(proj, 'lista.c'), '#include <stdio.h>\nint main(void) {\n    puts("parto");\n    fflush(stdout);\n    while (1);\n}\n');
    await aspetta(() => dopoIl('progetto:cambiato', t, x => x.motivo === 'modifica'), 3000);
    const p0 = Date.now(), e3 = await M.prova(id), durata = Date.now() - p0;
    let vivo = false;
    if (process.platform === 'win32') { await new Promise(r => setTimeout(r, 1000)); try { vivo = execFileSync('tasklist', ['/FI', `PID eq ${e3.casi[0].pid}`, '/NH'], { encoding: 'utf8' }).includes(String(e3.casi[0].pid)); } catch { } }
    else try { process.kill(e3.casi[0].pid, 0); vivo = true; } catch { }
    prova('while(1): fermato entro il tempo massimo', e3.esito === 'prove' && e3.casi[0].scaduto && durata < 15000, { esito: e3.esito, durata, caso: e3.casi[0] });
    prova('while(1): nessun processo rimasto', !vivo, e3.casi[0].pid);
    // uno scanf senza .in: si compila soltanto, il programma non parte
    rmSync(join(proj, 'test'), { recursive: true, force: true });
    t = Date.now(); writeFileSync(join(proj, 'lista.c'), '#include <stdio.h>\nint main(void) {\n    int x;\n    if (scanf("%d", &x) != 1) return 1;\n    printf("%d\\n", x);\n    return 0;\n}\n');
    await aspetta(() => dopoIl('progetto:cambiato', t, x => x.motivo === 'modifica'), 3000);
    const p1 = Date.now(), e4 = await M.prova(id);
    prova('scanf senza .in: compilato e mai lanciato', e4.esito === 'ok' && e4.tot === 0 && e4.casi.length === 0 && Date.now() - p1 < 20000, e4);
    // non compila: il primo errore per la pillola
    t = Date.now(); writeFileSync(join(proj, 'lista.c'), 'int main(void) {\n    int x = 1\n    return nodo;\n}\n');
    await aspetta(() => dopoIl('progetto:cambiato', t, x => x.motivo === 'modifica'), 3000);
    const e5 = await M.prova(id);
    prova('non compila: file e riga del primo errore', e5.esito === 'non-compila' && /lista\.c$/.test(e5.primo?.file || '') && e5.primo.riga >= 2 && e5.breve.startsWith('✗ non compila · lista.c:'), e5.breve);
    prova('non compila: le righe cambiate dopo l\'ultima prova riuscita', Array.isArray(e5.dopoRiuscita) && e5.dopoRiuscita[0]?.rel === 'lista.c', e5.dopoRiuscita);
  }
  const sm = M.smetti(id);
  prova('smetti: via la cartella di Lode, il progetto resta', sm.ok && !existsSync(join(dati, 'progetti', id)) && existsSync(join(proj, 'lista.c')) && !conf.progetti[id]);
} catch (e) { ko++; console.log('✗ errore inatteso', e); }
finally { M.chiudi(); try { rmSync(radice, { recursive: true, force: true }); } catch { } }

/* ---------- la conferma vale per quello che la finestra ha mostrato ---------- */
{
  const radice3 = mkdtempSync(join(tmpdir(), 'lode-lancia-')), proj3 = join(radice3, 'es2'), dati3 = join(radice3, 'dati');
  mkdirSync(proj3, { recursive: true });
  writeFileSync(join(proj3, 'main.c'), '#include <stdio.h>\nint main(void) {\n    int x;\n    if (scanf("%d", &x) != 1) return 1;\n    printf("%d\\n", x);\n    return 0;\n}\n');
  const conf3 = {}, gccFinto = { ...finto, compilatore: async () => ({ percorso: join(radice3, 'non-esiste', 'gcc'), nome: 'gcc', cartelle: [] }) };
  const M3 = PR.crea({ dir: join(dati3, 'progetti'), conf: conf3, trova: gccFinto, quieteMs: 60e3, tempoCompila: 5000 });
  try {
    const st3 = await M3.segui(proj3), id3 = st3.id;
    const c0 = await M3.preparaConferma(id3);
    prova('lancia: senza prove la finestra dice che il programma non parte', /non lo lancio/.test(c0.dettaglio) && M3.confermaPiano(id3, c0).ok && JSON.stringify(conf3.progetti[id3].prova.lancia) === '[]');
    const q1 = await M3.prova(id3);
    prova('lancia: confermato «compila soltanto» la prova parte', !q1.serveConferma, q1);
    writeFileSync(join(proj3, '01.in'), '3\n'); writeFileSync(join(proj3, '01.out'), '3\n'); await M3.scansiona(id3);
    const q2 = await M3.prova(id3);
    prova('lancia: arrivano le prove .in/.out → si richiede la conferma prima di lanciare', q2.serveConferma && q2.lancia && !(await M3.rileva(id3)).uguale, q2);
    const c1 = await M3.preparaConferma(id3);
    prova('lancia: la nuova finestra mostra il programma con la prova', c1.dettaglio.includes('< prova.in') && M3.confermaPiano(id3, c1).ok && JSON.stringify(conf3.progetti[id3].prova.lancia) === '["es2"]');
    prova('lancia: confermato, la prova parte', !(await M3.prova(id3)).serveConferma);
    // anche il comando scritto a mano («Cambia»): confermato senza prove, non lancia niente che non abbia mostrato
    rmSync(join(proj3, '01.in')); rmSync(join(proj3, '01.out')); await M3.scansiona(id3);
    const c2 = await M3.preparaConferma(id3, 'gcc main.c -o ‹cartella di Lode›/es2');
    prova('lancia: Cambia senza prove', !c2.errore && c2.manuale && M3.confermaPiano(id3, c2).ok && conf3.progetti[id3].prova.manuale, c2.errore);
    writeFileSync(join(proj3, '01.in'), '3\n'); writeFileSync(join(proj3, '01.out'), '3\n'); await M3.scansiona(id3);
    const q3 = await M3.prova(id3);
    prova('lancia: Cambia confermato senza prove, poi arrivano le prove → si richiede', q3.serveConferma && q3.lancia, q3);
  } catch (e) { ko++; console.log('✗ lancia: errore inatteso', e); }
  finally { M3.chiudi(); try { rmSync(radice3, { recursive: true, force: true }); } catch { } }
}

/* ---------- smetti mentre parte: la cartella di Lode non si ricrea ---------- */
{
  const radice4 = mkdtempSync(join(tmpdir(), 'lode-smetti-')), proj4 = join(radice4, 'es3'), dati4 = join(radice4, 'dati');
  mkdirSync(proj4, { recursive: true }); writeFileSync(join(proj4, 'main.c'), 'int main(void) { return 0; }\n');
  const conf4 = {}, M4 = PR.crea({ dir: join(dati4, 'progetti'), conf: conf4, trova: finto, quieteMs: 60e3 });
  try {
    const parte = M4.segui(proj4);   // non si aspetta: «smetti» arriva mentre avvia() sta leggendo
    const id4 = Object.keys(conf4.progetti || {})[0] || (await new Promise(r => setTimeout(r, 0)), Object.keys(conf4.progetti || {})[0]);
    if (id4) M4.smetti(id4);
    await parte; await new Promise(r => setTimeout(r, 1200));
    prova('smetti durante l\'avvio: niente tappe.json ricreato', !id4 || !existsSync(join(dati4, 'progetti', id4, 'tappe.json')), id4);
  } catch (e) { ko++; console.log('✗ smetti: errore inatteso', e); }
  finally { M4.chiudi(); try { rmSync(radice4, { recursive: true, force: true }); } catch { } }
}

/* ---------- registra(): gli handler IPC con ipcMain, dialog e app finti ---------- */
{
  const radice2 = mkdtempSync(join(tmpdir(), 'lode-ipc-')), proj2 = join(radice2, 'es1'), dati2 = join(radice2, 'dati');
  mkdirSync(proj2, { recursive: true }); writeFileSync(join(proj2, 'main.c'), '#include <stdio.h>\nint main(void) { puts("ciao"); return 0; }\n');
  const h = {}, finestre = [], mandati = [], conf2 = { vault: join(radice2, 'vault') };
  let risposta = 1, salvata = 0, lenta = 0;
  const ipcMain = { handle: (c, f) => { h[c] = f; } };
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [proj2] }), showMessageBox: async o => { finestre.push(o); if (lenta) await new Promise(r => setTimeout(r, lenta)); return { response: risposta }; } };
  const app = { getPath: () => dati2 };
  const M2 = PR.registra({ ipcMain, dialog, app, conf: () => conf2, salvaConf: () => { salvata++; }, manda: (c, x) => mandati.push(c), env: {} });
  const chiama = (c, x) => h[c]({}, x);
  try {
    const canali = ['progetto:scegli', 'progetto:segui', 'progetto:smetti', 'progetto:stato', 'progetto:diff', 'progetto:righe', 'progetto:rileva', 'progetto:conferma', 'progetto:prova', 'progetto:visto'];
    prova('registra: tutti i canali progetto:*', canali.every(c => typeof h[c] === 'function'), Object.keys(h));
    const sc = await chiama('progetto:scegli');
    prova('scegli: il percorso resta nel main, la barra riceve un token', /^[0-9a-f]{24}$/.test(sc.token) && sc.nome === 'es1');
    prova('segui: un token inventato non segue niente', !!(await chiama('progetto:segui', { token: 'finto' })).errore);
    const sg = await chiama('progetto:segui', { token: sc.token, corso: 'Programmazione 1', valutato: true });
    prova('segui: via token, corso e valutato in conf', sg.id && conf2.progetti[sg.id].corso === 'Programmazione 1' && conf2.progetti[sg.id].valutato && salvata > 0, sg);
    prova('stato: elenco dei progetti', (await chiama('progetto:stato')).progetti?.length === 1 && !!(await chiama('progetto:stato', { id: 'zzz' })).errore);
    prova('prova: senza conferma non parte niente', (await chiama('progetto:prova', { id: sg.id })).serveConferma === true && !finestre.length);
    const cc2 = await E.trovaCompilatore();
    if (cc2) {
      const no = await chiama('progetto:conferma', { id: sg.id });
      prova('conferma: la finestra di sistema mostra l\'argv esatto; «Annulla» non salva', no.annullato && finestre[0]?.message === 'Lode eseguirà questo comando nella cartella es1.' && finestre[0].detail.includes(cc2.percorso) && finestre[0].buttons[0] === 'Esegui sempre per questo progetto' && !conf2.progetti[sg.id].prova, finestre[0]);
      prova('conferma: Invio sceglie «Annulla»', finestre[0].defaultId === 1 && finestre[0].cancelId === 1);
      lenta = 300;
      const [uno, due] = await Promise.all([chiama('progetto:conferma', { id: sg.id }), chiama('progetto:conferma', { id: sg.id })]);
      lenta = 0;
      prova('conferma: una finestra alla volta', uno.annullato && /già una finestra/.test(due.errore || '') && finestre.length === 2, [uno, due]);
      risposta = 0;
      const si = await chiama('progetto:conferma', { id: sg.id, testo: `${cc2.nome} -std=c11 main.c -o ‹cartella di Lode›/es1` });
      prova('conferma: «Cambia» → argv nel main, salvato solo dopo il sì', si.ok && conf2.progetti[sg.id].prova.manuale && finestre[2].detail.includes(join(dati2, 'progetti', sg.id, 'bin', 'es1')),
        { si, manuale: conf2.progetti[sg.id]?.prova?.manuale, dettaglio: finestre[2]?.detail, atteso: join(dati2, 'progetti', sg.id, 'bin', 'es1') });
      const es = await chiama('progetto:prova', { id: sg.id });
      prova('prova via IPC: esito e eventi', es.esito === 'ok' && mandati.includes('progetto:esito'), es.esito);
    }
    prova('smetti via IPC', (await chiama('progetto:smetti', { id: sg.id })).ok && !conf2.progetti[sg.id]);
  } catch (e) { ko++; console.log('✗ registra: errore inatteso', e); }
  finally { M2.chiudi(); try { rmSync(radice2, { recursive: true, force: true }); } catch { } }
}

console.log(`${ok} prove passate, ${ko} fallite (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(ko ? 1 : 0);
