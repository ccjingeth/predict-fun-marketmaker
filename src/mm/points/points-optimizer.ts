/**
 * 积分优化引擎
 * 针对Predict.fun积分系统的极致优化
 * 目标：最大化积分获取，同时保持盈利性
 */

import type { Market, Orderbook, LiquidityActivation } from '../../types.js';

export interface PointsOptimizationConfig {
  targetSpreadBps: number; // 目标价差（基点），建议在max_spread的90-95%
  minSharesBuffer: number; // min_shares缓冲区（1.0 = 刚好满足，1.1 = 多10%）
  prioritizeHighValueMarkets: boolean; // 优先高价值市场
  maxSpreadSafetyMargin: number; // max_spread安全边际（0-1）
  enableDynamicSizing: boolean; // 启用动态订单大小
  pointsDecayThreshold: number; // 积分衰减阈值
}

export interface PointsMarketScore {
  marketId: string;
  pointsValue: number; // 积分价值评分
  profitability: number; // 盈利性评分
  priority: number; // 综合优先级
  recommendedSpread: number; // 推荐价差
  recommendedSize: number; // 推荐订单大小
  reasons: string[]; // 评分原因
}

export interface OrderAdjustment {
  adjustedSpread: number;
  adjustedSize: number;
  meetsMinShares: boolean;
  withinMaxSpread: boolean;
  pointsEligible: boolean;
  warnings: string[];
}

/**
 * 积分优化引擎
 */
export class PointsOptimizerEngine {
  private config: PointsOptimizationConfig;
  private marketScores = new Map<string, PointsMarketScore>();
  private adjustmentHistory = new Map<string, OrderAdjustment[]>();

  constructor(config?: Partial<PointsOptimizationConfig>) {
    this.config = {
      targetSpreadBps: 570, // 5.7 cents, 略低于6 cents限制
      minSharesBuffer: 1.05, // 多5%缓冲
      prioritizeHighValueMarkets: true,
      maxSpreadSafetyMargin: 0.95, // 使用max_spread的95%
      enableDynamicSizing: true,
      pointsDecayThreshold: 0.8,
      ...config,
    };
  }

  /**
   * 评估市场的积分价值
   */
  evaluateMarket(market: Market, currentSpread: number, orderbook: Orderbook): PointsMarketScore {
    const liquidityRules = market.liquidity_activation;
    if (!liquidityRules) {
      return {
        marketId: market.token_id,
        pointsValue: 0,
        profitability: 0,
        priority: 0,
        recommendedSpread: 0,
        recommendedSize: 0,
        reasons: ['无积分规则'],
      };
    }

    const reasons: string[] = [];
    let pointsValue = 0;
    let profitability = 0;

    // 1. 积分价值评分（权重50%）
    const minShares = liquidityRules.min_shares || 100;
    const maxSpread = this.getMaxSpreadCents(liquidityRules);

    // min_shares越低，越容易满足，价值越高
    const minSharesScore = Math.max(0, 1 - (minShares - 50) / 200);
    pointsValue += minSharesScore * 50;

    if (minShares <= 100) {
      reasons.push(`min_shares=${minShares} 容易满足`);
    } else {
      reasons.push(`min_shares=${minShares} 需要较大订单`);
    }

    // max_spread越大，盈利空间越大
    const maxSpreadScore = Math.min(maxSpread / 10, 1);
    pointsValue += maxSpreadScore * 30;

    if (maxSpread >= 6) {
      reasons.push(`max_spread=${maxSpread}¢ 宽松限制`);
    } else {
      reasons.push(`max_spread=${maxSpread}¢ 严格限制`);
    }

    // 2. 盈利性评分（权重30%）
    const bestBid = Number(orderbook.bids?.[0]?.price || 0);
    const bestAsk = Number(orderbook.asks?.[0]?.price || 0);
    const bookSpread = bestAsk - bestBid;

    // 当前价差占max_spread的比例
    const spreadUtilization = currentSpread / (maxSpread / 100);
    if (spreadUtilization <= this.config.maxSpreadSafetyMargin) {
      profitability += 50;
      reasons.push('价差在安全范围内');
    } else if (spreadUtilization <= 1) {
      profitability += 30;
      reasons.push('价差接近限制');
    } else {
      profitability += 10;
      reasons.push('价差超出限制！');
    }

    // 3. 流动性评分（权重20%）
    const topBid = orderbook.bids?.[0];
    const topAsk = orderbook.asks?.[0];
    const liquidity = Number(topBid?.shares || 0) + Number(topAsk?.shares || 0);

    if (liquidity >= minShares * 2) {
      profitability += 20;
      reasons.push('流动性充足');
    } else if (liquidity >= minShares) {
      profitability += 10;
      reasons.push('流动性一般');
    } else {
      profitability += 5;
      reasons.push('流动性不足');
    }

    // 4. 市场活跃度加分
    const totalDepth = this.calculateTotalDepth(orderbook);
    if (totalDepth > 1000) {
      pointsValue += 10;
      reasons.push('深度充足');
    }

    // 计算综合优先级
    const priority = pointsValue * 0.6 + profitability * 0.4;

    // 计算推荐参数
    const recommendedSpread = this.calculateRecommendedSpread(liquidityRules, currentSpread);
    const recommendedSize = this.calculateRecommendedSize(liquidityRules, orderbook);

    return {
      marketId: market.token_id,
      pointsValue,
      profitability,
      priority,
      recommendedSpread,
      recommendedSize,
      reasons,
    };
  }

