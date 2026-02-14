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
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface QuotePrices {
  bidPrice: number;
  askPrice: number;
  midPrice: number;
  spread: number;
  inventoryBias: number;
  valueBias?: number;
  valueConfidence?: number;
  depth?: number;
  depthTrend?: number;
  imbalance?: number;
  profile?: 'CALM' | 'NORMAL' | 'VOLATILE';
  volatility?: number;
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
  private lastBestBid: Map<string, number> = new Map();
  private lastBestAsk: Map<string, number> = new Map();
  private lastBestAt: Map<string, number> = new Map();
  private volatilityEma: Map<string, number> = new Map();
  private depthEma: Map<string, number> = new Map();
  private totalDepthEma: Map<string, number> = new Map();
  private depthTrend: Map<string, number> = new Map();
  private lastDepth: Map<string, number> = new Map();
  private lastImbalance: Map<string, number> = new Map();
  private lastActionAt: Map<string, number> = new Map();
  private cooldownUntil: Map<string, number> = new Map();
  private pauseUntil: Map<string, number> = new Map();
  private lastNetShares: Map<string, number> = new Map();
  private lastHedgeAt: Map<string, number> = new Map();
  private lastIcebergAt: Map<string, number> = new Map();
  private lastProfile: Map<string, 'CALM' | 'NORMAL' | 'VOLATILE'> = new Map();
  private lastProfileAt: Map<string, number> = new Map();
  private icebergPenalty: Map<string, { value: number; ts: number }> = new Map();
  private nearTouchHoldUntil: Map<string, number> = new Map();
  private repriceHoldUntil: Map<string, number> = new Map();
  private cancelHoldUntil: Map<string, number> = new Map();
  private sizePenalty: Map<string, { value: number; ts: number; auto?: boolean }> = new Map();
  private recheckCooldownUntil: Map<string, number> = new Map();
  private fillPressure: Map<string, { score: number; ts: number }> = new Map();
  private cancelBoost: Map<string, { value: number; ts: number }> = new Map();
  private nearTouchPenalty: Map<string, { value: number; ts: number }> = new Map();
  private fillPenalty: Map<string, { value: number; ts: number }> = new Map();
  private mmMetrics: Map<string, Record<string, unknown>> = new Map();
  private mmLastFlushAt = 0;
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
    const boost = this.getCancelBoost(tokenId);
    const threshold = base / mult / boost;
    const buffer = Math.max(0, this.config.mmCancelBufferBps ?? 0);
    const hard = threshold * (1 + buffer);
    if (priceChange > hard) {
      this.cancelHoldUntil.delete(tokenId);
      return true;
    }
    if (priceChange > threshold) {
      const confirmMs = Math.max(0, this.config.mmCancelConfirmMs ?? 0);
      if (confirmMs <= 0) {
        return true;
      }
      const until = this.cancelHoldUntil.get(tokenId) || 0;
      if (!until) {
        this.cancelHoldUntil.set(tokenId, Date.now() + confirmMs);
        return false;
      }
      if (Date.now() >= until) {
        this.cancelHoldUntil.delete(tokenId);
        return true;
      }
      return false;
    }
    this.cancelHoldUntil.delete(tokenId);

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
    let multiplier = 1;
    const profile = this.lastProfile.get(tokenId);
    if (profile === 'VOLATILE') {
      multiplier *= this.config.mmIntervalProfileVolatileMultiplier ?? 1.3;
    } else if (profile === 'CALM') {
      multiplier *= this.config.mmIntervalProfileCalmMultiplier ?? 0.8;
    }
    if (this.config.mmAdaptiveParams !== false) {
      const vol = this.volatilityEma.get(tokenId) ?? 0;
      const threshold = this.config.mmIntervalVolatilityBps ?? 0.01;
      const mult = this.config.mmIntervalVolMultiplier ?? 1.6;
      if (vol >= threshold) {
        multiplier *= mult;
      }
    }
    multiplier *= this.getFillSlowdownMultiplier(tokenId);
    return Math.max(500, Math.round(base * multiplier));
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

  private sleep(ms: number): Promise<void> {
    if (!ms || ms <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  private sumDepthLevels(entries: OrderbookEntry[] | undefined, levels: number): number {
    if (!entries || entries.length === 0) {
      return 0;
    }
    const capped = levels > 0 ? entries.slice(0, levels) : entries;
    return capped.reduce((sum, entry) => sum + this.parseShares(entry), 0);
  }

  private updateDepthMetrics(tokenId: string, orderbook: Orderbook): {
    totalDepth: number;
    bidDepth: number;
    askDepth: number;
    imbalance: number;
    depthTrend: number;
  } {
    const levels = this.config.mmDepthLevels ?? 3;
    const bidDepth = this.sumDepthLevels(orderbook.bids, levels);
    const askDepth = this.sumDepthLevels(orderbook.asks, levels);
    const totalDepth = bidDepth + askDepth;

    const alpha = this.config.mmDepthEmaAlpha ?? 0.2;
    const prevEma = this.totalDepthEma.get(tokenId) ?? totalDepth;
    const ema = prevEma + alpha * (totalDepth - prevEma);
    this.totalDepthEma.set(tokenId, ema);

    const depthTrend = ema > 0 ? (totalDepth - ema) / ema : 0;
    this.depthTrend.set(tokenId, depthTrend);

    const denom = bidDepth + askDepth;
    const imbalance = denom > 0 ? (bidDepth - askDepth) / denom : 0;
    this.lastImbalance.set(tokenId, this.clamp(imbalance, -1, 1));

    return {
      totalDepth,
      bidDepth,
      askDepth,
      imbalance,
      depthTrend,
    };
  }

  private updateBestPrices(tokenId: string, orderbook: Orderbook): void {
    if (orderbook.best_bid !== undefined && orderbook.best_bid > 0) {
      this.lastBestBid.set(tokenId, orderbook.best_bid);
    }
    if (orderbook.best_ask !== undefined && orderbook.best_ask > 0) {
      this.lastBestAsk.set(tokenId, orderbook.best_ask);
    }
    this.lastBestAt.set(tokenId, Date.now());
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

  private evaluateOrderRisk(
    order: Order,
    orderbook: Orderbook
  ): { cancel: boolean; panic: boolean; reason: string } {
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
    const softCancel = this.config.mmSoftCancelBps ?? nearTouch;
    const hardCancel = this.config.mmHardCancelBps ?? antiFill;
    const holdMs = this.config.mmHoldNearTouchMs ?? 800;
    const holdMax = this.config.mmHoldNearTouchMaxBps ?? nearTouch;
    const aggressiveMove = this.config.mmAggressiveMoveBps ?? 0.002;
    const aggressiveWindow = this.config.mmAggressiveMoveWindowMs ?? 1500;

    const lastAt = this.lastBestAt.get(order.token_id) || 0;
    if (Date.now() - lastAt <= aggressiveWindow) {
      const lastBid = this.lastBestBid.get(order.token_id);
      const lastAsk = this.lastBestAsk.get(order.token_id);
      if (order.side === 'BUY' && lastAsk && bestAsk < lastAsk * (1 - aggressiveMove)) {
        return { cancel: true, panic: true, reason: 'aggressive-move' };
      }
      if (order.side === 'SELL' && lastBid && bestBid > lastBid * (1 + aggressiveMove)) {
        return { cancel: true, panic: true, reason: 'aggressive-move' };
      }
    }

    if (order.side === 'BUY') {
      const distance = (bestAsk - price) / price;
      if (distance <= hardCancel || distance <= antiFill) {
        this.nearTouchHoldUntil.delete(order.order_hash);
        return { cancel: true, panic: true, reason: 'anti-fill' };
      }
      if (distance <= holdMax) {
        this.nearTouchHoldUntil.delete(order.order_hash);
        return { cancel: true, panic: true, reason: 'near-touch-max' };
      }
      if (distance <= nearTouch || distance <= softCancel) {
        const until = this.nearTouchHoldUntil.get(order.order_hash) || 0;
        if (!until) {
          this.nearTouchHoldUntil.set(order.order_hash, Date.now() + holdMs);
          return { cancel: false, panic: false, reason: 'near-touch-hold' };
        }
        if (Date.now() >= until) {
          this.nearTouchHoldUntil.delete(order.order_hash);
          return { cancel: true, panic: false, reason: 'near-touch' };
        }
        return { cancel: false, panic: false, reason: 'near-touch-hold' };
      }
    } else {
      const distance = (price - bestBid) / price;
      if (distance <= hardCancel || distance <= antiFill) {
        this.nearTouchHoldUntil.delete(order.order_hash);
        return { cancel: true, panic: true, reason: 'anti-fill' };
      }
      if (distance <= holdMax) {
        this.nearTouchHoldUntil.delete(order.order_hash);
        return { cancel: true, panic: true, reason: 'near-touch-max' };
      }
      if (distance <= nearTouch || distance <= softCancel) {
        const until = this.nearTouchHoldUntil.get(order.order_hash) || 0;
        if (!until) {
          this.nearTouchHoldUntil.set(order.order_hash, Date.now() + holdMs);
          return { cancel: false, panic: false, reason: 'near-touch-hold' };
        }
        if (Date.now() >= until) {
          this.nearTouchHoldUntil.delete(order.order_hash);
          return { cancel: true, panic: false, reason: 'near-touch' };
        }
        return { cancel: false, panic: false, reason: 'near-touch-hold' };
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

  private updateMarketMetrics(
    tokenId: string,
    orderbook: Orderbook
  ): { volEma: number; depthEma: number; topDepth: number; topDepthUsd: number; depthTrend: number } {
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

    const depthTrend = nextDepth > 0 ? depth.shares / nextDepth : 1;

    return {
      volEma: this.volatilityEma.get(tokenId) ?? 0,
      depthEma: nextDepth,
      topDepth: depth.shares,
      topDepthUsd: depth.usd,
      depthTrend,
    };
  }

  private resolveAdaptiveProfile(volEma: number, depthEma: number, depthTrend: number): 'CALM' | 'NORMAL' | 'VOLATILE' {
    const configured = (this.config.mmAdaptiveProfile || 'AUTO').toUpperCase();
    if (configured === 'CALM' || configured === 'NORMAL' || configured === 'VOLATILE') {
      return configured;
    }
    const overrideLow = this.config.mmVolatilityLowBps ?? 0;
    const overrideHigh = this.config.mmVolatilityHighBps ?? 0;
    const calm = overrideLow > 0 ? overrideLow : this.config.mmVolatilityCalmBps ?? 0.004;
    const volatile = overrideHigh > 0 ? overrideHigh : this.config.mmVolatilityVolatileBps ?? 0.02;
    const hysteresis = this.config.mmProfileVolHysteresisBps ?? 0.002;
    const depthRef = this.config.mmDepthRefShares ?? 200;
    const depthRatio = depthRef > 0 ? depthEma / depthRef : 1;
    const low = this.config.mmProfileLiquidityLow ?? 0.5;
    const high = this.config.mmProfileLiquidityHigh ?? 1.2;
    const trendDrop = this.config.mmDepthTrendDropRatio ?? 0.4;
    if (depthTrend < 1 - trendDrop) return 'VOLATILE';
    if (depthRatio <= low) return 'VOLATILE';
    if (volEma >= volatile + hysteresis) return 'VOLATILE';
    if (volEma <= calm - hysteresis && depthRatio >= high) return 'CALM';
    return 'NORMAL';
  }

  private stabilizeProfile(tokenId: string, desired: 'CALM' | 'NORMAL' | 'VOLATILE'): 'CALM' | 'NORMAL' | 'VOLATILE' {
    const current = this.lastProfile.get(tokenId);
    if (!current) {
      this.lastProfile.set(tokenId, desired);
      this.lastProfileAt.set(tokenId, Date.now());
      return desired;
    }
    if (current === desired) {
      return current;
    }
    const holdMs = this.config.mmProfileHoldMs ?? 15000;
    const lastAt = this.lastProfileAt.get(tokenId) || 0;
    if (Date.now() - lastAt < holdMs) {
      return current;
    }
    this.lastProfile.set(tokenId, desired);
    this.lastProfileAt.set(tokenId, Date.now());
    return desired;
  }

  private applyIceberg(shares: number): number {
    if (!this.config.mmIcebergEnabled) {
      return shares;
    }
    const ratio = this.config.mmIcebergRatio ?? 0.3;
    const chunkMax = this.config.mmIcebergMaxChunkShares ?? 15;
    const penalty = this.getIcebergPenalty(this.config.mmIcebergFillPenalty ?? 0.6);
    const next = Math.max(1, Math.floor(shares * Math.max(0.05, ratio) * penalty));
    return Math.min(next, chunkMax);
  }

  private getIcebergPenalty(defaultPenalty: number): number {
    const entry = this.icebergPenalty.get('global');
    if (!entry) {
      return 1;
    }
    const decayMs = this.config.mmIcebergPenaltyDecayMs ?? 60000;
    const elapsed = Date.now() - entry.ts;
    if (elapsed <= 0) {
      return entry.value;
    }
    const recovered = entry.value + (1 - entry.value) * Math.min(1, elapsed / decayMs);
    return this.clamp(recovered, entry.value, 1);
  }

  private applyIcebergPenalty(tokenId: string): void {
    if (!this.config.mmIcebergEnabled) {
      return;
    }
    const penalty = this.config.mmIcebergFillPenalty ?? 0.6;
    this.icebergPenalty.set('global', { value: this.clamp(penalty, 0.2, 1), ts: Date.now() });
  }

  private applySizePenalty(tokenId: string, penalty: number, auto: boolean = false): void {
    const value = this.clamp(penalty, 0.2, 1);
    const current = this.sizePenalty.get(tokenId);
    if (!current) {
      this.sizePenalty.set(tokenId, { value, ts: Date.now(), auto });
      return;
    }
    const next = Math.min(current.value, value);
    this.sizePenalty.set(tokenId, { value: next, ts: Date.now(), auto: current.auto || auto });
  }

  private getSizePenalty(tokenId: string): number {
    const entry = this.sizePenalty.get(tokenId);
    if (!entry) {
      return 1;
    }
    const decayMs = entry.auto
      ? this.config.mmAutoSizeOnFillDecayMs ?? 90000
      : this.config.mmPartialFillPenaltyDecayMs ?? 60000;
    if (!decayMs || decayMs <= 0) {
      return entry.value;
    }
    const elapsed = Date.now() - entry.ts;
    if (elapsed <= 0) {
      return entry.value;
    }
    const recovered = entry.value + (1 - entry.value) * Math.min(1, elapsed / decayMs);
    return this.clamp(recovered, entry.value, 1);
  }

  private applyNearTouchPenalty(tokenId: string, intensity: number = 1): void {
    const base = this.config.mmNearTouchPenaltyBps ?? 0;
    if (!base || base <= 0) {
      return;
    }
    const maxBps = this.config.mmNearTouchPenaltyMaxBps ?? base * 4;
    const current = this.nearTouchPenalty.get(tokenId);
    const scaled = base * this.clamp(intensity, 0.2, 2);
    const next = Math.min((current?.value ?? 0) + scaled, maxBps);
    this.nearTouchPenalty.set(tokenId, { value: next, ts: Date.now() });
  }

  private getNearTouchPenalty(tokenId: string): number {
    const entry = this.nearTouchPenalty.get(tokenId);
    if (!entry) {
      return 0;
    }
    const decayMs = this.config.mmNearTouchPenaltyDecayMs ?? 60000;
    if (!decayMs || decayMs <= 0) {
      return entry.value;
    }
    const elapsed = Date.now() - entry.ts;
    if (elapsed <= 0) {
      return entry.value;
    }
    const decay = Math.exp(-elapsed / decayMs);
    const value = entry.value * decay;
    if (value <= 0.01) {
      this.nearTouchPenalty.delete(tokenId);
      return 0;
    }
    return value;
  }

  private applyFillPenalty(tokenId: string, intensity: number = 1): void {
    const base = this.config.mmFillPenaltyBps ?? 0;
    if (!base || base <= 0) {
      return;
    }
    const maxBps = this.config.mmFillPenaltyMaxBps ?? base * 5;
    const current = this.fillPenalty.get(tokenId);
    const scaled = base * this.clamp(intensity, 0.2, 2);
    const next = Math.min((current?.value ?? 0) + scaled, maxBps);
    this.fillPenalty.set(tokenId, { value: next, ts: Date.now() });
  }

  private getFillPenalty(tokenId: string): number {
    const entry = this.fillPenalty.get(tokenId);
    if (!entry) {
      return 0;
    }
    const decayMs = this.config.mmFillPenaltyDecayMs ?? 90000;
    if (!decayMs || decayMs <= 0) {
      return entry.value;
    }
    const elapsed = Date.now() - entry.ts;
    if (elapsed <= 0) {
      return entry.value;
    }
    const decay = Math.exp(-elapsed / decayMs);
    const value = entry.value * decay;
    if (value <= 0.01) {
      this.fillPenalty.delete(tokenId);
      return 0;
    }
    return value;
  }

  private canRecheck(tokenId: string): boolean {
    const cooldown = Math.max(0, this.config.mmRecheckCooldownMs ?? 0);
    if (!cooldown) {
      return true;
    }
    const until = this.recheckCooldownUntil.get(tokenId) || 0;
    if (Date.now() < until) {
      return false;
    }
    this.recheckCooldownUntil.set(tokenId, Date.now() + cooldown);
    return true;
  }

  private updateFillPressure(tokenId: string, shares: number): void {
    if (!Number.isFinite(shares) || shares <= 0) {
      return;
    }
    const windowMs = Math.max(1, this.config.mmFillSlowdownWindowMs ?? 60000);
    const threshold = Math.max(1, this.config.mmPartialFillShares ?? 5);
    const entry = this.fillPressure.get(tokenId);
    const now = Date.now();
    let score = entry?.score ?? 0;
    if (entry) {
      const elapsed = now - entry.ts;
      const decay = Math.exp(-elapsed / windowMs);
      score *= decay;
    }
    score += shares / threshold;
    this.fillPressure.set(tokenId, { score, ts: now });
  }

  private bumpCancelBoost(tokenId: string, intensity: number): void {
    if (this.config.mmDynamicCancelOnFill !== true) {
      return;
    }
    const now = Date.now();
    const current = this.cancelBoost.get(tokenId);
    let value = current?.value ?? 1;
    const boost = Math.max(0, this.config.mmDynamicCancelBoost ?? 0.4);
    value = value + boost * intensity;
    const maxBoost = Math.max(1, this.config.mmDynamicCancelMaxBoost ?? 2);
    this.cancelBoost.set(tokenId, { value: Math.min(maxBoost, value), ts: now });
  }

  private getCancelBoost(tokenId: string): number {
    if (this.config.mmDynamicCancelOnFill !== true) {
      return 1;
    }
    const entry = this.cancelBoost.get(tokenId);
    if (!entry) {
      return 1;
    }
    const decayMs = Math.max(1, this.config.mmDynamicCancelDecayMs ?? 60000);
    const elapsed = Date.now() - entry.ts;
    const decay = Math.exp(-elapsed / decayMs);
    const value = 1 + (entry.value - 1) * decay;
    return Math.max(1, value);
  }

  private getFillSlowdownMultiplier(tokenId: string): number {
    const entry = this.fillPressure.get(tokenId);
    if (!entry) {
      return 1;
    }
    const windowMs = Math.max(1, this.config.mmFillSlowdownWindowMs ?? 60000);
    const elapsed = Date.now() - entry.ts;
    const decay = Math.exp(-elapsed / windowMs);
    const score = entry.score * decay;
    const factor = Math.max(0, this.config.mmFillSlowdownFactor ?? 0.15);
    const maxMult = Math.max(1, this.config.mmFillSlowdownMaxMultiplier ?? 2);
    const multiplier = 1 + score * factor;
    return Math.min(maxMult, Math.max(1, multiplier));
  }

  private async flushMmMetrics(): Promise<void> {
    const target = this.config.mmMetricsPath;
    const interval = this.config.mmMetricsFlushMs ?? 0;
    if (!target || !interval) {
      return;
    }
    const now = Date.now();
    if (now - this.mmLastFlushAt < interval) {
      return;
    }
    this.mmLastFlushAt = now;
    try {
      const payload = {
        version: 1,
        ts: now,
        tradingHalted: this.tradingHalted,
        sessionPnL: this.sessionPnL,
        openOrders: this.openOrders.size,
        positions: this.positions.size,
        markets: Array.from(this.mmMetrics.values()),
      };
      const resolved = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      const tmp = `${resolved}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
      await fs.rename(tmp, resolved);
    } catch (error) {
      console.warn('MM metrics flush failed:', error);
    }
  }

  private recordMmMetrics(
    market: Market,
    orderbook: Orderbook,
    prices: QuotePrices,
    profile: 'CALM' | 'NORMAL' | 'VOLATILE',
    metrics: { volEma: number; depthEma: number; topDepth: number; topDepthUsd: number; depthTrend: number }
  ): void {
    const imbalance = this.calculateOrderbookImbalance(orderbook);
    const entry = {
      tokenId: market.token_id,
      question: market.question?.slice(0, 80),
      profile,
      spread: prices.spread,
      bid: prices.bidPrice,
      ask: prices.askPrice,
      volEma: metrics.volEma,
      depthEma: metrics.depthEma,
      depthTrend: metrics.depthTrend,
      topDepth: metrics.topDepth,
      topDepthUsd: metrics.topDepthUsd,
      imbalance,
      inventoryBias: prices.inventoryBias,
      nearTouchPenaltyBps: this.getNearTouchPenalty(market.token_id),
      fillPenaltyBps: this.getFillPenalty(market.token_id),
      updatedAt: Date.now(),
    };
    this.mmMetrics.set(market.token_id, entry);
    void this.flushMmMetrics();
  }

  private canRequoteIceberg(tokenId: string, depthTrend: number): boolean {
    const base = this.config.mmIcebergRequoteMs ?? 4000;
    const volMult = this.getVolatilityMultiplier(tokenId, this.config.mmIcebergRequoteVolMultiplier ?? 1.2);
    const depthMult = depthTrend < 1 ? 1 + (1 - depthTrend) * (this.config.mmIcebergRequoteDepthMultiplier ?? 1.0) : 1;
    const interval = Math.round(base * volMult * depthMult);
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

    this.updateBestPrices(market.token_id, orderbook);
    const depthMetrics = this.updateDepthMetrics(market.token_id, orderbook);
    const minDepth = this.config.mmDepthMinShares ?? 0;
    if (minDepth > 0 && depthMetrics.totalDepth < minDepth) {
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
    const topDepth = this.getTopDepth(orderbook).shares;
    const depthTrend = depthEma > 0 ? topDepth / depthEma : 1;
    const depthFactor =
      depthRef > 0 && depthEma > 0 ? this.clamp(depthEma / depthRef, 0.2, 3) : 1;
    const liquidityPenalty = depthFactor < 1 ? 1 / depthFactor - 1 : 0;

    const rawProfile = this.resolveAdaptiveProfile(volEma, depthEma, depthTrend);
    const profile = this.stabilizeProfile(market.token_id, rawProfile);
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

    const fillRiskBps = Math.max(0, this.config.mmFillRiskSpreadBps ?? 0);
    if (fillRiskBps > 0) {
      const fillRisk = this.getFillSlowdownMultiplier(market.token_id) - 1;
      if (fillRisk > 0) {
        adaptiveSpread += fillRisk * (fillRiskBps / 10000);
      }
    }

    const nearTouchPenalty = this.getNearTouchPenalty(market.token_id);
    if (nearTouchPenalty > 0) {
      adaptiveSpread += nearTouchPenalty / 10000;
    }
    const fillPenalty = this.getFillPenalty(market.token_id);
    if (fillPenalty > 0) {
      adaptiveSpread += fillPenalty / 10000;
    }

    const depthTarget = this.config.mmDepthTargetShares ?? 0;
    if (depthTarget > 0) {
      const depthRatio = this.clamp(depthMetrics.totalDepth / depthTarget, 0, 1);
      const depthPenaltyWeight = this.config.mmDepthPenaltyWeight ?? 0.6;
      adaptiveSpread += (1 - depthRatio) * baseSpread * depthPenaltyWeight;
    }

    if (depthMetrics.depthTrend < 0) {
      adaptiveSpread += Math.abs(depthMetrics.depthTrend) * baseSpread * 0.4;
    }

    if (profile === 'VOLATILE') {
      adaptiveSpread *= 1.1;
    } else if (profile === 'CALM') {
      adaptiveSpread *= 0.95;
    }

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
    const invWeight = this.config.mmAsymSpreadInventoryWeight ?? 0.4;
    const imbWeight = this.config.mmAsymSpreadImbalanceWeight ?? 0.35;
    const minFactor = this.config.mmAsymSpreadMinFactor ?? 0.6;
    const maxFactor = this.config.mmAsymSpreadMaxFactor ?? 1.8;
    const depthImbalance = depthMetrics.imbalance;

    const bidFactor = this.clamp(1 + inventoryBias * invWeight - depthImbalance * imbWeight, minFactor, maxFactor);
    const askFactor = this.clamp(1 - inventoryBias * invWeight + depthImbalance * imbWeight, minFactor, maxFactor);
    let quoteOffset = Math.max(0, this.config.mmQuoteOffsetBps ?? 0) / 10000;
    if (market.liquidity_activation?.max_spread) {
      const maxAllowed = market.liquidity_activation.max_spread * 0.95;
      const remaining = Math.max(0, maxAllowed - adaptiveSpread);
      quoteOffset = Math.min(quoteOffset, remaining / 2);
    }

    let bid = fairPrice * (1 - half * bidFactor - quoteOffset);
    let ask = fairPrice * (1 + half * askFactor + quoteOffset);

    // Keep maker-friendly but never cross top of book
    const touchBufferBps = Math.max(0, this.config.mmTouchBufferBps ?? 0);
    if (touchBufferBps > 0) {
      const buffer = touchBufferBps / 10000;
      const maxBid = bestBid * (1 - buffer);
      const minAsk = bestAsk * (1 + buffer);
      bid = Math.min(bid, maxBid);
      ask = Math.max(ask, minAsk);
    } else {
      bid = Math.max(bid, bestBid + MarketMaker.MIN_TICK);
      ask = Math.min(ask, bestAsk - MarketMaker.MIN_TICK);
    }

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
      depth: depthMetrics.totalDepth,
      depthTrend: depthMetrics.depthTrend,
      imbalance: depthImbalance,
      profile,
      volatility: volatilityComponent,
    };
  }

  calculateOrderSize(
    market: Market,
    orderbook: Orderbook,
    side: 'BUY' | 'SELL',
    price: number
  ): OrderSizeResult {
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

    const depthFactor = this.config.mmDepthShareFactor ?? 0;
    let depthCap = 0;
    if (depthFactor > 0) {
      const levels = this.config.mmDepthLevels ?? 3;
      const sideLevels = side === 'BUY' ? orderbook.bids : orderbook.asks;
      depthCap = Math.floor(this.sumDepthLevels(sideLevels, levels) * depthFactor);
    }

    const inventoryBias = this.calculateInventoryBias(market.token_id);
    const imbalance = this.calculateOrderbookImbalance(orderbook);
    const sizeInvWeight = this.config.mmSizeInventoryWeight ?? 0.4;
    const sizeImbWeight = this.config.mmSizeImbalanceWeight ?? 0.3;
    const sizeMin = this.config.mmSizeMinFactor ?? 0.3;
    const sizeMax = this.config.mmSizeMaxFactor ?? 1.4;
    let sizeFactor = 1;
    if (side === 'BUY') {
      sizeFactor *= 1 - inventoryBias * sizeInvWeight;
      sizeFactor *= 1 + imbalance * sizeImbWeight;
    } else {
      sizeFactor *= 1 + inventoryBias * sizeInvWeight;
      sizeFactor *= 1 - imbalance * sizeImbWeight;
    }
    sizeFactor = this.clamp(sizeFactor, sizeMin, sizeMax);
    const penalty = this.getSizePenalty(market.token_id);
    shares = Math.floor(shares * sizeFactor * penalty);

    const minShares = market.liquidity_activation?.min_shares || 0;
    if (minShares > 0 && shares < minShares) {
      const minOrderValue = minShares * price;
      const hardCap = this.config.maxSingleOrderValue ?? Number.POSITIVE_INFINITY;
      if (minOrderValue <= hardCap && minOrderValue <= remainingRiskBudget) {
        if (!depthCap || minShares <= depthCap) {
          shares = minShares;
        }
      }
    }

    if (market.liquidity_activation?.active && this.config.mmPointsMinOnly && minShares > 0) {
      const multiplier = Math.max(1, this.config.mmPointsMinMultiplier ?? 1);
      const cap = Math.max(minShares, Math.floor(minShares * multiplier));
      shares = Math.min(shares, cap);
      if (shares < minShares) {
        shares = minShares;
      }
    }

    if (depthCap > 0) {
      shares = Math.min(shares, depthCap);
    }

    const maxShares = this.config.mmMaxSharesPerOrder ?? 0;
    if (maxShares > 0) {
      shares = Math.min(shares, Math.floor(maxShares));
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
    const buffer = Math.max(0, this.config.mmRepriceBufferBps ?? 0);
    const hard = threshold * (1 + buffer);
    if (diff >= hard) {
      this.repriceHoldUntil.delete(order.order_hash);
      return true;
    }
    if (diff < threshold) {
      this.repriceHoldUntil.delete(order.order_hash);
      return false;
    }
    const confirmMs = Math.max(0, this.config.mmRepriceConfirmMs ?? 0);
    if (confirmMs <= 0) {
      return true;
    }
    const until = this.repriceHoldUntil.get(order.order_hash) || 0;
    if (!until) {
      this.repriceHoldUntil.set(order.order_hash, Date.now() + confirmMs);
      return false;
    }
    if (Date.now() >= until) {
      this.repriceHoldUntil.delete(order.order_hash);
      return true;
    }
    return false;
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
    this.updateBestPrices(tokenId, orderbook);

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
    if (this.config.mmOnlyPointsMarkets && !qualifiesForPoints) {
      await this.cancelOrdersForMarket(tokenId);
      this.markCooldown(tokenId, this.config.cooldownAfterCancelMs ?? 4000);
      this.markAction(tokenId);
      return;
    }

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

    let prices = this.calculatePrices(market, orderbook);
    if (!prices) {
      return;
    }

    const rawProfile = this.resolveAdaptiveProfile(metrics.volEma, metrics.depthEma, metrics.depthTrend);
    const profile = this.stabilizeProfile(tokenId, rawProfile);

    this.recordMmMetrics(market, orderbook, prices, profile, metrics);

    let existingOrders = Array.from(this.openOrders.values()).filter(
      (o) => o.token_id === tokenId && o.status === 'OPEN'
    );
    existingOrders = this.trimExcessOrders(tokenId, existingOrders);

    const existingBid = existingOrders.find((o) => o.side === 'BUY');
    const existingAsk = existingOrders.find((o) => o.side === 'SELL');

    if (existingBid) {
      let risk = this.evaluateOrderRisk(existingBid, orderbook);
      let shouldReprice = this.shouldRepriceOrder(existingBid, prices.bidPrice);
      if ((risk.cancel || shouldReprice) && this.canRecheck(tokenId)) {
        const delay = risk.cancel
          ? Math.max(0, this.config.mmCancelRecheckMs ?? 0)
          : Math.max(0, this.config.mmRepriceRecheckMs ?? 0);
        if (delay > 0) {
          await this.sleep(delay);
          const freshBook = await this.api.getOrderbook(tokenId);
          if (risk.cancel) {
            const freshRisk = this.evaluateOrderRisk(existingBid, freshBook);
            if (!freshRisk.cancel) {
              risk = freshRisk;
            } else {
              risk = freshRisk;
            }
          }
          if (shouldReprice) {
            const freshPrices = this.calculatePrices(market, freshBook);
            if (freshPrices) {
              prices = freshPrices;
              shouldReprice = this.shouldRepriceOrder(existingBid, prices.bidPrice);
            }
          }
        }
      }
      if (risk.cancel || shouldReprice) {
        if (risk.cancel && (risk.reason.startsWith('near-touch') || risk.reason === 'anti-fill')) {
          const intensity = risk.panic ? 1.5 : 1;
          this.applyNearTouchPenalty(tokenId, intensity);
          const sizePenalty = this.config.mmNearTouchSizePenalty ?? 0;
          if (sizePenalty > 0 && sizePenalty < 1) {
            this.applySizePenalty(tokenId, sizePenalty, true);
          }
        }
        await this.cancelOrder(existingBid);
        const softCooldown = this.config.mmSoftCancelCooldownMs ?? (this.config.cooldownAfterCancelMs ?? 4000);
        const hardCooldown = this.config.mmHardCancelCooldownMs ?? (this.config.cooldownAfterCancelMs ?? 4000);
        const baseCooldown = risk.panic ? hardCooldown : softCooldown;
        const cooldown = this.getAdaptiveCooldown(tokenId, baseCooldown);
        if (risk.panic) {
          this.pauseForVolatility(tokenId);
          this.markCooldown(tokenId, cooldown + 2000);
        } else {
          this.markCooldown(tokenId, cooldown);
        }
      }
    }

    if (existingAsk) {
      let risk = this.evaluateOrderRisk(existingAsk, orderbook);
      let shouldReprice = this.shouldRepriceOrder(existingAsk, prices.askPrice);
      if ((risk.cancel || shouldReprice) && this.canRecheck(tokenId)) {
        const delay = risk.cancel
          ? Math.max(0, this.config.mmCancelRecheckMs ?? 0)
          : Math.max(0, this.config.mmRepriceRecheckMs ?? 0);
        if (delay > 0) {
          await this.sleep(delay);
          const freshBook = await this.api.getOrderbook(tokenId);
          if (risk.cancel) {
            const freshRisk = this.evaluateOrderRisk(existingAsk, freshBook);
            if (!freshRisk.cancel) {
              risk = freshRisk;
            } else {
              risk = freshRisk;
            }
          }
          if (shouldReprice) {
            const freshPrices = this.calculatePrices(market, freshBook);
            if (freshPrices) {
              prices = freshPrices;
              shouldReprice = this.shouldRepriceOrder(existingAsk, prices.askPrice);
            }
          }
        }
      }
      if (risk.cancel || shouldReprice) {
        if (risk.cancel && (risk.reason.startsWith('near-touch') || risk.reason === 'anti-fill')) {
          const intensity = risk.panic ? 1.5 : 1;
          this.applyNearTouchPenalty(tokenId, intensity);
          const sizePenalty = this.config.mmNearTouchSizePenalty ?? 0;
          if (sizePenalty > 0 && sizePenalty < 1) {
            this.applySizePenalty(tokenId, sizePenalty, true);
          }
        }
        await this.cancelOrder(existingAsk);
        const softCooldown = this.config.mmSoftCancelCooldownMs ?? (this.config.cooldownAfterCancelMs ?? 4000);
        const hardCooldown = this.config.mmHardCancelCooldownMs ?? (this.config.cooldownAfterCancelMs ?? 4000);
        const baseCooldown = risk.panic ? hardCooldown : softCooldown;
        const cooldown = this.getAdaptiveCooldown(tokenId, baseCooldown);
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

    const bidOrderSize = this.calculateOrderSize(market, orderbook, 'BUY', prices.bidPrice);
    const askOrderSize = this.calculateOrderSize(market, orderbook, 'SELL', prices.askPrice);

    const profileScale = profile === 'CALM' ? 1.0 : profile === 'VOLATILE' ? 0.6 : 0.85;
    const canIceberg = this.config.mmIcebergEnabled && this.canRequoteIceberg(tokenId, metrics.depthTrend);
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

    const imbalance = prices.imbalance ?? this.calculateOrderbookImbalance(orderbook);
    const depthInfo = prices.depth && prices.depth > 0 ? ` depth=${prices.depth.toFixed(0)}` : '';
    console.log(
      `   bid=${prices.bidPrice.toFixed(4)} ask=${prices.askPrice.toFixed(4)} spread=${(prices.spread * 100).toFixed(2)}% ` +
        `bias=${prices.inventoryBias.toFixed(2)} imb=${imbalance.toFixed(2)}${depthInfo}${valueInfo} ${qualifiesForPoints ? '✨' : ''} profile=${profile}`
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
      const absDelta = Math.abs(delta);
      if (absDelta > 0) {
        this.updateFillPressure(tokenId, absDelta);
      }
      const partialThreshold = this.config.mmPartialFillShares ?? 5;
      if (absDelta > 0) {
        const intensity = this.clamp(absDelta / Math.max(1, partialThreshold), 0.2, 2);
        this.applyFillPenalty(tokenId, intensity);
      }
      if (absDelta > 0 && this.config.mmDynamicCancelOnFill) {
        const intensity = this.clamp(absDelta / Math.max(1, partialThreshold), 0.2, 2);
        this.bumpCancelBoost(tokenId, intensity);
      }
      if (absDelta >= partialThreshold) {
        const penalty = this.config.mmPartialFillPenalty ?? 0.6;
        this.applySizePenalty(tokenId, penalty);
      }
      if (absDelta > 0 && this.config.mmAutoSizeOnFill !== false) {
        const minFactor = this.config.mmAutoSizeMinFactor ?? 0.4;
        const factor = this.clamp(1 - absDelta / (partialThreshold * 5), minFactor, 1);
        this.applySizePenalty(tokenId, factor, true);
      }
      if (absDelta >= triggerShares) {
        this.applyIcebergPenalty(tokenId);
        await this.handleFillHedge(tokenId, delta, position.question);
      } else if (absDelta >= partialThreshold && this.config.mmPartialFillHedge) {
        const maxShares = this.config.mmPartialFillHedgeMaxShares ?? 20;
        const hedgeShares = Math.min(absDelta, maxShares);
        if (hedgeShares > 0) {
          await this.flattenOnPredict(tokenId, delta, hedgeShares, this.config.mmPartialFillHedgeSlippageBps);
        }
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

  private async flattenOnPredict(
    tokenId: string,
    delta: number,
    shares: number,
    slippageOverride?: number
  ): Promise<void> {
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
      slippageBps: String(slippageOverride ?? this.config.hedgeMaxSlippageBps ?? 250),
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
