const db = require('../db');
const { getConfig, saveConfig, isSetupComplete } = require('../config');
const { normalizePhoneNumber } = require('../utils/phone');

/**
 * Membangun pesan sambutan dan panduan singkat untuk dikirim ke nomor owner.
 * @param {'bisnis'|'personal'} mode 
 * @param {object} [config] 
 * @returns {string}
 */
function buildOnboardingMessage(mode, config = {}) {
  const isBisnis = mode === 'bisnis' || mode === 'business';
  const businessName = config.business_name || db.getSetting('business_name') || 'Toko Kami';
  const port = config.port || (db.getSetting ? db.getSetting('port') : 3000) || 3000;
  const dashboardUrl = `http://localhost:${port}`;

  if (isBisnis) {
    return `🎉 *[SELAMAT DATANG DI WA BOT BISNIS AI]*\n\n` +
      `Halo Pemilik *${businessName}*! 👋\n` +
      `Nomor WhatsApp bot Anda sekarang sudah resmi *AKTIF & SIAP DIGUNAKAN* untuk melayani pelanggan secara otomatis 24/7.\n\n` +
      `Berikut panduan ringkas cara mengelola bot langsung dari chat WhatsApp ini:\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🛒 *1. CARA MENCATAT PESANAN (ORDER FORM)*\n` +
      `Anda dapat langsung mencatat pesanan closing pembeli dengan mengirim format form seperti contoh berikut:\n\n` +
      `_pesanan 1_\n` +
      `_nama penerima : (Nama Pembeli)_\n` +
      `_no penerima : (Nomor WhatsApp Pembeli)_\n` +
      `_alamat : (Alamat Lengkap Pengiriman)_\n` +
      `_pesanan : (Nama Produk & Jumlah)_\n` +
      `_total : (Total Pembayaran)_\n\n` +
      `👉 *Bot otomatis memasukkannya ke Dashboard Orders!*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🤝 *2. CARA MENANGANI HANDOVER (PENGALIHAN)*\n` +
      `• Saat pelanggan menawar harga (nego) atau komplain, bot akan otomatis *menjeda chat 2 jam* dan membuat tiket antrean di dashboard serta memberi tahu Anda.\n` +
      `• Setelah Anda selesai melayani pelanggan secara manual, aktifkan kembali bot dengan mengetik:\n` +
      `  👉 \`!selesai\` atau \`!aktifkan 081234567890\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *3. PERINTAH CEPAT LAINNYA*\n` +
      `• \`!status\` 👉 Cek status bot & daftar pelanggan yang sedang dijeda\n` +
      `• \`!jeda [nomor] [jam]\` 👉 Menjeda bot manual (cth: \`!jeda 081234567890 3\`)\n` +
      `• \`!handover on\` / \`!handover off\` 👉 Mengaktifkan atau menonaktifkan fitur handover\n` +
      `• \`!help\` 👉 Melihat panduan bantuan perintah lengkap\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Web Controller Dashboard:*\n` +
      `${dashboardUrl}\n` +
      `_Buka di browser untuk kelola katalog produk, stok, profil usaha, dan memantau chat log._\n\n` +
      `_Pesan panduan sambutan ini hanya dikirimkan 1x saat aktivasi bot selesai._`;
  }

  // Mode Personal
  return `🎉 *[SELAMAT DATANG DI WA ASISTEN PRIBADI AI]*\n\n` +
    `Halo! 👋\n` +
    `WhatsApp Asisten Pribadi AI Anda sekarang sudah resmi *AKTIF & SIAP DIGUNAKAN* untuk membantu pencatatan keuangan dan produktivitas harian Anda.\n\n` +
    `Berikut panduan ringkas cara menggunakannya:\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *1. CATAT PENGELUARAN DARI KALIMAT BEBAS*\n` +
    `Cukup kirim chat bebas seperti obrolan biasa:\n` +
    `• _"Beli bensin 30rb"_\n` +
    `• _"Makan siang nasi padang 25.000"_\n` +
    `• _"Bayar listrik 150k"_\n` +
    `👉 *Asisten langsung mencatat dan mengelompokkan kategorinya secara otomatis!*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *2. REKAP KEUANGAN & ANGGARAN*\n` +
    `• _"Rekap pengeluaran bulan ini"_\n` +
    `• _"Sisa budget makan berapa?"_\n` +
    `• _"Hari ini habis berapa?"_\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⏰ *3. PENGINGAT (REMINDER) & CATATAN*\n` +
    `• _"Ingatkan bayar tagihan wifi besok jam 8 pagi"_\n` +
    `• _"Catat to do: beli pakan ikan prioritas tinggi"_\n` +
    `• _"Catat note: ide judul artikel baru"_\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Web Controller Dashboard:*\n` +
    `${dashboardUrl}\n` +
    `_Buka di browser untuk melihat grafik keuangan, habit tracker, kalender event, dan ekspor data ke Excel._\n\n` +
    `_Pesan panduan sambutan ini hanya dikirimkan 1x saat aktivasi bot selesai._`;
}

