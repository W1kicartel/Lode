// La voce sul Mac: lode-voce (desktop/voce-mac, Parakeet TDT v3 sul Neural Engine via FluidAudio) come processo a parte.
// Si avvia la prima volta che serve; la prima volta in assoluto scarica il modello (circa 470 MB) nella cartella di
// FluidAudio (~/Library/Application Support/FluidAudio: se c'è già FluidVoice, il modello è lo stesso e non si riscarica).
// Un processo solo, una richiesta alla volta in fila (le risposte arrivano nello stesso ordine, con l'id).
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function crea({ binario, avanza }) {
  const disponibile = () => process.platform === 'darwin' && process.arch === 'arm64' && existsSync(binario);
  let proc = null, pronto = null, n = 0, resto = '';
  const attese = new Map();
  function avvia() {
    if (pronto) return pronto;
    pronto = new Promise((ok, ko) => {
      proc = spawn(binario, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      proc.stderr.on('data', () => { });   // i log di FluidAudio
      proc.stdout.on('data', b => {
        resto += b.toString(); let i;
        while ((i = resto.indexOf('\n')) >= 0) {
          const riga = resto.slice(0, i); resto = resto.slice(i + 1);
          let j; try { j = JSON.parse(riga); } catch { continue; }
          if (j.evento === 'progresso') avanza?.({ p: j.p });
          else if (j.evento === 'pronto') ok(true);
          else if (j.evento === 'errore') ko(new Error(j.errore));
          else if (j.id && attese.has(j.id)) { const a = attese.get(j.id); attese.delete(j.id); j.errore ? a.ko(new Error(j.errore)) : a.ok(j.testo || ''); }
        }
      });
      proc.on('exit', c => {
        const e = new Error('lode-voce si è chiuso (' + c + ')'); ko(e);
        for (const a of attese.values()) a.ko(e); attese.clear(); proc = null; pronto = null;
      });
    });
    return pronto;
  }
  async function trascrivi(audio) {
    await avvia();
    const id = String(++n), file = join(tmpdir(), `lode-voce-${process.pid}-${id}.f32`);
    const f = audio instanceof Float32Array ? audio : new Float32Array(audio);
    writeFileSync(file, Buffer.from(f.buffer, f.byteOffset, f.byteLength));
    return new Promise((ok, ko) => { attese.set(id, { ok, ko }); proc.stdin.write(JSON.stringify({ id, file }) + '\n'); });
  }
  const chiudi = () => { try { proc?.stdin.end(); proc?.kill(); } catch { } };
  return { disponibile, avvia, trascrivi, chiudi };
}
