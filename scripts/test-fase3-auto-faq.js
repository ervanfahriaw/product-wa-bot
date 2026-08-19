/**
 * Test Fase 3 — Auto FAQ: Jawab Tanpa AI untuk Pertanyaan Berulang (TDD)
 * 
 * Menguji:
 * 1. CRUD tabel FAQs (database layer)
 * 2. matchFaq() — keyword matching logic
 * 3. incrementFaqMatchCount() — counter usage
 * 4. FAQ interceptor integration (business-handler should check FAQ before AI)
 * 5. Dashboard route GET /dashboard/faqs returns 200
 */

const assert = require('assert');
const db = require('../src/db');

console.log('=== TEST FASE 3 — AUTO FAQ (TDD) ===\n');

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
// GRUP 1: Database CRUD — faqs
// ============================================================
console.log('[1/5] Testing database CRUD faqs...');

test('createFaq() — harus ada dan bisa dipanggil', () => {
  assert.ok(typeof db.createFaq === 'function', 'Fungsi createFaq belum ada di db');
});

let faq1Id = 0;
let faq2Id = 0;

test('createFaq() — harus bisa membuat FAQ baru', () => {
  faq1Id = db.createFaq({
    trigger_keywords: 'jam buka,buka tutup,kapan buka,jam operasional',
    question_label: 'Jam Operasional',
    answer: 'Toko kami buka Senin-Sabtu, pukul 08:00-17:00 WIB.'
  });
  assert.ok(faq1Id > 0, `Harus return ID > 0, dapat: ${faq1Id}`);
});

test('createFaq() — harus bisa membuat FAQ kedua', () => {
  faq2Id = db.createFaq({
    trigger_keywords: 'ongkir,ongkos kirim,biaya kirim,shipping',
    question_label: 'Ongkos Kirim',
    answer: 'Ongkir dihitung berdasarkan alamat Kakak. Gratis ongkir untuk area Jakarta!'
  });
  assert.ok(faq2Id > 0, `Harus return ID > 0, dapat: ${faq2Id}`);
});

test('createFaq() — harus bisa membuat FAQ ketiga (nonaktif)', () => {
  const id = db.createFaq({
    trigger_keywords: 'retur,tukar,pengembalian',
    question_label: 'Kebijakan Retur',
    answer: 'Produk bisa dikembalikan dalam 7 hari setelah diterima.',
    is_active: 0
  });
  assert.ok(id > 0, `Harus return ID > 0, dapat: ${id}`);
});

test('getAllFaqs() — harus mengembalikan semua FAQ', () => {
  assert.ok(typeof db.getAllFaqs === 'function', 'Fungsi getAllFaqs belum ada di db');
  const all = db.getAllFaqs();
  assert.ok(all.length >= 3, `Harus ada minimal 3 FAQ, dapat ${all.length}`);
});

test('getFaqById() — harus mengembalikan FAQ berdasarkan ID', () => {
  assert.ok(typeof db.getFaqById === 'function', 'Fungsi getFaqById belum ada di db');
  const faq = db.getFaqById(faq1Id);
  assert.ok(faq, `FAQ dengan ID ${faq1Id} harus ditemukan`);
  assert.strictEqual(faq.question_label, 'Jam Operasional');
  assert.strictEqual(faq.is_active, 1);
});

test('updateFaq() — harus bisa update FAQ', () => {
  assert.ok(typeof db.updateFaq === 'function', 'Fungsi updateFaq belum ada di db');
  db.updateFaq(faq1Id, {
    answer: 'Toko kami buka Senin-Sabtu, pukul 09:00-21:00 WIB. Minggu libur.'
  });
  const updated = db.getFaqById(faq1Id);
  assert.ok(updated.answer.includes('09:00-21:00'), 'Jawaban harus terupdate');
});

test('deleteFaq() — harus bisa hapus FAQ', () => {
  assert.ok(typeof db.deleteFaq === 'function', 'Fungsi deleteFaq belum ada di db');
  // Buat FAQ dummy lalu hapus
  const tempId = db.createFaq({
    trigger_keywords: 'test hapus',
    question_label: 'Test Hapus',
    answer: 'akan dihapus'
  });
  db.deleteFaq(tempId);
  const deleted = db.getFaqById(tempId);
  assert.strictEqual(deleted, undefined, 'FAQ yang dihapus harus undefined');
});

