/**
 * Market Selector
 * Analyzes markets and selects the best ones for market making
 */

import type { Market, Orderbook } from './types.js';

export interface MarketScore {
  market: Market;
  score: number;
  reasons: string[];
}

export class MarketSelector {
  private minLiquidity: number;
  private minVolume24h: number;
  private maxSpread: number;
  private minOrders: number;

  constructor(
    minLiquidity: number = 1000,
    minVolume24h: number = 5000,
    maxSpread: number = 0.10, // 10%
    minOrders: number = 5
  ) {
    this.minLiquidity = minLiquidity;
    this.minVolume24h = minVolume24h;
    this.maxSpread = maxSpread;
    this.minOrders = minOrders;
  }

  /**
   * Score and rank markets based on liquidity and activity
   */
  selectMarkets(markets: Market[], orderbooks: Map<string, Orderbook>): MarketScore[] {
    const scoredMarkets: MarketScore[] = [];

    for (const market of markets) {
      const orderbook = orderbooks.get(market.token_id);
      if (!orderbook || !orderbook.mid_price) {
        continue; // Skip markets without valid orderbooks
      }

      const score = this.scoreMarket(market, orderbook);
      if (score.score > 0) {
        scoredMarkets.push(score);
      }
    }

    // Sort by score descending
    scoredMarkets.sort((a, b) => b.score - a.score);

    return scoredMarkets;
  }

  /**
   * Score an individual market
   */
  private scoreMarket(market: Market, orderbook: Orderbook): MarketScore {
    const reasons: string[] = [];
    let score = 0;

    // ✅ BONUS: Liquidity Activation (50 extra points!)
    // Markets with active liquidity point rewards get highest priority
    if (market.liquidity_activation?.active) {
      score += 50;
      reasons.push(`✨ Active Liquidity Points!`);
      if (market.liquidity_activation.max_spread_cents) {
        reasons.push(`   Max Spread: ±${market.liquidity_activation.max_spread_cents}¢`);
      }
      if (market.liquidity_activation.min_shares) {
        reasons.push(`   Min Shares: ${market.liquidity_activation.min_shares}`);
      }
    }

    // Liquidity score (0-40 points)
    const liquidity = market.liquidity_24h || 0;
    if (liquidity >= this.minLiquidity) {
      const liquidityScore = Math.min(40, (liquidity / this.minLiquidity) * 20);
      score += liquidityScore;
      reasons.push(`Liquidity: $${liquidity.toFixed(2)}`);
    } else {
      return { market, score: 0, reasons: ['Insufficient liquidity'] };
    }

    // Volume score (0-30 points)
    const volume = market.volume_24h || 0;
    if (volume >= this.minVolume24h) {
      const volumeScore = Math.min(30, (volume / this.minVolume24h) * 15);
      score += volumeScore;
      reasons.push(`Volume: $${volume.toFixed(2)}`);
    } else {
      return { market, score: 0, reasons: ['Insufficient volume'] };
    }

    // Spread score (0-20 points) - lower spread is better
    if (orderbook.spread_pct !== undefined) {
      if (orderbook.spread_pct <= this.maxSpread * 100) {
        const spreadScore = Math.max(0, 20 - (orderbook.spread_pct / (this.maxSpread * 100)) * 20);
        score += spreadScore;
        reasons.push(`Spread: ${orderbook.spread_pct.toFixed(2)}%`);
      } else {
        return { market, score: 0, reasons: ['Spread too wide'] };
      }
    }

    // Order depth score (0-10 points)
    const totalOrders = (orderbook.bids?.length || 0) + (orderbook.asks?.length || 0);
    if (totalOrders >= this.minOrders) {
      const orderScore = Math.min(10, (totalOrders / this.minOrders) * 5);
      score += orderScore;
      reasons.push(`Orders: ${totalOrders}`);
    } else {
      return { market, score: 0, reasons: ['Insufficient order depth'] };
    }

    return { market, score, reasons };
  }

  /**
   * Get top N markets by score
   */
  getTopMarkets(scoredMarkets: MarketScore[], count: number = 10): Market[] {
    return scoredMarkets.slice(0, count).map((s) => s.market);
  }

  /**
   * Print market analysis
   */
  printAnalysis(scoredMarkets: MarketScore[]): void {
    console.log('\n📊 Market Analysis:');
    console.log('─'.repeat(80));

    for (let i = 0; i < Math.min(10, scoredMarkets.length); i++) {
      const { market, score, reasons } = scoredMarkets[i];
      console.log(`\n#${i + 1} [Score: ${score.toFixed(1)}] ${market.question.substring(0, 60)}...`);
      console.log(`   Token ID: ${market.token_id}`);
      for (const reason of reasons) {
        console.log(`   - ${reason}`);
      }
    }

    console.log('\n' + '─'.repeat(80));
  }
}
