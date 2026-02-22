/**
 * Predict.fun Market Maker Bot
 * Main entry point
 */

import { Wallet } from 'ethers';
import { loadConfig, printConfig } from './config.js';
import { PredictAPI } from './api/client.js';
import { ProbableAPI } from './api/probable-client.js';
import { MarketSelector } from './market-selector.js';
import { MarketMaker } from './market-maker.js';
import { applyLiquidityRules } from './markets-config.js';
import { PredictWebSocketFeed } from './external/predict-ws.js';
import { ProbableWebSocketFeed } from './external/probable-ws.js';
import { ProbableOrderManager } from './order-manager-probable.js';
import type { Market, Orderbook } from './types.js';

class PredictMarketMakerBot {
  private api: PredictAPI;
  private marketSelector: MarketSelector;
  private marketMaker: MarketMaker;
  private config: any;
  private wallet: Wallet;
  private running = false;
  private selectedMarkets: Market[] = [];
  private marketByToken: Map<string, Market> = new Map();
  private wsFeed?: PredictWebSocketFeed;
  private wsDirtyTokens: Set<string> = new Set();
  private wsDirtyUnsub?: () => void;
  private wsFallbackAt: Map<string, number> = new Map();
  private wsBadCount: Map<string, number> = new Map();
  private wsGapUntil: Map<string, number> = new Map();
  private wsHealthScore = 100;
  private wsHealthTarget = 100;
  private wsHealthUpdatedAt = 0;
  private warnedMissingJwt = false;

  private getAccountAddressForQueries(): string {
    return this.config.predictAccountAddress || this.wallet.address;
  }

  constructor() {
    // Load configuration
    this.config = loadConfig();
    printConfig(this.config);

    // Initialize wallet
    this.wallet = new Wallet(this.config.privateKey);
    console.log(`🔐 Wallet: ${this.wallet.address}\n`);
    if (this.config.predictAccountAddress) {
      console.log(`🏦 Predict Account (query target): ${this.config.predictAccountAddress}\n`);
    }

    // Initialize API client
    this.api = new PredictAPI(this.config.apiBaseUrl, this.config.apiKey, this.config.jwtToken);

    // Initialize market selector
    this.marketSelector = new MarketSelector(
      1000, // minLiquidity
      5000, // minVolume24h
      0.10, // maxSpread
      5 // minOrders
    );

    // Initialize market maker
    this.marketMaker = new MarketMaker(this.api, this.config);
  }

  /**
   * Initialize the bot
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Predict.fun Market Maker Bot...\n');

    // Test API connection
    const connected = await this.api.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Predict.fun API');
    }

    // Select markets to trade
    await this.selectMarkets();

    await this.marketMaker.initialize();
    this.setupMarketWs();

    // Update initial state (private endpoint requires JWT)
    if (this.config.jwtToken) {
      await this.marketMaker.updateState(this.getAccountAddressForQueries());
    } else if (!this.warnedMissingJwt) {
      console.log('⚠️  JWT_TOKEN missing, skip orders/positions sync (run: npm run auth:jwt)');
      this.warnedMissingJwt = true;
    }

    console.log('✅ Initialization complete\n');
  }

  /**
   * Select markets to trade
   */
  async selectMarkets(): Promise<void> {
    console.log('🔍 Scanning markets...\n');

    const allMarkets = await this.api.getMarkets();
    console.log(`Found ${allMarkets.length} active markets\n`);

    // Apply manual liquidity activation rules from config
    const marketsWithRules = applyLiquidityRules(allMarkets);
    const rulesApplied = marketsWithRules.filter((m) => m.liquidity_activation?.active).length;
    if (rulesApplied > 0) {
      console.log(`✅ Applied liquidity rules to ${rulesApplied} market(s)\n`);
    }

    // Fetch orderbooks for all markets
    const orderbooks = new Map<string, Orderbook>();
    for (const market of marketsWithRules.slice(0, 50)) {
      // Limit to first 50 for performance
      try {
        const orderbook = await this.api.getOrderbook(market.token_id);
        orderbooks.set(market.token_id, orderbook);

        // Add orderbook data to market
        market.best_bid = orderbook.best_bid;
        market.best_ask = orderbook.best_ask;
        market.spread_pct = orderbook.spread_pct;
        market.total_orders =
          (orderbook.bids?.length || 0) + (orderbook.asks?.length || 0);
      } catch (error) {
        console.error(`Error fetching orderbook for ${market.token_id}:`, error);
      }
    }

    // Score and select markets
    let scoredMarkets = this.marketSelector.selectMarkets(marketsWithRules, orderbooks);

    // Filter by user-specified markets if provided
    if (this.config.marketTokenIds && this.config.marketTokenIds.length > 0) {
      scoredMarkets = scoredMarkets.filter((s) =>
        this.config.marketTokenIds.includes(s.market.token_id)
      );
    }

    // Print analysis
    this.marketSelector.printAnalysis(scoredMarkets);

    // Select top markets
    this.selectedMarkets = this.marketSelector.getTopMarkets(scoredMarkets, 10);
    this.marketByToken.clear();
    for (const market of this.selectedMarkets) {
      this.marketByToken.set(market.token_id, market);
    }

    console.log(`\n✅ Selected ${this.selectedMarkets.length} markets for market making\n`);
  }

