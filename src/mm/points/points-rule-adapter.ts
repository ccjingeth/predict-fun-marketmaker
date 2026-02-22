/**
 * 积分规则自动适配器
 * 自动读取市场积分规则并调整订单参数
 */

import type { Market, LiquidityActivation } from '../../types.js';

export interface PointsRule {
  marketId: string;
  marketQuestion: string;
  minShares: number;
  maxSpreadCents: number;
  maxSpread: number;
  isActive: boolean;
  recommendedOrderSize: number;
  recommendedSpread: number;
  maxSpreadBps: number;
}

export interface AutoAdjustmentResult {
  marketId: string;
  originalOrderSize: number;
  adjustedOrderSize: number;
  originalSpread: number;
  adjustedSpread: number;
  reason: string;
  pointsEligible: boolean;
  warnings: string[];
}

export interface PointsRuleConfig {
  sizeBuffer: number; // 订单大小缓冲区（1.0 = 刚好满足，1.1 = 多10%）
  spreadBuffer: number; // 价差缓冲区（0-1，相对于max_spread）
  minOrderSize: number;
  maxOrderSize: number;
}

/**
 * 积分规则自动适配器
 */
export class PointsRuleAutoAdapter {
  private config: PointsRuleConfig;
  private rulesCache = new Map<string, PointsRule>();
  private adjustmentHistory = new Map<string, AutoAdjustmentResult[]>();

  constructor(config?: Partial<PointsRuleConfig>) {
    this.config = {
      sizeBuffer: 1.1, // 默认多10%缓冲，确保稳定获得积分
      spreadBuffer: 0.92, // 默认使用max_spread的92%
      minOrderSize: 10,
      maxOrderSize: 1000,
      ...config,
    };
  }

  /**
   * 从市场提取积分规则
   */
  extractPointsRule(market: Market): PointsRule | null {
    const liquidity = market.liquidity_activation;
    if (!liquidity) {
      return null;
    }

    const minShares = liquidity.min_shares || 100;
    const maxSpreadCents = liquidity.max_spread_cents ||
      (liquidity.max_spread ? liquidity.max_spread * 100 : 6);
    const maxSpread = maxSpreadCents / 100;

    // 计算推荐订单大小（带缓冲）
    const recommendedOrderSize = Math.max(
      this.config.minOrderSize,
      Math.min(
        this.config.maxOrderSize,
        Math.ceil(minShares * this.config.sizeBuffer)
      )
    );

    // 计算推荐价差（带缓冲）
    const recommendedSpread = maxSpread * this.config.spreadBuffer;

    const rule: PointsRule = {
      marketId: market.token_id,
      marketQuestion: market.question?.substring(0, 80) || '',
      minShares,
      maxSpreadCents,
      maxSpread,
      isActive: true,
      recommendedOrderSize,
      recommendedSpread,
      maxSpreadBps: maxSpreadCents,
    };

    this.rulesCache.set(market.token_id, rule);
    return rule;
  }

  /**
   * 自动调整订单参数以符合积分规则
   */
  autoAdjustOrder(
    market: Market,
    orderSize: number,
    spread: number
  ): AutoAdjustmentResult {
    const rule = this.extractPointsRule(market);
    const warnings: string[] = [];

    if (!rule) {
      return {
        marketId: market.token_id,
        originalOrderSize: orderSize,
        adjustedOrderSize: orderSize,
        originalSpread: spread,
        adjustedSpread: spread,
        reason: '此市场无积分规则',
        pointsEligible: false,
        warnings: [],
      };
    }

    let adjustedSize = orderSize;
    let adjustedSpread = spread;
    const reasons: string[] = [];

    // 1. 调整订单大小
    if (orderSize < rule.minShares) {
      adjustedSize = rule.recommendedOrderSize;
      reasons.push(`订单大小从${orderSize}增加到${adjustedSize}以满足min_shares=${rule.minShares}`);
      warnings.push(`⚠️ 原订单大小${orderSize}小于min_shares(${rule.minShares})`);
    } else if (orderSize < rule.recommendedOrderSize) {
      adjustedSize = rule.recommendedOrderSize;
      reasons.push(`订单大小从${orderSize}优化为${adjustedSize}（增加${this.config.sizeBuffer * 100 - 100}%缓冲）`);
    }

    // 确保不超过最大限制
    if (adjustedSize > this.config.maxOrderSize) {
      adjustedSize = this.config.maxOrderSize;
      reasons.push(`订单大小限制为${this.config.maxOrderSize}`);
    }

    // 2. 调整价差
    const maxSpreadBps = spread * 10000;
    if (maxSpreadBps > rule.maxSpreadBps) {
      adjustedSpread = rule.recommendedSpread;
      reasons.push(`价差从${(spread * 100).toFixed(2)}¢降低到${(adjustedSpread * 100).toFixed(2)}¢（max_spread=${rule.maxSpreadCents}¢）`);
      warnings.push(`⚠️ 原价差${(spread * 100).toFixed(2)}¢超过max_spread(${rule.maxSpreadCents}¢)`);
    } else if (spread < rule.recommendedSpread * 0.8) {
      // 如果价差太小，也建议调整到推荐值
      adjustedSpread = rule.recommendedSpread;
      reasons.push(`价差从${(spread * 100).toFixed(2)}¢优化为${(adjustedSpread * 100).toFixed(2)}¢`);
    }

    // 3. 验证积分符合性
    const meetsMinShares = adjustedSize >= rule.minShares;
    const withinMaxSpread = (adjustedSpread * 100) <= rule.maxSpreadCents;
    const pointsEligible = meetsMinShares && withinMaxSpread;

    // 4. 生成调整原因
    if (pointsEligible) {
      reasons.push('✅ 订单符合积分规则');
    } else {
      if (!meetsMinShares) {
        reasons.push(`❌ 订单大小${adjustedSize} < min_shares${rule.minShares}`);
      }
      if (!withinMaxSpread) {
        reasons.push(`❌ 价差${(adjustedSpread * 100).toFixed(2)}¢ > max_spread${rule.maxSpreadCents}¢`);
      }
    }

    // 记录历史
    const result: AutoAdjustmentResult = {
      marketId: market.token_id,
      originalOrderSize: orderSize,
      adjustedOrderSize: adjustedSize,
      originalSpread: spread,
      adjustedSpread,
      reason: reasons.join('; '),
      pointsEligible,
      warnings,
    };

    const history = this.adjustmentHistory.get(market.token_id) || [];
    history.push(result);
    if (history.length > 50) {
      history.shift();
    }
    this.adjustmentHistory.set(market.token_id, history);

    return result;
  }

