@echo off
setlocal
cd /d "%~dp0"

set "BRANDED_RUNTIME_VERSION=2"
set "RUNTIME_DIR=%~dp0Capsularius Desktop"
set "BRANDED_RUNTIME=%RUNTIME_DIR%\Capsularius Desktop.exe"
set "VERSION_FILE=%RUNTIME_DIR%\.capsularius-runtime-version"
set "INSTALLED_RUNTIME_VERSION="

if exist "%VERSION_FILE%" set /p INSTALLED_RUNTIME_VERSION=<"%VERSION_FILE%"
if not exist "%BRANDED_RUNTIME%" goto :build
if not "%INSTALLED_RUNTIME_VERSION%"=="%BRANDED_RUNTIME_VERSION%" goto :build
goto :launch

:build
call "%~dp0desktop\capsularius-launcher\Build Capsularius Desktop.cmd"
if errorlevel 1 exit /b 1

:launch
"%BRANDED_RUNTIME%"
exit /b %errorlevel%
