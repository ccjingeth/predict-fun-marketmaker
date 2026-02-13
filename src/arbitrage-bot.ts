/**
 * Arbitrage Bot
 * 套利机器人 - 持续扫描并执行套利机会
 */

import { Wallet } from 'ethers';
import { loadConfig } from './config.js';
import { PredictAPI } from './api/client.js';
import {
  ArbitrageMonitor,
  ArbitrageExecutor,
  InPlatformArbitrageDetector,
  MultiOutcomeArbitrageDetector,
} from './arbitrage/index.js';
import { OrderManager } from './order-manager.js';
import type { Market, Orderbook } from './types.js';
import { CrossPlatformAggregator } from './external/aggregator.js';
import { CrossPlatformExecutionRouter } from './external/execution.js';
import type { PlatformLeg } from './external/types.js';
import { PredictWebSocketFeed } from './external/predict-ws.js';

class ArbitrageBot {
  private api: PredictAPI;
  private monitor: ArbitrageMonitor;
  private executor: ArbitrageExecutor;
  private config: any;
  private wallet: Wallet;
  private orderManager?: OrderManager;
  private crossAggregator?: CrossPlatformAggregator;
  private crossExecutionRouter?: CrossPlatformExecutionRouter;
  private lastExecution: Map<string, number> = new Map();
  private predictWs?: PredictWebSocketFeed;
  private marketsCache: Market[] = [];
  private marketsCacheAt = 0;
  private arbErrorWindowStart = 0;
  private arbErrorCount = 0;
  private arbPausedUntil = 0;
  private wsHealthTimer?: NodeJS.Timeout;

