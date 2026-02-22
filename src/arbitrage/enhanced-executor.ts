/**
 * Enhanced Arbitrage Executor
 * 增强的套利执行器 - 集成评分、风险管理和动态阈值
 */

import type { ArbitrageOpportunity, ArbitrageExecution } from './types.js';
import { scoreArbitrageOpportunity, rankOpportunities, filterOpportunities } from './scoring.js';
import { DynamicThresholdManager, calculateDynamicThresholds } from './dynamic-thresholds.js';
import { RiskManager } from './risk-manager.js';

export interface EnhancedExecutionConfig {
  // 基础配置
  maxPositionSize: number;
  maxSlippage: number;
  enableAutoExecute: boolean;
  requireConfirmation: boolean;

  // 新增配置
  enableScoring: boolean;           // 启用评分系统
  enableDynamicThresholds: boolean; // 启用动态阈值
  enableRiskManagement: boolean;    // 启用风险管理
  minScore: number;                // 最小评分

  // 风险配置
  riskConfig: {
    maxTotalExposure: number;
    maxPositionSize: number;
    maxVar: number;
  };
}

export interface ExecutionResult {
  success: boolean;
  execution?: ArbitrageExecution;
  score?: any;
  preflight?: any;
  error?: string;
}

/**
 * 增强的套利执行器
 */
export class EnhancedArbitrageExecutor {
  private config: EnhancedExecutionConfig;
  private riskManager: RiskManager;
  private thresholdManager: DynamicThresholdManager;
  private executions: Map<string, ArbitrageExecution> = new Map();

  constructor(config: Partial<EnhancedExecutionConfig> = {}) {
    this.config = {
      maxPositionSize: 100,
      maxSlippage: 0.01,
      enableAutoExecute: false,
      requireConfirmation: true,
      enableScoring: true,
      enableDynamicThresholds: true,
      enableRiskManagement: true,
      minScore: 60,
      riskConfig: {
        maxTotalExposure: 5000,
        maxPositionSize: 200,
        maxVar: 500,
      },
      ...config,
    };

    // 初始化风险管理器
    this.riskManager = new RiskManager(this.config.riskConfig);

    // 初始化阈值管理器
    this.thresholdManager = new DynamicThresholdManager(60000); // 1 分钟更新
  }

