// Moodle in sola lettura (desktop/moodle.mjs), contro un Moodle finto in locale: node test/moodle.mjs
// Niente Electron: ipcMain, safeStorage e BrowserWindow finti. L'accesso SSO (la finestra con launch.php) ha una prova a
// parte con Electron vero: LODE_MOODLE_SSO=1 npx electron test/moodle-sso.mjs (dalla cartella desktop).
import http from 'node:http';
import { createHash } from 'node:crypto';
import * as M from '../desktop/moodle.mjs';

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };

// il Moodle finto: le risposte con la forma di quelle vere (Moodle 4.x)
const TOKEN = 'a'.repeat(32), ADESSO = Math.floor(Date.now() / 1000);
const chiamate = [];
function corpo(req) { return new Promise(r => { let b = ''; req.on('data', d => b += d); req.on('end', () => r(b)); }); }
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), b = await corpo(req), json = x => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(x)); };
  if (u.pathname === '/moodle/lib/ajax/service-nologin.php') return json([{ error: false, data: { sitename: 'Virtuale <b>prova</b>', httpswwwroot: `http://127.0.0.1:${server.address().port}/moodle`, typeoflogin: 1, launchurl: `http://127.0.0.1:${server.address().port}/moodle/admin/tool/mobile/launch.php` } }]);
  if (u.pathname === '/moodle/login/token.php') { const p = new URLSearchParams(b); return json(p.get('password') === 'giusta' && p.get('service') === 'moodle_mobile_app' ? { token: TOKEN, privatetoken: null } : { error: 'Credenziali non valide', errorcode: 'invalidlogin' }); }
  if (u.pathname === '/moodle/webservice/rest/server.php') {
    const p = new URLSearchParams(b); chiamate.push(Object.fromEntries(p));
    if (p.get('wstoken') !== TOKEN) return json({ exception: 'moodle_exception', errorcode: 'invalidtoken', message: 'Token non valido' });
    const f = p.get('wsfunction');
    if (f === 'core_webservice_get_site_info') return json({ sitename: 'Virtuale', username: 'giulia', fullname: 'Giulia Rossi', userid: 7 });
    if (f === 'core_enrol_get_users_courses') return json([{ id: 11, fullname: 'ANALISI MATEMATICA 2 &amp; ESERCITAZIONI', shortname: 'AM2', visible: 1 }, { id: 12, fullname: 'Basi di dati', shortname: 'BD', visible: 1 }, { id: 13, fullname: 'Corso nascosto', visible: 0 }]);
    if (f === 'core_course_get_contents') return json(p.get('courseid') === '11' ? [
      { name: 'Settimana 1', modules: [{ name: 'Slide lezione 1', visible: 1, contents: [{ type: 'file', filename: 'lezione1.pdf', fileurl: `http://127.0.0.1:${server.address().port}/moodle/webservice/pluginfile.php/1/lezione1.pdf`, timemodified: ADESSO - 86400 * 10, filesize: 1048576, mimetype: 'application/pdf' }] },
        { name: 'Link al libro', visible: 1, contents: [{ type: 'url', fileurl: 'https://esempio.it' }] }] },
      { name: 'Settimana 2', modules: [{ name: 'Dispensa Green', visible: 1, contents: [{ type: 'file', filename: 'green.pdf', fileurl: `http://127.0.0.1:${server.address().port}/moodle/webservice/pluginfile.php/2/green.pdf`, timemodified: ADESSO - 3600, filesize: 2048, mimetype: 'application/pdf' }] },
        { name: 'Nascosto', visible: 0, contents: [{ type: 'file', filename: 'soluzioni.pdf', fileurl: 'x', timemodified: ADESSO }] }] },
    ] : []);
    if (f === 'core_course_get_courses_by_field') return json({ courses: [{ id: 11, fullname: 'Analisi 2', summary: '<p><b>Programma</b></p><ol><li>Limiti e continuità</li><li>Derivate parziali</li></ol>' }] });
    if (f === 'core_calendar_get_action_events_by_timesort') return json({ events: [{ name: 'Consegna esercizi 3', course: { id: 11, fullname: 'Analisi 2' }, timesort: ADESSO + 86400 * 3, modulename: 'assign' }] });
    return json({ exception: 'x', errorcode: 'nofunction', message: 'funzione sconosciuta' });
  }
  if (u.pathname.startsWith('/moodle/webservice/pluginfile.php/')) { if (u.searchParams.get('token') !== TOKEN) { res.statusCode = 403; return res.end('no'); } res.setHeader('Content-Type', 'application/pdf'); return res.end('%PDF-1.4 finto'); }
  res.statusCode = 404; res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const SITO = `http://127.0.0.1:${server.address().port}/moodle`;

// le funzioni pure
prova('sito: senza https', M.normalizzaSito('virtuale.unibo.it') === 'https://virtuale.unibo.it');
prova('sito: pagine interne tolte', M.normalizzaSito('https://elearning.unimib.it/login/index.php') === 'https://elearning.unimib.it' && M.normalizzaSito('https://x.unipd.it/moodle/my/') === 'https://x.unipd.it/moodle');
prova('sito: spazzatura', M.normalizzaSito('ciao') === null && M.normalizzaSito('') === null);
prova('parametri alla Moodle', M.formParametri({ courseids: [3, 4], options: [{ name: 'a', value: true }] }).toString() === 'courseids%5B0%5D=3&courseids%5B1%5D=4&options%5B0%5D%5Bname%5D=a&options%5B0%5D%5Bvalue%5D=1');
const pass = 'abc123', firma = createHash('md5').update('https://virtuale.unibo.it' + pass).digest('hex');
prova('token SSO: firma giusta', M.leggiToken('moodlemobile://token=' + Buffer.from(`${firma}:::${TOKEN}:::privato`).toString('base64'), { sito: 'https://virtuale.unibo.it', passport: pass }) === TOKEN);
prova('token SSO: firma di un altro passport', M.leggiToken('moodlemobile://token=' + Buffer.from(`${firma}:::${TOKEN}`).toString('base64'), { sito: 'https://virtuale.unibo.it', passport: 'altro' }) === null);
prova('token SSO: non è un token', M.leggiToken('moodlemobile://token=' + Buffer.from(`${firma}:::<script>`).toString('base64'), { sito: 'https://virtuale.unibo.it', passport: pass }) === null && M.leggiToken('https://x', { sito: 'https://x', passport: pass }) === null);

