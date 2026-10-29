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
- Reimporta un foglio già collegato a un set: scegli i campi da importare e ripristina le colonne presenti nel foglio ma rimosse dal set, abbina le carte tramite una colonna, applica gli aggiornamenti Excel non in conflitto e scegli per campo nei conflitti; le carte assenti dal foglio restano nel set.
- Crea campi di testo, testo lungo, numero, select, colore, immagine e variabile; riordina le colonne e salva le modifiche prima di applicarle.
- Nascondi campi nell’editor senza escluderli dall’Excel e configura regole che compilano valori automaticamente in base ad altri campi (ad esempio colore predefinito quando un’icona è assegnata).
- Assegna tag e stato alle carte, cerca e filtra per campi e ordina l’archivio.
- Consulta statistiche per tag e proprietà, anche incrociando due campi e contando carte uniche o copie.
- Crea e modifica le variabili di `data/variables.json`, assegnagli tag o i tipi Card Studio **Colore salvato** e **Icona**. Le icone Tabletop Creator e quelle in `assets/icons/` vengono mostrate in anteprima nei campi testo e variabile. I campi variabile restano modificabili, salvo quando hanno regole condizionali.
- Gestisci gli asset del progetto e usa le variabili di Tabletop Creator nei campi testuali.
- Esporta ogni set in `exports/` con nome del set e data/ora nel nome del file e nei metadati del workbook.
- Collega un repository GitHub e gestisci commit, pull e push con le credenziali Git del computer.

Per creare un valore automatico, apri **Campi e colonne**, espandi **Regole automatiche e visibilità** sul campo da compilare e aggiungi una regola. Per `play_area_1_icon:color`, imposta la sorgente su `play_area_1_icon`, la condizione su **è compilato** e il valore da assegnare, ad esempio `#D84A38`. Per associare colori diversi a valori diversi, aggiungi più regole: si applica la prima corrispondenza. Attiva **Nascondi nell’editor carte** per tenere il campo fuori dalla scheda; resterà presente nel foglio esportato.

L’app salva i propri dati in `.tabletop-card-studio/` nella cartella del progetto aperto. Le immagini importate vengono copiate in `assets/images/card-studio/`; nei campi immagine e negli export viene mantenuto il riferimento Tabletop Creator `card-studio/nome.png`. I fogli Excel originali non vengono modificati; gli export sono raccolti in `exports/` e ogni file include il set e la data/ora di generazione nel nome.

I tag e i tipi Card Studio delle variabili sono metadati separati salvati in `.tabletop-card-studio/variable-tags.json` e `variable-types.json`; le definizioni delle variabili continuano a essere salvate nel formato di Tabletop Creator in `data/variables.json`. Le anteprime icona usano gli asset del progetto in `assets/icons/` e, se disponibile localmente, la libreria integrata di Tabletop Creator.

## Nuove release

I pacchetti Windows, macOS (Intel e Apple Silicon) e Linux vengono creati automaticamente quando viene pubblicato un tag `v*`.
