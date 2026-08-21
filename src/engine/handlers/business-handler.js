const path = require('path');
const fs = require('fs');
let MessageMedia;
try {
  ({ MessageMedia } = require('whatsapp-web.js'));
} catch (_) {}

const db = require('../../db');
const { getConfig } = require('../../config');
const { generateReply } = require('../../ai');
const { checkOutOfHours, extractCustomerNameFromReply } = require('../../ai/context-builder');
const { toWhatsAppJid, normalizePhoneNumber } = require('../../utils/phone');

const HANDOVER_KEYWORDS = [
  // Negosiasi / Tawar harga
  'nego', 'tawar', 'diskon', 'potongan', 'grosir', 'bisa kurang', 'bisa tawar', 'harga pas', 'kurangin', 'turunin harga',
  'dapet ga', 'dapet gak', 'dapet berapa', 'bisa dapet', 'boleh dapet', 'pasnya', 'pas nya', 'nett', 'net',
  'boleh kurang', 'kurang ga', 'kurang gak', 'kemahalan', 'murahin', 'harga mahasiswa', 'bisa turun', 'kurang dikit',
  'kurang dong', 'bisa korting', 'korting', 'cashback khusus', 'harga teman',
  // Komplain / Keluhan produk
  'komplain', 'keluhan', 'rusak', 'pecah', 'cacat', 'retur', 'refund', 'kembalikan dana', 'basi', 'apek', 'diare', 'mules',
  'salah kirim', 'kurang barang', 'tidak sesuai', 'kecewa', 'penipu',
  // Permintaan admin / manusia
  'bicara dengan admin', 'bicara dengan manusia', 'bicara dengan pemilik', 'bicara sama owner', 'ngomong sama owner',
  'bicara sama admin', 'ngomong sama admin', 'chat admin', 'hubungi admin', 'sambungkan admin', 'bicara langsung',
  'admin asli', 'orang asli', 'hubungkan ke admin', 'hubungkan ke owner', 'owner toko', 'sambungkan ke admin', 'mau admin',
  'admin manusia', 'bantuan manusia', 'cs manusia', 'operator asli',
  // Pembayaran / Rekening khusus
  'minta nomor rekening', 'nomor rekening', 'rekening transfer', 'rekening pribadi'
];

const NEGO_PATTERNS = [
  /\b\d+\s*(k|rb|ribu)?\s*(dapet|bisa|boleh|dapet gak|dapet ga|angkut|bungkus|gas)\b/i,
  /\b(bisa|boleh|dapet)\s*\d+\s*(k|rb|ribu)\b/i,
  /\b(harga|budget|dana)\s*(cuma|hanya|pas|ada)?\s*\d+\s*(k|rb|ribu)\b/i,
  /\b(kurangin|turunin)\s*(jadi|ke)?\s*\d+\s*(k|rb|ribu)\b/i,
  /(bicara|ngomong|tanya|hubungi|chat|sambung)\s*(langsung)?\s*(sama|dengan|ke)?\s*(admin|owner|pemilik|manusia|cs|operator)/i
];

/**
 * Memeriksa apakah fitur Handover sedang aktif di pengaturan.
 * @param {object} [config] 
 * @returns {boolean}
 */
function isHandoverEnabled(config = null) {
  const setting = db.getSetting ? db.getSetting('handover_enabled') : null;
  if (setting !== null && setting !== undefined && setting !== '') {
    return setting === 'true' || setting === '1' || setting === 'on' || setting === true;
  }
  const cfg = config || getConfig();
  return cfg.handover_enabled !== false;
}

/**
 * Menentukan apakah pesan membutuhkan pengalihan ke manusia (human handover).
 * @param {string} messageText 
 * @param {boolean} isAiHandover 
 * @param {object|null} [config]
 * @returns {boolean}
 */
function isHandoverTriggered(messageText = '', isAiHandover = false, config = null) {
  // Jika fitur Handover dinonaktifkan di pengaturan, jangan pernah trigger handover
  if (!isHandoverEnabled(config)) {
    return false;
  }

  if (isAiHandover) return true;
  const lower = (messageText || '').toLowerCase().trim();
  if (!lower) return false;

  // 1. Keyword check
  if (HANDOVER_KEYWORDS.some(kw => lower.includes(kw))) {
    return true;
  }

  // 2. Regex pattern check
  if (NEGO_PATTERNS.some(regex => regex.test(lower))) {
    return true;
  }

  return false;
}

