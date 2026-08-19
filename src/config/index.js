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
