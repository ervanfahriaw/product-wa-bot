const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const { CONFIG_DIR } = require('./paths');
const { getHwid, getDeviceFingerprint } = require('./hwid');
const { getEdition } = require('../config');

const LICENSE_FILE_PATH = path.join(CONFIG_DIR, 'license.json');

// Secret internal client verification salt
const CLIENT_SIGNING_SECRET = 'WABOT_COMMERCIAL_LICENSE_SECRET_KEY_v1_2026';

// Supabase Cloud Configuration
const SUPABASE_CLOUD_URL = process.env.SUPABASE_URL || 'https://kdzihdcuhhqvqosemrnk.supabase.co';
const SUPABASE_CLOUD_KEY = process.env.SUPABASE_KEY || Buffer.from('c2Jfc2VjcmV0X3VkdEE4Und6cnl1bFRzWTZYWnlvMlFfMEVQdkFLMTA=', 'base64').toString('utf8');

// Default License Server URL (optional custom backend or fallback)
const DEFAULT_LICENSE_SERVER = process.env.LICENSE_SERVER_URL || '';

/**
 * Membuat signature HMAC-SHA256 untuk payload lisensi.
 * @param {object} payload 
 * @param {string} [secret] 
 * @returns {string}
 */
function createSignature(payload, secret = CLIENT_SIGNING_SECRET) {
  const dataString = `${payload.licenseKey}:${payload.edition}:${payload.hwid}:${payload.buyerEmail || ''}:${payload.activatedAt}`;
  return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
}

/**
 * Membaca data lisensi lokal dari file config/license.json.
 * @returns {object|null}
 */
