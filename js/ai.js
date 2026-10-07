// L'AI di Lode. Di base il cervello locale (Ollama + Qwen3.5, installato da Lode): gratis, offline, gli appunti non escono.
// Chi vuole di più mette la chiave del servizio che preferisce e paga a consumo, di solito pochi centesimi a sessione:
// Claude (con gli strumenti: propone carte, esami, voti), oppure un servizio in formato OpenAI (ChatGPT, Gemini, Mistral,
// Groq, OpenRouter, DeepSeek). La chiave resta su questo computer, mai nel vault. Lode non vede né incassa niente.
// Non scrive mai da sola: ogni modifica ai dati arriva come proposta con «Conferma / Annulla».
import { D, cfuFatti, dataLunga, fatti, media, num, oggi, prossimi, daRipassare, lezioni, lezioneOra, sistemaVoti, votoFinale } from './dati.js';
import * as S from './sistemi.js';
import { ESEMPI } from './comandi.js';
import { ESEMPI as ESEMPI_IT } from './comandi/it.js';
import { FORNITORI } from './fornitori.js';
import { t, lingua } from './lingua.js';
import { NOME_INGLESE } from './parole.js';

// La lingua delle risposte: quella della barra. In italiano i prompt restano quelli di sempre, carattere per carattere;
// nelle altre lingue si aggiunge in fondo una riga in inglese (i modelli, anche quelli piccoli, la seguono meglio di una
// riga in italiano), che vale anche se i dati dello studente, il materiale o le istruzioni sono in italiano.
export const inLingua = () => lingua === 'it' ? '' : `\n\nAlways answer in ${NOME_INGLESE[lingua]}, the student's language, even if these instructions, the student's data or the material are in Italian or in another language.`;
// per le risposte strutturate: i testi nella lingua dello studente, ma le chiavi e i valori fissi dello schema (gli esiti
// giusta, parziale… sono codici che legge il codice) restano come sono, e una citazione resta copiata parola per parola
export const inLinguaJSON = () => lingua === 'it' ? '' : `\n\nWrite every text value in ${NOME_INGLESE[lingua]}, the student's language, even where these instructions say Italian. Keep the JSON keys and the fixed values of the schema (enum) exactly as they are, in Italian. A field that asks you to copy words exactly (citazione) stays copied word for word, in the language of the text you copy from.`;
// per le letture (libretto, orario, programma): i nomi restano quelli del testo, mai tradotti
const comeScritti = () => lingua === 'it' ? '' : '\n\nKeep names and titles exactly as they are written in the text, in their original language: do not translate them.';
// gli esiti dell'AI (giusta, parziale, sbagliata, fuori tema, non so) sono codici interni: per lo studente, il testo del catalogo
const NOME_ESITO = { giusta: () => t('contenuti.esito-giusta'), parziale: () => t('contenuti.esito-parziale'), sbagliata: () => t('contenuti.esito-sbagliata'),
  'fuori tema': () => t('contenuti.esito-fuori-tema'), 'non so': () => t('contenuti.esito-non-so') };
export const nomeEsito = e => Object.hasOwn(NOME_ESITO, e) ? NOME_ESITO[e]() : String(e ?? '');

const MODELLO = 'claude-opus-5-5';
const PONTE = typeof window !== 'undefined' ? window.lodeDesktop : null;
let LOCALE = null;
export const impostaLocale = m => { LOCALE = m || null; };
export const modelloLocale = () => LOCALE;

// i servizi (base dell'API, modelli preferiti, dove si crea la chiave) sono in fornitori.js: lo stesso elenco che usa il main
export { FORNITORI };
const ai = () => (D.imp.ai ||= { fornitore: D.imp.chiave ? 'anthropic' : null, modello: '', uso: 'tutto' });
export const fornitore = () => D.imp.chiave ? (ai().fornitore || 'anthropic') : null;
// chi fa il lavoro: 'claude', 'cloud' (un altro servizio con la chiave dello studente), 'locale', o nessuno.
// compito 'testo' = lavori sugli appunti (carte, definizioni, riordino, foto): con «uso: pesante» restano sul computer.
export function motore(compito = 'chat') {
  const f = fornitore(), loc = PONTE && LOCALE ? 'locale' : null;
  if (f && !(compito === 'testo' && ai().uso === 'pesante' && loc)) return f === 'anthropic' ? 'claude' : 'cloud';
  return loc;
}
export const attiva = () => !!motore();
export const nomeMotore = (compito = 'chat') => { const m = motore(compito); return m === 'locale' ? t('ai.modello-locale') : m ? FORNITORI[fornitore()].nome : t('ai.nessuno'); };

