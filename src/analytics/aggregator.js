const db = require('../db');

/**
 * Pola kata kunci untuk deteksi niat beli (Purchase Intent & Closing).
 */
const PURCHASE_INTENT_KEYWORDS = [
  'order', 'pesan', 'beli', 'checkout', 'transfer', 'rekening', 'no rek',
  'bayar', 'ambil', 'cod', 'kirim sekarang', 'total berapa', 'jadi pesan',
  'fix order', 'mau ambil', 'bungkus', 'kirim ke', 'alamat saya'
];

/**
 * Pola klasifikasi topik pertanyaan pelanggan.
 */
const INQUIRY_CATEGORIES = {
  products: {
    label: 'Katalog, Harga & Ketersediaan Stok',
    keywords: ['harga', 'berapa', 'katalog', 'menu', 'list', 'stok', 'ready', 'ada ga', 'masih ada', 'varian', 'rasa', 'ukuran', 'jenis', 'beda']
  },
  shipping: {
    label: 'Ongkir & Jasa Pengiriman',
    keywords: ['ongkir', 'ongkos kirim', 'kirim', 'gosend', 'grab', 'sameday', 'instant', 'jne', 'j&t', 'sicepat', 'paxel', 'ekspedisi', 'kapan sampai', 'kurir']
  },
  payment: {
    label: 'Metode Pembayaran & No. Rekening',
    keywords: ['bayar', 'transfer', 'rekening', 'no rek', 'bca', 'mandiri', 'bri', 'qris', 'dana', 'gopay', 'ovo', 'cod', 'debit']
  },
  location_hours: {
    label: 'Alamat Toko & Jam Operasional',
    keywords: ['alamat', 'lokasi', 'toko', 'dimana', 'buka jam', 'tutup jam', 'bisa ke toko', 'patokan', 'tempat', 'daerah']
  },
  warranty_return: {
    label: 'Garansi, Kebijakan Retur & Komplain',
    keywords: ['garansi', 'retur', 'rusak', 'pecah', 'bocor', 'tukar', 'komplain', 'unboxing', 'salah kirim', 'basi']
  },
  negotiation: {
    label: 'Nego Harga, Diskon & Grosir',
    keywords: ['nego', 'tawar', 'diskon', 'kurang', 'pas', 'potongan', 'grosir', 'reseller', 'partai', 'murahin']
  }
};

/**
 * Melakukan komputasi analisis komprehensif dari riwayat chat dan katalog produk.
 * @param {number} [days=30]
 * @returns {object}
 */
function computeBusinessAnalytics(days = 30) {
  const products = db.getAllProducts ? db.getAllProducts() : [];
  const logs = db.getLogsForAnalytics ? db.getLogsForAnalytics(days) : [];
  const generalStats = db.getGeneralChatStats ? db.getGeneralChatStats() : {};

  // 1. Pelacakan Produk Sering Ditanyakan & Sering Closing
  const productStatsMap = {};
  products.forEach(p => {
    productStatsMap[p.id] = {
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      price: p.price || 0,
      stock: p.stock || 0,
      inquiriesCount: 0,
      closingIntentCount: 0
    };
  });

  // 2. Inquiries Category Counter
  const categoryCounts = {
    products: 0,
    shipping: 0,
    payment: 0,
    location_hours: 0,
    warranty_return: 0,
    negotiation: 0
  };

  // 3. Hourly Activity (0 - 23)
  const hourlyDistribution = Array(24).fill(0);

  let totalUserMessages = 0;
  let totalPurchaseIntentMessages = 0;
  const recentIntentConversations = [];

  logs.forEach(log => {
    const textIn = (log.message_in || '').toLowerCase();
    if (!textIn) return;
    totalUserMessages++;

    // Hitung Jam Masuk Pesan
    if (log.created_at) {
      try {
        const dateObj = new Date(log.created_at.replace(' ', 'T') + 'Z');
        const hour = dateObj.getHours();
        if (hour >= 0 && hour < 24) {
          hourlyDistribution[hour]++;
        }
      } catch (_) {}
    }

    // Deteksi Purchase Intent (Niat Beli / Closing)
    const hasPurchaseIntent = PURCHASE_INTENT_KEYWORDS.some(kw => textIn.includes(kw));
    if (hasPurchaseIntent) {
      totalPurchaseIntentMessages++;
      if (recentIntentConversations.length < 5) {
        recentIntentConversations.push({
          contact: log.contact,
          message: log.message_in,
          reply: log.message_out,
          time: log.created_at
        });
      }
    }

    // Deteksi Mention Produk
    products.forEach(p => {
      const pName = p.name.toLowerCase();
      const pSku = (p.sku || '').toLowerCase();
      const isMentioned = (pName.length >= 3 && textIn.includes(pName)) || 
                          (pSku.length >= 2 && textIn.includes(pSku));

      if (isMentioned) {
        productStatsMap[p.id].inquiriesCount++;
        if (hasPurchaseIntent) {
          productStatsMap[p.id].closingIntentCount++;
        }
      }
    });

    // Deteksi Kategori Pertanyaan
    Object.keys(INQUIRY_CATEGORIES).forEach(catKey => {
      const { keywords } = INQUIRY_CATEGORIES[catKey];
      const match = keywords.some(kw => textIn.includes(kw));
      if (match) {
        categoryCounts[catKey]++;
      }
    });
  });

  // Ranking Produk Berdasarkan Jumlah Pertanyaan
  const topInquiredProducts = Object.values(productStatsMap)
    .sort((a, b) => b.inquiriesCount - a.inquiriesCount);

  // Ranking Produk Berdasarkan Niat Beli / Closing
  const topClosingProducts = Object.values(productStatsMap)
    .filter(p => p.closingIntentCount > 0)
    .sort((a, b) => b.closingIntentCount - a.closingIntentCount);

  // Format Kategori Pertanyaan
  const totalCategoryHits = Object.values(categoryCounts).reduce((a, b) => a + b, 0) || 1;
  const formattedCategories = Object.keys(INQUIRY_CATEGORIES).map(catKey => {
    const count = categoryCounts[catKey];
    const percentage = Math.round((count / totalCategoryHits) * 100);
    return {
      key: catKey,
      label: INQUIRY_CATEGORIES[catKey].label,
      count,
      percentage
    };
  }).sort((a, b) => b.count - a.count);

  // Tingkat Konversi Minat Beli
  const purchaseIntentRate = totalUserMessages > 0
    ? Math.round((totalPurchaseIntentMessages / totalUserMessages) * 100)
    : 0;

  // Temukan Jam Paling Ramai (Peak Hours)
  let peakHour = 0;
  let maxHourCount = 0;
  hourlyDistribution.forEach((count, h) => {
    if (count > maxHourCount) {
      maxHourCount = count;
      peakHour = h;
    }
  });

  return {
    daysAnalyzed: days,
    generalStats,
    totalUserMessages,
    totalPurchaseIntentMessages,
    purchaseIntentRate,
    peakHourRange: `${String(peakHour).padStart(2, '0')}.00 - ${String((peakHour + 1) % 24).padStart(2, '0')}.00 WIB`,
    topInquiredProducts,
    topClosingProducts,
    inquiryCategories: formattedCategories,
    hourlyDistribution,
    recentIntentConversations
  };
}

module.exports = {
  PURCHASE_INTENT_KEYWORDS,
  INQUIRY_CATEGORIES,
  computeBusinessAnalytics
};
