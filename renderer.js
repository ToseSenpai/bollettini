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
  // Rimuove l'animazione da tutti gli elementi di stato prima di aggiornare
  // [mainStatus, currentTask].forEach(el => el.classList.remove('loading-animation'));

  switch (data.type) {
    case 'excel-file-selected':
      selectedFilePath = data.payload;
      filePathElement.textContent = `File: ${data.payload.split(/[\\/]/).pop()}`;
      // Non cambiare vista qui, attendi il conteggio
      break;
    
    case 'causali_count':
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

    case 'error':
      errorLog.textContent = `ERRORE: ${data.payload}`;
      mainStatus.textContent = "Processo Interrotto";
      loadingAnimation.classList.add('hidden');
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