// SM-2 di Lode, puro (docs/SINCRONIZZAZIONE.md §6.6): lo stesso calcolo di rispondi() e ricorda() di js/dati.js, ma senza D,
// senza salva() e senza «oggi»: il giorno arriva da fuori (la data locale di chi ha ripassato, scritta nell'evento), così il
// rigioco della piega dà lo stesso risultato su ogni computer, in ogni fuso orario. Versione alg:1, congelata: un SM-2
// diverso è alg:2. Per adesso lo usa il motore della sincronizzazione (desktop/sync/piega.mjs); js/dati.js lo userà quando
// la sincronizzazione sarà collegata alla barra.

// giorni di calendario su una data ISO (AAAA-MM-GG), in UTC: nessun fuso orario, nessuna ora legale
export function piuGiorni(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function prossimoIntervallo(c, q) {
  if (q < 3) return 0;
  const rip = (Number(c.rip) || 0) + 1;
  return rip === 1 ? { 3: 1, 4: 2, 5: 4 }[q] : rip === 2 ? { 3: 3, 4: 6, 5: 10 }[q] : Math.max(1, Math.round((Number(c.int) || 0) * (Number(c.ease) || 2.5) * (q === 3 ? .8 : q === 5 ? 1.3 : 1)));
}
const nuovaEase = (ease, q) => Math.max(1.3, (Number(ease) || 2.5) + .1 - (5 - q) * (.08 + (5 - q) * .02));

// una carta ripassata con la risposta q (0, 3, 4, 5) il giorno «giorno»: il nuovo { ease, int, rip, scad } (come rispondi())
export function applica(c, q, giorno) {
  const int = prossimoIntervallo(c, q), ease = nuovaEase(c.ease, q);
  if (q < 3) return { ease, int: 0, rip: 0, scad: giorno };
  return { ease, int, rip: (Number(c.rip) || 0) + 1, scad: piuGiorni(giorno, int) };
}
// una definizione ricordata (ok) o no, con q: il nuovo { ease, int, rip, scad, ultima } (come ricorda(); giuste e sbagliate
// sono contatori a parte)
export function ricordaStato(m, ok, q, giorno) {
  const ease = nuovaEase(m.ease, q);
  if (ok) { const int = prossimoIntervallo(m, q); return { ease, int, rip: (Number(m.rip) || 0) + 1, scad: piuGiorni(giorno, int), ultima: giorno }; }
  return { ease, int: 0, rip: 0, scad: piuGiorni(giorno, 1), ultima: giorno };
}