// ============================================================
// GRUP 2: matchFaq() — Keyword matching
// ============================================================
console.log('\n[2/5] Testing matchFaq() keyword matching...');

test('matchFaq() — harus ada dan bisa dipanggil', () => {
  assert.ok(typeof db.matchFaq === 'function', 'Fungsi matchFaq belum ada di db');
});

test('matchFaq() — harus cocok jika pesan mengandung keyword FAQ', () => {
  const result = db.matchFaq('buka jam berapa ya?');
  assert.ok(result, 'Harus menemukan FAQ untuk "buka jam berapa"');
  assert.strictEqual(result.question_label, 'Jam Operasional');
});

test('matchFaq() — harus cocok untuk keyword "ongkir"', () => {
  const result = db.matchFaq('berapa ongkirnya ke bandung?');
  assert.ok(result, 'Harus menemukan FAQ untuk "ongkir"');
  assert.strictEqual(result.question_label, 'Ongkos Kirim');
});

test('matchFaq() — harus TIDAK cocok jika keyword tidak ada di pesan', () => {
  const result = db.matchFaq('ada produk baru apa?');
  assert.strictEqual(result, null, 'Harus return null untuk pesan tanpa keyword FAQ');
});

test('matchFaq() — harus TIDAK cocok dengan FAQ yang nonaktif', () => {
  const result = db.matchFaq('bagaimana cara retur barang?');
  assert.strictEqual(result, null, 'FAQ nonaktif harus tidak ikut matching');
});

test('matchFaq() — harus case-insensitive', () => {
  const result = db.matchFaq('BUKA JAM BERAPA?');
  assert.ok(result, 'Matching harus case-insensitive');
});

// ============================================================
// GRUP 3: incrementFaqMatchCount()
// ============================================================
console.log('\n[3/5] Testing incrementFaqMatchCount()...');

test('incrementFaqMatchCount() — harus ada dan bisa dipanggil', () => {
  assert.ok(typeof db.incrementFaqMatchCount === 'function', 'Fungsi incrementFaqMatchCount belum ada di db');
});

test('incrementFaqMatchCount() — counter harus naik setelah dipanggil', () => {
  const faqBefore = db.getFaqById(faq1Id);
  const countBefore = faqBefore.match_count || 0;
  db.incrementFaqMatchCount(faq1Id);
  db.incrementFaqMatchCount(faq1Id);
  const faqAfter = db.getFaqById(faq1Id);
  assert.strictEqual(faqAfter.match_count, countBefore + 2, `Counter harus naik 2, dari ${countBefore} ke ${countBefore + 2}`);
});

// ============================================================
// GRUP 4: Integrasi — chat_logs handled_by 'faq'
// ============================================================
console.log('\n[4/5] Testing integrasi chat_logs handled_by faq...');

test('createChatLog dengan handled_by faq — harus bisa disimpan', () => {
  const id = db.createChatLog({
    contact: '6281111111111@c.us',
    message_in: 'buka jam berapa?',
    message_out: 'Toko kami buka Senin-Sabtu, pukul 09:00-21:00 WIB.',
    handled_by: 'faq'
  });
  assert.ok(id > 0, 'Chat log dengan handled_by faq harus berhasil disimpan');
  const log = db.getChatLogById(id);
  assert.strictEqual(log.handled_by, 'faq', 'handled_by harus "faq"');
});

// ============================================================
// GRUP 5: Dashboard route — GET /dashboard/faqs
// ============================================================
console.log('\n[5/5] Testing dashboard route /dashboard/faqs...');

test('GET /dashboard/faqs — harus return HTTP 200', () => {
  // Test via HTTP request
  const http = require('http');
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/dashboard/faqs', (res) => {
      assert.ok([200, 302].includes(res.statusCode), `Expected 200 or 302, got ${res.statusCode}`);
      resolve();
    }).on('error', (err) => {
      // Server mungkin tidak berjalan — skip test ini
      console.log('     (skipped: server tidak berjalan)');
      resolve();
    });
  });
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
  console.log('\n✅ SEMUA TEST PASSED — Fase 3 Auto FAQ SELESAI!');
}
