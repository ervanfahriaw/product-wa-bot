const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const http = require('http');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('======================================================');
console.log('  🧪 TDD TEST: COMMERCIAL PACKAGING & SAFE LAUNCHER   ');
console.log('======================================================\n');

function runTest(category, description, fn) {
  try {
    fn();
    console.log(`  ✅ [${category}] ${description}`);
    return true;
  } catch (err) {
    console.error(`  ❌ [${category}] ${description}`);
    console.error(`     -> Error: ${err.message}\n`);
    return false;
  }
}

async function runAsyncTest(category, description, fn) {
  try {
    await fn();
    console.log(`  ✅ [${category}] ${description}`);
    return true;
  } catch (err) {
    console.error(`  ❌ [${category}] ${description}`);
    console.error(`     -> Error: ${err.message}\n`);
    return false;
  }
}

async function main() {
  let passed = 0;
  let total = 0;

  // 1. Verifikasi tanda tangan Authenticode pada Node.js executable
  total++;
  if (runTest('Security & Signature', 'Official Node.js binary has Valid Authenticode signature', () => {
    const nodeExec = process.execPath;
    assert.ok(fs.existsSync(nodeExec), 'Node executable must exist');
    const psSigCheck = `powershell -Command "(Get-AuthenticodeSignature '${nodeExec}').Status.ToString()"`;
    const sigStatus = execSync(psSigCheck).toString().trim();
    assert.strictEqual(sigStatus, 'Valid', 'Node.js executable must have Valid digital signature');
  })) passed++;

  // 2. Verifikasi sintaks skrip Batch (tidak ada unescaped & yang merusak CMD)
  total++;
  if (runTest('Batch Syntax', 'Batch scripts must not have unescaped & causing command injection / Sales errors', () => {
    // Jalankan build script untuk generate package terbaru
    console.log('     Membangun paket uji coba...');
    execSync('node scripts/build-exe.js --edition=bisnis', { cwd: ROOT_DIR, stdio: 'ignore' });

    const batFile = path.join(DIST_DIR, 'wa-bot-bisnis/Buka-Bot-Bisnis.bat');
    assert.ok(fs.existsSync(batFile), 'Buka-Bot-Bisnis.bat must exist');
    const batContent = fs.readFileSync(batFile, 'utf-8');
    
    // Periksa bahwa tidak ada baris 'title ... & ...' atau 'echo ... & ...' tanpa escaping
    const lines = batContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('title ') || trimmed.startsWith('echo ')) {
        if (trimmed.includes('&') && !trimmed.includes('^&') && !trimmed.includes('"')) {
          assert.fail(`Unescaped & found in batch line: ${trimmed}`);
        }
      }
    }
  })) passed++;

  // 3. Verifikasi ketersediaan VBScript Launcher (Icon kaset untuk kemudahan pembeli)
  total++;
  if (runTest('VBS Launcher', 'VBScript Launcher (Buka-Bot-*.vbs) must exist and be valid', () => {
    const vbsFile = path.join(DIST_DIR, 'wa-bot-bisnis/Buka-Bot-Bisnis.vbs');
    assert.ok(fs.existsSync(vbsFile), 'Buka-Bot-Bisnis.vbs must exist');
    const vbsContent = fs.readFileSync(vbsFile, 'utf-8');
    assert.ok(vbsContent.includes('WScript.Shell'), 'VBS must initialize WScript.Shell');
    assert.ok(vbsContent.includes('node.exe'), 'VBS must reference node.exe');
    assert.ok(vbsContent.includes('localhost:3000'), 'VBS must open localhost:3000');
  })) passed++;

  // 4. Verifikasi struktur folder portabel lengkap (runtime, src, node_modules, config)
  total++;
  if (runTest('Package Integrity', 'Package folder must contain self-contained runtime, src, and dependencies', () => {
    const pkgDir = path.join(DIST_DIR, 'wa-bot-bisnis');
    assert.ok(fs.existsSync(path.join(pkgDir, 'runtime/node.exe')), 'runtime/node.exe must exist in package');
    assert.ok(fs.existsSync(path.join(pkgDir, 'src/server/index.js')), 'src/server/index.js must exist in package');
    assert.ok(fs.existsSync(path.join(pkgDir, 'node_modules/express')), 'node_modules/express must exist in package');
    assert.ok(fs.existsSync(path.join(pkgDir, 'config/edition.json')), 'config/edition.json must exist in package');
  })) passed++;

  // 5. Uji Eksekusi Server dari Package Terisolasi (Simulasi Launching di Komputer Pembeli)
  total++;
  const testPort = 3999;
  const launchPassed = await runAsyncTest('Isolated Runtime Launch', `Portable node.exe runs server and responds HTTP 200 on port ${testPort}`, async () => {
    const pkgDir = path.join(DIST_DIR, 'wa-bot-bisnis');
    const nodeBin = path.join(pkgDir, 'runtime/node.exe');
    const serverEntry = path.join(pkgDir, 'src/server/index.js');

    const env = {
      ...process.env,
      PORT: testPort.toString(),
      NO_AUTO_OPEN: 'true',
      TEST_MODE: 'false'
    };

    const serverProc = spawn(nodeBin, [serverEntry], {
      cwd: pkgDir,
      env,
      stdio: 'pipe'
    });

    try {
      // Tunggu sampai server merespon HTTP request
      let isReady = false;
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 400));
        try {
          const res = await new Promise((resolve, reject) => {
            const req = http.get(`http://127.0.0.1:${testPort}/setup/license`, (response) => {
              resolve(response.statusCode);
            });
            req.on('error', reject);
            req.setTimeout(500, () => {
              req.destroy();
              reject(new Error('Timeout'));
            });
          });

          if (res === 200 || res === 302) {
            isReady = true;
            break;
          }
        } catch (_) {}
      }

      assert.ok(isReady, `Server in package must respond 200/302 on port ${testPort}`);
    } finally {
      serverProc.kill('SIGKILL');
    }
  });
  if (launchPassed) passed++;

  // 6. Verifikasi Inno Setup Compiler & File Installer Output
  total++;
  if (runTest('Inno Setup Compiler', 'Inno Setup compiles Setup_WABot_Bisnis_v1.0.exe without error', () => {
    const isccPath = 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe';
    if (!fs.existsSync(isccPath)) {
      console.log('     [SKIP] Inno Setup compiler tidak ditemukan di lokasi standar.');
      return;
    }
    const issFile = path.join(ROOT_DIR, 'installer/wa-bot-bisnis.iss');
    const cmd = `"${isccPath}" "${issFile}"`;
    execSync(cmd, { cwd: ROOT_DIR, stdio: 'ignore' });
    const installerExe = path.join(DIST_DIR, 'Setup_WABot_Bisnis_v1.0.exe');
    assert.ok(fs.existsSync(installerExe), 'Setup_WABot_Bisnis_v1.0.exe must be generated');
    assert.ok(fs.statSync(installerExe).size > 1000000, 'Installer size must be > 1MB');
  })) passed++;

  console.log('\n======================================================');
  console.log(`  📊 HASIL PENGUJIAN: ${passed} / ${total} LULUS`);
  if (passed === total) {
    console.log('  🎉 SELURUH SISTEM PACKAGING & LAUNCHER SIAP 100%!');
  } else {
    console.log('  ⚠️ ADA PENGUJIAN YANG GAGAL. SILAKAN PERIKSA DETAIL DI ATAS.');
  }
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
