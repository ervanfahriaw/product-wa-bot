const assert = require('assert');
const path = require('path');
const fs = require('fs');

const db = require('../src/db');

console.log('=== MEMULAI PENGUJIAN DATABASE LAYER (FASE 1) ===\n');

try {
  // 1. Test Settings
  console.log('[1/5] Testing tabel `settings`...');
  const settingKey = 'test_mode';
  const settingVal = 'bisnis';
  db.setSetting(settingKey, settingVal);
  const fetchedSetting = db.getSetting(settingKey);
  assert.strictEqual(fetchedSetting, settingVal, 'Setting value tidak cocok!');
  const allSettings = db.getAllSettings();
  assert.ok(allSettings[settingKey], 'Setting key tidak ditemukan di getAllSettings!');
  console.log('  -> Insert & Read setting berhasil:', { key: settingKey, value: fetchedSetting });

  // 2. Test Products
  console.log('[2/5] Testing tabel `products`...');
  const productId = db.createProduct({
    name: 'Kopi Susu Gula Aren',
    description: 'Kopi susu espresso blend dengan gula aren asli',
    price: 18000,
    stock: 25,
    image_path: 'assets/products/kopi-susu.jpg'
  });
  assert.ok(productId > 0, 'Gagal membuat produk dummy!');
  const fetchedProduct = db.getProductById(productId);
  assert.strictEqual(fetchedProduct.name, 'Kopi Susu Gula Aren');
  assert.strictEqual(fetchedProduct.price, 18000);
  assert.strictEqual(fetchedProduct.stock, 25);
  
  const searchResults = db.searchProducts('Aren');
  assert.ok(searchResults.length > 0, 'Pencarian produk berdasarkan keyword gagal!');
  console.log('  -> Insert & Read & Search product berhasil:', {
    id: fetchedProduct.id,
    name: fetchedProduct.name,
    price: fetchedProduct.price,
    stock: fetchedProduct.stock
  });

  // 3. Test Expenses
  console.log('[3/5] Testing tabel `expenses`...');
  const expenseId = db.createExpense({
    category: 'Makan & Minum',
    amount: 25000,
    note: 'Beli makan siang nasi padang'
  });
  assert.ok(expenseId > 0, 'Gagal membuat catatan pengeluaran dummy!');
  const fetchedExpense = db.getExpenseById(expenseId);
  assert.strictEqual(fetchedExpense.category, 'Makan & Minum');
  assert.strictEqual(fetchedExpense.amount, 25000);
  console.log('  -> Insert & Read expense berhasil:', {
    id: fetchedExpense.id,
    category: fetchedExpense.category,
    amount: fetchedExpense.amount,
    note: fetchedExpense.note
  });

  // 4. Test Reminders
  console.log('[4/5] Testing tabel `reminders`...');
  const reminderId = db.createReminder({
    message: 'Kirim rekap mingguan ke owner',
    trigger_at: '2026-08-18 09:00:00',
    is_recurring: 0,
    cron_pattern: null,
    sent: 0
  });
  assert.ok(reminderId > 0, 'Gagal membuat reminder dummy!');
  const fetchedReminder = db.getReminderById(reminderId);
  assert.strictEqual(fetchedReminder.message, 'Kirim rekap mingguan ke owner');
  assert.strictEqual(fetchedReminder.sent, 0);
  console.log('  -> Insert & Read reminder berhasil:', {
    id: fetchedReminder.id,
    message: fetchedReminder.message,
    trigger_at: fetchedReminder.trigger_at,
    sent: fetchedReminder.sent
  });

  // 5. Test Chat Logs
  console.log('[5/5] Testing tabel `chat_logs`...');
  const chatLogId = db.createChatLog({
    contact: '628123456789',
    message_in: 'Halo, apakah kopi susu masih ada stok?',
    message_out: 'Halo kak! Kopi Susu Gula Aren masih ready stok 25 porsi ya.',
    handled_by: 'ai'
  });
  assert.ok(chatLogId > 0, 'Gagal membuat chat log dummy!');
  const fetchedChatLog = db.getChatLogById(chatLogId);
  assert.strictEqual(fetchedChatLog.contact, '628123456789');
  assert.strictEqual(fetchedChatLog.handled_by, 'ai');
  console.log('  -> Insert & Read chat_log berhasil:', {
    id: fetchedChatLog.id,
    contact: fetchedChatLog.contact,
    message_in: fetchedChatLog.message_in,
    message_out: fetchedChatLog.message_out,
    handled_by: fetchedChatLog.handled_by
  });

  console.log('\n=== SEMUA PENGUJIAN DATABASE LAYER (FASE 1) BERHASIL 100% ===');
} catch (error) {
  console.error('\n❌ ERROR DALAM TEST DATABASE:', error);
  process.exit(1);
}
