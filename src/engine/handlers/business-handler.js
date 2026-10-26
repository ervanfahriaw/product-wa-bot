const path = require('path');
const fs = require('fs');
let MessageMedia;
try {
  ({ MessageMedia } = require('whatsapp-web.js'));
} catch (_) {}

const db = require('../../db');
const { getConfig } = require('../../config');
const { generateReply } = require('../../ai');
const { checkOutOfHours, extractCustomerNameFromReply } = require('../../ai/context-builder');
const { toWhatsAppJid, normalizePhoneNumber } = require('../../utils/phone');

const HANDOVER_KEYWORDS = [
  // Negosiasi / Tawar harga
  'nego', 'tawar', 'diskon', 'potongan', 'grosir', 'bisa kurang', 'bisa tawar', 'harga pas', 'kurangin', 'turunin harga',
  'dapet ga', 'dapet gak', 'dapet berapa', 'bisa dapet', 'boleh dapet', 'pasnya', 'pas nya', 'nett', 'net',
  'boleh kurang', 'kurang ga', 'kurang gak', 'kemahalan', 'murahin', 'harga mahasiswa', 'bisa turun', 'kurang dikit',
  'kurang dong', 'bisa korting', 'korting', 'cashback khusus', 'harga teman',
  // Komplain / Keluhan produk
  'komplain', 'keluhan', 'rusak', 'pecah', 'cacat', 'retur', 'refund', 'kembalikan dana', 'basi', 'apek', 'diare', 'mules',
  'salah kirim', 'kurang barang', 'tidak sesuai', 'kecewa', 'penipu',
  // Permintaan admin / manusia
  'bicara dengan admin', 'bicara dengan manusia', 'bicara dengan pemilik', 'bicara sama owner', 'ngomong sama owner',
  'bicara sama admin', 'ngomong sama admin', 'chat admin', 'hubungi admin', 'sambungkan admin', 'bicara langsung',
  'admin asli', 'orang asli', 'hubungkan ke admin', 'hubungkan ke owner', 'owner toko', 'sambungkan ke admin', 'mau admin',
  'admin manusia', 'bantuan manusia', 'cs manusia', 'operator asli',
  // Pembayaran / Rekening khusus
  'minta nomor rekening', 'nomor rekening', 'rekening transfer', 'rekening pribadi'
];

const NEGO_PATTERNS = [
  /\b\d+\s*(k|rb|ribu)?\s*(dapet|bisa|boleh|dapet gak|dapet ga|angkut|bungkus|gas)\b/i,
  /\b(bisa|boleh|dapet)\s*\d+\s*(k|rb|ribu)\b/i,
  /\b(harga|budget|dana)\s*(cuma|hanya|pas|ada)?\s*\d+\s*(k|rb|ribu)\b/i,
  /\b(kurangin|turunin)\s*(jadi|ke)?\s*\d+\s*(k|rb|ribu)\b/i,
  /(bicara|ngomong|tanya|hubungi|chat|sambung)\s*(langsung)?\s*(sama|dengan|ke)?\s*(admin|owner|pemilik|manusia|cs|operator)/i
];

/**
 * Memeriksa apakah fitur Handover sedang aktif di pengaturan.
 * @param {object} [config] 
 * @returns {boolean}
 */
function isHandoverEnabled(config = null) {
  const setting = db.getSetting ? db.getSetting('handover_enabled') : null;
  if (setting !== null && setting !== undefined && setting !== '') {
    return setting === 'true' || setting === '1' || setting === 'on' || setting === true;
  }
  const cfg = config || getConfig();
  return cfg.handover_enabled !== false;
}

/**
 * Menentukan apakah pesan membutuhkan pengalihan ke manusia (human handover).
 * @param {string} messageText 
 * @param {boolean} isAiHandover 
 * @param {object|null} [config]
 * @returns {boolean}
 */
function isHandoverTriggered(messageText = '', isAiHandover = false, config = null) {
  // Jika fitur Handover dinonaktifkan di pengaturan, jangan pernah trigger handover
  if (!isHandoverEnabled(config)) {
    return false;
  }

  if (isAiHandover) return true;
  const lower = (messageText || '').toLowerCase().trim();
  if (!lower) return false;

  // 1. Keyword check
  if (HANDOVER_KEYWORDS.some(kw => lower.includes(kw))) {
    return true;
  }

  // 2. Regex pattern check
  if (NEGO_PATTERNS.some(regex => regex.test(lower))) {
    return true;
  }

  return false;
}

/**
 * Menjalankan aksi handover: jeda bot untuk kontak, catat tiket di antrean, dan beri tahu owner.
 * @param {string} contact 
 * @param {string} messageBody 
 * @param {string} reason 
 * @param {any} client 
 * @param {object} config 
 */
