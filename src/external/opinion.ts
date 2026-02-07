import axios from 'axios';
import type { PlatformMarket, PlatformProvider } from './types.js';

interface OpinionConfig {
  openApiUrl: string;
  apiKey: string;
  maxMarkets: number;
  feeBps: number;
}

interface OpinionMarket {
  marketId?: string;
  marketTitle?: string;
  yesTokenId?: string;
  noTokenId?: string;
}

function parseOrderbook(data: any): { bid?: number; ask?: number; bidSize?: number; askSize?: number } {
  const bids: any[] = data?.bids || data?.result?.bids || [];
  const asks: any[] = data?.asks || data?.result?.asks || [];
  const bidEntry = bids[0] || bids.sort((a, b) => Number(b.price) - Number(a.price))[0];
  const askEntry = asks[0] || asks.sort((a, b) => Number(a.price) - Number(b.price))[0];

  const bid = bidEntry ? Number(bidEntry.price ?? bidEntry[0]) : undefined;
  const ask = askEntry ? Number(askEntry.price ?? askEntry[0]) : undefined;
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

export class OpinionDataProvider implements PlatformProvider {
  platform: PlatformProvider['platform'] = 'Opinion';
  private config: OpinionConfig;

  constructor(config: OpinionConfig) {
    this.config = config;
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

      const [yesBook, noBook] = await Promise.all([
        fetchOrderbook(yesTokenId),
        fetchOrderbook(noTokenId),
      ]);

      const yesTop = parseOrderbook(yesBook);
      const noTop = parseOrderbook(noBook);

      if (!yesTop.bid || !yesTop.ask || !noTop.bid || !noTop.ask) {
        return;
      }

      results.push({
        platform: 'Opinion',
        marketId: market.marketId || `${yesTokenId}-${noTokenId}`,
        question: market.marketTitle || '',
        yesTokenId,
        noTokenId,
        yesBid: yesTop.bid,
        yesAsk: yesTop.ask,
        noBid: noTop.bid,
        noAsk: noTop.ask,
        yesBidSize: yesTop.bidSize,
        yesAskSize: yesTop.askSize,
        noBidSize: noTop.bidSize,
        noAskSize: noTop.askSize,
        yesMid: (yesTop.bid + yesTop.ask) / 2,
        noMid: (noTop.bid + noTop.ask) / 2,
        feeBps,
        timestamp: Date.now(),
      });
    });

    return results;
  }
}
