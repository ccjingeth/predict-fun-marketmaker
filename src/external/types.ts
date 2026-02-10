export type ExternalPlatform = 'Predict' | 'Polymarket' | 'Opinion';

export interface PlatformOrderbook {
  bestBid?: number;
  bestAsk?: number;
  bidSize?: number;
  askSize?: number;
}

export interface PlatformMarket {
  platform: ExternalPlatform;
  marketId: string;
  question: string;
  yesTokenId?: string;
  noTokenId?: string;
  yesBid?: number;
  yesAsk?: number;
  noBid?: number;
  noAsk?: number;
  yesBidSize?: number;
  yesAskSize?: number;
  noBidSize?: number;
  noAskSize?: number;
  yesMid?: number;
  noMid?: number;
  feeBps?: number;
  feeCurveRate?: number;
  feeCurveExponent?: number;
  timestamp: number;
  metadata?: Record<string, string>;
}

export interface PlatformLeg {
  platform: ExternalPlatform;
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  shares: number;
  outcome?: 'YES' | 'NO';
}

export interface PlatformProvider {
  platform: ExternalPlatform;
  getMarkets(): Promise<PlatformMarket[]>;
}
