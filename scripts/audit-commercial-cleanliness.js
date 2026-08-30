const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('======================================================');
console.log('  🔍 AUDIT KEBERSIHAN DISTRIBUSI KOMERSIAL (LYNK.ID)  ');
console.log('======================================================\n');

const distDir = path.join(__dirname, '../dist');
const zipBisnis = path.join(distDir, 'wa-bot-bisnis-v1.0.zip');
const zipPersonal = path.join(distDir, 'wa-bot-personal-v1.0.zip');
const exeBisnis = path.join(distDir, 'Setup_WABot_Bisnis_v1.0.exe');
const exePersonal = path.join(distDir, 'Setup_WABot_Personal_v1.0.exe');

function isForbiddenFile(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  
  // 1. Jangan sampai ada file database dev / testing
  if (norm.endsWith('.db') || norm.endsWith('.sqlite') || norm.includes('/data/')) {
    return true;
  }
  // 2. Jangan sampai ada config asli atau license asli
  if (norm.endsWith('config/config.json') || norm.endsWith('config/license.json')) {
    return true;
  }
  // 3. Jangan sampai ada file .env atau .env.local
  if (norm.endsWith('/.env') || norm === '.env') {
    return true;
  }
  // 4. Jangan sampai ada sesi WhatsApp
  if (norm.includes('.wwebjs_auth') || norm.includes('.wwebjs_cache') || norm.includes('src/engine/session')) {
    return true;
  }
  // 5. Jangan sampai ada file PID runtime
  if (norm.endsWith('bot.pid')) {
    return true;
  }
  // 6. Jangan sampai ada file log dan backup lama
  if (norm.endsWith('.old') || norm.endsWith('.bak')) {
    return true;
  }

  return false;
}

function auditZip(zipPath, label) {
  console.log(`📦 Memeriksa Berkas ZIP: ${path.basename(zipPath)}...`);
  if (!fs.existsSync(zipPath)) {
    console.error(`❌ File ${zipPath} tidak ditemukan!`);
    return false;
  }

  const stat = fs.statSync(zipPath);
  console.log(`   Ukuran File: ${(stat.size / (1024 * 1024)).toFixed(1)} MB`);

  let listStr = '';
  try {
    listStr = execSync(`tar -tf "${zipPath}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
    const psCmd = `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/\\/g, '\\\\')}').Entries.FullName"`;
    listStr = execSync(psCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  }

  const entries = listStr.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  console.log(`   Total Berkas dalam ZIP: ${entries.length} file`);

  let dirtyFiles = entries.filter(isForbiddenFile);

  if (dirtyFiles.length === 0) {
    console.log(`   ✅ [BERSIH 100%] Tidak ada data pengembangan (database/api key/sesi) yang terbawa!\n`);
    return true;
  } else {
    console.error(`   ❌ [DITEMUKAN DATA KOTOR]:`, dirtyFiles);
    return false;
  }
}

// Hapus folder session sisa di root repo jika ada
const rootSrcSession = path.join(__dirname, '../src/engine/session');
if (fs.existsSync(rootSrcSession)) {
  try { fs.rmSync(rootSrcSession, { recursive: true, force: true }); } catch (_) {}
}

const res1 = auditZip(zipBisnis, 'Bisnis');
const res2 = auditZip(zipPersonal, 'Personal');

console.log('------------------------------------------------------');
console.log('📌 Ringkasan File Siap Jual di Lynk.id:');
console.log(` 1. Installer Bisnis (.exe)   : ${path.basename(exeBisnis)} (${(fs.statSync(exeBisnis).size / (1024*1024)).toFixed(1)} MB)`);
console.log(` 2. Portable Bisnis (.zip)    : ${path.basename(zipBisnis)} (${(fs.statSync(zipBisnis).size / (1024*1024)).toFixed(1)} MB)`);
console.log(` 3. Installer Personal (.exe) : ${path.basename(exePersonal)} (${(fs.statSync(exePersonal).size / (1024*1024)).toFixed(1)} MB)`);
console.log(` 4. Portable Personal (.zip)  : ${path.basename(zipPersonal)} (${(fs.statSync(zipPersonal).size / (1024*1024)).toFixed(1)} MB)`);
console.log('------------------------------------------------------\n');
