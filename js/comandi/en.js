// Il riconoscitore inglese (smistato da js/comandi.js): le frasi che scriverebbe davvero uno studente inglese o americano,
// senza AI: «focus 50 on calculus 2», «I got 28 in physics», «exam databases on 15 January 9 credits», «what do I need for
// 110», «review calculus», «card: Green's theorem = …», «explain the error», «follow project», «language italian».
// Restituisce gli stessi oggetti { tipo, … } del riconoscitore italiano (js/comandi/it.js), campo per campo: il resto della
// barra non sa in che lingua è arrivata la frase. È anche la riserva delle altre lingue: comandi.js lo prova quando il
// riconoscitore della lingua scelta non capisce. Se la frase non è un comando ritorna null e (se c'è la chiave) ci pensa l'AI.
// I voti restano quelli detti (28, 30 cum laude): come leggerli lo decide il sistema dei voti (js/sistemi.js), non qui.
import { norm, oggi, piuGiorni, trovaEsame } from '../dati.js';
import { sembraErrore, dataInCifre, conAnno, orarioOk, oreInCifre, hh, linguaDetta } from './comune.js';

const GIORNI = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MESI = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
// i nomi delle lingue detti in inglese (quelli nella loro lingua li conosce comune.js)
const LINGUE_EN = { italian: 'it', english: 'en', spanish: 'es', french: 'fr', german: 'de', portuguese: 'pt' };

// i numeri detti a voce: «twenty-eight» → 28, «fifty» → 50, «a hundred and ten» → 110
const UNITA = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const DECINE = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const U = UNITA.join('|'), U9 = UNITA.slice(1, 10).join('|'), DD = Object.keys(DECINE).join('|');
const sotto100 = `(?:(?:${DD})(?:[ -](?:${U9}))?|(?:${U}))`;
const NUMERO = new RegExp(`\\b(?:(?:a|one) hundred(?:(?: and)? ${sotto100})?|${sotto100})\\b`, 'gi');
function valore(s) {
  let v = 0; s = s.toLowerCase();
  if (/hundred/.test(s)) { v = 100; s = s.replace(/^.*hundred(?: and)?\s*/, ''); }
  for (const w of s.split(/[ -]+/)) if (w in DECINE) v += DECINE[w]; else if (UNITA.includes(w)) v += UNITA.indexOf(w);
  return v;
}
// «one» resta parola quando è un pronome («this one», «which one»), ma «one hour» e «one hundred» sono numeri
// i refusi più comuni di chi scrive in fretta (come SENTITO in it.js per la voce): «fourty», «reveiw», «langauge»
const REFUSI = { fourty: 'forty', fourtyfive: 'forty-five', reveiw: 'review', reivew: 'review', revew: 'review', langauge: 'language', lanugage: 'language', languge: 'language', pomodorro: 'pomodoro', focsu: 'focus', fcous: 'focus', excercise: 'exercise', excercises: 'exercises' };
export const numeri = t => String(t).replace(/\b[a-z]+\b/gi, w => REFUSI[w.toLowerCase()] || w).replace(NUMERO, (w, i, tutto) => (/^one$/i.test(w) && /\b(?:this|that|which|the|each|every|any|no|some) $/i.test(tutto.slice(0, i)) ? w : String(valore(w))));
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 };
const n = s => (s in NUM ? NUM[s] : Number(s));

export function leggiData(testo) {
  const t = ' ' + norm(testo) + ' ', T = oggi();
  let m;
  if (/ (?:the )?day after tomorrow /.test(t)) return { data: piuGiorni(T, 2), pezzo: (t.match(/ ((?:the )?day after tomorrow) /) || [])[1] };
  if (/ tomorrow /.test(t)) return { data: piuGiorni(T, 1), pezzo: 'tomorrow' };
  if (/ today /.test(t)) return { data: T, pezzo: 'today' };
  if ((m = t.match(/ in (\d+|\w+) (days?|weeks?|months?) /))) {
    const k = n(m[1]); if (k) return { data: piuGiorni(T, k * (m[2].startsWith('week') ? 7 : m[2].startsWith('month') ? 30 : 1)), pezzo: m[0].trim() };
  }
  { const c = dataInCifre(t, testo); if (c) return c; }
  // i mesi interi o abbreviati («jan», «sept»), mai l'inizio di un'altra parola («deck», «marker»)
  const mesi = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)', ord = '(?:st|nd|rd|th)?';
  if ((m = t.match(new RegExp(` (?:the )?(\\d{1,2})${ord} (?:of )?(${mesi}) (?:(\\d{4}) )?`)))) {
    const me = MESI.findIndex(x => x.startsWith(m[2]));
    return { data: conAnno(+m[1], me, m[3] ? +m[3] : null), pezzo: m[0].trim() };
  }
  if ((m = t.match(new RegExp(` (${mesi}) (?:the )?(\\d{1,2})${ord} (?:(\\d{4}) )?`)))) {
    const me = MESI.findIndex(x => x.startsWith(m[1]));
    return { data: conAnno(+m[2], me, m[3] ? +m[3] : null), pezzo: m[0].trim() };
  }
  if ((m = t.match(new RegExp(` (?:(?:on|this|next|coming) )?(${GIORNI.join('|')}) `)))) {
    const dow = GIORNI.indexOf(m[1]), d = new Date(T + 'T12:00'); const k = (dow - d.getDay() + 7) % 7 || 7;
    return { data: piuGiorni(T, k), pezzo: m[0].trim() };
  }
  return null;
}
// un esame senza nome: «an exam», «a test», «my final», «the midterm», o solo l'articolo («I have an exam tomorrow»)
const SENZA_NOME = /^(?:(?:an?|the|my|one|another|this|that) )?(?:exam|test|oral|written|final|midterm|quiz)s?$|^(?:an?|the|my|one|another|this|that|next|coming|on|in|at)$/;
const pulisci = s => s.replace(/^\s*(?:of|for|on|in|at|about|to|the|my|exam( of| for| in)?)\s+/i, '').replace(/^\s*(?:the|my)\s+/i, '').replace(/[?.!,;:]+$/, '').replace(/\s+(?:for|of|on|in|at|to|with|from|the)\s*$/i, '').trim().replace(/^(?:of|for|on|in|at|about|to|the|my|with)$/i, '');

