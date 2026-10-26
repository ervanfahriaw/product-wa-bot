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

// Step 0: Aktivasi Lisensi Lynk.id
router.get('/license', (req, res) => {
  const isBusiness = isBusinessEdition();
  const isPersonal = isPersonalEdition();
  const fingerprint = getDeviceFingerprint();

  let pageTitle = 'Aktivasi Lisensi Resmi';
  if (isBusiness) pageTitle = 'Aktivasi Lisensi WA Bot Bisnis AI';
  else if (isPersonal) pageTitle = 'Aktivasi Lisensi WA Asisten Pribadi AI';

  res.render('setup/step-0-license', getSetupContext({
    title: pageTitle,
    fingerprint,
    error: null,
    licenseKey: ''
  }));
});

router.post('/license', async (req, res) => {
  const { license_key, server_url } = req.body || {};
  const fingerprint = getDeviceFingerprint();

  if (!license_key || !license_key.trim()) {
    return res.render('setup/step-0-license', getSetupContext({
      title: 'Aktivasi Lisensi Resmi',
      fingerprint,
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
      title: 'Aktivasi Lisensi Resmi',
      fingerprint,
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

// Step 1: Profil / Pilih Mode
router.get('/', (req, res) => {
  const lic = checkLocalLicense();
  if (!lic.isValid) {
    return res.redirect('/setup/license');
  }
  return res.redirect('/setup/step-1');
});

router.get('/step-1', (req, res) => {
  const isBusiness = isBusinessEdition();
  const isPersonal = isPersonalEdition();

  let stepTitle = 'Langkah 1: Pilih Mode Bot';
  if (isBusiness) stepTitle = 'Langkah 1: Profil Bisnis & CS';
  else if (isPersonal) stepTitle = 'Langkah 1: Profil Asisten Pribadi';

  res.render('setup/step-1-mode', getSetupContext({
    title: stepTitle,
    currentStep: 1,
    error: null
  }));
});

router.post('/step-1', (req, res) => {
  let { mode, business_name, owner_phone } = req.body || {};
  const isBusiness = isBusinessEdition();
  const isPersonal = isPersonalEdition();

  // Kunci mode jika pada edisi spesifik
  if (isBusiness) {
    mode = 'bisnis';
  } else if (isPersonal) {
    mode = 'personal';
  }

  if (!mode || !['bisnis', 'personal'].includes(mode)) {
    return res.render('setup/step-1-mode', getSetupContext({
      title: 'Langkah 1: Pilih Mode Bot',
      currentStep: 1,
      config: { ...getConfig(), business_name, owner_phone },
      error: 'Silakan pilih salah satu mode yang tersedia (Mode Bisnis atau Mode Personal).'
    }));
  }

  // Tangani jika field dikirim sebagai array atau string
  const resolveFormField = (val, modeIdx = 0) => {
    if (Array.isArray(val)) {
      const nonEmpties = val.map(v => typeof v === 'string' ? v.trim() : '').filter(Boolean);
      return nonEmpties[modeIdx] || nonEmpties[0] || '';
    }
    return typeof val === 'string' ? val.trim() : '';
  };

  const modeIdx = mode === 'personal' ? 1 : 0;
  const bName = resolveFormField(business_name, modeIdx);
  const oPhone = resolveFormField(owner_phone, modeIdx);

  saveConfig({
    mode,
    business_name: bName,
    owner_phone: oPhone
  });

  try {
    if (typeof db.setSetting === 'function') {
      db.setSetting('mode', mode);
      if (bName) db.setSetting('business_name', bName);
      if (oPhone) {
        db.setSetting('owner_phone', oPhone);
        // Reset status onboarding agar pesan sambutan terkirim ke nomor baru ini
        db.setSetting('welcome_onboarding_sent', 'false');
      }
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
    const status = typeof getStatus === 'function' ? getStatus() : {};
    if (!status || (status.state !== 'ready' && status.state !== 'qr_ready')) {
      initClient();
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

// Step 4: Data Awal (Produk / Pengeluaran)
router.get('/step-4', (req, res) => {
  const config = getConfig();
  if (!config.mode) return res.redirect('/setup/step-1');
  if (!config.gemini_api_key) return res.redirect('/setup/step-3');

  const isBusiness = isBusinessEdition() || config.mode === 'bisnis';
  const stepTitle = isBusiness ? 'Langkah 4: Contoh Produk Katalog' : 'Langkah 4: Contoh Pengeluaran Awal';

  res.render('setup/step-4-initial-data', getSetupContext({
    title: stepTitle,
    currentStep: 4,
    error: null
  }));
});

router.post('/step-4', (req, res) => {
  const config = getConfig();
  const { product_name, product_price, product_stock, product_description, product_media_url, expense_category, expense_amount, expense_note } = req.body || {};

  try {
    if (config.mode === 'bisnis' && product_name && typeof product_name === 'string' && product_name.trim()) {
      if (typeof db.createProduct === 'function') {
        db.createProduct({
          name: product_name.trim(),
          price: Number(product_price) || 0,
          stock: Number(product_stock) || 0,
          description: product_description && typeof product_description === 'string' ? product_description.trim() : '',
          media_url: product_media_url && typeof product_media_url === 'string' && product_media_url.trim() ? product_media_url.trim() : null
        });
      }
    } else if (config.mode === 'personal' && expense_category && expense_amount) {
      if (typeof db.createExpense === 'function') {
        db.createExpense({
          category: typeof expense_category === 'string' ? expense_category.trim() : 'Lainnya',
          amount: Number(expense_amount) || 0,
          note: expense_note && typeof expense_note === 'string' ? expense_note.trim() : 'Data pengeluaran awal'
        });
      }
    }

    saveConfig({ is_setup_completed: true });
    if (typeof db.setSetting === 'function') {
      db.setSetting('is_setup_completed', 'true');
    }

    // Kirim pesan sambutan & panduan pertama kali ke WhatsApp Owner
    try {
      const { getClient } = require('../../engine');
      const { sendOneTimeOnboardingWelcome } = require('../../engine/onboarding');
      const client = getClient();
      if (client) {
        sendOneTimeOnboardingWelcome(client).catch(err => {
          console.warn('[Setup] Onboarding welcome error:', err.message);
        });
      }
    } catch (_) {}

    return res.redirect('/dashboard?tour=start');
  } catch (error) {
    return res.render('setup/step-4-initial-data', getSetupContext({
      title: 'Langkah 4: Masukkan Data Awal',
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

  // Kirim pesan sambutan & panduan pertama kali ke WhatsApp Owner
  try {
    const { getClient } = require('../../engine');
    const { sendOneTimeOnboardingWelcome } = require('../../engine/onboarding');
    const client = getClient();
    if (client) {
      sendOneTimeOnboardingWelcome(client).catch(err => {
        console.warn('[Setup] Onboarding welcome error:', err.message);
      });
    }
  } catch (_) {}

  return res.redirect('/dashboard?tour=start');
});

module.exports = router;

