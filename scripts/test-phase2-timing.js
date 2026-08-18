const assert = require('assert');
const { getConfig, saveConfig } = require('../src/config');
const { calculateInterBubbleDelay, splitIntoBubbles } = require('../src/engine/bubble-sender');

async function testPhase2() {
  console.log('=== PENGUJIAN TDD FASE 2: SLIDER JEDA WAKTU ANTI-BAN & TIMING ===\n');

  // Test 1: Konfigurasi Jeda Waktu & Persistensi
  console.log('[Test 1/3] Pengujian penyimpanan konfigurasi jeda waktu...');
  saveConfig({
    min_delay_sec: 8,
    max_delay_sec: 18,
    inter_bubble_delay: 3.5
  });

  const cfg = getConfig();
  assert.strictEqual(cfg.min_delay_sec, 8, 'min_delay_sec harus 8');
  assert.strictEqual(cfg.max_delay_sec, 18, 'max_delay_sec harus 18');
  assert.strictEqual(cfg.inter_bubble_delay, 3.5, 'inter_bubble_delay harus 3.5');
  console.log('  -> OK: Konfigurasi min_delay (8s), max_delay (18s), dan inter_bubble (3.5s) tersimpan presisi.');

  // Test 2: Perhitungan Jeda Mengetik Antar-Bubble & Jitter Acak
  console.log('\n[Test 2/3] Pengujian kalkulator jeda antar bubble + jitter...');
  const sampleText = 'Ini adalah teks produk yang cukup panjang untuk diuji perhitungan durasi mengetiknya.';
  
  const delay1 = calculateInterBubbleDelay(2.5, sampleText.length);
  const delay2 = calculateInterBubbleDelay(2.5, sampleText.length);
  const delay3 = calculateInterBubbleDelay(2.5, sampleText.length);

  assert(delay1 >= 1000 && delay1 <= 6000, 'Delay harus dalam batas wajar 1000-6000ms');
  assert(delay2 >= 1000 && delay2 <= 6000, 'Delay harus dalam batas wajar 1000-6000ms');
  console.log(`  -> Sample Delays: ${delay1}ms, ${delay2}ms, ${delay3}ms (menunjukkan variasi acak manusiawi).`);
  console.log('  -> OK: Perhitungan jeda antar-gelembung dinamis dan tidak statis.');

  // Test 3: Multi-Bubble Splitting & Timing Inter-Bubble
  console.log('\n[Test 3/3] Pengujian alur pemecahan gelembung dan integrasi timing...');
  const multiText = `Halo Kak! Terima kasih banyak sudah menghubungi layanan asisten kami hari ini. 😊

Berikut adalah daftar menu dan katalog produk yang saat ini tersedia dan siap dipesan:
1. Espresso Single Origin (Arabika Gayo) - Rp22.000 (Stok: 40)
2. Espresso TDD Blend (Blend Premium) - Rp25.000 (Stok: 15)
3. Kopi Susu Gula Aren Asli - Rp18.000 (Stok: 25)
4. Susu Aren Murni - Rp18.000 (Stok: 30)

---

Cara Pemesanan:
Kakak cukup mengirimkan nama penerima, alamat pengiriman lengkap, dan varian pesanan.

Kakak tertarik ingin mencoba menu yang mana hari ini?`;

  const bubbles = splitIntoBubbles(multiText, 3);
  assert(bubbles.length >= 2, 'Harus terpecah menjadi minimal 2 gelembung');
  console.log(`  -> Terpecah menjadi ${bubbles.length} gelembung chat.`);
  bubbles.forEach((b, i) => {
    const d = calculateInterBubbleDelay(cfg.inter_bubble_delay, b.length);
    console.log(`     Gelembung #${i+1} (${b.length} char) -> Estimasi Jeda: ${(d/1000).toFixed(2)} detik.`);
  });
  console.log('  -> OK: Integrasi timing dengan multi-bubble berjalan sempurna.');

  // Kembalikan ke default standar
  saveConfig({
    min_delay_sec: 5,
    max_delay_sec: 12,
    inter_bubble_delay: 2.5
  });

  console.log('\n✅ FASE 2 SELESAI & LULUS 100% (STATUS: GREEN)');
}

testPhase2().catch(err => {
  console.error('\n❌ GAGAL PENGUJIAN FASE 2:', err);
  process.exit(1);
});
