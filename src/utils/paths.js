const path = require('path');

const isPkg = typeof process.pkg !== 'undefined';

// Base directory untuk file yang bisa ditulis oleh user/aplikasi (data, config, session, uploads)
const BASE_DIR = isPkg 
  ? path.dirname(process.execPath) 
  : path.resolve(__dirname, '../..');

const DATA_DIR = path.join(BASE_DIR, 'data');
const CONFIG_DIR = path.join(BASE_DIR, 'config');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SESSION_DIR = path.join(DATA_DIR, 'session');

module.exports = {
  isPkg,
  BASE_DIR,
  DATA_DIR,
  CONFIG_DIR,
  UPLOADS_DIR,
  SESSION_DIR
};
