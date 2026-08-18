const express = require('express');
const router = express.Router();

const { getConfig, saveConfig } = require('../../config');
const { getStatus } = require('../../engine');
const { syncProductsFromSheets } = require('../../engine/sheets-sync');
const { handleFileUpload } = require('../../utils/multipart-parser');
const { extractTextFromFile } = require('../../utils/document-parser');
const db = require('../../db');
const { validateKey } = require('../../ai');
const { computeBusinessAnalytics, generateAiBusinessInsights, getLatestStoredInsight } = require('../../analytics');

// Middleware parsing upload
router.use(handleFileUpload);

// Middleware injeksi global variables untuk view sidebar & dashboard
router.use((req, res, next) => {
  res.locals.pendingHandoverCount = db.getPendingHandoverCount ? db.getPendingHandoverCount() : 0;
  res.locals.todayAiCount = db.getTodayAiMessageCount ? db.getTodayAiMessageCount() : 0;
  next();
});

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

// 2. Products CRUD & Sheets Sync (Mode Bisnis Only)
router.get('/products', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const products = db.getAllProducts();
  res.render('dashboard/products', {
    title: 'Katalog Produk',
    activeMenu: 'products',
    config,
    products
  });
});

router.post('/products', (req, res) => {
  const { sku, name, category, price, stock, description, product_knowledge, image_path } = req.body;
  if (name && name.trim()) {
    db.createProduct({
      sku: sku ? sku.trim() : null,
      name: name.trim(),
      category: category ? category.trim() : 'Umum',
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      description: description ? description.trim() : '',
      product_knowledge: product_knowledge ? product_knowledge.trim() : '',
      image_path: image_path ? image_path.trim() : null
    });
  }
  return res.redirect('/dashboard/products');
});

