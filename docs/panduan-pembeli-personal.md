# 🧑‍💼 PANDUAN PENGGUNAAN: WA ASISTEN PRIBADI AI (FINANCE & PRODUCTIVITY)

Selamat! Anda telah memiliki **WA Asisten Pribadi AI**, asisten serba bisa langsung di WhatsApp Anda untuk mencatat pengeluaran harian, merekap anggaran, mengingatkan jadwal penting, dan mencatat ide/tugas secara otomatis.

---

## ⚡ CARA PENGGUNAAN DI LAPTOP/PC (GRATIS)

1. **Buka Aplikasi:**
   - Double-click file `wa-bot-personal.exe` (atau jalankan `start-personal.bat`).
   - Browser Anda akan otomatis terbuka ke alamat `http://localhost:3000`.
2. **Setup 3 Langkah Cepat:**
   - **Langkah 1 (Profil Asisten):** Masukkan nama panggilan Anda dan nomor WhatsApp utama Anda (untuk menerima notifikasi & rekap).
   - **Langkah 2 (Sambungkan WhatsApp):** Buka WhatsApp di HP Anda $\to$ Titik 3 / Pengaturan $\to$ *Perangkat Tertaut* $\to$ *Tautkan Perangkat* $\to$ Scan QR Code yang muncul di layar browser.
   - **Langkah 3 (Kunci AI Gemini):** Masukkan API Key Gemini Anda.
     *(Gratis dari Google, dapatkan di: https://aistudio.google.com/app/apikey)*.
   - **Langkah 4 (Contoh Pengeluaran):** Masukkan 1 contoh kategori pengeluaran awal (misal: Makan Siang 25rb).
3. **Selesai!**
   - Asisten pribadi Anda langsung aktif! Anda bisa langsung chat ke nomor bot dengan bahasa santai, seperti:
     - *"Beli kopi 25rb"* $\to$ Otomatis tercatat ke pembukuan keuangan.
     - *"Ingatkan rapat besok jam 9 pagi"* $\to$ Otomatis dijadwalkan reminder.
     - *"Rekap pengeluaran bulan ini"* $\to$ AI memberikan analisa keuangan.

---

## ☁️ CARA MENJALANKAN DI VPS CLOUD (ONLINE 24 JAM NONSTOP)

Jika Anda ingin asisten selalu aktif tanpa perlu menyalakan laptop terus-menerus:
1. Sewa VPS Linux Ubuntu murah (Rp 30.000 - Rp 50.000/bulan).
2. Upload folder bot ini ke VPS Anda.
3. Jalankan 1 perintah otomatis di terminal VPS:
   ```bash
   chmod +x deploy-vps-personal.sh && ./deploy-vps-personal.sh
   ```
4. Buka browser di HP/Laptop Anda: `http://IP_VPS_ANDA:3000` lalu scan QR Code seperti biasa.

---

## 💡 CONTOH PERINTAH CHAT YANG BISA ANDA GUNAKAN:
- **Keuangan:** *"Beli bensin 50.000"*, *"Makan malam padang 30rb"*, *"Berapa total pengeluaran kategori makan minggu ini?"*
- **Pengingat:** *"Ingatkan bayar listrik tanggal 20"*, *"Ingatkan minum obat tiap jam 8 malam"*
- **Todo & Catatan:** *"Catat ide konten TikTok tentang kopi"*, *"Tambah todo beli susu & telur"*
- **Jurnal & Habit:** *"Tandai habit baca buku hari ini"*
