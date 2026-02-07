#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const { Wallet } = require('ethers');

const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

dotenv.config({ path: envPath });

function maskKey(key) {
  if (!key) return '(empty)';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`⚠️  ${message}`);
}

function readLevelPrice(level) {
  if (Array.isArray(level) && level.length > 0) {
    return Number(level[0]);
  }

  if (level && typeof level === 'object' && 'price' in level) {
    return Number(level.price);
  }

  return NaN;
}

function unwrapData(payload) {
  if (payload && typeof payload === 'object' && payload.data !== undefined) {
    return payload.data;
  }

  return payload;
}

async function requestWithFallback(client, method, paths, config = {}) {
  let lastError;

  for (const url of paths) {
    try {
      const response = await client.request({ method, url, ...config });
      return unwrapData(response.data);
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      if (status === 404 || status === 405 || status === 501) {
        continue;
      }
      break;
    }
  }

  throw lastError;
}

async function main() {
  console.log('\n🔍 Predict.fun API 一键自检');
  console.log('─'.repeat(60));

  if (!fs.existsSync(envPath)) {
    fail(`未找到 .env 文件: ${envPath}`);
  }

  const apiBaseUrl = (process.env.API_BASE_URL || 'https://api.predict.fun').replace(/\/+$/, '');
  const apiKey = (process.env.API_KEY || '').trim();
  const jwtToken = (process.env.JWT_TOKEN || '').trim();
  const privateKey = (process.env.PRIVATE_KEY || '').trim();
  const predictAccountAddress = (process.env.PREDICT_ACCOUNT_ADDRESS || '').trim();

  if (!apiKey) {
    fail('API_KEY 为空，请先在 .env 里配置 API_KEY');
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    warn('PRIVATE_KEY 看起来不是 0x + 64 位十六进制格式（做市实盘前请确认）');
  }

  if (privateKey.toLowerCase() === '0x0000000000000000000000000000000000000000000000000000000000000001') {
    warn('当前 PRIVATE_KEY 是示例测试值，不能用于实盘');
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  };

  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  }

  console.log(`API URL: ${apiBaseUrl}`);
  console.log(`API Key: ${maskKey(apiKey)}`);
  console.log(`JWT Token: ${jwtToken ? '✅ configured' : '❌ missing'}`);

  const client = axios.create({
    baseURL: apiBaseUrl,
    headers,
    timeout: 15000,
  });

  try {
    const markets = await requestWithFallback(client, 'get', ['/v1/markets', '/markets']);
    if (!Array.isArray(markets) || markets.length === 0) {
      fail('/markets 返回为空，无法继续检查');
    }

    const sampleMarket = markets.find((m) => m && (m.token_id || m.tokenId)) || markets[0];
    const tokenId = String(sampleMarket.token_id || sampleMarket.tokenId || sampleMarket.id || '');

    if (!tokenId) {
      fail('/markets 返回数据缺少 token_id');
    }

    console.log(`✅ /markets 正常，市场数量: ${markets.length}`);
    console.log(`   样本市场: ${String(sampleMarket.question || sampleMarket.title || '').slice(0, 60)}...`);
    console.log(`   Token ID: ${tokenId}`);

    const orderbook = await requestWithFallback(client, 'get', [
      `/v1/markets/${encodeURIComponent(tokenId)}/orderbook`,
      `/orderbooks/${encodeURIComponent(tokenId)}`,
    ]);

    const bids = Array.isArray(orderbook?.bids) ? orderbook.bids : [];
    const asks = Array.isArray(orderbook?.asks) ? orderbook.asks : [];

    const bestBid = bids.length > 0 ? readLevelPrice(bids[0]) : NaN;
    const bestAsk = asks.length > 0 ? readLevelPrice(asks[0]) : NaN;

    console.log(`✅ /orderbook 正常，bids: ${bids.length}，asks: ${asks.length}`);

    if (Number.isFinite(bestBid)) {
      console.log(`   Best Bid: ${bestBid.toFixed(4)}`);
    }

    if (Number.isFinite(bestAsk)) {
      console.log(`   Best Ask: ${bestAsk.toFixed(4)}`);
    }

    if (jwtToken) {
      const walletAddress = /^0x[a-fA-F0-9]{64}$/.test(privateKey)
        ? new Wallet(privateKey).address
        : '';
      const account = predictAccountAddress || walletAddress;

      if (!account) {
        warn('JWT 已配置，但无法推导 account 地址，跳过 /positions 检查');
      } else {
        await requestWithFallback(client, 'get', ['/v1/positions', '/positions'], {
          params: { account },
        });
        console.log(`✅ /positions 正常（account=${account}）`);
      }
    } else {
      warn('未配置 JWT_TOKEN，已跳过私有接口检查（/orders /positions）');
      console.log('   运行 `npm run auth:jwt` 可自动获取并写入 JWT_TOKEN。');
    }

    console.log('─'.repeat(60));
    console.log('✅ 自检通过：基础行情接口可访问');
    console.log('建议下一步：');
    console.log('   1) npm run auth:jwt');
    console.log('   2) npm run setup:approvals');
    console.log('   3) ENABLE_TRADING=true 后运行 npm run start:mm\n');
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText || 'Unknown error';

      if (status === 401) {
        fail(`鉴权失败 (401): ${message}。请检查 API_KEY / JWT_TOKEN 是否正确`);
      }

      if (status === 429) {
        fail(`触发限流 (429): ${message}。请稍后重试`);
      }

      fail(`请求失败 (${status}): ${message}`);
    }

    fail(`网络或请求异常: ${error.message}`);
  }
}

main();
