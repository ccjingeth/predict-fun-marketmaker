/**
 * 动态止损系统
 * 实时止损、动态仓位调整、风险对冲
 */

export interface PositionRisk {
  tokenId: string;
  currentPnL: number;
  unrealizedPnL: number;
  exposure: number;
  maxDrawdown: number;
  volatility: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

export interface StopLossConfig {
  maxDrawdownPct: number; // 最大回撤百分比
  maxDailyLoss: number; // 每日最大亏损
  trailingStopPct: number; // 移动止损百分比
  takeProfitPct: number; // 止盈百分比
  autoHedgeThreshold: number; // 自动对冲阈值
  positionSizeMultiplier: number; // 仓位大小乘数
}

export interface RiskAction {
  type: 'STOP_LOSS' | 'TAKE_PROFIT' | 'REDUCE_POSITION' | 'HEDGE' | 'ALERT';
  tokenId: string;
  reason: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action: {
    closePosition?: boolean;
    closeAmount?: number;
    hedgeAmount?: number;
    newSize?: number;
  };
}

/**
 * 动态止损系统
 */
export class DynamicStopLossSystem {
  private config: StopLossConfig;
  private positions = new Map<string, PositionRisk>();
  private dailyPnL = 0;
  private dailyStartTime = Date.now();
  private actions: RiskAction[] = [];

  constructor(config?: Partial<StopLossConfig>) {
    this.config = {
      maxDrawdownPct: 0.15, // 15%最大回撤
      maxDailyLoss: 50, // 每日最大亏损50 USDT
      trailingStopPct: 0.05, // 5%移动止损
      takeProfitPct: 0.20, // 20%止盈
      autoHedgeThreshold: 0.7, // 70%仓位触发对冲
      positionSizeMultiplier: 0.5, // 风险时仓位减半
      ...config,
    };
  }

  /**
   * 更新持仓风险
   */
  updatePositionRisk(
    tokenId: string,
    entryPrice: number,
    currentPrice: number,
    positionSize: number,
    side: 'LONG' | 'SHORT'
  ): PositionRisk {
    // 计算PnL
    const priceChange = side === 'LONG' ? currentPrice - entryPrice : entryPrice - currentPrice;
    const pnl = priceChange * positionSize;
    const pnlPct = (priceChange / entryPrice) * 100;

    // 更新最大回撤
    const existing = this.positions.get(tokenId);
    const maxDrawdown = existing
      ? Math.max(existing.maxDrawdown, -Math.min(0, pnlPct))
      : -Math.min(0, pnlPct);

    // 评估风险等级
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (maxDrawdown > this.config.maxDrawdownPct * 100 || pnl < -this.config.maxDailyLoss) {
      riskLevel = 'CRITICAL';
    } else if (maxDrawdown > this.config.maxDrawdownPct * 75 || pnl < -this.config.maxDailyLoss * 0.7) {
      riskLevel = 'HIGH';
    } else if (maxDrawdown > this.config.maxDrawdownPct * 50 || pnl < -this.config.maxDailyLoss * 0.4) {
      riskLevel = 'MEDIUM';
    }

    // 计算止损和止盈价格
    const stopLossPrice = side === 'LONG'
      ? entryPrice * (1 - this.config.trailingStopPct)
      : entryPrice * (1 + this.config.trailingStopPct);

    const takeProfitPrice = side === 'LONG'
      ? entryPrice * (1 + this.config.takeProfitPct)
      : entryPrice * (1 - this.config.takeProfitPct);

    const positionRisk: PositionRisk = {
      tokenId,
      currentPnL: pnl,
      unrealizedPnL: pnl,
      exposure: positionSize * currentPrice,
      maxDrawdown,
      volatility: this.estimateVolatility(tokenId),
      riskLevel,
      stopLossPrice,
      takeProfitPrice,
    };

    this.positions.set(tokenId, positionRisk);
    this.dailyPnL += pnl - (existing?.currentPnL || 0);

    return positionRisk;
  }

