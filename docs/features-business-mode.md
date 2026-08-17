# Fitur — Mode Bisnis

## Wajib ada di v1
- Cek stok dari database (`products.stock`), bukan dari ingatan AI
- Kirim gambar produk (`MessageMedia` dari `products.image_path`)
- Rekomendasi produk berdasar kata kunci di pesan user
- Balasan bahasa natural (system prompt custom per bisnis, lihat `src/ai/prompts/business/`)
- Human handover: kalau AI tidak yakin (pertanyaan di luar konteks produk, komplain, nego harga), kirim notifikasi WA ke nomor owner

## Nice-to-have (versi berikutnya, jangan dikerjakan dulu di v1)
- Broadcast promo (HATI-HATI: risiko ban tinggi, butuh rate-limiting kalau nanti dikerjakan)
- Multi-cabang / multi-nomor
- Integrasi pembayaran otomatis
