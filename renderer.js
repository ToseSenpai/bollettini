// renderer.js

// Questo file viene eseguito nella finestra del browser (renderer process).
// Qui puoi scrivere il codice JavaScript per l'interfaccia utente.
console.log('Renderer script caricato.');

const initialView = document.getElementById('initial-view');
const confirmView = document.getElementById('confirm-view');
const progressView = document.getElementById('progress-view');
const captchaView = document.getElementById('captcha-view');

const selectFileBtn = document.getElementById('select-file-btn');
const startBtn = document.getElementById('start-btn');
const backArrow = document.getElementById('back-arrow');
const filePathElement = document.getElementById('file-path');
const confirmStatus = document.getElementById('confirm-status');
const mainStatus = document.getElementById('main-status');
const globalProgress = document.getElementById('global-progress');
const currentTask = document.getElementById('current-task');
const taskProgress = document.getElementById('task-progress');
const captchaImage = document.getElementById('captcha-image');
const captchaInput = document.getElementById('captcha-input');
const errorLog = document.getElementById('error-log');
const loadingAnimation = document.getElementById('loading-animation-container');

// Elementi per aggiornamenti
const updateNotification = document.getElementById('update-notification');
const updateInfo = document.getElementById('update-info');
const updateProgressContainer = document.getElementById('update-progress-container');
const updateProgress = document.getElementById('update-progress');
const updateProgressText = document.getElementById('update-progress-text');
const downloadUpdateBtn = document.getElementById('download-update-btn');
const installUpdateBtn = document.getElementById('install-update-btn');

// Elementi per download backend
const backendDownloadNotification = document.getElementById('backend-download-notification');
const backendDownloadInfo = document.getElementById('backend-download-info');
const backendDownloadProgressContainer = document.getElementById('backend-download-progress-container');
const backendDownloadProgress = document.getElementById('backend-download-progress');
const backendDownloadProgressText = document.getElementById('backend-download-progress-text');
const backendExtractProgressContainer = document.getElementById('backend-extract-progress-container');
const backendExtractProgress = document.getElementById('backend-extract-progress');
const backendExtractProgressText = document.getElementById('backend-extract-progress-text');
// Pulsanti backend rimossi (download automatico)

let selectedFilePath = null;

// Funzione per gestire il cambio di vista con animazioni
function switchView(activeView) {
    [initialView, confirmView, progressView, captchaView].forEach(view => {
        if (view === activeView) {
            view.classList.remove('hidden');
        } else {
            view.classList.add('hidden');
        }
    });

    // Gestisce la visibilità della freccia
    if (activeView === confirmView) {
        backArrow.classList.add('visible');
    } else {
        backArrow.classList.remove('visible');
    }
}

backArrow.addEventListener('click', () => {
    switchView(initialView);
    filePathElement.textContent = '';
    errorLog.textContent = '';
    selectedFilePath = null;
});

selectFileBtn.addEventListener('click', () => {
  window.electronAPI.selectExcelFile();
});

window.electronAPI.onFileSelected((filePath) => {
    selectedFilePath = filePath;
    // Questo triggera il backend per contare le causali
});

startBtn.addEventListener('click', () => {
    if (selectedFilePath) {
        window.electronAPI.startAutomation(selectedFilePath);
        switchView(progressView);
        loadingAnimation.classList.remove('hidden');
    }
});

