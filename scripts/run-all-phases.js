const { spawnSync } = require('child_process');
const path = require('path');

const testScripts = [
  'test-phase1-personalization.js',
  'test-phase2-timing.js',
  'test-phase3-handover.js',
  'test-phase4-training.js',
  'test-phase5-sheets-sync.js',
  'test-phase6-knowledge-inbox.js',
  'test-phase7-multi-bubble-debounce.js',
  'test-phase8-reconnect-settings.js',
  'test-phase9-analytics-insights.js'
];

console.log('===========================================================');
console.log(' 🚀 MENJALANKAN SELURUH SUITE PENGUJIAN FASE 1 SAMPAI 9');
console.log('===========================================================\n');

let allPassed = true;

for (const script of testScripts) {
  const fullPath = path.resolve(__dirname, script);
  console.log(`▶ Menjalankan: scripts/${script}...`);
  const res = spawnSync(process.execPath, [fullPath], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', NO_DELAY: '1' }
  });

  if (res.status !== 0) {
    console.error(`❌ Gagal pada script: ${script}\n`);
    allPassed = false;
    break;
  }
  console.log(`-----------------------------------------------------------\n`);
}

if (allPassed) {
  console.log('🎉 SELURUH 9 FASE LULUS PENGUJIAN 100% SECARA MENYELURUH (STATUS: GREEN)');
} else {
  process.exit(1);
}