/* ---------- Claude: l'API dei messaggi con fetch, senza SDK ---------- */
// Prima l'SDK arrivava da un CDN all'ultima versione: codice di altri, nella finestra con la chiave e il ponte verso il vault.
// Ora sono poche righe nostre: la chiave parte solo verso api.anthropic.com (come con l'SDK nel browser, con l'intestazione
// «direct browser access»). Come l'SDK, riprova due volte quando il servizio è occupato (408, 409, 429, 5xx, 529).
const API_CLAUDE = 'https://api.anthropic.com/v1';
async function claude(percorso, { chiave = D.imp.chiave, corpo, segnale } = {}) {
  if (!chiave) throw new Error(t('ai.manca-chiave'));
  const { betas, ...resto } = corpo || {};   // i «betas» vanno nell'intestazione anthropic-beta, non nel corpo
  const headers = { 'x-api-key': chiave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', ...(corpo ? { 'content-type': 'application/json' } : {}), ...(betas?.length ? { 'anthropic-beta': betas.join(',') } : {}) };
  for (let n = 0; ; n++) {
    const r = await fetch(API_CLAUDE + percorso, { method: corpo ? 'POST' : 'GET', signal: segnale, headers, ...(corpo ? { body: JSON.stringify(resto) } : {}) });
    if (r.ok) return r;
    const testo = await r.text().catch(() => '');
    if (n >= 2 || segnale?.aborted || !(r.status === 408 || r.status === 409 || r.status === 429 || r.status >= 500)) throw erroreHttp(testo, r.status);
    const dopo = Math.min(8, Number(r.headers.get('retry-after')) || 0.5 * 2 ** n);
    await new Promise(ok => setTimeout(ok, dopo * 1000));
  }
}
const creaMessaggio = async corpo => (await claude('/messages', { corpo })).json();
// in streaming (eventi SSE): il testo va a suTesto mentre arriva, alla fine il messaggio intero come lo dà l'API senza
// streaming (blocchi di testo, di ragionamento con la firma, strumenti con l'input JSON ricomposto). Gli eventi che non
// conosciamo si saltano; il blocco «fallback» (Claude passa a un altro modello) resta nel contenuto come gli altri.
async function flussoMessaggio(corpo, { suTesto, segnale } = {}) {
  const r = await claude('/messages', { corpo: { ...corpo, stream: true }, segnale });
  const lettore = r.body.getReader(), dec = new TextDecoder(), json = {};
  let msg = null, resto = '';
  for (; ;) {
    const { done, value } = await lettore.read(); if (done) break;
    resto += dec.decode(value, { stream: true }); const righe = resto.split('\n'); resto = righe.pop();
    for (const riga of righe) {
      if (!riga.startsWith('data:')) continue;
      let x; try { x = JSON.parse(riga.slice(5)); } catch { continue; }
      if (x.type === 'message_start') msg = { ...x.message, content: [] };
      else if (x.type === 'error') throw erroreHttp(JSON.stringify(x), x.error?.type === 'overloaded_error' ? 529 : 0);
      else if (!msg) continue;
      else if (x.type === 'content_block_start') msg.content[x.index] = { ...x.content_block };
      else if (x.type === 'content_block_delta') {
        const b = msg.content[x.index], d = x.delta; if (!b) continue;
        if (d.type === 'text_delta') { b.text = (b.text || '') + d.text; suTesto?.(d.text); }
        else if (d.type === 'input_json_delta') json[x.index] = (json[x.index] || '') + d.partial_json;
        else if (d.type === 'thinking_delta') b.thinking = (b.thinking || '') + d.thinking;
        else if (d.type === 'signature_delta') b.signature = d.signature;
        else if (d.type === 'citations_delta') (b.citations ||= []).push(d.citation);
      }
      // l'input dello strumento: JSON incompleto (streaming dei parametri) → resta {} e valido() lo rifiuta
      else if (x.type === 'content_block_stop' && x.index in json) { try { msg.content[x.index].input = JSON.parse(json[x.index]); } catch { } delete json[x.index]; }
      else if (x.type === 'message_delta') { Object.assign(msg, x.delta || {}); if (x.usage) msg.usage = { ...msg.usage, ...x.usage }; }
    }
  }
  if (!msg) throw new Error(t('ai.claude-muto'));
  msg.content = msg.content.filter(Boolean);
  return msg;
}

export function contesto() {
  const m = media(), p = prossimi();
  if (sistemaVoti() !== 'it') return contestoSistema(m, p);
  const righe = [
    `Oggi è ${dataLunga(oggi())} (${oggi()}).`,
    D.profilo.nome ? `Lo studente si chiama ${D.profilo.nome}${D.profilo.corso ? ` e studia ${D.profilo.corso}` : ''}.` : '',
    `CFU: ${cfuFatti()} su ${D.profilo.cfuTotali}. Media ponderata: ${m.ponderata ? num(m.ponderata, 2) : 'nessun voto'}${m.base ? `, base di laurea ${num(m.base, 1)}/110` : ''}. La lode vale ${D.profilo.lode}.`,
    `Esami sostenuti: ${fatti().map(e => `${e.nome} (${e.cfu} CFU, ${e.idoneita ? 'idoneità' : altroSistema(e) ? votoAltroSistema(e) : e.voto + (e.lode ? ' e lode' : '')})`).join('; ') || 'nessuno'}.`,
    `Prossimi appelli: ${p.map(e => `${e.nome} (${e.cfu} CFU) il ${e.data}`).join('; ') || 'nessuno segnato'}.`,
    `Esami ancora da dare senza data: ${D.esami.filter(e => !e.fatto && !e.data).map(e => e.nome).join('; ') || 'nessuno'}.`,
    `Carte del ripasso: ${D.carte.length}, da ripassare oggi ${daRipassare().length}.`,
    `Orario: ${D.orario.map(o => `${o.corso} (${o.giorni.join(',')} ${o.inizio}-${o.fine})`).join('; ') || 'non impostato'}.${lezioneOra() ? ` Adesso è a lezione di ${lezioneOra().corso}.` : ''}`,
    ...lezioni().slice(0, 3).map(l => `Lezione di ${l.corso} del ${l.data}: ★ da esame: ${(l.stelle || []).join(' | ') || '—'}. Definizioni: ${(l.definizioni || []).map(d => d.t + ' = ' + d.d).join(' | ') || '—'}.${l.appunti ? ` Appunti: ${l.appunti.slice(0, 1500)}` : ''}`),
  ];
  return righe.filter(Boolean).join('\n');
}

// un voto scritto con un altro sistema dei voti (prima di cambiarlo, js/dati.js cambiaSistema): resta com'era e non conta
const altroSistema = e => !!e.sistema && e.voto != null && !e.idoneita && e.sistema !== sistemaVoti();
const votoAltroSistema = e => `${S.formato(e.voto, e.sistema, { lode: e.lode })} nel sistema ${PAESE[S.sistema(e.sistema).cod]}, non conta qui`;
// il paese del sistema dei voti, per i prompt (che restano in italiano: la lingua della risposta la dà inLingua())
const PAESE = { it: 'Italia', es: 'Spagna', fr: 'Francia', de: 'Germania', pt: 'Portogallo', br: 'Brasile', uk: 'Regno Unito', us: 'Stati Uniti' };
// la scala del sistema in parole, per i prompt e per le descrizioni degli strumenti: «da 0 a 10 (un decimale), sufficienza 5»
function scala(s = S.sistema(sistemaVoti())) {
  if (s.cod === 'us') return 'lettere da A a F, salvate come punti GPA (A 4.0, A− 3.7, B+ 3.3, B 3.0, B− 2.7, C+ 2.3, C 2.0, C− 1.7, D+ 1.3, D 1.0, D− 0.7, F 0); la F conta nella media';
  if (s.cod === 'de') return 'da 1,0 (il migliore) a 5,0: 1,0 1,3 1,7 2,0 2,3 2,7 3,0 3,3 3,7 4,0 superano, 5,0 non supera; più basso è meglio';
  if (s.cod === 'uk') return 'percentuale da 0 a 100, sufficienza 40; classi: 70 First, 60 2:1, 50 2:2, 40 Third';
  const dec = s.passo < 1 ? ` (fino a ${s.decimali} decimali)` : '';
  return `da ${s.min} a ${s.max}${dec}, sufficienza ${s.sufficienza}${s.cod === 'es' ? '; la Matrícula de Honor è un 10 con lode' : ''}`;
}
// i dati dello studente fuori dal sistema italiano: crediti, media e voto finale con le etichette e la scala del sistema
function contestoSistema(m, p) {
  const s = S.sistema(sistemaVoti()), cr = S.nomeCrediti(s), f = votoFinale(m);
  const voto = e => e.idoneita ? 'idoneità (superato senza voto)' : altroSistema(e) ? votoAltroSistema(e) : S.formato(e.voto, s, { lode: e.lode });
  const righe = [
    `Oggi è ${dataLunga(oggi())} (${oggi()}).`,
    D.profilo.nome ? `Lo studente si chiama ${D.profilo.nome}${D.profilo.corso ? ` e studia ${D.profilo.corso}` : ''}.` : '',
    `Sistema dei voti: ${PAESE[s.cod]}, ${scala(s)}.`,
    `Crediti (${cr}): ${num(cfuFatti(), cfuFatti() % 1 ? 1 : 0)} su ${D.profilo.cfuTotali}. Media ponderata: ${m.ponderata != null ? num(m.ponderata, 2) : 'nessun voto'}${f ? `, ${S.etichettaFinale(s)} ${S.formatoFinale(f, s)}` : ''}.`,
    `Esami sostenuti: ${fatti().map(e => `${e.nome} (${e.cfu} ${cr}, ${voto(e)})`).join('; ') || 'nessuno'}.`,
    `Prossimi appelli: ${p.map(e => `${e.nome} (${e.cfu} ${cr}) il ${e.data}`).join('; ') || 'nessuno segnato'}.`,
    `Esami ancora da dare senza data: ${D.esami.filter(e => !e.fatto && !e.data).map(e => e.nome).join('; ') || 'nessuno'}.`,
    `Carte del ripasso: ${D.carte.length}, da ripassare oggi ${daRipassare().length}.`,
    `Orario: ${D.orario.map(o => `${o.corso} (${o.giorni.join(',')} ${o.inizio}-${o.fine})`).join('; ') || 'non impostato'}.${lezioneOra() ? ` Adesso è a lezione di ${lezioneOra().corso}.` : ''}`,
    ...lezioni().slice(0, 3).map(l => `Lezione di ${l.corso} del ${l.data}: ★ da esame: ${(l.stelle || []).join(' | ') || '—'}. Definizioni: ${(l.definizioni || []).map(d => d.t + ' = ' + d.d).join(' | ') || '—'}.${l.appunti ? ` Appunti: ${l.appunti.slice(0, 1500)}` : ''}`),
  ];
  return righe.filter(Boolean).join('\n');
}
// in italiano con il sistema italiano: lo studente universitario italiano di sempre. Altrimenti uno studente universitario,
// con il paese del suo sistema dei voti; nelle altre lingue «parli la lingua dello studente» (la riga di inLingua() dice quale)
const italiano = () => lingua === 'it' && sistemaVoti() === 'it';
const chi = () => italiano() ? 'uno studente universitario italiano' : `uno studente universitario (sistema dei voti: ${PAESE[sistemaVoti()]})`;
const parla = () => lingua === 'it' ? 'Parli italiano' : 'Parli la lingua dello studente';
// un comando della barra citato nei prompt, nella lingua scelta: l'esempio allo stesso posto di quello italiano
const comando = it => { const i = ESEMPI_IT.findIndex(x => x[0] === it); return (lingua !== 'it' && ESEMPI?.[i]?.[0]) || it; };
export const sistemaDiBase = () => italiano() ? SISTEMA_IT : SISTEMA_IT.replace('di uno studente universitario italiano.', `di ${chi()}.`).replace('Parli italiano,', `${parla()},`);
const SISTEMA_IT = `Sei Lode, l'assistente di studio che vive in una piccola barra in cima allo schermo di uno studente universitario italiano.
Parli italiano, dai del tu, sei caldo ma asciutto: niente entusiasmi finti, niente emoji.
Le risposte compaiono in un pannello stretto: di solito 1-3 frasi. Quando spieghi un argomento sii un tutor eccellente: intuizione prima, poi la definizione precisa, poi un esempio piccolo; al massimo 150 parole se non ti chiedono di più.
Formattazione: solo **grassetto** e a capo; per gli elenchi usa righe che iniziano con «– ». Formule in testo semplice leggibile (x², ∫, ∂, →), mai LaTeX.
Strumenti: per cambiare i dati (carte, esami, voti) usa SEMPRE lo strumento: lo studente vede una proposta e la conferma. Non dire mai «fatto» prima che lo strumento ti restituisca l'esito.
Carte del ripasso: domande atomiche, una sola idea per carta, risposta corta e verificabile (max 2 frasi), niente domande sì/no. Da un file crea 8-20 carte sui concetti che all'esame chiederebbero davvero.
Se lo studente è in ansia per un esame, rassicuralo con un piano concreto (ore per giorno, cosa ripassare), non con frasi fatte.
Non inventare date, voti o regolamenti dell'ateneo: se non li sai, chiedili.`;

const STRUMENTI = [
  { name: 'crea_carte', description: 'Propone nuove carte del ripasso (flashcard). Lo studente le vede e conferma prima che vengano salvate.',
    input_schema: { type: 'object', additionalProperties: false, required: ['carte'], properties: {
      esame: { type: 'string', description: 'Nome dell\'esame a cui appartengono, come compare nei dati; ometti se nessuno.' },
      carte: { type: 'array', minItems: 1, maxItems: 30, items: { type: 'object', additionalProperties: false, required: ['fronte', 'retro'], properties: { fronte: { type: 'string' }, retro: { type: 'string' } } } } } } },
  { name: 'aggiungi_esame', description: 'Propone di aggiungere un esame da dare (con data dell\'appello se nota).',
    input_schema: { type: 'object', additionalProperties: false, required: ['nome'], properties: { nome: { type: 'string' }, cfu: { type: 'integer', minimum: 1, maximum: 30 }, data: { type: 'string', description: 'YYYY-MM-DD' } } } },
  { name: 'registra_voto', description: 'Propone di registrare il voto di un esame superato (18-30, lode solo con 30).',
    input_schema: { type: 'object', additionalProperties: false, required: ['esame', 'voto'], properties: { esame: { type: 'string' }, voto: { type: 'integer', minimum: 18, maximum: 30 }, lode: { type: 'boolean' } } } },
  { name: 'avvia_focus', description: 'Fa partire subito il timer di concentrazione nella barra (non serve conferma).',
    input_schema: { type: 'object', additionalProperties: false, properties: { minuti: { type: 'integer', minimum: 5, maximum: 180 }, esame: { type: 'string' } } } },
  { name: 'mostra', description: 'Mostra una scheda di Lode nel pannello: libretto (media, base di laurea), esami (prossimi appelli e ore da fare), ripasso (carte di oggi).',
    input_schema: { type: 'object', additionalProperties: false, required: ['scheda'], properties: { scheda: { type: 'string', enum: ['libretto', 'esami', 'ripasso'] }, esame: { type: 'string' } } } },
].map(s => ({ ...s, eager_input_streaming: true }));
// gli strumenti nel sistema dei voti scelto: in Italia quelli di sempre; altrove il voto si scrive come nel sistema
// («8,5», «16/20», «2,3», «A-», «65») e lo legge leggiVoto() di js/sistemi.js, i crediti possono avere i decimali
function strumentiDelSistema() {
  const s = S.sistema(sistemaVoti());
  if (s.cod === 'it') return STRUMENTI;
  const cr = S.nomeCrediti(s);
  return STRUMENTI.map(x => {
    if (x.name === 'registra_voto') return { ...x, description: `Propone di registrare il voto di un esame superato, nel sistema dei voti dello studente (${PAESE[s.cod]}: ${scala(s)}).${s.lode ? ' lode true solo con la Matrícula de Honor (10).' : ''}`,
      input_schema: { type: 'object', additionalProperties: false, required: ['esame', 'voto'], properties: { esame: { type: 'string' }, voto: { type: 'string', description: `Il voto come si scrive nel sistema, per esempio «${S.formato({ es: 8.5, fr: 14, de: 1.7, pt: 16, br: 8.5, uk: 68, us: 3.7 }[s.cod], s)}».` }, ...(s.lode ? { lode: { type: 'boolean' } } : {}) } } };
    if (x.name === 'aggiungi_esame') return { ...x, input_schema: { ...x.input_schema, properties: { ...x.input_schema.properties, cfu: { type: 'number', minimum: 0.5, maximum: 60, description: `Crediti (${cr})` } } } };
    if (x.name === 'mostra') return { ...x, description: `Mostra una scheda di Lode nel pannello: libretto (media, ${S.etichettaFinale(s)}), esami (prossimi appelli e ore da fare), ripasso (carte di oggi).` };
    return x;
  });
}
// il voto dello strumento fuori dall'Italia: il testo («8,5», «A-», «10 MH») diventa il numero del sistema (A− → 3.7)
function inSistema(nome, x) {
  if (nome !== 'registra_voto' || !x || sistemaVoti() === 'it') return x;
  const r = S.leggiVoto(String(x.voto ?? ''), sistemaVoti());
  return r && !r.idoneita ? { ...x, voto: r.voto, lode: !!(r.lode || x.lode) && S.sistema(sistemaVoti()).lode && r.voto === S.sistema(sistemaVoti()).max } : { ...x, voto: null };
}

// controllo minimo degli input (con lo streaming dei parametri il modello può consegnarli incompleti)
function valido(nome, x) {
  if (!x || typeof x !== 'object') return false;
  if (nome === 'registra_voto' && sistemaVoti() !== 'it') return typeof x.esame === 'string' && S.valido(x.voto, sistemaVoti());
  if (nome === 'crea_carte') return Array.isArray(x.carte) && x.carte.length > 0 && x.carte.every(c => typeof c?.fronte === 'string' && typeof c?.retro === 'string' && c.fronte.trim() && c.retro.trim());
  if (nome === 'aggiungi_esame') return typeof x.nome === 'string' && !!x.nome.trim();
  if (nome === 'registra_voto') return typeof x.esame === 'string' && Number.isInteger(x.voto) && x.voto >= 18 && x.voto <= 30;
  if (nome === 'mostra') return ['libretto', 'esami', 'ripasso'].includes(x.scheda);
  return true;
}

// un giro di conversazione con strumenti: testo in streaming, strumenti eseguiti da chi chiama (con le sue conferme)
export async function conversa({ storia, sistema = sistemaDiBase(), strumenti = true, suTesto, esegui, segnale }) {
  for (let giro = 0; giro < 6; giro++) {
    const parametri = {
      model: MODELLO, max_tokens: 32000, system: sistema + '\n\nDati dello studente adesso:\n' + contesto() + inLingua(),
      messages: storia, output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    };
    if (strumenti) parametri.tools = strumentiDelSistema();
    const msg = await flussoMessaggio(parametri, { suTesto, segnale });
    storia.push({ role: 'assistant', content: msg.content });
    if (msg.stop_reason === 'refusal') { suTesto?.('\n\n' + t('ai.rifiuto')); return storia; }
    if (msg.stop_reason !== 'tool_use') return storia;
    const risultati = [];
    for (const b0 of msg.content.filter(b => b.type === 'tool_use')) {
      const b = { ...b0, input: inSistema(b0.name, b0.input) };
      if (!valido(b.name, b.input)) { risultati.push({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: 'Parametri incompleti o non validi: riprova con tutti i campi richiesti.' }); continue; }
      let r; try { r = await esegui(b.name, b.input); } catch (e) { r = { errore: e.message }; }
      risultati.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(r ?? { ok: true }), ...(r?.errore ? { is_error: true } : {}) });
    }
    storia.push({ role: 'user', content: risultati });
  }
  return storia;
}

