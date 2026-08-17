# Packaging & Deployment Guide

Dokumen ini memuat panduan lengkap mengenai cara membungkus aplikasi menjadi *installer* `.exe` mandiri untuk Windows serta cara melakukan *deployment* otomatis pada VPS Linux (Ubuntu / Debian).

---

## Opsi 1 — Windows Standalone Executable (.EXE)
*Target: Pembeli Paket Pro / Pengguna PC/Laptop Awam tanpa perlu install Node.js*

### Cara Build:
Jalankan perintah build di terminal proyek:
```bash
npm run build:exe
```
Perintah ini akan menjalankan skrip `scripts/build-exe.js` yang membungkus seluruh file kode, template EJS, dan skema database ke dalam satu file binary mandiri: `dist/wa-bot-assistant.exe`.

### Cara Pakai untuk Pembeli:
1. Ekstrak folder hasil paket jualan.
2. Double-click file `wa-bot-assistant.exe`.
3. Aplikasi akan otomatis membuka browser ke alamat `http://localhost:3000` untuk menjalankan **Setup Wizard 4 Langkah**.
4. Komputer target tidak membutuhkan instalasi Node.js manual.

### Catatan Teknis Native Dependency (`better-sqlite3`):
- `better-sqlite3` adalah modul C++ native (`.node`). Skrip `build-exe.js` secara otomatis menyalin `better_sqlite3.node` ke folder `dist/` agar binary dapat dimuat secara dinamis oleh `.exe`.
- Puppeteer menggunakan Chromium headless yang otomatis diunduh pada cache lokal pengguna atau menggunakan browser Chrome bawaan Windows.

---

## Opsi 2 — Linux VPS Deployment (Ubuntu / Debian)
*Target: Pengguna yang ingin bot online 24/7 tanpa perlu menyalakan laptop terus-menerus (Biaya VPS sekitar Rp30.000 - Rp50.000 / bulan)*

### Cara Deploy Cepat:
1. Sewa VPS Linux (Ubuntu 22.04 / 24.04 atau Debian 11/12).
2. Salin folder proyek ke VPS (via Git, SFTP, atau SCP).
3. Masuk ke folder proyek di terminal SSH dan jalankan skrip deployment:
   ```bash
   chmod +x scripts/deploy-vps.sh
   ./scripts/deploy-vps.sh
   ```
4. Skrip akan otomatis menginstal:
   - Node.js v20 LTS
   - Dependensi sistem Linux untuk Chromium (GUI/sandbox dependencies)
   - PM2 Process Manager
   - Menjalankan bot di background dengan nama `wa-bot-assistant`
   - Membuka port 3000 pada firewall
5. Buka IP server Anda di browser: `http://<IP_VPS>:3000` untuk menyelesaikan Setup Wizard.

### Perintah Manajemen PM2:
- Cek status bot: `pm2 status`
- Pantau log real-time: `pm2 logs wa-bot-assistant`
- Restart bot: `pm2 restart wa-bot-assistant`
- Stop bot: `pm2 stop wa-bot-assistant`

---

## Perbandingan Opsi untuk Ebook Panduan Pembeli

| Kriteria | Opsi 1: PC/Laptop Pribadi (.exe) | Opsi 2: VPS Linux Mandiri |
|---|---|---|
| **Biaya Bulanan** | **GRATIS** (Hanya listrik rumah) | Rp30.000 - Rp50.000/bulan |
| **Kemudahan Pasang** | **Sangat Mudah** (Tinggal double click) | Butuh pengetahuan dasar SSH terminal |
| **Kestabilan Online** | Tergantung laptop menyala & tidak *sleep* | **Stabil 24 Jam Non-Stop** di Cloud |
| **Kebutuhan Device** | Komputer harus tetap hidup | HP saja cukup setelah setup awal |

### Disclaimer Risiko WhatsApp:
`whatsapp-web.js` bekerja menggunakan otomasi antarmuka WhatsApp Web resmi. Hindari penggunaan untuk *spamming* atau *broadcast* massal ke nomor yang tidak dikenal agar nomor tidak terkena pemblokiran (*banned*) oleh pihak WhatsApp.
