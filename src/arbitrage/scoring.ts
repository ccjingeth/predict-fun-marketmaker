/**
 * Arbitrage Scoring System
 * 套利机会评分系统
 */

import type { ArbitrageOpportunity } from './types.js';

export interface ArbitrageScore {
  opportunity: ArbitrageOpportunity;

  // 评分维度（总分 100）
  profitScore: number;      // 利润率 (40%)
  riskScore: number;        // 风险 (30%)
  liquidityScore: number;   // 流动性 (20%)
  speedScore: number;       // 执行速度 (10%)

  totalScore: number;       // 总分 0-100

  // 排序
  rank: number;             // 优先级排名
  recommendation: 'EXECUTE_NOW' | 'CONSIDER' | 'SKIP';

  // 详细分析
  analysis: {
    profitAnalysis: string;
    riskAnalysis: string;
    liquidityAnalysis: string;
    speedAnalysis: string;
  };
}

/**
 * 计算套利机会的综合评分
 */
export function scoreArbitrageOpportunity(opp: ArbitrageOpportunity): ArbitrageScore {
  const profitScore = calculateProfitScore(opp);
  const riskScore = calculateRiskScore(opp);
  const liquidityScore = calculateLiquidityScore(opp);
  const speedScore = calculateSpeedScore(opp);

  const totalScore =
    profitScore * 0.4 +
    riskScore * 0.3 +
    liquidityScore * 0.2 +
    speedScore * 0.1;

  // 确定推荐操作
  let recommendation: 'EXECUTE_NOW' | 'CONSIDER' | 'SKIP';
  if (totalScore >= 80 && profitScore >= 70) {
    recommendation = 'EXECUTE_NOW';
  } else if (totalScore >= 60) {
    recommendation = 'CONSIDER';
  } else {
    recommendation = 'SKIP';
  }

  return {
    opportunity: opp,
    profitScore,
    riskScore,
    liquidityScore,
    speedScore,
    totalScore,
    rank: 0, // 后续计算
    recommendation,
    analysis: {
      profitAnalysis: analyzeProfit(opp),
      riskAnalysis: analyzeRisk(opp),
      liquidityAnalysis: analyzeLiquidity(opp),
      speedAnalysis: analyzeSpeed(opp),
    },
  };
}

/**
 * 计算利润率评分 (0-100)
 */
function calculateProfitScore(opp: ArbitrageOpportunity): number {
  const profit = opp.expectedReturn || opp.arbitrageProfit || opp.guaranteedProfit || 0;

  // 基础分数：利润率 * 10
  let score = Math.min(profit * 10, 100);

  // 加分：利润 > 5%
  if (profit > 0.05) score += 10;

  // 减分：利润 < 1%
  if (profit < 0.01) score -= 20;

  // 减分：利润 < 0.5%
  if (profit < 0.005) score -= 20;

  return Math.max(0, Math.min(100, score));
}

/**
 * 计算风险评分 (0-100，分数越高风险越低)
 */
