const fs = require('fs');
const path = require('path');
const https = require('https');
const dns = require('dns');
const qrcode = require('qrcode');
const pino = require('pino');

const { BaseEngineAdapter, ENGINE_STATUS } = require('./base-adapter');
const { setStatus, setQrCode, resetStatus } = require('../status');
const { SESSION_DIR } = require('../../utils/paths');

// Polyfills untuk kompatibilitas WebAssembly & Crypto di Node 18 / Android
const nodeCrypto = require('crypto');
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = nodeCrypto.webcrypto || nodeCrypto;
}
if (!globalThis.crypto.subtle && nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) {
  globalThis.crypto.subtle = nodeCrypto.webcrypto.subtle;
}
process.env.WHATSAPP_RUST_BRIDGE_FORCE_NOSIMD = 'true';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Custom HTTPS Agent untuk Android: Mengatasi ketiadaan root CA dan kendala DNS emulator
function createAndroidHttpsAgent() {
  return new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    keepAliveMsecs: 15000,
    lookup: (hostname, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      dns.resolve4(hostname, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
          return callback(null, addresses[0], 4);
        }
        dns.lookup(hostname, options, callback);
      });
    }
  });
}

let baileys = null;
let baileysLoadingPromise = null;

/**
 * Memuat dependensi Baileys secara dinamis via native file:// URL ESM import (dukungan penuh Node 18+).
 * @returns {Promise<any>}
 */
async function loadBaileys() {
  if (baileys) return baileys;
  if (!baileysLoadingPromise) {
    baileysLoadingPromise = (async () => {
      const { pathToFileURL } = require('url');
      const candidates = [];

      // 1. Coba require.resolve untuk mendapatkan path absolut file fisik index.js
      try {
        const resolved = require.resolve('@whiskeysockets/baileys');
        if (resolved && fs.existsSync(resolved)) {
          candidates.push(resolved);
        }
      } catch (_) {}

      // 2. Coba path relatif dari __dirname (src/engine/adapters/../../.. -> nodejs-project)
      const relCandidate = path.resolve(__dirname, '../../../node_modules/@whiskeysockets/baileys/lib/index.js');
      if (fs.existsSync(relCandidate) && !candidates.includes(relCandidate)) {
        candidates.push(relCandidate);
      }

      // 3. Coba path berbasis ANDROID_DATA_DIR
      if (process.env.ANDROID_DATA_DIR) {
        const androidCandidate = path.join(process.env.ANDROID_DATA_DIR, 'nodejs-project', 'node_modules', '@whiskeysockets/baileys', 'lib', 'index.js');
        if (fs.existsSync(androidCandidate) && !candidates.includes(androidCandidate)) {
          candidates.push(androidCandidate);
        }
      }

      // 4. Coba juga path berbasis process.cwd()
      const cwdCandidate = path.resolve(process.cwd(), 'node_modules/@whiskeysockets/baileys/lib/index.js');
      if (fs.existsSync(cwdCandidate) && !candidates.includes(cwdCandidate)) {
        candidates.push(cwdCandidate);
      }

      console.log('[BaileysAdapter] Memeriksa kandidat berkas Baileys ESM:', candidates);

      let lastError = null;

      // Iterasi kandidat dan muat via native V8 dynamic import menggunakan file:// URL
      for (const candPath of candidates) {
        try {
          const fileUrl = pathToFileURL(candPath).href;
          const mod = await import(fileUrl);
          baileys = mod;
          console.log('[BaileysAdapter] ✅ Modul @whiskeysockets/baileys berhasil dimuat via file URL:', fileUrl);
          return baileys;
        } catch (err) {
          lastError = err;
          console.warn('[BaileysAdapter] Gagal memuat file URL', candPath, ':', err.message);
        }
      }

      // Coba bare specifier dynamic import jika semua file URL belum berhasil
      try {
        const mod = await import('@whiskeysockets/baileys');
        baileys = mod;
        console.log('[BaileysAdapter] ✅ Modul @whiskeysockets/baileys berhasil dimuat via bare import.');
        return baileys;
      } catch (bareErr) {
        lastError = bareErr;
        console.error('[BaileysAdapter] Gagal memuat @whiskeysockets/baileys via bare import:', bareErr.message);
      }

      throw new Error(`Gagal memuat modul Baileys ESM: ${lastError ? lastError.message : 'Berkas tidak ditemukan'}`);
    })();
  }
  return await baileysLoadingPromise;
}

