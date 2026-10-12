const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const assert = require('assert');

const VIEWS_DIR = path.resolve(__dirname, '../src/server/views');
const { getConfig, getEditionInfo } = require('../src/config');
const db = require('../src/db');

console.log('======================================================');
console.log('  🧪 TESTING ALL EJS TEMPLATES RENDERING RESILIENCE  ');
console.log('======================================================\n');

function getAllEjsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllEjsFiles(filePath, fileList);
    } else if (file.endsWith('.ejs')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const ejsFiles = getAllEjsFiles(VIEWS_DIR);
console.log(`Ditemukan ${ejsFiles.length} file template EJS.\n`);

const mockContexts = [
  {
    name: 'Bisnis Mode - Fresh / Setup Step 1',
    data: {
      title: 'Setup Step 1',
      currentStep: 1,
      config: { mode: 'bisnis', gemini_api_key: '', is_setup_completed: false },
      editionInfo: { isModeLocked: true, defaultMode: 'bisnis', edition: 'bisnis' },
      isBusiness: true,
      isPersonal: false,
      isDual: false,
      error: null,
      fingerprint: 'HWID-TEST-1234',
      licenseInfo: { isValid: true },
      status: { state: 'disconnected', info: {} },
      activeMenu: 'dashboard',
      stats: { totalProducts: 0, totalExpenses: 0, totalChatLogs: 0 },
      products: [],
      expenses: [],
      totalAmount: 0,
      thisMonthTotal: 0,
      optouts: [],
      success: null,
      analyticsData: {},
      latestInsight: null,
      selectedDays: 30,
      isGenerated: false,
      chatLogs: [],
      logs: [],
      contacts: [],
      customers: [],
      pendingHandoverCount: 0,
      todayAiCount: 0,
      customerProfiles: [],
      faqs: [],
      orders: [],
      currentStatusFilter: null,
      followUps: [],
      reminders: [],
      activeCount: 0,
      recurringCount: 0,
      oneshotCount: 0,
      filter: 'all',
      doneCount: 0,
      currentFilter: 'pending',
      streak: 0,
      notes: [],
      todos: [],
      filteredTodos: [],
      handovers: [],
      samples: [],
      budgets: [],
      habits: [],
      events: [],
      journals: [],
      goals: []
    }
  },
  {
    name: 'Bisnis Mode - After Step 3 (API Key entered)',
    data: {
      title: 'Setup Step 4',
      currentStep: 4,
      config: { mode: 'bisnis', gemini_api_key: 'AIzaSyTestKey123', is_setup_completed: false },
      editionInfo: { isModeLocked: true, defaultMode: 'bisnis', edition: 'bisnis' },
      isBusiness: true,
      isPersonal: false,
      isDual: false,
      error: null,
      fingerprint: 'HWID-TEST-1234',
      licenseInfo: { isValid: true },
      status: { state: 'ready', info: { pushname: 'Toko Test', phone: '62812345678' } },
      activeMenu: 'settings',
      stats: { totalProducts: 5, totalExpenses: 0, totalChatLogs: 10 },
      products: [],
      expenses: [],
      totalAmount: 0,
      thisMonthTotal: 0,
      optouts: [],
      success: null,
      analyticsData: {},
      latestInsight: null,
      selectedDays: 30,
      isGenerated: false,
      chatLogs: [],
      logs: [],
      contacts: [],
      customers: [],
      pendingHandoverCount: 0,
      todayAiCount: 0,
      customerProfiles: [],
      faqs: [],
      orders: [],
      currentStatusFilter: null,
      followUps: [],
      reminders: [],
      activeCount: 0,
      recurringCount: 0,
      oneshotCount: 0,
      filter: 'all',
      doneCount: 0,
      currentFilter: 'pending',
      streak: 0,
      notes: [],
      todos: [],
      filteredTodos: [],
      handovers: [],
      samples: [],
      budgets: [],
      habits: [],
      events: [],
      journals: [],
      goals: []
    }
  },
  {
    name: 'Personal Mode - Setup & Dashboard',
    data: {
      title: 'Dashboard Personal',
      currentStep: 4,
      config: { mode: 'personal', gemini_api_key: 'AIzaSyTestKey123', is_setup_completed: true },
      editionInfo: { isModeLocked: true, defaultMode: 'personal', edition: 'personal' },
      isBusiness: false,
      isPersonal: true,
      isDual: false,
      error: null,
      fingerprint: 'HWID-TEST-1234',
      licenseInfo: { isValid: true },
      status: { state: 'ready', info: { pushname: 'User', phone: '628999999' } },
      activeMenu: 'dashboard',
      stats: { totalProducts: 0, totalExpenses: 50000, totalChatLogs: 5 },
      products: [],
      expenses: [],
      totalAmount: 0,
      thisMonthTotal: 0,
      optouts: [],
      success: null,
      analyticsData: {},
      latestInsight: null,
      selectedDays: 30,
      isGenerated: false,
      chatLogs: [],
      logs: [],
      contacts: [],
      customers: [],
      pendingHandoverCount: 0,
      todayAiCount: 0,
      customerProfiles: [],
      faqs: [],
      orders: [],
      currentStatusFilter: null,
      followUps: [],
      reminders: [],
      activeCount: 0,
      recurringCount: 0,
      oneshotCount: 0,
      filter: 'all',
      doneCount: 0,
      currentFilter: 'pending',
      streak: 0,
      notes: [],
      todos: [],
      filteredTodos: [],
      handovers: [],
      samples: [],
      budgets: [],
      habits: [],
      events: [],
      journals: [],
      goals: []
    }
  }
];

let totalRenderedTests = 0;
let passedRenderedTests = 0;

for (const ejsFile of ejsFiles) {
  const relPath = path.relative(VIEWS_DIR, ejsFile).replace(/\\/g, '/');
  // Skip partials from direct root rendering test as they expect specific caller variables
  if (relPath.startsWith('partials/')) continue;

  const content = fs.readFileSync(ejsFile, 'utf-8');

  for (const ctx of mockContexts) {
    totalRenderedTests++;
    try {
      ejs.render(content, ctx.data, { filename: ejsFile });
      passedRenderedTests++;
    } catch (err) {
      console.error(`❌ [RENDER FAIL] ${relPath} under context "${ctx.name}":`);
      console.error(`   Error: ${err.message}\n`);
    }
  }
}

console.log(`\n======================================================`);
console.log(`  📊 HASIL RENDERING: ${passedRenderedTests} / ${totalRenderedTests} LULUS`);
console.log(`======================================================\n`);

if (passedRenderedTests === totalRenderedTests) {
  console.log('🎉 SELURUH TEMPLATE EJS VALID & DAPAT DI-RENDER TANPA ERROR!');
  process.exit(0);
} else {
  console.error('⚠️ DITEMUKAN TEMPLATE DENGAN SYNTAX/REFERENCE ERROR!');
  process.exit(1);
}
