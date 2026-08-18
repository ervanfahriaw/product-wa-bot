@echo off
title WA Bot Controller
cd /d "%~dp0"

REM Gunakan node dari .tools jika tersedia, atau node global
if exist "%~dp0.tools\node-v20.18.0-win-x64\node.exe" (
    set "PATH=%~dp0.tools\node-v20.18.0-win-x64;%PATH%"
)

echo ======================================================
echo   Menjalankan WA Bot Web Controller...
echo ======================================================
node src/server/index.js
pause
