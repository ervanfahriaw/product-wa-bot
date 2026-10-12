/**
 * TDD Test Suite: FASE A1 - Engine Abstraction & Interface Standardization
 * 
 * Memverifikasi:
 * 1. Kontrak antarmuka BaseEngineAdapter & integrasi EventEmitter.
 * 2. Implementasi MockAdapter yang memenuhi seluruh kontrak tanpa error.
 * 3. WWebJSEngineAdapter mewarisi BaseEngineAdapter & mengimplementasikan seluruh method.
 * 4. Normalisasi format pesan (normalizedMessage) memiliki signature reply(), getChat(), dan property standar.
 * 5. Factory selector createEngineAdapter() bekerja dinamis.
 * 6. Kompatibilitas mundur (backward compatibility) terhadap seluruh ekspor src/engine/index.js.
 * 
 * Jalankan: node scripts/test-android-a1-adapter-interface.js
 */

const assert = require('assert');
const EventEmitter = require('events');
const {
  BaseEngineAdapter,
  WWebJSEngineAdapter,
  createEngineAdapter,
  getActiveAdapter,
  resetAdapterInstance,
  ENGINE_STATUS,
  initClient,
  getClient,
  destroyClient,
  getStatus,
  getQrCode
} = require('../src/engine');

console.log('================================================================');
console.log('  🧪 TDD TEST SUITE: FASE A1 - ENGINE ABSTRACTION & INTERFACE  ');
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
  // --- BAGIAN 1: KONTRAK BASE ADAPTER ---
  console.log('--- [BAGIAN 1] KONTRAK BASE ADAPTER ---');

  runTest('BaseEngineAdapter harus turunan dari EventEmitter', () => {
    const base = new BaseEngineAdapter('test-base');
    assert.ok(base instanceof EventEmitter);
    assert.strictEqual(base.engineName, 'test-base');
    assert.strictEqual(base.rawClient, null);
    assert.strictEqual(base.isInitializing, false);
  });

  await runTestAsync('Method abstract BaseEngineAdapter harus melempar error jika belum diimplementasi', async () => {
    const base = new BaseEngineAdapter('test-base');
    await assert.rejects(async () => await base.init(), /Method init\(\) harus diimplementasikan/);
    await assert.rejects(async () => await base.destroy(), /Method destroy\(\) harus diimplementasikan/);
    await assert.rejects(async () => await base.reconnect(), /Method reconnect\(\) harus diimplementasikan/);
    await assert.rejects(async () => await base.resetSession(), /Method resetSession\(\) harus diimplementasikan/);
    await assert.rejects(async () => await base.sendMessage('123@c.us', 'halo'), /Method sendMessage\(\) harus diimplementasikan/);
    await assert.rejects(async () => await base.sendMedia('123@c.us', 'path.jpg'), /Method sendMedia\(\) harus diimplementasikan/);
    assert.throws(() => base.normalizeMessage({}), /Method normalizeMessage\(\) harus diimplementasikan/);
  });

  runTest('Event emission helper pada BaseEngineAdapter harus menerbitkan event yang benar', () => {
    const base = new BaseEngineAdapter('test-events');
    let qrEmitted = false;
    let authEmitted = false;
    let readyEmitted = false;
    let discEmitted = false;
    let msgEmitted = false;

    base.on('qr', (data) => { qrEmitted = data.rawQr === 'qr-raw-123'; });
    base.on('authenticated', () => { authEmitted = true; });
    base.on('ready', (info) => { readyEmitted = info.phone === '628111'; });
    base.on('disconnected', (reason) => { discEmitted = reason === 'logout'; });
    base.on('message', (msg) => { msgEmitted = msg.body === 'test msg'; });

    base.emitQr('qr-raw-123', 'data:image/png;base64,abc');
    base.emitAuthenticated();
    base.emitReady({ phone: '628111', pushname: 'Test Store' });
    base.emitDisconnected('logout');
    base.emitMessage({ body: 'test msg' });

    assert.ok(qrEmitted, 'Event qr gagal');
    assert.ok(authEmitted, 'Event authenticated gagal');
    assert.ok(readyEmitted, 'Event ready gagal');
    assert.ok(discEmitted, 'Event disconnected gagal');
    assert.ok(msgEmitted, 'Event message gagal');
  });

  // --- BAGIAN 2: MOCK ADAPTER IMPLEMENTATION ---
  console.log('\n--- [BAGIAN 2] MOCK ADAPTER CONFORMANCE ---');

  class MockEngineAdapter extends BaseEngineAdapter {
    constructor() {
      super('mock');
      this.messagesSent = [];
      this.mediaSent = [];
    }
    async init() { this.rawClient = { mockSocket: true }; return this.rawClient; }
    async destroy() { this.rawClient = null; }
    async reconnect() { return await this.init(); }
    async resetSession() { return await this.init(); }
    async sendMessage(jid, text, options = {}) {
      this.messagesSent.push({ jid, text, options });
      return { id: 'msg-1', text };
    }
    async sendMedia(jid, mediaPathOrBuffer, options = {}) {
      this.mediaSent.push({ jid, mediaPathOrBuffer, options });
      return { id: 'media-1', caption: options.caption };
    }
    normalizeMessage(raw) {
      return {
        from: raw.sender || '',
        body: raw.content || '',
        type: raw.type || 'text',
        timestamp: Math.floor(Date.now() / 1000),
        reply: async (text) => await this.sendMessage(raw.sender, text),
        getChat: async () => ({
          sendStateTyping: async () => {},
          clearState: async () => {}
        })
      };
    }
  }

  await runTestAsync('MockAdapter memenuhi seluruh fungsi pengiriman pesan & media', async () => {
    const mock = new MockEngineAdapter();
    await mock.init();
    assert.ok(mock.rawClient);

    await mock.sendMessage('628123456789@c.us', 'Halo dari Mock');
    assert.strictEqual(mock.messagesSent.length, 1);
    assert.strictEqual(mock.messagesSent[0].text, 'Halo dari Mock');

    await mock.sendMedia('628123456789@c.us', 'dummy.jpg', { caption: 'Foto Kopi' });
    assert.strictEqual(mock.mediaSent.length, 1);
    assert.strictEqual(mock.mediaSent[0].options.caption, 'Foto Kopi');

    const normalized = mock.normalizeMessage({ sender: '628999@c.us', content: 'Cek stok', type: 'text' });
    assert.strictEqual(normalized.from, '628999@c.us');
    assert.strictEqual(normalized.body, 'Cek stok');
    assert.strictEqual(typeof normalized.reply, 'function');

    await normalized.reply('Stok ready');
    assert.strictEqual(mock.messagesSent.length, 2);
    assert.strictEqual(mock.messagesSent[1].text, 'Stok ready');
  });

  // --- BAGIAN 3: WWEBJS ADAPTER IMPLEMENTATION ---
  console.log('\n--- [BAGIAN 3] WWEBJS ADAPTER IMPLEMENTATION ---');

  runTest('WWebJSEngineAdapter mewarisi BaseEngineAdapter dan terdefinisi dengan benar', () => {
    const wweb = new WWebJSEngineAdapter();
    assert.ok(wweb instanceof BaseEngineAdapter);
    assert.strictEqual(wweb.engineName, 'wwebjs');
    assert.strictEqual(typeof wweb.init, 'function');
    assert.strictEqual(typeof wweb.destroy, 'function');
    assert.strictEqual(typeof wweb.sendMessage, 'function');
    assert.strictEqual(typeof wweb.sendMedia, 'function');
    assert.strictEqual(typeof wweb.normalizeMessage, 'function');
  });

  await runTestAsync('WWebJSEngineAdapter.normalizeMessage() menormalisasi pesan dengan benar', async () => {
    const wweb = new WWebJSEngineAdapter();
    let replyCalledWith = null;

    const dummyRawMsg = {
      from: '62812999888@c.us',
      to: '62811111111@c.us',
      body: 'Apakah kopi gayo ada?',
      type: 'chat',
      timestamp: 1710000000,
      reply: async (txt) => {
        replyCalledWith = txt;
        return { success: true };
      },
      getChat: async () => ({
        sendStateTyping: async () => true,
        clearState: async () => true
      })
    };

    const norm = wweb.normalizeMessage(dummyRawMsg);
    assert.strictEqual(norm.from, '62812999888@c.us');
    assert.strictEqual(norm.body, 'Apakah kopi gayo ada?');
    assert.strictEqual(norm.timestamp, 1710000000);
    assert.strictEqual(typeof norm.reply, 'function');
    assert.strictEqual(typeof norm.getChat, 'function');

    await norm.reply('Masih ready kak!');
    assert.strictEqual(replyCalledWith, 'Masih ready kak!');

    const chat = await norm.getChat();
    assert.strictEqual(typeof chat.sendStateTyping, 'function');
    assert.strictEqual(typeof chat.clearState, 'function');
  });

  // --- BAGIAN 4: ADAPTER FACTORY & SELECTION ---
  console.log('\n--- [BAGIAN 4] ADAPTER FACTORY & SELECTION ---');

  runTest('createEngineAdapter() secara default menghasilkan WWebJSEngineAdapter', () => {
    resetAdapterInstance();
    const adapter = createEngineAdapter('wwebjs', true);
    assert.ok(adapter instanceof WWebJSEngineAdapter);
    assert.strictEqual(adapter.engineName, 'wwebjs');
  });

  runTest('getActiveAdapter() mengembalikan adapter tunggal konsisten', () => {
    resetAdapterInstance();
    const ad1 = getActiveAdapter();
    const ad2 = getActiveAdapter();
    assert.strictEqual(ad1, ad2);
  });

  // --- BAGIAN 5: BACKWARD COMPATIBILITY VERIFICATION ---
  console.log('\n--- [BAGIAN 5] BACKWARD COMPATIBILITY ENGINE ---');

  runTest('Semua method lama di src/engine/index.js tetap tersedia dan callable', () => {
    assert.strictEqual(typeof initClient, 'function');
    assert.strictEqual(typeof getClient, 'function');
    assert.strictEqual(typeof destroyClient, 'function');
    assert.strictEqual(typeof getStatus, 'function');
    assert.strictEqual(typeof getQrCode, 'function');
    assert.ok(ENGINE_STATUS.READY);
    assert.ok(ENGINE_STATUS.CONNECTING);
    assert.ok(ENGINE_STATUS.DISCONNECTED);

    const st = getStatus();
    assert.ok('state' in st);
  });

  console.log('\n================================================================');
  console.log(`  📊 HASIL PENGUJIAN FASE A1: ${passedTests} LULUS / ${totalTests} TOTAL`);
  if (failedTests === 0) {
    console.log('  🎉 STATUS: 100% LULUS — FASE A1 SELESAI DENGAN SEMPURNA!');
  } else {
    console.log(`  ⚠️ STATUS: ADA ${failedTests} PENGUJIAN YANG GAGAL.`);
  }
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
})();
