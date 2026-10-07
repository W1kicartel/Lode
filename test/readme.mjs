// I README: node test/readme.mjs
// README.md è in inglese (la porta d'ingresso su GitHub), README.it.md è l'italiano completo (docs/LINGUE.md, «README»).
// Controlla che stiano insieme: 1) in cima i link alle lingue; 2) ogni #ancora porta a un titolo vero, con le regole di
// GitHub, anche verso l'altro file e da CONTRIBUTING.md; 3) ogni file citato con un link relativo esiste; 4) gli stessi
// comandi di terminale (blocchi bash e powershell, comandi tra apici inversi), gli stessi link esterni, le stesse immagini,
// le stesse sezioni; 5) la sezione delle lingue nomina tutte le lingue di js/lingua.js; 6) la stessa tabella dei file e le
// stesse prove citate; 7) i link con ancora ai README da fuori (note dei rilasci, documenti, codice) portano a un titolo vero.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { LINGUE } from '../js/lingua.js';

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const R = new URL('../', import.meta.url);
const leggi = f => readFileSync(new URL(f, R), 'utf8');
const FILE = ['README.md', 'README.it.md', 'CONTRIBUTING.md'];
const testo = Object.fromEntries(FILE.map(f => [f, leggi(f)]));

// i blocchi di codice (anche rientrati, dentro un elenco): { lingua, righe senza il rientro }
const BLOCCO = /^([ \t]*)```(\w*)\n([\s\S]*?)^[ \t]*```[ \t]*$/gm;
const blocchi = s => [...s.matchAll(BLOCCO)].map(m => ({ lingua: m[2], codice: m[3].split('\n').map(r => r.replace(new RegExp('^' + m[1]), '')).join('\n').trim() }));
const senzaBlocchi = s => s.replace(BLOCCO, '');

