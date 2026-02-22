/**
 * Machine Learning Prediction Engine
 * 机器学习预测引擎 - 使用历史数据预测价格走势和套利成功率
 */

import type { ArbitrageOpportunity } from './types.js';

/**
 * 历史数据点
 */
export interface HistoryDataPoint {
  timestamp: number;
  marketId: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  spread: number;
  volatility: number;
  outcome?: 'YES' | 'NO';
}

/**
 * 预测结果
 */
export interface PredictionResult {
  marketId: string;
  predictedPrice: number;
  confidence: number; // 0-1
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  expectedMove: number; // 预期变动幅度
  timeframe: number; // 预测时间范围（毫秒）
  factors: {
    trend: number;
    momentum: number;
    meanReversion: number;
    liquidity: number;
  };
}

/**
 * 套利成功率预测
 */
export interface ArbitrageSuccessPrediction {
  opportunityId: string;
  successProbability: number; // 0-1
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedProfit: number;
  expectedSlippage: number;
  recommendedAction: 'EXECUTE' | 'SKIP' | 'WAIT';
  reasoning: string[];
}

/**
 * ML 模型配置
 */
export interface MLConfig {
  historySize: number;         // 历史数据大小
  minDataPoints: number;       // 最小数据点数
  updateInterval: number;      // 模型更新间隔（毫秒）
  enableLearning: boolean;     // 启用在线学习
  confidenceThreshold: number; // 置信度阈值
}

/**
 * 简单的线性回归模型
 */
class LinearRegression {
  private slope: number = 0;
  private intercept: number = 0;

  train(data: { x: number; y: number }[]): void {
    if (data.length < 2) return;

    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (const point of data) {
      sumX += point.x;
      sumY += point.y;
      sumXY += point.x * point.y;
      sumXX += point.x * point.x;
    }

    this.slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    this.intercept = (sumY - this.slope * sumX) / n;
  }

  predict(x: number): number {
    return this.slope * x + this.intercept;
  }

  getSlope(): number {
    return this.slope;
  }
}

/**
 * 机器学习预测引擎
 */
export class MLPredictor {
  private config: MLConfig;
  private history: Map<string, HistoryDataPoint[]> = new Map();
  private models: Map<string, LinearRegression> = new Map();
  private predictions: Map<string, PredictionResult> = new Map();
  private performanceHistory: {
    timestamp: number;
    predicted: number;
    actual: number;
    error: number;
  }[] = [];

  constructor(config: Partial<MLConfig> = {}) {
    this.config = {
      historySize: 1000,
      minDataPoints: 20,
      updateInterval: 60000, // 1 分钟
      enableLearning: true,
      confidenceThreshold: 0.6,
      ...config,
    };

    // 启动定期模型更新
    this.startPeriodicUpdate();
  }

  /**
   * 添加历史数据
   */
  addHistoryData(data: HistoryDataPoint): void {
    const marketHistory = this.history.get(data.marketId) || [];
    marketHistory.push(data);

    // 限制历史大小
    if (marketHistory.length > this.config.historySize) {
      marketHistory.shift();
    }

    this.history.set(data.marketId, marketHistory);

    // 如果启用在线学习，立即更新模型
    if (this.config.enableLearning) {
      this.updateModel(data.marketId);
    }
  }

  /**
   * 批量添加历史数据
   */
  addHistoryDataBatch(data: HistoryDataPoint[]): void {
    for (const point of data) {
      this.addHistoryData(point);
    }
  }

  /**
   * 更新模型
   */
  private updateModel(marketId: string): void {
    const marketHistory = this.history.get(marketId);
    if (!marketHistory || marketHistory.length < this.config.minDataPoints) {
      return;
    }

    // 准备训练数据
    const trainingData = marketHistory.map((point, index) => ({
      x: index,
      y: point.yesPrice,
    }));

    // 训练模型
    const model = new LinearRegression();
    model.train(trainingData);

    this.models.set(marketId, model);
  }

  /**
   * 预测价格
   */
  predictPrice(marketId: string, timeframe: number = 60000): PredictionResult | null {
    const marketHistory = this.history.get(marketId);
    const model = this.models.get(marketId);

    if (!marketHistory || !model || marketHistory.length < this.config.minDataPoints) {
      return null;
    }

    const currentPrice = marketHistory[marketHistory.length - 1].yesPrice;

    // 预测未来价格
    const futureSteps = Math.min(timeframe / 1000, 60); // 最多预测 60 步
    const predictedPrice = model.predict(marketHistory.length + futureSteps);

    // 计算置信度（基于历史预测误差）
    const confidence = this.calculateConfidence(marketId, predictedPrice);

    // 确定方向
    const priceChange = (predictedPrice - currentPrice) / currentPrice;
    let direction: 'UP' | 'DOWN' | 'NEUTRAL';
    if (priceChange > 0.01) {
      direction = 'UP';
    } else if (priceChange < -0.01) {
      direction = 'DOWN';
    } else {
      direction = 'NEUTRAL';
    }

    // 计算因子
    const factors = this.calculateFactors(marketHistory);

    const result: PredictionResult = {
      marketId,
      predictedPrice,
      confidence,
      direction,
      expectedMove: Math.abs(priceChange),
      timeframe,
      factors,
    };

    this.predictions.set(marketId, result);

    return result;
  }

