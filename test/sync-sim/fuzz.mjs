// Il fuzzer della sincronizzazione. Genera storie a caso (con seme), le fa recitare al mondo (mondo.mjs) con un motore, e
// quando una proprietà salta riduce la storia alla più corta che la fa ancora saltare, e la racconta.
//
//   node test/sync-sim/fuzz.mjs --motore test/sync-sim/banale.mjs --giri 200 --seme 1 [--senza-guasti] [--cifratura]
//        [--passi 60] [--computer 3] [--servizio icloud|dropbox|onedrive|gdrive|syncthing] [--regola libera|tempo-reale]
//        [--obsidian tutti|uno|mai] [--orologi grandi|piccoli] [--corruzione] [--disco] [--cambi] [--extra] [--ferma-al-primo] [--non-ridurre]
//        [--dettagli] [--json]
//   --cambi   cambi di password ripetuti (rigenerazioni anche contemporanee), «Dimentica la password qui» e la password scritta
//   --extra   come --cambi, più computer che muoiono per sempre, «Smetti» e «Toglila» (collaudo del 3 ottobre). Le due opzioni
//             aggiungono scelte solo quando ci sono: le storie dei semi di prima (gli scenari F) non cambiano
//
// Le proprietà (i nomi nei risultati):
//   convergenza            dopo la quiete tutti i computer vedono lo stesso stato
//   operazione persa / operazione superata / record risorto / contatore / comparso dal nulla
//                          il modello (modello.mjs): niente di confermato si perde o viene superato da una cosa vista prima
//   migrazione             dopo l'accensione il primo computer vede tutto il dati.json di prima
//   fuori dalle cartelle   il motore ha scritto fuori da dati/, vault/.lode/ e dalle pagine di Lode
//   cifratura, cifratura (cronologia)   con la cifratura accesa, file di .lode con dati in chiaro nel cloud (adesso, o
//                          caricati dopo l'accensione: restano nella cronologia del servizio)
//   propri file illeggibili  il motore ha scritto sopra un suo file che non riusciva a leggere senza tenerne copia (con
//                          --corruzione: file scritti dal motore, in dati/ o in .lode/, si rovinano; in quelle storie il
//                          modello e la convergenza non si controllano, perché un dato rovinato può essere perso davvero)
//   bloccato, quiete, non risponde, eccezione   il motore non riparte, non si ferma, non torna, lancia
import { caso } from './comune.mjs';
import { esegui } from './mondo.mjs';
import { generaOp, descrivi } from './operazioni.mjs';
import { SERVIZI } from './cloud.mjs';

