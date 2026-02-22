/**
 * Execution Engine Optimizations
 * 执行引擎优化 - 并发控制、智能重试、滑点优化
 */

import type { ArbitrageOpportunity, ArbitrageExecution } from './types.js';
import { SmartOrderRouter, type RouteResult } from './smart-order-router.js';

/**
 * 执行状态
 */
export type ExecutionStatus = 'PENDING' | 'EXECUTING' | 'SUCCESS' | 'FAILED' | 'RETRYING';

/**
 * 执行任务
 */
export interface ExecutionTask {
  id: string;
  opportunity: ArbitrageOpportunity;
  route: RouteResult;
  status: ExecutionStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: ArbitrageExecution;
}

/**
 * 并发控制配置
 */
export interface ConcurrencyConfig {
  maxConcurrent: number;           // 最大并发数
  maxRetries: number;              // 最大重试次数
  retryDelay: number;              // 重试延迟（毫秒）
  timeout: number;                 // 超时时间（毫秒）
  enableRateLimit: boolean;        // 启用速率限制
  rateLimitPerSecond: number;      // 每秒最大请求数
}

/**
 * 滑点优化配置
 */
export interface SlippageConfig {
  maxSlippage: number;             // 最大滑点
  slippageTolerance: number;       // 滑点容忍度
  dynamicSlippage: boolean;        // 动态滑点
  slippageBuffer: number;          // 滑点缓冲
}

/**
 * 执行引擎配置
 */
export interface ExecutionEngineConfig {
  concurrency: ConcurrencyConfig;
  slippage: SlippageConfig;
  enableOptimizations: boolean;
}

/**
 * 执行统计
 */
export interface ExecutionStats {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  retryingTasks: number;
  avgExecutionTime: number;
  avgSlippage: number;
  successRate: number;
}

/**
 * 执行引擎
 */
export class ExecutionEngine {
  private config: ExecutionEngineConfig;
  private queue: ExecutionTask[] = [];
  private executing: Map<string, ExecutionTask> = new Map();
  private stats: ExecutionStats = {
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    retryingTasks: 0,
    avgExecutionTime: 0,
    avgSlippage: 0,
    successRate: 0,
  };
  private router: SmartOrderRouter;
  private executionTimes: number[] = [];
  private slippages: number[] = [];

  constructor(config: Partial<ExecutionEngineConfig> = {}) {
    this.config = {
      concurrency: {
        maxConcurrent: 3,
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
        enableRateLimit: true,
        rateLimitPerSecond: 10,
      },
      slippage: {
        maxSlippage: 0.01,
        slippageTolerance: 0.005,
        dynamicSlippage: true,
        slippageBuffer: 0.002,
      },
      enableOptimizations: true,
      ...config,
    };

    this.router = new SmartOrderRouter();
  }

  /**
   * 提交执行任务
   */
  async submitTask(opportunity: ArbitrageOpportunity): Promise<string> {
    const taskId = `${opportunity.marketId}-${Date.now()}`;

    // 计算路由
    const positionSize = opportunity.positionSize || 100;
    const route = this.router.calculateRoute(opportunity, positionSize);

    // 创建任务
    const task: ExecutionTask = {
      id: taskId,
      opportunity,
      route,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: this.config.concurrency.maxRetries,
      createdAt: Date.now(),
    };

    this.queue.push(task);
    this.stats.totalTasks++;

    // 尝试执行
    this.processQueue();

    return taskId;
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    // 检查并发限制
    const canExecute = this.executing.size < this.config.concurrency.maxConcurrent;
    if (!canExecute || this.queue.length === 0) {
      return;
    }

    // 获取下一个任务
    const task = this.queue.shift();
    if (!task) return;

    // 标记为执行中
    task.status = 'EXECUTING';
    task.startedAt = Date.now();
    this.executing.set(task.id, task);

    // 执行任务
    this.executeTask(task).finally(() => {
      this.executing.delete(task.id);
      this.processQueue(); // 继续处理队列
    });
  }

