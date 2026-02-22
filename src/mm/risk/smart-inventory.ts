/**
 * 智能库存管理模块
 * 基于风险和收益的智能持仓管理
 */

export interface InventoryPosition {
  tokenId: string;
  yesAmount: number;
  noAmount: number;
  netExposure: number; // 净敞口
  maxPosition: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  unrealizedPnL: number;
  avgEntryPrice: number;
}

export interface HedgeRecommendation {
  shouldHedge: boolean;
  side: 'BUY' | 'SELL' | null;
  amount: number;
  reason: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  targetPrice?: number;
}

export interface InventoryConfig {
  maxPosition: number;
  maxNetExposure: number;
  hedgeThreshold: number; // 触发对冲的阈值
  hedgeRatio: number; // 对冲比例
  riskMultiplier: number; // 风险乘数
  enableAutoHedge: boolean;
}

/**
 * 智能库存管理器
 */
export class SmartInventoryManager {
  private positions = new Map<string, InventoryPosition>();
  private config: InventoryConfig;
  private priceHistory = new Map<string, number[]>();

  constructor(config?: Partial<InventoryConfig>) {
    this.config = {
      maxPosition: 100,
      maxNetExposure: 50,
      hedgeThreshold: 0.7, // 70% 最大持仓
      hedgeRatio: 0.5, // 对冲50%
      riskMultiplier: 1.5,
      enableAutoHedge: true,
      ...config,
    };
  }

  /**
   * 更新持仓
   */
  updatePosition(
    tokenId: string,
    yesAmount: number,
    noAmount: number,
    currentPrice: number,
    avgEntryPrice: number
  ): InventoryPosition {
    const netExposure = yesAmount - noAmount;
    const maxPos = this.config.maxPosition;
    const exposureRatio = Math.abs(netExposure) / maxPos;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (exposureRatio > 0.9) riskLevel = 'CRITICAL';
    else if (exposureRatio > 0.7) riskLevel = 'HIGH';
    else if (exposureRatio > 0.5) riskLevel = 'MEDIUM';

    // 计算未实现盈亏
    const unrealizedPnL = (currentPrice - avgEntryPrice) * netExposure;

    const position: InventoryPosition = {
      tokenId,
      yesAmount,
      noAmount,
      netExposure,
      maxPosition: maxPos,
      riskLevel,
      unrealizedPnL,
      avgEntryPrice,
    };

    this.positions.set(tokenId, position);
    this.updatePriceHistory(tokenId, currentPrice);

    return position;
  }

  /**
   * 获取对冲建议
   */
  getHedgeRecommendation(tokenId: string): HedgeRecommendation {
    const position = this.positions.get(tokenId);
    if (!position) {
      return {
        shouldHedge: false,
        side: null,
        amount: 0,
        reason: '无持仓',
        urgency: 'LOW',
      };
    }

    const exposureRatio = Math.abs(position.netExposure) / position.maxPosition;

    // 检查是否需要对冲
    if (exposureRatio < this.config.hedgeThreshold) {
      return {
        shouldHedge: false,
        side: null,
        amount: 0,
        reason: '敞口在安全范围内',
        urgency: 'LOW',
      };
    }

    // 计算对冲方向
    const side = position.netExposure > 0 ? 'SELL' : 'BUY';

    // 计算对冲数量
    const hedgeAmount = Math.abs(position.netExposure) * this.config.hedgeRatio;

    // 确定紧急程度
    let urgency: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (position.riskLevel === 'CRITICAL') urgency = 'HIGH';
    else if (position.riskLevel === 'HIGH') urgency = 'MEDIUM';

    // 生成原因
    const reason = this.generateHedgeReason(position, exposureRatio);

    return {
      shouldHedge: true,
      side,
      amount: hedgeAmount,
      reason,
      urgency,
    };
  }

  /**
   * 获取所有对冲建议
   */
  getAllHedgeRecommendations(): Array<{
    tokenId: string;
    recommendation: HedgeRecommendation;
  }> {
    const recommendations: Array<{
      tokenId: string;
      recommendation: HedgeRecommendation;
    }> = [];

    for (const tokenId of this.positions.keys()) {
      const rec = this.getHedgeRecommendation(tokenId);
      if (rec.shouldHedge) {
        recommendations.push({ tokenId, recommendation: rec });
      }
    }

    // 按紧急程度排序
    recommendations.sort((a, b) => {
      const urgencyOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return urgencyOrder[b.recommendation.urgency] - urgencyOrder[a.recommendation.urgency];
    });

    return recommendations;
  }

