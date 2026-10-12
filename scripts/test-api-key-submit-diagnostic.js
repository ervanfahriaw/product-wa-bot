const http = require('http');
const path = require('path');
const fs = require('fs');

// Set TEST_MODE to true so server doesn't auto-open browser or bind port 3000
process.env.TEST_MODE = 'true';
process.env.PORT = '3998';

const app = require('../src/server/index.js');

async function testFlow() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(3998, '127.0.0.1', resolve));
  console.log('Test server listening on port 3998');

  function makeRequest(method, reqPath, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const postData = body ? (typeof body === 'string' ? body : new URLSearchParams(body).toString()) : null;
      const options = {
        hostname: '127.0.0.1',
        port: 3998,
        path: reqPath,
        method: method,
        headers: {
          ...headers,
          ...(postData ? {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          } : {})
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  try {
    console.log('\n--- 1. Testing GET /setup/step-3 ---');
    const res1 = await makeRequest('GET', '/setup/step-3');
    console.log('Status:', res1.statusCode, 'Location:', res1.headers.location);

    console.log('\n--- 2. Testing POST /setup/step-3 with Gemini API Key ---');
    const res2 = await makeRequest('POST', '/setup/step-3', {
      gemini_api_key: 'AIzaSyTestApiKey1234567890'
    });
    console.log('Status:', res2.statusCode, 'Location:', res2.headers.location);

    console.log('\n--- 3. Testing GET /setup/step-4 ---');
    const res3 = await makeRequest('GET', '/setup/step-4');
    console.log('Status:', res3.statusCode, 'Location:', res3.headers.location);
    if (res3.statusCode !== 200 && res3.statusCode !== 302) {
      console.log('Body error:', res3.body.slice(0, 500));
    }

    console.log('\n--- 4. Testing POST /setup/step-4 ---');
    const res4 = await makeRequest('POST', '/setup/step-4', {
      product_name: 'Produk Uji Coba',
      product_price: '50000',
      product_stock: '10',
      product_description: 'Deskripsi uji coba'
    });
    console.log('Status:', res4.statusCode, 'Location:', res4.headers.location);

    console.log('\n--- 5. Testing GET /dashboard ---');
    const res5 = await makeRequest('GET', '/dashboard');
    console.log('Status:', res5.statusCode, 'Location:', res5.headers.location);
    if (res5.statusCode !== 200) {
      console.log('Body error:', res5.body.slice(0, 500));
    }

    console.log('\n--- 6. Testing GET /dashboard/settings ---');
    const res6 = await makeRequest('GET', '/dashboard/settings');
    console.log('Status:', res6.statusCode);
    if (res6.statusCode !== 200) {
      console.log('Body error:', res6.body.slice(0, 500));
    }

    console.log('\n--- 7. Testing POST /dashboard/settings ---');
    const res7 = await makeRequest('POST', '/dashboard/settings', {
      gemini_api_key: 'AIzaSyUpdatedKey987654321',
      mode: 'bisnis',
      business_name: 'Toko Kopi Maju'
    });
    console.log('Status:', res7.statusCode, 'Location:', res7.headers.location);

    console.log('\n--- 8. Testing GET /dashboard after update ---');
    const res8 = await makeRequest('GET', '/dashboard');
    console.log('Status:', res8.statusCode);

    console.log('\n✅ All HTTP steps completed successfully without crash!');
  } catch (err) {
    console.error('❌ Error during testFlow:', err);
  } finally {
    server.close();
  }
}

testFlow();
