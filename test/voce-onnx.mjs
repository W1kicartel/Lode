// Prova della voce Parakeet ONNX con il modello vero (desktop/voce-onnx.mjs e voce-onnx-motore.mjs), senza Electron:
// il motore gira in un processo Node figlio con lo stesso addon di sherpa-onnx che l'app carica nell'utilityProcess.
//   LODE_MODELLO_ONNX=<cartella del modello> node test/voce-onnx.mjs
//   node test/voce-onnx.mjs --scarica     scarica il modello (~640 MB, con il codice dell'app: commit fisso, SHA256,
//                                         ripresa) in LODE_MODELLO_ONNX, o in <cartella temporanea>/lode-modello-onnx
// Senza modello (o senza l'addon per questo sistema) salta con un messaggio; con LODE_VOCE_OBBLIGATORIA=1 (la CI) è un errore.
// Trascrive le frasi di test/audio (le stesse di test/prova-app.mjs, generate con la voce Alice del Mac) e controlla le
// parole chiave; misura un minuto e un Ripeti da 90 s (tempo e, su Mac e Linux, la memoria del processo: l'audio lungo
// passa a finestre di 30 s, la memoria non deve salire); verifica le impronte SHA256, la fila, il riposo, la chiusura
// durante l'avvio e i casi di ripiego (addon che manca, crash, modello rovinato). Niente microfono, niente altoparlanti,
// niente file audio scritti.
import { execFileSync, fork } from 'node:child_process';
import { copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as VO from '../desktop/voce-onnx.mjs';

const QUI = dirname(fileURLToPath(import.meta.url)), AUDIO = join(QUI, 'audio');
const OBBLIGATORIA = process.env.LODE_VOCE_OBBLIGATORIA === '1', SCARICA = process.argv.includes('--scarica');
const salta = msg => { console.log((OBBLIGATORIA ? '✗ ' : 'salto: ') + msg); process.exit(OBBLIGATORIA ? 1 : 0); };
if (!VO.sherpaPresente()) salta(`manca l'addon di sherpa-onnx per ${process.platform}-${process.arch} in desktop/node_modules (cd desktop && npm ci --ignore-scripts)`);
const CARTELLA = process.env.LODE_MODELLO_ONNX || (SCARICA ? join(tmpdir(), 'lode-modello-onnx') : '');
if (!CARTELLA) salta('nessun modello: LODE_MODELLO_ONNX=<cartella> oppure --scarica (circa 640 MB)');
if (!SCARICA && VO.MODELLO.file.some(f => !existsSync(join(CARTELLA, f.nome)))) salta(`il modello non è in ${CARTELLA} (aggiungi --scarica per scaricarlo lì)`);

let ok = 0, ko = 0; const tempi = [];
const prova = (nome, cond, dett = '') => { if (cond) { ok++; console.log('✓', nome); } else { ko++; console.log('✗', nome, dett); } };
const ms = async (nome, f) => { const t = performance.now(); const r = await f(); tempi.push([nome, Math.round(performance.now() - t)]); return r; };

// 1. il modello: scaricato con il codice dell'app (se chiesto), poi le impronte rilette per intero, file per file
if (SCARICA) {
  let ultimo = -1;
  const r = await ms('download (o controllo) del modello', () => VO.scaricaModello({ cartella: CARTELLA, avanza: p => { const d = Math.floor(p * 10); if (d > ultimo) { ultimo = d; console.log(`  modello ${d * 10}%`); } } }));
  console.log(`  file scaricati: ${r.scaricati}`);
}
const impronte = await ms('SHA256 dei 4 file (670 MB)', () => Promise.all(VO.MODELLO.file.map(async f => (await VO.impronta(join(CARTELLA, f.nome))) === f.sha256)));
prova('impronte SHA256 del modello uguali a quelle nel codice', impronte.every(Boolean), JSON.stringify(impronte));
prova('nessun .parziale rimasto', !readdirSync(CARTELLA).some(f => f.endsWith('.parziale')));

// 2. il motore vero in un processo figlio
const pcm = nome => { const f = readdirSync(AUDIO).find(x => x.startsWith(nome + '-') && x.endsWith('.pcm')); const b = readFileSync(join(AUDIO, f)); const i = new Int16Array(b.buffer, b.byteOffset, b.length >> 1); return Float32Array.from(i, x => x / 32768); };
const FRASI = {   // dalle frasi di test/prova-app.mjs: le parole dette (numeri esclusi: Parakeet scrive «28») e quelle chiave
  voto: { parole: 'preso fisica', chiavi: [/\b(28|ventotto)\b/, /fisica/] },
  def: { parole: 'definizione elettrofilo uguale specie povera elettroni', chiavi: [/definizione/, /elettrofilo/, /povera di elettroni/] },
  lezione: { parole: 'integrali definiti seno teorema fondamentale calcolo integrale derivata funzione integranda primitiva limite tende esame', chiavi: [/integrali definiti/, /seno di x/, /teorema fondamentale/, /primitiva/, /tende a (0|zero)/] },
  minuto: { parole: 'teorema Green integrale linea bordo dominio doppio regolare antiorario derivate parziali continue aree cerchio raggio forma differenziale esatta potenziale dimostrazione', chiavi: [/green/, /integrale doppio/, /derivate parziali continue/, /potenziale/, /dimostrazione/] },
};
const audio = Object.fromEntries(Object.keys(FRASI).map(k => [k, pcm(k)]));
const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ');
const vivo = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const voce = VO.crea({ cartella: CARTELLA, avvia: VO.processoNode(fork), rete: async () => { throw new Error('qui niente rete'); } });
await ms('avvio del motore (addon + modello in memoria)', () => voce.avvia());
const pid1 = voce.pid();
for (const [k, f] of Object.entries(FRASI)) {
  const testo = await ms(`trascrizione «${k}» (${(audio[k].length / 16000).toFixed(1)} s)`, () => voce.trascrivi(audio[k]));
  const n = norm(testo), mancano = f.chiavi.filter(c => !c.test(n)), parole = norm(f.parole).split(' ').filter(p => p.length > 3);
  const ritrovate = parole.filter(p => n.includes(p)).length / parole.length;
  prova(`«${k}»: parole chiave (${Math.round(ritrovate * 100)}% delle parole attese)`, !mancano.length && ritrovate >= .85, `mancano ${mancano.join(' ')} in: ${testo}`);
  console.log(`  ${testo}`);
}
// un minuto intero (come «Ripeti»): il pezzo da 44,8 s e l'inizio della lezione
const minuto = new Float32Array(60 * 16000); minuto.set(audio.minuto); minuto.set(audio.lezione.subarray(0, minuto.length - audio.minuto.length), audio.minuto.length);
const tm = performance.now(), tMinuto = await voce.trascrivi(minuto), sec = (performance.now() - tm) / 1000;
tempi.push(['un minuto di audio', Math.round(sec * 1000)]);
prova(`un minuto di audio in ${sec.toFixed(1)} s (${VO.fili()} fili)`, sec < 30 && /green/.test(norm(tMinuto)) && /integrali definiti/.test(norm(tMinuto)), tMinuto.slice(-200));
// la memoria (RSS) del processo del motore, in MB da 2^20: con ps, su Mac e Linux (su Windows si salta)
const rss = pid => { try { return Math.round(+execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim() / 1024); } catch { return null; } };
const memMinuto = rss(voce.pid());
// «ripeti gli ultimi 90 secondi» (js/comandi.js): il pezzo da 44,8 s, la lezione e la definizione, poi silenzio
const novanta = new Float32Array(90 * 16000); novanta.set(audio.minuto); novanta.set(audio.lezione, audio.minuto.length); novanta.set(audio.def, audio.minuto.length + audio.lezione.length);
const t90 = performance.now(), tNovanta = await voce.trascrivi(novanta), sec90 = (performance.now() - t90) / 1000;
tempi.push(['Ripeti di 90 s', Math.round(sec90 * 1000)]);
const memNovanta = rss(voce.pid());
prova(`Ripeti di 90 s in ${sec90.toFixed(1)} s, tutto il testo (dall'inizio alla fine)`, sec90 < 45 && /green/.test(norm(tNovanta)) && /integrali definiti/.test(norm(tNovanta)) && /elettrofilo/.test(norm(tNovanta)), tNovanta.slice(-200));
if (memMinuto && memNovanta) {
  console.log(`  memoria del motore: ${memMinuto} MB dopo il minuto, ${memNovanta} MB dopo i 90 s`);
  prova('Ripeti di 90 s: la memoria del motore non sale (finestre di 30 s; in un colpo solo erano +600 MB)', memNovanta - memMinuto < 200, `${memMinuto} → ${memNovanta} MB`);
} else console.log('  memoria del motore: non misurata su questo sistema (manca ps)');

// 3. la fila: tre richieste insieme, risposte nell'ordine giusto
const fila = await Promise.all([voce.trascrivi(audio.voto), voce.trascrivi(audio.def), voce.trascrivi(audio.voto)]);
prova('fila: tre richieste insieme, una alla volta, ognuna con la sua risposta', /fisica/.test(norm(fila[0])) && /elettrofilo/.test(norm(fila[1])) && /fisica/.test(norm(fila[2])), fila.join(' | '));

// 4. il riposo: il processo esce, la richiesta dopo ne avvia un altro
voce.chiudi(); await new Promise(r => setTimeout(r, 500));
prova('riposo: il processo del motore è uscito', !voce.attivo() && !vivo(pid1));
const dopo = await ms('prima frase dopo il riposo (riavvio compreso)', () => voce.trascrivi(audio.voto));
prova('riposo: la frase dopo riavvia il motore da solo', /fisica/.test(norm(dopo)) && voce.pid() !== pid1);

// 5. i ripieghi: crash a metà trascrizione, addon che non c'è, modello rovinato
const pid2 = voce.pid(), inCorso = voce.trascrivi(minuto);
setTimeout(() => process.kill(pid2, 'SIGKILL'), 150);
const ec = await inCorso.then(() => null, e => e);
prova('crash a metà: errore «crash» (la barra passa a Whisper con lo stesso audio)', ec?.codice === 'crash' && VO.RIPIEGO.includes(ec.codice), ec?.message);
prova('dopo il crash il motore riparte', /fisica/.test(norm(await voce.trascrivi(audio.voto))));
voce.chiudi();
let chieste = 0;
const senzaAddon = VO.crea({ cartella: join(tmpdir(), 'lode-nessun-modello'), avvia: VO.processoNode(fork), pacchetto: 'sherpa-onnx-che-non-esiste', rete: async () => { chieste++; throw new Error('no'); } });
const ea = await senzaAddon.avvia().then(() => null, e => e);
prova('addon che non si carica: errore «addon» prima di scaricare il modello', ea?.codice === 'addon' && !chieste && !senzaAddon.attivo(), ea?.message);
// chiudi() mentre il motore parte (un riposo, l'uscita): l'errore è «chiusa», non «crash» (che porterebbe a Whisper)
for (const dopoMs of [30, 400]) {
  const v = VO.crea({ cartella: CARTELLA, avvia: VO.processoNode(fork), rete: async () => { throw new Error('qui niente rete'); } });
  const pa = v.avvia(); await new Promise(r => setTimeout(r, dopoMs)); v.chiudi();
  const e = await pa.then(() => null, e => e);
  prova(`chiudi ${dopoMs} ms dopo l'avvio → «chiusa», non «crash»`, e?.codice === 'chiusa' && !v.attivo(), `${e?.codice} ${e?.message}`);
}
// un modello rovinato: gli stessi file grandi (collegamenti, niente copie da 650 MB) e tokens.txt cambiato. Il codice
// dell'app lo ricontrolla, lo trova diverso, lo cancella e prova a riscaricarlo: la «rete» dà un file sbagliato
const rovinato = mkdtempSync(join(dirname(CARTELLA), 'lode-rovinato-'));
for (const f of VO.MODELLO.file) { const a = join(CARTELLA, f.nome), b = join(rovinato, f.nome); if (f.nome === 'tokens.txt') { const t = readFileSync(a); t[100] ^= 1; writeFileSync(b, t); } else try { linkSync(a, b); } catch { copyFileSync(a, b); } }
const voceRovinata = VO.crea({ cartella: rovinato, avvia: VO.processoNode(fork), rete: async () => new Response('non sono i token giusti\n'.repeat(4000).slice(0, 93939)) });
const em = await voceRovinata.avvia().then(() => null, e => e);
prova('modello rovinato: errore «impronta», file cancellato, nessun .parziale', em?.codice === 'impronta' && VO.RIPIEGO.includes(em.codice) && !existsSync(join(rovinato, 'tokens.txt')) && !readdirSync(rovinato).some(f => f.endsWith('.parziale')), em?.message);
voceRovinata.chiudi(); rmSync(rovinato, { recursive: true, force: true });

console.log('\nTempi (ms):'); for (const [n, t] of tempi) console.log(`  ${String(t).padStart(6)}  ${n}`);
console.log(`\nVoce Parakeet ONNX su ${process.platform}-${process.arch}, sherpa-onnx ${VO.VERSIONE_SHERPA}: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
