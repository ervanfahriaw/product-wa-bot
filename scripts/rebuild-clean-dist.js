const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('======================================================');
console.log('   🧹 BERSIHKAN TOTAL & REBUILD DIST DENGAN SISTEM/   ');
console.log('======================================================\n');

const distDir = path.join(__dirname, '../dist');

// Hapus folder dist lama secara aman (kecuali file locked)
const foldersToClean = ['wa-bot-bisnis', 'wa-bot-personal'];

for (const folder of foldersToClean) {
  const target = path.join(distDir, folder);
  if (fs.existsSync(target)) {
    console.log(`Mengosongkan folder: ${folder}...`);
    try {
      const items = fs.readdirSync(target);
      for (const item of items) {
        const itemPath = path.join(target, item);
        try {
          fs.rmSync(itemPath, { recursive: true, force: true });
        } catch (e) {
          console.warn(`   (Skip locked: ${item})`);
        }
      }
    } catch (e) {}
  }
}

console.log('\n🚀 Menjalankan build-exe.js --edition=all...');
const buildScript = path.join(__dirname, 'build-exe.js');
execSync(`node "${buildScript}" --edition=all`, { stdio: 'inherit' });
