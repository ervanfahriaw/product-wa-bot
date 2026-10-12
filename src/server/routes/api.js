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

/**
 * POST /api/restart
 * Memulai ulang WhatsApp engine (Soft Reconnect) secara instan tanpa menghapus sesi login.
 */
router.post('/restart', async (req, res) => {
  try {
    const { reconnectClient } = require('../../engine');
    await reconnectClient();
    return res.json({
      success: true,
      message: 'WhatsApp Engine berhasil dimulai ulang.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/reconnect
 * Menyambungkan ulang WhatsApp engine (Soft Reconnect) tanpa menghapus sesi login.
 */
router.post('/reconnect', async (req, res) => {
  try {
    const { reconnectClient } = require('../../engine');
    await reconnectClient();
    return res.json({
      success: true,
      message: 'Menyambungkan ulang WhatsApp Engine...'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/shutdown
 * Mematikan bot dan server secara aman dan anggun.
 */
router.post('/shutdown', async (req, res) => {
  res.json({
    success: true,
    message: 'Bot sedang dimatikan secara aman...'
  });

  setTimeout(async () => {
    try {
      const { destroyClient } = require('../../engine');
      await destroyClient();
    } catch (_) {}
    process.exit(0);
  }, 400);
});

module.exports = router;
