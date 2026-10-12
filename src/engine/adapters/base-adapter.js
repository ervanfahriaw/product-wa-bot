const EventEmitter = require('events');
const { ENGINE_STATUS, getStatus, getQrCode } = require('../status');

/**
 * BaseEngineAdapter
 * Kelas abstrak / kontrak antarmuka untuk semua WhatsApp Engine Adapters (WWebJS, Baileys, Mock).
 * Menyediakan standardisasi event, methods kirim pesan, media, dan normalisasi pesan.
 */
class BaseEngineAdapter extends EventEmitter {
  constructor(engineName = 'base') {
    super();
    this.engineName = engineName;
    this._rawClient = null;
    this.isInitializing = false;
  }

  get rawClient() {
    return this._rawClient;
  }

  set rawClient(val) {
    this._rawClient = val;
  }

  /**
   * Menginisialisasi koneksi engine.
   * @param {object} [options]
   * @returns {Promise<any>}
   */
  async init(options = {}) {
    throw new Error(`[${this.engineName}] Method init() harus diimplementasikan oleh subclass.`);
  }

  /**
   * Menutup dan membersihkan koneksi engine.
   * @returns {Promise<void>}
   */
  async destroy() {
    throw new Error(`[${this.engineName}] Method destroy() harus diimplementasikan oleh subclass.`);
  }

  /**
   * Melakukan penyambungan ulang (soft reconnect).
   * @param {object} [options]
   * @returns {Promise<any>}
   */
  async reconnect(options = {}) {
    throw new Error(`[${this.engineName}] Method reconnect() harus diimplementasikan oleh subclass.`);
  }

  /**
   * Mereset total sesi (menghapus folder sesi auth).
   * @returns {Promise<any>}
   */
  async resetSession() {
    throw new Error(`[${this.engineName}] Method resetSession() harus diimplementasikan oleh subclass.`);
  }

  /**
   * Mengirim pesan teks ke JID tertentu.
   * @param {string} jid 
   * @param {string} text 
   * @param {object} [options]
   * @returns {Promise<any>}
   */
  async sendMessage(jid, text, options = {}) {
    throw new Error(`[${this.engineName}] Method sendMessage() harus diimplementasikan oleh subclass.`);
  }

  /**
   * Mengirim media (gambar/dokumen) ke JID tertentu.
   * @param {string} jid 
   * @param {string|Buffer} mediaPathOrBuffer 
   * @param {object} [options]
   * @param {string} [options.caption]
   * @param {string} [options.mimeType]
   * @param {string} [options.filename]
   * @returns {Promise<any>}
   */
  async sendMedia(jid, mediaPathOrBuffer, options = {}) {
    throw new Error(`[${this.engineName}] Method sendMedia() harus diimplementasikan oleh subclass.`);
  }

  /**
   * Menandai pesan sebagai dibaca (Centang Biru / seen).
   * @param {string} jid 
   * @returns {Promise<void>}
   */
  async sendSeen(jid) {
    // Default no-op jika engine tidak mendukung atau belum siap
  }

  /**
   * Mengirim status sedang mengetik (typing).
   * @param {string} jid 
   * @returns {Promise<void>}
   */
  async sendTyping(jid) {
    // Default no-op jika engine tidak mendukung
  }

  /**
   * Menghentikan status sedang mengetik.
   * @param {string} jid 
   * @returns {Promise<void>}
   */
  async clearTyping(jid) {
    // Default no-op
  }

  /**
   * Mengembalikan status koneksi engine terkini.
   * @returns {object}
   */
  getStatus() {
    return getStatus();
  }

  /**
   * Mengembalikan data QR code (raw & dataUrl).
   * @returns {object}
   */
  getQrCode() {
    return getQrCode();
  }

  /**
   * Mengembalikan instance client mentah (WWebJS Client atau Baileys Socket).
   * @returns {any}
   */
  getRawClient() {
    return this.rawClient;
  }

  /**
   * Melakukan normalisasi payload pesan dari engine spesifik
   * ke bentuk standar yang dipahami oleh seluruh message handler.
   * @param {any} rawMessage 
   * @returns {object} NormalizedMessage
   */
  normalizeMessage(rawMessage) {
    throw new Error(`[${this.engineName}] Method normalizeMessage() harus diimplementasikan.`);
  }

  // --- Helper methods untuk emisi event terstandarisasi ---

  emitQr(rawQr, qrDataUrl) {
    this.emit('qr', { rawQr, qrDataUrl });
  }

  emitAuthenticated() {
    this.emit('authenticated');
  }

  emitReady(info = {}) {
    this.emit('ready', info);
  }

  emitDisconnected(reason) {
    this.emit('disconnected', reason);
  }

  emitMessage(normalizedMessage) {
    this.emit('message', normalizedMessage);
  }
}

module.exports = {
  BaseEngineAdapter,
  ENGINE_STATUS
};
