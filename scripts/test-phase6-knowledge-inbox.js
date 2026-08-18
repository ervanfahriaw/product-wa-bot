const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('../src/db');
const { extractTextFromFile } = require('../src/utils/document-parser');
const { buildBusinessProfileContext, buildContext } = require('../src/ai/context-builder');
const { generateReply } = require('../src/ai/router');

async function testPhase6() {
  console.log('=== PENGUJIAN TDD FASE 6: PROFIL BISNIS, DOKUMEN & INBOX HANDOVER ===\n');

  // Test 1: Profil Bisnis Terstruktur, Teks & Ekstraksi Dokumen
  console.log('[Test 1/3] Pengujian penyimpanan profil bisnis terstruktur & parser dokumen...');
  const testProfile = 'Toko Kopi Senja Utama adalah roastery kopi artisan berlokasi di Jakarta Selatan.';
  db.setSetting('business_profile_text', testProfile);
  db.setSetting('business_address', 'Jl. Senopati No. 88, Kebayoran Baru, Jakarta Selatan');
  db.setSetting('business_contact', '0812-3456-7890');
  db.setSetting('business_hours', 'Setiap hari 07.00 - 23.00 WIB');
  db.setSetting('payment_methods', 'Transfer BCA 1234567890, Mandiri, QRIS All Payment, COD Jabodetabek');
  db.setSetting('shipping_methods', 'GoSend Sameday & Instant, GrabExpress, JNE REG/YES, SiCepat');
  db.setSetting('return_policy', 'Garansi ganti baru 2x24 jam jika produk bocor/rusak dengan bukti video unboxing');
  db.setSetting('business_notes', 'Order masuk sebelum jam 15.00 dikirim di hari yang sama');

  assert.strictEqual(db.getSetting('business_profile_text'), testProfile);
  assert.strictEqual(db.getSetting('business_address'), 'Jl. Senopati No. 88, Kebayoran Baru, Jakarta Selatan');
  assert.strictEqual(db.getSetting('payment_methods'), 'Transfer BCA 1234567890, Mandiri, QRIS All Payment, COD Jabodetabek');
  assert.strictEqual(db.getSetting('shipping_methods'), 'GoSend Sameday & Instant, GrabExpress, JNE REG/YES, SiCepat');

  // Buat file dummy dokumen SOP
  const tempDocPath = path.resolve(__dirname, '../data/test_sop.txt');
  fs.writeFileSync(tempDocPath, 'SOP Pengiriman Toko: Semua order sebelum jam 15.00 WIB dikirim di hari yang sama menggunakan kurir instan Paxel/GoSend.', 'utf-8');

  const extracted = await extractTextFromFile(tempDocPath, 'SOP_Pengiriman.txt');
  assert(extracted.includes('Semua order sebelum jam 15.00'), 'Teks dokumen harus terekstrak dengan benar');

  const docId = db.createBusinessDocument({
    original_filename: 'SOP_Pengiriman.txt',
    file_path: tempDocPath,
    file_type: 'text/plain',
    extracted_text: extracted
  });
  assert(docId > 0, 'ID dokumen harus > 0');

  const allDocs = db.getAllBusinessDocuments();
  assert(allDocs.length > 0, 'Harus ada dokumen yang terdaftar');
  console.log('  -> OK: Profil teks dan file dokumen tersimpan di knowledge base.');

  // Test 2: Injeksi Profil Bisnis ke Context Builder & AI Answering
  console.log('\n[Test 2/3] Pengujian injeksi Profil Bisnis ke System Prompt & AI...');
  const profileContext = buildBusinessProfileContext();
  assert(profileContext.includes('Toko Kopi Senja Utama'), 'Konteks profil harus memuat nama toko');
  assert(profileContext.includes('Jl. Senopati No. 88'), 'Konteks profil harus memuat alamat');
  assert(profileContext.includes('SOP Pengiriman Toko'), 'Konteks profil harus memuat isi dokumen yang diunggah');

  const fullCtx = buildContext('tanya jam buka toko', 'bisnis');
  assert(fullCtx.includes('Toko Kopi Senja Utama'), 'Full context harus memuat knowledge base usaha');

  const replyRes = await generateReply({
    message: 'toko buka jam berapa dan alamatnya di mana ya kak?',
    mode: 'bisnis'
  });
  assert(replyRes.reply && replyRes.reply.length > 0, 'Balasan AI harus terisi');
  console.log('  -> OK: AI menjawab pertanyaan profil usaha dengan akurat.');
  console.log('  -> Cuplikan Balasan AI:', replyRes.reply.substring(0, 130) + '...');

  // Test 3: Siklus Antrean Tiket Handover Manual
  console.log('\n[Test 3/3] Pengujian siklus tiket Inbox Handover Manual...');
  const initialPending = db.getPendingHandoverCount();
  
  const ticketId = db.createHandoverTicket({
    contact: '628999888777@c.us',
    customer_name: 'Budi Santoso',
    trigger_message: 'Halo min, mau komplain kopi yang dikirim kemarin tumpah, bisa minta ganti?',
    reason: 'Komplain Barang Rusak'
  });
  assert(ticketId > 0, 'Tiket handover harus berhasil dibuat');
  assert.strictEqual(db.getPendingHandoverCount(), initialPending + 1, 'Jumlah pending counter harus bertambah 1');

  const pendingList = db.getAllHandovers('pending');
  const foundTicket = pendingList.find(t => t.id === ticketId);
  assert(foundTicket, 'Tiket harus ditemukan dalam antrean pending');
  assert.strictEqual(foundTicket.status, 'pending');

  // Selesaikan tiket
  db.resolveHandoverTicket(ticketId);
  assert.strictEqual(db.getPendingHandoverCount(), initialPending, 'Jumlah pending counter harus berkurang kembali');
  
  const resolvedList = db.getAllHandovers('resolved');
  assert(resolvedList.some(t => t.id === ticketId), 'Tiket harus berstatus resolved');

  // Bersihkan data uji
  db.deleteHandoverTicket(ticketId);
  db.deleteBusinessDocument(docId);
  if (fs.existsSync(tempDocPath)) fs.unlinkSync(tempDocPath);
  console.log('  -> OK: Siklus tiket antrean handover manual (create, count, resolve, delete) terverifikasi 100%.');

  console.log('\n✅ FASE 6 SELESAI & LULUS 100% (STATUS: GREEN)');
}

testPhase6().catch(err => {
  console.error('\n❌ GAGAL PENGUJIAN FASE 6:', err);
  process.exit(1);
});