export function generaStoria(seme, { passi = 80, computer = 3, guasti = true, cifratura = false, servizio = null, obsidian = null, orologi = 'grandi', corruzione = false, extra = false, disco = false } = {}) {
  const r = caso(seme), nomi = ['A', 'B', 'C', 'D'].slice(0, computer);
  let k = 100;
  const n = () => ++k;
  const st = { seme, servizio: servizio || r.scegli(SERVIZI), computer: nomi, passi: [] };
  const P = st.passi, pc = () => r.scegli(nomi);
  const chiObsidian = obsidian || 'tutti';
  P.push({ t: 'attiva', pc: 'A', modo: 'nuovo' });
  const unione = new Map(nomi.slice(1).map(x => [x, r.intero(2, Math.max(3, Math.floor(passi / 3)))]));
  const quandoCifra = cifratura ? r.intero(Math.floor(passi / 4), Math.floor(passi * 0.7)) : -1;
  for (let i = 0; i < passi; i++) {
    for (const [x, q] of unione) if (q === i) P.push({ t: 'attiva', pc: x, modo: 'unisciti' }, { t: 'attiva', pc: x, modo: 'unisciti' });
    if (i === quandoCifra) { P.push({ t: 'cifra', pc: pc(), password: 'parola segreta' }); for (const x of nomi) P.push({ t: 'sblocca', pc: x }); }
    const scelte = [
      [36, () => {
        let op = generaOp(r, n);
        const chi = op.da === 'obsidian' && chiObsidian !== 'tutti' ? 'A' : pc();
        if (op.da === 'obsidian' && chiObsidian === 'mai') op = { ...op, da: 'lode' };
        return { t: 'op', pc: chi, op, ...(guasti && r.vero(0.3) ? { intreccio: r.scegli([0.2, 0.5]), meta: 0.4 } : {}), ...(disco && r.vero(0.5) ? { ritenta: true } : {}) };
      }],
      [4, () => ({ t: 'attiva', pc: r.scegli(nomi.slice(1)), modo: 'unisciti' })],
      [14, () => ({ t: 'carica', pc: pc(), quale: r(), vince: r.vero(0.5) ? 'server' : 'nuovo' })],
      [16, () => ({ t: 'consegna', pc: pc(), quale: r(), modo: !guasti ? 'intero' : r.scegli(['intero', 'intero', 'intero', 'meta', 'segnaposto']), frazione: r() })],
      [9, () => ({ t: 'arrivati', pc: pc() })],
      [5, () => ({ t: 'tempo', ms: r.vero(0.1) ? r.intero(1, 5) * 864e5 : r.intero(1, 600) * 1000 })],
      [3, () => ({ t: 'spegni', pc: pc() })],
      [5, () => ({ t: 'accendi', pc: pc() })],
      [2, () => ({ t: 'rete', pc: pc(), online: r.vero(0.5) })],
      [1, () => ({ t: 'quiete' })],
      ...(guasti ? [
        [4, () => ({ t: 'crash', pc: pc(), dopo: r.intero(1, 6), meta: r.vero(0.5), frazione: r() })],
        [2, () => ({ t: 'uccidi', pc: pc() })],
        [3, () => ({ t: 'togli', pc: pc(), quale: r() })],
        [3, () => ({ t: 'scarica', pc: pc(), quale: r() })],
        // --disco: letture e scritture nella cartella dei dati che falliscono (EIO, EACCES, EBUSY, ENOSPC) finché il disco non torna a posto
        ...(disco ? [[3, () => ({ t: 'guasto', pc: pc(), dove: r.scegli(['@diario', '@segmento', 'dati/sync', 'vault/.lode/dati.json']), codice: r.scegli(['EIO', 'EACCES', 'EBUSY', 'ENOSPC']), quale: r.vero(0.5) ? 'leggi' : 'scrivi' })], [3, () => ({ t: 'ripara', pc: pc() })]] : []),
        ...(corruzione ? [[2, () => ({ t: 'corrompi', pc: pc(), quale: r(), dove: r.vero(0.5) ? 'dati' : 'vault/.lode', modo: r.vero(0.5) ? 'tronca' : 'bit' })]] : []),
        [2, () => ({ t: 'orologio', pc: pc(), scarto: orologi === 'grandi' && r.vero(0.15) ? -r.intero(370, 800) * 864e5 : r.intero(-48, 48) * 36e5 })],
      ] : []),
      ...(extra ? [
        [3, () => ({ t: 'cifra', pc: pc(), password: 'password ' + n() })],
        [3, () => ({ t: 'sblocca', pc: pc() })],
        [1, () => ({ t: 'dimentica', pc: pc() })],
        // muori dopo una quiete (un solo passo, così la riduzione non li separa): quello che non è mai uscito dal computer si
        // perderebbe davvero, senza colpa del motore. Il caso «pubblicato ma non ancora letto» è negli scenari X06, X07
        ...(extra === 'tutto' ? [[1, () => ({ t: 'smetti', pc: pc() })], [1, () => ({ t: 'muori', pc: r.scegli(nomi.slice(1)), quiete: true })], [1, () => ({ t: 'toglila', pc: pc() })]] : []),
      ] : []),
    ];
    const tot = scelte.reduce((s, [p]) => s + p, 0);
    let x = r() * tot;
    for (const [p, f] of scelte) if ((x -= p) < 0) { P.push(f()); break; }
  }
  return st;
}

