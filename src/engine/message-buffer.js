const { getConfig } = require('../config');

// Menyimpan antrean gelembung pesan per kontak: Map<contactId, { messages: Message[], client: Client, timer: Timeout }>
const contactBuffers = new Map();

/**
 * Memasukkan pesan masuk ke antrean buffer debounce per kontak.
 * Jika pelanggan mengirim pesan lanjutan dalam jeda waktu debounce, timer direset dan pesan digabung.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} client 
 * @param {(aggregatedMessage: object, client: any, originalMessages: any[]) => Promise<void>} onBatchReady 
 * @param {number} [overrideDebounceMs] - Untuk pengujian unit test
 */
function enqueueIncomingMessage(message, client, onBatchReady, overrideDebounceMs = null) {
  const contact = message.from || 'unknown';
  const config = getConfig();

  // Tentukan durasi debounce (default 5 detik jika tidak ditentukan)
  let debounceMs = overrideDebounceMs;
  if (debounceMs === null || typeof debounceMs === 'undefined') {
    if (process.env.NODE_ENV === 'test' || process.env.NO_DELAY) {
      debounceMs = 100; // Cepat di lingkungan test
    } else {
      const waitSec = Number(config.customer_debounce_sec) || 5;
      debounceMs = Math.max(1, waitSec) * 1000;
    }
  }

  // Ambil atau inisialisasi buffer kontak
  let entry = contactBuffers.get(contact);

  if (entry) {
    // Reset timer debounce yang sedang berjalan
    clearTimeout(entry.timer);
    entry.messages.push(message);
    entry.client = client;
    console.log(`[MessageBuffer] Menampung chat ke-${entry.messages.length} dari ${contact}. Mereset timer debounce (${(debounceMs / 1000).toFixed(1)}s)...`);
  } else {
    entry = {
      messages: [message],
      client,
      timer: null
    };
    contactBuffers.set(contact, entry);
    console.log(`[MessageBuffer] Memulai debounce buffer (${(debounceMs / 1000).toFixed(1)}s) untuk kontak ${contact}...`);
  }

  // Pasang timer eksekusi setelah pelanggan berhenti mengirim pesan
  entry.timer = setTimeout(async () => {
    contactBuffers.delete(contact);

    const collected = entry.messages;
    if (collected.length === 1) {
      // Hanya 1 gelembung pesan
      await onBatchReady(collected[0], entry.client, collected);
    } else {
      // Gabungkan beberapa gelembung pesan menjadi satu
      const combinedBody = collected
        .map(m => (m.body || '').trim())
        .filter(Boolean)
        .join('\n');

      const lastMsg = collected[collected.length - 1];
      
      // Buat objek gabungan dengan prototype dari last message
      const aggregatedMessage = Object.create(lastMsg);
      aggregatedMessage.body = combinedBody;
      aggregatedMessage.isAggregated = true;
      aggregatedMessage.bubbleCount = collected.length;
      aggregatedMessage.originalMessages = collected;

      console.log(`[MessageBuffer] ✅ Pelanggan ${contact} selesai mengirim (${collected.length} gelembung chat). Mengirim ke AI:\n"${combinedBody}"`);
      await onBatchReady(aggregatedMessage, entry.client, collected);
    }
  }, debounceMs);
}

/**
 * Membersihkan semua buffer yang sedang aktif (misal saat restart/shutdown).
 */
function clearAllBuffers() {
  for (const entry of contactBuffers.values()) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  contactBuffers.clear();
}

/**
 * Mengambil jumlah kontak yang saat ini sedang dalam buffer debounce.
 * @returns {number}
 */
function getActiveBufferCount() {
  return contactBuffers.size;
}

module.exports = {
  enqueueIncomingMessage,
  clearAllBuffers,
  getActiveBufferCount
};
