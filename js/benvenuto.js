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
import { t, elenco, numero } from './lingua.js';

const L = DESKTOP ? window.lodeDesktop : null;
// la scorciatoia per parlare, come nella barra (su Windows ⌥ Spazio è il menu della finestra)
const TASTI = () => (L ? L.piattaforma === 'darwin' : /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) ? t('benvenuto.tasti-mac') : t('benvenuto.tasti-altri');
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
  // i dati di esempio: dal segno che mette esempio() (js/dati.js), o da «Giulia» insieme ai nomi di esempio per quelli caricati da
  // una Lode di prima. Prima bastava un esame con un nome di esempio («Analisi 1», «Fisica 1»…), comunissimo anche fra quelli veri:
  // con la sincronizzazione il benvenuto ripartito su un computer collegato li toglieva a tutti i computer (giro 3). Con la
  // sincronizzazione accesa la casella non è mai spuntata da sola (S.sync)
  S.esempio = D.esempio === true || (D.profilo.nome === 'Giulia' && D.esami.some(e => NOMI_ESEMPIO.includes(e.nome) && e.id));
  S.sync = false; L?.invoca('sync:stato').then(s => { S.sync = !!s?.acceso; }).catch(() => { });
  if (L) { L.su('installa:progresso', x => { S.installa[x.cosa] = x; aggiornaInstalla(); }); Voce.motoreNelMain().then(m => { S.voceMac = m; }); }
  addEventListener('lode:voce', e => { if (e.detail.fase === 'ripiego') S.voceMac = false;   // Whisper si scarica in questa finestra
  S.installa.voce = e.detail.fase === 'pronta' ? { fase: 'fatto', p: 1, testo: t('benvenuto.voce-pronta', { voce: Voce.NOME_VOCE }) } : e.detail.fase === 'errore' ? { fase: 'errore', testo: e.detail.testo } : e.detail.fase === 'ripiego' ? { fase: 'scarico', p: 0, testo: e.detail.testo } : { fase: 'scarico', p: e.detail.p, testo: t('benvenuto.scarico-voce-pct', { p: Math.round((e.detail.p || 0) * 100) }) }; aggiornaInstalla(); });
  disegna();
}

