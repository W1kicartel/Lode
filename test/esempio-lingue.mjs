// I dati di esempio nelle sei lingue: node test/esempio-lingue.mjs
// 1) in italiano esempio() dà ESATTAMENTE i dati di sempre (Giulia, Analisi 2…: l'istantanea qui sotto, presa prima delle lingue);
// 2) in ogni lingua esempio() passa backupValido(), ha la forma dell'italiano e voti validi e sufficienti nel sistema dei voti del
//    paese (en → uk, es → es, fr → fr, de → de, pt → br); 3) togliEsempio() (il benvenuto) toglie i dati di esempio di tutte le
//    lingue e lascia quelli dello studente; 4) «Cosa stampa?»: le parole stampate dai programmi seguono la lingua della barra e
//    la frase «Hai scritto…» viene dallo stesso mutante della frase «Hai scelto…».
import { readFileSync } from 'node:fs';
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const Dati = await import('../js/dati.js');
const S = await import('../js/sistemi.js');
const L = await import('../js/lingua.js');
const M = await import('../js/codice/modelli.js');
const St = await import('../js/codice/stampa.js');

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const uguale = (nome, a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); prova(nome, x === y, `\n   ${x}\n ≠ ${y}`); };
const LINGUE = Object.keys(L.LINGUE);
const SISTEMA = { it: 'it', en: 'uk', es: 'es', fr: 'fr', de: 'de', pt: 'br' };
const CAT = Object.fromEntries(await Promise.all(LINGUE.map(async c => [c, (await import(`../js/lingue/${c}/esempio.js`)).default])));

