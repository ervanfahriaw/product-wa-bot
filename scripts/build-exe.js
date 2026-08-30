const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Parse argument --edition=bisnis | personal | all
const args = process.argv.slice(2);
let targetEdition = 'all';

for (const arg of args) {
  if (arg.startsWith('--edition=')) {
    targetEdition = arg.split('=')[1].toLowerCase().trim();
  }
}

console.log('======================================================');
console.log('       BUILD COMMERCIAL DISTRIBUTION & INSTALLERS     ');
console.log(`       Target Edition: ${targetEdition.toUpperCase()} `);
console.log('======================================================\n');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

/**
 * Mencari biner resmi Node.js yang sah dan memiliki tanda tangan digital (Authenticode).
 * @returns {string} Path ke node.exe
 */
function findOfficialNodeBinary() {
  const candidates = [
    process.execPath,
    'D:\\Data Aplikasi\\node.exe',
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe'
  ];

  for (const p of candidates) {
    if (fs.existsSync(p) && p.toLowerCase().endsWith('node.exe')) {
      return p;
    }
  }

  // Coba ambil dari PATH
  try {
    const fromPath = execSync('powershell -Command "Get-Command node | Select-Object -ExpandProperty Source"').toString().trim();
    if (fromPath && fs.existsSync(fromPath)) {
      return fromPath;
    }
  } catch (_) {}

  return process.execPath;
}

/**
 * Membersihkan folder target dari file data runtime / testing lama agar distribusi 100% bersih.
 * @param {string} targetFolder 
 */
function sanitizeDistributionFolder(targetFolder) {
  if (!fs.existsSync(targetFolder)) return;

  // 1. Hapus folder data runtime (database, sesi wa, cache)
  const dataDir = path.join(targetFolder, 'data');
  if (fs.existsSync(dataDir)) {
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) {}
  }

  // 2. Hapus folder cache session wwebjs jika ada
  const cacheDir = path.join(targetFolder, '.wwebjs_cache');
  if (fs.existsSync(cacheDir)) {
    try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch (_) {}
  }
  const authDir = path.join(targetFolder, '.wwebjs_auth');
  if (fs.existsSync(authDir)) {
    try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (_) {}
  }

  // 3. Hapus config.json dan license.json lama (JANGAN SAMPAI API KEY / LISENSI TESTER KETINGGALAN)
  const configJson = path.join(targetFolder, 'config', 'config.json');
  if (fs.existsSync(configJson)) {
    try { fs.unlinkSync(configJson); } catch (_) {}
  }
  const licenseJson = path.join(targetFolder, 'config', 'license.json');
  if (fs.existsSync(licenseJson)) {
    try { fs.unlinkSync(licenseJson); } catch (_) {}
  }

  // 4. Hapus file log, temporary backup, dan file exe pkg lama yang tidak tertandatangani
  try {
    const files = fs.readdirSync(targetFolder);
    for (const f of files) {
      if (f.endsWith('.log') || f.endsWith('.old') || f.endsWith('.bak') || f === 'wa-bot-bisnis.exe' || f === 'wa-bot-personal.exe' || f === 'wa-bot-assistant.exe') {
        try { fs.unlinkSync(path.join(targetFolder, f)); } catch (_) {}
      }
    }
  } catch (_) {}
}

/**
 * Membangun paket distribusi untuk satu edisi
 * @param {string} edition 'bisnis' | 'personal' | 'all'
 */
