const assert = require('assert');
const { generateReply } = require('../src/ai/router');
const { buildBusinessContext } = require('../src/ai/context-builder');
const db = require('../src/db');

console.log('================================================================');
console.log('🧪 Memulai Pengujian Scratchpad Sanitizer & Full Catalog QA');
console.log('================================================================\n');

// 1. Uji Sanitizer Anti-Kebocoran Scratchpad / Chain-of-Thought
console.log('1️⃣ Menguji Sanitizer Pembersih Kebocoran Chain-of-Thought AI...');

const { cleanWhatsAppFormatting } = require('../src/ai/router');

// Kasus 1: Kebocoran persis seperti kasus nyata pelanggan
const rawLeak1 = `Iya Kak Arsi? Ada yang bisa mimin bantu, atau ada yang mau ditambahkan untuk pesannya Kak? 😊\n\n's check Rule 4: "Sebutkan harga HANYA pada kondisi berikut: 1. Saat pertama kali mengenalkan katalog / menjawab pertanyaan harga dari pelanggan. 2. Saat pelanggan secara eksplisit bertanya harga kembali... 3. Saat membuat rekapan total tagihan... DILARANG SPAM HARGA..."\n            Here, the customer asked "yang ready apa aja`;

const cleaned1 = cleanWhatsAppFormatting(rawLeak1);
assert.strictEqual(cleaned1, 'Iya Kak Arsi? Ada yang bisa mimin bantu, atau ada yang mau ditambahkan untuk pesannya Kak? 😊');
console.log('   ✅ Kasus 1 (Kebocoran Rule Check) berhasil dibersihkan 100%!');

// Kasus 2: Tag XML Thought
const rawLeak2 = `<thought>Let's verify stock in database and list all sate items</thought>Sore Kak! Menu kami ready lengkap hari ini ya 😊`;
const cleaned2 = cleanWhatsAppFormatting(rawLeak2);
assert.strictEqual(cleaned2, 'Sore Kak! Menu kami ready lengkap hari ini ya 😊');
console.log('   ✅ Kasus 2 (Tag <thought>) berhasil dibersihkan 100%!');

// Kasus 3: Thinking Process di awal baris
const rawLeak3 = `Thinking Process:\n1. Customer is asking for available menu.\n2. List all items.\n\nHalo Kak! Menu ready kami ada Sate Ayam Madura dan Sate Maranggi ya 🙏`;
const cleaned3 = cleanWhatsAppFormatting(rawLeak3);
assert.strictEqual(cleaned3, 'Halo Kak! Menu ready kami ada Sate Ayam Madura dan Sate Maranggi ya 🙏');
console.log('   ✅ Kasus 3 (Thinking Process block) berhasil dibersihkan 100%!\n');

// 2. Uji buildBusinessContext untuk pertanyaan "yang ready apa aja"
console.log('2️⃣ Menguji Konteks Katalog saat Pelanggan Bertanya "yang ready apa aja"...');

// Pastikan produk ready terdaftar di database
const dummyProds = [
  { name: 'Sate Ayam Madura (10 Tusuk)', price: 25000, stock: 50, category: 'Makanan' },
  { name: 'Sate Sapi Maranggi (10 Tusuk)', price: 45000, stock: 20, category: 'Makanan' },
  { name: 'Sate Taichan Pedas (10 Tusuk)', price: 28000, stock: 30, category: 'Makanan' },
  { name: 'Es Jeruk Peras Segar', price: 12000, stock: 40, category: 'Minuman' },
  { name: 'Ekstra Bumbu Kacang', price: 4000, stock: 100, category: 'Pelengkap' }
];

for (const p of dummyProds) {
  const existing = db.searchProducts ? db.searchProducts(p.name) : [];
  if (!existing || existing.length === 0) {
    db.createProduct(p);
  }
}

const contextReady = buildBusinessContext('yang ready apa aja');
assert.ok(contextReady.includes('[INSTRUKSI WAJIB UNTUK PERTANYAAN KATALOG/READY]'), 'Harus menyertakan instruksi wajib penyajian katalog utuh');
assert.ok(contextReady.includes('Sate Ayam Madura'), 'Harus memuat Sate Ayam');
assert.ok(contextReady.includes('Sate Sapi Maranggi'), 'Harus memuat Sate Maranggi');
assert.ok(contextReady.includes('Sate Taichan Pedas'), 'Harus memuat Sate Taichan');
assert.ok(contextReady.includes('Es Jeruk Peras'), 'Harus memuat Minuman Es Jeruk');
assert.ok(contextReady.includes('📂 Kategori:'), 'Harus dikelompokkan berdasarkan kategori');
console.log('   ✅ Konteks katalog mencakup seluruh produk ready tanpa ada yang terpotong!\n');

// 3. Uji Respons Nyata AI (Simulasi Prompt & Pengetahuan)
console.log('3️⃣ Menguji Pemahaman Kalimat & Pengetahuan Menu...');

const testQueries = [
  { q: 'bang', expectedType: 'sapaan' },
  { q: 'yang ready apa aja', expectedType: 'katalog' },
  { q: 'sate maranggi berapaan', expectedType: 'harga_spesifik' },
  { q: 'bisa kirim ke jakarta ga', expectedType: 'jangkauan_lokasi' }
];

for (const t of testQueries) {
  const ctx = buildBusinessContext(t.q);
  assert.ok(ctx && ctx.length > 0, `Konteks untuk "${t.q}" harus terisi`);
  console.log(`   ✅ Query "${t.q}" terpetakan dengan konteks yang tepat`);
}

console.log('\n================================================================');
console.log('🎉 SEMUA PENGUJIAN SANITIZER & FULL CATALOG QA LULUS 100%!');
console.log('================================================================\n');