  private setupMarketWs(): void {
    if (!this.config.mmWsEnabled) {
      return;
    }
    const wsUrl = this.config.predictWsUrl || 'wss://ws.predict.fun/ws';
    this.wsFeed = new PredictWebSocketFeed({
      url: wsUrl,
      apiKey: this.config.predictWsApiKey || this.config.apiKey,
      topicKey: this.config.predictWsTopicKey || 'token_id',
      staleTimeoutMs: this.config.predictWsStaleMs || 0,
      resetOnReconnect: this.config.predictWsResetOnReconnect !== false,
    });
    this.wsFeed.subscribeMarkets(this.selectedMarkets);
    this.wsDirtyUnsub = this.wsFeed.onOrderbook((tokenId) => {
      if (this.marketByToken.has(tokenId)) {
        this.wsDirtyTokens.add(tokenId);
      }
    });
    this.wsFeed.start();
    console.log(`📡 Market Maker WS enabled (${wsUrl})`);
  }

  private resolveMmWsMaxAgeMs(): number {
    const explicit = Number(this.config.mmWsMaxAgeMs || 0);
    if (explicit > 0) {
      return explicit;
    }
    const fallback = Number(this.config.predictWsStaleMs || 0);
    if (fallback > 0) {
      return fallback;
    }
    return 5000;
  }

  private updateWsHealth(): void {
    if (!this.config.mmWsEnabled || !this.wsFeed) {
      this.wsHealthScore = 100;
      this.wsHealthTarget = 100;
      this.wsHealthUpdatedAt = Date.now();
      this.marketMaker.setWsHealthScore(100);
      return;
    }
    const status = this.wsFeed.getStatus();
    const maxAge = this.resolveMmWsMaxAgeMs();
    if (!status.connected || !status.lastMessageAt) {
      this.wsHealthTarget = 0;
    } else {
      const age = Math.max(0, Date.now() - status.lastMessageAt);
      if (maxAge <= 0) {
        this.wsHealthTarget = 100;
      } else {
        const ratio = Math.min(1, age / maxAge);
        this.wsHealthTarget = Math.max(0, Math.round(100 * (1 - ratio)));
      }
    }
    const now = Date.now();
    if (!this.wsHealthUpdatedAt) {
      this.wsHealthScore = this.wsHealthTarget;
    } else if (this.wsHealthTarget < this.wsHealthScore) {
      this.wsHealthScore = this.wsHealthTarget;
    } else if (this.wsHealthTarget > this.wsHealthScore) {
      const recoverMs = Math.max(0, Number(this.config.mmWsHealthRecoverMs || 0));
      if (recoverMs <= 0) {
        this.wsHealthScore = this.wsHealthTarget;
      } else {
        const elapsed = Math.max(1, now - this.wsHealthUpdatedAt);
        const step = Math.min(1, elapsed / recoverMs);
        this.wsHealthScore = this.wsHealthScore + (this.wsHealthTarget - this.wsHealthScore) * step;
      }
    }
    this.wsHealthUpdatedAt = now;
    this.marketMaker.setWsHealthScore(Math.round(this.wsHealthScore));
  }

