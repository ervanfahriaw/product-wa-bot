const {
  ENGINE_STATUS,
  getStatus,
  setStatus,
  getQrCode,
  resetStatus,
  statusEmitter
} = require('./status');
const { handleIncomingMessage } = require('./handlers/message-handler');
const {
  BaseEngineAdapter,
  WWebJSEngineAdapter,
  BaileysEngineAdapter,
  createEngineAdapter,
  getActiveAdapter,
  resetAdapterInstance
} = require('./adapters');

/**
 * Memeriksa apakah mode engine yang aktif adalah Baileys (mobile / WebSocket tanpa browser).
 * @returns {boolean}
 */
function isBaileysMode() {
  try {
    const { getConfig } = require('../config');
    const cfg = getConfig();
    return (process.env.ENGINE_TYPE === 'baileys' || cfg.engine_type === 'baileys');
  } catch (_) {
    return process.env.ENGINE_TYPE === 'baileys';
  }
}

// Lazy loader untuk engine legacy WWebJS (Chromium desktop)
// Menjamin whatsapp-web.js & puppeteer TIDAK PERNAH di-require di lingkungan mobile Android
let _legacyClient = null;
function getLegacyClient() {
  if (!_legacyClient) {
    _legacyClient = require('./client');
  }
  return _legacyClient;
}

/**
 * Menginisialisasi WhatsApp Client berdasarkan adapter aktif.
 */
function initClient(options = {}, forceReinit = false) {
  if (isBaileysMode()) {
    const adapter = getActiveAdapter();
    adapter.init({ ...options, forceReinit }).catch(err => {
      console.error('[Engine] Baileys init error:', err.message);
    });
    return adapter;
  }
  return getLegacyClient().initClient(options, forceReinit);
}

/**
 * Mengambil client instance yang sedang aktif.
 */
function getClient() {
  if (isBaileysMode()) {
    const adapter = getActiveAdapter();
    return (adapter && adapter.sock) ? adapter : null;
  }
  return getLegacyClient().getClient();
}

/**
 * Menghancurkan client instance saat shutdown / restart.
 */
function destroyClient() {
  if (isBaileysMode()) {
    return getActiveAdapter().destroy();
  }
  return getLegacyClient().destroyClient();
}

/**
 * Menyambung ulang client.
 */
function reconnectClient(options = {}) {
  if (isBaileysMode()) {
    return getActiveAdapter().reconnect(options);
  }
  return getLegacyClient().reconnectClient(options);
}

/**
 * Mereset total berkas sesi.
 */
function resetSession() {
  if (isBaileysMode()) {
    return getActiveAdapter().resetSession();
  }
  return getLegacyClient().resetSession();
}

module.exports = {
  // Dispatcher Adapter Dinamis (Otomatis Baileys untuk Mobile & WWebJS untuk PC)
  initClient,
  getClient,
  destroyClient,
  reconnectClient,
  resetSession,
  startWatchdog: (...args) => isBaileysMode() ? null : getLegacyClient().startWatchdog(...args),
  stopWatchdog: (...args) => isBaileysMode() ? null : getLegacyClient().stopWatchdog(...args),
  cleanSessionLocks: (...args) => isBaileysMode() ? null : getLegacyClient().cleanSessionLocks(...args),
  ENGINE_STATUS,
  getStatus,
  setStatus,
  getQrCode,
  resetStatus,
  statusEmitter,
  handleIncomingMessage,

  // Multi-Engine Abstraction Classes
  BaseEngineAdapter,
  WWebJSEngineAdapter,
  BaileysEngineAdapter,
  createEngineAdapter,
  getActiveAdapter,
  resetAdapterInstance
};