// il main finto: ipcMain e safeStorage
const canali = {}, conf = {}, cifrati = [];
const ipcMain = { handle: (c, f) => { canali[c] = f; } };
const safeStorage = { isEncryptionAvailable: () => true, encryptString: s => { cifrati.push(s); return Buffer.from('C' + s); }, decryptString: b => b.toString().slice(1) };
M.registra({ ipcMain, BrowserWindow: class { }, safeStorage, conf: () => conf, salvaConf: () => { }, fetch });
const ch = (c, x) => canali[c](null, x);

prova('stato: scollegato', (await ch('moodle:stato')).collegato === false);
const v = await ch('moodle:verifica', SITO.replace('http://', 'http://'));
prova('verifica: nome e tipo di accesso', v.ok && v.nome === 'Virtuale prova' && v.tipo === 'password', JSON.stringify(v));
prova('verifica: non è un Moodle', (await ch('moodle:verifica', 'http://127.0.0.1:' + server.address().port + '/altro')).ok === false);
prova('accedi: password sbagliata', (await ch('moodle:accedi', { indirizzo: SITO, utente: 'giulia', password: 'no' })).motivo === 'Credenziali non valide');
const a = await ch('moodle:accedi', { indirizzo: SITO, utente: 'giulia', password: 'giusta' });
prova('accedi: collegato', a.ok && a.collegato && a.utente === 'Giulia Rossi' && conf.moodle.userid === 7, JSON.stringify(a));
prova('accedi: token cifrato, password mai salvata', conf.moodle.token.cifrato && !JSON.stringify(conf).includes(TOKEN) && !JSON.stringify(conf).includes('giusta') && cifrati.every(x => x !== 'giusta'));
const corsi = await ch('moodle:corsi');
prova('corsi: visibili, nomi senza HTML', corsi.length === 2 && corsi[0].nome === 'ANALISI MATEMATICA 2 & ESERCITAZIONI', JSON.stringify(corsi));
await ch('moodle:segui', { 11: 'Analisi 2', 12: '', 'x<': 'Trappola' });
prova('segui: solo id numerici con un nome', JSON.stringify(conf.moodle.corsi) === '{"11":"Analisi 2"}');
const n = await ch('moodle:novita', { segna: true });
prova('novità: solo i file visibili, dal più recente', n.file.length === 2 && n.file[0].nome === 'green.pdf' && n.file[0].corso === 'Analisi 2' && n.primaVolta, JSON.stringify(n));
prova('novità: la barra non vede indirizzi', !JSON.stringify(n).includes('pluginfile') && !JSON.stringify(n).includes(TOKEN));
const n2 = await ch('moodle:novita');
prova('novità: dopo il controllo niente è nuovo', n2.file.every(x => !x.nuovo) && !n2.primaVolta);
const s = await ch('moodle:scarica', n.file[0].i);
prova('scarica: i byte del file col token', s.ok && new TextDecoder().decode(s.dati).startsWith('%PDF') && s.nome === 'green.pdf' && s.corso === 'Analisi 2', JSON.stringify(s).slice(0, 200));
conf.moodle.sito = 'http://altro.example'; prova('scarica: il token non va a un altro sito', (await ch('moodle:scarica', n.file[0].i)).motivo === 'il file non sta su Moodle'); conf.moodle.sito = SITO;
prova('scarica: indice inesistente', (await ch('moodle:scarica', 99)).ok === false);
const sc = await ch('moodle:scadenze');
prova('scadenze', sc.length === 1 && sc[0].corso === 'Analisi 2' && sc[0].tipo === 'assign');
const d = await ch('moodle:descrizione', 11);
prova('descrizione del corso in testo', /Programma/.test(d.testo) && /- Limiti e continuità/.test(d.testo) && !/</.test(d.testo), JSON.stringify(d));
prova('solo letture: nessuna funzione che scrive', chiamate.every(c => /^core_(webservice_get_site_info|enrol_get_users_courses|course_get_contents|course_get_courses_by_field|calendar_get_action_events_by_timesort)$/.test(c.wsfunction)), [...new Set(chiamate.map(c => c.wsfunction))].join(', '));
// dopo un riavvio: il token si rilegge dal portachiavi
const canali2 = {}; M.registra({ ipcMain: { handle: (c, f) => { canali2[c] = f; } }, BrowserWindow: class { }, safeStorage, conf: () => conf, salvaConf: () => { }, fetch });
prova('riavvio: ancora collegato', (await canali2['moodle:stato']()).collegato === true && (await canali2['moodle:corsi']()).length === 2);
prova('scollega: niente token', (await ch('moodle:scollega')).collegato === false && !conf.moodle);
let errore = null; try { await ch('moodle:corsi'); } catch (e) { errore = e.message; }
prova('scollegato: niente letture', errore === 'Moodle non è collegato');

server.close();
console.log(`moodle: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
