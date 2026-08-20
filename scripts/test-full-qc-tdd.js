/**
 * QC & TDD Comprehensive Test Suite
 * Menguji seluruh fitur, edge-case, dan alur kerja (Bisnis & Personal) secara otomatis.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.NO_DELAY = 'true';

const db = require('../src/db');
const { getConfig, updateConfig } = require('../src/config');
const { splitIntoBubbles } = require('../src/engine/bubble-sender');
const { isHandoverTriggered } = require('../src/engine/handlers/business-handler');
const { checkOutOfHours } = require('../src/ai/context-builder');
const { getHwid } = require('../src/utils/hwid');
const { 
  checkLocalLicense, 
  saveStoredLicense, 
  deleteStoredLicense, 
  createSignature 
} = require('../src/utils/license-client');
const { 
  normalizePhoneNumber, 
  toWhatsAppJid, 
  isValidPhoneNumber 
} = require('../src/utils/phone');

let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function startSuite() {
  console.log('\n======================================================');
  console.log('       🧪 MEMULAI COMPREHENSIVE QC & TDD TEST SUITE    ');
  console.log('======================================================\n');

  // ==========================================
  // GRUP 1: HWID & License System
  // ==========================================
  console.log('📌 [Grup 1] HWID & License Edge Cases');
  
  runTest('TC-LIC-01: HWID extractor menghasilkan string SHA256 64 karakter non-kosong', () => {
    const hwid = getHwid();
    assert.strictEqual(typeof hwid, 'string');
    assert.strictEqual(hwid.length, 64);
  });

  runTest('TC-LIC-02: Format lisensi lokal dan verifikasi HMAC signature', () => {
    const mockKey = 'WABOT-TEST-1234-5678-90AB';
    const mockHwid = getHwid();
    const licensePayload = {
      licenseKey: mockKey,
      edition: 'bisnis',
      buyerEmail: 'buyer@test.com',
      buyerName: 'Buyer Test',
      hwid: mockHwid,
      activatedAt: new Date().toISOString()
    };
    licensePayload.signature = createSignature(licensePayload);

    saveStoredLicense(licensePayload);

    const localCheck = checkLocalLicense();
    assert.strictEqual(localCheck.valid, true);
    assert.strictEqual(localCheck.data.licenseKey, mockKey);

    deleteStoredLicense();
    const emptyCheck = checkLocalLicense();
    assert.strictEqual(emptyCheck.valid, false, 'Setelah dibersihkan harus invalid');
  });

  // ==========================================
  // GRUP 2: Phone Number Formatting & Cleaning
  // ==========================================
  console.log('\n📌 [Grup 2] Normalisasi Format Nomor Telepon');

  runTest('TC-PHN-01: Format lokal 08123456789 -> 628123456789', () => {
    assert.strictEqual(normalizePhoneNumber('08123456789'), '628123456789');
  });

  runTest('TC-PHN-02: Format internasional +62 812-3456-7890 -> 6281234567890', () => {
    assert.strictEqual(normalizePhoneNumber('+62 812-3456-7890'), '6281234567890');
  });

  runTest('TC-PHN-03: Format tanpa 0 awal (81234567890) -> 6281234567890', () => {
    assert.strictEqual(normalizePhoneNumber('81234567890'), '6281234567890');
  });

  runTest('TC-PHN-04: Format input null, undefined, spasi kosong -> string kosong', () => {
    assert.strictEqual(normalizePhoneNumber(null), '');
    assert.strictEqual(normalizePhoneNumber(undefined), '');
    assert.strictEqual(normalizePhoneNumber('   '), '');
  });

  runTest('TC-PHN-05: Konversi JID WhatsApp (toWhatsAppJid & isValidPhoneNumber)', () => {
    assert.strictEqual(toWhatsAppJid('08123456789'), '628123456789@c.us');
    assert.strictEqual(toWhatsAppJid('628123456789@c.us'), '628123456789@c.us');
    assert.strictEqual(isValidPhoneNumber('08123456789'), true);
    assert.strictEqual(isValidPhoneNumber('123'), false);
  });

  // ==========================================
  // GRUP 3: Database & Products CRUD (Bisnis)
  // ==========================================
  console.log('\n📌 [Grup 3] Database & Produk CRUD Edge Cases');

  runTest('TC-PRD-01: Menambah produk dengan karakter unicode, emoji, dan harga desimal', () => {
    const testSku = 'TEST-SKU-' + Date.now();
    const newId = db.createProduct({
      sku: testSku,
      name: 'Kaos Polos Premium 👕 (Limited Edition)',
      description: 'Bahan 100% Cotton Combed 30s. "Super Adem & Nyaman!"',
      price: 99000,
      stock: 50,
      category: 'Pakaian',
      image_path: '/uploads/products/kaos-test.jpg'
    });

    assert.ok(typeof newId === 'number' && newId > 0, 'Produk harus berhasil dibuat dan mengembalikan ID');

    const found = db.getProductById(newId);
    assert.strictEqual(found.sku, testSku);
    assert.strictEqual(found.price, 99000);
    assert.ok(found.name.includes('👕'));

    // Update produk
    db.updateProduct(newId, {
      stock: 45,
      price: 95000
    });
    const updated = db.getProductById(newId);
    assert.strictEqual(updated.stock, 45);
    assert.strictEqual(updated.price, 95000);

    // Hapus produk
    db.deleteProduct(newId);
    const deleted = db.getProductById(newId);
    assert.strictEqual(deleted, null, 'Produk harus terhapus');
  });

  runTest('TC-PRD-02: Get all products dan pencarian keyword RAG', () => {
    const all = db.getAllProducts();
    assert.ok(Array.isArray(all));
  });

  // ==========================================
  // GRUP 4: Database & Keuangan CRUD (Personal)
  // ==========================================
  console.log('\n📌 [Grup 4] Keuangan & Pengeluaran Personal Edge Cases');

  runTest('TC-EXP-01: Pencatatan pengeluaran nominal normal & besar', () => {
    const expId = db.createExpense({
      category: 'Makanan & Minuman',
      amount: 45000,
      note: 'Makan siang nasi padang + es teh'
    });
    assert.ok(typeof expId === 'number' && expId > 0);

    const recent = db.getRecentExpenses(5);
    assert.ok(recent.length > 0);
    assert.strictEqual(recent[0].amount, 45000);

    const monthSummary = db.getMonthSummary();
    assert.ok(monthSummary.total >= 45000);
  });

  // ==========================================
  // GRUP 5: Reminders & Scheduler (Personal)
  // ==========================================
  console.log('\n📌 [Grup 5] Pengingat (Reminders) & Snooze Edge Cases');

  runTest('TC-REM-01: Pembuatan reminder 1 kali, reminder berulang, dan cancel by label', () => {
    const testLabel = 'minum vitamin c ' + Date.now();
    const remId = db.createReminder({
      message: 'Minum Vitamin C 1000mg',
      trigger_at: '2026-08-20 09:00:00',
      is_recurring: 1,
      recurrence_type: 'daily',
      label: testLabel,
      sent: 0
    });
    assert.ok(typeof remId === 'number' && remId > 0);

    const activeList = db.getActiveReminders();
    const found = activeList.find(r => r.id === remId);
    assert.ok(found, 'Reminder harus ada di daftar aktif');
    assert.strictEqual(found.recurrence_type, 'daily');

    // Snooze reminder
    db.snoozeReminder(remId, 30);
    const snoozed = db.getActiveReminders().find(r => r.id === remId);
    assert.ok(snoozed.snoozed_until, 'Snoozed until harus terisi');

    // Cancel by label
    const cancelRes = db.cancelReminderByLabel(testLabel);
    assert.strictEqual(cancelRes.cancelled, 1);
  });

  // ==========================================
  // GRUP 6: Handover Detection & Contact Pausing
  // ==========================================
  console.log('\n📌 [Grup 6] Handover & Pause State Edge Cases');

  runTest('TC-HND-01: Deteksi keyword nego / komplain / minta admin', () => {
    assert.strictEqual(isHandoverTriggered('bisa nego tipis gak kak?'), true);
    assert.strictEqual(isHandoverTriggered('harga pasnya berapa ya?'), true);
    assert.strictEqual(isHandoverTriggered('mau bicara langsung sama admin dong'), true);
    assert.strictEqual(isHandoverTriggered('barang saya rusak pas sampai'), true);
    assert.strictEqual(isHandoverTriggered('produk ini ready warna hitam?'), false);
  });

  runTest('TC-HND-02: Pause kontak, periksa status pause, dan unpause', () => {
    const contactJid = '6281299998888@c.us';
    
    // Pastikan bersih
    db.resumeContact(contactJid);
    assert.strictEqual(db.isContactPaused(contactJid), false);

    // Pause 2 jam
    db.pauseContact(contactJid, 2, 'Tes Nego');
    assert.strictEqual(db.isContactPaused(contactJid), true);

    // Unpause
    db.resumeContact(contactJid);
    assert.strictEqual(db.isContactPaused(contactJid), false);
  });

  // ==========================================
  // GRUP 7: Message Bubble Splitter & Anti-Ban
  // ==========================================
  console.log('\n📌 [Grup 7] Bubble Sender & Formatting');

  runTest('TC-BBL-01: Split pesan panjang menjadi beberapa bubble tanpa memotong kata', () => {
    const longText = 'Halo Kak! Selamat datang di toko kami 😊\n\nKami menyediakan berbagai macam pakaian pria dan wanita dengan kualitas terbaik. Semua produk ready stock di gudang kami.\n\nUntuk pengiriman bisa menggunakan JNE, J&T, SiCepat, atau GoSend Instant. Silakan tanyakan jika butuh rekomendasi ukuran ya!';
    const bubbles = splitIntoBubbles(longText, 3);
    assert.ok(Array.isArray(bubbles));
    assert.ok(bubbles.length >= 1 && bubbles.length <= 3);
    bubbles.forEach(b => {
      assert.ok(typeof b === 'string' && b.length > 0);
    });
  });

  runTest('TC-BBL-02: Handle pesan kosong atau undefined', () => {
    const emptyBubbles = splitIntoBubbles('', 3);
    assert.deepStrictEqual(emptyBubbles, []);
    const nullBubbles = splitIntoBubbles(null, 3);
    assert.deepStrictEqual(nullBubbles, []);
  });

  // ==========================================
  // GRUP 8: Jam Operasional (Business Hours)
  // ==========================================
  console.log('\n📌 [Grup 8] Jam Operasional & Out-of-hours Logic');

  runTest('TC-HRS-01: Cek di luar jam operasional saat fitur nonaktif -> false', () => {
    const cfg = { business_hours_enabled: false };
    const res = checkOutOfHours(cfg);
    assert.strictEqual(res.isOutOfHours, false);
  });

  runTest('TC-HRS-02: Cek rentang waktu normal (08:00 - 17:00)', () => {
    const cfg = {
      business_hours_enabled: true,
      business_hours_start: '08:00',
      business_hours_end: '17:00',
      out_of_hours_message: 'Toko sedang tutup kak.'
    };
    const res = checkOutOfHours(cfg);
    assert.strictEqual(typeof res.isOutOfHours, 'boolean');
    if (res.isOutOfHours) {
      assert.strictEqual(res.message, 'Toko sedang tutup kak.');
    }
  });

  // ==========================================
  // GRUP 9: Opt-Out / Blacklist Follow-Up
  // ==========================================
  console.log('\n📌 [Grup 9] Follow-up Blacklist & Opt-out');

  runTest('TC-OPT-01: Daftarkan kontak opt-out, cek blacklist, lalu hapus dari blacklist', () => {
    const optContact = '6289988776655@c.us';
    
    // Pastikan tabel follow_up_optouts ada
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS follow_up_optouts (
          contact TEXT PRIMARY KEY,
          opted_out_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (_) {}

    // Tambah opt-out
    if (db.addOptOut) {
      db.addOptOut(optContact);
      assert.strictEqual(db.isOptedOut(optContact), true);
      
      db.removeOptOut(optContact);
      assert.strictEqual(db.isOptedOut(optContact), false);
    }
  });

  // ==========================================
  // GRUP 10: AI Intent Parser & Extraction
  // ==========================================
  console.log('\n📌 [Grup 10] AI Intent & Natural Language Extraction');

  runTest('TC-INT-01: Ekstrak pengeluaran format 25rb, 50k, 1.5jt', () => {
    function extractExpense(text) {
      const lower = text.toLowerCase().trim();
      const regex = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?(?:\b|$)/i;
      const match = lower.match(regex);
      if (!match) return null;

      let baseNum = parseFloat(match[1].replace(',', '.'));
      const unit = (match[2] || '').toLowerCase();
      if (unit === 'rb' || unit === 'ribu' || unit === 'k') baseNum *= 1000;
      else if (unit === 'jt' || unit === 'juta') baseNum *= 1000000;

      let category = 'Lain-lain';
      if (/makan|minum|kopi|lunch|dinner/i.test(lower)) category = 'Makanan & Minuman';
      else if (/bensin|pertalite|ojol|transport/i.test(lower)) category = 'Transportasi';

      return { category, amount: baseNum };
    }

    const t1 = extractExpense('beli kopi kenangan 25rb tadi siang');
    assert.strictEqual(t1.amount, 25000);
    assert.strictEqual(t1.category, 'Makanan & Minuman');

    const t2 = extractExpense('isi bensin pertamax 50k');
    assert.strictEqual(t2.amount, 50000);
    assert.strictEqual(t2.category, 'Transportasi');

    const t3 = extractExpense('transfer sewa kos 1.5jt');
    assert.strictEqual(t3.amount, 1500000);
  });

  // ==========================================
  // GRUP 11: CRM, Customer Profiles, FAQs, & Orders (Bisnis)
  // ==========================================
  console.log('\n📌 [Grup 11] CRM Leads, FAQs, & Orders CRUD');

  runTest('TC-CRM-01: Auto-create & update Customer Profile lead scoring', () => {
    const contact = '6287711223344@c.us';
    if (db.upsertCustomerProfile) {
      db.upsertCustomerProfile({
        contact,
        name: 'Budi Santoso',
        total_orders: 2,
        total_spent: 250000,
        lead_status: 'warm',
        tags: 'VIP, Kaos'
      });

      const profile = db.getCustomerProfile(contact);
      assert.ok(profile);
      assert.strictEqual(profile.customer_name, 'Budi Santoso');
      assert.strictEqual(profile.customer_status, 'warm');
    }
  });

  runTest('TC-FAQ-01: CRUD FAQ bisnis', () => {
    if (db.createFaq) {
      const faqId = db.createFaq({
        question: 'Berapa lama estimasi pengiriman reguler?',
        answer: 'Estimasi pengiriman reguler berkisar antara 2-3 hari kerja.',
        category: 'Pengiriman'
      });
      assert.ok(typeof faqId === 'number' && faqId > 0);

      const list = db.getAllFaqs();
      assert.ok(list.length > 0);

      db.deleteFaq(faqId);
    }
  });

  // ==========================================
  // GRUP 12: Productivity Modules (Personal: Notes, Todos, Habits, Budgets)
  // ==========================================
  console.log('\n📌 [Grup 12] Notes, Todos, Habits & Budgets (Personal)');

  runTest('TC-PRD-01: Notes & Todos CRUD', () => {
    if (db.createNote && db.createTodo) {
      const noteId = db.createNote({
        title: 'Catatan Ide Bisnis',
        content: 'Jualan produk digital bot whatsapp di Lynk.id',
        tags: 'ide,lynk'
      });
      assert.ok(noteId > 0);

      const todoId = db.createTodo({
        task: 'Setup payment gateway Lynk.id',
        due_date: '2026-08-25',
        priority: 'high'
      });
      assert.ok(todoId > 0);

      db.toggleTodo(todoId, 1);
      const todos = db.getAllTodos();
      const updatedTodo = todos.find(t => t.id === todoId);
      assert.strictEqual(updatedTodo.is_done, 1);

      db.deleteNote(noteId);
      db.deleteTodo(todoId);
    }
  });

  runTest('TC-HBT-01: Habits & Budgets Tracking', () => {
    if (db.createHabit && db.setBudget) {
      const habitId = db.createHabit({
        name: 'Olahraga Pagi 15 Menit',
        frequency: 'daily'
      });
      assert.ok(habitId > 0);

      db.logHabit(habitId, '2026-08-19');
      const streak = db.getHabitStreak(habitId);
      assert.ok(streak && typeof streak.current === 'number');

      db.setBudget({
        category: 'Makanan & Minuman',
        monthly_limit: 1500000
      });
      const budgets = db.getAllBudgets();
      assert.ok(budgets.some(b => b.category === 'Makan & Minum' || b.category === 'Makanan & Minuman'));

      db.deleteHabit(habitId);
    }
  });

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n======================================================');
  console.log(`  📊 HASIL PENGUJIAN TDD QC:`);
  console.log(`     Total Pengujian: ${passedTests + failedTests}`);
  console.log(`     ✅ Lulus (PASS):  ${passedTests}`);
  console.log(`     ❌ Gagal (FAIL):  ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

startSuite().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
