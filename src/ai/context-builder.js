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

  const lines = productsToDisplay.map(p => 
    `- Nama: ${p.name} | Harga: Rp${Number(p.price).toLocaleString('id-ID')} | Stok: ${p.stock} unit | Deskripsi: ${p.description || '-'}`
  );

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
 * Fungsi utama untuk membangun konteks berbasis mode dan pesan.
 * @param {string} message 
 * @param {'bisnis'|'personal'} mode 
 * @returns {string}
 */
function buildContext(message, mode = 'bisnis') {
  try {
    if (mode === 'bisnis') {
      return buildBusinessContext(message);
    }
    return buildPersonalContext(message);
  } catch (error) {
    console.error('[ContextBuilder] Error saat membangun konteks:', error.message);
    return '[DATA DATABASE]: Gagal memuat data lokal.';
  }
}

module.exports = {
  extractKeywords,
  buildBusinessContext,
  buildPersonalContext,
  buildContext
};
