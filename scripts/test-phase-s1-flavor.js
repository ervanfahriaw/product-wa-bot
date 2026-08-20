/**
 * Test Suite: Fase S1 - Edition Flavor & Config Layer
 * Memvalidasi sistem edisi produk (Bisnis vs Personal vs Dual)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== MEMULAI TEST FASE S1: EDITION FLAVOR & CONFIG LAYER ===\n');

const {
  getEdition,
  getEditionInfo,
  isBusinessEdition,
  isPersonalEdition,
  isDualEdition,
  isFeatureAvailable,
  getConfig,
  saveConfig,
  EDITIONS,
  EDITION_FILE_PATH
} = require('../src/config');

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

// 1. Test Metadata Edisi
test('Definisi edisi lengkap (bisnis, personal, all)', () => {
  assert(EDITIONS.bisnis, 'Edisi bisnis harus ada');
  assert(EDITIONS.personal, 'Edisi personal harus ada');
  assert(EDITIONS.all, 'Edisi all/dual harus ada');
  assert.strictEqual(EDITIONS.bisnis.defaultMode, 'bisnis');
  assert.strictEqual(EDITIONS.personal.defaultMode, 'personal');
  assert.strictEqual(EDITIONS.bisnis.isModeLocked, true);
  assert.strictEqual(EDITIONS.personal.isModeLocked, true);
  assert.strictEqual(EDITIONS.all.isModeLocked, false);
});

// 2. Test Environment Variable Switch: BISNIS
test('Deteksi Edisi BISNIS via process.env.EDITION', () => {
  process.env.EDITION = 'bisnis';
  assert.strictEqual(getEdition(), 'bisnis');
  assert.strictEqual(isBusinessEdition(), true);
  assert.strictEqual(isPersonalEdition(), false);
  assert.strictEqual(isDualEdition(), false);
  
  const info = getEditionInfo();
  assert.strictEqual(info.name, 'WA Bot Bisnis AI');
  assert.strictEqual(info.defaultMode, 'bisnis');
  assert.strictEqual(isFeatureAvailable('products'), true);
  assert.strictEqual(isFeatureAvailable('customers'), true);
  assert.strictEqual(isFeatureAvailable('orders'), true);
  assert.strictEqual(isFeatureAvailable('expenses'), false);
  assert.strictEqual(isFeatureAvailable('habits'), false);

  const config = getConfig();
  assert.strictEqual(config.mode, 'bisnis', 'Config mode harus terkunci ke bisnis');
});

// 3. Test Environment Variable Switch: PERSONAL
test('Deteksi Edisi PERSONAL via process.env.EDITION', () => {
  process.env.EDITION = 'personal';
  assert.strictEqual(getEdition(), 'personal');
  assert.strictEqual(isPersonalEdition(), true);
  assert.strictEqual(isBusinessEdition(), false);
  assert.strictEqual(isDualEdition(), false);

  const info = getEditionInfo();
  assert.strictEqual(info.name, 'WA Asisten Pribadi AI');
  assert.strictEqual(info.defaultMode, 'personal');
  assert.strictEqual(isFeatureAvailable('expenses'), true);
  assert.strictEqual(isFeatureAvailable('reminders'), true);
  assert.strictEqual(isFeatureAvailable('habits'), true);
  assert.strictEqual(isFeatureAvailable('products'), false);
  assert.strictEqual(isFeatureAvailable('orders'), false);

  const config = getConfig();
  assert.strictEqual(config.mode, 'personal', 'Config mode harus terkunci ke personal');
});

// 4. Test Mode Lock pada saveConfig
test('Mode terkunci saat saveConfig dipanggil pada edisi spesifik', () => {
  process.env.EDITION = 'bisnis';
  saveConfig({ mode: 'personal' }); // Percobaan mengubah mode di edisi bisnis
  const confBisnis = getConfig();
  assert.strictEqual(confBisnis.mode, 'bisnis', 'Mode tidak boleh berubah menjadi personal pada edisi bisnis');

  process.env.EDITION = 'personal';
  saveConfig({ mode: 'bisnis' }); // Percobaan mengubah mode di edisi personal
  const confPersonal = getConfig();
  assert.strictEqual(confPersonal.mode, 'personal', 'Mode tidak boleh berubah menjadi bisnis pada edisi personal');
});

// 5. Test Fallback / Dual Edition (ALL)
test('Deteksi DUAL / ALL Edition saat tidak diset', () => {
  delete process.env.EDITION;
  // Pastikan tidak ada file edition.json sementara
  const hadEditionFile = fs.existsSync(EDITION_FILE_PATH);
  let backupContent = null;
  if (hadEditionFile) {
    backupContent = fs.readFileSync(EDITION_FILE_PATH, 'utf-8');
    fs.unlinkSync(EDITION_FILE_PATH);
  }

  assert.strictEqual(getEdition(), 'all');
  assert.strictEqual(isDualEdition(), true);
  assert.strictEqual(isBusinessEdition(), false);
  assert.strictEqual(isPersonalEdition(), false);
  assert.strictEqual(isFeatureAvailable('products'), true);
  assert.strictEqual(isFeatureAvailable('expenses'), true);

  if (hadEditionFile && backupContent) {
    fs.writeFileSync(EDITION_FILE_PATH, backupContent, 'utf-8');
  }
});

// 6. Test File config/edition.json Support
test('Deteksi Edisi via file config/edition.json', () => {
  delete process.env.EDITION;
  const configDir = path.dirname(EDITION_FILE_PATH);
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

  fs.writeFileSync(EDITION_FILE_PATH, JSON.stringify({ edition: 'personal' }), 'utf-8');
  assert.strictEqual(getEdition(), 'personal');
  assert.strictEqual(isPersonalEdition(), true);

  fs.writeFileSync(EDITION_FILE_PATH, JSON.stringify({ edition: 'bisnis' }), 'utf-8');
  assert.strictEqual(getEdition(), 'bisnis');
  assert.strictEqual(isBusinessEdition(), true);

  // Bersihkan file test
  fs.unlinkSync(EDITION_FILE_PATH);
  assert.strictEqual(getEdition(), 'all');
});

console.log(`\n======================================================`);
console.log(`Hasil Test: ${passedTests}/${totalTests} Pengujian Berhasil`);
console.log(`======================================================\n`);

if (passedTests === totalTests) {
  console.log('🎉 FASE S1 SELESAI DENGAN SEMPURNA (100% PASS)!');
  process.exit(0);
} else {
  console.error('❌ Ada test yang gagal di Fase S1!');
  process.exit(1);
}
