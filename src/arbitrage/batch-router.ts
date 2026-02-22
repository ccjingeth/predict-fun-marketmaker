/**
 * Batch Order Routing System
 * 批量订单路由系统 - 智能处理多个套利机会的批量执行
 */

import type { ArbitrageOpportunity } from './types.js';
import { SmartOrderRouter, type RouteResult } from './smart-order-router.js';
import { ExecutionEngine, type ExecutionTask } from './execution-engine.js';
import { scoreArbitrageOpportunity, rankOpportunities } from './scoring.js';
import { RiskManager } from './risk-manager.js';

/**
 * 批量执行配置
 */
export interface BatchExecutionConfig {
  maxBatchSize: number;          // 最大批量大小
  maxTotalExposure: number;      // 最大总敞口
  maxConcurrentBatches: number;  // 最大并发批次数
  enablePrioritization: boolean; // 启用优先级排序
  enableGrouping: boolean;       // 启用分组优化
  riskLimit: number;             // 风险限制
}

/**
 * 批量执行结果
 */
export interface BatchExecutionResult {
  totalOpportunities: number;
  executedCount: number;
  successfulCount: number;
  failedCount: number;
  skippedCount: number;
  totalProfit: number;
  totalCost: number;
  executionTime: number;
  details: {
    opportunity: ArbitrageOpportunity;
    taskId: string;
    status: string;
    profit?: number;
    error?: string;
  }[];
}

/**
 * 机会分组
 */
export interface OpportunityGroup {
  id: string;
  opportunities: ArbitrageOpportunity[];
  totalExposure: number;
  totalProfit: number;
  avgScore: number;
  priority: number;
}

/**
 * 批量路由器
 */
export class BatchOrderRouter {
  private config: BatchExecutionConfig;
  private router: SmartOrderRouter;
  private engine: ExecutionEngine;
  private riskManager: RiskManager;
  private batchHistory: BatchExecutionResult[] = [];

  constructor(
    config: Partial<BatchExecutionConfig> = {},
    engineConfig?: any
  ) {
    this.config = {
      maxBatchSize: 10,
      maxTotalExposure: 5000,
      maxConcurrentBatches: 3,
      enablePrioritization: true,
      enableGrouping: true,
      riskLimit: 0.1,
      ...config,
    };

    this.router = new SmartOrderRouter();
    this.engine = new ExecutionEngine(engineConfig);
    this.riskManager = new RiskManager();
  }

  /**
   * 批量执行套利机会
   */
  async executeBatch(opportunities: ArbitrageOpportunity[]): Promise<BatchExecutionResult> {
    const startTime = Date.now();

    console.log(`\n🎯 批量套利执行`);
    console.log(`   总机会数: ${opportunities.length}`);

    // 步骤 1: 评分和排序
    let scoredOpportunities = opportunities.map(opp => ({
      opportunity: opp,
      score: scoreArbitrageOpportunity(opp),
    }));

    // 步骤 2: 排序（如果启用）
    if (this.config.enablePrioritization) {
      scoredOpportunities = rankOpportunities(
        scoredOpportunities.map(s => s.score)
      ).map(s => ({
        opportunity: s.opportunity,
        score: s,
      }));

      console.log(`\n📊 评分排名 (Top 10):`);
      scoredOpportunities.slice(0, 10).forEach((item, i) => {
        console.log(`   ${i + 1}. [${item.score.recommendation}] ${item.score.totalScore.toFixed(1)}/100 - ${item.opportunity.marketId}`);
      });
    }

    // 步骤 3: 风险预检
    const passedOpps = scoredOpportunities.filter(item => {
      const preflight = this.riskManager.preflightCheck(item.opportunity);
      return preflight.approved;
    });

    console.log(`\n✅ 风险预检通过: ${passedOpps.length}/${opportunities.length}`);

    // 步骤 4: 分组（如果启用）
    let groups: OpportunityGroup[] = [];
    if (this.config.enableGrouping) {
      groups = this.groupOpportunities(passedOpps.map(item => item.opportunity));
      console.log(`\n📦 分组结果: ${groups.length} 个组`);
    } else {
      groups = [
        {
          id: 'batch-1',
          opportunities: passedOpps.map(item => item.opportunity),
          totalExposure: 0,
          totalProfit: 0,
          avgScore: 0,
          priority: 1,
        },
      ];
    }

    // 步骤 5: 执行批量
    const result: BatchExecutionResult = {
      totalOpportunities: opportunities.length,
      executedCount: 0,
      successfulCount: 0,
      failedCount: 0,
      skippedCount: 0,
      totalProfit: 0,
      totalCost: 0,
      executionTime: 0,
      details: [],
    };

    for (const group of groups) {
      const groupResult = await executeGroup(
        group,
        this.router,
        this.engine,
        this.config
      );

      result.executedCount += groupResult.executedCount;
      result.successfulCount += groupResult.successfulCount;
      result.failedCount += groupResult.failedCount;
      result.skippedCount += groupResult.skippedCount;
      result.totalProfit += groupResult.totalProfit;
      result.totalCost += groupResult.totalCost;
      result.details.push(...groupResult.details);

      // 检查总敞口限制
      if (result.totalCost >= this.config.maxTotalExposure) {
        console.log(`\n⚠️  达到总敞口限制 $${this.config.maxTotalExposure}，停止执行`);
        break;
      }
    }

    result.executionTime = Date.now() - startTime;

    // 记录历史
    this.batchHistory.push(result);

    // 打印结果
    this.printResult(result);

    return result;
  }

