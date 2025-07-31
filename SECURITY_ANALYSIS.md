# Analisi di Sicurezza dell'Applicazione "Bollettini"

**Oggetto:** Valutazione della sicurezza e dell'architettura dell'applicazione desktop per l'automazione dei bollettini.

**Sintesi Esecutiva:**

L'applicazione è stata progettata con un'architettura **intrinsecamente sicura**, che la isola completamente da accessi di rete esterni e limita drasticamente la sua superficie di attacco. Non agisce come un server, non apre porte di rete e non è raggiungibile dall'esterno. La sua operatività è confinata esclusivamente alla macchina locale su cui viene eseguita, comportandosi in modo simile a un qualsiasi software di produttività (es. un editor di testo o un client di posta elettronica). Non può essere "hackerata" nel senso tradizionale del termine (es. tramite attacchi di rete), poiché **non espone alcun servizio su cui un attacco possa essere sferrato**.

---

### Architettura e Flusso Dati

L'applicazione è composta da due parti principali che lavorano in simbiosi ma in modo isolato:

1.  **Frontend (Electron.js):** Costituisce l'interfaccia utente grafica (GUI). L'utente interagisce con questa finestra per selezionare il file Excel e avviare il processo.
2.  **Backend (Script Python):** È il "motore" che esegue l'automazione. Viene eseguito come un processo figlio locale, avviato e controllato unicamente dal frontend Electron.

Il flusso operativo è il seguente:
1.  L'utente avvia l'applicazione Electron.
2.  Tramite l'interfaccia, l'utente seleziona un file Excel dal proprio computer.
3.  L'interfaccia utente avvia lo script Python (`backend.py` o la sua versione compilata `backend.exe`), passandogli il percorso del file Excel come argomento da riga di comando.
4.  Lo script Python, eseguito localmente, legge il file Excel, si connette al portale della sanità via browser (usando la libreria Playwright) ed esegue l'automazione.
5.  La comunicazione tra frontend e backend avviene **esclusivamente tramite i canali di Standard I/O (stdin/stdout)**, un meccanismo di comunicazione tra processi locali sicuro e consolidato, gestito dal sistema operativo.

---

### Punti Chiave di Sicurezza

#### 1. Nessuna Esposizione di Rete (Zero Network Footprint)

Questo è il punto più critico. L'applicazione **non apre alcuna porta TCP/UDP** sul computer dell'utente.
*   Il backend Python (`backend.py`) non contiene codice per creare socket, server web (come Flask/Django) o qualsiasi altro tipo di listener di rete. La sua unica attività di rete è quella di *client*, quando il browser controllato da Playwright si connette in uscita (outbound) al sito `polpor.salute.gov.it`.
*   Il frontend Electron (`main.js`) agisce solo da orchestratore di processi locali.
*   **Conclusione:** Non essendoci servizi in ascolto, è impossibile per un aggressore esterno connettersi all'applicazione tramite la rete per sfruttare eventuali vulnerabilità. L'applicazione è invisibile sulla rete.

#### 2. Esecuzione e Comunicazione Isolata tra Processi

*   **Processo Figlio Controllato:** Il backend Python è un processo figlio (`child_process`) dello
    scrittorio Electron. Viene avviato, monitorato e terminato dal processo padre. Se l'applicazione principale viene chiusa, anche il processo Python viene terminato forzatamente, prevenendo processi orfani.
*   **Comunicazione via Standard I/O:** Lo scambio di informazioni (stato di avanzamento, richiesta CAPTCHA, ecc.) avviene tramite `stdin` e `stdout`. Questo canale è strettamente limitato ai due processi e non è intercettabile dalla rete. È l'equivalente di eseguire un comando in un terminale e leggerne l'output, un'operazione gestita interamente e in modo sicuro dal sistema operativo.

#### 3. Misure di Sicurezza Specifiche di Electron

L'applicazione adotta le best practice di sicurezza raccomandate per Electron, che sono fondamentali per prevenire attacchi basati su codice web:
*   `contextIsolation: true`: Questa impostazione garantisce che il codice del frontend (renderer, che disegna la pagina `index.html`) e il codice del backend di Electron (`main.js`) vengano eseguiti in contesti JavaScript separati. Ciò impedisce al codice della pagina web di accedere direttamente alle potenti API di Node.js.
*   `nodeIntegration: false`: Disabilita l'accesso diretto ai moduli di Node.js (come `fs` per il file system o `child_process`) dal codice dell'interfaccia utente. Questo è cruciale per impedire che un potenziale attacco di tipo Cross-Site Scripting (XSS) possa trasformarsi in un'esecuzione di codice remoto sulla macchina dell'utente.

#### 4. Gestione dei Dati e delle Credenziali

*   **File `config.ini`:** Le credenziali (Ragione Sociale, Codice Fiscale, Email) sono memorizzate in un file di configurazione locale. Questo file viene letto solo dallo script Python locale e mai trasmesso o esposto altrove. Non contiene password. È un approccio standard per la configurazione di software desktop.
*   **File Locali:** L'applicazione interagisce solo con file scelti esplicitamente dall'utente (il file Excel) e con i file che essa stessa crea nella cartella `downloads`. Non esegue scansioni del file system né accede a file non autorizzati.

### Conclusione Finale per il Reparto IT

L'applicazione in questione è un **automa desktop stand-alone**. Non è un'applicazione client-server né un servizio web. La sua architettura la rende simile a uno script eseguito localmente, ma dotato di un'interfaccia grafica per facilitarne l'uso.

Le potenziali minacce sono quindi limitate a quelle di un qualsiasi altro eseguibile presente sulla macchina e non a vulnerabilità di rete:
*   L'unico "rischio" è intrinseco all'azione che compie: automatizzare l'interazione con un sito web e modificare un file locale. Queste azioni sono avviate consapevolmente e deliberatamente dall'utente.
*   L'applicazione non può essere compromessa da remoto tramite la rete perché, semplicemente, **non ha una presenza sulla rete**.

In sintesi, l'applicazione è sicura per progettazione ("secure by design") e il suo utilizzo non introduce nuove vulnerabilità significative nel perimetro di sicurezza aziendale.
