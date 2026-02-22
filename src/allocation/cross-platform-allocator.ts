/**
 * 跨平台资金分配器
 * 智能分配资金到不同平台以最大化收益和积分
 */

export interface PlatformAllocation {
  platform: 'predict' | 'probable';
  allocatedAmount: number;
  targetAmount: number;
  allocationRatio: number; // 0-1
  expectedReturn: number;
  expectedPoints: number;
  riskScore: number;
  reasons: string[];
}

export interface AllocationConfig {
  totalCapital: number;
  pointsWeight: number; // 积分权重 (0-1)
  profitWeight: number; // 利润权重 (0-1)
  riskWeight: number; // 风险权重 (0-1)
  minAllocation: number; // 最小分配比例
  maxAllocation: number; // 最大分配比例
  rebalanceThreshold: number; // 再平衡阈值
}

export interface PlatformMetrics {
  platform: 'predict' | 'probable';
  currentAllocation: number;
  realizedProfit: number;
  realizedPoints: number;
  volatility: number;
  liquidity: number;
  competition: number; // 竞争程度 0-1
  feeRate: number;
  spreadPotential: number; // 价差潜力
}

/**
 * 跨平台资金分配器
 */
export class CrossPlatformCapitalAllocator {
  private config: AllocationConfig;
  private allocationHistory: PlatformAllocation[][] = [];
  private lastRebalanceTime = 0;

  constructor(config?: Partial<AllocationConfig>) {
    this.config = {
      totalCapital: 1000, // 默认1000 USDT
      pointsWeight: 0.4,
      profitWeight: 0.4,
      riskWeight: 0.2,
      minAllocation: 0.1, // 最小10%
      maxAllocation: 0.8, // 最大80%
      rebalanceThreshold: 0.15, // 15%偏差触发再平衡
      ...config,
    };
  }

  /**
   * 计算最优资金分配
   */
  calculateOptimalAllocation(
    predictMetrics: PlatformMetrics,
    probableMetrics: PlatformMetrics
  ): [PlatformAllocation, PlatformAllocation] {
    const now = Date.now();

    // 1. 评分Predict.fun
    const predictScores = this.scorePlatform(predictMetrics);
    const predictAllocation = this.calculateAllocationRatio(predictScores);

    // 2. 评分Probable.markets
    const probableScores = this.scorePlatform(probableMetrics);
    const probableAllocation = this.calculateAllocationRatio(probableScores);

    // 3. 归一化分配比例（确保总和为1）
    const totalRatio = predictAllocation + probableAllocation;
    let normalizedPredictRatio = predictAllocation / totalRatio;
    let normalizedProbableRatio = probableAllocation / totalRatio;

    // 4. 应用约束
    normalizedPredictRatio = Math.max(
      this.config.minAllocation,
      Math.min(this.config.maxAllocation, normalizedPredictRatio)
    );
    normalizedProbableRatio = 1 - normalizedPredictRatio;

    // 5. 计算分配金额
    const predictAmount = this.config.totalCapital * normalizedPredictRatio;
    const probableAmount = this.config.totalCapital * normalizedProbableRatio;

    // 6. 生成分配方案
    const predictAlloc: PlatformAllocation = {
      platform: 'predict',
      allocatedAmount: predictAmount,
      targetAmount: predictAmount,
      allocationRatio: normalizedPredictRatio,
      expectedReturn: predictMetrics.spreadPotential * predictAmount * (1 - predictMetrics.feeRate),
      expectedPoints: predictMetrics.liquidity * normalizedPredictRatio * 100, // 简化的积分计算
      riskScore: predictMetrics.volatility * 10 + predictMetrics.competition * 5,
      reasons: this.generateAllocationReasons('Predict.fun', normalizedPredictRatio, predictScores),
    };

    const probableAlloc: PlatformAllocation = {
      platform: 'probable',
      allocatedAmount: probableAmount,
      targetAmount: probableAmount,
      allocationRatio: normalizedProbableRatio,
      expectedReturn: probableMetrics.spreadPotential * probableAmount * (1 - probableMetrics.feeRate),
      expectedPoints: 0, // Probable没有积分
      riskScore: probableMetrics.volatility * 10 + probableMetrics.competition * 5,
      reasons: this.generateAllocationReasons('Probable.markets', normalizedProbableRatio, probableScores),
    };

    // 记录历史
    this.allocationHistory.push([predictAlloc, probableAlloc]);
    if (this.allocationHistory.length > 100) {
      this.allocationHistory.shift();
    }

    this.lastRebalanceTime = now;

    return [predictAlloc, probableAlloc];
  }

  /**
   * 评分平台
   */
  private scorePlatform(metrics: PlatformMetrics): {
    pointsScore: number;
    profitScore: number;
    riskScore: number;
    totalScore: number;
  } {
    // 积分评分（只有Predict.fun有）
    let pointsScore = 0;
    if (metrics.platform === 'predict') {
      // 流动性越高，积分获取潜力越大
      pointsScore = Math.min(metrics.liquidity / 1000, 1) * 100;

      // 竞争越低，积分获取越容易
      pointsScore += (1 - metrics.competition) * 30;

      // 价差潜力越大，盈利空间越大
      pointsScore += metrics.spreadPotential * 20;
    }

    // 利润评分
    let profitScore = 0;
    // 价差潜力
    profitScore += metrics.spreadPotential * 40;
    // 手续费率（越低越好）
    profitScore += (1 - metrics.feeRate) * 30;
    // 流动性
    profitScore += Math.min(metrics.liquidity / 500, 1) * 30;

    // 风险评分（越低越好）
    const riskScore = metrics.volatility * 50 + metrics.competition * 30 + (1 - metrics.liquidity / 1000) * 20;

    // 综合评分
    const totalScore =
      pointsScore * this.config.pointsWeight +
      profitScore * this.config.profitWeight +
      (100 - riskScore) * this.config.riskWeight;

    return {
      pointsScore,
      profitScore,
      riskScore,
      totalScore,
    };
  }

