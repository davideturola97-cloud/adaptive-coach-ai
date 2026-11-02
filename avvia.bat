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
