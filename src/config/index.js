const fs = require('fs');
const path = require('path');
const { EDITIONS, getEditionDefinition } = require('./editions');
const { CONFIG_DIR } = require('../utils/paths');

const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const EDITION_FILE_PATH = path.join(CONFIG_DIR, 'edition.json');

const DEFAULT_CONFIG = {
  port: 3000,
  mode: null, // 'bisnis' | 'personal'
  business_name: '',
  owner_phone: '',
  gemini_api_key: '',
  grok_api_key: '',
  ai_model: 'gemini-3.7-flash', // 'gemini-3.7-flash' | 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'auto'
  response_length: 'sedang',    // 'ringkas' | 'sedang' | 'detail'
  tone_style: 'ramah',          // 'santai' | 'ramah' | 'formal'
  emoji_level: 'wajar',         // 'minimal' | 'wajar' | 'ekspresif'
  max_bubbles: 3,               // 1..4
  min_delay_sec: 5,             // Jeda membaca minimal (detik)
  max_delay_sec: 12,            // Jeda membaca maksimal (detik)
  inter_bubble_delay: 2.5,      // Jeda mengetik antar bubble (detik)
  customer_debounce_sec: 5,     // Waktu tunggu chat lanjutan pelanggan (detik)
  business_hours: '',            // Jam operasional format "HH:MM-HH:MM" (misal: "08:00-17:00")
  out_of_hours_mode: 'off',     // 'off' | 'reply_only' | 'full_ai'
  sheets_url: '',               // URL Google Sheets / CSV Publish URL
  sheets_auto_sync: false,      // Sinkronisasi otomatis di latar belakang
  sheets_sync_interval: 10,     // Interval sinkronisasi (menit)
  follow_up_enabled: false,
  follow_up_delay_hours: 24,
  follow_up_template: 'Halo Kak, kemarin sempat tanya tentang *{product_name}* ya. Varian ini masih ready lho Kak. Mau kami bantu proseskan pesanannya? 😊',
  handover_enabled: true,       // Aktifkan / Nonaktifkan fitur pengalihan chat (handover) ke admin
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
 * Mendapatkan identitas edisi aktif saat ini.
 * Prioritas:
 * 1. Environment variable: process.env.EDITION
 * 2. File config/edition.json
 * 3. Default: 'all' (Dual Edition)
 * @returns {string} 'bisnis' | 'personal' | 'all'
 */
function getEdition() {
  if (process.env.EDITION) {
    const envEd = process.env.EDITION.toLowerCase().trim();
    if (EDITIONS[envEd]) return envEd;
  }

  try {
    if (fs.existsSync(EDITION_FILE_PATH)) {
      const editionData = JSON.parse(fs.readFileSync(EDITION_FILE_PATH, 'utf-8'));
      if (editionData && editionData.edition && EDITIONS[editionData.edition.toLowerCase()]) {
        return editionData.edition.toLowerCase();
      }
    }
  } catch (_) {}

  return 'all';
}

/**
 * Mendapatkan metadata edisi aktif.
 * @returns {object}
 */
function getEditionInfo() {
  return getEditionDefinition(getEdition());
}

/**
 * Memeriksa apakah software berjalan sebagai Edisi Bisnis khusus.
 * @returns {boolean}
 */
function isBusinessEdition() {
  return getEdition() === 'bisnis';
}

/**
 * Memeriksa apakah software berjalan sebagai Edisi Personal khusus.
 * @returns {boolean}
 */
function isPersonalEdition() {
  return getEdition() === 'personal';
}

/**
 * Memeriksa apakah software berjalan sebagai Dual / All Edition.
 * @returns {boolean}
 */
function isDualEdition() {
  return getEdition() === 'all';
}

/**
 * Memeriksa apakah suatu fitur tersedia di edisi yang sedang aktif.
 * @param {string} featureKey 
 * @returns {boolean}
 */
function isFeatureAvailable(featureKey) {
  const info = getEditionInfo();
  if (info.features === '*' || (Array.isArray(info.features) && info.features.includes(featureKey))) {
    return true;
  }
  return false;
}

/**
 * Membaca konfigurasi saat ini dari file config.json.
 * Jika edisi terkunci (bisnis/personal), mode otomatis disesuaikan.
 * @returns {object}
 */
function getConfig() {
  const editionInfo = getEditionInfo();
  let config = { ...DEFAULT_CONFIG };

  try {
    ensureConfigDir();
    if (fs.existsSync(CONFIG_PATH)) {
      const rawData = fs.readFileSync(CONFIG_PATH, 'utf-8');
      config = { ...DEFAULT_CONFIG, ...JSON.parse(rawData) };
    }
  } catch (error) {
    console.error('[Config] Gagal membaca config.json:', error.message);
  }

  // Jika edisi terkunci, paksa nilai mode sesuai edisi
  if (editionInfo.isModeLocked && editionInfo.defaultMode) {
    config.mode = editionInfo.defaultMode;
  }

  return config;
}

/**
 * Menyimpan konfigurasi baru ke file config.json.
 * @param {object} newConfig 
 * @returns {boolean}
 */
function saveConfig(newConfig) {
  try {
    ensureConfigDir();
    const editionInfo = getEditionInfo();
    const current = getConfig();
    const updated = { ...current, ...newConfig };

    // Pastikan mode tetap terkunci jika pada edisi khusus
    if (editionInfo.isModeLocked && editionInfo.defaultMode) {
      updated.mode = editionInfo.defaultMode;
    }

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
  const editionInfo = getEditionInfo();
  const effectiveMode = editionInfo.isModeLocked ? editionInfo.defaultMode : config.mode;
  return Boolean(config.is_setup_completed && effectiveMode && config.gemini_api_key);
}

module.exports = {
  CONFIG_PATH,
  EDITION_FILE_PATH,
  DEFAULT_CONFIG,
  EDITIONS,
  getEdition,
  getEditionInfo,
  isBusinessEdition,
  isPersonalEdition,
  isDualEdition,
  isFeatureAvailable,
  getConfig,
  saveConfig,
  isSetupComplete
};

