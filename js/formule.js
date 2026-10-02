// Le formule dette a voce diventano LaTeX, che Obsidian mostra come formule vere ($…$).
// «l'integrale da zero a pi greco di seno di x in d x» → $\int_{0}^{\pi} \sin x \, dx$
// «x al quadrato più due x più uno» → $x^{2} + 2 x + 1$
// Funziona senza AI, subito, mentre la lezione viene trascritta. Non può capire tutto: alla fine della lezione
// «Riordina» (con il modello locale o Claude) sistema ciò che resta ambiguo.
import { numeri } from './comandi.js';

const GRECHE = { alfa: 'alpha', alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', epsilon: 'varepsilon', zeta: 'zeta', eta: 'eta', theta: 'theta', teta: 'theta', iota: 'iota', kappa: 'kappa', lambda: 'lambda', lamda: 'lambda', mu: 'mu', mi: 'mu', nu: 'nu', ni: 'nu', xi: 'xi', csi: 'xi', rho: 'rho', ro: 'rho', sigma: 'sigma', tau: 'tau', phi: 'varphi', fi: 'varphi', chi: 'chi', psi: 'psi', omega: 'omega' };
const FUNZIONI = [['arcotangente', '\\arctan'], ['arcoseno', '\\arcsin'], ['arcocoseno', '\\arccos'], ['seno iperbolico', '\\sinh'], ['coseno iperbolico', '\\cosh'], ['seno', '\\sin'], ['coseno', '\\cos'], ['cotangente', '\\cot'], ['tangente', '\\tan'], ['logaritmo naturale', '\\ln'], ['logaritmo', '\\log'], ['log', '\\log']];

export function parlatoInFormule(testo) {
  const L = [];   // pezzi di LaTeX, richiamati nel testo con un segnaposto
  const P = latex => { L.push(latex); return ` \u0001${L.length - 1}\u0002 `; };
  const X = s => String(s).replace(/\u0001(\d+)\u0002/g, (_, i) => X(L[+i])).replace(/\s+/g, ' ').trim();   // segnaposto → LaTeX
  const A = String.raw`(?:\u0001\d+\u0002|\b[a-zA-Z]\b|\b\d+(?:[.,]\d+)?\b)`;   // un «atomo»: lettera, numero o pezzo già convertito
  const g = r => new RegExp(r, 'gi');
  // come scrive Whisper: «x²», «2x», «in dx», «frattotre», «p greco» → forma parlata, poi si converte tutto allo stesso modo
  const whisper = s => s.replace(/²/g, ' al quadrato').replace(/³/g, ' al cubo').replace(/\b(\d+)([a-zA-Z])\b/g, '$1 $2')
    .replace(/\bfratto(?:t(?=\s|$))?([a-zàèéìòù]*)/gi, (_, r) => 'fratto ' + r).replace(/\b(?:p|pi|pie)\s*greco\b|\bpigreco\b/gi, 'pi greco')
    .replace(/\bin\s+d([a-z])\b/gi, 'in d $1').replace(/\bal\s+esame\b/gi, "all'esame");
  let t = ' ' + numeri(whisper(String(testo)).replace(/\bzero\b/gi, '0')).replace(/([.,;:!?])(?=\s|$)/g, ' $1') + ' ';

  // 1. simboli
  t = t.replace(g(String.raw`\bpi\s?greco\b`), () => P('\\pi'));
  t = t.replace(g(String.raw`\b(?:più|meno)?\s*infinito\b`), m => P((/^\s*meno/i.test(m) ? '-' : /^\s*più/i.test(m) ? '+' : '') + '\\infty'));
  t = t.replace(g(String.raw`\b(delta|sigma|gamma|omega|lambda|phi|fi|psi|theta|teta) maiuscol[oa]\b`), (_, l) => P('\\' + GRECHE[l.toLowerCase()].replace('var', '').replace(/^./, c => c.toUpperCase())));
  t = t.replace(g(String.raw`\b(${Object.keys(GRECHE).join('|')})\b(?!\s+(?:di|del)\s+[a-z]{4,})`), (m, l) => /^(mi|ni|chi|eta|ro|fi)$/i.test(l) ? m : P('\\' + GRECHE[l.toLowerCase()]));
  // 2. funzioni: «seno di x», «f di x», «f primo di x», «e alla x»
  for (const [n, f] of FUNZIONI) t = t.replace(g(String.raw`\b${n}\s+(?:di\s+)?(${A})`), (_, a) => P(`${f} ${X(a)}`));
  t = t.replace(g(String.raw`\besponenziale\s+di\s+(${A})`), (_, a) => P(`e^{${X(a)}}`));
  t = t.replace(g(String.raw`\b([fghuvy])\s+(primo|secondo)?\s*di\s+(${A})(?:\s*,\s*(${A}))?`), (_, f, p, a, b) => P(`${f}${p ? (p.toLowerCase() === 'primo' ? "'" : "''") : ''}(${X(a)}${b ? ', ' + X(b) : ''})`));
  t = t.replace(g(String.raw`\b(${A})\s+(primo|secondo)\b`), (_, a, p) => P(`${X(a)}${p.toLowerCase() === 'primo' ? "'" : "''"}`));
  // 3. potenze e pedici
  for (let k = 0; k < 2; k++) {
    t = t.replace(g(String.raw`\b(${A})\s+al\s+quadrato\b`), (_, a) => P(`${X(a)}^{2}`));
    t = t.replace(g(String.raw`\b(${A})\s+al\s+cubo\b`), (_, a) => P(`${X(a)}^{3}`));
    t = t.replace(g(String.raw`\b(${A})\s+(?:alla|elevat[oa]\s+(?:alla|a))\s+(meno\s+)?(${A}|seconda|terza|quarta|ennesima)`), (_, a, m, b) => P(`${X(a)}^{${m ? '-' : ''}${({ seconda: 2, terza: 3, quarta: 4, ennesima: 'n' })[b.toLowerCase?.()] ?? X(b)}}`));
    t = t.replace(g(String.raw`\b([a-zA-Z])\s+(?:con\s+)?(?:pedice|indice|sub)\s+(${A})`), (_, a, b) => P(`${a}_{${X(b)}}`));
  }
  // 4. radici, modulo, vettori, gradiente
  t = t.replace(g(String.raw`\bradice\s+quadrata\s+di\s+(${A})`), (_, a) => P(`\\sqrt{${X(a)}}`));
  t = t.replace(g(String.raw`\bradice\s+(?:cubica|terza)\s+di\s+(${A})`), (_, a) => P(`\\sqrt[3]{${X(a)}}`));
  t = t.replace(g(String.raw`\bradice\s+di\s+(${A})`), (_, a) => P(`\\sqrt{${X(a)}}`));
  t = t.replace(g(String.raw`\b(?:modulo|valore\s+assoluto)\s+di\s+(${A})`), (_, a) => P(`|${X(a)}|`));
  t = t.replace(g(String.raw`\bnorma\s+di\s+(${A})`), (_, a) => P(`\\|${X(a)}\\|`));
  t = t.replace(g(String.raw`\b(?:gradiente|nabla)\s+(?:di\s+)?(${A})`), (_, a) => P(`\\nabla ${X(a)}`));
  t = t.replace(g(String.raw`\bvettore\s+([a-zA-Z])\b`), (_, a) => P(`\\vec{${a}}`));
  // 5. derivate
  t = t.replace(g(String.raw`\bderivata\s+parziale\s+(?:di\s+)?(${A})\s+rispetto\s+a\s+(${A})`), (_, f, x) => 'derivata parziale ' + P(`\\frac{\\partial ${X(f)}}{\\partial ${X(x)}}`));
  t = t.replace(g(String.raw`\bderivata\s+seconda\s+(?:di\s+)?(${A})\s+rispetto\s+a\s+(${A})`), (_, f, x) => 'derivata seconda ' + P(`\\frac{d^{2} ${X(f)}}{d ${X(x)}^{2}}`));
  t = t.replace(g(String.raw`\bderivata\s+(?:prima\s+)?(?:di\s+)?(${A})\s+rispetto\s+a\s+(${A})`), (_, f, x) => 'derivata ' + P(`\\frac{d ${X(f)}}{d ${X(x)}}`));
  // 6. frazioni
  for (let k = 0; k < 2; k++) t = t.replace(g(String.raw`(${A})\s+(?:fratto|diviso)\s+(${A})`), (_, a, b) => P(`\\frac{${X(a)}}{${X(b)}}`));
  // 7. grandi operatori: integrali, limiti, sommatorie
  t = t.replace(g(String.raw`\bintegrale\s+(?:definito\s+)?(?:da|tra)\s+(${A})\s+(?:a|e)\s+(${A})\s+(?:di\s+)?`), (_, a, b) => 'integrale ' + P(`\\int_{${X(a)}}^{${X(b)}}`));
  // «integrale doppio» da solo è un nome, non una formula: il simbolo solo con «su D» o «di f»
  t = t.replace(g(String.raw`\bintegrale\s+doppio\s+(?:su\s+([a-zA-Z])\s+(?:di\s+)?|di\s+(?!linea\b|superficie\b))`), (_, d) => 'integrale doppio ' + P(d ? `\\iint_{${d}}` : '\\iint'));
  // «integrale di linea / di superficie / di Riemann…» sono nomi: restano parole
  t = t.replace(g(String.raw`\bintegrale\s+(?:indefinito\s+)?di\s+(?!linea\b|superficie\b|flusso\b|volume\b|riemann\b|lebesgue\b|cauchy\b)`), () => 'integrale ' + P('\\int'));
  t = t.replace(g(String.raw`\b(?:in\s+)?d[e]?\s+([a-z])\b(?=\s|$|[.,;])`), (m, x) => /^\s*(?:in\s+)?d[e]?\s/i.test(m) ? P(`\\, d${x}`) : m);
  t = t.replace(g(String.raw`\blimite\s+per\s+([a-z])\s+che\s+tende\s+a\s+(${A})(?:\s+di)?`), (_, x, a) => 'limite ' + P(`\\lim_{${x} \\to ${X(a)}}`));
  t = t.replace(g(String.raw`\b(sommatoria|somma|produttoria)\s+per\s+([a-z])\s+che\s+va\s+da\s+(${A})\s+a\s+(${A})(?:\s+di)?`), (_, s, n, a, b) => s + ' ' + P(`${/prod/i.test(s) ? '\\prod' : '\\sum'}_{${n}=${X(a)}}^{${X(b)}}`));
  // 8. relazioni e logica
  const R = [[String.raw`minore\s+o\s+uguale\s+(?:a|di)`, '\\le'], [String.raw`maggiore\s+o\s+uguale\s+(?:a|di)`, '\\ge'], [String.raw`(?:è\s+)?minore\s+di`, '<'], [String.raw`(?:è\s+)?maggiore\s+di`, '>'],
    [String.raw`diverso\s+da`, '\\neq'], [String.raw`circa\s+uguale\s+a`, '\\approx'], [String.raw`se\s+e\s+solo\s+se`, '\\iff'], [String.raw`appartiene\s+a`, '\\in'], [String.raw`non\s+appartiene\s+a`, '\\notin'],
    [String.raw`per\s+ogni`, '\\forall'], [String.raw`esiste`, '\\exists'], [String.raw`più\s+o\s+meno`, '\\pm'], [String.raw`tende\s+a`, '\\to'], [String.raw`implica`, '\\Rightarrow']];
  for (const [r, l] of R) t = t.replace(g(String.raw`(?<=\s)${r}(?=\s)`), () => P(l));

  // 9. le formule si uniscono: segnaposto, lettere, numeri e operatori vicini diventano un solo $…$
  const parole = t.split(/\s+/).filter(Boolean);
  const segno = w => ({ 'più': '+', 'piu': '+', 'meno': '-', 'uguale': '=', 'per': '\\cdot', 'virgola': ',' })[w.toLowerCase()];
  const atomo = w => /^\u0001\d+\u0002$/.test(w) || /^\d+(?:[.,]\d+)?$/.test(w) || /^[b-df-hj-np-tv-zB-DF-HJ-NP-TV-Z]$/.test(w) || /^[=+\-<>()]$/.test(w);
  const out = []; let i = 0;
  while (i < parole.length) {
    if (!atomo(parole[i])) { out.push(parole[i]); i++; continue; }
    let j = i, pezzi = [], formula = false;
    while (j < parole.length) {
      const w = parole[j];
      if (atomo(w)) { pezzi.push(w); if (/\u0001/.test(w) || /^[=+\-<>]$/.test(w)) formula = true; j++; continue; }
      const s = segno(w.replace(/^uguale$/i, 'uguale'));
      if (s && j + 1 < parole.length && atomo(parole[j + 1]) && pezzi.length) { pezzi.push(s); formula = true; j++; continue; }
      if (/^uguale$/i.test(w) && parole[j + 1] && /^a$/i.test(parole[j + 1]) && atomo(parole[j + 2] || '') && pezzi.length) { pezzi.push('='); formula = true; j += 2; continue; }
      break;
    }
    if (formula) out.push('$' + X(pezzi.join(' ')).replace(/\s+([,)])/g, '$1').replace(/\(\s+/g, '(') + '$');
    else out.push(...pezzi.map(p => X(p)));
    i = j;
  }
  return out.join(' ').replace(/\s+([.,;:!?])/g, '$1').replace(/\$\s*\$/g, ' ')
    .replace(/\\, d([a-z])\$\s+d\s?([a-z])\b/g, '\\, d$1 \\, d$2$')   // «in dx dy»: anche il secondo differenziale nella formula
    .trim();
}
