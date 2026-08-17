const cron = require('node-cron');
const db = require('../db');
const { getConfig } = require('../config');

let reminderCronJob = null;

/**
 * Memeriksa reminder yang jatuh tempo dan mengirimkannya ke WhatsApp.
 * @param {import('whatsapp-web.js').Client} client 
 */
async function checkAndSendReminders(client) {
  if (!client || typeof client.sendMessage !== 'function') return;

  try {
    const config = getConfig();
    const ownerPhone = db.getSetting('owner_phone') || config.owner_phone;
    if (!ownerPhone) return;

    const cleanPhone = ownerPhone.replace(/[^0-9]/g, '');
    const targetJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;

    const pendingList = db.getPendingReminders();
    if (!pendingList || pendingList.length === 0) return;

    for (const reminder of pendingList) {
      const text = `⏰ *[PENGINGAT OTOMATIS]*\n\n📌 *Pesan:* ${reminder.message}\n🕒 *Waktu:* ${reminder.trigger_at}`;
      
      try {
        await client.sendMessage(targetJid, text);
        db.markReminderSent(reminder.id);
        console.log(`[Scheduler] Reminder #${reminder.id} berhasil dikirim ke ${targetJid}.`);
      } catch (err) {
        console.error(`[Scheduler] Gagal mengirim reminder #${reminder.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error saat memeriksa pending reminders:', error.message);
  }
}

/**
 * Menjalankan scheduler cron pengingat otomatis tiap 1 menit.
 * @param {import('whatsapp-web.js').Client} client 
 */
function startReminderScheduler(client) {
  if (reminderCronJob) {
    return reminderCronJob;
  }

  console.log('[Scheduler] Reminder scheduler aktif (cek tiap 1 menit).');
  reminderCronJob = cron.schedule('* * * * *', async () => {
    await checkAndSendReminders(client);
  });

  return reminderCronJob;
}

/**
 * Menghentikan cron job reminder.
 */
function stopReminderScheduler() {
  if (reminderCronJob) {
    reminderCronJob.stop();
    reminderCronJob = null;
    console.log('[Scheduler] Reminder scheduler dihentikan.');
  }
}

module.exports = {
  checkAndSendReminders,
  startReminderScheduler,
  stopReminderScheduler
};
