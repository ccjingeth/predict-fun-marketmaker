/**
 * 🚀 高级套利系统 - 基于真实市场策略优化
 *
 * 核心策略（基于2025年实际成功案例）：
 * 1. Mean Reversion（均值回归）- Vitalik Buterin的策略（16%回报）
 * 2. Cross-Platform Arbitrage（跨平台套利）
 * 3. Multi-Result Arbitrage（多结果套利）
 * 4. Social Alpha（跟踪大户行为）
 *
 * 参考资料：
 * - Prediction market交易量2025年超过440亿美元
 * - 高频机器人主导Yes+No<1套利
 * - 专业交易者通过26,756笔交易赚取$448K
 */

import { PredictAPI } from './api/client.js';
import { ActivationManager } from './activation.js';

interface MarketOpportunity {
  marketId: string;
  marketTitle: string;
  type: 'mean_reversion' | 'cross_platform' | 'multi_result' | 'yes_no_under';
  confidence: number;
  expectedProfit: number;
  risk: 'low' | 'medium' | 'high';
  reasoning: string;
  action: 'buy_yes' | 'buy_no' | 'buy_both' | 'skip';
  yesPrice?: number;
  noPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
}

interface MeanReversionConfig {
  enableMeanReversion: boolean;
  extremeThreshold: number; // 极端概率阈值（默认15%）
  maxPositionSize: number;  // 最大仓位
  sectors: string[];        // 关注的行业
}

interface SocialAlphaConfig {
  trackWhales: boolean;
  minWhaleSize: number;     // 最小大户交易额（$）
  followThreshold: number;  // 跟随阈值
}

export class AdvancedArbitrageBot {
  private api: PredictAPI;
  private config: {
    meanReversion: MeanReversionConfig;
    socialAlpha: SocialAlphaConfig;
    riskManagement: {
      maxDailyTrades: number;
      maxDrawdown: number;
      minProfitThreshold: number;
    };
  };

  constructor(api: PredictAPI) {
    this.api = api;

    // 默认配置（基于成功案例优化）
    this.config = {
      meanReversion: {
        enableMeanReversion: true,
        extremeThreshold: 0.15, // 15% - Vitalik使用的阈值
        maxPositionSize: 1000,  // $1000 max
        sectors: ['politics', 'tech', 'science'] // 避开crypto和sports
      },
      socialAlpha: {
        trackWhales: true,
        minWhaleSize: 10000,   // $10K
        followThreshold: 0.7   // 70% confidence
      },
      riskManagement: {
        maxDailyTrades: 50,
        maxDrawdown: 0.20,     // 20% max drawdown
        minProfitThreshold: 0.05 // 5% minimum profit
      }
    };
  }

  /**
   * 🎯 策略1：Mean Reversion（均值回归）
   *
   * Vitalik Buterin的成功策略：
   * - 投资回报：16%（$70K profit on $440K investment）
   * - 70%的交易赌"不会发生"
   * - 在极端概率时下注
   *
   * 示例：
   * - Trump Nobel Peace Prize @ 15% → Bet NO → Won
   * - US announcing aliens @ 10% → Bet NO → Won
   */
  private async scanMeanReversion(): Promise<MarketOpportunity[]> {
    const opportunities: MarketOpportunity[] = [];

    try {
      const markets = await this.api.getMarkets();

      for (const market of markets) {
        // 跳过加密货币和体育市场（Vitalik避免的领域）
        if (this.isExcludedSector(market)) {
          continue;
        }

        const outcomePrices = await this.api.getOutcomePrices(market.marketId);

        for (const [outcome, price] of Object.entries(outcomePrices)) {
          const probability = price;

          // 检查是否是极端概率
          if (probability <= this.config.meanReversion.extremeThreshold ||
              probability >= (1 - this.config.meanReversion.extremeThreshold)) {

            // 分析是否是"疯狂模式"（媒体炒作、情绪驱动）
            const isCrazyMode = await this.detectCrazyMode(market);

            if (isCrazyMode) {
              const isLowProb = probability <= this.config.meanReversion.extremeThreshold;

              opportunities.push({
                marketId: market.marketId,
                marketTitle: market.question,
                type: 'mean_reversion',
                confidence: 0.75, // 基于Vitalik的成功率
                expectedProfit: (1 - probability) * 0.8, // 预期利润
                risk: 'medium',
                reasoning: `极端概率${(probability * 100).toFixed(1)}%，检测到"疯狂模式"，均值回归策略`,
                action: isLowProb ? 'buy_no' : 'buy_yes',
                yesPrice: isLowProb ? probability : (1 - probability),
                noPrice: isLowProb ? (1 - probability) : probability,
                targetPrice: isLowProb ? 0.02 : 0.98,
                stopLoss: isLowProb ? probability * 1.5 : (1 - probability) * 1.5
              });
            }
          }
        }
      }

    } catch (error) {
      console.error('Mean Reversion scan failed:', error);
    }

    return opportunities;
  }

