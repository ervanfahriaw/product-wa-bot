$ErrorActionPreference = "Stop"
$sdkRoot = "C:\Users\vanne\AppData\Local\Android\Sdk"
$cmdlineZip = "D:\Lynk ID\bot digital\bot digital\android\commandlinetools.zip"
$targetDir = Join-Path $sdkRoot "cmdline-tools"

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Write-Host "Downloading Google Android Command Line Tools (146MB)..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$wc = New-Object System.Net.WebClient
$wc.DownloadFile("https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip", $cmdlineZip)

Write-Host "Downloaded! Extracting to cmdline-tools/latest..."
Expand-Archive -Path $cmdlineZip -DestinationPath $targetDir -Force
Remove-Item $cmdlineZip -Force

# Google packages zip as 'cmdline-tools' inside targetDir -> rename to 'latest'
$extracted = Join-Path $targetDir "cmdline-tools"
$latest = Join-Path $targetDir "latest"
if (Test-Path $extracted) {
    if (Test-Path $latest) { Remove-Item $latest -Recurse -Force }
    Rename-Item -Path $extracted -NewName "latest" -Force
}

# Create local.properties for Gradle
$escapedSdkRoot = $sdkRoot.Replace("\", "\\")
Set-Content -Path "D:\Lynk ID\bot digital\bot digital\android\local.properties" -Value "sdk.dir=$escapedSdkRoot" -Encoding ASCII

Write-Host "Setup complete! local.properties updated with: $escapedSdkRoot"
