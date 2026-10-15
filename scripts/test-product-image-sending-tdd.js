/**
 * TDD Test Suite: Product Image Upload & WhatsApp Sending Pipeline
 * Memvalidasi:
 * 1. Resolusi path berkas foto produk (Windows, Android, Web path, Absolute, Relative, POSIX slashes).
 * 2. Deteksi MIME type & pembuatan objek media untuk WWebJS dan Baileys tanpa dependensi Chromium.
 * 3. Dual-Lock Intent Detection & Product Search (tanpa mem-blacklist nama produk seperti sate, kopi, kaos).
 * 4. Baileys Engine Adapter `sendMedia` dan `sendMessage` untuk binary image stream.
 * 5. Ketersediaan TMPDIR writable untuk Baileys encryptedStream di Android sandbox.
 * 6. Integrasi end-to-end simulasi pengiriman foto produk dari pesan pelanggan.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { BASE_DIR, DATA_DIR, UPLOADS_DIR } = require('../src/utils/paths');
const { resolveProductImageResource } = require('../src/utils/image-downloader');
const {
  findProductImageToSend,
  findProductImagesToSend,
  createMessageMediaFromFile,
  clearSentProductImageCache
} = require('../src/engine/handlers/business-handler');
const { BaileysEngineAdapter, toBaileysJid } = require('../src/engine/adapters/baileys-adapter');
const db = require('../src/db');

// Siapkan folder data/uploads jika belum ada
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Buat fixture gambar dummy untuk pengujian
const dummyJpgName = `tdd_test_${Date.now()}.jpg`;
const dummyPngName = `tdd_test_${Date.now()}.png`;
const dummyJpgPath = path.join(UPLOADS_DIR, dummyJpgName);
const dummyPngPath = path.join(UPLOADS_DIR, dummyPngName);

// 1x1 pixel dummy jpeg buffer & png buffer
const dummyJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xFF, 0xD9]);
const dummyPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);

fs.writeFileSync(dummyJpgPath, dummyJpgBuffer);
fs.writeFileSync(dummyPngPath, dummyPngBuffer);

console.log('--- [TDD] Memulai Pengujian Sistem Pengiriman Foto Produk ---');

async function runTests() {
  let passed = 0;
  let total = 0;

  try {
    db.db.exec("DELETE FROM products WHERE sku LIKE 'TDD-%' OR sku LIKE 'TEST-%' OR sku = 'AFR' OR name LIKE '%TDD%' OR name = 'AFR'");
  } catch (_) {}

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  function safeDeleteProduct(p) {
    if (!p) return;
    const id = typeof p === 'object' && p !== null ? p.id : p;
    if (id) {
      try { db.deleteProduct(id); } catch (_) {}
    }
  }

  // -------------------------------------------------------------
  // GROUP 1: RESOLUSI PATH GAMBAR PRODUK (CROSS-PLATFORM)
  // -------------------------------------------------------------
  test('1.1. Resolusi path lokal nama berkas murni (filename)', () => {
    const res = resolveProductImageResource(dummyJpgName);
    assert(res !== null, 'Harus berhasil menyelesaikan nama berkas');
    assert.strictEqual(res.isUrl, false);
    assert(fs.existsSync(res.fullPath), 'File fisik harus benar-benar ada di disk');
  });

  test('1.2. Resolusi path dengan prefix web dashboard (/uploads/...)', () => {
    const res = resolveProductImageResource(`/uploads/${dummyJpgName}`);
    assert(res !== null, 'Harus berhasil menyelesaikan web path /uploads/...');
    assert.strictEqual(res.isUrl, false);
    assert(fs.existsSync(res.fullPath), 'File fisik harus ditemukan dari path /uploads/');
  });

  test('1.3. Resolusi path dengan Windows backslash (data\\uploads\\...)', () => {
    const res = resolveProductImageResource(`data\\uploads\\${dummyJpgName}`);
    assert(res !== null, 'Harus berhasil menyelesaikan Windows backslash path');
    assert.strictEqual(res.isUrl, false);
    assert(fs.existsSync(res.fullPath), 'File fisik harus ditemukan');
  });

  test('1.4. Resolusi path dengan format POSIX slashes (data/uploads/...)', () => {
    const res = resolveProductImageResource(`data/uploads/${dummyJpgName}`);
    assert(res !== null, 'Harus berhasil menyelesaikan POSIX path');
    assert.strictEqual(res.isUrl, false);
    assert(fs.existsSync(res.fullPath), 'File fisik harus ditemukan');
  });

  test('1.5. Resolusi path absolut penuh', () => {
    const res = resolveProductImageResource(dummyJpgPath);
    assert(res !== null, 'Harus berhasil menyelesaikan path absolut');
    assert.strictEqual(res.isUrl, false);
    assert(fs.existsSync(res.fullPath), 'File fisik harus ditemukan dari path absolut');
  });

  test('1.6. Resolusi URL remote http/https', () => {
    const res = resolveProductImageResource('https://example.com/foto-produk.jpg');
    assert(res !== null, 'Harus mengenali URL remote');
    assert.strictEqual(res.isUrl, true);
    assert(res.url.startsWith('https://'), 'URL harus ternormalisasi');
  });

  test('1.7. Return null jika berkas tidak ditemukan', () => {
    const res = resolveProductImageResource('non_existent_file_xyz_123.jpg');
    assert.strictEqual(res, null, 'Harus return null untuk file yang tidak ada');
  });

  // -------------------------------------------------------------
  // GROUP 2: CREATION OF MESSAGEMEDIA / BUFFER PAYLOAD
  // -------------------------------------------------------------
  await testAsync('2.1. createMessageMediaFromFile membaca buffer JPG dan menyertakan metadata', async () => {
    const media = await createMessageMediaFromFile(dummyJpgPath);
    assert(media !== null, 'Media tidak boleh null');
    assert(media.mimetype === 'image/jpeg', `Mimetype harus image/jpeg, didapat ${media.mimetype}`);
    assert(media.data && typeof media.data === 'string', 'Harus menyertakan base64 data');
    assert(media.buffer && Buffer.isBuffer(media.buffer), 'Harus menyertakan Buffer binary untuk Baileys');
  });

  await testAsync('2.2. createMessageMediaFromFile membaca buffer PNG dan deteksi mimetype akurat', async () => {
    const media = await createMessageMediaFromFile(dummyPngPath);
    assert(media !== null, 'Media tidak boleh null');
    assert(media.mimetype === 'image/png', `Mimetype harus image/png, didapat ${media.mimetype}`);
    assert(media.buffer && Buffer.isBuffer(media.buffer), 'Buffer binary PNG harus tersedia');
  });

  // -------------------------------------------------------------
  // GROUP 3: INTENT MATCHING & PRODUCT SEARCH (NO UNWANTED BLACKLIST)
  // -------------------------------------------------------------
  test('3.1. Deteksi permintaan foto untuk produk kuliner/makanan (misal Sate, Kopi)', () => {
    clearSentProductImageCache();
    // Daftarkan produk pengujian ke DB
    const testSku = `TDD-SAT-${Date.now()}`;
    const testProd = db.createProduct({
      sku: testSku,
      name: 'Sate Maranggi Sapi TDD',
      category: 'Kuliner',
      price: 45000,
      stock: 10,
      description: 'Sate empuk bumbu maranggi',
      image_path: dummyJpgPath
    });

    try {
      const match = findProductImageToSend('Kak ada foto sate maranggi sapi?');
      assert(match !== null, 'Permintaan "foto sate maranggi sapi" harus menemukan produk');
      assert.strictEqual(match.product.sku, testSku, 'Harus mencocokkan produk Sate Maranggi Sapi');
      assert(match.fullPath, 'Harus memiliki fullPath valid');
    } finally {
      safeDeleteProduct(testProd);
    }
  });

  test('3.2. Deteksi permintaan foto untuk produk fashion/retail (misal Kaos, Sepatu)', () => {
    clearSentProductImageCache();
    const testSku = `TDD-KAOS-${Date.now()}`;
    const testProd = db.createProduct({
      sku: testSku,
      name: 'Kaos Polos Cotton Combed TDD',
      category: 'Pakaian',
      price: 55000,
      stock: 20,
      description: 'Bahan adem 30s',
      image_path: dummyPngPath
    });

    try {
      const match = findProductImageToSend('Bisa spill foto kaos polos cotton?');
      assert(match !== null, 'Permintaan "spill foto kaos polos" harus menemukan produk');
      assert.strictEqual(match.product.sku, testSku, 'Harus mencocokkan produk Kaos Polos');
    } finally {
      safeDeleteProduct(testProd);
    }
  });

  test('3.3. Penolakan negasi/komplain pengiriman foto (Anti-Spam Dual-Lock)', () => {
    const match = findProductImageToSend('Jangan kirim foto lagi kak, saya gak butuh gambar');
    assert.strictEqual(match, null, 'Kalimat komplain/negasi harus 100% menolak kirim foto');
  });

  test('3.4. Deteksi akronim pendek AFR (3 huruf) dari pesan "Liat foto afr nya" untuk produk "AFR (Albino Full Red)"', () => {
    clearSentProductImageCache();
    const testSku = `TDD-AFR-${Date.now()}`;
    const testProd = db.createProduct({
      sku: testSku,
      name: 'AFR (Albino Full Red)',
      category: 'Ikan Guppy',
      price: 250000,
      stock: 10,
      description: 'Guppy merah top grade sepasang',
      image_path: dummyJpgPath
    });

    try {
      const match = findProductImageToSend('Liat foto afr nya');
      assert(match !== null, 'Permintaan "Liat foto afr nya" harus menemukan produk AFR');
      assert.strictEqual(match.product.sku, testSku, 'Harus mencocokkan produk AFR (Albino Full Red)');
      assert(match.fullPath, 'Harus memiliki fullPath valid');
    } finally {
      safeDeleteProduct(testProd);
    }
  });

  test('3.5. Deteksi akronim pendek 2 huruf BM dari pesan "mana foto bm kak" untuk produk "BM (Black Moscow)"', () => {
    clearSentProductImageCache();
    const testSku = `TDD-BM-${Date.now()}`;
    const testProd = db.createProduct({
      sku: testSku,
      name: 'BM (Black Moscow)',
      category: 'Ikan Guppy',
      price: 180000,
      stock: 15,
      description: 'Guppy hitam pekat solid',
      image_path: dummyPngPath
    });

    try {
      const match = findProductImageToSend('mana foto bm kak');
      assert(match !== null, 'Permintaan "mana foto bm kak" harus menemukan produk BM');
      assert.strictEqual(match.product.sku, testSku, 'Harus mencocokkan produk BM');
    } finally {
      safeDeleteProduct(testProd);
    }
  });

  test('3.6. Resolusi kontekstual chat logs saat pelanggan bilang "Liat fotonya" untuk produk AFR', () => {
    clearSentProductImageCache();
    const testContact = `62899998888${Date.now()}@c.us`;
    const testSku = `TDD-CTX-${Date.now()}`;
    const testProd = db.createProduct({
      sku: testSku,
      name: 'AFR Kontekstual Guppy TDD',
      category: 'Ikan Guppy',
      price: 250000,
      stock: 10,
      description: 'Guppy merah top grade',
      image_path: dummyJpgPath
    });

    // Simulasikan bot baru saja mengirim daftar stok guppy AFR
    db.createChatLog({
      contact: testContact,
      message_in: 'Halo min stok ikan apa aja?',
      message_out: 'Halo Kak! Untuk stok ikan guppy ready saat ini:\n📁 Guppy\n• AFR Kontekstual Guppy TDD - Rp250.000\nGimana Kak mau tanya dulu?',
      handled_by: 'ai'
    });

    try {
      const match = findProductImageToSend('Liat fotonya', testContact);
      assert(match !== null, 'Permintaan pendek "Liat fotonya" harus menemukan AFR dari riwayat chat');
      assert.strictEqual(match.product.sku, testSku);
    } finally {
      safeDeleteProduct(testProd);
    }
  });

  test('3.7. findProductImagesToSend mengembalikan beberapa produk yang relevan (multi-image)', () => {
    clearSentProductImageCache();
    const sku1 = `TDD-MULTI1-${Date.now()}`;
    const sku2 = `TDD-MULTI2-${Date.now()}`;
    const prod1 = db.createProduct({
      sku: sku1,
      name: 'AFR Albino Full Red Multi TDD',
      category: 'Guppy',
      price: 250000,
      stock: 10,
      image_path: dummyJpgPath
    });
    const prod2 = db.createProduct({
      sku: sku2,
      name: 'Albino Koi Red Ear Multi TDD',
      category: 'Guppy',
      price: 125000,
      stock: 10,
      image_path: dummyPngPath
    });

    try {
      assert(typeof findProductImagesToSend === 'function', 'findProductImagesToSend harus berupa function');
      const matches = findProductImagesToSend('Liat foto afr sama albino koi nya kak');
      assert(Array.isArray(matches), 'Hasil harus berupa array');
      assert(matches.length >= 2, `Harus menemukan minimal 2 produk, ditemukan: ${matches.length}`);
      const skus = matches.map(m => m.product.sku);
      const hasAfr = skus.includes(sku1) || matches.some(m => m.product.name.includes('AFR'));
      const hasKoi = skus.includes(sku2) || matches.some(m => m.product.name.includes('Albino Koi'));
      assert(hasAfr, 'Harus memuat AFR');
      assert(hasKoi, 'Harus memuat Albino Koi Red Ear');
    } finally {
      safeDeleteProduct(prod1);
      safeDeleteProduct(prod2);
    }
  });

  // -------------------------------------------------------------
  // GROUP 4: BAILEYS ADAPTER MEDIA DISPATCHING
  // -------------------------------------------------------------
  await testAsync('4.1. Baileys adapter sendMedia mendukung path berkas lokal', async () => {
    const adapter = new BaileysEngineAdapter();
    let sentPayload = null;

    // Mock socket Baileys
    adapter.sock = {
      sendMessage: async (jid, content, options) => {
        sentPayload = { jid, content, options };
        return { key: { id: 'BAILEYS_MSG_001' } };
      }
    };

    const res = await adapter.sendMedia('628123456789@c.us', dummyJpgPath, {
      caption: '📸 Sate Maranggi Enak',
      mimeType: 'image/jpeg'
    });

    assert(res && res.key.id === 'BAILEYS_MSG_001', 'Harus mengembalikan response sukses dari Baileys');
    assert(sentPayload !== null, 'Socket sendMessage harus terpanggil');
    assert.strictEqual(sentPayload.jid, '628123456789@s.whatsapp.net', 'JID target harus dinormalisasi ke @s.whatsapp.net');
    assert(Buffer.isBuffer(sentPayload.content.image), 'Content image harus berupa Buffer');
    assert.strictEqual(sentPayload.content.caption, '📸 Sate Maranggi Enak');
    assert.strictEqual(sentPayload.content.mimetype, 'image/jpeg', 'Mimetype harus disematkan pada pesan image');
  });

  await testAsync('4.2. Baileys adapter sendMedia mendukung objek media { data, mimetype }', async () => {
    const adapter = new BaileysEngineAdapter();
    let sentPayload = null;

    adapter.sock = {
      sendMessage: async (jid, content, options) => {
        sentPayload = { jid, content, options };
        return { key: { id: 'BAILEYS_MSG_002' } };
      }
    };

    const mediaObj = {
      data: dummyPngBuffer.toString('base64'),
      mimetype: 'image/png',
      filename: 'kaos.png'
    };

    const res = await adapter.sendMedia('081298765432@c.us', mediaObj, {
      caption: '👕 Kaos Polos'
    });

    assert(res && res.key.id === 'BAILEYS_MSG_002', 'Harus sukses');
    assert.strictEqual(sentPayload.jid, '6281298765432@s.whatsapp.net');
    assert(Buffer.isBuffer(sentPayload.content.image), 'Content image harus di-convert ke Buffer');
    assert.strictEqual(sentPayload.content.mimetype, 'image/png', 'Mimetype PNG harus dipertahankan');
  });

  await testAsync('4.3. Baileys adapter sendMessage mendukung objek media dengan mimetype presisi', async () => {
    const adapter = new BaileysEngineAdapter();
    let sentPayload = null;

    adapter.sock = {
      sendMessage: async (jid, content, options) => {
        sentPayload = { jid, content, options };
        return { key: { id: 'BAILEYS_MSG_003' } };
      }
    };

    const mediaObj = {
      data: dummyPngBuffer.toString('base64'),
      mimetype: 'image/png',
      filename: 'foto.png'
    };

    const res = await adapter.sendMessage('628111222333@c.us', mediaObj, {
      caption: 'Gambar Produk'
    });

    assert(res && res.key.id === 'BAILEYS_MSG_003', 'Harus sukses');
    assert(Buffer.isBuffer(sentPayload.content.image), 'Image payload harus berupa Buffer');
    assert.strictEqual(sentPayload.content.mimetype, 'image/png', 'Mimetype harus dikirim ke Baileys');
  });

  await testAsync('4.4. Baileys adapter sendMedia menyematkan valid jpegThumbnail Buffer (bypass sharp/jimp requirement)', async () => {
    const adapter = new BaileysEngineAdapter();
    let sentPayload = null;

    adapter.sock = {
      sendMessage: async (jid, content, options) => {
        sentPayload = { jid, content, options };
        return { key: { id: 'BAILEYS_MSG_004' } };
      }
    };

    await adapter.sendMedia('628123456789@c.us', dummyJpgPath, {
      caption: 'Test Thumbnail Bypass'
    });

    assert(sentPayload !== null, 'sendMessage harus dipanggil');
    assert(sentPayload.content.jpegThumbnail, 'jpegThumbnail harus disematkan pada pesan gambar');
    assert(Buffer.isBuffer(sentPayload.content.jpegThumbnail) || typeof sentPayload.content.jpegThumbnail === 'string', 'jpegThumbnail harus berupa Buffer atau base64');
  });

  await testAsync('4.5. Baileys adapter sendMessage menyematkan valid jpegThumbnail Buffer pada objek media', async () => {
    const adapter = new BaileysEngineAdapter();
    let sentPayload = null;

    adapter.sock = {
      sendMessage: async (jid, content, options) => {
        sentPayload = { jid, content, options };
        return { key: { id: 'BAILEYS_MSG_005' } };
      }
    };

    const mediaObj = {
      buffer: dummyPngBuffer,
      mimetype: 'image/png'
    };

    await adapter.sendMessage('628123456789@c.us', mediaObj, {
      caption: 'Test Media Message Thumbnail'
    });

    assert(sentPayload !== null);
    assert(sentPayload.content.jpegThumbnail, 'jpegThumbnail harus otomatis disematkan agar Baileys tidak crash');
  });

  // -------------------------------------------------------------
  // GROUP 5: ANDROID TMPDIR WRITABLE ENVIRONMENT
  // -------------------------------------------------------------
  test('5.1. TMPDIR environment variable terkonfigurasi dan writable', () => {
    const tmp = process.env.TMPDIR || process.env.TEMP || process.env.TMP;
    assert(tmp && tmp.trim() !== '', 'TMPDIR atau TEMP harus terdefinisi');
    assert(fs.existsSync(tmp), 'Direktori TMPDIR harus ada di filesystem');
    
    // Uji tulis berkas temporary (simulasi Baileys encryptedStream)
    const testFile = path.join(tmp, `test_write_${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'test stream');
    assert(fs.existsSync(testFile), 'Berkas test di TMPDIR harus berhasil ditulis');
    fs.unlinkSync(testFile);
  });

  // -------------------------------------------------------------
  // GROUP 6: END-TO-END BUSINESS HANDLER PHOTO DELIVERY
  // -------------------------------------------------------------
  await testAsync('6.1. handleBusinessMessage memicu pengiriman media produk ketika diminta pelanggan', async () => {
    const { handleBusinessMessage } = require('../src/engine/handlers/business-handler');
    clearSentProductImageCache();

    // Daftarkan produk untuk simulasi end-to-end
    const e2eSku = `E2E-KOPI-${Date.now()}`;
    const e2eProd = db.createProduct({
      sku: e2eSku,
      name: 'Kopi Susu Aren Spesial E2E',
      category: 'Minuman',
      price: 22000,
      stock: 50,
      description: 'Espresso dengan susu dan gula aren asli',
      image_path: dummyJpgPath
    });

    let mediaSent = false;
    let sentTarget = null;
    let sentOptions = null;

    const mockClient = {
      sendMedia: async (target, media, options) => {
        mediaSent = true;
        sentTarget = target;
        sentOptions = options;
        return { key: { id: 'E2E_MEDIA_SENT' } };
      },
      sendMessage: async (target, content, options) => {
        return { key: { id: 'E2E_TXT_SENT' } };
      }
    };

    const mockMessage = {
      from: '628198765432@c.us',
      body: 'Halo kak, boleh minta foto kopi susu aren spesial nya?',
      reply: async (text) => mockClient.sendMessage('628198765432@c.us', text),
      getChat: async () => ({
        sendSeen: async () => {},
        sendStateTyping: async () => {},
        clearState: async () => {}
      })
    };

    try {
      await handleBusinessMessage(mockMessage, mockClient);
      assert(mediaSent, 'Client sendMedia harus terpanggil untuk mengirim gambar produk');
      assert.strictEqual(sentTarget, '628198765432@c.us', 'Target harus kontak pengirim');
      assert(sentOptions && sentOptions.caption && sentOptions.caption.includes('Kopi Susu Aren Spesial E2E'), 'Caption harus memuat nama produk');
      assert.strictEqual(sentOptions.mimeType, 'image/jpeg', 'MimeType harus image/jpeg');
    } finally {
      safeDeleteProduct(e2eProd);
    }
  });

  await testAsync('6.2. Simulasi persis masalah.jpeg (Liat foto afr nya): Bot mengirim foto AFR', async () => {
    const { handleBusinessMessage } = require('../src/engine/handlers/business-handler');
    clearSentProductImageCache();

    const afrSku = `TDD-AFR-PIC-${Date.now()}`;
    const afrProd = db.createProduct({
      sku: afrSku,
      name: 'AFR (Albino Full Red)',
      category: 'Ikan Guppy',
      price: 250000,
      stock: 10,
      description: 'Guppy merah merona kualitas top grade',
      image_path: dummyJpgPath
    });

    let sentMedias = [];
    const mockClient = {
      sendMedia: async (target, media, options) => {
        sentMedias.push({ target, media, options });
        return { key: { id: 'AFR_MEDIA_SENT' } };
      },
      sendMessage: async (target, content, options) => {
        return { key: { id: 'AFR_TXT_SENT' } };
      }
    };

    const mockMessage = {
      from: '628892114763@c.us',
      body: 'Liat foto afr nya',
      reply: async (text) => mockClient.sendMessage('628892114763@c.us', text),
      getChat: async () => ({
        sendSeen: async () => {},
        sendStateTyping: async () => {},
        clearState: async () => {}
      })
    };

    try {
      await handleBusinessMessage(mockMessage, mockClient);
      assert(sentMedias.length > 0, 'Pesan "Liat foto afr nya" harus mengirimkan media foto produk');
      const mediaEntry = sentMedias[0];
      assert(mediaEntry.options.caption.includes('AFR'), 'Caption harus memuat AFR');
    } finally {
      safeDeleteProduct(afrProd);
    }
  });

  await testAsync('6.3. Simulasi persis masalah.jpeg (Liat fotonya): Bot membaca konteks chat dan mengirim foto', async () => {
    const { handleBusinessMessage } = require('../src/engine/handlers/business-handler');
    clearSentProductImageCache();

    const afrSku = `TDD-AFR-CTX-${Date.now()}`;
    const koiSku = `TDD-KOI-CTX-${Date.now()}`;
    const afrProd = db.createProduct({
      sku: afrSku,
      name: 'AFR (Albino Full Red)',
      category: 'Ikan Guppy',
      price: 250000,
      stock: 10,
      image_path: dummyJpgPath
    });
    const koiProd = db.createProduct({
      sku: koiSku,
      name: 'Albino Koi Red Ear',
      category: 'Ikan Guppy',
      price: 125000,
      stock: 10,
      image_path: dummyPngPath
    });

    const testContact = `628892114763_CTX_${Date.now()}@c.us`;

    // Chat log sebelumnya berisi penawaran AFR dan Albino Koi Red Ear persis seperti di screenshot
    db.createChatLog({
      contact: testContact,
      message_in: 'Halo min ikan apa aja yang ready?',
      message_out: 'Halo Kak! Untuk stok ikan guppy yang ready di toko kami saat ini, berikut pilihannya ya Kak:\n\n📁 Guppy\n• AFR — Rp250.000\n• Albino Koi Red Ear — Rp125.000\n\nGimana Kak, ada yang menarik perhatian atau mau ditanyakan dulu seputar ikannya? 😊',
      handled_by: 'ai'
    });

    let sentMedias = [];
    const mockClient = {
      sendMedia: async (target, media, options) => {
        sentMedias.push({ target, media, options });
        return { key: { id: 'CTX_MEDIA_SENT' } };
      },
      sendMessage: async (target, content, options) => {
        return { key: { id: 'CTX_TXT_SENT' } };
      }
    };

    const mockMessage = {
      from: testContact,
      body: 'Liat fotonya',
      reply: async (text) => mockClient.sendMessage(testContact, text),
      getChat: async () => ({
        sendSeen: async () => {},
        sendStateTyping: async () => {},
        clearState: async () => {}
      })
    };

    try {
      await handleBusinessMessage(mockMessage, mockClient);
      assert(sentMedias.length > 0, 'Pesan "Liat fotonya" harus memicu pengiriman foto produk dari riwayat rekomendasi chat');
    } finally {
      safeDeleteProduct(afrProd);
      safeDeleteProduct(koiProd);
    }
  });

  // Cleanup fixture berkas dummy
  try {
    if (fs.existsSync(dummyJpgPath)) fs.unlinkSync(dummyJpgPath);
    if (fs.existsSync(dummyPngPath)) fs.unlinkSync(dummyPngPath);
  } catch (_) {}

  console.log(`\n========================================`);
  console.log(`HASIL TDD: ${passed}/${total} PENGUJIAN LULUS`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('[TDD FATAL ERROR]:', err);
  process.exit(1);
});
