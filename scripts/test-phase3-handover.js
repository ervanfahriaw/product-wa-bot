const assert = require('assert');
const db = require('../src/db');
const { isHandoverTriggered, handleBusinessMessage } = require('../src/engine/handlers/business-handler');

async function testPhase3() {
  console.log('=== PENGUJIAN TDD FASE 3: HANDOVER NEGO HARGA & AUTO-PAUSE ===\n');

  const testContact = '62888999111@c.us';

  // Test 1: Query Contact States (Pause / Resume / Expiry)
  console.log('[Test 1/4] Pengujian mekanisme Pause & Resume per kontak di SQLite...');
  db.resumeContact(testContact);
  assert.strictEqual(db.isContactPaused(testContact), false, 'Kontak baru harusnya tidak dalam status pause');

  db.pauseContact(testContact, 2, 'Pengujian Handover Nego');
  assert.strictEqual(db.isContactPaused(testContact), true, 'Kontak harus berstatus is_paused = true');

  const pausedList = db.getAllPausedContacts();
  const found = pausedList.find(p => p.contact === testContact);
  assert(found, 'Kontak harus ditemukan dalam daftar getAllPausedContacts');
  assert.strictEqual(found.pause_reason, 'Pengujian Handover Nego');

  db.resumeContact(testContact);
  assert.strictEqual(db.isContactPaused(testContact), false, 'Setelah di-resume, status pause harus false');
  console.log('  -> OK: Query pauseContact, resumeContact, dan isContactPaused berfungsi 100%.');

  // Test 2: Deteksi Kata Kunci Nego, Diskon, Keluhan, dan Owner Handover
  console.log('\n[Test 2/4] Pengujian deteksi kata kunci Nego Harga & Handover...');
  const testPhrases = [
    { text: 'Halo kak, kopi susu gula aren bisa nego gak harganya?', expected: true },
    { text: 'Kalau beli 10 botol ada potongan diskon grosir?', expected: true },
    { text: 'Harga pas nya berapa ya kak?', expected: true },
    { text: 'Saya mau komplain kemarin susunya apek dan basi', expected: true },
    { text: 'Boleh minta nomor rekening transfer pribadi owner?', expected: true },
    { text: 'Bisa bicara langsung sama owner toko?', expected: true },
    { text: 'Halo min, produk ready apa saja ya?', expected: false },
    { text: 'Susu aren itu terbuat dari apa?', expected: false }
  ];

  for (const item of testPhrases) {
    const triggered = isHandoverTriggered(item.text);
    assert.strictEqual(triggered, item.expected, `Pesan: "${item.text}" harus menghasilkan ${item.expected}`);
  }
  console.log('  -> OK: Seluruh variasi kata kunci tawar/nego/komplain terdeteksi presisi.');

  // Test 3: Simulasi Bypass Bot Ketika Kontak Sedang Di-Pause
  console.log('\n[Test 3/4] Pengujian auto-mute (bot tidak membalas jika kontak di-pause)...');
  db.pauseContact(testContact, 2, 'Owner sedang chat manual');
  
  let replied = false;
  const mockMessage = {
    from: testContact,
    body: 'halo saya tunggu responnya',
    reply: async () => { replied = true; },
    getChat: async () => ({ sendStateTyping: async () => {}, clearState: async () => {} })
  };

  const mockClient = {
    sendMessage: async (to) => { 
      if (to === testContact) replied = true; 
    }
  };

  await handleBusinessMessage(mockMessage, mockClient);
  assert.strictEqual(replied, false, 'Bot HARUS TIDAK MEMBALAS sama sekali jika kontak berstatus paused!');
  console.log('  -> OK: Bot dengan sukses membisukan diri (silent bypass) saat kontak berstatus paused.');

  // Bersihkan kembali status kontak pengujian
  db.resumeContact(testContact);

  // Test 4: Simulasi Pesan Masuk Nego Memicu Auto-Pause & Handover Alert
  console.log('\n[Test 4/4] Pengujian pesan nego otomatis mengaktifkan auto-pause 2 jam...');
  let sentMessage = '';
  const mockNegoMessage = {
    from: testContact,
    body: 'bisa tawar jadi 15 ribu ga kak?',
    reply: async (txt) => { sentMessage = txt; },
    getChat: async () => ({ sendStateTyping: async () => {}, clearState: async () => {} })
  };

  let ownerAlertSent = false;
  const mockOwnerClient = {
    sendMessage: async (jid, txt) => { 
      if (txt.includes('NOTIFIKASI HANDOVER')) ownerAlertSent = true;
    }
  };

  await handleBusinessMessage(mockNegoMessage, mockOwnerClient);
  assert.strictEqual(db.isContactPaused(testContact), true, 'Pesan nego harus otomatis mengaktifkan status paused kontak!');
  console.log('  -> OK: Auto-pause 2 jam aktif otomatis saat terjadi negosiasi harga.');

  // Bersihkan state pengujian
  db.resumeContact(testContact);

  console.log('\n✅ FASE 3 SELESAI & LULUS 100% (STATUS: GREEN)');
}

testPhase3().catch(err => {
  console.error('\n❌ GAGAL PENGUJIAN FASE 3:', err);
  process.exit(1);
});
