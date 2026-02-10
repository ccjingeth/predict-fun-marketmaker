import { spawn } from 'node:child_process';
import type { Config } from '../types.js';
import type { PlatformLeg, ExternalPlatform } from './types.js';
import { PredictAPI } from '../api/client.js';
import { OrderManager } from '../order-manager.js';
import { Wallet } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { estimateBuy, estimateSell } from '../arbitrage/orderbook-vwap.js';
import type { OrderbookEntry } from '../types.js';

interface PlatformExecutor {
  platform: ExternalPlatform;
  execute(legs: PlatformLeg[]): Promise<void>;
}

class PredictExecutor implements PlatformExecutor {
  platform: ExternalPlatform = 'Predict';
  private api: PredictAPI;
  private orderManager: OrderManager;
  private slippageBps: string;

  constructor(api: PredictAPI, orderManager: OrderManager, slippageBps: number) {
    this.api = api;
    this.orderManager = orderManager;
    this.slippageBps = String(slippageBps);
  }

  async execute(legs: PlatformLeg[]): Promise<void> {
    for (const leg of legs) {
      const market = await this.api.getMarket(leg.tokenId);
      const orderbook = await this.api.getOrderbook(leg.tokenId);
      const payload = await this.orderManager.buildMarketOrderPayload({
        market,
        side: leg.side,
        shares: leg.shares,
        orderbook,
        slippageBps: this.slippageBps,
      });
      await this.api.createOrder(payload);
    }
  }
}

class PolymarketExecutor implements PlatformExecutor {
  platform: ExternalPlatform = 'Polymarket';
  private client: ClobClient;
  private apiCreds?: { apiKey: string; apiSecret: string; apiPassphrase: string };
  private autoDerive: boolean;

  constructor(config: Config) {
    const signer = new Wallet(config.polymarketPrivateKey || '');
    this.client = new ClobClient(
      config.polymarketClobUrl || 'https://clob.polymarket.com',
      config.polymarketChainId || 137,
      signer
    );

    this.autoDerive = config.polymarketAutoDeriveApiKey !== false;

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

  async execute(legs: PlatformLeg[]): Promise<void> {
    await this.ensureApiCreds();
    if (!this.apiCreds) {
      throw new Error('Polymarket API credentials missing');
    }

    for (const leg of legs) {
      const order = await this.client.createOrder({
        tokenId: leg.tokenId,
        price: leg.price,
        side: leg.side,
        size: leg.shares,
      });
      await this.client.postOrder(order, this.apiCreds);
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

  async execute(legs: PlatformLeg[]): Promise<void> {
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
  }
}

export class CrossPlatformExecutionRouter {
  private executors: Map<ExternalPlatform, PlatformExecutor> = new Map();
  private config: Config;
  private api: PredictAPI;

  constructor(config: Config, api: PredictAPI, orderManager: OrderManager) {
    this.config = config;
    this.api = api;
    this.executors.set('Predict', new PredictExecutor(api, orderManager, config.crossPlatformSlippageBps || 250));

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

    for (const [platform, legsForPlatform] of grouped.entries()) {
      const executor = this.executors.get(platform);
      if (!executor) {
        throw new Error(`No executor configured for ${platform}`);
      }
      await executor.execute(legsForPlatform);
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
