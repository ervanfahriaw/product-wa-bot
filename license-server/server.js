const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const { sendLicenseEmail } = require('./email');

const app = express();
const PORT = process.env.PORT || 4000;

// Zero-dependency CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'WABot License Server', time: new Date().toISOString() });
});

/**
 * POST /api/activate
 * Mengaktifkan lisensi pada perangkat dengan HWID tertentu.
 */
app.post('/api/activate', async (req, res) => {
  try {
    const { licenseKey, hwid, deviceName, platform, edition } = req.body || {};

    if (!licenseKey || !hwid) {
      return res.status(400).json({
        success: false,
        message: 'Parameter licenseKey dan hwid wajib diisi.'
      });
    }

    const cleanKey = licenseKey.trim().toUpperCase();
    const lic = await db.findLicense(cleanKey);

    if (!lic) {
      return res.status(404).json({
        success: false,
        message: 'Kode lisensi tidak valid atau tidak terdaftar di sistem.'
      });
    }

    if (lic.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Lisensi ini berstatus '${lic.status}'. Hubungi admin untuk mengaktifkan kembali.`
      });
    }

    // Verifikasi kesesuaian edisi produk
    if (edition && edition !== 'all' && lic.edition !== 'all' && lic.edition !== edition) {
      return res.status(400).json({
        success: false,
        message: `Kode lisensi ini diterbitkan khusus untuk edisi '${lic.edition}', tidak dapat digunakan untuk '${edition}'.`
      });
    }

    const currentActivations = await db.getActivations(cleanKey);
    const existingForHwid = currentActivations.find(a => a.hwid === hwid);

    // Jika perangkat ini sudah terdaftar sebelumnya, izinkan aktivasi ulang (idempotent)
    if (existingForHwid) {
      const act = await db.addActivation({
        licenseKey: cleanKey,
        hwid,
        deviceName,
        platform
      });

      return res.json({
        success: true,
        message: 'Perangkat telah terverifikasi.',
        data: {
          licenseKey: cleanKey,
          edition: lic.edition,
          buyerEmail: lic.buyer_email,
          buyerName: lic.buyer_name,
          activatedAt: act.activated_at,
          devicesUsed: currentActivations.length,
          maxDevices: lic.max_devices
        }
      });
    }

    // Jika perangkat baru, periksa batas maksimum perangkat (Hardware-Locked Limit)
    if (currentActivations.length >= lic.max_devices) {
      return res.status(403).json({
        success: false,
        message: `Kapasitas perangkat lisensi ini sudah penuh (${currentActivations.length}/${lic.max_devices}). Harap lepas/deaktivasi lisensi di perangkat lama sebelum mengaktifkannya di sini.`,
        devicesUsed: currentActivations.length,
        maxDevices: lic.max_devices
      });
    }

    // Daftarkan aktivasi baru untuk HWID ini
    const newAct = await db.addActivation({
      licenseKey: cleanKey,
      hwid,
      deviceName,
      platform
    });

    return res.json({
      success: true,
      message: 'Aktivasi berhasil! Perangkat Anda telah terdaftar resmi.',
      data: {
        licenseKey: cleanKey,
        edition: lic.edition,
        buyerEmail: lic.buyer_email,
        buyerName: lic.buyer_name,
        activatedAt: newAct.activated_at,
        devicesUsed: currentActivations.length + 1,
        maxDevices: lic.max_devices
      }
    });
  } catch (err) {
    console.error('Error on /api/activate:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error: ' + err.message });
  }
});

/**
 * POST /api/verify
 * Memeriksa apakah perangkat dengan HWID ini memiliki lisensi aktif.
 */
app.post('/api/verify', async (req, res) => {
  try {
    const { licenseKey, hwid } = req.body || {};

    if (!licenseKey || !hwid) {
      return res.status(400).json({ success: false, message: 'Parameter licenseKey dan hwid wajib diisi.' });
    }

    const cleanKey = licenseKey.trim().toUpperCase();
    const lic = await db.findLicense(cleanKey);

    if (!lic || lic.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Lisensi tidak valid atau tidak aktif.' });
    }

    const activation = await db.findActivation(cleanKey, hwid);
    if (!activation) {
      return res.status(403).json({ success: false, message: 'Perangkat ini belum terdaftar untuk lisensi tersebut.' });
    }

    return res.json({
      success: true,
      message: 'Lisensi aktif dan valid.',
      data: {
        licenseKey: cleanKey,
        edition: lic.edition,
        buyerEmail: lic.buyer_email,
        buyerName: lic.buyer_name,
        activatedAt: activation.activated_at
      }
    });
  } catch (err) {
    console.error('Error on /api/verify:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

/**
 * POST /api/deactivate
 * Melepas lisensi dari HWID perangkat saat ini agar bisa dipindahkan ke laptop/VPS lain.
 */
app.post('/api/deactivate', async (req, res) => {
  try {
    const { licenseKey, hwid } = req.body || {};

    if (!licenseKey || !hwid) {
      return res.status(400).json({ success: false, message: 'Parameter licenseKey dan hwid wajib diisi.' });
    }

    const cleanKey = licenseKey.trim().toUpperCase();
    const removed = await db.removeActivation(cleanKey, hwid);

    if (removed) {
      return res.json({
        success: true,
        message: 'Perangkat berhasil dilepas dari lisensi. Kuota perangkat kini tersedia kembali.'
      });
    } else {
      return res.json({
        success: true,
        message: 'Perangkat tidak terdaftar pada lisensi ini.'
      });
    }
  } catch (err) {
    console.error('Error on /api/deactivate:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

/**
 * POST /api/webhook/lynkid
 * Webhook otomatis saat ada pembelian sukses di Lynk.id untuk generate license key baru
 * dan otomatis mengirimkan email lisensi ke pembeli menggunakan Resend API.
 */
app.post('/api/webhook/lynkid', async (req, res) => {
  try {
    const body = req.body || {};
    const data = body.data || {};
    const messageData = data.message_data || {};
    const customer = messageData.customer || {};

    // 1. Ekstraksi data customer dari Lynk.id (mendukung format message_data maupun format legacy)
    const email = (customer.email || data.customer_email || body.email || '').trim();
    const name = (customer.name || data.customer_name || body.name || 'Pelanggan').trim();
    const phone = (customer.phone || data.customer_phone || body.phone || '').trim();
    const refId = messageData.refId || data.refId || body.refId || '';

    // 2. Ekstraksi produk
    const items = messageData.items || [];
    const firstItemTitle = (items[0] && items[0].title) || '';
    const productName = firstItemTitle || data.product_name || body.product_name || 'WA Bot AI untuk Toko Online - CS Otomatis, Sekali Beli';

    let edition = 'bisnis';
    if (/personal|keuangan|asisten/i.test(productName)) {
      edition = 'personal';
    } else if (/bundle|lengkap|all/i.test(productName)) {
      edition = 'all';
    }

    // Format: WABOT-BIZ-XXXX-YYYY-ZZZZ
    const prefix = edition === 'bisnis' ? 'BIZ' : (edition === 'personal' ? 'PERS' : 'ALL');
    const randPart = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    const key = `WABOT-${prefix}-${randPart()}-${randPart()}-${randPart()}`;

    // Nama pembeli dengan nomor telepon untuk kemudahan tracking admin
    const buyerDisplayName = phone ? `${name} (${phone})` : name;

    const license = await db.createLicense({
      licenseKey: key,
      edition,
      maxDevices: 1,
      buyerEmail: email || null,
      buyerName: buyerDisplayName || null,
      status: 'active'
    });

    // 3. Kirim Email Otomatis ke Pembeli via Resend API
    let emailResult = null;
    if (email) {
      emailResult = await sendLicenseEmail({
        to: email,
        buyerName: name,
        licenseKey: key,
        productName,
        refId
      });
    }

    // 4. Response sesuai format integrasi Lynk.id
    return res.json({
      success: true,
      message: 'Lisensi baru berhasil diterbitkan.',
      licenseKey: key,
      customer: {
        name,
        email,
        phone,
        refId
      },
      data: license,
      emailNotification: emailResult ? {
        sent: emailResult.success,
        recipient: emailResult.recipient,
        id: emailResult.id || null,
        warning: emailResult.warning || null
      } : { sent: false, reason: 'Email customer tidak ditemukan pada payload webhook' }
    });
  } catch (err) {
    console.error('Error on /api/webhook/lynkid:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error: ' + err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`======================================================`);
    console.log(`  🛡️ WABot License Server berjalan di port ${PORT}`);
    console.log(`======================================================`);
  });
}

module.exports = app;
