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
import type { PlatformLeg, PlatformMarket } from './external/types.js';
import type { CrossPlatformMappingStore } from './external/mapping.js';
import { PredictWebSocketFeed } from './external/predict-ws.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ActivationManager } from './activation.js';

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
  private lastCrossWsHealthScore = 100;
  private oppStability: Map<string, { count: number; lastSeen: number }> = new Map();
  private wsDirtyTokens: Set<string> = new Set();
  private wsRealtimeTimer?: NodeJS.Timeout;
  private wsRealtimeRunning = false;
  private wsRealtimeUnsub?: () => void;
  private crossRealtimeTimer?: NodeJS.Timeout;
  private crossRealtimeRunning = false;
  private crossRealtimeUnsub?: () => void;
  private crossDirtyTokens: Set<string> = new Set();
  private wsRealtimeIntervalMs = 0;
  private crossRealtimeIntervalMs = 0;
  private wsRealtimeMaxBatch = 0;
  private crossRealtimeMaxBatch = 0;
  private boostBatchActive = false;
  private wsBoostUntil = 0;
  private wsBoostTimer?: NodeJS.Timeout;
  private crossFallbackRunning = false;
  private lastCrossFallbackAt = 0;
  private arbPauseMs = 0;
  private arbDegradeLevel = 0;
  private arbRecheckBumpMs = 0;
  private arbSnapshotPath: string;
  private arbCommandPath: string;
  private arbSnapshotMax: number;
  private lastCommandId = '';

  constructor() {
    this.config = loadConfig();
    this.arbSnapshotPath = this.normalizePath(
      this.config.arbOpportunitiesPath || 'data/arb-opportunities.json'
    );
    this.arbCommandPath = this.normalizePath(this.config.arbCommandPath || 'data/arb-command.json');
    this.arbSnapshotMax = Math.max(1, this.config.arbSnapshotMax || 50);
    this.wallet = new Wallet(this.config.privateKey);
    this.api = new PredictAPI(this.config.apiBaseUrl, this.config.apiKey, this.config.jwtToken);

    this.crossAggregator = this.config.crossPlatformEnabled ? new CrossPlatformAggregator(this.config) : undefined;

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
      crossPlatformMaxVwapLevels: this.config.crossPlatformMaxVwapLevels || 0,
      crossPlatformMaxVwapDeviationBps: this.config.crossPlatformMaxVwapDeviationBps || 0,
      crossPlatformSlippageBps: this.config.crossPlatformSlippageBps || 250,
      crossPlatformDepthUsage: this.config.crossPlatformDepthUsage || 0.5,
      crossPlatformMinDepthShares: this.config.crossPlatformMinDepthShares || 0,
      crossPlatformMinDepthUsd: this.config.crossPlatformMinDepthUsd || 0,
      crossPlatformMinTopDepthShares: this.config.crossPlatformMinTopDepthShares || 0,
      crossPlatformMinTopDepthUsd: this.config.crossPlatformMinTopDepthUsd || 0,
      crossPlatformTopDepthUsage: this.config.crossPlatformTopDepthUsage || 0,
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
      arbDepthLevels: this.config.arbDepthLevels || 0,
      arbMinNotionalUsd: this.config.arbMinNotionalUsd || 0,
      arbMinProfitUsd: this.config.arbMinProfitUsd || 0,
      arbMinTopDepthShares: this.config.arbMinTopDepthShares || 0,
      arbMinTopDepthUsd: this.config.arbMinTopDepthUsd || 0,
      arbTopDepthUsage: this.config.arbTopDepthUsage || 0,
      arbMaxVwapLevels: this.config.arbMaxVwapLevels || 0,
    }, this.crossAggregator);

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

    process.on('SIGUSR1', () => {
      this.applyWsBoost();
    });
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
      !this.config.opinionWsEnabled &&
      !this.config.probableWsEnabled
    ) {
      throw new Error('CROSS_PLATFORM_WS_REALTIME=true requires POLYMARKET_WS_ENABLED, OPINION_WS_ENABLED, or PROBABLE_WS_ENABLED');
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

    await this.ensureArbAssets();

    console.log('✅ Initialization complete\n');
  }

  async scanOnce(): Promise<void> {
    console.log('🔍 Scanning for arbitrage opportunities...\n');

    this.monitor.setMinProfitThreshold(this.getEffectiveMinProfitThreshold());
    const markets = await this.getMarketsCached();
    console.log(`Found ${markets.length} markets\n`);

    const sample = markets.slice(0, this.config.arbMaxMarkets || 80);
    const orderbooks = await this.loadOrderbooks(sample);

    const results = await this.monitor.scanOpportunities(markets, orderbooks);
    this.monitor.printReport(results);
  }

  async startMonitoring(): Promise<void> {
    console.log('🔄 Starting continuous monitoring...\n');

    // 🔑 检查套利模块激活码
    const activation = ActivationManager.checkActivation();
    if (!activation.valid) {
      console.log('\n' + '='.repeat(70));
      console.log('⚠️  套利模块需要激活码才能使用');
      console.log('='.repeat(70));
      console.log('\n📋 功能说明:');
      console.log('   ✅ 做市商模块 - 完全免费，可正常使用');
      console.log('   ❌ 套利模块 - 需要激活码才能使用');
      console.log('\n' + '−'.repeat(70));
      console.log('❌ 错误:', activation.message);
      console.log('\n🔑 如何获取激活码:');
      console.log('   1. 联系管理员获取激活码');
      console.log('   2. 运行激活命令: npm run activate <激活码>');
      console.log('   3. 或使用交互式激活: npm run activate');
      console.log('\n💡 其他命令:');
      console.log('   npm run activate:check  - 查看激活状态');
      console.log('   npm run activate:clear  - 清除激活（测试用）');
      console.log('\n' + '='.repeat(70) + '\n');

      throw new Error(`套利模块未激活: ${activation.message}`);
    }

    // 显示激活信息
    if (activation.info && activation.remainingDays !== undefined) {
      console.log('✅ 套利模块已激活');
      console.log(`   用户: ${activation.info.userName}`);
      console.log(`   有效期至: ${new Date(activation.info.expireDate).toLocaleDateString()}`);
      console.log(`   剩余天数: ${activation.remainingDays} 天\n`);
    }

    this.startRealtimeLoop();
    this.startCrossRealtimeLoop();

    await this.monitor.startMonitoring(
      async () => {
        this.monitor.setMinProfitThreshold(this.getEffectiveMinProfitThreshold());
        const markets = await this.getMarketsCached();
        const sample = markets.slice(0, this.config.arbMaxMarkets || 80);
        const orderbooks = await this.loadOrderbooks(sample);
        return { markets, orderbooks };
      },
      async (scan) => {
        await this.writeArbSnapshot(scan);
        await this.processArbCommand(scan);
        if (this.config.arbAutoExecute) {
          await this.autoExecute(scan);
        }
      }
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
    const baseCooldown = this.config.arbExecutionCooldownMs || 60000;
    const cooldown = this.getEffectiveCooldownMs(baseCooldown);
    const maxTop = this.getEffectiveTopN(Math.max(1, this.config.arbExecuteTopN || 1));

    const executeOne = async (opp: any) => {
      const result = await this.executeOpportunity(opp, markets, {
        bypassCooldown: false,
        bypassStability: false,
        reason: 'auto',
      });
      if (!result.ok && result.message && result.message === 'Preflight failed') {
        console.log(`⚠️ Preflight failed for ${opp.type} ${opp.marketId}, skip execution.`);
      }
    };

    const buckets = [scan.inPlatform, scan.multiOutcome, scan.crossPlatform, scan.dependency];
    if (this.config.arbAutoExecuteValue) {
      buckets.push(scan.valueMismatches);
    }
    for (const bucket of buckets) {
      if (!bucket || bucket.length === 0) continue;
      const sorted = [...bucket].sort((a, b) => this.compareOpportunities(a, b));
      for (let i = 0; i < Math.min(maxTop, sorted.length); i++) {
        await executeOne(sorted[i]);
      }
    }
  }

  private estimateOpportunityProfitUsd(opp: any): number {
    const size = Math.max(0, opp?.positionSize ?? opp?.recommendedSize ?? opp?.depthShares ?? 0);
    const expectedReturn = Math.max(0, opp?.expectedReturn ?? 0);
    const arbitrageProfit = Math.max(0, opp?.arbitrageProfit ?? 0);
    if (Number.isFinite(opp?.guaranteedProfit)) {
      return Math.max(0, Number(opp.guaranteedProfit));
    }
    if (size > 0) {
      const pct = expectedReturn || arbitrageProfit;
      if (pct > 0) {
        return (pct / 100) * size;
      }
    }
    return expectedReturn;
  }

  private compareOpportunities(a: any, b: any): number {
    const profitA = this.estimateOpportunityProfitUsd(a);
    const profitB = this.estimateOpportunityProfitUsd(b);
    if (profitA !== profitB) {
      return profitB - profitA;
    }
    const retA = Math.max(0, a?.expectedReturn ?? 0);
    const retB = Math.max(0, b?.expectedReturn ?? 0);
    return retB - retA;
  }

  async executeArbitrage(opportunityType: string, index: number): Promise<void> {
    const markets = await this.getMarketsCached();
    const sample = markets.slice(0, this.config.arbMaxMarkets || 80);
    const orderbooks = await this.loadOrderbooks(sample);

    this.monitor.setMinProfitThreshold(this.getEffectiveMinProfitThreshold());
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

    if (opp?.type === 'CROSS_PLATFORM' && this.config.arbPreflightEnabled !== false) {
      if (!this.crossExecutionRouter) {
        console.log('⚠️ Cross-platform preflight skipped: router not initialized');
      } else if (Array.isArray(opp?.legs) && opp.legs.length > 0) {
        const normalized = opp.legs
          .filter((leg: any) => leg && leg.tokenId && leg.platform && leg.side && leg.shares > 0)
          .map((leg: any) => ({
            platform: leg.platform,
            tokenId: leg.tokenId,
            side: leg.side,
            price: leg.price,
            shares: leg.shares,
            outcome: leg.outcome,
          }));
        if (normalized.length > 0) {
          const result = await this.crossExecutionRouter.preflightOnly(normalized);
          if (!result.ok) {
            console.log(`⚠️ Cross-platform preflight failed: ${result.reason || 'unknown'}`);
            return;
          }
        }
      }
    }

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

  private normalizePath(filePath: string): string {
    if (!filePath) {
      return filePath;
    }
    return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  }

  private async ensureArbAssets(): Promise<void> {
    const paths = [this.arbSnapshotPath, this.arbCommandPath].filter(Boolean);
    for (const filePath of paths) {
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        if (!filePath) continue;
        if (!(await this.fileExists(filePath))) {
          const payload =
            filePath === this.arbSnapshotPath
              ? { ts: 0, items: [] }
              : { status: 'IDLE', ts: 0 };
          await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
        }
      } catch (error) {
        console.warn('⚠️ Failed to prepare arb asset:', filePath, error);
      }
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private buildFingerprint(opp: any): string {
    const legs = Array.isArray(opp?.legs)
      ? opp.legs
          .map((leg: any) => `${leg?.platform || ''}:${leg?.tokenId || ''}:${leg?.side || ''}`)
          .filter(Boolean)
          .join(',')
      : '';
    return [
      opp?.type,
      opp?.marketId,
      opp?.yesTokenId,
      opp?.noTokenId,
      opp?.platformA,
      opp?.platformB,
      opp?.recommendedAction,
      opp?.marketQuestion,
      legs,
    ]
      .filter(Boolean)
      .join('|');
  }

  private buildSnapshotItems(scan: {
    valueMismatches: any[];
    inPlatform: any[];
    multiOutcome: any[];
    crossPlatform: any[];
    dependency: any[];
  }): any[] {
    const items: any[] = [];
    const push = (list: any[], typeKey: string) => {
      if (!Array.isArray(list)) return;
      list.forEach((opp, index) => {
        items.push({
          id: `${typeKey}-${opp.marketId || index}`,
          typeKey,
          type: opp.type,
          index,
          fingerprint: this.buildFingerprint(opp),
          marketId: opp.marketId,
          marketQuestion: opp.marketQuestion,
          expectedReturn: opp.expectedReturn,
          guaranteedProfit: opp.guaranteedProfit,
          positionSize: opp.positionSize ?? opp.recommendedSize ?? opp.depthShares,
          edge: opp.edge ?? opp.arbitrageProfit,
          spread: opp.spread,
          perShareCost: opp.perShareCost ?? opp.totalCost,
          perShareProceeds: opp.perShareProceeds,
          totalCostUsd: opp.totalCostUsd,
          totalProceedsUsd: opp.totalProceedsUsd,
          feesPerShare: opp.feesPerShare ?? opp.totalFees,
          slippagePerShare: opp.slippagePerShare ?? opp.totalSlippage,
          vwapYes: opp.vwapYes,
          vwapNo: opp.vwapNo,
          vwapLevels: opp.vwapLevels,
          vwapDeviationBps: opp.vwapDeviationBps,
          yesTokenId: opp.yesTokenId,
          noTokenId: opp.noTokenId,
          platformA: opp.platformA,
          platformB: opp.platformB,
          recommendedAction: opp.recommendedAction,
          riskLevel: opp.riskLevel,
          legs: opp.legs,
          timestamp: opp.timestamp,
          profitUsd: this.estimateOpportunityProfitUsd(opp),
        });
      });
    };

    push(scan.valueMismatches, 'value');
    push(scan.inPlatform, 'intra');
    push(scan.multiOutcome, 'multi');
    push(scan.crossPlatform, 'cross');
    push(scan.dependency, 'dependency');

    return items.sort((a, b) => (b.profitUsd || 0) - (a.profitUsd || 0));
  }

  private async writeArbSnapshot(scan: {
    valueMismatches: any[];
    inPlatform: any[];
    multiOutcome: any[];
    crossPlatform: any[];
    dependency: any[];
  }): Promise<void> {
    if (!this.arbSnapshotPath) {
      return;
    }
    try {
      const items = this.buildSnapshotItems(scan).slice(0, this.arbSnapshotMax);
      const payload = {
        ts: Date.now(),
        counts: {
          value: scan.valueMismatches?.length || 0,
          intra: scan.inPlatform?.length || 0,
          multi: scan.multiOutcome?.length || 0,
          cross: scan.crossPlatform?.length || 0,
          dependency: scan.dependency?.length || 0,
        },
        items,
      };
      await fs.mkdir(path.dirname(this.arbSnapshotPath), { recursive: true });
      await fs.writeFile(this.arbSnapshotPath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (error) {
      console.warn('⚠️ Failed to write arb snapshot:', error);
    }
  }

  private async processArbCommand(scan: {
    valueMismatches: any[];
    inPlatform: any[];
    multiOutcome: any[];
    crossPlatform: any[];
    dependency: any[];
  }): Promise<void> {
    if (!this.arbCommandPath) {
      return;
    }
    let raw: string | null = null;
    try {
      if (!(await this.fileExists(this.arbCommandPath))) {
        return;
      }
      raw = await fs.readFile(this.arbCommandPath, 'utf8');
    } catch {
      return;
    }
    if (!raw) {
      return;
    }
    let command: any = null;
    try {
      command = JSON.parse(raw);
    } catch {
      return;
    }
    if (!command || command.status !== 'PENDING') {
      return;
    }
    if (this.lastCommandId && command.id === this.lastCommandId) {
      return;
    }

    command.status = 'RUNNING';
    command.startedAt = Date.now();
    await fs.writeFile(this.arbCommandPath, JSON.stringify(command, null, 2), 'utf8');

    const list = this.resolveOpportunitiesByKey(scan, command.typeKey || command.type);
    let target: any = null;
    if (command.fingerprint) {
      target = list.find((opp) => this.buildFingerprint(opp) === command.fingerprint);
    }
    if (!target && typeof command.index === 'number') {
      target = list[command.index];
    }
    if (!target) {
      command.status = 'NOT_FOUND';
      command.completedAt = Date.now();
      command.message = 'Opportunity not found in latest scan';
      await fs.writeFile(this.arbCommandPath, JSON.stringify(command, null, 2), 'utf8');
      return;
    }

    const markets = await this.getMarketsCached();
    const result = await this.executeOpportunity(target, markets, {
      bypassCooldown: true,
      bypassStability: true,
      reason: 'manual',
    });

    command.status = result.ok ? 'DONE' : 'FAILED';
    command.completedAt = Date.now();
    command.message = result.message || (result.ok ? 'Executed' : 'Execution failed');
    command.executed = result.ok === true;
    command.marketId = target.marketId;
    command.type = target.type;
    await fs.writeFile(this.arbCommandPath, JSON.stringify(command, null, 2), 'utf8');
    this.lastCommandId = command.id || '';
  }

  private resolveOpportunitiesByKey(scan: any, key?: string): any[] {
    const normalized = String(key || '').toLowerCase();
    switch (normalized) {
      case 'value':
      case 'value_mismatch':
      case 'value-mismatch':
        return scan.valueMismatches || [];
      case 'intra':
      case 'in_platform':
      case 'in-platform':
        return scan.inPlatform || [];
      case 'cross':
      case 'cross_platform':
      case 'cross-platform':
        return scan.crossPlatform || [];
      case 'dependency':
        return scan.dependency || [];
      case 'multi':
      case 'multi_outcome':
      case 'multi-outcome':
        return scan.multiOutcome || [];
      default:
        return [];
    }
  }

  private async executeOpportunity(
    opp: any,
    markets: Market[],
    options: { bypassCooldown?: boolean; bypassStability?: boolean; reason?: 'auto' | 'manual' }
  ): Promise<{ ok: boolean; message?: string }> {
    const now = Date.now();
    if (opp.type === 'CROSS_PLATFORM') {
      if (!this.isCrossWsHealthy(now)) {
        this.warnWsHealth('Cross-platform WS unhealthy, skip execution');
        return { ok: false, message: 'Cross-platform WS unhealthy' };
      }
    } else if (!this.isPredictWsHealthy(now)) {
      this.warnWsHealth('Predict WS unhealthy, skip execution');
      return { ok: false, message: 'Predict WS unhealthy' };
    }

    const key = `${opp.type}-${opp.marketId}`;
    if (!options.bypassCooldown) {
      const last = this.lastExecution.get(key) || 0;
      const baseCooldown = this.config.arbExecutionCooldownMs || 60000;
      const cooldown = this.getEffectiveCooldownMs(baseCooldown);
      if (now - last < cooldown) {
        return { ok: false, message: 'Cooldown active' };
      }
    }

    if (!options.bypassStability && !this.isStableOpportunity(opp, now)) {
      return { ok: false, message: 'Opportunity unstable' };
    }

    if (this.config.arbPreflightEnabled !== false) {
      const ok = await this.preflightOpportunity(opp, markets);
      if (!ok) {
        const base = Math.max(0, this.config.arbRecheckMs || 0);
        const bump = Math.max(0, this.arbRecheckBumpMs || 0);
        const maxBump = Math.max(0, this.config.arbRecheckBumpMaxMs || 0);
        const effective = Math.max(0, base + Math.min(bump, maxBump || bump));
        if (effective > base) {
          this.arbRecheckBumpMs = effective - base;
        }
        return { ok: false, message: 'Preflight failed' };
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
    } catch (error: any) {
      this.recordArbError(error);
      return { ok: false, message: error?.message || 'Execution failed' };
    }

    this.recordArbSuccess();
    this.lastExecution.set(key, now);
    return { ok: true };
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

    this.crossExecutionRouter.setWsHealthScore(this.lastCrossWsHealthScore);
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
    this.wsRealtimeIntervalMs = interval;
    this.wsRealtimeMaxBatch = Math.max(1, this.config.arbWsRealtimeMaxBatch || 40);
    this.restartRealtimeLoop(interval);
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
    this.crossRealtimeIntervalMs = interval;
    this.crossRealtimeMaxBatch = Math.max(1, this.config.crossPlatformWsRealtimeMaxBatch || 30);
    this.restartCrossRealtimeLoop(interval);
  }

  private restartRealtimeLoop(interval: number): void {
    if (this.wsRealtimeTimer) {
      clearInterval(this.wsRealtimeTimer);
    }
    this.wsRealtimeTimer = setInterval(() => {
      void this.flushRealtime();
    }, interval);
  }

  private restartCrossRealtimeLoop(interval: number): void {
    if (this.crossRealtimeTimer) {
      clearInterval(this.crossRealtimeTimer);
    }
    this.crossRealtimeTimer = setInterval(() => {
      void this.flushCrossRealtime();
    }, interval);
  }

  private applyWsBoost(): void {
    const now = Date.now();
    const arbBoostMs = Math.max(0, this.config.arbWsBoostMs || 0);
    const crossBoostMs = Math.max(0, this.config.crossPlatformWsBoostMs || 0);
    const boostMs = Math.max(arbBoostMs, crossBoostMs);
    if (boostMs <= 0) {
      return;
    }
    this.wsBoostUntil = Math.max(this.wsBoostUntil, now + boostMs);
    this.boostBatchActive = true;
    if (this.config.arbWsRealtime === true && this.wsRealtimeIntervalMs > 0) {
      const fastInterval = Math.max(80, this.config.arbWsBoostIntervalMs || 150);
      this.restartRealtimeLoop(fastInterval);
      void this.flushRealtime();
    }
    if (this.config.crossPlatformWsRealtime === true && this.crossRealtimeIntervalMs > 0) {
      const fastInterval = Math.max(120, this.config.crossPlatformWsBoostIntervalMs || 250);
      this.restartCrossRealtimeLoop(fastInterval);
      void this.flushCrossRealtime();
    }
    if (this.wsBoostTimer) {
      clearTimeout(this.wsBoostTimer);
    }
    this.wsBoostTimer = setTimeout(() => {
      const nowRestore = Date.now();
      if (nowRestore < this.wsBoostUntil) {
        this.applyWsBoost();
        return;
      }
      this.boostBatchActive = false;
      if (this.config.arbWsRealtime === true && this.wsRealtimeIntervalMs > 0) {
        this.restartRealtimeLoop(this.wsRealtimeIntervalMs);
      }
      if (this.config.crossPlatformWsRealtime === true && this.crossRealtimeIntervalMs > 0) {
        this.restartCrossRealtimeLoop(this.crossRealtimeIntervalMs);
      }
    }, boostMs + 50);
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
      const maxBatch = Math.max(
        1,
        this.boostBatchActive ? this.config.arbWsBoostMaxBatch || 80 : this.wsRealtimeMaxBatch || 40
      );
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
    const now = Date.now();
    const wsStale = this.isCrossWsStale(now);
    if (this.crossDirtyTokens.size === 0) {
      if (this.shouldRunCrossFallback(now, wsStale)) {
        await this.runCrossFallback(now, wsStale);
      }
      return;
    }
    if (wsStale && this.shouldRunCrossFallback(now, true)) {
      this.crossDirtyTokens.clear();
      await this.runCrossFallback(now, true);
      return;
    }
    this.crossRealtimeRunning = true;
    try {
      const maxBatch = Math.max(
        1,
        this.boostBatchActive ? this.config.crossPlatformWsBoostMaxBatch || 60 : this.crossRealtimeMaxBatch || 30
      );
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
      if (!this.crossAggregator) {
        return;
      }
      const markets = await this.getMarketsCached();
      const sample = markets.slice(0, this.config.arbMaxMarkets || 80);
      const orderbooks = await this.loadOrderbooks(sample, this.config.arbWsMaxAgeMs || 10000);
      const platformMarkets = await this.crossAggregator.getPlatformMarkets(sample, orderbooks);
      const dirtyMap = this.buildCrossDirtyMap(batch);
      const mappingStore = this.crossAggregator.getMappingStore();
      const filtered = this.filterCrossPlatformMarkets(
        platformMarkets,
        dirtyMap,
        mappingStore,
        this.config.crossPlatformUseMapping !== false
      );
      const crossOps = await this.monitor.scanCrossPlatformWithPlatforms(filtered);
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

  private buildCrossDirtyMap(entries: string[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const entry of entries) {
      if (!entry) continue;
      const idx = entry.indexOf(':');
      if (idx <= 0) continue;
      const platform = entry.slice(0, idx);
      const tokenId = entry.slice(idx + 1);
      if (!platform || !tokenId) continue;
      if (!map.has(platform)) {
        map.set(platform, new Set());
      }
      map.get(platform)!.add(tokenId);
    }
    return map;
  }

  private filterCrossPlatformMarkets(
    platformMarkets: Map<string, PlatformMarket[]>,
    dirtyMap: Map<string, Set<string>>,
    mappingStore?: CrossPlatformMappingStore,
    useMapping: boolean = true
  ): Map<string, PlatformMarket[]> {
    if (!dirtyMap || dirtyMap.size === 0) {
      return platformMarkets;
    }
    const filtered = new Map<string, PlatformMarket[]>();
    for (const [platform, markets] of platformMarkets.entries()) {
      if (platform === 'Predict') {
        if (useMapping && mappingStore) {
          const candidates: PlatformMarket[] = [];
          const seen = new Set<string>();
          for (const [extPlatform, tokenIds] of dirtyMap.entries()) {
            if (extPlatform === 'Predict') continue;
            const matched = mappingStore.filterPredictMarketsByExternalTokens(extPlatform, tokenIds, markets);
            for (const market of matched) {
              const key = market.marketId || market.question;
              if (!key || seen.has(key)) continue;
              seen.add(key);
              candidates.push(market);
            }
          }
          if (candidates.length > 0) {
            filtered.set(platform, candidates);
          } else {
            filtered.set(platform, markets);
          }
          continue;
        }
        filtered.set(platform, markets);
        continue;
      }
      const tokens = dirtyMap.get(platform);
      if (!tokens || tokens.size === 0) {
        filtered.set(platform, []);
        continue;
      }
      const subset = markets.filter((market) => {
        const yes = market.yesTokenId;
        const no = market.noTokenId;
        const marketId = market.marketId;
        return (yes && tokens.has(yes)) || (no && tokens.has(no)) || (marketId && tokens.has(marketId));
      });
      filtered.set(platform, subset);
    }
    return filtered;
  }

  private shouldRunCrossFallback(now: number, wsStale: boolean): boolean {
    if (!this.config.crossPlatformWsRealtimeFallbackEnabled) {
      return false;
    }
    if (!wsStale && this.crossDirtyTokens.size > 0) {
      return false;
    }
    const interval = Math.max(500, this.config.crossPlatformWsRealtimeFallbackIntervalMs || 5000);
    return now - this.lastCrossFallbackAt >= interval;
  }

  private isCrossWsStale(now: number): boolean {
    if (!this.crossAggregator) {
      return true;
    }
    const status = this.crossAggregator.getWsStatus();
    const staleMs = Math.max(1000, this.config.crossPlatformWsRealtimeFallbackStaleMs || 12000);
    const checks: Array<{ enabled: boolean; status?: { connected: boolean; lastMessageAt: number } }> = [
      { enabled: this.config.polymarketWsEnabled === true, status: status.polymarket },
      { enabled: this.config.opinionWsEnabled === true, status: status.opinion },
    ];
    for (const check of checks) {
      if (!check.enabled) continue;
      const s = check.status;
      if (!s || !s.connected) {
        return true;
      }
      if (!s.lastMessageAt || now - s.lastMessageAt > staleMs) {
        return true;
      }
    }
    return false;
  }

  private async runCrossFallback(now: number, wsStale: boolean): Promise<void> {
    if (this.crossFallbackRunning) {
      return;
    }
    if (!this.crossAggregator) {
      return;
    }
    this.crossFallbackRunning = true;
    try {
      const markets = await this.getMarketsCached();
      const fallbackMax = Math.max(10, this.config.crossPlatformWsRealtimeFallbackMaxMarkets || this.config.arbMaxMarkets || 80);
      const sample = markets.slice(0, fallbackMax);
      const orderbooks = await this.loadOrderbooks(sample, this.config.arbWsMaxAgeMs || 10000);
      const crossOps = await this.monitor.scanCrossPlatform(sample, orderbooks);
      this.lastCrossFallbackAt = now;
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
        if (wsStale) {
          console.log('⚠️ Cross-platform WS stale, fallback scan executed.');
        }
        this.monitor.printCrossRealtimeReport(crossOps);
      }
    } catch (error) {
      console.warn('Cross-platform fallback scan failed:', error);
    } finally {
      this.crossFallbackRunning = false;
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
      case 'CROSS_PLATFORM':
        return this.preflightCrossPlatform(opp);
      default:
        return true;
    }
  }

  private async preflightCrossPlatform(opp: any): Promise<boolean> {
    if (!this.crossExecutionRouter) {
      return true;
    }
    const legs: any[] = Array.isArray(opp?.legs) ? opp.legs : [];
    const normalized = legs
      .filter((leg: any) => leg && leg.tokenId && leg.platform && leg.side && leg.shares > 0)
      .map((leg: any) => ({
        platform: leg.platform,
        tokenId: leg.tokenId,
        side: leg.side,
        price: leg.price,
        shares: leg.shares,
        outcome: leg.outcome,
      }));
    if (normalized.length === 0) {
      return true;
    }
    const result = await this.crossExecutionRouter.preflightOnly(normalized);
    if (!result.ok) {
      console.log(`⚠️ Cross-platform preflight failed: ${result.reason || 'unknown'}`);
      return false;
    }
    return true;
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
    const baseMinProfit = this.config.crossPlatformMinProfit || 0.02;
    const profitMult = this.getEffectiveProfitMultiplier();
    const minProfit = baseMinProfit * profitMult;
    const detector = new InPlatformArbitrageDetector(
      minProfit,
      (this.config.predictFeeBps || 0) / 10000,
      false,
      undefined,
      undefined,
      this.getEffectiveDepthUsage(this.config.arbDepthUsage || 0.6),
      this.config.arbMinNotionalUsd || 0,
      this.config.arbMinProfitUsd || 0,
      this.config.arbMinDepthUsd || 0,
      this.config.arbMinTopDepthShares || 0,
      this.config.arbMinTopDepthUsd || 0,
      this.config.arbTopDepthUsage || 0,
      this.config.arbMaxVwapDeviationBps || 0,
      this.getEffectiveRecheckDeviationBps(),
      this.config.arbMaxVwapLevels || 0,
      this.config.arbDepthLevels || 0
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
    const required = this.computeDynamicMinProfitUsd(notional, impactBps, profitMult);
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
    const baseMinProfit = this.config.crossPlatformMinProfit || 0.02;
    const profitMult = this.getEffectiveProfitMultiplier();
    const minProfit = baseMinProfit * profitMult;
    const detector = new MultiOutcomeArbitrageDetector({
      minProfitThreshold: minProfit,
      minOutcomes: this.config.multiOutcomeMinOutcomes || 3,
      maxRecommendedShares: this.config.multiOutcomeMaxShares || 500,
      feeBps: this.config.predictFeeBps || 100,
      depthUsage: this.getEffectiveDepthUsage(this.config.arbDepthUsage || 0.6),
      depthLevels: this.config.arbDepthLevels || 0,
      minNotionalUsd: this.config.arbMinNotionalUsd || 0,
      minProfitUsd: this.config.arbMinProfitUsd || 0,
      minDepthUsd: this.config.arbMinDepthUsd || 0,
      minTopDepthShares: this.config.arbMinTopDepthShares || 0,
      minTopDepthUsd: this.config.arbMinTopDepthUsd || 0,
      topDepthUsage: this.config.arbTopDepthUsage || 0,
      maxVwapDeviationBps: this.config.arbMaxVwapDeviationBps || 0,
      recheckDeviationBps: this.getEffectiveRecheckDeviationBps(),
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
    const required = this.computeDynamicMinProfitUsd(notional, impactBps, profitMult);
    if (required > 0 && profitUsd < required) {
      return false;
    }
    const minProfitPct = minProfit * 100;
    return (best.expectedReturn || 0) >= minProfitPct;
  }

  private computeDynamicMinProfitUsd(notional: number, impactBps: number, multiplier: number = 1): number {
    const base = Math.max(0, this.config.arbMinProfitUsd || 0);
    const baseBps = Math.max(0, this.config.arbMinProfitBps || 0);
    const impactMult = Math.max(0, this.config.arbMinProfitImpactMult || 0);
    if (!base && !baseBps && !impactMult) {
      return base;
    }
    const notionalTerm = notional * (baseBps / 10000);
    const impactTerm = notional * (Math.max(0, impactBps) / 10000) * impactMult;
    const safeMult = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
    return (base + notionalTerm + impactTerm) * safeMult;
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
    const minCount = this.getEffectiveStabilityCount();
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

  private getEffectiveStabilityCount(): number {
    const base = Math.max(1, this.config.arbStabilityMinCount || 2);
    const extra = Math.max(0, this.config.arbDegradeStabilityAdd || 0);
    return base + this.arbDegradeLevel * extra;
  }

  private getArbDegradeFactor(): number {
    const factor = Math.max(0.4, Math.min(0.95, this.config.arbDegradeFactor || 0.7));
    return Math.pow(factor, this.arbDegradeLevel);
  }

  private getEffectiveCooldownMs(base: number): number {
    const factor = this.getArbDegradeFactor();
    return Math.max(0, Math.round(base / Math.max(0.05, factor)));
  }

  private getEffectiveDepthUsage(base: number): number {
    const factor = this.getArbDegradeFactor();
    return Math.max(0.05, Math.min(1, base * factor));
  }

  private getEffectiveTopN(base: number): number {
    const factor = this.getArbDegradeFactor();
    const minTop = Math.max(1, this.config.arbDegradeTopNMin || 1);
    return Math.max(minTop, Math.floor(base * factor));
  }

  private getDegradeProfitMultiplier(): number {
    const factor = this.getArbDegradeFactor();
    return Math.max(1, 1 / Math.max(0.05, factor));
  }

  private getWsBoostProfitMultiplier(): number {
    const now = Date.now();
    if (this.wsBoostUntil <= now) {
      return 1;
    }
    const arbMult = Number.isFinite(this.config.arbWsBoostProfitMult)
      ? this.config.arbWsBoostProfitMult
      : 0.85;
    const crossMult = Number.isFinite(this.config.crossPlatformWsBoostProfitMult)
      ? this.config.crossPlatformWsBoostProfitMult
      : 0.9;
    const mult = Math.min(arbMult, crossMult);
    return Math.max(0.1, Math.min(1, mult));
  }

  private getEffectiveProfitMultiplier(): number {
    const degrade = this.getDegradeProfitMultiplier();
    const boost = this.getWsBoostProfitMultiplier();
    return Math.max(0, degrade * boost);
  }

  private getEffectiveMinProfitThreshold(): number {
    const base = Math.max(0, this.config.crossPlatformMinProfit || 0.02);
    return base * this.getEffectiveProfitMultiplier();
  }

  private getEffectiveRecheckDeviationBps(): number {
    const base = Math.max(0, this.config.arbRecheckDeviationBps || 0);
    if (!base) {
      return base;
    }
    const factor = this.getDegradeProfitMultiplier();
    return Math.round(base * factor);
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
      const base = this.config.arbPauseOnErrorMs || 60000;
      if (!this.arbPauseMs || this.arbPauseMs <= 0) {
        this.arbPauseMs = base;
      }
      const pauseMs = Math.max(base, this.arbPauseMs);
      this.arbPausedUntil = now + pauseMs;
      const backoff = Math.max(1, this.config.arbPauseBackoff || 1.5);
      const maxPause = Math.max(pauseMs, this.config.arbPauseMaxMs || pauseMs);
      this.arbPauseMs = Math.min(maxPause, Math.round(pauseMs * backoff));
      this.arbErrorCount = 0;
      console.error(`Arb auto-exec paused until ${new Date(this.arbPausedUntil).toISOString()}`);
    }
    const maxLevel = Math.max(0, this.config.arbDegradeMaxLevel || 3);
    if (maxLevel > 0) {
      this.arbDegradeLevel = Math.min(maxLevel, this.arbDegradeLevel + 1);
    }
    const bump = Math.max(0, this.config.arbRecheckBumpMs || 0);
    if (bump > 0) {
      const maxBump = Math.max(bump, this.config.arbRecheckBumpMaxMs || bump * 5);
      this.arbRecheckBumpMs = Math.min(maxBump, this.arbRecheckBumpMs + bump);
    }
  }

  private recordArbSuccess(): void {
    const base = this.config.arbPauseOnErrorMs || 60000;
    if (!this.arbPauseMs || this.arbPauseMs <= 0) {
      // still allow recheck bump recovery
    }
    const recovery = this.config.arbPauseRecoveryFactor ?? 0.8;
    if (recovery <= 0 || recovery >= 1) {
      return;
    }
    if (this.arbPauseMs > 0) {
      const next = Math.max(base, Math.round(this.arbPauseMs * recovery));
      this.arbPauseMs = next;
    }
    if (this.arbDegradeLevel > 0) {
      this.arbDegradeLevel -= 1;
    }
    const recheckRecovery = this.config.arbRecheckBumpRecover ?? 0.8;
    if (this.arbRecheckBumpMs > 0 && recheckRecovery > 0 && recheckRecovery < 1) {
      this.arbRecheckBumpMs = Math.max(0, Math.round(this.arbRecheckBumpMs * recheckRecovery));
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
    const minScore = Math.max(0, this.config.arbWsHealthScoreMin || 0);
    if (minScore > 0) {
      const score = this.calcWsHealthScore(status.lastMessageAt, maxAge, now);
      if (score < minScore) {
        this.applyWsHealthPenalty(now);
        return false;
      }
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
    const minScore = Math.max(0, this.config.arbWsHealthScoreMin || 0);
    const scores: number[] = [];
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
      scores.push(this.calcWsHealthScore(poly.lastMessageAt, maxAge, now));
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
      scores.push(this.calcWsHealthScore(opn.lastMessageAt, maxAge, now));
    }
    if (scores.length > 0) {
      const score = Math.min(...scores);
      this.lastCrossWsHealthScore = score;
      if (minScore > 0 && score < minScore) {
        this.applyWsHealthPenalty(now);
        return false;
      }
    } else {
      this.lastCrossWsHealthScore = 100;
    }
    return true;
  }

  private calcWsHealthScore(lastMessageAt: number, maxAge: number, now: number): number {
    if (!maxAge || maxAge <= 0) {
      return 100;
    }
    const age = Math.max(0, now - lastMessageAt);
    const ratio = Math.min(1, age / maxAge);
    return Math.max(0, Math.round((1 - ratio) * 100));
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
      const score = this.calcWsHealthScore(status.lastMessageAt, this.getWsHealthMaxAge(), now);
      lines.push(
        `PredictWS connected=${status.connected} subscribed=${status.subscribed} cache=${status.cacheSize} last=${this.formatAge(now, status.lastMessageAt)} msgs=${status.messageCount} score=${score}`
      );
    }

    if (this.crossAggregator) {
      const status = this.crossAggregator.getWsStatus();
      if (status.polymarket) {
        const score = this.calcWsHealthScore(status.polymarket.lastMessageAt, this.getWsHealthMaxAge(), now);
        lines.push(
          `PolymarketWS connected=${status.polymarket.connected} subscribed=${status.polymarket.subscribed} cache=${status.polymarket.cacheSize} last=${this.formatAge(now, status.polymarket.lastMessageAt)} msgs=${status.polymarket.messageCount} score=${score}`
        );
      }
      if (status.opinion) {
        const score = this.calcWsHealthScore(status.opinion.lastMessageAt, this.getWsHealthMaxAge(), now);
        lines.push(
          `OpinionWS connected=${status.opinion.connected} subscribed=${status.opinion.subscribed} cache=${status.opinion.cacheSize} last=${this.formatAge(now, status.opinion.lastMessageAt)} msgs=${status.opinion.messageCount} score=${score}`
        );
      }
      if (status.probable) {
        const score = this.calcWsHealthScore(status.probable.lastMessageAt, this.getWsHealthMaxAge(), now);
        lines.push(
          `ProbableWS connected=${status.probable.connected} subscribed=${status.probable.subscribed} cache=${status.probable.cacheSize} last=${this.formatAge(now, status.probable.lastMessageAt)} msgs=${status.probable.messageCount} score=${score}`
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
