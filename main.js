const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Sposta la determinazione di isDev dopo che app è disponibile
let isDev;
let mainWindow;
let pythonProcess;
let autoUpdater; // Sarà inizializzato dopo che app è pronto

// Configurazione per il download del backend - sarà inizializzata dopo che app è pronto
let BACKEND_CONFIG;

// --- Gestione Backend Download ---

/**
 * Verifica se il backend è già presente localmente E della versione corretta
 */
function isBackendAvailable() {
    // Verifica varie strutture possibili (dalla più probabile alla meno)
    const possiblePaths = [
        path.join(BACKEND_CONFIG.localPath, 'backend', 'backend', 'backend.exe'), // backend/backend/backend.exe
        path.join(BACKEND_CONFIG.localPath, 'backend', 'backend.exe'), // backend/backend.exe (corretto!)
        path.join(BACKEND_CONFIG.localPath, 'backend.exe') // backend.exe
    ];
    
    let backendPath = null;
    for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
            backendPath = testPath;
            console.log('Backend trovato in:', backendPath);
            break;
        }
    }
    
    if (!backendPath) {
        console.log('Backend non trovato in nessuno dei percorsi possibili');
        return false;
    }
    
    // Verifica la versione del backend
    const versionFile = path.join(BACKEND_CONFIG.localPath, 'version.txt');
    if (fs.existsSync(versionFile)) {
        const installedVersion = fs.readFileSync(versionFile, 'utf8').trim();
        console.log('Versione backend installata:', installedVersion);
        console.log('Versione backend richiesta:', BACKEND_CONFIG.version);
        
        if (installedVersion === BACKEND_CONFIG.version) {
            console.log('✓ Versione backend corretta');
            return true;
        } else {
            console.log('✗ Versione backend non corretta, richiesto aggiornamento');
            return false;
        }
    } else {
        console.log('⚠ File version.txt non trovato, assumo backend vecchio');
        return false;
    }
}

/**
 * Verifica se backend.zip è incluso nell'installer
 */
function isBackendZipIncluded() {
    if (isDev) {
        const backendZipPath = path.join(__dirname, 'backend.zip');
        return fs.existsSync(backendZipPath);
    } else {
        // In produzione, cerca in app.asar.unpacked
        const possiblePaths = [
            path.join(process.resourcesPath, 'app.asar.unpacked', 'backend.zip'),
            path.join(process.resourcesPath, 'backend.zip')
        ];
        
        for (const zipPath of possiblePaths) {
            if (fs.existsSync(zipPath)) {
                console.log('Backend.zip trovato in:', zipPath);
                return zipPath; // Ritorna il path per usarlo dopo
            }
        }
        return null;
    }
}

/**
 * Estrae il backend dall'installer
 */
async function extractBackend(zipFilePath = BACKEND_CONFIG.zipPath) {
    return new Promise((resolve, reject) => {
        console.log('Estrazione backend da:', zipFilePath);
        console.log('Destinazione estrazione:', BACKEND_CONFIG.localPath);

        // Invia messaggio di inizio estrazione
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('from-python', { type: 'backend-extract-start', payload: 'Estrazione in corso...' });
        }

        // Assicurati che la cartella di destinazione esista
        if (!fs.existsSync(BACKEND_CONFIG.localPath)) {
            fs.mkdirSync(BACKEND_CONFIG.localPath, { recursive: true });
            console.log('Cartella di destinazione creata:', BACKEND_CONFIG.localPath);
        }

        // Usa PowerShell per estrarre il ZIP
        const process = spawn('powershell', ['-Command', `Expand-Archive -Path '${zipFilePath}' -DestinationPath '${BACKEND_CONFIG.localPath}' -Force`]);

        let stdoutData = '';
        process.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        process.stderr.on('data', (data) => {
            console.log('Stderr estrazione:', data.toString());
        });

        process.on('close', (code) => {
            console.log('Codice uscita estrazione:', code);
            console.log('Output PowerShell:', stdoutData);

            if (code === 0) {
                console.log('Estrazione completata, verifica contenuti...');

                // Lista il contenuto della cartella di destinazione
                try {
                    const contents = fs.readdirSync(BACKEND_CONFIG.localPath);
                    console.log('Contenuto cartella destinazione:', contents);

                    // Verifica ricorsivamente la struttura
                    const checkStructure = (dir) => {
                        const items = fs.readdirSync(dir);
                        console.log('Contenuto:', dir, '->', items);
                        items.forEach(item => {
                            const fullPath = path.join(dir, item);
                            const stat = fs.statSync(fullPath);
                            if (stat.isDirectory()) {
                                checkStructure(fullPath);
                            } else if (item.endsWith('.exe')) {
                                console.log('File .exe trovato:', fullPath);
                            }
                        });
                    };
                    checkStructure(BACKEND_CONFIG.localPath);
                } catch (err) {
                    console.error('Errore verifica contenuti:', err);
                }

                // Rimuovi il file ZIP dopo l'estrazione (se esiste)
                try {
                    if (fs.existsSync(BACKEND_CONFIG.zipPath)) {
                        fs.unlinkSync(BACKEND_CONFIG.zipPath);
                        console.log('File ZIP rimosso');
                    }
                } catch (err) {
                    console.log('Impossibile rimuovere ZIP:', err.message);
                }

                // Scrivi il file di versione
                const versionFile = path.join(BACKEND_CONFIG.localPath, 'version.txt');
                fs.writeFileSync(versionFile, BACKEND_CONFIG.version);
                console.log('Versione backend salvata:', BACKEND_CONFIG.version);

                // Attendi un momento prima di completare
                setTimeout(() => {
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('from-python', { type: 'backend-extract-complete', payload: 'Estrazione completata' });
                    }
                    resolve();
                }, 500);
            } else {
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('from-python', { type: 'backend-extract-error', payload: `Estrazione fallita con codice ${code}` });
                }
                reject(new Error(`Estrazione fallita con codice ${code}`));
            }
        });

        process.on('error', (err) => {
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('from-python', { type: 'backend-extract-error', payload: err.message });
            }
            reject(err);
        });
    });
}

