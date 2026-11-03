# Collegare Supabase

1. Crea un account gratuito su https://supabase.com e un nuovo progetto (regione: Europe). Annota la password del database.
2. **SQL Editor** > **New query**: incolla tutto il contenuto di `supabase/migrations/0001_schema.sql` e premi **Run**.
   Deve comparire "Success. No rows returned". Ripeti con `0002_multisport.sql` (nuoto, palestra, triathlon, test) `0003_plan.sql` (programma e sue versioni) `0004_activities.sql` (attività, sedute saltate, feedback) `0005_reschedule.sql` (riprogrammazione, storico e annullamento) `0006_coach_ai.sql` (chat del coach e limiti di uso) e `0007_splits.sql` (intertempi).
   Ogni script si esegue una volta, in ordine; rieseguirlo non fa danni.
3. **Authentication** > **URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: aggiungi `http://localhost:3000/auth/callback`
4. **Project Settings** > **API** (o **Data API** / **API Keys**): copia **Project URL** e la chiave **anon public**.
5. Nella cartella del progetto copia `.env.example` in `.env.local` e incolla i due valori dopo `=`.
   Non usare mai la chiave `service_role` nell'app: scavalca le regole di sicurezza.
6. Riavvia l'app (`avvia.bat`). Ora ti chiede di accedere o registrarti.

## Aggiornamento automatico del database (consigliato)

Da qui in poi le migrazioni si applicano da sole: a ogni deploy su Vercel (prima della compilazione) e a ogni avvio di `avvia.bat`.
Si tiene il conto nella tabella `schema_migrations`; la prima volta le riapplica tutte (sono scritte per poterlo fare senza danni).
Se una migrazione fallisce, la compilazione si ferma e resta online la versione precedente.

Serve una sola variabile, `SUPABASE_DB_URL`:

1. Supabase → progetto → pulsante **Connect** in alto → scheda **Connection String** → **Session pooler**.
   (Non "Direct connection": Vercel non la raggiunge.)
2. Copia la stringa, tipo `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
   e sostituisci `[YOUR-PASSWORD]` con la password del database (quella scelta alla creazione del progetto;
   se non la ricordi: Project Settings → Database → **Reset database password**).
3. **Vercel** → Settings → Environment Variables → `SUPABASE_DB_URL` = la stringa → Redeploy.
4. **PC** (facoltativo): aggiungi la riga `SUPABASE_DB_URL=...` in `.env.local`.

La stringa contiene la password del database: solo in `.env.local` e su Vercel, mai in chat o in uno screenshot.
Lo script la usa solo per applicare le migrazioni e non la stampa mai (nemmeno negli errori).
