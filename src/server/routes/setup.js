const express = require('express');
const router = express.Router();
const {
  getConfig,
  saveConfig,
  getEditionInfo,
  isBusinessEdition,
  isPersonalEdition,
  isDualEdition
} = require('../../config');
const { initClient, getClient, getStatus } = require('../../engine');
const db = require('../../db');

const { getDeviceFingerprint, checkLocalLicense, activateLicenseOnline, deactivateLicenseOnline } = require('../../utils/license-client');

// Helper untuk menyuntikkan data edisi ke view
function getSetupContext(extra = {}) {
  const config = getConfig();
  const editionInfo = getEditionInfo();
  return {
    config,
    editionInfo,
    isBusiness: isBusinessEdition(),
    isPersonal: isPersonalEdition(),
    isDual: isDualEdition(),
    ...extra
  };
}

// Step 1: Aktivasi Lisensi Lynk.id
router.get('/license', (req, res) => {
  const fingerprint = getDeviceFingerprint();
  const localLic = checkLocalLicense();
  const currentKey = (localLic && localLic.data && localLic.data.licenseKey) ? localLic.data.licenseKey : '';

  res.render('setup/step-0-license', getSetupContext({
    title: 'Langkah 1: Aktivasi Lisensi Lynk.id',
    currentStep: 1,
    fingerprint,
    isLicensed: localLic.isValid,
    licenseData: localLic.data || null,
    error: null,
    licenseKey: currentKey
  }));
});

router.post('/license', async (req, res) => {
  const { license_key, server_url } = req.body || {};
  const fingerprint = getDeviceFingerprint();
  const localLic = checkLocalLicense();

  if (!license_key || !license_key.trim()) {
    return res.render('setup/step-0-license', getSetupContext({
      title: 'Langkah 1: Aktivasi Lisensi Lynk.id',
      currentStep: 1,
      fingerprint,
      isLicensed: localLic.isValid,
      error: 'Harap masukkan kode lisensi resmi dari Lynk.id.',
      licenseKey: ''
    }));
  }

  // Panggil aktivasi online
  const result = await activateLicenseOnline(license_key.trim(), server_url || undefined);

  if (result.success) {
    return res.redirect('/setup/step-1');
  } else {
    return res.render('setup/step-0-license', getSetupContext({
      title: 'Langkah 1: Aktivasi Lisensi Lynk.id',
      currentStep: 1,
      fingerprint,
      isLicensed: localLic.isValid,
      error: result.message || 'Gagal mengaktifkan lisensi. Pastikan kode lisensi benar dan koneksi internet stabil.',
      licenseKey: license_key
    }));
  }
});

router.post('/license/deactivate', async (req, res) => {
  const { server_url } = req.body || {};
  await deactivateLicenseOnline(server_url || undefined);
  return res.redirect('/setup/license');
});

// Step 2: Profil Bisnis & Toko
router.get('/', (req, res) => {
  const lic = checkLocalLicense();
  if (!lic.isValid) {
    return res.redirect('/setup/license');
  }
  return res.redirect('/setup/step-1');
});

router.get('/step-1', (req, res) => {
  res.render('setup/step-1-mode', getSetupContext({
    title: 'Langkah 2: Profil Toko & Bisnis',
    currentStep: 2,
    error: null
  }));
});

router.post('/step-1', (req, res) => {
  let { business_name, owner_phone } = req.body || {};
  const mode = 'bisnis';

  const bName = typeof business_name === 'string' ? business_name.trim() : '';
  const oPhone = typeof owner_phone === 'string' ? owner_phone.trim() : '';

  if (!bName) {
    return res.render('setup/step-1-mode', getSetupContext({
      title: 'Langkah 2: Profil Toko & Bisnis',
      currentStep: 2,
      config: { ...getConfig(), business_name, owner_phone },
      error: 'Nama Brand / Toko wajib diisi.'
    }));
  }

  saveConfig({
    mode,
    business_name: bName,
    owner_phone: oPhone
  });

  try {
    if (typeof db.setSetting === 'function') {
      db.setSetting('mode', mode);
      if (bName) db.setSetting('business_name', bName);
      if (oPhone) db.setSetting('owner_phone', oPhone);
    }
  } catch (err) {
    console.warn('[Setup] Gagal menyimpan setting ke DB:', err.message);
  }

  return res.redirect('/setup/step-2');
});

