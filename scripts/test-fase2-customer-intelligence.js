/**
 * Test Fase 2 — Customer Intelligence: Memory Pelanggan Lintas Sesi (TDD)
 * 
 * Menguji:
 * 1. CRUD customer_profiles (database layer)
 * 2. Context builder — buildCustomerProfileContext()
 * 3. Auto-extract nama dari tag [CUSTOMER_NAME:xxx]
 * 4. Integrasi buildContext() dengan customer profile
 */

const assert = require('assert');
const db = require('../src/db');

console.log('=== TEST FASE 2 — CUSTOMER INTELLIGENCE (TDD) ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     -> ${err.message}`);
    failed++;
  }
}

// ============================================================
// GRUP 1: Database CRUD — customer_profiles
// ============================================================
console.log('[1/4] Testing database CRUD customer_profiles...');

test('upsertCustomerProfile() — harus bisa membuat profil baru', () => {
  assert.ok(typeof db.upsertCustomerProfile === 'function', 'Fungsi upsertCustomerProfile belum ada di db');
  db.upsertCustomerProfile('6281234567890@c.us', {
    customer_name: 'Kak Rina',
    tags: 'langganan,vip',
    favorite_products: 'Kopi Susu, Matcha Latte',
    notes: 'Alergi kacang, selalu minta oat milk',
    total_orders: 5,
    total_spent: 450000
  });
});

test('getCustomerProfile() — harus mengembalikan profil yang sudah disimpan', () => {
  assert.ok(typeof db.getCustomerProfile === 'function', 'Fungsi getCustomerProfile belum ada di db');
  const profile = db.getCustomerProfile('6281234567890@c.us');
  assert.ok(profile, 'Profil tidak ditemukan setelah upsert');
  assert.strictEqual(profile.customer_name, 'Kak Rina');
  assert.strictEqual(profile.tags, 'langganan,vip');
  assert.strictEqual(profile.favorite_products, 'Kopi Susu, Matcha Latte');
  assert.strictEqual(profile.notes, 'Alergi kacang, selalu minta oat milk');
  assert.strictEqual(profile.total_orders, 5);
  assert.strictEqual(profile.total_spent, 450000);
});

test('upsertCustomerProfile() — harus bisa update profil yang sudah ada (UPSERT)', () => {
  db.upsertCustomerProfile('6281234567890@c.us', {
    customer_name: 'Kak Rina Putri',
    total_orders: 8,
    total_spent: 720000
  });
  const updated = db.getCustomerProfile('6281234567890@c.us');
  assert.strictEqual(updated.customer_name, 'Kak Rina Putri', 'Nama tidak terupdate');
  assert.strictEqual(updated.total_orders, 8, 'Total orders tidak terupdate');
  // tags harus tetap tidak berubah karena tidak di-update
  assert.strictEqual(updated.tags, 'langganan,vip', 'Tags seharusnya tidak berubah');
});

test('updateLastContact() — harus update timestamp terakhir chat', () => {
  assert.ok(typeof db.updateLastContact === 'function', 'Fungsi updateLastContact belum ada di db');
  db.updateLastContact('6281234567890@c.us');
  const profile = db.getCustomerProfile('6281234567890@c.us');
  assert.ok(profile.last_contact_at, 'last_contact_at tidak terupdate');
});

test('getCustomerProfile() — harus return null jika kontak tidak ada', () => {
  const none = db.getCustomerProfile('000000000@c.us');
  assert.strictEqual(none, undefined, 'Harus undefined untuk kontak yang tidak ada');
});

test('getAllCustomerProfiles() — harus mengembalikan daftar semua pelanggan', () => {
  assert.ok(typeof db.getAllCustomerProfiles === 'function', 'Fungsi getAllCustomerProfiles belum ada di db');
  // Tambah satu profil lagi
  db.upsertCustomerProfile('6289876543210@c.us', {
    customer_name: 'Kak Budi',
    tags: 'baru',
    total_orders: 1,
    total_spent: 18000
  });
  const all = db.getAllCustomerProfiles();
  assert.ok(all.length >= 2, `Harus ada minimal 2 profil, dapat ${all.length}`);
});

test('searchCustomerProfiles() — harus bisa cari berdasarkan nama', () => {
  assert.ok(typeof db.searchCustomerProfiles === 'function', 'Fungsi searchCustomerProfiles belum ada di db');
  const results = db.searchCustomerProfiles('Rina');
  assert.ok(results.length >= 1, 'Harus menemukan minimal 1 hasil untuk "Rina"');
  assert.ok(results[0].customer_name.includes('Rina'), 'Hasil pencarian harus mengandung "Rina"');
});

