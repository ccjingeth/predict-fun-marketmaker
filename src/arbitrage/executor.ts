/**
 * Arbitrage Executor
 * 套利执行器 - 执行套利交易
 */

import type { ArbitrageOpportunity, ArbitrageExecution } from './types.js';
import type { PlatformLeg } from '../external/types.js';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export interface ExecutionConfig {
  maxPositionSize: number;
  maxSlippage: number;
  enableAutoExecute: boolean;
  requireConfirmation: boolean;
  autoConfirm: boolean;
  executeLegs?: (legs: { tokenId: string; side: 'BUY' | 'SELL'; shares: number }[]) => Promise<void>;
  crossPlatformAutoExecute?: boolean;
  crossPlatformRequireConfirmation?: boolean;
  executeCrossPlatformLegs?: (legs: PlatformLeg[]) => Promise<void>;
}

export class ArbitrageExecutor {
  private config: ExecutionConfig;
  private executions: Map<string, ArbitrageExecution> = new Map();

  constructor(config: Partial<ExecutionConfig> = {}) {
    this.config = {
      maxPositionSize: 100,
      maxSlippage: 0.01,
      enableAutoExecute: false,
      requireConfirmation: true,
      autoConfirm: false,
      ...config,
    };
  }

  async executeValueMismatch(opp: ArbitrageOpportunity): Promise<ArbitrageExecution> {
    const execution: ArbitrageExecution = {
      opportunityId: `${opp.type}-${opp.marketId}-${Date.now()}`,
      type: opp.type,
      timestamp: Date.now(),
      status: 'PENDING',
      trades: [],
      totalCost: 0,
      expectedProfit: opp.expectedReturn || 0,
      fees: 0,
    };

    console.log(`\n🎯 Executing Value Mismatch Arbitrage...`);
    console.log(`   Market: ${opp.marketQuestion.substring(0, 50)}...`);
    console.log(`   Action: ${opp.recommendedAction}`);
    console.log(`   Expected Return: ${opp.expectedReturn?.toFixed(2)}%`);

    if (this.config.requireConfirmation) {
      const confirmed = await this.confirmExecution(opp);
      if (!confirmed) {
        execution.status = 'FAILED';
        return execution;
      }
    }

    if (this.config.enableAutoExecute && this.config.executeLegs && opp.legs) {
      await this.config.executeLegs(
        opp.legs.map((leg) => ({ tokenId: leg.tokenId, side: leg.side, shares: leg.shares }))
      );
      execution.status = 'EXECUTED';
    } else {
      execution.status = 'PENDING';
      console.log('   ℹ️  Auto execute disabled, opportunity recorded as PENDING');
    }

    this.executions.set(execution.opportunityId, execution);
    return execution;
  }

  async executeInPlatformArbitrage(opp: ArbitrageOpportunity): Promise<ArbitrageExecution> {
    const execution: ArbitrageExecution = {
      opportunityId: `${opp.type}-${opp.marketId}-${Date.now()}`,
      type: opp.type,
      timestamp: Date.now(),
      status: 'PENDING',
      trades: [],
      totalCost: 0,
      expectedProfit: opp.expectedReturn || 0,
      fees: 0,
    };

    console.log(`\n💰 Executing In-Platform Arbitrage...`);
    console.log(`   Market: ${opp.marketQuestion.substring(0, 50)}...`);
    console.log(`   Yes + No: ${opp.yesPlusNo?.toFixed(4)}`);
    console.log(`   Action: ${opp.recommendedAction}`);
    console.log(`   Expected Profit: ${opp.expectedReturn?.toFixed(2)}%`);

    if (this.config.requireConfirmation) {
      const confirmed = await this.confirmExecution(opp);
      if (!confirmed) {
        execution.status = 'FAILED';
        return execution;
      }
    }

    const positionSize = Math.min(this.config.maxPositionSize, opp.positionSize || 100);

    if (opp.legs && opp.legs.length > 0) {
      for (const leg of opp.legs) {
        execution.trades.push({
          market: leg.tokenId,
          side: leg.side,
          price: leg.price,
          amount: Math.min(positionSize, leg.shares),
          cost: leg.side === 'BUY' ? leg.price * Math.min(positionSize, leg.shares) : 0,
        });
      }
    }

    execution.totalCost = execution.trades.reduce((sum, t) => sum + t.cost, 0);

    if (this.config.enableAutoExecute && this.config.executeLegs && opp.legs) {
      await this.config.executeLegs(
        opp.legs.map((leg) => ({
          tokenId: leg.tokenId,
          side: leg.side,
          shares: Math.min(positionSize, leg.shares),
        }))
      );
      execution.status = 'EXECUTED';
    } else {
      execution.status = 'PENDING';
      console.log('   ℹ️  Auto execute disabled, opportunity recorded as PENDING');
    }

    this.executions.set(execution.opportunityId, execution);
    return execution;
  }

