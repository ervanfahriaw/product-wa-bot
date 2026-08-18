const { computeBusinessAnalytics, PURCHASE_INTENT_KEYWORDS, INQUIRY_CATEGORIES } = require('./aggregator');
const { generateAiBusinessInsights, getLatestStoredInsight } = require('./ai-advisor');

module.exports = {
  computeBusinessAnalytics,
  generateAiBusinessInsights,
  getLatestStoredInsight,
  PURCHASE_INTENT_KEYWORDS,
  INQUIRY_CATEGORIES
};
