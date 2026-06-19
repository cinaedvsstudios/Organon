@echo off
setlocal
cd /d "%~dp0"

echo.
echo Starting Capsularius Desktop...
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required before Capsularius Desktop can start.
  echo Install the current Node.js LTS release, then run this launcher again.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo First start: installing Capsularius Desktop...
  call npm install
  if errorlevel 1 (
    echo.
    echo Installation failed. Send me the text shown above.
    pause
    exit /b 1
  )
)

call npm start
if errorlevel 1 (
  echo.
  echo Capsularius Desktop did not start. Send me the text shown above.
  pause
)
