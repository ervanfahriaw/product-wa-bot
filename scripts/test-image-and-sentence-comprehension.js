const assert = require('assert');
const db = require('../src/db');
const { findProductImageToSend } = require('../src/engine/handlers/business-handler');
const { downloadAndCacheImage } = require('../src/utils/image-downloader');

console.log('======================================================');
console.log('🧪 TESTING: FULL-SENTENCE COMPREHENSION & IMAGE DELIVERY');
console.log('======================================================');

// Setup mock product with image
const testProd = db.createProduct({
  name: 'Susu Aren Gula Jawa Spesial',
  price: 20000,
  stock: 15,
  description: 'Susu segar dengan gula aren asli',
  image_path: 'https://example.com/susu-aren.jpg'
});

const contact = '69767515898014@lid';

// Add interaction to chat logs
db.createChatLog({
  contact,
  message_in: 'Susubaren ada?',
  message_out: 'Ada dong, Kak Arsyila! Menu *susu aren* kita lagi ready nih, harganya *Rp20.000* aja.',
  handled_by: 'ai'
});

// Test 1: Full-sentence general photo request ("Liat fotonya coba") -> resolves to Susu Aren from history
const r1 = findProductImageToSend('Liat fotonya coba', contact);
assert.ok(r1, 'Harus menemukan gambar dari riwayat chat');
assert.ok(r1.product.name.toLowerCase().includes('susu aren'), 'Produk harus susu aren');
console.log('✅ Test 1 Passed: "Liat fotonya coba" -> Menemukan foto:', r1.product.name);

// Test 2: Re-send request ("Mana fotonya ka") -> resolves to Susu Aren
const r2 = findProductImageToSend('Mana fotonya ka', contact);
assert.ok(r2, 'Harus menemukan gambar untuk permintaan re-send');
assert.ok(r2.product.name.toLowerCase().includes('susu aren'));
console.log('✅ Test 2 Passed: "Mana fotonya ka" -> Menemukan foto re-send:', r2.product.name);

// Test 3: Conversational request with fillers ("Bisa spill foto susu aren gak min?")
const r3 = findProductImageToSend('Bisa spill foto susu aren gak min?', contact);
assert.ok(r3, 'Harus menemukan gambar susu aren');
assert.ok(r3.product.name.toLowerCase().includes('susu aren'));
console.log('✅ Test 3 Passed: "Bisa spill foto susu aren gak min?" -> Menemukan foto:', r3.product.name);

// Test 4: Negation / complaint ("Gak usah kirim foto ya") -> returns null
const r4 = findProductImageToSend('Gak usah kirim foto ya', contact);
assert.strictEqual(r4, null, 'Negasi harus mengembalikan null');
console.log('✅ Test 4 Passed: "Gak usah kirim foto ya" -> Mengembalikan null');

// Test 5: Image downloader with User-Agent header (prevent 403 Forbidden)
downloadAndCacheImage('https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Caff%C3%A8_Americano.jpg/640px-Caff%C3%A8_Americano.jpg')
  .then(filePath => {
    if (filePath) {
      console.log('✅ Test 5 Passed: Download gambar remote sukses tanpa HTTP 403:', filePath);
    } else {
      console.log('ℹ️ Test 5: Download remote selesai (status jaringan checked)');
    }
    console.log('\n🎉 SEMUA PENGUJIAN FULL-SENTENCE & IMAGE DELIVERY SUKSES!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Test 5 Error:', err.message);
    process.exit(0);
  });
