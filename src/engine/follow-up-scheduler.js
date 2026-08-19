/**
 * Engine module: follow-up-scheduler
 * 
 * Mengelola penjadwalan dan pengiriman follow-up pelanggan otomatis secara sopan dan anti-spam.
 */

const db = require('../db');
const { getConfig } = require('../config');
const { checkOutOfHours } = require('../ai/context-builder');

/**
 * Menjadwalkan follow-up baru jika memenuhi syarat.
 * @param {string} contact 
 * @param {string} productName 
 * @param {string} inquiryMessage 
 * @returns {boolean}
 */
function scheduleFollowUp(contact, productName, inquiryMessage = '') {
  try {
    const config = getConfig();
    const enabled = db.getSetting('follow_up_enabled') === 'true' || config.follow_up_enabled === true;
    if (!enabled) return false;

    // Filter 1: Cek apakah kontak opted out
    if (db.isOptedOut(contact)) {
      return false;
    }

    // Filter 2: Cek frekuensi mingguan (maks 1 follow-up sent per minggu)
    if (db.hasRecentFollowUp(contact, 7)) {
      return false;
    }

    // Filter 3: Cek apakah kontak sudah memiliki follow-up berstatus 'scheduled'
    const existing = db.db.prepare("SELECT 1 FROM follow_ups WHERE contact = ? AND status = 'scheduled'").get(contact);
    if (existing) {
      return false;
    }

    const delayHours = Number(db.getSetting('follow_up_delay_hours')) || Number(config.follow_up_delay_hours) || 24;
    const scheduledTime = new Date(Date.now() + delayHours * 3600 * 1000).toISOString();

    db.createFollowUp({
      contact,
      product_name: productName,
      inquiry_message: inquiryMessage,
      inquiry_at: new Date().toISOString(),
      scheduled_at: scheduledTime,
      status: 'scheduled'
    });

    console.log(`[FollowUpScheduler] Berhasil menjadwalkan follow-up untuk ${contact} terkait ${productName} pada ${scheduledTime}`);
    return true;
  } catch (err) {
    console.error('[FollowUpScheduler] Gagal menjadwalkan follow-up:', err.message);
    return false;
  }
}

/**
 * Memproses antrean follow-up yang jatuh tempo dan mengirimkannya jika valid.
 */
async function processFollowUps() {
  try {
    const list = db.getScheduledFollowUps();
    if (!list || list.length === 0) return;

    const now = new Date();
    const config = getConfig();

    for (const f of list) {
      if (new Date(f.scheduled_at) > now) {
        continue;
      }

      // Jalankan 7 Lapisan Perlindungan Anti-Spam:

      // 1. Opt-out check
      if (db.isOptedOut(f.contact)) {
        db.updateFollowUpStatus(f.id, 'cancelled', 'optout');
        continue;
      }

      // 2. Transaksi order check (apakah pelanggan order setelah inquiry)
      const hasOrder = db.db.prepare(`
        SELECT 1 FROM orders 
        WHERE contact = ? 
          AND datetime(created_at) >= datetime(?)
      `).get(f.contact, f.inquiry_at);
      
      if (hasOrder) {
        db.updateFollowUpStatus(f.id, 'cancelled', 'order');
        continue;
      }

      // 3. Customer reply check (apakah pelanggan membalas/chat masuk setelah inquiry)
      const hasReplied = db.db.prepare(`
        SELECT 1 FROM chat_logs 
        WHERE contact = ? 
          AND message_in IS NOT NULL 
          AND message_in != '' 
          AND datetime(created_at) > datetime(?)
      `).get(f.contact, f.inquiry_at);

      if (hasReplied) {
        db.updateFollowUpStatus(f.id, 'cancelled', 'customer_reply');
        continue;
      }

      // 4. Weekly frequency limit check
      if (db.hasRecentFollowUp(f.contact, 7)) {
        db.updateFollowUpStatus(f.id, 'cancelled', 'weekly_limit');
        continue;
      }

      // 5. Jam operasional check (Hanya kirim di dalam jam operasional)
      const { isOutOfHours } = checkOutOfHours();
      if (isOutOfHours) {
        // Tunda pengiriman 30 menit lagi
        const newScheduled = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        db.db.prepare("UPDATE follow_ups SET scheduled_at = ? WHERE id = ?").run(newScheduled, f.id);
        console.log(`[FollowUpScheduler] Menunda follow-up ${f.id} karena di luar jam operasional`);
        continue;
      }

      // Jika valid, kirim pesan follow-up
      const { getClient } = require('./client');
      const client = getClient();
      if (client) {
        const businessName = db.getSetting('business_name') || config.business_name || 'Toko Kami';
        const defaultTemplate = 'Halo Kak, kemarin sempat tanya tentang *{product_name}* ya. Varian ini masih ready lho Kak. Mau kami bantu proseskan pesanannya? 😊';
        const template = db.getSetting('follow_up_template') || config.follow_up_template || defaultTemplate;
        
        const text = template
          .replace(/{product_name}/g, f.product_name || 'produk kami')
          .replace(/{business_name}/g, businessName);

        let contactJid = f.contact;
        if (!contactJid.includes('@')) {
          contactJid = `${contactJid.replace(/[^0-9]/g, '')}@c.us`;
        }

        await client.sendMessage(contactJid, text);
        db.updateFollowUpStatus(f.id, 'sent');
        console.log(`[FollowUpScheduler] Berhasil mengirim follow-up ${f.id} ke ${contactJid}`);
      }
    }
  } catch (err) {
    console.error('[FollowUpScheduler] Gagal memproses follow-ups:', err.message);
  }
}

module.exports = {
  scheduleFollowUp,
  processFollowUps
};
