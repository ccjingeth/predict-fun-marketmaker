import { spawn } from 'node:child_process';
import type { Config } from '../types.js';
import type { PlatformLeg, ExternalPlatform } from './types.js';
import { PredictAPI } from '../api/client.js';
import { OrderManager } from '../order-manager.js';
import { Wallet } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { estimateBuy, estimateSell } from '../arbitrage/orderbook-vwap.js';
import type { OrderbookEntry } from '../types.js';

interface ExecutionResult {
  platform: ExternalPlatform;
  orderIds?: string[];
  legs?: PlatformLeg[];
}

interface PlatformExecutor {
  platform: ExternalPlatform;
  execute(legs: PlatformLeg[], options?: { useFok?: boolean; useLimit?: boolean }): Promise<ExecutionResult>;
  cancelOrders?(orderIds: string[]): Promise<void>;
  hedgeLegs?(legs: PlatformLeg[], slippageBps: number): Promise<void>;
}

class PredictExecutor implements PlatformExecutor {
  platform: ExternalPlatform = 'Predict';
  private api: PredictAPI;
  private orderManager: OrderManager;
  private slippageBps: string;
  private useLimitOrders: boolean;
  private cancelOpenMs: number;
  private maker: string;

  constructor(
    api: PredictAPI,
    orderManager: OrderManager,
    slippageBps: number,
    options?: { useLimitOrders?: boolean; cancelOpenMs?: number }
  ) {
    this.api = api;
    this.orderManager = orderManager;
    this.slippageBps = String(slippageBps);
    this.useLimitOrders = options?.useLimitOrders !== false;
    this.cancelOpenMs = options?.cancelOpenMs ?? 1500;
    this.maker = orderManager.getMakerAddress();
  }

  async execute(legs: PlatformLeg[], options?: { useLimit?: boolean }): Promise<ExecutionResult> {
    const orderIds: string[] = [];
    const useLimit = options?.useLimit ?? this.useLimitOrders;

    for (const leg of legs) {
      const market = await this.api.getMarket(leg.tokenId);
      let payload: any;

      if (useLimit) {
        payload = await this.orderManager.buildLimitOrderPayload({
          market,
          side: leg.side,
          price: leg.price,
          shares: leg.shares,
        });
      } else {
        const orderbook = await this.api.getOrderbook(leg.tokenId);
        payload = await this.orderManager.buildMarketOrderPayload({
          market,
          side: leg.side,
          shares: leg.shares,
          orderbook,
          slippageBps: this.slippageBps,
        });
      }

      const response = await this.api.createOrder(payload);
      const orderId = this.extractOrderId(response);
      if (orderId) {
        orderIds.push(orderId);
        this.scheduleCancelIfOpen(orderId);
      }
    }

    return { platform: this.platform, orderIds, legs };
  }

  async cancelOrders(orderIds: string[]): Promise<void> {
    if (!orderIds || orderIds.length === 0) {
      return;
    }
    try {
      await this.api.removeOrders(orderIds);
    } catch (error) {
      console.warn('Predict cancel failed:', error);
    }
  }

  async hedgeLegs(legs: PlatformLeg[], slippageBps: number): Promise<void> {
    for (const leg of legs) {
      const market = await this.api.getMarket(leg.tokenId);
      const orderbook = await this.api.getOrderbook(leg.tokenId);
      const payload = await this.orderManager.buildMarketOrderPayload({
        market,
        side: leg.side === 'BUY' ? 'SELL' : 'BUY',
        shares: leg.shares,
        orderbook,
        slippageBps: String(slippageBps),
      });
      await this.api.createOrder(payload);
    }
  }

  private scheduleCancelIfOpen(orderId: string): void {
    if (!this.cancelOpenMs || this.cancelOpenMs <= 0) {
      return;
    }
    setTimeout(async () => {
      try {
        const openOrders = await this.api.getOrders(this.maker);
        const stillOpen = openOrders.find((o) => o.order_hash === orderId || o.id === orderId);
        if (stillOpen) {
          await this.api.removeOrders([orderId]);
        }
      } catch {
        // ignore
      }
    }, this.cancelOpenMs);
  }

  private extractOrderId(response: any): string | null {
    const candidates = [
      response?.order_hash,
      response?.order?.hash,
      response?.order?.order_hash,
      response?.data?.order?.hash,
      response?.data?.order?.order_hash,
      response?.hash,
      response?.id,
      response?.order?.id,
    ];
    for (const cand of candidates) {
      if (cand) {
        return String(cand);
      }
    }
    return null;
  }
}

