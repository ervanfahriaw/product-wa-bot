const path = require('path');
const fs = require('fs');
let MessageMedia;
try {
  ({ MessageMedia } = require('whatsapp-web.js'));
} catch (_) {}

const db = require('../../db');
const { getConfig } = require('../../config');
const { generateReply } = require('../../ai');

const HANDOVER_KEYWORDS = [
  'komplain', 'keluhan', 'rusak', 'pecah', 'cacat', 'retur',
  'refund', 'kembalikan dana', 'nego', 'diskon khusus', 'bisa kurang',
  'bicara dengan admin', 'bicara dengan manusia', 'bicara dengan pemilik',
  'minta nomor rekening', 'nomor rekening', 'rekening transfer'
];

/**
 * Menentukan apakah pesan membutuhkan pengalihan ke manusia (human handover).
 * @param {string} messageText 
 * @param {boolean} isAiHandover 
 * @returns {boolean}
 */
function isHandoverTriggered(messageText = '', isAiHandover = false) {
  if (isAiHandover) return true;
  const lower = (messageText || '').toLowerCase();
  return HANDOVER_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Mencari apakah ada produk relevan dengan gambar yang perlu dikirim.
 * @param {string} messageText 
 * @returns {{product: object, fullPath: string}|null}
 */
function findProductImageToSend(messageText = '') {
  const lower = messageText.toLowerCase();
  const isAskingImage = lower.includes('foto') || lower.includes('gambar') || 
                        lower.includes('lihat') || lower.includes('katalog') || 
                        lower.includes('model') || lower.includes('bentuk');

  const products = db.getAllProducts();
  if (products.length === 0) return null;

  for (const prod of products) {
    if (prod.image_path && lower.includes(prod.name.toLowerCase())) {
      const fullPath = path.isAbsolute(prod.image_path) 
        ? prod.image_path 
        : path.resolve(__dirname, '../../../', prod.image_path);
      
      if (fs.existsSync(fullPath)) {
        return { product: prod, fullPath };
      }
    }
  }

  if (isAskingImage) {
    const prodWithImg = products.find(p => p.image_path && fs.existsSync(
      path.isAbsolute(p.image_path) ? p.image_path : path.resolve(__dirname, '../../../', p.image_path)
    ));
    if (prodWithImg) {
      const fullPath = path.isAbsolute(prodWithImg.image_path)
        ? prodWithImg.image_path
        : path.resolve(__dirname, '../../../', prodWithImg.image_path);
      return { product: prodWithImg, fullPath };
    }
  }

  return null;
}

/**
 * Menangani pesan masuk dalam Mode Bisnis.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} client 
 */
async function handleBusinessMessage(message, client) {
  const contact = message.from || 'unknown';
  const messageBody = message.body || '';

  try {
    // 1. Generate balasan dari AI Router
    const aiResult = await generateReply({
      message: messageBody,
      mode: 'bisnis'
    });

    const replyText = aiResult.reply || 'Halo, ada yang bisa kami bantu seputar produk kami?';

    // 2. Kirim balasan teks ke WhatsApp
    if (typeof message.reply === 'function') {
      await message.reply(replyText);
    } else if (client && typeof client.sendMessage === 'function') {
      await client.sendMessage(contact, replyText);
    }

    // 3. Cek apakah perlu kirim gambar produk
    const imgInfo = findProductImageToSend(messageBody);
    if (imgInfo && client && MessageMedia) {
      try {
        const media = MessageMedia.fromFilePath(imgInfo.fullPath);
        await client.sendMessage(contact, media, {
          caption: `Foto produk: *${imgInfo.product.name}* (Rp${Number(imgInfo.product.price).toLocaleString('id-ID')})`
        });
      } catch (mediaErr) {
        console.error('[BusinessHandler] Gagal mengirim media gambar:', mediaErr.message);
      }
    }

    // 4. Cek & Notifikasi Human Handover
    const needsHandover = isHandoverTriggered(messageBody, aiResult.handoverRequired);
    if (needsHandover) {
      const config = getConfig();
      const ownerPhone = db.getSetting('owner_phone') || config.owner_phone;

      if (ownerPhone && client && typeof client.sendMessage === 'function') {
        const cleanPhone = ownerPhone.replace(/[^0-9]/g, '');
        const targetJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;
        const handoverNotice = `🔔 *[NOTIFIKASI HANDOVER - WA BOT]*\n\nPelanggan (*${contact}*) membutuhkan bantuan admin/pemilik:\n\n💬 *Pesan Pelanggan:* "${messageBody}"\n\nSilakan lanjutkan obrolan langsung dari ponsel Anda.`;
        
        try {
          await client.sendMessage(targetJid, handoverNotice);
          console.log(`[BusinessHandler] Notifikasi handover terkirim ke owner (${targetJid}).`);
        } catch (hErr) {
          console.error('[BusinessHandler] Gagal mengirim notifikasi handover ke owner:', hErr.message);
        }
      }
    }

    // 5. Catat ke tabel chat_logs SQLite
    db.createChatLog({
      contact,
      message_in: messageBody,
      message_out: replyText,
      handled_by: needsHandover ? 'human' : 'ai'
    });

  } catch (err) {
    console.error('[BusinessHandler] Error saat memproses pesan bisnis:', err.message);
  }
}

module.exports = {
  handleBusinessMessage,
  isHandoverTriggered,
  findProductImageToSend
};