// Background preload sedini mungkin
loadBaileys().catch(err => {
  console.warn('[BaileysAdapter] Preload Baileys info:', err.message);
});

/**
 * Ekstraksi isi teks dari berbagai jenis payload pesan Baileys.
 * @param {object} m 
 * @returns {string}
 */
function extractMessageBody(m) {
  if (!m || !m.message) return '';
  const msg = m.message;
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    ''
  );
}

/**
 * Menentukan tipe pesan dari objek Baileys.
 * @param {object} m 
 * @returns {'text'|'image'|'document'|'video'|'audio'|'sticker'}
 */
function extractMessageType(m) {
  if (!m || !m.message) return 'text';
  const keys = Object.keys(m.message);
  if (keys.includes('imageMessage')) return 'image';
  if (keys.includes('documentMessage')) return 'document';
  if (keys.includes('videoMessage')) return 'video';
  if (keys.includes('audioMessage')) return 'audio';
  if (keys.includes('stickerMessage')) return 'sticker';
  return 'text';
}

/**
 * Menstandarisasi JID agar kompatibel dengan Baileys (@s.whatsapp.net).
 * @param {string} jid 
 * @returns {string}
 */
function toBaileysJid(jid = '') {
  if (!jid) return '';
  if (jid.endsWith('@c.us')) {
    return jid.replace('@c.us', '@s.whatsapp.net');
  }
  if (!jid.includes('@')) {
    const clean = jid.replace(/[^0-9]/g, '');
    return `${clean}@s.whatsapp.net`;
  }
  return jid;
}

/**
 * Menstandarisasi JID Baileys ke format internal bot (@c.us).
 * @param {string} jid 
 * @returns {string}
 */
function toInternalJid(jid = '') {
  if (!jid) return '';
  if (jid.endsWith('@s.whatsapp.net')) {
    return jid.replace('@s.whatsapp.net', '@c.us');
  }
  return jid;
}

/**
 * BaileysEngineAdapter
 * WhatsApp Engine berbasis WebSocket binary murni (tanpa Chromium / Puppeteer).
 * Dirancang khusus untuk perangkat hemat daya (Android Mobile APK / Low-RAM VPS).
 */
class BaileysEngineAdapter extends BaseEngineAdapter {
  constructor() {
    super('baileys');
    this.sock = null;
    this.authPath = path.join(SESSION_DIR, 'baileys-auth');
    this.logger = pino({
      level: 'info',
      timestamp: () => `,"time":"${new Date().toISOString()}"`
    });
    this.isDestroyed = false;
    this.reconnectTimer = null;
    this.saveCreds = null;
    this.myJid = null;
    this.toBaileysJid = toBaileysJid;
    this.toInternalJid = toInternalJid;
  }

  get rawClient() {
    return this.sock;
  }

  set rawClient(val) {
    this.sock = val;
  }

