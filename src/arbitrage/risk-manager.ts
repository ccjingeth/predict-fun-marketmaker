/**
 * Risk Management System
 * 风险管理系统
 */

import type { ArbitrageOpportunity, ArbitrageExecution } from './types.js';

export interface RiskConfig {
  minProfitThreshold: number;
  minDepthShares: number;
  minLiquidity: number;
  maxVwapDeviationBps: number;
  maxVolatility: number;
  maxPositionSize: number;
  maxTotalExposure: number;
  maxVar: number;
  maxExposure: number;
}

export interface ArbitragePosition {
  positionId: string;
  entryPrice: number;
  currentValue: number;
  entryTime: number;
  valueHistory: number[];
  marketId: string;
  size: number;
}

export interface PreflightResult {
  approved: boolean;
  reasons: string[];
  warnings: string[];
  adjustedSize?: number;
  adjustedPrice?: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RiskStatus {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metrics: {
    exposure: number;
    maxDrawdown: number;
    var: number;
  };
  actions: string[];
}

/**
 * 风险管理器实现
 */
export class RiskManager {
  private config: RiskConfig;
  private positions: Map<string, ArbitragePosition> = new Map();
  private totalExposure: number = 0;
  private executions: ArbitrageExecution[] = [];

  constructor(config: Partial<RiskConfig> = {}) {
    this.config = {
      minProfitThreshold: 0.01,
      minDepthShares: 100,
      minLiquidity: 1000,
      maxVwapDeviationBps: 50,
      maxVolatility: 0.05,
      maxPositionSize: 200,
      maxTotalExposure: 5000,
      maxVar: 500,
      maxExposure: 1000,
      ...config,
    };
  }

  /**
   * 预检 - 在执行前检查风险
   */
  preflightCheck(opp: ArbitrageOpportunity): PreflightResult {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let approved = true;
    let adjustedSize: number | undefined;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    // 检查 1: 利润率
    const profit = opp.expectedReturn || opp.arbitrageProfit || 0;
    if (profit < this.config.minProfitThreshold) {
      approved = false;
      reasons.push(`❌ 利润率 ${(profit * 100).toFixed(2)}% 低于阈值 ${(this.config.minProfitThreshold * 100).toFixed(2)}%`);
      riskLevel = 'HIGH';
    }

    // 检查 2: 深度
    if (opp.depthShares && opp.depthShares < this.config.minDepthShares) {
      approved = false;
      reasons.push(`❌ 深度 ${opp.depthShares} 低于最小值 ${this.config.minDepthShares}`);
      riskLevel = 'HIGH';
    } else if (opp.depthShares && opp.depthShares < this.config.minDepthShares * 2) {
      warnings.push(`⚠️ 深度 ${opp.depthShares} 接近最小值 ${this.config.minDepthShares}`);
      riskLevel = this.maxRiskLevel(riskLevel, 'MEDIUM');
    }

    // 检查 3: 流动性
    const liquidity = this.calculateLiquidity(opp);
    if (liquidity < this.config.minLiquidity) {
      approved = false;
      reasons.push(`❌ 流动性 $${liquidity.toFixed(2)} 低于最小值 $${this.config.minLiquidity.toFixed(2)}`);
      riskLevel = 'HIGH';
    } else if (liquidity < this.config.minLiquidity * 2) {
      warnings.push(`⚠️ 流动性 $${liquidity.toFixed(2)} 接近最小值 $${this.config.minLiquidity.toFixed(2)}`);
      riskLevel = this.maxRiskLevel(riskLevel, 'MEDIUM');
    }

    // 检查 4: VWAP 偏差
    if (opp.vwapDeviationBps && opp.vwapDeviationBps > this.config.maxVwapDeviationBps) {
      warnings.push(`⚠️ VWAP 偏差 ${opp.vwapDeviationBps} bps 较大（最大 ${this.config.maxVwapDeviationBps} bps）`);
      if (opp.vwapDeviationBps > this.config.maxVwapDeviationBps * 2) {
        approved = false;
        reasons.push(`❌ VWAP 偏差 ${opp.vwapDeviationBps} bps 过大`);
        riskLevel = 'CRITICAL';
      }
      riskLevel = this.maxRiskLevel(riskLevel, 'HIGH');
    }

    // 检查 5: 市场波动率
    const volatility = this.calculateMarketVolatility(opp.marketId);
    if (volatility > this.config.maxVolatility) {
      warnings.push(`⚠️ 市场波动率 ${(volatility * 100).toFixed(2)}% 较高（最大 ${this.config.maxVolatility * 100}.toFixed(2)}%）`);
      if (volatility > this.config.maxVolatility * 2) {
        approved = false;
        reasons.push(`❌ 市场波动率 ${(volatility * 100).toFixed(2)}% 过高`);
        riskLevel = 'CRITICAL';
      }
      riskLevel = this.maxRiskLevel(riskLevel, 'HIGH');
    }

    // 检查 6: 仓位大小调整
    const maxSize = this.calculateMaxPositionSize(opp);
    if (opp.positionSize && opp.positionSize > maxSize) {
      warnings.push(`⚠️ 仓位大小 ${opp.positionSize} 超过推荐值 ${maxSize}，自动调整`);
      adjustedSize = maxSize;
      riskLevel = this.maxRiskLevel(riskLevel, 'MEDIUM');
    }

    // 检查 7: 总敞口
    const newExposure = liquidity;
    if (this.totalExposure + newExposure > this.config.maxTotalExposure) {
      approved = false;
      reasons.push(`❌ 总敞口超限 ($${this.totalExposure} + $${newExposure} > $${this.config.maxTotalExposure})`);
      riskLevel = 'CRITICAL';
    }

    return {
      approved,
      reasons,
      warnings,
      adjustedSize,
      riskLevel,
    };
  }

