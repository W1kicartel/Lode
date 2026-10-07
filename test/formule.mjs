// Le formule dette a voce, in italiano e in inglese: node test/formule.mjs
// 1) l'inglese: «x squared plus two x», «the integral from zero to one of …», «d y over d x», «partial f partial x»…
//    diventano lo stesso LaTeX dell'italiano, e la prosa resta prosa («this one», «in 1905», «a year»);
// 2) l'italiano dà ESATTAMENTE quello che dava prima delle lingue (risultati fissati con il formule.js di prima);
// 3) spagnolo, francese, tedesco e portoghese: il testo resta com'è (docs/LINGUE.md, «La voce e le formule»);
// 4) senza la lingua, parlatoInFormule usa quella della barra (js/lingua.js).
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.addEventListener = () => { }; globalThis.dispatchEvent = () => { }; globalThis.CustomEvent = class { constructor(t, o) { this.detail = o?.detail; } };
const { parlatoInFormule: f } = await import('../js/formule.js');
const Lingua = await import('../js/lingua.js');

let ok = 0, ko = 0;
const prova = (nome, cond, dett = '') => { if (cond) ok++; else { ko++; console.log('✗', nome, dett); } };
const uguale = (lingua, detto, atteso) => { const r = f(detto, lingua); prova(`${lingua}: «${detto}»`, r === atteso, `\n    atteso: ${atteso}\n    avuto:  ${r}`); };

