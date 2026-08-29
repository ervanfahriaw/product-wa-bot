/**
 * Test Suite: Smart Image Delivery & Dedicated Admin Assistant Flow
 * Menguji perbaikan pencegahan spam gambar, deteksi typo, anti-komplain,
 * dan perutean percakapan khusus Owner/Admin via WhatsApp (@lid & co-pilot).
 */

const assert = require('assert');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
process.env.NO_DELAY = '1';

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');
const { 
  findProductImageToSend, 
  clearSentProductImageCache, 
  recordSentProductImage,
  handleBusinessMessage 
} = require('../src/engine/handlers/business-handler');
const { 
  isOwnerMessage, 
  parseOwnerCommand, 
  handleOwnerCommand 
} = require('../src/engine/handlers/owner-command-handler');
const { handleOwnerAssistantMessage } = require('../src/engine/handlers/owner-assistant-handler');
const { processAggregatedMessage } = require('../src/engine/handlers/message-handler');
const { buildAdminContext } = require('../src/ai/context-builder');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Memulai Pengujian Smart Image Delivery & Admin Co-Pilot Fixes');
  console.log('================================================================\n');

  clearSentProductImageCache();

  // Setup sample products in database with image URLs
  const p1 = db.createProduct({
    name: 'Sate Ayam Madura (10 Tusuk)',
    description: 'Sate ayam dengan bumbu kacang khas Madura',
    price: 25000,
    stock: 50,
    image_path: 'https://example.com/sate-ayam.jpg'
  });

  const p2 = db.createProduct({
    name: 'Sate Sapi Maranggi',
    description: 'Sate daging sapi has dalam marinasi ketumbar dan gula aren',
    price: 45000,
    stock: 20,
    image_path: 'https://example.com/sate-maranggi.jpg'
  });

  // =================================================================
  // 1. Pengujian Gatekeeper Strict Intent Foto
  // =================================================================
  console.log('1️⃣ Menguji Gatekeeper Strict Intent Foto...');
  // Pertanyaan biasa tanpa meminta foto: TIDAK BOLEH mengirim gambar
  const q1 = findProductImageToSend('jd sate tuh per 10 tsk y ?', 'user1@c.us');
  assert.strictEqual(q1, null, 'Pertanyaan biasa tanpa intent foto tidak boleh mengirim gambar');

  const q2 = findProductImageToSend('knp yg sate maringgi mahal ?', 'user1@c.us');
  assert.strictEqual(q2, null, 'Pertanyaan harga/alasan tidak boleh mengirim gambar');
  console.log('   ✅ Pertanyaan info biasa berhasil dicegah dari pengiriman foto otomatis!\n');

  // =================================================================
  // 2. Pengujian Toleransi Typo ("maringgi" -> Sate Sapi Maranggi)
  // =================================================================
  console.log('2️⃣ Menguji Toleransi Typo pada Permintaan Foto...');
  const q3 = findProductImageToSend('liat foto yg sate maringgi', 'user1@c.us');
  assert.ok(q3, 'Harus menemukan produk untuk permintaan foto');
  assert.strictEqual(q3.product.name, 'Sate Sapi Maranggi', 'Typo "maringgi" harus cocok dengan Sate Sapi Maranggi');
  console.log(`   ✅ "liat foto yg sate maringgi" berhasil dicocokkan ke: "${q3.product.name}"!\n`);

  // =================================================================
  // 3. Pengujian Anti-Komplain / Negation Guard
  // =================================================================
  console.log('3️⃣ Menguji Anti-Komplain & Negation Guard...');
  const q4 = findProductImageToSend('kenapa kamu kasih terus saya foto sate ayam madura , padahal saya tidak minta ?', 'user1@c.us');
  assert.strictEqual(q4, null, 'Pesan komplain/negasi tidak boleh memicu pengiriman foto');

  const q5 = findProductImageToSend('jangan kirim foto lagi ya min', 'user1@c.us');
  assert.strictEqual(q5, null, 'Pesan penolakan foto harus memblokir pengiriman foto');
  console.log('   ✅ Pesan komplain/keberatan pelanggan berhasil memblokir pengiriman foto!\n');

  // =================================================================
  // 4. Pengujian Deduplikasi & Cooldown Pengiriman Gambar Per Kontak
  // =================================================================
  console.log('4️⃣ Menguji Deduplikasi & Cooldown Foto Per Kontak...');
  const contactA = 'user-spam-test@c.us';
  
  // Kirim pertama kali
  const firstAsk = findProductImageToSend('minta foto sate maranggi', contactA);
  assert.ok(firstAsk, 'Permintaan pertama harus dapat gambar');
  recordSentProductImage(contactA, firstAsk.product.id, firstAsk.product.name);

  // Minta lagi dalam jeda waktu dekat (tanpa kata kirim ulang)
  const secondAsk = findProductImageToSend('liat foto sate maranggi', contactA);
  assert.strictEqual(secondAsk, null, 'Gambar yang baru saja dikirim tidak boleh di-spam ulang');

  // Minta dengan eksplisit kirim lagi
  const reSendAsk = findProductImageToSend('kirim lagi foto sate maranggi dong kak', contactA);
  assert.ok(reSendAsk, 'Permintaan dengan keyword kirim lagi harus diizinkan');
  console.log('   ✅ Mekanisme cooldown berhasil mencegah spam gambar berulang ke kontak yang sama!\n');

  // =================================================================
  // 5. Pengujian Identifikasi Nomor Owner (@lid vs Phone Number)
  // =================================================================
  console.log('5️⃣ Menguji Pengenalan Akun Owner (@lid & Phone Number)...');
  const OWNER_PHONE = '08892114763';
  db.setSetting('owner_phone', OWNER_PHONE);
  saveConfig({ owner_phone: OWNER_PHONE });

  // Test 5a: Pesan dengan nomor HP normal
  assert.ok(isOwnerMessage({ from: '628892114763@c.us', body: 'halo' }), 'Owner nomor normal harus dikenali');

  // Test 5b: Pesan dengan JID @lid yang menjalankan command admin
  const mockLidMessage = {
    from: '69767515898014@lid',
    body: '!aktifkan 69767515898014'
  };
  assert.ok(isOwnerMessage(mockLidMessage), 'Owner dengan format @lid yang menjalankan command harus dikenali');

  // Test 5c: Setelah auto-registrasi LID, pesan biasa dari LID tersebut tetap dikenali sebagai Owner
  assert.ok(isOwnerMessage({ from: '69767515898014@lid', body: 'gimana penjualan hari ini?' }), 'Owner LID terdaftar harus dikenali pada pesan non-command');
  console.log('   ✅ Akun Owner dengan format @lid berhasil dikenali dan diregistrasi secara cerdas!\n');

  // =================================================================
  // 6. Pengujian Eksekusi Perintah Admin WhatsApp (!aktifkan / !selesai)
  // =================================================================
  console.log('6️⃣ Menguji Eksekusi Perintah !aktifkan dan !selesai...');
  
  // Pause kontak pelanggan
  const testCustomer = '69767515898014@lid';
  db.pauseContact(testCustomer, 2, 'Testing Handover');
  if (db.createHandoverTicket) {
    db.createHandoverTicket({
      contact: testCustomer,
      trigger_message: 'liat foto sate maranggi',
      reason: 'Testing'
    });
  }

  let adminReplies = [];
  const mockAdminMsg = {
    from: '69767515898014@lid',
    body: '!aktifkan 69767515898014',
    reply: async (text) => { adminReplies.push(text); }
  };

  const handled = await handleOwnerCommand(mockAdminMsg);
  assert.strictEqual(handled, true, 'Perintah !aktifkan harus berhasil dieksekusi');
  assert.ok(adminReplies.length > 0 && adminReplies[0].includes('DIAKTIFKAN'), 'Harus mengirim balasan konfirmasi aktifkan bot');
  console.log(`   ✅ Perintah !aktifkan berhasil diproses: "${adminReplies[0].split('\n')[0]}"\n`);

  // =================================================================
  // 7. Pengujian Perutean Dedicated Admin Assistant (Co-Pilot)
  // =================================================================
  console.log('7️⃣ Menguji Perutean Dedicated Admin Co-Pilot Flow...');
  
  // Mock fetch untuk AI Router Admin
  const originalFetch = global.fetch;
  let adminPromptPassed = null;
  global.fetch = async (url, options) => {
    if (url.includes('generativelanguage.googleapis.com')) {
      const payload = JSON.parse(options.body);
      adminPromptPassed = payload;
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Halo Bos! Hari ini tercatat 0 transaksi dan katalog memiliki 2 produk aktif. Ada yang perlu saya siapkan?' }]
              }
            }
          ]
        })
      };
    }
    return originalFetch(url, options);
  };

  let coPilotReplies = [];
  const mockChatFromOwner = {
    from: '69767515898014@lid',
    body: 'bagaimana laporan stok dan omset toko?',
    reply: async (text) => { coPilotReplies.push(text); }
  };

  await processAggregatedMessage(mockChatFromOwner);

  assert.ok(coPilotReplies.length > 0, 'Bot harus membalas chat Owner');
  assert.ok(coPilotReplies[0].includes('Halo Bos'), 'Balasan AI harus menyapa sebagai asisten internal (Bos/Admin), bukan sebagai pembeli CS');
  assert.ok(!coPilotReplies[0].includes('Mau coba pesan sate'), 'Bot DILARANG menyapa Owner sebagai pembeli sate');
  console.log(`   ✅ Percakapan Owner berhasil diarahkan ke Co-Pilot: "${coPilotReplies[0]}"\n`);

  // Restore fetch
  global.fetch = originalFetch;

  console.log('================================================================');
  console.log('🎉 SEMUA PENGUJIAN PERBAIKAN BERHASIL 100% TANPA KESALAHAN!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Pengujian Gagal:', err);
  process.exit(1);
});
