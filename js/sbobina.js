// Le sbobine: la lezione trascritta e riordinata, pronta da passare ai compagni (AirDrop, WhatsApp, mail, Drive).
// Due file nella cartella «Sbobine» del vault: un .md per chi usa Obsidian e una pagina .html che si apre ovunque, anche
// sul telefono, con le formule già disegnate (LaTeX → MathML). Dentro l'HTML c'è anche il Markdown: chi la riceve la
// trascina sulla sua pillola di Lode e se la ritrova nel vault, con definizioni e ★ pronte per i giochi.
// Restano fuori gli appunti personali e le domande per il prof.
import { frontmatter, sezioni, SEZIONI, pulito } from './markdown.js';

const SEZ_CONDIVISE = [SEZIONI.riordinati, SEZIONI.stella, SEZIONI.definizione, SEZIONI.trascrizione];
const norm = s => s.replace(/[^\p{L}]/gu, '').toLowerCase();
const DATA = iso => new Date(iso + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function crea(testoNota, { autore = '' } = {}) {
  const { fm, corpo } = frontmatter(testoNota), sez = sezioni(corpo.replace(/%%[\s\S]*?%%/g, ''));
  const corso = (fm.corso || '').replace(/^\[\[|\]\]$/g, ''), data = fm.data;
  const parti = SEZ_CONDIVISE.map(nome => { const k = Object.keys(sez).find(x => norm(x) === norm(nome)); const t = k ? sez[k].join('\n').trim() : ''; return t ? `## ${nome}\n${t}` : ''; }).filter(Boolean);
  if (!parti.length) throw new Error('la lezione non ha ancora trascrizione, appunti riordinati o definizioni da condividere');
  const md = `---
tipo: sbobina
corso: "${pulito(corso)}"
data: ${data}
${fm.ora ? `ora: "${fm.ora}"\n` : ''}${autore ? `da: "${String(autore).replace(/"/g, '')}"\n` : ''}fatta_con: Lode
---
# ${pulito(corso)} · sbobina del ${DATA(data)}

${parti.join('\n\n')}
`;
  return { md, nome: `${data} ${pulito(corso)} · sbobina`, corso, data };
}

/* ---------- la pagina HTML: Markdown essenziale + formule in MathML ---------- */
let TEMML = null;
async function formula(tex, blocco) {
  TEMML ||= (await import('https://cdn.jsdelivr.net/npm/temml@0.11/dist/temml.mjs')).default;
  try { return TEMML.renderToString(tex, { displayMode: blocco, throwOnError: false }); } catch { return `<code>${esc(tex)}</code>`; }
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
async function riga(t) {
  const pezzi = String(t).split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/), out = [];
  for (const p of pezzi) {
    if (/^\$\$[\s\S]+\$\$$/.test(p)) out.push(await formula(p.slice(2, -2), true));
    else if (/^\$[^$]+\$$/.test(p)) out.push(await formula(p.slice(1, -1), false));
    else out.push(esc(p).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>'));
  }
  return out.join('');
}
// Markdown essenziale (titoli, elenchi, paragrafi) con le formule in MathML: per la pagina della sbobina e per le
// anteprime nella barra (la foto della lavagna trascritta: formule disegnate, non LaTeX grezzo)
export async function corpoHtml(testo) {
  const corpo = String(testo).split(/\r?\n/), out = [];
  let lista = false;
  for (const r of corpo) {
    const h = r.match(/^(#{1,3})\s+(.*)$/), li = r.match(/^\s*[-*]\s+(.*)$/);
    if (!li && lista) { out.push('</ul>'); lista = false; }
    if (h) out.push(`<h${h[1].length}>${await riga(h[2])}</h${h[1].length}>`);
    else if (li) { if (!lista) { out.push('<ul>'); lista = true; } out.push(`<li>${await riga(li[1])}</li>`); }
    else if (r.trim()) out.push(`<p>${await riga(r)}</p>`);
  }
  if (lista) out.push('</ul>');
  return out.join('\n');
}
export async function html({ md, corso, data }) {
  const corpo = await corpoHtml(frontmatter(md).corpo);
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="lode-sbobina" content="1"><title>${esc(pulito(corso))} · sbobina del ${esc(data)}</title>
<style>
:root{color-scheme:light dark;--bg:#fafafa;--ink:#0a0a0a;--muted:#5e5e5e;--line:#e6e6e6}
@media (prefers-color-scheme:dark){:root{--bg:#0a0a0a;--ink:#f5f5f5;--muted:#a1a1a1;--line:#262626}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,"Segoe UI",system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:40px 20px 80px}
h1{font-size:30px;line-height:1.15;letter-spacing:-.03em;margin:0 0 6px}
h2{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:42px 0 12px;padding-top:18px;border-top:1px solid var(--line)}
h3{font-size:19px;margin:26px 0 6px;letter-spacing:-.02em}
li{margin:4px 0}math{font-size:1.08em}
p b:first-child{font-variant-numeric:tabular-nums;color:var(--muted);font-weight:600}
footer{margin-top:60px;font-size:13px;color:var(--muted)}
</style></head><body><main>
${corpo}
<footer>Fatta con Lode, l'assistente di studio open source. Hai Lode? Trascina questo file sulla pillola in alto e la ritrovi nel tuo vault Obsidian.</footer>
</main>
<script type="text/markdown" id="lode-md">${md.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`;
}

/* ---------- ricevere una sbobina ---------- */
export function leggi(testo) {
  let md = testo;
  const m = String(testo).match(/<script type="text\/markdown" id="lode-md">([\s\S]*?)<\/script>/);
  if (m) md = m[1].replace(/<\\\/script/gi, '</script');
  const { fm } = frontmatter(md);
  if (fm.tipo !== 'sbobina' || !fm.corso || !/^\d{4}-\d\d-\d\d$/.test(fm.data || '')) throw new Error('non è una sbobina di Lode');
  // nel vault diventa una lezione (così definizioni e ★ entrano nei giochi), segnata come sbobina ricevuta
  const nota = md.replace(/^---\r?\n/, `---\n`).replace(/\btipo:\s*sbobina\b/, 'tipo: lezione\nsbobina: ricevuta').replace(/^corso:\s*"?([^"\n]+)"?$/m, (_, c) => `corso: "[[${c.replace(/^\[\[|\]\]$/g, '')}]]"`);
  return { corso: fm.corso.replace(/^\[\[|\]\]$/g, ''), data: fm.data, da: fm.da || '', nota };
}
