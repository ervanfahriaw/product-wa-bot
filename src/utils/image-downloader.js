const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { BASE_DIR, UPLOADS_DIR } = require('./paths');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Menstandarisasi URL gambar publik (khususnya tautan share Google Drive).
 * @param {string} url 
 * @returns {string}
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // Handle Google Drive Links
  if (trimmed.includes('drive.google.com')) {
    const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      // Format download langsung Google Drive
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }

  // Handle Dropbox links
  if (trimmed.includes('dropbox.com') && trimmed.includes('dl=0')) {
    return trimmed.replace('dl=0', 'dl=1');
  }

  return trimmed;
}

/**
 * Mengunduh gambar dari URL dan menyimpannya di cache lokal (data/uploads/).
 * @param {string} url 
 * @param {number} [maxRedirects=5]
 * @returns {Promise<string|null>} Path lokal file yang tersimpan di disk
 */
async function downloadAndCacheImage(url, maxRedirects = 5) {
  if (!url || !url.startsWith('http')) return null;

  ensureUploadsDir();
  const normalized = normalizeImageUrl(url);

  // Buat nama file cache berbasis SHA256 dari URL agar tidak berulang kali mendownload
  const urlHash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  
  // Deteksi ekstensi dari URL jika ada
  let ext = '.jpg';
  try {
    const parsedPath = new URL(normalized).pathname;
    const candidateExt = path.extname(parsedPath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(candidateExt)) {
      ext = candidateExt;
    }
  } catch (_) {}

  const cachedPath = path.join(UPLOADS_DIR, `cached_${urlHash}${ext}`);

  // Jika file cache sudah ada dan ukurannya valid (> 0 byte), langsung kembalikan
  if (fs.existsSync(cachedPath)) {
    try {
      const stat = fs.statSync(cachedPath);
      if (stat.size > 0) return cachedPath;
    } catch (_) {}
  }

  return new Promise((resolve) => {
    const protocol = normalized.startsWith('https') ? https : http;
    const timeout = 10000; // 10 detik

    const req = protocol.get(normalized, { timeout }, (res) => {
      // Handle HTTP Redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (maxRedirects <= 0) {
          console.warn('[ImageDownloader] Terlalu banyak redirect untuk URL:', url);
          return resolve(null);
        }
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const origin = new URL(normalized).origin;
          redirectUrl = `${origin}${redirectUrl}`;
        }
        return resolve(downloadAndCacheImage(redirectUrl, maxRedirects - 1));
      }

      if (res.statusCode !== 200) {
        console.warn(`[ImageDownloader] Gagal mengunduh gambar dari ${url} (Status HTTP: ${res.statusCode})`);
        return resolve(null);
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          if (buffer.length === 0) return resolve(null);

          // Update ekstensi jika didapat dari Content-Type header
          const contentType = (res.headers['content-type'] || '').toLowerCase();
          let finalPath = cachedPath;
          if (contentType.includes('png') && !finalPath.endsWith('.png')) {
            finalPath = path.join(UPLOADS_DIR, `cached_${urlHash}.png`);
          } else if (contentType.includes('webp') && !finalPath.endsWith('.webp')) {
            finalPath = path.join(UPLOADS_DIR, `cached_${urlHash}.webp`);
          }

          fs.writeFileSync(finalPath, buffer);
          console.log(`[ImageDownloader] Gambar produk berhasil diunduh & dicache: ${finalPath}`);
          resolve(finalPath);
        } catch (err) {
          console.error('[ImageDownloader] Gagal menyimpan cache gambar:', err.message);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.warn(`[ImageDownloader] Error koneksi saat unduh gambar (${url}):`, err.message);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn(`[ImageDownloader] Timeout saat unduh gambar (${url})`);
      resolve(null);
    });
  });
}

/**
 * Menyelesaikan sumber gambar produk (baik file lokal maupun tautan URL).
 * @param {string} imagePath 
 * @returns {{isUrl: boolean, url?: string, fullPath?: string}|null}
 */
function resolveProductImageResource(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return null;
  const trimmed = imagePath.trim();
  if (!trimmed) return null;

  // 1. Jika adalah URL HTTP/HTTPS
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const normalized = normalizeImageUrl(trimmed);
    return {
      isUrl: true,
      url: normalized,
      fullPath: null
    };
  }

  // 2. Jika adalah File Lokal di Komputer
  const cleanName = path.basename(trimmed);
  const candidates = [
    trimmed,
    path.isAbsolute(trimmed) ? trimmed : path.join(BASE_DIR, trimmed),
    path.join(UPLOADS_DIR, cleanName),
    path.resolve(__dirname, '../../../', trimmed),
    path.join(BASE_DIR, 'data', 'uploads', cleanName),
    path.join(BASE_DIR, 'public', trimmed.startsWith('/') ? trimmed.slice(1) : trimmed)
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return {
        isUrl: false,
        url: null,
        fullPath: c
      };
    }
  }

  return null;
}

module.exports = {
  normalizeImageUrl,
  downloadAndCacheImage,
  resolveProductImageResource
};
