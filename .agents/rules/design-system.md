# Design system — web controller

> Versi ini MENGGANTIKAN draft sebelumnya. Diturunkan dari referensi visual asli di `assets/mockups/design-reference.jpg` — buka file itu langsung untuk kalibrasi piksel sebelum membangun komponen baru. Dokumen ini adalah interpretasi tertulisnya, dan menjadi rujukan utama.

## Filosofi

- **Monokrom + satu warna aksen.** Hitam/putih/abu-abu mendominasi hampir seluruh UI. Warna aksen (ungu lavender) dipakai SANGAT terbatas — hanya untuk elemen interaktif kunci (tombol kirim, swatch terpilih, indikator aktif). Jangan sebar warna aksen ke banyak elemen sekaligus.
- **Flat, hampir tanpa shadow.** Pemisah antar-section pakai garis divider tipis (hairline), BUKAN card dengan drop-shadow.
- **Whitespace lebar.** Padding dan jarak antar elemen longgar — ini yang bikin kesan "premium/tenang", bukan kepadatan informasi.
- **Sudut membulat konsisten.** Semua elemen interaktif (tombol, input, badge, upload box) pakai radius membulat, bukan sudut tajam.
- Dashboard ini dipakai orang awam (bukan developer) — tetap: jelas, tidak bikin takut, tidak banyak jargon teknis.

## Warna

| Token | Hex | Pemakaian |
|---|---|---|
| `--bg-page` | `#FFFFFF` | Background utama sidebar & konten |
| `--bg-canvas` | `#F7F7F8` | Background area sekunder (mis. area di sekitar preview/mockup) |
| `--bg-subtle` | `#F4F4F5` | Fill untuk upload box, placeholder, avatar fallback |
| `--text-primary` | `#18181B` | Judul, label, teks utama |
| `--text-secondary` | `#71717A` | Deskripsi, helper text, teks nav non-aktif |
| `--text-muted` | `#A1A1AA` | Placeholder input |
| `--border` | `#E4E4E7` | Divider, garis pemisah section, border input |
| `--border-strong` | `#D4D4D8` | Border yang butuh sedikit lebih terlihat (mis. toggle OFF track) |
| `--accent` | `#7F77DD` | SATU-SATUNYA warna aksen — tombol kirim, swatch terpilih, indikator aktif |
| `--accent-text` | `#3C3489` | Teks di atas background aksen muda (kontras cukup) |
| `--fill-primary` | `#18181B` | Tombol utama (Simpan), toggle ON |
| `--text-on-primary` | `#FFFFFF` | Teks/knob di atas `--fill-primary` |
| `--danger` | `#DC2626` | Tombol/aksi destruktif (hapus data) — dipakai terbatas, bukan bagian dari palet utama |
| `--success` | `#16A34A` | Status "tersambung" — dipakai terbatas |

Catatan: `--danger` dan `--success` sengaja tetap ada di luar palet "monokrom + satu aksen" karena statusnya butuh sinyal universal (merah=bahaya, hijau=aman) yang sudah dikenal user awam — tapi tetap pakai seminim mungkin, hanya untuk badge status/tombol destruktif.

## Tipografi

- **Font: Inter**, dimuat lewat Google Fonts CDN (`fonts.googleapis.com`). Ini MENGGANTIKAN aturan draft lama "jangan pakai Google Fonts" — referensi visual butuh konsistensi bentuk huruf lintas OS yang tidak bisa dijamin system font stack. Tetap satu `<link>` tag saja, tanpa build step, konsisten dengan prinsip "tanpa bundler" di `tech-stack.md`.
- Skala:
  | Elemen | Ukuran | Weight |
  |---|---|---|
  | Hero heading (mis. judul besar di state kosong) | 36–40px | 700 |
  | Judul halaman (mis. "Pengaturan") | 26–28px | 700 |
  | Label form | 15–16px | 500 |
  | Body / isi list | 15–16px | 400 |
  | Deskripsi / helper text | 13px | 400, pakai `--text-secondary` |
  | Nav sidebar | 14–15px | 500 |

## Spacing & radius

- Padding sidebar: 20–24px
- Padding area konten utama: 32–40px
- Jarak antar baris form (dengan divider di antaranya): 28–32px
- Radius tombol & badge kecil: pill penuh (`border-radius: 999px`)
- Radius input, upload box, card: `12–16px`
- Radius badge logo kecil (kotak inisial): `8–10px`
- Icon: gaya outline/line (stroke), ukuran 18–20px, warna ikut warna teks di sekitarnya (jangan icon berwarna sendiri kecuali status)

