import WebSocket, { type RawData } from 'ws';
import type { PlatformOrderbook } from './types.js';

export interface PolymarketWsConfig {
  url: string;
  customFeatureEnabled?: boolean;
  initialDump?: boolean;
  maxDepthLevels?: number;
  reconnectMinMs?: number;
  reconnectMaxMs?: number;
  staleTimeoutMs?: number;
  resetOnReconnect?: boolean;
}

interface BookUpdate {
  asset_id: string;
  bids?: { price: string; size: string }[];
  asks?: { price: string; size: string }[];
  buys?: { price: string; size: string }[];
  sells?: { price: string; size: string }[];
}

interface PriceChangeUpdate {
  asset_id: string;
  price?: string;
  size?: string;
  side?: 'BUY' | 'SELL';
  changes?: { price: string; size: string; side: 'BUY' | 'SELL' }[];
  best_bid?: string;
  best_ask?: string;
}

interface BestBidAskUpdate {
  asset_id: string;
  bid: string;
  ask: string;
}

export class PolymarketWebSocketFeed {
  private config: PolymarketWsConfig;
  private ws?: WebSocket;
  private connected = false;
  private reconnectDelay: number;
  private reconnectTimer?: NodeJS.Timeout;
  private staleTimer?: NodeJS.Timeout;
  private subscribed = new Set<string>();
  private topOfBook = new Map<string, PlatformOrderbook & { timestamp: number }>();
  private lastMessageAt = 0;
  private messageCount = 0;
  private hasConnected = false;

  constructor(config: PolymarketWsConfig) {
    this.config = config;
    this.reconnectDelay = config.reconnectMinMs ?? 1000;
  }

