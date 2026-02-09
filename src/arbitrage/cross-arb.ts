/**
 * Cross-Platform Arbitrage Detector
 * 跨平台套利检测器 - 检测不同平台间的价差套利机会
 */

import type { ArbitrageOpportunity, CrossPlatformArbitrage } from './types.js';
import type { PlatformMarket } from '../external/types.js';
import type { CrossPlatformMappingStore } from '../external/mapping.js';

export class CrossPlatformArbitrageDetector {
  private platforms: string[];
  private minProfitThreshold: number;
  private estimatedTransferCost: number;
  private minSimilarity: number;
  private allowSellBoth: boolean;

  constructor(
    platforms: string[] = ['Predict', 'Polymarket', 'Opinion'],
    minProfitThreshold: number = 0.02,
    estimatedTransferCost: number = 0.005,
    minSimilarity: number = 0.78,
    allowSellBoth: boolean = false
  ) {
    this.platforms = platforms;
    this.minProfitThreshold = minProfitThreshold;
    this.estimatedTransferCost = estimatedTransferCost;
    this.minSimilarity = minSimilarity;
    this.allowSellBoth = allowSellBoth;
  }

  /**
   * 检测跨平台套利机会
   */
  detectArbitrage(marketA: PlatformMarket, marketB: PlatformMarket): CrossPlatformArbitrage | null {
    const similarity = this.calculateSimilarity(marketA.question, marketB.question);

    if (similarity < this.minSimilarity) {
      return null;
    }

    const yesAskA = marketA.yesAsk;
    const yesAskB = marketB.yesAsk;
    const noAskA = marketA.noAsk;
    const noAskB = marketB.noAsk;
    const yesBidA = marketA.yesBid;
    const yesBidB = marketB.yesBid;
    const noBidA = marketA.noBid;
    const noBidB = marketB.noBid;

    if (!yesAskA || !yesAskB || !noAskA || !noAskB || !yesBidA || !yesBidB || !noBidA || !noBidB) {
      return null;
    }

    const feeA = (marketA.feeBps || 0) / 10000;
    const feeB = (marketB.feeBps || 0) / 10000;

    const buyCostAB = yesAskA + noAskB;
    const buyCostBA = yesAskB + noAskA;
    const buyNetAB = 1 - buyCostAB - yesAskA * feeA - noAskB * feeB - this.estimatedTransferCost;
    const buyNetBA = 1 - buyCostBA - yesAskB * feeB - noAskA * feeA - this.estimatedTransferCost;

    let action: 'BUY_BOTH' | 'SELL_BOTH' = 'BUY_BOTH';
    let minCost = 0;
    let profitPct = 0;
    let legs: CrossPlatformArbitrage['legs'] = [];
    let depthShares = 0;

    if (buyNetAB >= buyNetBA && buyNetAB >= this.minProfitThreshold) {
      minCost = buyCostAB;
      profitPct = buyNetAB * 100;
      action = 'BUY_BOTH';
      depthShares = Math.max(0, Math.min(marketA.yesAskSize || 0, marketB.noAskSize || 0));
      legs = [
        {
          platform: marketA.platform,
          tokenId: marketA.yesTokenId || '',
          side: 'BUY',
          price: yesAskA,
          shares: depthShares,
          outcome: 'YES',
        },
        {
          platform: marketB.platform,
          tokenId: marketB.noTokenId || '',
          side: 'BUY',
          price: noAskB,
          shares: depthShares,
          outcome: 'NO',
        },
      ];
    } else if (buyNetBA > buyNetAB && buyNetBA >= this.minProfitThreshold) {
      minCost = buyCostBA;
      profitPct = buyNetBA * 100;
      action = 'BUY_BOTH';
      depthShares = Math.max(0, Math.min(marketB.yesAskSize || 0, marketA.noAskSize || 0));
      legs = [
        {
          platform: marketB.platform,
          tokenId: marketB.yesTokenId || '',
          side: 'BUY',
          price: yesAskB,
          shares: depthShares,
          outcome: 'YES',
        },
        {
          platform: marketA.platform,
          tokenId: marketA.noTokenId || '',
          side: 'BUY',
          price: noAskA,
          shares: depthShares,
          outcome: 'NO',
        },
      ];
    } else if (this.allowSellBoth) {
      const sellProceedsAB = yesBidA + noBidB;
      const sellNetAB = sellProceedsAB - 1 - yesBidA * feeA - noBidB * feeB - this.estimatedTransferCost;
      const sellProceedsBA = yesBidB + noBidA;
      const sellNetBA = sellProceedsBA - 1 - yesBidB * feeB - noBidA * feeA - this.estimatedTransferCost;

      if (sellNetAB >= sellNetBA && sellNetAB >= this.minProfitThreshold) {
        minCost = 1;
        profitPct = sellNetAB * 100;
        action = 'SELL_BOTH';
        depthShares = Math.max(0, Math.min(marketA.yesBidSize || 0, marketB.noBidSize || 0));
        legs = [
          {
            platform: marketA.platform,
            tokenId: marketA.yesTokenId || '',
            side: 'SELL',
            price: yesBidA,
            shares: depthShares,
            outcome: 'YES',
          },
          {
            platform: marketB.platform,
            tokenId: marketB.noTokenId || '',
            side: 'SELL',
            price: noBidB,
            shares: depthShares,
            outcome: 'NO',
          },
        ];
      } else if (sellNetBA >= this.minProfitThreshold) {
        minCost = 1;
        profitPct = sellNetBA * 100;
        action = 'SELL_BOTH';
        depthShares = Math.max(0, Math.min(marketB.yesBidSize || 0, marketA.noBidSize || 0));
        legs = [
          {
            platform: marketB.platform,
            tokenId: marketB.yesTokenId || '',
            side: 'SELL',
            price: yesBidB,
            shares: depthShares,
            outcome: 'YES',
          },
          {
            platform: marketA.platform,
            tokenId: marketA.noTokenId || '',
            side: 'SELL',
            price: noBidA,
            shares: depthShares,
            outcome: 'NO',
          },
        ];
      } else {
        return null;
      }
    } else {
      return null;
    }

    const risks: string[] = [];
    if (similarity < 0.9) {
      risks.push('Event descriptions may not match exactly');
    }
    if (Math.abs((marketA.yesMid || 0.5) - (marketB.yesMid || 0.5)) > 0.2) {
      risks.push('Large price difference - possible settlement differences');
    }

    return {
      event: marketA.question.substring(0, 50),
      outcome: 'YES/NO',
      action,
      platformA: {
        name: marketA.platform,
        yesPrice: marketA.yesMid || 0,
        market: marketA.marketId,
        yesTokenId: marketA.yesTokenId,
        noTokenId: marketA.noTokenId,
        yesBid: marketA.yesBid,
        yesAsk: marketA.yesAsk,
        noBid: marketA.noBid,
        noAsk: marketA.noAsk,
      },
      platformB: {
        name: marketB.platform,
        yesPrice: marketB.yesMid || 0,
        market: marketB.marketId,
        yesTokenId: marketB.yesTokenId,
        noTokenId: marketB.noTokenId,
        yesBid: marketB.yesBid,
        yesAsk: marketB.yesAsk,
        noBid: marketB.noBid,
        noAsk: marketB.noAsk,
      },
      priceDifference: (marketA.yesMid || 0) - (marketB.yesMid || 0),
      spreadPercentage: Math.abs((marketA.yesMid || 0) - (marketB.yesMid || 0)) * 100,
      arbitrageExists: true,
      minCost,
      guaranteedPayout: 1,
      profitPercentage: profitPct,
      recommendedSize: depthShares,
      legs,
      risks,
      eventDescriptionMatch: similarity > 0.9,
    };
  }

