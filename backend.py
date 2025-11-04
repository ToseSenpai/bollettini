import configparser
import sys
import base64
import io
import os
import pandas as pd
import fitz  # PyMuPDF
import re
import json
import time
from datetime import datetime

def send_message(msg_type, payload):
    """Invia un messaggio JSON a stdout."""
    print(json.dumps({"type": msg_type, "payload": payload}))
    sys.stdout.flush()

def log_with_timestamp(message):
    """Log con timestamp per debugging."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    send_message('info', f"[{timestamp}] {message}")

def run_automation(config_path, excel_path):
    from playwright.sync_api import sync_playwright, Page

    def wait_for_loading_spinner_to_disappear(page: Page, timeout=60000):
        """Sposta questa funzione qui dentro perché dipende da Page."""
        text_spinner = page.locator(".spinner-text:has-text('Attendere...')")
        visual_spinner = page.locator(".la-ball-clip-rotate")
        text_spinner.wait_for(state='hidden', timeout=timeout)
        visual_spinner.wait_for(state='hidden', timeout=timeout)

    def wait_for_selector_with_retry(page: Page, selector, timeout, max_retry, wait_after_spinner, is_critical=False):
        """
        Attende un selettore con retry logic e exponential backoff.

        Args:
            page: Pagina Playwright
            selector: Selettore CSS da attendere
            timeout: Timeout in millisecondi per ogni tentativo
            max_retry: Numero massimo di tentativi
            wait_after_spinner: Delay in secondi dopo operazioni di attesa
            is_critical: Se True, usa timeout esteso per selettori critici

        Returns:
            True se il selettore è stato trovato, altrimenti solleva eccezione
        """
        for attempt in range(1, max_retry + 1):
            try:
                log_with_timestamp(f"Tentativo {attempt}/{max_retry} per selettore '{selector}'")

                # Attende che non ci siano più richieste di rete in corso
                try:
                    page.wait_for_load_state('networkidle', timeout=30000)
                    log_with_timestamp("Stato 'networkidle' raggiunto")
                except Exception as e:
                    log_with_timestamp(f"Timeout networkidle (continuo comunque): {e}")

                # Piccolo delay aggiuntivo
                if wait_after_spinner > 0:
                    log_with_timestamp(f"Attesa addizionale di {wait_after_spinner}s dopo spinner...")
                    time.sleep(wait_after_spinner)

                # Tenta di trovare il selettore
                page.wait_for_selector(selector, state="visible", timeout=timeout)
                log_with_timestamp(f"Selettore '{selector}' trovato con successo al tentativo {attempt}")
                return True

            except Exception as e:
                log_with_timestamp(f"Tentativo {attempt} fallito per '{selector}': {str(e)}")

                if attempt < max_retry:
                    # Exponential backoff: 2s, 4s, 8s...
                    backoff_time = 2 ** attempt
                    log_with_timestamp(f"Attesa di {backoff_time}s prima del prossimo tentativo...")
                    time.sleep(backoff_time)

                    # Al secondo tentativo, prova a fare screenshot per debugging
                    if attempt == 2:
                        try:
                            os.makedirs("logs", exist_ok=True)
                            screenshot_path = f"logs/error_screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                            page.screenshot(path=screenshot_path)
                            log_with_timestamp(f"Screenshot salvato in: {screenshot_path}")
                        except Exception as screenshot_error:
                            log_with_timestamp(f"Impossibile salvare screenshot: {screenshot_error}")
                else:
                    # Ultimo tentativo fallito, solleva l'eccezione
                    error_msg = f"Timeout definitivo dopo {max_retry} tentativi per selettore '{selector}': {str(e)}"
                    log_with_timestamp(error_msg)

                    # Screenshot finale
                    try:
                        os.makedirs("logs", exist_ok=True)
                        screenshot_path = f"logs/final_error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                        page.screenshot(path=screenshot_path)
                        log_with_timestamp(f"Screenshot finale salvato in: {screenshot_path}")
                    except:
                        pass

                    raise Exception(error_msg)
    
    try:
        config = configparser.ConfigParser()
        # Usa il percorso corretto per config.ini
        actual_config_path = get_resource_path(config_path)
        config.read(actual_config_path)

        # Carica le impostazioni di timeout e retry dalla config
        timeout_default = config['Impostazioni'].getint('TIMEOUT_DEFAULT', 120000)
        timeout_critico = config['Impostazioni'].getint('TIMEOUT_SELETTORE_CRITICO', 180000)
        max_retry = config['Impostazioni'].getint('MAX_RETRY', 3)
        wait_after_spinner = config['Impostazioni'].getint('WAIT_AFTER_SPINNER', 2)

        log_with_timestamp(f"Configurazione caricata - Timeout default: {timeout_default}ms, Timeout critico: {timeout_critico}ms, Max retry: {max_retry}")

        causali_df, causali_list = load_causali_from_excel(excel_path)
        if not causali_list:
            send_message('error', "Nessuna causale trovata nel file Excel.")
            return

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=config['Impostazioni'].getboolean('HEADLESS', True))
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                accept_downloads=True
            )
            page = context.new_page()
            page.set_default_timeout(timeout_default)
            log_with_timestamp(f"Browser avviato, timeout default impostato a {timeout_default}ms")

            # --- LOGIN ---
            send_message('main_status', "Login in corso...")
            page.goto("https://polpor.salute.gov.it/pol-ui-public/#/login")
            page.wait_for_selector("h4:has-text('Accedi')")
            page.get_by_text("Persona Giuridica").click()
            page.get_by_text("Impresa Italiana").click()

            credenziali = config['Credenziali']
            page.get_by_label("Ragione Sociale").fill(credenziali['RAGIONE_SOCIALE'])
            page.get_by_label("Codice Fiscale").fill(credenziali['CODICE_FISCALE'])
            page.get_by_label("Email").fill(credenziali['EMAIL'])
            page.get_by_label("Email").press("Enter")
            
            # --- CAPTCHA ---
            img_element = page.locator("img[alt='captcha']")
            src = img_element.get_attribute('src')
            base64_data = src.replace('data:image/JPEG;base64,', '')
            send_message('captcha_required', base64_data)
            
            # Attende l'input del CAPTCHA da stdin
            captcha_code = sys.stdin.readline().strip()
            if not captcha_code:
                raise Exception("Codice CAPTCHA non fornito.")

            page.get_by_placeholder("Inserisci il codice di verifica").fill(captcha_code)
            page.get_by_role("button", name="Verifica").click()
            page.get_by_role("button", name="Accedi").click()
            wait_for_loading_spinner_to_disappear(page)
            send_message('task_progress', 100) # Task di login completato

            # --- CICLO SULLE CAUSALI ---
            total_causali = len(causali_list)
            for i, causale in enumerate(causali_list):
                main_status_text = f"Elaborazione: {i+1} di {total_causali}"
                send_message('main_status', main_status_text)
                send_message('global_progress', ((i / total_causali) * 100))
                send_message('current_task', f"Causale: {causale}")
                
                send_message('task_progress', 10)
                page.get_by_role("link", name="Nuovo Pagamento").click()
                wait_for_loading_spinner_to_disappear(page)
                
                send_message('task_progress', 30)
                page.get_by_role("row", name="SMAF-Sanità marittima aerea e di frontiera - USMAF").get_by_role("button", name="Seleziona").click()
                wait_for_loading_spinner_to_disappear(page)

                send_message('task_progress', 50)
                page.get_by_role("row", name="MER-Controllo merci in importazione").get_by_role("button", name="Seleziona").click()
                wait_for_loading_spinner_to_disappear(page, timeout=timeout_default)

                send_message('task_progress', 70)
                log_with_timestamp("Inizio attesa per selettore critico #codiceTariffa")
                # Usa la funzione con retry per il selettore critico #codiceTariffa
                wait_for_selector_with_retry(page, "#codiceTariffa", timeout_critico, max_retry, wait_after_spinner, is_critical=True)
                log_with_timestamp("Selettore #codiceTariffa trovato, procedo con il fill")
                page.locator("#codiceTariffa").fill("17")
                page.get_by_role("button", name="Ricerca").click()
                wait_for_loading_spinner_to_disappear(page, timeout=timeout_default)

                target_row = page.get_by_role("row").filter(has_text="SMAF_MER17 - U. T. MILANO MALPENSA")
                target_row.get_by_role("checkbox").click()
                page.locator("#quantita0").fill("1")
                page.locator("#causale").fill(causale)
                
                send_message('task_progress', 80)
                page.locator('button:has-text("Salva")').click()
                wait_for_loading_spinner_to_disappear(page)
                
                send_message('task_progress', 90)
                with page.expect_download() as download_info:
                    page.locator('button:has-text("Genera Bollettino")').click()
                download = download_info.value

                safe_causale = "".join([c for c in causale if c.isalpha() or c.isdigit() or c.isspace()]).rstrip() or f"bollettino_{i+1}"
                
                download_dir = "downloads"
                os.makedirs(download_dir, exist_ok=True)
                
                suggested_ext = os.path.splitext(download.suggested_filename)[1] if download.suggested_filename else ""
                final_filename = os.path.join(download_dir, f"{safe_causale}{suggested_ext or '.pdf'}")
                download.save_as(final_filename)
                
                send_message('task_progress', 100)
                
                # --- Estrazione e Salvataggio Codice Avviso ---
                codice_avviso = extract_codice_avviso(final_filename)
                send_message('info', f"Codice avviso estratto: {codice_avviso if codice_avviso else 'NON TROVATO'}")

                if codice_avviso:
                    # Debug: mostra il DataFrame e i tipi
                    send_message('info', f"Cerco causale '{causale}' (tipo: {type(causale).__name__})")
                    send_message('info', f"Valori nel DataFrame colonna 0: {causali_df[0].tolist()}")
                    send_message('info', f"Tipi nel DataFrame colonna 0: {causali_df[0].dtype}")

                    # Converti entrambi a stringa e rimuovi spazi per confronto robusto
                    causali_df[0] = causali_df[0].astype(str).str.strip()
                    causale_str = str(causale).strip()

                    idx = causali_df.index[causali_df[0] == causale_str].tolist()
                    send_message('info', f"Indice trovato per causale '{causale_str}': {idx}")

                    if idx:
                        # Salva il codice avviso come stringa per evitare problemi con numeri grandi
                        causali_df.loc[idx[0], 1] = str(codice_avviso)
                        send_message('info', f"Aggiornamento DataFrame per riga {idx[0]} con codice {codice_avviso}")

                        try:
                            causali_df.to_excel(excel_path, index=False, header=False)
                            send_message('info', f"File Excel salvato con successo: {excel_path}")
                        except Exception as e:
                            send_message('error', f"Impossibile salvare Excel per '{causale}': {e}")
                    else:
                        send_message('warning', f"Causale '{causale}' non trovata nel DataFrame")
                else:
                    send_message('warning', f"Nessun codice avviso trovato nel PDF: {final_filename}")
            
            send_message('global_progress', 100)
            send_message('finished', f"Automazione completata. {total_causali} bollettini salvati e file Excel aggiornato.")

    except Exception as e:
        send_message('error', str(e))

def load_causali_from_excel(file_path):
    try:
        # Leggi Excel senza specificare dtype (lo impostiamo dopo)
        df = pd.read_excel(file_path, header=None, engine='openpyxl')

        # VALIDAZIONE: Controlla se la colonna B (index 1) è già compilata
        # Controllo PRIMA di creare la colonna se non esiste
        if df.shape[1] >= 2:
            # Il file ha almeno 2 colonne
            # Conta quante righe hanno dati nella colonna B (index 1)
            filled_count = 0
            filled_rows = []

            for idx, val in df[1].items():
                # Controlla se il valore NON è NaN/None E non è stringa vuota
                if pd.notna(val) and str(val).strip() != '':
                    filled_count += 1
                    filled_rows.append(idx)

            if filled_count > 0:
                # Invia messaggio di errore con dettagli
                send_message('column_b_not_empty', {
                    'filled_count': int(filled_count),
                    'filled_rows': [int(r) + 1 for r in filled_rows[:10]]  # Prime 10 righe (1-indexed)
                })
                return None, None

            # Assicurati che la colonna 1 sia sempre object/string per evitare problemi con numeri grandi
            df[1] = df[1].astype('object')
        else:
            # Il file ha solo 1 colonna, creane una seconda vuota
            df[1] = None

        causali = df.iloc[:, 0].dropna().astype(str).tolist()
        return df, causali
    except Exception as e:
        # Invece di mandare un errore, che chiuderebbe il processo,
        # mandiamo un messaggio specifico gestibile dal frontend.
        import traceback
        error_details = traceback.format_exc()
        send_message('error', f"Errore lettura Excel: {e}\n\nDettagli:\n{error_details}")
        return None, None

def extract_codice_avviso(pdf_path):
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text("text")
        doc.close()
        
        match = re.search(r"Codice Avviso\s*([\d\s]{18,25})", text)
        if match:
            codice = re.sub(r'\s+', '', match.group(1))
            if len(codice) == 18 and codice.startswith("3000"):
                return codice
    except Exception as e:
        send_message('error', f"Errore estrazione PDF: {e}")
    return None

def get_resource_path(relative_path):
    """ Ottiene il percorso assoluto della risorsa, funziona sia in dev che con PyInstaller """
    if getattr(sys, 'frozen', False):
        # Se l'app è "congelata" (impacchettata), il percorso base è la cartella dell'eseguibile
        base_path = os.path.dirname(sys.executable)
    else:
        # Altrimenti, siamo in un ambiente normale
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

if __name__ == '__main__':
    try:
        mode = sys.argv[1]

        if mode == '--count-causali':
            excel_file = sys.argv[2]
            _, causali_list = load_causali_from_excel(excel_file)

            # Se causali_list è None, significa che la validazione è fallita
            # Il messaggio di errore è già stato inviato da load_causali_from_excel
            if causali_list is not None:
                count = len(causali_list)
                send_message('causali_count', {'count': count})
        
        elif mode == '--run-automation':
            config_file = 'config.ini'
            excel_file = sys.argv[2]
            run_automation(config_file, excel_file)

    except Exception as e:
        send_message('error', f"Errore imprevisto: {e}")
        sys.exit(1) 