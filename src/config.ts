/**
 * Configuration Management
 */

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Config } from './types.js';

// Load .env file (supports override path)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = process.env.ENV_PATH || path.join(__dirname, '../.env');
dotenvConfig({ path: envPath });

/**
 * Load and validate configuration
 */
export function loadConfig(): Config {
  const config: Config = {
    apiBaseUrl: process.env.API_BASE_URL || 'https://api.predict.fun',
    privateKey: process.env.PRIVATE_KEY || '',
    rpcUrl: process.env.RPC_URL,
    predictAccountAddress: process.env.PREDICT_ACCOUNT_ADDRESS,
    apiKey: process.env.API_KEY,
    jwtToken: process.env.JWT_TOKEN,
    spread: parseFloat(process.env.SPREAD || '0.02'),
    minSpread: parseFloat(process.env.MIN_SPREAD || '0.01'),
    maxSpread: parseFloat(process.env.MAX_SPREAD || '0.08'),
    useValueSignal: process.env.USE_VALUE_SIGNAL === 'true',
    valueSignalWeight: parseFloat(process.env.VALUE_SIGNAL_WEIGHT || '0.35'),
    valueConfidenceMin: parseFloat(process.env.VALUE_CONFIDENCE_MIN || '0.6'),
    orderSize: parseFloat(process.env.ORDER_SIZE || '10'),
    maxSingleOrderValue: parseFloat(process.env.MAX_SINGLE_ORDER_VALUE || '50'),
    maxPosition: parseFloat(process.env.MAX_POSITION || '100'),
    inventorySkewFactor: parseFloat(process.env.INVENTORY_SKEW_FACTOR || '0.15'),
    cancelThreshold: parseFloat(process.env.CANCEL_THRESHOLD || '0.05'),
    repriceThreshold: parseFloat(process.env.REPRICE_THRESHOLD || '0.003'),
    minOrderIntervalMs: parseInt(process.env.MIN_ORDER_INTERVAL_MS || '3000'),
    maxOrdersPerMarket: parseInt(process.env.MAX_ORDERS_PER_MARKET || '2'),
    maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '200'),
    antiFillBps: parseFloat(process.env.ANTI_FILL_BPS || '0.002'),
    nearTouchBps: parseFloat(process.env.NEAR_TOUCH_BPS || '0.0015'),
    cooldownAfterCancelMs: parseInt(process.env.COOLDOWN_AFTER_CANCEL_MS || '4000'),
    volatilityPauseBps: parseFloat(process.env.VOLATILITY_PAUSE_BPS || '0.01'),
    volatilityLookbackMs: parseInt(process.env.VOLATILITY_LOOKBACK_MS || '10000'),
    pauseAfterVolatilityMs: parseInt(process.env.PAUSE_AFTER_VOLATILITY_MS || '8000'),
    hedgeOnFill: process.env.HEDGE_ON_FILL === 'true',
    hedgeTriggerShares: parseFloat(process.env.HEDGE_TRIGGER_SHARES || '50'),
    hedgeMode: (process.env.HEDGE_MODE || 'FLATTEN') as Config['hedgeMode'],
    hedgeMaxSlippageBps: parseInt(process.env.HEDGE_MAX_SLIPPAGE_BPS || '250'),
    crossPlatformEnabled: process.env.CROSS_PLATFORM_ENABLED === 'true',
    crossPlatformMinProfit: parseFloat(process.env.CROSS_PLATFORM_MIN_PROFIT || '0.01'),
    crossPlatformMinSimilarity: parseFloat(process.env.CROSS_PLATFORM_MIN_SIMILARITY || '0.78'),
    crossPlatformAutoExecute: process.env.CROSS_PLATFORM_AUTO_EXECUTE === 'true',
    crossPlatformRequireConfirm: process.env.CROSS_PLATFORM_REQUIRE_CONFIRM !== 'false',
    crossPlatformMaxMatches: parseInt(process.env.CROSS_PLATFORM_MAX_MATCHES || '20'),
    crossPlatformTransferCost: parseFloat(process.env.CROSS_PLATFORM_TRANSFER_COST || '0.002'),
    crossPlatformSlippageBps: parseInt(process.env.CROSS_PLATFORM_SLIPPAGE_BPS || '250'),
    autoConfirmAll: process.env.AUTO_CONFIRM === 'true',
    crossPlatformMappingPath: process.env.CROSS_PLATFORM_MAPPING_PATH || 'cross-platform-mapping.json',
    crossPlatformUseMapping: process.env.CROSS_PLATFORM_USE_MAPPING !== 'false',
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
    alertMinIntervalMs: parseInt(process.env.ALERT_MIN_INTERVAL_MS || '60000'),
    dependencyEnabled: process.env.DEPENDENCY_ARB_ENABLED === 'true',
    dependencyConstraintsPath: process.env.DEPENDENCY_CONSTRAINTS_PATH || 'dependency-constraints.json',
    dependencyPythonPath: process.env.DEPENDENCY_PYTHON_PATH || 'python3',
    dependencyPythonScript: process.env.DEPENDENCY_PYTHON_SCRIPT || 'scripts/dependency-arb.py',
    dependencyMinProfit: parseFloat(process.env.DEPENDENCY_MIN_PROFIT || '0.02'),
    dependencyMaxLegs: parseInt(process.env.DEPENDENCY_MAX_LEGS || '6'),
    dependencyMaxNotional: parseFloat(process.env.DEPENDENCY_MAX_NOTIONAL || '200'),
    dependencyMinDepth: parseFloat(process.env.DEPENDENCY_MIN_DEPTH || '1'),
    dependencyFeeBps: parseFloat(process.env.DEPENDENCY_FEE_BPS || '100'),
    dependencyFeeCurveRate: parseFloat(process.env.DEPENDENCY_FEE_CURVE_RATE || '0'),
    dependencyFeeCurveExponent: parseFloat(process.env.DEPENDENCY_FEE_CURVE_EXPONENT || '0'),
    dependencySlippageBps: parseFloat(process.env.DEPENDENCY_SLIPPAGE_BPS || '20'),
    dependencyMaxIter: parseInt(process.env.DEPENDENCY_MAX_ITER || '12'),
    dependencyOracleTimeoutSec: parseFloat(process.env.DEPENDENCY_ORACLE_TIMEOUT_SEC || '2'),
    dependencyTimeoutMs: parseInt(process.env.DEPENDENCY_TIMEOUT_MS || '10000'),
    dependencyAllowSells: process.env.DEPENDENCY_ALLOW_SELLS !== 'false',
    multiOutcomeEnabled: process.env.MULTI_OUTCOME_ENABLED !== 'false',
    multiOutcomeMinOutcomes: parseInt(process.env.MULTI_OUTCOME_MIN_OUTCOMES || '3'),
    multiOutcomeMaxShares: parseInt(process.env.MULTI_OUTCOME_MAX_SHARES || '500'),
    arbAutoExecute: process.env.ARB_AUTO_EXECUTE === 'true',
    arbAutoExecuteValue: process.env.ARB_AUTO_EXECUTE_VALUE === 'true',
    arbExecuteTopN: parseInt(process.env.ARB_EXECUTE_TOP_N || '1'),
    arbExecutionCooldownMs: parseInt(process.env.ARB_EXECUTION_COOLDOWN_MS || '60000'),
    arbScanIntervalMs: parseInt(process.env.ARB_SCAN_INTERVAL_MS || '10000'),
    arbMaxMarkets: parseInt(process.env.ARB_MAX_MARKETS || '80'),
    arbOrderbookConcurrency: parseInt(process.env.ARB_ORDERBOOK_CONCURRENCY || '8'),
    arbMarketsCacheMs: parseInt(process.env.ARB_MARKETS_CACHE_MS || '10000'),
    arbWsMaxAgeMs: parseInt(process.env.ARB_WS_MAX_AGE_MS || '10000'),
    arbMaxErrors: parseInt(process.env.ARB_MAX_ERRORS || '5'),
    arbErrorWindowMs: parseInt(process.env.ARB_ERROR_WINDOW_MS || '60000'),
    arbPauseOnErrorMs: parseInt(process.env.ARB_PAUSE_ON_ERROR_MS || '60000'),
    arbWsHealthLogMs: parseInt(process.env.ARB_WS_HEALTH_LOG_MS || '0'),
    predictFeeBps: parseFloat(process.env.PREDICT_FEE_BPS || '100'),
    polymarketGammaUrl: process.env.POLYMARKET_GAMMA_URL || 'https://gamma-api.polymarket.com',
    polymarketClobUrl: process.env.POLYMARKET_CLOB_URL || 'https://clob.polymarket.com',
    polymarketMaxMarkets: parseInt(process.env.POLYMARKET_MAX_MARKETS || '30'),
    polymarketFeeBps: parseFloat(process.env.POLYMARKET_FEE_BPS || '100'),
    polymarketFeeRateUrl: process.env.POLYMARKET_FEE_RATE_URL || 'https://clob.polymarket.com/fee-rate',
    polymarketFeeRateCacheMs: parseInt(process.env.POLYMARKET_FEE_RATE_CACHE_MS || '300000'),
    polymarketFeeCurveRate: parseFloat(process.env.POLYMARKET_FEE_CURVE_RATE || '0.25'),
    polymarketFeeCurveExponent: parseFloat(process.env.POLYMARKET_FEE_CURVE_EXPONENT || '2'),
    polymarketWsEnabled: process.env.POLYMARKET_WS_ENABLED === 'true',
    polymarketWsUrl: process.env.POLYMARKET_WS_URL || 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
    polymarketWsCustomFeature: process.env.POLYMARKET_WS_CUSTOM_FEATURE === 'true',
    polymarketWsInitialDump: process.env.POLYMARKET_WS_INITIAL_DUMP !== 'false',
    polymarketCacheTtlMs: parseInt(process.env.POLYMARKET_CACHE_TTL_MS || '60000'),
    predictWsEnabled: process.env.PREDICT_WS_ENABLED === 'true',
    predictWsUrl: process.env.PREDICT_WS_URL || 'wss://ws.predict.fun/ws',
    predictWsApiKey: process.env.PREDICT_WS_API_KEY || process.env.API_KEY,
    predictWsTopicKey: (process.env.PREDICT_WS_TOPIC_KEY || 'token_id') as Config['predictWsTopicKey'],
    polymarketPrivateKey: process.env.POLYMARKET_PRIVATE_KEY,
    polymarketApiKey: process.env.POLYMARKET_API_KEY,
    polymarketApiSecret: process.env.POLYMARKET_API_SECRET,
    polymarketApiPassphrase: process.env.POLYMARKET_API_PASSPHRASE,
    polymarketChainId: parseInt(process.env.POLYMARKET_CHAIN_ID || '137'),
    polymarketAutoDeriveApiKey: process.env.POLYMARKET_AUTO_DERIVE_API_KEY !== 'false',
    opinionOpenApiUrl: process.env.OPINION_OPENAPI_URL || 'https://proxy.opinion.trade:8443/openapi',
    opinionApiKey: process.env.OPINION_API_KEY,
    opinionMaxMarkets: parseInt(process.env.OPINION_MAX_MARKETS || '30'),
    opinionFeeBps: parseFloat(process.env.OPINION_FEE_BPS || '100'),
    opinionPythonPath: process.env.OPINION_PYTHON_PATH || 'python3',
    opinionPythonScript: process.env.OPINION_PYTHON_SCRIPT || 'scripts/opinion-trade.py',
    opinionPrivateKey: process.env.OPINION_PRIVATE_KEY,
    opinionChainId: parseInt(process.env.OPINION_CHAIN_ID || '56'),
    opinionHost: process.env.OPINION_HOST || 'https://proxy.opinion.trade:8443',
    opinionWsEnabled: process.env.OPINION_WS_ENABLED === 'true',
    opinionWsUrl: process.env.OPINION_WS_URL || 'wss://ws.opinion.trade',
    opinionWsHeartbeatMs: parseInt(process.env.OPINION_WS_HEARTBEAT_MS || '30000'),
    marketTokenIds: process.env.MARKET_TOKEN_IDS
      ? process.env.MARKET_TOKEN_IDS.split(',').map((s) => s.trim())
      : undefined,
    refreshInterval: parseInt(process.env.REFRESH_INTERVAL || '5000'),
    enableTrading: process.env.ENABLE_TRADING === 'true',
  };

  // Validate critical fields
  if (!config.privateKey) {
    throw new Error('PRIVATE_KEY is required in .env file');
  }

  if (!config.apiKey) {
    throw new Error('API_KEY is required in .env file');
  }

  if ((config.minSpread ?? 0) > (config.maxSpread ?? 0.08)) {
    throw new Error('MIN_SPREAD cannot be greater than MAX_SPREAD');
  }

  if ((config.valueSignalWeight ?? 0) < 0 || (config.valueSignalWeight ?? 0) > 1) {
    throw new Error('VALUE_SIGNAL_WEIGHT must be between 0 and 1');
  }

  if ((config.valueConfidenceMin ?? 0) < 0 || (config.valueConfidenceMin ?? 0) > 1) {
    throw new Error('VALUE_CONFIDENCE_MIN must be between 0 and 1');
  }

  if ((config.crossPlatformMinSimilarity ?? 0) < 0 || (config.crossPlatformMinSimilarity ?? 0) > 1) {
    throw new Error('CROSS_PLATFORM_MIN_SIMILARITY must be between 0 and 1');
  }

  if ((config.crossPlatformMinProfit ?? 0) < 0) {
    throw new Error('CROSS_PLATFORM_MIN_PROFIT must be >= 0');
  }

  return config;
}