  constructor() {
    this.config = loadConfig();
    this.wallet = new Wallet(this.config.privateKey);
    this.api = new PredictAPI(this.config.apiBaseUrl, this.config.apiKey, this.config.jwtToken);

    this.monitor = new ArbitrageMonitor({
      scanInterval: this.config.arbScanIntervalMs || 10000,
      minProfitThreshold: this.config.crossPlatformMinProfit || 0.02,
      enableValueMismatch: true,
      enableInPlatform: true,
      enableMultiOutcome: Boolean(this.config.multiOutcomeEnabled),
      enableCrossPlatform: Boolean(this.config.crossPlatformEnabled),
      enableDependency: Boolean(this.config.dependencyEnabled),
      multiOutcomeMinOutcomes: this.config.multiOutcomeMinOutcomes || 3,
      multiOutcomeMaxShares: this.config.multiOutcomeMaxShares || 500,
      crossPlatformMinSimilarity: this.config.crossPlatformMinSimilarity || 0.78,
      crossPlatformTransferCost: this.config.crossPlatformTransferCost || 0.002,
      crossPlatformAllowShorting: false,
      crossPlatformUseMapping: Boolean(this.config.crossPlatformUseMapping),
      crossPlatformMaxShares: this.config.crossPlatformMaxShares || 200,
      crossPlatformDepthLevels: this.config.crossPlatformDepthLevels || 10,
      crossPlatformSlippageBps: this.config.crossPlatformSlippageBps || 250,
      predictFeeBps: this.config.predictFeeBps || 100,
      dependencyConstraintsPath: this.config.dependencyConstraintsPath || 'dependency-constraints.json',
      dependencyPythonPath: this.config.dependencyPythonPath || 'python3',
      dependencyPythonScript: this.config.dependencyPythonScript || 'scripts/dependency-arb.py',
      dependencyMinProfit: this.config.dependencyMinProfit || 0.02,
      dependencyMaxLegs: this.config.dependencyMaxLegs || 6,
      dependencyMaxNotional: this.config.dependencyMaxNotional || 200,
      dependencyMinDepth: this.config.dependencyMinDepth || 1,
      dependencyFeeBps: this.config.dependencyFeeBps || 100,
      dependencyFeeCurveRate: this.config.dependencyFeeCurveRate || 0,
      dependencyFeeCurveExponent: this.config.dependencyFeeCurveExponent || 0,
      dependencySlippageBps: this.config.dependencySlippageBps || 20,
      dependencyMaxIter: this.config.dependencyMaxIter || 12,
      dependencyOracleTimeoutSec: this.config.dependencyOracleTimeoutSec || 2,
      dependencyTimeoutMs: this.config.dependencyTimeoutMs || 10000,
      dependencyAllowSells: this.config.dependencyAllowSells !== false,
      alertWebhookUrl: this.config.alertWebhookUrl,
      alertMinIntervalMs: this.config.alertMinIntervalMs,
      alertOnNewOpportunity: true,
      arbDepthUsage: this.config.arbDepthUsage || 0.6,
      arbMinNotionalUsd: this.config.arbMinNotionalUsd || 0,
      arbMinProfitUsd: this.config.arbMinProfitUsd || 0,
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

    if (this.config.arbRequireWs && !this.config.predictWsEnabled) {
      throw new Error('ARB_REQUIRE_WS=true requires PREDICT_WS_ENABLED=true');
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

    if (this.config.predictWsEnabled) {
      this.predictWs = new PredictWebSocketFeed({
        url: this.config.predictWsUrl || 'wss://ws.predict.fun/ws',
        apiKey: this.config.predictWsApiKey || this.config.apiKey,
        topicKey: this.config.predictWsTopicKey || 'token_id',
        reconnectMinMs: 1000,
        reconnectMaxMs: 15000,
        staleTimeoutMs: this.config.predictWsStaleMs,
        resetOnReconnect: this.config.predictWsResetOnReconnect,
      });
      this.predictWs.start();
    }

    this.startWsHealthLogger();

    console.log('✅ Initialization complete\n');
  }

  async scanOnce(): Promise<void> {
    console.log('🔍 Scanning for arbitrage opportunities...\n');

    const markets = await this.getMarketsCached();
    console.log(`Found ${markets.length} markets\n`);

    const sample = markets.slice(0, this.config.arbMaxMarkets || 80);
    const orderbooks = await this.loadOrderbooks(sample);

    const results = await this.monitor.scanOpportunities(markets, orderbooks);
    this.monitor.printReport(results);
  }

  async startMonitoring(): Promise<void> {
    console.log('🔄 Starting continuous monitoring...\n');

    await this.monitor.startMonitoring(
      async () => {
        const markets = await this.getMarketsCached();
        const sample = markets.slice(0, this.config.arbMaxMarkets || 80);
        const orderbooks = await this.loadOrderbooks(sample);
        return { markets, orderbooks };
      },
      this.config.arbAutoExecute ? async (scan) => this.autoExecute(scan) : undefined
    );
  }

  private async autoExecute(scan: {
    valueMismatches: any[];
    inPlatform: any[];
    multiOutcome: any[];
    crossPlatform: any[];
    dependency: any[];
  }): Promise<void> {
    if (this.isArbPaused()) {
      return;
    }

    const markets = await this.getMarketsCached();
    const now = Date.now();
    const cooldown = this.config.arbExecutionCooldownMs || 60000;
    const maxTop = Math.max(1, this.config.arbExecuteTopN || 1);

    const executeOne = async (opp: any) => {
      const key = `${opp.type}-${opp.marketId}`;
      const last = this.lastExecution.get(key) || 0;
      if (now - last < cooldown) {
        return;
      }
      if (this.config.arbPreflightEnabled !== false) {
        const ok = await this.preflightOpportunity(opp, markets);
        if (!ok) {
          console.log(`⚠️ Preflight failed for ${opp.type} ${opp.marketId}, skip execution.`);
          return;
        }
      }
      try {
        switch (opp.type) {
          case 'VALUE_MISMATCH':
            await this.executor.executeValueMismatch(opp);
            break;
          case 'IN_PLATFORM':
            await this.executor.executeInPlatformArbitrage(opp);
            break;
          case 'MULTI_OUTCOME':
            await this.executor.executeMultiOutcomeArbitrage(opp);
            break;
          case 'CROSS_PLATFORM':
            await this.executor.executeCrossPlatformArbitrage(opp);
            break;
          case 'DEPENDENCY':
            await this.executor.executeDependencyArbitrage(opp);
            break;
        }
      } catch (error) {
        this.recordArbError(error);
        return;
      }
      this.lastExecution.set(key, now);
    };

    const buckets = [scan.inPlatform, scan.multiOutcome, scan.crossPlatform, scan.dependency];
    if (this.config.arbAutoExecuteValue) {
      buckets.push(scan.valueMismatches);
    }
    for (const bucket of buckets) {
      if (!bucket || bucket.length === 0) continue;
      const sorted = [...bucket].sort((a, b) => (b.expectedReturn || 0) - (a.expectedReturn || 0));
      for (let i = 0; i < Math.min(maxTop, sorted.length); i++) {
        await executeOne(sorted[i]);
      }
    }
  }

  async executeArbitrage(opportunityType: string, index: number): Promise<void> {
    const markets = await this.getMarketsCached();
    const sample = markets.slice(0, this.config.arbMaxMarkets || 80);
    const orderbooks = await this.loadOrderbooks(sample);

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
      case 'dependency':
        opportunities = results.dependency;
        break;
      case 'multi':
        opportunities = results.multiOutcome;
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
      case 'DEPENDENCY':
        await this.executor.executeDependencyArbitrage(opp);
        break;
      case 'MULTI_OUTCOME':
        await this.executor.executeMultiOutcomeArbitrage(opp);
        break;
    }
  }

  printHistory(): void {
    this.executor.printExecutionReport();
  }

  shouldAutoExecute(): boolean {
    return Boolean(this.config.arbAutoExecute);
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

  private async loadOrderbooks(markets: Market[], maxAgeOverrideMs?: number): Promise<Map<string, Orderbook>> {
    const orderbooks = new Map<string, Orderbook>();
    const limit = Math.max(1, this.config.arbOrderbookConcurrency || 8);
    let index = 0;
    const wsMaxAgeMs = maxAgeOverrideMs ?? this.config.arbWsMaxAgeMs || 10000;

    if (this.predictWs && markets.length > 0) {
      this.predictWs.subscribeMarkets(markets);
    }

    const worker = async () => {
      while (index < markets.length) {
        const market = markets[index++];
        if (this.config.arbRequireWs) {
          if (!this.predictWs) {
            continue;
          }
          const cached = this.predictWs.getOrderbook(market.token_id, wsMaxAgeMs);
          if (cached) {
            orderbooks.set(market.token_id, cached);
          }
          continue;
        }
        if (this.predictWs) {
          const cached = this.predictWs.getOrderbook(market.token_id, wsMaxAgeMs);
          if (cached) {
            orderbooks.set(market.token_id, cached);
            continue;
          }
        }
        try {
          const orderbook = await this.api.getOrderbook(market.token_id);
          orderbooks.set(market.token_id, orderbook);
        } catch {
          // Skip failed orderbooks
        }
      }
    };

    const workers = Array.from({ length: Math.min(limit, markets.length) }, () => worker());
    await Promise.all(workers);
    return orderbooks;
  }

  private async preflightOpportunity(opp: any, markets: Market[]): Promise<boolean> {
    switch (opp.type) {
      case 'IN_PLATFORM':
        return this.preflightInPlatform(opp, markets);
      case 'MULTI_OUTCOME':
        return this.preflightMultiOutcome(opp, markets);
      default:
        return true;
    }
  }

  private async preflightInPlatform(opp: any, markets: Market[]): Promise<boolean> {
    const yesTokenId = opp.yesTokenId;
    const noTokenId = opp.noTokenId;
    if (!yesTokenId || !noTokenId) {
      return true;
    }
    const yesMarket = markets.find((m) => m.token_id === yesTokenId);
    const noMarket = markets.find((m) => m.token_id === noTokenId);
    if (!yesMarket || !noMarket) {
      return false;
    }
    const orderbooks = await this.loadOrderbooks(
      [yesMarket, noMarket],
      this.config.arbPreflightMaxAgeMs || this.config.arbWsMaxAgeMs
    );
    const minProfit = this.config.crossPlatformMinProfit || 0.02;
    const detector = new InPlatformArbitrageDetector(
      minProfit,
      (this.config.predictFeeBps || 0) / 10000,
      false,
      undefined,
      undefined,
      this.config.arbDepthUsage || 0.6,
      this.config.arbMinNotionalUsd || 0,
      this.config.arbMinProfitUsd || 0
    );
    const refreshed = detector.scanMarkets([yesMarket, noMarket], orderbooks);
    if (refreshed.length === 0) {
      return false;
    }
    const minProfitPct = minProfit * 100;
    return refreshed[0].maxProfit >= minProfitPct;
  }

  private async preflightMultiOutcome(opp: any, markets: Market[]): Promise<boolean> {
    const groupKey = opp.marketId;
    if (!groupKey) {
      return true;
    }
    const group = markets.filter((m) => (m.condition_id || m.event_id || m.token_id) === groupKey);
    if (group.length === 0) {
      return false;
    }
    const orderbooks = await this.loadOrderbooks(
      group,
      this.config.arbPreflightMaxAgeMs || this.config.arbWsMaxAgeMs
    );
    const minProfit = this.config.crossPlatformMinProfit || 0.02;
    const detector = new MultiOutcomeArbitrageDetector({
      minProfitThreshold: minProfit,
      minOutcomes: this.config.multiOutcomeMinOutcomes || 3,
      maxRecommendedShares: this.config.multiOutcomeMaxShares || 500,
      feeBps: this.config.predictFeeBps || 100,
      depthUsage: this.config.arbDepthUsage || 0.6,
      minNotionalUsd: this.config.arbMinNotionalUsd || 0,
      minProfitUsd: this.config.arbMinProfitUsd || 0,
    });
    const refreshed = detector.scanMarkets(group, orderbooks);
    if (refreshed.length === 0) {
      return false;
    }
    const minProfitPct = minProfit * 100;
    return (refreshed[0].expectedReturn || 0) >= minProfitPct;
  }

  private async getMarketsCached(): Promise<Market[]> {
    const ttl = this.config.arbMarketsCacheMs || 10000;
    const now = Date.now();
    if (this.marketsCache.length > 0 && now - this.marketsCacheAt < ttl) {
      return this.marketsCache;
    }
    const markets = await this.api.getMarkets();
    this.marketsCache = markets;
    this.marketsCacheAt = now;
    return markets;
  }

  private recordArbError(error: unknown): void {
    console.error('Arb execution error:', error);
    const now = Date.now();
    const windowMs = this.config.arbErrorWindowMs || 60000;
    const maxErrors = this.config.arbMaxErrors || 5;
    if (now - this.arbErrorWindowStart > windowMs) {
      this.arbErrorWindowStart = now;
      this.arbErrorCount = 0;
    }
    this.arbErrorCount += 1;
    if (this.arbErrorCount >= maxErrors) {
      this.arbPausedUntil = now + (this.config.arbPauseOnErrorMs || 60000);
      this.arbErrorCount = 0;
      console.error(`Arb auto-exec paused until ${new Date(this.arbPausedUntil).toISOString()}`);
    }
  }

  private isArbPaused(): boolean {
    return Date.now() < this.arbPausedUntil;
  }

  private startWsHealthLogger(): void {
    const interval = Number(this.config.arbWsHealthLogMs || 0);
    if (!interval || interval <= 0) {
      return;
    }
    if (this.wsHealthTimer) {
      clearInterval(this.wsHealthTimer);
    }
    this.wsHealthTimer = setInterval(() => {
      this.printWsStatus();
    }, interval);
  }

  private printWsStatus(): void {
    const now = Date.now();
    const lines: string[] = [];

    if (this.predictWs) {
      const status = this.predictWs.getStatus();
      lines.push(
        `PredictWS connected=${status.connected} subscribed=${status.subscribed} cache=${status.cacheSize} last=${this.formatAge(now, status.lastMessageAt)} msgs=${status.messageCount}`
      );
    }

    if (this.crossAggregator) {
      const status = this.crossAggregator.getWsStatus();
      if (status.polymarket) {
        lines.push(
          `PolymarketWS connected=${status.polymarket.connected} subscribed=${status.polymarket.subscribed} cache=${status.polymarket.cacheSize} last=${this.formatAge(now, status.polymarket.lastMessageAt)} msgs=${status.polymarket.messageCount}`
        );
      }
      if (status.opinion) {
        lines.push(
          `OpinionWS connected=${status.opinion.connected} subscribed=${status.opinion.subscribed} cache=${status.opinion.cacheSize} last=${this.formatAge(now, status.opinion.lastMessageAt)} msgs=${status.opinion.messageCount}`
        );
      }
    }

    if (lines.length > 0) {
      console.log(`WS Health | ${lines.join(' | ')}`);
    }
  }

  private formatAge(now: number, last: number): string {
    if (!last) {
      return 'n/a';
    }
    const delta = Math.max(0, now - last);
    return `${delta}ms`;
  }
}

async function main() {
  const bot = new ArbitrageBot();

  try {
    await bot.initialize();

    if (bot.shouldAutoExecute()) {
      await bot.startMonitoring();
    } else {
      console.log('Running single scan...\n');
      await bot.scanOnce();
    }
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
