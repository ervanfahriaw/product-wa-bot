const db = require('../../db');
const { getConfig, saveConfig } = require('../../config');
const { normalizePhoneNumber, toWhatsAppJid } = require('../../utils/phone');
const { findLidForPhoneNumber, formatIndonesianPhone } = require('../../utils/contact-resolver');

/**
 * Memeriksa apakah pesan masuk berasal dari nomor Owner / Pemilik Toko.
 * @param {import('whatsapp-web.js').Message} message 
 * @returns {boolean}
 */
function isOwnerMessage(message) {
  if (!message) return false;
  if (message.fromMe === true) return true;

  const sender = message.from || '';
  const cleanSender = normalizePhoneNumber(sender);
  if (!cleanSender) return false;

  const config = getConfig();
  const ownerPhone = db.getSetting('owner_phone') || config.owner_phone || '';
  const cleanOwner = normalizePhoneNumber(ownerPhone);

  if (!cleanOwner) return false;
  return cleanSender.includes(cleanOwner) || cleanOwner.includes(cleanSender);
}

/**
 * Mem-parsing teks pesan perintah dari Owner.
 * @param {string} text 
 * @returns {{action: string, [key: string]: any}|null}
 */
function parseOwnerCommand(text = '') {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Perintah Toggle Handover: !handover on / off / aktif / nonaktif
  const handoverMatch = lower.match(/^!?handover\s+(on|off|aktif|mati|nonaktif|hidup)$/i);
  if (handoverMatch) {
    const val = handoverMatch[1];
    const enabled = val === 'on' || val === 'aktif' || val === 'hidup';
    return { action: 'handover_toggle', enabled };
  }

  // 2. Perintah Jeda / Pause: !jeda [nomor] [durasi] atau !pause [nomor] [durasi]
  const pausePrefixMatch = trimmed.match(/^!?(?:jeda|pause)\b\s*(.*)$/i);
  if (pausePrefixMatch) {
    const rest = pausePrefixMatch[1].trim();
    if (rest) {
      const parts = rest.split(/\s+/);
      let hours = 2;
      let phoneParts = parts;
      if (parts.length > 1 && /^\d+(?:\.\d+)?$/.test(parts[parts.length - 1])) {
        hours = parseFloat(parts[parts.length - 1]);
        phoneParts = parts.slice(0, parts.length - 1);
      }
      const rawNumber = phoneParts.join('');
      const cleanNum = normalizePhoneNumber(rawNumber);
      if (cleanNum) {
        return { action: 'pause', targetNumber: cleanNum, hours: hours || 2 };
      }
    }
  }

  // 3. Perintah Unpause / Selesai dengan Nomor: !aktifkan [nomor], !unpause [nomor], !selesai [nomor], !resume [nomor]
  const unpausePrefixMatch = trimmed.match(/^!?(?:aktifkan|unpause|selesai|resume|done)\b\s*(.*)$/i);
  if (unpausePrefixMatch) {
    const rest = unpausePrefixMatch[1].trim();
    if (rest) {
      const cleanNum = normalizePhoneNumber(rest);
      if (cleanNum) {
        return { action: 'unpause', targetNumber: cleanNum };
      }
    } else {
      return { action: 'unpause_single' };
    }
  }

  // 4. Perintah Cek Status / List: !status, !list, !cek
  const statusMatch = lower.match(/^!?(?:status|list|cek|antrean)$/i);
  if (statusMatch) {
    return { action: 'status' };
  }

  // 5. Perintah Bantuan Menu: !help, !menu, !bantuan
  const helpMatch = lower.match(/^!?(?:help|menu|bantuan)$/i);
  if (helpMatch) {
    return { action: 'help' };
  }

  return null;
}

/**
 * Mengeksekusi perintah owner jika teks pesan valid.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} [client] 
 * @returns {Promise<boolean>} True jika perintah berhasil diproses
 */
