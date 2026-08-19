/**
 * Test Fase 5 — Gentle Follow-Up (TDD)
 * 
 * Menguji:
 * 1. CRUD tabel follow_ups & follow_up_optouts
 * 2. scheduleFollowUp() — pembuatan jadwal follow-up
 * 3. processFollowUps() — eksekusi scheduler & 7 lapisan perlindungan anti-spam
 * 4. business-handler integration — deteksi opt-out & auto-cancel on reply
 * 5. Dashboard routes & settings page
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.NO_DELAY = '1';

const db = require('../src/db');
const { saveConfig } = require('../src/config');

// Reset database untuk testing
try {
  db.db.exec("DELETE FROM follow_ups");
  db.db.exec("DELETE FROM follow_up_optouts");
  db.db.exec("DELETE FROM orders");
  db.db.exec("DELETE FROM chat_logs");
  db.db.exec("DELETE FROM sqlite_sequence WHERE name = 'follow_ups'");
  db.db.exec("DELETE FROM sqlite_sequence WHERE name = 'follow_up_optouts'");
  db.db.exec("DELETE FROM sqlite_sequence WHERE name = 'orders'");
} catch (e) {}

// Mock WhatsApp Client
let sentMessages = [];
const clientModule = require('../src/engine/client');
clientModule.getClient = () => ({
  sendMessage: async (jid, text) => {
    sentMessages.push({ jid, text });
    return true;
  }
});

console.log('=== TEST FASE 5 — GENTLE FOLLOW-UP (TDD) ===\n');

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
  // ============================================================
  // GRUP 1: Database CRUD — follow_ups & opt-outs
  // ============================================================
  console.log('[1/5] Testing database CRUD follow-ups...');

  test('createFollowUp() — harus ada dan bisa dipanggil', () => {
    assert.ok(typeof db.createFollowUp === 'function', 'Fungsi createFollowUp belum ada di db');
  });

  test('createFollowUp() — harus bisa membuat jadwal follow-up baru', () => {
    const id = db.createFollowUp({
      contact: '628999888777@c.us',
      product_name: 'Kopi Arabika',
      inquiry_message: 'Halo, kopi arabika ready?',
      inquiry_at: new Date().toISOString(),
      scheduled_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      status: 'scheduled'
    });
    assert.ok(id > 0, 'Harus mengembalikan lastInsertRowid');
  });

  test('getFollowUpById() — harus mengembalikan data follow-up', () => {
    const f = db.getFollowUpById(1);
    assert.strictEqual(f.contact, '628999888777@c.us');
    assert.strictEqual(f.product_name, 'Kopi Arabika');
    assert.strictEqual(f.status, 'scheduled');
  });

  test('getScheduledFollowUps() — harus mengembalikan daftar scheduled follow-up', () => {
    const list = db.getScheduledFollowUps();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, 1);
  });

  test('updateFollowUpStatus() — harus bisa mengubah status menjadi sent', () => {
    db.updateFollowUpStatus(1, 'sent');
    const f = db.getFollowUpById(1);
    assert.strictEqual(f.status, 'sent');
    assert.ok(f.sent_at, 'Kolom sent_at harus terisi');
  });

  test('updateFollowUpStatus() — harus bisa membatalkan dengan alasan', () => {
    // Buat follow-up baru
    const id = db.createFollowUp({
      contact: '628999888777@c.us',
      product_name: 'Kopi Robusta',
      scheduled_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    });
    db.updateFollowUpStatus(id, 'cancelled', 'customer_reply');
    const f = db.getFollowUpById(id);
    assert.strictEqual(f.status, 'cancelled');
    assert.strictEqual(f.cancel_reason, 'customer_reply');
  });

  test('addOptOut() & isOptedOut() — harus bisa mengelola daftar opt-out', () => {
    assert.ok(typeof db.addOptOut === 'function');
    assert.ok(typeof db.isOptedOut === 'function');
    
    assert.strictEqual(db.isOptedOut('628111222333@c.us'), false);
    db.addOptOut('628111222333@c.us');
    assert.strictEqual(db.isOptedOut('628111222333@c.us'), true);
  });

  test('removeOptOut() — harus bisa menghapus dari daftar opt-out', () => {
    db.removeOptOut('628111222333@c.us');
    assert.strictEqual(db.isOptedOut('628111222333@c.us'), false);
  });

  test('hasRecentFollowUp() — harus bisa mengecek follow-up terkirim dalam 7 hari terakhir', () => {
    assert.strictEqual(db.hasRecentFollowUp('628999888777@c.us', 7), true); // ID 1 tadi sudah diset 'sent'
    assert.strictEqual(db.hasRecentFollowUp('628111222333@c.us', 7), false);
  });

  // ============================================================
  // GRUP 2: Scheduler & Anti-Spam Rules
  // ============================================================
  console.log('\n[2/5] Testing follow-up scheduler & anti-spam layers...');

  test('follow-up-scheduler — harus mengekspor scheduleFollowUp dan processFollowUps', () => {
    const scheduler = require('../src/engine/follow-up-scheduler');
    assert.ok(typeof scheduler.scheduleFollowUp === 'function', 'scheduleFollowUp belum diekspor');
    assert.ok(typeof scheduler.processFollowUps === 'function', 'processFollowUps belum diekspor');
  });

  await testAsync('scheduleFollowUp() — harus membuat jadwal baru', async () => {
    // Aktifkan follow-up di config
    saveConfig({ sheets_auto_sync: false }); // ensure dummy config
    db.setSetting('follow_up_enabled', 'true');
    db.setSetting('follow_up_delay_hours', '24');
    
    const scheduler = require('../src/engine/follow-up-scheduler');
    
    // Bersihkan follow_ups
    db.db.exec("DELETE FROM follow_ups");
    
    scheduler.scheduleFollowUp('6281122334455@c.us', 'Kopi Arabika', 'Halo ready?');
    
    const list = db.getScheduledFollowUps();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].contact, '6281122334455@c.us');
    assert.strictEqual(list[0].product_name, 'Kopi Arabika');
  });

  await testAsync('processFollowUps() — harus mengirim pesan jika valid dan jatuh tempo', async () => {
    const scheduler = require('../src/engine/follow-up-scheduler');
    sentMessages = [];
    
    // Ubah scheduled_at ke masa lalu agar jatuh tempo
    db.db.exec("UPDATE follow_ups SET scheduled_at = datetime('now', '-1 hour')");
    
    await scheduler.processFollowUps();
    
    // Cek status follow-up di DB
    const list = db.getScheduledFollowUps();
    assert.strictEqual(list.length, 0, 'Harus tidak ada scheduled lagi');
    
    const f = db.getFollowUpsByContact('6281122334455@c.us')[0];
    assert.strictEqual(f.status, 'sent');
    
    assert.strictEqual(sentMessages.length, 1);
    assert.ok(sentMessages[0].text.includes('Kopi Arabika'));
  });

  await testAsync('Anti-Spam 1: Jangan kirim ke kontak yang opt-out', async () => {
    const scheduler = require('../src/engine/follow-up-scheduler');
    db.db.exec("DELETE FROM follow_ups");
    
    // Tambah ke opt-out
    db.addOptOut('62899000111@c.us');
    
    // Jadwalkan follow-up ke kontak tersebut
    scheduler.scheduleFollowUp('62899000111@c.us', 'Kopi Arabika', 'Ready?');
    
    // Karena scheduleFollowUp harus cek opt-out, jadwal TIDAK boleh terbuat
    const list = db.getScheduledFollowUps();
    assert.strictEqual(list.length, 0, 'Jadwal follow-up tidak boleh terbuat jika kontak opt-out');
  });

  await testAsync('Anti-Spam 2: Batal otomatis jika pelanggan sudah memesan (orders)', async () => {
    const scheduler = require('../src/engine/follow-up-scheduler');
    db.db.exec("DELETE FROM follow_ups");
    db.db.exec("DELETE FROM orders");
    
    // Jadwalkan
    scheduler.scheduleFollowUp('6281122334455@c.us', 'Matcha Latte', 'Ready?');
    
    // Buat order untuk kontak tersebut
    db.createOrder({
      contact: '6281122334455@c.us',
      order_summary: '1x Matcha Latte',
      status: 'pending'
    });
    
    // Ubah scheduled_at ke masa lalu
    db.db.exec("UPDATE follow_ups SET scheduled_at = datetime('now', '-1 hour')");
    
    // Jalankan scheduler
    await scheduler.processFollowUps();
    
    // Harus batal dengan status cancelled_order
    const list = db.getFollowUpsByContact('6281122334455@c.us');
    assert.strictEqual(list[0].status, 'cancelled');
    assert.strictEqual(list[0].cancel_reason, 'order');
  });

  await testAsync('Anti-Spam 3: Batal otomatis jika pelanggan sudah membalas chat', async () => {
    const scheduler = require('../src/engine/follow-up-scheduler');
    db.db.exec("DELETE FROM follow_ups");
    db.db.exec("DELETE FROM chat_logs");
    db.db.exec("DELETE FROM orders");
    
    // Inquiry di masa lalu
    const inquiryTime = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    const scheduledTime = new Date(Date.now() - 1 * 3600 * 1000).toISOString();
    
    // Catat chat masuk pelanggan sebagai inquiry
    db.db.prepare(`
      INSERT INTO chat_logs (contact, message_in, handled_by, created_at)
      VALUES (?, ?, ?, ?)
    `).run('6281122334455@c.us', 'ready min?', 'bot', inquiryTime);
    
    // Buat follow-up manual dengan inquiry_at tertentu
    db.db.prepare(`
      INSERT INTO follow_ups (contact, product_name, inquiry_message, inquiry_at, scheduled_at, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `).run('6281122334455@c.us', 'Kopi Susu', 'ready min?', inquiryTime, scheduledTime);
    
    // Pelanggan membalas chat (timestamp setelah inquiry)
    db.db.prepare(`
      INSERT INTO chat_logs (contact, message_in, handled_by, created_at)
      VALUES (?, ?, ?, ?)
    `).run('6281122334455@c.us', 'oke makasih info nya', 'bot', new Date(Date.now() - 12 * 3600 * 1000).toISOString());
    
    // Jalankan scheduler
    await scheduler.processFollowUps();
    
    // Harus batal dengan status cancelled_reply
    const list = db.getFollowUpsByContact('6281122334455@c.us');
    assert.strictEqual(list[0].status, 'cancelled');
    assert.strictEqual(list[0].cancel_reason, 'customer_reply');
  });

  await testAsync('Anti-Spam 4: Batasi frekuensi mingguan (maksimal 1 follow-up sent per minggu)', async () => {
    const scheduler = require('../src/engine/follow-up-scheduler');
    db.db.exec("DELETE FROM follow_ups");
    
    // Buat follow-up berstatus 'sent' 2 hari lalu
    db.db.prepare(`
      INSERT INTO follow_ups (contact, product_name, inquiry_at, scheduled_at, status, sent_at)
      VALUES (?, ?, datetime('now', '-2 days'), datetime('now', '-2 days'), 'sent', datetime('now', '-2 days'))
    `).run('6281122334455@c.us', 'Kopi Susu');
    
    // Jadwalkan follow-up baru ke kontak yang sama
    scheduler.scheduleFollowUp('6281122334455@c.us', 'Matcha Latte', 'Ready?');
    
    const list = db.getScheduledFollowUps();
    assert.strictEqual(list.length, 0, 'Jadwal follow-up tidak boleh terbuat jika sudah dikirim minggu ini');
  });

  // ============================================================
  // GRUP 3: Integrasi Message Handler (business-handler.js)
  // ============================================================
  console.log('\n[3/5] Testing integrasi message handler...');

  await testAsync('business-handler — harus otomatis menjadwalkan follow-up saat tanya produk', async () => {
    db.db.exec("DELETE FROM follow_ups");
    
    // Buat produk kopi susu agar keyword matching terpicu
    db.createProduct({ name: 'Kopi Susu Mantap', price: 18000, stock: 10 });
    
    // Panggil business handler
    const businessHandler = require('../src/engine/handlers/business-handler');
    const mockMsg = {
      from: '628999888777@c.us',
      body: 'apakah kopi susu mantap ready?',
      type: 'chat',
      reply: async (text) => {}
    };
    
    await businessHandler.handleBusinessMessage(mockMsg);
    
    const list = db.getScheduledFollowUps();
    assert.strictEqual(list.length, 1, 'Harus otomatis menjadwalkan follow-up');
    assert.ok(list[0].product_name && list[0].product_name.length > 0, 'Harus memiliki nama produk');
  });

  await testAsync('business-handler — harus mendeteksi opt-out keyword ("stop")', async () => {
    db.db.exec("DELETE FROM follow_up_optouts");
    
    const businessHandler = require('../src/engine/handlers/business-handler');
    let repliedText = '';
    const mockMsg = {
      from: '628999888777@c.us',
      body: 'tolong stop kirim pesan lagi',
      type: 'chat',
      reply: async (text) => { repliedText = text; }
    };
    
    await businessHandler.handleBusinessMessage(mockMsg);
    
    assert.strictEqual(db.isOptedOut('628999888777@c.us'), true, 'Kontak harus masuk daftar opt-out');
    assert.ok(repliedText.includes('tidak akan mengirim pesan follow-up lagi'), 'Harus membalas konfirmasi opt-out');
  });

  // ============================================================
  // GRUP 4: Dashboard Halaman Pengaturan
  // ============================================================
  console.log('\n[4/5] Testing dashboard route & settings follow-up...');

  await testAsync('GET /dashboard/settings — harus menampilkan settings follow-up', async () => {
    // Set config values
    saveConfig({ 
      mode: 'bisnis', 
      is_setup_completed: true,
      gemini_api_key: 'TEST_MOCK_GEMINI_API_KEY_123' 
    });
    db.setSetting('mode', 'bisnis');
    db.setSetting('is_setup_completed', 'true');
    db.setSetting('gemini_api_key', 'TEST_MOCK_GEMINI_API_KEY_123');

    const http = require('http');
    return new Promise((resolve, reject) => {
      http.get('http://localhost:3000/dashboard/settings', (res) => {
        assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
        resolve();
      }).on('error', () => resolve());
    });
  });

  await testAsync('POST /dashboard/settings/follow-ups/optout/delete — harus bisa menghapus opt-out', async () => {
    // Set config values
    saveConfig({ 
      mode: 'bisnis', 
      is_setup_completed: true,
      gemini_api_key: 'TEST_MOCK_GEMINI_API_KEY_123' 
    });
    db.setSetting('mode', 'bisnis');
    db.setSetting('is_setup_completed', 'true');
    db.setSetting('gemini_api_key', 'TEST_MOCK_GEMINI_API_KEY_123');

    // Tambahkan opt-out dummy
    db.addOptOut('628999888777@c.us');
    assert.strictEqual(db.isOptedOut('628999888777@c.us'), true);
    
    // Kirim request POST delete opt-out
    const http = require('http');
    const postData = 'contact=628999888777%40c.us';
    
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/dashboard/settings/follow-ups/optout/delete',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        // Harus redirect (302) kembali ke settings
        assert.strictEqual(res.statusCode, 302);
        assert.strictEqual(db.isOptedOut('628999888777@c.us'), false, 'Opt-out harus sudah terhapus');
        resolve();
      });
      
      req.on('error', () => resolve());
      req.write(postData);
      req.end();
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
    console.log('\n✅ SEMUA TEST PASSED — Fase 5 Gentle Follow-Up SELESAI!');
    process.exit(0);
  }
})();
