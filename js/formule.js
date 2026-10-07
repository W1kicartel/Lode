// Le formule dette a voce diventano LaTeX, che Obsidian mostra come formule vere ($…$).
// «l'integrale da zero a pi greco di seno di x in d x» → $\int_{0}^{\pi} \sin x \, dx$
// «x al quadrato più due x più uno» → $x^{2} + 2 x + 1$
// Funziona senza AI, subito, mentre la lezione viene trascritta. Non può capire tutto: alla fine della lezione
// «Riordina» (con il modello locale o Claude) sistema ciò che resta ambiguo.
// Lingue (docs/LINGUE.md, «La voce e le formule»): italiano e inglese. Ogni lingua ha le sue parole (REGOLE); il resto
// è comune: i segnaposto, gli «atomi» e l'unione finale in un solo $…$. Nelle altre lingue il testo resta com'è.
import { numeri } from './comandi.js';
import { lingua as linguaScelta } from './lingua.js';

const GRECHE = { alfa: 'alpha', alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', epsilon: 'varepsilon', zeta: 'zeta', eta: 'eta', theta: 'theta', teta: 'theta', iota: 'iota', kappa: 'kappa', lambda: 'lambda', lamda: 'lambda', mu: 'mu', mi: 'mu', nu: 'nu', ni: 'nu', xi: 'xi', csi: 'xi', rho: 'rho', ro: 'rho', sigma: 'sigma', tau: 'tau', phi: 'varphi', fi: 'varphi', chi: 'chi', psi: 'psi', omega: 'omega' };
const FUNZIONI = [['arcotangente', '\\arctan'], ['arcoseno', '\\arcsin'], ['arcocoseno', '\\arccos'], ['seno iperbolico', '\\sinh'], ['coseno iperbolico', '\\cosh'], ['seno', '\\sin'], ['coseno', '\\cos'], ['cotangente', '\\cot'], ['tangente', '\\tan'], ['logaritmo naturale', '\\ln'], ['logaritmo', '\\log'], ['log', '\\log']];

// i pezzi di LaTeX si mettono da parte con un segnaposto (\u0001n\u0002) e si rimettono alla fine
function attrezzi() {
  const L = [];
  const P = latex => { L.push(latex); return ` \u0001${L.length - 1}\u0002 `; };
  const X = s => String(s).replace(/\u0001(\d+)\u0002/g, (_, i) => X(L[+i])).replace(/\s+/g, ' ').trim();   // segnaposto → LaTeX
  const A = String.raw`(?:\u0001\d+\u0002|\b[a-zA-Z]\b|\b\d+(?:[.,]\d+)?\b)`;   // un «atomo»: lettera, numero o pezzo già convertito
  const g = r => new RegExp(r, 'gi');
  return { P, X, A, g };
}

// ── italiano ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// come scrive Whisper: «x²», «2x», «in dx», «frattotre», «p greco» → forma parlata, poi si converte tutto allo stesso modo
const whisper = s => s.replace(/²/g, ' al quadrato').replace(/³/g, ' al cubo').replace(/\b(\d+)([a-zA-Z])\b/g, '$1 $2')
  .replace(/\bfratto(?:t(?=\s|$))?([a-zàèéìòù]*)/gi, (_, r) => 'fratto ' + r).replace(/\b(?:p|pi|pie)\s*greco\b|\bpigreco\b/gi, 'pi greco')
  .replace(/\bin\s+d([a-z])\b/gi, 'in d $1').replace(/\bal\s+esame\b/gi, "all'esame");

function italiano(t, { P, X, A, g }) {
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
  return t;
}

// ── inglese ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// «x squared plus two x», «the integral from zero to one of …», «d y over d x», «partial f partial x», «f of x»
const GRECHE_EN = { alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', epsilon: 'varepsilon', zeta: 'zeta', eta: 'eta', theta: 'theta', iota: 'iota', kappa: 'kappa', lambda: 'lambda', mu: 'mu', nu: 'nu', xi: 'xi', pi: 'pi', rho: 'rho', sigma: 'sigma', tau: 'tau', upsilon: 'upsilon', phi: 'varphi', chi: 'chi', psi: 'psi', omega: 'omega' };
const MAIUSCOLE_EN = ['gamma', 'delta', 'theta', 'lambda', 'xi', 'pi', 'sigma', 'upsilon', 'phi', 'psi', 'omega'];   // quelle che in LaTeX hanno la maiuscola
const FUNZIONI_EN = [['arc\\s?tangent', '\\arctan'], ['arctan', '\\arctan'], ['arc\\s?sine', '\\arcsin'], ['arcsin', '\\arcsin'], ['arc\\s?cosine', '\\arccos'], ['arccos', '\\arccos'],
  ['hyperbolic\\s+sine', '\\sinh'], ['hyperbolic\\s+cosine', '\\cosh'], ['sinh', '\\sinh'], ['cosh', '\\cosh'], ['sine', '\\sin'], ['sin', '\\sin'], ['cosine', '\\cos'], ['cos', '\\cos'],
  ['cotangent', '\\cot'], ['cot', '\\cot'], ['tangent', '\\tan'], ['tan', '\\tan'], ['natural\\s+log(?:arithm)?', '\\ln'], ['ln', '\\ln'], ['logarithm', '\\log'], ['log', '\\log']];
const NUMERI_EN = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const DECINE_EN = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ORDINALI_EN = { second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, nth: 'n', 'n-th': 'n', enth: 'n' };
// le parole che, dopo «a» o «I», dicono che è una lettera della formula e non l'articolo o il pronome («a squared», «a to the n»)
const DOPO_LETTERA_EN = 'plus|minus|times|over|divided|squared|cubed|to|raised|equals|equal|is|sub|subscript|prime|double|and|or|comma|less|greater|not|naught|nought|of|in|d';
const UNITA_EN = Object.keys(NUMERI_EN).slice(1, 10).join('|');

// i numeri detti a voce: «twenty one» → 21, «two point five» → 2.5; «one» resta parola in «this one», «one of», «no one»…
function numeriEn(s) {
  s = s.replace(new RegExp(String.raw`\b(${Object.keys(DECINE_EN).join('|')})(?:[\s-]+(${UNITA_EN}))?\b`, 'gi'), (_, d, u) => String(DECINE_EN[d.toLowerCase()] + (u ? NUMERI_EN[u.toLowerCase()] : 0)));
  s = s.replace(/\b(?:a|one)\s+hundred\b/gi, '100');
  s = s.replace(new RegExp(String.raw`\b(${Object.keys(NUMERI_EN).join('|')})\b`, 'gi'), (m, w, i, tutto) => {
    if (/^one$/i.test(w) && (/\b(?:this|that|the|each|every|no|any|which|another|some|only|a|at|last|next|right|wrong|new|old|little|big|such|someone|anyone)\s+$/i.test(tutto.slice(0, i)) || /^\s+(?:of\s+(?:the|these|those|them|us|you|my|our|your|his|her|its|their|which|many|several|an?)\b|another|day|thing|way|more|by\s+one|point(?!\s+(?:\d|zero|one|two|three|four|five|six|seven|eight|nine)\b))\b/i.test(tutto.slice(i + m.length)))) return m;
    return String(NUMERI_EN[w.toLowerCase()]);
  });
  return s.replace(/\b(\d+)\s+point((?:\s+\d)+)\b/gi, (_, a, b) => a + '.' + b.replace(/\s+/g, ''));
}
// come scrive Whisper in inglese: «x²», «2x», «dx», «dy/dx», «x^n», «π»
const whisperEn = s => s.replace(/²/g, ' squared').replace(/³/g, ' cubed').replace(/π/g, ' pi ').replace(/\b(\d+)([a-z])\b/g, '$1 $2')
  .replace(/\b(sinh|cosh|sin|cos|tan|cot|arcsin|arccos|arctan|ln|log|exp|sqrt|[fghuvy])\(\s*([a-z]|\d+)\s*\)/gi, '$1 of $2').replace(/(\w)([+=])(?=\w)/g, '$1 $2 ')
  .replace(/\bd([a-z])\s*\/\s*d([a-z])\b/g, 'd $1 over d $2').replace(/\bd([xyztuv])\b/g, 'd $1').replace(/\^\s*(-?)\s*(\d+|[a-z])\b/gi, (_, m, e) => ` to the ${m ? 'minus ' : ''}${e}`)
  // «a» articolo e «I» pronome non sono lettere della formula: si segnano con «__» (tolto alla fine)
  .replace(new RegExp(String.raw`\b([aAI])(?=\s+(?!(?:${DOPO_LETTERA_EN})\b)[a-z']{2,})`, 'g'), '$1__');

function inglese(t, { P, X, A, g }) {
  const prima = (a, m) => (a === 'I' ? null : a);   // «cos I said»: «I» non è un argomento
  // 1. simboli
  t = t.replace(g(String.raw`\b(?:(plus|minus|negative|positive)\s+)?infinity\b`), (_, s) => P((/^(minus|negative)$/i.test(s || '') ? '-' : /^(plus|positive)$/i.test(s || '') ? '+' : '') + '\\infty'));
  t = t.replace(g(String.raw`\b(?:capital|uppercase|upper\s+case|big)\s+(${MAIUSCOLE_EN.join('|')})\b`), (_, l) => P('\\' + GRECHE_EN[l.toLowerCase()].replace('var', '').replace(/^./, c => c.toUpperCase())));
  t = t.replace(g(String.raw`\b(${Object.keys(GRECHE_EN).join('|')})\b`), (_, l) => P('\\' + GRECHE_EN[l.toLowerCase()]));
  // 2. funzioni: «sine of x», «the log of x», «f of x», «f prime of x», «exponential of x»
  for (const [n, f] of FUNZIONI_EN) t = t.replace(g(String.raw`\b(?:the\s+)?${n}\s+(?:of\s+)?(${A})`), (m, a) => prima(a) ? P(`${f} ${X(a)}`) : m);
  t = t.replace(g(String.raw`\b(?:the\s+)?(?:exponential|exp)\s+of\s+(${A})`), (_, a) => P(`e^{${X(a)}}`));
  t = t.replace(g(String.raw`(?<!\b(?:over|on|in)\s+)\b([fghuvy])\s+(prime|double\s+prime)?\s*of\s+(${A})(?:\s*(?:,|and)\s*(${A})(?!\s+of\b))?`), (_, f, p, a, b) => P(`${f}${p ? (/double/i.test(p) ? "''" : "'") : ''}(${X(a)}${b ? ', ' + X(b) : ''})`));
  t = t.replace(g(String.raw`(${A})\s+(prime|double\s+prime)\b(?!\s+(?:numbers?|factors?|factori[sz]ation|divisors?|ideals?|powers?))`), (_, a, p) => P(`${X(a)}${/double/i.test(p) ? "''" : "'"}`));
  // 3. derivate con la d: «d y over d x», «d squared y over d x squared», «d over d x», «partial f partial x»
  // (prima delle potenze: «x squared» qui è il quadrato della d, non di x)
  t = t.replace(g(String.raw`\bd\s+squared\s+(${A})\s+(?:over|by)\s+d\s+(${A})\s+squared\b`), (_, f, x) => P(`\\frac{d^{2} ${X(f)}}{d ${X(x)}^{2}}`));
  t = t.replace(g(String.raw`\bd\s+(${A})\s+(?:over|by)\s+d\s+(${A})`), (_, f, x) => P(`\\frac{d ${X(f)}}{d ${X(x)}}`));
  t = t.replace(g(String.raw`\bd\s+(?:over|by)\s+d\s+(${A})`), (_, x) => P(`\\frac{d}{d ${X(x)}}`));
  t = t.replace(g(String.raw`\bpartial\s+squared\s+(${A})\s+(?:over\s+|by\s+)?partial\s+(${A})\s+squared\b`), (_, f, x) => P(`\\frac{\\partial^{2} ${X(f)}}{\\partial ${X(x)}^{2}}`));
  t = t.replace(g(String.raw`\bpartial\s+(${A})\s+(?:over\s+|by\s+)?partial\s+(${A})`), (_, f, x) => P(`\\frac{\\partial ${X(f)}}{\\partial ${X(x)}}`));
  // 4. potenze e pedici: «x squared», «x cubed», «x to the n», «x to the power of minus one», «x sub n», «x naught»
  const esponente = String.raw`(?:raised\s+)?to\s+the\s+(?:power\s+(?:of\s+)?)?`;
  for (let k = 0; k < 2; k++) {
    t = t.replace(g(String.raw`(${A})\s+squared\b`), (_, a) => P(`${X(a)}^{2}`));
    t = t.replace(g(String.raw`(${A})\s+cubed\b`), (_, a) => P(`${X(a)}^{3}`));
    t = t.replace(g(String.raw`(${A})\s+${esponente}(minus\s+|negative\s+)?(?:(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|nth|n-th|enth)\b|(\d+)(?:st|nd|rd|th)\b|(${A}))(?:\s+power\b)?`), (_, a, m, o, n, b) => P(`${X(a)}^{${m ? '-' : ''}${o ? ORDINALI_EN[o.toLowerCase()] : n || X(b)}}`));
    t = t.replace(g(String.raw`\b([a-zA-Z])\s+(?:with\s+)?(?:sub|subscript|index)\s+(${A})`), (_, a, b) => P(`${a}_{${X(b)}}`));
    t = t.replace(g(String.raw`\b([a-zA-Z])\s+(?:naught|nought)\b`), (_, a) => P(`${a}_{0}`));
  }
  t = t.replace(g(String.raw`(${A})\s+factorial\b`), (_, a) => P(`${X(a)}!`));
  // 5. radici, valore assoluto, norma, gradiente, vettori
  t = t.replace(g(String.raw`\b(?:the\s+)?(?:square\s+root|sqrt)\s+of\s+(${A})`), (_, a) => P(`\\sqrt{${X(a)}}`));
  t = t.replace(g(String.raw`\b(?:the\s+)?cube\s+root\s+of\s+(${A})`), (_, a) => P(`\\sqrt[3]{${X(a)}}`));
  t = t.replace(g(String.raw`\b(?:the\s+)?(n|\d+)(?:-?th|st|nd|rd)\s+root\s+of\s+(${A})`), (_, n, a) => P(`\\sqrt[${n}]{${X(a)}}`));
  t = t.replace(g(String.raw`\b(?:the\s+)?root\s+of\s+(${A})`), (_, a) => P(`\\sqrt{${X(a)}}`));
  t = t.replace(g(String.raw`\b(?:the\s+)?(?:absolute\s+value|modulus)\s+of\s+(${A})`), (_, a) => P(`|${X(a)}|`));
  t = t.replace(g(String.raw`\b(?:the\s+)?norm\s+of\s+(${A})`), (_, a) => P(`\\|${X(a)}\\|`));
  t = t.replace(g(String.raw`\b(?:the\s+)?(?:gradient|nabla|grad)\s+(?:of\s+)?(${A})`), (_, a) => P(`\\nabla ${X(a)}`));
  t = t.replace(g(String.raw`\b(?:the\s+)?vector\s+([a-zA-Z])\b`), (_, a) => P(`\\vec{${a}}`));
  // 6. derivate a parole: «the derivative of f with respect to x»
  const rispetto = String.raw`(?:with\s+respect\s+to|w\.?r\.?t\.?)`;
  t = t.replace(g(String.raw`\bpartial\s+derivative\s+(?:of\s+)?(${A})\s+${rispetto}\s+(${A})`), (_, f, x) => 'partial derivative ' + P(`\\frac{\\partial ${X(f)}}{\\partial ${X(x)}}`));
  t = t.replace(g(String.raw`\bsecond\s+derivative\s+(?:of\s+)?(${A})\s+${rispetto}\s+(${A})`), (_, f, x) => 'second derivative ' + P(`\\frac{d^{2} ${X(f)}}{d ${X(x)}^{2}}`));
  t = t.replace(g(String.raw`\b(first\s+)?derivative\s+(?:of\s+)?(${A})\s+${rispetto}\s+(${A})`), (_, p, f, x) => (p ? 'first ' : '') + 'derivative ' + P(`\\frac{d ${X(f)}}{d ${X(x)}}`));
  // 7. frazioni: «x over two», «a divided by b», «one third»
  for (let k = 0; k < 2; k++) t = t.replace(g(String.raw`(${A})\s+(?:over|divided\s+by)\s+(${A})`), (_, a, b) => P(`\\frac{${X(a)}}{${X(b)}}`));
  t = t.replace(g(String.raw`\b(\d+)\s+(halves|half|thirds?|quarters?|fourths?|fifths?)\b`), (_, a, b) => P(`\\frac{${a}}{${({ h: 2, t: 3, q: 4, fo: 4, fi: 5 })[b.toLowerCase().slice(0, /^f/i.test(b) ? 2 : 1)]}}`));
  // 8. grandi operatori: integrali, limiti, sommatorie
  t = t.replace(g(String.raw`\bintegral\s+of\s+(${A})\s+(?:from|between)\s+(${A})\s+(?:to|and)\s+(${A})`), (_, f, a, b) => 'integral ' + P(`\\int_{${X(a)}}^{${X(b)}} ${X(f)}`));
  t = t.replace(g(String.raw`\b(?:definite\s+)?integral\s+(?:from|between)\s+(${A})\s+(?:to|and)\s+(${A})\s+(?:of\s+)?`), (_, a, b) => 'integral ' + P(`\\int_{${X(a)}}^{${X(b)}}`));
  // «double integral» da solo è un nome, non una formula: il simbolo solo con «over D» o «of f»
  t = t.replace(g(String.raw`\b(double|triple)\s+integral\s+(?:over\s+([a-zA-Z])\s+(?:of\s+)?|of\s+(?!the\b|an?_*\b))`), (_, n, d) => `${n} integral ` + P((/triple/i.test(n) ? '\\iiint' : '\\iint') + (d ? `_{${d}}` : '')));
  // «line integral», «surface integral», «Riemann integral», «the integral of the …» restano parole
  t = t.replace(g(String.raw`(?<!\b(?:line|surface|contour|path|flux|riemann|lebesgue|cauchy|double|triple)\s)\bintegral\s+of\s+(?!(?:the|an?_*|this|that|motion|line|surface)\b)`), () => 'integral ' + P('\\int'));
  t = t.replace(/\bd\s+([a-z])\b(?=\s|$|[.,;])/g, (_, x) => P(`\\, d${x}`));
  t = t.replace(g(String.raw`\b(?:limit|lim)\s+(?:as|for|when)\s+([a-z])\s+(?:approaches|tends\s+to|goes\s+to|to)\s+(${A})(?:\s+of)?`), (m, x, a) => (/^lim\s/i.test(m) ? '' : 'limit ') + P(`\\lim_{${x} \\to ${X(a)}}`));
  t = t.replace(g(String.raw`\blimit\s+of\s+(${A})\s+(?:as|for|when)\s+([a-z])\s+(?:approaches|tends\s+to|goes\s+to)\s+(${A})`), (_, f, x, a) => 'limit ' + P(`\\lim_{${x} \\to ${X(a)}} ${X(f)}`));
  t = t.replace(g(String.raw`\b(sum|summation|product)\s+(?:(?:for|over)\s+([a-z])\s+(?:going\s+|that\s+goes\s+)?from|from\s+([a-z])\s+(?:equals|equal\s+to|is)|(?:for|over)\s+([a-z])\s+(?:equals|equal\s+to))\s+(${A})\s+(?:up\s+)?to\s+(${A})(?:\s+of)?`),
    (_, s, n1, n2, n3, a, b) => s + ' ' + P(`${/prod/i.test(s) ? '\\prod' : '\\sum'}_{${n1 || n2 || n3}=${X(a)}}^{${X(b)}}`));
  // 9. relazioni e logica: solo se dopo c'è un pezzo di formula («x is less than one», non «two approaches to the problem»);
  // confronti, «in» e «tends to» anche solo se PRIMA c'è un pezzo di formula («x goes to zero», non «the function goes to zero»)
  const R = [[String.raw`(?:is\s+)?less\s+than\s+or\s+equal\s+to`, '\\le'], [String.raw`(?:is\s+)?greater\s+than\s+or\s+equal\s+to`, '\\ge'],
    [String.raw`(?:is\s+)?(?:less|smaller)\s+than`, '<'], [String.raw`(?:is\s+)?(?:greater|bigger|larger)\s+than`, '>'],
    [String.raw`(?:is\s+not\s+equal\s+to|not\s+equal\s+to|does\s+not\s+equal|doesn't\s+equal|is\s+different\s+from)`, '\\neq'], [String.raw`(?:is\s+)?approximately\s+(?:equal\s+to|equals)`, '\\approx'],
    [String.raw`(?:if\s+and\s+only\s+if|iff)`, '\\iff', A, false], [String.raw`(?:(?:is\s+)?not\s+(?:an\s+)?element\s+of|is\s+not\s+in|does\s+not\s+belong\s+to|doesn't\s+belong\s+to)`, '\\notin'],
    [String.raw`(?:(?:is\s+)?(?:an\s+)?element\s+of|belongs\s+to)`, '\\in'], [String.raw`for\s+(?:all|every|each)`, '\\forall', A, false], [String.raw`there\s+exists?`, '\\exists', A, false],
    [String.raw`plus\s+or\s+minus`, '\\pm', A, false], [String.raw`(?:tends\s+to|approaches|goes\s+to)`, '\\to'], [String.raw`implies`, '\\Rightarrow', A, false],
    // «x in R» sì, «in 1905» e «in the» no: dopo «in» serve una lettera o un pezzo di formula, non un numero
    [String.raw`(?:is\s+)?in`, '\\in', String.raw`(?:\u0001\d+\u0002|\b[a-zA-Z]\b)`]];
  for (const [r, l, dopo = A, prima = true] of R) t = t.replace(g(String.raw`(?<=${prima ? A + String.raw`\s+` : String.raw`\s`})${r}(?=\s+${dopo})`), () => P(l));
  return t;
}

const REGOLE = {
  it: { prepara: s => numeri(whisper(s).replace(/\bzero\b/gi, '0')), converti: italiano, segni: { 'più': '+', 'piu': '+', 'meno': '-', 'uguale': '=', 'per': '\\cdot', 'virgola': ',' }, uguali: [['uguale', 'a']], lettere: /^[b-df-hj-np-tv-zB-DF-HJ-NP-TV-Z]$/ },
  en: { prepara: s => numeriEn(whisperEn(s)), converti: inglese, segni: { plus: '+', minus: '-', equals: '=', times: '\\cdot', comma: ',' }, uguali: [['is', 'equal', 'to'], ['equal', 'to'], ['is', 'equals']],
    lettere: /^[a-zA-HJ-Z]$/,   // in inglese anche «a», «e», «A» sono lettere della formula: l'articolo «a» e «I» sono già segnati con «__»
    fine: s => s.replace(/\b([aAI])__/g, '$1') },
};

export function parlatoInFormule(testo, lingua = linguaScelta) {
  const r = REGOLE[lingua];
  if (!r) return String(testo);   // spagnolo, francese, tedesco, portoghese: il testo resta com'è
  const h = attrezzi(), { X } = h;
  let t = ' ' + r.prepara(String(testo)).replace(/([.,;:!?])(?=\s|$)/g, ' $1') + ' ';
  t = r.converti(t, h);

  // le formule si uniscono: segnaposto, lettere, numeri e operatori vicini diventano un solo $…$
  const parole = t.split(/\s+/).filter(Boolean);
  const segno = w => r.segni[w.toLowerCase()];
  const atomo = w => /^\u0001\d+\u0002$/.test(w) || /^\d+(?:[.,]\d+)?$/.test(w) || r.lettere.test(w) || /^[=+\-<>()]$/.test(w);
  // «uguale a x», «is equal to x»: più parole che fanno un «=»
  const uguale = j => r.uguali.find(u => u.every((p, k) => parole[j + k] && parole[j + k].toLowerCase() === p) && atomo(parole[j + u.length] || ''));
  const out = []; let i = 0;
  while (i < parole.length) {
    if (!atomo(parole[i])) { out.push(parole[i]); i++; continue; }
    let j = i, pezzi = [], formula = false;
    while (j < parole.length) {
      const w = parole[j];
      if (atomo(w)) { pezzi.push(w); if (/\u0001/.test(w) || /^[=+\-<>]$/.test(w)) formula = true; j++; continue; }
      const s = segno(w);
      if (s && j + 1 < parole.length && atomo(parole[j + 1]) && pezzi.length) { pezzi.push(s); formula = true; j++; continue; }
      const u = pezzi.length && uguale(j);
      if (u) { pezzi.push('='); formula = true; j += u.length; continue; }
      break;
    }
    if (formula) out.push('$' + X(pezzi.join(' ')).replace(/\s+([,)])/g, '$1').replace(/\(\s+/g, '(') + '$');
    else out.push(...pezzi.map(p => X(p)));
    i = j;
  }
  const fatto = out.join(' ').replace(/\s+([.,;:!?])/g, '$1').replace(/\$\s*\$/g, ' ')
    .replace(/\\, d([a-z])\$\s+d\s?([a-z])\b/g, '\\, d$1 \\, d$2$')   // «in dx dy»: anche il secondo differenziale nella formula
    .trim();
  return r.fine ? r.fine(fatto) : fatto;
}