router.post('/products/:id/edit', (req, res) => {
  const { id } = req.params;
  const { sku, name, category, price, stock, description, product_knowledge, image_path } = req.body;
  if (name && name.trim()) {
    db.updateProduct(Number(id), {
      sku: sku ? sku.trim() : null,
      name: name.trim(),
      category: category ? category.trim() : 'Umum',
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      description: description ? description.trim() : '',
      product_knowledge: product_knowledge ? product_knowledge.trim() : '',
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

router.post('/products/sync-sheets', async (req, res) => {
  try {
    const result = await syncProductsFromSheets();
    return res.json(result);
  } catch (err) {
    return res.json({
      success: false,
      message: 'Gagal sinkronisasi: ' + err.message
    });
  }
});

router.post('/products/sheets-config', (req, res) => {
  const { sheets_url, sheets_auto_sync, sheets_sync_interval } = req.body;
  const updates = {
    sheets_url: sheets_url ? sheets_url.trim() : '',
    sheets_auto_sync: sheets_auto_sync === '1' || sheets_auto_sync === true,
    sheets_sync_interval: Math.min(60, Math.max(1, parseInt(sheets_sync_interval, 10) || 10))
  };

  saveConfig(updates);
  db.setSetting('sheets_url', updates.sheets_url);
  db.setSetting('sheets_auto_sync', updates.sheets_auto_sync ? '1' : '0');
  db.setSetting('sheets_sync_interval', String(updates.sheets_sync_interval));

  return res.redirect('/dashboard/products');
});

// 3. Expenses CRUD (Mode Personal Only)
router.get('/expenses', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'personal') return res.redirect('/dashboard');
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

  const pausedList = db.getAllPausedContacts();
  const pausedMap = {};
  pausedList.forEach(p => {
    pausedMap[p.contact] = p;
  });

  res.render('dashboard/chat-logs', {
    title: 'Riwayat Percakapan',
    activeMenu: 'chat-logs',
    config,
    logs,
    pausedMap,
    filterContact: contact || ''
  });
});

router.post('/chat-logs/pause', (req, res) => {
  const { contact, hours } = req.body;
  if (contact) {
    db.pauseContact(contact.trim(), Number(hours) || 2, 'Manual Pause dari Dashboard');
  }
  return res.redirect('/dashboard/chat-logs');
});

router.post('/chat-logs/resume', (req, res) => {
  const { contact } = req.body;
  if (contact) {
    db.resumeContact(contact.trim());
  }
  return res.redirect('/dashboard/chat-logs');
});

router.post('/chat-logs/clear', (req, res) => {
  db.clearAllChatLogs();
  return res.redirect('/dashboard/chat-logs');
});

// 5. Training & Few-Shot Samples Management
router.get('/training', (req, res) => {
  const config = getConfig();
  const samples = db.getAllSamples ? db.getAllSamples(false) : [];
  res.render('dashboard/training', {
    title: 'Training Gaya Percakapan',
    activeMenu: 'training',
    config,
    samples
  });
});

router.post('/training', (req, res) => {
  const { user_sample, bot_sample, tag } = req.body;
  if (user_sample && bot_sample) {
    db.createSample({
      user_sample: user_sample.trim(),
      bot_sample: bot_sample.trim(),
      tag: tag ? tag.trim() : 'umum',
      is_active: 1
    });
  }
  return res.redirect('/dashboard/training');
});

router.post('/training/:id/edit', (req, res) => {
  const { id } = req.params;
  const { user_sample, bot_sample, tag, is_active } = req.body;
  if (user_sample && bot_sample) {
    db.updateSample(Number(id), {
      user_sample: user_sample.trim(),
      bot_sample: bot_sample.trim(),
      tag: tag ? tag.trim() : 'umum',
      is_active: typeof is_active !== 'undefined' ? 1 : 1
    });
  }
  return res.redirect('/dashboard/training');
});

router.post('/training/:id/toggle', (req, res) => {
  const { id } = req.params;
  db.toggleSampleActive(Number(id));
  return res.redirect('/dashboard/training');
});

router.post('/training/:id/delete', (req, res) => {
  const { id } = req.params;
  db.deleteSample(Number(id));
  return res.redirect('/dashboard/training');
});

// 6. Business Profile & Document Upload Knowledge Base (Mode Bisnis Only)
router.get('/business-profile', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const profileData = {
    profileText: db.getSetting('business_profile_text') || '',
    address: db.getSetting('business_address') || '',
    contact: db.getSetting('business_contact') || '',
    hours: db.getSetting('business_hours') || '',
    paymentMethods: db.getSetting('payment_methods') || '',
    shippingMethods: db.getSetting('shipping_methods') || '',
    returnPolicy: db.getSetting('return_policy') || '',
    businessNotes: db.getSetting('business_notes') || ''
  };
  const documents = db.getAllBusinessDocuments ? db.getAllBusinessDocuments() : [];
  const successMessage = req.query.saved ? 'Profil & detail informasi usaha berhasil disimpan!' : (req.query.uploaded ? 'Dokumen berhasil diunggah dan dipelajari AI!' : null);

  res.render('dashboard/business-profile', {
    title: 'Profil & Knowledge Usaha',
    activeMenu: 'business-profile',
    config,
    profileData,
    profileText: profileData.profileText,
    documents,
    successMessage
  });
});

router.post('/business-profile/save-text', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const { 
    business_profile_text,
    business_address,
    business_contact,
    business_hours,
    payment_methods,
    shipping_methods,
    return_policy,
    business_notes
  } = req.body;

  if (typeof business_profile_text !== 'undefined') db.setSetting('business_profile_text', business_profile_text.trim());
  if (typeof business_address !== 'undefined') db.setSetting('business_address', business_address.trim());
  if (typeof business_contact !== 'undefined') db.setSetting('business_contact', business_contact.trim());
  if (typeof business_hours !== 'undefined') db.setSetting('business_hours', business_hours.trim());
  if (typeof payment_methods !== 'undefined') db.setSetting('payment_methods', payment_methods.trim());
  if (typeof shipping_methods !== 'undefined') db.setSetting('shipping_methods', shipping_methods.trim());
  if (typeof return_policy !== 'undefined') db.setSetting('return_policy', return_policy.trim());
  if (typeof business_notes !== 'undefined') db.setSetting('business_notes', business_notes.trim());

  return res.redirect('/dashboard/business-profile?saved=true');
});

router.post('/business-profile/upload-doc', async (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  if (req.file) {
    try {
      const extracted = await extractTextFromFile(req.file.path, req.file.originalname);
      db.createBusinessDocument({
        original_filename: req.file.originalname,
        file_path: req.file.path,
        file_type: req.file.fieldname,
        extracted_text: extracted
      });
      return res.redirect('/dashboard/business-profile?uploaded=true');
    } catch (err) {
      console.error('[UploadDoc] Gagal memproses dokumen:', err.message);
    }
  }
  return res.redirect('/dashboard/business-profile');
});

router.post('/business-profile/delete-doc/:id', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const { id } = req.params;
  db.deleteBusinessDocument(Number(id));
  return res.redirect('/dashboard/business-profile');
});

