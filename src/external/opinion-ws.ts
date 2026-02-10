import WebSocket, { type RawData } from 'ws';
import type { DepthLevel, PlatformOrderbook } from './types.js';

export interface OpinionWsConfig {
  url: string;
  apiKey: string;
  heartbeatMs?: number;
  reconnectMinMs?: number;
  reconnectMaxMs?: number;
}

interface DepthDiffMessage {
  channel?: string;
  marketId?: number | string;
  tokenId?: string;
  outcomeSide?: number;
  side?: 'bids' | 'asks';
  price?: string | number;
  size?: string | number;
}

type OrderbookSide = Map<string, number>;

interface OrderbookState {
  bids: OrderbookSide;
  asks: OrderbookSide;
  bestBid?: number;
  bestAsk?: number;
  bidSize?: number;
  askSize?: number;
  timestamp: number;
}

export class OpinionWebSocketFeed {
  private config: OpinionWsConfig;
  private ws?: WebSocket;
  private connected = false;
  private reconnectDelay: number;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private subscribedMarkets = new Set<string>();
  private books = new Map<string, OrderbookState>();
  private lastMessageAt = 0;
  private messageCount = 0;

  constructor(config: OpinionWsConfig) {
    this.config = config;
    this.reconnectDelay = config.reconnectMinMs ?? 1000;
  }

