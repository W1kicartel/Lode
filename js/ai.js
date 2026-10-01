// L'AI di Lode (facoltativa): Claude, con la chiave API dello studente, salvata solo in questo browser.
// Spiega, crea carte da appunti/PDF/foto, interroga come all'orale. Non scrive mai da sola: ogni modifica ai dati
// (carte, esami, voti) arriva come proposta con «Conferma / Annulla», come fa Lumi nel gestionale.
import { D, cfuFatti, dataLunga, fatti, media, num, oggi, prossimi, daRipassare, lezioni, lezioneOra } from './dati.js';

const MODELLO = 'claude-opus-5-5';
let SDK = null, client = null, chiaveUsata = '';
// due motori: Claude (chiave dello studente) o il cervello locale (Ollama + Gemma, installato da Lode). Claude se c'è la chiave.
const PONTE = typeof window !== 'undefined' ? window.lodeDesktop : null;
let LOCALE = null;
export const impostaLocale = m => { LOCALE = m || null; };
export const modelloLocale = () => LOCALE;
export const motore = () => D.imp.chiave ? 'claude' : (PONTE && LOCALE) ? 'locale' : null;
export const attiva = () => !!motore();
async function cliente() {
  if (!D.imp.chiave) throw new Error('Manca la chiave: aggiungila in Impostazioni.');
  SDK ||= (await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm')).default;
  if (!client || chiaveUsata !== D.imp.chiave) { client = new SDK({ apiKey: D.imp.chiave, dangerouslyAllowBrowser: true }); chiaveUsata = D.imp.chiave; }
  return client;
}

export function contesto() {
  const m = media(), p = prossimi();
  const righe = [
    `Oggi è ${dataLunga(oggi())} (${oggi()}).`,
    D.profilo.nome ? `Lo studente si chiama ${D.profilo.nome}${D.profilo.corso ? ` e studia ${D.profilo.corso}` : ''}.` : '',
    `CFU: ${cfuFatti()} su ${D.profilo.cfuTotali}. Media ponderata: ${m.ponderata ? num(m.ponderata, 2) : 'nessun voto'}${m.base ? `, base di laurea ${num(m.base, 1)}/110` : ''}. La lode vale ${D.profilo.lode}.`,
    `Esami sostenuti: ${fatti().map(e => `${e.nome} (${e.cfu} CFU, ${e.idoneita ? 'idoneità' : e.voto + (e.lode ? ' e lode' : '')})`).join('; ') || 'nessuno'}.`,
    `Prossimi appelli: ${p.map(e => `${e.nome} (${e.cfu} CFU) il ${e.data}`).join('; ') || 'nessuno segnato'}.`,
    `Esami ancora da dare senza data: ${D.esami.filter(e => !e.fatto && !e.data).map(e => e.nome).join('; ') || 'nessuno'}.`,
    `Carte del ripasso: ${D.carte.length}, da ripassare oggi ${daRipassare().length}.`,
    `Orario: ${D.orario.map(o => `${o.corso} (${o.giorni.join(',')} ${o.inizio}-${o.fine})`).join('; ') || 'non impostato'}.${lezioneOra() ? ` Adesso è a lezione di ${lezioneOra().corso}.` : ''}`,
    ...lezioni().slice(0, 3).map(l => `Lezione di ${l.corso} del ${l.data}: ★ da esame: ${(l.stelle || []).join(' | ') || '—'}. Definizioni: ${(l.definizioni || []).map(d => d.t + ' = ' + d.d).join(' | ') || '—'}.${l.appunti ? ` Appunti: ${l.appunti.slice(0, 1500)}` : ''}`),
  ];
  return righe.filter(Boolean).join('\n');
}

const SISTEMA = `Sei Lode, l'assistente di studio che vive in una piccola barra in cima allo schermo di uno studente universitario italiano.
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

// controllo minimo degli input (con lo streaming dei parametri il modello può consegnarli incompleti)
function valido(nome, x) {
  if (!x || typeof x !== 'object') return false;
  if (nome === 'crea_carte') return Array.isArray(x.carte) && x.carte.length > 0 && x.carte.every(c => typeof c?.fronte === 'string' && typeof c?.retro === 'string' && c.fronte.trim() && c.retro.trim());
  if (nome === 'aggiungi_esame') return typeof x.nome === 'string' && !!x.nome.trim();
  if (nome === 'registra_voto') return typeof x.esame === 'string' && Number.isInteger(x.voto) && x.voto >= 18 && x.voto <= 30;
  if (nome === 'mostra') return ['libretto', 'esami', 'ripasso'].includes(x.scheda);
  return true;
}

// un giro di conversazione con strumenti: testo in streaming, strumenti eseguiti da chi chiama (con le sue conferme)
export async function conversa({ storia, sistema = SISTEMA, strumenti = true, suTesto, esegui, segnale }) {
  const c = await cliente();
  for (let giro = 0; giro < 6; giro++) {
    const parametri = {
      model: MODELLO, max_tokens: 32000, system: sistema + '\n\nDati dello studente adesso:\n' + contesto(),
      messages: storia, output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    };
    if (strumenti) parametri.tools = STRUMENTI;
    const flusso = c.beta.messages.stream(parametri, { signal: segnale });
    flusso.on('text', d => suTesto?.(d));
    const msg = await flusso.finalMessage();
    storia.push({ role: 'assistant', content: msg.content });
    if (msg.stop_reason === 'refusal') { suTesto?.('\n\nSu questo non posso aiutarti.'); return storia; }
    if (msg.stop_reason !== 'tool_use') return storia;
    const risultati = [];
    for (const b of msg.content.filter(b => b.type === 'tool_use')) {
      if (!valido(b.name, b.input)) { risultati.push({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: 'Parametri incompleti o non validi: riprova con tutti i campi richiesti.' }); continue; }
      let r; try { r = await esegui(b.name, b.input); } catch (e) { r = { errore: e.message }; }
      risultati.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(r ?? { ok: true }), ...(r?.errore ? { is_error: true } : {}) });
    }
    storia.push({ role: 'user', content: risultati });
  }
  return storia;
}

// l'interrogazione: un professore d'orale, una domanda alla volta, poi un voto onesto
export const SISTEMA_ORALE = nome => `Sei un docente universitario italiano che fa l'esame orale di «${nome}». Lo studente si sta esercitando con Lode.
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
const SISTEMA_LOCALE = SISTEMA.split('\nStrumenti:')[0] + `
Non puoi modificare i dati di Lode: se lo studente vuole salvare carte o definizioni, digli di usare «chiudi lezione» o i comandi della barra.
Non inventare: se non sei sicuro di una definizione o di una formula, dillo.`;
export async function conversaLocale({ storia, sistema, suTesto, segnale }) {
  const testo = await chatLocale([{ role: 'system', content: (sistema || SISTEMA_LOCALE) + '\n\nDati dello studente adesso:\n' + contesto() }, ...perOllama(storia)], { pezzo: suTesto, segnale });
  storia.push({ role: 'assistant', content: [{ type: 'text', text: testo }] });
  return storia;
}

/* ---------- compiti con risposta strutturata (Claude o locale) ---------- */
const SCHEMA_LEZIONE = { type: 'object', additionalProperties: false, required: ['definizioni', 'da_esame'], properties: {
  definizioni: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['termine', 'definizione'], properties: { termine: { type: 'string' }, definizione: { type: 'string' } } } },
  da_esame: { type: 'array', items: { type: 'string' } } } };
