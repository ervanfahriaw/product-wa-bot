const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('======================================================');
console.log('       BUILD STANDALONE EXECUTABLE (.EXE)             ');
console.log('======================================================\n');

// 1. Pastikan folder dist/ bersih dan siap
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

console.log('[1/4] Mempersiapkan aset dan dependensi...');

// Copy config.json.example ke dist/
const exampleSource = path.join(ROOT_DIR, 'config/config.json.example');
const exampleDest = path.join(DIST_DIR, 'config.json.example');
if (fs.existsSync(exampleSource)) {
  fs.copyFileSync(exampleSource, exampleDest);
}

// 2. Jalankan packaging menggunakan pkg
console.log('[2/4] Menjalankan pkg untuk membungkus kode JavaScript ke .exe...');
try {
  const pkgCommand = 'npx pkg . --targets node20-win-x64 --output dist/wa-bot-assistant.exe';
  console.log(`> ${pkgCommand}`);
  execSync(pkgCommand, { cwd: ROOT_DIR, stdio: 'inherit' });
} catch (err) {
  console.error('\n⚠️ Peringatan saat menjalankan pkg:', err.message);
  console.log('Jika pkg belum terinstal global, pastikan koneksi internet aktif agar npx dapat mengunduh runtime binary.');
}

// 3. Salin native addon better-sqlite3 jika diperlukan
console.log('[3/4] Memeriksa native binary better-sqlite3...');
try {
  const nativeAddonSource = path.join(ROOT_DIR, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node');
  const nativeAddonDest = path.join(DIST_DIR, 'better_sqlite3.node');
  if (fs.existsSync(nativeAddonSource)) {
    fs.copyFileSync(nativeAddonSource, nativeAddonDest);
    console.log('  -> better_sqlite3.node berhasil disalin ke dist/');
  }
} catch (_) {}

// 4. Selesai
console.log('\n[4/4] ✅ BUILD SELESAI!');
console.log('------------------------------------------------------');
console.log(`File installer executable tersimpan di:`);
console.log(`  ${path.join(DIST_DIR, 'wa-bot-assistant.exe')}`);
console.log('------------------------------------------------------');
console.log('Petunjuk untuk Pembeli PC/Laptop:');
console.log('1. Cukup double-click "wa-bot-assistant.exe".');
console.log('2. Browser akan otomatis terbuka ke http://localhost:3000 untuk menyelesaikan Setup Wizard.');
console.log('3. Tidak perlu menginstal Node.js secara manual di PC target.');
