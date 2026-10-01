// L'AI di Lode (facoltativa): Claude, con la chiave API dello studente, salvata solo in questo browser.
// Spiega, crea carte da appunti/PDF/foto, interroga come all'orale. Non scrive mai da sola: ogni modifica ai dati
// (carte, esami, voti) arriva come proposta con «Conferma / Annulla», come fa Lumi nel gestionale.
import { D, cfuFatti, dataLunga, fatti, media, num, oggi, prossimi, daRipassare } from './dati.js';

const MODELLO = 'claude-opus-5-5';
let SDK = null, client = null, chiaveUsata = '';
export const attiva = () => !!D.imp.chiave;
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

export async function provaChiave(chiave) {
  SDK ||= (await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm')).default;
  const c = new SDK({ apiKey: chiave, dangerouslyAllowBrowser: true });
  await c.models.retrieve(MODELLO);
  return true;
}