function guscio(contenuto, { avanti = t('benvenuto.avanti'), salta = false, indietro = true, avantiNo = false } = {}) {
  const i = S.passo, p = PASSI[i];
  const facoltativo = i >= 3 && i < PASSI.length - 1;
  main.innerHTML = `<div class="bv">
    <header class="bv-testa"><span class="bv-gemma">${GEMMA}</span><div class="bv-punti">${PASSI.map((_, k) => `<i class="${k < i ? 'fatto' : k === i ? 'ora' : ''}${k === 3 ? ' sep' : ''}"></i>`).join('')}</div><span class="bv-tipo">${i < 3 ? t('benvenuto.obbligatorio') : facoltativo ? t('benvenuto.facoltativo') : ''}</span></header>
    <section class="bv-corpo">${contenuto}</section>
    <footer class="bv-piede">${indietro && i > 0 ? `<button class="btn piano" data-bv="indietro">${t('benvenuto.indietro')}</button>` : '<span></span>'}<div>${salta ? `<button class="btn piano" data-bv="salta">${t('benvenuto.salta')}</button>` : ''}<button class="btn primary" data-bv="avanti"${avantiNo ? ' disabled' : ''}>${avanti}</button></div></footer>
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
  guscio(`<h1>${t('benvenuto.ciao-titolo')}</h1>
    <p class="bv-sub">${t('benvenuto.ciao-sotto')}</p>
    <p class="bv-nota">${t('benvenuto.ciao-nota')}</p>
    ${L ? `<p class="bv-nota"><button type="button" class="btn ld-piano" id="bv-altro">${t('benvenuto.altro-computer')} <small>${t('benvenuto.sperimentale')}</small></button></p><div id="bv-collega" hidden></div>` : ''}`, { avanti: t('benvenuto.iniziamo'), indietro: false });
  main.querySelector('#bv-altro')?.addEventListener('click', collega);
}
// «Uso già Lode su un altro computer» (docs/SINCRONIZZAZIONE.md §12): si sceglie il vault nella cartella cloud, si scrive la
// password lì se serve, e Lode è già usabile mentre i dati arrivano. Il setup veloce non serve: profilo e esami arrivano
// dagli altri computer
async function collega() {
  const box = main.querySelector('#bv-collega'); box.hidden = false;
  const { vault = [] } = await L.invoca('sync:cartelle').catch(() => ({}));
  box.innerHTML = `<p class="bv-sub">${t('benvenuto.scegli-vault-cloud')}</p>
    <div class="bv-scelte">${vault.map(v => `<button type="button" class="btn" data-v="${v.i}">${esc(v.nome)} · ${esc(v.servizio)}</button>`).join('')}<button type="button" class="btn" data-v="altro">${t('benvenuto.scegli-vault')}</button></div>
    <label class="bv-campo"><span>${t('benvenuto.password-dati')}</span><input type="password" id="bv-pw" autocomplete="current-password"></label>
    <p class="bv-nota" id="bv-esito" aria-live="polite"></p>`;
  const esito = box.querySelector('#bv-esito');
  box.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', async () => {
    box.querySelectorAll('[data-v]').forEach(x => { x.disabled = true; }); esito.textContent = t('benvenuto.collego');
    const pw = box.querySelector('#bv-pw').value || null;
    const r = await L.invoca('sync:collega', { ...(b.dataset.v === 'altro' ? { scegli: true } : { i: +b.dataset.v }), password: pw }).catch(e => ({ esito: 'errore', errore: e.message }));
    box.querySelectorAll('[data-v]').forEach(x => { x.disabled = false; });
    if (r.esito === 'annullato') { esito.textContent = ''; return; }
    if (r.esito !== 'ok') { esito.textContent = r.errore || t('benvenuto.cartella-no'); return; }
    box.querySelector('#bv-pw').value = '';
    const fine = () => { box.innerHTML = `<p class="bv-sub">${t('benvenuto.ricevo-dati')}</p><div class="bv-az"><button type="button" class="btn primary" id="bv-fatto">${t('benvenuto.inizia')}</button></div>`; box.querySelector('#bv-fatto').addEventListener('click', () => L.invoca('benvenuto:fatto')); };
    if (r.stato !== 'password') return fine();
    esito.textContent = pw ? (r.avviso || t('benvenuto.password-sbagliata')) : t('benvenuto.password-serve');
    const inp = box.querySelector('#bv-pw'); inp.focus();
    // ok solo quando il gruppo di adesso si è aperto (il main lo dice con esito e stato): «la password di prima», «una Lode più
    // nuova» e «manomesso» hanno la loro frase. Prima ogni risposta diversa da ok era «Password sbagliata»
    inp.onkeydown = async e => { if (e.key !== 'Enter' || !inp.value) return; const s = await L.invoca('sync:sblocca', { password: inp.value }); inp.value = ''; if (s.esito === 'ok' && s.stato !== 'password' && s.stato !== 'rigenerato') fine(); else esito.textContent = s.errore || t('benvenuto.password-sbagliata'); };
  }));
}
function nome() {
  guscio(`<h1>${t('benvenuto.nome-titolo')}</h1><p class="bv-sub">${t('benvenuto.nome-sotto')}</p>
    <label class="bv-campo grande"><input id="bv-nome" autocomplete="given-name" placeholder="${t('benvenuto.nome-segnaposto')}" value="${esc(S.nome)}" maxlength="40"></label>
    ${S.esempio ? `<label class="bv-spunta"><input type="checkbox" id="bv-pulisci"${S.sync ? '' : ' checked'}><span>${t('benvenuto.togli-esempio')}</span></label>` : ''}`, { avantiNo: !S.nome });
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
  S.esempio = false; delete D.esempio;
  L?.invoca('vault:pulisciCorsi', { nomi: NOMI_ESEMPIO }).catch(() => { });
}
function installa() {
  const web = !L;
  guscio(web ? `<h1>${t('benvenuto.web-titolo')}</h1><p class="bv-sub">${t('benvenuto.web-sotto')}</p>`
    : `<h1>${t('benvenuto.installa-titolo')}</h1><p class="bv-sub">${t('benvenuto.installa-sotto')}</p>
    <div class="bv-inst">${[['obsidian', t('benvenuto.obsidian'), t('benvenuto.obsidian-cosa'), t('benvenuto.peso-mb', { n: 230 })], ['cervello', t('benvenuto.cervello'), t('benvenuto.cervello-cosa'), t('benvenuto.peso-gb', { n: numero(3.5, 1) })], ['voce', t('benvenuto.voce'), t('benvenuto.voce-cosa', { voce: Voce.descrizioneVoce() }), t('benvenuto.peso-mb', { n: esc(Voce.PESO_VOCE) })]]
      .map(([k, t, d, mb]) => `<div class="bv-riga" data-k="${k}"><i class="bv-stato"></i><div><b>${t}</b><span class="d">${d}</span><i class="bv-barra"><i></i></i></div><small>${mb}</small></div>`).join('')}</div>
    <p class="bv-nota">${t('benvenuto.installa-nota')}</p>`,
  { avanti: web ? t('benvenuto.avanti') : t('benvenuto.installa-tutto'), avantiNo: false });
  if (web) return;
  aggiornaInstalla();
  const av = main.querySelector('[data-bv=avanti]');
  const tutto = () => ['obsidian', 'cervello', 'voce'].every(k => S.installa[k]?.fase === 'fatto');
  if (S.avviato) { av.textContent = t('benvenuto.avanti'); }
  P('installa').salva = () => {
    if (S.avviato) return true;   // i download continuano: si può andare avanti, la barra mostra l'avanzamento
    S.avviato = true; av.textContent = t('benvenuto.avanti');
    L.invoca('installa:stato').then(st => {
      if (st.obsidian.installato) S.installa.obsidian = { fase: 'fatto', p: 1, testo: t('benvenuto.gia-installato') }; else L.invoca('installa:obsidian');
      if (st.modello) S.installa.cervello = { fase: 'fatto', p: 1, testo: t('benvenuto.modello-pronto', { modello: st.modello }) }; else L.invoca('installa:cervello');
      aggiornaInstalla();
    });
    // il segno si mette subito: Whisper si scarica in questa finestra e, se si chiude prima, la barra riprende da sola
    if (Voce.pronta()) S.installa.voce = { fase: 'fatto', p: 1, testo: t('benvenuto.gia-pronta') }; else { try { localStorage.setItem('lode:voce', '1'); } catch { } Voce.prepara().catch(() => { }); }
    aggiornaInstalla();
    return false;
  };
  if (tutto()) av.textContent = t('benvenuto.avanti');
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
  if (!mancano.length) return t('benvenuto.tutto-pronto');
  // Whisper si scarica in questa finestra (Parakeet no, va avanti nel programma): chiusa lei, lo riprende la barra
  const voceQui = mancano.includes('voce') && !S.voceMac, altri = mancano.length > (voceQui ? 1 : 0);
  const cosa = mancano.map(x => { const n = ({ obsidian: t('benvenuto.scarico-obsidian'), cervello: t('benvenuto.scarico-cervello'), voce: t('benvenuto.scarico-voce') })[x]; return S.installa[x]?.p ? t('benvenuto.scarico-pct', { cosa: n, p: Math.round(S.installa[x].p * 100) }) : n; }).join(', ');
  return t(altri ? (voceQui ? 'benvenuto.scarico-continua-voce' : 'benvenuto.scarico-continua') : 'benvenuto.scarico-solo-voce', { cosa });
};

/* ---------- facoltativo: il setup veloce ---------- */
function veloce() {
  guscio(`<h1>${t('benvenuto.veloce-titolo', { nome: esc(S.nome || D.profilo.nome) })}</h1>
    <p class="bv-sub">${t('benvenuto.veloce-sotto')}</p>
    <ul class="bv-lista">${elenco('benvenuto.veloce-lista').map(x => `<li>${x}</li>`).join('')}</ul>
    <p class="bv-nota">${t('benvenuto.veloce-nota')}</p>`, { avanti: t('benvenuto.facciamolo'), salta: true });
}
function corso() {
  const p = D.profilo;
  guscio(`<h1>${t('benvenuto.corso-titolo')}</h1>
    <div class="bv-griglia">
      <label class="bv-campo tutta"><span>${t('benvenuto.ateneo')}</span><input id="bv-ateneo" list="bv-atenei" value="${esc(p.ateneo || '')}" placeholder="${t('benvenuto.ateneo-segnaposto')}"><datalist id="bv-atenei">${ATENEI.map(a => `<option value="${esc(a)}">`).join('')}</datalist></label>
      <label class="bv-campo tutta"><span>${t('benvenuto.corso')}</span><input id="bv-corso" value="${esc(p.corso || '')}" placeholder="${t('benvenuto.corso-segnaposto')}"></label>
      <label class="bv-campo"><span>${t('benvenuto.tipo')}</span><select id="bv-cfu">${[[180, t('benvenuto.tipo-180')], [120, t('benvenuto.tipo-120')], [300, t('benvenuto.tipo-300')], [360, t('benvenuto.tipo-360')]].map(([v, x]) => `<option value="${v}"${p.cfuTotali === v ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="bv-campo"><span>${t('benvenuto.anno')}</span><select id="bv-anno">${elenco('benvenuto.anni').map((a, i) => `<option value="${i + 1}"${p.anno === i + 1 ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
      <label class="bv-campo"><span>${t('benvenuto.lode-vale')}</span><select id="bv-lode">${[30, 31, 32, 33].map(v => `<option${p.lode === v ? ' selected' : ''}>${v}</option>`).join('')}</select><small>${t('benvenuto.lode-nota')}</small></label>
    </div>`, { salta: true });
  P('corso').salva = () => {
    const v = id => main.querySelector('#' + id).value;
    Object.assign(D.profilo, { ateneo: v('bv-ateneo').trim(), corso: v('bv-corso').trim(), cfuTotali: +v('bv-cfu'), anno: +v('bv-anno'), lode: +v('bv-lode') }); salva();
  };
}
// il libretto: incollato dalla pagina «Libretto» di Esse3 (o simili) oppure riga per riga
function libretto() {
  const gia = D.esami.filter(e => e.fatto);
  guscio(`<h1>${t('benvenuto.libretto-titolo')}</h1>
    <p class="bv-sub">${t('benvenuto.libretto-sotto')}</p>
    <label class="bv-campo"><textarea id="bv-lib" rows="7" placeholder="${t('benvenuto.libretto-segnaposto')}"></textarea></label>
    <div class="bv-az"><button class="btn" id="bv-leggi">${t('benvenuto.leggi-libretto')}</button><span class="bv-esito"></span></div>
    <div class="bv-tab" id="bv-tab">${tabFatti(gia)}</div>`, { salta: true });
  const ta = main.querySelector('#bv-lib'), esito = main.querySelector('.bv-esito');
  main.querySelector('#bv-leggi').addEventListener('click', async e => {
    const testo = ta.value.trim(); if (!testo) return;
    e.target.disabled = true; esito.textContent = AI.attiva() ? t('benvenuto.leggo-libretto') : t('benvenuto.leggo');
    let trovati = [];
    try { trovati = AI.attiva() ? await AI.leggiLibretto(testo) : librettoSenzaAI(testo); } catch { trovati = librettoSenzaAI(testo); }
    S.fatti = trovati; esito.textContent = trovati.length ? t('benvenuto.esami-trovati', { n: trovati.length }) : t('benvenuto.esami-non-trovati');
    main.querySelector('#bv-tab').innerHTML = tabFatti(trovati, true); e.target.disabled = false;
  });
  P('libretto').salva = () => {
    for (const r of main.querySelectorAll('#bv-tab tr[data-i]')) {
      if (!r.querySelector('input[type=checkbox]')?.checked) continue;
      const x = S.fatti[+r.dataset.i], gia = D.esami.find(e => norm(e.nome) === norm(x.nome));
      const dati = { voto: x.idoneita ? null : Math.round(+x.voto) || null, lode: !!x.lode, idoneita: !!x.idoneita, fatto: true, data: x.data || oggi(), cfu: Number(x.cfu) || 6 };   // numeri veri, anche se il libretto letto dall'AI li dà come testo
      if (gia) Object.assign(gia, dati); else D.esami.push({ id: id(), nome: x.nome, oreObiettivo: null, ...dati });
    }
    salva(); S.fatti = [];
  };
}
function tabFatti(lista, nuovi = false) {
  if (!lista.length) return '';
  return `<table><thead><tr>${nuovi ? '<th></th>' : ''}<th>${t('benvenuto.col-esame')}</th><th class="num">${t('benvenuto.col-cfu')}</th><th class="num">${t('benvenuto.col-voto')}</th><th class="num">${t('benvenuto.col-data')}</th></tr></thead><tbody>${lista.map((x, i) => `<tr${nuovi ? ` data-i="${esc(i)}"` : ''}>${nuovi ? `<td><input type="checkbox" checked aria-label="${t('benvenuto.importa')}"></td>` : ''}<td>${esc(x.nome)}</td><td class="num">${esc(x.cfu || '—')}</td><td class="num">${x.idoneita ? t('benvenuto.idoneo') : x.lode ? t('benvenuto.voto-lode', { voto: esc(x.voto ?? '—') }) : esc(x.voto ?? '—')}</td><td class="num">${esc(x.data || '')}</td></tr>`).join('')}</tbody></table>`;
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
  const righe = () => S.esami.map((x, i) => `<div class="bv-es" data-i="${esc(i)}"><input class="n" value="${esc(x.nome)}" placeholder="${t('benvenuto.esame')}" aria-label="${t('benvenuto.esame')}"><input class="c" type="number" min="1" max="30" value="${esc(x.cfu || 6)}" aria-label="${t('benvenuto.cfu')}"><input class="d" type="date" value="${esc(x.data || '')}" aria-label="${t('benvenuto.data-appello')}"><button class="ld-x" aria-label="${t('benvenuto.togli')}">×</button></div>`).join('');
  guscio(`<h1>${t('benvenuto.esami-titolo')}</h1><p class="bv-sub">${t('benvenuto.esami-sotto')}</p>
    <div class="bv-esami">${righe()}</div><button class="btn piano" id="bv-piu">${t('benvenuto.altro-esame')}</button>`, { salta: true });
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
      if (gia) Object.assign(gia, { cfu: Number(x.cfu) || 6, data: x.data || null }); else aggiungiEsame({ nome: x.nome, cfu: Number(x.cfu) || 6, data: x.data || null });
    }
    salva();
  };
}
function orario() {
  S.orario = D.orario.map(o => ({ ...o }));
  const righe = () => S.orario.map((o, i) => `<div class="bv-or"><b>${esc(o.corso)}</b><span>${t(o.aula ? 'benvenuto.orario-riga-aula' : 'benvenuto.orario-riga', { giorni: esc(o.giorni.map(g => GIORNI_BREVI[g]).join(', ')), inizio: esc(o.inizio), fine: esc(o.fine), aula: esc(o.aula) })}</span><button class="ld-x" data-i="${esc(i)}" aria-label="${t('benvenuto.togli')}">×</button></div>`).join('') || `<p class="bv-nota">${t('benvenuto.nessuna-lezione')}</p>`;
  guscio(`<h1>${t('benvenuto.orario-titolo')}</h1><p class="bv-sub">${t('benvenuto.orario-sotto')}</p>
    <div class="bv-orari">${righe()}</div>
    <label class="bv-campo"><span>${t('benvenuto.scrivila')}</span><input id="bv-frase" placeholder="${t('benvenuto.frase-segnaposto')}"></label>
    <div class="bv-az"><button class="btn" id="bv-aggiungi">${t('benvenuto.aggiungi')}</button><label class="btn piano bv-file">${t('benvenuto.importa-ics')}<input type="file" accept=".ics,text/calendar" hidden></label><span class="bv-esito"></span></div>
    <label class="bv-campo"><span>${t('benvenuto.incolla-orario')}</span><textarea id="bv-incolla" rows="4" placeholder="${t('benvenuto.orario-segnaposto')}"></textarea></label>
    <div class="bv-az"><button class="btn" id="bv-leggiorario">${t('benvenuto.leggi-orario')}</button></div>`, { salta: true });
  const esito = main.querySelector('.bv-esito'), box = main.querySelector('.bv-orari');
  const aggiorna = () => { box.innerHTML = righe(); box.querySelectorAll('.ld-x').forEach(b => b.addEventListener('click', () => { S.orario.splice(+b.dataset.i, 1); aggiorna(); })); };
  aggiorna();
  const metti = lista => { let n = 0; for (const o of lista) if (o?.corso && o.giorni?.length && o.inizio && o.fine && !S.orario.some(x => norm(x.corso) === norm(o.corso) && x.inizio === o.inizio && x.giorni.join() === o.giorni.join())) { S.orario.push({ id: id(), aula: '', ...o }); n++; } aggiorna(); return n; };
  const frase = main.querySelector('#bv-frase');
  const da = () => { const o = orarioDaFrase(frase.value); if (!o) { esito.textContent = t('benvenuto.frase-aiuto'); return; } metti([o]); frase.value = ''; esito.textContent = ''; frase.focus(); };
  main.querySelector('#bv-aggiungi').addEventListener('click', da);
  frase.addEventListener('keydown', e => { if (e.key === 'Enter') da(); });
  main.querySelector('.bv-file input').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; const n = metti(orarioDaIcs(await f.text())); esito.textContent = n ? t('benvenuto.lezioni-calendario', { n }) : t('benvenuto.calendario-vuoto'); });
  main.querySelector('#bv-leggiorario').addEventListener('click', async e => {
    const incollato = main.querySelector('#bv-incolla').value.trim(); if (!incollato) return;
    e.target.disabled = true; esito.textContent = t('benvenuto.leggo-orario');
    let lista = [];
    try { lista = AI.attiva() ? await AI.leggiOrario(incollato) : incollato.split(/\r?\n/).map(orarioDaFrase).filter(Boolean); } catch { lista = incollato.split(/\r?\n/).map(orarioDaFrase).filter(Boolean); }
    const n = metti(lista); esito.textContent = n ? t('benvenuto.lezioni-trovate', { n }) : t('benvenuto.lezioni-non-trovate'); e.target.disabled = false;
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
  guscio(`<h1>${t('benvenuto.abitudini-titolo')}</h1><p class="bv-sub">${t('benvenuto.abitudini-sotto')}</p>
    <div class="bv-griglia">
      <div class="bv-campo tutta"><span>${t('benvenuto.quando-meglio')}</span><div class="bv-scelte" data-k="momento">${[['mattina', t('benvenuto.mattina')], ['pomeriggio', t('benvenuto.pomeriggio')], ['sera', t('benvenuto.sera')], ['notte', t('benvenuto.notte')]].map(([v, x]) => `<button class="ld-chip${(i.momento || 'pomeriggio') === v ? ' on' : ''}" data-v="${v}"><b>${x}</b></button>`).join('')}</div></div>
      <div class="bv-campo tutta"><span>${t('benvenuto.proposte')}</span><div class="bv-scelte" data-k="allenatore">${[['mai', t('benvenuto.scelta-mai')], ['poco', t('benvenuto.scelta-poco')], ['normale', t('benvenuto.scelta-normale')], ['spesso', t('benvenuto.scelta-spesso')]].map(([v, x]) => `<button class="ld-chip${(i.allenatore || 'normale') === v ? ' on' : ''}" data-v="${v}"><b>${x}</b></button>`).join('')}</div><small>${t('benvenuto.proposte-nota')}</small></div>
      <label class="bv-campo"><span>${t('benvenuto.silenzio-dalle')}</span><input type="time" id="bv-sd" value="${esc(i.silenzio?.da || '23:00')}"></label>
      <label class="bv-campo"><span>${t('benvenuto.silenzio-alle')}</span><input type="time" id="bv-sa" value="${esc(i.silenzio?.a || '08:00')}"></label>
      <div class="bv-campo tutta"><span>${t('benvenuto.focus')}</span><div class="bv-scelte" data-k="focus">${[25, 50, 90].map(v => `<button class="ld-chip${(i.focus || 25) === v ? ' on' : ''}" data-v="${v}"><b>${t('benvenuto.minuti', { n: v })}</b></button>`).join('')}</div></div>
      <label class="bv-spunta tutta"><input type="checkbox" id="bv-aula"${i.trascrizioneOk ? ' checked' : ''}><span>${t('benvenuto.ripeti-in-aula')}</span></label>
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
  guscio(`<h1>${t('benvenuto.fine-titolo', { nome: esc(D.profilo.nome || S.nome) })}</h1>
    <p class="bv-sub">${t('benvenuto.fine-sotto', { tasti: TASTI() })}</p>
    <ul class="bv-lista">${D.profilo.corso ? `<li>${esc(D.profilo.corso)}${D.profilo.ateneo ? ' · ' + esc(D.profilo.ateneo) : ''}</li>` : ''}<li>${t(p ? 'benvenuto.fine-esami-prossimo' : 'benvenuto.fine-esami', { fatti: esc(D.esami.filter(e => e.fatto).length), dare: esc(D.esami.filter(e => !e.fatto).length), nome: p ? esc(p.nome) : '' })}</li><li>${t('benvenuto.fine-lezioni', { n: esc(D.orario.length) })}</li><li>${t('benvenuto.fine-proposte', { quante: esc(({ mai: t('benvenuto.quante-mai'), poco: t('benvenuto.quante-poco'), normale: t('benvenuto.quante-normale'), spesso: t('benvenuto.quante-spesso') })[D.imp.allenatore || 'normale']) })}</li></ul>
    <p class="bv-nota bv-attesa">${statoDownload()}</p>`, { avanti: t('benvenuto.apri-lode'), indietro: true });
  P('fine').salva = () => { D.imp.benvenuto = oggi(); D.benvenuto = true; salva(); V.scriviOrario(); L ? L.invoca('benvenuto:fatto') : location.reload(); return false; };
}
