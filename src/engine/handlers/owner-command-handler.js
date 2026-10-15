const db = require('../../db');
const { getConfig, saveConfig } = require('../../config');
const { normalizePhoneNumber, toWhatsAppJid } = require('../../utils/phone');
const { 
  findLidForPhoneNumber, 
  formatIndonesianPhone, 
  findContactByQuery,
  resolveCustomerInfo,
  formatCustomerDisplay 
} = require('../../utils/contact-resolver');

/**
 * Mendaftarkan / memperbarui JID LID akun Owner di database settings dan customer_profiles.
 * @param {string} lid 
 * @param {string} [ownerPhone] 
 */
function registerOwnerLid(lid, ownerPhone = null) {
  if (!lid) return;
  try {
    const config = getConfig();
    const cleanOwner = normalizePhoneNumber(ownerPhone || (db.getSetting ? db.getSetting('owner_phone') : null) || config.owner_phone || '');
    if (db.setSetting) {
      db.setSetting('owner_lid', lid);
    }
    if (cleanOwner && db.upsertCustomerProfile) {
      db.upsertCustomerProfile(lid, {
        phone_number: cleanOwner,
        lid_jid: lid,
        notes: 'Akun WhatsApp Owner / Admin Toko'
      });
      db.upsertCustomerProfile(`${cleanOwner}@c.us`, {
        phone_number: cleanOwner,
        lid_jid: lid,
        notes: 'Akun WhatsApp Owner / Admin Toko'
      });
    }
  } catch (_) {}
}

/**
 * Memeriksa apakah pesan masuk berasal dari nomor Owner / Pemilik Toko.
 * Mendukung format nomor biasa (@c.us), Linked ID WhatsApp modern (@lid), dan auto-registrasi.
 * @param {import('whatsapp-web.js').Message} message 
 * @returns {boolean}
 */
function isOwnerMessage(message) {
  if (!message) return false;
  if (message.isOutgoing === true) return false;
  if (message.isSelfChat === true) return true;
  if (message.fromMe === true) return true;

  const sender = message.from || '';
  const cleanSender = normalizePhoneNumber(sender);
  if (!cleanSender && !sender) return false;

  const config = getConfig();
  const ownerPhone = (db.getSetting ? db.getSetting('owner_phone') : null) || config.owner_phone || '';
  const cleanOwner = normalizePhoneNumber(ownerPhone);

  // 1. Jika nomor HP sender cocok langsung dengan owner_phone
  if (cleanOwner && cleanSender && (cleanSender === cleanOwner || cleanSender.includes(cleanOwner) || cleanOwner.includes(cleanSender))) {
    if (sender.endsWith('@lid')) {
      registerOwnerLid(sender, cleanOwner);
    }
    return true;
  }

  // 2. Cek apakah LID pengirim terdaftar sebagai owner_lid di database settings
  const registeredLid = db.getSetting ? db.getSetting('owner_lid') : null;
  if (registeredLid && (sender === registeredLid || cleanSender === normalizePhoneNumber(registeredLid))) {
    return true;
  }

  // 3. Cek mapping LID di customer_profiles
  if (cleanOwner) {
    const mappedLid = findLidForPhoneNumber(cleanOwner);
    if (mappedLid && (mappedLid === sender || normalizePhoneNumber(mappedLid) === cleanSender)) {
      return true;
    }

    try {
      if (db.db && typeof db.db.prepare === 'function') {
        const row = db.db.prepare(`
          SELECT contact, phone_number, lid_jid FROM customer_profiles 
          WHERE (contact = ? OR lid_jid = ?) AND (phone_number = ? OR contact = ? OR contact LIKE ?)
          LIMIT 1
        `).get(sender, sender, cleanOwner, `${cleanOwner}@c.us`, `%${cleanOwner}%`);
        if (row) {
          registerOwnerLid(sender, cleanOwner);
          return true;
        }
      }
    } catch (_) {}
  }

  // 4. Jika pesan memuat command admin yang valid (misal: !aktifkan, !selesai, !status, !jeda, !handover, !help)
  // dan format sender adalah LID/nomor, kenali sebagai Owner dan auto-daftarkan LID-nya
  if (message.body && typeof message.body === 'string') {
    const trimmed = message.body.trim();
    if (trimmed.startsWith('!') || /^(?:aktifkan|selesai|unpause|jeda|pause|status|list|handover|help|menu)\b/i.test(trimmed)) {
      const parsed = parseOwnerCommand(message.body);
      if (parsed) {
        if (cleanOwner) registerOwnerLid(sender, cleanOwner);
        return true;
      }
    }
  }

  return false;
}

/**
 * Mem-parsing nominal harga dari teks (misal: "150000", "Rp 150.000", "150rb", "150k", "1.5jt").
 * @param {string|number} val 
 * @returns {number}
 */
