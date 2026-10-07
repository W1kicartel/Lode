// El reconocedor español (smistato da js/comandi.js): le frasi che scriverebbe davvero uno studente di Spagna o
// dell'America Latina, senza AI: «focus 50 en cálculo 2», «saqué un 8,5 en física», «examen bases de datos el 15 de enero
// 6 créditos», «qué media necesito para un 8», «repasa cálculo», «tarjeta: teorema de Green = …», «explícame el error»,
// «sigue el proyecto», «idioma inglés». Registro informale, abbreviazioni comuni («porfa», «profe», «compu»), con o senza
// accenti (chi scrive di fretta non li mette): le regole si provano sulla frase senza accenti, ma i pezzi che restituiscono
// (nomi degli esami, testi) sono presi dalla frase com'era, accenti compresi.
// Restituisce gli stessi oggetti { tipo, … } del riconoscitore italiano (js/comandi/it.js), campo per campo. Se la frase
// non è un comando ritorna null: comandi.js prova poi l'inglese, e se non è un comando ci pensa l'AI.
// I voti restano quelli detti: 28 o «30 con matrícula» (scala italiana) e anche 8,5 o «10 con matrícula» (la scala
// spagnola 0-10, con i decimali). Come leggerli lo decide il sistema dei voti (js/sistemi.js), non qui.
// «Notas» in spagnolo sono i voti (il libretto), non gli appunti: gli appunti sono «apuntes».
import { norm, oggi, piuGiorni, trovaEsame } from '../dati.js';
import { sembraErrore, dataInCifre, conAnno, orarioOk, oreInCifre, linguaDetta } from './comune.js';

const GIORNI = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESI = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// i nomi delle lingue detti in spagnolo, senza accenti (quelli nella loro lingua li conosce comune.js)
const LINGUE_ES = { italiano: 'it', ingles: 'en', espanol: 'es', castellano: 'es', frances: 'fr', aleman: 'de', portugues: 'pt' };

// la frase senza accenti: «cálculo» → «calculo», «mañana» → «manana». Con la frase in NFC ogni lettera resta una lettera
// sola, così le posizioni coincidono con la frase com'era
const senza = x => String(x).normalize('NFC').normalize('NFD').replace(/[̀-ͯ]/g, '');
// la regola provata sulla frase senza accenti; i gruppi presi dalla frase com'era (con gli accenti)
function trova(re, testo) {
  const base = String(testo).normalize('NFC'), s = senza(base);
  const m = new RegExp(re.source, re.flags.replace(/[gd]/g, '') + 'd').exec(s); if (!m) return null;
  if (s.length !== base.length) return m;
  const r = m.map((x, i) => (x == null ? x : base.slice(m.indices[i][0], m.indices[i][1])));
  r.index = m.index; return r;
}

// i numeri detti a voce: «veintiocho» → 28, «cincuenta» → 50, «ciento diez» → 110, «treinta y dos» → 32.
// «un», «una» e «uno» restano parole (sono articoli e pronomi: «dame uno»), ma «treinta y uno» è un numero
const UNITA = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'veintiuno', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECINE = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const U9 = UNITA.slice(1, 10).join('|'), DD = Object.keys(DECINE).join('|');
const sotto100 = `(?:(?:${DD})(?: y (?:${U9}))?|${UNITA.join('|')})`;
const NUMERO = new RegExp(`(?<![\\p{L}\\d])(?:cien|ciento(?: ${sotto100})?|${sotto100})(?![\\p{L}\\d])`, 'giu');
function valore(w) {
  let v = 0; w = w.replace(/^cien(?:to)?\s*/, () => { v = 100; return ''; });
  for (const p of w.split(/\s+y\s+|\s+/)) if (p in DECINE) v += DECINE[p]; else if (UNITA.includes(p)) v += UNITA.indexOf(p);
  return v;
}
export const numeri = t => {
  const base = String(t).normalize('NFC'), s = senza(base);
  if (s.length !== base.length) return base;
  let out = '', da = 0;
  for (const m of s.matchAll(NUMERO)) {
    if (/^un[oa]?$/i.test(m[0])) continue;
    out += base.slice(da, m.index) + valore(m[0].toLowerCase()); da = m.index + m[0].length;
  }
  return out + base.slice(da);
};
const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, noventa: 90 };
const n = s => (s in NUM ? NUM[s] : Number(s));

export function leggiData(testo) {
  const t = ' ' + norm(testo) + ' ', T = oggi();
  let m;
  if (/ pasado manana /.test(t)) return { data: piuGiorni(T, 2), pezzo: 'pasado manana' };
  // «mañana» è domani, ma «por la mañana» o «esta mañana» sono l'ora del giorno
  if (/(?<! la| esta) manana /.test(t)) return { data: piuGiorni(T, 1), pezzo: 'manana' };
  if (/ hoy /.test(t)) return { data: T, pezzo: 'hoy' };
  if ((m = t.match(/ (?:en|dentro de) (\d+|\w+) (dias?|semanas?|mes|meses) /))) {
    const k = n(m[1]); if (k) return { data: piuGiorni(T, k * (m[2].startsWith('sem') ? 7 : m[2].startsWith('mes') ? 30 : 1)), pezzo: m[0].trim() };
  }
  { const c = dataInCifre(t, testo); if (c) return c; }
  // «15 de enero», «el 1 de febrero de 2027», «primero de mayo», «20 ene»: il mese intero o abbreviato, dopo un numero
  const mesi = '(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sept?(?:iembre)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)';
  if ((m = t.match(new RegExp(` (?:el )?(\\d{1,2}|primero) (?:o )?(?:de )?(${mesi}) (?:(?:de |del )?(\\d{4}) )?`)))) {
    const g = m[1] === 'primero' ? 1 : +m[1], me = m[2].startsWith('set') ? 8 : MESI.findIndex(x => x.startsWith(m[2]));
    return { data: conAnno(g, me, m[3] ? +m[3] : null), pezzo: m[0].trim() };
  }
  if ((m = t.match(new RegExp(` (?:(?:el|este|esta|el proximo|el otro|proximo) )?(${GIORNI.join('|')})(?: que viene| proximo)? `)))) {
    const dow = GIORNI.indexOf(m[1]), d = new Date(T + 'T12:00'); const k = (dow - d.getDay() + 7) % 7 || 7;
    return { data: piuGiorni(T, k), pezzo: m[0].trim() };
  }
  return null;
}
// toglie le parole vuote in testa e in coda a un nome detto: «de cálculo 2» → «cálculo 2», «bases de datos durante» →
// «bases de datos» (la «de» in mezzo resta)
const VUOTE = '(?:de|del|la|el|los|las|en|a|al|sobre|para|mi|mis|tu|con|examen(?: de| del)?|asignatura(?: de)?|materia(?: de)?)';
const pulisci = s => String(s).replace(new RegExp(`^\\s*${VUOTE}\\s+`, 'i'), '').replace(new RegExp(`^\\s*${VUOTE}\\s+`, 'i'), '').replace(/[?.!,;:¿¡]+$/, '')
  .replace(/\s+(?:de|del|en|a|al|para|por|durante|con|el|la|los|las|y)\s*$/i, '').trim().replace(/^(?:de|del|en|a|al|para|sobre|el|la|los|las|mi|mis|con)$/i, '');

// minuti detti a parole: «50», «50 minutos», «una hora», «media hora», «una hora y media», «2 horas», «90 min», «1h30»
function leggiMinuti(t) {
  let m; t = senza(t);
  if (/media hora/.test(t) && !/hora y media/.test(t)) return { min: 30, pezzo: 'media hora' };
  if ((m = t.match(/(?:^|\s)(\d+|una|un|dos|tres)\s*(?:horas?|hrs?|hs|h)\b(\s*y media)?/))) return { min: n(m[1]) * 60 + (m[2] ? 30 : 0), pezzo: m[0].trim() };
  if ((m = t.match(/(?:^|\s)(\d+|[a-z]+)\s*(?:minutos?|mins?)\b|(?:^|\s)(\d+)\s*m\b/))) { const k = n(m[1] || m[2]); if (k) return { min: k, pezzo: m[0].trim() }; }
  // un numero da solo: all'inizio («focus 50 en …») o in fondo dopo «durante» o «por» («estudia física durante 50»)
  if ((m = t.match(/^\s*(\d{1,3})(?=\s|$)/)) || (m = t.match(/\b(?:durante|por) (\d{1,3})$/))) return { min: +m[1], pezzo: m[0].trim() };
  return null;
}

