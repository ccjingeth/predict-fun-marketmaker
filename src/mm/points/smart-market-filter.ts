/**
 * 智能市场筛选器
 *
 * 功能：
 * 1. 实时市场评分
 * 2. 自动筛选高价值市场
 * 3. 动态调整市场优先级
 * 4. 多维度评分（积分、利润、风险）
 * 5. 批量处理优化
 */

import type { Market, Orderbook } from '../../types.js';
import { pointsManager } from './points-manager.js';
import { pointsOptimizerEngineV2, MarketCondition } from './points-optimizer-v2.js';

/**
 * 市场评分结果
 */
export interface MarketScore {
  market: Market;
  overallScore: number;      // 综合评分 0-100
  pointsScore: number;       // 积分评分 0-100
  profitScore: number;       // 利润评分 0-100
  riskScore: number;         // 风险评分 0-100
  priority: number;          // 优先级（用于排序）
  condition: MarketCondition; // 市场状况
  reasons: string[];         // 评分原因
  timestamp: number;         // 评分时间
}

/**
 * 筛选配置
 */
export interface FilterConfig {
  minPointsScore: number;      // 最低积分评分
  minProfitScore: number;      // 最低利润评分
  minRiskScore: number;        // 最低风险评分
  maxMarkets: number;          // 最大市场数量
  enableAutoFilter: boolean;   // 启用自动筛选
  updateInterval: number;      // 更新间隔（毫秒）
}

/**
 * 智能市场筛选器
 */
export class SmartMarketFilter {
  private config: FilterConfig;
  private scores: Map<string, MarketScore> = new Map();
  private lastUpdate = 0;
  private orderbookCache: Map<string, { orderbook: Orderbook; timestamp: number }> = new Map();
  private cacheTTL = 5000; // 5秒缓存

  constructor(config?: Partial<FilterConfig>) {
    this.config = {
      minPointsScore: 50,
      minProfitScore: 40,
      minRiskScore: 30,
      maxMarkets: 50,
      enableAutoFilter: true,
      updateInterval: 10000, // 10秒
      ...config,
    };
  }

  /**
   * 批量评分市场
   */
  async scoreMarkets(
    markets: Market[],
    orderbooks: Map<string, Orderbook>
  ): Promise<MarketScore[]> {
    const now = Date.now();

    // 批量处理
    const scoredMarkets = await Promise.all(
      markets.map(async (market) => {
        // 检查缓存
        const cached = this.scores.get(market.token_id);
        if (cached && now - cached.timestamp < this.config.updateInterval) {
          return cached;
        }

        // 获取订单簿
        const orderbook = orderbooks.get(market.token_id);
        if (!orderbook) {
          return null;
        }

        // 计算评分
        const score = await this.calculateScore(market, orderbook);
        return score;
      })
    );

    // 过滤空值并更新缓存
    const validScores = scoredMarkets.filter((s): s is MarketScore => s !== null);
    for (const score of validScores) {
      this.scores.set(score.market.token_id, score);
    }

    return validScores;
  }

  /**
   * 计算市场评分
   */
  private async calculateScore(
    market: Market,
    orderbook: Orderbook
  ): Promise<MarketScore> {
    const reasons: string[] = [];

    // 1. 积分评分（权重 40%）
    const pointsScore = this.calculatePointsScore(market, orderbook);
    reasons.push(`积分: ${pointsScore.toFixed(0)}/100`);

    // 2. 利润评分（权重 35%）
    const profitScore = this.calculateProfitScore(market, orderbook);
    reasons.push(`利润: ${profitScore.toFixed(0)}/100`);

    // 3. 风险评分（权重 25%）
    const riskScore = this.calculateRiskScore(market, orderbook);
    reasons.push(`风险: ${riskScore.toFixed(0)}/100`);

    // 4. 获取市场状况
    const analysis = pointsOptimizerEngineV2.getMarketAnalysis(market.token_id);
    const condition = analysis?.condition || MarketCondition.FAIR;
    reasons.push(`状况: ${condition}`);

    // 5. 计算综合评分
    const overallScore =
      pointsScore * 0.4 +
      profitScore * 0.35 +
      riskScore * 0.25;

    // 6. 计算优先级（综合评分 + 状况加成）
    let priority = overallScore;
    switch (condition) {
      case MarketCondition.EXCELLENT:
        priority += 10;
        break;
      case MarketCondition.GOOD:
        priority += 5;
        break;
      case MarketCondition.FAIR:
        priority += 0;
        break;
      case MarketCondition.POOR:
        priority -= 5;
        break;
      case MarketCondition.DANGER:
        priority -= 10;
        break;
    }

    return {
      market,
      overallScore,
      pointsScore,
      profitScore,
      riskScore,
      priority,
      condition,
      reasons,
      timestamp: Date.now(),
    };
  }

