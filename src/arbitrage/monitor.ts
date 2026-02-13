/**
 * Arbitrage Monitor
 * 套利监控器 - 整合所有套利检测器，持续扫描机会
 */

import { ValueMismatchDetector } from './value-detector.js';
import { InPlatformArbitrageDetector } from './intra-arb.js';
import { MultiOutcomeArbitrageDetector } from './multi-outcome.js';
import { CrossPlatformArbitrageDetector } from './cross-arb.js';
import { DependencyArbitrageDetector } from './dependency-arb.js';
import type { Market, Orderbook } from '../types.js';
import type { ArbitrageOpportunity } from './types.js';
import type { CrossPlatformAggregator } from '../external/aggregator.js';
import { sendAlert } from '../utils/alert.js';

export interface ArbitrageConfig {
  scanInterval: number;
  minProfitThreshold: number;
  enableValueMismatch: boolean;
  enableInPlatform: boolean;
  enableMultiOutcome: boolean;
  enableCrossPlatform: boolean;
  enableDependency: boolean;
  multiOutcomeMinOutcomes: number;
  multiOutcomeMaxShares: number;
  crossPlatformMinSimilarity: number;
  crossPlatformTransferCost: number;
  crossPlatformAllowShorting: boolean;
  crossPlatformUseMapping: boolean;
  crossPlatformMaxShares: number;
  crossPlatformDepthLevels: number;
  crossPlatformSlippageBps: number;
  crossPlatformDepthUsage: number;
  crossPlatformMinNotionalUsd: number;
  crossPlatformMinProfitUsd: number;
  predictFeeBps: number;
  dependencyConstraintsPath: string;
  dependencyPythonPath: string;
  dependencyPythonScript: string;
  dependencyMinProfit: number;
  dependencyMaxLegs: number;
  dependencyMaxNotional: number;
  dependencyMinDepth: number;
  dependencyFeeBps: number;
  dependencyFeeCurveRate: number;
  dependencyFeeCurveExponent: number;
  dependencySlippageBps: number;
  dependencyMaxIter: number;
  dependencyOracleTimeoutSec: number;
  dependencyTimeoutMs: number;
  dependencyAllowSells: boolean;
  alertWebhookUrl?: string;
  alertMinIntervalMs?: number;
  alertOnNewOpportunity: boolean;
  arbDepthUsage: number;
  arbMinNotionalUsd: number;
  arbMinProfitUsd: number;
}

export class ArbitrageMonitor {
  private valueDetector: ValueMismatchDetector;
  private intraArbDetector: InPlatformArbitrageDetector;
  private multiOutcomeDetector: MultiOutcomeArbitrageDetector;
  private crossArbDetector: CrossPlatformArbitrageDetector;
  private dependencyDetector?: DependencyArbitrageDetector;
  private config: ArbitrageConfig;
  private crossPlatformAggregator?: CrossPlatformAggregator;

  private opportunities: Map<string, ArbitrageOpportunity> = new Map();
  private lastScanTime: number = 0;

