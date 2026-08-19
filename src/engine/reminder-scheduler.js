const cron = require('node-cron');
const db = require('../db');
const { getConfig } = require('../config');

let reminderCronJob = null;

/**
 * Menghitung trigger_at berikutnya berdasarkan recurrence_type.
 * @param {string} currentTrigger Format DATETIME
 * @param {string} recurrenceType 'daily', 'weekly', 'monthly'
 * @returns {string} Format YYYY-MM-DD HH:MM:SS
 */
function calculateNextTrigger(currentTrigger, recurrenceType) {
  const current = new Date(currentTrigger);
  
  // Jika waktu saat ini sudah lewat, hitung dari sekarang
  const base = current < new Date() ? new Date() : current;

  switch (recurrenceType) {
    case 'daily': {
      const next = new Date(base);
      next.setDate(next.getDate() + 1);
      // Gunakan jam dari trigger asli
      next.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), 0);
      return formatDateTime(next);
    }
    case 'weekly': {
      const next = new Date(base);
      next.setDate(next.getDate() + 7);
      next.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), 0);
      return formatDateTime(next);
    }
    case 'monthly': {
      const next = new Date(base);
      next.setMonth(next.getMonth() + 1);
      next.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), 0);
      return formatDateTime(next);
    }
    default:
      return null;
  }
}

/**
 * Format Date object ke string YYYY-MM-DD HH:MM:SS.
 * @param {Date} date 
 * @returns {string}
 */
function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * Memeriksa reminder yang jatuh tempo dan mengirimkannya ke WhatsApp.
 * Untuk recurring: hitung trigger_at berikutnya setelah kirim.
 * Untuk one-shot: mark sent=1 seperti biasa.
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
      const isRecurring = reminder.recurrence_type && ['daily', 'weekly', 'monthly'].includes(reminder.recurrence_type);
      
      const typeLabel = isRecurring 
        ? `🔄 ${reminder.recurrence_type === 'daily' ? 'Harian' : reminder.recurrence_type === 'weekly' ? 'Mingguan' : 'Bulanan'}`
        : '🔔 Satu Kali';

      const text = `⏰ *[PENGINGAT OTOMATIS]*\n\n📌 *Pesan:* ${reminder.message}\n🕒 *Waktu:* ${reminder.trigger_at}\n📋 *Jenis:* ${typeLabel}\n\n_Balas "tunda 30 menit" untuk menunda._`;
      
      try {
        await client.sendMessage(targetJid, text);
        console.log(`[Scheduler] Reminder #${reminder.id} berhasil dikirim ke ${targetJid}.`);
        
        if (isRecurring) {
          // Untuk recurring: hitung waktu trigger berikutnya
          const nextTrigger = calculateNextTrigger(reminder.trigger_at, reminder.recurrence_type);
          if (nextTrigger) {
            db.updateNextTrigger(reminder.id, nextTrigger);
            console.log(`[Scheduler] Recurring reminder #${reminder.id} dijadwalkan ulang ke ${nextTrigger}.`);
          } else {
            db.markReminderSent(reminder.id);
          }
        } else {
          // Untuk one-shot: tandai sudah terkirim
          db.markReminderSent(reminder.id);
        }
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
  stopReminderScheduler,
  calculateNextTrigger,
  formatDateTime
};