  /**
   * 监控仓位风险
   */
  monitorPosition(position: ArbitragePosition): RiskStatus {
    // 更新价值历史
    position.valueHistory.push(position.currentValue);

    // 计算风险指标
    const exposure = this.calculateExposure(position);
    const maxDrawdown = this.calculateMaxDrawdown(position);
    const var = this.calculateVar(position);

    // 确定风险等级
    let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    const actions: string[] = [];

    if (var > this.config.maxVar || exposure > this.config.maxExposure) {
      level = 'CRITICAL';
      actions.push('🚨 立即平仓');
    } else if (var > this.config.maxVar * 0.8 || exposure > this.config.maxExposure * 0.8) {
      level = 'HIGH';
      actions.push('⚠️ 考虑减仓');
    } else if (var > this.config.maxVar * 0.5 || exposure > this.config.maxExposure * 0.5) {
      level = 'MEDIUM';
      actions.push('📊 密切监控');
    } else {
      level = 'LOW';
    }

    // 检查回撤
    if (maxDrawdown > 0.05) {
      actions.push(`⚠️ 回撤较大: ${(maxDrawdown * 100).toFixed(2)}%`);
    }

    return {
      level,
      metrics: {
        exposure,
        maxDrawdown,
        var,
      },
      actions,
    };
  }

  /**
   * 计算止损价格
   */
  calculateStopLoss(position: ArbitragePosition): number {
    // 基于 ATR (Average True Range) 计算止损
    const atr = this.calculateATR(position.marketId);
    const stopLoss = position.entryPrice * (1 - atr * 2); // 2x ATR

    return stopLoss;
  }

  /**
   * 检查仓位限制
   */
  checkPositionLimit(newTrade: { cost: number }): boolean {
    const newExposure = newTrade.cost;
    return this.totalExposure + newExposure <= this.config.maxTotalExposure;
  }

  /**
   * 添加仓位
   */
  addPosition(position: ArbitragePosition): void {
    this.positions.set(position.positionId, position);
  }

  /**
   * 移除仓位
   */
  removePosition(positionId: string): void {
    this.positions.delete(positionId);
  }

