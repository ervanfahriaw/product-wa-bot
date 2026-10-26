const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  ShadingType
} = require('docx');

function parseFormattedText(text) {
  const runs = [];
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({
        text: part.slice(2, -2),
        bold: true,
        font: 'Segoe UI',
        size: 22,
        color: '18181B'
      }));
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(new TextRun({
        text: part.slice(1, -1),
        italics: true,
        font: 'Segoe UI',
        size: 22,
        color: '374151'
      }));
    } else if (part.startsWith('`') && part.endsWith('`')) {
      runs.push(new TextRun({
        text: part.slice(1, -1),
        font: 'Consolas',
        size: 20,
        color: '059669'
      }));
    } else {
      runs.push(new TextRun({
        text: part,
        font: 'Segoe UI',
        size: 22,
        color: '27272A'
      }));
    }
  }

  return runs;
}

function buildTable(rows, headerBg) {
  const tableRows = rows.map((row, rowIndex) => {
    return new TableRow({
      children: row.map((cellText) => {
        return new TableCell({
          children: [
            new Paragraph({
              children: parseFormattedText(cellText),
              spacing: { before: 100, after: 100 }
            })
          ],
          shading: rowIndex === 0 ? {
            fill: headerBg,
            type: ShadingType.CLEAR
          } : undefined,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: 'E4E4E7' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E4E4E7' },
            left: { style: BorderStyle.SINGLE, size: 4, color: 'E4E4E7' },
            right: { style: BorderStyle.SINGLE, size: 4, color: 'E4E4E7' }
          }
        });
      })
    });
  });

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE }
  });
}

function buildQuoteBox(text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: 'F4FBF7', type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 24, color: '059669' }
            },
            children: [
              new Paragraph({
                children: parseFormattedText(text),
                spacing: { before: 140, after: 140 }
              })
            ]
          })
        ]
      })
    ]
  });
}

function parseMarkdownToDocx(mdContent, title) {
  const lines = mdContent.split(/\r?\n/);
  const children = [];

  const primaryColor = '065F46'; // Emerald Dark
  const accentColor = '059669';  // Emerald Green
  const tableHeaderBg = 'ECFDF5';

  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith('|') && line.endsWith('|')) {
      if (/^\|[\s\-:|]+\|$/.test(line)) continue;
      inTable = true;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      if (tableRows.length > 0) {
        children.push(buildTable(tableRows, tableHeaderBg));
        children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        tableRows = [];
      }
      inTable = false;
    }

    if (!line) {
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      continue;
    }

    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        text: line.replace('# ', '').trim(),
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 200 },
        run: { font: 'Segoe UI', size: 36, bold: true, color: primaryColor }
      }));
      continue;
    }

    if (line.startsWith('## ')) {
      children.push(new Paragraph({
        text: line.replace('## ', '').trim(),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 160 },
        run: { font: 'Segoe UI', size: 28, bold: true, color: primaryColor }
      }));
      continue;
    }

    if (line.startsWith('### ')) {
      children.push(new Paragraph({
        text: line.replace('### ', '').trim(),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        run: { font: 'Segoe UI', size: 24, bold: true, color: accentColor }
      }));
      continue;
    }

    if (line.startsWith('> ')) {
      children.push(buildQuoteBox(line.replace('> ', '').trim()));
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({
        children: parseFormattedText(line.replace(/^[-*]\s+/, '').trim()),
        bullet: { level: 0 },
        spacing: { after: 60 }
      }));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      children.push(new Paragraph({
        children: parseFormattedText(line.replace(/^\d+\.\s+/, '').trim()),
        bullet: { level: 0 },
        spacing: { after: 60 }
      }));
      continue;
    }

    children.push(new Paragraph({
      children: parseFormattedText(line),
      spacing: { after: 120 }
    }));
  }

  if (tableRows.length > 0) {
    children.push(buildTable(tableRows, tableHeaderBg));
  }

  return new Document({
    sections: [{
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              text: title,
              alignment: AlignmentType.RIGHT,
              run: { font: 'Segoe UI', size: 18, color: '6B7280', italics: true }
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Halaman ', font: 'Segoe UI', size: 18, color: '9CA3AF' }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Segoe UI', size: 18, color: '9CA3AF' })
              ]
            })
          ]
        })
      },
      children
    }]
  });
}

