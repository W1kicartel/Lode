// La prima volta: «Ciao, sono Lode». Una finestra a passi, bianca e nera come la barra.
// OBBLIGATORIO: come ti chiami, Obsidian, il cervello locale (AI) e la voce. Senza queste Lode non è Lode.
// FACOLTATIVO, il «setup veloce»: ateneo e corso, libretto (incollato da Esse3), esami da dare, orario delle lezioni
// (scritto, incollato o da un file .ics del calendario dell'ateneo), come studi e quanto spesso Lode può proporti cose.
// Tutto resta nel vault dello studente. Si può rifare quando si vuole dal menu dell'icona.
import { D, DESKTOP, VUOTO, aggiungiEsame, aggiungiOrario, esc, id, norm, oggi, salva, sostituisci } from './dati.js';
import { entra, tween, h } from './motore.js';
import * as V from './vault.js';
import * as AI from './ai.js';
import * as Voce from './voce.js';
import { leggiOrario as orarioDaFrase, leggiData } from './comandi.js';
import { GIORNI_BREVI } from './markdown.js';

const L = DESKTOP ? window.lodeDesktop : null;
const GEMMA = '<svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="M0,-44 Q4,-44 7,-41 L41,-7 Q44,-4 44,0 Q44,4 41,7 L7,41 Q4,44 0,44 Q-4,44 -7,41 L-41,7 Q-44,4 -44,0 Q-44,-4 -41,-7 L-7,-41 Q-4,-44 0,-44 Z" fill="#fff"/><path d="M0,-44 L44,0 L0,44 Z" fill="#E9E9E9"/><ellipse class="o" cx="-13" cy="-2" rx="5.2" ry="8.5" fill="#0A0A0A"/><ellipse class="o" cx="13" cy="-2" rx="5.2" ry="8.5" fill="#0A0A0A"/></svg>';
const ATENEI = ['Politecnico di Milano', 'Politecnico di Torino', 'Politecnico di Bari', 'Alma Mater Studiorum – Università di Bologna', 'Sapienza Università di Roma', 'Università di Roma Tor Vergata', 'Università Roma Tre', 'Università di Padova', 'Università degli Studi di Milano (Statale)', 'Università di Milano-Bicocca', 'Università Cattolica del Sacro Cuore', 'Università Bocconi', 'Università di Torino', 'Università di Pisa', 'Università di Napoli Federico II', 'Università della Campania Vanvitelli', 'Università di Firenze', 'Università di Pavia', 'Università di Genova', 'Università di Trento', 'Università di Bari Aldo Moro', 'Università di Palermo', 'Università di Catania', 'Università di Messina', 'Università di Verona', 'Università Ca\' Foscari Venezia', 'IUAV di Venezia', 'Università di Trieste', 'Università di Udine', 'Università di Parma', 'Università di Modena e Reggio Emilia', 'Università di Ferrara', 'Università di Siena', 'Università di Perugia', 'Università di Cagliari', 'Università di Sassari', 'Università di Salerno', 'Università della Calabria', 'Università di Brescia', 'Università di Bergamo', 'Università Politecnica delle Marche', 'Università dell\'Insubria', 'Università del Piemonte Orientale', 'Università del Salento', 'Università di Chieti-Pescara', 'Università dell\'Aquila', 'LUISS Guido Carli', 'IULM'];
const NOMI_ESEMPIO = ['Analisi 1', 'Fondamenti di informatica', 'Geometria e algebra lineare', 'Fisica 1', 'Lingua inglese B2', 'Programmazione a oggetti', 'Analisi 2', 'Basi di dati', 'Fisica 2'];

const S = { passo: 0, installa: {}, esami: [], fatti: [], orario: [] };
const PASSI = [
  { k: 'ciao', obbl: true }, { k: 'nome', obbl: true }, { k: 'installa', obbl: true }, { k: 'veloce' },
  { k: 'corso' }, { k: 'libretto' }, { k: 'esami' }, { k: 'orario' }, { k: 'abitudini' }, { k: 'fine' },
];
let main;

