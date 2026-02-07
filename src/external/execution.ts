import { spawn } from 'node:child_process';
import type { Config } from '../types.js';
import type { PlatformLeg, ExternalPlatform } from './types.js';
import { PredictAPI } from '../api/client.js';
import { OrderManager } from '../order-manager.js';
import { Wallet } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';

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

  constructor(config: Config, api: PredictAPI, orderManager: OrderManager) {
    this.executors.set('Predict', new PredictExecutor(api, orderManager, config.crossPlatformSlippageBps || 250));

    if (config.polymarketPrivateKey) {
      this.executors.set('Polymarket', new PolymarketExecutor(config));
    }

    if (config.opinionApiKey && config.opinionPrivateKey) {
      this.executors.set('Opinion', new OpinionExecutor(config));
    }
  }

  async execute(legs: PlatformLeg[]): Promise<void> {
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
}
