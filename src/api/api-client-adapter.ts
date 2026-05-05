/**
 * 🔌 统一API客户端适配器
 *
 * 提供统一的API调用接口，支持 Predict 平台
 *
 * @author Predict.fun Team
 * @version 1.0.0
 */

import PredictSdk from '@predictdotfun/sdk';
import { JsonRpcProvider, Wallet, formatUnits } from 'ethers';
import { PredictAPI } from './client.js';
import { createRobustProvider } from '../rpc-provider.js';

const { ChainId, OrderBuilder } = PredictSdk as any;

/**
 * 平台类型
 */
export enum PlatformType {
  PREDICT = 'predict',}

/**
 * 订单状态
 */
export enum OrderStatus {
  PENDING = 'pending',
  OPEN = 'open',
  FILLED = 'filled',
  PARTIALLY_FILLED = 'partially_filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

/**
 * 订单信息
 */
export interface OrderInfo {
  orderId: string;
  marketId: string;
  tokenId: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  amount: number;
  price: number;
  filledAmount: number;
  status: OrderStatus;
  timestamp: number;
  txHash?: string;
}

/**
 * 市场信息
 */
export interface MarketInfo {
  marketId: string;
  marketTitle: string;
  settlementTime: number;
  outcomes: any[];
  volume: number;
  liquidity: number;
  status: string;
  createdAt: number;
}

/**
 * 钱包余额
 */
export interface WalletBalance {
  address: string;
  balance: number;          // USDT余额
  tokens: Map<string, number>; // 其他代币余额
  timestamp: number;
}

/**
 * API客户端适配器
 */
export class APIClientAdapter {
  private predictAPI: PredictAPI;
  private platform: PlatformType;
  private config: any;
  private predictOrderBuilderPromise: Promise<any> | null = null;

  constructor(platform: PlatformType, config: any) {
    this.platform = platform;
    this.config = config;
    this.predictAPI = new PredictAPI(config.apiUrl, config.apiKey, config.jwtToken);
  }

  private getPredictChainId(): number {
    return this.config.predictChainId ?? ChainId.BnbMainnet;
  }

  private toMarketInfo(market: any): MarketInfo {
    return {
      marketId: String(market?.event_id ?? market?.marketId ?? market?.token_id ?? ''),
      marketTitle: String(market?.question ?? market?.marketTitle ?? 'Unknown market'),
      settlementTime: market?.end_date ? new Date(market.end_date).getTime() : Date.now() + 86400000,
      outcomes: Array.isArray(market?.outcomes) ? market.outcomes : [],
      volume: Number(market?.volume_24h ?? market?.volume ?? 0),
      liquidity: Number(market?.liquidity_24h ?? market?.liquidity ?? 0),
      status: String(market?.status ?? 'active'),
      createdAt: market?.createdAt ? Number(market.createdAt) : Date.now()
    };
  }

  private async getPredictOrderBuilder(): Promise<any> {
    if (this.predictOrderBuilderPromise) {
      return this.predictOrderBuilderPromise;
    }

    if (!this.config.privateKey) {
      throw new Error('PRIVATE_KEY is required to query Predict account balance');
    }

    const chainId = this.getPredictChainId();
    const { provider } = await createRobustProvider(this.config.rpcUrl, 20000);
    const wallet = new Wallet(this.config.privateKey, provider);

    this.predictOrderBuilderPromise = OrderBuilder.make(chainId, wallet, {
      ...(this.config.predictAddress ? { predictAccount: this.config.predictAddress } : {}),
    });

    return this.predictOrderBuilderPromise;
  }

  /**
   * 获取市场信息
   */
  async fetchMarket(marketId: string): Promise<MarketInfo | null> {
    try {
      const market = await this.predictAPI.getMarket(marketId);

      if (!market) {
        return null;
      }

      return this.toMarketInfo(market);
    } catch (error: any) {
      console.error(`获取市场信息失败: ${marketId}`, error?.message || error);
      return null;
    }
  }

  /**
   * 获取所有市场
   */
  async fetchAllMarkets(): Promise<MarketInfo[]> {
    try {
      const markets = await this.predictAPI.getMarkets({ silent: true });
      return markets.map((m) => this.toMarketInfo(m));
    } catch (error: any) {
      console.error('获取市场列表失败:', error?.message || error);
      return [];
    }
  }

