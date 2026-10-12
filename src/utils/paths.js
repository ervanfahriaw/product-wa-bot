const path = require('path');
const fs = require('fs');

const isPkg = typeof process.pkg !== 'undefined';
const isAndroid = process.platform === 'android' || 
                  Boolean(process.env.ANDROID_DATA_DIR) || 
                  Boolean(process.env.ANDROID_ROOT) || 
                  Boolean(process.env.IS_MOBILE);

// Base directory untuk berkas yang bisa ditulis oleh user/aplikasi (data, config, session, uploads)
let BASE_DIR;

if (process.env.ANDROID_DATA_DIR) {
  BASE_DIR = path.resolve(process.env.ANDROID_DATA_DIR);
} else if (isPkg) {
  BASE_DIR = path.dirname(process.execPath);
} else if (process.platform === 'android') {
  BASE_DIR = process.env.HOME || '/data/data/com.wabot.assistant/files';
} else {
  BASE_DIR = path.resolve(__dirname, '../..');
}

const DATA_DIR = path.join(BASE_DIR, 'data');
const CONFIG_DIR = path.join(BASE_DIR, 'config');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SESSION_DIR = path.join(DATA_DIR, 'session');

/**
 * Memastikan semua direktori kerja utama (data, config, uploads, session) telah dibuat.
 */
function ensureDirectoriesExist() {
  const dirs = [DATA_DIR, CONFIG_DIR, UPLOADS_DIR, SESSION_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.warn(`[Paths] Gagal membuat direktori ${dir}:`, err.message);
      }
    }
  }
}

/**
 * Membantu menyelesaikan path relatif terhadap BASE_DIR yang aman untuk penulisan data.
 * @param {string} relativeSubPath 
 * @returns {string}
 */
function resolveWritablePath(relativeSubPath = '') {
  return path.join(BASE_DIR, relativeSubPath);
}

module.exports = {
  isPkg,
  isAndroid,
  BASE_DIR,
  DATA_DIR,
  CONFIG_DIR,
  UPLOADS_DIR,
  SESSION_DIR,
  ensureDirectoriesExist,
  resolveWritablePath
};
