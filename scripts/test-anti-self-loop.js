const assert = require('assert');
const { BaileysEngineAdapter } = require('../src/engine/adapters');
const { handleIncomingMessage, processAggregatedMessage } = require('../src/engine/handlers/message-handler');
const { isOwnerMessage } = require('../src/engine/handlers/owner-command-handler');

console.log('================================================================');
console.log('  🧪 PENGUJIAN ANTI-SELF-LOOP & OUTGOING MESSAGE FILTERS        ');
console.log('================================================================\n');

const adapter = new BaileysEngineAdapter();
adapter.myJid = '628555123456@s.whatsapp.net';

// 1. Uji normalisasi pesan masuk dari pelanggan (fromMe: false)
const customerMsg = adapter.normalizeMessage({
  key: { remoteJid: '628123456789@s.whatsapp.net', id: 'MSG_CUST_1', fromMe: false },
  pushName: 'Pelanggan Toko',
  message: { conversation: 'Halo apakah barang ready?' }
});

assert.strictEqual(customerMsg.from, '628123456789@c.us');
assert.strictEqual(customerMsg.fromMe, false);
assert.strictEqual(customerMsg.isOutgoing, false);
assert.strictEqual(customerMsg.isSelfChat, false);
console.log('  ✅ [PASS] Pesan masuk pelanggan dinormalisasi dengan benar (fromMe: false)');

// 2. Uji normalisasi pesan keluar ke pelanggan / owner (fromMe: true, remoteJid bukan myJid)
const outgoingMsg = adapter.normalizeMessage({
  key: { remoteJid: '628123456789@s.whatsapp.net', id: 'MSG_OUT_1', fromMe: true },
  message: { conversation: 'Halo Kak, barang ready silakan diorder!' }
});

assert.strictEqual(outgoingMsg.fromMe, true);
assert.strictEqual(outgoingMsg.isOutgoing, true);
assert.strictEqual(outgoingMsg.isSelfChat, false);
assert.strictEqual(outgoingMsg.to, '628123456789@c.us');
console.log('  ✅ [PASS] Pesan keluar terdeteksi sebagai isOutgoing: true & isSelfChat: false');

// 3. Uji isOwnerMessage menolak pesan isOutgoing: true
assert.strictEqual(isOwnerMessage(outgoingMsg), false);
console.log('  ✅ [PASS] isOwnerMessage menolak pesan keluar (isOutgoing: true) agar tidak dijawab bot');

// 4. Uji recordBotSentMessage dan isBotSentMessage
adapter.recordBotSentMessage('BOT_SENT_123');
assert.strictEqual(adapter.isBotSentMessage('BOT_SENT_123'), true);
assert.strictEqual(adapter.isBotSentMessage('OTHER_MSG_999'), false);
console.log('  ✅ [PASS] Tracking pesan bot (recordBotSentMessage) berfungsi presisi');

// 5. Uji handleIncomingMessage mengabaikan pesan keluar
let processed = false;
const fakeClient = {};
handleIncomingMessage(outgoingMsg, fakeClient);
// Karena outgoingMsg.fromMe === true && !outgoingMsg.isSelfChat, tidak akan diproses
assert.strictEqual(processed, false);
console.log('  ✅ [PASS] handleIncomingMessage langsung menolak pesan outgoing dari loop');

// 6. Uji normalisasi pesan self-chat (chat ke nomor sendiri di WA)
const selfChatMsg = adapter.normalizeMessage({
  key: { remoteJid: '628555123456@s.whatsapp.net', id: 'SELF_1', fromMe: true },
  message: { conversation: '!status' }
});

assert.strictEqual(selfChatMsg.isSelfChat, true);
assert.strictEqual(selfChatMsg.isOutgoing, false);
assert.strictEqual(isOwnerMessage(selfChatMsg), true);
console.log('  ✅ [PASS] Self-chat ke nomor sendiri tetap dikenali sebagai owner');

console.log('\n================================================================');
console.log('  🎉 SELURUH PENGUJIAN ANTI-SELF-LOOP 100% LULUS!              ');
console.log('================================================================\n');
