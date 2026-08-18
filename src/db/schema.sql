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
  lead_status TEXT DEFAULT 'general',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabel Contact States (Status Pause / Mute Auto-Reply per Kontak)
CREATE TABLE IF NOT EXISTS contact_states (
  contact TEXT PRIMARY KEY,
  is_paused INTEGER NOT NULL DEFAULT 0,
  paused_until DATETIME,
  pause_reason TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabel Conversation Samples (Training Gaya Percakapan / Few-Shot Learning)
CREATE TABLE IF NOT EXISTS conversation_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_sample TEXT NOT NULL,
  bot_sample TEXT NOT NULL,
  tag TEXT DEFAULT 'umum',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabel Business Documents (Knowledge Base Usaha / Dokumen File Upload)
CREATE TABLE IF NOT EXISTS business_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  extracted_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabel Manual Handovers (Tiket Antrean Pesan yang Butuh Respon Manual)
CREATE TABLE IF NOT EXISTS manual_handovers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact TEXT NOT NULL,
  customer_name TEXT,
  trigger_message TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
