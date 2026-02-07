/**
 * Load manual market configuration for liquidity activation rules
 * This is used when the API doesn't return these fields
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Market } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MarketsConfig {
  description?: string;
  note?: string;
  markets: Record<string, {
    liquidity_activation?: {
      active: boolean;
      min_shares: number;
      max_spread_cents: number;
      max_spread: number;
      description?: string;
    };
  }>;
  global_defaults?: {
    min_shares?: number;
    max_spread_cents?: number;
    max_spread?: number;
  };
}

let cachedConfig: MarketsConfig | null = null;

/**
 * Load markets configuration from markets-config.json
 */
export function loadMarketsConfig(): MarketsConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(__dirname, '../markets-config.json');

  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      cachedConfig = JSON.parse(configData) as MarketsConfig;
      return cachedConfig;
    }
  } catch (error) {
    console.error('Error loading markets config:', error);
  }

  // Return empty config if file doesn't exist
  return {
    markets: {},
  };
}

/**
 * Apply liquidity activation rules from config to markets
 */
export function applyLiquidityRules(markets: Market[]): Market[] {
  const config = loadMarketsConfig();

  return markets.map((market) => {
    const marketConfig = config.markets[market.token_id];

    if (marketConfig?.liquidity_activation) {
      // Apply market-specific rules
      market.liquidity_activation = {
        ...market.liquidity_activation,
        ...marketConfig.liquidity_activation,
      };
    } else if (config.global_defaults) {
      // Apply global defaults if no market-specific rules
      market.liquidity_activation = {
        active: true,
        min_shares: config.global_defaults.min_shares || 100,
        max_spread_cents: config.global_defaults.max_spread_cents || 6,
        max_spread: config.global_defaults.max_spread || 0.06,
      };
    }

    return market;
  });
}

/**
 * Add or update a market's liquidity activation rules
 */
export function setMarketLiquidityRules(
  tokenId: string,
  rules: {
    active: boolean;
    min_shares: number;
    max_spread_cents: number;
    max_spread: number;
    description?: string;
  }
): void {
  const config = loadMarketsConfig();

  if (!config.markets[tokenId]) {
    config.markets[tokenId] = {};
  }

  config.markets[tokenId].liquidity_activation = rules;

  // Save to file
  const configPath = path.join(__dirname, '../markets-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  // Clear cache
  cachedConfig = null;
}
