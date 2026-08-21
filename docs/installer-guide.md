# Panduan Kompilasi & Distribusi Windows Installer (.exe)

Dokumen ini menjelaskan cara membuat dan mendistribusikan file installer resmi (**`Setup_WABot_Bisnis_v1.0.exe`**) untuk pembeli di platform Lynk.id / website Anda.

---

## 🎯 Mengapa Menggunakan Installer (.exe)?
1. **Bebas dari Pemblokiran Smart App Control (Windows 11)**:
   Saat pembeli menjalankan installer, Windows mengekstrak file ke folder lokal pengguna (`%LocalAppData%\WABotController`). File hasil instalasi tidak memiliki metadata *Mark-of-the-Web (MOTW)*, sehingga file `.vbs` dan `node.exe` dapat berjalan lancar tanpa diblokir oleh Smart App Control.
2. **Tanpa Perlu Hak Administrator (UAC Prompt)**:
   Installer diatur dengan `PrivilegesRequired=lowest`. Pembeli dapat menginstal aplikasi langsung tanpa memerlukan password Administrator komputer.
3. **Pengalaman Pengguna yang Bersih & Profesional**:
   - Ikon Shortcut otomatis di Desktop dan Start Menu ("WA Bot Controller").
   - Menjalankan bot secara *silent* di latar belakang tanpa jendela hitam CMD yang mengganggu.
   - Otomatis membuka browser ke `http://localhost:3000`.
   - Dilengkapi shortcut "Hentikan WA Bot" dan "Uninstall".
4. **Ukuran File Sangat Ramping**:
   Berkat kompresi `lzma2/ultra64`, seluruh paket Node.js, source code, dan dependensi hanya berukuran **~29.7 MB**.

---

## 🛠️ Cara Membuat File Installer Baru

### Cara 1: Menggunakan Script 1-Klik
Cukup klik ganda file:
```cmd
build-installer.bat
```

### Cara 2: Melalui Terminal / Command Prompt
```bash
& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" installer.iss
```
File installer siap jual akan otomatis tersimpan di:
👉 **`dist/Setup_WABot_Bisnis_v1.0.exe`**

---

## 📦 File Peluncur yang Disediakan
- **`Jalankan_Bot.vbs`**: Menjalankan server Node.js di background tanpa jendela CMD dan membuka `http://localhost:3000` di browser.
- **`Hentikan_Bot.vbs`**: Menghentikan proses server bot jika pengguna ingin mematikan aplikasi.
- **`start.bat`**: Peluncur alternatif dengan jendela terminal (berguna jika ingin melihat log real-time untuk debugging).

---

## 🚀 Langkah Upload ke Lynk.id
1. Jalankan `build-installer.bat` untuk menghasilkan file terbaru di folder `dist/`.
2. Upload file **`dist/Setup_WABot_Bisnis_v1.0.exe`** ke Google Drive Anda atau langsung ke produk digital di **Lynk.id**.
3. Pembeli cukup mengunduh file `.exe` tersebut, melakukan instalasi (Next -> Next -> Install), dan aplikasi langsung siap digunakan!
