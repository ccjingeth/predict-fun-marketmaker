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

const parseNumberList = (value?: string): number[] | undefined => {
  const items = parseList(value);
  if (!items) return undefined;
  const nums = items
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.floor(item));
  return nums.length > 0 ? nums : undefined;
};

const parseOrderTypeList = (value?: string): string[] | undefined => {
  const items = parseList(value);
  if (!items) return undefined;
  const valid = new Set(['FOK', 'FAK', 'GTC', 'GTD']);
  const normalized = items.map((item) => item.toUpperCase()).filter((item) => valid.has(item));
  return normalized.length > 0 ? normalized : undefined;
};

/**
 * Load and validate configuration
 */
export function loadConfig(): Config {
  const crossPlatformOrderTypeRaw = (process.env.CROSS_PLATFORM_ORDER_TYPE || '').toUpperCase();
  const crossPlatformAvoidModeRaw = (process.env.CROSS_PLATFORM_AVOID_HOURS_MODE || 'BLOCK').toUpperCase();
  const crossPlatformAvoidMode =
    crossPlatformAvoidModeRaw === 'TEMPLATE' || crossPlatformAvoidModeRaw === 'BLOCK'
      ? (crossPlatformAvoidModeRaw as Config['crossPlatformAvoidHoursMode'])
      : 'BLOCK';
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
    mmTouchBufferBps: parseFloat(process.env.MM_TOUCH_BUFFER_BPS || '0'),
    mmFillRiskSpreadBps: parseFloat(process.env.MM_FILL_RISK_SPREAD_BPS || '0'),
    mmNearTouchPenaltyBps: parseFloat(process.env.MM_NEAR_TOUCH_PENALTY_BPS || '0'),
    mmNearTouchPenaltyMaxBps: parseFloat(process.env.MM_NEAR_TOUCH_PENALTY_MAX_BPS || '0'),
    mmNearTouchPenaltyDecayMs: parseInt(process.env.MM_NEAR_TOUCH_PENALTY_DECAY_MS || '60000'),
    mmNearTouchSizePenalty: parseFloat(process.env.MM_NEAR_TOUCH_SIZE_PENALTY || '0'),
    mmFillPenaltyBps: parseFloat(process.env.MM_FILL_PENALTY_BPS || '0'),
    mmFillPenaltyMaxBps: parseFloat(process.env.MM_FILL_PENALTY_MAX_BPS || '0'),
    mmFillPenaltyDecayMs: parseInt(process.env.MM_FILL_PENALTY_DECAY_MS || '90000'),
    mmNoFillPassiveMs: parseInt(process.env.MM_NO_FILL_PASSIVE_MS || '0'),
    mmNoFillPenaltyBps: parseFloat(process.env.MM_NO_FILL_PENALTY_BPS || '0'),
    mmNoFillPenaltyMaxBps: parseFloat(process.env.MM_NO_FILL_PENALTY_MAX_BPS || '0'),
    mmNoFillRampMs: parseInt(process.env.MM_NO_FILL_RAMP_MS || '30000'),
    mmNoFillSizePenalty: parseFloat(process.env.MM_NO_FILL_SIZE_PENALTY || '1'),
    mmNoFillTouchBps: parseFloat(process.env.MM_NO_FILL_TOUCH_BPS || '0'),
    mmNoFillTouchMaxBps: parseFloat(process.env.MM_NO_FILL_TOUCH_MAX_BPS || '0'),
    mmNoFillRepriceBps: parseFloat(process.env.MM_NO_FILL_REPRICE_BPS || '0'),
    mmNoFillRepriceMaxBps: parseFloat(process.env.MM_NO_FILL_REPRICE_MAX_BPS || '0'),
    mmNoFillCancelBps: parseFloat(process.env.MM_NO_FILL_CANCEL_BPS || '0'),
    mmNoFillCancelMaxBps: parseFloat(process.env.MM_NO_FILL_CANCEL_MAX_BPS || '0'),
    mmAggressiveMoveBps: parseFloat(process.env.MM_AGGRESSIVE_MOVE_BPS || '0.002'),
    mmAggressiveMoveWindowMs: parseInt(process.env.MM_AGGRESSIVE_MOVE_WINDOW_MS || '1500'),
    mmHitWarningBps: parseFloat(process.env.MM_HIT_WARNING_BPS || '0'),
    mmHitTopSizeMinShares: parseFloat(process.env.MM_HIT_TOP_SIZE_MIN_SHARES || '0'),
    mmHitTopSizeFactor: parseFloat(process.env.MM_HIT_TOP_SIZE_FACTOR || '0'),
    mmHitDepthLevels: parseInt(process.env.MM_HIT_DEPTH_LEVELS || '0'),
    mmHitDepthMinShares: parseFloat(process.env.MM_HIT_DEPTH_MIN_SHARES || '0'),
    mmHitSpeedBps: parseFloat(process.env.MM_HIT_SPEED_BPS || '0'),
    mmHitSpeedWindowMs: parseInt(process.env.MM_HIT_SPEED_WINDOW_MS || '1200'),
    mmHitSizeDropRatio: parseFloat(process.env.MM_HIT_SIZE_DROP_RATIO || '0'),
    mmHitSizeDropWindowMs: parseInt(process.env.MM_HIT_SIZE_DROP_WINDOW_MS || '1200'),
    mmVolatilityHighBps: parseFloat(process.env.MM_VOLATILITY_HIGH_BPS || '0.006'),
    mmVolatilityLowBps: parseFloat(process.env.MM_VOLATILITY_LOW_BPS || '0.002'),
    mmIntervalProfileVolatileMultiplier: parseFloat(process.env.MM_INTERVAL_PROFILE_VOLATILE_MULTIPLIER || '1.3'),
    mmIntervalProfileCalmMultiplier: parseFloat(process.env.MM_INTERVAL_PROFILE_CALM_MULTIPLIER || '0.8'),
    mmSpreadJumpBps: parseFloat(process.env.MM_SPREAD_JUMP_BPS || '0'),
    mmSpreadJumpWindowMs: parseInt(process.env.MM_SPREAD_JUMP_WINDOW_MS || '0'),
    mmMaxSharesPerOrder: parseFloat(process.env.MM_MAX_SHARES_PER_ORDER || '0'),
    mmLayerCount: parseInt(process.env.MM_LAYER_COUNT || '1'),
    mmLayerMinCount: parseInt(process.env.MM_LAYER_MIN_COUNT || '1'),
    mmLayerVolatileCount: parseInt(process.env.MM_LAYER_VOLATILE_COUNT || '0'),
    mmLayerThinCount: parseInt(process.env.MM_LAYER_THIN_COUNT || '0'),
    mmLayerPanicCount: parseInt(process.env.MM_LAYER_PANIC_COUNT || '0'),
    mmLayerPanicHoldMs: parseInt(process.env.MM_LAYER_PANIC_HOLD_MS || '0'),
    mmLayerDepthTrendDrop: parseFloat(process.env.MM_LAYER_DEPTH_TREND_DROP || '0'),
    mmLayerSpreadStepBps: parseFloat(process.env.MM_LAYER_SPREAD_STEP_BPS || '0'),
    mmLayerStepBpsVolatileAdd: parseFloat(process.env.MM_LAYER_STEP_BPS_VOLATILE_ADD || '0'),
    mmLayerStepBpsThinAdd: parseFloat(process.env.MM_LAYER_STEP_BPS_THIN_ADD || '0'),
    mmLayerStepBpsPanicAdd: parseFloat(process.env.MM_LAYER_STEP_BPS_PANIC_ADD || '0'),
    mmLayerDepthSpeedBps: parseFloat(process.env.MM_LAYER_DEPTH_SPEED_BPS || '0'),
    mmLayerSpeedCount: parseInt(process.env.MM_LAYER_SPEED_COUNT || '0'),
    mmLayerStepBpsSpeedAdd: parseFloat(process.env.MM_LAYER_STEP_BPS_SPEED_ADD || '0'),
    mmLayerDepthSpeedRetreatBps: parseFloat(process.env.MM_LAYER_DEPTH_SPEED_RETREAT_BPS || '0'),
    mmLayerRetreatCount: parseInt(process.env.MM_LAYER_RETREAT_COUNT || '0'),
    mmLayerSpeedSizeMinFactor: parseFloat(process.env.MM_LAYER_SPEED_SIZE_MIN_FACTOR || '0'),
    mmLayerRetreatSizeMinFactor: parseFloat(process.env.MM_LAYER_RETREAT_SIZE_MIN_FACTOR || '0'),
    mmLayerPanicSizeMinFactor: parseFloat(process.env.MM_LAYER_PANIC_SIZE_MIN_FACTOR || '0'),
    mmLayerPanicIntervalMult: parseFloat(process.env.MM_LAYER_PANIC_INTERVAL_MULT || '1'),
    mmLayerSizeDecay: parseFloat(process.env.MM_LAYER_SIZE_DECAY || '0.6'),
    mmLayerAllowBelowMinShares: process.env.MM_LAYER_ALLOW_BELOW_MIN_SHARES === 'true',
    mmDepthSpeedWindowMs: parseInt(process.env.MM_DEPTH_SPEED_WINDOW_MS || '0'),
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
    mmAutoSizeOnFill: process.env.MM_AUTO_SIZE_ON_FILL !== 'false',
    mmAutoSizeOnFillDecayMs: parseInt(process.env.MM_AUTO_SIZE_ON_FILL_DECAY_MS || '90000'),
    mmAutoSizeMinFactor: parseFloat(process.env.MM_AUTO_SIZE_MIN_FACTOR || '0.4'),
    mmDynamicCancelOnFill: process.env.MM_DYNAMIC_CANCEL_ON_FILL === 'true',
    mmDynamicCancelBoost: parseFloat(process.env.MM_DYNAMIC_CANCEL_BOOST || '0.4'),
    mmDynamicCancelDecayMs: parseInt(process.env.MM_DYNAMIC_CANCEL_DECAY_MS || '60000'),
    mmDynamicCancelMaxBoost: parseFloat(process.env.MM_DYNAMIC_CANCEL_MAX_BOOST || '2'),
    mmOnlyPointsMarkets: process.env.MM_ONLY_POINTS_MARKETS === 'true',
    mmPointsMinOnly: process.env.MM_POINTS_MIN_ONLY === 'true',
    mmPointsMinMultiplier: parseFloat(process.env.MM_POINTS_MIN_MULTIPLIER || '1'),
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
    crossPlatformMaxVwapLevels: parseInt(process.env.CROSS_PLATFORM_MAX_VWAP_LEVELS || '0'),
    crossPlatformWsRealtime: process.env.CROSS_PLATFORM_WS_REALTIME === 'true',
    crossPlatformWsRealtimeIntervalMs: parseInt(process.env.CROSS_PLATFORM_WS_REALTIME_INTERVAL_MS || '600'),
    crossPlatformWsRealtimeMaxBatch: parseInt(process.env.CROSS_PLATFORM_WS_REALTIME_MAX_BATCH || '30'),
    crossPlatformWsRealtimeQuiet: process.env.CROSS_PLATFORM_WS_REALTIME_QUIET === 'true',
    crossPlatformWsRealtimeFallbackEnabled: process.env.CROSS_PLATFORM_WS_REALTIME_FALLBACK_ENABLED === 'true',
    crossPlatformWsRealtimeFallbackIntervalMs: parseInt(
      process.env.CROSS_PLATFORM_WS_REALTIME_FALLBACK_INTERVAL_MS || '5000'
    ),
    crossPlatformWsRealtimeFallbackMaxMarkets: parseInt(
      process.env.CROSS_PLATFORM_WS_REALTIME_FALLBACK_MAX_MARKETS || '80'
    ),
    crossPlatformWsRealtimeFallbackStaleMs: parseInt(
      process.env.CROSS_PLATFORM_WS_REALTIME_FALLBACK_STALE_MS || '12000'
    ),
    crossPlatformExecutionVwapCheck: process.env.CROSS_PLATFORM_EXECUTION_VWAP_CHECK !== 'false',
    crossPlatformPriceDriftBps: parseInt(process.env.CROSS_PLATFORM_PRICE_DRIFT_BPS || '40'),
    crossPlatformPreSubmitDriftBps: parseInt(process.env.CROSS_PLATFORM_PRE_SUBMIT_DRIFT_BPS || '0'),
    crossPlatformPreSubmitVwapBps: parseInt(process.env.CROSS_PLATFORM_PRE_SUBMIT_VWAP_BPS || '0'),
    crossPlatformPreSubmitProfitBps: parseFloat(process.env.CROSS_PLATFORM_PRE_SUBMIT_PROFIT_BPS || '0'),
    crossPlatformPreSubmitProfitUsd: parseFloat(process.env.CROSS_PLATFORM_PRE_SUBMIT_PROFIT_USD || '0'),
    crossPlatformPreSubmitLegVwapSpreadBps: parseFloat(process.env.CROSS_PLATFORM_PRE_SUBMIT_LEG_VWAP_SPREAD_BPS || '0'),
    crossPlatformPreSubmitTotalCostBps: parseFloat(process.env.CROSS_PLATFORM_PRE_SUBMIT_TOTAL_COST_BPS || '0'),
    crossPlatformPreSubmitLegCostSpreadBps: parseFloat(process.env.CROSS_PLATFORM_PRE_SUBMIT_LEG_COST_SPREAD_BPS || '0'),
    crossPlatformAdaptiveSize: process.env.CROSS_PLATFORM_ADAPTIVE_SIZE !== 'false',
    crossPlatformMinDepthShares: parseFloat(process.env.CROSS_PLATFORM_MIN_DEPTH_SHARES || '1'),
    crossPlatformMinNotionalUsd: parseFloat(process.env.CROSS_PLATFORM_MIN_NOTIONAL_USD || '0'),
    crossPlatformMinProfitUsd: parseFloat(process.env.CROSS_PLATFORM_MIN_PROFIT_USD || '0'),
    crossPlatformMinProfitBps: parseFloat(process.env.CROSS_PLATFORM_MIN_PROFIT_BPS || '0'),
    crossPlatformMinProfitImpactMult: parseFloat(process.env.CROSS_PLATFORM_MIN_PROFIT_IMPACT_MULT || '0'),
    crossPlatformMissingVwapPenaltyBps: parseFloat(process.env.CROSS_PLATFORM_MISSING_VWAP_PENALTY_BPS || '0'),
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
    crossPlatformAbortPostTradeDriftBps: parseInt(process.env.CROSS_PLATFORM_ABORT_POST_TRADE_BPS || '0'),
    crossPlatformAbortCooldownMs: parseInt(process.env.CROSS_PLATFORM_ABORT_COOLDOWN_MS || '0'),
    crossPlatformFailurePauseMs: parseInt(process.env.CROSS_PLATFORM_FAILURE_PAUSE_MS || '0'),
    crossPlatformFailurePauseMaxMs: parseInt(process.env.CROSS_PLATFORM_FAILURE_PAUSE_MAX_MS || '0'),
    crossPlatformFailurePauseBackoff: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PAUSE_BACKOFF || '1.5'),
    crossPlatformReasonPreflightPenalty: parseFloat(process.env.CROSS_PLATFORM_REASON_PREFLIGHT_PENALTY || '0.4'),
    crossPlatformReasonExecutionPenalty: parseFloat(process.env.CROSS_PLATFORM_REASON_EXECUTION_PENALTY || '0.7'),
    crossPlatformReasonPostTradePenalty: parseFloat(process.env.CROSS_PLATFORM_REASON_POSTTRADE_PENALTY || '1.2'),
    crossPlatformReasonHedgePenalty: parseFloat(process.env.CROSS_PLATFORM_REASON_HEDGE_PENALTY || '0.5'),
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
    crossPlatformLegVwapDeviationBps: parseInt(process.env.CROSS_PLATFORM_LEG_VWAP_DEVIATION_BPS || '0'),
    crossPlatformLegMinDepthUsd: parseFloat(process.env.CROSS_PLATFORM_LEG_MIN_DEPTH_USD || '0'),
    crossPlatformLegDeviationSoftBps: parseInt(process.env.CROSS_PLATFORM_LEG_DEVIATION_SOFT_BPS || '0'),
    crossPlatformLegDeviationSpreadBps: parseInt(process.env.CROSS_PLATFORM_LEG_DEVIATION_SPREAD_BPS || '0'),
    crossPlatformLegDepthUsageMax: parseFloat(process.env.CROSS_PLATFORM_LEG_DEPTH_USAGE_MAX || '0'),
    crossPlatformLegDepthRatioMin: parseFloat(process.env.CROSS_PLATFORM_LEG_DEPTH_RATIO_MIN || '0'),
    crossPlatformLegDepthRatioSoft: parseFloat(process.env.CROSS_PLATFORM_LEG_DEPTH_RATIO_SOFT || '0'),
    crossPlatformLegDepthRatioShrinkMinFactor: parseFloat(
      process.env.CROSS_PLATFORM_LEG_DEPTH_RATIO_SHRINK_MIN_FACTOR || '0.3'
    ),
    crossPlatformDepthRatioPenaltyUp: parseFloat(process.env.CROSS_PLATFORM_DEPTH_RATIO_PENALTY_UP || '0.08'),
    crossPlatformDepthRatioPenaltyDown: parseFloat(process.env.CROSS_PLATFORM_DEPTH_RATIO_PENALTY_DOWN || '0.04'),
    crossPlatformDepthRatioPenaltyMax: parseFloat(process.env.CROSS_PLATFORM_DEPTH_RATIO_PENALTY_MAX || '0.5'),
    crossPlatformConsistencySamples: parseInt(process.env.CROSS_PLATFORM_CONSISTENCY_SAMPLES || '0'),
    crossPlatformConsistencyIntervalMs: parseInt(process.env.CROSS_PLATFORM_CONSISTENCY_INTERVAL_MS || '0'),
    crossPlatformConsistencyVwapBps: parseInt(process.env.CROSS_PLATFORM_CONSISTENCY_VWAP_BPS || '0'),
    crossPlatformConsistencyVwapDriftBps: parseInt(process.env.CROSS_PLATFORM_CONSISTENCY_VWAP_DRIFT_BPS || '0'),
    crossPlatformConsistencyDepthRatioMin: parseFloat(process.env.CROSS_PLATFORM_CONSISTENCY_DEPTH_RATIO_MIN || '0'),
    crossPlatformConsistencyDepthRatioDrift: parseFloat(process.env.CROSS_PLATFORM_CONSISTENCY_DEPTH_RATIO_DRIFT || '0'),
    crossPlatformQualityProfitMult: parseFloat(process.env.CROSS_PLATFORM_QUALITY_PROFIT_MULT || '0'),
    crossPlatformQualityProfitMax: parseFloat(process.env.CROSS_PLATFORM_QUALITY_PROFIT_MAX || '0'),
    crossPlatformConsistencyFailLimit: parseInt(process.env.CROSS_PLATFORM_CONSISTENCY_FAIL_LIMIT || '0'),
    crossPlatformConsistencyFailWindowMs: parseInt(process.env.CROSS_PLATFORM_CONSISTENCY_FAIL_WINDOW_MS || '0'),
    crossPlatformConsistencyDegradeMs: parseInt(process.env.CROSS_PLATFORM_CONSISTENCY_DEGRADE_MS || '0'),
    crossPlatformConsistencyPenalty: parseFloat(process.env.CROSS_PLATFORM_CONSISTENCY_PENALTY || '0'),
    crossPlatformConsistencyUseDegradeProfile: process.env.CROSS_PLATFORM_CONSISTENCY_USE_DEGRADE_PROFILE !== 'false',
    crossPlatformConsistencyOrderType: (process.env.CROSS_PLATFORM_CONSISTENCY_ORDER_TYPE || '').toUpperCase() as
      | 'FOK'
      | 'FAK'
      | 'GTC'
      | 'GTD'
      | '',
    crossPlatformConsistencyTemplateEnabled: process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_ENABLED === 'true',
    crossPlatformConsistencyTemplateDepthUsage: parseFloat(process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_DEPTH_USAGE || '0'),
    crossPlatformConsistencyTemplateSlippageBps: parseInt(process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_SLIPPAGE_BPS || '0'),
    crossPlatformConsistencyTemplateMaxVwapLevels: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MAX_VWAP_LEVELS || '0'
    ),
    crossPlatformConsistencyTemplateMinProfitBps: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MIN_PROFIT_BPS || '0'
    ),
    crossPlatformConsistencyTemplateMinProfitUsd: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MIN_PROFIT_USD || '0'
    ),
    crossPlatformConsistencyTemplateMinNotionalUsd: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MIN_NOTIONAL_USD || '0'
    ),
    crossPlatformConsistencyTemplateChunkFactor: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_CHUNK_FACTOR || '0'
    ),
    crossPlatformConsistencyTemplateChunkDelayMs: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_CHUNK_DELAY_MS || '0'
    ),
    crossPlatformConsistencyTemplateForceSequential:
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_FORCE_SEQUENTIAL === 'true',
    crossPlatformConsistencyTemplateUseFok: process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_USE_FOK === 'true',
    crossPlatformConsistencyTemplateLimitOrders: process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_LIMIT_ORDERS === 'true',
    crossPlatformConsistencyTemplateDisableBatch:
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_DISABLE_BATCH === 'true',
    crossPlatformConsistencyTemplateTightenUp: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_TIGHTEN_UP || '0.15'
    ),
    crossPlatformConsistencyTemplateTightenDown: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_TIGHTEN_DOWN || '0.08'
    ),
    crossPlatformConsistencyTemplateTightenMax: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_TIGHTEN_MAX || '2.5'
    ),
    crossPlatformConsistencyTemplateTightenMin: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_TEMPLATE_TIGHTEN_MIN || '0.5'
    ),
    crossPlatformConsistencyRateLimitMs: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_RATE_LIMIT_MS || '0'
    ),
    crossPlatformConsistencyRateLimitThreshold: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_RATE_LIMIT_THRESHOLD || '0'
    ),
    crossPlatformConsistencyRateLimitWindowMs: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_RATE_LIMIT_WINDOW_MS || '0'
    ),
    crossPlatformAvoidHours: parseNumberList(process.env.CROSS_PLATFORM_AVOID_HOURS),
    crossPlatformAvoidHoursAuto: process.env.CROSS_PLATFORM_AVOID_HOURS_AUTO === 'true',
    crossPlatformAvoidHoursDecayDays: parseFloat(process.env.CROSS_PLATFORM_AVOID_HOURS_DECAY_DAYS || '3'),
    crossPlatformAvoidHoursMode: crossPlatformAvoidMode,
    crossPlatformAvoidHoursModeAuto: process.env.CROSS_PLATFORM_AVOID_HOURS_MODE_AUTO === 'true',
    crossPlatformAvoidHoursBlockScore: parseFloat(process.env.CROSS_PLATFORM_AVOID_HOURS_BLOCK_SCORE || '3'),
    crossPlatformAvoidHoursTemplateScore: parseFloat(process.env.CROSS_PLATFORM_AVOID_HOURS_TEMPLATE_SCORE || '1.5'),
    crossPlatformAvoidHoursTemplateFactor: parseFloat(
      process.env.CROSS_PLATFORM_AVOID_HOURS_TEMPLATE_FACTOR || '1.2'
    ),
    crossPlatformWsHealthTightenMax: parseFloat(
      process.env.CROSS_PLATFORM_WS_HEALTH_TIGHTEN_MAX || '1.5'
    ),
    crossPlatformWsHealthChunkDelayMaxMs: parseInt(
      process.env.CROSS_PLATFORM_WS_HEALTH_CHUNK_DELAY_MAX_MS || '600'
    ),
    crossPlatformWsHealthChunkFactorMin: parseFloat(
      process.env.CROSS_PLATFORM_WS_HEALTH_CHUNK_FACTOR_MIN || '0.7'
    ),
    crossPlatformConsistencyCooldownMs: parseInt(process.env.CROSS_PLATFORM_CONSISTENCY_COOLDOWN_MS || '0'),
    crossPlatformConsistencyCooldownThreshold: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_COOLDOWN_THRESHOLD || '0'
    ),
    crossPlatformConsistencyCooldownWindowMs: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_COOLDOWN_WINDOW_MS || '0'
    ),
    crossPlatformConsistencyPressureUp: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_UP || '0.25'
    ),
    crossPlatformConsistencyPressureDown: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_DOWN || '0.15'
    ),
    crossPlatformConsistencyPressureDecayMs: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_DECAY_MS || '90000'
    ),
    crossPlatformConsistencyPressureTightenMax: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_TIGHTEN_MAX || '1.8'
    ),
    crossPlatformConsistencyPressureRetryDelayMs: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_RETRY_DELAY_MS || '500'
    ),
    crossPlatformConsistencyPressureCooldownMaxMs: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_COOLDOWN_MAX_MS || '2000'
    ),
    crossPlatformConsistencyPressureSizeMin: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_SIZE_MIN || '0.5'
    ),
    crossPlatformConsistencyPressureDegradeThreshold: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_DEGRADE_THRESHOLD || '0.7'
    ),
    crossPlatformConsistencyPressureDegradeMs: parseInt(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_DEGRADE_MS || '15000'
    ),
    crossPlatformConsistencyPressureUseDegradeProfile:
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_USE_DEGRADE_PROFILE !== 'false',
    crossPlatformConsistencyPressureHardThreshold: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_HARD_THRESHOLD || '0.85'
    ),
    crossPlatformConsistencyPressureHardFactor: parseFloat(
      process.env.CROSS_PLATFORM_CONSISTENCY_PRESSURE_HARD_FACTOR || '0.35'
    ),
    crossPlatformWsHealthHardThreshold: parseFloat(
      process.env.CROSS_PLATFORM_WS_HEALTH_HARD_THRESHOLD || '45'
    ),
    crossPlatformWsHealthHardFactor: parseFloat(
      process.env.CROSS_PLATFORM_WS_HEALTH_HARD_FACTOR || '0.5'
    ),
    crossPlatformHardGateDegradeMs: parseInt(process.env.CROSS_PLATFORM_HARD_GATE_DEGRADE_MS || '20000'),
    crossPlatformHardGateUseDegradeProfile:
      process.env.CROSS_PLATFORM_HARD_GATE_USE_DEGRADE_PROFILE !== 'false',
    crossPlatformHardGateRateLimitMs: parseInt(process.env.CROSS_PLATFORM_HARD_GATE_RATE_LIMIT_MS || '4000'),
    crossPlatformHardGateAutoApplyFix: process.env.CROSS_PLATFORM_HARD_GATE_AUTO_APPLY_FIX === 'true',
    crossPlatformHardGateAutoUltra: process.env.CROSS_PLATFORM_HARD_GATE_AUTO_ULTRA === 'true',
    crossPlatformAllowlistTokens: parseList(process.env.CROSS_PLATFORM_ALLOWLIST_TOKENS),
    crossPlatformBlocklistTokens: parseList(process.env.CROSS_PLATFORM_BLOCKLIST_TOKENS),
    crossPlatformAllowlistPlatforms: parseList(process.env.CROSS_PLATFORM_ALLOWLIST_PLATFORMS),
    crossPlatformBlocklistPlatforms: parseList(process.env.CROSS_PLATFORM_BLOCKLIST_PLATFORMS),
    crossPlatformChunkMaxShares: parseFloat(process.env.CROSS_PLATFORM_CHUNK_MAX_SHARES || '0'),
    crossPlatformChunkMaxNotional: parseFloat(process.env.CROSS_PLATFORM_CHUNK_MAX_NOTIONAL || '0'),
    crossPlatformChunkDelayMs: parseInt(process.env.CROSS_PLATFORM_CHUNK_DELAY_MS || '0'),
    crossPlatformChunkPreflight: process.env.CROSS_PLATFORM_CHUNK_PREFLIGHT !== 'false',
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
    crossPlatformOrderTypeFallback: parseOrderTypeList(process.env.CROSS_PLATFORM_ORDER_TYPE_FALLBACK),
    crossPlatformFallbackMode: (process.env.CROSS_PLATFORM_FALLBACK_MODE || 'AUTO').toUpperCase() as
      | 'AUTO'
      | 'SEQUENTIAL'
      | 'SINGLE_LEG',
    crossPlatformBatchOrders: process.env.CROSS_PLATFORM_BATCH_ORDERS === 'true',
    crossPlatformBatchMax: parseInt(process.env.CROSS_PLATFORM_BATCH_MAX || '15'),
    crossPlatformUseFok: process.env.CROSS_PLATFORM_USE_FOK !== 'false',
    crossPlatformParallelSubmit: process.env.CROSS_PLATFORM_PARALLEL_SUBMIT !== 'false',
    crossPlatformAutoSequentialDriftBps: parseFloat(process.env.CROSS_PLATFORM_AUTO_SEQUENTIAL_DRIFT_BPS || '0'),
    crossPlatformAutoSequentialVwapBps: parseFloat(process.env.CROSS_PLATFORM_AUTO_SEQUENTIAL_VWAP_BPS || '0'),
    crossPlatformAutoFokDriftBps: parseFloat(process.env.CROSS_PLATFORM_AUTO_FOK_DRIFT_BPS || '0'),
    crossPlatformAutoFokVwapBps: parseFloat(process.env.CROSS_PLATFORM_AUTO_FOK_VWAP_BPS || '0'),
    crossPlatformAutoSingleLegDriftBps: parseFloat(process.env.CROSS_PLATFORM_AUTO_SINGLE_LEG_DRIFT_BPS || '0'),
    crossPlatformAutoSingleLegVwapBps: parseFloat(process.env.CROSS_PLATFORM_AUTO_SINGLE_LEG_VWAP_BPS || '0'),
    crossPlatformAutoFallbackOnFailure: process.env.CROSS_PLATFORM_AUTO_FALLBACK_ON_FAILURE === 'true',
    crossPlatformAutoFallbackSteps: process.env.CROSS_PLATFORM_AUTO_FALLBACK_STEPS
      ? process.env.CROSS_PLATFORM_AUTO_FALLBACK_STEPS.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    crossPlatformFailureSizeFactorDown: parseFloat(process.env.CROSS_PLATFORM_FAILURE_SIZE_FACTOR_DOWN || '0.85'),
    crossPlatformFailureSizeFactorUp: parseFloat(process.env.CROSS_PLATFORM_FAILURE_SIZE_FACTOR_UP || '0.05'),
    crossPlatformFailureSizeFactorMin: parseFloat(process.env.CROSS_PLATFORM_FAILURE_SIZE_FACTOR_MIN || '0.2'),
    crossPlatformFailureSizeFactorMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_SIZE_FACTOR_MAX || '1'),
    crossPlatformFailureProfitMultDown: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PROFIT_MULT_DOWN || '1.1'),
    crossPlatformFailureProfitMultUp: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PROFIT_MULT_UP || '0.05'),
    crossPlatformFailureProfitMultMin: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PROFIT_MULT_MIN || '1'),
    crossPlatformFailureProfitMultMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PROFIT_MULT_MAX || '3'),
    crossPlatformFailureAutoSafeOnLosses: parseInt(process.env.CROSS_PLATFORM_FAILURE_AUTO_SAFE_ON_LOSSES || '0'),
    crossPlatformFailureCooldownBumpMs: parseInt(process.env.CROSS_PLATFORM_FAILURE_COOLDOWN_BUMP_MS || '0'),
    crossPlatformFailureCooldownBumpMaxMs: parseInt(process.env.CROSS_PLATFORM_FAILURE_COOLDOWN_BUMP_MAX_MS || '60000'),
    crossPlatformFailureCooldownRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_COOLDOWN_RECOVER || '0.7'),
    crossPlatformFailureDepthUsdBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_DEPTH_USD_BUMP || '0'),
    crossPlatformFailureDepthUsdBumpMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_DEPTH_USD_BUMP_MAX || '0'),
    crossPlatformFailureDepthUsdRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_DEPTH_USD_RECOVER || '0.7'),
    crossPlatformFailureForceSequentialMs: parseInt(process.env.CROSS_PLATFORM_FAILURE_FORCE_SEQUENTIAL_MS || '0'),
    crossPlatformFailureVwapTightenBps: parseFloat(process.env.CROSS_PLATFORM_FAILURE_VWAP_TIGHTEN_BPS || '0'),
    crossPlatformFailureMinProfitUsdBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_PROFIT_USD_BUMP || '0'),
    crossPlatformFailureMinProfitUsdBumpMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_PROFIT_USD_BUMP_MAX || '0'),
    crossPlatformFailureMinProfitUsdRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_PROFIT_USD_RECOVER || '0.7'),
    crossPlatformFailureMinProfitBpsBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_PROFIT_BPS_BUMP || '0'),
    crossPlatformFailureMinProfitBpsBumpMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_PROFIT_BPS_BUMP_MAX || '0'),
    crossPlatformFailureMinProfitBpsRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_PROFIT_BPS_RECOVER || '0.7'),
    crossPlatformFailureSlippageTightenBps: parseFloat(process.env.CROSS_PLATFORM_FAILURE_SLIPPAGE_TIGHTEN_BPS || '0'),
    crossPlatformFailureNotionalUsdBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_NOTIONAL_USD_BUMP || '0'),
    crossPlatformFailureNotionalUsdBumpMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_NOTIONAL_USD_BUMP_MAX || '0'),
    crossPlatformFailureNotionalUsdRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_NOTIONAL_USD_RECOVER || '0.7'),
    crossPlatformFailureDriftTightenBps: parseFloat(process.env.CROSS_PLATFORM_FAILURE_DRIFT_TIGHTEN_BPS || '0'),
    crossPlatformFailureDepthUsageFactor: parseFloat(process.env.CROSS_PLATFORM_FAILURE_DEPTH_USAGE_FACTOR || '1'),
    crossPlatformFailureForceFokMs: parseInt(process.env.CROSS_PLATFORM_FAILURE_FORCE_FOK_MS || '0'),
    crossPlatformFailureMinDepthSharesBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_DEPTH_SHARES_BUMP || '0'),
    crossPlatformFailureMinDepthSharesMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_DEPTH_SHARES_MAX || '0'),
    crossPlatformFailureMinDepthSharesRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_DEPTH_SHARES_RECOVER || '0.7'),
    crossPlatformFailureTotalCostBpsBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_TOTAL_COST_BPS_BUMP || '0'),
    crossPlatformFailureTotalCostBpsBumpMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_TOTAL_COST_BPS_BUMP_MAX || '0'),
    crossPlatformFailureTotalCostBpsRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_TOTAL_COST_BPS_RECOVER || '0.7'),
    crossPlatformFailurePreSubmitVwapTightenBps: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PRE_SUBMIT_VWAP_TIGHTEN_BPS || '0'),
    crossPlatformFailurePreSubmitLegSpreadTightenBps: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PRE_SUBMIT_LEG_SPREAD_TIGHTEN_BPS || '0'),
    crossPlatformFailurePreSubmitLegCostSpreadTightenBps: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PRE_SUBMIT_LEG_COST_SPREAD_TIGHTEN_BPS || '0'),
    crossPlatformFailurePreSubmitProfitBpsBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PRE_SUBMIT_PROFIT_BPS_BUMP || '0'),
    crossPlatformFailurePreSubmitProfitUsdBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PRE_SUBMIT_PROFIT_USD_BUMP || '0'),
    crossPlatformLimitOrders: process.env.CROSS_PLATFORM_LIMIT_ORDERS !== 'false',
    crossPlatformCancelOpenMs: parseInt(process.env.CROSS_PLATFORM_CANCEL_OPEN_MS || '1500'),
    crossPlatformPostFillCheck: process.env.CROSS_PLATFORM_POST_FILL_CHECK !== 'false',
    crossPlatformFillCheckMs: parseInt(process.env.CROSS_PLATFORM_FILL_CHECK_MS || '1500'),
    crossPlatformHedgeOnFailure: process.env.CROSS_PLATFORM_HEDGE_ON_FAILURE === 'true',
    crossPlatformHedgePredictOnly: process.env.CROSS_PLATFORM_HEDGE_PREDICT_ONLY !== 'false',
    crossPlatformHedgeSlippageBps: parseInt(process.env.CROSS_PLATFORM_HEDGE_SLIPPAGE_BPS || '400'),
    crossPlatformHedgeMinProfitUsd: parseFloat(process.env.CROSS_PLATFORM_HEDGE_MIN_PROFIT_USD || '0'),
    crossPlatformHedgeMinEdge: parseFloat(process.env.CROSS_PLATFORM_HEDGE_MIN_EDGE || '0'),
    crossPlatformHedgeForceOnPartial: process.env.CROSS_PLATFORM_HEDGE_FORCE_ON_PARTIAL === 'true',
    crossPlatformHedgeForceSlippageBps: parseFloat(process.env.CROSS_PLATFORM_HEDGE_FORCE_SLIPPAGE_BPS || '0'),
    crossPlatformPostTradeHedge: process.env.CROSS_PLATFORM_POST_TRADE_HEDGE === 'true',
    crossPlatformPostTradeHedgeMaxShares: parseFloat(process.env.CROSS_PLATFORM_POST_TRADE_HEDGE_MAX_SHARES || '0'),
    crossPlatformPostTradeHedgeForce: process.env.CROSS_PLATFORM_POST_TRADE_HEDGE_FORCE === 'true',
    crossPlatformPostTradeHedgeSlippageBps: parseInt(
      process.env.CROSS_PLATFORM_POST_TRADE_HEDGE_SLIPPAGE_BPS || '0'
    ),
    crossPlatformPostTradeNetHedge: process.env.CROSS_PLATFORM_POST_TRADE_NET_HEDGE === 'true',
    crossPlatformPostTradeNetHedgeMinShares: parseFloat(
      process.env.CROSS_PLATFORM_POST_TRADE_NET_HEDGE_MIN_SHARES || '0'
    ),
    crossPlatformPostTradeNetHedgeMaxShares: parseFloat(
      process.env.CROSS_PLATFORM_POST_TRADE_NET_HEDGE_MAX_SHARES || '0'
    ),
    crossPlatformPostTradeNetHedgeForce: process.env.CROSS_PLATFORM_POST_TRADE_NET_HEDGE_FORCE === 'true',
    crossPlatformPostTradeNetHedgePredictOnly:
      process.env.CROSS_PLATFORM_POST_TRADE_NET_HEDGE_PREDICT_ONLY === 'true',
    crossPlatformPostTradeNetHedgeSlippageBps: parseInt(
      process.env.CROSS_PLATFORM_POST_TRADE_NET_HEDGE_SLIPPAGE_BPS || '0'
    ),
    crossPlatformDegradeMs: parseInt(process.env.CROSS_PLATFORM_DEGRADE_MS || '0'),
    crossPlatformDegradeSlippageBps: parseInt(process.env.CROSS_PLATFORM_DEGRADE_SLIPPAGE_BPS || '0'),
    crossPlatformDegradeStabilityBps: parseInt(process.env.CROSS_PLATFORM_DEGRADE_STABILITY_BPS || '0'),
    crossPlatformDegradeChunkFactor: parseFloat(process.env.CROSS_PLATFORM_DEGRADE_CHUNK_FACTOR || '0'),
    crossPlatformDegradeChunkDelayMs: parseInt(process.env.CROSS_PLATFORM_DEGRADE_CHUNK_DELAY_MS || '0'),
    crossPlatformDegradeForceSequential: process.env.CROSS_PLATFORM_DEGRADE_FORCE_SEQUENTIAL === 'true',
    crossPlatformDegradeOnPostTrade: process.env.CROSS_PLATFORM_DEGRADE_ON_POST_TRADE === 'true',
    crossPlatformDegradeExitMs: parseInt(process.env.CROSS_PLATFORM_DEGRADE_EXIT_MS || '0'),
    crossPlatformDegradeExitSuccesses: parseInt(process.env.CROSS_PLATFORM_DEGRADE_EXIT_SUCCESSES || '0'),
    crossPlatformDegradeOrderType: (process.env.CROSS_PLATFORM_DEGRADE_ORDER_TYPE || '').toUpperCase() as
      | 'FOK'
      | 'FAK'
      | 'GTC'
      | 'GTD',
    crossPlatformDegradeDisableBatch: process.env.CROSS_PLATFORM_DEGRADE_DISABLE_BATCH === 'true',
    crossPlatformDegradeLimitOrders: process.env.CROSS_PLATFORM_DEGRADE_LIMIT_ORDERS === 'true',
    crossPlatformDegradeUseFok: process.env.CROSS_PLATFORM_DEGRADE_USE_FOK === 'true',
    crossPlatformNetRiskUsd: parseFloat(process.env.CROSS_PLATFORM_NET_RISK_USD || '0'),
    crossPlatformNetRiskUsdPerToken: parseFloat(process.env.CROSS_PLATFORM_NET_RISK_USD_PER_TOKEN || '0'),
    crossPlatformNetRiskMinFactor: parseFloat(process.env.CROSS_PLATFORM_NET_RISK_MIN_FACTOR || '0.4'),
    crossPlatformNetRiskMaxFactor: parseFloat(process.env.CROSS_PLATFORM_NET_RISK_MAX_FACTOR || '1'),
    crossPlatformNetRiskDegradeFactor: parseFloat(process.env.CROSS_PLATFORM_NET_RISK_DEGRADE_FACTOR || '0.6'),
    crossPlatformNetRiskScaleOnQuality: process.env.CROSS_PLATFORM_NET_RISK_SCALE_ON_QUALITY !== 'false',
    crossPlatformNetRiskAutoTighten: process.env.CROSS_PLATFORM_NET_RISK_AUTO_TIGHTEN !== 'false',
    crossPlatformNetRiskTightenOnFailure: parseFloat(process.env.CROSS_PLATFORM_NET_RISK_TIGHTEN_ON_FAILURE || '0.08'),
    crossPlatformNetRiskRelaxOnSuccess: parseFloat(process.env.CROSS_PLATFORM_NET_RISK_RELAX_ON_SUCCESS || '0.03'),
    crossPlatformFallbackShrinkFactor: parseFloat(process.env.CROSS_PLATFORM_FALLBACK_SHRINK_FACTOR || '0.7'),
    crossPlatformFallbackMinFactor: parseFloat(process.env.CROSS_PLATFORM_FALLBACK_MIN_FACTOR || '0.3'),
    crossPlatformSingleLegTopN: parseInt(process.env.CROSS_PLATFORM_SINGLE_LEG_TOP_N || '2'),
    crossPlatformFailureProfitBps: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PROFIT_BPS || '0'),
    crossPlatformFailureProfitUsd: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PROFIT_USD || '0'),
    crossPlatformFailureStabilityBps: parseInt(process.env.CROSS_PLATFORM_FAILURE_STABILITY_BPS || '0'),
    crossPlatformFailureStabilitySamplesAdd: parseInt(process.env.CROSS_PLATFORM_FAILURE_STABILITY_SAMPLES_ADD || '0'),
    crossPlatformFailureStabilityIntervalAddMs: parseInt(process.env.CROSS_PLATFORM_FAILURE_STABILITY_INTERVAL_ADD_MS || '0'),
    crossPlatformFailureVwapDeviationBps: parseInt(process.env.CROSS_PLATFORM_FAILURE_VWAP_DEVIATION_BPS || '0'),
    crossPlatformFailureLegMinDepthUsdAdd: parseFloat(process.env.CROSS_PLATFORM_FAILURE_LEG_MIN_DEPTH_USD_ADD || '0'),
    crossPlatformFailureMaxVwapLevelsCut: parseInt(process.env.CROSS_PLATFORM_FAILURE_MAX_VWAP_LEVELS_CUT || '0'),
    crossPlatformFailureMinNotionalUsdAdd: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_NOTIONAL_USD_ADD || '0'),
    crossPlatformFailureRetryDelayBumpMs: parseInt(process.env.CROSS_PLATFORM_FAILURE_RETRY_DELAY_BUMP_MS || '0'),
    crossPlatformSuccessRetryDelayTightenMs: parseInt(process.env.CROSS_PLATFORM_SUCCESS_RETRY_DELAY_TIGHTEN_MS || '0'),
    crossPlatformRetryDelayFloorMs: parseInt(process.env.CROSS_PLATFORM_RETRY_DELAY_FLOOR_MS || '0'),
    crossPlatformRetryDelayCeilMs: parseInt(process.env.CROSS_PLATFORM_RETRY_DELAY_CEIL_MS || '0'),
    crossPlatformFailureProfitBpsBump: parseInt(process.env.CROSS_PLATFORM_FAILURE_PROFIT_BPS_BUMP || '0'),
    crossPlatformFailureProfitBpsBumpMax: parseInt(process.env.CROSS_PLATFORM_FAILURE_PROFIT_BPS_BUMP_MAX || '0'),
    crossPlatformFailureProfitBpsBumpRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PROFIT_BPS_BUMP_RECOVER || '0.8'),
    crossPlatformFailureStabilitySamplesMax: parseInt(process.env.CROSS_PLATFORM_FAILURE_STABILITY_SAMPLES_MAX || '0'),
    crossPlatformFailureStabilityIntervalMaxMs: parseInt(process.env.CROSS_PLATFORM_FAILURE_STABILITY_INTERVAL_MAX_MS || '0'),
    crossPlatformFailureProfitUsdBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PROFIT_USD_BUMP || '0'),
    crossPlatformFailureProfitUsdBumpMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PROFIT_USD_BUMP_MAX || '0'),
    crossPlatformFailureProfitUsdBumpRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_PROFIT_USD_BUMP_RECOVER || '0.8'),
    crossPlatformFailureLegMinDepthUsdBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_LEG_MIN_DEPTH_USD_BUMP || '0'),
    crossPlatformFailureLegMinDepthUsdBumpMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_LEG_MIN_DEPTH_USD_BUMP_MAX || '0'),
    crossPlatformFailureLegMinDepthUsdBumpRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_LEG_MIN_DEPTH_USD_BUMP_RECOVER || '0.8'),
    crossPlatformFailureMinNotionalUsdBump: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_NOTIONAL_USD_BUMP || '0'),
    crossPlatformFailureMinNotionalUsdBumpMax: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_NOTIONAL_USD_BUMP_MAX || '0'),
    crossPlatformFailureMinNotionalUsdBumpRecover: parseFloat(process.env.CROSS_PLATFORM_FAILURE_MIN_NOTIONAL_USD_BUMP_RECOVER || '0.8'),
    crossPlatformFailureProfitBpsCap: parseInt(process.env.CROSS_PLATFORM_FAILURE_PROFIT_BPS_CAP || '0'),
    crossPlatformFailureMaxRetriesCut: parseInt(process.env.CROSS_PLATFORM_FAILURE_MAX_RETRIES_CUT || '0'),
    crossPlatformFailureMaxRetriesMin: parseInt(process.env.CROSS_PLATFORM_FAILURE_MAX_RETRIES_MIN || '0'),
    crossPlatformMaxRetries: parseInt(process.env.CROSS_PLATFORM_MAX_RETRIES || '1'),
    crossPlatformRetryDelayMs: parseInt(process.env.CROSS_PLATFORM_RETRY_DELAY_MS || '300'),
    crossPlatformCircuitMaxFailures: parseInt(process.env.CROSS_PLATFORM_CIRCUIT_MAX_FAILURES || '3'),
    crossPlatformCircuitWindowMs: parseInt(process.env.CROSS_PLATFORM_CIRCUIT_WINDOW_MS || '60000'),
    crossPlatformCircuitCooldownMs: parseInt(process.env.CROSS_PLATFORM_CIRCUIT_COOLDOWN_MS || '60000'),
    crossPlatformRetrySizeFactor: parseFloat(process.env.CROSS_PLATFORM_RETRY_SIZE_FACTOR || '0.6'),
    crossPlatformRetryAggressiveBps: parseInt(process.env.CROSS_PLATFORM_RETRY_AGGRESSIVE_BPS || '0'),
    crossPlatformRetryFactorMin: parseFloat(process.env.CROSS_PLATFORM_RETRY_FACTOR_MIN || '0.4'),
    crossPlatformRetryFactorMax: parseFloat(process.env.CROSS_PLATFORM_RETRY_FACTOR_MAX || '1'),
    crossPlatformRetryFactorUp: parseFloat(process.env.CROSS_PLATFORM_RETRY_FACTOR_UP || '0.02'),
    crossPlatformRetryFactorDown: parseFloat(process.env.CROSS_PLATFORM_RETRY_FACTOR_DOWN || '0.08'),
    crossPlatformSlippageDynamic: process.env.CROSS_PLATFORM_SLIPPAGE_DYNAMIC !== 'false',
    crossPlatformSlippageFloorBps: parseInt(process.env.CROSS_PLATFORM_SLIPPAGE_FLOOR_BPS || '40'),
    crossPlatformSlippageCeilBps: parseInt(process.env.CROSS_PLATFORM_SLIPPAGE_CEIL_BPS || '400'),
    crossPlatformFailureSlippageBumpBps: parseInt(process.env.CROSS_PLATFORM_FAILURE_SLIPPAGE_BUMP_BPS || '25'),
    crossPlatformSuccessSlippageTightenBps: parseInt(process.env.CROSS_PLATFORM_SUCCESS_SLIPPAGE_TIGHTEN_BPS || '10'),
    crossPlatformSuccessStabilityBps: parseInt(process.env.CROSS_PLATFORM_SUCCESS_STABILITY_BPS || '0'),
    crossPlatformFailureChunkDelayBumpMs: parseInt(process.env.CROSS_PLATFORM_FAILURE_CHUNK_DELAY_BUMP_MS || '0'),
    crossPlatformSuccessChunkDelayTightenMs: parseInt(process.env.CROSS_PLATFORM_SUCCESS_CHUNK_DELAY_TIGHTEN_MS || '0'),
    crossPlatformFailureChunkFactorDown: parseFloat(process.env.CROSS_PLATFORM_FAILURE_CHUNK_FACTOR_DOWN || '0'),
    crossPlatformSuccessChunkFactorUp: parseFloat(process.env.CROSS_PLATFORM_SUCCESS_CHUNK_FACTOR_UP || '0'),
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
    dependencyMinDepthUsd: parseFloat(process.env.DEPENDENCY_MIN_DEPTH_USD || '0'),
    dependencyDepthUsage: parseFloat(process.env.DEPENDENCY_DEPTH_USAGE || '1'),
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
    arbWsRealtime: process.env.ARB_WS_REALTIME === 'true',
    arbWsRealtimeIntervalMs: parseInt(process.env.ARB_WS_REALTIME_INTERVAL_MS || '400'),
    arbWsRealtimeMaxBatch: parseInt(process.env.ARB_WS_REALTIME_MAX_BATCH || '40'),
    arbWsRealtimeQuiet: process.env.ARB_WS_REALTIME_QUIET === 'true',
    arbWsBoostMs: parseInt(process.env.ARB_WS_BOOST_MS || '15000'),
    arbWsBoostIntervalMs: parseInt(process.env.ARB_WS_BOOST_INTERVAL_MS || '150'),
    arbWsBoostMaxBatch: parseInt(process.env.ARB_WS_BOOST_MAX_BATCH || '80'),
    arbWsBoostProfitMult: parseFloat(process.env.ARB_WS_BOOST_PROFIT_MULT || '0.85'),
    crossPlatformWsBoostMs: parseInt(process.env.CROSS_PLATFORM_WS_BOOST_MS || '15000'),
    crossPlatformWsBoostIntervalMs: parseInt(process.env.CROSS_PLATFORM_WS_BOOST_INTERVAL_MS || '250'),
    crossPlatformWsBoostMaxBatch: parseInt(process.env.CROSS_PLATFORM_WS_BOOST_MAX_BATCH || '60'),
    crossPlatformWsBoostProfitMult: parseFloat(process.env.CROSS_PLATFORM_WS_BOOST_PROFIT_MULT || '0.9'),
    arbRequireWs: process.env.ARB_REQUIRE_WS === 'true',
    arbWsHealthScoreMin: parseFloat(process.env.ARB_WS_HEALTH_SCORE_MIN || '0'),
    arbMaxErrors: parseInt(process.env.ARB_MAX_ERRORS || '5'),
    arbErrorWindowMs: parseInt(process.env.ARB_ERROR_WINDOW_MS || '60000'),
    arbPauseOnErrorMs: parseInt(process.env.ARB_PAUSE_ON_ERROR_MS || '60000'),
    arbPauseBackoff: parseFloat(process.env.ARB_PAUSE_BACKOFF || '1.5'),
    arbPauseMaxMs: parseInt(process.env.ARB_PAUSE_MAX_MS || '600000'),
    arbPauseRecoveryFactor: parseFloat(process.env.ARB_PAUSE_RECOVERY_FACTOR || '0.8'),
    arbDegradeMaxLevel: parseInt(process.env.ARB_DEGRADE_MAX_LEVEL || '3'),
    arbDegradeFactor: parseFloat(process.env.ARB_DEGRADE_FACTOR || '0.7'),
    arbDegradeStabilityAdd: parseInt(process.env.ARB_DEGRADE_STABILITY_ADD || '1'),
    arbDegradeTopNMin: parseInt(process.env.ARB_DEGRADE_TOP_N_MIN || '1'),
    arbRecheckBumpMs: parseInt(process.env.ARB_RECHECK_BUMP_MS || '200'),
    arbRecheckBumpMaxMs: parseInt(process.env.ARB_RECHECK_BUMP_MAX_MS || '2000'),
    arbRecheckBumpRecover: parseFloat(process.env.ARB_RECHECK_BUMP_RECOVER || '0.8'),
    arbWsHealthLogMs: parseInt(process.env.ARB_WS_HEALTH_LOG_MS || '0'),
    arbPreflightEnabled: process.env.ARB_PREFLIGHT_ENABLED !== 'false',
    arbPreflightMaxAgeMs: parseInt(process.env.ARB_PREFLIGHT_MAX_AGE_MS || '3000'),
    arbDepthUsage: parseFloat(process.env.ARB_DEPTH_USAGE || '0.6'),
    arbDepthLevels: parseInt(process.env.ARB_DEPTH_LEVELS || '0'),
    arbMinDepthUsd: parseFloat(process.env.ARB_MIN_DEPTH_USD || '0'),
    arbMinNotionalUsd: parseFloat(process.env.ARB_MIN_NOTIONAL_USD || '0'),
    arbMinProfitUsd: parseFloat(process.env.ARB_MIN_PROFIT_USD || '0'),
    arbMinProfitBps: parseFloat(process.env.ARB_MIN_PROFIT_BPS || '0'),
    arbMinProfitImpactMult: parseFloat(process.env.ARB_MIN_PROFIT_IMPACT_MULT || '0'),
    arbMaxVwapDeviationBps: parseFloat(process.env.ARB_MAX_VWAP_DEVIATION_BPS || '0'),
    arbRecheckDeviationBps: parseFloat(process.env.ARB_RECHECK_DEVIATION_BPS || '60'),
    arbMaxVwapLevels: parseInt(process.env.ARB_MAX_VWAP_LEVELS || '0'),
    arbStabilityRequired: process.env.ARB_STABILITY_REQUIRED !== 'false',
    arbStabilityMinCount: parseInt(process.env.ARB_STABILITY_MIN_COUNT || '2'),
    arbStabilityWindowMs: parseInt(process.env.ARB_STABILITY_WINDOW_MS || '2000'),
    arbRequireWsHealth: process.env.ARB_REQUIRE_WS_HEALTH === 'true',
    arbWsHealthMaxAgeMs: parseInt(process.env.ARB_WS_HEALTH_MAX_AGE_MS || '0'),
    arbWsHealthFailureBumpMs: parseInt(process.env.ARB_WS_HEALTH_FAILURE_BUMP_MS || '1500'),
    arbWsHealthRecoveryMs: parseInt(process.env.ARB_WS_HEALTH_RECOVERY_MS || '30000'),
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

  if ((config.arbDepthUsage ?? 0) <= 0 || (config.arbDepthUsage ?? 0) > 1) {
    config.arbDepthUsage = 0.6;
  }
  if ((config.arbMinDepthUsd ?? 0) < 0) {
    config.arbMinDepthUsd = 0;
  }
  if ((config.arbMinNotionalUsd ?? 0) < 0) {
    config.arbMinNotionalUsd = 0;
  }
  if ((config.arbMinProfitUsd ?? 0) < 0) {
    config.arbMinProfitUsd = 0;
  }
  if ((config.arbStabilityMinCount ?? 1) < 1) {
    config.arbStabilityMinCount = 1;
  }
  if ((config.arbStabilityWindowMs ?? 0) < 0) {
    config.arbStabilityWindowMs = 0;
  }
  if ((config.arbWsHealthMaxAgeMs ?? 0) < 0) {
    config.arbWsHealthMaxAgeMs = 0;
  }
  if ((config.arbWsHealthFailureBumpMs ?? 0) < 0) {
    config.arbWsHealthFailureBumpMs = 0;
  }
  if ((config.arbWsHealthRecoveryMs ?? 0) < 0) {
    config.arbWsHealthRecoveryMs = 0;
  }
  if ((config.arbPauseBackoff ?? 0) < 1) {
    config.arbPauseBackoff = 1.2;
  }
  if ((config.arbPauseMaxMs ?? 0) < 0) {
    config.arbPauseMaxMs = 0;
  }
  if ((config.arbPauseRecoveryFactor ?? 0) <= 0 || (config.arbPauseRecoveryFactor ?? 0) >= 1) {
    config.arbPauseRecoveryFactor = 0.8;
  }
  if ((config.arbDegradeMaxLevel ?? 0) < 0) {
    config.arbDegradeMaxLevel = 0;
  }
  if ((config.arbDegradeFactor ?? 0) <= 0 || (config.arbDegradeFactor ?? 0) >= 1) {
    config.arbDegradeFactor = 0.7;
  }
  if ((config.arbDegradeStabilityAdd ?? 0) < 0) {
    config.arbDegradeStabilityAdd = 0;
  }
  if ((config.arbDegradeTopNMin ?? 0) < 1) {
    config.arbDegradeTopNMin = 1;
  }
  if ((config.dependencyDepthUsage ?? 0) <= 0 || (config.dependencyDepthUsage ?? 0) > 1) {
    config.dependencyDepthUsage = 1;
  }
  if ((config.dependencyMinDepthUsd ?? 0) < 0) {
    config.dependencyMinDepthUsd = 0;
  }
  if ((config.arbRecheckBumpMs ?? 0) < 0) {
    config.arbRecheckBumpMs = 0;
  }
  if ((config.arbRecheckBumpMaxMs ?? 0) < 0) {
    config.arbRecheckBumpMaxMs = 0;
  }
  if ((config.arbRecheckBumpRecover ?? 0) <= 0 || (config.arbRecheckBumpRecover ?? 0) >= 1) {
    config.arbRecheckBumpRecover = 0.8;
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
  if ((config.crossPlatformDepthUsage ?? 0) <= 0 || (config.crossPlatformDepthUsage ?? 0) > 1) {
    config.crossPlatformDepthUsage = 0.5;
  }
  if ((config.crossPlatformMinNotionalUsd ?? 0) < 0) {
    config.crossPlatformMinNotionalUsd = 0;
  }
  if ((config.crossPlatformMinProfitUsd ?? 0) < 0) {
    config.crossPlatformMinProfitUsd = 0;
  }

  if ((config.crossPlatformMetricsLogMs ?? 0) < 0) {
    config.crossPlatformMetricsLogMs = 0;
  }
  if ((config.crossPlatformAbortPostTradeDriftBps ?? 0) < 0) {
    config.crossPlatformAbortPostTradeDriftBps = 0;
  }
  if ((config.crossPlatformAbortCooldownMs ?? 0) < 0) {
    config.crossPlatformAbortCooldownMs = 0;
  }
  if ((config.crossPlatformFailurePauseMs ?? 0) < 0) {
    config.crossPlatformFailurePauseMs = 0;
  }
  if ((config.crossPlatformFailurePauseMaxMs ?? 0) < 0) {
    config.crossPlatformFailurePauseMaxMs = 0;
  }
  if ((config.crossPlatformFailurePauseBackoff ?? 0) < 1) {
    config.crossPlatformFailurePauseBackoff = 1.2;
  }
  if ((config.crossPlatformReasonPreflightPenalty ?? 0) < 0) {
    config.crossPlatformReasonPreflightPenalty = 0.4;
  }
  if ((config.crossPlatformReasonExecutionPenalty ?? 0) < 0) {
    config.crossPlatformReasonExecutionPenalty = 0.7;
  }
  if ((config.crossPlatformReasonPostTradePenalty ?? 0) < 0) {
    config.crossPlatformReasonPostTradePenalty = 1.2;
  }
  if ((config.crossPlatformReasonHedgePenalty ?? 0) < 0) {
    config.crossPlatformReasonHedgePenalty = 0.5;
  }
  if ((config.crossPlatformFallbackShrinkFactor ?? 0) <= 0 || (config.crossPlatformFallbackShrinkFactor ?? 0) > 1) {
    config.crossPlatformFallbackShrinkFactor = 0.7;
  }
  if ((config.crossPlatformFallbackMinFactor ?? 0) <= 0 || (config.crossPlatformFallbackMinFactor ?? 0) > 1) {
    config.crossPlatformFallbackMinFactor = 0.3;
  }
  if ((config.crossPlatformSingleLegTopN ?? 0) < 1) {
    config.crossPlatformSingleLegTopN = 1;
  }
  if ((config.crossPlatformRetryFactorMin ?? 0) <= 0 || (config.crossPlatformRetryFactorMin ?? 0) > 1) {
    config.crossPlatformRetryFactorMin = 0.4;
  }
  if ((config.crossPlatformRetryFactorMax ?? 0) <= 0 || (config.crossPlatformRetryFactorMax ?? 0) > 1) {
    config.crossPlatformRetryFactorMax = 1;
  }
  if ((config.crossPlatformRetryFactorMax ?? 1) < (config.crossPlatformRetryFactorMin ?? 0.4)) {
    const temp = config.crossPlatformRetryFactorMax;
    config.crossPlatformRetryFactorMax = config.crossPlatformRetryFactorMin;
    config.crossPlatformRetryFactorMin = temp;
  }
  if ((config.crossPlatformRetryFactorUp ?? 0) < 0) {
    config.crossPlatformRetryFactorUp = 0.02;
  }
  if ((config.crossPlatformRetryFactorDown ?? 0) < 0) {
    config.crossPlatformRetryFactorDown = 0.08;
  }
  if ((config.crossPlatformSlippageFloorBps ?? 0) < 0) {
    config.crossPlatformSlippageFloorBps = 0;
  }
  if ((config.crossPlatformSlippageCeilBps ?? 0) < 0) {
    config.crossPlatformSlippageCeilBps = 0;
  }
  if ((config.crossPlatformSlippageCeilBps ?? 0) > 0) {
    const floor = config.crossPlatformSlippageFloorBps ?? 0;
    const ceil = config.crossPlatformSlippageCeilBps ?? 0;
    if (ceil < floor) {
      config.crossPlatformSlippageCeilBps = floor;
      config.crossPlatformSlippageFloorBps = ceil;
    }
  }
  if ((config.crossPlatformFailureSlippageBumpBps ?? 0) < 0) {
    config.crossPlatformFailureSlippageBumpBps = 0;
  }
  if ((config.crossPlatformSuccessSlippageTightenBps ?? 0) < 0) {
    config.crossPlatformSuccessSlippageTightenBps = 0;
  }
  if ((config.crossPlatformFailureStabilityBps ?? 0) < 0) {
    config.crossPlatformFailureStabilityBps = 0;
  }
  if ((config.crossPlatformSuccessStabilityBps ?? 0) < 0) {
    config.crossPlatformSuccessStabilityBps = 0;
  }
  if ((config.crossPlatformFailureProfitBps ?? 0) < 0) {
    config.crossPlatformFailureProfitBps = 0;
  }
  if ((config.crossPlatformFailureProfitUsd ?? 0) < 0) {
    config.crossPlatformFailureProfitUsd = 0;
  }
  if ((config.crossPlatformFailureStabilitySamplesAdd ?? 0) < 0) {
    config.crossPlatformFailureStabilitySamplesAdd = 0;
  }
  if ((config.crossPlatformFailureStabilityIntervalAddMs ?? 0) < 0) {
    config.crossPlatformFailureStabilityIntervalAddMs = 0;
  }
  if ((config.crossPlatformFailureVwapDeviationBps ?? 0) < 0) {
    config.crossPlatformFailureVwapDeviationBps = 0;
  }
  if ((config.crossPlatformFailureLegMinDepthUsdAdd ?? 0) < 0) {
    config.crossPlatformFailureLegMinDepthUsdAdd = 0;
  }
  if ((config.crossPlatformFailureMaxVwapLevelsCut ?? 0) < 0) {
    config.crossPlatformFailureMaxVwapLevelsCut = 0;
  }
  if ((config.crossPlatformFailureMinNotionalUsdAdd ?? 0) < 0) {
    config.crossPlatformFailureMinNotionalUsdAdd = 0;
  }
  if ((config.crossPlatformFailureRetryDelayBumpMs ?? 0) < 0) {
    config.crossPlatformFailureRetryDelayBumpMs = 0;
  }
  if ((config.crossPlatformSuccessRetryDelayTightenMs ?? 0) < 0) {
    config.crossPlatformSuccessRetryDelayTightenMs = 0;
  }
  if ((config.crossPlatformRetryDelayFloorMs ?? 0) < 0) {
    config.crossPlatformRetryDelayFloorMs = 0;
  }
  if ((config.crossPlatformRetryDelayCeilMs ?? 0) < 0) {
    config.crossPlatformRetryDelayCeilMs = 0;
  }
  if ((config.crossPlatformRetryDelayCeilMs ?? 0) > 0) {
    const floor = config.crossPlatformRetryDelayFloorMs ?? 0;
    const ceil = config.crossPlatformRetryDelayCeilMs ?? 0;
    if (ceil < floor) {
      config.crossPlatformRetryDelayCeilMs = floor;
      config.crossPlatformRetryDelayFloorMs = ceil;
    }
  }
  if ((config.crossPlatformFailureProfitBpsBump ?? 0) < 0) {
    config.crossPlatformFailureProfitBpsBump = 0;
  }
  if ((config.crossPlatformFailureProfitBpsBumpMax ?? 0) < 0) {
    config.crossPlatformFailureProfitBpsBumpMax = 0;
  }
  const bumpMax = config.crossPlatformFailureProfitBpsBumpMax ?? 0;
  if (bumpMax > 0) {
    if ((config.crossPlatformFailureProfitBpsBump ?? 0) > bumpMax) {
      config.crossPlatformFailureProfitBpsBump = bumpMax;
    }
  }
  if ((config.crossPlatformFailureProfitBpsBumpRecover ?? 0) <= 0 || (config.crossPlatformFailureProfitBpsBumpRecover ?? 0) >= 1) {
    config.crossPlatformFailureProfitBpsBumpRecover = 0.8;
  }
  if ((config.crossPlatformFailureStabilitySamplesMax ?? 0) < 0) {
    config.crossPlatformFailureStabilitySamplesMax = 0;
  }
  if ((config.crossPlatformFailureStabilityIntervalMaxMs ?? 0) < 0) {
    config.crossPlatformFailureStabilityIntervalMaxMs = 0;
  }
  if ((config.crossPlatformFailureProfitUsdBump ?? 0) < 0) {
    config.crossPlatformFailureProfitUsdBump = 0;
  }
  if ((config.crossPlatformFailureProfitUsdBumpMax ?? 0) < 0) {
    config.crossPlatformFailureProfitUsdBumpMax = 0;
  }
  const profitUsdBumpMax = config.crossPlatformFailureProfitUsdBumpMax ?? 0;
  if (profitUsdBumpMax > 0) {
    if ((config.crossPlatformFailureProfitUsdBump ?? 0) > profitUsdBumpMax) {
      config.crossPlatformFailureProfitUsdBump = profitUsdBumpMax;
    }
  }
  if ((config.crossPlatformFailureProfitUsdBumpRecover ?? 0) <= 0 || (config.crossPlatformFailureProfitUsdBumpRecover ?? 0) >= 1) {
    config.crossPlatformFailureProfitUsdBumpRecover = 0.8;
  }
  if ((config.crossPlatformFailureLegMinDepthUsdBump ?? 0) < 0) {
    config.crossPlatformFailureLegMinDepthUsdBump = 0;
  }
  if ((config.crossPlatformFailureLegMinDepthUsdBumpMax ?? 0) < 0) {
    config.crossPlatformFailureLegMinDepthUsdBumpMax = 0;
  }
  const depthUsdBumpMax = config.crossPlatformFailureLegMinDepthUsdBumpMax ?? 0;
  if (depthUsdBumpMax > 0) {
    if ((config.crossPlatformFailureLegMinDepthUsdBump ?? 0) > depthUsdBumpMax) {
      config.crossPlatformFailureLegMinDepthUsdBump = depthUsdBumpMax;
    }
  }
  if ((config.crossPlatformFailureLegMinDepthUsdBumpRecover ?? 0) <= 0 || (config.crossPlatformFailureLegMinDepthUsdBumpRecover ?? 0) >= 1) {
    config.crossPlatformFailureLegMinDepthUsdBumpRecover = 0.8;
  }
  if ((config.crossPlatformFailureMinNotionalUsdBump ?? 0) < 0) {
    config.crossPlatformFailureMinNotionalUsdBump = 0;
  }
  if ((config.crossPlatformFailureMinNotionalUsdBumpMax ?? 0) < 0) {
    config.crossPlatformFailureMinNotionalUsdBumpMax = 0;
  }
  const minNotionalBumpMax = config.crossPlatformFailureMinNotionalUsdBumpMax ?? 0;
  if (minNotionalBumpMax > 0) {
    if ((config.crossPlatformFailureMinNotionalUsdBump ?? 0) > minNotionalBumpMax) {
      config.crossPlatformFailureMinNotionalUsdBump = minNotionalBumpMax;
    }
  }
  if ((config.crossPlatformFailureMinNotionalUsdBumpRecover ?? 0) <= 0 || (config.crossPlatformFailureMinNotionalUsdBumpRecover ?? 0) >= 1) {
    config.crossPlatformFailureMinNotionalUsdBumpRecover = 0.8;
  }
  if ((config.crossPlatformFailureChunkDelayBumpMs ?? 0) < 0) {
    config.crossPlatformFailureChunkDelayBumpMs = 0;
  }
  if ((config.crossPlatformSuccessChunkDelayTightenMs ?? 0) < 0) {
    config.crossPlatformSuccessChunkDelayTightenMs = 0;
  }
  if ((config.crossPlatformFailureChunkFactorDown ?? 0) < 0) {
    config.crossPlatformFailureChunkFactorDown = 0;
  }
  if ((config.crossPlatformSuccessChunkFactorUp ?? 0) < 0) {
    config.crossPlatformSuccessChunkFactorUp = 0;
  }
  if ((config.crossPlatformHedgeMinProfitUsd ?? 0) < 0) {
    config.crossPlatformHedgeMinProfitUsd = 0;
  }
  if ((config.crossPlatformHedgeMinEdge ?? 0) < 0) {
    config.crossPlatformHedgeMinEdge = 0;
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

  if ((config.mmAutoSizeMinFactor ?? 0) <= 0) {
    config.mmAutoSizeMinFactor = 0.4;
  }

  if ((config.mmDynamicCancelBoost ?? 0) < 0) {
    config.mmDynamicCancelBoost = 0;
  }

  if ((config.mmDynamicCancelMaxBoost ?? 0) < 1) {
    config.mmDynamicCancelMaxBoost = 1;
  }
  if ((config.mmPointsMinMultiplier ?? 0) < 1) {
    config.mmPointsMinMultiplier = 1;
  }

  if ((config.mmFillPenaltyBps ?? 0) < 0) {
    config.mmFillPenaltyBps = 0;
  }
  if ((config.mmFillPenaltyMaxBps ?? 0) < 0) {
    config.mmFillPenaltyMaxBps = 0;
  }
  if ((config.mmFillPenaltyMaxBps ?? 0) > 0 && (config.mmFillPenaltyMaxBps ?? 0) < (config.mmFillPenaltyBps ?? 0)) {
    config.mmFillPenaltyMaxBps = config.mmFillPenaltyBps;
  }
  if ((config.mmFillPenaltyDecayMs ?? 0) < 0) {
    config.mmFillPenaltyDecayMs = 0;
  }
  if ((config.mmNoFillPassiveMs ?? 0) < 0) {
    config.mmNoFillPassiveMs = 0;
  }
  if ((config.mmNoFillPenaltyBps ?? 0) < 0) {
    config.mmNoFillPenaltyBps = 0;
  }
  if ((config.mmNoFillPenaltyMaxBps ?? 0) < 0) {
    config.mmNoFillPenaltyMaxBps = 0;
  }
  if ((config.mmNoFillPenaltyMaxBps ?? 0) > 0 && (config.mmNoFillPenaltyMaxBps ?? 0) < (config.mmNoFillPenaltyBps ?? 0)) {
    config.mmNoFillPenaltyMaxBps = config.mmNoFillPenaltyBps;
  }
  if ((config.mmNoFillRampMs ?? 0) < 0) {
    config.mmNoFillRampMs = 0;
  }
  if ((config.mmNoFillSizePenalty ?? 0) <= 0 || (config.mmNoFillSizePenalty ?? 0) > 1) {
    config.mmNoFillSizePenalty = 1;
  }
  if ((config.mmNoFillTouchBps ?? 0) < 0) {
    config.mmNoFillTouchBps = 0;
  }
  if ((config.mmNoFillTouchMaxBps ?? 0) < 0) {
    config.mmNoFillTouchMaxBps = 0;
  }
  if ((config.mmNoFillTouchMaxBps ?? 0) > 0 && (config.mmNoFillTouchMaxBps ?? 0) < (config.mmNoFillTouchBps ?? 0)) {
    config.mmNoFillTouchMaxBps = config.mmNoFillTouchBps;
  }
  if ((config.mmNoFillRepriceBps ?? 0) < 0) {
    config.mmNoFillRepriceBps = 0;
  }
  if ((config.mmNoFillRepriceMaxBps ?? 0) < 0) {
    config.mmNoFillRepriceMaxBps = 0;
  }
  if ((config.mmNoFillRepriceMaxBps ?? 0) > 0 && (config.mmNoFillRepriceMaxBps ?? 0) < (config.mmNoFillRepriceBps ?? 0)) {
    config.mmNoFillRepriceMaxBps = config.mmNoFillRepriceBps;
  }
  if ((config.mmNoFillCancelBps ?? 0) < 0) {
    config.mmNoFillCancelBps = 0;
  }
  if ((config.mmNoFillCancelMaxBps ?? 0) < 0) {
    config.mmNoFillCancelMaxBps = 0;
  }
  if ((config.mmNoFillCancelMaxBps ?? 0) > 0 && (config.mmNoFillCancelMaxBps ?? 0) < (config.mmNoFillCancelBps ?? 0)) {
    config.mmNoFillCancelMaxBps = config.mmNoFillCancelBps;
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
    `MM Fill Penalty: base=${config.mmFillPenaltyBps ?? 0}bps max=${config.mmFillPenaltyMaxBps ?? 0}bps decay=${config.mmFillPenaltyDecayMs}ms`
  );
  console.log(
    `MM No-Fill Passive: after=${config.mmNoFillPassiveMs ?? 0}ms base=${config.mmNoFillPenaltyBps ?? 0}bps max=${config.mmNoFillPenaltyMaxBps ?? 0}bps size=${config.mmNoFillSizePenalty ?? 1}`
  );
  console.log(
    `MM No-Fill Touch: base=${config.mmNoFillTouchBps ?? 0}bps max=${config.mmNoFillTouchMaxBps ?? 0}bps`
  );
  console.log(
    `MM Cancel Confirm: reprice=${config.mmRepriceConfirmMs}ms cancel=${config.mmCancelConfirmMs}ms`
  );
  console.log(
    `MM Recheck: cancel=${config.mmCancelRecheckMs}ms reprice=${config.mmRepriceRecheckMs}ms cooldown=${config.mmRecheckCooldownMs}ms`
  );
  console.log(
    `MM Auto Size: onFill=${config.mmAutoSizeOnFill ? '✅' : '❌'} min=${config.mmAutoSizeMinFactor}`
  );
  console.log(
    `MM Dynamic Cancel: onFill=${config.mmDynamicCancelOnFill ? '✅' : '❌'} boost=${config.mmDynamicCancelBoost} max=${config.mmDynamicCancelMaxBoost}`
  );
  console.log(`Anti Fill Bps: ${(config.antiFillBps ?? 0) * 100}%`);
  console.log(`Near Touch Bps: ${(config.nearTouchBps ?? 0) * 100}%`);
  console.log(`MM Only Points Markets: ${config.mmOnlyPointsMarkets ? '✅' : '❌'}`);
  console.log(
    `MM Points Min Only: ${config.mmPointsMinOnly ? '✅' : '❌'} x${config.mmPointsMinMultiplier ?? 1}`
  );
  console.log(`Hedge On Fill: ${config.hedgeOnFill ? '✅' : '❌'}`);
  console.log(`Hedge Mode: ${config.hedgeMode}`);
  console.log(`Cross-Platform Enabled: ${config.crossPlatformEnabled ? '✅' : '❌'}`);
  console.log(`Cross-Platform Mapping: ${config.crossPlatformUseMapping ? '✅' : '❌'}`);
  console.log(`Cross-Platform Max Shares: ${config.crossPlatformMaxShares}`);
  console.log(`Cross-Platform Depth Levels: ${config.crossPlatformDepthLevels}`);
  console.log(`Cross-Platform Slippage Bps: ${config.crossPlatformSlippageBps}`);
  console.log(
    `Cross-Platform Min Notional/Profit: $${config.crossPlatformMinNotionalUsd}/$${config.crossPlatformMinProfitUsd}`
  );
  console.log(`Cross-Platform Limit Orders: ${config.crossPlatformLimitOrders ? '✅' : '❌'}`);
  console.log(`Cross-Platform Use FOK: ${config.crossPlatformUseFok ? '✅' : '❌'}`);
  console.log(`Cross-Platform Parallel Submit: ${config.crossPlatformParallelSubmit ? '✅' : '❌'}`);
  if (config.crossPlatformFallbackMode) {
    console.log(`Cross-Platform Fallback Mode: ${config.crossPlatformFallbackMode}`);
  }
  console.log(`Cross-Platform Cancel Open Ms: ${config.crossPlatformCancelOpenMs}`);
  console.log(`Cross-Platform Hedge On Failure: ${config.crossPlatformHedgeOnFailure ? '✅' : '❌'}`);
  console.log(`Cross-Platform Hedge Predict Only: ${config.crossPlatformHedgePredictOnly ? '✅' : '❌'}`);
  console.log(`Cross-Platform Hedge Slippage Bps: ${config.crossPlatformHedgeSlippageBps}`);
  console.log(
    `Cross-Platform Hedge Min Profit/Edge: $${config.crossPlatformHedgeMinProfitUsd} / ${config.crossPlatformHedgeMinEdge}`
  );
  console.log(`Cross-Platform Max Retries: ${config.crossPlatformMaxRetries}`);
  console.log(`Cross-Platform Retry Delay Ms: ${config.crossPlatformRetryDelayMs}`);
  console.log(`Cross-Platform Circuit Max Failures: ${config.crossPlatformCircuitMaxFailures}`);
  console.log(`Cross-Platform Circuit Window Ms: ${config.crossPlatformCircuitWindowMs}`);
  console.log(`Cross-Platform Circuit Cooldown Ms: ${config.crossPlatformCircuitCooldownMs}`);
  console.log(`Cross-Platform Retry Size Factor: ${config.crossPlatformRetrySizeFactor}`);
  console.log(`Cross-Platform Retry Aggressive Bps: ${config.crossPlatformRetryAggressiveBps}`);
  console.log(`Cross-Platform Abort Drift Bps: ${config.crossPlatformAbortPostTradeDriftBps}`);
  console.log(`Cross-Platform Abort Cooldown Ms: ${config.crossPlatformAbortCooldownMs}`);
  if (config.crossPlatformFailurePauseMs && config.crossPlatformFailurePauseMs > 0) {
    console.log(
      `Cross-Platform Failure Pause: base=${config.crossPlatformFailurePauseMs} max=${config.crossPlatformFailurePauseMaxMs} backoff=${config.crossPlatformFailurePauseBackoff}`
    );
  }
  console.log(
    `Cross-Platform Failure Penalties: preflight=${config.crossPlatformReasonPreflightPenalty} exec=${config.crossPlatformReasonExecutionPenalty} post=${config.crossPlatformReasonPostTradePenalty} hedge=${config.crossPlatformReasonHedgePenalty}`
  );
  console.log(
    `Cross-Platform Retry Factor: ${config.crossPlatformRetryFactorMin}-${config.crossPlatformRetryFactorMax} up=${config.crossPlatformRetryFactorUp} down=${config.crossPlatformRetryFactorDown}`
  );
  console.log(
    `Cross-Platform Retry Delay: base=${config.crossPlatformRetryDelayMs}ms floor=${config.crossPlatformRetryDelayFloorMs}ms ceil=${config.crossPlatformRetryDelayCeilMs}ms`
  );
  console.log(
    `Cross-Platform Slippage Dynamic: ${config.crossPlatformSlippageDynamic ? '✅' : '❌'} floor=${config.crossPlatformSlippageFloorBps} ceil=${config.crossPlatformSlippageCeilBps}`
  );
  console.log(
    `Cross-Platform Slippage Steps: fail+${config.crossPlatformFailureSlippageBumpBps} success-${config.crossPlatformSuccessSlippageTightenBps}`
  );
  console.log(
    `Cross-Platform Failure Tuning: stability+${config.crossPlatformFailureStabilityBps} delay+${config.crossPlatformFailureChunkDelayBumpMs} factor-${config.crossPlatformFailureChunkFactorDown}`
  );
  console.log(
    `Cross-Platform Success Tuning: stability-${config.crossPlatformSuccessStabilityBps} delay-${config.crossPlatformSuccessChunkDelayTightenMs} factor+${config.crossPlatformSuccessChunkFactorUp}`
  );
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
  console.log(`Arb Preflight: ${config.arbPreflightEnabled ? '✅' : '❌'} maxAge=${config.arbPreflightMaxAgeMs}ms`);
  console.log(
    `Arb Depth Usage: ${config.arbDepthUsage} minDepth=$${config.arbMinDepthUsd} minNotional=$${config.arbMinNotionalUsd} minProfit=$${config.arbMinProfitUsd}`
  );
  console.log(
    `Arb Pause Backoff: base=${config.arbPauseOnErrorMs}ms max=${config.arbPauseMaxMs}ms backoff=${config.arbPauseBackoff} recover=${config.arbPauseRecoveryFactor}`
  );
  console.log(
    `Arb Degrade: maxLevel=${config.arbDegradeMaxLevel} factor=${config.arbDegradeFactor} stability+${config.arbDegradeStabilityAdd}`
  );
  console.log(
    `Arb Stability: ${config.arbStabilityRequired ? '✅' : '❌'} count=${config.arbStabilityMinCount} window=${config.arbStabilityWindowMs}ms`
  );
  if (config.arbRequireWsHealth) {
    const maxAge = config.arbWsHealthMaxAgeMs || config.arbWsMaxAgeMs || 0;
    console.log(`Arb WS Health Required: ✅ maxAge=${maxAge}ms`);
  } else {
    console.log('Arb WS Health Required: ❌');
  }
  if (config.arbRequireWsHealth) {
    console.log(
      `Arb WS Health Adaptive: bump=${config.arbWsHealthFailureBumpMs} recovery=${config.arbWsHealthRecoveryMs}ms`
    );
  }
  console.log(`Refresh Interval: ${config.refreshInterval}ms`);
  console.log(`Trading Enabled: ${config.enableTrading ? '✅' : '❌ (Dry Run)'}`);
  if (config.marketTokenIds && config.marketTokenIds.length > 0) {
    console.log(`Markets: ${config.marketTokenIds.join(', ')}`);
  } else {
    console.log(`Markets: Auto-select liquid markets`);
  }
  console.log('─'.repeat(80) + '\n');
}
