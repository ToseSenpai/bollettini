// renderer.js

// Questo file viene eseguito nella finestra del browser (renderer process).
// Qui puoi scrivere il codice JavaScript per l'interfaccia utente.
console.log('Renderer script caricato.');

// Mostra l'overlay di caricamento all'avvio in attesa del backend
// Verrà nascosto quando arriva il messaggio backend-ready o backend-extract-complete
document.addEventListener('DOMContentLoaded', async () => {
    const backendOverlay = document.getElementById('backend-overlay');
    // Mostra l'overlay all'avvio, verrà nascosto dal backend quando pronto
    backendOverlay.classList.remove('hidden');
    console.log('Overlay backend mostrato in attesa inizializzazione');

    // Inizializza l'animazione Lottie per il caricamento backend
    if (backendLottieContainer) {
        try {
            // Verifica che la libreria Lottie sia caricata
            if (typeof lottie === 'undefined') {
                console.error('Lottie library not loaded from CDN');
                backendLottieContainer.innerHTML = '<div style="font-size:60px;text-align:center;">⏳</div>';
                return;
            }

            console.log('Loading backend Lottie animation from LegoDHL.json...');
            const response = await fetch('./LegoDHL.json');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const animationData = await response.json();
            console.log('Backend animation data loaded successfully');

            backendLottieAnimation = lottie.loadAnimation({
                container: backendLottieContainer,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: animationData
            });
            console.log('Backend Lottie animation initialized');
        } catch (error) {
            console.error('Error loading backend Lottie animation:', error);
            // Fallback: mostra un'icona statica
            backendLottieContainer.innerHTML = '<div style="font-size:60px;text-align:center;">⏳</div>';
        }
    }
});

const initialView = document.getElementById('initial-view');
const confirmView = document.getElementById('confirm-view');
const progressView = document.getElementById('progress-view');
const captchaView = document.getElementById('captcha-view');
const completionView = document.getElementById('completion-view');

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
const completionCount = document.getElementById('completion-count');

// Elementi per aggiornamenti
const updateNotification = document.getElementById('update-notification');
const updateInfo = document.getElementById('update-info');
const updateProgressContainer = document.getElementById('update-progress-container');
const updateProgress = document.getElementById('update-progress');
const updateProgressText = document.getElementById('update-progress-text');
const installUpdateBtn = document.getElementById('install-update-btn');

// Elementi per download backend
const backendOverlay = document.getElementById('backend-overlay');
const backendLottieContainer = document.getElementById('backend-lottie-animation');
const backendLoadingText = document.getElementById('backend-loading-text');
// Pulsanti backend rimossi (download automatico)

// Variabile per l'animazione Lottie
let backendLottieAnimation = null;

let selectedFilePath = null;

