const db = require('../db');
const { getConfig } = require('../config');

/**
 * Mengubah URL Google Sheets (tampilan biasa / sharing) menjadi URL export CSV langsung.
 * @param {string} rawUrl 
 * @returns {string}
 */
function normalizeSheetsUrl(rawUrl = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const clean = rawUrl.trim();

  // Jika sudah berformat CSV export / gviz / output=csv
  if (clean.includes('output=csv') || clean.includes('format=csv') || clean.includes('tqx=out:csv')) {
    return clean;
  }

  // Pola URL Google Sheets: /spreadsheets/d/{ID}/...
  const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    const sheetId = match[1];
    
    // Ambil gid jika ada (misal sheet tab kedua: #gid=123456)
    const gidMatch = clean.match(/[#&?]gid=([0-9]+)/);
    const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';

    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gidParam}`;
  }

  return clean;
}

/**
 * Parser CSV ringan dan andal yang mendukung field berkutip, koma, dan karakter khusus.
 * @param {string} csvText 
 * @returns {Array<string[]>}
 */
function parseCsvRows(csvText = '') {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // lewati escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        // Abaikan \r
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Memetakan baris-baris CSV menjadi objek data produk berdasarkan nama header kolom.
 * @param {Array<string[]>} rows 
 * @returns {Array<object>}
 */
function mapCsvToProducts(rows) {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const products = [];

  // Temukan indeks kolom dengan toleransi variasi penamaan header
  const getIndex = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));

  const skuIdx = getIndex(['sku', 'kode', 'code', 'id_produk']);
  const nameIdx = getIndex(['nama', 'name', 'produk', 'item', 'judul']);
  const catIdx = getIndex(['kategori', 'category', 'jenis', 'tipe', 'group']);
  const priceIdx = getIndex(['harga', 'price', 'nominal', 'biaya']);
  const stockIdx = getIndex(['stok', 'stock', 'qty', 'jumlah', 'sisa']);
  const descIdx = getIndex(['deskripsi', 'description', 'keterangan', 'ket']);
  const knowledgeIdx = getIndex(['knowledge', 'product_knowledge', 'keunggulan', 'manfaat', 'faq', 'detail']);
  const imgIdx = getIndex(['gambar', 'image', 'foto', 'link_gambar', 'url']);

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = nameIdx !== -1 ? row[nameIdx] : (row[1] || row[0]);
    if (!name || name.trim() === '') continue;

    // Bersihkan format harga (misal: "Rp 25.000" -> 25000)
    let rawPrice = priceIdx !== -1 ? row[priceIdx] : '0';
    const cleanPrice = parseInt(String(rawPrice).replace(/[^0-9]/g, ''), 10) || 0;

    // Bersihkan stok
    let rawStock = stockIdx !== -1 ? row[stockIdx] : '0';
    const cleanStock = parseInt(String(rawStock).replace(/[^0-9]/g, ''), 10) || 0;

    products.push({
      sku: skuIdx !== -1 ? row[skuIdx] : null,
      name: name.trim(),
      category: catIdx !== -1 && row[catIdx] ? row[catIdx].trim() : 'Umum',
      price: cleanPrice,
      stock: cleanStock,
      description: descIdx !== -1 && row[descIdx] ? row[descIdx].trim() : '',
      product_knowledge: knowledgeIdx !== -1 && row[knowledgeIdx] ? row[knowledgeIdx].trim() : '',
      image_path: imgIdx !== -1 && row[imgIdx] ? row[imgIdx].trim() : null
    });
  }

  return products;
}

/**
 * Mengambil CSV dari Google Sheets dan menyinkronkan data ke database SQLite lokal.
 * @param {string} [customUrl] 
 * @returns {Promise<{success: boolean, message: string, total: number, added: number, updated: number, errors: string[]}>}
 */
async function syncProductsFromSheets(customUrl = null) {
  const config = getConfig();
  const rawUrl = customUrl || config.sheets_url;

  if (!rawUrl || rawUrl.trim() === '') {
    return {
      success: false,
      message: 'URL Google Sheets belum diatur di pengaturan.',
      total: 0,
      added: 0,
      updated: 0,
      errors: ['EMPTY_SHEETS_URL']
    };
  }

  const exportUrl = normalizeSheetsUrl(rawUrl);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(exportUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        success: false,
        message: `Gagal mengunduh spreadsheet (HTTP ${res.status}). Pastikan spreadsheet disetel "Siapa saja yang memiliki link dapat melihat".`,
        total: 0,
        added: 0,
        updated: 0,
        errors: [`HTTP_${res.status}`]
      };
    }

    const csvText = await res.text();
    const rows = parseCsvRows(csvText);
    const parsedProducts = mapCsvToProducts(rows);

    if (parsedProducts.length === 0) {
      return {
        success: false,
        message: 'Spreadsheet berhasil dibaca, namun tidak ditemukan baris produk yang valid.',
        total: 0,
        added: 0,
        updated: 0,
        errors: ['NO_PRODUCTS_FOUND']
      };
    }

    let addedCount = 0;
    let updatedCount = 0;

    for (const prod of parsedProducts) {
      const result = db.upsertProductFromSheet(prod);
      if (result.action === 'added') addedCount++;
      else if (result.action === 'updated') updatedCount++;
    }

    return {
      success: true,
      message: `Berhasil sinkronisasi ${parsedProducts.length} produk (${addedCount} baru, ${updatedCount} diperbarui)!`,
      total: parsedProducts.length,
      added: addedCount,
      updated: updatedCount,
      errors: []
    };
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return {
      success: false,
      message: isTimeout ? 'Koneksi ke Google Sheets timeout (15 detik).' : `Error: ${err.message}`,
      total: 0,
      added: 0,
      updated: 0,
      errors: [err.message]
    };
  }
}

let autoSyncTimer = null;
let lastSyncTimestamp = 0;

/**
 * Menjalankan scheduler sinkronisasi otomatis Google Sheets di background.
 */
function startAutoSyncScheduler() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);

  // Periksa setiap 1 menit apakah perlu sync otomatis
  autoSyncTimer = setInterval(async () => {
    try {
      const config = getConfig();
      if (!config.sheets_auto_sync || !config.sheets_url) return;

      const intervalMs = (Math.max(1, Number(config.sheets_sync_interval) || 10)) * 60 * 1000;
      const now = Date.now();

      if (now - lastSyncTimestamp >= intervalMs) {
        lastSyncTimestamp = now;
        console.log('[SheetsSync] Menjalankan sinkronisasi otomatis Google Sheets di background...');
        const result = await syncProductsFromSheets(config.sheets_url);
        console.log(`[SheetsSync] ${result.message}`);
      }
    } catch (_) {}
  }, 60 * 1000);
}

module.exports = {
  normalizeSheetsUrl,
  parseCsvRows,
  mapCsvToProducts,
  syncProductsFromSheets,
  startAutoSyncScheduler
};
