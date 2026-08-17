const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== MEMULAI PENGUJIAN TDD: PACKAGING & DEPLOYMENT (FASE 9) ===\n');

async function runPackagingTddTests() {
  let failed = false;

  // Test 1: Check package.json pkg configuration & build script
  console.log('[Test 1/4] Memeriksa Konfigurasi package.json (build:exe & pkg config)...');
  try {
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    assert.ok(pkgJson.scripts && pkgJson.scripts['build:exe'], 'Script "build:exe" harus ada di package.json');
    assert.ok(pkgJson.pkg, 'Konfigurasi "pkg" harus ada di package.json');
    assert.ok(pkgJson.pkg.assets && pkgJson.pkg.assets.length > 0, 'pkg.assets harus mendaftarkan views & prompts');
    console.log('  -> OK: Konfigurasi package.json untuk pkg packaging valid.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 1:', err.message);
    failed = true;
  }

  // Test 2: Check scripts/build-exe.js
  console.log('\n[Test 2/4] Memeriksa Script Build Executable (scripts/build-exe.js)...');
  try {
    const buildExePath = path.resolve(__dirname, 'build-exe.js');
    assert.ok(fs.existsSync(buildExePath), 'File scripts/build-exe.js harus ada');
    const buildContent = fs.readFileSync(buildExePath, 'utf-8');
    assert.ok(buildContent.includes('dist'), 'Build script harus mengelola folder dist');
    assert.ok(buildContent.includes('pkg') || buildContent.includes('exec'), 'Build script harus menjalankan pkg');
    console.log('  -> OK: Script build-exe.js terdefinisi dan siap pakai.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 2:', err.message);
    failed = true;
  }

  // Test 3: Check scripts/deploy-vps.sh
  console.log('\n[Test 3/4] Memeriksa Script Deployment VPS (scripts/deploy-vps.sh)...');
  try {
    const deployScriptPath = path.resolve(__dirname, 'deploy-vps.sh');
    assert.ok(fs.existsSync(deployScriptPath), 'File scripts/deploy-vps.sh harus ada');
    const deployContent = fs.readFileSync(deployScriptPath, 'utf-8');
    assert.ok(deployContent.startsWith('#!/bin/bash') || deployContent.startsWith('#!/usr/bin/env bash'), 'Harus berupa bash script');
    assert.ok(deployContent.includes('nodejs') || deployContent.includes('nodesource'), 'Harus menginstal Node.js');
    assert.ok(deployContent.includes('pm2'), 'Harus menyertakan setup pm2');
    assert.ok(deployContent.includes('libnss3') || deployContent.includes('chromium'), 'Harus menginstal dependensi Linux untuk Chromium');
    console.log('  -> OK: Script deploy-vps.sh valid untuk deployment Ubuntu/Debian VPS.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 3:', err.message);
    failed = true;
  }

  // Test 4: Check docs/packaging-deployment.md Documentation
  console.log('\n[Test 4/4] Memeriksa Dokumentasi Packaging & Deployment...');
  try {
    const docPath = path.resolve(__dirname, '../docs/packaging-deployment.md');
    const docContent = fs.readFileSync(docPath, 'utf-8');
    assert.ok(docContent.includes('pkg') || docContent.includes('.exe'), 'Dokumentasi harus memuat cara build .exe');
    assert.ok(docContent.includes('deploy-vps.sh') || docContent.includes('pm2'), 'Dokumentasi harus memuat panduan VPS');
    assert.ok(docContent.includes('better-sqlite3') || docContent.includes('native') || docContent.includes('Catatan'), 'Dokumentasi harus memuat catatan teknis native dependency');
    console.log('  -> OK: Dokumentasi packaging-deployment.md lengkap.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 4:', err.message);
    failed = true;
  }

  if (failed) {
    console.log('\n❌ STATUS TDD: RED (Packaging & Deployment belum lengkap)');
    process.exit(1);
  } else {
    console.log('\n✅ STATUS TDD: GREEN (Semua Kriteria Packaging & Deployment Lulus 100%)');
    process.exit(0);
  }
}

runPackagingTddTests();
