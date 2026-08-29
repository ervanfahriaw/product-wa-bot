const { execSync } = require('child_process');

console.log('Testing process termination methods...');

// Method 1: WMIC
try {
  const wmicRes = execSync('wmic process where "name=\'msedge.exe\' and commandline like \'%session-wa-bot-main%\'" get ProcessId /format:list', { encoding: 'utf8' });
  console.log('WMIC Result:', wmicRes.trim());
} catch (e) {
  console.log('WMIC Error:', e.message);
}

// Method 2: PowerShell
try {
  const psCmd = `Get-CimInstance Win32_Process | Where-Object { ($_.Name -like '*edge*' -or $_.Name -like '*chrome*') -and ($_.CommandLine -like '*session-wa-bot-main*') } | Select-Object ProcessId, Name, CommandLine`;
  const psRes = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { encoding: 'utf8' });
  console.log('PowerShell Result:\n', psRes.trim());
} catch (e) {
  console.log('PowerShell Error:', e.message);
}
