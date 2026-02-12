import { loadConfig } from '../src/config.js';
import { PredictAPI } from '../src/api/client.js';
import { OrderManager } from '../src/order-manager.js';

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const val = Number(raw);
  return Number.isFinite(val) ? val : fallback;
}

function envBool(key: string): boolean {
  return String(process.env[key] || '').toLowerCase() === 'true';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function main() {
  const config = loadConfig();
  const api = new PredictAPI(config.apiBaseUrl, config.apiKey, config.jwtToken);

  console.log('🔧 Smoke test starting...');
  const ok = await api.testConnection();
  if (!ok) {
    throw new Error('API connection failed. Check API_BASE_URL / API_KEY.');
  }

  let tokenId = process.env.SMOKE_TOKEN_ID || config.marketTokenIds?.[0];
  if (!tokenId) {
    const markets = await api.getMarkets();
    tokenId = markets[0]?.token_id;
  }

  if (!tokenId) {
    throw new Error('No token_id found. Set SMOKE_TOKEN_ID or MARKET_TOKEN_IDS.');
  }

  const market = await api.getMarket(tokenId);
  const orderbook = await api.getOrderbook(tokenId);
  const bestBid = Number(orderbook.best_bid || 0) || undefined;
  const bestAsk = Number(orderbook.best_ask || 0) || undefined;

  const side = (process.env.SMOKE_SIDE || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
  const shares = envNumber('SMOKE_SHARES', 1);
  const bufferBps = envNumber('SMOKE_PRICE_BUFFER_BPS', 50);
  const cancelMs = envNumber('SMOKE_CANCEL_MS', 5000);
  const live = envBool('SMOKE_LIVE');

  const reference = side === 'BUY' ? bestBid ?? bestAsk ?? 0.5 : bestAsk ?? bestBid ?? 0.5;
  const buffer = bufferBps / 10000;
  const rawPrice = side === 'BUY' ? reference * (1 - buffer) : reference * (1 + buffer);
  const price = clamp(rawPrice, 0.0001, 0.9999);

  console.log(`Token: ${tokenId}`);
  console.log(`Side: ${side}`);
  console.log(`Shares: ${shares}`);
  console.log(`BestBid: ${bestBid ?? 'n/a'}  BestAsk: ${bestAsk ?? 'n/a'}`);
  console.log(`LimitPrice: ${price.toFixed(4)}  (buffer ${bufferBps} bps)`);

  if (!live || !config.enableTrading) {
    console.log('\n🧪 Dry-run mode (no order placed).');
    console.log('Set SMOKE_LIVE=true and ENABLE_TRADING=true to place/cancel a tiny order.');
    return;
  }

  if (!config.jwtToken) {
    throw new Error('ENABLE_TRADING requires JWT_TOKEN in .env');
  }

  const orderManager = await OrderManager.create(config);
  const payload = await orderManager.buildLimitOrderPayload({
    market,
    side,
    price,
    shares,
  });

  const response = await api.createOrder(payload);
  const orderId =
    response?.order_hash ||
    response?.order?.hash ||
    response?.order?.order_hash ||
    response?.data?.order?.hash ||
    response?.data?.order?.order_hash ||
    response?.hash ||
    response?.id ||
    response?.order?.id;

  if (!orderId) {
    throw new Error('Order submission failed: missing order id');
  }

  console.log(`✅ Order submitted: ${orderId}`);

  if (cancelMs > 0) {
    console.log(`⏳ Waiting ${cancelMs}ms before cancel...`);
    await new Promise((resolve) => setTimeout(resolve, cancelMs));
    await api.removeOrders([String(orderId)]);
    console.log('🧹 Order cancelled');
  }
}

main().catch((err) => {
  console.error('❌ Smoke test failed:', err);
  process.exitCode = 1;
});