window.electronAPI.onPythonMessage((data) => {
  console.log('Messaggio ricevuto dal backend:', data);
  
  // Rimuove l'animazione da tutti gli elementi di stato prima di aggiornare
  // [mainStatus, currentTask].forEach(el => el.classList.remove('loading-animation'));

  switch (data.type) {
    case 'excel-file-selected':
      console.log('File Excel selezionato:', data.payload);
      selectedFilePath = data.payload;
      filePathElement.textContent = `File: ${data.payload.split(/[\\/]/).pop()}`;
      // Non cambiare vista qui, attendi il conteggio
      break;
    
    case 'causali_count':
      console.log('Conteggio causali ricevuto:', data.payload);
      if (data.payload.count > 0) {
        confirmStatus.textContent = `Trovate ${data.payload.count} causali.`;
        switchView(confirmView);
      } else {
        errorLog.textContent = "Nessuna causale valida trovata nel file. Selezionane un altro.";
        switchView(initialView); // Torna alla vista iniziale
      }
      break;

    case 'main_status':
      mainStatus.textContent = data.payload;
      // mainStatus.classList.add('loading-animation');
      break;

    case 'global_progress':
      globalProgress.value = data.payload;
      break;

    case 'current_task':
      currentTask.textContent = data.payload;
      // currentTask.classList.add('loading-animation');
      break;
    
    case 'task_progress':
        taskProgress.value = data.payload;
        break;

    case 'captcha_required':
      switchView(captchaView);
      captchaImage.src = `data:image/jpeg;base64,${data.payload}`;
      captchaInput.focus();
      break;
      
    case 'finished':
      mainStatus.textContent = "Completato con Successo!";
      currentTask.textContent = data.payload;
      loadingAnimation.classList.add('hidden');
      break;
    
    case 'backend-status':
      console.log('Status backend:', data.payload);
      // Mostra nello status principale o in un elemento dedicato
      if (initialView && !initialView.classList.contains('hidden')) {
        // Mostra lo status backend nella vista iniziale
        if (!document.getElementById('backend-status-display')) {
          const statusDiv = document.createElement('div');
          statusDiv.id = 'backend-status-display';
          statusDiv.style.cssText = 'color: #4CAF50; font-size: 12px; margin-top: 10px; text-align: center;';
          document.querySelector('#initial-view').appendChild(statusDiv);
        }
        document.getElementById('backend-status-display').textContent = data.payload;
      }
      break;
    
    case 'backend-error':
      console.error('Errore backend:', data.payload);
      errorLog.textContent = `Backend: ${data.payload}`;
      hideBackendDownloadNotification();
      break;
    
    case 'backend-warning':
      console.warn('Warning backend:', data.payload);
      if (initialView && !initialView.classList.contains('hidden')) {
        if (!document.getElementById('backend-warning-display')) {
          const warningDiv = document.createElement('div');
          warningDiv.id = 'backend-warning-display';
          warningDiv.style.cssText = 'color: #FF9800; font-size: 12px; margin-top: 10px; text-align: center;';
          document.querySelector('#initial-view').appendChild(warningDiv);
        }
        document.getElementById('backend-warning-display').textContent = data.payload;
      }
      hideBackendDownloadNotification();
      break;
    
    case 'backend-download-start':
      console.log('Avvio download backend');
      showBackendDownloadNotification();
      backendDownloadInfo.textContent = data.payload || 'Inizio download...';
      backendDownloadProgress.value = 0;
      backendDownloadProgressText.textContent = '0%';
      break;
    
    case 'backend-download-progress':
      console.log('Progresso download:', data.payload);
      if (data.payload && typeof data.payload.progress === 'number') {
        backendDownloadProgress.value = data.payload.progress;
        const mbDownloaded = (data.payload.downloadedSize / 1048576).toFixed(2);
        const mbTotal = (data.payload.totalSize / 1048576).toFixed(2);
        backendDownloadProgressText.textContent = `${data.payload.progress}% - ${mbDownloaded} MB / ${mbTotal} MB`;
      }
      break;
    
    case 'backend-download-complete':
      console.log('Download completato');
      backendDownloadInfo.textContent = 'Estrazione in corso...';
      backendDownloadProgress.value = 100;
      break;
    
    case 'backend-extract-start':
      console.log('Inizio estrazione');
      backendDownloadInfo.textContent = 'Estrazione componenti...';
      backendDownloadProgressContainer.classList.add('hidden');
      backendExtractProgressContainer.classList.remove('hidden');
      // Simula progresso estrazione (non possiamo tracciare il progresso reale)
      let extractProgress = 0;
      const extractInterval = setInterval(() => {
        extractProgress += 2;
        if (extractProgress >= 90) {
          clearInterval(extractInterval);
          extractProgress = 90; // Ferma a 90% e aspetta il completamento
        }
        backendExtractProgress.value = extractProgress;
        backendExtractProgressText.textContent = `${extractProgress}%`;
      }, 200);
      // Salva l'intervallo per pulirlo al completamento
      window.extractInterval = extractInterval;
      break;
    
    case 'backend-extract-complete':
      console.log('Estrazione completata');
      if (window.extractInterval) {
        clearInterval(window.extractInterval);
      }
      backendExtractProgress.value = 100;
      backendExtractProgressText.textContent = '100%';
      backendDownloadInfo.textContent = 'Backend pronto!';
      setTimeout(() => {
        hideBackendDownloadNotification();
      }, 2000);
      break;

    case 'error':
      errorLog.textContent = `ERRORE: ${data.payload}`;
      mainStatus.textContent = "Processo Interrotto";
      loadingAnimation.classList.add('hidden');
      break;

    case 'info':
      console.log('INFO:', data.payload);
      // Mostra info nel task corrente (senza interrompere il flusso)
      if (currentTask) {
        currentTask.textContent = data.payload;
      }
      break;

    case 'warning':
      console.warn('WARNING:', data.payload);
      // Mostra warning nell'error log ma in giallo
      errorLog.style.color = '#FF9800';
      errorLog.textContent = `⚠ ${data.payload}`;
      break;
  }
});

captchaInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const code = captchaInput.value;
    window.electronAPI.sendToPython(code);
    captchaInput.value = '';
    switchView(progressView);
  }
});

// Gestione selezione file per trascinamento (opzionale, ma carino)
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const filePath = files[0].path;
        if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
            window.electronAPI.send('excel-file-selected', filePath);
            // In un'implementazione reale, dovremmo gestire questo evento nel main process.
            // Per ora, ci limitiamo a loggarlo.
            console.log(`File trascinato: ${filePath}. La selezione via pulsante è consigliata.`);
        }
    }
});

// --- Gestione Aggiornamenti ---

// Mostra notifica aggiornamento
function showUpdateNotification(version) {
    updateInfo.textContent = `È disponibile la versione ${version}. Download in corso...`;
    updateNotification.classList.remove('hidden');
    updateProgressContainer.classList.remove('hidden'); // Mostra subito la barra
    updateProgress.value = 0;
    updateProgressText.textContent = '0%';
    downloadUpdateBtn.classList.add('hidden'); // Nascondi il pulsante scarica
    installUpdateBtn.classList.add('hidden');
}

// Nasconde notifica aggiornamento
function hideUpdateNotification() {
    updateNotification.classList.add('hidden');
}

// Mostra progresso download
function showDownloadProgress(progress) {
    updateProgressContainer.classList.remove('hidden');
    downloadUpdateBtn.classList.add('hidden');
    updateProgress.value = Math.round(progress.percent);
    updateProgressText.textContent = `${Math.round(progress.percent)}%`;
}

// Mostra pulsante installa
function showInstallButton() {
    installUpdateBtn.classList.remove('hidden');
    updateProgressContainer.classList.add('hidden');
    updateInfo.textContent = 'Aggiornamento scaricato! Clicca per installare.';
}

// Event listeners per aggiornamenti
window.electronAPI.onUpdateAvailable((info) => {
    console.log('Aggiornamento disponibile:', info.version);
    showUpdateNotification(info.version);
});

window.electronAPI.onUpdateDownloaded((info) => {
    console.log('Aggiornamento scaricato:', info.version);
    showInstallButton();
});