  start(): void {
    if (this.ws || this.connected) {
      return;
    }
    const url = this.buildUrl();
    this.ws = new WebSocket(url);
    this.ws.on('open', () => this.onOpen());
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('close', () => this.onClose());
    this.ws.on('error', () => this.onClose());
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws.removeAllListeners();
    }
    this.ws = undefined;
    this.connected = false;
  }

  subscribeMarketIds(ids: Array<number | string>): void {
    const newIds: string[] = [];
    for (const id of ids) {
      const key = String(id);
      if (!key || this.subscribedMarkets.has(key)) {
        continue;
      }
      this.subscribedMarkets.add(key);
      newIds.push(key);
    }
    if (newIds.length > 0) {
      for (const id of newIds) {
        this.sendSubscribe(id);
      }
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.start();
      }
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
      subscribed: this.subscribedMarkets.size,
      cacheSize: this.books.size,
      lastMessageAt: this.lastMessageAt,
      messageCount: this.messageCount,
    };
  }

  getTopOfBook(tokenId: string, maxAgeMs?: number): PlatformOrderbook | undefined {
    const book = this.books.get(tokenId);
    if (!book) {
      return undefined;
    }
    if (maxAgeMs && Date.now() - book.timestamp > maxAgeMs) {
      return undefined;
    }
    return {
      bestBid: book.bestBid,
      bestAsk: book.bestAsk,
      bidSize: book.bidSize,
      askSize: book.askSize,
    };
  }

  getOrderbook(tokenId: string, maxAgeMs?: number, depthLevels?: number): PlatformOrderbook | undefined {
    const book = this.books.get(tokenId);
    if (!book) {
      return undefined;
    }
    if (maxAgeMs && Date.now() - book.timestamp > maxAgeMs) {
      return undefined;
    }

    const bids = this.mapSide(book.bids, 'BID', depthLevels);
    const asks = this.mapSide(book.asks, 'ASK', depthLevels);

    return {
      bestBid: book.bestBid,
      bestAsk: book.bestAsk,
      bidSize: book.bidSize,
      askSize: book.askSize,
      bids,
      asks,
    };
  }

  private mapSide(side: OrderbookSide, kind: 'BID' | 'ASK', depthLevels?: number): DepthLevel[] {
    const levels: DepthLevel[] = [];
    for (const [price, size] of side.entries()) {
      const p = Number(price);
      const s = Number(size);
      if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(s) || s <= 0) {
        continue;
      }
      levels.push({ price: p, shares: s });
    }

    levels.sort((a, b) => (kind === 'BID' ? b.price - a.price : a.price - b.price));
    if (depthLevels && depthLevels > 0) {
      return levels.slice(0, depthLevels);
    }
    return levels;
  }

  private buildUrl(): string {
    const separator = this.config.url.includes('?') ? '&' : '?';
    return `${this.config.url}${separator}apikey=${encodeURIComponent(this.config.apiKey)}`;
  }

  private onOpen(): void {
    this.connected = true;
    this.reconnectDelay = this.config.reconnectMinMs ?? 1000;
    for (const id of this.subscribedMarkets) {
      this.sendSubscribe(id);
    }
    this.startHeartbeat();
  }

  private onClose(): void {
    this.connected = false;
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = undefined;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
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

  private startHeartbeat(): void {
    const interval = this.config.heartbeatMs ?? 30000;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'HEARTBEAT' }));
      }
    }, interval);
  }

  private sendSubscribe(marketId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(
      JSON.stringify({
        action: 'SUBSCRIBE',
        channel: 'market.depth.diff',
        marketId,
      })
    );
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

    if (Array.isArray(message)) {
      for (const entry of message) {
        this.applyDepthDiff(entry);
      }
      return;
    }

    if (message?.data && Array.isArray(message.data)) {
      for (const entry of message.data) {
        this.applyDepthDiff(entry);
      }
      return;
    }

    this.applyDepthDiff(message);
  }

  private applyDepthDiff(entry: DepthDiffMessage): void {
    if (entry?.channel && entry.channel !== 'market.depth.diff') {
      return;
    }

    const tokenId = entry?.tokenId ? String(entry.tokenId) : '';
    const side = entry?.side;
    if (!tokenId || (side !== 'bids' && side !== 'asks')) {
      return;
    }

    const price = Number(entry.price);
    const size = Number(entry.size);
    if (!Number.isFinite(price) || !Number.isFinite(size)) {
      return;
    }

    const book = this.books.get(tokenId) || this.createBook();

    const map = side === 'bids' ? book.bids : book.asks;
    const key = price.toFixed(6);
    if (size <= 0) {
      map.delete(key);
    } else {
      map.set(key, size);
    }

    if (side === 'bids') {
      if (book.bestBid === undefined || price > book.bestBid) {
        book.bestBid = price;
        book.bidSize = size;
      } else if (book.bestBid === price && size <= 0) {
        const best = this.findBest(map, 'bids');
        book.bestBid = best.price;
        book.bidSize = best.size;
      } else if (book.bestBid === price) {
        book.bidSize = size;
      }
    }

    if (side === 'asks') {
      if (book.bestAsk === undefined || price < book.bestAsk) {
        book.bestAsk = price;
        book.askSize = size;
      } else if (book.bestAsk === price && size <= 0) {
        const best = this.findBest(map, 'asks');
        book.bestAsk = best.price;
        book.askSize = best.size;
      } else if (book.bestAsk === price) {
        book.askSize = size;
      }
    }

    book.timestamp = Date.now();
    this.books.set(tokenId, book);
  }

  private createBook(): OrderbookState {
    return {
      bids: new Map(),
      asks: new Map(),
      bestBid: undefined,
      bestAsk: undefined,
      bidSize: undefined,
      askSize: undefined,
      timestamp: 0,
    };
  }

  private findBest(map: OrderbookSide, side: 'bids' | 'asks'): { price?: number; size?: number } {
    let bestPrice: number | undefined;
    let bestSize: number | undefined;
    for (const [priceStr, size] of map.entries()) {
      const price = Number(priceStr);
      if (!Number.isFinite(price)) {
        continue;
      }
      if (bestPrice === undefined) {
        bestPrice = price;
        bestSize = size;
        continue;
      }
      if (side === 'bids' && price > bestPrice) {
        bestPrice = price;
        bestSize = size;
      }
      if (side === 'asks' && price < bestPrice) {
        bestPrice = price;
        bestSize = size;
      }
    }
    return { price: bestPrice, size: bestSize };
  }
}
