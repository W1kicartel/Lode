// Il modello di riferimento: la semantica che vogliamo dalla sincronizzazione, indipendente da come il motore la ottiene.
//
// Lo stato si guarda come un insieme di «registri» (proiezione()): l'esistenza di un esame o di una carta, ogni campo
// (nome, data, ore obiettivo, voto, cfu; fronte, retro, esame della carta; il ripasso SM-2 della carta come un valore solo),
// ogni lezione dell'orario (c'è / non c'è), profilo e impostazioni, i contatori (codice.errori, memoria.giuste).
//
// CAUSALITÀ. Un'operazione fatta su un computer «ha visto» quello che lo studente vedeva lì in quel momento: per ogni registro
// che scrive, prima = l'operazione che aveva scritto il valore mostrato dalla vista (i valori sono unici, quindi si riconosce).
// Le catene di «prima» danno l'ordine causale per registro: un'operazione supera tutte quelle della sua catena. Non si suppone
// niente sui file letti o sugli orologi: conta solo cosa lo studente aveva davanti.
//
// REGOLE (verifica()):
// - registro: il valore finale deve essere quello di un'operazione che nessuna operazione CONFERMATA ha superato. Fra
//   operazioni concorrenti (nessuna nella catena dell'altra) il motore sceglie con una sua regola deterministica: va bene
//   qualunque, purché tutti i computer scelgano la stessa (convergenza). Con regola 'tempo-reale' invece deve vincere la più
//   recente nel tempo vero del mondo (non nell'orologio del computer): è quello che lo studente si aspetta (catalogo #45);
// - un'operazione non confermata (il motore è morto prima di rispondere) può esserci o no, e così quello che lei superava;
// - contatori: la somma di tutti gli incrementi confermati, più al massimo quelli non confermati;
// - CANCELLAZIONE CONCORRENTE A UNA MODIFICA (la scelta): una cancellazione supera quello che lo studente vedeva del record
//   quando l'ha cancellato. Se su un altro computer, senza averla vista, il record è stato modificato, il modello accetta
//   tutti e due gli esiti, purché uguali su tutti i computer: record cancellato, oppure record di nuovo vivo e COMPLETO (ogni
//   campo con un valore permesso, compreso il ripasso della carta: una carta tornata senza scadenza è un errore, #27). Se
//   invece ogni modifica era già stata vista dalla cancellazione, il record non deve tornare;
// - niente record, lezioni o contatori che nessuna operazione ha creato.
import { stabile } from './comune.mjs';
import { chiaveLezione } from './operazioni.mjs';
import { applica } from '../../js/sm2.js';

const vuoto = v => v === undefined || v === null;
const CAMPI_ESAME = ['nome', 'cfu', 'voto', 'data', 'oreObiettivo'], CAMPI_CARTA = ['fronte', 'retro', 'esameId'];
export const RIPASSO = ['ease', 'int', 'rip', 'scad'];
const PROFILO = ['nome', 'corso', 'cfuTotali'], IMP = ['focus', 'pausa', 'aspetto'];

// D (la vista del motore) → Map registro → valore (testo stabile). Le lezioni assenti non ci sono (= 'no')
export function proiezione(D) {
  const P = new Map(), metti = (k, v) => { if (!vuoto(v)) P.set(k, stabile(v)); };
  if (!D || typeof D !== 'object') return P;
  for (const e of Array.isArray(D.esami) ? D.esami : []) if (e && typeof e.id === 'string') { P.set(`esame/${e.id}`, '"si"'); for (const c of CAMPI_ESAME) metti(`esame/${e.id}/${c}`, e[c]); }
  for (const c of Array.isArray(D.carte) ? D.carte : []) if (c && typeof c.id === 'string') {
    P.set(`carta/${c.id}`, '"si"'); for (const f of CAMPI_CARTA) metti(`carta/${c.id}/${f}`, c[f]);
    if (RIPASSO.some(k => !vuoto(c[k]))) P.set(`carta/${c.id}/ripasso`, stabile(Object.fromEntries(RIPASSO.map(k => [k, c[k] ?? null]))));
  }
  for (const o of Array.isArray(D.orario) ? D.orario : []) if (o && o.corso) P.set(`lezione/${chiaveLezione(o)}`, '"si"');
  for (const f of PROFILO) metti(`profilo/${f}`, D.profilo?.[f]);
  for (const f of IMP) metti(`imp/${f}`, D.imp?.[f]);
  for (const [k, v] of Object.entries(D.codice?.errori || {})) if (+v) P.set(`errori/${k}`, String(+v));
  for (const [k, v] of Object.entries(D.memoria || {})) if (+v?.giuste) P.set(`giuste/${k}`, String(+v.giuste));
  return P;
}
export const testoProiezione = P => stabile(Object.fromEntries([...P].sort()));

