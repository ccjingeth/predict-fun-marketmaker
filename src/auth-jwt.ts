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
import { Wallet, JsonRpcProvider } from 'ethers';
import { ChainId, OrderBuilder } from '@predictdotfun/sdk';
import { loadConfig } from './config.js';

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

async function main() {
  const config = loadConfig();

  if (!config.apiKey) {
    throw new Error('API_KEY is required');
  }

  const baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
  const envPath = path.join(process.cwd(), '.env');

  const http = axios.create({
    baseURL: baseUrl,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    },
  });

  console.log('🔐 Generating JWT token...');

  let message = '';
  try {
    const res = await http.get('/v1/auth/message');
    const payload = unwrapData<any>(res.data);
    message = typeof payload === 'string' ? payload : String(payload?.message || '');
  } catch {
    const res = await http.get('/auth/message');
    const payload = unwrapData<any>(res.data);
    message = typeof payload === 'string' ? payload : String(payload?.message || '');
  }

  if (!message) {
    throw new Error('Failed to fetch auth message');
  }

  const wallet = config.rpcUrl
    ? new Wallet(config.privateKey, new JsonRpcProvider(config.rpcUrl))
    : new Wallet(config.privateKey);

  const signerAddress = config.predictAccountAddress || wallet.address;

  let signature = '';
  if (config.predictAccountAddress) {
    const chainId = config.apiBaseUrl.includes('sepolia') ? ChainId.BnbTestnet : ChainId.BnbMainnet;
    const orderBuilder = await OrderBuilder.make(chainId, wallet, {
      predictAccount: config.predictAccountAddress,
    });
    signature = await orderBuilder.signPredictAccountMessage(message);
  } else {
    signature = await wallet.signMessage(message);
  }

  let token = '';
  try {
    const res = await http.post('/v1/auth', {
      signer: signerAddress,
      signature,
      message,
    });

    const data = unwrapData<any>(res.data);
    token = data?.token || data?.jwt || data?.accessToken || '';
  } catch {
    const res = await http.post('/auth', {
      signer: signerAddress,
      signature,
      message,
    });

    const data = unwrapData<any>(res.data);
    token = data?.token || data?.jwt || data?.accessToken || '';
  }

  if (!token) {
    throw new Error('Auth succeeded but JWT token was not found in response');
  }

  const oldContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const updated = upsertEnvVar(oldContent, 'JWT_TOKEN', token);
  fs.writeFileSync(envPath, updated, 'utf8');

  console.log('✅ JWT token generated and saved to .env');
  console.log(`   Signer: ${signerAddress}`);
  console.log(`   Token Prefix: ${token.slice(0, 20)}...`);
}

main().catch((error) => {
  console.error('❌ Failed to generate JWT:', error?.message || error);
  process.exit(1);
});
