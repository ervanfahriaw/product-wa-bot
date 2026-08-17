# PROMPTS.md — Panduan prompt per fase untuk Antigravity

## Cara pakai dokumen ini

1. Buka folder project ini di Antigravity.
2. Tempel prompt **satu fase pada satu waktu** — jangan tempel semua sekaligus.
3. Setiap prompt punya baris "Selesai kalau" dan instruksi eksplisit agar agent **berhenti dan menunggu** kata "lanjut" dari kamu. Jangan skip pengecekan ini — di situlah kamu review hasil kerja agent sebelum lanjut.
4. Setelah satu fase selesai dan kamu sudah cek hasilnya, disarankan `git commit` dulu sebelum lanjut fase berikutnya — supaya kalau fase berikutnya berantakan, kamu bisa rollback ke titik aman.
5. Kalau di tengah fase agent mulai menyimpang dari `.agents/rules/tech-stack.md` (misal tiba-tiba usul React/MongoDB), langsung tegur balik: "Cek lagi .agents/rules/tech-stack.md, itu tidak sesuai." Kalau tetap ngeyel/bingung, mulai sesi baru.
6. Urutan fase di bawah ini SENGAJA berurutan (database → engine → server → AI → fitur → dashboard → integrasi → packaging → QA). Jangan loncat urutan, karena tiap fase bergantung pada fase sebelumnya.

---

## Fase 0 — Bootstrap & Verifikasi Konteks

```
Baca seluruh isi AGENTS.md, semua file di .agents/rules/, dan semua file di docs/. Setelah selesai membaca, JANGAN langsung menulis kode. Sebagai gantinya, tuliskan ringkasan singkat (maksimal 10 poin) tentang: (1) apa produk ini, (2) dua mode utamanya, (3) stack teknis yang wajib dipakai, (4) apa yang SENGAJA tidak boleh dipakai, (5) urutan folder src/ dan fungsinya masing-masing.

Setelah saya konfirmasi ringkasanmu benar, jalankan:
- Sesuaikan package.json yang sudah ada di project (jangan overwrite, gabungkan kalau perlu)
- Install semua dependency yang tercantum di package.json
- Buat file entry point kosong: src/server/index.js (baru berisi comment placeholder, belum ada logic)
- Buat file config/config.json.example sebagai contoh struktur config (JANGAN buat config/config.json asli, itu digenerate wizard nanti)

Selesai kalau: `npm install` jalan tanpa error, dan kamu sudah menuliskan ringkasan konteks yang saya setujui. Jangan lanjut ke fase database sebelum saya bilang "lanjut".
```

---

## Fase 1 — Database Layer

```
Sebelum mulai, baca ulang docs/database-schema.md dan .agents/rules/coding-conventions.md.

Tugas fase ini, HANYA di dalam folder src/db/:
1. Buat src/db/schema.sql — definisikan tabel settings, products, expenses, reminders, chat_logs persis sesuai docs/database-schema.md
2. Buat src/db/connection.js — koneksi better-sqlite3 ke file data/bot.db (buat folder data/ otomatis kalau belum ada), jalankan schema.sql otomatis saat pertama kali dijalankan kalau tabel belum ada
3. Buat src/db/queries/ dengan file terpisah per tabel (settings.js, products.js, expenses.js, reminders.js, chat-logs.js), isi fungsi CRUD dasar (get, getAll, create, update, delete) untuk masing-masing
4. Buat src/db/migrations/ kosong dulu dengan README singkat cara nambah migration baru nanti

JANGAN menyentuh folder src/engine, src/ai, atau src/server di fase ini.

Constraint: pakai better-sqlite3 (synchronous), bukan sqlite3 (async callback-based) — sudah dikunci di tech-stack.md.

Selesai kalau: ada script test kecil (scripts/test-db.js, boleh dihapus nanti) yang berhasil insert dan baca 1 baris dummy di tiap tabel tanpa error. Tunjukkan hasil test itu ke saya. Jangan lanjut ke fase engine sebelum saya bilang "lanjut".
```

---

## Fase 2 — WhatsApp Engine

