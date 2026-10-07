// Il riconoscitore francese (smistato da js/comandi.js): le frasi che scriverebbe davvero uno studente in Francia, Belgio,
// Svizzera o Québec, anche di fretta e senza accenti: «focus 50 sur analyse 2», «j'ai eu 15 en physique», «examen bdd le 15
// janvier 6 ects», «il me faut combien pour 14 de moyenne», «révise analyse 2», «carte : théorème de Green = …»,
// «explique-moi l'erreur», «suis le projet», «langue anglais».
// Restituisce gli stessi oggetti { tipo, … } del riconoscitore italiano (js/comandi/it.js), campo per campo: il resto della
// barra non sa in che lingua è arrivata la frase. Se la frase non è un comando ritorna null: comandi.js prova poi l'inglese,
// e se non è un comando nemmeno lì ci pensa l'AI.
// Gli accenti: le regole sono scritte senza («revise», «a l'examen», «deverrouille») e si provano sulla frase senza accenti
// (piano()); i pezzi presi dalla frase (il nome dell'esame, il testo di una carta) restano come li ha scritti lo studente.
// I voti restano quelli detti: 0-20 alla francese (anche «15/20», «14,5») o 18-30 e lode per chi studia in Italia. Come
// leggerli lo decide il sistema dei voti (js/sistemi.js), non qui. Lo stesso per «quanto mi serve»: 66-110 (base di laurea
// italiana), oppure una media su 20 o una «mention» (assez bien 12, bien 14, très bien 16).
// I numeri detti a voce («vingt-huit», «quatre-vingt-dix», «septante») diventano cifre solo qui dentro: numeri non si
// esporta, perché le formule dettate (js/formule.js) valgono solo in italiano e in inglese (docs/LINGUE.md).
import { norm, oggi, piuGiorni, trovaEsame } from '../dati.js';
import { sembraErrore, dataInCifre, conAnno, orarioOk, oreInCifre, linguaDetta } from './comune.js';

const GIORNI = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MESI = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
// i nomi delle lingue detti in francese (quelli nella loro lingua li conosce comune.js)
const LINGUE_FR = { italien: 'it', anglais: 'en', espagnol: 'es', francais: 'fr', allemand: 'de', portugais: 'pt' };

// le lettere accentate diventano quelle semplici, una per una: la lunghezza non cambia, così una posizione trovata nella
// frase senza accenti vale anche nella frase vera
const piano = s => String(s).replace(/[À-ÖØ-öø-ÿ]/g, c => c.normalize('NFD')[0]);
// la regola re provata sulla frase senza accenti; i gruppi tornano presi dalla frase vera, con i suoi accenti
function cerca(re, s) {
  const m = new RegExp(re.source, re.flags.replace('g', '') + 'd').exec(piano(s)); if (!m) return null;
  const r = m.map((x, i) => (x == null ? x : s.slice(m.indices[i][0], m.indices[i][1]))); r.index = m.index;
  return r;
}

// i numeri detti a voce: «vingt-huit» → 28, «cinquante» → 50, «cent dix» → 110, «quatre-vingt-dix» → 90, e quelli belgi e
// svizzeri («septante», «huitante», «nonante»)
const VAL = { zero: 0, 'zéro': 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, septante: 70, huitante: 80, octante: 80, nonante: 90, cent: 100, cents: 100 };
const MOTI = Object.keys(VAL).sort((a, b) => b.length - a.length).join('|');
const NUMERO = new RegExp(`\\b(?:${MOTI})(?:(?:[ -]et[ -](?:un|une|onze))|(?:[ -](?:${MOTI})))*\\b`, 'gi');
function valore(s) {
  let v = 0, prima = null;
  for (const w of piano(s).toLowerCase().split(/[\s-]+/)) {
    if (w === 'et') continue;
    if (/^cents?$/.test(w)) v = (v || 1) * 100;
    else if (/^vingts?$/.test(w) && prima === 'quatre') v += 76;   // quatre-vingt: il 4 già contato diventa 80
    else v += VAL[w] ?? 0;
    prima = w;
  }
  return v;
}
// «un» e «une» da soli sono articoli («un examen», «une heure»); «neuf» è anche «nuovo» («quoi de neuf», «tout neuf»); «sept»
// dopo un numero è settembre («15 sept»)
const numeriDetti = t => String(t).replace(NUMERO, (w, i, tutto) => {
  const b = piano(w).toLowerCase(), prima = tutto.slice(0, i);
  if (/^une?$/.test(b)) return w;
  if (b === 'neuf' && /\b(?:de|du|tout|rien|quoi)\s$/i.test(prima)) return w;
  if (b === 'sept' && /\d\s$/.test(prima)) return w;
  return String(valore(w));
});
const NUM = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12, quinze: 15, vingt: 20, trente: 30 };
const n = s => (s in NUM ? NUM[s] : Number(s));

export function leggiData(testo) {
  const t = ' ' + norm(testo) + ' ', T = oggi();
  let m;
  if ((m = t.match(/ (apres demain) /))) return { data: piuGiorni(T, 2), pezzo: m[1] };
  if (/ demain /.test(t)) return { data: piuGiorni(T, 1), pezzo: 'demain' };
  if ((m = t.match(/ (aujourd ?hui|auj) /))) return { data: T, pezzo: m[1] };
  if ((m = t.match(/ dans (\d+|\w+) (jours?|semaines?|mois) /))) {
    const k = n(m[1]); if (k) return { data: piuGiorni(T, k * (m[2].startsWith('sem') ? 7 : m[2] === 'mois' ? 30 : 1)), pezzo: m[0].trim() };
  }
  { const c = dataInCifre(t, testo); if (c) return c; }
  // i mesi interi o abbreviati («janv», «sept»), mai l'inizio di un'altra parola («marseille», «octet»)
  const mesi = '(janv(?:ier)?|fevr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|aout|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|dec(?:embre)?)';
  if ((m = t.match(new RegExp(` (?:le )?(\\d{1,2}|1er|premier) ${mesi} (?:(\\d{4}) )?`)))) {
    const g = /^(?:1er|premier)$/.test(m[1]) ? 1 : +m[1], me = MESI.findIndex(x => x.startsWith(m[2]));
    return { data: conAnno(g, me, m[3] ? +m[3] : null), pezzo: m[0].trim() };
  }
  if ((m = t.match(new RegExp(` (?:(?:ce|le) )?(${GIORNI.join('|')})(?: prochain)? `)))) {
    const dow = GIORNI.indexOf(m[1]), d = new Date(T + 'T12:00'); const k = (dow - d.getDay() + 7) % 7 || 7;
    return { data: piuGiorni(T, k), pezzo: m[0].trim() };
  }
  return null;
}

