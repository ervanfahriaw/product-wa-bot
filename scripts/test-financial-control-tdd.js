/**
 * TDD Test Suite: Financial Control, Category Normalization & Personalization
 * Memverifikasi seluruh perbaikan kasus nyata:
 * - Budget Planner & Catatan Keuangan sinkron
 * - Rekategorisasi & transfer pengeluaran
 * - Penghapusan / koreksi transaksi tanpa duplikasi
 * - Exclusion guard agar perintah budget tidak keliru dicatat sebagai transaksi baru
 * - Personalisasi (Nama bot "Jarot", Panggilan "Van", Larangan "Kak")
 */

const assert = require('assert');
const db = require('../src/db');
const { normalizeCategory, isSameCategory } = require('../src/utils/categories');
const { extractExpenseFromText, parseAiIntent } = require('../src/engine/handlers/personal-handler');
const { 
  getUserPreferences, 
  saveUserPreferences, 
  detectPreferenceUpdatesFromText, 
  buildUserProfileContext 
} = require('../src/utils/user-preferences');
const { buildExpenseContext, buildBudgetContext, buildPersonalContext } = require('../src/ai/context-builder');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('   🧪 MEMULAI TDD TEST SUITE: FINANCIAL & AI CONTROL  ');
console.log('======================================================\n');

// ----------------------------------------------------
// GRUP 1: Normalisasi Kategori
// ----------------------------------------------------
console.log('📌 [Grup 1] Category Normalization Engine');

runTest('TC-CAT-01: "makan", "minum", "uang makan", "kuliner" -> "Makan & Minum"', () => {
  assert.strictEqual(normalizeCategory('makan'), 'Makan & Minum');
  assert.strictEqual(normalizeCategory('minum'), 'Makan & Minum');
  assert.strictEqual(normalizeCategory('uang makan'), 'Makan & Minum');
  assert.strictEqual(normalizeCategory('makan & minum'), 'Makan & Minum');
  assert.strictEqual(normalizeCategory('makanan dan minuman'), 'Makan & Minum');
  assert.strictEqual(normalizeCategory('sarapan pagi'), 'Makan & Minum');
  assert.strictEqual(normalizeCategory('jajan'), 'Makan & Minum');
});

runTest('TC-CAT-02: "bensin", "tambal ban", "ojol", "grab" -> "Transportasi"', () => {
  assert.strictEqual(normalizeCategory('bensin'), 'Transportasi');
  assert.strictEqual(normalizeCategory('tambal ban'), 'Transportasi');
  assert.strictEqual(normalizeCategory('ojol'), 'Transportasi');
  assert.strictEqual(normalizeCategory('gojek'), 'Transportasi');
  assert.strictEqual(normalizeCategory('parkir motor'), 'Transportasi');
});

runTest('TC-CAT-03: isSameCategory mengenali alias secara akurat', () => {
  assert.strictEqual(isSameCategory('makan', 'Makan & Minum'), true);
  assert.strictEqual(isSameCategory('uang makan', 'makan'), true);
  assert.strictEqual(isSameCategory('bensin', 'Transportasi'), true);
  assert.strictEqual(isSameCategory('makan', 'Transportasi'), false);
});

// ----------------------------------------------------
// GRUP 2: Exclusion Guard Parser Pengeluaran
// ----------------------------------------------------
console.log('\n📌 [Grup 2] Expense Parser & Exclusion Guard');

runTest('TC-EXP-GUARD-01: Kalimat modifikasi budget tidak dicatat sebagai expense baru', () => {
  assert.strictEqual(extractExpenseFromText('tambah uang makan 20k dari 50 jadi 70'), null);
  assert.strictEqual(extractExpenseFromText('hapus budget makan, penggunaan 10k masukan ke budget makan&minum'), null);
  assert.strictEqual(extractExpenseFromText('budget makan 50k'), null);
  assert.strictEqual(extractExpenseFromText('set anggaran 100k untuk transportasi'), null);
});

runTest('TC-EXP-GUARD-02: Komplain / koreksi percakapan tidak dicatat sebagai expense baru', () => {
  assert.strictEqual(extractExpenseFromText('malah nambah pengeluaran , saya hanya minta pindahkan'), null);
  assert.strictEqual(extractExpenseFromText('katanya sudah di di set ke 35k'), null);
  assert.strictEqual(extractExpenseFromText('hapus pengeluaran tadi'), null);
  assert.strictEqual(extractExpenseFromText('batalkan yang 20k tadi'), null);
});

runTest('TC-EXP-GUARD-03: Kalimat transaksi riil tetap terekstrak dengan kategori kanonikal', () => {
  const t1 = extractExpenseFromText('saya tambal ban 20 k');
  assert.ok(t1);
  assert.strictEqual(t1.amount, 20000);
  assert.strictEqual(t1.category, 'Transportasi');

  const t2 = extractExpenseFromText('minum 5k tadi');
  assert.ok(t2);
  assert.strictEqual(t2.amount, 5000);
  assert.strictEqual(t2.category, 'Makan & Minum');

  const t3 = extractExpenseFromText('rot saya jajan 2k tadi');
  assert.ok(t3);
  assert.strictEqual(t3.amount, 2000);
  assert.strictEqual(t3.category, 'Makan & Minum');
});

