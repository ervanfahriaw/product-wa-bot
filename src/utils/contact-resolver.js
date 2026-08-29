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
/**
 * Memformat tampilan nama & nomor pelanggan yang nyaman dibaca oleh Owner/Admin.
 * Menghilangkan tampilan string LID mentah (seperti 69767515898014@lid).
 * Contoh: "Arsyila Ascii (0889-2114-763)" atau "Arsyila Ascii" atau "Pelanggan WA (#8014)"
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
    return name;
  }

  // Jika kontak adalah nomor biasa 628xxx@c.us
  const cleanContact = normalizePhoneNumber(rawContact);
  if (isValidPhoneNumber(cleanContact)) {
    return formatIndonesianPhone(cleanContact);
  }

  // Jika berupa JID @lid yang belum ada nama/nomornya, format menjadi ID ramah manusia
  if (rawContact && (rawContact.includes('@lid') || /^\d{13,20}$/.test(rawContact))) {
    const rawDigits = rawContact.replace(/[^0-9]/g, '');
    const last4 = rawDigits.slice(-4);
    return `Pelanggan WA (#${last4 || 'Baru'})`;
  }

  return rawContact || 'Pelanggan';
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

  const targetJid = contactJid || (message ? message.from : '');
  const isLid = targetJid.endsWith('@lid') || (!targetJid.includes('@c.us') && !targetJid.startsWith('628') && !targetJid.startsWith('08'));

  // 1. Cek dari database customer_profiles yang sudah tersimpan sebelumnya
  try {
    if (db.getCustomerProfile && targetJid) {
      const profile = db.getCustomerProfile(targetJid);
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

  // 2. Cek dari message._data atau pushname langsung
  if (message) {
    if (!customerName) {
      const notify = (message._data?.notifyName || message._data?.pushname || message.notifyName || '').trim();
      if (notify && notify.length >= 2 && !notify.includes('@')) {
        customerName = notify;
      }
    }
  }

  // 3. Cek dari message.getContact() jika ada
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

  // 4. Cek dari isi teks pesan jika pelanggan mencantumkan No. HP atau Nama
  if (message && message.body) {
    const extracted = extractPhoneAndNameFromText(message.body);
    if (extracted.phoneNumber) phoneNumber = extracted.phoneNumber;
    if (extracted.customerName) customerName = extracted.customerName;
  }

  // 5. Jika nomor biasa (@c.us), otomatis nomor telepon adalah JID tersebut
  if (!phoneNumber && !isLid && targetJid) {
    const clean = normalizePhoneNumber(targetJid);
    if (isValidPhoneNumber(clean)) {
      phoneNumber = clean;
    }
  }

  // 6. Simpan / Perbarui pemetaan ke customer_profiles
  try {
    if (db.upsertCustomerProfile && targetJid && (phoneNumber || customerName)) {
      const updates = {};
      if (phoneNumber) updates.phone_number = phoneNumber;
      if (customerName) updates.customer_name = customerName;
      if (isLid) updates.lid_jid = targetJid;

      db.upsertCustomerProfile(targetJid, updates);

      // Jika nomor HP berbeda dari JID, simpan juga profil di nomor HP-nya agar pencarian dua arah jalan
      if (phoneNumber && phoneNumber !== targetJid) {
        db.upsertCustomerProfile(`${phoneNumber}@c.us`, {
          customer_name: customerName,
          phone_number: phoneNumber,
          lid_jid: targetJid
        });
      }
    }
  } catch (_) {}

  const formattedDisplay = formatCustomerDisplay(targetJid, { phoneNumber, customerName });

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

/**
 * Mencari kontak JID pelanggan berdasarkan nama, nomor HP, atau kata kunci pencarian.
 * @param {string} query 
 * @returns {string|null}
 */
function findContactByQuery(query = '') {
  if (!query || typeof query !== 'string') return null;
  const trimmed = query.trim();
  if (!trimmed) return null;

  const cleanNum = normalizePhoneNumber(trimmed);
  if (cleanNum && cleanNum.length >= 9) {
    const lid = findLidForPhoneNumber(cleanNum);
    return lid || `${cleanNum}@c.us`;
  }

  try {
    if (db.db && typeof db.db.prepare === 'function') {
      const row = db.db.prepare(`
        SELECT contact, lid_jid, phone_number, customer_name FROM customer_profiles
        WHERE customer_name LIKE ? OR contact LIKE ? OR lid_jid LIKE ? OR phone_number LIKE ?
        ORDER BY last_contact_at DESC LIMIT 1
      `).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`);

      if (row) {
        return row.lid_jid || row.contact || (row.phone_number ? `${row.phone_number}@c.us` : null);
      }
    }
  } catch (_) {}

  return null;
}

module.exports = {
  formatIndonesianPhone,
  extractPhoneAndNameFromText,
  formatCustomerDisplay,
  resolveCustomerInfo,
  findLidForPhoneNumber,
  findContactByQuery
};

