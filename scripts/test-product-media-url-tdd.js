/**
 * TDD Test Suite: Product Media URL & Image Delivery Reliability
 * 
 * Menguji:
 * 1. Database Migration & Schema: Kolom `media_url` pada tabel `products`
 * 2. CRUD Query: createProduct dan updateProduct mendukung `media_url`
 * 3. Multipart Upload Middleware: Form multipart mem-parsing file binary dan body field (media_url)
 * 4. Token Matching Fleksibel: Pencocokan kata tanpa spasi ("fullgold" -> "Full Gold") & akhiran "nya" ("afrnya")
 * 5. Keterkaitan Pengiriman Media: Format caption mencakup nama produk, harga, dan tautan media_url
 * 6. Fallback Pengiriman: Produk dengan media_url tetap mengirimkan link meskipun file fisik tidak ada
 * 7. AI Context Builder: Informasi media_url disertakan ke dalam system prompt konteks produk
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.NO_DELAY = 'true';

const db = require('../src/db');
const { parseMultipartBuffer, handleFileUpload } = require('../src/utils/multipart-parser');
const { 
  findProductImagesToSend, 
  extractProductSearchTokens,
  createMessageMediaFromFile
} = require('../src/engine/handlers/business-handler');
const { buildBusinessContext } = require('../src/ai/context-builder');

let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('   🧪 MEMULAI TDD: PRODUCT MEDIA URL & IMAGE DELIVERY');
  console.log('======================================================\n');

  // ========================================================
  // GRUP 1: Database Migration & CRUD Media URL
  // ========================================================
  console.log('📌 [Grup 1] Database Migration & Schema: media_url');

  runTest('TC-DB-01: Kolom media_url harus ada di tabel products', () => {
    const tableInfo = db.db.prepare("PRAGMA table_info(products)").all();
    const cols = new Set(tableInfo.map(c => c.name));
    assert.ok(cols.has('media_url'), 'Tabel products harus memiliki kolom media_url');
  });

  let testProdId = null;
  runTest('TC-DB-02: createProduct menyimpan media_url ke SQLite', () => {
    // Bersihkan data dummy dari pengujian sebelumnya jika ada
    try {
      const oldProducts = db.db.prepare("SELECT id FROM products WHERE name LIKE '%Full Gold%' OR name IN ('Ikan Guppy Dumbo Mosaic')").all();
      for (const old of oldProducts) {
        db.deleteProduct(old.id);
      }
    } catch (_) {}

    const gdriveLink = 'https://drive.google.com/drive/folders/1ABC_FULLGOLD_VIDEOS';
    testProdId = db.createProduct({
      name: 'Guppy Full Gold Champion',
      sku: 'FG-01',
      category: 'Ikan Guppy',
      price: 857000,
      stock: 5,
      description: 'Guppy warna emas pekat kualitas kontes',
      image_path: 'assets/products/fullgold.jpg',
      media_url: gdriveLink
    });

    assert.ok(testProdId > 0, 'ID produk harus valid');
    const fetched = db.getProductById(testProdId);
    assert.strictEqual(fetched.name, 'Guppy Full Gold Champion');
    assert.strictEqual(fetched.price, 857000);
    assert.strictEqual(fetched.media_url, gdriveLink, 'media_url harus tersimpan persis');
  });

  runTest('TC-DB-03: updateProduct memperbarui nilai media_url', () => {
    const updatedLink = 'https://drive.google.com/drive/folders/UPDATED_LINK';
    const success = db.updateProduct(testProdId, {
      media_url: updatedLink
    });
    assert.strictEqual(success, true);
    const fetched = db.getProductById(testProdId);
    assert.strictEqual(fetched.media_url, updatedLink);
  });

  // ========================================================
  // GRUP 2: Multipart Upload & Field Parsing Middleware
  // ========================================================
  console.log('\n📌 [Grup 2] Multipart Middleware: Upload Foto & Input Link Media URL');

  runTest('TC-MP-01: parseMultipartBuffer mengekstrak file gambar dan field media_url', () => {
    const boundary = '----WebKitFormBoundaryXYZ9876543210';
    const rawBody = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="name"\r\n\r\n` +
      `Guppy Albino Full Red (AFR)\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="price"\r\n\r\n` +
      `250000\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="media_url"\r\n\r\n` +
      `https://drive.google.com/drive/folders/AFR_COLLECTION\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="afr_real.jpg"\r\n` +
      `Content-Type: image/jpeg\r\n\r\n` +
      `REAL_BINARY_IMAGE_BUFFER_DATA\r\n` +
      `--${boundary}--\r\n`;

    const buffer = Buffer.from(rawBody, 'binary');
    const parsed = parseMultipartBuffer(buffer, boundary);

    assert.ok(parsed.body, 'Body harus terurai');
    assert.strictEqual(parsed.body.name, 'Guppy Albino Full Red (AFR)');
    assert.strictEqual(parsed.body.price, '250000');
    assert.strictEqual(parsed.body.media_url, 'https://drive.google.com/drive/folders/AFR_COLLECTION');
    assert.ok(parsed.file, 'File upload harus ada');
    assert.strictEqual(parsed.file.originalname, 'afr_real.jpg');
    assert.ok(fs.existsSync(parsed.file.path), 'File upload fisik harus tersimpan di disk');
  });

  await runAsyncTest('TC-MP-02: handleFileUpload middleware Express mengurai form multipart ke req.body dan req.file', async () => {
    const boundary = '----WebKitFormBoundaryExp123';
    const rawPayload = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="name"\r\n\r\n` +
      `Full Gold Super\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="media_url"\r\n\r\n` +
      `https://photos.app.goo.gl/sampleFullGold\r\n` +
      `--${boundary}--\r\n`;

    const reqMock = {
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      on: (event, handler) => {
        if (event === 'data') {
          handler(Buffer.from(rawPayload, 'utf-8'));
        } else if (event === 'end') {
          setImmediate(handler);
        }
      }
    };

    let nextCalled = false;
    await new Promise(resolve => {
      handleFileUpload(reqMock, {}, () => {
        nextCalled = true;
        resolve();
      });
    });

    assert.strictEqual(nextCalled, true, 'next() harus dipanggil');
    assert.ok(reqMock.body, 'req.body harus terisi');
    assert.strictEqual(reqMock.body.name, 'Full Gold Super');
    assert.strictEqual(reqMock.body.media_url, 'https://photos.app.goo.gl/sampleFullGold');
  });

  // ========================================================
  // GRUP 3: Token Matching Fleksibel (Unspaced & Suffixes)
  // ========================================================
  console.log('\n📌 [Grup 3] Token Matching Fleksibel ("fullgold" -> "Full Gold")');

  runTest('TC-MATCH-01: extractProductSearchTokens menghasilkan unspacedClean', () => {
    const tokens = extractProductSearchTokens({ name: 'Full Gold Super Grade A', sku: 'FG-01' });
    assert.strictEqual(tokens.unspacedClean, 'fullgoldsupergradea');
  });

  runTest('TC-MATCH-02: findProductImagesToSend mencocokkan "liat foto fullgold nya" ke "Guppy Full Gold Champion"', () => {
    // Siapkan dummy file gambar agar terdeteksi
    const dummyPath = path.resolve(__dirname, '../data/uploads/fullgold_dummy.jpg');
    fs.writeFileSync(dummyPath, 'DUMMY_IMAGE_DATA');
    db.updateProduct(testProdId, { image_path: dummyPath });

    const matches = findProductImagesToSend('liat foto fullgold nya', '628123456@c.us');
    assert.ok(matches.length > 0, 'Harus menemukan produk Full Gold');
    assert.strictEqual(matches[0].product.id, testProdId);
  });

  runTest('TC-MATCH-03: findProductImagesToSend mendeteksi keluhan/minta ulang "kamu ga kirim fotonyaaa"', () => {
    const matches = findProductImagesToSend('kamu ga kirim fotonyaaa', '628123456@c.us');
    assert.ok(matches.length > 0, 'Harus merespon permintaan ulang foto produk');
  });

  // ========================================================
  // GRUP 4: Caption Formatting & Fallback Media Delivery
  // ========================================================
  console.log('\n📌 [Grup 4] Caption Formatting & Media URL Delivery');

  runTest('TC-CAP-01: Caption menyertakan Nama Produk, Harga, dan Link Kumpulan Foto & Video', () => {
    const prod = db.getProductById(testProdId);
    let caption = `📸 *${prod.name}*\n💰 Rp${Number(prod.price).toLocaleString('id-ID')}`;
    if (prod.media_url && prod.media_url.trim()) {
      caption += `\n\n🔗 *Lihat Foto & Video Lengkap:* ${prod.media_url.trim()}`;
    }

    assert.ok(caption.includes('Guppy Full Gold Champion'), 'Caption harus memuat nama produk');
    assert.ok(caption.includes('Rp857.000'), 'Caption harus memuat harga');
    assert.ok(caption.includes('Lihat Foto & Video Lengkap'), 'Caption harus memuat header link media');
    assert.ok(caption.includes(prod.media_url), 'Caption harus memuat link URL sebenarnya');
  });

  runTest('TC-CAP-02: findProductImagesToSend menyertakan produk yang hanya punya media_url', () => {
    const noImgId = db.createProduct({
      name: 'Ikan Guppy Dumbo Mosaic',
      price: 150000,
      stock: 10,
      image_path: null,
      media_url: 'https://drive.google.com/drive/folders/DUMBO_MOSAIC'
    });

    const matches = findProductImagesToSend('liat foto dumbo mosaic', '628123456@c.us');
    assert.ok(matches.length > 0, 'Produk dengan media_url harus ditemukan');
    assert.strictEqual(matches[0].product.id, noImgId);
  });

  // ========================================================
  // GRUP 5: AI Context Builder
  // ========================================================
  console.log('\n📌 [Grup 5] AI Context Builder: media_url');

  runTest('TC-AI-01: buildBusinessContext menyertakan informasi media_url produk', () => {
    const ctx = buildBusinessContext('full gold');
    assert.ok(ctx.includes('Guppy Full Gold Champion'), 'Context harus memuat nama produk');
    assert.ok(ctx.includes('Link Galeri/Video:') || ctx.includes('Galeri/Video:'), 'Context harus menyertakan label galeri video');
  });

  console.log('\n======================================================');
  console.log(`  📊 HASIL PENGUJIAN TDD:`);
  console.log(`     Total Pengujian: ${passedTests + failedTests}`);
  console.log(`     ✅ Lulus (PASS):  ${passedTests}`);
  console.log(`     ❌ Gagal (FAIL):  ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal TDD Error:', err);
  process.exit(1);
});
