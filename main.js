const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
let mainWindow;
let pythonProcess;

function getBackendPath() {
    if (isDev) {
        return { command: 'python', script: path.join(__dirname, 'backend.py') };
    }
    // PyInstaller crea una sottocartella, quindi il percorso finale è resources/backend/backend/backend.exe
    return { command: path.join(process.resourcesPath, 'backend', 'backend', 'backend.exe'), script: null };
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

app.whenReady().then(() => {
  createWindow();

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