```
Sebelum mulai, baca ulang docs/architecture.md bagian "Alur pesan masuk" dan .agents/rules/tech-stack.md bagian "Bot engine".

Tugas fase ini, HANYA di dalam folder src/engine/:
1. Buat src/engine/client.js — inisialisasi whatsapp-web.js Client dengan LocalAuth strategy, folder session disimpan di src/engine/session/ (pastikan folder ini ada di .gitignore, cek ulang)
2. Buat event handler dasar: on('qr', ...) yang generate QR code (pakai package qrcode) dan simpan sebagai data URL yang bisa diakses modul lain (jangan langsung render ke browser di fase ini — itu tugas fase web server)
3. Buat event handler on('ready', ...) dan on('disconnected', ...) yang update status koneksi (simpan status terkini di module yang bisa diimport modul lain, misal src/engine/status.js)
4. Buat src/engine/handlers/message-handler.js — KOSONGKAN logic balasnya dulu (cukup console.log pesan masuk), karena logic balas otomatis baru dikerjakan di fase Mode Bisnis/Personal. Fase ini fokus PALING UTAMA: koneksi & sesi WhatsApp jalan stabil dulu.

JANGAN menyentuh src/ai atau src/server di fase ini. JANGAN buat logic balas pesan otomatis dulu.

Selesai kalau: saya bisa jalankan script kecil yang scan QR dari terminal/console (belum lewat browser), status berubah jadi "ready" setelah discan, dan pesan masuk dummy muncul di console log. Tunjukkan cara saya test ini. Jangan lanjut ke fase web server sebelum saya bilang "lanjut".
```

---

## Fase 3 — Web Server & Setup Wizard

```
Sebelum mulai, baca ulang docs/setup-wizard-flow.md, .agents/rules/design-system.md, dan .agents/rules/tech-stack.md bagian frontend.

Tugas fase ini, di dalam src/server/:
1. Setup Express dasar di src/server/index.js — jalankan di port yang bisa dikonfigurasi (default 3000), pakai EJS sebagai view engine
2. Middleware first-run check: cek config/config.json, kalau belum lengkap redirect semua request ke /setup (kecuali asset statis)
3. Bangun 4 halaman wizard sesuai docs/setup-wizard-flow.md, satu halaman per step (views/setup/step-1-mode.ejs, step-2-qr.ejs, step-3-api-key.ejs, step-4-initial-data.ejs):
   - Step 1: pilih mode Bisnis/Personal, simpan ke config
   - Step 2: tampilkan QR dari src/engine/client.js (dari fase sebelumnya) sebagai gambar, auto-refresh polling tiap beberapa detik sampai status "ready"
   - Step 3: form API key Gemini (wajib) dan Grok (opsional), simpan ke config/config.json — JANGAN commit file config asli ke git
   - Step 4: form input produk pertama (mode bisnis) atau kategori pengeluaran (mode personal) — buat tombol "Lewati" yang jelas
4. Setelah step 4 selesai/dilewati, redirect ke /dashboard (boleh masih halaman kosong dulu, isinya dikerjakan di fase Dashboard Management)
5. Terapkan style dasar sesuai .agents/rules/design-system.md (warna, tanpa sidebar di wizard, penjelasan singkat tiap halaman)

Constraint: pakai Tailwind lewat CDN dan Alpine.js untuk interaktivitas, JANGAN pakai build tool/bundler apa pun.

Selesai kalau: saya bisa buka localhost dari browser, lewati keempat step wizard, dan config/config.json ke-generate dengan benar. Jangan lanjut ke fase AI integration sebelum saya bilang "lanjut".
```

---

## Fase 4 — AI Integration Layer

