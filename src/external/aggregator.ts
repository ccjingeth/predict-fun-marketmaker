import type { Config, Market, Orderbook } from '../types.js';
import type { PlatformMarket } from './types.js';
import { PolymarketDataProvider } from './polymarket.js';
import { OpinionDataProvider } from './opinion.js';
import { buildPredictPlatformMarkets } from './predict.js';
import { CrossPlatformMappingStore } from './mapping.js';

export class CrossPlatformAggregator {
  private config: Config;
  private polymarket?: PolymarketDataProvider;
  private opinion?: OpinionDataProvider;
  private mappingStore?: CrossPlatformMappingStore;

  constructor(config: Config) {
    this.config = config;

    if (config.polymarketGammaUrl && config.polymarketClobUrl) {
      this.polymarket = new PolymarketDataProvider({
        gammaUrl: config.polymarketGammaUrl,
        clobUrl: config.polymarketClobUrl,
        maxMarkets: config.polymarketMaxMarkets || 30,
        feeBps: config.polymarketFeeBps || 0,
      });
    }

    if (config.opinionOpenApiUrl && config.opinionApiKey) {
      this.opinion = new OpinionDataProvider({
        openApiUrl: config.opinionOpenApiUrl,
        apiKey: config.opinionApiKey,
        maxMarkets: config.opinionMaxMarkets || 30,
        feeBps: config.opinionFeeBps || 0,
      });
    }

    if (config.crossPlatformMappingPath) {
      this.mappingStore = new CrossPlatformMappingStore(config.crossPlatformMappingPath);
    }
  }

  getMappingStore(): CrossPlatformMappingStore | undefined {
    return this.mappingStore;
  }

  async getPlatformMarkets(
    predictMarkets: Market[],
    predictOrderbooks: Map<string, Orderbook>
  ): Promise<Map<string, PlatformMarket[]>> {
    const platformMap = new Map<string, PlatformMarket[]>();

    const predict = buildPredictPlatformMarkets(
      predictMarkets,
      predictOrderbooks,
      this.config.predictFeeBps || 0
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
