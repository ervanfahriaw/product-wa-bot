const db = require('../../db');
const { getConfig } = require('../../config');
const { normalizePhoneNumber, toWhatsAppJid } = require('../../utils/phone');
const { parseOwnerOrderForm } = require('./owner-command-handler');
const { formatCustomerDisplay, formatIndonesianPhone } = require('../../utils/contact-resolver');

/**
 * Memeriksa apakah teks pesan pelanggan merupakan form pemesanan yang telah diisi.
 * @param {string} text 
 * @returns {boolean}
 */
function isCustomerOrderForm(text = '') {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  const hasName = lower.includes('nama:') || lower.includes('nama :') || 
                  lower.includes('nama penerima') || lower.includes('penerima:') || lower.includes('penerima :');
  const hasAddress = lower.includes('alamat:') || lower.includes('alamat :') || 
                     lower.includes('alamat lengkap') || lower.includes('tujuan:');
  const hasOrder = lower.includes('pesanan:') || lower.includes('pesanan :') || 
                   lower.includes('pesanan & jumlah') || lower.includes('item:') || lower.includes('produk:');
  const hasPhone = lower.includes('no. hp') || lower.includes('no hp') || 
                   lower.includes('no wa') || lower.includes('no penerima') || lower.includes('telepon');

  // Jika memuat minimal 2 elemen utama order (nama + pesanan / nama + alamat / alamat + pesanan)
  return (hasName && hasAddress) || (hasName && hasOrder) || (hasAddress && hasOrder) || (hasPhone && hasOrder);
}

/**
 * Menangani pengiriman form pesanan langsung dari chat pelanggan WhatsApp.
 * 1. Menyimpan order ke basis data (status: pending)
 * 2. Mengupdate profil CRM pelanggan
 * 3. Mengirim balasan konfirmasi ramah ke pelanggan
 * 4. Mengirim notifikasi instan ke WhatsApp Owner
 * 
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} [client] 
 * @returns {Promise<boolean>}
 */
