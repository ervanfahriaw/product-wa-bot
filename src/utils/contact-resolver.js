const db = require('../db');
const { normalizePhoneNumber, isValidPhoneNumber } = require('./phone');

/**
 * Memformat nomor telepon Indonesia menjadi format cantik (0821-1697-3032).
 * @param {string} phone 
 * @returns {string}
 */
function formatIndonesianPhone(phone) {
  if (!phone) return '';
  let clean = normalizePhoneNumber(phone);
  if (clean.startsWith('62')) {
    clean = '0' + clean.slice(2);
  }
  if (clean.length === 11) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 7)}-${clean.slice(7)}`;
  } else if (clean.length === 12) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`;
  } else if (clean.length === 13) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return clean;
}

/**
 * Mengekstrak nomor HP dan Nama Penerima dari teks pesan (format pemesanan WhatsApp).
 * @param {string} text 
 * @returns {{phoneNumber: string|null, customerName: string|null}}
 */
function extractPhoneAndNameFromText(text = '') {
  if (!text || typeof text !== 'string') {
    return { phoneNumber: null, customerName: null };
  }

  let phoneNumber = null;
  let customerName = null;

  // 1. Ekstrak No. HP
  const phoneRegex = /(?:no\.?\s*(?:hp|wa|telepon|telp|whatsapp)?\s*[:=]\s*|\b)((?:\+?62|08)\s*[-.\s]?\d{2,4}\s*[-.\s]?\d{3,5}\s*[-.\s]?\d{3,5})\b/i;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    const rawPhone = phoneMatch[1].replace(/[-.\s]/g, '');
    const clean = normalizePhoneNumber(rawPhone);
    if (isValidPhoneNumber(clean)) {
      phoneNumber = clean;
    }
  }

  // 2. Ekstrak Nama Penerima / Nama
  const nameRegex = /(?:nama\s*(?:penerima|lengkap|pemesan)?\s*[:=]\s*)([a-zA-Z\s'.]{2,30})/i;
  const nameMatch = text.match(nameRegex);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name && !name.toLowerCase().includes('penerima') && name.length >= 2) {
      // Ambil nama baris pertama jika ada newline
      customerName = name.split('\n')[0].trim();
    }
  }

  return { phoneNumber, customerName };
}

/**
 * Memformat tampilan nama & nomor pelanggan yang nyaman dibaca oleh Owner.
 * Contoh: "Key (0821-1697-3032)" atau "0821-1697-3032" atau "151917456011364@lid"
 * @param {string} rawContact 
 * @param {object} [resolved]
 * @param {string|null} [resolved.phoneNumber]
 * @param {string|null} [resolved.customerName]
 * @returns {string}
 */
function formatCustomerDisplay(rawContact, resolved = {}) {
  const phone = resolved.phoneNumber || null;
  const name = resolved.customerName || null;

  const prettyPhone = phone ? formatIndonesianPhone(phone) : null;

  if (name && prettyPhone) {
    return `${name} (${prettyPhone})`;
  }
  if (prettyPhone) {
    return prettyPhone;
  }
  if (name) {
    return `${name} (${rawContact})`;
  }

  // Jika kontak adalah nomor biasa 628xxx@c.us
  const cleanContact = normalizePhoneNumber(rawContact);
  if (isValidPhoneNumber(cleanContact)) {
    return formatIndonesianPhone(cleanContact);
  }

  return rawContact;
}

/**
 * Menyelesaikan identitas asli pelanggan (Nomor HP & Nama) dari pesan WhatsApp,
 * objek kontak, dan database SQLite.
 * @param {import('whatsapp-web.js').Message} [message] 
 * @param {string} contactJid 
 * @returns {Promise<{phoneNumber: string|null, customerName: string|null, formattedDisplay: string}>}
 */
