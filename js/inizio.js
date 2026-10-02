// Prima di disegnare: nell'app, la finestra della barra (non il quadro né il benvenuto) prende la classe «barra».
// Un file a parte e non uno script dentro index.html: la Content-Security-Policy non accetta script scritti nella pagina.
if (window.lodeDesktop && !/quadro|benvenuto/.test(location.search)) document.documentElement.classList.add('barra');