// l'interrogazione: un professore d'orale, una domanda alla volta, poi un voto onesto
export const SISTEMA_ORALE = nome => `Sei un docente universitario${italiano() ? ' italiano' : ''} che fa l'esame orale di «${nome}». Lo studente si sta esercitando con Lode.
Regole: una domanda alla volta, come all'orale vero, partendo da una domanda di apertura ampia («mi parli di…») e poi approfondendo su ciò che lo studente dice.
Dopo ogni risposta: una riga di valutazione franca (cosa era giusto, cosa mancava o era impreciso, in una frase), poi la domanda successiva.
Breve: massimo 70 parole per turno. Solo **grassetto** come formattazione, niente LaTeX.
Se ti dà materiale (carte o appunti), basa le domande su quello. Dopo 5 domande, o se lo studente dice «basta» o «voto», chiudi con: **Voto: NN/30** e due righe su cosa ripassare prima dell'appello. Sii realistico, non generoso.`;

// i file trascinati diventano blocchi per Claude: PDF e immagini così come sono, il testo come testo
export async function bloccoFile(file) {
  const b64 = async f => { const buf = new Uint8Array(await f.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); };
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await b64(file) }, title: file.name };
  if (/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) return { type: 'image', source: { type: 'base64', media_type: file.type.replace('jpg', 'jpeg'), data: await b64(file) } };
  const testo = await file.text();
  return { type: 'document', source: { type: 'text', media_type: 'text/plain', data: testo.slice(0, 400000) }, title: file.name };
}

