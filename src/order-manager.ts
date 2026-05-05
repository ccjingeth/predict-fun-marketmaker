/**
 * SDK-backed order manager
 * Handles order building/signing for Predict API payloads.
 */

import PredictSdk from '@predictdotfun/sdk';
import { Contract, JsonRpcProvider, Wallet, formatUnits, parseUnits } from 'ethers';
import type { Config, Market, Orderbook } from './types.js';
import { createRobustProvider } from './rpc-provider.js';

const {
  AddressesByChainId,
  ChainId,
  ERC20Abi,
  OrderBuilder,
  ProviderByChainId,
  Side,
} = PredictSdk as any;
type Book = {
  marketId: number;
  updateTimestampMs: number;
  asks: [number, number][];
  bids: [number, number][];
};

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

export interface PredictCollateralState {
  tokenAddress: string;
  spenderAddress: string;
  ownerAddress: string;
  requiredWei: bigint;
  balanceWei: bigint;
  allowanceWei: bigint;
  required: string;
  balance: string;
  allowance: string;
}

export interface PredictApprovalDiagnostic {
  signerAddress: string;
  makerAddress: string;
  chainId: number;
  nativeBalanceWei: bigint;
  nativeBalance: string;
  autoSetApprovals: boolean;
}

export class OrderManager {
  private readonly config: Config;
  private readonly chainId: number;
  private readonly wallet: Wallet;
  private readonly provider: JsonRpcProvider;
  private readonly orderBuilder: any;
  private approvalsReady = false;

  private constructor(
    config: Config,
    chainId: number,
    wallet: Wallet,
    provider: JsonRpcProvider,
    orderBuilder: any
  ) {
    this.config = config;
    this.chainId = chainId;
    this.wallet = wallet;
    this.provider = provider;
    this.orderBuilder = orderBuilder;
  }