async function handleCustomerOrderSubmission(message, client) {
  try {
    const rawBody = message.body || '';
    if (!isCustomerOrderForm(rawBody)) {
      return false;
    }

    const senderContact = message.from || '';
    const parsed = parseOwnerOrderForm(rawBody);
    if (!parsed) {
      return false;
    }

    const customerName = parsed.customer_name || 'Pelanggan';
    const cleanSenderPhone = normalizePhoneNumber(senderContact);
    const resolvedContact = cleanSenderPhone ? `${cleanSenderPhone}@c.us` : senderContact;
    const orderItems = parsed.order_summary || 'Pesanan Produk';
    const notes = parsed.notes || '';

    // Periksa apakah owner sedang mengaktifkan jeda penerimaan pesanan
    const config = getConfig();
    const pauseOrders = db.getSetting ? (db.getSetting('pause_orders') === 'true' || db.getSetting('pause_orders') === true) : Boolean(config.pause_orders);
    if (pauseOrders) {
      const defaultReason = 'Mohon maaf, saat ini kami sedang menjeda penerimaan pesanan baru karena pesanan sedang membludak. Silakan hubungi kami beberapa saat lagi ya Kak! 🙏';
      const reason = (db.getSetting && db.getSetting('pause_orders_reason')) || config.pause_orders_reason || defaultReason;
      const pauseReply = `Halo Kak ${customerName}!\n\n${reason}\n\nForm pesanan Kakak belum dapat kami proses saat ini. Mohon berkenan menunggu ya Kak, nanti saat antrean pesanan sudah terurai akan segera kami kabari. Terima kasih banyak atas pengertian dan kesabarannya 🙏`;
      await message.reply(pauseReply);
      return true;
    }

    // 1. Simpan ke database orders
    const orderId = db.createOrder({
      contact: resolvedContact,
      customer_name: customerName,
      order_summary: orderItems,
      total_amount: parsed.total_amount || 0,
      notes: notes || 'Pesanan masuk otomatis dari chat WhatsApp pelanggan',
      status: 'pending'
    });

    console.log(`[OrderSubmission] ✅ Berhasil mencatat order #${orderId} dari pelanggan ${customerName} (${resolvedContact}).`);

    // 2. Update/Sync CRM customer_profiles
    try {
      if (db.upsertCustomerProfile) {
        db.upsertCustomerProfile(resolvedContact, {
          customer_name: customerName,
          notes: notes ? `Alamat/Catatan: ${notes}` : undefined
        });
      }
    } catch (_) {}

    // 3. Susun balasan konfirmasi ramah ke Pelanggan
    let addressOnly = '';
    if (notes) {
      const matchAddr = notes.match(/Alamat:\s*([^|]+)/i);
      if (matchAddr) addressOnly = matchAddr[1].trim();
    }

    const confirmationReply = `Siap, terima kasih banyak Kak *${customerName}*! 🙌\n\n` +
      `Pesanan Kakak sudah kami terima dan catat ke sistem toko kami:\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 *Detail Pesanan:* #${orderId}\n` +
      `👤 *Penerima:* ${customerName}\n` +
      (addressOnly ? `📍 *Alamat:* ${addressOnly}\n` : '') +
      `🛒 *Pesanan:* ${orderItems}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Admin toko kami sedang mengecek ongkos kirim terbaik ke alamat tujuan Kakak dan akan segera mengabari totalan lengkap beserta nomor rekening pembayaran yaa.\n\n` +
      `Mohon ditunggu sebentar ya Kak! 🙏✨`;

    if (typeof message.reply === 'function') {
      await message.reply(confirmationReply);
    } else if (client && typeof client.sendMessage === 'function') {
      await client.sendMessage(resolvedContact, confirmationReply);
    }

    // 4. Catat ke chat_logs
    try {
      db.createChatLog({
        contact: resolvedContact,
        message_in: rawBody,
        message_out: confirmationReply,
        handled_by: 'order_bot'
      });
    } catch (_) {}

    // 5. Catat tiket antrean di Handover Inbox dan pause bot agar owner bisa kirim total ongkir & rekening secara manual
    try {
      if (db.pauseContact) {
        db.pauseContact(resolvedContact, 2, 'Pemesanan Baru (Cek Ongkir & Rekening)');
      }
      if (db.appendOrUpdateHandoverTicket) {
        db.appendOrUpdateHandoverTicket(resolvedContact, rawBody, 'Pemesanan Baru (Cek Ongkir & Rekening)');
      } else if (db.createHandoverTicket) {
        db.createHandoverTicket({
          contact: resolvedContact,
          customer_name: customerName,
          trigger_message: rawBody,
          reason: 'Pemesanan Baru (Cek Ongkir & Rekening)'
        });
      }
    } catch (hErr) {
      console.warn('[OrderSubmission] Gagal mencatat handover ticket:', hErr.message);
    }

    // 6. Kirim notifikasi instan ke WhatsApp Owner
    const config = getConfig();
    const rawOwnerPhone = (db.getSetting ? db.getSetting('owner_phone') : null) || config.owner_phone || '';
    const cleanOwnerPhone = normalizePhoneNumber(rawOwnerPhone);

    if (cleanOwnerPhone && client && typeof client.sendMessage === 'function') {
      const ownerJid = `${cleanOwnerPhone}@c.us`;
      // Jangan kirim notifikasi ke nomor yang sama jika yang order adalah owner sendiri
      if (ownerJid !== resolvedContact) {
        const customerDisplay = formatCustomerDisplay(senderContact, { customerName, phoneNumber: cleanSenderPhone });
        const ownerNotification = `🔔 *[PESANAN BARU DARI CHAT PELANGGAN]*\n\n` +
          `Ada pelanggan baru saja mengirim format pemesanan:\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 *ID Pesanan:* #${orderId}\n` +
          `👤 *Nama:* ${customerName}\n` +
          `📱 *No. WA / Kontak:* ${customerDisplay}\n` +
          (addressOnly ? `📍 *Alamat:* ${addressOnly}\n` : '') +
          `🛒 *Pesanan:* ${orderItems}\n` +
          (parsed.total_amount ? `💰 *Total Produk:* Rp${Number(parsed.total_amount).toLocaleString('id-ID')}\n` : '') +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `👉 *Tiket telah masuk ke Handover Inbox & Bot dijeda 2 jam* agar Anda dapat mengecek ongkir dan mengirim rekening dengan nyaman.\n\n` +
          `💡 *Kontrol via WA:* Balas chat ini dengan \`!selesai\` atau \`!aktifkan\` jika sudah selesai.`;

        try {
          await client.sendMessage(ownerJid, ownerNotification);
          console.log(`[OrderSubmission] Notifikasi order #${orderId} & handover berhasil dikirim ke WhatsApp Owner (${ownerJid}).`);
        } catch (notifErr) {
          console.warn(`[OrderSubmission] Gagal mengirim notifikasi ke owner:`, notifErr.message);
        }
      }
    }

    return true;
  } catch (err) {

    console.error('[OrderSubmission] Error saat menangani submit order pelanggan:', err.message);
    return false;
  }
}

module.exports = {
  isCustomerOrderForm,
  handleCustomerOrderSubmission
};
