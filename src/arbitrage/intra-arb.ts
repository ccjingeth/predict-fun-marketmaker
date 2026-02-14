/**
 * In-Platform Arbitrage Detector
 * 站内套利检测器 - 检测 Yes + No != 1 的套利机会
 */

import type { Market, Orderbook } from '../types.js';
import type { ArbitrageOpportunity, InPlatformArbitrage } from './types.js';
import { buildYesNoPairs } from './pairs.js';
import { estimateBuy, estimateSell, sumDepth, maxBuySharesForLimit, maxSellSharesForLimit } from './orderbook-vwap.js';

export class InPlatformArbitrageDetector {
  private minProfitThreshold: number;
  private estimatedFee: number;
  private estimatedSlippage: number;
  private allowShorting: boolean;
  private maxRecommendedShares: number;
  private depthUsage: number;
  private minNotionalUsd: number;
  private minProfitUsd: number;
  private minDepthUsd: number;
  private maxVwapDeviationBps: number;
  private recheckDeviationBps: number;
  private maxVwapLevels: number;

  constructor(
    minProfitThreshold: number = 0.02,
    estimatedFee: number = 0.01,
    allowShorting: boolean = false,
    estimatedSlippage: number = 0.002,
    maxRecommendedShares: number = 500,
    depthUsage: number = 0.6,
    minNotionalUsd: number = 0,
    minProfitUsd: number = 0,
    minDepthUsd: number = 0,
    maxVwapDeviationBps: number = 0,
    recheckDeviationBps: number = 60,
    maxVwapLevels: number = 0
  ) {
    this.minProfitThreshold = minProfitThreshold;
    this.estimatedFee = estimatedFee;
    this.allowShorting = allowShorting;
    this.estimatedSlippage = estimatedSlippage;
    this.maxRecommendedShares = maxRecommendedShares;
    this.depthUsage = Math.max(0.05, Math.min(1, depthUsage));
    this.minNotionalUsd = Math.max(0, minNotionalUsd);
    this.minProfitUsd = Math.max(0, minProfitUsd);
    this.minDepthUsd = Math.max(0, minDepthUsd);
    this.maxVwapDeviationBps = Math.max(0, maxVwapDeviationBps);
    this.recheckDeviationBps = Math.max(0, recheckDeviationBps);
    this.maxVwapLevels = Math.max(0, Math.floor(maxVwapLevels));
  }


  private topOfBook(orderbook?: Orderbook): {
    bid: number;
    ask: number;
    bidSize: number;
    askSize: number;
  } | null {
    if (!orderbook || orderbook.best_bid === undefined || orderbook.best_ask === undefined) {
      return null;
    }

    const bidSize = Number(orderbook.bids[0]?.shares || 0);
    const askSize = Number(orderbook.asks[0]?.shares || 0);

    return {
      bid: orderbook.best_bid,
      ask: orderbook.best_ask,
      bidSize: Number.isFinite(bidSize) ? bidSize : 0,
      askSize: Number.isFinite(askSize) ? askSize : 0,
    };
  }

