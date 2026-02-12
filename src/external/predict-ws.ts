import WebSocket, { type RawData } from 'ws';
import type { Market, Orderbook } from '../types.js';

export interface PredictWsConfig {
  url: string;
  apiKey?: string;
  topicKey: 'token_id' | 'condition_id' | 'event_id';
  reconnectMinMs?: number;
  reconnectMaxMs?: number;
  staleTimeoutMs?: number;
  resetOnReconnect?: boolean;
}

type OrderbookCache = {
  orderbook: Orderbook;
  timestamp: number;
};

export class PredictWebSocketFeed {
  private config: PredictWsConfig;
  private ws?: WebSocket;
  private connected = false;
  private reconnectDelay: number;
  private reconnectTimer?: NodeJS.Timeout;
  private staleTimer?: NodeJS.Timeout;
  private requestId = 1;
  private subscribedTopics = new Set<string>();
  private tokenToTopic = new Map<string, string>();
  private topicToTokens = new Map<string, Set<string>>();
  private cache = new Map<string, OrderbookCache>();
  private lastMessageAt = 0;
  private messageCount = 0;
  private hasConnected = false;

  constructor(config: PredictWsConfig) {
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

  subscribeMarkets(markets: Market[]): void {
    const topics: string[] = [];
    for (const market of markets) {
      const tokenId = market.token_id;
      const topicId = this.getTopicId(market);
      if (!tokenId || !topicId) {
        continue;
      }
      this.tokenToTopic.set(tokenId, topicId);
      if (!this.topicToTokens.has(topicId)) {
        this.topicToTokens.set(topicId, new Set());
      }
      this.topicToTokens.get(topicId)!.add(tokenId);

      const topic = `predictOrderbook/${topicId}`;
      if (!this.subscribedTopics.has(topic)) {
        this.subscribedTopics.add(topic);
        topics.push(topic);
      }
    }

    if (topics.length > 0) {
      this.sendSubscribe(topics);
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
      subscribed: this.subscribedTopics.size,
      cacheSize: this.cache.size,
      lastMessageAt: this.lastMessageAt,
      messageCount: this.messageCount,
    };
  }

  getOrderbook(tokenId: string, maxAgeMs?: number): Orderbook | undefined {
    const topicId = this.tokenToTopic.get(tokenId) || tokenId;
    const cached = this.cache.get(topicId);
    if (!cached) {
      return undefined;
    }
    if (maxAgeMs && Date.now() - cached.timestamp > maxAgeMs) {
      return undefined;
    }
    return {
      ...cached.orderbook,
      token_id: tokenId,
    };
  }

  private buildUrl(): string {
    if (!this.config.apiKey) {
      return this.config.url;
    }
    const separator = this.config.url.includes('?') ? '&' : '?';
    return `${this.config.url}${separator}apiKey=${encodeURIComponent(this.config.apiKey)}`;
  }

  private getTopicId(market: Market): string | undefined {
    if (this.config.topicKey === 'condition_id') {
      return market.condition_id || undefined;
    }
    if (this.config.topicKey === 'event_id') {
      return market.event_id || undefined;
    }
    return market.token_id || undefined;
  }

  private onOpen(): void {
    this.connected = true;
    this.reconnectDelay = this.config.reconnectMinMs ?? 1000;
    if (this.hasConnected && this.config.resetOnReconnect !== false) {
      this.cache.clear();
    }
    this.hasConnected = true;
    this.lastMessageAt = Date.now();
    if (this.subscribedTopics.size > 0) {
      this.sendSubscribe(Array.from(this.subscribedTopics));
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

  private sendSubscribe(topics: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const payload = {
      method: 'subscribe',
      requestId: this.requestId++,
      params: topics,
      data: null,
    };
    this.ws.send(JSON.stringify(payload));
  }

  private sendHeartbeat(data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify({ method: 'heartbeat', data }));
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

    if (message?.type === 'M' && message?.topic === 'heartbeat') {
      this.sendHeartbeat(message?.data);
      return;
    }

    if (message?.type === 'M' && typeof message?.topic === 'string') {
      const topic = message.topic;
      if (!topic.startsWith('predictOrderbook/')) {
        return;
      }
      const [, topicId] = topic.split('/');
      const orderbook = this.parseOrderbook(message?.data);
      if (orderbook) {
        this.cache.set(topicId, { orderbook, timestamp: Date.now() });
      }
    }
  }

  private parseOrderbook(data: any): Orderbook | null {
    if (!data) {
      return null;
    }
    const payload = data?.orderbook ?? data;
    const bidsRaw = Array.isArray(payload?.bids) ? payload.bids : [];
    const asksRaw = Array.isArray(payload?.asks) ? payload.asks : [];

    const bids = bidsRaw
      .map((bid: any) => {
        if (Array.isArray(bid)) {
          return { price: String(bid[0] ?? '0'), shares: String(bid[1] ?? '0') };
        }
        return { price: String(bid?.price ?? '0'), shares: String(bid?.shares ?? bid?.quantity ?? '0') };
      })
      .filter((x: any) => Number.isFinite(Number(x.price)));

    const asks = asksRaw
      .map((ask: any) => {
        if (Array.isArray(ask)) {
          return { price: String(ask[0] ?? '0'), shares: String(ask[1] ?? '0') };
        }
        return { price: String(ask?.price ?? '0'), shares: String(ask?.shares ?? ask?.quantity ?? '0') };
      })
      .filter((x: any) => Number.isFinite(Number(x.price)));

    let bestBid = payload?.best_bid ?? payload?.bestBid;
    let bestAsk = payload?.best_ask ?? payload?.bestAsk;

    if (bestBid === undefined && bids.length > 0) {
      bestBid = Math.max(...bids.map((b: { price: string }) => Number(b.price)));
    }
    if (bestAsk === undefined && asks.length > 0) {
      bestAsk = Math.min(...asks.map((a: { price: string }) => Number(a.price)));
    }

    if (bestBid === undefined && bestAsk === undefined && bids.length === 0 && asks.length === 0) {
      return null;
    }

    return {
      token_id: String(payload?.token_id ?? ''),
      bids,
      asks,
      best_bid: bestBid !== undefined ? Number(bestBid) : undefined,
      best_ask: bestAsk !== undefined ? Number(bestAsk) : undefined,
      spread:
        bestBid !== undefined && bestAsk !== undefined ? Number(bestAsk) - Number(bestBid) : undefined,
      spread_pct:
        bestBid !== undefined && bestAsk !== undefined && Number(bestBid) > 0
          ? (Number(bestAsk) - Number(bestBid)) / Number(bestBid)
          : undefined,
      mid_price:
        bestBid !== undefined && bestAsk !== undefined ? (Number(bestBid) + Number(bestAsk)) / 2 : undefined,
    };
  }
}