// 1) inglese
const INGLESE = [
  ["x squared plus two x plus one", "$x^{2} + 2 x + 1$"],
  ["f of x equals x squared plus two x plus one.", "$f(x) = x^{2} + 2 x + 1$."],
  ["the integral from zero to one of x squared d x", "the integral $\\int_{0}^{1} x^{2} \\, dx$"],
  ["the integral from zero to pi of sine of x dx", "the integral $\\int_{0}^{\\pi} \\sin x \\, dx$"],
  ["d y over d x", "$\\frac{d y}{d x}$"],
  ["d squared y over d x squared", "$\\frac{d^{2} y}{d x^{2}}$"],
  ["dy/dx equals two x", "$\\frac{d y}{d x} = 2 x$"],
  ["partial f partial x", "$\\frac{\\partial f}{\\partial x}$"],
  ["partial f over partial x", "$\\frac{\\partial f}{\\partial x}$"],
  ["the partial derivative of f with respect to x", "the partial derivative $\\frac{\\partial f}{\\partial x}$"],
  ["the derivative of f with respect to x", "the derivative $\\frac{d f}{d x}$"],
  ["the second derivative of y with respect to t", "the second derivative $\\frac{d^{2} y}{d t^{2}}$"],
  ["square root of two", "$\\sqrt{2}$"],
  ["the square root of x plus one", "$\\sqrt{x} + 1$"],
  ["cube root of x", "$\\sqrt[3]{x}$"],
  ["alpha plus beta equals gamma", "$\\alpha + \\beta = \\gamma$"],
  ["capital delta", "$\\Delta$"],
  ["f of x", "$f(x)$"],
  ["f prime of x", "$f'(x)$"],
  ["g double prime of t", "$g''(t)$"],
  ["x to the n", "$x^{n}$"],
  ["x to the power of n", "$x^{n}$"],
  ["x to the minus one", "$x^{-1}$"],
  ["e to the minus x", "$e^{-x}$"],
  ["x to the third", "$x^{3}$"],
  ["x less than or equal to one", "$x \\le 1$"],
  ["x is greater than or equal to zero", "$x \\ge 0$"],
  ["x is less than one", "$x < 1$"],
  ["x is not equal to zero", "$x \\neq 0$"],
  ["the limit as x approaches zero of sine of x over x", "the limit $\\lim_{x \\to 0} \\frac{\\sin x}{x}$"],
  ["the limit as n goes to infinity of one over n", "the limit $\\lim_{n \\to \\infty} \\frac{1}{n}$"],
  ["the sum from n equals one to infinity of one over n squared", "the sum $\\sum_{n=1}^{\\infty} \\frac{1}{n^{2}}$"],
  ["the product for k from one to n of k", "the product $\\prod_{k=1}^{n} k$"],
  ["for every epsilon greater than zero there exists delta", "$\\forall \\varepsilon > 0 \\exists \\delta$"],
  ["x sub n", "$x_{n}$"],
  ["a sub i", "$a_{i}$"],
  ["x naught", "$x_{0}$"],
  ["x²", "$x^{2}$"],
  ["2x plus 3", "$2 x + 3$"],
  ["the absolute value of x", "$|x|$"],
  ["the norm of v", "$\\|v\\|$"],
  ["the gradient of f", "$\\nabla f$"],
  ["vector v", "$\\vec{v}$"],
  ["x plus or minus one", "$x \\pm 1$"],
  ["x is an element of A", "$x \\in A$"],
  ["natural log of x", "$\\ln x$"],
  ["log of x", "$\\log x$"],
  ["exponential of x", "$e^{x}$"],
  ["the double integral over D of f dx dy", "the double integral $\\iint_{D} f \\, dx \\, dy$"],
  ["the line integral of F along C", "the line integral of F along C"],
  ["f of x and y", "$f(x, y)$"],
  ["x times y", "$x \\cdot y$"],
  ["three times four equals twelve", "$3 \\cdot 4 = 12$"],
  ["one half", "$\\frac{1}{2}$"],
  ["x divided by two", "$\\frac{x}{2}$"],
  ["two point five", "2.5"],
  ["twenty one", "21"],
  ["f of x is equal to x cubed", "$f(x) = x^{3}$"],
  ["theta", "$\\theta$"],
  ["chi squared", "$\\chi^{2}$"],
  ["x tends to infinity", "$x \\to \\infty$"],
  ["the integral of e to the minus x d x", "the integral $\\int e^{-x} \\, dx$"],
  ["x approximately equal to three", "$x \\approx 3$"],
  ["x if and only if y", "$x \\iff y$"],
  ["a squared plus b squared equals c squared", "$a^{2} + b^{2} = c^{2}$"],
  ["x^2 plus y^2", "$x^{2} + y^{2}$"],
  ["Today we talk about linear algebra and matrices.", "Today we talk about linear algebra and matrices."],
  ["I think this one is a good example of the method.", "I think this one is a good example of the method."],
  ["It was over a year ago.", "It was over a year ago."],
  ["We discussed different approaches to the problem.", "We discussed different approaches to the problem."],
  ["The tangent line touches the curve.", "The tangent line touches the curve."],
  ["A prime number has no divisors.", "A prime number has no divisors."],
  ["Let's go over a few examples.", "Let's go over a few examples."],
  ["No one knows the answer.", "No one knows the answer."],
  ["the derivative of x squared with respect to x", "the derivative $\\frac{d x^{2}}{d x}$"],
  ["sin x over x", "$\\frac{\\sin x}{x}$"],
  ["the integral from a to b of f of x d x", "the integral $\\int_{a}^{b} f(x) \\, dx$"],
  ["cos I said so", "cos I said so"],
  ["for all x in R", "$\\forall x \\in R$"],
  ["the limit of f of x as x approaches a", "the limit $\\lim_{x \\to a} f(x)$"],
  ["x to the n minus one", "$x^{n} - 1$"],
  ["the integral of x dx", "the integral $\\int x \\, dx$"],
  ["y equals m x plus b", "$y = m x + b$"],
  ["one third", "$\\frac{1}{3}$"],
  ["the triple integral over V of f", "the triple integral $\\iiint_{V} f$"],
  ["a over b", "$\\frac{a}{b}$"],
  ["x prime", "$x'$"],
  ["pi over two", "$\\frac{\\pi}{2}$"],
  ["sigma squared", "$\\sigma^{2}$"],
  ["x sub i plus one", "$x_{i} + 1$"],
  ["the nth root of x", "$\\sqrt[n]{x}$"],
  ["f of x, y", "$f(x, y)$"],
  ["3 to the power of 2", "$3^{2}$"],
  ["n factorial", "$n!$"],
  ["the integral of x squared from zero to one", "the integral $\\int_{0}^{1} x^{2}$"],
  ["x plus a", "$x + a$"],
  ["in 1905 Einstein wrote three papers", "in 1905 Einstein wrote 3 papers"],
  ["we are in a hurry", "we are in a hurry"],
  ["one of the key results", "one of the key results"],
  ["the sum over i from one to n of a sub i", "the sum $\\sum_{i=1}^{n} a_{i}$"],
  ["x minus y over two", "$x - \\frac{y}{2}$"],
  ["the cosine of theta", "$\\cos \\theta$"],
  ["tan of x", "$\\tan x$"],
  ["arcsine of x", "$\\arcsin x$"],
  ["the hyperbolic sine of x", "$\\sinh x$"],
  ["x is in A", "$x \\in A$"],
  ["the derivative of sine of x with respect to x", "the derivative $\\frac{d \\sin x}{d x}$"],
  ["the integral from minus infinity to infinity of e to the minus x squared d x", "the integral $\\int_{-\\infty}^{\\infty} e^{-x^{2}} \\, dx$"],
  ["limit as x tends to plus infinity of one over x", "limit $\\lim_{x \\to +\\infty} \\frac{1}{x}$"],
];
for (const [d, a] of INGLESE) uguale('en', d, a);
prova('almeno 60 casi inglesi', INGLESE.length >= 60, INGLESE.length);