/**
 * Menjalankan aksi handover: jeda bot untuk kontak, catat tiket di antrean, dan beri tahu owner.
 * @param {string} contact 
 * @param {string} messageBody 
 * @param {string} reason 
 * @param {any} client 
 * @param {object} config 
 */
async function triggerHandoverActions(contact, messageBody, reason, client, config) {
  // 1. Otomatis pause bot untuk kontak ini selama 2 jam agar obrolan manual owner tidak tersela
  db.pauseContact(contact, 2, reason || 'Handover Nego Harga / Kebutuhan Owner');
  console.log(`[BusinessHandler] Bot otomatis DIJEDA 2 jam untuk kontak ${contact}.`);

  // 2. Catat tiket antrean di tabel manual_handovers untuk dipantau di Inbox Dashboard
  if (db.appendOrUpdateHandoverTicket) {
    try {
      db.appendOrUpdateHandoverTicket(contact, messageBody, reason || 'Nego Harga / Permintaan Khusus / Komplain');
    } catch (_) {}
  } else if (db.createHandoverTicket) {
    try {
      db.createHandoverTicket({
        contact,
        customer_name: null,
        trigger_message: messageBody,
        reason: reason || 'Nego Harga / Permintaan Khusus / Komplain'
      });
    } catch (_) {}
  }

  // 3. Kirim notifikasi ke nomor owner
  const ownerPhone = db.getSetting('owner_phone') || config.owner_phone;
  if (ownerPhone && client && typeof client.sendMessage === 'function') {
    const cleanPhone = normalizePhoneNumber(ownerPhone);
    const targetJid = toWhatsAppJid(ownerPhone);

    const customerInfo = await resolveCustomerInfo(null, contact);
    const customerDisplay = customerInfo.formattedDisplay || contact;
    const unpauseTarget = customerInfo.phoneNumber || normalizePhoneNumber(contact) || contact;

    if (targetJid && cleanPhone.length >= 9) {
      const handoverNotice = `🔔 *[NOTIFIKASI HANDOVER - WA BOT]*\n\n` +
        `Pelanggan (*${customerDisplay}*) membutuhkan penanganan langsung oleh Admin / Owner:\n\n` +
        `💬 *Pesan Pelanggan:* "${messageBody}"\n` +
        `⚠️ *Status:* ${reason || 'Nego Harga / Permintaan Khusus / Komplain'}\n\n` +
        `👉 *Bot telah OTOMATIS DIJEDA (PAUSED)* untuk kontak ini selama 2 jam agar obrolan manual Anda tidak tertimpa bot.\n\n` +
        `💡 *Kontrol via WA:* Balas chat ini dengan \`!aktifkan ${unpauseTarget}\` atau \`!selesai\` jika sudah selesai melayani agar bot aktif kembali.`;
      
      try {
        let finalJid = targetJid;
        if (typeof client.getNumberId === 'function') {
          const numberId = await client.getNumberId(cleanPhone).catch(() => null);
          if (numberId && numberId._serialized) {
            finalJid = numberId._serialized;
          }
        }
        await client.sendMessage(finalJid, handoverNotice);
        console.log(`[BusinessHandler] Notifikasi handover terkirim ke owner (${finalJid}) untuk pelanggan ${customerDisplay}.`);
      } catch (hErr) {
        console.error('[BusinessHandler] Gagal mengirim notifikasi handover ke owner:', hErr.message);
      }
    }
  }
}

const { BASE_DIR, UPLOADS_DIR } = require('../../utils/paths');
const { resolveCustomerInfo, formatCustomerDisplay } = require('../../utils/contact-resolver');
const { 
  normalizeImageUrl, 
  downloadAndCacheImage, 
  resolveProductImageResource 
} = require('../../utils/image-downloader');

/**
 * Menyelesaikan path fisik atau URL gambar produk dari database.
 * @param {string} imagePath 
 * @returns {string|null} Path lokal atau URL yang dinormalisasi
 */
function resolveProductImagePath(imagePath) {
  if (!imagePath) return null;
  const res = resolveProductImageResource(imagePath);
  if (res) {
    return res.isUrl ? res.url : res.fullPath;
  }
  return null;
}

