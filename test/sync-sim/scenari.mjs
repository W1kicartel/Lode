// Gli scenari del catalogo dei problemi della prima versione (55 problemi trovati da tre giri di revisione indipendente),
// scritti come storie per il mondo (mondo.mjs): ognuno dice a quali problemi del catalogo si riferisce (#n). Valgono per
// qualunque motore: descrivono cosa fa lo studente e cosa fa il cloud, non come il motore è fatto dentro.
// Alla fine, i problemi del catalogo che il simulatore non sa esprimere, con il motivo.
//
//   node test/sync-sim/scenari.mjs --motore <percorso> [--solo S07,S12] [--racconta] [--json]
//
// Uno scenario passa se, dopo la storia e la quiete, nessuna proprietà è violata (fuzz.mjs le elenca), salvo quelle in
// «ammessi» (per esempio 'bloccato' quando non c'è modo di sbloccare: conta solo che non si perda niente).
import { esegui } from './mondo.mjs';
import { generaStoria } from './fuzz.mjs';
import { orarioMd } from './operazioni.mjs';
import { contieneMarcatore } from './comune.mjs';
import { createHash, scryptSync } from 'node:crypto';
import { scriviContenitore } from '../../desktop/sync/contenitore.mjs';
import { conImpronta } from '../../desktop/sync/piega.mjs';
import { PARAMETRI_PROVA } from './motore-v2.mjs';

const avvio = [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'quiete' }];   // A accende la sincronizzazione, B e C si uniscono
const op = (pc, o, x = {}) => ({ t: 'op', pc, op: o, ...x });
const esame = (id, n) => ({ tipo: 'aggiungiEsame', id, nome: `Esame ZQ ${n}`, cfu: 6 });
const campo = (id, c, valore) => ({ tipo: 'campoEsame', id, campo: c, valore });
const lezione = (n, da = 'lode') => ({ tipo: 'aggiungiLezione', da, lezione: { corso: `Corso ZQ ${n}`, giorni: [n % 5], inizio: '14:00', fine: '16:00', aula: `A${n}` } });
const rete = (pc, online) => ({ t: 'rete', pc, online });
const cifra = (pc, password = 'parola segreta') => ({ t: 'cifra', pc, password });
const riavvia = pc => [{ t: 'uccidi', pc }, { t: 'accendi', pc }];
const PW = 'parola segreta';

