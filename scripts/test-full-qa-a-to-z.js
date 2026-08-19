/**
 * Master QA Audit Suite: Pengujian Komprehensif A - Z
 * 
 * Menguji seluruh modul sistem WhatsApp Bot & Web Controller:
 * 1. Keamanan Repositori & Sanitasi Git
 * 2. Integritas Database & 21 Modul Queries SQLite
 * 3. AI Router, RAG Context Builder & Prompt Cleaning
 * 4. WhatsApp Engine Pipeline (Buffer, Bubbles, Handover, Schedulers)
 * 5. Web Controller EJS Templates & Express View Rendering (Semua 25 Views)
 * 6. Error Handling & Edge Cases
 * 
 * Jalankan: node scripts/test-full-qa-a-to-z.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

process.env.NODE_ENV = 'test';
process.env.NO_DELAY = '1';

console.log('================================================================');
console.log('  🔍 MEMULAI MASTER QA AUDIT: QUALITY CHECK A - Z LENGKAP     ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(suiteName, testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [${suiteName}] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [${suiteName}] ${testName}`);
    console.error(`     -> Error: ${err.message}`);
    failedTests++;
  }
}

async function runTestAsync(suiteName, testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [${suiteName}] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [${suiteName}] ${testName}`);
    console.error(`     -> Error: ${err.message}`);
    failedTests++;
  }
}

(async () => {
  const rootDir = path.resolve(__dirname, '..');
  const db = require('../src/db');
  const { getConfig, saveConfig, DEFAULT_CONFIG } = require('../src/config');

  // ============================================================
  // BAGIAN 1: KEAMANAN REPOSITORI & GIT HYGIENE
  // ============================================================
  console.log('\n--- [SEKSI 1/6] KEAMANAN REPOSITORI & SANITASI GIT ---');

  runTest('Security', '.gitignore harus memuat semua file & folder sensitif', () => {
    const gitignorePath = path.join(rootDir, '.gitignore');
    assert.ok(fs.existsSync(gitignorePath), '.gitignore tidak ditemukan');
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    const requiredPatterns = ['node_modules', 'config/config.json', 'data/*.db', '.wwebjs_auth', '.wwebjs_cache', '.env'];
    for (const pat of requiredPatterns) {
      assert.ok(content.includes(pat), `.gitignore harus memuat pattern "${pat}"`);
    }
  });

  runTest('Security', 'config.json.example harus memuat semua kunci konfigurasi standar', () => {
    const examplePath = path.join(rootDir, 'config/config.json.example');
    assert.ok(fs.existsSync(examplePath), 'config.json.example tidak ditemukan');
    const example = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
    assert.strictEqual(typeof example.port, 'number');
    assert.strictEqual(typeof example.mode, 'string');
    assert.ok('gemini_api_key' in example);
    assert.ok('customer_debounce_sec' in example);
    assert.ok('follow_up_enabled' in example);
  });

  runTest('Security', 'package.json harus valid dan memiliki entry point src/server/index.js', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    assert.strictEqual(pkg.main, 'src/server/index.js');
    assert.ok(pkg.scripts.start);
    assert.ok(pkg.dependencies['whatsapp-web.js']);
    assert.ok(pkg.dependencies.ejs);
    assert.ok(pkg.dependencies.express);
  });

  // ============================================================
  // BAGIAN 2: INTEGRITAS DATABASE & 21 MODUL QUERIES
  // ============================================================
  console.log('\n--- [SEKSI 2/6] INTEGRITAS DATABASE & 21 MODUL QUERIES ---');

  runTest('Database', 'Settings queries (getSetting, setSetting, getAllSettings)', () => {
    db.setSetting('qa_test_key', 'qa_value_123');
    assert.strictEqual(db.getSetting('qa_test_key'), 'qa_value_123');
    const all = db.getAllSettings();
    assert.strictEqual(all.qa_test_key, 'qa_value_123');
  });

  runTest('Database', 'Products queries (create, getById, search, update, delete)', () => {
    const id = db.createProduct({
      name: 'QA Arabica Super',
      price: 35000,
      stock: 20,
      description: 'Kopi QA premium',
      related_products: ''
    });
    assert.ok(id > 0);
    const prod = db.getProductById(id);
    assert.strictEqual(prod.name, 'QA Arabica Super');
    const searchRes = db.searchProducts('Arabica Super');
    assert.ok(searchRes.some(p => p.id === id));
    db.updateProduct(id, { price: 38000 });
    assert.strictEqual(db.getProductById(id).price, 38000);
    db.deleteProduct(id);
    assert.strictEqual(db.getProductById(id), null);
  });

  runTest('Database', 'Expenses queries (create, getMonthly, categories, delete)', () => {
    const id = db.createExpense({ category: 'Bahan Baku', amount: 50000, note: 'Beli susu QA' });
    assert.ok(id > 0);
    const ex = db.getExpenseById(id);
    assert.strictEqual(ex.amount, 50000);
    const cats = db.getExpenseCategories();
    assert.ok(cats.includes('Bahan Baku'));
    db.deleteExpense(id);
    assert.strictEqual(db.getExpenseById(id), null);
  });

  runTest('Database', 'Reminders queries (create, active, snooze, delete)', () => {
    const trigger = new Date(Date.now() + 3600000).toISOString().replace('T', ' ').substring(0, 19);
    const id = db.createReminder({ message: 'QA Reminder meeting', trigger_at: trigger });
    assert.ok(id > 0);
    const active = db.getActiveReminders();
    assert.ok(active.some(r => r.id === id));
    db.deleteReminder(id);
    assert.strictEqual(db.getReminderById(id), null);
  });

  runTest('Database', 'Chat Logs queries (create, pagination, getTodayCount)', () => {
    const id = db.createChatLog({ contact: '628999111@c.us', message_in: 'Halo QA', message_out: 'Hai QA', handled_by: 'ai' });
    assert.ok(id > 0);
    const logs = db.getChatLogsByContact('628999111@c.us', 5);
    assert.ok(logs.length > 0);
    const count = db.getTodayAiMessageCount();
    assert.ok(typeof count === 'number' && count >= 1);
  });

  runTest('Database', 'Contact States (pause, isPaused, resume/unpause)', () => {
    const contact = '628999888777@c.us';
    db.pauseContact(contact, 1, 'QA Test Pause');
    assert.strictEqual(db.isContactPaused(contact), true);
    db.unpauseContact(contact);
    assert.strictEqual(db.isContactPaused(contact), false);
  });

  runTest('Database', 'Customer Profiles CRM (upsert, get, updateStatus, updateLastContact)', () => {
    const contact = '628777666555@c.us';
    db.upsertCustomerProfile(contact, { customer_name: 'Budi QA', customer_status: 'new' });
    const prof = db.getCustomerProfile(contact);
    assert.strictEqual(prof.customer_name, 'Budi QA');
    db.updateCustomerStatus(contact, 'vip');
    assert.strictEqual(db.getCustomerProfile(contact).customer_status, 'vip');
    db.updateLastContact(contact);
  });

  runTest('Database', 'FAQs (create, matchFaq whole-word, incrementCount, delete)', () => {
    const id = db.createFaq({
      trigger_keywords: 'qa wifi,kata sandi internet',
      question_label: 'QA WiFi Password',
      answer: 'Password WiFi adalah: qapassword123',
      is_active: 1
    });
    assert.ok(id > 0);
    // Whole-word match testing
    assert.ok(db.matchFaq('apa password qa wifi toko?') !== null);
    assert.strictEqual(db.matchFaq('halo ka'), null); // Tidak boleh false positive
    db.incrementFaqMatchCount(id);
    const updated = db.getFaqById(id);
    assert.ok(updated.match_count >= 1);
    db.deleteFaq(id);
  });

  runTest('Database', 'Orders (createOrder, getOrdersByStatus, updateOrderStatus)', () => {
    const id = db.createOrder({
      contact: '62811223344@c.us',
      customer_name: 'Siti QA',
      items: '2x Kopi Arabika',
      total_amount: 50000,
      shipping_address: 'Jl. Merdeka No. 10'
    });
    assert.ok(id > 0);
    const pendingOrders = db.getOrdersByStatus('pending');
    assert.ok(pendingOrders.some(o => o.id === id));
    db.updateOrderStatus(id, 'completed');
    const order = db.getOrderById(id);
    assert.strictEqual(order.status, 'completed');
  });

  runTest('Database', 'Follow Ups & Opt-outs (schedule, optout checks, cancel)', () => {
    const contact = '628999555444@c.us';
    const id = db.scheduleFollowUpInDb({
      contact,
      product_name: 'QA Special Drink',
      trigger_message: 'tanya harga minuman',
      scheduled_at: new Date().toISOString()
    });
    assert.ok(id > 0);
    assert.strictEqual(db.isFollowUpOptedOut(contact), false);
    db.addFollowUpOptOut(contact, 'Stop spam');
    assert.strictEqual(db.isFollowUpOptedOut(contact), true);
    db.removeFollowUpOptOut(contact);
    assert.strictEqual(db.isFollowUpOptedOut(contact), false);
  });

  runTest('Database', 'Personal Mode tables (Notes, Todos, Budgets, Habits, Events, Journals, Goals)', () => {
    // Notes
    const noteId = db.createNote({ title: 'QA Note', content: 'Isi catatan', tags: 'qa,test' });
    assert.ok(noteId > 0);
    assert.ok(db.searchNotes('catatan').length > 0);
    db.deleteNote(noteId);

    // Todos
    const todoId = db.createTodo({ task: 'QA Task 1', priority: 'high' });
    assert.ok(todoId > 0);
    db.toggleTodo(todoId);
    assert.strictEqual(db.getTodoById(todoId).is_done, 1);
    db.deleteTodo(todoId);

    // Budgets
    const budgetId = db.createBudget({ category: 'QA Test Category', monthly_limit: 1000000 });
    assert.ok(budgetId > 0);
    assert.ok(db.getBudgetByCategory('QA Test Category'));
    db.deleteBudget(budgetId);

    // Habits
    const habitId = db.createHabit({ name: 'Minum 2L Air' });
    assert.ok(habitId > 0);
    db.logHabit(habitId, 'Sudah minum');
    db.deleteHabit(habitId);

    // Events
    const eventId = db.createEvent({ title: 'QA Event Demo', event_date: '2026-12-31 10:00:00' });
    assert.ok(eventId > 0);
    db.deleteEvent(eventId);

    // Journals
    const journalId = db.createJournal({ content: 'Hari yang produktif', mood: 'senang' });
    assert.ok(journalId > 0);
    db.deleteJournal(journalId);

    // Goals
    const goalId = db.createGoal({ title: 'Capai 100 User', target_value: 100 });
    assert.ok(goalId > 0);
    db.updateGoalProgress(goalId, 50);
    assert.strictEqual(db.getGoalById(goalId).current_value, 50);
    db.deleteGoal(goalId);
  });

  // ============================================================
  // BAGIAN 3: AI ENGINE, RAG CONTEXT & PROMPT FORMATTING
  // ============================================================
  console.log('\n--- [SEKSI 3/6] AI ENGINE, RAG CONTEXT & PROMPT FORMATTING ---');

  const { extractKeywords, buildContext, checkOutOfHours, extractCustomerNameFromReply } = require('../src/ai/context-builder');
  const { loadSystemPrompt } = require('../src/ai/router');

  runTest('AI Context', 'extractKeywords() membersihkan stop words dan karakter khusus', () => {
    const kw = extractKeywords('Halo kak, apakah ada Kopi Arabika Gayo yang ready?');
    assert.ok(kw.includes('kopi'));
    assert.ok(kw.includes('arabika'));
    assert.ok(kw.includes('gayo'));
    assert.ok(!kw.includes('halo'));
    assert.ok(!kw.includes('ada'));
  });

  runTest('AI Context', 'buildContext() menghasilkan RAG context akurat untuk Mode Bisnis', () => {
    const ctx = buildContext('berapa harga kopi arabika?', 'bisnis', '62811223344@c.us');
    assert.ok(ctx.includes('[DATA PRODUK & STOK DARI DATABASE]'));
    assert.ok(ctx.includes('[KONTEKS WAKTU]'));
    assert.ok(ctx.includes('[STATUS PELANGGAN]'));
  });

  runTest('AI Context', 'buildContext() menghasilkan RAG context akurat untuk Mode Personal', () => {
    const ctx = buildContext('rekap pengeluaran bulan ini', 'personal', '62811223344@c.us');
    assert.ok(ctx.includes('[DATA PENGELUARAN DARI DATABASE'));
  });

  runTest('AI Prompts', 'loadSystemPrompt() memuat prompt mode bisnis dengan kustomisasi persona', () => {
    const prompt = loadSystemPrompt('bisnis', {
      business_name: 'Companion Coffee',
      tone_style: 'santai',
      response_length: 'ringkas',
      emoji_level: 'ekspresif'
    });
    assert.ok(prompt.includes('Companion Coffee'));
    assert.ok(prompt.includes('GAYA BICARA: Santai'));
    assert.ok(prompt.includes('PANJANG BALASAN: Ringkas'));
    assert.ok(prompt.includes('PENGGUNAAN EMOJI: Ekspresif'));
    assert.ok(prompt.includes('Respon Sapaan Singkat'));
  });

  runTest('AI Helper', 'extractCustomerNameFromReply() mengekstrak nama dan membersihkan balasan', () => {
    const textWithTag = 'Halo Kak Ahmad! Ada yang bisa kami bantu seputar kopi kami? [CUSTOMER_NAME:Ahmad]';
    const res = extractCustomerNameFromReply(textWithTag);
    assert.strictEqual(res.name, 'Ahmad');
    assert.strictEqual(res.cleanReply, 'Halo Kak Ahmad! Ada yang bisa kami bantu seputar kopi kami?');
    assert.ok(!res.cleanReply.includes('[CUSTOMER_NAME:'));
  });

  // ============================================================
  // BAGIAN 4: WHATSAPP ENGINE PIPELINE & HANDLERS
  // ============================================================
  console.log('\n--- [SEKSI 4/6] WHATSAPP ENGINE PIPELINE & HANDLERS ---');

  const { splitIntoBubbles, calculateInterBubbleDelay } = require('../src/engine/bubble-sender');
  const { isHandoverTriggered } = require('../src/engine/handlers/business-handler');
  const { enqueueIncomingMessage, clearAllBuffers } = require('../src/engine/message-buffer');

  runTest('Engine', 'splitIntoBubbles() memecah pesan secara cerdas dan proporsional', () => {
    const short = 'Kopi Susu ready stok Kak!';
    assert.strictEqual(splitIntoBubbles(short, 3).length, 1);

    const long = 'Halo Kak! Selamat datang di Companion Coffee dan Toko Kopi Pilihan Terbaik.\n\nKami punya beragam varian biji kopi single origin roast segar pilihan terbaik yang baru saja dipanggang minggu ini.\n\nUntuk Kopi Arabika Gayo tersedia ukuran kemasan 250gr (Rp45.000) dan 500gr (Rp85.000).\n\nKakak mau pesan yang kemasan mana? Bisa langsung kami bantu proseskan pesanannya sekarang ya Kak 😊';
    const bubbles = splitIntoBubbles(long, 3);
    assert.ok(bubbles.length >= 2, `Pesan panjang (>250 char) harus dipecah minimal 2 bubble, dapat ${bubbles.length}`);
  });

  runTest('Engine', 'calculateInterBubbleDelay() menghasilkan jeda aman dengan jitter', () => {
    const delay = calculateInterBubbleDelay(2.5, 100);
    assert.ok(delay >= 1000 && delay <= 6000);
  });

  runTest('Engine', 'isHandoverTriggered() mendeteksi kata kunci nego, komplain, dan pola numerik', () => {
    // Negosiasi slang
    assert.strictEqual(isHandoverTriggered('20k dapet ga'), true);
    assert.strictEqual(isHandoverTriggered('25rb boleh gak'), true);
    assert.strictEqual(isHandoverTriggered('nett nya berapa?'), true);
    assert.strictEqual(isHandoverTriggered('pasnya berapa ya kak'), true);
    assert.strictEqual(isHandoverTriggered('bisa tawar ga?'), true);
    // Komplain
    assert.strictEqual(isHandoverTriggered('pesanan saya rusak pecah'), true);
    assert.strictEqual(isHandoverTriggered('bicara dengan admin asli'), true);
    // Pertanyaan normal
    assert.strictEqual(isHandoverTriggered('kopi arabika ready gak?'), false);
    assert.strictEqual(isHandoverTriggered('toko ada di mana?'), false);
  });

  await runTestAsync('Engine', 'Message Buffer menggabungkan multi-bubble dalam rentang debounce', async () => {
    clearAllBuffers();
    const contact = '628999777111@c.us';
    let outputBatch = null;

    enqueueIncomingMessage({ from: contact, body: 'halo min' }, null, async (batch) => {
      outputBatch = batch;
    }, 60);

    await new Promise(r => setTimeout(r, 15));
    enqueueIncomingMessage({ from: contact, body: 'kopi gayo masih ada?' }, null, async (batch) => {
      outputBatch = batch;
    }, 60);

    await new Promise(r => setTimeout(r, 90));

    assert.ok(outputBatch);
    assert.strictEqual(outputBatch.isAggregated, true);
    assert.strictEqual(outputBatch.bubbleCount, 2);
    assert.strictEqual(outputBatch.body, 'halo min\nkopi gayo masih ada?');
  });

  // ============================================================
  // BAGIAN 5: WEB CONTROLLER EJS TEMPLATES & EXPRESS VIEW RENDERING
  // ============================================================
  console.log('\n--- [SEKSI 5/6] WEB CONTROLLER & 25 VIEW TEMPLATES COMPILATION ---');

  const viewsDir = path.join(rootDir, 'src/server/views');

  // Comprehensive mock data untuk menguji kompilasi semua template EJS
  const mockConfig = {
    ...DEFAULT_CONFIG,
    business_name: 'QA Cafe Demo',
    mode: 'bisnis',
    owner_phone: '628123456789',
    gemini_api_key: 'AIzaSy_MOCK_KEY',
    business_hours: '08:00-21:00',
    out_of_hours_mode: 'off',
    customer_debounce_sec: 5,
    enable_auto_followup: true,
    followup_delay_hours: 24,
    followup_template: 'Halo {product_name}'
  };

  const mockStatus = {
    connected: true,
    isReady: true,
    pushname: 'QA Tester',
    formattedNumber: '628123456789'
  };

  const mockLocals = {
    title: 'QA Test Page',
    activeMenu: 'dashboard',
    config: mockConfig,
    status: mockStatus,
    stats: { totalProducts: 10, totalExpenses: 250000, totalChatLogs: 45 },
    products: [{ id: 1, name: 'Kopi QA', price: 25000, stock: 10, category: 'Minuman', sku: 'KOP-01', description: 'Test', related_products: '' }],
    orders: [{ id: 1, contact: '62811@c.us', customer_name: 'Budi', items: 'Kopi', total_amount: 25000, status: 'pending', created_at: '2026-08-19 10:00:00' }],
    customers: [{ contact: '62811@c.us', customer_name: 'Budi', customer_status: 'vip', total_orders: 3, last_order_amount: 75000, notes: '', last_contact_at: '2026-08-19' }],
    faqs: [{ id: 1, trigger_keywords: 'ongkir', question_label: 'Ongkir', answer: 'Gratis ongkir', match_count: 5, is_active: 1 }],
    handovers: [{ id: 1, contact: '62811@c.us', customer_name: 'Budi', trigger_message: 'Nego dong', reason: 'Nego Harga', status: 'pending', created_at: '2026-08-19' }],
    chatLogs: [{ id: 1, contact: '62811@c.us', message_in: 'Halo', message_out: 'Hai', handled_by: 'ai', created_at: '2026-08-19' }],
    logs: [{ id: 1, contact: '62811@c.us', message_in: 'Halo', message_out: 'Hai', handled_by: 'ai', created_at: '2026-08-19' }],
    businessDocs: [{ id: 1, original_filename: 'menu.pdf', created_at: '2026-08-19' }],
    documents: [{ id: 1, original_filename: 'menu.pdf', file_type: 'pdf', created_at: '2026-08-19' }],
    profile: { address: 'Jl. Melati', business_hours: '09:00-21:00' },
    samples: [{ id: 1, user_sample: 'Halo', bot_sample: 'Halo Kak', tag: 'salam', is_active: 1 }],
    expenses: [{ id: 1, category: 'Bahan Baku', amount: 50000, note: 'Beli gula', created_at: '2026-08-19' }],
    totalAmount: 250000,
    categories: ['Bahan Baku', 'Operasional', 'Pemasaran'],
    monthlyTotal: 250000,
    currentYear: 2026,
    currentMonth: '08',
    reminders: [{ id: 1, message: 'Meeting tim', trigger_at: '2026-08-20 09:00:00', is_active: 1, recurrence_type: null }],
    activeCount: 5,
    completedCount: 2,
    oneshotCount: 3,
    recurringCount: 2,
    pausedMap: {},
    analyticsData: {
      totalUserMessages: 120,
      totalOrders: 10,
      totalRevenue: 500000,
      topProducts: [],
      generalStats: { aiHandled: 80, humanHandled: 20 },
      inquiryCategories: [{ label: 'Tanya Produk', count: 15, percentage: 50 }, { label: 'Tanya Ongkir', count: 10, percentage: 33 }],
      hourlyDistribution: new Array(24).fill(0)
    },
    notes: [{ id: 1, title: 'Catatan QA', content: 'Isi note', tags: 'qa', updated_at: '2026-08-19' }],
    todos: [{ id: 1, task: 'Task QA', priority: 'high', is_done: 0, due_date: '2026-08-25', created_at: '2026-08-19' }],
    filter: 'all',
    doneCount: 3,
    budgets: [{ id: 1, category: 'Bahan Baku', monthly_limit: 1000000, alert_at_percent: 80, is_active: 1 }],
    budgetStatuses: [{ id: 1, category: 'Bahan Baku', monthly_limit: 1000000, alert_at_percent: 80, spent: 250000, percentage: 25, is_over_limit: false, is_near_limit: false }],
    habits: [{ id: 1, name: 'Olahraga', streak: { current: 3, best: 5 }, streak_current: 3, streak_best: 5, is_active: 1, loggedToday: true }],
    events: [{ id: 1, title: 'Demo Produk', event_date: '2026-08-30 14:00:00', location: 'Zoom' }],
    journals: [{ id: 1, content: 'Catatan harian', mood: 'senang', tags: 'kerja', journal_date: '2026-08-19' }],
    streak: 3,
    goals: [{ id: 1, title: '100 Penjualan', target_value: 100, current_value: 40, status: 'active', deadline: '2026-12-31' }],
    analytics: { totalRevenue: 500000, totalOrders: 10, totalCustomers: 8, topProducts: [] },
    selectedDays: 7,
    aiInsight: 'Pertahankan penjualan produk terlaris!',
    optouts: [{ contact: '62899@c.us', reason: 'Stop', created_at: '2026-08-19' }],
    pendingHandoverCount: 1,
    todayAiCount: 12,
    pagination: { page: 1, totalPages: 1 },
    currentPage: 1,
    totalPages: 1,
    currentStatusFilter: '',
    currentFilter: 'pending',
    filterContact: '',
    thisMonthTotal: 250000,
    recurringCount: 2,
    filteredTodos: [{ id: 1, task: 'Task QA', priority: 'high', is_done: 0, due_date: '2026-08-25', created_at: '2026-08-19' }],
    latestInsight: { generatedAt: '2026-08-19 10:00:00' },
    search: '',
    query: {},
    error: null,
    success: null,
    qrCode: 'data:image/png;base64,mockqr',
    step: 1
  };

  const allViews = [
    // Dashboard views
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
    // Setup views
    'setup/step-1-mode.ejs',
    'setup/step-2-qr.ejs',
    'setup/step-3-api-key.ejs',
    'setup/step-4-initial-data.ejs'
  ];

  for (const viewRelPath of allViews) {
    const fullViewPath = path.join(viewsDir, viewRelPath);
    runTest('Views', `Template EJS "${viewRelPath}" harus bisa di-compile tanpa error`, () => {
      assert.ok(fs.existsSync(fullViewPath), `File template ${viewRelPath} tidak ditemukan`);
      const templateContent = fs.readFileSync(fullViewPath, 'utf-8');
      
      // Compile template dengan engine ejs
      const compiled = ejs.compile(templateContent, {
        filename: fullViewPath,
        root: viewsDir
      });
      
      // Render dengan mock data untuk verifikasi sintaks dan variabel
      const renderedHtml = compiled(mockLocals);
      assert.ok(renderedHtml.length > 0, `Hasil render ${viewRelPath} kosong`);
    });
  }

  // ============================================================
  // BAGIAN 6: ERROR HANDLING & EDGE CASES
  // ============================================================
  console.log('\n--- [SEKSI 6/6] RESILIENSI, ERROR HANDLING & EDGE CASES ---');

  runTest('Resilience', 'Database connection tetap aman bila dipanggil query kosong / salah parameter', () => {
    assert.strictEqual(db.getSetting('non_existent_key_999'), null);
    assert.strictEqual(db.getProductById(-999), null);
    assert.strictEqual(db.matchFaq(''), null);
    assert.strictEqual(db.matchFaq(null), null);
  });

  runTest('Resilience', 'splitIntoBubbles() menangani input null, undefined, atau string kosong', () => {
    assert.deepStrictEqual(splitIntoBubbles(''), []);
    assert.deepStrictEqual(splitIntoBubbles(null), []);
    assert.deepStrictEqual(splitIntoBubbles(undefined), []);
  });

  runTest('Resilience', 'isHandoverTriggered() menangani string kosong / null tanpa crash', () => {
    assert.strictEqual(isHandoverTriggered(''), false);
    assert.strictEqual(isHandoverTriggered(null), false);
    assert.strictEqual(isHandoverTriggered(undefined), false);
  });

  runTest('Resilience', 'checkOutOfHours() aman saat business_hours tidak diatur', () => {
    const res = checkOutOfHours('');
    assert.strictEqual(res.isOutOfHours, false);
  });

  // ============================================================
  // RINGKASAN AKHIR MASTER QA AUDIT
  // ============================================================
  console.log('\n================================================================');
  console.log(`  📊 HASIL MASTER QA AUDIT: ${passedTests} LULUS / ${totalTests} TOTAL`);
  if (failedTests > 0) {
    console.log(`  ❌ TERDAPAT ${failedTests} TEST YANG GAGAL.`);
    console.log('================================================================\n');
    process.exit(1);
  } else {
    console.log('  🎉 STATUS: 100% LULUS — SELURUH SISTEM SIAP DIRILIS / DI-PUSH!');
    console.log('================================================================\n');
    process.exit(0);
  }
})();
