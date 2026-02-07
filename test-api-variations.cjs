const axios = require('axios');

const apiKey = '05357838-7414-4f8f-849a-3216b0d7ce81';

const variations = [
  { name: 'Bearer with UUID', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }},
  { name: 'Bearer without dashes', headers: { 'Authorization': `Bearer ${apiKey.replace(/-/g, '')}`, 'Content-Type': 'application/json' }},
  { name: 'Bearer uppercase', headers: { 'Authorization': `Bearer ${apiKey.toUpperCase()}`, 'Content-Type': 'application/json' }},
  { name: 'Just API key', headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' }},
  { name: 'Token prefix', headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' }},
];

async function testVariations() {
  for (const variation of variations) {
    try {
      const response = await axios.get('https://api.predict.fun/markets', { headers: variation.headers, timeout: 5000 });
      console.log(`✅ ${variation.name}: SUCCESS`);
      console.log(`   Found ${response.data.length} markets`);
      process.exit(0);
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${variation.name}: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
      } else {
        console.log(`❌ ${variation.name}: ${error.message}`);
      }
    }
  }
}

testVariations();