  /**
   * 调整订单以优化积分获取
   */
  adjustOrderForPoints(
    market: Market,
    currentSpread: number,
    currentSize: number,
    orderbook: Orderbook
  ): OrderAdjustment {
    const liquidityRules = market.liquidity_activation;
    const warnings: string[] = [];

    if (!liquidityRules) {
      return {
        adjustedSpread: currentSpread,
        adjustedSize: currentSize,
        meetsMinShares: true,
        withinMaxSpread: true,
        pointsEligible: false,
        warnings: ['无积分规则'],
      };
    }

    const maxSpreadCents = this.getMaxSpreadCents(liquidityRules);
    const maxSpread = maxSpreadCents / 100;
    const minShares = liquidityRules.min_shares || 100;

    // 1. 调整价差
    let adjustedSpread = currentSpread;
    const spreadLimit = maxSpread * this.config.maxSpreadSafetyMargin;

    if (currentSpread > spreadLimit) {
      adjustedSpread = spreadLimit * 0.98; // 留2%安全边际
      warnings.push(`价差从${(currentSpread * 100).toFixed(2)}¢调整为${(adjustedSpread * 100).toFixed(2)}¢`);
    } else if (currentSpread < spreadLimit * 0.8) {
      // 如果价差太小，适当增加以提高盈利
      adjustedSpread = Math.max(currentSpread * 1.1, spreadLimit * 0.7);
    }

    // 2. 调整订单大小
    let adjustedSize = currentSize;

    if (this.config.enableDynamicSizing) {
      // 确保至少满足min_shares
      if (currentSize < minShares) {
        adjustedSize = minShares * this.config.minSharesBuffer;
        warnings.push(`订单大小从${currentSize}调整为${adjustedSize.toFixed(0)}以满足min_shares`);
      } else {
        // 如果当前订单已经满足，适当优化以提高效率
        const optimalSize = this.calculateOptimalSize(minShares, orderbook);
        if (Math.abs(currentSize - optimalSize) / currentSize > 0.2) {
          adjustedSize = optimalSize;
          warnings.push(`订单大小优化为${adjustedSize.toFixed(0)}`);
        }
      }
    }

    // 3. 验证积分符合性
    const meetsMinShares = adjustedSize >= minShares;
    const withinMaxSpread = adjustedSpread <= maxSpread;
    const pointsEligible = meetsMinShares && withinMaxSpread;

    // 记录调整历史
    const history = this.adjustmentHistory.get(market.token_id) || [];
    history.push({
      adjustedSpread,
      adjustedSize,
      meetsMinShares,
      withinMaxSpread,
      pointsEligible,
      warnings,
    });

    // 只保留最近20次调整
    if (history.length > 20) {
      history.shift();
    }
    this.adjustmentHistory.set(market.token_id, history);

    return {
      adjustedSpread,
      adjustedSize,
      meetsMinShares,
      withinMaxSpread,
      pointsEligible,
      warnings,
    };
  }

  /**
   * 获取max_spread（cents）
   */
  private getMaxSpreadCents(rules: LiquidityActivation): number {
    if (rules.max_spread_cents) {
      return rules.max_spread_cents;
    }
    if (rules.max_spread) {
      return rules.max_spread * 100;
    }
    return 6; // 默认6 cents
  }

  /**
   * 计算推荐价差
   */
  private calculateRecommendedSpread(rules: LiquidityActivation, currentSpread: number): number {
    const maxSpreadCents = this.getMaxSpreadCents(rules);
    const maxSpread = maxSpreadCents / 100;

    // 目标价差：max_spread的90-95%
    const targetSpread = maxSpread * this.config.maxSpreadSafetyMargin;

    // 如果当前价差接近目标，使用当前价差
    if (Math.abs(currentSpread - targetSpread) / targetSpread < 0.1) {
      return currentSpread;
    }

    // 否则返回目标价差
    return targetSpread;
  }

