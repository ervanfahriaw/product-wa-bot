/**
 * Test Script — Fase PA-1: Upgrade Sistem Reminder
 * Menguji: createReminder, recurring, snooze, cancel, getActive, getPending
 * 
 * Jalankan: node scripts/test-pa1-reminders.js
 */

// Jalankan migration dulu
try {
  const migration = require('../src/db/migrations/001-reminders-upgrade');
  migration.migrate();
} catch (err) {
  console.log('[Migration] Sudah pernah dijalankan atau tidak perlu:', err.message);
}

const db = require('../src/db');
const { calculateNextTrigger, formatDateTime } = require('../src/engine/reminder-scheduler');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

console.log('\n========================================');
console.log('  TEST: Fase PA-1 — Upgrade Reminder');
console.log('========================================\n');

// --- Test 1: Create one-shot reminder ---
console.log('📌 Test 1: Buat reminder one-shot');
const id1 = db.createReminder({
  message: 'Bayar listrik',
  trigger_at: '2099-12-31 08:00:00',
  is_recurring: 0,
  sent: 0,
  label: 'bayar listrik',
  recurrence_type: null
});
assert(id1 > 0, `Reminder one-shot berhasil dibuat (ID: ${id1})`);

const r1 = db.getReminderById(id1);
assert(r1 !== null, 'Reminder bisa diambil by ID');
assert(r1.label === 'bayar listrik', 'Label tersimpan benar');
assert(r1.recurrence_type === null, 'recurrence_type NULL untuk one-shot');
assert(r1.is_active === 1, 'is_active default = 1');

// --- Test 2: Create recurring reminder ---
console.log('\n📌 Test 2: Buat reminder recurring (daily)');
const id2 = db.createReminder({
  message: 'Minum vitamin',
  trigger_at: '2099-01-01 07:00:00',
  is_recurring: 1,
  sent: 0,
  label: 'minum vitamin',
  recurrence_type: 'daily'
});
assert(id2 > 0, `Reminder recurring berhasil dibuat (ID: ${id2})`);

const r2 = db.getReminderById(id2);
assert(r2.is_recurring === 1, 'is_recurring = 1');
assert(r2.recurrence_type === 'daily', 'recurrence_type = daily');

// --- Test 3: Get active reminders ---
console.log('\n📌 Test 3: Ambil daftar reminder aktif');
const activeList = db.getActiveReminders();
assert(activeList.length >= 2, `Ada ${activeList.length} reminder aktif`);

// --- Test 4: Cancel by label ---
console.log('\n📌 Test 4: Batalkan reminder by label');
const cancelResult = db.cancelReminderByLabel('bayar listrik');
assert(cancelResult.cancelled === 1, 'Cancel by label berhasil');
assert(cancelResult.reminder.id === id1, 'Reminder yang dibatalkan benar');

const r1After = db.getReminderById(id1);
assert(r1After.is_active === 0, 'is_active berubah ke 0 setelah cancel');

// --- Test 5: Cancel by ID ---
console.log('\n📌 Test 5: Batalkan reminder by ID');
const id3 = db.createReminder({
  message: 'Test cancel by ID',
  trigger_at: '2099-06-15 10:00:00',
  label: 'test cancel id'
});
db.cancelReminderById(id3);
const r3 = db.getReminderById(id3);
assert(r3.is_active === 0, 'Cancel by ID berhasil');

// --- Test 6: Snooze ---
console.log('\n📌 Test 6: Snooze reminder');
const id4 = db.createReminder({
  message: 'Test snooze',
  trigger_at: '2099-03-01 09:00:00',
  label: 'test snooze'
});
db.markReminderSent(id4); // Simulasi sudah dikirim
db.snoozeReminder(id4, 30);
const r4 = db.getReminderById(id4);
assert(r4.snoozed_until !== null, `snoozed_until terisi: ${r4.snoozed_until}`);
assert(r4.sent === 0, 'sent di-reset ke 0 setelah snooze');

// --- Test 7: Get last sent reminder ---
console.log('\n📌 Test 7: Ambil reminder terakhir yang dikirim');
// ID4 sudah di-snooze (sent=0), jadi buat yang baru
const id5 = db.createReminder({
  message: 'Last sent test',
  trigger_at: '2099-04-01 12:00:00',
  label: 'last sent test'
});
db.markReminderSent(id5);
const lastSent = db.getLastSentReminder();
assert(lastSent !== null, 'Bisa ambil last sent reminder');
assert(lastSent.id === id5, 'Last sent reminder benar');

// --- Test 8: Search by label ---
console.log('\n📌 Test 8: Cari reminder by label');
const searchResult = db.searchRemindersByLabel('vitamin');
assert(searchResult.length >= 1, `Ditemukan ${searchResult.length} reminder dengan keyword "vitamin"`);

// --- Test 9: Calculate next trigger ---
console.log('\n📌 Test 9: Hitung trigger berikutnya (recurring)');
const nextDaily = calculateNextTrigger('2026-08-18 07:00:00', 'daily');
assert(nextDaily !== null, `Next daily: ${nextDaily}`);

const nextWeekly = calculateNextTrigger('2026-08-18 09:00:00', 'weekly');
assert(nextWeekly !== null, `Next weekly: ${nextWeekly}`);

const nextMonthly = calculateNextTrigger('2026-08-18 10:00:00', 'monthly');
assert(nextMonthly !== null, `Next monthly: ${nextMonthly}`);

// --- Test 10: Update next trigger ---
console.log('\n📌 Test 10: Update next trigger (recurring)');
const nextTrigger = calculateNextTrigger(r2.trigger_at, r2.recurrence_type);
if (nextTrigger) {
  db.updateNextTrigger(id2, nextTrigger);
  const r2After = db.getReminderById(id2);
  assert(r2After.trigger_at === nextTrigger, `trigger_at diupdate ke ${nextTrigger}`);
  assert(r2After.sent === 0, 'sent di-reset ke 0');
}

// --- Cleanup ---
console.log('\n🧹 Cleanup: Hapus data test...');
[id1, id2, id3, id4, id5].forEach(id => db.deleteReminder(id));

console.log('\n========================================');
console.log(`  HASIL: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
