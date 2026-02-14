import { spawn } from 'node:child_process';
import type { Config } from '../types.js';
import type { PlatformLeg, ExternalPlatform } from './types.js';
import { PredictAPI } from '../api/client.js';
import { OrderManager } from '../order-manager.js';
import { Wallet } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  estimateBuy,
  estimateSell,
  maxBuySharesForLimit,
  maxSellSharesForLimit,
} from '../arbitrage/orderbook-vwap.js';
import { calcFeeCost } from '../arbitrage/fee-utils.js';
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

interface PreflightResult {
  maxDeviationBps: number;
  maxDriftBps: number;
  vwapByLeg?: Map<string, { avgAllIn: number; totalAllIn: number; filledShares: number }>;
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

  private async importClobModule<T = any>(primaryPath: string, fallbackPath: string): Promise<T> {
    try {
      return (await import(primaryPath)) as T;
    } catch {
      return (await import(fallbackPath)) as T;
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
      this.importClobModule('@polymarket/clob-client/dist/src/headers/index.js', '@polymarket/clob-client/dist/headers/index.js'),
      this.importClobModule('@polymarket/clob-client/dist/src/utilities.js', '@polymarket/clob-client/dist/utilities.js'),
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
  private tokenScores = new Map<string, { score: number; ts: number }>();
  private qualityScore = 1;
  private platformScores = new Map<ExternalPlatform, { score: number; ts: number }>();
  private platformFailures = new Map<ExternalPlatform, { count: number; windowStart: number; cooldownUntil: number }>();
  private blockedTokens = new Map<string, number>();
  private blockedPlatforms = new Map<ExternalPlatform, number>();
  private legMarketQuality = new Map<string, number>();
  private globalCooldownUntil = 0;
  private failurePauseUntil = 0;
  private failurePauseMs = 0;
  private chunkFactor = 1;
  private chunkDelayMs = 0;
  private lastMetricsFlush = 0;
  private lastStateFlush = 0;
  private retryFactor = 1;
  private slippageBpsDynamic = 0;
  private stabilityBpsDynamic = 0;
  private retryDelayMsDynamic = 0;
  private failureProfitBpsBump = 0;
  private failureProfitUsdBump = 0;
  private failureDepthUsdBump = 0;
  private failureMinNotionalUsdBump = 0;
  private allowlistTokens?: Set<string>;
  private blocklistTokens?: Set<string>;
  private allowlistPlatforms?: Set<string>;
  private blocklistPlatforms?: Set<string>;
  private metrics = {
    attempts: 0,
    successes: 0,
    failures: 0,
    failureReasons: {
      preflight: 0,
      execution: 0,
      postTrade: 0,
      hedge: 0,
      unknown: 0,
    },
    softBlocks: 0,
    emaPreflightMs: 0,
    emaExecMs: 0,
    emaTotalMs: 0,
    emaPostTradeDriftBps: 0,
    postTradeAlerts: 0,
    lastError: '',
  };
  private lastMetricsLogAt = 0;
  private lastPreflight?: PreflightResult;
  private lastBatchPreflight?: PreflightResult;
  private degradedUntil = 0;
  private degradedReason = '';
  private degradedAt = 0;
  private degradedSuccesses = 0;
  private netRiskTightenFactor = 1;
  private depthRatioPenalty = 0;
  private consistencyFailures = { count: 0, windowStart: 0 };
  private lastConsistencyFailureAt = 0;
  private lastConsistencyFailureReason = '';
  private consistencyOverrideUntil = 0;
  private consistencyTemplateActiveUntil = 0;

  constructor(config: Config, api: PredictAPI, orderManager: OrderManager) {
    this.config = config;
    this.api = api;
    this.allowlistTokens = this.buildSet(config.crossPlatformAllowlistTokens);
    this.blocklistTokens = this.buildSet(config.crossPlatformBlocklistTokens);
    this.allowlistPlatforms = this.buildSet(config.crossPlatformAllowlistPlatforms);
    this.blocklistPlatforms = this.buildSet(config.crossPlatformBlocklistPlatforms);
    this.chunkDelayMs = Math.max(0, config.crossPlatformChunkDelayMs || 0);
    const minRetry = Math.max(0.1, config.crossPlatformRetryFactorMin || 0.4);
    const maxRetry = Math.max(minRetry, config.crossPlatformRetryFactorMax || 1);
    this.retryFactor = maxRetry;
    this.slippageBpsDynamic = this.resolveDynamicSlippage();
    this.stabilityBpsDynamic = this.resolveDynamicStability();
    this.retryDelayMsDynamic = this.resolveDynamicRetryDelay();
    this.failureProfitBpsBump = 0;
    this.failureProfitUsdBump = 0;
    this.failureDepthUsdBump = 0;
    this.failureMinNotionalUsdBump = 0;
    this.restoreState().catch((error) => {
      console.warn('Cross-platform state restore failed:', error);
    });
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
    this.assertGlobalCooldown();

    const maxRetries = this.getMaxRetries();
    const retryDelayMs = this.getRetryDelayMs();

    let attempt = 0;
    while (true) {
      this.assertCircuitHealthy();
      const plannedLegs = this.adjustLegsForAttempt(legs, attempt);
      if (!plannedLegs.length) {
        throw new Error('No executable legs after retry scaling');
      }
      this.assertAllowlist(plannedLegs);
      this.assertTokenHealthy(plannedLegs);
      this.assertPlatformScore(plannedLegs);
      this.assertPlatformHealthy(plannedLegs);
      const attemptStart = Date.now();
      let preflightMs = 0;
      let execMs = 0;
      let preparedLegs: PlatformLeg[] = [];

      try {
        const preflightStart = Date.now();
        preparedLegs = await this.prepareLegs(plannedLegs);
        preflightMs = Date.now() - preflightStart;
        this.assertMinNotionalAndProfit(preparedLegs);

        const execStart = Date.now();
        const chunkResult = await this.executeChunks(preparedLegs, attempt);
        execMs = Date.now() - execStart;
        const postTrade = chunkResult.postTrade;
        this.onSuccess();
        if (postTrade.penalizedLegs.length > 0) {
          this.recordTokenFailure(postTrade.penalizedLegs);
        }
        this.recordTokenSuccess(preparedLegs.filter((leg) => !postTrade.penalizedTokenIds.has(leg.tokenId)));
        this.adjustPlatformScores(preparedLegs, this.config.crossPlatformPlatformScoreOnSuccess || 1);
        this.adjustTokenScores(preparedLegs, this.config.crossPlatformTokenScoreOnSuccess || 2);
        this.adjustChunkFactor(true);
        this.adjustRetryFactor(true);
        this.adjustDynamicSlippage(true);
        this.adjustDynamicStability(true);
        this.adjustDynamicRetryDelay(true);
        this.adjustFailureProfitBps(true);
        this.adjustFailureProfitUsd(true);
        this.adjustFailureDepthUsd(true);
        this.adjustFailureMinNotionalUsd(true);
        if (postTrade.penalizedLegs.length > 0) {
          this.adjustTokenScores(
            postTrade.penalizedLegs,
            -Math.abs(this.config.crossPlatformTokenScoreOnPostTrade || 15)
          );
          this.adjustPlatformScores(
            postTrade.penalizedLegs,
            -Math.abs(this.config.crossPlatformPlatformScoreOnPostTrade || 8)
          );
          this.applyQualityPenalty(0.5);
          this.maybeAutoBlock(postTrade.penalizedLegs);
        }
        if (postTrade.spreadPenalizedLegs.length > 0) {
          this.adjustTokenScores(
            postTrade.spreadPenalizedLegs,
            -Math.abs(this.config.crossPlatformTokenScoreOnPostTrade || 15)
          );
          this.adjustPlatformScores(
            postTrade.spreadPenalizedLegs,
            -Math.abs(this.config.crossPlatformPlatformScoreOnSpread || 6)
          );
          this.applyQualityPenalty(0.3);
          this.maybeAutoBlock(postTrade.spreadPenalizedLegs);
        }
        this.updateQualityScore(true);
        this.adjustChunkDelay(true);
        this.recordPlatformSuccess(preparedLegs);
        this.checkGlobalCooldown();
        this.recordMetrics({
          success: true,
          preflightMs,
          execMs,
          totalMs: Date.now() - attemptStart,
          postTradeDriftBps: postTrade.maxDriftBps,
        });
        return;
      } catch (error: any) {
        const hadSuccess = Boolean(error?.hadSuccess);
        const reason = this.classifyFailure(error);
        this.onFailure();
        this.recordConsistencyFailure(error);
        this.recordTokenFailure(preparedLegs.length ? preparedLegs : plannedLegs);
        this.recordPlatformFailure(preparedLegs.length ? preparedLegs : plannedLegs);
        this.adjustTokenScores(
          preparedLegs.length ? preparedLegs : plannedLegs,
          -Math.abs(this.config.crossPlatformTokenScoreOnFailure || 5)
        );
        this.adjustPlatformScores(
          preparedLegs.length ? preparedLegs : plannedLegs,
          -Math.abs(this.config.crossPlatformPlatformScoreOnFailure || 3)
        );
        this.maybeAutoBlock(preparedLegs.length ? preparedLegs : plannedLegs);
        this.updateQualityScore(false);
        this.adjustChunkFactor(false);
        this.adjustRetryFactor(false);
        this.adjustDynamicSlippage(false);
        this.adjustDynamicStability(false);
        this.adjustDynamicRetryDelay(false);
        this.adjustFailureProfitBps(false);
        this.adjustFailureProfitUsd(false);
        this.adjustFailureDepthUsd(false);
        this.adjustFailureMinNotionalUsd(false);
        this.adjustChunkDelay(false);
        this.checkGlobalCooldown();
        this.applyFailureReasonPenalty(reason);
        this.recordMetrics({
          success: false,
          preflightMs,
          execMs,
          totalMs: Date.now() - attemptStart,
          error,
          reason,
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

  private async executeOnce(legs: PlatformLeg[], attempt: number): Promise<ExecutionResult[]> {
    const grouped = new Map<ExternalPlatform, PlatformLeg[]>();

    for (const leg of legs) {
      if (!grouped.has(leg.platform)) {
        grouped.set(leg.platform, []);
      }
      grouped.get(leg.platform)!.push(leg);
    }

    const runExecution = async (platform: ExternalPlatform, legsForPlatform: PlatformLeg[], options: PlatformExecuteOptions) => {
      const executor = this.executors.get(platform);
      if (!executor) {
        throw new Error(`No executor configured for ${platform}`);
      }
      return executor.execute(legsForPlatform, options);
    };

    let execOptions = this.resolveExecutionOptions(attempt);
    const fallbackMode = this.resolveFallbackMode(attempt);

    const taskDefs: Array<{ platform: ExternalPlatform; legs: PlatformLeg[]; options: PlatformExecuteOptions }> = [];
    const prepared = attempt > 0 ? this.shrinkFallbackLegs(legs, attempt) : legs;
    if (fallbackMode === 'SINGLE_LEG' && attempt > 0) {
      const bestLegs = this.selectBestLegs(
        prepared,
        Math.max(1, this.config.crossPlatformSingleLegTopN || 2)
      );
      const bestGrouped = new Map<ExternalPlatform, PlatformLeg[]>();
      for (const leg of bestLegs) {
        if (!bestGrouped.has(leg.platform)) {
          bestGrouped.set(leg.platform, []);
        }
        bestGrouped.get(leg.platform)!.push(leg);
      }
      for (const [platform, legsForPlatform] of bestGrouped.entries()) {
        taskDefs.push({ platform, legs: legsForPlatform, options: execOptions });
      }
    } else {
      const groupedPrepared = new Map<ExternalPlatform, PlatformLeg[]>();
      for (const leg of prepared) {
        if (!groupedPrepared.has(leg.platform)) {
          groupedPrepared.set(leg.platform, []);
        }
        groupedPrepared.get(leg.platform)!.push(leg);
      }
      for (const [platform, legsForPlatform] of groupedPrepared.entries()) {
        taskDefs.push({ platform, legs: legsForPlatform, options: execOptions });
      }
    }

    const shouldParallel = fallbackMode === 'SEQUENTIAL' && attempt > 0 ? false : this.shouldParallelSubmit();
    if (shouldParallel) {
      const tasks = taskDefs.map((def) => runExecution(def.platform, def.legs, def.options));
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
    const ordered = [...taskDefs].sort((a, b) => this.groupQualityScore(b.legs) - this.groupQualityScore(a.legs));
    for (const def of ordered) {
      try {
        results.push(await runExecution(def.platform, def.legs, def.options));
      } catch (error: any) {
        await this.cancelSubmitted(results.map((r) => ({ status: 'fulfilled', value: r } as const)));
        await this.hedgeOnFailure(results.map((r) => ({ status: 'fulfilled', value: r } as const)));
        throw new ExecutionAttemptError(error?.message || 'Cross-platform execution failed', results.length > 0);
      }
    }

    return results;
  }

  private selectBestLegs(legs: PlatformLeg[], maxLegs: number): PlatformLeg[] {
    const sorted = [...legs].sort((a, b) => {
      const aScore = this.legQualityScore(a);
      const bScore = this.legQualityScore(b);
      return bScore - aScore;
    });
    return sorted.slice(0, Math.max(1, maxLegs));
  }

  private resolveFallbackMode(attempt: number): 'AUTO' | 'SEQUENTIAL' | 'SINGLE_LEG' {
    const raw = (this.config.crossPlatformFallbackMode || 'AUTO').toUpperCase();
    if (raw === 'SEQUENTIAL' || raw === 'SINGLE_LEG') {
      return raw;
    }
    if (attempt <= 0) {
      return 'AUTO';
    }
    if (this.isDegraded()) {
      const minQuality = this.config.crossPlatformGlobalMinQuality ?? 50;
      if (this.qualityScore < minQuality || attempt > 1) {
        return 'SINGLE_LEG';
      }
      return 'SEQUENTIAL';
    }
    if (this.circuitFailures > 0) {
      return 'SEQUENTIAL';
    }
    return 'AUTO';
  }

  private shrinkFallbackLegs(legs: PlatformLeg[], attempt: number): PlatformLeg[] {
    if (attempt <= 0) {
      return legs;
    }
    const shrink = Math.max(0.05, Math.min(1, this.config.crossPlatformFallbackShrinkFactor ?? 0.7));
    const minFactor = Math.max(0.05, Math.min(1, this.config.crossPlatformFallbackMinFactor ?? 0.3));
    const factor = Math.max(minFactor, Math.pow(shrink, attempt));
    return legs.map((leg) => ({ ...leg, shares: Math.max(1, leg.shares * factor) }));
  }

  private legQualityScore(leg: PlatformLeg): number {
    const tokenScore = this.tokenScores.get(leg.tokenId || '')?.score ?? 100;
    const platformScore = this.platformScores.get(leg.platform)?.score ?? 100;
    const price = Number.isFinite(leg.price) ? leg.price : 0;
    const size = Number.isFinite(leg.shares) ? leg.shares : 0;
    const liquidityScore = Math.min(1, (price * size) / 50);
    const legKey = `${leg.platform}:${leg.tokenId}:${leg.side}`;
    const marketQuality = Math.max(0.1, Math.min(1, this.legMarketQuality.get(legKey) ?? 1));
    return (tokenScore * 0.6 + platformScore * 0.3 + liquidityScore * 10) * marketQuality;
  }

  private groupQualityScore(legs: PlatformLeg[]): number {
    if (!legs.length) {
      return 0;
    }
    const scores = legs.map((leg) => this.legQualityScore(leg));
    const total = scores.reduce((sum, score) => sum + score, 0);
    return total / scores.length;
  }

  private async executeChunks(legs: PlatformLeg[], attempt: number): Promise<{ postTrade: { maxDriftBps: number; penalizedLegs: PlatformLeg[]; penalizedTokenIds: Set<string>; spreadPenalizedLegs: PlatformLeg[] } }> {
    this.assertNetRiskBudget(legs);
    const chunks = this.splitLegsIntoChunks(legs);
    let maxDriftBps = 0;
    const penalizedLegs: PlatformLeg[] = [];
    const penalizedTokenIds = new Set<string>();
    const spreadPenalizedLegs: PlatformLeg[] = [];
    const chunkPreflight = this.config.crossPlatformChunkPreflight !== false;

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      if (chunkPreflight) {
        const cache = new Map<string, Promise<OrderbookSnapshot | null>>();
        const preflight = await this.preflightVwapWithCache(chunk, cache);
        this.lastPreflight = preflight;
        this.lastBatchPreflight = preflight;
        this.assertMinNotionalAndProfit(chunk);
      }
      const results = await this.executeOnce(chunk, attempt);
      await this.postFillCheck(results);
      await this.hedgeResidualExposure(results);
      const post = await this.postTradeCheck(chunk);
      maxDriftBps = Math.max(maxDriftBps, post.maxDriftBps);
      this.mergeLegs(penalizedLegs, post.penalizedLegs);
      this.mergeLegs(spreadPenalizedLegs, post.spreadPenalizedLegs);
      post.penalizedTokenIds.forEach((id) => penalizedTokenIds.add(id));
      if (post.penalizedLegs.length > 0) {
        this.adjustChunkFactor(false);
        this.adjustChunkDelay(false);
        await this.hedgeOnPostTrade(post.penalizedLegs);
      }
      const abortBps = Math.max(0, this.config.crossPlatformAbortPostTradeDriftBps || 0);
      if (abortBps > 0 && post.maxDriftBps >= abortBps) {
        const cooldown = Math.max(0, this.config.crossPlatformAbortCooldownMs || 0);
        if (cooldown > 0) {
          this.globalCooldownUntil = Date.now() + cooldown;
        }
        throw new ExecutionAttemptError(
          `Post-trade drift ${post.maxDriftBps.toFixed(1)} bps >= abort ${abortBps}`,
          true
        );
      }

      const delayMs = this.getEffectiveChunkDelayMs();
      if (delayMs > 0 && i < chunks.length - 1) {
        await this.sleep(delayMs);
      }
    }

    return { postTrade: { maxDriftBps, penalizedLegs, penalizedTokenIds, spreadPenalizedLegs } };
  }

  private assertNetRiskBudget(legs: PlatformLeg[]): void {
    const totalBudgetRaw = Math.max(0, this.config.crossPlatformNetRiskUsd || 0);
    const perTokenRaw = Math.max(0, this.config.crossPlatformNetRiskUsdPerToken || 0);
    if (!totalBudgetRaw && !perTokenRaw) {
      return;
    }
    if (!legs.length) {
      return;
    }
    const factor = this.getNetRiskScaleFactor();
    const totalBudget = totalBudgetRaw > 0 ? totalBudgetRaw * factor : 0;
    const perTokenBudget = perTokenRaw > 0 ? perTokenRaw * factor : 0;
    const totals = new Map<string, number>();
    let global = 0;
    const vwapByLeg = this.lastPreflight?.vwapByLeg || this.lastBatchPreflight?.vwapByLeg;
    for (const leg of legs) {
      const legKey = `${leg.platform}:${leg.tokenId}:${leg.side}`;
      const vwap = vwapByLeg?.get(legKey);
      const unit = vwap && Number.isFinite(vwap.avgAllIn) && vwap.avgAllIn > 0 ? vwap.avgAllIn : leg.price;
      const notional = Math.abs(unit * leg.shares);
      const key = leg.tokenId ? `${leg.platform}:${leg.tokenId}` : leg.platform;
      if (key) {
        totals.set(key, (totals.get(key) || 0) + notional);
      }
      global += notional;
    }
    if (totalBudget > 0 && global > totalBudget) {
      throw new Error(`Preflight failed: net risk $${global.toFixed(2)} > budget ${totalBudget}`);
    }
    if (perTokenBudget > 0) {
      for (const [key, value] of totals.entries()) {
        if (value > perTokenBudget) {
          throw new Error(`Preflight failed: net risk $${value.toFixed(2)} > per-token budget ${perTokenBudget} (${key})`);
        }
      }
    }
  }

  private getNetRiskScaleFactor(): number {
    let factor = 1;
    if (this.config.crossPlatformNetRiskScaleOnQuality !== false) {
      const min = Math.max(0.05, this.config.crossPlatformNetRiskMinFactor || 0.4);
      const max = Math.max(min, this.config.crossPlatformNetRiskMaxFactor || 1);
      const quality = Math.max(0, Math.min(1, this.qualityScore / 100));
      factor *= Math.max(min, Math.min(max, quality));
    }
    if (this.isDegraded()) {
      const degrade = Math.max(0.05, this.config.crossPlatformNetRiskDegradeFactor || 0.6);
      factor *= degrade;
    }
    factor *= this.netRiskTightenFactor;
    return factor;
  }

  private async hedgeResidualExposure(results: ExecutionResult[]): Promise<void> {
    if (!this.config.crossPlatformPostTradeNetHedge) {
      return;
    }
    if (!results.length) {
      return;
    }
    const minShares = Math.max(0, this.config.crossPlatformPostTradeNetHedgeMinShares || 0);
    const maxShares = Math.max(0, this.config.crossPlatformPostTradeNetHedgeMaxShares || 0);
    const force = this.config.crossPlatformPostTradeNetHedgeForce === true;
    const slippage =
      (this.config.crossPlatformPostTradeNetHedgeSlippageBps && this.config.crossPlatformPostTradeNetHedgeSlippageBps > 0)
        ? this.config.crossPlatformPostTradeNetHedgeSlippageBps
        : this.config.crossPlatformHedgeSlippageBps || this.getSlippageBps() || 400;

    const netMap = new Map<string, { platform: ExternalPlatform; tokenId: string; shares: number; notional: number }>();
    for (const result of results) {
      const platform = result.platform;
      if (this.config.crossPlatformPostTradeNetHedgePredictOnly && platform !== 'Predict') {
        continue;
      }
      for (const leg of result.legs || []) {
        if (!leg.tokenId || !Number.isFinite(leg.shares)) {
          continue;
        }
        const signed = leg.side === 'BUY' ? leg.shares : -leg.shares;
        const key = `${platform}:${leg.tokenId}`;
        const entry = netMap.get(key) || { platform, tokenId: leg.tokenId, shares: 0, notional: 0 };
        entry.shares += signed;
        entry.notional += Math.abs(leg.price) * Math.abs(leg.shares);
        netMap.set(key, entry);
      }
    }

    if (netMap.size === 0) {
      return;
    }

    const grouped = new Map<ExternalPlatform, PlatformLeg[]>();
    for (const entry of netMap.values()) {
      if (!Number.isFinite(entry.shares) || entry.shares === 0) {
        continue;
      }
      const absShares = Math.abs(entry.shares);
      if (minShares > 0 && absShares < minShares) {
        continue;
      }
      const cappedShares = maxShares > 0 ? Math.min(absShares, maxShares) : absShares;
      if (cappedShares <= 0) {
        continue;
      }
      const avgPrice = entry.notional > 0 ? entry.notional / absShares : 0;
      const side: PlatformLeg['side'] = entry.shares > 0 ? 'BUY' : 'SELL';
      const leg: PlatformLeg = {
        platform: entry.platform,
        tokenId: entry.tokenId,
        side,
        price: avgPrice > 0 ? avgPrice : 0.5,
        shares: cappedShares,
      };
      if (!grouped.has(entry.platform)) {
        grouped.set(entry.platform, []);
      }
      grouped.get(entry.platform)!.push(leg);
    }

    if (!grouped.size) {
      return;
    }

    const hedgePromises: Promise<void>[] = [];
    for (const [platform, legs] of grouped.entries()) {
      const executor = this.executors.get(platform);
      if (!executor || !executor.hedgeLegs) {
        continue;
      }
      if (!force && !this.shouldHedgeLegs(legs, this.config.crossPlatformHedgeMinProfitUsd || 0, this.config.crossPlatformHedgeMinEdge || 0, slippage)) {
        continue;
      }
      hedgePromises.push(executor.hedgeLegs(legs, slippage));
    }

    if (hedgePromises.length > 0) {
      await Promise.allSettled(hedgePromises);
    }
  }

  private async hedgeOnPostTrade(legs: PlatformLeg[]): Promise<void> {
    if (!this.config.crossPlatformPostTradeHedge) {
      return;
    }
    if (!legs.length) {
      return;
    }
    const slippage =
      (this.config.crossPlatformPostTradeHedgeSlippageBps && this.config.crossPlatformPostTradeHedgeSlippageBps > 0)
        ? this.config.crossPlatformPostTradeHedgeSlippageBps
        : this.config.crossPlatformHedgeSlippageBps || this.getSlippageBps() || 400;
    const minProfitUsd = Math.max(0, this.config.crossPlatformHedgeMinProfitUsd || 0);
    const minEdge = Math.max(0, this.config.crossPlatformHedgeMinEdge || 0);
    const maxShares = Math.max(0, this.config.crossPlatformPostTradeHedgeMaxShares || 0);
    const force = this.config.crossPlatformPostTradeHedgeForce === true;

    const grouped = new Map<ExternalPlatform, PlatformLeg[]>();
    for (const leg of legs) {
      const platform = leg.platform;
      if (!platform) continue;
      if (this.config.crossPlatformHedgePredictOnly && platform !== 'Predict') {
        continue;
      }
      const sized = maxShares > 0 ? { ...leg, shares: Math.min(leg.shares, maxShares) } : leg;
      if (!grouped.has(platform)) {
        grouped.set(platform, []);
      }
      grouped.get(platform)!.push(sized);
    }

    const hedgePromises: Promise<void>[] = [];
    for (const [platform, legsForPlatform] of grouped.entries()) {
      const executor = this.executors.get(platform);
      if (!executor || !executor.hedgeLegs) {
        continue;
      }
      if (!force && !this.shouldHedgeLegs(legsForPlatform, minProfitUsd, minEdge, slippage)) {
        continue;
      }
      hedgePromises.push(executor.hedgeLegs(legsForPlatform, slippage));
    }

    if (hedgePromises.length > 0) {
      await Promise.allSettled(hedgePromises);
    }
  }

  private splitLegsIntoChunks(legs: PlatformLeg[]): PlatformLeg[][] {
    if (!legs.length) return [];
    const baseShares = Math.min(...legs.map((leg) => leg.shares));
    const maxChunkShares = this.config.crossPlatformChunkMaxShares || 0;
    const maxChunkNotional = this.config.crossPlatformChunkMaxNotional || 0;
    let chunkShares = baseShares * this.getEffectiveChunkFactor();
    if (maxChunkShares > 0) {
      chunkShares = Math.min(chunkShares, maxChunkShares);
    }
    if (maxChunkNotional > 0) {
      const perShareNotional = legs.reduce((sum, leg) => sum + leg.price, 0);
      if (perShareNotional > 0) {
        chunkShares = Math.min(chunkShares, maxChunkNotional / perShareNotional);
      }
    }
    if (!Number.isFinite(chunkShares) || chunkShares <= 0 || chunkShares >= baseShares) {
      return [legs];
    }

    const chunks: PlatformLeg[][] = [];
    let remaining = baseShares;
    while (remaining > 0) {
      const size = Math.min(chunkShares, remaining);
      const chunk = legs.map((leg) => ({ ...leg, shares: size }));
      chunks.push(chunk);
      remaining -= size;
    }
    return chunks;
  }

  private mergeLegs(target: PlatformLeg[], incoming: PlatformLeg[]): void {
    const seen = new Set(target.map((leg) => `${leg.platform}:${leg.tokenId}:${leg.side}`));
    for (const leg of incoming) {
      const key = `${leg.platform}:${leg.tokenId}:${leg.side}`;
      if (seen.has(key)) continue;
      target.push(leg);
      seen.add(key);
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

    const slippage = this.config.crossPlatformHedgeSlippageBps || this.getSlippageBps() || 400;
    const minProfitUsd = Math.max(0, this.config.crossPlatformHedgeMinProfitUsd || 0);
    const minEdge = Math.max(0, this.config.crossPlatformHedgeMinEdge || 0);

    const hedgePromises: Promise<void>[] = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { platform, legs } = result.value;
      if (!legs || legs.length === 0) continue;
      if (this.config.crossPlatformHedgePredictOnly && platform !== 'Predict') {
        continue;
      }
      if (!this.shouldHedgeLegs(legs, minProfitUsd, minEdge, slippage)) {
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
    const maxBps = this.getSlippageBps() || 250;
    const adjBps = Math.min(Math.max(0, aggressiveBps), maxBps);

    return legs
      .map((leg) => {
        const scaledShares = leg.shares * Math.pow(factor, attempt) * this.retryFactor;
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

  private adjustRetryFactor(success: boolean): void {
    const minFactor = Math.max(0.1, this.config.crossPlatformRetryFactorMin || 0.4);
    const maxFactor = Math.max(minFactor, this.config.crossPlatformRetryFactorMax || 1);
    const up = Math.max(0, this.config.crossPlatformRetryFactorUp || 0.02);
    const down = Math.max(0, this.config.crossPlatformRetryFactorDown || 0.08);
    if (success) {
      this.retryFactor = Math.min(maxFactor, this.retryFactor + up);
    } else {
      this.retryFactor = Math.max(minFactor, this.retryFactor - down);
    }
  }

  private resolveDynamicSlippage(): number {
    if (this.config.crossPlatformSlippageDynamic === false) {
      return this.config.crossPlatformSlippageBps || 0;
    }
    const floor = Math.max(0, this.config.crossPlatformSlippageFloorBps || 0);
    const ceil = Math.max(floor, this.config.crossPlatformSlippageCeilBps || 0);
    const base = this.config.crossPlatformSlippageBps || 0;
    if (ceil > 0) {
      return Math.max(floor, Math.min(ceil, base));
    }
    return Math.max(floor, base);
  }

  private adjustDynamicSlippage(success: boolean): void {
    if (this.config.crossPlatformSlippageDynamic === false) {
      return;
    }
    const floor = Math.max(0, this.config.crossPlatformSlippageFloorBps || 0);
    const ceil = Math.max(floor, this.config.crossPlatformSlippageCeilBps || 0);
    const stepUp = Math.max(0, this.config.crossPlatformFailureSlippageBumpBps || 0);
    const stepDown = Math.max(0, this.config.crossPlatformSuccessSlippageTightenBps || 0);
    if (success) {
      this.slippageBpsDynamic = Math.max(floor, this.getSlippageBps() - Math.max(1, stepDown));
    } else {
      this.slippageBpsDynamic = Math.min(
        ceil || Number.MAX_SAFE_INTEGER,
        this.getSlippageBps() + Math.max(1, stepUp)
      );
    }
  }

  private resolveDynamicStability(): number {
    const base = this.config.crossPlatformStabilityBps || 0;
    return Math.max(0, base);
  }

  private adjustDynamicStability(success: boolean): void {
    const base = this.getStabilityBps();
    const up = Math.max(0, this.config.crossPlatformFailureStabilityBps || 0);
    const down = Math.max(0, this.config.crossPlatformSuccessStabilityBps || 0);
    if (success) {
      this.stabilityBpsDynamic = Math.max(0, base - down);
    } else {
      this.stabilityBpsDynamic = base + up;
    }
  }

  private resolveDynamicRetryDelay(): number {
    return Math.max(0, this.config.crossPlatformRetryDelayMs || 0);
  }

  private adjustDynamicRetryDelay(success: boolean): void {
    const base = this.resolveDynamicRetryDelay();
    const floor = Math.max(0, this.config.crossPlatformRetryDelayFloorMs || 0);
    const ceil = Math.max(floor, this.config.crossPlatformRetryDelayCeilMs || 0);
    const up = Math.max(0, this.config.crossPlatformFailureRetryDelayBumpMs || 0);
    const down = Math.max(0, this.config.crossPlatformSuccessRetryDelayTightenMs || 0);
    const current = this.retryDelayMsDynamic || base;
    if (success) {
      this.retryDelayMsDynamic = Math.max(floor, current - down);
    } else {
      const next = current + up;
      this.retryDelayMsDynamic = ceil > 0 ? Math.min(ceil, next) : next;
    }
  }

  private getRetryDelayMs(): number {
    return Math.max(0, this.retryDelayMsDynamic || this.resolveDynamicRetryDelay());
  }

  private getMaxRetries(): number {
    const base = Math.max(0, this.config.crossPlatformMaxRetries || 0);
    const cut = Math.max(0, this.config.crossPlatformFailureMaxRetriesCut || 0);
    const minFloor = Math.max(0, this.config.crossPlatformFailureMaxRetriesMin || 0);
    const min = Math.min(base, minFloor);
    if ((this.circuitFailures > 0 || this.isDegraded()) && cut > 0) {
      return Math.max(min, base - cut);
    }
    return base;
  }

  private adjustFailureProfitBps(success: boolean): void {
    const bump = Math.max(0, this.config.crossPlatformFailureProfitBpsBump || 0);
    if (!bump) {
      return;
    }
    const maxBump = Math.max(bump, this.config.crossPlatformFailureProfitBpsBumpMax || bump * 5);
    const recover = this.config.crossPlatformFailureProfitBpsBumpRecover ?? 0.8;
    if (success) {
      if (recover > 0 && recover < 1) {
        this.failureProfitBpsBump = Math.max(0, Math.round(this.failureProfitBpsBump * recover));
      }
    } else {
      this.failureProfitBpsBump = Math.min(maxBump, this.failureProfitBpsBump + bump);
    }
  }

  private adjustFailureProfitUsd(success: boolean): void {
    const bump = Math.max(0, this.config.crossPlatformFailureProfitUsdBump || 0);
    if (!bump) {
      return;
    }
    const maxBump = Math.max(bump, this.config.crossPlatformFailureProfitUsdBumpMax || bump * 5);
    const recover = this.config.crossPlatformFailureProfitUsdBumpRecover ?? 0.8;
    if (success) {
      if (recover > 0 && recover < 1) {
        this.failureProfitUsdBump = Math.max(0, this.failureProfitUsdBump * recover);
      }
    } else {
      this.failureProfitUsdBump = Math.min(maxBump, this.failureProfitUsdBump + bump);
    }
  }

  private adjustFailureDepthUsd(success: boolean): void {
    const bump = Math.max(0, this.config.crossPlatformFailureLegMinDepthUsdBump || 0);
    if (!bump) {
      return;
    }
    const maxBump = Math.max(bump, this.config.crossPlatformFailureLegMinDepthUsdBumpMax || bump * 5);
    const recover = this.config.crossPlatformFailureLegMinDepthUsdBumpRecover ?? 0.8;
    if (success) {
      if (recover > 0 && recover < 1) {
        this.failureDepthUsdBump = Math.max(0, this.failureDepthUsdBump * recover);
      }
    } else {
      this.failureDepthUsdBump = Math.min(maxBump, this.failureDepthUsdBump + bump);
    }
  }

  private adjustFailureMinNotionalUsd(success: boolean): void {
    const bump = Math.max(0, this.config.crossPlatformFailureMinNotionalUsdBump || 0);
    if (!bump) {
      return;
    }
    const maxBump = Math.max(bump, this.config.crossPlatformFailureMinNotionalUsdBumpMax || bump * 5);
    const recover = this.config.crossPlatformFailureMinNotionalUsdBumpRecover ?? 0.8;
    if (success) {
      if (recover > 0 && recover < 1) {
        this.failureMinNotionalUsdBump = Math.max(0, this.failureMinNotionalUsdBump * recover);
      }
    } else {
      this.failureMinNotionalUsdBump = Math.min(maxBump, this.failureMinNotionalUsdBump + bump);
    }
  }

  private getStabilityBps(): number {
    const base = Math.max(0, this.stabilityBpsDynamic || this.resolveDynamicStability());
    if (this.circuitFailures > 0 || this.isDegraded()) {
      const bump = Math.max(0, this.config.crossPlatformFailureStabilityBps || 0);
      if (bump > 0) {
        return base + bump;
      }
    }
    if (this.isDegraded()) {
      const override = Math.max(0, this.config.crossPlatformDegradeStabilityBps || 0);
      if (override > 0) {
        return Math.min(base, override);
      }
    }
    return base;
  }

  private getSlippageBps(): number {
    if (this.config.crossPlatformSlippageDynamic === false) {
      const base = this.config.crossPlatformSlippageBps || 0;
      if (this.isConsistencyTemplateActive()) {
        const template = Math.max(0, this.config.crossPlatformConsistencyTemplateSlippageBps || 0);
        if (template > 0) {
          return Math.min(base, template);
        }
      }
      if (this.isDegraded()) {
        const override = Math.max(0, this.config.crossPlatformDegradeSlippageBps || 0);
        if (override > 0) {
          return Math.min(base, override);
        }
      }
      return base;
    }
    const floor = Math.max(0, this.config.crossPlatformSlippageFloorBps || 0);
    const ceil = Math.max(floor, this.config.crossPlatformSlippageCeilBps || 0);
    const value = this.slippageBpsDynamic || this.resolveDynamicSlippage();
    if (ceil > 0) {
      const base = Math.max(floor, Math.min(ceil, value));
      if (this.isConsistencyTemplateActive()) {
        const template = Math.max(0, this.config.crossPlatformConsistencyTemplateSlippageBps || 0);
        if (template > 0) {
          return Math.min(base, template);
        }
      }
      if (this.isDegraded()) {
        const override = Math.max(0, this.config.crossPlatformDegradeSlippageBps || 0);
        if (override > 0) {
          return Math.min(base, override);
        }
      }
      return base;
    }
    const base = Math.max(floor, value);
    if (this.isConsistencyTemplateActive()) {
      const template = Math.max(0, this.config.crossPlatformConsistencyTemplateSlippageBps || 0);
      if (template > 0) {
        return Math.min(base, template);
      }
    }
    if (this.isDegraded()) {
      const override = Math.max(0, this.config.crossPlatformDegradeSlippageBps || 0);
      if (override > 0) {
        return Math.min(base, override);
      }
    }
    return base;
  }

  private getEffectiveChunkFactor(): number {
    let factor = this.chunkFactor;
    if (this.isDegraded()) {
      const degrade = Math.max(0, this.config.crossPlatformDegradeChunkFactor || 0);
      if (degrade > 0) {
        factor *= degrade;
      }
    }
    if (this.isConsistencyTemplateActive()) {
      const template = Math.max(0, this.config.crossPlatformConsistencyTemplateChunkFactor || 0);
      if (template > 0) {
        factor *= template;
      }
    }
    return Math.max(0.05, factor);
  }

  private getEffectiveChunkDelayMs(): number {
    const base = Math.max(0, this.chunkDelayMs || 0);
    if (this.isDegraded()) {
      const extra = Math.max(0, this.config.crossPlatformDegradeChunkDelayMs || 0);
      return base + extra;
    }
    if (this.isConsistencyTemplateActive()) {
      const extra = Math.max(0, this.config.crossPlatformConsistencyTemplateChunkDelayMs || 0);
      return base + extra;
    }
    return base;
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
    this.applyFailurePause();
    this.applyDegrade('failure');
    this.tightenNetRiskBudget();
    this.adjustDepthRatioPenalty(false);
  }

  private onSuccess(): void {
    this.lastSuccessAt = Date.now();
    this.circuitFailures = 0;
    this.circuitOpenedAt = 0;
    this.resetFailurePause();
    this.updateDegradeOnSuccess();
    this.relaxNetRiskBudget();
    this.adjustDepthRatioPenalty(true);
  }

  private tightenNetRiskBudget(): void {
    if (this.config.crossPlatformNetRiskAutoTighten === false) {
      return;
    }
    const delta = Math.max(0, this.config.crossPlatformNetRiskTightenOnFailure || 0);
    if (delta <= 0) {
      return;
    }
    this.netRiskTightenFactor = Math.max(0.05, this.netRiskTightenFactor * (1 - delta));
  }

  private relaxNetRiskBudget(): void {
    if (this.config.crossPlatformNetRiskAutoTighten === false) {
      return;
    }
    const delta = Math.max(0, this.config.crossPlatformNetRiskRelaxOnSuccess || 0);
    if (delta <= 0) {
      return;
    }
    this.netRiskTightenFactor = Math.min(1, this.netRiskTightenFactor * (1 + delta));
  }

  private applyDegrade(reason: string): void {
    const durationMs = Math.max(0, this.config.crossPlatformDegradeMs || 0);
    if (!durationMs) {
      return;
    }
    const now = Date.now();
    this.degradedUntil = Math.max(this.degradedUntil, now + durationMs);
    this.degradedReason = reason;
    if (!this.degradedAt) {
      this.degradedAt = now;
    }
    this.degradedSuccesses = 0;
  }

  private isDegraded(): boolean {
    return this.degradedUntil > Date.now() || this.consistencyOverrideUntil > Date.now();
  }

  private updateDegradeOnSuccess(): void {
    if (!this.isDegraded()) {
      return;
    }
    this.degradedSuccesses += 1;
    const minMs = Math.max(0, this.config.crossPlatformDegradeExitMs || 0);
    const minSuccesses = Math.max(0, this.config.crossPlatformDegradeExitSuccesses || 0);
    const now = Date.now();
    if (minMs > 0 && this.degradedAt > 0 && now - this.degradedAt < minMs) {
      return;
    }
    if (minSuccesses > 0 && this.degradedSuccesses < minSuccesses) {
      return;
    }
    this.degradedUntil = 0;
    this.degradedAt = 0;
    this.degradedSuccesses = 0;
    this.degradedReason = '';
  }

  private shouldParallelSubmit(): boolean {
    if (this.config.crossPlatformParallelSubmit === false) {
      return false;
    }
    if (this.isDegraded() && this.config.crossPlatformDegradeForceSequential) {
      return false;
    }
    if (this.isConsistencyTemplateActive() && this.config.crossPlatformConsistencyTemplateForceSequential) {
      return false;
    }
    return true;
  }

  private resolveExecutionOptions(attempt: number): PlatformExecuteOptions {
    const fallback = this.getOrderTypeFallback(attempt);
    const degradeOrderType = this.isDegraded() ? this.config.crossPlatformDegradeOrderType : undefined;
    const consistencyOrderType =
      this.consistencyOverrideUntil > Date.now() || this.isConsistencyTemplateActive()
        ? this.config.crossPlatformConsistencyOrderType
        : undefined;
    const templateOrderType = this.isConsistencyTemplateActive() ? 'FOK' : undefined;
    const orderType =
      consistencyOrderType || templateOrderType || degradeOrderType || fallback || this.config.crossPlatformOrderType;

    let useFok = this.config.crossPlatformUseFok;
    if (this.isDegraded() && this.config.crossPlatformDegradeUseFok !== undefined) {
      useFok = this.config.crossPlatformDegradeUseFok;
    }
    if (this.isConsistencyTemplateActive() && this.config.crossPlatformConsistencyTemplateUseFok) {
      useFok = true;
    }

    let useLimit = this.config.crossPlatformLimitOrders;
    if (this.isDegraded() && this.config.crossPlatformDegradeLimitOrders !== undefined) {
      useLimit = this.config.crossPlatformDegradeLimitOrders;
    }
    if (this.isConsistencyTemplateActive() && this.config.crossPlatformConsistencyTemplateLimitOrders) {
      useLimit = true;
    }

    let batch = this.config.crossPlatformBatchOrders;
    if (this.isDegraded() && this.config.crossPlatformDegradeDisableBatch) {
      batch = false;
    }
    if (this.isConsistencyTemplateActive() && this.config.crossPlatformConsistencyTemplateDisableBatch) {
      batch = false;
    }

    return {
      useFok,
      useLimit,
      orderType,
      batch,
    };
  }

  private getOrderTypeFallback(attempt: number): string | undefined {
    const fallback = this.config.crossPlatformOrderTypeFallback;
    if (!fallback || fallback.length === 0) {
      return undefined;
    }
    if (attempt <= 0) {
      return undefined;
    }
    const index = Math.min(attempt - 1, fallback.length - 1);
    return fallback[index];
  }

  private applyFailurePause(): void {
    const base = Math.max(0, this.config.crossPlatformFailurePauseMs || 0);
    if (!base) {
      return;
    }
    const backoff = Math.max(1, this.config.crossPlatformFailurePauseBackoff || 1.5);
    const maxMs = Math.max(base, this.config.crossPlatformFailurePauseMaxMs || 0);
    if (this.failurePauseMs <= 0) {
      this.failurePauseMs = base;
    } else {
      this.failurePauseMs = Math.max(base, Math.round(this.failurePauseMs * backoff));
    }
    if (maxMs > 0) {
      this.failurePauseMs = Math.min(maxMs, this.failurePauseMs);
    }
    this.failurePauseUntil = Date.now() + this.failurePauseMs;
  }

  private resetFailurePause(): void {
    if (this.failurePauseMs > 0) {
      this.failurePauseMs = 0;
    }
    this.failurePauseUntil = 0;
  }

  private assertTokenHealthy(legs: PlatformLeg[]): void {
    this.assertTokenScore(legs);
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

  private assertPlatformHealthy(legs: PlatformLeg[]): void {
    const now = Date.now();
    const windowMs = Math.max(1000, this.config.crossPlatformPlatformFailureWindowMs || 60000);
    for (const leg of legs) {
      const state = this.platformFailures.get(leg.platform);
      if (!state) {
        continue;
      }
      if (state.cooldownUntil > now) {
        throw new Error(`Platform cooldown active for ${leg.platform}`);
      }
      if (now - state.windowStart > windowMs) {
        this.platformFailures.delete(leg.platform);
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

  private adjustTokenScores(legs: PlatformLeg[], delta: number): void {
    if (!delta) {
      return;
    }
    for (const leg of legs) {
      if (!leg.tokenId) continue;
      const current = this.tokenScores.get(leg.tokenId) || { score: 100, ts: Date.now() };
      const next = Math.max(0, Math.min(100, current.score + delta));
      this.tokenScores.set(leg.tokenId, { score: next, ts: Date.now() });
    }
  }

  private adjustPlatformScores(legs: PlatformLeg[], delta: number): void {
    if (!delta) {
      return;
    }
    for (const leg of legs) {
      this.adjustPlatformScoreSingle(leg.platform, delta);
    }
  }

  private recordPlatformFailure(legs: PlatformLeg[]): void {
    const now = Date.now();
    const maxFailures = Math.max(1, this.config.crossPlatformPlatformMaxFailures || 3);
    const windowMs = Math.max(1000, this.config.crossPlatformPlatformFailureWindowMs || 60000);
    const cooldownMs = Math.max(1000, this.config.crossPlatformPlatformCooldownMs || 120000);

    for (const leg of legs) {
      const state = this.platformFailures.get(leg.platform) || {
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

      this.platformFailures.set(leg.platform, state);
    }
  }

  private recordPlatformSuccess(legs: PlatformLeg[]): void {
    for (const leg of legs) {
      this.platformFailures.delete(leg.platform);
    }
  }

  private adjustPlatformScoreSingle(platform: ExternalPlatform, delta: number): void {
    if (!platform || !delta) {
      return;
    }
    const current = this.platformScores.get(platform) || { score: 100, ts: Date.now() };
    const next = Math.max(0, Math.min(100, current.score + delta));
    this.platformScores.set(platform, { score: next, ts: Date.now() });
  }

  private assertPlatformScore(legs: PlatformLeg[]): void {
    const minScore = Math.max(0, this.config.crossPlatformPlatformMinScore || 0);
    if (!minScore) {
      return;
    }
    for (const leg of legs) {
      const score = this.platformScores.get(leg.platform)?.score ?? 100;
      if (score < minScore) {
        throw new Error(`Platform score too low (${score}) for ${leg.platform}`);
      }
    }
  }

  private buildSet(values?: string[]): Set<string> | undefined {
    if (!values || values.length === 0) {
      return undefined;
    }
    return new Set(values.map((item) => item.trim()).filter((item) => item.length > 0));
  }

  private assertAllowlist(legs: PlatformLeg[]): void {
    const now = Date.now();
    for (const leg of legs) {
      if (!leg.tokenId) continue;
      const blockedUntil = this.blockedTokens.get(leg.tokenId) || 0;
      if (blockedUntil > now) {
        throw new Error(`Token blocked: ${leg.tokenId}`);
      }
    }
    for (const leg of legs) {
      const blockedUntil = this.blockedPlatforms.get(leg.platform) || 0;
      if (blockedUntil > now) {
        throw new Error(`Platform blocked: ${leg.platform}`);
      }
    }
    if (this.allowlistTokens) {
      for (const leg of legs) {
        if (!leg.tokenId) continue;
        if (!this.allowlistTokens.has(leg.tokenId)) {
          throw new Error(`Token not in allowlist: ${leg.tokenId}`);
        }
      }
    }
    if (this.blocklistTokens) {
      for (const leg of legs) {
        if (!leg.tokenId) continue;
        if (this.blocklistTokens.has(leg.tokenId)) {
          throw new Error(`Token blocked: ${leg.tokenId}`);
        }
      }
    }
    if (this.allowlistPlatforms) {
      for (const leg of legs) {
        if (!this.allowlistPlatforms.has(leg.platform)) {
          throw new Error(`Platform not in allowlist: ${leg.platform}`);
        }
      }
    }
    if (this.blocklistPlatforms) {
      for (const leg of legs) {
        if (this.blocklistPlatforms.has(leg.platform)) {
          throw new Error(`Platform blocked: ${leg.platform}`);
        }
      }
    }
  }

  private assertGlobalCooldown(): void {
    const now = Date.now();
    if (this.globalCooldownUntil > now) {
      throw new Error(`Global cooldown active until ${new Date(this.globalCooldownUntil).toISOString()}`);
    }
    if (this.failurePauseUntil > now) {
      throw new Error(`Failure pause active until ${new Date(this.failurePauseUntil).toISOString()}`);
    }
  }

  private maybeAutoBlock(legs: PlatformLeg[]): void {
    if (!this.config.crossPlatformAutoBlocklist) {
      return;
    }
    const cooldown = Math.max(1000, this.config.crossPlatformAutoBlocklistCooldownMs || 300000);
    const threshold = Math.max(0, this.config.crossPlatformAutoBlocklistScore || 30);
    const now = Date.now();
    for (const leg of legs) {
      if (leg.tokenId) {
        const score = this.tokenScores.get(leg.tokenId)?.score ?? 100;
        if (score <= threshold) {
          this.blockedTokens.set(leg.tokenId, now + cooldown);
        }
      }
      const platformScore = this.platformScores.get(leg.platform)?.score ?? 100;
      if (platformScore <= threshold) {
        this.blockedPlatforms.set(leg.platform, now + cooldown);
      }
    }
  }

  private checkGlobalCooldown(): void {
    const minQuality = this.config.crossPlatformGlobalMinQuality || 0;
    const cooldownMs = this.config.crossPlatformGlobalCooldownMs || 0;
    if (!minQuality || !cooldownMs) {
      return;
    }
    if (this.qualityScore <= minQuality) {
      this.globalCooldownUntil = Date.now() + cooldownMs;
    }
  }

  private adjustTokenScoreSingle(tokenId: string, delta: number): void {
    if (!tokenId || !delta) {
      return;
    }
    const current = this.tokenScores.get(tokenId) || { score: 100, ts: Date.now() };
    const next = Math.max(0, Math.min(100, current.score + delta));
    this.tokenScores.set(tokenId, { score: next, ts: Date.now() });
  }

  private assertTokenScore(legs: PlatformLeg[]): void {
    const minScore = Math.max(0, this.config.crossPlatformTokenMinScore || 0);
    if (!minScore) {
      return;
    }
    for (const leg of legs) {
      if (!leg.tokenId) continue;
      const score = this.tokenScores.get(leg.tokenId)?.score ?? 100;
      if (score < minScore) {
        throw new Error(`Token score too low (${score}) for ${leg.tokenId}`);
      }
    }
  }

  private updateQualityScore(success: boolean): void {
    if (this.config.crossPlatformAutoTune === false) {
      return;
    }
    const up = Math.max(0, this.config.crossPlatformAutoTuneUp || 0.03);
    const down = Math.max(0, this.config.crossPlatformAutoTuneDown || 0.08);
    const minFactor = Math.max(0.1, this.config.crossPlatformAutoTuneMinFactor || 0.5);
    const maxFactor = Math.max(minFactor, this.config.crossPlatformAutoTuneMaxFactor || 1.2);
    if (success) {
      this.qualityScore = Math.min(maxFactor, this.qualityScore + up);
    } else {
      this.qualityScore = Math.max(minFactor, this.qualityScore - down);
    }
  }

  private adjustChunkFactor(success: boolean): void {
    if (this.config.crossPlatformChunkAutoTune === false) {
      return;
    }
    const up = Math.max(0, this.config.crossPlatformChunkFactorUp || 0.1);
    const down = Math.max(0, this.config.crossPlatformChunkFactorDown || 0.2);
    const minFactor = Math.max(0.1, this.config.crossPlatformChunkFactorMin || 0.5);
    const maxFactor = Math.max(minFactor, this.config.crossPlatformChunkFactorMax || 1.5);
    if (success) {
      this.chunkFactor = Math.min(maxFactor, this.chunkFactor + up);
    } else {
      this.chunkFactor = Math.max(minFactor, this.chunkFactor - down);
    }
    if (success && this.config.crossPlatformSuccessChunkFactorUp) {
      this.chunkFactor = Math.min(maxFactor, this.chunkFactor + this.config.crossPlatformSuccessChunkFactorUp);
    }
    if (!success && this.config.crossPlatformFailureChunkFactorDown) {
      this.chunkFactor = Math.max(minFactor, this.chunkFactor - this.config.crossPlatformFailureChunkFactorDown);
    }
  }

  private adjustChunkDelay(success: boolean): void {
    if (this.config.crossPlatformChunkDelayAutoTune === false) {
      return;
    }
    const minMs = Math.max(0, this.config.crossPlatformChunkDelayMinMs ?? 0);
    const maxMs = Math.max(minMs, this.config.crossPlatformChunkDelayMaxMs ?? 4000);
    const up = Math.max(0, this.config.crossPlatformChunkDelayUpMs ?? 120);
    const down = Math.max(0, this.config.crossPlatformChunkDelayDownMs ?? 60);
    if (success) {
      this.chunkDelayMs = Math.max(minMs, this.chunkDelayMs - down);
    } else {
      this.chunkDelayMs = Math.min(maxMs, this.chunkDelayMs + up);
    }
    if (success && this.config.crossPlatformSuccessChunkDelayTightenMs) {
      this.chunkDelayMs = Math.max(minMs, this.chunkDelayMs - this.config.crossPlatformSuccessChunkDelayTightenMs);
    }
    if (!success && this.config.crossPlatformFailureChunkDelayBumpMs) {
      this.chunkDelayMs = Math.min(maxMs, this.chunkDelayMs + this.config.crossPlatformFailureChunkDelayBumpMs);
    }
  }

  private adjustDepthRatioPenalty(success: boolean): void {
    const up = Math.max(0, this.config.crossPlatformDepthRatioPenaltyUp ?? 0.08);
    const down = Math.max(0, this.config.crossPlatformDepthRatioPenaltyDown ?? 0.04);
    const maxPenalty = Math.max(0, this.config.crossPlatformDepthRatioPenaltyMax ?? 0.5);
    if (success) {
      this.depthRatioPenalty = Math.max(0, this.depthRatioPenalty - down);
    } else {
      this.depthRatioPenalty = Math.min(maxPenalty, this.depthRatioPenalty + up);
    }
  }

  private getDepthRatioPenaltyFactor(): number {
    return 1 + Math.max(0, this.depthRatioPenalty);
  }

  private getDepthRatioShrinkFloorFactor(): number {
    const penalty = Math.max(0, this.depthRatioPenalty);
    return Math.max(0.05, 1 - penalty * 0.5);
  }

  private applyQualityPenalty(multiplier: number): void {
    if (this.config.crossPlatformAutoTune === false) {
      return;
    }
    const down = Math.max(0, this.config.crossPlatformAutoTuneDown || 0.08);
    const minFactor = Math.max(0.1, this.config.crossPlatformAutoTuneMinFactor || 0.5);
    this.qualityScore = Math.max(minFactor, this.qualityScore - down * Math.max(0, multiplier));
  }

  private getAutoTuneFactor(): number {
    if (this.config.crossPlatformAutoTune === false) {
      return 1;
    }
    const minFactor = Math.max(0.1, this.config.crossPlatformAutoTuneMinFactor || 0.5);
    const maxFactor = Math.max(minFactor, this.config.crossPlatformAutoTuneMaxFactor || 1.2);
    return Math.max(minFactor, Math.min(maxFactor, this.qualityScore));
  }

  private classifyFailure(error: any): 'preflight' | 'execution' | 'postTrade' | 'hedge' | 'unknown' {
    const message = String(error?.message || error || '').toLowerCase();
    if (message.includes('soft block')) {
      return 'preflight';
    }
    if (message.includes('preflight')) {
      return 'preflight';
    }
    if (message.includes('consistency')) {
      return 'preflight';
    }
    if (message.includes('post-trade') || message.includes('post trade')) {
      return 'postTrade';
    }
    if (message.includes('hedge')) {
      return 'hedge';
    }
    if (message.includes('execution') || message.includes('submit') || message.includes('order')) {
      return 'execution';
    }
    return 'unknown';
  }

  private isConsistencyFailure(error: any): boolean {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('consistency');
  }

  private recordConsistencyFailure(error: any): void {
    if (!this.isConsistencyFailure(error)) {
      return;
    }
    const now = Date.now();
    const windowMs = Math.max(0, this.config.crossPlatformConsistencyFailWindowMs || 0);
    if (windowMs > 0) {
      if (!this.consistencyFailures.windowStart || now - this.consistencyFailures.windowStart > windowMs) {
        this.consistencyFailures.windowStart = now;
        this.consistencyFailures.count = 0;
      }
    }
    this.consistencyFailures.count += 1;
    this.lastConsistencyFailureAt = now;
    this.lastConsistencyFailureReason = String(error?.message || error || 'consistency failed').slice(0, 180);
    const limit = Math.max(0, this.config.crossPlatformConsistencyFailLimit || 0);
    if (limit > 0 && this.consistencyFailures.count >= limit) {
      const extraMs = Math.max(0, this.config.crossPlatformConsistencyDegradeMs || 0);
      if (extraMs > 0) {
        const useDegradeProfile = this.config.crossPlatformConsistencyUseDegradeProfile !== false;
        if (useDegradeProfile) {
          this.degradedUntil = Math.max(this.degradedUntil, now + extraMs);
          this.degradedReason = 'consistency';
          if (!this.degradedAt) {
            this.degradedAt = now;
          }
        } else {
          this.consistencyOverrideUntil = Math.max(this.consistencyOverrideUntil, now + extraMs);
        }
        if (this.config.crossPlatformConsistencyTemplateEnabled) {
          this.consistencyTemplateActiveUntil = Math.max(this.consistencyTemplateActiveUntil, now + extraMs);
        }
      }
      const penalty = Math.max(0, this.config.crossPlatformConsistencyPenalty || 0);
      if (penalty > 0) {
        this.applyQualityPenalty(penalty);
      }
    }
  }

  private isConsistencyTemplateActive(): boolean {
    return (
      this.config.crossPlatformConsistencyTemplateEnabled === true &&
      this.consistencyTemplateActiveUntil > Date.now()
    );
  }

  private applyFailureReasonPenalty(
    reason: 'preflight' | 'execution' | 'postTrade' | 'hedge' | 'unknown'
  ): void {
    if (this.config.crossPlatformAutoTune === false) {
      return;
    }
    let multiplier = 0;
    switch (reason) {
      case 'preflight':
        multiplier = Math.max(0, this.config.crossPlatformReasonPreflightPenalty || 0);
        break;
      case 'execution':
        multiplier = Math.max(0, this.config.crossPlatformReasonExecutionPenalty || 0);
        break;
      case 'postTrade':
        multiplier = Math.max(0, this.config.crossPlatformReasonPostTradePenalty || 0);
        break;
      case 'hedge':
        multiplier = Math.max(0, this.config.crossPlatformReasonHedgePenalty || 0);
        break;
      default:
        multiplier = 0;
    }
    if (multiplier > 0) {
      this.applyQualityPenalty(multiplier);
    }
  }

  private recordMetrics(input: {
    success: boolean;
    preflightMs: number;
    execMs: number;
    totalMs: number;
    error?: any;
    postTradeDriftBps?: number;
    reason?: 'preflight' | 'execution' | 'postTrade' | 'hedge' | 'unknown';
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
      if (this.metrics.lastError && this.metrics.lastError.toLowerCase().includes('soft block')) {
        this.metrics.softBlocks += 1;
      }
      if (input.reason) {
        this.metrics.failureReasons[input.reason] += 1;
      } else {
        this.metrics.failureReasons.unknown += 1;
      }
    }
    this.metrics.emaPreflightMs = this.updateEma(this.metrics.emaPreflightMs, input.preflightMs, alpha);
    this.metrics.emaExecMs = this.updateEma(this.metrics.emaExecMs, input.execMs, alpha);
    this.metrics.emaTotalMs = this.updateEma(this.metrics.emaTotalMs, input.totalMs, alpha);
    if (input.postTradeDriftBps !== undefined) {
      this.metrics.emaPostTradeDriftBps = this.updateEma(
        this.metrics.emaPostTradeDriftBps,
        input.postTradeDriftBps,
        alpha
      );
      if (input.postTradeDriftBps > 0) {
        this.metrics.postTradeAlerts += 1;
      }
    }
    this.logMetricsIfNeeded();
    void this.flushMetricsIfNeeded();
    void this.saveStateDebounced();
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
    const reasons = this.metrics.failureReasons;
    console.log(
      `[CrossExec] attempts=${this.metrics.attempts} success=${this.metrics.successes} fail=${this.metrics.failures} ` +
        `preflight=${this.metrics.emaPreflightMs.toFixed(0)}ms exec=${this.metrics.emaExecMs.toFixed(0)}ms ` +
        `total=${this.metrics.emaTotalMs.toFixed(0)}ms postDrift=${this.metrics.emaPostTradeDriftBps.toFixed(1)}bps ` +
        `alerts=${this.metrics.postTradeAlerts} softBlocks=${this.metrics.softBlocks} quality=${this.qualityScore.toFixed(2)} ` +
        `depthPenalty=${this.depthRatioPenalty.toFixed(2)} ` +
        `failures=preflight:${reasons.preflight} exec:${reasons.execution} post:${reasons.postTrade} hedge:${reasons.hedge} ` +
        `lastError=${this.metrics.lastError || 'none'}`
    );
  }

  private async flushMetricsIfNeeded(): Promise<void> {
    const target = this.config.crossPlatformMetricsPath;
    const interval = Math.max(0, this.config.crossPlatformMetricsFlushMs || 0);
    if (!target || !interval) {
      return;
    }
    const now = Date.now();
    if (now - this.lastMetricsFlush < interval) {
      return;
    }
    this.lastMetricsFlush = now;
    try {
      await this.writeJson(target, this.buildMetricsSnapshot());
    } catch (error) {
      console.warn('Cross-platform metrics flush failed:', error);
    }
  }

  private async saveStateDebounced(): Promise<void> {
    const target = this.config.crossPlatformStatePath;
    const interval = Math.max(0, this.config.crossPlatformMetricsFlushMs || 0);
    if (!target || !interval) {
      return;
    }
    const now = Date.now();
    if (now - this.lastStateFlush < interval) {
      return;
    }
    this.lastStateFlush = now;
    try {
      await this.writeJson(target, this.serializeState());
    } catch (error) {
      console.warn('Cross-platform state save failed:', error);
    }
  }

  private buildMetricsSnapshot(): Record<string, unknown> {
    return {
      version: 1,
      ts: Date.now(),
      metrics: { ...this.metrics },
      qualityScore: this.qualityScore,
      depthRatioPenalty: this.depthRatioPenalty,
      chunkFactor: this.chunkFactor,
      chunkDelayMs: this.chunkDelayMs,
      globalCooldownUntil: this.globalCooldownUntil,
      lastConsistencyFailureAt: this.lastConsistencyFailureAt,
      lastConsistencyFailureReason: this.lastConsistencyFailureReason,
      consistencyOverrideUntil: this.consistencyOverrideUntil,
      consistencyTemplateActiveUntil: this.consistencyTemplateActiveUntil,
      tokenScores: this.serializeTokenScores(),
      platformScores: this.serializePlatformScores(),
      blockedTokens: this.serializeBlockedTokens(),
      blockedPlatforms: this.serializeBlockedPlatforms(),
    };
  }

  private serializeState(): Record<string, unknown> {
    return {
      version: 1,
      ts: Date.now(),
      qualityScore: this.qualityScore,
      depthRatioPenalty: this.depthRatioPenalty,
      chunkFactor: this.chunkFactor,
      chunkDelayMs: this.chunkDelayMs,
      globalCooldownUntil: this.globalCooldownUntil,
      lastConsistencyFailureAt: this.lastConsistencyFailureAt,
      lastConsistencyFailureReason: this.lastConsistencyFailureReason,
      consistencyOverrideUntil: this.consistencyOverrideUntil,
      consistencyTemplateActiveUntil: this.consistencyTemplateActiveUntil,
      tokenScores: this.serializeTokenScores(),
      platformScores: this.serializePlatformScores(),
      blockedTokens: this.serializeBlockedTokens(),
      blockedPlatforms: this.serializeBlockedPlatforms(),
    };
  }

  private serializeTokenScores(): Array<{ tokenId: string; score: number; ts: number }> {
    return Array.from(this.tokenScores.entries()).map(([tokenId, entry]) => ({
      tokenId,
      score: entry.score,
      ts: entry.ts,
    }));
  }

  private serializePlatformScores(): Array<{ platform: ExternalPlatform; score: number; ts: number }> {
    return Array.from(this.platformScores.entries()).map(([platform, entry]) => ({
      platform,
      score: entry.score,
      ts: entry.ts,
    }));
  }

  private serializeBlockedTokens(): Array<{ tokenId: string; until: number }> {
    return Array.from(this.blockedTokens.entries()).map(([tokenId, until]) => ({
      tokenId,
      until,
    }));
  }

  private serializeBlockedPlatforms(): Array<{ platform: ExternalPlatform; until: number }> {
    return Array.from(this.blockedPlatforms.entries()).map(([platform, until]) => ({
      platform,
      until,
    }));
  }

  private async restoreState(): Promise<void> {
    const target = this.config.crossPlatformStatePath;
    if (!target) {
      return;
    }
    const resolved = this.resolvePath(target);
    let raw: string;
    try {
      raw = await fs.readFile(resolved, 'utf8');
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return;
      }
      throw error;
    }
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      console.warn('Cross-platform state parse failed:', error);
      return;
    }

    const minQuality = Math.max(0.1, this.config.crossPlatformAutoTuneMinFactor || 0.5);
    const maxQuality = Math.max(minQuality, this.config.crossPlatformAutoTuneMaxFactor || 1.2);
    if (Number.isFinite(data?.qualityScore)) {
      this.qualityScore = Math.min(maxQuality, Math.max(minQuality, Number(data.qualityScore)));
    }
    const maxPenalty = Math.max(0, this.config.crossPlatformDepthRatioPenaltyMax ?? 0.5);
    if (Number.isFinite(data?.depthRatioPenalty)) {
      this.depthRatioPenalty = Math.min(maxPenalty, Math.max(0, Number(data.depthRatioPenalty)));
    }

    const minChunk = Math.max(0.1, this.config.crossPlatformChunkFactorMin || 0.5);
    const maxChunk = Math.max(minChunk, this.config.crossPlatformChunkFactorMax || 1.5);
    if (Number.isFinite(data?.chunkFactor)) {
      this.chunkFactor = Math.min(maxChunk, Math.max(minChunk, Number(data.chunkFactor)));
    }

    const minDelay = Math.max(0, this.config.crossPlatformChunkDelayMinMs ?? 0);
    const maxDelay = Math.max(minDelay, this.config.crossPlatformChunkDelayMaxMs ?? 4000);
    if (Number.isFinite(data?.chunkDelayMs)) {
      this.chunkDelayMs = Math.min(maxDelay, Math.max(minDelay, Number(data.chunkDelayMs)));
    }

    if (Number.isFinite(data?.globalCooldownUntil)) {
      this.globalCooldownUntil = Number(data.globalCooldownUntil);
    }

    if (Number.isFinite(data?.lastConsistencyFailureAt)) {
      this.lastConsistencyFailureAt = Number(data.lastConsistencyFailureAt);
    }
    if (typeof data?.lastConsistencyFailureReason === 'string') {
      this.lastConsistencyFailureReason = data.lastConsistencyFailureReason;
    }
    if (Number.isFinite(data?.consistencyOverrideUntil)) {
      this.consistencyOverrideUntil = Number(data.consistencyOverrideUntil);
    }
    if (Number.isFinite(data?.consistencyTemplateActiveUntil)) {
      this.consistencyTemplateActiveUntil = Number(data.consistencyTemplateActiveUntil);
    }

    const platformSet = new Set<ExternalPlatform>(['Predict', 'Polymarket', 'Opinion']);

    if (Array.isArray(data?.tokenScores)) {
      for (const entry of data.tokenScores) {
        const tokenId = typeof entry?.tokenId === 'string' ? entry.tokenId : '';
        const score = Number(entry?.score);
        if (!tokenId || !Number.isFinite(score)) {
          continue;
        }
        const ts = Number.isFinite(entry?.ts) ? Number(entry.ts) : Date.now();
        this.tokenScores.set(tokenId, { score: Math.max(0, Math.min(100, score)), ts });
      }
    }

    if (Array.isArray(data?.platformScores)) {
      for (const entry of data.platformScores) {
        const platform = entry?.platform as ExternalPlatform;
        const score = Number(entry?.score);
        if (!platformSet.has(platform) || !Number.isFinite(score)) {
          continue;
        }
        const ts = Number.isFinite(entry?.ts) ? Number(entry.ts) : Date.now();
        this.platformScores.set(platform, { score: Math.max(0, Math.min(100, score)), ts });
      }
    }

    if (Array.isArray(data?.blockedTokens)) {
      for (const entry of data.blockedTokens) {
        const tokenId = typeof entry?.tokenId === 'string' ? entry.tokenId : '';
        const until = Number(entry?.until);
        if (tokenId && Number.isFinite(until) && until > Date.now()) {
          this.blockedTokens.set(tokenId, until);
        }
      }
    }

    if (Array.isArray(data?.blockedPlatforms)) {
      for (const entry of data.blockedPlatforms) {
        const platform = entry?.platform as ExternalPlatform;
        const until = Number(entry?.until);
        if (platformSet.has(platform) && Number.isFinite(until) && until > Date.now()) {
          this.blockedPlatforms.set(platform, until);
        }
      }
    }
  }

  private resolvePath(target: string): string {
    if (path.isAbsolute(target)) {
      return target;
    }
    return path.resolve(process.cwd(), target);
  }

  private async writeJson(target: string, payload: Record<string, unknown>): Promise<void> {
    const resolved = this.resolvePath(target);
    const dir = path.dirname(resolved);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${resolved}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
    await fs.rename(tmp, resolved);
  }

  private checkVolatility(leg: PlatformLeg, book: OrderbookSnapshot): void {
    const threshold = (this.config.crossPlatformVolatilityBps ?? 0) * this.getAutoTuneFactor();
    const lookbackMs = this.config.crossPlatformVolatilityLookbackMs ?? 0;
    const tokenId = leg.tokenId;
    if (!tokenId || threshold <= 0 || lookbackMs <= 0) {
      return;
    }
    const bestBid = Number.isFinite(book.bestBid) ? book.bestBid : undefined;
    const bestAsk = Number.isFinite(book.bestAsk) ? book.bestAsk : undefined;
    const price = bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : bestBid ?? bestAsk;
    if (!Number.isFinite(price) || !price) {
      return;
    }
    const now = Date.now();
    const prev = this.recentQuotes.get(tokenId);
    if (prev && now - prev.ts <= lookbackMs) {
      const drift = Math.abs((price - prev.price) / prev.price) * 10000;
      if (drift > threshold) {
        this.adjustTokenScoreSingle(tokenId, -Math.abs(this.config.crossPlatformTokenScoreOnVolatility || 10));
        this.adjustPlatformScoreSingle(
          leg.platform,
          -Math.abs(this.config.crossPlatformPlatformScoreOnVolatility || 6)
        );
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
  ): Promise<PreflightResult> {
    let maxDeviationBps = 0;
    let maxDriftBps = 0;
    const vwapByLeg = new Map<string, { avgAllIn: number; totalAllIn: number; filledShares: number }>();
    const deviationByLeg = new Map<string, number>();
    const driftByLeg = new Map<string, number>();
    const depthByLeg = new Map<string, { depthUsd: number; depthShares: number }>();
    this.legMarketQuality.clear();
    const extraDeviation =
      this.circuitFailures > 0 || this.isDegraded()
        ? Math.max(0, this.config.crossPlatformFailureVwapDeviationBps || 0)
        : 0;
    const deviationCap = Math.max(1, this.getSlippageBps() * this.getAutoTuneFactor() + extraDeviation);
    const depthRatioPenaltyFactor = this.getDepthRatioPenaltyFactor();
    const depthRatioSoftBase = Math.max(0, this.config.crossPlatformLegDepthRatioSoft || 0);
    const depthRatioSoft = Math.min(1, depthRatioSoftBase * depthRatioPenaltyFactor);
    const checks = legs.map(async (leg) => {
      if (!leg.tokenId || !leg.price || !leg.shares) {
        throw new Error(`Invalid leg for preflight: ${leg.platform}`);
      }
      const book = await this.fetchOrderbook(leg, cache);
      if (!book) {
        throw new Error(`Preflight failed: missing orderbook for ${leg.platform}:${leg.tokenId}`);
      }
      this.checkVolatility(leg, book);

      const levels = leg.side === 'BUY' ? book.asks : book.bids;
      const depthLevels = Math.max(0, this.config.crossPlatformDepthLevels || 0);
      const capped = depthLevels > 0 ? levels.slice(0, depthLevels) : levels;
      const depth = capped.reduce(
        (acc, entry) => {
          const price = Number(entry.price);
          const shares = Number(entry.shares);
          if (!Number.isFinite(price) || !Number.isFinite(shares) || price <= 0 || shares <= 0) {
            return acc;
          }
          acc.depthUsd += price * shares;
          acc.depthShares += shares;
          return acc;
        },
        { depthUsd: 0, depthShares: 0 }
      );
      depthByLeg.set(`${leg.platform}:${leg.tokenId}:${leg.side}`, depth);

      let minDepthUsd = Math.max(0, this.config.crossPlatformLegMinDepthUsd || 0);
      if (this.circuitFailures > 0 || this.isDegraded()) {
        minDepthUsd += Math.max(0, this.config.crossPlatformFailureLegMinDepthUsdAdd || 0);
      }
      if (this.failureDepthUsdBump > 0) {
        minDepthUsd += this.failureDepthUsdBump;
      }
      if (minDepthUsd > 0 && depth.depthUsd < minDepthUsd) {
        throw new Error(
          `Preflight failed: depth $${depth.depthUsd.toFixed(2)} < min $${minDepthUsd} for ${leg.platform}:${leg.tokenId}`
        );
      }

      const maxUsageRaw = Math.max(0, this.config.crossPlatformLegDepthUsageMax || 0);
      const maxUsage = Math.min(1, maxUsageRaw * this.getAutoTuneFactor());
      if (maxUsage > 0 && depth.depthShares > 0) {
        const usage = leg.shares / depth.depthShares;
        if (usage > maxUsage) {
          throw new Error(
            `Preflight failed: depth usage ${(usage * 100).toFixed(1)}% > max ${(maxUsage * 100).toFixed(1)}% for ${leg.platform}:${leg.tokenId}`
          );
        }
      }

      const feeBps = this.getFeeBps(leg.platform);
      const { curveRate, curveExponent } = this.getFeeCurve(leg.platform);
      const slippageBps = this.getSlippageBps();

      const vwap =
        leg.side === 'BUY'
          ? estimateBuy(book.asks, leg.shares, feeBps, curveRate, curveExponent, slippageBps)
          : estimateSell(book.bids, leg.shares, feeBps, curveRate, curveExponent, slippageBps);

      if (!vwap) {
        throw new Error(`Preflight failed: insufficient depth for ${leg.platform}:${leg.tokenId}`);
      }

      const legKey = `${leg.platform}:${leg.tokenId}:${leg.side}`;
      if (Number.isFinite(vwap.avgAllIn) && Number.isFinite(vwap.totalAllIn)) {
        vwapByLeg.set(legKey, {
          avgAllIn: vwap.avgAllIn,
          totalAllIn: vwap.totalAllIn,
          filledShares: vwap.filledShares,
        });
      }
      let maxLevels = this.config.crossPlatformMaxVwapLevels ?? 0;
      if (this.isConsistencyTemplateActive()) {
        const templateLevels = Math.max(0, this.config.crossPlatformConsistencyTemplateMaxVwapLevels || 0);
        if (templateLevels > 0) {
          maxLevels = maxLevels > 0 ? Math.min(maxLevels, templateLevels) : templateLevels;
        }
      }
      if ((this.circuitFailures > 0 || this.isDegraded()) && maxLevels > 0) {
        const cut = Math.max(0, this.config.crossPlatformFailureMaxVwapLevelsCut || 0);
        if (cut > 0) {
          maxLevels = Math.max(1, maxLevels - cut);
        }
      }
      if (maxLevels > 0 && vwap.levelsUsed > maxLevels) {
        throw new Error(
          `Preflight failed: VWAP depth ${vwap.levelsUsed} levels (max ${maxLevels}) for ${leg.platform}:${leg.tokenId}`
        );
      }

      const limit = leg.price;
      if (limit <= 0) {
        throw new Error(`Preflight failed: invalid price for ${leg.platform}:${leg.tokenId}`);
      }

      const driftBase = this.config.crossPlatformPriceDriftBps ?? 40;
      const driftBps = Math.max(1, driftBase * this.getAutoTuneFactor());
      const bestRef = leg.side === 'BUY' ? book.bestAsk : book.bestBid;
      if (bestRef && Number.isFinite(bestRef) && bestRef > 0) {
        const drift = Math.abs((bestRef - limit) / limit) * 10000;
        if (drift > driftBps) {
          throw new Error(
            `Preflight failed: price drift ${drift.toFixed(1)} bps (max ${driftBps}) for ${leg.platform}:${leg.tokenId}`
          );
        }
        if (drift > maxDriftBps) {
          maxDriftBps = drift;
        }
        driftByLeg.set(legKey, drift);
      }

      const vwapAllIn = Number.isFinite(vwap.avgAllIn) ? vwap.avgAllIn : vwap.avgPrice;
      const deviationBps =
        leg.side === 'BUY'
          ? ((vwapAllIn - limit) / limit) * 10000
          : ((limit - vwapAllIn) / limit) * 10000;
      deviationByLeg.set(legKey, deviationBps);

      const softThreshold = Math.max(0, (this.config.crossPlatformLegDeviationSoftBps || 0) * this.getAutoTuneFactor());
      if (softThreshold > 0 && deviationBps > softThreshold) {
        throw new Error(
          `Preflight soft block: VWAP deviates ${deviationBps.toFixed(1)} bps (soft ${softThreshold}) for ${leg.platform}:${leg.tokenId}`
        );
      }

      const maxDeviation = Math.max(1, this.getSlippageBps() * this.getAutoTuneFactor() + extraDeviation);
      if (deviationBps > maxDeviation) {
        throw new Error(
          `Preflight failed: VWAP deviates ${deviationBps.toFixed(1)} bps (max ${maxDeviation}) for ${leg.platform}:${leg.tokenId}`
        );
      }
      if (deviationBps > maxDeviationBps) {
        maxDeviationBps = deviationBps;
      }
    });

    await Promise.all(checks);
    const depthValues = Array.from(depthByLeg.values())
      .map((entry) => entry.depthUsd)
      .filter((val) => Number.isFinite(val) && val > 0);
    const maxDepthUsd = depthValues.length ? Math.max(...depthValues) : 0;
    if (maxDepthUsd > 0) {
      for (const [legKey, depth] of depthByLeg.entries()) {
        const depthRatio = depth.depthUsd / maxDepthUsd;
        const depthPenalty =
          depthRatioSoft > 0
            ? Math.max(0, Math.min(1, (depthRatioSoft - depthRatio) / depthRatioSoft))
            : Math.max(0, Math.min(1, 1 - depthRatio));
        const dev = deviationByLeg.get(legKey) ?? 0;
        const devPenalty = Math.max(0, Math.min(1, Math.abs(dev) / deviationCap));
        const quality = Math.max(0, Math.min(1, 1 - (devPenalty * 0.6 + depthPenalty * 0.4)));
        this.legMarketQuality.set(legKey, quality);
      }
    }
    const driftSpreadThreshold = Math.max(
      0,
      (this.config.crossPlatformLegDriftSpreadBps || 0) * this.getAutoTuneFactor()
    );
    if (driftSpreadThreshold > 0 && driftByLeg.size >= 2) {
      const values = Array.from(driftByLeg.values());
      const minDrift = Math.min(...values);
      const maxDrift = Math.max(...values);
      const spread = maxDrift - minDrift;
      if (spread > driftSpreadThreshold) {
        throw new Error(`Preflight failed: leg drift spread ${spread.toFixed(1)} bps (max ${driftSpreadThreshold})`);
      }
    }
    const depthRatioMin = Math.max(
      0,
      Math.min(1, (this.config.crossPlatformLegDepthRatioMin || 0) * this.getAutoTuneFactor() * depthRatioPenaltyFactor)
    );
    if (depthRatioMin > 0 && depthByLeg.size >= 2) {
      const values = Array.from(depthByLeg.values())
        .map((entry) => entry.depthUsd)
        .filter((val) => Number.isFinite(val) && val > 0);
      if (values.length >= 2) {
        const minDepth = Math.min(...values);
        const maxDepth = Math.max(...values);
        const ratio = maxDepth > 0 ? minDepth / maxDepth : 1;
        if (ratio < depthRatioMin) {
          throw new Error(
            `Preflight failed: leg depth ratio ${(ratio * 100).toFixed(1)}% < min ${(depthRatioMin * 100).toFixed(1)}%`
          );
        }
      }
    }

    const spreadThreshold = Math.max(
      0,
      (this.config.crossPlatformLegDeviationSpreadBps || 0) * this.getAutoTuneFactor()
    );
    if (spreadThreshold > 0 && deviationByLeg.size >= 2) {
      const values = Array.from(deviationByLeg.values());
      const minDev = Math.min(...values);
      const maxDev = Math.max(...values);
      const spread = maxDev - minDev;
      if (spread > spreadThreshold) {
        throw new Error(`Preflight failed: leg deviation spread ${spread.toFixed(1)} bps (max ${spreadThreshold})`);
      }
    }
    return { maxDeviationBps, maxDriftBps, vwapByLeg };
  }

  private async prepareLegs(legs: PlatformLeg[]): Promise<PlatformLeg[]> {
    const cache = new Map<string, Promise<OrderbookSnapshot | null>>();
    let adjustedLegs = legs;

    await this.stabilityCheck(legs);
    this.lastPreflight = undefined;
    this.lastBatchPreflight = undefined;

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

    const ratioShrink = await this.getLegDepthRatioShrinkFactor(adjustedLegs, cache);
    if (ratioShrink !== null && ratioShrink < 1) {
      adjustedLegs = adjustedLegs.map((leg) => ({ ...leg, shares: Math.max(1, leg.shares * ratioShrink) }));
    }

    const usageCap = await this.getMaxLegDepthUsageShares(adjustedLegs, cache);
    if (usageCap !== null) {
      if (usageCap <= 0) {
        throw new Error('Preflight failed: insufficient depth for usage cap');
      }
      const target = Math.min(...adjustedLegs.map((leg) => leg.shares));
      if (usageCap < target) {
        adjustedLegs = adjustedLegs.map((leg) => ({ ...leg, shares: usageCap }));
      }
    }

    const notionalCap = this.config.crossPlatformMaxNotional ?? 0;
    if (notionalCap > 0) {
      const currentNotional = adjustedLegs.reduce((sum, leg) => sum + leg.price * leg.shares, 0);
      if (currentNotional > notionalCap) {
        const factor = notionalCap / currentNotional;
        adjustedLegs = adjustedLegs.map((leg) => ({ ...leg, shares: leg.shares * factor }));
      }
    }

    await this.consistencyCheck(adjustedLegs);

    if (this.config.crossPlatformExecutionVwapCheck !== false) {
      const preflight = await this.preflightVwapWithCache(adjustedLegs, cache);
      const finalPreflight = await this.maybeRecheckPreflight(adjustedLegs, preflight);
      this.lastPreflight = finalPreflight;
      this.lastBatchPreflight = finalPreflight;
    }

    return adjustedLegs;
  }

  private async consistencyCheck(legs: PlatformLeg[]): Promise<void> {
    const samples = Math.max(0, this.config.crossPlatformConsistencySamples || 0);
    if (samples <= 1) {
      return;
    }
    const intervalMs = Math.max(0, this.config.crossPlatformConsistencyIntervalMs || 0);
    const vwapMaxBps = Math.max(0, (this.config.crossPlatformConsistencyVwapBps || 0) * this.getAutoTuneFactor());
    const vwapDriftBps = Math.max(0, (this.config.crossPlatformConsistencyVwapDriftBps || 0) * this.getAutoTuneFactor());
    const ratioMin = Math.max(
      0,
      Math.min(
        1,
        (this.config.crossPlatformConsistencyDepthRatioMin || 0) *
          this.getAutoTuneFactor() *
          this.getDepthRatioPenaltyFactor()
      )
    );
    const ratioDrift = Math.max(
      0,
      Math.min(1, (this.config.crossPlatformConsistencyDepthRatioDrift || 0) * this.getAutoTuneFactor())
    );
    const depthLevels = Math.max(0, this.config.crossPlatformDepthLevels || 0);
    const deviationSamples = new Map<string, number[]>();
    const ratioSamples: number[] = [];

    for (let i = 0; i < samples; i += 1) {
      const depthByLeg = new Map<string, number>();
      for (const leg of legs) {
        const book = await this.fetchOrderbookInternal(leg);
        if (!book) {
          throw new Error(`Preflight failed: consistency missing orderbook for ${leg.platform}:${leg.tokenId}`);
        }
        const levels = leg.side === 'BUY' ? book.asks : book.bids;
        const capped = depthLevels > 0 ? levels.slice(0, depthLevels) : levels;
        const depthUsd = capped.reduce((sum, entry) => {
          const price = Number(entry.price);
          const shares = Number(entry.shares);
          if (!Number.isFinite(price) || !Number.isFinite(shares) || price <= 0 || shares <= 0) {
            return sum;
          }
          return sum + price * shares;
        }, 0);
        if (!Number.isFinite(depthUsd) || depthUsd <= 0) {
          throw new Error(`Preflight failed: consistency invalid depth for ${leg.platform}:${leg.tokenId}`);
        }
        const legKey = `${leg.platform}:${leg.tokenId}:${leg.side}`;
        depthByLeg.set(legKey, depthUsd);

        const feeBps = this.getFeeBps(leg.platform);
        const { curveRate, curveExponent } = this.getFeeCurve(leg.platform);
        const slippageBps = this.getSlippageBps();
        const vwap =
          leg.side === 'BUY'
            ? estimateBuy(book.asks, leg.shares, feeBps, curveRate, curveExponent, slippageBps)
            : estimateSell(book.bids, leg.shares, feeBps, curveRate, curveExponent, slippageBps);
        if (!vwap) {
          throw new Error(`Preflight failed: consistency insufficient VWAP depth for ${leg.platform}:${leg.tokenId}`);
        }
        const limit = leg.price;
        if (!Number.isFinite(limit) || limit <= 0) {
          throw new Error(`Preflight failed: consistency invalid price for ${leg.platform}:${leg.tokenId}`);
        }
        const vwapAllIn = Number.isFinite(vwap.avgAllIn) ? vwap.avgAllIn : vwap.avgPrice;
        const deviationBps =
          leg.side === 'BUY'
            ? ((vwapAllIn - limit) / limit) * 10000
            : ((limit - vwapAllIn) / limit) * 10000;
        if (vwapMaxBps > 0 && deviationBps > vwapMaxBps) {
          throw new Error(
            `Preflight failed: consistency VWAP deviates ${deviationBps.toFixed(1)} bps (max ${vwapMaxBps}) for ${leg.platform}:${leg.tokenId}`
          );
        }
        const list = deviationSamples.get(legKey) || [];
        list.push(deviationBps);
        deviationSamples.set(legKey, list);
      }

      if (depthByLeg.size >= 2) {
        const depths = Array.from(depthByLeg.values()).filter((val) => Number.isFinite(val) && val > 0);
        if (depths.length >= 2) {
          const minDepth = Math.min(...depths);
          const maxDepth = Math.max(...depths);
          const ratio = maxDepth > 0 ? minDepth / maxDepth : 1;
          ratioSamples.push(ratio);
          if (ratioMin > 0 && ratio < ratioMin) {
            throw new Error(
              `Preflight failed: consistency leg depth ratio ${(ratio * 100).toFixed(1)}% < min ${(ratioMin * 100).toFixed(1)}%`
            );
          }
        }
      }

      if (i < samples - 1 && intervalMs > 0) {
        await this.sleep(intervalMs);
      }
    }

    if (vwapDriftBps > 0) {
      for (const [legKey, list] of deviationSamples.entries()) {
        if (list.length <= 1) {
          continue;
        }
        const minDev = Math.min(...list);
        const maxDev = Math.max(...list);
        const drift = maxDev - minDev;
        if (drift > vwapDriftBps) {
          throw new Error(
            `Preflight failed: consistency VWAP drift ${drift.toFixed(1)} bps (max ${vwapDriftBps}) for ${legKey}`
          );
        }
      }
    }
    if (ratioDrift > 0 && ratioSamples.length > 1) {
      const minRatio = Math.min(...ratioSamples);
      const maxRatio = Math.max(...ratioSamples);
      const drift = maxRatio - minRatio;
      if (drift > ratioDrift) {
        throw new Error(
          `Preflight failed: consistency leg depth ratio drift ${(drift * 100).toFixed(1)}% (max ${(ratioDrift * 100).toFixed(1)}%)`
        );
      }
    }
  }

  private async stabilityCheck(legs: PlatformLeg[]): Promise<void> {
    let samples = Math.max(1, this.config.crossPlatformStabilitySamples || 1);
    let intervalMs = Math.max(0, this.config.crossPlatformStabilityIntervalMs || 0);
    if (this.circuitFailures > 0 || this.isDegraded()) {
      samples += Math.max(0, this.config.crossPlatformFailureStabilitySamplesAdd || 0);
      intervalMs += Math.max(0, this.config.crossPlatformFailureStabilityIntervalAddMs || 0);
    }
    const maxSamples = Math.max(0, this.config.crossPlatformFailureStabilitySamplesMax || 0);
    if (maxSamples > 0) {
      samples = Math.min(samples, maxSamples);
    }
    const maxInterval = Math.max(0, this.config.crossPlatformFailureStabilityIntervalMaxMs || 0);
    if (maxInterval > 0) {
      intervalMs = Math.min(intervalMs, maxInterval);
    }
    const threshold = Math.max(0, this.getStabilityBps() * this.getAutoTuneFactor());
    if (samples <= 1 || threshold <= 0) {
      return;
    }

    const baseline = new Map<string, number>();
    for (let i = 0; i < samples; i += 1) {
      for (const leg of legs) {
        const book = await this.fetchOrderbookInternal(leg);
        if (!book) {
          continue;
        }
        const ref = leg.side === 'BUY' ? book.bestAsk : book.bestBid;
        if (!ref || !Number.isFinite(ref)) {
          continue;
        }
        const key = `${leg.platform}:${leg.tokenId}:${leg.side}`;
        if (!baseline.has(key)) {
          baseline.set(key, ref);
        } else {
          const base = baseline.get(key)!;
          const drift = Math.abs((ref - base) / base) * 10000;
          if (drift > threshold) {
            this.adjustTokenScoreSingle(
              leg.tokenId,
              -Math.abs(this.config.crossPlatformTokenScoreOnVolatility || 10)
            );
            this.adjustPlatformScoreSingle(
              leg.platform,
              -Math.abs(this.config.crossPlatformPlatformScoreOnVolatility || 6)
            );
            throw new Error(`Preflight failed: unstable book ${drift.toFixed(1)} bps (max ${threshold}) for ${leg.tokenId}`);
          }
        }
      }
      if (i < samples - 1 && intervalMs > 0) {
        await this.sleep(intervalMs);
      }
    }
  }

  private async getMaxExecutableShares(
    legs: PlatformLeg[],
    cache: Map<string, Promise<OrderbookSnapshot | null>>
  ): Promise<number> {
    const maxDeviation = Math.max(1, this.getSlippageBps() * this.getAutoTuneFactor());
    const slippageBps = this.getSlippageBps();
    let usage = Math.max(0.05, Math.min(1, (this.config.crossPlatformDepthUsage ?? 0.5) * this.getAutoTuneFactor()));
    if (this.isConsistencyTemplateActive()) {
      const templateUsage = Math.max(0, this.config.crossPlatformConsistencyTemplateDepthUsage || 0);
      if (templateUsage > 0) {
        usage = Math.min(usage, templateUsage);
      }
    }
    const depths = await Promise.all(
      legs.map(async (leg) => {
        const book = await this.fetchOrderbook(leg, cache);
        if (!book) {
          return 0;
        }
        this.checkVolatility(leg, book);
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
    const minDepth = Math.min(...depths.filter((x) => Number.isFinite(x)));
    const minAllowed = this.config.crossPlatformMinDepthShares ?? 1;
    if (!Number.isFinite(minDepth) || minDepth <= 0 || minDepth < minAllowed) {
      throw new Error(`Preflight failed: insufficient depth (min ${minAllowed})`);
    }
    return minDepth * Math.max(0, Math.min(1, usage));
  }

  private async getMaxLegDepthUsageShares(
    legs: PlatformLeg[],
    cache: Map<string, Promise<OrderbookSnapshot | null>>
  ): Promise<number | null> {
    const base = Math.max(0, this.config.crossPlatformLegDepthUsageMax || 0);
    if (!base) {
      return null;
    }
    const maxUsage = Math.min(1, base * this.getAutoTuneFactor());
    if (maxUsage <= 0) {
      return null;
    }
    const depthLevels = Math.max(0, this.config.crossPlatformDepthLevels || 0);
    let cap = Number.POSITIVE_INFINITY;
    let found = false;
    for (const leg of legs) {
      const book = await this.fetchOrderbook(leg, cache);
      if (!book) {
        continue;
      }
      found = true;
      const levels = leg.side === 'BUY' ? book.asks : book.bids;
      const capped = depthLevels > 0 ? levels.slice(0, depthLevels) : levels;
      const depthShares = capped.reduce((sum, entry) => {
        const shares = Number(entry.shares);
        return sum + (Number.isFinite(shares) && shares > 0 ? shares : 0);
      }, 0);
      if (depthShares <= 0) {
        return 0;
      }
      cap = Math.min(cap, depthShares * maxUsage);
    }
    if (!found || !Number.isFinite(cap)) {
      return null;
    }
    return cap;
  }

  private async getLegDepthRatioShrinkFactor(
    legs: PlatformLeg[],
    cache: Map<string, Promise<OrderbookSnapshot | null>>
  ): Promise<number | null> {
    const baseSoft = Math.max(0, this.config.crossPlatformLegDepthRatioSoft || 0);
    const soft = Math.max(0, Math.min(1, baseSoft * this.getDepthRatioPenaltyFactor()));
    if (!soft) {
      return null;
    }
    const depthLevels = Math.max(0, this.config.crossPlatformDepthLevels || 0);
    let minDepth = Number.POSITIVE_INFINITY;
    let maxDepth = 0;
    let found = false;
    for (const leg of legs) {
      const book = await this.fetchOrderbook(leg, cache);
      if (!book) {
        continue;
      }
      const levels = leg.side === 'BUY' ? book.asks : book.bids;
      const capped = depthLevels > 0 ? levels.slice(0, depthLevels) : levels;
      const depthUsd = capped.reduce((sum, entry) => {
        const price = Number(entry.price);
        const shares = Number(entry.shares);
        if (!Number.isFinite(price) || !Number.isFinite(shares) || price <= 0 || shares <= 0) {
          return sum;
        }
        return sum + price * shares;
      }, 0);
      if (!Number.isFinite(depthUsd) || depthUsd <= 0) {
        continue;
      }
      found = true;
      minDepth = Math.min(minDepth, depthUsd);
      maxDepth = Math.max(maxDepth, depthUsd);
    }
    if (!found || !Number.isFinite(minDepth) || !Number.isFinite(maxDepth) || maxDepth <= 0) {
      return null;
    }
    const ratio = minDepth / maxDepth;
    if (ratio >= soft) {
      return 1;
    }
    const baseMinFactor = Math.max(0.1, Math.min(1, this.config.crossPlatformLegDepthRatioShrinkMinFactor || 0.3));
    const minFactor = Math.max(0.05, Math.min(1, baseMinFactor * this.getDepthRatioShrinkFloorFactor()));
    return Math.max(minFactor, ratio / soft);
  }

  private async maybeRecheckPreflight(
    legs: PlatformLeg[],
    stats: { maxDeviationBps: number; maxDriftBps: number }
  ): Promise<{ maxDeviationBps: number; maxDriftBps: number }> {
    const recheckMs = Math.max(0, this.config.crossPlatformRecheckMs || 0);
    if (!recheckMs) {
      return stats;
    }
    const deviationTrigger = Math.max(0, this.config.crossPlatformRecheckDeviationBps || 0);
    const driftTrigger = Math.max(0, this.config.crossPlatformRecheckDriftBps || 0);
    const shouldRecheck =
      (deviationTrigger > 0 && stats.maxDeviationBps >= deviationTrigger) ||
      (driftTrigger > 0 && stats.maxDriftBps >= driftTrigger);
    if (!shouldRecheck) {
      return stats;
    }
    await this.sleep(recheckMs);
    const freshCache = new Map<string, Promise<OrderbookSnapshot | null>>();
    return this.preflightVwapWithCache(legs, freshCache);
  }

  private assertMinNotionalAndProfit(legs: PlatformLeg[]): void {
    let minNotional = Math.max(0, this.config.crossPlatformMinNotionalUsd || 0);
    let baseProfit = Math.max(0, this.config.crossPlatformMinProfitUsd || 0);
    let baseBps = Math.max(0, this.config.crossPlatformMinProfitBps || 0);
    if (this.isConsistencyTemplateActive()) {
      const templateNotional = Math.max(0, this.config.crossPlatformConsistencyTemplateMinNotionalUsd || 0);
      const templateProfit = Math.max(0, this.config.crossPlatformConsistencyTemplateMinProfitUsd || 0);
      const templateBps = Math.max(0, this.config.crossPlatformConsistencyTemplateMinProfitBps || 0);
      minNotional = Math.max(minNotional, templateNotional);
      baseProfit = Math.max(baseProfit, templateProfit);
      baseBps = Math.max(baseBps, templateBps);
    }
    if (!minNotional && !baseProfit) {
      return;
    }
    if (!legs.length) {
      return;
    }
    const shares = Math.min(...legs.map((leg) => leg.shares));
    if (!Number.isFinite(shares) || shares <= 0) {
      return;
    }

    const slippage = this.getSlippageBps() / 10000;
    let totalCostPerShare = 0;
    let totalProceedsPerShare = 0;
    let hasBuy = false;
    let hasSell = false;
    const vwapByLeg = this.lastPreflight?.vwapByLeg || this.lastBatchPreflight?.vwapByLeg;

    let hasMissingVwap = false;
    for (const leg of legs) {
      const feeBps = this.getFeeBps(leg.platform);
      const { curveRate, curveExponent } = this.getFeeCurve(leg.platform);
      const fee = calcFeeCost(leg.price, feeBps, curveRate, curveExponent);
      const legKey = `${leg.platform}:${leg.tokenId}:${leg.side}`;
      const vwap = vwapByLeg?.get(legKey);
      const useVwap =
        vwap &&
        Number.isFinite(vwap.avgAllIn) &&
        Number.isFinite(vwap.filledShares) &&
        vwap.filledShares > 0 &&
        Math.abs(vwap.filledShares - leg.shares) / leg.shares < 0.01;
      if (!useVwap) {
        hasMissingVwap = true;
      }
      const unitAllIn = useVwap ? vwap.avgAllIn : leg.price + fee + leg.price * slippage;
      const unitAllInSell = useVwap ? vwap.avgAllIn : leg.price - fee - leg.price * slippage;
      if (leg.side === 'BUY') {
        hasBuy = true;
        totalCostPerShare += unitAllIn;
      } else {
        hasSell = true;
        totalProceedsPerShare += unitAllInSell;
      }
    }

    const transfer = Math.max(0, this.config.crossPlatformTransferCost || 0);
    let notional = 0;
    let profit = 0;

    if (hasBuy && !hasSell) {
      notional = totalCostPerShare * shares;
      profit = (1 - totalCostPerShare - transfer) * shares;
    } else if (hasSell && !hasBuy) {
      notional = totalProceedsPerShare * shares;
      profit = (totalProceedsPerShare - 1 - transfer) * shares;
    } else {
      // Mixed legs: conservative net calculation
      notional = Math.max(totalCostPerShare, totalProceedsPerShare) * shares;
      profit = (totalProceedsPerShare - totalCostPerShare - transfer) * shares;
    }

    const failureMult = this.circuitFailures > 0 || this.isDegraded() ? 1 : 0;
    const failureNotional = Math.max(0, this.config.crossPlatformFailureMinNotionalUsdAdd || 0) * failureMult;
    const requiredNotional = minNotional + failureNotional + this.failureMinNotionalUsdBump;
    if (requiredNotional > 0 && notional < requiredNotional) {
      throw new Error(`Preflight failed: notional $${notional.toFixed(2)} < min ${requiredNotional}`);
    }
    const failureBps = Math.max(0, this.config.crossPlatformFailureProfitBps || 0);
    const failureUsd = Math.max(0, this.config.crossPlatformFailureProfitUsd || 0);
    const impactMult = Math.max(0, this.config.crossPlatformMinProfitImpactMult || 0);
    const impactBps = Math.max(0, this.lastPreflight?.maxDeviationBps || 0);
    let requiredBps = baseBps + failureBps * failureMult + this.failureProfitBpsBump;
    const bpsCap = Math.max(0, this.config.crossPlatformFailureProfitBpsCap || 0);
    if (bpsCap > 0) {
      requiredBps = Math.min(requiredBps, bpsCap);
    }
    const qualityFactor = this.getQualityProfitFactor(legs);
    let required =
      baseProfit +
      failureUsd * failureMult +
      this.failureProfitUsdBump +
      notional * (requiredBps / 10000) +
      notional * (impactBps / 10000) * impactMult;
    if (qualityFactor > 1) {
      required *= qualityFactor;
    }
    if (hasMissingVwap) {
      const penaltyBps = Math.max(0, this.config.crossPlatformMissingVwapPenaltyBps || 0);
      if (penaltyBps > 0) {
        let vwapPenalty = notional * (penaltyBps / 10000);
        if (qualityFactor > 1) {
          vwapPenalty *= qualityFactor;
        }
        if (profit < required + vwapPenalty) {
          throw new Error(
            `Preflight failed: missing VWAP coverage, profit $${profit.toFixed(2)} < min ${(required + vwapPenalty).toFixed(2)}`
          );
        }
      }
    }
    if (required > 0 && profit < required) {
      throw new Error(
        `Preflight failed: profit $${profit.toFixed(2)} < min ${required.toFixed(2)} (impact ${impactBps.toFixed(1)} bps)`
      );
    }
  }

  private getQualityProfitFactor(legs: PlatformLeg[]): number {
    const mult = Math.max(0, this.config.crossPlatformQualityProfitMult || 0);
    if (!mult) {
      return 1;
    }
    const score = this.groupQualityScore(legs);
    const quality = Math.max(0, Math.min(1, score / 100));
    let factor = 1 + (1 - quality) * mult;
    const maxFactor = Math.max(0, this.config.crossPlatformQualityProfitMax || 0);
    if (maxFactor > 1) {
      factor = Math.min(factor, maxFactor);
    }
    return Math.max(1, factor);
  }

  private async postTradeCheck(legs: PlatformLeg[]): Promise<{
    maxDriftBps: number;
    penalizedLegs: PlatformLeg[];
    penalizedTokenIds: Set<string>;
    spreadPenalizedLegs: PlatformLeg[];
  }> {
    const threshold = Math.max(0, this.config.crossPlatformPostTradeDriftBps || 0);
    if (!threshold) {
      return { maxDriftBps: 0, penalizedLegs: [], penalizedTokenIds: new Set(), spreadPenalizedLegs: [] };
    }

    let maxDriftBps = 0;
    const penalizedLegs: PlatformLeg[] = [];
    const penalizedTokenIds = new Set<string>();
    const drifts: Array<{ leg: PlatformLeg; drift: number }> = [];
    const depthUsdThreshold = Math.max(0, this.config.crossPlatformLegMinDepthUsd || 0);

    for (const leg of legs) {
      const book = await this.fetchOrderbookInternal(leg);
      if (!book) {
        continue;
      }
      const ref = leg.side === 'BUY' ? book.bestAsk : book.bestBid;
      if (!ref || !Number.isFinite(ref) || !Number.isFinite(leg.price) || leg.price <= 0) {
        continue;
      }
      const drift = Math.abs((ref - leg.price) / leg.price) * 10000;
      drifts.push({ leg, drift });
      if (drift > maxDriftBps) {
        maxDriftBps = drift;
      }
      if (drift >= threshold) {
        penalizedLegs.push(leg);
        if (leg.tokenId) {
          penalizedTokenIds.add(leg.tokenId);
        }
        this.adjustPlatformScoreSingle(
          leg.platform,
          -Math.abs(this.config.crossPlatformPlatformScoreOnPostTrade || 8)
        );
      }
      if (depthUsdThreshold > 0) {
        const depthShares = Number(book.bids?.[0]?.shares ?? 0) + Number(book.asks?.[0]?.shares ?? 0);
        const mid = (book.bestBid && book.bestAsk) ? (book.bestBid + book.bestAsk) / 2 : ref;
        const depthUsd = depthShares * (Number.isFinite(mid) ? mid : 0);
        if (depthUsd < depthUsdThreshold) {
          penalizedLegs.push(leg);
          if (leg.tokenId) {
            penalizedTokenIds.add(leg.tokenId);
          }
        }
      }
    }

    const spreadPenalizedLegs: PlatformLeg[] = [];
    const spreadThreshold = Math.max(0, this.config.crossPlatformLegDriftSpreadBps || 0);
    if (spreadThreshold > 0 && drifts.length >= 2) {
      const driftValues = drifts.map((d) => d.drift);
      const minDrift = Math.min(...driftValues);
      const maxDrift = Math.max(...driftValues);
      if (maxDrift - minDrift > spreadThreshold) {
        const cutoff = maxDrift - spreadThreshold / 2;
        for (const entry of drifts) {
          if (entry.drift >= cutoff) {
            spreadPenalizedLegs.push(entry.leg);
          }
        }
      }
    }

    const vwapThreshold = Math.max(0, this.config.crossPlatformLegVwapDeviationBps || 0);
    if (vwapThreshold > 0 && drifts.length >= 2) {
      for (const entry of drifts) {
        if (entry.drift >= vwapThreshold) {
          spreadPenalizedLegs.push(entry.leg);
        }
      }
    }

    if (penalizedLegs.length > 0) {
      console.warn(`[CrossExec] post-trade drift exceeded ${threshold} bps on ${penalizedLegs.length} legs`);
      if (this.config.crossPlatformDegradeOnPostTrade) {
        this.applyDegrade('post-trade drift');
      }
    }

    if (spreadPenalizedLegs.length > 0 && (spreadThreshold > 0 || vwapThreshold > 0)) {
      console.warn(
        `[CrossExec] drift spread/vwap exceeded on ${spreadPenalizedLegs.length} legs`
      );
      for (const leg of spreadPenalizedLegs) {
        this.adjustPlatformScoreSingle(
          leg.platform,
          -Math.abs(this.config.crossPlatformPlatformScoreOnSpread || 6)
        );
      }
    }

    return { maxDriftBps, penalizedLegs, penalizedTokenIds, spreadPenalizedLegs };
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

  private shouldHedgeLegs(
    legs: PlatformLeg[],
    minProfitUsd: number,
    minEdge: number,
    slippageBps: number
  ): boolean {
    if (!legs.length) {
      return false;
    }
    if (minProfitUsd <= 0 && minEdge <= 0) {
      return true;
    }

    const shares = Math.min(...legs.map((leg) => leg.shares));
    if (!Number.isFinite(shares) || shares <= 0) {
      return false;
    }
    const slippage = slippageBps / 10000;
    let totalCostPerShare = 0;
    let totalProceedsPerShare = 0;
    let hasBuy = false;
    let hasSell = false;
    const vwapByLeg = this.lastPreflight?.vwapByLeg || this.lastBatchPreflight?.vwapByLeg;

    for (const leg of legs) {
      const feeBps = this.getFeeBps(leg.platform);
      const { curveRate, curveExponent } = this.getFeeCurve(leg.platform);
      const fee = calcFeeCost(leg.price, feeBps, curveRate, curveExponent);
      const legKey = `${leg.platform}:${leg.tokenId}:${leg.side}`;
      const vwap = vwapByLeg?.get(legKey);
      const useVwap =
        vwap &&
        Number.isFinite(vwap.avgAllIn) &&
        Number.isFinite(vwap.filledShares) &&
        vwap.filledShares > 0 &&
        Math.abs(vwap.filledShares - leg.shares) / leg.shares < 0.01;
      const unitAllIn = useVwap ? vwap.avgAllIn : leg.price + fee + leg.price * slippage;
      const unitAllInSell = useVwap ? vwap.avgAllIn : leg.price - fee - leg.price * slippage;
      if (leg.side === 'BUY') {
        hasBuy = true;
        totalCostPerShare += unitAllIn;
      } else {
        hasSell = true;
        totalProceedsPerShare += unitAllInSell;
      }
    }

    const transfer = Math.max(0, this.config.crossPlatformTransferCost || 0);
    let edge = 0;
    let profit = 0;

    if (hasBuy && !hasSell) {
      edge = 1 - totalCostPerShare - transfer;
      profit = edge * shares;
    } else if (hasSell && !hasBuy) {
      edge = totalProceedsPerShare - 1 - transfer;
      profit = edge * shares;
    } else {
      edge = totalProceedsPerShare - totalCostPerShare - transfer;
      profit = edge * shares;
    }

    if (minEdge > 0 && edge < minEdge) {
      return false;
    }
    if (minProfitUsd > 0 && profit < minProfitUsd) {
      return false;
    }
    return true;
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
