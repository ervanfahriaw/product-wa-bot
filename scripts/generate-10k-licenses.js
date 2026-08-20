const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
function loadEnv() {
  const envPath = path.join(__dirname, '../license-server/.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kdzihdcuhhqvqosemrnk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUB_KEY;

const DATA_DIR = path.join(__dirname, '../license-server/data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function generateRandomKey(prefix = 'BIZ') {
  const r1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const r2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const r3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `WABOT-${prefix}-${r1}-${r2}-${r3}`;
}

async function insertBatchToSupabase(batch) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/licenses`);
    const postData = JSON.stringify(batch);

    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates,return=minimal',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, count: batch.length });
        } else {
          resolve({ success: false, status: res.statusCode, error: body });
        }
      });
    });

    req.on('error', err => resolve({ success: false, error: err.message }));
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('======================================================');
  console.log('       GENERATOR 10.000 LISENSI RESMI WA BOT         ');
  console.log('======================================================\n');

  const TOTAL_COUNT = 10000;
  const COUNT_BISNIS = 5000;
  const COUNT_PERSONAL = 5000;

  console.log(`Target: ${TOTAL_COUNT.toLocaleString('id-ID')} License Keys`);
  console.log(`- Edisi Bisnis   : ${COUNT_BISNIS.toLocaleString('id-ID')} keys`);
  console.log(`- Edisi Personal : ${COUNT_PERSONAL.toLocaleString('id-ID')} keys\n`);

  const uniqueKeysSet = new Set();
  const allRecords = [];
  const now = new Date().toISOString();

  // 1. Generate Bisnis Keys
  console.log('[1/4] Menghasilkan 5.000 Key Edisi Bisnis...');
  while (allRecords.length < COUNT_BISNIS) {
    const key = generateRandomKey('BIZ');
    if (!uniqueKeysSet.has(key)) {
      uniqueKeysSet.add(key);
      allRecords.push({
        license_key: key,
        edition: 'bisnis',
        max_devices: 1,
        buyer_email: null,
        buyer_name: null,
        status: 'active',
        created_at: now
      });
    }
  }

  // 2. Generate Personal Keys
  console.log('[2/4] Menghasilkan 5.000 Key Edisi Personal...');
  while (allRecords.length < TOTAL_COUNT) {
    const key = generateRandomKey('PERS');
    if (!uniqueKeysSet.has(key)) {
      uniqueKeysSet.add(key);
      allRecords.push({
        license_key: key,
        edition: 'personal',
        max_devices: 1,
        buyer_email: null,
        buyer_name: null,
        status: 'active',
        created_at: now
      });
    }
  }

  console.log(`  ✅ 10.000 Kunci unik berhasil dihasilkan secara kriptografis.\n`);

  // 3. Simpan ke File Lokal (CSV & JSON untuk Lynk.id dan Backup)
  console.log('[3/4] Menyimpan ke format CSV & JSON untuk Lynk.id...');
  
  // CSV Format
  const csvHeader = 'license_key,edition,max_devices,status,created_at\n';
  const csvRows = allRecords.map(r => `${r.license_key},${r.edition},${r.max_devices},${r.status},${r.created_at}`).join('\n');
  const csvPath = path.join(DATA_DIR, 'licenses-10k-ready-for-lynkid.csv');
  fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf8');

  // Khusus CSV Bisnis saja & Personal saja (untuk memudahkan upload per produk di Lynk.id)
  const csvBizRows = allRecords.filter(r => r.edition === 'bisnis').map(r => r.license_key).join('\n');
  fs.writeFileSync(path.join(DATA_DIR, 'lynk-stock-bisnis-5000.txt'), csvBizRows, 'utf8');

  const csvPersRows = allRecords.filter(r => r.edition === 'personal').map(r => r.license_key).join('\n');
  fs.writeFileSync(path.join(DATA_DIR, 'lynk-stock-personal-5000.txt'), csvPersRows, 'utf8');

  // JSON Format
  const jsonPath = path.join(DATA_DIR, 'licenses.json');
  const existingLocal = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : { licenses: [], activations: [] };
  existingLocal.licenses = allRecords;
  fs.writeFileSync(jsonPath, JSON.stringify(existingLocal, null, 2), 'utf8');

  console.log(`  📁 File CSV Lengkap : license-server/data/licenses-10k-ready-for-lynkid.csv`);
  console.log(`  📁 Stok Lynk Bisnis : license-server/data/lynk-stock-bisnis-5000.txt (5.000 baris key)`);
  console.log(`  📁 Stok Lynk Pers   : license-server/data/lynk-stock-personal-5000.txt (5.000 baris key)`);
  console.log(`  📁 File JSON Local  : license-server/data/licenses.json\n`);

  // 4. Upload ke Supabase Cloud
  console.log('[4/4] Mengunggah 10.000 Lisensi ke Supabase Cloud (Batch per 500 records)...');
  const BATCH_SIZE = 500;
  let totalUploaded = 0;
  let hasTableError = false;

  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allRecords.length / BATCH_SIZE);

    process.stdout.write(`   Mengunggah Batch ${batchNum}/${totalBatches} (${batch.length} records)... `);
    const result = await insertBatchToSupabase(batch);

    if (result.success) {
      totalUploaded += batch.length;
      console.log(`✅ Berhasil (${totalUploaded}/${TOTAL_COUNT})`);
    } else {
      console.log(`❌ Gagal: HTTP ${result.status || ''} - ${result.error || ''}`);
      if (result.error && result.error.includes('PGRST205')) {
        hasTableError = true;
        console.log(`\n   ⚠️ Tabel 'licenses' belum dibuat di Supabase!`);
        break;
      }
    }
  }

  console.log('\n======================================================');
  if (totalUploaded === TOTAL_COUNT) {
    console.log(`  🎉 10.000 LISENSI BERHASIL DIUNGGAH KE SUPABASE!`);
  } else if (hasTableError) {
    console.log(`  ℹ️ 10.000 Lisensi telah dibuat & disimpan di file lokal.`);
    console.log(`     Silakan buat tabel di Supabase SQL Editor terlebih dahulu.`);
    console.log(`     Setelah tabel dibuat, jalankan: node scripts/generate-10k-licenses.js`);
  } else {
    console.log(`  ⚠️ Berhasil mengunggah ${totalUploaded}/${TOTAL_COUNT} lisensi ke Supabase.`);
  }
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
});
