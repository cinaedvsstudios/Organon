@echo off
setlocal
cd /d "%~dp0"

set "CAPSULARIUS_ROOT=%~dp0..\.."
for %%I in ("%CAPSULARIUS_ROOT%") do set "CAPSULARIUS_ROOT=%%~fI"
set "BRANDED_RUNTIME=%CAPSULARIUS_ROOT%\Capsularius Desktop\Capsularius Desktop.exe"

if not exist "%BRANDED_RUNTIME%" (
  call "%~dp0Build Capsularius Desktop.cmd"
  if errorlevel 1 exit /b 1
)

start "Capsularius Desktop" "%BRANDED_RUNTIME%"
exit /b 0
