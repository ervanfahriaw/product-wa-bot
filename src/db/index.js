const db = require('./connection');
const settingsQueries = require('./queries/settings');
const productsQueries = require('./queries/products');
const expensesQueries = require('./queries/expenses');
const remindersQueries = require('./queries/reminders');
const chatLogsQueries = require('./queries/chat-logs');

module.exports = {
  db,
  ...settingsQueries,
  ...productsQueries,
  ...expensesQueries,
  ...remindersQueries,
  ...chatLogsQueries
};
