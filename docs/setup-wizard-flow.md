# Alur setup wizard

Wizard adalah bagian dari web controller (`src/server/views/setup/`), BUKAN installer terpisah.

1. User jalankan `.exe` / `npm start` → server Express nyala di background
2. Server auto-buka browser ke `http://localhost:PORT` (pakai package `open`)
3. Server cek `config/config.json` — kalau belum ada / belum lengkap, semua route diarahkan ke `/setup`
4. **Step 1** — pilih mode: Bisnis atau Personal
5. **Step 2** — scan QR WhatsApp (generate pakai `qrcode`, tampil sebagai gambar, auto-refresh sampai berhasil scan)
6. **Step 3** — isi API key (Gemini wajib, Grok opsional untuk baca gambar), validasi dengan test-call ringan
7. **Step 4** — isi data awal (produk pertama / kategori pengeluaran) — SKIPPABLE, jangan dipaksa
8. Simpan semua ke `config/config.json` → redirect ke dashboard utama
9. Kunjungan berikutnya, wizard di-skip otomatis (langsung ke dashboard)
