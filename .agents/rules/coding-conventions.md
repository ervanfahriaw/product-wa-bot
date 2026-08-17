# Konvensi kode

## Struktur & ukuran file
- Satu file idealnya di bawah 300 baris — kalau lebih, pecah jadi modul lebih kecil
- Satu fungsi idealnya di bawah 40 baris
- Nama file: kebab-case (`stock-handler.js`), nama variabel/fungsi: camelCase

## Error handling
- Semua pemanggilan API eksternal (Gemini, Grok) WAJIB dibungkus try/catch
- Kalau AI provider gagal/timeout, bot harus tetap balas pesan fallback ke user — jangan biarkan bot diam saja
- Jangan tampilkan raw error/stack trace ke pesan WhatsApp user — log ke console/file saja

## Data & keamanan
- Jangan pernah log isi API key ke console
- Validasi input sebelum simpan ke database (terutama hasil parsing AI, misal saat mencatat pengeluaran — cek dulu apakah angkanya masuk akal)
- File `config/config.json`, folder session WhatsApp, dan file database `.db` WAJIB masuk `.gitignore` — jangan dihapus dari sana

## Sebelum melakukan aksi berisiko
- Minta konfirmasi user dulu sebelum: hapus data di database, overwrite config yang sudah ada, atau build/deploy versi final
- Kalau ragu antara dua pendekatan implementasi, tanya user, jangan asal pilih

## Gaya respons agent
- Jelaskan alasan ("kenapa"), bukan cuma "apa", terutama kalau menyimpang dari dokumentasi di `docs/`
- Kalau nemu potensi bug di luar scope task yang sedang dikerjakan, kasih tahu dulu sebelum lanjut — jangan sekalian diperbaiki tanpa bilang
