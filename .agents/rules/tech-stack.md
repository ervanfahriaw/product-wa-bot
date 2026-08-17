# Tech stack — WAJIB, jangan diganti tanpa izin user

Stack ini sudah final berdasarkan diskusi produk. Kalau agent merasa ada library "lebih baik", tanya ke user dulu — jangan ganti diam-diam. Konsistensi stack lebih penting daripada optimisasi prematur.

## Runtime
- Node.js LTS (v20+)
- Package manager: npm (bukan yarn/pnpm, biar konsisten)

## Bot engine
- `whatsapp-web.js` — koneksi ke WhatsApp Web
- `puppeteer` (dependency whatsapp-web.js) — jangan diutak-atik versi manual
- Strategi sesi: `LocalAuth` — sesi tersimpan lokal, jangan pakai `NoAuth` (akan minta scan QR tiap start)

## Web controller (backend)
- `express` — server & routing
- `ejs` — server-rendered view, BUKAN React/Vue/Next.js (menghindari build step yang bikin packaging exe ribet)
- `better-sqlite3` — database, satu file `.db`, tanpa server database terpisah

## Web controller (frontend, tanpa build step)
- Tailwind lewat CDN script (bukan Tailwind CLI/PostCSS)
- `Alpine.js` lewat CDN — untuk interaktivitas ringan (toggle, form step wizard)
- Vanilla JS untuk sisanya. Jangan tambah framework frontend baru.

## AI integration (BYOK — Bring Your Own Key)
- Provider teks default: Gemini API
- Provider baca gambar: Grok Vision API (atau Gemini vision sebagai fallback)
- Semua panggilan AI lewat satu layer adapter di `src/ai/router.js` — supaya provider bisa ditambah/diganti tanpa ubah kode di tempat lain

## Fitur pendukung
- `qrcode` — generate QR WhatsApp untuk ditampilkan di browser
- `node-cron` — jadwal reminder & rekap otomatis
- `open` — auto-buka browser ke localhost saat pertama kali dijalankan

## Packaging & distribusi
- Opsi PC/Laptop: dibungkus jadi `.exe` pakai `pkg`
- Opsi VPS: dijalankan pakai `pm2` (process manager), bukan `node index.js` langsung (biar auto-restart kalau crash)
- Jangan tambah Docker kecuali user minta eksplisit — target buyer awam, Docker terlalu ribet untuk mereka

## Yang SENGAJA tidak dipakai (jangan diusulkan)
- React / Vue / Next.js / Nuxt — build step bikin packaging exe kompleks
- MongoDB / PostgreSQL — butuh server database terpisah, bertentangan dengan tujuan "sekali install jalan sendiri"
- Docker sebagai wajib — opsional, bukan default
