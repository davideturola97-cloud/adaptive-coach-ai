# Importare gli allenamenti da Strava

L'app **legge soltanto** da Strava: non pubblica, non modifica e non cancella nulla.
Importa corse (anche trail e tapis roulant), bici (strada, gravel, MTB, rulli), nuoto e palestra
con durata in movimento, distanza, frequenza cardiaca media, dislivello, potenza (solo se misurata da un sensore)
e intertempi: km per la corsa, giri o tratti da 5 km per la bici, vasche per il nuoto.
Camminate, escursioni, sci ed e-bike non vengono importati.

## 1. Crea l'applicazione su Strava (una volta sola, 5 minuti)

1. Accedi a Strava dal computer e apri **https://www.strava.com/settings/api**.
2. Compila il modulo:
   - **Application Name**: `Adaptive Coach`
   - **Category**: `Training`
   - **Website**: `https://adaptive-coach-ai-gamma.vercel.app`
   - **Authorization Callback Domain**: `adaptive-coach-ai-gamma.vercel.app`
     (solo il dominio: niente `https://` e niente `/` finale. `localhost` per il PC è già ammesso da Strava)
3. Accetta le condizioni e premi **Create**. Se chiede un'icona, carica `public/icon-512.png` di questo progetto.
4. Nella pagina che compare trovi **Client ID** (un numero) e **Client Secret** (premi *show*).
   Il Client Secret è una password: non incollarlo in chat, non fotografarlo.

## 2. Inserisci le due chiavi

**Sul PC**: apri `.env.local` con Blocco note e aggiungi in fondo due righe:

```
STRAVA_CLIENT_ID=il numero del Client ID
STRAVA_CLIENT_SECRET=il Client Secret
```

Salva e riavvia `avvia.bat`: nel riepilogo deve comparire `Strava: chiavi impostate: SI`.

**Online**: Vercel → progetto → **Settings → Environment Variables** → aggiungi `STRAVA_CLIENT_ID` e `STRAVA_CLIENT_SECRET`
con gli stessi valori, poi **Deployments → ⋯ → Redeploy**.

## 3. Database

Supabase → **SQL Editor** → incolla ed esegui `supabase/migrations/0009_strava.sql`.

## 4. Collega e importa

Nell'app: **Profilo → Strava → Collega Strava**. Su Strava premi **Autorizza** lasciando la spunta
"Visualizza i dati delle tue attività". Torni al Profilo: premi **Importa adesso**.

- Il primo import prende le attività degli ultimi **30 giorni**; i successivi solo le nuove.
- Il pulsante **Importa da Strava** c'è anche nella pagina **Allenamenti**.
- Un'attività già importata non si importa due volte. Se l'avevi già registrata a mano o da screenshot
  (stesso sport, giorno e durata simile), non viene duplicata: te lo dice.
- Se nel programma quel giorno c'è una seduta dello stesso sport, l'attività la completa.
- Strava non conosce lo **sforzo percepito**: apri ogni attività importata e aggiungi RPE e sensazioni.
  Senza RPE il coach non può valutare il carico.
- Strava permette 100 letture ogni 15 minuti: oltre 40 attività alla volta, l'app ti chiede di riprovare dopo.

## Sicurezza

- Il Client Secret sta solo sul server (`.env.local`, Vercel): non arriva mai al browser.
- I token di accesso a Strava sono salvati **cifrati** (AES-256-GCM) in Supabase, leggibili solo dal tuo account
  e solo dal server dell'app. Un codice casuale (`state`) protegge il ritorno da Strava.
- **Scollega Strava** (Profilo) revoca l'accesso anche su Strava e cancella i token; le attività importate restano.
  Cancellando l'account, l'accesso a Strava viene revocato prima di eliminare i dati.
- Puoi revocare l'accesso anche da Strava: Impostazioni → **Le mie app**.
