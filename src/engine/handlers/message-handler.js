const { getConfig } = require('../../config');
const db = require('../../db');
const { handleBusinessMessage } = require('./business-handler');

/**
 * Menangani event pesan masuk dari WhatsApp dan mengarahkan ke handler mode aktif.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} [client] 
 */
async function handleIncomingMessage(message, client) {
  try {
    const sender = message.from || 'unknown';
    const body = message.body || '';
    const type = message.type || 'text';
    const timestamp = message.timestamp 
      ? new Date(message.timestamp * 1000).toISOString() 
      : new Date().toISOString();

    console.log(`[Engine:Message] Pesan masuk dari ${sender} [${type}] (${timestamp}): "${body}"`);

    // Dapatkan mode aktif dari DB atau config
    const config = getConfig();
    const activeMode = db.getSetting('mode') || config.mode;

    if (activeMode === 'bisnis') {
      await handleBusinessMessage(message, client);
    } else if (activeMode === 'personal') {
      // Delegasi ke Mode Personal (Fase 6)
      let personalHandler;
      try {
        personalHandler = require('./personal-handler').handlePersonalMessage;
      } catch (_) {}

      if (personalHandler) {
        await personalHandler(message, client);
      } else {
        if (typeof message.reply === 'function') {
          await message.reply('Mode Asisten Pribadi aktif. Fitur pencatatan sedang disiapkan.');
        }
      }
    } else {
      console.log('[Engine:Message] Bot belum dikonfigurasi mode.');
    }
  } catch (error) {
    console.error('[Engine:Message] Error saat memproses pesan masuk:', error.message);
  }
}

module.exports = {
  handleIncomingMessage
};