/**
 * Menghasilkan objek MessageMedia yang siap dikirim oleh WhatsApp Web,
 * mendukung baik file lokal di disk maupun tautan URL remote (Google Drive / HTTP).
 * @param {string} filePathOrUrl 
 * @returns {Promise<object|null>}
 */
async function createMessageMediaFromFile(filePathOrUrl) {
  if (!filePathOrUrl) return null;

  let localPath = filePathOrUrl;

  // Jika berupa URL, unduh & simpan ke cache lokal terlebih dahulu
  if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
    try {
      const cached = await downloadAndCacheImage(filePathOrUrl);
      if (cached && fs.existsSync(cached)) {
        localPath = cached;
      }
    } catch (err) {
      console.warn('[BusinessHandler] Gagal mengunduh gambar remote:', err.message);
    }
  }

  if (!localPath || !fs.existsSync(localPath)) return null;

  if (MessageMedia && typeof MessageMedia.fromFilePath === 'function') {
    try {
      return MessageMedia.fromFilePath(localPath);
    } catch (_) {}
  }

  // Fallback membaca base64 manual jika instance helper whatsapp-web.js belum ready
  try {
    const base64Data = fs.readFileSync(localPath, { encoding: 'base64' });
    const ext = path.extname(localPath).toLowerCase();
    let mime = 'image/jpeg';
    if (ext === '.png') mime = 'image/png';
    else if (ext === '.webp') mime = 'image/webp';
    else if (ext === '.gif') mime = 'image/gif';
    const filename = path.basename(localPath);

    if (MessageMedia) {
      return new MessageMedia(mime, base64Data, filename);
    }
    return { mimetype: mime, data: base64Data, filename };
  } catch (err) {
    console.error('[BusinessHandler] Gagal membuat MessageMedia:', err.message);
    return null;
  }
}

/**
 * Mencari apakah ada produk relevan dengan gambar yang perlu dikirim.
 * Mendukung file lokal, link gambar Google Drive/URL, dan riwayat obrolan pelanggan.
 * @param {string} messageText 
 * @param {string} [contact]
 * @returns {{product: object, fullPath: string|null, url: string|null, isUrl: boolean}|null}
 */
