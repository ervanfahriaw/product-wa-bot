/**
 * Modul Standarisasi & Normalisasi Kategori Pengeluaran & Budget
 * Memastikan variasi kata (misal: "makan", "uang makan", "makan & minum", "food")
 * selalu dipetakan secara konsisten ke kategori kanonikal yang sama.
 */

const CANONICAL_CATEGORIES = {
  'Makan & Minum': [
    'makan', 'minum', 'makanan', 'minuman', 'food', 'kuliner', 'sarapan',
    'lunch', 'dinner', 'kopi', 'coffee', 'cafe', 'kafe', 'snack', 'camilan',
    'uang makan', 'makan & minum', 'makan dan minum', 'makan minum',
    'makanan & minuman', 'makanan dan minuman', 'boba', 'resto', 'warteg',
    'padang', 'jajan', 'jajanan'
  ],
  'Transportasi': [
    'transport', 'transportasi', 'bensin', 'pertalite', 'pertamax', 'solar',
    'ojol', 'grab', 'gojek', 'maxim', 'indrive', 'parkir', 'toll', 'tol',
    'angkot', 'bus', 'kereta', 'krl', 'mrt', 'lrt', 'taksi', 'taxi',
    'tambal ban', 'cuci motor', 'cuci mobil', 'servis', 'service motor',
    'service mobil', 'ongkir', 'ongkos'
  ],
  'Tagihan & Utilitas': [
    'tagihan', 'utilitas', 'listrik', 'token', 'token listrik', 'pln', 'air',
    'pdam', 'wifi', 'internet', 'indihome', 'biznet', 'myrepublic', 'pulsa',
    'kuota', 'paket data', 'iuran', 'bpjs', 'sewa', 'kontrakan', 'kos', 'kost',
    'ipl', 'keamanan', 'sampah'
  ],
  'Belanja': [
    'belanja', 'shopping', 'belanja bulanan', 'supermarket', 'minimarket',
    'indomaret', 'alfamart', 'alfamidi', 'superindo', 'hypermart', 'shopee',
    'tokopedia', 'tokped', 'tiktok shop', 'lazada', 'baju', 'kaos', 'celana',
    'sepatu', 'pakaian', 'aksesoris', 'skincare', 'makeup', 'kosmetik'
  ],
  'Kesehatan': [
    'kesehatan', 'obat', 'dokter', 'klinik', 'rumah sakit', 'rs', 'apotek',
    'vitamin', 'suplemen', 'medis', 'periksa', 'rawat', 'gym', 'fitness',
    'fisioterapi', 'masker'
  ],
  'Pendidikan': [
    'pendidikan', 'kursus', 'buku', 'novel', 'alat tulis', 'sekolah', 'kuliah',
    'spp', 'uang semester', 'les', 'bimbel', 'seminar', 'webinar', 'training',
    'sertifikasi'
  ],
  'Hiburan': [
    'hiburan', 'entertainment', 'nonton', 'bioskop', 'cinema', 'xxi', 'cgv',
    'game', 'steam', 'playstation', 'topup game', 'diamond', 'netflix',
    'spotify', 'youtube premium', 'disney', 'wisata', 'liburan', 'traveling',
    'staycation', 'karaoke', 'hobi'
  ],
  'Investasi & Tabungan': [
    'investasi', 'tabungan', 'menabung', 'reksadana', 'saham', 'bibit',
    'bareksa', 'ajaib', 'crypto', 'bitcoin', 'emas', 'deposito'
  ],
  'Sedekah & Donasi': [
    'sedekah', 'infaq', 'zakat', 'donasi', 'amal', 'kitabisa', 'sumbangan',
    'sedekah subuh'
  ],
  'Keluarga & Anak': [
    'keluarga', 'anak', 'susu', 'pampers', 'popok', 'mainan', 'uang jajan anak',
    'orang tua', 'kirim ortu', 'transfer ortu'
  ],
  'Lain-lain': [
    'lain-lain', 'lainnya', 'other', 'misc', 'pengeluaran lain', 'tidak terduga'
  ]
};

// Buat inverted map untuk lookup cepat O(1)
const ALIAS_LOOKUP = new Map();

for (const [canonical, aliases] of Object.entries(CANONICAL_CATEGORIES)) {
  // Map nama kanonikal sendiri
  ALIAS_LOOKUP.set(canonical.toLowerCase().trim(), canonical);
  // Map semua alias
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(alias.toLowerCase().trim(), canonical);
  }
}

/**
 * Menormalisasi string kategori pengguna ke kategori kanonikal.
 * Jika tidak ditemukan di kamus alias, kembalikan string yang rapi (Title Case).
 * @param {string} input 
 * @returns {string} Kategori yang sudah dinormalisasi
 */
function normalizeCategory(input = '') {
  if (!input || typeof input !== 'string') {
    return 'Lain-lain';
  }

  const clean = input.toLowerCase().trim();
  if (!clean) return 'Lain-lain';

  // 1. Cek exact match di lookup alias
  if (ALIAS_LOOKUP.has(clean)) {
    return ALIAS_LOOKUP.get(clean);
  }

  // 2. Cek apakah ada alias yang terkandung di dalam input (substring search)
  for (const [alias, canonical] of ALIAS_LOOKUP.entries()) {
    if (alias.length >= 3 && clean.includes(alias)) {
      return canonical;
    }
  }

  // Cek token khusus 2 huruf seperti "rs" dengan boundary
  if (/\b(?:rs)\b/i.test(clean)) {
    return 'Kesehatan';
  }

  // 3. Jika input terlalu panjang (> 3 kata / berupa kalimat panjang), jangan jadikan nama kategori baru -> fallback ke "Lain-lain"
  const words = clean.split(/\s+/);
  if (words.length > 3) {
    return 'Lain-lain';
  }

  // 4. Fallback untuk 1-3 kata wajar: Jadikan Title Case (misal: "hobi fotografi" -> "Hobi Fotografi")
  return input
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Mengecek apakah dua nama kategori merujuk pada kategori yang sama.
 * @param {string} cat1 
 * @param {string} cat2 
 * @returns {boolean}
 */
function isSameCategory(cat1, cat2) {
  if (!cat1 || !cat2) return false;
  return normalizeCategory(cat1) === normalizeCategory(cat2);
}

/**
 * Mengambil daftar seluruh kategori kanonikal utama.
 * @returns {string[]}
 */
function getCanonicalCategoryList() {
  return Object.keys(CANONICAL_CATEGORIES);
}

module.exports = {
  CANONICAL_CATEGORIES,
  normalizeCategory,
  isSameCategory,
  getCanonicalCategoryList
};
