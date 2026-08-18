/**
 * Memecah teks panjang menjadi beberapa gelembung chat (bubbles) secara alami
 * berdasarkan batas paragraf dan alur percakapan.
 * @param {string} text 
 * @param {number} [maxBubbles=3] 
 * @returns {string[]}
 */
function splitIntoBubbles(text = '', maxBubbles = 3) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  
  // Jika pesan pendek (< 250 karakter), jadikan 1 bubble saja
  if (clean.length < 250) {
    return [clean];
  }

  // Pisahkan berdasarkan garis pembatas (---) atau paragraf ganda (\n\n)
  const rawSections = clean
    .split(/\n\s*---\s*\n|\n{2,}/)
    .map(s => s.trim())
    .filter(Boolean);

  if (rawSections.length <= 1) {
    return [clean];
  }

  const bubbles = [];
  let current = '';

  for (let i = 0; i < rawSections.length; i++) {
    const sec = rawSections[i];

    if (!current) {
      current = sec;
    } else if (current.length + sec.length < 320 && bubbles.length < maxBubbles - 1) {
      current += '\n\n' + sec;
    } else {
      bubbles.push(current);
      current = sec;
    }

    // Jika sudah mencapai batas gelembung maksimal sebelum gelembung terakhir
    if (bubbles.length === maxBubbles - 1) {
      const remaining = rawSections.slice(i + 1);
      if (remaining.length > 0) {
        current += '\n\n' + remaining.join('\n\n');
      }
      break;
    }
  }

  if (current && !bubbles.includes(current)) {
    bubbles.push(current);
  }

  return bubbles.filter(Boolean);
}

/**
 * Menghitung jeda mengetik antar-gelembung dengan variasi acak (jitter) manusiawi.
 * @param {number} baseSec 
 * @param {number} textLength 
 * @returns {number} Delay in milliseconds
 */
function calculateInterBubbleDelay(baseSec = 2.5, textLength = 0) {
  const baseMs = (Number(baseSec) || 2.5) * 1000;
  const lengthBonus = Math.min(1500, textLength * 10);
  const jitterFactor = 0.85 + Math.random() * 0.3; // variasi acak 85% - 115%
  const total = (baseMs + lengthBonus) * jitterFactor;
  return Math.min(6000, Math.max(1000, Math.round(total)));
}

/**
 * Mengirim pesan secara bertahap (multi-bubble) dengan simulasi jeda mengetik antar-gelembung.
 * @param {import('whatsapp-web.js').Message} message 
 * @param {import('whatsapp-web.js').Client} client 
 * @param {string} contact 
 * @param {string[]} bubbles 
 * @param {object} [options]
 * @param {number} [options.interBubbleDelay=2.5]
 */
async function sendMultiBubbleMessages(message, client, contact, bubbles, options = {}) {
  if (!bubbles || bubbles.length === 0) return;

  const chat = typeof message.getChat === 'function' ? await message.getChat().catch(() => null) : null;
  const baseInterDelay = Number(options.interBubbleDelay) || 2.5;

  for (let i = 0; i < bubbles.length; i++) {
    const bubble = bubbles[i];

    if (i === 0) {
      // Bubble pertama: dikirim langsung (karena jeda membaca/mengetik awal sudah selesai)
      if (typeof message.reply === 'function') {
        await message.reply(bubble);
      } else if (client && typeof client.sendMessage === 'function') {
        await client.sendMessage(contact, bubble);
      }
    } else {
      // Bubble berikutnya: simulasi jeda mengetik realistis dengan random jitter
      if (process.env.NODE_ENV !== 'test' && !process.env.NO_DELAY) {
        if (chat && typeof chat.sendStateTyping === 'function') {
          await chat.sendStateTyping().catch(() => {});
        }
        
        const typingDelay = calculateInterBubbleDelay(baseInterDelay, bubble.length);
        console.log(`[Anti-Ban] Mengetik gelembung ke-${i + 1} (${(typingDelay / 1000).toFixed(1)}s)...`);
        await new Promise(resolve => setTimeout(resolve, typingDelay));

        if (chat && typeof chat.clearState === 'function') {
          await chat.clearState().catch(() => {});
        }
      }

      // Kirim gelembung berikutnya
      if (client && typeof client.sendMessage === 'function') {
        await client.sendMessage(contact, bubble);
      } else if (typeof message.reply === 'function') {
        await message.reply(bubble);
      }
    }
  }
}

module.exports = {
  splitIntoBubbles,
  calculateInterBubbleDelay,
  sendMultiBubbleMessages
};