// Funzione per gestire il cambio di vista con animazioni
function switchView(activeView) {
    [initialView, confirmView, progressView, captchaView, completionView].forEach(view => {
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

    case 'column_b_not_empty':
      console.warn('Validazione fallita: colonna B già compilata', data.payload);
      const filledCount = data.payload.filled_count;
      const filledRows = data.payload.filled_rows;
      const rowsList = filledRows.length > 0 ? ` (righe: ${filledRows.join(', ')}${filledCount > 10 ? '...' : ''})` : '';
      errorLog.textContent = `ERRORE: Il file selezionato ha già la colonna B compilata (${filledCount} ${filledCount === 1 ? 'riga' : 'righe'})${rowsList}.\n\nSeleziona un file nuovo con solo la colonna A (causali) compilata.`;
      errorLog.style.color = '#f44336'; // Rosso per errore
      switchView(initialView); // Torna alla vista iniziale
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
      // Nascondi l'animazione di caricamento
      loadingAnimation.classList.add('hidden');

      // Estrai il conteggio dal payload (es: "Completati 25 bollettini")
      let count = 0;
      if (data.payload && typeof data.payload === 'string') {
        const match = data.payload.match(/(\d+)/);
        if (match) {
          count = parseInt(match[1], 10);
        }
      } else if (typeof data.payload === 'number') {
        count = data.payload;
      }

      // Anima il conteggio con effetto contatore
      animateCounter(count);

      // Passa alla schermata di completamento
      setTimeout(() => {
        switchView(completionView);
        // Inizializza l'animazione Lottie dopo un breve ritardo
        setTimeout(async () => {
          const iconContainer = document.getElementById('completion-icon');
          if (iconContainer) {
            iconContainer.innerHTML = '';

            // Verifica che la libreria Lottie sia caricata
            if (typeof lottie === 'undefined') {
              console.error('Lottie library not loaded from CDN');
              iconContainer.innerHTML = '<div style="font-size:100px;text-align:center;line-height:200px;">✅</div>';
              return;
            }

            try {
              console.log('Loading Lottie animation from completion-icon.json...');
              const response = await fetch('./completion-icon.json');

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              const animationData = await response.json();
              console.log('Animation data loaded successfully');

              lottie.loadAnimation({
                container: iconContainer,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: animationData
              });
              console.log('Lottie animation initialized');
            } catch (error) {
              console.error('Error loading Lottie animation:', error);
              // Fallback: mostra un'icona statica
              iconContainer.innerHTML = '<div style="font-size:100px;text-align:center;line-height:200px;">✅</div>';
            }
          } else {
            console.error('completion-icon container not found');
          }
        }, 300);
      }, 500);
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
    
    case 'backend-extract-start':
      console.log('Inizio estrazione backend');
      showBackendDownloadNotification();
      backendLoadingText.textContent = 'Configurazione iniziale (solo alla prima installazione)...';
      break;

    case 'backend-extract-complete':
      console.log('Estrazione completata');
      setTimeout(() => {
        hideBackendDownloadNotification();
        enableAllButtons(); // Riabilita tutti i pulsanti
      }, 1500);
      break;

    case 'backend-ready':
      // Il backend è già pronto (non serve estrazione)
      console.log('Backend già disponibile:', data.payload);
      hideBackendDownloadNotification();
      break;

    case 'backend-extract-error':
      console.error('Errore estrazione:', data.payload);
      backendLoadingText.textContent = `Errore: ${data.payload}`;
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
    updateInfo.textContent = `Versione ${version}`;
    updateNotification.classList.remove('hidden');
    updateProgressContainer.classList.remove('hidden'); // Mostra subito la barra
    updateProgress.value = 0;
    updateProgressText.textContent = 'Download in corso...';
    installUpdateBtn.classList.add('hidden');
}

// Nasconde notifica aggiornamento
function hideUpdateNotification() {
    updateNotification.classList.add('hidden');
}

// Mostra progresso download
function showDownloadProgress(progress) {
    updateProgressContainer.classList.remove('hidden');
    updateProgress.value = Math.round(progress.percent);
    updateProgressText.textContent = `${Math.round(progress.percent)}%`;
}

// Mostra pulsante installa
function showInstallButton() {
    installUpdateBtn.classList.remove('hidden');
    updateProgressContainer.classList.add('hidden');
    updateInfo.textContent = 'Download completato';
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

// Pulsante installa aggiornamento
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
    backendOverlay.classList.remove('hidden');
    // L'animazione Lottie è già inizializzata e in loop
}

// Nasconde notifica download backend
function hideBackendDownloadNotification() {
    backendOverlay.classList.add('hidden');
    // Ferma l'animazione Lottie per risparmiare risorse
    if (backendLottieAnimation) {
        backendLottieAnimation.stop();
    }
}

// L'overlay viene mostrato automaticamente all'avvio (vedi DOMContentLoaded)
// e nascosto quando il backend è pronto (backend-ready o backend-extract-complete)

// Funzione per disabilitare tutti i pulsanti dell'interfaccia
function disableAllButtons() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
    });
}

// Funzione per riabilitare tutti i pulsanti
function enableAllButtons() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
    });
}

// Mostra versione dell'app
window.electronAPI.getAppVersion().then(version => {
    document.getElementById('app-version').textContent = `v${version}`;
});

// Funzione per animare il contatore dei bollettini completati
function animateCounter(targetCount) {
    const duration = 2000; // 2 secondi
    const startTime = Date.now();
    const startValue = 0;

    function updateCounter() {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(startValue + (targetCount - startValue) * easeOut);

        completionCount.textContent = currentValue;

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            completionCount.textContent = targetCount;
        }
    }

    requestAnimationFrame(updateCounter);
}