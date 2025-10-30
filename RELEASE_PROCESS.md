# 📦 Processo di Rilascio - Generatore Bollettini

Guida completa per rilasciare una nuova versione dell'applicazione con auto-update.

## 🔄 Sistema di Auto-Update

L'applicazione utilizza `electron-updater` per gli aggiornamenti automatici tramite GitHub Releases:
- Gli utenti ricevono notifica quando è disponibile un nuovo aggiornamento
- Il download avviene in background
- L'installazione richiede il riavvio dell'applicazione
- **Frontend e Backend vengono aggiornati insieme** (inclusi nello stesso installer)

## 📋 Prerequisiti

1. **Python 3.12** installato e configurato
2. **Node.js e npm** installati
3. **PyInstaller** installato: `pip install pyinstaller`
4. **Dipendenze Python** installate: `pip install -r requirements.txt`
5. **Token GitHub** con permessi per creare release (opzionale per pubblicazione automatica)

## 🚀 Procedura di Rilascio Completa

### Passo 1: Aggiorna la Versione

Modifica **SOLO** il file `package.json`:

```json
{
  "version": "1.0.2"  // Incrementa qui (es: 1.0.1 → 1.0.2)
}
```

**IMPORTANTE**: Non modificare altri file! La versione viene letta automaticamente da `main.js`.

### Passo 2: Commit e Push

```bash
git add package.json
git commit -m "Bump version to 1.0.2"
git push
```

### Passo 3: Testa le Modifiche

```bash
# Avvia l'app in modalità sviluppo
npm start

# Testa tutte le funzionalità principali
# - Selezione file Excel
# - Elaborazione causali
# - Generazione PDF
# - Aggiornamento Excel
```

### Passo 4: Genera Backend e Installer

```bash
# Questo comando fa TUTTO:
# 1. Pulisce build/dist/backend
# 2. Compila backend.py in backend.exe
# 3. Crea backend.zip
# 4. Genera l'installer che include backend.zip
npm run build-full
```

**Output**:
- `backend.zip` → Incluso nell'installer (non va caricato separatamente)
- `dist/Generatore Bollettini-X.X.X-Setup.exe` → Installer completo
- `dist/latest.yml` → File di metadati per electron-updater

**Verifica**:
- L'installer deve essere in `dist/`
- Il nome deve includere la versione corretta
- La dimensione deve essere ~1.3GB (include backend.zip)

### Passo 5: Testa l'Installer Localmente

1. **Installa l'applicazione**:
   ```bash
   # Esegui l'installer generato
   ./dist/Generatore\ Bollettini-X.X.X-Setup.exe
   ```

2. **Testa tutte le funzionalità**:
   - Avvio dell'applicazione
   - Estrazione automatica del backend alla prima esecuzione
   - Elaborazione di almeno 2-3 causali
   - Verifica PDF generati in `downloads/`
   - Verifica aggiornamento Excel con codici avviso

3. **Disinstalla** (importante per test puliti):
   - Pannello di Controllo → Programmi → Disinstalla

### Passo 6: Crea la GitHub Release

1. **Vai su GitHub**: https://github.com/ToseSenpai/bollettini/releases

2. **Clicca "Draft a new release"**

3. **Compila i campi**:
   - **Tag version**: `vX.X.X` (es: `v1.0.2`) - DEVE iniziare con 'v'
   - **Release title**: `Generatore Bollettini vX.X.X`
   - **Description**: Descrivi le modifiche (esempio sotto)

4. **Carica i file** (trascina nella sezione "Attach binaries"):
   - `dist/Generatore Bollettini-X.X.X-Setup.exe` ✅ OBBLIGATORIO
   - `dist/latest.yml` ✅ OBBLIGATORIO

   ⚠️ **NON caricare backend.zip** - è già incluso nell'installer!

5. **Pubblica**:
   - ✅ Seleziona "Set as the latest release"
   - Clicca "Publish release"

### Esempio Description Release:

```markdown
## 🚀 Novità v1.0.2

### Miglioramenti
- Aggiunto supporto Python 3.12
- Migliorato sistema di aggiornamento Excel
- Ottimizzazioni prestazioni

### Correzioni
- Risolto problema causali non trovate nel DataFrame
- Corretto errore di estrazione backend

### Installazione
- **Nuovi utenti**: Scarica e esegui l'installer
- **Aggiornamento**: L'app si aggiornerà automaticamente

---

📦 Dimensione installer: ~1.3GB (include backend)
```

