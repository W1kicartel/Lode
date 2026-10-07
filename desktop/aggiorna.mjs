/* Gli aggiornamenti di Lode: quando su GitHub esce una versione nuova, la barra lo dice.
   Node puro, senza import di electron: le funzioni si provano fuori dall'app (test/aggiorna.mjs) e registra() riceve
   app, net, shell e ipcMain dal main, come progetto.mjs.

   CHI AGGIORNA
   - Windows (NSIS) e Linux (AppImage): electron-updater. Legge latest.yml / latest-linux.yml della Release più recente
     (rilascio.yml li carica accanto agli installer), scarica in background, controlla lo sha512 e quando è pronto la barra
     mostra «Lode X.Y.Z è pronta» con «Riavvia ora» (quitAndInstall). Se lo studente non fa niente, si installa da sola
     quando chiude Lode (autoInstallOnAppQuit).
   - Mac: electron-updater sul Mac passa da Squirrel.Mac, che accetta solo app firmate con un certificato Developer ID:
     con la firma ad hoc di oggi non funziona. Allora Lode chiede a GitHub la Release più recente (una GET all'API pubblica,
     senza chiavi), confronta le versioni e la barra offre «Scarica»: il browser scarica il .dmg.
     PRONTO PER LA FIRMA (docs/FIRMA.md): quando rilascio.yml trova il certificato firma, notarizza e costruisce anche il .zip
     che serve a Squirrel.Mac (latest-mac.yml lo elenca). All'avvio Lode guarda la propria firma (codesign -dv): se è
     «Developer ID Application» usa electron-updater come su Windows e Linux. Qui non c'è niente da cambiare; se in una
     Release manca il .zip, electron-updater si lamenta e Lode torna da sola al «Scarica» del .dmg.
   - Linux fuori da un AppImage (per esempio un pacchetto fatto a mano): solo l'avviso, come sul Mac.

   QUANDO
   Solo nell'app impacchettata (app.isPackaged): mai in sviluppo (npm start) né durante le prove (LODE_PROVA, LODE_CI).
   Un controllo un minuto e mezzo dopo l'avvio, poi ogni 6 ore. Si spegne da «Prepara Lode» o dal menu dell'icona:
   conf.aggiornamenti = false in userData/config.json (mai nel vault: è una scelta di questo computer). Spenti, non si
   controlla, non si scarica e un aggiornamento già scaricato non si installa all'uscita.

   PRIVACY
   Parte solo la richiesta a GitHub (api.github.com, github.com/W1kicartel/Lode/releases e il download dell'installer) con
   lo User-Agent «Lode/<versione>» che l'API di GitHub vuole. Niente identificativi, niente statistiche, niente server di Lode.
   Attenzione: electron-updater da solo manda a ogni controllo l'intestazione «x-user-staging-id», un UUID fisso salvato in
   userData/.updaterId (serve al rilascio «a percentuale», che Lode non usa): configura() la toglie prima che parta.

   CONTRATTO IPC (registra() li registra tutti)
   OUT (barra → main, ipcRenderer.invoke)
     aggiorna:stato     ()            → stato
     aggiorna:imposta   { attivi }    → stato           accende o spegne i controlli (conf.aggiornamenti); acceso, controlla subito
     aggiorna:riavvia   ()            → { ok } | { errore }   installa quello già scaricato e riapre Lode (se in 10 s Lode
                                                              non esce, l'installazione non è partita: errore nello stato)
     aggiorna:scarica   ()            → { ok } | { errore }   Mac: apre nel browser il .dmg letto da GitHub (mai un URL della barra)
   IN (main → barra, webContents.send)
     aggiorna:cambiato  stato
   stato = { attivi, possibile, modo: 'automatico'|'manuale'|null, fase, versione, nuova: { versione } | null, p, errore, controllato }
     fase: 'fermo' (ancora niente) | 'controllo' | 'aggiornata' | 'scarico' (p da 0 a 1) | 'pronta' (Riavvia ora)
           | 'da_scaricare' (Mac: Scarica) | 'errore' (rete assente, GitHub che non risponde: si riprova al prossimo giro) */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { t } from './lingua.mjs';