// l'ancora che GitHub dà a un titolo: il testo visibile, minuscolo, senza punteggiatura, spazi → trattini; i doppioni -1, -2…
function ancore(s) {
  const viste = new Map(), tutte = new Set();
  for (const m of senzaBlocchi(s).matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*#*$/gm)) {
    const vis = m[1].replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '').replace(/[`*_]/g, m => (m === '_' ? '_' : ''));
    const base = vis.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
    const n = viste.get(base) || 0; viste.set(base, n + 1);
    tutte.add(n ? `${base}-${n}` : base);
  }
  return tutte;
}
const ANCORE = Object.fromEntries(FILE.map(f => [f, ancore(testo[f])]));
const titoli = s => senzaBlocchi(s).match(/^#{1,3}[ \t]+.+$/gm).map(t => t.match(/^#+/)[0].length);
// i link [testo](destinazione), fuori dai blocchi di codice
const collegamenti = s => [...senzaBlocchi(s).matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1]);
const immagini = s => [...s.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(m => m[1]);

/* ---------- 1) le lingue in cima ---------- */
prova('README.md comincia con «English · Italiano»', testo['README.md'].split('\n')[0] === '**English** · [Italiano](README.it.md)', testo['README.md'].split('\n')[0]);
prova('README.it.md comincia con «English · Italiano»', testo['README.it.md'].split('\n')[0] === '[English](README.md) · **Italiano**', testo['README.it.md'].split('\n')[0]);
prova('CONTRIBUTING.md porta alla parte in inglese', /\]\(#in-english\)/.test(testo['CONTRIBUTING.md']) && ANCORE['CONTRIBUTING.md'].has('in-english'));

/* ---------- 2) e 3) le ancore e i file ---------- */
for (const f of FILE) {
  for (const l of collegamenti(testo[f])) {
    if (/^(?:https?:|mailto:)/.test(l)) continue;
    const [file, ancora] = l.split('#');
    const dest = file || f;
    prova(`${f}: il file di «${l}» esiste`, existsSync(new URL(dest, R)));
    if (ancora != null && /\.md$/.test(dest)) prova(`${f}: l'ancora di «${l}» c'è`, ANCORE[dest]?.has(ancora), ANCORE[dest] ? '' : `(${dest} non controllato)`);
  }
}
// le ancore più usate da fuori, che non devono cambiare per sbaglio
for (const a of ['install', 'windows', 'mac', 'linux', 'the-installers-not-signed-yet', 'the-voice', 'languages', 'for-developers', 'sync-between-your-computers-experimental'])
  prova(`README.md: c'è l'ancora #${a}`, ANCORE['README.md'].has(a));
for (const a of ['installa', 'windows', 'mac', 'linux', 'gli-installer-non-ancora-firmati', 'la-voce', 'lingue', 'per-chi-sviluppa', 'sincronizza-fra-i-tuoi-computer-sperimentale'])
  prova(`README.it.md: c'è l'ancora #${a}`, ANCORE['README.it.md'].has(a));

/* ---------- 4) le due lingue dicono le stesse cose ---------- */
const [en, it] = [testo['README.md'], testo['README.it.md']];
prova('stesse sezioni (titoli di livello 1-3, nello stesso ordine)', titoli(en).join() === titoli(it).join(), `${titoli(en).length} contro ${titoli(it).length}`);
const comandi = s => blocchi(s).filter(b => /^(?:bash|powershell)$/.test(b.lingua)).map(b => `${b.lingua}: ${b.codice}`);
const ce = comandi(en), ci = comandi(it);
prova('stessi comandi di terminale, nello stesso ordine', ce.length === ci.length && ce.every((c, i) => c === ci[i]), ce.filter((c, i) => c !== ci[i]).join(' | '));
// i comandi tra apici inversi (`npm install`, `ollama rm …`): ogni comando dell'italiano c'è anche in inglese
const RIGA = /`((?:cd|npm|npx|bash|sudo|git|ollama|shasum|sha256sum|chmod|Get-FileHash|Set-ExecutionPolicy|winget|xcode-select|node|python3)\b[^`]*)`/g;
const inl = s => new Set([...senzaBlocchi(s).matchAll(RIGA)].map(m => m[1]));
const mancano = [...inl(it)].filter(c => !inl(en).has(c));
prova('i comandi tra apici inversi dell\'italiano ci sono anche in inglese', !mancano.length, mancano.join(' | '));
const esterni = s => [...new Set(collegamenti(s).filter(l => /^https?:/.test(l)))].sort();
prova('stessi link esterni', esterni(en).join() === esterni(it).join(), [...esterni(en).filter(l => !esterni(it).includes(l)), ...esterni(it).filter(l => !esterni(en).includes(l))].join(' | '));
prova('stesse immagini, nello stesso ordine', immagini(en).join() === immagini(it).join() && immagini(en).length > 0);
prova('stessi blocchi di comandi per la barra', blocchi(en).filter(b => !b.lingua).length === blocchi(it).filter(b => !b.lingua).length);

/* ---------- 5) le lingue e i sistemi dei voti ---------- */
const sezione = (s, titolo) => (s.split(new RegExp(`^## ${titolo}$`, 'm'))[1] || '').split(/^## /m)[0];
const lingueEn = sezione(en, 'Languages'), lingueIt = sezione(it, 'Lingue');
for (const [cod, { nome }] of Object.entries(LINGUE)) {
  prova(`README.md, «Languages»: nomina ${cod}`, lingueEn.includes(nome));
  prova(`README.it.md, «Lingue»: nomina ${cod}`, lingueIt.toLowerCase().includes(nome.toLowerCase()));
}
prova('README.md: i sistemi dei voti di otto paesi', /Italy, Spain, France, Germany, Portugal, Brazil, the United Kingdom and the United States/.test(en) && ['Italy', 'Spain', 'France', 'Germany', 'Portugal', 'Brazil', 'United Kingdom', 'United States'].every(p => lingueEn.includes(`| ${p} |`)));
prova('le due sezioni delle lingue portano a docs/LINGUE.md', lingueEn.includes('(docs/LINGUE.md)') && lingueIt.includes('(docs/LINGUE.md)'));

/* ---------- 6) le stesse cose per chi sviluppa ---------- */
// la tabella dei file (prima colonna) e le prove citate (`test/….mjs`) sono le stesse nei due README
const fileTabella = s => [...s.matchAll(/^\| (`[^|]*`) \|/gm)].map(m => m[1]);
prova('stessa tabella dei file, nello stesso ordine', fileTabella(en).join() === fileTabella(it).join() && fileTabella(en).length > 20, [...fileTabella(en).filter(x => !fileTabella(it).includes(x)), ...fileTabella(it).filter(x => !fileTabella(en).includes(x))].join(' | '));
const prove = s => [...new Set([...s.matchAll(/`(test\/[\w/-]+\.mjs)`/g)].map(m => m[1]))].sort();
prova('stesse prove citate', prove(en).join() === prove(it).join(), [...prove(en).filter(x => !prove(it).includes(x)), ...prove(it).filter(x => !prove(en).includes(x))].join(' | '));

/* ---------- 7) i link ai README da fuori ---------- */
// le note dei rilasci, i documenti e il codice portano al README con un'ancora: dopo il passaggio all'inglese
// «github.com/W1kicartel/Lode#installa» non porta più da nessuna parte (la pagina del repository mostra README.md)
const FUORI = ['.github/workflows/rilascio.yml', '.github/workflows/prove.yml', 'SECURITY.md', 'CONTRIBUTING.md', ...readdirSync(new URL('docs/', R)).filter(f => f.endsWith('.md')).map(f => 'docs/' + f), ...readdirSync(new URL('js/', R)).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
let collegamentiFuori = 0;
for (const f of FUORI.filter(f => existsSync(new URL(f, R)))) {
  const s = leggi(f);
  for (const m of s.matchAll(/github\.com\/W1kicartel\/Lode(?:\/blob\/main\/(README(?:\.it)?\.md))?#([\w-]+)/g)) {
    collegamentiFuori++;
    const dest = m[1] || 'README.md';
    prova(`${f}: «${m[0]}» porta a un titolo di ${dest}`, ANCORE[dest].has(m[2]));
  }
  for (const m of s.matchAll(/\]\((?:\.\.\/)?(README(?:\.it)?\.md)#([^)\s]+)\)/g)) {
    collegamentiFuori++;
    prova(`${f}: «${m[0]}» porta a un titolo di ${m[1]}`, ANCORE[m[1]].has(m[2]));
  }
}
prova('i link ai README da fuori sono stati trovati (rilascio.yml)', collegamentiFuori >= 2, collegamentiFuori);

console.log(`${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
