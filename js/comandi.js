// Capire una frase in italiano, senza AI: «focus 50 su analisi», «ho preso 28 in fisica», «esame basi di dati il 15 gennaio 9 cfu»,
// «quanto mi serve per 110», «se prendo 30 in analisi 2», «ripassa analisi», «carta: teorema di Green = …».
// Se la frase non è un comando, ritorna null e (se c'è la chiave) ci pensa l'AI.
import { D, MESI, GIORNI, isoGiorno, norm, oggi, piuGiorni, trovaEsame } from './dati.js';

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

export function interpreta(frase) {
  const grezzo = String(frase || '').trim(); if (!grezzo) return null;
  const t = grezzo.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim();
  let m;

  if (/^(aiuto|help|\?|cosa sai fare|che cosa sai fare|comandi)$/.test(t)) return { tipo: 'aiuto' };
  if (/^(stop|ferma|fermati|basta|interrompi|fine|termina)(?: (?:il |la )?(?:focus|timer|pomodoro|sessione|pausa))?$/.test(t)) return { tipo: 'ferma' };
  if (/^(sospendi|metti in pausa|pausa timer)$/.test(t)) return { tipo: 'sospendi' };
  if (/^(riprendi|continua|vai avanti)$/.test(t)) return { tipo: 'riprendi' };

  // in aula: ★ da esame, definizione, domanda per il prof
  if ((m = grezzo.match(/^(?:★|\*{1,2}|!|da esame\s*:?|importante\s*:|stella\s*:?)\s*(.+)$/i))) return { tipo: 'stella', testo: m[1].trim() };
  if ((m = grezzo.match(/^(?:def|definizione)\s*:?\s*(.+?)\s*(?:::|:|=|→|—|-{1,2}>)\s*(.+)$/i))) return { tipo: 'definizione', termine: m[1].replace(/\*\*/g, '').trim(), testo: m[2].trim() };
  if ((m = grezzo.match(/^(?:\?|domanda(?: per il prof)?\s*:)\s*(.+)$/i))) return { tipo: 'domanda', testo: m[1].trim() };

  // l'orario: «lezione analisi 2 lunedì e mercoledì dalle 9 alle 11 aula 7»
  if ((m = t.match(/^(?:aggiungi |nuova |ho )?(?:lezione|lezioni|corso)\s+(?:di\s+)?(.+)$/))) {
    const o = leggiOrario(m[1]); if (o) return { tipo: 'orario', ...o };
  }
  if (/^(?:orario|il mio orario|le mie lezioni|lezioni|quando ho lezione|che lezione ho)$/.test(t)) return { tipo: 'vediOrario' };
  if ((m = t.match(/^(?:gioca(?:mo)?|gioco|giochino|memory|allenami|allenamento|fissa(?:mi)? le definizioni|definizioni)\b\s*(.*)$/))) {
    const r = pulisci(m[1] || ''); return { tipo: 'gioco', corso: r || null };
  }
  if (/^(?:apri )?(?:gli |i miei )?(?:appunti|obsidian|vault|la nota|nota)( di oggi| della lezione)?$/.test(t)) return { tipo: 'appunti' };

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
  if ((m = t.match(/^(?:ho )?(?:passato|superato|dato|preso) (?:l'idoneit[aà] (?:di|in) )?(.+?)(?: \(?idoneit[aà]\)?)?$/)) && !/\d/.test(m[1]))
    return { tipo: 'idoneita', esame: trovaEsame(pulisci(m[1])), nomeDetto: pulisci(m[1]) };

  // focus
  if ((m = t.match(/^(?:avvia |inizia |iniziamo |fai |faccio |parti |partiamo |metti |un |una )?(?:focus|pomodoro|timer|sessione(?: di studio)?|studio|studia|studiamo|studiare|concentrazione|concentriamoci)\b\s*(.*)$/))) {
    let resto = m[1]; const mi = leggiMinuti(resto); if (mi) resto = resto.replace(mi.pezzo, ' ');
    resto = pulisci(resto.replace(/\s+/g, ' ').trim()); const e = resto ? trovaEsame(resto, { anche: 'daFare' }) || trovaEsame(resto) : null;
    return { tipo: 'focus', min: mi ? Math.min(240, Math.max(1, mi.min)) : null, esame: e, nomeDetto: resto };
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
  ['lezione analisi 2 lunedì e mercoledì 9-11 aula 7', 'l\'orario: Lode sa quando sei in aula'],
  ['★ il teorema di Green lo chiede sempre', 'in aula: segna cosa è da esame'],
  ['def: gradiente = vettore delle derivate parziali', 'in aula: una definizione nella nota'],
  ['gioca', 'due minuti sulle definizioni dell\'ultima lezione'],
  ['interrogami su basi di dati', 'simula l\'orale (con l\'AI)'],
];
export { D };