async function resolveCustomerInfo(message = null, contactJid = '') {
  let phoneNumber = null;
  let customerName = null;

  const isLid = contactJid.endsWith('@lid') || (!contactJid.includes('@c.us') && !contactJid.startsWith('628') && !contactJid.startsWith('08'));

  // 1. Cek dari database customer_profiles yang sudah tersimpan sebelumnya
  try {
    if (db.getCustomerProfile) {
      const profile = db.getCustomerProfile(contactJid);
      if (profile) {
        if (profile.phone_number && isValidPhoneNumber(profile.phone_number)) {
          phoneNumber = normalizePhoneNumber(profile.phone_number);
        }
        if (profile.customer_name) {
          customerName = profile.customer_name;
        }
      }
    }
  } catch (_) {}

  // 2. Cek dari message.getContact() jika ada
  if (message && typeof message.getContact === 'function') {
    try {
      const contactObj = await message.getContact().catch(() => null);
      if (contactObj) {
        if (!phoneNumber && contactObj.number && isValidPhoneNumber(contactObj.number)) {
          phoneNumber = normalizePhoneNumber(contactObj.number);
        }
        if (!customerName) {
          const push = (contactObj.pushname || contactObj.name || '').trim();
          if (push && push.length >= 2 && !push.includes('@')) {
            customerName = push;
          }
        }
      }
    } catch (_) {}
  }

  // 3. Cek dari isi teks pesan jika pelanggan mencantumkan No. HP atau Nama
  if (message && message.body) {
    const extracted = extractPhoneAndNameFromText(message.body);
    if (extracted.phoneNumber) phoneNumber = extracted.phoneNumber;
    if (extracted.customerName) customerName = extracted.customerName;
  }

  // 4. Jika nomor biasa (@c.us), otomatis nomor telepon adalah JID tersebut
  if (!phoneNumber && !isLid) {
    const clean = normalizePhoneNumber(contactJid);
    if (isValidPhoneNumber(clean)) {
      phoneNumber = clean;
    }
  }

  // 5. Simpan / Perbarui pemetaan ke customer_profiles
  try {
    if (db.upsertCustomerProfile && (phoneNumber || customerName)) {
      const updates = {};
      if (phoneNumber) updates.phone_number = phoneNumber;
      if (customerName) updates.customer_name = customerName;
      if (isLid) updates.lid_jid = contactJid;

      db.upsertCustomerProfile(contactJid, updates);

      // Jika nomor HP berbeda dari JID, simpan juga profil di nomor HP-nya agar pencarian dua arah jalan
      if (phoneNumber && phoneNumber !== contactJid) {
        db.upsertCustomerProfile(`${phoneNumber}@c.us`, {
          customer_name: customerName,
          phone_number: phoneNumber,
          lid_jid: contactJid
        });
      }
    }
  } catch (_) {}

  const formattedDisplay = formatCustomerDisplay(contactJid, { phoneNumber, customerName });

  return {
    phoneNumber,
    customerName,
    formattedDisplay
  };
}

/**
 * Mencari JID @lid yang terhubung dengan nomor telepon tertentu.
 * @param {string} phone 
 * @returns {string|null}
 */
function findLidForPhoneNumber(phone) {
  if (!phone) return null;
  const clean = normalizePhoneNumber(phone);
  try {
    const row = db.db.prepare(`
      SELECT contact, lid_jid FROM customer_profiles 
      WHERE (phone_number = ? OR contact = ? OR contact LIKE ?) 
        AND (contact LIKE '%@lid' OR (lid_jid IS NOT NULL AND lid_jid != ''))
      LIMIT 1
    `).get(clean, `${clean}@c.us`, `%${clean}%`);

    if (row) {
      return row.lid_jid || (row.contact.endsWith('@lid') ? row.contact : null);
    }
  } catch (_) {}
  return null;
}

module.exports = {
  formatIndonesianPhone,
  extractPhoneAndNameFromText,
  formatCustomerDisplay,
  resolveCustomerInfo,
  findLidForPhoneNumber
};
