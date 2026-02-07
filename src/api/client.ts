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

export class PredictAPI {
  private client: AxiosInstance;
  private apiKey?: string;
  private jwtToken?: string;

  constructor(baseUrl: string, apiKey?: string, jwtToken?: string) {
    this.apiKey = apiKey;
    this.jwtToken = jwtToken;

    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    if (this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
    }

    this.client = axios.create({
      baseURL: normalizedBaseUrl,
      timeout: 15000,
      headers,
    });
  }

  private unwrapData<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data as T;
    }

    return payload as T;
  }

  private shouldTryFallback(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    const status = error.response?.status;
    return status === 404 || status === 405 || status === 501;
  }

  private ensureJwtAvailable() {
    if (!this.jwtToken) {
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

  private normalizeMarket(raw: any): Market {
    const volume24h =
      raw?.volume_24h ?? raw?.volume24hUsd ?? raw?.stats?.volume24hUsd ?? raw?.stats?.volume24h;
    const liquidity24h =
      raw?.liquidity_24h ?? raw?.totalLiquidityUsd ?? raw?.stats?.liquidity24hUsd ?? raw?.stats?.liquidity24h;

    return {
      token_id: String(raw?.token_id ?? raw?.tokenId ?? raw?.resolution?.onChainId ?? raw?.id ?? ''),
      question: raw?.question ?? raw?.title ?? raw?.market_question ?? 'Unknown market',
      description: raw?.description,
      condition_id: raw?.condition_id ?? raw?.conditionId ?? raw?.condition?.id,
      event_id: raw?.event_id ?? raw?.eventId ?? raw?.event?.id ?? raw?.market_id ?? raw?.marketId,
      outcome: raw?.outcome ?? raw?.side ?? raw?.resolution?.outcome,
      end_date: raw?.end_date ?? raw?.endsAt,
      is_neg_risk: Boolean(raw?.is_neg_risk ?? raw?.isNegRisk ?? false),
      is_yield_bearing: Boolean(raw?.is_yield_bearing ?? raw?.isYieldBearing ?? false),
      fee_rate_bps: Number(raw?.fee_rate_bps ?? raw?.feeRateBps ?? 0),
      volume_24h: Number(volume24h ?? 0),
      liquidity_24h: Number(liquidity24h ?? 0),
    };
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
  async getMarkets(): Promise<Market[]> {
    try {
      const rawMarkets = await this.requestWithFallback<any[]>('get', ['/v1/markets', '/markets']);
      if (!Array.isArray(rawMarkets)) {
        return [];
      }

      return rawMarkets
        .map((m) => this.normalizeMarket(m))
        .filter((m) => m.token_id && m.token_id !== 'undefined');
    } catch (error) {
      console.error('Error fetching markets:', error);
      throw error;
    }
  }

  /**
   * Get a specific market by token ID
   */
  async getMarket(tokenId: string): Promise<Market> {
    try {
      const raw = await this.requestWithFallback<any>('get', [`/v1/markets/${tokenId}`, `/markets/${tokenId}`]);
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
      const rawData = await this.requestWithFallback<any>('get', [
        `/v1/markets/${tokenId}/orderbook`,
        `/orderbooks/${tokenId}`,
      ]);

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

      return {
        token_id: tokenId,
        bids,
        asks,
        best_bid: bestBid,
        best_ask: bestAsk,
        spread,
        spread_pct,
        mid_price,
      };
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

      return response;
    } catch (error) {
      console.error('Error creating order:', error);
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
      console.error('Error removing orders:', error);
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
  async testConnection(): Promise<boolean> {
    try {
      await this.getMarkets();
      console.log('✅ API connection successful');
      return true;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error('❌ API authentication failed. Check API_KEY and/or JWT_TOKEN.');
      } else if ((error as AxiosError).message) {
        console.error('❌ API connection failed:', (error as AxiosError).message);
      } else {
        console.error('❌ API connection failed');
      }
      return false;
    }
  }
}
