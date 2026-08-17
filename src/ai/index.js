const { generateReply, validateKey, loadSystemPrompt } = require('./router');
const { buildContext, extractKeywords } = require('./context-builder');
const { callGemini, validateGeminiKey } = require('./providers/gemini');
const { callGrok, validateGrokKey } = require('./providers/grok');

module.exports = {
  generateReply,
  validateKey,
  loadSystemPrompt,
  buildContext,
  extractKeywords,
  callGemini,
  validateGeminiKey,
  callGrok,
  validateGrokKey
};