/* ---------- 1. italiano: i dati di sempre ---------- */
// id → #n nell'ordine in cui compaiono, date → giorni da oggi, inizio delle sessioni → ore dalle 10 di oggi, giorni dell'orario a parte
function forma(d) {
  const ids = new Map(), T = Dati.oggi(), ora = new Date(); ora.setHours(10, 0, 0, 0);
  const f = (x, k) => {
    if (Array.isArray(x)) return k === 'giorni' ? '*' : x.map(y => f(y));
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, f(v, k)]));
    if (typeof x === 'string' && (k === 'id' || k === 'esameId')) { if (!ids.has(x)) ids.set(x, '#' + ids.size); return ids.get(x); }
    if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) return 'g' + Dati.giorniTra(T, x);
    if (k === 'creata') return 0;
    if (k === 'inizio' && typeof x === 'number') return (x - ora.getTime()) / 36e5;
    return x;
  };
  return f({ ...d, imp: undefined });
}
// l'istantanea dei dati italiani, presa da js/dati.js prima delle lingue (ef9921f)
const PRIMA = JSON.parse(String.raw`{"v":1,"profilo":{"nome":"Giulia","corso":"Ingegneria informatica","cfuTotali":180,"lode":30},"esami":[{"id":"#0","nome":"Analisi 1","cfu":9,"voto":27,"lode":false,"idoneita":false,"fatto":true,"data":"g-300","oreObiettivo":null},{"id":"#1","nome":"Fondamenti di informatica","cfu":9,"voto":30,"lode":true,"idoneita":false,"fatto":true,"data":"g-290","oreObiettivo":null},{"id":"#2","nome":"Geometria e algebra lineare","cfu":6,"voto":24,"lode":false,"idoneita":false,"fatto":true,"data":"g-250","oreObiettivo":null},{"id":"#3","nome":"Fisica 1","cfu":9,"voto":26,"lode":false,"idoneita":false,"fatto":true,"data":"g-160","oreObiettivo":null},{"id":"#4","nome":"Lingua inglese B2","cfu":3,"voto":null,"lode":false,"idoneita":true,"fatto":true,"data":"g-150","oreObiettivo":null},{"id":"#5","nome":"Programmazione a oggetti","cfu":6,"voto":29,"lode":false,"idoneita":false,"fatto":true,"data":"g-140","oreObiettivo":null},{"id":"#6","nome":"Analisi 2","cfu":9,"data":"g12","voto":null,"lode":false,"idoneita":false,"fatto":false,"oreObiettivo":90},{"id":"#7","nome":"Basi di dati","cfu":9,"data":"g26","voto":null,"lode":false,"idoneita":false,"fatto":false,"oreObiettivo":null},{"id":"#8","nome":"Fisica 2","cfu":6,"data":"g41","voto":null,"lode":false,"idoneita":false,"fatto":false,"oreObiettivo":null}],"sessioni":[{"id":"#9","esameId":"#6","inizio":-144,"min":50},{"id":"#10","esameId":"#6","inizio":-120,"min":75},{"id":"#11","esameId":"#6","inizio":-72,"min":100},{"id":"#12","esameId":"#6","inizio":-48,"min":50},{"id":"#13","esameId":"#6","inizio":-24,"min":125},{"id":"#14","esameId":"#6","inizio":0,"min":25},{"id":"#15","esameId":"#7","inizio":-138,"min":25},{"id":"#16","esameId":"#7","inizio":-90,"min":50},{"id":"#17","esameId":"#7","inizio":-42,"min":25},{"id":"#18","esameId":"#6","inizio":-192,"min":100},{"id":"#19","esameId":"#6","inizio":-216,"min":100},{"id":"#20","esameId":"#6","inizio":-240,"min":100},{"id":"#21","esameId":"#6","inizio":-264,"min":100},{"id":"#22","esameId":"#6","inizio":-288,"min":100},{"id":"#23","esameId":"#6","inizio":-312,"min":100},{"id":"#24","esameId":"#6","inizio":-336,"min":100},{"id":"#25","esameId":"#6","inizio":-360,"min":100},{"id":"#26","esameId":"#6","inizio":-384,"min":100},{"id":"#27","esameId":"#6","inizio":-408,"min":100},{"id":"#28","esameId":"#6","inizio":-432,"min":100},{"id":"#29","esameId":"#6","inizio":-456,"min":100},{"id":"#30","esameId":"#6","inizio":-480,"min":100},{"id":"#31","esameId":"#6","inizio":-504,"min":100},{"id":"#32","esameId":"#6","inizio":-528,"min":100},{"id":"#33","esameId":"#6","inizio":-552,"min":100},{"id":"#34","esameId":"#6","inizio":-576,"min":100},{"id":"#35","esameId":"#6","inizio":-600,"min":100}],"carte":[{"id":"#36","esameId":"#6","fronte":"Che cos'è il gradiente di f(x, y)?","retro":"Il vettore delle derivate parziali (∂f/∂x, ∂f/∂y): punta nella direzione di massima crescita.","ease":2.5,"int":0,"rip":0,"scad":"g0","creata":0},{"id":"#37","esameId":"#6","fronte":"Enuncia il teorema di Schwarz","retro":"Se le derivate seconde miste sono continue in un intorno, allora f_xy = f_yx.","ease":2.5,"int":0,"rip":0,"scad":"g0","creata":0},{"id":"#38","esameId":"#6","fronte":"Condizione per un punto stazionario","retro":"Il gradiente si annulla: ∇f(x₀) = 0.","ease":2.5,"int":0,"rip":0,"scad":"g0","creata":0},{"id":"#39","esameId":"#6","fronte":"Come si classifica un punto stazionario?","retro":"Con la matrice hessiana: definita positiva → minimo, definita negativa → massimo, indefinita → sella.","ease":2.5,"int":0,"rip":0,"scad":"g0","creata":0},{"id":"#40","esameId":"#6","fronte":"Che cos'è un integrale doppio su un dominio normale?","retro":"Un integrale iterato: prima sulla variabile «interna» con estremi funzione dell'altra, poi sull'altra.","ease":2.5,"int":0,"rip":0,"scad":"g0","creata":0},{"id":"#41","esameId":"#6","fronte":"Teorema di Green: enunciato","retro":"L'integrale di linea su ∂D di P dx + Q dy è uguale all'integrale doppio su D di (∂Q/∂x − ∂P/∂y).","ease":2.5,"int":0,"rip":0,"scad":"g0","creata":0},{"id":"#42","esameId":"#6","fronte":"Forma differenziale esatta: definizione","retro":"ω è esatta se esiste una funzione U (potenziale) con dU = ω.","ease":2.5,"int":1,"rip":2,"scad":"g1","creata":0},{"id":"#43","esameId":"#6","fronte":"Serie geometrica: quando converge?","retro":"Per |q| < 1, con somma 1/(1 − q).","ease":2.5,"int":3,"rip":2,"scad":"g3","creata":0},{"id":"#44","esameId":"#7","fronte":"Che cos'è una chiave primaria?","retro":"Un insieme minimo di attributi che identifica in modo univoco ogni tupla di una relazione.","ease":2.5,"int":0,"rip":0,"scad":"g0","creata":0},{"id":"#45","esameId":"#7","fronte":"Differenza tra LEFT JOIN e INNER JOIN","retro":"La LEFT JOIN tiene tutte le righe della tabella di sinistra, anche senza corrispondenze (con NULL); la INNER solo le coppie che combaciano.","ease":2.5,"int":0,"rip":0,"scad":"g0","creata":0},{"id":"#46","esameId":"#7","fronte":"Che cosa garantisce la 3ª forma normale?","retro":"Che ogni attributo non chiave dipenda dalla chiave, da tutta la chiave e da nient'altro che la chiave (niente dipendenze transitive).","ease":2.5,"int":2,"rip":2,"scad":"g2","creata":0}],"orario":[{"id":"#47","corso":"Analisi 2","giorni":"*","inizio":"09:00","fine":"11:00","aula":"7"},{"id":"#48","corso":"Basi di dati","giorni":"*","inizio":"14:00","fine":"16:00","aula":"B2"},{"id":"#49","corso":"Fisica 2","giorni":"*","inizio":"11:00","fine":"13:00","aula":"Magna"}],"lezioni":[{"id":"#50","corso":"Analisi 2","data":"g0","inizio":"09:00","fine":"11:00","aula":"7","domande":["Perché nel teorema di Schwarz serve la continuità delle derivate miste?"],"stelle":["Il teorema di Green all'esame lo chiede sempre, con la dimostrazione","Classificare i punti stazionari con l'hessiana: esercizio sicuro"],"definizioni":[{"t":"Gradiente","d":"Il vettore delle derivate parziali di f: punta nella direzione di massima crescita."},{"t":"Punto stazionario","d":"Un punto in cui il gradiente della funzione si annulla."},{"t":"Matrice hessiana","d":"La matrice quadrata delle derivate seconde parziali di una funzione."},{"t":"Punto di sella","d":"Un punto stazionario che non è né di massimo né di minimo locale: l'hessiana è indefinita."},{"t":"Teorema di Green","d":"Lega l'integrale di linea lungo il bordo di un dominio all'integrale doppio sul dominio."},{"t":"Forma differenziale esatta","d":"Una forma che ammette un potenziale, cioè è il differenziale di una funzione."}]},{"id":"#51","corso":"Basi di dati","data":"g-1","inizio":"14:00","fine":"16:00","aula":"B2","domande":[],"stelle":["Normalizzazione fino alla BCNF: c'è sempre nello scritto"],"definizioni":[{"t":"Chiave primaria","d":"Un insieme minimo di attributi che identifica in modo univoco ogni tupla."},{"t":"Chiave esterna","d":"Un attributo che fa riferimento alla chiave primaria di un'altra relazione."},{"t":"Dipendenza funzionale","d":"Un vincolo per cui il valore di un insieme di attributi determina quello di un altro."},{"t":"Forma normale di Boyce-Codd","d":"Ogni dipendenza funzionale non banale ha a sinistra una superchiave."}]}],"memoria":{},"codice":{"memoria":{},"errori":{},"eventi":[],"diari":{},"opzioni":{},"turni":[],"spiegate":{}},"benvenuto":true,"esempio":true}`);
const it = Dati.esempio();
prova('in node la lingua è l\'italiano', L.lingua === 'it');
uguale('italiano: esempio() identico a prima delle lingue', forma(it), PRIMA);
uguale('italiano: esempio() = esempio(\'it\')', forma(it), forma(Dati.esempio('it')));
const dow = new Date(Dati.oggi() + 'T12:00').getDay();
uguale('italiano: i giorni dell\'orario come prima', it.orario.map(o => o.giorni), [[...new Set([1, 3, dow])].sort(), [...new Set([2, (dow + 6) % 7])].sort(), [5]]);
prova('italiano: niente sistema nel profilo (resta quello di sempre)', !('sistema' in it.profilo));
prova('una lingua sconosciuta dà l\'italiano', JSON.stringify(forma(Dati.esempio('xx'))) === JSON.stringify(forma(it)));

