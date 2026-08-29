const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const { SESSION_DIR } = require('../src/utils/paths');
const { findSystemBrowserExecutable } = require('../src/utils/browser-locator');

async function testWwebjs() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executable = fs.existsSync(edgePath) ? edgePath : findSystemBrowserExecutable();
  console.log('Using executable:', executable);

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(SESSION_DIR, 'test-edge-auth'),
      clientId: 'test-client'
    }),
    puppeteer: {
      executablePath: executable,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-domain-reliability',
        '--disable-sync',
        '--disable-features=msEdgeStartupBoost,msEdgeBackgroundMode,OptimizationHints,Translate,BackForwardCache,MediaRouter',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    }
  });

  client.on('qr', (qr) => {
    console.log('✅ QR Code EVENT TRIGGERED SUCCESSFULLY! Length:', qr.length);
    setTimeout(async () => {
      console.log('Destroying test client...');
      await client.destroy();
      console.log('✅ Test client destroyed.');
      process.exit(0);
    }, 2000);
  });

  client.on('ready', () => {
    console.log('Client is ready!');
  });

  console.log('Initializing whatsapp-web.js with Edge...');
  await client.initialize();
}

testWwebjs().catch(err => {
  console.error('❌ Error during test:', err);
  process.exit(1);
});
