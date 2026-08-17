# Release Notes & Panduan Penjualan — Versi v1.0.0

Dokumen ini adalah ringkasan resmi fitur produk v1 siap jual di **Lynk.id** serta panduan instalasi untuk pembeli.

---

## 🌟 Ringkasan Produk: WA Bot Assistant

**WA Bot Assistant** adalah produk digital otomatisasi WhatsApp berbasis AI dengan antarmuka web controller lokal. Menggunakan konsep **BYOK (Bring Your Own Key)** sehingga pembeli tidak terikat biaya langganan bulanan ke developer, melainkan hanya membayar konsumsi API AI mereka sendiri (Gemini / Grok) yang sangat terjangkau atau bahkan gratis.

---

## 📱 Dua Mode Utama yang Siap Pakai

### 1. Mode Bisnis (Untuk UMKM, Toko Online, Kedai, & Jasa)
- ✅ **Pengecekan Stok Akurat**: Bot menjawab ketersediaan stok barang secara *real-time* langsung dari database SQLite lokal (anti-halusinasi).
- ✅ **Kirim Foto Katalog Otomatis**: Bot dapat mengirimkan foto fisik produk (`MessageMedia`) langsung ke chat WhatsApp pembeli.
- ✅ **Rekomendasi Cerdas**: Rekomendasi produk berdasarkan kata kunci percakapan pembeli.
- ✅ **Human Handover Otomatis**: Jika terdeteksi komplain, barang rusak, atau tawar-menawar harga, bot otomatis mengirimkan notifikasi darurat ke nomor WhatsApp pemilik toko untuk penanganan langsung oleh manusia.
- ✅ **Manajemen Produk**: CRUD produk lengkap (tambah, ubah harga/stok/deskripsi/gambar, dan hapus) via Web Controller lokal.

### 2. Mode Asisten Pribadi (Untuk Produktivitas & Keuangan Harian)
- ✅ **Pencatatan Pengeluaran dari Bahasa Bebas**: Cukup chat santai seperti *"beli kopi 25rb"* atau *"makan siang nasi padang 35000"*, bot otomatis memvalidasi, mencatat ke database, dan memberikan pesan konfirmasi balik.
- ✅ **Rekap Keuangan On-Demand**: Cukup chat *"rekap pengeluaran bulan ini"*, AI akan merangkum total pengeluaran dan rincian per kategori secara instan.
- ✅ **Pengingat Terjadwal (Reminder)**: Chat *"ingatkan besok jam 8 pagi bayar tagihan listrik"*, bot akan menjadwalkan dan mengirimkan WhatsApp tepat waktu via `node-cron`.
- ✅ **Manajemen Keuangan**: CRUD catatan pengeluaran manual via Web Controller lokal.

---

## 💻 Web Controller & Setup Wizard Lokal

- ✅ **Setup Wizard 4 Langkah**: Panduan interaktif saat pertama kali aplikasi dijalankan (Pilih Mode &rarr; Scan QR Code &rarr; Isi Kunci AI &rarr; Data Awal).
- ✅ **Live QR Polling**: Pemindaian QR WhatsApp langsung dari browser dengan deteksi otomatis saat tersambung.
- ✅ **Pengujian API Key Live**: Tombol *"⚡ Test Koneksi"* di halaman Pengaturan untuk menguji validitas API Key Gemini/Grok sebelum dipakai.
- ✅ **Audit Riwayat Chat Log**: Memantau seluruh pesan masuk dan balasan bot beserta filter pencarian nomor kontak.
- ✅ **Bebas Jargon Teknis**: Antarmuka dirancang bersih, ramah pemula, dan mudah dimengerti orang awam.

---

## 📦 Paket Penjualan Lynk.id

| Nama Paket | Isi Paket | Target Pembeli |
|---|---|---|
| **Paket Basic** | Source Code Lengkap + Ebook Panduan Instalasi | Developer / Pengguna yang mengerti Node.js |
| **Paket Pro** | Installer `.exe` Mandiri Siap Pakai + Ebook Panduan | Pemilik UMKM & Pengguna PC/Laptop Awam |
| **Paket Reseller** | Lisensi White-label Bebas Jual Ulang + Master Script | Agensi digital / Jasa pembuatan chatbot |

---

## 🚀 Panduan Ringkas untuk Pembeli

### Cara Menggunakan Versi .EXE (Paket Pro):
1. Ekstrak file zip yang diunduh dari Lynk.id.
2. Double-click file **`wa-bot-assistant.exe`**.
3. Browser akan otomatis terbuka ke `http://localhost:3000`.
4. Ikuti 4 langkah wizard sederhana di layar untuk menghubungkan WhatsApp dan memasukkan Gemini API Key.
5. Bot langsung aktif melayani pesan masuk!

### Cara Menjalankan Versi Source Code (Paket Basic):
1. Install Node.js LTS (v20+).
2. Jalankan `npm install`.
3. Jalankan `npm start`.
4. Buka `http://localhost:3000` di browser.

### Cara Menjalankan di Linux VPS 24/7:
1. Upload folder ke VPS.
2. Jalankan: `chmod +x scripts/deploy-vps.sh && ./scripts/deploy-vps.sh`
3. Buka `http://<IP_VPS>:3000` di browser.

---

## 🗺️ Rencana Roadmap Pembaruan (Versi v2)
- Grafik visual analitik penjualan & tren pengeluaran bulanan.
- Kategori dinamis yang bisa ditambah sendiri di Mode Personal.
- Export data transaksi & stok ke format Excel (.xlsx) / CSV.
- Dukungan multi-nomor WhatsApp untuk multi-cabang bisnis.
