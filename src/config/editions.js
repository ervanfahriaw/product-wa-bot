/**
 * Metadata dan Definisi Edisi Produk (Product Flavor / Edition)
 * Mendukung pemisahan komersial: WA Bot Bisnis, WA Asisten Pribadi, atau Dual Edition.
 */

const EDITIONS = {
  bisnis: {
    id: 'bisnis',
    name: 'WA Bot Bisnis AI',
    shortName: 'WA Bot Bisnis',
    tagline: 'Asisten Penjualan & Customer Service 24/7',
    defaultMode: 'bisnis',
    isModeLocked: true,
    features: [
      'analytics',
      'products',
      'customers',
      'orders',
      'faqs',
      'knowledge',
      'handovers',
      'follow_ups',
      'sheets_sync'
    ],
    dbTables: [
      'settings',
      'products',
      'orders',
      'customer_profiles',
      'faqs',
      'business_documents',
      'manual_handovers',
      'chat_logs',
      'follow_ups',
      'follow_up_optouts',
      'contact_states',
      'conversation_samples'
    ],
    migrations: [
      '006-customer-profiles.js',
      '007-faqs.js',
      '008-orders.js',
      '009-follow-ups.js'
    ],
    theme: {
      primaryColor: '#059669', // Emerald
      badgeText: 'Bisnis Edition',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  },
  personal: {
    id: 'personal',
    name: 'WA Asisten Pribadi AI',
    shortName: 'WA Asisten Pribadi',
    tagline: 'Manajemen Keuangan, Produktivitas & Jadwal Harian',
    defaultMode: 'personal',
    isModeLocked: true,
    features: [
      'expenses',
      'budgets',
      'reminders',
      'todos',
      'notes',
      'habits',
      'events',
      'journals',
      'goals',
      'export'
    ],
    dbTables: [
      'settings',
      'expenses',
      'budgets',
      'reminders',
      'todos',
      'notes',
      'habits',
      'habit_logs',
      'events',
      'journals',
      'goals',
      'chat_logs',
      'contact_states',
      'conversation_samples'
    ],
    migrations: [
      '001-reminders-upgrade.js',
      '002-notes-todos.js',
      '003-budgets.js',
      '004-habits.js',
      '005-events-journals-goals.js'
    ],
    theme: {
      primaryColor: '#4F46E5', // Indigo
      badgeText: 'Personal Edition',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    }
  },
  all: {
    id: 'all',
    name: 'WA Bot Assistant (Dual Edition)',
    shortName: 'WA Bot Assistant',
    tagline: 'Solusi Lengkap Bisnis & Asisten Pribadi',
    defaultMode: null,
    isModeLocked: false,
    features: [
      'analytics',
      'products',
      'customers',
      'orders',
      'faqs',
      'knowledge',
      'handovers',
      'follow_ups',
      'sheets_sync',
      'expenses',
      'budgets',
      'reminders',
      'todos',
      'notes',
      'habits',
      'events',
      'journals',
      'goals',
      'export'
    ],
    dbTables: '*', // Semua tabel
    migrations: '*', // Semua migrasi
    theme: {
      primaryColor: '#18181B', // Zinc
      badgeText: 'Dual Edition',
      badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-200'
    }
  }
};

/**
 * Mendapatkan definisi edisi berdasarkan key ('bisnis' | 'personal' | 'all')
 * @param {string} key 
 * @returns {object}
 */
function getEditionDefinition(key) {
  const normalizedKey = (key || '').toLowerCase().trim();
  return EDITIONS[normalizedKey] || EDITIONS.all;
}

module.exports = {
  EDITIONS,
  getEditionDefinition
};
