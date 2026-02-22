/**
 * Performance Monitoring Dashboard
 * 性能监控仪表板 - 实时统计和性能指标
 */

import type { ArbitrageOpportunity } from './types.js';

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  // 执行指标
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;

  // 利润指标
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  avgProfitPerTrade: number;
  profitFactor: number; // 总利润 / 总损失

  // 时间指标
  avgExecutionTime: number;
  maxExecutionTime: number;
  minExecutionTime: number;
  p95ExecutionTime: number; // 95 分位执行时间

  // 滑点指标
  avgSlippage: number;
  maxSlippage: number;
  slippageDistribution: { range: string; count: number }[];

  // 风险指标
  maxDrawdown: number;
  currentDrawdown: number;
  var95: number; // 95% 置信度的 VaR

  // 市场指标
  avgSpread: number;
  avgLiquidity: number;
  volatility: number;

  // 实时指标
  activePositions: number;
  queuedTrades: number;
  pendingOrders: number;
}

/**
 * 套利机会统计
 */
export interface OpportunityStats {
  byType: Record<string, number>;
  byMarket: Record<string, number>;
  avgProfitByType: Record<string, number>;
  topMarkets: { marketId: string; count: number; profit: number }[];
}

/**
 * 实时性能数据
 */
export interface RealTimeData {
  timestamp: number;
  profit: number;
  positions: number;
  executionTime: number;
  slippage: number;
}

/**
 * 仪表板配置
 */
export interface DashboardConfig {
  updateInterval: number;      // 更新间隔（毫秒）
  historySize: number;         // 历史数据大小
  enableAlerts: boolean;       // 启用警报
  alertThresholds: {
    lowSuccessRate: number;    // 低成功率警报阈值
    highSlippage: number;      // 高滑点警报阈值
    highDrawdown: number;      // 高回撤警报阈值
  };
}

/**
 * 性能仪表板
 */
