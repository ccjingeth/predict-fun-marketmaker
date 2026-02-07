/**
 * Value Mismatch Detector
 * 价值错配检测器 - 更保守的统计型筛选
 */

import type { Market, Orderbook } from '../types.js';
import type { ArbitrageOpportunity, ValueMismatchAnalysis } from './types.js';

export class ValueMismatchDetector {
  private confidenceThreshold: number;
  private edgeThreshold: number;
  private estimatedFee: number;
  private estimatedSlippage: number;

  constructor(
    confidenceThreshold: number = 0.65,
    edgeThreshold: number = 0.04,
    estimatedFee: number = 0.01,
    estimatedSlippage: number = 0.002
  ) {
    this.confidenceThreshold = confidenceThreshold;
    this.edgeThreshold = edgeThreshold;
    this.estimatedFee = estimatedFee;
    this.estimatedSlippage = estimatedSlippage;
  }

  analyzeMarket(market: Market, orderbook: Orderbook): ValueMismatchAnalysis | null {
    const bestBid = orderbook.best_bid;
    const bestAsk = orderbook.best_ask;

    if (!bestBid || !bestAsk) {
      return null;
    }

    const outcome = this.inferOutcome(market);
    const midPrice = orderbook.mid_price || (bestBid + bestAsk) / 2;
    const impliedYes = outcome === 'NO' ? 1 - midPrice : midPrice;
    const impliedNo = 1 - impliedYes;

    const analysis = this.estimateFairValue(market, orderbook, impliedYes);
    const fairYes = analysis.estimatedProbability;
    const fairTokenPrice = outcome === 'NO' ? 1 - fairYes : fairYes;

    const feeRate = Math.max(this.estimatedFee, (market.fee_rate_bps || 0) / 10000);
    const tradingCost = feeRate + this.estimatedSlippage;

    let assessment: 'OVERVALUED' | 'UNDERVALUED' | 'FAIR' = 'FAIR';
    let action: 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO' | 'PASS' = 'PASS';
    let edge = 0;
    let reasoning = '';

    const buyAction = outcome === 'NO' ? 'BUY_NO' : 'BUY_YES';
    const sellAction = outcome === 'NO' ? 'SELL_NO' : 'SELL_YES';
    const outcomeLabel = outcome === 'UNKNOWN' ? 'TOKEN' : outcome;

    if (fairTokenPrice > bestAsk) {
      edge = (fairTokenPrice - bestAsk) / bestAsk - tradingCost;
      if (edge > 0) {
        assessment = 'UNDERVALUED';
        action = buyAction;
        reasoning = `${outcomeLabel} ask ${(bestAsk * 100).toFixed(1)}¢, fair ${(fairTokenPrice * 100).toFixed(1)}¢`;
      }
    } else if (fairTokenPrice < bestBid) {
      edge = (bestBid - fairTokenPrice) / bestBid - tradingCost;
      if (edge > 0) {
        assessment = 'OVERVALUED';
        action = sellAction;
        reasoning = `${outcomeLabel} bid ${(bestBid * 100).toFixed(1)}¢, fair ${(fairTokenPrice * 100).toFixed(1)}¢`;
      }
    }

    if (Math.abs(edge) < this.edgeThreshold || analysis.confidence < this.confidenceThreshold) {
      return null;
    }

    return {
      marketId: market.token_id,
      question: market.question,
      category: market.description?.split(':')[0] || 'Unknown',
      endDate: market.end_date || 'Unknown',
      tokenOutcome: outcome,
      currentYesPrice: impliedYes,
      currentNoPrice: impliedNo,
      currentTokenPrice: midPrice,
      estimatedProbability: analysis.estimatedProbability,
      fairTokenPrice,
      confidence: analysis.confidence,
      assessment,
      edge: Math.abs(edge),
      action,
      reasoning,
    };
  }

