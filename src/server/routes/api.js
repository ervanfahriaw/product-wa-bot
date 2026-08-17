const express = require('express');
const router = express.Router();
const { getStatus, initClient, resetSession } = require('../../engine');

/**
 * GET /api/status
 * Mengambil status koneksi WhatsApp engine saat ini.
 */
router.get('/status', (req, res) => {
  const status = getStatus();
  return res.json({
    success: true,
    data: status
  });
});

/**
 * POST /api/init-engine
 * Memulai inisialisasi WhatsApp engine.
 */
router.post('/init-engine', (req, res) => {
  try {
    initClient({}, true);
    const status = getStatus();
    return res.json({
      success: true,
      message: 'WhatsApp Engine diinisialisasi.',
      data: status
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/reset-session
 * Membersihkan sesi login lama dan membuat QR baru.
 */
router.post('/reset-session', async (req, res) => {
  try {
    await resetSession();
    return res.json({
      success: true,
      message: 'Sesi WhatsApp berhasil di-reset. Menghasilkan QR code baru...'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
