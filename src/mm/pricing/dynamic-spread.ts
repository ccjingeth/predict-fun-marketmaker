/**
 * 动态价差调整模块
 * 基于市场状况自动调整价差以优化收益和风险
 */

export interface MarketCondition {
  volatility: number; // 波动性
  liquidity: number; // 流动性
  spread: number; // 当前价差
  volume: number; // 成交量
  pressure: number; // 买卖压力
  depthTrend: number; // 深度趋势
  imbalance: number; // 订单簿失衡
}

export interface SpreadAdjustment {
  newSpread: number;
  confidence: number; // 0-1, 调整的置信度
  reason: string; // 调整原因
  factors: Record<string, number>; // 各因素的贡献
}

export interface DynamicSpreadConfig {
  baseSpread: number;
  minSpread: number;
  maxSpread: number;
  volatilityWeight: number; // 波动性权重
  liquidityWeight: number; // 流动性权重
  volumeWeight: number; // 成交量权重
  pressureWeight: number; // 压力权重
  adjustmentSpeed: number; // 调整速度 (0-1)
  confidenceThreshold: number; // 最小置信度
}

/**
 * 动态价差调整器
 */
export class DynamicSpreadAdjuster {
  private config: DynamicSpreadConfig;
  private spreadHistory = new Map<string, number[]>(); // 价差历史
  private lastAdjustmentTime = 0;
  private adjustmentCount = 0;

  constructor(config?: Partial<DynamicSpreadConfig>) {
    this.config = {
      baseSpread: 0.02,
      minSpread: 0.005,
      maxSpread: 0.10,
      volatilityWeight: 0.30,
      liquidityWeight: 0.25,
      volumeWeight: 0.20,
      pressureWeight: 0.15,
      adjustmentSpeed: 0.5,
      confidenceThreshold: 0.6,
      ...config,
    };
  }

  /**
   * 计算动态价差调整
   */
  calculateAdjustment(
    marketId: string,
    condition: MarketCondition,
    currentSpread: number
  ): SpreadAdjustment {
    const factors: Record<string, number> = {};

    // 1. 波动性因素
    const volatilityFactor = this.calculateVolatilityFactor(condition.volatility);
    factors.volatility = volatilityFactor;

    // 2. 流动性因素
    const liquidityFactor = this.calculateLiquidityFactor(condition.liquidity);
    factors.liquidity = liquidityFactor;

    // 3. 成交量因素
    const volumeFactor = this.calculateVolumeFactor(condition.volume);
    factors.volume = volumeFactor;

    // 4. 压力因素
    const pressureFactor = this.calculatePressureFactor(condition.pressure);
    factors.pressure = pressureFactor;

    // 5. 深度趋势因素
    const depthFactor = this.calculateDepthTrendFactor(condition.depthTrend);
    factors.depthTrend = depthFactor;

    // 6. 订单簿失衡因素
    const imbalanceFactor = this.calculateImbalanceFactor(condition.imbalance);
    factors.imbalance = imbalanceFactor;

    // 计算加权调整
    const weightedAdjustment =
      volatilityFactor * this.config.volatilityWeight +
      liquidityFactor * this.config.liquidityWeight +
      volumeFactor * this.config.volumeWeight +
      pressureFactor * this.config.pressureWeight +
      depthFactor * 0.05 +
      imbalanceFactor * 0.05;

    // 计算新价差
    const targetSpread = currentSpread * (1 + weightedAdjustment);
    const clampedSpread = Math.max(
      this.config.minSpread,
      Math.min(this.config.maxSpread, targetSpread)
    );

    // 平滑调整
    const smoothedSpread =
      currentSpread * (1 - this.config.adjustmentSpeed) +
      clampedSpread * this.config.adjustmentSpeed;

    // 计算置信度
    const confidence = this.calculateConfidence(condition, factors);

    // 生成调整原因
    const reason = this.generateReason(factors, weightedAdjustment);

    // 更新历史
    this.updateHistory(marketId, smoothedSpread);

    return {
      newSpread: smoothedSpread,
      confidence,
      reason,
      factors,
    };
  }

  /**
   * 波动性因素计算
   * 高波动 -> 扩大价差
   */
  private calculateVolatilityFactor(volatility: number): number {
    // 波动性 > 1% 时开始扩大价差
    if (volatility > 0.01) {
      return Math.min((volatility - 0.01) * 5, 0.5); // 最多增加50%
    }
    // 低波动时可以缩小价差
    if (volatility < 0.005) {
      return -(0.005 - volatility) * 3; // 最多减少15%
    }
    return 0;
  }

  /**
   * 流动性因素计算
   * 低流动性 -> 扩大价差
   */
  private calculateLiquidityFactor(liquidity: number): number {
    const threshold = 1000; // 1000 USDT
    if (liquidity < threshold) {
      return -((threshold - liquidity) / threshold) * 0.3; // 最多减少30%
    }
    return 0;
  }