async function triggerHandoverActions(contact, messageBody, reason, client, config, message = null) {
  // 1. Otomatis pause bot untuk kontak ini selama 2 jam agar obrolan manual owner tidak tersela
  db.pauseContact(contact, 2, reason || 'Handover Nego Harga / Kebutuhan Owner');
  console.log(`[BusinessHandler] Bot otomatis DIJEDA 2 jam untuk kontak ${contact}.`);

  // 2. Catat tiket antrean di tabel manual_handovers untuk dipantau di Inbox Dashboard
  if (db.appendOrUpdateHandoverTicket) {
    try {
      db.appendOrUpdateHandoverTicket(contact, messageBody, reason || 'Nego Harga / Permintaan Khusus / Komplain');
    } catch (_) {}
  } else if (db.createHandoverTicket) {
    try {
      db.createHandoverTicket({
        contact,
        customer_name: null,
        trigger_message: messageBody,
        reason: reason || 'Nego Harga / Permintaan Khusus / Komplain'
      });
    } catch (_) {}
  }

  // 3. Kirim notifikasi ke nomor owner
  const ownerPhone = db.getSetting('owner_phone') || config.owner_phone;
  if (ownerPhone && client && typeof client.sendMessage === 'function') {
    const cleanPhone = normalizePhoneNumber(ownerPhone);
    const targetJid = toWhatsAppJid(ownerPhone);

    const customerInfo = await resolveCustomerInfo(message, contact);
    const customerDisplay = customerInfo.formattedDisplay || 'Pelanggan';

    if (targetJid && cleanPhone.length >= 9) {
      const handoverNotice = `🔔 *[NOTIFIKASI HANDOVER - WA BOT]*\n\n` +
        `Pelanggan: *${customerDisplay}* membutuhkan penanganan langsung oleh Admin / Owner:\n\n` +
        `💬 *Pesan Pelanggan:* "${messageBody}"\n` +
        `⚠️ *Status:* ${reason || 'Nego Harga / Permintaan Khusus / Komplain'}\n\n` +
        `👉 *Bot telah OTOMATIS DIJEDA (PAUSED)* untuk kontak ini selama 2 jam agar obrolan manual Anda tidak tertimpa bot.\n\n` +
        `💡 *Kontrol via WA:* Balas chat ini dengan \`!selesai\` atau \`!aktifkan\` jika sudah selesai melayani.`;
      
      try {
        let finalJid = targetJid;
        if (typeof client.getNumberId === 'function') {
          const numberId = await client.getNumberId(cleanPhone).catch(() => null);
          if (numberId && numberId._serialized) {
            finalJid = numberId._serialized;
          }
        }
        await client.sendMessage(finalJid, handoverNotice);
        console.log(`[BusinessHandler] Notifikasi handover terkirim ke owner (${finalJid}) untuk pelanggan ${customerDisplay}.`);
      } catch (hErr) {
        console.error('[BusinessHandler] Gagal mengirim notifikasi handover ke owner:', hErr.message);
      }
    }
  }
}

const { BASE_DIR, UPLOADS_DIR } = require('../../utils/paths');
const { resolveCustomerInfo, formatCustomerDisplay } = require('../../utils/contact-resolver');
const { 
  normalizeImageUrl, 
  downloadAndCacheImage, 
  resolveProductImageResource 
} = require('../../utils/image-downloader');

/**
 * Menyelesaikan path fisik atau URL gambar produk dari database.
 * @param {string} imagePath 
 * @returns {string|null} Path lokal atau URL yang dinormalisasi
 */
function resolveProductImagePath(imagePath) {
  if (!imagePath) return null;
  const res = resolveProductImageResource(imagePath);
  if (res) {
    return res.isUrl ? res.url : res.fullPath;
  }
  return null;
}

const VALID_MIN_JPEG_BUFFER = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
  0x00, 0x60, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
  0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
  0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
  0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
  0x00, 0xBF, 0x80, 0xFF, 0xD9
]);

/**
 * Menghasilkan objek MessageMedia yang siap dikirim oleh WhatsApp Web,
 * mendukung baik file lokal di disk maupun tautan URL remote (Google Drive / HTTP).
 * @param {string} filePathOrUrl 
 * @returns {Promise<object|null>}
 */
async function createMessageMediaFromFile(filePathOrUrl) {
  if (!filePathOrUrl) return null;

  let localPath = filePathOrUrl;

  // Jika berupa URL, unduh & simpan ke cache lokal terlebih dahulu
  if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
    try {
      const cached = await downloadAndCacheImage(filePathOrUrl);
      if (cached && fs.existsSync(cached)) {
        localPath = cached;
      }
    } catch (err) {
      console.warn('[BusinessHandler] Gagal mengunduh gambar remote:', err.message);
    }
  }

  if (!localPath || !fs.existsSync(localPath)) return null;

  try {
    const fileBuffer = fs.readFileSync(localPath);
    const base64Data = fileBuffer.toString('base64');
    const ext = path.extname(localPath).toLowerCase();
    let mime = 'image/jpeg';
    if (ext === '.png') mime = 'image/png';
    else if (ext === '.webp') mime = 'image/webp';
    else if (ext === '.gif') mime = 'image/gif';
    const filename = path.basename(localPath);

    let mediaObj = null;
    if (MessageMedia) {
      try {
        mediaObj = new MessageMedia(mime, base64Data, filename);
      } catch (_) {}
    }
    if (!mediaObj) {
      mediaObj = { mimetype: mime, data: base64Data, filename };
    }

    // Sematkan Buffer binary, mimetype presisi, dan filePath untuk engine Baileys & WWebJS
    mediaObj.buffer = fileBuffer;
    mediaObj.filePath = localPath;
    mediaObj.mimetype = mime;
    mediaObj.data = base64Data;
    mediaObj.filename = filename;
    mediaObj.thumbnail = (mime === 'image/jpeg' && fileBuffer.length <= 48 * 1024) ? fileBuffer : VALID_MIN_JPEG_BUFFER;

    return mediaObj;
  } catch (err) {
    console.error('[BusinessHandler] Gagal membuat MessageMedia:', err.message);
    return null;
  }
}

// Cache pengiriman gambar produk per kontak: Map<contact, Map<productId, timestamp>>
const sentProductImageCache = new Map();

/**
 * Menghitung jarak Levenshtein antara dua string (untuk toleransi typo).
 * @param {string} s1 
 * @param {string} s2 
 * @returns {number}
 */
