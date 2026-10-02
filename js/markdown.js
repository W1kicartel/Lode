// Le note di Obsidian, lette e scritte da Lode. Lo usano sia l'app (barra) sia il processo desktop che guarda il vault.
// Una lezione è un file Markdown normale: frontmatter + sezioni «Appunti», «★ Da esame», «Definizioni», «Domande per il prof».
// Le definizioni si scrivono come vuoi: «- **Gradiente**: il vettore…», «- Gradiente: …», «Gradiente :: …» (anche il formato
// del plugin Spaced Repetition) o in un callout «> [!definizione] Gradiente». Lode le trova e ne fa giochi e ripasso.
export const SEZIONI = { appunti: 'Appunti', stella: '★ Da esame', definizione: 'Definizioni', domanda: 'Domande per il prof', trascrizione: 'Trascrizione', riordinati: 'Appunti riordinati da Lode' };
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

// nomi di file sicuri su Mac, Windows e Linux: su Windows niente punti o spazi in fondo e niente nomi riservati
// (CON, NUL, COM1…), se no Esplora risorse non apre né cancella la cartella
export const pulito = s => String(s || '').replace(/[\x00-\x1f\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).replace(/[. ]+$/, '')
  .replace(/^(con|prn|aux|nul|com[\d¹²³]|lpt[\d¹²³])(?= *(\.|$))/i, '$1_') || 'Senza nome';
export const fileLezione = ({ corso, data }) => `Lezioni/${pulito(corso)}/${data} ${pulito(corso)}.md`;
export const fileCorso = corso => `Corsi/${pulito(corso)}.md`;
const dataLunga = iso => { const d = new Date(iso + 'T12:00'); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };

export function notaLezione({ corso, data, inizio, fine, aula }) {
  return `---
corso: "[[${pulito(corso)}]]"
data: ${data}
${inizio ? `ora: "${inizio}${fine ? '–' + fine : ''}"\n` : ''}${aula ? `aula: "${String(aula).replace(/"/g, '')}"\n` : ''}tipo: lezione
tags: [lezione]
---
# ${pulito(corso)} · ${dataLunga(data)}

## ${SEZIONI.appunti}


## ${SEZIONI.stella}


## ${SEZIONI.definizione}
%% Una per riga: - **Termine**: definizione. Lode ne fa giochi di memoria e carte. %%


## ${SEZIONI.domanda}

`;
}
export function notaCorso(corso, { cfu, appello } = {}) {
  return `---
tipo: corso
${cfu ? `cfu: ${cfu}\n` : ''}${appello ? `appello: ${appello}\n` : ''}tags: [corso]
---
# ${pulito(corso)}