export const PROPRIETARIO = 'W1kicartel', REPO = 'Lode';
export const API_ULTIMA = `https://api.github.com/repos/${PROPRIETARIO}/${REPO}/releases/latest`;
export const PAGINA = `https://github.com/${PROPRIETARIO}/${REPO}/releases/`;   // solo gli URL che cominciano così si aprono
export const PRIMO_CONTROLLO = 90e3, OGNI = 6 * 3600e3;

/* ---------- versioni (semver.org) ---------- */
// «v0.3.0», «0.4.0-beta.2», «1.0.0+build.7» → { numeri: [1, 0, 0], pre: ['beta', 2] }; null se non è una versione
export function leggiVersione(s) {
  const m = /^\s*v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?\s*$/.exec(String(s ?? ''));
  if (!m) return null;
  return { numeri: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split('.').map(x => /^\d+$/.test(x) ? +x : x) : [] };
}
// -1, 0 o 1, con le regole di semver (§11): a parità di numeri la prerelease viene prima della versione finale
// (1.0.0-rc.1 < 1.0.0); fra prerelease si confrontano i pezzi uno per uno: numeri come numeri, numeri prima delle
// parole, parole in ordine ASCII; se un elenco finisce prima, è più piccolo (alpha < alpha.1). Il «+build» non conta.
export function confronta(a, b) {
  const x = leggiVersione(a), y = leggiVersione(b);
  if (!x || !y) throw new Error(`versione non valida: «${!x ? a : b}»`);
  for (let i = 0; i < 3; i++) if (x.numeri[i] !== y.numeri[i]) return x.numeri[i] < y.numeri[i] ? -1 : 1;
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const np = typeof p === 'number', nq = typeof q === 'number';
    if (np !== nq) return np ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}
// la candidata è più nuova di quella installata? Una versione illeggibile non lo è mai (meglio tacere che proporre a caso)
export function piuNuova(attuale, candidata) {
  try { return confronta(candidata, attuale) > 0; } catch { return false; }
}

