import { spawn } from 'node:child_process';
import type { Config } from '../types.js';
import type { PlatformLeg, ExternalPlatform } from './types.js';
import { PredictAPI } from '../api/client.js';
import { OrderManager } from '../order-manager.js';
import { Wallet } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import {
  estimateBuy,
  estimateSell,
  maxBuySharesForLimit,
  maxSellSharesForLimit,
} from '../arbitrage/orderbook-vwap.js';
import type { OrderbookEntry } from '../types.js';

interface ExecutionResult {
  platform: ExternalPlatform;
  orderIds?: string[];
  legs?: PlatformLeg[];
}

interface PlatformExecuteOptions {
  useFok?: boolean;
  useLimit?: boolean;
  orderType?: string;
  batch?: boolean;
}

class ExecutionAttemptError extends Error {
  hadSuccess: boolean;
  constructor(message: string, hadSuccess: boolean) {
    super(message);
    this.hadSuccess = hadSuccess;
  }
}

interface PlatformExecutor {
  platform: ExternalPlatform;
  execute(legs: PlatformLeg[], options?: PlatformExecuteOptions): Promise<ExecutionResult>;
  cancelOrders?(orderIds: string[]): Promise<void>;
  hedgeLegs?(legs: PlatformLeg[], slippageBps: number): Promise<void>;
  checkOpenOrders?(orderIds: string[]): Promise<string[]>;
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

