const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);

const isDev = !app.isPackaged;
let mainWindow;
let pythonProcess;

// Configurazione per il download del backend
const BACKEND_CONFIG = {
    downloadUrl: 'https://github.com/itose/bollettini/releases/latest/download/backend.zip',
    localPath: path.join(app.getPath('userData'), 'backend'),
    zipPath: path.join(app.getPath('userData'), 'backend.zip'),
    version: '1.0.0' // Versione del backend da scaricare
};

// --- Gestione Backend Download ---

/**
 * Verifica se il backend è già presente localmente
 */
function isBackendAvailable() {
    const backendExe = path.join(BACKEND_CONFIG.localPath, 'backend', 'backend.exe');
    return fs.existsSync(backendExe);
}

/**
 * Scarica il backend da GitHub Releases
 */
async function downloadBackend() {
    return new Promise((resolve, reject) => {
        console.log('Inizio download backend...');
        mainWindow.webContents.send('backend-download-start');
        
        const file = fs.createWriteStream(BACKEND_CONFIG.zipPath);
        
        https.get(BACKEND_CONFIG.downloadUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Download failed: ${response.statusCode}`));
                return;
            }
            
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;
            
            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                const progress = Math.round((downloadedSize / totalSize) * 100);
                mainWindow.webContents.send('backend-download-progress', { progress, downloadedSize, totalSize });
            });
            
            pipelineAsync(response, file)
                .then(() => {
                    console.log('Download completato');
                    mainWindow.webContents.send('backend-download-complete');
                    resolve();
                })
                .catch(reject);
        }).on('error', reject);
    });
}

/**
 * Estrae il backend scaricato
 */
async function extractBackend() {
    return new Promise((resolve, reject) => {
        console.log('Estrazione backend...');
        mainWindow.webContents.send('backend-extract-start');
        
        // Usa PowerShell per estrarre il ZIP
        const process = spawn('powershell', ['-Command', `Expand-Archive -Path '${BACKEND_CONFIG.zipPath}' -DestinationPath '${BACKEND_CONFIG.localPath}' -Force`]);
        
        process.on('close', (code) => {
            if (code === 0) {
                console.log('Estrazione completata');
                // Rimuovi il file ZIP dopo l'estrazione
                fs.unlinkSync(BACKEND_CONFIG.zipPath);
                mainWindow.webContents.send('backend-extract-complete');
                resolve();
            } else {
                reject(new Error(`Estrazione fallita con codice ${code}`));
            }
        });
        
        process.on('error', reject);
    });
}

/**
 * Inizializza il backend (download se necessario)
 */
async function initializeBackend() {
    try {
        if (isBackendAvailable()) {
            console.log('Backend già presente');
            return;
        }
        
        console.log('Backend non trovato, avvio download...');
        await downloadBackend();
        await extractBackend();
        console.log('Backend inizializzato con successo');
        
    } catch (error) {
        console.error('Errore durante l\'inizializzazione del backend:', error);
        mainWindow.webContents.send('backend-error', error.message);
        throw error;
    }
}

function getBackendPath() {
    if (isDev) {
        return { command: 'python', script: path.join(__dirname, 'backend.py') };
    }
    // Usa il backend scaricato localmente
    return { command: path.join(BACKEND_CONFIG.localPath, 'backend', 'backend.exe'), script: null };
}

function spawnBackendProcess(args) {
    const backend = getBackendPath();
    if (isDev) {
        return spawn(backend.command, [backend.script, ...args]);
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
  
  // Opzionale: apri i DevTools per il debug
  // mainWindow.webContents.openDevTools();
}

function countCausali(excelPath) {
    const process = spawnBackendProcess(['--count-causali', excelPath]);
    
    process.stdout.on('data', (data) => {
        try {
            const parsed = JSON.parse(data.toString());
            mainWindow.webContents.send('from-python', parsed);
        } catch (e) {
            console.error('Dati non-JSON (conteggio) da Python:', data.toString());
        }
    });

    process.stderr.on('data', (data) => {
        mainWindow.webContents.send('from-python', { type: 'error', payload: `Errore durante il conteggio: ${data}` });
    });
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
  createWindow();
  
  // Inizializza il backend (download se necessario)
  try {
    await initializeBackend();
  } catch (error) {
    console.error('Errore inizializzazione backend:', error);
    // L'app può continuare anche se il backend non è disponibile
  }
  
  // Controlla aggiornamenti all'avvio (solo in produzione)
  if (!isDev) {
    checkForUpdates();
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
    console.log('Controllo aggiornamenti...');
    
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('Errore durante il controllo aggiornamenti:', err);
    });
}

// Eventi autoUpdater
autoUpdater.on('checking-for-update', () => {
    console.log('Controllo aggiornamenti in corso...');
});

autoUpdater.on('update-available', (info) => {
    console.log('Aggiornamento disponibile:', info.version);
    mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
    console.log('Nessun aggiornamento disponibile');
});

autoUpdater.on('error', (err) => {
    console.error('Errore auto-updater:', err);
    mainWindow.webContents.send('update-error', err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Velocità download: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
    
    mainWindow.webContents.send('update-download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Aggiornamento scaricato:', info.version);
    mainWindow.webContents.send('update-downloaded', info);
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