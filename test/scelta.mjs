// La scelta della lingua e del sistema dei voti: node test/scelta.mjs
// 1) chi usa già Lode resta in italiano anche con il sistema in un'altra lingua, chi arriva adesso prende quella del sistema
//    (js/lingua.js, iniziale; desktop/lingua.mjs, linguaDiPartenza e daFissare; l'ordine in desktop/main.mjs);
// 2) le piccole parole dentro le schede (PAROLE dei riconoscitori, detto() di js/comandi/comune.js): in italiano le stesse
//    regex di prima, carattere per carattere, su migliaia di frasi; in ogni lingua i suoi sì, no, basta, voto, esci;
// 3) il comando della lingua (esegui in js/lode.js), il benvenuto (primo passo), le Impostazioni, index.html;
// 4) profilo.sistema nei dati e nei backup, il predefinito della lingua (il portoghese va al Brasile).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const L = await import('../js/lingua.js');
const Dati = await import('../js/dati.js');
const S = await import('../js/sistemi.js');
const { detto } = await import('../js/comandi/comune.js');
const LD = await import('../desktop/lingua.mjs');
const R = Object.fromEntries(await Promise.all(Object.keys(L.LINGUE).map(async c => [c, await import(`../js/comandi/${c}.js`)])));
const leggi = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const uguale = (nome, a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); prova(nome, x === y, `\n   ${x}\n ≠ ${y}`); };

/* ---------- 1. chi usa già Lode resta in italiano ---------- */
const vecchio = { v: 1, profilo: { nome: 'Ada' }, esami: [{ id: 'e1', nome: 'Analisi', cfu: 9 }], imp: { benvenuto: '2026-03-01' } };
uguale('browser: utente vecchio con il sistema in inglese resta in italiano (e lo salva)', L.iniziale({ salvata: null, dati: vecchio, sistema: 'en-US' }), { lingua: 'it', salva: true });
uguale('browser: utente vecchio senza benvenuto ma con esami resta in italiano', L.iniziale({ dati: { v: 1, esami: [{ id: 'e1' }], imp: {} }, sistema: 'de-DE' }), { lingua: 'it', salva: true });
uguale('browser: i dati di esempio (benvenuto: true) restano in italiano', L.iniziale({ dati: { v: 1, esami: [], benvenuto: true, imp: {} }, sistema: 'fr-FR' }), { lingua: 'it', salva: true });
uguale('browser: utente nuovo prende la lingua del sistema', L.iniziale({ dati: null, sistema: 'es-ES' }), { lingua: 'es', salva: false });
uguale('browser: utente nuovo, portoghese del Brasile', L.iniziale({ sistema: 'pt-BR' }), { lingua: 'pt', salva: false });
uguale('browser: utente nuovo, dati vuoti, sistema in tedesco', L.iniziale({ dati: { v: 1, esami: [], imp: {} }, sistema: 'de-AT' }), { lingua: 'de', salva: false });
uguale('browser: lingua del sistema sconosciuta → inglese', L.iniziale({ sistema: 'ja-JP' }), { lingua: 'en', salva: false });
uguale('browser: la lingua salvata vince su tutto', L.iniziale({ salvata: 'fr', dati: vecchio, sistema: 'en-US' }), { lingua: 'fr', salva: false });
uguale('browser: una lingua salvata strana non vale', L.iniziale({ salvata: '__proto__', sistema: 'it-IT' }), { lingua: 'it', salva: false });
uguale('browser: dati illeggibili come se mancassero', L.iniziale({ dati: 'boh', sistema: 'en-GB' }), { lingua: 'en', salva: false });
prova('imposta rifiuta una lingua strana', L.imposta('__proto__') === false && L.imposta('xx') === false);
const src = leggi('js/lingua.js');
prova('browser: scelta() passa da iniziale() e salva l\'italiano una volta sola', /const r = iniziale\(\{ salvata, dati, sistema: sis \}\);\s*if \(r\.salva\) try \{ localStorage\.setItem\(CHIAVE, r\.lingua\)/.test(src) && src.includes("localStorage.getItem('lode:v1')"));

// e dal vero: js/lingua.js caricato come in un browser (senza process, con navigator e localStorage), in un processo a parte
function nelBrowser({ dati = null, salvata = null, sistema }) {
  const codice = `const deposito = new Map(${JSON.stringify([...(dati ? [['lode:v1', JSON.stringify(dati)]] : []), ...(salvata ? [['lode:lingua', salvata]] : [])])});
    globalThis.localStorage = { getItem: k => deposito.get(k) ?? null, setItem: (k, v) => deposito.set(k, String(v)), removeItem: k => deposito.delete(k) };
    globalThis.window = globalThis;
    Object.defineProperty(globalThis, 'navigator', { value: { language: ${JSON.stringify(sistema)}, languages: [${JSON.stringify(sistema)}] }, configurable: true });
    const p = globalThis.process; Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true, writable: true });
    const L = await import(${JSON.stringify(new URL('../js/lingua.js', import.meta.url).href)});
    Object.defineProperty(globalThis, 'process', { value: p, configurable: true, writable: true });
    console.log(JSON.stringify({ lingua: L.lingua, salvata: deposito.get('lode:lingua') ?? null }));`;
  try { return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codice], { encoding: 'utf8', timeout: 30000 }).trim().split('\n').pop()); } catch (e) { return { errore: e.message }; }
}
uguale('browser vero: utente vecchio con il sistema in inglese → italiano, salvato', nelBrowser({ dati: vecchio, sistema: 'en-US' }), { lingua: 'it', salvata: 'it' });
uguale('browser vero: utente nuovo con il sistema in inglese → inglese, niente salvato', nelBrowser({ sistema: 'en-US' }), { lingua: 'en', salvata: null });
uguale('browser vero: utente nuovo con il sistema in spagnolo → spagnolo', nelBrowser({ dati: { v: 1, esami: [], imp: {} }, sistema: 'es-ES' }), { lingua: 'es', salvata: null });
uguale('browser vero: la lingua salvata resta', nelBrowser({ dati: vecchio, salvata: 'de', sistema: 'en-US' }), { lingua: 'de', salvata: 'de' });

