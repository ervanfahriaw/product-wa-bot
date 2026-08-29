const assert = require('assert');
const db = require('../src/db');
const { 
  formatCustomerDisplay, 
  resolveCustomerInfo, 
  findContactByQuery 
} = require('../src/utils/contact-resolver');
const { 
  parseOwnerCommand, 
  handleOwnerCommand, 
  isOwnerMessage,
  registerOwnerLid 
} = require('../src/engine/handlers/owner-command-handler');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Memulai Pengujian LID Translation, Human Display & Admin Control');
  console.log('================================================================\n');

  const LID_JID = '69767515898014@lid';
  const REAL_PHONE = '08892114763';
  const CUSTOMER_NAME = 'Arsyila Ascii';

  // 1. Uji formatCustomerDisplay (Menghilangkan tampilan raw LID)
  console.log('1️⃣ Menguji formatCustomerDisplay untuk berbagai skenario...');
  
  // Kasus A: Nama dan Nomor HP lengkap
  const displayA = formatCustomerDisplay(LID_JID, { customerName: CUSTOMER_NAME, phoneNumber: REAL_PHONE });
  assert.strictEqual(displayA, 'Arsyila Ascii (0889-211-4763)', 'Harus memformat Nama + Nomor cantik');
  console.log(`   ✅ Kasus A (Nama + No HP): "${displayA}"`);

  // Kasus B: Hanya Nama (nomor belum diketahui)
  const displayB = formatCustomerDisplay(LID_JID, { customerName: CUSTOMER_NAME });
  assert.strictEqual(displayB, 'Arsyila Ascii', 'Harus menampilkan Nama saja tanpa raw LID');
  console.log(`   ✅ Kasus B (Hanya Nama): "${displayB}"`);

  // Kasus C: Raw LID tanpa nama & nomor
  const displayC = formatCustomerDisplay(LID_JID, {});
  assert.strictEqual(displayC, 'Pelanggan WA (#8014)', 'Harus menampilkan Pelanggan WA (#8014) bukan 69767515898014@lid');
  console.log(`   ✅ Kasus C (LID Anonim): "${displayC}"`);

  // Kasus D: Nomor biasa @c.us
  const displayD = formatCustomerDisplay('628892114763@c.us', {});
  assert.strictEqual(displayD, '0889-211-4763', 'Nomor biasa harus diformat cantik');
  console.log(`   ✅ Kasus D (Nomor Biasa): "${displayD}"\n`);

  // 2. Uji resolveCustomerInfo dengan Mock Message Pushname
  console.log('2️⃣ Menguji resolveCustomerInfo dengan Pushname dari WhatsApp...');
  const mockCustomerMessage = {
    from: LID_JID,
    body: 'liat foto yg sate maranggi',
    _data: {
      notifyName: 'Arsyila Ascii'
    },
    getContact: async () => ({
      number: '628892114763',
      pushname: 'Arsyila Ascii'
    })
  };

  const resolved = await resolveCustomerInfo(mockCustomerMessage, LID_JID);
  assert.strictEqual(resolved.customerName, 'Arsyila Ascii');
  assert.strictEqual(resolved.phoneNumber, '628892114763');
  assert.strictEqual(resolved.formattedDisplay, 'Arsyila Ascii (0889-211-4763)');
  console.log(`   ✅ Identitas berhasil diekstrak dan disimpan: "${resolved.formattedDisplay}"\n`);

  // 3. Uji findContactByQuery (Pencarian JID berdasarkan nama pelanggan atau nomor)
  console.log('3️⃣ Menguji findContactByQuery berdasarkan Nama dan Nomor...');
  const foundByName = findContactByQuery('arsyila');
  assert.strictEqual(foundByName, LID_JID, 'Pencarian nama "arsyila" harus menemukan JID LID');
  console.log(`   ✅ findContactByQuery("arsyila") -> ${foundByName}`);

  const foundByPhone = findContactByQuery('08892114763');
  assert.strictEqual(foundByPhone, LID_JID, 'Pencarian nomor "08892114763" harus menemukan JID LID terpetakan');
  console.log(`   ✅ findContactByQuery("08892114763") -> ${foundByPhone}\n`);

  // 4. Uji Parse & Eksekusi Perintah Admin Unpause
  console.log('4️⃣ Menguji Kemudahan Perintah WhatsApp Admin (Zero-Hassle Unpause)...');
  
  // Pause kontak pelanggan
  db.pauseContact(LID_JID, 2, 'Pengujian Handover');
  assert.strictEqual(db.isContactPaused(LID_JID), true, 'Kontak harus dalam status paused');

  // Test 4a: Admin unpause dengan nama pelanggan: "!aktifkan arsyila"
  let replyReceived = '';
  const mockReplyMessageA = {
    from: '08892114763@c.us',
    body: '!aktifkan arsyila',
    reply: async (text) => { replyReceived = text; }
  };

  const parsedA = parseOwnerCommand('!aktifkan arsyila');
  assert.strictEqual(parsedA.action, 'unpause');
  assert.strictEqual(parsedA.targetQuery, 'arsyila');

  await handleOwnerCommand(mockReplyMessageA);
  assert.strictEqual(db.isContactPaused(LID_JID), false, 'Kontak harus sudah unpaused');
  assert.ok(replyReceived.includes('Arsyila Ascii'), 'Balasan harus menyebut nama pelanggan yang ramah');
  console.log(`   ✅ Perintah "!aktifkan arsyila" berhasil: ${replyReceived.split('\n')[0]}`);

  // Test 4b: Admin unpause tanpa parameter: "!selesai"
  db.pauseContact(LID_JID, 2, 'Pengujian Handover 2');
  assert.strictEqual(db.isContactPaused(LID_JID), true);

  const mockReplyMessageB = {
    from: '08892114763@c.us',
    body: '!selesai',
    reply: async (text) => { replyReceived = text; }
  };

  const parsedB = parseOwnerCommand('!selesai');
  assert.strictEqual(parsedB.action, 'unpause_single');

  await handleOwnerCommand(mockReplyMessageB);
  assert.strictEqual(db.isContactPaused(LID_JID), false, 'Kontak harus unpaused via !selesai');
  console.log(`   ✅ Perintah "!selesai" (tanpa parameter) berhasil unpause: ${replyReceived.split('\n')[0]}`);

  console.log('\n================================================================');
  console.log('🎉 SEMUA PENGUJIAN LID TRANSLATION & HUMAN DISPLAY BERHASIL (100%)!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('❌ Pengujian Gagal:', err);
  process.exit(1);
});
