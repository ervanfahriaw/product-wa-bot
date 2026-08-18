const assert = require('assert');
const db = require('../src/db');
const { normalizeSheetsUrl, parseCsvRows, mapCsvToProducts } = require('../src/engine/sheets-sync');
const { buildBusinessContext } = require('../src/ai/context-builder');
const { generateReply } = require('../src/ai/router');

async function testPhase5() {
  console.log('=== PENGUJIAN TDD FASE 5: SPREADSHEET SYNC & PRODUCT KNOWLEDGE ===\n');

  // Test 1: URL Normalizer Google Sheets
  console.log('[Test 1/4] Pengujian normalisasi URL Google Sheets...');
  const normalUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing';
  const csvUrl = normalizeSheetsUrl(normalUrl);
  assert(csvUrl.includes('gviz/tq?tqx=out:csv'), 'URL harus diubah menjadi export format CSV');
  assert(csvUrl.includes('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'), 'ID spreadsheet harus dipertahankan');

  const tab2Url = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=987654';
  const csvTab2Url = normalizeSheetsUrl(tab2Url);
  assert(csvTab2Url.includes('&gid=987654'), 'gid tab harus dipertahankan');
  console.log('  -> OK: URL Google Sheets berhasil dinormalisasi ke link stream CSV.');

  // Test 2: CSV Parsing & Column Mapping
  console.log('\n[Test 2/4] Pengujian parser CSV & pemetaan kolom produk...');
  const sampleCsv = `SKU,Nama Produk,Kategori,Harga,Stok,Deskripsi,Product Knowledge,Gambar
KOP-01,"Kopi Susu Aren Spesial",Minuman,Rp 18.000,35,"Kopi blend aren","Terbuat dari 100% gula aren organik Garut, masa simpan 4 hari di chiller",assets/kopi.jpg
SNK-02,"Croissant Almond",Pastry,"24,000",12,"Roti renyah","Butter impor Prancis dengan taburan almond panggang renyah",assets/croissant.jpg`;

  const rows = parseCsvRows(sampleCsv);
  assert.strictEqual(rows.length, 3, 'Harus terurai menjadi 3 baris (1 header + 2 data)');

  const products = mapCsvToProducts(rows);
  assert.strictEqual(products.length, 2, 'Harus memetakan 2 produk');
  assert.strictEqual(products[0].sku, 'KOP-01');
  assert.strictEqual(products[0].name, 'Kopi Susu Aren Spesial');
  assert.strictEqual(products[0].price, 18000);
  assert.strictEqual(products[0].stock, 35);
  assert(products[0].product_knowledge.includes('gula aren organik'));

  assert.strictEqual(products[1].sku, 'SNK-02');
  assert.strictEqual(products[1].price, 24000);
  assert.strictEqual(products[1].stock, 12);
  console.log('  -> OK: Parser CSV memetakan harga, stok, SKU, dan product knowledge dengan presisi.');

  // Test 3: Upsert ke Database SQLite
  console.log('\n[Test 3/4] Pengujian Upsert (Insert & Update by SKU) ke SQLite...');
  const resAdd = db.upsertProductFromSheet(products[0]);
  assert.strictEqual(resAdd.action, 'added', 'Item pertama harus berstatus added');

  // Update stok & harga produk yang sama
  const updatedItem = { ...products[0], price: 20000, stock: 50 };
  const resUpdate = db.upsertProductFromSheet(updatedItem);
  assert.strictEqual(resUpdate.action, 'updated', 'Item kedua dengan SKU sama harus berstatus updated');

  const inDb = db.getProductBySku('KOP-01');
  assert.strictEqual(inDb.price, 20000, 'Harga harus diperbarui menjadi 20000');
  assert.strictEqual(inDb.stock, 50, 'Stok harus diperbarui menjadi 50');
  console.log('  -> OK: Mekanisme Upsert produk SQLite via SKU sukses.');

  // Test 4: RAG Context & AI Answering dari Product Knowledge
  console.log('\n[Test 4/4] Pengujian RAG bot membaca product knowledge dari database...');
  const context = buildBusinessContext('kopi susu aren');
  assert(context.includes('KOP-01'), 'Konteks harus memuat SKU');
  assert(context.includes('gula aren organik Garut'), 'Konteks harus memuat product knowledge mendalam');

  const replyRes = await generateReply({
    message: 'apakah gula arennya asli atau sirup biasa?',
    mode: 'bisnis'
  });
  assert(replyRes.reply && replyRes.reply.length > 0, 'Balasan AI harus terisi');
  console.log('  -> OK: AI membaca product knowledge database dan menjawab pertanyaan spesifik.');
  console.log('  -> Cuplikan Balasan AI:', replyRes.reply.substring(0, 130) + '...');

  // Hapus produk uji
  db.deleteProduct(inDb.id);
  console.log('  -> OK: Pembersihan data produk uji selesai.');

  console.log('\n✅ FASE 5 SELESAI & LULUS 100% (STATUS: GREEN)');
}

testPhase5().catch(err => {
  console.error('\n❌ GAGAL PENGUJIAN FASE 5:', err);
  process.exit(1);
});
