const fs = require('fs');
const path = require('path');
const { BaseEngineAdapter } = require('./base-adapter');
const { getStatus, getQrCode, statusEmitter } = require('../status');

let clientModule = null;
function getClientModule() {
  if (!clientModule) {
    try {
      clientModule = require('../client');
    } catch (_) {}
  }
  return clientModule;
}

let MessageMedia = null;
try {
  ({ MessageMedia } = require('whatsapp-web.js'));
} catch (_) {}

/**
 * WWebJSEngineAdapter
 * Adapter untuk whatsapp-web.js (Chromium Headless / Puppeteer).
 * Digunakan untuk lingkungan PC / Laptop / VPS Linux.
 */
class WWebJSEngineAdapter extends BaseEngineAdapter {
  constructor() {
    super('wwebjs');
    this._clientModule = null;

    // Teruskan event dari statusEmitter ke adapter emitter
    statusEmitter.on('status_change', (payload) => {
      if (payload && payload.state === 'ready') {
        this.emitReady(payload.info || {});
      } else if (payload && payload.state === 'disconnected') {
        this.emitDisconnected(payload.errorMessage);
      }
    });

    statusEmitter.on('qr_change', (payload) => {
      if (payload && payload.qrCodeDataUrl) {
        this.emitQr(payload.rawQr, payload.qrCodeDataUrl);
      }
    });
  }

  get clientModule() {
    return this._clientModule || getClientModule();
  }

  get rawClient() {
    return this.clientModule.getClient();
  }

  set rawClient(val) {
    this._rawClient = val;
  }

  async init(options = {}) {
    this.isInitializing = true;
    try {
      const client = this.clientModule.initClient(options);
      return client;
    } finally {
      this.isInitializing = false;
    }
  }

  async destroy() {
    await this.clientModule.destroyClient();
  }

  async reconnect(options = {}) {
    return await this.clientModule.reconnectClient(options);
  }

  async resetSession() {
    return await this.clientModule.resetSession();
  }

  async sendMessage(jid, text, options = {}) {
    const client = this.rawClient;
    if (!client || typeof client.sendMessage !== 'function') {
      throw new Error('[WWebJS] WhatsApp Client belum siap atau terputus.');
    }
    return await client.sendMessage(jid, text, options);
  }

  async sendMedia(jid, mediaPathOrBuffer, options = {}) {
    const client = this.rawClient;
    if (!client || typeof client.sendMessage !== 'function') {
      throw new Error('[WWebJS] WhatsApp Client belum siap atau terputus.');
    }

    let media = null;
    if (MessageMedia) {
      if (typeof mediaPathOrBuffer === 'string') {
        if (fs.existsSync(mediaPathOrBuffer)) {
          media = MessageMedia.fromFilePath(mediaPathOrBuffer);
        } else {
          throw new Error(`[WWebJS] File media tidak ditemukan di: ${mediaPathOrBuffer}`);
        }
      } else if (Buffer.isBuffer(mediaPathOrBuffer)) {
        const mime = options.mimeType || 'image/jpeg';
        const filename = options.filename || 'media.jpg';
        media = new MessageMedia(mime, mediaPathOrBuffer.toString('base64'), filename);
      }
    }

    if (!media) {
      throw new Error('[WWebJS] MessageMedia gagal dibuat dari input yang diberikan.');
    }

    const sendOptions = {};
    if (options.caption) {
      sendOptions.caption = options.caption;
    }

    return await client.sendMessage(jid, media, sendOptions);
  }

  async sendSeen(jid) {
    const client = this.rawClient;
    if (client && typeof client.getChatById === 'function') {
      try {
        const chat = await client.getChatById(jid);
        if (chat && typeof chat.sendSeen === 'function') {
          await chat.sendSeen();
        }
      } catch (_) {}
    }
  }

  async sendTyping(jid) {
    const client = this.rawClient;
    if (client && typeof client.getChatById === 'function') {
      try {
        const chat = await client.getChatById(jid);
        if (chat && typeof chat.sendStateTyping === 'function') {
          await chat.sendStateTyping();
        }
      } catch (_) {}
    }
  }

  async clearTyping(jid) {
    const client = this.rawClient;
    if (client && typeof client.getChatById === 'function') {
      try {
        const chat = await client.getChatById(jid);
        if (chat && typeof chat.clearState === 'function') {
          await chat.clearState();
        }
      } catch (_) {}
    }
  }

  normalizeMessage(rawMsg) {
    if (!rawMsg) return null;

    // Jika sudah berupa Message dari whatsapp-web.js, pastikan interface standar
    const normalized = {
      from: rawMsg.from || '',
      to: rawMsg.to || '',
      body: rawMsg.body || '',
      type: rawMsg.type || 'text',
      timestamp: rawMsg.timestamp 
        ? (typeof rawMsg.timestamp === 'number' ? rawMsg.timestamp : Math.floor(new Date(rawMsg.timestamp).getTime() / 1000))
        : Math.floor(Date.now() / 1000),
      hasMedia: Boolean(rawMsg.hasMedia),
      _raw: rawMsg,

      reply: async (text, options = {}) => {
        if (typeof rawMsg.reply === 'function') {
          return await rawMsg.reply(text, undefined, options);
        }
        return await this.sendMessage(rawMsg.from, text, options);
      },

      getChat: async () => {
        if (typeof rawMsg.getChat === 'function') {
          return await rawMsg.getChat();
        }
        return {
          sendStateTyping: async () => await this.sendTyping(rawMsg.from),
          clearState: async () => await this.clearTyping(rawMsg.from)
        };
      },

      downloadMedia: async () => {
        if (typeof rawMsg.downloadMedia === 'function') {
          return await rawMsg.downloadMedia();
        }
        return null;
      }
    };

    return normalized;
  }
}

module.exports = {
  WWebJSEngineAdapter
};
