// Il ponte fra la barra e il computer: solo questi canali, niente altro.
const { contextBridge, ipcRenderer } = require('electron');
const IN = ['dati:cambiati', 'vault:lezioni', 'vault:orario', 'vault:info', 'scorciatoia', 'installa:progresso', 'locale:pezzo', 'voce:progresso', 'ai:pezzo'];
const OUT = ['vault:info', 'vault:lezioni', 'vault:annota', 'vault:apri', 'vault:scrivi', 'vault:memoria', 'vault:scegli', 'vault:blocco', 'vault:note', 'finestra:rilascia', 'sistema:inattivo', 'installa:stato', 'installa:obsidian', 'installa:cervello', 'locale:chat', 'locale:stop', 'locale:scalda', 'vault:leggi', 'vault:salvaFile', 'condividi', 'benvenuto:fatto', 'vault:pulisciCorsi', 'voce:stato', 'voce:prepara', 'voce:trascrivi', 'ai:chat', 'ai:stop', 'ai:modelli', 'scorciatoie:stato'];
contextBridge.exposeInMainWorld('lodeDesktop', {
  piattaforma: process.platform,
  arch: process.arch,
  leggiDati: () => ipcRenderer.sendSync('dati:leggi'),
  salvaDati: d => ipcRenderer.send('dati:salva', d),
  mouse: ignora => ipcRenderer.send('mouse', !!ignora),
  zona: r => ipcRenderer.send('finestra:zona', r),
  invoca: (canale, dati) => OUT.includes(canale) ? ipcRenderer.invoke(canale, dati) : Promise.reject(new Error('canale non permesso')),
  su: (canale, fn) => { if (IN.includes(canale)) ipcRenderer.on(canale, (_, x) => fn(x)); },
});
