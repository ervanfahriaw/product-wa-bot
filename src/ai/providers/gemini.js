const FALLBACK_MESSAGE = 'Halo! Mohon maaf, saat ini asisten bot sedang mengalami kendala koneksi ke server AI. Pertanyaan Anda sudah kami catat dan akan dibalas oleh admin kami secepatnya ya, Kak 🙏';

/**
 * Memanggil Gemini API untuk menghasilkan balasan teks.
 * @param {string} prompt Pesan pengguna beserta konteks
 * @param {string} systemInstruction Instruksi prompt sistem
 * @param {object} options
 * @param {string} options.apiKey API Key Gemini milik pengguna
 * @param {string} [options.model='gemini-1.5-flash']
 * @returns {Promise<{reply: string, error: string|null}>}
 */
async function callGemini(prompt, systemInstruction = '', options = {}) {
  const apiKey = options.apiKey;

  if (!apiKey || apiKey.trim() === '') {
    return {
      reply: 'Kunci akses AI (Gemini API Key) belum diatur di pengaturan bot.',
      error: 'EMPTY_API_KEY'
    };
  }

  const model = options.model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[Gemini API] HTTP Error ${response.status}:`, errBody.substring(0, 150));
      return {
        reply: FALLBACK_MESSAGE,
        error: `HTTP_${response.status}`
      };
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    const textPart = candidate?.content?.parts?.[0]?.text;

    if (!textPart) {
      return {
        reply: FALLBACK_MESSAGE,
        error: 'EMPTY_RESPONSE_CANDIDATE'
      };
    }

    return {
      reply: textPart.trim(),
      error: null
    };
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    console.error('[Gemini API] Request Error:', isTimeout ? 'Request Timeout (15s)' : err.message);
    return {
      reply: FALLBACK_MESSAGE,
      error: isTimeout ? 'TIMEOUT' : err.message
    };
  }
}

/**
 * Validasi keaktifan API Key Gemini dengan test-call ringan.
 * @param {string} apiKey 
 * @returns {Promise<{valid: boolean, message: string}>}
 */
async function validateGeminiKey(apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, message: 'API key tidak boleh kosong.' };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 5 }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { valid: true, message: 'Koneksi ke Gemini API berhasil dan valid!' };
    }

    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || `HTTP status ${response.status}`;
    return { valid: false, message: `Gagal: ${errMsg}` };
  } catch (err) {
    return { valid: false, message: `Koneksi gagal: ${err.message}` };
  }
}

module.exports = {
  callGemini,
  validateGeminiKey,
  FALLBACK_MESSAGE
};
