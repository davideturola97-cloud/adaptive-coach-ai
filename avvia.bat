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

if not exist node_modules (
  echo Prima installazione delle librerie: ci vuole qualche minuto...
  call npm install
  if errorlevel 1 (
    echo Installazione non riuscita. Controlla la connessione a internet e riprova.
    pause
    exit /b 1
  )
)

echo Avvio di Adaptive Coach AI su http://localhost:3000
echo Per fermarla chiudi questa finestra.
start "" http://localhost:3000
call npm run dev
