/**
 * TDD Test Suite:
 * 1. Owner Remote Commands via WhatsApp (Unpause/Aktifkan, Jeda/Pause, Toggle Handover ON/OFF, Status/List)
 * 2. Natural Tone & Non-Repetitive Price Mention Prompt Guards
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.NO_DELAY = 'true';

const db = require('../src/db');
const { getConfig, updateConfig, saveConfig } = require('../src/config');
const { 
  isOwnerMessage, 
  handleOwnerCommand,
  parseOwnerCommand 
} = require('../src/engine/handlers/owner-command-handler');
const { isHandoverEnabled } = require('../src/engine/handlers/business-handler');
const { normalizePhoneNumber, toWhatsAppJid } = require('../src/utils/phone');

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

async function main() {
  console.log('\n======================================================');
  console.log('   🧪 MEMULAI TDD: OWNER REMOTE COMMANDS & NATURAL TONE');
  console.log('======================================================\n');

  const OWNER_PHONE = '082116973032';
  const OWNER_CLEAN = '6282116973032';
  const OWNER_JID = '6282116973032@c.us';

  const CUSTOMER_PHONE = '081234567890';
  const CUSTOMER_JID = '6281234567890@c.us';

  db.setSetting('owner_phone', OWNER_PHONE);
  db.setSetting('mode', 'bisnis');

  // ========================================================
  // GRUP 1: Owner Identification & Command Parser
  // ========================================================
  console.log('📌 [Grup 1] Owner Identification & Command Parser');

  runTest('TC-OWN-01: Mengenali pengirim sebagai Owner berdasarkan nomor konfigurasi', () => {
    assert.strictEqual(isOwnerMessage({ from: OWNER_JID, fromMe: false }), true);
    assert.strictEqual(isOwnerMessage({ from: '6282116973032@lid', fromMe: false }), true);
    assert.strictEqual(isOwnerMessage({ from: CUSTOMER_JID, fromMe: false }), false);
    assert.strictEqual(isOwnerMessage({ from: '628999999999@c.us', fromMe: true }), true); // fromMe is owner
  });

  runTest('TC-OWN-02: Parsing perintah !aktifkan, !unpause, !selesai dengan nomor target', () => {
    const cmd1 = parseOwnerCommand('!aktifkan 081234567890');
    assert.strictEqual(cmd1.action, 'unpause');
    assert.strictEqual(cmd1.targetNumber, '6281234567890');

    const cmd2 = parseOwnerCommand('!selesai 6281234567890');
    assert.strictEqual(cmd2.action, 'unpause');
    assert.strictEqual(cmd2.targetNumber, '6281234567890');

    const cmd3 = parseOwnerCommand('unpause 0812-3456-7890');
    assert.strictEqual(cmd3.action, 'unpause');
    assert.strictEqual(cmd3.targetNumber, '6281234567890');
  });

  runTest('TC-OWN-03: Parsing perintah !jeda / !pause dengan durasi jam', () => {
    const cmd1 = parseOwnerCommand('!jeda 081234567890');
    assert.strictEqual(cmd1.action, 'pause');
    assert.strictEqual(cmd1.targetNumber, '6281234567890');
    assert.strictEqual(cmd1.hours, 2);

    const cmd2 = parseOwnerCommand('!pause 081234567890 5');
    assert.strictEqual(cmd2.action, 'pause');
    assert.strictEqual(cmd2.targetNumber, '6281234567890');
    assert.strictEqual(cmd2.hours, 5);
  });

  runTest('TC-OWN-04: Parsing perintah toggle !handover on / off', () => {
    const cmd1 = parseOwnerCommand('!handover on');
    assert.strictEqual(cmd1.action, 'handover_toggle');
    assert.strictEqual(cmd1.enabled, true);

    const cmd2 = parseOwnerCommand('!handover off');
    assert.strictEqual(cmd2.action, 'handover_toggle');
    assert.strictEqual(cmd2.enabled, false);

    const cmd3 = parseOwnerCommand('handover nonaktif');
    assert.strictEqual(cmd3.action, 'handover_toggle');
    assert.strictEqual(cmd3.enabled, false);
  });

  // ========================================================
  // GRUP 2: Eksekusi Perintah Owner (Unpause, Pause, Handover Toggle)
  // ========================================================
  console.log('\n📌 [Grup 2] Eksekusi Perintah Owner di Database & Bot State');

  await runAsyncTest('TC-EXEC-01: Owner unpause / mengaktifkan bot untuk pelanggan yang sedang dijeda', async () => {
    // Jeda dulu kontak pelanggan dan buat tiket handover
    db.pauseContact(CUSTOMER_JID, 2, 'Nego Harga');
    db.createHandoverTicket({
      contact: CUSTOMER_JID,
      trigger_message: 'mahal banget 120k',
      reason: 'Permintaan Nego'
    });
    assert.strictEqual(db.isContactPaused(CUSTOMER_JID), true);

    // Mock client WhatsApp
    let replySent = '';
    const mockMessage = {
      from: OWNER_JID,
      body: '!aktifkan 081234567890',
      reply: async (text) => { replySent = text; }
    };
    const mockClient = {
      sendMessage: async (jid, text) => { replySent = text; }
    };

    const handled = await handleOwnerCommand(mockMessage, mockClient);
    assert.strictEqual(handled, true);
    assert.strictEqual(db.isContactPaused(CUSTOMER_JID), false, 'Kontak harus sudah unpause');
    assert.ok(replySent.includes('DIAKTIFKAN'), 'Pesan balasan harus mengonfirmasi pengaktifan');
    assert.ok(replySent.includes('6281234567890'), 'Pesan balasan harus memuat nomor kontak');
  });

  await runAsyncTest('TC-EXEC-02: Owner unpause tanpa argumen nomor saat hanya ada 1 kontak dijeda', async () => {
    db.pauseContact(CUSTOMER_JID, 2, 'Komplain');
    assert.strictEqual(db.isContactPaused(CUSTOMER_JID), true);

    let replySent = '';
    const mockMessage = {
      from: OWNER_JID,
      body: '!selesai',
      reply: async (text) => { replySent = text; }
    };
    const mockClient = { sendMessage: async (jid, text) => { replySent = text; } };

    const handled = await handleOwnerCommand(mockMessage, mockClient);
    assert.strictEqual(handled, true);
    assert.strictEqual(db.isContactPaused(CUSTOMER_JID), false);
    assert.ok(replySent.includes('DIAKTIFKAN') || replySent.includes('SELESAI'));
  });

  await runAsyncTest('TC-EXEC-03: Owner menjeda bot untuk nomor pelanggan tertentu via WA', async () => {
    db.resumeContact(CUSTOMER_JID);
    assert.strictEqual(db.isContactPaused(CUSTOMER_JID), false);

    let replySent = '';
    const mockMessage = {
      from: OWNER_JID,
      body: '!jeda 081234567890 3',
      reply: async (text) => { replySent = text; }
    };
    const mockClient = { sendMessage: async (jid, text) => { replySent = text; } };

    const handled = await handleOwnerCommand(mockMessage, mockClient);
    assert.strictEqual(handled, true);
    assert.strictEqual(db.isContactPaused(CUSTOMER_JID), true);
    assert.ok(replySent.includes('DIJEDA'));
    assert.ok(replySent.includes('3 jam'));
  });

  await runAsyncTest('TC-EXEC-04: Owner mengubah status toggle handover On / Off via WA', async () => {
    let replySent = '';
    const mockMessage = {
      from: OWNER_JID,
      body: '!handover off',
      reply: async (text) => { replySent = text; }
    };
    const mockClient = { sendMessage: async (jid, text) => { replySent = text; } };

    await handleOwnerCommand(mockMessage, mockClient);
    assert.strictEqual(isHandoverEnabled(), false);
    assert.ok(replySent.includes('DINONAKTIFKAN'));

    mockMessage.body = '!handover on';
    await handleOwnerCommand(mockMessage, mockClient);
    assert.strictEqual(isHandoverEnabled(), true);
    assert.ok(replySent.includes('DIAKTIFKAN'));
  });

  // ========================================================
  // GRUP 3: Prompt & Gaya Bahasa Anti-Spam Harga
  // ========================================================
  console.log('\n📌 [Grup 3] Prompt & Natural Tone Rules (Anti-Spam Harga)');

  runTest('TC-PRM-01: System Prompt Bisnis melarang pengulangan harga di percakapan lanjutan', () => {
    const promptPath = path.join(__dirname, '../src/ai/prompts/business/base.md');
    const promptContent = fs.readFileSync(promptPath, 'utf-8');

    assert.ok(
      promptContent.includes('DILARANG SPAM HARGA') || promptContent.includes('Penyebutan Produk & Harga yang Natural'),
      'Prompt harus memiliki aturan tegas anti-spam harga'
    );
    assert.ok(
      !promptContent.includes('Setiap menyebutkan produk, WAJIB sertakan harga'),
      'Prompt TIDAK boleh memaksa mencantumkan harga di setiap penyebutan nama produk'
    );
  });

  runTest('TC-PRM-02: System Prompt melarang upselling saat pengisian alamat atau minta rekening', () => {
    const promptPath = path.join(__dirname, '../src/ai/prompts/business/base.md');
    const promptContent = fs.readFileSync(promptPath, 'utf-8');

    assert.ok(
      promptContent.includes('DILARANG KERAS') || promptContent.includes('TIDAK memaksa'),
      'Prompt harus membatasi momen cross-selling agar tidak mengganggu transaksi'
    );
  });

  console.log('\n======================================================');
  console.log(`  📊 HASIL PENGUJIAN:`);
  console.log(`     Total Pengujian: ${passedTests + failedTests}`);
  console.log(`     ✅ Lulus (PASS):  ${passedTests}`);
  console.log(`     ❌ Gagal (FAIL):  ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