function levenshteinDistance(s1 = '', s2 = '') {
  if (!s1 || !s2) return (s1 || '').length + (s2 || '').length;
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Memeriksa apakah dua kata memiliki kemiripan fonetik/teks tinggi (toleransi typo).
 * @param {string} w1 
 * @param {string} w2 
 * @returns {boolean}
 */
function isWordSimilar(w1 = '', w2 = '') {
  if (w1 === w2) return true;
  if (!w1 || !w2) return false;
  if (w1.length < 3 || w2.length < 3) return false;
  if (w1.includes(w2) || w2.includes(w1)) return true;
  const maxLen = Math.max(w1.length, w2.length);
  const dist = levenshteinDistance(w1, w2);
  return (1 - dist / maxLen) >= 0.70; // 70% threshold kemiripan (misal: "maringgi" vs "maranggi" = 87.5%)
}

/**
 * Mencatat waktu pengiriman gambar produk ke kontak tertentu.
 * Menyimpan berdasarkan ID dan Nama Produk agar tidak ada celah spam.
 * @param {string} contact 
 * @param {number|string} productId 
 * @param {string} [productName]
 */
function recordSentProductImage(contact, productId, productName = '') {
  if (!contact) return;
  let map = sentProductImageCache.get(contact);
  if (!map) {
    map = new Map();
    sentProductImageCache.set(contact, map);
  }
  if (productId) {
    map.set(String(productId), Date.now());
  }
  if (productName) {
    map.set(productName.trim().toLowerCase(), Date.now());
  }
}

/**
 * Memeriksa apakah gambar produk ini baru saja dikirim ke kontak dalam batas waktu tertentu.
 * @param {string} contact 
 * @param {number|string} productId 
 * @param {string} [productName]
 * @param {number} [ttlMs=900000] 15 menit default cooldown
 * @returns {boolean}
 */
function wasProductImageRecentlySent(contact, productId, productName = '', ttlMs = 15 * 60 * 1000) {
  if (!contact) return false;
  const map = sentProductImageCache.get(contact);
  if (!map) return false;

  if (productId) {
    const key = String(productId);
    const sentTime = map.get(key);
    if (sentTime && (Date.now() - sentTime) < ttlMs) return true;
  }

  if (productName) {
    const key = productName.trim().toLowerCase();
    const sentTime = map.get(key);
    if (sentTime && (Date.now() - sentTime) < ttlMs) return true;
  }

  return false;
}

/**
 * Membersihkan seluruh cache pengiriman gambar (untuk testing).
 */
function clearSentProductImageCache() {
  sentProductImageCache.clear();
}

// Daftar kata generik yang diabaikan dalam pencocokan nama produk
const GENERIC_WORDS = new Set([
  'produk', 'barang', 'isi', 'porsi', 'harga', 'berapa', 'ready', 'ada',
  'gak', 'ga', 'nggak', 'tidak', 'nih', 'dong', 'kak', 'ka', 'min', 'gan', 'bro', 'yang', 'dan', 'ini',
  'itu', 'mau', 'beli', 'pesan', 'order', 'untuk', 'dari', 'bisa', 'liat',
  'lihat', 'liatkan', 'liatnya', 'foto', 'fotonya', 'gambar', 'gambarnya', 'katalog',
  'spill', 'pic', 'pict', 'picture', 'contoh', 'coba', 'cobain', 'mana', 'manakah',
  'tengok', 'tunjukin', 'kasih', 'kirim', 'kirimkan', 'deh', 'kan', 'sih',
  'lah', 'ya', 'yaa', 'yah', 'yuk', 'kah', 'aja', 'saja', 'punya', 'kok', 'apa',
  'apakah', 'gimana', 'bagaimana', 'bentuk', 'bentuknya', 'penampakan', 'penampakannya',
  'model', 'modelnya', 'penasaran', 'pengen', 'ingin', 'tolong', 'minta', 'lagi', 'ulang',
  'sama', 'dengan', 'serta', 'juga', 'atau'
]);

/**
 * Ekstraksi token identitas produk (nama bersih, akronim, SKU, dan kata kunci).
 * @param {object} product 
 * @returns {object}
 */
function extractProductSearchTokens(product) {
  const rawName = (product.name || '').trim().toLowerCase();
  const rawSku = (product.sku || '').trim().toLowerCase();
  
  // Ekstrak teks dalam kurung sebagai akronim/alias (contoh: "Albino Full Red (AFR)" -> "afr" atau "AFR (Albino Full Red)" -> "albino full red")
  const parenMatch = rawName.match(/\(([^)]+)\)/);
  const parenthetical = parenMatch ? parenMatch[1].trim().toLowerCase() : '';

  // Bersihkan nama dari tanda kurung & karakter khusus
  const cleanName = rawName.replace(/\([^)]*\)/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Buat inisial / akronim dari huruf pertama tiap kata di cleanName (contoh: "albino full red" -> "afr")
  const words = cleanName.split(' ').filter(w => w.length > 0);
  let initials = words.length >= 2 ? words.map(w => w[0]).join('') : '';

  // Jika parenthetical memiliki beberapa kata (contoh: "AFR (Albino Full Red)"), buat inisial juga dari teks dalam kurung
  const parenWords = parenthetical.split(' ').filter(w => w.length > 0);
  if (!initials && parenWords.length >= 2) {
    initials = parenWords.map(w => w[0]).join('');
  }

  const allWords = [...words, ...parenWords];
  const nonGenericWords = allWords.filter(w => !GENERIC_WORDS.has(w) && w.length >= 2);

  const unspacedClean = cleanName.replace(/\s+/g, '');
  const unspacedParen = parenthetical.replace(/\s+/g, '');

  const adjacentPairs = [];
  for (let i = 0; i < words.length - 1; i++) {
    adjacentPairs.push(words[i] + words[i + 1]);
  }
  for (let i = 0; i < parenWords.length - 1; i++) {
    adjacentPairs.push(parenWords[i] + parenWords[i + 1]);
  }

  return {
    rawName,
    cleanName,
    unspacedClean,
    parenthetical,
    unspacedParen,
    initials,
    rawSku,
    adjacentPairs: Array.from(new Set(adjacentPairs)),
    nonGenericWords: Array.from(new Set(nonGenericWords))
  };
}

/**
 * Mencari semua produk relevan dengan gambar yang perlu dikirim (mendukung multi-image & media_url).
 * Menggunakan Arsitektur Dual-Lock (2 Kunci Pengaman):
 * 1. Kunci 1: Memverifikasi niat pelanggan meminta foto (Zero False Positives).
 * 2. Kunci 2: Resolusi target produk cerdas (Eksplisit -> Akronim -> Riwayat Chat -> Fallback).
 * 
 * @param {string} messageText 
 * @param {string} [contact]
 * @param {number} [maxCount=2]
 * @returns {Array<{product: object, fullPath: string|null, url: string|null, isUrl: boolean, hasMediaUrl: boolean}>}
 */
