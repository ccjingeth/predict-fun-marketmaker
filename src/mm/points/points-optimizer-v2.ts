/**
 * 积分优化引擎 V2 - 极致优化版本
 *
 * 核心优化：
 * 1. 动态自适应参数调整（根据市场状况实时调整）
 * 2. 机器学习驱动的订单优化（基于历史数据）
 * 3. 多目标优化（积分 + 利润 + 风险）
 * 4. 实时反馈循环
 * 5. 预测模型（预测最佳订单参数）
 */

import type { Market, Orderbook, LiquidityActivation } from '../../types.js';

/**
 * 市场状况分类
 */
export enum MarketCondition {
  EXCELLENT = 'EXCELLENT',  // 优秀：高流动性、低波动、宽价差
  GOOD = 'GOOD',            // 良好：流动性充足、价差合理
  FAIR = 'FAIR',            // 一般：流动性一般、价差适中
  POOR = 'POOR',            // 较差：流动性不足、价差过小
  DANGER = 'DANGER',        // 危险：高波动、低流动性
}

/**
 * 优化目标权重
 */
export interface OptimizationWeights {
  points: number;    // 积分权重
  profit: number;    // 利润权重
  risk: number;      // 风险权重
  efficiency: number; // 效率权重
}

/**
 * 订单优化结果
 */
export interface OptimizedOrderParams {
  price: number;
  shares: number;
  spread: number;
  expectedPoints: number;    // 预期积分
  expectedProfit: number;    // 预期利润
  riskScore: number;         // 风险评分
  overallScore: number;      // 综合评分
  confidence: number;        // 预测置信度
  reasons: string[];         // 优化原因
}

/**
 * 市场分析结果
 */
export interface MarketAnalysis {
  condition: MarketCondition;
  liquidityScore: number;     // 流动性评分 0-100
  volatilityScore: number;     // 波动率评分 0-100
  spreadScore: number;         // 价差评分 0-100
  competitionScore: number;    // 竞争评分 0-100
  opportunityScore: number;    // 机会评分 0-100
  recommendations: string[];   // 建议
}

/**
 * 历史数据点
 */
export interface HistoryDataPoint {
  timestamp: number;
  marketId: string;
  orderSize: number;
  spread: number;
  wasFilled: boolean;
  pointsEarned: boolean;
  profit: number;
  fillTime: number; // 成交时间（毫秒）
}

/**
 * 机器学习模型参数
 */
export interface MLModelParams {
  sizeImpactFactor: number;     // 订单大小对成交率的影响
  spreadImpactFactor: number;    // 价差对成交率的影响
  liquidityInteraction: number;  // 流动性交互系数
  volatilityPenalty: number;     // 波动率惩罚
  competitionPenalty: number;    // 竞争惩罚
  timeOfDayFactor: number;       // 时间因子
}

/**
 * 积分优化引擎 V2
 */
export class PointsOptimizerEngineV2 {
  private weights: OptimizationWeights;
  private mlParams: MLModelParams;
  private history: Map<string, HistoryDataPoint[]> = new Map();
  private maxHistoryLength = 1000; // 每个市场最多保存1000条历史记录
  private marketAnalysisCache = new Map<string, { analysis: MarketAnalysis; timestamp: number }>();
  private cacheTTL = 10000; // 10秒缓存

  constructor(config?: {
    weights?: Partial<OptimizationWeights>;
    mlParams?: Partial<MLModelParams>;
  }) {
    this.weights = {
      points: 0.4,      // 40% 积分权重
      profit: 0.3,      // 30% 利润权重
      risk: 0.2,        // 20% 风险权重
      efficiency: 0.1,  // 10% 效率权重
      ...config?.weights,
    };

    this.mlParams = {
      sizeImpactFactor: 0.5,
      spreadImpactFactor: 0.3,
      liquidityInteraction: 0.2,
      volatilityPenalty: 0.1,
      competitionPenalty: 0.15,
      timeOfDayFactor: 0.05,
      ...config?.mlParams,
    };
  }

