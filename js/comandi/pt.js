// Il riconoscitore portoghese (smistato da js/comandi.js): le frasi che scriverebbe davvero uno studente del Portogallo o
// del Brasile, senza AI, anche di fretta e senza accenti: «foco 50 em cálculo 2», «tive 28 a física», «tirei 28 em
// física», «exame de bases de dados a 15 de janeiro 9 ects», «quanto preciso para 110», «rever cálculo 2», «cartão: teorema
// de Green = …», «explica o erro», «segue o projeto», «muda a língua para inglês».
// Restituisce gli stessi oggetti { tipo, … } del riconoscitore italiano (js/comandi/it.js), campo per campo. Se la frase
// non è un comando ritorna null (comandi.js prova poi l'inglese, e se non è un comando ci pensa l'AI).
// Gli accenti: le frasi si confrontano senza accenti («revisao» = «revisão», «amanha» = «amanhã»), ma i pezzi che
// diventano dati (il nome di un esame, una definizione, una carta) restano come li ha scritti lo studente.
// I voti restano quelli detti (28, 30 com louvor): come leggerli lo decide il sistema dei voti (js/sistemi.js), non qui.
// I numeri a parole («vinte e oito») diventano cifre solo qui dentro: numeri() non si esporta, perché le formule dettate
// in portoghese restano come sono (docs/LINGUE.md, «La voce e le formule»).
import { norm, oggi, piuGiorni, trovaEsame } from '../dati.js';
import { sembraErrore, dataInCifre, conAnno, orarioOk, oreInCifre, linguaDetta, linguaIgnota, linguaIgnotaDetta, VOTO_CIFRE, VOTO_SOLO, numeroVoto, obiettivoDetto, conVoglio } from './comune.js';

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// i nomi delle lingue detti in portoghese, senza accenti (quelli nella loro lingua li conosce comune.js)
const LINGUE_PT = { portugues: 'pt', portuguesa: 'pt', ingles: 'en', inglesa: 'en', italiano: 'it', italiana: 'it', espanhol: 'es', espanhola: 'es', castelhano: 'es', frances: 'fr', francesa: 'fr', alemao: 'de', alema: 'de' };

// le lettere accentate diventano quelle semplici, una per una: la lunghezza non cambia, così le posizioni trovate nel
// testo senza accenti valgono anche nel testo com'era
const semAcentos = s => String(s).replace(/[À-ÖØ-öø-ÿ]/g, c => c.normalize('NFD')[0]);
// cerca re nel testo senza accenti, ma restituisce i pezzi (m[0], m[1]…) con gli accenti di prima
const COMPILATE = new Map();
function casa(re, testo) {
  let r = COMPILATE.get(re);
  if (!r) { r = new RegExp(re.source, re.flags.replace('d', '') + 'd'); COMPILATE.set(re, r); }
  const m = r.exec(semAcentos(testo)); if (!m) return null;
  const pezzi = m.indices.map(ix => (ix ? testo.slice(ix[0], ix[1]) : undefined));
  pezzi.index = m.index; return pezzi;
}
// toglie dal testo un pezzo trovato senza accenti e senza punteggiatura (il «pezzo» di leggiData), lasciando gli accenti
function tiraPezzo(testo, pezzo) {
  const re = new RegExp(pezzo.split(' ').map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^a-z0-9]+'));
  const m = re.exec(semAcentos(testo).toLowerCase()); if (!m) return testo;
  return testo.slice(0, m.index) + ' ' + testo.slice(m.index + m[0].length);
}

// i numeri detti a voce: «vinte e oito» → 28, «cinquenta» → 50, «cento e dez» → 110. «um» e «uma» restano parole (articoli)
const UNIDADES = { zero: 0, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezasseis: 16, dezesseis: 16, dezassete: 17, dezessete: 17, dezoito: 18, dezanove: 19, dezenove: 19 };
const DEZENAS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const U9 = 'um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove';
const sotto100 = `(?:(?:${Object.keys(DEZENAS).join('|')})(?: e (?:${U9}))?|(?:${Object.keys(UNIDADES).join('|')}))`;
const NUMERO = new RegExp(`(?<![\\p{L}\\d])(?:cem|cento(?: e ${sotto100})?|${sotto100})(?![\\p{L}\\d])`, 'giu');
function valore(s) {
  let v = 0;
  for (const w of s.split(' ')) if (w === 'cem' || w === 'cento') v += 100; else if (w in DEZENAS) v += DEZENAS[w]; else if (w in UNIDADES) v += UNIDADES[w]; else if (w === 'um' || w === 'uma') v += 1;
  return v;
}
const numeri = t => { const s = String(t), x = semAcentos(s); let out = '', da = 0; for (const m of x.matchAll(NUMERO)) { out += s.slice(da, m.index) + valore(m[0].toLowerCase()); da = m.index + m[0].length; } return out + s.slice(da); };
const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12, quinze: 15, vinte: 20, trinta: 30 };
const n = s => { s = semAcentos(String(s)).toLowerCase(); return s in NUM ? NUM[s] : Number(s); };

export function leggiData(testo) {
  const t = ' ' + norm(testo) + ' ', T = oggi();
  let m;
  if (/ depois de amanha /.test(t)) return { data: piuGiorni(T, 2), pezzo: 'depois de amanha' };
  if (/ amanha /.test(t)) return { data: piuGiorni(T, 1), pezzo: 'amanha' };
  if ((m = t.match(/ (hoje|hj) /))) return { data: T, pezzo: m[1] };   // «hj»: hoje, abbreviato in Brasile
  if ((m = t.match(/ (?:daqui a|dentro de|em) (\d+|\w+) (dias?|semanas?|mes|meses) /))) {
    const k = n(m[1]); if (k) return { data: piuGiorni(T, k * (m[2].startsWith('semana') ? 7 : m[2].startsWith('mes') ? 30 : 1)), pezzo: m[0].trim() };
  }
  { const c = dataInCifre(t, testo); if (c) return c; }
  // «15 de janeiro», «dia 15 de jan», «1º de março de 2027»: i mesi interi o abbreviati, mai l'inizio di un'altra parola
  const meses = '(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:eiro|ereiro|co|il|o|ho|sto|embro|ubro)?';
  if ((m = t.match(new RegExp(` (\\d{1,2}|primeiro) (?:de )?${meses} (?:(?:de )?(\\d{4}) )?`)))) {
    const g = m[1] === 'primeiro' ? 1 : +m[1], me = MESES.findIndex(x => x.startsWith(m[2]));
    return { data: conAnno(g, me, m[3] ? +m[3] : null), pezzo: m[0].trim() };
  }
  // «segunda», «na próxima sexta», «sexta-feira que vem»: il prossimo, da domani in avanti
  if ((m = t.match(new RegExp(` (?:(?:na|no|nesta|neste|esta|este|a|o) )?(?:(?:proxima|proximo) )?(${DIAS.join('|')})(?: feira)?(?: que vem)? `)))) {
    const dow = DIAS.indexOf(m[1]), d = new Date(T + 'T12:00'); const k = (dow - d.getDay() + 7) % 7 || 7;
    return { data: piuGiorni(T, k), pezzo: m[0].trim() };
  }
  return null;
}

// toglie davanti e in fondo le parole che non fanno parte del nome: «de», «em», «o exame de», «a cadeira de», «para»…
const PREP = '(?:o exame de|exame de|a cadeira de|cadeira de|a disciplina de|disciplina de|a mat[eé]ria de|mat[eé]ria de|o meu|a minha|os meus|as minhas|meu|minha|meus|minhas|de|da|do|das|dos|em|no|na|nos|nas|para|pra|pro|[aà]|ao|o|os|as|sobre|com|por|durante|on)';   // «on»: «focus 50 on cálculo», all'inglese
const PREP_FIM = '(?:de|da|do|das|dos|em|no|na|para|pra|pro|com|por|durante|sobre|[aà]s?)';
function pulisci(s) {
  let r = String(s || '').replace(/[?.!,;:]+$/, '').trim(), prima;
  do { prima = r; r = r.replace(new RegExp(`^${PREP}\\s+`, 'i'), '').replace(new RegExp(`\\s+${PREP_FIM}$`, 'i'), '').replace(/[?.!,;:]+$/, '').trim(); } while (r !== prima);
  return new RegExp(`^${PREP}$`, 'i').test(r) ? '' : r;
}
// le ore scritte all'uso portoghese e brasiliano: «14h30» → «14:30», «14h» → «14»
const horas = s => String(s).replace(/(\d{1,2})h(\d{2})\b/g, '$1:$2').replace(/(\d{1,2})h(?=[\s\-–,.]|$)/g, '$1');   // «2 horas» resta: è una durata