function calculateRiskScore(opp: ArbitrageOpportunity): number {
  let score = 50; // 基础分

  // 站内套利风险低
  if (opp.type === 'IN_PLATFORM') score += 30;

  // 跨平台套利风险中等
  if (opp.type === 'CROSS_PLATFORM') score += 10;

  // 价值错配风险高
  if (opp.type === 'VALUE_MISMATCH') score -= 10;

  // 检查深度
  if (opp.vwapLevels && opp.vwapLevels >= 10) score += 10;
  if (opp.vwapLevels && opp.vwapLevels >= 5) score += 5;

  // 检查 VWAP 偏差
  if (opp.vwapDeviationBps) {
    if (opp.vwapDeviationBps < 30) score += 15;
    else if (opp.vwapDeviationBps < 50) score += 10;
    else if (opp.vwapDeviationBps < 100) score += 5;
    else score -= 10; // 偏差过大
  }

  // 检查历史成功率（如果有）
  if (opp.confidence) {
    if (opp.confidence > 0.8) score += 15;
    else if (opp.confidence > 0.6) score += 10;
    else if (opp.confidence < 0.4) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 计算流动性评分 (0-100)
 */
function calculateLiquidityScore(opp: ArbitrageOpportunity): number {
  let score = 50; // 基础分

  // 检查订单簿深度
  if (opp.yesBid && opp.yesAsk && opp.noBid && opp.noAsk) {
    const depth = (opp.yesBid + opp.yesAsk + opp.noBid + opp.noAsk) / 4;
    score += Math.min(depth * 5, 30);
  }

  // 检查可用股数
  if (opp.depthShares) {
    if (opp.depthShares > 500) score += 20;
    else if (opp.depthShares > 200) score += 15;
    else if (opp.depthShares > 100) score += 10;
    else if (opp.depthShares < 50) score -= 20;
  }

  // 检查总成本
  if (opp.totalCostUsd) {
    if (opp.totalCostUsd > 1000) score += 10;
    else if (opp.totalCostUsd > 500) score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 计算执行速度评分 (0-100)
 */
function calculateSpeedScore(opp: ArbitrageOpportunity): number {
  let score = 50; // 基础分

  // 站内套利快
  if (opp.type === 'IN_PLATFORM') score += 40;

  // 跨平台套利慢
  if (opp.type === 'CROSS_PLATFORM') score -= 20;

  // 多结果套利中等
  if (opp.type === 'MULTI_OUTCOME') score += 10;

  // WebSocket 实时数据加分
  if (opp.confidence > 0.8) score += 10;
  else if (opp.confidence > 0.6) score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * 分析利润
 */
function analyzeProfit(opp: ArbitrageOpportunity): string {
  const profit = opp.expectedReturn || opp.arbitrageProfit || 0;

  if (profit > 0.05) return '优秀 - 利润率 > 5%';
  if (profit > 0.02) return '良好 - 利润率 > 2%';
  if (profit > 0.01) return '一般 - 利润率 > 1%';
  if (profit > 0.005) return '较低 - 利润率 < 1%';
  return '过低 - 利润率不足';
}

/**
 * 分析风险
 */
function analyzeRisk(opp: ArbitrageOpportunity): string {
  const risks: string[] = [];

  if (opp.type === 'IN_PLATFORM') {
    risks.push('低风险 - 站内套利');
  } else if (opp.type === 'CROSS_PLATFORM') {
    risks.push('中等风险 - 跨平台套利');
  } else {
    risks.push('高风险 - 复杂套利');
  }

  if (opp.vwapDeviationBps && opp.vwapDeviationBps > 100) {
    risks.push('VWAP 偏差较大');
  }

  if (opp.depthShares && opp.depthShares < 50) {
    risks.push('深度不足');
  }

  return risks.join(' | ');
}

/**
 * 分析流动性
 */
function analyzeLiquidity(opp: ArbitrageOpportunity): string {
  const liquidity = (opp.yesBid || 0) + (opp.yesAsk || 0) +
                    (opp.noBid || 0) + (opp.noAsk || 0);

  if (liquidity > 500) return '优秀 - 流动性充足';
  if (liquidity > 200) return '良好 - 流动性适中';
  if (liquidity > 100) return '一般 - 流动性尚可';
  return '较差 - 流动性不足';
}

/**
 * 分析执行速度
 */
function analyzeSpeed(opp: ArbitrageOpportunity): string {
  if (opp.type === 'IN_PLATFORM') return '快速 - 站内执行';
  if (opp.type === 'CROSS_PLATFORM') return '较慢 - 跨平台执行';
  if (opp.type === 'MULTI_OUTCOME') return '中等 - 多结果执行';
  return '复杂 - 需要综合判断';
}

/**
 * 对机会进行排序
 */
export function rankOpportunities(opportunities: ArbitrageScore[]): ArbitrageScore[] {
  // 按总分排序
  opportunities.sort((a, b) => b.totalScore - a.totalScore);

  // 分配排名
  opportunities.forEach((opp, index) => {
    opp.rank = index + 1;
  });

  return opportunities;
}

/**
 * 过滤机会
 */
export function filterOpportunities(
  opportunities: ArbitrageOpportunity[],
  options?: {
    minScore?: number;
    minProfit?: number;
    types?: string[];
  }
): ArbitrageOpportunity[] {
  const { minScore = 60, minProfit = 0.01, types } = options || {};

  return opportunities.filter(opp => {
    // 评分过滤
    const scored = scoreArbitrageOpportunity(opp);
    if (scored.totalScore < minScore) return false;

    // 利润过滤
    const profit = opp.expectedReturn || opp.arbitrageProfit || 0;
    if (profit < minProfit) return false;

    // 类型过滤
    if (types && types.length > 0) {
      if (!types.includes(opp.type)) return false;
    }

    return true;
  });
}