  /**
   * 🎯 策略2：Cross-Platform Arbitrage（跨平台套利）
   *
   * 最常见且有效的套利方式：
   * - 同一事件在不同平台价格不同
   * - 锁定无风险收益
   *
   * 示例：
   * - Platform A: Yes @ 40%
   * - Platform B: Yes @ 43%
   * - Arbitrage: 3% risk-free
   */
  private async scanCrossPlatform(): Promise<MarketOpportunity[]> {
    const opportunities: MarketOpportunity[] = [];

    // TODO: 实现跨平台扫描
    // 需要接入：Polymarket, Kalshi, Limitless等平台API

    console.log('🔄 Cross-platform arbitrage: 需要接入多平台API');

    return opportunities;
  }

  /**
   * 🎯 策略3：Multi-Result Arbitrage（多结果套利）
   *
   * 更容易有定价错误：
   * - F1比赛、选举、真人秀
   * - 理论总和应为100%，但经常超过110%
   * - 复杂度越高 = 定价错误越多
   */
  private async scanMultiResult(): Promise<MarketOpportunity[]> {
    const opportunities: MarketOpportunity[] = [];

    try {
      const markets = await this.api.getMarkets();
      const multiResultMarkets = markets.filter(m =>
        m.outcomes && m.outcomes.length > 2
      );

      for (const market of multiResultMarkets) {
        const outcomePrices = await this.api.getOutcomePrices(market.marketId);
        const totalProbability = Object.values(outcomePrices)
          .reduce((sum, price) => sum + price, 0);

        // 检查总概率是否显著偏离100%
        if (totalProbability > 1.05 || totalProbability < 0.95) {
          // 找到定价最低的结果
          const sortedOutcomes = Object.entries(outcomePrices)
            .sort(([, a], [, b]) => a - b);

          const cheapestOutcome = sortedOutcomes[0];
          const profitMargin = Math.abs(1 - totalProbability);

          opportunities.push({
            marketId: market.marketId,
            marketTitle: market.question,
            type: 'multi_result',
            confidence: 0.60,
            expectedProfit: profitMargin,
            risk: 'low',
            reasoning: `多结果市场，总概率=${(totalProbability * 100).toFixed(1)}%，定价错误`,
            action: 'buy_both', // 买入所有低价结果
            yesPrice: cheapestOutcome[1]
          });
        }
      }

    } catch (error) {
      console.error('Multi-result scan failed:', error);
    }

    return opportunities;
  }

  /**
   * 🎯 策略4：Yes+No<1 Arbitrage（经典套利）
   *
   * 注意：此策略被高频机器人主导
   * - 机会极短暂
   * - 需要极快执行速度
   * - 零售交易者很难获利
   *
   * 建议：仅在手动执行时使用
   */
  private async scanYesNoUnderOne(): Promise<MarketOpportunity[]> {
    const opportunities: MarketOpportunity[] = [];

    try {
      const markets = await this.api.getMarkets();

      for (const market of markets) {
        if (market.outcomes && market.outcomes.length === 2) {
          const prices = await this.api.getOutcomePrices(market.marketId);
          const [yesPrice, noPrice] = Object.values(prices);
          const totalCost = yesPrice + noPrice;

          // Yes + No < 1
          if (totalCost < 1) {
            const profit = 1 - totalCost;

            // 只在利润>=3%时提示（否则手续费会吃掉利润）
            if (profit >= 0.03) {
              opportunities.push({
                marketId: market.marketId,
                marketTitle: market.question,
                type: 'yes_no_under',
                confidence: 1.0, // 无风险
                expectedProfit: profit,
                risk: 'low',
                reasoning: `Yes+No=${(totalCost * 100).toFixed(1)}¢，无风险套利`,
                action: 'buy_both',
                yesPrice,
                noPrice
              });
            }
          }
        }
      }

    } catch (error) {
      console.error('Yes/No scan failed:', error);
    }

    return opportunities;
  }

  /**
   * 🔍 检测"疯狂模式"（Crazy Mode Detection）
   *
   * 检查市场是否处于情绪驱动的极端状态
   */
  private async detectCrazyMode(market: any): Promise<boolean> {
    // 检测指标：
    // 1. 价格剧烈波动
    // 2. 交易量异常增加
    // 3. 社交媒体讨论激增
    // 4. 新闻事件

    // TODO: 实现更复杂的检测逻辑
    const volatility = await this.calculateVolatility(market);
    const volume = await this.getRecentVolume(market);

    // 简单检测：波动率>50% 或 交易量突然增加>3倍
    return volatility > 0.5 || volume > 3;
  }

  /**
   * 📊 计算波动率
   */
  private async calculateVolatility(market: any): Promise<number> {
    // TODO: 实现波动率计算
    return 0.3; // 临时返回30%
  }

  /**
   * 📊 获取最近交易量
   */
  private async getRecentVolume(market: any): Promise<number> {
    // TODO: 实现交易量获取
    return 1; // 返回倍数
  }

