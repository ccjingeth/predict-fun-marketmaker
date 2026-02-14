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
  private wsHealthWarned = false;
  private wsHealthPenaltyUntil = 0;
  private oppStability: Map<string, { count: number; lastSeen: number }> = new Map();
  private wsDirtyTokens: Set<string> = new Set();
  private wsRealtimeTimer?: NodeJS.Timeout;
  private wsRealtimeRunning = false;
  private wsRealtimeUnsub?: () => void;
  private crossRealtimeTimer?: NodeJS.Timeout;
  private crossRealtimeRunning = false;
  private crossRealtimeUnsub?: () => void;
  private crossDirtyTokens: Set<string> = new Set();

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
      crossPlatformDepthUsage: this.config.crossPlatformDepthUsage || 0.5,
      crossPlatformMinNotionalUsd: this.config.crossPlatformMinNotionalUsd || 0,
      crossPlatformMinProfitUsd: this.config.crossPlatformMinProfitUsd || 0,
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
      arbMaxVwapLevels: this.config.arbMaxVwapLevels || 0,
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
    if (this.config.arbWsRealtime && !this.config.predictWsEnabled) {
      throw new Error('ARB_WS_REALTIME=true requires PREDICT_WS_ENABLED=true');
    }
    if (this.config.crossPlatformWsRealtime && !this.config.crossPlatformEnabled) {
      throw new Error('CROSS_PLATFORM_WS_REALTIME=true requires CROSS_PLATFORM_ENABLED=true');
    }
    if (
      this.config.crossPlatformWsRealtime &&
      !this.config.polymarketWsEnabled &&
      !this.config.opinionWsEnabled
    ) {
      throw new Error('CROSS_PLATFORM_WS_REALTIME=true requires POLYMARKET_WS_ENABLED or OPINION_WS_ENABLED');
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
      this.attachRealtimeSubscription();
    }

    this.attachCrossRealtimeSubscription();

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

    this.startRealtimeLoop();
    this.startCrossRealtimeLoop();

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
      if (opp.type === 'CROSS_PLATFORM') {
        if (!this.isCrossWsHealthy(now)) {
          this.warnWsHealth('Cross-platform WS unhealthy, skip auto-exec');
          return;
        }
      } else if (!this.isPredictWsHealthy(now)) {
        this.warnWsHealth('Predict WS unhealthy, skip auto-exec');
        return;
      }
      const key = `${opp.type}-${opp.marketId}`;
      const last = this.lastExecution.get(key) || 0;
      if (now - last < cooldown) {
        return;
      }
      if (!this.isStableOpportunity(opp, now)) {
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
    const wsMaxAgeMs = maxAgeOverrideMs ?? this.config.arbWsMaxAgeMs ?? 10000;

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

  private attachRealtimeSubscription(): void {
    if (!this.predictWs || this.config.arbWsRealtime !== true) {
      return;
    }
    if (this.wsRealtimeUnsub) {
      return;
    }
    this.wsRealtimeUnsub = this.predictWs.onOrderbook((tokenId) => {
      if (tokenId) {
        this.wsDirtyTokens.add(tokenId);
      }
    });
  }

  private attachCrossRealtimeSubscription(): void {
    if (this.config.crossPlatformWsRealtime !== true) {
      return;
    }
    if (!this.crossAggregator) {
      return;
    }
    if (this.crossRealtimeUnsub) {
      return;
    }
    this.crossRealtimeUnsub = this.crossAggregator.onWsOrderbook((platform, tokenId) => {
      if (tokenId) {
        this.crossDirtyTokens.add(`${platform}:${tokenId}`);
      }
    });
  }

  private startRealtimeLoop(): void {
    if (this.config.arbWsRealtime !== true) {
      return;
    }
    if (!this.predictWs) {
      return;
    }
    if (this.wsRealtimeTimer) {
      return;
    }
    const interval = Math.max(100, this.config.arbWsRealtimeIntervalMs || 400);
    this.wsRealtimeTimer = setInterval(() => {
      void this.flushRealtime();
    }, interval);
  }

  private startCrossRealtimeLoop(): void {
    if (this.config.crossPlatformWsRealtime !== true) {
      return;
    }
    if (!this.crossAggregator) {
      return;
    }
    if (this.crossRealtimeTimer) {
      return;
    }
    const interval = Math.max(200, this.config.crossPlatformWsRealtimeIntervalMs || 600);
    this.crossRealtimeTimer = setInterval(() => {
      void this.flushCrossRealtime();
    }, interval);
  }

  private async flushRealtime(): Promise<void> {
    if (this.wsRealtimeRunning) {
      return;
    }
    if (this.wsDirtyTokens.size === 0) {
      return;
    }
    this.wsRealtimeRunning = true;
    try {
      const maxBatch = Math.max(1, this.config.arbWsRealtimeMaxBatch || 40);
      const tokens = Array.from(this.wsDirtyTokens);
      this.wsDirtyTokens.clear();
      const batch = tokens.slice(0, maxBatch);
      if (tokens.length > maxBatch) {
        for (const tokenId of tokens.slice(maxBatch)) {
          this.wsDirtyTokens.add(tokenId);
        }
      }
      const markets = await this.getMarketsCached();
      const subset = this.expandMarketsForTokens(markets, batch);
      if (subset.length === 0) {
        return;
      }
      const orderbooks = await this.loadOrderbooks(subset, this.config.arbWsMaxAgeMs || 10000);
      const results = await this.monitor.scanRealtime(subset, orderbooks);
      if (this.config.arbAutoExecute) {
        await this.autoExecute(results);
      }
      if (this.config.arbWsRealtimeQuiet !== true) {
        this.monitor.printRealtimeReport({
          valueMismatches: results.valueMismatches,
          inPlatform: results.inPlatform,
          multiOutcome: results.multiOutcome,
        });
      }
    } catch (error) {
      console.warn('WS realtime scan failed:', error);
    } finally {
      this.wsRealtimeRunning = false;
    }
  }

  private async flushCrossRealtime(): Promise<void> {
    if (this.crossRealtimeRunning) {
      return;
    }
    if (this.crossDirtyTokens.size === 0) {
      return;
    }
    this.crossRealtimeRunning = true;
    try {
      const maxBatch = Math.max(1, this.config.crossPlatformWsRealtimeMaxBatch || 30);
      const tokens = Array.from(this.crossDirtyTokens);
      this.crossDirtyTokens.clear();
      const batch = tokens.slice(0, maxBatch);
      if (tokens.length > maxBatch) {
        for (const tokenId of tokens.slice(maxBatch)) {
          this.crossDirtyTokens.add(tokenId);
        }
      }
      if (batch.length === 0) {
        return;
      }
      const markets = await this.getMarketsCached();
      const sample = markets.slice(0, this.config.arbMaxMarkets || 80);
      const orderbooks = await this.loadOrderbooks(sample, this.config.arbWsMaxAgeMs || 10000);
      const crossOps = await this.monitor.scanCrossPlatform(sample, orderbooks);
      if (this.config.arbAutoExecute) {
        await this.autoExecute({
          valueMismatches: [],
          inPlatform: [],
          multiOutcome: [],
          crossPlatform: crossOps,
          dependency: [],
        });
      }
      if (this.config.crossPlatformWsRealtimeQuiet !== true) {
        this.monitor.printCrossRealtimeReport(crossOps);
      }
    } catch (error) {
      console.warn('Cross-platform WS realtime scan failed:', error);
    } finally {
      this.crossRealtimeRunning = false;
    }
  }

  private expandMarketsForTokens(markets: Market[], tokens: string[]): Market[] {
    if (tokens.length === 0) {
      return [];
    }
    const tokenSet = new Set(tokens);
    const conditionMap = new Map<string, Market[]>();
    const tokenMap = new Map<string, Market>();

    for (const market of markets) {
      tokenMap.set(market.token_id, market);
      const key = market.condition_id || market.event_id;
      if (key) {
        if (!conditionMap.has(key)) {
          conditionMap.set(key, []);
        }
        conditionMap.get(key)!.push(market);
      }
    }

    const selected = new Map<string, Market>();
    for (const tokenId of tokenSet) {
      const market = tokenMap.get(tokenId);
      if (!market) {
        continue;
      }
      const key = market.condition_id || market.event_id;
      if (key && conditionMap.has(key)) {
        for (const entry of conditionMap.get(key)!) {
          selected.set(entry.token_id, entry);
        }
      } else {
        selected.set(tokenId, market);
      }
    }

    return Array.from(selected.values());
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
      this.config.arbMinProfitUsd || 0,
      this.config.arbMinDepthUsd || 0,
      this.config.arbMaxVwapDeviationBps || 0,
      this.config.arbRecheckDeviationBps || 60,
      this.config.arbMaxVwapLevels || 0
    );
    const refreshed = detector.scanMarkets([yesMarket, noMarket], orderbooks);
    if (refreshed.length === 0) {
      return false;
    }
    const best = refreshed[0];
    const size = Math.max(0, best.recommendedSize || 0);
    const edge = (best.maxProfit || 0) / 100;
    const profitUsd = edge * size;
    const notional = (best.yesPlusNo || best.yesPrice + best.noPrice) * size;
    const impactBps = this.estimateImpactBpsInPlatform(best);
    const required = this.computeDynamicMinProfitUsd(notional, impactBps);
    if (required > 0 && profitUsd < required) {
      return false;
    }
    const minProfitPct = minProfit * 100;
    return best.maxProfit >= minProfitPct;
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
      minDepthUsd: this.config.arbMinDepthUsd || 0,
      maxVwapDeviationBps: this.config.arbMaxVwapDeviationBps || 0,
      recheckDeviationBps: this.config.arbRecheckDeviationBps || 60,
      maxVwapLevels: this.config.arbMaxVwapLevels || 0,
    });
    const refreshed = detector.scanMarkets(group, orderbooks);
    if (refreshed.length === 0) {
      return false;
    }
    const best = refreshed[0];
    const size = Math.max(0, best.positionSize || 0);
    const profitUsd = Math.max(0, (best.guaranteedProfit || 0) * size);
    const notional = Math.max(0, (best.totalCost || 0) * size);
    const impactBps = this.estimateImpactBpsMultiOutcome(best);
    const required = this.computeDynamicMinProfitUsd(notional, impactBps);
    if (required > 0 && profitUsd < required) {
      return false;
    }
    const minProfitPct = minProfit * 100;
    return (best.expectedReturn || 0) >= minProfitPct;
  }

  private computeDynamicMinProfitUsd(notional: number, impactBps: number): number {
    const base = Math.max(0, this.config.arbMinProfitUsd || 0);
    const baseBps = Math.max(0, this.config.arbMinProfitBps || 0);
    const impactMult = Math.max(0, this.config.arbMinProfitImpactMult || 0);
    if (!base && !baseBps && !impactMult) {
      return base;
    }
    const notionalTerm = notional * (baseBps / 10000);
    const impactTerm = notional * (Math.max(0, impactBps) / 10000) * impactMult;
    return base + notionalTerm + impactTerm;
  }

  private estimateImpactBpsInPlatform(arb: any): number {
    const isSell = arb?.action === 'SELL_BOTH';
    const yesRef = isSell ? arb?.yesBid : arb?.yesAsk;
    const noRef = isSell ? arb?.noBid : arb?.noAsk;
    const yesImpact =
      yesRef && arb?.yesPrice ? (Math.abs(arb.yesPrice - yesRef) / yesRef) * 10000 : 0;
    const noImpact = noRef && arb?.noPrice ? (Math.abs(arb.noPrice - noRef) / noRef) * 10000 : 0;
    return Math.max(yesImpact || 0, noImpact || 0);
  }

  private estimateImpactBpsMultiOutcome(opp: any): number {
    const totalCost = Math.max(0, opp?.totalCost || 0);
    const totalSlippage = Math.max(0, opp?.totalSlippage || 0);
    if (totalCost <= 0) {
      return 0;
    }
    return (totalSlippage / totalCost) * 10000;
  }

  private isStableOpportunity(opp: any, now: number): boolean {
    if (this.config.arbStabilityRequired === false) {
      return true;
    }
    const minCount = Math.max(1, this.config.arbStabilityMinCount || 2);
    const windowMs = Math.max(0, this.config.arbStabilityWindowMs || 2000);
    const scanInterval = Math.max(0, this.config.arbScanIntervalMs || 10000);
    const effectiveWindow =
      windowMs > 0 && scanInterval > 0 ? Math.max(windowMs, Math.floor(scanInterval * 1.1)) : windowMs;
    const key = `${opp.type}-${opp.marketId}`;
    const entry = this.oppStability.get(key);

    if (!entry || (effectiveWindow > 0 && now - entry.lastSeen > effectiveWindow)) {
      this.oppStability.set(key, { count: 1, lastSeen: now });
      return minCount <= 1;
    }

    const nextCount = entry.count + 1;
    this.oppStability.set(key, { count: nextCount, lastSeen: now });
    const cleanupWindow = effectiveWindow > 0 ? effectiveWindow : Math.max(1, scanInterval * 3);
    if (this.oppStability.size > 2000) {
      const cutoff = now - cleanupWindow * 3;
      for (const [k, v] of this.oppStability.entries()) {
        if (v.lastSeen < cutoff) {
          this.oppStability.delete(k);
        }
      }
    }
    return nextCount >= minCount;
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

  private isPredictWsHealthy(now: number): boolean {
    if (this.config.arbRequireWsHealth !== true) {
      return true;
    }
    const maxAge = this.getWsHealthMaxAge();
    if (!this.predictWs) {
      return this.config.arbRequireWs !== true;
    }
    const status = this.predictWs.getStatus();
    if (!status.connected) {
      return false;
    }
    if (maxAge > 0 && now - status.lastMessageAt > maxAge) {
      this.applyWsHealthPenalty(now);
      return false;
    }
    return true;
  }

  private isCrossWsHealthy(now: number): boolean {
    if (this.config.arbRequireWsHealth !== true) {
      return true;
    }
    if (!this.config.crossPlatformEnabled) {
      return true;
    }
    if (!this.crossAggregator) {
      return false;
    }
    if (this.config.crossPlatformRequireWs !== true) {
      return true;
    }
    const maxAge = this.getWsHealthMaxAge();
    const status = this.crossAggregator.getWsStatus();
    if (this.config.polymarketWsEnabled) {
      const poly = status.polymarket;
      if (!poly || !poly.connected) {
        this.applyWsHealthPenalty(now);
        return false;
      }
      if (maxAge > 0 && now - poly.lastMessageAt > maxAge) {
        this.applyWsHealthPenalty(now);
        return false;
      }
    }
    if (this.config.opinionWsEnabled) {
      const opn = status.opinion;
      if (!opn || !opn.connected) {
        this.applyWsHealthPenalty(now);
        return false;
      }
      if (maxAge > 0 && now - opn.lastMessageAt > maxAge) {
        this.applyWsHealthPenalty(now);
        return false;
      }
    }
    return true;
  }

  private getWsHealthMaxAge(): number {
    const base = this.config.arbWsHealthMaxAgeMs || this.config.arbWsMaxAgeMs || 0;
    if (!this.wsHealthPenaltyUntil || Date.now() > this.wsHealthPenaltyUntil) {
      return base;
    }
    const bump = Math.max(0, this.config.arbWsHealthFailureBumpMs || 0);
    if (bump <= 0) {
      return base;
    }
    return Math.max(0, base - bump);
  }

  private applyWsHealthPenalty(now: number): void {
    const recovery = Math.max(0, this.config.arbWsHealthRecoveryMs || 0);
    if (recovery <= 0) {
      return;
    }
    this.wsHealthPenaltyUntil = Math.max(this.wsHealthPenaltyUntil, now + recovery);
  }

  private warnWsHealth(message: string): void {
    if (this.wsHealthWarned) {
      return;
    }
    this.wsHealthWarned = true;
    console.log(`⚠️ ${message}`);
    setTimeout(() => {
      this.wsHealthWarned = false;
    }, 5000);
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
