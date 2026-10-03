// La cifratura (docs/SINCRONIZZAZIONE.md §10.2): scrypt asincrono con parametri ESATTI, AES-256-GCM con nonce nuovo a ogni
// scrittura e AAD obbligatorio, codici distinti per «password sbagliata» e «rovinato o manomesso» (⊕8).
import { scrypt, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

export const KDF = { kdf: 'scrypt', N: 2 ** 17, r: 8, p: 1 };
const CONTROLLO = 'Lode 2: la password apre questo gruppo';

// la chiave da password e sale. parametri: quelli che questo programma accetta (le prove ne usano di leggeri, passati al
// motore); un gruppo.json con parametri diversi si rifiuta (#24)
export function stessiParametri(c, parametri) {
  return !!c && c.kdf === 'scrypt' && c.N === parametri.N && c.r === parametri.r && c.p === parametri.p && typeof c.sale === 'string' && /^[0-9a-f]{32}$/.test(c.sale);
}
export function deriva(password, saleHex, parametri) {
  return new Promise((si, no) => scrypt(String(password).normalize('NFC'), Buffer.from(saleHex, 'hex'), 32,
    { N: parametri.N, r: parametri.r, p: parametri.p, maxmem: 256 * parametri.N * parametri.r + 1024 * 1024 }, (x, k) => (x ? no(x) : si(k))));
}
// testo → «nonce.cifrato.tag» in base64url; aad: testo (gruppo|dev|n per i contenitori)
export function chiudi(chiave, testo, aad) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', chiave, iv);
  c.setAAD(Buffer.from(aad, 'utf8'));
  const dati = Buffer.concat([c.update(Buffer.from(testo, 'utf8')), c.final()]);
  return [iv, dati, c.getAuthTag()].map(b => b.toString('base64url')).join('.');
}
// null se non si apre (chiave diversa, file rovinato o manomesso: GCM non distingue, il chiamante sì col controllo)
export function apri(chiave, blocco, aad) {
  try {
    const [iv, dati, tag] = String(blocco).trim().split('.').map(x => Buffer.from(x, 'base64url'));
    if (!iv || iv.length !== 12 || !tag || tag.length !== 16) return null;
    const d = createDecipheriv('aes-256-gcm', chiave, iv);
    d.setAAD(Buffer.from(aad, 'utf8')); d.setAuthTag(tag);
    return Buffer.concat([d.update(dati), d.final()]).toString('utf8');
  } catch { return null; }
}
// la cifratura di un gruppo nuovo: sale e controllo (la frase fissa cifrata, con l'id del gruppo come AAD)
export async function nuovaCifratura(password, gruppo, parametri, casuale16) {
  const sale = casuale16(), chiave = await deriva(password, sale, parametri);
  return { cifratura: { kdf: 'scrypt', N: parametri.N, r: parametri.r, p: parametri.p, sale, controllo: chiudi(chiave, CONTROLLO, `controllo|${gruppo}`) }, chiave };
}
// la password apre questo gruppo? → { chiave } | { codice: 'chiave_sbagliata' | 'parametri' }
// derivate (facoltativa): sale → chiave, per un solo tentativo di password: lo stesso sale si deriva una volta sola (§10.2)
export async function provaPassword(password, gruppo, cifratura, parametri, derivate = null) {
  if (!stessiParametri(cifratura, parametri)) return { codice: 'parametri' };
  if (derivate && !derivate.has(cifratura.sale)) derivate.set(cifratura.sale, deriva(password, cifratura.sale, parametri));
  const chiave = derivate ? await derivate.get(cifratura.sale) : await deriva(password, cifratura.sale, parametri);
  const t = apri(chiave, cifratura.controllo, `controllo|${gruppo}`);
  return t != null && timingSafeEqual(Buffer.from(t), Buffer.from(CONTROLLO)) ? { chiave } : { codice: 'chiave_sbagliata' };
}
