/**
 * Utility Normalisasi dan Validasi Nomor Telepon WhatsApp
 */

/**
 * Membersihkan dan menstandarisasi nomor telepon Indonesia ke format '628xxx' (hanya angka).
 * Contoh masukan yang didukung:
 * - '0812-3456-7890' -> '6281234567890'
 * - '+62 812 3456 7890' -> '6281234567890'
 * - '81234567890' -> '6281234567890'
 * - '6281234567890@c.us' -> '6281234567890'
 * 
 * @param {string} phone 
 * @returns {string}
 */
function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  
  // Hilangkan suffix @c.us atau @g.us jika ada
  let clean = phone.split('@')[0].replace(/[^0-9]/g, '');
  
  if (clean.startsWith('08')) {
    clean = '628' + clean.slice(2);
  } else if (clean.startsWith('8')) {
    clean = '628' + clean.slice(1);
  } else if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }

  return clean;
}

/**
 * Mengonversi nomor telepon menjadi format JID WhatsApp (nomor@c.us).
 * @param {string} phone 
 * @returns {string}
 */
function toWhatsAppJid(phone) {
  if (!phone) return '';
  if (phone.includes('@')) return phone;
  const clean = normalizePhoneNumber(phone);
  return clean ? `${clean}@c.us` : '';
}

/**
 * Memeriksa apakah nomor telepon valid (minimal 10 digit setelah normalisasi 628xxx).
 * @param {string} phone 
 * @returns {boolean}
 */
function isValidPhoneNumber(phone) {
  const clean = normalizePhoneNumber(phone);
  return clean.startsWith('62') && clean.length >= 10 && clean.length <= 16;
}

module.exports = {
  normalizePhoneNumber,
  toWhatsAppJid,
  isValidPhoneNumber
};
