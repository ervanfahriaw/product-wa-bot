# AGENTS.md — WA Bot Bisnis & Asisten Pribadi

Dokumen ini dibaca agent (Antigravity) di awal setiap sesi. Baca dokumen ini dan file di `.agents/rules/` SEBELUM menulis kode apa pun.

## Tentang proyek ini

Produk WhatsApp bot yang dijual sebagai source code / installer siap pakai (dijual di Lynk.id). Bot punya dua mode:

1. **Mode Bisnis** — cek stok, kirim gambar produk, rekomendasi, jawab pertanyaan produk secara natural.
2. **Mode Asisten Pribadi** — catat pengeluaran, rekap keuangan, reminder.

Semua konfigurasi (mode, API key, data produk) diatur lewat **web controller** lokal (dashboard di browser), bukan edit file kode. Baca `docs/brief.md` untuk detail lengkap.

## Urutan baca dokumen

1. `.agents/rules/tech-stack.md` — stack yang WAJIB dipakai, jangan ganti tanpa izin eksplisit dari user
2. `.agents/rules/coding-conventions.md` — standar kode
3. `.agents/rules/design-system.md` — gaya visual web controller
4. `docs/brief.md` — konteks produk & tujuan
5. `docs/architecture.md` — cara komponen saling terhubung
6. `docs/database-schema.md` — skema data
7. Dokumen `docs/features-*.md` dan `docs/setup-wizard-flow.md` sesuai fitur yang sedang dikerjakan

## Aturan kerja dengan agent

- Selalu cek dokumen relevan di `docs/` sebelum implementasi fitur baru, jangan asumsi sendiri.
- Kalau ada keputusan teknis yang tidak dijawab dokumen (misal nama library baru), TANYA dulu ke user — jangan pilih sendiri diam-diam.
- Kalau ada keputusan baru yang disepakati saat coding, update dokumen terkait di `docs/` juga, supaya dokumentasi tetap jadi sumber kebenaran tunggal (jangan biarkan dokumen basi).
- Jangan commit file `.env`, `config/config.json` (isi API key user), folder session WhatsApp, atau file `.db` ke git — sudah diatur di `.gitignore`, jangan diubah.

## Prompt per fase

Pembangunan produk ini dikerjakan bertahap, satu fase satu sesi. Urutan dan isi prompt tiap fase ada di `PROMPTS.md` di root project. Kalau kamu diberi prompt yang menyebut "Fase N", cek `PROMPTS.md` untuk memastikan kamu tidak keluar scope fase tersebut dan tidak mengerjakan bagian fase lain lebih dulu.

## Skala proyek

Ini proyek solo-dev untuk dijual sebagai produk digital. Prioritaskan kode yang **mudah dibaca dan di-maintain satu orang**, bukan arsitektur enterprise yang berlebihan.