// i comandi di «Segui il progetto» (in italiano stanno in js/codice/progetto.js): stessi oggetti { tipo: 'progetto', azione, nome? }
const PROYECTO = '(?:proyecto|codigo|programa|practica)';
const PROGETTO = [
  [/^(?:sigue|seguir|vigila|vigilar|observa)(?: (?:el|un|este|mi|un nuevo))? proyecto$/, () => ({ azione: 'segui' })],
  [/^(?:que (?:ha cambiado|cambio|se ha cambiado|ha cambiado|hay de nuevo en el proyecto))(?: (?:en|de|del) (.+))?$/, m => ({ azione: 'cambiato', nome: m[1] })],
  [/^(?:muestrame |ensename |ver |mira )?(?:los )?cambios(?: (?:en|de|del) (.+))?$/, m => ({ azione: 'cambiato', nome: m[1] })],
  [/^(?:lo (?:he|has) probado|lo probe|lo probaste|probado|esta probado)$/, () => ({ azione: 'provato' })],
  [new RegExp(`^(?:prueba|probar|ejecuta|ejecutar|corre|correr|testea|comprueba) (?:el |mi )?${PROYECTO}(?: (.+))?$`), m => ({ azione: 'prova', nome: m[1] })],
  [new RegExp(`^(?:compila|compilar)(?: (?:el |mi )?${PROYECTO}(?: (.+))?)?$`), m => ({ azione: 'prova', nome: m[1] })],
  [/^deja de (?:seguir|vigilar)(?: (?:el )?(?:proyecto )?(.+))?$/, m => ({ azione: 'smetti', nome: m[1] })],
  [/^(?:preparame|ayudame a prepararme) para (?:la )?(?:defensa|discusion|presentacion|entrega oral)(?: (?:de|del) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:estoy )?(?:list[oa]) para (?:la )?(?:defensa|discusion)(?: (?:de|del) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:las )?funciones (?:que hay que |que tengo que |a |por )explicar(?: (?:en|de|del) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:defensa|discusion)$/, () => ({ azione: 'discussione' })],
  [/^(?:defensa|discusion) (?:de|del) (.+)$/, m => perDiscussione(m[1])],
];
// come in progetto.js: senza nome il progetto più recente, con un nome solo se ha l'aria di un laboratorio («lab3», un numero)
const perDiscussione = nome => (!nome ? { azione: 'discussione' } : /\d|\blab|proyecto|practica/.test(senza(nome)) ? { azione: 'discussione', nome } : null);
function interpretaProgetto(testo) {
  const t = String(testo || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim().replace(/^[¿¡]+\s*/, '').replace(/[.!?]+$/, '').trim();
  for (const [re, f] of PROGETTO) {
    const m = trova(re, t); if (!m) continue;
    const r = f(m); if (!r) continue;
    const c = { tipo: 'progetto', ...r }, nome = c.nome?.replace(/^(?:el |mi )?(?:proyecto|c[oó]digo|programa|pr[aá]ctica)\b\s*/, '').trim();
    if (nome) c.nome = nome; else delete c.nome;
    return c;
  }
  return null;
}

// un voto detto: 28, 30, 8,5 (anche «8.5»), con la lode: «con matrícula (de honor)», «cum laude», «MH». Vale la scala
// italiana (18-30) o quella spagnola (5-10, un decimale): il sistema dei voti decide come leggerlo. Come in italiano (sotto
// il 18 niente), un suspenso (0-4,9) non va nel libretto: «me saqué un 3 en física» resta all'AI
const VOTO = '(\\d{1,2}(?:[.,]\\d{1,2})?)';
const LODE = '( con matricula(?: de honor)?| matricula(?: de honor)?| mh| con honores| cum laude| con lode| y lode| e lode| lode)?';
const votoDetto = (x, lode) => {
  const v = Number(x.replace(',', '.'));
  if (!((Number.isInteger(v) && v >= 18 && v <= 30) || (v >= 5 && v <= 10))) return null;
  return { voto: v, lode: !!lode && (v === 30 || v === 10) };
};

export function interpreta(frase) {
  const grezzo0 = String(frase || '').trim(); if (!grezzo0) return null;
  // informatica: «explícame el error», anche con l'errore incollato dopo. Solo se dopo «error» non c'è niente, ci sono i due
  // punti o un a capo, o c'è davvero un errore del compilatore: «qué significa error estándar» resta all'AI
  let e0;
  if ((e0 = trova(/^(?:explicame|explica|me explicas|que significa|que quiere decir|ayudame con) (?:el |este |mi |esto del )?error\b([\s\S]*)$/i, grezzo0.replace(/^[¿¡]+\s*/, '')))) {
    const dopo = e0[1].replace(/^[ \t]+/, ''), testo = dopo.replace(/^:/, '').trim();
    const solo = !testo || /^[?.!]+$/.test(testo) || /^(?:del compilador|de compilaci[oó]n|del programa|que (?:he )?copi[eé]|copiado|que me sale|que me da)[?.!]*$/i.test(testo);
    if (solo) return { tipo: 'errore', testo: null };
    if (/^[:\n]/.test(dopo) || sembraErrore(testo)) return { tipo: 'errore', testo };
  }
  const pr = interpretaProgetto(grezzo0); if (pr) return pr;
  // la voce aggiunge maiuscole e un punto finale; i numeri arrivano a parole. I testi liberi (★, definizioni, domande,
  // carte) restano come li ha scritti lo studente, senza convertire i numeri
  const libero = grezzo0.replace(/[.!]+$/, '').normalize('NFC');
  const grezzo = numeri(libero);
  const t = grezzo.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/^[¿¡]+\s*/, '').replace(/[?!.¿¡]+$/, '').trim()
    .replace(/^(?:por favor|porfa|porfi|plis|oye|lode),? |,? (?:por favor|porfa|porfi|plis)$/g, '').trim();
  const s = senza(t);
  const T = re => trova(re, t);
  let m;

  // la lingua della barra: «idioma inglés», «cambia el idioma a italiano», «pásate al alemán», «ponlo en francés»
  if ((m = s.match(/^(?:(?:cambia|cambiar|pon|poner|configura)(?: el)? (?:idioma|lengua)(?: (?:a|al|en))?|(?:idioma|lengua):?(?: (?:a|al|en))?|(?:hablame|habla|respondeme|responde|contestame|escribeme) en|(?:pasa|pasate|pasalo|pasala|cambia|cambiar|cambialo|ponlo|ponla|ponme|pon la app|pon lode) (?:a|al|en)|(?:la )?app en|en) (\S+)$/)) && linguaDetta(m[1], LINGUE_ES)) return { tipo: 'lingua', codice: linguaDetta(m[1], LINGUE_ES) };
  if (/^(?:ayuda|ayudame|\?|que (?:puedes|sabes) hacer|que (?:puedo|se puede) (?:decir|escribir|pedir|hacer)|comandos|lista de comandos)$/.test(s)) return { tipo: 'aiuto' };
  if (/^(?:stop|para|parar|detente|basta|termina|terminar|fin|acaba|corta|cancela)(?: (?:el |la |mi )?(?:focus|timer|temporizador|cronometro|pomodoro|sesion|descanso|pausa))?$/.test(s)) return { tipo: 'ferma' };
  if (/^(?:pausa|pausar|pon(?:lo)? en pausa|pausa (?:el )?(?:timer|temporizador|cronometro)|espera|espera un momento)$/.test(s)) return { tipo: 'sospendi' };
  if (/^(?:reanuda|reanudar|continua|continuar|sigue|seguimos|sigamos|seguir|dale)(?: (?:el )?(?:timer|temporizador|cronometro|focus|pomodoro))?$/.test(s)) return { tipo: 'riprendi' };
  // Anki: «exporta a anki», «anki», «exporta las tarjetas de cálculo 2 a anki», «anki física 2». Serve un verbo o la frase
  // che comincia da «anki» o dalle tarjetas: «cómo importo en anki», «anki cómo funciona», «descarga anki» restano all'AI
  if (/\banki\b/.test(s) && (m = T(/^(?:(?:exporta(?:me)?|exportar|manda(?:me)?|pasa(?:me)?|pon(?:me)?|guarda|prepara(?:me)?|crea(?:me)?|haz(?:me)?|descarga(?:me)?)\b\s*)?(.*)$/)) && (m[0] !== m[1] || /^(?:anki\b|(?:todas )?(?:las |mis )?(?:tarjetas|flashcards|fichas|mazos?|definiciones)\b)/.test(senza(m[1])))) {
    const r = pulisci(m[1].replace(/(?:\b(?:a|al|para|en|hacia) )?\banki\b/i, ' ').replace(/(?:todas )?(?:las |mis |los )?(?:nuevas )?(?:tarjetas|flashcards|fichas|mazos?|definiciones)\b/i, ' ').trim().replace(/\s+/g, ' '));
    const domanda = m[0] === m[1] && r && (/\?\s*$/.test(grezzo0) || /^[¿]/.test(grezzo0) || /^(?:como|que|por ?que|donde|cuando|funciona|es|se|no|sirve|puedo|debo|va|o|y|vs)(?=[\s']|$)/.test(senza(r)) || !trovaEsame(r));
    const programma = /^(?:descarga|descargar|instala)\b/.test(s) && /^anki$/i.test(m[1].trim());
    if (!domanda && !programma) return { tipo: 'anki', corso: r && !/^(?:todo|todas|todos|todas las asignaturas|todas las materias|cada asignatura)$/.test(senza(r)) ? r : null };
  }
  // «repaso de bolsillo» (Ripasso in tasca, js/tasca.js): le tarjetas di domani in una nota, da fare sul móvil con Obsidian
  const TASCA = '(?:el |mi |las |mis )?(?:repaso de bolsillo|repaso (?:en|para) el (?:movil|celular|cel|telefono)|tarjetas (?:en|para) el (?:movil|celular|cel|telefono)|tarjetas de bolsillo)';
  if (s.match(new RegExp(`^(?:no (?:me )?(?:hagas|pongas|mandes|prepares|escribas)|apaga|quita|desactiva|basta de|ya no quiero) ${TASCA}(?: cada noche| todas las noches| cada tarde)?$`))) return { tipo: 'tasca', sera: false };
  if ((m = s.match(new RegExp(`^(?:(?:hazme|haz|pon(?:me)?|manda(?:me)?|prepara(?:me)?|escribe(?:me)?|actualiza) )?${TASCA}( cada noche| todas las noches| cada tarde| solo cuando (?:lo )?pida)?$`)))) return m[1] ? { tipo: 'tasca', sera: !/pida/.test(m[1]) } : { tipo: 'tasca' };

  // el temario: «temario de cálculo 2», «temario», «temario cálculo 2: 1. límites …» (incollato, anche su più righe).
  // «programa» da solo è anche un programma del computer: vale con un esame del libretto o con il testo incollato
  if ((m = trova(/^(?:(?:abre|muestrame|ver|aqui (?:esta|tienes)|pego|pega|te paso) )?(?:el |mi )?(temario|programa(?: de la asignatura| de la materia| del curso| del examen)?|silabo|syllabus)(?:\s+(?:de|del|para)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i, grezzo0.replace(/^[¿¡]+\s*/, '')))) {
    const nome = pulisci(numeri(m[2]).toLowerCase()), testo = (m[3] || '').trim();
    const solo = /^programa$/i.test(m[1]) && nome && !testo && !trovaEsame(nome);
    if (!/^(?:de )?(?:hoy|manana|mañana)$/i.test(m[2].trim()) && !solo) return { tipo: 'programma', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo };
  }
  // «te lo explico yo: green», «te explico las series de potencias»: lo studente spiega, Lode controlla cosa ha detto
  if ((m = T(/^(?:te lo explico(?: yo)?|lo explico yo|yo te (?:lo )?explico|te explico|explico yo|explico|dejame explicar(?:te)?(?:lo)?|quiero explicar(?:te)?(?:lo)?)\b(?: yo)?\s*:?\s*(.*)$/))) return { tipo: 'spiego', q: pulisci(m[1] || '') };
  // las preguntas que salieron en los exámenes: «preguntas de examen de cálculo 2: …» (una per riga)
  if ((m = trova(/^(?:(?:aqui (?:estan|tienes)|pega|pego|anade|agrega|te paso) )?(?:las )?preguntas (?:de(?:l)? examen(?:es)?(?: anteriores| pasados| viejos| de otros anos)?|que (?:salieron|cayeron|han salido|han caido|pusieron|tomaron)(?: en el examen| en los examenes)?|de (?:otros anos|anos anteriores))(?:\s+(?:de|del|en|para)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i, grezzo0.replace(/^[¿¡]+\s*/, '')))) {
    const nome = pulisci(numeri(m[1]).toLowerCase()); return { tipo: 'domande', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  // i temi d'esame (js/temi.js): «exámenes anteriores de cálculo 2: Ejercicio 1 …», «parciales viejos de física»; «ejercicio
  // de cálculo 2», «dame un ejercicio» = l'esercizio di oggi. «ejercicios de c», «ejercicios en python» restano a «¿Qué imprime?»
  if ((m = trova(/^(?:(?:aqui (?:esta|estan|tienes)|pega|pego|anade|agrega|abre|muestrame|te paso) )?(?:los |el |un |mis )?(?:examen(?:es)? (?:anteriores?|viejos?|pasados?|de otros anos|de anos anteriores|resueltos?)|parcial(?:es)? (?:anteriores?|viejos?|pasados?)|final(?:es)? (?:anteriores?|viejos?|pasados?)|modelos? de examen|ejercicios de examen(?:es)?(?: anteriores| viejos)?)(?:\s+(?:de|del|para)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i, grezzo0.replace(/^[¿¡]+\s*/, '')))) {
    const nome = pulisci(numeri(m[1]).toLowerCase()); return { tipo: 'temi', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  if ((m = T(/^(?:(?:dame|ponme|proponme|hazme hacer|hagamos|hago|quiero hacer|haz) )?(?:un |el |mi )?ejercicio(?: del dia| de hoy| de examen)?(?:\s+(?:de|del|para|sobre)\s+(?!(?:c|c\+\+|java|python|programacion)$)(.+))?$/))) {
    const nome = pulisci(m[1] || ''); return { tipo: 'temi', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: '' };
  }
  // el simulacro (js/prova.js): un examen viejo entero, con el tiempo de verdad. «simulacro de examen de cálculo 2»,
  // «examen completo de física». «simulación de examen» es el test (más abajo)
  if ((m = T(/^(?:(?:hazme hacer|hazme|haz|hagamos|hago|quiero hacer|empieza|empezar|inicia|abre|vamos con) )?(?:un |el |una |la )?(?:simulacro(?: de examen| del examen| de parcial| de final)?|examen (?:completo|entero)|parcial completo|final completo)(?:\s+(?:de|del|para|sobre)\b)?\s*(.*)$/))) {
    const nome = pulisci(m[1] || ''); return { tipo: 'prova', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome };
  }

  // en clase: ★ de examen, definición, pregunta para el profe (i testi come li ha scritti lo studente)
  if ((m = trova(/^(?:★|\*{1,2}|!|(?:entra|va|cae|sale) (?:en el|al) examen\s*:?|de examen\s*:|para el examen\s*:|importante\s*:|ojo\s*:|estrella\s*:?|marca(?:lo)?(?: como)?(?: de| para el)? examen\s*:?|esto (?:entra|va|cae|sale) en el examen\s*:?)\s*(.+)$/i, libero))) return { tipo: 'stella', testo: m[1].trim() };
  if ((m = trova(/^(?:definicion|define|def)\s*:?\s*(.+?)\s*(?:::|:|=|→|—|-{1,2}>|\bes igual a\b|\bsignifica\b|\bquiere decir\b|\bes\b)\s*(.+)$/i, libero)) && !/^(?:que|cual|como|por ?que|quien)\b/i.test(senza(m[1]))) return { tipo: 'definizione', termine: m[1].replace(/\*\*/g, '').trim(), testo: m[2].trim() };
  if ((m = trova(/^(?:\?|pregunta\s*:|pregunta para (?:el|la) (?:profe(?:sor(?:a)?)?|maestr[oa])\s*:?|preguntale (?:al|a la) (?:profe(?:sor(?:a)?)?|maestr[oa])\s*:?|preguntar (?:al|a la) profe(?:sor(?:a)?)?\s*:?)\s*(.+)$/i, libero))) return { tipo: 'domanda', testo: m[1].trim() };

  // el horario: «clase cálculo 2 lunes y miércoles 9-11 aula 7»
  if ((m = T(/^(?:anade |agrega |nueva |tengo )?(?:una )?(?:clase|clases|leccion|lecciones|curso|materia|asignatura)\s+(?:de |del )?(.+)$/))) {
    const o = leggiOrario(m[1]); if (o) return { tipo: 'orario', ...o };
  }
  if (/^(?:(?:mi |el )?horario(?: de clases?)?|mis clases|que clases? tengo(?: hoy)?|cuando tengo clases?|a que hora tengo clase)$/.test(s)) return { tipo: 'vediOrario' };
  { const l = leggiLavoro(t); if (l) return l; }
  if (/^(?:el |mi )?(?:plan (?:de|para) (?:la|esta) semana|plan semanal|planning semanal|planificacion semanal)$|^(?:mi semana|mis horas libres|horas libres|mi tiempo libre|tiempo libre|cuanto tiempo (?:libre )?tengo(?: para estudiar)?)$/.test(s)) return { tipo: 'ore' };
  // «¿Qué imprime?»: ejercicios de C (también en Java y en Python) con la respuesta calculada por Lode
  if (/^(?:que imprime(?: (?:esto|este codigo|este programa))?|que sale por pantalla|ejercicios? (?:de |en )?(?:c|programacion)|entrename en c)$/.test(s)) return { tipo: 'stampa' };
  if ((m = s.match(/^(?:que imprime(?: (?:esto|este codigo|este programa))?(?: en)?|ejercicios? (?:de|en)|entrename (?:en|con)) (c|java|python)$/))) return { tipo: 'stampa', lingua: m[1] };
  if ((m = T(/^(?:juega|juguemos|jugar|vamos a jugar|juego|minijuego|memory|entrename|entrenamiento|repasame las definiciones|fijame las definiciones|definiciones)\b\s*(.*)$/))) {
    // «juego de definiciones de cálculo 2»: il corso è «cálculo 2»
    const r = pulisci((m[1] || '').replace(/^(?:con |de )?(?:las |mis )?definiciones\b\s*/i, '')); return { tipo: 'gioco', corso: r || null };
  }
  if (/^(?:abre )?(?:mis |los )?(?:apuntes|obsidian|vault|la nota de hoy|nota de hoy)(?: de hoy| de la clase)?$/.test(s)) return { tipo: 'appunti' };
  // «clase desde el ordenador»: la videoclase (Teams, Zoom, el campus virtual) transcrita desde el audio del ordenador
  const PC = '(?:ordenador|ordena|computador|computadora|compu|pc|mac)';
  if ((m = T(new RegExp(`^(?:(?:transcribe|graba|escucha)(?: (?:la|esta|una|el))? ?(?:videoclase|video ?clase|video|clase online|clase grabada|clase en linea|clase virtual|audio (?:del|de la) ${PC}|clase (?:del|desde el|desde la|en el|en la) (?:${PC}|navegador))|(?:clase|videoclase) (?:del|desde el|desde la) ${PC}|escucha (?:el |la )?${PC})\\b\\s*(?:de |del |sobre |para )?(.*)$`)))) return { tipo: 'trascrivi', sorgente: 'computer', corso: pulisci(m[1] || '') || null };
  if (/^transcribe$|^(?:transcribe|graba|escucha)(?: (?:la|toda la|esta))? clase\b|^(?:empieza|inicia|arranca|comienza|empezar) (?:a )?(?:la )?(?:transcripcion|transcribir|grabacion|grabar)/.test(s)) return { tipo: 'trascrivi' };
  if (/^(?:repite|repitelo|repiteme|repite(?:me)? (?:la ultima frase|los ultimos \d+ segundos|lo que (?:ha )?dicho)|que (?:ha )?dicho|que dijo|no (?:lo )?(?:he )?(?:pille|pillado|entendi|entendido|escuche|oi)|me (?:he )?perdi(?:do)?(?: algo| una frase)?)(?: (?:el|la) profe(?:sor(?:a)?)?)?$/.test(s)) { const sec = +(s.match(/(\d+) segundos/)?.[1] || 60); return { tipo: 'ripeti', sec: Math.min(90, sec) }; }
  if (/^(?:apaga|desactiva|quita|basta de)(?: el)? (?:repite|repetir)$/.test(s)) return { tipo: 'spegniRipeti' };
  if ((m = s.match(/^(?:propuestas|sugerencias)\s+(nunca|apagadas|pocas|normales|frecuentes|muchas|a menudo)$|^(?:apaga|desactiva|quita|basta de|sin)(?: las)? (?:propuestas|sugerencias)$/))) return { tipo: 'proposte', livello: !m[1] || /nunca|apagadas/.test(m[1]) ? 'mai' : /pocas/.test(m[1]) ? 'poco' : /frecuentes|muchas|menudo/.test(m[1]) ? 'spesso' : 'normale' };
  if (/^(?:proponme|sugiereme|recomiendame|dame) (?:algo|un repaso|un juego)\b|^que (?:hago|puedo hacer|deberia hacer)(?: ahora)?$|^que (?:repaso|deberia repasar|debo repasar)$/.test(s)) return { tipo: 'proponi' };
  if ((m = T(/^(?:comparte|compartir|manda|envia|pasa|pasale)(?: la| el| los| mis)? (?:transcripcion|clase|apuntes)\b\s*(?:(?:a|con) (?:mis |los |las )?(?:companeros|companeras|colegas|amigos|compas)\s*)?(.*)$/))) return { tipo: 'condividi', corso: pulisci(m[1]) || null };
  if (/^(?:para|deten|termina|acaba|cierra|stop|fin de)(?: la)? (?:transcripcion|grabacion)$|^(?:la )?clase (?:ha )?(?:terminado|termino|acabado|acabo)$|^(?:fin|final) de (?:la )?clase$|^se (?:ha )?acaba(?:do|o) la clase$/.test(s)) return { tipo: 'fineTrascrizione' };
  if (/^(?:pausa|pausar|pon en pausa)(?: la)? (?:transcripcion|grabacion)$/.test(s)) return { tipo: 'pausaTrascrizione' };
  if (/^(?:reanuda|reanudar|continua|sigue con|retoma)(?: la)? (?:transcripcion|grabacion)$/.test(s)) return { tipo: 'riprendiTrascrizione' };
  if ((m = T(/^(?:ordena|organiza|limpia|pasa a limpio|arregla|reorganiza)(?: la| los| mis| el)? (?:clase|apuntes|transcripcion)\b\s*(.*)$/))) return { tipo: 'riordina', corso: pulisci(m[1]) || null };
  if ((m = T(/^(?:cierra|cerrar)(?: la)? clase\b\s*(.*)$|^(?:extrae|extraer|saca)(?: las)? definiciones\b\s*(.*)$/))) return { tipo: 'chiudiLezione', corso: pulisci(m[1] || m[2] || '') || null };
  // tu IA: «IA», «conecta chatgpt», «usa gemini», «mi clave»
  { const FORN = { claude: 'anthropic', anthropic: 'anthropic', chatgpt: 'openai', openai: 'openai', gpt: 'openai', gemini: 'google', google: 'google', mistral: 'mistral', groq: 'groq', openrouter: 'openrouter', deepseek: 'deepseek' };
    const m = s.match(/^(?:mi ia|ia|ai|inteligencia artificial|(?:mi )?(?:clave|llave)(?: api| de la api)?|api ?key|(?:conecta|usa|configura|anade|agrega|pon)(?: la clave(?: de)?| mi)? (claude|anthropic|chatgpt|openai|gpt|gemini|google|mistral|groq|openrouter|deepseek|ia|mi ia|una clave|clave))$/);
    if (m) return { tipo: 'ai', fornitore: FORN[m[1]] || null }; }
  // la sincronización entre ordenadores
  if (new RegExp(`^(?:deja de|para de|apaga|desactiva|deten)(?: la)? sincroniza(?:r|cion)\\b|^para en este ${PC}\\b`).test(s)) return { tipo: 'sincronizza', cosa: 'smetti' };
  if (/^(?:cambia(?:r)?|nueva)(?: la| mi)? contrasena\b|^(?:olvide|se me olvido|he olvidado)(?: la| mi)? contrasena\b/.test(s)) return { tipo: 'sincronizza', cosa: 'password' };
  if (/^desbloquea(?:r)?(?: (?:la )?sincronizacion| mis datos| lode)?$/.test(s)) return { tipo: 'sincronizza', cosa: 'sblocca' };
  if (new RegExp(`^(?:conecta|vincula|anade|agrega) otr[oa] ${PC}\\b`).test(s)) return { tipo: 'sincronizza', cosa: 'altro' };
  if (new RegExp(`^(?:ya uso|ya tengo|conectame(?: a| con)?|uso)(?: lode)? (?:en |desde |con )?otr[oa] ${PC}\\b`).test(s)) return { tipo: 'sincronizza', cosa: 'collega' };
  if (/^(?:sincroniza(?:r|cion)?|sync)\b|^(?:activa|enciende|gestiona|abre)(?: la)? sincronizacion/.test(s)) return { tipo: 'sincronizza', cosa: null };
  // «prepara obsidian», «instala el modelo», «configura»: solo con queste parole, «prepara un resumen …» resta all'AI
  if ((m = s.match(/^(?:prepara|configura|instala|setup)(?: (?:el |la |lo |los )?(obsidian|modelo|cerebro|ollama|gemma|qwen|ia|todo|lode))?$/))) return { tipo: 'prepara', cosa: m[1] === 'obsidian' ? 'obsidian' : /modelo|cerebro|ollama|gemma|qwen|ia/.test(m[1] || '') ? 'cervello' : null };
  // el diario del proyecto en el vault: abrirlo, apagarlo, volver a encenderlo
  if ((m = T(/^(apaga|desactiva|no escribas|ya no escribas|enciende|activa|vuelve a activar|vuelve a encender|escribe) (?:el )?diario(?: (?:del|de) (?:proyecto)?\s*(.*))?$/))) return { tipo: 'diarioOpz', diario: /^(?:enciende|activa|vuelve|escribe)/.test(senza(m[1])), progetto: m[2] ? pulisci(m[2]) || null : null };
  if ((m = T(/^(?:abre (?:el )?)?(?:el )?diario (?:del|de) proyecto(?: (.+))?$/))) return { tipo: 'diario', progetto: m[1] ? pulisci(m[1]) : null };
  if ((m = T(/^(?:abre|abreme|ve a|vete a|ir a|llevame a|pagina)\s+(.+)$/)) && !/^(?:el |la )?(?:focus|timer|temporizador)/.test(senza(m[1]))) return { tipo: 'naviga', q: pulisci(m[1]) };
  if (/^(?:paginas|todas las paginas|inicio|home|indice)$/.test(s)) return { tipo: 'naviga', q: /^(?:inicio|home)$/.test(s) ? 'home' : '' };

  // tarjeta: anverso = reverso
  if ((m = trova(/^(?:nueva\s+)?(?:tarjeta|carta|ficha|flashcard)\s*(?:(?:de|del|para)\s+([^:]+?))?\s*:\s*(.+?)\s*(?:=|->|→|\|)\s*(.+)$/i, libero)))
    return { tipo: 'carta', esame: m[1] ? trovaEsame(m[1]) : null, fronte: m[2], retro: m[3] };

  // simulación: «¿y si saco un 30 en cálculo?», «y si me sale un 8 en física»
  if ((m = T(new RegExp(`^(?:y )?(?:que pasa )?si (?:saco|me saco|sacara|apruebo con|consigo|me ponen|tengo|me sale|me pongo) (?:un |una )?${VOTO}${LODE} (?:en|de)\\s*(.+)$`)))) {
    const v = votoDetto(m[1], m[2]); if (v) return { tipo: 'simula', ...v, esame: trovaEsame(pulisci(m[3])), nomeDetto: pulisci(m[3]) };
  }
  // la nota: «saqué un 28 en física» · «30 con matrícula en cálculo» · «me pusieron un 8,5 en bases de datos» · «aprobé
  // física con un 7». Senza verbo serve «en» («25 de enero» è una data)
  if ((m = T(new RegExp(`^(?:(?:saque|he sacado|me saque|me he sacado|me pusieron|me han puesto|me dieron|me han dado|tengo|tuve|he tenido|nota|me salio|me ha salido|aprobe con|he aprobado con|saco) (?:un |una )?${VOTO}${LODE}\\s+(?:en|de)|(?:un |una )?${VOTO}${LODE}\\s+en)\\s+(.+)$`))) || (m = T(new RegExp(`^(?:aprobe|he aprobado|pase|he pasado) (.+?) con (?:un |una )?${VOTO}${LODE}$`)))) {
    const [voto, lode, nome] = m.length === 6 ? [m[1] ?? m[3], m[2] ?? m[4], m[5]] : [m[2], m[3], m[1]];
    const v = votoDetto(voto, lode); if (v) return { tipo: 'voto', ...v, esame: trovaEsame(pulisci(nome)), nomeDetto: pulisci(nome) };
  }
  if ((m = T(/^(?:ya )?(?:he aprobado|aprobe|pase|he pasado|supere|he superado|saque (?:el )?apto en|tengo (?:el )?apto en|apto en|me dieron (?:el )?apto en) (?:el examen de |la prueba de |el )?(.+?)(?: \(?apto\)?)?$/)) && !/\d/.test(m[1]) && trovaEsame(pulisci(m[1])))
    return { tipo: 'idoneita', esame: trovaEsame(pulisci(m[1])), nomeDetto: pulisci(m[1]) };

  // focus: «focus 50 en cálculo», «estudia bases de datos una hora», «un pomodoro de 25 minutos», «voy a estudiar cálculo 2».
  // «estudio derecho en Madrid» (la carrera) resta all'AI: «estudio» da solo non fa partire il timer. Con il verbo
  // («estudiar», «estudia») e qualcosa dopo serve un esame del libretto o i minuti: «estudiar medicina en Madrid»,
  // «estudiar en el extranjero», «estudia conmigo» restano all'AI
  if ((m = T(/^(?:(?:empieza|empezar|inicia|iniciar|arranca|pon|ponme|haz|hagamos|vamos con|activa|comienza|empecemos|voy a|me pongo a|me voy a poner a) )?(?:un |una |el |la )?(?:(\d{1,3}) ?(?:minutos?|mins?|m) (?:de )?)?(focus|pomodoro|temporizador|timer|sesion de estudio|sesion|estudia|estudiar|estudiemos|a estudiar|vamos a estudiar|concentracion|concentrarme)\b\s*(.*)$/))) {
    const verbo = /^(?:estudi|a estudiar|vamos a estudiar)/.test(senza(m[2])); m = [m[0], m[1], m[3]];
    let resto = m[2].replace(/^de (?=\d)/i, ''); const mi = m[1] ? { min: +m[1] } : leggiMinuti(resto);
    if (mi?.pezzo) { const i = senza(resto).indexOf(mi.pezzo); if (i >= 0) resto = resto.slice(0, i) + ' ' + resto.slice(i + mi.pezzo.length); }
    resto = pulisci(resto.replace(/\s+/g, ' ').replace(/^de /, '').trim()); const e = resto ? trovaEsame(resto, { anche: 'daFare' }) || trovaEsame(resto) : null;
    if (!(verbo && resto && !mi && !e)) return { tipo: 'focus', min: mi ? Math.min(240, Math.max(1, mi.min)) : null, esame: e, nomeDetto: resto };
  }

  // «el examen de cálculo es el 15 de enero», «tengo cálculo 2 el 13 de octubre», «cálculo 2 se ha movido al 20 de enero»
  const EX = '(?:examen|parcial|final|oral|escrito|recuperatorio|recuperacion|prueba)';
  const QUANDO = '(el .+|en \\d.+|dentro de .+|manana|pasado manana|(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo).*|(?:este|esta|el proximo|la proxima) .+)';
  if ((m = T(new RegExp(`^(?:el |la )?${EX} (?:de |del )?(.+?) (?:es|sera|cae|lo tengo|va a ser) (?:el |la |en |a |para el )?(.+)$`))) || (m = T(new RegExp(`^(?:tengo|me toca|rindo|voy a rendir|hago) (?:(?:el|la|un|una|mi) ${EX} (?:de |del )?)?(.+?) (?:${EX} )?${QUANDO}$`))) || (m = T(new RegExp(`^(?:(?:el|la) ${EX} (?:de |del )|${EX} de )?(.+?) (?:se )?(?:ha )?(?:movido|cambiado|pasado|aplazado|adelantado|retrasado|postergado|movieron|cambiaron|paso|cambio|movio|aplazaron|adelantaron|postergaron) (?:al|a|para el|para|el) (.+)$`)))) {
    const d = leggiData(m[2]), e = trovaEsame(pulisci(m[1]));
    // un esame nuovo, fuori dal libretto, solo con «examen», «parcial», «recuperatorio» o «final de …» senza articolo:
    // «el final de la serie es el lunes», «la prueba de manejo es el martes» restano all'AI
    const nuovo = /\b(?:examen|parcial|recuperatorio|recuperacion)\b/.test(s) || (/\bfinal\b/.test(s) && !/^(?:la|el|los|las|un|una|mi|tu|su|esta|este) /.test(senza(m[1])));
    if (d && (e || (nuovo && pulisci(m[1]).length >= 3))) return { tipo: 'esame', nome: e?.nome || pulisci(m[1]), cfu: null, data: d.data, esistente: e && !e.fatto ? e : null };
  }
  // examen nuevo: «examen bases de datos el 15 de enero 9 créditos», «añade el examen de física 2 de 6 ECTS»
  if ((m = T(/^(?:anade |agrega |nuevo |apunta |apuntame |pon |tengo |hay )?(?:un |el )?(?:examen|parcial|final)(?: final| parcial)?\s*:?\s+(?:de |del )?(.+)$/)) && !/^(?:que|cuales|cuando|proxim|fechas?|calendario|completo|entero|anteriores|viejos|pasados|resueltos|de otros|oral|escrito|tipo test|de la clase)\b/.test(senza(m[1]))
    // «el final de la serie es el lunes»: «final» senza «examen» vale solo con un nome senza articolo («final de análisis»)
    && !(!/\b(?:examen|parcial)\b/.test(s) && /^(?:la|el|los|las|un|una|mi|tu|su|esta|este) /.test(senza(m[1])))) {
    let resto = ' ' + m[1].replace(/[,;]/g, ' ') + ' ';
    const c = senza(resto).match(/(?:de |con |vale |por )?(\d{1,2})\s*(?:cfu|creditos?|ects|cr)\b/); let cfu = null; if (c) { cfu = +c[1]; const i = senza(resto).indexOf(c[0]); resto = resto.slice(0, i) + ' ' + resto.slice(i + c[0].length); }
    const d = leggiData(resto); if (d) { const i = senza(resto).indexOf(d.pezzo); resto = i >= 0 ? resto.slice(0, i) + ' ' + resto.slice(i + d.pezzo.length) : norm(resto).replace(d.pezzo, ' '); }
    const nome = pulisci(String(resto).replace(/\s+/g, ' ').trim().replace(/\s+(?:el|la|de|del|para|a|y|con|en|que)$/i, '').replace(/\s+(?:el|la|de|del)$/i, ''));
    // «test» o «final» da soli sono parole di tutti i giorni: vale come examen con «examen», una data o i crediti
    if (nome && (/\bexamen\b/.test(s) || d || cfu)) return { tipo: 'esame', nome, cfu, data: d?.data || null, esistente: trovaEsame(nome) };
  }

  // «qué necesito para 110», «qué media necesito para un 8», «cuánto me hace falta para el 105»
  if ((m = s.match(/(?:que|cuanto|cuanta|cual|que media|que nota) (?:me )?(?:necesito|hace falta|tengo que sacar|debo sacar|me falta|me hace falta|necesitaria).*?(\d{1,3}(?:[.,]\d)?)/))) {
    const b = Number(m[1].replace(',', '.'));
    if (b >= 66 && b <= 110) return { tipo: 'serve', base: Math.min(110, Math.round(b)) };
    if (b >= 5 && b <= 10) return { tipo: 'serve', base: b };
  }
  if (/\b(media|promedio|nota media|expediente|mis notas|notas|calificaciones|creditos|ects|como voy|kardex)\b/.test(s) && !/\bmedia hora\b|\bhora y media\b|\bmedia (?:aritmetica|geometrica|ponderada de|movil)\b|\b(?:varianza|desviacion|mediana|moda|distribucion|binomial|normal|poisson|muestra|muestral|poblacion|estadistica|esperanza)\b/.test(s) && !/\b(explica|explicame|significa|calcula|calcular|formula|toma|tomar)\b/.test(s) && (!/\b(que es|que son|cual es|como se)\b/.test(s) || /\bmis?\b/.test(s)) && s.split(' ').length <= 6) return { tipo: 'libretto' };

  // repaso
  if ((m = T(/^(?:vamos a |quiero |empieza a |hagamos |hazme |toca )?(?:repas\w*|tarjetas|las tarjetas|mis tarjetas|flashcards|fichas)\s*(.*)$/))) {
    const r = pulisci(m[1] || ''); return { tipo: 'ripasso', esame: r ? trovaEsame(r) : null, nomeDetto: r };
  }

  // el puente con los agentes de programación: «agentes», «conecta claude code», «desconecta cursor», «qué hizo el agente»
  if ((m = s.match(/^(conecta|desconecta|quita|elimina)(?: (?:los )?agentes| (claude(?: code)?|codex|gemini(?: cli)?|cursor|copilot(?: cli)?|cline|windsurf|opencode|open code|aider|kiro|qwen(?: code)?|amp|roo(?: code)?|kilo(?: code)?|continue|zed|junie))$/))) return { tipo: 'agenti', agente: m[2] ? m[2].replace(/ (?:code|cli)$/, '').replace(' ', '') : null, togli: m[1] !== 'conecta' };
  if (/^(?:mis |los )?agentes(?: (?:de ia|de programacion|de codigo))?$|^(?:el )?puente(?: con los agentes)?$/.test(s)) return { tipo: 'agenti', agente: null };
  if (/^(?:que ha hecho|que hizo) (?:el agente|claude(?: code)?|codex|cursor|gemini|la ia)\b|^(?:el )?ultimo turno(?: del agente)?$/.test(s)) return { tipo: 'turnoAgente' };
  // Moodle en solo lectura: «conecta moodle», «novedades de moodle», «entregas», «desconecta moodle»
  const MOODLE = '(?:moodle|el campus virtual|campus virtual|el aula virtual|aula virtual)';
  if (new RegExp(`^(?:desconecta|quita|sal de|salir de|cierra sesion en)(?: el)? ${MOODLE}$`).test(s)) return { tipo: 'moodle', cosa: 'scollega' };
  if (new RegExp(`^(?:novedades|que hay de nuevo|que hay nuevo|archivos nuevos|nuevos archivos|material nuevo|revisa|mira)(?: (?:en|de|del))? (?:el )?${MOODLE}$|^moodle novedades$`).test(s)) return { tipo: 'moodle', cosa: 'novita' };
  if (new RegExp(`^(?:mis )?(?:entregas|plazos|fechas de entrega|tareas pendientes|vencimientos)(?: (?:en|de|del) ${MOODLE})?$|^que (?:tengo que entregar|hay que entregar|entregas tengo)$`).test(s)) return { tipo: 'moodle', cosa: 'scadenze' };
  if (new RegExp(`^(?:mis )?cursos (?:de|en|del) ${MOODLE}$|^moodle cursos$`).test(s)) return { tipo: 'moodle', cosa: 'corsi' };
  if (/^(?:(?:conecta|vincula|anade|agrega|abre|configura)(?: el| la)? )?(?:moodle|campus virtual|aula virtual|plataforma e-?learning)$/.test(s)) return { tipo: 'moodle', cosa: null };
  // el oral (antes del test: «simula el oral» es el oral)
  if ((m = T(/^(?:preguntame|hazme (?:unas |algunas )?preguntas|examiname|simula(?:mos)? (?:el |un )?(?:examen )?oral|oral|ponme a prueba|tomame (?:el )?oral|tomame la leccion)\b\s*(.*)$/))) {
    const r = pulisci(m[1] || ''); return { tipo: 'orale', esame: r ? trovaEsame(r) : null, nomeDetto: r };
  }
  // el test: «test de cálculo 2», «preguntas tipo test», «simulación de examen de derecho privado»
  if ((m = T(/^(?:hazme |haz |empieza |hagamos |dame |ponme )?(?:un |una |el |la )?(quiz|test(?: de opcion multiple| tipo test)?|tipo test|preguntas tipo test|opcion multiple|preguntas de opcion multiple|simulacion(?: de(?:l)? examen| del parcial)?|simula(?: el)? examen(?: escrito)?|examen tipo test)\b\s*(.*)$/))) {
    // «test» da solo è anche una parola qualsiasi («test de Turing»): con un nome vale solo se è un esame del libretto
    const r = pulisci(m[2] || ''); if (/^test$/.test(senza(m[1])) && r && !trovaEsame(r)) return null;
    return { tipo: 'crocette', esame: r ? trovaEsame(r) : null, nomeDetto: r, simulazione: /simula/.test(senza(m[1])) };
  }

  if (/^(?:mis |los )?(?:examenes|proximos examenes|calendario(?: de examenes)?|convocatorias?|fechas de examen(?:es)?|cuando tengo (?:examenes|los examenes)|mesas de examen|parciales|finales)\b/.test(s)) return { tipo: 'esami' };
  if (/^(?:hoy|plan|el plan|plan de hoy|mi plan|que (?:estudio|tengo que estudiar|toca estudiar|me toca|toca|hago)(?: hoy)?|que me toca estudiar(?: hoy)?)$/.test(s)) return { tipo: 'oggi' };

  // búsqueda directa: el nombre de un examen solo abre su ficha
  const e = trovaEsame(t);
  if (e && norm(e.nome).startsWith(norm(t)) && norm(t).length >= 3) return { tipo: 'apriEsame', esame: e };
  return null;
}

// giorni e ore di una frase («lunes y miércoles de 9 a 11 aula 7», «de lunes a viernes de 2 a 7 de la tarde»): resto è
// quello che avanza, in minuscolo e con gli accenti (il nome del corso li tiene)
const G3 = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const GIORNO_ES = '(lun(?:es)?|mar(?:tes)?|mi[eé](?:rcoles)?|jue(?:ves)?|vie(?:rnes)?|s[aá]b(?:ados?)?|dom(?:ingos?)?)';
export function giorniEOre(testo) {
  let basso = String(testo).toLowerCase().normalize('NFC')
    .replace(/\s*(?:de la (?:tarde|noche)|p\.? ?m\.?)(?![\p{L}])/gu, 'pm').replace(/\s*(?:de la ma[nñ]ana|a\.? ?m\.?)(?![\p{L}])/gu, 'am')
    .replace(/\b(?:desde|de) (?:las? )?(?=\d)/g, '').replace(/\b(a|hasta|y) las? (?=\d)/g, '$1 ').replace(/(\d)\s*(?:hs|hrs|h)(?![\p{L}])/gu, '$1');
  const o = oreInCifre(basso, 'a|hasta');
  if (!o) return null;
  let r = ' ' + basso.replace(o.pezzo, ' ').replace(/[^a-z0-9áéíóúüñ ]/g, ' ') + ' ';
  const giorni = [], idx = g => G3.indexOf(senza(g).slice(0, 3));
  // «de lunes a viernes»: tutti i giorni in mezzo
  r = r.replace(new RegExp(`(?:de )?(?<![\\p{L}])${GIORNO_ES} a ${GIORNO_ES}(?![\\p{L}])`, 'gu'), (_, a, b) => { for (let i = idx(a), k = 0; k < 7; i = (i + 1) % 7, k++) { giorni.push(i); if (i === idx(b)) break; } return ' '; });
  r = r.replace(/ (?:el |los |cada |todos los )/g, ' ').replace(new RegExp(`(?<![\\p{L}])${GIORNO_ES}(?![\\p{L}])`, 'gu'), (_, g) => { giorni.push(idx(g)); return ' '; });
  return { giorni, inizio: o.inizio, fine: o.fine, resto: r.replace(/\s+/g, ' ').replace(/^ ?/, ' ').replace(/ ?$/, ' ') };
}
// giorni, ore e aula di una lezione; quello che resta è il nome del corso
export function leggiOrario(testo) {
  const x = giorniEOre(testo);
  if (!x || !x.giorni.length) return null;
  let r = x.resto, aula = ''; r = r.replace(/ (?:en )?(?:el |la )?(?:aula|sal[oó]n|sala) (\S+)/, (_, a) => { aula = a.length <= 3 ? a.toUpperCase() : a.charAt(0).toUpperCase() + a.slice(1); return ' '; });
  const corso = r.replace(/(?<![\p{L}\d])(?:y|e|el|la|los|las|a|al|en|cada|desde|hasta|todos)(?![\p{L}\d])/gu, ' ').replace(/\s+/g, ' ').trim().replace(/^(?:de|del)\s+|\s+(?:de|del)$/g, '').trim();
  if (!corso) return null;
  const e = trovaEsame(corso);
  return { corso: e?.nome || corso.replace(/^./, c => c.toUpperCase()), giorni: x.giorni, inizio: x.inizio, fine: x.fine, aula };
}

// el trabajo (js/ore.js): «trabajo lunes, miércoles y viernes de 14 a 19», «mis turnos son …», «el jueves no trabajo», «el
// sábado también trabajo de 18 a 23», «los días que trabajo estudio como máximo 2 horas», «estudio de 10 a 22», «ya no trabajo»
const GIORNO = `(hoy|manana|pasado manana|${GIORNI.join('|')})`;
function dataDetta(x) {
  const T = oggi(), k = ['hoy', 'manana', 'pasado manana'].indexOf(x); if (k >= 0) return piuGiorni(T, k);
  const dow = GIORNI.indexOf(x); if (dow < 0) return null;
  return piuGiorni(T, (dow - new Date(T + 'T12:00').getDay() + 7) % 7);
}
const ORA = /(?:(?:de|desde)\s+)?(?:las?\s+)?\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|h|hs)?\s*(?:-|–|a|hasta)\s*(?:las?\s+)?\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|h|hs)?/g;
export function leggiLavoro(testo) {
  const t = senza(String(testo || '').toLowerCase()).replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/^[¿¡]+\s*/, '').replace(/[?!.]+$/, '').trim()
    .replace(/\s*(?:de la (?:tarde|noche)|p\.? ?m\.?)(?![a-z])/g, 'pm').replace(/\s*(?:de la manana|a\.? ?m\.?)(?![a-z])/g, 'am');
  let m;
  if (/^(?:ya no trabajo|no trabajo mas|ya no tengo (?:trabajo|curro|turnos)|deje (?:de trabajar|el trabajo|el curro)|he dejado (?:de trabajar|el trabajo)|(?:quita|borra|elimina)(?: mi)? (?:trabajo|curro)|(?:quita|borra|elimina) (?:mis |los )?turnos|sin trabajo)$/.test(t)) return { tipo: 'lavoro', azione: 'togli' };
  if (/^(?:cuando trabajo|(?:mis )?turnos(?: de trabajo)?|mi trabajo|mi horario de trabajo|(?:mis )?horarios? de trabajo)$/.test(t)) return { tipo: 'lavoro', azione: 'vedi' };
  if ((m = t.match(new RegExp(`^(?:(?:este|el|esta) )?${GIORNO},? no trabajo$`))) || (m = t.match(new RegExp(`^no trabajo (?:(?:este|el|esta) )?${GIORNO}$`)))) return { tipo: 'lavoro', azione: 'eccezione', data: dataDetta(m[1]), no: true };
  if ((m = t.match(/^(?:los dias que trabajo|cuando trabajo|(?:en )?(?:los )?dias de trabajo|los dias laborables|los dias que curro),? (?:estudio|puedo estudiar|quiero estudiar) (?:como maximo |maximo |como mucho |solo |no mas de |hasta )?(.+)$/))) {
    const mi = leggiMinuti(m[1]); if (mi && /h|min/.test(mi.pezzo) && mi.min >= 15 && mi.min <= 600) return { tipo: 'lavoro', azione: 'tetto', min: mi.min };
  }
  if ((m = t.match(/^(?:normalmente |por lo general |yo |solo )?(?:estudio|suelo estudiar) (?:de |desde |entre )?(?:las )?(.+)$/))) {
    const y = m[1].replace(/\b(a|hasta|y) las /g, '$1 '), x = oreInCifre(y, 'a|hasta|y'), o = x && x.pezzo.trim() === y.trim() && orarioOk(x.inizio, x.fine);
    if (o && o.fine !== '24:00') return { tipo: 'lavoro', azione: 'finestra', da: o.inizio, a: o.fine };
  }
  // un turno in più solo quel giorno: «el sábado también trabajo de 18 a 23», «esta semana trabajo también el sábado 18-23»
  if ((m = t.match(/^(?:esta semana,? )?(?:(.+?),? )?(?:tambien trabajo|trabajo tambien|trabajo extra|tengo (?:un )?turno extra)(?: el)? (.+)$/))) {
    const g = `${m[1] || ''} ${m[2]}`.match(new RegExp(`(?:^| )${GIORNO}(?= |$)`)), x = g && giorniEOre(m[2].replace(g[1], ' '));
    const o = x && orarioOk(x.inizio, x.fine);
    if (o) return { tipo: 'lavoro', azione: 'eccezione', data: dataDetta(g[1]), ...o };
  }
  // i turni di ogni settimana: «trabajo …» li aggiunge, «mis turnos son …» li sostituisce. Quello che avanza (en el bar) va
  // bene se è poco: «trabajo en grupo el lunes de 14 a 16 para el proyecto» o «trabajo en el TFG el lunes 9-13» non sono turni
  if ((m = t.match(/^(?:(mis turnos son|mi turno es|los turnos son|ahora trabajo|desde ahora trabajo|a partir de ahora trabajo|solo trabajo)|trabajo|curro|tengo turnos?|turnos?)\s+(.+)$/))) {
    const pezzi = [];
    let da = 0; for (const o of m[2].matchAll(ORA)) { pezzi.push(m[2].slice(da, o.index + o[0].length)); da = o.index + o[0].length; }
    if (pezzi.length) pezzi[pezzi.length - 1] += m[2].slice(da);
    const xs = pezzi.map(giorniEOre), turni = xs.map(x => x && x.giorni.length && orarioOk(x.inizio, x.fine));
    const resto = xs.flatMap(x => x ? x.resto.replace(/\b(y|e|el|la|los|las|de|del|a|al|en|cada|desde|hasta|un|una|como|todos)\b/g, ' ').trim().split(/\s+/).filter(Boolean) : []);
    if (turni.length && turni.every(Boolean) && resto.length <= 2 && !xs.some(x => /grupo|equipo|proyecto|tesis|tfg|tfm|ejercicio|tarea|deberes|practica|laboratorio|informe/.test(x.resto))) {
      const tt = turni.map((o, i) => ({ giorni: [...new Set(xs[i].giorni)].sort(), ...o }));
      return { tipo: 'lavoro', azione: m[1] ? 'sostituisci' : 'aggiungi', ...tt[0], ...(tt.length > 1 ? { turni: tt } : {}) };
    }
  }
  return null;
}

// gli stessi esempi dell'italiano, nello stesso ordine
export const ESEMPI = [
  ['focus 50 en cálculo 2', 'arranca el temporizador y cuenta las horas'],
  ['saqué un 8,5 en física', 'apunta la nota y recalcula tu media'],
  ['examen bases de datos el 15 de enero 6 créditos', 'añade la fecha del examen'],
  ['qué media necesito para un 8', 'la media que te hace falta de aquí al final'],
  ['y si saco un 9 en cálculo 2', 'simula tu media'],
  ['temario de cálculo 2', 'pega el temario: un mapa de los temas y un plan hasta el examen'],
  ['preguntas de examen de cálculo 2: …', 'las que pasa tu grupo de clase: suben en el plan'],
  ['exámenes anteriores de cálculo 2: …', 'los ejercicios de un examen viejo: uno al día, sobre los temas de hoy'],
  ['simulacro de examen de cálculo 2', 'un examen viejo entero, con el tiempo real: cómo te fue lo dices tú'],
  ['te lo explico yo: teorema de Green', 'explicas un tema y Lode te dice qué te has saltado'],
  ['test de cálculo 2', 'preguntas tipo test: práctica, o simulación de examen con tiempo'],
  ['transcribe la videoclase de derecho privado', 'desde el audio del ordenador: para quien estudia desde casa'],
  ['conecta moodle', 'archivos nuevos y entregas de la plataforma de tu universidad'],
  ['agentes', 'conecta Claude Code, Codex, Cursor…: Lode te dice qué han hecho de verdad en tus proyectos'],
  ['repasa cálculo 2', 'las tarjetas de hoy'],
  ['tarjeta: teorema de Green = …', 'una tarjeta al vuelo'],
  ['exporta a anki', 'tarjetas y definiciones en un archivo para Anki, un mazo por asignatura'],
  ['repaso de bolsillo', 'las tarjetas de mañana en una nota, para hacerlas en el móvil con Obsidian'],
  ['clase cálculo 2 lunes y miércoles 9-11 aula 7', 'tu horario: Lode sabe cuándo estás en clase'],
  ['trabajo lunes, miércoles y viernes de 14 a 19', 'tus turnos: el plan solo usa tus horas libres de verdad, con media hora para llegar'],
  ['plan de la semana', 'todos tus exámenes en un solo calendario, al minuto: qué cabe y qué no'],
  ['★ el teorema de Green lo pregunta siempre', 'en clase: marca lo que entra en el examen'],
  ['def: gradiente = vector de las derivadas parciales', 'en clase: una definición en la nota'],
  ['juega', 'dos minutos con las definiciones de la última clase'],
  ['transcribe la clase', 'en clase: toda la clase en apuntes, fórmulas incluidas, guardada en Obsidian'],
  ['pasa a limpio la clase', 'de la transcripción a apuntes limpios (IA)'],
  ['repite', 'en clase: lo que dijo el profe en los últimos 60 segundos'],
  ['IA', 'conecta tu IA favorita (Claude, ChatGPT, Gemini, Mistral…), pagas lo que usas'],
  ['comparte la transcripción', 'la clase para tus compañeros: AirDrop, WhatsApp, correo'],
  ['cierra la clase', 'definiciones y ★ sacadas de los apuntes (IA)'],
  ['abre glosario', 'salta a una página del vault'],
  ['pregúntame sobre bases de datos', 'simula el examen oral (con IA)'],
  ['qué imprime', 'ejercicios de C: la respuesta la calcula Lode, no una IA'],
  ['qué imprime en python', 'los mismos ejercicios en Python (o en Java: «qué imprime en java»)'],
  ['sigue el proyecto', 'vigila la carpeta de la práctica: qué cambia y si lo has probado'],
  ['prueba el proyecto', 'compila y ejecuta las pruebas .in/.out, después de que confirmes'],
  ['explícame el error', 'copia el error de la terminal: te lo explico en español, paso a paso'],
  ['diario del proyecto', 'abre en Obsidian el diario de hoy'],
  ['deja de seguir', 'Lode deja de vigilar la carpeta y quita sus copias'],
  ['sincroniza entre ordenadores', 'el mismo Lode en dos o tres ordenadores, con la carpeta en la nube que ya tienes'],
];

// las palabras pequeñas dentro de las tarjetas (js/comandi/comune.js, detto()): confirmar, cancelar, cerrar el oral
export const PAROLE = {
  si: ['si', 'sí', 'vale', 'ok', 'okay', 'claro', 'confirma', 'confirmo', 'dale', 'adelante', 'hazlo', 'perfecto', 'exacto', 'correcto', 'de acuerdo', 'venga', 'guarda', 'guárdalo', 'guardalo', 'guárdalas', 'guardalas', 'guárdalos', 'guardalos'],
  siCoda: ['porfa', 'por favor'],
  no: ['no', 'cancela', 'cancelar', 'anula', 'déjalo', 'dejalo', 'espera', 'para', 'nada', 'mejor no', 'olvídalo', 'olvidalo'],
  voto: ['basta', 'nota', 'dame la nota', 'he terminado', 'ya terminé', 'terminé', 'ya está', 'ya esta'],
  basta: ['salir', 'sal', 'cancela', 'basta', 'déjalo', 'dejalo'],
  esci: ['salir', 'sal', 'cierra', 'cierra el oral', 'fin del oral', 'termina el oral'],
};