/**
 * Print configuration summary
 */
export function printConfig(config: Config): void {
  console.log('\n⚙️  Configuration:');
  console.log('─'.repeat(80));
  console.log(`API URL: ${config.apiBaseUrl}`);
  console.log(`RPC URL: ${config.rpcUrl || 'Using SDK default provider'}`);
  console.log(`Predict Account: ${config.predictAccountAddress || 'Using direct EOA'}`);
  console.log(`JWT Token: ${config.jwtToken ? '✅ configured' : '❌ missing (required for private endpoints)'}`);
  console.log(`Spread: ${(config.spread * 100).toFixed(2)}%`);
  console.log(`Spread Range: ${(config.minSpread! * 100).toFixed(2)}% - ${(config.maxSpread! * 100).toFixed(2)}%`);
  console.log(`Value Signal: ${config.useValueSignal ? '✅ enabled' : '❌ disabled'}`);
  console.log(`Value Signal Weight: ${config.valueSignalWeight}`);
  console.log(`Value Confidence Min: ${config.valueConfidenceMin}`);
  console.log(`Order Size: $${config.orderSize}`);
  console.log(`Max Single Order: $${config.maxSingleOrderValue}`);
  console.log(`Max Position: $${config.maxPosition}`);
  console.log(`Inventory Skew Factor: ${config.inventorySkewFactor}`);
  console.log(`Cancel Threshold: ${(config.cancelThreshold * 100).toFixed(2)}%`);
  console.log(`Reprice Threshold: ${(config.repriceThreshold! * 100).toFixed(2)}%`);
  console.log(`Min Order Interval: ${config.minOrderIntervalMs}ms`);
  console.log(`Max Orders/Market: ${config.maxOrdersPerMarket}`);
  console.log(`Max Daily Loss: $${config.maxDailyLoss}`);
  console.log(`Anti Fill Bps: ${(config.antiFillBps ?? 0) * 100}%`);
  console.log(`Near Touch Bps: ${(config.nearTouchBps ?? 0) * 100}%`);
  console.log(`Hedge On Fill: ${config.hedgeOnFill ? '✅' : '❌'}`);
  console.log(`Hedge Mode: ${config.hedgeMode}`);
  console.log(`Cross-Platform Enabled: ${config.crossPlatformEnabled ? '✅' : '❌'}`);
  console.log(`Cross-Platform Mapping: ${config.crossPlatformUseMapping ? '✅' : '❌'}`);
  console.log(`Auto Confirm: ${config.autoConfirmAll ? '✅' : '❌'}`);
  console.log(`Alerts: ${config.alertWebhookUrl ? '✅' : '❌'}`);
  console.log(`Dependency Arb: ${config.dependencyEnabled ? '✅' : '❌'}`);
  console.log(`Multi-Outcome: ${config.multiOutcomeEnabled ? '✅' : '❌'}`);
  console.log(`Arb Auto Execute: ${config.arbAutoExecute ? '✅' : '❌'}`);
  console.log(`Polymarket WS: ${config.polymarketWsEnabled ? '✅' : '❌'}`);
  console.log(`Predict WS: ${config.predictWsEnabled ? '✅' : '❌'}`);
  console.log(`Opinion WS: ${config.opinionWsEnabled ? '✅' : '❌'}`);
  console.log(`Arb Scan Interval: ${config.arbScanIntervalMs}ms`);
  console.log(`Arb Max Markets: ${config.arbMaxMarkets}`);
  console.log(`Arb WS Max Age: ${config.arbWsMaxAgeMs}ms`);
  console.log(`Arb WS Health Log: ${config.arbWsHealthLogMs}ms`);
  console.log(`Refresh Interval: ${config.refreshInterval}ms`);
  console.log(`Trading Enabled: ${config.enableTrading ? '✅' : '❌ (Dry Run)'}`);
  if (config.marketTokenIds && config.marketTokenIds.length > 0) {
    console.log(`Markets: ${config.marketTokenIds.join(', ')}`);
  } else {
    console.log(`Markets: Auto-select liquid markets`);
  }
  console.log('─'.repeat(80) + '\n');
}
