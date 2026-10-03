// L'adattatore del motore v1 al contratto del simulatore (mondo.mjs). Il v1 non è solo sincronizza.mjs: una parte della
// logica sta in desktop/main.mjs (arrivati, apriSincronizzazione, sync:cifra, sync:sblocca, il watcher di Orario.md) e nella
// barra (js/vault.js, 'vault:orario'; js/dati.js, salva con __rev). Qui la si rifà in piccolo, seguendo il codice del ramo
// sincronizzazione-v1, così il simulatore prova il v1 com'era nell'app e non solo il modulo:
// - modifica(op): la barra prende la vista (per('barra'), con __rev), applica l'operazione (operazioni.mjs) e salva; il main
//   scrive subito (scriviOra, al posto del timer di mezzo secondo). Se l'operazione tocca l'orario la barra riscrive
//   Orario.md dalla vista (scriviOrario, vault:scrivi);
// - arrivati(): il watcher di Orario.md (desktop/vault.mjs guarda: differenzeOrario con la storia in memoria, che a ogni avvio
//   riparte dalla versione attuale) e arrivati() di main.mjs (cifratura arrivata o sparita, ricarica, id conteso);
// - apri(): apriSincronizzazione() di main.mjs, più creaOrarioSync();
// - la chiave della password resta solo «per la sessione» (niente portachiavi): dopo un riavvio serve sblocca().
// Non c'è: la barra con un D vecchio (qui prende sempre la vista fresca), le pagine Home/Esami (vault:blocco), lo spostamento
// del vault, le modifiche fatte coi dati bloccati (in-attesa.json): il simulatore non lascia fare operazioni a dati bloccati.
import * as F from './fs-v1.mjs';
import { applicaOp, orarioMd, leggiOrario } from '../operazioni.mjs';