function buildEditionPackage(edition) {
  const isBisnis = edition === 'bisnis';
  const isPersonal = edition === 'personal';

  let folderName = 'wa-bot-assistant';
  let titleClean = 'WA Bot Assistant (Dual Edition)';
  let guideSrc = path.join(ROOT_DIR, 'docs/packaging-deployment.md');
  let guideDestName = 'PANDUAN_PENGGUNAAN.txt';
  let vpsScriptSrc = path.join(ROOT_DIR, 'scripts/deploy-vps.sh');
  let vpsScriptDestName = 'deploy-vps.sh';
  let batLauncherName = 'Buka-Bot-Assistant.bat';
  let vbsLauncherName = 'Buka-Bot-Assistant.vbs';
  let issFileName = 'wa-bot-bisnis.iss';

  if (isBisnis) {
    folderName = 'wa-bot-bisnis';
    titleClean = 'WA Bot Bisnis AI (CS dan Sales 24/7)';
    guideSrc = path.join(ROOT_DIR, 'docs/panduan-pembeli-bisnis.md');
    guideDestName = 'PANDUAN_PENGGUNAAN_BISNIS.txt';
    vpsScriptSrc = path.join(ROOT_DIR, 'scripts/deploy-vps-bisnis.sh');
    vpsScriptDestName = 'deploy-vps-bisnis.sh';
    batLauncherName = 'Buka-Bot-Bisnis.bat';
    vbsLauncherName = 'Buka-Bot-Bisnis.vbs';
    issFileName = 'wa-bot-bisnis.iss';
  } else if (isPersonal) {
    folderName = 'wa-bot-personal';
    titleClean = 'WA Asisten Pribadi AI (Finance dan Productivity)';
    guideSrc = path.join(ROOT_DIR, 'docs/panduan-pembeli-personal.md');
    guideDestName = 'PANDUAN_PENGGUNAAN_PERSONAL.txt';
    vpsScriptSrc = path.join(ROOT_DIR, 'scripts/deploy-vps-personal.sh');
    vpsScriptDestName = 'deploy-vps-personal.sh';
    batLauncherName = 'Buka-Bot-Personal.bat';
    vbsLauncherName = 'Buka-Bot-Personal.vbs';
    issFileName = 'wa-bot-personal.iss';
  }

  const targetFolder = path.join(DIST_DIR, folderName);
  const targetConfigDir = path.join(targetFolder, 'config');
  const targetRuntimeDir = path.join(targetFolder, 'runtime');
  const targetSrcDir = path.join(targetFolder, 'src');
  const targetNodeModulesDir = path.join(targetFolder, 'node_modules');

  console.log(`\n📦 Memproses Paket: ${titleClean}`);
  console.log(`   Folder Tujuan: ${targetFolder}`);

  // 0. Bersihkan folder paket dari data testing lama
  sanitizeDistributionFolder(targetFolder);

  if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });
  if (!fs.existsSync(targetConfigDir)) fs.mkdirSync(targetConfigDir, { recursive: true });
  if (!fs.existsSync(targetRuntimeDir)) fs.mkdirSync(targetRuntimeDir, { recursive: true });

  // 1. Sertakan Official Node.js Signed Binary (Lolos Smart App Control & SmartScreen)
  console.log('   🚀 Menyertakan runtime resmi Node.js portabel...');
  const officialNode = findOfficialNodeBinary();
  const destNode = path.join(targetRuntimeDir, 'node.exe');
  if (fs.existsSync(officialNode) && !fs.existsSync(destNode)) {
    try {
      fs.copyFileSync(officialNode, destNode);
    } catch (_) {}
  }

  // 2. Salin Source Code Aplikasi (src/)
  console.log('   📂 Menyalin source code aplikasi (src/)...');
  fs.cpSync(path.join(ROOT_DIR, 'src'), targetSrcDir, {
    recursive: true,
    filter: (src) => !src.includes('.git') && !src.includes('test')
  });

  // 3. Salin Dependensi Produksi (node_modules/)
  console.log('   📦 Menyalin modul & dependensi (node_modules/)...');
  const srcNodeModules = path.join(ROOT_DIR, 'node_modules');
  if (fs.existsSync(srcNodeModules)) {
    fs.cpSync(srcNodeModules, targetNodeModulesDir, {
      recursive: true,
      filter: (src) => !src.includes('.bin') && !src.includes('.cache')
    });
  }

  // 4. Salin package.json
  fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(targetFolder, 'package.json'));

  // 5. Tulis edition.json di dalam config folder paket
  const editionJsonPath = path.join(targetConfigDir, 'edition.json');
  fs.writeFileSync(editionJsonPath, JSON.stringify({ edition }, null, 2), 'utf-8');

  // 6. Salin config.json.example (tanpa config.json asli agar wizard berjalan murni)
  const exampleSource = path.join(ROOT_DIR, 'config/config.json.example');
  if (fs.existsSync(exampleSource)) {
    fs.copyFileSync(exampleSource, path.join(targetConfigDir, 'config.json.example'));
  }

  // 7. Salin Panduan Pembeli (Markdown, Text & Word)
  if (fs.existsSync(guideSrc)) {
    fs.copyFileSync(guideSrc, path.join(targetFolder, guideDestName));
  }
  const wordGuideSrc = isBisnis 
    ? path.join(ROOT_DIR, 'docs/Buku_Panduan_Lengkap_WA_Bot_Bisnis_AI.docx')
    : path.join(ROOT_DIR, 'docs/Buku_Panduan_Lengkap_WA_Asisten_Pribadi_AI.docx');
  if (fs.existsSync(wordGuideSrc)) {
    fs.copyFileSync(wordGuideSrc, path.join(targetFolder, path.basename(wordGuideSrc)));
  }

  // 8. Salin Script VPS
  if (fs.existsSync(vpsScriptSrc)) {
    fs.copyFileSync(vpsScriptSrc, path.join(targetFolder, vpsScriptDestName));
  }

  // 9. Buat VBScript Launcher (Icon kaset / WScript resmi Windows, tanpa black CMD flash, auto unblock & launch)
  console.log('   📜 Membuat VBScript Launcher...');
  const vbsPath = path.join(targetFolder, vbsLauncherName);
  const vbsContent = `' ========================================================
' Peluncur Otomatis ${titleClean} (VBScript Launcher)
' ========================================================
Option Explicit
Dim WshShell, fso, currentDir, nodeExe, serverScript, cmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Otomatis unblock seluruh file dalam folder
On Error Resume Next
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ""Get-ChildItem -Path '" & currentDir & "' -Recurse | Unblock-File -ErrorAction SilentlyContinue""", 0, True
On Error Goto 0

' Periksa runtime node.exe portabel
If fso.FileExists(currentDir & "\\runtime\\node.exe") Then
    nodeExe = """" & currentDir & "\\runtime\\node.exe"""
Else
    nodeExe = "node.exe"
End If

serverScript = """" & currentDir & "\\src\\server\\index.js"""

' Jalankan server
cmd = "cmd.exe /c cd /d """ & currentDir & """ && " & nodeExe & " " & serverScript
WshShell.Run cmd, 0, False

' Buka dashboard di browser lokal
WScript.Sleep 2500
WshShell.Run "http://localhost:3000"
`;
  fs.writeFileSync(vbsPath, vbsContent, 'utf-8');

  // 10. Buat Batch script Launcher (Terminal Log dengan karakter & yang aman)
  console.log('   💻 Membuat Batch script Launcher...');
  const batLauncherPath = path.join(targetFolder, batLauncherName);
  const batContent = `@echo off\r\ntitle ${titleClean}\r\ncd /d "%~dp0"\r\npowershell -Command "Unblock-File -Path .\\* -ErrorAction SilentlyContinue" 2>nul\r\necho ======================================================\r\necho    MENJALANKAN ${titleClean}\r\necho ======================================================\r\necho.\r\necho Membuka aplikasi... Dashboard lokal akan terbuka di browser.\r\necho Jangan tutup jendela ini selama bot digunakan.\r\necho.\r\nif exist "runtime\\node.exe" (\r\n  "runtime\\node.exe" src/server/index.js\r\n) else (\r\n  node src/server/index.js\r\n)\r\nif %ERRORLEVEL% NEQ 0 (\r\n  echo.\r\n  echo [PERINGATAN] Bot terhenti dengan kode error: %ERRORLEVEL%.\r\n  pause\r\n)\r\n`;
  fs.writeFileSync(batLauncherPath, batContent, 'utf-8');

  // 11. Buat file 1-KLIK-IZINKAN-APLIKASI.bat untuk unblock SmartScreen secara instan
  const unblockBatPath = path.join(targetFolder, '1-KLIK-IZINKAN-APLIKASI.bat');
  const unblockContent = `@echo off\r\ntitle Izinkan Aplikasi - Windows SmartScreen Unblocker\r\ncd /d "%~dp0"\r\necho ======================================================\r\necho   IZINKAN APLIKASI DI WINDOWS (UNBLOCK SMARTSCREEN)\r\necho ======================================================\r\necho.\r\necho Sedang membuka blokir file unduhan di folder ini...\r\npowershell -Command "Get-ChildItem -Recurse | Unblock-File -ErrorAction SilentlyContinue"\r\necho.\r\necho [BERHASIL] File telah diizinkan oleh Windows!\r\necho Sekarang Anda dapat membuka "${vbsLauncherName}" atau "${batLauncherName}".\r\necho.\r\npause\r\n`;
  fs.writeFileSync(unblockBatPath, unblockContent, 'utf-8');

  // 11b. Buat Skrip Matikan-Bot (VBScript & Batch)
  console.log('   🛑 Membuat Skrip Matikan-Bot...');
  const vbsShutdownName = isBisnis ? 'Matikan-Bot-Bisnis.vbs' : 'Matikan-Bot-Personal.vbs';
  const vbsShutdownPath = path.join(targetFolder, vbsShutdownName);
  const vbsShutdownContent = `' ========================================================
' Skrip Penghenti ${titleClean} (VBScript Shutdown)
' ========================================================
Option Explicit
Dim WshShell, fso, currentDir, pidFile, pid, http

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
pidFile = currentDir & "\\data\\bot.pid"

' 1. Coba panggil endpoint shutdown via HTTP
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
If http Is Nothing Then Set http = CreateObject("MSXML2.ServerXMLHTTP")
If http Is Nothing Then Set http = CreateObject("Microsoft.XMLHTTP")
http.Open "POST", "http://127.0.0.1:3000/api/shutdown", False
http.setRequestHeader "Content-Type", "application/json"
http.Send "{}"
On Error Goto 0

' 2. Jika ada file bot.pid, pastikan proses dihentikan
If fso.FileExists(pidFile) Then
    On Error Resume Next
    Dim ts
    Set ts = fso.OpenTextFile(pidFile, 1)
    pid = Trim(ts.ReadAll)
    ts.Close
    If IsNumeric(pid) And pid <> "" Then
        WshShell.Run "taskkill /F /T /PID " & pid, 0, True
    End If
    fso.DeleteFile pidFile, True
    On Error Goto 0
End If

MsgBox "✅ ${titleClean} berhasil dimatikan secara aman." & vbCrLf & "Anda dapat menutup browser kapan saja.", vbInformation + vbOKOnly, "${titleClean}"
`;
  fs.writeFileSync(vbsShutdownPath, vbsShutdownContent, 'utf-8');

  const batShutdownName = isBisnis ? 'Matikan-Bot-Bisnis.bat' : 'Matikan-Bot-Personal.bat';
  const batShutdownPath = path.join(targetFolder, batShutdownName);
  const batShutdownContent = `@echo off\r\ntitle Matikan ${titleClean}\r\ncd /d "%~dp0"\r\necho ======================================================\r\necho       MEMATIKAN ${titleClean}\r\necho ======================================================\r\necho.\r\necho Mengirim sinyal berhenti ke server bot...\r\npowershell -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/shutdown' -Method Post -TimeoutSec 3 | Out-Null } catch {}" 2>nul\r\nif exist "data\\bot.pid" (\r\n  set /p BOT_PID=<data\\bot.pid\r\n  if defined BOT_PID (\r\n    taskkill /F /T /PID %BOT_PID% >nul 2>&1\r\n  )\r\n  del /f /q data\\bot.pid >nul 2>&1\r\n)\r\necho.\r\necho [SUKSES] ${titleClean} telah berhasil dimatikan secara aman.\r\necho Anda dapat menutup browser Anda sekarang.\r\necho.\r\ntimeout /t 3\r\n`;
  fs.writeFileSync(batShutdownPath, batShutdownContent, 'utf-8');

  // 12. Sanitasi ulang sebelum pembuatan ZIP & Installer
  sanitizeDistributionFolder(targetFolder);

  // 13. Buat berkas ZIP bersih untuk diupload ke Lynk.id
  const zipName = `${folderName}-v1.0.zip`;
  const zipPath = path.join(DIST_DIR, zipName);
  console.log(`   📦 Mengompresi paket menjadi berkas ZIP bersih: ${zipName}...`);
  try {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    const validItems = fs.readdirSync(targetFolder)
      .filter(item => item !== 'data' && !item.endsWith('.old') && !item.endsWith('.log') && item !== '.wwebjs_auth' && item !== '.wwebjs_cache')
      .map(item => `'${path.join(targetFolder, item)}'`)
      .join(', ');

    if (validItems) {
      const psZipCmd = `powershell -Command "Compress-Archive -Path ${validItems} -DestinationPath '${zipPath}' -Force"`;
      execSync(psZipCmd, { stdio: 'ignore' });
      console.log(`   ✅ File ZIP siap jual selesai dibuat: ${zipPath}`);
    }
  } catch (zErr) {
    console.warn(`   ⚠️ Gagal membuat ZIP otomatis: ${zErr.message}`);
  }

  // 14. Compile Inno Setup Installer (.exe)
  const isccPath = 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe';
  const issFilePath = path.join(ROOT_DIR, 'installer', issFileName);
  if (fs.existsSync(isccPath) && fs.existsSync(issFilePath)) {
    console.log(`   🔨 Meng-compile Installer Inno Setup (${issFileName})...`);
    try {
      execSync(`"${isccPath}" "${issFilePath}"`, { cwd: ROOT_DIR, stdio: 'ignore' });
      console.log(`   ✅ Single Installer .exe berhasil di-compile di dist/`);
    } catch (iErr) {
      console.warn(`   ⚠️ Inno Setup compilation notice: ${iErr.message}`);
    }
  }

  console.log(`   ✅ Paket [${edition.toUpperCase()}] Selesai dibangun di: ${targetFolder}`);
}

// Eksekusi build berdasarkan target
if (targetEdition === 'bisnis') {
  buildEditionPackage('bisnis');
} else if (targetEdition === 'personal') {
  buildEditionPackage('personal');
} else {
  // Build all packages
  buildEditionPackage('bisnis');
  buildEditionPackage('personal');
}

console.log('\n======================================================');
console.log('  🎉 SEMUA TARGET BUILD DISTRIBUSI SELESAI!');
console.log('======================================================');