const DESKTOP_MANUAL_CONTENT = `# 📖 BUKU PANDUAN PENGGUNAAN LENGKAP
# WA BOT BISNIS AI — VERSI DESKTOP (PC / LAPTOP)

Selamat datang! Terima kasih telah memilih **WA Bot Bisnis AI (Versi Desktop)**. Dokumen ini adalah panduan resmi langkah-demi-langkah yang disusun secara detail dan ramah pemula agar Anda dapat langsung mengaktifkan Customer Service (CS) dan Sales Otomatis 24 Jam di PC / Laptop Anda.

---

## ⚡ BAB 1: CARA INSTALASI MUDAH (SETUP 1-KLIK)

Paket ini menyertakan file instalasi tunggal **\`Setup_WABot_Bisnis_v1.0.exe\`** yang dirancang khusus dengan arsitektur *Lowest Privilege*. Artinya, software ini **TIDAK memerlukan izin Administrator sistem**, sehingga sangat aman dan tidak merusak pengaturan Windows Anda.

### Langkah-langkah Instalasi:
1. Buka folder instalasi, lalu **Double-Click** pada file **\`Setup_WABot_Bisnis_v1.0.exe\`**.
2. Ikuti instruksi wizard setup di layar:
   - Klik **Next** untuk melanjutkan.
   - Centang opsi **"Create a desktop shortcut"** agar ikon bot muncul di Desktop Anda.
   - Klik **Install** dan tunggu beberapa detik hingga proses selesai.
   - Klik **Finish**.
3. Ikon shortcut **WA Bot Bisnis AI** akan langsung tersedia di layar Desktop dan Start Menu komputer Anda.

---

## 🛡️ BAB 2: CARA LOLOS PERINGATAN WINDOWS SMARTSCREEN (HANYA 2 KLIK)

Ketika Anda membuka file installer yang baru diunduh dari internet, Windows Defender SmartScreen mungkin menampilkan layar biru perlindungan:
> *"Windows protected your PC / Windows melindungi PC Anda - Microsoft Defender SmartScreen prevented an unrecognized app from starting."*

### Mengapa Peringatan Ini Muncul?
Peringatan ini adalah prosedur standar Windows untuk aplikasi independen yang didistribusikan langsung (bukan dari Microsoft Store) dan belum memiliki sertifikat korporat tahunan (*EV Code Signing Certificate*) yang berbiaya jutaan rupiah per tahun. **Ini BUKAN virus dan BUKAN malware.**

### Cara Melewatinya (Sangat Mudah — 1x Saja):
1. Pada layar biru yang muncul, klik tulisan **"More info"** atau **"Info selengkapnya"** di bawah teks.
2. Tombol baru akan muncul di kanan bawah: klik tombol **"Run anyway"** atau **"Tetap jalankan"**.
3. Installer akan langsung berjalan normal dan lancar!

> 💡 **Jaminan Keamanan:** Seluruh komponen aplikasi menggunakan biner resmi Node.js yang ditandatangani digital oleh Microsoft / Node.js Foundation. Installer juga otomatis menjalankan perintah pembuka blokir (*Unblock-File*) sehingga Anda tidak perlu khawatir lagi.

---

## 🚀 BAB 3: MEMULAI APLIKASI & SETUP WIZARD (3 MENIT)

Setelah instalasi selesai:
1. **Double-Click** ikon shortcut **WA Bot Bisnis AI** di Desktop.
2. Aplikasi akan otomatis berjalan di latar belakang (*background*) tanpa membebani layar kerja Anda.
3. Browser Anda (Google Chrome / Microsoft Edge) akan otomatis terbuka dan menampilkan **Setup Wizard** di alamat \`http://localhost:3000\`.

### 4 Langkah Mudah Setup Wizard:
* **Langkah 1: Aktivasi Lisensi:**
  Masukkan kode lisensi resmi yang Anda terima dari pembelian di Lynk.id (Contoh format: \`WABOT-BISN-XXXX-YYYY-ZZZZ\`).
* **Langkah 2: Profil Bisnis & Nomor Owner:**
  Isi nama toko Anda dan nomor WhatsApp Anda sebagai pemilik toko. Jika bot menerima pertanyaan negosiasi harga (nego) atau komplain, bot akan otomatis memberi tahu nomor ini.
* **Langkah 3: Tautkan WhatsApp (Scan QR):**
  Buka WhatsApp di HP Anda $\\to$ ketuk Titik Tiga (⋮) di kanan atas $\\to$ pilih **Perangkat Tertaut (Linked Devices)** $\\to$ arahkan kamera HP ke QR Code yang muncul di layar laptop.
* **Langkah 4: Masukkan API Key Gemini (Gratis):**
  Masukkan API Key Google Gemini (didapatkan 100% gratis dari Google AI Studio).
* **Langkah 5: Masukkan Katalog Produk Awal:**
  Masukkan 1 atau 2 produk toko Anda (Nama, Harga, dan Stok). Anda bisa menambah foto produk atau tautan galeri Google Drive di sini. Langkah ini juga bisa dilewati (*skip*) dan diisi nanti di Dashboard.

---

## 📸 BAB 4: FITUR UNGGULAN: FOTO PRODUK & TAUTAN GALERI CLOUD (\`media_url\`)

Salah satu kelebihan utama WA Bot Bisnis AI ini adalah kemampuannya mengirimkan bukti visual produk kepada calon pembeli:
1. **Kirim Foto Fisik Otomatis:**
   Ketika pelanggan bertanya: *"Bisa liat fotonya kak?"* atau *"Ada foto barangnya?"*, bot akan langsung mengirimkan gambar fisik produk tersebut ke WhatsApp pelanggan.
2. **Tautan Galeri Foto & Video Lengkap (\`media_url\`):**
   Di menu produk, Anda dapat menyematkan link Google Drive, Dropbox, atau video YouTube/TikTok yang berisi seluruh sudut foto & video produk Anda.
   Tautan ini akan otomatis disertakan di bawah foto produk:
   *🔗 Lihat Foto & Video Lengkap: https://drive.google.com/...*
3. **Pencarian Nama Fleksibel:**
   Pelanggan yang mengetik tanpa spasi (misalnya: *"foto fullgold dong"*) tetap dapat dideteksi secara cerdas dan dicocokkan ke produk *"Guppy Full Gold Champion"*.

---

## 🔑 BAB 5: CARA MENDAPATKAN API KEY GEMINI (100% GRATIS)

1. Buka browser dan kunjungi: **https://aistudio.google.com/app/apikey**
2. Login dengan akun Google (Gmail) Anda.
3. Klik tombol biru **"Create API Key"** $\\to$ pilih **"Create API key in new project"**.
4. Salin kode API Key yang muncul (dimulai dengan \`AIzaSy...\`).
5. Tempelkan ke form pengaturan di Web Controller Anda $\\to$ klik **Test Koneksi** $\\to$ Simpan.
6. Kuota gratis dari Google AI Studio sangat besar dan lebih dari cukup untuk melayani ribuan chat pelanggan setiap bulannya.

---

## 🎮 BAB 6: PENGGUNAAN SEHARI-HARI & CARA MEMATIKAN BOT

* **Menyalakan Bot:** Double-click shortcut **WA Bot Bisnis AI** di Desktop.
* **Melihat Laporan & Chat Masuk:** Buka browser di \`http://localhost:3000\`. Anda bisa memantau chat, mengubah harga, menambah stok, dan melihat pesanan masuk.
* **Mematikan Bot:** Buka Start Menu Windows $\\to$ pilih **Matikan WA Bot Bisnis AI**, ATAU buka Web Controller $\\to$ klik tombol matikan bot di pengaturan.
* **Menghubungi Dukungan:** Jika Anda memiliki pertanyaan atau kendala, silakan hubungi kami melalui saluran resmi Lynk.id.
`;