  /**
   * 预测套利成功率
   */
  predictArbitrageSuccess(opportunity: ArbitrageOpportunity): ArbitrageSuccessPrediction {
    const factors: string[] = [];

    // 1. 基础成功率
    let successProbability = 0.7;

    // 2. 深度因素
    if (opportunity.depthShares) {
      if (opportunity.depthShares > 500) {
        successProbability += 0.15;
        factors.push('深度充足');
      } else if (opportunity.depthShares > 200) {
        successProbability += 0.1;
        factors.push('深度良好');
      } else if (opportunity.depthShares < 50) {
        successProbability -= 0.2;
        factors.push('深度不足');
      }
    }

    // 3. 利润因素
    const profit = opportunity.expectedReturn || opportunity.arbitrageProfit || 0;
    if (profit > 0.03) {
      successProbability += 0.05;
      factors.push('高利润机会');
    } else if (profit < 0.01) {
      successProbability -= 0.1;
      factors.push('低利润机会');
    }

    // 4. 价差因素
    if (opportunity.yesAsk && opportunity.yesBid) {
      const spread = (opportunity.yesAsk - opportunity.yesBid) / opportunity.yesBid;
      if (spread < 0.01) {
        successProbability += 0.1;
        factors.push('价差 tight');
      } else if (spread > 0.03) {
        successProbability -= 0.1;
        factors.push('价差宽松');
      }
    }

    // 5. VWAP 偏差
    if (opportunity.vwapDeviationBps) {
      if (opportunity.vwapDeviationBps < 20) {
        successProbability += 0.05;
        factors.push('VWAP 偏差小');
      } else if (opportunity.vwapDeviationBps > 50) {
        successProbability -= 0.1;
        factors.push('VWAP 偏差大');
      }
    }

    // 6. ML 预测因子
    const prediction = this.predictPrice(opportunity.marketId);
    if (prediction && prediction.confidence > this.config.confidenceThreshold) {
      if (prediction.direction === 'UP' && opportunity.yesPrice && prediction.predictedPrice > opportunity.yesPrice) {
        successProbability += 0.1;
        factors.push('ML 预测上涨');
      } else if (prediction.direction === 'DOWN' && opportunity.yesPrice && prediction.predictedPrice < opportunity.yesPrice) {
        successProbability += 0.1;
        factors.push('ML 预测下跌');
      }
    }

    // 限制概率范围
    successProbability = Math.max(0.1, Math.min(0.95, successProbability));

    // 确定风险等级
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    if (successProbability > 0.8) {
      riskLevel = 'LOW';
    } else if (successProbability > 0.6) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'HIGH';
    }

    // 预期滑点
    const expectedSlippage = this.estimateSlippage(opportunity);

    // 推荐行动
    let recommendedAction: 'EXECUTE' | 'SKIP' | 'WAIT';
    if (successProbability > 0.75 && profit > 0.015) {
      recommendedAction = 'EXECUTE';
    } else if (successProbability < 0.5 || profit < 0.005) {
      recommendedAction = 'SKIP';
    } else {
      recommendedAction = 'WAIT';
    }

    return {
      opportunityId: `${opportunity.marketId}-${opportunity.type}`,
      successProbability,
      riskLevel,
      expectedProfit: profit,
      expectedSlippage,
      recommendedAction,
      reasoning: factors,
    };
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(marketId: string, predictedPrice: number): number {
    const marketHistory = this.history.get(marketId);
    if (!marketHistory || marketHistory.length < 10) {
      return 0.5;
    }

    // 计算历史价格波动率
    const prices = marketHistory.map(p => p.yesPrice);
    const mean = prices.reduce((a, b) => a + b) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);

    // 波动率越大，置信度越低
    const confidence = Math.max(0.3, Math.min(0.95, 1 - volatility));

