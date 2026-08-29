@echo off
title WA Bot Digital Assistant - 1-Klik Jalankan
cd /d "%~dp0"
echo ======================================================
echo    MENJALANKAN WA BOT DIGITAL ASSISTANT (LOCAL SERVER)
echo ======================================================
echo.

if not exist "node_modules" (
  echo [Info] Mendeteksi clone baru... Menginstall dependensi (npm install)...
  call npm install --no-audit --no-fund
  echo [Sukses] Dependensi berhasil diinstall!
  echo.
)

echo Membuka server bot dan dashboard di browser...
echo Jangan tutup jendela terminal ini selama bot digunakan.
echo.
npm start
pause
