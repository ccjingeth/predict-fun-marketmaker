/**
 * Core types for Predict.fun Market Maker
 */

export interface Config {
  apiBaseUrl: string;
  privateKey: string;
  rpcUrl?: string;
  predictAccountAddress?: string;
  apiKey?: string;
  jwtToken?: string;
  spread: number;
  minSpread?: number;
  maxSpread?: number;
  useValueSignal?: boolean;
  valueSignalWeight?: number;
  valueConfidenceMin?: number;
  orderSize: number;
  maxSingleOrderValue?: number;
  maxPosition: number;
  mmAccountEquityUsd?: number;
  mmMaxPositionPct?: number;
  mmOrderSizePct?: number;
  mmMaxSingleOrderPct?: number;
  mmMaxDailyLossPct?: number;
  mmAdaptiveParams?: boolean;
  mmSpreadVolWeight?: number;
  mmSpreadLiquidityWeight?: number;
  mmBookSpreadWeight?: number;
  mmVolEmaAlpha?: number;
  mmDepthEmaAlpha?: number;
  mmDepthLevels?: number;
  mmMinTopDepthShares?: number;
  mmMinTopDepthUsd?: number;
  mmDepthDropRatio?: number;
  mmDepthRefShares?: number;
  mmInventorySkewVolWeight?: number;
  mmInventorySkewDepthWeight?: number;
  mmIcebergEnabled?: boolean;
  mmIcebergRatio?: number;
  mmIcebergMaxChunkShares?: number;
  mmAdaptiveProfile?: 'AUTO' | 'CALM' | 'NORMAL' | 'VOLATILE';
  mmVolatilityCalmBps?: number;
  mmVolatilityVolatileBps?: number;
  mmIntervalVolatilityBps?: number;
  mmIntervalVolMultiplier?: number;
  mmProfileLiquidityLow?: number;
  mmProfileLiquidityHigh?: number;
  mmProfileSpreadMinCalm?: number;
  mmProfileSpreadMaxCalm?: number;
  mmProfileSpreadMinVolatile?: number;
  mmProfileSpreadMaxVolatile?: number;
  mmIcebergRequoteMs?: number;
  mmOrderRefreshMs?: number;
  mmOrderDepthUsage?: number;
  mmInventorySpreadWeight?: number;
  mmRepriceVolMultiplier?: number;
  mmCancelVolMultiplier?: number;
  mmNearTouchVolMultiplier?: number;
  mmAntiFillVolMultiplier?: number;
  mmCooldownVolMultiplier?: number;
  mmImbalanceLevels?: number;
  mmImbalanceWeight?: number;
  mmImbalanceMaxSkew?: number;
  mmImbalanceSpreadWeight?: number;
  inventorySkewFactor?: number;
  cancelThreshold: number;
  repriceThreshold?: number;
  minOrderIntervalMs?: number;
  maxOrdersPerMarket?: number;
  maxDailyLoss?: number;
  antiFillBps?: number;
  nearTouchBps?: number;
  cooldownAfterCancelMs?: number;
  volatilityPauseBps?: number;
  volatilityLookbackMs?: number;
  pauseAfterVolatilityMs?: number;
  hedgeOnFill?: boolean;
  hedgeTriggerShares?: number;
  hedgeMode?: 'FLATTEN' | 'CROSS' | 'NONE';
  hedgeMaxSlippageBps?: number;
  crossPlatformEnabled?: boolean;
  crossPlatformMinProfit?: number;
  crossPlatformMinSimilarity?: number;
  crossPlatformAutoExecute?: boolean;
  crossPlatformRequireConfirm?: boolean;
  crossPlatformMaxMatches?: number;
  crossPlatformTransferCost?: number;
  crossPlatformSlippageBps?: number;
  crossPlatformMaxShares?: number;
  crossPlatformDepthLevels?: number;
  crossPlatformExecutionVwapCheck?: boolean;
  crossPlatformPriceDriftBps?: number;
  crossPlatformAdaptiveSize?: boolean;
  crossPlatformMinDepthShares?: number;
  crossPlatformVolatilityBps?: number;
  crossPlatformVolatilityLookbackMs?: number;
  crossPlatformTokenMaxFailures?: number;
  crossPlatformTokenFailureWindowMs?: number;
  crossPlatformTokenCooldownMs?: number;
  crossPlatformMetricsLogMs?: number;
  crossPlatformDepthUsage?: number;
  crossPlatformMaxNotional?: number;
  crossPlatformRecheckMs?: number;
  crossPlatformRecheckDeviationBps?: number;
  crossPlatformRecheckDriftBps?: number;
  crossPlatformStabilitySamples?: number;
  crossPlatformStabilityIntervalMs?: number;
  crossPlatformStabilityBps?: number;
  crossPlatformPostTradeDriftBps?: number;
  crossPlatformAutoTune?: boolean;
  crossPlatformAutoTuneMinFactor?: number;
  crossPlatformAutoTuneMaxFactor?: number;
  crossPlatformAutoTuneUp?: number;
  crossPlatformAutoTuneDown?: number;
  crossPlatformTokenMinScore?: number;
  crossPlatformTokenScoreOnSuccess?: number;
  crossPlatformTokenScoreOnFailure?: number;
  crossPlatformTokenScoreOnVolatility?: number;
  crossPlatformTokenScoreOnPostTrade?: number;
  crossPlatformPlatformMinScore?: number;
  crossPlatformPlatformScoreOnSuccess?: number;
  crossPlatformPlatformScoreOnFailure?: number;
  crossPlatformPlatformScoreOnVolatility?: number;
  crossPlatformPlatformScoreOnPostTrade?: number;
  crossPlatformPlatformScoreOnSpread?: number;
  crossPlatformLegDriftSpreadBps?: number;
  crossPlatformAllowlistTokens?: string[];
  crossPlatformBlocklistTokens?: string[];
  crossPlatformAllowlistPlatforms?: string[];
  crossPlatformBlocklistPlatforms?: string[];
  crossPlatformChunkMaxShares?: number;
  crossPlatformChunkMaxNotional?: number;
  crossPlatformChunkDelayMs?: number;
  crossPlatformChunkAutoTune?: boolean;
  crossPlatformChunkFactorMin?: number;
  crossPlatformChunkFactorMax?: number;
  crossPlatformChunkFactorUp?: number;
  crossPlatformChunkFactorDown?: number;
  crossPlatformChunkDelayAutoTune?: boolean;
  crossPlatformChunkDelayMinMs?: number;
  crossPlatformChunkDelayMaxMs?: number;
  crossPlatformChunkDelayUpMs?: number;
  crossPlatformChunkDelayDownMs?: number;
  crossPlatformPlatformMaxFailures?: number;
  crossPlatformPlatformFailureWindowMs?: number;
  crossPlatformPlatformCooldownMs?: number;
  crossPlatformAutoBlocklist?: boolean;
  crossPlatformAutoBlocklistCooldownMs?: number;
  crossPlatformAutoBlocklistScore?: number;
  crossPlatformGlobalCooldownMs?: number;
  crossPlatformGlobalMinQuality?: number;
  crossPlatformStatePath?: string;
  crossPlatformMetricsPath?: string;
  crossPlatformMetricsFlushMs?: number;
  crossPlatformOrderType?: 'FOK' | 'FAK' | 'GTC' | 'GTD';
  crossPlatformBatchOrders?: boolean;
  crossPlatformBatchMax?: number;
  crossPlatformUseFok?: boolean;
  crossPlatformParallelSubmit?: boolean;
  crossPlatformLimitOrders?: boolean;
  crossPlatformCancelOpenMs?: number;
  crossPlatformPostFillCheck?: boolean;
  crossPlatformFillCheckMs?: number;
  crossPlatformHedgeOnFailure?: boolean;
  crossPlatformHedgePredictOnly?: boolean;
  crossPlatformHedgeSlippageBps?: number;
  crossPlatformMaxRetries?: number;
  crossPlatformRetryDelayMs?: number;
  crossPlatformCircuitMaxFailures?: number;
  crossPlatformCircuitWindowMs?: number;
  crossPlatformCircuitCooldownMs?: number;
  crossPlatformRetrySizeFactor?: number;
  crossPlatformRetryAggressiveBps?: number;
  autoConfirmAll?: boolean;
  crossPlatformMappingPath?: string;
  crossPlatformUseMapping?: boolean;
  alertWebhookUrl?: string;
  alertMinIntervalMs?: number;
  dependencyEnabled?: boolean;
  dependencyConstraintsPath?: string;
  dependencyPythonPath?: string;
  dependencyPythonScript?: string;
  dependencyMinProfit?: number;
  dependencyMaxLegs?: number;
  dependencyMaxNotional?: number;
  dependencyMinDepth?: number;
  dependencyFeeBps?: number;
  dependencyFeeCurveRate?: number;
  dependencyFeeCurveExponent?: number;
  dependencySlippageBps?: number;
  dependencyMaxIter?: number;
  dependencyOracleTimeoutSec?: number;
  dependencyTimeoutMs?: number;
  dependencyAllowSells?: boolean;
  multiOutcomeEnabled?: boolean;
  multiOutcomeMinOutcomes?: number;
  multiOutcomeMaxShares?: number;
  arbAutoExecute?: boolean;
  arbAutoExecuteValue?: boolean;
  arbExecuteTopN?: number;
  arbExecutionCooldownMs?: number;
  arbScanIntervalMs?: number;
  arbMaxMarkets?: number;
  arbOrderbookConcurrency?: number;
  arbMarketsCacheMs?: number;
  arbWsMaxAgeMs?: number;
  arbMaxErrors?: number;
  arbErrorWindowMs?: number;
  arbPauseOnErrorMs?: number;
  arbWsHealthLogMs?: number;
  predictFeeBps?: number;
  polymarketGammaUrl?: string;
  polymarketClobUrl?: string;
  polymarketMaxMarkets?: number;
  polymarketFeeBps?: number;
  polymarketFeeRateUrl?: string;
  polymarketFeeRateCacheMs?: number;
  polymarketFeeCurveRate?: number;
  polymarketFeeCurveExponent?: number;
  polymarketWsEnabled?: boolean;
  polymarketWsUrl?: string;
  polymarketWsCustomFeature?: boolean;
  polymarketWsInitialDump?: boolean;
  polymarketWsStaleMs?: number;
  polymarketWsResetOnReconnect?: boolean;
  polymarketCacheTtlMs?: number;
  predictWsEnabled?: boolean;
  predictWsUrl?: string;
  predictWsApiKey?: string;
  predictWsTopicKey?: 'token_id' | 'condition_id' | 'event_id';
  predictWsStaleMs?: number;
  predictWsResetOnReconnect?: boolean;
  polymarketPrivateKey?: string;
  polymarketApiKey?: string;
  polymarketApiSecret?: string;
  polymarketApiPassphrase?: string;
  polymarketChainId?: number;
  polymarketAutoDeriveApiKey?: boolean;
  opinionOpenApiUrl?: string;
  opinionApiKey?: string;
  opinionMaxMarkets?: number;
  opinionFeeBps?: number;
  opinionPythonPath?: string;
  opinionPythonScript?: string;
  opinionPrivateKey?: string;
  opinionChainId?: number;
  opinionHost?: string;
  opinionWsEnabled?: boolean;
  opinionWsUrl?: string;
  opinionWsHeartbeatMs?: number;
  opinionWsStaleMs?: number;
  opinionWsResetOnReconnect?: boolean;
  marketTokenIds?: string[];
  refreshInterval: number;
  enableTrading: boolean;
}