  private isOrderbookValid(orderbook: Orderbook | null | undefined): boolean {
    if (!orderbook) {
      return false;
    }
    const bestBid = orderbook.best_bid ?? 0;
    const bestAsk = orderbook.best_ask ?? 0;
    if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) {
      return false;
    }
    if (bestBid <= 0 || bestAsk <= 0 || bestBid >= bestAsk) {
      return false;
    }
    return true;
  }

  private async getOrderbookForMarket(market: Market): Promise<Orderbook | null> {
    if (this.wsFeed && this.config.mmWsEnabled) {
      const gapUntil = this.wsGapUntil.get(market.token_id) || 0;
      if (gapUntil && Date.now() < gapUntil) {
        if (this.config.mmWsFallbackRest !== false) {
          return await this.api.getOrderbook(market.token_id);
        }
        return null;
      }
      const maxAge = this.resolveMmWsMaxAgeMs();
      const cached = this.wsFeed.getOrderbook(market.token_id, maxAge);
      if (cached && this.isOrderbookValid(cached)) {
        this.wsBadCount.delete(market.token_id);
        return cached;
      }
      if (cached) {
        const bad = (this.wsBadCount.get(market.token_id) || 0) + 1;
        this.wsBadCount.set(market.token_id, bad);
        const maxBad = Math.max(0, Number(this.config.mmWsGapMax || 0));
        if (maxBad > 0 && bad >= maxBad) {
          const cooldown = Math.max(0, Number(this.config.mmWsGapCooldownMs || 0));
          if (cooldown > 0) {
            this.wsGapUntil.set(market.token_id, Date.now() + cooldown);
          }
          this.wsBadCount.delete(market.token_id);
          if (this.config.mmWsGapReconnect && this.wsFeed) {
            this.wsFeed.stop();
            this.wsFeed.start();
          }
        }
      }
      if (this.config.mmWsFallbackRest !== false) {
        const minInterval = Math.max(0, Number(this.config.mmWsFallbackMinIntervalMs || 0));
        const last = this.wsFallbackAt.get(market.token_id) || 0;
        if (minInterval > 0 && Date.now() - last < minInterval) {
          return null;
        }
        this.wsFallbackAt.set(market.token_id, Date.now());
        const restBook = await this.api.getOrderbook(market.token_id);
        return this.isOrderbookValid(restBook) ? restBook : null;
      }
      return null;
    }
    return await this.api.getOrderbook(market.token_id);
  }

  private drainDirtyMarkets(): Market[] {
    if (!this.config.mmWsOnlyDirty || !this.config.mmWsEnabled) {
      return this.selectedMarkets;
    }
    if (this.wsDirtyTokens.size === 0) {
      return [];
    }
    const maxBatch = Math.max(0, Number(this.config.mmWsDirtyMaxBatch || 0));
    const tokens = Array.from(this.wsDirtyTokens);
    const batch = maxBatch > 0 ? tokens.slice(0, maxBatch) : tokens;
    for (const token of batch) {
      this.wsDirtyTokens.delete(token);
    }
    return batch
      .map((tokenId) => this.marketByToken.get(tokenId))
      .filter((market): market is Market => Boolean(market));
  }

  private getLoopSleepMs(): number {
    if (!this.config.mmWsOnlyDirty) {
      return this.config.refreshInterval;
    }
    const idle = Math.max(50, Number(this.config.mmWsIdleSleepMs || 0));
    return idle > 0 ? idle : Math.min(200, this.config.refreshInterval);
  }

  /**
   * Main trading loop
   */
  async run(): Promise<void> {
    this.running = true;

    console.log('🎯 Starting market making loop...\n');

    while (this.running) {
      try {
        this.updateWsHealth();
        // 维护 WebSocket 健康状态（自动恢复）
        this.marketMaker.maintainWsHealth();
        // Update state (private endpoint requires JWT)
        if (this.config.jwtToken) {
          await this.marketMaker.updateState(this.getAccountAddressForQueries());
        }

        const marketsToProcess = this.drainDirtyMarkets();
        if (marketsToProcess.length === 0) {
          await this.sleep(this.getLoopSleepMs());
          continue;
        }

        // Process each market
        for (const market of marketsToProcess) {
          try {
            // Fetch latest orderbook (WS preferred when enabled)
            const orderbook = await this.getOrderbookForMarket(market);
            if (!orderbook) {
              continue;
            }

            // Place/cancel orders as needed
            await this.marketMaker.placeMMOrders(market, orderbook);
          } catch (error) {
            console.error(`Error processing market ${market.token_id}:`, error);
          }
        }

        // Print status
        this.marketMaker.printStatus();

        // Wait for next iteration
        await this.sleep(this.getLoopSleepMs());
      } catch (error) {
        console.error('Error in main loop:', error);
        await this.sleep(this.getLoopSleepMs());
      }
    }
  }

  /**
   * Stop the bot
   */
  stop(): void {
    console.log('\n🛑 Stopping bot...');
    this.running = false;
    if (this.wsDirtyUnsub) {
      this.wsDirtyUnsub();
      this.wsDirtyUnsub = undefined;
    }
    if (this.wsFeed) {
      this.wsFeed.stop();
      this.wsFeed = undefined;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class ProbableMarketMakerBot {
  private api: ProbableAPI;
  private marketSelector: MarketSelector;
  private marketMaker: MarketMaker;
  private config: any;
  private wallet: Wallet;
  private running = false;
  private selectedMarkets: Market[] = [];
  private marketByToken: Map<string, Market> = new Map();
  private wsFeed?: ProbableWebSocketFeed;
  private wsDirtyTokens: Set<string> = new Set();
  private wsDirtyUnsub?: () => void;
  private wsHealthScore = 100;
  private wsHealthTarget = 100;
  private wsHealthUpdatedAt = 0;
  private warnedMissingJwt = false;

  private getAccountAddressForQueries(): string {
    return this.wallet.address;
  }

  constructor() {
    this.config = loadConfig();
    printConfig(this.config);

    this.wallet = new Wallet(this.config.probablePrivateKey || this.config.privateKey);
    console.log(`🔐 Wallet: ${this.wallet.address}\n`);

    this.api = new ProbableAPI({
      marketApiUrl: this.config.probableMarketApiUrl || 'https://market-api.probable.markets',
      orderbookApiUrl: this.config.probableOrderbookApiUrl || 'https://api.probable.markets/public/api/v1',
      wsUrl: this.config.probableWsUrl || 'wss://ws.probable.markets/public/api/v1',
      privateKey: this.config.probablePrivateKey || this.config.privateKey,
      chainId: this.config.probableChainId || 56,
      rpcUrl: this.config.probableRpcUrl,
      maxMarkets: this.config.probableMaxMarkets || 30,
      feeBps: this.config.probableFeeBps || 0,
    });

    this.marketSelector = new MarketSelector(0, 0, 0.2, 0);
    this.marketMaker = new MarketMaker(this.api, this.config, async () => {
      return new ProbableOrderManager({
        orderbookApiUrl: this.config.probableOrderbookApiUrl || 'https://api.probable.markets/public/api/v1',
        wsUrl: this.config.probableWsUrl || 'wss://ws.probable.markets/public/api/v1',
        chainId: this.config.probableChainId || 56,
        privateKey: this.config.probablePrivateKey || this.config.privateKey,
        rpcUrl: this.config.probableRpcUrl,
      });
    });
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Probable Market Maker Bot...\n');

    const connected = await this.api.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Probable API');
    }

    await this.selectMarkets();

    await this.marketMaker.initialize();
    this.setupMarketWs();

    if (this.config.jwtToken && this.config.mmRequireJwt !== false) {
      await this.marketMaker.updateState(this.getAccountAddressForQueries());
    } else if (!this.warnedMissingJwt) {
      console.log('ℹ️  Probable 模式不需要 JWT，已跳过订单/仓位同步');
      this.warnedMissingJwt = true;
    }

    console.log('✅ Initialization complete\n');
  }

  async selectMarkets(): Promise<void> {
    console.log('🔍 Scanning markets (Probable)...\n');

    const allMarkets = await this.api.getMarkets();
    console.log(`Found ${allMarkets.length} active tokens\n`);

    const orderbooks = new Map<string, Orderbook>();
    for (const market of allMarkets.slice(0, 50)) {
      try {
        const orderbook = await this.api.getOrderbook(market.token_id);
        orderbooks.set(market.token_id, orderbook);
        market.best_bid = orderbook.best_bid;
        market.best_ask = orderbook.best_ask;
        market.spread_pct = orderbook.spread_pct;
        market.total_orders = (orderbook.bids?.length || 0) + (orderbook.asks?.length || 0);
      } catch (error) {
        console.error(`Error fetching orderbook for ${market.token_id}:`, error);
      }
    }

    let scoredMarkets = this.marketSelector.selectMarkets(allMarkets, orderbooks);

    if (this.config.marketTokenIds && this.config.marketTokenIds.length > 0) {
      scoredMarkets = scoredMarkets.filter((s) => this.config.marketTokenIds.includes(s.market.token_id));
    }

    this.marketSelector.printAnalysis(scoredMarkets);

    const topCount = Math.max(5, Math.min(20, scoredMarkets.length));
    this.selectedMarkets = this.marketSelector.getTopMarkets(scoredMarkets, topCount);
    this.marketByToken.clear();
    for (const market of this.selectedMarkets) {
      this.marketByToken.set(market.token_id, market);
    }

    console.log(`\n✅ Selected ${this.selectedMarkets.length} tokens for market making\n`);
  }

  private setupMarketWs(): void {
    if (!this.config.mmWsEnabled || !this.config.probableWsEnabled) {
      return;
    }
    this.wsFeed = new ProbableWebSocketFeed({
      baseUrl: this.config.probableOrderbookApiUrl || 'https://api.probable.markets/public/api/v1',
      wsUrl: this.config.probableWsUrl || 'wss://ws.probable.markets/public/api/v1',
      chainId: this.config.probableChainId || 56,
      staleTimeoutMs: this.config.probableWsStaleMs || 0,
      resetOnReconnect: this.config.probableWsResetOnReconnect !== false,
      reconnectMinMs: 1000,
      reconnectMaxMs: 15000,
    });
    const tokenIds = this.selectedMarkets.map((m) => m.token_id);
    this.wsFeed.subscribeTokens(tokenIds);
    this.wsDirtyUnsub = this.wsFeed.onOrderbook((tokenId) => {
      if (this.marketByToken.has(tokenId)) {
        this.wsDirtyTokens.add(tokenId);
      }
    });
    this.wsFeed.start();
    console.log(`📡 Probable WS enabled (${this.config.probableWsUrl})`);
  }

  private resolveMmWsMaxAgeMs(): number {
    const explicit = Number(this.config.mmWsMaxAgeMs || 0);
    if (explicit > 0) {
      return explicit;
    }
    const fallback = Number(this.config.probableWsStaleMs || 0);
    if (fallback > 0) {
      return fallback;
    }
    return 5000;
  }

  private updateWsHealth(): void {
    if (!this.config.mmWsEnabled || !this.config.probableWsEnabled || !this.wsFeed) {
      this.wsHealthScore = 100;
      this.wsHealthTarget = 100;
      this.wsHealthUpdatedAt = Date.now();
      this.marketMaker.setWsHealthScore(100);
      return;
    }
    const status = this.wsFeed.getStatus();
    const maxAge = this.resolveMmWsMaxAgeMs();
    if (!status.connected || !status.lastMessageAt) {
      this.wsHealthTarget = 0;
    } else {
      const age = Math.max(0, Date.now() - status.lastMessageAt);
      if (maxAge <= 0) {
        this.wsHealthTarget = 100;
      } else {
        const ratio = Math.min(1, age / maxAge);
        this.wsHealthTarget = Math.max(0, Math.round(100 * (1 - ratio)));
      }
    }
    const now = Date.now();
    if (!this.wsHealthUpdatedAt) {
      this.wsHealthScore = this.wsHealthTarget;
    } else if (this.wsHealthTarget < this.wsHealthScore) {
      this.wsHealthScore = this.wsHealthTarget;
    } else if (this.wsHealthTarget > this.wsHealthScore) {
      const recoverMs = Math.max(0, Number(this.config.mmWsHealthRecoverMs || 0));
      if (recoverMs <= 0) {
        this.wsHealthScore = this.wsHealthTarget;
      } else {
        const elapsed = Math.max(1, now - this.wsHealthUpdatedAt);
        const step = Math.min(1, elapsed / recoverMs);
        this.wsHealthScore = this.wsHealthScore + (this.wsHealthTarget - this.wsHealthScore) * step;
      }
    }
    this.wsHealthUpdatedAt = now;
    this.marketMaker.setWsHealthScore(Math.max(0, Math.min(100, Math.round(this.wsHealthScore))));
  }

  private async getOrderbookForMarket(market: Market): Promise<Orderbook | null> {
    const tokenId = market.token_id;
    const useWs = this.config.mmWsEnabled && this.config.probableWsEnabled && this.wsFeed;
    if (useWs && this.wsFeed) {
      const maxAge = this.resolveMmWsMaxAgeMs();
      const wsBook = this.wsFeed.getOrderbook(tokenId, maxAge);
      if (wsBook?.bestBid && wsBook?.bestAsk) {
        return {
          token_id: tokenId,
          bids: (wsBook.bids || []).map((level) => ({
            price: String(level.price),
            shares: String(level.shares),
          })),
          asks: (wsBook.asks || []).map((level) => ({
            price: String(level.price),
            shares: String(level.shares),
          })),
          best_bid: wsBook.bestBid,
          best_ask: wsBook.bestAsk,
          spread: wsBook.bestAsk - wsBook.bestBid,
          spread_pct: ((wsBook.bestAsk - wsBook.bestBid) / ((wsBook.bestAsk + wsBook.bestBid) / 2)) * 100,
          mid_price: (wsBook.bestAsk + wsBook.bestBid) / 2,
        };
      }
    }

    if (this.config.mmWsFallbackRest === false && useWs) {
      return null;
    }

    try {
      const orderbook = await this.api.getOrderbook(tokenId);
      return orderbook;
    } catch (error) {
      console.error(`Error fetching orderbook for ${tokenId}:`, error);
      return null;
    }
  }

  private drainDirtyMarkets(): Market[] {
    if (!this.config.mmWsOnlyDirty) {
      return this.selectedMarkets;
    }
    const maxBatch = Math.max(1, Number(this.config.mmWsDirtyMaxBatch || 0)) || this.selectedMarkets.length;
    const dirty = Array.from(this.wsDirtyTokens);
    this.wsDirtyTokens.clear();
    const batch = dirty.slice(0, maxBatch);
    return batch
      .map((tokenId) => this.marketByToken.get(tokenId))
      .filter((market): market is Market => Boolean(market));
  }

  private getLoopSleepMs(): number {
    if (!this.config.mmWsOnlyDirty) {
      return this.config.refreshInterval;
    }
    const idle = Math.max(50, Number(this.config.mmWsIdleSleepMs || 0));
    return idle > 0 ? idle : Math.min(200, this.config.refreshInterval);
  }

  async run(): Promise<void> {
    this.running = true;
    console.log('🎯 Starting Probable market making loop...\n');

    while (this.running) {
      try {
        this.updateWsHealth();
        // 维护 WebSocket 健康状态（自动恢复）
        this.marketMaker.maintainWsHealth();
        if (this.config.jwtToken && this.config.mmRequireJwt !== false) {
          await this.marketMaker.updateState(this.getAccountAddressForQueries());
        }

        const marketsToProcess = this.drainDirtyMarkets();
        if (marketsToProcess.length === 0) {
          await this.sleep(this.getLoopSleepMs());
          continue;
        }

        for (const market of marketsToProcess) {
          try {
            const orderbook = await this.getOrderbookForMarket(market);
            if (!orderbook) {
              continue;
            }
            await this.marketMaker.placeMMOrders(market, orderbook);
          } catch (error) {
            console.error(`Error processing market ${market.token_id}:`, error);
          }
        }

        this.marketMaker.printStatus();
        await this.sleep(this.getLoopSleepMs());
      } catch (error) {
        console.error('Error in main loop:', error);
        await this.sleep(this.getLoopSleepMs());
      }
    }
  }

  stop(): void {
    this.running = false;
    if (this.wsFeed) {
      this.wsFeed.stop();
    }
    if (this.wsDirtyUnsub) {
      this.wsDirtyUnsub();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let activeBot: { stop: () => void } | null = null;

// Main execution
async function main() {
  const config = loadConfig();
  const venue = String(config.mmVenue || 'predict').toLowerCase();
  const bot = venue === 'probable' ? new ProbableMarketMakerBot() : new PredictMarketMakerBot();
  activeBot = bot;

  try {
    await bot.initialize();
    await bot.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, shutting down gracefully...');
  if (activeBot) {
    activeBot.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, shutting down gracefully...');
  if (activeBot) {
    activeBot.stop();
  }
  process.exit(0);
});

// Run
main().catch(console.error);
