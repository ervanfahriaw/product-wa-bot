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
  'nego', 'tawar', 'diskon', 'potongan', 'grosir', 'bisa kurang', 'bisa tawar', 'harga pas', 'kurangin', 'turunin harga',
  'komplain', 'keluhan', 'rusak', 'pecah', 'cacat', 'retur', 'refund', 'kembalikan dana', 'basi', 'apek', 'diare', 'mules',
  'bicara dengan admin', 'bicara dengan manusia', 'bicara dengan pemilik', 'bicara sama owner', 'ngomong sama owner',
  'admin asli', 'orang asli', 'hubungkan ke admin', 'hubungkan ke owner', 'owner toko',
  'minta nomor rekening', 'nomor rekening', 'rekening transfer', 'rekening pribadi'
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
 * Mensimulasikan jeda alami manusia (Anti-Ban) dan status 'sedang mengetik' di WhatsApp.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {number} [minMs] 
 * @param {number} [maxMs] 
 */
async function simulateHumanTyping(message, minMs = null, maxMs = null) {
  if (process.env.NODE_ENV === 'test' || process.env.NO_DELAY) {
    return;
  }

  try {
    const config = getConfig();
    const resolvedMin = minMs || (Number(config.min_delay_sec) || 5) * 1000;
    const resolvedMax = maxMs || (Number(config.max_delay_sec) || 12) * 1000;

    const chat = typeof message.getChat === 'function' ? await message.getChat().catch(() => null) : null;
    if (chat && typeof chat.sendStateTyping === 'function') {
      await chat.sendStateTyping().catch(() => {});
    }

    // Variasi acak antara resolvedMin dan resolvedMax + jitter
    const minTime = Math.min(resolvedMin, resolvedMax);
    const maxTime = Math.max(resolvedMin, resolvedMax);
    const randomDelay = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;

    console.log(`[Anti-Ban] Mensimulasikan jeda mengetik selama ${(randomDelay / 1000).toFixed(1)} detik...`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    if (chat && typeof chat.clearState === 'function') {
      await chat.clearState().catch(() => {});
    }
  } catch (_) {}
}

const { splitIntoBubbles, sendMultiBubbleMessages } = require('../bubble-sender');

/**
 * Menangani pesan masuk dalam Mode Bisnis.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} client 
 */
async function handleBusinessMessage(message, client) {
  const contact = message.from || 'unknown';
  const messageBody = message.body || '';

  try {
    // 0. Cek apakah kontak sedang dalam status Dijeda (Paused / Handover Owner)
    if (db.isContactPaused(contact)) {
      console.log(`[BusinessHandler] Kontak ${contact} sedang dalam status DIJEDA (Paused/Handover). Mengabaikan balasan otomatis.`);
      return;
    }

    const config = getConfig();

    // 1. Simulasikan jeda manusiawi & status typing untuk anti-banned
    await simulateHumanTyping(message);

    // 2. Generate balasan dari AI Router (dengan konteks riwayat chat pelanggan)
    const aiResult = await generateReply({
      message: messageBody,
      mode: 'bisnis',
      contact
    });

    const replyText = aiResult.reply || 'Halo, ada yang bisa kami bantu seputar produk kami?';

    // 3. Pecah pesan panjang menjadi gelembung chat alami & kirim bertahap
    const maxBubbles = Number(config.max_bubbles) || 3;
    const bubbles = splitIntoBubbles(replyText, maxBubbles);
    await sendMultiBubbleMessages(message, client, contact, bubbles, {
      interBubbleDelay: config.inter_bubble_delay
    });

    // 4. Cek apakah perlu kirim gambar produk
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

    // 5. Cek & Notifikasi Human Handover (Nego Harga / Keluhan / Permintaan Owner)
    const needsHandover = isHandoverTriggered(messageBody, aiResult.handoverRequired);
    if (needsHandover) {
      // Otomatis pause bot untuk kontak ini selama 2 jam agar obrolan manual owner tidak tersela
      db.pauseContact(contact, 2, 'Handover Nego Harga / Kebutuhan Owner');
      console.log(`[BusinessHandler] Bot otomatis DIJEDA 2 jam untuk kontak ${contact}.`);

      // Catat tiket antrean di tabel manual_handovers untuk dipantau di Inbox Dashboard
      if (db.createHandoverTicket) {
        try {
          db.createHandoverTicket({
            contact,
            customer_name: null,
            trigger_message: messageBody,
            reason: 'Nego Harga / Permintaan Khusus / Komplain'
          });
        } catch (_) {}
      }

      const ownerPhone = db.getSetting('owner_phone') || config.owner_phone;
      if (ownerPhone && client && typeof client.sendMessage === 'function') {
        let cleanPhone = ownerPhone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '62' + cleanPhone.slice(1);
        }
        if (cleanPhone.length >= 9) {
          const targetJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;
          const handoverNotice = `🔔 *[NOTIFIKASI HANDOVER - WA BOT]*\n\nPelanggan (*${contact}*) membutuhkan penanganan langsung oleh Pemilik / Admin Toko:\n\n💬 *Pesan Pelanggan:* "${messageBody}"\n⚠️ *Status:* Nego Harga / Permintaan Khusus / Komplain\n\n👉 *Bot telah OTOMATIS DIJEDA (PAUSED)* untuk kontak ini selama 2 jam agar obrolan manual Anda tidak tertimpa bot.\nSilakan buka WhatsApp Anda dan balas langsung pelanggan ini.`;
          
          try {
            await client.sendMessage(targetJid, handoverNotice);
            console.log(`[BusinessHandler] Notifikasi handover terkirim ke owner (${targetJid}).`);
          } catch (hErr) {
            console.error('[BusinessHandler] Gagal mengirim notifikasi handover ke owner:', hErr.message);
          }
        }
      }
    }

    // 6. Catat ke tabel chat_logs SQLite
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
