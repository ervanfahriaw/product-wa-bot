/**
 * Test Script — Fase PA-2: Smart Notes & To-Do List
 * Jalankan: node scripts/test-pa2-notes-todos.js
 */

// Run migration
try {
  const migration = require('../src/db/migrations/002-notes-todos');
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
console.log('  TEST: Fase PA-2 — Notes & Todos');
console.log('========================================\n');

// ========== NOTES TESTS ==========

console.log('📌 Test 1: Buat catatan');
const noteId1 = db.createNote({ title: 'WiFi Rumah', content: 'password123', tags: 'wifi,password' });
assert(noteId1 > 0, `Catatan berhasil dibuat (ID: ${noteId1})`);

const noteId2 = db.createNote({ title: 'Nomor Resi', content: 'JNE JT1234567890', tags: 'resi,jne' });
assert(noteId2 > 0, `Catatan kedua berhasil dibuat (ID: ${noteId2})`);

console.log('\n📌 Test 2: Ambil catatan by ID');
const n1 = db.getNoteById(noteId1);
assert(n1 !== null, 'Catatan ditemukan');
assert(n1.title === 'WiFi Rumah', 'Title benar');
assert(n1.content === 'password123', 'Content benar');
assert(n1.tags === 'wifi,password', 'Tags benar');

console.log('\n📌 Test 3: Cari catatan by keyword');
const searchWifi = db.searchNotes('wifi');
assert(searchWifi.length >= 1, `Ditemukan ${searchWifi.length} catatan dengan "wifi"`);

const searchResi = db.searchNotes('resi');
assert(searchResi.length >= 1, `Ditemukan ${searchResi.length} catatan dengan "resi"`);

const searchNoMatch = db.searchNotes('xyznonexistent');
assert(searchNoMatch.length === 0, 'Pencarian tanpa hasil return array kosong');

console.log('\n📌 Test 4: Ambil semua catatan');
const allNotes = db.getAllNotes();
assert(allNotes.length >= 2, `Ada ${allNotes.length} catatan`);

console.log('\n📌 Test 5: Update catatan');
const updated = db.updateNote(noteId1, { title: 'WiFi Kantor', content: 'kantor456', tags: 'wifi,kantor' });
assert(updated === true, 'Update berhasil');
const n1After = db.getNoteById(noteId1);
assert(n1After.title === 'WiFi Kantor', 'Title terupdate');
assert(n1After.content === 'kantor456', 'Content terupdate');

console.log('\n📌 Test 6: Hapus catatan by keyword');
const deleteResult = db.deleteNoteByKeyword('resi');
assert(deleteResult.deleted === 1, 'Hapus by keyword berhasil');
assert(deleteResult.note.id === noteId2, 'Catatan yang dihapus benar');

console.log('\n📌 Test 7: Hapus catatan by ID');
const deleted = db.deleteNoteById(noteId1);
assert(deleted === true, 'Hapus by ID berhasil');

// ========== TODOS TESTS ==========

console.log('\n📌 Test 8: Buat tugas');
const todoId1 = db.createTodo({ task: 'Beli deterjen', priority: 'normal' });
assert(todoId1 > 0, `Tugas normal berhasil dibuat (ID: ${todoId1})`);

const todoId2 = db.createTodo({ task: 'Siapkan presentasi', priority: 'urgent' });
assert(todoId2 > 0, `Tugas urgent berhasil dibuat (ID: ${todoId2})`);

const todoId3 = db.createTodo({ task: 'Bersihkan kamar', priority: 'low', due_date: '2099-12-31' });
assert(todoId3 > 0, `Tugas low priority berhasil dibuat (ID: ${todoId3})`);

console.log('\n📌 Test 9: Ambil tugas aktif');
const activeTodos = db.getActiveTodos();
assert(activeTodos.length >= 3, `Ada ${activeTodos.length} tugas aktif`);
// Cek urutan: urgent pertama
assert(activeTodos[0].priority === 'urgent', 'Urgent muncul pertama di daftar');

console.log('\n📌 Test 10: Selesaikan tugas by keyword');
const completeResult = db.completeTodoByKeyword('deterjen');
assert(completeResult.completed === 1, 'Selesaikan by keyword berhasil');
assert(completeResult.todo.id === todoId1, 'Tugas yang diselesaikan benar');

const t1After = db.getTodoById(todoId1);
assert(t1After.is_done === 1, 'is_done = 1');
assert(t1After.completed_at !== null, 'completed_at terisi');

console.log('\n📌 Test 11: Selesaikan tugas by ID');
const completedById = db.completeTodoById(todoId2);
assert(completedById === true, 'Complete by ID berhasil');

console.log('\n📌 Test 12: Uncomplete tugas');
const uncompleted = db.uncompleteTodoById(todoId2);
assert(uncompleted === true, 'Uncomplete berhasil');
const t2After = db.getTodoById(todoId2);
assert(t2After.is_done === 0, 'is_done kembali ke 0');

console.log('\n📌 Test 13: Ambil semua tugas');
const allTodos = db.getAllTodos();
assert(allTodos.length >= 3, `Ada ${allTodos.length} tugas total`);

console.log('\n📌 Test 14: Hapus tugas by keyword');
const deleteTodoResult = db.deleteTodoByKeyword('kamar');
assert(deleteTodoResult.deleted === 1, 'Hapus by keyword berhasil');

console.log('\n📌 Test 15: Hapus tugas by ID');
const deletedTodo = db.deleteTodoById(todoId1);
assert(deletedTodo === true, 'Hapus by ID berhasil');

// Cleanup
db.deleteTodoById(todoId2);

console.log('\n========================================');
console.log(`  HASIL: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
