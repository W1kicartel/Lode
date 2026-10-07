// Il ponte fra la barra e il computer: solo questi canali, niente altro.
const { contextBridge, ipcRenderer } = require('electron');
const IN = ['dati:cambiati', 'vault:lezioni', 'vault:orario', 'vault:info', 'scorciatoia', 'installa:progresso', 'locale:pezzo', 'voce:progresso', 'ai:pezzo',
  'progetto:cambiato', 'progetto:fatto', 'progetto:uscita', 'progetto:esito', 'aggiorna:cambiato', 'sync:stato', 'sync:progresso',
  'computer:audio', 'computer:fine'];
const OUT = ['vault:info', 'vault:lezioni', 'vault:annota', 'vault:apri', 'vault:scrivi', 'vault:memoria', 'vault:scegli', 'vault:blocco', 'vault:note', 'finestra:rilascia', 'sistema:inattivo', 'installa:stato', 'installa:obsidian', 'installa:cervello', 'locale:chat', 'locale:stop', 'locale:scalda', 'vault:leggi', 'vault:salvaFile', 'vault:mostra', 'condividi', 'benvenuto:fatto', 'vault:pulisciCorsi', 'voce:stato', 'voce:prepara', 'voce:trascrivi', 'voce:riposa', 'computer:disponibile', 'computer:avvia', 'computer:ferma',
  // Moodle in sola lettura (desktop/moodle.mjs): indirizzi e token restano nel main, la barra chiede i file per indice
  'moodle:stato', 'moodle:verifica', 'moodle:accedi', 'moodle:accediBrowser', 'moodle:scollega', 'moodle:corsi', 'moodle:segui', 'moodle:novita', 'moodle:segnaVisti', 'moodle:scarica', 'moodle:scadenze', 'moodle:descrizione', 'ai:chat', 'ai:stop', 'ai:modelli', 'scorciatoie:stato',
  // informatica: segui il progetto (la barra manda solo l'id, mai percorsi o comandi) ed «spiegami l'errore» dagli appunti
  'progetto:scegli', 'progetto:segui', 'progetto:smetti', 'progetto:stato', 'progetto:diff', 'progetto:righe', 'progetto:rileva', 'progetto:conferma', 'progetto:prova', 'progetto:visto', 'appunti:errore',
  // le versioni nuove di Lode (desktop/aggiorna.mjs): la barra chiede solo azioni, gli URL li decide il main
  'aggiorna:stato', 'aggiorna:imposta', 'aggiorna:riavvia', 'aggiorna:scarica',
  // la sincronizzazione fra i computer (desktop/sincronizza.mjs): la barra sceglie per indice, i percorsi li conosce solo il main
  'sync:stato', 'sync:cartelle', 'sync:attiva', 'sync:collega', 'sync:sblocca', 'sync:cifra', 'sync:dimentica', 'sync:toglila', 'sync:giro', 'sync:smetti', 'sync:importaAggiunte'];
// il ponte solo nelle pagine di Lode, che arrivano da file:// (la cartella dell'app). Se una finestra finisse su un'altra
// pagina (main.mjs lo impedisce già, restaLode), quella pagina riceverebbe lo stesso preload: così non trova il ponte
if (location.protocol === 'file:') contextBridge.exposeInMainWorld('lodeDesktop', {
  piattaforma: process.platform,
  arch: process.arch,
  leggiDati: vuoto => ipcRenderer.sendSync('dati:leggi', vuoto),   // vuoto: i predefiniti della barra (la BASE della sincronizzazione)
  salvaDati: (d, x) => ipcRenderer.send('dati:salva', d, x),   // x: { ver, ops } con la sincronizzazione accesa
  mouse: ignora => ipcRenderer.send('mouse', !!ignora),
  zona: r => ipcRenderer.send('finestra:zona', r),
  invoca: (canale, dati) => OUT.includes(canale) ? ipcRenderer.invoke(canale, dati) : Promise.reject(new Error('canale non permesso')),
  su: (canale, fn) => { if (IN.includes(canale)) ipcRenderer.on(canale, (_, x) => fn(x)); },
});
