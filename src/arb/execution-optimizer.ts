/**
 * 套利执行优化器
 * 多路径套利、滑点最小化、分批执行、速度优化
 */

export interface ArbitragePath {
  id: string;
  markets: string[];
  expectedProfit: number;
  expectedProfitBps: number;
  totalSlippage: number;
  executionTimeMs: number;
  confidence: number;
  steps: ArbitrageStep[];
}

export interface ArbitrageStep {
  marketId: string;
  action: 'BUY' | 'SELL';
  price: number;
  size: number;
  slippage: number;
  estimatedTime: number;
}

export interface ExecutionPlan {
  path: ArbitragePath;
  batchSize: number;
  batches: number;
  delayBetweenBatches: number;
  totalExecutionTime: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ExecutionResult {
  success: boolean;
  actualProfit: number;
  actualSlippage: number;
  executionTime: number;
  errors: string[];
}

export interface ArbitrageOptimizerConfig {
  maxSlippageBps: number;
  maxExecutionTime: number;
  enableBatchExecution: boolean;
  batchSize: number;
  batchDelayMs: number;
  parallelPaths: number;
  minProfitThreshold: number;
}

/**
 * 套利执行优化器
 */
export class ArbitrageExecutionOptimizer {
  private config: ArbitrageOptimizerConfig;
  private executionHistory = new Map<string, ExecutionResult[]>();
  private pathCache = new Map<string, ArbitragePath[]>();

  constructor(config?: Partial<ArbitrageOptimizerConfig>) {
    this.config = {
      maxSlippageBps: 100, // 1%最大滑点
      maxExecutionTime: 30000, // 30秒最大执行时间
      enableBatchExecution: true,
      batchSize: 10, // 每批10股
      batchDelayMs: 500, // 批次间延迟500ms
      parallelPaths: 3, // 并行执行3条路径
      minProfitThreshold: 1, // 最小1美元利润
      ...config,
    };
  }

  /**
   * 寻找最优套利路径
   */
  findOptimalPaths(
    marketMap: Map<string, any>,
    startMarkets: string[],
    targetMarkets: string[]
  ): ArbitragePath[] {
    const paths: ArbitragePath[] = [];

    // 1. 直接路径（2跳）
    for (const start of startMarkets) {
      for (const end of targetMarkets) {
        if (start === end) continue;

        const path = this.calculateDirectPath(marketMap, start, end);
        if (path && path.expectedProfit > this.config.minProfitThreshold) {
          paths.push(path);
        }
      }
    }

    // 2. 三跳路径（通过中间市场）
    for (const start of startMarkets) {
      for (const mid of targetMarkets) {
        for (const end of targetMarkets) {
          if (start === mid || mid === end || start === end) continue;

          const path = this.calculateThreeHopPath(marketMap, start, mid, end);
          if (path && path.expectedProfit > this.config.minProfitThreshold) {
            paths.push(path);
          }
        }
      }
    }

    // 按预期利润排序
    return paths.sort((a, b) => b.expectedProfit - a.expectedProfit);
  }

  /**
   * 计算直接路径
   */
  private calculateDirectPath(
    marketMap: Map<string, any>,
    startMarket: string,
    endMarket: string
  ): ArbitragePath | null {
    const startData = marketMap.get(startMarket);
    const endData = marketMap.get(endMarket);

    if (!startData || !endData) return null;

    // 计算套利机会
    const startBid = startData.bids?.[0]?.price || 0;
    const startAsk = startData.asks?.[0]?.price || 0;
    const endBid = endData.bids?.[0]?.price || 0;
    const endAsk = endData.asks?.[0]?.price || 0;

    // 在A买入，在B卖出
    const buyPrice = Math.min(startAsk, endAsk);
    const sellPrice = Math.max(startBid, endBid);

    if (sellPrice <= buyPrice) return null;

    const grossProfit = (sellPrice - buyPrice) / 2; // 假设相等数量
    const slippage = this.estimateSlippage(startData, endData);
    const netProfit = grossProfit - slippage;

    if (netProfit <= 0) return null;

    return {
      id: `${startMarket}-${endMarket}`,
      markets: [startMarket, endMarket],
      expectedProfit: netProfit * 100, // 假设100股
      expectedProfitBps: (netProfit / buyPrice) * 10000,
      totalSlippage: slippage,
      executionTimeMs: 2000,
      confidence: this.calculateConfidence(startData, endData),
      steps: [
        {
          marketId: startMarket,
          action: 'BUY',
          price: buyPrice,
          size: 100,
          slippage: slippage / 2,
          estimatedTime: 1000,
        },
        {
          marketId: endMarket,
          action: 'SELL',
          price: sellPrice,
          size: 100,
          slippage: slippage / 2,
          estimatedTime: 1000,
        },
      ],
    };
  }

