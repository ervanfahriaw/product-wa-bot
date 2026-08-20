# BUKU PANDUAN LENGKAP
# WA Bot Bisnis AI — Customer Service & Penjualan Otomatis 24/7

---

## ⚠️ DISCLAIMER & PEMBERITAHUAN PENTING

**WA Bot Bisnis AI** adalah produk digital pihak ketiga (*third-party*) yang dibuat secara independen. Produk ini:

- ❌ **BUKAN** produk resmi dari WhatsApp, Meta, atau Google.
- ❌ **BUKAN** afiliasi, sponsor, atau endorsed oleh WhatsApp Inc.
- ✅ Menggunakan library open-source `whatsapp-web.js` untuk terhubung ke WhatsApp Web.
- ✅ Menggunakan Google Gemini AI API untuk kemampuan membalas pesan secara cerdas.

**Dengan menggunakan produk ini, Anda memahami dan menyetujui bahwa:**
1. Penggunaan bot pada akun WhatsApp Anda menjadi tanggung jawab Anda sepenuhnya.
2. WhatsApp berhak membatasi akun yang melanggar *Terms of Service* mereka (misalnya: spam massal).
3. Pengembang tidak bertanggung jawab atas pemblokiran akun WhatsApp akibat penyalahgunaan.
4. Disarankan menggunakan bot ini hanya untuk membalas pesan masuk (*inbound*), bukan untuk mengirim pesan broadcast massal ke nomor yang tidak dikenal.

---

## 📖 DAFTAR ISI