const ANDROID_MANUAL_CONTENT = `# 📱 BUKU PANDUAN PENGGUNAAN LENGKAP
# WA BOT BISNIS AI — VERSI ANDROID (.APK STANDALONE)

Selamat! Anda kini dapat menjalankan Customer Service (CS) dan Sales Otomatis 24 Jam nonstop **langsung di handphone Android Anda**, tanpa perlu laptop, tanpa perlu sewa VPS, dan tanpa perlu paham coding.

---

## ⚡ BAB 1: SPESIFIKASI HP & PERSYARATAN SISTEM

Aplikasi ini menggunakan arsitektur WebSocket murni yang sangat efisien dan hemat daya:
* **Sistem Operasi:** Android 8.0 (Oreo) hingga Android 14 & 15.
* **RAM Minimum:** 3 GB (Sangat optimal pada RAM 4 GB, 6 GB, atau 8 GB).
* **Beban Baterai:** Hanya ~1–2% per jam.
* **Penggunaan RAM:** ~50–80 MB (Sangat ringan, tidak membuat HP panas atau lemot).
* **Koneksi:** WiFi atau Paket Data yang aktif.

---

## 📥 BAB 2: CARA INSTALASI FILE .APK DI SMARTPHONE

1. Salin atau unduh berkas **\`wa-bot-bisnis.apk\`** ke HP Android Anda.
2. Buka aplikasi **File Manager** / **File Saya**, lalu cari dan ketuk file **\`wa-bot-bisnis.apk\`**.
3. Jika muncul pesan keamanan:
   > *"Demi keamanan, ponsel Anda tidak diizinkan menginstal aplikasi yang tidak dikenal dari sumber ini"*
   Lakukan langkah berikut:
   - Ketuk menu **Setelan / Pengaturan** (*Settings*).
   - Aktifkan toggle **"Izinkan dari sumber ini"** (*Allow from this source*).
   - Tekan tombol kembali (*Back*), lalu ketuk tombol **Instal**.
4. Tunggu beberapa detik hingga pemasangan selesai, kemudian ketuk **Buka**.

---

## 🛡️ BAB 3: PENGATURAN WAJIB ANTI-KILLED (AGAR BOT AKTIF 24 JAM NONSTOP)

Sistem operasi Android memiliki fitur penghemat baterai agresif yang dapat mematikan aplikasi di latar belakang saat layar mati. Lakukan pengaturan sederhana ini satu kali saja:

### 1. Izinkan Notifikasi Sistem
Ketika pertama kali membuka aplikasi, pilih **Izinkan (Allow)** pada dialog notifikasi. Notifikasi *"WA Bot Assistant Aktif Melayani Chat"* akan stand-by di bar atas sebagai pelindung agar proses bot tidak dimatikan Android.

### 2. Izinkan Pengecualian Baterai (*Battery Optimization Whitelist*)
Saat aplikasi menampilkan dialog permintaan izin optimasi baterai, ketuk **Izinkan (Allow / Unrestricted)**.

### 3. Panduan Pengaturan Berdasarkan Merk HP:
* **Xiaomi / Redmi / POCO (MIUI / HyperOS):**
  - Tekan lama ikon aplikasi di layar $\\to$ pilih **Info Aplikasi** (*App Info*).
  - Pilih **Penghemat Baterai** $\\to$ ubah ke **Tidak Ada Batasan** (*No restrictions*).
  - Aktifkan tombol **Mulai Otomatis** (*Autostart*).
* **Samsung (One UI):**
  - Tekan lama ikon aplikasi $\\to$ ketuk ikon **(i)** (*Info Aplikasi*).
  - Pilih menu **Baterai** $\\to$ ubah menjadi **Tidak Dibatasi** (*Unrestricted*).
* **Oppo / Realme (ColorOS / Realme UI):**
  - Tekan lama ikon aplikasi $\\to$ **Info Aplikasi** $\\to$ **Penggunaan Baterai**.
  - Aktifkan opsi **Izinkan Aktivitas Latar Belakang** dan **Izinkan Peluncuran Otomatis**.
* **Vivo / iQOO (Funtouch OS):**
  - Buka **Pengaturan HP** $\\to$ **Baterai** $\\to$ **Konsumsi Daya Latar Belakang Tinggi** $\\to$ ubah WA Bot menjadi **Izinkan**.

---

## 🚀 BAB 4: SETUP AWAL BOT MELALUI LAYAR HP (3 MENIT)

Saat aplikasi pertama kali dibuka, tampilan panel kontrol akan muncul secara otomatis di layar HP:
1. **Aktivasi Lisensi:** Masukkan kode lisensi resmi dari Lynk.id Anda.
2. **Profil Toko:** Masukkan nama toko Anda dan nomor WhatsApp Owner.
3. **Tautkan WhatsApp (Scan QR):**
   - Di layar aplikasi akan muncul gambar QR Code.
   - Buka WhatsApp di HP lain (atau WhatsApp utama di HP yang sama menggunakan bantuan foto QR):
   - Masuk ke menu **Titik Tiga (⋮)** di WhatsApp $\\to$ **Perangkat Tertaut (Linked Devices)** $\\to$ **Tautkan Perangkat** $\\to$ scan QR Code tersebut.
4. **Masukkan API Key Gemini:** Masukkan API Key gratis dari Google AI Studio.
5. **Katalog Produk:** Masukkan produk, harga, dan stok awal toko Anda.
6. **Selesai!** Bot Anda kini langsung aktif 100% melayani pembeli otomatis.

---

## 🎮 BAB 5: PENGGUNAAN SEHARI-HARI

* **Menjalankan di Latar Belakang:** Anda dapat menekan tombol **Home** atau berpindah ke aplikasi lain kapan saja. Bot akan tetap standby melayani chat pelanggan di background.
* **Fitur Auto-Boot:** Jika HP Anda restart atau mati kehabisan baterai, bot akan otomatis menyala kembali saat HP dihidupkan tanpa perlu dibuka manual.
* **Mengedit Produk:** Cukup buka kembali aplikasi kapan saja, pilih tab **Katalog Produk**, perbarui data stok atau harga, lalu simpan.
* **Mematikan Bot:** Jika Anda ingin beristirahat atau menonaktifkan bot, buka menu Pengaturan di dalam aplikasi dan tekan tombol jeda / matikan.
`;