```
Sebelum mulai, baca ulang docs/api-integration.md dan docs/architecture.md bagian "Alur RAG ringan".

Tugas fase ini, di dalam src/ai/:
1. Buat src/ai/router.js — fungsi utama generateReply(message, context) yang memilih provider berdasarkan config (Gemini untuk teks, Grok untuk gambar), TIDAK ada modul lain yang boleh panggil SDK provider langsung
2. Buat src/ai/providers/gemini.js dan src/ai/providers/grok.js — implementasi pemanggilan API masing-masing, dibungkus try/catch sesuai .agents/rules/coding-conventions.md, kembalikan fallback message yang jelas kalau gagal (jangan biarkan bot diam)
3. Buat src/ai/prompts/business/base.md dan src/ai/prompts/personal/base.md — template system prompt dasar per mode (boleh draft awal, akan disempurnakan nanti)
4. Buat src/ai/context-builder.js — fungsi yang query database (pakai src/db/queries/) berdasar kata kunci pesan user, HANYA ambil data relevan (bukan seluruh tabel), lalu gabungkan ke prompt
5. Buat fungsi validasi API key (test-call ringan) yang akan dipakai di halaman settings dashboard nanti

JANGAN sambungkan ke src/engine/handlers/message-handler.js dulu di fase ini — itu tugas fase Mode Bisnis/Personal.

Selesai kalau: ada script test kecil yang panggil generateReply() dengan pesan dummy dan API key asli saya masukkan manual, hasilnya balasan AI yang masuk akal muncul di console. Jangan lanjut sebelum saya bilang "lanjut".
```

---

## Fase 5 — Fitur Mode Bisnis

```
Sebelum mulai, baca ulang docs/features-business-mode.md.

Tugas fase ini:
1. Sambungkan src/engine/handlers/message-handler.js ke src/ai/router.js DAN src/ai/context-builder.js — tapi HANYA aktif kalau config.mode === "bisnis"
2. Implementasikan: cek stok dari database, kirim gambar produk (pakai MessageMedia dari products.image_path), rekomendasi produk berdasar kata kunci
3. Implementasikan human handover: definisikan kondisi sederhana kapan AI dianggap "tidak yakin" (misal: AI eksplisit bilang tidak tahu, atau pertanyaan mengandung kata kunci komplain/nego), lalu kirim WhatsApp message ke nomor owner (nomor owner disimpan di settings table)
4. Setiap chat masuk & keluar dicatat ke tabel chat_logs

JANGAN kerjakan fitur broadcast atau multi-cabang — itu ada di daftar "Nice-to-have" yang sengaja ditunda, cek docs/roadmap.md.

Selesai kalau: saya bisa chat WhatsApp beneran ke bot, tanya stok produk dummy, dapat balasan + gambar yang benar, dan log tersimpan di chat_logs. Jangan lanjut ke Mode Personal sebelum saya bilang "lanjut".
```

---

## Fase 6 — Fitur Mode Personal

```
Sebelum mulai, baca ulang docs/features-personal-mode.md.

Tugas fase ini:
1. Sambungkan message-handler.js ke logic Mode Personal, aktif HANYA kalau config.mode === "personal"
2. Implementasikan parsing pengeluaran dari kalimat bebas: kirim pesan user ke AI dengan instruksi jelas untuk mengembalikan JSON terstruktur (kategori, jumlah, catatan), validasi hasilnya sebelum simpan ke tabel expenses (sesuai aturan validasi di .agents/rules/coding-conventions.md)
3. Implementasikan rekap on-demand: user chat "rekap bulan ini" atau sejenisnya → query expenses → AI susun ringkasan natural
4. Implementasikan reminder: simpan ke tabel reminders, jadwalkan pengiriman pakai node-cron, kirim WhatsApp ke nomor user sendiri saat waktunya tiba
5. Setelah data tersimpan, WAJIB kirim pesan konfirmasi balik ke user (sesuai docs/features-personal-mode.md)

Selesai kalau: saya bisa chat "beli kopi 20rb" ke bot dan dapat konfirmasi + data masuk ke database, lalu chat "rekap bulan ini" dan dapat ringkasan yang benar. Jangan lanjut ke Dashboard Management sebelum saya bilang "lanjut".
```

---

## Fase 7 — Dashboard Management

```
Sebelum mulai, baca ulang .agents/rules/design-system.md.

Tugas fase ini, lengkapi src/server/ (dashboard, bukan wizard):
1. Halaman Dashboard utama — status koneksi WhatsApp (badge), ringkasan singkat (jumlah chat hari ini / total produk / total pengeluaran bulan ini, sesuai mode aktif)
2. Halaman Produk (mode bisnis) atau Kategori Pengeluaran (mode personal) — CRUD lengkap dengan form + validasi inline, upload gambar untuk produk
3. Halaman Chat Log — tampilkan riwayat dari tabel chat_logs, bisa difilter per kontak
4. Halaman Settings — form ubah API key (tampil masked, tombol "Test koneksi" yang panggil fungsi validasi dari fase AI Integration), ubah nomor owner untuk human handover, ubah jam operasional
5. Sidebar navigasi sesuai design-system.md (kecuali di halaman wizard)

Setiap aksi hapus data WAJIB pakai modal konfirmasi (sesuai coding-conventions.md).

Selesai kalau: semua CRUD berfungsi lewat browser tanpa saya perlu edit database manual, dan tombol "Test koneksi" API key beneran memvalidasi. Jangan lanjut ke fase Integrasi End-to-End sebelum saya bilang "lanjut".
```