// minuti detti a parole: «50», «50 minutes», «an hour», «half an hour», «an hour and a half», «2 hours», «90 min»
function leggiMinuti(t) {
  let m;
  if (/half an? hour/.test(t) && !/hour and a half/.test(t)) return { min: 30, pezzo: t.match(/half an? hour/)[0] };
  if ((m = t.match(/(?:^|\s)(\d+|an|a|one|two|three)\s*(?:hours?|hrs?|h)\b(\s*and a half)?/))) return { min: n(m[1]) * 60 + (m[2] ? 30 : 0), pezzo: m[0].trim() };
  if ((m = t.match(/(?:^|\s)(\d+|[a-z]+)\s*(?:minutes?|mins?)\b|(?:^|\s)(\d+)\s*m\b/))) { const k = n(m[1] || m[2]); if (k) return { min: k, pezzo: m[0].trim() }; }
  // un numero da solo: all'inizio («focus 50 on …») o in fondo dopo «for» («study physics for 50»), non il «2» di «calculus 2»
  if ((m = t.match(/^\s*(\d{1,3})(?=\s|$)/)) || (m = t.match(/\bfor (\d{1,3})$/))) return { min: +m[1], pezzo: m[0].trim() };
  return null;
}

// i comandi di «Segui il progetto» (in italiano stanno in js/codice/progetto.js): stessi oggetti { tipo: 'progetto', azione, nome? }
const PROGETTO = [
  [/^(?:follow|watch|track)(?: (?:the|a|this|my|a new))? project$/, () => ({ azione: 'segui' })],
  [/^what(?:'s| has| is)? changed(?: (?:in|on) (.+))?$/, m => ({ azione: 'cambiato', nome: m[1] })],
  [/^(?:show (?:me )?|see )?(?:the )?changes(?: (?:in|to|of|on) (.+))?$/, m => ({ azione: 'cambiato', nome: m[1] })],
  [/^(?:did i )?test(?:ed)? it$|^(?:is it )?tested$/, () => ({ azione: 'provato' })],
  [/^(?:test|run|check) (?:the |my )?(?:project|code|program)(?: (.+))?$/, m => ({ azione: 'prova', nome: m[1] })],
  [/^(?:compile|build)(?: (?:the |my )?(?:project|code|program)(?: (.+))?)?$/, m => ({ azione: 'prova', nome: m[1] })],
  [/^stop (?:following|watching|tracking)(?: (?:the )?(?:project )?(.+))?$/, m => ({ azione: 'smetti', nome: m[1] })],
  [/^(?:prepare me|prep me|get me ready) for (?:the )?(?:discussion|project discussion|defen[cs]e)(?: (?:of|for|on) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:i'm |im |i am )?ready for (?:the )?(?:discussion|defen[cs]e)(?: (?:of|for|on) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:the )?functions to explain(?: (?:in|of|for) (.+))?$/, m => perDiscussione(m[1])],
  [/^discussion$/, () => ({ azione: 'discussione' })],
  [/^discussion (?:of|for|on) (.+)$/, m => perDiscussione(m[1])],
];
// come in progetto.js: senza nome il progetto più recente, con un nome solo se ha l'aria di un laboratorio («lab3», un numero)
const perDiscussione = nome => (!nome ? { azione: 'discussione' } : /\d|\blab|project/.test(nome) ? { azione: 'discussione', nome } : null);
function interpretaProgetto(testo) {
  const t = String(testo || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim();
  for (const [re, f] of PROGETTO) {
    const m = re.exec(t); if (!m) continue;
    const r = f(m); if (!r) continue;
    const c = { tipo: 'progetto', ...r }, nome = c.nome?.replace(/^(?:the |my )?(?:project|code|program)\b\s*/, '').trim();
    if (nome) c.nome = nome; else delete c.nome;
    return c;
  }
  return null;
}

export function interpreta(frase) {
  const grezzo0 = String(frase || '').trim(); if (!grezzo0) return null;
  // informatica: «explain the error», anche con l'errore incollato dopo. Solo se dopo «error» non c'è niente, ci sono i due
  // punti o un a capo, o c'è davvero un errore del compilatore: «what does standard error mean» resta all'AI
  let e0;
  if ((e0 = grezzo0.match(/^(?:explain|explain to me|what does|what's|whats|what is|help me with) (?:the |this |my )?(?:compiler )?error\b([\s\S]*)$/i))) {
    const dopo = e0[1].replace(/^[ \t]+/, ''), testo = dopo.replace(/^:/, '').trim();
    const solo = !testo || /^[?.!]+$/.test(testo) || /^(?:mean|say|from the compiler|i copied|(?:i )?just copied)[?.!]*$/i.test(testo);
    if (solo) return { tipo: 'errore', testo: null };
    if (/^[:\n]/.test(dopo) || sembraErrore(testo)) return { tipo: 'errore', testo };
  }
  const pr = interpretaProgetto(grezzo0); if (pr) return pr;
  // la voce aggiunge maiuscole e un punto finale; i numeri arrivano a parole
  const grezzo = numeri(grezzo0.replace(/[.!]+$/, ''));
  const t = grezzo.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim().replace(/^please,? |,? please$/g, '');
  let m;

  // la lingua della barra: «language italian», «switch to German», «change language to Spanish», «language: español»
  if ((m = t.match(/^(?:(?:change|switch|set)(?: the)?(?: app)?(?: language)?(?: to| into)?|language:?(?: to)?|(?:speak|talk|answer|reply) in|use|i want (?:lode |the app |it )?in|in) (\S+)$/)) && linguaDetta(m[1], LINGUE_EN)) return { tipo: 'lingua', codice: linguaDetta(m[1], LINGUE_EN) };
  if (/^(help|help me|\?|what can you do|what can i (?:say|type|ask)|commands)$/.test(t)) return { tipo: 'aiuto' };
  if (/^(stop|end|finish|quit|enough|cancel)(?: (?:the |my )?(?:focus|timer|pomodoro|session|break))?$/.test(t)) return { tipo: 'ferma' };
  if (/^(pause|pause (?:the )?timer|hold on)$/.test(t)) return { tipo: 'sospendi' };
  if (/^(resume|continue|go on|keep going|resume (?:the )?timer)$/.test(t)) return { tipo: 'riprendi' };
  // Anki: «export to anki», «anki», «export my calculus 2 cards to anki», «anki physics 2». Serve un verbo o la frase che
  // comincia da «anki» o dalle carte: «how do I import into anki», «anki how does it work», «download anki» restano all'AI
  if (/\banki\b/.test(t) && (m = t.match(/^(?:(?:export|send|move|put|save|prepare|create|make|download)\b\s*)?(.*)$/)) && (m[0] !== m[1] || /^(?:anki\b|(?:all )?(?:the |my )?(?:cards|flashcards|decks?|definitions)\b)/.test(m[1]))) {
    const r = pulisci(m[1].replace(/(?:\b(?:to|for|into|in|on) )?\banki\b/, ' ').replace(/\b(?:all )?(?:of )?(?:the |my )?(?:new )?(?:cards|flashcards|decks?|definitions)\b/, ' ').trim().replace(/\s+/g, ' '));
    // «anki <qualcosa>» senza verbo è un comando solo se <qualcosa> è un esame: «anki physics 2» sì, «anki how does it work» o
    // una frase di un'altra lingua arrivata fin qui («anki come si usa») no
    const domanda = m[0] === m[1] && r && (/\?\s*$/.test(grezzo0) || /^(?:how|what|why|where|when|does|do|is|are|can|should|will|works?|vs|or|not)(?=[\s']|$)/.test(r) || !trovaEsame(r));
    const programma = /^download\b/.test(t) && /^anki$/.test(m[1].trim());
    if (!domanda && !programma) return { tipo: 'anki', corso: r && !/^(?:all|everything|all courses|every course|all of them)$/.test(r) ? r : null };
  }
  // «pocket review» (Ripasso in tasca, js/tasca.js): le carte di domani in una nota, da fare sul telefono con Obsidian
  const TASCA = '(?:the |my )?(?:pocket review|pocket cards|(?:review|cards) (?:in my pocket|on (?:my|the) phone))';
  if (t.match(new RegExp(`^(?:don't (?:make|put|do|send)|turn off|stop|no more) ${TASCA}(?: every evening| every night)?$`))) return { tipo: 'tasca', sera: false };
  if ((m = t.match(new RegExp(`^(?:(?:make|put|send|prepare|write|update|give|do)(?: me)? )?${TASCA}( every evening| every night| only when i ask)?$`)))) return m[1] ? { tipo: 'tasca', sera: !/ask/.test(m[1]) } : { tipo: 'tasca' };

  // il programma d'esame: «syllabus for calculus 2», «syllabus», «calculus 2 syllabus: 1. limits …» (incollato, anche su più
  // righe). «plan for today» resta il piano di oggi
  if ((m = grezzo0.match(/^(?:(?:open|show me|show|see|here's|here is|paste) )?(?:the |my )?(?:exam |course )?(?:syllabus|programme|exam topics|topic list)(?:\s+(?:of|for|in)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i)) || (m = grezzo0.match(/^(?:(?:open|show me|here's|here is|paste) )?(?:the |my )?([^:\n]+?) (?:syllabus|exam topics)\s*(?:[:\n]([\s\S]*))?$/i))) {
    if (!/^(?:for )?(?:today|tomorrow)$/i.test(m[1].trim())) { const nome = pulisci(numeri(m[1]).toLowerCase()); return { tipo: 'programma', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() }; }
  }
  // «let me explain: green», «I'll explain power series»: lo studente spiega, Lode controlla cosa ha detto
  if ((m = t.match(/^(?:let me explain|i'll explain|i will explain|i explain|let me teach you|i'll teach you)\b(?: it)?(?: to you)?\s*:?\s*(.*)$/))) return { tipo: 'spiego', q: pulisci(m[1] || '') };
  // le domande uscite agli appelli: «past exam questions for calculus 2: …» (una per riga)
  if ((m = grezzo0.match(/^(?:(?:here are|paste|add) )?(?:the )?(?:past exam questions|exam questions|past questions|questions from (?:past|previous|old) exams|questions asked at the exam)(?:\s+(?:of|for|from|in)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i))) {
    const nome = pulisci(numeri(m[1]).toLowerCase()); return { tipo: 'domande', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  // i temi d'esame (js/temi.js): «past papers for calculus 2: Exercise 1 …», «old exams for physics»; «exercise for calculus 2»,
  // «give me an exercise» = l'esercizio di oggi. «exercises in c», «exercise in python» restano a «What does it print?»
  if ((m = grezzo0.match(/^(?:(?:here are|here is|paste|add|open|show me) )?(?:the |an? |my )?(?:past (?:exam )?papers?|old (?:exam )?papers?|old exams?|past exams?|exam exercises|exercises from (?:old|past) exams)(?:\s+(?:of|for|from|in)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i))) {
    const nome = pulisci(numeri(m[1]).toLowerCase()); return { tipo: 'temi', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  if ((m = t.match(/^(?:(?:give me|let me do|let's do|i'll do|do) )?(?:an |the |today's |my )?exercise(?: of the day| for today| from an exam)?(?:\s+(?:of|for|on|in)\s+(?!(?:c|c\+\+|java|python|programming)$)(.+))?$/))) {
    const nome = pulisci(m[1] || ''); return { tipo: 'temi', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: '' };
  }
  // la prova generale (js/prova.js): un compito vecchio intero col tempo vero. «mock exam for calculus 2», «full past paper»
  if ((m = t.match(/^(?:(?:let me do|let's do|do|start|begin|open|i want to do) )?(?:a |the |an )?(?:mock exam|full (?:past )?paper|whole (?:past )?paper|full exam|dress rehearsal|full practice exam)(?:\s+(?:of|for|in|on)\b)?\s*(.*)$/))) {
    const nome = pulisci(m[1] || ''); return { tipo: 'prova', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome };
  }

  // in aula: ★ da esame, definizione, domanda per il prof
  if ((m = grezzo.match(/^(?:★|\*{1,2}|!|exam\s*:|important\s*:|star\b\s*:?|(?:mark|flag)(?: this)?(?: as)? (?:for the )?exam\s*:?|this (?:is|will be) (?:on|in) the exam\s*:?)\s*(.+)$/i))) return { tipo: 'stella', testo: m[1].trim() };
  if ((m = grezzo.match(/^(?:definition|define|def)\s*:?\s*(.+?)\s*(?:::|:|=|→|—|-{1,2}>|\bequals\b|\bmeans\b|\bis\b)\s*(.+)$/i))) return { tipo: 'definizione', termine: m[1].replace(/\*\*/g, '').trim(), testo: m[2].trim() };
  if ((m = grezzo.match(/^(?:\?|question\s*:|question for the (?:prof(?:essor)?|lecturer|teacher)\s*:?|ask the (?:prof(?:essor)?|lecturer|teacher)\s*:?)\s*(.+)$/i))) return { tipo: 'domanda', testo: m[1].trim() };

  // l'orario: «lecture calculus 2 monday and wednesday 9-11 room 7»
  if ((m = t.match(/^(?:add |new |i have )?(?:a )?(?:lecture|lectures|class|classes|course)\s+(?:of |in |on |for )?(.+)$/))) {
    const o = leggiOrario(m[1]); if (o) return { tipo: 'orario', ...o };
  }
  if (/^(?:(?:my )?timetable|(?:my )?class schedule|my schedule|my classes|my lectures|when do i have (?:class|lectures)|what class do i have|which class do i have)$/.test(t)) return { tipo: 'vediOrario' };
  { const l = leggiLavoro(t); if (l) return l; }
  if (/^(?:the |my )?(?:weekly plan|week plan|plan (?:for|of) the week|plan for this week|this week'?s plan)$|^(?:my week|my free time|free time|my free hours|free hours|how much time do i have(?: to study)?)$/.test(t)) return { tipo: 'ore' };
  // «What does it print?»: esercizi di C (anche in Java e in Python) con la risposta calcolata da Lode
  if (/^(?:what does (?:it|this(?: code| program)?) print|what prints|exercises? (?:in |on )?(?:c|programming)|train me (?:on|in) c)$/.test(t)) return { tipo: 'stampa' };
  if ((m = t.match(/^(?:what does (?:it|this(?: code| program)?) print(?: in)?|what prints(?: in)?|exercises? (?:in|on)|train me (?:on|in)) (c|java|python)$/))) return { tipo: 'stampa', lingua: m[1] };
  if ((m = t.match(/^(?:play|let's play|game|minigame|mini game|memory|train me|training|drill(?: me)?(?: on)?(?: the)? definitions|definitions)\b\s*(.*)$/))) {
    const r = pulisci((m[1] || '').replace(/\b(?:with me|together)\b/, ' ').trim()); return { tipo: 'gioco', corso: r || null };
  }
  if (/^(?:open )?(?:my |the )?(?:notes|obsidian|vault|today's notes?|lecture notes?)(?: for today| from today| of today| of the lecture)?$/.test(t)) return { tipo: 'appunti' };
  // «lecture from the computer»: la videolezione (Teams, Zoom, la piattaforma online) trascritta dall'audio del computer
  if ((m = t.match(/^(?:(?:transcribe|record|listen to)(?: (?:the|this|a))? ?(?:video lecture|videolecture|video|computer audio|audio (?:from|of) the (?:computer|pc|mac)|lecture (?:from|on) the (?:computer|pc|mac|browser)|online lecture|recorded lecture)|(?:lecture|video lecture) from the (?:computer|pc|mac)|listen to the (?:computer|pc|mac))\b\s*(?:of |for |on |from |in )?(.*)$/))) return { tipo: 'trascrivi', sorgente: 'computer', corso: pulisci(m[1] || '') || null };
  if (/^transcribe$|^(?:transcribe|record|listen to)(?: (?:the|the whole|this))? (?:lecture|class)\b|^(?:start|begin) (?:the )?(?:transcription|transcribing|recording)/.test(t)) return { tipo: 'trascrivi' };
  if (/^(?:repeat|repeat that|repeat (?:the last sentence|the last \d+ seconds|what (?:he|she|they) said)|what did (?:he|she|they|the prof|the professor|the lecturer) (?:just )?say|i didn't (?:get|catch) that|i missed (?:something|a sentence|that)|say that again)$/.test(t)) { const sec = +(t.match(/(\d+) seconds/)?.[1] || 60); return { tipo: 'ripeti', sec: Math.min(90, sec) }; }
  if (/^(?:turn off|disable|stop)(?: the)? repeat$/.test(t)) return { tipo: 'spegniRipeti' };
  if ((m = t.match(/^(?:suggestions|tips)\s+(never|off|few|rare|normal|frequent|often|many|lots)$|^(?:turn off|disable|stop|no more)(?: the)? (?:suggestions|tips)$/))) return { tipo: 'proposte', livello: !m[1] || /never|off/.test(m[1]) ? 'mai' : /few|rare/.test(m[1]) ? 'poco' : /frequent|often|many|lots/.test(m[1]) ? 'spesso' : 'normale' };
  if (/^(?:suggest|give me|propose) (?:something|a review|a game)|^what (?:should|can) i do (?:now|next)$|^what should i review$/.test(t)) return { tipo: 'proponi' };
  if (/^(?:share|send|pass)(?: the| my)? (?:transcript|lecture|transcription|notes)\b/.test(t)) { const r = pulisci(t.replace(/^.*?(transcript|lecture|transcription|notes)\s*/, '').replace(/^(?:with|to) (?:my )?(?:classmates|friends|colleagues|course mates)\s*/, '')); return { tipo: 'condividi', corso: r || null }; }
  if (/^(?:stop|end|finish|close)(?: the)? (?:transcription|recording|transcribing)|^(?:the )?lecture(?: is| has)? (?:over|finished|ended)$|^end of (?:the )?lecture$/.test(t)) return { tipo: 'fineTrascrizione' };
  if (/^pause(?: the)? (?:transcription|recording)/.test(t)) return { tipo: 'pausaTrascrizione' };
  if (/^(?:resume|continue)(?: the)? (?:transcription|recording)/.test(t)) return { tipo: 'riprendiTrascrizione' };
  if (/^(?:tidy(?: up)?|clean(?: up)?|reorgani[sz]e|sort out)(?: the| my)? (?:lecture|notes|transcription|transcript)\b/.test(t)) { const r = pulisci(t.replace(/^.*?(lecture|notes|transcription|transcript)\s*/, '')); return { tipo: 'riordina', corso: r || null }; }
  if (/^(?:close|finish|wrap up)(?: the)? lecture\b|^extract(?: the)? definitions/.test(t)) { const r = pulisci(t.replace(/^.*?(lecture|definitions)\s*/, '')); return { tipo: 'chiudiLezione', corso: r || null }; }
  // la tua AI: «AI», «connect chatgpt», «use gemini», «my key»
  { const FORN = { claude: 'anthropic', anthropic: 'anthropic', chatgpt: 'openai', openai: 'openai', gpt: 'openai', gemini: 'google', google: 'google', mistral: 'mistral', groq: 'groq', openrouter: 'openrouter', deepseek: 'deepseek' };
    const m = t.match(/^(?:my ai|ai|artificial intelligence|(?:my )?(?:api )?key|api ?key|(?:connect|use|set|add)(?: the key(?: for)?| my)? (claude|anthropic|chatgpt|openai|gpt|gemini|google|mistral|groq|openrouter|deepseek|ai|my ai|a key|an api key|key))$/);
    if (m) return { tipo: 'ai', fornitore: FORN[m[1]] || null }; }
  // la sincronizzazione fra i computer
  if (/^(?:stop|turn off|disable)(?: the)? sync(?:ing|hroni[sz]ation|hroni[sz]ing)?\b|^stop on this (?:computer|pc|mac)\b/.test(t)) return { tipo: 'sincronizza', cosa: 'smetti' };
  if (/^(?:change|new)(?: the| my)? password\b|^i forgot(?: my| the)? password\b/.test(t)) return { tipo: 'sincronizza', cosa: 'password' };
  if (/^unlock(?: (?:the )?sync(?:hroni[sz]ation)?| my data| lode)?$/.test(t)) return { tipo: 'sincronizza', cosa: 'sblocca' };
  if (/^(?:connect|link|add) (?:an)?other (?:computer|pc|mac)\b/.test(t)) return { tipo: 'sincronizza', cosa: 'altro' };
  if (/^(?:i already use|i already have|i use|connect me to)(?: lode)? (?:on |from |with )?(?:an)?other (?:computer|pc|mac)\b/.test(t)) return { tipo: 'sincronizza', cosa: 'collega' };
  if (/^(?:sync|synchroni[sz]e|synchroni[sz]ation)\b|^(?:turn on|enable|manage|open)(?: the)? sync/.test(t)) return { tipo: 'sincronizza', cosa: null };
  if (/^(?:prepare|configure|install|set ?up)\b/.test(t)) return { tipo: 'prepara', cosa: /obsidian/.test(t) ? 'obsidian' : /model|brain|ollama|gemma|qwen|\bai\b/.test(t) ? 'cervello' : null };
  // il diario del progetto nel vault: aprirlo, spegnerlo, riaccenderlo
  if ((m = t.match(/^(turn off|don't write|stop writing|turn on|turn back on|write) (?:the )?(?:project )?(?:diary|journal|log)(?: (?:of|for) (?:the )?(?:project)?\s*(.*))?$/))) return { tipo: 'diarioOpz', diario: /^(?:turn (?:back )?on|write)$/.test(m[1]), progetto: m[2] ? pulisci(m[2]) : null };
  if ((m = t.match(/^(?:open (?:the )?)?(?:project (?:diary|journal|log)|(?:diary|journal|log) (?:of|for) (?:the )?project)(?: (?:of |for )?(.+))?$/))) return { tipo: 'diario', progetto: m[1] ? pulisci(m[1]) : null };
  if ((m = t.match(/^(?:open|go to|take me to|show me|page)\s+(.+)$/)) && !/^(?:the )?(?:focus|timer)/.test(m[1])) return { tipo: 'naviga', q: pulisci(m[1]) };
  if (/^(?:all notes|pages|home|index)$/.test(t)) return { tipo: 'naviga', q: t === 'home' ? 'home' : '' };

  // carta: fronte = retro
  if ((m = grezzo.match(/^(?:new\s+)?(?:card|flashcard)\s*(?:(?:for|of|in)\s+([^:]+?))?\s*:\s*(.+?)\s*(?:=|->|→|\|)\s*(.+)$/i)))
    return { tipo: 'carta', esame: m[1] ? trovaEsame(m[1]) : null, fronte: m[2], retro: m[3] };

  // simulazione: «what if I get 28 in calculus». I voti sono quelli detti (scala italiana per ora: il sistema dei voti decide)
  const LODE = '( with honou?rs| cum laude| e lode| lode| with distinction)?';
  if ((m = t.match(new RegExp(`^(?:and |so )?(?:what )?if i (?:get|got|score|take) (?:an? )?(\\d{2})${LODE} (?:in|on|for|at)\\s*(.+)$`)))) {
    const v = +m[1];
    if (v >= 18 && v <= 30) return { tipo: 'simula', voto: v, lode: !!m[2] && v === 30, esame: trovaEsame(pulisci(m[3])), nomeDetto: pulisci(m[3]) };
  }
  // voto: «I got 28 in physics» · «30 cum laude in calculus» · «I passed english»
  if ((m = t.match(new RegExp(`^(?:i got|got|i scored|scored|i passed|passed|i took|grade|mark)?\\s*(?:an? )?(\\d{2})${LODE}\\s+(?:in|on|for|at)\\s+(.+)$`)))) {
    const v = +m[1];
    if (v >= 18 && v <= 30) return { tipo: 'voto', voto: v, lode: !!m[2] && v === 30, esame: trovaEsame(pulisci(m[3])), nomeDetto: pulisci(m[3]) };
  }
  if ((m = t.match(/^(?:i )?(?:passed|cleared|got through) (?:the )?(?:pass\/fail (?:exam )?(?:in|of|for) |exam (?:in|of|for) |test (?:in|of|for) )?(.+?)(?: \(?pass\/fail\)?)?$/)) && !/\d/.test(m[1]) && trovaEsame(pulisci(m[1])))
    return { tipo: 'idoneita', esame: trovaEsame(pulisci(m[1])), nomeDetto: pulisci(m[1]) };

  // focus
  // anche con i minuti prima: «start a 25 minute pomodoro on calculus»
  if ((m = t.match(/^(?:(?:start|begin|let's|lets|do|set|run) )?(?:a |an )?(?:(\d{1,3})[ -]?(?:minutes?|mins?|m) )?(?:focus|pomodoro|timer|study session|session|study|studying|concentrate|concentration|deep work)\b\s*(.*)$/))) {
    // «focus for 45 minutes on databases»: il «for» dei minuti non fa parte del nome
    let resto = m[2].replace(/^for (?=\d|an? |half |one |two |three )/, '').replace(/\b(?:with me|together)\b/, ' ');
    // «studying is hard», «focus mode doesn't work», «study tips for finals», «session expired»: frasi, non un timer
    if (!/^(?:is|are|was|were|be|been|has|have|had|does|doesn't|don't|isn't|wasn't|won't|can't|cannot|will|would|should|mode|tips?|advice|techniques?|methods?|music|playlist|apps?|recommendations?|ideas?|group|buddy|partner|expired|ended|sucks|hard|harder)\b/.test(resto.trim())) {
      const mi = m[1] ? { min: +m[1] } : leggiMinuti(resto); if (mi?.pezzo) resto = resto.replace(mi.pezzo, ' ');
      resto = pulisci(resto.replace(/\s+/g, ' ').trim()); const e = resto ? trovaEsame(resto, { anche: 'daFare' }) || trovaEsame(resto) : null;
      return { tipo: 'focus', min: mi ? Math.min(240, Math.max(1, mi.min)) : null, esame: e, nomeDetto: resto };
    }
  }

  // «the calculus exam is on 15 January», «I have calculus 2 on 13 October», «calculus 2 moved to the 20th of January»
  const QUANDO = '(on .+|in \\d.+|tomorrow|the day after tomorrow|next .+|this .+|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday).*)';
  if ((m = t.match(/^(?:the )?(?:exam|test|written exam|written|oral(?: exam)?|final) (?:for |of |in )?(.+?) (?:is|will be|falls) (?:on |in |at )?(.+)$/)) || (m = t.match(/^(?:the )?(.+?) (?:exam|test|oral|written exam|final) (?:is|will be|falls) (?:on |in |at )?(.+)$/)) || (m = t.match(new RegExp(`^i (?:have|got|take|sit) (?:(?:the|an|a|my) (?:exam|test|oral|written exam) (?:for |of |in |on )?|my )?(.+?) (?:exam )?${QUANDO}$`))) || (m = t.match(/^(?:the )?(?:exam (?:for |of |in )?)?(.+?) (?:exam )?(?:is |was |has been )?(?:moved|postponed|brought forward|rescheduled) (?:to|on|for) (.+)$/))) {
    // «I have an exam tomorrow», «I have a test on friday»: senza il nome dell'esame non è un comando (e «an» non è Analisi)
    const d = SENZA_NOME.test(pulisci(m[1])) ? null : leggiData(m[2]), e = d && trovaEsame(pulisci(m[1]));
    if (d && (e || (/exam|test|written|oral|final/.test(t) && pulisci(m[1]).length >= 3))) return { tipo: 'esame', nome: e?.nome || pulisci(m[1]), cfu: null, data: d.data, esistente: e && !e.fatto ? e : null };
  }
  // nuovo esame: «exam databases on 15 January 9 credits», «add exam physics 2 worth 6 ECTS»
  if ((m = t.match(/^(?:add |new |mark |put |i have |there's |there is )?(?:an |the |a )?(?:exam|test)\s*:?\s+(?:for |of |in |on )?(.+)$/)) && !/^(?:me|what|which|when|next|upcoming|dates?|schedule|calendar|session|questions|exercises|papers?|simulation|topics)\b/.test(m[1]) && !/^(?:di|del|della|de|du|des|der|die|das|von|da|do|dos)\b/.test(m[1])) {
    let resto = ' ' + m[1].replace(/[,;]/g, ' ') + ' ';
    const c = resto.match(/(?:worth |with |of |for )?(\d{1,2})\s*(?:cfu|credits?|ects|credit hours|cr)\b/); let cfu = null; if (c) { cfu = +c[1]; resto = resto.replace(c[0], ' '); }
    const d = leggiData(resto); if (d) { const r = resto.replace(d.pezzo, ' '); resto = r !== resto ? r : norm(resto).replace(d.pezzo, ' '); }
    const nome = pulisci(String(resto).replace(/\b(on|the|of|for|at|and|worth|with|in)\s*$/g, '').replace(/\s+(on|the|of|for|at)\s*$/, '').replace(/\s+/g, ' ').trim());
    // «test» da solo è una parola di tutte le lingue («test non passano»): vale come esame solo con una data o i crediti
    // «exam anxiety tips», «exam prep strategies»: senza data né crediti sono domande, non un esame nuovo
    const frase = !d && !cfu && /^(?:anxiety|stress|stressed|nerves|tips?|prep|preparation|strategies|strategy|advice|season|results?|period|week|techniques?|help|questions?|practice|tomorrow)\b/.test(nome);
    if (nome && !frase && (/\bexam\b/.test(t) || d || cfu)) return { tipo: 'esame', nome, cfu, data: d?.data || null, esistente: trovaEsame(nome) };
  }

  // «what do I need for 110», «what average do I need to get 105»
  if ((m = t.match(/(?:what|how much|which|what average|what grades?) (?:do |would |will )?(?:i )?(?:need|have to get|must get|have to average).*?(\d{2,3})/))) {
    const b = Math.min(110, +m[1]); if (b >= 66) return { tipo: 'serve', base: b };
  }
  if (/\b(average|gpa|grades|my grades|grade record|degree mark|graduation mark|final mark|credits|ects|how am i doing)\b/.test(t) && !/\b(explain|mean|means|meaning|calculate|compute)\b/.test(t) && (!/\b(what is|what's|whats|what are)\b/.test(t) || /\bmy\b/.test(t))) return { tipo: 'libretto' };

  // ripasso
  if ((m = t.match(/^(?:let's |i want to |start |begin )?(?:review\w*|revise|revision|flashcards|my cards|the cards|cards|study cards)\s*(.*)$/))) {
    const r = pulisci(m[1] || ''); return { tipo: 'ripasso', esame: r ? trovaEsame(r) : null, nomeDetto: r };
  }

  // il ponte con gli agenti di programmazione: «agents», «connect claude code», «disconnect cursor», «what did the agent do»
  if ((m = t.match(/^(connect|disconnect|remove)(?: (?:the )?agents| (claude(?: code)?|codex|gemini(?: cli)?|cursor|copilot(?: cli)?|cline|windsurf|opencode|open code|aider|kiro|qwen(?: code)?|amp|roo(?: code)?|kilo(?: code)?|continue|zed|junie))$/))) return { tipo: 'agenti', agente: m[2] ? m[2].replace(/ (?:code|cli)$/, '').replace(' ', '') : null, togli: m[1] !== 'connect' };
  if (/^(?:my |the )?(?:coding |ai |programming )?agents$|^(?:the )?bridge(?: with the agents)?$/.test(t)) return { tipo: 'agenti', agente: null };
  if (/^what (?:has|did) (?:the agent|claude(?: code)?|codex|cursor|gemini|the ai) (?:do|done)\b|^(?:the )?(?:agent'?s )?last turn(?: of the agent)?$/.test(t)) return { tipo: 'turnoAgente' };
  // Moodle in sola lettura: «connect moodle», «what's new on moodle», «deadlines», «disconnect moodle»
  if (/^(?:disconnect|log out of|remove)(?: from)? moodle$/.test(t)) return { tipo: 'moodle', cosa: 'scollega' };
  if (/^(?:what's new|whats new|what is new|new files|news|updates|check)(?: (?:on|in|from))? moodle$|^moodle (?:news|updates)$/.test(t)) return { tipo: 'moodle', cosa: 'novita' };
  if (/^(?:my )?(?:deadlines|due dates|assignments)(?: (?:on|in|from) moodle)?$|^(?:what's|what is|whats) due(?: (?:on|in) moodle)?$/.test(t)) return { tipo: 'moodle', cosa: 'scadenze' };
  if (/^(?:my )?courses (?:on|in|from) moodle$|^moodle courses$/.test(t)) return { tipo: 'moodle', cosa: 'corsi' };
  if (/^(?:(?:connect|link|add|open|set up)(?: to)?(?: the)? )?(?:moodle|e-?learning(?: platform)?)$/.test(t)) return { tipo: 'moodle', cosa: null };
  // interrogazione (prima del quiz: «quiz me» è l'orale)
  if ((m = t.match(/^(?:quiz me|test me|ask me(?: some)? questions|grill me|simulate (?:the |an )?oral(?: exam)?|mock oral|oral exam|oral|interrogate me)\b\s*(.*)$/))) {
    const r = pulisci(m[1] || ''); return { tipo: 'orale', esame: r ? trovaEsame(r) : null, nomeDetto: r };
  }
  // il quiz a crocette: «quiz on calculus 2», «multiple choice», «exam simulation for private law»
  if ((m = t.match(/^(?:give me |start |let's do |do )?(?:a |an |the )?(quiz|multiple choice(?: quiz| test| questions)?|mcq|exam simulation|simulate (?:the )?(?:written )?exam|practice test)\b\s*(.*)$/))) {
    const r = pulisci(m[2] || ''); return { tipo: 'crocette', esame: r ? trovaEsame(r) : null, nomeDetto: r, simulazione: /simul/.test(m[1]) };
  }

  // la frase intera (al più con «please»): «my exams are stressing me out» o «today I learned…» vanno all'AI
  if (/^(?:my |the )?(?:exams|upcoming exams|next exams|exam calendar|calendar|exam session|exam dates|when are my exams)$/.test(t)) return { tipo: 'esami' };
  if (/^(?:today|plan|today's plan|my plan|plan for today|what (?:do|should) i study(?: today)?|what to study today|what do i do today)$/.test(t)) return { tipo: 'oggi' };

  // ricerca diretta: il nome di un esame da solo apre la sua scheda
  const e = trovaEsame(t);
  if (e && norm(e.nome).startsWith(norm(t)) && norm(t).length >= 3) return { tipo: 'apriEsame', esame: e };
  return null;
}

// «9-5» all'inglese è dalle 9 alle 17: senza am/pm, una fine prima dell'inizio (tutte e due fino a mezzogiorno) è del pomeriggio.
// «22-2» resta un turno di notte
const pomeriggio = o => {
  if (!o || /am|pm/.test(o.pezzo)) return o;
  const h = x => +x.slice(0, 2), a = h(o.inizio), b = h(o.fine);
  return b >= 1 && b < a && a <= 12 ? { ...o, fine: hh(b + 12, o.fine.slice(3)) } : o;
};
// giorni e ore di una frase («monday and wednesday 9-11 room 7», «mon wed 2-7pm», «monday to friday 9-5», «mon-fri
// 9am-5pm»): resto è quello che avanza, normalizzato
const GIORNO_BREVE = /\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)s?\b/g;
const DA_A = new RegExp(`${GIORNO_BREVE.source} ?(?:-|–|to|through|thru|till|until) ?${GIORNO_BREVE.source}`, 'g');
export function giorniEOre(testo) {
  const basso = String(testo).toLowerCase();
  const o = pomeriggio(oreInCifre(basso.replace(/\bfrom (?=\d)/, ''), 'to|until|till'));
  if (!o) return null;
  const giorni = [], G = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], g3 = g => G.indexOf(g.slice(0, 3));
  // i giorni da … a …: «monday to friday», «mon-fri», «fri through sun» (tutti quelli in mezzo)
  let r = basso.replace(o.pezzo, ' ').replace(DA_A, (_, a, b) => { for (let i = g3(a); ; i = (i + 1) % 7) { giorni.push(i); if (i === g3(b)) break; } return ' '; });
  r = ' ' + norm(r.replace(/\bfrom (?=\d)/, '')) + ' ';
  r = r.replace(/ (?:on |every )?/g, ' ').replace(GIORNO_BREVE, (_, g) => { giorni.push(g3(g)); return ' '; });
  return { giorni, inizio: o.inizio, fine: o.fine, resto: r.replace(/\s+/g, ' ').replace(/^ ?/, ' ').replace(/ ?$/, ' ') };
}
// giorni, ore e aula di una lezione; quello che resta è il nome del corso
export function leggiOrario(testo) {
  const x = giorniEOre(testo);
  if (!x || !x.giorni.length) return null;
  let r = x.resto, aula = ''; r = r.replace(/ (?:in )?(?:room|hall|classroom|lecture hall) (\w+)/, (_, a) => { aula = a.length <= 3 ? a.toUpperCase() : a.charAt(0).toUpperCase() + a.slice(1); return ' '; });
  const corso = r.replace(/\b(and|the|on|from|to|until|at|in|every|of|a)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!corso) return null;
  const e = trovaEsame(corso);
  return { corso: e?.nome || corso.replace(/^./, c => c.toUpperCase()), giorni: x.giorni, inizio: x.inizio, fine: x.fine, aula };
}

// il lavoro (js/ore.js): «I work monday wednesday friday 2-7pm», «my shifts are …», «I'm not working on thursday», «on
// saturday I also work 6-11pm», «on work days I study at most 2 hours», «I study from 10 to 22», «I don't work anymore»
const GIORNO = `(today|tomorrow|the day after tomorrow|${GIORNI.join('|')})`;
function dataDetta(s) {
  const T = oggi(), k = ['today', 'tomorrow', 'the day after tomorrow'].indexOf(s); if (k >= 0) return piuGiorni(T, k);
  const dow = GIORNI.indexOf(s); if (dow < 0) return null;
  return piuGiorni(T, (dow - new Date(T + 'T12:00').getDay() + 7) % 7);
}
const ORA = /(?:from\s+)?\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?\s*(?:-|–|to|until|till)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?/g;
export function leggiLavoro(testo) {
  const t = String(testo || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim();
  let m;
  if (/^(?:i don't work anymore|i do not work anymore|i no longer work|no more work|no more shifts|i quit my job|i stopped working|(?:remove|delete|clear)(?: my)? (?:job|work|shifts))$/.test(t)) return { tipo: 'lavoro', azione: 'togli' };
  if (/^(?:when do i work|(?:my )?shifts|my work(?: schedule)?|(?:my )?work (?:schedule|hours)|my job)$/.test(t)) return { tipo: 'lavoro', azione: 'vedi' };
  const NON = "i(?: don't| do not|'m not| am not) work(?:ing)?";
  if ((m = t.match(new RegExp(`^(?:(?:this|on) )?${GIORNO},? ${NON}$`))) || (m = t.match(new RegExp(`^${NON} (?:(?:this|on) )?${GIORNO}$`)))) return { tipo: 'lavoro', azione: 'eccezione', data: dataDetta(m[1]), no: true };
  if ((m = t.match(/^(?:on (?:work ?days|working days|the days i work|days i work|days when i work)|when i work),? i (?:study|can study|want to study) (?:at most |max |only |no more than |up to )?(.+)$/))) {
    const mi = leggiMinuti(m[1]); if (mi && /h|min/.test(mi.pezzo) && mi.min >= 15 && mi.min <= 600) return { tipo: 'lavoro', azione: 'tetto', min: mi.min };
  }
  if ((m = t.match(/^(?:usually |normally )?i study (?:from |between )?(.+)$/))) {
    const x = pomeriggio(oreInCifre(m[1], 'to|until|and')), o = x && x.pezzo.trim() === m[1].trim() && orarioOk(x.inizio, x.fine);
    if (o && o.fine !== '24:00') return { tipo: 'lavoro', azione: 'finestra', da: o.inizio, a: o.fine };
  }
  // un turno in più solo quel giorno: «on saturday I also work 6-11pm», «this week I also work saturday 18-23»
  if ((m = t.match(/^(?:this week,? )?(?:(.+?),? )?i (?:also work|work also|work extra|have an extra shift)(?: on)? (.+)$/))) {
    const g = `${m[1] || ''} ${m[2]}`.match(new RegExp(`(?:^| )${GIORNO}(?= |$)`)), x = g && giorniEOre(m[2].replace(g[1], ' '));
    const o = x && orarioOk(x.inizio, x.fine);
    if (o) return { tipo: 'lavoro', azione: 'eccezione', data: dataDetta(g[1]), ...o };
  }
  // i turni di ogni settimana: «I work …» li aggiunge, «my shifts are …» li sostituisce. Quello che avanza (at the bar) va
  // bene se è poco: «group work monday 2-4pm for the project» o «I work on my thesis monday 9-1» non sono turni
  if ((m = t.match(/^(?:(my shifts are|my shift is|now i work|from now on i work|i only work)|i work|i have (?:a )?shifts?|shifts?)\s+(.+)$/))) {
    const pezzi = [];
    let da = 0; for (const o of m[2].matchAll(ORA)) { pezzi.push(m[2].slice(da, o.index + o[0].length)); da = o.index + o[0].length; }
    if (pezzi.length) pezzi[pezzi.length - 1] += m[2].slice(da);
    const xs = pezzi.map(giorniEOre), turni = xs.map(x => x && x.giorni.length && orarioOk(x.inizio, x.fine));
    const resto = xs.flatMap(x => x ? x.resto.replace(/\b(and|the|on|from|to|until|at|in|every|a|an|as)\b/g, ' ').trim().split(/\s+/).filter(Boolean) : []);
    if (turni.length && turni.every(Boolean) && resto.length <= 2 && !xs.some(x => /group|team|project|thesis|exercis|homework|lab|report|assignment/.test(x.resto))) {
      const tt = turni.map((o, i) => ({ giorni: [...new Set(xs[i].giorni)].sort(), ...o }));
      return { tipo: 'lavoro', azione: m[1] ? 'sostituisci' : 'aggiungi', ...tt[0], ...(tt.length > 1 ? { turni: tt } : {}) };
    }
  }
  return null;
}

// gli stessi esempi dell'italiano, nello stesso ordine
export const ESEMPI = [
  ['focus 50 on calculus 2', 'starts the timer and counts the hours'],
  ['I got 28 in physics', 'records the grade and updates your average'],
  ['exam databases on 15 January 9 credits', 'adds the exam date'],
  ['what do I need for 110', 'the average you need from here to the end'],
  ['what if I get 30 in calculus 2', 'simulates your average'],
  ['syllabus for calculus 2', 'paste the syllabus: a map of the topics and a plan up to the exam'],
  ['past exam questions for calculus 2: …', 'the ones from your course group: they move up in the plan'],
  ['past papers for calculus 2: …', 'the exercises of an old exam: one a day, on today\'s topics'],
  ['mock exam for calculus 2', 'a whole old exam, with the real time limit: you say how it went'],
  ['let me explain: Green\'s theorem', 'you explain a topic, Lode tells you what you left out'],
  ['quiz on calculus 2', 'multiple choice questions: practice, or a timed exam simulation'],
  ['transcribe the video lecture of private law', 'from the computer audio: for studying from home'],
  ['connect moodle', 'new files and deadlines from your university platform'],
  ['agents', 'connect Claude Code, Codex, Cursor…: Lode tells you what they really did in your projects'],
  ['review calculus 2', 'today\'s cards'],
  ['card: Green\'s theorem = …', 'a quick card'],
  ['export to anki', 'cards and definitions in a file for Anki, one deck per course'],
  ['pocket review', 'tomorrow\'s cards in a note, to do on your phone with Obsidian'],
  ['lecture calculus 2 monday and wednesday 9-11 room 7', 'your timetable: Lode knows when you are in class'],
  ['I work monday wednesday friday 2-7pm', 'your shifts: the plan only uses your real free time, with half an hour to get there'],
  ['weekly plan', 'all your exams in one calendar, to the minute: what fits and what doesn\'t'],
  ['★ he always asks about Green\'s theorem', 'in class: mark what will be on the exam'],
  ['def: gradient = vector of partial derivatives', 'in class: a definition in the note'],
  ['play', 'two minutes on the definitions of the last lecture'],
  ['transcribe the lecture', 'in class: the whole lecture as notes, formulas included, saved in Obsidian'],
  ['tidy up the lecture', 'from the transcription to clean notes (AI)'],
  ['repeat', 'in class: what the professor said in the last 60 seconds'],
  ['AI', 'connect your favourite AI (Claude, ChatGPT, Gemini, Mistral…), pay as you go'],
  ['share the transcript', 'the lecture for your classmates: AirDrop, WhatsApp, email'],
  ['close lecture', 'definitions and ★ pulled out of the notes (AI)'],
  ['open glossary', 'jump to a page of the vault'],
  ['quiz me on databases', 'simulates the oral exam (with AI)'],
  ['what does it print', 'C exercises: the answer is worked out by Lode, not by an AI'],
  ['what does it print in python', 'the same exercises in Python (or in Java: «what does it print in java»)'],
  ['follow project', 'watches your lab folder: what changes and whether you tested it'],
  ['test the project', 'compiles and runs the .in/.out tests, after you confirm'],
  ['explain the error', 'copy the error from the terminal: I explain it in English, one step at a time'],
  ['project diary', 'opens today\'s diary in Obsidian'],
  ['stop following', 'Lode stops watching the folder and removes its copies'],
  ['sync between computers', 'the same Lode on two or three computers, with the cloud folder you already have'],
];

// the small words inside the cards (js/comandi/comune.js, detto()): confirm, cancel, end the oral, leave «explain it»
export const PAROLE = {
  si: ['yes', 'yeah', 'yep', 'y', 'ok', 'okay', 'sure', 'confirm', 'confirmed', 'go', 'go ahead', 'do it', 'proceed', 'correct', 'right', 'exactly', 'perfect', 'save', 'save it', 'save them', 'sounds good', 'fine', 'alright', 'all right'],
  siCoda: ['please'],
  no: ['no', 'nope', 'cancel', 'stop', 'wait', 'never mind', 'nevermind', 'forget it', 'leave it', 'not now', 'better not', 'nothing'],
  voto: ['enough', 'grade', 'my grade', 'give me the grade', 'give me my grade', "i'm done", 'im done', 'i am done', 'done', 'finish', 'finished'],
  basta: ['exit', 'quit', 'cancel', 'stop', 'enough', 'never mind', 'forget it'],
  esci: ['exit', 'quit', 'close', 'close the oral', 'end oral', 'end the oral', 'stop oral', 'stop the oral', 'quit oral'],
};
