/**
 * Test Script — Fase PA-4: Habit Tracker
 * Jalankan: node scripts/test-pa4-habits.js
 */

try {
  const migration = require('../src/db/migrations/004-habits');
  migration.migrate();
} catch (err) {
  console.log('[Migration] Info:', err.message);
}

const db = require('../src/db');

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
console.log('  TEST: Fase PA-4 — Habit Tracker');
console.log('========================================\n');

// --- Test 1: Create habit ---
console.log('📌 Test 1: Buat kebiasaan');
const h1 = db.createHabit({ name: 'Olahraga pagi', frequency: 'daily' });
assert(h1 > 0, `Habit berhasil dibuat (ID: ${h1})`);

const h2 = db.createHabit({ name: 'Baca buku', frequency: 'daily' });
assert(h2 > 0, `Habit kedua berhasil dibuat (ID: ${h2})`);

// --- Test 2: Get by ID ---
console.log('\n📌 Test 2: Ambil habit by ID');
const habit1 = db.getHabitById(h1);
assert(habit1 !== null, 'Habit ditemukan');
assert(habit1.name === 'Olahraga pagi', 'Name benar');
assert(habit1.frequency === 'daily', 'Frequency benar');
assert(habit1.is_active === 1, 'is_active = 1');

// --- Test 3: Get active habits ---
console.log('\n📌 Test 3: Ambil habit aktif');
const active = db.getActiveHabits();
assert(active.length >= 2, `Ada ${active.length} habit aktif`);

// --- Test 4: Find by name ---
console.log('\n📌 Test 4: Cari habit by name');
const found = db.findHabitByName('olahraga');
assert(found !== null, 'Habit ditemukan by name');
assert(found.id === h1, 'ID cocok');

const notFound = db.findHabitByName('xyznonexistent');
assert(notFound === null, 'Not found returns null');

// --- Test 5: Check-in ---
console.log('\n📌 Test 5: Check-in habit');
const logId = db.logHabitCheckin(h1);
assert(logId > 0, `Check-in berhasil (Log ID: ${logId})`);

const checkedToday = db.hasCheckedInToday(h1);
assert(checkedToday === true, 'hasCheckedInToday = true');

const notChecked = db.hasCheckedInToday(h2);
assert(notChecked === false, 'Habit lain belum check-in');

// --- Test 6: Checkin count ---
console.log('\n📌 Test 6: Hitung check-in');
const count7 = db.getCheckinCount(h1, 7);
assert(count7 >= 1, `Check-in 7 hari: ${count7}`);

// --- Test 7: Habit logs ---
console.log('\n📌 Test 7: Ambil log check-in');
const logs = db.getHabitLogs(h1, 10);
assert(logs.length >= 1, `Ada ${logs.length} log`);

// --- Test 8: Calculate streak ---
console.log('\n📌 Test 8: Hitung streak');
const streak = db.calculateStreak(h1);
assert(streak.current >= 1, `Current streak: ${streak.current}`);
assert(streak.best >= 1, `Best streak: ${streak.best}`);

// Habit tanpa log = streak 0
const streak2 = db.calculateStreak(h2);
assert(streak2.current === 0, `Streak tanpa log: ${streak2.current}`);

// --- Test 9: Update streak ---
console.log('\n📌 Test 9: Update streak');
const updated = db.updateStreak(h1, streak.current, streak.best);
assert(updated === true, 'Update streak berhasil');
const h1after = db.getHabitById(h1);
assert(h1after.streak_current === streak.current, `streak_current = ${streak.current}`);

// --- Test 10: Deactivate ---
console.log('\n📌 Test 10: Deactivate habit');
const deactivated = db.deactivateHabit(h2);
assert(deactivated === true, 'Deactivate berhasil');
const h2after = db.getHabitById(h2);
assert(h2after.is_active === 0, 'is_active = 0');

// --- Test 11: Delete ---
console.log('\n📌 Test 11: Delete habit + logs');
const deleted = db.deleteHabit(h1);
assert(deleted === true, 'Delete berhasil');
const logsAfter = db.getHabitLogs(h1, 10);
assert(logsAfter.length === 0, 'Logs juga terhapus');

// Cleanup
db.deleteHabit(h2);

console.log('\n========================================');
console.log(`  HASIL: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