### Passo 7: Verifica Auto-Update

1. **Installa una versione precedente** su un PC di test

2. **Avvia l'app**: Dovrebbe mostrare una notifica di aggiornamento disponibile

3. **Accetta l'aggiornamento**: L'app dovrebbe scaricare e installare la nuova versione

4. **Verifica la versione**: Dopo il riavvio, il backend e frontend saranno entrambi aggiornati

## 📝 Note Importanti

### ✅ Cose da FARE

- ✅ Testare SEMPRE localmente prima di pubblicare
- ✅ Incrementare la versione seguendo [Semantic Versioning](https://semver.org/)
  - `MAJOR.MINOR.PATCH` (es: `1.0.2`)
  - MAJOR: Modifiche incompatibili
  - MINOR: Nuove funzionalità compatibili
  - PATCH: Bug fix compatibili
- ✅ Eseguire `npm run build-full` per generare tutto insieme
- ✅ Verificare che `latest.yml` sia presente
- ✅ Documentare le modifiche nella description della release
- ✅ Mantenere `backend.zip` nel repository per lo sviluppo

### ❌ Cose da NON FARE

- ❌ NON modificare manualmente la versione in `main.js` o altri file
- ❌ NON pubblicare senza testare l'installer
- ❌ NON caricare `backend.zip` separatamente su GitHub Release (è già nell'installer)
- ❌ NON usare tag senza prefisso 'v' (es: `1.0.2` invece di `v1.0.2`)
- ❌ NON saltare passi nella procedura
- ❌ NON dimenticare di aggiornare solo `package.json`

## 🎯 Vantaggi del Sistema Unificato

✅ **Un solo build**: `npm run build-full` genera tutto
✅ **Frontend e backend sempre sincronizzati**: Stessa versione
✅ **Più semplice**: Meno file da gestire su GitHub
✅ **Più veloce per l'utente**: Nessun download separato del backend
✅ **Meno errori**: Impossibile avere versioni miste

## 🐛 Troubleshooting

### L'auto-update non funziona

**Possibili cause**:
1. Tag della release non inizia con 'v' → Usa `v1.0.2` non `1.0.2`
2. File `latest.yml` non caricato → Carica insieme all'installer
3. Release non marcata come "latest" → Seleziona l'opzione in GitHub

### Il backend non viene estratto

**Soluzione**:
- Assicurati di aver eseguito `npm run build-full` che include `backend.zip` nell'installer
- Verifica che la dimensione dell'installer sia ~1.3GB
- Controlla i log dell'applicazione per errori di estrazione

### L'installer è troppo piccolo

**Causa**: `backend.zip` non è stato incluso
**Soluzione**: Esegui `npm run build-backend-zip` prima di `npm run build`

## 🔐 Pubblicazione Automatica (Opzionale)

Per pubblicare automaticamente durante il build:

```bash
# Richiede GH_TOKEN nelle variabili d'ambiente
export GH_TOKEN=your_github_token_here
npm run publish
```

Questo farà:
1. Build completo (backend + frontend)
2. Upload automatico su GitHub
3. Creazione release automatica

## 📊 Checklist Pre-Release

- [ ] Versione aggiornata in `package.json`
- [ ] Modifiche committate e pushate su GitHub
- [ ] Modifiche testate in modalità sviluppo (`npm start`)
- [ ] Backend e installer generati (`npm run build-full`)
- [ ] Installer testato localmente (installazione + funzionalità)
- [ ] Release creata su GitHub con tag corretto (`vX.X.X`)
- [ ] File caricati: `Setup.exe` + `latest.yml` (NON backend.zip)
- [ ] Release marcata come "latest"
- [ ] Auto-update testato da versione precedente
- [ ] Documentazione aggiornata (se necessario)

## 📂 Struttura File per Release

```
📁 dist/
├── 📦 Generatore Bollettini-1.0.2-Setup.exe  (carica su GitHub) ✅
├── 📄 latest.yml                              (carica su GitHub) ✅
└── 📁 win-unpacked/                          (solo locale, non caricare)

📁 root/
└── 📦 backend.zip                             (incluso nell'installer, mantieni in repo)
```

## 📞 Supporto

Per problemi o domande:
- **Issues**: https://github.com/ToseSenpai/bollettini/issues
- **Email**: simone.tosello@dhl.com
