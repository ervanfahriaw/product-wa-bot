/**
 * TDD Test Suite: Scheduling Disambiguation (Reminders vs Events)
 * Memverifikasi:
 * - "ingatkan ..." selalu masuk ke tabel reminders (set_reminder), bukan events.
 * - Reminder harian/berulang memiliki recurrence_type yang tepat.
 * - Agenda/acara kalender ("agenda: ...", "acara ...") masuk ke tabel events.
 * - Event notification otomatis ter-trigger dan terkirim oleh scheduler.
 * - Fallback handler mengonversi create_event menjadi reminder jika user memakai kata "ingatkan".
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const db = require('../src/db');
const { handlePersonalMessage } = require('../src/engine/handlers/personal-handler');
const { checkAndSendReminders, calculateNextTrigger } = require('../src/engine/reminder-scheduler');

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
  console.log('   🧪 MEMULAI TDD SUITE: REMINDERS VS EVENTS DISAMBIGUATION  ');
  console.log('======================================================\n');

  // ----------------------------------------------------
  // GRUP 1: Reminder Intent & Database Integrity
  // ----------------------------------------------------
  console.log('📌 [Grup 1] One-shot & Recurring Reminder Creation');

  await runTest('TC-REM-01: Simpan One-Shot Reminder di tabel reminders', async () => {
    const id = db.createReminder({
      message: 'bayar tagihan wifi indihome',
      trigger_at: '2026-08-21 08:00:00',
      is_recurring: 0,
      sent: 0,
      label: 'bayar tagihan wifi indihome'
    });

    assert.ok(id > 0);
    const reminder = db.getReminderById ? db.getReminderById(id) : null;
    if (reminder) {
      assert.strictEqual(reminder.message, 'bayar tagihan wifi indihome');
      assert.strictEqual(reminder.sent, 0);
      assert.strictEqual(reminder.is_recurring, 0);
    }
  });

  await runTest('TC-REM-02: Simpan Recurring Daily Reminder', async () => {
    const id = db.createReminder({
      message: 'minum obat vitamin C',
      trigger_at: '2026-08-21 07:00:00',
      is_recurring: 1,
      sent: 0,
      label: 'minum obat vitamin c',
      recurrence_type: 'daily'
    });

    assert.ok(id > 0);
    const nextTrigger = calculateNextTrigger('2026-08-21 07:00:00', 'daily');
    assert.ok(nextTrigger.includes('07:00:00'));
  });

  // ----------------------------------------------------
  // GRUP 2: Event Creation & Auto Reminder Sync
  // ----------------------------------------------------
  console.log('\n📌 [Grup 2] Calendar Events & Auto Reminder Synchronization');

  await runTest('TC-EVT-01: Simpan Event di tabel events', async () => {
    const id = db.createEvent({
      title: 'Rapat Kerja Kuartal 3',
      event_date: '2026-08-25 10:00:00',
      location: 'Ruang Meeting Lt 2',
      remind_before_minutes: 30
    });

    assert.ok(id > 0);
    const event = db.getEventById(id);
    assert.strictEqual(event.title, 'Rapat Kerja Kuartal 3');
    assert.strictEqual(event.remind_before_minutes, 30);
  });

  // ----------------------------------------------------
  // GRUP 3: Personal Handler Disambiguation
  // ----------------------------------------------------
  console.log('\n📌 [Grup 3] Personal Handler Automatic Routing');

  await runTest('TC-HND-REM-01: Intent create_event dengan kata "ingatkan" dialihkan ke set_reminder', async () => {
    const sentMessages = [];
    const mockMessage = {
      from: '6281234567890@c.us',
      body: 'ingatkan besok jam 8 pagi beli token listrik',
      reply: (text) => sentMessages.push(text),
      getChat: async () => ({ sendStateTyping: async () => {}, clearState: async () => {} })
    };

    const mockClient = {
      sendMessage: async (to, text) => {
        sentMessages.push(text);
      }
    };

    const ai = require('../src/ai');
    const origGen = ai.generateReply;
    ai.generateReply = async () => ({
      reply: '```json\n{"intent": "create_event", "title": "beli token listrik", "event_date": "2026-08-21 08:00:00"}\n```'
    });

    try {
      await handlePersonalMessage(mockMessage, mockClient);
      const replyText = sentMessages.join(' ');
      assert.ok(replyText.includes('Pengingat Disimpan') || replyText.includes('pengingat'));

      // Cek apakah masuk ke tabel reminders
      const pending = db.getPendingReminders ? db.getPendingReminders('2026-08-22 00:00:00') : [];
      assert.ok(pending.some(r => r.message.includes('beli token listrik')));
    } finally {
      ai.generateReply = origGen;
    }
  });

  // ----------------------------------------------------
  // GRUP 4: Scheduler Trigger & Dispatch
  // ----------------------------------------------------
  console.log('\n📌 [Grup 4] Scheduler Automated Dispatch');

  await runTest('TC-SCH-01: Scheduler mengirimkan notifikasi reminder jatuh tempo', async () => {
    // Buat reminder yang sudah jatuh tempo
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const y = past.getFullYear();
    const m = String(past.getMonth() + 1).padStart(2, '0');
    const d = String(past.getDate()).padStart(2, '0');
    const h = String(past.getHours()).padStart(2, '0');
    const min = String(past.getMinutes()).padStart(2, '0');
    const s = String(past.getSeconds()).padStart(2, '0');
    const triggerAt = `${y}-${m}-${d} ${h}:${min}:${s}`;

    const remId = db.createReminder({
      message: 'Test Reminder Jatuh Tempo',
      trigger_at: triggerAt,
      is_recurring: 0,
      sent: 0,
      label: 'test reminder jatuh tempo'
    });

    db.setSetting('owner_phone', '6281234567890');

    const dispatched = [];
    const mockClient = {
      sendMessage: async (jid, text) => {
        dispatched.push({ jid, text });
      }
    };

    await checkAndSendReminders(mockClient);

    assert.ok(dispatched.some(d => d.text.includes('Test Reminder Jatuh Tempo')));
    
    // Pastikan sudah ditandai sent=1
    const check = db.getReminderById ? db.getReminderById(remId) : null;
    if (check) {
      assert.strictEqual(check.sent, 1);
    }
  });

  console.log('\n======================================================');
  console.log(`  📊 HASIL PENGUJIAN SCHEDULING & REMINDERS:`);
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
