const assert = require('assert');
const db = require('../src/db');
const { buildChatHistoryContext, buildContext } = require('../src/ai/context-builder');
const { saveConfig } = require('../src/config');

console.log('================================================================');
console.log('🧪 Memulai Pengujian Ekstensi Memori Riwayat Chat & Penyatuan JID');
console.log('================================================================\n');

const PHONE_JID = '6289912345678@c.us';
const LID_JID = '88889999000011@lid';
const CLEAN_PHONE = '089912345678';
const CUSTOMER_NAME = 'Budi Sentosa';

// Bersihkan data uji sebelumnya
db.db.prepare("DELETE FROM chat_logs WHERE contact IN (?, ?, ?)").run(PHONE_JID, LID_JID, CLEAN_PHONE);
db.db.prepare("DELETE FROM customer_profiles WHERE contact IN (?, ?)").run(PHONE_JID, LID_JID);

// 1. Uji Penyimpanan dan Pengambilan Riwayat Multi-turn (12 percakapan)
console.log('1️⃣ Menguji kapasitas memori riwayat chat hingga 12 interaksi...');

for (let i = 1; i <= 12; i++) {
  db.createChatLog({
    contact: PHONE_JID,
    message_in: `Pesan tanya #${i} dari pelanggan (topik: produk ${i})`,
    message_out: `Balasan bot #${i} untuk pertanyaan ${i}`,
    handled_by: 'ai'
  });
}

const logsFetched = db.getChatLogsByContact(PHONE_JID, 12);
assert.strictEqual(logsFetched.length, 12, 'Harus mengambil tepat 12 riwayat log chat');
console.log(`   ✅ Berhasil mengambil ${logsFetched.length} riwayat percakapan dari database!`);

const historyContext = buildChatHistoryContext(PHONE_JID, 12);
assert.ok(historyContext.includes('Pesan tanya #1'), 'Konteks riwayat harus memuat pesan percakapan paling awal (#1)');
assert.ok(historyContext.includes('Pesan tanya #12'), 'Konteks riwayat harus memuat pesan percakapan terbaru (#12)');
assert.ok(historyContext.includes('(12 Interaksi Sebelumnya)'), 'Header riwayat harus mencantumkan jumlah interaksi');
console.log('   ✅ buildChatHistoryContext menyuntikkan 12 percakapan secara runtut dan kronologis!\n');

// 2. Uji Penyatuan Riwayat Lintas JID (@lid dan @c.us)
console.log('2️⃣ Menguji Penyatuan Riwayat Chat Lintas Format ID (@lid dan @c.us)...');

// Tautkan profil pelanggan
db.upsertCustomerProfile(LID_JID, {
  customer_name: CUSTOMER_NAME,
  phone_number: CLEAN_PHONE,
  lid_jid: LID_JID
});
db.upsertCustomerProfile(PHONE_JID, {
  customer_name: CUSTOMER_NAME,
  phone_number: CLEAN_PHONE,
  lid_jid: LID_JID
});

// Masukkan 3 pesan tambahan melalui format LID
db.createChatLog({
  contact: LID_JID,
  message_in: 'Saya sekarang chat pakai akun WhatsApp versi modern (@lid)',
  message_out: 'Baik Kak Budi, riwayat lama tetap tersambung dengan aman!',
  handled_by: 'ai'
});

// Ambil log menggunakan format @lid
const mergedLogsFromLid = db.getChatLogsByContact(LID_JID, 15);
assert.ok(mergedLogsFromLid.length >= 13, 'Query dengan @lid harus otomatis menyertakan riwayat dari @c.us');
const hasPhoneLog = mergedLogsFromLid.some(l => l.message_in.includes('Pesan tanya #1'));
const hasLidLog = mergedLogsFromLid.some(l => l.message_in.includes('versi modern (@lid)'));
assert.strictEqual(hasPhoneLog, true, 'Log dari @c.us harus ditemukan');
assert.strictEqual(hasLidLog, true, 'Log dari @lid harus ditemukan');
console.log(`   ✅ Berhasil menggabungkan ${mergedLogsFromLid.length} log dari kedua format JID secara transparan!`);

// 3. Uji Pembersihan Tag Internal pada Riwayat Chat
console.log('3️⃣ Menguji Pembersihan Tag Internal ([HANDOVER_REQUIRED], [CUSTOMER_NAME]) pada Riwayat...');

db.createChatLog({
  contact: LID_JID,
  message_in: 'Nama saya Budi',
  message_out: 'Halo Kak Budi! [CUSTOMER_NAME:Budi] [HANDOVER_REQUIRED] Ada yang bisa dibantu?',
  handled_by: 'ai'
});

const cleanedHistory = buildChatHistoryContext(LID_JID, 15);
assert.ok(!cleanedHistory.includes('[CUSTOMER_NAME:'), 'Tag [CUSTOMER_NAME] harus dibersihkan dari riwayat');
assert.ok(!cleanedHistory.includes('[HANDOVER_REQUIRED]'), 'Tag [HANDOVER_REQUIRED] harus dibersihkan dari riwayat');
assert.ok(cleanedHistory.includes('Halo Kak Budi! Ada yang bisa dibantu?'), 'Teks bersih harus tetap dipertahankan');
console.log('   ✅ Format riwayat bersih dari metadata sistem internal!\n');

// 4. Uji Integrasi buildContext dengan Konfigurasi
console.log('4️⃣ Menguji Integrasi buildContext dengan Memory Limit Dinamis...');

saveConfig({ chat_history_limit: 15 });
const fullContext = buildContext('apakah pesanan saya kemarin sudah diproses?', 'bisnis', LID_JID);
assert.ok(fullContext.includes('[RIWAYAT PERCAKAPAN TERAKHIR DENGAN KONTAK INI'), 'buildContext harus menyertakan riwayat');
assert.ok(fullContext.includes('Pesan tanya #1'), 'buildContext harus menyertakan percakapan awal');
console.log('   ✅ buildContext berhasil mengintegrasikan memori panjang 15 chat secara otomatis!\n');

// Bersihkan data uji
db.db.prepare("DELETE FROM chat_logs WHERE contact IN (?, ?, ?)").run(PHONE_JID, LID_JID, CLEAN_PHONE);
db.db.prepare("DELETE FROM customer_profiles WHERE contact IN (?, ?)").run(PHONE_JID, LID_JID);

console.log('================================================================');
console.log('🎉 SEMUA PENGUJIAN MEMORI RIWAYAT CHAT & PENYATUAN JID LULUS 100%!');
console.log('================================================================\n');