export class PerformanceDashboard {
  private config: DashboardConfig;
  private metrics: PerformanceMetrics;
  private history: RealTimeData[] = [];
  private executionHistory: { timestamp: number; profit: number; time: number; slippage: number }[] = [];
  private opportunities: ArbitrageOpportunity[] = [];
  private alertCallbacks: Map<string, (data: any) => void> = new Map();

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      updateInterval: 5000, // 5 秒
      historySize: 1000,
      enableAlerts: true,
      alertThresholds: {
        lowSuccessRate: 0.7,    // 70%
        highSlippage: 0.01,     // 1%
        highDrawdown: 0.1,      // 10%
      },
      ...config,
    };

    this.metrics = this.initializeMetrics();
    this.startAutoUpdate();
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      successRate: 0,

      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      avgProfitPerTrade: 0,
      profitFactor: 0,

      avgExecutionTime: 0,
      maxExecutionTime: 0,
      minExecutionTime: Infinity,
      p95ExecutionTime: 0,

      avgSlippage: 0,
      maxSlippage: 0,
      slippageDistribution: [],

      maxDrawdown: 0,
      currentDrawdown: 0,
      var95: 0,

      avgSpread: 0,
      avgLiquidity: 0,
      volatility: 0,

      activePositions: 0,
      queuedTrades: 0,
      pendingOrders: 0,
    };
  }

  /**
   * 记录执行
   */
  recordExecution(data: {
    success: boolean;
    profit: number;
    executionTime: number;
    slippage: number;
  }): void {
    const timestamp = Date.now();

    // 更新执行计数
    this.metrics.totalExecutions++;
    if (data.success) {
      this.metrics.successfulExecutions++;
      if (data.profit > 0) {
        this.metrics.totalProfit += data.profit;
      } else {
        this.metrics.totalLoss += Math.abs(data.profit);
      }
    } else {
      this.metrics.failedExecutions++;
    }

    // 更新成功率
    this.metrics.successRate =
      this.metrics.successfulExecutions / this.metrics.totalExecutions;

    // 更新执行时间
    this.metrics.avgExecutionTime =
      (this.metrics.avgExecutionTime * (this.metrics.totalExecutions - 1) + data.executionTime) /
      this.metrics.totalExecutions;

    this.metrics.maxExecutionTime = Math.max(this.metrics.maxExecutionTime, data.executionTime);
    this.metrics.minExecutionTime = Math.min(this.metrics.minExecutionTime, data.executionTime);

    // 更新滑点
    this.metrics.avgSlippage =
      (this.metrics.avgSlippage * (this.metrics.totalExecutions - 1) + data.slippage) /
      this.metrics.totalExecutions;

    this.metrics.maxSlippage = Math.max(this.metrics.maxSlippage, data.slippage);

    // 计算净利润和平均利润
    this.metrics.netProfit = this.metrics.totalProfit - this.metrics.totalLoss;
    this.metrics.avgProfitPerTrade =
      this.metrics.netProfit / this.metrics.successfulExecutions;

    // 计算利润因子
    if (this.metrics.totalLoss > 0) {
      this.metrics.profitFactor = this.metrics.totalProfit / this.metrics.totalLoss;
    }

    // 添加到历史记录
    this.executionHistory.push({
      timestamp,
      profit: data.profit,
      time: data.executionTime,
      slippage: data.slippage,
    });

    // 限制历史大小
    if (this.executionHistory.length > this.config.historySize) {
      this.executionHistory.shift();
    }

    // 计算高级指标
    this.calculateAdvancedMetrics();

    // 检查警报
    if (this.config.enableAlerts) {
      this.checkAlerts();
    }
  }

  /**
   * 计算高级指标
   */
  private calculateAdvancedMetrics(): void {
    // 计算 95 分位执行时间
    if (this.executionHistory.length > 0) {
      const times = this.executionHistory.map(h => h.time).sort((a, b) => a - b);
      const p95Index = Math.floor(times.length * 0.95);
      this.metrics.p95ExecutionTime = times[p95Index] || 0;

      // 计算回撤
      let peak = 0;
      let maxDrawdown = 0;
      let cumulativeProfit = 0;

      for (const record of this.executionHistory) {
        cumulativeProfit += record.profit;
        if (cumulativeProfit > peak) {
          peak = cumulativeProfit;
        }
        const drawdown = peak - cumulativeProfit;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      this.metrics.maxDrawdown = maxDrawdown;
      this.metrics.currentDrawdown = peak - cumulativeProfit;

      // 计算 VaR (95%)
      const profits = this.executionHistory.map(h => h.profit).sort((a, b) => a - b);
      const varIndex = Math.floor(profits.length * 0.05);
      this.metrics.var95 = Math.abs(profits[varIndex] || 0);

      // 滑点分布
      const slippages = this.executionHistory.map(h => h.slippage);
      this.metrics.slippageDistribution = [
        { range: '0-0.2%', count: slippages.filter(s => s < 0.002).length },
        { range: '0.2-0.5%', count: slippages.filter(s => s >= 0.002 && s < 0.005).length },
        { range: '0.5-1%', count: slippages.filter(s => s >= 0.005 && s < 0.01).length },
        { range: '>1%', count: slippages.filter(s => s >= 0.01).length },
      ];
    }
  }

  /**
   * 记录机会
   */
  recordOpportunity(opportunity: ArbitrageOpportunity): void {
    this.opportunities.push(opportunity);

    // 限制机会历史
    if (this.opportunities.length > 1000) {
      this.opportunities.shift();
    }

    // 更新市场指标
    if (opportunity.yesAsk && opportunity.yesBid) {
      const spread = (opportunity.yesAsk - opportunity.yesBid) / opportunity.yesBid;
      this.metrics.avgSpread =
        (this.metrics.avgSpread * (this.opportunities.length - 1) + spread) /
        this.opportunities.length;
    }

    if (opportunity.depthShares) {
      this.metrics.avgLiquidity =
        (this.metrics.avgLiquidity * (this.opportunities.length - 1) + opportunity.depthShares) /
        this.opportunities.length;
    }
  }

  /**
   * 更新实时数据
   */
  updateRealTimeData(data: Partial<RealTimeData>): void {
    const realTimeData: RealTimeData = {
      timestamp: Date.now(),
      profit: data.profit || 0,
      positions: data.positions || 0,
      executionTime: data.executionTime || 0,
      slippage: data.slippage || 0,
    };

    this.history.push(realTimeData);

    // 限制历史大小
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }

    // 更新实时指标
    this.metrics.activePositions = data.positions || 0;
  }

  /**
   * 获取指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取机会统计
   */
  getOpportunityStats(): OpportunityStats {
    const byType: Record<string, number> = {};
    const byMarket: Record<string, number> = {};
    const avgProfitByType: Record<string, number> = {};
    const marketProfits: Record<string, { count: number; profit: number }> = {};

    for (const opp of this.opportunities) {
      // 按类型统计
      byType[opp.type] = (byType[opp.type] || 0) + 1;

      // 按市场统计
      byMarket[opp.marketId] = (byMarket[opp.marketId] || 0) + 1;

      // 按类型平均利润
      const profit = opp.expectedReturn || opp.arbitrageProfit || 0;
      if (!avgProfitByType[opp.type]) {
        avgProfitByType[opp.type] = 0;
      }
      avgProfitByType[opp.type] += profit;

      // 市场利润
      if (!marketProfits[opp.marketId]) {
        marketProfits[opp.marketId] = { count: 0, profit: 0 };
      }
      marketProfits[opp.marketId].count++;
      marketProfits[opp.marketId].profit += profit;
    }

    // 计算平均利润
    for (const type in byType) {
      avgProfitByType[type] /= byType[type];
    }

    // 排序顶级市场
    const topMarkets = Object.entries(marketProfits)
      .map(([marketId, data]) => ({
        marketId,
        count: data.count,
        profit: data.profit,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    return {
      byType,
      byMarket,
      avgProfitByType,
      topMarkets,
    };
  }

  /**
   * 获取历史数据
   */
  getHistory(limit?: number): RealTimeData[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * 打印仪表板
   */
  printDashboard(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 套利性能仪表板');
    console.log('='.repeat(60));

    // 执行指标
    console.log('\n📈 执行指标:');
    console.log(`   总执行: ${this.metrics.totalExecutions}`);
    console.log(`   成功: ${this.metrics.successfulExecutions} (${(this.metrics.successRate * 100).toFixed(1)}%)`);
    console.log(`   失败: ${this.metrics.failedExecutions}`);

    // 利润指标
    console.log('\n💰 利润指标:');
    console.log(`   总利润: $${this.metrics.totalProfit.toFixed(2)}`);
    console.log(`   总损失: $${this.metrics.totalLoss.toFixed(2)}`);
    console.log(`   净利润: $${this.metrics.netProfit.toFixed(2)}`);
    console.log(`   平均利润: $${this.metrics.avgProfitPerTrade.toFixed(2)}`);
    console.log(`   利润因子: ${this.metrics.profitFactor.toFixed(2)}`);

    // 时间指标
    console.log('\n⏱️  时间指标:');
    console.log(`   平均执行时间: ${this.metrics.avgExecutionTime.toFixed(0)}ms`);
    console.log(`   最小执行时间: ${this.metrics.minExecutionTime.toFixed(0)}ms`);
    console.log(`   最大执行时间: ${this.metrics.maxExecutionTime.toFixed(0)}ms`);
    console.log(`   95分位时间: ${this.metrics.p95ExecutionTime.toFixed(0)}ms`);

    // 滑点指标
    console.log('\n📉 滑点指标:');
    console.log(`   平均滑点: ${(this.metrics.avgSlippage * 100).toFixed(3)}%`);
    console.log(`   最大滑点: ${(this.metrics.maxSlippage * 100).toFixed(3)}%`);
    console.log('\n   滑点分布:');
    for (const bucket of this.metrics.slippageDistribution) {
      console.log(`     ${bucket.range}: ${bucket.count}`);
    }

    // 风险指标
    console.log('\n⚠️  风险指标:');
    console.log(`   最大回撤: $${this.metrics.maxDrawdown.toFixed(2)}`);
    console.log(`   当前回撤: $${this.metrics.currentDrawdown.toFixed(2)}`);
    console.log(`   VaR (95%): $${this.metrics.var95.toFixed(2)}`);

    // 市场指标
    console.log('\n📊 市场指标:');
    console.log(`   平均价差: ${(this.metrics.avgSpread * 100).toFixed(3)}%`);
    console.log(`   平均流动性: ${this.metrics.avgLiquidity.toFixed(0)} 股`);

    // 实时指标
    console.log('\n🔴 实时指标:');
    console.log(`   活跃仓位: ${this.metrics.activePositions}`);
    console.log(`   排队交易: ${this.metrics.queuedTrades}`);
    console.log(`   待处理订单: ${this.metrics.pendingOrders}`);

    // 机会统计
    const oppStats = this.getOpportunityStats();
    console.log('\n🎯 机会统计:');
    console.log('   按类型:');
    for (const [type, count] of Object.entries(oppStats.byType)) {
      const avgProfit = oppStats.avgProfitByType[type];
      console.log(`     ${type}: ${count} (平均利润: ${(avgProfit * 100).toFixed(2)}%)`);
    }

    console.log('\n   顶级市场:');
    for (const market of oppStats.topMarkets.slice(0, 5)) {
      console.log(`     ${market.marketId}: ${market.count} 次 (利润: $${market.profit.toFixed(2)})`);
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * 检查警报
   */
  private checkAlerts(): void {
    // 低成功率警报
    if (this.metrics.successRate < this.config.alertThresholds.lowSuccessRate) {
      this.triggerAlert('LOW_SUCCESS_RATE', {
        current: this.metrics.successRate,
        threshold: this.config.alertThresholds.lowSuccessRate,
      });
    }

    // 高滑点警报
    if (this.metrics.avgSlippage > this.config.alertThresholds.highSlippage) {
      this.triggerAlert('HIGH_SLIPPAGE', {
        current: this.metrics.avgSlippage,
        threshold: this.config.alertThresholds.highSlippage,
      });
    }

    // 高回撤警报
    if (this.metrics.currentDrawdown > this.config.alertThresholds.highDrawdown) {
      this.triggerAlert('HIGH_DRAWDOWN', {
        current: this.metrics.currentDrawdown,
        threshold: this.config.alertThresholds.highDrawdown,
      });
    }
  }

  /**
   * 触发警报
   */
  private triggerAlert(type: string, data: any): void {
    console.log(`\n🚨 警报 [${type}]:`, data);

    const callback = this.alertCallbacks.get(type);
    if (callback) {
      callback(data);
    }
  }

  /**
   * 注册警报回调
   */
  onAlert(type: string, callback: (data: any) => void): void {
    this.alertCallbacks.set(type, callback);
  }

  /**
   * 启动自动更新
   */
  private startAutoUpdate(): void {
    setInterval(() => {
      if (this.metrics.totalExecutions > 0) {
        this.printDashboard();
      }
    }, this.config.updateInterval);
  }

  /**
   * 导出数据
   */
  exportData(): string {
    return JSON.stringify({
      metrics: this.metrics,
      history: this.history,
      executionHistory: this.executionHistory,
      opportunities: this.opportunities,
    }, null, 2);
  }

  /**
   * 重置数据
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.history = [];
    this.executionHistory = [];
    this.opportunities = [];
  }
}

/**
 * 单例仪表板
 */
let globalDashboard: PerformanceDashboard | null = null;

export function getPerformanceDashboard(config?: Partial<DashboardConfig>): PerformanceDashboard {
  if (!globalDashboard) {
    globalDashboard = new PerformanceDashboard(config);
  }

  return globalDashboard;
}
