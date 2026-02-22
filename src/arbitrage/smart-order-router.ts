/**
 * Smart Order Routing System
 * 智能订单路由系统 - 自动选择最佳执行路径和订单拆分
 */

import type { ArbitrageOpportunity } from './types.js';

/**
 * 订单拆分策略
 */
export type SplitStrategy = 'VWAP' | 'TWAP' | 'SIMPLE' | 'AGGRESSIVE';

/**
 * 路由选项
 */
export interface RouteOptions {
  maxSlippage: number;        // 最大滑点
  maxSplits: number;          // 最大拆分数量
  strategy: SplitStrategy;    // 拆分策略
  minOrderSize: number;       // 最小订单大小
  urgency: 'LOW' | 'MEDIUM' | 'HIGH'; // 紧急程度
}

/**
 * 订单片段
 */
export interface OrderSlice {
  price: number;
  size: number;
  platform: string;
  timestamp: number;
  priority: number;
}

/**
 * 路由结果
 */
export interface RouteResult {
  slices: OrderSlice[];
  expectedSlippage: number;
  totalCost: number;
  avgPrice: number;
  executionTime: number; // 预计执行时间（毫秒）
  confidence: number;    // 置信度 0-1
}

/**
 * 平台流动性信息
 */
export interface PlatformLiquidity {
  platform: string;
  bidDepth: number;
  askDepth: number;
  spread: number;
  feeRate: number;
  latency: number; // 平均延迟（毫秒）
}

/**
 * 智能订单路由器
 */
export class SmartOrderRouter {
  private options: RouteOptions;
  private platformLiquidity: Map<string, PlatformLiquidity> = new Map();

  constructor(options: Partial<RouteOptions> = {}) {
    this.options = {
      maxSlippage: 0.005, // 0.5%
      maxSplits: 5,
      strategy: 'VWAP',
      minOrderSize: 10,
      urgency: 'MEDIUM',
      ...options,
    };
  }

  /**
   * 更新平台流动性信息
   */
  updateLiquidity(liquidity: PlatformLiquidity[]): void {
    for (const liq of liquidity) {
      this.platformLiquidity.set(liq.platform, liq);
    }
  }

  /**
   * 计算最佳路由
   */
  calculateRoute(
    opportunity: ArbitrageOpportunity,
    totalSize: number
  ): RouteResult {
    // 1. 选择最佳平台
    const bestPlatform = this.selectBestPlatform(opportunity, totalSize);

    // 2. 根据策略拆分订单
    const slices = this.splitOrder(opportunity, totalSize, bestPlatform);

    // 3. 计算预期滑点
    const expectedSlippage = this.calculateExpectedSlippage(slices, opportunity);

    // 4. 计算总成本和平均价格
    const totalCost = slices.reduce((sum, s) => sum + s.price * s.size, 0);
    const avgPrice = totalCost / totalSize;

    // 5. 估算执行时间
    const executionTime = this.estimateExecutionTime(slices);

    // 6. 计算置信度
    const confidence = this.calculateConfidence(slices, opportunity);

    return {
      slices,
      expectedSlippage,
      totalCost,
      avgPrice,
      executionTime,
      confidence,
    };
  }

  /**
   * 选择最佳平台
   */
  private selectBestPlatform(
    opportunity: ArbitrageOpportunity,
    size: number
  ): string {
    // 如果是跨平台套利，使用指定平台
    if (opportunity.platformA && opportunity.platformB) {
      // 选择流动性更好的平台
      const liqA = this.platformLiquidity.get(opportunity.platformA);
      const liqB = this.platformLiquidity.get(opportunity.platformB);

      if (liqA && liqB) {
        return liqA.bidDepth > liqB.bidDepth ? opportunity.platformA : opportunity.platformB;
      }

      return opportunity.platformA;
    }

    // 站内套利，直接使用当前平台
    return 'predict_fun';
  }

