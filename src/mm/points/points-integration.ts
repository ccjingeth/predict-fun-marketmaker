/**
 * 积分系统集成层
 *
 * 整合所有积分优化组件，提供统一的接口
 */

import type { Market, Orderbook } from '../../types.js';
import { pointsManager } from './points-manager.js';
import { pointsOptimizerEngine } from './points-optimizer.js';
import { pointsOptimizerEngineV2, type OptimizedOrderParams } from './points-optimizer-v2.js';
import { smartMarketFilter, type MarketScore } from './smart-market-filter.js';
import { batchProcessor, type BatchCheckResult } from './batch-processor.js';
import { probablePointsAdapter } from './probable-adapter.js';

/**
 * 积分系统配置
 */
export interface PointsSystemConfig {
  enableV2Optimizer: boolean;      // 启用 V2 优化器
  enableSmartFilter: boolean;       // 启用智能筛选
  enableBatchProcessor: boolean;    // 启用批量处理
  autoFilterMarkets: boolean;       // 自动筛选市场
  realTimeOptimization: boolean;    // 实时优化
}

/**
 * 集成结果
 */
export interface IntegrationResult {
  markets: Market[];               // 筛选后的市场
  optimizations: Map<string, OptimizedOrderParams>; // 优化参数
  batchResults: Map<string, BatchCheckResult>; // 批量检查结果
  topMarkets: Market[];             // Top 市场
  stats: {
    totalMarkets: number;
    filteredMarkets: number;
    pointsActiveMarkets: number;
    averageScore: number;
  };
}

/**
 * 积分系统集成
 */
export class PointsSystemIntegration {
  private config: PointsSystemConfig;
  private lastIntegration = 0;
  private integrationInterval = 5000; // 5秒

  constructor(config?: Partial<PointsSystemConfig>) {
    this.config = {
      enableV2Optimizer: true,
      enableSmartFilter: true,
      enableBatchProcessor: true,
      autoFilterMarkets: true,
      realTimeOptimization: true,
      ...config,
    };
  }

  /**
   * 完整集成流程（主入口）
   */
  async integrate(
    allMarkets: Market[],
    orderbooks: Map<string, Orderbook>,
    orderSizes: Map<string, number>,
    spreads: Map<string, number>
  ): Promise<IntegrationResult> {
    const now = Date.now();

    // 1. 智能市场筛选
    let markets = allMarkets;
    let marketScores: MarketScore[] = [];

    if (this.config.enableSmartFilter && this.config.autoFilterMarkets) {
      // 评分市场
      marketScores = await smartMarketFilter.scoreMarkets(allMarkets, orderbooks);

      // 筛选高价值市场
      markets = smartMarketFilter.filterHighValueMarkets(allMarkets, orderbooks);
    }

    // 2. 批量积分检查
    let batchResults = new Map<string, BatchCheckResult>();
    if (this.config.enableBatchProcessor) {
      const results = await batchProcessor.batchCheckPoints(
        markets,
        orderbooks,
        orderSizes,
        spreads
      );
      batchResults = results;
    }

    // 3. 实时优化
    const optimizations = new Map<string, OptimizedOrderParams>();
    if (this.config.enableV2Optimizer && this.config.realTimeOptimization) {
      for (const market of markets) {
        const orderbook = orderbooks.get(market.token_id);
        if (!orderbook) continue;

        const orderSize = orderSizes.get(market.token_id) || 100;
        const spread = spreads.get(market.token_id) || 0.02;

        // V2 优化器
        const optimized = pointsOptimizerEngineV2.optimizeOrder(
          market,
          orderbook.mid_price || 0.5,
          spread,
          'BUY',
          orderbook,
          orderSize
        );

        optimizations.set(market.token_id, optimized);
      }
    }

    // 4. 获取 Top 市场
    const topMarkets = smartMarketFilter.getTopMarkets(20);

    // 5. 计算统计
    const stats = {
      totalMarkets: allMarkets.length,
      filteredMarkets: markets.length,
      pointsActiveMarkets: marketScores.filter(s => s.pointsScore > 0).length,
      averageScore: marketScores.length > 0
        ? marketScores.reduce((sum, s) => sum + s.overallScore, 0) / marketScores.length
        : 0,
    };

    this.lastIntegration = now;

    return {
      markets,
      optimizations,
      batchResults,
      topMarkets,
      stats,
    };
  }

  /**
   * 快速集成（仅筛选）
   */
  quickFilter(allMarkets: Market[], orderbooks: Map<string, Orderbook>): Market[] {
    if (!this.config.enableSmartFilter) {
      return allMarkets;
    }

    return smartMarketFilter.filterHighValueMarkets(allMarkets, orderbooks);
  }

  /**
   * 获取市场评分
   */
  getMarketScore(marketId: string): MarketScore | null {
    return smartMarketFilter.getMarketScore(marketId);
  }