---

## Fase 8 — Integrasi End-to-End & Audit Error Handling

```
Fase ini BUKAN fase menambah fitur baru — fokus audit dan perbaikan.

Tugas:
1. Telusuri seluruh alur: pesan masuk → context-builder → AI router → balasan keluar → chat_logs, pastikan tidak ada bagian yang jalan silent-fail
2. Uji skenario gagal (dan pastikan bot tetap sopan membalas, tidak diam saja): API key kosong/invalid, AI provider timeout, database kosong (belum ada produk), pesan yang tidak berhubungan dengan bisnis/personal sama sekali
3. Cek ulang semua file sensitif (config/config.json, folder session, file .db) benar-benar masuk .gitignore dan tidak pernah ke-log ke console
4. Review ulang tiap fungsi yang lebih dari 40 baris atau file lebih dari 300 baris (sesuai coding-conventions.md), refactor kalau perlu
5. Tulis singkat di docs/roadmap.md bagian mana dari v1 yang sudah selesai vs yang masih bolong

Laporkan semua temuan sebelum memperbaiki apa pun yang di luar scope kecil — tanya saya dulu kalau perbaikannya cukup besar. Jangan lanjut ke fase Packaging sebelum saya bilang "lanjut".
```

---

## Fase 9 — Packaging & Deployment

```
Sebelum mulai, baca ulang docs/packaging-deployment.md.

Tugas fase ini, di dalam scripts/:
1. Buat scripts/build-exe.js — script otomatis untuk build project jadi single .exe pakai pkg, sertakan cara jalankan (misal: npm run build:exe)
2. Buat scripts/deploy-vps.sh — script bash untuk setup VPS baru dari nol: install Node.js, copy/clone project, npm install, setup pm2, start dengan pm2
3. Pastikan hasil build .exe otomatis membuka browser ke localhost saat dijalankan (pakai package open) — cek ulang ini benar-benar jalan dari hasil .exe, bukan cuma dari npm start
4. Tulis catatan singkat di docs/packaging-deployment.md kalau ada langkah tambahan yang ternyata dibutuhkan saat build (misal dependency native better-sqlite3 yang perlu perlakuan khusus saat di-pack)

Selesai kalau: saya bisa jalankan hasil .exe di komputer lain (tanpa Node.js terinstall) dan wizard tetap jalan normal, DAN script deploy-vps.sh berhasil dites di VPS kosong. Jangan lanjut ke fase QA Final sebelum saya bilang "lanjut".
```

---

## Fase 10 — QA Final & Persiapan Rilis

```
Fase terakhir sebelum produk dijual. Tugas:
1. Jalankan checklist manual lengkap: wizard dari nol → scan QR → isi API key → mode bisnis & personal masing-masing dites end-to-end
2. Pastikan pesan error yang muncul ke user (baik di WhatsApp maupun dashboard) semuanya bahasa manusia, tidak ada raw error/stack trace yang bocor
3. Review semua teks di UI dashboard & wizard — pastikan tidak ada jargon teknis (cek ulang .agents/rules/design-system.md bagian "Prinsip")
4. Buat ringkasan akhir: fitur apa saja yang benar-benar selesai vs yang masih di roadmap v2, untuk saya pakai sebagai bahan ebook panduan instalasi
5. JANGAN hapus data test/dummy di database secara otomatis — biarkan saya yang putuskan, ini bisa jadi database awal yang dikirim ke buyer atau di-reset dulu

Setelah ini selesai, produk versi v1 dianggap siap dibungkus jadi paket jualan (source code, installer exe, dan ebook panduan terpisah).
```
