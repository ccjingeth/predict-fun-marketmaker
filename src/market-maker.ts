/**
 * Market Maker Core
 * Production-oriented quoting + risk controls
 */

import type { Config, Market, Orderbook, Order, OrderbookEntry, Position } from './types.js';
import { PredictAPI } from './api/client.js';
import { OrderManager } from './order-manager.js';
import { ValueMismatchDetector } from './arbitrage/value-detector.js';
import { CrossPlatformAggregator } from './external/aggregator.js';
import { CrossPlatformExecutionRouter } from './external/execution.js';
import { findBestMatch } from './external/match.js';
import type { PlatformLeg, PlatformMarket } from './external/types.js';

interface QuotePrices {
  bidPrice: number;
  askPrice: number;
  midPrice: number;
  spread: number;
  inventoryBias: number;
  valueBias?: number;
  valueConfidence?: number;
}

interface OrderSizeResult {
  shares: number;
  usdt: number;
}

export class MarketMaker {
  private static readonly MIN_TICK = 0.0001;
  private static readonly MAX_ALLOWED_BOOK_SPREAD = 0.2;

  private readonly api: PredictAPI;
  private readonly config: Config;

  private openOrders: Map<string, Order> = new Map();
  private positions: Map<string, Position> = new Map();
  private lastPrices: Map<string, number> = new Map();
  private lastPriceAt: Map<string, number> = new Map();
  private volatilityEma: Map<string, number> = new Map();
  private depthEma: Map<string, number> = new Map();
  private lastDepth: Map<string, number> = new Map();
  private lastActionAt: Map<string, number> = new Map();
  private cooldownUntil: Map<string, number> = new Map();
  private pauseUntil: Map<string, number> = new Map();
  private lastNetShares: Map<string, number> = new Map();
  private lastHedgeAt: Map<string, number> = new Map();
  private lastIcebergAt: Map<string, number> = new Map();
  private valueDetector?: ValueMismatchDetector;
  private crossAggregator?: CrossPlatformAggregator;
  private crossExecutionRouter?: CrossPlatformExecutionRouter;

  private orderManager?: OrderManager;
  private tradingHalted = false;
  private sessionPnL = 0;
  private warnedNoExecution = false;

  constructor(api: PredictAPI, config: Config) {
    this.api = api;
    this.config = config;
    if (this.config.useValueSignal) {
      this.valueDetector = new ValueMismatchDetector(0, 0);
    }
    if (this.config.hedgeMode === 'CROSS' || this.config.crossPlatformEnabled) {
      this.crossAggregator = new CrossPlatformAggregator(this.config);
    }
  }

  async initialize(): Promise<void> {
    if (!this.config.enableTrading) {
      return;
    }

    if (!this.config.jwtToken) {
      throw new Error('ENABLE_TRADING=true requires JWT_TOKEN in .env');
    }

    this.orderManager = await OrderManager.create(this.config);
    console.log(`✅ OrderManager initialized (maker: ${this.orderManager.getMakerAddress()})`);

    if (this.config.hedgeMode === 'CROSS' && this.crossAggregator) {
      this.crossExecutionRouter = new CrossPlatformExecutionRouter(this.config, this.api, this.orderManager);
    }
  }

  async updateState(makerAddress: string): Promise<void> {
    try {
      const orders = await this.api.getOrders(makerAddress);
      this.openOrders.clear();
      for (const order of orders) {
        if (order.status === 'OPEN') {
          this.openOrders.set(order.order_hash, order);
        }
      }

      const positionsData = await this.api.getPositions(makerAddress);
      this.positions.clear();

      for (const pos of positionsData) {
        const tokenId = String(pos.token_id ?? pos.tokenId ?? pos.market?.tokenId ?? '');
        if (!tokenId) {
          continue;
        }

        const current = this.positions.get(tokenId) || {
          token_id: tokenId,
          question: pos.question || pos.market?.question || 'Unknown',
          yes_amount: 0,
          no_amount: 0,
          total_value: 0,
          avg_entry_price: 0,
          current_price: 0,
          pnl: 0,
        };

        const outcome = String(pos.outcome ?? pos.side ?? '').toUpperCase();
        const size = Number(pos.amount ?? pos.shares ?? pos.size ?? 0);

        if (outcome === 'YES' || outcome === 'BUY_YES') {
          current.yes_amount += size;
        } else if (outcome === 'NO' || outcome === 'BUY_NO') {
          current.no_amount += size;
        } else {
          current.yes_amount += Number(pos.yes_amount ?? 0);
          current.no_amount += Number(pos.no_amount ?? 0);
        }

        current.total_value += Number(pos.total_value ?? pos.value ?? 0);
        current.avg_entry_price = Number(pos.avg_price ?? pos.avgEntryPrice ?? current.avg_entry_price);
        current.current_price = Number(pos.current_price ?? pos.currentPrice ?? current.current_price);
        current.pnl += Number(pos.pnl ?? 0);

        this.positions.set(tokenId, current);
      }

      this.sessionPnL = Array.from(this.positions.values()).reduce((sum, p) => sum + p.pnl, 0);

      const maxDailyLoss = this.getEffectiveMaxDailyLoss();
      if (this.sessionPnL <= -Math.abs(maxDailyLoss)) {
        if (!this.tradingHalted) {
          console.log(`🛑 Trading halted: session PnL ${this.sessionPnL.toFixed(2)} <= -${Math.abs(maxDailyLoss)}`);
        }
        this.tradingHalted = true;
      }

      console.log(
        `📈 State updated: ${this.openOrders.size} open orders, ${this.positions.size} positions, session PnL ${this.sessionPnL.toFixed(2)}`
      );

      if (this.config.hedgeOnFill && this.orderManager) {
        await this.detectAndHedgeFills();
      }
    } catch (error) {
      console.error('Error updating state:', error);
    }
  }

