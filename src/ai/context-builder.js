const db = require('../db');
const { getConfig } = require('../config');

/**
 * Ekstraksi kata kunci sederhana dari pesan pengguna.
 * Memfilter kata-kata penghubung dan kata generik agar tidak merusak pencarian produk.
 * @param {string} text 
 * @returns {Array<string>}
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Hapus tanda baca dan ambil kata dengan panjang >= 3 karakter
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter(w => w.length >= 3);
  
  const stopWords = new Set([
    'ada', 'apa', 'apakah', 'bisa', 'dan', 'dari', 'dengan', 'halo',
    'hai', 'ini', 'itu', 'juga', 'kami', 'kamu', 'mau', 'minta',
    'saya', 'sudah', 'tanya', 'untuk', 'yang', 'kak', 'min', 'gan',
    'bro', 'dong', 'saja', 'aja', 'aha', 'coba', 'stok', 'stock',
    'menu', 'produk', 'katalog', 'ready', 'list', 'daftar', 'jual',
    'tersedia', 'pilihan', 'pesan', 'order', 'beli', 'harga', 'berapa',
    'nya', 'punya', 'kok', 'sih', 'deh', 'nih', 'kan', 'yah', 'yaa', 'yuk', 'kah'
  ]);
  
  return words.filter(w => !stopWords.has(w));
}

/**
 * Membangun konteks data produk untuk Mode Bisnis.
 * Selalu memberikan visibilitas katalog menyeluruh kepada AI dengan penyorotan produk yang relevan.
 * @param {string} message 
 * @returns {string}
 */
function buildBusinessContext(message = '') {
  const rawProducts = db.getAllProducts ? db.getAllProducts() : [];

  if (!rawProducts || rawProducts.length === 0) {
    return '[DATA PRODUK & STOK DARI DATABASE]: Katalog produk saat ini masih kosong.';
  }

  // Deduplikasi produk berdasarkan nama unik (agar produk pengujian/duplikat tidak membingungkan AI)
  const uniqueProductMap = new Map();
  for (const p of rawProducts) {
    const key = (p.name || '').toLowerCase().trim();
    if (!uniqueProductMap.has(key) || p.id > uniqueProductMap.get(key).id) {
      uniqueProductMap.set(key, p);
    }
  }
  const allProducts = Array.from(uniqueProductMap.values());

  const { resolveProductImagePath } = require('../engine/handlers/business-handler');

  const formatProductLine = (p) => {
    let line = `- [${p.sku ? p.sku + ' - ' : ''}${p.name}] | Kategori: ${p.category || 'Umum'} | Harga: Rp${Number(p.price).toLocaleString('id-ID')} | Stok: ${p.stock > 0 ? p.stock + ' unit (Ready)' : 'Habis (0)'}`;
    if (p.description) line += ` | Deskripsi: ${p.description}`;
    if (p.product_knowledge) line += ` | Info/Bahan: ${p.product_knowledge}`;
    const hasPhoto = Boolean(p.image_path && resolveProductImagePath && resolveProductImagePath(p.image_path));
    line += ` | Foto: ${hasPhoto ? 'Tersedia di sistem' : 'Belum tersedia'}`;
    return line;
  };

  const keywords = extractKeywords(message);
  let matchedProducts = [];

  if (keywords.length > 0) {
    for (const kw of keywords) {
      const results = db.searchProducts ? db.searchProducts(kw) : [];
      if (results && results.length > 0) {
        matchedProducts.push(...results);
      }
    }
  }

  // Hilangkan duplikasi produk yang cocok
  const uniqueMatched = Array.from(
    new Map(matchedProducts.map(p => [p.name.toLowerCase().trim(), p])).values()
  );

  let resultContext = '';

  // 1. Jika ada produk spesifik yang cocok dengan pencarian kata kunci non-generik
  if (uniqueMatched.length > 0) {
    const matchedLines = uniqueMatched.map(formatProductLine);
    resultContext += `[PRODUK YANG PALING SESUAI DENGAN PERTANYAAN]:\n${matchedLines.join('\n')}\n\n`;
  }

  // 2. Kelompokkan seluruh katalog produk aktif per kategori
  const categoryGroups = {};
  for (const p of allProducts) {
    const cat = p.category || 'Umum';
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    categoryGroups[cat].push(formatProductLine(p));
  }

  let catalogBlock = `[DATA PRODUK & STOK DARI DATABASE] (Seluruh Katalog Toko - Total: ${allProducts.length} Produk):\n`;
  for (const [catName, prodLines] of Object.entries(categoryGroups)) {
    catalogBlock += `📂 Kategori: ${catName}\n${prodLines.join('\n')}\n\n`;
  }
  resultContext += catalogBlock.trim();

  // 3. Deteksi pertanyaan katalog umum ("yang ready apa aja", "menu ready", dll)
  const lowerMsg = (message || '').toLowerCase().trim();
  const isGeneralCatalogInquiry = /(?:yang\s+ready|ready\s+apa|ada\s+apa|stok\s+apa|menu|katalog|daftar\s+menu|apa\s+aja|pilihan\s+menu|jual\s+apa|apa\s+yang\s+ada)/i.test(lowerMsg);
  
  if (isGeneralCatalogInquiry) {
    resultContext += `\n\n[INSTRUKSI WAJIB UNTUK PERTANYAAN KATALOG/READY]:
Pelanggan menanyakan menu atau stok produk yang ready secara umum ("${message}").
Anda WAJIB menyebutkan SELURUH ${allProducts.length} produk di atas yang berstatus stok ready (> 0) tanpa ada yang dipotong atau dihilangkan. Kelompokkan per kategori secara rapi dengan harga yang jelas.`;
  }

  // 4. Kumpulkan rekomendasi produk terkait (upselling)
  const relatedProductsList = [];
  const sourceList = uniqueMatched.length > 0 ? uniqueMatched : allProducts.slice(0, 3);
  for (const p of sourceList) {
    if (p.related_products) {
      const ids = p.related_products.split(',').map(id => Number(id.trim())).filter(Boolean);
      for (const id of ids) {
        const relProd = db.getProductById ? db.getProductById(id) : null;
        if (relProd && !relatedProductsList.some(rp => rp.id === relProd.id)) {
          relatedProductsList.push({ originName: p.name, ...relProd });
        }
      }
    }
  }

  if (relatedProductsList.length > 0) {
    const relLines = relatedProductsList.map(rp => 
      `- ${rp.name} — Rp${Number(rp.price).toLocaleString('id-ID')} (Rekomendasi terkait "${rp.originName}")`
    );
    resultContext += `\n\n[REKOMENDASI PRODUK TERKAIT]:\nJika relevan dan natural, tawarkan produk terkait berikut:\n${relLines.join('\n')}`;
  }

  return resultContext;
}

