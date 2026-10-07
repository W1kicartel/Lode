// Lode prepara il computer dello studente, sempre col suo consenso dal pannello:
//  1. Obsidian ufficiale, scaricato da github.com/obsidianmd/obsidian-releases (gratis per uso personale; non lo
//     ridistribuiamo noi) e aperto già sul vault di Lode;
//  2. il «cervello locale»: Ollama più un modello Qwen3.5 scelto in base alla memoria del computer, per estrarre
//     definizioni dagli appunti, creare carte, spiegare e interrogare senza chiavi e senza internet.
import { shell, net } from 'electron';
import { createWriteStream, existsSync, mkdirSync, rmSync, accessSync, constants, chmodSync, writeFileSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { homedir, totalmem, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { t, numero, lingua } from './lingua.mjs';

const MAC = process.platform === 'darwin', WIN = process.platform === 'win32';
const esegui = (cmd, args, opz = {}) => new Promise((ok, ko) => execFile(cmd, args, { maxBuffer: 1 << 24, ...opz }, (e, out, err) => e ? ko(new Error((err || e.message).toString().trim())) : ok(out.toString())));
const scrivibile = d => { try { mkdirSync(d, { recursive: true }); accessSync(d, constants.W_OK); return true; } catch { return false; } };
const cartellaApp = () => process.env.LODE_APPS || (scrivibile('/Applications') ? '/Applications' : join(homedir(), 'Applications'));
// avvia un programma staccato da Lode (non si chiude con Lode, niente output); true se è partito
const lancia = (exe, args = []) => new Promise(ok => { try { const p = spawn(exe, args, { detached: true, stdio: 'ignore' }); p.once('error', () => ok(false)); p.once('spawn', () => { p.unref(); ok(true); }); } catch { ok(false); } });
// la cartella temporanea si toglie in sottofondo e senza errori: su Windows l'antivirus tiene a volte l'installer ancora aperto
const pulisci = d => rm(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }).catch(() => { });
// internet passa dalla rete di Chromium: certificati e proxy del sistema, come il browser (su Windows l'antivirus che
// ispeziona HTTPS aggiunge un suo certificato che il fetch di Node non conosce). Ollama in locale resta sul fetch di Node.
export const rete = (url, opz) => net?.fetch ? net.fetch(url, opz) : fetch(url, opz);

// scarica un file con l'avanzamento (0-1)
async function scarica(url, dest, avanza) {
  const r = await rete(url, { redirect: 'follow', headers: { 'User-Agent': 'Lode' } });
  if (!r.ok) throw new Error(t('desktop.installa-download-non-riuscito', { stato: r.status }));
  const tot = +r.headers.get('content-length') || 0; let fatto = 0, ultimo = 0;
  const conta = new TransformStream({ transform(pezzo, c) { fatto += pezzo.byteLength; const t = Date.now(); if (tot && t - ultimo > 150) { ultimo = t; avanza(fatto / tot, fatto); } c.enqueue(pezzo); } });
  await pipeline(Readable.fromWeb(r.body.pipeThrough(conta)), createWriteStream(dest));
  avanza(1, fatto);
}

/* ---------- chi ha firmato gli installer ---------- */
// Prima di installare, il file scaricato deve essere firmato proprio da chi fa Obsidian o Ollama: una firma valida
// qualunque (ad hoc, o di un altro sviluppatore) non basta. Se la verifica non passa non si installa niente e lo studente
// legge perché. Protegge da un file sostituito lungo la strada (release compromessa, proxy o antivirus che ispeziona HTTPS).
// • Mac: il Team ID dello sviluppatore nel requisito di codesign. Il «=» subito dopo -R dice che il requisito è un testo:
//   senza, codesign lo prenderebbe per il percorso di un file e la verifica fallirebbe sempre.
// • Windows: Get-AuthenticodeSignature, firma «Valid» e il nome dell'editore (CN del certificato).
// • Linux: l'AppImage di Obsidian non ha una firma da controllare; arriva in HTTPS dalle release ufficiali su GitHub.
// Letti il 2 ottobre 2026 dagli installer ufficiali: Mac con codesign -dv --verbose=4 sulle app, Windows dalla tabella dei
// certificati degli .exe (Obsidian 1.13.7, OllamaSetup.exe). Se un giorno cambiano, la verifica fallisce col messaggio qui
// sotto: si ricontrollano allo stesso modo e si aggiornano qui.
export const FIRME = {
  obsidian: { nome: 'Obsidian', team: '6JSW4SJWN9', editore: 'Dynalist Inc' },   // Dynalist Inc., chi fa Obsidian
  ollama: { nome: 'Ollama', team: '3MU9H2V9Y9', editore: 'Ollama Inc.' },       // sul Mac il team è Infra Technologies, Inc
};
export const requisitoMac = team => `=anchor apple generic and certificate leaf[subject.OU] = "${team}"`;
// dal soggetto del certificato (come lo scrive PowerShell: «CN=Ollama Inc., O=Ollama Inc., L=Toronto, …») il nome comune
export const nomeComune = soggetto => String(soggetto || '').match(/(?:^|,\s*)CN=(?:"([^"]+)"|([^,]+))/)?.slice(1).find(Boolean)?.trim() || '';
const nonFirmato = nome => new Error(t('desktop.installa-non-firmato', { nome }));
async function verificaFirma(chi, percorso) {
  const f = FIRME[chi];
  if (MAC) { try { await esegui('codesign', ['--verify', '--deep', '--strict', '-R', requisitoMac(f.team), percorso]); } catch { throw nonFirmato(f.nome); } return; }
  if (!WIN) return;
  // il percorso passa da una variabile d'ambiente, non dentro il comando: niente da interpretare per PowerShell
  const ps = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  // PSModulePath si toglie: se Lode è partita da PowerShell 7 (un terminale, o le prove su GitHub) quella variabile punta ai
  // moduli di PowerShell 7 e il PowerShell di Windows non carica più Get-AuthenticodeSignature: uscita vuota, «nessuna firma»
  const env = { ...process.env, FILE_DA_VERIFICARE: percorso }; delete env.PSModulePath;
  let out = '';
  try { out = await esegui(ps, ['-NoProfile', '-NonInteractive', '-Command', '$s = Get-AuthenticodeSignature -LiteralPath $env:FILE_DA_VERIFICARE; "$($s.Status)|$($s.SignerCertificate.Subject)"'], { env, windowsHide: true, timeout: 120e3 }); }
  catch (e) { console.warn(`Lode: verifica della firma di ${f.nome} non riuscita: ${String(e.message).slice(0, 300)}`); }
  const [stato, soggetto] = out.trim().split('|');
  if (stato !== 'Valid' || nomeComune(soggetto) !== f.editore) { console.warn(`Lode: firma di ${f.nome} non valida (${stato || 'nessuna'} · ${soggetto || '—'})`); throw nonFirmato(f.nome); }
}

/* ---------- Obsidian ---------- */
export function percorsiObsidian() {
  if (MAC) return ['/Applications/Obsidian.app', join(homedir(), 'Applications', 'Obsidian.app'), ...(process.env.LODE_APPS ? [join(process.env.LODE_APPS, 'Obsidian.app')] : [])];
  if (WIN) return [join(process.env.LOCALAPPDATA || '', 'Programs', 'Obsidian', 'Obsidian.exe'), join(process.env.LOCALAPPDATA || '', 'Obsidian', 'Obsidian.exe'),
    ...[process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).map(d => join(d, 'Obsidian', 'Obsidian.exe'))];   // installato per tutti gli utenti
  return [join(homedir(), 'Applications', 'Obsidian.AppImage'), '/usr/bin/obsidian', '/opt/Obsidian/obsidian'];
}
export const obsidianInstallato = () => percorsiObsidian().some(existsSync);
async function ultimaObsidian() {
  const r = await rete('https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/desktop-releases.json', { headers: { 'User-Agent': 'Lode' } });
  const v = (await r.json()).latestVersion;
  if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error(t('desktop.installa-versione-obsidian'));
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
    avanza({ fase: 'scarico', testo: t('desktop.installa-scarico-obsidian', { versione: v }) });
    await scarica(url, file, (p, b) => avanza({ fase: 'scarico', p, testo: t('desktop.installa-scarico-obsidian-mb', { versione: v, mb: Math.round(b / 1e6) }) }));
    avanza({ fase: 'installo', testo: t('desktop.installa-installo-obsidian') });
    if (MAC) {
      const mnt = join(tmp, 'mnt');
      await esegui('hdiutil', ['attach', '-nobrowse', '-noautoopen', '-readonly', '-mountpoint', mnt, file]);
      try {
        await verificaFirma('obsidian', join(mnt, 'Obsidian.app'));   // firmata da chi fa Obsidian (Team ID), non da uno qualunque
        const dest = join(cartellaApp(), 'Obsidian.app');
        rmSync(dest, { recursive: true, force: true });
        await esegui('ditto', [join(mnt, 'Obsidian.app'), dest]);
      } finally { await esegui('hdiutil', ['detach', mnt, '-quiet']).catch(() => { }); }
    } else if (WIN) {
      await verificaFirma('obsidian', file);   // prima la firma (Dynalist Inc), poi l'installazione
      await esegui(file, ['/S']);   // installer NSIS di Obsidian, per l'utente (niente amministratore)
    } else {
      const dest = join(homedir(), 'Applications', 'Obsidian.AppImage'); mkdirSync(join(homedir(), 'Applications'), { recursive: true });
      await esegui('cp', [file, dest]); chmodSync(dest, 0o755);
    }
    preparaListaVault(confObsidian, vault);
    avanza({ fase: 'fatto', p: 1, testo: t('desktop.installa-obsidian-installato', { versione: v }) });
    return { versione: v };
  } finally { pulisci(tmp); }
}
export async function apriObsidian(url) {
  if (process.env.LODE_NON_APRIRE) return;   // solo per le prove
  if (MAC) { const app = percorsiObsidian().find(existsSync); if (app) { await esegui('open', ['-a', app, ...(url ? [url] : [])]).catch(() => shell.openExternal(url)); return; } }
  // Windows: obsidian:// lo registra Obsidian al primo avvio, che l'installazione silenziosa non fa: apriamo l'exe col link
  if (WIN) { const exe = percorsiObsidian().find(existsSync); if (exe && await lancia(exe, url ? [url] : [])) return; }
  if (url) await shell.openExternal(url);
}