  /**
   * ✅ 检查是否排除该行业
   */
  private isExcludedSector(market: any): boolean {
    const excludedTags = ['crypto', 'sports', 'bitcoin', 'eth'];
    const marketTags = market.tags || [];
    const marketTitle = market.question?.toLowerCase() || '';

    return excludedTags.some(tag =>
      marketTags.includes(tag) || marketTitle.includes(tag)
    );
  }

  /**
   * 🚀 主扫描循环
   */
  async scanOpportunities(): Promise<MarketOpportunity[]> {
    console.log('\n🚀 开始扫描套利机会...');
    console.log('='.repeat(70));

    const allOpportunities: MarketOpportunity[] = [];

    // 策略1：Mean Reversion（Vitalik策略 - 16%回报）
    if (this.config.meanReversion.enableMeanReversion) {
      console.log('\n📈 扫描 Mean Reversion 机会（Vitalik策略）...');
      const meanReversionOps = await this.scanMeanReversion();
      allOpportunities.push(...meanReversionOps);
      console.log(`✅ 找到 ${meanReversionOps.length} 个机会`);
    }

    // 策略2：Cross-Platform（需要多平台API）
    console.log('\n🌐 扫描跨平台套利机会...');
    const crossPlatformOps = await this.scanCrossPlatform();
    allOpportunities.push(...crossPlatformOps);

    // 策略3：Multi-Result（更容易有定价错误）
    console.log('\n🎯 扫描多结果市场机会...');
    const multiResultOps = await this.scanMultiResult();
    allOpportunities.push(...multiResultOps);
    console.log(`✅ 找到 ${multiResultOps.length} 个机会`);

    // 策略4：Yes+No<1（被高频机器人主导）
    console.log('\n💰 扫描 Yes+No<1 套利机会...');
    const yesNoOps = await this.scanYesNoUnderOne();
    allOpportunities.push(...yesNoOps);
    console.log(`✅ 找到 ${yesNoOps.length} 个机会（注意：竞争激烈）`);

    // 按预期利润排序
    allOpportunities.sort((a, b) => b.expectedProfit - a.expectedProfit);

    // 过滤低利润机会
    const filtered = allOpportunities.filter(op =>
      op.expectedProfit >= this.config.riskManagement.minProfitThreshold
    );

    console.log('\n' + '='.repeat(70));
    console.log(`📊 扫描完成：找到 ${filtered.length} 个符合条件的机会`);

    return filtered;
  }

  /**
   * 📝 格式化输出机会
   */
  formatOpportunities(opportunities: MarketOpportunity[]): string {
    let output = '\n';

    opportunities.forEach((op, index) => {
      output += `\n${index + 1}. ${op.marketTitle}\n`;
      output += `   类型: ${this.formatType(op.type)}\n`;
      output += `   风险: ${this.formatRisk(op.risk)}\n`;
      output += `   置信度: ${(op.confidence * 100).toFixed(0)}%\n`;
      output += `   预期利润: ${(op.expectedProfit * 100).toFixed(1)}%\n`;
      output += `   建议: ${this.formatAction(op.action)}\n`;
      output += `   理由: ${op.reasoning}\n`;

      if (op.yesPrice !== undefined) {
        output += `   Yes价格: ${(op.yesPrice * 100).toFixed(1)}¢\n`;
      }
      if (op.noPrice !== undefined) {
        output += `   No价格: ${(op.noPrice * 100).toFixed(1)}¢\n`;
      }
    });

    return output;
  }

  private formatType(type: string): string {
    const map = {
      'mean_reversion': '📈 Mean Reversion（均值回归）',
      'cross_platform': '🌐 Cross-Platform（跨平台）',
      'multi_result': '🎯 Multi-Result（多结果）',
      'yes_no_under': '💰 Yes+No<1（经典套利）'
    };
    return map[type] || type;
  }

  private formatRisk(risk: string): string {
    const map = {
      'low': '🟢 低',
      'medium': '🟡 中',
      'high': '🔴 高'
    };
    return map[risk] || risk;
  }

  private formatAction(action: string): string {
    const map = {
      'buy_yes': '买入 YES',
      'buy_no': '买入 NO',
      'buy_both': '同时买入 YES 和 NO',
      'skip': '跳过'
    };
    return map[action] || action;
  }

  /**
   * ⚙️ 更新配置
   */
  updateConfig(config: Partial<typeof this.config>) {
    this.config = { ...this.config, ...config };
  }
}

/**
 * 📚 参考资料
 *
 * 1. Vitalik Buterin的Mean Reversion策略：
 *    - 16%回报率（$70K profit on $440K）
 *    - 来源：[Polymarket trading reports]
 *
 * 2. 高频交易者案例：
 *    - 26,756笔交易赚取$448K
 *    - 平均每笔$17利润
 *    - 来源：[Market maker reports]
 *
 * 3. Yes+No<1套利：
 *    - 被高频机器人主导
 *    - 零售交易者很难获利
 *    - 来源：[Prediction market research]
 *
 * 4. Cross-platform arbitrage：
 *    - 最常见且有效的套利
 *    - 5%差异复利20次=2.65倍
 *    - 10%差异复利20次=6.7倍
 *    - 来源：[Arbitrage tool analysis]
 */