// le scritture di un'operazione concreta: [{ reg, valore }] | { cancella: prefisso } | { conto, di }
export function scrittureDi(op) {
  switch (op.tipo) {
    case 'aggiungiEsame': return [{ reg: `esame/${op.id}`, valore: '"si"' }, { reg: `esame/${op.id}/nome`, valore: stabile(op.nome) }, { reg: `esame/${op.id}/cfu`, valore: stabile(op.cfu ?? 6) }];
    case 'campoEsame': return [{ reg: `esame/${op.id}/${op.campo}`, valore: stabile(op.valore) }];
    case 'cancellaEsame': return [{ cancella: `esame/${op.id}` }];
    case 'aggiungiCarta': return [{ reg: `carta/${op.id}`, valore: '"si"' }, ...['fronte', 'retro', 'esameId'].map(f => ({ reg: `carta/${op.id}/${f}`, valore: stabile(op[f]) })),
      { reg: `carta/${op.id}/ripasso`, valore: stabile({ ease: 2.5, int: 0, rip: 0, scad: op.scad || '2026-10-03' }) }];
    case 'testoCarta': return [{ reg: `carta/${op.id}/${op.campo}`, valore: stabile(op.valore) }];
    case 'ripassaCarta': return [{ reg: `carta/${op.id}/ripasso`, valore: stabile(Object.fromEntries(RIPASSO.map(k => [k, op.ripasso[k] ?? null]))) }];
    case 'cancellaCarta': return [{ cancella: `carta/${op.id}` }];
    case 'incrementa': return [{ conto: `${op.dove}/${op.chiave}`, di: op.di }];
    case 'profilo': return [{ reg: `profilo/${op.campo}`, valore: stabile(op.valore) }];
    case 'impostazione': return [{ reg: `imp/${op.campo}`, valore: stabile(op.valore) }];
    case 'aggiungiLezione': return [{ reg: `lezione/${chiaveLezione(op.lezione)}`, valore: '"si"' }];
    case 'togliLezione': return [{ reg: `lezione/${chiaveLezione(op.lezione)}`, valore: '"no"' }];
    default: return [];
  }
}
const valoreMostrato = (P, reg) => P.get(reg) ?? (reg.startsWith('lezione/') ? '"no"' : undefined);
const recordDi = reg => { const m = reg.match(/^(esame|carta)\/[^/]+/); return m ? m[0] : null; };