  private buildOpportunity(
    yesMarket: Market,
    noMarket: Market,
    yesBook: Orderbook,
    noBook: Orderbook
  ): InPlatformArbitrage | null {
    const yesTop = this.topOfBook(yesBook);
    const noTop = this.topOfBook(noBook);

    if (!yesTop || !noTop) {
      return null;
    }

    if (yesTop.ask <= 0 || noTop.ask <= 0 || yesTop.bid <= 0 || noTop.bid <= 0) {
      return null;
    }

    const fallbackBps = this.estimatedFee * 10000;
    const yesFeeBps = yesMarket.fee_rate_bps || fallbackBps;
    const noFeeBps = noMarket.fee_rate_bps || fallbackBps;
    const slippageBps = this.estimatedSlippage * 10000;

    if (this.minDepthUsd > 0) {
      const yesDepthUsd = sumDepth(yesBook.asks) * yesTop.ask;
      const noDepthUsd = sumDepth(noBook.asks) * noTop.ask;
      if (yesDepthUsd < this.minDepthUsd || noDepthUsd < this.minDepthUsd) {
        return null;
      }
    }

    const buyDepth = Math.min(sumDepth(yesBook.asks), sumDepth(noBook.asks));
    const sellDepth = Math.min(sumDepth(yesBook.bids), sumDepth(noBook.bids));

    let buySize = Math.floor(Math.min(buyDepth * this.depthUsage, this.maxRecommendedShares));
    let sellSize = Math.floor(Math.min(sellDepth * this.depthUsage, this.maxRecommendedShares));

    if (this.maxVwapDeviationBps > 0) {
      const maxYes = maxBuySharesForLimit(
        yesBook.asks,
        yesTop.ask,
        this.maxVwapDeviationBps,
        yesFeeBps,
        undefined,
        undefined,
        slippageBps
      );
      const maxNo = maxBuySharesForLimit(
        noBook.asks,
        noTop.ask,
        this.maxVwapDeviationBps,
        noFeeBps,
        undefined,
        undefined,
        slippageBps
      );
      buySize = Math.min(buySize, Math.floor(Math.min(maxYes, maxNo)));

      const maxYesSell = maxSellSharesForLimit(
        yesBook.bids,
        yesTop.bid,
        this.maxVwapDeviationBps,
        yesFeeBps,
        undefined,
        undefined,
        slippageBps
      );
      const maxNoSell = maxSellSharesForLimit(
        noBook.bids,
        noTop.bid,
        this.maxVwapDeviationBps,
        noFeeBps,
        undefined,
        undefined,
        slippageBps
      );
      sellSize = Math.min(sellSize, Math.floor(Math.min(maxYesSell, maxNoSell)));
    }
    let buyCandidate = this.findBestBuySize(
      yesBook,
      noBook,
      yesFeeBps,
      noFeeBps,
      slippageBps,
      buySize
    );
    let sellCandidate = this.findBestSellSize(
      yesBook,
      noBook,
      yesFeeBps,
      noFeeBps,
      slippageBps,
      sellSize
    );

    const recheckBps = this.recheckDeviationBps;
    if (this.maxVwapDeviationBps > 0 || recheckBps > 0) {
      const maxDev = this.maxVwapDeviationBps / 10000;
      const recheckDev = recheckBps / 10000;
      if (buyCandidate) {
        const buyTooDeep =
          buyCandidate.yes.avgPrice > yesTop.ask * (1 + maxDev) ||
          buyCandidate.no.avgPrice > noTop.ask * (1 + maxDev);
        if (buyTooDeep) {
          buyCandidate = null;
        }
      }
      if (sellCandidate) {
        const sellTooDeep =
          sellCandidate.yes.avgPrice < yesTop.bid * (1 - maxDev) ||
          sellCandidate.no.avgPrice < noTop.bid * (1 - maxDev);
        if (sellTooDeep) {
          sellCandidate = null;
        }
      }
      if (recheckDev > 0) {
        if (buyCandidate) {
          const needsRecheck =
            buyCandidate.yes.avgPrice > yesTop.ask * (1 + recheckDev) ||
            buyCandidate.no.avgPrice > noTop.ask * (1 + recheckDev);
          if (needsRecheck) {
            return null;
          }
        }
        if (sellCandidate) {
          const needsRecheck =
            sellCandidate.yes.avgPrice < yesTop.bid * (1 - recheckDev) ||
            sellCandidate.no.avgPrice < noTop.bid * (1 - recheckDev);
          if (needsRecheck) {
            return null;
          }
        }
      }
    }

    if (this.maxVwapLevels > 0) {
      if (buyCandidate) {
        if (buyCandidate.yes.levelsUsed > this.maxVwapLevels || buyCandidate.no.levelsUsed > this.maxVwapLevels) {
          buyCandidate = null;
        }
      }
      if (sellCandidate) {
        if (sellCandidate.yes.levelsUsed > this.maxVwapLevels || sellCandidate.no.levelsUsed > this.maxVwapLevels) {
          sellCandidate = null;
        }
      }
    }

    const buyNetEdge = buyCandidate?.edge ?? -Infinity;
    const sellNetEdge = sellCandidate?.edge ?? -Infinity;

    const canBuy = buyNetEdge >= this.minProfitThreshold;
    const canSell = this.allowShorting && sellNetEdge >= this.minProfitThreshold;

    if (!canBuy && !canSell) {
      return null;
    }

    const useSell = canSell && sellNetEdge > buyNetEdge;

    if (useSell && sellCandidate) {
      const { yes: sellYes, no: sellNo, size: recommendedSize } = sellCandidate;
      const proceedsUsd = sellYes.totalAllIn + sellNo.totalAllIn;
      const profitUsd = Math.max(0, sellNetEdge * recommendedSize);
      if (this.minNotionalUsd > 0 && proceedsUsd < this.minNotionalUsd) {
        return null;
      }
      if (this.minProfitUsd > 0 && profitUsd < this.minProfitUsd) {
        return null;
      }
      return {
        marketId: yesMarket.condition_id || yesMarket.event_id || yesMarket.token_id,
        yesTokenId: yesMarket.token_id,
        noTokenId: noMarket.token_id,
        question: yesMarket.question,
        yesPrice: sellYes.avgPrice,
        noPrice: sellNo.avgPrice,
        yesBid: yesTop.bid,
        yesAsk: yesTop.ask,
        noBid: noTop.bid,
        noAsk: noTop.ask,
        yesPlusNo: sellYes.avgAllIn + sellNo.avgAllIn,
        arbitrageExists: true,
        arbitrageType: 'OVER_ONE',
        profitPercentage: Math.max(0, sellNetEdge * 100),
        maxProfit: Math.max(0, sellNetEdge * 100),
        depthShares: recommendedSize,
        action: 'SELL_BOTH',
        recommendedSize: Math.max(1, recommendedSize),
        breakEvenFee: Math.abs(sellYes.avgAllIn + sellNo.avgAllIn - 1) * 100,
      };
    }

    if (!buyCandidate) {
      return null;
    }

    const { yes: buyYes, no: buyNo, size: recommendedSize } = buyCandidate;
    const totalCostUsd = buyYes.totalAllIn + buyNo.totalAllIn;
    const profitUsd = Math.max(0, buyNetEdge * recommendedSize);
    if (this.minNotionalUsd > 0 && totalCostUsd < this.minNotionalUsd) {
      return null;
    }
    if (this.minProfitUsd > 0 && profitUsd < this.minProfitUsd) {
      return null;
    }
    return {
      marketId: yesMarket.condition_id || yesMarket.event_id || yesMarket.token_id,
      yesTokenId: yesMarket.token_id,
      noTokenId: noMarket.token_id,
      question: yesMarket.question,
      yesPrice: buyYes.avgPrice,
      noPrice: buyNo.avgPrice,
      yesBid: yesTop.bid,
      yesAsk: yesTop.ask,
      noBid: noTop.bid,
      noAsk: noTop.ask,
      yesPlusNo: buyYes.avgAllIn + buyNo.avgAllIn,
      arbitrageExists: true,
      arbitrageType: 'UNDER_ONE',
      profitPercentage: Math.max(0, buyNetEdge * 100),
      maxProfit: Math.max(0, buyNetEdge * 100),
      depthShares: recommendedSize,
      action: 'BUY_BOTH',
      recommendedSize: Math.max(1, recommendedSize),
      breakEvenFee: Math.abs(buyYes.avgAllIn + buyNo.avgAllIn - 1) * 100,
    };
  }

