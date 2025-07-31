# Generatore Bollettini

Applicazione desktop per la generazione di bollettini.

## Descrizione

Questa applicazione è stata sviluppata per semplificare e automatizzare la creazione di bollettini. Combina un'interfaccia utente moderna, costruita con tecnologie web, con un potente backend in Python per la logica di generazione dei documenti.

L'architettura ibrida si compone di:
- **Frontend**: Un'applicazione desktop creata con **Electron**, che offre un'esperienza utente ricca e interattiva.
- **Backend**: Uno script **Python** compilato in un eseguibile autonomo (`.exe`) tramite **PyInstaller**. Questo garantisce che la logica di business funzioni su qualsiasi macchina Windows, anche senza una versione di Python installata.

## Tecnologie Utilizzate

| Componente | Tecnologia | Scopo |
| :--- | :--- | :--- |
| **Applicazione Desktop** | **Electron** | Framework per creare l'applicazione desktop. |
| **Runtime Frontend** | **Node.js** | Ambiente per eseguire JavaScript e gestire le dipendenze. |
| **Logica di Backend** | **Python** | Linguaggio per la logica di generazione dei documenti. |
| **Packaging Backend** | **PyInstaller** | Compila lo script Python in un singolo eseguibile. |
| **Packaging App** | **electron-packager**| Impacchetta l'applicazione Electron per la distribuzione. |
| **Gestione Dipendenze** | **NPM** | Gestore di pacchetti per le librerie JavaScript/Node.js. |
| **Manipolazione Dati** | **Pandas** | Libreria Python per l'analisi e la manipolazione dei dati. |
| **Interazione Web** | **Playwright** | Libreria per automatizzare le operazioni del browser. |
| **Manipolazione PDF** | **PyMuPDF** | Libreria per l'estrazione di dati e la manipolazione di PDF. |
| **Interazione Excel** | **Openpyxl** | Libreria per leggere e scrivere file Excel. |

## Prerequisiti

Per eseguire il progetto in un ambiente di sviluppo, sono necessari i seguenti strumenti:

- **Node.js e NPM**: [Scarica e installa Node.js](https://nodejs.org/)
- **Python e PIP**: [Scarica e installa Python](https://www.python.org/downloads/)

## Installazione e Avvio

Segui questi passaggi per configurare e avviare il progetto in locale.

1.  **Clona il repository:**
    ```bash
    git clone https://github.com/tuo-utente/bollettini.git
    cd bollettini
    ```

2.  **Installa le dipendenze Node.js:**
    ```bash
    npm install
    ```

3.  **Installa le dipendenze Python:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Crea l'eseguibile del backend:**
    Questo comando compila lo script Python e copia i file di configurazione necessari.
    ```bash
    npm run build-backend
    ```

5.  **Avvia l'applicazione:**
    Questo comando avvia l'applicazione Electron in modalità di sviluppo.
    ```bash
    npm start
    ```

## Creazione della Build di Distribuzione

Per creare una versione distribuibile dell'applicazione per Windows, esegui il seguente comando:

```bash
npm run dist
```

Questo processo eseguirà le seguenti operazioni:
1.  Pulirà le cartelle di build precedenti.
2.  Compilerà il backend Python.
3.  Impacchetterà l'applicazione Electron in una cartella `release-builds`.

Il risultato sarà un'applicazione autonoma che può essere eseguita su qualsiasi macchina Windows a 64 bit senza la necessità di installare Node.js o Python. 