  /**
   * 执行套利（增强版）
   */
  async executeArbitrage(opp: ArbitrageOpportunity): Promise<ExecutionResult> {
    try {
      // 步骤 1: 评分
      if (this.config.enableScoring) {
        const score = scoreArbitrageOpportunity(opp);
        console.log(`\n📊 机会评分: ${score.totalScore.toFixed(1)}/100`);
        console.log(`   推荐: ${score.recommendation}`);
        console.log(`   利润: ${score.profitScore.toFixed(1)}/100`);
        console.log(`   风险: ${score.riskScore.toFixed(1)}/100`);
        console.log(`   流动性: ${score.liquidityScore.toFixed(1)}/100`);
        console.log(`   速度: ${score.speedScore.toFixed(1)}/100`);
        console.log(`   分析:`);
        console.log(`     - ${score.analysis.profitAnalysis}`);
        console.log(`     - ${score.analysis.riskAnalysis}`);
        console.log(`     - ${score.analysis.liquidityAnalysis}`);
        console.log(`     - ${score.analysis.speedAnalysis}`);

        // 检查是否应该执行
        if (score.recommendation === 'SKIP') {
          return {
            success: false,
            score,
            error: '机会评分过低，跳过执行',
          };
        }
      }

      // 步骤 2: 风险预检
      if (this.config.enableRiskManagement) {
        const preflight = this.riskManager.preflightCheck(opp);
        console.log(`\n⚠️  风险预检: ${preflight.riskLevel}`);
        console.log(`   状态: ${preflight.approved ? '✅ 通过' : '❌ 拒绝'}`);

        if (preflight.reasons.length > 0) {
          console.log(`   原因:`);
          preflight.reasons.forEach(reason => console.log(`     ${reason}`));
        }

        if (preflight.warnings.length > 0) {
          console.log(`   警告:`);
          preflight.warnings.forEach(warning => console.log(`     ${warning}`));
        }

        if (!preflight.approved) {
          return {
            success: false,
            preflight,
            error: '风险预检未通过',
          };
        }

        // 应用调整
        if (preflight.adjustedSize) {
          console.log(`   📏 仓位大小已调整: ${preflight.adjustedSize}`);
        }
      }

      // 步骤 3: 用户确认
      if (this.config.requireConfirmation) {
        const confirmed = await this.confirmExecution(opp);
        if (!confirmed) {
          return {
            success: false,
            error: '用户取消执行',
          };
        }
      }

      // 步骤 4: 执行套利
      const execution = await this.executeTrade(opp);

      // 步骤 5: 记录执行
      this.executions.set(execution.opportunityId, execution);

      return {
        success: true,
        execution,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 批量执行套利（带评分和过滤）
   */
  async executeBatchArbitrage(
    opportunities: ArbitrageOpportunity[],
    marketData?: any[]
  ): Promise<ExecutionResult[]> {
    console.log(`\n🎯 批量套利执行`);
    console.log(`   总机会数: ${opportunities.length}`);

    // 步骤 1: 动态阈值
    let thresholds;
    if (this.config.enableDynamicThresholds && marketData) {
      thresholds = await this.thresholdManager.getThresholds(marketData);
      console.log(`\n📊 市场状况:`);
      console.log(`   波动率: ${thresholds.marketVolatility}`);
      console.log(`   流动性: ${thresholds.liquidityLevel}`);
      console.log(`   推荐配置: ${thresholds.recommendedConfig.aggressive ? '激进' : '保守'}`);
    }

    // 步骤 2: 评分和排序
    const scored = opportunities.map(opp => scoreArbitrageOpportunity(opp));
    const ranked = rankOpportunities(scored);

    console.log(`\n📊 评分排名:`);
    ranked.slice(0, 10).forEach((scoredOpp, i) => {
      console.log(`   ${i + 1}. [${scoredOpp.recommendation}] ${scoredOpp.totalScore.toFixed(1)}/100 - ${scoredOpp.opportunity.type}`);
    });

    // 步骤 3: 过滤
    const filtered = filterOpportunities(opportunities, {
      minScore: this.config.minScore,
      minProfit: 0.01,
    });

    console.log(`\n🔍 过滤结果:`);
    console.log(`   原始: ${opportunities.length}`);
    console.log(`   过滤后: ${filtered.length}`);

    // 步骤 4: 风险预检
    const passedPreflight: ArbitrageOpportunity[] = [];
    for (const opp of filtered) {
      const preflight = this.riskManager.preflightCheck(opp);
      if (preflight.approved) {
        passedPreflight.push(opp);
      }
    }

    console.log(`   通过预检: ${passedPreflight.length}`);

    // 步骤 5: 执行（如果启用）
    const results: ExecutionResult[] = [];

    if (this.config.enableAutoExecute) {
      console.log(`\n🚀 自动执行模式:`);
      const maxExecutions = 5; // 最多执行 5 个

      for (let i = 0; i < Math.min(passedPreflight.length, maxExecutions); i++) {
        const opp = passedPreflight[i];
        console.log(`\n   执行 ${i + 1}/${maxExecutions}: ${opp.type}`);

        const result = await this.executeArbitrage(opp);
        results.push(result);

        // 如果执行失败，停止后续执行
        if (!result.success) {
          console.log(`   ⚠️ 执行失败，停止批量执行`);
          break;
        }
      }
    } else {
      console.log(`\nℹ️  手动执行模式 - 已准备 ${passedPreflight.length} 个机会`);
      // 不自动执行，只记录机会
    }

    return results;
  }

  /**
   * 获取执行报告
   */
  getExecutionReport(): {
    totalExecuted: number;
    successRate: number;
    totalProfit: number;
    avgProfit: number;
    riskReport: any;
  } {
    const totalExecuted = this.executions.size;
    const succeeded = Array.from(this.executions.values())
      .filter(e => e.status === 'EXECUTED').length;

    const successRate = totalExecuted > 0 ? succeeded / totalExecuted : 0;

    // TODO: 计算总利润和平均利润
    const totalProfit = 0;
    const avgProfit = 0;

    const riskReport = this.riskManager.getRiskReport();

    return {
      totalExecuted,
      successRate,
      totalProfit,
      avgProfit,
      riskReport,
    };
  }

  /**
   * 打印统计信息
   */
  printStats(): void {
    const report = this.getExecutionReport();

    console.log('\n📊 执行统计:');
    console.log(`   总执行: ${report.totalExecuted}`);
    console.log(`   成功率: ${(report.successRate * 100).toFixed(1)}%`);
    console.log(`   总利润: $${report.totalProfit.toFixed(2)}`);
    console.log(`   平均利润: $${report.avgProfit.toFixed(2)}`);

    console.log('\n🎯 风险报告:');
    console.log(`   总仓位: ${report.riskReport.totalPositions}`);
    console.log(`   总敞口: $${report.riskReport.totalExposure.toFixed(2)}`);
    console.log(`   风险等级: ${report.riskReport.avgRisk}`);

    if (report.riskReport.recommendations.length > 0) {
      console.log('\n💡 建议:');
      report.riskReport.recommendations.forEach(rec => {
        console.log(`   - ${rec}`);
      });
    }
  }

  /**
   * 确认执行
   */
  private async confirmExecution(opp: ArbitrageOpportunity): Promise<boolean> {
    const readline = require('node:readline/promises');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = `\n执行 ${opp.type} 套利？\n` +
                      `   市场: ${opp.marketQuestion?.substring(0, 50)}...\n` +
                      `   利润: ${((opp.expectedReturn || 0) * 100).toFixed(2)}%\n` +
                      `   确认执行？(y/n) `;

    const answer = await rl.question(question);
    rl.close();

    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  /**
   * 执行交易
   */
  private async executeTrade(opp: ArbitrageOpportunity): Promise<ArbitrageExecution> {
    const execution: ArbitrageExecution = {
      opportunityId: `${opp.type}-${opp.marketId}-${Date.now()}`,
      type: opp.type,
      timestamp: Date.now(),
      status: 'PENDING',
      trades: [],
      totalCost: 0,
      expectedProfit: opp.expectedReturn || opp.arbitrageProfit || 0,
      fees: 0,
    };

    // TODO: 实现实际交易执行
    console.log(`   执行 ${opp.type} 套利...`);

    return execution;
  }
}
