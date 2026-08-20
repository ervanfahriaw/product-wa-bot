/**
 * Modul Preferensi & Personalisasi Asisten Pribadi
 * Menyimpan nama pengguna, nama kustom bot, dan aturan panggilan (misal: panggil "Van", jangan panggil "Kak").
 */

const db = require('../db');

/**
 * Mengambil seluruh preferensi personal pengguna.
 * @returns {{ userName: string|null, assistantName: string|null, callUserAs: string|null, disallowKak: boolean }}
 */
function getUserPreferences() {
  try {
    const userName = db.getSetting('user_nickname') || db.getSetting('user_name') || null;
    const assistantName = db.getSetting('assistant_custom_name') || null;
    const callUserAs = db.getSetting('call_user_as') || userName || null;
    const disallowKak = db.getSetting('disallow_kak') === 'true' || Boolean(callUserAs);

    return {
      userName,
      assistantName,
      callUserAs,
      disallowKak
    };
  } catch (_) {
    return { userName: null, assistantName: null, callUserAs: null, disallowKak: false };
  }
}

/**
 * Menyimpan atau memperbarui preferensi personal.
 * @param {object} prefs 
 * @param {string} [prefs.userName] 
 * @param {string} [prefs.assistantName] 
 * @param {string} [prefs.callUserAs] 
 * @param {boolean} [prefs.disallowKak] 
 */
function saveUserPreferences({ userName, assistantName, callUserAs, disallowKak }) {
  try {
    if (typeof userName !== 'undefined' && userName) {
      db.setSetting('user_nickname', userName.trim());
    }
    if (typeof assistantName !== 'undefined' && assistantName) {
      db.setSetting('assistant_custom_name', assistantName.trim());
    }
    if (typeof callUserAs !== 'undefined' && callUserAs) {
      db.setSetting('call_user_as', callUserAs.trim());
    }
    if (typeof disallowKak !== 'undefined') {
      db.setSetting('disallow_kak', disallowKak ? 'true' : 'false');
    }
  } catch (err) {
    console.error('[UserPreferences] Gagal menyimpan preferensi:', err.message);
  }
}

/**
 * Mendeteksi preferensi nama/panggilan dari teks pesan pengguna secara otomatis (Rule-based & AI fallback).
 * @param {string} text 
 * @returns {object|null}
 */
function detectPreferenceUpdatesFromText(text = '') {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();
  const updates = {};

  // 1. Deteksi penamaan bot: "aku kasih nama kamu jarot", "nama kamu jarot ya", "panggil kamu jarot"
  const botNameMatch = text.match(/(?:aku kasih nama kamu|nama kamu sekarang|mulai sekarang nama kamu|panggil kamu)\s+([a-zA-Z0-9_\-]+)/i)
    || text.match(/nama kamu\s*:\s*([a-zA-Z0-9_\-]+)/i);
  if (botNameMatch && botNameMatch[1]) {
    const rawName = botNameMatch[1].trim();
    if (!['siapa', 'apa', 'adalah'].includes(rawName.toLowerCase())) {
      updates.assistantName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    }
  }

  // 2. Deteksi larangan "jangan panggil kak": "jangan panggil kak", "jangan pake kak", "gausah panggil kak"
  if (/jangan (?:panggil|pake|gunakan|sebut)\s+kak/i.test(lower) || /gausah (?:panggil|pake)\s+kak/i.test(lower)) {
    updates.disallowKak = true;
  }

  // 3. Deteksi panggilan khusus pengguna: bersihkan frasa larangan "jangan panggil ..." terlebih dahulu
  const sanitized = text.replace(/jangan\s+(?:panggil|sebut|pake)\s+[a-zA-Z0-9_\-]+/gi, '').trim();
  const userNameMatch = sanitized.match(/(?:panggil (?:aku|saya|gue)\s+|panggil\s+)([a-zA-Z0-9_\-]+)(?:\s+aja|\s+ya|\s+deh)?/i)
    || sanitized.match(/(?:nama (?:aku|saya|gue)\s+|namaku\s+)([a-zA-Z0-9_\-]+)/i);
  if (userNameMatch && userNameMatch[1]) {
    const rawUser = userNameMatch[1].trim();
    const cleanUser = rawUser.toLowerCase();
    if (!['kak', 'kakak', 'bro', 'om', 'pak', 'kamu', 'jarot', 'bot', 'admin', 'aja', 'ya', 'deh', 'dong'].includes(cleanUser)) {
      updates.callUserAs = rawUser.charAt(0).toUpperCase() + rawUser.slice(1);
      updates.userName = updates.callUserAs;
      updates.disallowKak = true;
    }
  }

  if (Object.keys(updates).length > 0) {
    saveUserPreferences(updates);
    return updates;
  }

  return null;
}

/**
 * Membangun konteks string preferensi untuk disuntikkan ke System Prompt AI.
 * @returns {string}
 */
function buildUserProfileContext() {
  const prefs = getUserPreferences();
  const lines = [];

  if (prefs.userName || prefs.callUserAs) {
    const name = prefs.callUserAs || prefs.userName;
    lines.push(`- Nama Pengguna: "${name}"`);
    lines.push(`- ATURAN SAPAAN PENGGUNA: Panggil pengguna dengan nama "${name}" (misal: "Siap, ${name}!", "Ada yang bisa dibantu, ${name}?").`);
    if (prefs.disallowKak) {
      lines.push(`- ⚠️ LARANGAN KERAS: JANGAN SEKALI-KALI menyapa dengan "Kak", "Kakak", atau "Bro". Pengguna telah meminta dipanggil "${name}" secara tegas.`);
    }
  } else if (prefs.disallowKak) {
    lines.push(`- ⚠️ LARANGAN KERAS: JANGAN menyapa dengan "Kak" atau "Kakak". Sapa secara akrab tanpa embel-embel "Kak".`);
  }

  if (prefs.assistantName) {
    lines.push(`- Nama Anda (Asisten Pribadi): "${prefs.assistantName}" (Pengguna telah memberikan nama ini kepada Anda. Jika memperkenalkan diri, gunakan nama "${prefs.assistantName}").`);
  }

  if (lines.length === 0) return '';

  return `[PROFIL & PREFERENSI PENGGUNA]:\n${lines.join('\n')}`;
}

module.exports = {
  getUserPreferences,
  saveUserPreferences,
  detectPreferenceUpdatesFromText,
  buildUserProfileContext
};
