const { initClient, getClient, destroyClient, resetSession } = require('./client');
const {
  ENGINE_STATUS,
  getStatus,
  setStatus,
  getQrCode,
  resetStatus,
  statusEmitter
} = require('./status');
const { handleIncomingMessage } = require('./handlers/message-handler');

module.exports = {
  initClient,
  getClient,
  destroyClient,
  resetSession,
  ENGINE_STATUS,
  getStatus,
  setStatus,
  getQrCode,
  resetStatus,
  statusEmitter,
  handleIncomingMessage
};