  private estimateFairValue(
    market: Market,
    orderbook: Orderbook,
    impliedYes: number
  ): {
    estimatedProbability: number;
    confidence: number;
  } {
    const totalOrders = (orderbook.bids?.length || 0) + (orderbook.asks?.length || 0);
    const depthConfidence = Math.min(1, totalOrders / 30);
    const spreadConfidence = orderbook.spread_pct ? Math.max(0, 1 - orderbook.spread_pct / 8) : 0.5;

    const liquidityConfidence = Math.min(1, (market.liquidity_24h || 0) / 5000);
    const volumeConfidence = Math.min(1, (market.volume_24h || 0) / 5000);

    const confidence = (depthConfidence + spreadConfidence + liquidityConfidence + volumeConfidence) / 4;

    let adjustedProb = impliedYes;
    if (impliedYes < 0.08) {
      adjustedProb = Math.max(impliedYes, 0.1);
    } else if (impliedYes > 0.92) {
      adjustedProb = Math.min(impliedYes, 0.9);
    }

    return {
      estimatedProbability: adjustedProb,
      confidence,
    };
  }

  private inferOutcome(market: Market): 'YES' | 'NO' | 'UNKNOWN' {
    const raw = String(market.outcome ?? '').trim().toUpperCase();
    if (!raw) {
      return 'UNKNOWN';
    }
    if (raw.includes('YES')) {
      return 'YES';
    }
    if (raw.includes('NO')) {
      return 'NO';
    }
    return 'UNKNOWN';
  }

  private calculateEdge(fairValue: number, marketPrice: number): number {
    return (fairValue - marketPrice) / marketPrice;
  }

  scanMarkets(markets: Market[], orderbooks: Map<string, Orderbook>): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    for (const market of markets) {
      const orderbook = orderbooks.get(market.token_id);
      if (!orderbook || !orderbook.best_bid || !orderbook.best_ask) {
        continue;
      }

      const analysis = this.analyzeMarket(market, orderbook);

      if (analysis) {
        opportunities.push({
          type: 'VALUE_MISMATCH',
          marketId: market.token_id,
          marketQuestion: market.question,
          timestamp: Date.now(),
          confidence: analysis.confidence,
          estimatedValue: analysis.fairTokenPrice ?? analysis.estimatedProbability,
          marketPrice: analysis.currentTokenPrice ?? analysis.currentYesPrice,
          fairValue: analysis.fairTokenPrice ?? analysis.estimatedProbability,
          edge: analysis.edge,
          recommendedAction: analysis.action === 'PASS' ? 'HOLD' : analysis.action,
          expectedReturn: Math.abs(analysis.edge) * 100,
          riskLevel: analysis.confidence > 0.75 ? 'MEDIUM' : 'HIGH',
        });
      }
    }

    opportunities.sort((a, b) => (b.expectedReturn || 0) - (a.expectedReturn || 0));
    return opportunities;
  }

  printReport(opportunities: ArbitrageOpportunity[]): void {
    console.log('\n📊 Value Mismatch Analysis:');
    console.log('─'.repeat(80));

    if (opportunities.length === 0) {
      console.log('No significant value mismatches found.\n');
      return;
    }

    for (let i = 0; i < Math.min(10, opportunities.length); i++) {
      const opp = opportunities[i];
      console.log(`\n#${i + 1} ${opp.marketQuestion.substring(0, 50)}...`);
      console.log(`   Market: ${opp.marketId}`);
      console.log(`   Edge: ${((opp.edge || 0) * 100).toFixed(2)}%`);
      console.log(`   Confidence: ${((opp.confidence || 0) * 100).toFixed(0)}%`);
      console.log(`   Action: ${opp.recommendedAction}`);
      console.log(`   Expected Return: ${opp.expectedReturn?.toFixed(2)}%`);
      console.log(`   Risk: ${opp.riskLevel}`);
    }

    console.log('\n' + '─'.repeat(80));
  }
}
