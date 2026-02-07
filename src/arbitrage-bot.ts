/**
 * Arbitrage Bot
 * 套利机器人 - 持续扫描并执行套利机会
 */

import { Wallet } from 'ethers';
import { loadConfig } from './config.js';
import { PredictAPI } from './api/client.js';
import { ArbitrageMonitor, ArbitrageExecutor } from './arbitrage/index.js';
import { OrderManager } from './order-manager.js';
import type { Market, Orderbook } from './types.js';
import { CrossPlatformAggregator } from './external/aggregator.js';
import { CrossPlatformExecutionRouter } from './external/execution.js';
import type { PlatformLeg } from './external/types.js';

class ArbitrageBot {
  private api: PredictAPI;
  private monitor: ArbitrageMonitor;
  private executor: ArbitrageExecutor;
  private config: any;
  private wallet: Wallet;
  private orderManager?: OrderManager;
  private crossAggregator?: CrossPlatformAggregator;
  private crossExecutionRouter?: CrossPlatformExecutionRouter;

  constructor() {
    this.config = loadConfig();
    this.wallet = new Wallet(this.config.privateKey);
    this.api = new PredictAPI(this.config.apiBaseUrl, this.config.apiKey, this.config.jwtToken);

    this.monitor = new ArbitrageMonitor({
      scanInterval: 10000,
      minProfitThreshold: this.config.crossPlatformMinProfit || 0.02,
      enableValueMismatch: true,
      enableInPlatform: true,
      enableCrossPlatform: Boolean(this.config.crossPlatformEnabled),
      crossPlatformMinSimilarity: this.config.crossPlatformMinSimilarity || 0.78,
      crossPlatformTransferCost: this.config.crossPlatformTransferCost || 0.002,
      crossPlatformAllowShorting: false,
      crossPlatformUseMapping: Boolean(this.config.crossPlatformUseMapping),
      alertWebhookUrl: this.config.alertWebhookUrl,
      alertMinIntervalMs: this.config.alertMinIntervalMs,
      alertOnNewOpportunity: true,
    }, this.config.crossPlatformEnabled ? new CrossPlatformAggregator(this.config) : undefined);

    this.executor = new ArbitrageExecutor({
      maxPositionSize: this.config.orderSize || 100,
      maxSlippage: 0.01,
      enableAutoExecute: Boolean(this.config.enableTrading),
      requireConfirmation: !this.config.autoConfirmAll,
      autoConfirm: Boolean(this.config.autoConfirmAll),
      crossPlatformAutoExecute: Boolean(this.config.crossPlatformAutoExecute && this.config.enableTrading),
      crossPlatformRequireConfirmation: Boolean(
        (this.config.crossPlatformRequireConfirm ?? true) && !this.config.autoConfirmAll
      ),
      executeLegs: async (legs) => this.executeLegs(legs),
      executeCrossPlatformLegs: async (legs) => this.executeCrossPlatformLegs(legs),
    });

    console.log('🤖 Arbitrage Bot Initialized');
    console.log(`   Wallet: ${this.wallet.address}`);
    console.log(`   Scan Interval: 10s`);
    console.log(`   Min Profit: 2%\n`);
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Arbitrage Bot...\n');

    const connected = await this.api.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Predict.fun API');
    }

    if (this.config.enableTrading) {
      if (!this.config.jwtToken) {
        throw new Error('ENABLE_TRADING=true requires JWT_TOKEN in .env');
      }

      this.orderManager = await OrderManager.create(this.config);
      console.log(`✅ OrderManager initialized (maker: ${this.orderManager.getMakerAddress()})`);
    }

    if (this.config.crossPlatformEnabled) {
      if (!this.orderManager && this.config.enableTrading) {
        throw new Error('Cross-platform execution requires OrderManager initialization');
      }

      if (this.orderManager) {
        this.crossExecutionRouter = new CrossPlatformExecutionRouter(this.config, this.api, this.orderManager);
      }
    }