export const SCENARI = [
  { id: 'S01', catalogo: [1, 13], titolo: 'due computer accendono la cifratura con la stessa password, uno senza rete: il lavoro fatto dopo non si perde',
    passi: [...avvio, rete('B', false), cifra('A'), cifra('B'), op('B', esame('eb1', 101)), rete('B', true)] },
  { id: 'S02', catalogo: [1], titolo: 'il descrittore della cifratura (v1: cifratura.json, v2: gruppo.json) tolto a mano dal vault cifrato e Lode riaperto senza chiave: i propri file cifrati non si riscrivono vuoti',
    passi: [...avvio, cifra('A'), { t: 'quiete' }, { t: 'ricorda', pc: 'A', dove: '@propri' }, { t: 'ricorda', pc: 'A', dove: 'dati' }, { t: 'cancella', pc: 'A', p: '@cifratura' }, ...riavvia('A'), { t: 'arrivati', pc: 'A' }],
    ammessi: ['bloccato'] },
  { id: 'S03', catalogo: [19], titolo: 'password diverse sui due computer (uno era senza rete): il lavoro di B arriva ad A e tutti si sbloccano',
    passi: [...avvio, rete('B', false), cifra('A', 'password uno'), cifra('B', 'password due'), op('B', esame('eb3', 103)), rete('B', true)] },
  { id: 'S04', catalogo: [3], titolo: 'un computer spento quando arriva la cifratura: il suo file in chiaro non resta nella cartella cloud',
    passi: [...avvio, { t: 'spegni', pc: 'C' }, cifra('A')] },
  { id: 'S05', catalogo: [2], titolo: 'una versione in chiaro di prima rimessa nel vault cifrato (cestino del servizio, o chi scrive nella cartella)',
    passi: [...avvio, { t: 'ricordaVersione', pc: 'A', dove: '@propri', nome: 'prima' }, op('A', campo('e1', 'nome', 'Esame ZQ 105')), cifra('A'), { t: 'quiete' }, { t: 'rimettiVersione', pc: 'A', nome: 'prima' }, { t: 'arrivati', pc: 'A' }] },
  { id: 'S06', catalogo: [8, 39], titolo: 'un computer con Lode di prima (o aperto prima) scrive ancora dati.json dopo la migrazione',
    passi: [{ t: 'carica', pc: 'A', file: '.lode/dati.json' }, { t: 'consegna', pc: 'B', file: '.lode/dati.json' }, rete('B', false),
      { t: 'attiva', pc: 'A', modo: 'nuovo' }, op('A', campo('e1', 'data', '2027-ZQ 106')), op('A', { tipo: 'cancellaEsame', id: 'e2' }), op('A', { tipo: 'profilo', campo: 'nome', valore: 'Ada ZQ 107' }),
      { t: 'vecchia', pc: 'B', op: esame('eb6', 108) }, rete('B', true)],
    // giro 3: non basta l'avviso, l'esame scritto dalla Lode vecchia si deve poter importare (§8.3). Per i motori con elenchi()
    verifica: r => { const v = [...r.pcs.values()].map(pc => { try { return pc.istanza?.motore?.elenchi?.().vecchia; } catch { return null; } }).filter(Boolean);
      return !v.length || v.some(x => x.aggiunte?.some(a => a.k === 'esami/eb6')) ? [] : ['§8.3: l\'esame eb6 scritto dalla Lode vecchia non si può importare da nessun computer']; } },
  { id: 'S06b', catalogo: [8, 39], titolo: 'come S06, e lo studente sceglie «Importa le aggiunte»: l\'esame scritto dalla Lode vecchia arriva su tutti i computer',
    passi: [{ t: 'carica', pc: 'A', file: '.lode/dati.json' }, { t: 'consegna', pc: 'B', file: '.lode/dati.json' }, rete('B', false),
      { t: 'attiva', pc: 'A', modo: 'nuovo' }, op('A', campo('e1', 'data', '2027-ZQ 109')), { t: 'vecchia', pc: 'B', op: esame('eb6b', 110), conferma: true }, rete('B', true),
      { t: 'quiete' }, { t: 'importa', pc: 'A' }] },
  { id: 'S07', catalogo: [9], titolo: 'il file dell\'altro computer arriva a metà: un salvataggio non riporta profilo e impostazioni ai valori di partenza',
    passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'B', di: 'A', come: { '@propri': 'meta' } }, { t: 'attiva', pc: 'B', modo: 'unisciti' }, op('B', esame('eb7', 109))] },
  { id: 'S07b', catalogo: [9], titolo: 'come S07, col file dell\'altro computer ancora segnaposto iCloud',
    passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'B', di: 'A', come: { '@propri': 'segnaposto' } }, { t: 'attiva', pc: 'B', modo: 'unisciti' }, op('B', { tipo: 'impostazione', campo: 'pausa', valore: 110 })] },
  { id: 'S08', catalogo: [11], titolo: 'campi diversi dello stesso esame cambiati su due computer: restano tutti e due',
    passi: [...avvio, rete('B', false), op('A', campo('e1', 'data', '2027-ZQ 111')), op('B', campo('e1', 'oreObiettivo', 1112)), rete('B', true)] },
  { id: 'S09', catalogo: [12], titolo: 'copie in conflitto di dati.json prima della sincronizzazione: un esame cancellato non torna',
    passi: [{ t: 'carica', pc: 'A', file: '.lode/dati.json' }, { t: 'consegna', pc: 'B', file: '.lode/dati.json' },
      { t: 'vecchia', pc: 'A', op: { tipo: 'cancellaEsame', id: 'e2' }, conferma: true }, { t: 'vecchia', pc: 'B', op: campo('e1', 'nome', 'Esame ZQ 113') },
      { t: 'caricaTutto', pc: 'A' }, { t: 'caricaTutto', pc: 'B' }, { t: 'consegnaTutto', pc: 'A' }, { t: 'attiva', pc: 'A', modo: 'nuovo' }] },
  { id: 'S10', catalogo: [14], titolo: 'il descrittore (v1: sincronizzazione.json, v2: gruppo.json) diventa un segnaposto iCloud e Lode si riapre: non riparte vuoto e non perde niente',
    passi: [...avvio, { t: 'togli', pc: 'B', file: '@descrittore' }, ...riavvia('B'), op('B', esame('eb10', 114))] },
  { id: 'S10b', catalogo: [14, 31], titolo: 'il descrittore (v1: sincronizzazione.json, v2: gruppo.json) cancellato dalla cartella cloud (da un computer, arriva a tutti)',
    passi: [...avvio, { t: 'cancella', pc: 'A', p: '@descrittore' }, { t: 'quiete' }, ...riavvia('B'), op('B', esame('eb10b', 115))] },
  { id: 'S11', catalogo: [16, 26], titolo: 'orologio avanti di due anni, poi corretto: le modifiche fatte dopo la correzione non spariscono',
    passi: [...avvio, { t: 'orologio', pc: 'A', scarto: 730 * 864e5 }, op('A', campo('e1', 'data', '2027-ZQ 116')), { t: 'quiete' }, { t: 'orologio', pc: 'A', scarto: 0 }, op('A', campo('e1', 'nome', 'Esame ZQ 117')), ...riavvia('A')] },
  { id: 'S12', catalogo: [26], titolo: 'orologio indietro di più di un anno (batteria scarica): il computer vede tutto e non cancella niente',
    passi: [...avvio, { t: 'orologio', pc: 'B', scarto: -400 * 864e5 }, ...riavvia('B'), op('B', campo('e2', 'nome', 'Esame ZQ 118'))] },
  { id: 'S13', catalogo: [17], titolo: 'la cartella dei dati di Lode copiata su un altro computer (stesso id): i contatori si sommano',
    passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'copiaDati', da: 'A', pc: 'B' }, { t: 'quiete' }, rete('B', false),
      op('A', { tipo: 'incrementa', dove: 'errori', chiave: 'k2', di: 3 }), op('B', { tipo: 'incrementa', dove: 'errori', chiave: 'k2', di: 2 }), rete('B', true)] },
  { id: 'S14', catalogo: [18, 40], titolo: 'un computer bloccato (senza password) non scrive un Orario.md vuoto',
    passi: [...avvio, cifra('A'), { t: 'quiete' }, ...riavvia('B'), op('B', lezione(119), { forza: true }), { t: 'arrivati', pc: 'B' }, { t: 'caricaTutto', pc: 'B' }, { t: 'consegnaTutto', pc: 'A' }, { t: 'arrivati', pc: 'A' }] },
  { id: 'S15', catalogo: [25], titolo: 'Lode di prima riaperta dopo la migrazione: parte vuota, scrive dati.json, e non deve cancellare niente',
    computer: ['A', 'B', 'C', 'D'],
    passi: [...avvio, { t: 'vecchia', pc: 'D', op: esame('ed15', 120) }] },
  { id: 'S15b', catalogo: [25], titolo: 'Lode di prima rimasta spenta giorni con un dati.json vecchio',
    computer: ['A', 'B', 'C', 'D'],
    passi: [{ t: 'carica', pc: 'A', file: '.lode/dati.json' }, { t: 'consegna', pc: 'D', file: '.lode/dati.json' }, rete('D', false), { t: 'attiva', pc: 'A', modo: 'nuovo' },
      op('A', esame('ea15', 121)), op('A', { tipo: 'cancellaEsame', id: 'e2' }), { t: 'tempo', ms: 5 * 864e5 }, { t: 'vecchia', pc: 'D', op: campo('e1', 'oreObiettivo', 1122) }, rete('D', true)] },
  { id: 'S16', catalogo: [27], titolo: 'carta cancellata su un computer e corretta sull\'altro: o non c\'è, o torna col suo ripasso',
    passi: [...avvio, rete('B', false), op('A', { tipo: 'cancellaCarta', id: 'c1' }), op('B', { tipo: 'testoCarta', id: 'c1', campo: 'retro', valore: 'Retro ZQ 123' }), rete('B', true)] },
  { id: 'S17', catalogo: [30], titolo: 'fronte e retro della stessa carta cambiati su due computer: restano tutti e due',
    passi: [...avvio, rete('B', false), op('A', { tipo: 'testoCarta', id: 'c1', campo: 'fronte', valore: 'Fronte ZQ 124' }), op('B', { tipo: 'testoCarta', id: 'c1', campo: 'retro', valore: 'Retro ZQ 125' }), rete('B', true)] },
  { id: 'S18', catalogo: [31, 47], titolo: 'chi scrive nella cartella toglie segno, cifratura e file dei computer: nessuno riscrive i dati in chiaro',
    passi: [...avvio, cifra('A'), { t: 'quiete' }, { t: 'cancella', pc: 'A', p: '@descrittore' }, { t: 'cancella', pc: 'A', p: '@gruppo' },
      { t: 'arrivati', pc: 'A' }, op('A', esame('ea18', 126), { forza: true })],
    ammessi: ['bloccato'] },
  { id: 'S19', catalogo: [32], titolo: 'il descrittore della cifratura ancora segnaposto su un computer appena collegato: niente in chiaro nella cartella',
    passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, cifra('A'), { t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'C', di: 'A', come: { '@cifratura': 'segnaposto' } }, { t: 'attiva', pc: 'C', modo: 'unisciti' }, op('C', esame('ec19', 127), { forza: true }), { t: 'caricaTutto', pc: 'C' }] },
  { id: 'S20', catalogo: [33], titolo: 'smetti, riaccendi e poi cifra: gli archivi dello stop non restano in chiaro',
    passi: [...avvio, { t: 'smetti', pc: 'A' }, { t: 'quiete' }, { t: 'attiva', pc: 'A', modo: 'nuovo', forza: true }, { t: 'quiete' }, cifra('A')] },
  { id: 'S21', catalogo: [34, 44], titolo: 'stop in un vault cifrato mentre un computer, senza chiave ricordata, aveva modifiche solo sue',
    passi: [...avvio, cifra('A'), { t: 'quiete' }, rete('B', false), op('B', esame('eb21', 128)), { t: 'spegni', pc: 'B' }, { t: 'smetti', pc: 'A' }] },
  { id: 'S22', catalogo: [35], titolo: 'il dati.json di dopo la migrazione (v1: dati.migrato, v2: il dati.json minimo) è un segnaposto quando si accende la cifratura: quando torna non resta in chiaro',
    passi: [...avvio, { t: 'togli', pc: 'A', file: '@datiMigrati' }, cifra('A'), { t: 'scarica', pc: 'A', file: '@datiMigrati' }, { t: 'arrivati', pc: 'A' }] },
  { id: 'S23', catalogo: [40], titolo: 'Orario.md non ancora scaricato (segnaposto) quando Lode parte: l\'orario non sparisce',
    passi: [...avvio, { t: 'togli', pc: 'B', file: 'Orario.md' }, ...riavvia('B'), { t: 'caricaTutto', pc: 'B' }, { t: 'consegnaTutto', pc: 'A' }, { t: 'arrivati', pc: 'A' }] },
  { id: 'S23b', catalogo: [40], titolo: 'un computer si unisce prima che arrivi Orario.md',
    passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'B', tranne: ['Orario.md'] }, { t: 'attiva', pc: 'B', modo: 'unisciti' }, { t: 'arrivati', pc: 'B' }, { t: 'caricaTutto', pc: 'B' }, { t: 'consegnaTutto', pc: 'A' }, { t: 'arrivati', pc: 'A' }] },
  { id: 'S24', catalogo: [41], titolo: 'due computer aggiungono una lezione nello stesso momento: restano tutte e due',
    passi: [...avvio, rete('B', false), op('A', lezione(129)), op('B', lezione(130)), rete('B', true)] },
  { id: 'S24b', catalogo: [41], titolo: 'come S24, ma le lezioni le scrive lo studente in Obsidian, in Orario.md',
    passi: [...avvio, rete('B', false), op('A', lezione(131, 'obsidian')), op('B', lezione(132, 'obsidian')), rete('B', true)] },
  { id: 'S25', catalogo: [42], titolo: 'dati.json riscritto da una Lode vecchia mentre il descrittore è ancora un segnaposto e il dati.json minimo non è arrivato',
    passi: [{ t: 'carica', pc: 'A', file: '.lode/dati.json' }, { t: 'consegna', pc: 'B', file: '.lode/dati.json' }, { t: 'attiva', pc: 'A', modo: 'nuovo' }, op('A', campo('e1', 'data', '2027-ZQ 133')),
      { t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'B', di: 'A', tranne: ['@datiMigrati'], come: { '@descrittore': 'segnaposto' } }, { t: 'vecchia', pc: 'B', op: campo('e1', 'oreObiettivo', 1134) }] },
  { id: 'S26', catalogo: [45], titolo: 'orologio indietro di tre giorni: la modifica fatta dopo (nel tempo vero) vince', regola: 'tempo-reale',
    passi: [...avvio, { t: 'orologio', pc: 'C', scarto: -3 * 864e5 }, rete('C', false), op('A', campo('e1', 'data', '2027-ZQ 135')), { t: 'tempo', ms: 3 * 36e5 }, op('C', campo('e1', 'data', '2027-ZQ 136')), rete('C', true)] },
  { id: 'S27', catalogo: [46, 49], titolo: 'il proprio file nel vault rovinato di un bit: il computer non resta bloccato per sempre e non perde niente',
    passi: [...avvio, cifra('A'), { t: 'quiete' }, { t: 'corrompi', pc: 'A', dove: '@propri' }, ...riavvia('A')] },
  { id: 'S27b', catalogo: [46], titolo: 'come S27, senza cifratura (il file rovinato è in chiaro)',
    passi: [...avvio, { t: 'corrompi', pc: 'A', dove: '@propri', modo: 'tronca' }, ...riavvia('A'), op('A', esame('ea27', 137))] },
  { id: 'S28', catalogo: [48], titolo: 'un computer ancora aperto in chiaro scrive dopo che la cifratura è stata accesa altrove',
    passi: [...avvio, cifra('A'), op('B', esame('eb28', 138))] },
  { id: 'S29', catalogo: [51], titolo: 'migrazione con dati.json ancora segnaposto («Documenti» in iCloud): i dati non escono dall\'app',
    passi: [{ t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'B', come: { '.lode/dati.json': 'segnaposto' } }, { t: 'attiva', pc: 'B', modo: 'nuovo' }, { t: 'caricaTutto', pc: 'B' }, { t: 'consegnaTutto', pc: 'A' }, { t: 'attiva', pc: 'A', modo: 'unisciti' }],
    ammessi: ['migrazione'] },
  { id: 'S30', catalogo: [53], titolo: 'Orario.md scritto da un computer rimasto indietro arriva dopo un riavvio: la lezione aggiunta qui non sparisce',
    passi: [...avvio, rete('B', false), op('A', lezione(139)), op('B', lezione(140)), ...riavvia('A'), rete('B', true), { t: 'caricaTutto', pc: 'B' }, { t: 'consegnaTutto', pc: 'A' }, { t: 'arrivati', pc: 'A' }] },
  { id: 'S31', catalogo: [54], titolo: '«Smetti» su A mentre B riceve la fine del segno prima di dati.json',
    passi: [...avvio, rete('B', false), op('A', esame('ea31', 141)), op('B', esame('eb31', 142)), { t: 'smetti', pc: 'A' }, { t: 'caricaTutto', pc: 'A' }, rete('B', true), { t: 'consegna', pc: 'B', file: '@descrittore' }, { t: 'arrivati', pc: 'B' }] },
  { id: 'S32', catalogo: [55], titolo: 'dopo «Smetti» due computer cambiano i dati insieme: niente si perde (la scheda lo promette)',
    passi: [...avvio, { t: 'smetti', pc: 'A' }, { t: 'quiete' }, rete('B', false), op('A', esame('ea32', 143)), op('B', esame('eb32', 144)), rete('B', true)] },
  { id: 'S33', catalogo: [10, 29, 43], titolo: 'la barra manda una modifica coi dati bloccati: se il motore la accetta, deve arrivare (anche dopo un riavvio)',
    passi: [...avvio, cifra('A'), { t: 'quiete' }, ...riavvia('B'), op('B', esame('eb33', 145), { forza: true }), ...riavvia('B')] },
];

