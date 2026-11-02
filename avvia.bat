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
echo.

echo Avvio di Adaptive Coach AI su http://localhost:3000
echo Per fermarla chiudi questa finestra.
start "" http://localhost:3000
call npm run dev
