/**
 * Probable 平台积分适配器
 * 为 Probable 平台提供虚拟积分系统，实现与 Predict.fun 统一的积分管理
 *
 * 设计理念：
 * - Probable 没有官方积分系统，但我们基于做市质量来计算"虚拟积分"
 * - 虚拟积分基于：订单质量、价差控制、深度贡献
 * - 目标是鼓励高质量的做市行为
 */

import type { Market, Orderbook, LiquidityActivation } from '../../types.js';
import { pointsManager } from './points-manager.js';

/**
 * Probable 虚拟积分配置
 */
export interface ProbablePointsConfig {
  enabled: boolean;
  minShares: number; // 默认最小订单股数
  maxSpreadCents: number; // 默认最大价差（美分）
  qualityThreshold: number; // 质量阈值（0-1）
  depthBonus: boolean; // 是否启用深度奖励
}

/**
 * 积分质量评分
 */
export interface PointsQuality {
  score: number; // 0-100
  spreadQuality: number; // 价差质量
  depthQuality: number; // 深度质量
  sizeQuality: number; // 订单大小质量
  reasons: string[]; // 评分原因
}

/**
 * Probable 积分适配器
 */
export class ProbablePointsAdapter {
  private config: ProbablePointsConfig;
  private marketMetrics = new Map<string, {
    totalOrders: number;
    qualityOrders: number;
    avgQuality: number;
    lastUpdate: number;
  }>();

  constructor(config?: Partial<ProbablePointsConfig>) {
    this.config = {
      enabled: true,
      minShares: 50, // Probable 默认较小订单
      maxSpreadCents: 5, // 5 cents 最大价差
      qualityThreshold: 0.7,
      depthBonus: true,
      ...config,
    };
  }

  /**
   * 为 Probable 市场生成虚拟积分规则
   */
  generateLiquidityRules(market: Market): LiquidityActivation {
    return {
      active: true,
      min_shares: this.config.minShares,
      max_spread_cents: this.config.maxSpreadCents,
      max_spread: this.config.maxSpreadCents / 100,
      description: 'probable-virtual-points',
    };
  }

  /**
   * 评估订单质量
   */
  evaluateOrderQuality(
    market: Market,
    orderSize: number,
    spread: number,
    orderbook: Orderbook
  ): PointsQuality {
    const reasons: string[] = [];
    let spreadQuality = 0;
    let depthQuality = 0;
    let sizeQuality = 0;

    // 1. 价差质量评分（权重40%）
    const maxSpread = this.config.maxSpreadCents / 100;
    const spreadRatio = spread / maxSpread;

    if (spreadRatio <= 0.5) {
      spreadQuality = 100;
      reasons.push(`价差优秀 (${(spread * 100).toFixed(2)}¢ / ${this.config.maxSpreadCents}¢)`);
    } else if (spreadRatio <= 0.7) {
      spreadQuality = 80;
      reasons.push(`价差良好 (${(spread * 100).toFixed(2)}¢ / ${this.config.maxSpreadCents}¢)`);
    } else if (spreadRatio <= 0.9) {
      spreadQuality = 60;
      reasons.push(`价差一般 (${(spread * 100).toFixed(2)}¢ / ${this.config.maxSpreadCents}¢)`);
    } else if (spreadRatio <= 1.0) {
      spreadQuality = 40;
      reasons.push(`价差偏高 (${(spread * 100).toFixed(2)}¢ / ${this.config.maxSpreadCents}¢)`);
    } else {
      spreadQuality = 20;
      reasons.push(`价差超限 (${(spread * 100).toFixed(2)}¢ > ${this.config.maxSpreadCents}¢)`);
    }

    // 2. 订单大小质量评分（权重40%）
    const minShares = this.config.minShares;
    const sizeRatio = orderSize / minShares;

    if (sizeRatio >= 1.5) {
      sizeQuality = 100;
      reasons.push(`订单充足 (${orderSize} / ${minShares})`);
    } else if (sizeRatio >= 1.0) {
      sizeQuality = 80;
      reasons.push(`订单达标 (${orderSize} / ${minShares})`);
    } else if (sizeRatio >= 0.8) {
      sizeQuality = 60;
      reasons.push(`订单略小 (${orderSize} / ${minShares})`);
    } else {
      sizeQuality = 30;
      reasons.push(`订单过小 (${orderSize} < ${minShares})`);
    }

    // 3. 深度质量评分（权重20%）
    if (this.config.depthBonus) {
      const topBid = Number(orderbook.bids?.[0]?.shares || 0);
      const topAsk = Number(orderbook.asks?.[0]?.shares || 0);
      const liquidity = topBid + topAsk;

      if (liquidity >= minShares * 3) {
        depthQuality = 100;
        reasons.push(`深度充足 (${liquidity.toFixed(0)})`);
      } else if (liquidity >= minShares * 2) {
        depthQuality = 80;
        reasons.push(`深度良好 (${liquidity.toFixed(0)})`);
      } else if (liquidity >= minShares) {
        depthQuality = 60;
        reasons.push(`深度一般 (${liquidity.toFixed(0)})`);
      } else {
        depthQuality = 30;
        reasons.push(`深度不足 (${liquidity.toFixed(0)})`);
      }
    } else {
      depthQuality = 50; // 不评估深度时给中性分
    }

    // 综合评分
    const score = Math.round(
      spreadQuality * 0.4 +
      sizeQuality * 0.4 +
      depthQuality * 0.2
    );

    return {
      score,
      spreadQuality,
      depthQuality,
      sizeQuality,
      reasons,
    };
  }

