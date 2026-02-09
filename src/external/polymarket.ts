import axios from 'axios';
import type { PlatformMarket, PlatformProvider } from './types.js';
import type { PolymarketWebSocketFeed } from './polymarket-ws.js';

interface PolymarketConfig {
  gammaUrl: string;
  clobUrl: string;
  maxMarkets: number;
  feeBps: number;
  useWebSocket?: boolean;
  cacheTtlMs?: number;
  wsMaxAgeMs?: number;
}

interface GammaMarket {
  question?: string;
  title?: string;
  active?: boolean;
  closed?: boolean;
  clobTokenIds?: string[] | string;
  outcomes?: string[] | string;
  outcomePrices?: number[] | string;
  volume?: number;
}

function toArray<T>(value: T[] | string | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseOrderbook(data: any): { bid?: number; ask?: number; bidSize?: number; askSize?: number } {
  const bids: any[] = data?.bids || [];
  const asks: any[] = data?.asks || [];

  const bidEntry = bids[0] || bids.sort((a, b) => Number(b.price) - Number(a.price))[0];
  const askEntry = asks[0] || asks.sort((a, b) => Number(a.price) - Number(b.price))[0];

  const bid = bidEntry ? Number(bidEntry.price ?? bidEntry.priceFloat ?? bidEntry[0]) : undefined;
  const ask = askEntry ? Number(askEntry.price ?? askEntry.priceFloat ?? askEntry[0]) : undefined;
  const bidSize = bidEntry ? Number(bidEntry.size ?? bidEntry.shares ?? bidEntry[1]) : undefined;
  const askSize = askEntry ? Number(askEntry.size ?? askEntry.shares ?? askEntry[1]) : undefined;

  return {
    bid: Number.isFinite(bid) ? bid : undefined,
    ask: Number.isFinite(ask) ? ask : undefined,
    bidSize: Number.isFinite(bidSize) ? bidSize : undefined,
    askSize: Number.isFinite(askSize) ? askSize : undefined,
  };
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      results.push(await fn(current));
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export class PolymarketDataProvider implements PlatformProvider {
  platform: PlatformProvider['platform'] = 'Polymarket';
  private config: PolymarketConfig;
  private wsFeed?: PolymarketWebSocketFeed;
  private cachedMarkets: GammaMarket[] = [];
  private cacheTimestamp = 0;

  constructor(config: PolymarketConfig, wsFeed?: PolymarketWebSocketFeed) {
    this.config = config;
    this.wsFeed = wsFeed;
  }

  async getMarkets(): Promise<PlatformMarket[]> {
    const { clobUrl, maxMarkets, feeBps } = this.config;
    const usable = await this.loadGammaMarkets();

    const results: PlatformMarket[] = [];

    await mapWithLimit(usable.slice(0, maxMarkets), 6, async (market) => {
      const question = market.question || market.title || '';
      const outcomes = toArray<string>(market.outcomes);
      const tokens = toArray<string>(market.clobTokenIds);

      if (outcomes.length < 2 || tokens.length < 2) {
        return;
      }

      const yesIndex = outcomes.findIndex((o) => String(o).toUpperCase() === 'YES');
      const noIndex = outcomes.findIndex((o) => String(o).toUpperCase() === 'NO');

      if (yesIndex < 0 || noIndex < 0) {
        return;
      }

      const yesTokenId = tokens[yesIndex];
      const noTokenId = tokens[noIndex];

      if (this.wsFeed && this.config.useWebSocket) {
        this.wsFeed.subscribeAssets([yesTokenId, noTokenId]);
      }

      let yesTop = this.wsFeed?.getTopOfBook(yesTokenId, this.config.wsMaxAgeMs);
      let noTop = this.wsFeed?.getTopOfBook(noTokenId, this.config.wsMaxAgeMs);

      if (!yesTop || !yesTop.bestBid || !yesTop.bestAsk || !noTop || !noTop.bestBid || !noTop.bestAsk) {
        const [yesBook, noBook] = await Promise.all([
          axios.get(`${clobUrl}/book`, { params: { token_id: yesTokenId }, timeout: 8000 }).then((r) => r.data),
          axios.get(`${clobUrl}/book`, { params: { token_id: noTokenId }, timeout: 8000 }).then((r) => r.data),
        ]);

        const yesParsed = parseOrderbook(yesBook);
        const noParsed = parseOrderbook(noBook);
        yesTop = {
          bestBid: yesParsed.bid,
          bestAsk: yesParsed.ask,
          bidSize: yesParsed.bidSize,
          askSize: yesParsed.askSize,
        };
        noTop = {
          bestBid: noParsed.bid,
          bestAsk: noParsed.ask,
          bidSize: noParsed.bidSize,
          askSize: noParsed.askSize,
        };
      }

      if (!yesTop?.bestBid || !yesTop?.bestAsk || !noTop?.bestBid || !noTop?.bestAsk) {
        return;
      }

      results.push({
        platform: 'Polymarket',
        marketId: `${yesTokenId}-${noTokenId}`,
        question,
        yesTokenId,
        noTokenId,
        yesBid: yesTop.bestBid,
        yesAsk: yesTop.bestAsk,
        noBid: noTop.bestBid,
        noAsk: noTop.bestAsk,
        yesBidSize: yesTop.bidSize,
        yesAskSize: yesTop.askSize,
        noBidSize: noTop.bidSize,
        noAskSize: noTop.askSize,
        yesMid: (yesTop.bestBid + yesTop.bestAsk) / 2,
        noMid: (noTop.bestBid + noTop.bestAsk) / 2,
        feeBps,
        timestamp: Date.now(),
      });
    });

    return results;
  }

  private async loadGammaMarkets(): Promise<GammaMarket[]> {
    const ttl = this.config.cacheTtlMs ?? 60000;
    if (this.cachedMarkets.length > 0 && Date.now() - this.cacheTimestamp < ttl) {
      return this.cachedMarkets.slice(0, this.config.maxMarkets);
    }

    const response = await axios.get(`${this.config.gammaUrl}/markets`, {
      params: { active: true, closed: false, limit: this.config.maxMarkets },
      timeout: 10000,
    });

    const raw = response.data;
    const markets: GammaMarket[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.markets)
      ? raw.markets
      : Array.isArray(raw?.data)
      ? raw.data
      : [];

    const flattened: GammaMarket[] = [];
    for (const entry of markets) {
      const nested = (entry as any)?.markets;
      if (Array.isArray(nested)) {
        for (const m of nested) {
          flattened.push({ ...m, question: m.question || entry.question || entry.title });
        }
      } else {
        flattened.push(entry);
      }
    }

    const usable = flattened.filter((m) => (m.active ?? true) && !(m.closed ?? false));
    this.cachedMarkets = usable;
    this.cacheTimestamp = Date.now();
    return usable;
  }
}