  /**
   * 批量调整多个市场
   */
  autoAdjustMultiple(
    markets: Market[],
    baseOrderSize: number,
    baseSpread: number
  ): Map<string, AutoAdjustmentResult> {
    const results = new Map<string, AutoAdjustmentResult>();

    for (const market of markets) {
      const rule = this.extractPointsRule(market);
      if (rule) {
        const result = this.autoAdjustOrder(market, baseOrderSize, baseSpread);
        results.set(market.token_id, result);
      }
    }

    return results;
  }

  /**
   * 获取所有积分规则
   */
  getAllRules(markets: Market[]): PointsRule[] {
    const rules: PointsRule[] = [];

    for (const market of markets) {
      const rule = this.extractPointsRule(market);
      if (rule) {
        rules.push(rule);
      }
    }

    // 按积分价值排序（min_shares越低越好）
    rules.sort((a, b) => a.minShares - b.minShares);

    return rules;
  }

  /**
   * 获取最佳订单参数（针对积分市场）
   */
  getOptimalParams(rule: PointsRule): {
    orderSize: number;
    spread: number;
    confidence: number; // 0-1，符合规则的可信度
  } {
    const orderSize = rule.recommendedOrderSize;
    const spread = rule.recommendedSpread;

    // 计算置信度
    let confidence = 0.5;

    // 订单大小置信度（越大越安全）
    const sizeSafety = (orderSize - rule.minShares) / rule.minShares;
    confidence += Math.min(sizeSafety, 0.3);

    // 价差置信度（越小越安全）
    const spreadMargin = (rule.maxSpread - spread) / rule.maxSpread;
    confidence += Math.min(spreadMargin, 0.3);

    return {
      orderSize,
      spread,
      confidence: Math.min(1, confidence),
    };
  }

  /**
   * 生成新手友好的解释
   */
  generateExplanation(rule: PointsRule): string {
    const lines: string[] = [];

    lines.push(`📊 市场：${rule.marketQuestion.substring(0, 50)}...`);
    lines.push('');
    lines.push('✨ 积分规则：');
    lines.push(`   • 最小订单：${rule.minShares} 股`);
    lines.push(`   • 最大价差：${rule.maxSpreadCents}¢ ($${rule.maxSpread.toFixed(2)})`);
    lines.push('');
    lines.push('💡 推荐配置：');
    lines.push(`   • 订单大小：${rule.recommendedOrderSize} 股 (${rule.minShares} × ${(this.config.sizeBuffer).toFixed(1)})`);
    lines.push(`   • 订单价差：${(rule.recommendedSpread * 100).toFixed(2)}¢ (${(this.config.spreadBuffer * 100).toFixed(0)}% 的最大价差)`);
    lines.push('');
    lines.push('✅ 为什么要这样配置？');
    lines.push(`   1. 订单大小设置为${rule.minShares}的${(this.config.sizeBuffer * 100).toFixed(0)}%，确保稳定获得积分`);
    lines.push(`   2. 价差设置为最大值的${(this.config.spreadBuffer * 100).toFixed(0)}%，既符合规则又保持盈利空间`);

    return lines.join('\n');
  }

  /**
   * 获取新手提示
   */
  getBeginnerTips(): string[] {
    return [
      '💰 小白提示：',
      '',
      '1. 先用模拟模式测试（ENABLE_TRADING=false）',
      '2. 订单大小不要太小，建议≥100股',
      '3. 价差不要太大，建议≤6¢',
      '4. 关注积分状态显示，绿色表示符合规则',
      '5. 有问题随时查看"智能建议"',
    ];
  }

  /**
   * 获取调整统计
   */
  getAdjustmentStats(marketId: string): {
    totalAdjustments: number;
    eligibilityRate: number;
    avgOrderSize: number;
    avgSpread: number;
  } | null {
    const history = this.adjustmentHistory.get(marketId);
    if (!history || history.length === 0) return null;

    const totalAdjustments = history.length;
    const eligibleCount = history.filter(r => r.pointsEligible).length;
    const avgOrderSize = history.reduce((sum, r) => sum + r.adjustedOrderSize, 0) / totalAdjustments;
    const avgSpread = history.reduce((sum, r) => sum + r.adjustedSpread, 0) / totalAdjustments;

    return {
      totalAdjustments,
      eligibilityRate: eligibleCount / totalAdjustments,
      avgOrderSize,
      avgSpread,
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.rulesCache.clear();
    this.adjustmentHistory.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PointsRuleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): PointsRuleConfig {
    return { ...this.config };
  }
}

// 创建全局单例
export const pointsRuleAutoAdapter = new PointsRuleAutoAdapter();