  /**
   * 执行任务
   */
  private async executeTask(task: ExecutionTask): Promise<void> {
    try {
      console.log(`\n🚀 执行任务 ${task.id}`);
      console.log(`   类型: ${task.opportunity.type}`);
      console.log(`   片段数: ${task.route.slices.length}`);
      console.log(`   预期滑点: ${(task.route.expectedSlippage * 100).toFixed(3)}%`);
      console.log(`   置信度: ${(task.route.confidence * 100).toFixed(1)}%`);

      // 1. 滑点检查
      if (task.route.expectedSlippage > this.config.slippage.maxSlippage) {
        throw new Error(`预期滑点 ${task.route.expectedSlippage} 超过最大值 ${this.config.slippage.maxSlippage}`);
      }

      // 2. 执行订单片段
      const results = await this.executeSlices(task);

      // 3. 验证结果
      const actualSlippage = this.calculateActualSlippage(task.route, results);

      // 4. 更新统计
      this.updateStats(task, true, actualSlippage);

      task.status = 'SUCCESS';
      task.completedAt = Date.now();

      console.log(`   ✅ 执行成功`);
      console.log(`   实际滑点: ${(actualSlippage * 100).toFixed(3)}%`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 检查是否可以重试
      if (task.attempts < task.maxAttempts && this.isRetryableError(error)) {
        task.status = 'RETRYING';
        task.attempts++;
        task.error = errorMessage;

        this.stats.retryingTasks++;

        console.log(`   ⚠️ 执行失败，重试 ${task.attempts}/${task.maxAttempts}: ${errorMessage}`);

        // 延迟后重新入队
        setTimeout(() => {
          this.queue.unshift(task);
          this.processQueue();
        }, this.config.concurrency.retryDelay * task.attempts);
      } else {
        task.status = 'FAILED';
        task.completedAt = Date.now();
        task.error = errorMessage;

        this.stats.failedTasks++;

        console.log(`   ❌ 执行失败: ${errorMessage}`);
      }
    }
  }

  /**
   * 执行订单片段
   */
  private async executeSlices(task: ExecutionTask): Promise<any[]> {
    const results = [];

    for (const slice of task.route.slices) {
      console.log(`   执行片段: ${slice.size} 股 @ ${slice.price.toFixed(4)}`);

      // 模拟执行（实际应该调用交易 API）
      const result = await this.executeSlice(slice, task.opportunity);
      results.push(result);

      // 检查超时
      const elapsed = Date.now() - (task.startedAt || 0);
      if (elapsed > this.config.concurrency.timeout) {
        throw new Error(`执行超时: ${elapsed}ms > ${this.config.concurrency.timeout}ms`);
      }

      // 速率限制
      if (this.config.concurrency.enableRateLimit) {
        await this.rateLimitDelay();
      }
    }

    return results;
  }

  /**
   * 执行单个片段
   */
  private async executeSlice(
    slice: any,
    opportunity: ArbitrageOpportunity
  ): Promise<any> {
    // TODO: 实际执行交易
    // 这里应该调用 predict.fun 的交易 API

    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // 模拟成功率
    const success = Math.random() > 0.1; // 90% 成功率

    if (!success) {
      throw new Error('订单执行失败（模拟）');
    }

    return {
      price: slice.price,
      size: slice.size,
      timestamp: Date.now(),
    };
  }

  /**
   * 计算实际滑点
   */
  private calculateActualSlippage(route: RouteResult, results: any[]): number {
    // 简化计算
    return route.expectedSlippage * (0.8 + Math.random() * 0.4); // 80-120% 的预期滑点
  }

  /**
   * 检查错误是否可重试
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'rate limit',
      '临时',
      '超时',
    ];

    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * 速率限制延迟
   */
  private async rateLimitDelay(): Promise<void> {
    const delay = 1000 / this.config.concurrency.rateLimitPerSecond;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 更新统计
   */
  private updateStats(task: ExecutionTask, success: boolean, slippage: number): void {
    if (success) {
      this.stats.successfulTasks++;

      // 更新执行时间
      if (task.startedAt && task.completedAt) {
        const executionTime = task.completedAt - task.startedAt;
        this.executionTimes.push(executionTime);
        if (this.executionTimes.length > 100) {
          this.executionTimes.shift();
        }
        this.stats.avgExecutionTime =
          this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length;
      }

      // 更新滑点
      this.slippages.push(slippage);
      if (this.slippages.length > 100) {
        this.slippages.shift();
      }
      this.stats.avgSlippage =
        this.slippages.reduce((a, b) => a + b, 0) / this.slippages.length;
    }

    // 更新成功率
    this.stats.successRate =
      this.stats.successfulTasks / this.stats.totalTasks;
  }

  /**
   * 获取统计信息
   */
  getStats(): ExecutionStats {
    return { ...this.stats };
  }

  /**
   * 打印统计信息
   */
  printStats(): void {
    console.log('\n📊 执行引擎统计:');
    console.log(`   总任务: ${this.stats.totalTasks}`);
    console.log(`   成功: ${this.stats.successfulTasks}`);
    console.log(`   失败: ${this.stats.failedTasks}`);
    console.log(`   重试中: ${this.stats.retryingTasks}`);
    console.log(`   成功率: ${(this.stats.successRate * 100).toFixed(1)}%`);
    console.log(`   平均执行时间: ${this.stats.avgExecutionTime.toFixed(0)}ms`);
    console.log(`   平均滑点: ${(this.stats.avgSlippage * 100).toFixed(3)}%`);
    console.log(`   队列长度: ${this.queue.length}`);
    console.log(`   执行中: ${this.executing.size}`);
  }

  /**
   * 优化滑点
   */
  optimizeSlippage(opportunity: ArbitrageOpportunity): number {
    if (!this.config.slippage.dynamicSlippage) {
      return this.config.slippage.maxSlippage;
    }

    let slippage = this.config.slippage.maxSlippage;

    // 根据市场状况调整
    if (opportunity.depthShares && opportunity.depthShares < 100) {
      // 低深度，增加滑点容忍度
      slippage *= 1.5;
    }

    if (opportunity.yesAsk && opportunity.yesBid) {
      const spread = (opportunity.yesAsk - opportunity.yesBid) / opportunity.yesBid;
      if (spread > 0.02) {
        // 大价差，增加滑点容忍度
        slippage *= 1.2;
      }
    }

    // 加上缓冲
    return slippage + this.config.slippage.slippageBuffer;
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    // 从队列中移除
    const queueIndex = this.queue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      this.stats.totalTasks--;
      return true;
    }

    // 无法取消正在执行的任务
    return false;
  }

  /**
   * 清理队列
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    pending: number;
    executing: number;
    total: number;
  } {
    return {
      pending: this.queue.length,
      executing: this.executing.size,
      total: this.queue.length + this.executing.size,
    };
  }
}

/**
 * 单例执行引擎
 */
let globalEngine: ExecutionEngine | null = null;

export function getExecutionEngine(config?: Partial<ExecutionEngineConfig>): ExecutionEngine {
  if (!globalEngine) {
    globalEngine = new ExecutionEngine(config);
  }

  return globalEngine;
}
