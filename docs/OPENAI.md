# Attivare il coach AI (OpenAI)

1. Crea un account su https://platform.openai.com (è diverso dall'abbonamento ChatGPT).
2. **Settings > Billing**: aggiungi un metodo di pagamento e un credito prepagato (per uso personale bastano pochi euro).
3. **Settings > Limits**: imposta un limite di spesa mensile basso (es. 5 €). È la protezione più forte contro le sorprese.
4. **API keys > Create new secret key**: copiala subito (si vede una volta sola). Non incollarla in chat o in altri posti.
5. Avvia l'app con `avvia.bat`: alla domanda "Chiave OpenAI" incollala e premi Invio. Viene salvata solo in `.env.local` sul tuo computer.

Facoltativo in `.env.local`:
- `OPENAI_MODEL` — modello usato (predefinito `gpt-4.1-mini`). Se OpenAI risponde che il modello non esiste, scrivi qui il nome di un modello disponibile nel tuo account.
- `AI_DAILY_REQUESTS`, `AI_DAILY_TOKENS`, `AI_DAILY_IMAGES` — limiti giornalieri per utente (predefiniti 60 richieste, 300.000 token, 15 screenshot).

Cosa vede l'AI: solo i dati dell'utente collegato (profilo, programma, attività, feedback, test), letti dal server.
Cosa non può fare: modificare il programma. Le proposte passano dal motore di regole e dal pulsante "Applica".
Gli screenshot vengono ridotti nel browser, analizzati e scartati: non vengono salvati.
