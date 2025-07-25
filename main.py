from playwright.sync_api import sync_playwright, TimeoutError

def run(playwright):
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("https://polpor.salute.gov.it/pol-ui-public/#/login")

        # Attendiamo che l'intestazione principale sia visibile
        print("Attendo il caricamento della pagina di login...")
        page.wait_for_selector("h4:has-text('Accedi')")
        print("Pagina di login caricata.")

        # 1. Seleziona "Persona Giuridica" cliccando direttamente sulla sua etichetta testuale
        print("Seleziono 'Persona Giuridica'...")
        page.get_by_text("Persona Giuridica").click()
        print("'Persona Giuridica' selezionato.")

        # 2. Ora che il resto del modulo dovrebbe essere visibile, attendiamo e selezioniamo "Impresa Italiana"
        print("Attendo che appaia 'Impresa Italiana'...")
        impresa_italiana_label = page.get_by_text("Impresa Italiana")
        impresa_italiana_label.wait_for(state='visible')
        print("'Impresa Italiana' è apparso. Lo seleziono...")
        impresa_italiana_label.click()
        print("'Impresa Italiana' selezionato.")

        # 3. Compila i campi rimanenti, attendendo che appaiano dopo il click precedente
        print("Attendo che appaiano i campi del modulo...")
        ragione_sociale_input = page.get_by_label("Ragione Sociale")
        ragione_sociale_input.wait_for(state='visible') # Attesa esplicita per il campo
        print("Campi del modulo apparsi. Compilo...")

        ragione_sociale_input.fill("DHL EXPRESS ITALY")
        page.get_by_label("Codice Fiscale").fill("04209680158")
        email_input = page.get_by_label("Email")
        email_input.fill("itcustoms.mxbhub@dhl.com")

        # Come indicato, premo "Invio" per far apparire il captcha
        print("Premo Invio sul campo email per visualizzare il captcha...")
        email_input.press("Enter")
        print("Campi compilati.")

        # 4. Ciclo di verifica Captcha con possibilità di re-inserimento
        while True:
            try:
                verification_code = input("Ora dovresti vedere il captcha. Inserisci il codice di verifica: ")
                captcha_input = page.get_by_placeholder("Inserisci il codice di verifica")
                captcha_input.fill(verification_code)

                # 5. Clicca su "Verifica"
                print("Codice captcha inserito. Clicco su 'Verifica'...")
                page.get_by_role("button", name="Verifica").click()

                # 6. Dopo la verifica, attendiamo e clicchiamo sul pulsante "Accedi"
                # Se il captcha è errato, questo andrà in timeout e passerà all'except
                print("Attendo il pulsante 'Accedi' (max 5 secondi)...")
                accedi_button = page.get_by_role("button", name="Accedi")
                accedi_button.wait_for(state="visible", timeout=5000) # Timeout di 5 secondi
                
                print("Pulsante 'Accedi' trovato. Clicco...")
                accedi_button.click()
                
                # Se arriviamo qui, il captcha era corretto e abbiamo cliccato Accedi. Usciamo dal ciclo.
                print("Captcha verificato con successo.")
                break

            except TimeoutError:
                print("\n--- ATTENZIONE: Captcha errato o verifica fallita. Riprova. ---")
                # Opzionale: attendiamo che il campo captcha sia nuovamente pronto
                try:
                    page.get_by_placeholder("Inserisci il codice di verifica").wait_for(state="visible", timeout=2000)
                except TimeoutError:
                    # Se anche il campo captcha non riappare, c'è un problema più serio
                    print("Errore critico: la pagina non è tornata allo stato previsto dopo il fallimento del captcha.")
                    raise # Solleva l'errore per fermare lo script


        # 7. Clicca su "Nuovo Pagamento"
        print("Login completato. Attendo il link 'Nuovo Pagamento'...")
        nuovo_pagamento_link = page.get_by_role("link", name="Nuovo Pagamento")
        nuovo_pagamento_link.wait_for(state="visible")
        print("Link 'Nuovo Pagamento' trovato. Clicco...")
        nuovo_pagamento_link.click()

        # 8. Attendi che la pagina si carichi, poi trova la riga dell'USMAF e clicca
        print("Attendo che la pagina degli uffici si carichi completamente...")
        page.wait_for_load_state('networkidle')
        print("Pagina caricata. Localizzo la riga per USMAF...")
        usmaf_row = page.get_by_role("row", name="SMAF-Sanità marittima aerea e di frontiera - USMAF")
        usmaf_row.wait_for(state="visible")
        print("Riga USMAF trovata. Clicco sul pulsante 'Seleziona'...")
        usmaf_row.get_by_role("button", name="Seleziona").click()
        print("Ufficio USMAF selezionato.")

        # 9. Attendi che la pagina si carichi, poi trova la riga di MER e clicca
        print("Attendo che la pagina delle prestazioni si carichi completamente...")
        page.wait_for_load_state('networkidle')
        print("Pagina caricata. Localizzo la riga per MER...")
        mer_row = page.get_by_role("row", name="MER-Controllo merci in importazione")
        mer_row.wait_for(state="visible")
        print("Riga MER trovata. Clicco sul pulsante 'Seleziona'...")
        mer_row.get_by_role("button", name="Seleziona").click()

        print("\nPrestazione MER selezionata con successo.")
        print("Lo script lascerà il browser aperto per permetterti di continuare manualmente.")
        print("\nEsecuzione terminata. Premi Invio per chiudere questa finestra.")

    except TimeoutError:
        print("\\nErrore: La pagina ha impiegato troppo tempo a caricare o un elemento non è stato trovato.")
        print("Questo può accadere se la connessione è lenta o se la struttura della pagina è cambiata.")
        print("Riprova a eseguire lo script. Se l'errore persiste, potrebbe essere necessario un aggiornamento.")
    except Exception as e:
        print(f"\\nSi è verificato un errore inaspettato: {e}")
    finally:
        print("\\nEsecuzione terminata. Premi Invio per chiudere questa finestra.")
        input() # Attende che l'utente prema invio prima di chiudere tutto
        # Il browser si chiuderà automaticamente alla fine dello script 'with'


with sync_playwright() as playwright:
    run(playwright) 