// Il servizio cloud «dispettoso»: porta i file del vault da un computer all'altro come fanno iCloud Drive, OneDrive, Dropbox,
// Google Drive e Syncthing, compresi i loro difetti. Non c'è un ordine garantito: il mondo (mondo.mjs) decide passo per passo
// cosa caricare e cosa consegnare, e a chi.
//
// Il modello:
// - un «server» con l'ultima versione di ogni file (relativo alla cartella del vault) e la cronologia di tutto quello che è
//   stato caricato (i servizi la tengono per settimane: serve alla prova sulla cifratura);
// - per ogni computer: la versione del server da cui parte ogni suo file (base), i file cambiati sul disco e non ancora caricati
//   (sporchi), i file in arrivo (l'ultima versione del server che non ha ancora), i segnaposto;
// - carica: un file sporco va sul server. Se il server è cambiato da quando questo computer l'aveva (base), è un conflitto:
//   uno dei due contenuti resta col nome, l'altro diventa una copia col nome che dà quel servizio («x 2.json», «x (PC's
//   conflicted copy …).json», «x-PC.json», «x (1).json», «x.sync-conflict-…»). Una cancellazione contro una modifica perde
//   (il file torna), come fanno i servizi veri;
// - consegna: l'ultima versione arriva sul disco, intera, a metà (chi legge vede l'inizio del file: poi arriva il resto) o come
//   segnaposto di iCloud (.x.icloud al posto del file, finché non si scarica). Un file cambiato qui e non ancora caricato non
//   si sovrascrive: prima si carica (e diventa un conflitto);
// - togli: il servizio libera spazio, il file diventa un segnaposto (iCloud «Ottimizza spazio», OneDrive «solo online»);
// - le rinomine arrivano come una cancellazione e una creazione, ognuna per conto suo (in qualunque ordine);
// - un computer spento o senza rete non carica e non riceve niente.
const pad = n => String(n).padStart(2, '0');
export const SERVIZI = ['icloud', 'dropbox', 'onedrive', 'gdrive', 'syncthing'];

