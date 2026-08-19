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

// ============================================================
// CUSTOMERS CRM (Mode Bisnis)
// ============================================================
router.get('/customers', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const customers = db.getAllCustomerProfiles ? db.getAllCustomerProfiles(200) : [];
  const pendingHandoverCount = db.countPendingHandovers ? db.countPendingHandovers() : 0;
  res.render('dashboard/customers', {
    title: 'Pelanggan',
    activeMenu: 'customers',
    config,
    customers,
    pendingHandoverCount
  });
});

router.post('/customers/:contact/update', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const contact = decodeURIComponent(req.params.contact);
  const { customer_name, tags, favorite_products, notes, total_orders, total_spent } = req.body;

  if (db.upsertCustomerProfile) {
    db.upsertCustomerProfile(contact, {
      customer_name: customer_name || null,
      tags: tags || null,
      favorite_products: favorite_products || null,
      notes: notes || null,
      total_orders: parseInt(total_orders, 10) || 0,
      total_spent: parseInt(total_spent, 10) || 0
    });
  }

  return res.redirect('/dashboard/customers');
});

// ============================================================
// FAQ OTOMATIS (Mode Bisnis)
// ============================================================
router.get('/faqs', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const faqs = db.getAllFaqs ? db.getAllFaqs() : [];
  const pendingHandoverCount = db.countPendingHandovers ? db.countPendingHandovers() : 0;
  res.render('dashboard/faqs', {
    title: 'FAQ Otomatis',
    activeMenu: 'faqs',
    config,
    faqs,
    pendingHandoverCount
  });
});

router.post('/faqs', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const { question_label, trigger_keywords, answer, is_active } = req.body;
  if (db.createFaq && question_label && trigger_keywords && answer) {
    db.createFaq({
      question_label: question_label.trim(),
      trigger_keywords: trigger_keywords.trim(),
      answer: answer.trim(),
      is_active: is_active ? 1 : 0
    });
  }
  return res.redirect('/dashboard/faqs');
});

router.post('/faqs/:id/update', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const id = parseInt(req.params.id, 10);
  const { question_label, trigger_keywords, answer, is_active } = req.body;
  if (db.updateFaq) {
    db.updateFaq(id, {
      question_label: question_label ? question_label.trim() : undefined,
      trigger_keywords: trigger_keywords ? trigger_keywords.trim() : undefined,
      answer: answer ? answer.trim() : undefined,
      is_active: is_active ? 1 : 0
    });
  }
  return res.redirect('/dashboard/faqs');
});

