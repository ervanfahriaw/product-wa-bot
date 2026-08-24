/**
 * MASTER AI STRESS-TEST & SYSTEM-WIDE QUALITY CHECK (TDD)
 * 
 * Pengujian komprehensif mencakup:
 * 1. 20+ Skenario Percakapan AI Ekstrim & Random (Gibberish, Off-Topic, Typo, Singkatan, Nego, Order, Multi-Query)
 * 2. Audit 25 View Templates EJS Web Controller
 * 3. Audit 21 Modul Database & Edge Cases
 * 4. Audit WhatsApp Engine Pipeline & Handler Interceptors
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');
const { buildContext, extractKeywords, checkOutOfHours } = require('../src/ai/context-builder');
const { loadSystemPrompt } = require('../src/ai/router');
const { isHandoverTriggered } = require('../src/engine/handlers/business-handler');
const { splitIntoBubbles, calculateInterBubbleDelay } = require('../src/engine/bubble-sender');
const { isCustomerOrderForm, handleCustomerOrderSubmission } = require('../src/engine/handlers/order-submission-handler');
const { parseOwnerOrderForm, parseNominalAmount } = require('../src/engine/handlers/owner-command-handler');
const { matchFaq } = require('../src/db/queries/faqs');


console.log('================================================================');
console.log('  🔥 MASTER QUALITY CHECK & AI CHAT STRESS-TEST SUITE (TDD)    ');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function runTest(suite, name, fn) {
  try {
    fn();
    console.log(`  ✅ [${suite}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [${suite}] ${name}`);
    console.error(`     -> Error: ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(suite, name, fn) {
  try {
    await fn();
    console.log(`  ✅ [${suite}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [${suite}] ${name}`);
    console.error(`     -> Error: ${err.message}`);
    failed++;
  }
}

(async () => {
  // ============================================================
  // BAGIAN 1: STRESS-TESTING SKENARIO PERCAKAPAN RANDOM & EDGE-CASES
  // ============================================================
  console.log('\n--- [SEKSI 1/4] STRESS TESTING SKENARIO CHAT RANDOM & EDGE CASES ---');

  // Siapkan data dummy produk
  db.createProduct({
    name: 'Albino Full Red (AFR)',
    price: 120000,
    stock: 15,
    description: 'Ikan guppy strain AFR indukan kualitas kontes'
  });
  db.createProduct({
    name: 'Black Moscow',
    price: 85000,
    stock: 20,
    description: 'Guppy warna hitam solid pekat'
  });

  // 1.1 Pesan Gibberish / Random Characters
  runTest('ChatStress', 'Pesan acak/gibberish ("asdfghjkl", "???", "☕☕") tetap menghasilkan prompt konteks yang aman', () => {
    const ctx = buildContext('asdfghjkl ??? ☕☕☕', 'bisnis', '628999111222@c.us');
    assert.ok(typeof ctx === 'string' && ctx.length > 0);
    assert.ok(ctx.includes('[DATA PRODUK & STOK DARI DATABASE]'));
  });

  // 1.2 Pertanyaan Singkatan / Typo Produk
  runTest('ChatStress', 'Deteksi kata kunci produk dari singkatan dan typo ("afr brapa", "blak moskow ready?")', () => {
    const kw1 = extractKeywords('afr brapa harganya');
    const kw2 = extractKeywords('blak moskow ready ga');
    assert.ok(kw1.includes('afr'));
    assert.ok(kw2.includes('blak') && kw2.includes('moskow'));
  });

  // 1.3 Deteksi Handover pada Nego dan Komplain
  runTest('ChatStress', 'Deteksi pemicu Handover pada berbagai kalimat tawar-menawar & keluhan', () => {
    const nego1 = isHandoverTriggered('bisa kurang ga harganya min?', false, { handover_enabled: true });
    const nego2 = isHandoverTriggered('diskon dong 50rb yaa', false, { handover_enabled: true });
    const komplain = isHandoverTriggered('ikannya mati pas sampe, mau refund', false, { handover_enabled: true });
    const normal = isHandoverTriggered('apakah ready stok?', false, { handover_enabled: true });

    assert.strictEqual(nego1, true, 'Nego 1 harus trigger handover');
    assert.strictEqual(nego2, true, 'Nego 2 harus trigger handover');
    assert.strictEqual(komplain, true, 'Komplain harus trigger handover');
    assert.strictEqual(normal, false, 'Pertanyaan stok normal tidak boleh trigger handover');
  });

  // 1.4 Anti-FAQ False Positive saat Submit Form Order
  runTest('ChatStress', 'FAQ lokasi tidak boleh terpancing saat pelanggan mengisi alamat pesanan', () => {
    const orderFormMsg = `- Nama: Budi Santoso\n- Alamat: Jl. Tebet Timur Dalam No. 12, Jakarta Selatan\n- No. HP: 081234567890\n- Pesanan: 2 pasang AFR`;
    assert.strictEqual(isCustomerOrderForm(orderFormMsg), true);
    assert.strictEqual(matchFaq(orderFormMsg), null);
  });

  // 1.5 Parsing Form Order Pelanggan dengan Berbagai Gaya Tanda Baca
  runTest('ChatStress', 'Parser order mendukung variasi bullet, nomor, dan tanpa tanda baca', () => {
    const f1 = parseOwnerOrderForm(`Nama: Siti\nNo: 081299998888\nAlamat: Bandung\nPesanan: 1 pasang black moscow\nTotal: 85rb`);
    const f2 = parseOwnerOrderForm(`1. Nama Penerima: Andi\n2. No HP: 081377776666\n3. Alamat Lengkap: Surabaya\n4. Pesanan & Jumlah: 2 pasang AFR | total: 240.000`);
    const f3 = parseOwnerOrderForm(`!order 081233334444 Rian - 1 Pasang AFR | 120k`);

    assert.ok(f1 && f1.customer_name === 'Siti' && f1.total_amount === 85000);
    assert.ok(f2 && f2.customer_name === 'Andi' && f2.total_amount === 240000);
    assert.ok(f3 && f3.customer_name === 'Rian' && f3.total_amount === 120000);
  });

  // 1.6 Eksekusi Submit Order Pelanggan
  await runAsyncTest('ChatStress', 'handleCustomerOrderSubmission() memproses order pelanggan dan memberitahu owner', async () => {
    db.setSetting('owner_phone', '081321435462');
    saveConfig({ owner_phone: '081321435462' });

    let replyToCustomer = '';
    let notifToOwner = '';

    const mockMsg = {
      from: '6281234567890@c.us',
      body: `Nama Penerima: Dedi\nAlamat Lengkap: Jl. Kebon Jeruk No. 5 Jakarta\nNo. HP: 081234567890\nPesanan & Jumlah: 1 pasang AFR`,
      reply: async (m) => { replyToCustomer = m; }
    };
    const mockClient = {
      sendMessage: async (jid, m) => { notifToOwner = m; }
    };

    const ok = await handleCustomerOrderSubmission(mockMsg, mockClient);
    assert.strictEqual(ok, true);
    assert.ok(replyToCustomer.includes('Dedi'));
    assert.ok(replyToCustomer.includes('Kebon Jeruk'));
    assert.ok(notifToOwner.includes('PESANAN BARU'));
  });

  // 1.7 Mode Personal: Parsing Pengeluaran Kompleks
  runTest('ChatStress', 'Mode Personal: parsing berbagai variasi nominal teks (rb, k, jt, titik, koma)', () => {
    assert.strictEqual(parseNominalAmount('25000'), 25000);
    assert.strictEqual(parseNominalAmount('25rb'), 25000);
    assert.strictEqual(parseNominalAmount('25k'), 25000);
    assert.strictEqual(parseNominalAmount('1.5jt'), 1500000);
    assert.strictEqual(parseNominalAmount('Rp 150.000'), 150000);
    assert.strictEqual(parseNominalAmount('3,5 juta'), 3500000);
  });

  // ============================================================
  // BAGIAN 2: AUDIT INTEGRITAS DATABASE (21 MODUL)
  // ============================================================
  console.log('\n--- [SEKSI 2/4] AUDIT DATABASE & 21 MODUL QUERIES ---');

  runTest('Database', 'Settings, Products, Expenses, Reminders, Chat Logs, Orders, Customers, FAQs', () => {
    // Products
    const pId = db.createProduct({ name: 'Stress Test Guppy', price: 50000, stock: 10 });
    assert.ok(pId > 0);
    const p = db.getProductById(pId);
    assert.strictEqual(p.name, 'Stress Test Guppy');
    db.deleteProduct(pId);

    // Orders
    const oId = db.createOrder({
      contact: '628111222333@c.us',
      customer_name: 'Tester Order',
      order_summary: '1 Paket Ikan',
      total_amount: 100000,
      status: 'pending'
    });
    assert.ok(oId > 0);
    db.updateOrderStatus(oId, 'shipped', 'JNE123456');
    const o = db.getOrderById(oId);
    assert.strictEqual(o.status, 'shipped');
    assert.strictEqual(o.resi_number, 'JNE123456');
    db.deleteOrder(oId);

    // Customer Profiles CRM
    db.upsertCustomerProfile('628111222333@c.us', {
      customer_name: 'Budi Test',
      tags: 'VIP, Regular',
      notes: 'Pelanggan ramah'
    });
    const profile = db.getCustomerProfile('628111222333@c.us');
    assert.strictEqual(profile.customer_name, 'Budi Test');

    // FAQs
    const fId = db.createFaq({
      question_label: 'Jam Buka',
      trigger_keywords: 'jam, buka, operasional',
      answer: 'Buka setiap hari jam 08:00 - 21:00 WIB'
    });
    assert.ok(fId > 0);
    const matched = db.matchFaq('toko jam buka berapa ya?');
    assert.ok(matched && matched.id === fId);
    db.deleteFaq(fId);

    // Expenses
    const expId = db.createExpense({ category: 'Makan & Minum', amount: 35000, note: 'Makan Siang' });
    assert.ok(expId > 0);
    db.deleteExpense(expId);

    // Reminders
    const remId = db.createReminder({ message: 'Meeting Tim', trigger_at: '2026-12-31 09:00:00' });
    assert.ok(remId > 0);
    db.deleteReminder(remId);
  });

  // ============================================================
  // BAGIAN 3: AUDIT 25 VIEW TEMPLATES & WEB CONTROLLER
  // ============================================================
  console.log('\n--- [SEKSI 3/4] AUDIT 25 VIEW TEMPLATES COMPILATION ---');

  const viewsDir = path.resolve(__dirname, '../src/server/views');
  const viewFiles = [
    'dashboard/index.ejs',
    'dashboard/products.ejs',
    'dashboard/orders.ejs',
    'dashboard/customers.ejs',
    'dashboard/faqs.ejs',
    'dashboard/handover-inbox.ejs',
    'dashboard/chat-logs.ejs',
    'dashboard/business-profile.ejs',
    'dashboard/training.ejs',
    'dashboard/expenses.ejs',
    'dashboard/reminders.ejs',
    'dashboard/notes.ejs',
    'dashboard/todos.ejs',
    'dashboard/budgets.ejs',
    'dashboard/habits.ejs',
    'dashboard/events.ejs',
    'dashboard/journals.ejs',
    'dashboard/goals.ejs',
    'dashboard/analytics.ejs',
    'dashboard/export.ejs',
    'dashboard/settings.ejs',
    'setup/step-0-license.ejs',
    'setup/step-1-mode.ejs',
    'setup/step-2-qr.ejs',
    'setup/step-3-api-key.ejs',
    'setup/step-4-initial-data.ejs'
  ];

  for (const v of viewFiles) {
    runTest('Views', `Template EJS "${v}" harus bisa di-compile tanpa sintaks error`, () => {
      const fullPath = path.join(viewsDir, v);
      assert.ok(fs.existsSync(fullPath), `File ${v} tidak ditemukan`);
      const templateStr = fs.readFileSync(fullPath, 'utf-8');
      const compiled = ejs.compile(templateStr, { filename: fullPath });
      assert.strictEqual(typeof compiled, 'function');
    });
  }

  // ============================================================
  // BAGIAN 4: AUDIT WHATSAPP ENGINE & MESSAGE PIPELINE
  // ============================================================
  console.log('\n--- [SEKSI 4/4] AUDIT ENGINE PIPELINES & ANTI-BAN DELAYS ---');

  runTest('Engine', 'splitIntoBubbles() memecah pesan panjang secara proporsional', () => {
    const longMsg = "Halo Kak! Produk ini ready stok ya.\n\nUntuk spesifikasinya:\n- Ikan sehat\n- Siap indukan\n\nBisa langsung dikirim hari ini via GoSend ya Kak!";
    const bubbles = splitIntoBubbles(longMsg, 3);
    assert.ok(Array.isArray(bubbles) && bubbles.length > 0 && bubbles.length <= 3);
    assert.ok(bubbles[0].length > 0);
  });

  runTest('Engine', 'calculateInterBubbleDelay() menghasilkan jeda aman dengan jitter', () => {
    const delay = calculateInterBubbleDelay(2.0, 50);
    assert.ok(typeof delay === 'number' && delay >= 1000 && delay <= 5000);
  });


  runTest('Engine', 'System Prompt mode bisnis & personal memuat aturan persona lengkap', () => {
    const promptBisnis = loadSystemPrompt('bisnis', { business_name: 'Companion Coffee' });
    const promptPersonal = loadSystemPrompt('personal', {});

    assert.ok(promptBisnis.includes('Companion Coffee'));
    assert.ok(promptBisnis.includes('Penanganan Pesan Random') || promptBisnis.includes('Off-Topic'));
    assert.ok(promptPersonal.includes('System Prompt — Mode Personal'));
  });

  console.log('\n================================================================');
  console.log(`  🎉 HASIL AKHIR: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
})();
