const crypto = require('crypto');
const path = require('path');
const db = require('../license-server/db');

/**
 * Script CLI untuk menghasilkan License Key baru.
 * 
 * Contoh Penggunaan:
 * node scripts/generate-licenses.js --edition bisnis --count 5
 * node scripts/generate-licenses.js --edition personal --count 10 --buyer "budi@gmail.com" --name "Budi Santoso"
 */

function generateKey(edition = 'bisnis') {
  const prefix = edition === 'bisnis' ? 'BIZ' : (edition === 'personal' ? 'PERS' : 'ALL');
  const randPart = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `WABOT-${prefix}-${randPart()}-${randPart()}-${randPart()}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    edition: 'bisnis',
    count: 1,
    maxDevices: 1,
    buyer: '',
    name: ''
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--edition' || args[i] === '-e') {
      options.edition = (args[++i] || 'bisnis').toLowerCase();
    } else if (args[i] === '--count' || args[i] === '-c') {
      options.count = parseInt(args[++i], 10) || 1;
    } else if (args[i] === '--max-devices' || args[i] === '-m') {
      options.maxDevices = parseInt(args[++i], 10) || 1;
    } else if (args[i] === '--buyer' || args[i] === '-b') {
      options.buyer = args[++i] || '';
    } else if (args[i] === '--name' || args[i] === '-n') {
      options.name = args[++i] || '';
    }
  }

  return options;
}

function main() {
  const opts = parseArgs();

  console.log('======================================================');
  console.log('       GENERATOR LISENSI RESMI WA BOT DIGITAL        ');
  console.log('======================================================');
  console.log(`Edisi Target : ${opts.edition.toUpperCase()}`);
  console.log(`Jumlah Kunci : ${opts.count}`);
  console.log(`Maks Device  : ${opts.maxDevices} Perangkat`);
  if (opts.buyer) console.log(`Pembeli      : ${opts.name || 'User'} <${opts.buyer}>`);
  console.log('------------------------------------------------------\n');

  const generatedKeys = [];

  for (let i = 1; i <= opts.count; i++) {
    const key = generateKey(opts.edition);
    const lic = db.createLicense({
      licenseKey: key,
      edition: opts.edition,
      maxDevices: opts.maxDevices,
      buyerEmail: opts.buyer,
      buyerName: opts.name,
      status: 'active'
    });
    generatedKeys.push(lic);
    console.log(` [${i.toString().padStart(2, '0')}] ${lic.license_key}  (Status: ${lic.status}, Max: ${lic.max_devices} PC)`);
  }

  console.log('\n======================================================');
  console.log(` ✅ Berhasil membuat ${generatedKeys.length} lisensi baru!`);
  console.log(` 📁 Data tersimpan di: license-server/data/licenses.json`);
  console.log('======================================================\n');
}

main();
