# Integrasi AI (BYOK — Bring Your Own Key)

## Prinsip
- User pakai API key mereka sendiri — kita tidak menanggung biaya AI apa pun
- Semua panggilan AI lewat `src/ai/router.js`, jangan panggil SDK provider langsung dari file lain

## Provider
- Teks: Gemini API
- Gambar (opsional): Grok Vision API — kalau user tidak isi, fitur baca gambar otomatis nonaktif (jangan error, kasih pesan jelas di dashboard)

## Penyimpanan API key
- Disimpan di `config/config.json` lokal di device user (bukan dikirim ke server manapun milik kita)
- Tampilkan di dashboard settings dalam bentuk masked (contoh: `sk-••••••1234`) setelah disimpan

## Validasi
- Saat user simpan API key di wizard/settings, lakukan satu test-call kecil ke provider, tampilkan status berhasil/gagal langsung di UI

## Format prompt
- System prompt disusun dari: template dasar (`src/ai/prompts/{mode}/base.md`) + konteks dari database (lihat `docs/architecture.md` bagian "Alur RAG ringan")
- Jangan sisipkan seluruh isi database ke prompt — hanya hasil query yang relevan
