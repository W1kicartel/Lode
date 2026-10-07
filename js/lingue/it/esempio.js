// I dati di esempio (esempio() in js/dati.js) e i testi dei programmi di «Cosa stampa?» (js/codice/modelli.js).
// Gli elenchi hanno sempre la stessa forma in tutte le lingue: esami = 6 fatti (il quinto è un'idoneità) e 3 da fare
// (il primo con le carte, il secondo con le carte di basi di dati); carte = [fronte, retro]; definizioni = [termine, cosa].
// Nella prima stella della prima lezione c'è il nome di una definizione (diventa «da esame»).
export default {
  'esempio.nome': 'Giulia',
  'esempio.corso': 'Ingegneria informatica',
  'esempio.esami': ['Analisi 1', 'Fondamenti di informatica', 'Geometria e algebra lineare', 'Fisica 1', 'Lingua inglese B2', 'Programmazione a oggetti', 'Analisi 2', 'Basi di dati', 'Fisica 2'],
  'esempio.aule': ['7', 'B2', 'Magna'],
  'esempio.carte': [
    ['Che cos\'è il gradiente di f(x, y)?', 'Il vettore delle derivate parziali (∂f/∂x, ∂f/∂y): punta nella direzione di massima crescita.'],
    ['Enuncia il teorema di Schwarz', 'Se le derivate seconde miste sono continue in un intorno, allora f_xy = f_yx.'],
    ['Condizione per un punto stazionario', 'Il gradiente si annulla: ∇f(x₀) = 0.'],
    ['Come si classifica un punto stazionario?', 'Con la matrice hessiana: definita positiva → minimo, definita negativa → massimo, indefinita → sella.'],
    ['Che cos\'è un integrale doppio su un dominio normale?', 'Un integrale iterato: prima sulla variabile «interna» con estremi funzione dell\'altra, poi sull\'altra.'],
    ['Teorema di Green: enunciato', 'L\'integrale di linea su ∂D di P dx + Q dy è uguale all\'integrale doppio su D di (∂Q/∂x − ∂P/∂y).'],
    ['Forma differenziale esatta: definizione', 'ω è esatta se esiste una funzione U (potenziale) con dU = ω.'],
    ['Serie geometrica: quando converge?', 'Per |q| < 1, con somma 1/(1 − q).'],
    ['Che cos\'è una chiave primaria?', 'Un insieme minimo di attributi che identifica in modo univoco ogni tupla di una relazione.'],
    ['Differenza tra LEFT JOIN e INNER JOIN', 'La LEFT JOIN tiene tutte le righe della tabella di sinistra, anche senza corrispondenze (con NULL); la INNER solo le coppie che combaciano.'],
    ['Che cosa garantisce la 3ª forma normale?', 'Che ogni attributo non chiave dipenda dalla chiave, da tutta la chiave e da nient\'altro che la chiave (niente dipendenze transitive).'],
  ],
  'esempio.domande': ['Perché nel teorema di Schwarz serve la continuità delle derivate miste?'],
  'esempio.stelle': ['Il teorema di Green all\'esame lo chiede sempre, con la dimostrazione', 'Classificare i punti stazionari con l\'hessiana: esercizio sicuro'],
  'esempio.stelle-basi': ['Normalizzazione fino alla BCNF: c\'è sempre nello scritto'],
  'esempio.definizioni': [
    ['Gradiente', 'Il vettore delle derivate parziali di f: punta nella direzione di massima crescita.'],
    ['Punto stazionario', 'Un punto in cui il gradiente della funzione si annulla.'],
    ['Matrice hessiana', 'La matrice quadrata delle derivate seconde parziali di una funzione.'],
    ['Punto di sella', 'Un punto stazionario che non è né di massimo né di minimo locale: l\'hessiana è indefinita.'],
    ['Teorema di Green', 'Lega l\'integrale di linea lungo il bordo di un dominio all\'integrale doppio sul dominio.'],
    ['Forma differenziale esatta', 'Una forma che ammette un potenziale, cioè è il differenziale di una funzione.'],
  ],
  'esempio.definizioni-basi': [
    ['Chiave primaria', 'Un insieme minimo di attributi che identifica in modo univoco ogni tupla.'],
    ['Chiave esterna', 'Un attributo che fa riferimento alla chiave primaria di un\'altra relazione.'],
    ['Dipendenza funzionale', 'Un vincolo per cui il valore di un insieme di attributi determina quello di un altro.'],
    ['Forma normale di Boyce-Codd', 'Ogni dipendenza funzionale non banale ha a sinistra una superchiave.'],
  ],
  // «Cosa stampa?»: le parole stampate dai programmi (switch e if). La risposta giusta la calcola il codice dal programma
  'esempio.switch-parole': ['uno', 'due', 'tre', 'quattro'],
  'esempio.switch-altro': 'altro',
  'esempio.si': 'si',
  'esempio.no': 'no',
  // la frase di un errore quando la risposta è scritta invece che scelta (modelli.hai-scelto)
  'esempio.hai-scritto': 'Hai scritto `{s}`',
};
