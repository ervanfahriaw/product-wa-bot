@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ANDROID_HOME=D:\Android\Sdk"

echo Installing platforms;android-34 into D:\Android\Sdk...
call "D:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" "platforms;android-34"
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] platforms;android-34 installed!
) else (
    echo [FAILED] Installation failed with error %ERRORLEVEL%
)
