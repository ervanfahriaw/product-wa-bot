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

/**
 * GET /api/logs
 * Mengambil baris log runtime terbaru untuk keperluan diagnostik.
 */
router.get('/logs', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { BASE_DIR } = require('../../utils/paths');
    const logFile = path.join(BASE_DIR, 'node_server.log');
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.trim().split('\n');
      return res.json({ success: true, logs: lines.slice(-80) });
    }
    return res.json({ success: true, logs: ['Belum ada berkas log.'] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/settings/pause-orders
 * Mengatur jeda penerimaan pesanan dan alasan kustom bagi pelanggan.
 */
router.post('/settings/pause-orders', (req, res) => {
  try {
    const db = require('../../db');
    const { getConfig } = require('../../config');
    const { paused, reason } = req.body;
    const isPaused = Boolean(paused);
    const pauseReason = typeof reason === 'string' ? reason.trim() : '';

    if (db.setSetting) {
      db.setSetting('pause_orders', isPaused ? 'true' : 'false');
      if (pauseReason) {
        db.setSetting('pause_orders_reason', pauseReason);
      }
    }

    const config = getConfig();
    config.pause_orders = isPaused;
    if (pauseReason) {
      config.pause_orders_reason = pauseReason;
    }

    return res.json({
      success: true,
      paused: isPaused,
      reason: pauseReason || config.pause_orders_reason || 'Mohon maaf, saat ini kami sedang menjeda penerimaan pesanan baru karena pesanan sedang membludak. Silakan hubungi kami beberapa saat lagi ya Kak! 🙏'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
