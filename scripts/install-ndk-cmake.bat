@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo Installing NDK and CMake to D:\Android\Sdk...
echo y | "D:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="D:\Android\Sdk" "ndk;25.1.8937393" "cmake;3.22.1"
echo Done!