%% Scrivi pure qui sopra o sotto: il riquadro di Lode (lezioni, ★, appello) si aggiorna da solo e il resto non lo tocca. %%
`;
}

export function frontmatter(testo) {
  const m = String(testo).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: {}, corpo: String(testo) };
  const fm = {};
  for (const r of m[1].split(/\r?\n/)) { const x = r.match(/^([\w-]+):\s*(.*)$/); if (x) fm[x[1]] = x[2].replace(/^["']|["']$/g, '').trim(); }
  return { fm, corpo: String(testo).slice(m[0].length) };
}
// le sezioni di secondo livello: nome → righe
export function sezioni(corpo) {
  const out = {}; let cur = null;
  for (const r of String(corpo).split(/\r?\n/)) {
    const h = r.match(/^##\s+(.+?)\s*$/);
    if (h) { cur = h[1].trim(); out[cur] = []; continue; }
    if (/^#\s/.test(r)) { cur = null; continue; }
    if (cur) out[cur].push(r);
  }
  return out;
}
const senzaCommenti = s => s.replace(/%%[\s\S]*?%%/g, '').replace(/<!--[\s\S]*?-->/g, '');
const pulisciRiga = r => r.replace(/^\s*(?:[-*+]|\d+[.)])\s+(\[[ x]\]\s+)?/, '').trim();

function trovaSezione(sez, chiave) {
  const nome = SEZIONI[chiave].replace(/[^\p{L}]/gu, '').toLowerCase();
  const alias = { stella: ['daesame', 'importante', 'esame'], definizione: ['definizioni', 'glossario'], domanda: ['domande', 'domandeperilprof'], appunti: ['appunti', 'note'], trascrizione: ['trascrizione'] }[chiave] || [];
  const k = Object.keys(sez).find(k => { const x = k.replace(/[^\p{L}]/gu, '').toLowerCase(); return x === nome || alias.includes(x); });
  return k ? sez[k] : [];
}
export function leggiDefinizione(r) {
  let s = pulisciRiga(r); if (!s) return null;
  let m = s.match(/^\*\*(.+?)\*\*\s*[:–—-]?\s*(.+)$/) || s.match(/^(.+?)\s*::\s*(.+)$/) || s.match(/^([^:]{2,60}?)\s*[:–—]\s+(.+)$/);
  if (!m) return null;
  const t = m[1].replace(/\*\*/g, '').trim(), d = m[2].trim();
  return t && d && d.length >= 3 ? { t, d } : null;
}

export function leggiLezione(testo, file) {
  const { fm, corpo } = frontmatter(senzaCommenti(String(testo)));
  const sez = sezioni(corpo);
  const corso = (fm.corso || '').replace(/^\[\[|\]\]$/g, '') || (file || '').split('/').slice(-2, -1)[0] || '';
  const ora = (fm.ora || '').split(/[–-]/);
  const definizioni = [];
  for (const r of trovaSezione(sez, 'definizione')) { const d = leggiDefinizione(r); if (d) definizioni.push(d); }
  // in tutto il file: «termine :: definizione» e i callout di definizione
  const visti = new Set(definizioni.map(d => d.t.toLowerCase()));
  const righe = corpo.split(/\r?\n/);
  righe.forEach((r, i) => {
    let d = null;
    if (/::/.test(r) && !/^\s*%%/.test(r)) d = leggiDefinizione(r);
    const c = r.match(/^>\s*\[!(?:definizione|def|definition)\][-+]?\s*(.+)$/i);
    if (c) { const testoC = []; for (let j = i + 1; j < righe.length && /^>/.test(righe[j]); j++) testoC.push(righe[j].replace(/^>\s?/, '')); d = { t: c[1].trim(), d: testoC.join(' ').trim() }; }
    if (d && d.d && !visti.has(d.t.toLowerCase())) { visti.add(d.t.toLowerCase()); definizioni.push(d); }
  });
  const elenco = k => trovaSezione(sez, k).filter(r => /^\s*(?:[-*+]|\d+[.)])\s+/.test(r) && !/::/.test(r)).map(pulisciRiga).filter(Boolean);
  const appunti = trovaSezione(sez, 'appunti').join('\n').trim();
  const trascrizione = trovaSezione(sez, 'trascrizione').map(r => r.replace(/^\*\*\d\d:\d\d\*\*\s*/, '')).join(' ').replace(/\s+/g, ' ').trim();
  return { file, corso, data: /^\d{4}-\d\d-\d\d$/.test(fm.data || '') ? fm.data : (file || '').match(/(\d{4}-\d\d-\d\d)/)?.[1] || null,
    inizio: ora[0]?.trim() || null, fine: ora[1]?.trim() || null, aula: fm.aula || null,
    definizioni, stelle: elenco('stella'), domande: elenco('domanda'), parole: appunti.split(/\s+/).filter(Boolean).length, appunti: appunti.slice(0, 4000),
    paroleTrascritte: trascrizione ? trascrizione.split(' ').length : 0, trascrizione: trascrizione.slice(0, 120000), riordinata: Object.keys(sez).some(k => /riordinati/i.test(k)) };
}

// aggiunge una riga in fondo a una sezione (la crea se manca), senza toccare il resto del file
export function inserisci(testo, chiave, riga) {
  const nome = SEZIONI[chiave], righe = String(testo).replace(/\s+$/, '').split(/\r?\n/);
  const norm = x => x.replace(/[^\p{L}]/gu, '').toLowerCase();
  let i = righe.findIndex(r => /^##\s/.test(r) && norm(r.replace(/^##\s+/, '')) === norm(nome));
  if (i < 0) { righe.push('', `## ${nome}`, riga); return righe.join('\n') + '\n'; }
  let fine = righe.length;
  for (let j = i + 1; j < righe.length; j++) if (/^#{1,2}\s/.test(righe[j])) { fine = j; break; }
  let k = fine; while (k - 1 > i && !righe[k - 1].trim()) k--;   // dopo l'ultima riga piena della sezione
  righe.splice(k, 0, riga);
  return righe.join('\n') + '\n';
}

/* ---------- l'orario: una tabella Markdown che si può modificare anche da Obsidian ---------- */
export function orarioMd(orario) {
  const r = [...orario].sort((a, b) => (a.giorni[0] ?? 9) - (b.giorni[0] ?? 9) || a.inizio.localeCompare(b.inizio));
  return `---
tipo: orario
---
# Orario delle lezioni

Lode lo legge per sapere quando sei a lezione. Puoi modificarlo qui o dalla barra («lezione analisi 2 lunedì e mercoledì 9-11 aula 7»).

| Corso | Giorni | Inizio | Fine | Aula |
|---|---|---|---|---|
${r.map(x => `| [[${pulito(x.corso)}]] | ${x.giorni.map(g => GIORNI_BREVI[g]).join(', ')} | ${x.inizio} | ${x.fine} | ${x.aula || ''} |`).join('\n')}
`;
}
export function leggiOrario(testo) {
  const out = [];
  for (const r of String(testo).split(/\r?\n/)) {
    if (!/^\|/.test(r) || /^\|\s*-/.test(r) || /^\|\s*Corso\s*\|/i.test(r)) continue;
    const c = r.split('|').slice(1, -1).map(x => x.trim());
    if (c.length < 4) continue;
    const corso = c[0].replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();
    const giorni = c[1].toLowerCase().split(/[,\s]+/).map(g => GIORNI_BREVI.findIndex(b => g.startsWith(b))).filter(g => g >= 0);
    const ora = x => { const m = x.match(/^(\d{1,2})(?:[:.](\d{2}))?$/); return m ? `${m[1].padStart(2, '0')}:${m[2] || '00'}` : null; };
    if (corso && giorni.length && ora(c[2]) && ora(c[3])) out.push({ corso, giorni, inizio: ora(c[2]), fine: ora(c[3]), aula: c[4] || '' });
  }
  return out;
}