/* ---------- la Release di GitHub ---------- */
// l'architettura scritta nel nome del file, se c'è (electron-builder: x64, arm64, ia32, armv7l, universal)
export function archDelNome(nome) {
  const s = String(nome || '').toLowerCase();
  if (/universal/.test(s)) return 'universal';
  if (/arm64|aarch64/.test(s)) return 'arm64';
  if (/armv7l/.test(s)) return 'armv7l';
  if (/x64|x86_64|amd64/.test(s)) return 'x64';
  if (/ia32|i386|x86\b/.test(s)) return 'ia32';
  return null;
}
const ESTENSIONI = { darwin: /\.dmg$/i, win32: /\.exe$/i, linux: /\.AppImage$/i };
// l'installer giusto per questo computer, da release.assets ([{ name, browser_download_url, size, state }]):
// Mac il .dmg, Windows il .exe (non il .blockmap), Linux l'AppImage. Prima quello della stessa architettura, poi
// (Mac) l'universale, poi quello senza architettura nel nome, che per electron-builder è x64 (sul Mac di Lode è universale;
// un Windows ARM fa girare l'x64). Mai un file ancora in caricamento né un URL fuori dalle Release di Lode. null se non c'è.
export function scegliAsset(release, { piattaforma, arch }) {
  const est = ESTENSIONI[piattaforma]; if (!est) return null;
  const adatti = (Array.isArray(release?.assets) ? release.assets : [])
    .filter(a => a && est.test(String(a.name || '')) && urlSicuro(a.browser_download_url) && (a.state ?? 'uploaded') === 'uploaded');
  const senzaArch = piattaforma === 'darwin' || arch === 'x64' || (piattaforma === 'win32' && arch === 'arm64');
  const a = adatti.find(x => archDelNome(x.name) === arch)
    || (piattaforma === 'darwin' && adatti.find(x => archDelNome(x.name) === 'universal'))
    || (senzaArch && adatti.find(x => !archDelNome(x.name)));
  return a ? { nome: a.name, url: a.browser_download_url, peso: +a.size || 0 } : null;
}
// solo https://github.com/W1kicartel/Lode/releases/…: la risposta dell'API decide cosa scaricare, non dove andare.
// Non basta l'inizio della stringa: «…/Lode/releases/../../../altro/repo/…» (o con %2e%2e) una volta normalizzato porta
// fuori da Lode. Quindi niente «..» né «%2e», e si guarda anche l'URL letto davvero (protocollo, host, percorso)
export const urlSicuro = u => {
  if (typeof u !== 'string' || !u.startsWith(PAGINA) || /[\s"'<>\\]|\.\.|%2e/i.test(u)) return false;
  try { const x = new URL(u); return x.protocol === 'https:' && x.host === 'github.com' && x.pathname.startsWith(`/${PROPRIETARIO}/${REPO}/releases/`); } catch { return false; }
};
// dalla risposta di /releases/latest a cosa proporre: { versione, pagina, download, peso } oppure null
// (bozza, versione illeggibile o non più nuova). /releases/latest non dà mai bozze né prerelease: il controllo resta
// per sicurezza, e una prerelease si propone solo a chi ha già un'anteprima installata.
export function daProporre(release, { versione, piattaforma, arch }) {
  if (!release || typeof release !== 'object' || release.draft) return null;
  const nuova = String(release.tag_name || '').trim().replace(/^v/, '');
  if (!leggiVersione(nuova) || !piuNuova(versione, nuova)) return null;
  if (release.prerelease && !leggiVersione(versione)?.pre.length) return null;
  const asset = scegliAsset(release, { piattaforma, arch });
  const pagina = urlSicuro(release.html_url) ? release.html_url : PAGINA + 'latest';
  return { versione: nuova, pagina, download: asset?.url || null, peso: asset?.peso || 0 };
}

/* ---------- chi aggiorna su questo computer ---------- */
// l'uscita di «codesign -dv --verbose=2 Lode.app» (va su stderr): firmata con un certificato Developer ID, o no.
// Con la firma ad hoc di oggi c'è «Signature=adhoc» e nessuna riga «Authority=».
export function firmaDeveloperId(testo) {
  const t = String(testo || '');
  return /^Authority=Developer ID Application: /m.test(t) && !/^Signature=adhoc\s*$/m.test(t);
}
// 'automatico' (electron-updater), 'manuale' (la barra avvisa e apre il download) o null (niente: sviluppo e prove)
export function modo({ piattaforma, impacchettata, env = {}, firmaMac = false }) {
  if (!impacchettata || env.LODE_PROVA || env.LODE_CI) return null;
  if (piattaforma === 'win32') return 'automatico';
  if (piattaforma === 'linux') return env.APPIMAGE ? 'automatico' : 'manuale';   // electron-updater sostituisce solo il file AppImage
  if (piattaforma === 'darwin') return firmaMac ? 'automatico' : 'manuale';
  return null;
}
// il .app che contiene l'eseguibile: /Applications/Lode.app/Contents/MacOS/Lode → /Applications/Lode.app
export const pacchettoMac = exe => String(exe || '').replace(/(\.app)\/Contents\/MacOS\/[^/]+$/, '$1');

/* ---------- latest.yml, latest-mac.yml, latest-linux.yml ---------- */
// li scrive electron-builder; li legge electron-updater. Qui servono a controllare la Release prima di pubblicarla
// (desktop/verifica-rilascio.mjs): ogni file citato deve esserci, con lo stesso nome, peso e sha512.
// Basta un lettore di righe: il formato è fisso (version, files: [- url, sha512, size], path, sha512, releaseDate).
export function leggiYml(testo) {
  const r = { versione: null, file: [], path: null, sha512: null };
  const valore = s => s.trim().replace(/^(['"])(.*)\1$/, '$2');
  let voce = null;
  for (const riga of String(testo || '').split(/\r?\n/)) {
    let m;
    if ((m = /^ {2}- (\w+):\s*(.*)$/.exec(riga))) { voce = {}; r.file.push(voce); voce[m[1]] = valore(m[2]); }
    else if ((m = /^ {4}(\w+):\s*(.*)$/.exec(riga)) && voce) voce[m[1]] = valore(m[2]);
    else if ((m = /^(\w+):\s*(.*)$/.exec(riga))) {
      voce = null;
      if (m[1] === 'version') r.versione = valore(m[2]);
      else if (m[1] === 'path') r.path = valore(m[2]);
      else if (m[1] === 'sha512') r.sha512 = valore(m[2]);
    }
  }
  r.file = r.file.map(f => ({ url: f.url || null, sha512: f.sha512 || null, size: f.size != null ? +f.size : null }));
  return r;
}
// i problemi di un latest*.yml rispetto ai file accanto (vuoto = tutto a posto). info(nome) → { size, sha512 } | null,
// con lo sha512 in base64 come lo scrive electron-builder. versione: quella che deve esserci (il tag senza «v»), facoltativa.
export function problemiYml(nomeYml, testo, info, versione) {
  const y = leggiYml(testo), p = [];
  if (!y.versione) p.push(`${nomeYml}: manca «version»`);
  else if (versione && y.versione !== versione) p.push(`${nomeYml}: version ${y.versione}, ma la Release è ${versione}`);
  if (!y.file.length) p.push(`${nomeYml}: nessun file elencato`);
  for (const f of y.file) {
    if (!f.url) { p.push(`${nomeYml}: una voce senza url`); continue; }
    if (/[/\\]|^\.|\s/.test(f.url)) { p.push(`${nomeYml}: «${f.url}» non è un nome di file semplice (GitHub lo cambierebbe)`); continue; }
    const i = info(f.url);
    if (!i) { p.push(`${nomeYml}: cita «${f.url}», che non c'è`); continue; }
    if (f.size != null && f.size !== i.size) p.push(`${nomeYml}: «${f.url}» pesa ${i.size} byte, il yml dice ${f.size}`);
    if (f.sha512 && f.sha512 !== i.sha512) p.push(`${nomeYml}: lo sha512 di «${f.url}» non combacia (firmato o cambiato dopo che il yml è stato scritto?)`);
  }
  if (y.path && !y.file.some(f => f.url === y.path)) p.push(`${nomeYml}: path «${y.path}» non è fra i file`);
  return p;
}

/* ---------- nell'app ---------- */
const breve = e => String(e?.message || e || 'errore').split('\n')[0].slice(0, 200);
// electron-updater si carica solo quando serve (Windows, Linux, Mac firmato): require dentro l'asar, niente all'avvio delle prove
export async function caricaAggiornatore() {
  const m = createRequire(import.meta.url)('electron-updater');
  return m.autoUpdater;
}
export function firmaDelPacchetto(exe) {
  return new Promise(fine => execFile('/usr/bin/codesign', ['-dv', '--verbose=2', pacchettoMac(exe)], { timeout: 8000 }, (_, out, err) => fine(String(err || '') + String(out || ''))));
}

export function registra({ ipcMain, app, net, shell, conf, salvaConf, manda, primaDiUscire = () => { }, annullaUscita = () => { }, env = process.env,
  piattaforma = process.platform, arch = process.arch, aggiornatore = caricaAggiornatore, leggiFirma = firmaDelPacchetto,
  orologio = { setTimeout, setInterval, clearTimeout, clearInterval }, primo = PRIMO_CONTROLLO, ogni = OGNI }) {
  const C = typeof conf === 'function' ? conf : () => conf;   // conf come funzione: il main la riassegna quando la rilegge
  const versione = app.getVersion();
  const S = { attivi: C().aggiornamenti !== false, possibile: false, modo: null, fase: 'fermo', versione, nuova: null, p: 0, errore: null, controllato: 0 };
  let au = null, download = null, inCorso = null, t1 = null, t2 = null, ultimoP = 0, esce = false, attesaUscita = null;
  // Lode esce davvero (anche per l'installazione): da qui in poi un «Riavvia ora» andato a vuoto non c'è più
  app.on?.('before-quit', () => { esce = true; });
  const stato = () => ({ ...S, nuova: S.nuova && { versione: S.nuova.versione } });
  const avvisa = () => { try { manda('aggiorna:cambiato', stato()); } catch { } };
  const imposta = x => { Object.assign(S, x); avvisa(); };

  // electron-updater: scarica da sé quando trova una versione nuova; gli eventi tengono lo stato
  function configura(u) {
    u.autoDownload = S.attivi; u.autoInstallOnAppQuit = S.attivi;
    u.logger = { info: () => { }, debug: () => { }, warn: x => console.warn('Lode aggiorna:', x), error: x => console.error('Lode aggiorna:', x) };
    // via l'identificativo fisso che electron-updater aggiunge a ogni controllo (x-user-staging-id, da userData/.updaterId):
    // serve solo al rilascio a percentuale, che non usiamo. Il file resta sul computer, l'intestazione non parte più
    if (typeof u.computeFinalHeaders === 'function') {
      const base = u.computeFinalHeaders.bind(u);
      u.computeFinalHeaders = h => { const x = base(h) || {}; delete x['x-user-staging-id']; return x; };
    }
    u.on('checking-for-update', () => imposta({ fase: 'controllo', errore: null }));
    u.on('update-not-available', () => imposta({ fase: 'aggiornata', nuova: null, controllato: Date.now() }));
    // da spenti (autoDownload falso) non parte nessun download: niente «scarico» che resterebbe lì per sempre
    u.on('update-available', i => imposta(u.autoDownload ? { fase: 'scarico', nuova: { versione: i.version }, p: 0, controllato: Date.now() } : { fase: 'fermo', nuova: null }));
    // l'avanzamento arriva a raffiche: alla barra solo ogni 5%
    u.on('download-progress', x => { S.p = Math.max(0, Math.min(1, (+x?.percent || 0) / 100)); if (S.p - ultimoP >= .05) { ultimoP = S.p; avvisa(); } });
    u.on('update-downloaded', i => { ultimoP = 0; imposta({ fase: 'pronta', nuova: { versione: i.version }, p: 1 }); });
    u.on('error', e => {
      // «Riavvia ora» andato a vuoto (installer sparito, avvio dell'installer non riuscito): Lode resta aperta e la barra torna
      // quella di prima, con la pillola che si richiude invece di chiudersi. La fase resta 'pronta': si riprova all'uscita
      if (S.fase === 'pronta' && attesaUscita) nonEsce(e);
      // Mac firmato ma senza il .zip nella Release (Squirrel.Mac lo vuole): si torna all'avviso col .dmg
      if (S.fase !== 'pronta') imposta({ fase: 'errore', errore: breve(e) });
      if (piattaforma === 'darwin' && S.modo === 'automatico' && /zip/i.test(breve(e))) { S.modo = 'manuale'; au = null; orologio.setTimeout(() => controlla(), 1000); }
    });
  }
  // il modo si decide una volta: sul Mac guardando la propria firma (codesign risponde in un attimo)
  let pronto = null;
  const prepara = () => pronto ||= (async () => {
    const impacchettata = !!app.isPackaged, prove = !!(env.LODE_PROVA || env.LODE_CI);
    const firmaMac = piattaforma === 'darwin' && impacchettata && !prove ? firmaDeveloperId(await leggiFirma(app.getPath('exe')).catch(() => '')) : false;
    S.modo = modo({ piattaforma, impacchettata, env, firmaMac });
    if (S.modo === 'automatico') {
      try { au = await aggiornatore(); configura(au); }
      catch (e) { console.error('Lode aggiorna: electron-updater non si carica', e); au = null; S.modo = 'manuale'; }   // almeno l'avviso
    }
    S.possibile = !!S.modo;
  })();

  async function controllaOra() {
    if (S.modo === 'automatico' && au) { (await au.checkForUpdates())?.downloadPromise?.catch(() => { }); return; }   // il resto lo fanno gli eventi (anche gli errori)
    imposta({ fase: 'controllo', errore: null });
    // al massimo 30 secondi: una rete appesa non deve bloccare i controlli dopo
    const c = new AbortController(), limite = orologio.setTimeout(() => c.abort(), 30e3);
    let release = null;
    try {
      const r = await net.fetch(API_ULTIMA, { signal: c.signal, headers: { 'User-Agent': `Lode/${versione}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
      if (r.status === 404) { download = null; return imposta({ fase: 'aggiornata', nuova: null, controllato: Date.now() }); }   // ancora nessuna Release
      if (!r.ok) throw new Error(t('desktop.aggiorna-github-risponde', { stato: r.status }));
      release = await r.json();
    } finally { orologio.clearTimeout(limite); }
    const x = daProporre(release, { versione, piattaforma, arch });
    download = x ? x.download || x.pagina : null;
    imposta(x ? { fase: 'da_scaricare', nuova: { versione: x.versione }, controllato: Date.now() } : { fase: 'aggiornata', nuova: null, controllato: Date.now() });
  }
  // un controllo alla volta; mai da spenti, mentre scarica o quando è già pronta (si installa all'uscita)
  async function controlla() {
    await prepara();
    if (!S.modo || !S.attivi || S.fase === 'pronta' || S.fase === 'scarico') return stato();
    if (!inCorso) inCorso = controllaOra().catch(e => imposta({ fase: S.fase === 'pronta' ? 'pronta' : 'errore', errore: breve(e) })).finally(() => { inCorso = null; });
    await inCorso;
    return stato();
  }
  function ferma() { orologio.clearTimeout(t1); orologio.clearInterval(t2); t1 = t2 = null; }
  function programma() {
    ferma(); if (!S.modo || !S.attivi) return;
    t1 = orologio.setTimeout(() => controlla(), primo); t1?.unref?.();
    t2 = orologio.setInterval(() => controlla(), ogni); t2?.unref?.();
  }
  async function impostaAttivi(attivi) {
    await prepara();
    S.attivi = !!attivi; C().aggiornamenti = S.attivi; salvaConf();
    if (au) { au.autoDownload = S.attivi; au.autoInstallOnAppQuit = S.attivi; }
    programma(); avvisa();
    if (S.attivi) controlla();   // riacceso: si guarda subito (senza far aspettare la barra)
    return stato();
  }
  // l'installazione non è partita: la barra torna a rifiutare la chiusura (main: uscendo = false) e lo stato lo dice
  function nonEsce(e) {
    orologio.clearTimeout(attesaUscita); attesaUscita = null;
    if (esce) return;
    annullaUscita();
    imposta({ errore: e ? t('desktop.aggiorna-non-installato-perche', { motivo: breve(e) }) : t('desktop.aggiorna-non-installato') });
  }
  async function riavvia() {
    await prepara();
    if (S.fase !== 'pronta' || !au) return { errore: t('desktop.aggiorna-niente-pronto') };
    primaDiUscire();   // i dati in sospeso sul disco, e la barra smette di rifiutare la chiusura
    orologio.setTimeout(() => { try { au.quitAndInstall(true, true); } catch (e) { console.error('Lode aggiorna:', e); nonEsce(e); } }, 50);   // Windows: in silenzio, poi riparte
    // quitAndInstall non dice se l'installer è partito (BaseUpdater.install può rispondere false senza uscire): se fra 10 s
    // Lode è ancora qui, si torna come prima
    orologio.clearTimeout(attesaUscita);
    attesaUscita = orologio.setTimeout(() => { attesaUscita = null; nonEsce(null); }, 10e3); attesaUscita?.unref?.();
    return { ok: true };
  }
  async function scarica() {
    await prepara();
    if (!download || !urlSicuro(download)) return { errore: t('desktop.aggiorna-dove-scaricare') };
    await shell.openExternal(download);
    return { ok: true };
  }
  const gestisci = (canale, f) => ipcMain.handle(canale, async (_, x) => {
    try { return await f(x && typeof x === 'object' ? x : {}); } catch (e) { console.error(`Lode ${canale}:`, e); return { errore: breve(e) }; }
  });
  gestisci('aggiorna:stato', async () => { await prepara(); return stato(); });
  gestisci('aggiorna:imposta', x => impostaAttivi(!!x.attivi));
  gestisci('aggiorna:riavvia', () => riavvia());
  gestisci('aggiorna:scarica', () => scarica());
  const avviato = prepara().then(() => { avvisa(); programma(); });
  return { stato, controlla, impostaAttivi, riavvia, scarica, ferma, avviato };
}
