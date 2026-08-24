/**
 * TDD Test Suite: Onboarding First-Time Welcome & Quick Guide Message to Owner
 * 
 * Menguji:
 * 1. Pembangkitan teks panduan sambutan untuk Mode Bisnis & Mode Personal
 * 2. Eksekusi `sendOneTimeOnboardingWelcome()` pertama kali ke nomor owner
 * 3. Proteksi One-Time Flag (`welcome_onboarding_sent`) agar tidak dikirim berulang
 * 4. Pengabaian ketika Setup Wizard belum selesai (`is_setup_completed: false`)
 * 5. Integrasi pemanggilan di route `/setup/step-4` & event engine WhatsApp `ready`
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');
const { 
  buildOnboardingMessage, 
  sendOneTimeOnboardingWelcome,
  resetOnboardingStatus
} = require('../src/engine/onboarding');

console.log('======================================================');
console.log('   TDD TEST: FITUR ONBOARDING FIRST-TIME GUIDE TO OWNER');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     -> ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     -> ${err.message}`);
    failed++;
  }
}

async function runAllTests() {
  // ============================================================
  // GRUP 1: Pembangkitan Teks Pesan Onboarding (Mode Bisnis & Personal)
  // ============================================================
  console.log('[1/4] Testing Pembangkitan Teks Pesan Onboarding...');

  test('buildOnboardingMessage() — Mode Bisnis harus memuat panduan order, handover, dan web dashboard', () => {
    const text = buildOnboardingMessage('bisnis', { business_name: 'Guppy Store' });
    assert.ok(text.includes('SELAMAT DATANG DI WA BOT BISNIS AI'), 'Harus ada judul sambutan bisnis');
    assert.ok(text.includes('Guppy Store'), 'Harus menyertakan nama bisnis');
    assert.ok(text.includes('CARA MENCATAT PESANAN') || text.includes('FORM PESANAN'), 'Harus ada panduan order');
    assert.ok(text.includes('pesanan 1') || text.includes('nama penerima'), 'Harus ada contoh format order');
    assert.ok(text.includes('HANDOVER') || text.includes('PENGALIHAN'), 'Harus ada panduan handover');
    assert.ok(text.includes('!aktifkan') || text.includes('!selesai'), 'Harus ada contoh perintah selesai/aktifkan');
    assert.ok(text.includes('localhost:3000'), 'Harus menyertakan link dashboard web');
  });

  test('buildOnboardingMessage() — Mode Personal harus memuat panduan pencatatan pengeluaran, reminder, dan dashboard', () => {
    const text = buildOnboardingMessage('personal', {});
    assert.ok(text.includes('SELAMAT DATANG DI WA ASISTEN PRIBADI AI'), 'Harus ada judul sambutan personal');
    assert.ok(text.includes('CATAT PENGELUARAN') || text.includes('Pengeluaran'), 'Harus ada panduan pengeluaran');
    assert.ok(text.includes('PENGINGAT') || text.includes('REMINDER') || text.includes('Ingatkan'), 'Harus ada panduan reminder');
    assert.ok(text.includes('localhost:3000'), 'Harus menyertakan link dashboard web');
  });

  // ============================================================
  // GRUP 2: Eksekusi Pengiriman Pertama Kali & One-Time Guard
  // ============================================================
  console.log('\n[2/4] Testing Pengiriman Pesan Sambutan & One-Time Flag...');

  await asyncTest('sendOneTimeOnboardingWelcome() — berhasil mengirim saat setup selesai dan flag belum aktif', async () => {
    // Reset state
    db.setSetting('is_setup_completed', 'true');
    db.setSetting('welcome_onboarding_sent', 'false');
    db.setSetting('mode', 'bisnis');
    db.setSetting('owner_phone', '081321435462');
    db.setSetting('business_name', 'Toko Ikan Hias');
    saveConfig({
      is_setup_completed: true,
      mode: 'bisnis',
      owner_phone: '081321435462',
      business_name: 'Toko Ikan Hias'
    });

    let sentTo = '';
    let sentMessage = '';

    const mockClient = {
      sendMessage: async (jid, msg) => {
        sentTo = jid;
        sentMessage = msg;
        return { id: 'msg_123' };
      }
    };

    const result = await sendOneTimeOnboardingWelcome(mockClient);
    assert.strictEqual(result.sent, true, 'Harus sukses mengirim');
    assert.ok(sentTo.includes('6281321435462'), `Harus dikirim ke nomor owner, dapat: ${sentTo}`);
    assert.ok(sentMessage.includes('SELAMAT DATANG DI WA BOT BISNIS AI'), 'Pesan harus sesuai template bisnis');
    assert.ok(sentMessage.includes('Toko Ikan Hias'), 'Pesan harus memuat nama toko');

    // Cek flag di DB
    const flagInDb = db.getSetting('welcome_onboarding_sent');
    assert.strictEqual(flagInDb, 'true', 'Flag welcome_onboarding_sent di DB harus menjadi true');
  });

  await asyncTest('sendOneTimeOnboardingWelcome() — harus mengirim ke nomor input owner (082116973032) dan BUKAN ke nomor bot yang di-scan', async () => {
    // Reset state dengan nomor owner user
    db.setSetting('is_setup_completed', 'true');
    db.setSetting('welcome_onboarding_sent', 'false');
    db.setSetting('mode', 'bisnis');
    db.setSetting('owner_phone', '082116973032');
    saveConfig({
      is_setup_completed: true,
      mode: 'bisnis',
      owner_phone: '082116973032'
    });

    let sentTo = '';
    const mockClient = {
      info: {
        wid: { user: '628999888777' } // Nomor bot yang discan
      },
      sendMessage: async (jid, msg) => {
        sentTo = jid;
        return { id: 'msg_456' };
      }
    };

    const result = await sendOneTimeOnboardingWelcome(mockClient);
    assert.strictEqual(result.sent, true);
    assert.strictEqual(sentTo, '6282116973032@c.us', 'Pesan harus dikirim ke nomor owner yang diinput (082116973032 -> 6282116973032@c.us)');
    assert.notStrictEqual(sentTo, '628999888777@c.us', 'Pesan TIDAK BOLEH dikirim ke nomor bot barcode');
  });

  await asyncTest('sendOneTimeOnboardingWelcome() — TIDAK boleh mengirim ulang jika flag sudah true (One-Time Only)', async () => {
    let callCount = 0;
    const mockClient = {
      sendMessage: async () => {
        callCount++;
        return {};
      }
    };

    // Panggil kedua kali saat flag sudah 'true'
    const result = await sendOneTimeOnboardingWelcome(mockClient);
    assert.strictEqual(result.sent, false, 'Tidak boleh mengirim ulang');
    assert.strictEqual(result.reason, 'ALREADY_SENT');
    assert.strictEqual(callCount, 0, 'sendMessage tidak boleh dipanggil sama sekali');
  });

  // ============================================================
  // GRUP 3: Guard Ketika Setup Belum Selesai
  // ============================================================
  console.log('\n[3/4] Testing Guard Setup Belum Selesai...');


  await asyncTest('sendOneTimeOnboardingWelcome() — TIDAK mengirim jika setup wizard belum selesai', async () => {
    db.setSetting('is_setup_completed', 'false');
    db.setSetting('welcome_onboarding_sent', 'false');
    saveConfig({ is_setup_completed: false });

    let callCount = 0;
    const mockClient = {
      sendMessage: async () => {
        callCount++;
        return {};
      }
    };

    const result = await sendOneTimeOnboardingWelcome(mockClient);
    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.reason, 'SETUP_NOT_COMPLETED');
    assert.strictEqual(callCount, 0);
  });

  // ============================================================
  // GRUP 4: Integrasi di Setup Wizard Routes & Client Event
  // ============================================================
  console.log('\n[4/4] Testing Integrasi Setup Route & Engine...');

  test('setup.js & client.js — harus mengimpor dan memanggil onboarding welcome helper', () => {
    const setupRoutePath = path.resolve(__dirname, '../src/server/routes/setup.js');
    const clientEnginePath = path.resolve(__dirname, '../src/engine/client.js');

    const setupContent = fs.readFileSync(setupRoutePath, 'utf-8');
    const clientContent = fs.readFileSync(clientEnginePath, 'utf-8');

    assert.ok(
      setupContent.includes('onboarding') || setupContent.includes('sendOneTimeOnboardingWelcome'),
      'setup.js harus memuat pemanggilan onboarding welcome'
    );
    assert.ok(
      clientContent.includes('onboarding') || clientContent.includes('sendOneTimeOnboardingWelcome'),
      'client.js harus memuat pemanggilan onboarding welcome pada event ready'
    );
  });

  console.log('\n======================================================');
  console.log(`HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