    console.log('✅ Initialization complete\n');
  }

  async scanOnce(): Promise<void> {
    console.log('🔍 Scanning for arbitrage opportunities...\n');

    const markets = await this.api.getMarkets();
    console.log(`Found ${markets.length} markets\n`);

    const orderbooks = new Map<string, Orderbook>();
    for (const market of markets.slice(0, 80)) {
      try {
        const orderbook = await this.api.getOrderbook(market.token_id);
        orderbooks.set(market.token_id, orderbook);
      } catch {
        // Skip failed orderbooks
      }
    }

    const results = await this.monitor.scanOpportunities(markets, orderbooks);
    this.monitor.printReport(results);
  }

  async startMonitoring(): Promise<void> {
    console.log('🔄 Starting continuous monitoring...\n');

    await this.monitor.startMonitoring(async () => {
      const markets = await this.api.getMarkets();

      const orderbooks = new Map<string, Orderbook>();
      for (const market of markets.slice(0, 80)) {
        try {
          const orderbook = await this.api.getOrderbook(market.token_id);
          orderbooks.set(market.token_id, orderbook);
        } catch {
          // Skip failed orderbooks
        }
      }

      return { markets, orderbooks };
    });
  }

  async executeArbitrage(opportunityType: string, index: number): Promise<void> {
    const markets = await this.api.getMarkets();
    const orderbooks = new Map<string, Orderbook>();

    for (const market of markets.slice(0, 80)) {
      try {
        const orderbook = await this.api.getOrderbook(market.token_id);
        orderbooks.set(market.token_id, orderbook);
      } catch {
        // Skip failed orderbooks
      }
    }

    const results = await this.monitor.scanOpportunities(markets, orderbooks);

    let opportunities: any[] = [];
    switch (opportunityType) {
      case 'value':
        opportunities = results.valueMismatches;
        break;
      case 'intra':
        opportunities = results.inPlatform;
        break;
      case 'cross':
        opportunities = results.crossPlatform;
        break;
    }

    if (index >= opportunities.length) {
      console.log(`❌ Invalid index. Max: ${opportunities.length - 1}`);
      return;
    }

    const opp = opportunities[index];

    switch (opp.type) {
      case 'VALUE_MISMATCH':
        await this.executor.executeValueMismatch(opp);
        break;
      case 'IN_PLATFORM':
        await this.executor.executeInPlatformArbitrage(opp);
        break;
      case 'CROSS_PLATFORM':
        await this.executor.executeCrossPlatformArbitrage(opp);
        break;
    }
  }

  printHistory(): void {
    this.executor.printExecutionReport();
  }

  private async executeLegs(
    legs: { tokenId: string; side: 'BUY' | 'SELL'; shares: number }[]
  ): Promise<void> {
    if (!this.orderManager) {
      throw new Error('OrderManager not initialized');
    }

    for (const leg of legs) {
      if (!leg.tokenId || leg.shares <= 0) {
        continue;
      }

      const market = await this.api.getMarket(leg.tokenId);
      const orderbook = await this.api.getOrderbook(leg.tokenId);

      const payload = await this.orderManager.buildMarketOrderPayload({
        market,
        side: leg.side,
        shares: leg.shares,
        orderbook,
      });

      await this.api.createOrder(payload);
      console.log(`✅ Executed ${leg.side} ${leg.shares} on ${leg.tokenId}`);
    }
  }

  private async executeCrossPlatformLegs(legs: PlatformLeg[]): Promise<void> {
    if (!this.crossExecutionRouter) {
      throw new Error('Cross-platform execution router not initialized');
    }

    const sized = legs.map((leg) => ({
      ...leg,
      shares: leg.shares > 0 ? leg.shares : this.config.orderSize || 50,
    }));

    await this.crossExecutionRouter.execute(sized);
  }
}

async function main() {
  const bot = new ArbitrageBot();

  try {
    await bot.initialize();

    console.log('Running single scan...\n');
    await bot.scanOnce();

    // await bot.startMonitoring();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
