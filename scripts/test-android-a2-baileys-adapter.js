/**
 * TDD Test Suite: FASE A2 - Baileys WebSocket Engine Adapter
 * 
 * Memverifikasi:
 * 1. Pewarisan BaileysEngineAdapter dari BaseEngineAdapter.
 * 2. Helper JID translation (toBaileysJid, toInternalJid).
 * 3. Ekstraksi body dan tipe pesan Baileys (conversation, extendedText, image, etc.).
 * 4. Normalisasi pesan Baileys (normalizeMessage) menghasilkan interface standar yang kompatibel dengan seluruh handler.
 * 5. Pengiriman teks & media ke socket Baileys dengan target JID otomatis disesuaikan.
 * 6. Presensi mengetik (typing/composing & paused).
 * 7. Integrasi factory createEngineAdapter('baileys').
 * 
 * Jalankan: node scripts/test-android-a2-baileys-adapter.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  BaseEngineAdapter,
  BaileysEngineAdapter,
  createEngineAdapter,
  resetAdapterInstance,
  ENGINE_STATUS,
  getStatus,
  setQrCode
} = require('../src/engine');

const {
  extractMessageBody,
  extractMessageType,
  toBaileysJid,
  toInternalJid
} = require('../src/engine/adapters/baileys-adapter');

console.log('================================================================');
console.log('  🧪 TDD TEST SUITE: FASE A2 - BAILEYS WEBSOCKET ENGINE ADAPTER');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     -> Error: ${err.message}`);
    failedTests++;
  }
}

async function runTestAsync(testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     -> Error: ${err.message}`);
    failedTests++;
  }
}

(async () => {
  // --- BAGIAN 1: KELAS & PEWARISAN ---
  console.log('--- [BAGIAN 1] STRUKTUR KELAS & PEWARISAN ---');

  runTest('BaileysEngineAdapter harus mewarisi BaseEngineAdapter dengan nama "baileys"', () => {
    const adapter = new BaileysEngineAdapter();
    assert.ok(adapter instanceof BaseEngineAdapter);
    assert.strictEqual(adapter.engineName, 'baileys');
    assert.strictEqual(adapter.sock, null);
    assert.ok(adapter.authPath.includes('baileys-auth'));
  });

  // --- BAGIAN 2: JID TRANSLATION ---
  console.log('\n--- [BAGIAN 2] STANDARISASI & TRANSLASI JID ---');

  runTest('toBaileysJid mengonversi format @c.us atau nomor biasa ke @s.whatsapp.net', () => {
    assert.strictEqual(toBaileysJid('628123456789@c.us'), '628123456789@s.whatsapp.net');
    assert.strictEqual(toBaileysJid('628123456789'), '628123456789@s.whatsapp.net');
    assert.strictEqual(toBaileysJid('12036302@g.us'), '12036302@g.us');
  });

  runTest('toInternalJid mengonversi format Baileys (@s.whatsapp.net) ke internal (@c.us)', () => {
    assert.strictEqual(toInternalJid('628123456789@s.whatsapp.net'), '628123456789@c.us');
    assert.strictEqual(toInternalJid('12036302@g.us'), '12036302@g.us');
  });

  // --- BAGIAN 3: EKSTRAKSI BODY & TIPE PESAN ---
  console.log('\n--- [BAGIAN 3] EKSTRAKSI ISI & TIPE PESAN BAILEYS ---');

  runTest('extractMessageBody mampu mengekstrak pesan teks, extended, dan caption gambar', () => {
    // 1. Pesan teks biasa
    const msg1 = { message: { conversation: 'Halo Min, ready?' } };
    assert.strictEqual(extractMessageBody(msg1), 'Halo Min, ready?');

    // 2. Pesan teks extended (balasan/link preview)
    const msg2 = { message: { extendedTextMessage: { text: 'Bisa bayar COD?' } } };
    assert.strictEqual(extractMessageBody(msg2), 'Bisa bayar COD?');

    // 3. Pesan gambar dengan caption
    const msg3 = { message: { imageMessage: { caption: 'Mau pesan yang ini 2 pcs' } } };
    assert.strictEqual(extractMessageBody(msg3), 'Mau pesan yang ini 2 pcs');

    // 4. Pesan kosong
    assert.strictEqual(extractMessageBody(null), '');
  });

  runTest('extractMessageType mengenali berbagai format media Baileys', () => {
    assert.strictEqual(extractMessageType({ message: { conversation: 'hai' } }), 'text');
    assert.strictEqual(extractMessageType({ message: { imageMessage: {} } }), 'image');
    assert.strictEqual(extractMessageType({ message: { documentMessage: {} } }), 'document');
    assert.strictEqual(extractMessageType({ message: { videoMessage: {} } }), 'video');
    assert.strictEqual(extractMessageType({ message: { audioMessage: {} } }), 'audio');
    assert.strictEqual(extractMessageType({ message: { stickerMessage: {} } }), 'sticker');
  });

  // --- BAGIAN 4: NORMALISASI PESAN UNTUK HANDLERS ---
  console.log('\n--- [BAGIAN 4] NORMALISASI PESAN (MESSAGE COMPATIBILITY) ---');

  await runTestAsync('normalizeMessage menghasilkan objek pesan yang kompatibel dengan handlers', async () => {
    const adapter = new BaileysEngineAdapter();

    // Mock socket untuk menangkap panggilan reply()
    let sentToJid = null;
    let sentPayload = null;
    let presenceState = null;

    adapter.sock = {
      sendMessage: async (targetJid, payload) => {
        sentToJid = targetJid;
        sentPayload = payload;
        return { key: { id: 'sent-1' } };
      },
      sendPresenceUpdate: async (type, targetJid) => {
        presenceState = { type, targetJid };
      }
    };

    const rawBaileysMsg = {
      key: {
        remoteJid: '62899887766@s.whatsapp.net',
        fromMe: false,
        id: 'BAILEYS_MSG_123'
      },
      message: {
        conversation: 'Ada Kopi Gayo 250gr?'
      },
      messageTimestamp: 1712000000,
      pushName: 'Budi Santoso'
    };

    const norm = adapter.normalizeMessage(rawBaileysMsg);
    assert.ok(norm, 'Normalized message tidak boleh null');
    assert.strictEqual(norm.from, '62899887766@c.us'); // Dipetakan ke @c.us untuk database konsisten
    assert.strictEqual(norm.body, 'Ada Kopi Gayo 250gr?');
    assert.strictEqual(norm.type, 'text');
    assert.strictEqual(norm.timestamp, 1712000000);
    assert.strictEqual(norm.hasMedia, false);
    assert.strictEqual(typeof norm.reply, 'function');
    assert.strictEqual(typeof norm.getChat, 'function');

    // Uji coba membalas pesan via norm.reply()
    await norm.reply('Kopi Gayo ready kak!');
    assert.strictEqual(sentToJid, '62899887766@s.whatsapp.net');
    assert.deepStrictEqual(sentPayload, { text: 'Kopi Gayo ready kak!' });

    // Uji coba getChat() typing state
    const chat = await norm.getChat();
    assert.strictEqual(typeof chat.sendStateTyping, 'function');
    assert.strictEqual(typeof chat.clearState, 'function');

    await chat.sendStateTyping();
    assert.deepStrictEqual(presenceState, { type: 'composing', targetJid: '62899887766@s.whatsapp.net' });

    await chat.clearState();
    assert.deepStrictEqual(presenceState, { type: 'paused', targetJid: '62899887766@s.whatsapp.net' });
  });

  // --- BAGIAN 5: PENGIRIMAN PESAN & MEDIA DARI ADAPTER ---
  console.log('\n--- [BAGIAN 5] PENGIRIMAN PESAN & MEDIA DARI ADAPTER ---');

  await runTestAsync('sendMessage & sendMedia mengirim payload Baileys yang benar', async () => {
    const adapter = new BaileysEngineAdapter();

    let calls = [];
    adapter.sock = {
      sendMessage: async (targetJid, payload) => {
        calls.push({ targetJid, payload });
        return { key: { id: 'test-msg-id' } };
      }
    };

    // 1. Kirim teks
    await adapter.sendMessage('628111222333@c.us', 'Halo pelanggan');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].targetJid, '628111222333@s.whatsapp.net');
    assert.deepStrictEqual(calls[0].payload, { text: 'Halo pelanggan' });

    // 2. Kirim media buffer
    const dummyBuffer = Buffer.from('FAKE_IMAGE_DATA');
    await adapter.sendMedia('628111222333@c.us', dummyBuffer, {
      caption: 'Gambar Produk Kopi',
      mimeType: 'image/jpeg'
    });
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[1].targetJid, '628111222333@s.whatsapp.net');
    assert.strictEqual(calls[1].payload.caption, 'Gambar Produk Kopi');
    assert.ok(Buffer.isBuffer(calls[1].payload.image));

    // 3. Kirim objek MessageMedia WWebJS format fallback
    await adapter.sendMessage('628111222333@c.us', {
      data: Buffer.from('BASE64_IMG').toString('base64'),
      caption: 'Caption Produk'
    });
    assert.strictEqual(calls.length, 3);
    assert.ok(Buffer.isBuffer(calls[2].payload.image));
    assert.strictEqual(calls[2].payload.caption, 'Caption Produk');
  });

  // --- BAGIAN 6: INTEGRASI FACTORY ---
  console.log('\n--- [BAGIAN 6] ADAPTER FACTORY DENGAN TIPE "BAILEYS" ---');

  runTest('createEngineAdapter("baileys") menghasilkan instance BaileysEngineAdapter', () => {
    resetAdapterInstance();
    const adapter = createEngineAdapter('baileys', true);
    assert.ok(adapter instanceof BaileysEngineAdapter);
    assert.strictEqual(adapter.engineName, 'baileys');
  });

  console.log('\n================================================================');
  console.log(`  📊 HASIL PENGUJIAN FASE A2: ${passedTests} LULUS / ${totalTests} TOTAL`);
  if (failedTests === 0) {
    console.log('  🎉 STATUS: 100% LULUS — FASE A2 SELESAI DENGAN SEMPURNA!');
  } else {
    console.log(`  ⚠️ STATUS: ADA ${failedTests} PENGUJIAN YANG GAGAL.`);
  }
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
})();
