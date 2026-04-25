/**
 * API Client for Predict.fun
 * Handles REST API interactions (supports both /v1 and legacy endpoints)
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import type { Market, Orderbook, Order, OrderbookEntry } from '../types.js';

type HttpMethod = 'get' | 'post' | 'delete';

interface RequestOptions {
  params?: Record<string, unknown>;
  data?: unknown;
  requireJwt?: boolean;
}

interface PredictTokenMeta {
  marketId: string;
  outcomeIndex: number;
  outcomeCount: number;
}

export class PredictAPI {
  private client: AxiosInstance;
  private apiKey?: string;
  private rawJwtToken?: string;
  private jwtToken?: string;
  private marketIdByTokenId = new Map<string, string>();
  private tokenMetaByTokenId = new Map<string, PredictTokenMeta>();

  constructor(baseUrl: string, apiKey?: string, jwtToken?: string) {
    this.apiKey = apiKey;
    this.rawJwtToken = jwtToken;
    this.jwtToken = this.normalizeJwtToken(jwtToken);

    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    this.client = axios.create({
      baseURL: normalizedBaseUrl,
      timeout: 15000,
      headers,
    });
  }

  private normalizeJwtToken(token?: string): string | undefined {
    if (!token) return undefined;
    const trimmed = String(token).trim().replace(/^['"]|['"]$/g, '');
    const withoutBearer = trimmed.replace(/^Bearer\s+/i, '');
    if (!withoutBearer) return undefined;
    if (!/^[A-Za-z0-9._+=/-]+$/.test(withoutBearer)) {
      return undefined;
    }
    return withoutBearer;
  }

  private unwrapData<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data as T;
    }

    return payload as T;
  }

  private extractList(payload: any): any[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    const candidates = [
      payload?.markets,
      payload?.items,
      payload?.results,
      payload?.result,
      payload?.data?.markets,
      payload?.data?.items,
      payload?.data?.results,
      payload?.data?.result,
      payload?.data,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    return [];
  }

  private firstFiniteNumber(...values: unknown[]): number {
    for (const value of values) {
      if (value === null || value === undefined || value === '') {
        continue;
      }
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  }

  private shouldTryFallback(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    const status = error.response?.status;
    return status === 404 || status === 405 || status === 501;
  }

  private extractAxiosMessage(error: unknown): string {
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error.message : String(error);
    }
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message || error.message || 'Unknown API error';
  }

  private ensureJwtAvailable() {
    if (!this.jwtToken) {
      if (this.rawJwtToken) {
        throw new Error(
          'JWT_TOKEN 格式无效或仍是占位符。请重新获取 JWT，或清空 JWT_TOKEN 后再执行仅公共接口操作。'
        );
      }
      throw new Error(
        'JWT_TOKEN is required for private endpoints. Run auth flow and set JWT_TOKEN in .env.'
      );
    }
  }

  private async requestWithFallback<T>(
    method: HttpMethod,
    paths: string[],
    options: RequestOptions = {}
  ): Promise<T> {
    if (options.requireJwt) {
      this.ensureJwtAvailable();
    }

    let lastError: unknown;

    for (const path of paths) {
      try {
        const response = await this.client.request({
          method,
          url: path,
          params: options.params,
          data: options.data,
          headers: options.requireJwt
            ? {
                Authorization: `Bearer ${this.jwtToken}`,
              }
            : undefined,
        });

        return this.unwrapData<T>(response.data);
      } catch (error) {
        lastError = error;

        if (this.shouldTryFallback(error)) {
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  private async requestWithFallbackRaw(
    method: HttpMethod,
    paths: string[],
    options: RequestOptions = {}
  ): Promise<any> {
    if (options.requireJwt) {
      this.ensureJwtAvailable();
    }

    let lastError: unknown;

    for (const path of paths) {
      try {
        const response = await this.client.request({
          method,
          url: path,
          params: options.params,
          data: options.data,
          headers: options.requireJwt
            ? {
                Authorization: `Bearer ${this.jwtToken}`,
              }
            : undefined,
        });

        return response.data;
      } catch (error) {
        lastError = error;

        if (this.shouldTryFallback(error)) {
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  private normalizeMarket(raw: any): Market {
    const volume24h = this.firstFiniteNumber(
      raw?.volume_24h,
      raw?.volume24hUsd,
      raw?.volume24h,
      raw?.volume24hr,
      raw?.volumeUsd,
      raw?.totalVolumeUsd,
      raw?.volume,
      raw?.stats?.volume24hUsd,
      raw?.stats?.volume24h,
      raw?.stats?.volume24hr,
      raw?.stats?.volume
    );
    const liquidity24h = this.firstFiniteNumber(
      raw?.liquidity_24h,
      raw?.totalLiquidityUsd,
      raw?.liquidity24h,
      raw?.liquidity24hr,
      raw?.liquidityUsd,
      raw?.liquidity,
      raw?.totalLiquidity,
      raw?.stats?.liquidity24hUsd,
      raw?.stats?.liquidity24h,
      raw?.stats?.liquidity24hr,
      raw?.stats?.liquidity
    );

    // Parse outcomes array if available
    const outcomes = Array.isArray(raw?.outcomes)
      ? raw.outcomes.map((o: any) => ({
          name: String(o.name || 'Unknown'),
          indexSet: Number(o.indexSet || 0),
          status: o.status || 'OPEN',
          onChainId: String(o.onChainId || ''),
        }))
      : undefined;

    return {
      token_id: String(
        raw?.token_id ??
          raw?.tokenId ??
          raw?.clobTokenId ??
          raw?.clob_token_id ??
          raw?.resolution?.onChainId ??
          raw?.id ??
          ''
      ),
      question: raw?.question ?? raw?.title ?? raw?.market_question ?? 'Unknown market',
      description: raw?.description,
      condition_id: raw?.condition_id ?? raw?.conditionId ?? raw?.condition?.id,
      event_id:
        raw?.event_id ?? raw?.eventId ?? raw?.event?.id ?? raw?.market_id ?? raw?.marketId ?? raw?.id,
      market_url:
        raw?.market_url ??
        raw?.marketUrl ??
        raw?.share_url ??
        raw?.shareUrl ??
        raw?.url ??
        raw?.websiteUrl,
      market_slug: raw?.slug ?? raw?.market_slug ?? raw?.marketSlug ?? raw?.event?.slug,
      outcome: raw?.outcome ?? raw?.side ?? raw?.resolution?.outcome,
      end_date: raw?.end_date ?? raw?.endsAt,
      is_neg_risk: Boolean(raw?.is_neg_risk ?? raw?.isNegRisk ?? false),
      is_yield_bearing: Boolean(raw?.is_yield_bearing ?? raw?.isYieldBearing ?? false),
      fee_rate_bps: Number(raw?.fee_rate_bps ?? raw?.feeRateBps ?? 0),
      volume_24h: Number(volume24h ?? 0),
      liquidity_24h: Number(liquidity24h ?? 0),
      outcomes,
      // 将 API 返回的积分规则正规化为统一的 snake_case 格式
      liquidity_activation: (() => {
        // 1) 先检查嵌套的 liquidity_activation 对象
        const la = raw?.liquidity_activation ?? raw?.liquidityActivation ?? raw?.points_rules ?? raw?.reward_rules;
        if (la && typeof la === 'object') {
          const maxSpread = la.max_spread ?? la.maxSpread;
          const maxSpreadCents = la.max_spread_cents ?? la.maxSpreadCents ??
            (maxSpread && maxSpread > 0 ? (maxSpread > 1 ? Math.round(maxSpread) : Math.round(maxSpread * 100)) : undefined);
          const minShares = la.min_shares ?? la.minShares ?? la.share_threshold ?? la.shareThreshold;
          const isActive = la.active ?? la.isActive ?? la.is_boosted ?? la.isBoosted;
          if (maxSpreadCents || maxSpread) {
            return {
              active: !!isActive,
              min_shares: minShares && minShares > 0 ? minShares : undefined,
              max_spread_cents: maxSpreadCents && maxSpreadCents > 0 ? maxSpreadCents : undefined,
              max_spread: maxSpread && maxSpread > 0 ? maxSpread : (maxSpreadCents && maxSpreadCents > 0 ? maxSpreadCents / 100 : undefined),
              description: la.description ?? 'api-normalized-nested',
            };
          }
        }
        // 2) 再检查顶层字段（predict.fun 新 API 结构）
        const topMaxSpread = raw?.spreadThreshold ?? raw?.spread_threshold ?? raw?.maxSpread ?? raw?.maxSpreadCents ?? raw?.max_spread_cents;
        if (topMaxSpread && topMaxSpread > 0) {
          const maxSpreadCents = topMaxSpread > 1 ? Math.round(topMaxSpread) : Math.round(topMaxSpread * 100);
          const minShares = raw?.shareThreshold ?? raw?.share_threshold ?? raw?.minShares ?? raw?.min_shares;
          return {
            active: true,
            min_shares: minShares && minShares > 0 ? minShares : undefined,
            max_spread_cents: maxSpreadCents,
            max_spread: maxSpreadCents / 100,
            description: 'api-normalized-top-level',
          };
        }
        return undefined;
      })(),
    };
  }

  private normalizeMarketRecords(raw: any): Market[] {
    const baseMarket = this.normalizeMarket(raw);
    const marketId = String(raw?.id ?? raw?.market_id ?? raw?.marketId ?? baseMarket.event_id ?? '');
    const outcomes = Array.isArray(raw?.outcomes) ? raw.outcomes : [];
    const expanded = outcomes
      .map((outcome: any, index: number) => ({
        tokenId: String(outcome?.onChainId ?? outcome?.tokenId ?? outcome?.token_id ?? ''),
        name: String(outcome?.name ?? ''),
        index,
      }))
      .filter((outcome: {tokenId: string; name: string; index: number}) => outcome.tokenId);

    if (expanded.length === 0) {
      if (baseMarket.token_id && marketId) {
        this.marketIdByTokenId.set(baseMarket.token_id, marketId);
      }
      return [baseMarket];
    }

    return expanded.map((outcome: {tokenId: string; name: string; index: number}) => {
      if (outcome.tokenId && marketId) {
        this.marketIdByTokenId.set(outcome.tokenId, marketId);
        this.tokenMetaByTokenId.set(outcome.tokenId, {
          marketId,
          outcomeIndex: outcome.index,
          outcomeCount: expanded.length,
        });
      }
      return {
        ...baseMarket,
        token_id: outcome.tokenId,
        outcome: outcome.name || baseMarket.outcome,
      };
    });
  }

  private normalizeOrder(raw: any): Order | null {
    const orderRaw = raw?.order ?? raw;

    if (!orderRaw) {
      return null;
    }

    const sideRaw = orderRaw?.side;
    const statusRaw = raw?.status ?? orderRaw?.status;

    const side: 'BUY' | 'SELL' =
      sideRaw === 0 || sideRaw === 'BUY' || sideRaw === '0' ? 'BUY' : 'SELL';

    const status: 'OPEN' | 'FILLED' | 'CANCELED' =
      statusRaw === 'FILLED' ? 'FILLED' : statusRaw === 'CANCELED' ? 'CANCELED' : 'OPEN';

    const makerAmount = Number(orderRaw?.makerAmount ?? orderRaw?.maker_amount ?? 0);
    const takerAmount = Number(orderRaw?.takerAmount ?? orderRaw?.taker_amount ?? 0);
    const sharesFromAmount = side === 'BUY' ? takerAmount : makerAmount;

    const rawPrice =
      raw?.pricePerShare ??
      raw?.price_per_share ??
      orderRaw?.price ??
      (side === 'BUY'
        ? takerAmount > 0
          ? makerAmount / takerAmount
          : 0
        : makerAmount > 0
          ? takerAmount / makerAmount
          : 0);

    const tokenId = String(orderRaw?.tokenId ?? orderRaw?.token_id ?? raw?.token_id ?? '');
    const orderHash = String(orderRaw?.hash ?? orderRaw?.order_hash ?? raw?.order_hash ?? '');

    if (!tokenId || !orderHash) {
      return null;
    }

    const sharesRaw =
      raw?.shares ?? orderRaw?.shares ?? (Number.isFinite(sharesFromAmount) ? sharesFromAmount : 0);

    return {
      id: raw?.id ? String(raw.id) : undefined,
      order_hash: orderHash,
      token_id: tokenId,
      maker: String(orderRaw?.maker ?? raw?.maker ?? ''),
      signer: orderRaw?.signer ? String(orderRaw.signer) : undefined,
      order_type: orderRaw?.orderType === 'MARKET' || orderRaw?.order_type === 'MARKET' ? 'MARKET' : 'LIMIT',
      side,
      price: String(rawPrice ?? 0),
      shares: String(sharesRaw ?? 0),
      is_neg_risk: Boolean(raw?.isNegRisk ?? raw?.is_neg_risk ?? orderRaw?.is_neg_risk ?? false),
      is_yield_bearing: Boolean(
        raw?.isYieldBearing ?? raw?.is_yield_bearing ?? orderRaw?.is_yield_bearing ?? false
      ),
      fee_rate_bps: Number(orderRaw?.feeRateBps ?? orderRaw?.fee_rate_bps ?? 0),
      signature: orderRaw?.signature,
      status,
      timestamp: raw?.createdAt
        ? new Date(raw.createdAt).getTime()
        : raw?.timestamp
          ? Number(raw.timestamp)
          : Date.now(),
    };
  }

  /**
   * Get all active markets
   */
  async getMarkets(
    options: { silent?: boolean; throwOnError?: boolean; status?: string; maxPages?: number } = {}
  ): Promise<Market[]> {
    const { silent = false, throwOnError = true, status, maxPages = 6 } = options;

    try {
      const collected: any[] = [];
      let after: string | undefined;

      for (let page = 0; page < Math.max(1, Math.min(20, maxPages)); page += 1) {
        const payload = await this.requestWithFallbackRaw('get', ['/v1/markets', '/markets'], {
          params: {
            ...(status ? { status } : {}),
            ...(after ? { after } : {}),
          },
          requireJwt: true,
        });
        const rawMarkets = this.extractList(payload);
        if (rawMarkets.length === 0) {
          break;
        }
        collected.push(...rawMarkets);
        const cursor =
          typeof payload?.cursor === 'string'
            ? payload.cursor
            : typeof payload?.data?.cursor === 'string'
              ? payload.data.cursor
              : undefined;
        if (!cursor) {
          break;
        }
        after = cursor;
      }

      return collected
        .flatMap((m) => this.normalizeMarketRecords(m))
        .filter((m) => m.token_id && m.token_id !== 'undefined');
    } catch (error) {
      if (!silent) {
        console.error('Error fetching markets:', error);
      }
      if (throwOnError) {
        throw error;
      }
      return [];
    }
  }
  /**
   * Get a specific market by token ID
   */
  async getMarket(tokenId: string): Promise<Market> {
    try {
      const raw = await this.requestWithFallback<any>('get', [`/v1/markets/${tokenId}`, `/markets/${tokenId}`], { requireJwt: true });
      return this.normalizeMarket(raw);
    } catch (error) {
      console.error(`Error fetching market ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Get orderbook for a specific token
   */
  async getOrderbook(tokenId: string): Promise<Orderbook> {
    try {
      const marketLookupId = this.marketIdByTokenId.get(tokenId) || tokenId;
      const rawData = await this.requestWithFallback<any>('get', [`/v1/markets/${marketLookupId}/orderbook`], { requireJwt: true });

      const bidsRaw = Array.isArray(rawData?.bids) ? rawData.bids : [];
      const asksRaw = Array.isArray(rawData?.asks) ? rawData.asks : [];

      const bids: Orderbook['bids'] = bidsRaw
        .map((bid: any) => {
          if (Array.isArray(bid)) {
            return {
              price: String(bid[0] ?? '0'),
              shares: String(bid[1] ?? '0'),
              creator: bid[2] ? String(bid[2]) : undefined,
              orderbook_id: bid[3] ? String(bid[3]) : undefined,
              order_type: bid[4] === 'MARKET' ? 'MARKET' : 'LIMIT',
            };
          }

          return {
            price: String(bid?.price ?? '0'),
            shares: String(bid?.shares ?? bid?.quantity ?? '0'),
            creator: bid?.creator ? String(bid.creator) : undefined,
            orderbook_id: bid?.orderbook_id ? String(bid.orderbook_id) : undefined,
            order_type: bid?.order_type === 'MARKET' ? 'MARKET' : 'LIMIT',
          };
        })
        .filter((x: OrderbookEntry) => Number.isFinite(Number(x.price)));

      const asks: Orderbook['asks'] = asksRaw
        .map((ask: any) => {
          if (Array.isArray(ask)) {
            return {
              price: String(ask[0] ?? '0'),
              shares: String(ask[1] ?? '0'),
              creator: ask[2] ? String(ask[2]) : undefined,
              orderbook_id: ask[3] ? String(ask[3]) : undefined,
              order_type: ask[4] === 'MARKET' ? 'MARKET' : 'LIMIT',
            };
          }

          return {
            price: String(ask?.price ?? '0'),
            shares: String(ask?.shares ?? ask?.quantity ?? '0'),
            creator: ask?.creator ? String(ask.creator) : undefined,
            orderbook_id: ask?.orderbook_id ? String(ask.orderbook_id) : undefined,
            order_type: ask?.order_type === 'MARKET' ? 'MARKET' : 'LIMIT',
          };
        })
        .filter((x: OrderbookEntry) => Number.isFinite(Number(x.price)));

      bids.sort((a, b) => Number(b.price) - Number(a.price));
      asks.sort((a, b) => Number(a.price) - Number(b.price));

      const bestBid = bids.length > 0 ? Number(bids[0].price) : undefined;
      const bestAsk = asks.length > 0 ? Number(asks[0].price) : undefined;

      const spread =
        bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : undefined;
      const spread_pct =
        bestBid !== undefined && bestAsk !== undefined && bestBid > 0
          ? ((bestAsk - bestBid) / bestBid) * 100
          : undefined;
      const mid_price =
        bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : undefined;

      let normalized: Orderbook = {
        token_id: tokenId,
        bids,
        asks,
        best_bid: bestBid,
        best_ask: bestAsk,
        spread,
        spread_pct,
        mid_price,
      };

      const meta = this.tokenMetaByTokenId.get(tokenId);
      if (meta && meta.outcomeCount === 2 && meta.outcomeIndex === 1) {
        const invertedBids = asks
          .map((ask) => ({
            ...ask,
            price: String(Math.max(0, Math.min(1, 1 - Number(ask.price)))),
          }))
          .sort((a, b) => Number(b.price) - Number(a.price));
        const invertedAsks = bids
          .map((bid) => ({
            ...bid,
            price: String(Math.max(0, Math.min(1, 1 - Number(bid.price)))),
          }))
          .sort((a, b) => Number(a.price) - Number(b.price));
        const invBestBid = invertedBids.length > 0 ? Number(invertedBids[0].price) : undefined;
        const invBestAsk = invertedAsks.length > 0 ? Number(invertedAsks[0].price) : undefined;
        normalized = {
          token_id: tokenId,
          bids: invertedBids,
          asks: invertedAsks,
          best_bid: invBestBid,
          best_ask: invBestAsk,
          spread:
            invBestBid !== undefined && invBestAsk !== undefined ? invBestAsk - invBestBid : undefined,
          spread_pct:
            invBestBid !== undefined && invBestAsk !== undefined && invBestBid > 0
              ? ((invBestAsk - invBestBid) / invBestBid) * 100
              : undefined,
          mid_price:
            invBestBid !== undefined && invBestAsk !== undefined ? (invBestBid + invBestAsk) / 2 : undefined,
        };
      }

      return normalized;
    } catch (error) {
      console.error(`Error fetching orderbook for ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Get open orders for a maker address
   */
  async getOrders(maker: string): Promise<Order[]> {
    try {
      const rawOrders = await this.requestWithFallback<any[]>(
        'get',
        ['/v1/orders', '/orders'],
        {
          params: { maker, status: 'OPEN' },
          requireJwt: true,
        }
      );

      if (!Array.isArray(rawOrders)) {
        return [];
      }

      return rawOrders
        .map((o) => this.normalizeOrder(o))
        .filter((o): o is Order => o !== null && o.status === 'OPEN');
    } catch (error) {
      console.error(`Error fetching orders for ${maker}:`, error);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const rawOrder = await this.requestWithFallback<any>(
        'get',
        [`/v1/orders/${orderId}`, `/orders/${orderId}`],
        { requireJwt: true }
      );
      return this.normalizeOrder(rawOrder);
    } catch (error) {
      console.error(`Error fetching order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get positions for an account
   */
  async getPositions(account: string): Promise<any[]> {
    try {
      const response = await this.requestWithFallback<any[]>(
        'get',
        ['/v1/positions', '/positions'],
        {
          params: { account },
          requireJwt: true,
        }
      );

      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error(`Error fetching positions for ${account}:`, error);
      throw error;
    }
  }

  /**
   * Create a new order
   */
  async createOrder(payload: any): Promise<any> {
    try {
      const body = payload?.data
        ? payload
        : {
            data: {
              order: payload,
              pricePerShare: payload?.pricePerShare,
              strategy: payload?.strategy || 'LIMIT',
              ...(payload?.slippageBps !== undefined ? { slippageBps: payload.slippageBps } : {}),
            },
          };

      const response = await this.requestWithFallback<any>('post', ['/v1/orders', '/orders'], {
        data: body,
        requireJwt: true,
      });

      if (response?.success === false) {
        throw new Error(response?.message || 'Predict order rejected');
      }

      return response;
    } catch (error) {
      console.error(`Error creating order: ${this.extractAxiosMessage(error)}`);
      throw error;
    }
  }

  /**
   * Remove orders from the orderbook
   */
  async removeOrders(ids: string[]): Promise<any> {
    try {
      const response = await this.requestWithFallback<any>('delete', ['/v1/orders', '/orders'], {
        data: { ids },
        requireJwt: true,
      });

      return response;
    } catch (error) {
      console.error(`Error removing orders: ${this.extractAxiosMessage(error)}`);
      throw error;
    }
  }

  /**
   * Backward-compat wrapper for old cancel flow
   */
  async cancelOrder(cancelData: any): Promise<any> {
    const ids = Array.isArray(cancelData?.ids)
      ? cancelData.ids
      : cancelData?.id
        ? [cancelData.id]
        : cancelData?.order_hash
          ? [cancelData.order_hash]
          : [];

    if (ids.length === 0) {
      throw new Error('cancelOrder requires ids[] or id/order_hash');
    }

    return this.removeOrders(ids.map((id: unknown) => String(id)));
  }

  /**
   * Test API connection
   */
  async testConnection(silent = false): Promise<boolean> {
    try {
      await this.getMarkets({ silent });
      if (!silent) {
        console.log('✅ API connection successful');
      }
      return true;
    } catch (error: any) {
      if (!silent) {
        if (error.response?.status === 401) {
          console.error('❌ API authentication failed. Check API_KEY and/or JWT_TOKEN.');
        } else if ((error as AxiosError).message) {
          console.error('❌ API connection failed:', (error as AxiosError).message);
        } else {
          console.error('❌ API connection failed');
        }
      }
      return false;
    }
  }
}
