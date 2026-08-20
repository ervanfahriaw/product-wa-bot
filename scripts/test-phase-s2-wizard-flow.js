/**
 * Test Suite: Fase S2 - Setup Wizard & Routing Isolation
 * Memvalidasi adaptasi Setup Wizard untuk Bisnis, Personal, dan Dual Edition
 */

const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

console.log('=== MEMULAI TEST FASE S2: SETUP WIZARD & ROUTING ISOLATION ===\n');

const {
  getEdition,
  getEditionInfo,
  isBusinessEdition,
  isPersonalEdition,
  isDualEdition,
  getConfig,
  saveConfig,
  CONFIG_PATH
} = require('../src/config');

const VIEWS_DIR = path.resolve(__dirname, '../src/server/views');

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

// Helper render EJS
function renderView(templateRelPath, data) {
  const filePath = path.join(VIEWS_DIR, templateRelPath + '.ejs');
  const content = fs.readFileSync(filePath, 'utf-8');
  return ejs.render(content, data, { filename: filePath });
}

// 1. Test Rendering Step 1 Edisi Bisnis
test('Render Wizard Step 1: Edisi Bisnis', () => {
  process.env.EDITION = 'bisnis';
  const html = renderView('setup/step-1-mode', {
    title: 'Langkah 1: Profil Bisnis & CS',
    currentStep: 1,
    config: getConfig(),
    editionInfo: getEditionInfo(),
    isBusiness: isBusinessEdition(),
    isPersonal: isPersonalEdition(),
    isDual: isDualEdition(),
    error: null
  });

  assert(html.includes('WA Bot Bisnis AI'), 'Harus memuat judul WA Bot Bisnis AI');
  assert(html.includes('Nama Brand / Toko'), 'Harus menampilkan input nama brand');
  assert(html.includes('Nomor WhatsApp Pemilik'), 'Harus menampilkan input nomor owner');
  assert(!html.includes('Mode Personal'), 'Tidak boleh ada opsi Mode Personal di edisi bisnis');
});

// 2. Test Rendering Step 1 Edisi Personal
test('Render Wizard Step 1: Edisi Personal', () => {
  process.env.EDITION = 'personal';
  const html = renderView('setup/step-1-mode', {
    title: 'Langkah 1: Profil Asisten Pribadi',
    currentStep: 1,
    config: getConfig(),
    editionInfo: getEditionInfo(),
    isBusiness: isBusinessEdition(),
    isPersonal: isPersonalEdition(),
    isDual: isDualEdition(),
    error: null
  });

  assert(html.includes('WA Asisten Pribadi AI'), 'Harus memuat judul WA Asisten Pribadi AI');
  assert(html.includes('Nama Panggilan Anda'), 'Harus menampilkan input nama panggilan');
  assert(html.includes('Nomor WhatsApp Utama Anda'), 'Harus menampilkan input nomor WA utama');
  assert(!html.includes('Mode Bisnis'), 'Tidak boleh ada opsi Mode Bisnis di edisi personal');
});

// 3. Test Rendering Step 1 Dual Edition
test('Render Wizard Step 1: Dual / All Edition', () => {
  delete process.env.EDITION;
  const html = renderView('setup/step-1-mode', {
    title: 'Langkah 1: Pilih Mode Bot',
    currentStep: 1,
    config: getConfig(),
    editionInfo: getEditionInfo(),
    isBusiness: isBusinessEdition(),
    isPersonal: isPersonalEdition(),
    isDual: isDualEdition(),
    error: null
  });

  assert(html.includes('Pilih Mode Bot'), 'Harus memuat judul Pilih Mode Bot');
  assert(html.includes('Mode Bisnis'), 'Harus menampilkan pilihan Mode Bisnis');
  assert(html.includes('Mode Personal'), 'Harus menampilkan pilihan Mode Personal');
});

// 4. Test Rendering Step 4: Adaptasi Data Awal
test('Render Wizard Step 4: Adaptasi Bisnis vs Personal', () => {
  // Bisnis
  process.env.EDITION = 'bisnis';
  const htmlBisnis = renderView('setup/step-4-initial-data', {
    title: 'Langkah 4: Contoh Produk Katalog',
    currentStep: 4,
    config: { ...getConfig(), mode: 'bisnis' },
    editionInfo: getEditionInfo(),
    isBusiness: true,
    isPersonal: false,
    isDual: false,
    error: null
  });
  assert(htmlBisnis.includes('Nama Produk'), 'Step 4 Bisnis harus ada Nama Produk');
  assert(htmlBisnis.includes('Jumlah Stok'), 'Step 4 Bisnis harus ada Jumlah Stok');

  // Personal
  process.env.EDITION = 'personal';
  const htmlPersonal = renderView('setup/step-4-initial-data', {
    title: 'Langkah 4: Contoh Pengeluaran Awal',
    currentStep: 4,
    config: { ...getConfig(), mode: 'personal' },
    editionInfo: getEditionInfo(),
    isBusiness: false,
    isPersonal: true,
    isDual: false,
    error: null
  });
  assert(htmlPersonal.includes('Kategori Pengeluaran'), 'Step 4 Personal harus ada Kategori Pengeluaran');
  assert(htmlPersonal.includes('Nominal (Rp)'), 'Step 4 Personal harus ada Nominal');
});

// 5. Test Stepper Partial
test('Render Wizard Stepper: Label dinamis sesuai edisi', () => {
  process.env.EDITION = 'bisnis';
  const htmlBisnis = renderView('partials/wizard-stepper', {
    currentStep: 1,
    isBusiness: true,
    isPersonal: false,
    config: { mode: 'bisnis' }
  });
  assert(htmlBisnis.includes('Profil'), 'Label step 1 bisnis harus Profil');
  assert(htmlBisnis.includes('Katalog'), 'Label step 4 bisnis harus Katalog');

  process.env.EDITION = 'personal';
  const htmlPersonal = renderView('partials/wizard-stepper', {
    currentStep: 1,
    isBusiness: false,
    isPersonal: true,
    config: { mode: 'personal' }
  });
  assert(htmlPersonal.includes('Profil'), 'Label step 1 personal harus Profil');
  assert(htmlPersonal.includes('Anggaran'), 'Label step 4 personal harus Anggaran');
});

console.log(`\n======================================================`);
console.log(`Hasil Test: ${passedTests}/${totalTests} Pengujian Berhasil`);
console.log(`======================================================\n`);

if (passedTests === totalTests) {
  console.log('🎉 FASE S2 SELESAI DENGAN SEMPURNA (100% PASS)!');
  process.exit(0);
} else {
  console.error('❌ Ada test yang gagal di Fase S2!');
  process.exit(1);
}
