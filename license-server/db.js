const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables from .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
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

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kdzihdcuhhqvqosemrnk.supabase.co').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUB_KEY || '';

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'licenses.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// === Supabase Helper ===

function requestSupabase(endpointPath, options = {}) {
  return new Promise((resolve) => {
    if (!SUPABASE_KEY) {
      return resolve({ success: false, error: 'No Supabase Key configured' });
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1${endpointPath}`);
    const method = options.method || 'GET';
    const postData = options.body ? JSON.stringify(options.body) : null;

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation'
    };

    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers,
      timeout: 5000
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data: parsed, statusCode: res.statusCode });
          } else {
            resolve({ success: false, status: res.statusCode, error: parsed, raw: body });
          }
        } catch (_) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data: body, statusCode: res.statusCode });
          } else {
            resolve({ success: false, status: res.statusCode, error: body });
          }
        }
      });
    });

    req.on('error', err => {
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Supabase request timeout' });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// === Local JSON Database Fallback & Cache ===

function loadLocalDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (_) {}
  return {
    licenses: [],
    activations: []
  };
}

function saveLocalDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[DB] Gagal menyimpan licenses.json:', err.message);
    return false;
  }
}

// === License Operations ===

async function findLicense(licenseKey) {
  const cleanKey = (licenseKey || '').trim().toUpperCase();

  // 1. Coba dari Supabase Cloud
  const res = await requestSupabase(`/licenses?license_key=eq.${encodeURIComponent(cleanKey)}&select=*`);
  if (res.success && Array.isArray(res.data) && res.data.length > 0) {
    return res.data[0];
  }

  // 2. Fallback ke Local JSON
  const db = loadLocalDatabase();
  return db.licenses.find(l => l.license_key === cleanKey) || null;
}

async function createLicense({ licenseKey, edition = 'all', maxDevices = 1, buyerEmail = '', buyerName = '', status = 'active' }) {
  const cleanKey = (licenseKey || '').trim().toUpperCase();

  const record = {
    license_key: cleanKey,
    edition,
    max_devices: Number(maxDevices) || 1,
    buyer_email: buyerEmail || null,
    buyer_name: buyerName || null,
    status,
    created_at: new Date().toISOString()
  };

  // Simpan ke Supabase Cloud
  await requestSupabase('/licenses', {
    method: 'POST',
    body: record,
    prefer: 'resolution=ignore-duplicates,return=representation'
  });

  // Simpan ke Local JSON
  const db = loadLocalDatabase();
  const existing = db.licenses.find(l => l.license_key === cleanKey);
  if (!existing) {
    db.licenses.push(record);
    saveLocalDatabase(db);
  }

  return record;
}

async function updateLicenseStatus(licenseKey, status) {
  const cleanKey = (licenseKey || '').trim().toUpperCase();

  await requestSupabase(`/licenses?license_key=eq.${encodeURIComponent(cleanKey)}`, {
    method: 'PATCH',
    body: { status }
  });

  const db = loadLocalDatabase();
  const lic = db.licenses.find(l => l.license_key === cleanKey);
  if (lic) {
    lic.status = status;
    saveLocalDatabase(db);
    return true;
  }
  return false;
}

// === Activation Operations ===

async function getActivations(licenseKey) {
  const cleanKey = (licenseKey || '').trim().toUpperCase();

  // 1. Dari Supabase Cloud
  const res = await requestSupabase(`/activations?license_key=eq.${encodeURIComponent(cleanKey)}&select=*`);
  if (res.success && Array.isArray(res.data)) {
    return res.data;
  }

  // 2. Fallback Local
  const db = loadLocalDatabase();
  return db.activations.filter(a => a.license_key === cleanKey);
}

async function findActivation(licenseKey, hwid) {
  const cleanKey = (licenseKey || '').trim().toUpperCase();

  // 1. Dari Supabase Cloud
  const res = await requestSupabase(`/activations?license_key=eq.${encodeURIComponent(cleanKey)}&hwid=eq.${encodeURIComponent(hwid)}&select=*`);
  if (res.success && Array.isArray(res.data) && res.data.length > 0) {
    return res.data[0];
  }

  // 2. Fallback Local
  const db = loadLocalDatabase();
  return db.activations.find(a => a.license_key === cleanKey && a.hwid === hwid) || null;
}

async function addActivation({ licenseKey, hwid, deviceName = '', platform = '' }) {
  const cleanKey = (licenseKey || '').trim().toUpperCase();

  const record = {
    license_key: cleanKey,
    hwid,
    device_name: deviceName,
    platform,
    activated_at: new Date().toISOString(),
    last_ping: new Date().toISOString()
  };

  // Upsert ke Supabase
  const supaRes = await requestSupabase('/activations', {
    method: 'POST',
    body: record,
    prefer: 'resolution=merge-duplicates,return=representation'
  });

  // Simpan ke Local JSON
  const db = loadLocalDatabase();
  const existing = db.activations.find(a => a.license_key === cleanKey && a.hwid === hwid);
  if (existing) {
    existing.last_ping = record.last_ping;
    existing.device_name = deviceName || existing.device_name;
    saveLocalDatabase(db);
    return existing;
  }

  const newActivation = {
    id: (supaRes.success && supaRes.data && supaRes.data[0] && supaRes.data[0].id) || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...record
  };

  db.activations.push(newActivation);
  saveLocalDatabase(db);
  return newActivation;
}

async function removeActivation(licenseKey, hwid) {
  const cleanKey = (licenseKey || '').trim().toUpperCase();

  // Hapus dari Supabase
  await requestSupabase(`/activations?license_key=eq.${encodeURIComponent(cleanKey)}&hwid=eq.${encodeURIComponent(hwid)}`, {
    method: 'DELETE'
  });

  // Hapus dari Local JSON
  const db = loadLocalDatabase();
  const initialLength = db.activations.length;
  db.activations = db.activations.filter(a => !(a.license_key === cleanKey && a.hwid === hwid));
  if (db.activations.length !== initialLength) {
    saveLocalDatabase(db);
    return true;
  }
  return false;
}

module.exports = {
  loadLocalDatabase,
  findLicense,
  createLicense,
  updateLicenseStatus,
  getActivations,
  findActivation,
  addActivation,
  removeActivation,
  requestSupabase
};