export function avvia() {
  document.documentElement.classList.add('benvenuto');
  main = document.querySelector('main'); main.innerHTML = '';
  S.nome = (D.profilo.nome && D.profilo.nome !== 'Giulia') ? D.profilo.nome : '';
  S.esempio = D.profilo.nome === 'Giulia' || D.esami.some(e => NOMI_ESEMPIO.includes(e.nome) && e.id);
  if (L) L.su('installa:progresso', x => { S.installa[x.cosa] = x; aggiornaInstalla(); });
  addEventListener('lode:voce', e => { S.installa.voce = e.detail.fase === 'pronta' ? { fase: 'fatto', p: 1, testo: 'Whisper è pronto' } : e.detail.fase === 'errore' ? { fase: 'errore', testo: e.detail.testo } : { fase: 'scarico', p: e.detail.p, testo: `Scarico la voce · ${Math.round((e.detail.p || 0) * 100)}%` }; aggiornaInstalla(); });
  disegna();
}

function guscio(contenuto, { avanti = 'Avanti', salta = false, indietro = true, avantiNo = false } = {}) {
  const i = S.passo, p = PASSI[i];
  const facoltativo = i >= 3 && i < PASSI.length - 1;
  main.innerHTML = `<div class="bv">
    <header class="bv-testa"><span class="bv-gemma">${GEMMA}</span><div class="bv-punti">${PASSI.map((_, k) => `<i class="${k < i ? 'fatto' : k === i ? 'ora' : ''}${k === 3 ? ' sep' : ''}"></i>`).join('')}</div><span class="bv-tipo">${i < 3 ? 'Obbligatorio' : facoltativo ? 'Facoltativo · setup veloce' : ''}</span></header>
    <section class="bv-corpo">${contenuto}</section>
    <footer class="bv-piede">${indietro && i > 0 ? '<button class="btn piano" data-bv="indietro">Indietro</button>' : '<span></span>'}<div>${salta ? '<button class="btn piano" data-bv="salta">Salta</button>' : ''}<button class="btn primary" data-bv="avanti"${avantiNo ? ' disabled' : ''}>${avanti}</button></div></footer>
  </div>`;
  [...main.querySelectorAll('.bv-corpo > *')].forEach((el, k) => entra(el, { ritardo: 60 + k * 70, dy: 12, blur: 8, ms: 620 }));
  main.querySelector('[data-bv=indietro]')?.addEventListener('click', () => vai(-1));
  main.querySelector('[data-bv=salta]')?.addEventListener('click', () => { if (p.k === 'veloce') { S.passo = PASSI.length - 2; vai(1); } else vai(1); });
  main.querySelector('[data-bv=avanti]').addEventListener('click', () => { if ((PASSI[S.passo].salva?.() ?? true) !== false) vai(1); });
}
function vai(d) { S.passo = Math.max(0, Math.min(PASSI.length - 1, S.passo + d)); disegna(); }
function disegna() { ({ ciao, nome, installa, veloce, corso, libretto, esami, orario, abitudini, fine })[PASSI[S.passo].k](); }
const P = k => PASSI.find(p => p.k === k);

