# Arsitektur sistem

## Komponen utama

1. **Mesin bot** (`src/engine/`) — whatsapp-web.js, terima & kirim pesan WhatsApp. Tugasnya cuma jadi kurir pesan, tidak berpikir sendiri.
2. **Otak AI** (`src/ai/`) — layer adapter yang panggil Gemini (teks) / Grok (gambar) pakai API key milik user. Sebelum panggil AI, ambil dulu data relevan dari database (lihat "Alur RAG ringan" di bawah).
3. **Database lokal** (`src/db/`) — SQLite, satu file. Simpan produk, stok, catatan pengeluaran, reminder, log chat, dan config (termasuk API key — lihat catatan keamanan di `docs/api-integration.md`).
4. **Web controller** (`src/server/`) — Express + EJS, dashboard untuk atur semua di atas lewat browser (localhost).

## Alur pesan masuk

1. Pesan WhatsApp masuk → mesin bot terima
2. Mesin bot cari konteks relevan di database (produk yang disebut, atau histori transaksi user)
3. Konteks + pesan user dikirim ke otak AI sebagai prompt
4. AI balas → mesin bot kirim balik ke WhatsApp
5. Kalau AI gagal atau tidak yakin → trigger human handover (notifikasi ke owner)

## Alur RAG ringan (biar AI tidak "ngarang")

Jangan kirim seluruh isi database ke tiap prompt AI (boros token & biaya user). Sebelum panggil AI:
1. Ambil kata kunci dari pesan user
2. Query sederhana ke database (bukan vector search — cukup query `LIKE` di SQLite untuk v1)
3. Sisipkan hasil query sebagai konteks di system prompt

## Kenapa web controller & wizard jadi satu

Wizard setup adalah halaman pertama dari web controller yang sama (lihat `docs/setup-wizard-flow.md`), bukan installer terpisah. Ini menghindari duplikasi UI dan kerja dua kali.
