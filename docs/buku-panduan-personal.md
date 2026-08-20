# BUKU PANDUAN LENGKAP
# WA Asisten Pribadi AI — Pencatatan Keuangan & Produktivitas Otomatis

---

## ⚠️ DISCLAIMER & PEMBERITAHUAN PENTING

**WA Asisten Pribadi AI** adalah produk digital pihak ketiga (*third-party*) yang dibuat secara independen. Produk ini:

- ❌ **BUKAN** produk resmi dari WhatsApp, Meta, atau Google.
- ❌ **BUKAN** afiliasi, sponsor, atau endorsed oleh WhatsApp Inc.
- ✅ Menggunakan library open-source `whatsapp-web.js` untuk terhubung ke WhatsApp Web.
- ✅ Menggunakan Google Gemini AI API untuk kemampuan memahami perintah bahasa natural.

**Dengan menggunakan produk ini, Anda memahami dan menyetujui bahwa:**
1. Penggunaan bot pada akun WhatsApp Anda menjadi tanggung jawab Anda sepenuhnya.
2. WhatsApp berhak membatasi akun yang melanggar *Terms of Service* mereka.
3. Pengembang tidak bertanggung jawab atas pemblokiran akun WhatsApp akibat penyalahgunaan.
4. Data keuangan dan catatan pribadi Anda tersimpan lokal di perangkat Anda — bukan di server kami.

---

## 📖 DAFTAR ISI