  constructor(config: Partial<ArbitrageConfig> = {}, crossPlatformAggregator?: CrossPlatformAggregator) {
    this.config = {
      scanInterval: 10000,
      minProfitThreshold: 0.02,
      enableValueMismatch: true,
      enableInPlatform: true,
      enableMultiOutcome: true,
      enableCrossPlatform: false,
      enableDependency: false,
      multiOutcomeMinOutcomes: 3,
      multiOutcomeMaxShares: 500,
      crossPlatformMinSimilarity: 0.78,
      crossPlatformTransferCost: 0.005,
      crossPlatformAllowShorting: false,
      crossPlatformUseMapping: true,
      crossPlatformMaxShares: 200,
      crossPlatformDepthLevels: 10,
      crossPlatformSlippageBps: 250,
      crossPlatformDepthUsage: 0.5,
      crossPlatformMinNotionalUsd: 0,
      crossPlatformMinProfitUsd: 0,
      predictFeeBps: 100,
      dependencyConstraintsPath: 'dependency-constraints.json',
      dependencyPythonPath: 'python3',
      dependencyPythonScript: 'scripts/dependency-arb.py',
      dependencyMinProfit: 0.02,
      dependencyMaxLegs: 6,
      dependencyMaxNotional: 200,
      dependencyMinDepth: 1,
      dependencyFeeBps: 100,
      dependencyFeeCurveRate: 0,
      dependencyFeeCurveExponent: 0,
      dependencySlippageBps: 20,
      dependencyMaxIter: 12,
      dependencyOracleTimeoutSec: 2,
      dependencyTimeoutMs: 10000,
      dependencyAllowSells: true,
      alertWebhookUrl: undefined,
      alertMinIntervalMs: 60000,
      alertOnNewOpportunity: true,
      arbDepthUsage: 0.6,
      arbMinNotionalUsd: 0,
      arbMinProfitUsd: 0,
      ...config,
    };

    this.valueDetector = new ValueMismatchDetector();
    this.intraArbDetector = new InPlatformArbitrageDetector(
      this.config.minProfitThreshold,
      (this.config.predictFeeBps || 0) / 10000,
      false,
      undefined,
      undefined,
      this.config.arbDepthUsage,
      this.config.arbMinNotionalUsd,
      this.config.arbMinProfitUsd
    );
    this.multiOutcomeDetector = new MultiOutcomeArbitrageDetector({
      minProfitThreshold: this.config.minProfitThreshold,
      minOutcomes: this.config.multiOutcomeMinOutcomes,
      maxRecommendedShares: this.config.multiOutcomeMaxShares,
      feeBps: this.config.predictFeeBps,
      depthUsage: this.config.arbDepthUsage,
      minNotionalUsd: this.config.arbMinNotionalUsd,
      minProfitUsd: this.config.arbMinProfitUsd,
    });
    this.crossArbDetector = new CrossPlatformArbitrageDetector(
      ['Predict', 'Polymarket', 'Opinion'],
      this.config.minProfitThreshold,
      this.config.crossPlatformTransferCost,
      this.config.crossPlatformMinSimilarity,
      this.config.crossPlatformAllowShorting,
      this.config.crossPlatformMaxShares,
      this.config.crossPlatformSlippageBps,
      this.config.crossPlatformDepthLevels,
      this.config.crossPlatformDepthUsage ?? 0.5,
      this.config.crossPlatformMinNotionalUsd ?? 0,
      this.config.crossPlatformMinProfitUsd ?? 0
    );
    if (this.config.enableDependency) {
      this.dependencyDetector = new DependencyArbitrageDetector({
        enabled: this.config.enableDependency,
        constraintsPath: this.config.dependencyConstraintsPath,
        pythonPath: this.config.dependencyPythonPath,
        pythonScript: this.config.dependencyPythonScript,
        minProfit: this.config.dependencyMinProfit,
        maxLegs: this.config.dependencyMaxLegs,
        maxNotional: this.config.dependencyMaxNotional,
        minDepth: this.config.dependencyMinDepth,
        feeBps: this.config.dependencyFeeBps,
        feeCurveRate: this.config.dependencyFeeCurveRate || 0,
        feeCurveExponent: this.config.dependencyFeeCurveExponent || 0,
        slippageBps: this.config.dependencySlippageBps,
        maxIter: this.config.dependencyMaxIter,
        oracleTimeoutSec: this.config.dependencyOracleTimeoutSec,
        timeoutMs: this.config.dependencyTimeoutMs,
        allowSells: this.config.dependencyAllowSells,
      });
    }
    this.crossPlatformAggregator = crossPlatformAggregator;
  }

  async scanOpportunities(markets: Market[], orderbooks: Map<string, Orderbook>): Promise<{
    valueMismatches: ArbitrageOpportunity[];
    inPlatform: ArbitrageOpportunity[];
    multiOutcome: ArbitrageOpportunity[];
    crossPlatform: ArbitrageOpportunity[];
    dependency: ArbitrageOpportunity[];
  }> {
    const results = {
      valueMismatches: [] as ArbitrageOpportunity[],
      inPlatform: [] as ArbitrageOpportunity[],
      multiOutcome: [] as ArbitrageOpportunity[],
      crossPlatform: [] as ArbitrageOpportunity[],
      dependency: [] as ArbitrageOpportunity[],
    };

    if (this.config.enableValueMismatch) {
      results.valueMismatches = this.valueDetector.scanMarkets(markets, orderbooks);
    }

    if (this.config.enableInPlatform) {
      const intra = this.intraArbDetector.scanMarkets(markets, orderbooks);
      results.inPlatform = intra.map((arb) => this.intraArbDetector.toOpportunity(arb));
    }

    if (this.config.enableMultiOutcome) {
      results.multiOutcome = this.multiOutcomeDetector.scanMarkets(markets, orderbooks);
    }

    if (this.config.enableCrossPlatform) {
      if (this.crossPlatformAggregator) {
        const platformMarkets = await this.crossPlatformAggregator.getPlatformMarkets(markets, orderbooks);
        const mappingStore = this.crossPlatformAggregator.getMappingStore();
        const cross = this.crossArbDetector.scanMarkets(
          platformMarkets,
          mappingStore,
          this.config.crossPlatformUseMapping
        );
        results.crossPlatform = cross.map((arb) => this.crossArbDetector.toOpportunity(arb));
      }
    }

    if (this.config.enableDependency && this.dependencyDetector) {
      results.dependency = await this.dependencyDetector.scanMarkets(markets, orderbooks);
    }

    for (const opp of [
      ...results.valueMismatches,
      ...results.inPlatform,
      ...results.multiOutcome,
      ...results.crossPlatform,
      ...results.dependency,
    ]) {
      const key = this.getOpportunityKey(opp);
      if (!this.opportunities.has(key) || this.isNewer(opp, this.opportunities.get(key)!)) {
        if (this.config.alertOnNewOpportunity) {
          this.alertNewOpportunity(opp);
        }
      }
      this.opportunities.set(key, opp);
    }

    this.lastScanTime = Date.now();
    return results;
  }

