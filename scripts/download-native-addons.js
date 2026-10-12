const https = require('https');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const abis = [
  { abi: 'arm64-v8a', file: 'better-sqlite3-12.10.0-node-108-android-arm64.tar.gz' },
  { abi: 'armeabi-v7a', file: 'better-sqlite3-12.10.0-node-108-android-arm.tar.gz' },
  { abi: 'x86_64', file: 'better-sqlite3-12.10.0-node-108-android-x64.tar.gz' }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve, reject);
      }
      const f = fs.createWriteStream(dest);
      res.pipe(f);
      f.on('finish', () => f.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  for (const item of abis) {
    const dir = path.join(__dirname, '..', 'android', 'native-addons', item.abi);
    fs.mkdirSync(dir, { recursive: true });
    const tarPath = path.join(dir, item.file);
    const url = 'https://github.com/digidem/better-sqlite3-nodejs-mobile/releases/download/12.10.0/' + item.file;
    console.log('Downloading ' + item.file + '...');
    await download(url, tarPath);
    console.log('Extracting ' + item.file + '...');
    cp.execSync(`tar -zxvf "${tarPath}" -C "${dir}"`);
    if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
    console.log('Done ' + item.abi + ' -> ' + fs.existsSync(path.join(dir, 'better_sqlite3.node')));
  }
}

main().catch(err => console.error(err));
