/**
 * Test Enhancement Fixes (TDD Suite)
 * 
 * Menguji:
 * 1. Pencegahan False-Positive FAQ (Pesan "halo ka", "i want to ask", "aku ingin nanya ka" tidak boleh dijawab jam buka / ongkir)
 * 2. Deteksi Nego Harga & Transisi Handover ("20k dapet ga", "nego boleh ga", dll.)
 * 3. Respon Handover yang Ramah & Jeda Bot Otomatis
 * 4. Multi-Bubble Message Buffering & Output Splitting
 * 
 * Jalankan: node scripts/test-enhancement-fixes.js
 */

const assert = require('assert');
const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');

console.log('=== TEST ENHANCEMENT FIXES — AI CS, HANDOVER & MULTI-BUBBLE (TDD) ===\n');

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

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     -> ${err.message}`);
    failed++;
  }
}

(async () => {
  // Setup konfigurasi dasar
  saveConfig({
    mode: 'bisnis',
    business_name: 'Companion Coffee',
    owner_phone: '628123456789',
    customer_debounce_sec: 5,
    is_setup_completed: true
  });
  db.setSetting('mode', 'bisnis');
  db.setSetting('business_name', 'Companion Coffee');
  db.setSetting('owner_phone', '628123456789');

  // Bersihkan dan inisialisasi FAQ standar
  db.db.exec("DELETE FROM faqs");
  db.createFaq({
    trigger_keywords: 'jam buka,buka tutup,kapan buka,jam operasional',
    question_label: 'Jam Operasional',
    answer: 'Toko kami buka Senin-Sabtu, pukul 09:00-21:00 WIB. Minggu libur.',
    is_active: 1
  });
  db.createFaq({
    trigger_keywords: 'ongkir,ongkos kirim,biaya kirim,shipping',
    question_label: 'Ongkos Kirim',
    answer: 'Ongkir dihitung berdasarkan alamat Kakak. Gratis ongkir untuk area Jakarta!',
    is_active: 1
  });
  db.createFaq({
    trigger_keywords: 'nomor rekening,rekening transfer,bayar transfer',
    question_label: 'Rekening Pembayaran',
    answer: 'Pembayaran dapat ditransfer ke BCA 1234567890 a/n Companion Coffee.',
    is_active: 1
  });

  // ============================================================
  // GRUP 1: Pencegahan False-Positive Auto FAQ
  // ============================================================
  console.log('[1/4] Testing Auto FAQ Anti False-Positive (matchFaq)...');

  test('matchFaq("halo ka") — TIDAK boleh cocok dengan FAQ Jam Buka', () => {
    const res = db.matchFaq('halo ka');
    assert.strictEqual(res, null, `Seharusnya null, tetapi mencocokkan FAQ: ${res ? res.question_label : ''}`);
  });

  test('matchFaq("i want to ask") — TIDAK boleh cocok dengan FAQ Ongkos Kirim', () => {
    const res = db.matchFaq('i want to ask');
    assert.strictEqual(res, null, `Seharusnya null, tetapi mencocokkan FAQ: ${res ? res.question_label : ''}`);
  });

  test('matchFaq("aku ingin nanya ka") — TIDAK boleh cocok dengan FAQ Jam Buka', () => {
    const res = db.matchFaq('aku ingin nanya ka');
    assert.strictEqual(res, null, `Seharusnya null, tetapi mencocokkan FAQ: ${res ? res.question_label : ''}`);
  });

  test('matchFaq("halo min") — TIDAK boleh cocok dengan FAQ apapun', () => {
    const res = db.matchFaq('halo min');
    assert.strictEqual(res, null, `Seharusnya null, tetapi mencocokkan FAQ: ${res ? res.question_label : ''}`);
  });

  test('matchFaq("selamat pagi kak") — TIDAK boleh cocok dengan FAQ apapun', () => {
    const res = db.matchFaq('selamat pagi kak');
    assert.strictEqual(res, null, `Seharusnya null, tetapi mencocokkan FAQ: ${res ? res.question_label : ''}`);
  });

  test('matchFaq("toko buka jam berapa ya?") — HARUS cocok dengan FAQ Jam Operasional', () => {
    const res = db.matchFaq('toko buka jam berapa ya?');
    assert.ok(res, 'Harus menemukan FAQ');
    assert.strictEqual(res.question_label, 'Jam Operasional');
  });

  test('matchFaq("berapa ongkir ke bandung?") — HARUS cocok dengan FAQ Ongkos Kirim', () => {
    const res = db.matchFaq('berapa ongkir ke bandung?');
    assert.ok(res, 'Harus menemukan FAQ');
    assert.strictEqual(res.question_label, 'Ongkos Kirim');
  });

  test('matchFaq("minta nomor rekeningnya kak") — HARUS cocok dengan FAQ Rekening Pembayaran', () => {
    const res = db.matchFaq('minta nomor rekeningnya kak');
    assert.ok(res, 'Harus menemukan FAQ');
    assert.strictEqual(res.question_label, 'Rekening Pembayaran');
  });

  // ============================================================
  // GRUP 2: Deteksi Nego Harga & Handover Trigger
  // ============================================================
  console.log('\n[2/4] Testing deteksi negosiasi harga & kata kunci handover (isHandoverTriggered)...');

  const { isHandoverTriggered } = require('../src/engine/handlers/business-handler');

  test('isHandoverTriggered("20k dapet ga") — harus bernilai TRUE', () => {
    assert.strictEqual(isHandoverTriggered('20k dapet ga'), true);
  });

  test('isHandoverTriggered("pengen yang itu sih , tapi nego boleh ga") — harus bernilai TRUE', () => {
    assert.strictEqual(isHandoverTriggered('pengen yang itu sih , tapi nego boleh ga'), true);
  });

  test('isHandoverTriggered("bisa kurang dikit gak?") — harus bernilai TRUE', () => {
    assert.strictEqual(isHandoverTriggered('bisa kurang dikit gak?'), true);
  });

  test('isHandoverTriggered("25rb boleh gak kak?") — harus bernilai TRUE', () => {
    assert.strictEqual(isHandoverTriggered('25rb boleh gak kak?'), true);
  });

  test('isHandoverTriggered("nett nya berapa ya?") — harus bernilai TRUE', () => {
    assert.strictEqual(isHandoverTriggered('nett nya berapa ya?'), true);
  });

  test('isHandoverTriggered("pasnya berapa ya kak?") — harus bernilai TRUE', () => {
    assert.strictEqual(isHandoverTriggered('pasnya berapa ya kak?'), true);
  });

  test('isHandoverTriggered("bisa diskon gak?") — harus bernilai TRUE', () => {
    assert.strictEqual(isHandoverTriggered('bisa diskon gak?'), true);
  });

  test('isHandoverTriggered("kopi arabika ready gak?") — harus bernilai FALSE', () => {
    assert.strictEqual(isHandoverTriggered('kopi arabika ready gak?'), false);
  });

  test('isHandoverTriggered("lokasi tokonya di mana?") — harus bernilai FALSE', () => {
    assert.strictEqual(isHandoverTriggered('lokasi tokonya di mana?'), false);
  });

  // ============================================================
  // GRUP 3: Respon Transisi Handover di Message Handler
  // ============================================================
  console.log('\n[3/4] Testing respon transisi handover & integrasi message handler...');

  const { handleBusinessMessage } = require('../src/engine/handlers/business-handler');

  await testAsync('handleBusinessMessage("20k dapet ga") — harus merespon transisi handover, jeda bot & catat tiket', async () => {
    const contact = '6281199887766@c.us';
    db.unpauseContact(contact);
    db.db.exec("DELETE FROM manual_handovers");

    let replySent = '';
    let ownerNotified = '';
    const mockMessage = {
      from: contact,
      body: '20k dapet ga',
      type: 'chat',
      reply: async (text) => { replySent = text; }
    };
    const mockClient = {
      sendMessage: async (targetJid, text) => {
        if (targetJid.includes('628123456789')) {
          ownerNotified = text;
        }
      }
    };

    await handleBusinessMessage(mockMessage, mockClient);

    // 1. Respon ke pelanggan harus berisi konfirmasi transisi ke admin/owner
    assert.ok(replySent, 'Harus ada balasan ke pelanggan');
    assert.ok(
      replySent.toLowerCase().includes('admin') || 
      replySent.toLowerCase().includes('owner') || 
      replySent.toLowerCase().includes('diteruskan'),
      `Balasan harus memuat transisi admin, didapat: "${replySent}"`
    );
    assert.ok(
      replySent.toLowerCase().includes('tunggu') || replySent.toLowerCase().includes('sebentar'),
      `Balasan harus meminta pelanggan menunggu, didapat: "${replySent}"`
    );

    // 2. Kontak harus otomatis dijeda (paused)
    assert.strictEqual(db.isContactPaused(contact), true, 'Kontak harus dalam status paused');

    // 3. Tiket antrean harus masuk ke tabel manual_handovers
    const pendingHandovers = db.getAllHandovers ? db.getAllHandovers('pending') : [];
    assert.ok(pendingHandovers.length > 0, 'Harus ada tiket handover yang tercatat');
    assert.strictEqual(pendingHandovers[0].contact, contact);

    // 4. Owner harus mendapatkan notifikasi via WA
    assert.ok(ownerNotified.includes('NOTIFIKASI HANDOVER'), 'Owner harus menerima notifikasi WhatsApp');
  });

  await testAsync('handleBusinessMessage("pengen yang itu sih , tapi nego boleh ga") — harus merespon transisi handover', async () => {
    const contact = '6281155443322@c.us';
    db.unpauseContact(contact);

    let replySent = '';
    const mockMessage = {
      from: contact,
      body: 'pengen yang itu sih , tapi nego boleh ga',
      type: 'chat',
      reply: async (text) => { replySent = text; }
    };
    const mockClient = {
      sendMessage: async () => {}
    };

    await handleBusinessMessage(mockMessage, mockClient);

    assert.ok(replySent, 'Harus ada balasan ke pelanggan');
    assert.ok(
      replySent.toLowerCase().includes('admin') || 
      replySent.toLowerCase().includes('owner') || 
      replySent.toLowerCase().includes('diteruskan'),
      `Balasan harus memuat transisi admin, didapat: "${replySent}"`
    );
    assert.strictEqual(db.isContactPaused(contact), true, 'Kontak harus dijeda');
  });

  // ============================================================
  // GRUP 4: Multi-Bubble Buffering & Splitting
  // ============================================================
  console.log('\n[4/4] Testing multi-bubble input aggregation & output splitting...');

  const { enqueueIncomingMessage, clearAllBuffers } = require('../src/engine/message-buffer');
  const { splitIntoBubbles } = require('../src/engine/bubble-sender');

  await testAsync('Multi-bubble Input: 2 chat berturut-turut harus digabung jadi 1 pesan utuh', async () => {
    clearAllBuffers();
    const contact = '6281177665544@c.us';
    let processedBatch = null;

    const onBatchReady = async (aggregatedMsg) => {
      processedBatch = aggregatedMsg;
    };

    const msg1 = { from: contact, body: 'halo kak' };
    const msg2 = { from: contact, body: 'kopi arabika 250gr ready gak ya?' };

    // Enqueue pesan 1 dengan debounce 80ms
    enqueueIncomingMessage(msg1, null, onBatchReady, 80);

    // Enqueue pesan 2 setelah 20ms (sebelum debounce selesai)
    await new Promise(r => setTimeout(r, 20));
    enqueueIncomingMessage(msg2, null, onBatchReady, 80);

    // Tunggu debounce selesai
    await new Promise(r => setTimeout(r, 120));

    assert.ok(processedBatch, 'Batch pesan harus selesai diproses');
    assert.strictEqual(processedBatch.isAggregated, true, 'isAggregated harus true');
    assert.strictEqual(processedBatch.bubbleCount, 2, 'bubbleCount harus 2');
    assert.strictEqual(
      processedBatch.body,
      'halo kak\nkopi arabika 250gr ready gak ya?',
      'Pesan harus digabung dengan baris baru'
    );
  });

  test('splitIntoBubbles() — pesan pendek (<250 char) harus tetap 1 bubble', () => {
    const text = 'Halo Kak! Kopi Arabika kami ready stok ya. Harganya Rp25.000 untuk kemasan 250gr.';
    const bubbles = splitIntoBubbles(text, 3);
    assert.strictEqual(bubbles.length, 1);
    assert.strictEqual(bubbles[0], text);
  });

  test('splitIntoBubbles() — pesan panjang dengan paragraf harus dipecah menjadi 2-3 bubble alami', () => {
    const longText = 'Halo Kak! Selamat datang di Companion Coffee. Kami punya beberapa varian kopi single origin pilihan terbaik yang baru saja di-roasting minggu ini.\n\nUntuk Kopi Arabika Gayo tersedia dalam kemasan 250gr (Rp45.000) dan 500gr (Rp85.000). Karakternya fruity dengan aroma floral yang sangat harum.\n\nKakak mau kami siapkan yang kemasan 250gr atau 500gr? Bisa langsung kami bantu proseskan ya Kak 😊';
    const bubbles = splitIntoBubbles(longText, 3);
    assert.ok(bubbles.length >= 2, `Pesan panjang harus dipecah minimal 2 bubble, dapat ${bubbles.length}`);
  });

  // ============================================================
  // RINGKASAN
  // ============================================================
  console.log(`\n${'='.repeat(60)}`);
  console.log(`HASIL: ${passed} passed, ${failed} failed (total: ${passed + failed})`);
  console.log(`${'='.repeat(60)}`);

  if (failed > 0) {
    console.log('\n⚠️  Ada test yang GAGAL — ini EXPECTED untuk TDD step RED.');
    process.exit(1);
  } else {
    console.log('\n✅ SEMUA TEST PASSED — Perbaikan Selesai (GREEN State)!');
    process.exit(0);
  }
})();