  /**
   * 成交量因素计算
   * 高成交量 -> 可以缩小价差
   */
  private calculateVolumeFactor(volume: number): number {
    const threshold = 10000; // 10000 USDT
    if (volume > threshold) {
      return -Math.min((volume - threshold) / threshold * 0.2, 0.2); // 最多减少20%
    }
    return 0;
  }

  /**
   * 压力因素计算
   * 高压力（单边）-> 扩大价差
   */
  private calculatePressureFactor(pressure: number): number {
    // 压力绝对值 > 0.5 时扩大价差
    const absPressure = Math.abs(pressure);
    if (absPressure > 0.5) {
      return (absPressure - 0.5) * 0.3; // 最多增加30%
    }
    return 0;
  }

  /**
   * 深度趋势因素计算
   * 深度下降 -> 扩大价差
   */
  private calculateDepthTrendFactor(depthTrend: number): number {
    if (depthTrend < 0.8) {
      return (0.8 - depthTrend) * 0.2; // 最多增加20%
    }
    return 0;
  }

  /**
   * 订单簿失衡因素计算
   * 严重失衡 -> 扩大价差
   */
  private calculateImbalanceFactor(imbalance: number): number {
    const absImbalance = Math.abs(imbalance);
    if (absImbalance > 0.3) {
      return (absImbalance - 0.3) * 0.3; // 最多增加30%
    }
    return 0;
  }

  /**
   * 计算调整置信度
   */
  private calculateConfidence(
    condition: MarketCondition,
    factors: Record<string, number>
  ): number {
    let confidence = 0.5; // 基础置信度

    // 数据完整性加分
    if (condition.volatility > 0) confidence += 0.1;
    if (condition.liquidity > 0) confidence += 0.1;
    if (condition.volume > 0) confidence += 0.1;

    // 调整方向一致性加分
    const adjustments = Object.values(factors);
    const allPositive = adjustments.every(a => a > 0);
    const allNegative = adjustments.every(a => a < 0);
    if (allPositive || allNegative) confidence += 0.15;

    // 调整幅度合理性
    const totalAdjustment = Math.abs(adjustments.reduce((sum, a) => sum + a, 0));
    if (totalAdjustment > 0.05 && totalAdjustment < 0.3) {
      confidence += 0.05;
    }

    return Math.min(1, confidence);
  }

  /**
   * 生成调整原因
   */
  private generateReason(
    factors: Record<string, number>,
    totalAdjustment: number
  ): string {
    const reasons: string[] = [];

    if (Math.abs(factors.volatility) > 0.05) {
      reasons.push(factors.volatility > 0 ? '高波动' : '低波动');
    }
    if (Math.abs(factors.liquidity) > 0.05) {
      reasons.push(factors.liquidity > 0 ? '流动性充足' : '流动性不足');
    }
    if (Math.abs(factors.volume) > 0.05) {
      reasons.push(factors.volume > 0 ? '低成交量' : '高成交量');
    }
    if (Math.abs(factors.pressure) > 0.05) {
      reasons.push(factors.pressure > 0 ? '买压高' : '卖压高');
    }
    if (Math.abs(factors.depthTrend) > 0.05) {
      reasons.push(factors.depthTrend > 0 ? '深度增加' : '深度下降');
    }
    if (Math.abs(factors.imbalance) > 0.05) {
      reasons.push('订单簿失衡');
    }

    if (reasons.length === 0) {
      return '市场状况稳定';
    }

    const direction = totalAdjustment > 0 ? '扩大' : '缩小';
    return `${direction}价差: ${reasons.join(', ')}`;
  }

  /**
   * 更新价差历史
   */
  private updateHistory(marketId: string, spread: number): void {
    if (!this.spreadHistory.has(marketId)) {
      this.spreadHistory.set(marketId, []);
    }

    const history = this.spreadHistory.get(marketId)!;
    history.push(spread);

    // 保持最近100条记录
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * 获取价差历史
   */
  getHistory(marketId: string): number[] {
    return this.spreadHistory.get(marketId) || [];
  }

  /**
   * 计算价差波动性
   */
  getSpreadVolatility(marketId: string): number {
    const history = this.getHistory(marketId);
    if (history.length < 2) return 0;

    const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
    const variance = history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / history.length;
    return Math.sqrt(variance);
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.spreadHistory.clear();
    this.lastAdjustmentTime = 0;
    this.adjustmentCount = 0;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DynamicSpreadConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): DynamicSpreadConfig {
    return { ...this.config };
  }
}

// 创建全局单例
export const dynamicSpreadAdjuster = new DynamicSpreadAdjuster();
