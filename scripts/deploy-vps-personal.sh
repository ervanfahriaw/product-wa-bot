#!/bin/bash
# ==============================================================================
# Skrip Deployment Otomatis: WA Asisten Pribadi AI di VPS Linux (Ubuntu / Debian)
# Menjalankan asisten keuangan & produktivitas 24/7 di background menggunakan PM2
# ==============================================================================

set -e

echo "======================================================"
echo "  DEPLOYMENT OTOMATIS: WA ASISTEN PRIBADI AI (VPS)    "
echo "======================================================"

# 1. Update package repository & install system tools
echo -e "\n[1/6] Memperbarui sistem dan menginstal dependensi dasar..."
sudo apt-get update -y
sudo apt-get install -y curl wget git build-essential libsecret-1-dev

# 2. Install Chromium runtime dependencies (untuk WhatsApp Web Headless)
echo -e "\n[2/6] Menginstal library sistem untuk browser Chromium headless..."
sudo apt-get install -y \
  ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
  libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
  libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
  libxss1 libxtst6 lsb-release xdg-utils

# 3. Install Node.js v20 LTS
if ! command -v node &> /dev/null; then
  echo -e "\n[3/6] Mengunduh dan menginstal Node.js v20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo -e "\n[3/6] Node.js sudah terinstal: $(node -v)"
fi

# 4. Install PM2 Process Manager secara global
if ! command -v pm2 &> /dev/null; then
  echo -e "\n[4/6] Menginstal PM2 Process Manager..."
  sudo npm install -g pm2
else
  echo -e "\n[4/6] PM2 sudah terinstal: $(pm2 -v)"
fi

# 5. Install NPM Dependencies & Set Edition
echo -e "\n[5/6] Menginstal dependensi proyek..."
npm install --production

# Pastikan edisi terkunci ke personal
mkdir -p config
echo '{"edition": "personal"}' > config/edition.json

# 6. Jalankan Server dengan PM2
echo -e "\n[6/6] Menjalankan WA Asisten Pribadi AI di background..."
pm2 stop wa-bot-personal 2>/dev/null || true
pm2 delete wa-bot-personal 2>/dev/null || true

EDITION=personal pm2 start src/server/index.js --name "wa-bot-personal"
pm2 save
pm2 startup | tail -n 1 | sudo bash 2>/dev/null || true

# Dapatkan IP Server
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo -e "\n======================================================"
echo "  🎉 WA ASISTEN PRIBADI AI BERHASIL DIJALANKAN DI CLOUD!"
echo "======================================================"
echo "Akses Dashboard Web Controller di browser Anda:"
echo "👉 http://${SERVER_IP}:3000"
echo ""
echo "Perintah Berguna:"
echo "- Cek Status: pm2 status"
echo "- Pantau Log: pm2 logs wa-bot-personal"
echo "- Restart:    pm2 restart wa-bot-personal"
echo "- Matikan:    pm2 stop wa-bot-personal"
echo "======================================================"
