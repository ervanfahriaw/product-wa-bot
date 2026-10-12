const { getConfig } = require('../config');

/**
 * Utility helper untuk sleep/delay promise.
 * @param {number} ms 
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Menghitung jeda manusiawi alami (anti-ban pacing delays) dengan variasi acak (jitter 85% - 115%).
 * @param {object} [config] - Config aplikasi
 * @param {number} [customMinMs] - Override batas minimal durasi mengetik
 * @param {number} [customMaxMs] - Override batas maksimal durasi mengetik
 * @returns {{ preReadDelay: number, postReadDelay: number, typingDelay: number }}
 */
function calculatePacingDelays(config = {}, customMinMs = null, customMaxMs = null) {
  const minDelaySec = Number(config.min_delay_sec) || 5;
  const maxDelaySec = Number(config.max_delay_sec) || 12;

  const resolvedMin = customMinMs !== null && typeof customMinMs !== 'undefined'
    ? customMinMs
    : minDelaySec * 1000;

  const resolvedMax = customMaxMs !== null && typeof customMaxMs !== 'undefined'
    ? customMaxMs
    : maxDelaySec * 1000;

  const minTyping = Math.min(resolvedMin, resolvedMax);
  const maxTyping = Math.max(resolvedMin, resolvedMax);

  // 1. Jeda sebelum membuka chat (Pre-Read Delay): 1.0s - 2.5s acak
  const preReadDelay = Math.round((1000 + Math.random() * 1500) * (0.85 + Math.random() * 0.3));

  // 2. Jeda membaca isi chat setelah dibuka (Post-Read Delay): 1.0s - 2.2s acak
  const postReadDelay = Math.round((1000 + Math.random() * 1200) * (0.85 + Math.random() * 0.3));

  // 3. Durasi mengetik balasan (Typing Delay)
  const baseTyping = Math.floor(Math.random() * (maxTyping - minTyping + 1)) + minTyping;
  const typingDelay = Math.round(baseTyping * (0.9 + Math.random() * 0.2));

  return {
    preReadDelay,
    postReadDelay,
    typingDelay
  };
}

/**
 * Mensimulasikan siklus lengkap perilaku manusia di WhatsApp (Anti-Ban Human Pacing):
 * 1. Jeda Respon Masuk (Pre-Read Delay)
 * 2. Tandai Telah Dibaca (sendSeen / Centang Biru)
 * 3. Jeda Membaca & Memahami Pesan (Post-Read Delay)
 * 4. Tampilkan Status Mengetik (sendStateTyping / "Sedang mengetik...")
 * 5. Durasi Mengetik Alami (Typing Delay)
 * 6. Bersihkan Status Mengetik (clearState)
 * 
 * @param {import('whatsapp-web.js').Message} message 
 * @param {object} [options]
 * @param {number} [options.minMs]
 * @param {number} [options.maxMs]
 * @param {number} [options.preReadMs]
 * @param {number} [options.postReadMs]
 * @param {boolean} [options.skipDelays]
 * @param {boolean} [options.forceRealDelay]
 * @returns {Promise<object>} Status eksekusi laporan pacing
 */
async function simulateHumanPacing(message, options = {}) {
  const report = {
    chatAvailable: false,
    seenCalled: false,
    seenError: false,
    typingCalled: false,
    typingError: false,
    clearedCalled: false,
    preReadDelay: 0,
    postReadDelay: 0,
    typingDelay: 0
  };

  if (!message) return report;

  const isTest = (process.env.NODE_ENV === 'test' || process.env.NO_DELAY) && !options.forceRealDelay;
  const skipDelays = Boolean(options.skipDelays || isTest);

  let chat = null;
  try {
    chat = typeof message.getChat === 'function' ? await message.getChat().catch(() => null) : null;
  } catch (_) {
    chat = null;
  }

  if (!chat) {
    return report;
  }
  report.chatAvailable = true;

  let config = {};
  try {
    config = typeof getConfig === 'function' ? getConfig() : {};
  } catch (_) {}

  const delays = calculatePacingDelays(config, options.minMs, options.maxMs);

  report.preReadDelay = options.preReadMs !== undefined ? options.preReadMs : delays.preReadDelay;
  report.postReadDelay = options.postReadMs !== undefined ? options.postReadMs : delays.postReadDelay;
  report.typingDelay = delays.typingDelay;

  // 1. Jeda Respon Awal (Pre-Read Delay)
  if (!skipDelays && report.preReadDelay > 0) {
    console.log(`[Anti-Ban] Jeda sebelum membuka pesan (${(report.preReadDelay / 1000).toFixed(1)}s)...`);
    await sleep(report.preReadDelay);
  }

  // 2. Tandai Telah Dibaca (sendSeen / Centang Biru)
  if (typeof chat.sendSeen === 'function') {
    try {
      await chat.sendSeen();
      report.seenCalled = true;
      if (!isTest) {
        console.log(`[Anti-Ban] ✅ Pesan ditandai telah dibaca (sendSeen / centang biru)`);
      }
    } catch (seenErr) {
      report.seenError = true;
      console.warn(`[Anti-Ban] (Non-fatal) chat.sendSeen gagal:`, seenErr.message);
    }
  }

  // 3. Jeda Membaca Pesan setelah dibuka (Post-Read Delay)
  if (!skipDelays && report.postReadDelay > 0) {
    console.log(`[Anti-Ban] Jeda membaca isi pesan (${(report.postReadDelay / 1000).toFixed(1)}s)...`);
    await sleep(report.postReadDelay);
  }

  // 4. Status Mengetik (sendStateTyping)
  if (typeof chat.sendStateTyping === 'function') {
    try {
      await chat.sendStateTyping();
      report.typingCalled = true;
    } catch (typingErr) {
      report.typingError = true;
      console.warn(`[Anti-Ban] (Non-fatal) chat.sendStateTyping gagal:`, typingErr.message);
    }
  }

  // 5. Durasi Mengetik Alami
  if (!skipDelays && report.typingDelay > 0) {
    console.log(`[Anti-Ban] Mensimulasikan durasi mengetik (${(report.typingDelay / 1000).toFixed(1)}s)...`);
    await sleep(report.typingDelay);
  }

  // 6. Bersihkan Status Mengetik (clearState)
  if (typeof chat.clearState === 'function') {
    try {
      await chat.clearState();
      report.clearedCalled = true;
    } catch (_) {}
  }

  return report;
}

module.exports = {
  simulateHumanPacing,
  calculatePacingDelays,
  sleep
};