/* ---------- obbligatorio ---------- */
function ciao() {
  guscio(`<h1>Ciao.<br>Io sono Lode.</h1>
    <p class="bv-sub">Vivo in una piccola barra in cima allo schermo. In aula non ti faccio perdere niente, a casa ti alleno su quello che stai per dimenticare, e tengo tutto nel tuo Obsidian.</p>
    <p class="bv-nota">Prima tre cose necessarie (due minuti, più i download). Poi, se vuoi, il setup veloce.</p>`, { avanti: 'Iniziamo', indietro: false });
}
function nome() {
  guscio(`<h1>Come ti chiami?</h1><p class="bv-sub">Solo per salutarti. Resta sul tuo computer.</p>
    <label class="bv-campo grande"><input id="bv-nome" autocomplete="given-name" placeholder="Il tuo nome" value="${esc(S.nome)}" maxlength="40"></label>
    ${S.esempio ? `<label class="bv-spunta"><input type="checkbox" id="bv-pulisci" checked><span>Togli i dati di esempio di «Giulia» (esami, voti, carte e ore di studio finti). Le cose che hai aggiunto tu restano.</span></label>` : ''}`, { avantiNo: !S.nome });
  const inp = main.querySelector('#bv-nome'), av = main.querySelector('[data-bv=avanti]');
  inp.addEventListener('input', () => { S.nome = inp.value.trim(); av.disabled = !S.nome; });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && S.nome) av.click(); });
  setTimeout(() => inp.focus(), 300);
  P('nome').salva = () => {
    if (!S.nome) return false;
    if (S.esempio && main.querySelector('#bv-pulisci')?.checked) pulisciEsempio();
    D.profilo.nome = S.nome.replace(/^./, c => c.toUpperCase()); salva();
  };
}
// i dati di esempio se ne vanno, quello che ha aggiunto lo studente resta
function pulisciEsempio() {
  const finti = new Set(D.esami.filter(e => NOMI_ESEMPIO.includes(e.nome)).map(e => e.id));
  const vuoto = VUOTO();
  D.esami = D.esami.filter(e => !finti.has(e.id));
  D.sessioni = D.sessioni.filter(s => !s.esameId || (!finti.has(s.esameId) && D.esami.some(e => e.id === s.esameId)));
  D.carte = D.carte.filter(c => c.esameId && !finti.has(c.esameId));
  D.lezioni = []; D.memoria = {};
  D.orario = D.orario.filter(o => !NOMI_ESEMPIO.includes(o.corso));
  D.profilo = { ...vuoto.profilo, cfuTotali: D.profilo.cfuTotali };
  S.esempio = false;
  L?.invoca('vault:pulisciCorsi', { nomi: NOMI_ESEMPIO }).catch(() => { });
}
function installa() {
  const web = !L;
  guscio(web ? `<h1>Lode completa vive nell'app.</h1><p class="bv-sub">Nel browser hai libretto, timer, ripasso e giochi. Obsidian, l'AI sul computer, la voce e la trascrizione delle lezioni sono nell'app desktop.</p>`
    : `<h1>Prepariamo il tuo computer.</h1><p class="bv-sub">Tre installazioni, una volta sola. Poi Lode funziona anche senza internet, e niente di tuo esce dal computer.</p>
    <div class="bv-inst">${[['obsidian', 'Obsidian', 'dove vivono i tuoi appunti: un vault già pronto', '230 MB'], ['cervello', 'Il cervello locale', 'Ollama e Gemma 3: legge gli appunti, crea carte e definizioni, spiega e interroga', '3,5 GB'], ['voce', 'La voce', 'Whisper: comandi a voce, «Ripeti» e trascrizione delle lezioni', '200 MB']]
      .map(([k, t, d, mb]) => `<div class="bv-riga" data-k="${k}"><i class="bv-stato"></i><div><b>${t}</b><span class="d">${d}</span><i class="bv-barra"><i></i></i></div><small>${mb}</small></div>`).join('')}</div>
    <p class="bv-nota">Obsidian è gratis per uso personale e viene dal suo sito ufficiale. Il cervello locale si sceglie in base alla memoria del computer.</p>`,
  { avanti: web ? 'Avanti' : 'Installa tutto', avantiNo: false });
  if (web) return;
  aggiornaInstalla();
  const av = main.querySelector('[data-bv=avanti]');
  const tutto = () => ['obsidian', 'cervello', 'voce'].every(k => S.installa[k]?.fase === 'fatto');
  if (S.avviato) { av.textContent = 'Avanti'; }
  P('installa').salva = () => {
    if (S.avviato) return true;   // i download continuano: si può andare avanti, la barra mostra l'avanzamento
    S.avviato = true; av.textContent = 'Avanti';
    L.invoca('installa:stato').then(st => {
      if (st.obsidian.installato) S.installa.obsidian = { fase: 'fatto', p: 1, testo: 'Già installato' }; else L.invoca('installa:obsidian');
      if (st.modello) S.installa.cervello = { fase: 'fatto', p: 1, testo: `${st.modello} è già pronto` }; else L.invoca('installa:cervello');
      aggiornaInstalla();
    });
    if (Voce.pronta()) S.installa.voce = { fase: 'fatto', p: 1, testo: 'Già pronta' }; else Voce.prepara().then(() => { try { localStorage.setItem('lode:voce', '1'); } catch { } }).catch(() => { });
    aggiornaInstalla();
    return false;
  };
  if (tutto()) av.textContent = 'Avanti';
}
function aggiornaInstalla() {
  for (const k of ['obsidian', 'cervello', 'voce']) {
    const r = main?.querySelector(`.bv-riga[data-k="${k}"]`), x = S.installa[k]; if (!r || !x) continue;
    r.classList.toggle('va', x.fase !== 'fatto' && x.fase !== 'errore'); r.classList.toggle('ok', x.fase === 'fatto'); r.classList.toggle('ko', x.fase === 'errore');
    r.querySelector('.d').textContent = x.testo || '';
    r.querySelector('.bv-barra i').style.transform = `scaleX(${(x.p ?? 0).toFixed(3)})`;
  }
  const fin = main?.querySelector('.bv-attesa');
  if (fin) fin.innerHTML = statoDownload();
}
const statoDownload = () => {
  if (!L) return '';
  const k = ['obsidian', 'cervello', 'voce'], mancano = k.filter(x => S.installa[x]?.fase !== 'fatto');
  if (!mancano.length) return 'Obsidian, il cervello locale e la voce sono pronti.';
  return `Sto ancora scaricando: ${mancano.map(x => ({ obsidian: 'Obsidian', cervello: 'il cervello locale', voce: 'la voce' })[x] + (S.installa[x]?.p ? ` ${Math.round(S.installa[x].p * 100)}%` : '')).join(', ')}. Continua da solo, anche a finestra chiusa.`;
};