  shouldCancelOrders(tokenId: string, orderbook: Orderbook): boolean {
    const lastPrice = this.lastPrices.get(tokenId);
    if (!lastPrice || !orderbook.mid_price || lastPrice <= 0) {
      return false;
    }

    const priceChange = Math.abs(orderbook.mid_price - lastPrice) / lastPrice;
    const base = this.config.cancelThreshold;
    const mult = this.getVolatilityMultiplier(tokenId, this.config.mmCancelVolMultiplier ?? 2);
    const threshold = base / mult;
    if (priceChange > threshold) {
      return true;
    }

    const depthDropRatio = this.config.mmDepthDropRatio ?? 0;
    if (depthDropRatio > 0) {
      const currentDepth = this.getTopDepth(orderbook).shares;
      const lastDepth = this.lastDepth.get(tokenId);
      if (lastDepth && lastDepth > 0 && currentDepth / lastDepth < 1 - depthDropRatio) {
        return true;
      }
    }

    return false;
  }

  private getAdaptiveMinInterval(tokenId: string): number {
    const base = this.config.minOrderIntervalMs ?? 3000;
    if (this.config.mmAdaptiveParams === false) {
      return base;
    }
    const vol = this.volatilityEma.get(tokenId) ?? 0;
    const threshold = this.config.mmIntervalVolatilityBps ?? 0.01;
    const mult = this.config.mmIntervalVolMultiplier ?? 1.6;
    if (vol >= threshold) {
      return Math.round(base * mult);
    }
    return base;
  }

  private canSendAction(tokenId: string): boolean {
    const now = Date.now();
    const minInterval = this.getAdaptiveMinInterval(tokenId);
    const lastAt = this.lastActionAt.get(tokenId) || 0;
    const cooldownUntil = this.cooldownUntil.get(tokenId) || 0;
    return now - lastAt >= minInterval && now >= cooldownUntil;
  }

  private markAction(tokenId: string): void {
    this.lastActionAt.set(tokenId, Date.now());
  }

  private markCooldown(tokenId: string, durationMs: number): void {
    this.cooldownUntil.set(tokenId, Date.now() + durationMs);
  }

  private isPaused(tokenId: string): boolean {
    const until = this.pauseUntil.get(tokenId) || 0;
    return Date.now() < until;
  }

  private pauseForVolatility(tokenId: string): void {
    const pauseMs = this.config.pauseAfterVolatilityMs ?? 8000;
    this.pauseUntil.set(tokenId, Date.now() + pauseMs);
  }

  private parseShares(entry?: OrderbookEntry): number {
    if (!entry) {
      return 0;
    }

    const shares = Number(entry.shares);
    return Number.isFinite(shares) && shares > 0 ? shares : 0;
  }

  private calculateMicroPrice(orderbook: Orderbook): number | null {
    const bestBid = orderbook.best_bid;
    const bestAsk = orderbook.best_ask;

    if (bestBid === undefined || bestAsk === undefined) {
      return null;
    }

    const topBidShares = this.parseShares(orderbook.bids[0]);
    const topAskShares = this.parseShares(orderbook.asks[0]);

    if (topBidShares > 0 && topAskShares > 0) {
      return (bestAsk * topBidShares + bestBid * topAskShares) / (topBidShares + topAskShares);
    }

    return (bestBid + bestAsk) / 2;
  }

  private calculateOrderbookImbalance(orderbook: Orderbook): number {
    const levels = Math.max(1, this.config.mmImbalanceLevels ?? 3);
    const bids = orderbook.bids.slice(0, levels);
    const asks = orderbook.asks.slice(0, levels);
    let bidShares = 0;
    let askShares = 0;
    for (const entry of bids) {
      bidShares += this.parseShares(entry);
    }
    for (const entry of asks) {
      askShares += this.parseShares(entry);
    }
    const total = bidShares + askShares;
    if (total <= 0) {
      return 0;
    }
    return this.clamp((bidShares - askShares) / total, -1, 1);
  }

  private getVolatilityMultiplier(tokenId: string, multiplier: number): number {
    const vol = this.volatilityEma.get(tokenId) ?? 0;
    if (!multiplier || multiplier <= 0) {
      return 1;
    }
    return 1 + vol * multiplier;
  }

  private checkVolatility(tokenId: string, orderbook: Orderbook): boolean {
    if (!orderbook.mid_price) {
      return false;
    }

    const lastMid = this.lastPrices.get(tokenId);
    const lastAt = this.lastPriceAt.get(tokenId) || 0;
    const lookback = this.config.volatilityLookbackMs ?? 10000;

    if (!lastMid || Date.now() - lastAt > lookback) {
      return false;
    }

    const change = Math.abs(orderbook.mid_price - lastMid) / lastMid;
    const threshold = this.config.volatilityPauseBps ?? 0.01;

    if (change >= threshold) {
      this.pauseForVolatility(tokenId);
      return true;
    }

    return false;
  }

