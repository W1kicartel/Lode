// L'audio che esce dal Mac per la «Lezione dal computer» (js/computer.js): lode-ascolta (desktop/ascolta-mac, il process
// tap di CoreAudio, macOS 14.2+) come processo a parte. Chiede solo il permesso dell'audio di sistema, non quello dello
// schermo. I campioni (Float32, mono, 16 kHz) arrivano dallo stdout e vanno alla barra a pezzi: niente va su disco.
// Dal codice (senza installer) lode-ascolta non c'è finché non si compila: la prima volta lo compila Lode da solo con gli
// strumenti di Apple (gli stessi che servono a git), in pochi secondi. Su Windows e Linux non serve: lì l'audio del sistema
// arriva dalla condivisione dello schermo senza permessi dello schermo (main.mjs, setDisplayMediaRequestHandler).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function crea({ binario, sorgenti, manda }) {
  let proc = null, resto = Buffer.alloc(0), compilazione = null;
  const disponibile = () => process.platform === 'darwin' && (existsSync(binario) || existsSync(join(sorgenti, 'compila.sh')));
  // la prima volta dal codice: bash ascolta-mac/compila.sh (swiftc, nessuna dipendenza, nessun download)
  const compila = () => compilazione ||= new Promise((ok, ko) => {
    if (existsSync(binario)) return ok();
    const p = spawn('bash', [join(sorgenti, 'compila.sh')], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', d => { err = (err + d).slice(-2000); });
    p.on('error', ko);
    p.on('close', c => c === 0 && existsSync(binario) ? ok() : ko(new Error('compilazione di lode-ascolta non riuscita: ' + err.split('\n').filter(Boolean).slice(-2).join(' '))));
  }).finally(() => { compilazione = null; });
  async function avvia() {
    if (proc) return { ok: true };
    if (process.platform !== 'darwin') return { ok: false, motivo: 'solo Mac' };
    await compila();
    return new Promise(ok => {
      const p = proc = spawn(binario, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      let pronto = false, err = '';
      const fine = r => { if (!pronto) { pronto = true; ok(r); } };
      p.stdout.on('data', d => {
        // i pezzi dello stdout non sono allineati ai 4 byte di un Float32: il resto aspetta il pezzo dopo
        // e si manda a pezzi da ~¼ di secondo (16 000 byte = 4 000 campioni), non a ogni blocco di CoreAudio (~100 al secondo)
        const tutto = resto.length ? Buffer.concat([resto, d]) : d;
        if (tutto.length < 16000) { resto = Buffer.from(tutto); return; }
        const n = tutto.length - (tutto.length % 4);
        resto = Buffer.from(tutto.subarray(n));
        manda('computer:audio', tutto.subarray(0, n));
      });
      p.stderr.on('data', d => {
        err = (err + d).slice(-2000);
        if (/PRONTO/.test(err)) fine({ ok: true });
        const m = err.match(/ERRORE (\S+) (-?\d+)/); if (m) fine({ ok: false, motivo: m[1], codice: +m[2] });
      });
      p.on('error', e => { proc = null; fine({ ok: false, motivo: e.message }); });
      p.on('close', c => { if (proc === p) proc = null; resto = Buffer.alloc(0); fine({ ok: false, motivo: 'chiuso', codice: c }); manda('computer:fine', { codice: c }); });
      setTimeout(() => fine({ ok: false, motivo: 'tempo' }), 8000);
    });
  }
  function ferma() { const p = proc; proc = null; resto = Buffer.alloc(0); try { p?.stdin.end(); p?.kill('SIGTERM'); } catch { } return { ok: true }; }
  return { disponibile, avvia, ferma };
}
