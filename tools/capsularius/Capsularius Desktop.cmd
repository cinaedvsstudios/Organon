@echo off
setlocal
cd /d "%~dp0"

set "BRANDED_RUNTIME=%~dp0Capsularius Desktop\Capsularius Desktop.exe"
if not exist "%BRANDED_RUNTIME%" (
  call "%~dp0desktop\capsularius-launcher\Build Capsularius Desktop.cmd"
  if errorlevel 1 exit /b 1
)

"%BRANDED_RUNTIME%"
exit /b %errorlevel%
