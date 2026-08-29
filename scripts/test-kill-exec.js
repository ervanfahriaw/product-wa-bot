const { execSync } = require('child_process');

console.log('Testing killing matched headless/session processes...');

try {
  const psCmd = `Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'msedge.exe' -or $_.Name -eq 'chrome.exe' -or $_.Name -eq 'chromium.exe') -and ($_.CommandLine -like '*session-wa-bot-main*' -or $_.CommandLine -like '*data*session*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Output "Killed: $($_.ProcessId) $($_.Name)" }`;
  const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { encoding: 'utf8', timeout: 5000 });
  console.log('Result:', result.trim());
} catch (e) {
  console.log('Error:', e.message);
}