// ---- gli scenari nuovi della v2 (docs/SINCRONIZZAZIONE.md §13.4) e quelli per le invarianti I1-I10 (§1) ----
// verifica(r): controlli in più, oltre alle proprietà di sempre (r è il risultato di esegui: pcs, cloud, viste, modello)
const lezioneDi = n => ({ corso: `Corso ZQ ${n}`, giorni: [n % 5], inizio: '14:00', fine: '16:00', aula: `A${n}` });
const chiaroNelCloud = r => r.cloud.contenuto().filter(f => /^\.lode\/sync\/[^/]+\/[^/]+\/[^/]+$/.test(f.rel) && !/\.json$/.test(f.rel) && contieneMarcatore(f.dati)).map(f => `${f.rel} (di ${f.autore}) è ancora in chiaro dopo «Toglila»`);
const ripassa = (pc, q) => op(pc, { tipo: 'ripassaCarta', quale: 0, q });
const contenitori = (r, filtro = () => true) => r.cloud.contenuto().filter(f => /^\.lode\/sync\/[^/]+\/[^/]+\/[^/]+$/.test(f.rel) && !/\.json$/.test(f.rel) && filtro(f));
const conflittiDi = (r, pc) => { try { return r.pcs.get(pc).istanza?.conflitti?.() || []; } catch { return []; } };
// I2: un solo scrittore per cartella: chi ha caricato per primo .lode/sync/<g>/<dev>/ è l'unico che ci carica
function unSoloScrittore(r) {
  const padrone = new Map(), out = [];
  for (const f of r.cloud.cronologia) {
    const m = f.rel.match(/^\.lode\/sync\/([^/]+)\/([^/]+)\//); if (!m) continue;
    const k = `${m[1]}/${m[2]}`;
    if (!padrone.has(k)) padrone.set(k, f.autore); else if (padrone.get(k) !== f.autore) out.push(`I2: ${f.autore} scrive in ${k}, che è di ${padrone.get(k)}`);
  }
  return [...new Set(out)];
}
// I6: un contenitore ripubblicato dal suo computer non è mai più corto (conta nell'intestazione, versione dopo versione; una
// versione vecchia rimessa da qualcun altro, il cestino del servizio, non conta: è il caso che il motore deve riparare)
function maiPiuCorto(r) {
  const prima = new Map(), padrone = new Map(), out = [];
  for (const f of r.cloud.cronologia) {
    if (!f.dati || !/\.seg$/.test(f.rel)) continue;
    const dir = f.rel.slice(0, f.rel.lastIndexOf('/'));
    if (!padrone.has(dir)) padrone.set(dir, f.autore); else if (padrone.get(dir) !== f.autore) continue;
    let c; try { c = JSON.parse(f.dati.toString('utf8').split('\n')[0]).conta; } catch { continue; }
    if (prima.has(f.rel) && c < prima.get(f.rel)) out.push(`I6: ${f.rel} passa da ${prima.get(f.rel)} a ${c} eventi`);
    prima.set(f.rel, Math.max(c, prima.get(f.rel) || 0));
  }
  return out;
}
// I9: una proiezione scritta da chi sa di più non la riscrive chi sa di meno (i marcatori di Orario.md caricati, in ordine)
function proiezioniMonotone(r) {
  const out = []; let ultimo = null;
  for (const f of r.cloud.cronologia) {
    if (f.rel !== 'Orario.md' || !f.dati) continue;
    const t = f.dati.toString('utf8'), m = t.match(/<!-- lode2 n=(\d+) x=([0-9a-f]+) .*h=([0-9a-f]+) /);
    if (!m) { ultimo = null; continue; }
    const nx = { n: +m[1], x: parseInt(m[2], 16) };
    if (ultimo && (nx.n < ultimo.n || (nx.n === ultimo.n && nx.x < ultimo.x))) out.push(`I9: Orario.md di ${f.autore} (n=${nx.n}) sopra uno con n=${ultimo.n}`);
    ultimo = nx;
  }
  return out;
}
const crashMigra = k => ({ id: `N16m${k}`, catalogo: [51], invarianti: ['I1', 'I7'], titolo: `crash alla ${k}ª scrittura di migra(): si riparte e non si perde niente`,
  passi: [{ t: 'crash', pc: 'A', dopo: k }, { t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'attiva', pc: 'A', modo: 'nuovo' }, op('A', esame(`em${k}`, 600 + k)), { t: 'quiete' }] });
const crashRig = k => ({ id: `N16r${k}`, catalogo: [1, 3], invarianti: ['I1', 'I5'], titolo: `crash alla ${k}ª scrittura della rigenerazione (cifra): si riparte e non si perde niente`,
  passi: [...avvio, op('B', esame(`eb${k}`, 620 + k)), { t: 'quiete' }, { t: 'crash', pc: 'A', dopo: k }, cifra('A'), { t: 'accendi', pc: 'A' }, { t: 'sblocca', pc: 'A' }, op('A', esame(`er${k}`, 640 + k)), { t: 'quiete' }] });

export const NUOVI = [
  { id: 'N01', catalogo: [16, 26, 45], invarianti: ['I1', 'I8'], titolo: 'tre computer, C spento tre settimane con l\'orologio due giorni indietro: niente si perde, i contemporanei sono nei conflitti',
    passi: [...avvio, { t: 'spegni', pc: 'C' }, rete('C', false), { t: 'orologio', pc: 'C', scarto: -2 * 864e5 }, op('A', campo('e1', 'data', '2027-ZQ 501')), { t: 'tempo', ms: 21 * 864e5 },
      op('B', campo('e1', 'nome', 'Esame ZQ 502')), op('C', campo('e1', 'data', '2027-ZQ 503')), op('C', esame('ec1', 504)), rete('C', true)],
    verifica: r => conflittiDi(r, 'A').includes('esame/e1/data') ? [] : ['I8: la data di e1 cambiata su A e su C senza vedersi non è fra i conflitti di A'] },
  { id: 'N02', catalogo: [41, 53], invarianti: ['I3', 'I6'], titolo: 'il cloud restituisce una versione vecchia di un contenitore e di un Orario.md cambiato dallo studente',
    passi: [...avvio, cifra('A'), { t: 'quiete' }, { t: 'ricordaVersione', pc: 'A', dove: '@propri', nome: 'cont' }, ...riavvia('B'), op('B', lezione(505, 'obsidian')),
      { t: 'ricordaVersione', pc: 'B', dove: 'vault/Orario.md', nome: 'orario' }, { t: 'quiete' }, op('A', esame('ea2', 506)),
      op('A', { tipo: 'togliLezione', da: 'lode', lezione: lezioneDi(505) }), { t: 'quiete' }, { t: 'rimettiVersione', pc: 'A', nome: 'cont' }, { t: 'rimettiVersione', pc: 'B', nome: 'orario' }, { t: 'arrivati', pc: 'B' }, { t: 'arrivati', pc: 'A' }],
    verifica: maiPiuCorto },
  { id: 'N03', catalogo: [13, 46], invarianti: ['I3', 'I6'], titolo: 'un contenitore va nel cestino del servizio e viene ripristinato',
    passi: [...avvio, op('A', esame('ea3', 507)), { t: 'quiete' }, { t: 'ricordaVersione', pc: 'B', di: 'A', dove: '@propri', nome: 'cestino' }, { t: 'cancella', pc: 'B', di: 'A', p: '@propri' },
      { t: 'caricaTutto', pc: 'B' }, op('A', esame('ea3b', 508)), { t: 'quiete' }, { t: 'rimettiVersione', pc: 'B', nome: 'cestino' }],
    verifica: r => [...maiPiuCorto(r), ...unSoloScrittore(r).filter(x => !x.includes(' B scrive'))] },
  { id: 'N04', catalogo: [31, 47], invarianti: ['I3', 'I10'], titolo: 'la cartella di Lode nel vault sparisce (vault rinominato o spostato): «sparito», nessuno ricrea niente',
    passi: [...avvio, op('B', esame('eb4', 509)), { t: 'quiete' }, { t: 'cancella', pc: 'A', p: 'vault/.lode/sync' }, { t: 'arrivati', pc: 'A' }, { t: 'quiete' }, op('B', esame('eb4b', 510), { forza: true }), ...riavvia('C')],
    ammessi: ['bloccato'],
    verifica: r => { const l = r.cloud.contenuto().filter(f => f.rel.startsWith('.lode/sync/')).map(f => f.rel); return l.length ? [`I10: dopo la sparizione qualcuno ha ricreato ${l.slice(0, 3).join(', ')}`] : []; } },
  { id: 'N05', catalogo: [17], invarianti: ['I1', 'I4'], titolo: 'la cartella dei dati copiata su un altro computer con la STESSA impronta: il gemello si scopre dopo, i contatori si sommano',
    computer: ['A', 'B', 'C'], macchine: { B: 'macchina-A' },
    passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'copiaDati', da: 'A', pc: 'B' }, { t: 'quiete' }, rete('B', false),
      op('A', { tipo: 'incrementa', dove: 'errori', chiave: 'k2', di: 3 }), op('B', { tipo: 'incrementa', dove: 'errori', chiave: 'k2', di: 2 }), op('B', esame('eb5', 511)), rete('B', true), { t: 'quiete' }, op('A', esame('ea5', 512))] },
  { id: 'N06', catalogo: [16], invarianti: ['I4'], titolo: 'ora legale e fuso orario: l\'orologio torna indietro di un\'ora fra due modifiche, e un computer è sei ore avanti',
    passi: [...avvio, { t: 'orologio', pc: 'C', scarto: 6 * 36e5 }, op('B', campo('e1', 'nome', 'Esame ZQ 513')), { t: 'orologio', pc: 'B', scarto: -36e5 }, op('B', campo('e1', 'nome', 'Esame ZQ 514')),
      op('C', campo('e2', 'nome', 'Esame ZQ 515')), { t: 'quiete' }, op('B', campo('e2', 'nome', 'Esame ZQ 516'))] },
  { id: 'N07', catalogo: [8, 25, 39], invarianti: ['I7', 'I3'], titolo: 'il vault intero ripristinato da Time Machine, con il dati.json di prima e i contenitori vecchi',
    passi: [{ t: 'ricordaVersione', pc: 'A', dove: 'vault', nome: 'tm0' }, ...avvio, { t: 'ricordaVersione', pc: 'A', dove: 'vault', nome: 'tm1' }, op('A', { tipo: 'cancellaEsame', id: 'e2' }), op('B', campo('e1', 'nome', 'Esame ZQ 517')),
      op('A', lezione(518)), { t: 'quiete' }, { t: 'rimettiVersione', pc: 'A', nome: 'tm1' }, { t: 'rimettiVersione', pc: 'A', nome: 'tm0' }, { t: 'arrivati', pc: 'A' }],
    verifica: maiPiuCorto },
  { id: 'N08', catalogo: [12, 39, 42, 51], invarianti: ['I7', 'I4'], titolo: 'due primi avvii insieme su un vault in iCloud, con dati.json diversi: nessun valore torna indietro, nessun record rinasce',
    passi: [{ t: 'carica', pc: 'A', file: '.lode/dati.json' }, { t: 'consegna', pc: 'B', file: '.lode/dati.json' }, rete('B', false), { t: 'vecchia', pc: 'B', op: campo('e1', 'nome', 'Esame ZQ 519') },
      { t: 'vecchia', pc: 'B', op: esame('eb8', 520) }, { t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'attiva', pc: 'B', modo: 'nuovo' },
      op('A', { tipo: 'cancellaEsame', id: 'e2' }), op('A', campo('e1', 'data', '2027-ZQ 521')), op('B', campo('e1', 'oreObiettivo', 1522)), rete('B', true)] },
  { id: 'N09', catalogo: [3], invarianti: ['I1', 'I3'], titolo: 'un computer muore per sempre e la sua cartella nel vault si perde: quello che aveva confermato resta',
    passi: [...avvio, op('C', esame('ec9', 523)), op('C', { tipo: 'incrementa', dove: 'giuste', chiave: 'k1', di: 2 }), { t: 'quiete' }, { t: 'muori', pc: 'C' },
      { t: 'cancella', pc: 'A', di: 'C', p: '@propri' }, ...riavvia('A'), op('B', esame('eb9', 524))] },
  { id: 'N10', catalogo: [38], invarianti: ['I1', 'I5'], titolo: 'password dimenticata su tutti i computer: «Ho dimenticato la password» da uno, gli altri entrano con quella nuova',
    passi: [...avvio, cifra('A', 'password vecchia'), { t: 'quiete' }, { t: 'dimentica' }, ...riavvia('A'), ...riavvia('B'), ...riavvia('C'), op('C', esame('ec10', 525), { forza: true }),
      { t: 'cifra', pc: 'B', password: 'password nuova' }, op('B', esame('eb10x', 526), { forza: true })] },
  { id: 'N12', catalogo: [6, 40], invarianti: ['I9'], titolo: 'le note si sincronizzano e .lode no: le scritture di Orario.md restano poche',
    passi: [...avvio, ...[527, 528, 529].flatMap(n => [op('A', lezione(n)), { t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'B', tranne: ['.lode'] }, { t: 'consegnaTutto', pc: 'C', tranne: ['.lode'] },
      { t: 'arrivati', pc: 'B' }, { t: 'arrivati', pc: 'C' }, { t: 'caricaTutto', pc: 'B' }, { t: 'caricaTutto', pc: 'C' }, { t: 'consegnaTutto', pc: 'A', tranne: ['.lode'] }, { t: 'arrivati', pc: 'A' }]), op('B', lezione(530, 'obsidian'))],
    verifica: r => [...proiezioniMonotone(r), ...[...r.pcs.values()].filter(pc => (pc.scritture.get('vault/Orario.md') || 0) > 2 * 4 + 2).map(pc => `N12: ${pc.nome} ha scritto Orario.md ${pc.scritture.get('vault/Orario.md')} volte per 4 modifiche`)] },
  { id: 'N13', catalogo: [40], invarianti: ['I3'], titolo: 'Orario.md troncato (a metà, senza marcatore): nessuna lezione sparisce, nessuna nasce dal nulla',
    passi: [...avvio, op('A', lezione(531)), { t: 'quiete' }, { t: 'corrompi', pc: 'A', dove: 'vault/Orario.md', modo: 'tronca' }, { t: 'arrivati', pc: 'A' }, { t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'B' }, { t: 'arrivati', pc: 'B' }, op('B', lezione(532, 'obsidian'))] },
  { id: 'N14', catalogo: [43], invarianti: ['I1'], titolo: 'un computer nuovo lavora sulle carte prima che arrivino i file: la storia dei ripassi non si perde',
    passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, ripassa('A', 4), ripassa('A', 5), { t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'C', di: 'A', come: { '@propri': 'meta' } }, { t: 'attiva', pc: 'C', modo: 'unisciti' },
      op('C', esame('ec14', 533)), op('C', { tipo: 'aggiungiCarta', quale: 0, id: 'c14', fronte: 'Fronte ZQ 534', retro: 'Retro ZQ 535' }), ripassa('C', 3), ripassa('A', 2)] },
  { id: 'N15', catalogo: [], invarianti: ['I6'], titolo: 'una sessione di 200 ripassi: nel vault al massimo 2 contenitori per computer al giorno',
    passi: [...avvio, ...Array.from({ length: 200 }, (_, i) => ripassa('A', 1 + (i % 5))), { t: 'quiete' }],
    verifica: r => { const per = new Map(); for (const f of contenitori(r)) { const k = f.rel.split('/').slice(0, 4).join('/'); per.set(k, (per.get(k) || 0) + 1); } return [...per].filter(([, n]) => n > 2).map(([k, n]) => `N15: ${k} ha ${n} contenitori in un giorno`); } },
  ...Array.from({ length: 12 }, (_, i) => crashMigra(i + 1)),
  ...Array.from({ length: 16 }, (_, i) => crashRig(i + 1)),
  { id: 'I02', catalogo: [], invarianti: ['I2'], titolo: 'un solo scrittore per cartella, anche con cifratura, rigenerazione e copie in conflitto',
    passi: [...avvio, rete('B', false), cifra('A'), op('A', esame('ea21', 536)), op('B', esame('eb21', 537)), cifra('B', 'altra password'), rete('B', true), { t: 'quiete' }, op('C', esame('ec21', 538))],
    verifica: r => unSoloScrittore(r) },
  // i controesempi trovati dal fuzz (la storia intera, rigenerata dal seme): restano come scenari fissi
  { id: 'F01', catalogo: [41], invarianti: ['I1'], titolo: 'fuzz 121851: lezione aggiunta e tolta in Obsidian prima di avere il gruppo, con una copia in conflitto di Orario.md', fuzz: { seme: 121851, guasti: false } },
  { id: 'F02', catalogo: [48], invarianti: ['I5'], titolo: 'fuzz 130239: sostituito.json arriva come segnaposto: niente in chiaro nel gruppo vecchio', fuzz: { seme: 130239, cifratura: true } },
  { id: 'F03', catalogo: [46], invarianti: ['I3'], titolo: 'fuzz 141420: macchina.json rovinato due volte, con un crash nel mezzo', fuzz: { seme: 141420, corruzione: true } },
  { id: 'F04', catalogo: [40], invarianti: ['I3'], titolo: 'fuzz 161491: Orario.md arrivato a metà e una lezione aggiunta in Obsidian', fuzz: { seme: 161491, servizio: 'icloud' } },
  { id: 'F05', catalogo: [43], invarianti: ['I1', 'I4'], titolo: 'fuzz 7446: tre ripassi contemporanei della stessa carta su tre computer (SM-2 §6.6)', fuzz: { seme: 7446, guasti: false } },
  { id: 'F06', catalogo: [43], invarianti: ['I1'], titolo: 'fuzz 1006448: ripassi «Di nuovo» con lo stesso risultato e un orologio 17 ore indietro', fuzz: { seme: 1006448, servizio: 'icloud' } },
  { id: 'F07', catalogo: [43, 29], invarianti: ['I1'], titolo: 'fuzz 1009430: un ripasso perso in un crash, mentre gli altri ripassano la stessa carta', fuzz: { seme: 1009430, servizio: 'gdrive' } },
  // i controesempi del collaudo del 3 ottobre (scenari X), fissi
  { id: 'X01', catalogo: [38], invarianti: ['I1', 'I5'], titolo: '10.5 password dimenticata davvero (nessuno la ricorda, nessun portachiavi): «Ho dimenticato la password» su B, poi tutti con quella nuova',
    passi: [...avvio, cifra('A', 'vecchia'), { t: 'quiete' }, ...riavvia('A'), ...riavvia('B'), ...riavvia('C'), { t: 'dimentica' }, ...riavvia('A'), ...riavvia('B'), ...riavvia('C'),
      cifra('B', 'nuova'), op('B', esame('eb1', 901), { forza: true }), op('C', esame('ec1', 931), { forza: true }), { t: 'quiete' }] },
  { id: 'X02', catalogo: [31], invarianti: ['I1', 'I3'], titolo: 'la cartella del gruppo radice cancellata dopo una rigenerazione, poi un cambio password: tutti seguono',
    passi: [...avvio, cifra('A', 'uno'), { t: 'quiete' }, { t: 'radice', pc: 'A' }, { t: 'quiete' }, cifra('A', 'due'), { t: 'quiete' }, op('B', esame('eb2', 902), { forza: true }), op('C', esame('ec2', 903), { forza: true }), { t: 'quiete' }] },
  { id: 'X03', catalogo: [14], invarianti: ['I3'], titolo: 'il gruppo.json della radice diventa un segnaposto su B, B riavvia, poi A cambia password: B segue',
    passi: [...avvio, cifra('A', 'uno'), { t: 'quiete' }, { t: 'radice', pc: 'B', come: 'segnaposto' }, ...riavvia('B'), cifra('A', 'due'),
      { t: 'carica', pc: 'A', quale: 0 }, ...Array.from({ length: 12 }, (_, i) => ({ t: 'consegna', pc: 'B', quale: i / 12 })), { t: 'arrivati', pc: 'B' }, { t: 'sblocca', pc: 'B' }, { t: 'arrivati', pc: 'B' }, op('B', esame('eb3', 904), { forza: true }), { t: 'arrivati', pc: 'B' }, { t: 'quiete' }] },
  { id: 'X04', catalogo: [3, 31], invarianti: ['I1', 'I3'], titolo: 'il creatore muore per sempre (N09) e poi gruppo.json si perde: gli altri due lo rimettono e continuano fra loro',
    passi: [...avvio, op('B', esame('eb4', 905)), { t: 'quiete' }, { t: 'muori', pc: 'A' }, { t: 'cancella', pc: 'B', p: '@descrittore' }, { t: 'quiete' }, op('B', esame('eb4b', 906), { forza: true }), op('C', esame('ec4', 907), { forza: true }), { t: 'quiete' }] },
  { id: 'X05', catalogo: [3, 46], invarianti: ['I1', 'I3'], titolo: 'come X04, ma gruppo.json rovinato (non cancellato) mentre il creatore è morto',
    passi: [...avvio, { t: 'quiete' }, { t: 'muori', pc: 'A' }, { t: 'corrompi', pc: 'A', dove: '@descrittore', modo: 'tronca' }, { t: 'quiete' }, op('B', esame('eb5', 908), { forza: true }), op('C', esame('ec5', 909), { forza: true }), { t: 'quiete' }] },
  { id: 'X06', catalogo: [3], invarianti: ['I1'], titolo: 'C pubblica (il file arriva al cloud) e muore per sempre; A accende la password prima di aver letto il file di C: il lavoro di C resta (§10.6)',
    passi: [...avvio, op('C', esame('ec6', 910)), { t: 'arrivati', pc: 'C' }, { t: 'caricaTutto', pc: 'C' }, { t: 'muori', pc: 'C' }, cifra('A', 'uno'), { t: 'quiete' }, { t: 'toglila', pc: 'A' }, { t: 'quiete' }], verifica: chiaroNelCloud },
  { id: 'X07', catalogo: [3], invarianti: ['I1'], titolo: 'come X06, ma la password la accende B',
    passi: [...avvio, op('C', esame('ec7', 911)), { t: 'arrivati', pc: 'C' }, { t: 'caricaTutto', pc: 'C' }, { t: 'muori', pc: 'C' }, cifra('B', 'due'), { t: 'quiete' }, { t: 'toglila', pc: 'B' }, { t: 'quiete' }], verifica: chiaroNelCloud },
  { id: 'X08', seme: 'X8', catalogo: [19], invarianti: ['I1', 'I3'], titolo: '10.4.5 due cambi password contemporanei (A e B), poi A chiude e riapre Lode: alla fine tutti nello stesso gruppo',
    passi: [...avvio, cifra('A', 'p0'), { t: 'quiete' }, cifra('B', 'pB'), cifra('A', 'pA'), op('B', esame('eb8', 912)), { t: 'spegni', pc: 'A' }, { t: 'quiete' }] },
  { id: 'X08b', seme: 'X8', catalogo: [19, 37], invarianti: ['I1', 'I3'], titolo: 'come X08, ma A ha fatto «Dimentica la password qui» (o è Linux con basic_text): il sostituito dell\'altro non si verifica, A lo chiede',
    passi: [...avvio, cifra('A', 'p0'), { t: 'quiete' }, cifra('B', 'pB'), cifra('A', 'pA'), op('B', esame('eb8', 912)), { t: 'dimentica', pc: 'A' }, { t: 'spegni', pc: 'A' }, { t: 'quiete' }] },
  { id: 'X09', seme: 'X9', catalogo: [19], invarianti: ['I1', 'I3'], titolo: 'come X08 ma A non si riavvia',
    passi: [...avvio, cifra('A', 'p0'), { t: 'quiete' }, cifra('B', 'pB'), cifra('A', 'pA'), op('B', esame('eb9', 913)), { t: 'quiete' }] },
  { id: 'X10', catalogo: [55], invarianti: ['I1'], titolo: 'C accende la password, B aggiunge un esame e fa «Smetti» subito: A lo vede lo stesso (fuzz --extra 77000068)',
    passi: [...avvio, cifra('C', 'tre'), op('B', esame('eb10', 914)), { t: 'smetti', pc: 'B' }, { t: 'quiete' }, { t: 'toglila', pc: 'A' }, { t: 'quiete' }], verifica: chiaroNelCloud },
  { id: 'F12', catalogo: [19, 37], invarianti: ['I1', 'I3'], titolo: 'fuzz --cambi 93001212: due cambi di password insieme, il perdente fa «Dimentica la password qui» e si riavvia: senza la chiave del nonno si credeva già avanti', fuzz: { seme: 93001212, extra: 'cambi' } },
  { id: 'F13', catalogo: [3, 46], invarianti: ['I5'], titolo: 'fuzz --cifratura --corruzione 93200005: diario tagliato e stato.json rovinato prima della password altrui: la cartella del dev di prima non resta in chiaro', fuzz: { seme: 93200005, cifratura: true, corruzione: true } },
  { id: 'F14', catalogo: [31, 46], invarianti: ['I5'], titolo: 'fuzz --cifratura --corruzione 93200061: sostituito.json tagliato a metà sul computer che l\'ha scritto: lo rimette, gli altri seguono', fuzz: { seme: 93200061, cifratura: true, corruzione: true } },
  { id: 'F15', catalogo: [46], invarianti: ['I5'], titolo: 'fuzz --cifratura --corruzione 68002037 (collaudo): un bit del diario rovinato, poi la password: niente resta in chiaro', fuzz: { seme: 68002037, cifratura: true, corruzione: true } },
  { id: 'F16', catalogo: [24, 46], invarianti: ['I3'], titolo: 'fuzz --cifratura --corruzione 95201734: un bit del gruppo.json nuovo rovinato (il controllo): il creatore lo rimette e gli altri non restano con la copia rovinata in memoria', fuzz: { seme: 95201734, cifratura: true, corruzione: true } },
  { id: 'F17', catalogo: [48], invarianti: ['I5'], titolo: 'fuzz --cambi 95001697: cambi di password con orologi spostati e «Dimentica la password qui»: niente caricato in chiaro dopo la password', fuzz: { seme: 95001697, extra: 'cambi' } },
  { id: 'F08', catalogo: [46], invarianti: ['I3'], titolo: 'fuzz 1018455: il diario tagliato a metà dopo un crash, poi una modifica', fuzz: { seme: 1018455, corruzione: true } },
  { id: 'F09', catalogo: [40, 53], invarianti: ['I1', 'I3'], titolo: 'fuzz 510941: Orario.md arrivato a metà (marcatore tagliato), poi una lezione tolta in Obsidian', fuzz: { seme: 510941 } },
  { id: 'F11', catalogo: [46], invarianti: ['I3'], titolo: 'fuzz 1130467: gruppo.json rovinato, un crash, poi il servizio lo toglie dal disco: il creatore non riscrive sopra il segnaposto', fuzz: { seme: 1130467, corruzione: true } },
  { id: 'F18', catalogo: [46], invarianti: ['I3'], titolo: 'fuzz --cifratura --corruzione 78600010: stato.json e il contenitore del dev di prima rovinati, poi la password: la cartella lasciata si toglie solo dopo averne messo da parte i file', fuzz: { seme: 78600010, cifratura: true, corruzione: true } },
  { id: 'F10', catalogo: [40, 53], invarianti: ['I1', 'I3'], titolo: 'fuzz 1040549: Orario.md arrivato a metà su un computer con l\'orologio indietro, poi una lezione tolta da Lode', fuzz: { seme: 1040549, obsidian: 'uno' } },
  // la revisione del motore v2 (giro 1 delle correzioni): ogni problema trovato nel motore è uno scenario fisso. Servono i guasti
  // del disco (letture e scritture che falliscono con EIO, EBUSY, ENOSPC), che il simulatore prima non aveva
  { id: 'R01', catalogo: [], invarianti: ['I1'], titolo: 'un segmento del diario non si legge all\'avvio (EIO): Lode si ferma e non ci scrive sopra; la modifica di prima, non ancora pubblicata, resta',
    passi: [...avvio, rete('A', false), op('A', esame('er1', 601)), { t: 'uccidi', pc: 'A' }, { t: 'guasto', pc: 'A', dove: '@segmento', codice: 'EIO' }, { t: 'accendi', pc: 'A' },
      op('A', campo('e1', 'nome', 'Esame ZQ 602')), { t: 'ripara', pc: 'A' }, { t: 'accendi', pc: 'A' }, rete('A', true)] },
  { id: 'R01b', catalogo: [], invarianti: ['I1'], titolo: 'come R01, con la cartella del diario che non si elenca (EACCES)',
    passi: [...avvio, rete('A', false), op('A', esame('er1b', 611)), { t: 'uccidi', pc: 'A' }, { t: 'guasto', pc: 'A', dove: '@diario', codice: 'EACCES' }, { t: 'accendi', pc: 'A' },
      op('A', campo('e1', 'nome', 'Esame ZQ 612')), { t: 'ripara', pc: 'A' }, { t: 'accendi', pc: 'A' }, rete('A', true)] },
  { id: 'R02', catalogo: [], invarianti: ['I1', 'I4'], titolo: 'il disco è pieno quando lo studente sbaglia un esercizio: la barra rimanda l\'operazione dopo, e il contatore conta una volta sola',
    passi: [...avvio, { t: 'guasto', pc: 'A', dove: '@diario', codice: 'ENOSPC', quale: 'scrivi' }, op('A', { tipo: 'incrementa', dove: 'errori', chiave: 'F3', di: 1 }, { ritenta: true }),
      { t: 'ripara', pc: 'A' }, op('A', campo('e1', 'nome', 'Esame ZQ 603')), ...riavvia('A')] },
  { id: 'R03', catalogo: [], invarianti: ['I1'], titolo: 'dati.json bloccato da un antivirus (EBUSY) quando lo studente accende: la migrazione non parte da zero',
    passi: [{ t: 'guasto', pc: 'A', dove: 'vault/.lode/dati.json', codice: 'EBUSY' }, { t: 'attiva', pc: 'A', modo: 'nuovo' }, { t: 'ripara', pc: 'A' }, { t: 'quiete' }, { t: 'attiva', pc: 'B', modo: 'unisciti' }] },
  { id: 'R04', catalogo: [8], invarianti: ['I1'], titolo: 'Lode di prima (che conserva lode2) apre il vault già migrato e aggiunge un esame: l\'avviso «Dati da una Lode vecchia» arriva',
    passi: [...avvio, { t: 'vecchia', pc: 'B', op: esame('ev4', 604) }] },
  // giro 2 delle correzioni
  { id: 'R05', catalogo: [40], invarianti: ['I1'], titolo: 'fuzz --disco 62101019: una lezione aggiunta in Obsidian col disco pieno e poi tolta (il file torna come l\'aveva scritto Lode): la rimozione vale, anche se un altro computer aveva già letto l\'aggiunta', fuzz: { seme: 62101019, disco: true, orologi: 'piccoli', obsidian: 'uno' } },
  { id: 'R06', catalogo: [31, 47], invarianti: ['I5'], titolo: 'gruppo.json del gruppo cifrato riscritto con «cifratura: null» prima che B si unisca: B non si unisce in chiaro e non pubblica in chiaro; dopo la password i suoi dati arrivano',
    passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, cifra('A'), { t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'B', di: 'A' },
      { t: 'manometti', pc: 'B', dove: /\/gruppo\.json$/, come: 'cifratura tolta', cambia: j => (j.cifratura ? { ...j, cifratura: null } : null) },
      { t: 'attiva', pc: 'B', modo: 'unisciti' }, op('B', esame('er6', 621)), { t: 'arrivati', pc: 'B' }] },
  { id: 'R07', catalogo: [31], invarianti: ['I4'], titolo: 'la «fonte» di gruppo.json cambiata nel gruppo cifrato prima che B si unisca: con la password giusta B non mostra una Lode senza i dati migrati',
    passi: [{ t: 'attiva', pc: 'A', modo: 'nuovo' }, cifra('A'), { t: 'caricaTutto', pc: 'A' }, { t: 'consegnaTutto', pc: 'B', di: 'A' },
      { t: 'manometti', pc: 'B', dove: /\/gruppo\.json$/, come: 'fonte cambiata', cambia: j => (j.cifratura ? { ...j, fonte: '0'.repeat(32) } : null) },
      { t: 'attiva', pc: 'B', modo: 'unisciti' }, { t: 'sblocca', pc: 'B', password: PW }, op('B', esame('er7', 631))] },
  // un contenitore letto mentre altri/ non si scrive (disco pieno, EACCES, EBUSY): si rilegge al giro dopo, non resta «letto»
  { id: 'R08', catalogo: [], invarianti: ['I4'], titolo: 'fuzz --disco 93150054: il contenitore di B arriva a C mentre il suo disco rifiuta le scritture: dopo, C lo legge e converge', fuzz: { seme: 93150054, disco: true, orologi: 'piccoli', obsidian: 'uno' } },
  { id: 'R09', catalogo: [], invarianti: ['I4'], titolo: 'fuzz --disco --cifratura 93110865: come R08, con EACCES e la cifratura accesa subito dopo', fuzz: { seme: 93110865, disco: true, cifratura: true } },
  // «Smetti» mentre un cambio di password di un altro computer arriva a pezzi (il gruppo.json nuovo sì, il sostituito.json no):
  // la pubblicazione non parte (I3) e prima «Smetti» lasciava le modifiche solo su quel computer. Ora si rifiuta e si riprova
  { id: 'F19', catalogo: [54], invarianti: ['I1'], titolo: 'fuzz --extra 92130248: «Smetti» dopo una password altrui arrivata a metà: il ripasso e la carta di C arrivano ad A', fuzz: { seme: 92130248, extra: 'tutto' } },
  { id: 'F20', catalogo: [54], invarianti: ['I1'], titolo: 'fuzz --extra 91130003: come F19, il ripasso e l\'esame di B', fuzz: { seme: 91130003, extra: 'tutto' } },
  { id: 'F21', catalogo: [54], invarianti: ['I1'], titolo: 'fuzz --extra 7200004: due «Smetti» dopo la password di A, il profilo e l\'esame di B arrivano', fuzz: { seme: 7200004, extra: 'tutto' } },
  { id: 'F22', catalogo: [54], invarianti: ['I1'], titolo: 'fuzz --extra 7200073: «Smetti» di B subito dopo la password di A: carta, esame e lezione di B arrivano', fuzz: { seme: 7200073, extra: 'tutto' } },
  // giro 3: dopo «Cambia password» chi conosce la password di prima (di solito si cambia proprio perché è trapelata) scrive una
  // cartella nuova nel gruppo di prima, con un contenitore cifrato con la chiave vecchia: i suoi eventi non devono entrare (prima
  // si piegavano, entravano nel diario e si ripubblicavano cifrati con la chiave nuova, senza avvisi). Formato del motore v2
  { id: 'G01', catalogo: [], invarianti: ['I5'], titolo: 'dopo «Cambia password» una cartella nuova nel gruppo di prima, cifrata con la password di prima: i suoi eventi non entrano',
    passi: [...avvio, cifra('A', 'vecchia pw 1'), { t: 'quiete' }, cifra('A', 'nuova pw 2'), { t: 'quiete' },
      { t: 'inietta', pc: 'B', come: 'contenitore cifrato con la password di prima', file: iniezione('vecchia pw 1', 'INIETTATO ZQ 901') }, { t: 'arrivati', pc: 'B' },
      { t: 'inietta', pc: 'C', come: 'contenitore cifrato con la password di prima', file: iniezione('vecchia pw 1', 'INIETTATO ZQ 902') }, { t: 'quiete' }],
    verifica: r => r.viste.filter(x => JSON.stringify(x.v).includes('INIETTATO')).map(x => `I5: ${x.pc.nome} mostra il nome iniettato con la password di prima`) },
  // giro 3: Obsidian salva Orario.md fra la lettura del file e la sua riscrittura da parte del motore (il rename la copriva:
  // non arrivava nel diario né in copie/)
  { id: 'G02', catalogo: [], invarianti: ['I1'], titolo: 'lo studente salva Orario.md in Obsidian mentre il motore lo riscrive: la lezione aggiunta non si perde',
    passi: [...avvio, op('B', lezione(903)), { t: 'caricaTutto', pc: 'B' }, { t: 'consegnaTutto', pc: 'A', di: 'B', tranne: ['vault/Orario.md'] },
      { t: 'obsidianNelMezzo', pc: 'A', op: lezione(904, 'obsidian') }] },
];
// il formato v2: un contenitore cifrato con la chiave di una password di prima, in una cartella nuova di ogni gruppo sostituito
function iniezione(password, valore) {
  return ({ elenco, leggi }) => {
    const l = elenco(), out = [];
    for (const g of new Set(l.filter(r => /^\.lode\/sync\/[^/]+\/gruppo\.json$/.test(r)).map(r => r.split('/')[2]))) {
      if (!l.some(r => r.startsWith(`.lode/sync/${g}/sostituito`))) continue;
      let gj; try { gj = JSON.parse(leggi(`.lode/sync/${g}/gruppo.json`)); } catch { continue; }
      if (!gj?.cifratura?.sale) continue;
      const P = PARAMETRI_PROVA, k = scryptSync(password.normalize('NFC'), Buffer.from(gj.cifratura.sale, 'hex'), 32, { N: P.N, r: P.r, p: P.p, maxmem: 256 * P.N * P.r + 1024 * 1024 });
      const dev = createHash('sha256').update(g + valore).digest('hex').slice(0, 16);
      const e = conImpronta({ dev, t: [Date.parse('2026-10-03T09:00:00Z'), 0], k: 1, r: '0123456789abcdef', tipo: 'campo', percorso: 'profilo/nome', valore, prev: null });
      out.push([`.lode/sync/${g}/${dev}/1.seg`, scriviContenitore({ gruppo: g, dev, n: 1, eventi: [e], chiave: k })]);
    }
    return out;
  };
}