const { isSameCategory, normalizeCategory } = require('../utils/categories');
const { buildUserProfileContext } = require('../utils/user-preferences');

/**
 * Membangun konteks data pengeluaran realtime untuk Mode Personal.
 * Selalu melampirkan ringkasan bulan ini dan 10 transaksi terakhir agar AI selalu akurat.
 * @param {string} [message] 
 * @returns {string}
 */
function buildExpenseContext(message = '') {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const monthlyExpenses = db.getMonthlyExpenses ? db.getMonthlyExpenses(year, month) : [];
    const recentExpenses = db.getRecentExpenses ? db.getRecentExpenses(10) : [];

    if ((!monthlyExpenses || monthlyExpenses.length === 0) && (!recentExpenses || recentExpenses.length === 0)) {
      return `[DATA PENGELUARAN DARI DATABASE (Bulan ${month}/${year})]:\nBelum ada catatan pengeluaran bulan ini.`;
    }

    const totalMonth = monthlyExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    
    // Grouping by category
    const catMap = {};
    for (const item of monthlyExpenses) {
      const cat = item.category || 'Lain-lain';
      catMap[cat] = (catMap[cat] || 0) + (Number(item.amount) || 0);
    }
    const catSummary = Object.entries(catMap)
      .map(([cat, amt]) => `  • ${cat}: Rp${amt.toLocaleString('id-ID')}`)
      .join('\n');

    // 5 Transaksi terakhir
    const recentLines = recentExpenses.slice(0, 8).map(e => 
      `  - [ID:${e.id}] ${e.created_at.substring(0, 16)} | *${e.category}* | Rp${Number(e.amount).toLocaleString('id-ID')} (${e.note || '-'})`
    );

    return `[DATA PENGELUARAN DARI DATABASE (Bulan ${month}/${year})]:
Total Pengeluaran Bulan Ini: Rp${totalMonth.toLocaleString('id-ID')} (${monthlyExpenses.length} transaksi)
Rincian per Kategori:
${catSummary || '  (Belum ada data)'}

Transaksi Terakhir Dicatat:
${recentLines.join('\n') || '  (Belum ada transaksi)'}`;
  } catch (err) {
    return '[DATA PENGELUARAN DARI DATABASE]: Mode pencatatan siap.';
  }

}

/**
 * Membangun konteks daftar reminder aktif untuk Mode Personal.
 * @param {string} message 
 * @returns {string}
 */
