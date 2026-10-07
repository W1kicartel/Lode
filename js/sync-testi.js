// I testi della sincronizzazione fra i computer (docs/SINCRONIZZAZIONE.md §10.7 e §12), in un posto solo: li usano la scheda
// «Sincronizza fra i tuoi computer», la conferma e il benvenuto; il README e il documento dicono le stesse cose, e
// test/sincronizza-app.mjs controlla che l'elenco di «in chiaro» del README coincida con questo (#4 #23).
// Le frasi stanno nel catalogo (js/lingue/<codice>/sync.js): qui restano i nomi che usa il resto del codice.
import { t, elenco } from './lingua.js';
import { oraBreve } from './parole.js';

// cosa resta in chiaro: onesto e completo, anche con la password
// (giro 3) cifrati sono i dati nel DIARIO; le pagine per Obsidian ne riportano molti in chiaro, e IN_CHIARO lo dice per esteso
export const CIFRATI = t('sync.cifrati');
export const IN_CHIARO = elenco('sync.in-chiaro');
export const SUL_COMPUTER = t('sync.sul-computer');
export const CRONOLOGIA = t('sync.cronologia');
export const DIMENTICATA = t('sync.dimenticata');
export const NUOVA_PASSWORD = t('sync.nuova-password');
export const SMETTI = servizio => t('sync.smetti', { servizio: servizio || t('sync.la-cartella-cloud') });
export const PRIMA = t('sync.prima');
// è nuova (0.5.0): lo diciamo chiaro, con dove sono le copie di sicurezza e dove raccontare cosa non torna
export const SPERIMENTALE = t('sync.sperimentale');

// la riga di stato (§12): stato e avvisi vengono dal motore (desktop/sync/motore.mjs, stato())
export function rigaStato(s) {
  if (!s?.acceso) return t('sync.spenta');
  if (s.fermo) return t('sync.fermo');
  if (!s.cloud) return t('sync.solo-qui');
  const dove = s.servizio || t('sync.la-tua-cartella');
  switch (s.stato) {
    case 'password': return t('sync.stato-password');
    case 'rigenerato': return s.avvisi?.includes('altra_password') ? t('sync.rigenerato-altra') : t('sync.rigenerato');
    case 'sparito': return t('sync.sparito');
    case 'in_arrivo': return t('sync.in-arrivo', { dove });
    case 'da_migrare': return t('sync.da-migrare');
    case 'scrittura': return t('sync.scrittura');
    case 'versione': return t('sync.versione', { dove });
    case 'in_pari': { const ora = s.ultimo ? oraBreve(s.ultimo) : null;
      return t(s.cifrato ? (ora ? 'sync.in-pari-cifrato-ora' : 'sync.in-pari-cifrato') : (ora ? 'sync.in-pari-ora' : 'sync.in-pari'), { dove, ora }); }
    default: return t('sync.altro-stato', { stato: s.stato || t('sync.in-avvio') });
  }
}
// gli avvisi che non cambiano lo stato (§12)
export const AVVISI = {
  clone: t('sync.avviso-clone'),
  orologio: t('sync.avviso-orologio'),
  // due testi (§12): il file di questo computer si rimette dal diario; quello di un altro computer si salta finché non torna buono
  rovinato_mio: t('sync.avviso-rovinato-mio'),
  rovinato_altro: t('sync.avviso-rovinato-altro'),
  scrittura: t('sync.avviso-scrittura'),
  recupero: t('sync.avviso-recupero'),
  portachiavi: t('sync.avviso-portachiavi'),
  gruppi_doppi: t('sync.avviso-gruppi-doppi'),
  lode_vecchia: t('sync.avviso-lode-vecchia'),
  altra_password: t('sync.avviso-altra-password'),
  // gruppo.json è autenticato nei gruppi cifrati (§10.2): questi tre dicono che qualcuno l'ha cambiato da fuori
  manomesso: t('sync.avviso-manomesso'),
  gruppo_chiaro: t('sync.avviso-gruppo-chiaro'),
  parametri: t('sync.avviso-parametri'),
};
