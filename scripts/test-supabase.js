const https = require('https');
const path = require('path');
const fs = require('fs');

// Load .env manual parser
function loadEnv() {
  const envPath = path.join(__dirname, '../license-server/.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kdzihdcuhhqvqosemrnk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUB_KEY;

console.log('Testing Supabase Connection...');
console.log('URL:', SUPABASE_URL);
console.log('Key Prefix:', SUPABASE_KEY ? SUPABASE_KEY.substring(0, 15) + '...' : 'NONE');

const url = new URL(`${SUPABASE_URL}/rest/v1/licenses?select=count`);

const req = https.request({
  hostname: url.hostname,
  port: 443,
  path: url.pathname + url.search,
  method: 'GET',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Range': '0-0'
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Headers:', res.headers['content-range'] || res.headers);
    console.log('Response:', body);
  });
});

req.on('error', err => {
  console.error('Connection error:', err.message);
});

req.end();
