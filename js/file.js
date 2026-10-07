// I file lasciati sulla pillola: che cosa sono e che testo contengono. Senza librerie per Word e PowerPoint (sono zip di
// XML, aperti con DecompressionStream); il testo dei PDF con pdf.js, solo quando serve.
import { libreria } from './librerie.js';
import { t } from './lingua.js';
export const ACCETTATI = t('file.accettati');
const est = n => (String(n).match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();

// → { tipo: 'pdf'|'slide'|'foto'|'audio'|'word'|'testo'|'sbobina'|'carte'|'altro', nome, mb }
export async function classifica(f) {
  const e = est(f.name), mb = f.size / 1048576, base = { nome: f.name, mb, file: f };
  if (f.type === 'application/pdf' || e === 'pdf') return { ...base, tipo: 'pdf' };
  if (e === 'pptx') return { ...base, tipo: 'slide' };
  if (/^image\//.test(f.type) || /^(jpe?g|png|webp|heic|gif)$/.test(e)) return { ...base, tipo: 'foto' };
  if (/^audio\//.test(f.type) || /^(m4a|mp3|wav|aac|ogg|opus|flac|webm)$/.test(e)) return { ...base, tipo: 'audio' };
  if (e === 'docx') return { ...base, tipo: 'word' };
  if (/^(md|markdown|txt|csv|tsv|html?)$/.test(e) || /^text\//.test(f.type)) {
    const testo = await leggiTesto(f);
    if (/^---[\s\S]*?\btipo:\s*sbobina\b/.test(testo) || /<meta name="lode-sbobina"/.test(testo)) return { ...base, tipo: 'sbobina', testo };
    if (/^(csv|tsv|txt)$/.test(e) && testo.split(/\r?\n/).filter(r => /\t|;| = /.test(r)).length >= 3 && testo.split(/\r?\n/).length < 5000) return { ...base, tipo: 'carte', testo };
    return { ...base, tipo: 'testo', testo };
  }
  if (['doc', 'ppt', 'key', 'pages', 'odt', 'odp'].includes(e)) return { ...base, tipo: 'altro', motivo: t('file.formato-da-salvare', { e }) };
  return { ...base, tipo: 'altro', motivo: e ? t('file.formato-non-si-legge', { e }) : t('file.formato-di-questo-file') };
}

/* ---------- il testo dentro i file ---------- */
// CSV e TXT di Excel o del Blocco note su Windows italiano: spesso non sono UTF-8 ma Windows-1252 (o UTF-16 «Unicode»)
export async function leggiTesto(f) {
  const b = new Uint8Array(await f.arrayBuffer());
  if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b);
  if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }   // toglie anche il BOM
  catch { return new TextDecoder('windows-1252').decode(b); }           // byte non UTF-8 (à, è, ù di un file ANSI)
}
export async function testoDi(x) {
  if (x.testo != null) return x.testo;
  if (x.tipo === 'word') return x.testo = await daWord(x.file);
  if (x.tipo === 'slide') return x.testo = await daSlide(x.file);
  if (x.tipo === 'pdf') return x.testo = await daPdf(x.file);
  throw new Error(t('file.senza-testo'));
}
let PDFJS = null;
async function daPdf(f) {
  PDFJS ||= await import(libreria('pdf'));   // versione esatta: nell'app dal disco (vendor/), nel browser da jsDelivr
  PDFJS.GlobalWorkerOptions.workerSrc ||= libreria('pdfWorker');
  const doc = await PDFJS.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise, out = [];   // niente eval in pdf.js: la CSP lo vieta
  for (let i = 1; i <= Math.min(doc.numPages, 300); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    const t = c.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim();
    if (t) out.push(`[Pagina ${i}]\n${t}`);
  }
  if (!out.length) throw new Error(t('file.pdf-scansione'));
  return out.join('\n\n');
}
async function apriZip(file) {
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer);
  let fine = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { fine = i; break; }
  if (fine < 0) throw new Error(t('file.danneggiato'));
  const n = dv.getUint16(fine + 10, true); let p = dv.getUint32(fine + 16, true);
  const voci = new Map(), dec = new TextDecoder();
  for (let k = 0; k < n && dv.getUint32(p, true) === 0x02014b50; k++) {
    const metodo = dv.getUint16(p + 10, true), dim = dv.getUint32(p + 20, true), ln = dv.getUint16(p + 28, true), lx = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), loc = dv.getUint32(p + 42, true);
    voci.set(dec.decode(buf.subarray(p + 46, p + 46 + ln)), { metodo, dim, loc });
    p += 46 + ln + lx + lc;
  }
  const leggi = async nome => {
    const v = voci.get(nome); if (!v) return null;
    const ini = v.loc + 30 + dv.getUint16(v.loc + 26, true) + dv.getUint16(v.loc + 28, true), dati = buf.subarray(ini, ini + v.dim);
    if (v.metodo === 0) return dec.decode(dati);
    if (v.metodo !== 8) throw new Error(t('file.compressione'));
    return new Response(new Blob([dati]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  };
  leggi.nomi = [...voci.keys()];
  return leggi;
}
const xml = s => new DOMParser().parseFromString(s, 'application/xml');
const tutti = (n, tag) => [...n.getElementsByTagNameNS('*', tag)];
async function daWord(f) {
  const leggi = await apriZip(f), s = await leggi('word/document.xml');
  if (!s) throw new Error(t('file.word-illeggibile'));
  const righe = tutti(xml(s), 'p').map(p => tutti(p, 't').map(x => x.textContent).join('')).filter(t => t.trim());
  if (!righe.length) throw new Error(t('file.documento-vuoto'));
  return righe.join('\n');
}
// PowerPoint: una sezione per slide, nell'ordine, con il titolo e i punti
async function daSlide(f) {
  const leggi = await apriZip(f);
  const slide = leggi.nomi.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  const out = [];
  for (const [i, n] of slide.entries()) {
    const righe = tutti(xml(await leggi(n)), 'p').map(p => tutti(p, 't').map(x => x.textContent).join('')).filter(t => t.trim());
    if (righe.length) out.push(`[Slide ${i + 1}] ${righe[0]}\n${righe.slice(1).map(r => '- ' + r).join('\n')}`);
  }
  if (!out.length) throw new Error(t('file.slide-senza-testo'));
  return out.join('\n\n');
}

/* ---------- le registrazioni audio: decodifica e porta a 16 kHz mono per Whisper ---------- */
export async function audioDi(f) {
  const dati = await f.arrayBuffer(), c = new AudioContext();
  const b = await c.decodeAudioData(dati).finally(() => c.close());
  const off = new OfflineAudioContext(1, Math.ceil(b.duration * 16000), 16000), s = off.createBufferSource();
  s.buffer = b; s.connect(off.destination); s.start();
  return (await off.startRendering()).getChannelData(0);
}
export async function base64(f) {
  const buf = new Uint8Array(await f.arrayBuffer()); let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
