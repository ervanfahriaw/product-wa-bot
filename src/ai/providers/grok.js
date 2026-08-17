const GROK_FALLBACK_MESSAGE = 'Mohon maaf, fitur analisis gambar sedang tidak tersedia atau kunci akses Grok belum diaktifkan.';

/**
 * Memanggil Grok API (xAI) untuk membaca gambar / teks multimodal.
 * @param {string} prompt 
 * @param {string|null} imageBase64 
 * @param {object} options 
 * @param {string} options.apiKey API Key xAI/Grok
 * @returns {Promise<{reply: string, error: string|null}>}
 */
async function callGrok(prompt, imageBase64 = null, options = {}) {
  const apiKey = options.apiKey;

  if (!apiKey || apiKey.trim() === '') {
    return {
      reply: GROK_FALLBACK_MESSAGE,
      error: 'GROK_KEY_NOT_CONFIGURED'
    };
  }

  const url = 'https://api.x.ai/v1/chat/completions';
  const userContent = [];

  if (prompt) {
    userContent.push({ type: 'text', text: prompt });
  }

  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
    });
  }

  const payload = {
    model: 'grok-vision-beta',
    messages: [
      {
        role: 'system',
        content: 'Anda adalah asisten WhatsApp yang membantu mengidentifikasi produk dari foto yang dikirim pembeli.'
      },
      {
        role: 'user',
        content: userContent.length === 1 && userContent[0].type === 'text' ? prompt : userContent
      }
    ],
    temperature: 0.5,
    max_tokens: 500
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Grok API] HTTP Error ${response.status}:`, errText.substring(0, 150));
      return { reply: GROK_FALLBACK_MESSAGE, error: `HTTP_${response.status}` };
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    return {
      reply: reply ? reply.trim() : GROK_FALLBACK_MESSAGE,
      error: null
    };
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    console.error('[Grok API] Request Error:', isTimeout ? 'Request Timeout' : err.message);
    return {
      reply: GROK_FALLBACK_MESSAGE,
      error: isTimeout ? 'TIMEOUT' : err.message
    };
  }
}

/**
 * Validasi keaktifan API Key Grok.
 * @param {string} apiKey 
 * @returns {Promise<{valid: boolean, message: string}>}
 */
async function validateGrokKey(apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, message: 'API key Grok tidak boleh kosong.' };
  }

  try {
    const response = await fetch('https://api.x.ai/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
    });

    if (response.ok) {
      return { valid: true, message: 'Koneksi ke Grok API berhasil dan valid!' };
    }
    return { valid: false, message: `Grok API menolak autentikasi (HTTP ${response.status})` };
  } catch (err) {
    return { valid: false, message: `Koneksi ke Grok gagal: ${err.message}` };
  }
}

module.exports = {
  callGrok,
  validateGrokKey,
  GROK_FALLBACK_MESSAGE
};
