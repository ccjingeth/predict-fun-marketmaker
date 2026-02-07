# Liquidity Points Configuration Guide

## How It Works

Predict.fun has **liquidity points activation** rules for each market. To earn points, your orders must:

1. **Meet minimum shares requirement** - e.g., at least 100 shares
2. **Stay within max spread** - e.g., spread ≤ ±6¢ (6 cents)
3. **Have orders on both sides** - bid and ask orders simultaneously

## Setting Up Rules Manually

Since the API may not return these rules, you can configure them manually:

### Step 1: Find the Token ID

Go to [predict.fun](https://predict.fun/), find your market, and copy the token ID from the URL.

### Step 2: Note the Liquidity Activation Rules

Click on the market and look for the "Activate Points" section. Note:
- Min. shares (e.g., 100)
- Max spread in cents (e.g., ±6¢ = 6)

### Step 3: Update markets-config.json

Edit `markets-config.json`:

```json
{
  "markets": {
    "YOUR_TOKEN_ID_HERE": {
      "liquidity_activation": {
        "active": true,
        "min_shares": 100,
        "max_spread_cents": 6,
        "max_spread": 0.06,
        "description": "Max spread ±6¢, Min 100 shares"
      }
    }
  },
  "global_defaults": {
    "min_shares": 100,
    "max_spread_cents": 6,
    "max_spread": 0.06
  }
}
```

### Step 4: Run the Bot

```bash
npm run start:mm
```

The bot will:
- Apply your manual rules to the specified markets
- Use global defaults for markets without specific rules
- Show whether orders qualify for points ✨

## Example Configuration

```json
{
  "markets": {
    "0x1234567890abcdef1234567890abcdef12345678": {
      "liquidity_activation": {
        "active": true,
        "min_shares": 100,
        "max_spread_cents": 6,
        "max_spread": 0.06
      }
    },
    "0xabcdef1234567890abcdef1234567890abcdef12": {
      "liquidity_activation": {
        "active": true,
        "min_shares": 50,
        "max_spread_cents": 3,
        "max_spread": 0.03
      }
    }
  },
  "global_defaults": {
    "min_shares": 100,
    "max_spread_cents": 6,
    "max_spread": 0.06
  }
}
```

## Output Example

```
📝 Placing orders for Lakers vs Knicks... [✨ Points YES!]
   Bid: 0.4700 | Ask: 0.5300
   Bid Size: 212 shares ($10.00)
   Ask Size: 188 shares ($10.00)
   Max Spread for Points: ±6¢
   Min Shares for Points: 100
```

## How the Bot Adapts

- **If market has rules**: Uses market-specific min_shares and max_spread
- **If market has no rules**: Uses global_defaults (if configured)
- **If no rules at all**: Uses your .env configuration

## Tips

1. **Start conservatively** - Use small order sizes initially
2. **Check spread limits** - The bot auto-adjusts to stay within max_spread
3. **Monitor shares** - The bot calculates shares based on your USDT order size
4. **Both sides matter** - You need BOTH bid and ask orders to earn points
