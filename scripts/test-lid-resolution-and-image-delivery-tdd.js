/**
 * TDD Test Suite:
 * 1. WhatsApp LID (Linked Device ID) to Real Phone Number Resolution & Mapping
 * 2. Product Image Fuzzy Search, Contextual History Matching & Media Dispatch
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.NO_DELAY = 'true';

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');
const { 
  resolveCustomerInfo, 
  extractPhoneAndNameFromText,
  formatCustomerDisplay
} = require('../src/utils/contact-resolver');
const { 
  findProductImageToSend, 
  createMessageMediaFromFile,
  resolveProductImagePath
} = require('../src/engine/handlers/business-handler');
const { buildBusinessContext } = require('../src/ai/context-builder');
const { handleOwnerCommand } = require('../src/engine/handlers/owner-command-handler');
const { normalizePhoneNumber, toWhatsAppJid } = require('../src/utils/phone');

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
  console.log('   🧪 MEMULAI TDD: LID RESOLUTION & IMAGE DISPATCH');
  console.log('======================================================\n');

  const LID_CONTACT = '151917456011364@lid';
  const REAL_PHONE = '082116973032';
  const CLEAN_PHONE = '6282116973032';
  const OWNER_PHONE = '628999888777';

  db.setSetting('owner_phone', OWNER_PHONE);
  db.setSetting('mode', 'bisnis');

  // ========================================================
  // GRUP 1: LID & Real Phone Number Resolution
  // ========================================================
  console.log('📌 [Grup 1] LID & Real Phone Number Resolution');

  runTest('TC-LID-01: Ekstrak nomor HP dan nama dari teks pesanan pelanggan', () => {
    const text = 'Siap amanin 2 pasang. Nama: Key\nAlamat: Arcamanik Bandung\nNo. HP: 082116973032\nPesanan: Black Moscow';
    const extracted = extractPhoneAndNameFromText(text);
    assert.strictEqual(extracted.phoneNumber, CLEAN_PHONE);
    assert.strictEqual(extracted.customerName, 'Key');
  });

  await runAsyncTest('TC-LID-02: Resolve real phone number dari message.getContact() atau mapping database', async () => {
    const mockMessage = {
      from: LID_CONTACT,
      body: 'Halo mau nanya',
      getContact: async () => ({
        number: CLEAN_PHONE,
        pushname: 'Key',
        name: 'Key'
      })
    };

    const resolved = await resolveCustomerInfo(mockMessage, LID_CONTACT);
    assert.strictEqual(resolved.phoneNumber, CLEAN_PHONE);
    assert.strictEqual(resolved.customerName, 'Key');

    // Cek apakah tersimpan di customer_profiles
    const profile = db.getCustomerProfile(LID_CONTACT);
    assert.ok(profile, 'Profil harus tersimpan');
    assert.strictEqual(profile.phone_number, CLEAN_PHONE);
  });

  runTest('TC-LID-03: Format display kontak ramah pembacaan owner (bukan raw @lid)', () => {
    const display1 = formatCustomerDisplay(LID_CONTACT, {
      phoneNumber: CLEAN_PHONE,
      customerName: 'Key'
    });
    assert.strictEqual(display1, 'Key (0821-1697-3032)');

    const display2 = formatCustomerDisplay(LID_CONTACT, {
      phoneNumber: CLEAN_PHONE,
      customerName: null
    });
    assert.strictEqual(display2, '0821-1697-3032');
  });

  await runAsyncTest('TC-LID-04: Owner mengaktifkan bot menggunakan nomor asli me-unpause JID @lid yang terpetakan', async () => {
    // Pastikan relasi LID terpetakan
    db.upsertCustomerProfile(LID_CONTACT, {
      customer_name: 'Key',
      phone_number: CLEAN_PHONE,
      lid_jid: LID_CONTACT
    });

    // Jeda kontak LID
    db.pauseContact(LID_CONTACT, 2, 'Nego Harga');
    db.createHandoverTicket({
      contact: LID_CONTACT,
      customer_name: 'Key',
      trigger_message: 'mahal banget 120k',
      reason: 'Nego'
    });
    assert.strictEqual(db.isContactPaused(LID_CONTACT), true);

    // Owner mengirim !aktifkan 082116973032
    let replySent = '';
    const mockOwnerMessage = {
      from: `${OWNER_PHONE}@c.us`,
      body: `!aktifkan ${REAL_PHONE}`,
      reply: async (text) => { replySent = text; }
    };
    const mockClient = { sendMessage: async (jid, text) => { replySent = text; } };

    const handled = await handleOwnerCommand(mockOwnerMessage, mockClient);
    assert.strictEqual(handled, true);
    assert.strictEqual(db.isContactPaused(LID_CONTACT), false, 'Kontak LID harus ikut ter-unpause');
    assert.ok(replySent.includes('DIAKTIFKAN'));
  });

  // ========================================================
  // GRUP 2: Product Image Matching & Media Dispatch
  // ========================================================
  console.log('\n📌 [Grup 2] Product Image Matching & Media Dispatch');

  // Siapkan dummy produk dengan gambar untuk pengujian
  const testUploadDir = path.join(__dirname, '../data/uploads');
  if (!fs.existsSync(testUploadDir)) fs.mkdirSync(testUploadDir, { recursive: true });
  const dummyImgPath = path.join(testUploadDir, 'test_black_moscow.jpg');
  fs.writeFileSync(dummyImgPath, 'dummy-image-binary-data');

  // Buat atau update produk di database
  const existingProds = db.getAllProducts();
  let testProd = existingProds.find(p => p.name.toLowerCase().includes('black moscow'));
  if (testProd) {
    db.updateProduct(testProd.id, { image_path: dummyImgPath });
  } else {
    const newId = db.createProduct({
      name: 'Black Moscow Guppy',
      sku: 'BM-01',
      category: 'Ikan Hias',
      price: 120000,
      stock: 20,
      description: 'Guppy warna hitam pekat solid sepasang',
      image_path: dummyImgPath
    });
    testProd = db.getProductById(newId);
  }

  runTest('TC-IMG-01: Fuzzy matching kata produk ("liat fotonya bg yang black moscow")', () => {
    const match = findProductImageToSend('liat fotonya bg yang black moscow');
    assert.ok(match, 'Harus menemukan gambar produk');
    assert.ok(match.product.name.toLowerCase().includes('black moscow'));
    assert.ok(fs.existsSync(match.fullPath), 'File path fisik harus valid dan ada');
  });

  runTest('TC-IMG-02: Matching foto kontekstual dari riwayat chat terakhir jika query tidak sebut nama', () => {
    // Catat log chat sebelumnya bahwa sedang membicarakan Black Moscow
    db.createChatLog({
      contact: LID_CONTACT,
      message_in: 'ready black moscow?',
      message_out: 'Ready Kak, Black Moscow Guppy siap kirim',
      handled_by: 'ai'
    });

    const match = findProductImageToSend('mana fotonya ka', LID_CONTACT);
    assert.ok(match, 'Harus menemukan gambar dari riwayat obrolan');
    assert.ok(match.product.name.toLowerCase().includes('black moscow'));
  });

  runTest('TC-IMG-03: createMessageMediaFromFile menghasilkan payload gambar valid', () => {
    const media = createMessageMediaFromFile(dummyImgPath);
    assert.ok(media, 'Media harus terbentuk');
    assert.strictEqual(media.mimetype, 'image/jpeg');
    assert.ok(typeof media.data === 'string' && media.data.length > 0, 'Data base64 harus valid');
  });

  runTest('TC-IMG-04: buildBusinessContext menginformasikan ketersediaan foto produk ke AI', () => {
    const ctx = buildBusinessContext('liat black moscow');
    assert.ok(ctx.includes('Black Moscow'), 'Konteks harus memuat nama produk');
    assert.ok(ctx.includes('Foto:') || ctx.includes('Foto Produk:'), 'Konteks harus memuat info ketersediaan foto');
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