  async executeCrossPlatformArbitrage(opp: ArbitrageOpportunity): Promise<ArbitrageExecution> {
    const execution: ArbitrageExecution = {
      opportunityId: `${opp.type}-${opp.marketId}-${Date.now()}`,
      type: opp.type,
      timestamp: Date.now(),
      status: 'PENDING',
      trades: [],
      totalCost: 0,
      expectedProfit: opp.expectedReturn || 0,
      fees: this.config.maxSlippage * 100,
    };

    console.log(`\n🌐 Executing Cross-Platform Arbitrage...`);
    console.log(`   Event: ${opp.marketQuestion.substring(0, 50)}...`);
    console.log(`   ${opp.platformA}: ${opp.priceA?.toFixed(2)}¢`);
    console.log(`   ${opp.platformB}: ${opp.priceB?.toFixed(2)}¢`);
    console.log(`   Spread: ${opp.spread?.toFixed(2)}¢`);
    console.log(`   Expected Return: ${opp.expectedReturn?.toFixed(2)}%`);
    console.log(`   ⚠️  WARNING: Cross-platform arb requires careful timing and hedging!`);

    const requireConfirm = this.config.crossPlatformRequireConfirmation ?? this.config.requireConfirmation;

    if (requireConfirm) {
      const confirmed = await this.confirmExecution(opp);
      if (!confirmed) {
        execution.status = 'FAILED';
        return execution;
      }
    }

    const maxSize = this.config.maxPositionSize;
    const legs = (opp.legs || [])
      .filter((leg) => Boolean(leg.platform))
      .map((leg) => ({
        platform: (leg.platform || 'Predict') as PlatformLeg['platform'],
        tokenId: leg.tokenId,
        side: leg.side,
        price: leg.price,
        shares: Math.min(maxSize, leg.shares),
        outcome: leg.outcome,
      }));

    const canAutoExecute =
      this.config.crossPlatformAutoExecute && this.config.executeCrossPlatformLegs && legs.length > 0;

    if (canAutoExecute) {
      await this.config.executeCrossPlatformLegs!(legs);
      execution.status = 'EXECUTED';
    } else {
      execution.status = 'PENDING';
      console.log('   ℹ️  Cross-platform auto execute disabled, opportunity recorded as PENDING');
    }

    this.executions.set(execution.opportunityId, execution);
    return execution;
  }

  async executeDependencyArbitrage(opp: ArbitrageOpportunity): Promise<ArbitrageExecution> {
    const execution: ArbitrageExecution = {
      opportunityId: `${opp.type}-${opp.marketId}-${Date.now()}`,
      type: opp.type,
      timestamp: Date.now(),
      status: 'PENDING',
      trades: [],
      totalCost: 0,
      expectedProfit: opp.expectedReturn || 0,
      fees: 0,
    };

    console.log(`\n🧠 Executing Dependency Arbitrage...`);
    console.log(`   Bundle: ${opp.marketQuestion.substring(0, 50)}...`);
    console.log(`   Legs: ${opp.legs?.length || 0}`);
    console.log(`   Expected Return: ${opp.expectedReturn?.toFixed(2)}%`);

    if (this.config.requireConfirmation) {
      const confirmed = await this.confirmExecution(opp);
      if (!confirmed) {
        execution.status = 'FAILED';
        return execution;
      }
    }

    const maxSize = this.config.maxPositionSize || 0;
    const legs = opp.legs || [];
    const maxLegShares = legs.reduce((max, leg) => Math.max(max, leg.shares), 0);
    const scale = maxSize > 0 && maxLegShares > maxSize ? maxSize / maxLegShares : 1;

    if (legs.length > 0) {
      for (const leg of legs) {
        const sizedShares = leg.shares * scale;
        execution.trades.push({
          market: leg.tokenId,
          side: leg.side,
          price: leg.price,
          amount: sizedShares,
          cost: leg.side === 'BUY' ? leg.price * sizedShares : 0,
        });
      }
    }

    execution.totalCost = execution.trades.reduce((sum, t) => sum + t.cost, 0);

    if (this.config.enableAutoExecute && this.config.executeLegs && legs.length > 0) {
      await this.config.executeLegs(
        legs.map((leg) => ({
          tokenId: leg.tokenId,
          side: leg.side,
          shares: leg.shares * scale,
        }))
      );
      execution.status = 'EXECUTED';
    } else {
      execution.status = 'PENDING';
      console.log('   ℹ️  Auto execute disabled, opportunity recorded as PENDING');
    }

    this.executions.set(execution.opportunityId, execution);
    return execution;
  }

