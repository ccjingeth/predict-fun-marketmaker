import type { Market, Orderbook, OrderbookEntry } from '../types.js';
import { buildYesNoPairs } from '../arbitrage/pairs.js';
import type { DepthLevel, PlatformMarket } from './types.js';

function topOfBook(orderbook?: Orderbook): {
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
} {
  if (!orderbook) {
    return {};
  }

  const bid = orderbook.best_bid;
  const ask = orderbook.best_ask;
  const bidSize = Number(orderbook.bids?.[0]?.shares || 0);
  const askSize = Number(orderbook.asks?.[0]?.shares || 0);

  return {
    bid: Number.isFinite(bid) ? bid : undefined,
    ask: Number.isFinite(ask) ? ask : undefined,
    bidSize: Number.isFinite(bidSize) ? bidSize : undefined,
    askSize: Number.isFinite(askSize) ? askSize : undefined,
  };
}

function toDepth(entries: OrderbookEntry[] | undefined, side: 'BID' | 'ASK', depthLevels?: number): DepthLevel[] {
  if (!entries || entries.length === 0) {
    return [];
  }
  const levels = entries
    .map((entry) => ({
      price: Number(entry.price),
      shares: Number(entry.shares),
    }))
    .filter((level) => Number.isFinite(level.price) && level.price > 0 && Number.isFinite(level.shares) && level.shares > 0);

  levels.sort((a, b) => (side === 'BID' ? b.price - a.price : a.price - b.price));
  if (depthLevels && depthLevels > 0) {
    return levels.slice(0, depthLevels);
  }
  return levels;
}

export function buildPredictPlatformMarkets(
  markets: Market[],
  orderbooks: Map<string, Orderbook>,
  fallbackFeeBps: number,
  depthLevels?: number
): PlatformMarket[] {
  const now = Date.now();
  const pairs = buildYesNoPairs(markets);
  const results: PlatformMarket[] = [];

  for (const pair of pairs) {
    const yesBook = orderbooks.get(pair.yes.token_id);
    const noBook = orderbooks.get(pair.no.token_id);
    if (!yesBook || !noBook) {
      continue;
    }

    const yesTop = topOfBook(yesBook);
    const noTop = topOfBook(noBook);

    if (!yesTop.ask || !noTop.ask || !yesTop.bid || !noTop.bid) {
      continue;
    }

    results.push({
      platform: 'Predict',
      marketId: pair.key,
      question: pair.yes.question,
      yesTokenId: pair.yes.token_id,
      noTokenId: pair.no.token_id,
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
      feeBps: pair.yes.fee_rate_bps || pair.no.fee_rate_bps || fallbackFeeBps,
      yesBids: toDepth(yesBook.bids, 'BID', depthLevels),
      yesAsks: toDepth(yesBook.asks, 'ASK', depthLevels),
      noBids: toDepth(noBook.bids, 'BID', depthLevels),
      noAsks: toDepth(noBook.asks, 'ASK', depthLevels),
      timestamp: now,
      metadata: {
        conditionId: pair.yes.condition_id || '',
        eventId: pair.yes.event_id || '',
      },
    });
  }

  return results;
}
