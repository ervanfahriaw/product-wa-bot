/**
 * TDD Test Suite: FASE A5 - Android Native Container, Foreground Service & Manifest Audit
 * 
 * Memverifikasi:
 * 1. Struktur folder dan konfigurasi build Gradle (settings.gradle, build.gradle, app/build.gradle).
 * 2. Kelengkapan izin (permissions) di AndroidManifest.xml:
 *    - INTERNET & ACCESS_NETWORK_STATE
 *    - FOREGROUND_SERVICE & FOREGROUND_SERVICE_DATA_SYNC (Android 14+)
 *    - WAKE_LOCK (Anti-Sleep CPU)
 *    - REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
 *    - POST_NOTIFICATIONS (Android 13+)
 *    - RECEIVE_BOOT_COMPLETED
 *    - usesCleartextTraffic="true" (agar WebView bisa membuka http://127.0.0.1:3000)
 * 3. Deklarasi komponen di AndroidManifest.xml:
 *    - MainActivity (LAUNCHER)
 *    - BotForegroundService (foregroundServiceType="dataSync")
 *    - BootReceiver (BOOT_COMPLETED)
 * 4. Implementasi kode Java Android:
 *    - BotForegroundService.java (NotificationChannel, WakeLock, startForeground)
 *    - MainActivity.java (WebView settings, battery optimization prompt, lifecycle)
 *    - NodeServerRunner.java (Environment config: PORT, ENGINE_TYPE, ANDROID_DATA_DIR)
 *    - BootReceiver.java (Auto-restart service)
 * 5. Resource XML (strings, colors, styles, layouts, vector drawable).
 * 
 * Jalankan: node scripts/test-android-a5-service-manifest.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================');
console.log('  🧪 TDD TEST SUITE: FASE A5 - ANDROID CONTAINER & MANIFEST    ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     -> Error: ${err.message}`);
    failedTests++;
  }
}

const androidDir = path.resolve(__dirname, '../android');
const appDir = path.join(androidDir, 'app');
const srcMain = path.join(appDir, 'src/main');
const javaPkgDir = path.join(srcMain, 'java/com/wabot/assistant');
const resDir = path.join(srcMain, 'res');

// --- BAGIAN 1: STRUKTUR GRADLE BUILD ---
console.log('--- [BAGIAN 1] STRUKTUR GRADLE BUILD SISTEM ---');

runTest('settings.gradle mendefinisikan root project & module :app', () => {
  const settingsPath = path.join(androidDir, 'settings.gradle');
  assert.ok(fs.existsSync(settingsPath), 'settings.gradle tidak ditemukan');
  const content = fs.readFileSync(settingsPath, 'utf8');
  assert.ok(content.includes(':app'), 'settings.gradle harus include :app');
});

runTest('build.gradle utama memuat repository google & mavenCentral', () => {
  const rootBuildPath = path.join(androidDir, 'build.gradle');
  assert.ok(fs.existsSync(rootBuildPath), 'build.gradle root tidak ditemukan');
  const content = fs.readFileSync(rootBuildPath, 'utf8');
  assert.ok(content.includes('com.android.tools.build:gradle'));
  assert.ok(content.includes('google()'));
  assert.ok(content.includes('mavenCentral()'));
});

runTest('app/build.gradle mengonfigurasi compileSdk 34 & namespace com.wabot.assistant', () => {
  const appBuildPath = path.join(appDir, 'build.gradle');
  assert.ok(fs.existsSync(appBuildPath), 'app/build.gradle tidak ditemukan');
  const content = fs.readFileSync(appBuildPath, 'utf8');
  assert.ok(content.includes("namespace 'com.wabot.assistant'"));
  assert.ok(content.includes('compileSdk 34'));
  assert.ok(content.includes('minSdk 24'));
  assert.ok(content.includes('targetSdk 34'));
  assert.ok(content.includes('androidx.webkit:webkit'));
});

// --- BAGIAN 2: AUDIT ANDROID MANIFEST ---
console.log('\n--- [BAGIAN 2] AUDIT ANDROID MANIFEST & PERMISSIONS ---');

runTest('AndroidManifest.xml memuat seluruh izin esensial untuk background keep-alive', () => {
  const manifestPath = path.join(srcMain, 'AndroidManifest.xml');
  assert.ok(fs.existsSync(manifestPath), 'AndroidManifest.xml tidak ditemukan');
  const manifest = fs.readFileSync(manifestPath, 'utf8');

  // Permissions audit
  const requiredPermissions = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    'android.permission.WAKE_LOCK',
    'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.RECEIVE_BOOT_COMPLETED'
  ];

  for (const perm of requiredPermissions) {
    assert.ok(manifest.includes(perm), `AndroidManifest.xml wajib memuat izin: ${perm}`);
  }

  // Cleartext traffic untuk localhost
  assert.ok(manifest.includes('android:usesCleartextTraffic="true"'), 'usesCleartextTraffic harus true untuk localhost');

  // Deklarasi Komponen
  assert.ok(manifest.includes('.MainActivity'));
  assert.ok(manifest.includes('.BotForegroundService'));
  assert.ok(manifest.includes('android:foregroundServiceType="dataSync"'));
  assert.ok(manifest.includes('.BootReceiver'));
});

// --- BAGIAN 3: VERIFIKASI KODE JAVA ANDROID ---
console.log('\n--- [BAGIAN 3] IMPLEMENTASI KELAS JAVA ANDROID ---');

runTest('BotForegroundService.java mengimplementasikan NotificationChannel, WakeLock, dan Foreground Service', () => {
  const servicePath = path.join(javaPkgDir, 'BotForegroundService.java');
  assert.ok(fs.existsSync(servicePath), 'BotForegroundService.java tidak ditemukan');
  const code = fs.readFileSync(servicePath, 'utf8');

  assert.ok(code.includes('extends Service'));
  assert.ok(code.includes('NotificationChannel'));
  assert.ok(code.includes('startForeground('));
  assert.ok(code.includes('PARTIAL_WAKE_LOCK'));
  assert.ok(code.includes('START_STICKY'));
  assert.ok(code.includes('releaseWakeLock('));
});

runTest('MainActivity.java mengonfigurasi WebView, permission checks, dan immersive back handling', () => {
  const activityPath = path.join(javaPkgDir, 'MainActivity.java');
  assert.ok(fs.existsSync(activityPath), 'MainActivity.java tidak ditemukan');
  const code = fs.readFileSync(activityPath, 'utf8');

  assert.ok(code.includes('extends AppCompatActivity'));
  assert.ok(code.includes('setJavaScriptEnabled(true)'));
  assert.ok(code.includes('setDomStorageEnabled(true)'));
  assert.ok(code.includes('promptBatteryOptimizationWhitelist('));
  assert.ok(code.includes('moveTaskToBack(true)'));
  assert.ok(code.includes('http://127.0.0.1:3000'));
});

runTest('NodeServerRunner.java mengelola environment variable dan healthcheck server port 3000', () => {
  const runnerPath = path.join(javaPkgDir, 'NodeServerRunner.java');
  assert.ok(fs.existsSync(runnerPath), 'NodeServerRunner.java tidak ditemukan');
  const code = fs.readFileSync(runnerPath, 'utf8');

  assert.ok(code.includes('PORT'));
  assert.ok(code.includes('3000'));
  assert.ok(code.includes('ENGINE_TYPE'));
  assert.ok(code.includes('baileys'));
  assert.ok(code.includes('ANDROID_DATA_DIR'));
  assert.ok(code.includes('isServerReady()'));
});

runTest('BootReceiver.java menangani event BOOT_COMPLETED untuk auto-restart bot', () => {
  const bootPath = path.join(javaPkgDir, 'BootReceiver.java');
  assert.ok(fs.existsSync(bootPath), 'BootReceiver.java tidak ditemukan');
  const code = fs.readFileSync(bootPath, 'utf8');

  assert.ok(code.includes('extends BroadcastReceiver'));
  assert.ok(code.includes('ACTION_BOOT_COMPLETED'));
  assert.ok(code.includes('startForegroundService'));
});

// --- BAGIAN 4: VERIFIKASI RESOURCE XML ---
console.log('\n--- [BAGIAN 4] RESOURCE XML & TAMPILAN LAYOUT ---');

runTest('Layout activity_main.xml memuat elemen WebView dan loading splash overlay', () => {
  const layoutPath = path.join(resDir, 'layout/activity_main.xml');
  assert.ok(fs.existsSync(layoutPath), 'activity_main.xml tidak ditemukan');
  const xml = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(xml.includes('@+id/webView'));
  assert.ok(xml.includes('@+id/loadingLayout'));
  assert.ok(xml.includes('ProgressBar'));
});

runTest('Resource strings.xml, colors.xml, styles.xml dan icon tersedia lengkap', () => {
  assert.ok(fs.existsSync(path.join(resDir, 'values/strings.xml')));
  assert.ok(fs.existsSync(path.join(resDir, 'values/colors.xml')));
  assert.ok(fs.existsSync(path.join(resDir, 'values/styles.xml')));
  assert.ok(fs.existsSync(path.join(resDir, 'drawable/ic_bot_notification.xml')));

  const strings = fs.readFileSync(path.join(resDir, 'values/strings.xml'), 'utf8');
  assert.ok(strings.includes('app_name'));
  assert.ok(strings.includes('notification_title'));
  assert.ok(strings.includes('notification_text'));
});

console.log('\n================================================================');
console.log(`  📊 HASIL PENGUJIAN FASE A5: ${passedTests} LULUS / ${totalTests} TOTAL`);
if (failedTests === 0) {
    console.log('  🎉 STATUS: 100% LULUS — FASE A5 SELESAI DENGAN SEMPURNA!');
} else {
    console.log(`  ⚠️ STATUS: ADA ${failedTests} PENGUJIAN YANG GAGAL.`);
}
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