// la riduzione: toglie pezzi di storia finché la stessa proprietà salta ancora (ddmin), poi un passo alla volta
export const classe = v => v.proprieta + (v.testo.match(/^[A-Z]: (esame|carta|lezione|profilo|imp|errori|giuste)\//)?.[1] ? ` · ${v.testo.match(/^[A-Z]: (\w+)\//)[1]}` : '');
export async function riduci(storia, proprieta, opz, { massimo = 400, classe: k = null } = {}) {
  let cur = storia.passi, prove = 0;
  const fallisce = async passi => { prove++; const r = await esegui({ ...storia, passi }, opz); return r.violazioni.some(v => k ? classe(v) === k : v.proprieta === proprieta); };
  let pezzi = 2;
  while (cur.length >= 2 && prove < massimo) {
    const lung = Math.ceil(cur.length / pezzi);
    let ridotta = false;
    for (let i = 0; i < pezzi && prove < massimo; i++) {
      const cand = [...cur.slice(0, i * lung), ...cur.slice((i + 1) * lung)];
      if (cand.length < cur.length && await fallisce(cand)) { cur = cand; pezzi = Math.max(pezzi - 1, 2); ridotta = true; break; }
    }
    if (!ridotta) { if (pezzi >= cur.length) break; pezzi = Math.min(cur.length, pezzi * 2); }
  }
  return { ...storia, passi: cur, prove };
}

export function raccontaPasso(s) {
  switch (s.t) {
    case 'op': return `${s.pc}: ${descrivi(s.op)}${s.intreccio ? ` (con arrivi dal cloud nel mezzo, p=${s.intreccio})` : ''}`;
    case 'attiva': return `${s.pc}: ${s.modo === 'nuovo' ? 'accende la sincronizzazione' : 'si unisce («Uso già Lode su un altro computer»)'}`;
    case 'carica': return `cloud: carica un file di ${s.pc} (#${s.quale.toFixed(2)}, in conflitto vince ${s.vince === 'server' ? 'quello già sul server' : 'il nuovo'})`;
    case 'consegna': return `cloud: consegna a ${s.pc} un file (#${s.quale.toFixed(2)}) ${s.modo === 'meta' ? `a metà (${Math.round((s.frazione ?? 0.5) * 100)}%)` : s.modo === 'segnaposto' ? 'come segnaposto .icloud' : 'intero'}`;
    case 'arrivati': return `${s.pc}: il watcher avvisa il motore`;
    case 'tempo': return `passa del tempo (${Math.round(s.ms / 1000)} s)`;
    case 'spegni': return `${s.pc}: chiude Lode`;
    case 'accendi': return `${s.pc}: apre Lode`;
    case 'rete': return `${s.pc}: ${s.online ? 'torna in rete' : 'va senza rete'}`;
    case 'crash': return `${s.pc}: il processo morirà alla ${s.dopo}ª scrittura${s.meta ? ' (file a metà)' : ''}`;
    case 'uccidi': return `${s.pc}: Lode ucciso`;
    case 'togli': return `cloud: toglie dal disco di ${s.pc} un file (#${s.quale.toFixed(2)}) lasciando il segnaposto`;
    case 'scarica': return `cloud: riscarica su ${s.pc} un segnaposto`;
    case 'orologio': return `${s.pc}: orologio spostato di ${Math.round(s.scarto / 36e5)} ore`;
    case 'cifra': return `${s.pc}: accende la cifratura`;
    case 'sblocca': return `${s.pc}: scrive la password (se serve)`;
    case 'quiete': return 'tutto si ferma e arriva dappertutto';
    case 'dimentica': return s.pc ? `${s.pc}: «Dimentica la password qui»` : 'lo studente dimentica le password';
    case 'smetti': return `${s.pc}: «Smetti su questo computer»`;
    case 'muori': return `${s.pc} muore per sempre`;
    case 'toglila': return `${s.pc}: «Toglila»`;
    default: return JSON.stringify(s);
  }
}

async function principale() {
  const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; }, c = k => a.includes('--' + k);
  const motore = arg('motore'); if (!motore) { console.error('serve --motore <percorso>'); process.exit(2); }
  const giri = +arg('giri', 50), seme0 = +arg('seme', 1), opz = { motore, regola: arg('regola', 'libera'), dettagli: c('dettagli'), rilassa: c('corruzione') };
  const gen = { passi: +arg('passi', 80), computer: +arg('computer', 3), guasti: !c('senza-guasti'), cifratura: c('cifratura'), servizio: arg('servizio', null), obsidian: arg('obsidian', null), orologi: arg('orologi', 'grandi'), corruzione: c('corruzione'), disco: c('disco'), extra: c('extra') ? 'tutto' : c('cambi') ? 'cambi' : false };
  const conteggio = new Map(), esempi = new Map(), t0 = Date.now();
  let falliti = 0;
  for (let g = 0; g < giri; g++) {
    const seme = seme0 + g, storia = generaStoria(seme, gen);
    const r = await esegui(storia, opz);
    if (!r.violazioni.length) continue;
    falliti++;
    for (const p of new Set(r.violazioni.map(v => v.proprieta))) conteggio.set(p, (conteggio.get(p) || 0) + 1);
    // un esempio per «classe»: la proprietà e il tipo di dato (lezione, esame, carta, profilo…), così una causa frequente
    // non nasconde le altre
    for (const v of r.violazioni) { const k = classe(v); if (!esempi.has(k)) esempi.set(k, { seme, storia, v }); }
    if (c('ferma-al-primo')) break;
  }
  const rapporto = { motore, giri, seme: seme0, opzioni: gen, regola: opz.regola, falliti, proprieta: Object.fromEntries(conteggio), esempi: [] };
  if (!c('json')) {
    console.log(`motore ${motore}: ${giri} storie (semi ${seme0}…${seme0 + giri - 1}, ${gen.guasti ? 'con' : 'senza'} guasti${gen.cifratura ? ', con cifratura' : ''}), ${falliti} con almeno una proprietà violata, in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    for (const [p, n] of [...conteggio].sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(4)}  ${p}`);
  }
  for (const [k, { seme, storia, v }] of esempi) {
    const p = v.proprieta, corta = c('non-ridurre') ? storia : await riduci(storia, p, opz, { classe: k });
    const r = await esegui(corta, { ...opz, dettagli: c('dettagli') });
    const vv = r.violazioni.find(x => classe(x) === k) || r.violazioni.find(x => x.proprieta === p) || v;
    rapporto.esempi.push({ proprieta: p, seme, passi: corta.passi.length, violazione: vv.testo, storia: corta.passi });
    if (c('json')) continue;
    console.log(`\n── «${k}» — seme ${seme}, storia ridotta a ${corta.passi.length} passi (da ${storia.passi.length}), servizio ${storia.servizio}`);
    console.log(`   ${vv.testo}`);
    for (const riga of r.racconto) console.log('   ' + riga);
  }
  if (c('json')) console.log(JSON.stringify(rapporto, null, 1));
  process.exitCode = falliti ? 1 : 0;
}
if (import.meta.url === `file://${process.argv[1]}`) principale().catch(x => { console.error(x); process.exit(2); });
