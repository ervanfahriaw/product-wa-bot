const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR } = require('./paths');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Parsing buffer multipart/form-data murni tanpa dependensi external.
 * @param {Buffer} buffer 
 * @param {string} boundary 
 * @returns {{body: object, file: object|null}}
 */
function parseMultipartBuffer(buffer, boundary) {
  ensureUploadsDir();

  const body = {};
  let file = null;

  const boundaryBytes = Buffer.from(`--${boundary}`);
  let start = buffer.indexOf(boundaryBytes);

  while (start !== -1) {
    // Geser setelah boundary
    start += boundaryBytes.length;

    // Cek penutup payload '--'
    if (buffer[start] === 45 && buffer[start + 1] === 45) {
      break;
    }

    // Lewati CRLF setelah boundary jika ada
    if (buffer[start] === 13 && buffer[start + 1] === 10) {
      start += 2;
    }

    // Cari boundary berikutnya
    const nextBoundary = buffer.indexOf(boundaryBytes, start);
    if (nextBoundary === -1) break;

    // Akhir bagian adalah sebelum CRLF dari next boundary
    let partEnd = nextBoundary;
    if (buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) {
      partEnd -= 2;
    }

    const partBuffer = buffer.slice(start, partEnd);

    // Cari pemisah header dan body (\r\n\r\n)
    const headerEndIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEndIndex !== -1) {
      const headerString = partBuffer.slice(0, headerEndIndex).toString('utf-8');
      const dataBuffer = partBuffer.slice(headerEndIndex + 4);

      const nameMatch = headerString.match(/name="([^"]+)"/);
      const filenameMatch = headerString.match(/filename="([^"]*)"/);

      if (filenameMatch) {
        const originalName = filenameMatch[1];
        if (originalName && originalName.trim() !== '' && dataBuffer.length > 0) {
          const sanitizedName = Date.now() + '_' + path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
          const savedPath = path.join(UPLOADS_DIR, sanitizedName);

          fs.writeFileSync(savedPath, dataBuffer);

          file = {
            fieldname: nameMatch ? nameMatch[1] : 'file',
            originalname: originalName,
            filename: sanitizedName,
            path: savedPath,
            size: dataBuffer.length,
            buffer: dataBuffer
          };

          if (nameMatch && nameMatch[1]) {
            body[nameMatch[1]] = savedPath;
          }
        }
      } else if (nameMatch && nameMatch[1]) {
        body[nameMatch[1]] = dataBuffer.toString('utf-8').trim();
      }
    }

    start = nextBoundary;
  }

  return { body, file };
}

/**
 * Middleware Express untuk menangani upload multipart/form-data.
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @param {import('express').NextFunction} next 
 */
function handleFileUpload(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return next();
  }

  const boundaryMatch = contentType.match(/boundary=(?:["']?)([^"';]+)(?:["']?)/);
  if (!boundaryMatch) {
    return next();
  }

  const boundary = boundaryMatch[1];
  const chunks = [];

  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const { body, file } = parseMultipartBuffer(buffer, boundary);

      req.body = { ...(req.body || {}), ...body };
      req.file = file;

      next();
    } catch (err) {
      console.error('[MultipartParser] Error saat parsing upload file:', err.message);
      next();
    }
  });

  req.on('error', err => {
    console.error('[MultipartParser] Request stream error:', err);
    next();
  });
}

module.exports = {
  parseMultipartBuffer,
  handleFileUpload
};
