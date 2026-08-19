/**
 * Test Script — Fase PA-3: Budget Planner & Kalkulator Cepat
 * Jalankan: node scripts/test-pa3-budgets.js
 */

// Run migration
try {
  const migration = require('../src/db/migrations/003-budgets');
  migration.migrate();
} catch (err) {
  console.log('[Migration] Info:', err.message);
}

const db = require('../src/db');
const { getAllBudgetStatus, daysRemainingInMonth } = require('../src/engine/budget-checker');

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
console.log('  TEST: Fase PA-3 — Budget & Kalkulator');
console.log('========================================\n');

// --- Test 1: Set budget ---
console.log('📌 Test 1: Set budget baru');
const budgetId1 = db.setBudget({ category: 'Makan & Minum', monthly_limit: 2000000, alert_at_percent: 80 });
assert(budgetId1 > 0, `Budget berhasil dibuat (ID: ${budgetId1})`);

const budgetId2 = db.setBudget({ category: 'Transportasi', monthly_limit: 500000, alert_at_percent: 75 });
assert(budgetId2 > 0, `Budget kedua berhasil dibuat (ID: ${budgetId2})`);

// --- Test 2: Get by category ---
console.log('\n📌 Test 2: Ambil budget by category');
const b1 = db.getBudgetByCategory('Makan & Minum');
assert(b1 !== null, 'Budget ditemukan');
assert(b1.monthly_limit === 2000000, 'monthly_limit benar');
assert(b1.alert_at_percent === 80, 'alert_at_percent benar');

// Case insensitive
const b1lower = db.getBudgetByCategory('makan & minum');
assert(b1lower !== null, 'Case-insensitive lookup berhasil');

// --- Test 3: Upsert (update existing) ---
console.log('\n📌 Test 3: Upsert budget (category sudah ada)');
const updatedId = db.setBudget({ category: 'Makan & Minum', monthly_limit: 2500000, alert_at_percent: 85 });
assert(updatedId === budgetId1, 'ID sama (upsert, bukan insert baru)');
const b1updated = db.getBudgetByCategory('Makan & Minum');
assert(b1updated.monthly_limit === 2500000, 'monthly_limit terupdate');

// --- Test 4: Get all budgets ---
console.log('\n📌 Test 4: Ambil semua budget');
const allBudgets = db.getAllBudgets();
assert(allBudgets.length >= 2, `Ada ${allBudgets.length} budget aktif`);

// --- Test 5: Update budget ---
console.log('\n📌 Test 5: Update budget');
const updateResult = db.updateBudget(budgetId2, { monthly_limit: 600000, alert_at_percent: 70 });
assert(updateResult === true, 'Update berhasil');
const b2updated = db.getBudgetByCategory('Transportasi');
assert(b2updated.monthly_limit === 600000, 'monthly_limit terupdate via updateBudget');

// --- Test 6: Budget status calculator ---
console.log('\n📌 Test 6: Budget status calculator');
const statuses = getAllBudgetStatus();
assert(statuses.length >= 2, `Ada ${statuses.length} status budget`);
assert(typeof statuses[0].spent === 'number', 'spent field ada (number)');
assert(typeof statuses[0].percent === 'number', 'percent field ada (number)');
assert(typeof statuses[0].remaining === 'number', 'remaining field ada (number)');
assert(typeof statuses[0].daysLeft === 'number', 'daysLeft field ada (number)');
assert(['safe', 'warning', 'over'].includes(statuses[0].status), `status = "${statuses[0].status}"`);

// --- Test 7: Days remaining in month ---
console.log('\n📌 Test 7: Days remaining calculator');
const daysLeft = daysRemainingInMonth();
assert(daysLeft >= 0 && daysLeft <= 31, `Sisa hari: ${daysLeft}`);

// --- Test 8: Deactivate budget ---
console.log('\n📌 Test 8: Deactivate budget');
const deactivated = db.deactivateBudget(budgetId2);
assert(deactivated === true, 'Deactivate berhasil');
const b2after = db.getBudgetByCategory('Transportasi');
assert(b2after === null, 'Budget tidak muncul setelah deactivate');

// --- Cleanup ---
console.log('\n🧹 Cleanup...');
db.deleteBudget(budgetId1);
db.deleteBudget(budgetId2);

console.log('\n========================================');
console.log(`  HASIL: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