/* ---------- facoltativo: il setup veloce ---------- */
function veloce() {
  guscio(`<h1>${esc(S.nome || D.profilo.nome)}, vuoi il setup veloce?</h1>
    <p class="bv-sub">Raccontami università, esami e orari: da domani Lode sa quando sei a lezione, quanto ti manca alla laurea e cosa ripassare prima di ogni appello.</p>
    <ul class="bv-lista"><li>Ateneo e corso di laurea</li><li>Il libretto, incollato da Esse3 o scritto a mano</li><li>Gli esami da dare, con le date</li><li>L'orario delle lezioni, anche dal calendario dell'ateneo (.ics)</li><li>Come e quando studi</li></ul>
    <p class="bv-nota">Tutto facoltativo, tutto modificabile dopo. Niente va su internet.</p>`, { avanti: 'Facciamolo', salta: true });
}
function corso() {
  const p = D.profilo;
  guscio(`<h1>Dove studi?</h1>
    <div class="bv-griglia">
      <label class="bv-campo tutta"><span>Ateneo</span><input id="bv-ateneo" list="bv-atenei" value="${esc(p.ateneo || '')}" placeholder="Inizia a scrivere…"><datalist id="bv-atenei">${ATENEI.map(a => `<option value="${esc(a)}">`).join('')}</datalist></label>
      <label class="bv-campo tutta"><span>Corso di laurea</span><input id="bv-corso" value="${esc(p.corso || '')}" placeholder="Ingegneria informatica"></label>
      <label class="bv-campo"><span>Tipo</span><select id="bv-cfu">${[[180, 'Triennale · 180 CFU'], [120, 'Magistrale · 120 CFU'], [300, 'Ciclo unico · 300 CFU'], [360, 'Ciclo unico · 360 CFU']].map(([v, t]) => `<option value="${v}"${p.cfuTotali === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="bv-campo"><span>Anno</span><select id="bv-anno">${['1°', '2°', '3°', '4°', '5°', '6°', 'Fuori corso'].map((a, i) => `<option value="${i + 1}"${p.anno === i + 1 ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
      <label class="bv-campo"><span>La lode vale</span><select id="bv-lode">${[30, 31, 32, 33].map(v => `<option${p.lode === v ? ' selected' : ''}>${v}</option>`).join('')}</select><small>Dipende dal regolamento: nel dubbio 30</small></label>
    </div>`, { salta: true });
  P('corso').salva = () => {
    const v = id => main.querySelector('#' + id).value;
    Object.assign(D.profilo, { ateneo: v('bv-ateneo').trim(), corso: v('bv-corso').trim(), cfuTotali: +v('bv-cfu'), anno: +v('bv-anno'), lode: +v('bv-lode') }); salva();
  };
}
// il libretto: incollato dalla pagina «Libretto» di Esse3 (o simili) oppure riga per riga
function libretto() {
  const gia = D.esami.filter(e => e.fatto);
  guscio(`<h1>Gli esami che hai già dato</h1>
    <p class="bv-sub">Apri il libretto sul portale dell'ateneo (Esse3, Infostud…), seleziona tutto, copia e incolla qui. Ci penso io. Oppure scrivili una riga ciascuno: «Analisi 1, 9 CFU, 28».</p>
    <label class="bv-campo"><textarea id="bv-lib" rows="7" placeholder="Incolla qui il libretto…"></textarea></label>
    <div class="bv-az"><button class="btn" id="bv-leggi">Leggi il libretto</button><span class="bv-esito"></span></div>
    <div class="bv-tab" id="bv-tab">${tabFatti(gia)}</div>`, { salta: true });
  const ta = main.querySelector('#bv-lib'), esito = main.querySelector('.bv-esito');
  main.querySelector('#bv-leggi').addEventListener('click', async e => {
    const testo = ta.value.trim(); if (!testo) return;
    e.target.disabled = true; esito.textContent = AI.attiva() ? 'Leggo il libretto…' : 'Leggo…';
    let trovati = [];
    try { trovati = AI.attiva() ? await AI.leggiLibretto(testo) : librettoSenzaAI(testo); } catch { trovati = librettoSenzaAI(testo); }
    S.fatti = trovati; esito.textContent = trovati.length ? `${trovati.length} esami trovati: controlla e conferma.` : 'Non ho trovato esami: prova a scriverli una riga ciascuno.';
    main.querySelector('#bv-tab').innerHTML = tabFatti(trovati, true); e.target.disabled = false;
  });
  P('libretto').salva = () => {
    for (const r of main.querySelectorAll('#bv-tab tr[data-i]')) {
      if (!r.querySelector('input[type=checkbox]')?.checked) continue;
      const x = S.fatti[+r.dataset.i], gia = D.esami.find(e => norm(e.nome) === norm(x.nome));
      const dati = { voto: x.idoneita ? null : x.voto, lode: !!x.lode, idoneita: !!x.idoneita, fatto: true, data: x.data || oggi(), cfu: x.cfu || 6 };
      if (gia) Object.assign(gia, dati); else D.esami.push({ id: id(), nome: x.nome, oreObiettivo: null, ...dati });
    }
    salva(); S.fatti = [];
  };
}
function tabFatti(lista, nuovi = false) {
  if (!lista.length) return '';
  return `<table><thead><tr>${nuovi ? '<th></th>' : ''}<th>Esame</th><th class="num">CFU</th><th class="num">Voto</th><th class="num">Data</th></tr></thead><tbody>${lista.map((x, i) => `<tr${nuovi ? ` data-i="${i}"` : ''}>${nuovi ? '<td><input type="checkbox" checked aria-label="Importa"></td>' : ''}<td>${esc(x.nome)}</td><td class="num">${x.cfu || '—'}</td><td class="num">${x.idoneita ? 'idoneo' : (x.voto ?? '—') + (x.lode ? 'L' : '')}</td><td class="num">${x.data || ''}</td></tr>`).join('')}</tbody></table>`;
}
// senza AI: righe con un nome, dei CFU e un voto 18-30 (o «30L», «30 e lode», «idoneo»)
export function librettoSenzaAI(testo) {
  const out = [];
  const bello = n => /[a-zà-ù]/.test(n) ? n : n.toLowerCase().replace(/^./, c => c.toUpperCase()).replace(/\b(i{1,3}|iv|v|vi{0,3})\b/g, x => x.toUpperCase()).replace(/\b(b[12]|c[12]|a[12])\b/gi, x => x.toUpperCase());
  for (const r0 of String(testo).split(/\r?\n/)) {
    const r = r0.replace(/\s+/g, ' ').trim(); if (r.length < 6) continue;
    const voto = r.match(/\b(30\s*(?:e\s*lode|l)|1[89]|2\d|30)\s*(?:\/\s*30)?(?![\d/.-])(?!\s*(?:cfu|crediti))/i), idoneo = /idone|superat|approvat/i.test(r);
    if (!voto && !idoneo) continue;
    const fineNome = voto ? voto.index : r.search(/idone|superat|approvat/i);
    const prima = r.slice(0, fineNome), data = r.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
    // CFU: «9 CFU» se c'è scritto, altrimenti l'ultimo numero piccolo prima del voto (in Esse3: anno, CFU, voto)
    const esplicito = r.match(/\b(\d{1,2})(?:[.,]0+)?\s*(?:cfu|crediti)\b/i);
    const numeri = [...prima.replace(/^\s*[A-Z]{0,4}\d{3,}\s*[-–]?\s*/, '').matchAll(/(?:^|\s|,)(\d{1,2})(?:[.,]0+)?(?=\s|,|$)/g)].map(m => +m[1]).filter(n => n >= 1 && n <= 30);
    const cfu = esplicito ? +esplicito[1] : numeri.length ? numeri[numeri.length - 1] : null;
    const nome = prima.replace(/^\s*[A-Z]{0,4}\d{3,}\s*[-–]?\s*/, '').split(/[,;\t]|\s{2,}|\s\d/)[0].trim();
    if (nome.length < 3 || /^(codice|attivit|libretto|esame|insegnamento)/i.test(nome)) continue;
    out.push({ nome: bello(nome), cfu, voto: voto ? (/l|lode/i.test(voto[1]) ? 30 : +voto[1].slice(0, 2)) : null, lode: !!voto && /l|lode/i.test(voto[1]), idoneita: !voto && idoneo, data: data ? `${data[3].length === 2 ? '20' + data[3] : data[3]}-${data[2].padStart(2, '0')}-${data[1].padStart(2, '0')}` : null });
  }
  return out;
}
function esami() {
  S.esami = D.esami.filter(e => !e.fatto).map(e => ({ nome: e.nome, cfu: e.cfu, data: e.data || '' }));
  if (!S.esami.length) S.esami = [{ nome: '', cfu: 6, data: '' }];
  const righe = () => S.esami.map((x, i) => `<div class="bv-es" data-i="${i}"><input class="n" value="${esc(x.nome)}" placeholder="Esame" aria-label="Esame"><input class="c" type="number" min="1" max="30" value="${x.cfu || 6}" aria-label="CFU"><input class="d" type="date" value="${x.data || ''}" aria-label="Data dell'appello"><button class="ld-x" aria-label="Togli">×</button></div>`).join('');
  guscio(`<h1>Gli esami da dare</h1><p class="bv-sub">Con la data dell'appello, se la sai. Da lì Lode calcola quante ore ti servono ogni giorno e ti propone ripassi e giochi quando hai un momento.</p>
    <div class="bv-esami">${righe()}</div><button class="btn piano" id="bv-piu">+ Un altro esame</button>`, { salta: true });
  const box = main.querySelector('.bv-esami');
  const leggi = () => { S.esami = [...box.querySelectorAll('.bv-es')].map(r => ({ nome: r.querySelector('.n').value.trim(), cfu: +r.querySelector('.c').value || 6, data: r.querySelector('.d').value })); };
  const rid = () => { box.innerHTML = righe(); collega(); };
  const collega = () => box.querySelectorAll('.ld-x').forEach(b => b.addEventListener('click', () => { leggi(); S.esami.splice(+b.parentElement.dataset.i, 1); rid(); }));
  collega();
  main.querySelector('#bv-piu').addEventListener('click', () => { leggi(); S.esami.push({ nome: '', cfu: 6, data: '' }); rid(); box.querySelector('.bv-es:last-child .n').focus(); });
  P('esami').salva = () => {
    leggi();
    for (const x of S.esami.filter(x => x.nome)) {
      const gia = D.esami.find(e => !e.fatto && norm(e.nome) === norm(x.nome));
      if (gia) Object.assign(gia, { cfu: x.cfu, data: x.data || null }); else aggiungiEsame({ nome: x.nome, cfu: x.cfu, data: x.data || null });
    }
    salva();
  };
}
function orario() {
  S.orario = D.orario.map(o => ({ ...o }));
  const righe = () => S.orario.map((o, i) => `<div class="bv-or"><b>${esc(o.corso)}</b><span>${o.giorni.map(g => GIORNI_BREVI[g]).join(', ')} · ${o.inizio}–${o.fine}${o.aula ? ' · aula ' + esc(o.aula) : ''}</span><button class="ld-x" data-i="${i}" aria-label="Togli">×</button></div>`).join('') || '<p class="bv-nota">Ancora nessuna lezione.</p>';
  guscio(`<h1>L'orario delle lezioni</h1><p class="bv-sub">Così Lode sa quando sei in aula: la barra si prepara alla lezione, «Ripeti» e la trascrizione sono a un tasto, e a casa ti allena su quello che hai appena sentito.</p>
    <div class="bv-orari">${righe()}</div>
    <label class="bv-campo"><span>Scrivila come la diresti</span><input id="bv-frase" placeholder="analisi 2 lunedì e mercoledì 9-11 aula 7"></label>
    <div class="bv-az"><button class="btn" id="bv-aggiungi">Aggiungi</button><label class="btn piano bv-file">Importa il calendario (.ics)<input type="file" accept=".ics,text/calendar" hidden></label><span class="bv-esito"></span></div>
    <label class="bv-campo"><span>Oppure incolla l'orario dal sito dell'ateneo</span><textarea id="bv-incolla" rows="4" placeholder="Incolla qui la tabella dell'orario…"></textarea></label>
    <div class="bv-az"><button class="btn" id="bv-leggiorario">Leggi l'orario</button></div>`, { salta: true });
  const esito = main.querySelector('.bv-esito'), box = main.querySelector('.bv-orari');
  const aggiorna = () => { box.innerHTML = righe(); box.querySelectorAll('.ld-x').forEach(b => b.addEventListener('click', () => { S.orario.splice(+b.dataset.i, 1); aggiorna(); })); };
  aggiorna();
  const metti = lista => { let n = 0; for (const o of lista) if (o?.corso && o.giorni?.length && o.inizio && o.fine && !S.orario.some(x => norm(x.corso) === norm(o.corso) && x.inizio === o.inizio && x.giorni.join() === o.giorni.join())) { S.orario.push({ id: id(), aula: '', ...o }); n++; } aggiorna(); return n; };
  const frase = main.querySelector('#bv-frase');
  const da = () => { const o = orarioDaFrase(frase.value); if (!o) { esito.textContent = 'Scrivi corso, giorni e ore: «fisica lunedì 14-16 aula B2».'; return; } metti([o]); frase.value = ''; esito.textContent = ''; frase.focus(); };
  main.querySelector('#bv-aggiungi').addEventListener('click', da);
  frase.addEventListener('keydown', e => { if (e.key === 'Enter') da(); });
  main.querySelector('.bv-file input').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; const n = metti(orarioDaIcs(await f.text())); esito.textContent = n ? `${n} lezioni dal calendario.` : 'Nel calendario non ho trovato lezioni settimanali.'; });
  main.querySelector('#bv-leggiorario').addEventListener('click', async e => {
    const t = main.querySelector('#bv-incolla').value.trim(); if (!t) return;
    e.target.disabled = true; esito.textContent = 'Leggo l\'orario…';
    let lista = [];
    try { lista = AI.attiva() ? await AI.leggiOrario(t) : t.split(/\r?\n/).map(orarioDaFrase).filter(Boolean); } catch { lista = t.split(/\r?\n/).map(orarioDaFrase).filter(Boolean); }
    const n = metti(lista); esito.textContent = n ? `${n} lezioni trovate.` : 'Non ho trovato lezioni: prova a scriverle una alla volta.'; e.target.disabled = false;
  });
  P('orario').salva = () => { D.orario = S.orario; salva(); V.scriviOrario(); };
}
// il calendario dell'ateneo: eventi settimanali (RRULE WEEKLY) o eventi ripetuti nella stessa ora → lezioni
export function orarioDaIcs(testo) {
  const eventi = String(testo).replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1).map(b => {
    const v = k => (b.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, 'm')) || [])[1]?.trim() || '';
    const t = s => { const m = s.match(/T(\d\d)(\d\d)/); return m ? `${m[1]}:${m[2]}` : null; };
    const g = s => { const m = s.match(/^(\d{4})(\d\d)(\d\d)/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getDay() : null; };
    const by = (v('RRULE').match(/BYDAY=([A-Z,]+)/) || [])[1];
    const MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    return { corso: v('SUMMARY').replace(/\\,/g, ',').replace(/\s*[-–(].*$/, '').trim(), giorni: by ? by.split(',').map(x => MAP[x]) : [g(v('DTSTART'))], inizio: t(v('DTSTART')), fine: t(v('DTEND')), aula: v('LOCATION').replace(/\\,/g, ',').slice(0, 30), settimanale: /FREQ=WEEKLY/.test(v('RRULE')) };
  }).filter(e => e.corso && e.inizio && e.fine && e.giorni.every(x => x != null));
  // senza RRULE: tiene solo ciò che si ripete almeno due volte allo stesso giorno e ora
  const conta = new Map(); eventi.forEach(e => { const k = `${norm(e.corso)}|${e.giorni[0]}|${e.inizio}`; conta.set(k, (conta.get(k) || 0) + 1); });
  const visti = new Set(), out = [];
  for (const e of eventi) {
    const k = `${norm(e.corso)}|${e.giorni.join(',')}|${e.inizio}`;
    if (visti.has(k) || (!e.settimanale && (conta.get(`${norm(e.corso)}|${e.giorni[0]}|${e.inizio}`) || 0) < 2)) continue;
    visti.add(k); out.push({ corso: e.corso.replace(/^./, c => c.toUpperCase()), giorni: e.giorni, inizio: e.inizio, fine: e.fine, aula: e.aula });
  }
  return out;
}
function abitudini() {
  const i = D.imp;
  guscio(`<h1>Come studi?</h1><p class="bv-sub">Lode ti propone ripassi, giochi e domande lampo in momenti a caso della giornata, quando sei al computer. Dimmi quanto spesso e quando lasciarti in pace.</p>
    <div class="bv-griglia">
      <div class="bv-campo tutta"><span>Quando studi meglio</span><div class="bv-scelte" data-k="momento">${[['mattina', 'Mattina'], ['pomeriggio', 'Pomeriggio'], ['sera', 'Sera'], ['notte', 'Notte']].map(([v, t]) => `<button class="ld-chip${(i.momento || 'pomeriggio') === v ? ' on' : ''}" data-v="${v}"><b>${t}</b></button>`).join('')}</div></div>
      <div class="bv-campo tutta"><span>Proposte di Lode</span><div class="bv-scelte" data-k="allenatore">${[['mai', 'Mai'], ['poco', 'Poche'], ['normale', 'Normali'], ['spesso', 'Tante']].map(([v, t]) => `<button class="ld-chip${(i.allenatore || 'normale') === v ? ' on' : ''}" data-v="${v}"><b>${t}</b></button>`).join('')}</div><small>Più l'esame è vicino, più spesso. Mai durante lezioni, focus o di notte.</small></div>
      <label class="bv-campo"><span>Silenzio dalle</span><input type="time" id="bv-sd" value="${i.silenzio?.da || '23:00'}"></label>
      <label class="bv-campo"><span>alle</span><input type="time" id="bv-sa" value="${i.silenzio?.a || '08:00'}"></label>
      <div class="bv-campo tutta"><span>Focus</span><div class="bv-scelte" data-k="focus">${[25, 50, 90].map(v => `<button class="ld-chip${(i.focus || 25) === v ? ' on' : ''}" data-v="${v}"><b>${v} min</b></button>`).join('')}</div></div>
      <label class="bv-spunta tutta"><input type="checkbox" id="bv-aula"${i.trascrizioneOk ? ' checked' : ''}><span>In aula accendi «Ripeti» da solo (gli ultimi 60 secondi, solo in memoria). Chiedi al docente se si può registrare.</span></label>
    </div>`, { salta: true });
  main.querySelectorAll('.bv-scelte').forEach(g => g.querySelectorAll('.ld-chip').forEach(b => b.addEventListener('click', () => { g.querySelectorAll('.ld-chip').forEach(x => x.classList.toggle('on', x === b)); })));
  P('abitudini').salva = () => {
    const sc = k => main.querySelector(`.bv-scelte[data-k="${k}"] .on`)?.dataset.v;
    Object.assign(D.imp, { momento: sc('momento'), allenatore: sc('allenatore'), focus: +sc('focus'), silenzio: { da: main.querySelector('#bv-sd').value, a: main.querySelector('#bv-sa').value } });
    if (main.querySelector('#bv-aula').checked) { D.imp.trascrizioneOk = true; D.imp.ripetiInAula = true; } else D.imp.ripetiInAula = false;
    salva();
  };
}
function fine() {
  const p = D.esami.filter(e => !e.fatto && e.data).sort((a, b) => a.data.localeCompare(b.data))[0];
  guscio(`<h1>Fatto, ${esc(D.profilo.nome || S.nome)}.</h1>
    <p class="bv-sub">Lode ora vive in cima allo schermo. Passaci sopra per aprirla, tieni premuto <b>⌥ Spazio</b> per parlarle, trascinaci sopra un PDF o una foto della lavagna.</p>
    <ul class="bv-lista">${D.profilo.corso ? `<li>${esc(D.profilo.corso)}${D.profilo.ateneo ? ' · ' + esc(D.profilo.ateneo) : ''}</li>` : ''}<li>${D.esami.filter(e => e.fatto).length} esami nel libretto, ${D.esami.filter(e => !e.fatto).length} da dare${p ? ` · il prossimo è ${esc(p.nome)}` : ''}</li><li>${D.orario.length} lezioni a settimana in orario</li><li>Proposte: ${({ mai: 'mai', poco: 'poche', normale: 'normali', spesso: 'tante' })[D.imp.allenatore || 'normale']}</li></ul>
    <p class="bv-nota bv-attesa">${statoDownload()}</p>`, { avanti: 'Apri Lode', indietro: true });
  P('fine').salva = () => { D.imp.benvenuto = oggi(); D.benvenuto = true; salva(); V.scriviOrario(); L ? L.invoca('benvenuto:fatto') : location.reload(); return false; };
}
