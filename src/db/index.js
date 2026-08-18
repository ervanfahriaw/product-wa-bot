const db = require('./connection');
const settingsQueries = require('./queries/settings');
const productsQueries = require('./queries/products');
const expensesQueries = require('./queries/expenses');
const remindersQueries = require('./queries/reminders');
const chatLogsQueries = require('./queries/chat-logs');
const contactStatesQueries = require('./queries/contact-states');
const samplesQueries = require('./queries/samples');
const businessDocsQueries = require('./queries/business-documents');
const manualHandoversQueries = require('./queries/manual-handovers');
const analyticsQueries = require('./queries/analytics');

module.exports = {
  db,
  ...settingsQueries,
  ...productsQueries,
  ...expensesQueries,
  ...remindersQueries,
  ...chatLogsQueries,
  ...contactStatesQueries,
  ...samplesQueries,
  ...businessDocsQueries,
  ...manualHandoversQueries,
  ...analyticsQueries
};
