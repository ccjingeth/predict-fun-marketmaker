/**
 * Advanced Analytics Tools
 * 高级分析工具 - 回测、模拟和性能分析
 */

import type { ArbitrageOpportunity } from './types.js';

/**
 * 回测结果
 */
export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  avgDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  equity: number[];
  trades: BacktestTrade[];
}

/**
 * 回测交易
 */
export interface BacktestTrade {
  timestamp: number;
  marketId: string;
  type: string;
  entryPrice: number;
  exitPrice: number;
  size: number;
  profit: number;
  holdTime: number;
  slippage: number;
  fees: number;
}

/**
 * 模拟配置
 */
export interface SimulationConfig {
  initialCapital: number;
  commissionRate: number;
  slippageModel: 'fixed' | 'percentage' | 'dynamic';
  baseSlippage: number;
  enableMarketImpact: boolean;
  marketImpactFactor: number;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  return: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  avgHoldTime: number;
  expectency: number;
}

/**
 * 回测引擎
 */
export class BacktestEngine {
  private config: SimulationConfig;

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = {
      initialCapital: 10000,
      commissionRate: 0.002, // 0.2%
      slippageModel: 'percentage',
      baseSlippage: 0.001, // 0.1%
      enableMarketImpact: true,
      marketImpactFactor: 0.0001,
      ...config,
    };
  }

  /**
   * 运行回测
   */
  async runBacktest(
    opportunities: ArbitrageOpportunity[],
    executeFn: (opp: ArbitrageOpportunity) => Promise<{
      success: boolean;
      entryPrice: number;
      exitPrice: number;
      actualSlippage: number;
    }>
  ): Promise<BacktestResult> {
    const trades: BacktestTrade[] = [];
    const equity: number[] = [this.config.initialCapital];
    let currentCapital = this.config.initialCapital;

    console.log(`\n🔬 开始回测`);
    console.log(`   初始资金: $${this.config.initialCapital}`);
    console.log(`   机会数量: ${opportunities.length}`);

    for (const opp of opportunities) {
      // 执行交易
      const result = await executeFn(opp);

      if (!result.success) {
        continue;
      }

      // 计算利润
      const size = opp.positionSize || 100;
      const entryPrice = result.entryPrice;
      const exitPrice = result.exitPrice;
      const grossProfit = (exitPrice - entryPrice) * size;

      // 计算费用
      const commission = size * (entryPrice + exitPrice) * this.config.commissionRate;
      const slippageCost = size * (entryPrice + exitPrice) * result.actualSlippage;
      const fees = commission + slippageCost;

      // 净利润
      const netProfit = grossProfit - fees;

      // 更新资金
      currentCapital += netProfit;
      equity.push(currentCapital);

      // 记录交易
      trades.push({
        timestamp: opp.timestamp,
        marketId: opp.marketId,
        type: opp.type,
        entryPrice,
        exitPrice,
        size,
        profit: netProfit,
        holdTime: 60000, // 假设 1 分钟
        slippage: result.actualSlippage,
        fees,
      });

      // 检查破产
      if (currentCapital <= 0) {
        console.log(`\n❌ 资金归零，停止回测`);
        break;
      }
    }

    // 计算统计
    const stats = this.calculateStats(trades, equity);

    console.log(`\n✅ 回测完成`);
    console.log(`   总交易: ${stats.totalTrades}`);
    console.log(`   胜率: ${(stats.winRate * 100).toFixed(1)}%`);
    console.log(`   净利润: $${stats.netProfit.toFixed(2)}`);
    console.log(`   最大回撤: ${(stats.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`   夏普比率: ${stats.sharpeRatio.toFixed(2)}`);

    return stats;
  }

  /**
   * 计算统计指标
   */
  private calculateStats(trades: BacktestTrade[], equity: number[]): BacktestResult {
    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const netProfit = totalProfit - totalLoss;
    const avgProfit = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;

    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    // 计算最大回撤
    let maxDrawdown = 0;
    let peak = equity[0];
    for (const value of equity) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // 计算夏普比率
    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

    // 计算 Sortino 比率
    const downsideReturns = returns.filter(r => r < 0);
    const downsideVariance =
      downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);
    const sortinoRatio = downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;

    // 计算 Calmar 比率
    const annualReturn = (equity[equity.length - 1] - equity[0]) / equity[0];
    const calmarRatio = maxDrawdown > 0 ? annualReturn / maxDrawdown : 0;

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalProfit,
      totalLoss,
      netProfit,
      avgProfit,
      avgLoss,
      profitFactor,
      maxDrawdown,
      avgDrawdown: 0, // TODO
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      equity,
      trades,
    };
  }

  /**
   * 蒙特卡洛模拟
   */
  async monteCarloSimulation(
    opportunities: ArbitrageOpportunity[],
    numSimulations: number = 1000
  ): Promise<{
    avgProfit: number;
    medianProfit: number;
    percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
    probabilityOfProfit: number;
  }> {
    const profits: number[] = [];

    console.log(`\n🎲 蒙特卡洛模拟 (${numSimulations} 次)`);

    for (let i = 0; i < numSimulations; i++) {
      // 随机打乱机会顺序
      const shuffled = [...opportunities].sort(() => Math.random() - 0.5);

      // 选择子集
      const sampleSize = Math.floor(Math.random() * shuffled.length) + 1;
      const sample = shuffled.slice(0, sampleSize);

      // 计算利润
      const profit = sample.reduce((sum, opp) => {
        const expectedProfit = opp.expectedReturn || opp.arbitrageProfit || 0;
        // 添加随机性
        const randomFactor = 0.8 + Math.random() * 0.4; // 80-120%
        return sum + expectedProfit * randomFactor;
      }, 0);

      profits.push(profit);
    }

    // 计算统计
    profits.sort((a, b) => a - b);

    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
    const medianProfit = profits[Math.floor(profits.length / 2)];
    const probabilityOfProfit = profits.filter(p => p > 0).length / profits.length;

    const percentiles = {
      p5: profits[Math.floor(profits.length * 0.05)],
      p25: profits[Math.floor(profits.length * 0.25)],
      p50: profits[Math.floor(profits.length * 0.50)],
      p75: profits[Math.floor(profits.length * 0.75)],
      p95: profits[Math.floor(profits.length * 0.95)],
    };

    console.log(`\n📊 模拟结果:`);
    console.log(`   平均利润: $${avgProfit.toFixed(2)}`);
    console.log(`   中位数利润: $${medianProfit.toFixed(2)}`);
    console.log(`   盈利概率: ${(probabilityOfProfit * 100).toFixed(1)}%`);
    console.log(`   95% 置信区间: [$${percentiles.p5.toFixed(2)}, $${percentiles.p95.toFixed(2)}]`);

    return {
      avgProfit,
      medianProfit,
      percentiles,
      probabilityOfProfit,
    };
  }
}

/**
 * 性能分析器
 */
export class PerformanceAnalyzer {
  /**
   * 分析性能指标
   */
  static analyze(trades: BacktestTrade[]): PerformanceMetrics {
    if (trades.length === 0) {
      return {
        return: 0,
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0,
        avgHoldTime: 0,
        expectency: 0,
      };
    }

    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);

    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));

    const winRate = winningTrades.length / trades.length;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    const avgHoldTime = trades.reduce((sum, t) => sum + t.holdTime, 0) / trades.length;

    // 期望值
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length
      : 0;
    const avgLossVal = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length
      : 0;
    const expectency = (winRate * avgWin) + ((1 - winRate) * avgLossVal);

    // 计算收益和波动率
    const returns = trades.map(t => t.profit / 100); // 假设每笔 100
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

    // 最大回撤
    let maxDrawdown = 0;
    let peak = 0;
    let cumulative = 0;
    for (const trade of trades) {
      cumulative += trade.profit;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / (peak || 1);
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      return: totalProfit,
      volatility,
      sharpeRatio,
      maxDrawdown,
      winRate,
      profitFactor,
      avgHoldTime,
      expectency,
    };
  }

  /**
   * 打印性能报告
   */
  static printReport(metrics: PerformanceMetrics): void {
    console.log('\n' + '='.repeat(60));
    console.log('📈 性能分析报告');
    console.log('='.repeat(60));

    console.log('\n收益指标:');
    console.log(`   总收益: $${metrics.return.toFixed(2)}`);
    console.log(`   波动率: ${(metrics.volatility * 100).toFixed(2)}%`);
    console.log(`   夏普比率: ${metrics.sharpeRatio.toFixed(2)}`);

    console.log('\n风险指标:');
    console.log(`   最大回撤: ${(metrics.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`   胜率: ${(metrics.winRate * 100).toFixed(1)}%`);
    console.log(`   利润因子: ${metrics.profitFactor.toFixed(2)}`);

    console.log('\n交易指标:');
    console.log(`   平均持仓时间: ${(metrics.avgHoldTime / 1000).toFixed(1)}秒`);
    console.log(`   期望值: $${metrics.expectency.toFixed(2)}`);

    console.log('\n' + '='.repeat(60));
  }

  /**
   * 对比两个策略
   */
  static compare(metricsA: PerformanceMetrics, metricsB: PerformanceMetrics, nameA: string = '策略A', nameB: string = '策略B'): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 策略对比');
    console.log('='.repeat(60));

    console.log(`\n${'指标'.padEnd(20)} ${nameA.padEnd(15)} ${nameB.padEnd(15)} 差异`);
    console.log('-'.repeat(60));

    const printRow = (label: string, valA: number, valB: number, format: (v: number) => string = v => v.toFixed(2)) => {
      const diff = valB - valA;
      const diffStr = diff > 0 ? `+${format(diff)}` : format(diff);
      console.log(`${label.padEnd(20)} ${format(valA).padEnd(15)} ${format(valB).padEnd(15)} ${diffStr}`);
    };

    printRow('总收益', metricsA.return, metricsB.return);
    printRow('夏普比率', metricsA.sharpeRatio, metricsB.sharpeRatio);
    printRow('最大回撤 (%)', metricsA.maxDrawdown * 100, metricsB.maxDrawdown * 100);
    printRow('胜率 (%)', metricsA.winRate * 100, metricsB.winRate * 100);
    printRow('利润因子', metricsA.profitFactor, metricsB.profitFactor);
    printRow('期望值', metricsA.expectency, metricsB.expectency);

    console.log('\n' + '='.repeat(60));
  }
}

