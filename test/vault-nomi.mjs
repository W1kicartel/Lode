// Prove dei nomi del vault per lingua (js/nomi.js, catalogo «vaultnomi», desktop/vault.mjs): node --experimental-vm-modules test/vault-nomi.mjs
// - un vault nuovo in inglese ha cartelle, note e sezioni inglesi, scritte e rilette (lezione con trascrizione e ★, carte in
//   tasca spuntate, diario del progetto, memoria);
// - un vault vecchio senza .lode/vault.json, con la barra in inglese, continua a leggere e scrivere in italiano;
// - cambiare la lingua della barra con il vault già creato non cambia i nomi del vault;
// - in italiano tutto resta come prima (regex dei percorsi, Orario.md, sezioni).
// Niente rete, niente Electron: cartelle temporanee che si cancellano alla fine.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.removeEventListener = () => { }; globalThis.dispatchEvent = () => { };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
process.env.LODE_OBSIDIAN_DIR = join(tmpdir(), 'lode-prova-nessun-obsidian');

const RADICE = new URL('../', import.meta.url).pathname.replace(/^\/([a-z]:)/i, '$1');
const VA = await import('../desktop/vault.mjs');
await VA.carica(RADICE);
const NM = await import('../js/nomi.js'), M = await import('../js/markdown.js'), Dm = await import('../js/dati.js'), T = await import('../js/tasca.js');
const DI = await import('../js/codice/diario.js'), SB = await import('../js/sbobina.js'), LI = await import('../js/lingua.js');
const { creaMotore } = await import('../desktop/sync/motore.mjs');

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const temp = [], nuovaCartella = n => { const d = mkdtempSync(join(tmpdir(), 'lode-nomi-' + n + '-')); temp.push(d); return d; };
const leggi = (d, f) => readFileSync(join(d, f), 'utf8');

