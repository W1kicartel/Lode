// L'accesso SSO a Moodle con Electron vero (desktop/moodle.mjs, moodle:accediBrowser): la finestra apre launch.php del
// Moodle finto, che manda a moodlemobile://token=… con un redirect HTTP e poi con JavaScript dopo un «login».
// Dalla cartella desktop: npx electron ../test/moodle-sso.mjs
import { app, BrowserWindow, ipcMain, safeStorage, net } from 'electron';
import http from 'node:http';
import { createHash } from 'node:crypto';
import * as M from '../desktop/moodle.mjs';

const TOKEN = 'b'.repeat(32);
let modo = 'redirect';
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), base = `http://127.0.0.1:${server.address().port}/moodle`;
  const json = x => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(x)); };
  if (u.pathname === '/moodle/lib/ajax/service-nologin.php') return json([{ error: false, data: { sitename: 'Ateneo finto', httpswwwroot: base, typeoflogin: 2, launchurl: `${base}/admin/tool/mobile/launch.php` } }]);
  if (u.pathname === '/moodle/admin/tool/mobile/launch.php') {
    const p = u.searchParams.get('passport'), dest = 'moodlemobile://token=' + Buffer.from(`${createHash('md5').update(base + p).digest('hex')}:::${TOKEN}`).toString('base64');
    if (u.searchParams.get('service') !== 'moodle_mobile_app' || u.searchParams.get('urlscheme') !== 'moodlemobile') { res.statusCode = 400; return res.end('parametri'); }
    if (modo === 'redirect') { res.statusCode = 303; res.setHeader('Location', dest); return res.end(); }
    // come dopo un login SSO: una pagina che porta all'app con JavaScript
    res.setHeader('Content-Type', 'text/html'); return res.end(`<p>Accesso eseguito</p><script>setTimeout(() => { location.href = ${JSON.stringify(dest)} }, 300)</script>`);
  }
  if (u.pathname === '/moodle/webservice/rest/server.php') return json({ sitename: 'Ateneo finto', fullname: 'Giulia Rossi', userid: 9 });
  res.statusCode = 404; res.end();
});
app.whenReady().then(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const canali = {}, conf = {};
  M.registra({ ipcMain: { handle: (c, f) => { canali[c] = f; } }, BrowserWindow, safeStorage, conf: () => conf, salvaConf: () => { }, fetch: (u, o) => net.fetch(u, o) });
  const sito = `http://127.0.0.1:${server.address().port}/moodle`;
  const r1 = await canali['moodle:accediBrowser'](null, sito);
  modo = 'script'; delete conf.moodle;
  const r2 = await canali['moodle:accediBrowser'](null, sito);
  await new Promise(r => setTimeout(r, 300));   // la finestra si chiude in modo asincrono
  const ok = r1.ok && r2.ok && r2.utente === 'Giulia Rossi' && conf.moodle?.token && !JSON.stringify(conf).includes(TOKEN) && BrowserWindow.getAllWindows().length === 0;
  console.log(`moodle-sso: ${ok ? 'tutto bene' : 'NON VA'} · finestre aperte ${BrowserWindow.getAllWindows().length} · token in chiaro ${JSON.stringify(conf).includes(TOKEN)} · redirect ${JSON.stringify(r1)} · javascript ${JSON.stringify(r2)}`);
  server.close(); app.exit(ok ? 0 : 1);
});
app.on('window-all-closed', () => { });
