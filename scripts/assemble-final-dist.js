const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const FINAL_DIR = path.join(DIST_DIR, 'FINAL');
const ANDROID_FINAL_DIR = path.join(FINAL_DIR, 'Versi Android');
const DESKTOP_FINAL_DIR = path.join(FINAL_DIR, 'Versi Desktop');

console.log('======================================================');
console.log('       ASSEMBLING FINAL COMMERCIAL DISTRIBUTION       ');
console.log('======================================================\n');

// 1. Buat struktur direktori FINAL
if (fs.existsSync(FINAL_DIR)) {
  fs.rmSync(FINAL_DIR, { recursive: true, force: true });
}
fs.mkdirSync(ANDROID_FINAL_DIR, { recursive: true });
fs.mkdirSync(DESKTOP_FINAL_DIR, { recursive: true });

// 2. Salin Paket Versi Android
console.log('📱 Menyiapkan Versi Android...');
const apkSource = path.join(DIST_DIR, 'wa-bot-bisnis.apk');
const apkDest = path.join(ANDROID_FINAL_DIR, 'wa-bot-bisnis.apk');
const androidDocxSource = path.join(ROOT_DIR, 'docs', 'Panduan_Lengkap_WA_Bot_Bisnis_Android.docx');
const androidDocxDest = path.join(ANDROID_FINAL_DIR, 'Panduan_Lengkap_WA_Bot_Bisnis_Android.docx');

if (!fs.existsSync(apkSource)) {
  throw new Error(`File APK sumber tidak ditemukan di: ${apkSource}`);
}
fs.copyFileSync(apkSource, apkDest);
console.log(`   ✅ Berkas APK disalin: wa-bot-bisnis.apk (${(fs.statSync(apkDest).size / (1024 * 1024)).toFixed(2)} MB)`);

if (!fs.existsSync(androidDocxSource)) {
  throw new Error(`File Panduan Android Word tidak ditemukan di: ${androidDocxSource}`);
}
fs.copyFileSync(androidDocxSource, androidDocxDest);
console.log(`   ✅ Manual Book Word disalin: Panduan_Lengkap_WA_Bot_Bisnis_Android.docx (${fs.statSync(androidDocxDest).size} bytes)`);

// 3. Salin Paket Versi Desktop
console.log('\n💻 Menyiapkan Versi Desktop...');
const exeSource = path.join(DIST_DIR, 'Setup_WABot_Bisnis_v1.0.exe');
const exeDest = path.join(DESKTOP_FINAL_DIR, 'Setup_WABot_Bisnis_v1.0.exe');
const desktopDocxSource = path.join(ROOT_DIR, 'docs', 'Panduan_Lengkap_WA_Bot_Bisnis_Desktop.docx');
const desktopDocxDest = path.join(DESKTOP_FINAL_DIR, 'Panduan_Lengkap_WA_Bot_Bisnis_Desktop.docx');

if (!fs.existsSync(exeSource)) {
  throw new Error(`File Installer Desktop sumber tidak ditemukan di: ${exeSource}`);
}
fs.copyFileSync(exeSource, exeDest);
console.log(`   ✅ File Instalasi Desktop disalin: Setup_WABot_Bisnis_v1.0.exe (${(fs.statSync(exeDest).size / (1024 * 1024)).toFixed(2)} MB)`);

if (!fs.existsSync(desktopDocxSource)) {
  throw new Error(`File Panduan Desktop Word tidak ditemukan di: ${desktopDocxSource}`);
}
fs.copyFileSync(desktopDocxSource, desktopDocxDest);
console.log(`   ✅ Manual Book Word disalin: Panduan_Lengkap_WA_Bot_Bisnis_Desktop.docx (${fs.statSync(desktopDocxDest).size} bytes)`);

console.log('\n======================================================');
console.log('  🎉 STRUKTUR FOLDER DIST/FINAL BERHASIL DIBUAT!');
console.log('======================================================\n');
