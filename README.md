# 🤖 WhatsApp AI Bot Bisnis & Asisten Pribadi (Local Web Controller)

> **Produk digital siap pakai / source code siap jual untuk Lynk.id — Menggabungkan kecerdasan buatan (Gemini AI), database lokal SQLite, sistem multi-bubble WhatsApp alami, dan Dashboard Web Controller tanpa perlu keahlian koding bagi pengguna akhir.**

---

## 📌 1. Kenapa Software Ini Dibangun? (Latar Belakang & Masalah)

Banyak pelaku **UMKM, pebisnis online, freelancer, dan individu** yang ingin memiliki asisten WhatsApp otomatis untuk membantu operasional harian mereka. Namun, solusi yang beredar saat ini menghadapi kendala besar:

1. **Chatbot Menu Tradisional Terasa Kaku & Robotik**: Chatbot lawas berbasis *"Ketik 1 untuk Menu, Ketik 2 untuk CS"* sering membuat pelanggan frustrasi dan merasa tidak dihargai.
2. **Biaya Berlangganan SaaS Sangat Mahal**: Layanan WhatsApp Bot berbasis SaaS di pasaran umumnya mengenakan biaya langganan bulanan yang memberatkan UMKM (ratusan ribu hingga jutaan rupiah per bulan).
3. **Keterbatasan Teknis Pengguna**: Membangun bot AI sendiri memerlukan keahlian pemrograman, instalasi database server yang rumit, dan konfigurasi API yang membingungkan.
4. **Kekhawatiran Keamanan Data & Privasi**: Banyak pengguna enggan menaruh database pelanggan atau catatan keuangan pribadi mereka di server pihak ketiga yang tidak mereka kontrol.

---

## 💡 2. Untuk Apa Software Ini Dibangun? (Solusi & Tujuan)

Software ini dibangun sebagai **produk digital sekali beli (One-Time Purchase)** yang memberikan kepemilikan penuh kepada pembeli:

- **Tanpa Biaya Langganan ke Pihak Ketiga**: Pengguna menggunakan kunci API AI mereka sendiri (Google Gemini) yang memiliki *free tier* murah/gratis sesuai pemakaian nyata.
- **Konfigurasi Ramah Pemula Lewat Web Dashboard**: Semua pengaturan (gaya bahasa AI, jam operasional, katalog produk, FAQ, nomor owner) diatur lewat browser lokal (`http://localhost:3000`), bukan dengan mengedit baris kode.
- **Privasi Data 100% Lokal**: Seluruh data transaksi, CRM pelanggan, dan percakapan tersimpan aman di database lokal komputer/laptop/VPS pengguna (SQLite).
- **Interaksi Manusiawi (Human-like)**: Dilengkapi dengan *Message Debounce Buffer* (menggabungkan chat bertubi-tubi), *Smart Bubble Splitting* (memecah balasan panjang secara bertahap), dan *Typing Simulation* (jeda mengetik acak anti-ban).

---

## 🎯 3. Dua Mode Utama Sistem

Aplikasi ini dapat beralih antara 2 mode kerja secara fleksibel:

### A. 🏬 Mode Bisnis (AI Customer Service & Sales Assistant)
Dirancang khusus untuk pemilik toko online, kedai/kafe, penyedia jasa, dan UMKM:
- **Cek Stok & Katalog Produk Otomatis (RAG)**: AI menjawab pertanyaan seputar spesifikasi, ketersediaan, dan harga produk secara akurat berdasarkan database lokal.
- **Rekomendasi & Upselling Cerdas**: Memberikan saran produk terkait saat produk utama ditanyakan.
- **Smart Greeting (WIB & Status Pelanggan)**: Menyapa pelanggan secara kontekstual (pagi/siang/malam) dan membedakan sapaan untuk pelanggan baru vs pelanggan setia.
- **Auto FAQ Anti False-Positive**: Menjawab pertanyaan umum (jam buka, alamat, nomor rekening, ongkir) secepat kilat dengan pencocokan kata tingkat tinggi tanpa memicu AI berbayar.
- **Deteksi Negosiasi & Order Tracking**: Mendeteksi niat tawar-menawar harga dan otomatis mengalihkan (*handover*) ke admin manusia.
- **Gentle Follow-Up Otomatis**: Menjadwalkan follow-up sopan ke calon pembeli setelah 24 jam dengan 4 lapis perlindungan anti-spam.

