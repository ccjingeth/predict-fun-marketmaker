import axios from 'axios';
import type { PlatformMarket, PlatformProvider } from './types.js';
import type { OpinionWebSocketFeed } from './opinion-ws.js';

interface OpinionConfig {
  openApiUrl: string;
  apiKey: string;
  maxMarkets: number;
  feeBps: number;
  depthLevels?: number;
  useWebSocket?: boolean;
  wsMaxAgeMs?: number;
}

interface OpinionMarket {
  marketId?: string;
  marketTitle?: string;
  yesTokenId?: string;
  noTokenId?: string;
}

function parseOrderbook(
  data: any,
  depthLevels?: number
): {
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  bids?: { price: number; shares: number }[];
  asks?: { price: number; shares: number }[];
} {
  const bids: any[] = data?.bids || data?.result?.bids || [];
  const asks: any[] = data?.asks || data?.result?.asks || [];
  const bidEntry = bids[0] || bids.sort((a, b) => Number(b.price) - Number(a.price))[0];
  const askEntry = asks[0] || asks.sort((a, b) => Number(a.price) - Number(b.price))[0];

  const bid = bidEntry ? Number(bidEntry.price ?? bidEntry[0]) : undefined;
  const ask = askEntry ? Number(askEntry.price ?? askEntry[0]) : undefined;
  const bidSize = bidEntry ? Number(bidEntry.size ?? bidEntry.shares ?? bidEntry[1]) : undefined;
  const askSize = askEntry ? Number(askEntry.size ?? askEntry.shares ?? askEntry[1]) : undefined;

  const bidLevels = bids
    .map((level) => ({
      price: Number(level.price ?? level[0]),
      shares: Number(level.size ?? level.shares ?? level[1]),
    }))
    .filter((level) => Number.isFinite(level.price) && level.price > 0 && Number.isFinite(level.shares) && level.shares > 0)
    .sort((a, b) => b.price - a.price);

  const askLevels = asks
    .map((level) => ({
      price: Number(level.price ?? level[0]),
      shares: Number(level.size ?? level.shares ?? level[1]),
    }))
    .filter((level) => Number.isFinite(level.price) && level.price > 0 && Number.isFinite(level.shares) && level.shares > 0)
    .sort((a, b) => a.price - b.price);

  const limit = depthLevels && depthLevels > 0 ? depthLevels : undefined;
  const limitedBids = limit ? bidLevels.slice(0, limit) : bidLevels;
  const limitedAsks = limit ? askLevels.slice(0, limit) : askLevels;

  return {
    bid: Number.isFinite(bid) ? bid : undefined,
    ask: Number.isFinite(ask) ? ask : undefined,
    bidSize: Number.isFinite(bidSize) ? bidSize : undefined,
    askSize: Number.isFinite(askSize) ? askSize : undefined,
    bids: limitedBids,
    asks: limitedAsks,
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

export class OpinionDataProvider implements PlatformProvider {
  platform: PlatformProvider['platform'] = 'Opinion';
  private config: OpinionConfig;
  private wsFeed?: OpinionWebSocketFeed;

  constructor(config: OpinionConfig, wsFeed?: OpinionWebSocketFeed) {
    this.config = config;
    this.wsFeed = wsFeed;
  }

  async getMarkets(): Promise<PlatformMarket[]> {
    const { openApiUrl, apiKey, maxMarkets, feeBps } = this.config;

    const response = await axios.get(`${openApiUrl}/market`, {
      params: {
        status: 'activated',
        marketType: 0,
        limit: maxMarkets,
      },
      headers: {
        apikey: apiKey,
      },
      timeout: 10000,
    });

    const list: OpinionMarket[] = response.data?.result?.list || [];

    const results: PlatformMarket[] = [];

    const fetchOrderbook = async (tokenId: string) => {
      try {
        const response = await axios.get(`${openApiUrl}/token/orderbook`, {
          params: { token_id: tokenId },
          headers: { apikey: apiKey },
          timeout: 8000,
        });
        return response.data;
      } catch {
        const response = await axios.get(`${openApiUrl}/token/orderbook`, {
          params: { tokenId },
          headers: { apikey: apiKey },
          timeout: 8000,
        });
        return response.data;
      }
    };

    await mapWithLimit(list.slice(0, maxMarkets), 6, async (market) => {
      const yesTokenId = market.yesTokenId;
      const noTokenId = market.noTokenId;
      if (!yesTokenId || !noTokenId) {
        return;
      }

      if (this.wsFeed && this.config.useWebSocket) {
        if (market.marketId) {
          this.wsFeed.subscribeMarketIds([market.marketId]);
        }
      }

      const yesBook = this.wsFeed?.getOrderbook(yesTokenId, this.config.wsMaxAgeMs, this.config.depthLevels);
      const noBook = this.wsFeed?.getOrderbook(noTokenId, this.config.wsMaxAgeMs, this.config.depthLevels);

      let yesTop = yesBook;
      let noTop = noBook;

      const needsDepth = (this.config.depthLevels || 0) > 0;
      const hasDepth = Boolean(yesBook?.bids?.length && yesBook?.asks?.length && noBook?.bids?.length && noBook?.asks?.length);

      if (!yesTop || !yesTop.bestBid || !yesTop.bestAsk || !noTop || !noTop.bestBid || !noTop.bestAsk || (needsDepth && !hasDepth)) {
        const [yesBook, noBook] = await Promise.all([
          fetchOrderbook(yesTokenId),
          fetchOrderbook(noTokenId),
        ]);

        const yesParsed = parseOrderbook(yesBook, this.config.depthLevels);
        const noParsed = parseOrderbook(noBook, this.config.depthLevels);
        yesTop = {
          bestBid: yesParsed.bid,
          bestAsk: yesParsed.ask,
          bidSize: yesParsed.bidSize,
          askSize: yesParsed.askSize,
          bids: yesParsed.bids,
          asks: yesParsed.asks,
        };
        noTop = {
          bestBid: noParsed.bid,
          bestAsk: noParsed.ask,
          bidSize: noParsed.bidSize,
          askSize: noParsed.askSize,
          bids: noParsed.bids,
          asks: noParsed.asks,
        };
      }

      if (!yesTop?.bestBid || !yesTop?.bestAsk || !noTop?.bestBid || !noTop?.bestAsk) {
        return;
      }

      results.push({
        platform: 'Opinion',
        marketId: market.marketId || `${yesTokenId}-${noTokenId}`,
        question: market.marketTitle || '',
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
        yesBids: yesTop.bids,
        yesAsks: yesTop.asks,
        noBids: noTop.bids,
        noAsks: noTop.asks,
        timestamp: Date.now(),
      });
    });

    return results;
  }
}
