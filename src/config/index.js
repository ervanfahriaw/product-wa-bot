const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.resolve(__dirname, '../../config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  port: 3000,
  mode: null, // 'bisnis' | 'personal'
  business_name: '',
  owner_phone: '',
  gemini_api_key: '',
  grok_api_key: '',
  is_setup_completed: false
};

/**
 * Memastikan folder config/ tersedia.
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Membaca konfigurasi saat ini dari file config.json.
 * @returns {object}
 */
function getConfig() {
  try {
    ensureConfigDir();
    if (fs.existsSync(CONFIG_PATH)) {
      const rawData = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(rawData) };
    }
  } catch (error) {
    console.error('[Config] Gagal membaca config.json:', error.message);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Menyimpan konfigurasi baru ke file config.json.
 * @param {object} newConfig 
 * @returns {boolean}
 */
function saveConfig(newConfig) {
  try {
    ensureConfigDir();
    const current = getConfig();
    const updated = { ...current, ...newConfig };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[Config] Gagal menyimpan config.json:', error.message);
    return false;
  }
}

/**
 * Memeriksa apakah setup wizard sudah diselesaikan oleh user.
 * @returns {boolean}
 */
function isSetupComplete() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return false;
  }
  const config = getConfig();
  return Boolean(config.is_setup_completed && config.mode && config.gemini_api_key);
}

module.exports = {
  CONFIG_PATH,
  DEFAULT_CONFIG,
  getConfig,
  saveConfig,
  isSetupComplete
};
