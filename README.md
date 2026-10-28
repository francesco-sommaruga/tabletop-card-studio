# Tabletop Card Studio

App desktop per organizzare progetti Tabletop Creator, gestire più set di carte e preparare esportazioni Excel con campi configurabili.

## Installazione

Scarica l’ultima versione dalla pagina [Releases](https://github.com/francesco-sommaruga/tabletop-card-studio/releases) e scegli il pacchetto per il tuo sistema.

### Windows

1. Scarica il file `.exe` dalla release.
2. Avvialo e segui i passaggi del programma d’installazione.
3. Apri **Tabletop Card Studio** dal menu Start.

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
- Crea campi di testo, testo lungo, numero, select e immagine; riordina le colonne e salva le modifiche prima di applicarle.
- Assegna tag e stato alle carte, cerca e filtra per campi e ordina l’archivio.
- Consulta statistiche per tag e proprietà, anche incrociando due campi e contando carte uniche o copie.
- Gestisci gli asset del progetto e usa le variabili di `data/variables.json` nei campi testuali.
- Esporta ogni set in un foglio `.xlsx` separato.
- Collega un repository GitHub e gestisci commit, pull e push con le credenziali Git del computer.

L’app salva i propri dati in `.tabletop-card-studio/` nella cartella del progetto aperto. Le immagini importate vengono copiate in `assets/card-studio/`. I fogli Excel originali non vengono modificati; l’esportazione crea un file `*-cms-export.xlsx`.

## Nuove release

I pacchetti Windows, macOS (Intel e Apple Silicon) e Linux vengono creati automaticamente quando viene pubblicato un tag `v*`.