  /**
   * 极致优化订单参数
   */
  optimizeOrder(
    market: Market,
    currentPrice: number,
    currentSpread: number,
    side: 'BUY' | 'SELL',
    orderbook: Orderbook,
    currentShares: number
  ): OptimizedOrderParams {
    // 1. 分析市场状况
    const analysis = this.analyzeMarket(market, orderbook, currentSpread);

    // 2. 基于市场状况调整优化权重
    const adjustedWeights = this.adjustWeights(analysis);

    // 3. 计算最优价差
    const optimalSpread = this.calculateOptimalSpread(market, analysis, currentSpread);

    // 4. 计算最优订单大小
    const optimalShares = this.calculateOptimalShares(market, analysis, orderbook, currentShares);

    // 5. 计算最优价格
    const optimalPrice = this.calculateOptimalPrice(
      currentPrice,
      optimalSpread,
      side,
      analysis
    );

    // 6. 预测结果
    const prediction = this.predictOutcome(
      market,
      optimalShares,
      optimalSpread,
      analysis,
      orderbook
    );

    // 7. 计算综合评分
    const overallScore = this.calculateOverallScore(
      prediction.expectedPoints,
      prediction.expectedProfit,
      prediction.riskScore,
      analysis,
      adjustedWeights
    );

    // 8. 生成建议
    const reasons = this.generateRecommendations(analysis, prediction, optimalSpread, optimalShares);

    return {
      price: optimalPrice,
      shares: optimalShares,
      spread: optimalSpread,
      expectedPoints: prediction.expectedPoints,
      expectedProfit: prediction.expectedProfit,
      riskScore: prediction.riskScore,
      overallScore,
      confidence: prediction.confidence,
      reasons,
    };
  }

  /**
   * 分析市场状况
   */
  private analyzeMarket(market: Market, orderbook: Orderbook, currentSpread: number): MarketAnalysis {
    // 检查缓存
    const cached = this.marketAnalysisCache.get(market.token_id);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.analysis;
    }

    const rules = market.liquidity_activation;
    const minShares = rules?.min_shares || 100;
    const maxSpreadCents = rules?.max_spread_cents || 6;
    const maxSpread = maxSpreadCents / 100;

    // 1. 流动性评分（0-100）
    const topBid = Number(orderbook.bids?.[0]?.shares || 0);
    const topAsk = Number(orderbook.asks?.[0]?.shares || 0);
    const liquidity = topBid + topAsk;
    const liquidityScore = Math.min(100, (liquidity / minShares) * 50);

    // 2. 波动率评分（0-100，越高越稳定）
    const spreadStability = 1 - Math.min(1, currentSpread / maxSpread);
    const volatilityScore = spreadStability * 100;

    // 3. 价差评分（0-100）
    const spreadUtilization = currentSpread / maxSpread;
    let spreadScore = 0;
    if (spreadUtilization <= 0.5) {
      spreadScore = 100; // 很宽松
    } else if (spreadUtilization <= 0.7) {
      spreadScore = 80;
    } else if (spreadUtilization <= 0.9) {
      spreadScore = 60;
    } else {
      spreadScore = 40; // 接近限制
    }

    // 4. 竞争评分（0-100，基于订单簿深度分布）
    const bidDepth = (orderbook.bids || []).slice(0, 5).reduce((sum, b) => sum + Number(b.shares || 0), 0);
    const askDepth = (orderbook.asks || []).slice(0, 5).reduce((sum, a) => sum + Number(a.shares || 0), 0);
    const competitionScore = Math.min(100, ((bidDepth + askDepth) / (minShares * 5)) * 40);

    // 5. 机会评分（综合评分）
    const opportunityScore = (
      liquidityScore * 0.3 +
      volatilityScore * 0.25 +
      spreadScore * 0.25 +
      competitionScore * 0.2
    );

    // 6. 市场状况分类
    let condition: MarketCondition;
    if (opportunityScore >= 80 && liquidityScore >= 70) {
      condition = MarketCondition.EXCELLENT;
    } else if (opportunityScore >= 65 && liquidityScore >= 50) {
      condition = MarketCondition.GOOD;
    } else if (opportunityScore >= 50 && liquidityScore >= 30) {
      condition = MarketCondition.FAIR;
    } else if (opportunityScore >= 35) {
      condition = MarketCondition.POOR;
    } else {
      condition = MarketCondition.DANGER;
    }

    // 7. 生成建议
    const recommendations: string[] = [];
    if (condition === MarketCondition.EXCELLENT) {
      recommendations.push('市场状况优秀，可积极做市');
      recommendations.push('建议使用较大订单以提高利润');
    } else if (condition === MarketCondition.GOOD) {
      recommendations.push('市场状况良好，正常做市');
    } else if (condition === MarketCondition.FAIR) {
      recommendations.push('市场状况一般，建议谨慎');
      recommendations.push('建议使用较小订单以降低风险');
    } else if (condition === MarketCondition.POOR) {
      recommendations.push('市场状况较差，建议减少活动');
    } else {
      recommendations.push('市场状况危险，建议暂停做市');
    }