/* ---------- il cervello locale ---------- */
const ascolta = new Map();
if (PONTE) PONTE.su('locale:pezzo', ({ id, t }) => ascolta.get(id)?.(t));
async function chatLocale(messaggi, { formato, pezzo, segnale } = {}) {
  const id = Math.random().toString(36).slice(2);
  if (pezzo) ascolta.set(id, pezzo);
  const stop = () => PONTE.invoca('locale:stop', { id }); segnale?.addEventListener('abort', stop);
  try { return await PONTE.invoca('locale:chat', { id, messaggi, formato, modello: LOCALE }); }
  catch (e) { if (segnale?.aborted) { const x = new Error('interrotta'); x.name = 'AbortError'; throw x; } throw e; }
  finally { ascolta.delete(id); segnale?.removeEventListener('abort', stop); }
}
// la conversazione nel formato di Claude diventa quella di Ollama (le foto passano, i PDF no)
function perOllama(storia) {
  return storia.map(m => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content };
    const testi = [], foto = [];
    for (const b of m.content) {
      if (b.type === 'text') testi.push(b.text);
      else if (b.type === 'image') foto.push(b.source.data);
      else if (b.type === 'document' && b.source?.type === 'text') testi.push(`[File ${b.title || ''}]\n${b.source.data.slice(0, 24000)}`);
      else if (b.type === 'document') testi.push(`[Il PDF «${b.title || ''}» il modello locale non lo legge: chiedi allo studente di copiare il testo o una foto delle pagine.]`);
    }
    return { role: m.role, content: testi.join('\n\n'), ...(foto.length ? { images: foto } : {}) };
  });
}
export const sistemaLocale = () => sistemaDiBase().split('\nStrumenti:')[0] + `
Non puoi modificare i dati di Lode: se lo studente vuole salvare carte o definizioni, digli di usare «${comando('chiudi lezione')}» o i comandi della barra.
Non inventare: se non sei sicuro di una definizione o di una formula, dillo.`;
// conversazione senza strumenti: col modello locale o con un servizio in formato OpenAI
export async function conversaLocale({ storia, sistema, suTesto, segnale }) {
  const sis = (sistema || sistemaLocale()) + '\n\nDati dello studente adesso:\n' + contesto() + inLingua();
  const testo = motore('chat') === 'cloud'
    ? await chatCloud([{ role: 'system', content: sis }, ...perOpenAI(storia)], { pezzo: suTesto, segnale })
    : await chatLocale([{ role: 'system', content: sis }, ...perOllama(storia)], { pezzo: suTesto, segnale });
  storia.push({ role: 'assistant', content: [{ type: 'text', text: testo }] });
  return storia;
}
export const conversaSemplice = conversaLocale;

/* ---------- un servizio in formato OpenAI, con la chiave dello studente ---------- */
const ascoltaCloud = new Map();
if (PONTE) PONTE.su('ai:pezzo', ({ id, t }) => ascoltaCloud.get(id)?.(t));
const erroreHttp = (testo, stato) => {
  let m = String(testo || ''); try { const j = JSON.parse(m); m = j.error?.message || j.message || j[0]?.error?.message || m; } catch { }
  const e = new Error(m.slice(0, 240) || t('ai.errore-stato', { stato })); e.status = stato; return e;
};
async function chiamaCloud(corpo, { pezzo, segnale } = {}) {
  const f = FORNITORI[fornitore()], chiave = D.imp.chiave;
  if (!f?.base) throw new Error(t('ai.servizio-sconosciuto'));
  if (PONTE) {
    const id = Math.random().toString(36).slice(2);
    if (pezzo) ascoltaCloud.set(id, pezzo);
    const stop = () => PONTE.invoca('ai:stop', { id }); segnale?.addEventListener('abort', stop);
    try {
      const r = await PONTE.invoca('ai:chat', { id, fornitore: fornitore(), chiave, corpo });   // solo l'id: la base la sceglie il main
      if (r.errore) { if (segnale?.aborted) { const x = new Error('interrotta'); x.name = 'AbortError'; throw x; } throw erroreHttp(r.errore, r.stato); }
      return r;
    } finally { ascoltaCloud.delete(id); segnale?.removeEventListener('abort', stop); }
  }
  // nel browser la chiamata è diretta (qualche servizio non lo permette: allora serve l'app desktop)
  const r = await fetch(f.base + '/chat/completions', { method: 'POST', signal: segnale, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + chiave }, body: JSON.stringify(corpo) });
  if (!r.ok) throw erroreHttp(await r.text().catch(() => ''), r.status);
  if (!corpo.stream) return { json: await r.json() };
  const lettore = r.body.getReader(), dec = new TextDecoder(); let resto = '', tutto = '';
  for (; ;) {
    const { done, value } = await lettore.read(); if (done) break;
    resto += dec.decode(value, { stream: true }); const righe = resto.split('\n'); resto = righe.pop();
    for (const riga of righe) { if (!riga.startsWith('data:')) continue; const d = riga.slice(5).trim(); if (!d || d === '[DONE]') continue; try { const t = JSON.parse(d).choices?.[0]?.delta?.content || ''; if (t) { tutto += t; pezzo?.(t); } } catch { } }
  }
  return { testo: tutto };
}
// la conversazione nel formato di Claude diventa quella OpenAI (le foto passano come immagini, i PDF come testo se c'è)
function perOpenAI(storia) {
  return storia.map(m => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content };
    const parti = [];
    for (const b of m.content) {
      if (b.type === 'text') parti.push({ type: 'text', text: b.text });
      else if (b.type === 'image') parti.push({ type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } });
      else if (b.type === 'document' && b.source?.type === 'text') parti.push({ type: 'text', text: `[File ${b.title || ''}]\n${b.source.data.slice(0, 120000)}` });
      else if (b.type === 'document') parti.push({ type: 'text', text: `[Il PDF «${b.title || ''}» non è leggibile qui: chiedi allo studente il testo o una foto delle pagine.]` });
    }
    return { role: m.role, content: parti.every(x => x.type === 'text') ? parti.map(x => x.text).join('\n\n') : parti };
  });
}
const testoDi = r => r.testo ?? r.json?.choices?.[0]?.message?.content ?? '';
// risposta strutturata: schema JSON se il servizio lo accetta, altrimenti JSON semplice con lo schema nelle istruzioni
async function chatCloud(messaggi, { formato, pezzo, segnale } = {}) {
  const base = { model: ai().modello, messages: messaggi };
  if (!formato) return testoDi(await chiamaCloud({ ...base, stream: !!pezzo }, { pezzo, segnale }));
  const conSchema = [{ role: 'system', content: 'Rispondi solo con un oggetto JSON valido che rispetta questo schema JSON:\n' + JSON.stringify(formato) }, ...messaggi];
  const tentativi = [
    { ...base, response_format: { type: 'json_schema', json_schema: { name: 'risposta', schema: formato } } },
    { ...base, messages: conSchema, response_format: { type: 'json_object' } },
    { ...base, messages: conSchema },
  ];
  let ultimo;
  for (const corpo of tentativi) {
    try { const testo = testoDi(await chiamaCloud(corpo, { segnale })); if (testo.trim()) return testo; ultimo = new Error(t('ai.risposta-vuota')); }   // vuoto: si prova il formato successivo
    catch (e) { ultimo = e; if (e.status !== 400 && e.status !== 422) throw e; }   // formato non supportato: si prova il successivo
  }
  throw ultimo;
}
const leggiJSON = t => { const x = String(t).replace(/^```(?:json)?\s*|\s*```$/g, ''); try { return JSON.parse(x); } catch { const i = x.indexOf('{'), j = x.lastIndexOf('}'); return JSON.parse(x.slice(i, j + 1)); } };
// prima di salvare la chiave: la prova e sceglie il modello (il più adatto tra quelli che la chiave può usare)
export async function provaFornitore(id, chiave) {
  if (id === 'anthropic') { await provaChiave(chiave); return { modelli: [MODELLO], modello: MODELLO }; }
  const f = FORNITORI[id];
  const r = PONTE ? await PONTE.invoca('ai:modelli', { fornitore: id, chiave })
    : await fetch(f.base + '/models', { headers: { authorization: 'Bearer ' + chiave } }).then(async x => x.ok ? { modelli: ((await x.json()).data || []).map(m => String(m.id).replace(/^models\//, '')) } : { errore: await x.text(), stato: x.status });
  if (r.errore) throw erroreHttp(r.errore, r.stato);
  const modelli = r.modelli.filter(m => !/embed|tts|whisper|audio|image|moderation|dall-e|transcribe|realtime|guard|search/i.test(m));
  let modello = null; for (const p of f.preferiti || []) { modello = modelli.filter(m => p.test(m)).sort().reverse()[0]; if (modello) break; }
  return { modelli, modello: modello || modelli[0] || '' };
}
export function collegaFornitore(id, chiave, modello) {
  Object.assign(ai(), { fornitore: id, modello: id === 'anthropic' ? MODELLO : modello });
  D.imp.chiave = chiave;
  try { const c = JSON.parse(localStorage.getItem('lode:chiavi') || '{}'); c[id] = chiave; localStorage.setItem('lode:chiavi', JSON.stringify(c)); } catch { }
}
// «Usa solo il cervello locale»: le chiavi si cancellano davvero da questo computer (quella in uso e quelle dei servizi
// collegati prima, in 'lode:chiavi'; 'lode:chiave' la toglie salva() in dati.js). Restituisce il servizio di prima: nel suo
// account la chiave vale ancora finché lo studente non la revoca, e la scheda glielo dice.
// Passo successivo, non ancora fatto: le chiavi cifrate dal main con safeStorage. Sul Mac, con la firma ad hoc che cambia a
// ogni versione, il portachiavi chiederebbe il permesso dopo ogni aggiornamento; su Linux senza portachiavi safeStorage
// ricade su «basic_text», quasi in chiaro (va controllato getSelectedStorageBackend() e detto allo studente).
export function scollegaFornitore() {
  const prima = fornitore();
  D.imp.chiave = ''; ai().fornitore = null;
  try { localStorage.removeItem('lode:chiavi'); } catch { }
  return prima;
}
export const chiaveSalvata = id => { try { return JSON.parse(localStorage.getItem('lode:chiavi') || '{}')[id] || ''; } catch { return ''; } };
export const impostaUso = u => { ai().uso = u === 'pesante' ? 'pesante' : 'tutto'; };
export const statoAI = () => ({ ...ai(), fornitore: fornitore(), locale: LOCALE });

/* ---------- compiti con risposta strutturata (Claude o locale) ---------- */
const SCHEMA_LEZIONE = { type: 'object', additionalProperties: false, required: ['definizioni', 'da_esame'], properties: {
  definizioni: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['termine', 'definizione'], properties: { termine: { type: 'string' }, definizione: { type: 'string' } } } },
  da_esame: { type: 'array', items: { type: 'string' } } } };
const SCHEMA_CARTE = { type: 'object', additionalProperties: false, required: ['carte'], properties: {
  carte: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['fronte', 'retro'], properties: { fronte: { type: 'string' }, retro: { type: 'string' } } } } } };
