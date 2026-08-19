/**
 * Test Script — Fase PA-6: Export Data, Summary, QA Final
 * Jalankan: node scripts/test-pa6-export-summary.js
 */

// Run all migrations
const migrations = ['003-budgets', '004-habits', '005-events-journals-goals'];
migrations.forEach(name => {
  try { require(`../src/db/migrations/${name}`).migrate(); } catch (_) {}
});

const db = require('../src/db');
const exportData = require('../src/engine/export-data');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

console.log('\n==========================================');
console.log('  TEST: Fase PA-6 — Export, Summary & QA');
console.log('==========================================\n');

// ========== CSV GENERATOR ==========
console.log('📥 Test 1: CSV Generator');
const testData = [
  { name: 'Alice', age: 30, city: 'Jakarta' },
  { name: 'Bob', age: 25, city: 'Bandung' }
];
const csv = exportData.toCSV(testData, ['name', 'age', 'city']);
assert(csv.includes('name,age,city'), 'Header CSV benar');
assert(csv.includes('Alice,30,Jakarta'), 'Row 1 benar');
assert(csv.includes('Bob,25,Bandung'), 'Row 2 benar');

console.log('\n📥 Test 2: CSV escape special chars');
const specialData = [{ name: 'John "O\'Brien"', desc: 'Has, comma' }];
const specialCSV = exportData.toCSV(specialData, ['name', 'desc']);
assert(specialCSV.includes('"John ""O\'Brien"""'), 'Quotes di-escape');
assert(specialCSV.includes('"Has, comma"'), 'Comma di-escape');

// ========== EXPORT FUNCTIONS ==========
console.log('\n📥 Test 3: Export semua tipe data');

// Seed test data
db.createExpense({ category: 'Test Kategori', amount: 50000, note: 'Test expense' });
db.createNote({ title: 'Test note', content: 'Content', tags: 'test' });
db.createTodo({ task: 'Test task', priority: 'normal' });
db.setBudget({ category: 'Test Budget', monthly_limit: 1000000, alert_at_percent: 80 });
const testHabitId = db.createHabit({ name: 'Test habit', frequency: 'daily' });
db.createJournal({ content: 'Test journal', mood: 'senang' });
db.createGoal({ title: 'Test goal', target_value: 100, unit: 'unit' });
const futureDate = new Date(Date.now() + 86400000).toISOString().substring(0, 16).replace('T', ' ');
db.createEvent({ title: 'Test event', event_date: futureDate });

const expenseCSV = exportData.exportExpenses();
assert(expenseCSV.includes('category,amount'), 'Export expenses: header OK');
assert(expenseCSV.includes('Test Kategori'), 'Export expenses: data OK');

const notesCSV = exportData.exportNotes();
assert(notesCSV.includes('title,content'), 'Export notes: header OK');

const todosCSV = exportData.exportTodos();
assert(todosCSV.includes('task,priority'), 'Export todos: header OK');

const budgetsCSV = exportData.exportBudgets();
assert(budgetsCSV.includes('category,monthly_limit'), 'Export budgets: header OK');

const habitsCSV = exportData.exportHabits();
assert(habitsCSV.includes('name,frequency'), 'Export habits: header OK');

const journalsCSV = exportData.exportJournals();
assert(journalsCSV.includes('content,mood'), 'Export journals: header OK');

const goalsCSV = exportData.exportGoals();
assert(goalsCSV.includes('title,target_value'), 'Export goals: header OK');

const eventsCSV = exportData.exportEvents();
assert(eventsCSV.includes('title,event_date'), 'Export events: header OK');

// ========== MONTHLY SUMMARY ==========
console.log('\n📊 Test 4: Monthly summary generator');
const summary = exportData.generateMonthlySummary();
assert(typeof summary.monthName === 'string', `monthName: "${summary.monthName}"`);
assert(typeof summary.expenses.total === 'number', `expenses.total: ${summary.expenses.total}`);
assert(typeof summary.expenses.count === 'number', `expenses.count: ${summary.expenses.count}`);
assert(Array.isArray(summary.expenses.topCategories), 'topCategories is array');
assert(Array.isArray(summary.budgets), 'budgets is array');
assert(typeof summary.todos.active === 'number', `todos.active: ${summary.todos.active}`);
assert(typeof summary.todos.done === 'number', `todos.done: ${summary.todos.done}`);
assert(Array.isArray(summary.habits), 'habits is array');
assert(typeof summary.goals.active === 'number', `goals.active: ${summary.goals.active}`);
assert(typeof summary.journal.streak === 'number', `journal.streak: ${summary.journal.streak}`);
assert(typeof summary.notes.count === 'number', `notes.count: ${summary.notes.count}`);

// ========== CROSS-FEATURE QA ==========
console.log('\n🔎 Test 5: Cross-feature QA — DB Integrity');

// Verify all query modules exist
const queryModules = [
  'getAllExpenses', 'createExpense',
  'createNote', 'getAllNotes', 'searchNotes',
  'createTodo', 'getAllTodos',
  'setBudget', 'getAllBudgets', 'getBudgetByCategory',
  'createHabit', 'getActiveHabits', 'findHabitByName', 'logHabitCheckin', 'hasCheckedInToday', 'calculateStreak',
  'createEvent', 'getUpcomingEvents', 'findEventByKeyword',
  'createJournal', 'getAllJournals', 'getTodayJournal', 'getJournalStreak',
  'createGoal', 'getActiveGoals', 'findGoalByKeyword', 'updateGoalProgress', 'completeGoal'
];

let missingQueries = 0;
queryModules.forEach(name => {
  if (typeof db[name] !== 'function') {
    console.error(`  ❌ db.${name} missing!`);
    missingQueries++;
    failed++;
  }
});
if (missingQueries === 0) {
  assert(true, `Semua ${queryModules.length} fungsi DB tersedia`);
}

console.log('\n🔎 Test 6: Export empty data (edge case)');
// Clean test data
db.deleteHabit(testHabitId);
const emptyCSV = exportData.toCSV([], ['a', 'b']);
assert(emptyCSV === 'a,b\n', 'Empty CSV hanya punya header');

console.log('\n==========================================');
console.log(`  HASIL: ${passed} passed, ${failed} failed`);
console.log('==========================================\n');

process.exit(failed > 0 ? 1 : 0);
