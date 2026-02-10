export type ExternalPlatform = 'Predict' | 'Polymarket' | 'Opinion';

export interface DepthLevel {
  price: number;
  shares: number;
}

export interface PlatformOrderbook {
  bestBid?: number;
  bestAsk?: number;
  bidSize?: number;
  askSize?: number;
  bids?: DepthLevel[];
  asks?: DepthLevel[];
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
  yesBids?: DepthLevel[];
  yesAsks?: DepthLevel[];
  noBids?: DepthLevel[];
  noAsks?: DepthLevel[];
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