  /**
   * 计算三跳路径
   */
  private calculateThreeHopPath(
    marketMap: Map<string, any>,
    startMarket: string,
    midMarket: string,
    endMarket: string
  ): ArbitragePath | null {
    const startData = marketMap.get(startMarket);
    const midData = marketMap.get(midMarket);
    const endData = marketMap.get(endMarket);

    if (!startData || !midData || !endData) return null;

    // 复杂的三跳逻辑：A->B->C
    // 这里简化为基本的买卖逻辑
    const startAsk = startData.asks?.[0]?.price || 0;
    const midBid = midData.bids?.[0]?.price || 0;
    const midAsk = midData.asks?.[0]?.price || 0;
    const endBid = endData.bids?.[0]?.price || 0;

    if (startAsk >= midBid || midAsk >= endBid) return null;

    const profit1 = (midBid - startAsk) / 2;
    const profit2 = (endBid - midAsk) / 2;
    const grossProfit = profit1 + profit2;

    const slippage = this.estimateSlippage(startData, midData) + this.estimateSlippage(midData, endData);
    const netProfit = grossProfit - slippage;

    if (netProfit <= 0) return null;

    return {
      id: `${startMarket}-${midMarket}-${endMarket}`,
      markets: [startMarket, midMarket, endMarket],
      expectedProfit: netProfit * 100,
      expectedProfitBps: (netProfit / startAsk) * 10000,
      totalSlippage: slippage,
      executionTimeMs: 4000,
      confidence: this.calculateConfidence(startData, midData) * this.calculateConfidence(midData, endData),
      steps: [
        {
          marketId: startMarket,
          action: 'BUY',
          price: startAsk,
          size: 100,
          slippage: slippage / 3,
          estimatedTime: 1333,
        },
        {
          marketId: midMarket,
          action: 'SELL',
          price: midBid,
          size: 100,
          slippage: slippage / 3,
          estimatedTime: 1333,
        },
        {
          marketId: midMarket,
          action: 'BUY',
          price: midAsk,
          size: 100,
          slippage: slippage / 3,
          estimatedTime: 1333,
        },
        {
          marketId: endMarket,
          action: 'SELL',
          price: endBid,
          size: 100,
          slippage: slippage / 3,
          estimatedTime: 1333,
        },
      ],
    };
  }

  /**
   * 创建执行计划
   */
  createExecutionPlan(path: ArbitragePath, totalSize: number): ExecutionPlan {
    const batchSize = this.config.batchSize;
    const batches = Math.ceil(totalSize / batchSize);
    const delayBetweenBatches = this.config.batchDelayMs;
    const totalExecutionTime = path.executionTimeMs + (batches - 1) * delayBetweenBatches;

    // 评估风险等级
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (path.totalSlippage > path.expectedProfit * 0.3) {
      riskLevel = 'HIGH';
    } else if (path.totalSlippage > path.expectedProfit * 0.1) {
      riskLevel = 'MEDIUM';
    }

    return {
      path,
      batchSize,
      batches,
      delayBetweenBatches,
      totalExecutionTime,
      riskLevel,
    };
  }