// 7. Manual Handover Monitoring Inbox (Mode Bisnis Only)
router.get('/handover-inbox', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const filter = req.query.filter || 'pending';
  const handovers = db.getAllHandovers ? db.getAllHandovers(filter) : [];

  res.render('dashboard/handover-inbox', {
    title: 'Inbox Handover Manual',
    activeMenu: 'handover-inbox',
    config,
    handovers,
    currentFilter: filter
  });
});

router.post('/handover-inbox/:id/resolve', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const { id } = req.params;
  db.resolveHandoverTicket(Number(id));
  return res.redirect('/dashboard/handover-inbox');
});

router.post('/handover-inbox/:id/delete', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const { id } = req.params;
  db.deleteHandoverTicket(Number(id));
  return res.redirect('/dashboard/handover-inbox');
});

// 8. Business Analytics & AI Strategic Insights (Mode Bisnis Only)
router.get('/analytics', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const days = parseInt(req.query.days, 10) || 30;
  const analyticsData = computeBusinessAnalytics(days);
  const latestInsight = getLatestStoredInsight();
  const isGenerated = req.query.generated === 'true';

  res.render('dashboard/analytics', {
    title: 'Analisis Bisnis & AI Insights',
    activeMenu: 'analytics',
    config,
    analyticsData,
    latestInsight,
    selectedDays: days,
    isGenerated
  });
});

router.post('/analytics/generate-insight', async (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const days = parseInt(req.body.days, 10) || 30;
  try {
    await generateAiBusinessInsights(days);
  } catch (err) {
    console.error('[AnalyticsRoute] Gagal memproses AI insight:', err.message);
  }
  return res.redirect(`/dashboard/analytics?days=${days}&generated=true`);
});

// 9. Settings & API Key Validation
router.get('/settings', (req, res) => {
  const config = getConfig();
  const status = getStatus();
  res.render('dashboard/settings', {
    title: 'Pengaturan Bot',
    activeMenu: 'settings',
    config,
    status,
    success: req.query.saved === 'true' ? 'Pengaturan berhasil diperbarui!' : null
  });
});

router.post('/settings', (req, res) => {
  const { 
    mode, 
    business_name, 
    owner_phone, 
    gemini_api_key, 
    grok_api_key,
    ai_model,
    response_length,
    tone_style,
    emoji_level,
    max_bubbles,
    min_delay_sec,
    max_delay_sec,
    inter_bubble_delay,
    customer_debounce_sec
  } = req.body;

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
  if (ai_model) {
    updates.ai_model = ai_model.trim();
    db.setSetting('ai_model', updates.ai_model);
  }
  if (response_length) {
    updates.response_length = response_length.trim();
    db.setSetting('response_length', updates.response_length);
  }
  if (tone_style) {
    updates.tone_style = tone_style.trim();
    db.setSetting('tone_style', updates.tone_style);
  }
  if (emoji_level) {
    updates.emoji_level = emoji_level.trim();
    db.setSetting('emoji_level', updates.emoji_level);
  }
  if (typeof max_bubbles !== 'undefined') {
    const parsed = Math.min(4, Math.max(1, parseInt(max_bubbles, 10) || 3));
    updates.max_bubbles = parsed;
    db.setSetting('max_bubbles', String(parsed));
  }
  if (typeof min_delay_sec !== 'undefined') {
    const minVal = Math.min(30, Math.max(1, parseInt(min_delay_sec, 10) || 5));
    updates.min_delay_sec = minVal;
    db.setSetting('min_delay_sec', String(minVal));
  }
  if (typeof max_delay_sec !== 'undefined') {
    const maxVal = Math.min(60, Math.max(2, parseInt(max_delay_sec, 10) || 12));
    updates.max_delay_sec = maxVal;
    db.setSetting('max_delay_sec', String(maxVal));
  }
  if (typeof inter_bubble_delay !== 'undefined') {
    const interVal = Math.min(10, Math.max(0.5, parseFloat(inter_bubble_delay) || 2.5));
    updates.inter_bubble_delay = interVal;
    db.setSetting('inter_bubble_delay', String(interVal));
  }
  if (typeof customer_debounce_sec !== 'undefined') {
    const debounceVal = Math.min(20, Math.max(1, parseInt(customer_debounce_sec, 10) || 5));
    updates.customer_debounce_sec = debounceVal;
    db.setSetting('customer_debounce_sec', String(debounceVal));
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
