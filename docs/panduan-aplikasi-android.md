# 📱 PANDUAN PENGGUNAAN: WA BOT BISNIS AI VERSI ANDROID (.APK)

Selamat! Anda telah memiliki **WA Bot Bisnis AI Versi Android**. Aplikasi ini dirancang khusus agar Anda bisa memiliki Customer Service (CS) dan Sales AI otomatis 24 jam nonstop **langsung di handphone Android Anda**, tanpa perlu laptop, tanpa perlu sewa VPS, dan tanpa perlu paham coding.

---

## ⚡ SPESIFIKASI HP YANG DIDUKUNG

- **Sistem Operasi:** Android 8.0 (Oreo) sampai dengan Android 14 & 15.
- **RAM:** Minimum 3 GB (Sangat lancar pada RAM 4 GB, 6 GB, atau 8 GB).
- **Chipset:** Snapdragon, MediaTek Helio/Dimensity, Exynos, Unisoc, dll.
- **Konsumsi Daya:** Sangat hemat baterai (~1–2% per jam) berkat arsitektur koneksi langsung WebSocket (tanpa browser Chromium).

---

## 📥 LANGKAH 1: CARA INSTALASI FILE .APK DI HP

1. Salin atau unduh file **`wa-bot-bisnis.apk`** ke smartphone Android Anda.
2. Buka aplikasi **File Manager** / **File Saya**, lalu ketuk file `wa-bot-bisnis.apk`.
3. Jika muncul peringatan keamanan *"Demi keamanan, ponsel Anda tidak diizinkan menginstal aplikasi yang tidak dikenal dari sumber ini"*:
   - Ketuk **Setelan / Pengaturan** (*Settings*).
   - Aktifkan toggle **"Izinkan dari sumber ini"** (*Allow from this source*).
   - Tekan tombol kembali (*Back*), lalu ketuk tombol **Instal**.
4. Tunggu beberapa detik hingga proses instalasi selesai, lalu ketuk **Buka**.

---

## 🛡️ LANGKAH 2: PENGATURAN WAJIB ANTI-KILLED (AGAR BOT AKTIF 24 JAM)

Sistem operasi Android modern memiliki fitur penghemat baterai otomatis yang dapat mematikan aplikasi di latar belakang jika tidak diberi izin. Lakukan langkah sederhana ini satu kali saja:

### 1. Izinkan Notifikasi Bar
Saat pertama kali membuka aplikasi, pilih **Izinkan (Allow)** ketika muncul permintaan izin notifikasi. Notifikasi tetap *"WA Bot Assistant Aktif Melayani Chat"* akan muncul di bar atas sebagai penjaga agar bot tidak dimatikan Android.

### 2. Izinkan Pengecualian Baterai (*Unrestricted Battery*)
Saat aplikasi menampilkan dialog permintaan pengabaian optimasi baterai, ketuk **Izinkan (Yes/Allow)**.

### 3. Pengaturan Khusus Berdasarkan Merk HP:
- **Xiaomi / Redmi / POCO (MIUI / HyperOS):**
  - Tekan lama ikon aplikasi di layar $\to$ pilih **Info Aplikasi** (*App Info*).
  - Masuk ke **Penghemat Baterai** (*Battery Saver*) $\to$ pilih **Tidak ada batasan** (*No restrictions*).
  - Aktifkan toggle **Mulai Otomatis** (*Autostart*).
- **Oppo / Realme (ColorOS / Realme UI):**
  - Tekan lama ikon aplikasi $\to$ **Info Aplikasi** $\to$ **Penggunaan Baterai**.
  - Aktifkan **Izinkan aktivitas latar belakang** (*Allow background activity*) dan **Izinkan peluncuran otomatis**.
- **Vivo / iQOO (Funtouch OS):**
  - Buka **Pengaturan** $\to$ **Baterai** $\to$ **Manajemen Konsumsi Daya Tinggi di Latar Belakang**.
  - Cari *WA Bot Assistant*, ubah menjadi **Izinkan konsumsi daya tinggi**.
