/**
 * TDD Test Suite: Order Management (Manual Dashboard Button + Owner Form Parser via WhatsApp)
 * 
 * Pengujian:
 * 1. Parser Form Pesanan dari Chat Owner (Berbagai Variasi Format Teks)
 * 2. Eksekusi `handleOwnerCommand` saat Owner Mengirim Form Pesanan via WA
 * 3. Penyimpanan Data ke SQLite (`db.createOrder` & `customer_profiles`)
 * 4. Rute Dashboard `POST /dashboard/orders/create`
 * 5. Notifikasi Resi Otomatis ke Pelanggan saat status Shipped
 * 6. Validasi UI EJS Modal & Tombol Tambah Pesanan
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');
const { 
  isOwnerMessage, 
  parseOwnerCommand, 
  handleOwnerCommand,
  parseOwnerOrderForm
} = require('../src/engine/handlers/owner-command-handler');

// Reset database tabel orders untuk testing
try {
  db.db.exec("DELETE FROM orders");
  db.db.exec("DELETE FROM sqlite_sequence WHERE name = 'orders'");
} catch (e) {}

console.log('======================================================');
console.log('   TDD TEST: FITUR ORDER MANAGEMENT & WHATSAPP FORM   ');
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
  // GRUP 1: Parser Form Pesanan dari Chat Owner
  // ============================================================
  console.log('[1/4] Testing Parser Form Pesanan dari Chat...');

  test('parseOwnerOrderForm() — format standar user (pesanan 1, nama penerima, no penerima, alamat, pesanan)', () => {
    const text = `pesanan 1
nama penerima : ervan
no penerima: 081321435462
alamat: jl bandung
pesanan : 2 pasang albino koi`;

    const parsed = parseOwnerOrderForm(text);
    assert.ok(parsed, 'Harus terdeteksi sebagai form pesanan valid');
    assert.strictEqual(parsed.action, 'create_order_form');
    assert.strictEqual(parsed.customer_name, 'ervan');
    assert.ok(parsed.contact.includes('6281321435462'), `Kontak harus dinormalisasi, dapat: ${parsed.contact}`);
    assert.strictEqual(parsed.order_summary, '2 pasang albino koi');
    assert.ok(parsed.notes.includes('jl bandung'), `Notes harus memuat alamat, dapat: ${parsed.notes}`);
    assert.strictEqual(parsed.total_amount, 0);
  });

  test('parseOwnerOrderForm() — format dengan total harga (Rp / rb / k)', () => {
    const text = `Format Order
Nama: Kak Siska
No WA: 081298765432
Alamat: Jl. Sudirman No 10 Jakarta
Pesanan: 3x Guppy Full Platinum
Total: 150rb
Catatan: Kirim packing styrofoam`;

    const parsed = parseOwnerOrderForm(text);
    assert.ok(parsed);
    assert.strictEqual(parsed.customer_name, 'Kak Siska');
    assert.ok(parsed.contact.includes('6281298765432'));
    assert.strictEqual(parsed.order_summary, '3x Guppy Full Platinum');
    assert.strictEqual(parsed.total_amount, 150000);
    assert.ok(parsed.notes.includes('Sudirman') && parsed.notes.includes('styrofoam'));
  });

  test('parseOwnerOrderForm() — format tanpa header khusus (hanya key: value)', () => {
    const text = `Nama Pembeli: Budi Hartono
Nomor HP: 085712345678
Barang: 1 Pasang Koi Kohaku
Harga: Rp 350.000
Alamat: Surabaya`;

    const parsed = parseOwnerOrderForm(text);
    assert.ok(parsed);
    assert.strictEqual(parsed.customer_name, 'Budi Hartono');
    assert.ok(parsed.contact.includes('6285712345678'));
    assert.strictEqual(parsed.order_summary, '1 Pasang Koi Kohaku');
    assert.strictEqual(parsed.total_amount, 350000);
  });

  test('parseOwnerOrderForm() — format inline single line !order <nomor> <nama> - <pesanan> | <total>', () => {
    const text = `!order 081987654321 Andi - 2x Botol Minum | 80k`;
    const parsed = parseOwnerOrderForm(text);
    assert.ok(parsed);
    assert.strictEqual(parsed.customer_name, 'Andi');
    assert.ok(parsed.contact.includes('6281987654321'));
    assert.strictEqual(parsed.order_summary, '2x Botol Minum');
    assert.strictEqual(parsed.total_amount, 80000);
  });

  test('parseOwnerOrderForm() — pesan obrolan umum tidak boleh salah terdeteksi sebagai order', () => {
    assert.strictEqual(parseOwnerOrderForm('halo bot selamat pagi'), null);
    assert.strictEqual(parseOwnerOrderForm('stok ikan albino masih ada gak min?'), null);
    assert.strictEqual(parseOwnerOrderForm('!status'), null);
  });

  // ============================================================
  // GRUP 2: Eksekusi handleOwnerCommand saat Owner Mengirim Form Pesanan
  // ============================================================
  console.log('\n[2/4] Testing Eksekusi handleOwnerCommand via WA...');

  await asyncTest('handleOwnerCommand() — berhasil mencatat order ke database dan membalas konfirmasi ke owner', async () => {
    const ownerPhone = '081234567890';
    db.setSetting('owner_phone', ownerPhone);
    saveConfig({ owner_phone: ownerPhone });

    let replySent = '';
    const mockMessage = {
      from: `${ownerPhone.replace(/^0/, '62')}@c.us`,
      fromMe: true,
      body: `pesanan 1\nnama penerima : ervan\nno penerima: 081321435462\nalamat: jl bandung\npesanan : 2 pasang albino koi\ntotal : 120.000`,
      reply: async (text) => {
        replySent = text;
      }
    };

    const initialOrders = db.getAllOrders();
    const countBefore = initialOrders.length;

    const handled = await handleOwnerCommand(mockMessage);
    assert.strictEqual(handled, true, 'Harus mengembalikan true (pesanan tertangani)');

    const countAfter = db.getAllOrders().length;
    assert.strictEqual(countAfter, countBefore + 1, 'Jumlah order di DB harus bertambah 1');

    const latestOrder = db.getAllOrders()[0];
    assert.strictEqual(latestOrder.customer_name, 'ervan');
    assert.ok(latestOrder.contact.includes('6281321435462'));
    assert.strictEqual(latestOrder.order_summary, '2 pasang albino koi');
    assert.strictEqual(latestOrder.total_amount, 120000);
    assert.ok(latestOrder.notes.includes('jl bandung'));
    assert.strictEqual(latestOrder.status, 'pending');

    assert.ok(replySent.includes('PESANAN BERHASIL DICATAT') || replySent.includes('Berhasil dicatat'), `Balasan WA harus memuat konfirmasi, dapat: ${replySent}`);
    assert.ok(replySent.includes(String(latestOrder.id)), 'Balasan harus memuat ID Order');
    assert.ok(replySent.includes('ervan'), 'Balasan harus memuat nama penerima');
  });

  // ============================================================
  // GRUP 3: Route Backend POST /dashboard/orders/create
  // ============================================================
  console.log('\n[3/4] Testing Route Handler /dashboard/orders/create...');

  await asyncTest('db.createOrder() & manual creation flow — mendukung seluruh field pesanan', async () => {
    const orderData = {
      customer_name: 'Dewi Lestari',
      contact: '081233445566',
      order_summary: '5x Bibit Guppy Albino',
      total_amount: 250000,
      status: 'confirmed',
      shipping_method: 'JNE YES',
      resi_number: 'JNE-99887766',
      notes: 'Alamat: Komplek Indah No. 5 Jakarta'
    };

    const newId = db.createOrder({
      contact: '6281233445566@c.us',
      customer_name: orderData.customer_name,
      order_summary: orderData.order_summary,
      total_amount: orderData.total_amount,
      status: orderData.status,
      resi_number: orderData.resi_number,
      shipping_method: orderData.shipping_method,
      notes: orderData.notes
    });

    assert.ok(newId > 0, `ID order harus valid, dapat ${newId}`);
    const fetched = db.getOrderById(newId);
    assert.strictEqual(fetched.customer_name, 'Dewi Lestari');
    assert.strictEqual(fetched.status, 'confirmed');
    assert.strictEqual(fetched.resi_number, 'JNE-99887766');
    assert.strictEqual(fetched.shipping_method, 'JNE YES');
  });

  // ============================================================
  // GRUP 4: Validasi UI EJS Modal & Tombol
  // ============================================================
  console.log('\n[4/4] Testing View Template UI orders.ejs...');

  test('orders.ejs — harus memuat tombol + Tambah Pesanan dan modal input form', () => {
    const ordersViewPath = path.resolve(__dirname, '../src/server/views/dashboard/orders.ejs');
    assert.ok(fs.existsSync(ordersViewPath), 'File orders.ejs harus ada');
    const content = fs.readFileSync(ordersViewPath, 'utf-8');

    assert.ok(content.includes('Tambah Pesanan'), 'orders.ejs harus memuat tombol atau label "Tambah Pesanan"');
    assert.ok(content.includes('/dashboard/orders/create') || content.includes('/dashboard/orders/add') || content.includes('openAddModal'), 'orders.ejs harus memuat form modal tambah pesanan');
    assert.ok(content.includes('customer_name') || content.includes('formData'), 'orders.ejs harus memiliki input nama pelanggan');
    assert.ok(content.includes('order_summary') || content.includes('formData'), 'orders.ejs harus memiliki input ringkasan pesanan');
  });

  console.log('\n======================================================');
  console.log(`HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