// minuti detti a parole: «50», «50 minutos», «uma hora», «meia hora», «uma hora e meia», «2 horas», «1h30», «90 min»
function leggiMinuti(s) {
  let m;
  if ((m = casa(/(?:^|\s)(\d{1,2})h(\d{2})\b/, s))) return { min: +m[1] * 60 + +m[2], pezzo: m[0].trim() };
  if ((m = casa(/meia hora/, s)) && !/hora e meia/.test(semAcentos(s))) return { min: 30, pezzo: m[0] };
  if ((m = casa(/(?:^|\s)(\d+|uma|um|duas|dois|tres)\s*(?:horas?|hrs?|h)\b(\s*e\s*meia)?/, s))) return { min: n(m[1]) * 60 + (m[2] ? 30 : 0), pezzo: m[0].trim() };
  if ((m = casa(/(?:^|\s)(\d+)\s*(?:minutos?|mins?|m)\b/, s))) { const k = n(m[1]); if (k) return { min: k, pezzo: m[0].trim() }; }
  // un numero da solo: all'inizio («foco 50 em …») o in fondo dopo «por»/«durante» («estudar física por 50»)
  if ((m = casa(/^\s*(\d{1,3})(?=\s|$)/, s)) || (m = casa(/\b(?:por|durante) (\d{1,3})$/, s))) return { min: +m[1], pezzo: m[0].trim() };
  return null;
}

// i comandi di «Segui il progetto» (in italiano stanno in js/codice/progetto.js): stessi oggetti { tipo: 'progetto', azione, nome? }
const PROGETTO = [
  [/^(?:segue|segui|siga|seguir|acompanha|acompanhar|vigia|vigiar)(?: (?:o|um|este|esse|o meu|meu|um novo))? projeto$/, () => ({ azione: 'segui' })],
  [/^o que (?:e que )?(?:mudou|foi alterado|alterou|mudaste|mudei)(?: (?:no|em|na) (.+))?$/, m => ({ azione: 'cambiato', nome: m[1] })],
  [/^(?:(?:ver|mostra(?:-me)?|me mostra) )?(?:as )?(?:mudancas|alteracoes)(?: (?:no|do|em|de) (.+))?$/, m => ({ azione: 'cambiato', nome: m[1] })],
  [/^(?:ja )?(?:testei|testaste|testou|testado|testada|foi testado)$/, () => ({ azione: 'provato' })],
  [/^(?:testa|testar|teste|corre|correr|roda|rodar|executa|executar) (?:o |meu |o meu )?(?:projeto|codigo|programa)(?: (.+))?$/, m => ({ azione: 'prova', nome: m[1] })],
  [/^(?:compila|compilar|compile)(?: (?:o |meu |o meu )?(?:projeto|codigo|programa)(?: (.+))?)?$/, m => ({ azione: 'prova', nome: m[1] })],
  [/^(?:para|pare|parar|deixa|deixe|deixar) de (?:seguir|acompanhar|vigiar)(?: (?:o )?(?:projeto )?(.+))?$/, m => ({ azione: 'smetti', nome: m[1] })],
  [/^(?:prepara-me|prepara me|me prepara|prepare-me|me prepare) (?:para|pra|pro) (?:a )?(?:discussao|defesa|apresentacao)(?: (?:do|da|de) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:estou |to |tou )?(?:pronto|pronta) (?:para|pra) (?:a )?(?:discussao|defesa)(?: (?:do|da|de) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:as )?funcoes (?:para|pra|a) explicar(?: (?:no|do|em|de) (.+))?$/, m => perDiscussione(m[1])],
  [/^discussao$/, () => ({ azione: 'discussione' })],
  [/^discussao (?:do|de|da) (.+)$/, m => perDiscussione(m[1])],
];
// come in progetto.js: senza nome il progetto più recente, con un nome solo se ha l'aria di un laboratorio («lab3», un numero)
const perDiscussione = nome => (!nome ? { azione: 'discussione' } : /\d|\blab|projeto/.test(nome) ? { azione: 'discussione', nome } : null);
function interpretaProgetto(testo) {
  const t = semAcentos(String(testo || '').toLowerCase()).replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim();
  for (const [re, f] of PROGETTO) {
    const m = re.exec(t); if (!m) continue;
    const r = f(m); if (!r) continue;
    const c = { tipo: 'progetto', ...r }, nome = c.nome?.replace(/^(?:o |meu |o meu )?(?:projeto|codigo|programa)\b\s*/, '').trim();
    if (nome) c.nome = nome; else delete c.nome;
    return c;
  }
  return null;
}

// «voglio fare…» e la guida passo passo (conVoglio in js/comandi/comune.js): «quero fazer um site», «como faço para editar um vídeo», «me ajuda a escrever o TCC»; «retomar o guia».
// I comandi di sempre vincono; la frase che non è un altro comando diventa { tipo: 'voglio', q }
const VOGLIO = /^(?:(?:eu )?quero|queria|preciso|tenho que|como (?:eu )?(?:fa[cç]o|posso)(?: para)?|como se faz(?: para)?|me ajuda a|ajuda-me a|me ajude a)\s+(?:fazer\s+)?(?<q>.+)$/i;
const GUIDA = /^(?:(?:retomar|retoma|continuar|continua|reabrir|reabre|voltar ao|volta ao)(?: o| meu)? guia(?: passo a passo)?|(?:meu )?guia passo a passo|onde (?:eu )?parei)$/;
export function interpreta(frase) { return conVoglio(frase, interpretaBase, { VOGLIO, GUIDA }); }

