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

  return `[DATA PRODUK & STOK DARI DATABASE]:\n${lines.join('\n')}`;
}

/**
 * Membangun konteks data pengeluaran untuk Mode Personal.
 * @param {string} message 
 * @returns {string}
 */
function buildPersonalContext(message) {
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
 * Fungsi utama untuk membangun konteks berbasis mode dan pesan.
 * @param {string} message 
 * @param {'bisnis'|'personal'} mode 
 * @param {string} [contact] 
 * @returns {string}
 */
function buildContext(message, mode = 'bisnis', contact = null) {
  try {
    const parts = [];
    
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

module.exports = {
  extractKeywords,
  buildBusinessProfileContext,
  buildBusinessContext,
  buildPersonalContext,
  buildChatHistoryContext,
  buildFewShotSamplesContext,
  buildContext
};