// da desktop/vault.mjs del ramo sincronizzazione-v1 (funzioni pure, copiate così come sono)
const chiaveOrario = o => [o.corso, (o.giorni || []).join(','), o.inizio, o.fine, o.aula || ''].join('|');
function differenzeOrario(storia, righe) {
  const conta = l => { const m = new Map(); for (const o of l) { const k = chiaveOrario(o); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const N = conta(righe);
  let base = null, d = Infinity;
  for (const b of [...storia].reverse()) {
    const B = conta(b); let x = 0;
    for (const k of new Set([...B.keys(), ...N.keys()])) x += Math.abs((B.get(k) || 0) - (N.get(k) || 0));
    if (x < d) { d = x; base = b; }
  }
  const B = conta(base || []), aggiunte = [], tolte = [];
  for (const o of righe) { const k = chiaveOrario(o); if ((B.get(k) || 0) > 0) B.set(k, B.get(k) - 1); else aggiunte.push(o); }
  for (const b of base || []) { const k = chiaveOrario(b); if ((N.get(k) || 0) > 0) N.set(k, N.get(k) - 1); else tolte.push(b); }
  return { aggiunte, tolte };
}
const TOCCA_ORARIO = new Set(['aggiungiLezione', 'togliLezione']);
// le prove usano parametri scrypt leggeri (il v1 li accetta: N da 2^15)
const SCRYPT_PROVA = { N: 2 ** 15, r: 8, p: 1 };
let istanze = 0;

export function crea({ fs, vault, dati, orologio, casuale, registro = () => { } }) {
  let SY = null, motore = null, chiave = null, id = null, ultimoOrario = null;
  const storia = [];
  // ogni chiamata al v1: «adesso lavora questo computer»
  const C = f => { F.usa(fs.sync, orologio); return f(); };
  const esiste = p => C(() => F.existsSync(p));
  const leggi = p => { try { return C(() => F.readFileSync(p, 'utf8')); } catch (x) { if (x?.crash) throw x; return null; } };
  const ricorda = t => { storia.push(leggiOrario(t)); if (storia.length > 12) storia.shift(); };
  const segnaOrario = t => { ultimoOrario = t; ricorda(t); };
  // config.json è del main, non del motore v1: se non si legge si mette da parte (così le prove sui file rovinati guardano il v1)
  const conf = () => {
    const t = leggi(`${dati}/config.json`); if (t == null) return {};
    try { return JSON.parse(t) || {}; } catch { C(() => F.renameSync(`${dati}/config.json`, `${dati}/config.illeggibile-${orologio()}.json`)); return {}; }
  };
  const salvaConf = c => C(() => { F.mkdirSync(dati, { recursive: true }); F.scriviSicuro(`${dati}/config.json`, JSON.stringify(c)); });
  const leggiDati = () => { try { const d = JSON.parse(leggi(`${vault}/.lode/dati.json`)); return d?.v === 1 ? d : null; } catch { return null; } };
  const nuovoId = () => Array.from({ length: 16 }, () => '0123456789abcdef'[Math.floor(casuale() * 16)]).join('');

  function apriSincronizzazione(altreChiavi = []) {
    try { C(() => motore?.chiudi?.()); } catch (x) { if (x?.crash) throw x; }
    motore = null;
    if (!C(() => SY.attiva(vault))) {
      const sp = C(() => SY.spenta(vault));
      if (sp && sp.da !== id) { try { C(() => SY.seguiSpenta({ vault, locale: dati, dispositivo: id, chiavi: [chiave].filter(Boolean), ora: orologio() })); } catch (x) { if (x?.crash) throw x; registro('seguiSpenta', x.message); } }
      return;
    }
    try { motore = C(() => SY.apri({ vault, locale: dati, dispositivo: id, chiave, altreChiavi, ritardo: 0, ora: orologio, log: (...a) => registro(...a), datiMiei: () => false })); }
    catch (x) { if (x?.crash) throw x; motore = { bloccato: true, errore: x.message }; }
    if (motore?.bloccato && motore.cifrato && !motore.codice) C(() => SY.togliInChiaro(vault, dati, id));
  }
  function creaOrarioSync() {
    if (!motore || motore.bloccato || esiste(`${vault}/Orario.md`) || esiste(`${vault}/.Orario.md.icloud`)) return;
    const o = C(() => motore.vista()).orario || [];
    let altriFile = []; try { altriFile = C(() => F.readdirSync(`${vault}/.lode/dispositivi`)).filter(n => /^\.?[0-9a-f]{16}\.json(\.icloud)?$/.test(n) && !n.replace(/^\./, '').startsWith(id + '.')); } catch (x) { if (x?.crash) throw x; }
    if (!o.length || (altriFile.length && !C(() => motore.stato()).altri.length)) return;
    const t = orarioMd(o); segnaOrario(t); C(() => F.scriviSicuro(`${vault}/Orario.md`, t));
  }
  // vault:scrivi per Orario.md (main.mjs), chiamato dalla barra (js/vault.js, scriviOrario)
  function scriviOrario() {
    if (!motore || motore.bloccato) return;
    const t = orarioMd(C(() => motore.vista()).orario || []); segnaOrario(t); C(() => F.scriviSicuro(`${vault}/Orario.md`, t));
  }
  // la barra salva un D cambiato (js/dati.js salva → dati:salva → motore.salva) e il main scrive
  function salvaBarra(cambia) {
    C(() => { const D = motore.per('barra'); if (cambia(D) === false) return; motore.salva(D, 'barra'); motore.scriviOra(); });
  }
  // il watcher di Orario.md (desktop/vault.mjs guarda → orarioCambiato in main.mjs → 'vault:orario' nella barra)
  function guardaOrario() {
    const t = leggi(`${vault}/Orario.md`); if (t == null || t === ultimoOrario) return;
    ultimoOrario = t; const righe = leggiOrario(t), dif = differenzeOrario(storia, righe); ricorda(t);
    if (!dif.aggiunte.length && !dif.tolte.length) return;
    if (!motore || motore.bloccato) return;
    if (!righe.length && dif.tolte.length) {
      const v = C(() => motore.vista()).orario || [];
      if (v.length) { const t2 = orarioMd(v); segnaOrario(t2); C(() => F.scriviSicuro(`${vault}/Orario.md`, t2)); return; }
    }
    let riscrivi = false;
    salvaBarra(D => {
      const via = new Map(); for (const o of dif.tolte) via.set(chiaveOrario(o), (via.get(chiaveOrario(o)) || 0) + 1);
      let cambiato = false;
      const resta = (D.orario || []).filter(o => { const c = via.get(chiaveOrario(o)); if (c) { via.set(chiaveOrario(o), c - 1); cambiato = true; return false; } return true; });
      const ci = new Set(resta.map(chiaveOrario));
      for (const o of dif.aggiunte) if (!ci.has(chiaveOrario(o))) { resta.push({ id: 'o' + Math.floor(casuale() * 1e9).toString(36), ...o }); ci.add(chiaveOrario(o)); cambiato = true; }
      if (cambiato) D.orario = resta;
      riscrivi = resta.map(chiaveOrario).sort().join('\n') !== righe.map(chiaveOrario).sort().join('\n');
      return cambiato;
    });
    if (riscrivi) scriviOrario();
  }

  return {
    async apri() {
      SY = await import(`./sincronizza.mjs?istanza=${++istanze}`);   // un processo nuovo: niente REV/SNAP di un'altra istanza
      const c = conf();
      if (c.dispositivo) id = c.dispositivo; else { id = nuovoId(); salvaConf({ ...c, dispositivo: id }); }
      const t = leggi(`${vault}/Orario.md`); if (t != null) segnaOrario(t);
      apriSincronizzazione();
      creaOrarioSync();
    },
    async attiva({ modo }) {
      if (modo === 'unisciti' && !esiste(`${vault}/.lode`)) throw new Error('nel vault non c\'è ancora .lode');
      C(() => SY.segna(vault, orologio()));
      apriSincronizzazione(); creaOrarioSync();
    },
    async modifica(op) {
      // senza sincronizzazione (prima di accenderla, o dopo lo stop): Lode di sempre, .lode/dati.json intero (main.mjs, scriviDopo)
      if (!motore) {
        if (C(() => SY.attiva(vault))) throw new Error('dati bloccati');
        const d = leggiDati() || { v: 1, esami: [], carte: [], orario: [], profilo: {}, imp: {}, memoria: {}, codice: { errori: {} } };
        applicaOp(d, op); C(() => F.scriviSicuro(`${vault}/.lode/dati.json`, JSON.stringify(d))); return;
      }
      if (motore.bloccato) throw new Error('dati bloccati');
      salvaBarra(D => applicaOp(D, op));
      if (TOCCA_ORARIO.has(op.tipo)) scriviOrario();
    },
    vista() {
      if (!motore) return (!C(() => SY.attiva(vault)) && leggiDati()) || { bloccato: true, motivo: 'sincronizzazione non accesa, niente dati.json' };
      if (motore.bloccato) return { bloccato: true, motivo: motore.codice || motore.errore || 'password' };
      return structuredClone(C(() => motore.vista()));
    },
    async arrivati() {
      if (!motore) { if (C(() => SY.attiva(vault))) { apriSincronizzazione(); creaOrarioSync(); } return; }
      if (!motore.bloccato && C(() => SY.spenta(vault))) {
        C(() => SY.seguiSpenta({ vault, locale: dati, dispositivo: id, S: motore._stato(), chiavi: [chiave].filter(Boolean), ora: orologio() }));
        C(() => motore.chiudi({ niente: true })); motore = null; return;
      }
      guardaOrario();
      if (!motore) return;
      let cif = null; try { cif = C(() => SY.leggiCifratura(vault)); } catch (x) { if (x?.crash) throw x; }
      if (C(() => SY.cifraturaInArrivo(vault))) { if (!motore.cifrato && !motore.bloccato) { C(() => motore.chiudi({ soloLocale: true })); apriSincronizzazione(); } return; }
      if (!cif && motore.cifrato && !motore.bloccato) { C(() => motore.chiudi({ soloLocale: true })); motore = { bloccato: true, cifrato: true, codice: 'cifratura_sparita' }; return; }
      const altraChiave = !!cif && !!motore.cifrato && !motore.bloccato && !(chiave && C(() => SY.provaChiave(cif, chiave)));
      if ((!!cif !== !!motore.cifrato && !motore.bloccato) || altraChiave) { if (altraChiave) chiave = null; C(() => motore.chiudi({ soloLocale: true })); apriSincronizzazione(); return; }
      if (!motore.bloccato) C(() => { motore.ricarica(); motore.scriviOra(); });
      if (motore && !motore.bloccato && C(() => motore.stato()).conteso) { C(() => motore.scriviOra()); id = nuovoId(); salvaConf({ ...conf(), dispositivo: id }); apriSincronizzazione(); }
    },
    chiudi() { if (motore && !motore.bloccato) C(() => motore.chiudi()); },
    async cifra(password) {
      if (!motore || motore.bloccato) throw new Error('Prima accendi la sincronizzazione.');
      C(() => { motore.ricarica(); motore.scriviOra(); });
      chiave = C(() => SY.accendiCifratura(vault, dati, password, SCRYPT_PROVA));
      C(() => motore.chiudi({ soloLocale: true })); apriSincronizzazione();
      if (motore && !motore.bloccato) C(() => { motore.salva(motore.vista(), null); motore.scriviOra(); });
    },
    async sblocca(password) {
      const cif = C(() => SY.leggiCifratura(vault)); if (!cif) throw new Error('niente cifratura.json');
      chiave = C(() => SY.chiaveDa(cif, password));
      const altre = C(() => SY.chiaviVecchie(vault, dati, password));
      apriSincronizzazione(altre);
    },
    async smetti() {
      if (!motore || motore.bloccato) throw new Error('Prima scrivi la password');
      C(() => SY.smetti({ vault, locale: dati, motore, ora: orologio() }));
      motore = null;
    },
  };
}