  /**
   * Menginisialisasi koneksi WebSocket Baileys.
   * @param {object} [options]
   * @returns {Promise<any>}
   */
  async init(options = {}) {
    if (this.sock && !options.forceReinit) {
      return this.sock;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isDestroyed = false;
    this.isInitializing = true;

    if (!fs.existsSync(this.authPath)) {
      fs.mkdirSync(this.authPath, { recursive: true });
    }

    setStatus(ENGINE_STATUS.CONNECTING, {
      qrCodeDataUrl: null,
      rawQr: null,
      errorMessage: null
    });

    try {
      const b = await loadBaileys();
      const makeWASocket = b.default || b.makeWASocket || b;
      const { useMultiFileAuthState, DisconnectReason, Browsers } = b;

      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
      this.saveCreds = saveCreds;

      const httpsAgent = createAndroidHttpsAgent();

      const currentSock = makeWASocket({
        auth: state,
        logger: this.logger,
        agent: httpsAgent,
        options: {
          agent: httpsAgent,
          rejectUnauthorized: false
        },
        printQRInTerminal: false,
        syncFullHistory: false,
        browser: (Browsers ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '22.04.4']),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        ...options
      });
      this.sock = currentSock;

      // 1. Simpan perubahan kredensial sesi
      currentSock.ev.on('creds.update', async () => {
        if (this.sock !== currentSock || this.isDestroyed) return;
        if (typeof this.saveCreds === 'function') {
          await this.saveCreds();
        }
      });

      // 2. Pantau update status koneksi & QR code
      currentSock.ev.on('connection.update', async (update) => {
        if (this.sock !== currentSock || this.isDestroyed) return;
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 6 });
            setQrCode(qr, qrDataUrl);
            this.emitQr(qr, qrDataUrl);
            console.log('[Baileys] ✅ QR Code WhatsApp berhasil dibuat dan siap dipindai.');
          } catch (qrErr) {
            console.error('[Baileys] Gagal mengonversi QR code ke data URL:', qrErr.message);
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason?.loggedOut;
          const errorMsg = lastDisconnect?.error?.message || (statusCode ? `Status code ${statusCode}` : 'Koneksi terputus');
          console.warn(`[Baileys] Koneksi WhatsApp terputus (status code: ${statusCode}, alasan: ${errorMsg}). Reconnect: ${!isLoggedOut}`);

          if (isLoggedOut) {
            resetStatus('Sesi telah keluar. Silakan scan ulang.');
            this.emitDisconnected('Sesi telah keluar');
          } else {
            setStatus(ENGINE_STATUS.CONNECTING, {
              errorMessage: `Menyambungkan ulang (${errorMsg})...`
            });
            this.emitDisconnected(errorMsg);

            if (!this.isDestroyed) {
              console.log('[Baileys] 🔄 Menjadwalkan reconnect otomatis...');
              if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
              this.reconnectTimer = setTimeout(() => {
                if (this.sock === currentSock && !this.isDestroyed) {
                  this.reconnect().catch(err => {
                    console.error('[Baileys] Gagal auto-reconnect:', err.message);
                    setStatus(ENGINE_STATUS.DISCONNECTED, {
                      errorMessage: `Gagal menyambung: ${err.message}`
                    });
                  });
                }
              }, 2500);
            }
          }
        } else if (connection === 'open') {
          this.isInitializing = false;
          const user = currentSock.user || {};
          const pushname = user.name || user.notify || 'User';
          const phone = (user.id || '').split(':')[0].replace(/[^0-9]/g, '');
          this.myJid = user.id ? toInternalJid(user.id.split(':')[0] + '@s.whatsapp.net') : null;

          const info = {
            pushname,
            phone,
            platform: 'baileys-mobile'
          };

          setStatus(ENGINE_STATUS.READY, {
            qrCodeDataUrl: null,
            rawQr: null,
            info
          });

          this.emitReady(info);
          console.log(`[Baileys] WhatsApp Bot SIAP (Ready) - Tersambung sebagai: ${pushname} (${phone})`);

          // Jalankan scheduler reminder otomatis
          try {
            const { startReminderScheduler } = require('../reminder-scheduler');
            startReminderScheduler(this);
          } catch (_) {}
        }
      });

      // 3. Tangani pesan masuk
      this.sock.ev.on('messages.upsert', async (m) => {
        if (!m || !m.messages || !Array.isArray(m.messages)) return;

        const { handleIncomingMessage } = require('../handlers/message-handler');

        for (const rawMsg of m.messages) {
          const remoteJid = rawMsg.key?.remoteJid || '';
          // Abaikan status update / broadcast status
          if (remoteJid === 'status@broadcast') continue;

          const normalized = this.normalizeMessage(rawMsg);
          if (normalized) {
            this.emitMessage(normalized);
            // Salurkan ke pipeline message-handler terpadu
            await handleIncomingMessage(normalized, this).catch(err => {
              console.error('[Baileys] Error saat memproses pesan masuk:', err.message);
            });
          }
        }
      });

      return this.sock;
    } catch (err) {
      this.isInitializing = false;
      console.error('[Baileys] Inisialisasi socket gagal:', err.message, err.stack);
      resetStatus(`Gagal inisialisasi: ${err.message}`);
      throw err;
    }
  }

  /**
   * Menghentikan koneksi socket Baileys.
   */
  async destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      const oldSock = this.sock;
      this.sock = null;
      try {
        if (oldSock.ev && typeof oldSock.ev.removeAllListeners === 'function') {
          oldSock.ev.removeAllListeners('connection.update');
          oldSock.ev.removeAllListeners('creds.update');
          oldSock.ev.removeAllListeners('messages.upsert');
        }
      } catch (_) {}
      try {
        if (typeof oldSock.end === 'function') {
          oldSock.end(new Error('Engine destroyed'));
        }
      } catch (_) {}
    }
    resetStatus();
  }

  /**
   * Menyambung ulang tanpa menghapus berkas autentikasi.
   * @param {object} [options]
   */
  async reconnect(options = {}) {
    await this.destroy();
    this.isDestroyed = false;
    return await this.init({ ...options, forceReinit: true });
  }

  /**
   * Menghapus total berkas autentikasi sesi Baileys dan inisialisasi ulang.
   */
  async resetSession() {
    await this.destroy();
    if (fs.existsSync(this.authPath)) {
      try {
        fs.rmSync(this.authPath, { recursive: true, force: true });
      } catch (err) {
        console.warn('[Baileys] Gagal menghapus authPath:', err.message);
      }
    }
    this.isDestroyed = false;
    return await this.init({ forceReinit: true });
  }

  /**
   * Mengirim pesan teks ke JID tertentu.
   * Mendukung format target @c.us maupun @s.whatsapp.net.
   * @param {string} jid 
   * @param {string|object} content 
   * @param {object} [options]
   * @returns {Promise<any>}
   */
  async sendMessage(jid, content, options = {}) {
    if (!this.sock) {
      throw new Error('[Baileys] Socket belum terhubung.');
    }

    const targetJid = toBaileysJid(jid);

    // Jika content adalah objek MessageMedia (WWebJS style)
    if (content && typeof content === 'object' && content.data) {
      const buffer = Buffer.from(content.data, 'base64');
      const caption = options.caption || content.caption || '';
      return await this.sock.sendMessage(targetJid, {
        image: buffer,
        caption
      });
    }

    // Jika content adalah objek Baileys murni (misal { text: '...' } atau { image: ... })
    if (content && typeof content === 'object' && (content.text || content.image || content.video)) {
      return await this.sock.sendMessage(targetJid, content);
    }

    // Pengiriman teks standar
    const text = typeof content === 'string' ? content : String(content);
    return await this.sock.sendMessage(targetJid, { text });
  }

  /**
   * Mengirim media (gambar/dokumen) ke JID tertentu.
   * @param {string} jid 
   * @param {string|Buffer} mediaPathOrBuffer 
   * @param {object} [options]
   * @returns {Promise<any>}
   */
  async sendMedia(jid, mediaPathOrBuffer, options = {}) {
    if (!this.sock) {
      throw new Error('[Baileys] Socket belum terhubung.');
    }

    const targetJid = toBaileysJid(jid);
    let buffer = null;

    if (typeof mediaPathOrBuffer === 'string') {
      if (!fs.existsSync(mediaPathOrBuffer)) {
        throw new Error(`[Baileys] Berkas media tidak ditemukan di: ${mediaPathOrBuffer}`);
      }
      buffer = fs.readFileSync(mediaPathOrBuffer);
    } else if (Buffer.isBuffer(mediaPathOrBuffer)) {
      buffer = mediaPathOrBuffer;
    } else {
      throw new Error('[Baileys] Format mediaPathOrBuffer tidak valid.');
    }

    const caption = options.caption || '';
    const mime = options.mimeType || 'image/jpeg';

    if (mime.startsWith('image/')) {
      return await this.sock.sendMessage(targetJid, {
        image: buffer,
        caption
      });
    } else if (mime.startsWith('video/')) {
      return await this.sock.sendMessage(targetJid, {
        video: buffer,
        caption
      });
    } else {
      return await this.sock.sendMessage(targetJid, {
        document: buffer,
        mimetype: mime,
        fileName: options.filename || 'dokumen',
        caption
      });
    }
  }

  /**
   * Mengirim centang biru (read receipt).
   * @param {string} jid 
   * @param {object} [messageKey] 
   */
  async sendSeen(jid, messageKey = null) {
    if (!this.sock) return;
    try {
      if (messageKey) {
        await this.sock.readMessages([messageKey]);
      }
    } catch (_) {}
  }

  /**
   * Mengirim status sedang mengetik (composing).
   * @param {string} jid 
   */
  async sendTyping(jid) {
    if (!this.sock) return;
    try {
      const targetJid = toBaileysJid(jid);
      await this.sock.sendPresenceUpdate('composing', targetJid);
    } catch (_) {}
  }

  /**
   * Menghentikan status sedang mengetik (paused).
   * @param {string} jid 
   */
  async clearTyping(jid) {
    if (!this.sock) return;
    try {
      const targetJid = toBaileysJid(jid);
      await this.sock.sendPresenceUpdate('paused', targetJid);
    } catch (_) {}
  }

  /**
   * Melakukan normalisasi WAMessage ke format terpadu.
   * @param {object} rawMsg 
   * @returns {object|null} NormalizedMessage
   */
  normalizeMessage(rawMsg) {
    if (!rawMsg || !rawMsg.key) return null;

    const rawJid = rawMsg.key.remoteJid || '';
    const internalFrom = toInternalJid(rawJid);
    const body = extractMessageBody(rawMsg);
    const type = extractMessageType(rawMsg);
    const timestamp = typeof rawMsg.messageTimestamp === 'number'
      ? rawMsg.messageTimestamp
      : Math.floor(Date.now() / 1000);

    const normalized = {
      from: internalFrom,
      to: rawMsg.key.fromMe ? internalFrom : (this.myJid || ''),
      body,
      type,
      timestamp,
      hasMedia: type !== 'text',
      _senderName: rawMsg.pushName || '',
      _raw: rawMsg,

      reply: async (text, options = {}) => {
        return await this.sendMessage(rawJid, text, options);
      },

      getChat: async () => {
        return {
          sendSeen: async () => await this.sendSeen(rawJid, rawMsg.key),
          sendStateTyping: async () => await this.sendTyping(rawJid),
          clearState: async () => await this.clearTyping(rawJid)
        };
      },

      downloadMedia: async () => {
        const b = await loadBaileys().catch(() => null);
        if (!b || type === 'text') return null;
        try {
          const downloadMediaMessage = b.downloadMediaMessage;
          const buffer = await downloadMediaMessage(
            rawMsg,
            'buffer',
            {},
            { logger: this.logger, reuploadRequest: this.sock.updateMediaMessage }
          );
          const mime = rawMsg.message?.imageMessage?.mimetype || 'image/jpeg';
          return {
            mimetype: mime,
            data: buffer.toString('base64'),
            filename: 'media.jpg'
          };
        } catch (err) {
          console.error('[Baileys] Gagal mendownload media:', err.message);
          return null;
        }
      }
    };

    return normalized;
  }
}

module.exports = {
  BaileysEngineAdapter,
  extractMessageBody,
  extractMessageType,
  toBaileysJid,
  toInternalJid
};
