# Mettere l'app online (Vercel) e installarla sul telefono

Tempo: circa 20 minuti. Costo: zero (piano gratuito Hobby di Vercel, per uso personale).
L'app gira a Dublino (`vercel.json`), vicino al database Supabase in Irlanda.

## 1. Database: l'ultima migrazione

In Supabase → **SQL Editor** → incolla ed esegui `supabase/migrations/0008_auth_throttle.sql`
(limite ai tentativi di accesso). Se l'hai già eseguita, rieseguirla non fa danni.

## 2. Vercel

1. Vai su **vercel.com** → **Sign Up** → **Continue with GitHub** (stesso account del repository).
2. **Add New… → Project** → accanto a `adaptive-coach-ai` premi **Import**.
3. Prima di premere Deploy apri **Environment Variables** e aggiungi:

| Nome | Valore | Dove lo trovo |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | l'indirizzo del progetto Supabase | è uguale a quello in `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la chiave pubblica (publishable/anon) | è uguale a quella in `.env.local` |
| `OPENAI_API_KEY` | la chiave OpenAI | è uguale a quella in `.env.local` |
| `OPENAI_MODEL` | facoltativo, es. `gpt-4.1-mini` | solo se l'hai messo in `.env.local` |
| `SUPABASE_DB_URL` | consigliato: aggiorna il database da solo a ogni deploy | vedi `docs/SUPABASE.md`, "Aggiornamento automatico" |

   I valori si copiano dal tuo `.env.local` (aprilo con Blocco note) e si incollano **solo** nella pagina di Vercel,
   mai in una chat. Vercel li conserva cifrati e li usa solo sul server.
   Senza `OPENAI_API_KEY` l'app funziona lo stesso, ma online il coach AI e la lettura degli screenshot restano spenti.

4. Premi **Deploy** e aspetta 2–3 minuti. Alla fine Vercel mostra l'indirizzo, per esempio
   `https://adaptive-coach-ai-tuonome.vercel.app`.
5. Torna in **Settings → Environment Variables** e aggiungi `NEXT_PUBLIC_SITE_URL` = quell'indirizzo (senza `/` finale),
   poi **Deployments → ⋯ → Redeploy**.

Da adesso ogni `git push` sul ramo `main` aggiorna l'app online da solo.

## 3. Supabase: autorizzare il nuovo indirizzo

Supabase → **Authentication → URL Configuration**:

- **Site URL**: l'indirizzo Vercel, es. `https://adaptive-coach-ai-tuonome.vercel.app`
- **Redirect URLs** → **Add URL**:
  - `https://adaptive-coach-ai-tuonome.vercel.app/**`
  - `http://localhost:3000/**` (per continuare a usare l'app sul PC)

Senza questo passaggio i link nelle email di conferma porterebbero al posto sbagliato.

## 4. Installare l'app sul telefono

Apri l'indirizzo Vercel sul telefono e accedi.

- **iPhone** (con Safari): tocca **Condividi** → **Aggiungi alla schermata Home** → **Aggiungi**.
- **Android** (con Chrome): compare **Installa app**, oppure menu **⋮** → **Installa app**.
  Anche nel **Profilo** c'è il pulsante con le istruzioni giuste per il tuo telefono.

L'app si apre a schermo intero con la sua icona. Senza connessione mostra una pagina "sei offline":
i tuoi dati non vengono mai salvati sul telefono.

## Sicurezza (cosa è attivo)

- Chiavi segrete (OpenAI) solo sul server: i file che le leggono sono marcati `server-only`, la compilazione fallisce se finiscono nel browser.
- Dati protetti dalle regole RLS di Supabase: ogni account vede solo i propri (verificato da 43 test).
- Intestazioni di sicurezza: Content Security Policy (il browser parla solo con l'app e con Supabase), niente iframe,
  HTTPS obbligatorio (HSTS), nosniff, referrer limitato, fotocamera/microfono/posizione disattivati.
- Accesso: massimo 5 tentativi sbagliati per account e 30 per indirizzo in 15 minuti; massimo 10 registrazioni all'ora per indirizzo.
- Coach AI: limiti giornalieri di richieste, token e immagini per account.
- Privacy: pagina `/privacy`, esportazione JSON e cancellazione dell'account dal Profilo.

## Test

```bash
npm run check   # tipi, lint, 188 test unitari e di sicurezza, compilazione
npm run e2e     # 30 test nel browser: Android, iPhone e computer (modalità dimostrativa)
```

Per `npm run e2e` sul PC la prima volta serve: `npx playwright install chromium`.