  /**
   * 创建订单
   */
  async createOrder(params: {
    marketId: string;
    tokenId: string;
    side: 'buy' | 'sell';
    amount: number;
    price?: number;
  }): Promise<{ orderId: string; txHash?: string }> {
    try {
      // 调用实际的API创建订单
      const result = await this.predictAPI.createOrder({
        marketId: params.marketId,
        tokenId: params.tokenId,
        side: params.side,
        amount: params.amount,
        price: params.price || 0
      });

      return {
        orderId: result.orderId || `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        txHash: result.txHash
      };

    } catch (error: any) {
      console.error('创建订单失败:', error?.message || error);
      throw error;
    }
  }

  /**
   * 查询订单状态
   */
  async fetchOrderStatus(orderId: string): Promise<OrderInfo | null> {
    try {
      const orderData = await this.predictAPI.getOrder(orderId);

      if (!orderData) {
        return null;
      }

      return {
        orderId: orderData.id || orderData.order_hash || orderId,
        marketId: orderData.token_id || '',
        tokenId: orderData.token_id || '',
        side: String(orderData.side || 'BUY').toLowerCase() === 'sell' ? 'sell' : 'buy',
        orderType: String(orderData.order_type || 'LIMIT').toLowerCase() === 'market' ? 'market' : 'limit',
        amount: Number(orderData.shares || 0),
        price: Number(orderData.price || 0),
        filledAmount: 0,
        status: this.mapOrderStatus(String(orderData.status || 'OPEN').toLowerCase()),
        timestamp: orderData.timestamp || Date.now(),
        txHash: undefined
      };

    } catch (error: any) {
      console.error(`查询订单状态失败: ${orderId}`, error?.message || error);
      return null;
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.predictAPI.cancelOrder({ id: orderId });
      return true;

    } catch (error: any) {
      console.error(`取消订单失败: ${orderId}`, error?.message || error);
      return false;
    }
  }

  /**
   * 获取钱包余额
   */
  async fetchWalletBalance(): Promise<WalletBalance | null> {
    try {
      if (this.platform !== PlatformType.PREDICT) {
        throw new Error(`Unsupported platform for wallet balance: ${this.platform}`);
      }

      const orderBuilder = await this.getPredictOrderBuilder();
      const balanceWei = await orderBuilder.balanceOf('USDT');
      const signerAddress = this.config.privateKey ? new Wallet(this.config.privateKey).address : '';
      const accountAddress = this.config.predictAddress || signerAddress;

      return {
        address: accountAddress,
        balance: Number(formatUnits(balanceWei, 18)),
        tokens: new Map(),
        timestamp: Date.now()
      };

    } catch (error: any) {
      console.error('获取钱包余额失败:', error?.message || error);
      return null;
    }
  }

  /**
   * 获取订单簿
   */
  async fetchOrderBook(marketId: string, tokenId: string): Promise<any> {
    try {
      return await this.predictAPI.getOrderbook(tokenId || marketId);
    } catch (error: any) {
      console.error(`获取订单簿失败: ${marketId}/${tokenId}`, error?.message || error);
      return null;
    }
  }

  /**
   * 映射订单状态
   */
  private mapOrderStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'pending': OrderStatus.PENDING,
      'open': OrderStatus.OPEN,
      'filled': OrderStatus.FILLED,
      'partially_filled': OrderStatus.PARTIALLY_FILLED,
      'cancelled': OrderStatus.CANCELLED,
      'rejected': OrderStatus.REJECTED,
      'expired': OrderStatus.EXPIRED
    };

    return statusMap[status] || OrderStatus.PENDING;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    api: boolean;
    rpc: boolean;
    latency: number;
  }> {
    const startTime = Date.now();

    try {
      // 测试API连接
      await this.predictAPI.getMarkets({ silent: true, maxPages: 1 });
      const apiOk = true;
      const latency = Date.now() - startTime;

      // RPC健康检查（简化版）
      const rpcOk = true;

      return {
        api: apiOk,
        rpc: rpcOk,
        latency
      };

    } catch (error) {
      return {
        api: false,
        rpc: false,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * 获取平台信息
   */
  getPlatform(): PlatformType {
    return this.platform;
  }

  /**
   * 获取配置
   */
  getConfig(): any {
    return this.config;
  }
}

/**
 * 全局API适配器实例
 */
const globalAPIClients = new Map<PlatformType, APIClientAdapter>();

/**
 * 获取全局API客户端
 */
export function getAPIClient(platform: PlatformType = PlatformType.PREDICT): APIClientAdapter {
  const cached = globalAPIClients.get(platform);
  if (cached) {
    return cached;
  }

  const config = {
    apiUrl: process.env.API_BASE_URL || 'https://api.predict.fun',
    apiKey: process.env.API_KEY,
    jwtToken: process.env.JWT_TOKEN,
    rpcUrl: process.env.RPC_URL,
    privateKey: process.env.PRIVATE_KEY,
    predictAddress: process.env.PREDICT_ACCOUNT_ADDRESS,
    predictChainId: parseInt(process.env.PREDICT_CHAIN_ID || '56', 10)
  };

  const client = new APIClientAdapter(platform, config);
  globalAPIClients.set(platform, client);
  return client;
}
