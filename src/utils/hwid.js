const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

let cachedHwid = null;

/**
 * Mengekstrak Hardware ID unik dari sistem operasi.
 * Mendukung Windows, Linux, dan macOS tanpa binary C++ pihak ketiga.
 * @returns {string} SHA-256 Hash yang merepresentasikan HWID unik
 */
function getHwid() {
  if (cachedHwid) {
    return cachedHwid;
  }

  let rawId = '';
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      // 1. Coba ambil UUID Motherboard via PowerShell CimInstance
      try {
        const out = execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"', {
          encoding: 'utf8',
          timeout: 4000,
          windowsHide: true
        }).trim();
        if (out && out.length > 8 && !out.includes('00000000')) {
          rawId += `WIN_UUID:${out};`;
        }
      } catch (_) {}

      // 2. Coba ambil MachineGuid dari Registry Windows
      try {
        const regOut = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
          encoding: 'utf8',
          timeout: 3000,
          windowsHide: true
        });
        const match = regOut.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9\-]+)/);
        if (match && match[1]) {
          rawId += `WIN_GUID:${match[1].trim()};`;
        }
      } catch (_) {}

      // 3. Fallback jika wmic tersedia
      if (!rawId) {
        try {
          const wmicOut = execSync('wmic csproduct get uuid', {
            encoding: 'utf8',
            timeout: 3000,
            windowsHide: true
          }).trim();
          rawId += `WIN_WMIC:${wmicOut};`;
        } catch (_) {}
      }

    } else if (platform === 'linux') {
      // 1. Cek standard systemd / dbus machine-id
      if (fs.existsSync('/etc/machine-id')) {
        rawId += `LNX_MID:${fs.readFileSync('/etc/machine-id', 'utf8').trim()};`;
      } else if (fs.existsSync('/var/lib/dbus/machine-id')) {
        rawId += `LNX_DBUS:${fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim()};`;
      }

      // 2. Tambahan CPU Info serial jika ada
      try {
        if (fs.existsSync('/proc/cpuinfo')) {
          const cpu = fs.readFileSync('/proc/cpuinfo', 'utf8');
          const serialMatch = cpu.match(/Serial\s*:\s*([a-fA-F0-9]+)/);
          if (serialMatch && serialMatch[1]) {
            rawId += `LNX_CPUSERIAL:${serialMatch[1]};`;
          }
        }
      } catch (_) {}

    } else if (platform === 'darwin') {
      try {
        const macOut = execSync('ioreg -rd1 -c IOPlatformExpertDevice', {
          encoding: 'utf8',
          timeout: 4000
        });
        const match = macOut.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        if (match && match[1]) {
          rawId += `MAC_UUID:${match[1]};`;
        }
      } catch (_) {}
    }
  } catch (err) {
    // Silent fallback
  }

  // Fallback sekunder jika query OS gagal: gunakan CPU model + hostname + username
  if (!rawId || rawId.trim().length < 5) {
    const cpus = os.cpus().map(c => c.model).join(',');
    const hostname = os.hostname();
    const homeDir = os.homedir();
    rawId = `FALLBACK:${platform}:${cpus}:${hostname}:${homeDir}`;
  }

  // Hash deterministik dengan SHA-256
  const hash = crypto
    .createHash('sha256')
    .update(`WABOT_SALT_2026_HWID:${rawId}`)
    .digest('hex')
    .toUpperCase();

  cachedHwid = hash;
  return cachedHwid;
}

/**
 * Mengambil metadata perangkat saat ini untuk kebutuhan registrasi lisensi.
 * @returns {object}
 */
function getDeviceFingerprint() {
  const hwid = getHwid();
  const hostname = os.hostname();
  const platform = process.platform;
  let username = 'User';
  try {
    username = os.userInfo().username || 'User';
  } catch (_) {}

  return {
    hwid,
    deviceName: `${username}@${hostname} (${platform})`,
    platform,
    hostname,
    arch: process.arch
  };
}

module.exports = {
  getHwid,
  getDeviceFingerprint
};