  /**
   * 更新总敞口
   */
  updateTotalExposure(): void {
    let total = 0;
    for (const position of this.positions.values()) {
      total += this.calculateExposure(position);
    }
    this.totalExposure = total;
  }

  /**
   * 记录执行
   */
  recordExecution(execution: ArbitrageExecution): void {
    this.executions.push(execution);

    // 更新统计数据
    if (execution.status === 'EXECUTED') {
      // TODO: 更新统计
    }
  }

  /**
   * 获取风险报告
   */
  getRiskReport(): {
    totalPositions: number;
    totalExposure: number;
    avgRisk: string;
    recommendations: string[];
  } {
    const totalPositions = this.positions.size;
    this.updateTotalExposure();

    // 计算平均风险
    let highRiskCount = 0;
    for (const position of this.positions.values()) {
      const status = this.monitorPosition(position);
      if (status.level === 'HIGH' || status.level === 'CRITICAL') {
        highRiskCount++;
      }
    }

    const avgRisk = highRiskCount / totalPositions;
    let riskLevel: string;
    if (avgRisk > 0.5) riskLevel = 'HIGH';
    else if (avgRisk > 0.2) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    // 生成建议
    const recommendations: string[] = [];
    if (this.totalExposure > this.config.maxTotalExposure * 0.8) {
      recommendations.push('总敞口接近上限，建议减少新开仓');
    }
    if (highRiskCount > totalPositions * 0.3) {
      recommendations.push('高风险仓位较多，建议检查并减仓');
    }

    return {
      totalPositions,
      totalExposure: this.totalExposure,
      avgRisk: riskLevel,
      recommendations,
    };
  }

  // 私有辅助方法

  private calculateLiquidity(opp: ArbitrageOpportunity): number {
    if (!opp.yesBid || !opp.yesAsk || !opp.noBid || !opp.noAsk) {
      return 0;
    }

    const depth = opp.yesBid + opp.yesAsk + opp.noBid + opp.noAsk;
    const avgPrice = (opp.yesPrice || 0.5 + opp.noPrice || 0.5) / 2;
    const liquidity = depth * avgPrice;

    return liquidity;
  }

  private calculateMaxPositionSize(opp: ArbitrageOpportunity): number {
    const liquidity = this.calculateLiquidity(opp);
    const riskFactor = opp.type === 'CROSS_PLATFORM' ? 0.5 : 1.0;

    const maxSize = Math.min(
      liquidity * 0.1, // 不超过流动性的 10%
      this.config.maxPositionSize,
      200 // 绝对上限
    );

    return maxSize * riskFactor;
  }

  private calculateExposure(position: ArbitragePosition): number {
    return position.currentValue || 0;
  }

  private calculateMaxDrawdown(position: ArbitragePosition): number {
    if (!position.valueHistory || position.valueHistory.length < 2) {
      return 0;
    }

    let maxDrawdown = 0;
    let peak = position.valueHistory[0];

    for (const value of position.valueHistory) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private calculateVar(position: ArbitragePosition): number {
    if (!position.valueHistory || position.valueHistory.length < 20) {
      return 0;
    }

    const returns = [];
    for (let i = 1; i < position.valueHistory.length; i++) {
      const ret = (position.valueHistory[i] - position.valueHistory[i-1])
                / position.valueHistory[i-1];
      returns.push(ret);
    }

    returns.sort((a, b) => a - b);
    const percentileIndex = Math.floor(returns.length * 0.05);
    const var95 = returns[percentileIndex] * position.currentValue;

    return Math.abs(var95);
  }

  private calculateMarketVolatility(marketId: string): number {
    // TODO: 实现市场波动率计算
    return 0.02;
  }

  private calculateATR(marketId: string): number {
    // TODO: 实现 ATR 计算
    return 0.01;
  }

  private maxRiskLevel(current: string, candidate: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const currentIndex = levels.indexOf(current);
    const candidateIndex = levels.indexOf(candidate);
    return levels[Math.max(currentIndex, candidateIndex)];
  }
}