  /**
   * 分组机会
   */
  private groupOpportunities(opportunities: ArbitrageOpportunity[]): OpportunityGroup[] {
    const groups: OpportunityGroup[] = [];
    const marketGroups = new Map<string, ArbitrageOpportunity[]>();

    // 按市场分组
    for (const opp of opportunities) {
      const marketId = opp.marketId;
      if (!marketGroups.has(marketId)) {
        marketGroups.set(marketId, []);
      }
      marketGroups.get(marketId)!.push(opp);
    }

    // 创建组
    let groupId = 0;
    let currentExposure = 0;

    for (const [marketId, opps] of marketGroups.entries()) {
      const groupTotalExposure = opps.reduce((sum, opp) => {
        return sum + (opp.totalCostUsd || opp.positionSize || 100);
      }, 0);

      // 如果当前组加上这个组会超过限制，创建新组
      if (currentExposure + groupTotalExposure > this.config.maxTotalExposure / this.config.maxConcurrentBatches) {
        groupId++;
        currentExposure = 0;
      }

      const avgScore = opps.reduce((sum, opp) => {
        return sum + scoreArbitrageOpportunity(opp).totalScore;
      }, 0) / opps.length;

      const group: OpportunityGroup = {
        id: `group-${groupId}`,
        opportunities: opps,
        totalExposure: groupTotalExposure,
        totalProfit: opps.reduce((sum, opp) => {
          return sum + (opp.expectedReturn || opp.arbitrageProfit || 0);
        }, 0),
        avgScore,
        priority: groupId,
      };

      groups.push(group);
      currentExposure += groupTotalExposure;
    }

    return groups;
  }

  /**
   * 打印结果
   */
  private printResult(result: BatchExecutionResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 批量执行结果');
    console.log('='.repeat(60));

    console.log(`\n总览:`);
    console.log(`   总机会: ${result.totalOpportunities}`);
    console.log(`   已执行: ${result.executedCount}`);
    console.log(`   成功: ${result.successfulCount} (${(result.successfulCount / result.executedCount * 100).toFixed(1)}%)`);
    console.log(`   失败: ${result.failedCount}`);
    console.log(`   跳过: ${result.skippedCount}`);

    console.log(`\n财务:`);
    console.log(`   总利润: $${result.totalProfit.toFixed(2)}`);
    console.log(`   总成本: $${result.totalCost.toFixed(2)}`);
    console.log(`   净利润: $${(result.totalProfit - result.totalCost).toFixed(2)}`);
    console.log(`   利润率: ${((result.totalProfit / result.totalCost) * 100).toFixed(2)}%`);

    console.log(`\n性能:`);
    console.log(`   执行时间: ${(result.executionTime / 1000).toFixed(2)}秒`);
    console.log(`   平均每笔: ${(result.executionTime / result.executedCount).toFixed(0)}ms`);

    console.log('\n' + '='.repeat(60));
  }

  /**
   * 获取批量历史
   */
  getBatchHistory(): BatchExecutionResult[] {
    return [...this.batchHistory];
  }

  /**
   * 获取批量统计
   */
  getBatchStats(): {
    totalBatches: number;
    totalOpportunities: number;
    totalExecuted: number;
    totalSuccessful: number;
    avgExecutionTime: number;
    avgProfit: number;
  } {
    const totalBatches = this.batchHistory.length;
    const totalOpportunities = this.batchHistory.reduce((sum, b) => sum + b.totalOpportunities, 0);
    const totalExecuted = this.batchHistory.reduce((sum, b) => sum + b.executedCount, 0);
    const totalSuccessful = this.batchHistory.reduce((sum, b) => sum + b.successfulCount, 0);
    const avgExecutionTime =
      this.batchHistory.reduce((sum, b) => sum + b.executionTime, 0) / totalBatches;
    const avgProfit =
      this.batchHistory.reduce((sum, b) => sum + b.totalProfit, 0) / totalBatches;

    return {
      totalBatches,
      totalOpportunities,
      totalExecuted,
      totalSuccessful,
      avgExecutionTime,
      avgProfit,
    };
  }
}

/**
 * 执行单个分组
 */
async function executeGroup(
  group: OpportunityGroup,
  router: SmartOrderRouter,
  engine: ExecutionEngine,
  config: BatchExecutionConfig
): Promise<BatchExecutionResult> {
  const result: BatchExecutionResult = {
    totalOpportunities: group.opportunities.length,
    executedCount: 0,
    successfulCount: 0,
    failedCount: 0,
    skippedCount: 0,
    totalProfit: 0,
    totalCost: 0,
    executionTime: 0,
    details: [],
  };

  const maxInBatch = Math.min(group.opportunities.length, config.maxBatchSize);
  const tasksToExecute = group.opportunities.slice(0, maxInBatch);

  console.log(`\n📦 执行组 ${group.id}: ${tasksToExecute.length} 个机会`);

  // 并发提交任务
  const taskIds = await Promise.all(
    tasksToExecute.map(async (opp) => {
      try {
        const taskId = await engine.submitTask(opp);
        result.details.push({
          opportunity: opp,
          taskId,
          status: 'SUBMITTED',
        });
        return taskId;
      } catch (error) {
        result.details.push({
          opportunity: opp,
          taskId: '',
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        });
        result.failedCount++;
        return null;
      }
    })
  );

  result.executedCount = tasksToExecute.length;

  // 等待所有任务完成
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 更新结果
  const stats = engine.getStats();
  result.successfulCount = stats.successfulTasks;
  result.failedCount = stats.failedTasks;

  return result;
}

/**
 * 批量路由器工厂
 */
let globalBatchRouter: BatchOrderRouter | null = null;

export function getBatchRouter(config?: Partial<BatchExecutionConfig>): BatchOrderRouter {
  if (!globalBatchRouter) {
    globalBatchRouter = new BatchOrderRouter(config);
  }

  return globalBatchRouter;
}