  start(): void {
    if (this.ws || this.connected) {
      return;
    }

    this.ws = new WebSocket(this.config.url);
    this.ws.on('open', () => this.onOpen());
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('close', () => this.onClose());
    this.ws.on('error', () => this.onClose());
    this.ws.on('ping', () => this.ws?.pong());
    this.startStaleMonitor();
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws.removeAllListeners();
    }
    this.ws = undefined;
    this.connected = false;
  }

  subscribeAssets(assetIds: string[]): void {
    const unique = assetIds.filter((id) => id && !this.subscribed.has(id));
    if (unique.length === 0) {
      return;
    }

    unique.forEach((id) => this.subscribed.add(id));
    if (this.connected) {
      this.sendSubscribe(unique, 'subscribe');
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.start();
    }
  }

  getStatus(): {
    connected: boolean;
    subscribed: number;
    cacheSize: number;
    lastMessageAt: number;
    messageCount: number;
  } {
    return {
      connected: this.connected,
      subscribed: this.subscribed.size,
      cacheSize: this.topOfBook.size,
      lastMessageAt: this.lastMessageAt,
      messageCount: this.messageCount,
    };
  }

  getTopOfBook(assetId: string, maxAgeMs?: number): PlatformOrderbook | undefined {
    const book = this.topOfBook.get(assetId);
    if (!book) {
      return undefined;
    }
    if (maxAgeMs && Date.now() - book.timestamp > maxAgeMs) {
      return undefined;
    }
    return book;
  }

  getOrderbook(assetId: string, maxAgeMs?: number): PlatformOrderbook | undefined {
    return this.getTopOfBook(assetId, maxAgeMs);
  }

  private onOpen(): void {
    this.connected = true;
    this.reconnectDelay = this.config.reconnectMinMs ?? 1000;
    if (this.hasConnected && this.config.resetOnReconnect !== false) {
      this.topOfBook.clear();
    }
    this.hasConnected = true;
    this.lastMessageAt = Date.now();
    if (this.subscribed.size > 0) {
      this.sendSubscribe(Array.from(this.subscribed));
    }
  }

  private onClose(): void {
    this.connected = false;
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = undefined;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    const maxDelay = this.config.reconnectMaxMs ?? 15000;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.start();
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.7, maxDelay);
    }, this.reconnectDelay);
  }

  private startStaleMonitor(): void {
    const timeoutMs = this.config.staleTimeoutMs ?? 0;
    if (!timeoutMs || timeoutMs <= 0) {
      return;
    }
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
    }
    const interval = Math.min(timeoutMs, 5000);
    this.staleTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      if (!this.lastMessageAt) {
        return;
      }
      if (Date.now() - this.lastMessageAt > timeoutMs) {
        try {
          if (typeof this.ws.terminate === 'function') {
            this.ws.terminate();
          } else {
            this.ws.close();
          }
        } catch {
          // ignore
        }
      }
    }, interval);
  }

  private sendSubscribe(assetIds: string[], operation?: 'subscribe' | 'unsubscribe'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const payload: Record<string, unknown> = {
      type: 'MARKET',
      assets_ids: assetIds,
    };
    if (operation) {
      payload.operation = operation;
    }
    if (this.config.initialDump !== undefined) {
      payload.initial_dump = this.config.initialDump;
    }
    if (this.config.customFeatureEnabled) {
      payload.custom_feature_enabled = true;
    }
    this.ws.send(JSON.stringify(payload));
  }

  private onMessage(raw: RawData): void {
    let message: any;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    this.lastMessageAt = Date.now();
    this.messageCount += 1;

    const eventType = message?.event_type;
    if (!eventType) {
      return;
    }

    if (eventType === 'book') {
      if (Array.isArray(message.data)) {
        for (const entry of message.data as BookUpdate[]) {
          this.applyBook(entry);
        }
      } else if (message.data?.asset_id) {
        this.applyBook(message.data as BookUpdate);
      } else if (message.asset_id) {
        this.applyBook(message as BookUpdate);
      }
      return;
    }

    if (eventType === 'price_change') {
      if (Array.isArray(message.data)) {
        for (const entry of message.data as PriceChangeUpdate[]) {
          this.applyPriceChange(entry);
        }
      } else if (message.asset_id) {
        this.applyPriceChange(message as PriceChangeUpdate);
      }
      return;
    }

    if (eventType === 'best_bid_ask') {
      if (Array.isArray(message.data)) {
        for (const entry of message.data as BestBidAskUpdate[]) {
          this.applyBestBidAsk(entry);
        }
      } else if (message.data?.asset_id) {
        this.applyBestBidAsk(message.data as BestBidAskUpdate);
      } else if (message.asset_id) {
        this.applyBestBidAsk(message as BestBidAskUpdate);
      }
    }
  }

  private applyBook(entry: BookUpdate): void {
    const bids = entry.bids ?? entry.buys ?? [];
    const asks = entry.asks ?? entry.sells ?? [];
    const bestBid = bids?.[0];
    const bestAsk = asks?.[0];
    const bid = bestBid ? Number(bestBid.price) : undefined;
    const ask = bestAsk ? Number(bestAsk.price) : undefined;
    const bidSize = bestBid ? Number(bestBid.size) : undefined;
    const askSize = bestAsk ? Number(bestAsk.size) : undefined;

    const depthLimit = this.config.maxDepthLevels ?? 0;
    const bidLevels = bids
      .map((level) => ({ price: Number(level.price), shares: Number(level.size) }))
      .filter((level) => Number.isFinite(level.price) && level.price > 0 && Number.isFinite(level.shares) && level.shares > 0)
      .sort((a, b) => b.price - a.price);
    const askLevels = asks
      .map((level) => ({ price: Number(level.price), shares: Number(level.size) }))
      .filter((level) => Number.isFinite(level.price) && level.price > 0 && Number.isFinite(level.shares) && level.shares > 0)
      .sort((a, b) => a.price - b.price);

    const limitedBids = depthLimit > 0 ? bidLevels.slice(0, depthLimit) : bidLevels;
    const limitedAsks = depthLimit > 0 ? askLevels.slice(0, depthLimit) : askLevels;

    if (!Number.isFinite(bid) && !Number.isFinite(ask)) {
      return;
    }

    this.topOfBook.set(entry.asset_id, {
      bestBid: Number.isFinite(bid) ? bid : undefined,
      bestAsk: Number.isFinite(ask) ? ask : undefined,
      bidSize: Number.isFinite(bidSize) ? bidSize : undefined,
      askSize: Number.isFinite(askSize) ? askSize : undefined,
      bids: limitedBids,
      asks: limitedAsks,
      timestamp: Date.now(),
    });
  }

  private applyPriceChange(entry: PriceChangeUpdate): void {
    const assetId = entry.asset_id;
    if (!assetId) {
      return;
    }

    const current = this.topOfBook.get(assetId) || { timestamp: 0 };
    const bestBid = entry.best_bid ? Number(entry.best_bid) : current.bestBid;
    const bestAsk = entry.best_ask ? Number(entry.best_ask) : current.bestAsk;
    let bidSize = current.bidSize;
    let askSize = current.askSize;

    const primaryChange = entry.changes && entry.changes.length > 0 ? entry.changes[0] : entry;
    const price = Number(primaryChange?.price);
    const size = Number(primaryChange?.size);
    const side = primaryChange?.side;

    if (side === 'BUY' && Number.isFinite(bestBid) && price === bestBid && Number.isFinite(size)) {
      bidSize = size;
    }
    if (side === 'SELL' && Number.isFinite(bestAsk) && price === bestAsk && Number.isFinite(size)) {
      askSize = size;
    }

    if (!Number.isFinite(bestBid) && !Number.isFinite(bestAsk)) {
      return;
    }

    this.topOfBook.set(assetId, {
      bestBid: Number.isFinite(bestBid) ? bestBid : undefined,
      bestAsk: Number.isFinite(bestAsk) ? bestAsk : undefined,
      bidSize,
      askSize,
      bids: current.bids,
      asks: current.asks,
      timestamp: Date.now(),
    });
  }

  private applyBestBidAsk(entry: BestBidAskUpdate): void {
    const bid = Number(entry.bid);
    const ask = Number(entry.ask);
    if (!Number.isFinite(bid) && !Number.isFinite(ask)) {
      return;
    }
    const current = this.topOfBook.get(entry.asset_id) || { timestamp: 0 };
    this.topOfBook.set(entry.asset_id, {
      bestBid: Number.isFinite(bid) ? bid : current.bestBid,
      bestAsk: Number.isFinite(ask) ? ask : current.bestAsk,
      bidSize: current.bidSize,
      askSize: current.askSize,
      bids: current.bids,
      asks: current.asks,
      timestamp: Date.now(),
    });
  }
}
