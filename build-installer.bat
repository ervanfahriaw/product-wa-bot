@echo off
title Build Installer WA Bot
cd /d "%~dp0"

echo ======================================================
echo   MEMBUAT INSTALLER WINDOWS (Setup_WABot_Bisnis_v1.0.exe)
echo ======================================================
echo.

REM Cek lokasi Inno Setup Compiler (ISCC.exe)
set "ISCC_PATH="
if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" (
    set "ISCC_PATH=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
) else if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
) else if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
    set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"
) else (
    where iscc >nul 2>nul
    if %errorlevel% equ 0 (
        set "ISCC_PATH=iscc"
    )
)

if "%ISCC_PATH%"=="" (
    echo [INFO] Inno Setup 6 belum terdeteksi di komputer ini.
    echo.
    echo Anda dapat menginstal Inno Setup secara otomatis via winget dengan menjalankan:
    echo   winget install JRSoftware.InnoSetup -e
    echo.
    echo Atau download gratis dari website resmi:
    echo   https://jrsoftware.org/isdl.php
    echo.
    pause
    exit /b 1
)

echo Menjalankan Inno Setup Compiler...
"%ISCC_PATH%" "%~dp0installer.iss"

if %errorlevel% equ 0 (
    echo.
    echo ======================================================
    echo   SUKSES! Installer selesai dibuat di folder:
    echo   dist\Setup_WABot_Bisnis_v1.0.exe
    echo ======================================================
) else (
    echo.
    echo [ERROR] Gagal mengompilasi installer. Cek pesan error di atas.
)

echo.
pause
