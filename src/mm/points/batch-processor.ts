/**
 * 批量处理器 - 性能优化
 *
 * 功能：
 * 1. 批量积分检查（避免重复计算）
 * 2. 异步处理（不阻塞主循环）
 * 3. 智能缓存（减少 API 调用）
 * 4. 并行处理（提高吞吐量）
 * 5. 队列管理（避免过载）
 */

import type { Market, Orderbook } from '../../types.js';
import { pointsManager } from './points-manager.js';
import { pointsOptimizerEngineV2 } from './points-optimizer-v2.js';

/**
 * 批量检查任务
 */
interface BatchTask {
  market: Market;
  orderSize: number;
  spread: number;
  orderbook: Orderbook;
  priority: number; // 优先级
}

/**
 * 批量检查结果
 */
export interface BatchCheckResult {
  marketId: string;
  isEligible: boolean;
  reason: string;
  optimizedParams?: {
    price: number;
    shares: number;
    spread: number;
    expectedPoints: number;
    overallScore: number;
  };
}

/**
 * 处理器配置
 */
export interface BatchProcessorConfig {
  maxBatchSize: number;       // 最大批次大小
  maxQueueSize: number;       // 最大队列大小
  processInterval: number;    // 处理间隔（毫秒）
  enableParallel: boolean;    // 启用并行处理
  enableCaching: boolean;     // 启用缓存
  cacheTTL: number;           // 缓存生存时间（毫秒）
}

/**
 * 批量处理器
 */
export class BatchProcessor {
  private config: BatchProcessorConfig;
  private queue: BatchTask[] = [];
  private processing = false;
  private cache = new Map<string, { result: BatchCheckResult; timestamp: number }>();
  private stats = {
    totalProcessed: 0,
    cacheHits: 0,
    averageProcessTime: 0,
  };

  constructor(config?: Partial<BatchProcessorConfig>) {
    this.config = {
      maxBatchSize: 50,
      maxQueueSize: 200,
      processInterval: 100, // 100ms
      enableParallel: true,
      enableCaching: true,
      cacheTTL: 5000, // 5秒
      ...config,
    };
  }

  /**
   * 添加任务到队列
   */
  enqueue(task: BatchTask): boolean {
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('BatchProcessor: Queue full, dropping low-priority tasks');
      // 删除低优先级任务
      this.queue.sort((a, b) => b.priority - a.priority);
      this.queue = this.queue.slice(0, this.config.maxBatchSize);
    }

    this.queue.push(task);
    return true;
  }

  /**
   * 批量添加任务
   */
  enqueueBatch(tasks: BatchTask[]): number {
    let added = 0;
    for (const task of tasks) {
      if (this.enqueue(task)) {
        added++;
      }
    }
    return added;
  }

  /**
   * 处理队列
   */
  async processQueue(): Promise<BatchCheckResult[]> {
    if (this.processing) {
      return [];
    }

    this.processing = true;

    try {
      // 按优先级排序
      this.queue.sort((a, b) => b.priority - a.priority);

      // 取出一批任务
      const batch = this.queue.splice(0, this.config.maxBatchSize);

      if (batch.length === 0) {
        return [];
      }

      const startTime = Date.now();

      // 处理批次
      let results: BatchCheckResult[];
      if (this.config.enableParallel) {
        results = await this.processBatchParallel(batch);
      } else {
        results = await this.processBatchSequential(batch);
      }

      // 更新统计
      const processTime = Date.now() - startTime;
      this.stats.totalProcessed += batch.length;
      this.stats.averageProcessTime =
        (this.stats.averageProcessTime * (this.stats.totalProcessed - batch.length) + processTime) /
        this.stats.totalProcessed;

      // 更新缓存
      if (this.config.enableCaching) {
        for (const result of results) {
          this.cache.set(result.marketId, { result, timestamp: Date.now() });
        }
      }

      return results;
    } finally {
      this.processing = false;
    }
  }

  /**
   * 并行处理批次
   */
  private async processBatchParallel(batch: BatchTask[]): Promise<BatchCheckResult[]> {
    const promises = batch.map(task => this.processTask(task));
    return Promise.all(promises);
  }

  /**
   * 顺序处理批次
   */
  private async processBatchSequential(batch: BatchTask[]): Promise<BatchCheckResult[]> {
    const results: BatchCheckResult[] = [];
    for (const task of batch) {
      const result = await this.processTask(task);
      results.push(result);
    }
    return results;
  }

  /**
   * 处理单个任务
   */
  private async processTask(task: BatchTask): Promise<BatchCheckResult> {
    // 检查缓存
    if (this.config.enableCaching) {
      const cached = this.getFromCache(task.market.token_id);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
    }

    // 积分检查
    const check = pointsManager.checkOrderEligibility(
      task.market,
      task.orderSize,
      task.spread
    );

    // 计算优化参数
    const optimized = pointsOptimizerEngineV2.optimizeOrder(
      task.market,
      task.orderbook.mid_price || 0.5,
      task.spread,
      'BUY', // 默认 BUY，实际使用时会调整
      task.orderbook,
      task.orderSize
    );

    const result: BatchCheckResult = {
      marketId: task.market.token_id,
      isEligible: check.isEligible,
      reason: check.reason || '',
      optimizedParams: {
        price: optimized.price,
        shares: optimized.shares,
        spread: optimized.spread,
        expectedPoints: optimized.expectedPoints,
        overallScore: optimized.overallScore,
      },
    };

    return result;
  }

  /**
   * 从缓存获取结果
   */
  private getFromCache(marketId: string): BatchCheckResult | null {
    const cached = this.cache.get(marketId);
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTTL) {
      this.cache.delete(marketId);
      return null;
    }

    return cached.result;
  }

  /**
   * 批量检查积分（主入口）
   */
  async batchCheckPoints(
    markets: Market[],
    orderbooks: Map<string, Orderbook>,
    orderSizes: Map<string, number>,
    spreads: Map<string, number>
  ): Promise<Map<string, BatchCheckResult>> {
    const results = new Map<string, BatchCheckResult>();

    // 构建任务
    const tasks: BatchTask[] = [];
    for (const market of markets) {
      const orderbook = orderbooks.get(market.token_id);
      const orderSize = orderSizes.get(market.token_id) || 100;
      const spread = spreads.get(market.token_id) || 0.02;

      if (!orderbook) continue;

      // 计算优先级
      const stats = pointsManager.getMarketStats(market.token_id);
      const priority = stats ? stats.eligibleOrders / (stats.totalOrders || 1) : 0.5;

      tasks.push({
        market,
        orderSize,
        spread,
        orderbook,
        priority,
      });
    }

    // 批量处理
    const batchResults = await this.processBatch(tasks);

    // 构建结果 Map
    for (const result of batchResults) {
      results.set(result.marketId, result);
    }

    return results;
  }

  /**
   * 处理单个批次
   */
  private async processBatch(batch: BatchTask[]): Promise<BatchCheckResult[]> {
    if (this.config.enableParallel) {
      return await this.processBatchParallel(batch);
    } else {
      return await this.processBatchSequential(batch);
    }
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.totalProcessed > 0
        ? this.stats.cacheHits / this.stats.totalProcessed
        : 0,
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      cacheHits: 0,
      averageProcessTime: 0,
    };
  }

  /**
   * 重置所有
   */
  reset(): void {
    this.clearCache();
    this.clearQueue();
    this.resetStats();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BatchProcessorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): BatchProcessorConfig {
    return { ...this.config };
  }
}

// 创建全局单例
export const batchProcessor = new BatchProcessor();
