/**
 * Dependency/Combinatorial Arbitrage Detector
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Market, Orderbook } from '../types.js';
import type { ArbitrageOpportunity } from './types.js';

export interface DependencyCondition {
  id: string;
  label?: string;
  yesTokenId?: string;
  noTokenId?: string;
}

export interface DependencyGroup {
  id?: string;
  type: 'one_of' | 'at_most' | 'at_least';
  conditionIds: string[];
  k?: number;
}

export interface DependencyRelation {
  type: 'implies' | 'mutual_exclusive';
  if?: string;
  then?: string;
  a?: string;
  b?: string;
}

export interface DependencyConstraintsFile {
  version?: number;
  notes?: string;
  conditions: DependencyCondition[];
  groups?: DependencyGroup[];
  relations?: DependencyRelation[];
}

export interface DependencyArbConfig {
  enabled: boolean;
  constraintsPath: string;
  pythonPath: string;
  pythonScript: string;
  minProfit: number;
  maxLegs: number;
  maxNotional: number;
  minDepth: number;
  feeBps: number;
  feeCurveRate: number;
  feeCurveExponent: number;
  slippageBps: number;
  maxIter: number;
  oracleTimeoutSec: number;
  timeoutMs: number;
  allowSells: boolean;
}

interface SolverOpportunity {
  guaranteedProfit: number;
  cost?: number;
  legs: {
    tokenId: string;
    side: 'BUY' | 'SELL';
    price: number;
    shares: number;
    label?: string;
  }[];
}

interface SolverResponse {
  status: 'ok' | 'error';
  error?: string;
  opportunities?: SolverOpportunity[];
}

export class DependencyArbitrageDetector {
  private config: DependencyArbConfig;

  constructor(config: Partial<DependencyArbConfig> = {}) {
    this.config = {
      enabled: false,
      constraintsPath: 'dependency-constraints.json',
      pythonPath: 'python3',
      pythonScript: 'scripts/dependency-arb.py',
      minProfit: 0.02,
      maxLegs: 6,
      maxNotional: 200,
      minDepth: 1,
      feeBps: 100,
      feeCurveRate: 0,
      feeCurveExponent: 0,
      slippageBps: 20,
      maxIter: 12,
      oracleTimeoutSec: 2,
      timeoutMs: 10000,
      allowSells: true,
      ...config,
    };
  }

  async scanMarkets(markets: Market[], orderbooks: Map<string, Orderbook>): Promise<ArbitrageOpportunity[]> {
    if (!this.config.enabled) {
      return [];
    }

    const constraints = this.loadConstraints();
    if (!constraints || !constraints.conditions?.length) {
      return [];
    }

    const tokenMap = new Map<string, Market>();
    for (const market of markets) {
      tokenMap.set(market.token_id, market);
    }

    const tokens: any[] = [];
    for (const cond of constraints.conditions) {
      const yesTokenId = cond.yesTokenId;
      const noTokenId = cond.noTokenId;
      if (yesTokenId) {
        const yesMarket = tokenMap.get(yesTokenId);
        const yesBook = orderbooks.get(yesTokenId);
        const yesTop = this.topOfBook(yesBook);
        tokens.push({
          tokenId: yesTokenId,
          conditionId: cond.id,
          outcome: 'YES',
          ask: yesTop?.ask ?? yesMarket?.best_ask ?? 0,
          bid: yesTop?.bid ?? yesMarket?.best_bid ?? 0,
          askSize: yesTop?.askSize ?? 0,
          bidSize: yesTop?.bidSize ?? 0,
          feeBps: yesMarket?.fee_rate_bps ?? this.config.feeBps,
          label: cond.label || yesMarket?.question,
          question: yesMarket?.question,
        });
      }

      if (noTokenId) {
        const noMarket = tokenMap.get(noTokenId);
        const noBook = orderbooks.get(noTokenId);
        const noTop = this.topOfBook(noBook);
        tokens.push({
          tokenId: noTokenId,
          conditionId: cond.id,
          outcome: 'NO',
          ask: noTop?.ask ?? noMarket?.best_ask ?? 0,
          bid: noTop?.bid ?? noMarket?.best_bid ?? 0,
          askSize: noTop?.askSize ?? 0,
          bidSize: noTop?.bidSize ?? 0,
          feeBps: noMarket?.fee_rate_bps ?? this.config.feeBps,
          label: cond.label || noMarket?.question,
          question: noMarket?.question,
        });
      }
    }

    const input = {
      conditions: constraints.conditions,
      groups: constraints.groups || [],
      relations: constraints.relations || [],
      tokens,
      settings: {
        minProfit: this.config.minProfit,
        maxLegs: this.config.maxLegs,
        maxNotional: this.config.maxNotional,
        minDepth: this.config.minDepth,
        feeBps: this.config.feeBps,
        feeCurveRate: this.config.feeCurveRate,
        feeCurveExponent: this.config.feeCurveExponent,
        slippageBps: this.config.slippageBps,
        maxIter: this.config.maxIter,
        oracleTimeout: this.config.oracleTimeoutSec,
        allowSells: this.config.allowSells,
      },
    };

    const response = await this.runSolver(input);
    if (!response || response.status !== 'ok' || !response.opportunities?.length) {
      return [];
    }

    return response.opportunities.map((opp, idx) => this.toOpportunity(opp, constraints, idx));
  }

  private toOpportunity(
    opp: SolverOpportunity,
    constraints: DependencyConstraintsFile,
    index: number
  ): ArbitrageOpportunity {
    const label = constraints.notes || 'Dependency arbitrage';
    const cost = opp.cost || 0;
    const profitPct = cost > 0 ? (opp.guaranteedProfit / cost) * 100 : (opp.guaranteedProfit || 0) * 100;
    const riskLevel: ArbitrageOpportunity['riskLevel'] = profitPct > 5 ? 'LOW' : profitPct > 1 ? 'MEDIUM' : 'HIGH';

    return {
      type: 'DEPENDENCY',
      marketId: `dependency-${index}`,
      marketQuestion: label,
      timestamp: Date.now(),
      confidence: 0.8,
      expectedReturn: profitPct,
      arbitrageProfit: profitPct,
      recommendedAction: 'BUY_BOTH',
      riskLevel,
      guaranteedProfit: opp.guaranteedProfit,
      totalCost: opp.cost,
      legs: opp.legs.map((leg) => ({
        tokenId: leg.tokenId,
        side: leg.side,
        price: leg.price,
        shares: leg.shares,
      })),
    };
  }

  private loadConstraints(): DependencyConstraintsFile | null {
    const resolved = path.isAbsolute(this.config.constraintsPath)
      ? this.config.constraintsPath
      : path.join(process.cwd(), this.config.constraintsPath);
    if (!fs.existsSync(resolved)) {
      return null;
    }
    const raw = fs.readFileSync(resolved, 'utf8');
    if (!raw.trim()) {
      return null;
    }
    return JSON.parse(raw) as DependencyConstraintsFile;
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

  private runSolver(input: any): Promise<SolverResponse | null> {
    return new Promise((resolve) => {
      const child = spawn(this.config.pythonPath, [this.config.pythonScript]);
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({ status: 'error', error: 'solver timeout' });
      }, this.config.timeoutMs);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('exit', () => {
        clearTimeout(timer);
        if (stderr.trim()) {
          resolve({ status: 'error', error: stderr.trim() });
          return;
        }
        if (!stdout.trim()) {
          resolve({ status: 'error', error: 'empty solver output' });
          return;
        }
        try {
          resolve(JSON.parse(stdout) as SolverResponse);
        } catch (error) {
          resolve({ status: 'error', error: String(error) });
        }
      });

      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    });
  }
}