function findProductImagesToSend(messageText = '', contact = null, maxCount = 2) {
  if (!messageText || typeof messageText !== 'string') return [];
  const lower = messageText.toLowerCase().trim();

  // KUNCI 1: Deteksi keluhan / komplain / negasi pengiriman foto (Tolak jika negasi)
  const isComplaintOrNegation = /(?:tidak\s+minta|gak\s+minta|ga\s+minta|bukan\s+minta|ngapain\s+kirim|kenapa\s+(?:kamu\s+)?(?:kasih|kirim)\s+terus|jangan\s+kirim|stop\s+kirim|jangan\s+kasih|ga\s+butuh|gak\s+butuh|tidak\s+butuh|gak\s+usah|ga\s+usah|nggak\s+usah|tidak\s+usah|gausah|salah\s+foto|bukan\s+yang\s+ini|bukan\s+itu|stop\s+spam)/i.test(lower);
  if (isComplaintOrNegation) {
    return [];
  }

  // KUNCI 1: Periksa apakah kalimat aktif meminta foto / melihat produk
  const isAskingImage = /(?:foto|fotonya|gambar|gambarnya|liat|lihat|liatkan|tunjukin|spill|pic|pict|picture|penampakan|penampakannya|contoh|model|modelnya|bentuk|bentuknya|tengok|mana\s+(?:fotonya|gambarnya)|cek\s+foto|minta\s+foto|minta\s+gambar|kirim\s+foto|kirim\s+gambar|ada\s+fotonya|ada\s+gambarnya|liat\s+fotonya|liat\s+gambarnya|penasaran)/i.test(lower);
  const isAskingReSend = /(?:kirim\s+lagi|minta\s+lagi|kirim\s+ulang|liat\s+lagi|lihat\s+lagi|belum\s+(?:muncul|masuk|ada|keliatan|terkirim)|mana\s+(?:fotonya|gambarnya)|fotonya\s+mana|gambarnya\s+mana|kok\s+(?:fotonya|gambarnya)\s+belum|(?:kamu\s+)?(?:ga|gak|tidak|belum)\s+kirim|ga\s+ada\s+fotonya|fotonya\s+ga\s+ada)/i.test(lower);

  if (!isAskingImage && !isAskingReSend) {
    return [];
  }

  const products = db.getAllProducts ? db.getAllProducts() : [];
  if (products.length === 0) return [];

  // Filter produk yang memiliki file gambar lokal, link gambar URL, ATAU link galeri media_url
  const productsWithImage = [];
  for (const prod of products) {
    let res = null;
    if (prod.image_path) {
      res = resolveProductImageResource(prod.image_path);
    }
    const hasMediaUrl = Boolean(prod.media_url && String(prod.media_url).trim());
    if (res || hasMediaUrl) {
      productsWithImage.push({ 
        product: prod, 
        fullPath: res ? res.fullPath || null : null, 
        url: res ? res.url || null : null, 
        isUrl: res ? Boolean(res.isUrl) : false,
        hasMediaUrl,
        tokens: extractProductSearchTokens(prod)
      });
    }
  }

  if (productsWithImage.length === 0) return [];

  // 1. Scoring Eksplisit pada pesan pelanggan saat ini
  const scoredMatches = [];
  const lowerUnspaced = lower.replace(/[^a-z0-9]/g, '');

  for (const item of productsWithImage) {
    const { rawName, cleanName, unspacedClean, parenthetical, unspacedParen, initials, rawSku, nonGenericWords } = item.tokens;
    let score = 0;

    const matchedQueryTokens = new Set();

    // Kecocokan SKU langsung
    if (rawSku && lower.includes(rawSku)) {
      score += 60;
      matchedQueryTokens.add(rawSku);
    }

    // Kecocokan nama tanpa spasi (contoh: "fullgold" -> "Full Gold")
    if (unspacedClean && unspacedClean.length >= 4 && lowerUnspaced.includes(unspacedClean)) {
      score += 50;
      matchedQueryTokens.add(unspacedClean);
    }

    if (unspacedParen && unspacedParen.length >= 4 && lowerUnspaced.includes(unspacedParen)) {
      score += 45;
      matchedQueryTokens.add(unspacedParen);
    }

    // Kecocokan gabungan kata tanpa spasi (contoh: "fullgold" -> "full" + "gold")
    for (const pair of item.tokens.adjacentPairs || []) {
      if (pair.length >= 4 && (lowerUnspaced.includes(pair) || lower.includes(pair))) {
        score += 45;
        matchedQueryTokens.add(pair);
      }
    }

    // Kecocokan nama lengkap atau nama bersih (dengan regex word-boundary untuk kata pendek seperti "afr", "bm")
    if (rawName && lower.includes(rawName)) {
      score += 50;
      for (const w of rawName.split(/\s+/)) {
        if (!GENERIC_WORDS.has(w) && w.length >= 2 && lower.includes(w)) matchedQueryTokens.add(w);
      }
    } else if (cleanName) {
      if (cleanName.length >= 4 && lower.includes(cleanName)) {
        score += 45;
        for (const w of cleanName.split(/\s+/)) {
          if (!GENERIC_WORDS.has(w) && w.length >= 2 && lower.includes(w)) matchedQueryTokens.add(w);
        }
      } else if (cleanName.length >= 2 && new RegExp(`\\b${cleanName}\\b`, 'i').test(lower)) {
        score += 45;
        matchedQueryTokens.add(cleanName);
      }
    }

    // Kecocokan akronim / alias dalam kurung
    if (parenthetical) {
      if (parenthetical.length >= 4 && lower.includes(parenthetical)) {
        score += 40;
        for (const w of parenthetical.split(/\s+/)) {
          if (!GENERIC_WORDS.has(w) && w.length >= 2 && lower.includes(w)) matchedQueryTokens.add(w);
        }
      } else if (parenthetical.length >= 2 && new RegExp(`\\b${parenthetical}\\b`, 'i').test(lower)) {
        score += 40;
        matchedQueryTokens.add(parenthetical);
      }
    }

    // Kecocokan inisial kata (misal "afr" atau "bm")
    if (initials && initials.length >= 2 && new RegExp(`\\b${initials}\\b`, 'i').test(lower)) {
      score += 35;
      matchedQueryTokens.add(initials);
    }

    // Kecocokan kata per kata dengan toleransi typo dan penanganan imbuhan "nya"
    const queryTokens = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !GENERIC_WORDS.has(w));
    for (const rawQw of queryTokens) {
      const qw = (rawQw.endsWith('nya') && rawQw.length > 4) ? rawQw.slice(0, -3) : rawQw;
      for (const pw of nonGenericWords) {
        if (qw === pw || rawQw === pw) {
          score += 15;
          matchedQueryTokens.add(rawQw);
        } else if (isWordSimilar(qw, pw)) {
          score += 10;
          matchedQueryTokens.add(rawQw);
        }
      }
      if (initials && (qw === initials || rawQw === initials)) {
        score += 35;
        matchedQueryTokens.add(rawQw);
      }
    }

    if (score >= 25) {
      scoredMatches.push({ item, score, matchedQueryTokens });
    }
  }

  // Pemilihan hasil dengan diversifikasi kata kunci (Maximal Marginal Relevance)
  // Menjamin jika pelanggan meminta beberapa produk sekaligus (misal AFR dan Albino Koi),
  // bot tidak mengirim dua foto produk yang sama melainkan masing-masing produk yang diminta.
  const remainingCandidates = [...scoredMatches];
  const results = [];
  const addedIds = new Set();
  const coveredQueryTokens = new Set();

  while (results.length < maxCount && remainingCandidates.length > 0) {
    let bestIdx = -1;
    let highestDynamicScore = -Infinity;

    for (let i = 0; i < remainingCandidates.length; i++) {
      const candidate = remainingCandidates[i];
      let newTokensCount = 0;
      for (const t of candidate.matchedQueryTokens) {
        if (!coveredQueryTokens.has(t)) {
          newTokensCount++;
        }
      }
      const dynamicScore = candidate.score + (newTokensCount * 50);
      if (dynamicScore > highestDynamicScore) {
        highestDynamicScore = dynamicScore;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;

    const [chosen] = remainingCandidates.splice(bestIdx, 1);
    if (!addedIds.has(chosen.item.product.id)) {
      results.push(chosen.item);
      addedIds.add(chosen.item.product.id);
      for (const t of chosen.matchedQueryTokens) {
        coveredQueryTokens.add(t);
      }
    }
  }

  if (results.length > 0) {
    return results;
  }

  // 2. Pencarian Kontekstual dari Riwayat Chat (Pesan pendek "liat fotonya", "mana fotonya ka", "kamu ga kirim fotonyaaa")
  if (contact && db.getChatLogsByContact) {
    try {
      const recentLogs = db.getChatLogsByContact(contact, 10);
      if (recentLogs && recentLogs.length > 0) {
        for (const l of recentLogs) {
          const combinedLog = `${l.message_out || ''} ${l.message_in || ''}`.toLowerCase();
          const combinedLogUnspaced = combinedLog.replace(/[^a-z0-9]/g, '');
          for (const item of productsWithImage) {
            if (addedIds.has(item.product.id)) continue;
            const { rawName, cleanName, unspacedClean, parenthetical, initials, nonGenericWords } = item.tokens;

            let matched = false;
            if (rawName && combinedLog.includes(rawName)) matched = true;
            else if (unspacedClean && unspacedClean.length >= 4 && combinedLogUnspaced.includes(unspacedClean)) matched = true;
            else if (cleanName) {
              if (cleanName.length >= 4 && combinedLog.includes(cleanName)) matched = true;
              else if (cleanName.length >= 2 && new RegExp(`\\b${cleanName}\\b`, 'i').test(combinedLog)) matched = true;
            }

            if (!matched && parenthetical) {
              if (parenthetical.length >= 4 && combinedLog.includes(parenthetical)) matched = true;
              else if (parenthetical.length >= 2 && new RegExp(`\\b${parenthetical}\\b`, 'i').test(combinedLog)) matched = true;
            }

            if (!matched && initials && initials.length >= 2 && new RegExp(`\\b${initials}\\b`, 'i').test(combinedLog)) {
              matched = true;
            }

            if (!matched) {
              const matchedWords = nonGenericWords.filter(pw => combinedLog.includes(pw));
              const requiredCount = Math.min(2, nonGenericWords.length);
              if (matchedWords.length >= requiredCount && matchedWords.length > 0) {
                matched = true;
              }
            }

            if (matched) {
              results.push(item);
              addedIds.add(item.product.id);
              if (results.length >= maxCount) break;
            }
          }
          if (results.length > 0) break;
        }
      }
    } catch (_) {}
  }

  if (results.length > 0) {
    return results;
  }

  // 3. Fallback: Produk pertama dengan gambar valid
  if (productsWithImage.length > 0) {
    return [productsWithImage[0]];
  }

  return [];
}

/**
 * Mencari satu produk relevan dengan gambar yang perlu dikirim (backward compatibility).
 * @param {string} messageText 
 * @param {string} [contact]
 * @returns {{product: object, fullPath: string|null, url: string|null, isUrl: boolean}|null}
 */
function findProductImageToSend(messageText = '', contact = null) {
  const images = findProductImagesToSend(messageText, contact, 1);
  return images.length > 0 ? images[0] : null;
}

const { simulateHumanPacing } = require('../human-pacing');

/**
 * Mensimulasikan jeda alami manusia (Anti-Ban):
 * Jeda Pesan Masuk -> Tandai Dibaca (sendSeen / Centang Biru) -> Jeda Membaca -> Status Mengetik -> Jeda Mengetik Alami.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {number} [minMs] 
 * @param {number} [maxMs] 
 */
async function simulateHumanTyping(message, minMs = null, maxMs = null) {
  return await simulateHumanPacing(message, { minMs, maxMs });
}

const { splitIntoBubbles, sendMultiBubbleMessages } = require('../bubble-sender');

/**
 * Menangani pesan masuk dalam Mode Bisnis.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} client 
 */
async function handleBusinessMessage(message, client) {
  const contact = message.from || 'unknown';
  const messageBody = message.body || '';

  try {
    // Eagerly catat dan selesaikan profil pelanggan (nama profil / pushname / nomor telepon)
    let customerInfo = { formattedDisplay: 'Pelanggan' };
    try {
      customerInfo = await resolveCustomerInfo(message, contact);
    } catch (_) {}

    // 0. Cek apakah kontak sedang dalam status Dijeda (Paused / Handover Owner)
    if (db.isContactPaused(contact)) {
      console.log(`[BusinessHandler] Kontak ${contact} (${customerInfo.formattedDisplay}) sedang dalam status DIJEDA (Paused/Handover). Mengabaikan balasan otomatis.`);

      // 1. Simpan pesan masuk ke tabel chat_logs agar selalu muncul di Web Controller Chat Logs & CRM
      try {
        db.createChatLog({
          contact,
          message_in: messageBody,
          message_out: '(Status Dijeda / Handover - Menunggu respon manual admin)',
          handled_by: 'human'
        });
      } catch (_) {}

      // 2. Perbarui / tambahkan pesan baru ke Tiket Handover agar muncul di Inbox Handover Dashboard
      try {
        if (db.appendOrUpdateHandoverTicket) {
          db.appendOrUpdateHandoverTicket(contact, messageBody, 'Pesan Lanjutan saat Status Dijeda');
        }
      } catch (_) {}

      // 3. Update waktu interaksi terakhir di profil pelanggan (CRM)
      try {
        if (db.updateLastContact) db.updateLastContact(contact);
      } catch (_) {}

      // 4. Teruskan notifikasi pesan baru ke nomor owner (jika nomor owner bukan pengirim itu sendiri)
      try {
        const config = getConfig();
        const ownerPhone = db.getSetting('owner_phone') || config.owner_phone;
        if (ownerPhone && client && typeof client.sendMessage === 'function') {
          const cleanPhone = normalizePhoneNumber(ownerPhone);
          const targetJid = toWhatsAppJid(ownerPhone);
          if (targetJid && !contact.includes(cleanPhone)) {
            const customerDisplay = customerInfo.formattedDisplay || 'Pelanggan';
            const followUpNotice = `🔔 *[PESAN BARU - HANDOVER AKTIF]*\n\n` +
              `Pelanggan: *${customerDisplay}* mengirim pesan lanjutan:\n\n` +
              `💬 "${messageBody}"\n\n` +
              `👉 _Status bot masih DIJEDA. Silakan balas langsung melalui WhatsApp Anda._\n` +
              `💡 _Ketik \`!selesai\` atau \`!aktifkan\` jika obrolan sudah selesai._`;

            let finalJid = targetJid;
            if (typeof client.getNumberId === 'function') {
              const numberId = await client.getNumberId(cleanPhone).catch(() => null);
              if (numberId && numberId._serialized) finalJid = numberId._serialized;
            }
            await client.sendMessage(finalJid, followUpNotice).catch(() => {});
          }
        }
      } catch (_) {}

      return;
    }

    const config = getConfig();

    // Auto-cancel scheduled follow-up jika pelanggan membalas chat (Fase 5)
    try {
      const scheduledList = db.db.prepare("SELECT id FROM follow_ups WHERE contact = ? AND status = 'scheduled'").all(contact);
      for (const f of scheduledList) {
        db.updateFollowUpStatus(f.id, 'cancelled', 'customer_reply');
        console.log(`[BusinessHandler] Otomatis membatalkan follow-up ${f.id} karena ada balasan baru dari pelanggan`);
      }
    } catch (_) {}

    // 1. Cek jam operasional — kirim auto-reply jika di luar jam dan fitur aktif
    const outOfHoursMode = db.getSetting ? (db.getSetting('out_of_hours_mode') || 'off') : 'off';
    if (outOfHoursMode !== 'off') {
      const { isOutOfHours, businessHours } = checkOutOfHours();
      if (isOutOfHours && businessHours) {
        if (outOfHoursMode === 'reply_only') {
          // Kirim pesan template luar jam, TANPA proses AI (hemat token)
          const businessName = config.business_name || 'Toko Kami';
          const outOfHoursMsg = `Terima kasih sudah menghubungi *${businessName}*. Saat ini di luar jam operasional kami (${businessHours} WIB). Pesan Kakak sudah tercatat dan akan kami respon saat buka kembali. Terima kasih atas kesabarannya 🙏`;

          await simulateHumanTyping(message, 2000, 4000);
          await message.reply(outOfHoursMsg);

          // Tetap catat ke chat_logs agar tidak hilang
          db.createChatLog({
            contact,
            message_in: messageBody,
            message_out: outOfHoursMsg,
            handled_by: 'out_of_hours'
          });
          console.log(`[BusinessHandler] Pesan dari ${contact} dijawab dengan template luar jam operasional.`);
          return;
        }
        // Mode 'full_ai': lanjut ke AI tapi nanti AI tahu ini di luar jam
      }
    }

    // Deteksi kata kunci opt-out follow-up (Fase 5)
    const lowerBody = messageBody.toLowerCase();
    const OPTOUT_KEYWORDS = ['jangan ganggu', 'stop', 'berhenti', 'unsubscribe', 'jangan kirim lagi', 'spam'];
    const isOptOutTriggered = OPTOUT_KEYWORDS.some(kw => lowerBody.includes(kw));

    if (isOptOutTriggered) {
      try {
        db.addOptOut(contact);
        // Batalkan follow-up yang dijadwalkan
        const scheduledList = db.db.prepare("SELECT id FROM follow_ups WHERE contact = ? AND status = 'scheduled'").all(contact);
        for (const f of scheduledList) {
          db.updateFollowUpStatus(f.id, 'cancelled', 'optout');
        }

        const optOutReply = 'Baik Kak, kami tidak akan mengirim pesan follow-up lagi. Kalau suatu saat butuh bantuan, langsung chat aja ya. 🙏';
        await simulateHumanTyping(message, 1000, 2000);
        await message.reply(optOutReply);

        db.createChatLog({
          contact,
          message_in: messageBody,
          message_out: optOutReply,
          handled_by: 'optout'
        });
        
        console.log(`[BusinessHandler] Kontak ${contact} meminta opt-out follow-up.`);
        return;
      } catch (err) {
        console.error('[BusinessHandler] Gagal memproses request opt-out:', err.message);
      }
    }

    // 1b. Cek apakah pesan merupakan pengiriman formulir pesanan lengkap dari pelanggan
    try {
      const { isCustomerOrderForm, handleCustomerOrderSubmission } = require('./order-submission-handler');
      if (isCustomerOrderForm(messageBody)) {
        await simulateHumanTyping(message, 1000, 2000);
        const orderHandled = await handleCustomerOrderSubmission(message, client);
        if (orderHandled) {
          return;
        }
      }
    } catch (orderErr) {
      console.warn('[BusinessHandler] Gagal memproses submit order form pelanggan:', orderErr.message);
    }

    // 2. Cek FAQ match — jawab langsung tanpa AI jika ada FAQ yang cocok
    try {
      const matchedFaq = db.matchFaq ? db.matchFaq(messageBody) : null;
      if (matchedFaq) {

        await simulateHumanTyping(message, 1500, 3000);
        await message.reply(matchedFaq.answer);

        // Catat ke chat_logs dengan handled_by 'faq'
        db.createChatLog({
          contact,
          message_in: messageBody,
          message_out: matchedFaq.answer,
          handled_by: 'faq'
        });

        // Naikkan counter
        if (db.incrementFaqMatchCount) db.incrementFaqMatchCount(matchedFaq.id);

        // Update last contact di customer profiles
        try { if (db.updateLastContact) db.updateLastContact(contact); } catch (_) {}

        console.log(`[BusinessHandler] Pesan dari ${contact} dijawab FAQ "${matchedFaq.question_label}" (hemat 1 panggilan AI).`);
        return;
      }
    } catch (_) {}

    // 3. Cek apakah pesan memerlukan Human Handover (Nego Harga / Komplain / Minta Admin)
    if (isHandoverTriggered(messageBody, false, config)) {
      const handoverReply = 'Baik Kak, terkait penawaran/permintaan Kakak ini, pesan sudah kami teruskan ke admin/pemilik toko ya. Mohon ditunggu sebentar, admin kami akan segera membalas langsung di sini. Terima kasih atas kesabarannya 🙏';

      await simulateHumanTyping(message, 1000, 2000);
      if (typeof message.reply === 'function') {
        await message.reply(handoverReply);
      } else if (client && typeof client.sendMessage === 'function') {
        await client.sendMessage(contact, handoverReply);
      }

      await triggerHandoverActions(contact, messageBody, 'Nego Harga / Permintaan Khusus / Komplain', client, config, message);

      db.createChatLog({
        contact,
        message_in: messageBody,
        message_out: handoverReply,
        handled_by: 'human'
      });

      try {
        if (db.updateLastContact) db.updateLastContact(contact);
      } catch (_) {}

      return;
    }

    // 4. Simulasikan jeda manusiawi & status typing untuk anti-banned
    await simulateHumanTyping(message);

    // 4b. Ekstraksi Gambar / Media jika pelanggan mengirim foto
    let imageBase64 = message.imageBase64 || null;
    let mimeType = message.mimeType || 'image/jpeg';

    if (!imageBase64 && (message.hasMedia || message.type === 'image') && typeof message.downloadMedia === 'function') {
      try {
        const downloaded = await message.downloadMedia();
        if (downloaded && downloaded.data) {
          imageBase64 = downloaded.data;
          mimeType = downloaded.mimetype || 'image/jpeg';
          console.log(`[BusinessHandler] Berhasil mengunduh foto pelanggan (${mimeType}) dari ${contact}. Meneruskan ke AI Vision...`);
        }
      } catch (mediaErr) {
        console.warn('[BusinessHandler] Gagal mengunduh foto dari pesan WhatsApp:', mediaErr.message);
      }
    }

    // 5. Generate balasan dari AI Router (dengan konteks riwayat chat pelanggan + Vision Multimodal)
    const aiResult = await generateReply({
      message: messageBody,
      mode: 'bisnis',
      contact,
      imageBase64,
      mimeType
    });

    let replyText = aiResult.reply || 'Halo, ada yang bisa kami bantu seputar produk kami?';

    // 5b. Auto-extract nama pelanggan dari tag [CUSTOMER_NAME:xxx] (jika AI menemukannya)
    try {
      const nameResult = extractCustomerNameFromReply(replyText);
      if (nameResult && nameResult.name) {
        replyText = nameResult.cleanReply; // Hapus tag dari pesan yang dikirim ke pelanggan
        // Simpan nama ke customer_profiles jika belum ada
        const existing = db.getCustomerProfile ? db.getCustomerProfile(contact) : null;
        if (!existing || !existing.customer_name) {
          db.upsertCustomerProfile(contact, { customer_name: nameResult.name });
          console.log(`[BusinessHandler] Nama pelanggan "${nameResult.name}" berhasil disimpan untuk ${contact}.`);
        }
      }
    } catch (_) {}

    // 5c. Update timestamp terakhir chat di customer_profiles
    try {
      if (db.updateLastContact) db.updateLastContact(contact);
    } catch (_) {}

    // 6. Pecah pesan panjang menjadi gelembung chat alami & kirim bertahap
    const maxBubbles = Number(config.max_bubbles) || 3;
    const isSuperRingkas = config.response_length === 'super_ringkas';
    const bubbles = splitIntoBubbles(replyText, maxBubbles, { superRingkas: isSuperRingkas });
    await sendMultiBubbleMessages(message, client, contact, bubbles, {
      interBubbleDelay: config.inter_bubble_delay
    });

    // 7. Cek apakah perlu kirim gambar produk (mendukung multi-image)
    const imagesToSend = findProductImagesToSend(messageBody, contact, 2);
    if (imagesToSend && imagesToSend.length > 0 && client) {
      for (const imgInfo of imagesToSend) {
        try {
          const media = await createMessageMediaFromFile(imgInfo.fullPath || imgInfo.url);
          let caption = `📸 *${imgInfo.product.name}*\n💰 Rp${Number(imgInfo.product.price).toLocaleString('id-ID')}`;
          if (imgInfo.product.media_url && String(imgInfo.product.media_url).trim()) {
            caption += `\n\n🔗 *Lihat Foto & Video Lengkap:*\n${String(imgInfo.product.media_url).trim()}`;
          }

          if (media) {
            let sent = false;

            // 1. Coba kirim via client.sendMedia (metode standar multi-engine untuk file/buffer)
            if (typeof client.sendMedia === 'function') {
              try {
                await client.sendMedia(contact, media.buffer || media.filePath || media, {
                  caption,
                  mimeType: media.mimetype,
                  jpegThumbnail: media.thumbnail
                });
                sent = true;
              } catch (mediaErr) {
                console.warn(`[BusinessHandler] client.sendMedia gagal (${mediaErr.message}), mencoba sendMessage...`);
              }
            }

            // 2. Fallback: kirim via client.sendMessage ke contact langsung
            if (!sent && typeof client.sendMessage === 'function') {
              try {
                await client.sendMessage(contact, media, { caption, jpegThumbnail: media.thumbnail });
                sent = true;
              } catch (sendErr) {
                console.warn(`[BusinessHandler] client.sendMessage media gagal (${sendErr.message}), mencoba fallback message.reply...`);
              }
            }

            // 3. Fallback: coba kirim via message.reply
            if (!sent && message && typeof message.reply === 'function') {
              try {
                await message.reply(media, { caption, jpegThumbnail: media.thumbnail });
                sent = true;
              } catch (replyErr) {
                console.warn(`[BusinessHandler] message.reply media gagal (${replyErr.message}), mencoba fallback berikutnya...`);
              }
            }

            // 4. Fallback: jika contact adalah @lid, coba selesaikan ke nomor @c.us / @s.whatsapp.net
            if (!sent && contact && contact.endsWith('@lid')) {
              try {
                const { findContactByQuery } = require('../../utils/contact-resolver');
                const resolved = findContactByQuery(contact);
                if (resolved && resolved.phoneNumber) {
                  const targetCus = `${resolved.phoneNumber}@c.us`;
                  if (typeof client.sendMedia === 'function') {
                    await client.sendMedia(targetCus, media.buffer || media.filePath || media, { caption, mimeType: media.mimetype, jpegThumbnail: media.thumbnail });
                    sent = true;
                  } else if (typeof client.sendMessage === 'function') {
                    await client.sendMessage(targetCus, media, { caption, jpegThumbnail: media.thumbnail });
                    sent = true;
                  }
                  if (sent) {
                    console.log(`[BusinessHandler] Berhasil mengirim foto via fallback nomor resolved ${targetCus}`);
                  }
                }
              } catch (lidErr) {
                console.warn(`[BusinessHandler] Fallback media ke resolved @c.us gagal:`, lidErr.message);
              }
            }

            if (sent) {
              recordSentProductImage(contact, imgInfo.product.id, imgInfo.product.name);
              console.log(`[BusinessHandler] ✅ Berhasil mengirim foto produk "${imgInfo.product.name}" ke ${contact}`);
            } else {
              console.error(`[BusinessHandler] ❌ Gagal mengirim foto produk "${imgInfo.product.name}" ke ${contact} setelah semua percobaan.`);
            }
          } else if (imgInfo.product.media_url && String(imgInfo.product.media_url).trim()) {
            // Fallback: Jika file fisik gambar tidak ada di disk / gagal diunduh, kirim pesan berisi link galeri media
            const fallbackText = `📸 *${imgInfo.product.name}*\n💰 Rp${Number(imgInfo.product.price).toLocaleString('id-ID')}\n\n🔗 *Lihat Foto & Video Lengkap:*\n${String(imgInfo.product.media_url).trim()}`;
            try {
              if (typeof client.sendMessage === 'function') {
                await client.sendMessage(contact, fallbackText);
              } else if (message && typeof message.reply === 'function') {
                await message.reply(fallbackText);
              }
              recordSentProductImage(contact, imgInfo.product.id, imgInfo.product.name);
              console.log(`[BusinessHandler] ✅ Berhasil mengirim tautan galeri/video "${imgInfo.product.name}" ke ${contact}`);
            } catch (fbErr) {
              console.warn('[BusinessHandler] Gagal mengirim fallback tautan galeri:', fbErr.message);
            }
          } else {
            console.warn(`[BusinessHandler] createMessageMediaFromFile mengembalikan null untuk produk "${imgInfo.product.name}" (sumber: ${imgInfo.fullPath || imgInfo.url}).`);
          }
        } catch (mediaErr) {
          console.error('[BusinessHandler] Gagal mengirim media gambar:', mediaErr.message);
        }
      }
    }

    // 8. Cek & Notifikasi jika AI menandai handoverRequired (hanya jika fitur handover aktif)
    const needsAiHandover = isHandoverEnabled(config) && Boolean(aiResult.handoverRequired);
    if (needsAiHandover) {
      await triggerHandoverActions(contact, messageBody, 'Permintaan Eskalasi AI', client, config, message);
    }

    // Cek apakah pesan mengandung nama produk dari katalog untuk menjadwalkan follow-up (Fase 5)
    try {
      const { scheduleFollowUp } = require('../follow-up-scheduler');
      const { extractKeywords } = require('../../ai/context-builder');
      const keywords = extractKeywords(messageBody);
      let matchedProdName = null;
      for (const kw of keywords) {
        const results = db.searchProducts(kw);
        if (results && results.length > 0) {
          matchedProdName = results[0].name;
          break;
        }
      }
      if (matchedProdName) {
        scheduleFollowUp(contact, matchedProdName, messageBody);
      }
    } catch (e) {
      console.error('[BusinessHandler] Gagal menjadwalkan follow-up otomatis:', e.message);
    }

    // 9. Catat ke tabel chat_logs SQLite
    const recordedInMessage = imageBase64 
      ? (messageBody ? `[Foto] ${messageBody}` : '[Foto Produk/Dokumen]') 
      : messageBody;

    db.createChatLog({
      contact,
      message_in: recordedInMessage,
      message_out: replyText,
      handled_by: needsAiHandover ? 'human' : 'ai',
      tokens_used: aiResult?.tokens?.total || 0
    });

  } catch (err) {
    console.error('[BusinessHandler] Error saat memproses pesan bisnis:', err.message);
  }
}

module.exports = {
  handleBusinessMessage,
  isHandoverTriggered,
  isHandoverEnabled,
  findProductImageToSend,
  findProductImagesToSend,
  extractProductSearchTokens,
  resolveProductImagePath,
  createMessageMediaFromFile,
  clearSentProductImageCache,
  wasProductImageRecentlySent,
  recordSentProductImage,
  simulateHumanTyping,
  simulateHumanPacing
};