function parseNominalAmount(val = '') {
  if (!val && val !== 0) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).toLowerCase().trim();
  const match = str.match(/(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?/i);
  if (!match) {
    const numericOnly = parseInt(str.replace(/[^0-9]/g, ''), 10);
    return isNaN(numericOnly) ? 0 : numericOnly;
  }
  
  const rawNumStr = match[1];
  const unit = (match[2] || '').toLowerCase();
  
  let num;
  if (unit) {
    num = parseFloat(rawNumStr.replace(',', '.'));
    if (unit === 'rb' || unit === 'ribu' || unit === 'k') {
      num *= 1000;
    } else if (unit === 'jt' || unit === 'juta') {
      num *= 1000000;
    }
  } else {
    if (/^\d{1,3}(?:\.\d{3})+$/.test(rawNumStr)) {
      num = parseInt(rawNumStr.replace(/\./g, ''), 10);
    } else if (/^\d{1,3}(?:,\d{3})+$/.test(rawNumStr)) {
      num = parseInt(rawNumStr.replace(/,/g, ''), 10);
    } else {
      num = parseFloat(rawNumStr.replace(/\./g, '').replace(',', '.'));
    }
  }
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Mem-parsing form pesanan dari chat WhatsApp Owner/Admin.
 * Mendukung format multi-baris key-value maupun single line !order.
 * @param {string} text 
 * @returns {object|null}
 */
function parseOwnerOrderForm(text = '') {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (!clean) return null;

  // 1. Format Single Line: !order <nomor> <nama> - <pesanan> | <total>
  const oneLineMatch = clean.match(/^!?order\s+([0-9+]+)\s+([^-|\n]+?)\s*[-|:]\s*([^|\n]+)(?:\|?\s*(.*))?$/i);
  if (oneLineMatch) {
    const rawNum = oneLineMatch[1].trim();
    const name = oneLineMatch[2].trim();
    const items = oneLineMatch[3].trim();
    const rawRest = (oneLineMatch[4] || '').trim();
    const cleanNum = normalizePhoneNumber(rawNum);
    const total = parseNominalAmount(rawRest);
    return {
      action: 'create_order_form',
      customer_name: name,
      contact: cleanNum ? `${cleanNum}@c.us` : rawNum,
      rawContact: rawNum,
      order_summary: items,
      total_amount: total,
      notes: 'Dicatat via perintah cepat WhatsApp',
      status: 'pending'
    };
  }

  // 2. Format Multi-Baris Form (misal: "pesanan 1", "nama penerima: ...", "no penerima: ...", dll)
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  let customer_name = '';
  let contact = '';
  let address = '';
  let order_summary = '';
  let total_amount = 0;
  let notes = '';

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const rawKey = line.substring(0, colonIdx).trim().toLowerCase();
      const key = rawKey.replace(/^[-•*#\d.]+\s*/, '').trim();
      let val = line.substring(colonIdx + 1).trim();

      // Cek apakah di baris yang sama terdapat pemisah pipa | (misal: "... | total: 240.000")
      if (val.includes('|')) {
        const pipeParts = val.split('|');
        const mainVal = pipeParts[0].trim();
        const sideVal = pipeParts.slice(1).join('|').trim();
        if (/(?:total|harga|nominal|bayar)\s*[:=]?\s*(.*)/i.test(sideVal)) {
          const totMatch = sideVal.match(/(?:total|harga|nominal|bayar)\s*[:=]?\s*(.*)/i);
          if (totMatch && totMatch[1]) {
            total_amount = parseNominalAmount(totMatch[1]);
          }
        } else if (sideVal) {
          notes = (notes ? notes + ' | ' : '') + sideVal;
        }
        val = mainVal;
      }

      if (/^(nama|nama\s+penerima|penerima|nama\s+customer|nama\s+pembeli|nama\s+pelanggan|atas\s+nama|customer)$/i.test(key)) {
        customer_name = val;
      } else if (/^(no|no\s+penerima|no\s+hp|no\.\s*hp|no\s+wa|no\.\s*wa|nomor|nomor\s+penerima|nomor\s+hp|nomor\s+wa|kontak|no\s+telp|telp|wa|phone)$/i.test(key)) {
        contact = val;
      } else if (/^(alamat|alamat\s+penerima|alamat\s+lengkap|tujuan|alamat\s+kirim|kirim\s+ke)$/i.test(key)) {
        address = val;
      } else if (/^(pesanan|pesan|item|barang|produk|order|orderan|detail\s+pesanan|produk\s+dipesan|pesanan\s*&\s*jumlah|pesanan\s+dan\s+jumlah)$/i.test(key)) {
        order_summary = val;
      } else if (/^(total|total\s+harga|total\s+bayar|harga|nominal|biaya|omset|jumlah\s+bayar)$/i.test(key)) {
        total_amount = parseNominalAmount(val);
      } else if (/^(catatan|note|keterangan|notes|kurir|ekspedisi)$/i.test(key)) {
        notes = val;
      }
    }
  }



  // Jika order_summary belum terisi dari key eksplisit, cari dari kalimat obrolan di pesan
  if (!order_summary) {
    const qtyProdMatch = clean.match(/(?:untuk\s+)?(\d+\s*(?:cup|pasang|ekor|pcs|botol|paket|item|box|pax|buah|biji)?\s+[^,\n.!?]+?)(?:\s+totalnya|\s+total|\s*jadi|\s*sebesar|\s*\(|\n|$)/i);
    if (qtyProdMatch && qtyProdMatch[1]) {
      order_summary = qtyProdMatch[1].trim();
    } else {
      try {
        const allProds = db.getAllProducts ? db.getAllProducts() : [];
        for (const p of allProds) {
          if (p.name && clean.toLowerCase().includes(p.name.toLowerCase())) {
            order_summary = p.name;
            break;
          }
        }
      } catch (_) {}
    }
  }

  // Jika total_amount belum terisi, cari dari kalimat nominal di pesan (misal: "totalnya jadi Rp40.000")
  if (!total_amount) {
    const totMatch = clean.match(/(?:totalnya\s+(?:jadi\s+)?|total\s+(?:bayar\s+)?|sebesar\s+|seharga\s+)(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta)?)/i);
    if (totMatch && totMatch[1]) {
      total_amount = parseNominalAmount(totMatch[1]);
    }
  }

  // Validasi kecukupan informasi order
  if ((customer_name && contact) || (contact && order_summary) || (customer_name && order_summary)) {
    const cleanPhone = normalizePhoneNumber(contact);
    const resolvedContact = cleanPhone ? `${cleanPhone}@c.us` : (contact || '');

    let fullNotes = '';
    if (address) fullNotes += `Alamat: ${address}`;
    if (notes) fullNotes += (fullNotes ? ' | ' : '') + `Catatan: ${notes}`;

    return {
      action: 'create_order_form',
      customer_name: customer_name || 'Pelanggan',
      contact: resolvedContact,
      rawContact: contact,
      order_summary: order_summary || 'Pesanan Produk',
      total_amount: total_amount || 0,
      notes: fullNotes || null,
      status: 'pending'
    };
  }


  return null;
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

  // 0. Periksa apakah pesan adalah format form pesanan
  const orderForm = parseOwnerOrderForm(text);
  if (orderForm) {
    return orderForm;
  }

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

  // 3. Perintah Unpause / Selesai: !aktifkan [target], !unpause [target], !selesai [target], !resume [target], !done
  const unpausePrefixMatch = trimmed.match(/^!?(?:aktifkan|unpause|selesai|resume|done|buka\s+bot)\b\s*(.*)$/i);
  if (unpausePrefixMatch) {
    const rest = unpausePrefixMatch[1].trim();
    if (rest && !/^(?:bot|sekarang|ya|dong|dulu)$/i.test(rest)) {
      return { action: 'unpause', targetQuery: rest };
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

  // AKSI 0: Input Form Pesanan Otomatis dari Owner
  if (parsed.action === 'create_order_form') {
    try {
      const newOrderId = db.createOrder({
        contact: parsed.contact,
        customer_name: parsed.customer_name,
        order_summary: parsed.order_summary,
        total_amount: parsed.total_amount || 0,
        status: parsed.status || 'pending',
        notes: parsed.notes
      });

      // Update CRM Profile Pelanggan jika nama & kontak tersedia
      if (db.upsertCustomerProfile && parsed.contact) {
        try {
          db.upsertCustomerProfile(parsed.contact, {
            customer_name: parsed.customer_name,
            customer_status: 'loyal'
          });
        } catch (_) {}
      }

      const cleanPhone = normalizePhoneNumber(parsed.contact) || parsed.rawContact || '-';
      const prettyPhone = formatIndonesianPhone(cleanPhone) || cleanPhone;
      const formattedTotal = Number(parsed.total_amount || 0) > 0 
        ? `Rp${Number(parsed.total_amount).toLocaleString('id-ID')}`
        : 'Rp0 (Belum Diatur)';

      let replyMsg = `✅ *[PESANAN BERHASIL DICATAT]*\n\n` +
        `Pesanan pelanggan telah otomatis tersimpan ke Dashboard Orders:\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 *ID Pesanan:* #${newOrderId}\n` +
        `👤 *Pelanggan:* ${parsed.customer_name}\n` +
        `📱 *No. WhatsApp:* ${prettyPhone}\n` +
        `🛒 *Pesanan:* ${parsed.order_summary}\n`;

      if (parsed.notes) {
        replyMsg += `📍 *${parsed.notes}*\n`;
      }

      replyMsg += `💰 *Total:* ${formattedTotal}\n` +
        `📌 *Status:* PENDING\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `_Buka Web Dashboard untuk update status/resi atau melacak pengiriman._`;

      await sendReply(replyMsg);
      console.log(`[OwnerCommandHandler] Sukses membuat order #${newOrderId} untuk ${parsed.customer_name} (${parsed.contact}) via pesan WhatsApp.`);
      return true;
    } catch (err) {
      console.error('[OwnerCommandHandler] Gagal menyimpan pesanan:', err.message);
      await sendReply(`❌ *[GAGAL MENCATAT PESANAN]*\n\nTerjadi kesalahan saat menyimpan pesanan ke database: ${err.message}`);
      return true;
    }
  }

  // AKSI 1: Unpause / Aktifkan kembali bot untuk target tertentu (Nama / No. HP / LID)
  if (parsed.action === 'unpause') {
    const query = parsed.targetQuery || parsed.targetNumber || '';
    const resolvedJid = findContactByQuery(query) || query;
    const cleanNum = normalizePhoneNumber(resolvedJid) || normalizePhoneNumber(query);
    const target = cleanNum || query;
    const targetJid = toWhatsAppJid(target);

    // Unpause semua variasi format JID
    db.resumeContact(targetJid);
    db.resumeContact(resolvedJid);
    db.resumeContact(target);
    if (cleanNum) {
      db.resumeContact(`${cleanNum}@c.us`);
      db.resumeContact(`${cleanNum}@lid`);
    }

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
      db.resolveHandoverByContact(resolvedJid);
      if (cleanNum) {
        db.resolveHandoverByContact(`${cleanNum}@c.us`);
        db.resolveHandoverByContact(`${cleanNum}@lid`);
      }
    }

    const customerInfo = await resolveCustomerInfo(null, resolvedJid || target);
    const display = customerInfo.formattedDisplay || target;
    const replyMsg = `✅ *[BOT DIAKTIFKAN KEMBALI]*\n\n` +
      `Bot WhatsApp telah *DIAKTIFKAN* kembali untuk: *${display}*.\n` +
      `Tiket handover ditandai *Selesai*. Pesan berikutnya dari pelanggan ini akan langsung dijawab otomatis oleh AI.`;

    await sendReply(replyMsg);
    console.log(`[OwnerCommandHandler] Sukses mengaktifkan bot untuk ${display} via perintah WhatsApp.`);
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

    const customerInfo = await resolveCustomerInfo(null, targetItem.contact);
    const display = customerInfo.formattedDisplay || (cleanNum ? formatIndonesianPhone(cleanNum) : targetItem.contact);

    const replyMsg = `✅ *[TIKET SELESAI & BOT DIAKTIFKAN]*\n\n` +
      `Bot WhatsApp telah *DIAKTIFKAN* kembali untuk pelanggan: *${display}*.\n` +
      `Status jeda telah dilepas. Bot kembali melayani pelanggan ini secara otomatis.${extraNote}`;

    await sendReply(replyMsg);
    console.log(`[OwnerCommandHandler] Sukses unpause kontak ${targetItem.contact} (${display}).`);
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
      `1. *Catat Form Pesanan Otomatis:*\n` +
      `   nama penerima : Budi\n` +
      `   no penerima : 08123456789\n` +
      `   alamat : Jl. Merdeka 10\n` +
      `   pesanan : 2 pasang albino koi\n` +
      `   total : 150rb\n\n` +
      `2. *!aktifkan [nomor]* atau *!selesai [nomor]*\n` +
      `   👉 Mengaktifkan kembali bot & menyelesaikan tiket handover untuk pelanggan tersebut.\n\n` +
      `3. *!selesai* atau *!aktifkan*\n` +
      `   👉 Mengaktifkan bot untuk pelanggan terakhir yang sedang dijeda.\n\n` +
      `4. *!jeda [nomor] [jam]*\n` +
      `   👉 Menjeda bot untuk nomor tertentu secara manual (contoh: \`!jeda 081234567890 3\`).\n\n` +
      `5. *!handover on* / *!handover off*\n` +
      `   👉 Menyalakan atau mematikan fitur handover pengalihan ke admin.\n\n` +
      `6. *!status*\n` +
      `   👉 Melihat status bot dan daftar pelanggan yang sedang dijeda.`;

    await sendReply(helpText);
    return true;
  }

  return false;
}

module.exports = {
  isOwnerMessage,
  parseOwnerCommand,
  parseOwnerOrderForm,
  parseNominalAmount,
  handleOwnerCommand
};