export function nomeConflitto(rel, { servizio, pc, n = 2, ora = 0 }) {
  const i = rel.lastIndexOf('/'), dir = i >= 0 ? rel.slice(0, i + 1) : '', nome = rel.slice(i + 1);
  const j = nome.lastIndexOf('.'), base = j > 0 ? nome.slice(0, j) : nome, est = j > 0 ? nome.slice(j) : '';
  const d = new Date(ora || 0), giorno = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const PC = String(pc).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PC';
  switch (servizio) {
    case 'icloud': return `${dir}${base} ${n}${est}`;
    case 'dropbox': return `${dir}${base} (${PC}'s conflicted copy ${giorno}${n > 2 ? ` (${n - 1})` : ''})${est}`;
    case 'onedrive': return `${dir}${base}-${PC}${n > 2 ? `-${n - 1}` : ''}${est}`;
    case 'gdrive': return `${dir}${base} (${n - 1})${est}`;
    default: {   // syncthing: x.sync-conflict-AAAAMMGG-hhmmss-IDDISP.ext
      const ora6 = `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
      return `${dir}${base}.sync-conflict-${giorno.replace(/-/g, '')}-${ora6}-${(PC + 'XXXXXXX').slice(0, 7)}${n > 2 ? n : ''}${est}`;
    }
  }
}
export const segnaposto = rel => { const i = rel.lastIndexOf('/'); return `${rel.slice(0, i + 1)}.${rel.slice(i + 1)}.icloud`; };
const eSegnaposto = rel => /(^|\/)\.[^/]+\.icloud$/.test(rel);
const VAULT = 'vault/';

export function creaCloud({ servizio = 'icloud', orologio }) {
  const server = new Map();   // rel → { ver, dati: Buffer | null (cancellato), autore, t }
  const cronologia = [];   // { rel, ver, dati, autore, t }
  const pc = new Map();   // nome → { disco, base: Map, sporchi: Set, inArrivo: Set, segnaposti: Map rel→ver, online }
  let ver = 0;
  const descr = [];   // le ultime cose fatte, per il racconto della storia
  const dì = x => { descr.push(x); if (descr.length > 400) descr.shift(); };

  function aggiungi(nome, disco) {
    const s = { nome, disco, base: new Map(), sporchi: new Set(), inArrivo: new Set(), segnaposti: new Map(), online: true };
    pc.set(nome, s);
    disco.ascolta((p, chi) => {
      if (chi === 'cloud' || !p.startsWith(VAULT)) return;
      const rel = p.slice(VAULT.length);
      if (!eSegnaposto(rel)) s.sporchi.add(rel);
    });
    return s;
  }
  const leggi = (s, rel) => s.disco.crudo.leggi(VAULT + rel);
  const pubblica = (rel, dati, autore) => {
    const v = ++ver, t = orologio();
    server.set(rel, { ver: v, dati, autore, t });
    cronologia.push({ rel, ver: v, dati, autore, t });
    for (const altro of pc.values()) if (altro.nome !== autore) altro.inArrivo.add(rel);
    return v;
  };
  function liberoPer(rel, pcNome) {
    for (let n = 2; n < 50; n++) { const c = nomeConflitto(rel, { servizio, pc: pcNome, n, ora: orologio() }); if (!server.get(c)?.dati) return c; }
    return rel + '.conflitto-' + (ver + 1);
  }

  // carica un file sporco di quel computer. vince: in un conflitto, quale contenuto resta col nome ('server' o 'nuovo')
  function carica(nome, rel, { vince = 'server' } = {}) {
    const s = pc.get(nome); if (!s?.online || !s.sporchi.has(rel)) return null;
    s.sporchi.delete(rel);
    const loc = leggi(s, rel), srv = server.get(rel), base = s.base.get(rel) ?? 0, vSrv = srv?.ver ?? 0;
    // un file con il segnaposto al posto suo non è stato cancellato: è solo tolto dal disco
    if (!loc && s.segnaposti.has(rel)) return null;
    if (!loc && (!srv || !srv.dati)) { if (srv) s.base.set(rel, srv.ver); return null; }
    if (loc && srv?.dati && loc.equals(srv.dati)) { s.base.set(rel, srv.ver); s.inArrivo.delete(rel); return null; }
    if (vSrv === base || !srv?.dati) {
      const v = pubblica(rel, loc, nome); s.base.set(rel, v); s.inArrivo.delete(rel);
      dì(`${nome} carica ${rel}${loc ? '' : ' (cancellato)'}`); return { rel, ver: v };
    }
    // conflitto: il server è cambiato da quando questo computer l'aveva
    if (!loc) { s.inArrivo.add(rel); dì(`${nome}: la cancellazione di ${rel} perde contro una modifica, il file torna`); return { rel, conflitto: 'cancellazione' }; }
    if (vince === 'nuovo') {
      const copia = liberoPer(rel, srv.autore);
      pubblica(copia, srv.dati, srv.autore);
      for (const altro of pc.values()) altro.inArrivo.add(copia);
      const v = pubblica(rel, loc, nome); s.base.set(rel, v); s.inArrivo.delete(rel);
      dì(`${nome} carica ${rel} in conflitto: resta il suo, quello di prima diventa «${copia}»`); return { rel, copia };
    }
    const copia = liberoPer(rel, nome);
    pubblica(copia, loc, nome);
    for (const altro of pc.values()) altro.inArrivo.add(copia);
    s.inArrivo.add(rel);
    dì(`${nome} carica ${rel} in conflitto: resta quello del server, il suo diventa «${copia}»`); return { rel, copia };
  }

  // consegna a quel computer l'ultima versione di rel. modo: 'intero' | 'meta' | 'segnaposto'
  function consegna(nome, rel, { modo = 'intero', frazione = 0.5 } = {}) {
    const s = pc.get(nome); if (!s?.online || !s.inArrivo.has(rel)) return null;
    if (s.sporchi.has(rel)) return { rimandato: true };   // prima si carica il suo: diventerà un conflitto
    const srv = server.get(rel), d = s.disco.crudo, p = VAULT + rel, sp = VAULT + segnaposto(rel);
    if (!srv?.dati) {
      d.togli(p); d.togli(sp); s.segnaposti.delete(rel);
      s.base.set(rel, srv?.ver ?? 0); s.inArrivo.delete(rel); dì(`a ${nome} arriva la cancellazione di ${rel}`); return { rel };
    }
    if (modo === 'segnaposto') {
      d.togli(p); d.scrivi(sp, `bplist00 segnaposto di ${rel}`); s.segnaposti.set(rel, srv.ver);
      s.base.set(rel, srv.ver); s.inArrivo.delete(rel); dì(`a ${nome} arriva ${rel} come segnaposto (.icloud)`); return { rel };
    }
    if (modo === 'meta') {
      const n = Math.max(0, Math.min(srv.dati.length - 1, Math.floor(srv.dati.length * frazione)));
      d.scrivi(p, srv.dati.subarray(0, n)); dì(`a ${nome} arriva ${rel} a metà (${n} di ${srv.dati.length} byte)`); return { rel, meta: true };
    }
    d.scrivi(p, srv.dati); d.togli(sp); s.segnaposti.delete(rel);
    s.base.set(rel, srv.ver); s.inArrivo.delete(rel); dì(`a ${nome} arriva ${rel}`); return { rel };
  }
  // scarica un segnaposto (lo studente apre il file, o il servizio lo riporta sul disco)
  function scarica(nome, rel) {
    const s = pc.get(nome); if (!s?.online || !s.segnaposti.has(rel)) return null;
    const srv = server.get(rel), d = s.disco.crudo;
    d.togli(VAULT + segnaposto(rel)); s.segnaposti.delete(rel);
    if (srv?.dati && !d.esiste(VAULT + rel)) { d.scrivi(VAULT + rel, srv.dati); s.base.set(rel, srv.ver); s.inArrivo.delete(rel); }
    dì(`${nome}: ${rel} riscaricato dal segnaposto`); return { rel };
  }
  // il servizio toglie dal disco un file già caricato (segnaposto al suo posto)
  function togli(nome, rel) {
    const s = pc.get(nome), srv = server.get(rel), loc = s && leggi(s, rel);
    if (!s || !loc || s.sporchi.has(rel) || !srv?.dati || !loc.equals(srv.dati)) return null;
    s.disco.crudo.togli(VAULT + rel); s.disco.crudo.scrivi(VAULT + segnaposto(rel), `bplist00 segnaposto di ${rel}`); s.segnaposti.set(rel, srv.ver);
    dì(`${nome}: il servizio toglie ${rel} dal disco (segnaposto)`); return { rel };
  }

  const ordinati = x => [...x].sort();
  return {
    servizio, server, cronologia, pc, aggiungi, carica, consegna, scarica, togli, descr,
    sporchi: n => ordinati(pc.get(n)?.sporchi || []),
    inArrivo: n => ordinati(pc.get(n)?.inArrivo || []),
    segnaposti: n => ordinati(pc.get(n)?.segnaposti.keys() || []),
    online: (n, si) => { const s = pc.get(n); if (s) s.online = si; },
    // tutto quello che c'è sul server adesso (i file non cancellati)
    contenuto: () => [...server].filter(([, x]) => x.dati).map(([rel, x]) => ({ rel, dati: x.dati, autore: x.autore, t: x.t })),
  };
}
