// Capire una frase in italiano, senza AI: «focus 50 su analisi», «ho preso 28 in fisica», «esame basi di dati il 15 gennaio 9 cfu»,
// «quanto mi serve per 110», «se prendo 30 in analisi 2», «ripassa analisi», «carta: teorema di Green = …».
// Se la frase non è un comando, ritorna null e (se c'è la chiave) ci pensa l'AI.
import { D, MESI, GIORNI, isoGiorno, norm, oggi, piuGiorni, trovaEsame } from './dati.js';
import { interpreta as interpretaProgetto } from './codice/progetto.js';
import { analizza as analizzaErrore } from './errori.js';

const NUM = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, dodici: 12, quindici: 15, venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, novanta: 90 };
const n = s => (s in NUM ? NUM[s] : Number(s));

export function leggiData(testo) {
  const t = ' ' + norm(testo) + ' ', T = oggi();
  let m;
  if (/ dopodomani /.test(t)) return { data: piuGiorni(T, 2), pezzo: 'dopodomani' };
  if (/ domani /.test(t)) return { data: piuGiorni(T, 1), pezzo: 'domani' };
  if (/ oggi /.test(t)) return { data: T, pezzo: 'oggi' };
  if ((m = t.match(/ (?:tra|fra) (\d+|\w+) (giorni|giorno|settimane|settimana|mesi|mese) /))) {
    const k = n(m[1]); if (k) return { data: piuGiorni(T, k * (m[2].startsWith('sett') ? 7 : m[2].startsWith('mes') ? 30 : 1)), pezzo: m[0].trim() };
  }
  if ((m = t.match(/ (\d{1,2}) (\d{1,2}) (\d{2,4}) /)) || (m = String(' ' + testo + ' ').match(/[\s(](\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?[\s),.]/))) {
    const g = +m[1], me = +m[2] - 1; let a = m[3] ? +m[3] : null; if (a && a < 100) a += 2000;
    if (g >= 1 && g <= 31 && me >= 0 && me < 12) return { data: conAnno(g, me, a), pezzo: m[0].trim() };
  }
  const mesi = MESI.map(x => x.slice(0, 3)).join('|');
  if ((m = t.match(new RegExp(` (\\d{1,2}|primo) (${mesi})[a-z]* (?:(\\d{4}) )?`)))) {
    const g = m[1] === 'primo' ? 1 : +m[1], me = MESI.findIndex(x => x.startsWith(m[2]));
    return { data: conAnno(g, me, m[3] ? +m[3] : null), pezzo: m[0].trim() };
  }
  const gs = GIORNI.map(norm);
  if ((m = t.match(new RegExp(` (?:(?:il|la|di|questo|questa|prossimo|prossima) )?(${gs.join('|')}) `)))) {
    const dow = gs.indexOf(m[1]), d = new Date(T + 'T12:00'); let k = (dow - d.getDay() + 7) % 7 || 7;
    return { data: piuGiorni(T, k), pezzo: m[0].trim() };
  }
  return null;
}
function conAnno(g, me, a) {
  const T = oggi(); let anno = a || new Date().getFullYear();
  let iso = isoGiorno(new Date(anno, me, g, 12));
  if (!a && iso < T) iso = isoGiorno(new Date(anno + 1, me, g, 12));
  return iso;
}
const pulisci = s => s.replace(/^\s*(?:di|del|della|dello|dei|delle|in|a|ad|su|sul|sulla|per|l'|il|lo|la|lesame( di)?|esame( di)?)\s+/i, '').replace(/[?.!,;:]+$/, '').replace(/\s+(?:per|di|su|in|a|da|con|il|la)\s*$/i, '').trim();

// minuti detti a parole: «50», «50 minuti», «un'ora», «mezz'ora», «un'ora e mezza», «2 ore»
function leggiMinuti(t) {
  let m;
  if (/mezz.?ora/.test(t) && !/ora e mezz/.test(t)) return { min: 30, pezzo: t.match(/mezz.?ora/)[0] };
  if ((m = t.match(/(\d+|un'|un|una|due|tre)\s*(?:ora|ore|h)\b(\s*e\s*mezz[ao])?/))) return { min: n(m[1].replace(/^un'?$/, 'una')) * 60 + (m[2] ? 30 : 0), pezzo: m[0] };
  if ((m = t.match(/(\d+|\w+)\s*(?:minuti|minuto|min|m)\b/))) { const k = n(m[1]); if (k) return { min: k, pezzo: m[0] }; }
  if ((m = t.match(/(?:^|\s)(\d{1,3})(?=\s|$)/))) return { min: +m[1], pezzo: m[1] };
  return null;
}

// i numeri detti a voce: «ventotto» → 28, «cinquanta» → 50, «trenta e lode» resta lode
const UNITA = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'];
const SPECIALI = { dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19 };
const DECINE = { venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90 };
const PAROLE_NUM = { ...SPECIALI, ...DECINE, cento: 100 };
UNITA.forEach((u, i) => { if (i) PAROLE_NUM[u] = i; });
for (const [d, v] of Object.entries(DECINE)) UNITA.forEach((u, i) => { if (!i) return; const tronca = /^[aeiou]/.test(u) ? d.slice(0, -1) : d; PAROLE_NUM[tronca + u] = v + i; });
for (const [w, v] of Object.entries({ ...PAROLE_NUM })) if (v < 100) PAROLE_NUM['cento' + w] = 100 + v;
// errori tipici della trascrizione
const SENTITO = { guale: 'uguale', priso: 'preso', presso: 'preso', fucus: 'focus', focos: 'focus', ripasa: 'ripassa' };
export const numeri = t => t.replace(/\b[a-zà]+\b/g, w => SENTITO[w.toLowerCase()] || ((w in PAROLE_NUM && !/^(un|una)$/.test(w)) ? String(PAROLE_NUM[w]) : w));

export function interpreta(frase) {
  const grezzo0 = String(frase || '').trim(); if (!grezzo0) return null;
  // informatica. «spiegami l'errore», anche con l'errore incollato dopo (su più righe: qui le righe restano com'erano).
  // Solo se dopo «errore» non c'è niente, ci sono i due punti o un a capo, o c'è davvero un errore del compilatore:
  // «cosa vuol dire errore standard» o «spiegami l'errore relativo» restano domande per l'AI
  let e0;
  if ((e0 = grezzo0.match(/^(?:spiegami|spiega(?:mi)?|cosa vuol dire|che vuol dire) (?:l['’]|quest['’]|questo |il mio )?errore\b([\s\S]*)$/i))) {
    const dopo = e0[1].replace(/^[ \t]+/, ''), testo = dopo.replace(/^:/, '').trim();
    const solo = !testo || /^[?.!]+$/.test(testo) || /^(?:del compilatore|di compilazione|del programma|che ho copiato|copiato)[?.!]*$/i.test(testo);
    if (solo) return { tipo: 'errore', testo: null };
    if (/^[:\n]/.test(dopo) || analizzaErrore(testo).length) return { tipo: 'errore', testo };
  }
  // «segui progetto», «cosa è cambiato», «provato?», «prova il progetto», «compila», «smetti di seguire …»
  const pr = interpretaProgetto(grezzo0); if (pr) return pr;
  // la voce aggiunge maiuscole e un punto finale; i numeri arrivano a parole
  const grezzo = numeri(grezzo0.replace(/[.!]+$/, '').replace(/^(\w)/, c => c));
  const t = grezzo.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim();
  let m;

  if (/^(aiuto|help|\?|cosa sai fare|che cosa sai fare|comandi)$/.test(t)) return { tipo: 'aiuto' };
  if (/^(stop|ferma|fermati|basta|interrompi|fine|termina)(?: (?:il |la )?(?:focus|timer|pomodoro|sessione|pausa))?$/.test(t)) return { tipo: 'ferma' };
  if (/^(sospendi|metti in pausa|pausa timer)$/.test(t)) return { tipo: 'sospendi' };
  if (/^(riprendi|continua|vai avanti)$/.test(t)) return { tipo: 'riprendi' };
  // Anki: «esporta per anki», «anki», «esporta le carte di analisi 2 per anki», «anki fisica 2», «mazzi per anki».
  // Serve un verbo per portare fuori, oppure la frase che comincia da «anki» o dalle carte: «come importo in anki» resta all'AI.
  // Senza corso (o «tutte», «tutto») = tutti i corsi, in un file solo con un mazzo per corso (js/anki.js).
  // Restano all'AI anche le domande che cominciano da «anki» («anki come si usa», «anki funziona con lode?», «anki è aperto?»)
  // e «scarica anki» o «installa anki» da soli: vogliono il programma, non le carte («scarica le carte per anki» esporta)
  if (/\banki\b/.test(t) && (m = t.match(/^(?:(?:esporta(?:mi)?|manda|porta|passa|metti|salva|prepara|crea|scarica)\b\s*)?(.*)$/)) && (m[0] !== m[1] || /^(?:anki\b|(?:tutt[ei] )?(?:le |i |gli |il |la )?(?:mie |miei |mio )?(?:carte|flashcard|mazz[oi]|definizioni)\b)/.test(m[1]))) {
    const r = pulisci(m[1].replace(/(?:\b(?:per|in|su|verso|a|ad|nel|dentro) )?\banki\b/, ' ').trim().replace(/^(?:tutt[ei] )?(?:le |i |gli |il |la |un |uno |una )?(?:mie |miei |mio |nuov[oi] )?(?:carte|flashcard|mazz[oi]|definizioni)\b\s*/, '').replace(/\s+/g, ' '));
    // (\b non vale dopo «è» o «perché», che per le regex non sono lettere: qui serve uno spazio, un apostrofo o la fine)
    const domanda = m[0] === m[1] && r && (/\?\s*$/.test(grezzo0) || /^(?:come|cos|cosa|che|perch\S*|dove|quando|quanto|funziona|è|e|o|si|non|serve|posso|devo|va)(?=[\s']|$)/.test(r));
    const programma = /^scarica\b/.test(t) && /^anki$/.test(m[1].trim());
    if (!domanda && !programma) return { tipo: 'anki', corso: r && !/^(?:tutt[eio]|tutti i corsi|ogni corso)$/.test(r) ? r : null };
  }

  // in aula: ★ da esame, definizione, domanda per il prof
  if ((m = grezzo.match(/^(?:★|\*{1,2}|!|da esame\s*:?|importante\s*:|stella\s*:?|segna(?: che)?(?: è)? da esame\s*:?|questo è da esame\s*:?)\s*(.+)$/i))) return { tipo: 'stella', testo: m[1].trim() };
  if ((m = grezzo.match(/^(?:definizione|definisci|def)\s*:?\s*(.+?)\s*(?:::|:|=|→|—|-{1,2}>|\buguale a\b|\buguale\b|\bvuol dire\b|\bsignifica\b|\bè\b)\s*(.+)$/i))) return { tipo: 'definizione', termine: m[1].replace(/\*\*/g, '').trim(), testo: m[2].trim() };
  if ((m = grezzo.match(/^(?:\?|domanda\s*:|domanda per il prof(?:essore)?\s*:?|chiedi al prof\s*:?)\s*(.+)$/i))) return { tipo: 'domanda', testo: m[1].trim() };

  // l'orario: «lezione analisi 2 lunedì e mercoledì dalle 9 alle 11 aula 7»
  if ((m = t.match(/^(?:aggiungi |nuova |ho )?(?:lezione|lezioni|corso)\s+(?:di\s+)?(.+)$/))) {
    const o = leggiOrario(m[1]); if (o) return { tipo: 'orario', ...o };
  }
  if (/^(?:orario|il mio orario|le mie lezioni|lezioni|quando ho lezione|che lezione ho)$/.test(t)) return { tipo: 'vediOrario' };
  // «Cosa stampa?»: esercizi di C con la risposta calcolata da Lode (prima del gioco: «allenami» da solo resta il gioco)
  if (/^(?:cosa stampa(?: questo (?:codice|programma))?|esercizio? (?:di )?(?:c|programmazione)|allenami (?:su|in) c)$/.test(t)) return { tipo: 'stampa' };
  if ((m = t.match(/^(?:gioca(?:mo)?|gioco|giochino|memory|allenami|allenamento|fissa(?:mi)? le definizioni|definizioni)\b\s*(.*)$/))) {
    const r = pulisci(m[1] || ''); return { tipo: 'gioco', corso: r || null };
  }
  if (/^(?:apri )?(?:gli |i miei )?(?:appunti|obsidian|vault|la nota|nota)( di oggi| della lezione)?$/.test(t)) return { tipo: 'appunti' };
  if (/^(?:trascrivi|registra|ascolta|sbobina)(?: (?:la|tutta la|questa))? lezione\b|^(?:avvia|inizia|parti con) (?:la )?(?:trascrizione|sbobinatura)/.test(t)) return { tipo: 'trascrivi' };
  if (/^(?:ripeti|ripetimi|ripeti(?:mi)? (?:l'ultima frase|gli ultimi \d+ secondi|cosa ha detto)|cosa ha (?:appena )?detto|che (?:cosa )?ha detto|non ho capito|mi sono pers[oa] (?:qualcosa|una frase)|cos'ha detto)(?: il prof(?:essore)?)?$/.test(t)) { const sec = +(t.match(/(\d+) secondi/)?.[1] || 60); return { tipo: 'ripeti', sec: Math.min(90, sec) }; }
  if (/^(?:spegni|disattiva|basta)(?: il)? ripeti$/.test(t)) return { tipo: 'spegniRipeti' };
  if ((m = t.match(/^(?:proposte|suggerimenti)\s+(mai|spente|poche|normali|frequenti|tante)$|^(?:spegni|disattiva|basta)(?: con)? (?:le )?(?:proposte|suggerimenti)$/))) return { tipo: 'proposte', livello: !m[1] || /mai|spente/.test(m[1]) ? 'mai' : /poche/.test(m[1]) ? 'poco' : /frequenti|tante/.test(m[1]) ? 'spesso' : 'normale' };
  if (/^(?:proponimi|dammi|suggeriscimi) (?:qualcosa|un ripasso|un gioco)|^cosa (?:posso )?(?:faccio|fare) adesso$|^che (?:cosa )?ripasso$/.test(t)) return { tipo: 'proponi' };
  if (/^(?:condividi|manda|passa|invia)(?: la)? (?:sbobina|lezione|trascrizione|appunti)\b/.test(t)) { const r = pulisci(t.replace(/^.*?(sbobina|lezione|trascrizione|appunti)\s*/, '').replace(/^(?:ai|a|ai miei) (?:compagni|colleghi)\s*/, '')); return { tipo: 'condividi', corso: r || null }; }
  if (/^(?:stop|ferma|fine|basta|termina|chiudi)(?: la)? (?:trascrizione|registrazione|sbobinatura)|^(?:la )?lezione è finita$|^fine lezione$/.test(t)) return { tipo: 'fineTrascrizione' };
  if (/^(?:pausa|sospendi)(?: la)? (?:trascrizione|registrazione)/.test(t)) return { tipo: 'pausaTrascrizione' };
  if (/^riprendi(?: la)? (?:trascrizione|registrazione)/.test(t)) return { tipo: 'riprendiTrascrizione' };
  if (/^(?:riordina|sistema|metti in ordine|pulisci)(?: la| gli)? (?:lezione|appunti|trascrizione)\b/.test(t)) { const r = pulisci(t.replace(/^.*?(lezione|appunti|trascrizione)\s*/, '')); return { tipo: 'riordina', corso: r || null }; }
  if (/^(?:chiudi|finisci)(?: la)? lezione\b|^estrai(?: le)? definizioni/.test(t)) { const r = pulisci(t.replace(/^.*?(lezione|definizioni)\s*/, '')); return { tipo: 'chiudiLezione', corso: r || null }; }
  // la tua AI: «AI», «collega chatgpt», «usa gemini», «la mia chiave»
  { const FORN = { claude: 'anthropic', anthropic: 'anthropic', chatgpt: 'openai', openai: 'openai', gpt: 'openai', gemini: 'google', google: 'google', mistral: 'mistral', groq: 'groq', openrouter: 'openrouter', deepseek: 'deepseek' };
    const m = t.match(/^(?:(?:la )?mia ai|ai|intelligenza artificiale|chiave(?: api)?|api ?key|(?:collega|usa|imposta|aggiungi|metti)(?: la chiave(?: di)?| la mia)? (claude|anthropic|chatgpt|openai|gpt|gemini|google|mistral|groq|openrouter|deepseek|ai|la mia ai|una chiave|chiave))$/);
    if (m) return { tipo: 'ai', fornitore: FORN[m[1]] || null }; }
  if (/^(?:prepara|configura|installa|setup)\b/.test(t)) return { tipo: 'prepara', cosa: /obsidian/.test(t) ? 'obsidian' : /modello|cervello|ollama|gemma|qwen|ai/.test(t) ? 'cervello' : null };
  // il diario del progetto nel vault: aprirlo, spegnerlo, riaccenderlo
  if ((m = t.match(/^(spegni|non scrivere|accendi|riaccendi|scrivi) (?:il |più il )?diario(?: (?:del|di) (?:progetto)?\s*(.*))?$/))) return { tipo: 'diarioOpz', diario: /accendi|^scrivi/.test(m[1]), progetto: m[2] ? pulisci(m[2]) : null };
  if ((m = t.match(/^(?:apri (?:il )?)?diario (?:del|di) progetto(?: (.+))?$/))) return { tipo: 'diario', progetto: m[1] ? pulisci(m[1]) : null };
  if ((m = t.match(/^(?:apri|vai a|vai su|vai alla?|portami a|mostrami|nota|pagina)\s+(.+)$/)) && !/^(?:il |la )?(?:focus|timer)/.test(m[1])) return { tipo: 'naviga', q: pulisci(m[1]) };
  if (/^(?:note|pagine|home|indice)$/.test(t)) return { tipo: 'naviga', q: t === 'home' ? 'home' : '' };

  // carta: fronte = retro
  if ((m = grezzo.match(/^(?:nuova\s+)?(?:carta|flashcard|domanda)\s*(?:di\s+([^:]+?))?\s*:\s*(.+?)\s*(?:=|->|→|\|)\s*(.+)$/i)))
    return { tipo: 'carta', esame: m[1] ? trovaEsame(m[1]) : null, fronte: m[2], retro: m[3] };

  // simulazione: se prendo 28 in analisi
  if ((m = t.match(/^(?:e )?se (?:prendo|faccio|becco|piglio) (?:un |una )?(\d{2}|trenta)( e lode| lode|l)? (?:ad|all'|nell'|in|di|a)\s*(.+)$/))) {
    const v = m[1] === 'trenta' ? 30 : +m[1];
    if (v >= 18 && v <= 30) return { tipo: 'simula', voto: v, lode: !!m[2] && v === 30, esame: trovaEsame(pulisci(m[3])), nomeDetto: pulisci(m[3]) };
  }

  // voto: ho preso 28 in fisica · 30 e lode ad analisi · ho passato inglese
  if ((m = t.match(/^(?:ho preso|preso|ho fatto|fatto|ho avuto|voto|ho passato|passato|superato|ho superato|ho dato|dato)?\s*(?:un |una )?(\d{2}|trenta)( e lode| lode|l)?\s+(?:ad|all'|allo|alla|nell'|nella|in|di|a)\s+(.+)$/))) {
    const v = m[1] === 'trenta' ? 30 : +m[1];
    if (v >= 18 && v <= 30) return { tipo: 'voto', voto: v, lode: !!m[2] && v === 30, esame: trovaEsame(pulisci(m[3])), nomeDetto: pulisci(m[3]) };
  }
  if ((m = t.match(/^(?:ho )?(?:passato|superato|preso l'idoneit[aà] (?:di|in)) (?:l'idoneit[aà] (?:di|in) |l'esame di )?(.+?)(?: \(?idoneit[aà]\)?)?$/)) && !/\d/.test(m[1]) && trovaEsame(pulisci(m[1])))
    return { tipo: 'idoneita', esame: trovaEsame(pulisci(m[1])), nomeDetto: pulisci(m[1]) };

  // focus
  if ((m = t.match(/^(?:avvia |inizia |iniziamo |fai |faccio |parti |partiamo |metti |un |una )?(?:focus|pomodoro|timer|sessione(?: di studio)?|studio|studia|studiamo|studiare|concentrazione|concentriamoci)\b\s*(.*)$/))) {
    let resto = m[1]; const mi = leggiMinuti(resto); if (mi) resto = resto.replace(mi.pezzo, ' ');
    resto = pulisci(resto.replace(/\s+/g, ' ').trim()); const e = resto ? trovaEsame(resto, { anche: 'daFare' }) || trovaEsame(resto) : null;
    return { tipo: 'focus', min: mi ? Math.min(240, Math.max(1, mi.min)) : null, esame: e, nomeDetto: resto };
  }

  // «l'appello di analisi è il 15 gennaio», «ho analisi 2 il 13 ottobre», «analisi 2 spostato al 20»
  if ((m = t.match(/^(?:l')?(?:appello|esame|scritto|orale) (?:di |de )?(.+?) (?:è|e|sarà|sara|cade|ce l'ho) (?:il |l'|lo |a )?(.+)$/)) || (m = t.match(/^(?:ho|avrò|avro|dò|do) (?:l'esame di |lo scritto di |l'orale di )?(.+?) (il .+|tra .+|fra .+|domani|dopodomani|lunedì.*|martedì.*|mercoledì.*|giovedì.*|venerdì.*|sabato.*)$/)) || (m = t.match(/^(?:l'esame di |esame di |l'appello di )?(.+?) (?:è )?(?:spostato|rinviato|anticipato) (?:al|a|il) (.+)$/))) {
    const d = leggiData(m[2]), e = trovaEsame(pulisci(m[1]));
    if (d && (e || (/esame|appello|scritto|orale/.test(t) && pulisci(m[1]).length >= 3))) return { tipo: 'esame', nome: e?.nome || pulisci(m[1]), cfu: null, data: d.data, esistente: e && !e.fatto ? e : null };
  }
  // nuovo esame: esame di basi di dati il 15 gennaio da 9 cfu
  if ((m = t.match(/^(?:aggiungi |nuovo |segna |segnami |metti |ho |c'e |c'è )?(?:un |l'|il )?(?:esame|appello)\s+(?:di |de )?(.+)$/)) && !/^(?:che|quali|quando|prossim)/.test(m[1])) {
    let resto = ' ' + m[1] + ' ';
    const c = resto.match(/(?:da )?(\d{1,2})\s*(?:cfu|crediti)/); let cfu = null; if (c) { cfu = +c[1]; resto = resto.replace(c[0], ' '); }
    const d = leggiData(resto); if (d) { const r = resto.replace(d.pezzo, ' '); resto = r !== resto ? r : norm(resto).replace(d.pezzo, ' '); }
    const nome = pulisci(String(resto).replace(/\b(il|lo|la|del|per|a|da|ad|e|alle|ore \d+)\s*$/g, '').replace(/\s+(il|del|per|a|da)\s*$/, '').replace(/\s+/g, ' ').trim());
    if (nome) return { tipo: 'esame', nome, cfu, data: d?.data || null, esistente: trovaEsame(nome) };
  }

  // quanto mi serve per 110 / per partire da 100
  if ((m = t.match(/(?:quanto|che media|che voto|cosa) (?:mi )?(?:serve|servirebbe|devo prendere|devo fare|ci vuole).*?(\d{2,3})/))) {
    const b = Math.min(110, +m[1]); if (b >= 66) return { tipo: 'serve', base: b };
  }
  if (/\b(media|libretto|voto di laurea|base di laurea|base|laurea|cfu|crediti|quanto ho)\b/.test(t) && !/\b(spiega|cos'e|cosa e|che cos)/.test(t)) return { tipo: 'libretto' };

  // ripasso
  if ((m = t.match(/^(?:fammi |facciamo |voglio |inizia |avvia )?(?:ripass\w*|flashcard|le carte|carte|schede|ripetere)\s*(.*)$/))) {
    const r = pulisci(m[1] || ''); return { tipo: 'ripasso', esame: r ? trovaEsame(r) : null, nomeDetto: r };
  }

  // interrogazione
  if ((m = t.match(/^(?:interrogami|interroga(?:mi)?|fammi (?:delle |qualche )?domande|simula(?:mo)? (?:l'|un )?orale|orale|mettimi alla prova|quiz)\s*(.*)$/))) {
    const r = pulisci(m[1] || ''); return { tipo: 'orale', esame: r ? trovaEsame(r) : null, nomeDetto: r };
  }

  if (/^(?:i |gli |le )?(?:miei )?(?:esami|appelli|prossimi esami|calendario|sessione|quando ho)/.test(t)) return { tipo: 'esami' };
  if (/^(?:oggi|piano|cosa (?:devo )?studio oggi|che (?:cosa )?studio oggi|cosa studio|cosa faccio oggi|programma)/.test(t)) return { tipo: 'oggi' };

  // ricerca diretta: il nome di un esame da solo apre la sua scheda
  const e = trovaEsame(t);
  if (e && norm(e.nome).startsWith(norm(t)) && norm(t).length >= 3) return { tipo: 'apriEsame', esame: e };
  return null;
}

// giorni, ore e aula di una lezione; quello che resta è il nome del corso
export function leggiOrario(testo) {
  const basso = String(testo).toLowerCase();
  const o = basso.match(/(?:dalle\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|alle|a)\s*(\d{1,2})(?:[:.](\d{2}))?/);
  if (!o) return null;
  let r = ' ' + norm(basso.replace(o[0], ' ')) + ' ';
  const giorni = [], G = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  r = r.replace(/ (?:il |la |ogni )?(lun|mar|mer|gio|ven|sab|dom)[a-z]*\b/g, (_, g) => { giorni.push(G.indexOf(g)); return ' '; });
  if (!giorni.length) return null;
  const hh = (h, mm) => `${String(+h).padStart(2, '0')}:${mm || '00'}`;
  let aula = ''; r = r.replace(/ (?:in )?aula (\w+)/, (_, a) => { aula = a.length <= 3 ? a.toUpperCase() : a.charAt(0).toUpperCase() + a.slice(1); return ' '; });
  const corso = r.replace(/\b(e|il|la|di|dalle|alle|ore|in|ogni|a)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!corso) return null;
  const e = trovaEsame(corso);
  return { corso: e?.nome || corso.replace(/^./, c => c.toUpperCase()), giorni, inizio: hh(o[1], o[2]), fine: hh(o[3], o[4]), aula };
}

export const ESEMPI = [
  ['focus 50 su analisi 2', 'parte il timer e conta le ore'],
  ['ho preso 28 in fisica', 'segna il voto e ricalcola la media'],
  ['esame basi di dati il 15 gennaio 9 cfu', 'aggiunge l\'appello'],
  ['quanto mi serve per 110', 'la media che ti serve da qui alla fine'],
  ['se prendo 30 in analisi 2', 'simula la media'],
  ['ripassa analisi 2', 'le carte di oggi'],
  ['carta: teorema di Green = …', 'una carta al volo'],
  ['esporta per anki', 'carte e definizioni in un file per Anki, un mazzo per corso'],
  ['lezione analisi 2 lunedì e mercoledì 9-11 aula 7', 'l\'orario: Lode sa quando sei in aula'],
  ['★ il teorema di Green lo chiede sempre', 'in aula: segna cosa è da esame'],
  ['def: gradiente = vettore delle derivate parziali', 'in aula: una definizione nella nota'],
  ['gioca', 'due minuti sulle definizioni dell\'ultima lezione'],
  ['trascrivi la lezione', 'in aula: tutta la lezione in appunti, formule comprese, salvata in Obsidian'],
  ['riordina la lezione', 'dalla trascrizione ad appunti puliti (AI)'],
  ['ripeti', 'in aula: cosa ha detto il prof negli ultimi 60 secondi'],
  ['AI', 'collega la tua AI preferita (Claude, ChatGPT, Gemini, Mistral…), a consumo'],
  ['condividi la sbobina', 'la lezione ai compagni: AirDrop, WhatsApp, mail'],
  ['chiudi lezione', 'definizioni e ★ estratte dagli appunti (AI)'],
  ['apri glossario', 'salta a una pagina del vault'],
  ['interrogami su basi di dati', 'simula l\'orale (con l\'AI)'],
  ['cosa stampa', 'esercizi di C: la risposta la calcola Lode, non un\'AI'],
  ['segui progetto', 'guarda la cartella del laboratorio: cosa cambia e se l\'hai provato'],
  ['prova il progetto', 'compila e lancia le prove .in/.out, dopo la tua conferma'],
  ['spiegami l\'errore', 'copia l\'errore dal terminale: te lo spiego in italiano, un passo alla volta'],
  ['diario del progetto', 'apre in Obsidian il diario di oggi'],
  ['smetti di seguire', 'Lode non guarda più la cartella e toglie le sue copie'],
];
export { D };
