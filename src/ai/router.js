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
  const isAdmin = mode === 'admin';
  if (isAdmin) {
    return '';
  }
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

  let handoverInstruction = '';
  if (mode === 'bisnis' || mode === 'business') {
    const isHandoverOn = config.handover_enabled !== false;
    if (!isHandoverOn) {
      handoverInstruction = '\n\n## ⚠️ Status Fitur Handover: NONAKTIF\n- Fitur pengalihan ke admin/pemilik toko (handover) saat ini sedang NONAKTIF di pengaturan.\n- Anda sebagai AI wajib menangani seluruh percakapan secara mandiri, tuntas, dan sopan.\n- Jika pelanggan menawar harga (nego), sampaikan dengan ramah bahwa harga kami sudah pas/nett sesuai kualitas terbaik dan belum bisa ditawar, tanpa menawarkan pengalihan ke admin.\n- DILARANG menyertakan tag [HANDOVER_REQUIRED].';
    }
  }

  return baseContent + buildPersonalityPrompt(config, mode) + handoverInstruction;
}

/**
 * Membersihkan format teks agar rapi dan sesuai format WhatsApp (*tebal*, bukan **tebal**).
 * Menghilangkan tag scratchpad/thinking atau kebocoran chain-of-thought AI jika ada.
 * @param {string} text 
 * @returns {string}
 */
function cleanWhatsAppFormatting(text = '') {
  if (!text) return '';
  let cleaned = text;

  // 1. Bersihkan tag XML/HTML thinking & scratchpad
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
  cleaned = cleaned.replace(/<scratchpad>[\s\S]*?<\/scratchpad>/gi, '');

  // 2. Bersihkan blok "Thinking Process: ... \n\n" secara tuntas
  cleaned = cleaned.replace(/^\s*(?:Thinking\s+Process|Internal\s+Reasoning|Analysis|Reasoning Process|Scratchpad):[\s\S]*?\n\n/gim, '');

  // 3. Bersihkan blok CoT / Scratchpad / Rule Check multi-baris di awal
  cleaned = cleaned.replace(/^(?:\s*['"]?s\s+check|\s*Let'?s\s+check|\s*Check(?:ing)?\s+Rule|\s*Thought:|\s*Internal\s+check|\s*Rule\s+\d+:)[\s\S]*?(?=\n\s*(?:\b(?:Halo|Hai|Pagi|Siang|Sore|Malam|Iya|Siap|Baik|Wah|Terima|Kak|Harga|Outlet|Berikut|Menu|Untuk|Mohon)\b|[*#]))/gim, '');

  // 3. Bersihkan baris-baris sisa CoT (apapun variasinya)
  cleaned = cleaned.replace(/^\s*(?:['"]?s\s+check|Let'?s\s+check|Thinking\s+process:?|Thought:|Internal\s+reasoning:?|Rule\s+\d+:?|Here,\s+the\s+customer\s+asked).*$/gim, '');
  cleaned = cleaned.replace(/^\s*".*DILARANG\s+SPAM\s+HARGA.*$/gim, '');
  cleaned = cleaned.replace(/^\s*".*Sebutkan\s+harga\s+HANYA.*$/gim, '');
  cleaned = cleaned.replace(/^\s*Here,\s+the\s+customer\s+asked.*$/gim, '');

  // 4. Ubah markdown heading (### Judul / ## Judul / # Judul) -> *Judul*
  cleaned = cleaned.replace(/^#{1,4}\s+(.+)$/gm, '*$1*');

  // 5. Ubah double asterisks (**tebal**) -> single asterisk (*tebal*)
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '*$1*');

  // 6. Rapikan baris kosong berlebih
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Menghasilkan balasan AI dari pesan pengguna (Router Tunggal AI).
 * @param {object} params
 * @param {string} params.message
 * @param {'bisnis'|'personal'} [params.mode]
 * @param {string|null} [params.imageBase64]
 * @param {string|null} [params.mimeType]
 * @param {string|null} [params.apiKeyOverride]
 * @param {string|null} [params.contact]
 * @returns {Promise<{reply: string, error: string|null, handledBy: string, handoverRequired: boolean}>}
 */
async function generateReply({ message, mode = null, imageBase64 = null, mimeType = 'image/jpeg', apiKeyOverride = null, contact = null }) {
  const config = getConfig();
  const activeMode = mode || config.mode || 'bisnis';
  const geminiKey = apiKeyOverride || config.gemini_api_key;
  const grokKey = config.grok_api_key;
  const selectedModel = config.ai_model || 'gemini-3.7-flash';

  const effectiveMessage = (message && message.trim())
    ? message
    : (imageBase64 
        ? (activeMode === 'personal' 
            ? 'Tolong baca dan catat pengeluaran dari foto struk/bon/kuitansi ini.' 
            : 'Tolong analisis foto barang/produk yang dikirim pelanggan ini, kenali nama barang dan bantu informasikan ketersediaan stok atau keterangannya.')
        : '');

  // 1. Bangun RAG Context dari database SQLite + Riwayat Chat
  const dbContext = buildContext(effectiveMessage, activeMode, contact);
  
  // 2. Susun System Prompt dengan kustomisasi persona
  const systemPrompt = loadSystemPrompt(activeMode, config);
  const userLabel = activeMode === 'admin' ? 'Pesan dari Pemilik Toko / Admin:' : 'Pesan Pelanggan / User:';
  const fullPrompt = `${dbContext}\n\n${userLabel}\n"${effectiveMessage}"`;

  let response;

  // 3. Routing ke provider AI yang sesuai
  if (imageBase64 && config.vision_provider === 'grok' && grokKey) {
    response = await callGrok(effectiveMessage, imageBase64, { apiKey: grokKey });
  } else {
    response = await callGemini(fullPrompt, systemPrompt, { 
      apiKey: geminiKey,
      model: selectedModel,
      imageBase64: imageBase64 || null,
      mimeType: mimeType || 'image/jpeg'
    });
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
  loadSystemPrompt,
  cleanWhatsAppFormatting
};