  /**
   * 计算分配比例
   */
  private calculateAllocationRatio(scores: {
    pointsScore: number;
    profitScore: number;
    riskScore: number;
    totalScore: number;
  }): number {
    // 使用Sigmoid函数将分数映射到0-1
    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x / 25)); // x/25作为缩放因子

    return sigmoid(scores.totalScore);
  }

  /**
   * 生成分配原因
   */
  private generateAllocationReasons(
    platformName: string,
    ratio: number,
    scores: any
  ): string[] {
    const reasons: string[] = [];
    const percentage = (ratio * 100).toFixed(0);

    if (scores.pointsScore > 50) {
      reasons.push(`积分价值高 (${scores.pointsScore.toFixed(0)}分)`);
    }

    if (scores.profitScore > 50) {
      reasons.push(`盈利潜力大 (${scores.profitScore.toFixed(0)}分)`);
    }

    if (scores.riskScore < 30) {
      reasons.push(`风险可控 (${scores.riskScore.toFixed(0)}分)`);
    }

    if (reasons.length === 0) {
      reasons.push(`综合评分 ${scores.totalScore.toFixed(0)}分`);
    }

    reasons.unshift(`分配${percentage}%资金到${platformName}`);
    return reasons;
  }

  /**
   * 检查是否需要再平衡
   */
  needsRebalance(
    currentAllocations: PlatformAllocation[]
  ): boolean {
    if (currentAllocations.length !== 2) return false;

    const [predict, probable] = currentAllocations;
    const currentRatio = predict.allocationRatio;
    const targetRatio = this.config.pointsWeight; // 简化：假设目标是积分权重

    const deviation = Math.abs(currentRatio - targetRatio);
    return deviation > this.config.rebalanceThreshold;
  }

  /**
   * 计算再平衡方案
   */
  calculateRebalance(
    currentAllocations: PlatformAllocation[],
    predictMetrics: PlatformMetrics,
    probableMetrics: PlatformMetrics
  ): {
    fromPredict: number; // 从Predict转移出的金额
    fromProbable: number; // 从Probable转移出的金额
    newPredictAmount: number;
    newProbableAmount: number;
    estimatedCost: number; // 预计交易成本
  } {
    const [targetPredict, targetProbable] = this.calculateOptimalAllocation(
      predictMetrics,
      probableMetrics
    );

    const currentPredict = currentAllocations.find(a => a.platform === 'predict');
    const currentProbable = currentAllocations.find(a => a.platform === 'probable');

    const fromPredict = Math.max(0, (currentPredict?.allocatedAmount || 0) - targetPredict.allocatedAmount);
    const fromProbable = Math.max(0, (currentProbable?.allocatedAmount || 0) - targetProbable.allocatedAmount);

    // 估算交易成本（手续费）
    const estimatedCost = fromPredict * predictMetrics.feeRate + fromProbable * probableMetrics.feeRate;

    return {
      fromPredict,
      fromProbable,
      newPredictAmount: targetPredict.allocatedAmount,
      newProbableAmount: targetProbable.allocatedAmount,
      estimatedCost,
    };
  }

  /**
   * 获取分配统计
   */
  getAllocationStats(): {
    totalAllocations: number;
    avgPredictAllocation: number;
    avgProbableAllocation: number;
    allocationVolatility: number;
  } {
    if (this.allocationHistory.length === 0) {
      return {
        totalAllocations: 0,
        avgPredictAllocation: 0,
        avgProbableAllocation: 0,
        allocationVolatility: 0,
      };
    }

    const totalAllocations = this.allocationHistory.length;
    let sumPredict = 0;
    let sumProbable = 0;

    for (const [predict, probable] of this.allocationHistory) {
      sumPredict += predict.allocationRatio;
      sumProbable += probable.allocationRatio;
    }

    const avgPredictAllocation = sumPredict / totalAllocations;
    const avgProbableAllocation = sumProbable / totalAllocations;

    // 计算波动性
    const variance = this.allocationHistory.reduce((sum, [predict, probable]) => {
      const diff = predict.allocationRatio - avgPredictAllocation;
      return sum + diff * diff;
    }, 0) / totalAllocations;

    return {
      totalAllocations,
      avgPredictAllocation,
      avgProbableAllocation,
      allocationVolatility: Math.sqrt(variance),
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AllocationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): AllocationConfig {
    return { ...this.config };
  }

  /**
   * 重置历史
   */
  reset(): void {
    this.allocationHistory = [];
    this.lastRebalanceTime = 0;
  }
}

// 创建全局单例
export const crossPlatformCapitalAllocator = new CrossPlatformCapitalAllocator();
