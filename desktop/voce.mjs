// La voce sul Mac: lode-voce (desktop/voce-mac, Parakeet TDT v3 sul Neural Engine via FluidAudio) come processo a parte.
// Si avvia la prima volta che serve; la prima volta in assoluto scarica il modello (circa 470 MB) nella cartella di
// FluidAudio (~/Library/Application Support/FluidAudio: se c'è già FluidVoice, il modello è lo stesso e non si riscarica).
// Un processo solo, una richiesta alla volta in fila (le risposte arrivano nello stesso ordine, con l'id).
// L'audio passa da un file temporaneo (privato, 0600) che lode-voce legge e cancella subito. Perché non resti mai su
// disco, anche qui ogni file in attesa si cancella: alla risposta, se lode-voce si chiude o va in crash, a riposo e
// all'uscita di Lode; all'avvio si tolgono quelli lasciati da un Lode chiuso di colpo (processo che non c'è più).
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cancella = f => { try { rmSync(f, { force: true }); } catch { } };
// i pezzi di audio rimasti da un Lode chiuso di colpo (kill, corrente saltata): solo quelli di processi che non ci sono più
export function pulisciRimasti(dir = tmpdir()) {
  let nomi = []; try { nomi = readdirSync(dir); } catch { return 0; }
  let tolti = 0;
  for (const nome of nomi) {
    const m = nome.match(/^lode-voce-(\d+)-\d+\.f32$/); if (!m) continue;
    let vivo = +m[1] === process.pid; if (!vivo) try { process.kill(+m[1], 0); vivo = true; } catch (e) { vivo = e.code === 'EPERM'; }
    if (!vivo) { cancella(join(dir, nome)); tolti++; }
  }
  return tolti;
}

export function crea({ binario, avanza }) {
  const disponibile = () => process.platform === 'darwin' && process.arch === 'arm64' && existsSync(binario);
  let proc = null, pronto = null, n = 0, resto = '';
  const attese = new Map();   // id → { ok, ko, file }
  if (disponibile()) pulisciRimasti();
  // una richiesta finisce (risposta, errore, chiusura): il suo file se ne va comunque
  const chiusa = (id, e, testo) => { const a = attese.get(id); if (!a) return; attese.delete(id); cancella(a.file); e ? a.ko(e) : a.ok(testo); };
  const chiudiTutte = e => { for (const id of [...attese.keys()]) chiusa(id, e); };
  function avvia() {
    if (pronto) return pronto;
    pronto = new Promise((ok, ko) => {
      const p = proc = spawn(binario, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      p.stderr.on('data', () => { });   // i log di FluidAudio
      p.stdout.on('data', b => {
        resto += b.toString(); let i;
        while ((i = resto.indexOf('\n')) >= 0) {
          const riga = resto.slice(0, i); resto = resto.slice(i + 1);
          let j; try { j = JSON.parse(riga); } catch { continue; }
          if (j.evento === 'progresso') avanza?.({ p: j.p });
          else if (j.evento === 'pronto') ok(true);
          else if (j.evento === 'errore') ko(new Error(j.errore));
          else if (j.id && attese.has(j.id)) chiusa(j.id, j.errore ? new Error(j.errore) : null, j.testo || '');
        }
      });
      p.on('exit', c => {
        const e = new Error('lode-voce si è chiuso (' + c + ')'); ko(e);
        if (proc !== p) return;   // chiuso a riposo: ne è già partito un altro
        chiudiTutte(e); proc = null; pronto = null; resto = '';
      });
    });
    return pronto;
  }
  async function trascrivi(audio) {
    await avvia();
    const id = String(++n), file = join(tmpdir(), `lode-voce-${process.pid}-${id}.f32`);
    const f = audio instanceof Float32Array ? audio : new Float32Array(audio);
    try { writeFileSync(file, Buffer.from(f.buffer, f.byteOffset, f.byteLength), { mode: 0o600 }); } catch (e) { cancella(file); throw e; }
    return new Promise((ok, ko) => {
      attese.set(id, { ok, ko, file });
      if (!proc) return chiusa(id, new Error('lode-voce chiuso'));   // chiuso mentre si scriveva il file
      try { proc.stdin.write(JSON.stringify({ id, file }) + '\n'); } catch (e) { chiusa(id, e); }
    });
  }
  // a riposo o all'uscita: il processo si chiude subito e la prossima trascrizione ne avvia uno nuovo
  const chiudi = () => { const p = proc; proc = null; pronto = null; resto = ''; chiudiTutte(new Error('lode-voce chiuso')); try { p?.stdin.end(); p?.kill(); } catch { } };
  return { disponibile, avvia, trascrivi, chiudi };
}
