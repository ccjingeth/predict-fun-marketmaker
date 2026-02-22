/**
 * 积分管理器模块
 * 统一管理 Predict.fun 积分规则的检查、统计和报告
 */

import { Market, LiquidityActivation } from '../../types.js';

/**
 * 积分统计数据接口
 */
export interface PointsStats {
  totalMarkets: number;
  pointsActiveMarkets: number;
  efficiency: number;
  markets: PointsMarketStats[];
}

/**
 * 单个市场的积分统计
 */
export interface PointsMarketStats {
  marketId: string;
  question: string;
  minShares: number;
  maxSpread: number;
  eligibleOrders: number;
  totalOrders: number;
  isActive: boolean;
  lastOrderTime?: number;
}

/**
 * 订单积分检查结果
 */
export interface OrderPointsCheck {
  isEligible: boolean;
  reason?: string;
  minSharesOk: boolean;
  maxSpreadOk: boolean;
  currentShares?: number;
  currentSpread?: number;
}

/**
 * 积分管理器类
 */
export class PointsManager {
  private stats = new Map<string, PointsMarketStats>();
  private lastUpdate = 0;
  private updateInterval = 60000; // 1分钟更新一次

  /**
   * 检查市场是否激活积分
   */
  isPointsActive(market: Market): boolean {
    const rules = market.liquidity_activation;
    if (!rules) return false;

    const hasMinShares = rules.min_shares !== undefined && rules.min_shares > 0;
    const hasMaxSpread = rules.max_spread !== undefined && rules.max_spread > 0;
    const hasMaxSpreadCents = rules.max_spread_cents !== undefined && rules.max_spread_cents > 0;

    return hasMinShares || hasMaxSpread || hasMaxSpreadCents;
  }

  /**
   * 检查订单是否符合积分规则
   */
  checkOrderEligibility(
    market: Market,
    orderSize: number,
    spread: number
  ): OrderPointsCheck {
    const rules = market.liquidity_activation;
    if (!rules) {
      return {
        isEligible: true, // 无积分规则时默认符合
        reason: '无积分规则',
        minSharesOk: true,
        maxSpreadOk: true,
      };
    }

    const minSharesOk = this.checkMinShares(rules, orderSize);
    const maxSpreadOk = this.checkMaxSpread(rules, spread);

    const isEligible = minSharesOk && maxSpreadOk;

    const reasons: string[] = [];
    if (!minSharesOk) {
      reasons.push(`订单大小不足 (需要 >= ${rules.min_shares} 股)`);
    }
    if (!maxSpreadOk) {
      const maxSpread = rules.max_spread ?? (rules.max_spread_cents ? rules.max_spread_cents / 100 : 0);
      reasons.push(`价差过大 (当前 ${(spread * 100).toFixed(2)}%, 最大允许 ${(maxSpread * 100).toFixed(2)}%)`);
    }

    return {
      isEligible,
      reason: reasons.length > 0 ? reasons.join('; ') : '符合积分规则',
      minSharesOk,
      maxSpreadOk,
      currentShares: orderSize,
      currentSpread: spread,
    };
  }

  /**
   * 检查最小股数要求
   */
  private checkMinShares(rules: LiquidityActivation, orderSize: number): boolean {
    if (rules.min_shares === undefined || rules.min_shares <= 0) return true;
    return orderSize >= rules.min_shares;
  }

  /**
   * 检查最大价差要求
   */
  private checkMaxSpread(rules: LiquidityActivation, spread: number): boolean {
    const maxSpread = rules.max_spread ?? (rules.max_spread_cents ? rules.max_spread_cents / 100 : undefined);
    if (maxSpread === undefined || maxSpread <= 0) return true;
    return spread <= maxSpread;
  }

  /**
   * 记录订单到积分统计
   */
  recordOrder(market: Market, orderSize: number, spread: number, isEligible: boolean): void {
    const marketId = market.token_id || '';
    if (!marketId) return;

    let stats = this.stats.get(marketId);
    if (!stats) {
      stats = {
        marketId,
        question: market.question || '',
        minShares: market.liquidity_activation?.min_shares || 0,
        maxSpread: market.liquidity_activation?.max_spread || 0,
        eligibleOrders: 0,
        totalOrders: 0,
        isActive: this.isPointsActive(market),
        lastOrderTime: Date.now(),
      };
      this.stats.set(marketId, stats);
    }

    stats.totalOrders++;
    if (isEligible) {
      stats.eligibleOrders++;
    }
    stats.lastOrderTime = Date.now();
  }

  /**
   * 获取积分统计报告
   */
  getStats(): PointsStats {
    const markets = Array.from(this.stats.values());
    const totalMarkets = markets.length;
    const pointsActiveMarkets = markets.filter(m => m.isActive).length;

    let totalEligible = 0;
    let totalOrders = 0;
    markets.forEach(m => {
      totalEligible += m.eligibleOrders;
      totalOrders += m.totalOrders;
    });

    const efficiency = totalOrders > 0 ? Math.round((totalEligible / totalOrders) * 100) : 0;

    return {
      totalMarkets,
      pointsActiveMarkets,
      efficiency,
      markets,
    };
  }

  /**
   * 获取单个市场的积分统计
   */
  getMarketStats(marketId: string): PointsMarketStats | undefined {
    return this.stats.get(marketId);
  }

  /**
   * 获取符合积分规则的市场列表
   */
  getActivePointsMarkets(): PointsMarketStats[] {
    return Array.from(this.stats.values()).filter(m => m.isActive);
  }

  /**
   * 清除过期数据
   */
  clearExpired(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const cutoff = now - maxAge;

    for (const [marketId, stats] of this.stats.entries()) {
      if (stats.lastOrderTime && stats.lastOrderTime < cutoff) {
        this.stats.delete(marketId);
      }
    }
  }

  /**
   * 重置所有统计数据
   */
  reset(): void {
    this.stats.clear();
    this.lastUpdate = 0;
  }

  /**
   * 导出为 JSON
   */
  toJSON(): object {
    return {
      lastUpdate: this.lastUpdate,
      stats: Array.from(this.stats.entries()),
    };
  }

  /**
   * 从 JSON 导入
   */
  static fromJSON(data: any): PointsManager {
    const manager = new PointsManager();
    if (data.lastUpdate) {
      manager.lastUpdate = data.lastUpdate;
    }
    if (Array.isArray(data.stats)) {
      manager.stats = new Map(data.stats);
    }
    return manager;
  }
}

// 创建全局单例
export const pointsManager = new PointsManager();
