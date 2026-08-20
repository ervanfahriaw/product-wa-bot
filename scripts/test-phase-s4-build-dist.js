/**
 * Test Suite: Fase S4 - Multi-Target Build Scripts & Paket Distribusi Lynk.id
 * Memvalidasi pembentukan struktur folder distribusi untuk kedua produk komersial
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const assert = require('assert');

console.log('=== MEMULAI TEST FASE S4: MULTI-TARGET BUILD & DISTRIBUTION PACKAGING ===\n');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
  }
}

// 1. Test Menjalankan Build Script untuk Edisi Bisnis
test('Jalankan Build Edisi Bisnis (node scripts/build-exe.js --edition=bisnis)', () => {
  execSync('node scripts/build-exe.js --edition=bisnis', { cwd: ROOT_DIR, stdio: 'pipe' });
  const bisnisFolder = path.join(DIST_DIR, 'wa-bot-bisnis');
  assert(fs.existsSync(bisnisFolder), 'Folder dist/wa-bot-bisnis harus berhasil dibuat');

  // Cek file config/edition.json
  const editionFile = path.join(bisnisFolder, 'config/edition.json');
  assert(fs.existsSync(editionFile), 'File config/edition.json harus ada');
  const editionData = JSON.parse(fs.readFileSync(editionFile, 'utf-8'));
  assert.strictEqual(editionData.edition, 'bisnis');

  // Cek file panduan pembeli & skrip
  assert(fs.existsSync(path.join(bisnisFolder, 'PANDUAN_PENGGUNAAN_BISNIS.txt')), 'Panduan bisnis harus ada');
  assert(fs.existsSync(path.join(bisnisFolder, 'deploy-vps-bisnis.sh')), 'Script deploy VPS bisnis harus ada');
  assert(fs.existsSync(path.join(bisnisFolder, 'start-bisnis.bat')), 'Start bat bisnis harus ada');
});

// 2. Test Menjalankan Build Script untuk Edisi Personal
test('Jalankan Build Edisi Personal (node scripts/build-exe.js --edition=personal)', () => {
  execSync('node scripts/build-exe.js --edition=personal', { cwd: ROOT_DIR, stdio: 'pipe' });
  const personalFolder = path.join(DIST_DIR, 'wa-bot-personal');
  assert(fs.existsSync(personalFolder), 'Folder dist/wa-bot-personal harus berhasil dibuat');

  // Cek file config/edition.json
  const editionFile = path.join(personalFolder, 'config/edition.json');
  assert(fs.existsSync(editionFile), 'File config/edition.json harus ada');
  const editionData = JSON.parse(fs.readFileSync(editionFile, 'utf-8'));
  assert.strictEqual(editionData.edition, 'personal');

  // Cek file panduan pembeli & skrip
  assert(fs.existsSync(path.join(personalFolder, 'PANDUAN_PENGGUNAAN_PERSONAL.txt')), 'Panduan personal harus ada');
  assert(fs.existsSync(path.join(personalFolder, 'deploy-vps-personal.sh')), 'Script deploy VPS personal harus ada');
  assert(fs.existsSync(path.join(personalFolder, 'start-personal.bat')), 'Start bat personal harus ada');
});

// 3. Validasi Konten Panduan Pembeli Bisnis
test('Validasi isi Panduan Pembeli Bisnis', () => {
  const guideContent = fs.readFileSync(path.join(DIST_DIR, 'wa-bot-bisnis/PANDUAN_PENGGUNAAN_BISNIS.txt'), 'utf-8');
  assert(guideContent.includes('WA BOT BISNIS AI'), 'Panduan harus memuat judul WA Bot Bisnis AI');
  assert(guideContent.includes('Katalog Produk'), 'Panduan harus memuat petunjuk katalog');
  assert(guideContent.includes('deploy-vps-bisnis.sh'), 'Panduan harus memuat referensi skrip VPS bisnis');
});

// 4. Validasi Konten Panduan Pembeli Personal
test('Validasi isi Panduan Pembeli Personal', () => {
  const guideContent = fs.readFileSync(path.join(DIST_DIR, 'wa-bot-personal/PANDUAN_PENGGUNAAN_PERSONAL.txt'), 'utf-8');
  assert(guideContent.includes('WA ASISTEN PRIBADI AI'), 'Panduan harus memuat judul WA Asisten Pribadi AI');
  assert(guideContent.includes('Beli kopi 25rb'), 'Panduan harus memuat contoh perintah keuangan');
  assert(guideContent.includes('deploy-vps-personal.sh'), 'Panduan harus memuat referensi skrip VPS personal');
});

// 5. Validasi Scripts VPS Execution Flag & Format
test('Validasi skrip deploy VPS kedua edisi', () => {
  const vpsBisnis = fs.readFileSync(path.join(DIST_DIR, 'wa-bot-bisnis/deploy-vps-bisnis.sh'), 'utf-8');
  const vpsPersonal = fs.readFileSync(path.join(DIST_DIR, 'wa-bot-personal/deploy-vps-personal.sh'), 'utf-8');

  assert(vpsBisnis.includes('EDITION=bisnis'), 'Skrip VPS bisnis harus meng-inject EDITION=bisnis');
  assert(vpsBisnis.includes('wa-bot-bisnis'), 'Skrip VPS bisnis harus menamai proses wa-bot-bisnis');

  assert(vpsPersonal.includes('EDITION=personal'), 'Skrip VPS personal harus meng-inject EDITION=personal');
  assert(vpsPersonal.includes('wa-bot-personal'), 'Skrip VPS personal harus menamai proses wa-bot-personal');
});

console.log(`\n======================================================`);
console.log(`Hasil Test: ${passedTests}/${totalTests} Pengujian Berhasil`);
console.log(`======================================================\n`);

if (passedTests === totalTests) {
  console.log('🎉 FASE S4 SELESAI DENGAN SEMPURNA (100% PASS)!');
  process.exit(0);
} else {
  console.error('❌ Ada test yang gagal di Fase S4!');
  process.exit(1);
}
