const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const ROOT_DIR = path.resolve(__dirname, '..');
const NODE_MODULES_DIR = path.join(ROOT_DIR, 'node_modules');
const ANDROID_ZIP = path.join(ROOT_DIR, 'android', 'node_modules.zip');
const ASSETS_ZIP = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'assets', 'nodejs-project', 'node_modules.zip');

const excludePackages = new Set([
  'puppeteer',
  'puppeteer-core',
  '@puppeteer',
  'chromium-bidi',
  'devtools-protocol',
  'pkg',
  'mammoth',
  'whatsapp-web.js',
  '.cache',
  '@img',
  '@types'
]);

const ignoredFolders = new Set([
  'test',
  'tests',
  '__tests__',
  'example',
  'examples',
  'docs',
  'doc',
  '.github',
  '.vscode'
]);

const ignoredExts = new Set([
  '.d.ts',
  '.map',
  '.markdown'
]);

function shouldIncludeFile(filename) {
  const lower = filename.toLowerCase();
  if (lower.startsWith('readme') || lower.startsWith('changelog') || lower.startsWith('license') || lower.startsWith('authors')) {
    return false;
  }
  if (lower.endsWith('.d.ts') || lower.endsWith('.map') || lower.endsWith('.markdown')) {
    return false;
  }
  return true;
}

console.log('--- PACKING OPTIMIZED MOBILE NODE_MODULES ---');
console.log('Target zip:', ANDROID_ZIP);

const output = fs.createWriteStream(ANDROID_ZIP);
const archive = archiver('zip', {
  zlib: { level: 6 } // Good balance of compression and speed
});

output.on('close', () => {
  const sizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
  console.log(`✅ Arsip node_modules.zip berhasil dibuat: ${sizeMB} MB (${archive.pointer()} bytes)`);

  // Salin juga ke folder assets jika direktori ada
  const assetsDir = path.dirname(ASSETS_ZIP);
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  fs.copyFileSync(ANDROID_ZIP, ASSETS_ZIP);
  console.log('✅ Berhasil menyalin ke assets/nodejs-project/node_modules.zip');
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

let fileCount = 0;

function addDirectoryToArchive(dirPath, zipPrefix) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryName = entry.name;

    if (entry.isDirectory()) {
      if (ignoredFolders.has(entryName.toLowerCase()) || entryName.startsWith('.')) {
        continue;
      }
      addDirectoryToArchive(fullPath, `${zipPrefix}/${entryName}`);
    } else if (entry.isFile()) {
      if (!shouldIncludeFile(entryName)) {
        continue;
      }
      archive.file(fullPath, { name: `${zipPrefix}/${entryName}` });
      fileCount++;
    }
  }
}

// Iterasi setiap modul di node_modules
const topEntries = fs.readdirSync(NODE_MODULES_DIR, { withFileTypes: true });
for (const entry of topEntries) {
  if (excludePackages.has(entry.name) || entry.name.startsWith('.')) {
    continue;
  }

  const fullPath = path.join(NODE_MODULES_DIR, entry.name);

  if (entry.isDirectory()) {
    if (entry.name.startsWith('@')) {
      // Scoped package (misal: @whiskeysockets)
      const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const sub of subEntries) {
        if (excludePackages.has(`${entry.name}/${sub.name}`) || sub.name.startsWith('.')) continue;
        if (sub.isDirectory()) {
          addDirectoryToArchive(path.join(fullPath, sub.name), `${entry.name}/${sub.name}`);
        }
      }
    } else {
      addDirectoryToArchive(fullPath, entry.name);
    }
  }
}

console.log(`Menambahkan ${fileCount} file terseleksi ke dalam arsip zip...`);
archive.finalize();