  /**
   * 计算两个字符串的相似度
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * 扫描跨平台套利机会
   */
  scanMarkets(
    allMarkets: Map<string, PlatformMarket[]>,
    mappingStore?: CrossPlatformMappingStore,
    useMapping: boolean = true
  ): CrossPlatformArbitrage[] {
    const opportunities: CrossPlatformArbitrage[] = [];
    const platformNames = Array.from(allMarkets.keys());

    for (let i = 0; i < platformNames.length; i++) {
      for (let j = i + 1; j < platformNames.length; j++) {
        const platformA = platformNames[i];
        const platformB = platformNames[j];

        const marketsA = allMarkets.get(platformA) || [];
        const marketsB = allMarkets.get(platformB) || [];

        for (const marketA of marketsA) {
          let targets = marketsB;
          if (useMapping && mappingStore) {
            if (marketA.platform === 'Predict') {
              const mapped = mappingStore.resolveMatches(marketA, allMarkets);
              if (mapped.length > 0) {
                targets = mapped.filter((m) => m.platform === platformB);
              }
            }
          }

          for (const marketB of targets) {
            const arb = this.detectArbitrage(marketA, marketB);
            if (arb) {
              opportunities.push(arb);
            }
          }
        }
      }
    }

    opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);

    return opportunities;
  }

  /**
   * 转换为通用套利机会格式
   */
  toOpportunity(arb: CrossPlatformArbitrage): ArbitrageOpportunity {
    return {
      type: 'CROSS_PLATFORM',
      marketId: arb.platformA.market,
      marketQuestion: arb.event,
      timestamp: Date.now(),
      confidence: arb.eventDescriptionMatch ? 0.8 : 0.5,
      platformA: arb.platformA.name,
      platformB: arb.platformB.name,
      priceA: arb.platformA.yesPrice,
      priceB: arb.platformB.yesPrice,
      spread: Math.abs(arb.priceDifference),
      expectedReturn: arb.profitPercentage,
      riskLevel: arb.risks.length > 0 ? 'HIGH' : 'MEDIUM',
      recommendedAction: arb.action,
      positionSize: arb.recommendedSize,
      legs: arb.legs?.map((leg) => ({
        platform: leg.platform,
        tokenId: leg.tokenId,
        side: leg.side,
        price: leg.price,
        shares: leg.shares,
        outcome: leg.outcome,
      })),
    };
  }

  /**
   * 打印跨平台套利报告
   */
  printReport(arbitrages: CrossPlatformArbitrage[]): void {
    console.log('\n🌐 Cross-Platform Arbitrage Opportunities:');
    console.log('─'.repeat(80));

    if (arbitrages.length === 0) {
      console.log('No cross-platform arbitrage opportunities found.');
      console.log('Prices are aligned across platforms (within threshold).\n');
      return;
    }

    for (let i = 0; i < Math.min(10, arbitrages.length); i++) {
      const arb = arbitrages[i];
      console.log(`\n#${i + 1} ${arb.event}`);
      console.log(`   ${arb.platformA.name}: ${arb.platformA.yesPrice.toFixed(2)}¢ (${arb.platformA.market})`);
      console.log(`   ${arb.platformB.name}: ${arb.platformB.yesPrice.toFixed(2)}¢ (${arb.platformB.market})`);
      console.log(`   Action: ${arb.action}`);
      console.log(`   Price Difference: ${arb.priceDifference.toFixed(2)}¢ (${arb.spreadPercentage.toFixed(2)}%)`);
      console.log(`   Min Cost: ${arb.minCost.toFixed(2)}¢ per $1`);
      console.log(`   Profit: ${arb.profitPercentage.toFixed(2)}%`);
      console.log(`   Events Match: ${arb.eventDescriptionMatch ? '✅' : '⚠️'}`);

      if (arb.risks.length > 0) {
        console.log(`   Risks: ${arb.risks.join(', ')}`);
      }
    }

    console.log('\n' + '─'.repeat(80));
  }
}
