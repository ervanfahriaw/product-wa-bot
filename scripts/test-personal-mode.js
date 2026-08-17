const assert = require('assert');
const path = require('path');
const fs = require('fs');

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');

console.log('=== MEMULAI PENGUJIAN TDD: FITUR MODE PERSONAL (FASE 6) ===\n');

async function runPersonalTddTests() {
  let failed = false;

  // Test 1: Personal Handler & Parsing Logic Exists
  console.log('[Test 1/5] Memeriksa Modul Personal Handler & Parser (src/engine/handlers/personal-handler.js)...');
  try {
    const { handlePersonalMessage, extractExpenseFromText, parseAiIntent } = require('../src/engine/handlers/personal-handler');
    assert.strictEqual(typeof handlePersonalMessage, 'function', 'handlePersonalMessage harus berupa fungsi');
    assert.strictEqual(typeof extractExpenseFromText, 'function', 'extractExpenseFromText harus berupa fungsi');
    assert.strictEqual(typeof parseAiIntent, 'function', 'parseAiIntent harus berupa fungsi');

    // Test text extraction fallback
    const parsed1 = extractExpenseFromText('Beli kopi 25rb');
    assert.ok(parsed1, 'Harus bisa mengekstrak pengeluaran dari kalimat');
    assert.strictEqual(parsed1.amount, 25000, 'Jumlah harus 25000');

    const parsed2 = extractExpenseFromText('Bensin 50k');
    assert.ok(parsed2);
    assert.strictEqual(parsed2.amount, 50000, 'Jumlah 50k harus 50000');

    console.log('  -> OK: Modul Personal Handler & parser teks terdefinisi.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 1:', err.message);
    failed = true;
  }

  // Test 2: Expense Creation and Confirmation Flow
  console.log('\n[Test 2/5] Memeriksa Alur Pencatatan Pengeluaran & Pesan Konfirmasi...');
  try {
    const { handlePersonalMessage } = require('../src/engine/handlers/personal-handler');
    
    let replySent = null;
    const mockMsg = {
      from: '628555666777@c.us',
      body: 'Tadi makan siang nasi padang 35000',
      type: 'chat',
      reply: async (text) => {
        replySent = text;
        return true;
      }
    };

    const mockClient = {
      sendMessage: async () => true
    };

    const initialExpenses = db.getAllExpenses();
    await handlePersonalMessage(mockMsg, mockClient);

    const afterExpenses = db.getAllExpenses();
    assert.strictEqual(afterExpenses.length, initialExpenses.length + 1, 'Pengeluaran harus bertambah 1 di DB');

    const latest = afterExpenses[0];
    assert.strictEqual(latest.amount, 35000, 'Nominal pengeluaran harus 35000');
    assert.ok(replySent, 'Harus ada pesan konfirmasi yang dikirim ke user');
    assert.ok(replySent.toLowerCase().includes('35.000') || replySent.toLowerCase().includes('dicatat') || replySent.toLowerCase().includes('makan'),
      'Balasan harus memuat konfirmasi pencatatan');

    console.log('  -> OK: Pengeluaran tercatat di database dan konfirmasi terkirim:', {
      category: latest.category,
      amount: latest.amount,
      note: latest.note,
      reply: replySent
    });
  } catch (err) {
    console.error('  ❌ Gagal pada Test 2:', err.message);
    failed = true;
  }

  // Test 3: On-Demand Rekapitulasi
  console.log('\n[Test 3/5] Memeriksa Fitur Rekap Pengeluaran On-Demand...');
  try {
    const { handlePersonalMessage } = require('../src/engine/handlers/personal-handler');

    let replySent = null;
    const mockMsg = {
      from: '628555666777@c.us',
      body: 'Min tolong berikan rekap pengeluaran saya bulan ini',
      type: 'chat',
      reply: async (text) => {
        replySent = text;
        return true;
      }
    };

    await handlePersonalMessage(mockMsg, { sendMessage: async () => {} });
    assert.ok(replySent, 'Harus ada balasan rekap yang dikirim');
    console.log('  -> OK: Rekap on-demand berhasil dihasilkan:', replySent.substring(0, 80) + '...');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 3:', err.message);
    failed = true;
  }

  // Test 4: Reminder Scheduler Module
  console.log('\n[Test 4/5] Memeriksa Modul Reminder Scheduler (src/engine/reminder-scheduler.js)...');
  try {
    const { checkAndSendReminders, startReminderScheduler, stopReminderScheduler } = require('../src/engine/reminder-scheduler');
    assert.strictEqual(typeof checkAndSendReminders, 'function');
    assert.strictEqual(typeof startReminderScheduler, 'function');
    assert.strictEqual(typeof stopReminderScheduler, 'function');

    // Insert dummy reminder with past trigger_at
    const reminderId = db.createReminder({
      message: 'Ingat minum vitamin C harian',
      trigger_at: new Date(Date.now() - 60000).toISOString(),
      is_recurring: 0,
      sent: 0
    });

    let sentReminder = null;
    const mockClient = {
      sendMessage: async (to, text) => {
        sentReminder = { to, text };
        return true;
      }
    };

    saveConfig({ owner_phone: '628123456789' });
    await checkAndSendReminders(mockClient);

    const checked = db.getReminderById(reminderId);
    assert.strictEqual(checked.sent, 1, 'Reminder harus ditandai sebagai sent=1 setelah terkirim');
    assert.ok(sentReminder, 'Reminder harus dikirim melalui sendMessage');
    console.log('  -> OK: Reminder scheduler memproses dan mengirim reminder:', sentReminder);
  } catch (err) {
    console.error('  ❌ Gagal pada Test 4:', err.message);
    failed = true;
  }

  // Test 5: Message Handler Routing for Personal Mode
  console.log('\n[Test 5/5] Memeriksa Routing Message Handler saat Mode Personal...');
  try {
    const { handleIncomingMessage } = require('../src/engine/handlers/message-handler');
    
    saveConfig({ mode: 'personal' });
    db.setSetting('mode', 'personal');

    let replyCalled = false;
    const mockMsg = {
      from: '628555666777@c.us',
      body: 'Beli bensin 25rb',
      type: 'chat',
      reply: async (text) => {
        replyCalled = true;
      }
    };

    await handleIncomingMessage(mockMsg, { sendMessage: async () => {} });
    assert.strictEqual(replyCalled, true, 'handleIncomingMessage harus memanggil reply saat mode personal');
    console.log('  -> OK: Message Handler meneruskan pesan ke alur Mode Personal secara otomatis.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 5:', err.message);
    failed = true;
  }

  if (failed) {
    console.log('\n❌ STATUS TDD: RED (Implementasi Mode Personal belum lengkap)');
    process.exit(1);
  } else {
    console.log('\n✅ STATUS TDD: GREEN (Fitur Mode Personal Lulus Pengujian 100%)');
    process.exit(0);
  }
}

runPersonalTddTests();
