/**
 * Market Selector
 * 面向做市的市场推荐：优先真实可挂流动性、盘口连续性、双边对称性，
 * 对 Polymarket 额外叠加流动性激励（奖励速率、最小挂单、最大奖励价差）评估。
 */

import type { Market, Orderbook, OrderbookEntry } from './types.js';

export interface MarketScore {
  market: Market;
  score: number;
  reasons: string[];
}

export interface MarketSelectorOptions {
  polymarketRewardMinFitScore?: number;
  polymarketRewardMinDailyRate?: number;
  polymarketRewardMinEfficiency?: number;
  polymarketRewardMinNetEfficiency?: number;
  polymarketRewardNetCostBpsMultiplier?: number;
  polymarketRewardRequireFit?: boolean;
  polymarketRewardRequireEnabled?: boolean;
  polymarketRewardMaxQueueMultiple?: number;
  polymarketRewardCrowdingPenaltyStart?: number;
  polymarketRewardCrowdingPenaltyMax?: number;
  polymarketRewardMinQueueHours?: number;
  polymarketRewardFastFlowPenaltyMax?: number;
  polymarketRewardTargetQueueHours?: number;
  polymarketRewardTargetQueueTolerance?: number;
  polymarketRewardTargetPenaltyMax?: number;
  polymarketObservedQueueStats?: Map<string, { filled?: number; cancelRate?: number; avgFillLifetimeMs?: number }>;
  polymarketObservedQueueMinSamples?: number;
  polymarketObservedQueueMaxWeight?: number;
  polymarketRecentRiskBlockPenalty?: number;
  polymarketRecentRiskPenalty?: Map<
    string,
    {
      penalty: number;
      reason: string;
      cooldownRemainingMs?: number;
      cooldownReason?: string;
      fillPenaltyBps?: number;
      riskThrottleFactor?: number;
      cancelRate?: number;
      avgCancelLifetimeMs?: number;
      avgFillLifetimeMs?: number;
      cancelPenalty?: number;
      lifetimePenalty?: number;
      cancelNearTouch?: number;
      cancelRefresh?: number;
      cancelVwap?: number;
      cancelAggressive?: number;
      cancelUnsafe?: number;
    }
  >;
  polymarketHourRiskPenalty?: { penalty: number; reason: string; hour: number };
  polymarketHourlyMarketRiskPenalty?: Map<string, { penalty: number; reason: string; hour: number }>;
  polymarketHourRiskBlockPenalty?: number;
  polymarketHourRiskSizeFactorMin?: number;
  polymarketEventRiskPenaltyWithinMs?: number;
  polymarketEventRiskBlockWithinMs?: number;
  polymarketEventRiskPenaltyMax?: number;
  polymarketEventRiskSizeFactorMin?: number;
  polymarketCatalystRiskPenaltyWithinMs?: number;
  polymarketCatalystRiskBlockWithinMs?: number;
  polymarketCatalystRiskPenaltyMax?: number;
  polymarketCatalystRiskSizeFactorMin?: number;
  polymarketPatternMemoryPenalty?: Map<
    string,
    {
      penalty: number;
      reason: string;
      dominance?: number;
      dominantReason?: string;
      ageMs?: number;
      ttlRemainingMs?: number;
      decayFactor?: number;
      reasonMix?: Record<string, number>;
      learnedRetreatMix?: Record<string, number>;
      learnedSizeMix?: Record<string, number>;
      learnedRetreat?: number;
      learnedSize?: number;
    }
  >;
  polymarketPatternMemoryBlockPenalty?: number;
}

interface LevelLiquidity {
  bid1: number;
  ask1: number;
  bid2: number;
  ask2: number;
  l1Usable: number;
  l2Usable: number;
  l1Total: number;
  l2Total: number;
}

interface PolymarketRewardProfile {
  enabled: boolean;
  acceptingOrders: boolean;
  minSize: number;
  maxSpread: number;
  dailyRate: number;
  hourlyRate: number;
  l1SizeFit: number;
  l2SizeFit: number;
  spreadFit: number;
  fitScore: number;
  bonus: number;
  crowdingMultiple: number;
  crowdingPenalty: number;
  capitalEstimateUsd: number;
  efficiency: number;
  netEfficiency: number;
  netDailyRate: number;
  effectiveNetEfficiency: number;
  effectiveNetDailyRate: number;
  estimatedCostBps: number;
  riskThrottleFactor: number;
  hourRiskFactor: number;
  efficiencyBonus: number;
  queueAheadShares: number;
  hourlyTurnoverShares: number;
  queueHours: number;
  flowToQueuePerHour: number;
  queueModel: 'volume-24h' | 'observed' | 'blended';
  queueConfidence: number;
  observedQueueHours: number | null;
  fastFlowPenalty: number;
  targetQueueHours: number;
  targetQueueFactor: number;
  targetQueuePenalty: number;
  targetQueueReason: string;
}