  /**
   * 计算组合风险
   */
  calculatePortfolioRisk(): {
    totalExposure: number;
    netExposure: number;
    riskScore: number; // 0-100
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    diversificationRatio: number; // 分散度 0-1
  } {
    let totalExposure = 0;
    let netExposure = 0;
    let maxExposure = 0;

    for (const position of this.positions.values()) {
      const exposure = Math.abs(position.netExposure);
      totalExposure += exposure;
      netExposure += position.netExposure;
      maxExposure = Math.max(maxExposure, exposure);
    }

    const totalMax = this.positions.size * this.config.maxPosition;
    const exposureRatio = totalExposure / Math.max(1, totalMax);
    const netRatio = Math.abs(netExposure) / Math.max(1, totalMax);

    // 风险评分
    const riskScore = Math.min(100, (exposureRatio * 50 + netRatio * 50));

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (riskScore > 80) riskLevel = 'CRITICAL';
    else if (riskScore > 60) riskLevel = 'HIGH';
    else if (riskScore > 40) riskLevel = 'MEDIUM';

    // 分散度（基于赫芬达尔指数）
    const concentrations: number[] = [];
    for (const position of this.positions.values()) {
      const concentration = Math.abs(position.netExposure) / Math.max(1, totalExposure);
      concentrations.push(concentration);
    }

    let hhi = 0;
    for (const c of concentrations) {
      hhi += c * c;
    }
    const diversificationRatio = 1 - hhi;

    return {
      totalExposure,
      netExposure,
      riskScore,
      riskLevel,
      diversificationRatio,
    };
  }

  /**
   * 生成对冲原因
   */
  private generateHedgeReason(position: InventoryPosition, exposureRatio: number): string {
    const reasons: string[] = [];

    if (position.riskLevel === 'CRITICAL') {
      reasons.push('敞口接近临界值');
    } else if (position.riskLevel === 'HIGH') {
      reasons.push('敞口过高');
    }

    if (position.unrealizedPnL < -10) {
      reasons.push(`未实现亏损: $${position.unrealizedPnL.toFixed(2)}`);
    }

    // 检查价格波动
    const volatility = this.calculatePriceVolatility(position.tokenId);
    if (volatility > 0.02) {
      reasons.push('高波动性');
    }

    if (reasons.length === 0) {
      reasons.push(`敞口占比 ${(exposureRatio * 100).toFixed(0)}%`);
    }

    return reasons.join('; ');
  }

  /**
   * 更新价格历史
   */
  private updatePriceHistory(tokenId: string, price: number): void {
    if (!this.priceHistory.has(tokenId)) {
      this.priceHistory.set(tokenId, []);
    }

    const history = this.priceHistory.get(tokenId)!;
    history.push(price);

    // 保持最近50条记录
    if (history.length > 50) {
      history.shift();
    }
  }

  /**
   * 计算价格波动性
   */
  calculatePriceVolatility(tokenId: string): number {
    const history = this.priceHistory.get(tokenId);
    if (!history || history.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      returns.push((history[i] - history[i - 1]) / history[i - 1]);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  /**
   * 获取持仓统计
   */
  getStats(): {
    totalPositions: number;
    totalYesAmount: number;
    totalNoAmount: number;
    totalNetExposure: number;
    totalUnrealizedPnL: number;
    riskDistribution: Record<string, number>;
  } {
    let totalYes = 0;
    let totalNo = 0;
    let totalNet = 0;
    let totalPnL = 0;
    const riskDistribution: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const position of this.positions.values()) {
      totalYes += position.yesAmount;
      totalNo += position.noAmount;
      totalNet += position.netExposure;
      totalPnL += position.unrealizedPnL;
      riskDistribution[position.riskLevel]++;
    }

    return {
      totalPositions: this.positions.size,
      totalYesAmount: totalYes,
      totalNoAmount: totalNo,
      totalNetExposure: totalNet,
      totalUnrealizedPnL: totalPnL,
      riskDistribution,
    };
  }

  /**
   * 移除持仓
   */
  removePosition(tokenId: string): void {
    this.positions.delete(tokenId);
    this.priceHistory.delete(tokenId);
  }

  /**
   * 清空所有持仓
   */
  clear(): void {
    this.positions.clear();
    this.priceHistory.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<InventoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): InventoryConfig {
    return { ...this.config };
  }
}

// 创建全局单例
export const smartInventoryManager = new SmartInventoryManager();
