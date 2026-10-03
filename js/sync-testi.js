// I testi della sincronizzazione fra i computer (docs/SINCRONIZZAZIONE.md §10.7 e §12), in un posto solo: li usano la scheda
// «Sincronizza fra i tuoi computer», la conferma e il benvenuto; il README e il documento dicono le stesse cose, e
// test/sincronizza-app.mjs controlla che l'elenco di «in chiaro» del README coincida con questo (#4 #23).

// cosa resta in chiaro: onesto e completo, anche con la password
// (giro 3) cifrati sono i dati nel DIARIO; le pagine per Obsidian ne riportano molti in chiaro, e IN_CHIARO lo dice per esteso
export const CIFRATI = 'i dati di Lode nel diario (esami, voti, carte e ripassi, sessioni, profilo, impostazioni): non le pagine per Obsidian che Lode ne ricava, qui sotto';
export const IN_CHIARO = [
  'appunti, Sbobine, file per Anki, diari dei Progetti',
  'Orario.md con le aule',
  'le pagine che Lode scrive per Obsidian, ricavate proprio da quei dati: Esami (voti, media, CFU e ore studiate per esame), Memoria (ore di studio del mese, in che fascia del giorno studi, la serie di giorni, le definizioni sbagliate e quante volte), Home (il prossimo appello, quante carte ci sono da ripassare), Corsi, Glossario',
  'nomi, dimensioni e orari dei file (quando studi)',
  'quanti computer ci sono, quanti file scrive ciascuno e quante azioni ha in ogni file (un file per giorno)',
  'il file del gruppo (sale e controllo della password, quando è nato e da quale computer, l\'impronta del dati.json di prima)',
  'quando è cambiata la password',
  'il dati.json minimo che dice «Aggiorna Lode»',
];
export const SUL_COMPUTER = 'Sul computer il diario di Lode resta in chiaro, protetto solo dal tuo account del sistema.';
export const CRONOLOGIA = 'Nella cronologia del servizio cloud resta quello che era passato in chiaro prima della password.';
export const DIMENTICATA = 'Se dimentichi la password non si perde niente: ogni computer ha i suoi dati sul disco. Con «Ho dimenticato la password» ne scegli una nuova, e gli altri computer te la chiederanno.';
export const NUOVA_PASSWORD = 'Scegli una password nuova. Gli altri computer te la chiederanno. Nessun dato si perde: ogni computer ha i suoi sul disco.';
export const SMETTI = servizio => `Lode copierà il vault in una cartella fuori da ${servizio || 'la cartella cloud'} e userà quella. Gli altri computer continuano a sincronizzarsi tra loro. Per smettere ovunque, fallo su ogni computer.`;
export const PRIMA = 'Prima di sincronizzare, aggiorna Lode su tutti i computer.';
// è nuova (0.5.0): lo diciamo chiaro, con dove sono le copie di sicurezza e dove raccontare cosa non torna
export const SPERIMENTALE = 'È nuova e sperimentale: provata a fondo con un simulatore di più computer e un cloud dispettoso, ma non ancora da tanti studenti. Prima di accenderla Lode tiene una copia di tutto: il vault di adesso resta dov\'è, intatto, e i dati di Lode vanno anche nella cartella «copie» dei dati di Lode. Se qualcosa non torna, raccontacelo su GitHub (Issues di W1kicartel/Lode).';

// la riga di stato (§12): stato e avvisi vengono dal motore (desktop/sync/motore.mjs, stato())
export function rigaStato(s) {
  if (!s?.acceso) return 'Spenta · esami, voti e carte restano su questo computer';
  if (s.fermo) return 'Il diario di Lode su questo computer non si legge.';
  if (!s.cloud) return 'Solo su questo computer · non sincronizzato';
  const dove = s.servizio || 'la tua cartella cloud';
  switch (s.stato) {
    case 'password': return 'In pausa: scrivi la password per sincronizzare.';
    case 'rigenerato': return s.avvisi?.includes('altra_password') ? 'Su un altro computer è stata scelta un\'altra password nello stesso momento: scrivi quella.' : 'Su un altro computer è cambiata la password: scrivi quella nuova per sincronizzare.';
    case 'sparito': return 'La cartella di Lode nel vault non c\'è più: è stata spostata o cancellata?';
    case 'in_arrivo': return `Ricevo i dati dagli altri computer… (${dove})`;
    case 'da_migrare': return 'Aspetto i dati dal cloud…';
    case 'scrittura': return 'Il disco è pieno (o non si scrive): le ultime modifiche aspettano e le riprovo da solo.';
    case 'versione': return `Sincronizzato con ${dove} · un altro computer ha una Lode più nuova: aggiornala`;
    case 'in_pari': return `Sincronizzato con ${dove}${s.cifrato ? ' · cifrato' : ''}${s.ultimo ? ` · controllato alle ${new Date(s.ultimo).toTimeString().slice(0, 5)}` : ''}`;
    default: return `Sincronizzazione: ${s.stato || 'in avvio'}`;
  }
}
// gli avvisi che non cambiano lo stato (§12)
export const AVVISI = {
  clone: 'Questo computer sembra una copia di un altro: da adesso ha un nome nuovo. Non si è perso niente.',
  orologio: 'L\'orologio di un altro computer sembra molto avanti: controlla data e ora.',
  // due testi (§12): il file di questo computer si rimette dal diario; quello di un altro computer si salta finché non torna buono
  rovinato_mio: 'Un file di Lode di questo computer nella cartella cloud era rovinato o manomesso: l\'ho messo da parte e rimesso a posto dal diario.',
  rovinato_altro: 'Un file di Lode di un altro computer è rovinato o manomesso: lo salto finché non torna leggibile.',
  scrittura: 'Il disco è pieno o non si scrive: le ultime modifiche non sono ancora nel diario. Le riprovo a ogni giro e quando chiudi Lode.',
  recupero: 'Il diario non si poteva scrivere: le modifiche di quel momento sono in un file a parte nella cartella dei dati di Lode.',
  portachiavi: 'Il Portachiavi non ha dato la password di Lode (permesso negato, o Lode aggiornato): scrivila di nuovo.',
  gruppi_doppi: 'Nella cartella cloud ci sono due gruppi di Lode, uno cifrato e uno no: non li unisco da solo.',
  lode_vecchia: 'Una versione vecchia di Lode ha scritto dei dati in .lode/dati.json: aggiornala. Non entrano da soli: una copia è nella cartella dei dati di Lode, e i record nuovi si importano con «Importa le aggiunte».',
  altra_password: 'Su un altro computer è stata scelta un\'altra password nello stesso momento: scrivi quella.',
  // gruppo.json è autenticato nei gruppi cifrati (§10.2): questi tre dicono che qualcuno l'ha cambiato da fuori
  manomesso: 'Il file del gruppo di Lode nella cartella cloud è stato cambiato da fuori (non torna con la password): non lo uso. Controlla la cartella cloud.',
  gruppo_chiaro: 'Il file del gruppo di Lode dice «senza password» ma i dati degli altri computer sono cifrati: è stato manomesso? Non pubblico niente finché non torna a posto.',
  parametri: 'Questo vault è stato protetto da una Lode più nuova: aggiornala.',
};
