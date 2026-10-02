// Le librerie di altri che la barra carica solo quando servono: pdf.js (PDF), Temml (formule), transformers.js (Whisper).
// Sempre con la versione esatta, la stessa di desktop/package.json (test/unita.mjs controlla che coincidano).
// • Nell'app: file locali in vendor/, copiati da desktop/node_modules (desktop/vendor.mjs). Niente codice dalla rete: la
//   Content-Security-Policy dell'app accetta script solo da qui.
// • Nel browser (la versione web, servita da una cartella senza node_modules): da jsDelivr con la stessa versione esatta.
//   I moduli hanno anche l'impronta (integrity) nell'import map di index.html: il browser che la conosce rifiuta un file
//   cambiato. Il worker di pdf.js non passa dall'import map: lì vale solo la versione esatta.
// Cambiare versione: desktop/package.json (npm install), VERSIONI qui sotto, l'import map e la CSP in index.html.
export const VERSIONI = { 'pdfjs-dist': '4.10.38', temml: '0.11.11', '@huggingface/transformers': '3.8.1' };
const FILE = {
  pdf: ['pdfjs-dist', 'build/pdf.min.mjs'], pdfWorker: ['pdfjs-dist', 'build/pdf.worker.min.mjs'],
  temml: ['temml', 'dist/temml.mjs'],
  transformers: ['@huggingface/transformers', 'dist/transformers.min.js'], onnx: ['@huggingface/transformers', 'dist/'],
};
export const LOCALI = typeof window !== 'undefined' && !!window.lodeDesktop;
export function libreria(nome) {
  const [p, f] = FILE[nome];
  return LOCALI ? new URL(`../vendor/${p}/${f}`, import.meta.url).href : `https://cdn.jsdelivr.net/npm/${p}@${VERSIONI[p]}/${f}`;
}