### B. 👤 Mode Asisten Pribadi (Personal Assistant & Finance Tracker)
Dirancang untuk manajemen produktivitas dan finansial individu:
- **Pencatatan Pengeluaran Natural**: Cukup ketik *"Beli makan siang nasi padang 25rb"*, bot otomatis mengekstrak nominal, kategori, dan mencatatnya ke database.
- **Rekapitulasi Keuangan On-Demand**: Rekap mingguan, bulanan, dan evaluasi limit anggaran (*budget alert*).
- **Pengingat Fleksibel (Reminder Scheduler)**: Pengingat sekali waktu atau berulang harian/mingguan dengan fitur tunda (*snooze*).
- **Manajemen Catatan & Tugas (Notes & Todos)**: Mencatat to-do list, ide cepat, dan menandai tugas yang selesai.
- **Habit Tracker, Daily Journal & Goals**: Melacak konsistensi kebiasaan (streak), jurnal perasaan, dan target pencapaian pribadi.

---

## 🖥️ 4. Fitur Utama Web Controller Dashboard

Web Controller lokal dapat diakses melalui browser pada `http://localhost:3000`:

1. **Setup Wizard 4 Langkah**: Panduan pemilihan mode, scan QR WhatsApp, pengisian API Key, dan input data perdana.
2. **Katalog Produk & CRM Pelanggan**: Mengelola database barang dagangan, riwayat belanja, dan preferensi pelanggan.
3. **FAQ Manager & Handover Inbox**: Mengelola template FAQ otomatis dan tiket pelanggan yang meminta bantuan admin.
4. **AI Training & Business Knowledge**: Menambahkan dokumen PDF/TXT profil usaha untuk memperkaya pengetahuan AI.
5. **Executive Analytics**: Grafik performa pesan masuk, jam tersibuk, produk terlaris, dan rekomendasi strategi bisnis berbasis AI.
6. **Export & Backup Data**: Unduh seluruh data dalam format CSV/JSON kapan saja.

---

## 💰 5. Model Distribusi Penjualan (Digital Product Lynk.id)

Produk ini disiapkan dalam 3 tingkatan paket penjualan:
- **Paket Basic (Source Code Edition)**: Source code lengkap + panduan instalasi step-by-step untuk pengguna yang paham teknologi.
- **Paket Pro (Installer Edition)**: File executable (`.exe`) siap klik jalan tanpa perlu instalasi Node.js manual.
- **Paket Reseller / Agency (White-Label License)**: Hak jual ulang atau pemasangan ke klien UMKM dengan merek sendiri.

---

## 🛠️ 6. Panduan Menjalankan Cepat (Quick Start)

### Persyaratan:
- Node.js versi 18 atau lebih baru.
- Google Gemini API Key (dapat diperoleh gratis di [Google AI Studio](https://aistudio.google.com/)).

### Langkah Menjalankan:
```bash
# 1. Clone repository
git clone https://github.com/ervanfahriaw/product-wa-bot.git
cd product-wa-bot

# 2. Install dependensi
npm install

# 3. Jalankan aplikasi
npm start

# 4. Buka Web Dashboard di browser:
# http://localhost:3000
```

### Menjalankan Pengujian Kualitas (Testing Suite):
```bash
npm test                # Master QA Audit A-Z (52/52 passed)
npm run test:enhancement # Uji perbaikan AI & Handover (22/22 passed)
npm run test:faq        # Uji Auto FAQ (18/18 passed)
npm run test:followup   # Uji Follow-up Scheduler (20/20 passed)
```

---

## ⚠️ 7. Batasan & Ketentuan Penggunaan (Disclosure)

- Aplikasi ini menggunakan library `whatsapp-web.js` (otomatisasi web client). Gunakan secara bijak dan wajar untuk layanan pelanggan atau asisten pribadi. Dilarang keras digunakan untuk aktivitas spamming massal atau broadcast ilegal yang melanggar ketentuan layanan WhatsApp.
- Bot memerlukan komputer/laptop atau VPS yang tetap menyala dan terhubung ke internet agar dapat membalas pesan secara realtime 24 jam.

---

## 📄 8. Dokumentasi Teknis Lanjutan

- 📘 [Brief Produk & Latar Belakang](docs/brief.md)
- 🏗️ [Arsitektur Sistem & Data Flow](docs/architecture.md)
- 🗄️ [Skema Database 21 Tabel](docs/database-schema.md)
- 🚀 [Panduan Packaging & Deployment (.EXE / PM2 / VPS)](docs/packaging-deployment.md)
- 🗺️ [Roadmap Pengembangan Fitur](docs/roadmap.md)
- 📝 [Catatan Rilis & Riwayat Versi](docs/release-notes-v1.md)
