# Generatore Bollettini

Applicazione desktop per la generazione di bollettini.

## Descrizione

Questa applicazione è stata sviluppata per semplificare e automatizzare la creazione di bollettini. 

L'architettura ibrida si compone di:
- **Frontend**: Un'applicazione desktop creata con **Electron**.
- **Backend**: Uno script **Python** compilato in un eseguibile autonomo (`.exe`) tramite **PyInstaller**. Questo garantisce che la logica di business funzioni su qualsiasi macchina Windows, anche senza una versione di Python installata.

## Tecnologie Utilizzate

| Componente | Tecnologia | Scopo |
| :--- | :--- | :--- |
| **Applicazione Desktop** | **Electron** | Framework per creare l'applicazione desktop. |
| **Runtime Frontend** | **Node.js** | Ambiente per eseguire JavaScript e gestire le dipendenze. |
| **Logica di Backend** | **Python** | Linguaggio per la logica di generazione dei documenti. |
| **Packaging Backend** | **PyInstaller** | Compila lo script Python in un singolo eseguibile. |
| **Packaging App** | **electron-builder**| Impacchetta l'applicazione Electron per la distribuzione. |
| **Auto-Update** | **electron-updater** | Sistema di aggiornamenti automatici via GitHub Releases. |
| **Gestione Dipendenze** | **NPM** | Gestore di pacchetti per le librerie JavaScript/Node.js. |
| **Manipolazione Dati** | **Pandas** | Libreria Python per l'analisi e la manipolazione dei dati. |
| **Interazione Web** | **Playwright** | Libreria per automatizzare le operazioni del browser. |
| **Manipolazione PDF** | **PyMuPDF** | Libreria per l'estrazione di dati e la manipolazione di PDF. |
| **Interazione Excel** | **Openpyxl** | Libreria per leggere e scrivere file Excel. |

## Installazione e Avvio

### Prerequisiti
- Node.js (versione LTS)
- Python 3.8+
- Git

### Setup iniziale
```bash
# Clona il repository
git clone <repository-url>
cd bollettini

# Installa dipendenze Node.js
npm install

# Installa dipendenze Python
pip install -r requirements.txt

# Installa browser Playwright
playwright install

# Avvia l'applicazione
npm start
```

## Build e Distribuzione

### Build per sviluppo
```bash
npm run build
```
Genera l'installer MSI nella cartella `dist/` senza pubblicare su GitHub.

### Pubblicazione su GitHub Releases
```bash
npm run publish
```
Compila l'applicazione e pubblica automaticamente su GitHub Releases.

### Processo di rilascio

1. **Incrementa la versione** in `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. **Esegui il build e pubblica**:
   ```bash
   npm run publish
   ```

3. **Crea una release su GitHub**:
   - Vai su GitHub → Releases → Create a new release
   - Tag: `v1.0.1` (deve corrispondere alla versione in package.json)
   - Title: `Release v1.0.1`
   - Carica il file `.msi` generato in `dist/` come asset

4. **Le app installate riceveranno automaticamente la notifica** di aggiornamento disponibile.

### Caratteristiche dell'installer

- **Formato**: MSI (Microsoft Installer)
- **Installazione**: Per utente singolo (no permessi amministratore richiesti)
- **Directory**: `%LOCALAPPDATA%\Programs\Generatore Bollettini`
- **Shortcut**: Desktop e Start Menu
- **Lingua**: Italiano

### Sistema di aggiornamenti automatici

- **Controllo**: All'avvio dell'applicazione
- **Notifica**: Banner nell'interfaccia quando disponibile un aggiornamento
- **Download**: Automatico in background
- **Installazione**: Un click per installare e riavviare
- **Hosting**: GitHub Releases (gratuito)

## Configurazione

Il file `config.ini` contiene le credenziali e le impostazioni:

```ini
[Credenziali]
RAGIONE_SOCIALE = DHL EXPRESS ITALY
CODICE_FISCALE = 04209680158
EMAIL = itcustoms.mxbhub@dhl.com

[Impostazioni]
HEADLESS = true
```

## Note per gli sviluppatori

- **Certificato di code signing**: Quando disponibile, aggiungere `certificateFile` e `certificatePassword` nella sezione `win` di electron-builder per evitare l'avviso "Publisher Unknown"
- **Testing**: Testare sempre l'installer e gli aggiornamenti prima del deploy aziendale
- **Versioning**: Usare semantic versioning (es. 1.0.0, 1.0.1, 1.1.0)
