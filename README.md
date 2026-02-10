# Predict.fun Market Maker Bot

Automated market making bot for [Predict.fun](https://predict.fun/) - the BNB Chain prediction market protocol.

## Referral

- Invite link: [https://predict.fun?ref=B0CE6](https://predict.fun?ref=B0CE6)
- Twitter: @ccjing_eth

## Features

- **Automated Market Making**: Automatically places bid and ask orders on liquid markets
- **Smart Order Management**: Auto-cancels orders near fill to avoid unwanted positions
- **Position Management**: Market closes positions when limits are exceeded
- **Market Selection**: Automatically selects the most liquid and profitable markets
- **Liquidity Points**: Earn liquidity rewards by providing continuous limit orders
- **Risk Controls**: Configurable position limits, spread, and price movement thresholds
- **Dependency Arbitrage**: OR-Tools based combinatorial arbitrage via logical constraints
- **Multi-Outcome Arbitrage**: Sum of outcomes < $1 opportunities

## Architecture

```
predict-fun-market-maker/
├── src/
│   ├── api/
│   │   └── client.ts          # REST API client
│   ├── config.ts              # Configuration management
│   ├── types.ts               # TypeScript types
│   ├── market-selector.ts     # Market scoring and selection
│   ├── market-maker.ts        # Core MM logic
│   ├── index.ts               # Main entry point
│   └── test.ts                # Test script
├── .env.example               # Environment variables template
├── package.json
└── tsconfig.json
```

## Setup

### 1. Install Dependencies

```bash
cd predict-fun-market-maker
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# API Configuration
API_BASE_URL=https://api.predict.fun
API_KEY=your_api_key_here
JWT_TOKEN=your_jwt_token_here
RPC_URL=https://bsc-dataseed.binance.org

# Wallet Configuration
PRIVATE_KEY=your_private_key_here
PREDICT_ACCOUNT_ADDRESS=your_predict_account_address_here

# Market Maker Configuration
SPREAD=0.02                    # 2% spread
MIN_SPREAD=0.01                # floor spread
MAX_SPREAD=0.08                # cap spread
USE_VALUE_SIGNAL=false         # enable value signal bias
VALUE_SIGNAL_WEIGHT=0.35       # 0-1 blend weight
VALUE_CONFIDENCE_MIN=0.6       # 0-1 minimum confidence
ORDER_SIZE=10                  # $10 per order
MAX_SINGLE_ORDER_VALUE=50      # max $ per order
MAX_POSITION=100               # Max $100 position per market
INVENTORY_SKEW_FACTOR=0.15     # inventory bias
CANCEL_THRESHOLD=0.05          # Cancel on 5% price move
REPRICE_THRESHOLD=0.003        # re-quote if price drifts 0.3%
MIN_ORDER_INTERVAL_MS=3000     # cooldown per market
MAX_ORDERS_PER_MARKET=2        # cap open orders
MAX_DAILY_LOSS=200             # halt trading if below -$200
ANTI_FILL_BPS=0.002            # cancel when near taker
NEAR_TOUCH_BPS=0.0015          # early cancel threshold
COOLDOWN_AFTER_CANCEL_MS=4000
VOLATILITY_PAUSE_BPS=0.01
VOLATILITY_LOOKBACK_MS=10000
PAUSE_AFTER_VOLATILITY_MS=8000
HEDGE_ON_FILL=false
HEDGE_TRIGGER_SHARES=50
HEDGE_MODE=FLATTEN
HEDGE_MAX_SLIPPAGE_BPS=250
REFRESH_INTERVAL=5000          # 5 seconds between updates
ENABLE_TRADING=false           # Start in dry-run mode
AUTO_CONFIRM=false             # auto confirm executions

# Cross-platform arbitrage
CROSS_PLATFORM_ENABLED=false
CROSS_PLATFORM_MIN_PROFIT=0.01
CROSS_PLATFORM_MIN_SIMILARITY=0.78
CROSS_PLATFORM_AUTO_EXECUTE=false
CROSS_PLATFORM_REQUIRE_CONFIRM=true
CROSS_PLATFORM_TRANSFER_COST=0.002
CROSS_PLATFORM_SLIPPAGE_BPS=250
CROSS_PLATFORM_MAX_SHARES=200
CROSS_PLATFORM_DEPTH_LEVELS=10
CROSS_PLATFORM_EXECUTION_VWAP_CHECK=true
CROSS_PLATFORM_USE_FOK=true
CROSS_PLATFORM_PARALLEL_SUBMIT=true
CROSS_PLATFORM_LIMIT_ORDERS=true
CROSS_PLATFORM_CANCEL_OPEN_MS=1500
CROSS_PLATFORM_HEDGE_ON_FAILURE=false
CROSS_PLATFORM_HEDGE_PREDICT_ONLY=true
CROSS_PLATFORM_HEDGE_SLIPPAGE_BPS=400
CROSS_PLATFORM_MAPPING_PATH=cross-platform-mapping.json
CROSS_PLATFORM_USE_MAPPING=true

# Dependency arbitrage (OR-Tools)
DEPENDENCY_ARB_ENABLED=false
DEPENDENCY_CONSTRAINTS_PATH=dependency-constraints.json
DEPENDENCY_PYTHON_PATH=python3
DEPENDENCY_PYTHON_SCRIPT=scripts/dependency-arb.py
DEPENDENCY_MIN_PROFIT=0.02
DEPENDENCY_MAX_LEGS=6
DEPENDENCY_MAX_NOTIONAL=200
DEPENDENCY_MIN_DEPTH=1
DEPENDENCY_FEE_BPS=100
DEPENDENCY_SLIPPAGE_BPS=20
DEPENDENCY_MAX_ITER=12
DEPENDENCY_ORACLE_TIMEOUT_SEC=2
DEPENDENCY_TIMEOUT_MS=10000
DEPENDENCY_ALLOW_SELLS=true

# Multi-outcome arbitrage
MULTI_OUTCOME_ENABLED=true
MULTI_OUTCOME_MIN_OUTCOMES=3
MULTI_OUTCOME_MAX_SHARES=500

# Arbitrage auto-execution
ARB_AUTO_EXECUTE=false
ARB_AUTO_EXECUTE_VALUE=false
ARB_EXECUTE_TOP_N=1
ARB_EXECUTION_COOLDOWN_MS=60000
ARB_SCAN_INTERVAL_MS=10000
ARB_MAX_MARKETS=80
ARB_ORDERBOOK_CONCURRENCY=8
ARB_MARKETS_CACHE_MS=10000
ARB_WS_MAX_AGE_MS=10000
ARB_MAX_ERRORS=5
ARB_ERROR_WINDOW_MS=60000
ARB_PAUSE_ON_ERROR_MS=60000
ARB_WS_HEALTH_LOG_MS=0

When `ARB_AUTO_EXECUTE=true`, `npm run start:arb` runs continuous monitoring and executes top opportunities.
Value-mismatch auto execution is opt-in with `ARB_AUTO_EXECUTE_VALUE=true`.

# Alerts
ALERT_WEBHOOK_URL=
ALERT_MIN_INTERVAL_MS=60000

# Polymarket
POLYMARKET_GAMMA_URL=https://gamma-api.polymarket.com
POLYMARKET_CLOB_URL=https://clob.polymarket.com
POLYMARKET_FEE_RATE_URL=https://clob.polymarket.com/fee-rate
POLYMARKET_FEE_RATE_CACHE_MS=300000
POLYMARKET_FEE_CURVE_RATE=0.25
POLYMARKET_FEE_CURVE_EXPONENT=2
POLYMARKET_WS_ENABLED=false
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
POLYMARKET_WS_CUSTOM_FEATURE=false
POLYMARKET_WS_INITIAL_DUMP=true
POLYMARKET_CACHE_TTL_MS=60000
PREDICT_WS_ENABLED=false
PREDICT_WS_URL=wss://ws.predict.fun/ws
PREDICT_WS_API_KEY=
PREDICT_WS_TOPIC_KEY=token_id
POLYMARKET_PRIVATE_KEY=
POLYMARKET_API_KEY=
POLYMARKET_API_SECRET=
POLYMARKET_API_PASSPHRASE=

# Opinion
OPINION_OPENAPI_URL=https://proxy.opinion.trade:8443/openapi
OPINION_API_KEY=
OPINION_PRIVATE_KEY=
OPINION_CHAIN_ID=56
OPINION_HOST=https://proxy.opinion.trade:8443
OPINION_WS_ENABLED=false
OPINION_WS_URL=wss://ws.opinion.trade
OPINION_WS_HEARTBEAT_MS=30000
```

### 3. Get API Key (REQUIRED)

⚠️ **Important**: All API calls now require an API key, including public endpoints like `/markets` and `/orderbooks`.

To get your API key:
1. Join [Predict's Discord](https://discord.gg/predictdotfun)
2. Open a support ticket
3. Request an API key for trading

Add the API key to your `.env`:
```env
API_KEY=your_api_key_here
```

### 4. Generate JWT Token (REQUIRED for private endpoints)

```bash
npm run auth:jwt
```

This command will:
- Fetch auth challenge message
- Sign it with your configured wallet
- Exchange it for JWT
- Write `JWT_TOKEN=...` into `.env`

### 5. Configure Wallet

You have two options:

**Option A: Use EOA (Externally Owned Account)**
- Set `PRIVATE_KEY` in `.env`
- Leave `PREDICT_ACCOUNT_ADDRESS` empty

**Option B: Use Predict Account (Smart Wallet)**
- Get your deposit address from the Predict app settings
- Get your Privy wallet private key from settings
- Set both `PRIVATE_KEY` (Privy key) and `PREDICT_ACCOUNT_ADDRESS` (deposit address)

### 6. Set Approvals (First Time Only)

Before trading, approve protocol contracts:

```bash
npm run setup:approvals
```

### Risk Controls (Recommended Defaults)

This bot now includes production-grade safeguards:
- Adaptive spread with min/max bounds
- Inventory skew (reduce one side when exposure is high)
- Reprice/cooldown thresholds to prevent order spam
- Max open orders per market
- Session loss halt (`MAX_DAILY_LOSS`)
  - Optional value-signal bias (`USE_VALUE_SIGNAL`)

### Dependency Arbitrage (OR-Tools)

1. Install OR-Tools:

```bash
pip install ortools
```

2. Edit `dependency-constraints.json` with real token IDs.
3. Enable:

```env
DEPENDENCY_ARB_ENABLED=true
```

## Usage

Desktop app instructions: `USAGE.md`
Beginner guide: `docs/BEGINNER_GUIDE.md`
Config reference: `docs/CONFIG_REFERENCE.md`
JSON templates: `docs/JSON_TEMPLATES.md`

### Debug API Response

To check what fields the API actually returns (useful for finding liquidity activation rules):

```bash
npm run debug
```

This will show the raw API response structure, including any liquidity activation fields.

### Test Connection

```bash
npm test
```

### One-Click API Check

```bash
npm run check:api
```

This script will:
- Read `.env` automatically
- Verify `API_KEY` format and connectivity
- Validate `/markets` and `/orderbooks` endpoints
- Validate `/positions` when `JWT_TOKEN` is configured
- Warn if `PRIVATE_KEY` is still a demo key

This will:
- Test API connectivity
- Fetch and display markets
- Show orderbook data
- Run market selection analysis

### Run Bot (Dry Run Mode)

Start with `ENABLE_TRADING=false` to test without real orders:

```bash
npm run start:mm
```

### Run Bot (Live Trading)

Set `ENABLE_TRADING=true` in `.env` and run:

```bash
npm run start:mm
```

Required before live mode:
1. `npm run auth:jwt`
2. `npm run setup:approvals`

### Development Mode

Auto-restart on file changes:

```bash
npm run dev
```

### Desktop Console (Electron)

```bash
cd desktop-app
npm install
npm run dev

# package desktop app
npm run pack
```

Note: The desktop console reads the root `.env` file and spawns bots via `npx tsx`, so make sure root dependencies are installed. Packaged builds run compiled `dist` via system `node`. Set `NODE_BINARY` to override.

Cross-platform auto-execution requirements:
- Polymarket: configure `POLYMARKET_PRIVATE_KEY` (API keys can be derived or set manually).
- Opinion: install `opinion_clob_sdk` (Python) and set `OPINION_API_KEY` + `OPINION_PRIVATE_KEY`.
For unattended mode set `AUTO_CONFIRM=true` and `CROSS_PLATFORM_AUTO_EXECUTE=true`.
For strict event matching, maintain `cross-platform-mapping.json` with `predictMarketId` and external token IDs.

## How It Works

### 1. Market Selection

The bot scans all markets and scores them based on:
- **✨ Liquidity Points Activation** (+50 bonus points!)
  - Markets with active point rewards get highest priority
- **Liquidity** (24h volume)
- **Activity** (number of orders)
- **Spread** (tighter spreads score higher)

Only markets with sufficient liquidity and order depth are selected.

### 2. Liquidity Points Activation Rules

Each market may have specific rules to earn liquidity points:

```
liquidity_activation: {
  active: boolean,              // Is point earning active?
  max_spread_pct: number,       // Maximum spread allowed (e.g., 0.03 = 3%)
  min_order_size: number,       // Minimum order size (in USDT)
  requirements: string          // Additional requirements
}
```

**The bot automatically:**
- ✅ Adjusts spread to stay within `max_spread_pct`
- ✅ Ensures order size meets `min_order_size`
- ✅ Prioritizes markets with active liquidity rewards
- ✅ Shows whether orders qualify for points

### 3. Order Placement

For each selected market, the bot:
1. Fetches the current orderbook
2. Checks if orders will earn liquidity points
3. Adjusts spread to meet market requirements
4. Calculates the mid-price
5. Places bid orders slightly below mid-price
6. Places ask orders slightly above mid-price
7. Displays if orders qualify for points ✨

### 4. Risk Management

**Price Movement Protection**:
- Monitors price changes between updates
- Cancels all orders if price moves beyond `CANCEL_THRESHOLD`

**Fill Protection**:
- Monitors distance from best bid/ask
- Cancels orders that get too close to being filled
- Prevents accumulating unwanted positions

**Position Limits**:
- Tracks total position value per market
- Stops placing orders when `MAX_POSITION` is reached
- Can automatically close excess positions

### 5. Earning Liquidity Points

By maintaining continuous limit orders that meet the market's requirements:
- Orders must be within the `max_spread_pct` range
- Orders must be at least `min_order_size`
- Points are earned continuously while orders are on the book

These points may qualify you for airdrop rewards!

## Configuration Guide

### Spread (`SPREAD`)

The percentage difference between your bid and ask prices.

- Lower spread = more fills, higher risk
- Higher spread = fewer fills, lower risk
- Recommended: 0.02 - 0.05 (2-5%)

### Order Size (`ORDER_SIZE`)

The USDT value of each order.

- Smaller size = lower risk per trade
- Larger size = more liquidity points potential
- Recommended: 10 - 50 USDT

### Max Position (`MAX_POSITION`)

Maximum total exposure per market.

- Should be at least 10x your order size
- Prevents accumulation of too much inventory
- Recommended: 100 - 500 USDT

### Cancel Threshold (`CANCEL_THRESHOLD`)

Price movement percentage that triggers order cancellation.

- Lower = more conservative, more frequent cancels
- Higher = more aggressive, higher fill risk
- Recommended: 0.03 - 0.10 (3-10%)

### Refresh Interval (`REFRESH_INTERVAL`)

Milliseconds between market updates.

- Lower = faster reactions, more API calls
- Higher = fewer API calls, slower reactions
- Recommended: 3000 - 10000 ms

## API Documentation

- [Developer Docs](https://dev.predict.fun/)
- [API Reference](https://api.predict.fun/docs)
- [Order Creation Guide](https://dev.predict.fun/how-to-create-or-cancel-orders-679306m0)

## Important Notes

⚠️ **Warning**: This bot is in beta. Use at your own risk.

1. **Start in dry-run mode** (`ENABLE_TRADING=false`) to verify everything works
2. **Start small** - use small order sizes initially
3. **Monitor regularly** - check the bot's activity and positions
4. **Understand the risks** - prediction markets can be volatile
5. **Rate limits** - the API has rate limits (default: 240 req/min)

## SDK Integration

To fully enable trading, you need to integrate with the `@predictdotfun/sdk` package:

```bash
npm install @predictdotfun/sdk
```

The SDK handles:
- Order signing
- Privy wallet integration (for Predict accounts)
- Approval transactions
- Order cancellation

See [SDK Documentation](https://github.com/PredictDotFun/sdk) for details.

## Troubleshooting

**"Failed to connect to Predict.fun API"**
- Check your internet connection
- Verify `API_BASE_URL` is correct
- Try accessing https://api.predict.fun/docs in a browser

**"PRIVATE_KEY is required"**
- Make sure you created a `.env` file
- Add `PRIVATE_KEY=your_key_here` to `.env`

**No markets selected**
- The markets may have insufficient liquidity
- Try lowering `minLiquidity` and `minVolume24h` in `market-selector.ts`
- Verify your network connection

**Orders not being placed**
- Check if `ENABLE_TRADING=true` in `.env`
- Verify SDK integration is complete
- Check logs for error messages

## License

MIT

## Sources

- [Predict API Developer Documentation](https://dev.predict.fun/)
- [How to create or cancel orders](https://dev.predict.fun/how-to-create-or-cancel-orders-679306m0)
- [Get the orderbook for a market](https://dev.predict.fun/get-the-orderbook-for-a-market-25326908e0)
- [NPM SDK Package](https://www.npmjs.com/package/@predictdotfun/sdk)
- [Python SDK](https://github.com/PredictDotFun/sdk-python)
- [Predict.fun Homepage](https://predict.fun/)