async function strutturato(istruzioni, contenuto, schema, compito = 'testo') {
  const m = motore(compito), parti = [...(Array.isArray(contenuto) ? contenuto : [{ type: 'text', text: contenuto }]), { type: 'text', text: istruzioni }];
  if (m === 'claude') {
    const r = await creaMessaggio({ model: MODELLO, max_tokens: 16000, output_config: { effort: 'low', format: { type: 'json_schema', schema } }, messages: [{ role: 'user', content: parti }] });
    if (r.stop_reason === 'refusal') throw new Error(t('ai.claude-declina'));
    return JSON.parse(r.content.find(b => b.type === 'text')?.text || '{}');
  }
  if (m === 'cloud') return leggiJSON(await chatCloud(perOpenAI([{ role: 'user', content: parti }]), { formato: schema }));
  if (m === 'locale') return JSON.parse(await chatLocale(perOllama([{ role: 'user', content: parti }]), { formato: schema }));
  throw new Error(t('ai.serve-ai'));
}
// «chiudi lezione»: dagli appunti grezzi alle definizioni e alle cose da esame, solo ciò che c'è davvero negli appunti
export async function estraiLezione({ corso, appunti, gia = [] }) {
  const r = await strutturato(`Sei l'assistente di ${chi()}. Qui sopra ci sono i suoi appunti della lezione di «${corso}».
Estrai:
- definizioni: i concetti definiti o spiegati negli appunti, con una definizione corta (massimo 25 parole), fedele agli appunti, in italiano. Termini brevi. Niente concetti che negli appunti non ci sono.${gia.length ? ` Salta questi, li ha già: ${gia.join(', ')}.` : ''}
- da_esame: SOLO le frasi in cui gli appunti dicono esplicitamente che il prof la chiederà all'esame o che è importante (parole come «esame», «importante», «ricordatevi», «attenzione»). Riformulate in breve. Se gli appunti non lo dicono, lista vuota.` + inLinguaJSON(), `Appunti di ${corso}:\n\n${appunti}`, SCHEMA_LEZIONE);
  // i modelli piccoli tendono a vedere «cose da esame» ovunque: al massimo tante quante le volte che gli appunti lo dicono
  const segnali = appunti.split(/(?<=[.!?\n])\s+/).filter(f => /esame|important|ricordat|attenzione|lo chiede|chiede sempre|domanda sicura/i.test(f)).length;
  const visti = new Set(gia.map(t => t.toLowerCase().trim()));
  const definizioni = (r.definizioni || []).filter(d => { const k = d.termine?.toLowerCase().trim(); if (!k || !d.definizione?.trim() || visti.has(k)) return false; visti.add(k); return true; }).slice(0, 15);
  return { definizioni, daEsame: (r.da_esame || []).filter(Boolean).slice(0, Math.min(5, segnali)) };
}
// «Riordina»: dalla trascrizione grezza della lezione ad appunti da studiare. A pezzi (il modello locale ha poco contesto):
// ogni pezzo diventa una parte con titolo, punti chiari e formule in LaTeX; niente che il prof non abbia detto.
export async function riordina({ corso, testo, appunti = '', avanza, fonte = 'lezione' }) {
  const M = motore('testo'), parole = String(testo).split(/\s+/), passo = M === 'claude' || M === 'cloud' ? 9000 : 1400, pezzi = [];
  for (let i = 0; i < parole.length; i += passo) pezzi.push(parole.slice(i, i + passo).join(' '));
  const istr = (k, n) => fonte === 'documento' ? `Questa è ${n > 1 ? `la parte ${k} di ${n} del` : 'il'} testo di un documento di studio (slide o dispense) del corso «${corso}».` : `Questa è ${n > 1 ? `la parte ${k} di ${n} della` : 'la'} trascrizione automatica di una lezione universitaria di «${corso}» (contiene errori di trascrizione; le formule dette a voce sono già in LaTeX tra $…$).`;
  const istr2 = (k, n) => istr(k, n) + `

Trasformalo in appunti da studiare, in italiano:
- un titolo per ogni argomento, con «### »;
- punti brevi e chiari con «- », nell'ordine della lezione;
- formule in LaTeX tra $…$ (Obsidian le mostra), correggendo quelle trascritte male se il senso è chiaro;
- in **grassetto** i termini definiti;
- niente che non sia nel testo; se un pezzo è incomprensibile, saltalo.
Rispondi solo con gli appunti, senza introduzioni.` + inLingua();
  const out = [];
  for (const [k, pezzo] of pezzi.entries()) {
    avanza?.(k / pezzi.length);
    const contenuto = `Trascrizione:\n\n${pezzo}${k === 0 && appunti ? `\n\nAppunti presi a mano dallo studente (per orientarti):\n${appunti}` : ''}`;
    const dom = contenuto + '\n\n' + istr2(k + 1, pezzi.length);
    if (M === 'claude') {
      const r = await creaMessaggio({ model: MODELLO, max_tokens: 16000, output_config: { effort: 'low' }, messages: [{ role: 'user', content: dom }] });
      out.push(r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim());
    } else if (M === 'cloud') out.push((await chatCloud([{ role: 'user', content: dom }])).trim());
    else if (M === 'locale') out.push((await chatLocale(perOllama([{ role: 'user', content: dom }]))).trim());
    else throw new Error(t('ai.serve-ai'));
  }
  avanza?.(1);
  return out.join('\n\n').replace(/^#{1,2}\s/gm, '### ');
}

// la foto della lavagna (o di una pagina) diventa appunti: testo fedele, formule in LaTeX, schemi descritti a parole
export async function trascriviFoto({ blocco, corso }) {
  const istr = `È una foto di una lavagna o di una pagina di appunti${corso ? ` della lezione di «${corso}»` : ''}. Trascrivila in appunti Markdown in italiano, fedeli a ciò che si vede: titoli con «### », punti con «- », formule in LaTeX tra $…$ (Obsidian le mostra), grafici e schemi descritti in una riga tra parentesi quadre. Se una parte è illeggibile scrivi [illeggibile]. Solo gli appunti, senza introduzioni.` + inLingua();
  const M = motore('testo'), msg = [{ role: 'user', content: [blocco, { type: 'text', text: istr }] }];
  if (M === 'claude') { const r = await creaMessaggio({ model: MODELLO, max_tokens: 16000, output_config: { effort: 'low' }, messages: msg }); return r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim(); }
  if (M === 'cloud') return (await chatCloud(perOpenAI(msg))).trim();
  if (M === 'locale') return (await chatLocale(perOllama(msg))).trim();
  throw new Error(t('ai.serve-ai'));
}
// un documento (slide, dispense, PDF) diventa un riassunto da studiare, a pezzi come la trascrizione
export async function riassumi({ corso, testo, nome, avanza }) {
  return riordina({ corso: corso || nome, testo: `[Documento «${nome}»]\n${testo}`, avanza, fonte: 'documento' });
}

// setup veloce: il libretto incollato dal portale dell'ateneo e l'orario incollato dal sito
const SCHEMA_LIBRETTO = { type: 'object', additionalProperties: false, required: ['esami'], properties: { esami: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nome', 'cfu', 'voto', 'lode', 'idoneita', 'data'], properties: {
  nome: { type: 'string' }, cfu: { type: 'integer' }, voto: { type: ['integer', 'null'] }, lode: { type: 'boolean' }, idoneita: { type: 'boolean' }, data: { type: ['string', 'null'], description: 'YYYY-MM-DD' } } } } } };
// fuori dall'Italia: il voto come è scritto (testo), letto poi con leggiVoto() nel sistema scelto; crediti anche con i decimali
const SCHEMA_LIBRETTO_SISTEMA = { type: 'object', additionalProperties: false, required: ['esami'], properties: { esami: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nome', 'cfu', 'voto', 'idoneita', 'data'], properties: {
  nome: { type: 'string' }, cfu: { type: ['number', 'null'] }, voto: { type: ['string', 'null'] }, idoneita: { type: 'boolean' }, data: { type: ['string', 'null'], description: 'YYYY-MM-DD' } } } } } };
