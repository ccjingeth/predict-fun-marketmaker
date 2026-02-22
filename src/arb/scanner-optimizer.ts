/**
 * 套利扫描优化模块
 * 用于提高套利扫描性能，减少不必要的计算
 */

export interface MarketScore {
  marketId: string;
  score: number;
  lastScanTime: number;
  scanCount: number;
  opportunityCount: number;
  liquidityScore: number;
  volatilityScore: number;
}

export interface ScanConfig {
  maxMarketsPerScan: number; // 每次扫描最大市场数
  minLiquidityThreshold: number; // 最小流动性阈值
  minVolatilityThreshold: number; // 最小波动性阈值
  scanIntervalMs: number; // 扫描间隔
  incrementalScan: boolean; // 是否启用增量扫描
  parallelScans: number; // 并行扫描数
}

/**
 * 套利扫描优化器
 */
export class ArbitrageScannerOptimizer {
  private marketScores = new Map<string, MarketScore>();
  private scanQueue: string[] = [];
  private lastScanTime = 0;
  private config: ScanConfig;

  constructor(config?: Partial<ScanConfig>) {
    this.config = {
      maxMarketsPerScan: 50,
      minLiquidityThreshold: 100, // 最小100 USDT流动性
      minVolatilityThreshold: 0.005, // 最小0.5%波动
      scanIntervalMs: 5000,
      incrementalScan: true,
      parallelScans: 3,
      ...config,
    };
  }

  /**
   * 计算市场优先级分数
   * 分数越高，优先级越高
   */
  calculateMarketScore(
    marketId: string,
    liquidity: number,
    volatility: number,
    recentOpportunities: number
  ): number {
    let score = 0;

    // 流动性评分（权重40%）
    const liquidityScore = Math.min(liquidity / this.config.minLiquidityThreshold, 10);
    score += liquidityScore * 0.4;

    // 波动性评分（权重30%）
    const volatilityScore = Math.min(volatility / this.config.minVolatilityThreshold, 10);
    score += volatilityScore * 0.3;

    // 机会评分（权重20%）
    const opportunityScore = Math.min(recentOpportunities * 2, 10);
    score += opportunityScore * 0.2;

    // 历史评分（权重10%）
    const historicalScore = this.marketScores.get(marketId)?.score || 5;
    score += historicalScore * 0.1;

    return score;
  }

  /**
   * 更新市场分数
   */
  updateMarketScore(
    marketId: string,
    liquidity: number,
    volatility: number,
    foundOpportunity: boolean
  ): void {
    const existing = this.marketScores.get(marketId);
    const scanCount = (existing?.scanCount || 0) + 1;
    const opportunityCount = existing?.opportunityCount || 0;

    const score = this.calculateMarketScore(
      marketId,
      liquidity,
      volatility,
      foundOpportunity ? opportunityCount + 1 : opportunityCount
    );

    this.marketScores.set(marketId, {
      marketId,
      score,
      lastScanTime: Date.now(),
      scanCount,
      opportunityCount: foundOpportunity ? opportunityCount + 1 : opportunityCount,
      liquidityScore: liquidity,
      volatilityScore: volatility,
    });
  }

  /**
   * 获取扫描队列
   * 返回应该优先扫描的市场列表
   */
  getScanQueue(allMarketIds: string[]): string[] {
    if (!this.config.incrementalScan) {
      // 非增量模式：扫描所有市场
      return this.shuffleAndLimit(allMarketIds);
    }

    // 增量模式：只扫描高优先级市场
    const scored = allMarketIds
      .map(id => ({
        id,
        score: this.marketScores.get(id)?.score || 5,
        lastScan: this.marketScores.get(id)?.lastScanTime || 0,
      }))
      .filter(m => m.score >= 3) // 过滤低分市场
      .sort((a, b) => {
        // 优先扫描高分市场
        if (b.score !== a.score) return b.score - a.score;
        // 其次扫描很久没扫描的
        return a.lastScan - b.lastScan;
      })
      .slice(0, this.config.maxMarketsPerScan)
      .map(m => m.id);

    return scored;
  }

  /**
   * 预筛选市场
   * 过滤掉不符合条件的市场
   */
  filterMarkets(
    markets: Array<{
      id: string;
      liquidity?: number;
      volatility?: number;
      active?: boolean;
    }>
  ): string[] {
    return markets
      .filter(m => {
        // 过滤条件
        if (m.active === false) return false;
        if (m.liquidity !== undefined && m.liquidity < this.config.minLiquidityThreshold) return false;
        if (m.volatility !== undefined && m.volatility < this.config.minVolatilityThreshold) return false;
        return true;
      })
      .map(m => m.id);
  }

  /**
   * 检查是否应该扫描
   * 基于时间间隔控制扫描频率
   */
  shouldScan(): boolean {
    const now = Date.now();
    if (now - this.lastScanTime < this.config.scanIntervalMs) {
      return false;
    }
    this.lastScanTime = now;
    return true;
  }

  /**
   * 获取批量大小
   * 用于并行扫描
   */
  getBatchSize(): number {
    return Math.max(1, Math.ceil(this.config.maxMarketsPerScan / this.config.parallelScans));
  }

  /**
   * 清除过期分数
   */
  evictStaleScores(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const cutoff = now - maxAge;

    for (const [id, score] of this.marketScores.entries()) {
      if (score.lastScanTime < cutoff) {
        this.marketScores.delete(id);
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalMarkets: number;
    avgScore: number;
    topMarkets: MarketScore[];
    scanRate: number;
  } {
    const scores = Array.from(this.marketScores.values());
    const avgScore =
      scores.length > 0
        ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
        : 0;

    const topMarkets = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const scanRate =
      scores.length > 0
        ? scores.reduce((sum, s) => sum + s.scanCount, 0) / scores.length
        : 0;

    return {
      totalMarkets: scores.length,
      avgScore,
      topMarkets,
      scanRate,
    };
  }

  /**
   * 重置所有统计数据
   */
  reset(): void {
    this.marketScores.clear();
    this.scanQueue = [];
    this.lastScanTime = 0;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ScanConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 洗牌并限制数组大小
   */
  private shuffleAndLimit(arr: string[]): string[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, this.config.maxMarketsPerScan);
  }
}

// 创建全局单例
export const arbScannerOptimizer = new ArbitrageScannerOptimizer();
