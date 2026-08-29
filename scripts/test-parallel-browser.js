const puppeteer = require('puppeteer');
const { findSystemBrowserExecutable } = require('../src/utils/browser-locator');
const path = require('path');
const fs = require('fs');

async function testParallel() {
  const browserPath = findSystemBrowserExecutable();
  console.log('Using browser executable:', browserPath);
  
  const sessionDir = path.resolve('./data/session/test-concurrent-session');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  
  console.log('Launching isolated Puppeteer instance with Edge flags...');
  const browser = await puppeteer.launch({
    executablePath: browserPath,
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
      `--user-data-dir=${sessionDir}`
    ]
  });
  
  console.log('✅ Browser launched successfully (in parallel with any user open browsers)!');
  const page = await browser.newPage();
  console.log('Navigating to https://web.whatsapp.com ...');
  await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const title = await page.title();
  console.log('✅ WhatsApp Web Page Loaded! Title:', title);
  await browser.close();
  console.log('✅ Browser closed cleanly without interfering with user desktop.');
  
  // Cleanup test folder
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch (_) {}
}

testParallel().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
