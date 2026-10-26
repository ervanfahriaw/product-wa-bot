const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables dari .env jika belum terisi
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

// Konfigurasi Resend dari Environment Variables
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'lisensi@etalasetekno.my.id';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'vannesh129@gmail.com';

/**
 * Membuat template HTML email profesional & modern untuk pengiriman lisensi.
 */
function buildLicenseEmailHtml({ buyerName, licenseKey, productName, refId, edition = 'bisnis' }) {
  const cleanName = buyerName || 'Pelanggan Terhormat';
  const cleanProduct = productName || 'WA Bot AI untuk Toko Online - CS Otomatis, Sekali Beli';
  const cleanRef = refId || '-';
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kode Lisensi Resmi WA Bot AI Anda</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 24px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; border-radius: 20px; padding: 4px 14px; margin-bottom: 12px;">
                <span style="color: #4ade80; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">✓ Pembayaran Berhasil</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
                Lisensi Resmi WA Bot AI Anda
              </h1>
              <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">
                Sekali Beli, Bebas Biaya Bulanan & Siap Digunakan
              </p>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 16px; margin: 0 0 16px 0; color: #1e293b;">
                Halo <strong>${cleanName}</strong>,
              </p>
              <p style="font-size: 15px; margin: 0 0 24px 0; color: #475569;">
                Terima kasih banyak atas pembelian Anda! Pembayaran untuk pesanan <strong>${cleanProduct}</strong> telah kami terima dengan sukses.
              </p>

              <!-- Highlight License Key Box -->
              <div style="background-color: #f8fafc; border: 2px dashed #0284c7; border-radius: 10px; padding: 22px 18px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 1px;">
                  Kode Lisensi Resmi Anda:
                </p>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 23px; font-weight: 700; color: #0f172a; background-color: #ffffff; padding: 14px 16px; border-radius: 8px; border: 1px solid #cbd5e1; letter-spacing: 2px; user-select: all; word-break: break-all;">
                  ${licenseKey}
                </div>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b;">
                  🔒 Status: <strong style="color: #16a34a;">Aktif Permanen</strong> &bull; Kuota: <strong>1 Perangkat</strong> (Dapat dipindahkan)
                </p>
              </div>

              <!-- Transaction Summary Table -->
              <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; font-size: 14px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="color: #64748b; width: 35%; border-bottom: 1px solid #e2e8f0;">Produk:</td>
                  <td style="color: #1e293b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${cleanProduct}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Nomor Referensi:</td>
                  <td style="color: #1e293b; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${cleanRef}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Tanggal Transaksi:</td>
                  <td style="color: #1e293b;">${dateStr} WIB</td>
                </tr>
              </table>

              <!-- Quick 3-Step Guide -->
              <h3 style="font-size: 16px; color: #0f172a; margin: 28px 0 14px 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">
                🚀 Panduan Cepat Aktivasi (3 Langkah):
              </h3>
              <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569;">
                <li style="margin-bottom: 10px;">
                  Buka aplikasi <strong>WA Bot</strong> di Laptop/PC atau HP Android Anda.
                </li>
                <li style="margin-bottom: 10px;">
                  Pada halaman awal setup (<strong>Step 0: Aktivasi Lisensi</strong>), salin & tempelkan kode lisensi di atas: <code style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #0284c7;">${licenseKey}</code>
                </li>
                <li style="margin-bottom: 10px;">
                  Klik tombol <strong>Aktivasi Sekarang</strong>. Bot Anda akan langsung aktif resmi dan siap melayani pelanggan toko online 24 jam nonstop!
                </li>
              </ol>

              <!-- Support Note -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-top: 26px;">
                <p style="margin: 0; font-size: 13px; color: #1e40af;">
                  💡 <strong>Perlu Bantuan Instalasi?</strong><br>
                  Jika Anda mengalami kendala saat setup atau ingin memindahkan lisensi ke perangkat lain, silakan balas email ini atau hubungi layanan dukungan kami.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 22px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                Email ini dikirim secara otomatis oleh License Manager WA Bot AI.<br>
                Simpan email ini sebagai bukti kepemilikan lisensi resmi Anda.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Mengirim email lisensi ke pembeli menggunakan Resend API.
 * 
 * @param {object} params
 * @param {string} params.to - Email pembeli
 * @param {string} params.buyerName - Nama pembeli
 * @param {string} params.licenseKey - Kode lisensi (contoh: WABOT-BIZ-XXXX-YYYY-ZZZZ)
 * @param {string} params.productName - Judul produk yang dibeli
 * @param {string} params.refId - Referensi transaksi Lynk.id
 * @returns {Promise<{ success: boolean, id?: string, error?: string, warning?: string }>}
 */
async function sendLicenseEmail({ to, buyerName, licenseKey, productName, refId }) {
  if (!to) {
    return { success: false, error: 'Email tujuan (to) kosong' };
  }

  if (!RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY belum dikonfigurasi di environment variable.');
    return { success: false, warning: 'RESEND_API_KEY belum dikonfigurasi di environment variable.' };
  }

  const htmlContent = buildLicenseEmailHtml({
    buyerName,
    licenseKey,
    productName,
    refId
  });

  const subject = `Lisensi Resmi WA Bot AI Anda: ${licenseKey}`;

  // Payload Resend
  const payload = {
    from: RESEND_FROM_EMAIL,
    to: [to],
    subject,
    html: htmlContent
  };

  try {
    const res = await callResendApi('/emails', payload);
    if (res.success) {
      console.log(`[Resend] Email lisensi berhasil dikirim ke ${to} (ID: ${res.data.id})`);
      return { success: true, id: res.data.id, recipient: to };
    }

    // Jika terjadi error validasi domain (Resend Sandbox/Testing mode hanya izinkan kirim ke email pemilik)
    if (res.status === 403 && res.error && res.error.message && res.error.message.includes('only send testing emails')) {
      console.warn(`[Resend] Catatan: Domain belum diverifikasi di resend.com/domains.`);
      console.warn(`[Resend] Mengirim salinan lisensi ke email admin (${OWNER_EMAIL}) sebagai fallback...`);

      // Kirim salinan ke email pemilik akun
      const fallbackPayload = {
        from: RESEND_FROM_EMAIL,
        to: [OWNER_EMAIL],
        subject: `[FORWARD KE: ${to}] Lisensi Baru: ${licenseKey} (${buyerName})`,
        html: `
          <div style="background: #fef08a; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-family: sans-serif; font-size: 13px;">
            ⚠️ <strong>PEMBERITAHUAN ADMIN:</strong><br>
            Email pembeli asli adalah <strong>${to}</strong>.<br>
            Karena domain kustom belum diverifikasi di <a href="https://resend.com/domains">resend.com/domains</a>, email dikirim ke email akun Anda (${OWNER_EMAIL}).<br>
            Silakan verifikasi domain Anda agar email otomatis terkirim langsung ke semua pembeli secara mandiri!
          </div>
          ${htmlContent}
        `
      };

      const fallbackRes = await callResendApi('/emails', fallbackPayload);
      return {
        success: true,
        id: fallbackRes?.data?.id,
        recipient: OWNER_EMAIL,
        intendedRecipient: to,
        warning: 'Domain belum diverifikasi di Resend. Email lisensi diteruskan ke email owner (vannesh129@gmail.com). Tambahkan domain di resend.com/domains agar bisa langsung ke pembeli.'
      };
    }

    console.error('[Resend] Gagal mengirim email:', res.error);
    return { success: false, error: res.error };
  } catch (err) {
    console.error('[Resend] Exception saat kirim email:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Helper HTTP request ke Resend API tanpa dependency tambahan.
 */
function callResendApi(endpoint, body) {
  return new Promise((resolve) => {
    const dataStr = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.resend.com',
      port: 443,
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        'User-Agent': 'WABot-License-Manager/1.0'
      },
      timeout: 10000
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resBody);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data: parsed, status: res.statusCode });
          } else {
            resolve({ success: false, status: res.statusCode, error: parsed });
          }
        } catch (e) {
          resolve({ success: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, raw: resBody });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request to Resend API timeout' });
    });

    req.write(dataStr);
    req.end();
  });
}

module.exports = {
  sendLicenseEmail,
  buildLicenseEmailHtml
};