// i problemi del catalogo che il simulatore non sa esprimere, e perché
export const NON_ESPRIMIBILI = [
  { catalogo: [4, 23], motivo: 'testi dell\'interfaccia e del README su cosa è cifrato: il simulatore guarda solo .lode/ (le pagine per Obsidian sono in chiaro per scelta)' },
  { catalogo: [5, 15], motivo: 'cambio di vault («Scegli il vault…»): ogni computer del simulatore ha un vault solo' },
  { catalogo: [6], motivo: 'Home.md, Esami.md, Glossario.md (vault:blocco) non sono simulate: solo Orario.md, che il motore legge' },
  { catalogo: [7], motivo: 'conteggio delle prove nel README' },
  { catalogo: [20], motivo: 'quello che arriva in chiaro PRIMA della cifratura resta nella cronologia del servizio per costruzione: la proprietà conta solo dopo l\'accensione' },
  { catalogo: [21], motivo: 'spostamento del vault nella cartella cloud (spostaVault): non fa parte del contratto del motore' },
  { catalogo: [22, 38, 50], motivo: 'cambiare la password, ricominciare dopo averla dimenticata: non ci sono nel contratto (e sono scelte di interfaccia)' },
  { catalogo: [24], motivo: 'parametri scrypt pesanti in un cifratura.json scritto da altri: serve il formato del motore, e il simulatore non misura memoria e tempo di CPU (solo «non risponde» dopo 20 s)' },
  { catalogo: [28, 52], motivo: 'una finestra con un D vecchio (__rev di un motore di prima, riferimenti a record sostituiti): il simulatore manda l\'intenzione dello studente, non la copia che la finestra tiene' },
  { catalogo: [36, 49], motivo: 'messaggi della scheda «Sincronizza» (problemi vecchi, «un\'altra password» per un file manomesso): interfaccia' },
  { catalogo: [37], motivo: 'la chiave ricordata nel portachiavi: il simulatore non ha portachiavi (la chiave vive per la sessione)' },
  { catalogo: [2], motivo: 'in parte: infilare un file in chiaro scritto ad arte serve il formato del motore. S05 prova la variante indipendente (una versione vera, rimessa)' },
  { catalogo: [39, 42], motivo: 'in parte: il ramo «dati.json scritto da questo processo» (datiMiei) del main non è nell\'adattatore; S06 e S25 provano lo stesso danno con Lode di prima' },
  { catalogo: [10, 29, 43], motivo: 'in parte: l\'adattatore del v1 rifiuta le modifiche a dati bloccati (la barra vera le accettava): S33 vale per i motori nuovi' },
];