const SCHEMA_CARTE = { type: 'object', additionalProperties: false, required: ['carte'], properties: {
  carte: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['fronte', 'retro'], properties: { fronte: { type: 'string' }, retro: { type: 'string' } } } } } };
async function strutturato(istruzioni, contenuto, schema) {
  if (motore() === 'claude') {
    const c = await cliente();
    const r = await c.messages.create({ model: MODELLO, max_tokens: 16000, output_config: { effort: 'low', format: { type: 'json_schema', schema } }, messages: [{ role: 'user', content: [...(Array.isArray(contenuto) ? contenuto : [{ type: 'text', text: contenuto }]), { type: 'text', text: istruzioni }] }] });
    if (r.stop_reason === 'refusal') throw new Error('Claude ha declinato la richiesta.');
    return JSON.parse(r.content.find(b => b.type === 'text')?.text || '{}');
  }
  if (motore() === 'locale') {
    const m = perOllama([{ role: 'user', content: [...(Array.isArray(contenuto) ? contenuto : [{ type: 'text', text: contenuto }]), { type: 'text', text: istruzioni }] }]);
    return JSON.parse(await chatLocale(m, { formato: schema }));
  }
  throw new Error('Serve il cervello locale o una chiave Claude.');
}
// «chiudi lezione»: dagli appunti grezzi alle definizioni e alle cose da esame, solo ciò che c'è davvero negli appunti
export async function estraiLezione({ corso, appunti, gia = [] }) {
  const r = await strutturato(`Sei l'assistente di uno studente universitario italiano. Qui sopra ci sono i suoi appunti della lezione di «${corso}».
Estrai:
- definizioni: i concetti definiti o spiegati negli appunti, con una definizione corta (massimo 25 parole), fedele agli appunti, in italiano. Termini brevi. Niente concetti che negli appunti non ci sono.${gia.length ? ` Salta questi, li ha già: ${gia.join(', ')}.` : ''}
- da_esame: SOLO le frasi in cui gli appunti dicono esplicitamente che il prof la chiederà all'esame o che è importante (parole come «esame», «importante», «ricordatevi», «attenzione»). Riformulate in breve. Se gli appunti non lo dicono, lista vuota.`, `Appunti di ${corso}:\n\n${appunti}`, SCHEMA_LEZIONE);
  // i modelli piccoli tendono a vedere «cose da esame» ovunque: al massimo tante quante le volte che gli appunti lo dicono
  const segnali = appunti.split(/(?<=[.!?\n])\s+/).filter(f => /esame|important|ricordat|attenzione|lo chiede|chiede sempre|domanda sicura/i.test(f)).length;
  const visti = new Set(gia.map(t => t.toLowerCase().trim()));
  const definizioni = (r.definizioni || []).filter(d => { const k = d.termine?.toLowerCase().trim(); if (!k || !d.definizione?.trim() || visti.has(k)) return false; visti.add(k); return true; }).slice(0, 15);
  return { definizioni, daEsame: (r.da_esame || []).filter(Boolean).slice(0, Math.min(5, segnali)) };
}
// «Riordina»: dalla trascrizione grezza della lezione ad appunti da studiare. A pezzi (il modello locale ha poco contesto):
// ogni pezzo diventa una parte con titolo, punti chiari e formule in LaTeX; niente che il prof non abbia detto.
export async function riordina({ corso, testo, appunti = '', avanza, fonte = 'lezione' }) {
  const parole = String(testo).split(/\s+/), passo = motore() === 'claude' ? 9000 : 1400, pezzi = [];
  for (let i = 0; i < parole.length; i += passo) pezzi.push(parole.slice(i, i + passo).join(' '));
  const istr = (k, n) => fonte === 'documento' ? `Questa è ${n > 1 ? `la parte ${k} di ${n} del` : 'il'} testo di un documento di studio (slide o dispense) del corso «${corso}».` : `Questa è ${n > 1 ? `la parte ${k} di ${n} della` : 'la'} trascrizione automatica di una lezione universitaria di «${corso}» (contiene errori di trascrizione; le formule dette a voce sono già in LaTeX tra $…$).`;
  const istr2 = (k, n) => istr(k, n) + `

Trasformalo in appunti da studiare, in italiano:
- un titolo per ogni argomento, con «### »;
- punti brevi e chiari con «- », nell'ordine della lezione;
- formule in LaTeX tra $…$ (Obsidian le mostra), correggendo quelle trascritte male se il senso è chiaro;
- in **grassetto** i termini definiti;
- niente che non sia nel testo; se un pezzo è incomprensibile, saltalo.
Rispondi solo con gli appunti, senza introduzioni.`;
  const out = [];
  for (const [k, pezzo] of pezzi.entries()) {
    avanza?.(k / pezzi.length);
    const contenuto = `Trascrizione:\n\n${pezzo}${k === 0 && appunti ? `\n\nAppunti presi a mano dallo studente (per orientarti):\n${appunti}` : ''}`;
    if (motore() === 'claude') {
      const c = await cliente();
      const r = await c.messages.create({ model: MODELLO, max_tokens: 16000, output_config: { effort: 'low' }, messages: [{ role: 'user', content: contenuto + '\n\n' + istr2(k + 1, pezzi.length) }] });
      out.push(r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim());
    } else if (motore() === 'locale') out.push((await chatLocale(perOllama([{ role: 'user', content: contenuto + '\n\n' + istr2(k + 1, pezzi.length) }]))).trim());
    else throw new Error('Serve il cervello locale o una chiave Claude.');
  }
  avanza?.(1);
  return out.join('\n\n').replace(/^#{1,2}\s/gm, '### ');
}

// la foto della lavagna (o di una pagina) diventa appunti: testo fedele, formule in LaTeX, schemi descritti a parole
export async function trascriviFoto({ blocco, corso }) {
  const istr = `È una foto di una lavagna o di una pagina di appunti${corso ? ` della lezione di «${corso}»` : ''}. Trascrivila in appunti Markdown in italiano, fedeli a ciò che si vede: titoli con «### », punti con «- », formule in LaTeX tra $…$ (Obsidian le mostra), grafici e schemi descritti in una riga tra parentesi quadre. Se una parte è illeggibile scrivi [illeggibile]. Solo gli appunti, senza introduzioni.`;
  if (motore() === 'claude') { const c = await cliente(); const r = await c.messages.create({ model: MODELLO, max_tokens: 16000, output_config: { effort: 'low' }, messages: [{ role: 'user', content: [blocco, { type: 'text', text: istr }] }] }); return r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim(); }
  if (motore() === 'locale') return (await chatLocale(perOllama([{ role: 'user', content: [blocco, { type: 'text', text: istr }] }]))).trim();
  throw new Error('Serve il cervello locale o una chiave Claude.');
}
// un documento (slide, dispense, PDF) diventa un riassunto da studiare, a pezzi come la trascrizione
export async function riassumi({ corso, testo, nome, avanza }) {
  return riordina({ corso: corso || nome, testo: `[Documento «${nome}»]\n${testo}`, avanza, fonte: 'documento' });
}

export async function carteDa(blocchi) {
  const r = await strutturato('Crea da 8 a 20 carte del ripasso da questo materiale: una sola idea per carta, domanda precisa, risposta corta (massimo 2 frasi), in italiano. Solo concetti presenti nel materiale.', blocchi, SCHEMA_CARTE);
  return (r.carte || []).filter(c => c.fronte?.trim() && c.retro?.trim()).slice(0, 30);
}

export async function provaChiave(chiave) {
  SDK ||= (await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm')).default;
  const c = new SDK({ apiKey: chiave, dangerouslyAllowBrowser: true });
  await c.models.retrieve(MODELLO);
  return true;
}
