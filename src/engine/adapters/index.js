const { BaseEngineAdapter, ENGINE_STATUS } = require('./base-adapter');

let currentAdapterInstance = null;
let WWebJSEngineAdapter = null;
let BaileysEngineAdapter = null;

function getWWebJSAdapterClass() {
  if (!WWebJSEngineAdapter) {
    try {
      const mod = require('./wwebjs-adapter');
      WWebJSEngineAdapter = mod.WWebJSEngineAdapter;
    } catch (e) {
      console.warn('[EngineAdapter] WWebJS adapter tidak tersedia di lingkungan ini:', e.message);
    }
  }
  return WWebJSEngineAdapter;
}

function getBaileysAdapterClass() {
  if (!BaileysEngineAdapter) {
    try {
      const mod = require('./baileys-adapter');
      BaileysEngineAdapter = mod.BaileysEngineAdapter;
    } catch (e) {
      console.warn('[EngineAdapter] Baileys adapter gagal dimuat:', e.message);
    }
  }
  return BaileysEngineAdapter;
}

/**
 * Membuat atau mengambil instance Engine Adapter yang sesuai.
 * @param {'wwebjs'|'baileys'|'mock'} [engineType] 
 * @param {boolean} [forceNew=false]
 * @returns {BaseEngineAdapter}
 */
function createEngineAdapter(engineType = null, forceNew = false) {
  if (currentAdapterInstance && !forceNew && (!engineType || currentAdapterInstance.engineName === engineType)) {
    return currentAdapterInstance;
  }

  const selectedType = (engineType || process.env.ENGINE_TYPE || 'wwebjs').toLowerCase();

  switch (selectedType) {
    case 'baileys': {
      const BaileysClass = getBaileysAdapterClass();
      if (BaileysClass) {
        currentAdapterInstance = new BaileysClass();
      } else {
        const WWebClass = getWWebJSAdapterClass();
        if (WWebClass) currentAdapterInstance = new WWebClass();
      }
      break;
    }

    case 'wwebjs':
    default: {
      const WWebClass = getWWebJSAdapterClass();
      if (WWebClass) {
        currentAdapterInstance = new WWebClass();
      } else {
        const BaileysClass = getBaileysAdapterClass();
        if (BaileysClass) currentAdapterInstance = new BaileysClass();
      }
      break;
    }
  }

  return currentAdapterInstance;
}

/**
 * Mendapatkan adapter aktif saat ini.
 * @returns {BaseEngineAdapter}
 */
function getActiveAdapter() {
  if (!currentAdapterInstance) {
    return createEngineAdapter();
  }
  return currentAdapterInstance;
}

/**
 * Mereset instance adapter (berguna untuk testing).
 */
function resetAdapterInstance() {
  currentAdapterInstance = null;
}

module.exports = {
  BaseEngineAdapter,
  get WWebJSEngineAdapter() { return getWWebJSAdapterClass(); },
  get BaileysEngineAdapter() { return getBaileysAdapterClass(); },
  ENGINE_STATUS,
  createEngineAdapter,
  getActiveAdapter,
  resetAdapterInstance
};
