# Fitur — Mode Asisten Pribadi

## Wajib ada di v1
- Parsing pengeluaran dari kalimat bebas → simpan ke tabel `expenses` (lihat `docs/database-schema.md`)
- Rekap on-demand ("rekap bulan ini") — query & summary dari `expenses`
- Reminder terjadwal via `node-cron`, baca dari tabel `reminders`
- Konfirmasi balik ke user setelah data tersimpan (misal: "Dicatat: Makan siang Rp20.000") — supaya user percaya data beneran kesimpan

## Nice-to-have
- Rekap otomatis terjadwal (dikirim tiap awal bulan tanpa diminta)
- Kategori custom yang bisa ditambah user
- Export data ke Excel dari dashboard