export interface PolymarketEventRiskState {
  penalty: number;
  reason: string;
  block: boolean;
  source?: 'close' | 'catalyst';
  timeToCloseMs?: number;
  timeToCatalystMs?: number;
  catalystLabel?: string;
  sizeFactor: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDurationMs(durationMs: number): string {
  const totalMinutes = Math.max(1, Math.ceil(durationMs / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes}分钟`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
}

function evaluateTimedRisk(
  source: 'close' | 'catalyst',
  label: string,
  timeMs: number,
  options: { penaltyWithinMs?: number; blockWithinMs?: number; penaltyMax?: number; sizeFactorMin?: number }
): PolymarketEventRiskState {
  const blockWithinMs = Math.max(0, Number(options.blockWithinMs || 0));
  const penaltyWithinMs = Math.max(blockWithinMs, Number(options.penaltyWithinMs || 0));
  const penaltyMax = Math.max(0, Number(options.penaltyMax || 0));
  const sizeFactorMin = clamp(Number(options.sizeFactorMin ?? 0.45), 0.1, 1);
  const isCatalyst = source === 'catalyst';
  const timeField = isCatalyst ? { timeToCatalystMs: timeMs, catalystLabel: label } : { timeToCloseMs: timeMs };
  if (timeMs <= 0) {
    return {
      penalty: penaltyMax,
      reason: isCatalyst ? label + '窗口已开始或正在发生' : '市场已接近结束或结算窗口',
      block: true,
      source,
      sizeFactor: sizeFactorMin,
      ...timeField,
    };
  }
  if (blockWithinMs > 0 && timeMs <= blockWithinMs) {
    return {
      penalty: penaltyMax,
      reason: (isCatalyst ? '临近' + label : '临近事件窗口') + '，仅剩约' + formatDurationMs(timeMs),
      block: true,
      source,
      sizeFactor: sizeFactorMin,
      ...timeField,
    };
  }
  if (penaltyWithinMs <= 0 || timeMs > penaltyWithinMs || penaltyMax <= 0) {
    return { penalty: 0, reason: '', block: false, source, sizeFactor: 1, ...timeField };
  }
  const span = Math.max(1, penaltyWithinMs - blockWithinMs);
  const ratio = clamp((penaltyWithinMs - timeMs) / span, 0, 1);
  const penalty = penaltyMax * ratio;
  const sizeFactor = 1 - (1 - sizeFactorMin) * ratio;
  return {
    penalty,
    reason: (isCatalyst ? '临近' + label : '临近事件窗口') + '，剩余约' + formatDurationMs(timeMs) + ' (-' + penalty.toFixed(1) + ')',
    block: false,
    source,
    sizeFactor,
    ...timeField,
  };
}

function pickStrongerEventRisk(current: PolymarketEventRiskState, next: PolymarketEventRiskState): PolymarketEventRiskState {
  if (next.block && !current.block) return next;
  if (!next.block && current.block) return current;
  if (next.penalty > current.penalty + 1e-9) return next;
  if (current.penalty > next.penalty + 1e-9) return current;
  const currentTime = current.timeToCatalystMs ?? current.timeToCloseMs ?? Number.POSITIVE_INFINITY;
  const nextTime = next.timeToCatalystMs ?? next.timeToCloseMs ?? Number.POSITIVE_INFINITY;
  return nextTime < currentTime ? next : current;
}

export function evaluatePolymarketEventRisk(
  market: Market,
  options: {
    penaltyWithinMs?: number;
    blockWithinMs?: number;
    penaltyMax?: number;
    sizeFactorMin?: number;
    catalystPenaltyWithinMs?: number;
    catalystBlockWithinMs?: number;
    catalystPenaltyMax?: number;
    catalystSizeFactorMin?: number;
  } = {}
): PolymarketEventRiskState {
  let strongest: PolymarketEventRiskState = { penalty: 0, reason: '', block: false, sizeFactor: 1 };
  const endDate = String(market.end_date || '').trim();
  if (endDate) {
    const endMs = Date.parse(endDate);
    if (Number.isFinite(endMs)) {
      strongest = pickStrongerEventRisk(
        strongest,
        evaluateTimedRisk('close', '事件收盘/结算窗口', endMs - Date.now(), {
          penaltyWithinMs: options.penaltyWithinMs,
          blockWithinMs: options.blockWithinMs,
          penaltyMax: options.penaltyMax,
          sizeFactorMin: options.sizeFactorMin,
        })
      );
    }
  }
  const catalysts = [
    { label: '事件开始', value: String(market.event_start_date || '').trim() },
    { label: '事件结束', value: String(market.event_end_date || '').trim() },
  ];
  for (const catalyst of catalysts) {
    if (!catalyst.value) continue;
    const catalystMs = Date.parse(catalyst.value);
    if (!Number.isFinite(catalystMs)) continue;
    const timeToCatalystMs = catalystMs - Date.now();
    if (timeToCatalystMs <= 0 && catalyst.label !== '事件结束') continue;
    strongest = pickStrongerEventRisk(
      strongest,
      evaluateTimedRisk('catalyst', catalyst.label, timeToCatalystMs, {
        penaltyWithinMs: options.catalystPenaltyWithinMs,
        blockWithinMs: options.catalystBlockWithinMs,
        penaltyMax: options.catalystPenaltyMax,
        sizeFactorMin: options.catalystSizeFactorMin,
      })
    );
  }
  return strongest;
}

export class MarketSelector {
  private minLiquidity: number;
  private minVolume24h: number;
  private maxSpread: number;
  private minOrders: number;
  private polymarketRewardMinFitScore: number;
  private polymarketRewardMinDailyRate: number;
  private polymarketRewardMinEfficiency: number;
  private polymarketRewardMinNetEfficiency: number;
  private polymarketRewardNetCostBpsMultiplier: number;
  private polymarketRewardRequireFit: boolean;
  private polymarketRewardRequireEnabled: boolean;
  private polymarketRewardMaxQueueMultiple: number;
  private polymarketRewardCrowdingPenaltyStart: number;
  private polymarketRewardCrowdingPenaltyMax: number;
  private polymarketRewardMinQueueHours: number;
  private polymarketRewardFastFlowPenaltyMax: number;
  private polymarketRewardTargetQueueHours: number;
  private polymarketRewardTargetQueueTolerance: number;
  private polymarketRewardTargetPenaltyMax: number;
  private polymarketObservedQueueStats: Map<string, { filled?: number; cancelRate?: number; avgFillLifetimeMs?: number }>;
  private polymarketObservedQueueMinSamples: number;
  private polymarketObservedQueueMaxWeight: number;
  private polymarketRecentRiskBlockPenalty: number;
  private polymarketRecentRiskPenalty: Map<
    string,
    {
      penalty: number;
      reason: string;
      cooldownRemainingMs?: number;
      cooldownReason?: string;
      fillPenaltyBps?: number;
      riskThrottleFactor?: number;
      cancelRate?: number;
      avgCancelLifetimeMs?: number;
      avgFillLifetimeMs?: number;
      cancelPenalty?: number;
      lifetimePenalty?: number;
      cancelNearTouch?: number;
      cancelRefresh?: number;
      cancelVwap?: number;
      cancelAggressive?: number;
      cancelUnsafe?: number;
    }
  >;
  private polymarketHourRiskPenalty: { penalty: number; reason: string; hour: number };
  private polymarketHourlyMarketRiskPenalty: Map<string, { penalty: number; reason: string; hour: number }>;
  private polymarketHourRiskBlockPenalty: number;
  private polymarketHourRiskSizeFactorMin: number;
  private polymarketEventRiskPenaltyWithinMs: number;
  private polymarketEventRiskBlockWithinMs: number;
  private polymarketEventRiskPenaltyMax: number;
  private polymarketEventRiskSizeFactorMin: number;
  private polymarketCatalystRiskPenaltyWithinMs: number;
  private polymarketCatalystRiskBlockWithinMs: number;
  private polymarketCatalystRiskPenaltyMax: number;
  private polymarketCatalystRiskSizeFactorMin: number;
  private polymarketPatternMemoryPenalty: Map<
    string,
    {
      penalty: number;
      reason: string;
      dominance?: number;
      dominantReason?: string;
      ageMs?: number;
      ttlRemainingMs?: number;
      decayFactor?: number;
      reasonMix?: Record<string, number>;
      learnedRetreatMix?: Record<string, number>;
      learnedSizeMix?: Record<string, number>;
      learnedRetreat?: number;
      learnedSize?: number;
    }
  >;
  private polymarketPatternMemoryBlockPenalty: number;

  constructor(
    minLiquidity: number = 100,
    minVolume24h: number = 500,
    maxSpread: number = 0.15,
    minOrders: number = 3,
    options: MarketSelectorOptions = {}
  ) {
    this.minLiquidity = minLiquidity;
    this.minVolume24h = minVolume24h;
    this.maxSpread = maxSpread;
    this.minOrders = minOrders;
    this.polymarketRewardMinFitScore = options.polymarketRewardMinFitScore ?? 0.6;
    this.polymarketRewardMinDailyRate = options.polymarketRewardMinDailyRate ?? 0;
    this.polymarketRewardMinEfficiency = options.polymarketRewardMinEfficiency ?? 0.0015;
    this.polymarketRewardMinNetEfficiency = options.polymarketRewardMinNetEfficiency ?? 0.0008;
    this.polymarketRewardNetCostBpsMultiplier = options.polymarketRewardNetCostBpsMultiplier ?? 1;
    this.polymarketRewardRequireFit = options.polymarketRewardRequireFit !== false;
    this.polymarketRewardRequireEnabled = options.polymarketRewardRequireEnabled === true;
    this.polymarketRewardMaxQueueMultiple = options.polymarketRewardMaxQueueMultiple ?? 12;
    this.polymarketRewardCrowdingPenaltyStart = options.polymarketRewardCrowdingPenaltyStart ?? 4;
    this.polymarketRewardCrowdingPenaltyMax = options.polymarketRewardCrowdingPenaltyMax ?? 12;
    this.polymarketRewardMinQueueHours = options.polymarketRewardMinQueueHours ?? 0.75;
    this.polymarketRewardFastFlowPenaltyMax = options.polymarketRewardFastFlowPenaltyMax ?? 8;
    this.polymarketRewardTargetQueueHours = options.polymarketRewardTargetQueueHours ?? 1.5;
    this.polymarketRewardTargetQueueTolerance = options.polymarketRewardTargetQueueTolerance ?? 0.5;
    this.polymarketRewardTargetPenaltyMax = options.polymarketRewardTargetPenaltyMax ?? 6;
    this.polymarketObservedQueueStats = options.polymarketObservedQueueStats ?? new Map();
    this.polymarketObservedQueueMinSamples = options.polymarketObservedQueueMinSamples ?? 3;
    this.polymarketObservedQueueMaxWeight = options.polymarketObservedQueueMaxWeight ?? 0.65;
    this.polymarketRecentRiskBlockPenalty = options.polymarketRecentRiskBlockPenalty ?? 12;
    this.polymarketRecentRiskPenalty = options.polymarketRecentRiskPenalty ?? new Map();
    this.polymarketHourRiskPenalty = options.polymarketHourRiskPenalty ?? { penalty: 0, reason: '', hour: new Date().getHours() };
    this.polymarketHourlyMarketRiskPenalty = options.polymarketHourlyMarketRiskPenalty ?? new Map();
    this.polymarketHourRiskBlockPenalty = options.polymarketHourRiskBlockPenalty ?? 6;
    this.polymarketHourRiskSizeFactorMin = options.polymarketHourRiskSizeFactorMin ?? 0.55;
    this.polymarketEventRiskPenaltyWithinMs = options.polymarketEventRiskPenaltyWithinMs ?? 4 * 60 * 60 * 1000;
    this.polymarketEventRiskBlockWithinMs = options.polymarketEventRiskBlockWithinMs ?? 30 * 60 * 1000;
    this.polymarketEventRiskPenaltyMax = options.polymarketEventRiskPenaltyMax ?? 6;
    this.polymarketEventRiskSizeFactorMin = options.polymarketEventRiskSizeFactorMin ?? 0.45;
    this.polymarketCatalystRiskPenaltyWithinMs = options.polymarketCatalystRiskPenaltyWithinMs ?? 90 * 60 * 1000;
    this.polymarketCatalystRiskBlockWithinMs = options.polymarketCatalystRiskBlockWithinMs ?? 10 * 60 * 1000;
    this.polymarketCatalystRiskPenaltyMax = options.polymarketCatalystRiskPenaltyMax ?? 7;
    this.polymarketCatalystRiskSizeFactorMin = options.polymarketCatalystRiskSizeFactorMin ?? 0.35;
    this.polymarketPatternMemoryPenalty = options.polymarketPatternMemoryPenalty ?? new Map();
    this.polymarketPatternMemoryBlockPenalty = options.polymarketPatternMemoryBlockPenalty ?? 6;
  }

  selectMarkets(markets: Market[], orderbooks: Map<string, Orderbook>): MarketScore[] {
    const scoredMarkets: MarketScore[] = [];

    for (const market of markets) {
      const orderbook = orderbooks.get(market.token_id);
      if (!orderbook || !orderbook.mid_price) {
        continue;
      }

      const score = this.scoreMarket(market, orderbook);
      if (score.score > 0) {
        scoredMarkets.push(score);
      }
    }

    scoredMarkets.sort((a, b) => b.score - a.score);
    return scoredMarkets;
  }

  private scoreMarket(market: Market, orderbook: Orderbook): MarketScore {
    const reasons: string[] = [];
    const liquidity = Number(market.liquidity_24h || 0);
    const volume = Number(market.volume_24h || 0);
    const totalOrders = (orderbook.bids?.length || 0) + (orderbook.asks?.length || 0);
    const spreadPct = orderbook.spread_pct ?? 999;
    const levels = this.getLevelLiquidity(orderbook);
    const supportRatio = Math.min(this.getSupportRatio(orderbook, 'bids'), this.getSupportRatio(orderbook, 'asks'));
    const levelGap = Math.max(this.getLevelGap(orderbook, 'bids'), this.getLevelGap(orderbook, 'asks'));
    const symmetry = this.getBookSymmetry(orderbook);
    const mid = Number(orderbook.mid_price || 0);
    const rewardProfile = this.getPolymarketRewardProfile(market, orderbook);
    const recentRisk = this.polymarketRecentRiskPenalty.get(market.token_id);
    const hourRisk = this.polymarketHourRiskPenalty;
    const marketHourRisk = this.polymarketHourlyMarketRiskPenalty.get(market.token_id);
    const patternMemory = this.polymarketPatternMemoryPenalty.get(market.token_id);
    const eventRisk = evaluatePolymarketEventRisk(market, {
      penaltyWithinMs: this.polymarketEventRiskPenaltyWithinMs,
      blockWithinMs: this.polymarketEventRiskBlockWithinMs,
      penaltyMax: this.polymarketEventRiskPenaltyMax,
      sizeFactorMin: this.polymarketEventRiskSizeFactorMin,
      catalystPenaltyWithinMs: this.polymarketCatalystRiskPenaltyWithinMs,
      catalystBlockWithinMs: this.polymarketCatalystRiskBlockWithinMs,
      catalystPenaltyMax: this.polymarketCatalystRiskPenaltyMax,
      catalystSizeFactorMin: this.polymarketCatalystRiskSizeFactorMin,
    });

    market.polymarket_recent_risk_penalty = recentRisk?.penalty;
    market.polymarket_recent_risk_reason = recentRisk?.reason;
    market.polymarket_recent_risk_cooldown_remaining_ms = recentRisk?.cooldownRemainingMs;
    market.polymarket_recent_risk_cooldown_reason = recentRisk?.cooldownReason;
    market.polymarket_recent_fill_penalty_bps = recentRisk?.fillPenaltyBps;
    market.polymarket_recent_risk_throttle_factor = recentRisk?.riskThrottleFactor;
    market.polymarket_recent_cancel_rate = recentRisk?.cancelRate;
    market.polymarket_recent_avg_cancel_lifetime_ms = recentRisk?.avgCancelLifetimeMs;
    market.polymarket_recent_avg_fill_lifetime_ms = recentRisk?.avgFillLifetimeMs;
    market.polymarket_recent_cancel_penalty = recentRisk?.cancelPenalty;
    market.polymarket_recent_lifetime_penalty = recentRisk?.lifetimePenalty;
    market.polymarket_recent_cancel_near_touch = recentRisk?.cancelNearTouch;
    market.polymarket_recent_cancel_refresh = recentRisk?.cancelRefresh;
    market.polymarket_recent_cancel_vwap = recentRisk?.cancelVwap;
    market.polymarket_recent_cancel_aggressive = recentRisk?.cancelAggressive;
    market.polymarket_recent_cancel_unsafe = recentRisk?.cancelUnsafe;
    market.polymarket_pattern_memory_penalty = patternMemory?.penalty;
    market.polymarket_pattern_memory_reason = patternMemory?.reason;
    market.polymarket_pattern_memory_dominance = patternMemory?.dominance;
    market.polymarket_pattern_memory_dominant_reason = patternMemory?.dominantReason;
    market.polymarket_pattern_memory_age_ms = patternMemory?.ageMs;
    market.polymarket_pattern_memory_ttl_remaining_ms = patternMemory?.ttlRemainingMs;
    market.polymarket_pattern_memory_decay_factor = patternMemory?.decayFactor;
    market.polymarket_pattern_memory_near_touch = patternMemory?.reasonMix?.nearTouch;
    market.polymarket_pattern_memory_refresh = patternMemory?.reasonMix?.refresh;
    market.polymarket_pattern_memory_vwap = patternMemory?.reasonMix?.vwap;
    market.polymarket_pattern_memory_aggressive = patternMemory?.reasonMix?.aggressive;
    market.polymarket_pattern_memory_unsafe = patternMemory?.reasonMix?.unsafe;
    market.polymarket_pattern_memory_learned_retreat = patternMemory?.learnedRetreat;
    market.polymarket_pattern_memory_learned_size = patternMemory?.learnedSize;
    market.polymarket_pattern_memory_learned_retreat_near_touch = patternMemory?.learnedRetreatMix?.nearTouch;
    market.polymarket_pattern_memory_learned_retreat_refresh = patternMemory?.learnedRetreatMix?.refresh;
    market.polymarket_pattern_memory_learned_retreat_vwap = patternMemory?.learnedRetreatMix?.vwap;
    market.polymarket_pattern_memory_learned_retreat_aggressive = patternMemory?.learnedRetreatMix?.aggressive;
    market.polymarket_pattern_memory_learned_retreat_unsafe = patternMemory?.learnedRetreatMix?.unsafe;
    market.polymarket_pattern_memory_learned_size_near_touch = patternMemory?.learnedSizeMix?.nearTouch;
    market.polymarket_pattern_memory_learned_size_refresh = patternMemory?.learnedSizeMix?.refresh;
    market.polymarket_pattern_memory_learned_size_vwap = patternMemory?.learnedSizeMix?.vwap;
    market.polymarket_pattern_memory_learned_size_aggressive = patternMemory?.learnedSizeMix?.aggressive;
    market.polymarket_pattern_memory_learned_size_unsafe = patternMemory?.learnedSizeMix?.unsafe;
    market.polymarket_hour_risk_penalty = hourRisk.penalty > 0 ? hourRisk.penalty : undefined;
    market.polymarket_hour_risk_reason = hourRisk.penalty > 0 ? hourRisk.reason : undefined;
    market.polymarket_market_hour_risk_penalty = marketHourRisk?.penalty;
    market.polymarket_market_hour_risk_reason = marketHourRisk?.reason;
    market.polymarket_event_risk_penalty = eventRisk.penalty > 0 ? eventRisk.penalty : undefined;
    market.polymarket_event_risk_reason = eventRisk.reason || undefined;
    market.polymarket_event_risk_source = eventRisk.source;
    market.polymarket_event_time_to_close_ms = eventRisk.timeToCloseMs;
    market.polymarket_event_time_to_catalyst_ms = eventRisk.timeToCatalystMs;
    market.polymarket_event_catalyst_label = eventRisk.catalystLabel || undefined;
    market.polymarket_event_risk_size_factor = eventRisk.sizeFactor < 1 ? eventRisk.sizeFactor : undefined;
    market.polymarket_reward_efficiency = rewardProfile.enabled ? rewardProfile.efficiency : undefined;
    market.polymarket_reward_net_efficiency = rewardProfile.enabled ? rewardProfile.netEfficiency : undefined;
    market.polymarket_reward_net_daily_rate = rewardProfile.enabled ? rewardProfile.netDailyRate : undefined;
    market.polymarket_reward_effective_net_efficiency = rewardProfile.enabled ? rewardProfile.effectiveNetEfficiency : undefined;
    market.polymarket_reward_effective_net_daily_rate = rewardProfile.enabled ? rewardProfile.effectiveNetDailyRate : undefined;
    market.polymarket_reward_estimated_cost_bps = rewardProfile.enabled ? rewardProfile.estimatedCostBps : undefined;
    market.polymarket_reward_queue_target_hours = rewardProfile.enabled ? rewardProfile.targetQueueHours : undefined;
    market.polymarket_reward_queue_target_factor = rewardProfile.enabled ? rewardProfile.targetQueueFactor : undefined;
    market.polymarket_reward_queue_target_penalty = rewardProfile.enabled ? rewardProfile.targetQueuePenalty : undefined;
    market.polymarket_reward_queue_target_reason = rewardProfile.enabled ? rewardProfile.targetQueueReason || undefined : undefined;
    market.polymarket_reward_queue_model = rewardProfile.enabled ? rewardProfile.queueModel : undefined;
    market.polymarket_reward_queue_confidence = rewardProfile.enabled ? rewardProfile.queueConfidence : undefined;
    market.polymarket_reward_observed_queue_hours = rewardProfile.enabled ? rewardProfile.observedQueueHours ?? undefined : undefined;

    if (market.venue === 'polymarket' && market.polymarket_enable_order_book === false) {
      return { market, score: 0, reasons: ['Polymarket 市场未启用 orderbook'] };
    }
    if (market.polymarket_accepting_orders === false) {
      return { market, score: 0, reasons: ['Polymarket 市场当前不接受下单'] };
    }
    if (market.venue === 'polymarket') {
      if (recentRisk?.cooldownRemainingMs && recentRisk.cooldownRemainingMs > 0) {
        return {
          market,
          score: 0,
          reasons: [
            `近期冷却中，剩余${formatDurationMs(recentRisk.cooldownRemainingMs)}: ${
              recentRisk.cooldownReason || recentRisk.reason
            }`,
          ],
        };
      }
      if (hourRisk.penalty >= this.polymarketHourRiskBlockPenalty) {
        return {
          market,
          score: 0,
          reasons: [hourRisk.reason],
        };
      }
      if ((marketHourRisk?.penalty || 0) >= this.polymarketHourRiskBlockPenalty) {
        return {
          market,
          score: 0,
          reasons: [marketHourRisk?.reason || '该市场当前时段风险过高'],
        };
      }
      if (eventRisk.block) {
        return {
          market,
          score: 0,
          reasons: [eventRisk.reason || '临近事件窗口，暂不推荐'],
        };
      }
      if (recentRisk && recentRisk.penalty >= this.polymarketRecentRiskBlockPenalty) {
        return {
          market,
          score: 0,
          reasons: [`近期风险过高，暂不推荐: ${recentRisk.reason}`],
        };
      }
      if (patternMemory && patternMemory.penalty >= this.polymarketPatternMemoryBlockPenalty) {
        return {
          market,
          score: 0,
          reasons: [`长期撤单模式风险过高，暂不推荐: ${patternMemory.reason}`],
        };
      }
      if (this.polymarketRewardRequireEnabled && !rewardProfile.enabled) {
        return { market, score: 0, reasons: ['Polymarket 市场无流动性激励，不纳入当前策略'] };
      }
      if (rewardProfile.enabled && rewardProfile.dailyRate < this.polymarketRewardMinDailyRate) {
        return {
          market,
          score: 0,
          reasons: [`激励日速率不足: ${rewardProfile.dailyRate.toFixed(0)} < ${this.polymarketRewardMinDailyRate.toFixed(0)}`],
        };
      }
      if (rewardProfile.enabled && rewardProfile.efficiency < this.polymarketRewardMinEfficiency) {
        return {
          market,
          score: 0,
          reasons: [
            `激励效率不足: ${(rewardProfile.efficiency * 100).toFixed(2)}%/日 < ${(
              this.polymarketRewardMinEfficiency * 100
            ).toFixed(2)}%/日`,
          ],
        };
      }
      if (rewardProfile.enabled && rewardProfile.effectiveNetEfficiency < this.polymarketRewardMinNetEfficiency) {
        return {
          market,
          score: 0,
          reasons: [
            `激励有效净效率不足: ${(rewardProfile.effectiveNetEfficiency * 100).toFixed(2)}%/日 < ${(
              this.polymarketRewardMinNetEfficiency * 100
            ).toFixed(2)}%/日`,
          ],
        };
      }
      if (rewardProfile.enabled && this.polymarketRewardRequireFit && rewardProfile.fitScore < this.polymarketRewardMinFitScore) {
        return {
          market,
          score: 0,
          reasons: [
            `激励适配度不足: ${(rewardProfile.fitScore * 100).toFixed(0)}% < ${(this.polymarketRewardMinFitScore * 100).toFixed(0)}%`,
          ],
        };
      }
    }
    if (liquidity < this.minLiquidity) {
      return { market, score: 0, reasons: [`流动性不足: $${liquidity.toFixed(0)} < $${this.minLiquidity}`] };
    }
    if (volume < this.minVolume24h) {
      return { market, score: 0, reasons: [`交易量不足: $${volume.toFixed(0)} < $${this.minVolume24h}`] };
    }
    if (totalOrders < this.minOrders) {
      return { market, score: 0, reasons: [`订单数不足: ${totalOrders} < ${this.minOrders}`] };
    }
    if (spreadPct > this.maxSpread * 100) {
      return { market, score: 0, reasons: [`价差过大: ${spreadPct.toFixed(2)}% > ${(this.maxSpread * 100).toFixed(2)}%`] };
    }
    if (levels.l1Usable <= 0) {
      return { market, score: 0, reasons: ['一档双边不完整，无法稳定挂单'] };
    }

    const liquidityScore = Math.log10(liquidity + 1) * 30;
    const volumeScore = Math.log10(volume + 1) * 14;
    const l1Score = Math.log10(levels.l1Usable + 1) * 14;
    const l2Score = levels.l2Usable > 0 ? Math.log10(levels.l2Usable + 1) * 12 : 0;
    const depthScore = Math.log10(levels.l1Total + levels.l2Total + 1) * 5;
    const spreadScore = Math.max(0, 14 * (1 - spreadPct / (this.maxSpread * 100)));
    const symmetryScore = symmetry * 8;
    const supportScore = Math.min(1, supportRatio) * 8;
    const centerScore = this.getCenterPriceScore(mid) * 6;
    const gapPenalty = levelGap > 0 ? Math.min(8, levelGap * 200) : 0;

    let score =
      liquidityScore +
      volumeScore +
      l1Score +
      l2Score +
      depthScore +
      spreadScore +
      symmetryScore +
      supportScore +
      centerScore -
      gapPenalty;

    const highLiquidityOverride = liquidity >= Math.max(this.minLiquidity * 20, 5000);

    if (levels.l2Usable <= 0) {
      score *= highLiquidityOverride ? 0.95 : 0.88;
      reasons.push(highLiquidityOverride ? '二档缺失，但总体流动性高，轻度降权' : '二档双边不完整，明显降权');
    } else if (levels.l2Usable < levels.l1Usable * 0.15) {
      score *= highLiquidityOverride ? 0.97 : 0.92;
      reasons.push('二档覆盖偏薄，降权');
    } else if (levels.l2Usable >= levels.l1Usable * 0.5) {
      score += 4;
      reasons.push('二档覆盖充足，加分');
    }

    if (supportRatio < 0.2) {
      score *= 0.9;
      reasons.push('二档支撑率偏弱，降权');
    }
    if (symmetry < 0.35) {
      score *= 0.92;
      reasons.push('盘口双边不对称，降权');
    }

    if (rewardProfile.enabled) {
      score += rewardProfile.bonus;
      reasons.push(`激励日速率: ${rewardProfile.dailyRate.toFixed(0)}`);
      reasons.push(`激励门槛: ${rewardProfile.minSize.toFixed(0)} 股 / ${(rewardProfile.maxSpread * 100).toFixed(2)}¢`);
      reasons.push(`激励适配度: ${(rewardProfile.fitScore * 100).toFixed(0)}%`);

      if (!rewardProfile.acceptingOrders) {
        score *= 0.8;
        reasons.push('激励市场当前不接受下单，明显降权');
      } else if (rewardProfile.fitScore >= 0.85) {
        score += 4;
        reasons.push('盘口与激励规则匹配，加分');
      } else if (rewardProfile.fitScore >= 0.6) {
        score += 2;
        reasons.push('激励较强，且一二档基本满足奖励条件');
      } else {
        score *= 0.94;
        reasons.push('有激励，但当前盘口/深度适配度一般，降权');
      }

      if (rewardProfile.spreadFit <= 0) {
        score *= 0.9;
        reasons.push('当前盘口宽于激励价差上限，降权');
      }
      if (rewardProfile.crowdingMultiple > this.polymarketRewardMaxQueueMultiple) {
        return {
          market,
          score: 0,
          reasons: [
            `奖励队列过厚: ${rewardProfile.crowdingMultiple.toFixed(1)}x > ${this.polymarketRewardMaxQueueMultiple.toFixed(1)}x`,
          ],
        };
      }
      if (rewardProfile.l2SizeFit < 0.6) {
        score *= 0.92;
        reasons.push('二档深度不足以稳定吃到激励，降权');
      }
      if (rewardProfile.crowdingPenalty > 0) {
        score -= rewardProfile.crowdingPenalty;
        reasons.push(
          `奖励队列过厚，降权: ${rewardProfile.crowdingMultiple.toFixed(1)}x min-size`
        );
      }
      if (rewardProfile.efficiencyBonus > 0) {
        score += rewardProfile.efficiencyBonus;
        reasons.push(
          `激励有效净效率: ${(rewardProfile.effectiveNetEfficiency * 100).toFixed(2)}%/日 (净 ${(rewardProfile.netEfficiency * 100).toFixed(2)}%，时段系数 ${rewardProfile.hourRiskFactor.toFixed(2)}x)`
        );
      }
      if (rewardProfile.fastFlowPenalty > 0 && Number.isFinite(rewardProfile.queueHours)) {
        score -= rewardProfile.fastFlowPenalty;
        reasons.push(
          `成交流速过快，降权: 队列约 ${rewardProfile.queueHours.toFixed(2)}h / ${rewardProfile.flowToQueuePerHour.toFixed(2)}x每小时`
        );
      }
      if (rewardProfile.targetQueuePenalty > 0) {
        score -= rewardProfile.targetQueuePenalty;
        reasons.push(`目标排队位置偏离，降权: ${rewardProfile.targetQueueReason}`);
      }
    }

    // Predict.fun LP 积分奖励评分（PP/hr）
    // API 目前没有暴露精确 PP/hr 字段，先用 is_yield_bearing / is_boosted 做 fallback
    const predictPpHr = Number(market.lp_reward_pp_hr || 0);
    const hasPredictReward = market.venue === 'predict' && (predictPpHr > 0 || market.is_yield_bearing || market.is_boosted);
    if (hasPredictReward) {
      if (predictPpHr > 0) {
        // API 返回了精确 PP/hr，直接用
        const ppBonus = Math.log10(predictPpHr + 1) * 8;
        score += ppBonus;
        reasons.push(`Predict 积分: ${predictPpHr} PP/hr (+${ppBonus.toFixed(1)})`);
      } else if (market.is_boosted) {
        // Boosted 市场 = 最高权重
        score += 18;
        reasons.push('Predict Boosted 市场 (+18)');
      } else if (market.is_yield_bearing) {
        // Yield-bearing 市场 = 高权重
        score += 12;
        reasons.push('Predict Yield-bearing 市场 (+12)');
      }
    }

    if (recentRisk && recentRisk.penalty > 0) {
      score -= recentRisk.penalty;
      reasons.push(`近期风险记忆，降权: ${recentRisk.reason}`);
    }
    if (patternMemory && patternMemory.penalty > 0) {
      score -= patternMemory.penalty;
      reasons.push(
        `长期撤单模式，降权: ${patternMemory.reason}${
          patternMemory.ttlRemainingMs ? `（剩余约${formatDurationMs(patternMemory.ttlRemainingMs)}）` : ''
        }`
      );
    }
    if (hourRisk.penalty > 0) {
      score -= hourRisk.penalty;
      reasons.push(`分时段风险，降权: ${hourRisk.reason}`);
    }
    if (eventRisk.penalty > 0) {
      score -= eventRisk.penalty;
      reasons.push(eventRisk.reason || '临近事件窗口，降权');
    }

    reasons.push(`24h流动性: $${liquidity.toFixed(0)}`);
    reasons.push(`24h交易量: $${volume.toFixed(0)}`);
    reasons.push(`一档可挂: $${levels.l1Usable.toFixed(2)}`);
    reasons.push(`二档可挂: $${levels.l2Usable.toFixed(2)}`);
    reasons.push(`一档双边: $${levels.l1Total.toFixed(2)}`);
    reasons.push(`二档双边: $${levels.l2Total.toFixed(2)}`);
    reasons.push(`盘口对称度: ${(symmetry * 100).toFixed(0)}%`);
    reasons.push(`二档支撑率: ${(supportRatio * 100).toFixed(0)}%`);
    reasons.push(`最大断层: ${(levelGap * 100).toFixed(2)}¢`);
    reasons.push(`订单数: ${totalOrders}`);
    reasons.push(`价差: ${spreadPct.toFixed(2)}%`);

    return { market, score, reasons };
  }

  private getPolymarketRewardProfile(market: Market, orderbook: Orderbook): PolymarketRewardProfile {
    const dailyRate = Number(market.polymarket_reward_daily_rate || 0);
    const minSize = Number(market.polymarket_reward_min_size || 0);
    const maxSpread = Number(market.polymarket_reward_max_spread || 0);
    const enabled = Boolean(market.polymarket_rewards_enabled) && dailyRate > 0 && minSize > 0 && maxSpread > 0;
    const bid1Shares = this.getLevelShares(orderbook.bids, 0, 'bids') || 0;
    const ask1Shares = this.getLevelShares(orderbook.asks, 0, 'asks') || 0;
    const bid2Shares = this.getLevelShares(orderbook.bids, 1, 'bids') || 0;
    const ask2Shares = this.getLevelShares(orderbook.asks, 1, 'asks') || 0;
    const l1MinShares = bid1Shares > 0 && ask1Shares > 0 ? Math.min(bid1Shares, ask1Shares) : 0;
    const l2MinShares = bid2Shares > 0 && ask2Shares > 0 ? Math.min(bid2Shares, ask2Shares) : 0;
    const spread = Number(orderbook.spread || 0);

    if (!enabled) {
      return {
        enabled: false,
        acceptingOrders: market.polymarket_accepting_orders !== false,
        minSize,
        maxSpread,
        dailyRate,
        hourlyRate: dailyRate > 0 ? dailyRate / 24 : 0,
        l1SizeFit: 0,
        l2SizeFit: 0,
        spreadFit: 0,
        fitScore: 0,
        bonus: 0,
        crowdingMultiple: 0,
        crowdingPenalty: 0,
        capitalEstimateUsd: 0,
        efficiency: 0,
        netEfficiency: 0,
        netDailyRate: 0,
        effectiveNetEfficiency: 0,
        effectiveNetDailyRate: 0,
        estimatedCostBps: 0,
        riskThrottleFactor: 1,
        hourRiskFactor: 1,
        efficiencyBonus: 0,
        queueAheadShares: 0,
        hourlyTurnoverShares: 0,
        queueHours: 0,
        flowToQueuePerHour: 0,
        queueModel: 'volume-24h',
        queueConfidence: 0.25,
        observedQueueHours: null,
        fastFlowPenalty: 0,
        targetQueueHours: this.polymarketRewardTargetQueueHours,
        targetQueueFactor: 1,
        targetQueuePenalty: 0,
        targetQueueReason: '',
      };
    }

    const l1SizeFit = clamp(l1MinShares / minSize, 0, 1.25);
    const l2SizeFit = clamp(l2MinShares / minSize, 0, 1.25);
    const spreadFit = spread > 0 ? clamp(1 - spread / maxSpread, 0, 1) : 0;
    const fitScore = clamp(0.3 * spreadFit + 0.25 * (l1SizeFit / 1.25) + 0.45 * (l2SizeFit / 1.25), 0, 1.1);
    const rewardStrength = Math.min(20, Math.log10(dailyRate + 1) * 4.5);
    const midPrice = Number(orderbook.mid_price || 0);
    const capitalEstimateUsd = midPrice > 0 ? minSize * midPrice * 2 : 0;
    const efficiency = capitalEstimateUsd > 0 ? dailyRate / capitalEstimateUsd : 0;
    const fillPenaltyBps = Math.max(0, Number(market.polymarket_recent_fill_penalty_bps || 0));
    const cancelPenalty = Math.max(0, Number(market.polymarket_recent_cancel_penalty || 0));
    const lifetimePenalty = Math.max(0, Number(market.polymarket_recent_lifetime_penalty || 0));
    const riskThrottleFactor = clamp(Number(market.polymarket_recent_risk_throttle_factor || 1), 0.1, 1);
    const estimatedCostBps =
      fillPenaltyBps * this.polymarketRewardNetCostBpsMultiplier + (cancelPenalty + lifetimePenalty) * 5;
    const netEfficiency = Math.max(0, efficiency - estimatedCostBps / 10000) * riskThrottleFactor;
    const netDailyRate = netEfficiency * capitalEstimateUsd;
    const globalHourPenaltyRatio =
      this.polymarketHourRiskPenalty.penalty > 0
        ? clamp(
            this.polymarketHourRiskPenalty.penalty / Math.max(this.polymarketHourRiskBlockPenalty, 1),
            0,
            1
          )
        : 0;
    const marketHourPenalty = Number(market.polymarket_market_hour_risk_penalty || 0);
    const marketHourPenaltyRatio =
      marketHourPenalty > 0
        ? clamp(marketHourPenalty / Math.max(this.polymarketHourRiskBlockPenalty, 1), 0, 1)
        : 0;
    const combinedHourPenaltyRatio = clamp(
      Math.max(globalHourPenaltyRatio, marketHourPenaltyRatio * 1.1),
      0,
      1
    );
    const hourRiskFactor = 1 - (1 - this.polymarketHourRiskSizeFactorMin) * combinedHourPenaltyRatio;
    const effectiveNetEfficiency = netEfficiency * hourRiskFactor;
    const effectiveNetDailyRate = effectiveNetEfficiency * capitalEstimateUsd;
    const efficiencyBonus = effectiveNetEfficiency > 0 ? Math.min(6, Math.log10(effectiveNetEfficiency * 100 + 1) * 4) : 0;
    const bonus = rewardStrength * (0.35 + 0.65 * fitScore);
    // For a second-layer quoting strategy, the practical queue ahead is the
    // first level plus the resting size already sitting on level two.
    const queueAheadShares = l1MinShares + l2MinShares;
    const crowdingMultiple = queueAheadShares / Math.max(1, minSize);
    const crowdingPenalty = clamp(
      Math.max(0, crowdingMultiple - this.polymarketRewardCrowdingPenaltyStart) * 1.6,
      0,
      this.polymarketRewardCrowdingPenaltyMax
    );
    const volumeBasedHourlyTurnoverShares = midPrice > 0 ? Number(market.volume_24h || 0) / midPrice / 24 : 0;
    const observedStats = this.polymarketObservedQueueStats.get(market.token_id);
    const observedQueueHours =
      observedStats && Number(observedStats.filled || 0) >= this.polymarketObservedQueueMinSamples && Number(observedStats.avgFillLifetimeMs || 0) > 0
        ? Number(observedStats.avgFillLifetimeMs) / 3600000
        : null;
    const observedTurnoverShares =
      observedQueueHours && observedQueueHours > 0 && queueAheadShares > 0 ? queueAheadShares / observedQueueHours : 0;
    const observedBaseWeight =
      observedQueueHours && observedQueueHours > 0
        ? clamp(Number(observedStats?.filled || 0) / Math.max(1, this.polymarketObservedQueueMinSamples), 0, 1)
        : 0;
    const observedWeight =
      observedTurnoverShares > 0
        ? clamp(
            observedBaseWeight * (1 - clamp(Number(observedStats?.cancelRate || 0) * 0.35, 0, 0.35)),
            0,
            this.polymarketObservedQueueMaxWeight
          )
        : 0;
    const hourlyTurnoverShares =
      observedWeight > 0 && observedTurnoverShares > 0
        ? volumeBasedHourlyTurnoverShares * (1 - observedWeight) + observedTurnoverShares * observedWeight
        : volumeBasedHourlyTurnoverShares;
    const queueHours =
      queueAheadShares > 0 && hourlyTurnoverShares > 0 ? queueAheadShares / hourlyTurnoverShares : Number.POSITIVE_INFINITY;
    const flowToQueuePerHour =
      queueAheadShares > 0 && hourlyTurnoverShares > 0 ? hourlyTurnoverShares / queueAheadShares : 0;
    const queueModel =
      observedWeight > 0.5 ? 'observed' : observedWeight > 0 ? 'blended' : 'volume-24h';
    const queueConfidence = observedWeight > 0 ? clamp(0.35 + observedWeight, 0, 1) : 0.25;
    const fastFlowPenalty =
      Number.isFinite(queueHours) && queueHours < this.polymarketRewardMinQueueHours
        ? clamp(
            ((this.polymarketRewardMinQueueHours - queueHours) / Math.max(this.polymarketRewardMinQueueHours, 0.01)) *
              this.polymarketRewardFastFlowPenaltyMax,
            0,
            this.polymarketRewardFastFlowPenaltyMax
          )
        : 0;
    const targetQueueHours = Math.max(0, this.polymarketRewardTargetQueueHours);
    const targetTolerance = Math.max(0, this.polymarketRewardTargetQueueTolerance);
    const lowerQueueHours = targetQueueHours > 0 ? targetQueueHours * Math.max(0.1, 1 - targetTolerance) : 0;
    const upperQueueHours = targetQueueHours > 0 ? targetQueueHours * (1 + targetTolerance) : 0;
    let targetQueueFactor = 1;
    let targetQueuePenalty = 0;
    let targetQueueReason = '';
    if (targetQueueHours > 0) {
      if (!Number.isFinite(queueHours) || queueHours <= 0) {
        targetQueueFactor = 0.35;
        targetQueuePenalty = this.polymarketRewardTargetPenaltyMax;
        targetQueueReason = `排队过浅，目标约 ${targetQueueHours.toFixed(2)}h，当前无法形成稳定队列`;
      } else if (queueHours < lowerQueueHours) {
        const ratio = clamp((lowerQueueHours - queueHours) / Math.max(lowerQueueHours, 0.01), 0, 1);
        targetQueueFactor = clamp(1 - 0.65 * ratio, 0.35, 1);
        targetQueuePenalty = ratio * this.polymarketRewardTargetPenaltyMax;
        targetQueueReason = `排队过浅，目标约 ${targetQueueHours.toFixed(2)}h，当前 ${queueHours.toFixed(2)}h`;
      } else if (queueHours > upperQueueHours) {
        const ratio = clamp((queueHours - upperQueueHours) / Math.max(upperQueueHours, 0.01), 0, 1.5);
        targetQueueFactor = clamp(1 - 0.5 * Math.min(1, ratio), 0.5, 1);
        targetQueuePenalty = Math.min(this.polymarketRewardTargetPenaltyMax, ratio * this.polymarketRewardTargetPenaltyMax * 0.7);
        targetQueueReason = `排队过深，目标约 ${targetQueueHours.toFixed(2)}h，当前 ${queueHours.toFixed(2)}h`;
      }
    }
    const adjustedEffectiveNetEfficiency = effectiveNetEfficiency * targetQueueFactor;
    const adjustedEffectiveNetDailyRate = adjustedEffectiveNetEfficiency * capitalEstimateUsd;
    const adjustedEfficiencyBonus =
      adjustedEffectiveNetEfficiency > 0 ? Math.min(6, Math.log10(adjustedEffectiveNetEfficiency * 100 + 1) * 4) : 0;

    return {
      enabled,
      acceptingOrders: market.polymarket_accepting_orders !== false,
      minSize,
      maxSpread,
      dailyRate,
      hourlyRate: dailyRate / 24,
      l1SizeFit,
      l2SizeFit,
      spreadFit,
      fitScore,
      bonus,
      crowdingMultiple,
      crowdingPenalty,
      capitalEstimateUsd,
      efficiency,
      netEfficiency,
      netDailyRate,
      effectiveNetEfficiency: adjustedEffectiveNetEfficiency,
      effectiveNetDailyRate: adjustedEffectiveNetDailyRate,
      estimatedCostBps,
      riskThrottleFactor,
      hourRiskFactor,
      efficiencyBonus: adjustedEfficiencyBonus,
      queueAheadShares,
      hourlyTurnoverShares,
      queueHours,
      flowToQueuePerHour,
      queueModel,
      queueConfidence,
      observedQueueHours,
      fastFlowPenalty,
      targetQueueHours,
      targetQueueFactor,
      targetQueuePenalty,
      targetQueueReason,
    };
  }

  evaluatePolymarketRewardFit(market: Market, orderbook: Orderbook): PolymarketRewardProfile {
    return this.getPolymarketRewardProfile(market, orderbook);
  }

  private getLevelLiquidity(orderbook: Orderbook): LevelLiquidity {
    const bid1 = this.getLevelNotional(orderbook.bids, 0, 'bids');
    const ask1 = this.getLevelNotional(orderbook.asks, 0, 'asks');
    const bid2 = this.getLevelNotional(orderbook.bids, 1, 'bids');
    const ask2 = this.getLevelNotional(orderbook.asks, 1, 'asks');

    return {
      bid1,
      ask1,
      bid2,
      ask2,
      l1Usable: bid1 > 0 && ask1 > 0 ? Math.min(bid1, ask1) : 0,
      l2Usable: bid2 > 0 && ask2 > 0 ? Math.min(bid2, ask2) : 0,
      l1Total: bid1 + ask1,
      l2Total: bid2 + ask2,
    };
  }

  private getLevelNotional(levels: OrderbookEntry[] | undefined, index: number, side: 'bids' | 'asks'): number {
    if (!Array.isArray(levels) || levels.length <= index) {
      return 0;
    }

    const sorted = [...levels].sort((a, b) => {
      const ap = Number(a.price || 0);
      const bp = Number(b.price || 0);
      return side === 'bids' ? bp - ap : ap - bp;
    });

    const level = sorted[index];
    if (!level) {
      return 0;
    }

    const price = Number(level.price || 0);
    const shares = Number(level.shares || 0);
    if (!Number.isFinite(price) || !Number.isFinite(shares) || price <= 0 || shares <= 0) {
      return 0;
    }

    return price * shares;
  }

  private getLevelGap(orderbook: Orderbook, side: 'bids' | 'asks'): number {
    const l1 = this.getLevelPrice(orderbook[side], 0, side);
    const l2 = this.getLevelPrice(orderbook[side], 1, side);
    if (l1 === null || l2 === null) {
      return Number.POSITIVE_INFINITY;
    }
    return side === 'bids' ? l1 - l2 : l2 - l1;
  }

  private getLevelPrice(levels: OrderbookEntry[] | undefined, index: number, side: 'bids' | 'asks'): number | null {
    if (!Array.isArray(levels) || levels.length <= index) {
      return null;
    }
    const sorted = [...levels].sort((a, b) => {
      const ap = Number(a.price || 0);
      const bp = Number(b.price || 0);
      return side === 'bids' ? bp - ap : ap - bp;
    });
    const level = sorted[index];
    if (!level) {
      return null;
    }
    const price = Number(level.price || 0);
    return Number.isFinite(price) && price > 0 ? price : null;
  }

  private getSupportRatio(orderbook: Orderbook, side: 'bids' | 'asks'): number {
    const l1 = this.getLevelShares(orderbook[side], 0, side);
    const l2 = this.getLevelShares(orderbook[side], 1, side);
    if (l1 === null || l2 === null || l1 <= 0 || l2 <= 0) {
      return 0;
    }
    return l2 / l1;
  }

  private getLevelShares(levels: OrderbookEntry[] | undefined, index: number, side: 'bids' | 'asks'): number | null {
    if (!Array.isArray(levels) || levels.length <= index) {
      return null;
    }
    const sorted = [...levels].sort((a, b) => {
      const ap = Number(a.price || 0);
      const bp = Number(b.price || 0);
      return side === 'bids' ? bp - ap : ap - bp;
    });
    const level = sorted[index];
    if (!level) {
      return null;
    }
    const shares = Number(level.shares || 0);
    return Number.isFinite(shares) && shares > 0 ? shares : null;
  }

  private getBookSymmetry(orderbook: Orderbook): number {
    const bid = this.getLevelNotional(orderbook.bids, 0, 'bids');
    const ask = this.getLevelNotional(orderbook.asks, 0, 'asks');
    if (bid <= 0 || ask <= 0) {
      return 0;
    }
    const minSide = Math.min(bid, ask);
    const maxSide = Math.max(bid, ask);
    return maxSide > 0 ? minSide / maxSide : 0;
  }

  private getCenterPriceScore(mid: number): number {
    if (!Number.isFinite(mid) || mid <= 0 || mid >= 1) {
      return 0;
    }
    const distance = Math.abs(mid - 0.5);
    return Math.max(0, 1 - distance / 0.45);
  }

  getTopMarkets(scoredMarkets: MarketScore[], count: number = 10): Market[] {
    return scoredMarkets.slice(0, count).map((s) => s.market);
  }

  printAnalysis(scoredMarkets: MarketScore[]): void {
    console.log('\n📊 市场分析（按真实可挂流动性、盘口质量与激励匹配度排序）:');
    console.log('─'.repeat(80));

    for (let i = 0; i < Math.min(10, scoredMarkets.length); i++) {
      const { market, score, reasons } = scoredMarkets[i];
      console.log(`\n#${i + 1} [总分: ${score.toFixed(1)}] ${(market.question || '').substring(0, 50)}...`);
      console.log(`   Token: ${market.token_id}`);
      for (const reason of reasons) {
        console.log(`   - ${reason}`);
      }
    }

    console.log('\n' + '─'.repeat(80));
  }
}
