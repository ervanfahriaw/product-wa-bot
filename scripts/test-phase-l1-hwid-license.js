const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { getHwid, getDeviceFingerprint } = require('../src/utils/hwid');
const {
  LICENSE_FILE_PATH,
  createSignature,
  saveStoredLicense,
  getStoredLicense,
  deleteStoredLicense,
  checkLocalLicense
} = require('../src/utils/license-client');

console.log('======================================================');
console.log('   TEST SUITE: FASE L1 — HWID & CLIENT LICENSE ENGINE ');
console.log('======================================================\n');

// 1. Test HWID Generation
console.log('[Test 1] Pengujian Generator HWID...');
const hwid1 = getHwid();
const hwid2 = getHwid();
assert.strictEqual(typeof hwid1, 'string', 'HWID harus berupa string');
assert.strictEqual(hwid1.length, 64, 'HWID harus berupa SHA-256 hash 64-karakter');
assert.strictEqual(hwid1, hwid2, 'HWID harus deterministik dan konsisten pada panggilan berulang');
console.log(`  ✅ HWID Terdeteksi: ${hwid1.substring(0, 16)}... (Valid SHA-256)`);

// 2. Test Device Fingerprint
console.log('\n[Test 2] Pengujian Device Fingerprint...');
const fp = getDeviceFingerprint();
assert.ok(fp.deviceName, 'Device name harus ada');
assert.ok(fp.platform, 'Platform harus ada');
assert.strictEqual(fp.hwid, hwid1, 'HWID pada fingerprint harus cocok');
console.log(`  ✅ Device Info: ${fp.deviceName}`);

// 3. Test Unlicensed State
console.log('\n[Test 3] Pengujian Status Tanpa Lisensi...');
deleteStoredLicense();
const unlicCheck = checkLocalLicense();
assert.strictEqual(unlicCheck.isValid, false, 'Tanpa file license, status harus tidak valid');
assert.ok(unlicCheck.reason, 'Harus ada pesan alasan');
console.log(`  ✅ Status tanpa lisensi: ${unlicCheck.reason}`);

// 4. Test Valid License Creation & Signature
console.log('\n[Test 4] Pengujian Pembuatan Lisensi Valid & Signature HMAC...');
const testLicenseData = {
  licenseKey: 'WABOT-BIZ-TEST-9999-ABCD',
  edition: 'bisnis',
  buyerEmail: 'tester@lynk.id',
  buyerName: 'Pembeli Uji Coba',
  hwid: hwid1,
  activatedAt: new Date().toISOString(),
  lastVerifiedAt: new Date().toISOString()
};
testLicenseData.signature = createSignature(testLicenseData);
saveStoredLicense(testLicenseData);

const validCheck = checkLocalLicense();
assert.strictEqual(validCheck.isValid, true, 'Lisensi valid harus diterima');
assert.strictEqual(validCheck.data.licenseKey, 'WABOT-BIZ-TEST-9999-ABCD');
assert.strictEqual(validCheck.data.buyerEmail, 'tester@lynk.id');
console.log('  ✅ Lisensi berhasil divalidasi lokal dengan signature HMAC yang sah.');

// 5. Test Anti-Piracy / HWID Mismatch Simulation
console.log('\n[Test 5] Pengujian Anti-Piracy: Simulasi Pemindahan File ke PC Lain (HWID Berbeda)...');
const fakeLicenseData = {
  ...testLicenseData,
  hwid: '9999999999999999999999999999999999999999999999999999999999999999' // HWID milik laptop lain
};
fakeLicenseData.signature = createSignature(fakeLicenseData);
saveStoredLicense(fakeLicenseData);

const mismatchCheck = checkLocalLicense();
assert.strictEqual(mismatchCheck.isValid, false, 'Lisensi dari HWID lain HARUS ditolak');
assert.strictEqual(mismatchCheck.isHwidMismatch, true, 'Harus terdeteksi sebagai isHwidMismatch');
console.log(`  ✅ Proteksi Pembajakan Berfungsi: ${mismatchCheck.reason}`);

// 6. Test Tampering Protection (Mengubah isi file tanpa signature yang sah)
console.log('\n[Test 6] Pengujian Proteksi Tampering (Edit File Ilegal)...');
const tamperedData = {
  ...testLicenseData,
  buyerEmail: 'hacker@pirate.com' // Diubah manual
  // Signature sengaja tidak diupdate
};
saveStoredLicense(tamperedData);

const tamperCheck = checkLocalLicense();
assert.strictEqual(tamperCheck.isValid, false, 'File lisensi yang di-tamper HARUS ditolak');
assert.strictEqual(tamperCheck.isTampered, true, 'Harus terdeteksi sebagai isTampered');
console.log(`  ✅ Proteksi Integritas Berfungsi: ${tamperCheck.reason}`);

// Cleanup
deleteStoredLicense();
console.log('\n======================================================');
console.log('  🎉 SEMUA 6 TEST FASE L1 BERHASIL (100% PASSED)!      ');
console.log('======================================================\n');