  private findBestBuySize(
    yesBook: Orderbook,
    noBook: Orderbook,
    yesFeeBps: number,
    noFeeBps: number,
    slippageBps: number,
    startSize: number
  ): { size: number; edge: number; yes: NonNullable<ReturnType<typeof estimateBuy>>; no: NonNullable<ReturnType<typeof estimateBuy>> } | null {
    if (startSize <= 0) {
      return null;
    }
    let size = startSize;
    let best: { size: number; edge: number; yes: NonNullable<ReturnType<typeof estimateBuy>>; no: NonNullable<ReturnType<typeof estimateBuy>> } | null = null;
    for (let i = 0; i < 4 && size >= 1; i += 1) {
      const yes = estimateBuy(yesBook.asks, size, yesFeeBps, undefined, undefined, slippageBps);
      const no = estimateBuy(noBook.asks, size, noFeeBps, undefined, undefined, slippageBps);
      if (yes && no) {
        const costPerShare = (yes.totalAllIn + no.totalAllIn) / size;
        const edge = 1 - costPerShare;
        if (!best || edge > best.edge) {
          best = { size, edge, yes, no };
        }
        if (edge >= this.minProfitThreshold) {
          return { size, edge, yes, no };
        }
      }
      size = Math.max(1, Math.floor(size * 0.6));
    }
    return best && best.edge >= this.minProfitThreshold ? best : null;
  }

