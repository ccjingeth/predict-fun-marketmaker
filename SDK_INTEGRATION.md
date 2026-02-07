# SDK Integration Guide

This guide explains how to integrate the `@predictdotfun/sdk` to enable actual trading functionality.

## Current Status

The bot is currently in **read-only mode**. It can:
- Fetch markets and orderbooks
- Analyze market liquidity
- Calculate optimal bid/ask prices

But it **cannot** yet:
- Sign orders
- Place orders
- Cancel orders
- Execute transactions

## Enabling Trading

### Step 1: Install the SDK

```bash
npm install @predictdotfun/sdk
npm install ethers@6
```

### Step 2: Create Order Manager

Create a new file `src/order-manager.ts`:

```typescript
import { OrderBuilder } from '@predictdotfun/sdk';
import { Wallet } from 'ethers';

export class OrderManager {
  private orderBuilder: OrderBuilder;
  private wallet: Wallet;
  private predictAccountAddress?: string;

  constructor(wallet: Wallet, predictAccountAddress?: string) {
    this.wallet = wallet;
    this.predictAccountAddress = predictAccountAddress;

    // Initialize OrderBuilder
    this.orderBuilder = OrderBuilder.make(
      wallet,
      predictAccountAddress // undefined for EOA, address for Predict Account
    );
  }

  /**
   * Set up required approvals (run once)
   */
  async setApprovals(): Promise<void> {
    console.log('Setting up approvals...');

    // Approve ERC-1155 (ConditionalTokens)
    await this.orderBuilder.setApprovalForAll(
      'CTF_EXCHANGE'
    );

    // Approve ERC-20 (USDT)
    // First get the USDT contract address from constants
    // Then approve
    console.log('Approvals complete!');
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(
    tokenId: string,
    side: 'BUY' | 'SELL',
    price: number,
    amountInUsdt: number,
    isNegRisk: boolean,
    isYieldBearing: boolean,
    feeRateBps: number
  ): Promise<string> {
    // Calculate order amounts
    const orderAmounts = this.orderBuilder.getLimitOrderAmounts({
      price,
      side: side === 'BUY' ? 'BUY' : 'SELL',
      amountInUsdt,
    });

    // Build the order
    const order = this.orderBuilder.buildOrder({
      tokenId,
      isNegRisk,
      isYieldBearing,
      maker: this.predictAccountAddress || this.wallet.address,
      orderType: 'LIMIT',
      side: side === 'BUY' ? 'BUY' : 'SELL',
      price: orderAmounts.price,
      amount: orderAmounts.amount,
      feeRateBps,
    });

    // Generate typed data
    const typedData = this.orderBuilder.buildTypedData(order);

    // Sign the order
    const signedOrder = this.orderBuilder.signTypedDataOrder(typedData);

    // Compute order hash
    const orderHash = this.orderBuilder.buildTypedDataHash(typedData);

    // Return signed order for API submission
    return {
      order_hash: orderHash,
      ...signedOrder,
    };
  }

  /**
   * Cancel an order
   */
  async cancelOrder(order: any): Promise<void> {
    // Build cancel transaction
    const cancelTx = await this.orderBuilder.buildCancelOrder([order]);

    // Sign and send transaction
    const tx = await this.wallet.sendTransaction(cancelTx);
    await tx.wait();
  }

  /**
   * Place a market order (to close positions)
   */
  async placeMarketOrder(
    tokenId: string,
    side: 'BUY' | 'SELL',
    amount: number,
    isNegRisk: boolean,
    isYieldBearing: boolean,
    feeRateBps: number
  ): Promise<string> {
    // Build market order
    const order = this.orderBuilder.buildOrder({
      tokenId,
      isNegRisk,
      isYieldBearing,
      maker: this.predictAccountAddress || this.wallet.address,
      orderType: 'MARKET',
      side: side === 'BUY' ? 'BUY' : 'SELL',
      amount,
      feeRateBps,
    });

    // Generate and sign
    const typedData = this.orderBuilder.buildTypedData(order);
    const signedOrder = this.orderBuilder.signTypedDataOrder(typedData);
    const orderHash = this.orderBuilder.buildTypedDataHash(typedData);

    return {
      order_hash: orderHash,
      ...signedOrder,
    };
  }
}
```

### Step 3: Update Market Maker

Integrate the `OrderManager` into `src/market-maker.ts`:

```typescript
import { OrderManager } from './order-manager.js';

export class MarketMaker {
  // ... existing code ...

  private orderManager?: OrderManager;

  constructor(api: PredictAPI, config: Config) {
    this.api = api;
    this.config = config;

    // Initialize order manager if trading is enabled
    if (config.enableTrading) {
      const wallet = new Wallet(config.privateKey);
      this.orderManager = new OrderManager(wallet, config.predictAccountAddress);
    }
  }

  async placeMMOrders(market: Market, orderbook: Orderbook): Promise<void> {
    if (!this.config.enableTrading) {
      console.log('⚠️  Trading is disabled.');
      return;
    }

    if (!this.orderManager) {
      console.log('⚠️  OrderManager not initialized.');
      return;
    }

    // ... existing validation code ...

    const prices = this.calculatePrices(orderbook);
    if (!prices) return;

    // Calculate amounts based on order size
    const bidAmountUsdt = this.config.orderSize;
    const askAmountUsdt = this.config.orderSize;

    try {
      // Place bid order
      const signedBidOrder = await this.orderManager.placeLimitOrder(
        market.token_id,
        'BUY',
        prices.bidPrice,
        bidAmountUsdt,
        market.is_neg_risk,
        market.is_yield_bearing,
        market.fee_rate_bps
      );

      await this.api.createOrder(signedBidOrder);
      console.log(`✅ Bid order placed at ${prices.bidPrice.toFixed(4)}`);

      // Place ask order
      const signedAskOrder = await this.orderManager.placeLimitOrder(
        market.token_id,
        'SELL',
        prices.askPrice,
        askAmountUsdt,
        market.is_neg_risk,
        market.is_yield_bearing,
        market.fee_rate_bps
      );

      await this.api.createOrder(signedAskOrder);
      console.log(`✅ Ask order placed at ${prices.askPrice.toFixed(4)}`);

    } catch (error) {
      console.error('Error placing orders:', error);
    }
  }

  async cancelOrder(order: Order): Promise<void> {
    if (!this.orderManager) return;

    try {
      await this.orderManager.cancelOrder(order);
      this.openOrders.delete(order.order_hash);
      console.log(`✅ Order canceled`);
    } catch (error) {
      console.error(`Error canceling order:`, error);
    }
  }

  async closePosition(tokenId: string): Promise<void> {
    if (!this.orderManager) return;

    const position = this.positions.get(tokenId);
    if (!position) return;

    try {
      // Close YES position
      if (position.yes_amount > 0) {
        const signedOrder = await this.orderManager.placeMarketOrder(
          tokenId,
          'SELL',
          position.yes_amount,
          false, // isNegRisk
          false, // isYieldBearing
          0 // feeRateBps
        );
        await this.api.createOrder(signedOrder);
      }

      // Close NO position
      if (position.no_amount > 0) {
        const signedOrder = await this.orderManager.placeMarketOrder(
          tokenId,
          'SELL',
          position.no_amount,
          false,
          false,
          0
        );
        await this.api.createOrder(signedOrder);
      }

      console.log(`✅ Position closed`);
    } catch (error) {
      console.error(`Error closing position:`, error);
    }
  }
}
```

### Step 4: Setup Script

Create `scripts/setup.ts` for one-time setup:

```typescript
import { Wallet } from 'ethers';
import { loadConfig } from '../src/config.js';
import { OrderManager } from '../src/order-manager.js';

async function setup() {
  const config = loadConfig();
  const wallet = new Wallet(config.privateKey);
  const orderManager = new OrderManager(wallet, config.predictAccountAddress);

  console.log('Setting up approvals for trading...');
  await orderManager.setApprovals();
  console.log('Setup complete!');
}

setup().catch(console.error);
```

Run setup:
```bash
npm run setup
```

## Constants

You'll need the contract addresses. Check `@predictdotfun/sdk` constants:

```typescript
import { CHAIN_ID, CTF_EXCHANGE, NEG_RISK_CTF_EXCHANGE } from '@predictdotfun/sdk';

// or manually:
const CHAIN_ID = 56; // BSC Mainnet
const CTF_EXCHANGE = '0x...'; // Check sdk or deployed contracts
const NEG_RISK_CTF_EXCHANGE = '0x...';
const USDT = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT
```

## Testing

After integration:

1. Start with `ENABLE_TRADING=false` to test logic
2. Use small order sizes initially
3. Monitor first few trades closely
4. Check gas costs and slippage

## Common Issues

**"Insufficient allowance"**
- Run the setup script to set approvals

**"Invalid signature"**
- Ensure you're using the correct signer
- For Predict Account, use Privy key as signer, predictAccount as maker

**"Order rejected"**
- Check order size (min/max limits)
- Verify price is in valid range (0.01 - 0.99)
- Ensure token_id is valid

**"Gas required exceeds allowance"**
- Add BNB to your wallet for gas
- Cancel orders requires gas

## Resources

- [SDK GitHub](https://github.com/PredictDotFun/sdk)
- [SDK NPM](https://www.npmjs.com/package/@predictdotfun/sdk)
- [Order Creation Guide](https://dev.predict.fun/how-to-create-or-cancel-orders-679306m0)
