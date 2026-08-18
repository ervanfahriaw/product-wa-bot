$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

if (Test-Path "$ScriptDir\.tools\node-v20.18.0-win-x64\node.exe") {
    $env:Path = "$ScriptDir\.tools\node-v20.18.0-win-x64;" + $env:Path
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Menjalankan WA Bot Web Controller..." -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan

node src/server/index.js