    return confidence;
  }

  /**
   * 计算因子
   */
  private calculateFactors(history: HistoryDataPoint[]): {
    trend: number;
    momentum: number;
    meanReversion: number;
    liquidity: number;
  } {
    if (history.length < 5) {
      return { trend: 0, momentum: 0, meanReversion: 0, liquidity: 0 };
    }

    // 趋势：价格变化方向
    const recentPrices = history.slice(-10).map(h => h.yesPrice);
    const trend = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];

    // 动量：价格变化速度
    const momentum =
      (recentPrices[recentPrices.length - 1] - recentPrices[recentPrices.length - 5]) /
      recentPrices[recentPrices.length - 5];

    // 均值回归：当前价格偏离均值的程度
    const mean = recentPrices.reduce((a, b) => a + b) / recentPrices.length;
    const meanReversion = (recentPrices[recentPrices.length - 1] - mean) / mean;

    // 流动性：平均成交量
    const liquidity = history.slice(-10).reduce((sum, h) => sum + h.volume, 0) / 10;

    return {
      trend,
      momentum,
      meanReversion,
      liquidity,
    };
  }

  /**
   * 估算滑点
   */
  private estimateSlippage(opportunity: ArbitrageOpportunity): number {
    let slippage = 0.002; // 基础滑点 0.2%

    // 根据深度调整
    if (opportunity.depthShares) {
      if (opportunity.depthShares < 100) {
        slippage *= 2;
      } else if (opportunity.depthShares > 500) {
        slippage *= 0.5;
      }
    }

    // 根据价差调整
    if (opportunity.yesAsk && opportunity.yesBid) {
      const spread = (opportunity.yesAsk - opportunity.yesBid) / opportunity.yesBid;
      slippage += spread * 0.5;
    }

    return slippage;
  }

  /**
   * 记录预测性能
   */
  recordPredictionPerformance(marketId: string, predicted: number, actual: number): void {
    const error = Math.abs(predicted - actual) / actual;

    this.performanceHistory.push({
      timestamp: Date.now(),
      predicted,
      actual,
      error,
    });

    // 限制历史大小
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.shift();
    }
  }

  /**
   * 获取模型性能
   */
  getModelPerformance(): {
    avgError: number;
    maxError: number;
    minError: number;
    accuracy: number;
  } {
    if (this.performanceHistory.length === 0) {
      return {
        avgError: 0,
        maxError: 0,
        minError: 0,
        accuracy: 0,
      };
    }

    const errors = this.performanceHistory.map(p => p.error);
    const avgError = errors.reduce((a, b) => a + b) / errors.length;
    const maxError = Math.max(...errors);
    const minError = Math.min(...errors);
    const accuracy = 1 - avgError;

    return {
      avgError,
      maxError,
      minError,
      accuracy,
    };
  }

  /**
   * 获取预测
   */
  getPrediction(marketId: string): PredictionResult | null {
    return this.predictions.get(marketId) || null;
  }

  /**
   * 批量预测
   */
  batchPredict(marketIds: string[]): Map<string, PredictionResult> {
    const results = new Map<string, PredictionResult>();

    for (const marketId of marketIds) {
      const prediction = this.predictPrice(marketId);
      if (prediction) {
        results.set(marketId, prediction);
      }
    }

    return results;
  }

  /**
   * 定期更新模型
   */
  private startPeriodicUpdate(): void {
    setInterval(() => {
      for (const marketId of this.history.keys()) {
        this.updateModel(marketId);
      }
    }, this.config.updateInterval);
  }

  /**
   * 打印模型性能
   */
  printPerformance(): void {
    const performance = this.getModelPerformance();

    console.log('\n🤖 ML 模型性能:');
    console.log(`   平均误差: ${(performance.avgError * 100).toFixed(2)}%`);
    console.log(`   最大误差: ${(performance.maxError * 100).toFixed(2)}%`);
    console.log(`   最小误差: ${(performance.minError * 100).toFixed(2)}%`);
    console.log(`   准确度: ${(performance.accuracy * 100).toFixed(2)}%`);
    console.log(`   跟踪市场: ${this.history.size}`);
    console.log(`   训练模型: ${this.models.size}`);
  }

  /**
   * 导出模型
   */
  exportModel(): string {
    const data: any = {
      config: this.config,
      predictions: Array.from(this.predictions.entries()),
      performanceHistory: this.performanceHistory,
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * 清理数据
   */
  clearHistory(marketId?: string): void {
    if (marketId) {
      this.history.delete(marketId);
      this.models.delete(marketId);
      this.predictions.delete(marketId);
    } else {
      this.history.clear();
      this.models.clear();
      this.predictions.clear();
    }
  }
}

/**
 * 单例预测器
 */
let globalPredictor: MLPredictor | null = null;

export function getMLPredictor(config?: Partial<MLConfig>): MLPredictor {
  if (!globalPredictor) {
    globalPredictor = new MLPredictor(config);
  }

  return globalPredictor;
}