/**
 * 风险分析器
 */
export class RiskAnalyzer {
  /**
   * 计算 VaR (Value at Risk)
   */
  static calculateVaR(
    trades: BacktestTrade[],
    confidence: number = 0.95
  ): number {
    const profits = trades.map(t => t.profit).sort((a, b) => a - b);
    const index = Math.floor(profits.length * (1 - confidence));
    return Math.abs(profits[index] || 0);
  }

  /**
   * 计算 CVaR (Conditional VaR)
   */
  static calculateCVaR(
    trades: BacktestTrade[],
    confidence: number = 0.95
  ): number {
    const profits = trades.map(t => t.profit).sort((a, b) => a - b);
    const index = Math.floor(profits.length * (1 - confidence));
    const tailLosses = profits.slice(0, index);
    return tailLosses.length > 0
      ? Math.abs(tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length)
      : 0;
  }

  /**
   * 计算凯利公式
   */
  static calculateKelly(metrics: PerformanceMetrics): number {
    const winRate = metrics.winRate;
    const avgWin = metrics.avgHoldTime > 0 ? metrics.return / metrics.avgHoldTime : 0;
    const avgLoss = avgWin > 0 ? avgWin / metrics.profitFactor : 0;

    if (avgLoss === 0) return 0;

    const kelly = (winRate * avgWin - (1 - winRate) * avgLoss) / avgLoss;
    return Math.max(0, kelly); // 不超过 100%
  }

  /**
   * 风险评分
   */
  static riskScore(metrics: PerformanceMetrics): number {
    let score = 50; // 基础分

    // 夏普比率
    if (metrics.sharpeRatio > 2) score += 20;
    else if (metrics.sharpeRatio > 1) score += 10;
    else if (metrics.sharpeRatio < 0.5) score -= 20;

    // 最大回撤
    if (metrics.maxDrawdown < 0.05) score += 15;
    else if (metrics.maxDrawdown < 0.1) score += 5;
    else if (metrics.maxDrawdown > 0.3) score -= 30;

    // 胜率
    if (metrics.winRate > 0.7) score += 15;
    else if (metrics.winRate > 0.5) score += 5;
    else if (metrics.winRate < 0.4) score -= 20;

    // 利润因子
    if (metrics.profitFactor > 2) score += 10;
    else if (metrics.profitFactor > 1.5) score += 5;
    else if (metrics.profitFactor < 1) score -= 15;

    return Math.max(0, Math.min(100, score));
  }
}
