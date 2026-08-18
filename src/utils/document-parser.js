const fs = require('fs');
const path = require('path');

/**
 * Ekstraktor teks ringan untuk file yang diunggah pengguna.
 * Mendukung .txt, .md, .csv, .json, .pdf (ekstraksi teks raw).
 * @param {string} filePath 
 * @param {string} originalName 
 * @returns {Promise<string>}
 */
async function extractTextFromFile(filePath, originalName = '') {
  if (!fs.existsSync(filePath)) {
    throw new Error('File tidak ditemukan di sistem.');
  }

  const ext = path.extname(originalName || filePath).toLowerCase();
  
  // 1. File teks biasa (Markdown, TXT, CSV, JSON)
  if (['.txt', '.md', '.markdown', '.csv', '.json', '.log', '.env'].includes(ext)) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return cleanText(raw);
  }

  // 2. File PDF
  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const rawString = buffer.toString('binary');
    
    // Ekstrak teks dari stream PDF sederhana
    const matches = rawString.match(/\(([^()]+)\)Tj|\[([^\[\]]+)\]TJ/g);
    if (matches && matches.length > 0) {
      const extracted = matches
        .map(m => m.replace(/^[(\[]|[)\]]T[Jj]$/g, '').trim())
        .filter(Boolean)
        .join(' ');
      return cleanText(extracted);
    }

    // Fallback: ambil karakter yang dapat dibaca
    const printable = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    const readable = printable.split(/\s+/).filter(w => w.length > 3).join(' ');
    return cleanText(readable.slice(0, 10000));
  }

  // Default fallback: baca sebagai UTF-8
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return cleanText(raw);
  } catch (_) {
    return 'Gagal membaca format berkas.';
  }
}

/**
 * Membersihkan karakter kontrol aneh dan spasi berlebih.
 * @param {string} text 
 * @returns {string}
 */
function cleanText(text = '') {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = {
  extractTextFromFile,
  cleanText
};
