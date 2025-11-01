# Guida allo Sviluppo - Generatore Bollettini

## Avvio dell'Applicazione in Sviluppo

### Problema Comune: ELECTRON_RUN_AS_NODE

Se durante l'avvio con `npm start` si verifica l'errore:

```
TypeError: Cannot read properties of undefined (reading 'whenReady')
```

**Causa:** La variabile d'ambiente `ELECTRON_RUN_AS_NODE=1` è impostata nell'ambiente, facendo eseguire Electron come Node.js normale invece che come applicazione Electron.

**Soluzione:**

```bash
# Verifica se la variabile è impostata
env | grep ELECTRON_RUN_AS_NODE

# Se presente, disabilitala e avvia l'app
unset ELECTRON_RUN_AS_NODE
npm start
```

Oppure in PowerShell:

```powershell
# Verifica
Get-ChildItem Env:ELECTRON_RUN_AS_NODE

# Rimuovi la variabile
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm start
```

### Avvio Normale

```bash
npm start
```

L'applicazione si avvierà in modalità sviluppo, utilizzando Python direttamente invece del backend compilato.

## Architettura del Backend

### Modalità Sviluppo vs Produzione

- **Sviluppo (`isDev = true`)**: Usa `py -3.12` per eseguire `backend.py` direttamente
- **Produzione (`isDev = false`)**: Estrae e usa `backend.exe` da `backend.zip`

### Gestione del Backend alla Prima Installazione

Il sistema implementa un meccanismo di blocco dell'UI durante l'estrazione del backend alla prima installazione:

1. **[index.html:532-535](index.html#L532-L535)**: Overlay e dialogo visibili di default
2. **[renderer.js:7-15](renderer.js#L7-L15)**: Pulsanti disabilitati all'avvio
3. **[main.js:214-234](main.js#L214-L234)**: Inizializzazione backend prima dell'interfaccia
4. **[renderer.js:316-321](renderer.js#L316-L321)**: Gestione messaggio `backend-ready`

### Flusso di Inizializzazione

```
app.whenReady()
  ├─> Crea finestra (createWindow)
  ├─> Inizializza backend (initializeBackend)
  │   ├─> Dev mode: invia 'backend-ready' immediatamente
  │   └─> Prod mode:
  │       ├─> Backend presente: invia 'backend-ready'
  │       └─> Backend assente: estrai da backend.zip
  │           ├─> 'backend-extract-start'
  │           ├─> 'backend-extract-progress' (90%, 100%)
  │           └─> 'backend-extract-complete'
  └─> Controlla aggiornamenti (solo produzione)
```

## Build e Distribuzione

### Build Backend

```bash
# Compila solo il backend
npm run build-backend

# Compila backend e crea backend.zip
npm run build-backend-zip
```

Il backend viene compilato con PyInstaller e pacchettizzato in `backend.zip` che sarà incluso nell'installer.

### Build Applicazione

```bash
# Build completo (backend + app)
npm run build-full

# Build solo app (richiede backend.zip esistente)
npm run build
```

L'installer risultante si troverà in `dist/`.

### Configurazione Electron Builder

Il file `backend.zip` viene automaticamente estratto da `app.asar` durante l'installazione grazie alla configurazione in `package.json`:

```json
"asarUnpack": [
  "backend.zip"
]
```

## Testing

### Test Prima Installazione (Estrazione Backend)

Per testare il comportamento alla prima installazione:

1. Installa l'app con `npm run build-full`
2. Trova la cartella userData:
   ```powershell
   cd "$env:LOCALAPPDATA\bollettini"
   ```
3. Elimina la cartella backend:
   ```powershell
   Remove-Item -Recurse -Force backend
   ```
4. Avvia l'app installata

**Comportamento atteso:**
- Overlay visibile immediatamente
- Dialogo "Preparazione Backend" mostrato
- Barra di progresso: 90% → 100%
- Pulsanti disabilitati durante estrazione
- Overlay scompare dopo completamento (~1.5s)

### Test Backend Già Disponibile

Avvia normalmente l'app. L'overlay dovrebbe scomparire quasi istantaneamente.

## Struttura dei File

```
bollettini/
├── main.js              # Processo principale Electron
├── renderer.js          # Processo renderer (UI)
├── preload.js          # Bridge sicuro tra main e renderer
├── index.html          # UI principale
├── backend.py          # Backend Python (dev)
├── backend.spec        # Configurazione PyInstaller
├── backend.zip         # Backend compilato (prod, generato)
├── config.ini          # Configurazione backend
└── package.json        # Configurazione npm/electron-builder
```

## Variabili d'Ambiente

- `ELECTRON_RUN_AS_NODE`: **NON DEVE ESSERE IMPOSTATA** durante lo sviluppo
- `NODE_ENV`: Non utilizzata, si usa `app.isPackaged` per rilevare produzione

## Versioning

La versione in `package.json` viene sincronizzata con:
- Versione dell'app mostrata nell'UI
- File `version.txt` nel backend estratto
- Controllo compatibilità backend

### ⚠️ IMPORTANTE: Incrementare Sempre la Versione

**Ogni volta che fai una modifica (frontend, backend, o entrambi), DEVI incrementare la versione in `package.json`.**

```bash
# Esempio: da 1.0.2 a 1.0.3
```

**Perché è importante:**
- L'app usa la versione per determinare se il backend è aggiornato
- Se non incrementi la versione, il backend vecchio NON verrà sostituito automaticamente
- L'utente dovrebbe cancellare manualmente `C:\Users\<user>\AppData\Local\bollettini\backend`

**Workflow corretto per ogni modifica:**

1. **Modifica il codice** (frontend, backend, o entrambi)
2. **Incrementa la versione** in `package.json`:
   - Bug fix minore: 1.0.2 → 1.0.3
   - Nuova funzionalità: 1.0.3 → 1.1.0
   - Breaking change: 1.1.0 → 2.0.0
3. **Ricompila tutto**: `npm run build-full`
4. **Installa e testa** la nuova versione

Il sistema rileverà automaticamente che la versione è cambiata e aggiornerà il backend automaticamente.

## Debug

### DevTools

Per abilitare DevTools in produzione, decommenta in `main.js`:

```javascript
// mainWindow.webContents.openDevTools();
```

### Log Console

I log del processo principale sono visibili nel terminale, mentre i log del renderer sono nella Console del DevTools (F12).

### Verifica Stato Backend

Nel DevTools Console:

```javascript
// Verifica overlay
document.getElementById('backend-overlay').classList.contains('hidden')

// Verifica stato pulsanti
document.querySelectorAll('button').forEach(b => console.log(b.disabled))
```

## Problemi Comuni

### 1. Backend non si avvia in Dev Mode

**Errore**: `'py' is not recognized`

**Soluzione**: Installa Python 3.12 e assicurati che `py` launcher sia disponibile

### 2. Estrazione Backend Fallisce

**Causa possibile**: PowerShell non disponibile o permessi insufficienti

**Verifica**: L'estrazione usa `Expand-Archive` di PowerShell

### 3. App si blocca alla prima installazione

Se l'overlay rimane visibile indefinitamente:
- Verifica che `backend.zip` sia incluso nell'installer
- Controlla i log della console per errori di estrazione
- Verifica permessi di scrittura in `%LOCALAPPDATA%\bollettini`

## Riferimenti

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [PyInstaller](https://pyinstaller.org/)