export async function eseguiScenario(sc, motore, opz = {}) {
  // seme: quello della storia (gli id dei gruppi e dei dev vengono da lì); di solito l'id dello scenario
  const storia = sc.fuzz ? generaStoria(sc.fuzz.seme, sc.fuzz) : { seme: sc.seme || sc.id, servizio: sc.servizio || 'icloud', computer: sc.computer || ['A', 'B', 'C'], macchine: sc.macchine, passi: sc.passi };
  const r = await esegui(storia, { motore, regola: sc.regola || 'libera', rilassa: !!sc.fuzz?.corruzione, ...opz });
  const ammessi = new Set(sc.ammessi || []);
  const extra = sc.verifica ? sc.verifica(r).map(testo => ({ proprieta: 'scenario', testo })) : [];
  return { ...r, violazioni: [...r.violazioni.filter(v => !ammessi.has(v.proprieta)), ...extra] };
}

async function principale() {
  const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; }, c = k => a.includes('--' + k);
  const motore = arg('motore'); if (!motore) { console.error('serve --motore <percorso>'); process.exit(2); }
  const solo = arg('solo', null)?.split(',');
  const out = [];
  for (const sc of [...SCENARI, ...NUOVI].filter(s => !solo || solo.includes(s.id) || solo.some(x => x.endsWith('*') && s.id.startsWith(x.slice(0, -1))))) {
    const r = await eseguiScenario(sc, motore, { dettagli: c('dettagli') });
    out.push({ id: sc.id, catalogo: sc.catalogo, titolo: sc.titolo, passa: !r.violazioni.length, violazioni: r.violazioni.map(v => `${v.proprieta}: ${v.testo}`) });
    if (c('json')) continue;
    console.log(`${r.violazioni.length ? 'FALLISCE' : 'passa   '}  ${sc.id}  (${[...sc.catalogo.map(n => '#' + n), ...(sc.invarianti || [])].join(', ')})  ${sc.titolo}`);
    for (const v of r.violazioni.slice(0, 6)) console.log(`            · ${v.proprieta}: ${v.testo}`);
    if (r.violazioni.length > 6) console.log(`            · … e altre ${r.violazioni.length - 6}`);
    if (c('racconta') && r.violazioni.length) for (const riga of r.racconto) console.log('              ' + riga);
  }
  const falliti = out.filter(x => !x.passa);
  const coperti = new Set([...SCENARI, ...NUOVI].flatMap(s => s.catalogo)), fuori = new Set(NON_ESPRIMIBILI.flatMap(x => x.catalogo));
  if (c('json')) { console.log(JSON.stringify({ motore, scenari: out, nonEsprimibili: NON_ESPRIMIBILI }, null, 1)); }
  else {
    console.log(`\n${motore}: ${out.length - falliti.length} scenari passano, ${falliti.length} falliscono (su ${out.length}).`);
    console.log(`Catalogo: ${coperti.size} problemi su 55 hanno uno scenario; non esprimibili (del tutto o in parte):`);
    for (const x of NON_ESPRIMIBILI) console.log(`  #${x.catalogo.join(', #')}: ${x.motivo}`);
    const mancano = Array.from({ length: 55 }, (_, i) => i + 1).filter(n => !coperti.has(n) && !fuori.has(n));
    if (mancano.length) console.log(`  senza scenario né motivo: #${mancano.join(', #')}`);
  }
  process.exitCode = falliti.length ? 1 : 0;
}
if (import.meta.url === `file://${process.argv[1]}`) principale().catch(x => { console.error(x); process.exit(2); });
