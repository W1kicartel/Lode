// Lode prepara il computer dello studente, sempre col suo consenso dal pannello:
//  1. Obsidian ufficiale, scaricato da github.com/obsidianmd/obsidian-releases (gratis per uso personale; non lo
//     ridistribuiamo noi) e aperto già sul vault di Lode;
//  2. il «cervello locale»: Ollama più un modello Gemma 3 scelto in base alla memoria del computer, per estrarre
//     definizioni dagli appunti, creare carte, spiegare e interrogare senza chiavi e senza internet.
import { shell } from 'electron';
import { createWriteStream, existsSync, mkdirSync, rmSync, accessSync, constants, chmodSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { homedir, totalmem, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MAC = process.platform === 'darwin', WIN = process.platform === 'win32';
const esegui = (cmd, args, opz = {}) => new Promise((ok, ko) => execFile(cmd, args, { maxBuffer: 1 << 24, ...opz }, (e, out, err) => e ? ko(new Error((err || e.message).toString().trim())) : ok(out.toString())));
const scrivibile = d => { try { mkdirSync(d, { recursive: true }); accessSync(d, constants.W_OK); return true; } catch { return false; } };
const cartellaApp = () => process.env.LODE_APPS || (scrivibile('/Applications') ? '/Applications' : join(homedir(), 'Applications'));

// scarica un file con l'avanzamento (0-1)
async function scarica(url, dest, avanza) {
  const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Lode' } });
  if (!r.ok) throw new Error(`download non riuscito (${r.status})`);
  const tot = +r.headers.get('content-length') || 0; let fatto = 0, ultimo = 0;
  const conta = new TransformStream({ transform(pezzo, c) { fatto += pezzo.byteLength; const t = Date.now(); if (tot && t - ultimo > 150) { ultimo = t; avanza(fatto / tot, fatto); } c.enqueue(pezzo); } });
  await pipeline(Readable.fromWeb(r.body.pipeThrough(conta)), createWriteStream(dest));
  avanza(1, fatto);
}

/* ---------- Obsidian ---------- */
export function percorsiObsidian() {
  if (MAC) return ['/Applications/Obsidian.app', join(homedir(), 'Applications', 'Obsidian.app'), ...(process.env.LODE_APPS ? [join(process.env.LODE_APPS, 'Obsidian.app')] : [])];
  if (WIN) return [join(process.env.LOCALAPPDATA || '', 'Programs', 'Obsidian', 'Obsidian.exe'), join(process.env.LOCALAPPDATA || '', 'Obsidian', 'Obsidian.exe')];
  return [join(homedir(), 'Applications', 'Obsidian.AppImage'), '/usr/bin/obsidian', '/opt/Obsidian/obsidian'];
}
export const obsidianInstallato = () => percorsiObsidian().some(existsSync);
async function ultimaObsidian() {
  const r = await fetch('https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/desktop-releases.json', { headers: { 'User-Agent': 'Lode' } });
  const v = (await r.json()).latestVersion;
  if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error('versione di Obsidian sconosciuta');
  const nome = MAC ? `Obsidian-${v}.dmg` : WIN ? `Obsidian-${v}.exe` : process.arch === 'arm64' ? `Obsidian-${v}-arm64.AppImage` : `Obsidian-${v}.AppImage`;
  return { v, nome, url: `https://github.com/obsidianmd/obsidian-releases/releases/download/v${v}/${nome}` };
}
// la lista dei vault di Obsidian: se non esiste ancora (Obsidian appena installato) la creiamo con il vault di Lode aperto
export function preparaListaVault(conf, vault) {
  if (existsSync(conf)) return false;
  mkdirSync(join(conf, '..'), { recursive: true });
  writeFileSync(conf, JSON.stringify({ vaults: { [randomBytes(8).toString('hex')]: { path: resolve(vault), ts: Date.now(), open: true } } }));
  return true;
}
export async function installaObsidian({ vault, confObsidian, avanza }) {
  const { v, nome, url } = await ultimaObsidian();
  const tmp = join(tmpdir(), 'lode-' + randomBytes(4).toString('hex')); mkdirSync(tmp, { recursive: true });
  const file = join(tmp, nome);
  try {
    avanza({ fase: 'scarico', testo: `Scarico Obsidian ${v}` });
    await scarica(url, file, (p, b) => avanza({ fase: 'scarico', p, testo: `Scarico Obsidian ${v} · ${Math.round(b / 1e6)} MB` }));
    avanza({ fase: 'installo', testo: 'Installo Obsidian' });
    if (MAC) {
      const mnt = join(tmp, 'mnt');
      await esegui('hdiutil', ['attach', '-nobrowse', '-noautoopen', '-readonly', '-mountpoint', mnt, file]);
      try {
        await esegui('codesign', ['--verify', '--deep', '--strict', join(mnt, 'Obsidian.app')]);   // è davvero l'app firmata da Obsidian
        const dest = join(cartellaApp(), 'Obsidian.app');
        rmSync(dest, { recursive: true, force: true });
        await esegui('ditto', [join(mnt, 'Obsidian.app'), dest]);
      } finally { await esegui('hdiutil', ['detach', mnt, '-quiet']).catch(() => { }); }
    } else if (WIN) {
      await esegui(file, ['/S']);   // installer NSIS di Obsidian, per l'utente (niente amministratore)
    } else {
      const dest = join(homedir(), 'Applications', 'Obsidian.AppImage'); mkdirSync(join(homedir(), 'Applications'), { recursive: true });
      await esegui('cp', [file, dest]); chmodSync(dest, 0o755);
    }
    preparaListaVault(confObsidian, vault);
    avanza({ fase: 'fatto', p: 1, testo: `Obsidian ${v} installato` });
    return { versione: v };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
export async function apriObsidian(url) {
  if (process.env.LODE_NON_APRIRE) return;   // solo per le prove
  if (MAC) { const app = percorsiObsidian().find(existsSync); if (app) { await esegui('open', ['-a', app, ...(url ? [url] : [])]).catch(() => shell.openExternal(url)); return; } }
  if (url) await shell.openExternal(url);
}

/* ---------- il cervello locale: Ollama + Gemma 3 ---------- */
export const OLLAMA = 'http://127.0.0.1:11434';
// il modello giusto per la memoria del computer: abbastanza piccolo da girare liscio mentre lo studente usa altre app
export function modelloConsigliato() {
  const gb = totalmem() / 2 ** 30;
  if (gb >= 30) return { nome: 'gemma3:27b', etichetta: 'Gemma 3 27B', gb: 17, perche: 'il più bravo, per computer con molta memoria' };
  if (gb >= 15) return { nome: 'gemma3:12b', etichetta: 'Gemma 3 12B', gb: 8.1, perche: 'spiega bene e regge l\'orale' };
  return { nome: 'gemma3:4b', etichetta: 'Gemma 3 4B', gb: 3.3, perche: `leggero per ${Math.round(gb)} GB di memoria: definizioni, carte e giochi` };
}
export async function statoOllama() {
  const installato = MAC ? ['/Applications/Ollama.app', join(homedir(), 'Applications', 'Ollama.app')].some(existsSync) || existsSync('/usr/local/bin/ollama')
    : WIN ? existsSync(join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe')) : existsSync('/usr/local/bin/ollama') || existsSync('/usr/bin/ollama');
  let acceso = false, modelli = [];
  try { const r = await fetch(OLLAMA + '/api/tags', { signal: AbortSignal.timeout(1500) }); if (r.ok) { acceso = true; modelli = (await r.json()).models?.map(m => m.name) || []; } } catch { }
  return { installato: installato || acceso, acceso, modelli };
}
async function aspettaOllama(sec = 60) {
  for (let i = 0; i < sec * 2; i++) { if ((await statoOllama()).acceso) return true; await new Promise(r => setTimeout(r, 500)); }
  throw new Error('Ollama non si è avviato');
}
export async function avviaOllama() {
  if ((await statoOllama()).acceso) return true;
  if (MAC) { const a = [join(cartellaApp(), 'Ollama.app'), '/Applications/Ollama.app', join(homedir(), 'Applications', 'Ollama.app')].find(existsSync); if (a) await esegui('open', ['-g', '-a', a]); }
  else if (WIN) { const e = join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama app.exe'); if (existsSync(e)) execFile(e).unref?.(); }
  return aspettaOllama();
}
export async function installaOllama({ avanza }) {
  if (!MAC && !WIN) throw new Error('Su Linux installa Ollama da ollama.com con il loro script, poi torna qui.');
  const tmp = join(tmpdir(), 'lode-' + randomBytes(4).toString('hex')); mkdirSync(tmp, { recursive: true });
  try {
    const url = MAC ? 'https://ollama.com/download/Ollama-darwin.zip' : 'https://ollama.com/download/OllamaSetup.exe';
    const file = join(tmp, MAC ? 'Ollama.zip' : 'OllamaSetup.exe');
    await scarica(url, file, (p, b) => avanza({ fase: 'scarico', p, testo: `Scarico Ollama · ${Math.round(b / 1e6)} MB` }));
    avanza({ fase: 'installo', testo: 'Installo Ollama' });
    if (MAC) {
      await esegui('ditto', ['-x', '-k', file, tmp]);
      await esegui('codesign', ['--verify', '--deep', '--strict', join(tmp, 'Ollama.app')]);
      const dest = join(cartellaApp(), 'Ollama.app'); rmSync(dest, { recursive: true, force: true });
      await esegui('ditto', [join(tmp, 'Ollama.app'), dest]);
    } else await esegui(file, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART']);
    avanza({ fase: 'avvio', testo: 'Avvio Ollama' });
    await avviaOllama();
    return true;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
export async function scaricaModello(nome, avanza) {
  await avviaOllama();
  const r = await fetch(OLLAMA + '/api/pull', { method: 'POST', body: JSON.stringify({ model: nome, stream: true }) });
  if (!r.ok || !r.body) throw new Error('Ollama non risponde');
  const lettore = r.body.getReader(), dec = new TextDecoder(); let resto = '', ultimo = 0;
  for (; ;) {
    const { done, value } = await lettore.read(); if (done) break;
    resto += dec.decode(value, { stream: true });
    const righe = resto.split('\n'); resto = righe.pop();
    for (const riga of righe) {
      if (!riga.trim()) continue; const x = JSON.parse(riga);
      if (x.error) throw new Error(x.error);
      const t = Date.now();
      if (x.total && x.completed && t - ultimo > 200) { ultimo = t; avanza({ fase: 'scarico', p: x.completed / x.total, testo: `Scarico ${nome} · ${(x.completed / 1e9).toFixed(1)} di ${(x.total / 1e9).toFixed(1)} GB` }); }
    }
  }
  avanza({ fase: 'fatto', p: 1, testo: `${nome} pronto` });
  return true;
}
// una chat col modello locale, in streaming: i pezzi arrivano a chi chiama
export async function chatLocale({ modello, messaggi, formato, segnale, pezzo }) {
  await avviaOllama();
  const r = await fetch(OLLAMA + '/api/chat', { method: 'POST', signal: segnale, body: JSON.stringify({ model: modello, messages: messaggi, stream: true, ...(formato ? { format: formato } : {}), options: { temperature: formato ? 0.2 : 0.6, num_ctx: 8192 }, keep_alive: '15m' }) });
  if (!r.ok || !r.body) throw new Error(r.status === 404 ? `Il modello ${modello} non è installato` : 'Il modello locale non risponde');
  const lettore = r.body.getReader(), dec = new TextDecoder(); let resto = '', tutto = '';
  for (; ;) {
    const { done, value } = await lettore.read(); if (done) break;
    resto += dec.decode(value, { stream: true });
    const righe = resto.split('\n'); resto = righe.pop();
    for (const riga of righe) { if (!riga.trim()) continue; const x = JSON.parse(riga); if (x.error) throw new Error(x.error); const t = x.message?.content || ''; if (t) { tutto += t; pezzo?.(t); } }
  }
  return tutto;
}
