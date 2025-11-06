# Guida Completa: Sistema Auto-Update per Electron con GitHub Releases

**Versione**: 1.0
**Basato su**: Progetto "Generatore Bollettini" v1.0.12
**Libreria**: electron-updater v6.6.2
**Testato su**: Windows 10/11, Electron 39.0.0

---

## 📋 Indice

1. [Architettura Overview](#1-architettura-overview)
2. [Dipendenze e Setup Iniziale](#2-dipendenze-e-setup-iniziale)
3. [Implementazione Main Process](#3-implementazione-main-process)
4. [Implementazione Renderer Process](#4-implementazione-renderer-process)
5. [Build Configuration](#5-build-configuration)
6. [GitHub Release Integration](#6-github-release-integration)
7. [Version Management](#7-version-management)
8. [Release Process Completo](#8-release-process-completo)
9. [Security Best Practices](#9-security-best-practices)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Architettura Overview

### Come Funziona il Sistema

```
┌─────────────────────────────────────────────────────────────┐
│ 1. APP STARTUP (Production Mode)                           │
│    ↓                                                        │
│ 2. Check GitHub Releases API                               │
│    GET /repos/{owner}/{repo}/releases/latest               │
│    ↓                                                        │
│ 3. Compare Versions                                        │
│    Current: 1.0.12  vs  Latest: 1.0.13                    │
│    ↓                                                        │
│ 4. Update Available? → Show Modal to User                 │
│    ↓                                                        │
│ 5. Auto-Download Installer (background)                    │
│    Download: GeneratoreBollettini-1.0.13-Setup.exe        │
│    Progress: 0% → 100%                                     │
│    ↓                                                        │
│ 6. Verify Checksum (from latest.yml)                      │
│    SHA512 verification                                      │
│    ↓                                                        │
│ 7. Download Complete → Show "Install & Restart" Button    │
│    ↓                                                        │
│ 8. User Clicks → Quit App → Run Installer → Restart       │
│    ↓                                                        │
│ 9. App Relaunches with New Version ✅                      │
└─────────────────────────────────────────────────────────────┘
```

### Componenti Chiave

| Componente | Ruolo | Tecnologia |
|:-----------|:------|:-----------|
| **electron-updater** | Gestisce check/download/install | NPM Package |
| **GitHub Releases** | Hosting gratuito installer + metadata | GitHub API |
| **electron-builder** | Build installer con supporto auto-update | Build Tool |
| **latest.yml** | Metadata (versione, checksum, URL) | YAML File |
| **Main Process** | Logica auto-update, event handling | Node.js |
| **Renderer Process** | UI per notifiche e progress | HTML/CSS/JS |

### Vantaggi del Sistema

✅ **Nessun server necessario**: GitHub Releases fornisce hosting gratuito
✅ **Aggiornamenti seamless**: Download in background, installazione one-click
✅ **Verificato con checksum**: SHA512 per sicurezza
✅ **Solo in produzione**: Non interferisce con sviluppo locale
✅ **Rollout graduale**: Possibilità di marcare release come "pre-release"
✅ **Bandwidth illimitato**: GitHub serve gli asset

---

## 2. Dipendenze e Setup Iniziale

### Step 1: Inizializza Progetto

```bash
mkdir my-electron-app
cd my-electron-app
npm init -y
```

### Step 2: Installa Dipendenze

```bash
# Dipendenze runtime
npm install electron-updater --save

# Dipendenze sviluppo
npm install electron electron-builder rimraf --save-dev
```

### Step 3: Configura package.json

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "My Electron App with Auto-Update",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "clean-build": "rimraf build dist",
    "build": "electron-builder --win --publish never",
    "build-full": "npm run clean-build && electron-builder --win --publish never"
  },
  "author": "Your Name",
  "license": "ISC",
  "dependencies": {
    "electron-updater": "^6.6.2"
  },
  "devDependencies": {
    "electron": "^39.0.0",
    "electron-builder": "^25.1.8",
    "rimraf": "^6.0.1"
  },
  "build": {
    "appId": "com.yourcompany.myapp",
    "productName": "MyApp",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "renderer.js",
      "index.html",
      "assets/**/*",
      "node_modules/**/*"
    ],
    "win": {
      "target": ["nsis"],
      "artifactName": "${productName}-${version}-Setup.${ext}",
      "icon": "assets/icon.png",
      "requestedExecutionLevel": "highestAvailable"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true
    },
    "publish": {
      "provider": "github",
      "owner": "your-github-username",
      "repo": "your-repo-name",
      "private": false
    }
  }
}
```

### Spiegazione Build Config

| Campo | Valore | Scopo |
|:------|:-------|:------|
| `appId` | `com.yourcompany.myapp` | Identificatore univoco app |
| `productName` | `MyApp` | Nome visualizzato (senza spazi) |
| `files` | Array di pattern | File da includere nell'installer |
| `win.target` | `["nsis"]` | Tipo installer Windows |
| `win.artifactName` | `${productName}-${version}-Setup.${ext}` | Formato nome file |
| `nsis.oneClick` | `false` | Permette scelta directory installazione |
| `publish.provider` | `github` | Usa GitHub Releases |
| `publish.owner` | `your-username` | Username GitHub |
| `publish.repo` | `your-repo` | Nome repository |

---

## 3. Implementazione Main Process

### File: main.js

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let autoUpdater;
let mainWindow;
let isDev;

// ===== CREATE WINDOW =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,      // Security: isolate renderer
      nodeIntegration: false        // Security: disable Node in renderer
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// ===== APP READY =====
app.whenReady().then(async () => {
  // Determine if development mode
  isDev = !app.isPackaged;

  // Initialize autoUpdater AFTER app is ready
  // IMPORTANT: Must be after app.whenReady()
  autoUpdater = require('electron-updater').autoUpdater;

  // Enable automatic download when update is found
  autoUpdater.autoDownload = true;

  // ===== AUTO-UPDATE EVENT LISTENERS =====

  // 1. Checking for updates
  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
  });

  // 2. Update available
  autoUpdater.on('update-available', (info) => {
    console.log('✅ Update available:', info.version);
    console.log('Release notes:', info.releaseNotes);
    console.log('Release date:', info.releaseDate);

    // Notify renderer process
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  // 3. No update available
  autoUpdater.on('update-not-available', (info) => {
    console.log('ℹ️ No updates available');
    console.log('Current version:', app.getVersion());
  });

  // 4. Error handling
  autoUpdater.on('error', (err) => {
    console.error('❌ Auto-updater error:', err);

    // Don't show 404 errors (normal when no releases exist)
    if (!err.message || !err.message.includes('404')) {
      if (mainWindow) {
        mainWindow.webContents.send('update-error', err.message);
      }
    }
  });

  // 5. Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    const transferred = Math.round(progressObj.transferred / 1024 / 1024);
    const total = Math.round(progressObj.total / 1024 / 1024);

    console.log(`📊 Download progress: ${percent}% (${transferred}MB / ${total}MB)`);
    console.log(`Speed: ${Math.round(progressObj.bytesPerSecond / 1024)}KB/s`);

    // Send progress to renderer
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', progressObj);
    }
  });

  // 6. Update downloaded successfully
  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded successfully:', info.version);
    console.log('Files:', info.files);

    // Notify renderer that update is ready to install
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });

  // Create the browser window
  createWindow();

  // ===== CHECK FOR UPDATES =====
  // Only in production (not in development)
  if (!isDev) {
    console.log('🚀 Production mode - checking for updates...');
    console.log('Current version:', app.getVersion());

    try {
      // Check immediately on startup
      autoUpdater.checkForUpdates()
        .then(result => {
          console.log('Update check result:', result);
        })
        .catch(err => {
          console.log('Update check failed:', err.message);
        });
    } catch (err) {
      console.log('Auto-update not available:', err.message);
    }
  } else {
    console.log('🔧 Development mode - skipping update check');
  }
});

// ===== IPC HANDLERS =====

// Manual download trigger (if autoDownload is false)
ipcMain.on('download-update', () => {
  console.log('📥 Manual download triggered');
  try {
    autoUpdater.downloadUpdate();
  } catch (err) {
    console.error('❌ Download error:', err);
  }
});

// Install update and restart app
ipcMain.on('install-update', () => {
  console.log('🔄 Installing update and restarting...');
  // This will quit the app, install the update, and restart
  autoUpdater.quitAndInstall();
});

// Get current app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion(); // Reads from package.json
});

// ===== APP LIFECYCLE =====

app.on('window-all-closed', () => {
  // On macOS, apps stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

### Punti Chiave

⚠️ **IMPORTANTE**: `autoUpdater` deve essere inizializzato **DOPO** `app.whenReady()`, non a livello modulo

✅ **autoDownload: true**: Scarica automaticamente quando trova un update
✅ **isDev check**: Auto-update solo in produzione (`!app.isPackaged`)
✅ **Error handling**: Ignora 404 (normali durante sviluppo)
✅ **Progress tracking**: Invia progresso al renderer in tempo reale

---

## 4. Implementazione Renderer Process

### File: preload.js (IPC Bridge)

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Trigger manual download (if autoDownload is false)
  downloadUpdate: () => ipcRenderer.send('download-update'),

  // Install update and restart
  installUpdate: () => ipcRenderer.send('install-update'),

  // Event listeners
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_event, value) => callback(value));
  },

  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_event, value) => callback(value));
  },

  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_event, value) => callback(value));
  },

  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (_event, value) => callback(value));
  }
});
```

### File: index.html

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
  <title>My Electron App</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .version {
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
    }

    /* Update Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .modal-overlay.show {
      display: flex;
    }

    .modal {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 90%;
      text-align: center;
    }

    .modal h2 {
      margin-bottom: 15px;
      color: #333;
    }

    .modal p {
      margin-bottom: 20px;
      color: #666;
    }

    /* Progress Bar */
    progress {
      width: 100%;
      height: 25px;
      margin: 20px 0;
      border-radius: 4px;
      overflow: hidden;
    }

    progress::-webkit-progress-bar {
      background-color: #e0e0e0;
    }

    progress::-webkit-progress-value {
      background-color: #0078d4;
    }

    .progress-text {
      color: #333;
      font-weight: bold;
      margin-top: 10px;
    }

    /* Buttons */
    button {
      background: #0078d4;
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.3s;
    }

    button:hover {
      background: #005a9e;
    }

    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>My Electron App</h1>
    <p>Applicazione con auto-update tramite GitHub Releases</p>
  </div>

  <!-- Version Display -->
  <div class="version" id="app-version">v0.0.0</div>

  <!-- Update Notification Modal -->
  <div id="update-modal" class="modal-overlay">
    <div class="modal">
      <h2>🚀 Aggiornamento Disponibile</h2>
      <p id="update-info">Una nuova versione è disponibile!</p>

      <!-- Progress Container -->
      <div id="progress-container" class="hidden">
        <progress id="update-progress" value="0" max="100"></progress>
        <div class="progress-text" id="progress-text">0%</div>
      </div>

      <!-- Install Button -->
      <button id="install-btn" class="hidden">
        Installa e Riavvia
      </button>
    </div>
  </div>

  <script src="renderer.js"></script>
</body>
</html>
```

### File: renderer.js

```javascript
// ===== DOM ELEMENTS =====
const modal = document.getElementById('update-modal');
const updateInfo = document.getElementById('update-info');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('update-progress');
const progressText = document.getElementById('progress-text');
const installBtn = document.getElementById('install-btn');
const versionDisplay = document.getElementById('app-version');

// ===== DISPLAY APP VERSION =====
window.electronAPI.getAppVersion().then(version => {
  versionDisplay.textContent = `v${version}`;
  console.log('Current app version:', version);
});

// ===== UPDATE EVENT HANDLERS =====

// 1. Update available
window.electronAPI.onUpdateAvailable((info) => {
  console.log('Update available event:', info);

  // Show modal
  modal.classList.add('show');

  // Update info text
  updateInfo.textContent = `Versione ${info.version} disponibile!`;

  // Show progress bar
  progressContainer.classList.remove('hidden');
  progressBar.value = 0;
  progressText.textContent = 'Download in corso...';

  // Hide install button initially
  installBtn.classList.add('hidden');
});

// 2. Download progress
window.electronAPI.onUpdateDownloadProgress((progress) => {
  const percent = Math.round(progress.percent);

  console.log(`Download progress: ${percent}%`);

  // Update progress bar
  progressBar.value = percent;
  progressText.textContent = `${percent}%`;

  // Add transfer info
  const transferred = Math.round(progress.transferred / 1024 / 1024);
  const total = Math.round(progress.total / 1024 / 1024);
  progressText.textContent = `${percent}% (${transferred} MB / ${total} MB)`;
});

// 3. Update downloaded
window.electronAPI.onUpdateDownloaded((info) => {
  console.log('Update downloaded:', info);

  // Hide progress bar
  progressContainer.classList.add('hidden');

  // Update info
  updateInfo.textContent = `Versione ${info.version} scaricata!`;

  // Show install button
  installBtn.classList.remove('hidden');
});

// 4. Error handling
window.electronAPI.onUpdateError((error) => {
  console.error('Update error:', error);

  // Only show non-404 errors to user
  if (!error.toString().includes('404')) {
    updateInfo.textContent = `Errore: ${error}`;
    progressContainer.classList.add('hidden');
  }
});

// ===== INSTALL BUTTON CLICK =====
installBtn.addEventListener('click', () => {
  console.log('User clicked install button');

  // Disable button
  installBtn.disabled = true;
  installBtn.textContent = 'Installazione in corso...';

  // Trigger install (app will quit and restart)
  window.electronAPI.installUpdate();
});
```

### Flow UI Completo

```
User Experience:
  ↓
1. App si avvia normalmente
  ↓
2. [Background] Check for updates...
  ↓
3. Update trovato → Modal appare
   "Versione 1.0.13 disponibile!"
   [Progress Bar: 0%]
  ↓
4. Download automatico in background
   [Progress Bar: 15% → 50% → 100%]
  ↓
5. Download completo
   "Versione 1.0.13 scaricata!"
   [Bottone: "Installa e Riavvia"]
  ↓
6. User clicca bottone
  ↓
7. App si chiude → Installer si avvia → App riavvia
  ↓
8. Nuova versione attiva! ✅
```

---

## 5. Build Configuration

### Struttura File Progetto

```
my-electron-app/
├── package.json              # Configurazione + dipendenze
├── main.js                   # Main process (auto-update logic)
├── preload.js                # IPC bridge (security)
├── renderer.js               # UI logic
├── index.html                # UI markup
├── assets/
│   └── icon.png             # App icon (256x256 PNG)
├── dist/                     # Build output (gitignored)
│   ├── MyApp-1.0.0-Setup.exe
│   ├── latest.yml
│   └── win-unpacked/
├── node_modules/             # Dependencies
├── .gitignore
└── README.md
```

### File .gitignore

```gitignore
# Dependencies
node_modules/

# Build outputs
dist/
build/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

### Comandi Build

```bash
# Development - run app locally
npm start

# Clean previous builds
npm run clean-build

# Build installer
npm run build

# Build con pulizia preventiva
npm run build-full
```

### Output Build

Dopo `npm run build`, troverai in `dist/`:

```
dist/
├── MyApp-1.0.0-Setup.exe      # Installer (upload su GitHub)
├── latest.yml                 # Metadata (upload su GitHub)
├── MyApp-1.0.0-Setup.exe.blockmap
└── win-unpacked/              # Version non impacchettata (solo test locale)
    ├── MyApp.exe
    ├── resources/
    └── ...
```

### Personalizzazione NSIS Installer

Se vuoi customizzare l'installer, aggiungi in `package.json`:

```json
{
  "build": {
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "perMachine": false,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "My App",
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico",
      "installerHeaderIcon": "assets/icon.ico",
      "license": "LICENSE.txt"
    }
  }
}
```

---

## 6. GitHub Release Integration

### Setup Repository GitHub

#### 1. Crea Repository

```bash
# Inizializza git
git init

# Aggiungi file
git add .
git commit -m "Initial commit"

# Crea repo su GitHub (web interface)
# Poi collega:
git remote add origin https://github.com/username/my-app.git
git branch -M master
git push -u origin master
```

#### 2. Build Prima Release

```bash
# Assicurati che package.json abbia version 1.0.0
npm run build
```

#### 3. Crea Release su GitHub

1. Vai su: `https://github.com/username/my-app/releases`
2. Click "Draft a new release"
3. Compila:
   - **Tag version**: `v1.0.0` ⚠️ DEVE iniziare con 'v'
   - **Release title**: `My App v1.0.0`
   - **Description**:
     ```markdown
     ## What's New
     - Initial release
     - Feature A
     - Feature B

     ## Installation
     Download and run the installer below.
     ```
4. Trascina file da `dist/`:
   - `MyApp-1.0.0-Setup.exe` ✅
   - `latest.yml` ✅
5. Seleziona "Set as the latest release" ✅
6. Click "Publish release"

### Anatomia di latest.yml

Questo file viene generato automaticamente da electron-builder:

```yaml
version: 1.0.0
files:
  - url: MyApp-1.0.0-Setup.exe
    sha512: [base64-encoded-checksum]
    size: 123456789
    blockMapSize: 12345
path: MyApp-1.0.0-Setup.exe
sha512: [base64-encoded-checksum]
releaseDate: '2025-01-15T10:30:00.000Z'
```

**electron-updater usa questo file per**:
- Verificare che sia disponibile un update
- Ottenere l'URL del download
- Verificare l'integrità del file scaricato (checksum)

### Come electron-updater Trova gli Update

```javascript
// 1. Costruisce URL API
const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

// 2. Fa request GET
// Response contiene:
{
  "tag_name": "v1.0.13",
  "assets": [
    {
      "name": "MyApp-1.0.13-Setup.exe",
      "browser_download_url": "https://github.com/user/repo/releases/download/v1.0.13/MyApp-1.0.13-Setup.exe"
    },
    {
      "name": "latest.yml",
      "browser_download_url": "https://github.com/user/repo/releases/download/v1.0.13/latest.yml"
    }
  ]
}

// 3. Scarica latest.yml
// 4. Compara version in latest.yml con app.getVersion()
// 5. Se maggiore → trigger download
```

### Checklist Release

Prima di pubblicare:

- [ ] Tag inizia con 'v' (es. `v1.0.0`, non `1.0.0`)
- [ ] File `.exe` caricato
- [ ] File `latest.yml` caricato
- [ ] Release marcata come "Latest"
- [ ] Release è **pubblica** (non draft, non pre-release per update stabile)
- [ ] Note di rilascio compilate
- [ ] Version in package.json corrisponde al tag

---

## 7. Version Management

### Single Source of Truth: package.json

```json
{
  "version": "1.0.12"
}
```

**Questo numero viene usato per**:
- Nome installer: `MyApp-1.0.12-Setup.exe`
- Metadata in `latest.yml`
- `app.getVersion()` in Electron
- Display in UI
- Comparazione con latest release

### Semantic Versioning

Usa [SemVer](https://semver.org/):

```
MAJOR.MINOR.PATCH
  1  .  0  .  12

MAJOR: Breaking changes (1.0.0 → 2.0.0)
MINOR: New features, backward compatible (1.0.0 → 1.1.0)
PATCH: Bug fixes (1.0.0 → 1.0.1)
```

### Workflow Version Bump

#### Per Bug Fix (1.0.12 → 1.0.13)

```bash
# 1. Modifica SOLO package.json
{
  "version": "1.0.13"
}

# 2. Commit
git add package.json
git commit -m "Bump version to 1.0.13"
git push

# 3. Build
npm run build

# 4. Crea release su GitHub con tag v1.0.13
```

#### Per Nuova Feature (1.0.13 → 1.1.0)

```bash
# Incrementa MINOR, reset PATCH
{
  "version": "1.1.0"
}
```

#### Per Breaking Change (1.1.0 → 2.0.0)

```bash
# Incrementa MAJOR, reset MINOR e PATCH
{
  "version": "2.0.0"
}
```

### Automazione (Opzionale)

Usa `npm version`:

```bash
# Patch: 1.0.12 → 1.0.13
npm version patch

# Minor: 1.0.13 → 1.1.0
npm version minor

# Major: 1.1.0 → 2.0.0
npm version major

# Questo:
# 1. Aggiorna package.json
# 2. Crea git commit automatico
# 3. Crea git tag (senza 'v')
```

⚠️ Nota: `npm version` crea tag SENZA 'v', ma electron-updater vuole tag CON 'v'. Dovrai rinominare:

```bash
git tag v1.0.13 1.0.13
git tag -d 1.0.13
git push --tags
```

---

## 8. Release Process Completo

### Checklist Pre-Release

- [ ] Tutte le feature completate e testate
- [ ] Nessun bug critico
- [ ] Code review completata
- [ ] Documentazione aggiornata
- [ ] CHANGELOG.md aggiornato (opzionale)

### Step 1: Version Bump

```bash
# Modifica package.json
{
  "version": "1.0.13"  // Era 1.0.12
}
```

### Step 2: Commit e Push

```bash
git add package.json
git commit -m "Bump version to 1.0.13"
git push origin master
```

### Step 3: Test Locale

```bash
# Avvia in dev mode
npm start

# Testa tutte le funzionalità
# - Feature A funziona?
# - Feature B funziona?
# - No errori console?
```

### Step 4: Build

```bash
# Pulisci e builda
npm run build-full

# Output atteso:
# dist/MyApp-1.0.13-Setup.exe (dimensione corretta?)
# dist/latest.yml (contiene version: 1.0.13?)
```

### Step 5: Test Installer Locale

```bash
# Installa
cd dist
./MyApp-1.0.13-Setup.exe

# Testa installazione:
# - Si installa correttamente?
# - App si avvia dopo installazione?
# - Versione corretta visualizzata?
# - Tutte le feature funzionano?

# Disinstalla
# Pannello di Controllo → Programmi → Disinstalla My App
```

### Step 6: Crea GitHub Release

```bash
# 1. Vai su GitHub Releases
open https://github.com/username/my-app/releases

# 2. Click "Draft a new release"

# 3. Compila form:
Tag: v1.0.13
Title: My App v1.0.13
Description:
```

**Template Release Notes**:

```markdown
## 🚀 What's New in v1.0.13

### New Features
- Added support for dark mode
- Implemented auto-save functionality

### Improvements
- Improved startup time by 40%
- Better error messages

### Bug Fixes
- Fixed crash on Windows 11
- Corrected timezone handling

### Technical
- Updated electron to v39.0.0
- Migrated to electron-updater v6.6.2

---

### Installation
- **New users**: Download the installer below
- **Existing users**: The app will auto-update on next launch

### Files
- **MyApp-1.0.13-Setup.exe** (123 MB) - Windows installer

---

**Full Changelog**: https://github.com/username/my-app/compare/v1.0.12...v1.0.13
```

```bash
# 4. Upload file:
# - Trascina dist/MyApp-1.0.13-Setup.exe
# - Trascina dist/latest.yml

# 5. Opzioni:
# ✅ Set as the latest release
# ❌ This is a pre-release (solo per beta)

# 6. Click "Publish release"
```

### Step 7: Verifica Auto-Update

```bash
# Test su macchina pulita:

# 1. Installa versione precedente (v1.0.12)
# 2. Avvia app
# 3. Aspetta check update (10-20 secondi)
# 4. Modal appare? ✅
# 5. Info versione corretta? (v1.0.13) ✅
# 6. Download progredisce? ✅
# 7. Pulsante "Installa e Riavvia" appare? ✅
# 8. Click → App si chiude → Installer si avvia → App riavvia? ✅
# 9. Nuova versione (v1.0.13) attiva? ✅
```

### Step 8: Monitoring

```bash
# Check download stats su GitHub
# Releases → v1.0.13 → Assets → Download count

# Check issue tracker per bug reports
# Issues → Labels → bug

# Monitor user feedback
```

### Rollback (In caso di problema critico)

```bash
# 1. Unpublish release problematica
# GitHub → Releases → v1.0.13 → Edit → Delete

# 2. Re-mark release precedente come "Latest"
# GitHub → Releases → v1.0.12 → Edit → ✅ Set as latest

# 3. Gli user ancora su v1.0.12 non riceveranno più l'update
# User su v1.0.13 dovranno disinstallare manualmente
```

---

## 9. Security Best Practices

### Context Isolation (Implementato)

```javascript
// main.js
webPreferences: {
  contextIsolation: true,   // ✅ Isola renderer da Node.js
  nodeIntegration: false    // ✅ Disabilita Node nel renderer
}
```

**Perché importante**: Previene XSS attacks dall'accedere a Node.js APIs.

### Content Security Policy (Implementato)

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline';">
```

**Perché importante**: Previene injection di script esterni.

### IPC Bridge Sicuro (Implementato)

```javascript
// preload.js
// ❌ SBAGLIATO - Espone TUTTO
contextBridge.exposeInMainWorld('electron', require('electron'));

// ✅ CORRETTO - Espone solo funzioni specifiche
contextBridge.exposeInMainWorld('electronAPI', {
  installUpdate: () => ipcRenderer.send('install-update'),
  // Solo funzioni necessarie, niente accesso diretto a ipcRenderer
});
```

### HTTPS per Updates (Automatico)

GitHub Releases usa HTTPS automaticamente:
- ✅ Download criptati
- ✅ Man-in-the-middle protection
- ✅ Certificate verification

### Checksum Verification (Automatico)

`electron-updater` verifica SHA512 automaticamente:

```yaml
# latest.yml
sha512: [checksum]
```

Se checksum non corrisponde → Download fallisce

### Code Signing (Raccomandato ma Non Implementato)

**Problema**: Windows SmartScreen mostra warning per app non firmate.

**Soluzione**: Firma l'installer con certificato code signing.

```json
{
  "win": {
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "env:WIN_CSC_KEY_PASSWORD",
    "signingHashAlgorithms": ["sha256"]
  }
}
```

**Costo**: ~$100-400/anno per certificato (Digicert, Sectigo, etc.)

**Benefici**:
- ✅ Nessun SmartScreen warning
- ✅ User trust aumentato
- ✅ Nome azienda visualizzato nell'installer

### Private Repositories

Se il repo è privato:

```bash
# Imposta GitHub token
export GH_TOKEN="your-github-personal-access-token"

# Builderà con autenticazione
npm run build
```

Token necessita permessi:
- `repo` (full control of private repositories)

### Disabilitare DevTools in Produzione

```javascript
// main.js
if (!isDev) {
  // Disabilita DevTools in produzione
  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.webContents.closeDevTools();
  });
}
```

---

## 10. Troubleshooting

### Problema 1: Update Non Rilevato

**Sintomi**:
- App non mostra notifica update
- Console non logga "Update available"

**Possibili Cause**:

#### A) Tag Release Sbagliato

```bash
# ❌ SBAGLIATO
Tag: 1.0.13

# ✅ CORRETTO
Tag: v1.0.13  # DEVE iniziare con 'v'
```

**Soluzione**:
```bash
# Su GitHub, edit release e cambia tag
```

#### B) latest.yml Non Caricato

**Controllo**:
```bash
# Verifica asset release su GitHub:
# - MyApp-1.0.13-Setup.exe ✅
# - latest.yml ✅ (DEVE esserci!)
```

#### C) Release Non Marcata Come "Latest"

**Controllo**:
- GitHub → Releases → v1.0.13 deve avere badge "Latest"

**Soluzione**:
```bash
# Edit release → ✅ Set as the latest release
```

#### D) Versione App = Versione Release

```bash
# App v1.0.13 non può aggiornarsi a release v1.0.13
# Deve essere: App v1.0.12 → Release v1.0.13
```

**Soluzione**: Incrementa version in package.json

#### E) Development Mode Attivo

```javascript
// Auto-update è disabilitato in dev mode
if (!app.isPackaged) {
  // Non fa check
}
```

**Soluzione**: Testa con installer, non `npm start`

---

### Problema 2: Download Fallisce

**Sintomi**:
- Progress bar si blocca
- Errore "net::ERR_CONNECTION_RESET"

**Possibili Cause**:

#### A) Firewall/Antivirus

**Soluzione**:
```bash
# Aggiungi eccezione per:
# - App.exe
# - Setup.exe
```

#### B) Proxy/VPN

**Soluzione**:
```bash
# Disabilita VPN temporaneamente
# Oppure configura proxy in app
```

#### C) File Corrotto su GitHub

**Soluzione**:
```bash
# Re-upload installer:
# 1. Delete release
# 2. npm run build
# 3. Ri-crea release con nuovi file
```

---

### Problema 3: Installer Troppo Piccolo

**Sintomi**:
- Installer è 50MB invece di 150MB
- App installata manca file

**Causa**: File non inclusi in `build.files`

**Soluzione**:
```json
{
  "build": {
    "files": [
      "main.js",
      "preload.js",
      "renderer.js",
      "index.html",
      "assets/**/*",        // ← Aggiungi pattern mancanti
      "data/**/*",
      "node_modules/**/*"
    ]
  }
}
```

---

### Problema 4: "ELECTRON_RUN_AS_NODE" Error

**Sintomi**:
```
TypeError: Cannot read properties of undefined (reading 'whenReady')
```

**Causa**: Variabile ambiente interferisce

**Soluzione**:
```bash
# Windows CMD
set ELECTRON_RUN_AS_NODE=

# PowerShell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

# Poi
npm start
```

---

### Problema 5: Modal Update Non Appare

**Sintomi**:
- Console logga "Update available"
- Ma UI non mostra modal

**Causa**: Event listener non configurato

**Debug**:
```javascript
// renderer.js
window.electronAPI.onUpdateAvailable((info) => {
  console.log('UPDATE AVAILABLE EVENT RECEIVED:', info); // ← Debug
  // Mostra modal...
});
```

**Soluzione**:
- Verifica `preload.js` esponga `onUpdateAvailable`
- Verifica `main.js` invii `mainWindow.webContents.send('update-available', info)`

---

### Problema 6: App Crashizza Dopo Update

**Sintomi**:
- Update si installa
- App riavvia
- App crashizza immediatamente

**Possibili Cause**:

#### A) Breaking Change Non Gestito

**Esempio**:
```javascript
// v1.0.12 salvava config in:
localStorage.setItem('config', JSON.stringify(config));

// v1.0.13 usa:
fs.writeFileSync(configPath, JSON.stringify(config)); // ← Diverso!
```

**Soluzione**: Implementa migration logic

```javascript
// v1.0.13
const oldConfig = localStorage.getItem('config');
if (oldConfig) {
  // Migra da localStorage a file system
  fs.writeFileSync(configPath, oldConfig);
  localStorage.removeItem('config');
}
```

#### B) Database Schema Change

**Soluzione**: Versiona schema e migra automaticamente

```javascript
const DB_VERSION = 2;
const currentVersion = db.getVersion() || 1;

if (currentVersion < DB_VERSION) {
  migrate(currentVersion, DB_VERSION);
}
```

---

### Problema 7: 404 Error Durante Check

**Sintomi**:
```
Error: HttpError: 404 Not Found
```

**Causa**: Normale! Significa che non ci sono release pubbliche.

**Quando è normale**:
- Durante sviluppo locale
- Repository nuovo senza release
- Tutte le release sono "draft" o "pre-release"

**Soluzione**:
- Se in sviluppo: ignora (è già gestito nel codice)
- Se in produzione: pubblica almeno una release

```javascript
// Il codice già gestisce questo:
if (!err.message.includes('404')) {
  // Mostra solo errori non-404
}
```

---

### Problema 8: Update Loop Infinito

**Sintomi**:
- App si aggiorna
- Riavvia
- Trova update di nuovo
- Loop infinito

**Causa**: Version in package.json non aggiornata

**Debug**:
```javascript
console.log('Current version:', app.getVersion());
console.log('Latest version:', info.version);
```

**Soluzione**:
```bash
# Verifica package.json
{
  "version": "1.0.13"  # ← DEVE corrispondere al tag release
}

# Rebuilda
npm run build
```

---

### Debug Logging

Abilita logging dettagliato:

```javascript
// main.js
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// Log verranno salvati in:
// Windows: %USERPROFILE%\AppData\Roaming\<app-name>\logs\main.log
```

---

## Risorse Aggiuntive

### Documentazione Ufficiale

- [electron-updater](https://www.electron.build/auto-update)
- [electron-builder](https://www.electron.build/)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)

### Tool Utili

- [SemVer Calculator](https://semver.npmjs.com/)
- [electron-log](https://github.com/megahertz/electron-log) - Advanced logging
- [electron-store](https://github.com/sindresorhus/electron-store) - Persistent storage

### Best Practices

1. ✅ **Sempre testa installer localmente prima di release**
2. ✅ **Usa semantic versioning correttamente**
3. ✅ **Scrivi release notes dettagliate**
4. ✅ **Testa auto-update su macchina pulita**
5. ✅ **Mantieni changelog aggiornato**
6. ✅ **Firma il codice per produzione (code signing)**
7. ✅ **Implementa crash reporting (Sentry, etc.)**
8. ✅ **Backup release precedenti per rollback**

---

## Conclusione

Questa guida copre l'implementazione completa di un sistema auto-update professionale per Electron basato su GitHub Releases. Il sistema è:

- ✅ **Gratuito**: Nessun server necessario
- ✅ **Sicuro**: Checksum verification, HTTPS, context isolation
- ✅ **User-friendly**: Update automatici con un click
- ✅ **Testato**: Basato su implementazione reale in produzione
- ✅ **Scalabile**: Gestisce app di qualsiasi dimensione

Implementando questi pattern, avrai un sistema di aggiornamento robusto e affidabile per la tua applicazione Electron.

---

**Versione Guida**: 1.0
**Ultimo Aggiornamento**: 2025-01-15
**Autore**: Basato su "Generatore Bollettini" v1.0.12
**Licenza**: Riutilizzabile per qualsiasi progetto Electron