  private getOpportunityKey(opp: ArbitrageOpportunity): string {
    return `${opp.type}-${opp.marketId}`;
  }

  private isNewer(newOpp: ArbitrageOpportunity, oldOpp: ArbitrageOpportunity): boolean {
    return newOpp.timestamp > oldOpp.timestamp;
  }

  private alertNewOpportunity(opp: ArbitrageOpportunity): void {
    console.log('\n🚨 NEW ARBITRAGE OPPORTUNITY!');
    console.log('─'.repeat(80));

    switch (opp.type) {
      case 'VALUE_MISMATCH':
        console.log('Type: Value Mismatch');
        console.log(`Market: ${opp.marketQuestion.substring(0, 60)}...`);
        console.log(`Edge: ${((opp.edge || 0) * 100).toFixed(2)}%`);
        console.log(`Action: ${opp.recommendedAction}`);
        console.log(`Expected Return: ${opp.expectedReturn?.toFixed(2)}%`);
        break;
      case 'IN_PLATFORM':
        console.log('Type: In-Platform Arbitrage');
        console.log(`Market: ${opp.marketQuestion.substring(0, 60)}...`);
        console.log(`Yes + No: ${opp.yesPlusNo?.toFixed(4)}`);
        console.log(`Profit: ${opp.arbitrageProfit?.toFixed(2)}%`);
        console.log(`Action: ${opp.recommendedAction}`);
        break;
      case 'MULTI_OUTCOME':
        console.log('Type: Multi-Outcome Arbitrage');
        console.log(`Market: ${opp.marketQuestion.substring(0, 60)}...`);
        console.log(`Legs: ${opp.legs?.length || 0}`);
        console.log(`Profit: ${opp.expectedReturn?.toFixed(2)}%`);
        break;
      case 'CROSS_PLATFORM':
        console.log('Type: Cross-Platform Arbitrage');
        console.log(`Event: ${opp.marketQuestion.substring(0, 60)}...`);
        console.log(`${opp.platformA}: ${opp.priceA?.toFixed(2)}¢`);
        console.log(`${opp.platformB}: ${opp.priceB?.toFixed(2)}¢`);
        console.log(`Spread: ${opp.spread?.toFixed(2)}¢`);
        console.log(`Expected Return: ${opp.expectedReturn?.toFixed(2)}%`);
        break;
      case 'DEPENDENCY':
        console.log('Type: Dependency Arbitrage');
        console.log(`Bundle: ${opp.marketQuestion.substring(0, 60)}...`);
        console.log(`Guaranteed Profit: ${opp.expectedReturn?.toFixed(2)}%`);
        console.log(`Legs: ${opp.legs?.length || 0}`);
        break;
    }

    console.log(`Risk Level: ${opp.riskLevel}`);
    console.log('─'.repeat(80) + '\n');

    if (this.config.alertWebhookUrl) {
      const message = `[${opp.type}] ${opp.marketQuestion} | Return ${opp.expectedReturn?.toFixed(2)}% | Risk ${opp.riskLevel}`;
      void sendAlert(this.config.alertWebhookUrl, message, this.config.alertMinIntervalMs);
    }
  }