  /**
   * 拆分订单
   */
  private splitOrder(
    opportunity: ArbitrageOpportunity,
    totalSize: number,
    platform: string
  ): OrderSlice[] {
    const slices: OrderSlice[] = [];

    switch (this.options.strategy) {
      case 'VWAP':
        return this.vwapSplit(opportunity, totalSize, platform);

      case 'TWAP':
        return this.twapSplit(opportunity, totalSize, platform);

      case 'AGGRESSIVE':
        return this.aggressiveSplit(opportunity, totalSize, platform);

      case 'SIMPLE':
      default:
        return this.simpleSplit(opportunity, totalSize, platform);
    }
  }

  /**
   * VWAP 拆分 - 成交量加权平均价
   */
  private vwapSplit(
    opportunity: ArbitrageOpportunity,
    totalSize: number,
    platform: string
  ): OrderSlice[] {
    const slices: OrderSlice[] = [];

    // 获取订单簿深度
    const liquidity = this.platformLiquidity.get(platform);

    if (!liquidity || !opportunity.yesBid || !opportunity.yesAsk) {
      // 无法获取深度，使用简单拆分
      return this.simpleSplit(opportunity, totalSize, platform);
    }

    // 根据订单簿深度按比例拆分
    let remainingSize = totalSize;
    let currentPrice = opportunity.yesPrice || 0.5;
    const priceImpact = 0.001; // 每次拆分的价格影响

    for (let i = 0; i < this.options.maxSplits && remainingSize > this.options.minOrderSize; i++) {
      // 计算本次拆分大小（考虑深度）
      const splitRatio = 1 / (this.options.maxSplits - i);
      let sliceSize = Math.min(remainingSize, totalSize * splitRatio);

      // 确保不超过最小订单大小
      if (sliceSize < this.options.minOrderSize) {
        sliceSize = remainingSize;
      }

      // 计算滑点影响后的价格
      const slippage = (sliceSize / liquidity.bidDepth) * priceImpact;
      const slicePrice = currentPrice * (1 - slippage);

      slices.push({
        price: slicePrice,
        size: sliceSize,
        platform,
        timestamp: Date.now() + i * 100, // 每个订单间隔 100ms
        priority: this.options.maxSplits - i,
      });

      remainingSize -= sliceSize;
      currentPrice = slicePrice;
    }

    // 如果还有剩余，最后一次执行
    if (remainingSize > 0) {
      slices.push({
        price: currentPrice * (1 - priceImpact),
        size: remainingSize,
        platform,
        timestamp: Date.now() + slices.length * 100,
        priority: 0,
      });
    }

    return slices;
  }

  /**
   * TWAP 拆分 - 时间加权平均价
   */
  private twapSplit(
    opportunity: ArbitrageOpportunity,
    totalSize: number,
    platform: string
  ): OrderSlice[] {
    const slices: OrderSlice[] = [];

    // 平均时间间隔（秒）
    const timeWindow = 60; // 1 分钟内执行完
    const interval = timeWindow / this.options.maxSplits;

    const sliceSize = totalSize / this.options.maxSplits;
    const basePrice = opportunity.yesPrice || 0.5;

    for (let i = 0; i < this.options.maxSplits; i++) {
      slices.push({
        price: basePrice,
        size: sliceSize,
        platform,
        timestamp: Date.now() + i * interval * 1000,
        priority: this.options.maxSplits - i,
      });
    }

    return slices;
  }

  /**
   * 激进拆分 - 快速执行
   */
  private aggressiveSplit(
    opportunity: ArbitrageOpportunity,
    totalSize: number,
    platform: string
  ): OrderSlice[] {
    const slices: OrderSlice[] = [];

    // 激进模式：最少拆分，快速执行
    const sliceSize = Math.min(totalSize, this.options.maxSplits * 50);
    const basePrice = opportunity.yesPrice || 0.5;

    // 立即执行
    slices.push({
      price: basePrice * 0.998, // 稍微低于市价以确保成交
      size: sliceSize,
      platform,
      timestamp: Date.now(),
      priority: 100,
    });

    // 如果还有剩余，快速跟进
    if (totalSize > sliceSize) {
      slices.push({
        price: basePrice * 0.997,
        size: totalSize - sliceSize,
        platform,
        timestamp: Date.now() + 50, // 50ms 后
        priority: 99,
      });
    }

    return slices;
  }