window.electronAPI.onUpdateError((error) => {
    console.error('Errore aggiornamento:', error);
    // Non mostrare errori di auto-update all'utente (sono normali quando non ci sono release pubbliche)
    // Mostra solo nella console per debug
    if (error && !error.toString().includes('404')) {
        // Mostra solo errori non-404
        errorLog.textContent = `Errore aggiornamento: ${error}`;
    } else {
        console.log('Auto-update non disponibile (nessuna release pubblica)');
    }
});

window.electronAPI.onUpdateDownloadProgress((progress) => {
    console.log('Progresso download:', progress.percent);
    showDownloadProgress(progress);
});

// Pulsanti aggiornamento
if (downloadUpdateBtn) {
    downloadUpdateBtn.addEventListener('click', () => {
        console.log('🔽 Download update button clicked');
        window.electronAPI.downloadUpdate();
    });
} else {
    console.error('❌ downloadUpdateBtn element not found!');
}

if (installUpdateBtn) {
    installUpdateBtn.addEventListener('click', () => {
        console.log('📥 Install update button clicked');
        window.electronAPI.installUpdate();
    });
} else {
    console.error('❌ installUpdateBtn element not found!');
}

// --- Gestione Download Backend ---

// Mostra notifica download backend
function showBackendDownloadNotification() {
    backendDownloadNotification.classList.remove('hidden');
    backendDownloadProgressContainer.classList.remove('hidden'); // Mostra sempre la barra
}

// Nasconde notifica download backend
function hideBackendDownloadNotification() {
    backendDownloadNotification.classList.add('hidden');
}

// Mostra progresso download backend
function showBackendDownloadProgress(progress) {
    backendDownloadProgressContainer.classList.remove('hidden');
    backendDownloadProgress.value = progress.progress;
    backendDownloadProgressText.textContent = `${progress.progress}%`;
    
    const downloadedMB = (progress.downloadedSize / (1024 * 1024)).toFixed(1);
    const totalMB = (progress.totalSize / (1024 * 1024)).toFixed(1);
    backendDownloadInfo.textContent = `Scaricamento: ${downloadedMB}MB / ${totalMB}MB`;
}

// Event listeners per download backend
window.electronAPI.onBackendDownloadStart(() => {
    console.log('Inizio download backend');
    showBackendDownloadNotification();
    backendDownloadInfo.textContent = 'Inizio download...';
});

window.electronAPI.onBackendDownloadProgress((progress) => {
    console.log('Progresso download backend:', progress);
    showBackendDownloadProgress(progress);
});

window.electronAPI.onBackendDownloadComplete(() => {
    console.log('Download backend completato');
    backendDownloadInfo.textContent = 'Estrazione in corso...';
});

window.electronAPI.onBackendExtractStart(() => {
    console.log('Inizio estrazione backend');
    backendDownloadInfo.textContent = 'Estrazione componenti...';
});

window.electronAPI.onBackendExtractComplete(() => {
    console.log('Estrazione backend completata');
    backendDownloadInfo.textContent = 'Backend pronto!';
    setTimeout(() => {
        hideBackendDownloadNotification();
    }, 2000);
});

window.electronAPI.onBackendReady(() => {
    console.log('Backend pronto');
    hideBackendDownloadNotification();
});

window.electronAPI.onBackendError((error) => {
    console.error('Errore backend:', error);
    backendDownloadInfo.textContent = `Errore: ${error}`;
    errorLog.textContent = `Errore backend: ${error}`;
});

window.electronAPI.onBackendStatus((status) => {
    console.log('Stato backend:', status);
    if (!status.available) {
        showBackendDownloadNotification();
    }
});

// Pulsanti download backend rimossi (download automatico)

// Controlla stato backend all'avvio
window.electronAPI.checkBackend();

// Mostra versione dell'app
window.electronAPI.getAppVersion().then(version => {
    document.getElementById('app-version').textContent = `v${version}`;
}); 