@echo off
rem Avvia Adaptive Coach AI sul computer. Doppio clic per lanciarla.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non e' installato.
  echo Scaricalo da https://nodejs.org - versione LTS - poi riapri questo file.
  pause
  exit /b 1
)

echo Controllo delle librerie (la prima volta ci vuole qualche minuto)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo Installazione non riuscita. Controlla la connessione a internet e riprova.
  pause
  exit /b 1
)

rem Il Blocco note a volte salva ".env.local.txt": lo rinomino.
if not exist .env.local if exist .env.local.txt ren .env.local.txt .env.local
if not exist .env.local if exist env.local ren env.local .env.local
if not exist .env.local if exist env.local.txt ren env.local.txt .env.local

rem Primo avvio su questo computer: crea .env.local chiedendo i due valori di Supabase.
if not exist .env.local (
  echo.
  echo Su questo computer manca il collegamento a Supabase ^(file .env.local^).
  set /p CREA=Vuoi crearlo adesso? Scrivi S e premi Invio, oppure solo Invio per la modalita dimostrativa: 
)
if not exist .env.local if /i "%CREA%"=="S" (
  echo.
  echo Su supabase.com: Project Settings, poi Data API per l'indirizzo, poi API Keys per la chiave publishable.
  echo Per incollare in questa finestra usa il tasto destro del mouse oppure Ctrl+V.
  echo.
  set /p SUPA_IN_URL=Incolla il Project URL ^(inizia con https://^) e premi Invio: 
  set /p SUPA_IN_KEY=Incolla la chiave publishable o anon e premi Invio: 
)
if not exist .env.local if /i "%CREA%"=="S" (
  > .env.local echo # Configurazione Supabase
  >> .env.local echo NEXT_PUBLIC_SUPABASE_URL=%SUPA_IN_URL%
  >> .env.local echo NEXT_PUBLIC_SUPABASE_ANON_KEY=%SUPA_IN_KEY%
  echo File .env.local creato nella cartella del progetto.
)
set SUPA_IN_KEY=

rem Coach AI: finche' manca la chiave OpenAI la chiede all'avvio (Invio per saltare). La chiave non viene mostrata.
set HAS_AI=NO
set AI_IN_KEY=
if exist .env.local findstr /r /b /c:"OPENAI_API_KEY=.." .env.local >nul && set HAS_AI=SI
if exist .env.local if "%HAS_AI%"=="NO" (
  echo.
  echo Coach AI: per attivarlo incolla la chiave OpenAI ^(inizia con sk-^) e premi Invio.
  echo Se non ce l'hai ancora premi solo Invio: il resto dell'app funziona lo stesso.
  set /p AI_IN_KEY=Chiave OpenAI: 
)
if defined AI_IN_KEY (
  rem Prima un a capo: il Blocco note salva senza a capo finale e la chiave finirebbe attaccata all'ultima riga.
  >> .env.local echo.
  >> .env.local echo OPENAI_API_KEY=%AI_IN_KEY%
  set HAS_AI=SI
  echo Chiave OpenAI salvata in .env.local.
)
set AI_IN_KEY=

rem Controllo della configurazione Supabase, senza mostrare i valori.
set SUPA_URL=NO
set SUPA_KEY=NO
if exist .env.local (
  findstr /r /b /c:"NEXT_PUBLIC_SUPABASE_URL=https://." .env.local >nul && set SUPA_URL=SI
  findstr /r /b /c:"NEXT_PUBLIC_SUPABASE_ANON_KEY=.." .env.local >nul && set SUPA_KEY=SI
  findstr /r /b /c:"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.." .env.local >nul && set SUPA_KEY=SI
)
echo.
if not exist .env.local (
  echo Supabase: file .env.local NON trovato. L'app parte in modalita dimostrativa.
) else (
  echo Supabase: indirizzo impostato: %SUPA_URL%   chiave impostata: %SUPA_KEY%
  if "%SUPA_URL%%SUPA_KEY%"=="SISI" (echo Supabase configurato: vedrai la pagina di accesso.) else (echo Manca un valore in .env.local: l'app parte in modalita dimostrativa.)
)
echo Coach AI: chiave impostata: %HAS_AI%
if exist .env.local findstr /r /c:"=.*[A-Z_][A-Z_]*_KEY=" /c:"=.*STRAVA_CLIENT_" /c:"=.*NEXT_PUBLIC_" .env.local >nul && (
  echo ATTENZIONE: in .env.local due valori sono finiti sulla stessa riga. Aprilo con Blocco note e metti ogni NOME=valore su una riga sua.
)
set HAS_STRAVA=NO
if exist .env.local findstr /r /b /c:"STRAVA_CLIENT_SECRET=.." .env.local >nul && findstr /r /b /c:"STRAVA_CLIENT_ID=[0-9]" .env.local >nul && set HAS_STRAVA=SI
echo Strava: chiavi impostate: %HAS_STRAVA%   ^(facoltativo, guida in docs\STRAVA.md^)
echo.

echo Avvio di Adaptive Coach AI su http://localhost:3000
echo Per fermarla chiudi questa finestra.
start "" http://localhost:3000
call npm run dev