test('searchCustomerProfiles() — harus bisa cari berdasarkan tag', () => {
  const results = db.searchCustomerProfiles('vip');
  assert.ok(results.length >= 1, 'Harus menemukan minimal 1 hasil untuk tag "vip"');
});

// ============================================================
// GRUP 2: Context Builder — buildCustomerProfileContext()
// ============================================================
console.log('\n[2/4] Testing context builder — buildCustomerProfileContext()...');

test('buildCustomerProfileContext() — harus ada dan bisa dipanggil', () => {
  const { buildCustomerProfileContext } = require('../src/ai/context-builder');
  assert.ok(typeof buildCustomerProfileContext === 'function', 'Fungsi buildCustomerProfileContext belum di-export');
});

test('buildCustomerProfileContext() — harus mengembalikan konteks profil pelanggan', () => {
  const { buildCustomerProfileContext } = require('../src/ai/context-builder');
  const ctx = buildCustomerProfileContext('6281234567890@c.us');
  assert.ok(ctx, 'Konteks profil harus ada (bukan empty string)');
  assert.ok(ctx.includes('Kak Rina'), `Konteks harus mengandung nama pelanggan, tapi dapat: ${ctx.substring(0, 100)}`);
  assert.ok(ctx.includes('[PROFIL PELANGGAN INI]'), 'Konteks harus mengandung header [PROFIL PELANGGAN INI]');
});

test('buildCustomerProfileContext() — harus menampilkan catatan owner jika ada', () => {
  const { buildCustomerProfileContext } = require('../src/ai/context-builder');
  const ctx = buildCustomerProfileContext('6281234567890@c.us');
  assert.ok(ctx.includes('Alergi kacang'), 'Konteks harus mengandung catatan owner');
});

test('buildCustomerProfileContext() — harus return empty string jika kontak tidak ada', () => {
  const { buildCustomerProfileContext } = require('../src/ai/context-builder');
  const ctx = buildCustomerProfileContext('000000000@c.us');
  assert.strictEqual(ctx, '', 'Harus return empty string untuk kontak tanpa profil');
});

// ============================================================
// GRUP 3: Integrasi buildContext() dengan customer profile
// ============================================================
console.log('\n[3/4] Testing integrasi buildContext()...');

test('buildContext() mode bisnis — harus menyertakan profil pelanggan di output', () => {
  const { buildContext } = require('../src/ai/context-builder');
  const ctx = buildContext('ada produk apa saja?', 'bisnis', '6281234567890@c.us');
  assert.ok(ctx.includes('[PROFIL PELANGGAN INI]'), 'buildContext bisnis harus include profil pelanggan');
  assert.ok(ctx.includes('Kak Rina'), 'buildContext bisnis harus include nama pelanggan');
});

// ============================================================
// GRUP 4: Auto-extract nama dari tag [CUSTOMER_NAME:xxx]
// ============================================================
console.log('\n[4/4] Testing auto-extract nama pelanggan dari respons AI...');

test('extractCustomerNameFromReply() — harus bisa extract nama dari tag', () => {
  const { extractCustomerNameFromReply } = require('../src/ai/context-builder');
  assert.ok(typeof extractCustomerNameFromReply === 'function', 'Fungsi extractCustomerNameFromReply belum di-export');
  
  const result = extractCustomerNameFromReply('Halo Kak! Terima kasih sudah menghubungi. [CUSTOMER_NAME:Rina]');
  assert.ok(result, 'Harus mengembalikan object');
  assert.strictEqual(result.name, 'Rina', 'Nama harus "Rina"');
  assert.strictEqual(result.cleanReply, 'Halo Kak! Terima kasih sudah menghubungi.', 'Reply harus bersih tanpa tag');
});

test('extractCustomerNameFromReply() — harus return null jika tidak ada tag', () => {
  const { extractCustomerNameFromReply } = require('../src/ai/context-builder');
  const result = extractCustomerNameFromReply('Halo Kak, ada yang bisa dibantu?');
  assert.strictEqual(result, null, 'Harus return null jika tidak ada tag [CUSTOMER_NAME:xxx]');
});

// ============================================================
// RINGKASAN
// ============================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`HASIL: ${passed} passed, ${failed} failed (total: ${passed + failed})`);
console.log(`${'='.repeat(50)}`);

if (failed > 0) {
  console.log('\n⚠️  Ada test yang GAGAL — ini EXPECTED untuk TDD step RED.');
  process.exit(1);
} else {
  console.log('\n✅ SEMUA TEST PASSED — Fase 2 Customer Intelligence SELESAI!');
}