export interface Market {
  token_id: string;
  question: string;
  description?: string;
  condition_id?: string;
  event_id?: string;
  outcome?: string;
  end_date?: string;
  is_neg_risk: boolean;
  is_yield_bearing: boolean;
  fee_rate_bps: number;
  volume_24h?: number;
  liquidity_24h?: number;
  // Price aggregation from orderbook
  best_bid?: number;
  best_ask?: number;
  spread_pct?: number;
  total_orders?: number;
  // Liquidity Points Activation Rules
  // These fields control when orders qualify for liquidity points
  liquidity_activation?: LiquidityActivation;
}

/**
 * Liquidity activation rules for a market
 * Orders must meet these criteria to earn liquidity points
 *
 * Based on Predict.fun UI:
 * - Min. shares: 100 (minimum number of shares)
 * - Max spread: ±6¢ (6 cents = $0.06)
 */
export interface LiquidityActivation {
  // Minimum shares to qualify for points
  min_shares?: number;
  // Maximum spread to qualify for points (in cents, e.g., 6 = $0.06)
  max_spread_cents?: number;
  // Maximum spread as decimal (e.g., 0.06)
  max_spread?: number;
  // Whether points are currently active for this market
  active?: boolean;
  // Description of the requirements
  description?: string;
}

export interface OrderbookEntry {
  price: string;
  shares: string;
  creator?: string;
  orderbook_id?: string;
  order_type?: 'LIMIT' | 'MARKET';
}

export interface Orderbook {
  token_id: string;
  bids: OrderbookEntry[];
  asks: OrderbookEntry[];
  best_bid?: number;
  best_ask?: number;
  spread?: number;
  spread_pct?: number;
  mid_price?: number;
}

export interface Order {
  id?: string;
  order_hash: string;
  token_id: string;
  maker: string;
  signer?: string;
  order_type: 'LIMIT' | 'MARKET';
  side: 'BUY' | 'SELL';
  price: string;
  shares: string;
  is_neg_risk: boolean;
  is_yield_bearing: boolean;
  fee_rate_bps?: number;
  signature?: string;
  status: 'OPEN' | 'FILLED' | 'CANCELED';
  timestamp: number;
}

export interface Position {
  token_id: string;
  question: string;
  yes_amount: number;
  no_amount: number;
  total_value: number;
  avg_entry_price: number;
  current_price: number;
  pnl: number;
}

export interface MarketMakerState {
  markets: Map<string, Market>;
  orderbooks: Map<string, Orderbook>;
  openOrders: Map<string, Order>;
  positions: Map<string, Position>;
  lastUpdate: number;
}