/**
 * Inizializza il backend (estrazione da installer)
 */
async function initializeBackend() {
    try {
        // In modalità sviluppo, usa Python direttamente
        if (isDev) {
            console.log('Modalità sviluppo: uso Python direttamente');
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('backend-status', 'Modalità sviluppo: Python disponibile');
                // Aspetta che la pagina sia caricata prima di inviare backend-ready
                if (mainWindow.webContents.isLoading()) {
                    mainWindow.webContents.once('did-finish-load', () => {
                        mainWindow.webContents.send('from-python', { type: 'backend-ready', payload: 'Backend pronto (dev mode)' });
                    });
                } else {
                    mainWindow.webContents.send('from-python', { type: 'backend-ready', payload: 'Backend pronto (dev mode)' });
                }
            }
            return true;
        }

        // Verifica se il backend è già presente e valido
        if (isBackendAvailable()) {
            console.log('Backend già presente e verificato');
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('backend-status', 'Backend verificato e pronto');
                // Aspetta che la pagina sia caricata prima di inviare backend-ready
                if (mainWindow.webContents.isLoading()) {
                    mainWindow.webContents.once('did-finish-load', () => {
                        mainWindow.webContents.send('from-python', { type: 'backend-ready', payload: 'Backend già disponibile' });
                    });
                } else {
                    mainWindow.webContents.send('from-python', { type: 'backend-ready', payload: 'Backend già disponibile' });
                }
            }
            return true;
        }

        // Il backend non è presente o è obsoleto, estraiamolo dall'installer
        console.log('Backend non trovato o versione obsoleta, preparazione estrazione...');

        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('backend-status', 'Aggiornamento backend...');
        }

        // Se esiste una vecchia installazione del backend, eliminala
        if (fs.existsSync(BACKEND_CONFIG.localPath)) {
            console.log('Rimozione backend obsoleto da:', BACKEND_CONFIG.localPath);
            try {
                fs.rmSync(BACKEND_CONFIG.localPath, { recursive: true, force: true });
                console.log('Backend obsoleto rimosso con successo');
            } catch (err) {
                console.warn('Impossibile rimuovere completamente il backend obsoleto:', err.message);
                // Continua comunque, l'estrazione potrebbe sovrascrivere
            }
        }

        // Trova backend.zip incluso nell'installer
        const includedBackendZip = isBackendZipIncluded();
        if (!includedBackendZip) {
            throw new Error('backend.zip non trovato nell\'installer. Reinstallare l\'applicazione.');
        }

        console.log('Trovato backend.zip nell\'installer, estrazione...');
        const zipPath = isDev ? path.join(__dirname, 'backend.zip') : includedBackendZip;

        // Estrai il backend
        await extractBackend(zipPath);

        // Verifica che l'estrazione sia riuscita
        if (isBackendAvailable()) {
            console.log('Backend estratto con successo');
            mainWindow.webContents.send('backend-status', 'Backend pronto');
            return true;
        } else {
            throw new Error('Backend estratto ma non trovato. Verifica l\'installazione.');
        }

    } catch (error) {
        console.error('Errore durante l\'inizializzazione del backend:', error);
        mainWindow.webContents.send('backend-error', `Errore backend: ${error.message}`);
        return false;
    }
}

