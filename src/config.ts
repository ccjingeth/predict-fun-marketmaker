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

const parseList = (value?: string): string[] | undefined => {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
};

/**
 * Load and validate configuration
 */
export function loadConfig(): Config {
  const crossPlatformOrderTypeRaw = (process.env.CROSS_PLATFORM_ORDER_TYPE || '').toUpperCase();
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
    mmAccountEquityUsd: parseFloat(process.env.MM_ACCOUNT_EQUITY_USD || '0'),
    mmMaxPositionPct: parseFloat(process.env.MM_MAX_POSITION_PCT || '0'),
    mmOrderSizePct: parseFloat(process.env.MM_ORDER_SIZE_PCT || '0'),
    mmMaxSingleOrderPct: parseFloat(process.env.MM_MAX_SINGLE_ORDER_PCT || '0'),
    mmMaxDailyLossPct: parseFloat(process.env.MM_MAX_DAILY_LOSS_PCT || '0'),
    mmAdaptiveParams: process.env.MM_ADAPTIVE_PARAMS !== 'false',
    mmSpreadVolWeight: parseFloat(process.env.MM_SPREAD_VOL_WEIGHT || '1.2'),
    mmSpreadLiquidityWeight: parseFloat(process.env.MM_SPREAD_LIQ_WEIGHT || '0.5'),
    mmBookSpreadWeight: parseFloat(process.env.MM_BOOK_SPREAD_WEIGHT || '0.35'),
    mmVolEmaAlpha: parseFloat(process.env.MM_VOL_EMA_ALPHA || '0.2'),
    mmDepthEmaAlpha: parseFloat(process.env.MM_DEPTH_EMA_ALPHA || '0.2'),
    mmDepthLevels: parseInt(process.env.MM_DEPTH_LEVELS || '3'),
    mmMinTopDepthShares: parseFloat(process.env.MM_MIN_TOP_DEPTH_SHARES || '0'),
    mmMinTopDepthUsd: parseFloat(process.env.MM_MIN_TOP_DEPTH_USD || '0'),
    mmDepthDropRatio: parseFloat(process.env.MM_DEPTH_DROP_RATIO || '0.5'),
    mmDepthRefShares: parseFloat(process.env.MM_DEPTH_REF_SHARES || '200'),
    mmInventorySkewVolWeight: parseFloat(process.env.MM_INVENTORY_SKEW_VOL_WEIGHT || '1.0'),
    mmInventorySkewDepthWeight: parseFloat(process.env.MM_INVENTORY_SKEW_DEPTH_WEIGHT || '0.4'),
    mmIcebergEnabled: process.env.MM_ICEBERG_ENABLED === 'true',
    mmIcebergRatio: parseFloat(process.env.MM_ICEBERG_RATIO || '0.3'),
    mmIcebergMaxChunkShares: parseFloat(process.env.MM_ICEBERG_MAX_CHUNK_SHARES || '15'),
    mmAdaptiveProfile: (process.env.MM_ADAPTIVE_PROFILE || 'AUTO') as Config['mmAdaptiveProfile'],
    mmVolatilityCalmBps: parseFloat(process.env.MM_VOLATILITY_CALM_BPS || '0.004'),
    mmVolatilityVolatileBps: parseFloat(process.env.MM_VOLATILITY_VOLATILE_BPS || '0.02'),
    mmIntervalVolatilityBps: parseFloat(process.env.MM_INTERVAL_VOLATILITY_BPS || '0.01'),
    mmIntervalVolMultiplier: parseFloat(process.env.MM_INTERVAL_VOL_MULTIPLIER || '1.6'),
    mmProfileLiquidityLow: parseFloat(process.env.MM_PROFILE_LIQUIDITY_LOW || '0.5'),
    mmProfileLiquidityHigh: parseFloat(process.env.MM_PROFILE_LIQUIDITY_HIGH || '1.2'),
    mmProfileSpreadMinCalm: parseFloat(process.env.MM_PROFILE_SPREAD_MIN_CALM || '0.006'),
    mmProfileSpreadMaxCalm: parseFloat(process.env.MM_PROFILE_SPREAD_MAX_CALM || '0.03'),
    mmProfileSpreadMinVolatile: parseFloat(process.env.MM_PROFILE_SPREAD_MIN_VOLATILE || '0.02'),
    mmProfileSpreadMaxVolatile: parseFloat(process.env.MM_PROFILE_SPREAD_MAX_VOLATILE || '0.12'),
    mmIcebergRequoteMs: parseInt(process.env.MM_ICEBERG_REQUOTE_MS || '4000'),
    mmOrderRefreshMs: parseInt(process.env.MM_ORDER_REFRESH_MS || '0'),
    mmOrderDepthUsage: parseFloat(process.env.MM_ORDER_DEPTH_USAGE || '0'),
    mmInventorySpreadWeight: parseFloat(process.env.MM_INVENTORY_SPREAD_WEIGHT || '0.2'),
    mmRepriceVolMultiplier: parseFloat(process.env.MM_REPRICE_VOL_MULTIPLIER || '1.5'),
    mmCancelVolMultiplier: parseFloat(process.env.MM_CANCEL_VOL_MULTIPLIER || '2'),
    mmNearTouchVolMultiplier: parseFloat(process.env.MM_NEAR_TOUCH_VOL_MULTIPLIER || '1.5'),
    mmAntiFillVolMultiplier: parseFloat(process.env.MM_ANTI_FILL_VOL_MULTIPLIER || '1.5'),
    mmCooldownVolMultiplier: parseFloat(process.env.MM_COOLDOWN_VOL_MULTIPLIER || '1.2'),
    mmImbalanceLevels: parseInt(process.env.MM_IMBALANCE_LEVELS || '3'),
    mmImbalanceWeight: parseFloat(process.env.MM_IMBALANCE_WEIGHT || '0.25'),
    mmImbalanceMaxSkew: parseFloat(process.env.MM_IMBALANCE_MAX_SKEW || '0.6'),
    mmImbalanceSpreadWeight: parseFloat(process.env.MM_IMBALANCE_SPREAD_WEIGHT || '0.2'),
    mmDepthTrendDropRatio: parseFloat(process.env.MM_DEPTH_TREND_DROP_RATIO || '0.4'),
    mmIcebergRequoteVolMultiplier: parseFloat(process.env.MM_ICEBERG_REQUOTE_VOL_MULTIPLIER || '1.2'),
    mmIcebergRequoteDepthMultiplier: parseFloat(process.env.MM_ICEBERG_REQUOTE_DEPTH_MULTIPLIER || '1.0'),
    mmProfileHoldMs: parseInt(process.env.MM_PROFILE_HOLD_MS || '15000'),
    mmProfileVolHysteresisBps: parseFloat(process.env.MM_PROFILE_VOL_HYSTERESIS_BPS || '0.002'),
    mmIcebergFillPenalty: parseFloat(process.env.MM_ICEBERG_FILL_PENALTY || '0.6'),
    mmIcebergPenaltyDecayMs: parseInt(process.env.MM_ICEBERG_PENALTY_DECAY_MS || '60000'),
    mmMetricsPath: process.env.MM_METRICS_PATH || 'data/mm-metrics.json',
    mmMetricsFlushMs: parseInt(process.env.MM_METRICS_FLUSH_MS || '5000'),
    inventorySkewFactor: parseFloat(process.env.INVENTORY_SKEW_FACTOR || '0.15'),
    cancelThreshold: parseFloat(process.env.CANCEL_THRESHOLD || '0.05'),
    repriceThreshold: parseFloat(process.env.REPRICE_THRESHOLD || '0.003'),
    minOrderIntervalMs: parseInt(process.env.MIN_ORDER_INTERVAL_MS || '3000'),
    maxOrdersPerMarket: parseInt(process.env.MAX_ORDERS_PER_MARKET || '2'),
    maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '200'),
    mmDepthMinShares: parseFloat(process.env.MM_DEPTH_MIN_SHARES || '50'),
    mmDepthTargetShares: parseFloat(process.env.MM_DEPTH_TARGET_SHARES || '400'),
    mmDepthPenaltyWeight: parseFloat(process.env.MM_DEPTH_PENALTY_WEIGHT || '0.6'),
    mmDepthShareFactor: parseFloat(process.env.MM_DEPTH_SHARE_FACTOR || '0.2'),
    mmAsymSpreadInventoryWeight: parseFloat(process.env.MM_ASYM_SPREAD_INVENTORY_WEIGHT || '0.4'),
    mmAsymSpreadImbalanceWeight: parseFloat(process.env.MM_ASYM_SPREAD_IMBALANCE_WEIGHT || '0.35'),
    mmAsymSpreadMinFactor: parseFloat(process.env.MM_ASYM_SPREAD_MIN_FACTOR || '0.6'),
    mmAsymSpreadMaxFactor: parseFloat(process.env.MM_ASYM_SPREAD_MAX_FACTOR || '1.8'),
    mmQuoteOffsetBps: parseFloat(process.env.MM_QUOTE_OFFSET_BPS || '0'),
    mmAggressiveMoveBps: parseFloat(process.env.MM_AGGRESSIVE_MOVE_BPS || '0.002'),
    mmAggressiveMoveWindowMs: parseInt(process.env.MM_AGGRESSIVE_MOVE_WINDOW_MS || '1500'),
    mmVolatilityHighBps: parseFloat(process.env.MM_VOLATILITY_HIGH_BPS || '0.006'),
    mmVolatilityLowBps: parseFloat(process.env.MM_VOLATILITY_LOW_BPS || '0.002'),
    mmIntervalProfileVolatileMultiplier: parseFloat(process.env.MM_INTERVAL_PROFILE_VOLATILE_MULTIPLIER || '1.3'),
    mmIntervalProfileCalmMultiplier: parseFloat(process.env.MM_INTERVAL_PROFILE_CALM_MULTIPLIER || '0.8'),
    mmMaxSharesPerOrder: parseFloat(process.env.MM_MAX_SHARES_PER_ORDER || '0'),
    mmSizeInventoryWeight: parseFloat(process.env.MM_SIZE_INVENTORY_WEIGHT || '0.4'),
    mmSizeImbalanceWeight: parseFloat(process.env.MM_SIZE_IMBALANCE_WEIGHT || '0.3'),
    mmSizeMinFactor: parseFloat(process.env.MM_SIZE_MIN_FACTOR || '0.3'),
    mmSizeMaxFactor: parseFloat(process.env.MM_SIZE_MAX_FACTOR || '1.4'),
    mmSoftCancelBps: parseFloat(process.env.MM_SOFT_CANCEL_BPS || '0.0012'),
    mmHardCancelBps: parseFloat(process.env.MM_HARD_CANCEL_BPS || '0.0025'),
    mmSoftCancelCooldownMs: parseInt(process.env.MM_SOFT_CANCEL_COOLDOWN_MS || '2000'),
    mmHardCancelCooldownMs: parseInt(process.env.MM_HARD_CANCEL_COOLDOWN_MS || '4500'),
    mmHoldNearTouchMs: parseInt(process.env.MM_HOLD_NEAR_TOUCH_MS || '800'),
    mmHoldNearTouchMaxBps: parseFloat(process.env.MM_HOLD_NEAR_TOUCH_MAX_BPS || '0.0010'),
    mmRepriceBufferBps: parseFloat(process.env.MM_REPRICE_BUFFER_BPS || '0.0015'),
    mmRepriceConfirmMs: parseInt(process.env.MM_REPRICE_CONFIRM_MS || '900'),
    mmCancelBufferBps: parseFloat(process.env.MM_CANCEL_BUFFER_BPS || '0.004'),
    mmCancelConfirmMs: parseInt(process.env.MM_CANCEL_CONFIRM_MS || '1200'),
    mmPartialFillShares: parseFloat(process.env.MM_PARTIAL_FILL_SHARES || '5'),
    mmPartialFillPenalty: parseFloat(process.env.MM_PARTIAL_FILL_PENALTY || '0.6'),
    mmPartialFillPenaltyDecayMs: parseInt(process.env.MM_PARTIAL_FILL_PENALTY_DECAY_MS || '60000'),
    mmPartialFillHedge: process.env.MM_PARTIAL_FILL_HEDGE === 'true',
    mmPartialFillHedgeMaxShares: parseFloat(process.env.MM_PARTIAL_FILL_HEDGE_MAX_SHARES || '20'),
    mmPartialFillHedgeSlippageBps: parseInt(process.env.MM_PARTIAL_FILL_HEDGE_SLIPPAGE_BPS || '300'),
    mmCancelRecheckMs: parseInt(process.env.MM_CANCEL_RECHECK_MS || '200'),
    mmRepriceRecheckMs: parseInt(process.env.MM_REPRICE_RECHECK_MS || '200'),
    mmRecheckCooldownMs: parseInt(process.env.MM_RECHECK_COOLDOWN_MS || '1000'),
    mmFillSlowdownWindowMs: parseInt(process.env.MM_FILL_SLOWDOWN_WINDOW_MS || '60000'),
    mmFillSlowdownFactor: parseFloat(process.env.MM_FILL_SLOWDOWN_FACTOR || '0.15'),
    mmFillSlowdownMaxMultiplier: parseFloat(process.env.MM_FILL_SLOWDOWN_MAX_MULTIPLIER || '2'),
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
    crossPlatformMaxShares: parseInt(process.env.CROSS_PLATFORM_MAX_SHARES || '200'),
    crossPlatformDepthLevels: parseInt(process.env.CROSS_PLATFORM_DEPTH_LEVELS || '10'),
    crossPlatformExecutionVwapCheck: process.env.CROSS_PLATFORM_EXECUTION_VWAP_CHECK !== 'false',
    crossPlatformPriceDriftBps: parseInt(process.env.CROSS_PLATFORM_PRICE_DRIFT_BPS || '40'),
    crossPlatformAdaptiveSize: process.env.CROSS_PLATFORM_ADAPTIVE_SIZE !== 'false',
    crossPlatformMinDepthShares: parseFloat(process.env.CROSS_PLATFORM_MIN_DEPTH_SHARES || '1'),
    crossPlatformVolatilityBps: parseFloat(process.env.CROSS_PLATFORM_VOLATILITY_BPS || '80'),
    crossPlatformVolatilityLookbackMs: parseInt(process.env.CROSS_PLATFORM_VOLATILITY_LOOKBACK_MS || '2000'),
    crossPlatformTokenMaxFailures: parseInt(process.env.CROSS_PLATFORM_TOKEN_MAX_FAILURES || '2'),
    crossPlatformTokenFailureWindowMs: parseInt(process.env.CROSS_PLATFORM_TOKEN_FAILURE_WINDOW_MS || '30000'),
    crossPlatformTokenCooldownMs: parseInt(process.env.CROSS_PLATFORM_TOKEN_COOLDOWN_MS || '120000'),
    crossPlatformMetricsLogMs: parseInt(process.env.CROSS_PLATFORM_METRICS_LOG_MS || '0'),
    crossPlatformDepthUsage: parseFloat(process.env.CROSS_PLATFORM_DEPTH_USAGE || '0.5'),
    crossPlatformMaxNotional: parseFloat(process.env.CROSS_PLATFORM_MAX_NOTIONAL || '200'),
    crossPlatformRecheckMs: parseInt(process.env.CROSS_PLATFORM_RECHECK_MS || '0'),
    crossPlatformRecheckDeviationBps: parseInt(process.env.CROSS_PLATFORM_RECHECK_DEVIATION_BPS || '0'),
    crossPlatformRecheckDriftBps: parseInt(process.env.CROSS_PLATFORM_RECHECK_DRIFT_BPS || '0'),
    crossPlatformStabilitySamples: parseInt(process.env.CROSS_PLATFORM_STABILITY_SAMPLES || '1'),
    crossPlatformStabilityIntervalMs: parseInt(process.env.CROSS_PLATFORM_STABILITY_INTERVAL_MS || '0'),
    crossPlatformStabilityBps: parseInt(process.env.CROSS_PLATFORM_STABILITY_BPS || '0'),
    crossPlatformPostTradeDriftBps: parseInt(process.env.CROSS_PLATFORM_POST_TRADE_DRIFT_BPS || '0'),
    crossPlatformAutoTune: process.env.CROSS_PLATFORM_AUTO_TUNE !== 'false',
    crossPlatformAutoTuneMinFactor: parseFloat(process.env.CROSS_PLATFORM_AUTO_TUNE_MIN_FACTOR || '0.5'),
    crossPlatformAutoTuneMaxFactor: parseFloat(process.env.CROSS_PLATFORM_AUTO_TUNE_MAX_FACTOR || '1.2'),
    crossPlatformAutoTuneUp: parseFloat(process.env.CROSS_PLATFORM_AUTO_TUNE_UP || '0.03'),
    crossPlatformAutoTuneDown: parseFloat(process.env.CROSS_PLATFORM_AUTO_TUNE_DOWN || '0.08'),
    crossPlatformTokenMinScore: parseInt(process.env.CROSS_PLATFORM_TOKEN_MIN_SCORE || '40'),
    crossPlatformTokenScoreOnSuccess: parseInt(process.env.CROSS_PLATFORM_TOKEN_SCORE_ON_SUCCESS || '2'),
    crossPlatformTokenScoreOnFailure: parseInt(process.env.CROSS_PLATFORM_TOKEN_SCORE_ON_FAILURE || '5'),
    crossPlatformTokenScoreOnVolatility: parseInt(process.env.CROSS_PLATFORM_TOKEN_SCORE_ON_VOLATILITY || '10'),
    crossPlatformTokenScoreOnPostTrade: parseInt(process.env.CROSS_PLATFORM_TOKEN_SCORE_ON_POST_TRADE || '15'),
    crossPlatformPlatformMinScore: parseInt(process.env.CROSS_PLATFORM_PLATFORM_MIN_SCORE || '40'),
    crossPlatformPlatformScoreOnSuccess: parseInt(process.env.CROSS_PLATFORM_PLATFORM_SCORE_ON_SUCCESS || '1'),
    crossPlatformPlatformScoreOnFailure: parseInt(process.env.CROSS_PLATFORM_PLATFORM_SCORE_ON_FAILURE || '3'),
    crossPlatformPlatformScoreOnVolatility: parseInt(process.env.CROSS_PLATFORM_PLATFORM_SCORE_ON_VOLATILITY || '6'),
    crossPlatformPlatformScoreOnPostTrade: parseInt(process.env.CROSS_PLATFORM_PLATFORM_SCORE_ON_POST_TRADE || '8'),
    crossPlatformPlatformScoreOnSpread: parseInt(process.env.CROSS_PLATFORM_PLATFORM_SCORE_ON_SPREAD || '6'),
    crossPlatformLegDriftSpreadBps: parseInt(process.env.CROSS_PLATFORM_LEG_DRIFT_SPREAD_BPS || '0'),
    crossPlatformAllowlistTokens: parseList(process.env.CROSS_PLATFORM_ALLOWLIST_TOKENS),
    crossPlatformBlocklistTokens: parseList(process.env.CROSS_PLATFORM_BLOCKLIST_TOKENS),
    crossPlatformAllowlistPlatforms: parseList(process.env.CROSS_PLATFORM_ALLOWLIST_PLATFORMS),
    crossPlatformBlocklistPlatforms: parseList(process.env.CROSS_PLATFORM_BLOCKLIST_PLATFORMS),
    crossPlatformChunkMaxShares: parseFloat(process.env.CROSS_PLATFORM_CHUNK_MAX_SHARES || '0'),
    crossPlatformChunkMaxNotional: parseFloat(process.env.CROSS_PLATFORM_CHUNK_MAX_NOTIONAL || '0'),
    crossPlatformChunkDelayMs: parseInt(process.env.CROSS_PLATFORM_CHUNK_DELAY_MS || '0'),
    crossPlatformChunkAutoTune: process.env.CROSS_PLATFORM_CHUNK_AUTO_TUNE !== 'false',
    crossPlatformChunkFactorMin: parseFloat(process.env.CROSS_PLATFORM_CHUNK_FACTOR_MIN || '0.5'),
    crossPlatformChunkFactorMax: parseFloat(process.env.CROSS_PLATFORM_CHUNK_FACTOR_MAX || '1.5'),
    crossPlatformChunkFactorUp: parseFloat(process.env.CROSS_PLATFORM_CHUNK_FACTOR_UP || '0.1'),
    crossPlatformChunkFactorDown: parseFloat(process.env.CROSS_PLATFORM_CHUNK_FACTOR_DOWN || '0.2'),
    crossPlatformChunkDelayAutoTune: process.env.CROSS_PLATFORM_CHUNK_DELAY_AUTO_TUNE === 'true',
    crossPlatformChunkDelayMinMs: parseInt(process.env.CROSS_PLATFORM_CHUNK_DELAY_MIN_MS || '0'),
    crossPlatformChunkDelayMaxMs: parseInt(process.env.CROSS_PLATFORM_CHUNK_DELAY_MAX_MS || '2000'),
    crossPlatformChunkDelayUpMs: parseInt(process.env.CROSS_PLATFORM_CHUNK_DELAY_UP_MS || '100'),
    crossPlatformChunkDelayDownMs: parseInt(process.env.CROSS_PLATFORM_CHUNK_DELAY_DOWN_MS || '100'),
    crossPlatformPlatformMaxFailures: parseInt(process.env.CROSS_PLATFORM_PLATFORM_MAX_FAILURES || '3'),
    crossPlatformPlatformFailureWindowMs: parseInt(process.env.CROSS_PLATFORM_PLATFORM_FAILURE_WINDOW_MS || '60000'),
    crossPlatformPlatformCooldownMs: parseInt(process.env.CROSS_PLATFORM_PLATFORM_COOLDOWN_MS || '120000'),
    crossPlatformAutoBlocklist: process.env.CROSS_PLATFORM_AUTO_BLOCKLIST === 'true',
    crossPlatformAutoBlocklistCooldownMs: parseInt(process.env.CROSS_PLATFORM_AUTO_BLOCKLIST_COOLDOWN_MS || '300000'),
    crossPlatformAutoBlocklistScore: parseInt(process.env.CROSS_PLATFORM_AUTO_BLOCKLIST_SCORE || '30'),
    crossPlatformGlobalCooldownMs: parseInt(process.env.CROSS_PLATFORM_GLOBAL_COOLDOWN_MS || '0'),
    crossPlatformGlobalMinQuality: parseFloat(process.env.CROSS_PLATFORM_GLOBAL_MIN_QUALITY || '0'),
    crossPlatformStatePath: process.env.CROSS_PLATFORM_STATE_PATH || 'data/cross-platform-state.json',
    crossPlatformMetricsPath: process.env.CROSS_PLATFORM_METRICS_PATH || 'data/cross-platform-metrics.json',
    crossPlatformMetricsFlushMs: parseInt(process.env.CROSS_PLATFORM_METRICS_FLUSH_MS || '30000'),
    crossPlatformOrderType: (crossPlatformOrderTypeRaw || undefined) as Config['crossPlatformOrderType'],
    crossPlatformBatchOrders: process.env.CROSS_PLATFORM_BATCH_ORDERS === 'true',
    crossPlatformBatchMax: parseInt(process.env.CROSS_PLATFORM_BATCH_MAX || '15'),
    crossPlatformUseFok: process.env.CROSS_PLATFORM_USE_FOK !== 'false',
    crossPlatformParallelSubmit: process.env.CROSS_PLATFORM_PARALLEL_SUBMIT !== 'false',
    crossPlatformLimitOrders: process.env.CROSS_PLATFORM_LIMIT_ORDERS !== 'false',
    crossPlatformCancelOpenMs: parseInt(process.env.CROSS_PLATFORM_CANCEL_OPEN_MS || '1500'),
    crossPlatformPostFillCheck: process.env.CROSS_PLATFORM_POST_FILL_CHECK !== 'false',
    crossPlatformFillCheckMs: parseInt(process.env.CROSS_PLATFORM_FILL_CHECK_MS || '1500'),
    crossPlatformHedgeOnFailure: process.env.CROSS_PLATFORM_HEDGE_ON_FAILURE === 'true',
    crossPlatformHedgePredictOnly: process.env.CROSS_PLATFORM_HEDGE_PREDICT_ONLY !== 'false',
    crossPlatformHedgeSlippageBps: parseInt(process.env.CROSS_PLATFORM_HEDGE_SLIPPAGE_BPS || '400'),
    crossPlatformMaxRetries: parseInt(process.env.CROSS_PLATFORM_MAX_RETRIES || '1'),
    crossPlatformRetryDelayMs: parseInt(process.env.CROSS_PLATFORM_RETRY_DELAY_MS || '300'),
    crossPlatformCircuitMaxFailures: parseInt(process.env.CROSS_PLATFORM_CIRCUIT_MAX_FAILURES || '3'),
    crossPlatformCircuitWindowMs: parseInt(process.env.CROSS_PLATFORM_CIRCUIT_WINDOW_MS || '60000'),
    crossPlatformCircuitCooldownMs: parseInt(process.env.CROSS_PLATFORM_CIRCUIT_COOLDOWN_MS || '60000'),
    crossPlatformRetrySizeFactor: parseFloat(process.env.CROSS_PLATFORM_RETRY_SIZE_FACTOR || '0.6'),
    crossPlatformRetryAggressiveBps: parseInt(process.env.CROSS_PLATFORM_RETRY_AGGRESSIVE_BPS || '0'),
    autoConfirmAll: process.env.AUTO_CONFIRM === 'true',
    crossPlatformRequireWs: process.env.CROSS_PLATFORM_REQUIRE_WS === 'true',
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
    arbRequireWs: process.env.ARB_REQUIRE_WS === 'true',
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
    polymarketWsStaleMs: parseInt(process.env.POLYMARKET_WS_STALE_MS || '20000'),
    polymarketWsResetOnReconnect: process.env.POLYMARKET_WS_RESET_ON_RECONNECT !== 'false',
    polymarketCacheTtlMs: parseInt(process.env.POLYMARKET_CACHE_TTL_MS || '60000'),
    predictWsEnabled: process.env.PREDICT_WS_ENABLED === 'true',
    predictWsUrl: process.env.PREDICT_WS_URL || 'wss://ws.predict.fun/ws',
    predictWsApiKey: process.env.PREDICT_WS_API_KEY || process.env.API_KEY,
    predictWsTopicKey: (process.env.PREDICT_WS_TOPIC_KEY || 'token_id') as Config['predictWsTopicKey'],
    predictWsStaleMs: parseInt(process.env.PREDICT_WS_STALE_MS || '20000'),
    predictWsResetOnReconnect: process.env.PREDICT_WS_RESET_ON_RECONNECT !== 'false',
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
    opinionWsStaleMs: parseInt(process.env.OPINION_WS_STALE_MS || '20000'),
    opinionWsResetOnReconnect: process.env.OPINION_WS_RESET_ON_RECONNECT !== 'false',
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

  if (
    config.crossPlatformOrderType &&
    !['FOK', 'FAK', 'GTC', 'GTD'].includes(config.crossPlatformOrderType)
  ) {
    throw new Error('CROSS_PLATFORM_ORDER_TYPE must be one of FOK/FAK/GTC/GTD');
  }

  if ((config.crossPlatformBatchMax ?? 1) < 1) {
    config.crossPlatformBatchMax = 1;
  }

  if ((config.crossPlatformVolatilityBps ?? 0) < 0) {
    config.crossPlatformVolatilityBps = 0;
  }

  if ((config.crossPlatformVolatilityLookbackMs ?? 0) < 0) {
    config.crossPlatformVolatilityLookbackMs = 0;
  }

  if ((config.crossPlatformTokenMaxFailures ?? 1) < 1) {
    config.crossPlatformTokenMaxFailures = 1;
  }

  if ((config.crossPlatformTokenFailureWindowMs ?? 0) < 0) {
    config.crossPlatformTokenFailureWindowMs = 0;
  }

  if ((config.crossPlatformTokenCooldownMs ?? 0) < 0) {
    config.crossPlatformTokenCooldownMs = 0;
  }

  if ((config.crossPlatformMinDepthShares ?? 0) < 0) {
    config.crossPlatformMinDepthShares = 0;
  }

  if ((config.crossPlatformMetricsLogMs ?? 0) < 0) {
    config.crossPlatformMetricsLogMs = 0;
  }

  if ((config.mmDepthEmaAlpha ?? 0) <= 0 || (config.mmDepthEmaAlpha ?? 0) >= 1) {
    config.mmDepthEmaAlpha = 0.2;
  }

  if ((config.mmAsymSpreadMinFactor ?? 0) <= 0) {
    config.mmAsymSpreadMinFactor = 0.6;
  }

  if ((config.mmAsymSpreadMaxFactor ?? 0) < (config.mmAsymSpreadMinFactor ?? 0.6)) {
    config.mmAsymSpreadMaxFactor = config.mmAsymSpreadMinFactor ?? 0.6;
  }

  if ((config.mmIntervalProfileVolatileMultiplier ?? 0) <= 0) {
    config.mmIntervalProfileVolatileMultiplier = 1.2;
  }

  if ((config.mmIntervalProfileCalmMultiplier ?? 0) <= 0) {
    config.mmIntervalProfileCalmMultiplier = 0.9;
  }

  if ((config.mmDepthMinShares ?? 0) < 0) {
    config.mmDepthMinShares = 0;
  }

  if ((config.mmDepthTargetShares ?? 0) < 0) {
    config.mmDepthTargetShares = 0;
  }

  if ((config.mmDepthShareFactor ?? 0) < 0) {
    config.mmDepthShareFactor = 0;
  }

  if ((config.mmMaxSharesPerOrder ?? 0) < 0) {
    config.mmMaxSharesPerOrder = 0;
  }

  if ((config.mmSizeMinFactor ?? 0) <= 0) {
    config.mmSizeMinFactor = 0.3;
  }

  if ((config.mmSizeMaxFactor ?? 0) < (config.mmSizeMinFactor ?? 0.3)) {
    config.mmSizeMaxFactor = config.mmSizeMinFactor ?? 0.3;
  }

  if ((config.mmPartialFillPenalty ?? 0) <= 0 || (config.mmPartialFillPenalty ?? 0) > 1) {
    config.mmPartialFillPenalty = 0.6;
  }

  if ((config.mmPartialFillPenaltyDecayMs ?? 0) < 0) {
    config.mmPartialFillPenaltyDecayMs = 0;
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
  console.log(
    `MM Depth: levels=${config.mmDepthLevels} min=${config.mmDepthMinShares} target=${config.mmDepthTargetShares}`
  );
  console.log(
    `MM Asym Weights: inv=${config.mmAsymSpreadInventoryWeight} imb=${config.mmAsymSpreadImbalanceWeight}`
  );
  console.log(
    `MM Size Weights: inv=${config.mmSizeInventoryWeight} imb=${config.mmSizeImbalanceWeight} clamp=${config.mmSizeMinFactor}-${config.mmSizeMaxFactor}`
  );
  console.log(
    `MM Cancel Bands: soft=${(config.mmSoftCancelBps ?? 0) * 100}% hard=${(config.mmHardCancelBps ?? 0) * 100}%`
  );
  console.log(
    `MM Cancel Confirm: reprice=${config.mmRepriceConfirmMs}ms cancel=${config.mmCancelConfirmMs}ms`
  );
  console.log(
    `MM Recheck: cancel=${config.mmCancelRecheckMs}ms reprice=${config.mmRepriceRecheckMs}ms cooldown=${config.mmRecheckCooldownMs}ms`
  );
  console.log(`Anti Fill Bps: ${(config.antiFillBps ?? 0) * 100}%`);
  console.log(`Near Touch Bps: ${(config.nearTouchBps ?? 0) * 100}%`);
  console.log(`Hedge On Fill: ${config.hedgeOnFill ? '✅' : '❌'}`);
  console.log(`Hedge Mode: ${config.hedgeMode}`);
  console.log(`Cross-Platform Enabled: ${config.crossPlatformEnabled ? '✅' : '❌'}`);
  console.log(`Cross-Platform Mapping: ${config.crossPlatformUseMapping ? '✅' : '❌'}`);
  console.log(`Cross-Platform Max Shares: ${config.crossPlatformMaxShares}`);
  console.log(`Cross-Platform Depth Levels: ${config.crossPlatformDepthLevels}`);
  console.log(`Cross-Platform Slippage Bps: ${config.crossPlatformSlippageBps}`);
  console.log(`Cross-Platform Limit Orders: ${config.crossPlatformLimitOrders ? '✅' : '❌'}`);
  console.log(`Cross-Platform Use FOK: ${config.crossPlatformUseFok ? '✅' : '❌'}`);
  console.log(`Cross-Platform Parallel Submit: ${config.crossPlatformParallelSubmit ? '✅' : '❌'}`);
  console.log(`Cross-Platform Cancel Open Ms: ${config.crossPlatformCancelOpenMs}`);
  console.log(`Cross-Platform Hedge On Failure: ${config.crossPlatformHedgeOnFailure ? '✅' : '❌'}`);
  console.log(`Cross-Platform Hedge Predict Only: ${config.crossPlatformHedgePredictOnly ? '✅' : '❌'}`);
  console.log(`Cross-Platform Hedge Slippage Bps: ${config.crossPlatformHedgeSlippageBps}`);
  console.log(`Cross-Platform Max Retries: ${config.crossPlatformMaxRetries}`);
  console.log(`Cross-Platform Retry Delay Ms: ${config.crossPlatformRetryDelayMs}`);
  console.log(`Cross-Platform Circuit Max Failures: ${config.crossPlatformCircuitMaxFailures}`);
  console.log(`Cross-Platform Circuit Window Ms: ${config.crossPlatformCircuitWindowMs}`);
  console.log(`Cross-Platform Circuit Cooldown Ms: ${config.crossPlatformCircuitCooldownMs}`);
  console.log(`Cross-Platform Retry Size Factor: ${config.crossPlatformRetrySizeFactor}`);
  console.log(`Cross-Platform Retry Aggressive Bps: ${config.crossPlatformRetryAggressiveBps}`);
  console.log(`Auto Confirm: ${config.autoConfirmAll ? '✅' : '❌'}`);
  console.log(`Alerts: ${config.alertWebhookUrl ? '✅' : '❌'}`);
  console.log(`Dependency Arb: ${config.dependencyEnabled ? '✅' : '❌'}`);
  console.log(`Multi-Outcome: ${config.multiOutcomeEnabled ? '✅' : '❌'}`);
  console.log(`Arb Auto Execute: ${config.arbAutoExecute ? '✅' : '❌'}`);
  console.log(`Polymarket WS: ${config.polymarketWsEnabled ? '✅' : '❌'}`);
  console.log(`Predict WS: ${config.predictWsEnabled ? '✅' : '❌'}`);
  console.log(`Opinion WS: ${config.opinionWsEnabled ? '✅' : '❌'}`);
  console.log(`Arb Require WS: ${config.arbRequireWs ? '✅' : '❌'}`);
  console.log(`Cross Require WS: ${config.crossPlatformRequireWs ? '✅' : '❌'}`);
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