function buildRemindersContext(message) {
  const lower = (message || '').toLowerCase();
  const isReminderQuery = lower.includes('reminder') || lower.includes('pengingat') || 
    lower.includes('ingatkan') || lower.includes('daftar') || lower.includes('tunda') ||
    lower.includes('snooze') || lower.includes('batalkan') || lower.includes('cancel');

  try {
    const activeReminders = db.getActiveReminders ? db.getActiveReminders() : [];
    if (!activeReminders || activeReminders.length === 0) {
      return isReminderQuery ? '[DAFTAR PENGINGAT AKTIF]: Tidak ada pengingat yang sedang aktif saat ini.' : '';
    }

    const lines = activeReminders.map((r, i) => {
      const type = r.recurrence_type 
        ? (r.recurrence_type === 'daily' ? 'Harian' : r.recurrence_type === 'weekly' ? 'Mingguan' : 'Bulanan')
        : 'Satu kali';
      const snoozed = r.snoozed_until ? ` (ditunda sampai ${r.snoozed_until})` : '';
      return `${i + 1}. "${r.message}" — ${r.trigger_at} — ${type}${snoozed}`;
    });

    return `[DAFTAR PENGINGAT AKTIF (${activeReminders.length} pengingat)]:\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}

/**
 * Membangun konteks daftar catatan untuk Mode Personal.
 * @param {string} message 
 * @returns {string}
 */
function buildNotesContext(message) {
  const lower = (message || '').toLowerCase();
  const isNoteQuery = lower.includes('catatan') || lower.includes('note') || lower.includes('catat') || 
    lower.includes('simpan') || lower.includes('cari') || lower.includes('resi') || lower.includes('password');

  try {
    const allNotes = db.getAllNotes ? db.getAllNotes(10) : [];
    if (!allNotes || allNotes.length === 0) {
      return isNoteQuery ? '[DAFTAR CATATAN]: Belum ada catatan yang tersimpan.' : '';
    }

    const lines = allNotes.map((n, i) => {
      const title = n.title || '(tanpa judul)';
      const tags = n.tags ? ` [${n.tags}]` : '';
      return `${i + 1}. "${title}": ${n.content.substring(0, 80)}${tags}`;
    });

    return `[DAFTAR CATATAN TERSIMPAN (${allNotes.length} catatan)]:\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}

/**
 * Membangun konteks daftar tugas untuk Mode Personal.
 * @param {string} message 
 * @returns {string}
 */
function buildTodosContext(message) {
  try {
    const activeTodos = db.getActiveTodos ? db.getActiveTodos() : [];
    if (!activeTodos || activeTodos.length === 0) {
      return '';
    }

    const lines = activeTodos.map((t, i) => {
      const prio = t.priority === 'urgent' ? '🔴' : t.priority === 'low' ? '🔵' : '⚪';
      const due = t.due_date ? ` (deadline: ${t.due_date})` : '';
      return `${i + 1}. ${prio} [ID:${t.id}] ${t.task}${due}`;
    });

    return `[DAFTAR TUGAS AKTIF (${activeTodos.length} tugas)]:\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}

/**
 * Membangun konteks status budget realtime untuk Mode Personal.
 * Selalu menyertakan seluruh budget aktif dan persentase penggunaan riil.
 * @param {string} [message] 
 * @returns {string}
 */
function buildBudgetContext(message = '') {
  try {
    const allBudgets = db.getAllBudgets ? db.getAllBudgets() : [];
    if (!allBudgets || allBudgets.length === 0) {
      return '[STATUS BUDGET BULAN INI]: Belum ada anggaran yang diatur.';
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthlyExpenses = db.getMonthlyExpenses ? db.getMonthlyExpenses(year, month) : [];

    const lines = allBudgets.map((b, i) => {
      const spent = monthlyExpenses
        .filter(e => e.category && isSameCategory(e.category, b.category))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const percent = b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
      const remaining = b.monthly_limit - spent;
      const status = percent >= 100 ? '🔴 OVER' : percent >= b.alert_at_percent ? '🟡 WARNING' : '🟢 AMAN';
      return `${i + 1}. *${b.category}*: Rp${spent.toLocaleString('id-ID')} / Rp${b.monthly_limit.toLocaleString('id-ID')} (${percent}%) ${status} — Sisa: Rp${remaining.toLocaleString('id-ID')}`;
    });

    return `[STATUS BUDGET BULAN INI (${allBudgets.length} kategori)]:\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}

/**
 * Membangun konteks daftar kebiasaan untuk Mode Personal.
 * @param {string} message 
 * @returns {string}
 */
function buildHabitsContext(message) {
  try {
    const activeHabits = db.getActiveHabits ? db.getActiveHabits() : [];
    if (!activeHabits || activeHabits.length === 0) return '';

    const lines = activeHabits.map((h, i) => {
      const streak = db.calculateStreak ? db.calculateStreak(h.id) : { current: 0, best: 0 };
      const checkedToday = db.hasCheckedInToday ? db.hasCheckedInToday(h.id) : false;
      const todayStatus = checkedToday ? '✅' : '☐';
      return `${i + 1}. ${todayStatus} "${h.name}" — 🔥 Streak: ${streak.current} hari (Best: ${streak.best})`;
    });

    return `[DAFTAR KEBIASAAN AKTIF (${activeHabits.length})]:\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}

/**
 * Membangun konteks gabungan lengkap untuk Mode Personal.
 * @param {string} message 
 * @param {string} [contact] 
 * @returns {string}
 */
function buildPersonalContext(message, contact = null) {
  const parts = [];

  // 1. Injeksi Waktu WIB & Tanggal Hari Ini
  const timeCtx = buildTimeAndCustomerContext(contact);
  if (timeCtx) parts.push(timeCtx);

  // 2. Injeksi Profil & Preferensi Pengguna (Nama, Panggilan, Bot Name)
  const userProfileCtx = buildUserProfileContext();
  if (userProfileCtx) parts.push(userProfileCtx);

  // 3. Injeksi Data Keuangan Realtime (Expenses & Budgets)
  parts.push(buildExpenseContext(message));
  parts.push(buildBudgetContext(message));

  // 4. Injeksi Reminders, Notes, Todos, Habits, Events, Goals
  const reminderCtx = buildRemindersContext(message);
  if (reminderCtx) parts.push(reminderCtx);

  const notesCtx = buildNotesContext(message);
  if (notesCtx) parts.push(notesCtx);

  const todosCtx = buildTodosContext(message);
  if (todosCtx) parts.push(todosCtx);

  const habitsCtx = buildHabitsContext(message);
  if (habitsCtx) parts.push(habitsCtx);

  const eventsCtx = buildEventsContext(message);
  if (eventsCtx) parts.push(eventsCtx);

  const goalsCtx = buildGoalsContext(message);
  if (goalsCtx) parts.push(goalsCtx);

  return parts.join('\n\n');
}

/**
 * Membangun konteks jadwal acara untuk Mode Personal.
 * @param {string} message 
 * @returns {string}
 */
function buildEventsContext(message) {
  const lower = (message || '').toLowerCase();
  const isEventQuery = lower.includes('jadwal') || lower.includes('acara') || lower.includes('event') ||
    lower.includes('meeting') || lower.includes('schedule');

  if (!isEventQuery) return '';

  try {
    const upcoming = db.getUpcomingEvents ? db.getUpcomingEvents(10) : [];
    if (!upcoming || upcoming.length === 0) {
      return '[JADWAL ACARA]: Tidak ada acara yang akan datang.';
    }

    const lines = upcoming.map((e, i) => {
      const loc = e.location ? ` 📍 ${e.location}` : '';
      return `${i + 1}. "${e.title}" — ${e.event_date}${loc}`;
    });

    return `[JADWAL ACARA MENDATANG (${upcoming.length})]:\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}

/**
 * Membangun konteks goal/target untuk Mode Personal.
 * @param {string} message 
 * @returns {string}
 */
function buildGoalsContext(message) {
  const lower = (message || '').toLowerCase();
  const isGoalQuery = lower.includes('goal') || lower.includes('target') || lower.includes('sasaran') ||
    lower.includes('progress');

  if (!isGoalQuery) return '';

  try {
    const activeGoals = db.getActiveGoals ? db.getActiveGoals() : [];
    if (!activeGoals || activeGoals.length === 0) {
      return '[DAFTAR GOAL]: Belum ada target yang diset.';
    }

    const lines = activeGoals.map((g, i) => {
      const progress = g.target_value ? `${g.current_value}/${g.target_value} ${g.unit || ''}` : `${g.current_value} ${g.unit || ''}`;
      const percent = g.target_value ? ` (${Math.round((g.current_value / g.target_value) * 100)}%)` : '';
      const dl = g.deadline ? ` — Deadline: ${g.deadline}` : '';
      return `${i + 1}. "${g.title}": ${progress}${percent}${dl}`;
    });

    return `[DAFTAR GOAL AKTIF (${activeGoals.length})]:\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}

/**
 * Membangun konteks riwayat chat percakapan sebelumnya untuk kontak tertentu.
 * Mendukung pembacaan kapasitas memori hingga 10-15 interaksi dan pembersihan format otomatis.
 * @param {string} contact 
 * @param {number} [limit=12] 
 * @returns {string}
 */
function buildChatHistoryContext(contact, limit = null) {
  if (!contact) return '';
  try {
    let resolvedLimit = limit;
    if (!resolvedLimit || isNaN(Number(resolvedLimit))) {
      const config = getConfig ? getConfig() : {};
      resolvedLimit = Number(config.chat_history_limit) || 12;
    }
    resolvedLimit = Math.max(1, Math.min(resolvedLimit, 30));

    const rawLogs = db.getChatLogsByContact(contact, resolvedLimit);
    if (!rawLogs || rawLogs.length === 0) return '';

    // Balik urutan agar kronologis dari yang terlama ke terbaru
    const logs = [...rawLogs].reverse();
    const historyLines = logs.map(l => {
      const parts = [];
      if (l.message_in) {
        const cleanIn = l.message_in
          .replace(/```json[\s\S]*?```/g, '')
          .replace(/\{[\s\S]*?"intent"[\s\S]*?\}/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleanIn) parts.push(`- Pelanggan: "${cleanIn}"`);
      }
      if (l.message_out) {
        const cleanOut = l.message_out
          .replace(/```json[\s\S]*?```/g, '')
          .replace(/\{[\s\S]*?"intent"[\s\S]*?\}/g, '')
          .replace(/\[HANDOVER_REQUIRED\]/g, '')
          .replace(/\[CUSTOMER_NAME:[^\]]+\]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleanOut) parts.push(`- Asisten/Bot: "${cleanOut}"`);
      }
      return parts.join('\n');
    }).filter(Boolean);

    if (historyLines.length === 0) return '';

    return `[RIWAYAT PERCAKAPAN TERAKHIR DENGAN KONTAK INI (${logs.length} Interaksi Sebelumnya)]:\n${historyLines.join('\n')}`;
  } catch (err) {
    return '';
  }
}

/**
 * Membangun profil usaha & pengetahuan dokumen pendukung (Knowledge Base).
 * @returns {string}
 */
function buildBusinessProfileContext() {
  try {
    const parts = [];
    const details = [];

    const address = db.getSetting ? db.getSetting('business_address') : null;
    if (address && address.trim()) details.push(`- Alamat / Lokasi Toko: ${address.trim()}`);

    const contact = db.getSetting ? db.getSetting('business_contact') : null;
    if (contact && contact.trim()) details.push(`- Kontak Admin / Hotline: ${contact.trim()}`);

    const hours = db.getSetting ? db.getSetting('business_hours') : null;
    if (hours && hours.trim()) details.push(`- Jam Operasional: ${hours.trim()}`);

    const payment = db.getSetting ? db.getSetting('payment_methods') : null;
    if (payment && payment.trim()) details.push(`- Metode Pembayaran yang Didukung: ${payment.trim()}`);

    const shipping = db.getSetting ? db.getSetting('shipping_methods') : null;
    if (shipping && shipping.trim()) details.push(`- Jasa & Ekspedisi Pengiriman: ${shipping.trim()}`);

    const returnPolicy = db.getSetting ? db.getSetting('return_policy') : null;
    if (returnPolicy && returnPolicy.trim()) details.push(`- Garansi / Kebijakan Retur & Komplain: ${returnPolicy.trim()}`);

    const notes = db.getSetting ? db.getSetting('business_notes') : null;
    if (notes && notes.trim()) details.push(`- SOP & Catatan Khusus Toko: ${notes.trim()}`);

    const profileText = db.getSetting ? db.getSetting('business_profile_text') : null;
    if (profileText && profileText.trim()) {
      details.push(`- Deskripsi / Tentang Usaha: ${profileText.trim()}`);
    }

    if (details.length > 0) {
      parts.push(`[PROFIL & INFORMASI LENGKAP BISNIS]:\n${details.join('\n')}`);
    }

    // Injeksi FAQ sebagai panduan pengetahuan cerdas untuk AI
    try {
      const faqs = db.getAllFaqs ? db.getAllFaqs().filter(f => f.is_active !== 0) : [];
      if (faqs && faqs.length > 0) {
        const faqLines = faqs.map(f => 
          `• Tanya: ${f.question_label || f.trigger_keywords}\n  Jawab: ${f.answer}`
        );
        parts.push(`[PANDUAN INFORMASI & FAQ TOKO]:\n${faqLines.join('\n\n')}`);
      }
    } catch (_) {}

    const docs = db.getAllBusinessDocuments ? db.getAllBusinessDocuments() : [];
    if (docs && docs.length > 0) {
      const docSnippets = docs.map((d, i) => 
        `--- Dokumen Knowledge #${i+1}: ${d.original_filename} ---\n${d.extracted_text.slice(0, 2000)}`
      );
      parts.push(`[DOKUMEN KNOWLEDGE BASE BISNIS]:\n${docSnippets.join('\n\n')}`);
    }

    return parts.join('\n\n');
  } catch (_) {
    return '';
  }
}

/**
 * Membangun konteks contoh percakapan (Few-Shot Examples) dari database lokal.
 * @param {number} [limit=4]
 * @returns {string}
 */
function buildFewShotSamplesContext(limit = 4) {
  try {
    const samples = db.getAllSamples ? db.getAllSamples(true).slice(0, limit) : [];
    if (!samples || samples.length === 0) return '';

    const formatted = samples.map((s, idx) => 
      `Contoh ${idx + 1}:\n- Pelanggan: "${s.user_sample}"\n- Balasan Asisten/Toko: "${s.bot_sample}"`
    );

    return `[CONTOH GAYA PERCAKAPAN YANG DIINGINKAN (FEW-SHOT TRAINING)]:\nIkuti gaya komunikasi, keramahan, dan cara menjawab seperti contoh berikut. Jika pertanyaan atau situasi pelanggan serupa dengan contoh (misal: menawar harga/nego/minta bonus), prioritaskan gaya dan solusi tawaran seperti pada contoh dialog di bawah:\n\n${formatted.join('\n\n')}`;
  } catch (_) {
    return '';
  }
}


/**
 * Membangun konteks waktu saat ini & status pelanggan (baru/lama) untuk sapaan kontekstual.
 * @param {string} [contact]
 * @returns {string}
 */
function buildTimeAndCustomerContext(contact) {
  const parts = [];

  // 1. Konteks waktu WIB
  try {
    const now = new Date();
    // Konversi ke WIB (UTC+7)
    const wibOffset = 7 * 60; // menit
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibDate = new Date(utcMs + (wibOffset * 60000));

    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                   'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const jam = wibDate.getHours();
    const menit = String(wibDate.getMinutes()).padStart(2, '0');

    let periode = 'Pagi';
    if (jam >= 5 && jam < 11) periode = 'Pagi';
    else if (jam >= 11 && jam < 15) periode = 'Siang';
    else if (jam >= 15 && jam < 18) periode = 'Sore';
    else periode = 'Malam';

    const tanggal = `${hari[wibDate.getDay()]}, ${wibDate.getDate()} ${bulan[wibDate.getMonth()]} ${wibDate.getFullYear()}`;
    parts.push(`[KONTEKS WAKTU]: ${tanggal}, ${jam}:${menit} WIB (${periode})`);
  } catch (_) {
    // Gagal mendapatkan waktu, skip saja
  }

  // 2. Status pelanggan (baru / lama)
  if (contact) {
    try {
      const logs = db.getChatLogsByContact(contact, 1);
      if (!logs || logs.length === 0) {
        parts.push('[STATUS PELANGGAN]: Pelanggan Baru (chat pertama kali)');
      } else {
        // Hitung total interaksi sebelumnya
        const allLogs = db.getChatLogsByContact(contact, 100);
        const count = allLogs ? allLogs.length : 1;
        parts.push(`[STATUS PELANGGAN]: Pelanggan Lama (pernah chat ${count}x)`);
      }
    } catch (_) {
      parts.push('[STATUS PELANGGAN]: Tidak diketahui');
    }
  }

  return parts.join('\n');
}

/**
 * Mengecek apakah saat ini di luar jam operasional bisnis.
 * @returns {{ isOutOfHours: boolean, businessHours: string, currentHourWIB: number }}
 */
function checkOutOfHours() {
  try {
    const hoursStr = db.getSetting ? db.getSetting('business_hours') : null;
    if (!hoursStr || !hoursStr.trim()) {
      return { isOutOfHours: false, businessHours: '', currentHourWIB: -1 };
    }

    // Parse format "08:00-17:00"
    const match = hoursStr.trim().match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!match) {
      return { isOutOfHours: false, businessHours: hoursStr.trim(), currentHourWIB: -1 };
    }

    const openHour = parseInt(match[1], 10);
    const openMinute = parseInt(match[2], 10);
    const closeHour = parseInt(match[3], 10);
    const closeMinute = parseInt(match[4], 10);

    // Hitung jam WIB saat ini
    const now = new Date();
    const wibOffset = 7 * 60;
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibDate = new Date(utcMs + (wibOffset * 60000));
    const currentHour = wibDate.getHours();
    const currentMinute = wibDate.getMinutes();
    const currentTotal = currentHour * 60 + currentMinute;
    const openTotal = openHour * 60 + openMinute;
    const closeTotal = closeHour * 60 + closeMinute;

    const isOutOfHours = currentTotal < openTotal || currentTotal >= closeTotal;

    return { isOutOfHours, businessHours: hoursStr.trim(), currentHourWIB: currentHour };
  } catch (_) {
    return { isOutOfHours: false, businessHours: '', currentHourWIB: -1 };
  }
}