  /**
   * 检查风险并生成行动
   */
  checkRiskAndGenerateActions(): RiskAction[] {
    const actions: RiskAction[] = [];
    const now = Date.now();

    // 检查每日亏损限制
    if (this.dailyPnL < -this.config.maxDailyLoss) {
      actions.push({
        type: 'ALERT',
        tokenId: 'ALL',
        reason: `每日亏损${Math.abs(this.dailyPnL).toFixed(2)}超过限制${this.config.maxDailyLoss}`,
        urgency: 'CRITICAL',
        action: { closePosition: true },
      });
      return actions; // 立即返回，这是最紧急的
    }

    // 重置每日计数器（如果需要）
    if (now - this.dailyStartTime > 24 * 60 * 60 * 1000) {
      this.dailyStartTime = now;
      this.dailyPnL = 0;
    }

    // 检查每个持仓
    for (const [tokenId, risk] of this.positions) {
      // 1. 检查止损
      if (risk.currentPnL < -Math.abs(risk.stopLossPrice || 0) * 100) {
        actions.push({
          type: 'STOP_LOSS',
          tokenId,
          reason: `触发止损：亏损${risk.currentPnL.toFixed(2)}`,
          urgency: 'HIGH',
          action: { closePosition: true },
        });
        continue;
      }

      // 2. 检查止盈
      if (risk.currentPnL > (risk.takeProfitPrice || 0) * 100) {
        actions.push({
          type: 'TAKE_PROFIT',
          tokenId,
          reason: `触发止盈：盈利${risk.currentPnL.toFixed(2)}`,
          urgency: 'MEDIUM',
          action: { closePosition: true },
        });
        continue;
      }

      // 3. 检查回撤
      if (risk.maxDrawdown > this.config.maxDrawdownPct * 100) {
        actions.push({
          type: 'REDUCE_POSITION',
          tokenId,
          reason: `回撤过大：${risk.maxDrawdown.toFixed(1)}%`,
          urgency: 'HIGH',
          action: { newSize: risk.exposure * 0.5 },
        });
      }

      // 4. 检查是否需要对冲
      if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') {
        const hedgeAmount = risk.exposure * 0.5;
        actions.push({
          type: 'HEDGE',
          tokenId,
          reason: `风险等级${risk.riskLevel}，建议对冲`,
          urgency: risk.riskLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          action: { hedgeAmount },
        });
      }
    }

    this.actions = actions;
    return actions;
  }

  /**
   * 计算动态仓位大小
   */
  calculateDynamicPositionSize(
    baseSize: number,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    volatility: number,
    accountBalance: number
  ): number {
    let multiplier = 1.0;

    // 根据风险等级调整
    switch (riskLevel) {
      case 'CRITICAL':
        multiplier = 0.2;
        break;
      case 'HIGH':
        multiplier = 0.5;
        break;
      case 'MEDIUM':
        multiplier = 0.75;
        break;
      case 'LOW':
        multiplier = 1.0;
        break;
    }

    // 根据波动性调整
    if (volatility > 0.05) {
      multiplier *= 0.7;
    } else if (volatility > 0.03) {
      multiplier *= 0.85;
    }

    // 根据账户余额调整
    const positionToBalanceRatio = (baseSize * multiplier) / accountBalance;
    if (positionToBalanceRatio > 0.1) {
      multiplier *= 0.5;
    }

    return Math.max(1, Math.floor(baseSize * multiplier));
  }

  /**
   * 估算波动性
   */
  private estimateVolatility(tokenId: string): number {
    // 简化的波动性估算
    // 实际应用中应该基于历史价格数据计算
    const volatilityMap = new Map<string, number>([
      ['BTC', 0.04],
      ['ETH', 0.05],
      ['SOL', 0.08],
    ]);

    // 默认波动性3%
    return volatilityMap.get(tokenId) || 0.03;
  }

  /**
   * 获取风险摘要
   */
  getRiskSummary(): {
    totalPositions: number;
    totalExposure: number;
    totalPnL: number;
    totalDrawdown: number;
    riskDistribution: Record<string, number>;
    dailyPnL: number;
    dailyRemaining: number;
  } {
    let totalExposure = 0;
    let totalPnL = 0;
    let totalDrawdown = 0;
    const riskDistribution: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const risk of this.positions.values()) {
      totalExposure += risk.exposure;
      totalPnL += risk.currentPnL;
      totalDrawdown += risk.maxDrawdown;
      riskDistribution[risk.riskLevel]++;
    }

    return {
      totalPositions: this.positions.size,
      totalExposure,
      totalPnL,
      totalDrawdown,
      riskDistribution,
      dailyPnL: this.dailyPnL,
      dailyRemaining: this.config.maxDailyLoss + this.dailyPnL,
    };
  }

  /**
   * 获取建议的对冲策略
   */
  getHedgeStrategy(tokenId: string): {
    shouldHedge: boolean;
    hedgeSize: number;
    hedgeType: 'PARTIAL' | 'FULL';
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  } | null {
    const risk = this.positions.get(tokenId);
    if (!risk) return null;

    const shouldHedge = risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL';

    if (!shouldHedge) {
      return {
        shouldHedge: false,
        hedgeSize: 0,
        hedgeType: 'PARTIAL',
        urgency: 'LOW',
      };
    }

    // 计算对冲大小
    const hedgeSize = risk.exposure * (risk.riskLevel === 'CRITICAL' ? 0.8 : 0.5);

    return {
      shouldHedge: true,
      hedgeSize,
      hedgeType: risk.riskLevel === 'CRITICAL' ? 'FULL' : 'PARTIAL',
      urgency: risk.riskLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
    };
  }

  /**
   * 移除持仓
   */
  removePosition(tokenId: string): void {
    this.positions.delete(tokenId);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<StopLossConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): StopLossConfig {
    return { ...this.config };
  }

  /**
   * 重置
   */
  reset(): void {
    this.positions.clear();
    this.dailyPnL = 0;
    this.dailyStartTime = Date.now();
    this.actions = [];
  }
}

// 创建全局单例
export const dynamicStopLossSystem = new DynamicStopLossSystem();
