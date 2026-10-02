# Sicurezza

Lode tiene sul tuo computer cose delicate: gli appunti e i voti nel vault, la chiave della tua AI, il microfono, le cartelle dei progetti che segue. Se trovi un modo per arrivarci senza permesso, o un altro problema di sicurezza, grazie: dimmelo **in privato**, così si sistema prima che qualcuno lo usi.

## Come segnalarlo

1. Apri la [segnalazione privata di GitHub](https://github.com/W1kicartel/Lode/security/advisories/new): scheda **Security** del repository, poi **Report a vulnerability**. La vedi solo tu e chi mantiene Lode.
2. Racconta cosa succede, su quale sistema e con quale versione (o commit), e come rifarlo, passo per passo. Un esempio piccolo basta.
3. Se il pulsante non c'è, apri una [issue](https://github.com/W1kicartel/Lode/issues/new) con scritto solo «Vorrei segnalare un problema di sicurezza», **senza dettagli**: ti scrivo io per un canale privato.

Lode è un progetto piccolo, fatto nel tempo libero: la risposta può arrivare dopo qualche giorno. Quando la correzione è pubblicata, scriviamo insieme cosa è successo, e se vuoi ti cito.

## Cosa non va in una issue pubblica

Le issue, le discussioni e i registri delle prove su GitHub li legge chiunque, anche dopo che li cancelli. Lì non vanno:

- **come sfruttare un problema di sicurezza** (passi, codice, file preparati): quelli vanno solo nella segnalazione privata;
- **chiavi e token**: la chiave della tua AI (`sk-…`, `AIza…`, `gsk_…`), token di GitHub, password. Se ne hai pubblicata una per sbaglio, cancellarla non basta: revocala subito dal sito del servizio e creane una nuova;
- **il tuo nome**: nei percorsi (`/Users/<nome>/…`, `C:\Users\<nome>\…`, `/home/<nome>/…`), nel saluto della barra («Buongiorno, …»), nel nome del computer;
- **pezzi del vault**: appunti, trascrizioni, voti, media, orario delle lezioni, nomi di prof e compagni;
- **audio** registrato in aula o a casa.

Prima di incollare un registro o uno screenshot: sostituisci il nome con `<nome>`, taglia i percorsi fino a `Lode/…`, copri voti e appunti. Per il codice c'è `node test/controlla-privacy.mjs`, che trova chiavi e percorsi con un nome vero (vedi [CONTRIBUTING.md](CONTRIBUTING.md)).

## Cosa conta

- la barra o l'app che leggono o scrivono fuori dal vault e dalle cartelle che hai scelto;
- la chiave della tua AI che parte verso un servizio diverso da quello che hai scelto, o finisce nel vault, nei backup o nei registri;
- codice preso dalla rete ed eseguito senza versione esatta o senza controllo;
- gli installer, gli aggiornamenti e i workflow di GitHub che li costruiscono e li pubblicano;
- il microfono acceso senza che tu l'abbia chiesto, o audio che resta su disco.

Vale per l'ultima versione pubblicata nella pagina [Release](https://github.com/W1kicartel/Lode/releases/latest) e per `main`. Lode è in beta: le versioni vecchie non ricevono correzioni, si aggiornano.
