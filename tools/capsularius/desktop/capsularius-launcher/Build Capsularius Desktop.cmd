@echo off
setlocal
cd /d "%~dp0"

set "CAPSULARIUS_ROOT=%~dp0..\.."
for %%I in ("%CAPSULARIUS_ROOT%") do set "CAPSULARIUS_ROOT=%%~fI"
set "STAGING_DIR=%CAPSULARIUS_ROOT%\_capsularius-brand-staging"
set "PACKAGE_DIR=%CAPSULARIUS_ROOT%\_capsularius-brand-package"
set "RUNTIME_DIR=%CAPSULARIUS_ROOT%\Capsularius Desktop"
set "RUNTIME_EXE=%RUNTIME_DIR%\Capsularius Desktop.exe"

echo.
echo Building the branded Capsularius Desktop runtime...
echo.

set "PORTABLE_NODE="
for /d %%D in ("%~dp0node-v*-win-x64") do (
  if exist "%%~fD\node.exe" set "PORTABLE_NODE=%%~fD"
)
if defined PORTABLE_NODE set "PATH=%PORTABLE_NODE%;%PATH%"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required before Capsularius Desktop can be built.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo Installing the local Electron runtime...
  call npm install
  if errorlevel 1 goto :buildfailed
)

for /f "usebackq delims=" %%V in (`node -p "require('./node_modules/electron/package.json').version"`) do set "ELECTRON_VERSION=%%V"
if not defined ELECTRON_VERSION (
  echo Electron could not be identified.
  goto :buildfailed
)

if not exist "%CAPSULARIUS_ROOT%\capsularius.ico" (
  echo The Capsularius icon file was not found in "%CAPSULARIUS_ROOT%".
  goto :buildfailed
)

if exist "%STAGING_DIR%" rmdir /s /q "%STAGING_DIR%"
if exist "%PACKAGE_DIR%" rmdir /s /q "%PACKAGE_DIR%"
mkdir "%STAGING_DIR%"
copy /y "package.json" "%STAGING_DIR%\package.json" >nul
copy /y "main.js" "%STAGING_DIR%\main.js" >nul

call npx --yes @electron/packager "%STAGING_DIR%" "Capsularius Desktop" --platform=win32 --arch=x64 --electron-version=%ELECTRON_VERSION% --out="%PACKAGE_DIR%" --overwrite --icon="%CAPSULARIUS_ROOT%\capsularius.ico" --asar --prune=true
if errorlevel 1 goto :buildfailed

if not exist "%PACKAGE_DIR%\Capsularius Desktop-win32-x64\Capsularius Desktop.exe" (
  echo The branded executable was not created.
  goto :buildfailed
)

if exist "%RUNTIME_DIR%" rmdir /s /q "%RUNTIME_DIR%"
move "%PACKAGE_DIR%\Capsularius Desktop-win32-x64" "%RUNTIME_DIR%" >nul
rmdir /s /q "%STAGING_DIR%"
rmdir /s /q "%PACKAGE_DIR%"

echo.
echo Branded Capsularius Desktop is ready:
echo %RUNTIME_EXE%
echo.
exit /b 0

:buildfailed
echo.
echo The branded Capsularius Desktop runtime could not be built.
echo Send me the text shown above.
pause
exit /b 1
