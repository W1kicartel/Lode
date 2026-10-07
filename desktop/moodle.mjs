// Moodle in sola lettura: i corsi, i file nuovi (PDF, slide, dispense) e le scadenze dalla piattaforma del tuo ateneo
// (Virtuale a Bologna, myAriel a Milano e tanti altri e-learning: quasi tutti sono Moodle con il servizio per l'app attivo).
// Si entra come fa l'app Moodle ufficiale:
// - SSO (SPID, Shibboleth, il login dell'ateneo): la pagina di accesso dell'ateneo si apre in una finestra di Lode
//   (admin/tool/mobile/launch.php); alla fine Moodle manda a moodlemobile://token=…, che Lode intercetta. La password
//   Lode non la vede mai;
// - utente e password (gli atenei senza SSO): login/token.php. La password non si salva, serve una volta sola.
// Il token resta in userData/config.json cifrato con il portachiavi del sistema (safeStorage), mai nel vault (che si
// sincronizza e si condivide). Lode legge e basta: non consegna compiti, non scrive nei forum, non cambia niente.
// La barra non vede indirizzi né token: chiede i file per indice (come la sincronizzazione sceglie le cartelle).
import { createHash, randomBytes } from 'node:crypto';

const SERVIZIO = 'moodle_mobile_app', MAX_FILE = 80 * 1048576;
// «virtuale.unibo.it», «https://virtuale.unibo.it/my/», «elearning.unimib.it/login/index.php» → https://host[/percorso]
export function normalizzaSito(x) {
  let s = String(x || '').trim().replace(/\s+/g, '');
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u; try { u = new URL(s); } catch { return null; }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return null;
  const p = u.pathname.replace(/\/(?:my|login|course|mod|admin|user|calendar|webservice)(?:\/.*)?$/i, '').replace(/\/(?:index\.php)?$/i, '').replace(/\/+$/, '');
  return `${u.protocol}//${u.host}${p}`;
}
// i parametri come li vuole Moodle: courseids[0]=3, options[0][name]=…
export function formParametri(o, pre = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(o || {})) {
    const n = pre ? `${pre}[${k}]` : k;
    if (v == null) continue;
    if (typeof v === 'object') formParametri(v, n, out); else out.append(n, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return out;
}
// moodlemobile://token=BASE64 → il token, se la firma è quella del nostro passport (md5(sito + passport))
export function leggiToken(url, { sito, passport }) {
  const m = String(url || '').match(/^moodlemobile:\/\/token=([A-Za-z0-9+/=_-]+)/); if (!m) return null;
  let testo; try { testo = Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch { return null; }
  const [firma, token] = testo.split(':::');
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return null;
  const attese = [sito, sito.replace(/^https:/, 'http:')].map(s => createHash('md5').update(s + passport).digest('hex'));
  return attese.includes(firma) ? token : null;
}
const testoDaHtml = h => String(h || '').replace(/<\s*(?:br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '- ').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

/* ---------- il client: solo letture, con il fetch che gli si dà (net.fetch nell'app, quello delle prove nei test) ---------- */
export function client({ sito, token, fetch: f }) {
  async function chiama(funzione, args = {}) {
    const corpo = formParametri({ ...args, wstoken: token, wsfunction: funzione, moodlewsrestformat: 'json' });
    const r = await f(`${sito}/webservice/rest/server.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corpo.toString() });
    if (!r.ok) throw new Error(`Moodle risponde ${r.status}`);
    const j = await r.json();
    if (j && j.exception) { const e = new Error(j.message || j.errorcode || 'errore di Moodle'); e.codice = j.errorcode; throw e; }
    return j;
  }
  return {
    chiama,
    info: () => chiama('core_webservice_get_site_info'),
    corsi: userid => chiama('core_enrol_get_users_courses', { userid }),
    contenuti: courseid => chiama('core_course_get_contents', { courseid }),
    corso: id => chiama('core_course_get_courses_by_field', { field: 'id', value: id }).then(r => r?.courses?.[0] || null),
    scadenze: (da, a) => chiama('core_calendar_get_action_events_by_timesort', { timesortfrom: da, timesortto: a, limitnum: 50 }),
  };
}
// i file di un corso (dalle sezioni e dai moduli): nome, modulo, sezione, quando è cambiato, dimensione, indirizzo
export function fileDelCorso(sezioni) {
  const out = [];
  for (const s of sezioni || []) for (const m of s.modules || []) {
    if (m.visible === 0 || m.uservisible === false) continue;
    for (const c of m.contents || []) {
      if (c.type !== 'file' || !c.fileurl || !c.filename) continue;
      out.push({ nome: c.filename, modulo: m.name || '', sezione: s.name || '', quando: (c.timemodified || c.timecreated || 0) * 1000, mb: (c.filesize || 0) / 1048576, url: c.fileurl, mime: c.mimetype || '' });
    }
  }
  return out;
}
// la configurazione pubblica del sito (senza login): nome, tipo di accesso, indirizzo per l'SSO
export async function configPubblica(sito, f) {
  const r = await f(`${sito}/lib/ajax/service-nologin.php?info=tool_mobile_get_public_config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ index: 0, methodname: 'tool_mobile_get_public_config', args: {} }]) });
  if (!r.ok) throw new Error(`il sito risponde ${r.status}`);
  const j = await r.json(), x = Array.isArray(j) ? j[0] : null;
  if (!x || x.error || !x.data) throw new Error(x?.exception?.message || 'non è un Moodle, o il servizio per le app è spento');
  const d = x.data;
  // typeoflogin: 1 = utente e password nell'app, 2 = nel browser, 3 = nel browser incorporato
  return { nome: testoDaHtml(d.sitename) || sito, sito: (d.httpswwwroot || d.wwwroot || sito).replace(/\/+$/, ''), tipo: d.typeoflogin === 1 ? 'password' : 'browser', lancio: d.launchurl || `${sito}/admin/tool/mobile/launch.php` };
}