1. [Tentang Produk](#1-tentang-produk)
2. [Persyaratan Sistem](#2-persyaratan-sistem)
3. [Opsi Menjalankan Bot](#3-opsi-menjalankan-bot)
4. [Isi Paket yang Anda Terima](#4-isi-paket-yang-anda-terima)
5. [OPSI A: Menjalankan di Laptop/PC (Gratis)](#5-opsi-a-menjalankan-di-laptoppc-gratis)
6. [OPSI B: Menjalankan di VPS Cloud (Berbayar)](#6-opsi-b-menjalankan-di-vps-cloud-berbayar)
7. [Setup Wizard: Konfigurasi Awal Bot](#7-setup-wizard-konfigurasi-awal-bot)
8. [Mengenal Dashboard Web Controller](#8-mengenal-dashboard-web-controller)
9. [Cara Mendapatkan API Key Gemini (Gratis)](#9-cara-mendapatkan-api-key-gemini-gratis)
10. [Penggunaan Sehari-hari & Tips](#10-penggunaan-sehari-hari--tips)
11. [Troubleshooting / Masalah Umum](#11-troubleshooting--masalah-umum)
12. [FAQ (Pertanyaan Sering Ditanyakan)](#12-faq-pertanyaan-sering-ditanyakan)
13. [Kontak & Dukungan](#13-kontak--dukungan)

---

## 1. TENTANG PRODUK

### Apa itu WA Bot Bisnis AI?

**WA Bot Bisnis AI** adalah software asisten cerdas yang berjalan di nomor WhatsApp toko/bisnis Anda. Bot ini mampu:

- 🛍️ **Menjawab pertanyaan pelanggan** tentang produk, harga, dan ketersediaan stok secara otomatis.
- 📦 **Menampilkan katalog produk** lengkap dengan gambar dan deskripsi.
- 💬 **Membalas chat pelanggan 24 jam** dengan gaya bahasa natural layaknya admin toko sungguhan.
- 🧠 **Merekomendasikan produk** berdasarkan kebutuhan pelanggan menggunakan kecerdasan buatan (AI).
- 🔔 **Meneruskan chat penting** (negosiasi harga, komplain, permintaan khusus) langsung ke nomor pemilik toko.
- 📊 **Mencatat & menganalisa** seluruh percakapan, pesanan, dan profil pelanggan.
- 🤖 **Membuat FAQ otomatis** dari pertanyaan yang sering diajukan pelanggan.

### Bagaimana Cara Kerjanya?

Bot ini bekerja dengan menghubungkan nomor WhatsApp Anda melalui fitur **Perangkat Tertaut** (sama seperti WhatsApp Web). Setiap ada pesan masuk, bot akan:

1. Membaca dan memahami isi pesan menggunakan **Google Gemini AI**.
2. Mencari informasi relevan di **database produk** toko Anda.
3. Menyusun balasan yang natural dan informatif.
4. Mengirimkan balasan secara otomatis ke pelanggan.

> **Catatan:** Bot hanya membalas pesan yang masuk ke nomor WhatsApp bot. WhatsApp pribadi Anda di HP tetap berjalan normal.

---

## 2. PERSYARATAN SISTEM

### Untuk Opsi Gratis (Laptop/PC):
| Komponen | Minimum |
|---|---|
| Sistem Operasi | Windows 10 / 11 (64-bit) |
| RAM | 4 GB (Disarankan 8 GB) |
| Penyimpanan | 500 MB ruang kosong |
| Internet | Koneksi stabil (WiFi / Ethernet) |
| Browser | Google Chrome / Microsoft Edge (terbaru) |
| WhatsApp | Akun WhatsApp aktif di HP |

### Untuk Opsi Berbayar (VPS Cloud):
| Komponen | Minimum |
|---|---|
| Sistem Operasi VPS | Ubuntu 20.04 / 22.04 LTS |
| RAM VPS | 1 GB (Disarankan 2 GB) |
| Penyimpanan VPS | 10 GB SSD |
| Akses | SSH ke VPS (terminal) |

---

## 3. OPSI MENJALANKAN BOT

Anda memiliki **2 pilihan** cara menjalankan bot ini:

### 🆓 OPSI A: Gratis di Laptop/PC Sendiri

| Kelebihan | Kekurangan |
|---|---|
| ✅ Gratis, tanpa biaya bulanan | ❌ Bot mati jika laptop dimatikan |
| ✅ Mudah, tinggal double-click | ❌ Perlu koneksi internet terus |
| ✅ Data tersimpan lokal di laptop Anda | ❌ Tidak bisa 24 jam nonstop |
| ✅ Cocok untuk percobaan awal | |

### ☁️ OPSI B: Berbayar di VPS Cloud (Online 24 Jam)

| Kelebihan | Kekurangan |
|---|---|
| ✅ Bot aktif 24/7 nonstop | ❌ Biaya VPS ±Rp 30.000-80.000/bulan |
| ✅ Tidak perlu menyalakan laptop | ❌ Perlu sedikit kemampuan teknis |
| ✅ Bisa diakses dari mana saja | ❌ Perlu setup awal di terminal VPS |
| ✅ Cocok untuk toko yang sudah jalan | |

> **Rekomendasi:** Mulai dengan Opsi A (gratis) untuk mencoba. Jika sudah cocok dan butuh bot aktif 24 jam, upgrade ke Opsi B.

---

## 4. ISI PAKET YANG ANDA TERIMA

Setelah mengunduh dan mengekstrak file ZIP, Anda akan melihat isi folder berikut:

```
📁 wa-bot-bisnis/
├── 📄 wa-bot-bisnis.exe          ← Aplikasi utama (double-click untuk mulai)
├── 📄 start-bisnis.bat           ← Alternatif peluncur cepat
├── 📄 PANDUAN_PENGGUNAAN.txt     ← Panduan singkat
├── 📄 deploy-vps-bisnis.sh       ← Script otomatis untuk VPS Cloud
├── 📄 better_sqlite3.node        ← Driver database (jangan dihapus)
└── 📁 config/
    ├── 📄 edition.json           ← Identitas edisi (jangan diubah)
    └── 📄 config.json.example    ← Contoh konfigurasi
```

> ⚠️ **Penting:** Jangan menghapus, memindahkan, atau mengganti nama file `better_sqlite3.node` dan folder `config/`. File-file ini dibutuhkan agar aplikasi berjalan dengan benar.

`[GAMBAR: Screenshot isi folder wa-bot-bisnis setelah di-extract dari ZIP. Tampilkan Windows Explorer/File Explorer yang menunjukkan semua file di atas.]`

---

## 5. OPSI A: MENJALANKAN DI LAPTOP/PC (GRATIS)

### Langkah 1: Ekstrak File ZIP

1. Buka folder tempat Anda menyimpan file hasil download dari Lynk.id.
2. Klik kanan pada file **`WA_Bot_Bisnis_AI.zip`**.
3. Pilih **"Extract All..."** atau **"Ekstrak Semua..."**.
4. Pilih lokasi folder tujuan, lalu klik **"Extract"**.

`[GAMBAR: Screenshot klik kanan pada file ZIP dan menu "Extract All" di Windows Explorer.]`

### Langkah 2: Jalankan Aplikasi

1. Buka folder hasil ekstrak **`wa-bot-bisnis`**.
2. **Double-click** pada file **`wa-bot-bisnis.exe`**.

`[GAMBAR: Screenshot Windows Explorer menunjukkan file wa-bot-bisnis.exe yang di-highlight, siap di-double-click.]`

3. Akan muncul jendela **Command Prompt** (layar hitam) yang menampilkan proses startup:

```
======================================================
  🚀 WA Bot Web Controller berjalan di http://localhost:3000
======================================================
```

`[GAMBAR: Screenshot jendela Command Prompt yang menampilkan pesan startup di atas. Jendela konsol hitam dengan teks hijau/putih.]`

4. **Browser Anda akan otomatis terbuka** ke halaman `http://localhost:3000` dan menampilkan Setup Wizard.

> ⚠️ **Jangan tutup jendela Command Prompt!** Jika ditutup, bot akan berhenti berjalan. Biarkan jendela tersebut terbuka selama Anda ingin bot aktif.

> 💡 **Jika browser tidak terbuka otomatis:** Buka browser (Chrome/Edge) secara manual, lalu ketik `http://localhost:3000` di address bar.

### Langkah 3: Lanjut ke Setup Wizard

Setelah browser terbuka, Anda akan melihat halaman **Setup Wizard** (lihat [Bab 7](#7-setup-wizard-konfigurasi-awal-bot) untuk panduan lengkap setup).

### Cara Mematikan Bot

1. Klik pada jendela **Command Prompt**.
2. Tekan **`Ctrl + C`** di keyboard.
3. Ketik **`Y`** lalu tekan **Enter** jika diminta konfirmasi.

### Cara Menyalakan Kembali

Cukup **double-click** lagi pada file **`wa-bot-bisnis.exe`**. Semua data dan pengaturan Anda tersimpan dan tidak hilang.

---

## 6. OPSI B: MENJALANKAN DI VPS CLOUD (BERBAYAR)

### 6.1 Sewa VPS Linux

Anda perlu menyewa VPS (Virtual Private Server) dari penyedia layanan cloud. Berikut beberapa rekomendasi:

| Penyedia | Harga Mulai | Website |
|---|---|---|
| DigitalOcean | $4/bulan (~Rp 64.000) | digitalocean.com |
| Vultr | $3.50/bulan (~Rp 56.000) | vultr.com |
| Contabo | €3.99/bulan (~Rp 68.000) | contabo.com |
| IDCloudHost | Rp 30.000/bulan | idcloudhost.com |
| Niagahoster VPS | Rp 50.000/bulan | niagahoster.co.id |

**Spesifikasi VPS yang disarankan:**
- **OS:** Ubuntu 22.04 LTS
- **RAM:** 1-2 GB
- **Storage:** 10-20 GB SSD
- **Lokasi server:** Singapore atau Jakarta (terdekat)

`[GAMBAR: Screenshot halaman pembuatan VPS/Droplet di salah satu penyedia (misal DigitalOcean atau IDCloudHost), menunjukkan pilihan spesifikasi yang direkomendasikan.]`

### 6.2 Akses VPS via SSH

Setelah VPS aktif, Anda akan menerima:
- **IP Address** VPS (contoh: `103.123.45.67`)
- **Username** (biasanya `root`)
- **Password** atau SSH Key

**Cara mengakses VPS dari Windows:**

1. Buka aplikasi **PowerShell** atau **Command Prompt**.
2. Ketik perintah berikut (ganti IP dengan IP VPS Anda):

```bash
ssh root@103.123.45.67
```

3. Masukkan password VPS saat diminta (karakter tidak terlihat saat mengetik, ini normal).
4. Jika berhasil, Anda akan melihat tampilan terminal VPS:

```
root@vps-server:~#
```

`[GAMBAR: Screenshot terminal PowerShell/CMD yang berhasil masuk ke VPS melalui SSH, menampilkan prompt root@vps-server.]`

> 💡 **Alternatif:** Anda juga bisa menggunakan aplikasi **PuTTY** (gratis) untuk mengakses SSH.

### 6.3 Upload File Bot ke VPS

Ada beberapa cara untuk mengupload folder bot ke VPS:

**Cara 1: Menggunakan SCP (dari PowerShell Windows):**

```bash
scp -r "C:\Users\Anda\Downloads\wa-bot-bisnis" root@103.123.45.67:/root/
```

**Cara 2: Menggunakan FileZilla (GUI, lebih mudah):**

1. Download dan install **FileZilla** dari `filezilla-project.org`.
2. Masukkan Host: `103.123.45.67`, Username: `root`, Password: `[password VPS]`, Port: `22`.
3. Klik **Quickconnect**.
4. Drag folder `wa-bot-bisnis` dari panel kiri (komputer Anda) ke panel kanan (VPS) di folder `/root/`.

`[GAMBAR: Screenshot FileZilla yang menunjukkan proses drag-and-drop folder wa-bot-bisnis dari komputer lokal ke VPS.]`

### 6.4 Jalankan Script Otomatis

Setelah file terupload, jalankan perintah berikut di terminal VPS:

```bash
cd /root/wa-bot-bisnis
chmod +x deploy-vps-bisnis.sh
./deploy-vps-bisnis.sh
```

Script ini akan secara otomatis:
- ✅ Menginstal Node.js v20 LTS
- ✅ Menginstal dependensi browser Chromium
- ✅ Menginstal PM2 (Process Manager agar bot tetap hidup)
- ✅ Menjalankan bot di background

Setelah selesai, Anda akan melihat pesan:

```
======================================================
  🎉 WA BOT BISNIS AI BERHASIL DIJALANKAN DI CLOUD VPS!
======================================================
Akses Dashboard Web Controller di browser Anda:
👉 http://103.123.45.67:3000
======================================================
```

`[GAMBAR: Screenshot terminal VPS yang menampilkan pesan sukses deployment di atas.]`

### 6.5 Akses Dashboard dari Browser

1. Buka browser di HP atau laptop Anda.
2. Ketik alamat: `http://[IP_VPS_ANDA]:3000`
   - Contoh: `http://103.123.45.67:3000`
3. Halaman **Setup Wizard** akan muncul (lihat [Bab 7](#7-setup-wizard-konfigurasi-awal-bot)).

### 6.6 Perintah Berguna untuk VPS

| Perintah | Fungsi |
|---|---|
| `pm2 status` | Cek apakah bot sedang berjalan |
| `pm2 logs wa-bot-bisnis` | Lihat log/catatan aktivitas bot |
| `pm2 restart wa-bot-bisnis` | Restart bot jika bermasalah |
| `pm2 stop wa-bot-bisnis` | Matikan bot sementara |
| `pm2 start wa-bot-bisnis` | Nyalakan kembali bot |

---

## 7. SETUP WIZARD: KONFIGURASI AWAL BOT

Saat pertama kali membuka browser (`http://localhost:3000`), Anda akan diarahkan ke **Setup Wizard**. Ikuti langkah-langkah mudah berikut:

### Langkah 0: Aktivasi Lisensi Resmi Lynk.id

Sebagai pembeli resmi, Anda mendapatkan **Kode Lisensi (License Key)** yang tertera di email pembelian / dashboard Lynk.id Anda.

1. Masukkan kode lisensi Anda pada kolom **"Kode Lisensi"** (Contoh format: `WABOT-BIZ-XXXX-YYYY-ZZZZ`).
2. Sistem akan secara otomatis mendeteksi **Hardware ID (HWID)** perangkat Anda dan menguncinya untuk keamanan Anda.
3. Klik tombol **"Aktifkan & Lanjutkan ke Setup →"**.

`[GAMBAR: Screenshot halaman Aktivasi Lisensi Resmi (Step 0) dengan badge hijau, input License Key, dan tampilan Hardware ID.]`

> 💡 **Penting:** 1 Kode Lisensi berlaku untuk 1 perangkat utama (Laptop/PC/VPS). Anda dapat memindahkan lisensi ke laptop baru kapan saja melalui menu **Pengaturan > Pindah Perangkat**.

---

### Langkah 1: Profil Bisnis

Setelah lisensi aktif, isi informasi dasar bisnis Anda:

| Field | Keterangan | Contoh |
|---|---|---|
| **Nama Brand / Toko** | Nama toko Anda yang akan digunakan bot saat menyapa pelanggan | Kopi Nusantara |
| **Nomor WhatsApp Pemilik** | Nomor HP pemilik untuk menerima notifikasi chat penting (negosiasi/komplain) | 628123456789 |

> 💡 Format nomor: Awali dengan kode negara `62` (Indonesia), tanpa tanda `+`. Contoh: `628123456789`

Setelah mengisi, klik tombol **"Lanjut: Sambungkan WhatsApp →"**.

`[GAMBAR: Screenshot halaman Setup Wizard Langkah 1, menampilkan form "Selamat Datang di WA Bot Bisnis AI" dengan badge Bisnis Edition, field Nama Toko dan Nomor WhatsApp, serta tombol Lanjut.]`

### Langkah 2: Sambungkan WhatsApp (Scan QR)

Pada halaman ini, Anda akan melihat **QR Code** yang harus di-scan menggunakan WhatsApp di HP Anda.

**Cara scan QR Code:**

1. Buka aplikasi **WhatsApp** di HP Anda.
2. **Android:** Tap menu titik tiga (⋮) di kanan atas → pilih **"Perangkat Tertaut"** → tap **"Tautkan Perangkat"**.
3. **iPhone:** Tap **"Pengaturan"** (⚙️) di kanan bawah → tap **"Perangkat Tertaut"** → tap **"Tautkan Perangkat"**.
4. Arahkan kamera HP ke **QR Code** yang tampil di layar browser/monitor.
5. Tunggu hingga status berubah menjadi **"Terhubung"** (ditandai indikator hijau).

`[GAMBAR: Screenshot halaman Setup Wizard Langkah 2 yang menampilkan QR Code di layar browser.]`

`[GAMBAR: Screenshot HP Android/iPhone menunjukkan menu "Perangkat Tertaut" → "Tautkan Perangkat" di WhatsApp.]`

> ⚠️ **QR Code berubah setiap 30 detik.** Jika kedaluwarsa, klik tombol "Refresh QR" untuk mendapatkan yang baru.

> ⚠️ **Pastikan HP dan komputer/VPS terhubung ke internet** saat proses scan QR.

Setelah berhasil terhubung, klik tombol **"Lanjut →"**.

### Langkah 3: Kunci Akses AI (Gemini API Key)

Bot membutuhkan **API Key dari Google Gemini AI** agar dapat memahami dan membalas pesan secara cerdas.

| Field | Keterangan |
|---|---|
| **Gemini API Key** *(Wajib)* | Kunci akses AI dari Google (gratis). Lihat cara mendapatkannya di [Bab 9](#9-cara-mendapatkan-api-key-gemini-gratis). |
| **Grok API Key** *(Opsional)* | Kunci akses AI alternatif dari xAI (tidak wajib diisi). |

Masukkan API Key, lalu klik **"Simpan & Lanjut →"**.

`[GAMBAR: Screenshot halaman Setup Wizard Langkah 3, menampilkan form Kunci Akses AI dengan field Gemini API Key dan info bahwa gratis dari Google.]`

### Langkah 4: Data Awal Katalog Produk

Masukkan minimal 1 contoh produk agar bot mengenal katalog toko Anda.

| Field | Keterangan | Contoh |
|---|---|---|
| **Nama Produk** | Nama produk yang dijual | Kopi Susu Gula Aren |
| **Harga** | Harga dalam Rupiah | 18000 |
| **Stok** | Jumlah stok tersedia | 50 |
| **Deskripsi** | Keterangan singkat produk | Kopi susu dengan gula aren asli, rasa manis legit |

> 💡 Anda bisa menambahkan lebih banyak produk nanti melalui menu **"Katalog Produk"** di Dashboard.

> 💡 Jika belum siap memasukkan data, klik **"Lewati & Selesaikan"** untuk melewati langkah ini.

Klik **"Selesai"** untuk menyelesaikan setup. Anda akan langsung diarahkan ke **Dashboard** utama.

`[GAMBAR: Screenshot halaman Setup Wizard Langkah 4, menampilkan form input produk dengan field Nama, Harga, Stok, dan Deskripsi.]`

---

## 8. MENGENAL DASHBOARD WEB CONTROLLER

Setelah setup selesai, Anda akan masuk ke **Dashboard** utama. Berikut penjelasan setiap menu:

`[GAMBAR: Screenshot Dashboard utama lengkap, menampilkan sidebar kiri dengan menu-menu dan area konten utama dengan kartu statistik.]`

### Menu Sidebar

| Menu | Fungsi |
|---|---|
| 📊 **Dashboard** | Ringkasan statistik: jumlah produk, chat hari ini, pesanan baru, penggunaan token AI. |
| 📈 **Analisis Bisnis** | Grafik dan insight performa bot: tren chat, produk terlaris, jam sibuk. |
| 🛍️ **Katalog Produk** | Tambah, edit, hapus produk di katalog toko. Upload gambar produk. |
| 👥 **Pelanggan** | Daftar profil pelanggan yang pernah chat, riwayat interaksi. |
| ❓ **FAQ Otomatis** | Pertanyaan yang sering diajukan pelanggan, dihasilkan otomatis oleh AI. |
| 📦 **Daftar Pesanan** | Pesanan yang tercatat dari percakapan pelanggan. |
| 📥 **Inbox Handover** | Chat yang perlu ditangani manual oleh Anda (nego harga, komplain, dll). |
| ⚙️ **Pengaturan** | Pengaturan koneksi WhatsApp, API Key, gaya bahasa bot, jam operasional, dll. |

### Pengaturan Penting di Menu "Pengaturan"

| Pengaturan | Fungsi | Rekomendasi |
|---|---|---|
| **Gaya Bahasa** | Cara bot berbicara ke pelanggan | "Ramah" untuk toko umum |
| **Panjang Jawaban** | Panjang balasan bot | "Sedang" agar tidak terlalu panjang |
| **Level Emoji** | Seberapa banyak emoji yang digunakan | "Wajar" |
| **Jam Operasional** | Jam berapa bot aktif membalas | Kosongkan = 24 jam |
| **Jumlah Bubble** | Berapa pesan balasan per respons | 2-3 bubble (natural) |

`[GAMBAR: Screenshot halaman Pengaturan yang menampilkan opsi gaya bahasa, panjang jawaban, emoji level, dan jam operasional.]`

---

## 9. CARA MENDAPATKAN API KEY GEMINI (GRATIS)

API Key Gemini AI dapat diperoleh **gratis** dari Google. Tidak memerlukan kartu kredit.

### Langkah-langkah:

1. Buka browser, kunjungi: **https://aistudio.google.com/app/apikey**
2. Login menggunakan **akun Google** Anda (Gmail).
3. Klik tombol **"Create API Key"** (Buat Kunci API).

`[GAMBAR: Screenshot halaman Google AI Studio yang menunjukkan tombol "Create API Key".]`

4. Pilih project (bisa menggunakan default), lalu klik **"Create API Key in new project"**.
5. **Salin (Copy) API Key** yang ditampilkan.

`[GAMBAR: Screenshot API Key yang berhasil dibuat, menunjukkan string key yang dimulai dengan "AIza..." dan tombol Copy.]`

6. **Simpan API Key** ini dengan aman. Anda akan memasukkannya pada **Setup Wizard Langkah 3**.

> ⚠️ **Jangan bagikan API Key Anda ke orang lain.** API Key ibarat kunci rumah — siapa pun yang memilikinya bisa menggunakan kuota AI Anda.

### Batas Penggunaan Gratis (Free Tier)

| Model | Batas Gratis |
|---|---|
| Gemini Flash | 15 request/menit, 1.500 request/hari |
| Gemini Pro | 2 request/menit, 50 request/hari |

> 💡 Untuk toko kecil-menengah (kurang dari 100 chat/hari), kuota gratis biasanya lebih dari cukup.

---

## 10. PENGGUNAAN SEHARI-HARI & TIPS

### ✅ Tips Agar Bot Bekerja Optimal

1. **Lengkapi Katalog Produk** — Semakin lengkap data produk (nama, harga, stok, deskripsi, gambar), semakin akurat balasan bot.
2. **Update Stok Secara Rutin** — Pastikan stok di katalog sesuai kenyataan agar bot tidak memberikan info yang salah.
3. **Periksa Inbox Handover** — Cek chat yang diteruskan ke Anda secara berkala (pelanggan nego/komplain).
4. **Sesuaikan Gaya Bahasa** — Sesuaikan tone bot dengan brand Anda (santai untuk coffee shop, formal untuk toko resmi).
5. **Tambahkan FAQ** — Masukkan jawaban untuk pertanyaan yang sering ditanyakan agar bot semakin pintar.

### ⛔ Yang Harus Dihindari

1. **Jangan gunakan bot untuk spam** — Mengirim pesan broadcast massal ke nomor yang tidak dikenal.
2. **Jangan bagikan API Key** — Siapa pun yang memiliki key Anda bisa menghabiskan kuota AI.
3. **Jangan tutup jendela Command Prompt** (Opsi A) — Bot akan mati jika jendela konsol ditutup.
4. **Jangan edit file `edition.json`** — Bisa menyebabkan bot tidak berjalan.

### 🔄 Rutinitas yang Disarankan

| Frekuensi | Aktivitas |
|---|---|
| Setiap hari | Cek Inbox Handover, balas chat manual yang tertunda |
| Setiap minggu | Update stok produk, periksa Analisis Bisnis |
| Setiap bulan | Review FAQ Otomatis, tambah produk baru |

---

## 11. TROUBLESHOOTING / MASALAH UMUM

### Masalah 1: "wa-bot-bisnis.exe tidak mau dibuka / tidak terjadi apa-apa"

**Penyebab:** Windows Defender atau antivirus memblokir file `.exe` karena dianggap dari sumber tidak dikenal.

**Solusi:**
1. Klik kanan pada `wa-bot-bisnis.exe` → pilih **Properties**.
2. Di bagian bawah, centang **"Unblock"** → klik **Apply** → **OK**.
3. Jika masih diblokir, tambahkan folder `wa-bot-bisnis` ke **exclusion list** antivirus Anda.

`[GAMBAR: Screenshot Properties file .exe yang menunjukkan checkbox "Unblock" di bagian Security.]`

### Masalah 2: "Browser tidak terbuka otomatis"

**Solusi:** Buka browser secara manual, lalu ketik `http://localhost:3000` di address bar.

### Masalah 3: "QR Code tidak muncul atau terus loading"

**Penyebab:** Browser Chromium (digunakan internal oleh bot) gagal diinisialisasi.

**Solusi:**
1. Tutup aplikasi bot (Ctrl+C di Command Prompt).
2. Pastikan koneksi internet stabil.
3. Jalankan ulang `wa-bot-bisnis.exe`.

### Masalah 4: "Bot terhubung tapi tidak membalas pesan"

**Penyebab:** API Key Gemini belum diisi atau salah.

**Solusi:**
1. Buka Dashboard → menu **Pengaturan**.
2. Periksa apakah **Gemini API Key** sudah terisi dengan benar.
3. Klik **"Tes Koneksi AI"** untuk memverifikasi.

### Masalah 5: "WhatsApp terputus setelah beberapa hari"

**Penyebab:** Sesi WhatsApp Web kedaluwarsa (normal terjadi).

**Solusi:**
1. Buka Dashboard → menu **Pengaturan**.
2. Klik **"Ganti Perangkat / Scan QR"**.
3. Scan ulang QR Code dari HP Anda.

### Masalah 6: "Port 3000 sudah digunakan" (khusus VPS)

**Solusi:** Jalankan perintah berikut di terminal VPS:

```bash
pm2 stop wa-bot-bisnis
pm2 delete wa-bot-bisnis
EDITION=bisnis pm2 start src/server/index.js --name "wa-bot-bisnis"
```

---

## 12. FAQ (PERTANYAAN SERING DITANYAKAN)

**Q: Apakah nomor WhatsApp pribadi saya akan terganggu?**
> A: Tidak. Bot berjalan melalui fitur "Perangkat Tertaut" (seperti WhatsApp Web). WhatsApp di HP Anda tetap bisa digunakan normal.

**Q: Apakah chat lama saya bisa dibaca oleh bot?**
> A: Tidak. Bot hanya membaca pesan baru yang masuk setelah bot dihubungkan.

**Q: Berapa banyak pelanggan yang bisa dilayani bot sekaligus?**
> A: Tidak ada batasan jumlah pelanggan. Bot memproses pesan satu per satu secara berurutan dengan sangat cepat.

**Q: Apakah data pelanggan saya aman?**
> A: Ya. Semua data (chat, produk, pelanggan) tersimpan lokal di database komputer/VPS Anda. Tidak ada data yang dikirim ke server pihak ketiga selain Google Gemini AI (untuk memproses balasan).

**Q: Apakah saya bisa mengubah bahasa bot?**
> A: Bot secara default berbahasa Indonesia. Gaya bahasa bisa disesuaikan melalui menu Pengaturan (santai, ramah, atau formal).

**Q: Bagaimana jika kuota AI gratis habis?**
> A: Google memberikan kuota harian yang di-reset setiap hari. Untuk toko kecil-menengah, kuota gratis biasanya cukup. Jika kuota habis, bot akan berhenti membalas hingga kuota di-reset keesokan harinya.

**Q: Apakah bisa menggunakan 2 nomor WhatsApp berbeda?**
> A: Satu instalasi bot = satu nomor WhatsApp. Untuk 2 nomor, Anda perlu menjalankan 2 instalasi terpisah di port berbeda.

**Q: Apakah ada pembaruan/update produk?**
> A: Pembaruan akan diinformasikan melalui Lynk.id. Anda bisa mengunduh versi terbaru tanpa kehilangan data lama.

---

## 13. KONTAK & DUKUNGAN

Jika Anda mengalami kendala atau membutuhkan bantuan:

| Channel | Detail |
|---|---|
| 📧 Email | [ISI EMAIL SUPPORT ANDA] |
| 💬 WhatsApp | [ISI NOMOR WA SUPPORT ANDA] |
| 🌐 Website | [ISI WEBSITE/LYNK.ID ANDA] |

> **Jam Support:** Senin – Jumat, 09.00 – 17.00 WIB
> **Waktu Respons:** Maksimal 1x24 jam di hari kerja.

---

**Terima kasih telah memilih WA Bot Bisnis AI!** 🚀
Semoga bot ini membantu toko Anda melayani lebih banyak pelanggan dengan lebih cepat dan efisien.

*— Tim Pengembang*

---
*Versi Dokumen: 1.0 | Terakhir diperbarui: Agustus 2026*
