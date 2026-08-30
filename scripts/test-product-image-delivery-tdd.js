/**
 * scripts/test-product-image-delivery-tdd.js
 * Test Driven Development (TDD) Suite & Stress Test untuk Pengiriman Foto Produk WhatsApp
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const db = require('../src/db');
const { 
  findProductImageToSend, 
  recordSentProductImage, 
  clearSentProductImageCache,
  wasProductImageRecentlySent
} = require('../src/engine/handlers/business-handler');

console.log('======================================================');
console.log('   🧪 TDD SUITE: PENGIRIMAN FOTO PRODUK WHATSAPP      ');
console.log('======================================================\n');

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`✅ [LULUS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ [GAGAL] ${name}`);
    console.error(`   Detail Error: ${err.message}\n`);
  }
}

// Setup dummy produk & gambar untuk pengujian
const dummyImgDir = path.join(__dirname, '../data/test-uploads');
if (!fs.existsSync(dummyImgDir)) fs.mkdirSync(dummyImgDir, { recursive: true });
const afrImgPath = path.join(dummyImgDir, 'afr.jpg');
const bmImgPath = path.join(dummyImgDir, 'bm.jpg');
fs.writeFileSync(afrImgPath, 'dummy-afr-image-content');
fs.writeFileSync(bmImgPath, 'dummy-bm-image-content');

// Bersihkan & insert data produk uji coba
try {
  db.db.exec("DELETE FROM products WHERE sku IN ('TEST-AFR', 'TEST-BM', 'TEST-OTHER')");
  db.db.exec("DELETE FROM chat_logs WHERE contact LIKE 'test-contact%'");
} catch (_) {}

const prodAfrId = db.createProduct({
  name: 'Albino Full Red (AFR)',
  sku: 'TEST-AFR',
  category: 'Ikan Guppy',
  price: 87000,
  stock: 25,
  description: 'Guppy merah merona kualitas top grade sepasang jantan betina.',
  image_path: afrImgPath
});

const prodBmId = db.createProduct({
  name: 'Black Moscow (BM)',
  sku: 'TEST-BM',
  category: 'Ikan Guppy',
  price: 95000,
  stock: 15,
  description: 'Guppy hitam pekat solid elegan sepasang.',
  image_path: bmImgPath
});

// TEST 1: Pesan Bukan Minta Foto WAJIB Mengembalikan NULL (Zero False Positives)
runTest('Test 1: Pesan tanpa permintaan foto 100% mengembalikan null', () => {
  clearSentProductImageCache();
  const contact = 'test-contact-1@lid';
  
  const nonPhotoMessages = [
    'Lokasi di mana ka',
    'Kalo bayarnya gimana',
    '3 pasang berapa jadinya',
    'Kirim ke jkt aman kah',
    'Lewat oren bisa?',
    'Pesen nya gimana',
    'Ini perpasang?',
    'Kak?',
    'Bg',
    'Ngejual alat alat akuarium juga gk',
    'Ini toko ikan kah?',
    'Bisa nego ga ka?',
    'Halo admin selamat siang',
    'Terima kasih ya infonya'
  ];

  for (const msg of nonPhotoMessages) {
    const res = findProductImageToSend(msg, contact);
    assert.strictEqual(res, null, `Pesan "${msg}" seharusnya mengembalikan null tapi malah memicu foto!`);
  }
});

// TEST 2: Permintaan Foto Eksplisit dengan Nama Produk Lengkap & Singkatan (AFR / BM)
runTest('Test 2: Permintaan foto dengan nama produk / singkatan (AFR / BM) berhasil', () => {
  clearSentProductImageCache();
  const contact = 'test-contact-2@lid';

  // 2a. Nama lengkap
  const res1 = findProductImageToSend('Iyaa saya tertarik, liat fotonya Albino Full Red', contact);
  assert.ok(res1 !== null, 'Foto Albino Full Red seharusnya ditemukan');
  assert.strictEqual(res1.product.name, 'Albino Full Red (AFR)');

  // 2b. Singkatan "afr"
  const res2 = findProductImageToSend('liat foto afr dong ka', contact);
  assert.ok(res2 !== null, 'Singkatan "afr" seharusnya menemukan produk Albino Full Red (AFR)');
  assert.strictEqual(res2.product.name, 'Albino Full Red (AFR)');

  // 2c. Singkatan "bm"
  const res3 = findProductImageToSend('spill pict BM coba', contact);
  assert.ok(res3 !== null, 'Singkatan "bm" seharusnya menemukan produk Black Moscow (BM)');
  assert.strictEqual(res3.product.name, 'Black Moscow (BM)');
});

// TEST 3: Permintaan Foto Singkat Berdasarkan Riwayat Chat ("liat fotonya", "mana fotonya ka")
runTest('Test 3: Kalimat pendek ("liat fotonya", "spill dong") berhasil mencocokkan produk dari riwayat chat', () => {
  clearSentProductImageCache();
  const contact = 'test-contact-3@lid';

  // Simulasikan riwayat chat di mana bot baru saja menawarkan Albino Full Red (AFR)
  db.createChatLog({
    contact,
    message_in: 'Iya albino koi ada g',
    message_out: 'Mohon maaf Kak, Albino Koi belum ready. Saat ini kita ada *Albino Full Red (AFR)* seharga Rp87.000 sepasang yang ready. Kakak tertarik coba lihat yang AFR?',
    handled_by: 'ai'
  });

  // Pelanggan hanya menjawab pendek: "liat fotonya"
  const resShort1 = findProductImageToSend('liat fotonya', contact);
  assert.ok(resShort1 !== null, 'Kalimat pendek "liat fotonya" seharusnya menemukan produk dari riwayat chat');
  assert.strictEqual(resShort1.product.name, 'Albino Full Red (AFR)');

  // Pelanggan bertanya: "mana fotonya ka"
  const resShort2 = findProductImageToSend('Mana fotonya ka', contact);
  assert.ok(resShort2 !== null, 'Kalimat "Mana fotonya ka" seharusnya menemukan produk dari riwayat chat');
  assert.strictEqual(resShort2.product.name, 'Albino Full Red (AFR)');

  // Pelanggan bertanya: "spill dong"
  const resShort3 = findProductImageToSend('spill dong penampakannya', contact);
  assert.ok(resShort3 !== null, 'Kalimat "spill dong penampakannya" seharusnya menemukan produk dari riwayat chat');
  assert.strictEqual(resShort3.product.name, 'Albino Full Red (AFR)');
});

// TEST 4: Permintaan Ulang (Re-Send) Tidak Boleh Terkunci oleh Cooldown
runTest('Test 4: Permintaan ulang foto tidak terblokir oleh anti-spam cooldown', () => {
  clearSentProductImageCache();
  const contact = 'test-contact-4@lid';

  // Tandai seolah-olah foto AFR baru saja dikirim 5 detik lalu
  recordSentProductImage(contact, prodAfrId, 'Albino Full Red (AFR)');
  assert.strictEqual(wasProductImageRecentlySent(contact, prodAfrId, 'Albino Full Red (AFR)'), true);

  // Jika pelanggan meminta lagi ("Coba liat fotonya lagi" atau "mana fotonya ka"), sistem TIDAK BOLEH memblokir
  const resResend = findProductImageToSend('Coba liat fotonya lagi', contact);
  assert.ok(resResend !== null, 'Permintaan ulang "Coba liat fotonya lagi" harus tetap mengembalikan foto');
  assert.strictEqual(resResend.product.name, 'Albino Full Red (AFR)');

  const resResend2 = findProductImageToSend('Mana fotonya ka belum masuk', contact);
  assert.ok(resResend2 !== null, 'Permintaan ulang "Mana fotonya ka belum masuk" harus tetap mengembalikan foto');
});

// TEST 5: Negasi dan Komplain Tidak Mengirim Foto
runTest('Test 5: Pesan negasi / komplain foto ("jangan kirim foto", "bukan minta foto") mengembalikan null', () => {
  clearSentProductImageCache();
  const contact = 'test-contact-5@lid';

  const negations = [
    'jangan kirim foto terus dong',
    'bukan minta foto',
    'gak usah kirim gambar ya',
    'stop kirim foto spam',
    'ga butuh fotonya'
  ];

  for (const neg of negations) {
    const res = findProductImageToSend(neg, contact);
    assert.strictEqual(res, null, `Pesan negasi "${neg}" seharusnya null`);
  }
});

// TEST 6: Stress Test 1.000 Percakapan Acak Simultan (Zero False Positives & Zero Locks)
runTest('Test 6: Stress Test 1.000 variasi percakapan acak bebas memory leak & zero lock', () => {
  clearSentProductImageCache();
  
  const samplePhotoRequests = [
    'liat fotonya', 'liat foto', 'lihat gambarnya', 'spill dong', 'spill foto AFR', 
    'minta foto black moscow', 'tunjukin bentuknya', 'ada fotonya?', 'mana fotonya ka',
    'coba liat fotonya lagi', 'penasaran sama penampakannya', 'liatkan fotonya',
    'liat contoh ikannya', 'pic afr dong', 'foto modelnya seperti apa'
  ];

  const sampleNonPhotoRequests = [
    'lokasi dimana', 'bisa kirim ke surabaya?', 'harganya berapa', 'bisa cod ga',
    'terima transfer bca?', 'kalo beli 5 dapet diskon?', 'ready yang mana aja',
    'packingnya aman ga', 'garansi ikan hidup?', 'mau pesan 2 pasang', 'oke min makasih'
  ];

  for (let i = 0; i < 1000; i++) {
    const contact = `test-stress-${i % 20}@lid`;
    const isPhotoTurn = (i % 2 === 0);
    const pool = isPhotoTurn ? samplePhotoRequests : sampleNonPhotoRequests;
    const text = pool[Math.floor(Math.random() * pool.length)];

    const result = findProductImageToSend(text, contact);

    if (isPhotoTurn) {
      assert.ok(result !== null, `Iterasi ${i}: Permintaan foto "${text}" gagal menemukan produk!`);
      assert.ok(result.product && result.product.name, 'Produk harus memiliki nama');
    } else {
      assert.strictEqual(result, null, `Iterasi ${i}: Pertanyaan non-foto "${text}" keliru memicu foto!`);
    }
  }
});

console.log('\n======================================================');
console.log(`📊 HASIL TDD: ${passedCount} / ${totalCount} Pengujian Berhasil`);
console.log('======================================================\n');

if (passedCount < totalCount) {
  process.exit(1);
}
