// Il processo che trascrive con Parakeet ONNX (desktop/voce-onnx.mjs lo avvia: utilityProcess in Electron, un Node
// figlio nelle prove). Qui, e solo qui, si carica l'addon di sherpa-onnx: se manca o va in crash, cade questo processo.
// Messaggi dal main, uno alla volta:
//   { tipo: 'addon', pacchetto }        → { evento: 'addon', versione }   carica sherpa-onnx-node (niente modello)
//   { tipo: 'carica', file, fili }      → { evento: 'pronto' }            il riconoscitore con encoder, decoder, joiner, tokens
//   { tipo: 'trascrivi', id, audio }    → { id, testo } | { id, errore }  audio: Float32Array a 16 kHz, mono
// Gli errori di avvio arrivano come { evento: 'errore', errore, codice: 'addon' | 'modello', dettaglio }: «errore» è la
// frase per lo studente, «dettaglio» il testo tecnico (in inglese, a volte con un percorso) che resta nella console.
// Le trascrizioni si fanno in fila, una alla volta, nell'ordine di arrivo: il riconoscitore è uno solo, e decodeAsync
// lavora sui fili di onnxruntime lasciando libero questo processo di ricevere le richieste dopo.
// L'audio oltre i 30 secondi (Ripeti arriva a 90) si decodifica a finestre da 20-28 s, tagliate nel punto più
// silenzioso: onnxruntime tiene la memoria del picco più alto e non la restituisce. Un minuto in un colpo solo lasciava
// il processo a 1,8 GB, 90 secondi a 2,1 GB, per tutta la lezione; a finestre resta intorno a 1,5 GB (misure su M2).
// L'audio resta in memoria: nessun file.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// il riconoscitore vero: Parakeet TDT è un «transducer» di NeMo (modelType nemo_transducer). featureDim 80 come
// nell'esempio ufficiale: sherpa-onnx legge comunque quello giusto (128 per la v3) dai metadati dell'encoder
export async function caricaSherpa(sherpa, { file, fili = 2 }) {
  return sherpa.OfflineRecognizer.createAsync({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: { transducer: { encoder: file.encoder, decoder: file.decoder, joiner: file.joiner }, tokens: file.tokens, numThreads: fili, provider: 'cpu', debug: 0, modelType: 'nemo_transducer' },
  });
}

// Dove tagliare un audio lungo: [inizio, fine] in campioni. Fino a 30 s un pezzo solo (i pezzi della lezione sono da
// 20-29 s, js/trascrizione.js); oltre, ogni finestra finisce tra 20 e 28 s nel tratto di 100 ms con meno energia (una
// pausa del prof, come fa il segmentatore della lezione), e l'ultima tiene il resto, al massimo 30 s.
const SR = 16000;
export function finestre(n, campioni, { soglia = 30, min = 20, max = 28 } = {}) {
  if (n <= soglia * SR) return [[0, n]];
  const fuori = [], passo = SR / 10; let da = 0;
  while (n - da > soglia * SR) {
    let taglio = da + max * SR, meno = Infinity;
    for (let i = da + min * SR; i + passo <= da + max * SR; i += passo) {
      let e = 0; for (let j = i; j < i + passo; j++) e += campioni[j] * campioni[j];
      if (e < meno) { meno = e; taglio = i + passo / 2; }
    }
    fuori.push([da, taglio]); da = taglio;
  }
  fuori.push([da, n]);
  return fuori;
}

// la logica dei messaggi, separata dal processo per le prove (test/unita.mjs la usa con un riconoscitore finto)
export function servi({ manda, addon = p => require(p), carica = caricaSherpa }) {
  let sherpa = null, rec = null, lavora = false;
  const coda = [];
  async function gira() {
    if (lavora) return; lavora = true;
    while (coda.length) {
      const { id, audio } = coda.shift();
      try {
        if (!rec) throw new Error('modello non caricato');
        const tutto = audio instanceof Float32Array ? audio : new Float32Array(audio), testi = [];
        for (const [a, b] of finestre(tutto.length, tutto)) {   // uno stream per finestra, in fila; ognuna con il suo
          const s = rec.createStream();                         // Float32Array (una copia), non una vista sull'intero
          s.acceptWaveform({ sampleRate: SR, samples: b - a === tutto.length ? tutto : tutto.slice(a, b) });
          const r = await rec.decodeAsync(s); testi.push(String(r?.text || '').trim());
        }
        manda({ id, testo: testi.filter(Boolean).join(' ') });
      } catch (e) { manda({ id, errore: String(e.message).split('\n')[0] }); }
    }
    lavora = false;
  }
  return async function ricevi(m) {
    if (m?.tipo === 'addon') {
      try { sherpa = addon(m.pacchetto || 'sherpa-onnx-node'); manda({ evento: 'addon', versione: sherpa?.version || '' }); }
      catch (e) { manda({ evento: 'errore', codice: 'addon', errore: 'Il programma della voce (sherpa-onnx) non si carica su questo computer.', dettaglio: String(e.message).split('\n')[0] }); }
    } else if (m?.tipo === 'carica') {
      try { rec = await carica(sherpa, m); manda({ evento: 'pronto' }); }
      catch (e) { manda({ evento: 'errore', codice: 'modello', errore: 'Il modello di Parakeet non si carica (forse un file è rovinato).', dettaglio: String(e.message).split('\n')[0] }); }
    } else if (m?.tipo === 'trascrivi') { coda.push(m); gira(); }
  };
}

// avviato come processo: utilityProcess di Electron (process.parentPort) o Node figlio con il canale IPC (process.send)
if (process.parentPort) {
  const ricevi = servi({ manda: m => process.parentPort.postMessage(m) });
  process.parentPort.on('message', e => ricevi(e.data));
} else if (process.send && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ricevi = servi({ manda: m => process.send(m) });
  process.on('message', ricevi);
  process.on('disconnect', () => process.exit(0));   // il processo che l'ha avviato non c'è più
}