prova('app: utente vecchio (conf.benvenuto) con il Mac in inglese resta in italiano', LD.linguaDiPartenza({ vault: '/x', benvenuto: '2026-01-01T10:00:00Z' }, 'en-US') === 'it' && LD.daFissare({ benvenuto: '2026-01-01T10:00:00Z' }));
prova('app: utente nuovo prende la lingua del sistema', LD.linguaDiPartenza({}, 'fr-FR') === 'fr' && LD.linguaDiPartenza({ vault: '/x' }, 'pt-BR') === 'pt' && !LD.daFissare({}) && LD.linguaDiPartenza({}, 'zh-CN') === 'en');
prova('app: la lingua salvata vince e non si tocca più', LD.linguaDiPartenza({ benvenuto: 'x', lingua: 'de' }, 'en-US') === 'de' && !LD.daFissare({ benvenuto: 'x', lingua: 'de' }) && LD.daFissare({ benvenuto: 'x', lingua: 'xx' }));
const main = leggi('desktop/main.mjs');
const iFissa = main.indexOf("if (daFissare(conf)) { conf.lingua = 'it'; salvaConf(); }"), iUsa = main.indexOf('await usa(linguaScelta())'), iFinestre = main.indexOf('creaBarra(); creaTray()');
prova('app: l\'italiano si salva prima della lingua del main e delle finestre', iFissa > 0 && iFissa < iUsa && iUsa < iFinestre && main.indexOf('leggiConf();', main.indexOf('app.whenReady')) < iFissa);
prova('app: linguaScelta passa da linguaDiPartenza', main.includes('const linguaScelta = () => linguaDiPartenza(conf, app.getLocale());'));
const imp = main.match(/ipcMain\.handle\('lingua:imposta'[\s\S]*?\n\}\);/)?.[0] || '';
prova('app: lingua:imposta ricarica tutte le finestre (barra, quadro, benvenuto) quando la lingua cambia', /const cambia = cod !== linguaScelta\(\);[\s\S]*conf\.lingua = cod; salvaConf\(\);[\s\S]*if \(!cambia\) return true;[\s\S]*await usa\(cod\);[\s\S]*tutte\(\)\.forEach\(w => w\.webContents\.reload\(\)\)/.test(imp)
  && /const tutte = \(\) => \[barra, quadro, benvenuto\]/.test(main), imp);

