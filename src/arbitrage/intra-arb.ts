/**
 * In-Platform Arbitrage Detector
 * 站内套利检测器 - 检测 Yes + No != 1 的套利机会
 */

import type { Market, Orderbook } from '../types.js';
import type { ArbitrageOpportunity, InPlatformArbitrage } from './types.js';
import { buildYesNoPairs } from './pairs.js';

export class InPlatformArbitrageDetector {
  private minProfitThreshold: number;
  private estimatedFee: number;
  private estimatedSlippage: number;
  private allowShorting: boolean;
  private maxRecommendedShares: number;

  constructor(
    minProfitThreshold: number = 0.02,
    estimatedFee: number = 0.01,
    allowShorting: boolean = false,
    estimatedSlippage: number = 0.002,
    maxRecommendedShares: number = 500
  ) {
    this.minProfitThreshold = minProfitThreshold;
    this.estimatedFee = estimatedFee;
    this.allowShorting = allowShorting;
    this.estimatedSlippage = estimatedSlippage;
    this.maxRecommendedShares = maxRecommendedShares;
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

    const buyCost = yesTop.ask + noTop.ask;
    const sellProceeds = yesTop.bid + noTop.bid;

    const feeCost = this.estimatedFee * 2;
    const slippageCost = this.estimatedSlippage * 2;

    const buyNetEdge = 1 - buyCost - feeCost - slippageCost;
    const sellNetEdge = sellProceeds - 1 - feeCost - slippageCost;

    const canBuy = buyNetEdge >= this.minProfitThreshold;
    const canSell = this.allowShorting && sellNetEdge >= this.minProfitThreshold;

    if (!canBuy && !canSell) {
      return null;
    }

    const useSell = canSell && sellNetEdge > buyNetEdge;

    const depthShares = Math.max(0, Math.min(yesTop.askSize, noTop.askSize, yesTop.bidSize, noTop.bidSize));
    const recommendedSize = Math.max(1, Math.floor(Math.min(depthShares, this.maxRecommendedShares)));

    if (useSell) {
      return {
        marketId: yesMarket.condition_id || yesMarket.event_id || yesMarket.token_id,
        yesTokenId: yesMarket.token_id,
        noTokenId: noMarket.token_id,
        question: yesMarket.question,
        yesPrice: yesTop.bid,
        noPrice: noTop.bid,
        yesBid: yesTop.bid,
        yesAsk: yesTop.ask,
        noBid: noTop.bid,
        noAsk: noTop.ask,
        yesPlusNo: sellProceeds,
        arbitrageExists: true,
        arbitrageType: 'OVER_ONE',
        profitPercentage: Math.max(0, (sellProceeds - 1) * 100),
        maxProfit: Math.max(0, sellNetEdge * 100),
        depthShares,
        action: 'SELL_BOTH',
        recommendedSize,
        breakEvenFee: Math.abs(sellProceeds - 1) * 100,
      };
    }

    return {
      marketId: yesMarket.condition_id || yesMarket.event_id || yesMarket.token_id,
      yesTokenId: yesMarket.token_id,
      noTokenId: noMarket.token_id,
      question: yesMarket.question,
      yesPrice: yesTop.ask,
      noPrice: noTop.ask,
      yesBid: yesTop.bid,
      yesAsk: yesTop.ask,
      noBid: noTop.bid,
      noAsk: noTop.ask,
      yesPlusNo: buyCost,
      arbitrageExists: true,
      arbitrageType: 'UNDER_ONE',
      profitPercentage: Math.max(0, (1 - buyCost) * 100),
      maxProfit: Math.max(0, buyNetEdge * 100),
      depthShares,
      action: 'BUY_BOTH',
      recommendedSize,
      breakEvenFee: Math.abs(buyCost - 1) * 100,
    };
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
