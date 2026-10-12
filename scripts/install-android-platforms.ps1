$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
$env:ANDROID_HOME = "C:\Users\vanne\AppData\Local\Android\Sdk"
$sdkManager = "C:\Users\vanne\AppData\Local\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat"

Write-Host "Accepting Android SDK licenses..."
cmd.exe /c "echo y | `"$sdkManager`" --licenses"

Write-Host "Installing platforms;android-34 and build-tools;34.0.0..."
cmd.exe /c "`"$sdkManager`" `"platforms;android-34`" `"build-tools;34.0.0`" `"platform-tools`""

Write-Host "Android SDK platforms and build-tools installed successfully!"
