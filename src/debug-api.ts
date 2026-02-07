/**
 * Debug script to check actual API response structure
 * Run this to see what fields are returned by the API
 */

import axios from 'axios';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Load .env file - try multiple paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(process.cwd(), '.env'),
  '/Users/cc/Desktop/CC/predict-fun-market-maker/.env',
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Found .env at: ${envPath}`);
    dotenvConfig({ path: envPath });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.error('Could not find .env file');
}

const API_KEY = process.env.API_KEY;

async function debugMarketStructure() {
  console.log('🔍 Debug: Fetching market data to check structure...\n');
  console.log(`🔑 API_KEY: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'NOT FOUND'}\n`);

  if (!API_KEY) {
    console.error('❌ API_KEY not found in .env file');
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  // Try both mainnet and sepolia
  const apis = [
    { url: 'https://api.predict.fun', name: 'Mainnet' },
    { url: 'https://api-sepolia.predict.fun', name: 'Sepolia (Testnet)' },
  ];

  for (const api of apis) {
    console.log(`\n📡 Trying ${api.name}: ${api.url}`);
    console.log('─'.repeat(80));

    try {
      const response = await axios.get(`${api.url}/markets`, { headers });

      if (response.data && response.data.length > 0) {
        const firstMarket = response.data[0];

        console.log(`✅ SUCCESS on ${api.name}!`);
        console.log(`   Found ${response.data.length} markets\n`);

        console.log('📦 First Market Data Structure:');
        console.log('─'.repeat(80));
        console.log(JSON.stringify(firstMarket, null, 2));
        console.log('─'.repeat(80) + '\n');

        console.log('🔑 All Fields Found:');
        console.log('─'.repeat(80));
        const fields = Object.keys(firstMarket);
        fields.forEach((field, i) => {
          const value = firstMarket[field];
          const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          const preview = valueStr.length > 50 ? valueStr.substring(0, 50) + '...' : valueStr;
          console.log(`  ${i + 1}. ${field}: ${preview}`);
        });
        console.log('─'.repeat(80) + '\n');

        // Check for liquidity-related fields
        console.log('🎯 Looking for Liquidity Activation Fields:');
        console.log('─'.repeat(80));
        const liquidityFields = fields.filter((f) =>
          f.toLowerCase().includes('liquidity') ||
          f.toLowerCase().includes('activate') ||
          f.toLowerCase().includes('points') ||
          f.toLowerCase().includes('reward')
        );

        if (liquidityFields.length > 0) {
          console.log('  ✅ Found these potentially related fields:');
          liquidityFields.forEach((f) => {
            console.log(`    - ${f}: ${JSON.stringify(firstMarket[f])}`);
          });
        } else {
          console.log('  ❌ No obvious liquidity activation fields found');
          console.log('  ℹ️  The rules might be:');
          console.log('     - In the market details endpoint');
          console.log('     - Available via a different endpoint');
          console.log('     - Computed client-side based on orderbook');
        }
        console.log('─'.repeat(80) + '\n');

        // Fetch orderbook for first market
        const tokenId = response.data[0].token_id;
        console.log(`🔍 Fetching orderbook for: ${tokenId}\n`);

        const orderbookResponse = await axios.get(`${api.url}/orderbooks/${tokenId}`, { headers });
        console.log('📦 Orderbook Data:');
        console.log('─'.repeat(80));
        console.log(JSON.stringify(orderbookResponse.data, null, 2));
        console.log('─'.repeat(80) + '\n');

        // Success - no need to try other APIs
        return;
      }
    } catch (error: any) {
      if (error.response) {
        console.error(`❌ ${api.name} Error: ${error.response.status}`);
        console.error(`   Message: ${error.response.data?.message || error.response.statusText}`);
      } else {
        console.error(`❌ ${api.name} Error: ${error.message}`);
      }
    }
  }

  console.log('\n❌ All API attempts failed. Please check your API key.');
  console.log('   Get a new key from: https://discord.gg/predictdotfun\n');
}

// Run debug
debugMarketStructure().catch(console.error);
