const express = require('express');
const router = express.Router();
const { getConfig, saveConfig } = require('../../config');
const { initClient, getClient, getStatus } = require('../../engine');
const db = require('../../db');

// Step 1: Pilih Mode
router.get('/', (req, res) => res.redirect('/setup/step-1'));

router.get('/step-1', (req, res) => {
  const config = getConfig();
  res.render('setup/step-1-mode', {
    title: 'Langkah 1: Pilih Mode Bot',
    currentStep: 1,
    config,
    error: null
  });
});

router.post('/step-1', (req, res) => {
  const { mode, business_name, owner_phone } = req.body;

  if (!mode || !['bisnis', 'personal'].includes(mode)) {
    return res.render('setup/step-1-mode', {
      title: 'Langkah 1: Pilih Mode Bot',
      currentStep: 1,
      config: { ...getConfig(), business_name, owner_phone },
      error: 'Silakan pilih salah satu mode yang tersedia (Mode Bisnis atau Mode Personal).'
    });
  }

  saveConfig({
    mode,
    business_name: business_name ? business_name.trim() : '',
    owner_phone: owner_phone ? owner_phone.trim() : ''
  });

  db.setSetting('mode', mode);
  if (business_name) db.setSetting('business_name', business_name.trim());
  if (owner_phone) db.setSetting('owner_phone', owner_phone.trim());

  return res.redirect('/setup/step-2');
});

// Step 2: Scan QR WhatsApp
router.get('/step-2', (req, res) => {
  const config = getConfig();
  if (!config.mode) return res.redirect('/setup/step-1');

  // Pastikan engine aktif untuk generate QR jika belum
  if (!getClient()) {
    initClient();
  }

  const status = getStatus();
  res.render('setup/step-2-qr', {
    title: 'Langkah 2: Sambungkan WhatsApp',
    currentStep: 2,
    config,
    status
  });
});

router.post('/step-2', (req, res) => {
  return res.redirect('/setup/step-3');
});

// Step 3: API Key AI
router.get('/step-3', (req, res) => {
  const config = getConfig();
  if (!config.mode) return res.redirect('/setup/step-1');

  res.render('setup/step-3-api-key', {
    title: 'Langkah 3: Kunci Akses AI',
    currentStep: 3,
    config,
    error: null
  });
});

router.post('/step-3', (req, res) => {
  const { gemini_api_key, grok_api_key } = req.body;
  const config = getConfig();

  if (!gemini_api_key || gemini_api_key.trim() === '') {
    return res.render('setup/step-3-api-key', {
      title: 'Langkah 3: Kunci Akses AI',
      currentStep: 3,
      config: { ...config, grok_api_key },
      error: 'Kunci Akses Gemini (Gemini API Key) wajib diisi agar bot dapat membalas pesan.'
    });
  }

  const trimmedGemini = gemini_api_key.trim();
  const trimmedGrok = grok_api_key ? grok_api_key.trim() : '';

  saveConfig({
    gemini_api_key: trimmedGemini,
    grok_api_key: trimmedGrok
  });

  db.setSetting('gemini_api_key', trimmedGemini);
  if (trimmedGrok) db.setSetting('grok_api_key', trimmedGrok);

  return res.redirect('/setup/step-4');
});

// Step 4: Data Awal (Produk / Pengeluaran)
router.get('/step-4', (req, res) => {
  const config = getConfig();
  if (!config.mode) return res.redirect('/setup/step-1');
  if (!config.gemini_api_key) return res.redirect('/setup/step-3');

  res.render('setup/step-4-initial-data', {
    title: 'Langkah 4: Masukkan Data Awal',
    currentStep: 4,
    config,
    error: null
  });
});

router.post('/step-4', (req, res) => {
  const config = getConfig();
  const { product_name, product_price, product_stock, product_description, expense_category, expense_amount, expense_note } = req.body;

  try {
    if (config.mode === 'bisnis' && product_name && product_name.trim()) {
      db.createProduct({
        name: product_name.trim(),
        price: Number(product_price) || 0,
        stock: Number(product_stock) || 0,
        description: product_description ? product_description.trim() : ''
      });
    } else if (config.mode === 'personal' && expense_category && expense_amount) {
      db.createExpense({
        category: expense_category.trim(),
        amount: Number(expense_amount) || 0,
        note: expense_note ? expense_note.trim() : 'Data pengeluaran awal'
      });
    }

    saveConfig({ is_setup_completed: true });
    db.setSetting('is_setup_completed', 'true');

    return res.redirect('/dashboard');
  } catch (error) {
    return res.render('setup/step-4-initial-data', {
      title: 'Langkah 4: Masukkan Data Awal',
      currentStep: 4,
      config,
      error: `Gagal menyimpan data awal: ${error.message}`
    });
  }
});

router.post('/step-4/skip', (req, res) => {
  saveConfig({ is_setup_completed: true });
  db.setSetting('is_setup_completed', 'true');
  return res.redirect('/dashboard');
});

module.exports = router;