// Step 2: Scan QR WhatsApp
router.get('/step-2', (req, res) => {
  const config = getConfig();
  if (!config.mode) return res.redirect('/setup/step-1');

  // Pastikan engine aktif untuk generate QR jika belum
  try {
    if (typeof getClient === 'function' && typeof initClient === 'function') {
      if (!getClient()) {
        initClient();
      }
    }
  } catch (err) {
    console.warn('[Setup] Inisialisasi client di step-2:', err.message);
  }

  const status = typeof getStatus === 'function' ? getStatus() : {};
  res.render('setup/step-2-qr', getSetupContext({
    title: 'Langkah 2: Sambungkan WhatsApp',
    currentStep: 2,
    status
  }));
});

router.post('/step-2', (req, res) => {
  return res.redirect('/setup/step-3');
});

// Step 3: API Key AI
router.get('/step-3', (req, res) => {
  const config = getConfig();
  if (!config.mode) return res.redirect('/setup/step-1');

  res.render('setup/step-3-api-key', getSetupContext({
    title: 'Langkah 3: Kunci Akses AI',
    currentStep: 3,
    error: null
  }));
});

router.post('/step-3', (req, res) => {
  const { gemini_api_key, grok_api_key } = req.body || {};
  const config = getConfig();

  if (!gemini_api_key || typeof gemini_api_key !== 'string' || gemini_api_key.trim() === '') {
    return res.render('setup/step-3-api-key', getSetupContext({
      title: 'Langkah 3: Kunci Akses AI',
      currentStep: 3,
      config: { ...config, grok_api_key },
      error: 'Kunci Akses Gemini (Gemini API Key) wajib diisi agar bot dapat membalas pesan.'
    }));
  }

  const trimmedGemini = gemini_api_key.trim();
  const trimmedGrok = grok_api_key && typeof grok_api_key === 'string' ? grok_api_key.trim() : '';

  saveConfig({
    gemini_api_key: trimmedGemini,
    grok_api_key: trimmedGrok
  });

  try {
    if (typeof db.setSetting === 'function') {
      db.setSetting('gemini_api_key', trimmedGemini);
      if (trimmedGrok) db.setSetting('grok_api_key', trimmedGrok);
    }
  } catch (err) {
    console.warn('[Setup] Gagal menyimpan API key ke DB:', err.message);
  }

  return res.redirect('/setup/step-4');
});

// Step 4: Data Awal Katalog Produk
router.get('/step-4', (req, res) => {
  const config = getConfig();
  if (!config.mode) return res.redirect('/setup/step-1');
  if (!config.gemini_api_key) return res.redirect('/setup/step-3');

  res.render('setup/step-4-initial-data', getSetupContext({
    title: 'Langkah 4: Contoh Produk Katalog',
    currentStep: 4,
    error: null
  }));
});

router.post('/step-4', (req, res) => {
  const { product_name, product_price, product_stock, product_description } = req.body || {};

  try {
    if (product_name && typeof product_name === 'string' && product_name.trim()) {
      if (typeof db.createProduct === 'function') {
        db.createProduct({
          name: product_name.trim(),
          price: Number(product_price) || 0,
          stock: Number(product_stock) || 0,
          description: product_description && typeof product_description === 'string' ? product_description.trim() : ''
        });
      }
    }

    saveConfig({ is_setup_completed: true });
    if (typeof db.setSetting === 'function') {
      db.setSetting('is_setup_completed', 'true');
    }

    return res.redirect('/dashboard');
  } catch (error) {
    return res.render('setup/step-4-initial-data', getSetupContext({
      title: 'Langkah 4: Contoh Produk Katalog',
      currentStep: 4,
      error: `Gagal menyimpan data awal: ${error.message}`
    }));
  }
});

router.post('/step-4/skip', (req, res) => {
  saveConfig({ is_setup_completed: true });
  if (typeof db.setSetting === 'function') {
    db.setSetting('is_setup_completed', 'true');
  }
  return res.redirect('/dashboard');
});

module.exports = router;