function getStoredLicense() {
  try {
    if (!fs.existsSync(LICENSE_FILE_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(LICENSE_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

/**
 * Menyimpan data lisensi lokal ke file config/license.json.
 * @param {object} licenseData 
 * @returns {boolean}
 */
function saveStoredLicense(licenseData) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(LICENSE_FILE_PATH, JSON.stringify(licenseData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[LicenseClient] Gagal menyimpan license.json:', err.message);
    return false;
  }
}

/**
 * Menghapus data lisensi lokal.
 * @returns {boolean}
 */
function deleteStoredLicense() {
  try {
    if (fs.existsSync(LICENSE_FILE_PATH)) {
      fs.unlinkSync(LICENSE_FILE_PATH);
    }
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Memeriksa status lisensi lokal saat ini.
 * Memvalidasi kesesuaian HWID, edisi software, dan integritas signature.
 * @returns {{ isValid: boolean, reason?: string, data?: object }}
 */
function checkLocalLicense() {
  const stored = getStoredLicense();
  if (!stored || !stored.licenseKey || !stored.hwid || !stored.signature) {
    return { isValid: false, valid: false, reason: 'Belum ada lisensi yang diaktifkan.' };
  }

  const currentHwid = getHwid();
  if (stored.hwid !== currentHwid) {
    return {
      isValid: false,
      valid: false,
      reason: 'Lisensi ini terikat pada perangkat keras lain (Hardware ID mismatch). Software tidak dapat dijalankan di perangkat ini.',
      isHwidMismatch: true
    };
  }

  // Verifikasi edisi software jika bukan edisi all
  const currentEdition = getEdition();
  if (currentEdition !== 'all' && stored.edition && stored.edition !== 'all' && stored.edition !== currentEdition) {
    return {
      isValid: false,
      valid: false,
      reason: `Lisensi ini diterbitkan khusus untuk edisi '${stored.edition}', tidak kompatibel dengan edisi '${currentEdition}'.`,
      isEditionMismatch: true
    };
  }

  // Verifikasi HMAC signature
  const expectedSig = createSignature(stored);
  if (stored.signature !== expectedSig) {
    return {
      isValid: false,
      valid: false,
      reason: 'Integritas file lisensi rusak atau telah dimodifikasi secara ilegal.',
      isTampered: true
    };
  }

  return {
    isValid: true,
    valid: true,
    licenseKey: stored.licenseKey,
    edition: stored.edition,
    data: {
      licenseKey: stored.licenseKey,
      edition: stored.edition,
      buyerEmail: stored.buyerEmail || 'Pembeli Resmi',
      buyerName: stored.buyerName || 'Pengguna Berlisensi',
      activatedAt: stored.activatedAt,
      hwid: stored.hwid,
      deviceFingerprint: getDeviceFingerprint()
    }
  };
}

/**
 * Helper untuk melakukan HTTP/HTTPS request berbasis Promise.
 * @param {string} urlStr 
 * @param {object} options 
 * @param {object} body 
 * @returns {Promise<object>}
 */
function makeRequest(urlStr, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WABot-License-Client/1.0',
          ...(options.headers || {})
        },
        timeout: 10000
      };

      if (postData) {
        reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = client.request(reqOptions, (res) => {
        let responseData = '';
        res.on('data', chunk => { responseData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: { success: false, message: responseData || 'Invalid server response' } });
          }
        });
      });

      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Koneksi ke server lisensi timeout (10 detik).'));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Mengirim permintaan aktivasi lisensi ke Supabase Cloud atau License Server kustom.
 * @param {string} licenseKey 
 * @param {string} [serverUrl] 
 * @returns {Promise<{ success: boolean, message: string, data?: object }>}
 */
async function activateLicenseOnline(licenseKey, serverUrl) {
  const cleanKey = (licenseKey || '').trim().toUpperCase();
  if (!cleanKey) {
    return { success: false, message: 'Kode lisensi tidak boleh kosong.' };
  }

  const fingerprint = getDeviceFingerprint();
  const currentEdition = getEdition();

  // 1. Jika pengguna menentukan serverUrl kustom (misal custom node server)
  if (serverUrl && serverUrl.trim()) {
    try {
      const activateUrl = `${serverUrl.trim().replace(/\/+$/, '')}/api/activate`;
      const res = await makeRequest(activateUrl, { method: 'POST' }, {
        licenseKey: cleanKey,
        hwid: fingerprint.hwid,
        deviceName: fingerprint.deviceName,
        platform: fingerprint.platform,
        edition: currentEdition
      });

      if (res.statusCode === 200 && res.body.success) {
        const serverData = res.body.data || {};
        const localLicenseData = {
          licenseKey: cleanKey,
          edition: serverData.edition || currentEdition,
          buyerEmail: serverData.buyerEmail || '',
          buyerName: serverData.buyerName || '',
          hwid: fingerprint.hwid,
          activatedAt: serverData.activatedAt || new Date().toISOString(),
          lastVerifiedAt: new Date().toISOString()
        };
        localLicenseData.signature = createSignature(localLicenseData);
        saveStoredLicense(localLicenseData);
        return { success: true, message: 'Aktivasi lisensi berhasil!', data: localLicenseData };
      } else {
        return { success: false, message: res.body.message || `Aktivasi gagal (Status ${res.statusCode}).` };
      }
    } catch (err) {
      return { success: false, message: `Gagal menghubungi server kustom: ${err.message}` };
    }
  }

  // 2. Aktivasi Langsung via Supabase Cloud (Zero-Config & Serverless)
  try {
    const supaHeaders = {
      'apikey': SUPABASE_CLOUD_KEY,
      'Authorization': `Bearer ${SUPABASE_CLOUD_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // A. Cari lisensi di tabel licenses Supabase
    const licUrl = `${SUPABASE_CLOUD_URL}/rest/v1/licenses?license_key=eq.${encodeURIComponent(cleanKey)}&select=*`;
    const licRes = await makeRequest(licUrl, { method: 'GET', headers: supaHeaders });

    if (licRes.statusCode !== 200 || !Array.isArray(licRes.body) || licRes.body.length === 0) {
      return {
        success: false,
        message: 'Kode lisensi tidak valid atau tidak terdaftar di sistem Lynk.id.'
      };
    }

    const lic = licRes.body[0];

    // B. Verifikasi status lisensi
    if (lic.status !== 'active') {
      return {
        success: false,
        message: `Lisensi ini berstatus '${lic.status}'. Hubungi admin untuk mengaktifkan kembali.`
      };
    }

    // C. Verifikasi edisi produk
    if (currentEdition !== 'all' && lic.edition !== 'all' && lic.edition !== currentEdition) {
      return {
        success: false,
        message: `Kode lisensi ini diterbitkan khusus untuk edisi '${lic.edition}', tidak dapat digunakan untuk '${currentEdition}'.`
      };
    }

    // D. Periksa daftar aktivasi hardware di tabel activations
    const actUrl = `${SUPABASE_CLOUD_URL}/rest/v1/activations?license_key=eq.${encodeURIComponent(cleanKey)}&select=*`;
    const actRes = await makeRequest(actUrl, { method: 'GET', headers: supaHeaders });
    const currentActivations = Array.isArray(actRes.body) ? actRes.body : [];

    const existingForHwid = currentActivations.find(a => a.hwid === fingerprint.hwid);

    // E. Jika perangkat ini sudah aktif sebelumnya, izinkan aktivasi ulang (idempotent)
    if (!existingForHwid) {
      // Periksa batas kuota perangkat
      if (currentActivations.length >= (lic.max_devices || 1)) {
        return {
          success: false,
          message: `Kapasitas perangkat lisensi ini sudah penuh (${currentActivations.length}/${lic.max_devices || 1}). Harap lepas lisensi di perangkat lama terlebih dahulu melalui menu Pengaturan.`
        };
      }

      // Catat aktivasi baru ke Supabase Cloud
      const addActUrl = `${SUPABASE_CLOUD_URL}/rest/v1/activations`;
      await makeRequest(addActUrl, { method: 'POST', headers: supaHeaders }, {
        license_key: cleanKey,
        hwid: fingerprint.hwid,
        device_name: fingerprint.deviceName,
        platform: fingerprint.platform,
        activated_at: new Date().toISOString(),
        last_ping: new Date().toISOString()
      });
    }

    // F. Simpan ke config/license.json lokal dengan Signature HMAC
    const localLicenseData = {
      licenseKey: cleanKey,
      edition: lic.edition,
      buyerEmail: lic.buyer_email || '',
      buyerName: lic.buyer_name || '',
      hwid: fingerprint.hwid,
      activatedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString()
    };

    localLicenseData.signature = createSignature(localLicenseData);
    saveStoredLicense(localLicenseData);

    return {
      success: true,
      message: 'Aktivasi lisensi berhasil! Perangkat Anda telah terdaftar resmi.',
      data: localLicenseData
    };
  } catch (err) {
    return {
      success: false,
      message: `Gagal menghubungi server lisensi cloud: ${err.message}`
    };
  }
}

/**
 * Melakukan deaktivasi lisensi (melepas HWID di Supabase Cloud).
 * @param {string} [serverUrl] 
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function deactivateLicenseOnline(serverUrl) {
  const stored = getStoredLicense();
  if (!stored || !stored.licenseKey) {
    deleteStoredLicense();
    return { success: true, message: 'Lisensi lokal telah dihapus.' };
  }

  const fingerprint = getDeviceFingerprint();

  try {
    if (serverUrl && serverUrl.trim()) {
      const deactivateUrl = `${serverUrl.trim().replace(/\/+$/, '')}/api/deactivate`;
      await makeRequest(deactivateUrl, { method: 'POST' }, {
        licenseKey: stored.licenseKey,
        hwid: fingerprint.hwid
      });
    } else {
      // Hapus dari Supabase Cloud
      const supaHeaders = {
        'apikey': SUPABASE_CLOUD_KEY,
        'Authorization': `Bearer ${SUPABASE_CLOUD_KEY}`
      };
      const delUrl = `${SUPABASE_CLOUD_URL}/rest/v1/activations?license_key=eq.${encodeURIComponent(stored.licenseKey)}&hwid=eq.${encodeURIComponent(fingerprint.hwid)}`;
      await makeRequest(delUrl, { method: 'DELETE', headers: supaHeaders });
    }
  } catch (err) {
    console.warn('[LicenseClient] Deactivation warning:', err.message);
  }

  deleteStoredLicense();
  return {
    success: true,
    message: 'Lisensi berhasil dilepas. Anda dapat mengaktifkannya di perangkat lain sekarang.'
  };
}

module.exports = {
  LICENSE_FILE_PATH,
  getHwid,
  getDeviceFingerprint,
  createSignature,
  getStoredLicense,
  saveStoredLicense,
  deleteStoredLicense,
  checkLocalLicense,
  activateLicenseOnline,
  deactivateLicenseOnline
};
