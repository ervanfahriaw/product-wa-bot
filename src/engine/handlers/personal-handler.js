const db = require('../../db');
const { getConfig } = require('../../config');
const { generateReply } = require('../../ai');
const { splitIntoBubbles, sendMultiBubbleMessages } = require('../bubble-sender');

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

  // Cari kategori berdasarkan kata kunci umum
  let category = 'Lain-lain';
  if (/makan|minum|kopi|lunch|dinner|sarapan|snack|resto|cafe|boba/i.test(lower)) {
    category = 'Makanan & Minuman';
  } else if (/bensin|pertalite|pertamax|parkir|toll|ojol|grab|gojek|transport/i.test(lower)) {
    category = 'Transportasi';
  } else if (/listrik|air|pdam|wifi|pulsa|kuota|indihome|token/i.test(lower)) {
    category = 'Tagihan & Utilitas';
  } else if (/belanja|baju|sepatu|shopee|tokped|lazada|supermarket|indomaret|alfamart/i.test(lower)) {
    category = 'Belanja';
  } else if (/obat|dokter|apotek|vitamin|klinik|sakit/i.test(lower)) {
    category = 'Kesehatan';
  }

  return {
    category,
    amount: baseNum,
    note: text.trim()
  };
}

/**
 * Mengekstrak blok JSON intent yang dihasilkan oleh AI Assistant (jika ada).
 * @param {string} text 
 * @returns {object|null}
 */
function parseAiIntent(text = '') {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*?"intent"[\s\S]*?\}/);
    if (jsonMatch) {
      const rawJson = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(rawJson);
    }
  } catch (_) {}
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

/**
 * Menangani pesan masuk dalam Mode Asisten Personal.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} client 
 */
async function handlePersonalMessage(message, client) {
  const contact = message.from || 'unknown';
  const messageBody = message.body || '';

  try {
    const config = getConfig();

    // 1. Simulasikan jeda manusiawi & status typing untuk anti-banned
    await simulateHumanTyping(message);

    // 2. Dapatkan respons AI dengan RAG context + riwayat chat
    const aiResult = await generateReply({
      message: messageBody,
      mode: 'personal',
      contact
    });

    let finalReply = aiResult.reply || '';
    const aiIntent = parseAiIntent(finalReply);
    const textExtraction = extractExpenseFromText(messageBody);

    // 3. Pemrosesan Pencatatan Pengeluaran
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

    // 4. Pemrosesan Pembuatan Reminder
    if (aiIntent?.intent === 'set_reminder' && aiIntent.trigger_at) {
      db.createReminder({
        message: aiIntent.message || messageBody,
        trigger_at: aiIntent.trigger_at,
        is_recurring: 0,
        sent: 0
      });
      finalReply = `⏰ *Pengingat Disimpan:*\n"${aiIntent.message || messageBody}" pada ${aiIntent.trigger_at}.\nBot akan mengirimkan pesan saat waktunya tiba.`;
    }

    // 5. Pecah pesan panjang menjadi gelembung chat alami & kirim bertahap
    const maxBubbles = Number(config.max_bubbles) || 3;
    const bubbles = splitIntoBubbles(finalReply, maxBubbles);
    await sendMultiBubbleMessages(message, client, contact, bubbles, {
      interBubbleDelay: config.inter_bubble_delay
    });

    // 6. Catat ke tabel chat_logs SQLite
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
