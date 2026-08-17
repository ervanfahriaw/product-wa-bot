const express = require('express');
const router = express.Router();

const { getConfig, saveConfig } = require('../../config');
const { getStatus } = require('../../engine');
const db = require('../../db');
const { validateKey } = require('../../ai');

// 1. Dashboard Overview
router.get('/', (req, res) => {
  const config = getConfig();
  const status = getStatus();

  let stats = { totalProducts: 0, totalExpenses: 0, totalChatLogs: 0 };
  try {
    if (config.mode === 'bisnis') {
      stats.totalProducts = db.getAllProducts().length;
    } else {
      const expenses = db.getAllExpenses();
      stats.totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    }
    stats.totalChatLogs = db.getAllChatLogs(1000, 0).length;
  } catch (_) {}

  res.render('dashboard/index', {
    title: 'Panel Kontrol Bot',
    activeMenu: 'dashboard',
    config,
    status,
    stats
  });
});

// 2. Products CRUD (Mode Bisnis)
router.get('/products', (req, res) => {
  const config = getConfig();
  const products = db.getAllProducts();
  res.render('dashboard/products', {
    title: 'Katalog Produk',
    activeMenu: 'products',
    config,
    products
  });
});

router.post('/products', (req, res) => {
  const { name, price, stock, description, image_path } = req.body;
  if (name && name.trim()) {
    db.createProduct({
      name: name.trim(),
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      description: description ? description.trim() : '',
      image_path: image_path ? image_path.trim() : null
    });
  }
  return res.redirect('/dashboard/products');
});

router.post('/products/:id/edit', (req, res) => {
  const { id } = req.params;
  const { name, price, stock, description, image_path } = req.body;
  if (name && name.trim()) {
    db.updateProduct(Number(id), {
      name: name.trim(),
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      description: description ? description.trim() : '',
      image_path: image_path ? image_path.trim() : null
    });
  }
  return res.redirect('/dashboard/products');
});

router.post('/products/:id/delete', (req, res) => {
  const { id } = req.params;
  db.deleteProduct(Number(id));
  return res.redirect('/dashboard/products');
});

// 3. Expenses CRUD (Mode Personal)
router.get('/expenses', (req, res) => {
  const config = getConfig();
  const expenses = db.getAllExpenses();
  const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthly = db.getMonthlyExpenses(year, month);
  const thisMonthTotal = monthly.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  res.render('dashboard/expenses', {
    title: 'Catatan Keuangan',
    activeMenu: 'expenses',
    config,
    expenses,
    totalAmount,
    thisMonthTotal
  });
});

router.post('/expenses', (req, res) => {
  const { category, amount, note } = req.body;
  if (category && amount) {
    db.createExpense({
      category: category.trim(),
      amount: Number(amount) || 0,
      note: note ? note.trim() : ''
    });
  }
  return res.redirect('/dashboard/expenses');
});

router.post('/expenses/:id/edit', (req, res) => {
  const { id } = req.params;
  const { category, amount, note } = req.body;
  if (category && amount) {
    db.updateExpense(Number(id), {
      category: category.trim(),
      amount: Number(amount) || 0,
      note: note ? note.trim() : ''
    });
  }
  return res.redirect('/dashboard/expenses');
});

router.post('/expenses/:id/delete', (req, res) => {
  const { id } = req.params;
  db.deleteExpense(Number(id));
  return res.redirect('/dashboard/expenses');
});

// 4. Chat Logs Management
router.get('/chat-logs', (req, res) => {
  const config = getConfig();
  const { contact } = req.query;

  let logs;
  if (contact && contact.trim()) {
    logs = db.getChatLogsByContact(contact.trim(), 100);
  } else {
    logs = db.getAllChatLogs(100, 0);
  }

  res.render('dashboard/chat-logs', {
    title: 'Riwayat Percakapan',
    activeMenu: 'chat-logs',
    config,
    logs,
    filterContact: contact || ''
  });
});

router.post('/chat-logs/clear', (req, res) => {
  db.clearAllChatLogs();
  return res.redirect('/dashboard/chat-logs');
});

// 5. Settings & API Key Validation
router.get('/settings', (req, res) => {
  const config = getConfig();
  res.render('dashboard/settings', {
    title: 'Pengaturan Bot',
    activeMenu: 'settings',
    config,
    success: req.query.saved === 'true' ? 'Pengaturan berhasil diperbarui!' : null
  });
});

router.post('/settings', (req, res) => {
  const { mode, business_name, owner_phone, gemini_api_key, grok_api_key } = req.body;

  const updates = {};
  if (mode && ['bisnis', 'personal'].includes(mode)) {
    updates.mode = mode;
    db.setSetting('mode', mode);
  }
  if (typeof business_name !== 'undefined') {
    updates.business_name = business_name.trim();
    db.setSetting('business_name', business_name.trim());
  }
  if (typeof owner_phone !== 'undefined') {
    updates.owner_phone = owner_phone.trim();
    db.setSetting('owner_phone', owner_phone.trim());
  }
  if (gemini_api_key && gemini_api_key.trim()) {
    updates.gemini_api_key = gemini_api_key.trim();
    db.setSetting('gemini_api_key', gemini_api_key.trim());
  }
  if (typeof grok_api_key !== 'undefined') {
    updates.grok_api_key = grok_api_key ? grok_api_key.trim() : '';
    db.setSetting('grok_api_key', updates.grok_api_key);
  }

  saveConfig(updates);
  return res.redirect('/dashboard/settings?saved=true');
});

router.post('/settings/test-key', async (req, res) => {
  const { provider, apiKey } = req.body;
  try {
    const result = await validateKey(provider || 'gemini', apiKey);
    return res.json({
      success: true,
      valid: result.valid,
      message: result.message
    });
  } catch (err) {
    return res.json({
      success: true,
      valid: false,
      message: `Uji coba gagal: ${err.message}`
    });
  }
});

module.exports = router;