/* ---------- 2. le piccole parole dentro le schede ---------- */
// le regex italiane di prima (js/lode.js prima delle lingue): le parole italiane devono dare esattamente gli stessi risultati
const PRIMA = {
  si: /^(s[iì]|ok(ay)?|conferm[aoi]|confermo|vai|procedi|certo|perfetto|d'accordo|fallo|esatto|giusto|salva(le|li)?)( pure)?[\s,.!]*$/i,
  no: /^(no|annulla|lascia (stare|perdere)|aspetta|stop|niente|meglio di no)[\s,.!]*$/i,
  voto: /^(basta|voto|dammi il voto|ho finito)\b/i,
  basta: /^(esci|annulla|basta|lascia stare)$/i,
  esci: /^(esci|basta orale|chiudi( l'orale)?|fine orale)$/i,
};
const basi = ['sì', 'si', 'SI', 'Sì', 'SÌ', 'ok', 'OK', 'okay', 'Okay', 'conferma', 'confermo', 'confermi', 'confermare', 'vai', 'Vai', 'procedi', 'certo', 'perfetto', "d'accordo", 'd’accordo', 'fallo', 'esatto', 'giusto', 'salva', 'salvale', 'salvali', 'salvalo',
  'no', 'No', 'NO', 'annulla', 'lascia stare', 'lascia perdere', 'lascia  stare', 'aspetta', 'stop', 'niente', 'meglio di no', 'nope',
  'basta', 'Basta', 'voto', 'dammi il voto', 'ho finito', 'bastava', 'votò', 'votazione', 'esci', 'Esci', 'basta orale', 'chiudi', "chiudi l'orale", 'fine orale', 'chiudi orale',
  'pure', 'sì sì', 'si dai', '', ' ', 'ok ok', 'okk', 'oky', 'si?', 'vai via', 'ho finito tutto', 'dammi il voto adesso', 'voto 28', 'basta così', 'basta_così', 'basta2', 'basta-così'];
const code = ['', ' pure', '  pure', ' Pure', '!', '.', ',', ' !', '!!', '.,!', ' ', '  ', '\n', '?', ' grazie', ', pure', ' pure!', ' pure.', 'à', '_', '1', ' ?', '-'];
let frasi = 0, diverse = [];
for (const b of basi) for (const c of code) for (const testa of ['', ' ']) {
  const f = testa + b + c; frasi++;
  for (const q of Object.keys(PRIMA)) if (PRIMA[q].test(f) !== detto(f, R.it.PAROLE, q)) diverse.push(`${q}: «${f}»`);
}
prova(`italiano: le stesse risposte delle regex di prima (${frasi} frasi × 5)`, frasi > 3000 && !diverse.length, diverse.slice(0, 10).join(' | '));
const CHIAVI = ['si', 'siCoda', 'no', 'voto', 'basta', 'esci'];
for (const [c, M] of Object.entries(R)) {
  const P = M.PAROLE;
  prova(`${c}: PAROLE con tutte le chiavi`, P && CHIAVI.every(k => Array.isArray(P[k]) && (k === 'siCoda' || P[k].length >= 3)), JSON.stringify(Object.keys(P || {})));
  prova(`${c}: PAROLE in minuscolo, senza spazi ai lati, senza doppioni`, P && CHIAVI.every(k => P[k].every(w => w === w.toLowerCase() && w === w.trim() && w) && new Set(P[k]).size === P[k].length));
  prova(`${c}: nessuna parola è insieme sì e no`, P && !P.si.some(w => P.no.includes(w)));
}
const CASI = {
  it: { si: ['sì', 'Ok!', 'conferma', 'salvali pure', 'sì pure.'], no: ['no', 'lascia perdere', 'Meglio di no!'], voto: ['basta così', 'dammi il voto', 'ho finito'], basta: ['esci', 'Lascia stare'], esci: ['basta orale', "chiudi l'orale"], non: { si: ['sì ma no', 'yes'], no: ['nein', 'nope'], voto: ['bastava'], basta: ['basta così'], esci: ['esci adesso'] } },
  en: { si: ['yes', 'Yes please', 'OK!', 'go ahead', 'sounds good.'], no: ['no', 'Never mind', 'cancel.'], voto: ['enough', "I'm done", 'give me the grade please'], basta: ['exit', 'Forget it'], esci: ['quit', 'end the oral'], non: { si: ['yes but no', 'sì'], no: ['annulla'], voto: ['enoughs'], basta: ['exit now'], esci: ['close it'] } },
  es: { si: ['sí', 'Vale', 'dale', 'de acuerdo por favor', 'guárdalos'], no: ['no', 'déjalo', 'Mejor no.'], voto: ['basta ya', 'dame la nota', 'terminé'], basta: ['salir', 'Déjalo'], esci: ['cierra el oral', 'fin del oral'], non: { si: ['yes'], no: ['annulla'], voto: ['bastante'], basta: ['salir ya'], esci: ['cierra todo'] } },
  fr: { si: ['oui', "D'accord", 'vas-y', 'oui stp', 'parfait !'], no: ['non', 'laisse tomber', 'Annule.'], voto: ['ça suffit', "j'ai fini", 'donne-moi ma note'], basta: ['quitter', 'Stop'], esci: ["ferme l'oral", "fin de l'oral"], non: { si: ['si'], no: ['no'], voto: ['finir'], basta: ['quitter maintenant'], esci: ['ferme tout'] } },
  de: { si: ['ja', 'Ja bitte', 'passt', 'mach das', 'genau!'], no: ['nein', 'vergiss es', 'Lieber nicht.'], voto: ['genug jetzt', 'ich bin fertig', 'gib mir die note'], basta: ['beenden', 'Raus'], esci: ['prüfung beenden', 'Schließen'], non: { si: ['jahr'], no: ['no'], voto: ['genügend'], basta: ['beenden bitte'], esci: ['schließen bitte'] } },
  pt: { si: ['sim', 'Beleza', 'pode ser', 'sim por favor', 'fechou!'], no: ['não', 'deixa pra lá', 'Melhor não.'], voto: ['chega', 'me dá a nota', 'terminei'], basta: ['sair', 'Chega'], esci: ['fecha a prova oral', 'encerrar'], non: { si: ['sí'], no: ['annulla'], voto: ['chegada'], basta: ['sair agora'], esci: ['fecha tudo'] } },
};
for (const [c, casi] of Object.entries(CASI)) {
  for (const q of ['si', 'no', 'voto', 'basta', 'esci']) {
    for (const f of casi[q]) prova(`${c}: «${f}» è ${q}`, detto(f, R[c].PAROLE, q));
    for (const f of casi.non[q]) prova(`${c}: «${f}» non è ${q}`, !detto(f, R[c].PAROLE, q));
  }
}
const lode = leggi('js/lode.js');
prova('lode.js: niente più regex italiane per sì/no, basta, voto, esci', !/const SI = |const NO = |basta\|voto\|dammi il voto|esci\|annulla\|basta\|lascia stare|esci\|basta orale/.test(lode));
prova('lode.js: le parole passano da dice() di comandi.js', ["dice(testo, 'si')", "dice(testo, 'no')", "dice(testo, 'voto')", "dice(testo, 'basta')", "dice(testo, 'esci')"].every(x => lode.includes(x)));
const C = await import('../js/comandi.js');
prova('comandi.js: in italiano PAROLE è quella italiana e dice() la usa', C.PAROLE === R.it.PAROLE && C.dice('sì pure', 'si') && C.dice('annulla', 'no') && !C.dice('yes', 'si'));

/* ---------- 3. il comando, il benvenuto, le Impostazioni, index.html ---------- */
// l'esempio del comando nel catalogo di ogni lingua è davvero un comando di quella lingua
for (const c of Object.keys(L.LINGUE)) {
  await L.usa(c);
  const es = L.t('impostazioni.comando-esempio'), r = R[c].interpreta(es);
  prova(`${c}: «${es}» cambia lingua`, r?.tipo === 'lingua' && r.codice !== c && Object.hasOwn(L.LINGUE, r.codice), JSON.stringify(r));
  // il nome dentro la frase: «Lode ora parla italiano.», «Lode ahora habla español.», «Lode spricht jetzt Deutsch.»
  const nome = L.t('impostazioni.lingua-nome');
  prova(`${c}: la conferma è nella lingua nuova e ha il nome`, nome.toLowerCase() === L.LINGUE[c].nome.toLowerCase() && L.t('impostazioni.lingua-ora', { nome }).includes(nome) && L.t('impostazioni.lingua-gia', { nome }).includes(nome));
  prova(`${c}: il nome della lingua con le maiuscole giuste dentro la frase`, nome === (['en', 'de'].includes(c) ? L.LINGUE[c].nome : L.LINGUE[c].nome.toLowerCase()), nome);
  prova(`${c}: titolo e descrizione per index.html`, L.t('impostazioni.titolo') === 'Lode' && L.t('impostazioni.descrizione').length > 60 && !L.t('impostazioni.descrizione').includes('"'));
}
await L.usa('it');
const html = leggi('index.html');
prova('italiano: titolo e descrizione del catalogo uguali a index.html', html.includes(`<title>${L.t('impostazioni.titolo')}</title>`) && html.includes(`<meta name="description" content="${L.t('impostazioni.descrizione')}">`));
prova('italiano: la conferma del cambio', L.t('impostazioni.lingua-ora', { nome: 'English' }) === 'Lode ora parla English.' && L.t('impostazioni.lingua-sconosciuta', { lingue: 'x' }).includes('x'));
const app = leggi('js/app.js');
prova('app.js: lang, titolo e descrizione dalla lingua scelta', app.includes('document.documentElement.lang = lingua;') && app.includes("document.title = t('impostazioni.titolo');") && app.includes("setAttribute('content', t('impostazioni.descrizione'))"));
const es = lode.match(/async function cambiaLingua\(cod\) \{[\s\S]*?\n\}/)?.[0] || '';
prova('esegui: il tipo lingua va a cambiaLingua', lode.includes("case 'lingua': return cambiaLingua(c.codice);"));
prova('cambiaLingua: lingua sconosciuta → le sei lingue', /if \(!Object\.hasOwn\(LINGUE, cod \|\| ''\)\) return rispostaFissa\(t\('impostazioni\.lingua-sconosciuta', \{ lingue: Object\.values\(LINGUE\)\.map\(l => l\.nome\)\.join\(', '\) \}\)\)/.test(es));
const iUsa2 = es.indexOf('await usa(cod)'), iConf = es.indexOf("t('impostazioni.lingua-ora'"), iImp = es.lastIndexOf('imposta(cod);'), iRic = es.indexOf('if (!DESKTOP) location.reload();');
prova('cambiaLingua: prima la conferma nella lingua nuova, poi si salva e si ricarica (nel browser; nell\'app il main)', iUsa2 > 0 && iUsa2 < iConf && iConf < iImp && iImp < iRic, es);
const bv = leggi('js/benvenuto.js');
prova('cambiaLingua: il nome della lingua dal suo catalogo', es.includes("t('impostazioni.lingua-nome')") && !es.includes("{ nome: LINGUE[cod].nome }) })"));
prova('benvenuto: il passo della lingua non scrive i dati (vault non ancora scelto)', /P\('lingua'\)\.salva = \(\) => \{[^}]*predefinito\(linguaOra\);\s*\};/.test(bv) && !/P\('lingua'\)\.salva = \(\) => \{[^}]*salva\(\)/.test(bv));
prova('benvenuto: la lingua è il primo passo, obbligatorio', /export const PASSI = \[\s*\{ k: 'lingua', obbl: true \}, \{ k: 'ciao', obbl: true \}/.test(bv));
prova('benvenuto: le sei lingue, ognuna nella sua lingua, quella di adesso già scelta', bv.includes('Object.entries(LINGUE).map(([c, l]) =>') && bv.includes('lang="${c}"') && bv.includes("${c === linguaOra ? ' on' : ''}"));
prova('benvenuto: un clic cambia subito la lingua (salva e ricarica)', bv.includes("if (imposta(b.dataset.v) && !L) location.reload();"));
prova('benvenuto: il sistema dei voti accanto al corso, predefinito dalla lingua, salvato nel profilo', bv.includes('id="bv-sistema"') && bv.includes('predefinito(linguaOra)') && /sistema: CODICI\.includes\(v\('bv-sistema'\)\)/.test(bv));
prova('benvenuto: i passi obbligatori contati dal primo facoltativo (non più 3)', bv.includes("const VELOCE = PASSI.findIndex(p => p.k === 'veloce');") && !/i < 3 \?|k === 3 \?|i >= 3 &&/.test(bv));
const pg = leggi('js/pagina.js');
prova('Impostazioni: la lingua e il sistema dei voti', pg.includes('<select name="lingua">') && pg.includes('<select name="sistema">') && pg.includes("sistema: CODICI.includes(f.get('sistema'))") && pg.includes('imposta(nuova); if (!DESKTOP) location.reload();'));
const sw = leggi('sw.js'), ind = leggi('js/lingue/indice.js');
prova('sw.js e indice.js: l\'area impostazioni e tutti i riconoscitori', ind.includes("'impostazioni'") && Object.keys(L.LINGUE).every(c => sw.includes(`'js/lingue/${c}/impostazioni.js'`) && sw.includes(`'js/comandi/${c}.js'`)));

const mainSrc = leggi('desktop/main.mjs');
prova('app: LODE_LINGUA vale come conf.lingua (prova-app in italiano anche su Windows in inglese)', mainSrc.includes("if (Object.hasOwn(LINGUE, process.env.LODE_LINGUA || '')) conf.lingua = process.env.LODE_LINGUA;") && mainSrc.indexOf('process.env.LODE_LINGUA') < mainSrc.indexOf('await usa(linguaScelta())') && leggi('test/prova-app.mjs').includes("LODE_LINGUA: 'it'"));

/* ---------- 4. il sistema dei voti nei dati ---------- */
prova('VUOTO: profilo.sistema è l\'Italia', Dati.VUOTO().profilo.sistema === 'it');
prova('il portoghese di Lode è quello del Brasile (date e numeri pt-BR)', L.LINGUE.pt.locale === 'pt-BR');
prova('predefinito: il portoghese va al Brasile, l\'inglese al Regno Unito', S.predefinito('pt') === 'br' && S.predefinito('en') === 'uk' && S.predefinito('it') === 'it' && S.predefinito('xx') === 'it');
const backup = s => Dati.backupValido({ v: 1, profilo: { nome: 'Ada', corso: '', cfuTotali: 180, lode: 30, ...(s === undefined ? {} : { sistema: s }) }, esami: [] });
prova('backup vecchio senza sistema: valido', backup(undefined));
prova('backup con un sistema vero: valido', ['it', 'br', 'us', 'de'].every(backup));
prova('backup con un sistema strano: rifiutato', !backup('xx') && !backup(3) && !backup('__proto__'));
prova('profilo senza sistema o con uno strano → Italia', Dati.profiloInForma({ nome: 'A' }).sistema === 'it' && Dati.profiloInForma({ sistema: 'zz' }).sistema === 'it' && Dati.profiloInForma({ sistema: 'br' }).sistema === 'br');
Dati.sostituisci({ v: 1, profilo: { nome: 'Ada', cfuTotali: 180, lode: 30 }, esami: [] });
prova('dati di prima (senza sistema) → Italia', Dati.D.profilo.sistema === 'it' && Dati.D.profilo.nome === 'Ada');
Dati.sostituisci({ v: 1, profilo: { nome: 'Bia', sistema: 'br' }, esami: [] });
prova('il sistema scelto resta', Dati.D.profilo.sistema === 'br');

console.log(`scelta: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
