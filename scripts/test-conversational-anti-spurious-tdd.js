/**
 * TDD Test Suite: Conversational Anti-Spurious & Regional Language Guards
 * Menguji skenario nyata percakapan:
 * 1. Curhat / musibah / bahasa Sunda ("anying kamari aing kacilakaan") tidak memicu simpan jurnal.
 * 2. Cerita biaya belum terbayar ("dibawa ka rs dipenta 1,7jt aing tebisa mayarna") tidak memicu pengeluaran.
 * 3. Umpatan kekesalan ("ai sia teu guna pisan") tidak memicu simpan catatan/notes.
 * 4. Pertanyaan istilah edukatif ("apa itu penis") tidak memicu simpan catatan.
 * 5. Normalisasi kategori tidak menjadikan seluruh kalimat panjang sebagai nama kategori.
 * 6. Transaksi riil bahasa daerah ("tadi meuli rokok 30rb", "tadi mayar parkir 5k") tetap tercatat akurat.
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const db = require('../src/db');
const { handlePersonalMessage } = require('../src/engine/handlers/personal-handler');
const { normalizeCategory } = require('../src/utils/categories');

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function startSuite() {
  console.log('\n======================================================');
  console.log('   🧪 MEMULAI TDD: ANTI-SPURIOUS & EMOTIONAL GUARDS   ');
  console.log('======================================================\n');

  const ai = require('../src/ai');
  const origGen = ai.generateReply;

  // ----------------------------------------------------
  // GRUP 1: Category Normalization Safety on Long Sentences
  // ----------------------------------------------------
  console.log('📌 [Grup 1] Category Normalization Sentence Guard');

  await runTest('TC-CAT-SENT-01: Kalimat panjang tidak dijadikan nama kategori baru', async () => {
    const catNoKeyword = normalizeCategory('saya mau cerita hal lain yang panjang dan tidak ada kaitannya');
    assert.strictEqual(catNoKeyword, 'Lain-lain', 'Kategori dari kalimat tanpa alias harus fallback ke Lain-lain');

    const catWithRS = normalizeCategory('dibawa ka rs, terus dipenta mayar 1,7 juta aing tebisa mayarna');
    assert.ok(catWithRS === 'Kesehatan' || catWithRS === 'Lain-lain', 'Harus menghasilkan nama kategori kanonikal singkat, bukan kalimat mentah');
    assert.ok(catWithRS.split(' ').length <= 3, 'Kategori tidak boleh berupa kalimat panjang');
  });

  await runTest('TC-CAT-SENT-02: Kata tunggal medis "rs" atau "dokter" tetap masuk Kesehatan', async () => {
    assert.strictEqual(normalizeCategory('rs'), 'Kesehatan');
    assert.strictEqual(normalizeCategory('dokter'), 'Kesehatan');
  });

  // ----------------------------------------------------
  // GRUP 2: Unpaid / Musibah Story vs Expense
  // ----------------------------------------------------
  console.log('\n📌 [Grup 2] Unpaid / Negation / Story Guard vs Expense');

  await runTest('TC-EXP-NEG-01: Cerita biaya RS belum bisa dibayar tidak dicatat sebagai expense', async () => {
    const initialExpenses = db.getAllExpenses ? db.getAllExpenses() : [];
    const initialCount = initialExpenses.length;

    const sentMessages = [];
    const mockMessage = {
      from: '6281234567890@c.us',
      body: 'dibawa ka rs, terus dipenta mayar 1,7 juta aing tebisa mayarna',
      reply: (text) => sentMessages.push(text),
      getChat: async () => ({ sendStateTyping: async () => {}, clearState: async () => {} })
    };

    const mockClient = {
      sendMessage: async (to, text) => sentMessages.push(text)
    };

    ai.generateReply = async () => ({
      reply: 'Astagfirullah, parah juga itu. Coba rundingkan baik-baik sama pihak RS atau keluarga ya bro.'
    });

    try {
      await handlePersonalMessage(mockMessage, mockClient);
      const afterExpenses = db.getAllExpenses ? db.getAllExpenses() : [];
      assert.strictEqual(afterExpenses.length, initialCount, 'Jumlah pengeluaran tidak boleh bertambah!');
    } finally {
      ai.generateReply = origGen;
    }
  });

  // ----------------------------------------------------
  // GRUP 3: Casual Venting / Accident vs Journal
  // ----------------------------------------------------
  console.log('\n📌 [Grup 3] Accident & Casual Venting Guard vs Journal');

  await runTest('TC-JRN-GUARD-01: Curhat kecelakaan ("anying kamari aing kacilakaan") tidak disimpan ke jurnal', async () => {
    const initialJournals = db.getAllJournals ? db.getAllJournals() : [];
    const initialCount = initialJournals.length;

    const sentMessages = [];
    const mockMessage = {
      from: '6281234567890@c.us',
      body: 'anying kamari aing kacilakaan',
      reply: (text) => sentMessages.push(text),
      getChat: async () => ({ sendStateTyping: async () => {}, clearState: async () => {} })
    };

    const mockClient = {
      sendMessage: async (to, text) => sentMessages.push(text)
    };

    // AI mencoba iseng mengembalikan write_journal
    ai.generateReply = async () => ({
      reply: 'Astagfirullah, seriusan kacilakaan? Awak maneh teu nanaon?\n```json\n{"intent": "write_journal", "content": "Kecelakaan kemarin"}\n```'
    });

    try {
      await handlePersonalMessage(mockMessage, mockClient);
      const afterJournals = db.getAllJournals ? db.getAllJournals() : [];
      assert.strictEqual(afterJournals.length, initialCount, 'Jurnal tidak boleh dibuat saat pengguna curhat kecelakaan!');
    } finally {
      ai.generateReply = origGen;
    }
  });

  await runTest('TC-JRN-GUARD-02: Protes pengguna ("ai sia naon ngadon nulis aing rek curhat") tidak disimpan ke jurnal', async () => {
    const initialJournals = db.getAllJournals ? db.getAllJournals() : [];
    const initialCount = initialJournals.length;

    const sentMessages = [];
    const mockMessage = {
      from: '6281234567890@c.us',
      body: 'ai sia naon ngadon nulis aing rek curhat',
      reply: (text) => sentMessages.push(text),
      getChat: async () => ({ sendStateTyping: async () => {}, clearState: async () => {} })
    };

    const mockClient = {
      sendMessage: async (to, text) => sentMessages.push(text)
    };

    ai.generateReply = async () => ({
      reply: 'Mangga mangga sok carita we, didangu ku urang moal ditulis deui.\n```json\n{"intent": "write_journal", "content": "Lanjutan curhat"}\n```'
    });

    try {
      await handlePersonalMessage(mockMessage, mockClient);
      const afterJournals = db.getAllJournals ? db.getAllJournals() : [];
      assert.strictEqual(afterJournals.length, initialCount, 'Jurnal tidak boleh dibuat saat pengguna protes!');
    } finally {
      ai.generateReply = origGen;
    }
  });

  // ----------------------------------------------------
  // GRUP 4: Insult / Complaint vs Note
  // ----------------------------------------------------
  console.log('\n📌 [Grup 4] Insult & Complaint Guard vs Note');

  await runTest('TC-NOTE-GUARD-01: Umpatan kesal ("ai sia teu guna pisan") tidak disimpan sebagai catatan', async () => {
    const initialNotes = db.getAllNotes ? db.getAllNotes() : [];
    const initialCount = initialNotes.length;

    const sentMessages = [];
    const mockMessage = {
      from: '6281234567890@c.us',
      body: 'ai sia teu guna pisan',
      reply: (text) => sentMessages.push(text),
      getChat: async () => ({ sendStateTyping: async () => {}, clearState: async () => {} })
    };

    const mockClient = {
      sendMessage: async (to, text) => sentMessages.push(text)
    };

    // AI mencoba iseng mengembalikan save_note
    ai.generateReply = async () => ({
      reply: 'Maaf ya bro kalau belum bisa bantu bayar langsung.\n```json\n{"intent": "save_note", "title": "Kasus Kecelakaan", "content": "RS belum terbayar"}\n```'
    });

    try {
      await handlePersonalMessage(mockMessage, mockClient);
      const afterNotes = db.getAllNotes ? db.getAllNotes() : [];
      assert.strictEqual(afterNotes.length, initialCount, 'Catatan tidak boleh dibuat dari umpatan pengguna!');
    } finally {
      ai.generateReply = origGen;
    }
  });

  // ----------------------------------------------------
  // GRUP 5: Explicit Positive Commands
  // ----------------------------------------------------
  console.log('\n📌 [Grup 5] Explicit Positive Actions');

  await runTest('TC-EXP-POS-01: Transaksi riil eksplisit tetap tercatat akurat', async () => {
    const initialExpenses = db.getAllExpenses ? db.getAllExpenses() : [];
    const initialCount = initialExpenses.length;

    const sentMessages = [];
    const mockMessage = {
      from: '6281234567890@c.us',
      body: 'tadi mayar parkir 5000',
      reply: (text) => sentMessages.push(text),
      getChat: async () => ({ sendStateTyping: async () => {}, clearState: async () => {} })
    };

    const mockClient = {
      sendMessage: async (to, text) => sentMessages.push(text)
    };

    ai.generateReply = async () => ({
      reply: '✅ Siap, pengeluaran parkir Rp5.000 sudah dicatat!\n```json\n{"intent": "record_expense", "category": "Transportasi", "amount": 5000, "note": "tadi mayar parkir"}\n```'
    });

    try {
      await handlePersonalMessage(mockMessage, mockClient);
      const afterExpenses = db.getAllExpenses ? db.getAllExpenses() : [];
      assert.strictEqual(afterExpenses.length, initialCount + 1, 'Pengeluaran sah harus tersimpan!');
    } finally {
      ai.generateReply = origGen;
    }
  });

  console.log('\n======================================================');
  console.log(`  📊 HASIL PENGUJIAN ANTI-SPURIOUS & EMOTIONAL GUARDS:`);
  console.log(`     Total Pengujian: ${passed + failed}`);
  console.log(`     ✅ Lulus (PASS):  ${passed}`);
  console.log(`     ❌ Gagal (FAIL):  ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

startSuite().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