- **Samsung (One UI):**
  - Tekan lama ikon aplikasi $\to$ ketuk ikon tanda seru **(i)** (*Info Aplikasi*).
  - Pilih menu **Baterai** $\to$ ubah opsi menjadi **Tidak Dibatasi** (*Unrestricted*).

---

## 🚀 LANGKAH 3: SETUP AWAL BOT MELALUI LAYAR HP (3 MENIT)

Saat aplikasi dibuka, tampilan layar controller akan otomatis menyala:

1. **Aktivasi Lisensi:**
   - Masukkan kode lisensi resmi yang Anda terima dari Lynk.id (Contoh: `WABOT-BISN-XXXX-YYYY-ZZZZ`).
2. **Langkah 1: Profil Toko:**
   - Isi nama bisnis/toko Anda dan nomor WhatsApp Admin/Owner.
3. **Langkah 2: Tautkan WhatsApp (Scan QR):**
   - Di layar aplikasi akan muncul QR Code.
   - Buka WhatsApp utama Anda di HP yang sama atau HP lain:
     - Ketuk **Titik Tiga (⋮)** di kanan atas $\to$ **Perangkat Tertaut** (*Linked Devices*).
     - Ketuk **Tautkan Perangkat** $\to$ Arahkan kamera ke QR Code di layar.
4. **Langkah 3: Masukkan API Key Gemini:**
   - Masukkan API Key Google Gemini Anda (Gratis resmi dari Google AI Studio: https://aistudio.google.com/app/apikey).
5. **Langkah 4: Masukkan Produk & Katalog:**
   - Masukkan nama produk, harga, dan stok awal toko Anda.
6. **Selesai!**
   - Bot langsung aktif 100% melayani pelanggan secara otomatis!

---

## 🎮 PENGGUNAAN SEHARI-HARI

- **Menjalankan di Latar Belakang:** Anda bebas menekan tombol **Home** atau tombol **Back**. Aplikasi akan berjalan di background dan tanda notifikasi bot akan tetap stand-by di status bar HP Anda.
- **Mengedit Produk / Menambah Stok:** Cukup buka kembali aplikasi kapan saja, masuk ke menu **Katalog Produk**, ubah data harga/stok, lalu simpan. Perubahan langsung aktif seketika.
- **Melihat Laporan & Chat:** Buka tab **Inbox Handover** untuk melihat pesan pelanggan yang butuh penanganan manusia, atau tab **Riwayat Chat** untuk melihat obrolan AI dengan pelanggan.

---

## ❓ PERTANYAAN UMUM & SOLUSI (FAQ)

### Q: Apakah bot akan berhenti jika layar HP dimatikan / dikunci?
**Jawab:** Tidak. Aplikasi sudah dilengkapi fitur *Partial WakeLock* dan *Foreground Service* bawaan Android, sehingga CPU HP tetap aktif merespons chat meskipun layar mati. Pastikan Langkah 2 (Pengaturan Baterai) sudah dilakukan dengan benar.

### Q: Bagaimana jika saya ingin mengganti nomor WhatsApp yang digunakan bot?
**Jawab:** Buka aplikasi $\to$ masuk ke menu **Pengaturan (Settings)** $\to$ ketuk tombol **Putuskan Tautan WhatsApp** $\to$ Scan ulang dengan nomor WhatsApp yang baru.

### Q: Apakah aman dari blokir WhatsApp?
**Jawab:** Sangat aman untuk kebutuhan melayani pelanggan yang menghubungi toko Anda (*inbound customer service*). Jangan gunakan bot ini untuk mengirim spam atau broadcast pesan ke ribuan nomor asing yang tidak pernah menghubungi Anda sebelumnya.

### Q: Jika HP saya restart / mati kehabisan baterai, apakah bot menyala lagi otomatis?
**Jawab:** Ya! Aplikasi memiliki fitur *Auto-Boot Receiver*, sehingga ketika HP Anda dinyalakan kembali, bot otomatis menyala di latar belakang tanpa perlu dibuka manual.
