/**
 * VWAP / depth utilities for orderbooks
 */

import type { OrderbookEntry } from '../types.js';
import { calcFeeCost } from './fee-utils.js';

export interface VwapResult {
  filledShares: number;
  totalNotional: number;
  totalFees: number;
  totalSlippage: number;
  totalAllIn: number;
  avgPrice: number;
  avgAllIn: number;
  levelsUsed: number;
}

function normalizeLevels(entries: OrderbookEntry[] | undefined, side: 'ASK' | 'BID'): { price: number; shares: number }[] {
  if (!entries || entries.length === 0) {
    return [];
  }
  const levels = entries
    .map((entry) => ({
      price: Number(entry.price),
      shares: Number(entry.shares),
    }))
    .filter((level) => Number.isFinite(level.price) && level.price > 0 && Number.isFinite(level.shares) && level.shares > 0);

  levels.sort((a, b) => (side === 'ASK' ? a.price - b.price : b.price - a.price));
  return levels;
}

export function sumDepth(entries: OrderbookEntry[] | undefined): number {
  if (!entries) {
    return 0;
  }
  return entries.reduce((sum, entry) => {
    const shares = Number(entry.shares);
    return sum + (Number.isFinite(shares) && shares > 0 ? shares : 0);
  }, 0);
}

export function estimateBuy(
  asks: OrderbookEntry[] | undefined,
  targetShares: number,
  feeBps: number,
  feeCurveRate?: number,
  feeCurveExponent?: number,
  slippageBps: number = 0
): VwapResult | null {
  const levels = normalizeLevels(asks, 'ASK');
  if (levels.length === 0 || targetShares <= 0) {
    return null;
  }

  let remaining = targetShares;
  let totalNotional = 0;
  let totalFees = 0;
  let totalSlippage = 0;
  let levelsUsed = 0;

  for (const level of levels) {
    if (remaining <= 0) break;
    const fill = Math.min(remaining, level.shares);
    totalNotional += level.price * fill;
    totalFees += calcFeeCost(level.price, feeBps, feeCurveRate, feeCurveExponent) * fill;
    totalSlippage += level.price * (slippageBps / 10000) * fill;
    remaining -= fill;
    levelsUsed += 1;
  }

  const filledShares = targetShares - remaining;
  if (filledShares <= 0 || remaining > 0) {
    return null;
  }

  const totalAllIn = totalNotional + totalFees + totalSlippage;
  return {
    filledShares,
    totalNotional,
    totalFees,
    totalSlippage,
    totalAllIn,
    avgPrice: totalNotional / filledShares,
    avgAllIn: totalAllIn / filledShares,
    levelsUsed,
  };
}

export function estimateSell(
  bids: OrderbookEntry[] | undefined,
  targetShares: number,
  feeBps: number,
  feeCurveRate?: number,
  feeCurveExponent?: number,
  slippageBps: number = 0
): VwapResult | null {
  const levels = normalizeLevels(bids, 'BID');
  if (levels.length === 0 || targetShares <= 0) {
    return null;
  }

  let remaining = targetShares;
  let totalNotional = 0;
  let totalFees = 0;
  let totalSlippage = 0;
  let levelsUsed = 0;

  for (const level of levels) {
    if (remaining <= 0) break;
    const fill = Math.min(remaining, level.shares);
    totalNotional += level.price * fill;
    totalFees += calcFeeCost(level.price, feeBps, feeCurveRate, feeCurveExponent) * fill;
    totalSlippage += level.price * (slippageBps / 10000) * fill;
    remaining -= fill;
    levelsUsed += 1;
  }

  const filledShares = targetShares - remaining;
  if (filledShares <= 0 || remaining > 0) {
    return null;
  }

  const totalAllIn = totalNotional - totalFees - totalSlippage;
  return {
    filledShares,
    totalNotional,
    totalFees,
    totalSlippage,
    totalAllIn,
    avgPrice: totalNotional / filledShares,
    avgAllIn: totalAllIn / filledShares,
    levelsUsed,
  };
}

export function maxBuySharesForLimit(
  asks: OrderbookEntry[] | undefined,
  limitPrice: number,
  maxDeviationBps: number,
  feeBps: number,
  feeCurveRate?: number,
  feeCurveExponent?: number,
  slippageBps: number = 0
): number {
  const levels = normalizeLevels(asks, 'ASK');
  if (levels.length === 0 || limitPrice <= 0) {
    return 0;
  }

  const maxDev = Math.max(0, maxDeviationBps) / 10000;
  const limitAllIn = limitPrice * (1 + maxDev);
  let totalAllIn = 0;
  let shares = 0;

  for (const level of levels) {
    const unitFee = calcFeeCost(level.price, feeBps, feeCurveRate, feeCurveExponent);
    const unitSlippage = level.price * (slippageBps / 10000);
    const unitCost = level.price + unitFee + unitSlippage;

    if (unitCost <= limitAllIn) {
      const fill = level.shares;
      totalAllIn += unitCost * fill;
      shares += fill;
      continue;
    }

    const numerator = limitAllIn * shares - totalAllIn;
    if (numerator <= 0) {
      break;
    }
    const maxFill = numerator / (unitCost - limitAllIn);
    if (maxFill <= 0) {
      break;
    }
    const fill = Math.min(level.shares, maxFill);
    totalAllIn += unitCost * fill;
    shares += fill;
    break;
  }

  return shares;
}

export function maxSellSharesForLimit(
  bids: OrderbookEntry[] | undefined,
  limitPrice: number,
  maxDeviationBps: number,
  feeBps: number,
  feeCurveRate?: number,
  feeCurveExponent?: number,
  slippageBps: number = 0
): number {
  const levels = normalizeLevels(bids, 'BID');
  if (levels.length === 0 || limitPrice <= 0) {
    return 0;
  }

  const maxDev = Math.max(0, maxDeviationBps) / 10000;
  const limitAllIn = limitPrice * (1 - maxDev);
  let totalAllIn = 0;
  let shares = 0;

  for (const level of levels) {
    const unitFee = calcFeeCost(level.price, feeBps, feeCurveRate, feeCurveExponent);
    const unitSlippage = level.price * (slippageBps / 10000);
    const unitProceeds = level.price - unitFee - unitSlippage;

    if (unitProceeds >= limitAllIn) {
      const fill = level.shares;
      totalAllIn += unitProceeds * fill;
      shares += fill;
      continue;
    }

    const numerator = totalAllIn - limitAllIn * shares;
    if (numerator <= 0) {
      break;
    }
    const maxFill = numerator / (limitAllIn - unitProceeds);
    if (maxFill <= 0) {
      break;
    }
    const fill = Math.min(level.shares, maxFill);
    totalAllIn += unitProceeds * fill;
    shares += fill;
    break;
  }

  return shares;
}
