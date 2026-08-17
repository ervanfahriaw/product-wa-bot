const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== MEMULAI PENGUJIAN TDD: AI INTEGRATION LAYER (FASE 4) ===\n');

async function runTddTests() {
  let failed = false;

  // Test 1: Context Builder RAG
  console.log('[Test 1/5] Memeriksa Context Builder (RAG Ringan SQLite)...');
  try {
    const { buildContext } = require('../src/ai/context-builder');
    
    // Test context builder mode bisnis
    const businessContext = buildContext('Apakah Kopi Susu Aren masih ada?', 'bisnis');
    assert.ok(typeof businessContext === 'string', 'Context bisnis harus bertipe string');
    assert.ok(businessContext.length > 0, 'Context bisnis tidak boleh kosong');
    console.log('  -> OK: Context Builder Mode Bisnis menghasilkan konteks:', businessContext.substring(0, 80) + '...');

    // Test context builder mode personal
    const personalContext = buildContext('Rekap pengeluaran bulan ini', 'personal');
    assert.ok(typeof personalContext === 'string', 'Context personal harus bertipe string');
    console.log('  -> OK: Context Builder Mode Personal menghasilkan konteks:', personalContext.substring(0, 80) + '...');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 1:', err.message);
    failed = true;
  }

  // Test 2: Template Prompt Loading
  console.log('\n[Test 2/5] Memeriksa Template Prompt Sistem...');
  try {
    const businessPromptPath = path.resolve(__dirname, '../src/ai/prompts/business/base.md');
    const personalPromptPath = path.resolve(__dirname, '../src/ai/prompts/personal/base.md');

    assert.ok(fs.existsSync(businessPromptPath), 'File prompt bisnis base.md harus ada');
    assert.ok(fs.existsSync(personalPromptPath), 'File prompt personal base.md harus ada');

    const businessPrompt = fs.readFileSync(businessPromptPath, 'utf-8');
    const personalPrompt = fs.readFileSync(personalPromptPath, 'utf-8');

    assert.ok(businessPrompt.includes('Mode Bisnis') || businessPrompt.includes('asisten'), 'Prompt bisnis harus memuat panduan bisnis');
    assert.ok(personalPrompt.includes('Mode Personal') || personalPrompt.includes('pengeluaran'), 'Prompt personal harus memuat panduan personal');
    console.log('  -> OK: Template Prompt Sistem (Bisnis & Personal) valid dan terbaca.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 2:', err.message);
    failed = true;
  }

  // Test 3: Gemini & Grok Provider Fallback Resilience
  console.log('\n[Test 3/5] Memeriksa Fallback Handling Provider (Saat API Key Kosong / Invalid)...');
  try {
    const { callGemini, validateGeminiKey } = require('../src/ai/providers/gemini');
    const { callGrok, validateGrokKey } = require('../src/ai/providers/grok');

    // Test Gemini dengan key kosong -> harus fallback ramah, jangan throw unhandled
    const fallbackGemini = await callGemini('Halo', 'System prompt', { apiKey: '' });
    assert.ok(fallbackGemini.reply, 'Gemini fallback harus menghasilkan pesan balasan');
    assert.ok(fallbackGemini.error, 'Gemini fallback harus mencatat adanya error');
    console.log('  -> OK: Gemini Graceful Fallback:', fallbackGemini.reply);

    // Test Grok fallback
    const fallbackGrok = await callGrok('Deskripsikan gambar ini', null, { apiKey: '' });
    assert.ok(fallbackGrok.reply, 'Grok fallback harus menghasilkan pesan balasan');
    console.log('  -> OK: Grok Graceful Fallback:', fallbackGrok.reply);

    // Test validasi key palsu
    const valResult = await validateGeminiKey('INVALID_DUMMY_KEY');
    assert.strictEqual(valResult.valid, false, 'Key palsu harus menghasilkan valid: false');
    console.log('  -> OK: Validasi API key palsu terdeteksi tidak valid.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 3:', err.message);
    failed = true;
  }

  // Test 4: AI Router generateReply Interface
  console.log('\n[Test 4/5] Memeriksa AI Router generateReply()...');
  try {
    const { generateReply, validateKey } = require('../src/ai/router');

    assert.strictEqual(typeof generateReply, 'function', 'generateReply harus berupa fungsi');
    assert.strictEqual(typeof validateKey, 'function', 'validateKey harus berupa fungsi');

    // Panggil router tanpa key asli (memastikan routing & fallback terpadu bekerja)
    const result = await generateReply({
      message: 'Apakah ada stok kopi?',
      mode: 'bisnis',
      apiKeyOverride: ''
    });

    assert.ok(result.reply, 'Router harus selalu mengembalikan reply');
    assert.ok(typeof result.reply === 'string', 'Reply harus berupa string');
    console.log('  -> OK: generateReply() mengembalikan respons aman:', result.reply);
  } catch (err) {
    console.error('  ❌ Gagal pada Test 4:', err.message);
    failed = true;
  }

  // Test 5: Barrel Export src/ai/index.js
  console.log('\n[Test 5/5] Memeriksa Barrel Export di src/ai/index.js...');
  try {
    const aiModule = require('../src/ai');
    assert.ok(aiModule.generateReply, 'generateReply harus diekspor dari src/ai');
    assert.ok(aiModule.buildContext, 'buildContext harus diekspor dari src/ai');
    assert.ok(aiModule.validateKey, 'validateKey harus diekspor dari src/ai');
    console.log('  -> OK: src/ai/index.js mengekspor semua fungsi publik.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 5:', err.message);
    failed = true;
  }

  if (failed) {
    console.log('\n❌ STATUS TDD: RED (Implementasi belum lengkap / pengujian gagal)');
    process.exitCode = 1;
  } else {
    console.log('\n✅ STATUS TDD: GREEN (Semua komponen AI Integration Layer lulus pengujian 100%)');
    process.exitCode = 0;
  }
}

runTddTests();
