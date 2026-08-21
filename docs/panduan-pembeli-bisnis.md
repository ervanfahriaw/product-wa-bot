# 🛍️ PANDUAN PENGGUNAAN: WA BOT BISNIS AI (CS & SALES 24/7)

Selamat! Anda telah memiliki **WA Bot Bisnis AI**, software asisten cerdas untuk membalas pesan pelanggan, mengecek stok produk, melacak pesanan, dan meningkatkan konversi penjualan toko Anda secara otomatis.

---

## ⚡ CARA PENGGUNAAN DI LAPTOP/PC (WINDOWS)

1. **Buka Aplikasi:**
   - Double-click file `wa-bot-bisnis.exe` (atau jalankan `Buka-Bot-Bisnis.bat`).
   - Browser Anda akan otomatis terbuka ke alamat `http://localhost:3000`.

   > 💡 **Jika muncul jendela biru "Windows protected your PC" (SmartScreen):**
   > - Klik tulisan **"More info"** (*Info selengkapnya*).
   > - Klik tombol **"Run anyway"** (*Tetap jalankan*).
   > - Atau jalankan file **`1-KLIK-IZINKAN-APLIKASI.bat`** satu kali.
   > *(Hal ini normal di Windows untuk software baru yang belum memiliki sertifikat korporat tahunan Microsoft)*.

2. **Setup Cepat Melalui Layar Browser:**
   - **Aktivasi Lisensi:** Masukkan kode lisensi resmi yang Anda peroleh dari Lynk.id (Contoh: `WABOT-BISN-XXXX-YYYY-ZZZZ`).
   - **Langkah 1 (Profil Toko):** Masukkan nama usaha dan nomor WhatsApp pemilik toko.
   - **Langkah 2 (Scan WhatsApp):** Buka WhatsApp di HP Anda $\to$ Titik 3 / Pengaturan $\to$ *Perangkat Tertaut* $\to$ *Tautkan Perangkat* $\to$ Scan QR Code di browser.
   - **Langkah 3 (Kunci AI Gemini):** Masukkan API Key Gemini Anda.
     *(Gratis resmi dari Google, dapatkan di: https://aistudio.google.com/app/apikey)*.
   - **Langkah 4 (Katalog Produk):** Masukkan contoh produk & harga toko Anda.
3. **Selesai!**
   - Bot WhatsApp Anda langsung aktif 24 jam melayani pelanggan dan menjawab pertanyaan produk secara cerdas!

---

## 🌐 PERSYARATAN BROWSER LAPTOP
Software ini menggunakan mesin browser lokal untuk menghubungkan WhatsApp Web. Pastikan salah satu browser berikut terpasang di laptop Anda:
- **Google Chrome** (Sangat Disarankan) ATAU
- **Microsoft Edge** (Bawaan resmi Windows 10 & 11)

---

## ☁️ CARA MENJALANKAN DI VPS CLOUD (ONLINE 24 JAM NONSTOP)

Jika Anda ingin bot tetap aktif tanpa perlu menyalakan laptop terus-menerus:
1. Sewa VPS Linux Ubuntu murah (Rp 30.000 - Rp 50.000/bulan).
2. Upload folder bot ini ke VPS Anda.
3. Jalankan 1 perintah otomatis di terminal VPS:
   ```bash
   chmod +x deploy-vps-bisnis.sh && ./deploy-vps-bisnis.sh
   ```
4. Buka browser di HP/Laptop Anda: `http://IP_VPS_ANDA:3000` lalu scan QR Code seperti biasa.

---

## 💡 TIPS PENTING AGAR NOMOR WHATSAPP AMAN
- Gunakan bot untuk melayani pelanggan yang chat ke nomor Anda (*inbound customer service*).
- Hindari menyalahgunakan bot untuk spam broadcast massal ke nomor acak yang tidak dikenal.
- Nikmati waktu luang Anda selagi bot melayani penjualan toko Anda! 🚀
