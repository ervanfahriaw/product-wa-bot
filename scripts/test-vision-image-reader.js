/**
 * Test Suite: AI Multimodal Vision Image Reader
 * Menguji integrasi pembaca gambar / foto pada WA Bot Assistant menggunakan Gemini Vision.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
process.env.NO_DELAY = '1';

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');
const { generateReply } = require('../src/ai/router');
const { callGemini } = require('../src/ai/providers/gemini');
const { handleBusinessMessage } = require('../src/engine/handlers/business-handler');
const { handlePersonalMessage } = require('../src/engine/handlers/personal-handler');
const { enqueueIncomingMessage } = require('../src/engine/message-buffer');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Memulai Pengujian Vision Image Reader (Gemini)...');
  console.log('====================================================\n');

  // Dummy 1x1 transparent GIF / JPEG base64
  const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  // 1. Test Unit: callGemini Payload Structure with inlineData
  console.log('1️⃣ Menguji struktur payload inlineData pada callGemini...');
  let interceptedPayload = null;
  const originalFetch = global.fetch;

  global.fetch = async (url, options) => {
    if (url.includes('generativelanguage.googleapis.com')) {
      interceptedPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Halo Kak! Berdasarkan foto yang dikirim, produk ini adalah Kemeja Flanel Navy stok tersedia 5 pcs.' }]
              }
            }
          ]
        })
      };
    }
    return originalFetch(url, options);
  };

  const geminiRes = await callGemini('Tolong cek foto ini', 'Instruksi sistem', {
    apiKey: 'test-gemini-api-key',
    model: 'gemini-3.7-flash',
    imageBase64: dummyBase64,
    mimeType: 'image/png'
  });

  assert.strictEqual(geminiRes.error, null, 'callGemini harus sukses');
  assert.ok(interceptedPayload, 'Payload harus terkirim ke fetch');
  assert.ok(interceptedPayload.contents[0].parts.length === 2, 'Payload harus memiliki 2 parts (teks + inlineData)');
  assert.strictEqual(interceptedPayload.contents[0].parts[1].inlineData.mimeType, 'image/png');
  assert.strictEqual(interceptedPayload.contents[0].parts[1].inlineData.data, dummyBase64);
  console.log('   ✅ callGemini berhasil menyusun inlineData Base64 dengan benar!\n');

  // 2. Test Router: generateReply dengan imageBase64 (Mode Bisnis & Personal)
  console.log('2️⃣ Menguji generateReply router dengan parameter gambar...');
  const replyBisnis = await generateReply({
    message: 'ini ready gak kak?',
    mode: 'bisnis',
    imageBase64: dummyBase64,
    mimeType: 'image/jpeg',
    apiKeyOverride: 'test-key'
  });

  assert.ok(replyBisnis.reply.length > 0, 'Balasan bisnis dari vision tidak boleh kosong');
  assert.strictEqual(replyBisnis.error, null);
  console.log(`   ✅ Router Bisnis Vision Reply: "${replyBisnis.reply.substring(0, 70)}..."\n`);

  // 3. Test Mode Bisnis: handleBusinessMessage dengan Media Pesan Masuk
  console.log('3️⃣ Menguji alur handleBusinessMessage saat pelanggan mengirim gambar...');
  
  // Setup sample product di database
  const sampleProduct = db.createProduct({
    name: 'Kemeja Flanel Premium Navy',
    description: 'Bahan katun flanel lembut',
    price: 150000,
    stock: 12
  });

  let sentMessages = [];
  const mockMediaMessage = {
    from: '6281299998888@c.us',
    body: 'yg ini ada ukuran L gak kak?',
    hasMedia: true,
    type: 'image',
    downloadMedia: async () => ({
      mimetype: 'image/jpeg',
      data: dummyBase64,
      filename: 'sample.jpg'
    }),
    reply: async (text) => {
      sentMessages.push(text);
    }
  };

  const mockClient = {
    sendMessage: async (to, text) => {
      sentMessages.push(text);
    }
  };

  await handleBusinessMessage(mockMediaMessage, mockClient);

  assert.ok(sentMessages.length > 0, 'Bot harus membalas pesan foto pelanggan');
  
  // Cek pencatatan chat_logs dengan tag [Foto]
  const logs = db.getChatLogsByContact('6281299998888@c.us', 1);
  assert.ok(logs.length > 0, 'Chat log harus tersimpan');
  assert.ok(logs[0].message_in.includes('[Foto]'), 'Log pesan masuk harus memiliki indikator [Foto]');
  console.log(`   ✅ handleBusinessMessage berhasil memproses foto pelanggan dan mencatat ke chat_logs: "${logs[0].message_in}"\n`);

  // 4. Test Mode Personal: handlePersonalMessage dengan Foto Struk Belanja
  console.log('4️⃣ Menguji alur handlePersonalMessage saat user kirim foto struk...');
  
  // Mock balasan AI untuk struk pengeluaran
  global.fetch = async (url, options) => {
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{
                text: 'Foto struk belanja Indomaret terbaca Rp45.000.\n```json\n{"intent":"record_expense","category":"Belanja","amount":45000,"note":"Struk Belanja Indomaret"}\n```'
              }]
            }
          }
        ]
      })
    };
  };

  const personalSent = [];
  const mockReceiptMessage = {
    from: 'personal-user@c.us',
    body: '',
    hasMedia: true,
    type: 'image',
    downloadMedia: async () => ({
      mimetype: 'image/jpeg',
      data: dummyBase64,
      filename: 'struk.jpg'
    }),
    reply: async (text) => {
      personalSent.push(text);
    }
  };

  await handlePersonalMessage(mockReceiptMessage, mockClient);

  assert.ok(personalSent.length > 0, 'Bot personal harus mengirim balasan konfirmasi struk');
  
  // Cek tabel expenses
  const recentExpenses = db.getAllExpenses();
  const matchedExpense = recentExpenses.find(e => e.amount === 45000 && e.note.includes('Indomaret'));
  assert.ok(matchedExpense, 'Pengeluaran dari foto struk harus tersimpan di database SQLite');
  console.log(`   ✅ handlePersonalMessage berhasil membaca foto struk dan menyimpan pengeluaran: Rp${matchedExpense.amount.toLocaleString('id-ID')} (${matchedExpense.category})\n`);

  // 5. Test Multi-Bubble Buffer Image Retention
  console.log('5️⃣ Menguji retensi attachment gambar saat multi-bubble debounce...');
  let batchResult = null;
  const msg1 = { from: '628111111@c.us', body: 'halo kak', hasMedia: false };
  const msg2 = { 
    from: '628111111@c.us', 
    body: 'ini fotonya', 
    hasMedia: true, 
    imageBase64: dummyBase64, 
    mimeType: 'image/jpeg' 
  };

  await new Promise(resolve => {
    enqueueIncomingMessage(msg1, mockClient, async (agg) => {
      batchResult = agg;
      resolve();
    }, 50);

    // Kirim pesan kedua dalam interval debounce
    setTimeout(() => {
      enqueueIncomingMessage(msg2, mockClient, async (agg) => {
        batchResult = agg;
        resolve();
      }, 50);
    }, 20);
  });

  assert.ok(batchResult, 'Batch message harus siap');
  assert.strictEqual(batchResult.hasMedia, true, 'Aggregated message harus mempertahankan hasMedia = true');
  assert.strictEqual(batchResult.imageBase64, dummyBase64, 'Aggregated message harus mempertahankan imageBase64');
  console.log('   ✅ Multi-bubble debounce buffer berhasil mempertahankan payload gambar!\n');

  // Restore fetch
  global.fetch = originalFetch;

  console.log('====================================================');
  console.log('🎉 SEMUA PENGUJIAN VISION IMAGE READER BERHASIL (100%)!');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Pengujian Vision Image Reader Gagal:', err);
  process.exit(1);
});