/* ---------- il cervello locale: Ollama + Qwen3.5 ---------- */
export const OLLAMA = 'http://127.0.0.1:11434';
// il modello giusto per la memoria del computer: abbastanza piccolo da girare liscio mentre lo studente usa altre app
const schedaNvidia = () => WIN ? existsSync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'nvidia-smi.exe')) : existsSync('/usr/bin/nvidia-smi') || existsSync('/usr/local/bin/nvidia-smi');
export function modelloConsigliato() {
  // Qwen3.5 (Alibaba, Apache 2.0, legge anche le immagini). Sulle slide di Analisi 2 il 4B ha scritto 11 carte tutte
  // fedeli in 33 s; Gemma 3 4B 18 carte in 43 s, circa 7 sbagliate o inventate. Il 35B-A3B è «a esperti»: grande ma
  // veloce come un 3B, solo dove la memoria lo permette (9B e 35B-A3B non ancora provati su un computer vero).
  const gb = totalmem() / 2 ** 30;
  // fuori dai Mac con chip Apple (memoria unificata) la memoria non basta: senza una scheda video il modello gira sul
  // processore, e un 9B sarebbe lentissimo. Lì il 9B solo con una NVIDIA; altrimenti il 4B.
  if (!(MAC && process.arch === 'arm64') && !schedaNvidia()) return { nome: 'qwen3.5:4b', etichetta: 'Qwen3.5 4B', gb: 3.4, perche: t('desktop.installa-perche-4b') };
  if (gb >= 40) return { nome: 'qwen3.5:35b-a3b', etichetta: 'Qwen3.5 35B-A3B', gb: 24, perche: t('desktop.installa-perche-35b') };
  if (gb >= 15) return { nome: 'qwen3.5:9b', etichetta: 'Qwen3.5 9B', gb: 6.6, perche: t('desktop.installa-perche-9b') };
  return { nome: 'qwen3.5:4b', etichetta: 'Qwen3.5 4B', gb: 3.4, perche: t('desktop.installa-perche-memoria', { gb: Math.round(gb) }) };
}
export async function statoOllama() {
  const installato = MAC ? ['/Applications/Ollama.app', join(homedir(), 'Applications', 'Ollama.app')].some(existsSync) || existsSync('/usr/local/bin/ollama')
    : WIN ? existsSync(join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe')) : existsSync('/usr/local/bin/ollama') || existsSync('/usr/bin/ollama');
  let acceso = false, modelli = [];
  try { const r = await fetch(OLLAMA + '/api/tags', { signal: AbortSignal.timeout(4000) }); if (r.ok) { acceso = true; modelli = (await r.json()).models?.map(m => m.name) || []; } } catch { }
  return { installato: installato || acceso, acceso, modelli };
}
async function aspettaOllama(sec = 60) {
  for (let i = 0; i < sec * 2; i++) { if ((await statoOllama()).acceso) return true; await new Promise(r => setTimeout(r, 500)); }
  throw new Error(t('desktop.installa-ollama-non-avviato'));
}
export async function avviaOllama() {
  if ((await statoOllama()).acceso) return true;
  if (MAC) { const a = [join(cartellaApp(), 'Ollama.app'), '/Applications/Ollama.app', join(homedir(), 'Applications', 'Ollama.app')].find(existsSync); if (a) await esegui('open', ['-g', '-a', a]); }
  // Windows: «hidden» resta nell'area di notifica senza rubare il fuoco; staccato, così non si chiude con Lode
  else if (WIN) { const e = join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama app.exe'); if (existsSync(e)) await lancia(e, ['hidden']); }
  return aspettaOllama();
}
export async function installaOllama({ avanza }) {
  if (!MAC && !WIN) throw new Error(t('desktop.installa-ollama-linux'));
  const tmp = join(tmpdir(), 'lode-' + randomBytes(4).toString('hex')); mkdirSync(tmp, { recursive: true });
  try {
    const url = MAC ? 'https://ollama.com/download/Ollama-darwin.zip' : 'https://ollama.com/download/OllamaSetup.exe';
    const file = join(tmp, MAC ? 'Ollama.zip' : 'OllamaSetup.exe');
    await scarica(url, file, (p, b) => avanza({ fase: 'scarico', p, testo: t('desktop.installa-scarico-ollama-mb', { mb: Math.round(b / 1e6) }) }));
    avanza({ fase: 'installo', testo: t('desktop.installa-installo-ollama') });
    if (MAC) {
      await esegui('ditto', ['-x', '-k', file, tmp]);
      await verificaFirma('ollama', join(tmp, 'Ollama.app'));   // firmata da chi fa Ollama (Team ID), non da uno qualunque
      const dest = join(cartellaApp(), 'Ollama.app'); rmSync(dest, { recursive: true, force: true });
      await esegui('ditto', [join(tmp, 'Ollama.app'), dest]);
    } else { await verificaFirma('ollama', file); await esegui(file, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART']); }   // prima la firma (Ollama Inc.)
    avanza({ fase: 'avvio', testo: t('desktop.installa-avvio-ollama') });
    await (WIN ? aspettaOllama(20).catch(() => avviaOllama()) : avviaOllama());   // su Windows lo avvia già l'installer: non ne apriamo un secondo
    return true;
  } finally { pulisci(tmp); }
}
// i GB scaricati: in italiano col punto di sempre («1.2 di 3.4 GB»), nelle altre lingue come scrive il loro paese
const gb = byte => lingua() === 'it' ? (byte / 1e9).toFixed(1) : numero(byte / 1e9, 1);
export async function scaricaModello(nome, avanza) {
  await avviaOllama();
  const r = await fetch(OLLAMA + '/api/pull', { method: 'POST', body: JSON.stringify({ model: nome, stream: true }) });
  if (!r.ok || !r.body) throw new Error(t('desktop.installa-ollama-non-risponde'));
  const lettore = r.body.getReader(), dec = new TextDecoder(); let resto = '', ultimo = 0;
  for (; ;) {
    const { done, value } = await lettore.read(); if (done) break;
    resto += dec.decode(value, { stream: true });
    const righe = resto.split('\n'); resto = righe.pop();
    for (const riga of righe) {
      if (!riga.trim()) continue; const x = JSON.parse(riga);
      if (x.error) throw new Error(x.error);
      const adesso = Date.now();
      if (x.total && x.completed && adesso - ultimo > 200) { ultimo = adesso; avanza({ fase: 'scarico', p: x.completed / x.total, testo: t('desktop.installa-scarico-modello', { nome, fatti: gb(x.completed), totale: gb(x.total) }) }); }
    }
  }
  avanza({ fase: 'fatto', p: 1, testo: t('desktop.installa-modello-pronto', { nome }) });
  return true;
}
// una chat col modello locale, in streaming: i pezzi arrivano a chi chiama
// quanto resta in memoria il modello dopo l'ultima risposta: su un portatile da 8 GB (il modello ne prende 4) si libera
// presto, così il resto del computer non va in swap; ricaricarlo dal disco costa 2-4 secondi alla prima domanda dopo
export const CALDO = totalmem() <= 9 * 2 ** 30 ? '4m' : '15m';
export async function chatLocale({ modello, messaggi, formato, segnale, pezzo }) {
  await avviaOllama();
  const r = await fetch(OLLAMA + '/api/chat', { method: 'POST', signal: segnale, body: JSON.stringify({ model: modello, messages: messaggi, stream: true, ...(formato ? { format: formato } : {}), ...(/^qwen3/.test(modello) ? { think: false } : {}), options: { temperature: formato ? 0.2 : 0.6, num_ctx: 8192, num_predict: 4096 }, keep_alive: CALDO }) });
  if (!r.ok || !r.body) throw new Error(r.status === 404 ? t('desktop.installa-modello-assente', { modello }) : t('desktop.installa-modello-non-risponde'));
  const lettore = r.body.getReader(), dec = new TextDecoder(); let resto = '', tutto = '';
  for (; ;) {
    const { done, value } = await lettore.read(); if (done) break;
    resto += dec.decode(value, { stream: true });
    const righe = resto.split('\n'); resto = righe.pop();
    for (const riga of righe) { if (!riga.trim()) continue; const x = JSON.parse(riga); if (x.error) throw new Error(x.error); const t = x.message?.content || ''; if (t) { tutto += t; pezzo?.(t); } }
  }
  return tutto;
}
