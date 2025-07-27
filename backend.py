import configparser
import sys
import base64
import io
import os
import pandas as pd
import fitz  # PyMuPDF
import re
import json

def send_message(msg_type, payload):
    """Invia un messaggio JSON a stdout."""
    print(json.dumps({"type": msg_type, "payload": payload}))
    sys.stdout.flush()

def run_automation(config_path, excel_path):
    from playwright.sync_api import sync_playwright, Page

    def wait_for_loading_spinner_to_disappear(page: Page):
        """Sposta questa funzione qui dentro perché dipende da Page."""
        text_spinner = page.locator(".spinner-text:has-text('Attendere...')")
        visual_spinner = page.locator(".la-ball-clip-rotate")
        text_spinner.wait_for(state='hidden', timeout=60000)
        visual_spinner.wait_for(state='hidden', timeout=60000)
    
    try:
        config = configparser.ConfigParser()
        # Usa il percorso corretto per config.ini
        actual_config_path = get_resource_path(config_path)
        config.read(actual_config_path)
        
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
            page.set_default_timeout(60000)

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
                wait_for_loading_spinner_to_disappear(page)
                
                send_message('task_progress', 70)
                page.wait_for_selector("#codiceTariffa", state="visible")
                page.locator("#codiceTariffa").fill("17")
                page.get_by_role("button", name="Ricerca").click()
                wait_for_loading_spinner_to_disappear(page)

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
                if codice_avviso:
                    idx = causali_df.index[causali_df[0] == causale].tolist()
                    if idx:
                        causali_df.loc[idx[0], 1] = codice_avviso
                        try:
                            causali_df.to_excel(excel_path, index=False, header=False)
                        except Exception as e:
                            send_message('error', f"Impossibile salvare Excel per '{causale}': {e}")
            
            send_message('global_progress', 100)
            send_message('finished', f"Automazione completata. {total_causali} bollettini salvati e file Excel aggiornato.")

    except Exception as e:
        send_message('error', str(e))

def load_causali_from_excel(file_path):
    try:
        df = pd.read_excel(file_path, header=None, engine='openpyxl')
        if df.shape[1] == 1:
            df[1] = None
        causali = df.iloc[:, 0].dropna().astype(str).tolist()
        return df, causali
    except Exception as e:
        # Invece di mandare un errore, che chiuderebbe il processo,
        # mandiamo un messaggio specifico gestibile dal frontend.
        send_message('error', f"Errore lettura Excel: {e}")
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
            count = len(causali_list) if causali_list is not None else 0
            send_message('causali_count', {'count': count})
        
        elif mode == '--run-automation':
            config_file = 'config.ini'
            excel_file = sys.argv[2]
            run_automation(config_file, excel_file)

    except Exception as e:
        send_message('error', f"Errore imprevisto: {e}")
        sys.exit(1) 