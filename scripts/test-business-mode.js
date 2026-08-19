process.env.NODE_ENV = 'test';
process.env.NO_DELAY = '1';
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');

console.log('=== MEMULAI PENGUJIAN TDD: FITUR MODE BISNIS (FASE 5) ===\n');

async function runBusinessTddTests() {
  let failed = false;

  // Setup sample product in database for testing
  let testProductId;
  try {
    const existing = db.searchProducts('Espresso TDD');
    if (existing.length === 0) {
      testProductId = db.createProduct({
        name: 'Espresso TDD Blend',
        price: 25000,
        stock: 15,
        description: 'Kopi blend arabika robusta premium',
        image_path: path.resolve(__dirname, '../assets/mockups/sample.jpg')
      });
    }
  } catch (e) {}

  // Test 1: Business Handler Module Exists & Handles Message
  console.log('[Test 1/4] Memeriksa Business Handler (src/engine/handlers/business-handler.js)...');
  try {
    const { handleBusinessMessage, isHandoverTriggered } = require('../src/engine/handlers/business-handler');
    assert.strictEqual(typeof handleBusinessMessage, 'function', 'handleBusinessMessage harus berupa fungsi');
    assert.strictEqual(typeof isHandoverTriggered, 'function', 'isHandoverTriggered harus berupa fungsi');
    console.log('  -> OK: Modul Business Handler terdefinisi dengan benar.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 1:', err.message);
    failed = true;
  }

  // Test 2: Human Handover Trigger Logic
  console.log('\n[Test 2/4] Memeriksa Deteksi Human Handover (Komplain / Nego / Ragu)...');
  try {
    const { isHandoverTriggered } = require('../src/engine/handlers/business-handler');
    
    const complainMsg = 'Min barang saya sampai dalam kondisi rusak dan pecah, saya mau komplain!';
    const negoMsg = 'Bisa nego diskon 50% gak min kalau beli 10?';
    const normalMsg = 'Apakah Espresso TDD Blend masih ada stok?';

    assert.strictEqual(isHandoverTriggered(complainMsg, false), true, 'Pesan komplain harus memicu handover');
    assert.strictEqual(isHandoverTriggered(negoMsg, false), true, 'Pesan nego harus memicu handover');
    assert.strictEqual(isHandoverTriggered(normalMsg, false), false, 'Pesan tanya stok biasa tidak boleh memicu handover');
    assert.strictEqual(isHandoverTriggered(normalMsg, true), true, 'Flag AI handover harus memicu handover');
    console.log('  -> OK: Logika deteksi human handover akurat.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 2:', err.message);
    failed = true;
  }

  // Test 3: Business Message End-to-End Processing & Chat Log Storage
  console.log('\n[Test 3/4] Memeriksa Pemrosesan Pesan Bisnis & Pencatatan Chat Log...');
  try {
    const { handleBusinessMessage } = require('../src/engine/handlers/business-handler');

    let replySent = null;
    let mediaSent = null;
    let ownerNotified = null;

    // Mock WhatsApp message object
    const mockMsg = {
      from: '628111222333@c.us',
      body: 'Halo kak, Espresso TDD Blend harganya berapa dan ada stok?',
      type: 'chat',
      reply: async (text) => {
        replySent = text;
        return true;
      }
    };

    // Mock WhatsApp client
    const mockClient = {
      sendMessage: async (to, content, options) => {
        if (typeof content === 'string' && content.includes('[NOTIFIKASI HANDOVER]')) {
          ownerNotified = { to, content };
        } else {
          mediaSent = { to, content, options };
        }
        return true;
      }
    };

    const initialLogCount = db.getAllChatLogs(100, 0).length;

    await handleBusinessMessage(mockMsg, mockClient);

    assert.ok(replySent, 'Balasan teks harus terkirim ke pengguna');
    assert.ok(typeof replySent === 'string', 'Balasan teks harus berupa string');

    const newLogs = db.getAllChatLogs(100, 0);
    assert.strictEqual(newLogs.length, initialLogCount + 1, 'Chat log harus bertambah 1 entri di database');
    
    const latestLog = newLogs[0];
    assert.strictEqual(latestLog.contact, '628111222333@c.us');
    assert.strictEqual(latestLog.message_in, mockMsg.body);
    assert.strictEqual(latestLog.message_out, replySent);
    console.log('  -> OK: Balasan terkirim dan chat log tersimpan di DB:', {
      contact: latestLog.contact,
      handledBy: latestLog.handled_by,
      message_out: latestLog.message_out.substring(0, 50) + '...'
    });
  } catch (err) {
    console.error('  ❌ Gagal pada Test 3:', err.message);
    failed = true;
  }

  // Test 4: Message Handler Integration with Mode Routing
  console.log('\n[Test 4/4] Memeriksa Routing Message Handler (src/engine/handlers/message-handler.js)...');
  try {
    const { handleIncomingMessage } = require('../src/engine/handlers/message-handler');
    assert.strictEqual(typeof handleIncomingMessage, 'function');
    
    saveConfig({ mode: 'bisnis' });
    db.setSetting('mode', 'bisnis');

    let replyCalled = false;
    const mockMsg = {
      from: '628999000111@c.us',
      body: 'Tes stok produk',
      type: 'chat',
      reply: async (text) => {
        replyCalled = true;
      }
    };

    await handleIncomingMessage(mockMsg, { sendMessage: async () => {} });
    
    // Tunggu antrean debounce buffer & panggilan API selesai diproses
    const startTime = Date.now();
    while (!replyCalled && Date.now() - startTime < 12000) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    assert.strictEqual(replyCalled, true, 'handleIncomingMessage harus memanggil reply saat mode bisnis');
    console.log('  -> OK: Message Handler meneruskan pesan ke alur Mode Bisnis secara otomatis.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 4:', err.message);
    failed = true;
  }

  if (failed) {
    console.log('\n❌ STATUS TDD: RED (Implementasi Mode Bisnis belum lengkap)');
    process.exitCode = 1;
  } else {
    console.log('\n✅ STATUS TDD: GREEN (Fitur Mode Bisnis Lulus Pengujian 100%)');
    process.exitCode = 0;
  }
}

runBusinessTddTests();