  /**
   * 简单拆分 - 平均拆分
   */
  private simpleSplit(
    opportunity: ArbitrageOpportunity,
    totalSize: number,
    platform: string
  ): OrderSlice[] {
    const slices: OrderSlice[] = [];

    const sliceSize = Math.ceil(totalSize / this.options.maxSplits);
    const basePrice = opportunity.yesPrice || 0.5;

    let remainingSize = totalSize;
    let i = 0;

    while (remainingSize > 0) {
      const size = Math.min(sliceSize, remainingSize);

      slices.push({
        price: basePrice,
        size,
        platform,
        timestamp: Date.now() + i * 200, // 每个订单间隔 200ms
        priority: this.options.maxSplits - i,
      });

      remainingSize -= size;
      i++;
    }

    return slices;
  }

  /**
   * 计算预期滑点
   */
  private calculateExpectedSlippage(
    slices: OrderSlice[],
    opportunity: ArbitrageOpportunity
  ): number {
    if (!opportunity.yesPrice || slices.length === 0) {
      return 0;
    }

    const basePrice = opportunity.yesPrice;
    const totalCost = slices.reduce((sum, s) => sum + s.price * s.size, 0);
    const totalSize = slices.reduce((sum, s) => sum + s.size, 0);
    const avgPrice = totalCost / totalSize;

    return Math.abs(avgPrice - basePrice) / basePrice;
  }

  /**
   * 估算执行时间
   */
  private estimateExecutionTime(slices: OrderSlice[]): number {
    if (slices.length === 0) return 0;

    const firstTimestamp = slices[0].timestamp;
    const lastTimestamp = slices[slices.length - 1].timestamp;

    return lastTimestamp - firstTimestamp + 1000; // 加上 1 秒缓冲
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    slices: OrderSlice[],
    opportunity: ArbitrageOpportunity
  ): number {
    let confidence = 0.5;

    // 1. 基于深度
    if (opportunity.depthShares && opportunity.depthShares > 200) {
      confidence += 0.2;
    }

    // 2. 基于流动性
    const totalLiquidity = (opportunity.yesBid || 0) + (opportunity.yesAsk || 0);
    if (totalLiquidity > 500) {
      confidence += 0.2;
    }

    // 3. 基于拆分数量（拆分越多，执行越可靠）
    if (slices.length >= 3) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  /**
   * 优化路由策略
   */
  optimizeStrategy(marketConditions: {
    volatility: number;
    liquidity: number;
    spread: number;
  }): SplitStrategy {
    // 高波动：使用 TWAP 降低风险
    if (marketConditions.volatility > 0.05) {
      return 'TWAP';
    }

    // 低流动性：使用 VWAP 减少滑点
    if (marketConditions.liquidity < 1000) {
      return 'VWAP';
    }

    // 低延迟、高流动性：激进执行
    if (marketConditions.spread < 0.01 && marketConditions.liquidity > 5000) {
      return 'AGGRESSIVE';
    }

    // 默认：简单拆分
    return 'SIMPLE';
  }
}

/**
 * 路由器工厂
 */
export class RouterFactory {
  private static routers: Map<string, SmartOrderRouter> = new Map();

  static getRouter(marketId: string, options?: Partial<RouteOptions>): SmartOrderRouter {
    if (!this.routers.has(marketId)) {
      this.routers.set(marketId, new SmartOrderRouter(options));
    }

    return this.routers.get(marketId)!;
  }

  static updateAllRouters(liquidity: PlatformLiquidity[]): void {
    for (const router of this.routers.values()) {
      router.updateLiquidity(liquidity);
    }
  }
}
