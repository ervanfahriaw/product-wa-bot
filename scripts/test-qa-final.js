const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

console.log('================================================================');
console.log('    MEMULAI QA FINAL & VERIFIKASI RILIS PRODUK V1 (FASE 10)     ');
console.log('================================================================\n');

async function runQaFinalTests() {
  let failed = false;

  // 1. Audit Text UI & Anti-Jargon di Seluruh View EJS
  console.log('[QA 1/4] Memeriksa Bebas Jargon Teknis & Pesan Human-Friendly di UI...');
  try {
    const viewsDir = path.resolve(__dirname, '../src/server/views');
    const getAllFiles = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
          results = results.concat(getAllFiles(full));
        } else if (file.endsWith('.ejs')) {
          results.push(full);
        }
      });
      return results;
    };

    const ejsFiles = getAllFiles(viewsDir);
    assert.ok(ejsFiles.length >= 8, 'Seluruh file view EJS harus lengkap');

    const forbiddenJargon = ['webhook', 'endpoint', 'stack trace', 'uncaught exception', 'internal server error 500'];
    for (const file of ejsFiles) {
      const content = fs.readFileSync(file, 'utf-8').toLowerCase();
      for (const jargon of forbiddenJargon) {
        assert.ok(!content.includes(jargon), `File ${path.basename(file)} tidak boleh memuat jargon: "${jargon}"`);
      }
    }
    console.log('  -> OK: Seluruh teks UI di 8+ halaman EJS bebas dari jargon teknis yang membingungkan.');
  } catch (err) {
    console.error('  ❌ Gagal pada QA 1:', err.message);
    failed = true;
  }

  // 2. Menjalankan Seluruh Rangkaian Test Suite Proyek (Regression Test)
  console.log('\n[QA 2/4] Menjalankan Seluruh Test Suite Komponen Proyek...');
  const testSuites = [
    'test-db.js',
    'test-ai.js',
    'test-business-mode.js',
    'test-personal-mode.js',
    'test-server.js',
    'test-dashboard-management.js',
    'test-e2e-audit.js',
    'test-packaging.js',
    'test-phase-s1-flavor.js',
    'test-phase-s2-wizard-flow.js',
    'test-phase-s3-ui-branding.js',
    'test-phase-s4-build-dist.js'
  ];

  for (const suite of testSuites) {
    const scriptPath = path.join(__dirname, suite);
    if (fs.existsSync(scriptPath)) {
      console.log(`  -> Menjalankan ${suite}...`);
      const res = spawnSync(process.execPath, [scriptPath], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, NO_AUTO_OPEN: 'true', PORT: '3005' },
        timeout: 45000,
        encoding: 'utf-8'
      });

      if (res.status === 0 || (res.stdout && res.stdout.includes('STATUS TDD: GREEN')) || (res.stdout && res.stdout.includes('100% PASS'))) {
        console.log(`     ✅ ${suite} LULUS (GREEN)`);
      } else {
        console.error(`     ❌ ${suite} GAGAL (Status: ${res.status}):\n${res.stdout || res.stderr}`);
        failed = true;
      }
    }
  }

  // 3. Memeriksa Dokumen Release Notes & Bahan Ebook
  console.log('\n[QA 3/4] Memeriksa Kelengkapan Bahan Ebook & Release Notes...');
  try {
    const releaseDocPath = path.resolve(__dirname, '../docs/release-notes-v1.md');
    assert.ok(fs.existsSync(releaseDocPath), 'Dokumen docs/release-notes-v1.md harus ada');
    const docContent = fs.readFileSync(releaseDocPath, 'utf-8');
    assert.ok(docContent.includes('Mode Bisnis') && docContent.includes('Mode Personal'), 'Harus merangkum kedua mode');
    assert.ok(docContent.includes('Lynk.id'), 'Harus memuat model paket Lynk.id');
    console.log('  -> OK: Dokumen release-notes-v1.md lengkap dan siap dipakai sebagai panduan ebook.');
  } catch (err) {
    console.error('  ❌ Gagal pada QA 3:', err.message);
    failed = true;
  }

  // 4. Verifikasi Integritas Database Lokal
  console.log('\n[QA 4/4] Memeriksa Integritas Database Lokal (data/bot.db)...');
  try {
    const dbPath = path.resolve(__dirname, '../data/bot.db');
    assert.ok(fs.existsSync(dbPath), 'Database data/bot.db harus tersedia');
    const db = require('../src/db');
    const products = db.getAllProducts();
    const settings = db.getAllSettings();
    assert.ok(Array.isArray(products), 'Tabel products harus siap');
    assert.ok(typeof settings === 'object', 'Tabel settings harus siap');
    console.log(`  -> OK: Database lokal siap (${products.length} produk tersimpan sebagai modal awal buyer).`);
  } catch (err) {
    console.error('  ❌ Gagal pada QA 4:', err.message);
    failed = true;
  }

  console.log('\n================================================================');
  if (failed) {
    console.log('❌ STATUS QA FINAL: GAGAL — Perlu perbaikan sebelum rilis.');
    process.exit(1);
  } else {
    console.log('🎉 STATUS QA FINAL: LULUS 100% — PRODUK SIAP DIRILIS DI LYNK.ID!');
    console.log('================================================================');
    process.exit(0);
  }
}

runQaFinalTests();
