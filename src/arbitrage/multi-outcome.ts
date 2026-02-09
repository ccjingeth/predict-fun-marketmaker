/**
 * Multi-Outcome Arbitrage Detector
 * 多结果市场套利（总成本 < $1）
 */

import type { Market, Orderbook } from '../types.js';
import type { ArbitrageOpportunity } from './types.js';

export interface MultiOutcomeArbitrage {
  marketId: string;
  question: string;
  outcomes: {
    tokenId: string;
    price: number;
    askSize: number;
    feeBps: number;
  }[];
  totalCost: number;
  totalFees: number;
  totalSlippage: number;
  guaranteedProfit: number;
  recommendedSize: number;
}

export interface MultiOutcomeConfig {
  minProfitThreshold: number;
  feeBps: number;
  slippageBps: number;
  maxRecommendedShares: number;
  minOutcomes: number;
}

export class MultiOutcomeArbitrageDetector {
  private config: MultiOutcomeConfig;

  constructor(config: Partial<MultiOutcomeConfig> = {}) {
    this.config = {
      minProfitThreshold: 0.02,
      feeBps: 100,
      slippageBps: 20,
      maxRecommendedShares: 500,
      minOutcomes: 3,
      ...config,
    };
  }

  scanMarkets(markets: Market[], orderbooks: Map<string, Orderbook>): ArbitrageOpportunity[] {
    const groups = this.groupByCondition(markets);
    const opportunities: ArbitrageOpportunity[] = [];

    for (const group of groups.values()) {
      if (group.length < this.config.minOutcomes) {
        continue;
      }

      const outcomes: MultiOutcomeArbitrage['outcomes'] = [];
      let totalCost = 0;
      let totalFees = 0;
      let totalSlippage = 0;
      let minDepth = Infinity;

      for (const market of group) {
        const book = orderbooks.get(market.token_id);
        const top = this.topOfBook(book);
        const ask = top?.ask ?? market.best_ask ?? 0;
        const askSize = top?.askSize ?? 0;
        if (!ask || ask <= 0) {
          totalCost = 0;
          break;
        }

        const feeRate = (market.fee_rate_bps || this.config.feeBps) / 10000;
        totalCost += ask;
        totalFees += ask * feeRate;
        totalSlippage += ask * (this.config.slippageBps / 10000);
        minDepth = Math.min(minDepth, askSize > 0 ? askSize : minDepth);

        outcomes.push({
          tokenId: market.token_id,
          price: ask,
          askSize,
          feeBps: market.fee_rate_bps || this.config.feeBps,
        });
      }

      if (!totalCost || !Number.isFinite(totalCost)) {
        continue;
      }

      if (!Number.isFinite(minDepth) || minDepth <= 0) {
        minDepth = 0;
      }

      const guaranteedProfit = 1 - totalCost - totalFees - totalSlippage;
      if (guaranteedProfit < this.config.minProfitThreshold) {
        continue;
      }

      const recommendedSize = Math.max(
        1,
        Math.floor(Math.min(minDepth, this.config.maxRecommendedShares))
      );

      const marketId = group[0].condition_id || group[0].event_id || group[0].token_id;
      const question = group[0].question;

      opportunities.push({
        type: 'MULTI_OUTCOME',
        marketId,
        marketQuestion: question,
        timestamp: Date.now(),
        confidence: 0.85,
        expectedReturn: guaranteedProfit * 100,
        arbitrageProfit: guaranteedProfit * 100,
        recommendedAction: 'BUY_BOTH',
        positionSize: recommendedSize,
        riskLevel: guaranteedProfit > 0.05 ? 'LOW' : 'MEDIUM',
        guaranteedProfit,
        totalCost,
        legs: outcomes.map((o) => ({
          tokenId: o.tokenId,
          side: 'BUY',
          price: o.price,
          shares: recommendedSize,
        })),
      });
    }

    opportunities.sort((a, b) => (b.expectedReturn || 0) - (a.expectedReturn || 0));
    return opportunities;
  }

  private groupByCondition(markets: Market[]): Map<string, Market[]> {
    const grouped = new Map<string, Market[]>();
    for (const market of markets) {
      const key = market.condition_id || market.event_id;
      if (!key) {
        continue;
      }
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(market);
    }
    return grouped;
  }

  private topOfBook(orderbook?: Orderbook): { bid: number; ask: number; bidSize: number; askSize: number } | null {
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
}
