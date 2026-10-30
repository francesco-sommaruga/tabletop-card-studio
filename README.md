# Tabletop Card Studio

App desktop per organizzare progetti Tabletop Creator, gestire più set di carte e preparare esportazioni Excel con campi configurabili.

## Installazione

Scarica l’ultima versione dalla pagina [Releases](https://github.com/francesco-sommaruga/tabletop-card-studio/releases) e scegli il pacchetto per il tuo sistema.

### Windows

1. Scarica il file `.exe` dalla release.
2. Avvialo e segui i passaggi del programma d’installazione.
3. Apri **Tabletop Card Studio** dal menu Start.

Windows può mostrare un avviso SmartScreen perché l’installer non è firmato. Verifica che il file provenga dalla pagina Releases di questo repository; se scegli di proseguire, fai clic su **Ulteriori informazioni** e poi **Esegui comunque**.

### macOS

1. Scarica il file `.dmg` dalla release.
2. Aprilo e trascina **Tabletop Card Studio** nella cartella **Applicazioni**.
3. Avvia l’app da Applicazioni. Se macOS ne blocca l’apertura perché il pacchetto non è firmato, fai clic destro sull’app, scegli **Apri** e conferma.

### Linux

1. Scarica il file `.AppImage` dalla release.
2. Concedi il permesso di esecuzione e avvia l’app:

   ```bash
   chmod +x ./*.AppImage
   ./Tabletop\ Card\ Studio-*.AppImage
   ```

   Puoi anche aprire le proprietà del file nel gestore file e attivare **Consenti l’esecuzione come programma**.

   Se l’AppImage segnala che FUSE non è disponibile, installa il pacchetto FUSE 2 della tua distribuzione e riprova.

## Avvio da sorgente

Requisiti: Node.js 22 o successivo e Git.

```bash
git clone https://github.com/francesco-sommaruga/tabletop-card-studio.git
cd tabletop-card-studio
npm ci
npm run dev
```

Per creare un pacchetto desktop per il sistema operativo corrente:

```bash
npm run build
```

I pacchetti vengono generati in `dist/`.

## Funzionalità

- Apri più progetti Tabletop Creator e scegli quale usare all’avvio.
- Importa più file Excel: ogni file diventa un set indipendente. Durante l’importazione scegli i campi da mantenere.
- Rinomina i set dalla sidebar per riconoscerli rapidamente nei progetti con più fogli.
- Elimina i set dalla sidebar dopo una conferma; i file Excel originali restano nella cartella del progetto.
- Reimporta un foglio già collegato a un set: scegli i campi da importare e ripristina le colonne presenti nel foglio ma rimosse dal set, abbina le carte tramite una colonna, applica gli aggiornamenti Excel non in conflitto e scegli per campo nei conflitti; le carte assenti dal foglio restano nel set.
- Crea campi di testo, testo lungo, numero, select, colore (anche con alpha esadecimale `#RRGGBBAA`), immagine e variabile; riordina le colonne e salva le modifiche prima di applicarle.
- Imposta un valore predefinito per ogni campo; con regole condizionali viene usato quando nessuna regola corrisponde. Senza default il campo resta vuoto.
- Nascondi campi nell’editor senza escluderli dall’Excel e configura regole che compilano valori automaticamente in base ad altri campi (ad esempio colore predefinito quando un’icona è assegnata).
- Modifica i campi direttamente nelle righe dell’archivio, assegna tag e stato alle carte, cerca e filtra per campi e ordina l’elenco.
- Scegli quali colonne mostrare nell’archivio: le colonne di base restano attive al primo avvio e le preferenze vengono salvate per progetto e set.
- Apri un’anteprima ricostruita dai blueprint del progetto, con selezione del blueprint e vista fronte/retro.
- Consulta statistiche per tag e proprietà, anche incrociando due campi e contando carte uniche o copie.
- Crea e modifica le variabili di `data/variables.json`, filtrale per codice, sostituzione, tipo o tag e assegnagli tag o i tipi Card Studio **Colore salvato** e **Icona**. Per le variabili icona, scegli visivamente tra la libreria Tabletop Creator e `assets/icons/` con ricerca testuale. Le icone vengono mostrate inline nei campi testo e nell’anteprima della carta; il picker **Aggiungi icona** elenca le variabili di tipo icona. I campi variabile restano modificabili, salvo quando hanno regole condizionali.
- Gestisci gli asset del progetto e usa le variabili di Tabletop Creator nei campi testuali.
- Esporta il set intero oppure la vista filtrata corrente (ricerca, stato, tag, campi e ordinamento) in `exports/`, con nome del set e data/ora nel nome del file e nei metadati del workbook.
- Collega un repository GitHub e gestisci commit, pull e push con le credenziali Git del computer; esplora in sola lettura i file di un commit e crea un branch da quel punto. La gestione opzionale dei branch locali permette di crearli, aprirli e rimuoverli.

Per creare un valore automatico, apri **Campi e colonne**, espandi **Regole automatiche e visibilità** sul campo da compilare e aggiungi una regola. Per `play_area_1_icon:color`, imposta la sorgente su `play_area_1_icon`, la condizione su **è compilato** e il valore da assegnare, ad esempio `#D84A38`. Per associare colori diversi a valori diversi, aggiungi più regole: si applica la prima corrispondenza. Attiva **Nascondi nell’editor carte** per tenere il campo fuori dalla scheda; resterà presente nel foglio esportato.

L’app salva i propri dati in `.tabletop-card-studio/` nella cartella del progetto aperto. I set CMS sono salvati singolarmente in `.tabletop-card-studio/sets/`, con un `index.json` che li elenca. Alla prima apertura il vecchio `sets.json` viene migrato automaticamente e conservato in `.tabletop-card-studio/migration-backups/`. Se il JSON nativo cambia mentre Card Studio è aperto, le modifiche CMS restano salvate e l’app avvisa che la sincronizzazione verso Tabletop Creator è stata saltata; il motivo viene registrato nel log diagnostico. Le immagini importate vengono copiate in `assets/images/card-studio/`; nei campi immagine e negli export viene mantenuto il riferimento Tabletop Creator `card-studio/nome.png`. I fogli Excel originali non vengono modificati; gli export sono raccolti in `exports/` e ogni file include il set e la data/ora di generazione nel nome.

I tag e i tipi Card Studio delle variabili sono metadati separati salvati in `.tabletop-card-studio/variable-tags.json` e `variable-types.json`; le definizioni delle variabili continuano a essere salvate nel formato di Tabletop Creator in `data/variables.json`. Le anteprime icona usano gli asset del progetto in `assets/icons/` e, se disponibile localmente, la libreria integrata di Tabletop Creator.

## Nuove release

I pacchetti Windows, macOS (Intel e Apple Silicon) e Linux vengono creati automaticamente quando viene pubblicato un tag `v*`.

## Log diagnostico

Card Studio registra avvio, operazioni sui set e dettagli degli errori in un log locale. Per aprirlo, vai in **Impostazioni progetto → Apri log diagnostico**. Il file si trova nella cartella dati utente dell’app, in `logs/tabletop-card-studio.log`. I contenuti delle carte non vengono registrati.