router.post('/faqs/:id/delete', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  const id = parseInt(req.params.id, 10);
  if (db.deleteFaq) db.deleteFaq(id);
  return res.redirect('/dashboard/faqs');
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
  const optouts = db.getAllOptOuts ? db.getAllOptOuts() : [];
  res.render('dashboard/settings', {
    title: 'Pengaturan Bot',
    activeMenu: 'settings',
    config,
    status,
    optouts,
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
    customer_debounce_sec,
    business_hours_open,
    business_hours_close,
    out_of_hours_mode,
    follow_up_enabled,
    follow_up_delay_hours,
    follow_up_template
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

  // Jam operasional (gabungkan open + close menjadi "HH:MM-HH:MM")
  if (typeof business_hours_open !== 'undefined' && typeof business_hours_close !== 'undefined') {
    const hoursStr = `${(business_hours_open || '08:00').trim()}-${(business_hours_close || '17:00').trim()}`;
    updates.business_hours = hoursStr;
    db.setSetting('business_hours', hoursStr);
  }
  if (typeof out_of_hours_mode !== 'undefined') {
    updates.out_of_hours_mode = out_of_hours_mode;
    db.setSetting('out_of_hours_mode', out_of_hours_mode);
  }

  // Follow-up settings (Fase 5)
  if (typeof follow_up_enabled !== 'undefined') {
    const isEnabled = follow_up_enabled === '1' || follow_up_enabled === 'true' || follow_up_enabled === true;
    updates.follow_up_enabled = isEnabled;
    db.setSetting('follow_up_enabled', isEnabled ? 'true' : 'false');
  }
  if (typeof follow_up_delay_hours !== 'undefined') {
    const hours = Math.min(72, Math.max(1, parseInt(follow_up_delay_hours, 10) || 24));
    updates.follow_up_delay_hours = hours;
    db.setSetting('follow_up_delay_hours', String(hours));
  }
  if (typeof follow_up_template !== 'undefined') {
    updates.follow_up_template = follow_up_template.trim();
    db.setSetting('follow_up_template', follow_up_template.trim());
  }

  saveConfig(updates);
  return res.redirect('/dashboard/settings?saved=true');
});

router.post('/settings/follow-ups/optout/delete', (req, res) => {
  const { contact } = req.body;
  if (contact && contact.trim()) {
    db.removeOptOut(contact.trim());
    console.log(`[Dashboard] Menghapus ${contact} dari daftar opt-out follow-up`);
  }
  return res.redirect('/dashboard/settings');
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

// ============================
// REMINDERS CRUD (Mode Personal)
// ============================

// Halaman daftar pengingat
router.get('/reminders', (req, res) => {
  const config = getConfig();
  const allReminders = db.getAllReminders ? db.getAllReminders() : [];
  const activeReminders = allReminders.filter(r => r.is_active);
  
  res.render('dashboard/reminders', {
    title: 'Pengingat',
    activeMenu: 'reminders',
    config,
    reminders: allReminders,
    activeCount: activeReminders.length,
    recurringCount: activeReminders.filter(r => r.recurrence_type).length,
    oneshotCount: activeReminders.filter(r => !r.recurrence_type && !r.sent).length
  });
});

// Tambah pengingat baru dari dashboard
router.post('/reminders', (req, res) => {
  const { message, trigger_date, trigger_time, recurrence_type } = req.body;
  if (message && message.trim() && trigger_date && trigger_time) {
    const triggerAt = `${trigger_date} ${trigger_time}:00`;
    db.createReminder({
      message: message.trim(),
      trigger_at: triggerAt,
      is_recurring: recurrence_type ? 1 : 0,
      sent: 0,
      label: message.trim().toLowerCase().substring(0, 100),
      recurrence_type: recurrence_type || null
    });
  }
  return res.redirect('/dashboard/reminders');
});

// Batalkan pengingat (soft delete — set is_active = 0)
router.post('/reminders/:id/cancel', (req, res) => {
  const { id } = req.params;
  if (db.cancelReminderById) {
    db.cancelReminderById(Number(id));
  }
  return res.redirect('/dashboard/reminders');
});

// Hapus pengingat permanen (hard delete)
router.post('/reminders/:id/delete', (req, res) => {
  const { id } = req.params;
  db.deleteReminder(Number(id));
  return res.redirect('/dashboard/reminders');
});

// ============================
// NOTES CRUD (Mode Personal)
// ============================

router.get('/notes', (req, res) => {
  const config = getConfig();
  const q = req.query.q || '';
  const notes = q ? (db.searchNotes ? db.searchNotes(q) : []) : (db.getAllNotes ? db.getAllNotes(100) : []);
  
  res.render('dashboard/notes', {
    title: 'Catatan',
    activeMenu: 'notes',
    config,
    notes,
    q
  });
});

router.post('/notes', (req, res) => {
  const { title, content, tags } = req.body;
  if (content && content.trim()) {
    db.createNote({
      title: title ? title.trim() : null,
      content: content.trim(),
      tags: tags ? tags.trim() : null
    });
  }
  return res.redirect('/dashboard/notes');
});

router.post('/notes/:id/delete', (req, res) => {
  const { id } = req.params;
  db.deleteNoteById(Number(id));
  return res.redirect('/dashboard/notes');
});

// ============================
// TODOS CRUD (Mode Personal)
// ============================

router.get('/todos', (req, res) => {
  const config = getConfig();
  const filter = req.query.filter || 'active';
  const allTodos = db.getAllTodos ? db.getAllTodos(200) : [];
  const activeTodos = allTodos.filter(t => !t.is_done);
  const doneTodos = allTodos.filter(t => t.is_done);

  let filteredTodos;
  if (filter === 'done') filteredTodos = doneTodos;
  else if (filter === 'all') filteredTodos = allTodos;
  else filteredTodos = activeTodos;
  
  res.render('dashboard/todos', {
    title: 'Daftar Tugas',
    activeMenu: 'todos',
    config,
    todos: allTodos,
    filteredTodos,
    filter,
    activeCount: activeTodos.length,
    doneCount: doneTodos.length
  });
});

router.post('/todos', (req, res) => {
  const { task, priority, due_date } = req.body;
  if (task && task.trim()) {
    db.createTodo({
      task: task.trim(),
      priority: priority || 'normal',
      due_date: due_date || null
    });
  }
  return res.redirect('/dashboard/todos');
});

router.post('/todos/:id/complete', (req, res) => {
  const { id } = req.params;
  if (db.completeTodoById) db.completeTodoById(Number(id));
  return res.redirect('/dashboard/todos');
});

router.post('/todos/:id/uncomplete', (req, res) => {
  const { id } = req.params;
  if (db.uncompleteTodoById) db.uncompleteTodoById(Number(id));
  return res.redirect('/dashboard/todos');
});

router.post('/todos/:id/delete', (req, res) => {
  const { id } = req.params;
  db.deleteTodoById(Number(id));
  return res.redirect('/dashboard/todos');
});

// ============================
// BUDGETS CRUD (Mode Personal)
// ============================

router.get('/budgets', (req, res) => {
  const config = getConfig();
  const { getAllBudgetStatus } = require('../../engine/budget-checker');
  const budgetStatuses = getAllBudgetStatus();

  res.render('dashboard/budgets', {
    title: 'Budget Planner',
    activeMenu: 'budgets',
    config,
    budgetStatuses
  });
});

router.post('/budgets', (req, res) => {
  const { category, monthly_limit, alert_at_percent } = req.body;
  if (category && category.trim() && monthly_limit) {
    db.setBudget({
      category: category.trim(),
      monthly_limit: Number(monthly_limit),
      alert_at_percent: Number(alert_at_percent) || 80
    });
  }
  return res.redirect('/dashboard/budgets');
});

router.post('/budgets/:id/delete', (req, res) => {
  const { id } = req.params;
  db.deleteBudget(Number(id));
  return res.redirect('/dashboard/budgets');
});

// ============================
// HABITS CRUD (Mode Personal)
// ============================

router.get('/habits', (req, res) => {
  const config = getConfig();
  const activeHabits = db.getActiveHabits ? db.getActiveHabits() : [];
  
  // Enrich with streak, check-in status, and recent dates
  const habits = activeHabits.map(h => {
    const streak = db.calculateStreak ? db.calculateStreak(h.id) : { current: 0, best: 0 };
    const checkedToday = db.hasCheckedInToday ? db.hasCheckedInToday(h.id) : false;
    const weekCount = db.getCheckinCount ? db.getCheckinCount(h.id, 7) : 0;
    
    // Get last 7 days of log dates for visual dots
    const logs = db.getHabitLogs ? db.getHabitLogs(h.id, 30) : [];
    const recentDates = logs.map(l => l.logged_at.substring(0, 10));
    
    return { ...h, streak, checkedToday, weekCount, recentDates };
  });

  res.render('dashboard/habits', {
    title: 'Habit Tracker',
    activeMenu: 'habits',
    config,
    habits
  });
});

router.post('/habits', (req, res) => {
  const { name, frequency } = req.body;
  if (name && name.trim()) {
    db.createHabit({ name: name.trim(), frequency: frequency || 'daily' });
  }
  return res.redirect('/dashboard/habits');
});

router.post('/habits/:id/checkin', (req, res) => {
  const { id } = req.params;
  const habitId = Number(id);
  if (db.hasCheckedInToday && !db.hasCheckedInToday(habitId)) {
    db.logHabitCheckin(habitId);
    const streak = db.calculateStreak ? db.calculateStreak(habitId) : { current: 0, best: 0 };
    db.updateStreak(habitId, streak.current, streak.best);
  }
  return res.redirect('/dashboard/habits');
});

router.post('/habits/:id/delete', (req, res) => {
  const { id } = req.params;
  db.deleteHabit(Number(id));
  return res.redirect('/dashboard/habits');
});

// ============================
// EVENTS CRUD (Mode Personal)
// ============================

router.get('/events', (req, res) => {
  const config = getConfig();
  const events = db.getUpcomingEvents ? db.getUpcomingEvents(50) : [];
  res.render('dashboard/events', { title: 'Jadwal Acara', activeMenu: 'events', config, events });
});

router.post('/events', (req, res) => {
  const { title, event_date, location, description } = req.body;
  if (title && title.trim() && event_date) {
    db.createEvent({ title: title.trim(), event_date, location: location || null, description: description || null });
  }
  return res.redirect('/dashboard/events');
});

router.post('/events/:id/delete', (req, res) => {
  db.deleteEvent(Number(req.params.id));
  return res.redirect('/dashboard/events');
});

// ============================
// JOURNALS CRUD (Mode Personal)
// ============================

router.get('/journals', (req, res) => {
  const config = getConfig();
  const journals = db.getAllJournals ? db.getAllJournals(50) : [];
  const streak = db.getJournalStreak ? db.getJournalStreak() : 0;
  res.render('dashboard/journals', { title: 'Daily Journal', activeMenu: 'journals', config, journals, streak });
});

router.post('/journals', (req, res) => {
  const { content, mood, tags } = req.body;
  if (content && content.trim()) {
    db.createJournal({ content: content.trim(), mood: mood || null, tags: tags || null });
  }
  return res.redirect('/dashboard/journals');
});

router.post('/journals/:id/delete', (req, res) => {
  db.deleteJournal(Number(req.params.id));
  return res.redirect('/dashboard/journals');
});

// ============================
// GOALS CRUD (Mode Personal)
// ============================

router.get('/goals', (req, res) => {
  const config = getConfig();
  const goals = db.getAllGoals ? db.getAllGoals(50) : [];
  res.render('dashboard/goals', { title: 'Goal Setting', activeMenu: 'goals', config, goals });
});

router.post('/goals', (req, res) => {
  const { title, target_value, unit, deadline } = req.body;
  if (title && title.trim()) {
    db.createGoal({
      title: title.trim(),
      target_value: target_value ? Number(target_value) : null,
      unit: unit || null,
      deadline: deadline || null
    });
  }
  return res.redirect('/dashboard/goals');
});

router.post('/goals/:id/complete', (req, res) => {
  db.completeGoal(Number(req.params.id));
  return res.redirect('/dashboard/goals');
});

router.post('/goals/:id/delete', (req, res) => {
  db.deleteGoal(Number(req.params.id));
  return res.redirect('/dashboard/goals');
});

// ============================
// EXPORT DATA (Mode Personal)
// ============================

router.get('/export', (req, res) => {
  const config = getConfig();
  res.render('dashboard/export', { title: 'Export Data', activeMenu: 'export', config });
});

router.get('/export/download', (req, res) => {
  const { type } = req.query;
  const exportData = require('../../engine/export-data');

  const exporters = {
    expenses: { fn: exportData.exportExpenses, name: 'pengeluaran' },
    notes: { fn: exportData.exportNotes, name: 'catatan' },
    todos: { fn: exportData.exportTodos, name: 'tugas' },
    budgets: { fn: exportData.exportBudgets, name: 'budget' },
    habits: { fn: exportData.exportHabits, name: 'kebiasaan' },
    journals: { fn: exportData.exportJournals, name: 'jurnal' },
    goals: { fn: exportData.exportGoals, name: 'goal' },
    events: { fn: exportData.exportEvents, name: 'jadwal' }
  };

  const exporter = exporters[type];
  if (!exporter) {
    return res.status(400).send('Tipe export tidak valid');
  }

  const csv = exporter.fn();
  const date = new Date().toISOString().substring(0, 10);
  const filename = `${exporter.name}_${date}.csv`;

  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(bom + csv);
});

// ============================
// ORDERS CRUD (Mode Bisnis)
// ============================

router.get('/orders', (req, res) => {
  const config = getConfig();
  if (config.mode !== 'bisnis') return res.redirect('/dashboard');
  
  const { status } = req.query;
  const orders = db.getAllOrders(status && status.trim() ? status.trim() : undefined, 100);
  
  res.render('dashboard/orders', {
    title: 'Daftar Pesanan',
    activeMenu: 'orders',
    config,
    orders,
    currentStatusFilter: status || ''
  });
});

router.post('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, resi_number } = req.body;
  
  if (status) {
    db.updateOrderStatus(Number(id), status, resi_number ? resi_number.trim() : null);
    
    // Kirim notifikasi WA otomatis jika pesanan dikirim (shipped) dan nomor resi terisi
    if (status === 'shipped') {
      try {
        const order = db.getOrderById(Number(id));
        if (order && order.contact) {
          const { getClient } = require('../../engine');
          const client = getClient();
          if (client) {
            const businessName = getConfig().business_name || 'Toko Kami';
            const resiText = resi_number ? ` dengan nomor resi *${resi_number.trim()}*` : '';
            const notificationMsg = `🎉 *[NOTIFIKASI PESANAN - ${businessName.toUpperCase()}]*\n\nHalo ${order.customer_name || 'Kak'}!\nKabar baik, pesanan Anda *(${order.order_summary})* telah dikirim${resiText}.\n\nTerima kasih telah berbelanja di toko kami! 🙏😊`;
            
            // Kirim ke nomor WA pelanggan
            let contactJid = order.contact;
            if (!contactJid.includes('@')) {
              contactJid = `${contactJid.replace(/[^0-9]/g, '')}@c.us`;
            }
            await client.sendMessage(contactJid, notificationMsg);
            console.log(`[OrderNotification] Berhasil mengirim notifikasi shipped ke ${contactJid}`);
          }
        }
      } catch (err) {
        console.error('[OrderNotification] Gagal mengirim notifikasi shipped:', err.message);
      }
    }
  }
  
  return res.redirect('/dashboard/orders');
});

router.post('/orders/:id/delete', (req, res) => {
  db.deleteOrder(Number(req.params.id));
  return res.redirect('/dashboard/orders');
});

module.exports = router;
