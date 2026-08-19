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
  related_products TEXT,
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
  sent INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  recurrence_type TEXT,        -- 'daily', 'weekly', 'monthly', NULL
  snoozed_until DATETIME,
  is_active INTEGER NOT NULL DEFAULT 1
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

-- 6. Tabel Notes (Mode Personal - Catatan Cepat)
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabel Todos (Mode Personal - Daftar Tugas)
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  is_done INTEGER NOT NULL DEFAULT 0,
  due_date DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabel Budgets (Mode Personal - Anggaran per Kategori)
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL UNIQUE,
  monthly_limit INTEGER NOT NULL,
  alert_at_percent INTEGER NOT NULL DEFAULT 80,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabel Habits (Mode Personal - Pelacak Kebiasaan)
CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  target_per_period INTEGER NOT NULL DEFAULT 1,
  streak_current INTEGER NOT NULL DEFAULT 0,
  streak_best INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tabel Habit Logs (Log Check-in Kebiasaan)
CREATE TABLE IF NOT EXISTS habit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

-- 11. Tabel Events (Mode Personal - Jadwal Acara)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATETIME NOT NULL,
  event_end DATETIME,
  location TEXT,
  remind_before_minutes INTEGER DEFAULT 30,
  is_notified INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Tabel Journals (Mode Personal - Jurnal Harian)
CREATE TABLE IF NOT EXISTS journals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  mood TEXT,
  tags TEXT,
  journal_date DATE DEFAULT (DATE('now', 'localtime')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Tabel Goals (Mode Personal - Target/Sasaran)
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  target_value INTEGER,
  current_value INTEGER NOT NULL DEFAULT 0,
  unit TEXT,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- 14. Tabel Contact States (Status Pause / Mute Auto-Reply per Kontak)
CREATE TABLE IF NOT EXISTS contact_states (
  contact TEXT PRIMARY KEY,
  is_paused INTEGER NOT NULL DEFAULT 0,
  paused_until DATETIME,
  pause_reason TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Tabel Conversation Samples (Training Gaya Percakapan / Few-Shot Learning)
CREATE TABLE IF NOT EXISTS conversation_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_sample TEXT NOT NULL,
  bot_sample TEXT NOT NULL,
  tag TEXT DEFAULT 'umum',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. Tabel Business Documents (Knowledge Base Usaha / Dokumen File Upload)
CREATE TABLE IF NOT EXISTS business_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  extracted_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 17. Tabel Manual Handovers (Tiket Antrean Pesan yang Butuh Respon Manual)
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

-- 18. Tabel Customer Profiles (CRM Pelanggan Mode Bisnis)
CREATE TABLE IF NOT EXISTS customer_profiles (
  contact TEXT PRIMARY KEY,
  customer_name TEXT,
  customer_status TEXT DEFAULT 'new', -- 'new' | 'loyal' | 'vip' | 'inactive'
  total_orders INTEGER DEFAULT 0,
  last_order_amount INTEGER DEFAULT 0,
  notes TEXT,
  last_contact_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 19. Tabel FAQs (Auto FAQ / Jawab Otomatis Tanpa AI)
CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_keywords TEXT NOT NULL,
  question_label TEXT NOT NULL,
  answer TEXT NOT NULL,
  match_count INTEGER DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 20. Tabel Orders (Pencatatan Pesanan Pelanggan)
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact TEXT NOT NULL,
  customer_name TEXT,
  items TEXT NOT NULL,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'processing' | 'shipped' | 'completed' | 'cancelled'
  shipping_address TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 21. Tabel Follow Ups & Opt-outs (Gentle Follow-Up & Anti-Spam)
CREATE TABLE IF NOT EXISTS follow_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact TEXT NOT NULL,
  product_name TEXT NOT NULL,
  trigger_message TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'sent' | 'cancelled'
  scheduled_at DATETIME NOT NULL,
  sent_at DATETIME,
  cancelled_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follow_up_optouts (
  contact TEXT PRIMARY KEY,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