  async executeMultiOutcomeArbitrage(opp: ArbitrageOpportunity): Promise<ArbitrageExecution> {
    const execution: ArbitrageExecution = {
      opportunityId: `${opp.type}-${opp.marketId}-${Date.now()}`,
      type: opp.type,
      timestamp: Date.now(),
      status: 'PENDING',
      trades: [],
      totalCost: 0,
      expectedProfit: opp.expectedReturn || 0,
      fees: 0,
    };

    console.log(`\n🧩 Executing Multi-Outcome Arbitrage...`);
    console.log(`   Market: ${opp.marketQuestion.substring(0, 50)}...`);
    console.log(`   Legs: ${opp.legs?.length || 0}`);
    console.log(`   Expected Return: ${opp.expectedReturn?.toFixed(2)}%`);

    if (this.config.requireConfirmation) {
      const confirmed = await this.confirmExecution(opp);
      if (!confirmed) {
        execution.status = 'FAILED';
        return execution;
      }
    }

    const maxSize = this.config.maxPositionSize || 0;
    const legs = opp.legs || [];
    const maxLegShares = legs.reduce((max, leg) => Math.max(max, leg.shares), 0);
    const scale = maxSize > 0 && maxLegShares > maxSize ? maxSize / maxLegShares : 1;

    if (legs.length > 0) {
      for (const leg of legs) {
        const sizedShares = leg.shares * scale;
        execution.trades.push({
          market: leg.tokenId,
          side: leg.side,
          price: leg.price,
          amount: sizedShares,
          cost: leg.side === 'BUY' ? leg.price * sizedShares : 0,
        });
      }
    }

    execution.totalCost = execution.trades.reduce((sum, t) => sum + t.cost, 0);

    if (this.config.enableAutoExecute && this.config.executeLegs && legs.length > 0) {
      await this.config.executeLegs(
        legs.map((leg) => ({
          tokenId: leg.tokenId,
          side: leg.side,
          shares: leg.shares * scale,
        }))
      );
      execution.status = 'EXECUTED';
    } else {
      execution.status = 'PENDING';
      console.log('   ℹ️  Auto execute disabled, opportunity recorded as PENDING');
    }

    this.executions.set(execution.opportunityId, execution);
    return execution;
  }

  private async confirmExecution(opp: ArbitrageOpportunity): Promise<boolean> {
    if (this.config.autoConfirm) {
      return true;
    }

    if (!process.stdin.isTTY) {
      console.log('   ℹ️  Non-interactive terminal detected, auto reject execution');
      return false;
    }

    console.log(`\n⚠️  Execution requires confirmation:`);
    console.log(`   Type: ${opp.type}`);
    console.log(`   Market: ${opp.marketQuestion.substring(0, 60)}...`);
    console.log(`   Expected Return: ${opp.expectedReturn?.toFixed(2)}%`);
    console.log(`   Risk Level: ${opp.riskLevel}`);
    console.log('');

    const rl = createInterface({ input, output });
    try {
      const answer = (await rl.question('   Confirm execution? [y/N] ')).trim().toLowerCase();
      return answer === 'y' || answer === 'yes';
    } finally {
      rl.close();
    }
  }

  getExecutionHistory(): ArbitrageExecution[] {
    return Array.from(this.executions.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  printExecutionReport(): void {
    const history = this.getExecutionHistory();

    console.log('\n📋 Execution History:');
    console.log('─'.repeat(80));

    if (history.length === 0) {
      console.log('No executions yet.\n');
      return;
    }

    for (const exec of history.slice(0, 20)) {
      console.log(`\n${exec.opportunityId}`);
      console.log(`  Type: ${exec.type}`);
      console.log(`  Status: ${exec.status}`);
      console.log(`  Time: ${new Date(exec.timestamp).toLocaleString()}`);
      console.log(`  Expected Profit: ${exec.expectedProfit.toFixed(2)}%`);
      console.log(`  Trades: ${exec.trades.length}`);

      if (exec.actualProfit !== undefined) {
        console.log(`  Actual Profit: ${exec.actualProfit.toFixed(2)}%`);
      }
    }

    console.log('\n' + '─'.repeat(80) + '\n');
  }
}
