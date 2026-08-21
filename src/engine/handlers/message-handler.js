const { getConfig } = require('../../config');
const db = require('../../db');
const { handleBusinessMessage } = require('./business-handler');
const { isOwnerMessage, handleOwnerCommand } = require('./owner-command-handler');
const { enqueueIncomingMessage } = require('../message-buffer');

/**
 * Menangani eksekusi pesan setelah masa tunggu (debounce) gelembung chat selesai.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} [client] 
 */
async function processAggregatedMessage(message, client) {
  try {
    // 0. Cek apakah pesan berasal dari owner/admin dan berisi perintah manajemen bot
    if (isOwnerMessage(message)) {
      const handled = await handleOwnerCommand(message, client);
      if (handled) {
        return;
      }
    }

    const config = getConfig();
    const activeMode = db.getSetting('mode') || config.mode;

    if (activeMode === 'bisnis') {
      await handleBusinessMessage(message, client);
    } else if (activeMode === 'personal') {
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
    console.error('[Engine:Message] Error saat memproses batch pesan:', error.message);
  }
}

/**
 * Menangani event pesan masuk dari WhatsApp dengan debounce buffer multi-bubble.
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

    // Masukkan ke buffer debounce per kontak
    enqueueIncomingMessage(message, client, async (batchMessage, cl) => {
      await processAggregatedMessage(batchMessage, cl);
    });
  } catch (error) {
    console.error('[Engine:Message] Error saat menampung pesan masuk:', error.message);
  }
}

module.exports = {
  handleIncomingMessage,
  processAggregatedMessage
};