async function handleOwnerCommand(message, client) {
  const body = message.body || '';
  const parsed = parseOwnerCommand(body);
  if (!parsed) return false;

  const sender = message.from || '';

  const sendReply = async (text) => {
    try {
      if (typeof message.reply === 'function') {
        await message.reply(text);
      } else if (client && typeof client.sendMessage === 'function') {
        await client.sendMessage(sender, text);
      }
    } catch (err) {
      console.error('[OwnerCommandHandler] Gagal mengirim balasan perintah:', err.message);
    }
  };

  // AKSI 1: Unpause / Aktifkan kembali bot untuk nomor target
  if (parsed.action === 'unpause') {
    const target = parsed.targetNumber;
    const targetJid = toWhatsAppJid(target);

    // Unpause format JID @c.us, @lid, dan mapping JID asli dari customer_profiles
    db.resumeContact(targetJid);
    db.resumeContact(`${target}@c.us`);
    db.resumeContact(`${target}@lid`);
    db.resumeContact(target);

    const mappedLid = findLidForPhoneNumber(target);
    if (mappedLid) {
      db.resumeContact(mappedLid);
      if (db.resolveHandoverByContact) {
        db.resolveHandoverByContact(mappedLid);
      }
    }

    if (db.resolveHandoverByContact) {
      db.resolveHandoverByContact(target);
      db.resolveHandoverByContact(targetJid);
    }

    const pretty = formatIndonesianPhone(target) || target;
    const replyMsg = `✅ *[BOT DIAKTIFKAN KEMBALI]*\n\n` +
      `Bot WhatsApp telah *DIAKTIFKAN* kembali untuk nomor: *${pretty}* (${target}).\n` +
      `Tiket handover ditandai *Selesai*. Pesan berikutnya dari pelanggan ini akan langsung dijawab otomatis oleh AI.`;

    await sendReply(replyMsg);
    console.log(`[OwnerCommandHandler] Sukses mengaktifkan bot untuk ${target} via perintah WhatsApp.`);
    return true;
  }

  // AKSI 2: Unpause / Selesai tanpa nomor (otomatis ambil kontak jeda terbaru)
  if (parsed.action === 'unpause_single') {
    const pausedList = db.getAllPausedContacts ? db.getAllPausedContacts() : [];

    if (pausedList.length === 0) {
      await sendReply(`ℹ️ Tidak ada kontak pelanggan yang sedang dalam status jeda saat ini. Semua chat berjalan normal.`);
      return true;
    }

    // Ambil kontak yang paling baru dijeda
    const targetItem = pausedList[0];
    const cleanNum = normalizePhoneNumber(targetItem.contact);

    db.resumeContact(targetItem.contact);
    db.resumeContact(toWhatsAppJid(targetItem.contact));
    if (cleanNum) {
      db.resumeContact(`${cleanNum}@c.us`);
      db.resumeContact(`${cleanNum}@lid`);
    }
    if (db.resolveHandoverByContact) {
      db.resolveHandoverByContact(targetItem.contact);
    }

    let extraNote = '';
    if (pausedList.length > 1) {
      extraNote = `\n\n📌 _Catatan: Masih ada ${pausedList.length - 1} kontak lain yang dijeda. Ketik \`!status\` untuk melihat daftar._`;
    }

    const replyMsg = `✅ *[TIKET SELESAI & BOT DIAKTIFKAN]*\n\n` +
      `Bot WhatsApp telah *DIAKTIFKAN* kembali untuk pelanggan: *${cleanNum || targetItem.contact}*.\n` +
      `Status jeda telah dilepas. Bot kembali melayani pelanggan ini secara otomatis.${extraNote}`;

    await sendReply(replyMsg);
    console.log(`[OwnerCommandHandler] Sukses unpause kontak ${targetItem.contact}.`);
    return true;
  }

  // AKSI 3: Jeda / Pause Bot Manual untuk nomor tertentu
  if (parsed.action === 'pause') {
    const target = parsed.targetNumber;
    const targetJid = toWhatsAppJid(target);
    const hours = parsed.hours || 2;

    db.pauseContact(targetJid, hours, 'Jeda Manual oleh Admin via WA');
    if (db.createHandoverTicket) {
      db.createHandoverTicket({
        contact: targetJid,
        trigger_message: `(Dijeda manual oleh Admin selama ${hours} jam)`,
        reason: 'Jeda Manual Admin'
      });
    }

    const replyMsg = `⏸️ *[BOT BERHASIL DIJEDA]*\n\n` +
      `Bot WhatsApp untuk nomor *${target}* telah *DIJEDA* selama *${hours} jam*.\n` +
      `Anda dapat membalas chat pelanggan ini secara manual tanpa tertimpa bot.\n\n` +
      `_Ketik \`!aktifkan ${target}\` untuk mengaktifkan bot kembali kapan saja._`;

    await sendReply(replyMsg);
    console.log(`[OwnerCommandHandler] Sukses menjeda bot untuk ${target} (${hours} jam).`);
    return true;
  }

  // AKSI 4: Toggle Handover ON / OFF Global
  if (parsed.action === 'handover_toggle') {
    const isEnabled = parsed.enabled;
    db.setSetting('handover_enabled', isEnabled ? 'true' : 'false');
    saveConfig({ handover_enabled: isEnabled });

    let replyMsg = '';
    if (isEnabled) {
      replyMsg = `🟢 *[FITUR HANDOVER DIAKTIFKAN]*\n\n` +
        `Fitur Handover (Pengalihan ke Admin) saat ini berstatus *AKTIF*.\n` +
        `Bot akan otomatis menjeda chat 2 jam & mengirim notifikasi ke nomor Anda saat pelanggan menawar harga (nego) atau komplain.`;
    } else {
      replyMsg = `🔴 *[FITUR HANDOVER DINONAKTIFKAN]*\n\n` +
        `Fitur Handover saat ini *NONAKTIF* (Mode Full AI 100%).\n` +
        `Bot AI akan melayani seluruh pertanyaan dan negosiasi secara mandiri tanpa menjeda bot.`;
    }

    await sendReply(replyMsg);
    console.log(`[OwnerCommandHandler] Status handover diubah ke ${isEnabled ? 'ON' : 'OFF'}.`);
    return true;
  }

  // AKSI 5: Status & Daftar Kontak Dijeda
  if (parsed.action === 'status') {
    const config = getConfig();
    const isHandoverOn = db.getSetting('handover_enabled') !== 'false' && config.handover_enabled !== false;
    const pausedList = db.getAllPausedContacts ? db.getAllPausedContacts() : [];
    const pendingCount = db.getPendingHandoverCount ? db.getPendingHandoverCount() : 0;

    let statusText = `📊 *[STATUS BOT BISNIS]*\n\n` +
      `• Mode Bot: *Bisnis (CS & Sales)*\n` +
      `• Fitur Handover: ${isHandoverOn ? '🟢 *AKTIF*' : '🔴 *NONAKTIF*'}\n` +
      `• Tiket Pending: *${pendingCount} tiket*\n` +
      `• Kontak Sedang Dijeda: *${pausedList.length} nomor*\n`;

    if (pausedList.length > 0) {
      statusText += `\n📋 *Daftar Kontak Dijeda:*\n`;
      pausedList.forEach((item, idx) => {
        const clean = normalizePhoneNumber(item.contact);
        statusText += `${idx + 1}. *${clean}* — Batas: ${item.paused_until || '2 Jam'}\n`;
      });
      statusText += `\n_Ketik \`!aktifkan [nomor]\` untuk melanjutkan bot._`;
    } else {
      statusText += `\n_Semua pelanggan saat ini dilayani otomatis oleh bot AI._`;
    }

    await sendReply(statusText);
    return true;
  }

  // AKSI 6: Menu Bantuan / Help
  if (parsed.action === 'help') {
    const helpText = `🛠️ *[PANDUAN PERINTAH ADMIN VIA WA]*\n\n` +
      `Kirim perintah berikut langsung ke chat bot ini:\n\n` +
      `1. *!aktifkan [nomor]* atau *!selesai [nomor]*\n` +
      `   👉 Mengaktifkan kembali bot & menyelesaikan tiket handover untuk pelanggan tersebut.\n\n` +
      `2. *!selesai* atau *!aktifkan*\n` +
      `   👉 Mengaktifkan bot untuk pelanggan terakhir yang sedang dijeda.\n\n` +
      `3. *!jeda [nomor] [jam]*\n` +
      `   👉 Menjeda bot untuk nomor tertentu secara manual (contoh: \`!jeda 081234567890 3\`).\n\n` +
      `4. *!handover on* / *!handover off*\n` +
      `   👉 Menyalakan atau mematikan fitur handover pengalihan ke admin.\n\n` +
      `5. *!status*\n` +
      `   👉 Melihat status bot dan daftar pelanggan yang sedang dijeda.`;

    await sendReply(helpText);
    return true;
  }

  return false;
}

module.exports = {
  isOwnerMessage,
  parseOwnerCommand,
  handleOwnerCommand
};
