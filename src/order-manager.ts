/**
 * SDK-backed order manager
 * Handles order building/signing for Predict API payloads.
 */

import { ChainId, OrderBuilder, Side, type Book } from '@predictdotfun/sdk';
import { JsonRpcProvider, Wallet, parseUnits } from 'ethers';
import type { Config, Market, Orderbook } from './types.js';

export interface LimitOrderParams {
  market: Market;
  side: 'BUY' | 'SELL';
  price: number;
  shares: number;
}

export interface MarketOrderParams {
  market: Market;
  side: 'BUY' | 'SELL';
  shares: number;
  orderbook: Orderbook;
  slippageBps?: string;
}

export class OrderManager {
  private readonly config: Config;
  private readonly chainId: ChainId;
  private readonly wallet: Wallet;
  private readonly orderBuilder: OrderBuilder;

  private constructor(config: Config, chainId: ChainId, wallet: Wallet, orderBuilder: OrderBuilder) {
    this.config = config;
    this.chainId = chainId;
    this.wallet = wallet;
    this.orderBuilder = orderBuilder;
  }

  static async create(config: Config): Promise<OrderManager> {
    const chainId = config.apiBaseUrl.includes('sepolia') ? ChainId.BnbTestnet : ChainId.BnbMainnet;

    const wallet = config.rpcUrl
      ? new Wallet(config.privateKey, new JsonRpcProvider(config.rpcUrl))
      : new Wallet(config.privateKey);

    const orderBuilder = await OrderBuilder.make(chainId, wallet, {
      ...(config.predictAccountAddress ? { predictAccount: config.predictAccountAddress } : {}),
    });

    return new OrderManager(config, chainId, wallet, orderBuilder);
  }

  getSignerAddress(): string {
    return this.wallet.address;
  }

  getMakerAddress(): string {
    return this.config.predictAccountAddress || this.wallet.address;
  }

  getChainId(): ChainId {
    return this.chainId;
  }

  async setApprovals() {
    return this.orderBuilder.setApprovals();
  }

  async buildLimitOrderPayload(params: LimitOrderParams): Promise<any> {
    const side = params.side === 'BUY' ? Side.BUY : Side.SELL;

    const sharesWei = this.toWei(params.shares, 5);
    const priceWei = this.toWei(params.price, 6);

    const { pricePerShare, makerAmount, takerAmount } = this.orderBuilder.getLimitOrderAmounts({
      side,
      quantityWei: sharesWei,
      pricePerShareWei: priceWei,
    });

    const order = this.orderBuilder.buildOrder('LIMIT', {
      side,
      tokenId: params.market.token_id,
      makerAmount,
      takerAmount,
      feeRateBps: params.market.fee_rate_bps || 0,
    });

    const typedData = this.orderBuilder.buildTypedData(order, {
      isNegRisk: params.market.is_neg_risk,
      isYieldBearing: params.market.is_yield_bearing,
    });

    const signedOrder = await this.orderBuilder.signTypedDataOrder(typedData);
    const hash = this.orderBuilder.buildTypedDataHash(typedData);

    return {
      data: {
        order: { ...signedOrder, hash },
        pricePerShare: String(pricePerShare),
        strategy: 'LIMIT',
      },
    };
  }

  async buildMarketOrderPayload(params: MarketOrderParams): Promise<any> {
    const side = params.side === 'BUY' ? Side.BUY : Side.SELL;

    const book = this.buildBook(params.orderbook);
    const quantityWei = this.toWei(params.shares, 5);

    const { pricePerShare, makerAmount, takerAmount } = this.orderBuilder.getMarketOrderAmounts(
      {
        side,
        quantityWei,
      },
      book
    );

    const order = this.orderBuilder.buildOrder('MARKET', {
      side,
      tokenId: params.market.token_id,
      makerAmount,
      takerAmount,
      feeRateBps: params.market.fee_rate_bps || 0,
    });

    const typedData = this.orderBuilder.buildTypedData(order, {
      isNegRisk: params.market.is_neg_risk,
      isYieldBearing: params.market.is_yield_bearing,
    });

    const signedOrder = await this.orderBuilder.signTypedDataOrder(typedData);
    const hash = this.orderBuilder.buildTypedDataHash(typedData);

    return {
      data: {
        order: { ...signedOrder, hash },
        pricePerShare: String(pricePerShare),
        strategy: 'MARKET',
        slippageBps: params.slippageBps || '200',
      },
    };
  }

  private toWei(value: number, decimals: number): bigint {
    const normalized = Number.isFinite(value) && value > 0 ? value : 0;
    const asString = normalized
      .toFixed(decimals)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*?)0+$/, '$1');

    return parseUnits(asString || '0', 18);
  }

  private buildBook(orderbook: Orderbook): Book {
    const asks = (orderbook.asks || [])
      .map((x) => [Number(x.price), Number(x.shares)] as [number, number])
      .filter(([price, size]) => Number.isFinite(price) && Number.isFinite(size) && price > 0 && size > 0)
      .sort((a, b) => a[0] - b[0]);

    const bids = (orderbook.bids || [])
      .map((x) => [Number(x.price), Number(x.shares)] as [number, number])
      .filter(([price, size]) => Number.isFinite(price) && Number.isFinite(size) && price > 0 && size > 0)
      .sort((a, b) => b[0] - a[0]);

    return {
      marketId: 0,
      updateTimestampMs: Date.now(),
      asks,
      bids,
    };
  }
}