// ----------------------------------------------------
// GRUP 3: Database Operations (Recategorize, Delete, Edit)
// ----------------------------------------------------
console.log('\n📌 [Grup 3] Database Financial Operations (Recategorize & Undo)');

runTest('TC-DB-RECAT-01: Pindahkan transaksi antar kategori (recategorizeExpenses)', () => {
  // Buat transaksi dengan kategori Lain-lain
  const id1 = db.createExpense({ category: 'Lain-lain', amount: 10000, note: 'nasi bungkus penyesuaian' });
  const id2 = db.createExpense({ category: 'Lain-lain', amount: 15000, note: 'es teh manis' });

  const result = db.recategorizeExpenses('Lain-lain', 'Makan & Minum');
  assert.ok(result.affected >= 2);
  assert.strictEqual(result.to, 'Makan & Minum');

  const exp1 = db.getExpenseById(id1);
  assert.strictEqual(exp1.category, 'Makan & Minum');

  // Bersihkan data test
  db.deleteExpense(id1);
  db.deleteExpense(id2);
});

runTest('TC-DB-DEL-01: Hapus transaksi terakhir atau berdasarkan keyword (deleteLastExpense)', () => {
  const id = db.createExpense({ category: 'Transportasi', amount: 20000, note: 'saya tambal ban 20 k' });
  
  const last = db.getLastExpense();
  assert.strictEqual(last.id, id);

  const delRes = db.deleteExpenseByKeywordOrAmount({ keyword: 'tambal ban' });
  assert.strictEqual(delRes.success, true);
  assert.ok(delRes.deletedExpenses.length > 0);

  const check = db.getExpenseById(id);
  assert.strictEqual(check, null);
});

// ----------------------------------------------------
// GRUP 4: Budget Planner Synchronization
// ----------------------------------------------------
console.log('\n📌 [Grup 4] Budget Planner Synchronization & Deduplication');

runTest('TC-BDG-01: Set budget "makan" lalu update "Makan & Minum" tidak membuat duplikasi', () => {
  // Set budget "makan" 50k
  const bId1 = db.setBudget({ category: 'makan', monthly_limit: 50000, alert_at_percent: 80 });
  const b1 = db.getBudgetByCategory('makan');
  assert.strictEqual(b1.monthly_limit, 50000);
  assert.strictEqual(b1.category, 'Makan & Minum'); // Auto-normalized

  // Update "Makan & Minum" jadi 70k
  const bId2 = db.setBudget({ category: 'Makan & Minum', monthly_limit: 70000, alert_at_percent: 80 });
  assert.strictEqual(bId1, bId2); // Harus update ID yang sama!

  const b2 = db.getBudgetByCategory('makan');
  assert.strictEqual(b2.monthly_limit, 70000);

  // Query dengan variasi "uang makan"
  const bQuery = db.getBudgetByCategory('uang makan');
  assert.ok(bQuery);
  assert.strictEqual(bQuery.id, bId1);

  db.deleteBudget(bId1);
});

// ----------------------------------------------------
// GRUP 5: Personalisasi & Memory Panggilan
// ----------------------------------------------------
console.log('\n📌 [Grup 5] User Personalization & Greeting Memory');

runTest('TC-PRF-01: Deteksi nama bot "Jarot" dari pesan pengguna', () => {
  const detected = detectPreferenceUpdatesFromText('aku kasih nama kamu jarot');
  assert.ok(detected);
  assert.strictEqual(detected.assistantName, 'Jarot');

  const prefs = getUserPreferences();
  assert.strictEqual(prefs.assistantName, 'Jarot');
});

runTest('TC-PRF-02: Deteksi larangan "jangan panggil kak" dan panggilan "Van"', () => {
  const detected = detectPreferenceUpdatesFromText('ya , jangan panggil kak . panggil van aja');
  assert.ok(detected);
  assert.strictEqual(detected.callUserAs, 'Van');
  assert.strictEqual(detected.disallowKak, true);

  const prefs = getUserPreferences();
  assert.strictEqual(prefs.callUserAs, 'Van');
  assert.strictEqual(prefs.disallowKak, true);

  const ctx = buildUserProfileContext();
  assert.ok(ctx.includes('Van'));
  assert.ok(ctx.includes('LARANGAN KERAS'));
  assert.ok(ctx.includes('Jarot'));
});

// ----------------------------------------------------
// GRUP 6: Ground Truth Context Builder Realtime
// ----------------------------------------------------
console.log('\n📌 [Grup 6] Ground Truth Context Builder Realtime');

runTest('TC-CTX-01: buildPersonalContext memuat waktu, preferensi, expenses, dan budgets secara lengkap', () => {
  const ctx = buildPersonalContext('pengeluaran saya berapa', '151917456011364@lid');
  assert.ok(ctx.includes('KONTEKS WAKTU'));
  assert.ok(ctx.includes('PROFIL & PREFERENSI PENGGUNA'));
  assert.ok(ctx.includes('Van'));
  assert.ok(ctx.includes('DATA PENGELUARAN REALTIME DATABASE'));
  assert.ok(ctx.includes('STATUS BUDGET BULAN INI'));
});

console.log('\n======================================================');
console.log(`  📊 HASIL PENGUJIAN FINANCIAL & AI CONTROL:`);
console.log(`     Total Pengujian: ${passed + failed}`);
console.log(`     ✅ Lulus (PASS):  ${passed}`);
console.log(`     ❌ Gagal (FAIL):  ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
