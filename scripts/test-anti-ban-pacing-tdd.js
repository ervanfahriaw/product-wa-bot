/**
 * TDD Suite: Pengujian Sistem Keamanan Anti-Ban WhatsApp Lengkap (Human Pacing & Read Receipts)
 * 
 * Memvalidasi urutan sempurna perilaku manusia:
 * 1. Pesan Masuk (Debounce)
 * 2. Jeda Respon Awal (Pre-Read Delay)
 * 3. Tandai Telah Dibaca (sendSeen / Centang Biru)
 * 4. Jeda Membaca Pesan (Post-Read Delay)
 * 5. Indikator Mengetik (sendStateTyping / "Sedang mengetik...")
 * 6. Durasi Mengetik Alami (Typing Delay)
 * 7. Bersihkan Status (clearState) & Kirim Balasan
 * 8. Ketahanan Error (Resilience terhadap kegagalan socket / getChat null)
 */

const assert = require('assert');
const path = require('path');

// Pastikan flag test aktif
process.env.NODE_ENV = 'test';
process.env.NO_DELAY = '1';

console.log('================================================================');
console.log('   TDD SUITE: ANTI-BAN HUMAN PACING & READ RECEIPT (sendSeen)   ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    const result = await fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}\n`);
  }
}

async function main() {
  // Test 1: Modul human-pacing.js harus tersedia dan mengekspor fungsi simulateHumanPacing
  await runTest('Modul src/engine/human-pacing.js tersedia dan valid', () => {
    const pacingModule = require('../src/engine/human-pacing');
    assert.strictEqual(typeof pacingModule.simulateHumanPacing, 'function', 'simulateHumanPacing harus berupa fungsi');
    assert.strictEqual(typeof pacingModule.calculatePacingDelays, 'function', 'calculatePacingDelays harus berupa fungsi');
  });

  // Test 2: Urutan pemanggilan API WhatsApp Web (sendSeen HARUS dipanggil sebelum sendStateTyping)
  await runTest('Urutan eksekusi: sendSeen() dipanggil SEBELUM sendStateTyping()', async () => {
    const { simulateHumanPacing } = require('../src/engine/human-pacing');
    const callOrder = [];

    const mockChat = {
      sendSeen: async () => {
        callOrder.push('sendSeen');
        return true;
      },
      sendStateTyping: async () => {
        callOrder.push('sendStateTyping');
        return true;
      },
      clearState: async () => {
        callOrder.push('clearState');
        return true;
      }
    };

    const mockMessage = {
      from: '628123456789@c.us',
      getChat: async () => mockChat
    };

    const report = await simulateHumanPacing(mockMessage, { skipDelays: true });

    assert.deepStrictEqual(callOrder, ['sendSeen', 'sendStateTyping', 'clearState'], 'Urutan harus sendSeen -> sendStateTyping -> clearState');
    assert.strictEqual(report.seenCalled, true, 'sendSeen harus tercatat dipanggil');
    assert.strictEqual(report.typingCalled, true, 'sendStateTyping harus tercatat dipanggil');
    assert.strictEqual(report.clearedCalled, true, 'clearState harus tercatat dipanggil');
  });

  // Test 3: Perhitungan jeda waktu manusiawi (Pre-Read, Post-Read, Typing)
  await runTest('Kalkulasi jeda waktu menghasilkan delay positif dan proporsional', () => {
    const { calculatePacingDelays } = require('../src/engine/human-pacing');
    
    const config = { min_delay_sec: 4, max_delay_sec: 10 };
    const delays = calculatePacingDelays(config);

    assert.ok(delays.preReadDelay >= 800 && delays.preReadDelay <= 3000, `preReadDelay harus wajar (actual: ${delays.preReadDelay}ms)`);
    assert.ok(delays.postReadDelay >= 800 && delays.postReadDelay <= 3000, `postReadDelay harus wajar (actual: ${delays.postReadDelay}ms)`);
    assert.ok(delays.typingDelay >= 3000 && delays.typingDelay <= 12000, `typingDelay harus sesuai rentang config (actual: ${delays.typingDelay}ms)`);
  });

  // Test 4: Ketahanan Error - Jika sendSeen gagal/throw, proses tetap lanjut ke typing tanpa crash
  await runTest('Ketahanan Error: Jika sendSeen() gagal/throw, tidak menyebabkan crash', async () => {
    const { simulateHumanPacing } = require('../src/engine/human-pacing');
    let typingWasCalled = false;

    const mockChat = {
      sendSeen: async () => {
        throw new Error('Socket network timeout saat kirim seen');
      },
      sendStateTyping: async () => {
        typingWasCalled = true;
        return true;
      },
      clearState: async () => true
    };

    const mockMessage = {
      from: '628123456789@c.us',
      getChat: async () => mockChat
    };

    const report = await simulateHumanPacing(mockMessage, { skipDelays: true });
    assert.strictEqual(report.seenError, true, 'Error pada seen harus ditangkap dengan anggun');
    assert.strictEqual(typingWasCalled, true, 'sendStateTyping harus tetap terpanggil meski seen error');
  });

  // Test 5: Ketahanan Error - Jika getChat() mengembalikan null atau error
  await runTest('Ketahanan Error: Jika message.getChat() null atau throw', async () => {
    const { simulateHumanPacing } = require('../src/engine/human-pacing');

    const mockMessageBroken = {
      from: '628123456789@c.us',
      getChat: async () => {
        throw new Error('Chat object unavailable');
      }
    };

    // Tidak boleh melempar unhandled rejection
    const report = await simulateHumanPacing(mockMessageBroken, { skipDelays: true });
    assert.strictEqual(report.chatAvailable, false, 'Harus mendeteksi chat tidak tersedia');
  });

  // Test 6: Integrasi ke Business Handler (simulateHumanTyping memanggil sendSeen)
  await runTest('Integrasi Business Handler: simulateHumanTyping mencakup sendSeen()', async () => {
    const businessHandler = require('../src/engine/handlers/business-handler');
    assert.strictEqual(typeof businessHandler.simulateHumanTyping, 'function', 'simulateHumanTyping harus ada di business-handler');

    const events = [];
    const mockChat = {
      sendSeen: async () => {
        events.push('seen');
        return true;
      },
      sendStateTyping: async () => {
        events.push('typing');
        return true;
      },
      clearState: async () => {
        events.push('cleared');
        return true;
      }
    };

    const mockMsg = {
      from: '628111222333@c.us',
      getChat: async () => mockChat
    };

    await businessHandler.simulateHumanTyping(mockMsg, 100, 200);
    assert.ok(events.includes('seen'), 'simulateHumanTyping di business-handler harus memanggil sendSeen');
    assert.ok(events.includes('typing'), 'simulateHumanTyping di business-handler harus memanggil sendStateTyping');
    assert.ok(events.indexOf('seen') < events.indexOf('typing'), 'seen harus dipanggil sebelum typing di business-handler');
  });

  // Test 7: Integrasi ke Personal Handler (simulateHumanTyping memanggil sendSeen)
  await runTest('Integrasi Personal Handler: simulateHumanTyping mencakup sendSeen()', async () => {
    const personalHandler = require('../src/engine/handlers/personal-handler');
    assert.strictEqual(typeof personalHandler.simulateHumanTyping, 'function', 'simulateHumanTyping harus ada di personal-handler');

    const events = [];
    const mockChat = {
      sendSeen: async () => {
        events.push('seen');
        return true;
      },
      sendStateTyping: async () => {
        events.push('typing');
        return true;
      },
      clearState: async () => {
        events.push('cleared');
        return true;
      }
    };

    const mockMsg = {
      from: '628111222333@c.us',
      getChat: async () => mockChat
    };

    await personalHandler.simulateHumanTyping(mockMsg, 100, 200);
    assert.ok(events.includes('seen'), 'simulateHumanTyping di personal-handler harus memanggil sendSeen');
    assert.ok(events.includes('typing'), 'simulateHumanTyping di personal-handler harus memanggil sendStateTyping');
    assert.ok(events.indexOf('seen') < events.indexOf('typing'), 'seen harus dipanggil sebelum typing di personal-handler');
  });

  // Test 8: Simulasi Jeda Realistis Non-Test (verifikasi jeda sleep dipanggil sesuai urutan)
  await runTest('Simulasi Jeda Nyata: Alur delayPreRead -> sendSeen -> delayPostRead -> typing -> delayTyping', async () => {
    const { simulateHumanPacing } = require('../src/engine/human-pacing');
    const timeline = [];

    const mockChat = {
      sendSeen: async () => {
        timeline.push({ event: 'sendSeen', time: Date.now() });
      },
      sendStateTyping: async () => {
        timeline.push({ event: 'sendStateTyping', time: Date.now() });
      },
      clearState: async () => {
        timeline.push({ event: 'clearState', time: Date.now() });
      }
    };

    const mockMessage = {
      from: '628999@c.us',
      getChat: async () => mockChat
    };

    // Panggil dengan jeda kecil terkontrol untuk verifikasi timeline
    await simulateHumanPacing(mockMessage, {
      preReadMs: 30,
      postReadMs: 30,
      minMs: 50,
      maxMs: 50,
      forceRealDelay: true
    });

    assert.strictEqual(timeline.length, 3, 'Harus ada 3 event timeline');
    assert.strictEqual(timeline[0].event, 'sendSeen');
    assert.strictEqual(timeline[1].event, 'sendStateTyping');
    assert.strictEqual(timeline[2].event, 'clearState');

    // Pastikan ada delta waktu antara seen dan typing (post-read delay)
    const postReadDelta = timeline[1].time - timeline[0].time;
    assert.ok(postReadDelta >= 20, `Harus ada jeda membaca antara seen dan typing (actual delta: ${postReadDelta}ms)`);
  });

  console.log('\n================================================================');
  console.log(`HASIL: ${passedTests} passed, ${failedTests} failed (Total: ${totalTests})`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
