const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.resolve(__dirname, '../../data/uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Middleware Express untuk menangani upload multipart/form-data ringan tanpa library pihak ketiga.
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

  ensureUploadsDir();
  const boundary = boundaryMatch[1];
  const chunks = [];

  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      
      let start = 0;
      req.body = req.body || {};
      req.file = null;

      while (start < buffer.length) {
        const nextBoundary = buffer.indexOf(boundaryBuffer, start);
        if (nextBoundary === -1) break;

        const partStart = start + (start === 0 ? boundaryBuffer.length + 2 : boundaryBuffer.length + 2);
        const partEnd = nextBoundary - 2;

        if (partEnd > partStart) {
          const partBuffer = buffer.slice(partStart, partEnd);
          const headerEndIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'));

          if (headerEndIndex !== -1) {
            const headerString = partBuffer.slice(0, headerEndIndex).toString('utf-8');
            const dataBuffer = partBuffer.slice(headerEndIndex + 4);

            const nameMatch = headerString.match(/name="([^"]+)"/);
            const filenameMatch = headerString.match(/filename="([^"]+)"/);

            if (filenameMatch && filenameMatch[1]) {
              const originalName = filenameMatch[1];
              const sanitizedName = Date.now() + '_' + path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
              const savedPath = path.join(UPLOADS_DIR, sanitizedName);

              fs.writeFileSync(savedPath, dataBuffer);

              req.file = {
                fieldname: nameMatch ? nameMatch[1] : 'file',
                originalname: originalName,
                filename: sanitizedName,
                path: savedPath,
                size: dataBuffer.length,
                buffer: dataBuffer
              };
            } else if (nameMatch && nameMatch[1]) {
              req.body[nameMatch[1]] = dataBuffer.toString('utf-8').trim();
            }
          }
        }

        start = nextBoundary + boundaryBuffer.length;
        if (buffer[start] === 45 && buffer[start + 1] === 45) {
          // '--' akhir stream
          break;
        }
      }
      next();
    } catch (err) {
      console.error('[MultipartParser] Error saat parsing upload file:', err.message);
      next();
    }
  });

  req.on('error', err => {
    console.error('[MultipartParser] Request error:', err);
    next();
  });
}

module.exports = {
  handleFileUpload,
  UPLOADS_DIR
};
