# Roadmap

## Status Produksi v1

### ✅ Fitur v1 yang Sudah Selesai & Teruji (Fase 0 - 8):
- [x] **Database Layer**: SQLite `data/bot.db` (`better-sqlite3`), tabel `settings`, `products`, `expenses`, `reminders`, `chat_logs`.
- [x] **Mesin Bot**: `whatsapp-web.js` + `LocalAuth` (sesi lokal aman), auto-clean session lock, auto-reconnect.
- [x] **Web Controller & Setup Wizard**: 4 langkah wizard interaktif (pilih mode, scan QR live polling, API key BYOK, data awal) dengan EJS + Tailwind + Alpine.js.
- [x] **AI Integration Layer**: Unified AI Router (`src/ai/router.js`), Gemini API (teks) & Grok Vision API (gambar), RAG ringan berbasis kata kunci SQLite, graceful human fallback message.
- [x] **Mode Bisnis**: Cek ketersediaan stok, kirim foto katalog (`MessageMedia`), rekomendasi produk, dan *Human Handover* (notifikasi otomatis ke nomor pemilik saat ada komplain/nego).
- [x] **Mode Personal**: Pencatatan pengeluaran dari kalimat bebas (AI intent + rule-based parser), konfirmasi pencatatan, rekap keuangan *on-demand*, dan pengingat jadwal (*reminder*) otomatis via `node-cron`.
- [x] **Dashboard Management**: Manajemen CRUD Produk (Bisnis), CRUD Pengeluaran (Personal), Audit Riwayat Chat Log (filter kontak), Pengaturan API Key dengan tombol "⚡ Test Koneksi" live.
- [x] **Audit & Error Handling**: Bebas *silent-fail*, penanganan pesan kosong/stiker, keamanan `.gitignore`.

### ⏳ Tahap v1 Selanjutnya:
- [ ] **Fase 9 — Packaging & Deployment**: Build `.exe` single binary dengan `pkg` + script setup VPS `scripts/deploy-vps.sh`.
- [ ] **Fase 10 — QA Final & Persiapan Rilis**: Checklist uji coba manual end-to-end sebelum didistribusikan di Lynk.id.

---

## v2 (Rencana Pembaruan Versi Berikutnya)
- Statistik / analitik grafik pengeluaran & penjualan di dashboard.
- Kategori custom dinamis di Mode Personal.
- Export data transaksi & stok ke Excel / CSV dari dashboard.
- Multi-nomor / multi-cabang untuk Mode Bisnis.

## Belum Diprioritaskan (Sengaja Ditunda)
- Broadcast massal (menghindari risiko banned WhatsApp).
- Vector database / RAG embeddings lanjutan (v1 sudah sangat efisien dengan SQLite keyword search).
