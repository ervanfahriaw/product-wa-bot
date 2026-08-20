const fs = require('fs');
const path = require('path');

const { getConfig } = require('../config');
const { buildContext } = require('./context-builder');
const { callGemini, validateGeminiKey } = require('./providers/gemini');
const { callGrok, validateGrokKey } = require('./providers/grok');

const PROMPT_DIR = path.resolve(__dirname, 'prompts');

const { getUserPreferences } = require('../utils/user-preferences');

/**
 * Menghasilkan instruksi persona dan gaya bahasa tambahan sesuai preferensi config.
 * @param {object} config 
 * @param {'bisnis'|'personal'} [mode='bisnis']
 * @returns {string}
 */
function buildPersonalityPrompt(config = {}, mode = 'bisnis') {
  const instructions = [];
  const isPersonal = mode === 'personal';
  const userPrefs = isPersonal ? getUserPreferences() : {};

  // 1. Gaya Bicara / Tone & Panggilan
  const tone = config.tone_style || 'ramah';
  
  if (isPersonal && (userPrefs.callUserAs || userPrefs.disallowKak)) {
    const greetingName = userPrefs.callUserAs || userPrefs.userName || 'kamu';
    instructions.push(`- GAYA BICARA & SAPAAN: Akrab, suportif, dan solutif. Sapa pengguna dengan nama/panggilan "${greetingName}". JANGAN SEKALI-KALI menggunakan sapaan "Kak" atau "Kakak".`);
    if (userPrefs.assistantName) {
      instructions.push(`- IDENTITAS ASISTEN: Nama Anda adalah "${userPrefs.assistantName}". Posisikan diri Anda sebagai "${userPrefs.assistantName}".`);
    }
  } else if (tone === 'santai') {
    const sapaan = isPersonal ? 'Sapa secara santai/akrab atau dengan "kamu"' : 'Sapa dengan "Kak"';
    instructions.push(`- GAYA BICARA: Santai, gaul, akrab, luwes, dan kekinian layaknya mengobrol santai dengan teman di WhatsApp. ${sapaan}.`);
  } else if (tone === 'formal') {
    instructions.push('- GAYA BICARA: Formal, baku, sangat santun, profesional, dan terstruktur rapi.');
  } else {
    const sapaan = isPersonal ? 'Sapa dengan ramah dan hangat' : 'Sapa dengan "Kak" atau "Kakak"';
    instructions.push(`- GAYA BICARA: Hangat, ramah, sopan, dan bersahabat. ${sapaan}.`);
  }

  // 2. Panjang Jawaban
  const length = config.response_length || 'sedang';
  if (length === 'ringkas') {
    instructions.push('- PANJANG BALASAN: Ringkas, padat, dan to the point (maksimal 1-2 kalimat/paragraf singkat). Langsung ke inti tanpa basa-basi panjang.');
  } else if (length === 'detail') {
    instructions.push('- PANJANG BALASAN: Lengkap dan detail. Jelaskan informasi secara runtut dan jelas.');
  } else {
    instructions.push('- PANJANG BALASAN: Sedang dan proporsional. Berikan informasi yang cukup dan to the point tanpa bertele-tele.');
  }

  // 3. Intensitas Emoji
  const emoji = config.emoji_level || 'wajar';
  if (emoji === 'minimal') {
    instructions.push('- PENGGUNAAN EMOJI: Minimalis. Gunakan sedikit sekali atau tanpa emoji sama sekali (maksimal 1 emoji jika sangat diperlukan).');
  } else if (emoji === 'ekspresif') {
    instructions.push('- PENGGUNAAN EMOJI: Ekspresif dan ceria. Gunakan emoji yang menarik dan variatif (3-5 emoji) agar pesan terasa hidup dan seru.');
  } else {
    instructions.push('- PENGGUNAAN EMOJI: Wajar dan secukupnya (1-2 emoji yang sopan seperti 😊, 🙏, ✨).');
  }

  return `\n\n## ⚙️ Kustomisasi Gaya Respon Tambahan:\n${instructions.join('\n')}`;
}

/**
 * Membaca system prompt sesuai mode dan konfigurasi persona.
 * @param {'bisnis'|'personal'} mode 
 * @param {object} config 
 * @returns {string}
 */
function loadSystemPrompt(mode, config = {}) {
  const businessName = config.business_name || 'Toko Kami';
  let baseContent = 'Anda adalah asisten WhatsApp yang ramah dan solutif.';
  try {
    const modeFolder = (mode === 'bisnis' || mode === 'business') ? 'business' : mode;
    const promptPath = path.join(PROMPT_DIR, modeFolder, 'base.md');
    if (fs.existsSync(promptPath)) {
      baseContent = fs.readFileSync(promptPath, 'utf-8');
      baseContent = baseContent.replace(/\{BUSINESS_NAME\}/g, businessName);
    }
  } catch (err) {
    console.error('[AI Router] Gagal membaca system prompt:', err.message);
  }

  return baseContent + buildPersonalityPrompt(config, mode);
}

/**
 * Menghasilkan balasan AI dari pesan pengguna (Router Tunggal AI).
 * @param {object} params
 * @param {string} params.message
 * @param {'bisnis'|'personal'} [params.mode]
 * @param {string|null} [params.imageBase64]
 * @param {string|null} [params.apiKeyOverride]
 * @param {string|null} [params.contact]
 * @returns {Promise<{reply: string, error: string|null, handledBy: string, handoverRequired: boolean}>}
 */
async function generateReply({ message, mode = null, imageBase64 = null, apiKeyOverride = null, contact = null }) {
  const config = getConfig();
  const activeMode = mode || config.mode || 'bisnis';
  const geminiKey = apiKeyOverride || config.gemini_api_key;
  const grokKey = config.grok_api_key;
  const selectedModel = config.ai_model || 'gemini-3.7-flash';

  // 1. Bangun RAG Context dari database SQLite + Riwayat Chat
  const dbContext = buildContext(message, activeMode, contact);
  
  // 2. Susun System Prompt dengan kustomisasi persona
  const systemPrompt = loadSystemPrompt(activeMode, config);
  const fullPrompt = `${dbContext}\n\nPesan Pelanggan / User:\n"${message}"`;

  let response;

  // 3. Routing ke provider AI yang sesuai
  if (imageBase64 && grokKey) {
    response = await callGrok(message, imageBase64, { apiKey: grokKey });
  } else {
    response = await callGemini(fullPrompt, systemPrompt, { 
      apiKey: geminiKey,
      model: selectedModel
    });
  }

/**
 * Membersihkan format teks agar rapi dan sesuai format WhatsApp (*tebal*, bukan **tebal**).
 * @param {string} text 
 * @returns {string}
 */
function cleanWhatsAppFormatting(text = '') {
  if (!text) return '';
  return text
    // Ubah markdown heading (### Judul / ## Judul / # Judul) -> *Judul*
    .replace(/^#{1,4}\s+(.+)$/gm, '*$1*')
    // Ubah double asterisks (**tebal**) -> single asterisk (*tebal*)
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    // Rapikan baris kosong berlebih
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

  // 4. Deteksi kebutuhan human handover & bersihkan format teks untuk WhatsApp
  const rawReply = response.reply || '';
  const handoverRequired = rawReply.includes('[HANDOVER_REQUIRED]');
  const withoutTag = rawReply.replace(/\[HANDOVER_REQUIRED\]/g, '').trim();
  const cleanReply = cleanWhatsAppFormatting(withoutTag);

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