  async execute(legs: PlatformLeg[], options?: PlatformExecuteOptions): Promise<ExecutionResult> {
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

  async checkOpenOrders(orderIds: string[]): Promise<string[]> {
    if (!orderIds || orderIds.length === 0) {
      return [];
    }
    try {
      const openOrders = await this.api.getOrders(this.maker);
      return openOrders
        .filter((order) => orderIds.includes(order.order_hash) || (order.id && orderIds.includes(order.id)))
        .map((order) => order.order_hash || order.id || '')
        .filter((id) => Boolean(id));
    } catch (error) {
      console.warn('Predict open order check failed:', error);
      return [];
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
  private cancelOpenMs: number;
  private ownerAddress?: string;
  private orderType?: string;
  private batchOrders: boolean;
  private batchMax: number;

  constructor(config: Config) {
    const signer = new Wallet(config.polymarketPrivateKey || '');
    this.client = new ClobClient(
      config.polymarketClobUrl || 'https://clob.polymarket.com',
      config.polymarketChainId || 137,
      signer
    );

    this.autoDerive = config.polymarketAutoDeriveApiKey !== false;
    this.useFok = config.crossPlatformUseFok !== false;
    this.cancelOpenMs = config.crossPlatformCancelOpenMs || 0;
    this.ownerAddress = signer.address;
    this.orderType = config.crossPlatformOrderType;
    this.batchOrders = config.crossPlatformBatchOrders === true;
    const rawBatchMax = Math.max(1, config.crossPlatformBatchMax || 15);
    this.batchMax = Math.min(rawBatchMax, 15);

    if (config.polymarketApiKey && config.polymarketApiSecret && config.polymarketApiPassphrase) {
      this.apiCreds = {
        apiKey: config.polymarketApiKey,
        apiSecret: config.polymarketApiSecret,
        apiPassphrase: config.polymarketApiPassphrase,
      };
      this.applyCredsToClient();
    }
  }

  private async ensureApiCreds() {
    if (!this.apiCreds && this.autoDerive) {
      const clientAny = this.client as any;
      let creds: any;
      if (typeof clientAny.deriveApiKey === 'function') {
        creds = await clientAny.deriveApiKey();
      } else if (typeof clientAny.createApiKey === 'function') {
        creds = await clientAny.createApiKey();
      } else if (typeof clientAny.createOrDeriveApiKey === 'function') {
        creds = await clientAny.createOrDeriveApiKey();
      }
      if (creds) {
        this.apiCreds = {
          apiKey: creds.apiKey || creds.key,
          apiSecret: creds.apiSecret || creds.secret,
          apiPassphrase: creds.apiPassphrase || creds.passphrase,
        };
        this.applyCredsToClient();
      }
    }
  }

  async execute(legs: PlatformLeg[], options?: PlatformExecuteOptions): Promise<ExecutionResult> {
    await this.ensureApiCreds();
    if (!this.apiCreds) {
      throw new Error('Polymarket API credentials missing');
    }

    const orderType = this.resolveOrderType(options);

    if ((options?.batch ?? this.batchOrders) && legs.length > 1) {
      return this.executeBatch(legs, orderType);
    }

    const orderIds: string[] = [];

    for (const leg of legs) {
      const order = await this.client.createOrder({
        tokenId: leg.tokenId,
        price: leg.price,
        side: leg.side,
        size: leg.shares,
      });
      const result: any = await (this.client as any).postOrder(order, orderType as any);
      const orderId = result?.orderID || result?.orderId || order?.order?.hash || order?.order?.orderHash;
      if (orderId) {
        orderIds.push(String(orderId));
        if (orderType !== 'FOK' && this.cancelOpenMs > 0) {
          this.scheduleCancel(String(orderId));
        }
      }
    }

    return { platform: this.platform, orderIds, legs };
  }

  private resolveOrderType(options?: PlatformExecuteOptions): string {
    const configured = (options?.orderType || this.orderType || '').toUpperCase();
    const valid = new Set(['FOK', 'FAK', 'GTC', 'GTD']);
    if (configured && valid.has(configured)) {
      return configured;
    }
    const useFok = options?.useFok === undefined ? this.useFok : options.useFok;
    return useFok ? 'FOK' : 'GTC';
  }

  private async executeBatch(legs: PlatformLeg[], orderType: string): Promise<ExecutionResult> {
    const orderIds: string[] = [];
    const orders = [];
    for (const leg of legs) {
      const order = await this.client.createOrder({
        tokenId: leg.tokenId,
        price: leg.price,
        side: leg.side,
        size: leg.shares,
      });
      orders.push(order);
    }

    const chunks: any[][] = [];
    for (let i = 0; i < orders.length; i += this.batchMax) {
      chunks.push(orders.slice(i, i + this.batchMax));
    }

    for (const chunk of chunks) {
      try {
        const resp = await this.postOrdersBatch(chunk, orderType);
        const batchIds = this.extractBatchOrderIds(resp);
        if (batchIds.length > 0) {
          orderIds.push(...batchIds);
          if (orderType !== 'FOK' && this.cancelOpenMs > 0) {
            batchIds.forEach((id) => this.scheduleCancel(id));
          }
        }
      } catch (error) {
        console.warn('Polymarket batch submit failed, falling back to single orders:', error);
        for (const order of chunk) {
          const result: any = await (this.client as any).postOrder(order, orderType as any);
          const orderId = result?.orderID || result?.orderId || order?.order?.hash || order?.order?.orderHash;
          if (orderId) {
            orderIds.push(String(orderId));
            if (orderType !== 'FOK' && this.cancelOpenMs > 0) {
              this.scheduleCancel(String(orderId));
            }
          }
        }
      }
    }

    return { platform: this.platform, orderIds, legs };
  }

  private async postOrdersBatch(orders: any[], orderType: string): Promise<any> {
    const clientAny = this.client as any;
    const creds = clientAny.creds || this.mapApiCreds();
    if (!creds) {
      throw new Error('Polymarket API credentials missing for batch order');
    }
    clientAny.creds = creds;

    const [{ createL2Headers }, { orderToJson }] = await Promise.all([
      import('@polymarket/clob-client/dist/headers/index.js'),
      import('@polymarket/clob-client/dist/utilities.js'),
    ]);

    const payload = orders.map((order) => orderToJson(order, creds.key, orderType as any));
    const body = JSON.stringify(payload);
    const requestPath = '/orders';
    const headers = await createL2Headers(clientAny.signer, creds, {
      method: 'POST',
      requestPath,
      body,
    });

    const response = await fetch(`${clientAny.host}${requestPath}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Batch order failed: ${response.status} ${text}`);
    }
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private extractBatchOrderIds(resp: any): string[] {
    const ids: string[] = [];
    if (resp?.orderId || resp?.orderID) {
      ids.push(String(resp.orderId || resp.orderID));
    }
    if (Array.isArray(resp?.orderIds)) {
      for (const id of resp.orderIds) {
        if (id) ids.push(String(id));
      }
    }
    const items = Array.isArray(resp)
      ? resp
      : Array.isArray(resp?.data)
        ? resp.data
        : Array.isArray(resp?.orders)
          ? resp.orders
          : Array.isArray(resp?.result)
            ? resp.result
            : [];
    for (const item of items) {
      const orderId = item?.orderID || item?.orderId || item?.id || item?.order?.id;
      if (orderId) {
        ids.push(String(orderId));
      }
    }
    return ids;
  }

  private mapApiCreds(): { key: string; secret: string; passphrase: string } | null {
    if (!this.apiCreds) {
      return null;
    }
    return {
      key: this.apiCreds.apiKey,
      secret: this.apiCreds.apiSecret,
      passphrase: this.apiCreds.apiPassphrase,
    };
  }

  private applyCredsToClient(): void {
    const clientAny = this.client as any;
    const mapped = this.mapApiCreds();
    if (mapped) {
      clientAny.creds = mapped;
    }
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

  async checkOpenOrders(orderIds: string[]): Promise<string[]> {
    if (!orderIds || orderIds.length === 0) {
      return [];
    }
    await this.ensureApiCreds();
    if (!this.apiCreds) {
      return [];
    }
    try {
      const clientAny = this.client as any;
      if (typeof clientAny.getOpenOrders !== 'function') {
        return [];
      }
      const openOrders = await clientAny.getOpenOrders({ owner: this.ownerAddress });
      const list = Array.isArray(openOrders)
        ? openOrders
        : Array.isArray(openOrders?.orders)
          ? openOrders.orders
          : Array.isArray(openOrders?.data)
            ? openOrders.data
            : Array.isArray(openOrders?.result)
              ? openOrders.result
              : [];
      if (!Array.isArray(list)) {
        return [];
      }
      return list
        .filter((order: any) => orderIds.includes(order.id))
        .map((order: any) => order.id)
        .filter((id: any) => Boolean(id));
    } catch (error) {
      console.warn('Polymarket open order check failed:', error);
      return [];
    }
  }

  async hedgeLegs(legs: PlatformLeg[], slippageBps: number): Promise<void> {
    await this.ensureApiCreds();
    if (!this.apiCreds) {
      return;
    }
    const clientAny = this.client as any;
    for (const leg of legs) {
      if (!clientAny.getPrice) {
        continue;
      }
      const hedgeSide = leg.side === 'BUY' ? 'SELL' : 'BUY';
      const rawPrice = await clientAny.getPrice(leg.tokenId, hedgeSide);
      const refPrice = Number(rawPrice);
      if (!Number.isFinite(refPrice) || refPrice <= 0) {
        continue;
      }
      const slippage = slippageBps / 10000;
      const hedgePrice =
        hedgeSide === 'BUY'
          ? Math.min(1, refPrice * (1 + slippage))
          : Math.max(0.0001, refPrice * (1 - slippage));

      const order = await this.client.createOrder({
        tokenId: leg.tokenId,
        price: hedgePrice,
        side: hedgeSide,
        size: leg.shares,
      });
      await (this.client as any).postOrder(order, 'FOK');
    }
  }

  private scheduleCancel(orderId: string): void {
    if (!this.cancelOpenMs || this.cancelOpenMs <= 0) {
      return;
    }
    setTimeout(async () => {
      try {
        await this.cancelOrders([orderId]);
      } catch {
        // ignore
      }
    }, this.cancelOpenMs);
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

  async execute(legs: PlatformLeg[], _options?: PlatformExecuteOptions): Promise<ExecutionResult> {
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
  private circuitFailures = 0;
  private circuitOpenedAt = 0;
  private lastSuccessAt = 0;
  private recentQuotes = new Map<string, { price: number; ts: number }>();
  private tokenFailures = new Map<string, { count: number; windowStart: number; cooldownUntil: number }>();
  private metrics = {
    attempts: 0,
    successes: 0,
    failures: 0,
    emaPreflightMs: 0,
    emaExecMs: 0,
    emaTotalMs: 0,
    lastError: '',
  };
  private lastMetricsLogAt = 0;

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
    this.assertCircuitHealthy();

    const maxRetries = Math.max(0, this.config.crossPlatformMaxRetries || 0);
    const retryDelayMs = Math.max(0, this.config.crossPlatformRetryDelayMs || 0);

    let attempt = 0;
    while (true) {
      this.assertCircuitHealthy();
      const plannedLegs = this.adjustLegsForAttempt(legs, attempt);
      if (!plannedLegs.length) {
        throw new Error('No executable legs after retry scaling');
      }
      this.assertTokenHealthy(plannedLegs);
      const attemptStart = Date.now();
      let preflightMs = 0;
      let execMs = 0;
      let preparedLegs: PlatformLeg[] = [];

      try {
        const preflightStart = Date.now();
        preparedLegs = await this.prepareLegs(plannedLegs);
        preflightMs = Date.now() - preflightStart;

        const execStart = Date.now();
        const results = await this.executeOnce(preparedLegs);
        execMs = Date.now() - execStart;
        await this.postFillCheck(results);
        this.onSuccess();
        this.recordTokenSuccess(preparedLegs);
        this.recordMetrics({
          success: true,
          preflightMs,
          execMs,
          totalMs: Date.now() - attemptStart,
        });
        return;
      } catch (error: any) {
        const hadSuccess = Boolean(error?.hadSuccess);
        this.onFailure();
        this.recordTokenFailure(preparedLegs.length ? preparedLegs : plannedLegs);
        this.recordMetrics({
          success: false,
          preflightMs,
          execMs,
          totalMs: Date.now() - attemptStart,
          error,
        });
        if (hadSuccess || attempt >= maxRetries) {
          throw error;
        }
        attempt += 1;
        if (retryDelayMs > 0) {
          await this.sleep(retryDelayMs * attempt);
        }
      }
    }
  }

  private async executeOnce(legs: PlatformLeg[]): Promise<ExecutionResult[]> {
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
        orderType: this.config.crossPlatformOrderType,
        batch: this.config.crossPlatformBatchOrders,
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
        const hadSuccess = results.some((r) => r.status === 'fulfilled');
        throw new ExecutionAttemptError(failed.reason?.message || 'Cross-platform execution failed', hadSuccess);
      }
      return results
        .filter((result): result is PromiseFulfilledResult<ExecutionResult> => result.status === 'fulfilled')
        .map((result) => result.value);
    }

    const results: ExecutionResult[] = [];
    for (const task of tasks) {
      try {
        results.push(await task);
      } catch (error: any) {
        await this.cancelSubmitted(results.map((r) => ({ status: 'fulfilled', value: r } as const)));
        await this.hedgeOnFailure(results.map((r) => ({ status: 'fulfilled', value: r } as const)));
        throw new ExecutionAttemptError(error?.message || 'Cross-platform execution failed', results.length > 0);
      }
    }

    return results;
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

  private async sleep(ms: number): Promise<void> {
    if (!ms || ms <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private adjustLegsForAttempt(legs: PlatformLeg[], attempt: number): PlatformLeg[] {
    if (attempt <= 0) {
      return legs;
    }

    const factor = this.config.crossPlatformRetrySizeFactor ?? 0.6;
    const aggressiveBps = (this.config.crossPlatformRetryAggressiveBps ?? 0) * attempt;
    const maxBps = this.config.crossPlatformSlippageBps || 250;
    const adjBps = Math.min(Math.max(0, aggressiveBps), maxBps);

    return legs
      .map((leg) => {
        const scaledShares = leg.shares * Math.pow(factor, attempt);
        if (scaledShares <= 0.0001) {
          return null;
        }
        let price = leg.price;
        if (adjBps > 0) {
          const bump = adjBps / 10000;
          price = leg.side === 'BUY' ? price * (1 + bump) : price * (1 - bump);
        }
        price = Math.min(0.9999, Math.max(0.0001, price));
        return {
          ...leg,
          price,
          shares: scaledShares,
        };
      })
      .filter((leg): leg is PlatformLeg => Boolean(leg));
  }

  private assertCircuitHealthy(): void {
    const maxFailures = Math.max(1, this.config.crossPlatformCircuitMaxFailures || 3);
    const windowMs = Math.max(1000, this.config.crossPlatformCircuitWindowMs || 60000);
    const cooldownMs = Math.max(1000, this.config.crossPlatformCircuitCooldownMs || 60000);

    if (this.circuitOpenedAt > 0) {
      if (Date.now() - this.circuitOpenedAt < cooldownMs) {
        throw new Error('Cross-platform circuit breaker open');
      }
      this.circuitOpenedAt = 0;
      this.circuitFailures = 0;
    }

    if (this.circuitFailures >= maxFailures) {
      this.circuitOpenedAt = Date.now();
      throw new Error('Cross-platform circuit breaker open');
    }

    if (this.lastSuccessAt > 0 && Date.now() - this.lastSuccessAt > windowMs) {
      this.circuitFailures = 0;
    }
  }

  private onFailure(): void {
    this.circuitFailures += 1;
  }

  private onSuccess(): void {
    this.lastSuccessAt = Date.now();
    this.circuitFailures = 0;
    this.circuitOpenedAt = 0;
  }

  private assertTokenHealthy(legs: PlatformLeg[]): void {
    const now = Date.now();
    const windowMs = Math.max(1000, this.config.crossPlatformTokenFailureWindowMs || 30000);
    for (const leg of legs) {
      if (!leg.tokenId) continue;
      const state = this.tokenFailures.get(leg.tokenId);
      if (!state) {
        continue;
      }
      if (state.cooldownUntil > now) {
        throw new Error(`Token cooldown active for ${leg.tokenId}`);
      }
      if (now - state.windowStart > windowMs) {
        this.tokenFailures.delete(leg.tokenId);
      }
    }
  }

  private recordTokenFailure(legs: PlatformLeg[]): void {
    const now = Date.now();
    const maxFailures = Math.max(1, this.config.crossPlatformTokenMaxFailures || 2);
    const windowMs = Math.max(1000, this.config.crossPlatformTokenFailureWindowMs || 30000);
    const cooldownMs = Math.max(1000, this.config.crossPlatformTokenCooldownMs || 120000);

    for (const leg of legs) {
      if (!leg.tokenId) continue;
      const state = this.tokenFailures.get(leg.tokenId) || {
        count: 0,
        windowStart: now,
        cooldownUntil: 0,
      };

      if (now - state.windowStart > windowMs) {
        state.count = 0;
        state.windowStart = now;
      }

      state.count += 1;
      if (state.count >= maxFailures) {
        state.cooldownUntil = now + cooldownMs;
        state.count = 0;
        state.windowStart = now;
      }

      this.tokenFailures.set(leg.tokenId, state);
    }
  }

  private recordTokenSuccess(legs: PlatformLeg[]): void {
    for (const leg of legs) {
      if (!leg.tokenId) continue;
      this.tokenFailures.delete(leg.tokenId);
    }
  }

  private recordMetrics(input: {
    success: boolean;
    preflightMs: number;
    execMs: number;
    totalMs: number;
    error?: any;
  }): void {
    const alpha = 0.2;
    this.metrics.attempts += 1;
    if (input.success) {
      this.metrics.successes += 1;
    } else {
      this.metrics.failures += 1;
      if (input.error) {
        this.metrics.lastError = String(input.error?.message || input.error);
      }
    }
    this.metrics.emaPreflightMs = this.updateEma(this.metrics.emaPreflightMs, input.preflightMs, alpha);
    this.metrics.emaExecMs = this.updateEma(this.metrics.emaExecMs, input.execMs, alpha);
    this.metrics.emaTotalMs = this.updateEma(this.metrics.emaTotalMs, input.totalMs, alpha);
    this.logMetricsIfNeeded();
  }

  private updateEma(current: number, next: number, alpha: number): number {
    if (!Number.isFinite(next) || next <= 0) {
      return current;
    }
    if (!Number.isFinite(current) || current <= 0) {
      return next;
    }
    return current * (1 - alpha) + next * alpha;
  }

  private logMetricsIfNeeded(): void {
    const interval = Number(this.config.crossPlatformMetricsLogMs || 0);
    if (!interval || interval <= 0) {
      return;
    }
    const now = Date.now();
    if (now - this.lastMetricsLogAt < interval) {
      return;
    }
    this.lastMetricsLogAt = now;
    console.log(
      `[CrossExec] attempts=${this.metrics.attempts} success=${this.metrics.successes} fail=${this.metrics.failures} ` +
        `preflight=${this.metrics.emaPreflightMs.toFixed(0)}ms exec=${this.metrics.emaExecMs.toFixed(0)}ms ` +
        `total=${this.metrics.emaTotalMs.toFixed(0)}ms lastError=${this.metrics.lastError || 'none'}`
    );
  }

  private checkVolatility(tokenId: string, book: OrderbookSnapshot): void {
    const threshold = this.config.crossPlatformVolatilityBps ?? 0;
    const lookbackMs = this.config.crossPlatformVolatilityLookbackMs ?? 0;
    if (!tokenId || threshold <= 0 || lookbackMs <= 0) {
      return;
    }
    const bestBid = book.bestBid;
    const bestAsk = book.bestAsk;
    const price =
      Number.isFinite(bestBid) && Number.isFinite(bestAsk) ? ((bestBid + bestAsk) / 2) : bestBid ?? bestAsk;
    if (!Number.isFinite(price) || !price) {
      return;
    }
    const now = Date.now();
    const prev = this.recentQuotes.get(tokenId);
    if (prev && now - prev.ts <= lookbackMs) {
      const drift = Math.abs((price - prev.price) / prev.price) * 10000;
      if (drift > threshold) {
        throw new Error(`Preflight failed: volatility ${drift.toFixed(1)} bps (max ${threshold}) for ${tokenId}`);
      }
    }
    this.recentQuotes.set(tokenId, { price, ts: now });
  }

  private async preflightVwap(legs: PlatformLeg[]): Promise<void> {
    const cache = new Map<string, Promise<OrderbookSnapshot | null>>();
    await this.preflightVwapWithCache(legs, cache);
  }

  private async preflightVwapWithCache(
    legs: PlatformLeg[],
    cache: Map<string, Promise<OrderbookSnapshot | null>>
  ): Promise<void> {
    const checks = legs.map(async (leg) => {
      if (!leg.tokenId || !leg.price || !leg.shares) {
        throw new Error(`Invalid leg for preflight: ${leg.platform}`);
      }
      const book = await this.fetchOrderbook(leg, cache);
      if (!book) {
        throw new Error(`Preflight failed: missing orderbook for ${leg.platform}:${leg.tokenId}`);
      }
      this.checkVolatility(leg.tokenId, book);

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

      const driftBps = this.config.crossPlatformPriceDriftBps ?? 40;
      const bestRef = leg.side === 'BUY' ? book.bestAsk : book.bestBid;
      if (bestRef && Number.isFinite(bestRef) && bestRef > 0) {
        const drift = Math.abs((bestRef - limit) / limit) * 10000;
        if (drift > driftBps) {
          throw new Error(
            `Preflight failed: price drift ${drift.toFixed(1)} bps (max ${driftBps}) for ${leg.platform}:${leg.tokenId}`
          );
        }
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

  private async prepareLegs(legs: PlatformLeg[]): Promise<PlatformLeg[]> {
    const cache = new Map<string, Promise<OrderbookSnapshot | null>>();
    let adjustedLegs = legs;

    if (this.config.crossPlatformAdaptiveSize !== false) {
      let maxShares = await this.getMaxExecutableShares(legs, cache);
      const maxConfigShares = this.config.crossPlatformMaxShares;
      if (Number.isFinite(maxConfigShares) && Number(maxConfigShares) > 0) {
        maxShares = Math.min(maxShares, Number(maxConfigShares));
      }
      const minAllowed = this.config.crossPlatformMinDepthShares ?? 1;
      if (!Number.isFinite(maxShares) || maxShares <= 0 || maxShares < minAllowed) {
        throw new Error(`Preflight failed: insufficient depth (min ${minAllowed})`);
      }
      const target = Math.min(...legs.map((leg) => leg.shares));
      if (maxShares < target) {
        adjustedLegs = legs.map((leg) => ({ ...leg, shares: maxShares }));
      }
    }

    if (this.config.crossPlatformExecutionVwapCheck !== false) {
      await this.preflightVwapWithCache(adjustedLegs, cache);
    }

    return adjustedLegs;
  }

  private async getMaxExecutableShares(
    legs: PlatformLeg[],
    cache: Map<string, Promise<OrderbookSnapshot | null>>
  ): Promise<number> {
    const maxDeviation = this.config.crossPlatformSlippageBps || 250;
    const slippageBps = this.config.crossPlatformSlippageBps || 0;

    const depths = await Promise.all(
      legs.map(async (leg) => {
        const book = await this.fetchOrderbook(leg, cache);
        if (!book) {
          return 0;
        }
        this.checkVolatility(leg.tokenId, book);
        const feeBps = this.getFeeBps(leg.platform);
        const { curveRate, curveExponent } = this.getFeeCurve(leg.platform);

        if (leg.side === 'BUY') {
          return maxBuySharesForLimit(
            book.asks,
            leg.price,
            maxDeviation,
            feeBps,
            curveRate,
            curveExponent,
            slippageBps
          );
        }
        return maxSellSharesForLimit(
          book.bids,
          leg.price,
          maxDeviation,
          feeBps,
          curveRate,
          curveExponent,
          slippageBps
        );
      })
    );
    if (!depths.length) {
      return 0;
    }
    return Math.min(...depths.filter((x) => Number.isFinite(x)));
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
    cache: Map<string, Promise<OrderbookSnapshot | null>>
  ): Promise<OrderbookSnapshot | null> {
    const key = `${leg.platform}:${leg.tokenId}`;
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const promise = this.fetchOrderbookInternal(leg);
    cache.set(key, promise);
    return promise;
  }

  private async fetchOrderbookInternal(leg: PlatformLeg): Promise<OrderbookSnapshot | null> {
    const depthLevels = this.config.crossPlatformDepthLevels || 0;
    if (leg.platform === 'Predict') {
      const book = await this.api.getOrderbook(leg.tokenId);
      return this.normalizeSnapshot(
        this.limitEntries(book.bids || [], depthLevels),
        this.limitEntries(book.asks || [], depthLevels)
      );
    }

    if (leg.platform === 'Polymarket') {
      const base = this.config.polymarketClobUrl || 'https://clob.polymarket.com';
      const url = `${base}/book?token_id=${encodeURIComponent(leg.tokenId)}`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        return null;
      }
      const data: any = await response.json();
      return this.normalizeSnapshot(
        this.limitEntries(this.parseRawEntries(data?.bids), depthLevels),
        this.limitEntries(this.parseRawEntries(data?.asks), depthLevels)
      );
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
      return this.normalizeSnapshot(
        this.limitEntries(this.parseRawEntries(book?.bids), depthLevels),
        this.limitEntries(this.parseRawEntries(book?.asks), depthLevels)
      );
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

  private normalizeSnapshot(bids: OrderbookEntry[], asks: OrderbookEntry[]): OrderbookSnapshot {
    const bestBid = bids.length > 0 ? Number(bids[0].price) : undefined;
    const bestAsk = asks.length > 0 ? Number(asks[0].price) : undefined;
    return { bids, asks, bestBid, bestAsk };
  }

  private async postFillCheck(results: ExecutionResult[]): Promise<void> {
    if (this.config.crossPlatformPostFillCheck === false) {
      return;
    }
    const delayMs = Math.max(0, this.config.crossPlatformFillCheckMs || 1500);
    if (delayMs > 0) {
      await this.sleep(delayMs);
    }

    const openResults: Array<{ platform: ExternalPlatform; orderIds: string[]; legs?: PlatformLeg[] }> = [];
    for (const result of results) {
      const executor = this.executors.get(result.platform);
      if (!executor || !executor.checkOpenOrders || !result.orderIds || result.orderIds.length === 0) {
        continue;
      }
      const openIds = await executor.checkOpenOrders(result.orderIds);
      if (openIds.length > 0) {
        openResults.push({ platform: result.platform, orderIds: openIds, legs: result.legs });
        if (executor.cancelOrders) {
          await executor.cancelOrders(openIds);
        }
      }
    }

    if (openResults.length > 0) {
      if (this.config.crossPlatformHedgeOnFailure) {
        const hedges = openResults
          .filter((res) => res.legs && res.legs.length > 0)
          .map((res) => ({
            status: 'fulfilled' as const,
            value: { platform: res.platform, orderIds: res.orderIds, legs: res.legs! },
          }));
        await this.hedgeOnFailure(hedges);
      }
      throw new ExecutionAttemptError('Open orders remain after fill check', true);
    }
  }
}

interface OrderbookSnapshot {
  bids: OrderbookEntry[];
  asks: OrderbookEntry[];
  bestBid?: number;
  bestAsk?: number;
}
