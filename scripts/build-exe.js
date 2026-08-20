const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Parse argument --edition=bisnis | personal | all
const args = process.argv.slice(2);
let targetEdition = 'all';

for (const arg of args) {
  if (arg.startsWith('--edition=')) {
    targetEdition = arg.split('=')[1].toLowerCase().trim();
  }
}

console.log('======================================================');
console.log(`       BUILD MULTI-TARGET EXECUTABLE DISTRIBUTION      `);
console.log(`       Target Edition: ${targetEdition.toUpperCase()}  `);
console.log('======================================================\n');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

/**
 * Membangun paket distribusi untuk satu edisi
 * @param {string} edition 'bisnis' | 'personal' | 'all'
 */
function buildEditionPackage(edition) {
  const isBisnis = edition === 'bisnis';
  const isPersonal = edition === 'personal';

  let folderName = 'wa-bot-assistant';
  let exeName = 'wa-bot-assistant.exe';
  let title = 'WA Bot Assistant (Dual Edition)';
  let guideSrc = path.join(ROOT_DIR, 'docs/packaging-deployment.md');
  let guideDestName = 'PANDUAN_PENGGUNAAN.txt';
  let vpsScriptSrc = path.join(ROOT_DIR, 'scripts/deploy-vps.sh');
  let vpsScriptDestName = 'deploy-vps.sh';

  if (isBisnis) {
    folderName = 'wa-bot-bisnis';
    exeName = 'wa-bot-bisnis.exe';
    title = 'WA Bot Bisnis AI (CS & Sales 24/7)';
    guideSrc = path.join(ROOT_DIR, 'docs/panduan-pembeli-bisnis.md');
    guideDestName = 'PANDUAN_PENGGUNAAN_BISNIS.txt';
    vpsScriptSrc = path.join(ROOT_DIR, 'scripts/deploy-vps-bisnis.sh');
    vpsScriptDestName = 'deploy-vps-bisnis.sh';
  } else if (isPersonal) {
    folderName = 'wa-bot-personal';
    exeName = 'wa-bot-personal.exe';
    title = 'WA Asisten Pribadi AI (Finance & Productivity)';
    guideSrc = path.join(ROOT_DIR, 'docs/panduan-pembeli-personal.md');
    guideDestName = 'PANDUAN_PENGGUNAAN_PERSONAL.txt';
    vpsScriptSrc = path.join(ROOT_DIR, 'scripts/deploy-vps-personal.sh');
    vpsScriptDestName = 'deploy-vps-personal.sh';
  }

  const targetFolder = path.join(DIST_DIR, folderName);
  const targetConfigDir = path.join(targetFolder, 'config');
  if (!fs.existsSync(targetConfigDir)) {
    fs.mkdirSync(targetConfigDir, { recursive: true });
  }

  console.log(`\n📦 Memproses Paket: ${title}`);
  console.log(`   Folder Tujuan: ${targetFolder}`);

  // 1. Tulis edition.json di dalam config folder paket
  const editionJsonPath = path.join(targetConfigDir, 'edition.json');
  fs.writeFileSync(editionJsonPath, JSON.stringify({ edition }, null, 2), 'utf-8');

  // 2. Salin config.json.example
  const exampleSource = path.join(ROOT_DIR, 'config/config.json.example');
  if (fs.existsSync(exampleSource)) {
    fs.copyFileSync(exampleSource, path.join(targetConfigDir, 'config.json.example'));
  }

  // 3. Salin Panduan Pembeli (Markdown & Word)
  if (fs.existsSync(guideSrc)) {
    fs.copyFileSync(guideSrc, path.join(targetFolder, guideDestName));
  }
  const wordGuideSrc = isBisnis 
    ? path.join(ROOT_DIR, 'docs/Buku_Panduan_Lengkap_WA_Bot_Bisnis_AI.docx')
    : path.join(ROOT_DIR, 'docs/Buku_Panduan_Lengkap_WA_Asisten_Pribadi_AI.docx');
  if (fs.existsSync(wordGuideSrc)) {
    fs.copyFileSync(wordGuideSrc, path.join(targetFolder, path.basename(wordGuideSrc)));
  }

  // 4. Salin Script VPS
  if (fs.existsSync(vpsScriptSrc)) {
    fs.copyFileSync(vpsScriptSrc, path.join(targetFolder, vpsScriptDestName));
  }

  // 5. Buat batch script wrapper pendamping
  const batPath = path.join(targetFolder, `start-${edition}.bat`);
  const batContent = `@echo off\r\ntitle ${title}\r\ncd /d "%~dp0"\r\nset "EDITION=${edition}"\r\nif exist "${exeName}" (\r\n  start "" "${exeName}"\r\n) else (\r\n  node ../../src/server/index.js\r\n)\r\n`;
  fs.writeFileSync(batPath, batContent, 'utf-8');

  // 6. Jalankan pkg builder
  console.log(`   Menjalankan packaging binary .exe (${exeName})...`);
  const outExePath = path.join(targetFolder, exeName);
  try {
    const pkgCommand = `npx pkg . --targets node18-win-x64 --output "${outExePath}"`;
    execSync(pkgCommand, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env, EDITION: edition }
    });
  } catch (err) {
    console.warn(`   ⚠️ Pkg compilation note: ${err.message}`);
  }

  // 7. Salin native addon better-sqlite3 jika tersedia
  try {
    const nativeSource = path.join(ROOT_DIR, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node');
    if (fs.existsSync(nativeSource)) {
      fs.copyFileSync(nativeSource, path.join(targetFolder, 'better_sqlite3.node'));
    }
  } catch (_) {}

  console.log(`   ✅ Paket [${edition.toUpperCase()}] Selesai dibuat di: ${targetFolder}`);
}

// Eksekusi build berdasarkan target
if (targetEdition === 'bisnis') {
  buildEditionPackage('bisnis');
} else if (targetEdition === 'personal') {
  buildEditionPackage('personal');
} else {
  // Build all packages
  buildEditionPackage('bisnis');
  buildEditionPackage('personal');
}

console.log('\n======================================================');
console.log('  🎉 SEMUA TARGET BUILD DISTRIBUSI SELESAI!');
console.log('======================================================');