  /**
   * 获取优化参数
   */
  getOptimizedParams(
    market: Market,
    currentPrice: number,
    currentSpread: number,
    side: 'BUY' | 'SELL',
    orderbook: Orderbook,
    currentShares: number
  ): OptimizedOrderParams {
    if (this.config.enableV2Optimizer) {
      return pointsOptimizerEngineV2.optimizeOrder(
        market,
        currentPrice,
        currentSpread,
        side,
        orderbook,
        currentShares
      );
    } else {
      // V1 优化器（备用）
      const adjustment = pointsOptimizerEngine.adjustOrderForPoints(
        market,
        currentSpread,
        currentShares,
        orderbook
      );

      return {
        price: currentPrice,
        shares: adjustment.adjustedSize,
        spread: adjustment.adjustedSpread,
        expectedPoints: adjustment.pointsEligible ? 80 : 20,
        expectedProfit: 50,
        riskScore: 70,
        overallScore: adjustment.pointsEligible ? 75 : 40,
        confidence: 70,
        reasons: adjustment.warnings,
      };
    }
  }

  /**
   * 批量检查积分
   */
  async batchCheck(
    markets: Market[],
    orderbooks: Map<string, Orderbook>,
    orderSizes: Map<string, number>,
    spreads: Map<string, number>
  ): Promise<Map<string, BatchCheckResult>> {
    if (this.config.enableBatchProcessor) {
      return await batchProcessor.batchCheckPoints(
        markets,
        orderbooks,
        orderSizes,
        spreads
      );
    }

    // 降级到逐个检查
    const results = new Map<string, BatchCheckResult>();
    for (const market of markets) {
      const orderbook = orderbooks.get(market.token_id);
      const orderSize = orderSizes.get(market.token_id) || 100;
      const spread = spreads.get(market.token_id) || 0.02;

      if (!orderbook) continue;

      const check = pointsManager.checkOrderEligibility(market, orderSize, spread);
      results.set(market.token_id, {
        marketId: market.token_id,
        isEligible: check.isEligible,
        reason: check.reason || '',
      });
    }

    return results;
  }

  /**
   * 记录订单结果
   */
  recordOrder(
    market: Market,
    orderSize: number,
    spread: number,
    isEligible: boolean,
    orderbook?: Orderbook
  ): void {
    // 记录到积分管理器
    pointsManager.recordOrder(market, orderSize, spread, isEligible);

    // 记录到 Probable 适配器
    if (orderbook) {
      probablePointsAdapter.recordProbableOrder(market, orderSize, spread, orderbook);
    }

    // 记录到 V2 优化器（用于机器学习）
    pointsOptimizerEngineV2.recordOrderResult({
      timestamp: Date.now(),
      marketId: market.token_id,
      orderSize,
      spread,
      wasFilled: isEligible,
      pointsEarned: isEligible,
      profit: spread * orderSize,
      fillTime: 1000, // 默认 1 秒
    });
  }

  /**
   * 获取积分统计
   */
  getPointsStats() {
    return pointsManager.getStats();
  }

  /**
   * 获取 Top 市场
   */
  getTopMarkets(n: number = 20): Market[] {
    return smartMarketFilter.getTopMarkets(n);
  }

  /**
   * 获取批量处理器统计
   */
  getBatchStats() {
    return batchProcessor.getStats();
  }

  /**
   * 清理过期数据
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    pointsManager.clearExpired(maxAge);
    probablePointsAdapter.clearExpired(maxAge);
    batchProcessor.clearCache();
    smartMarketFilter.clearCache();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PointsSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): PointsSystemConfig {
    return { ...this.config };
  }

  /**
   * 重置所有组件
   */
  reset(): void {
    pointsManager.reset();
    pointsOptimizerEngine.reset();
    pointsOptimizerEngineV2.reset();
    smartMarketFilter.reset();
    batchProcessor.reset();
    probablePointsAdapter.reset();
  }

  /**
   * 导出状态
   */
  exportState() {
    return {
      pointsManager: pointsManager.toJSON(),
      v2Optimizer: {
        history: Array.from(pointsOptimizerEngineV2['history'].entries()).length,
        cacheSize: pointsOptimizerEngineV2['marketAnalysisCache'].size,
      },
      smartFilter: {
        scores: smartMarketFilter.getAllScores().length,
        cacheSize: smartMarketFilter['orderbookCache'].size,
      },
      batchProcessor: {
        queueLength: batchProcessor.getQueueLength(),
        stats: batchProcessor.getStats(),
      },
      probableAdapter: {
        metrics: probablePointsAdapter.getAllMetrics(),
      },
    };
  }
}

// 创建全局单例
export const pointsSystemIntegration = new PointsSystemIntegration();