/* ---------- 2. ogni lingua ---------- */
const N = Dati.norm;
for (const cod of LINGUE) {
  const X = CAT[cod], d = Dati.esempio(cod), sis = SISTEMA[cod], P = Dati.PAESI_ESEMPIO[cod];
  prova(`${cod}: backupValido()`, Dati.backupValido(d));
  prova(`${cod}: backupValido() anche dopo JSON (come un backup esportato)`, Dati.backupValido(JSON.parse(JSON.stringify(d))));
  prova(`${cod}: il sistema del paese`, P.sistema === sis && (d.profilo.sistema || 'it') === sis, `${d.profilo.sistema}`);
  prova(`${cod}: il predefinito di sistemi.js è lo stesso (salvo pt: Brasile)`, cod === 'pt' || S.predefinito(cod) === sis, S.predefinito(cod));
  prova(`${cod}: crediti totali del sistema`, d.profilo.cfuTotali === S.SISTEMI[sis].totali, `${d.profilo.cfuTotali}`);
  prova(`${cod}: studente e corso della lingua`, d.profilo.nome === X['esempio.nome'] && d.profilo.corso === X['esempio.corso'] && !!d.profilo.nome.trim() && !!d.profilo.corso.trim());
  prova(`${cod}: il segno dei dati di esempio`, d.esempio === true && d.benvenuto === true);
  prova(`${cod}: 9 esami, 6 fatti e 3 da fare`, d.esami.length === 9 && d.esami.filter(e => e.fatto).length === 6 && d.esami.slice(6).every(e => !e.fatto && e.data > Dati.oggi()));
  uguale(`${cod}: i nomi degli esami del catalogo`, d.esami.map(e => e.nome), X['esempio.esami']);
  prova(`${cod}: nomi degli esami tutti diversi`, new Set(d.esami.map(e => N(e.nome))).size === 9);
  const conVoto = d.esami.filter(e => e.voto != null);
  prova(`${cod}: 5 voti e un'idoneità`, conVoto.length === 5 && d.esami.filter(e => e.idoneita).length === 1 && d.esami[4].idoneita && d.esami[4].fatto);
  for (const e of conVoto) {
    prova(`${cod}: voto ${e.voto} di «${e.nome}» valido in ${sis}`, S.valido(e.voto, sis));
    prova(`${cod}: voto ${e.voto} di «${e.nome}» sufficiente in ${sis}`, S.superato(e.voto, sis));
  }
  prova(`${cod}: la lode solo in Italia`, d.esami.filter(e => e.lode).length === (cod === 'it' ? 1 : 0));
  prova(`${cod}: crediti interi e positivi`, d.esami.every(e => Number.isInteger(e.cfu) && e.cfu > 0));
  const m = S.media(d.esami.filter(e => e.fatto), { sistema: sis, lode: d.profilo.lode });
  const Z = S.SISTEMI[sis], pond = m.ponderata;
  prova(`${cod}: la media nel sistema ha senso`, m.n === 5 && pond >= Z.min && pond <= Z.max && (Z.migliore === 'basso' ? pond <= Z.sufficienza : pond >= Z.sufficienza), JSON.stringify(m));
  // carte, orario, lezioni: stessa forma dell'italiano, testi della lingua
  prova(`${cod}: 11 carte (8 del primo esame da fare, 3 del secondo)`, d.carte.length === 11 && d.carte.filter(c => c.esameId === d.esami[6].id).length === 8 && d.carte.filter(c => c.esameId === d.esami[7].id).length === 3);
  prova(`${cod}: carte con fronte e retro`, d.carte.every(c => c.fronte.trim() && c.retro.trim() && c.fronte !== c.retro));
  prova(`${cod}: carte da ripassare oggi come in italiano`, d.carte.filter(c => c.scad <= Dati.oggi()).length === it.carte.filter(c => c.scad <= Dati.oggi()).length);
  uguale(`${cod}: l'orario sugli esami da fare`, d.orario.map(o => o.corso), X['esempio.esami'].slice(6));
  prova(`${cod}: aule della lingua`, d.orario.every((o, k) => o.aula === X['esempio.aule'][k] && o.aula.trim()));
  uguale(`${cod}: orari come in italiano`, d.orario.map(o => [o.giorni, o.inizio, o.fine]), it.orario.map(o => [o.giorni, o.inizio, o.fine]));
  prova(`${cod}: due lezioni (oggi e ieri) sui primi due esami da fare`, d.lezioni.length === 2 && d.lezioni[0].corso === d.esami[6].nome && d.lezioni[1].corso === d.esami[7].nome && d.lezioni[0].data === Dati.oggi());
  prova(`${cod}: 6 + 4 definizioni`, d.lezioni[0].definizioni.length === 6 && d.lezioni[1].definizioni.length === 4 && d.lezioni.every(l => l.definizioni.every(x => x.t.trim() && x.d.trim())));
  // come in italiano, la prima stella nomina una definizione («Teorema di Green»), e nessun'altra definizione è «da esame»
  const daEsame = l => l.definizioni.filter(x => l.stelle.some(s => N(s).includes(N(x.t)))).map(x => x.t);
  uguale(`${cod}: una sola definizione «da esame», la quinta (come in italiano)`, daEsame(d.lezioni[0]), [d.lezioni[0].definizioni[4].t]);
  uguale(`${cod}: nessuna definizione «da esame» nella seconda lezione`, daEsame(d.lezioni[1]), []);
  prova(`${cod}: domande e stelle`, d.lezioni[0].domande.length === 1 && d.lezioni[0].stelle.length === 2 && d.lezioni[1].stelle.length === 1);
  prova(`${cod}: sessioni come in italiano`, d.sessioni.length === it.sessioni.length && d.sessioni.every(s => s.esameId === d.esami[6].id || s.esameId === d.esami[7].id));
  prova(`${cod}: i dati restano tutti in caratteri stampabili`, !/[\u0000-\u0008\u000b-\u001f]/.test(JSON.stringify(d)));
  // nella barra della lingua: esempio() senza argomento segue la lingua scelta
  await L.usa(cod);
  prova(`${cod}: esempio() senza lingua segue la barra`, Dati.esempio().profilo.nome === X['esempio.nome']);
  await L.usa('it');
}
prova('i nomi degli studenti di esempio sono tutti diversi', new Set(LINGUE.map(c => CAT[c]['esempio.nome'])).size === LINGUE.length);

