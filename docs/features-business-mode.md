# Fitur — Mode Bisnis

## Wajib ada di v1
- Cek stok dari database (`products.stock`), bukan dari ingatan AI
- Kirim gambar produk fisik (`MessageMedia` dari `products.image_path`)
- **Tautan Kumpulan Foto & Video Produk (`products.media_url`)**:
  - Kolom input khusus di web controller (Tambah/Edit Produk & Setup Wizard) untuk memasukkan link Google Drive, Cloud Folder, atau link video.
  - Memfasilitasi calon customer yang ingin melihat banyak foto/video sekaligus selain foto utama yang dikirim via WhatsApp.
  - Tautan galeri otomatis disematkan ke dalam caption pengiriman media WhatsApp dan konteks AI.
- **Pencocokan Token Fleksibel (Unspaced & Suffixes)**:
  - Mampu mendeteksi nama produk tanpa spasi (misal: "fullgold" dicocokkan ke "Full Gold") serta variasi akhiran seperti "afrnya", "fotonya".
- **Fallback Pengiriman Media Cerdas**:
  - Jika file gambar fisik belum ada di disk atau hanya memiliki `media_url`, bot tetap mengirimkan informasi produk beserta tautan galeri lengkap sehingga customer tidak ditinggalkan tanpa respon.
- **AI Anti-Halusinasi Foto**:
  - AI prompt secara ketat memeriksa status `Foto` dan `Galeri/Video` dari database untuk mencegah AI berhalusinasi mengatakan "Ini fotonya ya kak" jika foto belum diunggah di sistem.
- Rekomendasi produk berdasar kata kunci di pesan user
- Balasan bahasa natural (system prompt custom per bisnis, lihat `src/ai/prompts/business/`)
- Human handover: kalau AI tidak yakin (pertanyaan di luar konteks produk, komplain, nego harga), kirim notifikasi WA ke nomor owner

## Nice-to-have (versi berikutnya, jangan dikerjakan dulu di v1)
- Broadcast promo (HATI-HATI: risiko ban tinggi, butuh rate-limiting kalau nanti dikerjakan)
- Multi-cabang / multi-nomor
- Integrasi pembayaran otomatis

