@echo off
setlocal
set "LAUNCHER_DIR=%~dp0"
for %%I in ("%LAUNCHER_DIR%..\..") do set "REPOSITORY_ROOT=%%~fI"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js is required before Capsularius Desktop can start.
  echo Install the current Node.js LTS release, then run this launcher again.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

where git >nul 2>&1
if not errorlevel 1 (
  git -C "%REPOSITORY_ROOT%" rev-parse --is-inside-work-tree >nul 2>&1
  if not errorlevel 1 (
    echo Syncing the local Organon checkout from GitHub...
    git -C "%REPOSITORY_ROOT%" pull --ff-only
    if errorlevel 1 echo GitHub sync was skipped. Starting with the local files already on disk.
  )
)

pushd "%LAUNCHER_DIR%"
if not exist "node_modules\electron" (
  echo.
  echo First start: installing the Capsularius Desktop launcher files...
  call npm install
  if errorlevel 1 (
    echo.
    echo The launcher dependencies could not be installed.
    pause
    popd
    exit /b 1
  )
)

call npm start
popd