  printReport(scanResults: {
    valueMismatches: ArbitrageOpportunity[];
    inPlatform: ArbitrageOpportunity[];
    multiOutcome: ArbitrageOpportunity[];
    crossPlatform: ArbitrageOpportunity[];
    dependency: ArbitrageOpportunity[];
  }): void {
    console.log('\n🎯 ARBITRAGE SCAN RESULTS');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('═'.repeat(80));

    if (this.config.enableValueMismatch) {
      this.valueDetector.printReport(scanResults.valueMismatches);
    }

    if (this.config.enableInPlatform) {
      console.log('\n💰 In-Platform Arbitrage Opportunities:');
      console.log('─'.repeat(80));
      if (scanResults.inPlatform.length === 0) {
        console.log('No in-platform arbitrage opportunities found.\n');
      } else {
        for (let i = 0; i < Math.min(10, scanResults.inPlatform.length); i++) {
          const opp = scanResults.inPlatform[i];
          console.log(`\n#${i + 1} ${opp.marketQuestion.substring(0, 50)}...`);
          console.log(`   YES token: ${opp.yesTokenId}`);
          console.log(`   NO token:  ${opp.noTokenId}`);
          console.log(`   Action: ${opp.recommendedAction}`);
          console.log(`   Net Profit: ${opp.expectedReturn?.toFixed(2)}%`);
        }
      }
      console.log('─'.repeat(80));
    }

    if (this.config.enableMultiOutcome) {
      console.log('\n🧩 Multi-Outcome Arbitrage Opportunities:');
      console.log('─'.repeat(80));
      if (scanResults.multiOutcome.length === 0) {
        console.log('No multi-outcome arbitrage opportunities found.\n');
      } else {
        for (let i = 0; i < Math.min(10, scanResults.multiOutcome.length); i++) {
          const opp = scanResults.multiOutcome[i];
          console.log(`\n#${i + 1} ${opp.marketQuestion.substring(0, 50)}...`);
          console.log(`   Legs: ${opp.legs?.length || 0}`);
          console.log(`   Guaranteed Profit: ${opp.expectedReturn?.toFixed(2)}%`);
        }
      }
      console.log('─'.repeat(80));
    }

    if (this.config.enableCrossPlatform) {
      console.log('\n🌐 Cross-Platform Arbitrage Opportunities:');
      console.log('─'.repeat(80));
      if (scanResults.crossPlatform.length === 0) {
        console.log('No cross-platform arbitrage opportunities found.\n');
      } else {
        for (let i = 0; i < Math.min(10, scanResults.crossPlatform.length); i++) {
          const opp = scanResults.crossPlatform[i];
          console.log(`\n#${i + 1} ${opp.marketQuestion.substring(0, 50)}...`);
          console.log(`   ${opp.platformA} vs ${opp.platformB}`);
          console.log(`   Spread: ${opp.spread?.toFixed(4)}`);
          console.log(`   Expected Return: ${opp.expectedReturn?.toFixed(2)}%`);
          console.log(`   Action: ${opp.recommendedAction || 'BUY_BOTH'}`);
        }
      }
      console.log('─'.repeat(80));
    }

    if (this.config.enableDependency) {
      console.log('\n🧠 Dependency Arbitrage Opportunities:');
      console.log('─'.repeat(80));
      if (scanResults.dependency.length === 0) {
        console.log('No dependency arbitrage opportunities found.\n');
      } else {
        for (let i = 0; i < Math.min(10, scanResults.dependency.length); i++) {
          const opp = scanResults.dependency[i];
          console.log(`\n#${i + 1} ${opp.marketQuestion.substring(0, 50)}...`);
          console.log(`   Legs: ${opp.legs?.length || 0}`);
          console.log(`   Guaranteed Profit: ${opp.expectedReturn?.toFixed(2)}%`);
        }
      }
      console.log('─'.repeat(80));
    }

    const totalOpportunities =
      scanResults.valueMismatches.length +
      scanResults.inPlatform.length +
      scanResults.multiOutcome.length +
      scanResults.crossPlatform.length +
      scanResults.dependency.length;

    console.log(`\n📊 Total Opportunities Found: ${totalOpportunities}`);
    console.log('═'.repeat(80) + '\n');
  }

  async startMonitoring(
    marketsProvider: () => Promise<{ markets: Market[]; orderbooks: Map<string, Orderbook> }>,
    onScan?: (results: {
      valueMismatches: ArbitrageOpportunity[];
      inPlatform: ArbitrageOpportunity[];
      multiOutcome: ArbitrageOpportunity[];
      crossPlatform: ArbitrageOpportunity[];
      dependency: ArbitrageOpportunity[];
    }) => Promise<void>
  ): Promise<void> {
    console.log('🔄 Starting arbitrage monitoring...');
    console.log(`   Scan Interval: ${this.config.scanInterval}ms`);
    console.log(`   Min Profit: ${(this.config.minProfitThreshold * 100).toFixed(1)}%\n`);

    while (true) {
      try {
        const { markets, orderbooks } = await marketsProvider();
        const results = await this.scanOpportunities(markets, orderbooks);
        this.printReport(results);
        if (onScan) {
          await onScan(results);
        }
        await this.sleep(this.config.scanInterval);
      } catch (error) {
        console.error('Error in monitoring loop:', error);
        await this.sleep(this.config.scanInterval);
      }
    }
  }

  stop(): void {
    console.log('⏹️  Monitoring stopped.');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
