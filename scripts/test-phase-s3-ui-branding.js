/**
 * Test Suite: Fase S3 - UI Branding, Sidebar & Dashboard Customization
 * Memvalidasi isolasi tampilan visual (Sidebar, Settings, Badge) per edisi
 */

const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

console.log('=== MEMULAI TEST FASE S3: UI BRANDING & SIDEBAR CUSTOMIZATION ===\n');

const {
  getEdition,
  getEditionInfo,
  isBusinessEdition,
  isPersonalEdition,
  isDualEdition,
  getConfig
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

// 1. Test Sidebar Edisi Bisnis
test('Render Sidebar: Edisi Bisnis (Fitur Bisnis muncul, Fitur Personal disembunyikan)', () => {
  process.env.EDITION = 'bisnis';
  const html = renderView('partials/sidebar', {
    config: { ...getConfig(), business_name: 'Toko Sukses', mode: 'bisnis' },
    editionInfo: getEditionInfo(),
    isBusiness: true,
    isPersonal: false,
    isDual: false,
    activeMenu: 'dashboard',
    pendingHandoverCount: 0,
    todayAiCount: 15
  });

  // Wajib ada
  assert(html.includes('Bisnis Edition'), 'Badge Bisnis Edition harus tampil');
  assert(html.includes('Katalog Produk'), 'Menu Katalog Produk harus tampil');
  assert(html.includes('Analisis Bisnis'), 'Menu Analisis Bisnis harus tampil');
  assert(html.includes('Pelanggan'), 'Menu Pelanggan harus tampil');
  assert(html.includes('FAQ Otomatis'), 'Menu FAQ Otomatis harus tampil');

  // Wajib tidak ada
  assert(!html.includes('Catatan Keuangan'), 'Menu Catatan Keuangan TIDAK BOLEH tampil di edisi bisnis');
  assert(!html.includes('Pengingat'), 'Menu Pengingat TIDAK BOLEH tampil di edisi bisnis');
  assert(!html.includes('Daftar Tugas'), 'Menu Daftar Tugas TIDAK BOLEH tampil di edisi bisnis');
  assert(!html.includes('Budget Planner'), 'Menu Budget Planner TIDAK BOLEH tampil di edisi bisnis');
});

// 2. Test Sidebar Edisi Personal
test('Render Sidebar: Edisi Personal (Fitur Personal muncul, Fitur Bisnis disembunyikan)', () => {
  process.env.EDITION = 'personal';
  const html = renderView('partials/sidebar', {
    config: { ...getConfig(), business_name: 'Budi Santoso', mode: 'personal' },
    editionInfo: getEditionInfo(),
    isBusiness: false,
    isPersonal: true,
    isDual: false,
    activeMenu: 'dashboard',
    pendingHandoverCount: 0,
    todayAiCount: 5
  });

  // Wajib ada
  assert(html.includes('Personal Edition'), 'Badge Personal Edition harus tampil');
  assert(html.includes('Catatan Keuangan'), 'Menu Catatan Keuangan harus tampil');
  assert(html.includes('Pengingat'), 'Menu Pengingat harus tampil');
  assert(html.includes('Catatan'), 'Menu Catatan harus tampil');
  assert(html.includes('Daftar Tugas'), 'Menu Daftar Tugas harus tampil');

  // Wajib tidak ada
  assert(!html.includes('Katalog Produk'), 'Menu Katalog Produk TIDAK BOLEH tampil di edisi personal');
  assert(!html.includes('Analisis Bisnis'), 'Menu Analisis Bisnis TIDAK BOLEH tampil di edisi personal');
  assert(!html.includes('Pelanggan'), 'Menu Pelanggan TIDAK BOLEH tampil di edisi personal');
  assert(!html.includes('FAQ Otomatis'), 'Menu FAQ Otomatis TIDAK BOLEH tampil di edisi personal');
});

// 3. Test Settings Page: Mode Locked di Edisi Bisnis
test('Render Settings: Mode terkunci di Edisi Bisnis', () => {
  process.env.EDITION = 'bisnis';
  const html = renderView('dashboard/settings', {
    config: { ...getConfig(), mode: 'bisnis' },
    editionInfo: getEditionInfo(),
    isBusiness: true,
    isPersonal: false,
    isDual: false,
    activeMenu: 'settings',
    pendingHandoverCount: 0,
    todayAiCount: 0,
    status: { state: 'READY', info: { pushname: 'Bot Bisnis', phone: '628123' }, qrCodeDataUrl: '' },
    success: null
  });

  assert(html.includes('WA Bot Bisnis AI'), 'Badge edisi WA Bot Bisnis AI harus tampil');
  assert(!html.includes('@click="mode = \'personal\'"'), 'Tombol switch ke personal tidak boleh ada');
});

// 4. Test Settings Page: Mode Locked di Edisi Personal
test('Render Settings: Mode terkunci di Edisi Personal', () => {
  process.env.EDITION = 'personal';
  const html = renderView('dashboard/settings', {
    config: { ...getConfig(), mode: 'personal' },
    editionInfo: getEditionInfo(),
    isBusiness: false,
    isPersonal: true,
    isDual: false,
    activeMenu: 'settings',
    pendingHandoverCount: 0,
    todayAiCount: 0,
    status: { state: 'READY', info: { pushname: 'Bot Personal', phone: '628123' }, qrCodeDataUrl: '' },
    success: null
  });

  assert(html.includes('WA Asisten Pribadi AI'), 'Badge edisi WA Asisten Pribadi AI harus tampil');
  assert(!html.includes('@click="mode = \'bisnis\'"'), 'Tombol switch ke bisnis tidak boleh ada');
});

// 5. Test Settings Page: Switcher Aktif di Dual Edition
test('Render Settings: Mode switcher aktif di Dual Edition', () => {
  delete process.env.EDITION;
  const html = renderView('dashboard/settings', {
    config: { ...getConfig(), mode: 'bisnis' },
    editionInfo: getEditionInfo(),
    isBusiness: true,
    isPersonal: false,
    isDual: true,
    activeMenu: 'settings',
    pendingHandoverCount: 0,
    todayAiCount: 0,
    status: { state: 'READY', info: { pushname: 'Bot Dual', phone: '628123' }, qrCodeDataUrl: '' },
    success: null
  });

  assert(html.includes('@click="mode = \'bisnis\'"'), 'Tombol Mode Bisnis harus ada di Dual Edition');
  assert(html.includes('@click="mode = \'personal\'"'), 'Tombol Mode Personal harus ada di Dual Edition');
});

console.log(`\n======================================================`);
console.log(`Hasil Test: ${passedTests}/${totalTests} Pengujian Berhasil`);
console.log(`======================================================\n`);

if (passedTests === totalTests) {
  console.log('🎉 FASE S3 SELESAI DENGAN SEMPURNA (100% PASS)!');
  process.exit(0);
} else {
  console.error('❌ Ada test yang gagal di Fase S3!');
  process.exit(1);
}