class PolymarketExecutor implements PlatformExecutor {
  platform: ExternalPlatform = 'Polymarket';
  private client: ClobClient;
  private apiCreds?: { apiKey: string; apiSecret: string; apiPassphrase: string };
  private autoDerive: boolean;
  private useFok: boolean;

  constructor(config: Config) {
    const signer = new Wallet(config.polymarketPrivateKey || '');
    this.client = new ClobClient(
      config.polymarketClobUrl || 'https://clob.polymarket.com',
      config.polymarketChainId || 137,
      signer
    );

    this.autoDerive = config.polymarketAutoDeriveApiKey !== false;
    this.useFok = config.crossPlatformUseFok !== false;

    if (config.polymarketApiKey && config.polymarketApiSecret && config.polymarketApiPassphrase) {
      this.apiCreds = {
        apiKey: config.polymarketApiKey,
        apiSecret: config.polymarketApiSecret,
        apiPassphrase: config.polymarketApiPassphrase,
      };
    }
  }

  private async ensureApiCreds() {
    if (!this.apiCreds && this.autoDerive) {
      const creds = await this.client.createOrDeriveApiKey();
      this.apiCreds = {
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret,
        apiPassphrase: creds.apiPassphrase,
      };
    }
  }

  async execute(legs: PlatformLeg[], options?: { useFok?: boolean }): Promise<ExecutionResult> {
    await this.ensureApiCreds();
    if (!this.apiCreds) {
      throw new Error('Polymarket API credentials missing');
    }

    const orderIds: string[] = [];
    const orderType: 'GTC' | 'FOK' | 'GTD' =
      options?.useFok === undefined
        ? this.useFok
          ? 'FOK'
          : 'GTC'
        : options.useFok
          ? 'FOK'
          : 'GTC';

    for (const leg of legs) {
      const order = await this.client.createOrder({
        tokenId: leg.tokenId,
        price: leg.price,
        side: leg.side,
        size: leg.shares,
      });
      const result: any = await (this.client as any).postOrder(order, orderType);
      const orderId = result?.orderID || result?.orderId || order?.order?.hash || order?.order?.orderHash;
      if (orderId) {
        orderIds.push(String(orderId));
      }
    }

    return { platform: this.platform, orderIds, legs };
  }

  async cancelOrders(orderIds: string[]): Promise<void> {
    if (!orderIds || orderIds.length === 0) {
      return;
    }
    await this.ensureApiCreds();
    if (!this.apiCreds) {
      return;
    }
    try {
      const clientAny = this.client as any;
      if (typeof clientAny.cancelOrders === 'function') {
        await clientAny.cancelOrders(orderIds);
      }
    } catch (error) {
      console.warn('Polymarket cancel failed:', error);
    }
  }
}

class OpinionExecutor implements PlatformExecutor {
  platform: ExternalPlatform = 'Opinion';
  private pythonPath: string;
  private scriptPath: string;
  private apiKey?: string;
  private host?: string;
  private privateKey?: string;
  private chainId?: number;

  constructor(config: Config) {
    this.pythonPath = config.opinionPythonPath || 'python3';
    this.scriptPath = config.opinionPythonScript || 'scripts/opinion-trade.py';
    this.apiKey = config.opinionApiKey;
    this.host = config.opinionHost;
    this.privateKey = config.opinionPrivateKey;
    this.chainId = config.opinionChainId;
  }

  async execute(legs: PlatformLeg[]): Promise<ExecutionResult> {
    if (!this.apiKey || !this.privateKey) {
      throw new Error('Opinion API key or private key missing');
    }

    for (const leg of legs) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(this.pythonPath, [
          this.scriptPath,
          '--token-id',
          leg.tokenId,
          '--side',
          leg.side,
          '--price',
          String(leg.price),
          '--size',
          String(leg.shares),
          '--api-key',
          this.apiKey || '',
          '--private-key',
          this.privateKey || '',
          '--host',
          this.host || '',
          '--chain-id',
          String(this.chainId || ''),
        ]);

        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(stderr || `Opinion order failed (exit ${code})`));
          }
        });
      });
    }

    return { platform: this.platform, legs };
  }
}

export class CrossPlatformExecutionRouter {
  private executors: Map<ExternalPlatform, PlatformExecutor> = new Map();
  private config: Config;
  private api: PredictAPI;

  constructor(config: Config, api: PredictAPI, orderManager: OrderManager) {
    this.config = config;
    this.api = api;
    this.executors.set(
      'Predict',
      new PredictExecutor(api, orderManager, config.crossPlatformSlippageBps || 250, {
        useLimitOrders: config.crossPlatformLimitOrders !== false,
        cancelOpenMs: config.crossPlatformCancelOpenMs,
      })
    );

    if (config.polymarketPrivateKey) {
      this.executors.set('Polymarket', new PolymarketExecutor(config));
    }

    if (config.opinionApiKey && config.opinionPrivateKey) {
      this.executors.set('Opinion', new OpinionExecutor(config));
    }
  }

