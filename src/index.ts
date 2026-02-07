/**
 * Predict.fun Market Maker Bot
 * Main entry point
 */

import { Wallet } from 'ethers';
import { loadConfig, printConfig } from './config.js';
import { PredictAPI } from './api/client.js';
import { MarketSelector } from './market-selector.js';
import { MarketMaker } from './market-maker.js';
import { applyLiquidityRules } from './markets-config.js';
import type { Market, Orderbook } from './types.js';

class PredictMarketMakerBot {
  private api: PredictAPI;
  private marketSelector: MarketSelector;
  private marketMaker: MarketMaker;
  private config: any;
  private wallet: Wallet;
  private running = false;
  private selectedMarkets: Market[] = [];
  private warnedMissingJwt = false;

  private getAccountAddressForQueries(): string {
    return this.config.predictAccountAddress || this.wallet.address;
  }

  constructor() {
    // Load configuration
    this.config = loadConfig();
    printConfig(this.config);

    // Initialize wallet
    this.wallet = new Wallet(this.config.privateKey);
    console.log(`🔐 Wallet: ${this.wallet.address}\n`);
    if (this.config.predictAccountAddress) {
      console.log(`🏦 Predict Account (query target): ${this.config.predictAccountAddress}\n`);
    }

    // Initialize API client
    this.api = new PredictAPI(this.config.apiBaseUrl, this.config.apiKey, this.config.jwtToken);

    // Initialize market selector
    this.marketSelector = new MarketSelector(
      1000, // minLiquidity
      5000, // minVolume24h
      0.10, // maxSpread
      5 // minOrders
    );

    // Initialize market maker
    this.marketMaker = new MarketMaker(this.api, this.config);
  }

  /**
   * Initialize the bot
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Predict.fun Market Maker Bot...\n');

    // Test API connection
    const connected = await this.api.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Predict.fun API');
    }

    // Select markets to trade
    await this.selectMarkets();

    await this.marketMaker.initialize();

    // Update initial state (private endpoint requires JWT)
    if (this.config.jwtToken) {
      await this.marketMaker.updateState(this.getAccountAddressForQueries());
    } else if (!this.warnedMissingJwt) {
      console.log('⚠️  JWT_TOKEN missing, skip orders/positions sync (run: npm run auth:jwt)');
      this.warnedMissingJwt = true;
    }

    console.log('✅ Initialization complete\n');
  }

  /**
   * Select markets to trade
   */
  async selectMarkets(): Promise<void> {
    console.log('🔍 Scanning markets...\n');

    const allMarkets = await this.api.getMarkets();
    console.log(`Found ${allMarkets.length} active markets\n`);

    // Apply manual liquidity activation rules from config
    const marketsWithRules = applyLiquidityRules(allMarkets);
    const rulesApplied = marketsWithRules.filter((m) => m.liquidity_activation?.active).length;
    if (rulesApplied > 0) {
      console.log(`✅ Applied liquidity rules to ${rulesApplied} market(s)\n`);
    }

    // Fetch orderbooks for all markets
    const orderbooks = new Map<string, Orderbook>();
    for (const market of marketsWithRules.slice(0, 50)) {
      // Limit to first 50 for performance
      try {
        const orderbook = await this.api.getOrderbook(market.token_id);
        orderbooks.set(market.token_id, orderbook);

        // Add orderbook data to market
        market.best_bid = orderbook.best_bid;
        market.best_ask = orderbook.best_ask;
        market.spread_pct = orderbook.spread_pct;
        market.total_orders =
          (orderbook.bids?.length || 0) + (orderbook.asks?.length || 0);
      } catch (error) {
        console.error(`Error fetching orderbook for ${market.token_id}:`, error);
      }
    }

    // Score and select markets
    let scoredMarkets = this.marketSelector.selectMarkets(marketsWithRules, orderbooks);

    // Filter by user-specified markets if provided
    if (this.config.marketTokenIds && this.config.marketTokenIds.length > 0) {
      scoredMarkets = scoredMarkets.filter((s) =>
        this.config.marketTokenIds.includes(s.market.token_id)
      );
    }

    // Print analysis
    this.marketSelector.printAnalysis(scoredMarkets);

    // Select top markets
    this.selectedMarkets = this.marketSelector.getTopMarkets(scoredMarkets, 10);

    console.log(`\n✅ Selected ${this.selectedMarkets.length} markets for market making\n`);
  }

  /**
   * Main trading loop
   */
  async run(): Promise<void> {
    this.running = true;

    console.log('🎯 Starting market making loop...\n');

    while (this.running) {
      try {
        // Update state (private endpoint requires JWT)
        if (this.config.jwtToken) {
          await this.marketMaker.updateState(this.getAccountAddressForQueries());
        }

        // Process each market
        for (const market of this.selectedMarkets) {
          try {
            // Fetch latest orderbook
            const orderbook = await this.api.getOrderbook(market.token_id);

            // Place/cancel orders as needed
            await this.marketMaker.placeMMOrders(market, orderbook);
          } catch (error) {
            console.error(`Error processing market ${market.token_id}:`, error);
          }
        }

        // Print status
        this.marketMaker.printStatus();

        // Wait for next iteration
        await this.sleep(this.config.refreshInterval);
      } catch (error) {
        console.error('Error in main loop:', error);
        await this.sleep(this.config.refreshInterval);
      }
    }
  }

  /**
   * Stop the bot
   */
  stop(): void {
    console.log('\n🛑 Stopping bot...');
    this.running = false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const bot = new PredictMarketMakerBot();

  try {
    await bot.initialize();
    await bot.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run
main().catch(console.error);