  /**
   * 计算推荐订单大小
   */
  private calculateRecommendedSize(rules: LiquidityActivation, orderbook: Orderbook): number {
    const minShares = rules.min_shares || 100;

    // 基础大小：min_shares的105%
    let recommendedSize = minShares * this.config.minSharesBuffer;

    // 考虑订单簿深度
    const topBid = orderbook.bids?.[0];
    const topAsk = orderbook.asks?.[0];
    const availableLiquidity = Number(topBid?.shares || 0) + Number(topAsk?.shares || 0);

    // 如果可用流动性不足，降低订单大小
    if (availableLiquidity < recommendedSize * 1.5) {
      recommendedSize = Math.min(recommendedSize, availableLiquidity * 0.8);
    }

    // 确保不会太小
    recommendedSize = Math.max(recommendedSize, minShares);

    return recommendedSize;
  }

  /**
   * 计算最优订单大小
   */
  private calculateOptimalSize(minShares: number, orderbook: Orderbook): number {
    // 计算订单簿中位数深度
    const bidDepths = (orderbook.bids || []).map(b => Number(b.shares || 0)).slice(0, 5);
    const askDepths = (orderbook.asks || []).map(a => Number(a.shares || 0)).slice(0, 5);

    const allDepths = [...bidDepths, ...askDepths];
    if (allDepths.length === 0) return minShares * 1.1;

    const medianDepth = allDepths.sort((a, b) => a - b)[Math.floor(allDepths.length / 2)];

    // 选择minShares和中位数深度的较小值
    return Math.min(minShares * 1.2, medianDepth * 0.5);
  }

  /**
   * 计算总深度
   */
  private calculateTotalDepth(orderbook: Orderbook): number {
    let total = 0;
    for (const bid of orderbook.bids || []) {
      total += Number(bid.shares || 0) * Number(bid.price || 0);
    }
    for (const ask of orderbook.asks || []) {
      total += Number(ask.shares || 0) * (1 - Number(ask.price || 0));
    }
    return total;
  }

  /**
   * 对市场按积分价值排序
   */
  rankMarketsByPoints(
    markets: Market[],
    orderbooks: Map<string, Orderbook>,
    currentSpreads: Map<string, number>
  ): Array<{ market: Market; score: PointsMarketScore }> {
    const scored = markets
      .map(market => {
        const spread = currentSpreads.get(market.token_id) || 0.02;
        const orderbook = orderbooks.get(market.token_id) || {
          token_id: market.token_id,
          bids: [],
          asks: []
        };
        const score = this.evaluateMarket(market, spread, orderbook);
        return { market, score };
      })
      .filter(item => item.score.pointsValue > 0) // 只考虑有积分的市场
      .sort((a, b) => b.score.priority - a.score.priority);

    return scored;
  }

  /**
   * 获取高优先级积分市场
   */
  getTopPointsMarkets(
    markets: Market[],
    orderbooks: Map<string, Orderbook>,
    currentSpreads: Map<string, number>,
    topN: number = 10
  ): Market[] {
    const ranked = this.rankMarketsByPoints(markets, orderbooks, currentSpreads);
    return ranked.slice(0, topN).map(item => item.market);
  }

  /**
   * 获取调整统计
   */
  getAdjustmentStats(marketId: string): {
    totalAdjustments: number;
    avgSpreadAdjustment: number;
    avgSizeAdjustment: number;
    eligibilityRate: number;
  } | null {
    const history = this.adjustmentHistory.get(marketId);
    if (!history || history.length === 0) return null;

    const totalAdjustments = history.length;
    const eligibleCount = history.filter(a => a.pointsEligible).length;

    const spreadAdjustments = history.map(a => a.adjustedSpread);
    const sizeAdjustments = history.map(a => a.adjustedSize);

    const avgSpreadAdjustment =
      spreadAdjustments.reduce((sum, v) => sum + v, 0) / spreadAdjustments.length;
    const avgSizeAdjustment =
      sizeAdjustments.reduce((sum, v) => sum + v, 0) / sizeAdjustments.length;

    return {
      totalAdjustments,
      avgSpreadAdjustment,
      avgSizeAdjustment,
      eligibilityRate: eligibleCount / totalAdjustments,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PointsOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): PointsOptimizationConfig {
    return { ...this.config };
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.marketScores.clear();
    this.adjustmentHistory.clear();
  }
}

// 创建全局单例
export const pointsOptimizerEngine = new PointsOptimizerEngine();
