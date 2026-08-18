const { getConfig } = require('../config');
const db = require('../db');
const { computeBusinessAnalytics } = require('./aggregator');
const { generateReply } = require('../ai/router');

/**
 * Menghasilkan Analisis Bisnis & AI Strategic Insights menggunakan model AI.
 * @param {number} [days=30]
 * @returns {Promise<object>}
 */
async function generateAiBusinessInsights(days = 30) {
  const config = getConfig();
  const analyticsData = computeBusinessAnalytics(days);

  // Susun data ringkasan metrik untuk prompt AI
  const topProductsSummary = analyticsData.topInquiredProducts.slice(0, 5).map(p => 
    `- ${p.name} (Stok: ${p.stock}, Ditanyakan: ${p.inquiriesCount}x, Closing Intent: ${p.closingIntentCount}x)`
  ).join('\n') || '- Belum ada data mention produk.';

  const topCategoriesSummary = analyticsData.inquiryCategories.map(c => 
    `- ${c.label}: ${c.count} pertanyaan (${c.percentage}%)`
  ).join('\n');

  const sampleChats = analyticsData.recentIntentConversations.slice(0, 3).map((c, i) => 
    `Sampel #${i+1} [${c.time}]:\n  Pelanggan: "${c.message}"\n  Bot: "${(c.reply || '').substring(0, 100)}..."`
  ).join('\n\n') || '- Belum ada riwayat percakapan.';

  const promptMessage = `
[PERMINTAAN ANALISIS EKSEKUTIF BISNIS DARI DATA WHATSAPP BOT]
Nama Usaha: ${config.business_name || 'Toko / Usaha Kami'}
Mode Bot: ${config.mode || 'bisnis'}
Periode Data: ${days} hari terakhir

DATA METRIK AKTUAL DARI DATABASE:
- Total Pesan Masuk Pelanggan: ${analyticsData.totalUserMessages} pesan
- Pesan Niat Beli / Closing (Purchase Intent): ${analyticsData.totalPurchaseIntentMessages} (${analyticsData.purchaseIntentRate}% dari total)
- Jam Paling Sibuk (Peak Hour): ${analyticsData.peakHourRange}

PRODUK PALING BANYAK DITANYAKAN:
${topProductsSummary}

KATEGORI PERTANYAAN PELANGGAN:
${topCategoriesSummary}

SAMPEL PERCAKAPAN DENGAN NIAT BELI TINGGI:
${sampleChats}

INSTRUKSI UNTUK AI BUSINESS STRATEGIST:
Tolong berikan Analisis Eksekutif & Insight Pertumbuhan Bisnis yang mendalam, berbobot, tajam, dan aplikatif dalam bahasa Indonesia yang profesional namun mudah dipahami. Susun dalam 4 bagian:

1. 📊 RINGKASAN TREN & MINAT PELANGGAN
Jelaskan pola ketertarikan pembeli dari data chat di atas.

2. 🚀 PELUANG PENJUALAN & UPSELLING POTENSIAL
Identifikasi produk mana yang paling berpotensi dinaikkan omsetnya, peluang bundling produk, atau penambahan stok.

3. ⚠️ TITIK HAMBATAN & PENYEBAB KERAGUAN PEMBELI
Analisis apa yang mungkin membuat pembeli ragu untuk transfer/checkout (misal: ongkir, info pengiriman, metode pembayaran, atau ketersediaan varian).

4. 🎯 REKOMENDASI AKSI KONKRET (ACTIONABLE ADVICE)
Berikan 3 - 4 langkah konkret yang bisa langsung dieksekusi pemilik toko minggu ini (promo, perbaikan katalog/SOP, atau penawaran khusus).
`;

  try {
    const aiResponse = await generateReply({
      message: promptMessage,
      mode: 'bisnis'
    });

    const insightText = aiResponse.reply || 'AI tidak menghasilkan analisis.';
    const nowIso = new Date().toISOString();

    // Simpan ke SQLite settings
    db.setSetting('latest_ai_insight', insightText);
    db.setSetting('latest_ai_insight_time', nowIso);

    return {
      success: true,
      insight: insightText,
      generatedAt: nowIso,
      analyticsData
    };
  } catch (error) {
    console.error('[AiAdvisor] Gagal menghasilkan analisis AI:', error.message);
    return {
      success: false,
      error: error.message,
      insight: 'Gagal memproses analisis AI saat ini. Silakan periksa koneksi internet atau kunci API Anda.',
      analyticsData
    };
  }
}

/**
 * Mengambil analisis AI tersimpan terakhir.
 * @returns {object}
 */
function getLatestStoredInsight() {
  const insight = db.getSetting ? db.getSetting('latest_ai_insight') : null;
  const time = db.getSetting ? db.getSetting('latest_ai_insight_time') : null;
  return {
    insight: insight || null,
    generatedAt: time || null
  };
}

module.exports = {
  generateAiBusinessInsights,
  getLatestStoredInsight
};
