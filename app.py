# =============================================================================
# ATTENZIONE: SCRIPT DI TEST E SVILUPPO
# =============================================================================
# Questo script è uno strumento di utilità per testare la logica di
# automazione in modo isolato, senza avviare l'intera applicazione Electron.
#
# Caratteristiche principali:
# - Esegue l'automazione per un singolo bollettino.
# - Non legge da un file Excel, ma chiede l'input tramite una GUI dedicata.
# - È utile per il debug rapido (es. eseguendolo con headless=False).
#
# Questo file NON viene utilizzato nell'applicazione finale distribuita.
# L'applicazione Electron utilizza esclusivamente `backend.py`.
# =============================================================================


import configparser
import sys
from playwright.sync_api import sync_playwright, TimeoutError, Page
import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from PIL import Image, ImageTk
import base64
import io

class AppGUI(ttk.Window):
    def __init__(self, captcha_image_data):
        super().__init__(title="Compilazione Bollettino", themename="litera", size=(400, 300))
        self.center_window()
        self.result = {"captcha": None, "causale": None}
        self.captcha_image_data = captcha_image_data
        
        self.current_step = "captcha"
        self.create_widgets()

    def center_window(self):
        self.update_idletasks()
        width = self.winfo_width()
        height = self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 2) - (height // 2)
        self.geometry(f'{width}x{height}+{x}+{y}')

    def create_widgets(self):
        for widget in self.winfo_children():
            widget.destroy()

        if self.current_step == "captcha":
            self.setup_captcha_step()
        elif self.current_step == "causale":
            self.setup_causale_step()

    def setup_captcha_step(self):
        self.title("Passo 1: Inserisci CAPTCHA")
        container = ttk.Frame(self, padding=20)
        container.pack(fill=BOTH, expand=YES)

        header = ttk.Label(container, text="Inserisci il codice CAPTCHA", font=("Segoe UI", 14, "bold"))
        header.pack(pady=(0, 10))

        img = Image.open(io.BytesIO(self.captcha_image_data))
        photo = ImageTk.PhotoImage(img)
        
        label = ttk.Label(container, image=photo)
        label.image = photo 
        label.pack(pady=10)

        self.captcha_entry = ttk.Entry(container, width=30)
        self.captcha_entry.pack(pady=5)
        self.captcha_entry.focus_set()

        submit_button = ttk.Button(container, text="Avanti", command=self.submit_captcha, bootstyle="primary")
        submit_button.pack(pady=10, fill=X)
        self.bind('<Return>', lambda event=None: submit_button.invoke())

    def submit_captcha(self):
        captcha_code = self.captcha_entry.get()
        if captcha_code:
            self.result["captcha"] = captcha_code
            self.current_step = "causale"
            self.create_widgets()
        # else: gestisci errore opzionale
        

    def setup_causale_step(self):
        self.title("Passo 2: Inserisci Causale")
        container = ttk.Frame(self, padding=20)
        container.pack(fill=BOTH, expand=YES)

        header = ttk.Label(container, text="Inserisci la Causale", font=("Segoe UI", 14, "bold"))
        header.pack(pady=(0, 10))

        self.causale_text = ttk.Text(container, height=5, width=40)
        self.causale_text.pack(pady=5, fill=X, expand=YES)
        self.causale_text.focus_set()

        submit_button = ttk.Button(container, text="Conferma e Continua", command=self.submit_causale, bootstyle="success")
        submit_button.pack(pady=10, fill=X)

    def submit_causale(self):
        causale = self.causale_text.get("1.0", "end-1c")
        if causale:
            self.result["causale"] = causale
            self.destroy()
        # else: gestisci errore opzionale

def get_user_input_with_gui(page: Page) -> dict:
    print("Recupero dell'immagine CAPTCHA per la GUI...")
    img_element = page.locator("img[alt='captcha']")
    src = img_element.get_attribute('src')
    
    if not src.startswith('data:image/JPEG;base64,'):
        print("Immagine CAPTCHA non trovata. Impossibile avviare la GUI.")
        return None

    base64_data = src.replace('data:image/JPEG;base64,', '')
    image_data = base64.b64decode(base64_data)
    
    app = AppGUI(captcha_image_data=image_data)
    app.mainloop()
    return app.result

def block_unnecessary_resources(route):
    """ Blocca il caricamento di risorse non essenziali come fogli di stile, immagini e font. """
    if route.request.resource_type in ["stylesheet", "image", "font"]:
        route.abort()
    else:
        route.continue_()

def login_e_naviga_fino_a_mer(page: Page, config: configparser.ConfigParser):
    """
    Esegue il login e naviga attraverso le pagine fino alla selezione "MER".
    """
    print("Navigazione alla pagina di login...")
    page.goto("https://polpor.salute.gov.it/pol-ui-public/#/login")
    page.wait_for_selector("h4:has-text('Accedi')")
    print("Pagina di login caricata.")

    print("Selezione 'Persona Giuridica' e 'Impresa Italiana'...")
    page.get_by_text("Persona Giuridica").click()
    page.get_by_text("Impresa Italiana").click()

    print("Compilazione credenziali dal file di configurazione...")
    credenziali = config['Credenziali']
    page.get_by_label("Ragione Sociale").fill(credenziali['RAGIONE_SOCIALE'])
    page.get_by_label("Codice Fiscale").fill(credenziali['CODICE_FISCALE'])
    email_input = page.get_by_label("Email")
    email_input.fill(credenziali['EMAIL'])
    email_input.press("Enter")
    # Qui attendiamo l'input dell'utente dalla GUI che verrà chiamata nel main
    
def compila_modulo_tariffa(page: Page, causale: str):
    """
    Compila la sezione della tariffa, inserisce la quantità e la causale.
    """
    print("Attendo pagina tariffa...")
    page.locator("#codiceTariffa").wait_for(state="visible")
    print("Inserisco codice tariffa '17' e cerco...")
    page.locator("#codiceTariffa").fill("17")
    page.get_by_role("button", name="Ricerca").click()

    print("Seleziono la tariffa corretta...")
    target_row = page.get_by_role("row").filter(has_text="SMAF_MER17 - U. T. MILANO MALPENSA")
    target_row.wait_for(state="visible")
    target_row.get_by_role("checkbox").click()

    print("Inserisco quantità '1'...")
    page.locator("#quantita0").fill("1")

    print(f"Inserisco la causale: '{causale}'...")
    page.locator("#causale").fill(causale)
    print("Modulo tariffa compilato.")


def main():
    config = configparser.ConfigParser()
    config.read('config.ini')
    headless_mode = config['Impostazioni'].getboolean('HEADLESS', True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless_mode)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
            viewport={'width': 1920, 'height': 1080}
        )
        page = context.new_page()
        page.route("**/*", block_unnecessary_resources)
        page.set_default_timeout(60000)

        try:
            # Login e navigazione iniziale
            login_e_naviga_fino_a_mer(page, config)

            # Mostra la GUI per raccogliere l'input dell'utente
            user_input = get_user_input_with_gui(page)

            if not user_input or not user_input["captcha"] or not user_input["causale"]:
                print("Input annullato dall'utente. Uscita.")
                browser.close()
                return

            # Procedi con l'inserimento del CAPTCHA
            print("Inserimento del codice CAPTCHA ricevuto dalla GUI...")
            page.get_by_placeholder("Inserisci il codice di verifica").fill(user_input["captcha"])
            page.get_by_role("button", name="Verifica").click()
            
            accedi_button = page.get_by_role("button", name="Accedi")
            accedi_button.wait_for(state="visible", timeout=10000) # Timeout aumentato per sicurezza
            accedi_button.click()
            print("Login completato con successo.")

            # Navigazione post-login
            print("Navigazione a 'Nuovo Pagamento'...")
            page.get_by_role("link", name="Nuovo Pagamento").click()
    
            print("Selezione ufficio 'USMAF'...")
            page.get_by_role("row", name="SMAF-Sanità marittima aerea e di frontiera - USMAF").get_by_role("button", name="Seleziona").click()

            print("Selezione prestazione 'MER'...")
            page.get_by_role("row", name="MER-Controllo merci in importazione").get_by_role("button", name="Seleziona").click()
            print("Navigazione fino a MER completata.")

            # Compila il modulo finale con la causale
            compila_modulo_tariffa(page, user_input["causale"])

            print("\nSUCCESSO: Il bollettino è stato compilato.")
            print("Lo script è in attesa. Premi il pulsante 'Salva' nel browser, poi chiudi questa finestra.")
            
        except TimeoutError:
            print("\nERRORE: Timeout. Il sito potrebbe essere lento o un elemento non è stato trovato.")
            print("Se hai inserito un CAPTCHA errato, questo è normale. Riprova.")
        except Exception as e:
            print(f"\nERRORE INASPETTATO: {e}")
        finally:
            print("\nPremi Invio per chiudere lo script e il browser.")
            input()
            context.close()
            browser.close()

if __name__ == "__main__":
    main() 