function getBackendPath() {
    if (isDev) {
        // Su Windows usa py launcher per Python 3.12
        return { command: 'py', args: ['-3.12'], script: path.join(__dirname, 'backend.py') };
    }
    // Usa il backend scaricato localmente - prova tutte le strutture possibili
    let backendPath = path.join(BACKEND_CONFIG.localPath, 'backend', 'backend.exe');
    if (!fs.existsSync(backendPath)) {
        backendPath = path.join(BACKEND_CONFIG.localPath, 'backend', 'backend', 'backend.exe');
        if (!fs.existsSync(backendPath)) {
            backendPath = path.join(BACKEND_CONFIG.localPath, 'backend.exe');
            if (!fs.existsSync(backendPath)) {
                throw new Error('Backend non disponibile. Reinstallare l\'applicazione o contattare il supporto.');
            }
        }
    }
    return { command: backendPath, script: null };
}

function spawnBackendProcess(args) {
    const backend = getBackendPath();
    if (isDev) {
        // Combina gli argomenti di Python con lo script e gli argomenti dell'applicazione
        const pythonArgs = backend.args ? [...backend.args, backend.script, ...args] : [backend.script, ...args];
        return spawn(backend.command, pythonArgs);
    }
    return spawn(backend.command, args);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'logost.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false, // Per una finestra senza la cornice standard
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: 'rgba(0, 0, 0, 0)', // Rende la barra del titolo trasparente
      symbolColor: '#ffffff'     // Colore per i pulsanti (chiudi, minimizza, etc.)
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenu(null);

  // Apri DevTools automaticamente per debug auto-update
  mainWindow.webContents.openDevTools();
}

function countCausali(excelPath) {
    try {
        const process = spawnBackendProcess(['--count-causali', excelPath]);
        
        process.stdout.on('data', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                console.log('Risposta dal backend (conteggio):', parsed);
                mainWindow.webContents.send('from-python', parsed);
            } catch (e) {
                console.error('Dati non-JSON (conteggio) da Python:', data.toString());
            }
        });

        process.stderr.on('data', (data) => {
            console.error('Errore backend (conteggio):', data.toString());
            mainWindow.webContents.send('from-python', { type: 'error', payload: `Errore durante il conteggio: ${data}` });
        });
        
        process.on('error', (err) => {
            console.error('Errore durante avvio backend (conteggio):', err);
            mainWindow.webContents.send('from-python', { type: 'error', payload: `Errore durante l'avvio del backend: ${err.message}` });
        });
    } catch (err) {
        console.error('Errore catturato in countCausali:', err);
        mainWindow.webContents.send('from-python', { type: 'error', payload: `Errore durante il conteggio: ${err.message}` });
    }
}