// 2) italiano, come prima
const ITALIANO = [
  ["l'integrale di linea lungo il bordo", "l'integrale di linea lungo il bordo"],
  ["all'integrale doppio sul dominio stesso", "all'integrale doppio sul dominio stesso"],
  ["integrale doppio su D di f in dx dy", "integrale doppio $\\iint_{D} f \\, dx \\, dy$"],
  ["l'integrale da zero a pi greco di seno di x in d x", "l'integrale $\\int_{0}^{\\pi} \\sin x \\, dx$"],
  ["f di x uguale x al quadrato più due x più uno.", "$f(x) = x^{2} + 2 x + 1$."],
  ["il limite per x che tende a zero di seno di x fratto x", "il limite $\\lim_{x \\to 0} \\frac{\\sin x}{x}$"],
  ["sommatoria per n che va da uno a infinito di uno fratto n al quadrato", "sommatoria $\\sum_{n=1}^{\\infty} \\frac{1}{n^{2}}$"],
  ["derivata parziale di f rispetto a x", "derivata parziale $\\frac{\\partial f}{\\partial x}$"],
  ["per ogni epsilon maggiore di zero esiste delta", "$\\forall \\varepsilon > 0 \\exists \\delta$"],
  ["calcoliamo l'integrale da 0 a p greco di seno di x in dx", "calcoliamo l'integrale $\\int_{0}^{\\pi} \\sin x \\, dx$"],
  ["f di x uguale x² più 2x più 1", "$f(x) = x^{2} + 2 x + 1$"],
  ["x³ frattotre", "$\\frac{x^{3}}{3}$"],
  ["Oggi parliamo di algebra lineare e di matrici.", "Oggi parliamo di algebra lineare e di matrici."],
  ["la radice quadrata di due", "la $\\sqrt{2}$"],
  ["radice cubica di x", "$\\sqrt[3]{x}$"],
  ["modulo di x minore o uguale a uno", "$|x| \\le 1$"],
  ["e alla x", "$e^{x}$"],
  ["x elevato alla meno uno", "$x^{-1}$"],
  ["a con pedice n", "$a_{n}$"],
  ["derivata seconda di y rispetto a t", "derivata seconda $\\frac{d^{2} y}{d t^{2}}$"],
  ["il gradiente di f", "il $\\nabla f$"],
  ["vettore v", "$\\vec{v}$"],
  ["norma di v", "$\\|v\\|$"],
  ["x diverso da zero", "$x \\neq 0$"],
  ["produttoria per k che va da uno a n di k", "produttoria $\\prod_{k=1}^{n} k$"],
  ["integrale di e alla meno x in d x", "integrale $\\int e^{-x} \\, dx$"],
  ["logaritmo naturale di x", "$\\ln x$"],
  ["f primo di x", "$f'(x)$"],
  ["y secondo", "$y''$"],
  ["alfa più beta uguale gamma", "$\\alpha + \\beta = \\gamma$"],
  ["delta maiuscolo", "$\\Delta$"],
  ["esponenziale di x", "$e^{x}$"],
  ["x appartiene a A", "$x \\in$ A"],
  ["meno infinito", "$-\\infty$"],
  ["x elevato alla ennesima", "$x^{n}$"],
  ["limite per n che tende a infinito di uno fratto n", "limite $\\lim_{n \\to \\infty} \\frac{1}{n}$"],
  ["tre per quattro uguale dodici", "$3 \\cdot 4 = 12$"],
  ["x più o meno uno", "$x \\pm 1$"],
  ["integrale da a a b di f di x in d x", "integrale $\\int_{a}^{b} f(x) \\, dx$"],
  ["se e solo se x maggiore o uguale a zero", "$\\iff x \\ge 0$"],
];
for (const [d, a] of ITALIANO) uguale('it', d, a);
prova('almeno 20 casi italiani', ITALIANO.length >= 20, ITALIANO.length);
prova("l'italiano non capisce l'inglese", f('x squared plus two x', 'it') === 'x squared plus two x', f('x squared plus two x', 'it'));
prova("l'inglese non capisce l'italiano", !f('x al quadrato più due x', 'en').includes('^{2}'), f('x al quadrato più due x', 'en'));

// 3) le altre lingue: il testo resta com'è
const ALTRE = ['x al cuadrado más dos x', "l'intégrale de zéro à un de x carré", 'x Quadrat plus zwei x', 'x ao quadrado mais dois x', 'x squared plus two x', 'f di x uguale x al quadrato', '  spazi  e 2x ²  '];
for (const cod of ['es', 'fr', 'de', 'pt']) for (const s of ALTRE) prova(`${cod}: «${s}» resta com'è`, f(s, cod) === s, f(s, cod));
prova('lingua sconosciuta: il testo resta', f('x squared', 'xx') === 'x squared');

// 4) la lingua della barra
prova('senza lingua: italiano nelle prove', f('x al quadrato più uno') === '$x^{2} + 1$', f('x al quadrato più uno'));
await Lingua.usa('en');
prova('senza lingua: la barra in inglese', f('x squared plus one') === '$x^{2} + 1$', f('x squared plus one'));
await Lingua.usa('de');
prova('senza lingua: la barra in tedesco, il testo resta', f('x squared plus one') === 'x squared plus one');
await Lingua.usa('it');
prova("senza lingua: di nuovo l'italiano", f('x al quadrato più uno') === '$x^{2} + 1$');

console.log(`formule: ${ok} prove passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
