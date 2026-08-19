/**
 * Test Script — Fase PA-5: Events, Journals, Goals
 * Jalankan: node scripts/test-pa5-events-journals-goals.js
 */

try {
  const migration = require('../src/db/migrations/005-events-journals-goals');
  migration.migrate();
} catch (err) {
  console.log('[Migration] Info:', err.message);
}

const db = require('../src/db');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

console.log('\n========================================');
console.log('  TEST: Fase PA-5 — Events, Journals, Goals');
console.log('========================================\n');

// ========== EVENTS ==========
console.log('📅 Test 1: Buat event');
const futureDate = new Date(Date.now() + 86400000 * 3).toISOString().substring(0, 16).replace('T', ' ');
const e1 = db.createEvent({ title: 'Meeting Zoom', event_date: futureDate, location: 'Zoom', remind_before_minutes: 30 });
assert(e1 > 0, `Event berhasil dibuat (ID: ${e1})`);

const e2 = db.createEvent({ title: 'Dentist', event_date: futureDate, location: 'RS Hermina' });
assert(e2 > 0, `Event kedua berhasil dibuat (ID: ${e2})`);

console.log('\n📅 Test 2: Ambil event');
const ev = db.getEventById(e1);
assert(ev !== null, 'Event ditemukan');
assert(ev.title === 'Meeting Zoom', 'Title benar');
assert(ev.location === 'Zoom', 'Location benar');

console.log('\n📅 Test 3: Upcoming events');
const upcoming = db.getUpcomingEvents(10);
assert(upcoming.length >= 2, `Ada ${upcoming.length} event mendatang`);

console.log('\n📅 Test 4: Find event by keyword');
const found = db.findEventByKeyword('Meeting Zoom');
assert(found !== null, 'Event ditemukan by keyword');
assert(found.title === 'Meeting Zoom', `Title cocok: "${found.title}"`);

console.log('\n📅 Test 5: Delete event');
const deleted = db.deleteEvent(e1);
assert(deleted === true, 'Delete berhasil');
db.deleteEvent(e2);

// ========== JOURNALS ==========
console.log('\n📝 Test 6: Tulis jurnal');
const j1 = db.createJournal({ content: 'Hari ini sangat produktif', mood: 'senang', tags: 'kerja,produktif' });
assert(j1 > 0, `Jurnal berhasil dibuat (ID: ${j1})`);

const j2 = db.createJournal({ content: 'Agak capek tapi bersyukur', mood: 'bersyukur' });
assert(j2 > 0, `Jurnal kedua berhasil dibuat (ID: ${j2})`);

console.log('\n📝 Test 7: Jurnal hari ini');
const today = db.getTodayJournal();
assert(today !== null, 'Jurnal hari ini ditemukan');

console.log('\n📝 Test 8: Semua jurnal');
const allJournals = db.getAllJournals(10);
assert(allJournals.length >= 2, `Ada ${allJournals.length} jurnal`);

console.log('\n📝 Test 9: Cari jurnal');
const searchResult = db.searchJournals('produktif');
assert(searchResult.length >= 1, `Ditemukan ${searchResult.length} jurnal`);

console.log('\n📝 Test 10: Streak jurnal');
const streak = db.getJournalStreak();
assert(streak >= 1, `Streak: ${streak} hari`);

console.log('\n📝 Test 11: Hapus jurnal');
const jDeleted = db.deleteJournal(j1);
assert(jDeleted === true, 'Hapus berhasil');
db.deleteJournal(j2);

// ========== GOALS ==========
console.log('\n🎯 Test 12: Buat goal');
const g1 = db.createGoal({ title: 'Tabung 10 juta', target_value: 10000000, unit: 'rupiah', deadline: '2099-12-31' });
assert(g1 > 0, `Goal berhasil dibuat (ID: ${g1})`);

const g2 = db.createGoal({ title: 'Baca 12 buku', target_value: 12, unit: 'buku' });
assert(g2 > 0, `Goal kedua berhasil dibuat (ID: ${g2})`);

console.log('\n🎯 Test 13: Ambil goal aktif');
const active = db.getActiveGoals();
assert(active.length >= 2, `Ada ${active.length} goal aktif`);

console.log('\n🎯 Test 14: Find goal by keyword');
const foundGoal = db.findGoalByKeyword('Tabung 10 juta');
assert(foundGoal !== null, 'Goal ditemukan');
assert(foundGoal.title === 'Tabung 10 juta', `Title cocok: "${foundGoal.title}"`);

console.log('\n🎯 Test 15: Update progress');
const result1 = db.updateGoalProgress(g1, 3000000);
assert(result1.updated === true, 'Update berhasil');
assert(result1.completed === false, 'Belum complete');
const g1after = db.getGoalById(g1);
assert(g1after.current_value === 3000000, 'current_value terupdate');

console.log('\n🎯 Test 16: Auto-complete saat target tercapai');
const result2 = db.updateGoalProgress(g2, 12);
assert(result2.completed === true, 'Auto-complete triggered!');
const g2after = db.getGoalById(g2);
assert(g2after.status === 'completed', 'Status = completed');
assert(g2after.completed_at !== null, 'completed_at terisi');

console.log('\n🎯 Test 17: Manual complete');
const completed = db.completeGoal(g1);
assert(completed === true, 'Manual complete berhasil');

console.log('\n🎯 Test 18: Semua goal');
const allGoals = db.getAllGoals(50);
assert(allGoals.length >= 2, `Ada ${allGoals.length} goal total`);

// Cleanup
db.deleteGoal(g1);
db.deleteGoal(g2);

console.log('\n========================================');
console.log(`  HASIL: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
