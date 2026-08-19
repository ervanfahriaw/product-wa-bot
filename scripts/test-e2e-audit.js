process.env.NODE_ENV = 'test';
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');
const { handleIncomingMessage } = require('../src/engine/handlers/message-handler');
const { generateReply } = require('../src/ai');
const { buildContext } = require('../src/ai/context-builder');

console.log('=== MEMULAI PENGUJIAN TDD: AUDIT INTEGRASI END-TO-END & ERROR HANDLING (FASE 8) ===\n');

async function runE2eAuditTests() {
  let failed = false;

  // 1. Audit E2E Flow: Message -> Context Builder -> AI Router -> Reply -> Chat Log
  console.log('[Audit 1/5] Menguji Alur Lengkap End-to-End (Mode Bisnis)...');
  try {
    saveConfig({ mode: 'bisnis', gemini_api_key: 'AIzaSy_MOCK_KEY_FOR_AUDIT' });
    db.setSetting('mode', 'bisnis');

    let replyResult = null;
    const mockMessage = {
      from: '628111222333@c.us',
      body: 'Halo min, kopi arabika ada stok berapa?',
      type: 'chat',
      reply: async (text) => {
        replyResult = text;
        return true;
      }
    };

    const initialLogCount = db.getAllChatLogs(1000, 0).length;
    await handleIncomingMessage(mockMessage, { sendMessage: async () => true });
    
    // Tunggu antrean debounce buffer & panggilan API selesai diproses
    const startTime = Date.now();
    while (!replyResult && Date.now() - startTime < 5000) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    assert.ok(replyResult, 'Bot harus selalu membalas pesan, tidak boleh silent-fail');
    const newLogs = db.getAllChatLogs(1000, 0);
    assert.strictEqual(newLogs.length, initialLogCount + 1, 'Chat log harus tercatat di database');
    console.log('  -> OK: Alur E2E lengkap berjalan tanpa silent-fail.');
  } catch (err) {
    console.error('  ❌ Gagal pada Audit 1:', err.message);
    failed = true;
  }

  // 2. Audit Skenario Kegagalan: API Key Kosong / Invalid (Graceful Fallback)
  console.log('\n[Audit 2/5] Menguji Skenario Kegagalan: API Key Kosong / Gangguan Server...');
  try {
    saveConfig({ mode: 'bisnis', gemini_api_key: '' });
    db.setSetting('gemini_api_key', '');

    const fallbackResult = await generateReply({
      message: 'Apakah ada stok barang?',
      mode: 'bisnis',
      apiKeyOverride: ''
    });

    assert.ok(fallbackResult.reply, 'Balasan fallback harus ada');
    assert.ok(
      fallbackResult.reply.includes('belum diatur') || 
      fallbackResult.reply.includes('kendala') || 
      fallbackResult.reply.includes('admin'),
      'Pesan balasan harus sopan dan menggunakan bahasa manusia'
    );
    console.log('  -> OK: Fallback message ramah pengguna:', fallbackResult.reply);
  } catch (err) {
    console.error('  ❌ Gagal pada Audit 2:', err.message);
    failed = true;
  }

  // 3. Audit Skenario Database Kosong / Data Tidak Ditemukan
  console.log('\n[Audit 3/5] Menguji Skenario Katalog Database Kosong...');
  try {
    const emptyContext = buildContext('Apakah jual laptop gaming?', 'bisnis');
    assert.ok(typeof emptyContext === 'string', 'Context harus berupa string');
    assert.ok(emptyContext.length > 0, 'Context builder harus menangani data kosong tanpa error');
    console.log('  -> OK: Context builder menangani pertanyaan di luar database secara elegan.');
  } catch (err) {
    console.error('  ❌ Gagal pada Audit 3:', err.message);
    failed = true;
  }

  // 4. Audit Skenario Pesan Non-Teks / Pesan Kosong / Karakter Khusus
  console.log('\n[Audit 4/5] Menguji Pesan Kosong, Stiker, Gambar Tanpa Teks...');
  try {
    let emptyReply = null;
    const mockEmptyMessage = {
      from: '628111222333@c.us',
      body: '',
      type: 'sticker',
      reply: async (text) => {
        emptyReply = text;
        return true;
      }
    };

    // Harus berjalan tanpa throw exception
    await handleIncomingMessage(mockEmptyMessage, { sendMessage: async () => true });
    console.log('  -> OK: Pesan kosong/stiker ditangani tanpa crash server.');
  } catch (err) {
    console.error('  ❌ Gagal pada Audit 4:', err.message);
    failed = true;
  }

  // 5. Audit Keamanan Data & .gitignore
  console.log('\n[Audit 5/5] Memeriksa File Sensitif & Aturan .gitignore...');
  try {
    const gitignoreContent = fs.readFileSync(path.resolve(__dirname, '../.gitignore'), 'utf-8');
    const requiredPatterns = [
      'node_modules',
      'config/config.json',
      'data/*.db',
      'src/engine/session',
      '.env'
    ];

    for (const pattern of requiredPatterns) {
      assert.ok(
        gitignoreContent.includes(pattern) || gitignoreContent.includes(pattern.replace('/', '\\')),
        `Pola ${pattern} harus terdaftar di .gitignore`
      );
    }
    console.log('  -> OK: Seluruh file sensitif (config.json, *.db, session/) terlindungi di .gitignore.');
  } catch (err) {
    console.error('  ❌ Gagal pada Audit 5:', err.message);
    failed = true;
  }

  if (failed) {
    console.log('\n❌ STATUS TDD: RED (Audit menemukan potensi celah / kegagalan)');
    process.exitCode = 1;
  } else {
    console.log('\n✅ STATUS TDD: GREEN (Audit Integrasi End-to-End & Error Handling Lulus 100%)');
    process.exitCode = 0;
  }
}

runE2eAuditTests();
