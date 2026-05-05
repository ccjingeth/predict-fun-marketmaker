/**
 * JWT auth helper for Predict API
 * - Fetches auth message
 * - Signs with EOA or Predict account signer
 * - Exchanges signature for JWT token
 * - Writes JWT_TOKEN into .env
 */

import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { Wallet } from 'ethers';
import { ChainId, OrderBuilder } from '@predictdotfun/sdk';
import { loadConfig } from './config.js';
import { createRobustProvider } from './rpc-provider.js';

function upsertEnvVar(envContent: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;

  if (pattern.test(envContent)) {
    return envContent.replace(pattern, line);
  }

  return `${envContent.trimEnd()}\n${line}\n`;
}

function unwrapData<T>(payload: any): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }

  return payload as T;
}

async function retryFetch<T>(fn: () => Promise<T>, retries = 3, delayMs = 2000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isLast = i === retries - 1;
      if (isLast) throw err;
      console.log(`   重试 ${i + 1}/${retries - 1} (${err?.message || err})...`);
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

async function main() {
  const config = loadConfig();

  if (!config.apiKey) {
    throw new Error('API_KEY is required');
  }

  const baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');

  console.log(`🔐 API: ${baseUrl}`);
  console.log(`🔐 RPC: ${config.rpcUrl || '(none)'}`);
  console.log(`🔐 Account: ${config.predictAccountAddress || '(EOA)'}`);

  const http = axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    },
  });

  console.log('🔐 Step 1: Fetch auth message...');

  let message = '';
  try {
    const res = await retryFetch(() => http.get('/v1/auth/message'));
    const payload = unwrapData<any>(res.data);
    message = typeof payload === 'string' ? payload : String(payload?.message || '');
    console.log(`✅ Auth message received (${message.length} chars)`);
  } catch (err1: any) {
    console.log(`   /v1/auth/message failed: ${err1.message}`);
    try {
      const res = await retryFetch(() => http.get('/auth/message'));
      const payload = unwrapData<any>(res.data);
      message = typeof payload === 'string' ? payload : String(payload?.message || '');
      console.log(`✅ Auth message received (fallback, ${message.length} chars)`);
    } catch (err2: any) {
      console.log(`   /auth/message failed: ${err2.message}`);
      throw new Error('Failed to fetch auth message from both endpoints');
    }
  }

  if (!message) {
    throw new Error('Auth message is empty');
  }

  console.log('🔐 Step 2: Create wallet...');
  let wallet: Wallet;
  if (config.rpcUrl) {
    const { provider } = await createRobustProvider(config.rpcUrl, 15000);
    wallet = new Wallet(config.privateKey, provider);
  } else {
    wallet = new Wallet(config.privateKey);
  }
  console.log(`✅ Wallet created: ${wallet.address}`);

  // Validate address: reject placeholder / zero addresses
  const rawAddr = config.predictAccountAddress?.trim() || '';
  const isValidAddr = /^0x[0-9a-fA-F]{40}$/.test(rawAddr) && rawAddr.toLowerCase() !== '0x' + '0'.repeat(40);
  const signerAddress = isValidAddr ? rawAddr : wallet.address;

  console.log(`🔐 Step 3: Sign message (signer=${signerAddress})...`);
  let signature = '';
  let usedPredictAccount = false;
  if (isValidAddr) {
    console.log('   Using PredictAccount signer...');
    try {
      const chainId = config.predictChainId ?? ChainId.BnbMainnet;
      const orderBuilder = await OrderBuilder.make(chainId, wallet, {
        predictAccount: rawAddr,
      });
      signature = await orderBuilder.signPredictAccountMessage(message);
      usedPredictAccount = true;
      console.log('✅ PredictAccount signature done');
    } catch (err: any) {
      console.log(`   PredictAccount signer failed (${err?.message || err}), falling back to EOA...`);
    }
  }
  if (!usedPredictAccount) {
    console.log('   Using EOA signer...');
    signature = await wallet.signMessage(message);
    console.log('✅ EOA signature done');
  }

  console.log('🔐 Step 4: Exchange for JWT...');
  let token = '';
  try {
    const res = await retryFetch(() => http.post('/v1/auth', {
      signer: signerAddress,
      signature,
      message,
    }));

    const data = unwrapData<any>(res.data);
    token = data?.token || data?.jwt || data?.accessToken || '';
    console.log(`✅ /v1/auth response received`);
  } catch (err1: any) {
    console.log(`   /v1/auth failed: ${err1.message}`);
    const res = await retryFetch(() => http.post('/auth', {
      signer: signerAddress,
      signature,
      message,
    }));

    const data = unwrapData<any>(res.data);
    token = data?.token || data?.jwt || data?.accessToken || '';
    console.log(`✅ /auth response received (fallback)`);
  }

  if (!token) {
    throw new Error('Auth succeeded but JWT token was not found in response');
  }

  console.log('🔐 Step 5: Save to .env...');
  const oldContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const updated = upsertEnvVar(oldContent, 'JWT_TOKEN', token);
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, updated, 'utf8');

  console.log(`✅ JWT token generated and saved to ${envPath}`);
  console.log(`   Signer: ${signerAddress}`);
  console.log(`   Token Prefix: ${token.slice(0, 20)}...`);
}

main().catch((error) => {
  console.error('❌ Failed to generate JWT:', error?.message || error);
  process.exit(1);
});
