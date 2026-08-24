/**
 * TDD Test Suite: Customer Order Form Submission & Anti-FAQ Conflict
 * 
 * Menguji:
 * 1. Pencegahan konflik FAQ: matchFaq() tidak boleh menembakkan FAQ lokasi toko saat pelanggan kirim format order
 * 2. Eksekusi `handleCustomerOrderSubmission`: mencatat order ke database, update CRM profil pelanggan
 * 3. Notifikasi order baru otomatis ke WhatsApp Owner
 * 4. Balasan konfirmasi ramah & ringkasan pesanan ke pelanggan (tanpa meminta isi ulang & tanpa spam alamat toko)
 * 5. Penguatan few-shot training dialog di context builder
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');
const { matchFaq } = require('../src/db/queries/faqs');
const { handleCustomerOrderSubmission, isCustomerOrderForm } = require('../src/engine/handlers/order-submission-handler');
const { buildFewShotSamplesContext } = require('../src/ai/context-builder');

console.log('======================================================');
console.log('   TDD TEST: CUSTOMER ORDER SUBMISSION & ANTI-FAQ     ');
console.log('======================================================\n');

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

async function asyncTest(name, fn) {
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

async function runAllTests() {
  const sampleCustomerMessage = `- Nama Penerima: jono\n- Alamat Lengkap: tebet, jakarta selatan\n- No. HP: 082116973032\n- Pesanan & Jumlah: 1 pasang afr`;

  // ============================================================
  // GRUP 1: Deteksi Order Form & Anti-FAQ Conflict
  // ============================================================
  console.log('[1/4] Testing Deteksi Order Form & Anti-FAQ Conflict...');

  test('isCustomerOrderForm() — harus mengenali format order yang diisi pelanggan', () => {
    assert.strictEqual(isCustomerOrderForm(sampleCustomerMessage), true);
    assert.strictEqual(isCustomerOrderForm('halo kak mau tanya harga'), false);
  });

  test('matchFaq() — TIDAK BOLEH memicu FAQ lokasi toko saat pelanggan kirim format order', () => {
    // Pastikan ada FAQ lokasi toko di DB
    db.createFaq({
      question_label: 'Lokasi Markas',
      trigger_keywords: 'alamat, lokasi, markas, bojongsoang',
      answer: 'LOKASI MARKAS TENTANG GUPPY 📍'
    });

    const match = matchFaq(sampleCustomerMessage);
    assert.strictEqual(match, null, 'matchFaq harus return null untuk pesan form order');
  });

  // ============================================================
  // GRUP 2: Penanganan Form Order Pelanggan
  // ============================================================
  console.log('\n[2/4] Testing Eksekusi handleCustomerOrderSubmission()...');

  await asyncTest('handleCustomerOrderSubmission() — mencatat order di DB dan membalas konfirmasi ke pelanggan & notifikasi owner', async () => {
    db.setSetting('owner_phone', '081321435462');
    saveConfig({ owner_phone: '081321435462' });

    let replyText = '';
    let ownerNotificationText = '';
    let ownerJid = '';

    const mockMessage = {
      from: '6282116973032@c.us',
      body: sampleCustomerMessage,
      reply: async (msg) => {
        replyText = msg;
      }
    };

    const mockClient = {
      sendMessage: async (jid, msg) => {
        ownerJid = jid;
        ownerNotificationText = msg;
      }
    };

    const handled = await handleCustomerOrderSubmission(mockMessage, mockClient);
    assert.strictEqual(handled, true, 'Harus berhasil diproses sebagai order');
    
    // Cek balasan ke pelanggan
    assert.ok(replyText.includes('jono'), 'Balasan harus menyebut nama jono');
    assert.ok(replyText.includes('tebet, jakarta selatan') || replyText.includes('tebet'), 'Balasan harus menyebut alamat');
    assert.ok(replyText.includes('1 pasang afr'), 'Balasan harus menyebutkan pesanan');
    assert.ok(replyText.includes('ongkos kirim') || replyText.includes('ongkir'), 'Balasan harus menyebut cek ongkir');
    assert.ok(!replyText.includes('LOKASI MARKAS'), 'Balasan TIDAK BOLEH memuat spam lokasi toko');
    assert.ok(!replyText.includes('Boleh tolong dibantu isi format'), 'Balasan TIDAK BOLEH meminta isi format lagi');

    // Cek notifikasi ke WhatsApp Owner
    assert.strictEqual(ownerJid, '6281321435462@c.us', 'Owner harus menerima notifikasi');
    assert.ok(ownerNotificationText.includes('PESANAN BARU'), 'Notifikasi owner harus memuat judul order baru');
    assert.ok(ownerNotificationText.includes('jono'), 'Notifikasi owner harus memuat nama pemesan');

    // Cek database
    const orders = db.getOrdersByContact('6282116973032@c.us');
    assert.ok(orders.length > 0, 'Order harus tersimpan di database');
    assert.strictEqual(orders[0].customer_name, 'jono');
  });

  // ============================================================
  // GRUP 3: Verifikasi Aturan di System Prompt base.md
  // ============================================================
  console.log('\n[3/4] Testing Aturan Pemesanan di base.md...');

  test('base.md — harus memuat instruksi anti-spam lokasi dan larangan meminta ulang form pemesanan', () => {
    const baseMdPath = path.resolve(__dirname, '../src/ai/prompts/business/base.md');
    const content = fs.readFileSync(baseMdPath, 'utf-8');

    assert.ok(
      content.includes('Mengisi Format Pemesanan') || content.includes('format pemesanan') || content.includes('data pemesanan'),
      'base.md harus mengatur penanganan format pesanan yang sudah diisi'
    );
    assert.ok(
      content.includes('DILARANG') && (content.includes('mengulang format') || content.includes('mengisi ulang') || content.includes('lokasi toko')),
      'base.md harus melarang spam lokasi dan larangan meminta ulang form'
    );
  });

  // ============================================================
  // GRUP 4: Penguatan Few-Shot Training Prompt di Context Builder
  // ============================================================
  console.log('\n[4/4] Testing Few-Shot Training Context Builder...');

  test('buildFewShotSamplesContext() — harus memberikan instruksi prioritas gaya dan solusi tawaran custom', () => {
    db.createSample({
      user_sample: 'nego boleh ?',
      bot_sample: 'waduh gabisa kak , paling nanti saya bonusin gimana hehe , sama nanti aku pandu penuh cara perawatannya dah',
      tag: 'nego'
    });

    const ctx = buildFewShotSamplesContext();
    assert.ok(ctx.includes('FEW-SHOT TRAINING'), 'Harus ada header few shot');
    assert.ok(ctx.includes('waduh gabisa kak'), 'Harus menyertakan contoh balasan toko');
    assert.ok(
      ctx.includes('prioritaskan') || ctx.includes('Ikuti') || ctx.includes('solusi'),
      'Harus menginstruksikan AI mengikuti gaya dan solusi dari contoh training'
    );
  });

  console.log('\n======================================================');
  console.log(`HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
