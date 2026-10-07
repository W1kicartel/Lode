// «Cose nuove»: le funzioni della libreria standard che le righe aggiunte di un turno portano in un file dove prima non c'erano
// (dell'agente o tue), con la domanda che ti farebbero all'orale. Niente AI: un dizionario fisso scritto a mano, C99/C11,
// Java 17 e Python 3. La risposta la scrive il dizionario; Lode non sa chi ha scritto le righe e non lo dice.
// Funzioni pure (si provano in test/codice.mjs senza Electron); segna() è l'unica che scrive, in D.codice.glossario.
import { corsoProgrammazione } from './stampa.js';
// dati.js si carica solo quando serve: in Node, senza finestra, non parte (vuole addEventListener e localStorage)
export const dati = () => import('../dati.js');

// k: chiave unica (anche fra le lingue: visti è per chiave), l: lingua, cerca: dove compare nel codice già pulito
// (commenti tolti, stringhe ridotte a ""), f: il nome che, se lo studente definisce una sua funzione o classe così, fa saltare
// la voce (un suo `int realloc(` non è la realloc della libreria), d: la domanda da orale, r: la risposta in 1-3 frasi
export const VOCI = [
  /* ---------- C ---------- */
  { k: 'malloc', l: 'c', f: 'malloc', cerca: /\bmalloc\s*\(/, d: 'Cosa contiene la memoria appena restituita da malloc?', r: 'Valori a caso: malloc non la azzera. Se non c\'è memoria restituisce NULL, quindi si controlla prima di usarla.' },
  { k: 'calloc', l: 'c', f: 'calloc', cerca: /\bcalloc\s*\(/, d: 'Che differenza c\'è tra calloc(n, size) e malloc(n * size)?', r: 'calloc mette a zero tutti i byte, malloc lascia valori a caso. Se non c\'è memoria tutte e due restituiscono NULL.' },
  { k: 'realloc', l: 'c', f: 'realloc', cerca: /\brealloc\s*\(/, d: 'Cosa fa realloc se fallisce?', r: 'Restituisce NULL e il vecchio blocco resta valido: va liberato a parte. Per questo si scrive p2 = realloc(p, n) e non p = realloc(p, n).' },
  { k: 'free', l: 'c', f: 'free', cerca: /\bfree\s*\(/, d: 'Cosa succede se usi un puntatore dopo free?', r: 'È comportamento indefinito: quella memoria non è più tua. Anche liberarla due volte lo è. free(NULL) invece non fa niente.' },
  { k: 'strtok', l: 'c', f: 'strtok', cerca: /\bstrtok\s*\(/, d: 'Perché strtok non si può usare su una stringa letterale?', r: `Perché scrive nella stringa: al posto di ogni separatore mette '\\0'. Dalla seconda chiamata si passa NULL e strtok riparte dal punto che ricorda lei.` },
  { k: 'strcpy', l: 'c', f: 'strcpy', cerca: /\bstrcpy\s*\(/, d: 'Cosa controlla strcpy sulla dimensione della destinazione?', r: `Niente: copia fino al '\\0' compreso. Se la destinazione è troppo piccola scrive oltre la fine dell'array, ed è comportamento indefinito.` },
  { k: 'strncpy', l: 'c', f: 'strncpy', cerca: /\bstrncpy\s*\(/, d: `strncpy(d, s, n) mette sempre il '\\0' finale?`, r: `No: se s ha n caratteri o più, in d non c'è nessun '\\0'. Se s è più corta, riempie di zeri il resto.` },
  { k: 'strcmp', l: 'c', f: 'strcmp', cerca: /\bstrcmp\s*\(/, d: 'Cosa restituisce strcmp se le due stringhe sono uguali?', r: '0. Un numero negativo se la prima viene prima, positivo se viene dopo: per questo if (strcmp(a, b)) vuol dire «sono diverse».' },
  { k: 'strlen', l: 'c', f: 'strlen', cerca: /\bstrlen\s*\(/, d: `strlen conta anche il '\\0' finale?`, r: `No: conta i caratteri prima del '\\0'. Per copiare la stringa servono strlen(s) + 1 byte.` },
  { k: 'strcat', l: 'c', f: 'strcat', cerca: /\bstrcat\s*\(/, d: 'Cosa serve perché strcat(d, s) funzioni?', r: `d deve già contenere una stringa con il '\\0' e avere posto per tutte e due, più il '\\0'. strcat lo spazio non lo controlla.` },
  { k: 'memcpy', l: 'c', f: 'memcpy', cerca: /\bmemcpy\s*\(/, d: 'Si può usare memcpy se sorgente e destinazione si sovrappongono?', r: 'No, è comportamento indefinito. In quel caso si usa memmove.' },
  { k: 'memset', l: 'c', f: 'memset', cerca: /\bmemset\s*\(/, d: 'memset(v, 1, n * sizeof(int)) mette a 1 gli int di v?', r: 'No: memset scrive lo stesso valore in ogni byte, quindi ogni int a 32 bit vale 16843009. Per azzerare invece va bene: memset(v, 0, …).' },
  { k: 'sizeof', l: 'c', cerca: /\bsizeof\b/, d: 'Quanto vale sizeof(v) se v è un parametro int v[]?', r: 'La dimensione di un puntatore, non dell\'array: come parametro, int v[] è int *v. Per questo la lunghezza si passa a parte.' },
  { k: 'fgets', l: 'c', f: 'fgets', cerca: /\bfgets\s*\(/, d: 'Cosa lascia fgets in fondo alla riga letta?', r: `L'a capo, se ci stava, e poi il '\\0': con fgets(s, n, f) legge al massimo n - 1 caratteri. A fine file restituisce NULL.` },
  { k: 'scanf', l: 'c', f: 'scanf', cerca: /\bscanf\s*\(/, d: 'Cosa restituisce scanf?', r: 'Quanti valori ha letto e assegnato, o EOF se l\'input finisce prima. Se non lo controlli, una lettera al posto di un numero passa in silenzio.' },
  { k: 'sscanf', l: 'c', f: 'sscanf', cerca: /\bsscanf\s*\(/, d: 'Che differenza c\'è tra scanf e sscanf?', r: 'sscanf legge da una stringa invece che dall\'input. Si usa spesso dopo fgets: prima leggi la riga intera, poi la scomponi.' },
  { k: 'fopen', l: 'c', f: 'fopen', cerca: /\bfopen\s*\(/, d: 'Cosa restituisce fopen se il file non si apre?', r: 'NULL: va controllato prima di leggere o scrivere. Attenzione: con "w" un file che c\'è già si svuota subito.' },
  { k: 'fclose', l: 'c', f: 'fclose', cerca: /\bfclose\s*\(/, d: 'Cosa fa fclose su un file in cui hai scritto?', r: 'Scrive nel file quello che è ancora nel buffer e libera il FILE. Dopo fclose quel puntatore non si usa più.' },
  { k: 'fprintf', l: 'c', f: 'fprintf', cerca: /\bfprintf\s*\(/, d: 'Che differenza c\'è tra fprintf(stderr, ...) e printf(...)?', r: 'printf scrive su stdout, fprintf sul flusso che gli passi. stderr di solito non ha buffer e non finisce nel file se reindirizzi l\'uscita con >.' },
  { k: 'atoi', l: 'c', f: 'atoi', cerca: /\batoi\s*\(/, d: 'Cosa restituisce atoi("ciao")?', r: '0, senza nessun segnale di errore: non distingui "0" da un testo sbagliato. Per controllare si usa strtol.' },
  { k: 'strtol', l: 'c', f: 'strtol', cerca: /\bstrtol\s*\(/, d: 'A cosa serve il secondo argomento di strtol?', r: 'È un char ** dove strtol mette il punto in cui si è fermata: se coincide con l\'inizio, non ha letto cifre. Il terzo argomento è la base.' },
  { k: 'qsort', l: 'c', f: 'qsort', cerca: /\bqsort\s*\(/, d: 'Cosa deve restituire la funzione di confronto di qsort?', r: 'Un int negativo, zero o positivo se il primo elemento va prima, è uguale o va dopo. Riceve due const void * da convertire al tipo giusto.' },
  { k: 'exit', l: 'c', f: 'exit', cerca: /\bexit\s*\(/, d: 'Che differenza c\'è tra exit(1) e return 1 dentro main?', r: 'Dentro main fanno la stessa cosa. exit però chiude il programma da qualunque funzione, dopo aver svuotato e chiuso i file aperti.' },
  { k: 'assert', l: 'c', f: 'assert', cerca: /\bassert\s*\(/, d: 'Cosa fa assert(x) se x è falso?', r: 'Scrive su stderr la condizione, il file e la riga, poi ferma il programma con abort. Con -DNDEBUG gli assert spariscono: dentro non va codice che serve.' },
  { k: 'static locale', l: 'c', cerca: /^\s+static\s+[^(]*[;=]/, d: 'Cosa cambia se una variabile dentro una funzione è static?', r: 'Si inizializza una volta sola e tiene il valore da una chiamata all\'altra. Se non la inizializzi parte da 0.' },

  /* ---------- Java ---------- */
  { k: 'computeIfAbsent', l: 'java', f: 'computeIfAbsent', cerca: /\.computeIfAbsent\s*\(/, d: 'Cosa fa map.computeIfAbsent(k, x -> new ArrayList<>())?', r: 'Se k non c\'è crea la lista, la mette nella mappa e la restituisce. Se c\'è già, restituisce quella. Così dopo puoi fare .add senza controlli.' },
  { k: 'getOrDefault', l: 'java', f: 'getOrDefault', cerca: /\.getOrDefault\s*\(/, d: 'Cosa restituisce map.getOrDefault(k, 0) se k non c\'è?', r: '0, e la mappa non cambia: k non viene aggiunta.' },
  { k: 'putIfAbsent', l: 'java', f: 'putIfAbsent', cerca: /\.putIfAbsent\s*\(/, d: 'Cosa restituisce map.putIfAbsent(k, v)?', r: 'Il valore che c\'era già, e allora la mappa non cambia. Se k non c\'era mette v e restituisce null.' },
  { k: 'List.remove', l: 'java', cerca: /\.remove\s*\(\s*[^)\s]/, d: 'Su una List<Integer> con [5, 7, 9], cosa fa list.remove(1)?', r: 'Toglie l\'elemento in posizione 1, cioè 7: con un int si sceglie remove(int indice). Per togliere il valore 1 serve list.remove(Integer.valueOf(1)).' },
  { k: 'equals', l: 'java', cerca: /\.equals\s*\(/, d: 'Che differenza c\'è tra == ed equals su due String?', r: '== controlla se sono lo stesso oggetto, equals se hanno gli stessi caratteri. Due stringhe uguali possono essere due oggetti diversi.' },
  { k: 'hashCode', l: 'java', cerca: /\bhashCode\s*\(/, d: 'Se ridefinisci equals, cosa devi fare con hashCode?', r: 'Ridefinire anche lui: oggetti uguali per equals devono avere lo stesso hashCode. Se no HashMap e HashSet non li ritrovano.' },
  { k: 'Collections.sort', l: 'java', cerca: /\bCollections\s*\.\s*sort\s*\(/, d: 'Collections.sort è stabile?', r: 'Sì: gli elementi uguali per il confronto restano nell\'ordine di prima. Ordina la lista sul posto e non restituisce niente.' },
  { k: 'Comparator.comparing', l: 'java', cerca: /\bComparator\s*\.\s*comparing(?:Int|Long|Double)?\s*\(/, d: 'Cosa fa Comparator.comparing(Studente::getVoto).reversed()?', r: 'Confronta gli studenti per voto, al contrario: dal più alto al più basso. Con thenComparing aggiungi un secondo criterio a parità di voto.' },
  { k: 'Optional', l: 'java', f: 'Optional', cerca: /\bOptional\s*[<.]/, d: 'Perché non si chiama get() su un Optional senza controllare?', r: 'Se è vuoto, get() lancia NoSuchElementException. Si usa orElse, orElseGet o isPresent.' },
  { k: 'stream', l: 'java', cerca: /\.stream\s*\(\s*\)/, d: 'Cosa succede se su uno stream chiami solo map e filter, senza collect?', r: 'Niente: map e filter sono pigre. Il lavoro parte solo con un\'operazione finale come collect, forEach o count. E uno stream si usa una volta sola.' },
  { k: 'StringBuilder', l: 'java', f: 'StringBuilder', cerca: /\bStringBuilder\b/, d: 'Perché in un ciclo si usa StringBuilder invece di s = s + x?', r: 'Una String non cambia mai: ogni + ne crea una nuova e ricopia tutto. StringBuilder aggiunge in fondo allo stesso oggetto, e toString() dà il risultato.' },
  { k: 'Integer.parseInt', l: 'java', cerca: /\bInteger\s*\.\s*parseInt\s*\(/, d: 'Cosa succede con Integer.parseInt("12a")?', r: 'Lancia NumberFormatException. Anche " 12" con lo spazio la lancia: prima si usa trim().' },
  { k: 'Scanner.nextInt', l: 'java', cerca: /\.nextInt\s*\(\s*\)/, d: 'Perché un nextLine() subito dopo nextInt() restituisce una riga vuota?', r: 'nextInt legge il numero ma lascia lì l\'a capo. nextLine legge fino a quell\'a capo e restituisce "". Si fa un nextLine() in più per scartarlo.' },
  { k: 'try-with-resources', l: 'java', cerca: /\btry\s*\(/, d: 'Cosa fa try (Scanner in = new Scanner(f)) { ... }?', r: 'Chiude da solo la risorsa alla fine del blocco, anche se arriva un\'eccezione. Funziona con le classi che implementano AutoCloseable.' },
  { k: 'instanceof', l: 'java', cerca: /\binstanceof\b/, d: 'Cosa restituisce x instanceof String se x è null?', r: 'false, senza eccezioni. Da Java 16 puoi scrivere x instanceof String s e usare subito s.' },
  { k: 'Arrays.asList', l: 'java', cerca: /\bArrays\s*\.\s*asList\s*\(/, d: 'Cosa succede se fai add sulla lista di Arrays.asList?', r: 'Lancia UnsupportedOperationException: la lista ha dimensione fissa ed è legata all\'array. set invece funziona, e cambia anche l\'array.' },
  { k: 'Iterator.remove', l: 'java', cerca: /\.remove\s*\(\s*\)/, d: 'Come togli elementi da una lista mentre la scorri?', r: 'Con un Iterator e it.remove(), oppure con removeIf. Con list.remove dentro un for-each di solito arriva ConcurrentModificationException.' },
  { k: 'substring', l: 'java', cerca: /\.substring\s*\(/, d: 'Cosa restituisce "lezione".substring(1, 4)?', r: '"ezi": i caratteri dalla posizione 1 alla 3. Il secondo indice è escluso, e la stringa di partenza non cambia.' },
  { k: 'compareTo', l: 'java', cerca: /\.compareTo\s*\(/, d: 'Cosa restituisce a.compareTo(b)?', r: 'Un numero negativo se a viene prima di b, zero se sono uguali, positivo se viene dopo. Non per forza -1 o 1: conta il segno.' },

  /* ---------- Python ---------- */
  { k: 'list comprehension', l: 'python', cerca: /\[(?!.*\bfor\b.*\bfor\b).*?\bfor\b.+?\bin\b.*\]/, d: 'Cosa costruisce [x * 2 for x in v if x > 0]?', r: 'Una lista nuova con il doppio dei soli elementi positivi di v. È un for con if e append scritto in una riga; v non cambia.' },
  { k: 'list comprehension annidata', l: 'python', cerca: /\[.*?\bfor\b.+?\bfor\b.+?\bin\b.*\]/, d: 'In [x for riga in m for x in riga], quale for è quello esterno?', r: 'Il primo: i for si leggono nell\'ordine in cui li scriveresti uno dentro l\'altro. Il risultato è m appiattita in una lista sola.' },
  { k: 'lambda', l: 'python', cerca: /\blambda\b/, d: 'Cosa può contenere una lambda in Python?', r: 'Una sola espressione, che diventa il valore restituito. Niente istruzioni come return, for o un assegnamento normale.' },
  { k: 'sorted con key', l: 'python', cerca: /(?:\bsorted\s*\(|\.sort\s*\().*\bkey\s*=/, d: 'Cosa fa sorted(v, key=len)?', r: 'Restituisce una lista nuova ordinata per lunghezza; v resta com\'è. A parità di lunghezza l\'ordine di partenza resta: l\'ordinamento è stabile.' },
  { k: 'enumerate', l: 'python', f: 'enumerate', cerca: /\benumerate\s*\(/, d: 'Cosa dà enumerate(v)?', r: 'Le coppie (indice, elemento), con l\'indice che parte da 0. Con enumerate(v, 1) parte da 1.' },
  { k: 'zip', l: 'python', f: 'zip', cerca: /\bzip\s*\(/, d: 'Cosa fa zip se le liste hanno lunghezze diverse?', r: 'Si ferma alla più corta: gli elementi in più si perdono senza errore. Da Python 3.10, con strict=True dà errore.' },
  { k: 'dict.get', l: 'python', f: 'get', cerca: /\.get\s*\(/, d: 'Che differenza c\'è tra d[k] e d.get(k)?', r: 'd[k] lancia KeyError se k manca, d.get(k) restituisce None, o il secondo argomento se lo passi. get non aggiunge k.' },
  { k: 'setdefault', l: 'python', f: 'setdefault', cerca: /\.setdefault\s*\(/, d: 'Cosa fa d.setdefault(k, [])?', r: 'Se k manca la aggiunge con [] e restituisce quella lista. Se c\'è già, restituisce il valore che c\'è. La [] si crea comunque a ogni chiamata.' },
  { k: 'defaultdict', l: 'python', f: 'defaultdict', cerca: /\bdefaultdict\s*\(/, d: 'Cosa succede se leggi una chiave che manca in un defaultdict(list)?', r: 'La crea con una lista vuota e la restituisce, senza KeyError. Attenzione: anche solo leggere d[k] aggiunge k.' },
  { k: 'Counter', l: 'python', f: 'Counter', cerca: /\bCounter\s*\(/, d: 'Cosa restituisce un Counter per una chiave che non ha mai visto?', r: '0, senza KeyError e senza aggiungerla. most_common(n) dà le n più frequenti.' },
  { k: 'with open', l: 'python', cerca: /\bwith\s+open\s*\(/, d: 'Perché si scrive with open(nome) as f?', r: 'Il file si chiude da solo all\'uscita dal blocco, anche se arriva un\'eccezione. Senza with devi chiamare f.close().' },
  { k: 'yield', l: 'python', cerca: /\byield\b/, d: 'Cosa restituisce una funzione che contiene yield?', r: 'Un generatore. Il corpo parte solo quando chiedi il primo valore, con next o con un for, e si ferma a ogni yield. Si scorre una volta sola.' },
  { k: '*args e **kwargs', l: 'python', cerca: /\bdef\s+\w+\s*\(.*(?:^|[(,\s])\*{1,2}[A-Za-z_]/, d: 'In def f(*args, **kwargs), cosa sono args e kwargs?', r: 'args è una tupla con gli argomenti posizionali in più, kwargs un dizionario con quelli passati per nome.' },
  { k: '[::-1]', l: 'python', cerca: /\[\s*::\s*-\s*1\s*\]/, d: 'Cosa dà v[::-1]?', r: 'Una copia di v al contrario: funziona con liste, stringhe e tuple. v non cambia.' },
  { k: 'is e ==', l: 'python', cerca: /\bis\s+(?!None\b)(?!not\s+None\b)/, d: 'Che differenza c\'è tra is e ==?', r: '== confronta i valori, is controlla se sono lo stesso oggetto. is si usa con None; con numeri e stringhe si usa ==.' },
  { k: 'default mutabile', l: 'python', cerca: /\bdef\s+\w+\s*\(.*=\s*(?:\[\s*\]|\{\s*\}|list\(\s*\)|dict\(\s*\)|set\(\s*\))/, d: 'Perché def f(x, v=[]) è una trappola?', r: 'La lista di default si crea una volta sola, quando si definisce f: ogni chiamata vede le modifiche di quelle prima. Si scrive v=None e dentro si crea la lista.' },
  { k: 'f-string', l: 'python', cerca: /(?:^|[^\w])(?:[rR]?[fF]|[fF][rR])""/, d: 'Cosa stampa print(f"{x:.2f}") se x vale 3.14159?', r: '3.14: dopo i due punti c\'è il formato, e .2f vuol dire due cifre dopo la virgola, arrotondate.' },
  { k: 'extend', l: 'python', f: 'extend', cerca: /\.extend\s*\(/, d: 'Che differenza c\'è tra v.append(w) e v.extend(w)?', r: 'append aggiunge w come un solo elemento, anche se è una lista. extend aggiunge uno per uno gli elementi di w. Tutte e due cambiano v e restituiscono None.' },
  { k: 'split', l: 'python', f: 'split', cerca: /\.split\s*\(/, d: 'Che differenza c\'è tra s.split() e s.split(" ")?', r: 'Senza argomenti divide su qualsiasi spazio, anche più di uno, e salta le parti vuote. Con " " ogni spazio separa: due spazi di fila danno una stringa vuota.' },
];

// la lingua dal nome del file: .c/.h → 'c', .java → 'java', .py → 'python', il resto → null
export const linguaDi = rel => { const m = /\.([A-Za-z]+)$/.exec(String(rel || '')); const e = m?.[1].toLowerCase(); return e === 'c' || e === 'h' ? 'c' : e === 'java' ? 'java' : e === 'py' ? 'python' : null; };

/* ---------- il codice senza commenti e senza testo tra virgolette ---------- */
// Una riga alla volta, con lo stato di chi legge (un /* … */ o un """ … """ che va a capo): le stringhe diventano "" (così
// f"…" resta riconoscibile), i commenti spariscono. Le righe di solo commento (//, #, /*, * ) danno ''.
function pulisci(s, l, st) {
  const py = l === 'python';
  if (!st.dentro && !py && /^\s*\*(?:\s|\/|$)/.test(s)) { const j = s.indexOf('*/'); if (j < 0) return ''; s = s.slice(j + 2); }
  let out = '', i = 0;
  while (i < s.length) {
    if (st.dentro) { const j = s.indexOf(st.dentro, i); if (j < 0) return out; i = j + st.dentro.length; if (py) out += '""'; st.dentro = null; continue; }
    const c = s[i];
    if (py ? c === '#' : s.startsWith('//', i)) break;
    if (!py && s.startsWith('/*', i)) { st.dentro = '*/'; i += 2; continue; }
    if (py && (s.startsWith('"""', i) || s.startsWith("'''", i))) { st.dentro = s.slice(i, i + 3); i += 3; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < s.length && s[j] !== c) j += s[j] === '\\' ? 2 : 1; out += '""'; i = j + 1; continue; }
    out += c; i++;
  }
  return out;
}
// le parole che in C e Java possono stare prima di una chiamata senza che sia una definizione
const NON_TIPI = 'return|else|case|new|throw|goto|sizeof|do|assert|yield|await|typeof|delete|not|and|or|in|is';
const RE_DEF_C = new RegExp(`^\\s*(?:(?!(?:${NON_TIPI})\\b)[A-Za-z_$][\\w$<>\\[\\],.?]*[\\s*&]+)+([A-Za-z_$][\\w$]*)\\s*\\(`);
const RE_DEF_PY = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;
const RE_CLASSE = /\b(?:class|interface|record|enum)\s+([A-Za-z_$][\w$]*)/;
// i nomi che lo studente definisce in queste righe: funzioni, metodi, classi
function definiti(righe, l) {
  const n = new Set();
  for (const c of righe) {
    const m = (l === 'python' ? RE_DEF_PY : RE_DEF_C).exec(c); if (m) n.add(m[1]);
    const k = RE_CLASSE.exec(c); if (k) n.add(k[1]);
  }
  return n;
}
// un file del diff → { nuove: [{ r, c }] (le righe '+' con il codice pulito), prima: [codice delle righe ' ' e '-'] }.
// Due letture separate: il file di prima (' ' e '-') e quello di dopo (' ' e '+'), ognuna con il suo stato dei commenti
function leggi(blocchi, l) {
  const nuove = [], prima = [], tutte = [];
  for (const b of blocchi || []) {
    const sPrima = {}, sDopo = {};
    for (const r of b?.righe || []) {
      const s = String(r?.s ?? '');
      if (r.t === '+') { const c = pulisci(s, l, sDopo); tutte.push(c); if (c.trim()) nuove.push({ r, c }); }
      else if (r.t === '-') { const c = pulisci(s, l, sPrima); tutte.push(c); prima.push(c); }
      else { const a = pulisci(s, l, sPrima), c = pulisci(s, l, sDopo); tutte.push(c); prima.push(a); }
    }
  }
  return { nuove, prima, tutte };
}

// il file intero di adesso (progetto:righe, tutte le righe), pulito come il diff: un solo stato dei commenti dall'inizio
const pulito = (righe, l) => { const st = {}; return righe.map(s => pulisci(String(s ?? ''), l, st)); };
const quante = (codice, v) => codice.reduce((n, c) => n + (v.cerca.test(c) ? 1 : 0), 0);

/* ---------- le voci nuove di un diff ---------- */
// file: [{ rel, blocchi, grande?, tagliato?, attuale? }] come progetto:diff con rel. Una voce è nuova per un file se compare in
// una riga '+', in nessuna riga ' ' o '-' dello stesso file, non è in visti, nessuna carta ha la sua domanda come fronte, e nel
// diff nessuno definisce una funzione o una classe con il suo nome. attuale (facoltativo): tutte le righe del file di adesso.
// Il diff vede solo 3 righe di contesto per blocco: con attuale, se la voce compare in più righe del file che nelle righe '+',
// c'era già altrove (un malloc nuovo a riga 200 con un malloc vecchio a riga 10) e si salta. Se il file è cambiato ancora dopo
// il tratto, l'errore va dalla parte del silenzio. Una volta per voce (la prima), al massimo 5, nell'ordine del diff.
export const MAX = 5;
export function coseNuove(file, { visti = {}, carte = [] } = {}) {
  const fronti = new Set((carte || []).map(c => String(c?.fronte ?? '').trim()));
  const letti = (file || []).map(f => { const l = linguaDi(f?.rel); return l && !f.grande && !f.tagliato && Array.isArray(f.blocchi) ? { rel: f.rel, l, ...leggi(f.blocchi, l), ora: Array.isArray(f.attuale) ? pulito(f.attuale, l) : null } : null; }).filter(Boolean);
  const def = {};
  for (const x of letti) for (const n of definiti(x.tutte, x.l)) (def[x.l] ||= new Set()).add(n);
  const out = [], prese = new Set();
  for (const x of letti) {
    const voci = VOCI.filter(v => v.l === x.l && !prese.has(v.k) && !visti?.[v.k] && !fronti.has(v.d) && !(v.f && def[x.l]?.has(v.f)) && !x.prima.some(c => v.cerca.test(c)) && !(x.ora && quante(x.ora, v) > quante(x.nuove.map(n => n.c), v)));
    for (const { r, c } of x.nuove) for (const v of voci) {
      if (out.length >= MAX) return out;
      if (prese.has(v.k) || !v.cerca.test(c)) continue;
      prese.add(v.k); out.push({ voce: v, rel: x.rel, riga: r.nb, testo: String(r.s).trim().slice(0, 120) });
    }
  }
  return out;
}

// la carta per il ripasso: la domanda davanti, dietro la risposta e da dove viene
export const cartaDa = x => ({ fronte: x.voce.d, retro: `${x.voce.r}\n\nDa: ${x.rel}, riga ${x.riga}` });
// l'esame a cui va la carta: il corso del progetto, se è un esame da fare; se no il corso di programmazione; se no nessuno
export function esameDi(esami = [], corso = null) {
  const da = (esami || []).filter(e => e && !e.fatto), nome = (corso && da.some(e => e.nome === corso) && corso) || corsoProgrammazione(da.map(e => e.nome));
  return (nome && da.find(e => e.nome === nome)?.id) || null;
}

// «La so già» ('so') o «Mettila nel ripasso» ('carta'): la voce non torna più. Il campo nasce qui, non in VUOTO.
// x: { D, salva, oggi } per le prove; nella barra quelli di dati.js
export async function segna(k, come, x) {
  const { D, salva, oggi } = x || await dati();
  const c = D.codice ||= {}, g = c.glossario ||= { visti: {} };
  (g.visti ||= {})[k] = { g: oggi(), come };
  salva();
}
