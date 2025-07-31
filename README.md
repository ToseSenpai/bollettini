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
| **Packaging App** | **electron-packager**| Impacchetta l'applicazione Electron per la distribuzione. |
| **Gestione Dipendenze** | **NPM** | Gestore di pacchetti per le librerie JavaScript/Node.js. |
| **Manipolazione Dati** | **Pandas** | Libreria Python per l'analisi e la manipolazione dei dati. |
| **Interazione Web** | **Playwright** | Libreria per automatizzare le operazioni del browser. |
| **Manipolazione PDF** | **PyMuPDF** | Libreria per l'estrazione di dati e la manipolazione di PDF. |
| **Interazione Excel** | **Openpyxl** | Libreria per leggere e scrivere file Excel. |
