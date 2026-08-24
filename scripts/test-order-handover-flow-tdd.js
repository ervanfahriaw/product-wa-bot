/**
 * TDD Test Suite: Standalone Form Bubble Splitting & Order-Handover Flow
 * 
 * Menguji:
 * 1. `splitIntoBubbles()` memisahkan template format pengiriman ke dalam 1 bubble mandiri (bersih untuk dicopy)
 * 2. `handleCustomerOrderSubmission()` mem-parsing form yang tercampur teks sebelumnya ("Siap Kak! Untuk 2 cup Iced Premium Matcha Latte totalnya jadi Rp40.000...")
 * 3. Pembuatan tiket di Handover Inbox (`manual_handovers`) dan pencatatan di dashboard `orders`
 * 4. Pengiriman notifikasi ke WhatsApp Owner dan konfirmasi ke Pelanggan
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');
const { splitIntoBubbles } = require('../src/engine/bubble-sender');
const { isCustomerOrderForm, handleCustomerOrderSubmission } = require('../src/engine/handlers/order-submission-handler');
const { parseOwnerOrderForm } = require('../src/engine/handlers/owner-command-handler');

console.log('======================================================');
console.log('  TDD TEST: BUBBLE SPLITTING & ORDER-HANDOVER FLOW    ');
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
  // GRUP 1: Standalone Bubble Splitting untuk Format Form
  // ============================================================
  console.log('[1/3] Testing Isolasi Gelembung Form Pengiriman (Bubble Splitting)...');

  test('splitIntoBubbles() — harus memisahkan template form ke dalam 1 gelembung mandiri', () => {
    const rawBotReply = "Siap Kak! Untuk 2 cup Iced Premium Matcha Latte totalnya jadi Rp40.000 (belum termasuk ongkir ya).\n\nBoleh kirim format pesanannya sekalian biar mimin bantu cek ongkirnya:\n\n- Nama Penerima:\n- Alamat Lengkap:\n- No. HP:";
    const bubbles = splitIntoBubbles(rawBotReply, 3);

    assert.strictEqual(bubbles.length, 2, 'Harus dipecah menjadi 2 gelembung chat');
    assert.ok(bubbles[0].includes('Untuk 2 cup Iced Premium Matcha Latte'), 'Bubble 1 berisi teks percakapan');
    assert.ok(!bubbles[0].includes('- Nama Penerima:'), 'Bubble 1 TIDAK boleh tercampur format form');
    
    assert.ok(bubbles[1].includes('- Nama Penerima:'), 'Bubble 2 berisi format bersih');
    assert.ok(bubbles[1].includes('- Alamat Lengkap:'), 'Bubble 2 berisi alamat');
    assert.ok(bubbles[1].includes('- No. HP:'), 'Bubble 2 berisi no hp');
    assert.ok(!bubbles[1].includes('Siap Kak!'), 'Bubble 2 TIDAK boleh memuat teks pengantar');
  });

  // ============================================================
  // GRUP 2: Parsing Form Pelanggan yang Tercampur Teks Obrolan
  // ============================================================
  console.log('\n[2/3] Testing Parsing Form Campuran Obrolan & Ekstraksi Produk...');

  const mixedCustomerInput = "Siap Kak! Untuk 2 cup Iced Premium Matcha Latte totalnya jadi Rp40.000 (belum termasuk ongkir ya).\n\nBoleh kirim format pesanannya sekalian biar mimin bantu cek ongkirnya:\n- Nama Penerima: jono\n- Alamat Lengkap: jakrta pusat\n- No. HP: 081214541004";

  test('isCustomerOrderForm() — harus mendeteksi form yang tercampur teks obrolan', () => {
    assert.strictEqual(isCustomerOrderForm(mixedCustomerInput), true);
  });

  test('parseOwnerOrderForm() — harus mengekstrak nama, alamat, no hp, serta mendeteksi produk & nominal', () => {
    const parsed = parseOwnerOrderForm(mixedCustomerInput);
    assert.ok(parsed, 'Form harus berhasil di-parse');
    assert.strictEqual(parsed.customer_name, 'jono');
    assert.ok(parsed.notes.includes('jakrta pusat'));
    assert.ok(parsed.contact.includes('6281214541004'));
    assert.ok(parsed.order_summary.includes('Matcha Latte') || parsed.order_summary.includes('2 cup'), `Harus mengekstrak nama produk, dapat: ${parsed.order_summary}`);
    assert.strictEqual(parsed.total_amount, 40000, `Harus mengekstrak nominal 40000, dapat: ${parsed.total_amount}`);
  });

  // ============================================================
  // GRUP 3: Integrasi Order Dashboard & Handover Inbox
  // ============================================================
  console.log('\n[3/3] Testing Eksekusi Submit Order & Tiket Handover Inbox...');

  await asyncTest('handleCustomerOrderSubmission() — mencatat ke orders table dan membuat tiket di Handover Inbox', async () => {
    db.setSetting('owner_phone', '081321435462');
    saveConfig({ owner_phone: '081321435462' });

    let replyToCustomer = '';
    let notifToOwner = '';

    const mockMessage = {
      from: '6281214541004@c.us',
      body: mixedCustomerInput,
      reply: async (msg) => { replyToCustomer = msg; }
    };

    const mockClient = {
      sendMessage: async (jid, msg) => { notifToOwner = msg; }
    };

    const handled = await handleCustomerOrderSubmission(mockMessage, mockClient);
    assert.strictEqual(handled, true, 'Order harus berhasil diproses');

    // 1. Cek balasan ke pelanggan
    assert.ok(replyToCustomer.includes('jono'), 'Balasan harus menyebut nama jono');
    assert.ok(replyToCustomer.includes('jakrta pusat'), 'Balasan harus menyebut alamat');
    assert.ok(replyToCustomer.includes('ongkos kirim') || replyToCustomer.includes('ongkir'), 'Balasan harus menyebutkan cek ongkir');

    // 2. Cek database orders
    const orders = db.getOrdersByContact('6281214541004@c.us');
    assert.ok(orders.length > 0, 'Harus ada order di tabel orders');
    const lastOrder = orders[0];
    assert.strictEqual(lastOrder.customer_name, 'jono');
    assert.strictEqual(lastOrder.status, 'pending');

    // 3. Cek Handover Inbox
    if (db.getAllHandoverTickets) {
      const tickets = db.getAllHandoverTickets();
      const userTicket = tickets.find(t => t.contact === '6281214541004@c.us');
      assert.ok(userTicket, 'Harus ada tiket di Handover Inbox untuk kontak ini');
    }

    // 4. Cek notifikasi ke Owner
    assert.ok(notifToOwner.includes('PESANAN BARU') || notifToOwner.includes('HANDOVER'), 'Owner harus menerima notifikasi');
    assert.ok(notifToOwner.includes('jono'), 'Notifikasi owner harus menyebut nama pemesan');
  });

  console.log('\n======================================================');
  console.log(`HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
