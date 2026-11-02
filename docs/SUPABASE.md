# Collegare Supabase

1. Crea un account gratuito su https://supabase.com e un nuovo progetto (regione: Europe). Annota la password del database.
2. **SQL Editor** > **New query**: incolla tutto il contenuto di `supabase/migrations/0001_schema.sql` e premi **Run**.
   Deve comparire "Success. No rows returned".
3. **Authentication** > **URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: aggiungi `http://localhost:3000/auth/callback`
4. **Project Settings** > **API** (o **Data API** / **API Keys**): copia **Project URL** e la chiave **anon public**.
5. Nella cartella del progetto copia `.env.example` in `.env.local` e incolla i due valori dopo `=`.
   Non usare mai la chiave `service_role` nell'app: scavalca le regole di sicurezza.
6. Riavvia l'app (`avvia.bat`). Ora ti chiede di accedere o registrarti.