  private evaluateOrderRisk(order: Order, orderbook: Orderbook): { cancel: boolean; panic: boolean; reason: string } {
    const refreshMs = this.config.mmOrderRefreshMs ?? 0;
    if (refreshMs > 0 && Date.now() - order.timestamp > refreshMs) {
      return { cancel: true, panic: false, reason: 'refresh' };
    }

    const price = Number(order.price);
    if (!Number.isFinite(price) || price <= 0) {
      return { cancel: true, panic: true, reason: 'invalid price' };
    }

    const bestBid = orderbook.best_bid;
    const bestAsk = orderbook.best_ask;
    if (bestBid === undefined || bestAsk === undefined) {
      return { cancel: false, panic: false, reason: '' };
    }

    const nearTouchBase = this.config.nearTouchBps ?? 0.0015;
    const antiFillBase = this.config.antiFillBps ?? 0.002;
    const nearMult = this.getVolatilityMultiplier(order.token_id, this.config.mmNearTouchVolMultiplier ?? 1.5);
    const antiMult = this.getVolatilityMultiplier(order.token_id, this.config.mmAntiFillVolMultiplier ?? 1.5);
    const nearTouch = nearTouchBase * nearMult;
    const antiFill = antiFillBase * antiMult;

    if (order.side === 'BUY') {
      const distance = (bestAsk - price) / price;
      if (distance <= antiFill) {
        return { cancel: true, panic: true, reason: 'anti-fill' };
      }
      if (distance <= nearTouch) {
        return { cancel: true, panic: false, reason: 'near-touch' };
      }
    } else {
      const distance = (price - bestBid) / price;
      if (distance <= antiFill) {
        return { cancel: true, panic: true, reason: 'anti-fill' };
      }
      if (distance <= nearTouch) {
        return { cancel: true, panic: false, reason: 'near-touch' };
      }
    }

    return { cancel: false, panic: false, reason: '' };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private getAccountEquityUsd(): number {
    const equity = this.config.mmAccountEquityUsd ?? 0;
    if (equity > 0) {
      return equity;
    }
    const positionsValue = Array.from(this.positions.values()).reduce((sum, p) => sum + (p.total_value || 0), 0);
    return Math.max(0, positionsValue);
  }

  private getEffectiveMaxPosition(): number {
    const pct = this.config.mmMaxPositionPct ?? 0;
    const equity = this.getAccountEquityUsd();
    if (pct > 0 && equity > 0) {
      return Math.max(1, equity * pct);
    }
    return Math.max(1, this.config.maxPosition);
  }

  private getEffectiveOrderSize(): number {
    const pct = this.config.mmOrderSizePct ?? 0;
    const equity = this.getAccountEquityUsd();
    if (pct > 0 && equity > 0) {
      return Math.max(1, equity * pct);
    }
    return this.config.orderSize;
  }

  private getEffectiveMaxSingleOrderValue(): number {
    const pct = this.config.mmMaxSingleOrderPct ?? 0;
    const equity = this.getAccountEquityUsd();
    if (pct > 0 && equity > 0) {
      return Math.max(1, equity * pct);
    }
    return this.config.maxSingleOrderValue ?? Number.POSITIVE_INFINITY;
  }

  private getEffectiveMaxDailyLoss(): number {
    const pct = this.config.mmMaxDailyLossPct ?? 0;
    const equity = this.getAccountEquityUsd();
    if (pct > 0 && equity > 0) {
      return Math.max(1, equity * pct);
    }
    return this.config.maxDailyLoss ?? 200;
  }

  private getTopDepth(orderbook: Orderbook): { shares: number; usd: number } {
    const levels = Math.max(1, this.config.mmDepthLevels ?? 1);
    const bids = orderbook.bids.slice(0, levels);
    const asks = orderbook.asks.slice(0, levels);
    let shares = 0;
    let usd = 0;
    for (const entry of bids) {
      const s = this.parseShares(entry);
      const p = Number(entry.price);
      if (s > 0 && Number.isFinite(p)) {
        shares += s;
        usd += s * p;
      }
    }
    for (const entry of asks) {
      const s = this.parseShares(entry);
      const p = Number(entry.price);
      if (s > 0 && Number.isFinite(p)) {
        shares += s;
        usd += s * p;
      }
    }
    return { shares, usd };
  }

  private updateMarketMetrics(tokenId: string, orderbook: Orderbook): { volEma: number; depthEma: number; topDepth: number; topDepthUsd: number } {
    const micro = this.calculateMicroPrice(orderbook);
    if (micro && micro > 0) {
      const lastMid = this.lastPrices.get(tokenId);
      const alpha = this.config.mmVolEmaAlpha ?? 0.2;
      if (lastMid && lastMid > 0) {
        const ret = Math.abs(micro - lastMid) / lastMid;
        const prev = this.volatilityEma.get(tokenId) ?? 0;
        const next = prev === 0 ? ret : prev * (1 - alpha) + ret * alpha;
        this.volatilityEma.set(tokenId, next);
      }
    }

    const depth = this.getTopDepth(orderbook);
    const depthAlpha = this.config.mmDepthEmaAlpha ?? 0.2;
    const prevDepth = this.depthEma.get(tokenId) ?? 0;
    const nextDepth = prevDepth === 0 ? depth.shares : prevDepth * (1 - depthAlpha) + depth.shares * depthAlpha;
    this.depthEma.set(tokenId, nextDepth);
    this.lastDepth.set(tokenId, depth.shares);

    return {
      volEma: this.volatilityEma.get(tokenId) ?? 0,
      depthEma: nextDepth,
      topDepth: depth.shares,
      topDepthUsd: depth.usd,
    };
  }

  private resolveAdaptiveProfile(volEma: number, depthEma: number): 'CALM' | 'NORMAL' | 'VOLATILE' {
    const configured = (this.config.mmAdaptiveProfile || 'AUTO').toUpperCase();
    if (configured === 'CALM' || configured === 'NORMAL' || configured === 'VOLATILE') {
      return configured;
    }
    const calm = this.config.mmVolatilityCalmBps ?? 0.004;
    const volatile = this.config.mmVolatilityVolatileBps ?? 0.02;
    const depthRef = this.config.mmDepthRefShares ?? 200;
    const depthRatio = depthRef > 0 ? depthEma / depthRef : 1;
    const low = this.config.mmProfileLiquidityLow ?? 0.5;
    const high = this.config.mmProfileLiquidityHigh ?? 1.2;
    if (depthRatio <= low) return 'VOLATILE';
    if (volEma >= volatile) return 'VOLATILE';
    if (volEma <= calm && depthRatio >= high) return 'CALM';
    return 'NORMAL';
  }

  private applyIceberg(shares: number): number {
    if (!this.config.mmIcebergEnabled) {
      return shares;
    }
    const ratio = this.config.mmIcebergRatio ?? 0.3;
    const chunkMax = this.config.mmIcebergMaxChunkShares ?? 15;
    const next = Math.max(1, Math.floor(shares * Math.max(0.05, ratio)));
    return Math.min(next, chunkMax);
  }

  private canRequoteIceberg(tokenId: string): boolean {
    const interval = this.config.mmIcebergRequoteMs ?? 4000;
    const last = this.lastIcebergAt.get(tokenId) || 0;
    if (Date.now() - last >= interval) {
      this.lastIcebergAt.set(tokenId, Date.now());
      return true;
    }
    return false;
  }

  private isLiquidityThin(metrics: { topDepth: number; topDepthUsd: number }): boolean {
    const minShares = this.config.mmMinTopDepthShares ?? 0;
    const minUsd = this.config.mmMinTopDepthUsd ?? 0;
    if (minShares > 0 && metrics.topDepth < minShares) {
      return true;
    }
    if (minUsd > 0 && metrics.topDepthUsd < minUsd) {
      return true;
    }
    return false;
  }

  private calculateInventoryBias(tokenId: string): number {
    const position = this.positions.get(tokenId);
    if (!position) {
      return 0;
    }

    const netShares = position.yes_amount - position.no_amount;
    const maxPosition = this.getEffectiveMaxPosition();
    const normalized = netShares / maxPosition;

    return this.clamp(normalized, -1, 1);
  }

  calculatePrices(market: Market, orderbook: Orderbook): QuotePrices | null {
    const bestBid = orderbook.best_bid;
    const bestAsk = orderbook.best_ask;

    if (bestBid === undefined || bestAsk === undefined) {
      return null;
    }

    if (bestBid <= 0 || bestAsk <= 0 || bestBid >= bestAsk) {
      return null;
    }

    const bookSpread = (bestAsk - bestBid) / ((bestAsk + bestBid) / 2);
    if (bookSpread > MarketMaker.MAX_ALLOWED_BOOK_SPREAD) {
      return null;
    }

    const microPrice = this.calculateMicroPrice(orderbook);
    if (!microPrice || microPrice <= 0 || microPrice >= 1) {
      return null;
    }

    const baseSpread = this.config.spread;
    let minSpread = this.config.minSpread ?? 0.01;
    let maxSpread = this.config.maxSpread ?? 0.08;

    const lastMid = this.lastPrices.get(market.token_id);
    const volatilityComponent =
      lastMid && lastMid > 0 ? Math.abs(microPrice - lastMid) / lastMid : 0;

    const volEma = this.volatilityEma.get(market.token_id) ?? volatilityComponent;
    const depthRef = this.config.mmDepthRefShares ?? 200;
    const depthEma = this.depthEma.get(market.token_id) ?? 0;
    const depthFactor =
      depthRef > 0 && depthEma > 0 ? this.clamp(depthEma / depthRef, 0.2, 3) : 1;
    const liquidityPenalty = depthFactor < 1 ? 1 / depthFactor - 1 : 0;

    const profile = this.resolveAdaptiveProfile(volEma, depthEma);
    if (this.config.mmAdaptiveParams !== false) {
      if (profile === 'CALM') {
        minSpread = this.config.mmProfileSpreadMinCalm ?? minSpread;
        maxSpread = this.config.mmProfileSpreadMaxCalm ?? maxSpread;
      } else if (profile === 'VOLATILE') {
        minSpread = this.config.mmProfileSpreadMinVolatile ?? minSpread;
        maxSpread = this.config.mmProfileSpreadMaxVolatile ?? maxSpread;
      }
    }

    const bookWeight = this.config.mmBookSpreadWeight ?? 0.35;
    const volWeight = this.config.mmSpreadVolWeight ?? 1.2;
    const liqWeight = this.config.mmSpreadLiquidityWeight ?? 0.5;

    let adaptiveSpread =
      this.config.mmAdaptiveParams === false
        ? baseSpread + bookSpread * 0.35 + volatilityComponent * 0.5
        : baseSpread * (1 + volEma * volWeight + liquidityPenalty * liqWeight) +
          bookSpread * bookWeight;

    if (market.liquidity_activation?.max_spread) {
      adaptiveSpread = Math.min(adaptiveSpread, market.liquidity_activation.max_spread * 0.95);
    }

    adaptiveSpread = this.clamp(adaptiveSpread, minSpread, maxSpread);

    const inventoryBias = this.calculateInventoryBias(market.token_id);
    let inventorySkewFactor = this.config.inventorySkewFactor ?? 0.15;
    const imbalance = this.calculateOrderbookImbalance(orderbook);
    if (this.config.mmAdaptiveParams !== false) {
      const volSkewWeight = this.config.mmInventorySkewVolWeight ?? 1.0;
      const liqSkewWeight = this.config.mmInventorySkewDepthWeight ?? 0.4;
      inventorySkewFactor =
        inventorySkewFactor * (1 + volEma * volSkewWeight + liquidityPenalty * liqSkewWeight);
    }

    let fairPrice = microPrice * (1 - inventoryBias * inventorySkewFactor * adaptiveSpread);
    if (this.config.mmAdaptiveParams !== false) {
      const imbalanceWeight = this.config.mmImbalanceWeight ?? 0.25;
      const imbalanceMax = this.config.mmImbalanceMaxSkew ?? 0.6;
      const skew = this.clamp(imbalance * imbalanceWeight, -imbalanceMax, imbalanceMax);
      fairPrice = fairPrice * (1 + skew * adaptiveSpread);
    }
    let valueBias = 0;
    let valueConfidence = 0;

    if (this.config.useValueSignal && this.valueDetector) {
      const analysis = this.valueDetector.analyzeMarket(market, orderbook);
      if (analysis) {
        const confidenceMin = this.config.valueConfidenceMin ?? 0.6;
        if (analysis.confidence >= confidenceMin) {
          const weight = this.config.valueSignalWeight ?? 0.35;
          const blend = this.clamp(weight * analysis.confidence, 0, 0.9);
          const valueFair = analysis.fairTokenPrice ?? analysis.estimatedProbability;
          const blended = fairPrice * (1 - blend) + valueFair * blend;
          valueBias = blended - fairPrice;
          valueConfidence = analysis.confidence;
          fairPrice = blended;
        }
      }
    }

    const inventorySpreadWeight = this.config.mmInventorySpreadWeight ?? 0.2;
    const imbalanceSpreadWeight = this.config.mmImbalanceSpreadWeight ?? 0.2;
    const spreadBoost =
      1 +
      Math.abs(inventoryBias) * inventorySpreadWeight +
      Math.abs(imbalance) * imbalanceSpreadWeight;
    const half = (adaptiveSpread * spreadBoost) / 2;

    let bid = fairPrice * (1 - half);
    let ask = fairPrice * (1 + half);

    // Keep maker-friendly but never cross top of book
    bid = Math.max(bid, bestBid + MarketMaker.MIN_TICK);
    ask = Math.min(ask, bestAsk - MarketMaker.MIN_TICK);

    bid = this.clamp(bid, 0.01, 0.99);
    ask = this.clamp(ask, 0.01, 0.99);

    if (bid >= ask - MarketMaker.MIN_TICK) {
      return null;
    }

    return {
      bidPrice: bid,
      askPrice: ask,
      midPrice: microPrice,
      spread: adaptiveSpread,
      inventoryBias,
      valueBias,
      valueConfidence,
    };
  }

  calculateOrderSize(market: Market, price: number): OrderSizeResult {
    if (!Number.isFinite(price) || price <= 0) {
      return { shares: 0, usdt: 0 };
    }

    const positionValue = this.positions.get(market.token_id)?.total_value || 0;
    const effectiveMaxPosition = this.getEffectiveMaxPosition();
    const remainingRiskBudget = Math.max(0, effectiveMaxPosition - positionValue);

    if (remainingRiskBudget <= 0) {
      return { shares: 0, usdt: 0 };
    }

    const effectiveOrderSize = this.getEffectiveOrderSize();
    const effectiveMaxSingle = this.getEffectiveMaxSingleOrderValue();
    const targetOrderValue = Math.min(effectiveOrderSize, effectiveMaxSingle, remainingRiskBudget);

    if (targetOrderValue <= 0) {
      return { shares: 0, usdt: 0 };
    }

    let shares = Math.floor(targetOrderValue / price);
    const depthUsage = this.config.mmOrderDepthUsage ?? 0;
    const topDepth = this.lastDepth.get(market.token_id);
    if (depthUsage > 0 && topDepth && topDepth > 0) {
      const cap = Math.max(1, Math.floor(topDepth * depthUsage));
      shares = Math.min(shares, cap);
    }

    const minShares = market.liquidity_activation?.min_shares || 0;
    if (minShares > 0 && shares < minShares) {
      const minOrderValue = minShares * price;
      const hardCap = this.config.maxSingleOrderValue ?? Number.POSITIVE_INFINITY;
      if (minOrderValue <= hardCap && minOrderValue <= remainingRiskBudget) {
        shares = minShares;
      }
    }

    if (shares <= 0) {
      return { shares: 0, usdt: 0 };
    }

    const usdt = shares * price;
    const maxSingleOrderValue = effectiveMaxSingle;

    if (usdt > maxSingleOrderValue) {
      const cappedShares = Math.max(0, Math.floor(maxSingleOrderValue / price));
      return {
        shares: cappedShares,
        usdt: cappedShares * price,
      };
    }

    return { shares, usdt };
  }

  checkLiquidityPointsEligibility(market: Market, orderbook: Orderbook): boolean {
    if (!market.liquidity_activation?.active) {
      return false;
    }

    if (market.liquidity_activation.max_spread_cents && orderbook.spread) {
      const maxSpread = market.liquidity_activation.max_spread_cents / 100;
      if (orderbook.spread > maxSpread) {
        return false;
      }
    }

    return true;
  }

  isNearBestPrice(
    price: number,
    side: 'BUY' | 'SELL',
    orderbook: Orderbook,
    threshold: number = 0.005
  ): boolean {
    const bestBid = orderbook.best_bid;
    const bestAsk = orderbook.best_ask;

    if (side === 'BUY' && bestBid && price >= bestBid * (1 - threshold)) {
      return true;
    }

    if (side === 'SELL' && bestAsk && price <= bestAsk * (1 + threshold)) {
      return true;
    }

    return false;
  }

  private shouldRepriceOrder(order: Order, targetPrice: number): boolean {
    const current = Number(order.price);
    if (!Number.isFinite(current) || current <= 0) {
      return true;
    }

    const diff = Math.abs(targetPrice - current) / current;
    const base = this.config.repriceThreshold ?? 0.003;
    const mult = this.getVolatilityMultiplier(order.token_id, this.config.mmRepriceVolMultiplier ?? 1.5);
    const threshold = base / mult;
    return diff >= threshold;
  }

  private getAdaptiveCooldown(tokenId: string, baseMs: number): number {
    if (this.config.mmAdaptiveParams === false) {
      return baseMs;
    }
    const mult = this.getVolatilityMultiplier(tokenId, this.config.mmCooldownVolMultiplier ?? 1.2);
    return Math.round(baseMs * mult);
  }

  private trimExcessOrders(tokenId: string, orders: Order[]): Order[] {
    const maxOrders = this.config.maxOrdersPerMarket ?? 2;
    if (orders.length <= maxOrders) {
      return orders;
    }

    const sorted = [...orders].sort((a, b) => b.timestamp - a.timestamp);
    const keep = sorted.slice(0, maxOrders);
    const cancel = sorted.slice(maxOrders);

    for (const order of cancel) {
      void this.cancelOrder(order);
    }

    return keep;
  }

  async placeMMOrders(market: Market, orderbook: Orderbook): Promise<void> {
    if (!this.config.enableTrading) {
      console.log('⚠️  Trading is disabled. Set ENABLE_TRADING=true to enable.');
      return;
    }

    if (this.tradingHalted) {
      console.log('🛑 Trading halted by risk controls.');
      return;
    }

    if (!this.orderManager) {
      if (!this.warnedNoExecution) {
        console.log('⚠️  OrderManager is not initialized, skip live order placement.');
        this.warnedNoExecution = true;
      }
      return;
    }

    const tokenId = market.token_id;

    if (this.isPaused(tokenId)) {
      return;
    }

    const metrics = this.updateMarketMetrics(tokenId, orderbook);

    if (!this.canSendAction(tokenId)) {
      return;
    }
    if (this.isLiquidityThin(metrics)) {
      console.log(`⚠️ Low liquidity for ${tokenId}, skipping quotes...`);
      await this.cancelOrdersForMarket(tokenId);
      this.markCooldown(tokenId, this.config.cooldownAfterCancelMs ?? 4000);
      this.markAction(tokenId);
      return;
    }

    const qualifiesForPoints = this.checkLiquidityPointsEligibility(market, orderbook);

    if (this.checkVolatility(tokenId, orderbook)) {
      console.log(`⚠️ Volatility spike detected for ${tokenId}, pausing quoting...`);
      await this.cancelOrdersForMarket(tokenId);
      this.markCooldown(tokenId, this.config.pauseAfterVolatilityMs ?? 8000);
      return;
    }

    if (this.shouldCancelOrders(tokenId, orderbook)) {
      console.log(`🚨 Price moved significantly for ${tokenId}, canceling orders...`);
      await this.cancelOrdersForMarket(tokenId);
      this.markCooldown(tokenId, this.config.cooldownAfterCancelMs ?? 4000);
      this.markAction(tokenId);
      return;
    }

    const prices = this.calculatePrices(market, orderbook);
    if (!prices) {
      return;
    }

    const profile = this.resolveAdaptiveProfile(metrics.volEma, metrics.depthEma);

    let existingOrders = Array.from(this.openOrders.values()).filter(
      (o) => o.token_id === tokenId && o.status === 'OPEN'
    );
    existingOrders = this.trimExcessOrders(tokenId, existingOrders);

    const existingBid = existingOrders.find((o) => o.side === 'BUY');
    const existingAsk = existingOrders.find((o) => o.side === 'SELL');

    if (existingBid) {
      const risk = this.evaluateOrderRisk(existingBid, orderbook);
      if (risk.cancel || this.shouldRepriceOrder(existingBid, prices.bidPrice)) {
        await this.cancelOrder(existingBid);
        const cooldown = this.getAdaptiveCooldown(tokenId, this.config.cooldownAfterCancelMs ?? 4000);
        if (risk.panic) {
          this.pauseForVolatility(tokenId);
          this.markCooldown(tokenId, cooldown + 2000);
        } else {
          this.markCooldown(tokenId, cooldown);
        }
      }
    }

    if (existingAsk) {
      const risk = this.evaluateOrderRisk(existingAsk, orderbook);
      if (risk.cancel || this.shouldRepriceOrder(existingAsk, prices.askPrice)) {
        await this.cancelOrder(existingAsk);
        const cooldown = this.getAdaptiveCooldown(tokenId, this.config.cooldownAfterCancelMs ?? 4000);
        if (risk.panic) {
          this.pauseForVolatility(tokenId);
          this.markCooldown(tokenId, cooldown + 2000);
        } else {
          this.markCooldown(tokenId, cooldown);
        }
      }
    }

    const refreshedOrders = Array.from(this.openOrders.values()).filter(
      (o) => o.token_id === tokenId && o.status === 'OPEN'
    );

    let hasBid = refreshedOrders.some((o) => o.side === 'BUY');
    let hasAsk = refreshedOrders.some((o) => o.side === 'SELL');

    const bidOrderSize = this.calculateOrderSize(market, prices.bidPrice);
    const askOrderSize = this.calculateOrderSize(market, prices.askPrice);

    const profileScale = profile === 'CALM' ? 1.0 : profile === 'VOLATILE' ? 0.6 : 0.85;
    const canIceberg = this.config.mmIcebergEnabled && this.canRequoteIceberg(tokenId);
    if (canIceberg) {
      await this.cancelOrdersForMarket(tokenId);
      hasBid = false;
      hasAsk = false;
    }

    console.log(`📝 Market ${market.question.substring(0, 40)}...`);
    const valueInfo =
      prices.valueConfidence && Math.abs(prices.valueBias ?? 0) > 0
        ? ` valueBias=${prices.valueBias?.toFixed(4)} conf=${(prices.valueConfidence * 100).toFixed(0)}%`
        : '';

    const imbalance = this.calculateOrderbookImbalance(orderbook);
    console.log(
      `   bid=${prices.bidPrice.toFixed(4)} ask=${prices.askPrice.toFixed(4)} spread=${(prices.spread * 100).toFixed(2)}% ` +
        `bias=${prices.inventoryBias.toFixed(2)} imb=${imbalance.toFixed(2)}${valueInfo} ${qualifiesForPoints ? '✨' : ''} profile=${profile}`
    );

    const suppressBuy = prices.inventoryBias > 0.85;
    const suppressSell = prices.inventoryBias < -0.85;

    let placed = false;
    if (!hasBid && !suppressBuy && bidOrderSize.shares > 0) {
      const targetShares = Math.max(1, Math.floor(bidOrderSize.shares * profileScale));
      const shares = this.applyIceberg(targetShares);
      await this.placeLimitOrder(market, 'BUY', prices.bidPrice, shares);
      placed = true;
    }

    if (!hasAsk && !suppressSell && askOrderSize.shares > 0) {
      const targetShares = Math.max(1, Math.floor(askOrderSize.shares * profileScale));
      const shares = this.applyIceberg(targetShares);
      await this.placeLimitOrder(market, 'SELL', prices.askPrice, shares);
      placed = true;
    }

    if (placed) {
      this.markAction(tokenId);
    }

    this.lastPrices.set(tokenId, prices.midPrice);
    this.lastPriceAt.set(tokenId, Date.now());
  }

  private async placeLimitOrder(
    market: Market,
    side: 'BUY' | 'SELL',
    price: number,
    shares: number
  ): Promise<void> {
    if (!this.orderManager) {
      return;
    }

    try {
      const payload = await this.orderManager.buildLimitOrderPayload({ market, side, price, shares });
      const response = await this.api.createOrder(payload);
      const orderHash =
        response?.order?.hash ||
        response?.data?.order?.hash ||
        payload?.data?.order?.hash ||
        `local-${Date.now()}`;

      this.openOrders.set(String(orderHash), {
        order_hash: String(orderHash),
        id: response?.id ? String(response.id) : undefined,
        token_id: market.token_id,
        maker: this.orderManager.getMakerAddress(),
        signer: this.orderManager.getSignerAddress(),
        order_type: 'LIMIT',
        side,
        price: price.toString(),
        shares: shares.toString(),
        is_neg_risk: market.is_neg_risk,
        is_yield_bearing: market.is_yield_bearing,
        status: 'OPEN',
        timestamp: Date.now(),
      });

      console.log(`✅ ${side} order submitted at ${price.toFixed(4)} (${shares} shares)`);
    } catch (error) {
      console.error(`Error placing ${side} order:`, error);
    }
  }

  async cancelOrdersForMarket(tokenId: string): Promise<void> {
    const ordersToCancel = Array.from(this.openOrders.values()).filter(
      (o) => o.token_id === tokenId && o.status === 'OPEN'
    );

    for (const order of ordersToCancel) {
      await this.cancelOrder(order);
    }
  }

  async cancelOrder(order: Order): Promise<void> {
    try {
      const id = order.id || order.order_hash;
      await this.api.removeOrders([id]);
      this.openOrders.delete(order.order_hash);
      console.log(`❌ Canceled ${order.order_hash.substring(0, 10)}...`);
    } catch (error) {
      console.error('Error canceling order:', error);
    }
  }

  async closePosition(tokenId: string): Promise<void> {
    const position = this.positions.get(tokenId);
    if (!position || !this.orderManager) {
      return;
    }

    try {
      const market = await this.api.getMarket(tokenId);
      const orderbook = await this.api.getOrderbook(tokenId);

      if (position.yes_amount > 0) {
        const payload = await this.orderManager.buildMarketOrderPayload({
          market,
          side: 'SELL',
          shares: position.yes_amount,
          orderbook,
          slippageBps: '250',
        });
        await this.api.createOrder(payload);
      }

      console.log(`✅ Position close request sent for ${tokenId}`);
    } catch (error) {
      console.error(`Error closing position ${tokenId}:`, error);
    }
  }

  private async detectAndHedgeFills(): Promise<void> {
    const triggerShares = this.config.hedgeTriggerShares ?? 50;
    if (this.lastNetShares.size === 0) {
      for (const [tokenId, position] of this.positions.entries()) {
        const net = position.yes_amount - position.no_amount;
        this.lastNetShares.set(tokenId, net);
      }
      return;
    }

    for (const [tokenId, position] of this.positions.entries()) {
      const net = position.yes_amount - position.no_amount;
      const prev = this.lastNetShares.get(tokenId) ?? 0;
      const delta = net - prev;
      if (Math.abs(delta) >= triggerShares) {
        await this.handleFillHedge(tokenId, delta, position.question);
      }
      this.lastNetShares.set(tokenId, net);
    }
  }

  private async handleFillHedge(tokenId: string, delta: number, question: string): Promise<void> {
    if (!this.orderManager) {
      return;
    }

    const lastHedge = this.lastHedgeAt.get(tokenId) || 0;
    if (Date.now() - lastHedge < (this.config.minOrderIntervalMs ?? 3000)) {
      return;
    }

    const mode = this.config.hedgeMode ?? 'FLATTEN';
    const shares = Math.abs(delta);

    if (mode === 'CROSS' && this.crossAggregator && this.crossExecutionRouter) {
      try {
        const hedgeLeg = await this.buildCrossHedgeLeg(tokenId, question, delta, shares);
        if (hedgeLeg) {
          await this.crossExecutionRouter.execute([hedgeLeg]);
          this.lastHedgeAt.set(tokenId, Date.now());
          console.log(`🛡️ Cross-platform hedge executed (${hedgeLeg.platform} ${hedgeLeg.outcome})`);
          return;
        }
      } catch (error) {
        console.error('Cross-platform hedge failed, fallback to flatten:', error);
      }
    }

    await this.flattenOnPredict(tokenId, delta, shares);
    this.lastHedgeAt.set(tokenId, Date.now());
  }

  private async buildCrossHedgeLeg(
    tokenId: string,
    question: string,
    delta: number,
    shares: number
  ): Promise<PlatformLeg | null> {
    if (!this.crossAggregator) {
      return null;
    }

    const platformMap = await this.crossAggregator.getPlatformMarkets([], new Map());
    const mappingStore = this.crossAggregator.getMappingStore();
    if (mappingStore && this.config.crossPlatformUseMapping !== false) {
      try {
        const marketMeta = await this.api.getMarket(tokenId);
        const predictMarket: PlatformMarket = {
          platform: 'Predict',
          marketId: marketMeta.condition_id || marketMeta.event_id || tokenId,
          question: marketMeta.question || question,
          timestamp: Date.now(),
          metadata: {
            conditionId: marketMeta.condition_id || '',
            eventId: marketMeta.event_id || '',
          },
        };
        const mapped = mappingStore.resolveMatches(predictMarket, platformMap);
        if (mapped.length > 0) {
          const match = mapped[0];
          const outcome = delta > 0 ? 'NO' : 'YES';
          const token = outcome === 'YES' ? match.yesTokenId : match.noTokenId;
          const price = outcome === 'YES' ? match.yesAsk : match.noAsk;
          if (token && price) {
            return {
              platform: match.platform,
              tokenId: token,
              side: 'BUY',
              price,
              shares,
              outcome,
            };
          }
        }
      } catch (error) {
        console.error('Mapping hedge lookup failed:', error);
      }
    }
    const candidates: PlatformMarket[] = [];
    for (const [platform, list] of platformMap.entries()) {
      if (platform === 'Predict') continue;
      candidates.push(...list);
    }

    if (candidates.length === 0) {
      return null;
    }

    const minSimilarity = this.config.crossPlatformMinSimilarity ?? 0.78;
    const { match } = findBestMatch(question, candidates, minSimilarity);
    if (!match) {
      return null;
    }

    const outcome = delta > 0 ? 'NO' : 'YES';
    const matchTokenId = outcome === 'YES' ? match.yesTokenId : match.noTokenId;
    const price = outcome === 'YES' ? match.yesAsk : match.noAsk;

    if (!matchTokenId || !price) {
      return null;
    }

    return {
      platform: match.platform,
      tokenId: matchTokenId,
      side: 'BUY',
      price,
      shares,
      outcome,
    };
  }

  private async flattenOnPredict(tokenId: string, delta: number, shares: number): Promise<void> {
    if (!this.orderManager) {
      return;
    }

    const side = delta > 0 ? 'SELL' : 'BUY';
    const market = await this.api.getMarket(tokenId);
    const orderbook = await this.api.getOrderbook(tokenId);
    const payload = await this.orderManager.buildMarketOrderPayload({
      market,
      side,
      shares,
      orderbook,
      slippageBps: String(this.config.hedgeMaxSlippageBps ?? 250),
    });
    await this.api.createOrder(payload);
    console.log(`🛡️ Flattened position on Predict (${side} ${shares})`);
  }

  printStatus(): void {
    console.log('\n📊 Market Maker Status:');
    console.log('─'.repeat(80));
    console.log(`Trading Halted: ${this.tradingHalted ? 'YES' : 'NO'}`);
    console.log(`Open Orders: ${this.openOrders.size}`);
    console.log(`Positions: ${this.positions.size}`);
    console.log(`Session PnL: ${this.sessionPnL.toFixed(2)}`);

    if (this.positions.size > 0) {
      console.log('\nPositions:');
      for (const [tokenId, position] of this.positions) {
        console.log(`  ${tokenId}:`);
        console.log(`    YES: ${position.yes_amount.toFixed(2)} | NO: ${position.no_amount.toFixed(2)}`);
        console.log(`    Value: $${position.total_value.toFixed(2)} | PnL: $${position.pnl.toFixed(2)}`);
      }
    }

    console.log('─'.repeat(80) + '\n');
  }
}
