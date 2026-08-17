const db = require('../../db');
const { generateReply } = require('../../ai');

/**
 * Ekstraksi nilai nominal dan kategori pengeluaran dari teks kalimat bebas (Fallback / Rule-based Parser).
 * @param {string} text 
 * @returns {{category: string, amount: number, note: string}|null}
 */
function extractExpenseFromText(text = '') {
  const lower = text.toLowerCase().trim();

  // Pattern pencarian nominal (cth: 20rb, 20.000, 20k, 1jt, 50000)
  const regex = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?(?:\b|$)/i;
  const match = lower.match(regex);

  if (!match) return null;

  let baseNum = parseFloat(match[1].replace(',', '.'));
  const unit = (match[2] || '').toLowerCase();

  if (unit === 'rb' || unit === 'ribu' || unit === 'k') {
    baseNum *= 1000;
  } else if (unit === 'jt' || unit === 'juta') {
    baseNum *= 1000000;
  }

  const amount = Math.round(baseNum);
  if (isNaN(amount) || amount <= 0 || amount > 100000000000) {
    return null;
  }

  // Tentukan kategori dari kata kunci
  let category = 'Lain-lain';
  if (/(makan|minum|kopi|nasi|bakso|ayam|mie|snack|jajan|lunch|dinner|sarapan)/i.test(lower)) {
    category = 'Makan & Minum';
  } else if (/(bensin|bbm|pertalite|pertamax|parkir|tol|ojol|grab|gojek|taksi|kereta|bus)/i.test(lower)) {
    category = 'Transportasi';
  } else if (/(belanja|baju|sepatu|shopee|tokopedia|lazada|mall|supermarket|indomaret|alfamart)/i.test(lower)) {
    category = 'Belanja';
  } else if (/(listrik|air|pdam|wifi|indihome|pulsa|kuota|tagihan|bpjs|sewa|kontrakan)/i.test(lower)) {
    category = 'Tagihan & Utilitas';
  } else if (/(obat|dokter|klinik|apotek|rs|vitamin|sehat)/i.test(lower)) {
    category = 'Kesehatan';
  }

  return {
    category,
    amount,
    note: text.trim()
  };
}

/**
 * Mencoba mengekstrak JSON intent dari balasan AI.
 * @param {string} aiReply 
 * @returns {object|null}
 */
function parseAiIntent(aiReply = '') {
  try {
    const jsonMatch = aiReply.match(/\{[\s\S]*?"intent"[\s\S]*?\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (_) {}
  return null;
}

/**
 * Menangani pesan masuk dalam Mode Asisten Personal.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} client 
 */
async function handlePersonalMessage(message, client) {
  const contact = message.from || 'unknown';
  const messageBody = message.body || '';

  try {
    // 1. Dapatkan respons AI dengan RAG context
    const aiResult = await generateReply({
      message: messageBody,
      mode: 'personal'
    });

    let finalReply = aiResult.reply || '';
    const aiIntent = parseAiIntent(finalReply);
    const textExtraction = extractExpenseFromText(messageBody);

    // 2. Pemrosesan Pencatatan Pengeluaran
    if (aiIntent?.intent === 'record_expense' || (!aiIntent && textExtraction)) {
      const category = aiIntent?.category || textExtraction?.category || 'Lain-lain';
      const amount = Number(aiIntent?.amount || textExtraction?.amount);
      const note = aiIntent?.note || textExtraction?.note || messageBody;

      if (amount > 0 && amount < 100000000000) {
        db.createExpense({ category, amount, note });
        
        // Buat balasan konfirmasi terstruktur jika AI belum menyertakannya
        if (!finalReply.includes(amount.toLocaleString('id-ID')) && !finalReply.includes('Dicatat')) {
          finalReply = `✅ *Pengeluaran Dicatat:*\n- Kategori: ${category}\n- Nominal: Rp${amount.toLocaleString('id-ID')}\n- Catatan: ${note}\n\nData telah tersimpan di rekap keuangan lokal.`;
        } else {
          // Bersihkan blok JSON dari pesan WhatsApp jika ada
          finalReply = finalReply.replace(/```json[\s\S]*?```/g, '').replace(/\{[\s\S]*?"intent"[\s\S]*?\}/g, '').trim();
        }
      }
    }

    // 3. Pemrosesan Pembuatan Reminder
    if (aiIntent?.intent === 'set_reminder' && aiIntent.trigger_at) {
      db.createReminder({
        message: aiIntent.message || messageBody,
        trigger_at: aiIntent.trigger_at,
        is_recurring: 0,
        sent: 0
      });
      finalReply = `⏰ *Pengingat Disimpan:*\n"${aiIntent.message || messageBody}" pada ${aiIntent.trigger_at}.\nBot akan mengirimkan pesan saat waktunya tiba.`;
    }

    // 4. Kirim Balasan ke WhatsApp
    if (typeof message.reply === 'function') {
      await message.reply(finalReply);
    } else if (client && typeof client.sendMessage === 'function') {
      await client.sendMessage(contact, finalReply);
    }

    // 5. Catat ke tabel chat_logs SQLite
    db.createChatLog({
      contact,
      message_in: messageBody,
      message_out: finalReply,
      handled_by: 'ai'
    });

  } catch (err) {
    console.error('[PersonalHandler] Error saat memproses pesan personal:', err.message);
  }
}

module.exports = {
  handlePersonalMessage,
  extractExpenseFromText,
  parseAiIntent
};