/**
 * Mengirim pesan sambutan & panduan pertama kali ke nomor owner/pemilik bot jika belum pernah dikirim.
 * @param {import('whatsapp-web.js').Client} client 
 * @returns {Promise<{sent: boolean, reason?: string, recipient?: string}>}
 */
async function sendOneTimeOnboardingWelcome(client) {
  if (!client || typeof client.sendMessage !== 'function') {
    return { sent: false, reason: 'CLIENT_NOT_READY' };
  }

  // 1. Cek apakah sudah pernah dikirim sebelumnya
  const alreadySent = db.getSetting ? db.getSetting('welcome_onboarding_sent') : null;
  if (alreadySent === 'true' || alreadySent === '1') {
    return { sent: false, reason: 'ALREADY_SENT' };
  }

  // 2. Cek apakah setup wizard sudah selesai
  const isCompleted = isSetupComplete();
  if (!isCompleted) {
    return { sent: false, reason: 'SETUP_NOT_COMPLETED' };
  }

  // 3. Ambil nomor kontak tujuan (Owner Phone)
  const config = getConfig();
  const rawOwnerPhone = (db.getSetting ? db.getSetting('owner_phone') : null) || config.owner_phone || '';
  const cleanPhone = normalizePhoneNumber(rawOwnerPhone);
  const activeMode = (db.getSetting ? db.getSetting('mode') : null) || config.mode || 'bisnis';
  const isBisnis = activeMode === 'bisnis' || activeMode === 'business';

  let targetJid = '';
  if (cleanPhone) {
    targetJid = `${cleanPhone}@c.us`;
  } else if (!isBisnis && client.info && client.info.wid && client.info.wid.user) {
    // Fallback: Hanya di mode personal jika user memang tidak mengisi nomor owner terpisah
    targetJid = `${client.info.wid.user}@c.us`;
  }

  if (!targetJid) {
    console.warn(`[Onboarding] Nomor WhatsApp Pemilik (owner_phone) belum diatur. Pesan sambutan belum dapat dikirim.`);
    return { sent: false, reason: 'NO_TARGET_RECIPIENT' };
  }

  // 4. Bangun teks pesan
  const messageText = buildOnboardingMessage(activeMode, config);

  // 5. Kirim via WhatsApp
  try {
    console.log(`[Onboarding] Mengirim pesan sambutan & panduan pertama kali ke ${targetJid} (Nomor Owner Input: "${rawOwnerPhone}")...`);
    await client.sendMessage(targetJid, messageText);
    
    // 6. Set flag agar HANYA dikirim sekali selamanya
    if (db.setSetting) {
      db.setSetting('welcome_onboarding_sent', 'true');
    }
    saveConfig({ welcome_onboarding_sent: true });

    console.log(`[Onboarding] ✅ Pesan sambutan pertama kali berhasil dikirim ke nomor owner: ${targetJid}.`);
    return { sent: true, recipient: targetJid };
  } catch (err) {

    console.error(`[Onboarding] Gagal mengirim pesan sambutan:`, err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Reset status onboarding (hanya untuk keperluan testing).
 */
function resetOnboardingStatus() {
  if (db.setSetting) {
    db.setSetting('welcome_onboarding_sent', 'false');
  }
  saveConfig({ welcome_onboarding_sent: false });
}

module.exports = {
  buildOnboardingMessage,
  sendOneTimeOnboardingWelcome,
  resetOnboardingStatus
};
