/**
 * TDD Test Suite:
 * 1. Multipart Form Data Parser for Product Create & Edit (Dashboard Web Controller)
 * 2. Remote Image URL Support (Google Drive, HTTP/HTTPS, Imgur) with Auto-Download & Caching
 * 3. WhatsApp Media Dispatch from Image URLs
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.NO_DELAY = 'true';

const db = require('../src/db');
const { parseMultipartBuffer } = require('../src/utils/multipart-parser');
const { 
  normalizeImageUrl, 
  downloadAndCacheImage, 
  resolveProductImageResource 
} = require('../src/utils/image-downloader');
const { 
  findProductImageToSend, 
  createMessageMediaFromFile,
  resolveProductImagePath
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
  console.log('   🧪 MEMULAI TDD: MULTIPART UPLOAD & IMAGE URL DISPATCH');
  console.log('======================================================\n');

  // ========================================================
  // GRUP 1: Multipart Parser Test (Upload Foto di Dashboard)
  // ========================================================
  console.log('📌 [Grup 1] Multipart Parser (Upload Foto via Web Controller)');

  runTest('TC-MP-01: Parse form dengan input teks dan file upload binary', () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const rawBody = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="sku"\r\n\r\n` +
      `GUP-01\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="name"\r\n\r\n` +
      `Guppy Full Red High Quality\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="price"\r\n\r\n` +
      `150000\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="stock"\r\n\r\n` +
      `15\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="full_red.jpg"\r\n` +
      `Content-Type: image/jpeg\r\n\r\n` +
      `FAKE_BINARY_IMAGE_DATA_BYTES\r\n` +
      `--${boundary}--\r\n`;

    const buffer = Buffer.from(rawBody, 'binary');
    const parsed = parseMultipartBuffer(buffer, boundary);

    assert.ok(parsed.body, 'Parsed body harus ada');
    assert.strictEqual(parsed.body.sku, 'GUP-01');
    assert.strictEqual(parsed.body.name, 'Guppy Full Red High Quality');
    assert.strictEqual(parsed.body.price, '150000');
    assert.strictEqual(parsed.body.stock, '15');
    assert.ok(parsed.file, 'Parsed file harus ada');
    assert.strictEqual(parsed.file.originalname, 'full_red.jpg');
    assert.ok(fs.existsSync(parsed.file.path), 'File fisik harus tersimpan di disk');
  });

  runTest('TC-MP-02: Parse form saat file upload kosong (tidak pilih file)', () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const rawBody = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="name"\r\n\r\n` +
      `Guppy Blue Diamond\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename=""\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n` +
      `\r\n` +
      `--${boundary}--\r\n`;

    const buffer = Buffer.from(rawBody, 'binary');
    const parsed = parseMultipartBuffer(buffer, boundary);

    assert.strictEqual(parsed.body.name, 'Guppy Blue Diamond');
    assert.strictEqual(parsed.file, null, 'File harus bernilai null jika kosong');
  });

  // ========================================================
  // GRUP 2: Image URL Normalization & Resolution
  // ========================================================
  console.log('\n📌 [Grup 2] Image URL Normalization & Google Drive Resolution');

  runTest('TC-URL-01: Normalisasi Google Drive link menjadi direct download link', () => {
    const driveViewUrl = 'https://drive.google.com/file/d/1ABCXYZ987654321/view?usp=sharing';
    const normalized = normalizeImageUrl(driveViewUrl);
    assert.ok(normalized.includes('1ABCXYZ987654321'), 'Harus memuat File ID Google Drive');
    assert.ok(normalized.includes('drive.google.com/uc?export=download') || normalized.includes('googleusercontent.com'));

    const directUrl = 'https://example.com/images/guppy.png';
    assert.strictEqual(normalizeImageUrl(directUrl), directUrl);
  });

  await runAsyncTest('TC-URL-02: Download and Cache Image URL ke penyimpanan lokal', async () => {
    // Jalankan local HTTP test server sederhana yang menyajikan dummy image
    const dummyServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(Buffer.from('FAKE_JPG_IMAGE_STREAM_FOR_TEST'));
    });

    await new Promise(resolve => dummyServer.listen(0, '127.0.0.1', resolve));
    const port = dummyServer.address().port;
    const testUrl = `http://127.0.0.1:${port}/test-fish.jpg`;

    try {
      const cached = await downloadAndCacheImage(testUrl);
      assert.ok(cached, 'Harus menghasilkan path cache lokal');
      assert.ok(fs.existsSync(cached), 'File cache harus ada di disk');
      const content = fs.readFileSync(cached, 'utf-8');
      assert.strictEqual(content, 'FAKE_JPG_IMAGE_STREAM_FOR_TEST');
    } finally {
      dummyServer.close();
    }
  });

  // ========================================================
  // GRUP 3: Spreadsheet Imported Image URL to WhatsApp Media Dispatch
  // ========================================================
  console.log('\n📌 [Grup 3] Spreadsheet Imported Image URL to WhatsApp Media');

  // Buat produk dengan image_path berupa URL (seperti hasil import Google Sheets)
  const productWithUrlId = db.createProduct({
    name: 'Guppy Dumbo Ear Mosaic',
    sku: 'DEM-01',
    category: 'Ikan Hias',
    price: 95000,
    stock: 12,
    description: 'Guppy sirip telinga lebar',
    image_path: 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=400'
  });
  const prodWithUrl = db.getProductById(productWithUrlId);

  runTest('TC-DISP-01: findProductImageToSend mendeteksi produk dengan link gambar URL', () => {
    const match = findProductImageToSend('minta foto yang dumbo ear');
    assert.ok(match, 'Harus menemukan produk Dumbo Ear');
    assert.strictEqual(match.product.id, prodWithUrl.id);
    assert.ok(match.isUrl || match.fullPath, 'Harus memiliki metadata path atau URL');
  });

  runTest('TC-DISP-02: buildBusinessContext mendeteksi ketersediaan foto pada produk ber-URL', () => {
    const ctx = buildBusinessContext('dumbo ear');
    assert.ok(ctx.includes('Guppy Dumbo Ear Mosaic'));
    assert.ok(ctx.includes('Foto Produk: Tersedia'));
  });

  await runAsyncTest('TC-DISP-03: createMessageMediaFromFile membuat media dari URL maupun file lokal', async () => {
    // Buat dummy local file
    const localImg = path.join(__dirname, '../data/uploads/local_test.png');
    fs.writeFileSync(localImg, 'dummy_png');

    const mediaLocal = await createMessageMediaFromFile(localImg);
    assert.ok(mediaLocal);
    assert.strictEqual(mediaLocal.mimetype, 'image/png');

    // Buat server dummy untuk URL
    const dummyServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(Buffer.from('JPG_BINARY_MEDIA'));
    });
    await new Promise(resolve => dummyServer.listen(0, '127.0.0.1', resolve));
    const port = dummyServer.address().port;
    const testUrl = `http://127.0.0.1:${port}/guppy_online.jpg`;

    try {
      const mediaUrl = await createMessageMediaFromFile(testUrl);
      assert.ok(mediaUrl, 'Media dari URL harus berhasil dibuat');
      assert.strictEqual(mediaUrl.mimetype, 'image/jpeg');
      assert.ok(mediaUrl.data && mediaUrl.data.length > 0);
    } finally {
      dummyServer.close();
    }
  });

  console.log('\n======================================================');
  console.log(`  📊 HASIL PENGUJIAN:`);
  console.log(`     Total Pengujian: ${passedTests + failedTests}`);
  console.log(`     ✅ Lulus (PASS):  ${passedTests}`);
  console.log(`     ❌ Gagal (FAIL):  ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
