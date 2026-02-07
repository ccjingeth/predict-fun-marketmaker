import type { Market, Orderbook } from '../types.js';
import { buildYesNoPairs } from '../arbitrage/pairs.js';
import type { PlatformMarket } from './types.js';

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

export function buildPredictPlatformMarkets(
  markets: Market[],
  orderbooks: Map<string, Orderbook>,
  fallbackFeeBps: number
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
      timestamp: now,
      metadata: {
        conditionId: pair.yes.condition_id || '',
        eventId: pair.yes.event_id || '',
      },
    });
  }

  return results;
}