  /**
   * 执行套利路径
   */
  async executePath(
    plan: ExecutionPlan,
    executor: (step: ArbitrageStep, batch: number) => Promise<void>
  ): Promise<ExecutionResult> {
    const errors: string[] = [];
    const startTime = Date.now();
    let actualProfit = 0;
    let totalSlippage = 0;

    try {
      for (let batch = 0; batch < plan.batches; batch++) {
        const batchStart = Date.now();

        // 执行每个步骤
        for (const step of plan.path.steps) {
          const adjustedStep = {
            ...step,
            size: Math.min(step.size, plan.batchSize),
          };

          try {
            await executor(adjustedStep, batch);

            // 批次间延迟
            if (batch < plan.batches - 1) {
              await this.sleep(plan.delayBetweenBatches);
            }
          } catch (error) {
            errors.push(`Batch ${batch + 1}, Step ${step.marketId}: ${error}`);
          }
        }
      }

      actualProfit = plan.path.expectedProfit;
      totalSlippage = plan.path.totalSlippage;
    } catch (error) {
      errors.push(`Execution failed: ${error}`);
    }

    const executionTime = Date.now() - startTime;

    // 记录执行历史
    const result: ExecutionResult = {
      success: errors.length === 0,
      actualProfit,
      actualSlippage: totalSlippage,
      executionTime,
      errors,
    };

    const history = this.executionHistory.get(plan.path.id) || [];
    history.push(result);
    this.executionHistory.set(plan.path.id, history);

    return result;
  }

  /**
   * 估算滑点
   */
  private estimateSlippage(market1: any, market2: any): number {
    const depth1 = this.calculateDepth(market1);
    const depth2 = this.calculateDepth(market2);

    // 简化的滑点模型
    const slippage1 = 100 / (depth1 + 1) * 0.001; // 0.1%基础滑点
    const slippage2 = 100 / (depth2 + 1) * 0.001;

    return slippage1 + slippage2;
  }

  /**
   * 计算深度
   */
  private calculateDepth(market: any): number {
    const bids = market.bids || [];
    const asks = market.asks || [];

    let bidDepth = 0;
    for (const bid of bids.slice(0, 5)) {
      bidDepth += bid.shares || 0;
    }

    let askDepth = 0;
    for (const ask of asks.slice(0, 5)) {
      askDepth += ask.shares || 0;
    }

    return Math.min(bidDepth, askDepth);
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(market1: any, market2: any): number {
    let confidence = 0.5;

    // 流动性置信度
    const depth1 = this.calculateDepth(market1);
    const depth2 = this.calculateDepth(market2);

    if (depth1 > 200 && depth2 > 200) {
      confidence += 0.3;
    } else if (depth1 > 100 && depth2 > 100) {
      confidence += 0.1;
    }

    // 价差稳定性
    const spread1 = this.calculateSpread(market1);
    const spread2 = this.calculateSpread(market2);

    if (spread1 < 0.02 && spread2 < 0.02) {
      confidence += 0.2;
    }

    return Math.min(1, confidence);
  }

  /**
   * 计算价差
   */
  private calculateSpread(market: any): number {
    const bid = market.bids?.[0]?.price || 0;
    const ask = market.asks?.[0]?.price || 0;
    return ask - bid;
  }

  /**
   * 获取执行统计
   */
  getExecutionStats(pathId: string): {
    totalExecutions: number;
    successRate: number;
    avgProfit: number;
    avgSlippage: number;
    avgExecutionTime: number;
  } | null {
    const history = this.executionHistory.get(pathId);
    if (!history || history.length === 0) return null;

    const totalExecutions = history.length;
    const successful = history.filter(r => r.success);
    const successRate = successful.length / totalExecutions;

    const avgProfit = successful.reduce((sum, r) => sum + r.actualProfit, 0) / (successful.length || 1);
    const avgSlippage = history.reduce((sum, r) => sum + r.actualSlippage, 0) / totalExecutions;
    const avgExecutionTime = history.reduce((sum, r) => sum + r.executionTime, 0) / totalExecutions;

    return {
      totalExecutions,
      successRate,
      avgProfit,
      avgSlippage,
      avgExecutionTime,
    };
  }

  /**
   * 优化路径缓存
   */
  optimizePathCache(maxAge: number = 60000): void {
    const now = Date.now();
    // 缓存优化逻辑可以在这里添加
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ArbitrageOptimizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 重置
   */
  reset(): void {
    this.executionHistory.clear();
    this.pathCache.clear();
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 创建全局单例
export const arbitrageExecutionOptimizer = new ArbitrageExecutionOptimizer();