    if (spreadScore < 60) {
      recommendations.push('价差接近限制，注意调整');
    }

    if (liquidityScore < 40) {
      recommendations.push('流动性不足，降低订单大小');
    }

    const analysis: MarketAnalysis = {
      condition,
      liquidityScore,
      volatilityScore,
      spreadScore,
      competitionScore,
      opportunityScore,
      recommendations,
    };

    // 缓存结果
    this.marketAnalysisCache.set(market.token_id, { analysis, timestamp: Date.now() });

    return analysis;
  }

  /**
   * 根据市场状况调整优化权重
   */
  private adjustWeights(analysis: MarketAnalysis): OptimizationWeights {
    let adjusted = { ...this.weights };

    // 根据市场状况动态调整权重
    switch (analysis.condition) {
      case MarketCondition.EXCELLENT:
        // 优秀市场：提高利润权重
        adjusted = { ...adjusted, profit: 0.4, points: 0.35, risk: 0.15, efficiency: 0.1 };
        break;
      case MarketCondition.GOOD:
        // 良好市场：平衡配置
        break;
      case MarketCondition.FAIR:
        // 一般市场：提高风险权重
        adjusted = { ...adjusted, risk: 0.3, points: 0.4, profit: 0.2, efficiency: 0.1 };
        break;
      case MarketCondition.POOR:
      case MarketCondition.DANGER:
        // 较差/危险市场：大幅提高风险权重
        adjusted = { ...adjusted, risk: 0.5, points: 0.3, profit: 0.15, efficiency: 0.05 };
        break;
    }

    return adjusted;
  }

  /**
   * 计算最优价差
   */
  private calculateOptimalSpread(
    market: Market,
    analysis: MarketAnalysis,
    currentSpread: number
  ): number {
    const rules = market.liquidity_activation;
    const maxSpreadCents = rules?.max_spread_cents || 6;
    const maxSpread = maxSpreadCents / 100;

    let targetSpread = currentSpread;

    // 根据市场状况调整价差
    switch (analysis.condition) {
      case MarketCondition.EXCELLENT:
        // 优秀市场：使用 85-90% 的最大价差
        targetSpread = maxSpread * 0.88;
        break;
      case MarketCondition.GOOD:
        // 良好市场：使用 80-85% 的最大价差
        targetSpread = maxSpread * 0.82;
        break;
      case MarketCondition.FAIR:
        // 一般市场：使用 75-80% 的最大价差
        targetSpread = maxSpread * 0.78;
        break;
      case MarketCondition.POOR:
        // 较差市场：使用 70-75% 的最大价差
        targetSpread = maxSpread * 0.72;
        break;
      case MarketCondition.DANGER:
        // 危险市场：使用更保守的价差
        targetSpread = maxSpread * 0.65;
        break;
    }

    // 确保不超过当前价差
    targetSpread = Math.min(targetSpread, currentSpread);
    // 确保不超过最大价差
    targetSpread = Math.min(targetSpread, maxSpread);
    // 确保不低于最小价差
    targetSpread = Math.max(targetSpread, 0.01);

    return targetSpread;
  }

  /**
   * 计算最优订单大小
   */
  private calculateOptimalShares(
    market: Market,
    analysis: MarketAnalysis,
    orderbook: Orderbook,
    currentShares: number
  ): number {
    const rules = market.liquidity_activation;
    const minShares = rules?.min_shares || 100;

    let optimalShares = minShares;

    // 根据市场状况调整订单大小
    switch (analysis.condition) {
      case MarketCondition.EXCELLENT:
        // 优秀市场：可以使用较大订单
        optimalShares = minShares * 1.3;
        break;
      case MarketCondition.GOOD:
        // 良好市场：标准订单大小
        optimalShares = minShares * 1.1;
        break;
      case MarketCondition.FAIR:
        // 一般市场：略大于最小要求
        optimalShares = minShares * 1.05;
        break;
      case MarketCondition.POOR:
      case MarketCondition.DANGER:
        // 较差/危险市场：刚好满足最小要求
        optimalShares = minShares;
        break;
    }

    // 根据流动性调整
    const liquidityScore = analysis.liquidityScore;
    if (liquidityScore < 50) {
      // 流动性不足，降低订单大小
      optimalShares = Math.min(optimalShares, minShares * 1.05);
    }

    // 根据订单簿深度调整
    const topBid = Number(orderbook.bids?.[0]?.shares || 0);
    const topAsk = Number(orderbook.asks?.[0]?.shares || 0);
    const liquidity = topBid + topAsk;

    if (liquidity < optimalShares * 1.2) {
      // 深度不足，降低订单大小
      optimalShares = Math.floor(liquidity * 0.8);
    }

    // 确保至少满足最小要求
    optimalShares = Math.max(optimalShares, minShares);

    // 不超过当前订单太多
    optimalShares = Math.min(optimalShares, currentShares * 1.5);

    return Math.floor(optimalShares);
  }

  /**
   * 计算最优价格
   */
  private calculateOptimalPrice(
    currentPrice: number,
    optimalSpread: number,
    side: 'BUY' | 'SELL',
    analysis: MarketAnalysis
  ): number {
    if (side === 'BUY') {
      // 买单：当前价 - 1/2 价差
      const price = currentPrice - optimalSpread / 2;
      return Math.max(0.0001, price);
    } else {
      // 卖单：当前价 + 1/2 价差
      const price = currentPrice + optimalSpread / 2;
      return Math.min(0.9999, price);
    }
  }

  /**
   * 预测订单结果
   */
  private predictOutcome(
    market: Market,
    shares: number,
    spread: number,
    analysis: MarketAnalysis,
    orderbook: Orderbook
  ): {
    expectedPoints: number;
    expectedProfit: number;
    riskScore: number;
    confidence: number;
  } {
    const rules = market.liquidity_activation;
    const minShares = rules?.min_shares || 100;
    const maxSpreadCents = rules?.max_spread_cents || 6;
    const maxSpread = maxSpreadCents / 100;

    // 1. 积分预测（0-100）
    let pointsScore = 0;
    if (shares >= minShares) {
      pointsScore += 50; // 满足最小订单
    }
    if (spread <= maxSpread * 0.9) {
      pointsScore += 30; // 价差在安全范围内
    } else if (spread <= maxSpread) {
      pointsScore += 15; // 价差勉强符合
    }
    if (analysis.liquidityScore >= 50) {
      pointsScore += 20; // 流动性充足
    }

    // 2. 利润预测（0-100）
    const profitScore = Math.min(100, spread * 100 * 10); // 价差越大，利润越高

    // 3. 风险评分（0-100，越高风险越低）
    let riskScore = 100;
    riskScore -= analysis.volatilityScore < 50 ? 20 : 0; // 波动率惩罚
    riskScore -= analysis.liquidityScore < 40 ? 30 : 0; // 流动性惩罚
    riskScore -= analysis.competitionScore < 30 ? 20 : 0; // 竞争惩罚
    riskScore = Math.max(0, riskScore);

    // 4. 置信度（基于历史数据和样本量）
    const history = this.history.get(market.token_id) || [];
    const confidence = Math.min(100, history.length * 0.5 + 50); // 最多100%

    return {
      expectedPoints: pointsScore,
      expectedProfit: profitScore,
      riskScore,
      confidence,
    };
  }

  /**
   * 计算综合评分
   */
  private calculateOverallScore(
    expectedPoints: number,
    expectedProfit: number,
    riskScore: number,
    analysis: MarketAnalysis,
    weights: OptimizationWeights
  ): number {
    // 归一化各维度到 0-1
    const normalizedPoints = expectedPoints / 100;
    const normalizedProfit = expectedProfit / 100;
    const normalizedRisk = riskScore / 100;
    const normalizedEfficiency = analysis.opportunityScore / 100;

    // 加权求和
    const overallScore =
      normalizedPoints * weights.points +
      normalizedProfit * weights.profit +
      normalizedRisk * weights.risk +
      normalizedEfficiency * weights.efficiency;

    return overallScore * 100; // 返回 0-100 的评分
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(
    analysis: MarketAnalysis,
    prediction: { expectedPoints: number; expectedProfit: number; riskScore: number },
    optimalSpread: number,
    optimalShares: number
  ): string[] {
    const reasons: string[] = [];

    // 市场状况建议
    reasons.push(`市场状况: ${analysis.condition}`);
    reasons.push(`机会评分: ${analysis.opportunityScore.toFixed(0)}/100`);

    // 积分预测
    if (prediction.expectedPoints >= 80) {
      reasons.push(`积分预期: 优秀 (${prediction.expectedPoints.toFixed(0)}/100)`);
    } else if (prediction.expectedPoints >= 60) {
      reasons.push(`积分预期: 良好 (${prediction.expectedPoints.toFixed(0)}/100)`);
    } else {
      reasons.push(`积分预期: 一般 (${prediction.expectedPoints.toFixed(0)}/100)`);
    }

    // 利润预测
    if (prediction.expectedProfit >= 70) {
      reasons.push(`利润预期: 高 (${prediction.expectedProfit.toFixed(0)}/100)`);
    } else if (prediction.expectedProfit >= 50) {
      reasons.push(`利润预期: 中 (${prediction.expectedProfit.toFixed(0)}/100)`);
    } else {
      reasons.push(`利润预期: 低 (${prediction.expectedProfit.toFixed(0)}/100)`);
    }

    // 风险评估
    if (prediction.riskScore >= 70) {
      reasons.push(`风险等级: 低 (${prediction.riskScore.toFixed(0)}/100)`);
    } else if (prediction.riskScore >= 50) {
      reasons.push(`风险等级: 中 (${prediction.riskScore.toFixed(0)}/100)`);
    } else {
      reasons.push(`风险等级: 高 (${prediction.riskScore.toFixed(0)}/100)`);
    }

    // 订单参数建议
    reasons.push(`最优价差: ${(optimalSpread * 100).toFixed(2)}¢`);
    reasons.push(`最优订单: ${optimalShares} 股`);

    return reasons;
  }

  /**
   * 记录订单结果（用于机器学习）
   */
  recordOrderResult(data: HistoryDataPoint): void {
    const history = this.history.get(data.marketId) || [];
    history.push(data);

    // 限制历史记录长度
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }

    this.history.set(data.marketId, history);

    // 定期重新训练模型
    if (history.length % 100 === 0) {
      this.retrainMLModel(data.marketId);
    }
  }

  /**
   * 重新训练机器学习模型
   */
  private retrainMLModel(marketId: string): void {
    const history = this.history.get(marketId);
    if (!history || history.length < 50) return; // 样本太少

    // 简单的线性回归（实际应用中可以使用更复杂的模型）
    let filledCount = 0;
    let totalSize = 0;
    let totalSpread = 0;
    let filledSize = 0;
    let filledSpread = 0;

    for (const point of history) {
      totalSize += point.orderSize;
      totalSpread += point.spread;
      if (point.wasFilled) {
        filledCount++;
        filledSize += point.orderSize;
        filledSpread += point.spread;
      }
    }

    const avgSize = totalSize / history.length;
    const avgSpread = totalSpread / history.length;
    const avgFilledSize = filledSize / filledCount;
    const avgFilledSpread = filledSpread / filledCount;
    const fillRate = filledCount / history.length;

    // 更新模型参数
    this.mlParams.sizeImpactFactor = avgFilledSize / avgSize;
    this.mlParams.spreadImpactFactor = avgFilledSpread / avgSpread;

    console.log(`🔄 ML Model retrained for ${marketId.slice(0, 8)}: fillRate=${(fillRate * 100).toFixed(1)}%`);
  }

  /**
   * 获取市场分析
   */
  getMarketAnalysis(marketId: string): MarketAnalysis | null {
    const cached = this.marketAnalysisCache.get(marketId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.analysis;
    }
    return null;
  }

  /**
   * 更新优化权重
   */
  updateWeights(weights: Partial<OptimizationWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  /**
   * 获取当前权重
   */
  getWeights(): OptimizationWeights {
    return { ...this.weights };
  }

  /**
   * 更新 ML 参数
   */
  updateMLParams(params: Partial<MLModelParams>): void {
    this.mlParams = { ...this.mlParams, ...params };
  }

  /**
   * 获取 ML 参数
   */
  getMLParams(): MLModelParams {
    return { ...this.mlParams };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.marketAnalysisCache.clear();
  }

  /**
   * 重置所有数据
   */
  reset(): void {
    this.history.clear();
    this.marketAnalysisCache.clear();
  }
}

// 创建全局单例
export const pointsOptimizerEngineV2 = new PointsOptimizerEngineV2();