function findProductImageToSend(messageText = '', contact = null) {
  const lower = messageText.toLowerCase();
  const isAskingImage = lower.includes('foto') || lower.includes('gambar') || 
                        lower.includes('lihat') || lower.includes('liat') ||
                        lower.includes('katalog') || lower.includes('model') || 
                        lower.includes('bentuk') || lower.includes('spill') ||
                        lower.includes('penampakan') || lower.includes('contoh') ||
                        lower.includes('pic') || lower.includes('pict');

  const products = db.getAllProducts();
  if (products.length === 0) return null;

  // Filter produk yang memiliki file gambar lokal atau link gambar valid
  const productsWithImage = [];
  for (const prod of products) {
    if (prod.image_path) {
      const res = resolveProductImageResource(prod.image_path);
      if (res) {
        productsWithImage.push({ 
          product: prod, 
          fullPath: res.fullPath || null, 
          url: res.url || null,
          isUrl: res.isUrl
        });
      }
    }
  }

  if (productsWithImage.length === 0) return null;

  // 1. Cek pencocokan kata-kata dalam nama produk (Fuzzy Word Overlap Scoring)
  const queryWords = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
  let bestMatch = null;
  let highestScore = 0;

  for (const item of productsWithImage) {
    const prodName = item.product.name.toLowerCase();
    const prodSku = (item.product.sku || '').toLowerCase();
    const prodWords = prodName.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3);

    // Jika SKU cocok langsung
    if (prodSku && lower.includes(prodSku)) {
      return item;
    }

    // Hitung berapa kata dari nama produk yang muncul dalam pesan
    let score = 0;
    for (const pw of prodWords) {
      if (queryWords.includes(pw) || lower.includes(pw)) {
        score++;
      }
    }

    // Jika seluruh frasa nama produk ada di query
    if (lower.includes(prodName)) {
      score += 10;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (highestScore > 0 && bestMatch) {
    return bestMatch;
  }

  // 2. Jika pesan menanyakan foto, tapi tidak menyebut nama produk spesifik:
  //    Cek riwayat obrolan terakhir (chat_logs) pelanggan untuk mengetahui produk apa yang sedang dibahas!
  if (isAskingImage && contact) {
    try {
      if (db.getChatLogsByContact) {
        const recentLogs = db.getChatLogsByContact(contact, 5);
        if (recentLogs && recentLogs.length > 0) {
          const combinedHistory = recentLogs.map(l => `${l.message_in} ${l.message_out}`).join(' ').toLowerCase();

          for (const item of productsWithImage) {
            const prodName = item.product.name.toLowerCase();
            const prodWords = prodName.split(/\s+/).filter(w => w.length >= 3);
            if (combinedHistory.includes(prodName) || prodWords.some(pw => combinedHistory.includes(pw))) {
              return item;
            }
          }
        }
      }
    } catch (_) {}

    // Fallback: Jika umum ("minta foto katalog"), ambil produk pertama yang punya gambar
    return productsWithImage[0];
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

      // 1. Simpan pesan masuk ke tabel chat_logs agar selalu muncul di Web Controller Chat Logs & CRM
      try {
        db.createChatLog({
          contact,
          message_in: messageBody,
          message_out: '(Status Dijeda / Handover - Menunggu respon manual admin)',
          handled_by: 'human'
        });
      } catch (_) {}

      // 2. Perbarui / tambahkan pesan baru ke Tiket Handover agar muncul di Inbox Handover Dashboard
      try {
        if (db.appendOrUpdateHandoverTicket) {
          db.appendOrUpdateHandoverTicket(contact, messageBody, 'Pesan Lanjutan saat Status Dijeda');
        }
      } catch (_) {}

      // 3. Update waktu interaksi terakhir di profil pelanggan (CRM)
      try {
        if (db.updateLastContact) db.updateLastContact(contact);
      } catch (_) {}

      // 4. Teruskan notifikasi pesan baru ke nomor owner (jika nomor owner bukan pengirim itu sendiri)
      try {
        const config = getConfig();
        const ownerPhone = db.getSetting('owner_phone') || config.owner_phone;
        if (ownerPhone && client && typeof client.sendMessage === 'function') {
          const cleanPhone = normalizePhoneNumber(ownerPhone);
          const targetJid = toWhatsAppJid(ownerPhone);
          if (targetJid && !contact.includes(cleanPhone)) {
            const followUpNotice = `🔔 *[PESAN BARU - HANDOVER AKTIF]*\n\nPelanggan (*${contact}*) mengirim pesan lanjutan:\n\n💬 "${messageBody}"\n\n_Status bot masih DIJEDA. Silakan balas langsung melalui WhatsApp Anda._`;
            let finalJid = targetJid;
            if (typeof client.getNumberId === 'function') {
              const numberId = await client.getNumberId(cleanPhone).catch(() => null);
              if (numberId && numberId._serialized) finalJid = numberId._serialized;
            }
            await client.sendMessage(finalJid, followUpNotice).catch(() => {});
          }
        }
      } catch (_) {}

      return;
    }

    const config = getConfig();

    // Auto-cancel scheduled follow-up jika pelanggan membalas chat (Fase 5)
    try {
      const scheduledList = db.db.prepare("SELECT id FROM follow_ups WHERE contact = ? AND status = 'scheduled'").all(contact);
      for (const f of scheduledList) {
        db.updateFollowUpStatus(f.id, 'cancelled', 'customer_reply');
        console.log(`[BusinessHandler] Otomatis membatalkan follow-up ${f.id} karena ada balasan baru dari pelanggan`);
      }
    } catch (_) {}

    // 1. Cek jam operasional — kirim auto-reply jika di luar jam dan fitur aktif
    const outOfHoursMode = db.getSetting ? (db.getSetting('out_of_hours_mode') || 'off') : 'off';
    if (outOfHoursMode !== 'off') {
      const { isOutOfHours, businessHours } = checkOutOfHours();
      if (isOutOfHours && businessHours) {
        if (outOfHoursMode === 'reply_only') {
          // Kirim pesan template luar jam, TANPA proses AI (hemat token)
          const businessName = config.business_name || 'Toko Kami';
          const outOfHoursMsg = `Terima kasih sudah menghubungi *${businessName}*. Saat ini di luar jam operasional kami (${businessHours} WIB). Pesan Kakak sudah tercatat dan akan kami respon saat buka kembali. Terima kasih atas kesabarannya 🙏`;

          await simulateHumanTyping(message, 2000, 4000);
          await message.reply(outOfHoursMsg);

          // Tetap catat ke chat_logs agar tidak hilang
          db.createChatLog({
            contact,
            message_in: messageBody,
            message_out: outOfHoursMsg,
            handled_by: 'out_of_hours'
          });
          console.log(`[BusinessHandler] Pesan dari ${contact} dijawab dengan template luar jam operasional.`);
          return;
        }
        // Mode 'full_ai': lanjut ke AI tapi nanti AI tahu ini di luar jam
      }
    }

    // Deteksi kata kunci opt-out follow-up (Fase 5)
    const lowerBody = messageBody.toLowerCase();
    const OPTOUT_KEYWORDS = ['jangan ganggu', 'stop', 'berhenti', 'unsubscribe', 'jangan kirim lagi', 'spam'];
    const isOptOutTriggered = OPTOUT_KEYWORDS.some(kw => lowerBody.includes(kw));

    if (isOptOutTriggered) {
      try {
        db.addOptOut(contact);
        // Batalkan follow-up yang dijadwalkan
        const scheduledList = db.db.prepare("SELECT id FROM follow_ups WHERE contact = ? AND status = 'scheduled'").all(contact);
        for (const f of scheduledList) {
          db.updateFollowUpStatus(f.id, 'cancelled', 'optout');
        }

        const optOutReply = 'Baik Kak, kami tidak akan mengirim pesan follow-up lagi. Kalau suatu saat butuh bantuan, langsung chat aja ya. 🙏';
        await simulateHumanTyping(message, 1000, 2000);
        await message.reply(optOutReply);

        db.createChatLog({
          contact,
          message_in: messageBody,
          message_out: optOutReply,
          handled_by: 'optout'
        });
        
        console.log(`[BusinessHandler] Kontak ${contact} meminta opt-out follow-up.`);
        return;
      } catch (err) {
        console.error('[BusinessHandler] Gagal memproses request opt-out:', err.message);
      }
    }

    // 2. Cek FAQ match — jawab langsung tanpa AI jika ada FAQ yang cocok
    try {
      const matchedFaq = db.matchFaq ? db.matchFaq(messageBody) : null;
      if (matchedFaq) {
        await simulateHumanTyping(message, 1500, 3000);
        await message.reply(matchedFaq.answer);

        // Catat ke chat_logs dengan handled_by 'faq'
        db.createChatLog({
          contact,
          message_in: messageBody,
          message_out: matchedFaq.answer,
          handled_by: 'faq'
        });

        // Naikkan counter
        if (db.incrementFaqMatchCount) db.incrementFaqMatchCount(matchedFaq.id);

        // Update last contact di customer profiles
        try { if (db.updateLastContact) db.updateLastContact(contact); } catch (_) {}

        console.log(`[BusinessHandler] Pesan dari ${contact} dijawab FAQ "${matchedFaq.question_label}" (hemat 1 panggilan AI).`);
        return;
      }
    } catch (_) {}

    // 3. Cek apakah pesan memerlukan Human Handover (Nego Harga / Komplain / Minta Admin)
    if (isHandoverTriggered(messageBody, false, config)) {
      const handoverReply = 'Baik Kak, terkait penawaran/permintaan Kakak ini, pesan sudah kami teruskan ke admin/pemilik toko ya. Mohon ditunggu sebentar, admin kami akan segera membalas langsung di sini. Terima kasih atas kesabarannya 🙏';

      await simulateHumanTyping(message, 1000, 2000);
      if (typeof message.reply === 'function') {
        await message.reply(handoverReply);
      } else if (client && typeof client.sendMessage === 'function') {
        await client.sendMessage(contact, handoverReply);
      }

      await triggerHandoverActions(contact, messageBody, 'Nego Harga / Permintaan Khusus / Komplain', client, config);

      db.createChatLog({
        contact,
        message_in: messageBody,
        message_out: handoverReply,
        handled_by: 'human'
      });

      try {
        if (db.updateLastContact) db.updateLastContact(contact);
      } catch (_) {}

      return;
    }

    // 4. Simulasikan jeda manusiawi & status typing untuk anti-banned
    await simulateHumanTyping(message);

    // 5. Generate balasan dari AI Router (dengan konteks riwayat chat pelanggan)
    const aiResult = await generateReply({
      message: messageBody,
      mode: 'bisnis',
      contact
    });

    let replyText = aiResult.reply || 'Halo, ada yang bisa kami bantu seputar produk kami?';

    // 5b. Auto-extract nama pelanggan dari tag [CUSTOMER_NAME:xxx] (jika AI menemukannya)
    try {
      const nameResult = extractCustomerNameFromReply(replyText);
      if (nameResult && nameResult.name) {
        replyText = nameResult.cleanReply; // Hapus tag dari pesan yang dikirim ke pelanggan
        // Simpan nama ke customer_profiles jika belum ada
        const existing = db.getCustomerProfile ? db.getCustomerProfile(contact) : null;
        if (!existing || !existing.customer_name) {
          db.upsertCustomerProfile(contact, { customer_name: nameResult.name });
          console.log(`[BusinessHandler] Nama pelanggan "${nameResult.name}" berhasil disimpan untuk ${contact}.`);
        }
      }
    } catch (_) {}

    // 5c. Update timestamp terakhir chat di customer_profiles
    try {
      if (db.updateLastContact) db.updateLastContact(contact);
    } catch (_) {}

    // 6. Pecah pesan panjang menjadi gelembung chat alami & kirim bertahap
    const maxBubbles = Number(config.max_bubbles) || 3;
    const bubbles = splitIntoBubbles(replyText, maxBubbles);
    await sendMultiBubbleMessages(message, client, contact, bubbles, {
      interBubbleDelay: config.inter_bubble_delay
    });

    // 7. Cek apakah perlu kirim gambar produk
    const imgInfo = findProductImageToSend(messageBody, contact);
    if (imgInfo && client) {
      try {
        const media = await createMessageMediaFromFile(imgInfo.fullPath || imgInfo.url);
        if (media) {
          const caption = `📸 *${imgInfo.product.name}*\n💰 Rp${Number(imgInfo.product.price).toLocaleString('id-ID')}`;
          let sent = false;

          if (typeof client.sendMessage === 'function') {
            try {
              await client.sendMessage(contact, media, { caption });
              sent = true;
            } catch (_) {}
          }

          if (!sent && message && typeof message.reply === 'function') {
            try {
              await message.reply(media, undefined, { caption });
              sent = true;
            } catch (_) {}
          }

          if (sent) {
            console.log(`[BusinessHandler] Berhasil mengirim foto produk "${imgInfo.product.name}" ke ${contact}`);
          }
        }
      } catch (mediaErr) {
        console.error('[BusinessHandler] Gagal mengirim media gambar:', mediaErr.message);
      }
    }

    // 8. Cek & Notifikasi jika AI menandai handoverRequired (hanya jika fitur handover aktif)
    const needsAiHandover = isHandoverEnabled(config) && Boolean(aiResult.handoverRequired);
    if (needsAiHandover) {
      await triggerHandoverActions(contact, messageBody, 'Permintaan Eskalasi AI', client, config);
    }

    // Cek apakah pesan mengandung nama produk dari katalog untuk menjadwalkan follow-up (Fase 5)
    try {
      const { scheduleFollowUp } = require('../follow-up-scheduler');
      const { extractKeywords } = require('../../ai/context-builder');
      const keywords = extractKeywords(messageBody);
      let matchedProdName = null;
      for (const kw of keywords) {
        const results = db.searchProducts(kw);
        if (results && results.length > 0) {
          matchedProdName = results[0].name;
          break;
        }
      }
      if (matchedProdName) {
        scheduleFollowUp(contact, matchedProdName, messageBody);
      }
    } catch (e) {
      console.error('[BusinessHandler] Gagal menjadwalkan follow-up otomatis:', e.message);
    }

    // 6. Catat ke tabel chat_logs SQLite
    db.createChatLog({
      contact,
      message_in: messageBody,
      message_out: replyText,
      handled_by: needsAiHandover ? 'human' : 'ai'
    });

  } catch (err) {
    console.error('[BusinessHandler] Error saat memproses pesan bisnis:', err.message);
  }
}

module.exports = {
  handleBusinessMessage,
  isHandoverTriggered,
  isHandoverEnabled,
  findProductImageToSend,
  resolveProductImagePath,
  createMessageMediaFromFile
};
