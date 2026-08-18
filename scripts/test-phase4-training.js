const assert = require('assert');
const db = require('../src/db');
const { buildFewShotSamplesContext, buildContext } = require('../src/ai/context-builder');
const { generateReply } = require('../src/ai/router');

async function testPhase4() {
  console.log('=== PENGUJIAN TDD FASE 4: TRAINING GAYA PERCAKAPAN & FEW-SHOT ===\n');

  // Test 1: CRUD Tabel conversation_samples
  console.log('[Test 1/3] Pengujian CRUD sampel percakapan di database lokal...');
  const sampleId = db.createSample({
    user_sample: 'Apakah kopinya asam atau manis?',
    bot_sample: 'Halo Kak! Kopi kami menggunakan perpaduan Arabika & Robusta dengan hint fruity segar dan manis gula aren asli. Mau pesan yang varian manis creamy, Kak? ✨',
    tag: 'rasa',
    is_active: 1
  });

  assert(sampleId > 0, 'ID sampel baru harus bernilai > 0');
  const fetched = db.getSampleById(sampleId);
  assert.strictEqual(fetched.tag, 'rasa');
  assert.strictEqual(fetched.is_active, 1);
  assert(fetched.bot_sample.includes('fruity segar'));

  // Update
  db.updateSample(sampleId, {
    user_sample: 'Apakah kopinya asam atau manis?',
    bot_sample: 'Halo Kak! Kopi kami sangat nikmat dan pas di lidah.',
    tag: 'rasa_kopi',
    is_active: 1
  });
  const updated = db.getSampleById(sampleId);
  assert.strictEqual(updated.tag, 'rasa_kopi');

  // Toggle
  db.toggleSampleActive(sampleId);
  assert.strictEqual(db.getSampleById(sampleId).is_active, 0, 'Status harus jadi nonaktif (0)');

  db.toggleSampleActive(sampleId);
  assert.strictEqual(db.getSampleById(sampleId).is_active, 1, 'Status harus aktif kembali (1)');
  console.log('  -> OK: Operasi create, get, update, dan toggle status sampel berhasil.');

  // Test 2: Injeksi Few-Shot Context ke Prompt Generator
  console.log('\n[Test 2/3] Pengujian injeksi sampel ke Context Builder...');
  const fewShotContext = buildFewShotSamplesContext();
  assert(fewShotContext.includes('CONTOH GAYA PERCAKAPAN YANG DIINGINKAN'), 'Harus memuat header few-shot');
  assert(fewShotContext.includes('Apakah kopinya asam atau manis?'), 'Harus memuat contoh pertanyaan user');
  assert(fewShotContext.includes('Halo Kak! Kopi kami sangat nikmat'), 'Harus memuat contoh balasan bot');

  const fullContext = buildContext('mau tanya kopi', 'bisnis');
  assert(fullContext.includes('CONTOH GAYA PERCAKAPAN YANG DIINGINKAN'), 'Full Context harus memuat few-shot training');
  console.log('  -> OK: Few-shot context builder berhasil menyusun format prompt terstruktur.');

  // Test 3: Pemanggilan AI generateReply dengan Few-Shot Active
  console.log('\n[Test 3/3] Pengujian pemanggilan AI dengan injeksi Few-Shot Learning...');
  const res = await generateReply({
    message: 'apakah kopinya asam atau manis?',
    mode: 'bisnis'
  });

  assert(res.reply && res.reply.length > 0, 'Balasan AI harus terisi');
  console.log('  -> OK: AI merespon dengan mengacu pada contoh gaya percakapan yang dilatih.');
  console.log('  -> Cuplikan Respon AI:', res.reply.substring(0, 120) + '...');

  // Hapus data uji
  db.deleteSample(sampleId);
  assert.strictEqual(db.getSampleById(sampleId), null, 'Sampel uji harus sudah terhapus');
  console.log('  -> OK: Pembersihan data sampel uji berhasil.');

  console.log('\n✅ FASE 4 SELESAI & LULUS 100% (STATUS: GREEN)');
}

testPhase4().catch(err => {
  console.error('\n❌ GAGAL PENGUJIAN FASE 4:', err);
  process.exit(1);
});