/* ---------- i cataloghi: tutte le lingue hanno la stessa tabella, nomi buoni per i file ---------- */
for (const cod of NM.LINGUE_NOMI) {
  const N = NM.nomiDi(cod);
  const nomiFile = [...Object.values(N.cartelle), ...Object.values(N.corsi), ...Object.values(N.note), ...Object.values(N.modelli)];
  prova(`${cod}: nomi di file senza caratteri vietati`, nomiFile.every(n => n && n === M.pulito(n) && !/[\\/:*?"<>|#^[\]]/.test(n)), nomiFile.filter(n => n !== M.pulito(n)).join(', '));
  prova(`${cod}: cartelle tutte diverse`, new Set(Object.values(N.cartelle).map(x => x.toLowerCase())).size === Object.values(N.cartelle).length);
  prova(`${cod}: note alla radice tutte diverse`, new Set(Object.values(N.note).map(x => x.toLowerCase())).size === Object.values(N.note).length);
  prova(`${cod}: sette giorni e cinque colonne`, N.orario.giorni.length === 7 && N.orario.colonne.length === 5);
  prova(`${cod}: i giorni brevi non si confondono`, N.orario.giorni.every((g, i) => N.orario.giorni.findIndex(b => g.startsWith(b)) === i), N.orario.giorni.join());
  prova(`${cod}: nessuna sezione ha il nome di un'altra sezione in un'altra lingua`, Object.entries(N.sezioni).every(([k, v]) => NM.LINGUE_NOMI.every(c => Object.entries(NM.nomiDi(c).sezioni).every(([k2, v2]) => k2 === k || v2.replace(/[^\p{L}]/gu, '').toLowerCase() !== v.replace(/[^\p{L}]/gu, '').toLowerCase()))));
  prova(`${cod}: le caselle della tasca sono diverse`, N.parole.sapevo.toLowerCase() !== N.parole.nonSapevo.toLowerCase());
  prova(`${cod}: la cartella di Lode resta «Lode»`, N.cartelle.lode === 'Lode');
  prova(`${cod}: il benvenuto ha la firma`, NM.nomiDi(cod).testi.benvenuto.includes('{firma}') && N.testi.benvenutoFirma.includes('**Lode**'));
}
prova('lingua sconosciuta: italiano', NM.nomiDi('xx').lingua === 'it' && NM.nomiDi('xx').cartelle.lezioni === 'Lezioni');
prova('senza vault: i nomi di sempre', NM.nomi().cartelle.lezioni === 'Lezioni' && M.SEZIONI.stella === '★ Da esame');

/* ---------- vault.json: quello salvato vince, le voci nuove vengono dalla lingua del vault ---------- */
{
  const salvati = NM.daSalvare(NM.nomiDi('en'));
  prova('vault.json: niente testi lunghi', !('testi' in salvati.nomi) && salvati.lingua === 'en');
  salvati.nomi.cartelle.lezioni = 'Classes'; delete salvati.nomi.note.tasca; salvati.nomi.cartelle.corsi = '../fuori'; salvati.nomi.cartelle.lode = 'Altro';
  const N = NM.completa(salvati);
  prova('vault.json: il nome salvato resta', N.cartelle.lezioni === 'Classes');
  prova('vault.json: la voce che manca viene dalla lingua del vault', N.note.tasca === 'Pocket review');
  prova('vault.json: un nome con «/» si ignora', N.cartelle.corsi === 'Courses');
  prova('vault.json: la cartella di Lode non cambia', N.cartelle.lode === 'Lode');
  prova('vault.json: i testi vengono dal catalogo', N.testi.benvenuto.startsWith('# Welcome'));
}

/* ---------- un vault nuovo in inglese ---------- */
const EN = nuovaCartella('en');
VA.crea(EN, [{ corso: 'Calculus 2', giorni: [1, 3], inizio: '09:00', fine: '11:00', aula: '7' }], 'en');
{
  const j = JSON.parse(leggi(EN, '.lode/vault.json'));
  prova('en: vault.json con la lingua e i nomi', j.lingua === 'en' && j.nomi.cartelle.lezioni === 'Lectures');
  for (const d of ['Lectures', 'Courses', 'Templates', 'Attachments', 'Inbox', 'Lode']) prova('en: cartella ' + d, existsSync(join(EN, d)));
  for (const f of ['Welcome.md', 'Timetable.md', 'Home.md', 'Exams.md', 'Glossary.md', 'Lode/Memory.md', 'Templates/Lecture.md', 'Templates/Exam.md', 'Templates/Review.md']) prova('en: nota ' + f, existsSync(join(EN, f)));
  prova('en: niente cartelle italiane', !['Lezioni', 'Corsi', 'Modelli', 'Allegati', 'Benvenuto.md', 'Orario.md'].some(x => existsSync(join(EN, x))));
  prova('en: il benvenuto è inglese e cita i nomi del vault', /^# Welcome to your vault/.test(leggi(EN, 'Welcome.md')) && leggi(EN, 'Welcome.md').includes('`Lectures/<course>/`') && leggi(EN, 'Welcome.md').includes('[[Timetable]]') && !/\{\w+\}/.test(leggi(EN, 'Welcome.md')));
  prova('en: il modello della lezione ha le sezioni inglesi', /## ★ For the exam/.test(leggi(EN, 'Templates/Lecture.md')) && /## Definitions\n%% One per line/.test(leggi(EN, 'Templates/Lecture.md')));
  prova('en: la memoria ha «Notes for Lode»', /## Notes for Lode/.test(leggi(EN, 'Lode/Memory.md')));
  const app = JSON.parse(leggi(EN, '.obsidian/app.json')), tpl = JSON.parse(leggi(EN, '.obsidian/templates.json')), bm = JSON.parse(leggi(EN, '.obsidian/bookmarks.json')), ws = JSON.parse(leggi(EN, '.obsidian/workspace.json'));
  prova('en: Obsidian sa dove sono allegati, inbox e modelli', app.attachmentFolderPath === 'Attachments' && app.newFileFolderPath === 'Inbox' && tpl.folder === 'Templates');
  prova('en: i segnalibri puntano alle note inglesi', bm.items.map(x => x.path).join() === 'Home.md,Timetable.md,Exams.md,Glossary.md,Lode/Memory.md' && bm.items[4].title === 'What Lode knows about me');
  prova('en: Obsidian si apre sulla Home', ws.main.children[0].children[0].state.state.file === 'Home.md');
  prova('en: l\'orario ha intestazione e giorni inglesi', /\| Course \| Days \| Start \| End \| Room \|/.test(leggi(EN, 'Timetable.md')) && /\| \[\[Calculus 2\]\] \| mon, wed \| 09:00 \| 11:00 \| 7 \|/.test(leggi(EN, 'Timetable.md')) && /^# Lecture timetable/m.test(leggi(EN, 'Timetable.md')));
  const o = M.leggiOrario(leggi(EN, 'Timetable.md'));
  prova('en: l\'orario si rilegge', o.length === 1 && o[0].corso === 'Calculus 2' && o[0].giorni.join() === '1,3' && o[0].aula === '7', JSON.stringify(o));
  prova('en: un orario scritto coi giorni italiani si legge lo stesso', M.leggiOrario('| [[X]] | lun, gio | 9 | 11 | |')[0]?.giorni.join() === '1,4');

  // la lezione: la barra chiede di annotare, il main scrive, il guardiano rilegge
  const l = { corso: 'Calculus 2', data: '2026-02-12', inizio: '09:00', fine: '11:00' };
  const file = M.fileLezione(l);
  prova('en: la lezione va in Lectures/', file === 'Lectures/Calculus 2/2026-02-12 Calculus 2.md', file);
  prova('en: il corso va in Courses/', M.fileCorso('Calculus 2') === 'Courses/Calculus 2.md');
  prova('en: il titolo della nota ha la data in inglese', /^# Calculus 2 · Thursday 12 February$/m.test(M.notaLezione(l)), M.notaLezione(l).split('\n').find(r => r.startsWith('# ')));
  const P = VA.permessi();
  prova('en: il main permette la nota della lezione', P.lezione.test(file) && P.lezione.test('Courses/Calculus 2.md') && !P.lezione.test('Lezioni/X/y.md'));
  VA.annota(EN, { file, nuovo: M.notaLezione(l), corso: { file: M.fileCorso(l.corso), testo: M.notaCorso(l.corso, { cfu: 6 }) }, chiave: 'stella', riga: '- 10:12 the limit theorem is on the exam' });
  VA.annota(EN, { file, chiave: 'definizione', riga: '- **Limit**: the value a function approaches' });
  VA.annota(EN, { file, chiave: 'trascrizione', riga: '**10:13** so today we talk about limits and continuity' });
  const testo = leggi(EN, file);
  prova('en: la ★ va in «★ For the exam»', /## ★ For the exam\n- 10:12 the limit theorem is on the exam/.test(testo), testo);
  prova('en: la trascrizione ha la sua sezione inglese', /## Transcript\n\*\*10:13\*\* so today/.test(testo));
  prova('en: niente sezioni italiane', !/## (★ Da esame|Definizioni|Trascrizione|Appunti)\b/.test(testo));
  prova('en: la nota del corso è in Courses/ col commento inglese', existsSync(join(EN, 'Courses/Calculus 2.md')) && /%% Write above or below/.test(leggi(EN, 'Courses/Calculus 2.md')));
  const lz = VA.lezioni(EN);
  prova('en: la lezione si rilegge', lz.length === 1 && lz[0].corso === 'Calculus 2' && lz[0].data === '2026-02-12', JSON.stringify(lz));
  prova('en: le ★ si rileggono', lz[0]?.stelle.join() === '10:12 the limit theorem is on the exam', lz[0]?.stelle);
  prova('en: le definizioni si rileggono', lz[0]?.definizioni[0]?.t === 'Limit');
  prova('en: la trascrizione si rilegge', /today we talk about limits/.test(lz[0]?.trascrizione || '') && lz[0].paroleTrascritte > 5);
  prova('en: una nota scritta prima coi titoli italiani si legge lo stesso', M.leggiLezione('---\ndata: 2026-02-13\n---\n## ★ Da esame\n- vecchia\n', 'Lectures/Calculus 2/x.md').stelle.join() === 'vecchia');
  prova('en: una sbobina tedesca ricevuta si legge', M.leggiLezione('---\ndata: 2026-02-13\n---\n## ★ Prüfungsrelevant\n- Satz\n## Transkript\n**10:00** hallo welt\n', 'f.md').stelle.join() === 'Satz');
  prova('en: «Notes tidied up by Lode» conta come riordinata', M.leggiLezione('---\ndata: 2026-02-13\n---\n## Notes tidied up by Lode\nx\n', 'f.md').riordinata);
  // la sbobina condivisa prende le sezioni inglesi
  const sb = SB.crea(testo, { autore: 'Anna' });
  prova('en: il file della sbobina ha il nome inglese', sb.nome === '2026-02-12 Calculus 2 · transcript' && NM.nomeFile('sbobinaDi', { data: '2026-02-12', corso: 'X', da: 'Anna' }) === '2026-02-12 X · transcript by Anna', sb.nome);
  prova('en: la sbobina porta ★ e trascrizione coi nomi del vault', /## ★ For the exam/.test(sb.md) && /## Transcript/.test(sb.md) && /## Definitions/.test(sb.md));

  // la memoria: si riscrive ma «Notes for Lode» dello studente resta
  writeFileSync(join(EN, 'Lode/Memory.md'), leggi(EN, 'Lode/Memory.md') + 'short sentences please\n');
  VA.memoria(EN, '---\ntipo: memoria\n---\n# Memory\n\n## Notes for Lode\n%% placeholder %%\n');
  prova('en: la memoria tiene le note dello studente', /short sentences please/.test(leggi(EN, 'Lode/Memory.md')));
  prova('en: le note per Lode si leggono', VA.notePerLode(EN) === 'short sentences please', VA.notePerLode(EN));
  prova('en: il main permette la memoria e l\'orario', P.scrivi.test('Lode/Memory.md') && P.scrivi.test('Timetable.md') && P.scrivi.test('Pocket review.md') && !P.scrivi.test('Orario.md'));
  prova('en: il main permette le pagine e i diari', ['Home.md', 'Exams.md', 'Glossary.md', 'Courses/Calculus 2.md', 'Lectures/Calculus 2/a.md', 'Projects/lab/2026-02-12.md'].every(f => P.blocco.test(f)) && !P.blocco.test('Esami.md'));
  prova('en: il main permette i file nelle cartelle inglesi', ['Transcripts/a.md', 'Attachments/a.pdf', 'Materials/X/a.md', 'Lectures/X/a.md', 'Anki/a.txt'].every(f => P.salvaFile.test(f)) && !P.salvaFile.test('Sbobine/a.md'));
  prova('en: le note per la ricerca saltano i modelli', !VA.note(EN).some(n => n.file.startsWith('Templates/')) && VA.note(EN).some(n => n.file === 'Welcome.md'));

  // il diario del progetto e «Cosa so davvero»
  const fd = DI.fileDiario('lab 1', '2026-02-12');
  prova('en: il diario va in Projects/', fd === 'Projects/lab 1/2026-02-12.md' && P.blocco.test(fd), fd);
  const nd = DI.notaDiario({ progetto: 'lab 1', corso: 'Programming', giorno: '2026-02-12' });
  prova('en: il diario ha «What I understood» e i segni di Lode uguali', /## What I understood\n%% This part is yours/.test(nd) && nd.includes('%% lode:diario %%\n%% /lode:diario %%'));
  VA.blocco(EN, { file: fd, id: 'diario', testo: '- 2 builds', nuovo: nd });
  prova('en: il diario si scrive dentro i segni', /%% lode:diario %%\n- 2 builds\n%% \/lode:diario %%/.test(leggi(EN, fd)) && /## What I understood/.test(leggi(EN, fd)));

  // la tasca: carte spuntate sul telefono e rilette
  Dm.sostituisci(Dm.esempio());
  const carte = [{ id: 'k1', esameId: null, fronte: 'What is a limit?', retro: 'A value', scad: Dm.oggi() }, { id: 'k2', esameId: null, fronte: 'Continuity?', retro: 'No jumps', scad: Dm.oggi() }];
  const nota = T.scriviNota(carte, [], 'g1', Dm.oggi());
  prova('en: la tasca ha titolo, callout e caselle inglesi', /^# Pocket review/.test(nota) && nota.includes('> [!answer]- Answer') && nota.includes("- [ ] knew it\n- [ ] didn't know") && !/sapevo/.test(nota), nota.slice(0, 300));
  prova('en: i marcatori della tasca restano uguali', nota.includes('<!-- lode-carta:k1 -->') && nota.includes('<!-- lode-tasca giro:g1 -->'));
  const spuntata = nota.replace('- [ ] knew it\n- [ ] didn\'t know\n<!-- lode-carta:k1', '- [x] knew it\n- [ ] didn\'t know\n<!-- lode-carta:k1').replace("- [ ] didn't know\n<!-- lode-carta:k2", "- [X] didn't know\n<!-- lode-carta:k2");
  const r = T.leggiNota(spuntata);
  prova('en: le spunte si rileggono', r.giro === 'g1' && r.esiti.length === 2 && r.esiti[0].id === 'k1' && r.esiti[0].sapevo === true && r.esiti[1].id === 'k2' && r.esiti[1].sapevo === false, JSON.stringify(r));
  prova('en: una nota scritta in italiano si rilegge ancora', T.leggiNota('- [x] non sapevo\n- [ ] sapevo\n<!-- lode-carta:k1 -->').esiti[0]?.sapevo === false);

  // la sincronizzazione riceve il nome dell'orario del vault
  prova('en: il motore della sincronizzazione accetta il nome dell\'orario', typeof creaMotore === 'function' && /nomeOrario/.test(readFileSync(new URL('../desktop/sync/motore.mjs', import.meta.url), 'utf8')));
  prova('en: la sincronizzazione passa il nome del vault', /nomeOrario: \(\) => nomiVault\(\)\.note\.orario/.test(readFileSync(new URL('../desktop/sincronizza.mjs', import.meta.url), 'utf8')));
}

/* ---------- cambio della lingua della barra con il vault già creato ---------- */
{
  await LI.usa('de');   // la barra passa al tedesco: il vault non cambia nome
  VA.crea(EN, [], 'de');
  prova('cambio lingua: i nomi restano inglesi', VA.nomi().lingua === 'en' && M.fileLezione({ corso: 'X', data: '2026-03-01' }).startsWith('Lectures/'));
  prova('cambio lingua: niente cartelle tedesche', !existsSync(join(EN, 'Vorlesungen')) && !existsSync(join(EN, 'Willkommen.md')));
  prova('cambio lingua: vault.json non cambia', JSON.parse(leggi(EN, '.lode/vault.json')).lingua === 'en');
  // la barra riceve i nomi con vault:info (clonati dall'IPC) e li usa così come sono
  const clonati = JSON.parse(JSON.stringify(VA.nomi()));
  NM.impostaNomi('it'); NM.impostaNomi(clonati);
  prova('cambio lingua: la barra usa i nomi del vault, non quelli della sua lingua', NM.nomi().cartelle.lezioni === 'Lectures' && M.SEZIONI.stella === '★ For the exam' && NM.fileMemoria() === 'Lode/Memory.md', [NM.nomi().cartelle.lezioni, M.SEZIONI.stella, NM.fileMemoria()].join(' · '));
  prova('cambio lingua: i testi della barra seguono la lingua della barra', LI.lingua === 'de');
  // un vault.json con nomi cambiati a mano (o di una versione vecchia): valgono quelli
  const j = JSON.parse(leggi(EN, '.lode/vault.json')); j.nomi.cartelle.lezioni = 'My lectures'; writeFileSync(join(EN, '.lode/vault.json'), JSON.stringify(j));
  VA.crea(EN, [], 'fr');
  prova('vault.json: valgono i nomi salvati', M.fileLezione({ corso: 'X', data: '2026-03-01' }).startsWith('My lectures/') && existsSync(join(EN, 'My lectures')));
  await LI.usa('it');
}

/* ---------- un vault vecchio, senza vault.json, con la barra in inglese ---------- */
{
  const IT = nuovaCartella('vecchio');
  mkdirSync(join(IT, 'Lezioni', 'Analisi 2'), { recursive: true }); mkdirSync(join(IT, 'Lode'), { recursive: true });
  writeFileSync(join(IT, 'Home.md'), '# Home\n');
  writeFileSync(join(IT, 'Lode', 'Memoria.md'), '# Cosa so di te\n\n## Note per Lode\nfrasi brevi\n');
  writeFileSync(join(IT, 'Lezioni', 'Analisi 2', '2026-02-12 Analisi 2.md'), M.notaLezione({ corso: 'Analisi 2', data: '2026-02-12' }));
  await LI.usa('en');
  VA.crea(IT, [], 'en');
  prova('vecchio: resta italiano', VA.nomi().lingua === 'it' && JSON.parse(leggi(IT, '.lode/vault.json')).lingua === 'it');
  prova('vecchio: niente cartelle inglesi', !['Lectures', 'Courses', 'Templates', 'Attachments', 'Welcome.md', 'Timetable.md', 'Exams.md'].some(x => existsSync(join(IT, x))));
  prova('vecchio: le cartelle di sempre', ['Lezioni', 'Corsi', 'Modelli', 'Allegati', 'Inbox', 'Benvenuto.md', 'Esami.md', 'Glossario.md'].every(x => existsSync(join(IT, x))));
  prova('vecchio: il benvenuto è quello di sempre', leggi(IT, 'Benvenuto.md').includes("Questo vault l'ha preparato **Lode**") && leggi(IT, 'Benvenuto.md').includes('`Lezioni/<corso>/`'));
  const file = M.fileLezione({ corso: 'Analisi 2', data: '2026-02-12' });
  VA.annota(IT, { file, chiave: 'stella', riga: '- 10:00 il teorema del limite' });
  prova('vecchio: i nomi dei file composti di sempre', NM.nomeFile('sbobina', { data: '2026-02-12', corso: 'X' }) === '2026-02-12 X · sbobina' && NM.nomeFile('sbobinaDi', { data: '2026-02-12', corso: 'X', da: 'Anna' }) === '2026-02-12 X · sbobina di Anna' && NM.nomi().file.originale === 'file originale');
  prova('vecchio: la ★ va in «★ Da esame»', /## ★ Da esame\n- 10:00 il teorema del limite/.test(leggi(IT, file)));
  prova('vecchio: una sezione inglese in una nota italiana resta com\'era (non si legge)', M.leggiLezione('---\ndata: 2026-02-13\n---\n## ★ For the exam\n- x\n', 'f.md').stelle.length === 0);
  prova('vecchio: una sbobina ricevuta in inglese si legge', M.leggiLezione('---\ndata: 2026-02-13\nsbobina: ricevuta\n---\n## ★ For the exam\n- x\n', 'f.md').stelle.join() === 'x');
  prova('vecchio: la lezione si rilegge', VA.lezioni(IT)[0]?.stelle.join() === '10:00 il teorema del limite');
  prova('vecchio: le note per Lode si leggono', VA.notePerLode(IT) === 'frasi brevi');
  prova('vecchio: la tasca scrive «sapevo»', T.scriviNota([{ id: 'k1', fronte: 'Limite?', retro: 'Un valore', scad: Dm.oggi() }], [], 'g2', Dm.oggi()).includes('> [!risposta]- Risposta\n> Un valore\n\n- [ ] sapevo\n- [ ] non sapevo'));
  prova('vecchio: il diario va in Progetti/', DI.fileDiario('lab', '2026-02-12') === 'Progetti/lab/2026-02-12.md' && /## Cosa ho capito\n%% Questa parte è tua/.test(DI.notaDiario({ progetto: 'lab', giorno: '2026-02-12' })));
  prova('vecchio: Orario.md con «Corso | Giorni»', /^# Orario delle lezioni$/m.test(M.orarioMd([{ corso: 'A', giorni: [2], inizio: '09:00', fine: '10:00' }])) && /\| \[\[A\]\] \| mar \| 09:00 \| 10:00 \|  \|/.test(M.orarioMd([{ corso: 'A', giorni: [2], inizio: '09:00', fine: '10:00' }])));
  // le regex del main in italiano: le stesse di prima delle lingue, su un campione di percorsi
  const P = VA.permessi();
  const PRIMA = { lezione: /^(Lezioni|Corsi)\/(?:[^/.][^/]*\/)*[^/.][^/]*\.md$/, scrivi: /^(Orario|In tasca|Lode\/[\w ]+)\.md$/, blocco: /^(Home|Esami|Glossario)\.md$|^Corsi\/[^/]+\.md$|^Lezioni\/[^/]+\/[^/]+\.md$|^Progetti\/[^/]+\/[^/]+\.md$/, salvaFile: /^(Sbobine|Allegati|Materiali|Lezioni|Anki)\// };
  const CAMPIONE = ['Lezioni/A/b.md', 'Lezioni/A/Es/b.md', 'Corsi/A.md', 'Corsi/.x.md', 'Lezioni/../x.md', 'Orario.md', 'In tasca.md', 'Lode/Memoria.md', 'Lode/Aggiorna Lode su tutti i computer.md', 'Lode/x/y.md', 'Home.md', 'Esami.md', 'Glossario.md', 'Progetti/p/2026-01-01.md', 'Progetti/p.md', 'Sbobine/a.md', 'Allegati/a.pdf', 'Materiali/Varie/a.md', 'Anki/a.txt', 'Altro/a.md', 'Lectures/A/b.md', 'Timetable.md', 'home.md'];
  for (const k of Object.keys(PRIMA)) prova(`vecchio: la regex «${k}» del main è quella di prima`, CAMPIONE.every(f => PRIMA[k].test(f) === P[k].test(f)), CAMPIONE.filter(f => PRIMA[k].test(f) !== P[k].test(f)).join(', '));
  await LI.usa('it');
}

/* ---------- una cartella vuota o un vault di Obsidian dove Lode non ha mai scritto: nasce nella lingua di adesso ---------- */
{
  const OB = nuovaCartella('obsidian');
  writeFileSync(join(OB, 'My own note.md'), '# Mine\n');
  VA.crea(OB, [], 'es');
  prova('vault estraneo: nasce in spagnolo', VA.nomi().lingua === 'es' && existsSync(join(OB, 'Clases')) && existsSync(join(OB, 'Bienvenida.md')) && existsSync(join(OB, 'Horario.md')));
  prova('vault estraneo: la nota dello studente resta', leggi(OB, 'My own note.md') === '# Mine\n');
  const PT = nuovaCartella('pt');
  VA.crea(PT, [], 'pt');
  prova('pt: le cartelle del Brasile', existsSync(join(PT, 'Aulas')) && existsSync(join(PT, 'Disciplinas')) && existsSync(join(PT, 'Lode/Memória.md')));
  prova('pt: la memoria si trova con l\'accento', VA.permessi().scrivi.test('Lode/Memória.md') && /## Notas para o Lode/.test(leggi(PT, 'Lode/Memória.md')));
  VA.crea(EN, [], 'it');   // si torna al vault inglese: la tabella segue il vault aperto
  prova('riaprire un vault rimette i suoi nomi', VA.nomi().lingua === 'en');
}

for (const d of temp) rmSync(d, { recursive: true, force: true });
NM.impostaNomi('it');
console.log(`${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
