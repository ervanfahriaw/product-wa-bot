/**
 * Migration 001: Upgrade tabel reminders
 * Tambah kolom: label, recurrence_type, snoozed_until, is_active
 * 
 * Jalankan: node src/db/migrations/001-reminders-upgrade.js
 */

const db = require('../connection');

function migrate() {
  console.log('[Migration 001] Memulai upgrade tabel reminders...');

  // Cek kolom yang sudah ada
  const columns = db.pragma('table_info(reminders)').map(c => c.name);

  const newColumns = [
    { name: 'label', sql: "ALTER TABLE reminders ADD COLUMN label TEXT" },
    { name: 'recurrence_type', sql: "ALTER TABLE reminders ADD COLUMN recurrence_type TEXT" },
    { name: 'snoozed_until', sql: "ALTER TABLE reminders ADD COLUMN snoozed_until DATETIME" },
    { name: 'is_active', sql: "ALTER TABLE reminders ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1" }
  ];

  let added = 0;
  for (const col of newColumns) {
    if (!columns.includes(col.name)) {
      try {
        db.exec(col.sql);
        console.log(`  ✅ Kolom '${col.name}' berhasil ditambahkan.`);
        added++;
      } catch (err) {
        console.error(`  ❌ Gagal menambahkan kolom '${col.name}':`, err.message);
      }
    } else {
      console.log(`  ⏭️ Kolom '${col.name}' sudah ada, dilewati.`);
    }
  }

  console.log(`[Migration 001] Selesai. ${added} kolom baru ditambahkan.`);
}

// Auto-run jika dijalankan langsung
if (require.main === module) {
  migrate();
}

module.exports = { migrate };
