const db = require('../db');

/**
 * Ekstraksi kata kunci sederhana dari pesan pengguna.
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
    'saya', 'sudah', 'tanya', 'untuk', 'yang', 'kak', 'min', 'gan'
  ]);
  
  return words.filter(w => !stopWords.has(w));
}

/**
 * Membangun konteks data produk untuk Mode Bisnis.
 * @param {string} message 
 * @returns {string}
 */
function buildBusinessContext(message) {
  const keywords = extractKeywords(message);
  let matchedProducts = [];

  // Cari produk berdasarkan kata kunci
  for (const kw of keywords) {
    const results = db.searchProducts(kw);
    if (results && results.length > 0) {
      matchedProducts.push(...results);
    }
  }

  // Hilangkan duplikasi
  const uniqueProducts = Array.from(
    new Map(matchedProducts.map(p => [p.id, p])).values()
  );

  // Jika tidak ada kata kunci yang cocok, ambil ringkasan seluruh katalog (maks 10 produk)
  const productsToDisplay = uniqueProducts.length > 0 
    ? uniqueProducts 
    : db.getAllProducts().slice(0, 10);

  if (productsToDisplay.length === 0) {
    return '[DATA PRODUK & STOK DARI DATABASE]: Katalog produk saat ini masih kosong.';
  }

  const lines = productsToDisplay.map(p => {
    let line = `- [${p.sku ? p.sku + ' - ' : ''}${p.name}] | Kategori: ${p.category || 'Umum'} | Harga: Rp${Number(p.price).toLocaleString('id-ID')} | Stok: ${p.stock} unit`;
    if (p.description) line += ` | Deskripsi: ${p.description}`;
    if (p.product_knowledge) line += ` | Product Knowledge/Manfaat/Bahan: ${p.product_knowledge}`;
    return line;
  });

  // Kumpulkan rekomendasi produk terkait (upselling) untuk Fase 4B
  const relatedProductsList = [];
  if (uniqueProducts.length > 0) {
    for (const p of uniqueProducts) {
      if (p.related_products) {
        const ids = p.related_products.split(',').map(id => Number(id.trim())).filter(Boolean);
        for (const id of ids) {
          const relProd = db.getProductById ? db.getProductById(id) : null;
          if (relProd) {
            // Hindari duplikasi rekomendasi
            if (!relatedProductsList.some(rp => rp.id === relProd.id)) {
              relatedProductsList.push({ originName: p.name, ...relProd });
            }
          }
        }
      }
    }
  }

  let resultContext = `[DATA PRODUK & STOK DARI DATABASE]:\n${lines.join('\n')}`;

  if (relatedProductsList.length > 0) {
    const relLines = relatedProductsList.map(rp => 
      `- ${rp.name} — Rp${Number(rp.price).toLocaleString('id-ID')} (Rekomendasi terkait produk "${rp.originName}" yang sedang ditanyakan)`
    );
    resultContext += `\n\n[REKOMENDASI PRODUK TERKAIT]:\nPelanggan sedang bertanya tentang produk yang relevan. Jika natural, tawarkan produk terkait berikut:\n${relLines.join('\n')}`;
  }

  return resultContext;
}

/**
 * Membangun konteks data pengeluaran untuk Mode Personal.
 * @param {string} message 
 * @returns {string}
 */