  static async create(config: Config): Promise<OrderManager> {
    if (!config.privateKey || typeof config.privateKey !== 'string' || config.privateKey.length < 32) {
      throw new Error('Invalid privateKey: must be a non-empty hex string (length >= 32)');
    }
    const chainId = config.predictChainId ?? ChainId.BnbMainnet;
    const { provider } = await createRobustProvider(config.rpcUrl, 15000);
    let wallet: Wallet;
    try {
      wallet = new Wallet(config.privateKey, provider);
    } catch (e) {
      throw new Error(`Failed to initialize wallet: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!wallet.address || wallet.address.length !== 42 || !wallet.address.startsWith('0x')) {
      throw new Error(
        `Wallet address invalid after creation: "${wallet.address}" (type=${typeof wallet.address}, length=${wallet.address?.length}). Private key may be malformed.`
      );
    }

    const orderBuilder = await OrderBuilder.make(chainId, wallet, {
      ...(config.predictAccountAddress ? { predictAccount: config.predictAccountAddress } : {}),
    });

    return new OrderManager(config, chainId, wallet, provider, orderBuilder);
  }

  getSignerAddress(): string {
    return this.wallet.address;
  }

  getMakerAddress(): string {
    const result = this.config.predictAccountAddress || this.wallet.address;
    if (!result || result.length !== 42 || !result.startsWith('0x')) {
      throw new Error(
        `getMakerAddress() returned invalid address: "${result}". predictAccountAddress="${this.config.predictAccountAddress}", wallet.address="${this.wallet.address}"`
      );
    }
    return result;
  }

  getChainId(): number {
    return this.chainId;
  }

  async setApprovals() {
    const result = await this.orderBuilder.setApprovals();
    if (result?.success) {
      this.approvalsReady = true;
    }
    return result;
  }

  async getApprovalDiagnostic(): Promise<PredictApprovalDiagnostic> {
    const signerAddress = this.getSignerAddress();
    const makerAddress = this.getMakerAddress();
    const nativeBalanceWei = await this.provider.getBalance(signerAddress);

    return {
      signerAddress,
      makerAddress,
      chainId: this.chainId,
      nativeBalanceWei,
      nativeBalance: formatUnits(nativeBalanceWei, 18),
      autoSetApprovals: this.config.predictAutoSetApprovals !== false,
    };
  }

  async ensureTradingReady(): Promise<void> {
    if (this.approvalsReady || this.config.predictAutoSetApprovals === false) {
      return;
    }
    const result = await this.setApprovals();
    if (!result?.success) {
      const diag = await this.getApprovalDiagnostic();
      const detail = [
        'Predict approvals failed',
        `signer=${diag.signerAddress}`,
        `maker=${diag.makerAddress}`,
        `chainId=${diag.chainId}`,
        `nativeBalance=${Number(diag.nativeBalance).toFixed(6)}`,
        diag.signerAddress !== diag.makerAddress
          ? 'note=需要由签名钱包持有原生币支付 approvals gas，Predict 账号余额不能替代 gas'
          : 'note=签名钱包需要持有原生币支付 approvals gas',
        result?.message ? `message=${result.message}` : null,
        result?.error ? `error=${result.error}` : null,
      ]
        .filter(Boolean)
        .join(' | ');
      throw new Error(detail);
    }
  }

  async getBuyCollateralState(
    market: Market,
    price: number,
    shares: number,
    bufferBps = 0
  ): Promise<PredictCollateralState> {
    const { makerAmount } = this.getLimitOrderAmounts('BUY', price, shares);
    const requiredWei = (makerAmount * BigInt(10000 + Math.max(0, bufferBps))) / 10000n;
    const { tokenAddress, spenderAddress, ownerAddress } = this.getCollateralAddresses(market);
    const collateral = new Contract(tokenAddress, ERC20Abi, this.provider);
    const [balanceWei, allowanceWei] = await Promise.all([
      this.orderBuilder.balanceOf('USDT', ownerAddress),
      collateral.allowance(ownerAddress, spenderAddress),
    ]);

    return {
      tokenAddress,
      spenderAddress,
      ownerAddress,
      requiredWei,
      balanceWei,
      allowanceWei,
      required: formatUnits(requiredWei, 18),
      balance: formatUnits(balanceWei, 18),
      allowance: formatUnits(allowanceWei, 18),
    };
  }

  async ensureBuyCollateralReady(
    market: Market,
    price: number,
    shares: number,
    bufferBps = 0
  ): Promise<PredictCollateralState> {
    let state = await this.getBuyCollateralState(market, price, shares, bufferBps);
    if (state.balanceWei < state.requiredWei) {
      throw new Error(
        `USDT balance insufficient: need ${Number(state.required).toFixed(6)}, have ${Number(state.balance).toFixed(6)}`
      );
    }
    if (state.allowanceWei >= state.requiredWei) {
      return state;
    }
    if (this.config.predictAutoSetApprovals === false) {
      throw new Error(
        `USDT allowance insufficient: need ${Number(state.required).toFixed(6)}, have ${Number(state.allowance).toFixed(6)}`
      );
    }

    await this.ensureTradingReady();
    state = await this.getBuyCollateralState(market, price, shares, bufferBps);
    if (state.allowanceWei < state.requiredWei) {
      throw new Error(
        `USDT allowance still insufficient after approvals: need ${Number(state.required).toFixed(6)}, have ${Number(state.allowance).toFixed(6)}`
      );
    }
    return state;
  }

  async buildLimitOrderPayload(params: LimitOrderParams): Promise<any> {
    // P0 FIX: 严格参数验证，防止NaN/Infinity/0/负数上链
    if (!params || typeof params !== 'object') {
      throw new Error('buildLimitOrderPayload: params is required');
    }
    const price = Number(params.price);
    const shares = Number(params.shares);
    if (!Number.isFinite(price) || price <= 0 || price >= 1) {
      throw new Error(`buildLimitOrderPayload: invalid price=${params.price} (must be 0 < price < 1)`);
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      throw new Error(`buildLimitOrderPayload: invalid shares=${params.shares} (must be > 0)`);
    }
    if (!params.market || !params.market.token_id) {
      throw new Error('buildLimitOrderPayload: market.token_id is required');
    }

    const side = params.side === 'BUY' ? Side.BUY : Side.SELL;
    const makerAddress = this.getMakerAddress();

    const sharesWei = this.toWei(params.shares, 5);
    const priceWei = this.toWei(params.price, 6);

    const { pricePerShare, makerAmount, takerAmount } = this.orderBuilder.getLimitOrderAmounts({
      side,
      quantityWei: sharesWei,
      pricePerShareWei: priceWei,
    });

    const order = this.orderBuilder.buildOrder('LIMIT', {
      maker: makerAddress,
      signer: makerAddress,
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
    const makerAddress = this.getMakerAddress();

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
      maker: makerAddress,
      signer: makerAddress,
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
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid value for toWei: ${value} (must be finite and > 0)`);
    }
    const normalized = value;
    const asString = normalized
      .toFixed(decimals)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*?)0+$/, '$1');

    return parseUnits(asString || '0', decimals);
  }

  private getLimitOrderAmounts(side: 'BUY' | 'SELL', price: number, shares: number) {
    return this.orderBuilder.getLimitOrderAmounts({
      side: side === 'BUY' ? Side.BUY : Side.SELL,
      quantityWei: this.toWei(shares, 5),
      pricePerShareWei: this.toWei(price, 6),
    });
  }

  private getCollateralAddresses(market: Market): {
    tokenAddress: string;
    spenderAddress: string;
    ownerAddress: string;
  } {
    const addresses = AddressesByChainId[this.chainId];
    const spenderAddress = market.is_yield_bearing
      ? market.is_neg_risk
        ? addresses.YIELD_BEARING_NEG_RISK_CTF_EXCHANGE
        : addresses.YIELD_BEARING_CTF_EXCHANGE
      : market.is_neg_risk
        ? addresses.NEG_RISK_CTF_EXCHANGE
        : addresses.CTF_EXCHANGE;

    return {
      tokenAddress: addresses.USDT,
      spenderAddress,
      ownerAddress: this.getMakerAddress(),
    };
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
