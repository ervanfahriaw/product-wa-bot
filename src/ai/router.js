const fs = require('fs');
const path = require('path');

const { getConfig } = require('../config');
const { buildContext } = require('./context-builder');
const { callGemini, validateGeminiKey } = require('./providers/gemini');
const { callGrok, validateGrokKey } = require('./providers/grok');

const PROMPT_DIR = path.resolve(__dirname, 'prompts');

/**
 * Membaca system prompt sesuai mode.
 * @param {'bisnis'|'personal'} mode 
 * @param {string} businessName 
 * @returns {string}
 */
function loadSystemPrompt(mode, businessName = 'Toko Kami') {
  try {
    const promptPath = path.join(PROMPT_DIR, mode, 'base.md');
    if (fs.existsSync(promptPath)) {
      let content = fs.readFileSync(promptPath, 'utf-8');
      return content.replace(/\{BUSINESS_NAME\}/g, businessName || 'Toko Kami');
    }
  } catch (err) {
    console.error('[AI Router] Gagal membaca system prompt:', err.message);
  }
  return 'Anda adalah asisten WhatsApp yang ramah dan solutif.';
}

/**
 * Menghasilkan balasan AI dari pesan pengguna (Router Tunggal AI).
 * @param {object} params
 * @param {string} params.message
 * @param {'bisnis'|'personal'} [params.mode]
 * @param {string|null} [params.imageBase64]
 * @param {string|null} [params.apiKeyOverride]
 * @returns {Promise<{reply: string, error: string|null, handledBy: string, handoverRequired: boolean}>}
 */
async function generateReply({ message, mode = null, imageBase64 = null, apiKeyOverride = null }) {
  const config = getConfig();
  const activeMode = mode || config.mode || 'bisnis';
  const geminiKey = apiKeyOverride || config.gemini_api_key;
  const grokKey = config.grok_api_key;

  // 1. Bangun RAG Context dari database SQLite
  const dbContext = buildContext(message, activeMode);
  
  // 2. Susun System Prompt
  const systemPrompt = loadSystemPrompt(activeMode, config.business_name);
  const fullPrompt = `${dbContext}\n\nPesan Pelanggan / User:\n"${message}"`;

  let response;

  // 3. Routing ke provider AI yang sesuai
  if (imageBase64 && grokKey) {
    response = await callGrok(message, imageBase64, { apiKey: grokKey });
  } else {
    response = await callGemini(fullPrompt, systemPrompt, { apiKey: geminiKey });
  }

  // 4. Deteksi kebutuhan human handover
  const rawReply = response.reply || '';
  const handoverRequired = rawReply.includes('[HANDOVER_REQUIRED]');
  const cleanReply = rawReply.replace(/\[HANDOVER_REQUIRED\]/g, '').trim();

  return {
    reply: cleanReply,
    error: response.error,
    handledBy: 'ai',
    handoverRequired
  };
}

/**
 * Memvalidasi API key penyedia AI tertentu.
 * @param {'gemini'|'grok'} provider 
 * @param {string} apiKey 
 * @returns {Promise<{valid: boolean, message: string}>}
 */
async function validateKey(provider, apiKey) {
  if (provider === 'grok') {
    return validateGrokKey(apiKey);
  }
  return validateGeminiKey(apiKey);
}

module.exports = {
  generateReply,
  validateKey,
  loadSystemPrompt
};
