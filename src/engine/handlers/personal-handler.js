const db = require('../../db');
const { getConfig } = require('../../config');
const ai = require('../../ai');
const { splitIntoBubbles, sendMultiBubbleMessages } = require('../bubble-sender');
const { normalizeCategory, isSameCategory } = require('../../utils/categories');
const { detectPreferenceUpdatesFromText, saveUserPreferences } = require('../../utils/user-preferences');

/**
 * Ekstraksi nilai nominal dan kategori pengeluaran dari teks kalimat bebas (Fallback / Rule-based Parser).
 * Dilengkapi exclusion guard agar perubahan budget / penghapusan / percakapan tidak keliru dicatat sebagai transaksi baru.
 * @param {string} text 
 * @returns {{category: string, amount: number, note: string}|null}
 */
function extractExpenseFromText(text = '') {
  const lower = text.toLowerCase().trim();

  // 1. Exclusion Guards: Jangan ekstrak jika ini adalah perintah non-transaksi, komplain, curhat, negasi, musibah, atau pertanyaan
  if (/(?:budget|anggaran|limit|batas|pindah|recategorize|hapus|delete|batalkan|koreksi|ubah|salah|goal|target|tugas|todo|catat|note|jurnal|diary|curhat|carita|cerita|reminder|ingatkan|tunda|snooze|katanya|kenapa|kok|sisa|berapa|sudah di|dari\s+\d+|jadi\s+\d+|set\s+ke|di\s+set|atur\s+ke|malah|hanya\s+minta|masukan\s+ke|tebisa|teu\s+bisa|ga\s+bisa|gak\s+bisa|ngga\s+bisa|tidak\s+bisa|belum|can\s+dibayar|teu\s+boga|ga\s+ada\s+duit|dipenta|ditagih|utang|hutang|pinjam|nginjeum|cilaka|kacilakaan|kecelakaan|tabrakan|nabrak|darurat|rusak|bocor|gugup|baper|stres|stress|kesal|marah|sia|anying|anjing|goblok|teu\s+guna|apa\s+itu|artinya)/i.test(lower)) {
    return null;
  }

  // 2. Pattern pencarian nominal (cth: 20rb, 20.000, 20k, 1jt, 50000, 20 k)
  const regex = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?(?:\b|$)/i;
  const match = lower.match(regex);
  if (!match) return null;

  // 3. Pastikan ada kata transaksi / pengeluaran atau kata kunci kategori yang dikenali
  const hasTransactionVerb = /(?:beli|meuli|bayar|mayar|keluar|habis|sewa|nyewa|topup|tf|transfer|jajan|ngopi|makan|minum|dahar|sarapan|lunch|dinner|tambal|tambal\s+ban|isi\s+bensin|bensin|pertalite|pertamax|parkir|ojol|grab|gojek|ongkir|ongkos|servis|service|ganti\s+oli|belanja|pesan|order|tiket|tagihan|iuran|bpjs|listrik|pulsa|kuota|wifi|obat|vitamin|dokter|gym|buku|kaos|sepatu)/i.test(lower);

  // Jika tidak ada kata aksi transaksi atau kalimat terlalu panjang (> 10 kata), jangan diekstrak otomatis
  if (!hasTransactionVerb || lower.split(/\s+/).length > 10) {
    return null;
  }

  let baseNum = parseFloat(match[1].replace(',', '.'));
  const unit = (match[2] || '').toLowerCase().trim();

  if (unit === 'rb' || unit === 'ribu' || unit === 'k') {
    baseNum *= 1000;
  } else if (unit === 'jt' || unit === 'juta') {
    baseNum *= 1000000;
  }

  const category = normalizeCategory(lower);

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

    // 1. Deteksi & simpan preferensi panggilan/nama secara otomatis
    detectPreferenceUpdatesFromText(messageBody);

    // 2. Simulasikan jeda manusiawi & status typing untuk anti-banned
    await simulateHumanTyping(message);

    // 3. Dapatkan respons AI dengan RAG context + riwayat chat
    const aiResult = await ai.generateReply({
      message: messageBody,
      mode: 'personal',
      contact
    });

    let finalReply = aiResult.reply || '';
    const aiIntent = parseAiIntent(finalReply);
    const textExtraction = extractExpenseFromText(messageBody);

    // 4. Update preferensi jika ada intent AI
    if (aiIntent?.intent === 'set_user_preference') {
      saveUserPreferences({
        userName: aiIntent.user_name || aiIntent.call_user_as,
        callUserAs: aiIntent.call_user_as || aiIntent.user_name,
        assistantName: aiIntent.assistant_name,
        disallowKak: Boolean(aiIntent.disallow_kak)
      });
    }

    // 5. Pemrosesan Pencatatan Pengeluaran Baru
    if (aiIntent?.intent === 'record_expense' || (!aiIntent && textExtraction)) {
      // Guard: Pastikan bukan cerita musibah / negasi / belum bayar / curhat
      const isNegatedOrStory = /(?:tebisa|teu\s+bisa|ga\s+bisa|gak\s+bisa|tidak\s+bisa|belum|can\s+dibayar|teu\s+boga|ga\s+ada\s+duit|dipenta|ditagih|utang|hutang|pinjam|nginjeum|cilaka|kacilakaan|kecelakaan|tabrakan|nabrak|darurat|bocor)/i.test(messageBody);

      if (!isNegatedOrStory) {
        const rawCategory = aiIntent?.category || textExtraction?.category || 'Lain-lain';
        const category = normalizeCategory(rawCategory);
        const amount = Number(aiIntent?.amount || textExtraction?.amount);
        const note = aiIntent?.note || textExtraction?.note || messageBody;

        if (amount > 0 && amount < 100000000000) {
          db.createExpense({ category, amount, note });
          
          // Buat balasan konfirmasi terstruktur jika AI belum menyertakannya
          if (!finalReply.includes(amount.toLocaleString('id-ID')) && !finalReply.includes('Dicatat')) {
            finalReply = `✅ *Pengeluaran Dicatat:*\n- Kategori: ${category}\n- Nominal: Rp${amount.toLocaleString('id-ID')}\n- Catatan: ${note}\n\nData telah tersimpan di rekap keuangan lokal.`;
          }
        }
      }
    }

    // 6. Pemrosesan Rekategorisasi / Pindah Pengeluaran
    if (aiIntent?.intent === 'recategorize_expense') {
      const fromCat = aiIntent.from_category || aiIntent.from || '';
      const toCat = aiIntent.to_category || aiIntent.to || '';

      if (fromCat && toCat && db.recategorizeExpenses) {
        const result = db.recategorizeExpenses(fromCat, toCat);
        if (result.affected > 0) {
          finalReply = `🔄 *Kategori Pengeluaran Dipindahkan:*\n- Dari: *${result.from}*\n- Menjadi: *${result.to}*\n- Transaksi disesuaikan: ${result.affected} catatan\n\nRekap keuangan & budget telah diperbarui! ✨`;
        } else {
          finalReply = `ℹ️ Tidak menemukan transaksi pengeluaran lama pada kategori "${fromCat}". Kategori target "${normalizeCategory(toCat)}" sudah siap digunakan!`;
        }
      }
    }

    // 7. Pemrosesan Hapus Pengeluaran / Undo
    if (aiIntent?.intent === 'delete_expense' || aiIntent?.intent === 'undo_expense') {
      let deleted = null;
      if (aiIntent.amount || aiIntent.keyword || aiIntent.category) {
        const res = db.deleteExpenseByKeywordOrAmount({
          amount: aiIntent.amount,
          keyword: aiIntent.keyword,
          category: aiIntent.category
        });
        if (res.success && res.deletedExpenses.length > 0) {
          deleted = res.deletedExpenses[0];
        }
      } else if (db.deleteLastExpense) {
        const res = db.deleteLastExpense();
        if (res.success) deleted = res.deletedExpense;
      }

      if (deleted) {
        finalReply = `🗑️ *Pengeluaran Berhasil Dihapus:*\n- Kategori: ${deleted.category}\n- Nominal: Rp${Number(deleted.amount).toLocaleString('id-ID')}\n- Catatan: ${deleted.note || '-'}\n\nRekap keuangan telah diperbarui.`;
      } else {
        finalReply = '❌ Tidak menemukan transaksi pengeluaran yang sesuai untuk dihapus.';
      }
    }

    // 8. Pemrosesan Koreksi / Edit Pengeluaran
    if (aiIntent?.intent === 'edit_expense') {
      const last = db.getLastExpense ? db.getLastExpense() : null;
      if (last && db.updateExpense) {
        db.updateExpense(last.id, {
          category: aiIntent.new_category || last.category,
          amount: aiIntent.new_amount || last.amount,
          note: aiIntent.new_note || last.note
        });
        const updatedAmt = aiIntent.new_amount || last.amount;
        const updatedCat = aiIntent.new_category ? normalizeCategory(aiIntent.new_category) : last.category;
        finalReply = `✏️ *Pengeluaran Berhasil Dikoreksi:*\n- Kategori: ${updatedCat}\n- Nominal: Rp${Number(updatedAmt).toLocaleString('id-ID')}\n- Catatan: ${aiIntent.new_note || last.note}\n\nData telah disesuaikan di database! 👍`;
      } else {
        finalReply = '❌ Tidak ada catatan pengeluaran sebelumnya yang bisa dikoreksi.';
      }
    }

    // 4. Pemrosesan Pembuatan Reminder (satu kali DAN berulang)
    if (aiIntent?.intent === 'set_reminder' && (aiIntent.trigger_at || aiIntent.event_date)) {
      const recurrenceType = aiIntent.recurrence_type || null;
      const reminderLabel = aiIntent.message || aiIntent.title || messageBody;
      const triggerTime = aiIntent.trigger_at || aiIntent.event_date;
      
      db.createReminder({
        message: reminderLabel,
        trigger_at: triggerTime,
        is_recurring: recurrenceType ? 1 : 0,
        sent: 0,
        label: reminderLabel.toLowerCase().substring(0, 100),
        recurrence_type: recurrenceType
      });

      if (recurrenceType) {
        const typeLabel = recurrenceType === 'daily' ? 'setiap hari' 
          : recurrenceType === 'weekly' ? 'setiap minggu' : 'setiap bulan';
        const timeOnly = triggerTime.substring(11, 16);
        finalReply = `⏰ *Pengingat Berulang Disimpan:*\n🔄 "${reminderLabel}" — ${typeLabel} jam ${timeOnly}\nMulai: ${triggerTime}\n\nBot akan mengirimkan pesan secara ${typeLabel} pada waktu yang ditentukan.`;
      } else {
        finalReply = `⏰ *Pengingat Disimpan:*\n"${reminderLabel}" pada ${triggerTime}.\nBot akan mengirimkan pesan pengingat ke WhatsApp saat waktunya tiba! 🔔`;
      }
    }

    // 5. Daftar Reminder Aktif
    if (aiIntent?.intent === 'list_reminders') {
      const activeList = db.getActiveReminders ? db.getActiveReminders() : [];
      
      if (activeList.length === 0) {
        finalReply = '📋 Kamu belum punya pengingat aktif saat ini. Mau buat pengingat baru?';
      } else {
        const lines = activeList.map((r, i) => {
          const type = r.recurrence_type 
            ? (r.recurrence_type === 'daily' ? '🔄 Harian' : r.recurrence_type === 'weekly' ? '🔄 Mingguan' : '🔄 Bulanan')
            : '🔔 Satu Kali';
          const status = r.snoozed_until ? ' ⏸️ (ditunda)' : '';
          return `${i + 1}. "${r.message}" — ${r.trigger_at} — ${type}${status}`;
        });
        finalReply = `📋 *Daftar Pengingat Aktif (${activeList.length}):*\n\n${lines.join('\n')}\n\n_Untuk membatalkan, chat: "batalkan reminder [nama]"_`;
      }
    }

    // 6. Batalkan Reminder
    if (aiIntent?.intent === 'cancel_reminder' && aiIntent.label) {
      const result = db.cancelReminderByLabel ? db.cancelReminderByLabel(aiIntent.label) : { cancelled: 0 };
      
      if (result.cancelled > 0) {
        finalReply = `✅ Pengingat "${result.reminder.message}" berhasil dibatalkan.`;
      } else {
        finalReply = `❌ Tidak menemukan pengingat aktif yang cocok dengan "${aiIntent.label}". Coba cek daftar reminder dengan chat "daftar reminder".`;
      }
    }

    // 7. Snooze / Tunda Reminder
    if (aiIntent?.intent === 'snooze_reminder') {
      const duration = Number(aiIntent.duration_minutes) || 30;
      
      // Cari reminder terakhir yang dikirim (konteks snooze)
      const lastSent = db.getLastSentReminder ? db.getLastSentReminder() : null;
      
      if (lastSent) {
        db.snoozeReminder(lastSent.id, duration);
        finalReply = `⏸️ Pengingat "${lastSent.message}" ditunda selama ${duration} menit. Aku akan ingatkan lagi nanti ya!`;
      } else {
        finalReply = `❌ Tidak ada pengingat terakhir yang bisa ditunda. Coba buat pengingat baru ya!`;
      }
    }

    // ========== NOTES (Catatan Cepat) ==========

    // 8. Simpan Catatan (Hanya jika bukan umpatan / keluhan / pertanyaan definisi)
    if (aiIntent?.intent === 'save_note') {
      const isInsultOrComplaint = /(?:teu\s+guna|goblok|anjing|anying|sia|kampret|bangsat|tai|bego|tolol|muka\s+kamu|apa\s+itu|artinya)/i.test(messageBody);
      if (!isInsultOrComplaint) {
        const title = aiIntent.title || null;
        const content = aiIntent.content || messageBody;
        const tags = aiIntent.tags || null;

        if (content && content.trim()) {
          db.createNote({ title, content, tags });
          finalReply = `📝 *Catatan Disimpan:*\n${title ? `📌 "${title}"\n` : ''}${content}\n${tags ? `🏷️ Tags: ${tags}` : ''}\n\n_Chat "daftar catatan" untuk lihat semua._`;
        }
      }
    }

    // 9. Cari Catatan
    if (aiIntent?.intent === 'search_note' && aiIntent.keyword) {
      const results = db.searchNotes ? db.searchNotes(aiIntent.keyword) : [];

      if (results.length === 0) {
        finalReply = `🔍 Tidak menemukan catatan dengan kata kunci "${aiIntent.keyword}". Coba kata kunci lain ya.`;
      } else {
        const lines = results.map((n, i) => {
          const title = n.title || '(tanpa judul)';
          return `${i + 1}. 📌 *${title}*\n   ${n.content}${n.tags ? `\n   🏷️ ${n.tags}` : ''}`;
        });
        finalReply = `🔍 *Hasil Pencarian "${aiIntent.keyword}":*\n\n${lines.join('\n\n')}`;
      }
    }

    // 10. Daftar Catatan
    if (aiIntent?.intent === 'list_notes') {
      const allNotes = db.getAllNotes ? db.getAllNotes(20) : [];

      if (allNotes.length === 0) {
        finalReply = '📝 Belum ada catatan. Coba chat "catat: [isi catatan]" untuk mulai menyimpan.';
      } else {
        const lines = allNotes.map((n, i) => {
          const title = n.title || '(tanpa judul)';
          const preview = n.content.length > 50 ? n.content.substring(0, 50) + '...' : n.content;
          return `${i + 1}. 📌 *${title}* — ${preview}`;
        });
        finalReply = `📝 *Daftar Catatan (${allNotes.length}):*\n\n${lines.join('\n')}\n\n_Chat "cari catatan [keyword]" untuk mencari._`;
      }
    }

    // 11. Hapus Catatan
    if (aiIntent?.intent === 'delete_note' && aiIntent.keyword) {
      const result = db.deleteNoteByKeyword ? db.deleteNoteByKeyword(aiIntent.keyword) : { deleted: 0 };

      if (result.deleted > 0) {
        finalReply = `🗑️ Catatan "${result.note.title || result.note.content.substring(0, 30)}" berhasil dihapus.`;
      } else {
        finalReply = `❌ Tidak menemukan catatan yang cocok dengan "${aiIntent.keyword}".`;
      }
    }

    // ========== TODOS (Daftar Tugas) ==========

    // 12. Tambah Tugas
    if (aiIntent?.intent === 'add_todo') {
      const task = aiIntent.task || messageBody;
      const priority = aiIntent.priority || 'normal';
      const dueDate = aiIntent.due_date || null;

      if (task && task.trim()) {
        db.createTodo({ task, priority, due_date: dueDate });
        const prioEmoji = priority === 'urgent' ? '🔴 Urgent' : priority === 'low' ? '🔵 Rendah' : '⚪ Normal';
        finalReply = `✅ *Tugas Ditambahkan:*\n☐ ${task}\n📊 Prioritas: ${prioEmoji}${dueDate ? `\n📅 Deadline: ${dueDate}` : ''}\n\n_Chat "daftar tugas" untuk lihat semua._`;
      }
    }

    // 13. Selesaikan Tugas
    if (aiIntent?.intent === 'complete_todo' && aiIntent.keyword) {
      const result = db.completeTodoByKeyword ? db.completeTodoByKeyword(aiIntent.keyword) : { completed: 0 };

      if (result.completed > 0) {
        finalReply = `☑️ *Tugas Selesai:*\n✅ ~~${result.todo.task}~~\n\nGood job! 👏`;
      } else {
        finalReply = `❌ Tidak menemukan tugas aktif yang cocok dengan "${aiIntent.keyword}". Coba chat "daftar tugas" untuk lihat tugas yang belum selesai.`;
      }
    }

    // 14. Daftar Tugas
    if (aiIntent?.intent === 'list_todos') {
      const activeTodos = db.getActiveTodos ? db.getActiveTodos() : [];

      if (activeTodos.length === 0) {
        finalReply = '📋 Tidak ada tugas aktif saat ini. Semua beres! 🎉\n\n_Chat "tugas: [nama tugas]" untuk menambah._';
      } else {
        const lines = activeTodos.map((t, i) => {
          const prio = t.priority === 'urgent' ? '🔴' : t.priority === 'low' ? '🔵' : '⚪';
          const due = t.due_date ? ` 📅 ${t.due_date}` : '';
          return `${i + 1}. ${prio} ☐ ${t.task}${due}`;
        });
        finalReply = `📋 *Daftar Tugas Aktif (${activeTodos.length}):*\n\n${lines.join('\n')}\n\n_Chat "selesai [nama tugas]" untuk mencentang._`;
      }
    }

    // 15. Hapus Tugas
    if (aiIntent?.intent === 'delete_todo' && aiIntent.keyword) {
      const result = db.deleteTodoByKeyword ? db.deleteTodoByKeyword(aiIntent.keyword) : { deleted: 0 };

      if (result.deleted > 0) {
        finalReply = `🗑️ Tugas "${result.todo.task}" berhasil dihapus.`;
      } else {
        finalReply = `❌ Tidak menemukan tugas yang cocok dengan "${aiIntent.keyword}".`;
      }
    }

    // ========== BUDGET PLANNER ==========

    // 16. Set Budget
    if (aiIntent?.intent === 'set_budget' && aiIntent.category && aiIntent.monthly_limit) {
      const category = normalizeCategory(aiIntent.category);
      const limit = Number(aiIntent.monthly_limit);
      const alertPercent = Number(aiIntent.alert_at_percent) || 80;

      if (limit > 0 && db.setBudget) {
        db.setBudget({ category, monthly_limit: limit, alert_at_percent: alertPercent });
        finalReply = `💰 *Budget Diatur:*\n📊 Kategori: *${category}*\n💵 Batas: Rp${limit.toLocaleString('id-ID')} / bulan\n🔔 Alert di: ${alertPercent}%\n\n_Kamu akan diperingatkan saat pengeluaran mendekati batas._`;
      }
    }

    // 17. Cek Budget Status
    if (aiIntent?.intent === 'check_budget' || aiIntent?.intent === 'list_budgets') {
      const { getAllBudgetStatus } = require('../budget-checker');
      const statuses = getAllBudgetStatus();

      if (statuses.length === 0) {
        finalReply = '💰 Belum ada budget yang diatur. Chat "budget makan 2 juta" untuk mulai atur anggaran.';
      } else {
        // Filter by specific category if provided
        let filtered = statuses;
        if (aiIntent.category && aiIntent.intent === 'check_budget') {
          filtered = statuses.filter(s => isSameCategory(s.category, aiIntent.category));
        }

        if (filtered.length === 0) {
          const normQuery = normalizeCategory(aiIntent.category);
          finalReply = `❌ Tidak ada budget untuk kategori "${normQuery}". Coba atur dengan chat "budget ${normQuery} [jumlah]".`;
        } else {
          const lines = filtered.map((s, i) => {
            const statusIcon = s.status === 'over' ? '🔴' : s.status === 'warning' ? '🟡' : '🟢';
            return `${i + 1}. ${statusIcon} *${s.category}*\n   Rp${s.spent.toLocaleString('id-ID')} / Rp${s.monthly_limit.toLocaleString('id-ID')} (${s.percent}%)\n   Sisa: Rp${Math.max(0, s.remaining).toLocaleString('id-ID')} · ${s.daysLeft} hari lagi`;
          });
          finalReply = `💰 *Status Budget Bulan Ini:*\n\n${lines.join('\n\n')}`;
        }
      }
    }

    // 18. Hapus Budget
    if (aiIntent?.intent === 'delete_budget' && aiIntent.category) {
      const budget = db.getBudgetByCategory ? db.getBudgetByCategory(aiIntent.category) : null;
      if (budget) {
        db.deleteBudget(budget.id);
        let transferMsg = '';
        const moveToCat = aiIntent.move_to_category || aiIntent.move_to;
        if (moveToCat && db.recategorizeExpenses) {
          const recat = db.recategorizeExpenses(budget.category, moveToCat);
          transferMsg = `\n🔄 Pengeluaran sebelumnya (${recat.affected} transaksi) telah dialihkan ke kategori *${recat.to}*.`;
        }
        finalReply = `🗑️ Budget "${budget.category}" (Rp${budget.monthly_limit.toLocaleString('id-ID')}/bulan) berhasil dihapus.${transferMsg}`;
      } else {
        finalReply = `❌ Tidak menemukan budget untuk kategori "${aiIntent.category}".`;
      }
    }

    // ========== KALKULATOR CEPAT ==========

    // 19. Kalkulator
    if (aiIntent?.intent === 'calculate') {
      const result = aiIntent.result !== undefined ? Number(aiIntent.result) : null;
      const explanation = aiIntent.explanation || '';
      
      if (result !== null && !isNaN(result)) {
        finalReply = `🔢 *Hasil Perhitungan:*\n${explanation}\n\n💡 = *Rp${result.toLocaleString('id-ID')}*`;
      } else if (explanation) {
        finalReply = `🔢 ${explanation}`;
      }
    }

    // Budget Warning Check: setelah pencatatan expense, cek apakah mendekati budget
    if (aiIntent?.intent === 'record_expense' && aiIntent.category) {
      try {
        const { checkBudgetAfterExpense } = require('../budget-checker');
        const warning = await checkBudgetAfterExpense(aiIntent.category, client, contact);
        if (warning) {
          // Append warning setelah konfirmasi expense
          finalReply += '\n\n' + warning;
        }
      } catch (_) {}
    }

    // ========== HABIT TRACKER ==========

    // 20. Buat Kebiasaan Baru
    if (aiIntent?.intent === 'create_habit' && aiIntent.name) {
      const frequency = aiIntent.frequency || 'daily';
      if (db.createHabit) {
        db.createHabit({ name: aiIntent.name, frequency });
        const freqLabel = frequency === 'weekly' ? 'mingguan' : 'harian';
        finalReply = `🎯 *Kebiasaan Baru Ditambahkan:*\n📌 "${aiIntent.name}"\n🔄 Frekuensi: ${freqLabel}\n\n_Chat "sudah ${aiIntent.name}" setiap kali kamu selesai untuk check-in!_`;
      }
    }

    // 21. Check-in Kebiasaan
    if (aiIntent?.intent === 'checkin_habit' && aiIntent.keyword) {
      const habit = db.findHabitByName ? db.findHabitByName(aiIntent.keyword) : null;
      
      if (!habit) {
        finalReply = `❌ Tidak menemukan kebiasaan yang cocok dengan "${aiIntent.keyword}". Chat "daftar habit" untuk lihat daftar.`;
      } else if (db.hasCheckedInToday && db.hasCheckedInToday(habit.id)) {
        const streak = db.calculateStreak ? db.calculateStreak(habit.id) : { current: 0, best: 0 };
        finalReply = `✅ Kamu sudah check-in "${habit.name}" hari ini!\n🔥 Streak: ${streak.current} hari`;
      } else {
        db.logHabitCheckin(habit.id);
        const streak = db.calculateStreak ? db.calculateStreak(habit.id) : { current: 0, best: 0 };
        db.updateStreak(habit.id, streak.current, streak.best);
        
        let motivasi = '';
        if (streak.current >= 30) motivasi = '\n\n🏆 *LUAR BIASA!* 30+ hari berturut-turut! Kamu legend!';
        else if (streak.current >= 14) motivasi = '\n\n🌟 *2 minggu konsisten!* Terus pertahankan!';
        else if (streak.current >= 7) motivasi = '\n\n🎉 *1 minggu penuh!* Great job!';
        else if (streak.current >= 3) motivasi = '\n\n💪 Momentum bagus! Keep it up!';
        
        finalReply = `✅ *Check-in Berhasil:*\n📌 "${habit.name}"\n🔥 Streak: *${streak.current} hari* berturut-turut\n🏅 Best: ${streak.best} hari${motivasi}`;
      }
    }

    // 22. Status Kebiasaan
    if (aiIntent?.intent === 'habit_status') {
      const activeHabits = db.getActiveHabits ? db.getActiveHabits() : [];
      
      if (activeHabits.length === 0) {
        finalReply = '🎯 Belum ada kebiasaan. Chat "habit olahraga setiap hari" untuk mulai tracking.';
      } else {
        let filtered = activeHabits;
        if (aiIntent.keyword) {
          filtered = activeHabits.filter(h => h.name.toLowerCase().includes(aiIntent.keyword.toLowerCase()));
        }

        const lines = filtered.map((h, i) => {
          const streak = db.calculateStreak ? db.calculateStreak(h.id) : { current: 0, best: 0 };
          const checkedToday = db.hasCheckedInToday ? db.hasCheckedInToday(h.id) : false;
          const weekCount = db.getCheckinCount ? db.getCheckinCount(h.id, 7) : 0;
          const todayIcon = checkedToday ? '✅' : '☐';
          return `${i + 1}. ${todayIcon} *${h.name}*\n   🔥 Streak: ${streak.current} hari | Best: ${streak.best}\n   📊 7 hari terakhir: ${weekCount}x check-in`;
        });
        finalReply = `🎯 *Status Kebiasaan:*\n\n${lines.join('\n\n')}`;
      }
    }

    // 23. Daftar Kebiasaan
    if (aiIntent?.intent === 'list_habits') {
      const activeHabits = db.getActiveHabits ? db.getActiveHabits() : [];
      
      if (activeHabits.length === 0) {
        finalReply = '🎯 Belum ada kebiasaan. Chat "habit olahraga" untuk mulai tracking!';
      } else {
        const lines = activeHabits.map((h, i) => {
          const checkedToday = db.hasCheckedInToday ? db.hasCheckedInToday(h.id) : false;
          const todayIcon = checkedToday ? '✅' : '☐';
          const streak = db.calculateStreak ? db.calculateStreak(h.id) : { current: 0, best: 0 };
          return `${i + 1}. ${todayIcon} ${h.name} — 🔥 ${streak.current} hari`;
        });
        finalReply = `🎯 *Daftar Kebiasaan (${activeHabits.length}):*\n\n${lines.join('\n')}\n\n_Chat "sudah [nama habit]" untuk check-in._`;
      }
    }

    // 24. Hapus Kebiasaan
    if (aiIntent?.intent === 'delete_habit' && aiIntent.keyword) {
      const habit = db.findHabitByName ? db.findHabitByName(aiIntent.keyword) : null;
      if (habit) {
        db.deleteHabit(habit.id);
        finalReply = `🗑️ Kebiasaan "${habit.name}" berhasil dihapus beserta semua log-nya.`;
      } else {
        finalReply = `❌ Tidak menemukan kebiasaan yang cocok dengan "${aiIntent.keyword}".`;
      }
    }

    // ========== EVENT SCHEDULER ==========

    // 25. Buat Jadwal/Acara (atau konversi otomatis ke Reminder jika user minta "ingatkan")
    if (aiIntent?.intent === 'create_event' && (aiIntent.title || aiIntent.message) && (aiIntent.event_date || aiIntent.trigger_at)) {
      const title = aiIntent.title || aiIntent.message || messageBody;
      const eventDate = aiIntent.event_date || aiIntent.trigger_at;
      const isReminderPhrasing = /(?:ingatkan|ingetin|reminder|tolong ingatkan|jangan lupa|alarm)/i.test(messageBody);

      if (isReminderPhrasing) {
        // User secara jelas meminta untuk diingatkan melalui pesan WhatsApp -> Jadwalkan Reminder
        const recurrenceType = aiIntent.recurrence_type || null;
        db.createReminder({
          message: title,
          trigger_at: eventDate,
          is_recurring: recurrenceType ? 1 : 0,
          sent: 0,
          label: title.toLowerCase().substring(0, 100),
          recurrence_type: recurrenceType
        });

        if (recurrenceType) {
          const typeLabel = recurrenceType === 'daily' ? 'setiap hari' : recurrenceType === 'weekly' ? 'setiap minggu' : 'setiap bulan';
          finalReply = `⏰ *Pengingat Berulang Disimpan:*\n🔄 "${title}" — ${typeLabel}\nMulai: ${eventDate}\n\nBot akan mengirimkan pesan pengingat ke WhatsApp tepat waktu! 🔔`;
        } else {
          finalReply = `⏰ *Pengingat Disimpan:*\n"${title}" pada ${eventDate}.\nBot akan mengirimkan pesan pengingat ke WhatsApp saat waktunya tiba! 🔔`;
        }
      } else if (db.createEvent) {
        // User mencatat agenda / jadwal acara di kalender
        const remindMins = Number(aiIntent.remind_before_minutes) || 30;
        db.createEvent({
          title,
          event_date: eventDate,
          location: aiIntent.location || null,
          description: aiIntent.description || null,
          remind_before_minutes: remindMins
        });

        // Buat pengingat otomatis di tabel reminders sebelum acara dimulai
        try {
          const evTime = new Date(eventDate);
          if (!isNaN(evTime.getTime())) {
            const remindTime = new Date(evTime.getTime() - remindMins * 60000);
            const y = remindTime.getFullYear();
            const m = String(remindTime.getMonth() + 1).padStart(2, '0');
            const d = String(remindTime.getDate()).padStart(2, '0');
            const h = String(remindTime.getHours()).padStart(2, '0');
            const min = String(remindTime.getMinutes()).padStart(2, '0');
            const s = String(remindTime.getSeconds()).padStart(2, '0');
            const triggerAt = `${y}-${m}-${d} ${h}:${min}:${s}`;

            db.createReminder({
              message: `[Jadwal Acara Sebentar Lagi]: ${title}${aiIntent.location ? ` di ${aiIntent.location}` : ''}`,
              trigger_at: triggerAt,
              is_recurring: 0,
              sent: 0,
              label: `event_${title}`.toLowerCase().substring(0, 100),
              recurrence_type: null
            });
          }
        } catch (_) {}

        const loc = aiIntent.location ? `\n📍 Lokasi: ${aiIntent.location}` : '';
        finalReply = `📅 *Jadwal Ditambahkan:*\n📌 "${title}"\n🕐 ${eventDate}${loc}\n🔔 Pengingat: ${remindMins} menit sebelumnya\n\n_Chat "daftar jadwal" untuk lihat semua._`;
      }
    }

    // 26. Daftar Jadwal
    if (aiIntent?.intent === 'list_events') {
      const events = db.getUpcomingEvents ? db.getUpcomingEvents(15) : [];
      
      if (events.length === 0) {
        finalReply = '📅 Tidak ada jadwal mendatang. Chat "meeting zoom besok jam 10" untuk menambah.';
      } else {
        const lines = events.map((e, i) => {
          const loc = e.location ? ` 📍 ${e.location}` : '';
          return `${i + 1}. 📌 *${e.title}*\n   🕐 ${e.event_date}${loc}`;
        });
        finalReply = `📅 *Jadwal Mendatang (${events.length}):*\n\n${lines.join('\n\n')}`;
      }
    }

    // 27. Hapus Jadwal
    if (aiIntent?.intent === 'delete_event' && aiIntent.keyword) {
      const event = db.findEventByKeyword ? db.findEventByKeyword(aiIntent.keyword) : null;
      if (event) {
        db.deleteEvent(event.id);
        finalReply = `🗑️ Jadwal "${event.title}" (${event.event_date}) berhasil dihapus.`;
      } else {
        finalReply = `❌ Tidak menemukan jadwal yang cocok dengan "${aiIntent.keyword}".`;
      }
    }

    // ========== DAILY JOURNAL ==========

    // 28. Tulis Jurnal (Hanya jika pengguna eksplisit minta jurnal / bukan protes curhat)
    if (aiIntent?.intent === 'write_journal' && aiIntent.content) {
      const isCasualVentOrProtest = /(?:ai\s+sia|naon\s+ngadon\s+nulis|rek\s+curhat|mau\s+curhat|jangan\s+nulis|tong\s+nulis|tong\s+dicatet|curhat\s+saja|ngobrol\s+aja|kacilakaan|cilaka|tabrakan)/i.test(messageBody);
      if (!isCasualVentOrProtest && db.createJournal) {
        db.createJournal({
          content: aiIntent.content,
          mood: aiIntent.mood || null,
          tags: aiIntent.tags || null
        });
        const moodEmoji = { senang: '😊', biasa: '😐', sedih: '😢', marah: '😤', cemas: '😰', bersyukur: '🙏' };
        const moodIcon = aiIntent.mood ? (moodEmoji[aiIntent.mood] || '📝') : '📝';
        const streak = db.getJournalStreak ? db.getJournalStreak() : 0;
        finalReply = `${moodIcon} *Jurnal Tersimpan!*\n\n"${aiIntent.content.substring(0, 150)}${aiIntent.content.length > 150 ? '...' : ''}"\n\n${aiIntent.mood ? `Mood: ${moodIcon} ${aiIntent.mood}` : ''}\n✍️ Streak menulis: ${streak} hari`;
      }
    }

    // 29. Baca Jurnal Hari Ini
    if (aiIntent?.intent === 'read_journal') {
      const today = db.getTodayJournal ? db.getTodayJournal() : null;
      
      if (!today) {
        finalReply = '📝 Belum ada jurnal hari ini. Chat "jurnal: [isi curhat/refleksi]" untuk mulai menulis.';
      } else {
        const moodEmoji = { senang: '😊', biasa: '😐', sedih: '😢', marah: '😤', cemas: '😰', bersyukur: '🙏' };
        const moodIcon = today.mood ? (moodEmoji[today.mood] || '📝') : '📝';
        finalReply = `${moodIcon} *Jurnal Hari Ini:*\n\n"${today.content}"\n\n${today.mood ? `Mood: ${moodIcon} ${today.mood}` : ''}`;
      }
    }

    // 30. Daftar Jurnal
    if (aiIntent?.intent === 'list_journals') {
      const journals = db.getAllJournals ? db.getAllJournals(10) : [];
      
      if (journals.length === 0) {
        finalReply = '📝 Belum ada jurnal. Chat "jurnal: hari ini produktif banget" untuk mulai!';
      } else {
        const moodEmoji = { senang: '😊', biasa: '😐', sedih: '😢', marah: '😤', cemas: '😰', bersyukur: '🙏' };
        const lines = journals.map((j, i) => {
          const icon = j.mood ? (moodEmoji[j.mood] || '📝') : '📝';
          const preview = j.content.length > 60 ? j.content.substring(0, 60) + '...' : j.content;
          return `${i + 1}. ${icon} *${j.journal_date}* — ${preview}`;
        });
        const streak = db.getJournalStreak ? db.getJournalStreak() : 0;
        finalReply = `📝 *Jurnal Terakhir (${journals.length}):*\n✍️ Streak: ${streak} hari\n\n${lines.join('\n')}`;
      }
    }

    // ========== GOAL SETTING ==========

    // 31. Buat Goal
    if (aiIntent?.intent === 'create_goal' && aiIntent.title) {
      if (db.createGoal) {
        db.createGoal({
          title: aiIntent.title,
          target_value: aiIntent.target_value || null,
          unit: aiIntent.unit || null,
          deadline: aiIntent.deadline || null
        });
        const targetStr = aiIntent.target_value ? `\n🎯 Target: ${Number(aiIntent.target_value).toLocaleString('id-ID')} ${aiIntent.unit || ''}` : '';
        const deadlineStr = aiIntent.deadline ? `\n📅 Deadline: ${aiIntent.deadline}` : '';
        finalReply = `🎯 *Goal Ditambahkan:*\n📌 "${aiIntent.title}"${targetStr}${deadlineStr}\n\n_Chat "progress [nama goal] sudah [angka]" untuk update._`;
      }
    }

    // 32. Update Progress Goal
    if (aiIntent?.intent === 'update_goal' && aiIntent.keyword) {
      const goal = db.findGoalByKeyword ? db.findGoalByKeyword(aiIntent.keyword) : null;
      
      if (!goal) {
        finalReply = `❌ Tidak menemukan goal aktif yang cocok dengan "${aiIntent.keyword}".`;
      } else {
        const newValue = Number(aiIntent.new_value) || 0;
        const result = db.updateGoalProgress(goal.id, newValue);
        
        if (result.completed) {
          finalReply = `🏆 *GOAL TERCAPAI!* 🎉\n📌 "${goal.title}"\n✅ ${newValue.toLocaleString('id-ID')} / ${goal.target_value.toLocaleString('id-ID')} ${goal.unit || ''}\n\n*Congratulations!* Target berhasil dicapai! 🥳`;
        } else {
          const percent = goal.target_value ? Math.round((newValue / goal.target_value) * 100) : 0;
          const bar = goal.target_value ? `\n📊 Progress: ${percent}%` : '';
          finalReply = `📈 *Progress Updated:*\n📌 "${goal.title}"\n💪 ${newValue.toLocaleString('id-ID')} / ${goal.target_value ? goal.target_value.toLocaleString('id-ID') : '∞'} ${goal.unit || ''}${bar}`;
        }
      }
    }

    // 33. Daftar Goal
    if (aiIntent?.intent === 'list_goals') {
      const goals = db.getActiveGoals ? db.getActiveGoals() : [];
      
      if (goals.length === 0) {
        finalReply = '🎯 Belum ada goal aktif. Chat "goal: tabung 10 juta" untuk mulai!';
      } else {
        const lines = goals.map((g, i) => {
          const progress = g.target_value 
            ? `${g.current_value.toLocaleString('id-ID')}/${g.target_value.toLocaleString('id-ID')} ${g.unit || ''} (${Math.round((g.current_value / g.target_value) * 100)}%)`
            : `${g.current_value.toLocaleString('id-ID')} ${g.unit || ''}`;
          const dl = g.deadline ? ` 📅 ${g.deadline}` : '';
          return `${i + 1}. 🎯 *${g.title}*\n   ${progress}${dl}`;
        });
        finalReply = `🎯 *Goal Aktif (${goals.length}):*\n\n${lines.join('\n\n')}\n\n_Chat "progress [nama] sudah [angka]" untuk update._`;
      }
    }

    // ========== RINGKASAN & EXPORT ==========

    // 34. Ringkasan Bulanan
    if (aiIntent?.intent === 'monthly_summary') {
      try {
        const { generateMonthlySummary } = require('../export-data');
        const s = generateMonthlySummary();

        let lines = [];
        lines.push(`📊 *Ringkasan ${s.monthName}:*\n`);

        // Expenses
        lines.push(`💸 *Pengeluaran:* Rp${s.expenses.total.toLocaleString('id-ID')} (${s.expenses.count} transaksi)`);
        if (s.expenses.topCategories.length > 0) {
          const cats = s.expenses.topCategories.map(([cat, amt]) => `  • ${cat}: Rp${amt.toLocaleString('id-ID')}`);
          lines.push(cats.join('\n'));
        }

        // Budgets
        if (s.budgets.length > 0) {
          lines.push('');
          lines.push('💰 *Budget:*');
          s.budgets.forEach(b => {
            const icon = b.percent >= 100 ? '🔴' : b.percent >= 80 ? '🟡' : '🟢';
            lines.push(`  ${icon} ${b.category}: ${b.percent}% (Rp${b.spent.toLocaleString('id-ID')}/Rp${b.limit.toLocaleString('id-ID')})`);
          });
        }

        // Todos
        lines.push(`\n📋 *Tugas:* ${s.todos.done} selesai, ${s.todos.active} masih aktif`);

        // Habits
        if (s.habits.length > 0) {
          lines.push('\n🎯 *Kebiasaan:*');
          s.habits.forEach(h => {
            lines.push(`  🔥 ${h.name}: ${h.streak} hari (best: ${h.best})`);
          });
        }

        // Goals
        lines.push(`\n🏅 *Goal:* ${s.goals.active} aktif, ${s.goals.completed} tercapai`);

        // Journal
        lines.push(`✍️ *Jurnal:* ${s.journal.count} entri, streak ${s.journal.streak} hari`);

        // Notes
        lines.push(`📝 *Catatan:* ${s.notes.count} tersimpan`);

        finalReply = lines.join('\n');
      } catch (err) {
        finalReply = '❌ Gagal membuat ringkasan. Coba lagi nanti.';
        console.error('[PersonalHandler] Summary error:', err.message);
      }
    }

    // 35. Export Data (arahkan ke dashboard)
    if (aiIntent?.intent === 'export_data') {
      const type = aiIntent.type || 'all';
      finalReply = `📥 *Export Data*\n\nUntuk download data ${type} dalam format CSV, silakan buka dashboard:\n\n🌐 *http://localhost:3000/dashboard/export*\n\nDi sana kamu bisa pilih dan download data yang kamu butuhkan.`;
    }

    // Bersihkan blok JSON intent yang mungkin tersisa dalam balasan WhatsApp
    finalReply = finalReply.replace(/```json[\s\S]*?```/g, '').replace(/\{[\s\S]*?"intent"[\s\S]*?\}/g, '').trim();

    if (!finalReply) {
      finalReply = 'Siap, sudah dicatat dan diperbarui ya! 👍';
    }

    // Pecah pesan panjang menjadi gelembung chat alami & kirim bertahap
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