export async function leggiLibretto(testo, sistema = sistemaVoti()) {
  const s = S.sistema(sistema);
  if (s.cod !== 'it') {
    const r = await strutturato(`Qui sopra c'è il libretto universitario (transcript) di uno studente, copiato da un portale, con tanto testo inutile. Il sistema dei voti è quello di ${PAESE[s.cod]}: ${scala(s)}. Estrai SOLO gli esami superati: nome dell'insegnamento (senza codici), crediti (${S.nomeCrediti(s)}, null se non ci sono), il voto copiato come è scritto (per esempio «8,5», «16/20», «2,3», «A-», «68», «Matrícula de Honor»), idoneita true se è superato senza voto, data in formato YYYY-MM-DD. Ignora gli esami non ancora sostenuti o senza esito.` + comeScritti(), `Libretto:\n${String(testo).slice(0, 30000)}`, SCHEMA_LIBRETTO_SISTEMA);
    return (r.esami || []).flatMap(e => {
      if (typeof e.nome !== 'string' || !e.nome.trim()) return [];
      const v = e.idoneita ? { voto: null, lode: false, idoneita: true } : S.leggiVoto(String(e.voto ?? ''), s);
      if (!v || (!v.idoneita && !s.bocciatiInMedia && !S.superato(v.voto, s))) return [];
      const cfu = Number(e.cfu);
      return [{ nome: e.nome.trim(), cfu: Number.isFinite(cfu) && cfu > 0 ? cfu : s.esame, voto: v.idoneita ? null : v.voto, lode: !!v.lode, idoneita: !!v.idoneita, data: /^\d{4}-\d\d-\d\d$/.test(e.data || '') ? e.data : null }];
    });
  }
  const r = await strutturato('Qui sopra c\'è il libretto universitario di uno studente italiano, copiato da un portale (Esse3 o simili), con tanto testo inutile. Estrai SOLO gli esami superati: nome dell\'insegnamento (senza codici), CFU, voto da 18 a 30 (lode true se «30 e lode» o «30L»), idoneita true se è un\'idoneità senza voto, data in formato YYYY-MM-DD. Ignora gli esami non ancora sostenuti o senza esito.' + comeScritti(), `Libretto:\n${String(testo).slice(0, 30000)}`, SCHEMA_LIBRETTO);
  // cfu e voto diventano numeri: il modello può rispondere con una stringa, e i valori finiscono nelle pagine
  return (r.esami || []).filter(e => typeof e.nome === 'string' && e.nome.trim() && (e.idoneita || (+e.voto >= 18 && +e.voto <= 30))).map(e => ({ ...e, nome: e.nome.trim(), cfu: Number(e.cfu) || 6, voto: e.idoneita ? null : Math.round(+e.voto), lode: !!e.lode, idoneita: !!e.idoneita, data: /^\d{4}-\d\d-\d\d$/.test(e.data || '') ? e.data : null }));
}
const SCHEMA_ORARIO = { type: 'object', additionalProperties: false, required: ['lezioni'], properties: { lezioni: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['corso', 'giorni', 'inizio', 'fine', 'aula'], properties: {
  corso: { type: 'string' }, giorni: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, description: '0 domenica, 1 lunedì … 6 sabato' }, inizio: { type: 'string', description: 'HH:MM' }, fine: { type: 'string', description: 'HH:MM' }, aula: { type: 'string' } } } } } };
export async function leggiOrario(testo) {
  const r = await strutturato(`Qui sopra c'è l'orario settimanale delle lezioni di ${chi()}, copiato da un sito. Estrai ogni insegnamento con i giorni della settimana (0 domenica, 1 lunedì … 6 sabato), ora di inizio e fine in formato HH:MM e aula (stringa vuota se non c'è). Un insegnamento che si ripete negli stessi orari in più giorni va in una sola voce con più giorni.` + comeScritti(), `Orario:\n${String(testo).slice(0, 20000)}`, SCHEMA_ORARIO);
  const ora = x => /^\d{1,2}[:.]\d\d$/.test(x || '') ? x.replace('.', ':').padStart(5, '0') : null;
  return (r.lezioni || []).map(l => ({ corso: l.corso?.trim(), giorni: [...new Set(l.giorni || [])].filter(g => g >= 0 && g <= 6), inizio: ora(l.inizio), fine: ora(l.fine), aula: (l.aula || '').trim() })).filter(l => l.corso && l.giorni.length && l.inizio && l.fine);
}

export async function carteDa(blocchi) {
  const r = await strutturato('Crea da 8 a 20 carte del ripasso da questo materiale: una sola idea per carta, domanda precisa, risposta corta (massimo 2 frasi), in italiano. Solo concetti presenti nel materiale.' + inLinguaJSON(), blocchi, SCHEMA_CARTE);
  return (r.carte || []).filter(c => c.fronte?.trim() && c.retro?.trim()).slice(0, 30);
}

/* ---------- l'orale guidato ----------
   Il filo lo tiene il codice (lode.js): quante domande, quando si giudica, il voto. Il modello fa un compito stretto alla
   volta, con risposta strutturata. Così anche un modello piccolo non risponde al posto dello studente, non dà il voto dopo
   una domanda e si accorge di una risposta fuori tema. */
const SCHEMA_DOMANDA = { type: 'object', additionalProperties: false, required: ['domanda', 'argomento'], properties: { domanda: { type: 'string' }, argomento: { type: 'string' } } };
// esito prima del giudizio: provato col modello locale, il giudizio scritto prima rende un modello piccolo pignolo
// (trova sempre «qualcosa che manca», anche nelle risposte giuste)
const SCHEMA_VERIFICA = { type: 'object', additionalProperties: false, required: ['detta', 'citazione'], properties: { detta: { type: 'boolean' }, citazione: { type: 'string' } } };
const SCHEMA_GIUDIZIO = { type: 'object', additionalProperties: false, required: ['esito', 'giudizio', 'mancava'], properties: {
  esito: { type: 'string', enum: ['giusta', 'parziale', 'sbagliata', 'fuori tema', 'non so'] }, giudizio: { type: 'string' }, mancava: { type: 'string' } } };
const materialeOrale = m => m ? `Materiale dello studente (basati su questo):\n${String(m).slice(0, 12000)}` : `Dati dello studente:\n${contesto()}`;
// il programma d'esame (js/programma.js) quando il testo è lungo o disordinato: gli argomenti in ordine, con le loro voci
const SCHEMA_PROGRAMMA = { type: 'object', additionalProperties: false, required: ['argomenti'], properties: {
  argomenti: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['titolo', 'voci'], properties: { titolo: { type: 'string' }, voci: { type: 'array', items: { type: 'string' } } } } } } };
export async function leggiProgramma({ nome, testo }) {
  const r = await strutturato(`Qui sopra c'è il programma (o la scheda) del corso «${nome}». Elenca gli argomenti del programma d'esame, nell'ordine in cui compaiono:
- titolo: da 2 a 8 parole, con le parole del programma;
- voci: i sotto-argomenti che il programma scrive per quell'argomento (anche nessuno), corti.
Da 4 a 30 argomenti. Solo quello che c'è scritto nel programma: niente testi consigliati, modalità d'esame, obiettivi, orari, prerequisiti.` + comeScritti(), String(testo).slice(0, 40000), SCHEMA_PROGRAMMA);
  return (r.argomenti || []).map(a => ({ t: String(a.titolo || '').trim(), sotto: (a.voci || []).map(x => String(x).trim()).filter(Boolean).slice(0, 12) })).filter(a => a.t).slice(0, 40);
}
// il quiz a crocette (js/crocette.js): il modello scrive le domande, il codice tiene solo quelle che il materiale dimostra
const SCHEMA_CROCETTE = { type: 'object', additionalProperties: false, required: ['domande'], properties: {
  domande: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['domanda', 'opzioni', 'giusta', 'citazione', 'spiegazione'], properties: {
    domanda: { type: 'string' }, opzioni: { type: 'array', items: { type: 'string' } }, giusta: { type: 'integer' }, citazione: { type: 'string' }, spiegazione: { type: 'string' } } } } } };
