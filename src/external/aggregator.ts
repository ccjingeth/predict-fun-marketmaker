import type { Config, Market, Orderbook } from '../types.js';
import type { PlatformMarket } from './types.js';
import { PolymarketDataProvider } from './polymarket.js';
import { OpinionDataProvider } from './opinion.js';
import { buildPredictPlatformMarkets } from './predict.js';
import { CrossPlatformMappingStore } from './mapping.js';
import { PolymarketWebSocketFeed } from './polymarket-ws.js';
import { OpinionWebSocketFeed } from './opinion-ws.js';

export class CrossPlatformAggregator {
  private config: Config;
  private polymarket?: PolymarketDataProvider;
  private opinion?: OpinionDataProvider;
  private mappingStore?: CrossPlatformMappingStore;
  private polymarketWs?: PolymarketWebSocketFeed;
  private opinionWs?: OpinionWebSocketFeed;

  constructor(config: Config) {
    this.config = config;
    const requireWs = config.crossPlatformRequireWs === true;

    if (config.polymarketGammaUrl && config.polymarketClobUrl) {
      if (config.polymarketWsEnabled) {
        this.polymarketWs = new PolymarketWebSocketFeed({
          url: config.polymarketWsUrl || 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
          customFeatureEnabled: config.polymarketWsCustomFeature,
          initialDump: config.polymarketWsInitialDump,
          maxDepthLevels: config.crossPlatformDepthLevels,
          reconnectMinMs: 1000,
          reconnectMaxMs: 15000,
          staleTimeoutMs: config.polymarketWsStaleMs,
          resetOnReconnect: config.polymarketWsResetOnReconnect,
        });
        this.polymarketWs.start();
      }

      if (requireWs && !config.polymarketWsEnabled) {
        console.warn('CROSS_PLATFORM_REQUIRE_WS=true but POLYMARKET_WS_ENABLED=false, Polymarket data will be skipped.');
      }

        this.polymarket = new PolymarketDataProvider({
          gammaUrl: config.polymarketGammaUrl,
          clobUrl: config.polymarketClobUrl,
          maxMarkets: config.polymarketMaxMarkets || 30,
          feeBps: config.polymarketFeeBps || 0,
          feeRateUrl: config.polymarketFeeRateUrl,
          feeRateCacheMs: config.polymarketFeeRateCacheMs,
          feeCurveRate: config.polymarketFeeCurveRate,
          feeCurveExponent: config.polymarketFeeCurveExponent,
          depthLevels: config.crossPlatformDepthLevels,
          useWebSocket: config.polymarketWsEnabled,
          requireWebSocket: requireWs,
          cacheTtlMs: config.polymarketCacheTtlMs || 60000,
          wsMaxAgeMs: config.arbWsMaxAgeMs || 10000,
        }, this.polymarketWs);
    }

    if (config.opinionOpenApiUrl && config.opinionApiKey) {
      if (config.opinionWsEnabled) {
        this.opinionWs = new OpinionWebSocketFeed({
          url: config.opinionWsUrl || 'wss://ws.opinion.trade',
          apiKey: config.opinionApiKey,
          heartbeatMs: config.opinionWsHeartbeatMs || 30000,
          reconnectMinMs: 1000,
          reconnectMaxMs: 15000,
          staleTimeoutMs: config.opinionWsStaleMs,
          resetOnReconnect: config.opinionWsResetOnReconnect,
        });
        this.opinionWs.start();
      }

      if (requireWs && !config.opinionWsEnabled) {
        console.warn('CROSS_PLATFORM_REQUIRE_WS=true but OPINION_WS_ENABLED=false, Opinion data will be skipped.');
      }

      this.opinion = new OpinionDataProvider({
        openApiUrl: config.opinionOpenApiUrl,
        apiKey: config.opinionApiKey,
        maxMarkets: config.opinionMaxMarkets || 30,
        feeBps: config.opinionFeeBps || 0,
        depthLevels: config.crossPlatformDepthLevels,
        useWebSocket: config.opinionWsEnabled,
        requireWebSocket: requireWs,
        wsMaxAgeMs: config.arbWsMaxAgeMs || 10000,
      }, this.opinionWs);
    }

    if (config.crossPlatformMappingPath) {
      this.mappingStore = new CrossPlatformMappingStore(config.crossPlatformMappingPath);
    }
  }

  getMappingStore(): CrossPlatformMappingStore | undefined {
    return this.mappingStore;
  }

  getWsStatus(): {
    polymarket?: {
      connected: boolean;
      subscribed: number;
      cacheSize: number;
      lastMessageAt: number;
      messageCount: number;
    };
    opinion?: {
      connected: boolean;
      subscribed: number;
      cacheSize: number;
      lastMessageAt: number;
      messageCount: number;
    };
  } {
    return {
      polymarket: this.polymarketWs?.getStatus(),
      opinion: this.opinionWs?.getStatus(),
    };
  }

  async getPlatformMarkets(
    predictMarkets: Market[],
    predictOrderbooks: Map<string, Orderbook>
  ): Promise<Map<string, PlatformMarket[]>> {
    const platformMap = new Map<string, PlatformMarket[]>();

      const predict = buildPredictPlatformMarkets(
        predictMarkets,
        predictOrderbooks,
        this.config.predictFeeBps || 0,
        this.config.crossPlatformDepthLevels
      );
    platformMap.set('Predict', predict);

    if (this.polymarket) {
      try {
        const markets = await this.polymarket.getMarkets();
        platformMap.set('Polymarket', markets);
      } catch (error) {
        console.error('Failed to load Polymarket data:', error);
      }
    }

    if (this.opinion) {
      try {
        const markets = await this.opinion.getMarkets();
        platformMap.set('Opinion', markets);
      } catch (error) {
        console.error('Failed to load Opinion data:', error);
      }
    }

    return platformMap;
  }
}
