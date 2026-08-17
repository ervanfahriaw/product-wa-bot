const readline = require('readline');
const { generateReply, validateKey } = require('../src/ai');
const { getConfig } = require('../src/config');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('======================================================');
console.log('      UJI COBA MANUAL AI INTEGRATION LAYER (FASE 4)   ');
console.log('======================================================\n');

const config = getConfig();

rl.question(`Masukkan Gemini API Key [Tekan ENTER untuk gunakan dari config: ${config.gemini_api_key ? 'Terisi' : 'Kosong'}]: `, async (inputKey) => {
  const apiKey = inputKey.trim() || config.gemini_api_key;

  if (!apiKey) {
    console.log('⚠️ API key belum diisi. Anda dapat mengisinya sekarang untuk menguji respons AI asli.');
  } else {
    console.log('\nMemvalidasi API key...');
    const val = await validateKey('gemini', apiKey);
    console.log('Status Validasi:', val.message);
  }

  rl.question('\nPilih mode uji coba (1: Bisnis, 2: Personal) [default 1]: ', (modeChoice) => {
    const mode = modeChoice.trim() === '2' ? 'personal' : 'bisnis';
    const defaultPrompt = mode === 'bisnis' 
      ? 'Halo min, produk Espresso Single Origin harganya berapa dan stoknya masih ada berapa?'
      : 'Halo, tolong catat tadi saya beli bensin 50rb';

    rl.question(`\nMasukkan pesan pertanyaan [default: "${defaultPrompt}"]: `, async (inputMsg) => {
      const message = inputMsg.trim() || defaultPrompt;

      console.log('\n--- Mengirim prompt ke AI Router ---');
      console.log(`Mode    : ${mode}`);
      console.log(`Pesan   : "${message}"`);
      console.log('Menunggu respons AI...\n');

      try {
        const result = await generateReply({
          message,
          mode,
          apiKeyOverride: apiKey
        });

        console.log('------------------------------------------------------');
        console.log('BALASAN DARI AI:');
        console.log('------------------------------------------------------');
        console.log(result.reply);
        console.log('------------------------------------------------------');
        console.log(`Handover Diperlukan: ${result.handoverRequired ? 'YA (Ada tag handover)' : 'TIDAK'}`);
        console.log(`Status Error       : ${result.error || 'NIHIL (Sukses 100%)'}`);
      } catch (err) {
        console.error('Terjadi error:', err.message);
      } finally {
        rl.close();
      }
    });
  });
});