/* ---------- nel main: i canali per la barra ---------- */
export function registra({ ipcMain, BrowserWindow, safeStorage, conf, salvaConf, fetch: f, manda = () => { } }) {
  let token = null, cacheFile = [], finestra = null;
  const c = () => conf().moodle || null;
  const cifra = t => safeStorage?.isEncryptionAvailable?.() ? { cifrato: safeStorage.encryptString(t).toString('base64') } : null;   // senza portachiavi: solo in memoria, fino all'uscita
  const tokenSalvato = () => { if (token) return token; const m = c(); if (m?.token?.cifrato) { try { token = safeStorage.decryptString(Buffer.from(m.token.cifrato, 'base64')); } catch { } } return token; };
  const cl = () => { const m = c(), t = tokenSalvato(); if (!m || !t) throw new Error('Moodle non è collegato'); return client({ sito: m.sito, token: t, fetch: f }); };
  const stato = () => { const m = c(); return m ? { collegato: !!tokenSalvato(), sito: m.sito.replace(/^https?:\/\//, ''), nome: m.nome, utente: m.utente, corsi: m.corsi || {}, ultimo: m.ultimo || 0, memoria: !m.token?.cifrato } : { collegato: false }; };
  async function salvaToken(sito, nome, t) {
    const info = await client({ sito, token: t, fetch: f }).info();
    token = t;
    conf().moodle = { sito, nome: testoDaHtml(info.sitename) || nome, utente: info.fullname || info.username || '', userid: info.userid, token: cifra(t), corsi: conf().moodle?.sito === sito ? conf().moodle.corsi || {} : {}, ultimo: 0 };
    salvaConf(); return stato();
  }
  ipcMain.handle('moodle:stato', () => stato());
  ipcMain.handle('moodle:verifica', async (_, indirizzo) => {
    const sito = normalizzaSito(indirizzo); if (!sito) return { ok: false, motivo: 'indirizzo' };
    try { const p = await configPubblica(sito, f); return { ok: true, nome: p.nome, tipo: p.tipo, sito: p.sito.replace(/^https?:\/\//, '') }; }
    catch (e) { return { ok: false, motivo: e.message }; }
  });
  // utente e password: la password va solo a Moodle (login/token.php, in POST) e non si salva da nessuna parte
  ipcMain.handle('moodle:accedi', async (_, { indirizzo, utente, password }) => {
    const sito = normalizzaSito(indirizzo); if (!sito) return { ok: false, motivo: 'indirizzo' };
    try {
      const p = await configPubblica(sito, f);
      const r = await f(`${p.sito}/login/token.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: utente, password, service: SERVIZIO }).toString() });
      const j = await r.json();
      if (!j.token) return { ok: false, motivo: j.error || 'accesso non riuscito' };
      return { ok: true, ...(await salvaToken(p.sito, p.nome, j.token)) };
    } catch (e) { return { ok: false, motivo: e.message }; }
  });
  // SSO: la pagina dell'ateneo in una finestra di Lode (sessione a parte, «moodle»); il token arriva su moodlemobile://
  ipcMain.handle('moodle:accediBrowser', async (_, indirizzo) => {
    const sito0 = normalizzaSito(indirizzo); if (!sito0) return { ok: false, motivo: 'indirizzo' };
    let p; try { p = await configPubblica(sito0, f); } catch (e) { return { ok: false, motivo: e.message }; }
    finestra?.close();
    const passport = randomBytes(12).toString('hex');
    const url = `${p.lancio}${p.lancio.includes('?') ? '&' : '?'}service=${SERVIZIO}&passport=${passport}&urlscheme=moodlemobile`;
    return new Promise(ok => {
      const w = finestra = new BrowserWindow({ width: 520, height: 760, title: `Accedi a ${p.nome}`, autoHideMenuBar: true, webPreferences: { partition: 'moodle', contextIsolation: true, nodeIntegration: false, sandbox: true } });
      let finito = false;
      const fine = r => { if (finito) return; finito = true; clearTimeout(t); if (!w.isDestroyed()) w.close(); if (finestra === w) finestra = null; ok(r); };
      const prova = (e, u) => {
        if (!String(u).startsWith('moodlemobile://')) return;
        e?.preventDefault?.();
        const tk = leggiToken(u, { sito: p.sito, passport });
        if (!tk) return fine({ ok: false, motivo: 'risposta di Moodle non valida' });
        salvaToken(p.sito, p.nome, tk).then(s => fine({ ok: true, ...s }), err => fine({ ok: false, motivo: err.message }));
      };
      w.webContents.on('will-navigate', prova); w.webContents.on('will-redirect', prova); w.webContents.on('will-frame-navigate', d => prova(d, d.url));
      w.webContents.on('did-fail-provisional-load', (_e, _c, _d, u) => prova(null, u));
      // i popup dell'SSO (SPID, alcuni IdP) restano nella stessa sessione; i link verso altri siti vanno nel browser
      w.webContents.setWindowOpenHandler(() => ({ action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { partition: 'moodle', sandbox: true } } }));
      w.on('closed', () => fine({ ok: false, motivo: 'finestra chiusa' }));
      const t = setTimeout(() => fine({ ok: false, motivo: 'tempo scaduto' }), 15 * 60e3);
      w.loadURL(url).catch(() => { });
    });
  });
  ipcMain.handle('moodle:scollega', () => { token = null; cacheFile = []; delete conf().moodle; salvaConf(); return stato(); });
  ipcMain.handle('moodle:corsi', async () => {
    const m = c(), x = cl();
    const corsi = await x.corsi(m.userid);
    return (corsi || []).filter(k => k.visible !== 0).map(k => ({ id: k.id, nome: testoDaHtml(k.fullname), breve: testoDaHtml(k.shortname), fine: k.enddate ? k.enddate * 1000 : 0 }));
  });
  // quali corsi seguire e con quale nome di Lode: { idMoodle: 'Analisi 2' } (null = non seguire)
  ipcMain.handle('moodle:segui', (_, corsi) => { const m = c(); if (!m) return stato(); m.corsi = Object.fromEntries(Object.entries(corsi || {}).filter(([k, v]) => /^\d+$/.test(k) && typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 120)])); salvaConf(); return stato(); });
  // i file dei corsi seguiti, dal più recente; «nuovi» quelli cambiati dopo l'ultimo controllo. Gli indirizzi restano qui
  ipcMain.handle('moodle:novita', async (_, { segna = false } = {}) => {
    const m = c(), x = cl(), da = m.ultimo || 0, out = [];
    for (const [id, nome] of Object.entries(m.corsi || {})) {
      try { for (const fl of fileDelCorso(await x.contenuti(+id))) out.push({ ...fl, corso: nome, corsoId: +id, nuovo: fl.quando > da }); }
      catch (e) { out.push({ errore: e.message, corso: nome, corsoId: +id }); }
    }
    const file = out.filter(y => !y.errore).sort((a, b) => b.quando - a.quando);
    cacheFile = file;
    if (segna) { m.ultimo = Date.now(); salvaConf(); }
    return { file: file.slice(0, 80).map(({ url, ...y }, i) => ({ ...y, i })), errori: out.filter(y => y.errore), primaVolta: !da };
  });
  ipcMain.handle('moodle:segnaVisti', () => { const m = c(); if (m) { m.ultimo = Date.now(); salvaConf(); } return true; });
  // un file dalla lista appena letta (per indice): i byte alla barra, che lo tratta come un file trascinato
  ipcMain.handle('moodle:scarica', async (_, i) => {
    const fl = cacheFile[i], t = tokenSalvato(); if (!fl || !t) return { ok: false, motivo: 'file non trovato' };
    if (fl.mb > MAX_FILE / 1048576) return { ok: false, motivo: 'file troppo grande' };
    // il token va solo al sito di Moodle: un indirizzo di un altro host (link esterni nei contenuti) non lo riceve
    const u = new URL(fl.url); if (u.host !== new URL(c().sito).host) return { ok: false, motivo: 'il file non sta su Moodle' };
    u.searchParams.set('token', t);
    const r = await f(u.toString()); if (!r.ok) return { ok: false, motivo: `Moodle risponde ${r.status}` };
    const b = new Uint8Array(await r.arrayBuffer()); if (b.length > MAX_FILE) return { ok: false, motivo: 'file troppo grande' };
    return { ok: true, nome: fl.nome, mime: fl.mime || r.headers.get('content-type') || '', dati: b, corso: fl.corso };
  });
  ipcMain.handle('moodle:scadenze', async () => {
    const x = cl(), ora = Math.floor(Date.now() / 1000), r = await x.scadenze(ora, ora + 45 * 86400), m = c();
    return (r?.events || []).map(e => ({ nome: testoDaHtml(e.name), corso: m.corsi?.[e.course?.id] || testoDaHtml(e.course?.fullname || ''), quando: e.timesort * 1000, tipo: e.modulename || e.eventtype || '' })).sort((a, b) => a.quando - b.quando);
  });
  // la descrizione del corso (spesso è il programma): per «programma di …» senza incollare niente
  ipcMain.handle('moodle:descrizione', async (_, id) => { const k = await cl().corso(+id); return k ? { nome: testoDaHtml(k.fullname), testo: testoDaHtml(k.summary) } : null; });
  return { stato };
}