function interpretaBase(frase) {
  const grezzo0 = String(frase || '').normalize('NFC').trim(); if (!grezzo0) return null;
  // informatica: «explica o erro», anche con l'errore incollato dopo. Solo se dopo «erro» non c'è niente, ci sono i due punti
  // o un a capo, o c'è davvero un errore del compilatore: «o que significa erro padrão» resta all'AI
  let e0;
  if ((e0 = casa(/^(?:explica(?:-me)?|me explica|explique(?:-me)?|me explique|o que (?:e que )?(?:significa|quer dizer)|que quer dizer|ajuda-me com|me ajuda com) (?:o |este |esse |o meu |meu |isto do )?erro\b([\s\S]*)$/i, grezzo0))) {
    const dopo = e0[1].replace(/^[ \t]+/, ''), testo = dopo.replace(/^:/, '').trim();
    const solo = !testo || /^[?.!]+$/.test(testo) || /^(?:do compilador|de compilacao|do programa|que copiei|copiado)[?.!]*$/i.test(semAcentos(testo));
    if (solo) return { tipo: 'errore', testo: null };
    if (/^[:\n]/.test(dopo) || sembraErrore(testo)) return { tipo: 'errore', testo };
  }
  const pr = interpretaProgetto(grezzo0); if (pr) return pr;
  // la voce aggiunge maiuscole e un punto finale; i numeri arrivano a parole
  const grezzo = numeri(grezzo0.replace(/[.!]+$/, ''));
  const t = grezzo.toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim().replace(/^(?:por favor|pf|pfv),? |,? (?:por favor|pf|pfv|se faz favor|sff)$/g, '');
  const u = semAcentos(t);
  let m;

  // la lingua della barra: «muda a língua para inglês», «idioma espanhol», «passa para alemão», «língua: français»
  if ((m = u.match(/^(?:(?:muda|mudar|mude|troca|trocar|troque|altera|alterar|altere|poe|coloca|coloque|define|definir|escolhe|passa|passar|bota)(?: (?:a|o))?(?: (?:lingua|idioma))?(?: da app| do lode)?(?: (?:para|pra|pro|em|ao))?(?: o)?|(?:a )?(?:lingua|idioma):?(?: (?:para|pra))?|(?:fala|fale|responde|responda|escreve)(?:-me| comigo)? em|quero (?:o lode |a app )?em|em) (\S+)$/)) && (linguaDetta(m[1], LINGUE_PT) || linguaIgnota(m[1]))) return { tipo: 'lingua', codice: linguaDetta(m[1], LINGUE_PT) };
  // una lingua che Lode non parla («lingua giapponese», «language japanese»…): codice null, la barra dice quali conosce
  if (linguaIgnotaDetta(grezzo)) return { tipo: 'lingua', codice: null };
  if (/^(?:ajuda|ajuda-me|me ajuda|socorro|\?|o que (?:e que )?(?:sabes|consegues|podes|voce sabe|voce consegue|voce pode) fazer|comandos|que comandos (?:ha|existem|tens|tem))$/.test(u)) return { tipo: 'aiuto' };
  if (/^(?:para|pare|parar|stop|acaba|acabar|termina|terminar|chega|basta|fim|cancela|cancelar)(?: (?:o |a )?(?:foco|timer|temporizador|cronometro|pomodoro|sessao|pausa))?$/.test(u)) return { tipo: 'ferma' };
  if (/^(?:pausa|pausar|pausa (?:o )?(?:timer|temporizador)|poe em pausa|espera(?: ai)?|segura ai)$/.test(u)) return { tipo: 'sospendi' };
  if (/^(?:retoma|retomar|continua|continuar|continuemos|segue|bora|vamos la|recomeca|recomecar)(?: (?:o )?(?:timer|temporizador))?$/.test(u)) return { tipo: 'riprendi' };
  // Anki: «exporta para o anki», «anki», «exporta os cartões de cálculo 2 para o anki», «anki cálculo 2». Serve un verbo, o la
  // frase che comincia da «anki» o dalle carte: «como importo no anki», «anki como funciona», «baixar o anki» restano all'AI
  if (/\banki\b/.test(u) && (m = casa(/^(?:(?:exporta|exportar|exporte|manda|mandar|envia|enviar|passa|passar|poe|coloca|guarda|salva|prepara|cria|criar|faz|descarrega|descarregar|baixa|baixar|instala|instalar)\b\s*)?(.*)$/, t)) && (m[0] !== m[1] || /^(?:anki\b|(?:todos )?(?:os |as )?(?:meus |minhas )?(?:cartoes|cartas|flashcards|baralhos?|definicoes)\b)/.test(semAcentos(m[1])))) {
    const r = pulisci(m[1].replace(/(?:\b(?:para o|para|pro|pra|no|ao|em) )?\banki\b/i, ' ').replace(/(?:^|\s)(?:todos )?(?:os |as )?(?:meus |minhas |novos |novas )?(?:cart[oõ]es|cartas|flashcards|baralhos?|defini[cç][oõ]es)(?=\s|$)/i, ' ').trim().replace(/\s+/g, ' '));
    // «anki <qualcosa>» senza verbo è un comando solo se <qualcosa> è un esame: «anki cálculo 2» sì, «anki como funciona» no
    const domanda = m[0] === m[1] && r && (/\?\s*$/.test(grezzo0) || /^(?:como|o que|que|porque|por que|porqu|onde|quando|quanto|funciona|e|ou|nao|serve|posso|devo|da|tem|vale)(?=[\s']|$)/.test(semAcentos(r)) || !trovaEsame(r));
    const programma = /^(?:descarrega|descarregar|baixa|baixar|instala|instalar)\b/.test(u) && /^(?:o )?anki$/.test(semAcentos(m[1].trim()));
    if (!domanda && !programma) return { tipo: 'anki', corso: r && !/^(?:tudo|todos|todas|todas as cadeiras|todas as disciplinas|todos os cursos)$/.test(semAcentos(r)) ? r : null };
  }
  // «revisão de bolso» (Ripasso in tasca, js/tasca.js): le carte di domani in una nota, da fare sul telefono con Obsidian
  const TASCA = '(?:a |os |as |o )?(?:minha |meus |minhas |meu )?(?:revisao|revisoes|cartoes|cartas) (?:de bolso(?: no (?:celular|telemovel|telefone))?|no (?:telemovel|celular|telefone|bolso))';
  if (u.match(new RegExp(`^(?:nao (?:facas|faca|faz|ponhas|ponha|mandes|mande)|desliga|desligar|desativa|tira|chega de|sem mais) ${TASCA}(?: todas as noites| toda noite| toda a noite| a noite)?$`))) return { tipo: 'tasca', sera: false };
  if ((m = u.match(new RegExp(`^(?:(?:faz(?:-me)?|me faz|faca|prepara(?:-me)?|me prepara|manda(?:-me)?|me manda|poe|coloca|escreve|atualiza|cria|liga) )?${TASCA}( todas as noites| toda noite| toda a noite| (?:so|apenas) quando (?:eu )?(?:pedir|peco))?$`)))) return m[1] ? { tipo: 'tasca', sera: !/pedir|peco/.test(m[1]) } : { tipo: 'tasca' };

  // il programma d'esame: «programa de cálculo 2», «programa», «ementa de cálculo 2: 1. limites …» (incollato, anche su più
  // righe: si legge dalla frase com'era). «programa de hoje» resta il piano di oggi
  if ((m = casa(/^(?:(?:abre|abrir|mostra(?:-me)?|me mostra|ver|aqui esta|aqui vai|eis|cola|colar) )?(?:o |a )?(?:programa da cadeira|programa da disciplina|programa do exame|conteudo programatico|programa|ementa)(?:\s+(?:de|da|do|das|dos|para|pra)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i, grezzo0)) && !/^(?:de |para )?(?:hoje|amanha)$|^em\b/i.test(semAcentos(m[1].trim()))) {
    const nome = pulisci(numeri(m[1]).toLowerCase()); return { tipo: 'programma', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  // «deixa-me explicar: green», «eu explico as séries de potências»: lo studente spiega, Lode controlla cosa ha detto
  if ((m = casa(/^(?:deixa-me explicar|deixa eu explicar|deixe-me explicar|me deixa explicar|deixa que eu explico|eu explico|explico eu|eu te explico|vou-te explicar|vou te explicar|eu vou explicar|vou explicar)\b(?: isso| isto)?\s*:?\s*(.*)$/, t))) return { tipo: 'spiego', q: pulisci(m[1] || '') };
  // le domande uscite agli esami: «perguntas de exame de cálculo 2: …» (una per riga)
  if ((m = casa(/^(?:(?:aqui estao|aqui vao|cola|colar|adiciona|adicionar) )?(?:as )?(?:perguntas|questoes) (?:de exame|de prova|dos exames(?: anteriores| passados)?|do exame|da prova|que sairam(?: no exame)?|que cairam(?: na prova| no exame)?|das provas anteriores|de provas anteriores)(?:\s+(?:de|da|do|das|dos|em|para|pra)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i, grezzo0))) {
    const nome = pulisci(numeri(m[1]).toLowerCase()); return { tipo: 'domande', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  // i temi d'esame (js/temi.js): «exames antigos de cálculo 2: Exercício 1 …», «provas antigas de mecânica»; «exercício de
  // cálculo 2», «dá-me um exercício» = l'esercizio di oggi. «exercícios de c», «exercícios em python» restano a «o que imprime»
  if ((m = casa(/^(?:(?:aqui esta|aqui estao|aqui vai|aqui vao|cola|colar|adiciona|abre|mostra(?:-me)?|me mostra) )?(?:os |as |o |a |um |uma )?(?:exames antigos|exames anteriores|exames passados|exame antigo|provas antigas|provas anteriores|prova antiga|frequencias antigas|testes antigos|enunciados antigos|exercicios de exame|exercicios dos exames(?: antigos)?)(?:\s+(?:de|da|do|das|dos|para|pra)\b)?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i, grezzo0))) {
    const nome = pulisci(numeri(m[1]).toLowerCase()); return { tipo: 'temi', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  if ((m = casa(/^(?:(?:da-me|me da|me de|quero|bora|vamos fazer|faz-me|deixa-me fazer|deixa eu fazer|faco|vou fazer) )?(?:um |o |o meu )?exercicio(?: de exame| de hoje| do dia)?(?:\s+(?:de|da|do|para|pra|sobre)\s+(?!(?:c|c\+\+|java|python|programacao)$)(.+))?$/, t))) {
    const nome = pulisci(m[1] || ''); return { tipo: 'temi', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: '' };
  }
  // la prova generale (js/prova.js): un exame antigo intero col tempo vero. «exame completo de cálculo 2», «simulado de mecânica»
  if ((m = casa(/^(?:(?:faz|fazer|faco|faca|quero fazer|vamos fazer|bora fazer|deixa-me fazer|deixa eu fazer|comeca|comecar|inicia|abre) )?(?:um |uma |o |a )?(?:simulado|exame completo|exame inteiro|prova completa|prova inteira|ensaio geral|exame antigo (?:completo|inteiro))(?:\s+(?:de|da|do|das|dos|para|pra|sobre)\b)?\s*(.*)$/, t))) {
    const nome = pulisci(m[1] || ''); return { tipo: 'prova', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome };
  }

  // em aula: ★ da esame, definizione, domanda per il prof
  if ((m = casa(/^(?:★|\*{1,2}|!|(?:importante|exame)\s*:|estrela\s*:?|marca(?: isto| isso)? como (?:para o |pro )?exame\s*:?|marca (?:isto|isso) (?:para o |pro )?exame\s*:?|marca (?:para o |pro )?exame\s*:|(?:isto |isso )?(?:sai|cai|vai sair|vai cair) (?:no exame|na prova)\s*:?)\s*(.+)$/i, grezzo))) return { tipo: 'stella', testo: m[1].trim() };
  if ((m = grezzo.match(/^(?:defini[cç][aã]o|define|def)\s*:?\s*(.+?)\s*(?:::|:|=|→|—|-{1,2}>|\bigual a\b|\bsignifica\b|\bquer dizer\b|\sé\s)\s*(.+)$/i))) return { tipo: 'definizione', termine: m[1].replace(/\*\*/g, '').trim(), testo: m[2].trim() };
  if ((m = casa(/^(?:\?|pergunta\s*:|duvida\s*:|pergunta (?:para|pro|pra|ao) (?:o |a )?(?:prof(?:essor|essora)?|stor|stora|docente)\s*:?|perguntar ao (?:prof(?:essor)?|stor|docente)\s*:?)\s*(.+)$/i, grezzo))) return { tipo: 'domanda', testo: m[1].trim() };

  // l'orario: «aula cálculo 2 segunda e quarta 9-11 sala 7»
  if ((m = casa(/^(?:adiciona |nova |novo |tenho )?(?:a |uma )?(?:aula|aulas|cadeira|disciplina)\s+(?:de |da |do )?(.+)$/, t))) {
    const o = leggiOrario(m[1]); if (o) return { tipo: 'orario', ...o };
  }
  if (/^(?:(?:o )?(?:meu )?horario|(?:o )?horario das aulas|(?:as )?(?:minhas )?aulas|quando (?:e que )?tenho aulas?|que aula tenho|que aulas tenho)$/.test(u)) return { tipo: 'vediOrario' };
  { const l = leggiLavoro(t); if (l) return l; }
  if (/^(?:o )?(?:plano (?:da|desta|para a|para esta) semana|plano semanal)$|^(?:(?:a )?(?:minha )?semana|(?:o )?(?:meu )?tempo livre|(?:as )?(?:minhas )?horas livres|quanto tempo tenho(?: para estudar| pra estudar)?)$/.test(u)) return { tipo: 'ore' };
  // «o que imprime»: esercizi di C (anche in Java e in Python) con la risposta calcolata da Lode
  if (/^(?:o que (?:e que )?(?:isto |isso |este codigo |esse codigo |este programa |esse programa )?(?:imprime|printa)|que imprime|exercicios? (?:de |em )?(?:c|programacao)|treina-me (?:em|no|a) c|me treina em c)$/.test(u)) return { tipo: 'stampa' };
  if ((m = u.match(/^(?:o que (?:e que )?(?:isto |isso |este codigo |esse codigo |este programa |esse programa )?(?:imprime|printa)(?: em)?|exercicios? (?:de|em)|treina-me (?:em|no)|me treina em) (c|java|python)$/))) return { tipo: 'stampa', lingua: m[1] };
  if ((m = casa(/^(?:vamos jogar|bora jogar|jogar|joga|jogo|joguinho|memory|treina-me|me treina|treino|treinar|fixa as definicoes|definicoes)\b\s*(.*)$/, t))) {
    const r = pulisci(m[1] || ''); return { tipo: 'gioco', corso: r || null };
  }
  if (/^(?:abre |abrir )?(?:os |as )?(?:meus |minhas )?(?:apontamentos|anotacoes|notas da aula|obsidian|vault|cofre|a nota|nota)(?: de hoje| da aula| do dia)?$/.test(u)) return { tipo: 'appunti' };
  // «aula do computador»: la videoaula (Teams, Zoom, la plataforma online) trascritta dall'audio del computer
  if ((m = casa(/^(?:(?:transcreve|transcrever|transcreva|grava|gravar|ouve|ouvir|escuta|escutar)(?: (?:a|esta|essa|uma|o))? ?(?:videoaula|video-aula|video aula|video|audio do (?:computador|pc|portatil|notebook|laptop|mac)|aula (?:do|no|pelo) (?:computador|pc|portatil|notebook|laptop|mac|browser|navegador)|aula online|aula gravada|aula remota)|(?:aula|videoaula) do (?:computador|pc|portatil|notebook|laptop|mac)|(?:ouve|escuta) o (?:computador|pc|portatil|notebook|laptop|mac))\b\s*(?:de |da |do |para )?(.*)$/, t))) return { tipo: 'trascrivi', sorgente: 'computer', corso: pulisci(m[1] || '') || null };
  if (/^(?:transcreve|transcrever|transcreva|grava|gravar|grave)$|^(?:transcreve|transcrever|transcreva|grava|gravar|grave|ouve|escuta)(?: (?:a|toda a|esta|essa))? aula\b|^(?:comeca|comecar|inicia|iniciar|liga|ativa) (?:a )?(?:transcricao|gravacao)/.test(u)) return { tipo: 'trascrivi' };
  if (/^(?:repete|repetir|repita|repete isso|repete (?:a ultima frase|os ultimos \d+ segundos)|o que (?:e que )?(?:ele|ela|o prof|o professor|a professora|o stor|a stora|o docente) (?:acabou de dizer|disse)|que disse (?:ele|ela|o prof|o professor)|nao percebi|nao entendi|perdi (?:alguma coisa|uma frase|isso))$/.test(u)) { const sec = +(u.match(/(\d+) segundos/)?.[1] || 60); return { tipo: 'ripeti', sec: Math.min(90, sec) }; }
  if (/^(?:desliga|desligar|desativa|desativar|para|chega de)(?: o)? (?:repete|repetir)$/.test(u)) return { tipo: 'spegniRipeti' };
  if ((m = u.match(/^(?:sugestoes|propostas|dicas)\s+(nunca|desligadas|poucas|normais|frequentes|muitas)$|^(poucas|normais|frequentes|muitas) (?:sugestoes|propostas|dicas)$|^(?:desliga|desativa|chega de|sem mais|para com)(?: as)? (?:sugestoes|propostas|dicas)$/))) { const l = m[1] || m[2]; return { tipo: 'proposte', livello: !l || /nunca|deslig/.test(l) ? 'mai' : /poucas/.test(l) ? 'poco' : /frequentes|muitas/.test(l) ? 'spesso' : 'normale' }; }
  if (/^(?:sugere(?:-me)?|sugira|me sugere|propoe(?:-me)?|me propoe|da-me|me da) (?:algo|alguma coisa|uma revisao|um jogo)$|^o que (?:e que )?(?:posso|devo) fazer (?:agora|a seguir)$|^o que (?:e que )?(?:devo |posso )?rever$|^o que (?:eu )?reviso$/.test(u)) return { tipo: 'proponi' };
  if ((m = casa(/^(?:partilha|partilhar|compartilha|compartilhar|manda|mandar|envia|enviar|passa)(?: a| as| os)? (?:transcricao|aula|apontamentos|anotacoes|sebenta|apostila)\b\s*(.*)$/, t))) { const r = pulisci(m[1].replace(/^(?:com|aos|para os|pros|pra|para|a|com os) (?:os )?(?:meus )?(?:colegas(?: de turma)?|amigos)\s*/i, '')); return { tipo: 'condividi', corso: r || null }; }
  if (/^(?:para|parar|termina|terminar|acaba|acabar|fecha|fechar|chega de)(?: a)? (?:transcricao|gravacao)|^(?:para|parar|pare) de (?:gravar|transcrever)$|^(?:a )?aula (?:acabou|terminou|chegou ao fim)$|^fim da aula$/.test(u)) return { tipo: 'fineTrascrizione' };
  if (/^(?:pausa|pausar|poe em pausa|suspende|suspender)(?: a)? (?:transcricao|gravacao)/.test(u)) return { tipo: 'pausaTrascrizione' };
  if (/^(?:retoma|retomar|continua|continuar|recomeca)(?: a)? (?:transcricao|gravacao)/.test(u)) return { tipo: 'riprendiTrascrizione' };
  if ((m = casa(/^(?:arruma|arrumar|organiza|organizar|limpa|limpar|reorganiza|poe em ordem|passa a limpo|passar a limpo)(?: a| os| as)? (?:aula|apontamentos|anotacoes|transcricao)\b\s*(.*)$/, t))) return { tipo: 'riordina', corso: pulisci(m[1]) || null };
  if ((m = casa(/^(?:fecha|fechar|termina|terminar|encerra|encerrar)(?: a)? aula\b\s*(.*)$|^extrai(?:r)?(?: as)? definicoes\b\s*(.*)$/, t))) return { tipo: 'chiudiLezione', corso: pulisci(m[1] ?? m[2] ?? '') || null };
  // a tua IA: «IA», «conecta o chatgpt», «usa o gemini», «a minha chave»
  { const FORN = { claude: 'anthropic', anthropic: 'anthropic', chatgpt: 'openai', openai: 'openai', gpt: 'openai', gemini: 'google', google: 'google', mistral: 'mistral', groq: 'groq', openrouter: 'openrouter', deepseek: 'deepseek' };
    const m = u.match(/^(?:(?:a )?minha (?:ia|ai)|ia|ai|inteligencia artificial|(?:a )?(?:minha )?chave(?: (?:da )?api)?|api ?key|(?:conecta|conectar|liga|ligar|usa|usar|define|definir|adiciona|adicionar|poe|coloca)(?: a chave(?: d[oae])?| a minha| o| a)? (claude|anthropic|chatgpt|openai|gpt|gemini|google|mistral|groq|openrouter|deepseek|ia|a minha ia|minha ia|uma chave|chave))$/);
    if (m) return { tipo: 'ai', fornitore: FORN[m[1]] || null }; }
  // a sincronização entre computadores
  if (/^(?:para|parar|deixa|deixar|desliga|desativa|chega)(?: de)?(?: a)? (?:sincronizar|sincronizacao|sync)\b|^para (?:neste|nesse) (?:computador|pc|portatil|notebook|laptop|mac)\b/.test(u)) return { tipo: 'sincronizza', cosa: 'smetti' };
  if (/^(?:muda|mudar|altera|alterar|troca|trocar|nova)(?: a)? (?:palavra-passe|password|senha)\b|^(?:esqueci|esqueci-me)(?: da| a)? (?:palavra-passe|password|senha)\b/.test(u)) return { tipo: 'sincronizza', cosa: 'password' };
  if (/^desbloqueia(?:r)?(?: (?:a )?sincronizacao| os (?:meus )?dados| o lode)?$|^desbloquear$/.test(u)) return { tipo: 'sincronizza', cosa: 'sblocca' };
  if (/^(?:liga|ligar|conecta|conectar|adiciona|adicionar) (?:outro|mais um) (?:computador|pc|portatil|notebook|laptop|mac)\b/.test(u)) return { tipo: 'sincronizza', cosa: 'altro' };
  if (/^(?:ja uso|ja tenho|uso|liga-me a|conecta-me a)(?: o)?(?: lode)? (?:noutro|num outro|em outro|no outro|de outro|outro) (?:computador|pc|portatil|notebook|laptop|mac)\b/.test(u)) return { tipo: 'sincronizza', cosa: 'collega' };
  if (/^(?:sincroniza|sincronizar|sincronizacao|sync)\b|^(?:liga|ativa|ativar|gere|gerir|abre)(?: a)? sincronizacao\b/.test(u)) return { tipo: 'sincronizza', cosa: null };
  // preparar o computador: só o verbo e o que se prepara («instala o modelo», «configura o obsidian»), não «prepara-me um resumo»
  if ((m = u.match(/^(?:prepara|preparar|configura|configurar|instala|instalar)(?: (?:o|a|os|tudo|o lode|tudo para))?(?: (obsidian|modelo|cerebro|ollama|gemma|qwen|ia)(?: local)?)?$/))) return { tipo: 'prepara', cosa: m[1] === 'obsidian' ? 'obsidian' : m[1] ? 'cervello' : null };
  // il diario del progetto nel vault: aprirlo, spegnerlo, riaccenderlo
  if ((m = casa(/^(desliga|desligar|nao escrevas|nao escreva|para de escrever|liga|ligar|volta a ligar|religa|escreve) (?:o )?diario(?: do projeto)?(?: (?:do|de|para o|pro|para) (?:projeto)?\s*(.*))?$/, t))) return { tipo: 'diarioOpz', diario: /^(?:liga|ligar|volta a ligar|religa|escreve)$/.test(semAcentos(m[1])), progetto: m[2] ? pulisci(m[2]) || null : null };
  if ((m = casa(/^(?:(?:abre|abrir) )?(?:o )?diario (?:do|de) projeto(?: (?:do |de |para )?(.+))?$/, t))) return { tipo: 'diario', progetto: m[1] ? pulisci(m[1]) : null };
  if ((m = casa(/^(?:abre|abrir|vai para|vai a|vai pra|ir para|leva-me (?:a|para)|me leva (?:a|para|pra)|mostra-me|me mostra|pagina)\s+(.+)$/, t)) && !/^(?:o |a )?(?:foco|timer|temporizador)/.test(semAcentos(m[1]))) return { tipo: 'naviga', q: pulisci(m[1]) };
  if (/^(?:todas as notas|paginas|home|inicio|indice)$/.test(u)) return { tipo: 'naviga', q: /^(?:home|inicio)$/.test(u) ? 'home' : '' };

  // carta: frente = verso
  if ((m = casa(/^(?:nov[oa]\s+)?(?:cartao|carta|flashcard|ficha)\s*(?:(?:de|da|do|para|pra)\s+([^:]+?))?\s*:\s*(.+?)\s*(?:=|->|→|\|)\s*(.+)$/i, grezzo)))
    return { tipo: 'carta', esame: m[1] ? trovaEsame(m[1]) : null, fronte: m[2], retro: m[3] };

  // simulazione: «e se eu tirar 28 em cálculo», «e se eu tirar 9 em física», «e se eu tirar 8,5 em cálculo». Il voto è quello
  // detto: se il sistema dei voti lo ha lo decide js/libretto.js
  const LOUVOR = '( com louvor| cum laude| e louvor| e lode| lode| com distincao)?';
  if ((m = casa(new RegExp(`^(?:e )?se (?:eu )?(?:tirar|tiver|tiro|fizer|conseguir|levar|sacar) (?:um |uma |nota )?${VOTO_CIFRE}${LOUVOR} (?:a|em|no|na|ao|à)\\s*(.+)$`), t))) {
    const v = numeroVoto(m[1]);
    if (v != null) return { tipo: 'simula', voto: v, lode: !!m[2] && v === 30, esame: trovaEsame(pulisci(m[3])), nomeDetto: pulisci(m[3]) };
  }
  // voto: «tirei 28 em mecânica» · «tive 28 a mecânica» · «tirei 8,5 em física» · «30 com louvor em cálculo 2» · «passei a
  // inglês». Senza il verbo il voto ha due cifre o i decimali («8,5 em física»): «2 em física» da solo non è un voto
  if ((m = casa(new RegExp(`^(?:tirei|tive|fiz|passei com|consegui|levei|sacei|nota|tirei nota|tive nota) (?:(?:a |uma )?nota (?:de )?)?(?:um |uma )?${VOTO_CIFRE}${LOUVOR}\\s+(?:a|em|no|na|ao|à)\\s+(.+)$`), t)) || (m = casa(new RegExp(`^(?:(?:a |uma )?nota (?:de )?)?(?:um |uma )?${VOTO_SOLO}${LOUVOR}\\s+(?:a|em|no|na|ao|à)\\s+(.+)$`), t))) {
    // «tive 15 a mecânica e estou triste» è uno sfogo, non un voto da segnare: resta all'AI
    const v = /\s(?:e|mas|porque|que) (?:estou|to|tou|fiquei|foi|nao|ja|agora|acho)\b/.test(semAcentos(m[3])) ? null : numeroVoto(m[1]);
    if (v != null) return { tipo: 'voto', voto: v, lode: !!m[2] && v === 30, esame: trovaEsame(pulisci(m[3])), nomeDetto: pulisci(m[3]) };
  }
  if ((m = casa(/^(?:eu )?(?:passei|fiquei aprovad[oa]|fui aprovad[oa]|despachei) (?:a |o |no |na |em |ao )?(?:cadeira de |disciplina de |exame de |prova de )?(.+?)(?: \(?(?:aprovado|aprovada|apto|apta|sem nota)\)?)?$/, t)) && !/\d/.test(m[1]) && trovaEsame(pulisci(m[1])))
    return { tipo: 'idoneita', esame: trovaEsame(pulisci(m[1])), nomeDetto: pulisci(m[1]) };

  // focus, anche con i minuti prima: «um pomodoro de 25 minutos em física»
  if ((m = casa(/^(?:(?:comeca|inicia|iniciar|vamos|bora|faz|faco|fazer|liga|poe|quero) )?(?:a |o |um |uma )?(?:(\d{1,3})[ -]?(?:minutos?|mins?|m) (?:de )?)?(foco|focus|focar|foca|pomodoro|timer|temporizador|sessao(?: de estudo)?|estudar|estudo|estuda|concentracao|concentrar)\b\s*(.*)$/, t))) {
    let resto = m[3]; const mi = m[1] ? { min: +m[1] } : leggiMinuti(resto); if (mi?.pezzo) resto = resto.replace(mi.pezzo, ' ');
    resto = pulisci(resto.replace(/\s+/g, ' ').trim()); const e = resto ? trovaEsame(resto, { anche: 'daFare' }) || trovaEsame(resto) : null;
    // «estudar é difícil», «estudo entre amigos»: il verbo da solo è un comando con una durata, un esame o niente dopo
    if (/^estud/.test(semAcentos(m[2])) && resto && !mi && !e) return null;
    return { tipo: 'focus', min: mi ? Math.min(240, Math.max(1, mi.min)) : null, esame: e, nomeDetto: resto };
  }

  // «o exame de cálculo é dia 15 de janeiro», «tenho cálculo 2 no dia 13 de outubro», «cálculo 2 foi adiado para 20 de janeiro»
  const QUANDO = '((?:(?:no dia|dia|a|em|para) \\d.+)|amanha|depois de amanha|hoje|(?:daqui a|dentro de) .+|(?:(?:na|no|nesta|neste|esta|este) )?(?:proxim[ao] )?(?:segunda|terca|quarta|quinta|sexta|sabado|domingo).*)';
  if ((m = casa(/^(?:o |a )?(?:exame|teste|prova|frequencia|oral|escrito|exame escrito|exame oral) (?:de |da |do )?(.+?) (?:e|sera|vai ser|cai|calha|fica) (?:no dia |dia |no |na |em |a |para )?(.+)$/, t)) || (m = casa(new RegExp(`^(?:eu )?(?:tenho|vou ter|faco|vou fazer) (?:(?:o |a )?(?:exame|prova|teste|oral|escrito) (?:de |da |do )?)?(.+?) ${QUANDO}$`), t)) || (m = casa(/^(?:o |a )?(?:(?:exame|prova) (?:de |da |do )?)?(.+?) (?:foi |esta |ficou )?(?:adiado|adiada|antecipado|antecipada|mudado|mudada|remarcado|remarcada|passou) (?:para|pra|pro|ao) (?:o |a |dia |o dia )?(.+)$/, t))) {
    // la data viene subito dopo il verbo: senza accenti «e» è anche «e» (and), e «bases de dados e redes a 3 de fevereiro» non è
    // «bases de dados» il 3 febbraio (va al nuovo esame qui sotto)
    const d0 = leggiData(m[2]), d = d0 && norm(m[2]).replace(/^(?:(?:no|o) dia|dia|no|na|em|a|para) (?=\d)/, '').startsWith(norm(d0.pezzo)) ? d0 : null, e = trovaEsame(pulisci(m[1]));
    if (d && !/^(?:(?:um|uma|o|a) )?(?:exame|prova|teste|oral|escrito|frequencia)s?$/.test(semAcentos(pulisci(m[1]))) && (e || (/exame|prova|teste|oral|escrito|frequencia/.test(u) && pulisci(m[1]).length >= 3))) return { tipo: 'esame', nome: e?.nome || pulisci(m[1]), cfu: null, data: d.data, esistente: e && !e.fatto ? e : null };
  }
  // nuovo esame: «exame de bases de dados a 15 de janeiro 9 ects», «adiciona exame história moderna»
  // le parole intere hanno il confine: «me», «que», «qual» non devono escludere «mecânica», «química», «qualidade»
  if ((m = casa(/^(?:adiciona |adicionar |acrescenta |novo |nova |marca |marcar |poe |tenho |ha |tem )?(?:um |o |uma |a )?(?:exame|prova|teste)\s*:?\s+(?:de |da |do |dos |das )?(.+)$/, t)) && !/^(?:(?:me|que|quais|qual|quando|datas?|calendario|epoca|sessao|perguntas|questoes|exercicios|topicos|oral|escrito|geral|de escolha|americano)\b|proxim|antig|anterior|simulad|simulacao|complet|inteir)/.test(semAcentos(m[1])) &&!/^(?:di|del|della|du|des|der|die|das|von|of|the)\b/.test(semAcentos(m[1]))) {
    let resto = ' ' + m[1].replace(/[,;]/g, ' ') + ' ';
    const c = casa(/(?:com |de |vale |valendo )?(\d{1,2})\s*(?:cfu|creditos?|ects|cr)\b/, resto); let cfu = null; if (c) { cfu = +c[1]; resto = resto.replace(c[0], ' '); }
    const d = leggiData(resto); if (d) resto = tiraPezzo(resto, d.pezzo);
    const nome = pulisci(String(resto).replace(/\s+(?:no dia|dia|a|em|no|na|para|e|com|valendo|vale)\s*$/g, '').replace(/\s+/g, ' ').trim());
    // «teste» da solo è anche una parola inglese e italiana: vale come esame solo con «exame»/«prova», una data o i crediti
    // il resto di una frase («tenho exame amanhã e estou nervoso») non è il nome di un esame
    // «o exame de mecânica é dia 5» (senza mese): una data che non si legge non diventa il nome «mecanica e dia 5»
    if (nome && !/^(?:e|mas|porque|que|estou|tou|to|nao|ja|so)\b/.test(semAcentos(nome)) && !/ (?:e|sera|vai ser|fica|calha|cai) (?:no |a |em )?(?:dia )?\d/.test(semAcentos(nome).toLowerCase()) && (/\b(?:exame|prova)\b/.test(u) || d || cfu)) return { tipo: 'esame', nome, cfu, data: d?.data || null, esistente: trovaEsame(nome) };
  }

  // «quanto preciso para 110», «que média preciso para começar com 105», «quanto preciso para 7», «quanto preciso para
  // 8,5». L'obiettivo è il numero detto: se è nella scala del voto final lo decide js/libretto.js
  if ((m = u.match(/(?:quanto|que media|qual media|qual a media|que nota|que notas|o que) (?:e que )?(?:eu )?(?:preciso|precisava|tenho de|tenho que|me falta|falta|devo)\b(.*)$/))) {
    const b = obiettivoDetto(m[1]); if (b != null) return { tipo: 'serve', base: b };
  }
  if ((/\b(?:media|medias|pauta|caderneta|historico|creditos|ects|nota final|nota de curso|como estou|como vou)\b/.test(u) || /^(?:as )?(?:minhas )?notas$/.test(u)) && !/\b(?:explica|significa|calcula|calcular|quer dizer)\b/.test(u) && (!/\b(?:o que e|que e|qual e|o que sao)\b/.test(u) || /\b(?:minha|minhas|meu|meus)\b/.test(u))) return { tipo: 'libretto' };

  // ripasso
  if ((m = casa(/^(?:vamos |bora |quero |comeca |comecar |inicia )?(?:rever|reve|revisar|revisa|revisao|revisoes|repassar|flashcards|(?:os )?(?:meus )?cartoes|cartas)\b\s*(.*)$/, t))) {
    const r = pulisci((m[1] || '').replace(/\s+(?:hoje|hj)$/i, '')); return { tipo: 'ripasso', esame: r ? trovaEsame(r) : null, nomeDetto: r };   // «rever mecânica hoje»: oggi è già il ripasso di oggi
  }

  // la ponte con gli agenti di programmazione: «agentes», «conecta o claude code», «desliga o cursor», «o que fez o agente»
  if ((m = u.match(/^(conecta|conectar|liga|ligar|desconecta|desconectar|desliga|desligar|remove|tira)(?: (?:os )?agentes| (?:o )?(claude(?: code)?|codex|gemini(?: cli)?|cursor|copilot(?: cli)?|cline|windsurf|opencode|open code|aider|kiro|qwen(?: code)?|amp|roo(?: code)?|kilo(?: code)?|continue|zed|junie))$/))) return { tipo: 'agenti', agente: m[2] ? m[2].replace(/ (?:code|cli)$/, '').replace(' ', '') : null, togli: !/^(?:conecta|liga)/.test(m[1]) };
  if (/^(?:os |os meus |meus )?agentes(?: (?:de ia|ia|de programacao|de codigo))?$|^(?:a )?ponte(?: com os agentes)?$/.test(u)) return { tipo: 'agenti', agente: null };
  if (/^o que (?:e que )?(?:fez|andou a fazer|andou fazendo|anda a fazer) (?:o agente|(?:o )?claude(?: code)?|(?:o )?codex|(?:o )?cursor|(?:o )?gemini|a ia)\b|^(?:o )?ultimo turno(?: do agente)?$/.test(u)) return { tipo: 'turnoAgente' };
  // Moodle em só leitura: «conecta o moodle», «novidades no moodle», «prazos», «desconecta o moodle»
  if (/^(?:desconecta|desconectar|desliga|sai do|sair do|tira|remove)(?: o)? moodle$/.test(u)) return { tipo: 'moodle', cosa: 'scollega' };
  if (/^(?:novidades|o que ha de novo|o que tem de novo|que ha de novo|ficheiros novos|arquivos novos|materiais novos|verifica)(?: (?:no|do|em|na))? moodle$|^moodle novidades$/.test(u)) return { tipo: 'moodle', cosa: 'novita' };
  if (/^(?:os |as )?(?:meus |minhas )?(?:prazos|entregas|datas de entrega)(?: (?:no|do) moodle)?$|^o que (?:e que )?(?:tenho|ha) (?:para|pra) entregar$/.test(u)) return { tipo: 'moodle', cosa: 'scadenze' };
  if (/^(?:as |os )?(?:minhas |meus )?(?:disciplinas|cadeiras|cursos) (?:no|do|em) moodle$|^moodle (?:cadeiras|disciplinas|cursos)$/.test(u)) return { tipo: 'moodle', cosa: 'corsi' };
  if (/^(?:(?:conecta|conectar|liga|ligar|adiciona|abre|configura)(?: ao| o| a)? )?(?:moodle|plataforma (?:de )?e-?learning|e-?learning(?: da faculdade| da universidade)?)$/.test(u)) return { tipo: 'moodle', cosa: null };
  // a oral (antes do quiz: «faz-me perguntas» é a oral)
  if ((m = casa(/^(?:faz-me (?:umas |algumas )?perguntas|me faz (?:umas |algumas )?perguntas|pergunta-me|interroga-me|me interroga|testa-me|me testa|simula (?:a |uma )?(?:oral|prova oral|exame oral)|simular (?:a |uma )?oral|exame oral|prova oral|oral)\b\s*(.*)$/, t))) {
    const r = pulisci(m[1] || ''); return { tipo: 'orale', esame: r ? trovaEsame(r) : null, nomeDetto: r };
  }
  // o quiz de escolha múltipla: «quiz de cálculo 2», «escolha múltipla», «simulação de exame de direito civil»
  if ((m = casa(/^(?:faz-me |me faz |da-me |me da |comeca |vamos fazer |bora fazer |faz |faca )?(?:um |uma |o |a )?(quiz|teste de escolha multipla|escolha multipla|multipla escolha|perguntas de escolha multipla|questoes de multipla escolha|teste americano|simulacao(?: de exame| do exame| da prova| de prova)?|simular? (?:o |a )?(?:exame|prova)(?: escrit[ao])?)\b\s*(.*)$/, t))) {
    const r = pulisci(m[2] || ''); return { tipo: 'crocette', esame: r ? trovaEsame(r) : null, nomeDetto: r, simulazione: /simul/.test(semAcentos(m[1])) };
  }

  if (/^(?:os |as )?(?:meus |minhas )?(?:exames|provas|proximos exames|proximas provas|calendario(?: de exames| dos exames)?|epoca de exames|sessao de exames|datas dos exames)$|^quando (?:sao|e que sao) (?:os )?(?:meus )?exames$/.test(u)) return { tipo: 'esami' };
  if (/^(?:hoje|plano|(?:o )?plano (?:de hoje|para hoje|do dia)|(?:o )?(?:meu )?plano|o que (?:e que )?(?:estudo|devo estudar|tenho de estudar|tenho que estudar|faco) hoje|que estudo hoje)$/.test(u)) return { tipo: 'oggi' };

  // ricerca diretta: il nome di un esame da solo apre la sua scheda
  const e = trovaEsame(t);
  if (e && norm(e.nome).startsWith(norm(t)) && norm(t).length >= 3) return { tipo: 'apriEsame', esame: e };
  return null;
}

// giorni e ore di una frase («segunda e quarta das 9 às 11 sala 7», «2ª e 4ª 14h-16h»): resto è quello che avanza
const NUMERADOS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta'];
const DIA = /(?<=\s)(seg(?:unda)?|ter(?:[cç]a)?|qua(?:rta)?|qui(?:nta)?|sex(?:ta)?|s[aá]b(?:ado)?|dom(?:ingo)?)s?(?:[- ]feiras?)?(?=\s)/g;
export function giorniEOre(testo) {
  let b = ' ' + horas(String(testo).toLowerCase().normalize('NFC')).replace(/[,;]/g, ' ') + ' ';
  // «2ª», «4ª-feira», «2a feira»: i giorni detti col numero
  b = b.replace(/(\s)([2-6])(?:ª|a)?[- ]?feiras?(?=\s)|(\s)([2-6])ª(?=\s)/g, (x, s1, d1, s2, d2) => (s1 ?? s2) + NUMERADOS[+(d1 ?? d2) - 2]);
  b = b.replace(/(\s)(?:das|de|entre)\s+(?=\d)/g, '$1');
  const o = oreInCifre(b, 'às|as|até|ate|a|e');
  if (!o) return null;
  const giorni = [];
  const r = (' ' + b.replace(o.pezzo, ' ') + ' ').replace(/\s+/g, '  ').replace(DIA, (_, g) => { giorni.push(DIAS.findIndex(x => x.startsWith(semAcentos(g).slice(0, 3)))); return ' '; });
  return { giorni, inizio: o.inizio, fine: o.fine, resto: ' ' + r.replace(/[^a-z0-9à-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ' };
}
// le parole che restano intorno ai giorni e alle ore («às», «e», «todas as») e non sono il nome del corso
const RIEMPI = /^(?:e|a|à|às|as|o|os|ao|aos|de|da|do|das|dos|na|no|nas|nos|em|toda|todas|todos|cada|até|ate|pelas|feira|feiras)$/;
const ritaglia = s => { const p = s.trim().split(/\s+/).filter(Boolean); while (p.length && RIEMPI.test(p[0])) p.shift(); while (p.length && RIEMPI.test(p[p.length - 1])) p.pop(); return p.join(' '); };
// giorni, ore e sala di una lezione; quello che resta è il nome del corso
export function leggiOrario(testo) {
  const x = giorniEOre(testo);
  if (!x || !x.giorni.length) return null;
  let r = x.resto, aula = ''; r = r.replace(/ (?:n[ao] |em )?(?:sala|anfiteatro|anf|audit[oó]rio|laborat[oó]rio|lab) (\w+)/, (_, a) => { aula = a.length <= 3 ? a.toUpperCase() : a.charAt(0).toUpperCase() + a.slice(1); return ' '; });
  const corso = ritaglia(r);
  if (!corso) return null;
  const e = trovaEsame(corso);
  return { corso: e?.nome || corso.replace(/^./, c => c.toUpperCase()), giorni: x.giorni, inizio: x.inizio, fine: x.fine, aula };
}

// il lavoro (js/ore.js): «trabalho segunda quarta sexta 14-19», «os meus turnos são …», «quinta não trabalho», «no sábado
// também trabalho das 18 às 23», «nos dias de trabalho estudo no máximo 2 horas», «estudo das 10 às 22», «já não trabalho»
const GIORNO = `(hoje|amanha|depois de amanha|domingo|(?:segunda|terca|quarta|quinta|sexta)(?:-feira| feira)?|sabado)`;
function dataDetta(s) {
  const T = oggi(), k = ['hoje', 'amanha', 'depois de amanha'].indexOf(s); if (k >= 0) return piuGiorni(T, k);
  const dow = DIAS.indexOf(s.replace(/[- ]feira$/, '')); if (dow < 0) return null;
  return piuGiorni(T, (dow - new Date(T + 'T12:00').getDay() + 7) % 7);
}
const ORA = /(?:(?:das|de)\s+)?\d{1,2}(?:[:.]\d{2})?\s*(?:-|–|as|ate|a)\s*\d{1,2}(?:[:.]\d{2})?/g;
export function leggiLavoro(testo) {
  const t = horas(semAcentos(String(testo || '').toLowerCase().normalize('NFC'))).replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim();
  let m;
  if (/^(?:ja nao trabalho|nao trabalho mais|deixei de trabalhar|ja nao tenho trabalho|sem trabalho|sem turnos|chega de turnos|(?:tira|apaga|remove|limpa)(?: o)?(?: meu)? (?:trabalho|emprego)|(?:tira|apaga|remove)(?: os)?(?: meus)? turnos|larguei o (?:trabalho|emprego))$/.test(t)) return { tipo: 'lavoro', azione: 'togli' };
  if (/^(?:quando (?:e que )?trabalho|(?:os )?(?:meus )?turnos(?: de trabalho)?|(?:o )?meu trabalho|(?:o )?(?:meu )?horario de trabalho|(?:os )?(?:meus )?horarios de trabalho)$/.test(t)) return { tipo: 'lavoro', azione: 'vedi' };
  const NAO = '(?:eu )?nao (?:trabalho|vou trabalhar|estou a trabalhar|estou trabalhando|to trabalhando)';
  if ((m = t.match(new RegExp(`^(?:(?:esta|este|na|no|nesta|neste) )?${GIORNO},? ${NAO}$`))) || (m = t.match(new RegExp(`^${NAO} (?:(?:esta|este|na|no|nesta|neste) )?${GIORNO}$`)))) return { tipo: 'lavoro', azione: 'eccezione', data: dataDetta(m[1]), no: true };
  if ((m = t.match(/^(?:nos dias (?:de trabalho|em que trabalho|que trabalho)|quando trabalho),? (?:eu )?(?:estudo|so estudo|posso estudar|quero estudar) (?:no maximo |maximo |so |apenas |nao mais de |ate )?(.+)$/))) {
    const mi = leggiMinuti(m[1]); if (mi && /h|min/.test(mi.pezzo) && mi.min >= 15 && mi.min <= 600) return { tipo: 'lavoro', azione: 'tetto', min: mi.min };
  }
  if ((m = t.match(/^(?:normalmente |geralmente |eu )?estudo (?:das |entre as |entre |de )?(.+)$/))) {
    const h = m[1].replace(/ (?:e|a|ate) as (?=\d)/, ' e '), x = oreInCifre(h, 'as|ate|a|e'), o = x && x.pezzo.trim() === h.trim() && orarioOk(x.inizio, x.fine);
    if (o && o.fine !== '24:00') return { tipo: 'lavoro', azione: 'finestra', da: o.inizio, a: o.fine };
  }
  // um turno a mais só nesse dia: «no sábado também trabalho das 18 às 23», «esta semana trabalho também no sábado 18-23»
  if ((m = t.match(/^(?:esta semana,? )?(?:(.+?),? )?(?:eu )?(?:tambem trabalho|trabalho tambem|ainda trabalho|tenho (?:um )?turno extra)(?: (?:no|na|ao|a))? (.+)$/))) {
    const g = `${m[1] || ''} ${m[2]}`.match(new RegExp(`(?:^| )${GIORNO}(?= |$)`)), x = g && giorniEOre(m[2].replace(g[1], ' '));
    const o = x && orarioOk(x.inizio, x.fine);
    if (o) return { tipo: 'lavoro', azione: 'eccezione', data: dataDetta(g[1]), ...o };
  }
  // i turni di ogni settimana: «trabalho …» li aggiunge, «os meus turnos são …» li sostituisce. Quello che avanza (no bar)
  // va bene se è poco: «trabalho de grupo segunda 14-16 para o projeto» o «trabalho na tese segunda 9-13» non sono turni
  if ((m = t.match(/^(?:(os meus turnos sao|meus turnos sao|o meu turno e|meu turno e|agora trabalho|a partir de agora trabalho|daqui pra frente trabalho|so trabalho)|(?:eu )?trabalho|tenho turnos?|faco turnos?|turnos?)\s+(.+)$/))) {
    const pezzi = [];
    let da = 0; for (const o of m[2].matchAll(ORA)) { pezzi.push(m[2].slice(da, o.index + o[0].length)); da = o.index + o[0].length; }
    if (pezzi.length) pezzi[pezzi.length - 1] += m[2].slice(da);
    const xs = pezzi.map(giorniEOre), turni = xs.map(x => x && x.giorni.length && orarioOk(x.inizio, x.fine));
    const resto = xs.flatMap(x => x ? x.resto.trim().split(/\s+/).filter(w => w && !RIEMPI.test(w) && !/^(?:um|uma|como)$/.test(w)) : []);
    if (turni.length && turni.every(Boolean) && resto.length <= 2 && !xs.some(x => /grupo|equipa|equipe|projeto|tese|tcc|monografia|exerc|relatorio|laborat|trabalho/.test(x.resto))) {
      const tt = turni.map((o, i) => ({ giorni: [...new Set(xs[i].giorni)].sort(), ...o }));
      return { tipo: 'lavoro', azione: m[1] ? 'sostituisci' : 'aggiungi', ...tt[0], ...(tt.length > 1 ? { turni: tt } : {}) };
    }
  }
  return null;
}

// gli stessi esempi dell'italiano, nello stesso ordine (spiegazioni in portoghese del Brasile, come il catalogo pt: «você»,
// celular, anotações, prova; il riconoscitore capisce anche le forme del Portogallo)
// gli esempi della barra («Prova a scrivere»): {voto}, {obiettivo} e {simula} sono i voti del sistema scelto
// (riempiEsempi() di js/comandi/comune.js, esempi() di js/comandi.js)
export const ESEMPI = [
  ['foco 50 em cálculo 2', 'inicia o cronômetro e conta as horas'],
  ['tirei {voto} em física', 'registra a nota e atualiza a média'],
  ['prova de banco de dados dia 15 de janeiro 9 créditos', 'adiciona a data da prova'],
  ['quanto preciso para {obiettivo}', 'a média que você precisa daqui até o fim'],
  ['e se eu tirar {simula} em cálculo 2', 'simula a média'],
  ['programa de cálculo 2', 'cole a ementa: mapa dos temas e plano até a prova'],
  ['perguntas de prova de cálculo 2: …', 'as do grupo da disciplina: sobem no plano'],
  ['provas antigas de cálculo 2: …', 'os exercícios de uma prova antiga: um por dia, sobre os temas de hoje'],
  ['prova completa de cálculo 2', 'uma prova antiga inteira, com o tempo real: como foi, quem diz é você'],
  ['deixa eu explicar: teorema de Green', 'você explica um tema, o Lode diz o que ficou de fora'],
  ['quiz de cálculo 2', 'perguntas de múltipla escolha: treino, ou simulado cronometrado'],
  ['transcreve a videoaula de direito civil', 'do áudio do computador: para quem estuda em casa'],
  ['conecta o moodle', 'arquivos novos e prazos da plataforma da sua universidade'],
  ['agentes', 'conecta o Claude Code, o Codex, o Cursor…: o Lode diz o que eles fizeram de verdade nos seus projetos'],
  ['revisar cálculo 2', 'os cartões de hoje'],
  ['cartão: teorema de Green = …', 'um cartão rápido'],
  ['exporta para o anki', 'cartões e definições num arquivo para o Anki, um baralho por disciplina'],
  ['revisão de bolso', 'os cartões de amanhã numa nota, para fazer no celular com o Obsidian'],
  ['aula cálculo 2 segunda e quarta 9-11 sala 7', 'o horário: o Lode sabe quando você está em aula'],
  ['trabalho segunda quarta sexta 14-19', 'os turnos: o plano só usa as horas livres de verdade, com meia hora para o trajeto'],
  ['plano da semana', 'todas as provas num só calendário, minuto a minuto: o que cabe e o que não cabe'],
  ['★ o teorema de Green sempre cai', 'em aula: marca o que cai na prova'],
  ['def: gradiente = vetor das derivadas parciais', 'em aula: uma definição na nota'],
  ['jogar', 'dois minutos sobre as definições da última aula'],
  ['transcreve a aula', 'em aula: a aula inteira em anotações, fórmulas incluídas, salva no Obsidian'],
  ['organiza a aula', 'da transcrição a anotações limpas (IA)'],
  ['repete', 'em aula: o que o professor disse nos últimos 60 segundos'],
  ['IA', 'conecta a sua IA preferida (Claude, ChatGPT, Gemini, Mistral…): você paga o que usar'],
  ['compartilha a transcrição', 'a aula para os colegas: AirDrop, WhatsApp, e-mail'],
  ['fecha a aula', 'definições e ★ tiradas das anotações (IA)'],
  ['abre o glossário', 'vai para uma página do vault'],
  ['me faz perguntas sobre banco de dados', 'simula a prova oral (com IA)'],
  ['o que imprime', 'exercícios de C: a resposta é calculada pelo Lode, não por uma IA'],
  ['o que imprime em python', 'os mesmos exercícios em Python (ou em Java: «o que imprime em java»)'],
  ['segue o projeto', 'acompanha a pasta do laboratório: o que muda e se você testou'],
  ['testa o projeto', 'compila e roda os testes .in/.out, depois que você confirmar'],
  ['explica o erro', 'copie o erro do terminal: eu explico em português, um passo de cada vez'],
  ['diário do projeto', 'abre no Obsidian o diário de hoje'],
  ['para de seguir', 'o Lode para de acompanhar a pasta e apaga as cópias dele'],
  ['sincroniza entre computadores', 'o mesmo Lode em dois ou três computadores, com a pasta na nuvem que você já tem'],
];

// as palavrinhas dentro dos cartões (js/comandi/comune.js, detto()): confirmar, cancelar, terminar a prova oral
export const PAROLE = {
  si: ['sim', 'ok', 'okay', 'beleza', 'claro', 'confirma', 'confirmo', 'pode', 'pode ser', 'vai', 'manda', 'faz', 'faça', 'faca', 'perfeito', 'exato', 'certo', 'isso', 'combinado', 'fechou', 'bora', 'salva', 'salvar'],
  siCoda: ['por favor'],
  no: ['não', 'nao', 'cancela', 'cancelar', 'deixa', 'deixa pra lá', 'deixa pra la', 'espera', 'para', 'nada', 'melhor não', 'melhor nao', 'agora não', 'agora nao'],
  voto: ['chega', 'nota', 'me dá a nota', 'me da a nota', 'minha nota', 'terminei', 'acabei'],
  basta: ['sair', 'sai', 'cancela', 'chega', 'deixa pra lá', 'deixa pra la'],
  esci: ['sair', 'sai', 'fechar', 'fecha', 'fecha a prova oral', 'fim da prova oral', 'encerrar', 'encerra'],
};