## Komponen

### Sidebar navigasi
- Struktur: badge inisial + nama workspace (dropdown) → divider → grup menu utama → divider → menu terpisah (Pengaturan) → divider → info/status kecil → profil user di paling bawah
- Item aktif: background `--bg-subtle`, radius 8–10px, teks `--text-primary` weight 500
- Item non-aktif: tanpa background, teks `--text-secondary`
- Menu untuk produk kita: **Dashboard, Produk (mode bisnis) / Kategori (mode personal), Chat Log** sebagai satu grup, lalu **Pengaturan** sebagai grup terpisah di bawahnya (persis pola grouping di referensi)

### Toggle switch
- Track 36×20px, radius penuh
- ON: track `--fill-primary` (hitam), knob putih di kanan
- OFF: track `--border-strong` (abu-abu), knob putih di kiri
- Tidak ada warna aksen di toggle — konsisten dengan prinsip "aksen dipakai sangat terbatas"

### Tombol
- Primer (mis. "Simpan perubahan"): fill `--fill-primary`, teks `--text-on-primary`, radius penuh, padding `10px 20px`
- Sekunder (mis. "Batalkan"): background putih, border 1px `--border`, teks `--text-primary`, radius penuh
- Destruktif: border/teks `--danger`, tetap radius penuh, WAJIB modal konfirmasi sebelum eksekusi

### Color/swatch picker
- Lingkaran 26–32px, border tipis. Kalau terpilih, tambahkan ring/outline tipis di sekelilingnya

### Upload/placeholder box
- Fill `--bg-subtle`, radius 12–16px, tanpa border tegas (atau border sangat tipis `--border`)

### Baris pengaturan (settings row)
Pola paling sering dipakai di seluruh dashboard kita: **label + deskripsi kecil di kiri, kontrol (toggle/input/swatch) di kanan, dipisah divider tipis dari baris berikutnya.** Ini dipakai di halaman Settings, dan juga cocok dipakai di step 3 wizard (form API key).

### Hero / empty state
Untuk state kosong (mis. "Belum ada chat masuk", atau layar awal wizard): judul besar bold di tengah + subteks abu-abu 1–2 baris di bawahnya + opsional daftar aksi cepat sebagai list dengan divider tipis (bukan tombol/card). Referensi persis: bagian "How can I help?" di kanan gambar acuan.

### Input dengan tombol kirim mengambang
Kalau ada input besar (mis. box "Ask anything" di referensi), tombol aksi utamanya boleh berbentuk lingkaran warna aksen yang menumpuk di sudut kanan bawah input — satu-satunya tempat lain selain toggle ON yang boleh pakai `--accent` secara solid.

## Pemetaan eksplisit ke halaman kita

| Elemen di referensi | Elemen di produk kita |
|---|---|
| Sidebar: Training/Design/Domains/Get paid/Chat logs/Users | Sidebar: Dashboard/Produk atau Kategori/Chat Log, lalu Pengaturan terpisah |
| Badge "CO" + nama "Companion" | Badge inisial bisnis + nama bisnis/bot (diisi user di wizard step 1) |
| Panel "Design" dengan toggle Display name/Logo/dst | Panel "Pengaturan" dengan toggle fitur (balasan otomatis, notifikasi handover, dst) — pola baris yang SAMA |
| Preview browser "companion.outchat.ai" + "How can I help?" | Tidak perlu ditiru literal (kita tidak punya public site) — tapi pola hero+subtext+list ini dipakai untuk empty state Chat Log dan layar awal wizard |
| Indikator "Messages 2/100" + Upgrade | Tidak relevan (bukan produk berlangganan/AI kita) — boleh diganti indikator status koneksi WhatsApp di posisi yang sama |
| Avatar "Liam" di bawah sidebar | Avatar admin/pemilik bisnis, sama posisinya |

## Yang TIDAK boleh dilakukan

- Jangan pakai lebih dari satu warna aksen sekaligus di satu layar
- Jangan pakai drop-shadow tebal atau card bertumpuk dengan shadow besar — pemisah pakai divider garis
- Jangan pakai sudut tajam (radius 0) di elemen interaktif
- Jangan pakai warna selain yang ada di tabel token di atas tanpa persetujuan eksplisit
- Jangan campur icon set — pilih satu library outline icon (mis. Lucide via CDN) dan pakai konsisten di seluruh dashboard
