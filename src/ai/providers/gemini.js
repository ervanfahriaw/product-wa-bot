const FALLBACK_MESSAGE = 'Halo! Mohon maaf, saat ini asisten bot sedang mengalami kendala koneksi ke server AI. Pertanyaan Anda sudah kami catat dan akan dibalas oleh admin kami secepatnya ya, Kak 🙏';

const CANDIDATE_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-2.5-flash',
  'gemini-1.5-flash'
];

let cachedWorkingModel = 'gemini-3.7-flash';

/**
 * Mencari model Gemini yang aktif dan didukung untuk API key ini.
 * @param {string} apiKey 
 * @param {string} [preferredModel]
 * @returns {Promise<string[]>}
 */
async function resolveSupportedModels(apiKey, preferredModel = null) {
  const cleanKey = apiKey.trim();
  const targetModel = (preferredModel && preferredModel !== 'auto') ? preferredModel : null;

  if (targetModel) {
    const list = [targetModel, cachedWorkingModel, ...CANDIDATE_MODELS].filter(Boolean);
    return Array.from(new Set(list));
  }

  if (cachedWorkingModel) {
    const list = [cachedWorkingModel, ...CANDIDATE_MODELS].filter(Boolean);
    return Array.from(new Set(list));
  }

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (listRes.ok) {
      const data = await listRes.json();
      if (data.models && Array.isArray(data.models)) {
        const supported = data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .filter(name => !name.includes('tts') && !name.includes('robotics') && !name.includes('image'));

        if (supported.length > 0) {
          const preferred = supported.find(m => m === 'gemini-3.7-flash')
            || supported.find(m => m === 'gemini-3.6-flash')
            || supported.find(m => m === 'gemini-3.5-flash')
            || supported.find(m => m === 'gemini-flash-latest')
            || supported.find(m => m.includes('flash'))
            || supported[0];
          
          cachedWorkingModel = preferred;
          return [preferred, ...supported.filter(m => m !== preferred)];
        }
      }
    }
  } catch (_) {}

  return CANDIDATE_MODELS;
}

/**
 * Memanggil Gemini API untuk menghasilkan balasan teks.
 * @param {string} prompt Pesan pengguna beserta konteks
 * @param {string} systemInstruction Instruksi prompt sistem
 * @param {object} options
 * @param {string} options.apiKey API Key Gemini milik pengguna
 * @param {string} [options.model]
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

  const cleanKey = apiKey.trim();
  const requestedModel = options.model || null;
  const modelList = await resolveSupportedModels(cleanKey, requestedModel);

  for (const model of modelList) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

    const genConfig = {
      temperature: 0.7,
      maxOutputTokens: 2048
    };

    // thinkingConfig hanya didukung oleh model 3.7 / 2.5
    if (model.includes('3.7') || model.includes('2.5')) {
      genConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: genConfig
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[Gemini API] Model ${model} HTTP Error ${response.status}:`, errBody.substring(0, 150));
        
        if (response.status === 400 && (errBody.includes('API_KEY_INVALID') || errBody.includes('API key not valid'))) {
          return {
            reply: FALLBACK_MESSAGE,
            error: 'INVALID_API_KEY'
          };
        }
        continue;
      }

      const data = await response.json();
      const candidate = data.candidates && data.candidates[0];
      if (!candidate) continue;

      const nonThoughtParts = candidate.content?.parts?.filter(p => !p.thought) || [];
      const textPart = nonThoughtParts.map(p => p.text).filter(Boolean).join('') || candidate.content?.parts?.[0]?.text;

      if (!textPart || textPart.trim() === '') {
        continue;
      }

      // Simpan model yang terbukti berhasil
      cachedWorkingModel = model;

      return {
        reply: textPart.trim(),
        error: null
      };
    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      console.error(`[Gemini API] Model ${model} Error:`, isTimeout ? 'Timeout' : err.message);
    }
  }

  return {
    reply: FALLBACK_MESSAGE,
    error: 'ALL_MODELS_FAILED'
  };
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

  const cleanKey = apiKey.trim();
  const models = await resolveSupportedModels(cleanKey);

  let lastError = 'Koneksi gagal.';

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Halo' }] }],
          generationConfig: { maxOutputTokens: 10 }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        cachedWorkingModel = model;
        return { 
          valid: true, 
          message: `Koneksi ke Gemini API berhasil dan valid! (Model aktif: ${model})` 
        };
      }

      const errData = await response.json().catch(() => ({}));
      lastError = errData.error?.message || `HTTP status ${response.status}`;
      
      // Jika key invalid, hentikan langsung
      if (response.status === 400 && lastError.includes('API key not valid')) {
        return { valid: false, message: `Gagal: ${lastError}` };
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  return { valid: false, message: `Gagal: ${lastError}` };
}

module.exports = {
  callGemini,
  validateGeminiKey,
  FALLBACK_MESSAGE
};
