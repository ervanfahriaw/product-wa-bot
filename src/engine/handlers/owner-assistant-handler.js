const { getConfig } = require('../../config');
const ai = require('../../ai');

/**
 * Menangani percakapan langsung dari Owner / Admin Toko.
 * AI merespons dengan peran Co-Pilot & Asisten Operasional Bisnis, bukan sebagai CS pembeli.
 * 
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} [client] 
 * @returns {Promise<void>}
 */
async function handleOwnerAssistantMessage(message, client) {
  const sender = message.from || '';
  const messageBody = (message.body || '').trim();

  try {
    const aiResult = await ai.generateReply({
      message: messageBody,
      mode: 'admin',
      contact: sender
    });

    const replyText = aiResult.reply || 'Siap Bos, asisten operasional toko siap membantu. Ada yang bisa saya bantu terkait laporan atau pengelolaan bot?';

    if (typeof message.reply === 'function') {
      await message.reply(replyText);
    } else if (client && typeof client.sendMessage === 'function') {
      await client.sendMessage(sender, replyText);
    }

    console.log(`[OwnerAssistant] ✅ Membalas chat Owner (${sender}): "${replyText.substring(0, 70)}..."`);
  } catch (err) {
    console.error('[OwnerAssistant] Error saat merespons percakapan Owner:', err.message);
    const fallback = 'Siap Bos! Terjadi kendala saat memuat data operasional. Anda tetap bisa menggunakan perintah cepat seperti `!status`, `!aktifkan [nomor]`, `!selesai`, atau `!help`.';
    if (typeof message.reply === 'function') {
      await message.reply(fallback);
    } else if (client && typeof client.sendMessage === 'function') {
      await client.sendMessage(sender, fallback);
    }
  }
}

module.exports = {
  handleOwnerAssistantMessage
};