function buildExpenseContext(message) {
  const lower = (message || '').toLowerCase();
  const isRekap = lower.includes('rekap') || lower.includes('laporan') || lower.includes('total') || lower.includes('pengeluaran');

  if (!isRekap) {
    return '[DATA PENGELUARAN DARI DATABASE]: Mode pencatatan siap menerima input.';
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const monthlyExpenses = db.getMonthlyExpenses(year, month);
  if (!monthlyExpenses || monthlyExpenses.length === 0) {
    return `[DATA PENGELUARAN DARI DATABASE]: Belum ada data pengeluaran yang dicatat untuk bulan ${month}/${year}.`;
  }

  const total = monthlyExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const items = monthlyExpenses.map(e => 
    `- ${e.created_at.substring(0, 10)} | ${e.category} | Rp${Number(e.amount).toLocaleString('id-ID')} (${e.note || '-'})`
  );

  return `[DATA PENGELUARAN DARI DATABASE (Bulan ${month}/${year})]:\nTotal: Rp${total.toLocaleString('id-ID')}\nRincian:\n${items.join('\n')}`;
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

  if (!isReminderQuery) return '';

  try {
    const activeReminders = db.getActiveReminders ? db.getActiveReminders() : [];
    if (!activeReminders || activeReminders.length === 0) {
      return '[DAFTAR PENGINGAT AKTIF]: Tidak ada pengingat yang sedang aktif saat ini.';
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

  if (!isNoteQuery) return '';

  try {
    const allNotes = db.getAllNotes ? db.getAllNotes(20) : [];
    if (!allNotes || allNotes.length === 0) {
      return '[DAFTAR CATATAN]: Belum ada catatan yang tersimpan.';
    }

    const lines = allNotes.map((n, i) => {
      const title = n.title || '(tanpa judul)';
      const tags = n.tags ? ` [${n.tags}]` : '';
      return `${i + 1}. "${title}": ${n.content.substring(0, 100)}${tags}`;
    });

    return `[DAFTAR CATATAN (${allNotes.length} catatan)]:\n${lines.join('\n')}`;
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
  const lower = (message || '').toLowerCase();
  const isTodoQuery = lower.includes('tugas') || lower.includes('todo') || lower.includes('selesai') || 
    lower.includes('done') || lower.includes('daftar tugas');

  if (!isTodoQuery) return '';

  try {
    const activeTodos = db.getActiveTodos ? db.getActiveTodos() : [];
    if (!activeTodos || activeTodos.length === 0) {
      return '[DAFTAR TUGAS AKTIF]: Tidak ada tugas yang sedang berjalan.';
    }

    const lines = activeTodos.map((t, i) => {
      const prio = t.priority === 'urgent' ? '🔴' : t.priority === 'low' ? '🔵' : '⚪';
      const due = t.due_date ? ` (deadline: ${t.due_date})` : '';
      return `${i + 1}. ${prio} ${t.task}${due}`;
    });

    return `[DAFTAR TUGAS AKTIF (${activeTodos.length} tugas)]:\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}

/**
 * Membangun konteks status budget untuk Mode Personal.
 * @param {string} message 
 * @returns {string}
 */
function buildBudgetContext(message) {
  const lower = (message || '').toLowerCase();
  const isBudgetQuery = lower.includes('budget') || lower.includes('anggaran') || lower.includes('batas') ||
    lower.includes('limit') || lower.includes('sisa anggaran');

  if (!isBudgetQuery) return '';

  try {
    const allBudgets = db.getAllBudgets ? db.getAllBudgets() : [];
    if (!allBudgets || allBudgets.length === 0) {
      return '[DAFTAR BUDGET]: Belum ada anggaran yang diatur.';
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthlyExpenses = db.getMonthlyExpenses ? db.getMonthlyExpenses(year, month) : [];

    const lines = allBudgets.map((b, i) => {
      const spent = monthlyExpenses
        .filter(e => e.category && e.category.toLowerCase() === b.category.toLowerCase())
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const percent = b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
      const remaining = b.monthly_limit - spent;
      const status = percent >= 100 ? '🔴 OVER' : percent >= b.alert_at_percent ? '🟡 WARNING' : '🟢 AMAN';
      return `${i + 1}. ${b.category}: Rp${spent.toLocaleString('id-ID')}/Rp${b.monthly_limit.toLocaleString('id-ID')} (${percent}%) ${status} — sisa Rp${remaining.toLocaleString('id-ID')}`;
    });

    return `[DAFTAR BUDGET BULAN INI (${allBudgets.length} anggaran)]:\n${lines.join('\n')}`;
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
  const lower = (message || '').toLowerCase();
  const isHabitQuery = lower.includes('habit') || lower.includes('kebiasaan') || lower.includes('streak') ||
    lower.includes('checkin') || lower.includes('check-in') || lower.includes('track');

  if (!isHabitQuery) return '';

  try {
    const activeHabits = db.getActiveHabits ? db.getActiveHabits() : [];
    if (!activeHabits || activeHabits.length === 0) {
      return '[DAFTAR KEBIASAAN]: Belum ada kebiasaan yang dilacak.';
    }

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
 * Membangun konteks gabungan untuk Mode Personal.
 * @param {string} message 
 * @returns {string}
 */
function buildPersonalContext(message) {
  const parts = [];
  parts.push(buildExpenseContext(message));

  const reminderCtx = buildRemindersContext(message);
  if (reminderCtx) parts.push(reminderCtx);

  const notesCtx = buildNotesContext(message);
  if (notesCtx) parts.push(notesCtx);

  const todosCtx = buildTodosContext(message);
  if (todosCtx) parts.push(todosCtx);

  const budgetCtx = buildBudgetContext(message);
  if (budgetCtx) parts.push(budgetCtx);

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
 * @param {string} contact 
 * @param {number} [limit=5] 
 * @returns {string}
 */
function buildChatHistoryContext(contact, limit = 5) {
  if (!contact) return '';
  try {
    const rawLogs = db.getChatLogsByContact(contact, limit);
    if (!rawLogs || rawLogs.length === 0) return '';

    // Balik urutan agar kronologis dari yang terlama ke terbaru
    const logs = [...rawLogs].reverse();
    const historyLines = logs.map(l => {
      const parts = [];
      if (l.message_in) parts.push(`- Pelanggan: "${l.message_in.replace(/\n/g, ' ')}"`);
      if (l.message_out) parts.push(`- Asisten/Bot: "${l.message_out.replace(/\n/g, ' ')}"`);
      return parts.join('\n');
    }).filter(Boolean);

    if (historyLines.length === 0) return '';

    return `[RIWAYAT PERCAKAPAN TERAKHIR DENGAN KONTAK INI]:\n${historyLines.join('\n')}`;
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

    return `[CONTOH GAYA PERCAKAPAN YANG DIINGINKAN (FEW-SHOT TRAINING)]:\nIkuti gaya komunikasi, keramahan, dan cara menjawab seperti contoh berikut:\n\n${formatted.join('\n\n')}`;
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
    }

    const dataContext = mode === 'bisnis' 
      ? buildBusinessContext(message) 
      : buildPersonalContext(message);
    parts.push(dataContext);

    const sampleContext = buildFewShotSamplesContext();
    if (sampleContext) parts.push(sampleContext);

    const historyContext = contact ? buildChatHistoryContext(contact, 5) : '';
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
  buildContext
};