export async function crocette({ nome, materiale, n = 10, fatte = [] }) {
  const r = await strutturato(`Sei il docente di «${nome}» e scrivi lo scritto a crocette. Dal materiale qui sopra crea ${n} domande a risposta multipla, in italiano:
- domanda: chiara, su un concetto del materiale, che si risolve in meno di un minuto;
- opzioni: esattamente 4, una sola giusta; le sbagliate plausibili (errori tipici di chi ha studiato male) ma sicuramente false secondo il materiale; lunghezze simili; mai «tutte le precedenti» o «nessuna delle precedenti»;
- giusta: la posizione (0, 1, 2 o 3) della risposta giusta in opzioni;
- citazione: copia IDENTICA dal materiale la frase che dimostra la risposta giusta (almeno 8 parole di fila);
- spiegazione: una frase che dice perché è giusta.
Domande su punti diversi del materiale.${fatte.length ? ` Non ripetere queste, già fatte: ${fatte.slice(-30).join(' | ')}.` : ''}` + inLinguaJSON(), `Materiale:\n${String(materiale).slice(0, 24000)}`, SCHEMA_CROCETTE);
  return r.domande || [];
}
export async function domandaOrale({ nome, materiale, fatte = [], argomento = '' }) {
  const r = await strutturato(`Sei un docente universitario${italiano() ? ' italiano' : ''} all'esame orale di «${nome}». Fai UNA sola domanda d'orale, come la farebbe un prof: chiara, su un concetto importante del materiale qui sopra, a cui si risponde a voce in 3-4 frasi.${argomento ? ` La domanda deve essere sull'argomento del programma «${argomento}». Se qui sopra ci sono domande uscite agli appelli, fanne una come quelle, con parole tue.` : ''}${fatte.length ? ` Non ripetere ${argomento ? 'domande già fatte' : 'questi argomenti, già chiesti'}: ${fatte.join('; ')}.` : argomento ? '' : ' È la prima domanda: un argomento centrale del corso.'}
Rispondi solo con la domanda (massimo 30 parole, dai del tu) e l'argomento in 2-4 parole. Niente saluti, niente giudizi.` + inLinguaJSON(), materialeOrale(materiale), SCHEMA_DOMANDA, 'chat');
  return { domanda: String(r.domanda || '').trim(), argomento: String(r.argomento || '').trim() };
}
export async function giudicaRisposta({ nome, domanda, argomento = '', risposta, materiale }) {
  const r = await strutturato(`Sei un docente universitario${italiano() ? ' italiano' : ''} all'esame orale di «${nome}», severo ma giusto.
Domanda che hai fatto: «${domanda}»
Risposta dello studente: «${risposta}»
Giudica SOLO questa risposta a QUESTA domanda:
- esito: «giusta» (completa e corretta), «parziale» (quello che dice è corretto ma è incompleto o vago), «sbagliata» (contiene almeno un'affermazione falsa), «fuori tema» (parla d'altro rispetto alla domanda, anche se quello che dice è vero), «non so» (lo studente non sa o non risponde);
  se non c'è niente di falso ma manca qualcosa, è «parziale», non «sbagliata»;
  una risposta corretta detta con parole diverse dal materiale, o con un metodo equivalente (per esempio gli autovalori al posto dei segni dei minori), è «giusta»: non pretendere la formulazione del materiale e non chiedere cose che la domanda non chiede;
- giudizio: una frase rivolta allo studente (dagli del tu), massimo 25 parole, concreta: cosa era giusto, cosa no;
- mancava: la cosa più importante che mancava o andava corretta, massimo 20 parole, SOLO se è scritta nel materiale qui sopra; altrimenti stringa vuota.
Usa il materiale qui sopra come riferimento. Non inventare ipotesi o condizioni di cui non sei sicuro: meglio dire meno.` + inLinguaJSON(), materialeOrale(materiale), SCHEMA_GIUDIZIO, 'chat');
  let esito = ['giusta', 'parziale', 'sbagliata', 'fuori tema', 'non so'].includes(r.esito) ? r.esito : 'parziale';
  const base = { esito, giudizio: r.giudizio, mancava: r.mancava, risposta };
  // le correzioni del giudizio (correggiGiudizio, mancanze) leggono frasi italiane: solo in italiano. Nelle altre lingue
  // l'esito resta quello del modello e si controlla solo il «mancava», con la citazione (che non dipende dalla lingua)
  const it = lingua === 'it';
  let c = it ? correggiGiudizio(base) : { esito, giudizio: String(r.giudizio || '').trim(), mancava: String(r.mancava || '').trim() };
  // le mancanze rimaste si controllano una per una con una domanda stretta («l'ha già detto? copia le sue parole»);
  // il «sì» del modello vale solo se la frase copiata c'è davvero nella risposta e parla della stessa cosa
  const smentite = [];
  for (const x of [...(it ? mancanze(c.giudizio) : []), c.mancava].filter(Boolean).slice(0, 2)) {
    try {
      const v = await strutturato(`Domanda dell'orale: «${domanda}»
Risposta dello studente: «${risposta}»
Il correttore ha scritto che nella risposta manca: «${x}».
Controlla solo questo: lo studente l'ha già detto, anche con parole diverse? Se sì, in citazione copia IDENTICHE le parole della sua risposta che lo dicono; se no, citazione vuota.` + inLinguaJSON(), [], SCHEMA_VERIFICA, 'chat');
      if (v.detta && citazioneValida(v.citazione, x, risposta)) smentite.push(x);
    } catch { }
  }
  if (smentite.length) c = it ? correggiGiudizio({ ...base, smentite }) : { ...c, mancava: smentite.includes(c.mancava) ? '' : c.mancava };
  // il «mancava» si mostra solo se viene dal materiale dello studente (vedi dalMateriale): senza materiale, o se il modello
  // lo scrive a memoria, un modello piccolo sbaglia; allora in «Da ripassare» resta solo l'argomento
  return { esito: c.esito, giudizio: c.giudizio, mancava: materiale && dalMateriale(c.mancava, materiale, [argomento, domanda]) ? c.mancava : '' };
}
// la frase del modello viene dal materiale se UN pezzo del materiale (una riga col trattino o con «→», cioè una carta, una
// definizione, una ★; nel testo libero 3 righe di fila) parla dell'argomento della domanda, ha quasi tutte le sue parole
// piene e TUTTE le parole che cambiano il senso (prime/seconde, numeri, sempre/mai/non, positiva/negativa, miste…), al loro posto.
// Prima bastavano le parole sparse in tutto il materiale: «la condizione di continuità delle derivate seconde nell'intorno»
// per Green (falso: bastano le derivate prime) passava con le parole della carta di Schwarz
// le parole delle sei lingue (senza accenti, come le dà piana()): prima le italiane di sempre, poi le altre, mai parole
// italiane piene, così in italiano i controlli restano quelli di prima
const GENERICHE = new Set(('teorema teoremi definizione enunciato dimostrazione dimostrare proprieta formula formule concetto regola metodo criterio esempio'
  + ' theorem theorems definition definitions statement proof property properties concept rule method criterion example'
  + ' teoremas definicion demostracion demostrar propiedad propiedades concepto regla ejemplo'
  + ' theoreme theoremes enonce demonstration demontrer propriete proprietes regle methode exemple'
  + ' satz satze definitionen aussage beweis beweisen eigenschaft eigenschaften begriff regel methode kriterium beispiel'
  + ' definicao demonstracao demonstrar propriedade propriedades conceito regra exemplo').split(' '));
const NUMERI = /^(?:zero|due|tre|quattro|cinque|dieci|cento|\d+|two|three|four|five|ten|hundred|dos|tres|cuatro|cinco|diez|cien|deux|trois|quatre|cinq|dix|zwei|drei|vier|funf|zehn|hundert|dois|duas|quatro|dez|cem)$/;
const DISTINTIVE = [/^(?:prim[oaie]|first|primer[oa]?s?|premiere?s?|erste[nmrs]?|primeir[oa]s?)$/, /^(?:second[oaie]|seconds?|segund[oa]s?|secondes?|zweite[nmrs]?)$/,
  /^(?:terz[oaie]|third|tercer[oa]?s?|troisiemes?|dritte[nmrs]?|terceir[oa]s?)$/, /^(?:quart[oaie]|fourth|cuart[oa]s?|quatriemes?|vierte[nmrs]?|quart[oa]s)$/,
  /^(?:ogni|every|each|cada|chaque|jede[nmrs]?)$/, /^(?:tutt[oaie]|todos|todas|tous|toutes|allen|aller|alles)$/, /^(?:nessun[oa]?|none|ningun[oa]?|aucune?|keine[nmrs]?|nenhuma?)$/, /^(?:almeno|least|mindestens)$/,
  /^(?:esattamente|exactly|exactamente|exactement|genau|exatamente)$/, /^(?:unic(?:[oa]|i|he)|unique|unicos?|unicas?|einzige[nmrs]?)$/, /^(?:sempre|always|siempre|toujours|immer)$/, /^(?:mai|never|nunca|jamais|niemals|nie)$/,
  /^(?:solo|soltanto|unicamente|esclusivamente|only|seulement|uniquement|nur|apenas|somente)$/, /^(?:non|not|nicht|nao)$/, /^positi[vf]/, /^negati[vf]/,
  /^(?:maggior[ei]|greater|larger|mayor(?:es)?|superieure?s?|grosser|maior(?:es)?)$/, /^(?:minor[ei]|smaller|lesser|menor(?:es)?|inferieure?s?|kleiner)$/, /^(?:mist[oaie]|mixed|mixt[oa]s?|mixtes?|gemischte?[nmrs]?)$/];
// i numeri devono essere proprio quelli; le altre basta che siano della stessa famiglia (seconde ~ secondo, positiva ~ positivamente)
const segno = w => NUMERI.test(w) ? w : DISTINTIVE.findIndex(r => r.test(w));
const fila = s => parolePiane(s).filter(w => (w.length >= 4 && !VUOTE.has(w)) || segno(w) !== -1);
const uguale = (x, w) => segno(w) !== -1 ? segno(x) === segno(w) : x.startsWith(radice(w));
// ogni parola distintiva della frase c'è nel pezzo, e vicino (al più 2 parole piene) alla parola più vicina, prima e dopo,
// che il pezzo ha anche lui: «definita positiva vuol dire massimo» non passa con «definita positiva → minimo, … → massimo»
const vicine = (cosa, pezzo) => {
  const c = fila(cosa), p = fila(pezzo), dove = w => p.flatMap((x, i) => uguale(x, w) ? [i] : []);
  return c.every((d, i) => {
    if (segno(d) === -1) return true;
    const qui = dove(d);
    if (!qui.length) return false;
    const accanto = verso => { for (let j = i + verso; j >= 0 && j < c.length; j += verso) { const la = dove(c[j]); if (la.length) return la; } return null; };
    return [accanto(-1), accanto(1)].every(la => !la || la.some(j => qui.some(k => j !== k && Math.abs(j - k) <= 2)));
  });
};
const pezzi = materiale => {
  const righe = String(materiale || '').split('\n').map(r => r.trim()).filter(Boolean), out = []; let testo = [];
  const chiudi = () => { for (let i = 0; i < Math.max(1, testo.length - 2); i++) if (testo.length) out.push(testo.slice(i, i + 3).join('\n')); testo = []; };
  for (const r of righe) if (/^[–\-•*★]|→/.test(r)) { chiudi(); out.push(r); } else testo.push(r);
  chiudi(); return out;
};
export function dalMateriale(cosa, materiale, tema = []) {
  if (!piene(cosa).length) return false;
  const t = [tema].flat().map(x => piene(x).filter(w => !GENERICHE.has(w))).find(x => x.length) || [];
  return pezzi(materiale).some(p => (!t.length || t.filter(w => piana(p).includes(radice(w))).length >= Math.ceil(t.length / 2))
    && coperte(cosa, p) >= .6 && vicine(cosa, p));
}
// Le correzioni del codice al giudizio del modello (provate con Qwen3.5 4B, che a volte scrive «hai omesso i casi
// semidefiniti» a chi li ha appena nominati):
// 1. una mancanza che lo studente ha detto davvero (le sue parole sono nella risposta) si toglie dal giudizio e dal «mancava»;
//    se era l'unico motivo del «parziale», la risposta è giusta;
// 2. l'esito non può contraddire il giudizio scritto: un errore non è «parziale», una mancanza vera non è «giusta».
const VUOTE = new Set(('della delle dello degli nella nelle nello negli sulla sulle sullo dalla dalle alla alle allo agli questo questa questi queste quello quella quelli anche come quando perche molto sempre tutto tutti tutte ogni caso casi cosa cose ruolo fatto modo parte solo loro sono essere dire detto nell dell sull dall quell niente nulla importante proprio bene specificare precisare menzionare citare indicare spiegare'
  + ' that this these those with from have about also very into what when which their there they them been were will would should could must cases thing things role part only nothing important mention explain specify'
  + ' esto esta estos estas ese esos esas aquel tambien muy cuando porque todo todos todas cada cosas papel hecho solo nada importante mencionar explicar especificar'
  + ' cette ceux celles dans pour avec aussi tres quand parce tout tous toutes chaque chose choses role fait seul rien important mentionner expliquer preciser'
  + ' diese dieser dieses diesen auch sehr wenn weil alle jede jeder fall falle sache rolle teil nicht nichts wichtig nennen erklaren angeben einer einem einen eine sind wird werden haben'
  + ' isso isto esses essas aquele tambem muito porque cada coisa coisas papel feito nada importante mencionar explicar especificar pela pelos pelas').split(' '));
const piana = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const radice = w => w.length <= 5 ? w : w.slice(0, Math.max(5, Math.ceil(w.length * .6)));
// la cosa che «manca» è già nella risposta? (almeno 3 parole piene su 4 ci sono, con la radice: semidefiniti ~ semidefinita)
const piene = s => piana(s).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !VUOTE.has(w));
const coperte = (cosa, testo) => { const p = piene(cosa), t = piana(testo); return p.length ? p.filter(w => t.includes(radice(w))).length / p.length : 0; };
export function giaDetto(cosa, risposta) { return coperte(cosa, risposta) >= .75; }
// la frase copiata dal modello è davvero dello studente (almeno 4 parole di fila, o tutta se è più corta) e parla della
// cosa che «manca» (almeno metà delle sue parole piene): il modello piccolo dice «sì» a tutto e cita frasi a caso
const parolePiane = s => piana(s).split(/[^a-z0-9]+/).filter(Boolean);
export function citazioneValida(cit, cosa, risposta) {
  const c = parolePiane(cit), r = ' ' + parolePiane(risposta).join(' ') + ' ', k = Math.min(4, c.length);
  if (c.length < 3) return false;
  let vera = false; for (let i = 0; i + k <= c.length && !vera; i++) vera = r.includes(' ' + c.slice(i, i + k).join(' ') + ' ');
  return vera && coperte(cosa, cit) >= .5;
}
// le cose che il giudizio dice mancanti («hai omesso X», «manca X»)
export const mancanze = g => [...String(g || '').matchAll(MANCANZA)].map(m => m[1].trim());
const MANCANZA = /(?:hai omesso(?: di (?:menzionare|dire|citare|parlare d\w*|spiegare))?|non hai (?:menzionato|detto|citato|spiegato|parlato d\w*)|hai dimenticato(?: di (?:menzionare|dire|citare|spiegare))?|(?:ti )?manca(?:va|no|vano)?)\s+([^.;]+)/gi;
const CONNETTIVI = /(,?\s+)(?=(?:ma|però|solo che|anche se|tuttavia|eccetto|tranne)\s)/i;
const NIENTE = /\bnon (?:ti )?manca(?:va)? (?:niente|nulla)\b|\bniente da (?:correggere|aggiungere)\b|\bnessun errore\b/g;
const NEGATIVO = /\b(sbagliat\w*|errat\w*|hai dimenticato|dimenticat\w*|manca\w*|omess\w*|non hai (?:menzionato|detto|citato|spiegato)|incomplet\w*|vag[ao]|impreci\w*|però|dovresti|avresti)\b/;
export function correggiGiudizio({ esito, giudizio, mancava, risposta, smentite = [] }) {
  let tolte = 0;
  const sm = new Set(smentite.map(x => piana(x).trim())), falsa = x => giaDetto(x, risposta) || sm.has(piana(x).trim());
  const frasi = String(giudizio || '').trim().split(/(?<=[.;!?])\s+/).map(f => {
    // pezzi della frase con i loro separatori («, ma», « però»…): si toglie il pezzo falso col separatore che lo precede
    const t = f.split(CONNETTIVI); let s = '';
    for (let i = 0; i < t.length; i += 2) {
      const m = [...t[i].matchAll(MANCANZA)];
      if (m.length > 0 && m.every(x => falsa(x[1]))) { tolte++; continue; }
      s += (s ? t[i - 1] : '') + (s ? t[i] : t[i].replace(/^(?:ma|però|solo che|anche se|tuttavia|eccetto|tranne)\s+/i, '').replace(/^\p{Ll}/u, c => c.toUpperCase()));
    }
    s = s.trim().replace(/[,;:]\s*$/, '');
    if (s && !/[.!?]$/.test(s)) s += '.';
    return s;
  }).filter(Boolean);
  let g = frasi.join(' ');
  let m = String(mancava || '').trim(); if (m && falsa(m)) { m = ''; tolte++; }
  const gl = g.toLowerCase().replace(NIENTE, '');
  if (esito === 'parziale' && /\b(hai sbagliato|sbagliat\w*|errat\w*|è falso|non è corrett\w*)\b/.test(gl)) esito = 'sbagliata';
  else if (esito === 'giusta' && NEGATIVO.test(gl)) esito = 'parziale';
  else if (esito === 'parziale' && tolte && !m && !NEGATIVO.test(gl)) esito = 'giusta';
  if (!g) g = esito === 'giusta' ? t('ai.risposta-completa') : '';
  return { esito, giudizio: g, mancava: m };
}
// cosa ripassare lo decide il codice dagli esiti (prima le risposte peggiori) con le parole del giudizio: niente consigli
// inventati dal modello («ripassa Green con le divergenze») e il voto arriva subito
export function ripassoOrale({ storico }) {
  const peso = { 'non so': 0, sbagliata: 0, 'fuori tema': 1, parziale: 2 };
  return storico.filter(x => x.esito !== 'giusta').sort((a, b) => (peso[a.esito] ?? 1) - (peso[b.esito] ?? 1)).slice(0, 3)
    .map(x => (x.argomento || x.domanda) + (x.mancava ? ': ' + x.mancava.replace(/^\p{Lu}/u, c => c.toLowerCase()) : ''));
}
// il voto lo calcola il codice dagli esiti: giusta 3, parziale 2, il resto 0 → da 18 a 30 (sotto metà: non superato)
export function votoOrale(storico) {
  if (!storico.length) return null;
  const punti = storico.reduce((s, x) => s + (x.esito === 'giusta' ? 3 : x.esito === 'parziale' ? 2 : 0), 0) / (3 * storico.length);
  if (punti < .5) return { voto: null, testo: t('ai.non-sufficiente'), punti };
  const v = Math.round(18 + 12 * (punti - .5) / .5);
  return { voto: v, lode: punti === 1 && storico.length >= 4, testo: punti === 1 && storico.length >= 4 ? t('ai.trenta-e-lode') : t('ai.voto', { v }), punti };
}

export async function provaChiave(chiave) {
  await claude('/models/' + MODELLO, { chiave });
  return true;
}
