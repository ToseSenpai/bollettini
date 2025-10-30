# 📋 Generatore Bollettini

<div align="center">

**Applicazione desktop automatizzata per la generazione di bollettini sanitá**

[![Electron](https://img.shields.io/badge/Electron-31.7.7-47848F?logo=electron)](https://www.electronjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)](https://www.microsoft.com/windows)

[Caratteristiche](#-caratteristiche) •
[Installazione](#-installazione) •
[Utilizzo](#-utilizzo) •
[Sviluppo](#-sviluppo) •
[Release](#-release)

</div>

---

## 📖 Descrizione

Generatore Bollettini è un'applicazione desktop che automatizza il processo di creazione di bollettini sanitá a partire da file Excel. L'applicazione combina un'interfaccia utente moderna costruita con Electron e un potente backend Python per l'elaborazione dei dati e la generazione dei documenti.

### Architettura

```
┌─────────────────────────────────────┐
│     Electron Frontend (UI)          │
│  • Interfaccia utente moderna       │
│  • Gestione file Excel              │
│  • Progress tracking                │
│  • Sistema auto-update              │
└──────────────┬──────────────────────┘
               │ IPC Communication
┌──────────────▼──────────────────────┐
│     Python Backend (Logic)          │
│  • Elaborazione dati Excel          │
│  • Generazione PDF                  │
│  • Web scraping (Playwright)        │
│  • Compilato in .exe standalone     │
└─────────────────────────────────────┘
```

---

## ✨ Caratteristiche

### 🎯 Funzionalità Principali

- **Elaborazione Batch**: Processa multiple causali da file Excel in automatico
- **Generazione PDF**: Crea bollettini sanitá in formato PDF pronto per la stampa
- **Web Automation**: Integrazione con portali web tramite Playwright
- **CAPTCHA Handling**: Risoluzione interattiva dei CAPTCHA durante il processo
- **Aggiornamenti Automatici**: Sistema di auto-update via GitHub Releases
- **Interfaccia Moderna**: UI fluida con animazioni e feedback visivo

### 🚀 Tecnologie

| Componente | Tecnologia | Versione | Scopo |
|:-----------|:-----------|:---------|:------|
| **Desktop Framework** | Electron | 31.7.7 | Applicazione desktop cross-platform |
| **Frontend Runtime** | Node.js | Latest LTS | Esecuzione JavaScript e gestione dipendenze |
| **Backend Language** | Python | 3.12 | Logica business e elaborazione dati |
| **Backend Packaging** | PyInstaller | 6.14.2 | Compilazione Python → .exe standalone |
| **App Builder** | electron-builder | 25.1.8 | Creazione installer Windows |
| **Auto-Update** | electron-updater | 6.6.2 | Sistema aggiornamenti automatici |
| **Data Processing** | Pandas | 2.2.2 | Manipolazione dati Excel |
| **Web Automation** | Playwright | Latest | Automazione browser headless |
| **PDF Manipulation** | PyMuPDF | Latest | Estrazione e manipolazione PDF |
| **Excel I/O** | Openpyxl | Latest | Lettura/scrittura file Excel |

---

## 📦 Installazione

### Per Utenti Finali

1. Scarica l'ultima versione da [GitHub Releases](../../releases)
2. Esegui `GeneratoreBollettini-X.X.X-Setup.exe`
3. Segui la procedura guidata di installazione
4. L'app verificherà automaticamente gli aggiornamenti all'avvio

### Per Sviluppatori

#### Prerequisiti

- **Node.js** 18+ (LTS)
- **Python** 3.12+
- **Git**
- **Windows** 10/11

#### Setup Ambiente di Sviluppo

```bash
# 1. Clona il repository
git clone https://github.com/ToseSenpai/bollettini.git
cd bollettini

# 2. Installa dipendenze Node.js
npm install

# 3. Installa dipendenze Python (usa Python 3.12)
py -3.12 -m pip install -r requirements.txt

# 4. Installa browser Playwright
py -3.12 -m playwright install chromium

# 5. Avvia in modalità sviluppo
npm start
```

---

## 🎮 Utilizzo

### Interfaccia Utente

1. **Seleziona File Excel**: Clicca su "Seleziona File" e scegli il file Excel contenente le causali
2. **Verifica Causali**: L'app mostrerà il numero di causali trovate
3. **Avvia Processo**: Clicca "Avvia" per iniziare l'elaborazione
4. **Monitoraggio**: Osserva la progress bar e i messaggi di stato
5. **CAPTCHA**: Se richiesto, inserisci il codice CAPTCHA visualizzato
6. **Completamento**: I bollettini PDF saranno salvati nella cartella specificata

### Configurazione

Il file `config.ini` nella cartella di installazione contiene:

```ini
[Credenziali]
RAGIONE_SOCIALE = DHL EXPRESS ITALY
CODICE_FISCALE = 04209680158
EMAIL = itcustoms.mxbhub@dhl.com

[Impostazioni]
HEADLESS = true  # false per vedere il browser durante l'automazione
```

---

## 🛠️ Sviluppo

### Struttura del Progetto

```
bollettini/
├── main.js              # Main process Electron
├── renderer.js          # Renderer process (UI logic)
├── preload.js           # Preload script (IPC bridge)
├── index.html           # UI HTML
├── backend.py           # Backend Python
├── backend.spec         # PyInstaller spec file
├── config.ini           # Configuration file
├── package.json         # Node dependencies & build config
├── requirements.txt     # Python dependencies
├── RELEASE_PROCESS.md   # Release workflow documentation
└── dist/                # Build output (ignored in git)
```

### Script Disponibili

```bash
# Sviluppo
npm start                    # Avvia app in dev mode
npm run clean-build         # Pulisce cartelle build/dist

# Build
npm run build-backend       # Compila backend Python → .exe
npm run build-backend-zip   # Build backend + crea backend.zip
npm run build               # Build completo installer Windows
npm run build-full          # Build backend + installer

# Release (vedi RELEASE_PROCESS.md)
npm run publish             # Build e pubblica su GitHub
```

### Debug

- **DevTools**: Apri automaticamente all'avvio (configurabile in `main.js`)
- **Logs Backend**: Visibili nella console DevTools
- **Log Files**: Salvati in `%APPDATA%/bollettini/logs/`

### Modificare la UI

1. Modifica `index.html` per la struttura
2. Modifica gli stili CSS inline o aggiungi file `.css`
3. Modifica `renderer.js` per la logica UI
4. Hot reload non disponibile - riavvia con `npm start`

---

## 🚢 Release

### Processo di Release Completo

Vedi [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) per la guida dettagliata.

#### Quick Start

1. **Incrementa versione** in `package.json`:
   ```json
   {
     "version": "1.0.3"
   }
   ```

2. **Build backend e installer**:
   ```bash
   npm run build-backend-zip
   npm run build
   ```

3. **Crea release su GitHub**:
   - Tag: `v1.0.3`
   - Carica da `dist/`:
     - `GeneratoreBollettini-1.0.3-Setup.exe`
     - `latest.yml`

4. **Test**: Installa versione precedente e verifica auto-update

### Sistema Auto-Update

- ✅ **Controllo automatico** all'avvio
- ✅ **Download in background** con progress bar
- ✅ **Installazione one-click** con riavvio automatico
- ✅ **Rollback** manuale reinstallando versione precedente
- ✅ **Backend incluso** nell'installer (no download separato)

---

## 📋 Requisiti di Sistema

### Minimi

- **OS**: Windows 10 (64-bit)
- **RAM**: 4 GB
- **Disco**: 500 MB disponibili
- **Connessione**: Internet (per aggiornamenti e web scraping)

### Consigliati

- **OS**: Windows 11 (64-bit)
- **RAM**: 8 GB+
- **Disco**: 1 GB disponibili
- **Connessione**: Banda larga

---

## 🔒 Sicurezza

- ✅ **Code Isolation**: Context isolation abilitato
- ✅ **CSP**: Content Security Policy configurato
- ✅ **No Remote Code**: Nessun codice remoto eseguito
- ✅ **Secure IPC**: Comunicazione sicura main ↔ renderer
- ⚠️ **Code Signing**: Non ancora implementato (TODO)

---

## 🐛 Troubleshooting

### L'app non si avvia

- Verifica che non ci siano altri processi Electron in esecuzione
- Controlla i log in `%APPDATA%/bollettini/logs/`
- Reinstalla l'applicazione

### Errori durante l'elaborazione

- Verifica che il file Excel sia nel formato corretto
- Controlla la connessione internet
- Verifica le credenziali in `config.ini`

### Auto-update non funziona

- Verifica la connessione internet
- Controlla che la release su GitHub sia pubblica
- Verifica che `latest.yml` sia presente nella release

---

## 🤝 Contribuire

Questo è un progetto interno DHL. Per contribuire:

1. Crea un branch per la tua feature: `git checkout -b feature/nome-feature`
2. Commit delle modifiche: `git commit -m 'Add some feature'`
3. Push al branch: `git push origin feature/nome-feature`
4. Apri una Pull Request

---

## 📄 License

Proprietario - Simone Tosello
Tutti i diritti riservati © 2025

---

## 👨‍💻 Autore

**Simone Tosello** - Developer @ DHL Express Italy

---

## 🙏 Ringraziamenti

- Team MXPCUS DHL per il testing
- Electron community per il framework
- Python community per le eccellenti librerie

---

<div align="center">

**Made with ❤️ by ST for DHL Express Italy**

[⬆ Torna su](#-generatore-bollettini)

</div>