function startPythonBackend(excelPath) {
    pythonProcess = spawnBackendProcess(['--run-automation', excelPath]);

    let buffer = '';
    pythonProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        let lines = buffer.split('\n');
        buffer = lines.pop(); // L'ultimo elemento potrebbe essere incompleto

        for (const line of lines) {
            if (line.trim() === '') continue;
            try {
                const parsed = JSON.parse(line);
                mainWindow.webContents.send('from-python', parsed);
            } catch (e) {
                console.error('Dati non-JSON da Python:', line);
            }
        }
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Errore da Python: ${data}`);
        mainWindow.webContents.send('from-python', { type: 'error', payload: data.toString() });
    });

    pythonProcess.on('close', (code) => {
        console.log(`Processo Python terminato con codice ${code}`);
    });
}

app.whenReady().then(async () => {
  // Inizializza isDev dopo che app è pronto
  isDev = !app.isPackaged;

  // Inizializza autoUpdater solo dopo che app è pronto
  autoUpdater = require('electron-updater').autoUpdater;

  // Abilita download automatico ma mostriamo comunque un dialog all'utente
  autoUpdater.autoDownload = true;

  // Configura gli event listener di autoUpdater
  autoUpdater.on('checking-for-update', () => {
    console.log('Controllo aggiornamenti in corso...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('✅ Aggiornamento disponibile:', info.version);
    console.log('Dettagli aggiornamento:', JSON.stringify(info, null, 2));
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    } else {
      console.error('❌ mainWindow non disponibile!');
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('ℹ️ Nessun aggiornamento disponibile');
    console.log('Versione corrente:', app.getVersion());
    console.log('Info:', JSON.stringify(info, null, 2));
  });

  autoUpdater.on('error', (err) => {
    console.error('Errore auto-updater:', err);
    // Non inviare errori 404 al frontend (normal quando non ci sono release pubbliche)
    if (!err.message || !err.message.includes('404')) {
      if (mainWindow) mainWindow.webContents.send('update-error', err.message);
    } else {
      console.log('Auto-update non disponibile (nessuna release pubblica su GitHub)');
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "📊 Download: " + Math.round(progressObj.percent) + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);

    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`console.log("${log_message}")`);
      mainWindow.webContents.send('update-download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Aggiornamento scaricato:', info.version);
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`console.log("✅ Aggiornamento scaricato completamente!")`);
      mainWindow.webContents.send('update-downloaded', info);
    }
  });

  // Inizializza BACKEND_CONFIG dopo che app è pronto
  // Legge la versione da package.json per verifiche di compatibilità
  const packageJson = require('./package.json');
  const appVersion = packageJson.version;

  BACKEND_CONFIG = {
    localPath: path.join(app.getPath('userData'), 'backend'),
    zipPath: path.join(app.getPath('userData'), 'backend.zip'),
    version: appVersion // Versione sincronizzata con package.json
  };

  // Crea la finestra ma non la mostra ancora se il backend non è pronto
  createWindow();

  // Inizializza il backend PRIMA di rendere l'app utilizzabile
  try {
    console.log('Inizializzazione backend prima di mostrare l\'interfaccia...');
    await initializeBackend();
    console.log('Backend inizializzato, interfaccia pronta');
  } catch (error) {
    console.error('Errore inizializzazione backend:', error);
    // L'app può continuare anche se il backend non è disponibile
  }
  
  // Controlla aggiornamenti all'avvio (solo in produzione e solo se pubblicata)
  if (!isDev) {
    try {
      checkForUpdates();
    } catch (err) {
      console.log('Auto-update non disponibile:', err.message);
      // Non mostrare l'errore all'utente, è normale in sviluppo
    }
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});

// --- Gestione IPC ---

ipcMain.on('select-excel-file', (event) => {
  dialog.showOpenDialog(mainWindow, {
    title: "Seleziona il file Excel",
    properties: ['openFile'],
    filters: [{ name: 'File Excel', extensions: ['xlsx', 'xls'] }]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      event.sender.send('excel-file-selected', filePath);
      countCausali(filePath);
    }
  });
});

ipcMain.on('start-automation', (event, excelPath) => {
    if (excelPath) {
        startPythonBackend(excelPath);
    }
});

ipcMain.on('to-python', (event, data) => {
    if (pythonProcess) {
        pythonProcess.stdin.write(data + '\n');
    }
});

// --- Gestione Auto-Update ---

function checkForUpdates() {
    const logToRenderer = (msg) => {
        console.log(msg);
        if (mainWindow) {
            mainWindow.webContents.executeJavaScript(`console.log("${msg.replace(/"/g, '\\"')}")`);
        }
    };

    logToRenderer('🔍 Controllo aggiornamenti...');
    logToRenderer(`📦 Versione corrente: ${app.getVersion()}`);
    logToRenderer(`🔧 isDev: ${isDev}`);
    logToRenderer('📡 GitHub repo: ToseSenpai/bollettini');

    // Verifica se siamo in un ambiente con auto-update configurato
    try {
        autoUpdater.checkForUpdates()
            .then(result => {
                logToRenderer(`✅ Check completato: ${JSON.stringify(result)}`);
            })
            .catch(err => {
                logToRenderer(`❌ Errore nel controllo: ${err.message}`);
                console.error('Stack:', err.stack);
            });
    } catch (err) {
        logToRenderer(`❌ Auto-update non configurato: ${err.message}`);
    }
}

// IPC per scaricare aggiornamento
ipcMain.on('download-update', () => {
    console.log('📥 IPC ricevuto: download-update');
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`console.log("📥 Main process: Avvio download aggiornamento...")`);
    }
    try {
        autoUpdater.downloadUpdate();
        console.log('✅ downloadUpdate() chiamato');
        if (mainWindow) {
            mainWindow.webContents.executeJavaScript(`console.log("✅ downloadUpdate() chiamato con successo")`);
        }
    } catch (err) {
        console.error('❌ Errore downloadUpdate():', err);
        if (mainWindow) {
            mainWindow.webContents.executeJavaScript(`console.error("❌ Errore downloadUpdate(): ${err.message}")`);
        }
    }
});

// IPC per installare aggiornamento
ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
});

// --- IPC per gestione backend ---

ipcMain.on('download-backend', async () => {
    try {
        await initializeBackend();
        mainWindow.webContents.send('backend-ready');
    } catch (error) {
        mainWindow.webContents.send('backend-error', error.message);
    }
});

ipcMain.on('check-backend', () => {
    const available = isBackendAvailable();
    mainWindow.webContents.send('backend-status', { available });
});

// IPC per ottenere la versione dell'app
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
}); 