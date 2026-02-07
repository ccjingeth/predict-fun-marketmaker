/**
 * Test script for Predict.fun Market Maker
 * Tests API connections and basic functionality
 */

import { loadConfig } from './config.js';
import { PredictAPI } from './api/client.js';
import { MarketSelector } from './market-selector.js';

async function test() {
  console.log('🧪 Predict.fun Market Maker - Test Script\n');

  // Load config
  const config = loadConfig();

  // Initialize API
  const api = new PredictAPI(config.apiBaseUrl, config.apiKey);

  console.log('Test 1: API Connection');
  console.log('─'.repeat(80));
  const connected = await api.testConnection();
  console.log(`Result: ${connected ? '✅ PASS' : '❌ FAIL'}\n`);

  if (!connected) {
    console.log('Cannot proceed without API connection');
    return;
  }

  console.log('\nTest 2: Fetch Markets');
  console.log('─'.repeat(80));
  try {
    const markets = await api.getMarkets();
    console.log(`✅ PASS - Found ${markets.length} markets`);

    // Display first 3 markets
    console.log('\nSample markets:');
    for (let i = 0; i < Math.min(3, markets.length); i++) {
      const m = markets[i];
      console.log(`  ${i + 1}. ${m.question.substring(0, 60)}...`);
      console.log(`     Token ID: ${m.token_id}`);
      console.log(`     Neg Risk: ${m.is_neg_risk} | Yield Bearing: ${m.is_yield_bearing}`);
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error}`);
  }

  console.log('\n\nTest 3: Fetch Orderbook');
  console.log('─'.repeat(80));
  try {
    const markets = await api.getMarkets();
    if (markets.length > 0) {
      const firstMarket = markets[0];
      const orderbook = await api.getOrderbook(firstMarket.token_id);

      console.log(`✅ PASS - Orderbook for ${firstMarket.question.substring(0, 40)}...`);
      console.log(`  Best Bid: ${orderbook.best_bid?.toFixed(4) || 'N/A'}`);
      console.log(`  Best Ask: ${orderbook.best_ask?.toFixed(4) || 'N/A'}`);
      console.log(`  Spread: ${orderbook.spread_pct?.toFixed(2)}% or N/A`);
      console.log(`  Bids: ${orderbook.bids.length}`);
      console.log(`  Asks: ${orderbook.asks.length}`);

      if (orderbook.bids.length > 0) {
        console.log(`\n  Top 3 Bids:`);
        for (let i = 0; i < Math.min(3, orderbook.bids.length); i++) {
          const bid = orderbook.bids[i];
          console.log(`    ${i + 1}. ${bid.price} (${bid.shares} shares)`);
        }
      }

      if (orderbook.asks.length > 0) {
        console.log(`\n  Top 3 Asks:`);
        for (let i = 0; i < Math.min(3, orderbook.asks.length); i++) {
          const ask = orderbook.asks[i];
          console.log(`    ${i + 1}. ${ask.price} (${ask.shares} shares)`);
        }
      }
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error}`);
  }

  console.log('\n\nTest 4: Market Selection');
  console.log('─'.repeat(80));
  try {
    const markets = await api.getMarkets();
    const orderbooks = new Map();

    // Fetch orderbooks for first 20 markets
    for (const market of markets.slice(0, 20)) {
      try {
        const orderbook = await api.getOrderbook(market.token_id);
        orderbooks.set(market.token_id, orderbook);
        market.best_bid = orderbook.best_bid;
        market.best_ask = orderbook.best_ask;
        market.spread_pct = orderbook.spread_pct;
        market.total_orders =
          (orderbook.bids?.length || 0) + (orderbook.asks?.length || 0);
      } catch {
        // Skip failed orderbooks
      }
    }

    const selector = new MarketSelector();
    const scored = selector.selectMarkets(markets, orderbooks);

    console.log(`✅ PASS - Analyzed ${scored.length} markets`);
    console.log(`  Top 5 markets:`);

    for (let i = 0; i < Math.min(5, scored.length); i++) {
      const { market, score, reasons } = scored[i];
      console.log(`\n  #${i + 1} [Score: ${score.toFixed(1)}]`);
      console.log(`     Question: ${market.question.substring(0, 50)}...`);
      console.log(`     Reasons: ${reasons.join(', ')}`);
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error}`);
  }

  console.log('\n\n' + '─'.repeat(80));
  console.log('✅ Tests Complete');
  console.log('─'.repeat(80) + '\n');
}

// Run tests
test().catch(console.error);
