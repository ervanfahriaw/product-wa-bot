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
console.log(`       BUILD MULTI-TARGET EXECUTABLE DISTRIBUTION      `);
console.log(`       Target Edition: ${targetEdition.toUpperCase()}  `);
console.log('======================================================\n');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
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
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch (_) {}
  }

  // 2. Hapus folder cache session wwebjs jika ada
  const cacheDir = path.join(targetFolder, '.wwebjs_cache');
  if (fs.existsSync(cacheDir)) {
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    } catch (_) {}
  }
  const authDir = path.join(targetFolder, '.wwebjs_auth');
  if (fs.existsSync(authDir)) {
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
    } catch (_) {}
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

  // 4. Hapus file log
  try {
    const files = fs.readdirSync(targetFolder);
    for (const f of files) {
      if (f.endsWith('.log')) {
        fs.unlinkSync(path.join(targetFolder, f));
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
  let exeName = 'wa-bot-assistant.exe';
  let title = 'WA Bot Assistant (Dual Edition)';
  let guideSrc = path.join(ROOT_DIR, 'docs/packaging-deployment.md');
  let guideDestName = 'PANDUAN_PENGGUNAAN.txt';
  let vpsScriptSrc = path.join(ROOT_DIR, 'scripts/deploy-vps.sh');
  let vpsScriptDestName = 'deploy-vps.sh';
  let launcherName = 'Buka-Bot-Assistant.bat';

  if (isBisnis) {
    folderName = 'wa-bot-bisnis';
    exeName = 'wa-bot-bisnis.exe';
    title = 'WA Bot Bisnis AI (CS & Sales 24/7)';
    guideSrc = path.join(ROOT_DIR, 'docs/panduan-pembeli-bisnis.md');
    guideDestName = 'PANDUAN_PENGGUNAAN_BISNIS.txt';
    vpsScriptSrc = path.join(ROOT_DIR, 'scripts/deploy-vps-bisnis.sh');
    vpsScriptDestName = 'deploy-vps-bisnis.sh';
    launcherName = 'Buka-Bot-Bisnis.bat';
  } else if (isPersonal) {
    folderName = 'wa-bot-personal';
    exeName = 'wa-bot-personal.exe';
    title = 'WA Asisten Pribadi AI (Finance & Productivity)';
    guideSrc = path.join(ROOT_DIR, 'docs/panduan-pembeli-personal.md');
    guideDestName = 'PANDUAN_PENGGUNAAN_PERSONAL.txt';
    vpsScriptSrc = path.join(ROOT_DIR, 'scripts/deploy-vps-personal.sh');
    vpsScriptDestName = 'deploy-vps-personal.sh';
    launcherName = 'Buka-Bot-Personal.bat';
  }

  const targetFolder = path.join(DIST_DIR, folderName);
  const targetConfigDir = path.join(targetFolder, 'config');

  console.log(`\n📦 Memproses Paket: ${title}`);
  console.log(`   Folder Tujuan: ${targetFolder}`);

  // 0. Bersihkan folder paket dari data testing lama
  sanitizeDistributionFolder(targetFolder);

  if (!fs.existsSync(targetConfigDir)) {
    fs.mkdirSync(targetConfigDir, { recursive: true });
  }

  // 1. Tulis edition.json di dalam config folder paket
  const editionJsonPath = path.join(targetConfigDir, 'edition.json');
  fs.writeFileSync(editionJsonPath, JSON.stringify({ edition }, null, 2), 'utf-8');

  // 2. Salin config.json.example (tanpa config.json asli agar wizard berjalan murni)
  const exampleSource = path.join(ROOT_DIR, 'config/config.json.example');
  if (fs.existsSync(exampleSource)) {
    fs.copyFileSync(exampleSource, path.join(targetConfigDir, 'config.json.example'));
  }

  // 3. Salin Panduan Pembeli (Markdown & Word)
  if (fs.existsSync(guideSrc)) {
    fs.copyFileSync(guideSrc, path.join(targetFolder, guideDestName));
  }
  const wordGuideSrc = isBisnis 
    ? path.join(ROOT_DIR, 'docs/Buku_Panduan_Lengkap_WA_Bot_Bisnis_AI.docx')
    : path.join(ROOT_DIR, 'docs/Buku_Panduan_Lengkap_WA_Asisten_Pribadi_AI.docx');
  if (fs.existsSync(wordGuideSrc)) {
    fs.copyFileSync(wordGuideSrc, path.join(targetFolder, path.basename(wordGuideSrc)));
  }

  // 4. Salin Script VPS
  if (fs.existsSync(vpsScriptSrc)) {
    fs.copyFileSync(vpsScriptSrc, path.join(targetFolder, vpsScriptDestName));
  }

  // 5. Buat batch script Launcher & Unblocker SmartScreen
  const launcherPath = path.join(targetFolder, launcherName);
  const launcherContent = `@echo off\r\ntitle ${title}\r\ncd /d "%~dp0"\r\npowershell -Command "Unblock-File -Path .\\* -ErrorAction SilentlyContinue" 2>nul\r\necho ======================================================\r\necho    MENJALANKAN ${title}\r\necho ======================================================\r\necho.\r\necho Membuka aplikasi... Dashboard lokal akan terbuka di browser.\r\necho Jangan tutup jendela ini selama bot digunakan.\r\necho.\r\nif exist "${exeName}" (\r\n  start "" "${exeName}"\r\n) else (\r\n  node src/server/index.js\r\n)\r\n`;
  fs.writeFileSync(launcherPath, launcherContent, 'utf-8');

  // 5b. Buat file 1-KLIK-IZINKAN-APLIKASI.bat untuk unblock SmartScreen secara instan
  const unblockBatPath = path.join(targetFolder, '1-KLIK-IZINKAN-APLIKASI.bat');
  const unblockContent = `@echo off\r\ntitle Izinkan Aplikasi - Windows SmartScreen Unblocker\r\ncd /d "%~dp0"\r\necho ======================================================\r\necho   IZINKAN APLIKASI DI WINDOWS (UNBLOCK SMARTSCREEN)\r\necho ======================================================\r\necho.\r\necho Sedang membuka blokir file unduhan di folder ini...\r\npowershell -Command "Get-ChildItem -Recurse | Unblock-File -ErrorAction SilentlyContinue"\r\necho.\r\necho [BERHASIL] File telah diizinkan oleh Windows!\r\necho Sekarang Anda dapat membuka "${launcherName}" atau "${exeName}" tanpa peringatan SmartScreen.\r\necho.\r\npause\r\n`;
  fs.writeFileSync(unblockBatPath, unblockContent, 'utf-8');

  // 6. Jalankan pkg builder
  console.log(`   Menjalankan packaging binary .exe (${exeName})...`);
  const outExePath = path.join(targetFolder, exeName);
  try {
    const pkgCommand = `npx pkg . --targets node18-win-x64 --output "${outExePath}"`;
    execSync(pkgCommand, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env, EDITION: edition }
    });
  } catch (err) {
    console.warn(`   ⚠️ Pkg compilation note: ${err.message}`);
  }

  // 7. Salin native addon better-sqlite3 jika tersedia
  try {
    const candidates = [
      path.join(ROOT_DIR, 'bin/better_sqlite3_node18.node'),
      path.join(ROOT_DIR, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node')
    ];
    for (const src of candidates) {
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(targetFolder, 'better_sqlite3.node'));
        break;
      }
    }
  } catch (_) {}

  // 8. Sanitasi ulang sebelum pembuatan ZIP
  sanitizeDistributionFolder(targetFolder);

  // 9. Buat berkas ZIP bersih untuk diupload ke Lynk.id
  const zipName = `${folderName}-v1.0.zip`;
  const zipPath = path.join(DIST_DIR, zipName);
  console.log(`   📦 Mengompresi paket menjadi berkas ZIP bersih: ${zipName}...`);
  try {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    const psZipCmd = `powershell -Command "Compress-Archive -Path '${targetFolder}\\*' -DestinationPath '${zipPath}' -Force"`;
    execSync(psZipCmd, { stdio: 'ignore' });
    console.log(`   ✅ File ZIP siap jual selesai dibuat: ${zipPath}`);
  } catch (zErr) {
    console.warn(`   ⚠️ Gagal membuat ZIP otomatis: ${zErr.message}`);
  }

  console.log(`   ✅ Paket [${edition.toUpperCase()}] Selesai dibuat di: ${targetFolder}`);
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

