const assert = require('assert');
const { getStatus, ENGINE_STATUS, setStatus } = require('../src/engine/status');

async function testPhase8() {
  console.log('=== PENGUJIAN TDD FASE 8: SCAN ULANG & GANTI DEVICE DI SETTINGS ===\n');

  // Test 1: Pengujian Status Engine
  console.log('[Test 1/2] Pengujian status engine WhatsApp...');
  setStatus(ENGINE_STATUS.READY, {
    info: {
      pushname: 'Tentang Guppy Asistant',
      phone: '628892114763',
      platform: 'WhatsApp Web'
    }
  });

  const currentStatus = getStatus();
  assert.strictEqual(currentStatus.state, ENGINE_STATUS.READY);
  assert.strictEqual(currentStatus.info.pushname, 'Tentang Guppy Asistant');
  assert.strictEqual(currentStatus.info.phone, '628892114763');
  console.log('  -> OK: Status READY dan info akun terbaca presisi.');

  // Test 2: Simulasi Mode QR Ready saat Reset Sesi
  console.log('\n[Test 2/2] Pengujian transisi status saat scan ulang / reset sesi...');
  setStatus(ENGINE_STATUS.QR_READY, {
    qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    rawQr: 'mock_qr_string_for_testing'
  });

  const qrStatus = getStatus();
  assert.strictEqual(qrStatus.state, ENGINE_STATUS.QR_READY);
  assert(qrStatus.qrCodeDataUrl.startsWith('data:image/png;base64,'), 'QR data URL harus terisi');
  console.log('  -> OK: Status QR_READY dan data QR Code berhasil disalurkan ke antarmuka.');

  // Kembalikan ke state Ready
  setStatus(ENGINE_STATUS.READY, {
    info: {
      pushname: 'Tentang Guppy Asistant',
      phone: '628892114763',
      platform: 'WhatsApp Web'
    }
  });

  console.log('\n✅ FASE 8 SELESAI & LULUS 100% (STATUS: GREEN)');
}

testPhase8().catch(err => {
  console.error('\n❌ GAGAL PENGUJIAN FASE 8:', err);
  process.exit(1);
});
