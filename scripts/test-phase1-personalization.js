const assert = require('assert');
const { getConfig, saveConfig } = require('../src/config');
const { generateReply, loadSystemPrompt } = require('../src/ai/router');
const { splitIntoBubbles } = require('../src/engine/bubble-sender');

async function testPhase1() {
  console.log('=== PENGUJIAN TDD FASE 1: PERSONALISASI AI & MODEL PICKER ===\n');

  // Test 1: Konfigurasi & Persistensi
  console.log('[Test 1/4] Pengujian penyimpanan konfigurasi gaya bahasa & model...');
  saveConfig({
    ai_model: 'gemini-3.5-flash',
    response_length: 'ringkas',
    tone_style: 'santai',
    emoji_level: 'minimal',
    max_bubbles: 2
  });

  let cfg = getConfig();
  assert.strictEqual(cfg.ai_model, 'gemini-3.5-flash');
  assert.strictEqual(cfg.response_length, 'ringkas');
  assert.strictEqual(cfg.tone_style, 'santai');
  assert.strictEqual(cfg.emoji_level, 'minimal');
  assert.strictEqual(cfg.max_bubbles, 2);
  console.log('  -> OK: Konfigurasi berhasil disimpan dan dibaca secara presisi.');

  // Test 2: Generator System Prompt Dinamis
  console.log('\n[Test 2/4] Pengujian generator system prompt persona...');
  const promptSantai = loadSystemPrompt('bisnis', {
    business_name: 'Warung Kopi Gaul',
    tone_style: 'santai',
    response_length: 'ringkas',
    emoji_level: 'minimal'
  });
  assert(promptSantai.includes('Santai, gaul, akrab'), 'Harus memuat instruksi nada santai');
  assert(promptSantai.includes('Ringkas, padat, dan to the point'), 'Harus memuat instruksi ringkas');
  assert(promptSantai.includes('Minimalis'), 'Harus memuat instruksi emoji minimalis');
  console.log('  -> OK: Prompt persona dinamis terbangun sesuai konfigurasi.');

  const promptFormal = loadSystemPrompt('bisnis', {
    business_name: 'PT Kopi Nusantara',
    tone_style: 'formal',
    response_length: 'detail',
    emoji_level: 'ekspresif'
  });
  assert(promptFormal.includes('Formal, baku, sangat santun'), 'Harus memuat instruksi nada formal');
  assert(promptFormal.includes('Lengkap dan detail'), 'Harus memuat instruksi detail');
  assert(promptFormal.includes('Ekspresif dan ceria'), 'Harus memuat instruksi emoji ekspresif');
  console.log('  -> OK: Prompt varian formal & detail terbangun dengan tepat.');

  // Test 3: Multi-Bubble Chunking dengan batas max_bubbles dinamis
  console.log('\n[Test 3/4] Pengujian pembatasan jumlah chat bubble (max_bubbles)...');
  const longText = `Halo Kak! Selamat datang di toko kami. 😊

Berikut adalah daftar menu kopi kami yang tersedia:
1. Espresso Single Origin - Rp22.000
2. Espresso Blend - Rp25.000
3. Kopi Susu Gula Aren - Rp18.000

---

Cara Pemesanan:
Silakan kirimkan format pemesanan Nama, Alamat, dan Jumlah Pesanan ya Kak!

---

Ada yang ingin Kakak tanyakan lagi mengenai produk kami?`;

  const bubblesMax1 = splitIntoBubbles(longText, 1);
  assert.strictEqual(bubblesMax1.length, 1, 'Max bubbles 1 harus menghasilkan tepat 1 bubble');

  const bubblesMax2 = splitIntoBubbles(longText, 2);
  assert.strictEqual(bubblesMax2.length, 2, 'Max bubbles 2 harus menghasilkan tepat 2 bubble');

  const bubblesMax3 = splitIntoBubbles(longText, 3);
  assert(bubblesMax3.length >= 2 && bubblesMax3.length <= 3, 'Max bubbles 3 harus menghasilkan 2-3 bubble');
  console.log('  -> OK: Multi-bubble splitter mematuhi batas max_bubbles dari 1 sampai 3.');

  // Test 4: Eksekusi AI generateReply dengan model terpilih
  console.log('\n[Test 4/4] Pengujian pemanggilan AI dengan konfigurasi persona...');
  const replyResult = await generateReply({
    message: 'halo min, ready kopi apa saja?',
    mode: 'bisnis'
  });
  assert(replyResult.reply && replyResult.reply.length > 0, 'Harus menghasilkan teks balasan');
  console.log('  -> OK: AI membalas dengan sukses menggunakan model & prompt terkustomisasi.');
  console.log('  -> Cuplikan Balasan AI:', replyResult.reply.substring(0, 100) + '...');

  // Kembalikan config ke default standar yang optimal
  saveConfig({
    ai_model: 'gemini-3.7-flash',
    response_length: 'sedang',
    tone_style: 'ramah',
    emoji_level: 'wajar',
    max_bubbles: 3
  });

  console.log('\n✅ FASE 1 SELESAI & LULUS 100% (STATUS: GREEN)');
}

testPhase1().catch(err => {
  console.error('\n❌ GAGAL PENGUJIAN FASE 1:', err);
  process.exit(1);
});