  async execute(legs: PlatformLeg[]): Promise<void> {
    if (this.config.crossPlatformExecutionVwapCheck !== false) {
      await this.preflightVwap(legs);
    }

    const grouped = new Map<ExternalPlatform, PlatformLeg[]>();

    for (const leg of legs) {
      if (!grouped.has(leg.platform)) {
        grouped.set(leg.platform, []);
      }
      grouped.get(leg.platform)!.push(leg);
    }

    const runExecution = async (platform: ExternalPlatform, legsForPlatform: PlatformLeg[]) => {
      const executor = this.executors.get(platform);
      if (!executor) {
        throw new Error(`No executor configured for ${platform}`);
      }
      return executor.execute(legsForPlatform, {
        useFok: this.config.crossPlatformUseFok,
        useLimit: this.config.crossPlatformLimitOrders,
      });
    };

    const tasks: Promise<ExecutionResult>[] = [];
    for (const [platform, legsForPlatform] of grouped.entries()) {
      tasks.push(runExecution(platform, legsForPlatform));
    }

    if (this.config.crossPlatformParallelSubmit !== false) {
      const results = await Promise.allSettled(tasks);
      const failed = results.find((result) => result.status === 'rejected');
      if (failed) {
        await this.cancelSubmitted(results);
        await this.hedgeOnFailure(results);
        throw failed.reason;
      }
      return;
    }

    const results: ExecutionResult[] = [];
    for (const task of tasks) {
      try {
        results.push(await task);
      } catch (error) {
        await this.cancelSubmitted(results.map((r) => ({ status: 'fulfilled', value: r } as const)));
        await this.hedgeOnFailure(results.map((r) => ({ status: 'fulfilled', value: r } as const)));
        throw error;
      }
    }
  }