  private findBestSellSize(
    yesBook: Orderbook,
    noBook: Orderbook,
    yesFeeBps: number,
    noFeeBps: number,
    slippageBps: number,
    startSize: number
  ): { size: number; edge: number; yes: NonNullable<ReturnType<typeof estimateSell>>; no: NonNullable<ReturnType<typeof estimateSell>> } | null {
    if (startSize <= 0) {
      return null;
    }
    let size = startSize;
    let best: { size: number; edge: number; yes: NonNullable<ReturnType<typeof estimateSell>>; no: NonNullable<ReturnType<typeof estimateSell>> } | null = null;
    for (let i = 0; i < 4 && size >= 1; i += 1) {
      const yes = estimateSell(yesBook.bids, size, yesFeeBps, undefined, undefined, slippageBps);
      const no = estimateSell(noBook.bids, size, noFeeBps, undefined, undefined, slippageBps);
      if (yes && no) {
        const revenuePerShare = (yes.totalAllIn + no.totalAllIn) / size;
        const edge = revenuePerShare - 1;
        if (!best || edge > best.edge) {
          best = { size, edge, yes, no };
        }
        if (edge >= this.minProfitThreshold) {
          return { size, edge, yes, no };
        }
      }
      size = Math.max(1, Math.floor(size * 0.6));
    }
    return best && best.edge >= this.minProfitThreshold ? best : null;
  }

  scanMarkets(markets: Market[], orderbooks: Map<string, Orderbook>): InPlatformArbitrage[] {
    const opportunities: InPlatformArbitrage[] = [];
    const pairs = buildYesNoPairs(markets);

    for (const pair of pairs) {
      if (!pair.yes || !pair.no) {
        continue;
      }

      const yesBook = orderbooks.get(pair.yes.token_id);
      const noBook = orderbooks.get(pair.no.token_id);

      if (!yesBook || !noBook) {
        continue;
      }

      const opp = this.buildOpportunity(pair.yes, pair.no, yesBook, noBook);
      if (opp) {
        opportunities.push(opp);
      }
    }

    opportunities.sort((a, b) => b.maxProfit - a.maxProfit);
    return opportunities;
  }

  toOpportunity(arb: InPlatformArbitrage): ArbitrageOpportunity {
    return {
      type: 'IN_PLATFORM' as const,
      marketId: arb.marketId,
      marketQuestion: arb.question,
      timestamp: Date.now(),
      confidence: 0.9,
      yesPrice: arb.yesPrice,
      noPrice: arb.noPrice,
      yesPlusNo: arb.yesPlusNo,
      arbitrageProfit: arb.maxProfit,
      yesTokenId: arb.yesTokenId,
      noTokenId: arb.noTokenId,
      yesBid: arb.yesBid,
      yesAsk: arb.yesAsk,
      noBid: arb.noBid,
      noAsk: arb.noAsk,
      recommendedAction: arb.action === 'NONE' ? 'HOLD' : arb.action,
      positionSize: arb.recommendedSize,
      expectedReturn: arb.maxProfit,
      riskLevel: arb.maxProfit > 5 ? 'MEDIUM' : 'LOW',
      legs: [
        {
          tokenId: arb.yesTokenId,
          side: arb.action === 'SELL_BOTH' ? 'SELL' : 'BUY',
          price: arb.yesPrice,
          shares: arb.recommendedSize,
        },
        {
          tokenId: arb.noTokenId,
          side: arb.action === 'SELL_BOTH' ? 'SELL' : 'BUY',
          price: arb.noPrice,
          shares: arb.recommendedSize,
        },
      ],
    };
  }

  printReport(arbitrages: InPlatformArbitrage[]): void {
    console.log('\n💰 In-Platform Arbitrage Opportunities:');
    console.log('─'.repeat(80));

    if (arbitrages.length === 0) {
      console.log('No in-platform arbitrage opportunities found.');
      console.log('All markets are aligned within threshold.\n');
      return;
    }

    for (let i = 0; i < Math.min(10, arbitrages.length); i++) {
      const arb = arbitrages[i];
      console.log(`\n#${i + 1} ${arb.question.substring(0, 50)}...`);
      console.log(`   YES token: ${arb.yesTokenId}`);
      console.log(`   NO token:  ${arb.noTokenId}`);
      console.log(`   YES bid/ask: ${(arb.yesBid * 100).toFixed(2)}¢ / ${(arb.yesAsk * 100).toFixed(2)}¢`);
      console.log(`   NO bid/ask:  ${(arb.noBid * 100).toFixed(2)}¢ / ${(arb.noAsk * 100).toFixed(2)}¢`);
      console.log(`   Action: ${arb.action}`);
      console.log(`   Net Profit (after fees): ${arb.maxProfit.toFixed(2)}%`);
      console.log(`   Depth (shares): ${arb.depthShares.toFixed(2)}`);
    }

    console.log('\n' + '─'.repeat(80));
  }
}