/**
 * Membangun konteks status pesanan dari tabel orders untuk Mode Bisnis.
 * @param {string} contact 
 * @returns {string}
 */
function buildOrderContext(contact) {
  if (!contact) return '';

  try {
    const orders = db.getOrdersByContact ? db.getOrdersByContact(contact, 5) : [];
    if (!orders || orders.length === 0) return '';

    const lines = orders.map(o => {
      let line = `- Order #${o.id}: "${o.order_summary}" — Status: ${o.status}`;
      if (o.resi_number) line += ` (Resi: ${o.resi_number})`;
      if (o.notes) line += ` | Catatan: ${o.notes}`;
      return line;
    });

    return `[STATUS PESANAN PELANGGAN INI]:\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}

/**
 * Fungsi utama untuk membangun konteks berbasis mode dan pesan.
 * @param {string} message 
 * @param {'bisnis'|'personal'} mode 
 * @param {string} [contact] 
 * @returns {string}
 */
function buildContext(message, mode = 'bisnis', contact = null) {
  try {
    const parts = [];

    // Injeksi konteks khusus Mode Admin / Owner Assistant
    if (mode === 'admin') {
      const adminCtx = buildAdminContext(message);
      if (adminCtx) parts.push(adminCtx);
      const historyContext = contact ? buildChatHistoryContext(contact) : '';
      if (historyContext) parts.push(historyContext);
      return parts.join('\n\n');
    }

    // Injeksi konteks waktu & status pelanggan (Mode Bisnis)
    if (mode === 'bisnis') {
      const timeCtx = buildTimeAndCustomerContext(contact);
      if (timeCtx) parts.push(timeCtx);
    }

    // Injeksi profil pelanggan CRM (Mode Bisnis)
    if (mode === 'bisnis' && contact) {
      const customerCtx = buildCustomerProfileContext(contact);
      if (customerCtx) parts.push(customerCtx);
    }

    // Injeksi status pesanan pelanggan (Mode Bisnis)
    if (mode === 'bisnis' && contact) {
      const orderCtx = buildOrderContext(contact);
      if (orderCtx) parts.push(orderCtx);
    }
    
    // Injeksi profil bisnis & dokumen usaha jika Mode Bisnis
    if (mode === 'bisnis') {
      const profileContext = buildBusinessProfileContext();
      if (profileContext) parts.push(profileContext);

      // Injeksi status jeda terima pesanan jika diaktifkan owner
      const config = getConfig();
      const pauseOrders = db.getSetting ? (db.getSetting('pause_orders') === 'true' || db.getSetting('pause_orders') === true) : Boolean(config.pause_orders);
      if (pauseOrders) {
        const defaultReason = 'Mohon maaf, saat ini kami sedang menjeda penerimaan pesanan baru karena pesanan sedang membludak. Silakan hubungi kami beberapa saat lagi ya Kak! 🙏';
        const pauseReason = (db.getSetting && db.getSetting('pause_orders_reason')) || config.pause_orders_reason || defaultReason;
        parts.push(`[STATUS OPERASIONAL TOKO: PENERIMAAN PESANAN SEDANG DIJEDA]:
- PERHATIAN PENTING: Pemilik toko saat ini MENJEDA penerimaan pesanan baru.
- Alasan dari Pemilik Toko: "${pauseReason}".
- INSTRUKSI AI: Jika pelanggan berniat memesan, ingin checkout, beli, transfer, atau menanyakan pemesanan, sampaikan dengan SANGAT RAMAH, HANGAT, dan SANTUN bahwa penerimaan pesanan saat ini sedang dijeda sementara karena alasan di atas. DILARANG membuat atau mencatat pesanan baru.`);
      }
    }

    const dataContext = mode === 'bisnis' 
      ? buildBusinessContext(message) 
      : buildPersonalContext(message, contact);
    parts.push(dataContext);

    const sampleContext = buildFewShotSamplesContext();
    if (sampleContext) parts.push(sampleContext);

    const historyContext = contact ? buildChatHistoryContext(contact) : '';
    if (historyContext) parts.push(historyContext);

    return parts.join('\n\n');
  } catch (error) {
    console.error('[ContextBuilder] Error saat membangun konteks:', error.message);
    return '[DATA DATABASE]: Gagal memuat data lokal.';
  }
}

/**
 * Membangun konteks profil pelanggan dari tabel customer_profiles untuk Mode Bisnis.
 * @param {string} contact 
 * @returns {string}
 */
function buildCustomerProfileContext(contact) {
  if (!contact) return '';

  try {
    const profile = db.getCustomerProfile ? db.getCustomerProfile(contact) : null;
    if (!profile) return '';

    const lines = [];
    if (profile.customer_name) lines.push(`- Nama: ${profile.customer_name}`);
    
    if (profile.tags) {
      const tagList = profile.tags.split(',').map(t => t.trim()).filter(Boolean);
      lines.push(`- Tags: ${tagList.join(', ')}`);
    }
    
    if (profile.total_orders > 0) {
      lines.push(`- Total Order: ${profile.total_orders} kali (total belanja: Rp${Number(profile.total_spent || 0).toLocaleString('id-ID')})`);
    }
    
    if (profile.favorite_products) {
      lines.push(`- Produk Favorit: ${profile.favorite_products}`);
    }
    
    if (profile.notes) {
      lines.push(`- Catatan Owner: ${profile.notes}`);
    }

    if (profile.last_contact_at) {
      // Hitung selisih hari
      const lastDate = new Date(profile.last_contact_at);
      const now = new Date();
      const diffMs = now - lastDate;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        lines.push('- Terakhir chat: Hari ini');
      } else if (diffDays === 1) {
        lines.push('- Terakhir chat: Kemarin');
      } else {
        lines.push(`- Terakhir chat: ${diffDays} hari lalu`);
      }
    }

    if (lines.length === 0) return '';

    return `[PROFIL PELANGGAN INI]:\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}

/**
 * Mengekstrak nama pelanggan dari tag [CUSTOMER_NAME:xxx] di respons AI.
 * @param {string} reply 
 * @returns {{ name: string, cleanReply: string } | null}
 */
function extractCustomerNameFromReply(reply) {
  if (!reply) return null;

  const match = reply.match(/\[CUSTOMER_NAME:([^\]]+)\]/);
  if (!match) return null;

  const name = match[1].trim();
  const cleanReply = reply.replace(/\s*\[CUSTOMER_NAME:[^\]]+\]\s*/g, '').trim();

  return { name, cleanReply };
}

