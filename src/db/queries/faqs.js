/**
 * Query module: faqs (Auto FAQ Mode Bisnis)
 * 
 * CRUD + keyword matching untuk FAQ otomatis. Pertanyaan yang cocok 
 * dengan keyword FAQ dijawab langsung tanpa memanggil AI.
 */

const db = require('../connection');

// Pastikan tabel ada
require('../migrations/007-faqs');

/**
 * Mengambil semua FAQ, diurutkan berdasarkan match_count desc.
 * @returns {Array<object>}
 */
function getAllFaqs() {
  return db.prepare('SELECT * FROM faqs ORDER BY match_count DESC').all();
}

/**
 * Mengambil FAQ berdasarkan ID.
 * @param {number} id 
 * @returns {object|undefined}
 */
function getFaqById(id) {
  return db.prepare('SELECT * FROM faqs WHERE id = ?').get(id);
}

/**
 * Membuat FAQ baru.
 * @param {object} data
 * @returns {number} ID FAQ yang dibuat
 */
function createFaq(data) {
  const stmt = db.prepare(`
    INSERT INTO faqs (trigger_keywords, question_label, answer, is_active)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.trigger_keywords,
    data.question_label,
    data.answer,
    typeof data.is_active !== 'undefined' ? data.is_active : 1
  );
  return result.lastInsertRowid;
}

/**
 * Memperbarui FAQ yang sudah ada.
 * @param {number} id 
 * @param {object} data 
 */
function updateFaq(id, data) {
  const updates = [];
  const values = [];

  if (typeof data.trigger_keywords !== 'undefined') { updates.push('trigger_keywords = ?'); values.push(data.trigger_keywords); }
  if (typeof data.question_label !== 'undefined') { updates.push('question_label = ?'); values.push(data.question_label); }
  if (typeof data.answer !== 'undefined') { updates.push('answer = ?'); values.push(data.answer); }
  if (typeof data.is_active !== 'undefined') { updates.push('is_active = ?'); values.push(data.is_active); }

  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE faqs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
}

/**
 * Menghapus FAQ.
 * @param {number} id 
 */
function deleteFaq(id) {
  db.prepare('DELETE FROM faqs WHERE id = ?').run(id);
}

/**
 * Menaikkan counter match_count FAQ.
 * @param {number} id 
 */
function incrementFaqMatchCount(id) {
  db.prepare('UPDATE faqs SET match_count = match_count + 1 WHERE id = ?').run(id);
}

/**
 * Mencari FAQ yang cocok dengan pesan pelanggan berdasarkan keyword.
 * Hanya FAQ aktif yang dicocokkan. Minimal 1 keyword harus cocok secara tepat.
 * Menggunakan whole-word matching dan exact phrase boundary untuk mencegah false-positive.
 * 
 * @param {string} message — pesan pelanggan
 * @returns {object|null} FAQ yang cocok (prioritas: keyword dengan kecocokan terbanyak/terpanjang), atau null
 */
function matchFaq(message) {
  if (!message || !message.trim()) return null;

  const activeFaqs = db.prepare('SELECT * FROM faqs WHERE is_active = 1').all();
  if (!activeFaqs || activeFaqs.length === 0) return null;

  // Bersihkan pesan dan buat token kata
  const msgLower = message.toLowerCase().trim();
  // Hilangkan tanda baca untuk token kata
  const cleanedMsg = msgLower.replace(/[^\w\s\d]/g, ' ');
  const msgWords = cleanedMsg.split(/\s+/).filter(Boolean);

  let bestMatch = null;
  let bestScore = 0;

  for (const faq of activeFaqs) {
    const keywords = faq.trigger_keywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);

    let score = 0;
    for (const kw of keywords) {
      const cleanKw = kw.replace(/[^\w\s\d]/g, ' ').trim();
      if (!cleanKw) continue;

      const kwWords = cleanKw.split(/\s+/).filter(Boolean);
      if (kwWords.length === 0) continue;

      if (kwWords.length === 1) {
        // Kata tunggal: harus cocok sebagai KATA UTUH dalam pesan (bukan substring parsial 1-2 huruf)
        const targetWord = kwWords[0];
        // Jika targetWord sangat pendek (< 3 huruf), harus cocok persis
        const isMatched = msgWords.some(msgWord => {
          if (targetWord.length < 3) return msgWord === targetWord;
          return msgWord === targetWord || (targetWord.length >= 5 && msgWord.startsWith(targetWord));
        });
        if (isMatched) {
          score += 1;
        }
      } else {
        // Frasa multi-kata (contoh: "jam buka", "ongkos kirim"):
        // 1. Cek apakah frasa utuh muncul di pesan yang dibersihkan
        const phraseRegex = new RegExp(`\\b${cleanKw.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (phraseRegex.test(cleanedMsg)) {
          score += 2; // Beri bobot lebih tinggi untuk frasa utuh
        } else {
          // 2. Atau SEMUA kata dalam frasa harus muncul sebagai kata utuh di pesan
          const allWordsPresent = kwWords.every(kwWord => 
            msgWords.some(msgWord => msgWord === kwWord || (kwWord.length >= 5 && msgWord.startsWith(kwWord)))
          );
          if (allWordsPresent) {
            score += 1.5;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

module.exports = {
  getAllFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  incrementFaqMatchCount,
  matchFaq
};