  /**
   * 计算积分评分
   */
  private calculatePointsScore(market: Market, orderbook: Orderbook): number {
    const rules = market.liquidity_activation;
    if (!rules) {
      return 0; // 无积分规则
    }

    let score = 0;

    // 1. 最小订单要求（权重 40%）
    const minShares = rules.min_shares || 100;
    const topBid = Number(orderbook.bids?.[0]?.shares || 0);
    const topAsk = Number(orderbook.asks?.[0]?.shares || 0);
    const liquidity = topBid + topAsk;

    if (liquidity >= minShares * 2) {
      score += 40;
    } else if (liquidity >= minShares * 1.5) {
      score += 30;
    } else if (liquidity >= minShares) {
      score += 20;
    } else {
      score += 10;
    }

    // 2. 价差限制（权重 40%）
    const maxSpread = rules.max_spread ?? (rules.max_spread_cents ? rules.max_spread_cents / 100 : 0.06);
    const currentSpread = orderbook.spread ?? 0.02;
    const spreadRatio = currentSpread / maxSpread;

    if (spreadRatio <= 0.5) {
      score += 40;
    } else if (spreadRatio <= 0.7) {
      score += 30;
    } else if (spreadRatio <= 0.9) {
      score += 20;
    } else if (spreadRatio <= 1.0) {
      score += 10;
    } else {
      score += 0;
    }

    // 3. 历史积分效率（权重 20%）
    const stats = pointsManager.getMarketStats(market.token_id);
    if (stats && stats.totalOrders > 0) {
      const efficiency = (stats.eligibleOrders / stats.totalOrders) * 100;
      score += efficiency * 0.2;
    } else {
      score += 10; // 无历史数据时给中性分
    }

    return score;
  }

  /**
   * 计算利润评分
   */
  private calculateProfitScore(market: Market, orderbook: Orderbook): number {
    let score = 0;

    // 1. 价差大小（权重 60%）
    const spread = orderbook.spread ?? orderbook.mid_price ? 0.02 : 0;
    if (spread >= 0.05) {
      score = 60;
    } else if (spread >= 0.03) {
      score = 45;
    } else if (spread >= 0.02) {
      score = 30;
    } else if (spread >= 0.01) {
      score = 15;
    } else {
      score = 5;
    }

    // 2. 深度（权重 40%）
    const bidDepth = (orderbook.bids || []).slice(0, 3).reduce((sum, b) => sum + Number(b.shares || 0), 0);
    const askDepth = (orderbook.asks || []).slice(0, 3).reduce((sum, a) => sum + Number(a.shares || 0), 0);
    const totalDepth = bidDepth + askDepth;

    if (totalDepth >= 500) {
      score += 40;
    } else if (totalDepth >= 300) {
      score += 30;
    } else if (totalDepth >= 100) {
      score += 20;
    } else {
      score += 10;
    }

    return score;
  }

  /**
   * 计算风险评分
   */
  private calculateRiskScore(market: Market, orderbook: Orderbook): number {
    let score = 100;

    // 1. 流动性风险（减分）
    const topBid = Number(orderbook.bids?.[0]?.shares || 0);
    const topAsk = Number(orderbook.asks?.[0]?.shares || 0);
    const liquidity = topBid + topAsk;

    if (liquidity < 50) {
      score -= 30;
    } else if (liquidity < 100) {
      score -= 20;
    } else if (liquidity < 200) {
      score -= 10;
    }

    // 2. 价差波动风险（减分）
    const spread = orderbook.spread ?? 0.02;
    if (spread > 0.08) {
      score -= 20;
    } else if (spread > 0.06) {
      score -= 10;
    }

    // 3. 深度不平衡风险（减分）
    const depthRatio = topBid / (topAsk || 1);
    if (depthRatio > 3 || depthRatio < 0.33) {
      score -= 15;
    } else if (depthRatio > 2 || depthRatio < 0.5) {
      score -= 8;
    }

    // 4. 历史成交风险（减分）
    const stats = pointsManager.getMarketStats(market.token_id);
    if (stats && stats.totalOrders > 10) {
      const efficiency = stats.eligibleOrders / stats.totalOrders;
      if (efficiency < 0.5) {
        score -= 20;
      } else if (efficiency < 0.7) {
        score -= 10;
      }
    }

    return Math.max(0, score);
  }

  /**
   * 筛选高价值市场
   */
  filterHighValueMarkets(allMarkets: Market[], orderbooks: Map<string, Orderbook>): Market[] {
    if (!this.config.enableAutoFilter) {
      return allMarkets;
    }

    const now = Date.now();
    if (now - this.lastUpdate < this.config.updateInterval && this.scores.size > 0) {
      // 使用缓存结果
      const cached = Array.from(this.scores.values())
        .filter(s =>
          s.pointsScore >= this.config.minPointsScore &&
          s.profitScore >= this.config.minProfitScore &&
          s.riskScore >= this.config.minRiskScore
        )
        .sort((a, b) => b.priority - a.priority)
        .slice(0, this.config.maxMarkets)
        .map(s => s.market);

      return cached;
    }

    // 重新评分
    const scored = Array.from(this.scores.values())
      .filter(s =>
        s.pointsScore >= this.config.minPointsScore &&
        s.profitScore >= this.config.minProfitScore &&
        s.riskScore >= this.config.minRiskScore
      )
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.config.maxMarkets);

    this.lastUpdate = now;

    return scored.map(s => s.market);
  }

  /**
   * 获取市场评分
   */
  getMarketScore(marketId: string): MarketScore | null {
    return this.scores.get(marketId) || null;
  }

  /**
   * 获取所有评分
   */
  getAllScores(): MarketScore[] {
    return Array.from(this.scores.values());
  }

  /**
   * 获取 Top N 市场
   */
  getTopMarkets(n: number = 20): Market[] {
    return Array.from(this.scores.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, n)
      .map(s => s.market);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<FilterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): FilterConfig {
    return { ...this.config };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.scores.clear();
    this.orderbookCache.clear();
  }

  /**
   * 重置
   */
  reset(): void {
    this.clearCache();
    this.lastUpdate = 0;
  }
}

// 创建全局单例
export const smartMarketFilter = new SmartMarketFilter();
