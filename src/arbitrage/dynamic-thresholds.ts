/**
 * Dynamic Threshold System
 * 动态阈值系统 - 根据市场状况自动调整
 */

import type { MarketData, OrderBook } from '../external/types.js';

export interface DynamicThresholds {
  // 站内套利
  inPlatformMinProfit: number;        // 最小利润率
  inPlatformMinDepth: number;         // 最小深度
  inPlatformMaxSlippage: number;      // 最大滑点

  // 跨平台套利
  crossPlatformMinProfit: number;     // 最小利润率
  crossPlatformMinSimilarity: number;  // 最小相似度
  crossPlatformMaxSlippage: number;    // 最大滑点

  // 市场状况
  marketVolatility: 'LOW' | 'MEDIUM' | 'HIGH';
  liquidityLevel: 'LOW' | 'MEDIUM' | 'HIGH';

  // 推荐配置
  recommendedConfig: {
    maxShares: number;
    positionSize: number;
    useVWAPCheck: boolean;
    aggressive: boolean;
  };
}

export interface MarketData {
  marketId: string;
  priceHistory?: number[];
  orderbook?: OrderBook;
  volume24h?: number;
}

/**
 * 计算动态阈值
 */
export function calculateDynamicThresholds(
  marketData: MarketData[]
): DynamicThresholds {
  // 计算市场波动率
  const avgVolatility = calculateAverageVolatility(marketData);

  // 计算平均流动性
  const avgLiquidity = calculateAverageLiquidity(marketData);

  // 根据市场状况调整阈值
  let thresholds: DynamicThresholds;

  if (avgVolatility < 0.01 && avgLiquidity > 10000) {
    // 低波动、高流动性 - 激进模式
    thresholds = {
      inPlatformMinProfit: 0.005,      // 0.5%
      inPlatformMinDepth: 50,
      inPlatformMaxSlippage: 0.002,
      crossPlatformMinProfit: 0.015,   // 1.5%
      crossPlatformMinSimilarity: 0.75,
      crossPlatformMaxSlippage: 0.01,
      marketVolatility: 'LOW',
      liquidityLevel: 'HIGH',
      recommendedConfig: {
        maxShares: 200,
        positionSize: 100,
        useVWAPCheck: false,
        aggressive: true,
      },
    };
  } else if (avgVolatility > 0.05 || avgLiquidity < 1000) {
    // 高波动、低流动性 - 保守模式
    thresholds = {
      inPlatformMinProfit: 0.02,       // 2%
      inPlatformMinDepth: 200,
      inPlatformMaxSlippage: 0.01,
      crossPlatformMinProfit: 0.05,    // 5%
      crossPlatformMinSimilarity: 0.85,
      crossPlatformMaxSlippage: 0.03,
      marketVolatility: 'HIGH',
      liquidityLevel: 'LOW',
      recommendedConfig: {
        maxShares: 50,
        positionSize: 25,
        useVWAPCheck: true,
        aggressive: false,
      },
    };
  } else {
    // 中等情况 - 平衡模式
    thresholds = {
      inPlatformMinProfit: 0.01,       // 1%
      inPlatformMinDepth: 100,
      inPlatformMaxSlippage: 0.005,
      crossPlatformMinProfit: 0.02,    // 2%
      crossPlatformMinSimilarity: 0.78,
      crossPlatformMaxSlippage: 0.02,
      marketVolatility: 'MEDIUM',
      liquidityLevel: 'MEDIUM',
      recommendedConfig: {
        maxShares: 100,
        positionSize: 50,
        useVWAPCheck: true,
        aggressive: false,
      },
    };
  }

  return thresholds;
}

/**
 * 计算平均波动率
 */
function calculateAverageVolatility(markets: MarketData[]): number {
  const volatilities = markets.map(m => {
    if (!m.priceHistory || m.priceHistory.length < 2) return 0.02; // 默认 2%

    const changes = [];
    for (let i = 1; i < Math.min(m.priceHistory.length, 20); i++) {
      const change = Math.abs(
        (m.priceHistory[i] - m.priceHistory[i-1]) / m.priceHistory[i-1]
      );
      changes.push(change);
    }

    return changes.reduce((a, b) => a + b, 0) / changes.length;
  });

  return volatilities.reduce((a, b) => a + b, 0) / volatilities.length;
}

/**
 * 计算平均流动性
 */
function calculateAverageLiquidity(markets: MarketData[]): number {
  const liquidities = markets.map(m => {
    if (!m.orderbook) return 1000; // 默认 $1000

    const bids = m.orderbook.bids?.reduce((sum, bid) => sum + bid.size, 0) || 0;
    const asks = m.orderbook.asks?.reduce((sum, ask) => sum + ask.size, 0) || 0;

    return (bids + asks) / 2;
  });

  return liquidities.reduce((a, b) => a + b, 0) / liquidities.length;
}

/**
 * 实时更新阈值（增量更新）
 */
export class DynamicThresholdManager {
  private thresholds: DynamicThresholds | null = null;
  private lastUpdate: number = 0;
  private updateInterval: number = 60000; // 1 分钟更新一次

  constructor(updateInterval: number = 60000) {
    this.updateInterval = updateInterval;
  }

  /**
   * 获取当前阈值（如果过期则更新）
   */
  async getThresholds(
    marketData: MarketData[],
    forceUpdate: boolean = false
  ): Promise<DynamicThresholds> {
    const now = Date.now();

    if (!this.thresholds || forceUpdate || (now - this.lastUpdate) > this.updateInterval) {
      this.thresholds = calculateDynamicThresholds(marketData);
      this.lastUpdate = now;
    }

    return this.thresholds;
  }

  /**
   * 检查是否应该保守执行
   */
  shouldConservative(thresholds: DynamicThresholds): boolean {
    return thresholds.marketVolatility === 'HIGH' ||
           thresholds.liquidityLevel === 'LOW';
  }

  /**
   * 检查是否应该激进执行
   */
  shouldAggressive(thresholds: DynamicThresholds): boolean {
    return thresholds.marketVolatility === 'LOW' &&
           thresholds.liquidityLevel === 'HIGH';
  }
}