1. [Tentang Produk](#1-tentang-produk)
2. [Persyaratan Sistem](#2-persyaratan-sistem)
3. [Opsi Menjalankan Asisten](#3-opsi-menjalankan-asisten)
4. [Isi Paket yang Anda Terima](#4-isi-paket-yang-anda-terima)
5. [OPSI A: Menjalankan di Laptop/PC (Gratis)](#5-opsi-a-menjalankan-di-laptoppc-gratis)
6. [OPSI B: Menjalankan di VPS Cloud (Berbayar)](#6-opsi-b-menjalankan-di-vps-cloud-berbayar)
7. [Setup Wizard: Konfigurasi Awal Asisten](#7-setup-wizard-konfigurasi-awal-asisten)
8. [Mengenal Dashboard Web Controller](#8-mengenal-dashboard-web-controller)
9. [Cara Mendapatkan API Key Gemini (Gratis)](#9-cara-mendapatkan-api-key-gemini-gratis)
10. [Cara Menggunakan Asisten via Chat WhatsApp](#10-cara-menggunakan-asisten-via-chat-whatsapp)
11. [Penggunaan Sehari-hari & Tips](#11-penggunaan-sehari-hari--tips)
12. [Troubleshooting / Masalah Umum](#12-troubleshooting--masalah-umum)
13. [FAQ (Pertanyaan Sering Ditanyakan)](#13-faq-pertanyaan-sering-ditanyakan)
14. [Kontak & Dukungan](#14-kontak--dukungan)

---

## 1. TENTANG PRODUK

### Apa itu WA Asisten Pribadi AI?

**WA Asisten Pribadi AI** adalah asisten pintar yang berjalan langsung di WhatsApp Anda. Cukup kirim pesan chat biasa, dan asisten akan secara otomatis:

- 💰 **Mencatat pengeluaran harian** — Kirim pesan seperti *"Beli kopi 25rb"* dan langsung tercatat.
- 📊 **Merekap keuangan** — Tanya *"Berapa total pengeluaran bulan ini?"* dan dapat jawaban instan.
- ⏰ **Mengingatkan jadwal** — Kirim *"Ingatkan rapat besok jam 9 pagi"* dan Anda akan diingatkan tepat waktu.
- 📝 **Mencatat ide & tugas** — Kirim *"Catat ide konten TikTok tentang kopi"* dan tersimpan rapi.
- 🎯 **Melacak habit & goals** — *"Tandai habit baca buku hari ini"* untuk tracking kebiasaan.
- 📅 **Mengatur jadwal acara** — *"Jadwalkan meeting dengan klien Jumat jam 14"* langsung tercatat.
- 📓 **Menulis jurnal harian** — Curhat pengalaman hari ini dan tercatat sebagai jurnal.
- 📈 **Merencanakan anggaran** — Atur budget per kategori dan dapatkan peringatan jika mendekati batas.

### Bagaimana Cara Kerjanya?

Asisten bekerja dengan menghubungkan nomor WhatsApp Anda melalui fitur **Perangkat Tertaut** (sama seperti WhatsApp Web). Setiap ada pesan masuk dari Anda:

1. Pesan dibaca dan dipahami menggunakan **Google Gemini AI**.
2. AI mengenali jenis perintah (catat uang, reminder, catatan, dll).
3. Data disimpan ke **database lokal** di perangkat Anda.
4. Balasan konfirmasi dikirim kembali ke WhatsApp Anda.

> **Catatan:** Asisten hanya merespons pesan dari nomor pemilik (Anda). Pesan dari orang lain tidak akan diproses.

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

## 3. OPSI MENJALANKAN ASISTEN

Anda memiliki **2 pilihan** cara menjalankan asisten ini:

### 🆓 OPSI A: Gratis di Laptop/PC Sendiri

| Kelebihan | Kekurangan |
|---|---|
| ✅ Gratis, tanpa biaya bulanan | ❌ Asisten mati jika laptop dimatikan |
| ✅ Mudah, tinggal double-click | ❌ Perlu koneksi internet terus |
| ✅ Data tersimpan aman di laptop Anda | ❌ Reminder tidak akan terkirim jika laptop mati |
| ✅ Cocok untuk percobaan awal | |

### ☁️ OPSI B: Berbayar di VPS Cloud (Online 24 Jam)

| Kelebihan | Kekurangan |
|---|---|
| ✅ Asisten aktif 24/7 nonstop | ❌ Biaya VPS ±Rp 30.000-80.000/bulan |
| ✅ Reminder selalu terkirim tepat waktu | ❌ Perlu sedikit kemampuan teknis |
| ✅ Bisa catat pengeluaran kapan saja | ❌ Perlu setup awal di terminal VPS |
| ✅ Cocok untuk penggunaan serius | |

> **Rekomendasi:** Jika Anda sering bepergian dan ingin asisten selalu siap terima perintah kapan saja, pilih Opsi B. Untuk mencoba dulu, gunakan Opsi A.

---

## 4. ISI PAKET YANG ANDA TERIMA

Setelah mengunduh dan mengekstrak file ZIP, Anda akan melihat isi folder berikut:

```
📁 wa-bot-personal/
├── 📄 wa-bot-personal.exe        ← Aplikasi utama (double-click untuk mulai)
├── 📄 start-personal.bat         ← Alternatif peluncur cepat
├── 📄 PANDUAN_PENGGUNAAN.txt     ← Panduan singkat
├── 📄 deploy-vps-personal.sh     ← Script otomatis untuk VPS Cloud
├── 📄 better_sqlite3.node        ← Driver database (jangan dihapus)
└── 📁 config/
    ├── 📄 edition.json           ← Identitas edisi (jangan diubah)
    └── 📄 config.json.example    ← Contoh konfigurasi
```

> ⚠️ **Penting:** Jangan menghapus, memindahkan, atau mengganti nama file `better_sqlite3.node` dan folder `config/`. File-file ini dibutuhkan agar aplikasi berjalan dengan benar.

`[GAMBAR: Screenshot isi folder wa-bot-personal setelah di-extract dari ZIP. Tampilkan Windows Explorer/File Explorer yang menunjukkan semua file di atas.]`

---

## 5. OPSI A: MENJALANKAN DI LAPTOP/PC (GRATIS)

### Langkah 1: Ekstrak File ZIP

1. Buka folder tempat Anda menyimpan file hasil download dari Lynk.id.
2. Klik kanan pada file **`WA_Asisten_Pribadi_AI.zip`**.
3. Pilih **"Extract All..."** atau **"Ekstrak Semua..."**.
4. Pilih lokasi folder tujuan, lalu klik **"Extract"**.

`[GAMBAR: Screenshot klik kanan pada file ZIP dan menu "Extract All" di Windows Explorer.]`

### Langkah 2: Jalankan Aplikasi

1. Buka folder hasil ekstrak **`wa-bot-personal`**.
2. **Double-click** pada file **`wa-bot-personal.exe`**.

`[GAMBAR: Screenshot Windows Explorer menunjukkan file wa-bot-personal.exe yang di-highlight, siap di-double-click.]`

3. Akan muncul jendela **Command Prompt** (layar hitam) yang menampilkan proses startup:

```
======================================================
  🚀 WA Bot Web Controller berjalan di http://localhost:3000
======================================================
```

`[GAMBAR: Screenshot jendela Command Prompt yang menampilkan pesan startup di atas.]`

4. **Browser Anda akan otomatis terbuka** ke halaman `http://localhost:3000` dan menampilkan Setup Wizard.

> ⚠️ **Jangan tutup jendela Command Prompt!** Jika ditutup, asisten akan berhenti berjalan. Biarkan jendela tersebut terbuka selama Anda ingin asisten aktif.

> 💡 **Jika browser tidak terbuka otomatis:** Buka browser (Chrome/Edge) secara manual, lalu ketik `http://localhost:3000` di address bar.

### Langkah 3: Lanjut ke Setup Wizard

Setelah browser terbuka, Anda akan melihat halaman **Setup Wizard** (lihat [Bab 7](#7-setup-wizard-konfigurasi-awal-asisten) untuk panduan lengkap setup).

### Cara Mematikan Asisten

1. Klik pada jendela **Command Prompt**.
2. Tekan **`Ctrl + C`** di keyboard.
3. Ketik **`Y`** lalu tekan **Enter** jika diminta konfirmasi.

### Cara Menyalakan Kembali

Cukup **double-click** lagi pada file **`wa-bot-personal.exe`**. Semua data dan pengaturan Anda tersimpan dan tidak hilang.

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

`[GAMBAR: Screenshot terminal PowerShell/CMD yang berhasil masuk ke VPS melalui SSH.]`

### 6.3 Upload File Bot ke VPS

Ada beberapa cara untuk mengupload folder bot ke VPS:

**Cara 1: Menggunakan SCP (dari PowerShell Windows):**

```bash
scp -r "C:\Users\Anda\Downloads\wa-bot-personal" root@103.123.45.67:/root/
```

**Cara 2: Menggunakan FileZilla (GUI, lebih mudah):**

1. Download dan install **FileZilla** dari `filezilla-project.org`.
2. Masukkan Host: `103.123.45.67`, Username: `root`, Password: `[password VPS]`, Port: `22`.
3. Klik **Quickconnect**.
4. Drag folder `wa-bot-personal` dari panel kiri (komputer Anda) ke panel kanan (VPS) di folder `/root/`.

`[GAMBAR: Screenshot FileZilla yang menunjukkan proses upload folder wa-bot-personal dari komputer lokal ke VPS.]`

### 6.4 Jalankan Script Otomatis

Setelah file terupload, jalankan perintah berikut di terminal VPS:

```bash
cd /root/wa-bot-personal
chmod +x deploy-vps-personal.sh
./deploy-vps-personal.sh
```

Script ini akan secara otomatis:
- ✅ Menginstal Node.js v20 LTS
- ✅ Menginstal dependensi browser Chromium
- ✅ Menginstal PM2 (Process Manager agar asisten tetap hidup)
- ✅ Menjalankan asisten di background

Setelah selesai, Anda akan melihat pesan:

```
======================================================
  🎉 WA ASISTEN PRIBADI AI BERHASIL DIJALANKAN DI CLOUD!
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
3. Halaman **Setup Wizard** akan muncul (lihat [Bab 7](#7-setup-wizard-konfigurasi-awal-asisten)).

### 6.6 Perintah Berguna untuk VPS

| Perintah | Fungsi |
|---|---|
| `pm2 status` | Cek apakah asisten sedang berjalan |
| `pm2 logs wa-bot-personal` | Lihat log/catatan aktivitas asisten |
| `pm2 restart wa-bot-personal` | Restart asisten jika bermasalah |
| `pm2 stop wa-bot-personal` | Matikan asisten sementara |
| `pm2 start wa-bot-personal` | Nyalakan kembali asisten |

---

## 7. SETUP WIZARD: KONFIGURASI AWAL ASISTEN

Saat pertama kali membuka browser (`http://localhost:3000`), Anda akan diarahkan ke **Setup Wizard**. Ikuti langkah-langkah mudah berikut:

### Langkah 0: Aktivasi Lisensi Resmi Lynk.id

Sebagai pembeli resmi, Anda mendapatkan **Kode Lisensi (License Key)** yang tertera di email pembelian / dashboard Lynk.id Anda.

1. Masukkan kode lisensi Anda pada kolom **"Kode Lisensi"** (Contoh format: `WABOT-PERS-XXXX-YYYY-ZZZZ`).
2. Sistem akan secara otomatis mendeteksi **Hardware ID (HWID)** perangkat Anda dan menguncinya untuk keamanan Anda.
3. Klik tombol **"Aktifkan & Lanjutkan ke Setup →"**.

`[GAMBAR: Screenshot halaman Aktivasi Lisensi Resmi (Step 0) dengan badge hijau/ungu, input License Key, dan tampilan Hardware ID.]`

> 💡 **Penting:** 1 Kode Lisensi berlaku untuk 1 perangkat utama (Laptop/PC/VPS). Anda dapat memindahkan lisensi ke laptop baru kapan saja melalui menu **Pengaturan > Pindah Perangkat**.

---

### Langkah 1: Profil Asisten

Setelah lisensi aktif, isi informasi pribadi Anda:

| Field | Keterangan | Contoh |
|---|---|---|
| **Nama Panggilan** | Nama Anda (digunakan asisten saat menyapa) | Budi |
| **Nomor WhatsApp Utama** | Nomor HP Anda yang akan berkomunikasi dengan asisten | 628123456789 |

> 💡 Format nomor: Awali dengan kode negara `62` (Indonesia), tanpa tanda `+`. Contoh: `628123456789`

Setelah mengisi, klik tombol **"Lanjut: Sambungkan WhatsApp →"**.

`[GAMBAR: Screenshot halaman Setup Wizard Langkah 1, menampilkan form "Selamat Datang di WA Asisten Pribadi AI" dengan badge Personal Edition, field Nama Panggilan dan Nomor WhatsApp, serta tombol Lanjut.]`

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

Setelah berhasil terhubung, klik tombol **"Lanjut →"**.

### Langkah 3: Kunci Akses AI (Gemini API Key)

Asisten membutuhkan **API Key dari Google Gemini AI** agar dapat memahami perintah chat Anda secara natural.

| Field | Keterangan |
|---|---|
| **Gemini API Key** *(Wajib)* | Kunci akses AI dari Google (gratis). Lihat cara mendapatkannya di [Bab 9](#9-cara-mendapatkan-api-key-gemini-gratis). |
| **Grok API Key** *(Opsional)* | Kunci akses AI alternatif dari xAI (tidak wajib diisi). |

Masukkan API Key, lalu klik **"Simpan & Lanjut →"**.

`[GAMBAR: Screenshot halaman Setup Wizard Langkah 3, menampilkan form Kunci Akses AI dengan field Gemini API Key.]`

### Langkah 4: Contoh Pengeluaran Awal

Masukkan minimal 1 contoh pengeluaran agar asisten mengenal pola pencatatan Anda.

| Field | Keterangan | Contoh |
|---|---|---|
| **Kategori** | Kategori pengeluaran | Makan & Minum |
| **Jumlah (Rp)** | Nominal dalam Rupiah | 25000 |
| **Catatan** | Keterangan singkat | Beli makan siang nasi padang |

> 💡 Anda bisa menambahkan lebih banyak pengeluaran nanti cukup dengan mengirim pesan chat ke asisten.

> 💡 Jika belum siap memasukkan data, klik **"Lewati & Selesaikan"** untuk melewati langkah ini.

Klik **"Selesai"** untuk menyelesaikan setup. Anda akan langsung diarahkan ke **Dashboard** utama.

`[GAMBAR: Screenshot halaman Setup Wizard Langkah 4, menampilkan form input pengeluaran dengan field Kategori, Jumlah, dan Catatan.]`

---

## 8. MENGENAL DASHBOARD WEB CONTROLLER

Setelah setup selesai, Anda akan masuk ke **Dashboard** utama. Berikut penjelasan setiap menu:

`[GAMBAR: Screenshot Dashboard utama lengkap, menampilkan sidebar kiri dengan menu-menu asisten pribadi dan area konten utama.]`

### Menu Sidebar

| Menu | Fungsi |
|---|---|
| 📊 **Dashboard** | Ringkasan: total pengeluaran bulan ini, reminder aktif, tugas pending, penggunaan AI. |
| 💰 **Catatan Keuangan** | Daftar lengkap semua pengeluaran yang dicatat, bisa filter per kategori/bulan. |
| 📋 **Budget Planner** | Atur anggaran per kategori dan pantau realisasinya. |
| ⏰ **Pengingat** | Daftar reminder/alarm yang telah dijadwalkan. |
| ✅ **Daftar Tugas** | Todo list — tugas yang harus dikerjakan. |
| 📝 **Catatan** | Ide, memo, dan catatan bebas yang Anda simpan via chat. |
| 🔁 **Habit Tracker** | Kebiasaan harian yang Anda lacak (olahraga, baca buku, dll). |
| 📅 **Jadwal Acara** | Kalender event dan jadwal penting. |
| 📓 **Jurnal Harian** | Catatan pengalaman dan refleksi harian. |
| 🎯 **Target & Goals** | Target jangka panjang yang sedang Anda kejar. |
| 📤 **Export Data** | Unduh data keuangan dan catatan dalam format file. |
| ⚙️ **Pengaturan** | Pengaturan koneksi WhatsApp, API Key, gaya bahasa asisten, dll. |

### Pengaturan Penting di Menu "Pengaturan"

| Pengaturan | Fungsi | Rekomendasi |
|---|---|---|
| **Gaya Bahasa** | Cara asisten berbicara ke Anda | "Santai" untuk sehari-hari |
| **Panjang Jawaban** | Panjang balasan asisten | "Ringkas" agar cepat dibaca |
| **Level Emoji** | Seberapa banyak emoji yang digunakan | "Wajar" |

`[GAMBAR: Screenshot halaman Pengaturan yang menampilkan opsi gaya bahasa, panjang jawaban, dan emoji level.]`

---

## 9. CARA MENDAPATKAN API KEY GEMINI (GRATIS)

API Key Gemini AI dapat diperoleh **gratis** dari Google. Tidak memerlukan kartu kredit.

### Langkah-langkah:

1. Buka browser, kunjungi: **https://aistudio.google.com/app/apikey**
2. Login menggunakan **akun Google** Anda (Gmail).

`[GAMBAR: Screenshot halaman login Google AI Studio.]`

3. Klik tombol **"Create API Key"** (Buat Kunci API).

`[GAMBAR: Screenshot halaman Google AI Studio yang menunjukkan tombol "Create API Key".]`

4. Pilih project (bisa menggunakan default), lalu klik **"Create API Key in new project"**.
5. **Salin (Copy) API Key** yang ditampilkan.

`[GAMBAR: Screenshot API Key yang berhasil dibuat, menunjukkan string key yang dimulai dengan "AIza..." dan tombol Copy.]`

6. **Simpan API Key** ini dengan aman. Anda akan memasukkannya pada **Setup Wizard Langkah 3**.

> ⚠️ **Jangan bagikan API Key Anda ke orang lain.**

### Batas Penggunaan Gratis (Free Tier)

| Model | Batas Gratis |
|---|---|
| Gemini Flash | 15 request/menit, 1.500 request/hari |
| Gemini Pro | 2 request/menit, 50 request/hari |

> 💡 Untuk penggunaan pribadi sehari-hari (20-50 perintah/hari), kuota gratis sangat lebih dari cukup.

---

## 10. CARA MENGGUNAKAN ASISTEN VIA CHAT WHATSAPP

Setelah setup selesai, Anda bisa langsung mengirim pesan ke nomor WhatsApp yang sudah dihubungkan. Cukup chat dengan bahasa biasa, asisten akan memahami maksud Anda.

### 💰 Pencatatan Keuangan

| Contoh Pesan Anda | Apa yang Terjadi |
|---|---|
| *"Beli kopi 25rb"* | Tercatat pengeluaran Rp 25.000 kategori Makan & Minum |
| *"Bayar listrik 350.000"* | Tercatat pengeluaran Rp 350.000 kategori Tagihan |
| *"Makan malam padang 30rb"* | Tercatat pengeluaran Rp 30.000 |
| *"Bensin 50.000"* | Tercatat pengeluaran Rp 50.000 kategori Transportasi |

### 📊 Rekap & Analisis

| Contoh Pesan Anda | Apa yang Terjadi |
|---|---|
| *"Berapa total pengeluaran hari ini?"* | Asisten menjawab total & rincian hari ini |
| *"Rekap pengeluaran minggu ini"* | Ringkasan per kategori selama 7 hari |
| *"Berapa pengeluaran makan bulan ini?"* | Total khusus kategori Makan & Minum |
| *"Analisa keuangan saya bulan lalu"* | Analisis lengkap dengan saran dari AI |

### ⏰ Pengingat (Reminder)

| Contoh Pesan Anda | Apa yang Terjadi |
|---|---|
| *"Ingatkan rapat besok jam 9 pagi"* | Dijadwalkan notifikasi jam 9 esok hari |
| *"Ingatkan bayar listrik tanggal 20"* | Dijadwalkan notifikasi setiap tanggal 20 |
| *"Ingatkan minum obat tiap jam 8 malam"* | Reminder harian jam 20:00 |

### ✅ Todo / Daftar Tugas

| Contoh Pesan Anda | Apa yang Terjadi |
|---|---|
| *"Tambah todo beli susu dan telur"* | Ditambahkan ke daftar tugas |
| *"Apa saja todo saya?"* | Menampilkan semua tugas yang belum selesai |
| *"Todo beli susu selesai"* | Menandai tugas sebagai selesai |

### 📝 Catatan & Ide

| Contoh Pesan Anda | Apa yang Terjadi |
|---|---|
| *"Catat ide konten TikTok tentang kopi"* | Tersimpan sebagai catatan/note |
| *"Catat nomor resi JNE 12345678"* | Tersimpan sebagai catatan |

### 🔁 Habit Tracker

| Contoh Pesan Anda | Apa yang Terjadi |
|---|---|
| *"Tandai habit baca buku hari ini"* | Dicatat bahwa Anda baca buku hari ini |
| *"Progress habit olahraga?"* | Menampilkan statistik habit olahraga |

### 📓 Jurnal Harian

| Contoh Pesan Anda | Apa yang Terjadi |
|---|---|
| *"Hari ini produktif, selesaikan 3 tugas"* | Dicatat sebagai entri jurnal |
| *"Jurnal: meeting berjalan lancar"* | Dicatat sebagai entri jurnal |

---

## 11. PENGGUNAAN SEHARI-HARI & TIPS

### ✅ Tips Agar Asisten Bekerja Optimal

1. **Gunakan bahasa natural** — Tidak perlu format khusus, cukup chat biasa layaknya ke teman.
2. **Sebutkan nominal dengan jelas** — *"25rb"*, *"25.000"*, atau *"25000"* semuanya dipahami.
3. **Periksa dashboard secara berkala** — Lihat rekap keuangan dan progress habit Anda.
4. **Manfaatkan Budget Planner** — Atur batas anggaran per kategori agar keuangan terkontrol.
5. **Gunakan reminder untuk hal penting** — Tagihan, obat, meeting, deadline.

### ⛔ Yang Harus Dihindari

1. **Jangan gunakan nomor bot untuk spam** — Akun WhatsApp Anda bisa diblokir.
2. **Jangan bagikan API Key** — Siapa pun yang memiliki key Anda bisa menghabiskan kuota AI.
3. **Jangan tutup jendela Command Prompt** (Opsi A) — Asisten akan mati.
4. **Jangan edit file `edition.json`** — Bisa menyebabkan asisten tidak berjalan.

### 🔄 Rutinitas yang Disarankan

| Frekuensi | Aktivitas |
|---|---|
| Setiap hari | Catat pengeluaran segera setelah bayar, tandai habit |
| Setiap minggu | Cek rekap keuangan mingguan, review todo list |
| Setiap bulan | Evaluasi budget vs realisasi, atur target bulan depan |

---

## 12. TROUBLESHOOTING / MASALAH UMUM

### Masalah 1: "wa-bot-personal.exe tidak mau dibuka / tidak terjadi apa-apa"

**Penyebab:** Windows Defender atau antivirus memblokir file `.exe`.

**Solusi:**
1. Klik kanan pada `wa-bot-personal.exe` → pilih **Properties**.
2. Di bagian bawah, centang **"Unblock"** → klik **Apply** → **OK**.
3. Jika masih diblokir, tambahkan folder `wa-bot-personal` ke **exclusion list** antivirus Anda.

`[GAMBAR: Screenshot Properties file .exe yang menunjukkan checkbox "Unblock" di bagian Security.]`

### Masalah 2: "Browser tidak terbuka otomatis"

**Solusi:** Buka browser secara manual, lalu ketik `http://localhost:3000` di address bar.

### Masalah 3: "QR Code tidak muncul atau terus loading"

**Solusi:**
1. Tutup aplikasi (Ctrl+C di Command Prompt).
2. Pastikan koneksi internet stabil.
3. Jalankan ulang `wa-bot-personal.exe`.

### Masalah 4: "Asisten terhubung tapi tidak membalas pesan"

**Penyebab:** API Key Gemini belum diisi atau salah.

**Solusi:**
1. Buka Dashboard → menu **Pengaturan**.
2. Periksa apakah **Gemini API Key** sudah terisi dengan benar.
3. Klik **"Tes Koneksi AI"** untuk memverifikasi.

### Masalah 5: "WhatsApp terputus setelah beberapa hari"

**Solusi:**
1. Buka Dashboard → menu **Pengaturan**.
2. Klik **"Ganti Perangkat / Scan QR"**.
3. Scan ulang QR Code dari HP Anda.

### Masalah 6: "Pengeluaran tidak tercatat / asisten salah paham"

**Solusi:** Coba formulasi ulang pesan Anda lebih jelas. Contoh:
- ❌ *"25rb"* (terlalu singkat, bisa salah paham)
- ✅ *"Beli kopi 25rb"* (jelas ada konteks "beli" dan nominal)

---

## 13. FAQ (PERTANYAAN SERING DITANYAKAN)

**Q: Apakah nomor WhatsApp pribadi saya akan terganggu?**
> A: Tidak. Asisten berjalan melalui fitur "Perangkat Tertaut" (seperti WhatsApp Web). WhatsApp di HP Anda tetap bisa digunakan normal.

**Q: Apakah orang lain bisa melihat data keuangan saya?**
> A: Tidak. Semua data tersimpan lokal di perangkat Anda (laptop/VPS). Tidak ada yang dikirim ke server pihak ketiga selain Google Gemini AI untuk memproses perintah.

**Q: Apakah orang lain bisa mengirim perintah ke asisten saya?**
> A: Secara default, asisten merespons semua pesan yang masuk. Untuk keamanan, pastikan hanya Anda yang tahu nomor bot, atau atur nomor pemilik di pengaturan.

**Q: Apakah data saya aman jika laptop rusak?**
> A: Data tersimpan di file `data/bot.db` dalam folder bot. Anda bisa mem-backup file ini secara berkala. Di VPS, data lebih aman karena server cloud memiliki redundansi.

**Q: Berapa banyak pengeluaran yang bisa dicatat?**
> A: Tidak ada batasan. Database SQLite mampu menyimpan jutaan entri.

**Q: Apakah bisa mengekspor data keuangan ke Excel?**
> A: Ya, gunakan menu **"Export Data"** di Dashboard untuk mengunduh data dalam format yang bisa dibuka di Excel.

**Q: Bagaimana jika kuota AI gratis habis?**
> A: Kuota harian di-reset setiap hari. Untuk penggunaan pribadi (20-50 perintah/hari), kuota gratis sangat cukup.

**Q: Apakah ada pembaruan/update produk?**
> A: Pembaruan akan diinformasikan melalui Lynk.id. Anda bisa mengunduh versi terbaru tanpa kehilangan data lama.

---

## 14. KONTAK & DUKUNGAN

Jika Anda mengalami kendala atau membutuhkan bantuan:

| Channel | Detail |
|---|---|
| 📧 Email | [ISI EMAIL SUPPORT ANDA] |
| 💬 WhatsApp | [ISI NOMOR WA SUPPORT ANDA] |
| 🌐 Website | [ISI WEBSITE/LYNK.ID ANDA] |

> **Jam Support:** Senin – Jumat, 09.00 – 17.00 WIB
> **Waktu Respons:** Maksimal 1x24 jam di hari kerja.

---

**Terima kasih telah memilih WA Asisten Pribadi AI!** 🧑‍💼
Semoga asisten ini membantu Anda mengelola keuangan dan produktivitas harian dengan lebih efisien.

*— Tim Pengembang*

---
*Versi Dokumen: 1.0 | Terakhir diperbarui: Agustus 2026*
