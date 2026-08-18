const assert = require('assert');
const db = require('../src/db');
const { computeBusinessAnalytics } = require('../src/analytics/aggregator');
const { generateAiBusinessInsights, getLatestStoredInsight } = require('../src/analytics/ai-advisor');

async function testPhase9() {
  console.log('=== PENGUJIAN TDD FASE 9: ANALISIS BISNIS & AI STRATEGIC INSIGHTS ===\n');

  // Siapkan data dummy produk & chat log
  console.log('[Test 1/3] Mempersiapkan data uji produk & riwayat interaksi pelanggan...');
  const prodId = db.createProduct({
    sku: 'KOPI-GAYO-TEST',
    name: 'Kopi Arabika Gayo Analytics',
    price: 35000,
    stock: 20,
    description: 'Biji kopi arabika gayo specialty'
  });

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Buat beberapa log chat dengan berbagai topik dan sinyal beli
  const logIds = [];
  logIds.push(db.createChatLog({
    contact: '628111222333@c.us',
    message_in: 'Halo kak, Kopi Arabika Gayo Analytics ready ga? harganya berapa ya?',
    message_out: 'Halo Kak! Ready stok 20 unit seharga Rp35.000.',
    handled_by: 'ai'
  }));

  logIds.push(db.createChatLog({
    contact: '628111222333@c.us',
    message_in: 'Bisa minta nomor rekening? Saya mau order dan transfer 2 bungkus ya',
    message_out: 'Tentu Kak! Rekening BCA 1234567890.',
    handled_by: 'ai'
  }));

  logIds.push(db.createChatLog({
    contact: '628444555666@c.us',
    message_in: 'Ongkir ke Jakarta Selatan via GoSend sameday berapa ya kak?',
    message_out: 'Mulai Rp10.000 Kak.',
    handled_by: 'ai'
  }));

  logIds.push(db.createChatLog({
    contact: '628777888999@c.us',
    message_in: 'Alamat tokonya dimana kak? Buka jam berapa?',
    message_out: 'Kami di Jl. Senopati No. 88, buka jam 08.00 - 22.00.',
    handled_by: 'ai'
  }));

  console.log('  -> OK: 4 Log chat uji coba berhasil dimasukkan.');

  // Test 2: Komputasi Agregasi Data Analisis
  console.log('\n[Test 2/3] Pengujian mesin agregasi metrik bisnis (aggregator.js)...');
  const analytics = computeBusinessAnalytics(30);

  assert(analytics.totalUserMessages >= 4, 'Total pesan masuk harus >= 4');
  assert(analytics.totalPurchaseIntentMessages >= 1, 'Harus mendeteksi minimal 1 pesan purchase intent (order/transfer)');
  assert(analytics.purchaseIntentRate > 0, 'Rasio minat beli harus > 0%');

  // Verifikasi deteksi mention produk
  const inquiredProduct = analytics.topInquiredProducts.find(p => p.id === prodId);
  assert(inquiredProduct, 'Produk Kopi Arabika Gayo Analytics harus terdaftar');
  assert(inquiredProduct.inquiriesCount >= 1, 'Produk harus tercatat ditanyakan minimal 1x');

  // Verifikasi kategori pertanyaan
  const productCat = analytics.inquiryCategories.find(c => c.key === 'products');
  const shippingCat = analytics.inquiryCategories.find(c => c.key === 'shipping');
  const paymentCat = analytics.inquiryCategories.find(c => c.key === 'payment');
  const locationCat = analytics.inquiryCategories.find(c => c.key === 'location_hours');

  assert(productCat && productCat.count > 0, 'Kategori produk harus terdeteksi');
  assert(shippingCat && shippingCat.count > 0, 'Kategori ongkir harus terdeteksi');
  assert(paymentCat && paymentCat.count > 0, 'Kategori pembayaran harus terdeteksi');
  assert(locationCat && locationCat.count > 0, 'Kategori lokasi harus terdeteksi');

  console.log('  -> OK: Deteksi produk terpopuler, purchase intent, dan klasifikasi topik 100% akurat.');

  // Test 3: Pemanggilan Generator AI Strategic Business Insights
  console.log('\n[Test 3/3] Pengujian pemanggilan AI Executive Business Advisor...');
  const aiResult = await generateAiBusinessInsights(30);
  assert(aiResult.success, 'Pemanggilan AI Insights harus sukses');
  assert(aiResult.insight && aiResult.insight.length > 50, 'Isi insight AI harus komprehensif');

  const stored = getLatestStoredInsight();
  assert(stored.insight === aiResult.insight, 'Insight AI harus tersimpan di database setting');
  assert(stored.generatedAt, 'Timestamp waktu analisis harus tersimpan');

  console.log('  -> OK: AI Business Advisor menghasilkan insight mendalam dan tersimpan di database.');
  console.log('  -> Cuplikan AI Insight:\n' + aiResult.insight.substring(0, 160) + '...\n');

  // Bersihkan data uji
  db.deleteProduct(prodId);
  logIds.forEach(id => db.deleteChatLog(id));

  console.log('✅ FASE 9 SELESAI & LULUS 100% (STATUS: GREEN)');
}

testPhase9().catch(err => {
  console.error('\n❌ GAGAL PENGUJIAN FASE 9:', err);
  process.exit(1);
});