/* ---------- 3. togliere i dati di esempio ---------- */
uguale('NOMI_ESEMPIO: gli esami di tutte le lingue', [...Dati.NOMI_ESEMPIO].sort(), [...new Set(LINGUE.flatMap(c => CAT[c]['esempio.esami']))].sort());
uguale('STUDENTI_ESEMPIO: gli studenti di tutte le lingue', [...Dati.STUDENTI_ESEMPIO].sort(), LINGUE.map(c => CAT[c]['esempio.nome']).sort());
prova('NOMI_ESEMPIO: tutti quelli italiani di prima', ['Analisi 1', 'Fondamenti di informatica', 'Geometria e algebra lineare', 'Fisica 1', 'Lingua inglese B2', 'Programmazione a oggetti', 'Analisi 2', 'Basi di dati', 'Fisica 2'].every(n => Dati.NOMI_ESEMPIO.includes(n)));
for (const cod of LINGUE) {
  // i dati di esempio di questa lingua, più quello che ha aggiunto lo studente (magari dopo aver cambiato lingua)
  const d = Dati.esempio(cod);
  const vero = { id: 'vero1', nome: 'Sistemi operativi', cfu: 9, data: null, voto: null, lode: false, idoneita: false, fatto: false, oreObiettivo: null };
  d.esami.push(vero);
  d.carte.push({ id: 'cartavera', esameId: 'vero1', fronte: 'Che cos\'è un semaforo?', retro: 'Un contatore con attesa.', ease: 2.5, int: 0, rip: 0, scad: Dati.oggi(), creata: 1 });
  d.sessioni.push({ id: 'sessvera', esameId: 'vero1', inizio: Date.now(), min: 30 }, { id: 'sesslibera', esameId: null, inizio: Date.now(), min: 20 });
  d.orario.push({ id: 'orvero', corso: 'Sistemi operativi', giorni: [4], inizio: '16:00', fine: '18:00', aula: 'C' });
  d.memoria = { 'x|y': { giuste: 1 } };
  const sis = d.profilo.sistema, tot = d.profilo.cfuTotali;
  Dati.togliEsempio(d);
  uguale(`${cod}: restano solo gli esami dello studente`, d.esami.map(e => e.id), ['vero1']);
  uguale(`${cod}: restano solo le carte dello studente`, d.carte.map(c => c.id), ['cartavera']);
  uguale(`${cod}: restano solo le sessioni dello studente`, d.sessioni.map(s => s.id).sort(), ['sessvera', 'sesslibera'].sort());
  uguale(`${cod}: resta solo l'orario dello studente`, d.orario.map(o => o.id), ['orvero']);
  prova(`${cod}: via lezioni, memoria e segno`, !d.lezioni.length && !Object.keys(d.memoria).length && !('esempio' in d));
  prova(`${cod}: il profilo torna vuoto (restano crediti e sistema)`, d.profilo.nome === '' && d.profilo.corso === '' && d.profilo.cfuTotali === tot && d.profilo.sistema === (sis ?? Dati.VUOTO().profilo.sistema));   // in italiano l'esempio non ha il sistema: resta quello di VUOTO ('it')
  prova(`${cod}: dopo, i dati sono ancora validi`, Dati.backupValido(d));
}
// i dati di esempio di una Lode di prima (senza il segno d.esempio): il benvenuto li riconosce dallo studente e dai nomi
const ben = readFileSync(new URL('../js/benvenuto.js', import.meta.url), 'utf8');
prova('benvenuto: niente nomi di esempio scritti a mano', !/'Giulia'|'Analisi 1'/.test(ben) && /S\.esempio = eEsempio\(D\)/.test(ben) && /S\.nome = nomeVero\(D\)/.test(ben) && /togliEsempio\(D\)/.test(ben));
// eEsempio(): il segno basta in ogni lingua; senza il segno solo «Giulia» con un esame di esempio italiano (una Lode di prima).
// Emily con «Databases», Lena con «Physik 1»… senza il segno sono studenti veri: la casella non si spunta da sola
for (const cod of LINGUE) {
  const d = Dati.esempio(cod);
  prova(`${cod}: eEsempio col segno`, Dati.eEsempio(d));
  delete d.esempio;
  prova(`${cod}: eEsempio senza segno solo per Giulia`, Dati.eEsempio(d) === (cod === 'it'));
  prova(`${cod}: nomeVero senza segno`, Dati.nomeVero(d) === (cod === 'it' ? '' : CAT[cod]['esempio.nome']));
  d.esempio = true;
  prova(`${cod}: nomeVero col segno`, Dati.nomeVero(d) === '');
}
const vero = { esami: [{ id: 'abcdefgh12', nome: 'Analisi 1' }], profilo: { nome: 'Marco' } };
prova('eEsempio: Marco con «Analisi 1» è vero', !Dati.eEsempio(vero) && Dati.nomeVero(vero) === 'Marco');
prova('eEsempio: Giulia con «Analisi 1» (Lode di prima)', Dati.eEsempio({ ...vero, profilo: { nome: 'Giulia' } }) && Dati.nomeVero({ ...vero, profilo: { nome: 'Giulia' } }) === '');
prova('eEsempio: Giulia con «Databases» senza segno è vera', !Dati.eEsempio({ esami: [{ id: 'abcdefgh12', nome: 'Databases' }], profilo: { nome: 'Giulia' } }));
prova('eEsempio: dati vecchi senza profilo né esami', !Dati.eEsempio({}) && Dati.nomeVero({}) === '');
prova('benvenuto: «vault:pulisciCorsi» con i nomi di tutte le lingue', /vault:pulisciCorsi', \{ nomi: NOMI_ESEMPIO \}/.test(ben));

/* ---------- 4. «Cosa stampa?» nella lingua della barra ---------- */
const SEMI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
// in italiano la frase scritta è quella di prima: «Hai scelto» → «Hai scritto»
let frasi = 0;
for (const m of M.MODELLI) for (const pl of m.lingue) for (const seme of SEMI.slice(0, 4)) {
  const ist = M.istanza(m, seme, { lingua: pl }); if (!ist) continue;
  for (const d of ist.distrattori) {
    frasi++;
    if (d.scritta !== d.frase.replace(/^Hai scelto/, 'Hai scritto')) prova(`it: frase scritta di ${m.id}/${pl}/${seme}`, false, `${d.scritta} ≠ ${d.frase}`);
    const r = St.valuta(ist, { testo: d.uscita });
    if (r.ok || r.frase !== d.scritta) prova(`it: valuta scritta ${m.id}/${pl}/${seme}`, false, r.frase);
  }
}
prova('it: frasi scritte controllate', frasi > 200, `${frasi}`);
for (const cod of LINGUE) {
  await L.usa(cod);
  const X = CAT[cod], parole = X['esempio.switch-parole'], altro = X['esempio.switch-altro'];
  for (const pl of M.modello('switch').lingue) for (const seme of SEMI) {
    const ist = M.istanza('switch', seme, { lingua: pl });
    const usate = M.compatta(ist.giusta).split(' ').filter(Boolean);
    prova(`${cod}: switch ${pl}/${seme} stampa le parole della lingua`, usate.length > 0 && usate.every(w => parole.includes(w) || w === altro), ist.giusta);
    prova(`${cod}: switch ${pl}/${seme} le parole sono nel codice`, usate.every(w => ist.codice.includes(`"${w} "`)), ist.codice);
    for (const d of ist.distrattori) prova(`${cod}: switch ${pl}/${seme} distrattori nella lingua`, M.compatta(d.uscita).split(' ').filter(Boolean).every(w => parole.includes(w) || w === altro), d.uscita);
  }
  for (const pl of M.modello('cortocircuito').lingue) for (const seme of SEMI) {
    const ist = M.istanza('cortocircuito', seme, { lingua: pl });
    const [w, n] = M.compatta(ist.giusta).split(' ');
    prova(`${cod}: if ${pl}/${seme} stampa ${X['esempio.si']}/${X['esempio.no']}`, (w === X['esempio.si'] || w === X['esempio.no']) && /^\d+$/.test(n), ist.giusta);
  }
  // la frase scritta e quella scelta vengono dallo stesso mutante: cambia solo l'inizio
  for (const id of ['for-minore', 'switch', 'cortocircuito', 'swap-valore']) for (const seme of SEMI.slice(0, 4)) {
    const ist = M.istanza(id, seme, { lingua: 'c' });
    for (const d of ist.distrattori) {
      const sc = L.t('modelli.hai-scelto', { s: M.inLinea(d.uscita) }), sr = L.t('esempio.hai-scritto', { s: M.inLinea(d.uscita) });
      prova(`${cod}: ${id}/${seme} frase scelta e frase scritta`, d.frase.startsWith(sc) && d.scritta.startsWith(sr) && d.frase.slice(sc.length) === d.scritta.slice(sr.length), `${d.frase} | ${d.scritta}`);
      const r = St.valuta(ist, { testo: d.uscita }), k = ist.opzioni.findIndex(o => o.uscita === d.uscita);
      prova(`${cod}: ${id}/${seme} valuta scritta`, !r.ok && r.frase === d.scritta && r.mutante === d.mutante);
      if (k >= 0) prova(`${cod}: ${id}/${seme} valuta scelta`, St.valuta(ist, { indice: k }).frase === d.frase);
    }
    prova(`${cod}: ${id}/${seme} la giusta è giusta`, St.valuta(ist, { testo: ist.giusta }).ok);
  }
}
await L.usa('it');
prova('di nuovo in italiano: «uno due…»', M.compatta(M.istanza('switch', 1).giusta).split(' ').every(w => ['uno', 'due', 'tre', 'quattro', 'altro'].includes(w)));

console.log(`esempio-lingue: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
