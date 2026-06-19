@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js is required before Capsularius Desktop can start.
  echo Install the current Node.js LTS release, then run this launcher again.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo.
  echo First start: installing Capsularius Desktop...
  call npm install
  if errorlevel 1 (
    echo.
    echo Installation failed. Keep this window open and send me the error text.
    pause
    exit /b 1
  )
)

call npm start
