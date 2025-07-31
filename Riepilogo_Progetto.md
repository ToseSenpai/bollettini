# Riepilogo Tecnico: Progetto "Generatore Bollettini"

Questo documento riassume l'architettura, le tecnologie, le considerazioni di sicurezza e le procedure di deployment per il progetto "Generatore Bollettini".

---

### 1. Descrizione del Progetto

**Nome:** `bollettini`
**Scopo:** Applicazione desktop per la generazione di bollettini.

L'applicazione è progettata con un'architettura ibrida per combinare i vantaggi di una moderna interfaccia utente con la potenza di un backend robusto.

*   **Frontend (Interfaccia Utente):** Un'applicazione desktop creata con **Electron**. Questo permette di usare tecnologie web (HTML, CSS, JavaScript) per un'esperienza utente ricca e moderna.
*   **Backend (Logica di Generazione):** Uno script **Python** che gestisce tutta la logica di business per la creazione dei bollettini. Lo script viene compilato in un eseguibile autonomo (`.exe`) tramite **PyInstaller** per garantire che funzioni su qualsiasi macchina Windows, anche senza Python installato.

---

### 2. Tecnologie Utilizzate

| Componente | Tecnologia | Scopo |
| :--- | :--- | :--- |
| **Applicazione Desktop** | **Electron** | Framework per creare l'applicazione desktop multipiattaforma. |
| **Runtime Frontend** | **Node.js** | Ambiente per eseguire JavaScript e gestire le dipendenze del frontend. |
| **Logica di Backend** | **Python** | Linguaggio usato per la logica di generazione dei documenti. |
| **Packaging Backend** | **PyInstaller** | Compila lo script Python in un singolo eseguibile. |
| **Packaging App** | **electron-packager** | Impacchetta l'applicazione Electron per la distribuzione. |
| **Gestione Dipendenze** | **NPM** | Gestore di pacchetti per le librerie JavaScript/Node.js. |

---

### 3. File da Fornire per Analisi di Sicurezza

Per un'analisi di sicurezza completa, è necessario fornire i seguenti file e cartelle:

*   **Codice Sorgente Scritto:**
    *   `main.js` (entry point di Electron)
    *   Tutti i file dell'interfaccia utente (`.html`, `.js`, `.css`)
    *   Tutti gli script Python (`.py`)
*   **File di Build e Configurazione:**
    *   `package.json` (elenca le dipendenze di primo livello)
    *   `package-lock.json` (fissa le versioni esatte di tutte le dipendenze, cruciale per l'analisi)
    *   `backend.spec` (file di configurazione di PyInstaller)
    *   `config.ini` (file di configurazione dell'applicazione)

---

### 4. Prerequisiti e Istruzioni per l'Esecuzione

#### A) Per uno Sviluppatore (Esecuzione da Sorgente)

1.  **Prerequisiti Software:**
    *   Node.js e NPM
    *   Python e PIP
2.  **Setup del Progetto:**
    *   Eseguire `npm install` per scaricare le dipendenze Node.js.
    *   Installare le dipendenze Python (es. `pip install pyinstaller <altre-librerie>`).
3.  **Avvio:**
    *   Eseguire `npm run build-backend` per creare l'eseguibile Python.
    *   Eseguire `npm start` per avviare l'applicazione in modalità sviluppo.

#### B) Per l'Utente Finale (Applicazione Distribuita)

1.  **Prerequisiti Software:**
    *   **Nessuno.** L'utente non necessita di Node.js o Python.
2.  **Distribuzione:**
    *   Eseguire il comando `npm run dist` per generare la cartella di distribuzione in `release-builds`.
    *   Consegnare all'utente il contenuto di questa cartella. L'utente dovrà semplicemente avviare l'eseguibile principale (es. `generatore-bollettini.exe`). 