export function creaModello({ regola = 'libera' } = {}) {
  const ops = [];   // { n, pc, op, scr, prima: Map reg → n | null, copre: [{reg, n}], confermata, t }
  const perReg = new Map(), cancPer = new Map(), conti = new Map();   // conto → { base, conf, forse }
  const aggiungiAReg = (reg, rec) => { if (!perReg.has(reg)) perReg.set(reg, []); perReg.get(reg).push(rec); };
  // l'operazione che ha scritto il valore mostrato: la più recente con quel valore
  const chiHaScritto = (reg, v) => { if (v === undefined) return null; const l = perReg.get(reg) || []; for (let i = l.length - 1; i >= 0; i--) if (l[i].valori.get(reg) === v) return l[i].n; return null; };

  function registra(pc, op, D, t, { confermata = false } = {}) {
    const P = proiezione(D), scr = scrittureDi(op), rec = { n: ops.length, pc, op, scr, prima: new Map(), valori: new Map(), visti: new Map(), copre: [], confermata, t };
    for (const s of scr) {
      if (s.reg) { rec.prima.set(s.reg, chiHaScritto(s.reg, valoreMostrato(P, s.reg))); rec.valori.set(s.reg, s.valore); rec.visti.set(s.reg, valoreMostrato(P, s.reg)); }
      else if (s.cancella) {
        for (const [reg, v] of P) if (reg === s.cancella || reg.startsWith(s.cancella + '/')) rec.copre.push({ reg, n: chiHaScritto(reg, v) });
        if (!cancPer.has(s.cancella)) cancPer.set(s.cancella, []); cancPer.get(s.cancella).push(rec);
      } else if (s.conto) { if (!conti.has(s.conto)) conti.set(s.conto, { base: 0, voci: [] }); conti.get(s.conto).voci.push({ rec, di: s.di }); }
    }
    ops.push(rec);
    for (const s of scr) if (s.reg) aggiungiAReg(s.reg, rec);
    return rec;
  }
  // i dati di partenza: operazioni «iniziale», confermate, viste da tutti
  function iniziale(D) {
    const P = proiezione(D), rec = { n: ops.length, pc: 'iniziale', op: { tipo: 'iniziale' }, scr: [], prima: new Map(), valori: new Map(), copre: [], confermata: true, t: 0 };
    for (const [reg, v] of P) {
      if (reg.startsWith('errori/') || reg.startsWith('giuste/')) { conti.set(reg, { base: +v, voci: [] }); continue; }
      rec.valori.set(reg, v); rec.prima.set(reg, null);
    }
    ops.push(rec);
    for (const reg of rec.valori.keys()) aggiungiAReg(reg, rec);
  }

  // la catena di un'operazione su un registro (le operazioni che ha superato)
  const catena = (n, reg) => { const s = new Set(); let x = ops[n]?.prima.get(reg); while (x != null && !s.has(x)) { s.add(x); x = ops[x].prima.get(reg); } return s; };
  // ritocco (f): con 'tempo-reale', una scelta contraria al tempo vero è ammessa se il motore la mostra fra i conflitti (I8)
  let conflittiMotore = null;
  // i valori permessi per un registro: quelli delle operazioni non superate da un'operazione confermata
  function permessi(reg) {
    const l = perReg.get(reg) || [];
    const superate = new Set();
    for (const y of l) if (y.confermata) for (const x of catena(y.n, reg)) superate.add(x);
    let ok = l.filter(x => !superate.has(x.n));
    if (regola === 'tempo-reale' && !conflittiMotore?.has(reg)) {
      const conf = ok.filter(x => x.confermata);
      if (conf.length > 1) { const ultimo = conf.reduce((a, b) => (b.t > a.t || (b.t === a.t && b.pc > a.pc) ? b : a)); ok = ok.filter(x => !x.confermata || x === ultimo); }
    }
    // un'operazione non confermata può non esserci: allora vale quello che lei superava (risalendo le non confermate fino a
    // una confermata, o fino al «niente», cioè il valore di partenza)
    const valori = new Set(ok.map(x => x.valori.get(reg)));
    let vuotoPermesso = false;
    for (const x of ok) {
      if (x.confermata) continue;
      let p = x.prima.get(reg);
      for (;;) {
        if (p == null) { vuotoPermesso = true; break; }
        const y = ops[p];
        if (!superate.has(y.n)) valori.add(y.valori.get(reg));
        if (y.confermata) break;
        p = y.prima.get(reg);
      }
    }
    return { valori, ops: ok, superate, vuotoPermesso };
  }

  function verifica(P, nomePc = '', { conflitti = null } = {}) {
    conflittiMotore = conflitti;
    const out = [], dove = nomePc ? `${nomePc}: ` : '';
    const descr = x => `#${x.n} ${x.pc}${x.confermata ? '' : ' (non confermata)'}`;
    const records = new Set([...perReg.keys()].map(recordDi).filter(Boolean));
    for (const r of records) {
      const tocchi = [...perReg].filter(([reg]) => reg === r || reg.startsWith(r + '/')).flatMap(([reg, l]) => l.map(x => ({ reg, x })));
      const canc = cancPer.get(r) || [], confCanc = canc.filter(z => z.confermata);
      const coperte = new Set();
      for (const z of confCanc) for (const { reg, n } of z.copre) if (n != null) { coperte.add(`${reg}|${n}`); for (const a of catena(n, reg)) coperte.add(`${reg}|${a}`); }
      const confTocchi = tocchi.filter(({ x }) => x.confermata);
      const scoperti = tocchi.filter(({ reg, x }) => !coperte.has(`${reg}|${x.n}`));
      const presentePermesso = !(confCanc.length && scoperti.length === 0);
      const assentePermesso = canc.length > 0 || confTocchi.length === 0;
      const presente = P.has(r);
      if (!presente && !assentePermesso) { out.push({ proprieta: 'operazione persa', testo: `${dove}${r} non c'è più, ma nessuno l'ha cancellato (creato da ${descr(confTocchi[0].x)})` }); continue; }
      if (presente && !presentePermesso) { out.push({ proprieta: 'record risorto', testo: `${dove}${r} c'è ancora, ma è stato cancellato (${confCanc.map(descr).join(', ')}) dopo aver visto ogni sua modifica` }); continue; }
      if (!presente) continue;
      for (const reg of [...perReg.keys()].filter(k => k.startsWith(r + '/'))) out.push(...controllaRegistro(reg, P, dove));
    }
    for (const reg of perReg.keys()) if (!recordDi(reg)) out.push(...controllaRegistro(reg, P, dove));
    for (const [c, { base, voci }] of conti) {
      const v = +(P.get(c) ?? 0), min = base + voci.filter(x => x.rec.confermata).reduce((s, x) => s + x.di, 0), max = min + voci.filter(x => !x.rec.confermata).reduce((s, x) => s + x.di, 0);
      if (v < min || v > max) out.push({ proprieta: 'contatore', testo: `${dove}${c} = ${v}, doveva essere ${min === max ? min : `fra ${min} e ${max}`} (${base} di partenza + gli incrementi)` });
    }
    // niente dal nulla
    for (const k of P.keys()) {
      const r = recordDi(k);
      if (r && !records.has(r)) { out.push({ proprieta: 'comparso dal nulla', testo: `${dove}${k} = ${P.get(k)}: nessuna operazione l'ha creato` }); continue; }
      if (!r && (k.startsWith('lezione/') || k.startsWith('errori/') || k.startsWith('giuste/')) && !perReg.has(k) && !conti.has(k)) out.push({ proprieta: 'comparso dal nulla', testo: `${dove}${k}: nessuna operazione l'ha creato` });
    }
    return out;
  }
  // ritocco (a): il ripasso di una carta, con ripassi contemporanei. Il motore può aver applicato l'SM-2 (js/sm2.js) di uno sopra
  // l'altro (§6.6): si accetta ogni valore che viene da un ordine qualsiasi di tutti i ripassi confermati e di una parte dei non
  // confermati, partendo dalla creazione della carta e applicando a ogni passo l'SM-2 con il q e il giorno di quel ripasso (se
  // lo studente vedeva proprio lo stato di adesso è il risultato che aveva visto). L'ordine non segue i «prima»: qui i valori
  // non sono unici (due ripassi «Di nuovo» lo stesso giorno danno lo stesso stato), e un «prima» sbagliato darebbe falsi allarmi
  function catenaSm2(reg, v) {
    const l = perReg.get(reg) || [], rip = l.filter(x => x.op.tipo === 'ripassaCarta' && x.op.q != null), basi = l.filter(x => x.op.tipo !== 'ripassaCarta');
    if (!rip.length) return false;
    if (rip.length > 6) return true;   // troppi ordini da provare: non si giudica
    const norm = s => stabile(Object.fromEntries(RIPASSO.map(k => [k, s?.[k] ?? null])));
    const prova = (stato, usati) => {
      if (rip.every(x => !x.confermata || usati.has(x.n)) && norm(stato) === v) return true;
      for (const x of rip) if (!usati.has(x.n) && prova(applica(stato, x.op.q, x.op.giorno), new Set([...usati, x.n]))) return true;
      return false;
    };
    return basi.some(b => b.valori.has(reg) && prova(JSON.parse(b.valori.get(reg)), new Set()));
  }
  function controllaRegistro(reg, P, dove) {
    const { valori, ops: ok, vuotoPermesso } = permessi(reg);
    if (!ok.length) return [];
    const v = valoreMostrato(P, reg);
    if (valori.has(v)) return [];
    if (reg.endsWith('/ripasso') && v !== undefined && catenaSm2(reg, v)) return [];
    if (vuotoPermesso && v === valoreMostrato(new Map(), reg)) return [];
    const atteso = ok.map(x => `${x.valori.get(reg)} (${x.pc} #${x.n}${x.confermata ? '' : ', non confermata'})`).join(' oppure ');
    const chi = (perReg.get(reg) || []).find(x => x.valori.get(reg) === v);
    return [{ proprieta: v === undefined ? 'operazione persa' : 'operazione superata', testo: `${dove}${reg} = ${v ?? '(niente)'}${chi ? ` (di ${chi.pc} #${chi.n}, già superata)` : ''}; doveva essere ${atteso}` }];
  }
  // annulla: un'operazione che il motore ha detto di non aver scritto (lanciato o rifiutato) e che la barra rimanderà uguale
  // (passo «ritenta» del mondo): non deve comparire da sola. Per i contatori: non conta più come «forse», così un motore che
  // l'avesse tenuta in memoria (e poi scritta insieme alla ripetuta) conta due volte e si vede
  const annulla = rec => { for (const c of conti.values()) c.voci = c.voci.filter(x => x.rec !== rec); };
  return { ops, registra, iniziale, verifica, permessi, annulla, conferma: rec => { rec.confermata = true; } };
}
