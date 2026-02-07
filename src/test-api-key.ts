/**
 * Test different authentication methods for Predict.fun API
 */

import axios from 'axios';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPaths = [
  path.join(__dirname, '../../.env'),
  '/Users/cc/Desktop/CC/predict-fun-market-maker/.env',
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenvConfig({ path: envPath });
    break;
  }
}

const API_KEY = process.env.API_KEY;

async function testAuthMethods() {
  console.log('🔍 Testing different authentication methods...\n');
  console.log(`API Key: ${API_KEY}\n`);

  const methods = [
    {
      name: 'Bearer Token',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      }
    },
    {
      name: 'API Key Header',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      }
    },
    {
      name: 'API Key in Query',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { api_key: API_KEY }
    },
    {
      name: 'Basic Auth',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(API_KEY + ':').toString('base64')}`,
      }
    },
    {
      name: 'No Auth (just API key in body)',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  ];

  for (const method of methods) {
    console.log(`\n📡 Method: ${method.name}`);
    console.log('─'.repeat(80));

    try {
      const config: any = {
        method: 'get',
        url: 'https://api.predict.fun/markets',
        headers: method.headers,
      };

      if (method.params) {
        config.params = method.params;
      }

      const response = await axios(config);

      if (response.data && response.data.length > 0) {
        console.log(`✅ SUCCESS!`);
        console.log(`   Found ${response.data.length} markets\n`);

        const firstMarket = response.data[0];

        console.log('📦 First Market Fields:');
        console.log('─'.repeat(80));
        const fields = Object.keys(firstMarket);
        fields.forEach((field, i) => {
          const value = firstMarket[field];
          const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          const preview = valueStr.length > 60 ? valueStr.substring(0, 60) + '...' : valueStr;
          console.log(`  ${i + 1}. ${field}: ${preview}`);
        });
        console.log('─'.repeat(80) + '\n');

        // Check for liquidity activation fields
        const liquidityFields = fields.filter((f) =>
          f.toLowerCase().includes('liquidity') ||
          f.toLowerCase().includes('activate') ||
          f.toLowerCase().includes('points') ||
          f.toLowerCase().includes('reward')
        );

        if (liquidityFields.length > 0) {
          console.log('✅ Found Liquidity-related fields:');
          liquidityFields.forEach((f) => {
            console.log(`   - ${f}: ${JSON.stringify(firstMarket[f])}`);
          });
        } else {
          console.log('❌ No liquidity activation fields in response');
        }

        return; // Success - stop testing
      }
    } catch (error: any) {
      if (error.response) {
        console.error(`❌ Failed: ${error.response.status}`);
        console.error(`   ${error.response.data?.message || error.response.statusText}`);
      } else {
        console.error(`❌ Failed: ${error.message}`);
      }
    }
  }

  console.log('\n❌ All authentication methods failed.');
  console.log('   This API key may be invalid or expired.');
}

testAuthMethods().catch(console.error);
