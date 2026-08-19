const db = require('../db');
const { getConfig } = require('../config');

/**
 * Cek apakah pengeluaran di kategori tertentu sudah mendekati atau melebihi budget.
 * Dipanggil setelah setiap expense baru dicatat.
 * @param {string} category Kategori pengeluaran yang baru dicatat
 * @param {import('whatsapp-web.js').Client} client WhatsApp client
 * @param {string} contact Nomor kontak user
 * @returns {string|null} Pesan warning jika ada, null jika tidak
 */
async function checkBudgetAfterExpense(category, client, contact) {
  try {
    // Cari budget untuk kategori ini
    const budget = db.getBudgetByCategory ? db.getBudgetByCategory(category) : null;
    if (!budget) return null;

    // Hitung total pengeluaran bulan ini untuk kategori ini
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const monthlyExpenses = db.getMonthlyExpenses ? db.getMonthlyExpenses(year, month) : [];
    const categoryTotal = monthlyExpenses
      .filter(e => e.category && e.category.toLowerCase() === category.toLowerCase())
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const percent = Math.round((categoryTotal / budget.monthly_limit) * 100);
    const remaining = budget.monthly_limit - categoryTotal;
    const daysLeft = daysRemainingInMonth();

    let warningMsg = null;

    if (percent >= 100) {
      warningMsg = `🚨 *OVER BUDGET!*\n\n📊 Kategori: *${category}*\n💸 Terpakai: Rp${categoryTotal.toLocaleString('id-ID')} / Rp${budget.monthly_limit.toLocaleString('id-ID')}\n📈 Status: *${percent}%* — Melebihi anggaran!\n\n_Pertimbangkan untuk mengurangi pengeluaran di kategori ini._`;
    } else if (percent >= budget.alert_at_percent) {
      warningMsg = `⚠️ *Peringatan Budget*\n\n📊 Kategori: *${category}*\n💸 Terpakai: Rp${categoryTotal.toLocaleString('id-ID')} / Rp${budget.monthly_limit.toLocaleString('id-ID')}\n📈 Status: *${percent}%*\n💰 Sisa: Rp${remaining.toLocaleString('id-ID')} untuk ${daysLeft} hari lagi\n\n_Hati-hati ya, budget hampir habis!_`;
    }

    // Kirim warning ke WhatsApp jika perlu
    if (warningMsg && client && typeof client.sendMessage === 'function') {
      try {
        const targetJid = contact.includes('@') ? contact : `${contact}@c.us`;
        await client.sendMessage(targetJid, warningMsg);
      } catch (err) {
        console.error('[BudgetChecker] Gagal kirim warning:', err.message);
      }
    }

    return warningMsg;
  } catch (err) {
    console.error('[BudgetChecker] Error:', err.message);
    return null;
  }
}

/**
 * Ambil status semua budget dengan perhitungan persentase saat ini.
 * @returns {Array<object>}
 */
function getAllBudgetStatus() {
  try {
    const budgets = db.getAllBudgets ? db.getAllBudgets() : [];
    if (budgets.length === 0) return [];

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthlyExpenses = db.getMonthlyExpenses ? db.getMonthlyExpenses(year, month) : [];
    const daysLeft = daysRemainingInMonth();

    return budgets.map(b => {
      const spent = monthlyExpenses
        .filter(e => e.category && e.category.toLowerCase() === b.category.toLowerCase())
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const percent = b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
      const remaining = b.monthly_limit - spent;

      return {
        ...b,
        spent,
        percent,
        remaining,
        daysLeft,
        status: percent >= 100 ? 'over' : percent >= b.alert_at_percent ? 'warning' : 'safe'
      };
    });
  } catch (err) {
    console.error('[BudgetChecker] Error getAllBudgetStatus:', err.message);
    return [];
  }
}

/**
 * Hitung sisa hari dalam bulan berjalan.
 * @returns {number}
 */
function daysRemainingInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

module.exports = {
  checkBudgetAfterExpense,
  getAllBudgetStatus,
  daysRemainingInMonth
};