// il nome detto, senza gli articoli e le preposizioni intorno: «d'analyse 2» → «analyse 2», «sur les bases de données» →
// «bases de données», «au partiel de physique» → «physique»
function pulisci(s) {
  let r = String(s || '').trim();
  for (let i = 0; i < 3; i++) r = r.replace(/^(?:(?:de la|de l'|du|des|de|sur|en|pour|au|aux|dans|avec|pendant|les|le|la|mon|ma|mes|à|a)\s+|(?:d'|l')\s*|(?:l')?(?:examen|exam|partiel|ds|ue|module|cours|matiere|matière)s?\s+(?:de\s+|d'|du\s+|en\s+))/i, '');
  return r.replace(/[?.!,;:]+$/, '').replace(/\s+(?:de|du|des|sur|en|pour|à|a|au|avec|le|la|les|pendant|et)\s*$/i, '').trim().replace(/^(?:de|du|des|sur|en|pour|à|a|au|avec|le|la|les|l'|d')$/i, '');
}

// minuti detti a parole: «50», «50 min», «une heure», «une demi-heure», «une heure et demie», «2 heures», «1h30», «90 mn»
function leggiMinuti(t) {
  let m;
  if ((m = cerca(/(?:une )?demi[- ]heure/, t)) && !/heure et demie/.test(piano(t))) return { min: 30, pezzo: m[0] };
  if ((m = cerca(/(?:^|\s)(\d{1,2})\s*h\s*(\d{2})\b/, t))) return { min: +m[1] * 60 + +m[2], pezzo: m[0].trim() };
  if ((m = cerca(/(?:^|\s)(\d+|une|un|deux|trois)\s*(?:heures?|h)\b(\s*et demie?)?/, t))) return { min: n(m[1]) * 60 + (m[2] ? 30 : 0), pezzo: m[0].trim() };
  if ((m = cerca(/(?:^|\s)(\d+)\s*(?:minutes?|mins?|mn|m)\b/, t))) return { min: +m[1], pezzo: m[0].trim() };
  // un numero da solo: all'inizio («focus 50 sur …», «de 25 sur …») o in fondo («bosse physique pendant 50»), non il «2» di
  // «analyse 2»
  if ((m = cerca(/^\s*(?:de |pendant )?(\d{1,3})(?=\s|$)/, t)) || (m = cerca(/\b(?:pendant|de) (\d{1,3})$/, t))) return { min: +m[1], pezzo: m[0].trim() };
  return null;
}

// i comandi di «Segui il progetto» (in italiano stanno in js/codice/progetto.js): stessi oggetti { tipo: 'progetto', azione, nome? }
const PROGETTO = [
  [/^(?:suis|suivre|surveille|surveiller)(?: (?:le|un|ce|mon|un nouveau))? projet$/, () => ({ azione: 'segui' })],
  [/^(?:qu'est-ce qui a change|qu'est ce qui a change|qu'est-ce qui a bouge|quoi de change|ce qui a change|ca a change|qu'est-ce qui change)(?: (?:dans|sur|en) (.+))?$/, m => ({ azione: 'cambiato', nome: m[1] })],
  [/^(?:montre(?:-moi)? |voir )?(?:les )?(?:changements|modifs|modifications)(?: (?:dans|de|du|sur) (.+))?$/, m => ({ azione: 'cambiato', nome: m[1] })],
  [/^(?:(?:j'ai|on a|t'as|tu as) )?teste$|^(?:c'est |c'est bien |il est )teste$/, () => ({ azione: 'provato' })],
  [/^(?:teste|tester|lance|lancer|verifie|verifier|execute|executer) (?:le |mon |les )?(?:projet|code|programme|tests)(?: (?:du projet |de |du )?(.+))?$/, m => ({ azione: 'prova', nome: m[1] })],
  [/^(?:compile|compiler)(?: (?:le |mon )?(?:projet|code|programme)(?: (.+))?)?$/, m => ({ azione: 'prova', nome: m[1] })],
  [/^(?:arrete|arreter|j'arrete|stop) de (?:suivre|surveiller)(?: (?:le )?(?:projet )?(.+))?$/, m => ({ azione: 'smetti', nome: m[1] })],
  [/^ne (?:suis|surveille) plus(?: (?:le )?(?:projet )?(.+))?$/, m => ({ azione: 'smetti', nome: m[1] })],
  [/^(?:prepare-moi|prepare moi|aide-moi a me preparer) (?:a|pour) (?:la |ma )?(?:discussion|soutenance|presentation|defense)(?: (?:de|du|pour|sur) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:je suis )?prete? pour (?:la )?(?:discussion|soutenance)(?: (?:de|du) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:les )?fonctions a expliquer(?: (?:dans|de|du|pour) (.+))?$/, m => perDiscussione(m[1])],
  [/^(?:discussion|soutenance)$/, () => ({ azione: 'discussione' })],
  [/^(?:discussion|soutenance) (?:de|du|pour|sur) (.+)$/, m => perDiscussione(m[1])],
];
// come in progetto.js: senza nome il progetto più recente, con un nome solo se ha l'aria di un laboratorio («lab3», «tp2»,
// un numero). «soutenance de mémoire» resta all'AI
const perDiscussione = nome => (!nome ? { azione: 'discussione' } : /\d|\blab|\btp|proj/.test(nome) ? { azione: 'discussione', nome } : null);
function interpretaProgetto(testo) {
  const t = piano(String(testo || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim());
  for (const [re, f] of PROGETTO) {
    const m = re.exec(t); if (!m) continue;
    const r = f(m); if (!r) continue;
    const c = { tipo: 'progetto', ...r }, nome = c.nome?.replace(/^(?:le |mon |du |de )?(?:projet|code|programme)\b\s*/, '').trim();
    if (nome) c.nome = nome; else delete c.nome;
    return c;
  }
  return null;
}

export function interpreta(frase) {
  const grezzo0 = String(frase || '').trim().replace(/[’`]/g, "'"); if (!grezzo0) return null;
  // informatica: «explique-moi l'erreur», anche con l'errore incollato dopo. Solo se dopo «erreur» non c'è niente, ci sono i
  // due punti o un a capo, o c'è davvero un errore del compilatore: «explique-moi l'erreur relative» resta all'AI
  let e0;
  if ((e0 = cerca(/^(?:explique(?:-moi| moi|-nous)?|expliques?-moi|c'est quoi|c quoi|que veut dire|qu'est-ce que veut dire|aide-moi (?:avec|sur)) (?:l'|l |cette |cet |ce |mon |la )?(?:message d')?erreur\b([\s\S]*)$/i, grezzo0))) {
    const dopo = e0[1].replace(/^[ \t]+/, ''), testo = dopo.replace(/^:/, '').trim();
    const solo = !testo || /^[?.!]+$/.test(testo) || /^(?:du compilateur|de compilation|du programme|que j'ai copiee?|copiee?|(?:ca )?veut dire quoi|stp|svp)\s*[?.!]*$/i.test(piano(testo));
    if (solo) return { tipo: 'errore', testo: null };
    if (/^[:\n]/.test(dopo) || sembraErrore(testo)) return { tipo: 'errore', testo };
  }
  const pr = interpretaProgetto(grezzo0); if (pr) return pr;
  // la voce aggiunge maiuscole e un punto finale; i numeri arrivano a parole; «stp», «svp», «s'il te plaît» non contano
  const grezzo = numeriDetti(grezzo0.replace(/[.!]+$/, ''));
  const t = grezzo.toLowerCase().replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim().replace(/^(?:stp|svp|s'il te pla[iî]t|s'il vous pla[iî]t),? |,? (?:stp|svp|s'il te pla[iî]t|s'il vous pla[iî]t)$/g, '').trim();
  const p = piano(t);
  let m;

  // la lingua della barra: «langue anglais», «passe en allemand», «change la langue en espagnol», «langue : español»
  if ((m = cerca(/^(?:(?:change|changer|mets|mettre|met|passe|passer|bascule|basculer)(?: (?:la langue|de langue|l'app|l'appli|l'application|lode|tout|la barre))?(?: (?:en|au|a la|vers le|vers la|vers))?|(?:la )?langue\s*:?(?: en)?|(?:parle|parle-moi|reponds|reponds-moi|ecris|ecris-moi)(?: en)?|en) (?:a l'|vers l'|l')?(\S+)$/, t)) && linguaDetta(m[1], LINGUE_FR)) return { tipo: 'lingua', codice: linguaDetta(m[1], LINGUE_FR) };
  if (/^(?:aide|aide-moi|aidez-moi|\?|a l'aide|qu'est-ce que tu sais faire|qu'est ce que tu sais faire|tu sais faire quoi|tu fais quoi|que sais-tu faire|qu'est-ce que je peux (?:dire|ecrire|demander)|je peux dire quoi|commandes|les commandes|liste des commandes)$/.test(p)) return { tipo: 'aiuto' };
  if (/^(?:stop|stoppe|arrete|arreter|j'arrete|on arrete|termine|terminer|fin|ca suffit)(?: (?:le |la |l'|mon |ma )?(?:focus|timer|minuteur|chrono|pomodoro|session|revision))?$/.test(p)) return { tipo: 'ferma' };
  if (/^(?:pause|mets en pause|met en pause|mettre en pause|pause (?:le )?(?:timer|minuteur|chrono)|mets (?:le )?(?:timer|minuteur|chrono) en pause|attends)$/.test(p)) return { tipo: 'sospendi' };
  if (/^(?:reprends|reprendre|reprise|continue|continuer|on continue|on reprend|c'est reparti|relance|(?:reprends|relance) (?:le )?(?:timer|minuteur|chrono))$/.test(p)) return { tipo: 'riprendi' };
  // Anki: «exporte vers anki», «anki», «exporte mes cartes d'analyse 2 vers anki», «anki physique 2». Serve un verbo o la frase
  // che comincia da «anki» o dalle carte: «anki comment ça marche», «télécharger anki», «comment j'importe dans anki» restano all'AI
  if (/\banki\b/.test(p) && (m = cerca(/^(?:(?:exporte|exporter|exporte-moi|envoie|envoyer|mets|mettre|sauvegarde|prepare|cree|creer|fais|telecharge|telecharger)\b\s*)?(.*)$/, t)) && (m[0] !== m[1] || /^(?:anki\b|(?:toutes )?(?:les |mes )?(?:cartes|flashcards|decks?|paquets?|definitions)\b)/.test(piano(m[1])))) {
    const r = pulisci(m[1].replace(/(?:\b(?:vers|pour|dans|sur|en) )?\banki\b/i, ' ').replace(/(?:\btoutes )?(?:\b(?:les|mes) )?(?:\bnouvelles )?\b(?:cartes|flashcards|decks?|paquets?|d[ée]finitions)\b/i, ' ').trim().replace(/\s+/g, ' '));
    // «anki <qualcosa>» senza verbo è un comando solo se <qualcosa> è un esame: «anki physique 2» sì, «anki comment ça
    // marche» no
    const domanda = m[0] === m[1] && r && (/\?\s*$/.test(grezzo0) || /^(?:comment|quoi|pourquoi|ou|quand|est-ce|c'est|ca|marche|fonctionne|vs|pas)(?=[\s']|$)/.test(piano(r)) || !trovaEsame(r));
    const programma = /^telecharger?\b/.test(p) && /^anki$/.test(m[1].trim());
    if (!domanda && !programma) return { tipo: 'anki', corso: r && !/^(?:tout|tous|toutes|tous les cours|tout le monde)$/.test(piano(r)) ? r : null };
  }
  // «révisions de poche» (Ripasso in tasca, js/tasca.js): le carte di domani in una nota, da fare sul telefono con Obsidian
  const POCHE = '(?:la |les |mes |ma )?(?:revisions? de poche|revisions? dans la poche|cartes de poche|(?:revisions?|cartes) (?:sur|dans) (?:le|mon) (?:telephone|tel|portable))';
  if (new RegExp(`^(?:desactive|desactiver|eteins|coupe|arrete|stop|plus de|pas de|ne fais plus)(?: la| les)? ${POCHE}(?: (?:tous les|chaque) soirs?)?$`).test(p)) return { tipo: 'tasca', sera: false };
  if ((m = p.match(new RegExp(`^(?:(?:fais|fais-moi|prepare|prepare-moi|mets|mets-moi|envoie|envoie-moi|ecris|mets a jour|donne-moi) )?${POCHE}( (?:tous les|chaque) soirs?| seulement quand je (?:le )?demande| quand je (?:le )?demande)?$`)))) return m[1] ? { tipo: 'tasca', sera: !/demande/.test(m[1]) } : { tipo: 'tasca' };

  // il programma d'esame: «programme d'analyse 2», «programme», «programme analyse 2 : 1. limites …» (incollato, anche su più
  // righe). «programme de la semaine» e «programme du jour» sono il piano
  if ((m = cerca(/^(?:(?:ouvre|montre(?:-moi)?|voici|voila|colle) )?(?:le |mon )?(?:programme|syllabus|plan de cours)(?: (?:de l'examen|du cours|d'examen))?(?:\s+(?:de|du|des|en|pour)\b|\s*d')?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i, grezzo0)) || (m = cerca(/^(?:(?:voici|voila|colle) )?(?:le )?([^:\n]+?) (?:programme|syllabus)\s*[:\n]([\s\S]*)$/i, grezzo0))) {
    const nome = pulisci(numeriDetti(m[1]).toLowerCase());
    if (!/^(?:jour|aujourd'hui|demain|(?:la |cette )?semaine|c|java|python)$/.test(piano(nome))) return { tipo: 'programma', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  // «je t'explique : green», «laisse-moi t'expliquer les séries entières»: lo studente spiega, Lode controlla cosa ha detto
  if ((m = cerca(/^(?:je (?:te |vous )?l'explique|je t'explique|je vous explique|laisse-moi (?:t')?expliquer|laisse moi (?:t')?expliquer|je vais (?:te |vous )?(?:l')?expliquer|je vais t'expliquer|j'explique|c'est moi qui explique)\b(?: moi-meme)?\s*:?\s*(.*)$/, t))) return { tipo: 'spiego', q: pulisci(m[1] || '') };
  // le domande uscite agli appelli: «questions tombées en analyse 2 : …» (una per riga)
  if ((m = cerca(/^(?:(?:voici|colle|ajoute) )?(?:les )?(?:questions (?:d'examen|d'exam|tombees(?: a l'examen| a l'exam| aux examens| aux partiels)?|des (?:anciens|derniers) (?:examens|partiels)|posees a l'(?:examen|oral)|de l'oral)|questions d'annales)(?:\s+(?:de|du|des|en|pour)\b|\s*d')?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i, grezzo0))) {
    const nome = pulisci(numeriDetti(m[1]).toLowerCase()); return { tipo: 'domande', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  // i temi d'esame (js/temi.js): «annales d'analyse 2 : Exercice 1 …», «anciens sujets de physique 2»; «exercice d'analyse
  // 2», «donne-moi un exo» = l'esercizio di oggi. «exercices en C», «exos en python» restano a «Qu'est-ce que ça affiche ?»
  if ((m = cerca(/^(?:(?:voici|colle|ajoute|ouvre|montre(?:-moi)?) )?(?:les |des |mes )?(?:annales|anciens sujets|vieux sujets|sujets d'examen|sujets d'exam|anciens examens|anciens partiels|vieux partiels|exercices d'examen|sujets de partiel)(?:\s+(?:de|du|des|en|pour)\b|\s*d')?\s*([^:\n]*?)\s*(?:[:\n]([\s\S]*))?$/i, grezzo0))) {
    const nome = pulisci(numeriDetti(m[1]).toLowerCase()); return { tipo: 'temi', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: (m[2] || '').trim() };
  }
  if ((m = cerca(/^(?:(?:donne-moi|donne moi|file-moi|fais-moi faire|je veux faire|je fais|on fait|fais) )?(?:un |l'|mon |le )?(?:exercices?|exos?)(?: du jour| d'aujourd'hui| d'examen)?(?:(?:\s+(?:de|du|des|en|sur|pour)\b|\s*d')\s*(.+))?$/, t))) {
    const nome = pulisci(m[1] || '');
    if (!/^(?:c|c\+\+|java|python|programmation|prog)$/.test(nome)) return { tipo: 'temi', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome, testo: '' };
  }
  // la prova generale (js/prova.js): un vecchio compito intero col tempo vero. «examen blanc d'analyse 2», «partiel blanc»
  if ((m = cerca(/^(?:(?:fais-moi faire|je veux faire|on fait|je fais|fais|lance|commence|ouvre|demarre) )?(?:un |une |l'|le |mon )?(?:examen blanc|exam blanc|partiel blanc|ds blanc|concours blanc|sujet complet|annale complete|examen complet|epreuve complete)(?:(?:\s+(?:de|du|des|en|pour)\b|\s*d')\s*(.*))?$/, t))) {
    const nome = pulisci(m[1] || ''); return { tipo: 'prova', esame: nome ? trovaEsame(nome) : null, nomeDetto: nome };
  }

  // en cours: ★ da esame, definizione, domanda per il prof
  if ((m = cerca(/^(?:★|\*{1,2}|!|exam(?:en)?\s*:|important\s*:|(?:pour |a )l'exam(?:en)?\s*:|(?:ca )?tombe(?:ra)? a l'exam(?:en)?\s*:?|etoile\s*:)\s*(.+)$/i, grezzo))) return { tipo: 'stella', testo: m[1].trim() };
  if ((m = cerca(/^(?:definition|definis|definir|def\b)\s*:?\s*(.+?)\s*(?:::|:|=|→|—|-{1,2}>|\begale?\b|\bveut dire\b|\bsignifie\b|\bc'est\b)\s*(.+)$/i, grezzo))) return { tipo: 'definizione', termine: m[1].replace(/\*\*/g, '').trim(), testo: m[2].trim() };
  if ((m = cerca(/^(?:\?|question\s*:|question (?:pour|au|a la) (?:le |la )?(?:prof(?:esseur)?e?|enseignante?|charge de td)\s*:?|demande (?:au|a la) (?:prof(?:esseur)?e?|enseignante?)\s*:?)\s*(.+)$/i, grezzo))) return { tipo: 'domanda', testo: m[1].trim() };

  // l'orario: «cours analyse 2 lundi et mercredi 9h-11h salle 7», «TD de droit privé mardi de 10h à 12h»
  if ((m = cerca(/^(?:ajoute |nouveau |j'ai )?(?:un |le |les |des )?(?:cours|cm|td|tp|lecon)s?\s+(?:de |d'|du |des |en )?(.+)$/, t))) {
    const o = leggiOrario(m[1]); if (o) return { tipo: 'orario', ...o };
  }
  if (/^(?:(?:mon |l'|mes )?(?:emploi du temps|edt|horaires de cours|planning des cours)|mes cours|quand (?:est-ce que )?j'ai cours|j'ai cours quand|c'est quoi mon edt|quel cours j'ai|j'ai quel cours|j'ai quoi comme cours)$/.test(p)) return { tipo: 'vediOrario' };
  { const l = leggiLavoro(t); if (l) return l; }
  if (/^(?:le |mon |ma )?(?:planning|plan|programme|organisation) (?:de la|de ma|pour la|de cette) semaine$|^(?:ma semaine|mon temps libre|temps libre|mes heures libres|heures libres|mes creneaux libres|combien de temps (?:j'ai|il me reste)(?: pour (?:reviser|etudier|bosser))?)$/.test(p)) return { tipo: 'ore' };
  // «Qu'est-ce que ça affiche ?»: esercizi di C (anche in Java e in Python) con la risposta calcolata da Lode
  const AFF = "(?:(?:qu'est-ce que|qu'est ce que|que) (?:ca|ce code|ce programme) (?:affiche|imprime)|(?:ca|ce code) (?:affiche|imprime) quoi)";
  if (new RegExp(`^${AFF}$|^(?:exercices?|exos?) (?:en |de )?(?:c|prog|programmation)$|^entraine-moi (?:en|sur(?: le)?) c$`).test(p)) return { tipo: 'stampa' };
  if ((m = p.match(new RegExp(`^(?:${AFF}(?: en)?|(?:exercices?|exos?) (?:en|de)|entraine-moi (?:en|sur)) (c|java|python)$`)))) return { tipo: 'stampa', lingua: m[1] };
  if ((m = cerca(/^(?:joue|jouer|jouons|on joue|jeu|mini-jeu|minijeu|mini jeu|memory|entraine-moi|entraine moi|entrainement|teste-moi sur les definitions)\b\s*(.*)$/, t))) {
    const r = pulisci(m[1] || ''); return { tipo: 'gioco', corso: r || null };
  }
  // «mes notes» da solo sono i voti (il libretto, più sotto); gli appunti sono «notes», «ouvre mes notes», «notes du jour»
  if (/^(?:ouvre |ouvrir )?(?:mes |les )?(?:notes|obsidian|vault|coffre|notes de cours|note du jour|prise de notes)(?: du jour| d'aujourd'hui| du cours)?$/.test(p) && p !== 'mes notes') return { tipo: 'appunti' };
  // «transcris la visio»: il cours a distanza (Teams, Zoom, la piattaforma) trascritto dall'audio del computer
  if ((m = cerca(/^(?:(?:transcris|transcrire|enregistre|enregistrer|ecoute|ecouter)(?: (?:la|le|cette|ce|une|un))? (?:visio|visioconference|video|cours en ligne|cours en visio|cours enregistre|son de l'(?:ordi|ordinateur)|audio de l'(?:ordi|ordinateur)|cours (?:depuis|sur) (?:l'ordi|l'ordinateur|le pc|le mac|le navigateur))|(?:le )?cours (?:depuis|sur) (?:l'ordi|l'ordinateur|le pc|le mac)|ecoute l'(?:ordi|ordinateur))\b\s*(?:de |d'|du |en |sur |pour )?(.*)$/, t))) return { tipo: 'trascrivi', sorgente: 'computer', corso: pulisci(m[1] || '') || null };
  if (/^(?:transcris|transcrire|transcription)$|^(?:transcris|transcrire|enregistre|enregistrer)(?: (?:le|la|ce|tout le))? (?:cours|amphi|td|cm)\b|^(?:lance|lancer|demarre|demarrer|commence|commencer)(?: la| le| l')? ?(?:transcription|enregistrement)/.test(p)) return { tipo: 'trascrivi' };
  if (/^(?:repete|repete ca|tu peux repeter|redis|redis-moi|repete les \d+ dernieres secondes|repete ce qu'(?:il|elle) a dit|qu'est-ce qu'(?:il|elle) a dit|qu'est ce qu'(?:il|elle) a dit|(?:il|elle) a dit quoi|(?:le|la) prof a dit quoi|qu'a dit (?:le|la) prof|qu'est-ce que (?:le|la) prof a dit|j'ai (?:rate|loupe) (?:ca|quelque chose|une phrase))$/.test(p)) { const sec = +(p.match(/(\d+) dernieres secondes/)?.[1] || 60); return { tipo: 'ripeti', sec: Math.min(90, sec) }; }
  if (/^(?:desactive|desactiver|eteins|coupe|arrete|stop)(?: le| la)? (?:repete|repetition)$/.test(p)) return { tipo: 'spegniRipeti' };
  if ((m = p.match(/^(?:suggestions|propositions|conseils)\s+(jamais|aucune|off|desactivees|rares|peu|normales|normal|frequentes|souvent|beaucoup)$|^(?:desactive|desactiver|coupe|eteins|stop|plus de|arrete)(?: les)? (?:suggestions|propositions)$/))) return { tipo: 'proposte', livello: !m[1] || /jamais|aucune|off|desact/.test(m[1]) ? 'mai' : /rares|peu/.test(m[1]) ? 'poco' : /frequentes|souvent|beaucoup/.test(m[1]) ? 'spesso' : 'normale' };
  if (/^(?:propose-moi|propose moi|propose|suggere-moi|donne-moi) (?:quelque chose|qqch|une revision|un jeu|un truc)|^(?:je fais quoi|qu'est-ce que je fais|qu'est ce que je fais|on fait quoi)(?: maintenant| la)?$|^(?:je revise quoi|qu'est-ce que je revise|qu'est ce que je revise)$/.test(p)) return { tipo: 'proponi' };
  if (/^(?:partage|partager|envoie|envoyer|passe)(?: la| le| les| mes| ma| mon)? (?:transcription|retranscription|cours|notes)\b/.test(p)) {
    const i = p.match(/^.*?(?:transcription|cours|notes)\s*/)[0].length;
    const r = pulisci(t.slice(i).replace(/^(?:aux|a mes|à mes|avec mes|avec les|a la|à la|au) (?:potes|camarades|copains|copines|amis|collegues|collègues|promo|groupe)\s*/, ''));
    return { tipo: 'condividi', corso: r || null };
  }
  if (/^(?:arrete|arreter|stoppe|stop|termine|fin de|fin)(?: la| l'| le)? ?(?:transcription|enregistrement)|^(?:le )?cours (?:est |c'est )?(?:fini|termine)$|^c'est fini le cours$|^fin (?:du|de) cours$/.test(p)) return { tipo: 'fineTrascrizione' };
  if (/^(?:pause|mets en pause|met en pause)(?: la| l'| le)? ?(?:transcription|enregistrement)|^mets (?:la transcription|l'enregistrement) en pause$/.test(p)) return { tipo: 'pausaTrascrizione' };
  if (/^(?:reprends|reprendre|relance|relancer|continue|continuer)(?: la| l'| le)? ?(?:transcription|enregistrement)/.test(p)) return { tipo: 'riprendiTrascrizione' };
  if (/^(?:mets au propre|met au propre|remets au propre|range|ranger|nettoie|nettoyer|reorganise|reorganiser)(?: la| le| les| mes| mon| ma| l')? ?(?:cours|notes|transcription|retranscription)\b/.test(p)) {
    const i = p.match(/^.*?(?:cours|notes|transcription)\s*/)[0].length; const r = pulisci(t.slice(i)); return { tipo: 'riordina', corso: r || null };
  }
  if (/^(?:ferme|fermer|cloture|cloturer|boucle|boucler)(?: le| la)? (?:cours|lecon)\b|^(?:extrais|extraire)(?: les)? definitions/.test(p)) {
    const i = p.match(/^.*?(?:cours|lecon|definitions)\s*/)[0].length; const r = pulisci(t.slice(i)); return { tipo: 'chiudiLezione', corso: r || null };
  }
  // la tua AI: «IA», «connecte chatgpt», «utilise gemini», «ma clé»
  { const FORN = { claude: 'anthropic', anthropic: 'anthropic', chatgpt: 'openai', openai: 'openai', gpt: 'openai', gemini: 'google', google: 'google', mistral: 'mistral', groq: 'groq', openrouter: 'openrouter', deepseek: 'deepseek' };
    const m = p.match(/^(?:mon ia|ia|l'ia|ai|intelligence artificielle|(?:ma |la )?cle(?: api)?|api key|(?:connecte|connecter|utilise|utiliser|ajoute|branche)(?: la cle(?: de| d')?| mon| ma)? ?(claude|anthropic|chatgpt|openai|gpt|gemini|google|mistral|groq|openrouter|deepseek|l'ia|une ia|mon ia|une cle|ma cle|la cle|une cle api))$/);
    if (m) return { tipo: 'ai', fornitore: FORN[m[1]] || null }; }
  // la sincronizzazione fra i computer
  if (/^(?:arrete|desactive|coupe|stop)(?: la| le)? (?:synchro|synchronisation|sync)\b|^arrete sur cet (?:ordi|ordinateur|pc|mac)\b/.test(p)) return { tipo: 'sincronizza', cosa: 'smetti' };
  if (/^(?:change|changer|nouveau)(?: le| mon)? (?:mot de passe|mdp)\b|^j'ai oublie(?: mon| le)? (?:mot de passe|mdp)\b/.test(p)) return { tipo: 'sincronizza', cosa: 'password' };
  if (/^deverrouille(?:r)?(?: (?:la )?(?:synchro|synchronisation)| mes donnees| lode)?$/.test(p)) return { tipo: 'sincronizza', cosa: 'sblocca' };
  if (/^(?:connecte|relie|ajoute|lie) (?:un )?autre (?:ordi|ordinateur|pc|mac)\b/.test(p)) return { tipo: 'sincronizza', cosa: 'altro' };
  if (/^(?:j'utilise deja|j'ai deja|je suis deja sur|connecte-moi a)(?: lode)? (?:sur |depuis |avec )?(?:un )?autre (?:ordi|ordinateur|pc|mac)\b/.test(p)) return { tipo: 'sincronizza', cosa: 'collega' };
  if (/^(?:synchro|synchronise|synchroniser|synchronisation|sync)\b|^(?:active|gere|ouvre)(?: la)? synchro/.test(p)) return { tipo: 'sincronizza', cosa: null };
  // «installe obsidian», «configure»: solo con quello che Lode sa preparare («prépare un exposé» resta all'AI)
  if ((m = p.match(/^(?:prepare|preparer|configure|configurer|installe|installer|parametre|parametrer)(?: (?:le |la |l'|les )?(obsidian|modele|cerveau|ia|ollama|gemma|qwen|lode|tout|app|appli))?$/))) return { tipo: 'prepara', cosa: m[1] === 'obsidian' ? 'obsidian' : /modele|cerveau|ollama|gemma|qwen|ia/.test(m[1] || '') ? 'cervello' : null };
  // il journal del progetto nel vault: aprirlo, spegnerlo, riaccenderlo
  if ((m = cerca(/^(desactive|eteins|coupe|n'ecris pas|n'ecris plus|arrete d'ecrire|active|allume|reactive|ecris) (?:le )?(?:journal|carnet de bord|journal de bord)(?: (?:du|de|pour le|pour) (?:projet)?\s*(.*))?$/, t))) return { tipo: 'diarioOpz', diario: /^(?:active|allume|reactive|ecris)$/.test(piano(m[1])), progetto: m[2] ? pulisci(m[2]) || null : null };
  if ((m = cerca(/^(?:ouvre (?:le )?)?(?:journal (?:du|de) projet|journal de bord(?: du projet)?)(?: (?:de |du |pour )?(.+))?$/, t))) return { tipo: 'diario', progetto: m[1] ? pulisci(m[1]) : null };
  // Moodle in sola lettura: «connecte moodle», «quoi de neuf sur moodle», «échéances», «déconnecte moodle»
  if (/^(?:deconnecte|deconnecter|deconnecte-moi de|enleve|supprime)(?: de)? moodle$/.test(p)) return { tipo: 'moodle', cosa: 'scollega' };
  if (/^(?:quoi de neuf|du nouveau|nouveautes|les nouveautes|nouveaux fichiers|mises a jour|verifie)(?: (?:sur|dans|de))? moodle$|^moodle (?:nouveautes|du nouveau)$/.test(p)) return { tipo: 'moodle', cosa: 'novita' };
  if (/^(?:mes |les )?(?:echeances|deadlines|rendus|devoirs a rendre|dates limites)(?: (?:sur|dans|de) moodle)?$|^(?:qu'est-ce que j'ai a rendre|j'ai quoi a rendre|c'est quoi mes rendus)(?: sur moodle)?$/.test(p)) return { tipo: 'moodle', cosa: 'scadenze' };
  if (/^(?:mes |les )?cours (?:sur|dans|de) moodle$|^mes cours moodle$/.test(p)) return { tipo: 'moodle', cosa: 'corsi' };
  if (/^(?:(?:connecte|connecter|relie|ajoute|ouvre|configure)(?: a)?(?: le| la)? )?(?:moodle|e-?learning|plateforme de cours)$/.test(p)) return { tipo: 'moodle', cosa: null };
  if ((m = cerca(/^(?:ouvre|ouvrir|va a|va sur|va dans|aller a|emmene-moi (?:a|sur)|montre-moi)\s+(.+)$/, t)) && !/^(?:le |la )?(?:focus|timer|minuteur|chrono)/.test(piano(m[1]))) { const q = pulisci(pulisci(m[1]).replace(/^page\s+/i, '')); return { tipo: 'naviga', q: /^(?:accueil|home)$/.test(piano(q)) ? 'home' : q }; }
  if (/^(?:toutes les notes|pages|accueil|home|index|sommaire)$/.test(p)) return { tipo: 'naviga', q: /^(?:accueil|home)$/.test(p) ? 'home' : '' };

  // carte : recto = verso
  if ((m = cerca(/^(?:nouvelle\s+)?(?:carte|flashcard)\s*(?:(?:pour|de|d'|du|en)\s*([^:]+?))?\s*:\s*(.+?)\s*(?:=|->|→|\|)\s*(.+)$/i, grezzo)))
    return { tipo: 'carta', esame: m[1] ? trovaEsame(m[1]) : null, fronte: m[2], retro: m[3] };

  // simulazione e voto: «et si j'ai 16 en analyse 2», «j'ai eu 15/20 en physique», «30 e lode en analyse 2»
  const VOTO = '(\\d{1,2}(?:[.,]\\d{1,2})?)(?:\\s*(?:/|sur)\\s*20)?', LODE = '( e lode| lode| cum laude| avec (?:les )?felicitations)?';
  const voto = s => { const v = parseFloat(s.replace(',', '.')); return v >= 0 && (v <= 20 || (Number.isInteger(v) && v >= 18 && v <= 30)) ? v : null; };
  if ((m = cerca(new RegExp(`^(?:et |du coup )?(?:si jamais |si )(?:j'ai|j'obtiens|je prends|je chope|je choppe|je fais|je me prends|j'ai eu)(?: un| une)? ${VOTO}${LODE} (?:en|a|au|aux|dans|pour)\\s+(.+)$`), t))) {
    const v = voto(m[1]); if (v != null) return { tipo: 'simula', voto: v, lode: !!m[2] && v === 30, esame: trovaEsame(pulisci(m[3])), nomeDetto: pulisci(m[3]) };
  }
  if ((m = cerca(new RegExp(`^(j'ai eu|j'ai|j'ai obtenu|j'ai chope|j'ai choppe|j'ai pris|j'ai fait|je me suis pris|eu|obtenu)?\\s*(?:un |une )?${VOTO}${LODE}\\s+(?:en|a|au|aux|dans|pour)\\s+(.+)$`), t))) {
    const v = voto(m[2]);
    if (v != null && (m[1] || v >= 10 || /\/|sur 20/.test(p))) return { tipo: 'voto', voto: v, lode: !!m[3] && v === 30, esame: trovaEsame(pulisci(m[4])), nomeDetto: pulisci(m[4]) };
  }
  if ((m = cerca(/^(?:j'ai |j ai )?(?:(?:valide|reussi|obtenu)(?: (?:l'|le |la |mon |ma ))?|eu l')(?:(?:ue|module|examen|exam|epreuve|certif|certification|test) (?:d'|de |du |en )?)?(.+?)(?: \(?(?:valide|admise?)\)?)?$/, t)) && !/\d/.test(m[1]) && trovaEsame(pulisci(m[1])))
    return { tipo: 'idoneita', esame: trovaEsame(pulisci(m[1])), nomeDetto: pulisci(m[1]) };

  // focus, anche con i minuti prima: «lance un pomodoro de 25 minutes sur analyse 2», «bosse bdd pendant une heure»
  if ((m = cerca(/^(?:(?:lance|lancer|demarre|demarrer|commence|commencer|fais|on fait|on lance|je lance|mets)(?: un| une| le| la| mon| ma)? )?(?:(\d{1,3}) ?(?:minutes?|mins?|mn|m) (?:de )?)?(?:focus|pomodoro|timer|minuteur|chrono|session(?: de travail| d'etude| de revision)?|etudie|etudier|bosse|bosser|concentration|deep work)\b\s*(.*)$/, t))) {
    let resto = m[2]; const mi = m[1] ? { min: +m[1] } : leggiMinuti(resto); if (mi?.pezzo) resto = resto.replace(mi.pezzo, ' ');
    resto = pulisci(resto.replace(/\s+/g, ' ').trim()); const e = resto ? trovaEsame(resto, { anche: 'daFare' }) || trovaEsame(resto) : null;
    return { tipo: 'focus', min: mi ? Math.min(240, Math.max(1, mi.min)) : null, esame: e, nomeDetto: resto };
  }

  // «l'exam d'analyse 2 est le 15 janvier», «j'ai le partiel de physique 2 lundi», «analyse 2 reporté au 20 janvier»
  const QUANDO = `(le \\d.+|le (?:1er|premier) .+|dans \\d.+|demain|apres-demain|apres demain|(?:ce |le )?(?:${GIORNI.join('|')}).*)`;
  if ((m = cerca(/^(?:l'|le |la |mon |ma )?(?:examen|exam|partiel|ds|oral|ecrit|final|controle)(?: (?:de |d'|du |en )|d')?(.+?),? (?:est|sera|tombe|c'est|aura lieu|a lieu)(?: (?:prevu |prevue |fixe |fixee )?(?:le|pour le))? (.+)$/, t)) || (m = cerca(new RegExp(`^j'ai (?:(?:l'|un |une |mon |ma |le |la )(?:examen|exam|partiel|oral|ecrit|ds|controle)(?: (?:de |d'|du |en )|d')?|mon |ma )?(.+?) ${QUANDO}$`), t)) || (m = cerca(/^(?:l'|le |la )?(?:(?:examen|exam|partiel)(?: (?:de |d'|du )|d')?)?(.+?) (?:a ete |est )?(?:reporte|repousse|decale|deplace|avance)e?s? (?:au|a|le|pour le|pour) (.+)$/, t))) {
    const d = leggiData(m[2]), e = trovaEsame(pulisci(m[1]));
    if (d && (e || (/exam|partiel|\bds\b|oral|ecrit|controle/.test(p) && pulisci(m[1]).length >= 3))) return { tipo: 'esame', nome: e?.nome || pulisci(m[1]), cfu: null, data: d.data, esistente: e && !e.fatto ? e : null };
  }
  // nuovo esame: «examen bases de données le 15 janvier 9 ects», «ajoute l'examen histoire contemporaine»
  if ((m = cerca(/^(?:ajoute|ajouter|nouvel|nouveau|note|mets|il y a)?\s*(?:un |une |l'|le |mon )?(?:examen|exam|partiel)\s*:?\s+(?:de |d'|du |en |pour )?(.+)$|^(?:ajoute|ajouter|nouvel|nouveau|note|mets|il y a)?\s*(?:un |une |l'|le |mon )?(?:examen|exam|partiel) d'(.+)$/, t)) && !/^(?:moi|quoi|quel|quand|prochains?|blanc|dates?|calendrier|session|questions|exercices|sujets?|simulation)\b/.test(piano(m[1] || m[2])) && !/\b(?:quand|quel(?:le)?s?|comment|pourquoi|combien|c'est|est-ce)\b/.test(piano(m[1] || m[2])) && !/\?\s*$/.test(grezzo0)) {
    let resto = ' ' + (m[1] || m[2]).replace(/[,;]/g, ' ') + ' ';
    const c = cerca(/(?:de |avec |pour |a )?(\d{1,2})\s*(?:cfu|credits?|ects|ecues?)\b/, resto); let cfu = null; if (c) { cfu = +c[1]; resto = resto.replace(c[0], ' '); }
    const d = leggiData(resto); if (d) { const i = piano(resto).indexOf(d.pezzo); resto = i >= 0 ? resto.slice(0, i) + ' ' + resto.slice(i + d.pezzo.length) : norm(resto).replace(d.pezzo, ' '); }
    const nome = pulisci(String(resto).replace(/\s+/g, ' ').trim());
    if (nome && (/\b(?:exam|examen|partiel)\b/.test(p) || d || cfu)) return { tipo: 'esame', nome, cfu, data: d?.data || null, esistente: trovaEsame(nome) };
  }

  // «il me faut combien pour 110», «quelle moyenne il me faut pour avoir 14», «… pour la mention bien»
  if ((m = p.match(/(?:il me faut combien|combien il me faut|combien me faut-il|qu'est-ce qu'il me faut|qu'est ce qu'il me faut|quelle moyenne (?:il me faut|me faut-il|je dois avoir|faut-il)|il me faut quelle moyenne|je dois avoir combien|combien je dois avoir)(.*)$/))) {
    const x = m[1].match(/(\d{2,3}(?:[.,]\d)?)/), b = x ? parseFloat(x[1].replace(',', '.')) : null;
    if (b >= 66) return { tipo: 'serve', base: Math.min(110, Math.round(b)) };
    if (b >= 10 && b <= 20) return { tipo: 'serve', base: b };
    const me = m[1].match(/\b(tres bien|assez bien|bien|passable)\b/);
    if (!x && me) return { tipo: 'serve', base: { 'tres bien': 16, 'assez bien': 12, bien: 14, passable: 10 }[me[1]] };
  }
  if ((p === 'mes notes' || /\b(?:moyenne|releve de notes|bulletin|credits|ects|mes resultats|ou j'en suis|j'en suis ou)\b/.test(p)) && !/\b(?:explique|veut dire|signifie|calcule|calculer|definition|comment|pourquoi)\b/.test(p) && (!/\b(?:c'est quoi|qu'est-ce que|qu'est ce que|c quoi)\b/.test(p) || /\b(?:ma|mes|mon)\b/.test(p))) return { tipo: 'libretto' };

  // ripasso
  if ((m = cerca(/^(?:on |je veux |je vais |fais-moi |fais moi |commence a )?(?:revisions|revision|revisons|reviser|revise|mes cartes|les cartes|cartes|mes flashcards|flashcards)(?=\s|$)\s*(.*)$/, t))) {
    const r = pulisci(m[1] || ''); return { tipo: 'ripasso', esame: r ? trovaEsame(r) : null, nomeDetto: r };
  }

  // il ponte con gli agenti di programmazione: «agents», «connecte claude code», «déconnecte cursor», «qu'a fait l'agent»
  if ((m = p.match(/^(connecte|connecter|branche|deconnecte|deconnecter|debranche|enleve|supprime)(?: (?:les )?agents| (claude(?: code)?|codex|gemini(?: cli)?|cursor|copilot(?: cli)?|cline|windsurf|opencode|open code|aider|kiro|qwen(?: code)?|amp|roo(?: code)?|kilo(?: code)?|continue|zed|junie))$/))) return { tipo: 'agenti', agente: m[2] ? m[2].replace(/ (?:code|cli)$/, '').replace(' ', '') : null, togli: !/^(?:connecte|connecter|branche)$/.test(m[1]) };
  if (/^(?:mes |les )?agents(?: (?:de code|de programmation|ia|de dev))?$|^(?:le )?pont(?: avec les agents)?$/.test(p)) return { tipo: 'agenti', agente: null };
  const AG = "(?:l'agent|claude(?: code)?|codex|cursor|gemini|l'ia)";
  if (new RegExp(`^(?:qu'a fait|qu'est-ce qu'a fait|qu'est ce qu'a fait) ${AG}$|^(?:qu'est-ce que|qu'est ce que) ${AG} a fait$|^${AG} a fait quoi$|^(?:le )?dernier tour(?: de l'agent)?$`).test(p)) return { tipo: 'turnoAgente' };
  // l'interrogazione (prima del quiz)
  if ((m = cerca(/^(?:interroge-moi|interroge moi|interrogez-moi|pose-moi des questions|questionne-moi|simule (?:l'|un )?oral|fais-moi passer (?:l'|un )?oral|oral blanc|kholle|oral)\b\s*(.*)$/, t))) {
    const r = pulisci(m[1] || ''); return { tipo: 'orale', esame: r ? trovaEsame(r) : null, nomeDetto: r };
  }
  // il quiz a crocette: «QCM d'analyse 2», «quiz», «simulation d'examen de droit privé»
  if ((m = cerca(/^(?:(?:donne-moi|lance|fais|fais-moi|on fait) )?(?:un |une |le |la |des )?(quiz|qcm|questions a choix multiples?|simulation d'examen|simulation d'exam|simulation de partiel|simule (?:l'|le )?(?:examen|exam|partiel|ecrit)|test d'entrainement)(?=[\s']|$)\s*(.*)$/, t))) {
    const r = pulisci(m[2] || ''); if (r !== 'me') return { tipo: 'crocette', esame: r ? trovaEsame(r) : null, nomeDetto: r, simulazione: /simul/.test(piano(m[1])) };
  }

  if (/^(?:mes |les )?(?:examens|exams|partiels|prochains examens|prochains exams|prochains partiels|calendrier(?: des examens| des partiels)?|session d'examens|dates (?:des |d')?exam(?:en)?s|quand sont mes (?:examens|partiels|exams))\b|^(?:quand|c'est quand) (?:est |sont )?(?:mon |mes |le |les )?(?:prochains? )?(?:examens?|exams?|partiels?)$/.test(p)) return { tipo: 'esami' };
  if (/^(?:aujourd'hui|auj|plan|planning|le plan|mon plan|plan du jour|programme du jour|planning du jour|(?:qu'est-ce que|qu'est ce que) je (?:revise|bosse|etudie) aujourd'hui|je (?:revise|bosse|etudie) quoi aujourd'hui|on fait quoi aujourd'hui|aujourd'hui (?:je fais|je revise|j'etudie|on fait) quoi)$/.test(p)) return { tipo: 'oggi' };

  // ricerca diretta: il nome di un esame da solo apre la sua scheda
  const e = trovaEsame(t);
  if (e && norm(e.nome).startsWith(norm(t)) && norm(t).length >= 3) return { tipo: 'apriEsame', esame: e };
  return null;
}

// gli orari alla francese diventano quelli che capisce comune.js: «14h30» → «14:30», «9h-11h» → «9-11», «de 14h à 16h» →
// «14 a 16», «midi» → 12. «amphi» diventa «salle»: dopo un orario «am» sarebbe il mattino all'inglese («8h30-10h amphi A»)
const orePiane = s => piano(s).replace(/\bamphi(?:theatre)?\b/g, 'salle').replace(/\bmidi\b/g, '12').replace(/\bminuit\b/g, '24').replace(/(\d{1,2})\s*h\s*(\d{2})\b/g, '$1:$2').replace(/(\d{1,2})\s*h\b/g, '$1').replace(/\b(?:de|des|entre) (?=\d)/g, '');
// giorni e ore di una frase («lundi et mercredi 9h-11h salle 7», «lun mer 14h-19h»): resto è quello che avanza, normalizzato
const GIORNO_BREVE = /\b(lun(?:di)?|mar(?:di)?|mer(?:credi)?|jeu(?:di)?|ven(?:dredi)?|sam(?:edi)?|dim(?:anche)?)s?\b/g;
export function giorniEOre(testo) {
  const basso = orePiane(String(testo).toLowerCase());
  const o = oreInCifre(basso, "a|jusqu'a|jusqu a");
  if (!o) return null;
  let r = ' ' + norm(basso.replace(o.pezzo, ' ')) + ' ';
  const giorni = [], G = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  r = r.replace(GIORNO_BREVE, (_, g) => { giorni.push(G.indexOf(g.slice(0, 3))); return ' '; });
  return { giorni, inizio: o.inizio, fine: o.fine, resto: r.replace(/\s+/g, ' ').replace(/^ ?/, ' ').replace(/ ?$/, ' ') };
}
// giorni, ore e salle di un cours; quello che resta è il nome del corso
export function leggiOrario(testo) {
  const x = giorniEOre(testo);
  if (!x || !x.giorni.length) return null;
  let r = x.resto, aula = ''; r = r.replace(/ (?:en |dans l |dans la )?(?:salle|amphi|amphitheatre|labo) (\w+)/, (_, a) => { aula = a.length <= 3 ? a.toUpperCase() : a.charAt(0).toUpperCase() + a.slice(1); return ' '; });
  const corso = r.replace(/\b(?:et|le|les|chaque|tous|toutes|a|au)\b/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(?:de|d|du|des|en|la|l) /, '');
  if (!corso) return null;
  const e = trovaEsame(corso);
  // un corso nuovo: il nome con i suoi accenti, se si ritrova nella frase («économie», non «economie»)
  const i = piano(String(testo).toLowerCase()).indexOf(corso), vero = i >= 0 ? String(testo).toLowerCase().slice(i, i + corso.length) : corso;
  return { corso: e?.nome || vero.replace(/^./, c => c.toUpperCase()), giorni: x.giorni, inizio: x.inizio, fine: x.fine, aula };
}

// il lavoro (js/ore.js): «je bosse lundi mercredi vendredi 14h-19h», «mes horaires sont …», «jeudi je ne travaille pas»,
// «samedi je bosse aussi 18h-23h», «les jours de boulot je révise max 2h», «j'étudie de 10h à 22h», «je ne bosse plus»
const GIORNO = `(aujourd'hui|demain|apres-demain|${GIORNI.join('|')})`;
function dataDetta(s) {
  const T = oggi(), k = ["aujourd'hui", 'demain', 'apres-demain'].indexOf(s); if (k >= 0) return piuGiorni(T, k);
  const dow = GIORNI.indexOf(s); if (dow < 0) return null;
  return piuGiorni(T, (dow - new Date(T + 'T12:00').getDay() + 7) % 7);
}
const ORA = /\d{1,2}(?::\d{2})?\s*(?:-|–|a|jusqu'a)\s*\d{1,2}(?::\d{2})?/g;
const BOSSO = '(?:travaille|bosse)';
export function leggiLavoro(testo) {
  const t = piano(String(testo || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim());
  let m;
  if (new RegExp(`^(?:je (?:ne )?${BOSSO} plus|j'ai arrete de (?:travailler|bosser)|j'ai quitte mon (?:job|boulot|travail|taf)|plus de (?:boulot|travail|job|taf)|(?:supprime|efface|enleve)(?: mon| mes| le| les)? (?:job|boulot|travail|horaires de travail|horaires de boulot|shifts))$`).test(t)) return { tipo: 'lavoro', azione: 'togli' };
  if (new RegExp(`^(?:quand (?:est-ce que |est ce que )?je ${BOSSO}|je ${BOSSO} quand|mes horaires(?: de (?:travail|boulot))?|mes shifts|mon (?:boulot|travail|job|taf)|mes heures de (?:travail|boulot))$`).test(t)) return { tipo: 'lavoro', azione: 'vedi' };
  const NON = `je (?:ne )?${BOSSO} pas`;
  if ((m = t.match(new RegExp(`^(?:(?:ce|le) )?${GIORNO},? ${NON}$`))) || (m = t.match(new RegExp(`^${NON} (?:(?:ce|le) )?${GIORNO}$`)))) return { tipo: 'lavoro', azione: 'eccezione', data: dataDetta(m[1]), no: true };
  if ((m = t.match(new RegExp(`^(?:les jours (?:de (?:boulot|travail|taf)|ou je ${BOSSO})|quand je ${BOSSO}),? (?:j'etudie|je revise|je bosse|je peux (?:etudier|reviser)) (?:au maximum |au max |max |maximum |seulement |pas plus de |jusqu'a )?(.+)$`)))) {
    const mi = leggiMinuti(m[1]); if (mi && /h|min|mn/.test(mi.pezzo) && mi.min >= 15 && mi.min <= 600) return { tipo: 'lavoro', azione: 'tetto', min: mi.min };
  }
  if ((m = t.match(/^(?:d'habitude |en general |normalement )?(?:j'etudie|je revise) (?:de |entre )?(.+)$/))) {
    const s = orePiane(m[1]), x = oreInCifre(s, "a|et|jusqu'a"), o = x && x.pezzo.trim() === s.trim() && orarioOk(x.inizio, x.fine);
    if (o && o.fine !== '24:00') return { tipo: 'lavoro', azione: 'finestra', da: o.inizio, a: o.fine };
  }
  // un turno in più solo quel giorno: «samedi je bosse aussi 18h-23h», «cette semaine je travaille aussi samedi 18h-23h»
  if ((m = t.match(new RegExp(`^(?:cette semaine,? )?(?:(.+?),? )?(?:je ${BOSSO} aussi|j'ai un shift en plus)(?: le)? (.+)$`)))) {
    const g = `${m[1] || ''} ${m[2]}`.match(new RegExp(`(?:^| )${GIORNO}(?= |$)`)), x = g && giorniEOre(m[2].replace(g[1], ' '));
    const o = x && orarioOk(x.inizio, x.fine);
    if (o) return { tipo: 'lavoro', azione: 'eccezione', data: dataDetta(g[1]), ...o };
  }
  // i turni di ogni settimana: «je bosse …» li aggiunge, «mes horaires sont …» li sostituisce. Quello che avanza (au bar) va
  // bene se è poco: «je bosse sur mon mémoire lundi 9h-13h» o «travail de groupe lundi 14h-16h» non sono turni
  if ((m = t.match(new RegExp(`^(?:(mes horaires (?:de (?:travail|boulot) )?sont|mes shifts sont|mon shift c'est|maintenant je ${BOSSO}|desormais je ${BOSSO}|je ${BOSSO} seulement|je ne ${BOSSO} que)|je ${BOSSO}|j'ai (?:un )?shifts?|shifts?)\\s+(.+)$`)))) {
    const s = orePiane(m[2]), pezzi = [];
    let da = 0; for (const o of s.matchAll(ORA)) { pezzi.push(s.slice(da, o.index + o[0].length)); da = o.index + o[0].length; }
    if (pezzi.length) pezzi[pezzi.length - 1] += s.slice(da);
    const xs = pezzi.map(giorniEOre), turni = xs.map(x => x && x.giorni.length && orarioOk(x.inizio, x.fine));
    const resto = xs.flatMap(x => x ? x.resto.replace(/\b(?:et|le|les|la|de|du|a|au|chaque|tous|en|l|d)\b/g, ' ').trim().split(/\s+/).filter(Boolean) : []);
    if (turni.length && turni.every(Boolean) && resto.length <= 2 && !xs.some(x => /groupe|projet|these|memoire|exo|devoir|\btd\b|\btp\b|rapport|expose|cours/.test(x.resto))) {
      const tt = turni.map((o, i) => ({ giorni: [...new Set(xs[i].giorni)].sort(), ...o }));
      return { tipo: 'lavoro', azione: m[1] ? 'sostituisci' : 'aggiungi', ...tt[0], ...(tt.length > 1 ? { turni: tt } : {}) };
    }
  }
  return null;
}

// gli stessi esempi dell'italiano, nello stesso ordine
export const ESEMPI = [
  ['focus 50 sur analyse 2', 'lance le minuteur et compte les heures'],
  ["j'ai eu 15 en physique", 'enregistre la note et met à jour ta moyenne'],
  ['examen bases de données le 15 janvier 6 ECTS', "ajoute la date de l'examen"],
  ['il me faut combien pour avoir 14 de moyenne', "la moyenne qu'il te faut d'ici la fin"],
  ["et si j'ai 16 en analyse 2", 'simule ta moyenne'],
  ["programme d'analyse 2", "colle le programme : une carte des thèmes et un plan jusqu'à l'examen"],
  ['questions tombées en analyse 2 : …', 'celles de ta promo : elles remontent dans le plan'],
  ["annales d'analyse 2 : …", "les exercices d'un ancien sujet : un par jour, sur les thèmes du jour"],
  ["examen blanc d'analyse 2", "un ancien sujet entier, avec le vrai temps : tu dis comment ça s'est passé"],
  ["je t'explique : théorème de Green", 'tu expliques un thème, Lode te dit ce que tu as oublié'],
  ["QCM d'analyse 2", "questions à choix multiples : entraînement, ou simulation d'examen chronométrée"],
  ['transcris la visio de droit privé', "depuis le son de l'ordinateur : pour réviser chez toi"],
  ['connecte moodle', 'les nouveaux fichiers et les échéances de la plateforme de ta fac'],
  ['agents', "connecte Claude Code, Codex, Cursor… : Lode te dit ce qu'ils ont vraiment fait dans tes projets"],
  ['révise analyse 2', 'les cartes du jour'],
  ['carte : théorème de Green = …', 'une carte rapide'],
  ['exporte vers anki', 'cartes et définitions dans un fichier pour Anki, un paquet par cours'],
  ['révisions de poche', 'les cartes de demain dans une note, à faire sur ton téléphone avec Obsidian'],
  ['cours analyse 2 lundi et mercredi 9h-11h salle 7', 'ton emploi du temps : Lode sait quand tu es en cours'],
  ['je bosse lundi mercredi vendredi 14h-19h', "tes horaires de boulot : le plan n'utilise que ton vrai temps libre, avec une demi-heure pour y aller"],
  ['planning de la semaine', 'tous tes examens dans un calendrier, à la minute près : ce qui rentre et ce qui ne rentre pas'],
  ['★ il demande toujours le théorème de Green', "en cours : marque ce qui tombera à l'examen"],
  ['déf : gradient = vecteur des dérivées partielles', 'en cours : une définition dans la note'],
  ['joue', 'deux minutes sur les définitions du dernier cours'],
  ['transcris le cours', 'en cours : tout le cours en notes, formules comprises, enregistré dans Obsidian'],
  ['mets au propre le cours', 'de la transcription à des notes propres (IA)'],
  ['répète', 'en cours : ce que le prof a dit dans les 60 dernières secondes'],
  ['IA', "connecte ton IA préférée (Claude, ChatGPT, Gemini, Mistral…), tu paies à l'usage"],
  ['partage la transcription', 'le cours pour tes camarades : AirDrop, WhatsApp, mail'],
  ['ferme le cours', 'définitions et ★ extraites des notes (IA)'],
  ['ouvre glossaire', 'va à une page du vault'],
  ['interroge-moi sur bases de données', "simule l'oral (avec l'IA)"],
  ["qu'est-ce que ça affiche", 'exercices de C : la réponse est calculée par Lode, pas par une IA'],
  ["qu'est-ce que ça affiche en python", "les mêmes exercices en Python (ou en Java : « qu'est-ce que ça affiche en java »)"],
  ['suis le projet', "surveille ton dossier de TP : ce qui change et si tu l'as testé"],
  ['teste le projet', 'compile et lance les tests .in/.out, après ta confirmation'],
  ["explique-moi l'erreur", "copie l'erreur du terminal : je te l'explique en français, pas à pas"],
  ['journal du projet', 'ouvre le journal du jour dans Obsidian'],
  ['arrête de suivre', 'Lode arrête de surveiller le dossier et supprime ses copies'],
  ['synchro entre ordis', "le même Lode sur deux ou trois ordinateurs, avec le dossier cloud que tu as déjà"],
];
