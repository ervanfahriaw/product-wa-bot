#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DEPLOYMENT OTOMATIS VPS LINUX (UBUNTU / DEBIAN)
# WA Bot Bisnis & Asisten Pribadi
# ==============================================================================

set -e

echo "======================================================"
echo "    MEMULAI SETUP OTOMATIS SERVER VPS UNTUK WA BOT    "
echo "======================================================"

# 1. Update paket sistem
echo "[1/6] Memperbarui indeks paket sistem Linux..."
sudo apt-get update -y
sudo apt-get install -y curl wget git build-essential

# 2. Install Node.js LTS (v20.x)
echo "[2/6] Menginstal Node.js v20 LTS..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "Node.js sudah terinstal: $(node -v)"
fi

# 3. Install dependensi sistem untuk Chromium / Puppeteer di Linux Headless
echo "[3/6] Menginstal dependensi sistem Linux untuk Chromium (whatsapp-web.js)..."
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  xdg-utils

# 4. Install PM2 Process Manager secara global
echo "[4/6] Menginstal PM2 Process Manager..."
sudo npm install -g pm2

# 5. Install dependensi Node.js proyek
echo "[5/6] Menginstal dependensi proyek..."
cd "$(dirname "$0")/.."
npm install --production

# Buka port 3000 di firewall UFW jika UFW aktif
if command -v ufw &> /dev/null; then
  sudo ufw allow 3000/tcp || true
fi

# 6. Jalankan aplikasi menggunakan PM2
echo "[6/6] Menjalankan WA Bot Assistant dengan PM2..."
pm2 stop wa-bot-assistant 2>/dev/null || true
pm2 delete wa-bot-assistant 2>/dev/null || true
pm2 start src/server/index.js --name "wa-bot-assistant"
pm2 save

echo ""
echo "======================================================"
echo "  ✅ DEPLOYMENT VPS BERHASIL SELESAI!"
echo "======================================================"
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo "Akses Panel Web Controller Bot di browser Anda:"
echo "👉 http://${SERVER_IP}:3000"
echo ""
echo "Perintah berguna PM2:"
echo "- Cek status bot:  pm2 status"
echo "- Lihat log pesan: pm2 logs wa-bot-assistant"
echo "- Restart bot:     pm2 restart wa-bot-assistant"
echo "======================================================"
