const fs = require('fs');
const path = require('path');
const os = require('os');
const { BASE_DIR } = require('./paths');

/**
 * Mencari path executable Chromium / Chrome / Edge yang tersedia di sistem operasi pengguna.
 * Prioritas pencarian:
 * 1. Environment Variable PUPPETEER_EXECUTABLE_PATH atau CHROME_BIN
 * 2. Folder lokal bundle aplikasi (./chromium/chrome.exe)
 * 3. Google Chrome (Program Files 64-bit, 32-bit, LocalAppData)
 * 4. Microsoft Edge (Tersedia secara bawaan di 100% Windows 10 & 11)
 * 5. Brave Browser
 * 6. Linux / macOS default binary paths
 * 
 * @returns {string|null} Path ke browser binary, atau null jika tidak ditemukan
 */
function findSystemBrowserExecutable() {
  // 1. Cek Environment Variable eksplisit
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  // 2. Cek Folder Lokal Portable Chromium (jika didistribusikan bersama binary)
  const localPaths = [
    path.join(BASE_DIR, 'chromium', 'chrome.exe'),
    path.join(BASE_DIR, 'bin', 'chromium', 'chrome.exe'),
    path.join(BASE_DIR, 'chrome-win', 'chrome.exe'),
    path.join(BASE_DIR, 'chromium', 'msedge.exe')
  ];

  for (const p of localPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  const platform = os.platform();

  // 3. Platform Windows (win32)
  if (platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : 'C:\\Users\\Default\\AppData\\Local');

    const windowsCandidates = [
      // Google Chrome (Prioritas Utama)
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),

      // Microsoft Edge (Chromium - Bawaan 100% OS Windows 10 & 11)
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),

      // Brave Browser
      path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),

      // Chromium Standalone di AppData
      path.join(localAppData, 'Chromium', 'Application', 'chrome.exe')
    ];

    for (const cand of windowsCandidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
  }

  // 4. Platform Linux / VPS
  if (platform === 'linux') {
    const linuxCandidates = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
      '/usr/bin/microsoft-edge-stable',
      '/usr/bin/microsoft-edge'
    ];

    for (const cand of linuxCandidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
  }

  // 5. Platform macOS (darwin)
  if (platform === 'darwin') {
    const macCandidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];

    for (const cand of macCandidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
  }

  return null;
}

module.exports = {
  findSystemBrowserExecutable
};
