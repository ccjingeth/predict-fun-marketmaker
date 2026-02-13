/**
 * Multi-Outcome Arbitrage Detector
 * 多结果市场套利（总成本 < $1）
 */

import type { Market, Orderbook } from '../types.js';
import type { ArbitrageOpportunity } from './types.js';
import { estimateBuy, sumDepth } from './orderbook-vwap.js';

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
      let minDepth = Infinity;

      for (const market of group) {
        const book = orderbooks.get(market.token_id);
        const top = this.topOfBook(book);
        const ask = top?.ask ?? market.best_ask ?? 0;
        const askSize = top?.askSize ?? 0;
        if (!ask || ask <= 0) {
          minDepth = 0;
          break;
        }

        const depth = Math.max(sumDepth(book?.asks), askSize);
        minDepth = Math.min(minDepth, depth > 0 ? depth : minDepth);

        outcomes.push({
          tokenId: market.token_id,
          price: ask,
          askSize,
          feeBps: market.fee_rate_bps || this.config.feeBps,
        });
      }

      if (!Number.isFinite(minDepth) || minDepth <= 0) {
        continue;
      }

      const startSize = Math.max(1, Math.floor(Math.min(minDepth, this.config.maxRecommendedShares)));
      const candidate = this.findBestSize(group, orderbooks, startSize);
      if (!candidate) {
        continue;
      }

      const recommendedSize = candidate.size;
      const totalCost = candidate.totalCost;
      const totalFees = candidate.totalFees;
      const totalSlippage = candidate.totalSlippage;
      const totalAllIn = candidate.totalAllIn;
      const guaranteedProfit = candidate.edge;

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
        totalCost: totalCost / recommendedSize,
        totalFees: totalFees / recommendedSize,
        totalSlippage: totalSlippage / recommendedSize,
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

  private findBestSize(
    group: Market[],
    orderbooks: Map<string, Orderbook>,
    startSize: number
  ): { size: number; totalCost: number; totalFees: number; totalSlippage: number; totalAllIn: number; edge: number } | null {
    if (startSize <= 0) {
      return null;
    }
    let size = startSize;
    let best: { size: number; totalCost: number; totalFees: number; totalSlippage: number; totalAllIn: number; edge: number } | null = null;
    for (let i = 0; i < 4 && size >= 1; i += 1) {
      let totalCost = 0;
      let totalFees = 0;
      let totalSlippage = 0;
      let totalAllIn = 0;
      let usable = true;

      for (const market of group) {
        const book = orderbooks.get(market.token_id);
        const feeBps = market.fee_rate_bps || this.config.feeBps;
        const fill = estimateBuy(book?.asks, size, feeBps, undefined, undefined, this.config.slippageBps);
        if (!fill) {
          usable = false;
          break;
        }
        totalCost += fill.totalNotional;
        totalFees += fill.totalFees;
        totalSlippage += fill.totalSlippage;
        totalAllIn += fill.totalAllIn;
      }

      if (usable) {
        const allInPerShare = totalAllIn / size;
        const edge = 1 - allInPerShare;
        if (!best || edge > best.edge) {
          best = { size, totalCost, totalFees, totalSlippage, totalAllIn, edge };
        }
        if (edge >= this.config.minProfitThreshold) {
          return { size, totalCost, totalFees, totalSlippage, totalAllIn, edge };
        }
      }

      size = Math.max(1, Math.floor(size * 0.6));
    }
    return best && best.edge >= this.config.minProfitThreshold ? best : null;
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
