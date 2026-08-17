const qrcode = require('qrcode');
const { initClient, getStatus, statusEmitter, destroyClient } = require('../src/engine');

console.log('====================================================');
console.log('       PENGUJIAN WHATSAPP ENGINE (FASE 2)           ');
console.log('====================================================\n');
console.log('Menginisialisasi WhatsApp client...');

// Pantau perubahan status engine
statusEmitter.on('change', async (status) => {
  console.log(`\n[Status Update] -> ${status.state.toUpperCase()}`);

  if (status.rawQr) {
    console.log('\n[SCAN QR CODE DI BAWAH INI MENGGUNAKAN WHATSAPP]:\n');
    try {
      const terminalQr = await qrcode.toString(status.rawQr, { type: 'terminal', small: true });
      console.log(terminalQr);
    } catch (err) {
      console.log('Raw QR string:', status.rawQr);
    }
  }

  if (status.state === 'ready') {
    console.log('\n✅ WHATSAPP ENGINE BERHASIL TERSAMBUNG DAN READY!');
    console.log('Informasi Bot:', status.info);
    console.log('\n--- UJI COBA PESAN MASUK ---');
    console.log('Silakan kirim pesan WhatsApp apa saja ke nomor bot ini dari HP lain.');
    console.log('Pesan akan tercatat di log konsol di bawah ini secara otomatis.');
    console.log('(Tekan Ctrl+C untuk keluar dari pengujian kapan saja)\n');
  }
});

// Jalankan client
const client = initClient();

// Penanganan penghentian aman (Ctrl+C)
process.on('SIGINT', async () => {
  console.log('\nMenutup sesi WhatsApp Engine...');
  await destroyClient();
  console.log('Engine selesai dimatikan.');
  process.exit(0);
});
