import WebSocket, { type RawData } from 'ws';
import type { PlatformOrderbook } from './types.js';

export interface PolymarketWsConfig {
  url: string;
  customFeatureEnabled?: boolean;
  reconnectMinMs?: number;
  reconnectMaxMs?: number;
}

interface BookUpdate {
  asset_id: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
}

interface PriceChangeUpdate {
  asset_id: string;
  price: string;
  size: string;
  side: 'BUY' | 'SELL';
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
  private subscribed = new Set<string>();
  private topOfBook = new Map<string, PlatformOrderbook & { timestamp: number }>();
  private lastMessageAt = 0;
  private messageCount = 0;

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
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
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
    this.sendSubscribe(unique);
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

  private onOpen(): void {
    this.connected = true;
    this.reconnectDelay = this.config.reconnectMinMs ?? 1000;
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

  private sendSubscribe(assetIds: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const payload: Record<string, unknown> = {
      type: 'market',
      assets_ids: assetIds,
    };
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
      const data = Array.isArray(message.data) ? message.data : [];
      for (const entry of data as BookUpdate[]) {
        this.applyBook(entry);
      }
      return;
    }

    if (eventType === 'price_change') {
      const data = Array.isArray(message.data) ? message.data : [];
      for (const entry of data as PriceChangeUpdate[]) {
        this.applyPriceChange(entry);
      }
      return;
    }

    if (eventType === 'best_bid_ask') {
      const data = Array.isArray(message.data) ? message.data : [];
      for (const entry of data as BestBidAskUpdate[]) {
        this.applyBestBidAsk(entry);
      }
    }
  }

  private applyBook(entry: BookUpdate): void {
    const bestBid = entry.bids?.[0];
    const bestAsk = entry.asks?.[0];
    const bid = bestBid ? Number(bestBid.price) : undefined;
    const ask = bestAsk ? Number(bestAsk.price) : undefined;
    const bidSize = bestBid ? Number(bestBid.size) : undefined;
    const askSize = bestAsk ? Number(bestAsk.size) : undefined;

    if (!Number.isFinite(bid) && !Number.isFinite(ask)) {
      return;
    }

    this.topOfBook.set(entry.asset_id, {
      bestBid: Number.isFinite(bid) ? bid : undefined,
      bestAsk: Number.isFinite(ask) ? ask : undefined,
      bidSize: Number.isFinite(bidSize) ? bidSize : undefined,
      askSize: Number.isFinite(askSize) ? askSize : undefined,
      timestamp: Date.now(),
    });
  }

  private applyPriceChange(entry: PriceChangeUpdate): void {
    const current = this.topOfBook.get(entry.asset_id) || { timestamp: 0 };
    const bestBid = entry.best_bid ? Number(entry.best_bid) : current.bestBid;
    const bestAsk = entry.best_ask ? Number(entry.best_ask) : current.bestAsk;
    let bidSize = current.bidSize;
    let askSize = current.askSize;

    const price = Number(entry.price);
    const size = Number(entry.size);
    if (entry.side === 'BUY' && Number.isFinite(bestBid) && price === bestBid && Number.isFinite(size)) {
      bidSize = size;
    }
    if (entry.side === 'SELL' && Number.isFinite(bestAsk) && price === bestAsk && Number.isFinite(size)) {
      askSize = size;
    }

    if (!Number.isFinite(bestBid) && !Number.isFinite(bestAsk)) {
      return;
    }

    this.topOfBook.set(entry.asset_id, {
      bestBid: Number.isFinite(bestBid) ? bestBid : undefined,
      bestAsk: Number.isFinite(bestAsk) ? bestAsk : undefined,
      bidSize,
      askSize,
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
      timestamp: Date.now(),
    });
  }
}
