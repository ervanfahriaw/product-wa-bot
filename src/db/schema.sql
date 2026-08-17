-- Skema Database SQLite untuk WA Bot Assistant
-- File database: data/bot.db

-- 1. Tabel Settings (Pengaturan sistem & integrasi)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 2. Tabel Products (Mode Bisnis - Katalog Produk & Stok)
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image_path TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Expenses (Mode Personal - Pencatatan Keuangan)
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Reminders (Pengingat / Jadwal Otomatis)
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  trigger_at DATETIME NOT NULL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  cron_pattern TEXT,
  sent INTEGER NOT NULL DEFAULT 0
);

-- 5. Tabel Chat Logs (Riwayat Pesan Masuk & Keluar)
CREATE TABLE IF NOT EXISTS chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact TEXT NOT NULL,
  message_in TEXT,
  message_out TEXT,
  handled_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