/**
 * Membangun konteks data operasional dan ringkasan bisnis untuk Mode Admin / Owner Assistant.
 * @param {string} [message] 
 * @returns {string}
 */
function buildAdminContext(message = '') {
  try {
    const products = db.getAllProducts ? db.getAllProducts() : [];
    const orders = db.getAllOrders ? db.getAllOrders() : [];
    const pausedContacts = db.getAllPausedContacts ? db.getAllPausedContacts() : [];
    const pendingHandoverCount = db.getPendingHandoverCount ? db.getPendingHandoverCount() : 0;
    
    // Hitung omset total & pesanan hari ini
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = orders.filter(o => o.created_at && o.created_at.startsWith(todayStr));
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending');
    
    const lowStockProducts = products.filter(p => Number(p.stock) <= 5);

    let ctx = `[DATA OPERASIONAL TOKO REAL-TIME]:\n`;
    ctx += `- Total Produk di Katalog: ${products.length} item\n`;
    ctx += `- Total Pesanan Hari Ini (${todayStr}): ${todayOrders.length} transaksi (Total Omset: Rp${todayRevenue.toLocaleString('id-ID')})\n`;
    ctx += `- Pesanan Pending/Belum Diproses: ${pendingOrders.length} pesanan\n`;
    ctx += `- Tiket Handover Pending: ${pendingHandoverCount} tiket\n`;
    ctx += `- Kontak Pelanggan Sedang Dijeda: ${pausedContacts.length} kontak\n`;

    if (lowStockProducts.length > 0) {
      ctx += `\n[PRODUK DENGAN STOK MENIPIS (<= 5)]:\n`;
      lowStockProducts.forEach(p => {
        ctx += `- ${p.name}: Sisa ${p.stock} unit (Harga: Rp${Number(p.price).toLocaleString('id-ID')})\n`;
      });
    }

    if (pendingOrders.length > 0) {
      ctx += `\n[5 PESANAN PENDING TERBARU]:\n`;
      pendingOrders.slice(0, 5).forEach(o => {
        ctx += `- #${o.id} | Pelanggan: ${o.customer_name || o.contact} | Pesanan: ${o.order_summary} | Total: Rp${Number(o.total_amount || 0).toLocaleString('id-ID')}\n`;
      });
    }

    ctx += `\n[PANDUAN PERINTAH CEPAT OWNER]:\n`;
    ctx += `- Untuk unpause bot / selesaikan handover pelanggan: ketik \`!aktifkan [nomor]\` atau \`!selesai\`\n`;
    ctx += `- Untuk jeda bot manual: ketik \`!jeda [nomor] [durasi_jam]\`\n`;
    ctx += `- Untuk input pesanan baru via WhatsApp: ketik format form pesanan (nama: ... no: ... pesanan: ... total: ...)\n`;
    ctx += `- Untuk cek status antrean: ketik \`!status\`\n`;

    return ctx;
  } catch (err) {
    return '[DATA OPERASIONAL TOKO]: Data tidak dapat dimuat.';
  }
}

module.exports = {
  extractKeywords,
  buildBusinessProfileContext,
  buildBusinessContext,
  buildExpenseContext,
  buildRemindersContext,
  buildPersonalContext,
  buildChatHistoryContext,
  buildFewShotSamplesContext,
  buildTimeAndCustomerContext,
  checkOutOfHours,
  buildCustomerProfileContext,
  extractCustomerNameFromReply,
  buildOrderContext,
  buildAdminContext,
  buildContext
};


