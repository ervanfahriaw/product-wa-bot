# Design system — web controller

Dashboard ini dipakai orang awam (bukan developer), jadi prioritas: **jelas dan tidak bikin takut**, bukan trendy.

## Warna
- Primary: biru kalem `#2563EB` — tombol utama, link aktif
- Success: hijau `#16A34A` — status "tersambung", "tersimpan"
- Warning/Error: merah `#DC2626` — status gagal, sesi terputus
- Netral: abu-abu `#F3F4F6` (background), `#374151` (teks)

## Layout
- Sidebar kiri untuk navigasi (Dashboard, Produk/Kategori, Chat Log, Pengaturan)
- Halaman wizard TIDAK pakai sidebar — full-width, fokus satu langkah per layar
- Font: system font stack (`-apple-system, "Segoe UI", sans-serif`) — jangan import Google Fonts (nambah dependency network yang tidak perlu)

## Komponen
- Status koneksi WhatsApp harus selalu terlihat (badge hijau/merah) di header dashboard
- Setiap form wajib ada validasi inline, jangan cuma pakai `alert()` browser
- Tombol destruktif (hapus data) selalu warna merah + minta konfirmasi lewat modal

## Prinsip
- Hindari jargon teknis di UI (jangan tulis "webhook", "API endpoint" — tulis "sambungan AI", dst)
- Setiap layar sertakan satu kalimat penjelasan singkat di atas, bukan cuma judul halaman