async function main() {
  console.log('Generating Final Professional Word Manuals (.docx)...');

  // 1. Desktop Docx
  const docDesktop = parseMarkdownToDocx(DESKTOP_MANUAL_CONTENT, 'Panduan WA Bot Bisnis AI - Versi Desktop');
  const bufDesktop = await Packer.toBuffer(docDesktop);
  const outDesktop = path.join(__dirname, '../docs/Panduan_Lengkap_WA_Bot_Bisnis_Desktop.docx');
  fs.writeFileSync(outDesktop, bufDesktop);
  console.log(`✅ Desktop DOCX berhasil dibuat: ${outDesktop} (${bufDesktop.length} bytes)`);

  // 2. Android Docx
  const docAndroid = parseMarkdownToDocx(ANDROID_MANUAL_CONTENT, 'Panduan WA Bot Bisnis AI - Versi Android');
  const bufAndroid = await Packer.toBuffer(docAndroid);
  const outAndroid = path.join(__dirname, '../docs/Panduan_Lengkap_WA_Bot_Bisnis_Android.docx');
  fs.writeFileSync(outAndroid, bufAndroid);
  console.log(`✅ Android DOCX berhasil dibuat: ${outAndroid} (${bufAndroid.length} bytes)`);
}

main().catch(err => {
  console.error('Error generating docx:', err);
  process.exit(1);
});
