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
const notesQueries = require('./queries/notes');
const todosQueries = require('./queries/todos');
const budgetsQueries = require('./queries/budgets');
const habitsQueries = require('./queries/habits');
const eventsQueries = require('./queries/events');
const journalsQueries = require('./queries/journals');
const goalsQueries = require('./queries/goals');
const customerProfilesQueries = require('./queries/customer-profiles');
const faqsQueries = require('./queries/faqs');
const ordersQueries = require('./queries/orders');
const followUpsQueries = require('./queries/follow-ups');

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
  ...analyticsQueries,
  ...notesQueries,
  ...todosQueries,
  ...budgetsQueries,
  ...habitsQueries,
  ...eventsQueries,
  ...journalsQueries,
  ...goalsQueries,
  ...customerProfilesQueries,
  ...faqsQueries,
  ...ordersQueries,
  ...followUpsQueries
};
