@echo off
setlocal
cd /d "%~dp0"

echo.
echo Starting Capsularius Desktop...
echo.

set "PORTABLE_NODE="
for /d %%D in ("%~dp0node-v*-win-x64") do (
  if exist "%%~fD\node.exe" set "PORTABLE_NODE=%%~fD"
)
if defined PORTABLE_NODE (
  set "PATH=%PORTABLE_NODE%;%PATH%"
  echo Using portable Node.js from "%PORTABLE_NODE%"
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required before Capsularius Desktop can start.
  echo Install the Windows installer from nodejs.org, or place an extracted node-v*-win-x64 folder beside this launcher.
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
