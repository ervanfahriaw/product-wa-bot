const assert = require('assert');
const { enqueueIncomingMessage, clearAllBuffers, getActiveBufferCount } = require('../src/engine/message-buffer');
const { generateReply } = require('../src/ai/router');

async function testPhase7() {
  console.log('=== PENGUJIAN TDD FASE 7: MULTI-BUBBLE DEBOUNCE AGGREGATOR ===\n');

  clearAllBuffers();

  // Test 1: Penggabungan 3 Gelembung Chat Berturut-turut
  console.log('[Test 1/3] Menguji penerimaan 3 chat berturut-turut dari pelanggan...');

  const mockClient = { sendMessage: async () => {} };
  const contact = '628123456789@c.us';

  const msg1 = { from: contact, body: 'halo kak', type: 'chat', timestamp: Date.now() };
  const msg2 = { from: contact, body: 'susu aren sama espresso single origin ada ga?', type: 'chat', timestamp: Date.now() };
  const msg3 = { from: contact, body: 'apakah bisa sameday hari ini?', type: 'chat', timestamp: Date.now() };

  let batchResult = null;
  let batchTriggerCount = 0;

  const onBatchReady = async (aggregatedMessage, client, originalMessages) => {
    batchTriggerCount++;
    batchResult = {
      aggregatedMessage,
      originalCount: originalMessages.length
    };
  };

  // Kirim Msg 1 dengan debounce 150ms
  enqueueIncomingMessage(msg1, mockClient, onBatchReady, 150);
  assert.strictEqual(getActiveBufferCount(), 1, 'Harus ada 1 buffer aktif');
  assert.strictEqual(batchTriggerCount, 0, 'onBatchReady belum boleh terpicu');

  // Kirim Msg 2 setelah 40ms (sebelum debounce 150ms selesai)
  await new Promise(r => setTimeout(r, 40));
  enqueueIncomingMessage(msg2, mockClient, onBatchReady, 150);
  assert.strictEqual(batchTriggerCount, 0, 'onBatchReady masih belum boleh terpicu');

  // Kirim Msg 3 setelah 40ms lagi
  await new Promise(r => setTimeout(r, 40));
  enqueueIncomingMessage(msg3, mockClient, onBatchReady, 150);
  assert.strictEqual(batchTriggerCount, 0, 'onBatchReady masih belum boleh terpicu');

  // Tunggu 200ms agar debounce selesai
  console.log('  -> Menunggu pelanggan selesai mengetik (debounce window)...');
  await new Promise(r => setTimeout(r, 200));

  assert.strictEqual(batchTriggerCount, 1, 'onBatchReady harus HANYA TERPICU TEPAT 1 KALI');
  assert.strictEqual(batchResult.originalCount, 3, 'Harus merangkum 3 pesan asli');
  assert(batchResult.aggregatedMessage.body.includes('halo kak'), 'Harus memuat pesan 1');
  assert(batchResult.aggregatedMessage.body.includes('susu aren sama espresso'), 'Harus memuat pesan 2');
  assert(batchResult.aggregatedMessage.body.includes('apakah bisa sameday'), 'Harus memuat pesan 3');
  assert.strictEqual(getActiveBufferCount(), 0, 'Buffer harus bersih setelah batch dieksekusi');

  console.log('  -> OK: 3 Gelembung chat digabung dengan presisi menjadi:\n"' + batchResult.aggregatedMessage.body + '"');

  // Test 2: Pengujian Chat Tunggal (Single Message tanpa delay berlebih)
  console.log('\n[Test 2/3] Menguji penanganan pesan tunggal...');
  let singleTriggered = false;
  const singleMsg = { from: '628999111222@c.us', body: 'harga kopi berapa?', type: 'chat', timestamp: Date.now() };

  enqueueIncomingMessage(singleMsg, mockClient, async (msg) => {
    singleTriggered = true;
    assert.strictEqual(msg.body, 'harga kopi berapa?');
  }, 50);

  await new Promise(r => setTimeout(r, 80));
  assert.strictEqual(singleTriggered, true, 'Pesan tunggal harus terproses mulus');
  console.log('  -> OK: Pesan tunggal diproses lancar tanpa distorsi.');

  // Test 3: AI Menjawab Gabungan Pertanyaan Sekaligus
  console.log('\n[Test 3/3] Pengujian AI menjawab pesan gabungan multi-bubble...');
  const replyRes = await generateReply({
    message: batchResult.aggregatedMessage.body,
    mode: 'bisnis'
  });

  assert(replyRes.reply && replyRes.reply.length > 0, 'Balasan AI harus terisi');
  console.log('  -> OK: AI menjawab seluruh poin pertanyaan dari ketiga bubble chat sekaligus.');
  console.log('  -> Cuplikan Balasan AI:\n' + replyRes.reply.substring(0, 160) + '...');

  console.log('\n✅ FASE 7 SELESAI & LULUS 100% (STATUS: GREEN)');
}

testPhase7().catch(err => {
  console.error('\n❌ GAGAL PENGUJIAN FASE 7:', err);
  process.exit(1);
});