  private async cancelSubmitted(
    results: Array<{ status: 'fulfilled'; value: ExecutionResult } | { status: 'rejected'; reason: any }>
  ): Promise<void> {
    const cancelPromises: Promise<void>[] = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { platform, orderIds } = result.value;
      if (!orderIds || orderIds.length === 0) continue;
      const executor = this.executors.get(platform);
      if (!executor || !executor.cancelOrders) continue;
      cancelPromises.push(executor.cancelOrders(orderIds));
    }
    if (cancelPromises.length > 0) {
      await Promise.allSettled(cancelPromises);
    }
  }

  private async hedgeOnFailure(
    results: Array<{ status: 'fulfilled'; value: ExecutionResult } | { status: 'rejected'; reason: any }>
  ): Promise<void> {
    if (!this.config.crossPlatformHedgeOnFailure) {
      return;
    }

    const slippage = this.config.crossPlatformHedgeSlippageBps || this.config.crossPlatformSlippageBps || 400;

    const hedgePromises: Promise<void>[] = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { platform, legs } = result.value;
      if (!legs || legs.length === 0) continue;
      if (this.config.crossPlatformHedgePredictOnly && platform !== 'Predict') {
        continue;
      }
      const executor = this.executors.get(platform);
      if (!executor || !executor.hedgeLegs) continue;
      hedgePromises.push(executor.hedgeLegs(legs, slippage));
    }

    if (hedgePromises.length > 0) {
      await Promise.allSettled(hedgePromises);
    }
  }

  private async preflightVwap(legs: PlatformLeg[]): Promise<void> {
    const cache = new Map<string, Promise<{ bids: OrderbookEntry[]; asks: OrderbookEntry[] } | null>>();
    const checks = legs.map(async (leg) => {
      if (!leg.tokenId || !leg.price || !leg.shares) {
        throw new Error(`Invalid leg for preflight: ${leg.platform}`);
      }
      const book = await this.fetchOrderbook(leg, cache);
      if (!book) {
        throw new Error(`Preflight failed: missing orderbook for ${leg.platform}:${leg.tokenId}`);
      }

      const feeBps = this.getFeeBps(leg.platform);
      const { curveRate, curveExponent } = this.getFeeCurve(leg.platform);
      const slippageBps = this.config.crossPlatformSlippageBps || 0;

      const vwap =
        leg.side === 'BUY'
          ? estimateBuy(book.asks, leg.shares, feeBps, curveRate, curveExponent, slippageBps)
          : estimateSell(book.bids, leg.shares, feeBps, curveRate, curveExponent, slippageBps);

      if (!vwap) {
        throw new Error(`Preflight failed: insufficient depth for ${leg.platform}:${leg.tokenId}`);
      }

      const limit = leg.price;
      if (limit <= 0) {
        throw new Error(`Preflight failed: invalid price for ${leg.platform}:${leg.tokenId}`);
      }

      const deviationBps =
        leg.side === 'BUY'
          ? ((vwap.avgPrice - limit) / limit) * 10000
          : ((limit - vwap.avgPrice) / limit) * 10000;

      const maxDeviation = this.config.crossPlatformSlippageBps || 250;
      if (deviationBps > maxDeviation) {
        throw new Error(
          `Preflight failed: VWAP deviates ${deviationBps.toFixed(1)} bps (max ${maxDeviation}) for ${leg.platform}:${leg.tokenId}`
        );
      }
    });

    await Promise.all(checks);
  }

  private getFeeBps(platform: ExternalPlatform): number {
    if (platform === 'Predict') {
      return this.config.predictFeeBps || 0;
    }
    if (platform === 'Polymarket') {
      return this.config.polymarketFeeBps || 0;
    }
    if (platform === 'Opinion') {
      return this.config.opinionFeeBps || 0;
    }
    return 0;
  }

  private getFeeCurve(platform: ExternalPlatform): { curveRate?: number; curveExponent?: number } {
    if (platform === 'Polymarket') {
      return {
        curveRate: this.config.polymarketFeeCurveRate,
        curveExponent: this.config.polymarketFeeCurveExponent,
      };
    }
    return {};
  }

  private async fetchOrderbook(
    leg: PlatformLeg,
    cache: Map<string, Promise<{ bids: OrderbookEntry[]; asks: OrderbookEntry[] } | null>>
  ): Promise<{ bids: OrderbookEntry[]; asks: OrderbookEntry[] } | null> {
    const key = `${leg.platform}:${leg.tokenId}`;
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const promise = this.fetchOrderbookInternal(leg);
    cache.set(key, promise);
    return promise;
  }

  private async fetchOrderbookInternal(
    leg: PlatformLeg
  ): Promise<{ bids: OrderbookEntry[]; asks: OrderbookEntry[] } | null> {
    const depthLevels = this.config.crossPlatformDepthLevels || 0;
    if (leg.platform === 'Predict') {
      const book = await this.api.getOrderbook(leg.tokenId);
      return {
        bids: this.limitEntries(book.bids || [], depthLevels),
        asks: this.limitEntries(book.asks || [], depthLevels),
      };
    }

    if (leg.platform === 'Polymarket') {
      const base = this.config.polymarketClobUrl || 'https://clob.polymarket.com';
      const url = `${base}/book?token_id=${encodeURIComponent(leg.tokenId)}`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        return null;
      }
      const data: any = await response.json();
      return {
        bids: this.limitEntries(this.parseRawEntries(data?.bids), depthLevels),
        asks: this.limitEntries(this.parseRawEntries(data?.asks), depthLevels),
      };
    }

    if (leg.platform === 'Opinion') {
      const openApiUrl = this.config.opinionOpenApiUrl;
      const apiKey = this.config.opinionApiKey;
      if (!openApiUrl || !apiKey) {
        return null;
      }
      const url = `${openApiUrl}/token/orderbook?token_id=${encodeURIComponent(leg.tokenId)}`;
      const response = await fetch(url, { headers: { apikey: apiKey } });
      if (!response.ok) {
        return null;
      }
      const data: any = await response.json();
      const book = data?.result ? data.result : data;
      return {
        bids: this.limitEntries(this.parseRawEntries(book?.bids), depthLevels),
        asks: this.limitEntries(this.parseRawEntries(book?.asks), depthLevels),
      };
    }

    return null;
  }

  private limitEntries(entries: OrderbookEntry[], depthLevels: number): OrderbookEntry[] {
    if (!entries || entries.length === 0) {
      return [];
    }
    if (!depthLevels || depthLevels <= 0) {
      return entries;
    }
    return entries.slice(0, depthLevels);
  }

  private parseRawEntries(raw: any): OrderbookEntry[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((entry) => {
        if (Array.isArray(entry)) {
          return { price: String(entry[0]), shares: String(entry[1]) };
        }
        if (entry && typeof entry === 'object') {
          return {
            price: String(entry.price ?? entry.priceFloat ?? entry[0]),
            shares: String(entry.size ?? entry.shares ?? entry[1]),
          };
        }
        return null;
      })
      .filter((entry): entry is OrderbookEntry => Boolean(entry));
  }
}
