const puppeteer = require('puppeteer');
const fs = require('fs');

async function testEdgeDirect() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    console.log('Edge not at x86, checking 64-bit...');
  }

  const args = [
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
  ];

  console.log('Testing Edge at:', edgePath);
  try {
    const browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: true,
      args
    });
    console.log('✅ Edge launched successfully! PID:', browser.process().pid);
    const page = await browser.newPage();
    await page.goto('https://web.whatsapp.com');
    console.log('✅ Page loaded successfully! Title:', await page.title());
    await browser.close();
    console.log('✅ Edge closed cleanly.');
  } catch (err) {
    console.error('❌ Edge Launch failed:', err);
  }
}

testEdgeDirect();