  /**
   * 检查订单是否符合虚拟积分标准
   */
  checkVirtualPointsEligibility(
    market: Market,
    orderSize: number,
    spread: number,
    orderbook: Orderbook
  ): boolean {
    if (!this.config.enabled) {
      return true; // 禁用时默认符合
    }

    const quality = this.evaluateOrderQuality(market, orderSize, spread, orderbook);
    const threshold = this.config.qualityThreshold * 100;

    return quality.score >= threshold;
  }

  /**
   * 记录 Probable 订单到积分统计
   */
  recordProbableOrder(
    market: Market,
    orderSize: number,
    spread: number,
    orderbook: Orderbook
  ): void {
    if (!this.config.enabled) return;

    const quality = this.evaluateOrderQuality(market, orderSize, spread, orderbook);
    const isEligible = this.checkVirtualPointsEligibility(market, orderSize, spread, orderbook);

    // 更新市场指标
    let metrics = this.marketMetrics.get(market.token_id);
    if (!metrics) {
      metrics = {
        totalOrders: 0,
        qualityOrders: 0,
        avgQuality: 0,
        lastUpdate: Date.now(),
      };
      this.marketMetrics.set(market.token_id, metrics);
    }

    metrics.totalOrders++;
    if (isEligible) {
      metrics.qualityOrders++;
    }

    // 更新平均质量
    const totalQuality = metrics.avgQuality * (metrics.totalOrders - 1) + quality.score;
    metrics.avgQuality = totalQuality / metrics.totalOrders;
    metrics.lastUpdate = Date.now();

    // 同步到全局积分管理器
    // 使用虚拟积分规则
    const virtualRules = this.generateLiquidityRules(market);
    const marketWithRules = { ...market, liquidity_activation: virtualRules };
    pointsManager.recordOrder(marketWithRules, orderSize, spread, isEligible);
  }

  /**
   * 获取市场积分指标
   */
  getMarketMetrics(marketId: string) {
    return this.marketMetrics.get(marketId);
  }

  /**
   * 获取所有市场指标
   */
  getAllMetrics() {
    return Array.from(this.marketMetrics.entries()).map(([marketId, metrics]) => ({
      marketId,
      ...metrics,
    }));
  }

  /**
   * 清理过期数据
   */
  clearExpired(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const cutoff = now - maxAge;

    for (const [marketId, metrics] of this.marketMetrics.entries()) {
      if (metrics.lastUpdate < cutoff) {
        this.marketMetrics.delete(marketId);
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ProbablePointsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): ProbablePointsConfig {
    return { ...this.config };
  }

  /**
   * 重置所有统计
   */
  reset(): void {
    this.marketMetrics.clear();
  }
}

// 创建全局单例
export const probablePointsAdapter = new ProbablePointsAdapter();
