const assert = require('assert');
const db = require('../src/db');
const { 
  buildBusinessContext, 
  buildBusinessProfileContext,
  extractKeywords 
} = require('../src/ai/context-builder');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Memulai Pengujian Semantic Context & Full Catalog Visibility');
  console.log('================================================================\n');

  // Pastikan produk sample lengkap tersedia
  const sampleProducts = [
    { name: 'Sate Ayam Madura (10 Tusuk)', price: 25000, stock: 50, category: 'Makanan' },
    { name: 'Sate Sapi Maranggi (10 Tusuk)', price: 45000, stock: 20, category: 'Makanan' },
    { name: 'Sate Taichan Pedas (10 Tusuk)', price: 28000, stock: 30, category: 'Makanan' },
    { name: 'Es Jeruk Peras', price: 12000, stock: 40, category: 'Minuman' },
    { name: 'Ekstra Bumbu Kacang', price: 4000, stock: 100, category: 'Pelengkap' }
  ];

  const existingProds = db.getAllProducts ? db.getAllProducts() : [];
  for (const sample of sampleProducts) {
    if (!existingProds.some(p => p.name === sample.name)) {
      db.createProduct(sample);
    }
  }

  // 1. Uji Ekstraksi Kata Kunci Cerdas (Stopwords Generik)
  console.log('1️⃣ Menguji ekstraksi kata kunci cerdas...');
  const kw1 = extractKeywords('coba ada apa aha stok nya');
  assert.strictEqual(kw1.length, 0, 'Kata generik seperti "coba", "ada", "apa", "aha", "stok", "nya" harus difilter sebagai pertanyaan umum');
  console.log('   ✅ Kata-kata generik berhasil difilter agar tidak memotong pencarian katalog!\n');

  // 2. Uji buildBusinessContext untuk Pertanyaan Stok Umum
  console.log('2️⃣ Menguji buildBusinessContext saat pelanggan tanya stok umum ("coba ada apa aha stok nya")...');
  const ctxGeneral = buildBusinessContext('coba ada apa aha stok nya');
  
  assert.ok(ctxGeneral.includes('Sate Ayam Madura'), 'Harus menyertakan Sate Ayam Madura');
  assert.ok(ctxGeneral.includes('Sate Sapi Maranggi'), 'Harus menyertakan Sate Sapi Maranggi');
  assert.ok(ctxGeneral.includes('Sate Taichan Pedas'), 'Harus menyertakan Sate Taichan Pedas');
  assert.ok(ctxGeneral.includes('Es Jeruk Peras'), 'Harus menyertakan Es Jeruk Peras');
  assert.ok(ctxGeneral.includes('Ekstra Bumbu Kacang'), 'Harus menyertakan Ekstra Bumbu Kacang');
  console.log('   ✅ Seluruh produk katalog aktif dari database berhasil disuntikkan ke konteks AI!\n');

  // 3. Uji buildBusinessContext untuk Pertanyaan Produk Spesifik
  console.log('3️⃣ Menguji buildBusinessContext saat tanya produk spesifik ("sate maranggi harganya berapa")...');
  const ctxSpecific = buildBusinessContext('sate maranggi harganya berapa');
  assert.ok(ctxSpecific.includes('[PRODUK YANG PALING SESUAI DENGAN PERTANYAAN]'), 'Harus memiliki highlight produk relevan');
  assert.ok(ctxSpecific.includes('Sate Sapi Maranggi'), 'Harus menyorot Sate Sapi Maranggi');
  assert.ok(ctxSpecific.includes('[DATA PRODUK & STOK DARI DATABASE (SELURUH KATALOG TOKO)]'), 'Harus tetap menyediakan konteks katalog lengkap');
  console.log('   ✅ Produk spesifik berhasil disorot tanpa menghilangkan konteks produk lainnya!\n');

  // 4. Uji Guard Anti-Cegatan matchFaq untuk Pertanyaan Kontekstual
  console.log('4️⃣ Menguji Guard Anti-Cegatan matchFaq (Pertanyaan Kontekstual vs Template Statis)...');
  
  // Pastikan ada FAQ lokasi
  db.createFaq({
    trigger_keywords: 'lokasi, alamat, outlet, cabang',
    question_label: 'Lokasi Outlet',
    answer: 'Outlet kami di Jl. Merdeka No. 45 Bandung.'
  });

  // Uji pertanyaan: "saya lokasi di jakarta , bisa ga ya?"
  const matched1 = db.matchFaq('saya lokasi di jakarta , bisa ga ya?');
  assert.strictEqual(matched1, null, 'Pertanyaan "saya lokasi di jakarta , bisa ga ya?" TIDAK boleh dicegat oleh FAQ alamat!');
  console.log('   ✅ "saya lokasi di jakarta , bisa ga ya?" berhasil diloloskan ke AI!');

  // Uji pertanyaan: "bisa kirim ke jakarta ?"
  const matched2 = db.matchFaq('bisa kirim ke jakarta ?');
  assert.strictEqual(matched2, null, 'Pertanyaan "bisa kirim ke jakarta ?" TIDAK boleh dicegat oleh FAQ pengiriman!');
  console.log('   ✅ "bisa kirim ke jakarta ?" berhasil diloloskan ke AI!');

  // Uji pertanyaan direct/langsung: "alamat outlet dimana"
  const matched3 = db.matchFaq('alamat outlet');
  assert.ok(matched3, 'Pertanyaan langsung "alamat outlet" harus cocok dengan FAQ');
  console.log(`   ✅ Pertanyaan langsung "alamat outlet" tetap dijawab cepat: "${matched3.question_label}"\n`);

  // 5. Uji Injeksi FAQ ke buildBusinessProfileContext untuk Referensi Semantik AI
  console.log('5️⃣ Menguji Injeksi FAQ ke Pengetahuan Semantik AI (buildBusinessProfileContext)...');
  const profileCtx = buildBusinessProfileContext();
  assert.ok(profileCtx.includes('[PANDUAN INFORMASI & FAQ TOKO]'), 'FAQ harus disuntikkan sebagai panduan pengetahuan AI');
  console.log('   ✅ FAQ berhasil dijadikan panduan pengetahuan cerdas untuk AI!\n');

  console.log('================================================================');
  console.log('🎉 SEMUA PENGUJIAN SEMANTIC CONTEXT & CATALOG BERHASIL (100%)!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('❌ Pengujian Gagal:', err);
  process.exit(1);
});
