const { EventEmitter } = require('events');

const statusEmitter = new EventEmitter();

const ENGINE_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  QR_READY: 'qr_ready',
  AUTHENTICATED: 'authenticated',
  READY: 'ready',
  AUTH_FAILURE: 'auth_failure'
};

let currentStatus = {
  state: ENGINE_STATUS.DISCONNECTED,
  qrCodeDataUrl: null,
  rawQr: null,
  info: null,
  lastUpdated: new Date().toISOString(),
  errorMessage: null
};

/**
 * Mengambil status koneksi engine saat ini.
 * @returns {object}
 */
function getStatus() {
  return { ...currentStatus };
}

/**
 * Memperbarui status koneksi engine.
 * @param {string} state 
 * @param {object} [extra] 
 */
function setStatus(state, extra = {}) {
  currentStatus = {
    ...currentStatus,
    state,
    lastUpdated: new Date().toISOString(),
    ...extra
  };
  statusEmitter.emit('change', currentStatus);
}

/**
 * Menyimpan data QR code terkini.
 * @param {string} rawQr 
 * @param {string} qrCodeDataUrl 
 */
function setQrCode(rawQr, qrCodeDataUrl) {
  setStatus(ENGINE_STATUS.QR_READY, {
    rawQr,
    qrCodeDataUrl,
    errorMessage: null
  });
}

/**
 * Mengambil QR code terkini (data URL).
 * @returns {string|null}
 */
function getQrCode() {
  return currentStatus.qrCodeDataUrl;
}

/**
 * Reset status ke disconnected & bersihkan QR.
 * @param {string} [errorMessage] 
 */
function resetStatus(errorMessage = null) {
  currentStatus = {
    state: ENGINE_STATUS.DISCONNECTED,
    qrCodeDataUrl: null,
    rawQr: null,
    info: null,
    lastUpdated: new Date().toISOString(),
    errorMessage
  };
  statusEmitter.emit('change', currentStatus);
}

module.exports = {
  ENGINE_STATUS,
  getStatus,
  setStatus,
  setQrCode,
  getQrCode,
  resetStatus,
  statusEmitter
};
